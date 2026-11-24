// AI cameras: real video analysed in this browser. Sources are this computer's camera, an IP
// camera over HTTP (through the server, so its pixels can be analysed) or a video file chosen
// here to test with. Confirmed detections go to the server, which raises the incident and keeps
// the frame as evidence (server/cameraApi.mjs). Analysis runs while this console is open.
import { get, post } from './api.js';
import { on, session } from './hub.js';
import { SKELETON, WEAPON_CLASSES, createPixelAnalyzer, createTracker, loadDetector, loadPoseModel, loadZeroShot, posesForPeople } from './detectors.js';
import { CAMERA_ROLES, FIRE_LOW, ROLE_ANALYZERS, SMOKING_THRESHOLDS, fireConfirms, ZONE_TYPES, ZS_THRESHOLDS, acceptPerson, dedupeBoxes, handNearFace, smokingCandidate, smokingVerdict, upperBodyRect, cigaretteNotKnife, knifeConfirms, zeroShotConfirmed, zoomConfirms, zoomRect, createBehaviour, feetOf, heldBy, inPolygon, nearBox } from '../shared/cameraRules.js';
import { button, confirmDialog, formDialog, h, notify } from './ui.js';

const ANALYZER_LABEL = {
  objects: 'People & weapons (AI model)',
  behaviour: 'Behaviour (loitering, circling, running, person down)',
  zones: 'Zones (sensitive area, door, fence)',
  fire: 'Fire',
  smoke: 'Smoke',
};
const TRACKING = 'Person detection (D-FINE-L on the GPU; RT-DETRv2 or COCO-SSD without one), tracked frame by frame';
const OWL_METHOD = 'OWLv2 open-vocabulary detector (GPU), seen clearly once or in two looks in a row, and confirmed on a close-up crop.';
const OWL_FIRE_METHOD = 'OWLv2 open-vocabulary detector (GPU) on the whole picture, seen clearly once or in two looks in a row.';
const SMOKING_METHOD = 'OWLv2 on a close-up of the head and hands (the person with a hand at the face first); the cigarette must beat a phone, cup or food there, clearly once or in two looks.';
const METHOD = {
  smoking: SMOKING_METHOD,
  weapon: 'Object detector (D-FINE-L, or RT-DETRv2 / COCO-SSD without a GPU); no person holding it.',
  armed: 'Object detector (D-FINE-L, or RT-DETRv2 / COCO-SSD without a GPU); the weapon is at a person’s hands.',
  firearm: OWL_METHOD,
  arson: 'Flame colour and flicker analysis (no trained model) with a person detected next to the flames.',
  person: `${TRACKING}, someone in the tower’s view for a few seconds.`,
  zone: `${TRACKING}, with zone check.`,
  fire: 'Flame colour and flicker analysis (no trained model).',
  smoke: 'Analysis of grey moving regions (no trained model).',
  intrusion: `${TRACKING}, inside the sensitive area with no active permit.`,
  door: `${TRACKING}, staying at the door with no active permit.`,
  dwell: `${TRACKING}, inside the sensitive area longer than allowed.`,
  loiter: `${TRACKING}, someone in view for minutes.`,
  circling: `${TRACKING}, path back and forth along / around the building.`,
  climb: `${TRACKING}, feet raised on or crossing the fence line.`,
  running: `${TRACKING}, moving faster than walking pace.`,
  fall: `${TRACKING}, body lying on the ground for seconds.`,
};
// Sensor alerts a camera checks (unauthorized / unknown device, attack tool).
const DEVICE_ALERTS = new Set(['air-unauth', 'air-unknown', 'air-rule', 'air-attacktool']);
const ZONE_STYLE = {
  restricted: ['rgba(248,113,113,.9)', 'rgba(248,113,113,.12)', '#fecaca'],
  door: ['rgba(251,146,60,.95)', 'rgba(251,146,60,.18)', '#fed7aa'],
  fence: ['rgba(250,204,21,.95)', 'rgba(250,204,21,.14)', '#fef08a'],
  watch: ['rgba(56,189,248,.9)', 'rgba(56,189,248,.10)', '#bae6fd'],
};
const zoneType = (z) => (ZONE_STYLE[z.type] ? z.type : 'watch');
const withRole = (analyzers, role) => [...new Set([...analyzers, ...(ROLE_ANALYZERS[role] ?? [])])].filter((a) => ANALYZER_LABEL[a]);
const W = 640;
const H = 360;
const SMALL_W = 160;
const SMALL_H = 90;
const CONFIRM = 3; // frames out of the last 5
// Weapons and devices; person thresholds come with the detector (loadDetector).
const MIN_CONF = { weapon: 0.5, device: 0.45 };
// What someone may be carrying when a sensor hears an unauthorized device.
const DEVICE_CLASSES = new Set(['cell phone', 'laptop']);

export function createAiCameras({ root }) {
  const box = root.querySelector('#ai-cams');
  const tools = root.querySelector('#ai-cams-tools');
  let sources = [];
  // Quick sources opened from the toolbar: this computer's camera and uploaded videos. They live
  // in this browser only (nothing to set up, no supervisor needed); detections still go to the server.
  let localSources = [];
  const all = () => [...localSources, ...sources];
  const QUICK_ANALYZERS = ['objects', 'zones', 'fire', 'smoke'];
  const live = new Map(); // source id → runtime state
  let permits = [];

  async function load() {
    try {
      const r = await get('cameras');
      sources = r.sources;
      permits = r.permits ?? [];
    } catch (err) {
      sources = [];
      notify(err.message, 'bad');
    }
    render();
  }

  async function loadPermits() {
    try {
      permits = (await get('vision/permits')).permits;
      render();
    } catch {
      /* keep the last list */
    }
  }
  const permitOf = (src) => permits.find((p) => p.sourceId === src.id && p.until > Date.now()) ?? null;
  const hasSensitive = (src) => src.role === 'sensitive' || src.zones.some((z) => z.type === 'restricted' || z.type === 'door');

  async function grantPermit(src) {
    const r = await formDialog({
      title: `Permit · ${src.name}`,
      iconName: 'key',
      intro: 'While the permit is active, people in this camera’s sensitive area are not reported. It ends by itself.',
      fields: [
        { name: 'holder', label: 'Who is allowed in', required: true, maxlength: 60, placeholder: 'e.g. Maintenance team — Ahmed' },
        { name: 'minutes', label: 'For how many minutes', type: 'number', min: 1, max: 720, value: '30', required: true },
        { name: 'reason', label: 'Reason (optional)', maxlength: 120 },
      ],
      submitLabel: 'Grant permit',
    });
    if (!r) return;
    try {
      permits = (await post('vision/permits', { sourceId: src.id, sourceName: src.name, holder: r.holder, minutes: Number(r.minutes), reason: r.reason })).permits;
      notify(`Permit granted: ${r.holder}.`);
      render();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  async function revokePermit(p) {
    try {
      permits = (await post('vision/permits/revoke', { id: p.id })).permits;
      notify('Permit revoked.');
      render();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  // A sensor reported an unauthorized device: every running camera that covers that sensor looks
  // at who is there on its next frame and reports it to the incident.
  on('incidents', ({ incident, event } = {}) => {
    if (event !== 'created' || !incident || !DEVICE_ALERTS.has(incident.key)) return;
    for (const st of live.values()) {
      const src = st.src;
      if (!src.verifyDevices || st.status !== 'Running') continue;
      if (src.sensors?.length && !src.sensors.some((id) => String(incident.dev ?? '').includes(id))) continue;
      st.verify.push(incident.id);
    }
  });
  on('config', (what) => what === 'permits' && loadPermits());

  async function save(next, message) {
    try {
      sources = (await post('cameras', { sources: next })).sources;
      for (const st of live.values()) st.src = sources.find((x) => x.id === st.src.id) ?? st.src;
      notify(message);
      render();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  async function editSource(src = null) {
    const r = await formDialog({
      title: src ? `Edit ${src.name}` : 'Add a camera',
      iconName: 'camera',
      intro: 'IP cameras: use the camera’s MJPEG stream or JPEG snapshot address (RTSP is not supported in the browser). A video file is chosen on the camera tile and stays on this computer.',
      fields: [
        { name: 'name', label: 'Name', required: true, maxlength: 40, value: src?.name ?? '', placeholder: 'e.g. Warehouse aisle 4' },
        {
          name: 'kind',
          label: 'Source',
          type: 'select',
          options: [['file', 'Video file (to test)'], ['webcam', 'This computer’s camera / USB camera'], ['ip-mjpeg', 'IP camera — MJPEG stream (http://…)'], ['ip-snapshot', 'IP camera — JPEG snapshot (http://…)']],
          value: src ? (src.kind === 'ip' ? `ip-${src.mode}` : src.kind) : 'file',
        },
        { name: 'url', label: 'Camera address (IP cameras only)', maxlength: 300, value: src?.url ?? '', placeholder: 'http://user:password@192.168.1.20/video.mjpg' },
        { name: 'role', label: 'Camera role', type: 'select', options: Object.entries(CAMERA_ROLES), value: src?.role ?? 'general', hint: 'Sensitive area: nobody without a permit. Tower 360°: loitering, circling, weapons, fire and fence climbing around the site.' },
        ...Object.entries(ANALYZER_LABEL).map(([k, label]) => ({ name: `a-${k}`, label: `Analyse: ${label}`, type: 'checkbox', value: src ? src.analyzers.includes(k) : k === 'objects' })),
        { name: 'verifyDevices', label: 'Check sensor alerts (unauthorized device → look at who is there)', type: 'checkbox', value: src?.verifyDevices ?? false },
        { name: 'sensors', label: 'Sensors this camera covers (IDs, comma-separated; empty = all)', maxlength: 120, value: (src?.sensors ?? []).join(', '), placeholder: 'e.g. AS-1, ESP32-GATE' },
      ],
      submitLabel: src ? 'Save' : 'Add camera',
    });
    if (!r) return;
    const [kind, mode] = r.kind.startsWith('ip-') ? ['ip', r.kind.slice(3)] : [r.kind, 'mjpeg'];
    const next = {
      id: src?.id ?? `cam${Date.now().toString(36)}`,
      name: r.name,
      kind,
      mode,
      url: kind === 'ip' ? r.url : null,
      role: r.role,
      analyzers: withRole(Object.keys(ANALYZER_LABEL).filter((k) => r[`a-${k}`]), r.role),
      zones: src?.zones ?? [],
      verifyDevices: r.verifyDevices,
      sensors: r.sensors.split(',').map((x) => x.trim()).filter(Boolean),
    };
    stop(next.id);
    await save(src ? sources.map((s) => (s.id === src.id ? next : s)) : [...sources, next], src ? `${next.name} saved.` : `${next.name} added.`);
  }

  // ---------------------------------------------------------------- running a source
  async function start(src, file = null) {
    stop(src.id);
    const st = { runId: Date.now().toString(36), src, timer: null, frames: [], tracker: createTracker(), pixels: createPixelAnalyzer(), behaviour: createBehaviour(), hits: {}, reported: {}, inside: new Map(), verify: [], fps: 0, status: 'Starting…', media: null, url: null, busy: false };
    live.set(src.id, st);
    try {
      if (src.kind === 'webcam') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
        st.media = Object.assign(document.createElement('video'), { srcObject: stream, muted: true, playsInline: true });
        await st.media.play();
      } else if (src.kind === 'file') {
        if (!file) throw new Error('Choose a video file first.');
        st.url = URL.createObjectURL(file);
        st.media = Object.assign(document.createElement('video'), { src: st.url, muted: true, loop: true, playsInline: true });
        st.testVideo = true;
        st.fileName = file.name;
        await st.media.play();
      } else {
        st.media = new Image();
        const reload = () => (st.media.src = `api/cameras/${src.id}/stream${src.mode === 'snapshot' ? `?t=${Date.now()}` : ''}`);
        if (src.mode === 'snapshot') st.reload = setInterval(reload, 700);
        st.media.onerror = () => (st.status = 'No picture — check the address, user name and password');
        reload();
      }
      if (src.analyzers.some((a) => a === 'objects' || a === 'zones' || a === 'behaviour')) {
        st.status = 'Loading AI model…';
        renderTile(src);
        st.detector = await loadDetector();
        zeroShotLoop(); // second look (firearms, knives, smoke) when this computer has a GPU
        st.poses = await loadPoseModel();
      }
      st.status = 'Running';
      st.timer = setInterval(() => analyse(st), 300);
      // Fire and smoke on their own steady clock (cheap): the detector takes ~0.3 s or more per frame,
      // and at its pace a short flare-up ended before it was seen in enough frames (tested).
      st.pxTimer = setInterval(() => pixelStep(st), 300);
    } catch (err) {
      st.status = err.name === 'NotAllowedError' ? 'Camera permission refused' : err.message;
      notify(st.status, 'bad');
    }
    render();
  }

  function stop(id) {
    const st = live.get(id);
    if (!st) return;
    clearInterval(st.timer);
    clearInterval(st.pxTimer);
    clearInterval(st.reload);
    st.media?.srcObject?.getTracks().forEach((t) => t.stop());
    if (st.media && 'pause' in st.media) st.media.pause();
    if (st.url) URL.revokeObjectURL(st.url);
    for (const [, v] of st.inside) if (v.rowId) post('vision/presence-event', { event: 'exit', id: v.rowId }).catch(() => {});
    live.delete(id);
  }

  const ready = (m) => (m instanceof HTMLVideoElement ? m.readyState >= 2 && m.videoWidth > 0 : m?.complete && m.naturalWidth > 0);

  async function analyse(st) {
    const canvas = box.querySelector(`canvas[data-cam="${st.src.id}"]`);
    if (!canvas || st.busy || !ready(st.media)) return;
    // One GPU for every camera and the second look: with more cameras each analyses less often
    // (3 a second alone, about 1 a second each with four), leaving the second look room to run.
    const gap = 300 * Math.max(1, live.size * 0.85);
    if (performance.now() - (st.lastAnalysis ?? 0) < gap) return;
    st.lastAnalysis = performance.now();
    st.busy = true;
    const t0 = performance.now();
    try {
      const c = canvas.getContext('2d');
      // The frame is analysed on a hidden canvas and shown only with its boxes (paint below): the
      // detector takes ~0.3 s, and drawing the bare frame first made the boxes flicker.
      st.work ??= Object.assign(document.createElement('canvas'), { width: W, height: H });
      const work = st.work;
      work.getContext('2d').drawImage(st.media, 0, 0, W, H);
      const a = new Set(st.src.analyzers);
      const found = {};
      const draw = [];
      let people = [];
      let events = []; // behaviour events: reported after painting, so their evidence frame shows the boxes
      let personBoxes = []; // every person candidate, accepted or not: masked out of fire / smoke
      if (a.has('objects') || a.has('zones') || a.has('behaviour')) {
        const det = st.detector;
        const preds = await det.detect(work);
        const weapons = [];
        const devices = [];
        const candidates = [];
        for (const p of preds) {
          const b = [p.bbox[0] / W, p.bbox[1] / H, p.bbox[2] / W, p.bbox[3] / H];
          if (a.has('objects') && WEAPON_CLASSES.has(p.class) && p.score >= MIN_CONF.weapon) weapons.push({ box: b, conf: p.score, label: p.class });
          else if (DEVICE_CLASSES.has(p.class) && p.score >= MIN_CONF.device) devices.push({ box: b, conf: p.score, label: p.class });
          else if (p.class === 'person' && p.score >= det.weak) candidates.push({ box: b, conf: p.score });
        }
        candidates.splice(0, candidates.length, ...dedupeBoxes(candidates));
        personBoxes = candidates.map((x) => x.box);
        // Body keypoints (MoveNet) for every person candidate: wrists, ankles, torso. Each is cut out of
        // the full-resolution picture and analysed on their own, so people far away get a pose too.
        // The pose also checks the candidate: a weak box counts only with a body in it (people in the
        // dark, half hidden), and a box over half the picture with no body is a false detection.
        const candKps = await posesForPeople(st.poses, st.media, candidates.map((x) => x.box), { max: 8 });
        const kps = [];
        candidates.forEach((cand, i) => {
          if (!acceptPerson(cand.conf, cand.box, candKps[i], { strong: det.strong, weak: det.weak, posesKnown: Boolean(st.poses) })) return;
          people.push(cand.box);
          kps.push(candKps[i]);
          if (a.has('objects')) draw.push({ kind: 'person', box: cand.box, conf: cand.conf, label: 'person' });
        });
        const bodies = people.map((box, i) => ({ box, kp: kps[i] }));
        st.lastBodies = bodies;
        for (const kp of kps) if (kp) draw.push({ kind: 'pose', kp });
        // A weapon at someone's hands is an armed person; one lying about with nobody holding it is less
        // urgent, and with nobody in view at all (a kitchen knife, scissors on a desk) not reported.
        for (const w of people.length ? weapons : []) {
          const armed = heldBy(w.box, bodies) >= 0;
          const kind = armed ? 'armed' : 'weapon';
          if (!found[kind] || w.conf > found[kind].conf) found[kind] = { conf: w.conf, label: armed ? `${w.label} in a person’s hand` : w.label, weapon: w.label, box: w.box };
          // With the GPU second look on, this is only a candidate until its close-up check: shown as such.
          draw.push(zsReady ? { kind: 'candidate', box: w.box, conf: w.conf, label: `${w.label} · checking` } : { kind: 'weapon', box: w.box, conf: w.conf, label: armed ? `${w.label} · armed` : w.label });
        }
        if (found.armed) delete found.weapon;
        // Phones / laptops in someone's hands: shown, and reported when a sensor alert asks who is there.
        const held = devices.filter((d) => heldBy(d.box, bodies) >= 0);
        for (const d of held) draw.push({ kind: 'device', box: d.box, conf: d.conf, label: d.label });
        st.lastHolder = held.length ? held.sort((x, y) => y.conf - x.conf)[0].label : null;
        // Tracks carry their keypoints, and stand where the ankles are when those are visible.
        const kpOf = new Map(people.map((b, i) => [b, kps[i]]));
        const tracks = st.tracker(people).map((t) => (t.ghost || !kpOf.get(t.box) ? t : { ...t, kp: kpOf.get(t.box), feet: feetOf(t.box, kpOf.get(t.box)) }));
        if (a.has('zones') && st.src.zones.length) zoneCheck(st, tracks, found);
        sightings(st, tracks);
        // Time-based rules on the tracks: sensitive area, door, fence, loitering, circling, running, falls.
        const zones = a.has('zones') ? st.src.zones.filter((z) => z.type && z.type !== 'watch') : [];
        if (zones.length || a.has('behaviour')) {
          events = st.behaviour({ t: Date.now(), people: tracks, zones, permitted: Boolean(permitOf(st.src)), behaviour: a.has('behaviour'), presence: st.src.role === 'tower' && a.has('behaviour') });
        }
      }
      // People for the fire / smoke clock: masked out of it, and next to flames = possible arson.
      st.personBoxes = personBoxes;
      st.peopleBoxes = people;
      c.drawImage(work, 0, 0);
      // Boxes from the second look stay on screen for 5 s (it looks again every few seconds).
      const zsDraw = (st.zsDraw ?? []).filter((d) => Date.now() - d.t < 5000);
      st.lastDraw = [...draw, ...(st.pxDraw ?? []), ...zsDraw];
      paint(c, st, st.lastDraw);
      for (const ev of events) report(st, ev, canvas);
      for (const kind of ['armed', 'weapon']) confirm(st, kind, found[kind], canvas, null, { verify: 'knife' });
      st.lastPeople = people.length;
      st.lastWeapon = (found.armed ?? found.weapon)?.weapon ?? null;
      while (st.verify.length) verifyAlert(st, st.verify.shift(), canvas);
      st.fps = 1000 / Math.max(300, performance.now() - t0);
      // One failed frame (a GPU hiccup) must not leave the camera out of the second look for good.
      if (st.status.startsWith('Analysis error')) st.status = 'Running';
    } catch (err) {
      st.status = `Analysis error: ${err.message}`;
    } finally {
      st.busy = false;
    }
  }

  /**
   * Fire and smoke by colour and motion on a small copy of the frame, ignoring what moves inside
   * people's boxes (tested on real video: red / orange clothes passed for flames, grey hoodies for
   * smoke). Runs every 0.3 s whatever the detector's pace; boxes are shown with the next painted frame.
   */
  function pixelStep(st) {
    const a = new Set(st.src.analyzers);
    if (!(a.has('fire') || a.has('smoke')) || !ready(st.media)) return;
    const canvas = box.querySelector(`canvas[data-cam="${st.src.id}"]`);
    if (!canvas) return;
    st.small ??= Object.assign(document.createElement('canvas'), { width: SMALL_W, height: SMALL_H });
    const sc = st.small.getContext('2d', { willReadFrequently: true });
    sc.drawImage(st.media, 0, 0, SMALL_W, SMALL_H);
    const px = st.pixels(sc.getImageData(0, 0, SMALL_W, SMALL_H), { fire: a.has('fire'), smoke: a.has('smoke'), mask: st.personBoxes ?? [] });
    const found = {};
    const draw = [];
    for (const k of ['fire', 'smoke']) {
      if (!px[k]) continue;
      found[k] = { conf: px[k].conf, label: k, box: px[k].box };
      draw.push({ kind: k, ...px[k] });
    }
    // Flames with someone right next to them (not on them): maybe someone starting a fire.
    if (found.fire && nearBox(px.fire.box, st.peopleBoxes ?? [])) {
      found.arson = { conf: found.fire.conf, label: 'flames next to a person (possible arson)', box: found.fire.box };
      delete found.fire;
    }
    st.pxDraw = draw;
    for (const kind of ['arson', 'fire']) confirm(st, kind, found[kind], canvas, null, { verify: 'fire' });
    confirm(st, 'smoke', found.smoke, canvas);
  }

  /** A behaviour event (already confirmed over time by the rules) goes to the server with the frame. */
  function report(st, ev, canvas) {
    post('vision/detections', {
      kind: ev.kind,
      sourceId: st.src.id,
      sourceName: st.testVideo ? `${st.src.name} (${st.fileName})` : st.src.name,
      label: ev.label,
      conf: 0,
      zone: ev.zone?.name ?? null,
      method: METHOD[ev.kind],
      testVideo: Boolean(st.testVideo),
      snapshot: canvas.toDataURL('image/jpeg', 0.72),
    })
      .then((r) => r.incident?.event === 'created' && notify(`${st.src.name}: ${ev.label}`, r.incident.sev === 'crit' ? 'bad' : 'warn'))
      .catch((err) => notify(err.message, 'bad'));
  }

  function verifyAlert(st, incidentId, canvas) {
    post('vision/verify', {
      incidentId,
      sourceId: st.src.id,
      sourceName: st.src.name,
      people: st.lastPeople ?? 0,
      weapon: st.lastWeapon,
      holder: st.lastHolder ?? null,
      snapshot: canvas.toDataURL('image/jpeg', 0.72),
    }).catch(() => {});
  }

  /**
   * Report only what was seen in CONFIRM of the last 5 frames, then at most every 10 s. `confirmed`:
   * already confirmed over time by the caller (the second look's own rule); `method` overrides.
   */
  function confirm(st, kind, hit, canvas, zone = null, { confirmed = false, method = null, key: keyName = null, verify = null } = {}) {
    const key = keyName ?? (zone ? `zone|${zone.id}` : kind);
    st.hits[key] = [...(st.hits[key] ?? []).slice(-4), Boolean(hit)];
    if (!hit || (!confirmed && st.hits[key].filter(Boolean).length < CONFIRM)) return;
    // The same weapon seen in someone's hand a moment ago is already an "armed person" incident: a
    // weapon / firearm report for it would only open a second incident for one event.
    const armedAt = Math.max(st.reported.armed ?? 0, st.reported['zs|armed'] ?? 0);
    if ((kind === 'weapon' || kind === 'firearm') && Date.now() - armedAt < 60_000) return;
    if (Date.now() - (st.reported[key] ?? 0) < 10_000) return;
    st.reported[key] = Date.now();
    // With the GPU second look running — or still loading — a fast weapon / fire finding waits for its
    // close-up check (the colour rule alone raised fire on a crowd video while OWLv2 was loading).
    // Confirmed close up in the last minute: the same finding continuing needs no second check.
    const recentlyConfirmed = Date.now() - (st.verifiedAt?.[kind] ?? 0) < 60_000;
    if (verify && (zsReady || zsLooping) && hit.box && ready(st.media) && !recentlyConfirmed) {
      const mw = st.media.videoWidth || st.media.naturalWidth;
      const mh = st.media.videoHeight || st.media.naturalHeight;
      const k = Math.min(1, 1920 / mw);
      const full = Object.assign(document.createElement('canvas'), { width: Math.round(mw * k), height: Math.round(mh * k) });
      full.getContext('2d').drawImage(st.media, 0, 0, full.width, full.height);
      st.verifyQueue = [...(st.verifyQueue ?? []).slice(-3), { kind, hit, verify, full, method: method ?? METHOD[kind] }];
      return;
    }
    send(st, kind, hit, canvas, zone, method);
  }

  function send(st, kind, hit, canvas, zone, method) {
    post('vision/detections', {
      kind: zone ? 'zone' : kind,
      sourceId: st.src.id,
      sourceName: st.testVideo ? `${st.src.name} (${st.fileName})` : st.src.name,
      label: hit.label,
      conf: hit.conf,
      zone: zone?.name ?? null,
      method: method ?? METHOD[zone ? 'zone' : kind],
      testVideo: Boolean(st.testVideo),
      snapshot: canvas.toDataURL('image/jpeg', 0.72),
    }).catch((err) => notify(err.message, 'bad'));
  }

  /** A queued fast finding, looked at again close up; reported only if it holds up. */
  async function verifyFinding(st, v, zs) {
    const canvas = box.querySelector(`canvas[data-cam="${st.src.id}"]`);
    if (!canvas) return;
    let ok;
    if (v.verify === 'fire') {
      const r = await zs.fire(v.full, zoomRect(v.hit.box, v.full.width, v.full.height));
      ok = fireConfirms(r, FIRE_LOW);
    } else {
      const r = await zs.zoom(v.full, zoomRect(v.hit.box, v.full.width, v.full.height), 'knife');
      ok = knifeConfirms(r, ZS_THRESHOLDS.knife.low);
    }
    st.verified = { ...(st.verified ?? {}), [ok ? 'kept' : 'dropped']: (st.verified?.[ok ? 'kept' : 'dropped'] ?? 0) + 1 };
    if (ok) {
      st.verifiedAt = { ...(st.verifiedAt ?? {}), [v.kind]: Date.now() };
      send(st, v.kind, v.hit, canvas, null, `${v.method} Confirmed on a close-up by OWLv2.`);
    } else st.reported[v.kind] = Date.now() + 20_000; // rejected: not queued again for 30 s
    st.verifyQueue = (st.verifyQueue ?? []).filter((q) => q.kind !== v.kind); // older copies of it are moot
  }

  /**
   * People search: a picture of each tracked person — once they have been in view for a second,
   * then every 30 s while they stay — cut from the full-resolution frame, 256 px tall. At most two
   * per frame; people under 80 px tall are too small to describe.
   */
  function sightings(st, tracks) {
    const t = Date.now();
    st.firstSeen ??= new Map();
    st.sighted ??= new Map();
    const SW = st.media.videoWidth || st.media.naturalWidth;
    const SH = st.media.videoHeight || st.media.naturalHeight;
    let sent = 0;
    for (const tr of tracks) {
      if (tr.ghost) continue;
      if (!st.firstSeen.has(tr.id)) st.firstSeen.set(tr.id, t);
      if (t - st.firstSeen.get(tr.id) < 1000 || t - (st.sighted.get(tr.id) ?? 0) < 30_000) continue;
      const [x, y, w, hh] = tr.box;
      if (hh * SH < 80) continue;
      const mx = w * 0.1;
      const my = hh * 0.05;
      const sx = (x - mx) * SW;
      const sy = (y - my) * SH;
      const sw = (w + 2 * mx) * SW;
      const sh = (hh + 2 * my) * SH;
      const c = Object.assign(document.createElement('canvas'), { width: Math.max(32, Math.round((256 * sw) / sh)), height: 256 });
      c.getContext('2d').drawImage(st.media, sx, sy, sw, sh, 0, 0, c.width, c.height);
      st.sighted.set(tr.id, t);
      post('vision/sightings', {
        sourceId: st.src.id,
        sourceName: st.testVideo ? `${st.src.name} (${st.fileName})` : st.src.name,
        track: `${st.runId}-${tr.id}`,
        testVideo: Boolean(st.testVideo),
        image: c.toDataURL('image/jpeg', 0.8),
      }).catch(() => {});
      if (++sent >= 2) break;
    }
    // Forget people long gone.
    for (const [id, at] of st.firstSeen) if (t - at > 600_000 && !tracks.some((tr) => tr.id === id)) (st.firstSeen.delete(id), st.sighted.delete(id));
  }

  // ---------------------------------------------------------------- second look (OWLv2)
  // One queue for all cameras: the GPU looks at one camera's latest analysed frame at a time (~4 s
  // each on an integrated GPU), round robin, while the fast detector keeps running on every camera.
  let zsLooping = false;
  let zsReady = false;
  async function zeroShotLoop() {
    if (zsLooping) return;
    zsLooping = true;
    try {
      const zs = await loadZeroShot();
      if (!zs) {
        // No second look on this computer: findings held while it was loading go out on their own evidence.
        for (const st of live.values()) {
          const canvas = box.querySelector(`canvas[data-cam="${st.src.id}"]`);
          for (const v of st.verifyQueue?.splice(0) ?? []) if (canvas) send(st, v.kind, v.hit, canvas, null, v.method);
        }
        return;
      }
      zsReady = true;
      let turn = 0;
      let lastWasCheck = false;
      while (live.size) {
        // Findings waiting for their close-up check alternate with the regular looks, so neither
        // starves the other (tested: four cameras, a fire re-queued every 10 s took every turn).
        const pending = !lastWasCheck && [...live.values()].find((s) => s.verifyQueue?.length);
        if (pending) {
          lastWasCheck = true;
          await verifyFinding(pending, pending.verifyQueue.shift(), zs);
          continue;
        }
        lastWasCheck = false;
        const cams = [...live.values()].filter((st) => st.status === 'Running' && st.work && st.src.analyzers.some((a) => a === 'objects' || a === 'smoke' || a === 'fire'));
        if (!cams.length) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        const st = cams[turn++ % cams.length];
        if (!ready(st.media)) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        // The current frame at full resolution (up to 1920 px, for the close-up crops) and at the
        // analysis size, with the people the fast detector found just now.
        const mw = st.media.videoWidth || st.media.naturalWidth;
        const mh = st.media.videoHeight || st.media.naturalHeight;
        const k = Math.min(1, 1920 / mw);
        const full = Object.assign(document.createElement('canvas'), { width: Math.round(mw * k), height: Math.round(mh * k) });
        full.getContext('2d').drawImage(st.media, 0, 0, full.width, full.height);
        const frame = Object.assign(document.createElement('canvas'), { width: W, height: H });
        frame.getContext('2d').drawImage(full, 0, 0, W, H);
        const bodies = st.lastBodies ?? [];
        const t0 = performance.now();
        const best = await zs.run(frame);
        st.zsMs = Math.round(performance.now() - t0);
        st.zsLooks = (st.zsLooks ?? 0) + 1;
        st.zsLast = Object.fromEntries(Object.entries(best).map(([k, v]) => [k, +(v?.score ?? 0).toFixed(2)]));
        if (live.get(st.src.id) === st) await zeroShotStep(st, best, bodies, zs, full);
        // OWLv2 holds the GPU while it looks (~3.4 s on Intel Iris Xe), and the people detector's frames
        // wait for it (measured: 0.25 s a frame alone, 3.5 s during a look). Between regular looks the GPU
        // is the detector's for three times the look's time (4–20 s); a finding waiting for its check
        // ends the pause early.
        const until = performance.now() + Math.min(20_000, Math.max(4_000, st.zsMs * 3));
        while (performance.now() < until && live.size && ![...live.values()].some((s) => s.verifyQueue?.length)) await new Promise((r) => setTimeout(r, 250));
      }
    } catch (err) {
      console.warn(`[zero-shot] stopped: ${err.message}`);
    } finally {
      zsLooping = false;
    }
  }

  async function zeroShotStep(st, best, bodies, zs, full) {
    const a = new Set(st.src.analyzers);
    const canvas = box.querySelector(`canvas[data-cam="${st.src.id}"]`);
    if (!canvas) return;
    st.zs ??= {};
    st.zsDraw = (st.zsDraw ?? []).filter((d) => Date.now() - d.t < 5000);

    // Smoking first: a cigarette at the mouth also reads as a thin blade (console test: 'knife' 0.43
    // on a smoker), so whether this person smokes is settled before the knife is judged. One person
    // per look (~4 s per OWLv2 call on an integrated GPU): the one with a faint knife at the face,
    // else a hand at the face, else every third look the largest.
    st.smokeTurn = (st.smokeTurn ?? 0) + 1;
    const knife = best.knife;
    const knifeAtFace = knife && knife.score >= ZS_THRESHOLDS.knife.low ? bodies.findIndex((b) => cigaretteNotKnife(knife.box, knife.score, b.box)) : -1;
    const cand = knifeAtFace >= 0 ? knifeAtFace : bodies.length ? smokingCandidate(bodies) : -1;
    if (a.has('objects') && cand >= 0 && (knifeAtFace >= 0 || handNearFace(bodies[cand].kp) || st.smokeTurn % 3 === 0 || st.src.slot === 'smoking')) {
      const s = await zs.smoking(full, upperBodyRect(bodies[cand].box, full.width, full.height));
      const score = smokingVerdict(s, SMOKING_THRESHOLDS) ? s.cig : 0;
      st.zs.smoking = [...(st.zs.smoking ?? []).slice(-2), score];
      if (score) {
        st.smokingAt = Date.now();
        st.smokerBox = bodies[cand].box;
        st.zsDraw.push({ t: Date.now(), kind: 'smoking', box: bodies[cand].box, conf: score, label: 'smoking' });
        if (zeroShotConfirmed(st.zs.smoking, SMOKING_THRESHOLDS)) confirm(st, 'smoking', { conf: score, label: 'person smoking' }, canvas, null, { confirmed: true, method: SMOKING_METHOD, key: 'zs|smoking' });
      }
    }

    // Fire on the whole picture: the colour-and-flicker rule (pixelStep) misses flames that are small,
    // pale or among people (tested: 1 of 4 fire videos; a campfire inside a circle of people was masked
    // out with them), while OWLv2 told 'fire' from sunsets, lamps and tail lights on labelled photos.
    if (a.has('fire') && best.fire) {
      const hit = best.fire;
      st.zs.fire = [...(st.zs.fire ?? []).slice(-2), hit.score >= ZS_THRESHOLDS.fire.low ? hit.score : 0];
      if (hit.score >= ZS_THRESHOLDS.fire.low) {
        const arson = nearBox(hit.box, st.peopleBoxes ?? []);
        st.zsDraw.push({ t: Date.now(), kind: 'fire', box: hit.box, conf: hit.score, label: 'fire' });
        if (zeroShotConfirmed(st.zs.fire, ZS_THRESHOLDS.fire)) {
          st.verifiedAt = { ...(st.verifiedAt ?? {}), fire: Date.now(), arson: Date.now() };
          const kind = arson ? 'arson' : 'fire';
          confirm(st, kind, { conf: hit.score, label: arson ? 'flames next to a person (possible arson)' : 'fire', box: hit.box }, canvas, null, { confirmed: true, method: OWL_FIRE_METHOD, key: `zs|${kind}` });
        }
      }
    }

    for (const target of ['gun', 'knife', 'smoke']) {
      if (target === 'smoke' ? !a.has('smoke') : !a.has('objects')) continue;
      const hit = best[target];
      const th = ZS_THRESHOLDS[target];
      let score = hit?.score ?? 0;
      // A knife with nobody in view is one lying about (a kitchen, a shop shelf): not reported. On 170
      // photos every real knife found had someone in view; the false ones (a drill on a shelf, a poker
      // in a fireplace video) had nobody.
      if (target === 'knife' && !bodies.length) score = 0;
      // Someone was just seen smoking: a 'knife' at their mouth is the cigarette unless very clear.
      if (target === 'knife' && hit && Date.now() - (st.smokingAt ?? 0) < 60_000 && cigaretteNotKnife(hit.box, score, st.smokerBox)) score = 0;
      // A weapon must still be one on a close-up crop of the full-resolution frame (a small black
      // camera passed for a handgun in the full view).
      if (target !== 'smoke' && score >= th.low) {
        const z = await zs.zoom(full, zoomRect(hit.box, full.width, full.height), target);
        if (!(target === 'knife' ? knifeConfirms(z, th.low) : zoomConfirms(z, th.low))) score = 0;
      }
      st.zs[target] = [...(st.zs[target] ?? []).slice(-2), score];
      if (!hit || score < th.low) continue;
      const held = target !== 'smoke' && heldBy(hit.box, bodies) >= 0;
      const name = target === 'gun' ? 'firearm' : target;
      st.zsDraw.push({ t: Date.now(), kind: target === 'smoke' ? 'smoke' : 'weapon', box: hit.box, conf: hit.score, label: held ? `${name} · armed` : name });
      if (!zeroShotConfirmed(st.zs[target], th)) continue;
      const kind = target === 'smoke' ? 'smoke' : held ? 'armed' : target === 'gun' ? 'firearm' : 'weapon';
      if (target !== 'smoke') st.lastWeapon = name;
      const label = target === 'smoke' ? 'smoke' : held ? `${name} in a person’s hand` : name;
      confirm(st, kind, { conf: hit.score, label }, canvas, null, { confirmed: true, method: OWL_METHOD, key: `zs|${kind}` });
    }
  }

  function zoneCheck(st, tracks, found) {
    const canvas = box.querySelector(`canvas[data-cam="${st.src.id}"]`);
    for (const zone of st.src.zones.filter((z) => zoneType(z) === 'watch' || z.type === 'restricted')) {
      let best = null;
      for (const t of tracks) {
        const key = `${zone.id}|${t.id}`;
        const isIn = !t.ghost && inPolygon(t.feet, zone.points);
        const cur = st.inside.get(key);
        if (isIn) {
          best ??= { conf: 0.8, label: `person ${t.id}` };
          if (!cur) {
            const rec = { since: Date.now(), rowId: null };
            st.inside.set(key, rec);
            post('vision/presence-event', { event: 'enter', sourceName: st.src.name, zone: zone.name, zoneId: zone.id, track: `${st.src.id}-${t.id}` })
              .then((r) => (rec.rowId = r.id))
              .catch(() => {});
          }
        }
      }
      // Leaving: tracks of this zone that are gone or outside now.
      for (const [key, rec] of st.inside) {
        if (!key.startsWith(`${zone.id}|`)) continue;
        const id = Number(key.split('|')[1]);
        const t = tracks.find((x) => x.id === id);
        if (!t || (!t.ghost && !inPolygon(t.feet, zone.points))) {
          st.inside.delete(key);
          if (rec.rowId) post('vision/presence-event', { event: 'exit', id: rec.rowId }).catch(() => {});
        }
      }
      if (zoneType(zone) === 'watch') confirm(st, 'zone', best, canvas, zone);
      if (best) found[`zone:${zone.id}`] = best;
    }
  }

  const COLOR = { candidate: '#94a3b8', weapon: '#ff3b3b', fire: '#fb923c', smoke: '#cbd5e1', person: '#38bdf8', device: '#a78bfa', smoking: '#f59e0b' };
  function paint(c, st, draw) {
    // Zones (and the one being drawn).
    c.save();
    c.setLineDash([6, 4]);
    c.lineWidth = 2;
    for (const z of st.src.zones) {
      const [stroke, fill, label] = ZONE_STYLE[zoneType(z)];
      c.strokeStyle = stroke;
      c.fillStyle = fill;
      c.beginPath();
      z.points.forEach(([x, y], k) => (k ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H)));
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = label;
      c.font = '600 13px ui-monospace, monospace';
      c.fillText(z.name, z.points[0][0] * W + 4, z.points[0][1] * H + 16);
    }
    c.restore();
    // Skeletons first, under the boxes and labels.
    c.save();
    // Yellow, so the skeleton stands out from the blue person box.
    c.strokeStyle = 'rgba(250,204,21,.95)';
    c.fillStyle = '#fff';
    c.lineWidth = 2;
    for (const { kp } of draw.filter((d) => d.kind === 'pose')) {
      for (const [a, b] of SKELETON) {
        if (!kp[a] || !kp[b]) continue;
        c.beginPath();
        c.moveTo(kp[a][0] * W, kp[a][1] * H);
        c.lineTo(kp[b][0] * W, kp[b][1] * H);
        c.stroke();
      }
      for (const [px, py] of Object.values(kp)) c.fillRect(px * W - 2, py * H - 2, 4, 4);
    }
    c.restore();
    for (const d of draw) {
      if (d.kind === 'pose') continue;
      const [x, y, w, hh] = d.box;
      c.strokeStyle = COLOR[d.kind];
      c.lineWidth = 2.5;
      c.strokeRect(x * W, y * H, w * W, hh * H);
      const txt = `${d.label ?? d.kind} ${d.conf.toFixed(2)}`;
      c.font = '600 13px ui-monospace, monospace';
      c.fillStyle = COLOR[d.kind];
      c.fillRect(x * W, Math.max(0, y * H - 18), c.measureText(txt).width + 10, 18);
      c.fillStyle = d.kind === 'smoke' ? '#0f172a' : '#fff';
      c.fillText(txt, x * W + 5, Math.max(13, y * H - 5));
    }
    const draft = drafts.get(st.src.id);
    if (draft?.length) {
      c.fillStyle = '#facc15';
      c.strokeStyle = '#facc15';
      c.beginPath();
      draft.forEach(([x, y], k) => (k ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H)));
      c.stroke();
      for (const [x, y] of draft) c.fillRect(x * W - 3, y * H - 3, 6, 6);
    }
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.fillRect(0, 0, W, 22);
    c.fillStyle = '#e2e8f0';
    c.font = '12px ui-monospace, monospace';
    const permit = hasSensitive(st.src) ? (permitOf(st.src) ? '  PERMIT ACTIVE' : '  NO PERMIT') : '';
    c.fillText(`${st.src.name}  ${new Date().toTimeString().slice(0, 8)}  ${st.testVideo ? 'TEST VIDEO' : 'LIVE'}  AI${st.detector ? ` · ${st.detector.name}` : ''}${permit}`, 8, 15);
  }

  // ---------------------------------------------------------------- zones on a real camera
  const drafts = new Map();
  async function finishZone(src) {
    const points = drafts.get(src.id) ?? [];
    if (points.length < 3) return notify('Click at least three corners on the picture.', 'warn');
    const r = await formDialog({
      title: `New zone · ${src.name}`,
      fields: [
        { name: 'name', label: 'Zone name', required: true, maxlength: 40, placeholder: 'e.g. Server room' },
        { name: 'type', label: 'Zone type', type: 'select', options: Object.entries(ZONE_TYPES), value: src.role === 'tower' ? 'fence' : src.role === 'sensitive' ? 'restricted' : 'watch', hint: 'Door: draw it around the door and its handle. Fence: draw it over the fence or wall, from its base to its top.' },
        { name: 'dwellMin', label: 'Sensitive area: alert after (minutes inside)', type: 'number', min: 1, max: 240, value: '5' },
      ],
      submitLabel: 'Save zone',
    });
    if (!r) return;
    drafts.delete(src.id);
    const zone = { id: `z${Date.now().toString(36)}`, name: r.name, type: r.type, dwellMin: Number(r.dwellMin) || 5, points };
    const add = (s) => (s.id === src.id ? { ...s, zones: [...s.zones, zone], analyzers: [...new Set([...s.analyzers, 'zones'])] } : s);
    if (src.local) {
      localSources = localSources.map(add);
      notify(`Zone “${r.name}” saved.`);
      render();
    } else await save(sources.map(add), `Zone “${r.name}” saved.`);
    const st = live.get(src.id);
    if (st) st.src = all().find((s) => s.id === src.id);
  }

  async function openLaptopCamera() {
    let src = localSources.find((x) => x.kind === 'webcam');
    if (!src) {
      src = { id: 'local-webcam', name: 'This computer’s camera', kind: 'webcam', local: true, role: 'general', analyzers: QUICK_ANALYZERS, zones: [], verifyDevices: true, sensors: [] };
      localSources = [src, ...localSources];
    }
    render();
    start(src);
  }

  const picker = h('input', { attrs: { type: 'file', accept: 'video/*', hidden: true } });
  picker.addEventListener('change', () => {
    const file = picker.files[0];
    picker.value = '';
    if (!file) return;
    const src = { id: `local-video-${Date.now().toString(36)}`, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Video', kind: 'file', local: true, role: 'general', analyzers: QUICK_ANALYZERS, zones: [], verifyDevices: true, sensors: [] };
    localSources = [...localSources, src];
    render();
    start(src, file);
  });

  // ---------------------------------------------------------------- page
  function renderTile(src) {
    const tile = box.querySelector(`[data-tile="${src.id}"]`);
    if (!tile) return;
    const st = live.get(src.id);
    const pill = tile.querySelector('.ai-status');
    pill.textContent = st ? (st.status === 'Running' ? `Running · ${st.fps.toFixed(1)} analyses/s` : st.status) : 'Stopped';
    pill.className = `pill ai-status ${st?.status === 'Running' ? 'st-confirmed' : st ? 'st-ack' : 'st-dismissed'}`;
  }

  function render() {
    tools.replaceChildren(
      button('Open laptop camera', { iconName: 'camera', cls: 'btn-primary', perm: 'incidents.handle', onClick: openLaptopCamera }),
      button('Upload video', { iconName: 'play', cls: 'btn-primary', perm: 'incidents.handle', onClick: () => picker.click() }),
      button('Add IP camera', { iconName: 'plus', perm: 'site.edit', onClick: () => editSource() }),
      picker,
    );
    if (!all().length) {
      box.replaceChildren(h('p', { class: 'sub', text: 'No camera open. Open the laptop camera or upload a video to start — or add an IP camera.' }));
      return;
    }
    box.replaceChildren(
      ...all().map((src) => {
        const canvas = h('canvas', { class: 'snap ai-canvas', attrs: { width: W, height: H, 'data-cam': src.id, 'aria-label': src.name, dir: 'ltr' } });
        const c = canvas.getContext('2d');
        c.fillStyle = '#05080f';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#9aabc2';
        c.font = '16px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText(src.kind === 'file' ? 'Choose a video file to start' : 'Press Start', W / 2, H / 2);
        c.textAlign = 'left';
        canvas.addEventListener('click', (e) => {
          const d = drafts.get(src.id);
          if (!d) return;
          const r = canvas.getBoundingClientRect();
          d.push([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
          renderControls();
        });
        const fileInput = h('input', { attrs: { type: 'file', accept: 'video/*', hidden: true } });
        fileInput.addEventListener('change', () => fileInput.files[0] && start(src, fileInput.files[0]));
        const controls = h('div', { class: 'zone-tools' });
        const renderControls = () => {
          const drawing = drafts.has(src.id);
          const running = live.has(src.id);
          controls.replaceChildren(
            ...(drawing
              ? [
                  h('span', { class: 'sub', text: `Click the corners on the picture (${drafts.get(src.id).length} so far)` }),
                  button('Finish', { iconName: 'check', cls: 'btn-sm btn-primary', onClick: () => finishZone(src) }),
                  button('Cancel', { cls: 'btn-sm', onClick: () => { drafts.delete(src.id); renderControls(); } }),
                ]
              : [
                  h('span', { class: 'sub', text: src.analyzers.map((a) => ANALYZER_LABEL[a]).join(' · ') || 'No analysis selected' }),
                  src.kind === 'file'
                    ? button(running ? 'Another video…' : 'Choose video…', { iconName: 'play', cls: 'btn-sm btn-primary', perm: 'incidents.handle', onClick: () => fileInput.click() })
                    : button(running ? 'Stop' : 'Start', { iconName: running ? 'close' : 'play', cls: `btn-sm ${running ? '' : 'btn-primary'}`, perm: 'incidents.handle', onClick: () => (running ? (stop(src.id), render()) : start(src)) }),
                  src.kind === 'file' && running ? button('Stop', { iconName: 'close', cls: 'btn-sm', onClick: () => { stop(src.id); render(); } }) : null,
                  button('Draw zone', { iconName: 'edit', cls: 'btn-sm', perm: src.local ? null : 'site.edit', onClick: () => { drafts.set(src.id, []); renderControls(); } }),
                  src.zones.length
                    ? button('Remove zones', {
                        cls: 'btn-sm',
                        perm: src.local ? null : 'site.edit',
                        onClick: () => {
                          const clear = (s) => (s.id === src.id ? { ...s, zones: [] } : s);
                          if (!src.local) return save(sources.map(clear), 'Zones removed.');
                          localSources = localSources.map(clear);
                          const st = live.get(src.id);
                          if (st) st.src = localSources.find((s) => s.id === src.id);
                          render();
                        },
                      })
                    : null,
                  src.local
                    ? button('Close', {
                        iconName: 'close',
                        cls: 'btn-sm',
                        onClick: () => {
                          stop(src.id);
                          localSources = localSources.filter((s) => s.id !== src.id);
                          render();
                        },
                      })
                    : button('', { iconName: 'settings', cls: 'btn-icon btn-sm', perm: 'site.edit', title: 'Edit', attrs: { 'aria-label': `Edit ${src.name}` }, onClick: () => editSource(src) }),
                  src.local ? null : button('', {
                    iconName: 'trash',
                    cls: 'btn-icon btn-sm btn-danger',
                    perm: 'site.edit',
                    title: 'Remove camera',
                    attrs: { 'aria-label': `Remove ${src.name}` },
                    onClick: async () => {
                      if (!(await confirmDialog({ title: `Remove ${src.name}?`, message: 'Its incidents and evidence stay.', confirmLabel: 'Remove', danger: true }))) return;
                      stop(src.id);
                      save(sources.filter((s) => s.id !== src.id), `${src.name} removed.`);
                    },
                  }),
                ].filter(Boolean)),
          );
        };
        renderControls();
        // This computer's camera and uploaded videos: the role is chosen right here.
        const roleSelect = src.local
          ? h(
              'select',
              {
                class: 'role-select',
                attrs: { 'aria-label': 'Camera role' },
                on: {
                  change: (e) => {
                    const role = e.target.value;
                    localSources = localSources.map((s) => (s.id === src.id ? { ...s, role, analyzers: withRole(QUICK_ANALYZERS, role) } : s));
                    const st = live.get(src.id);
                    if (st) st.src = localSources.find((s) => s.id === src.id);
                    render();
                  },
                },
              },
              Object.entries(CAMERA_ROLES).map(([k, v]) => h('option', { attrs: { value: k, selected: k === (src.role ?? 'general') ? '' : null }, text: v })),
            )
          : h('span', { class: 'sub', text: CAMERA_ROLES[src.role ?? 'general'] });
        const permit = permitOf(src);
        const permitBar = hasSensitive(src)
          ? h('div', { class: `permit-bar ${permit ? 'is-on' : 'is-off'}` }, [
              h('span', {
                text: permit
                  ? `Permit: ${permit.holder} until ${new Date(permit.until).toTimeString().slice(0, 5)} (by ${permit.by})`
                  : 'No permit — anyone inside the sensitive area is reported',
              }),
              permit
                ? button('Revoke', { cls: 'btn-sm', perm: 'incidents.assign', onClick: () => revokePermit(permit) })
                : button('Grant permit…', { iconName: 'key', cls: 'btn-sm', perm: 'incidents.assign', onClick: () => grantPermit(src) }),
            ])
          : null;
        return h('div', { class: 'tile', data: { tile: src.id } }, [
          h('div', { class: 'th' }, [h('b', { text: src.name }), h('span', { class: 'pill ai-status st-dismissed', text: 'Stopped' })]),
          canvas,
          fileInput,
          h('div', { class: 'role-row' }, [roleSelect, src.verifyDevices ? h('span', { class: 'sub', text: 'Checks sensor device alerts' }) : null]),
          permitBar,
          controls,
        ].filter(Boolean));
      }),
    );
    for (const src of all()) renderTile(src);
  }

  setInterval(() => {
    for (const src of all()) if (live.has(src.id)) renderTile(src);
  }, 1000);

  const api = {
    show() {
      if (session.user) load();
    },
    /** Running cameras for other pages (Smart detection): last analysed frame and what was drawn on it. */
    cameras: () =>
      [...live.values()].map((st) => ({
        id: st.src.id,
        name: st.src.name,
        role: st.src.role ?? 'general',
        zones: st.src.zones.map((z) => z.name),
        status: st.status,
        testVideo: Boolean(st.testVideo),
        work: st.work ?? null,
        draw: st.lastDraw ?? [],
        people: st.lastPeople ?? 0,
        detector: st.detector?.name ?? null,
        media: st.media ?? null,
        slot: st.src.slot ?? null,
        fileName: st.fileName ?? null,
        reportName: st.testVideo ? `${st.src.name} (${st.fileName})` : st.src.name,
        video: st.media ? { readyState: st.media.readyState ?? null, paused: st.media.paused ?? null, error: st.media.error?.code ?? null, width: st.media.videoWidth || st.media.naturalWidth || 0 } : null,
        secondLook: { looks: st.zsLooks ?? 0, ms: st.zsMs ?? null, last: st.zsLast ?? null, verified: st.verified ?? null },
      })),
    openLaptopCamera: () => openLaptopCamera(),
    uploadVideo: () => picker.click(),
    /**
     * Analyse a video file as its own camera (Smart detection test slots). Replaces the slot's
     * previous video. role: 'general' (people, weapons, smoking, fire, smoke) or 'tower' (+ behaviour).
     */
    analyseFile(file, { name, slot, role = 'general' }) {
      for (const s of localSources.filter((x) => x.slot === slot)) stop(s.id);
      localSources = localSources.filter((x) => x.slot !== slot);
      const src = { id: `slot-${slot}-${Date.now().toString(36)}`, name, slot, kind: 'file', local: true, role, analyzers: withRole(QUICK_ANALYZERS, role), zones: [], verifyDevices: false, sensors: [] };
      localSources = [...localSources, src];
      render();
      start(src, file);
      return src.id;
    },
    /** Stop a local camera (laptop camera, uploaded or slot video) and remove it. */
    close(id) {
      stop(id);
      localSources = localSources.filter((s) => s.id !== id);
      render();
    },
  };
  instance = api;
  // Tools and (empty) tiles at once: Smart detection can open a camera before this page is visited.
  render();
  return api;
}

let instance = null;
/** The AI cameras of this console (created by the Drone & cameras page), or null before that. */
export const aiCameras = () => instance;
