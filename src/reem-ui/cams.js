// AI cameras for the main interface: the platform's camera analysis without its page — people and
// objects (D-FINE-L / RT-DETRv2 / COCO-SSD), body keypoints (MoveNet), the OWLv2 second look
// (firearms, knives, smoke, smoking, close-up checks), fire and smoke by colour, zones, behaviour,
// permits, and pictures of tracked people for the people search. The page draws the tiles and the
// dialogs and calls these functions.
import { get, post } from '../shell/api.js';
import { thermalPalette, thermalize } from '../shared/thermal.js';
import { SKELETON, WEAPON_CLASSES, createPixelAnalyzer, createTracker, loadDetector, loadPoseModel, loadZeroShot, posesForPeople } from '../shell/detectors.js';
import { CAMERA_ROLES, FIRE_LOW, ROLE_ANALYZERS, SMOKING_THRESHOLDS, fireConfirms, ZONE_TYPES, ZS_THRESHOLDS, acceptPerson, dedupeBoxes, handNearFace, smokingCandidate, smokingVerdict, upperBodyRect, cigaretteNotKnife, knifeConfirms, zeroShotConfirmed, zoomConfirms, zoomRect, createBehaviour, feetOf, heldBy, inPolygon, iou, mergeNested, nearBox, sameObject, steadyCount } from '../shared/cameraRules.js';

let notify = () => {};
let render = () => {};
// Thermal-style view (a colour rendering of the ordinary picture with the detected people and fire
// warm — not a temperature measurement). Remembered in this browser.
let thermal = true;
try {
  thermal = localStorage.getItem('sawn.cams.thermal') !== '0';
} catch {
  // storage blocked: thermal on
}
const LUT = thermalPalette();
// Softer than a full thermal palette: about half the real picture shows through, dark rooms are lifted.
const THERMAL_SOFT = Object.freeze({ mix: 0.5, lift: 0.6 });
const scratch = typeof document === 'undefined' ? null : Object.assign(document.createElement('canvas'), { width: 640, height: 360 });
const canvases = new Map();
function canvasOf(id) {
  let c = canvases.get(id);
  if (!c) {
    c = document.createElement('canvas');
    c.width = 640;
    c.height = 360;
    c.className = 'camc';
    c.dataset.cam = id;
    c.dir = 'ltr'; // the page is right-to-left; canvas labels are drawn left to right
    const x = c.getContext('2d');
    x.fillStyle = '#16181D';
    x.fillRect(0, 0, 640, 360);
    canvases.set(id, c);
  }
  return c;
}

const ANALYZER_LABEL = {
  people: 'People (count and position)',
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
// Weapons and devices; person thresholds come with the detector (loadDetector).
const MIN_CONF = { weapon: 0.5, device: 0.45 };
// Per-camera settings (src.sensitivity, src.speed). 'normal' is the tested default: CONFIRM 3 of the
// last 5 frames, the thresholds as tuned in cameraRules.js. 'high' reports sooner and on fainter
// signs (more false alarms); 'low' wants clearer, longer evidence (fewer false alarms, may miss some).
const SENSITIVITY = {
  low: { confirm: 4, weapon: 0.6, zs: 1.15 },
  normal: { confirm: 3, weapon: MIN_CONF.weapon, zs: 1 },
  high: { confirm: 2, weapon: 0.4, zs: 0.88 },
};
// Milliseconds between analysed frames for one camera (more cameras share the GPU: see analyse).
const SPEED = { eco: 650, normal: 300, fast: 160 };
const sensOf = (st) => SENSITIVITY[st.src.sensitivity] ?? SENSITIVITY.normal;
const scaled = (th, k) => (k === 1 ? th : { ...th, low: +(th.low * k).toFixed(3), high: +(th.high * k).toFixed(3) });
// The name a camera reports under: an uploaded video on a numbered camera keeps the camera's name.
const nameOf = (st) => (st.testVideo && !st.src.slot ? `${st.src.name} (${st.fileName})` : st.src.name);
// What someone may be carrying when a sensor hears an unauthorized device.
const DEVICE_CLASSES = new Set(['cell phone', 'laptop']);
// Objects whose pictures Nashdan keeps (COCO classes the detector knows).
const THING_CLASSES = new Set(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'backpack', 'handbag', 'suitcase', 'umbrella', 'bottle', 'chair', 'couch', 'bench', 'dining table', 'laptop', 'cell phone', 'tv', 'keyboard', 'knife', 'scissors', 'fire hydrant', 'stop sign']);

let holder = null;
const mediaHolder = () => {
  if (!holder?.isConnected) {
    holder = Object.assign(document.createElement('div'), { ariaHidden: 'true' });
    holder.style.cssText = 'position:fixed;left:0;bottom:0;width:4px;height:4px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(holder);
  }
  return holder;
};

export function createCams() {
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

  async function grantPermit(src, r) {
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
  const deviceAlert = ({ incident, event } = {}) => {
    if (event !== 'created' || !incident || !DEVICE_ALERTS.has(incident.key)) return;
    for (const st of live.values()) {
      const src = st.src;
      if (!src.verifyDevices || st.status !== 'Running') continue;
      if (src.sensors?.length && !src.sensors.some((id) => String(incident.dev ?? '').includes(id))) continue;
      st.verify.push(incident.id);
    }
  };

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

  async function editSource(src, r) {
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
      } else if (src.kind === 'file' && src.videoUrl) {
        // A recording kept on the server (operations console): played and analysed like a camera. It is
        // downloaded whole first: a streaming video keeps a connection open, and with the browser's six
        // per server, the fifth or sixth recording on the wall never got one (tested).
        st.status = 'Loading the recording…';
        render();
        const res = await fetch(src.videoUrl, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Recording unavailable (HTTP ${res.status})`);
        st.url = URL.createObjectURL(await res.blob());
        if (live.get(src.id) !== st) return URL.revokeObjectURL(st.url); // replaced meanwhile
        st.media = Object.assign(document.createElement('video'), { src: st.url, muted: true, loop: true, playsInline: true, preload: 'auto' });
        // In the page (tiny, invisible): a video outside it may be left without a decoder when several
        // play at once (tested: one or two of five stayed on their first frame).
        mediaHolder().appendChild(st.media);
        st.testVideo = true;
        st.fileName = src.fileName ?? src.name;
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
      // Until the first analysed frame: the camera picture as it is, with the status on it.
      st.preview = setInterval(() => preview(st), 200);
      // A video that stops advancing while it should play (the browser ran out of video decoders with
      // several on screen — tested: one in six stayed on its first frame) is nudged, then reloaded.
      if (st.media instanceof HTMLVideoElement && !st.media.srcObject) {
        let last = -1;
        let stuck = 0;
        st.stall = setInterval(() => {
          const m = st.media;
          if (m.paused || m.ended) return (stuck = 0);
          stuck = m.currentTime === last ? stuck + 1 : 0;
          last = m.currentTime;
          if (stuck === 3) {
            m.currentTime += 0.05;
            m.play().catch(() => {});
          } else if (stuck >= 10) {
            stuck = -10; // the reloaded video gets time to start
            const t = m.currentTime;
            m.load();
            m.currentTime = t;
            m.play().catch(() => {});
          }
        }, 2000);
      }
      if (src.analyzers.some((a) => a === 'objects' || a === 'people' || a === 'zones' || a === 'behaviour')) {
        st.status = 'Loading AI model…';
        render();
        // second look (firearms, knives, smoke) when this computer has a GPU — not for a people-only camera
        if (src.analyzers.some((a) => a === 'objects' || a === 'fire' || a === 'smoke')) zeroShotLoop();
        // The object detector (ONNX) and the pose model (TensorFlow.js) are separate runtimes: loaded
        // side by side, a camera starts in the time of the slower one instead of both in turn.
        [st.detector, st.poses] = await Promise.all([loadDetector(), loadPoseModel().catch(() => null)]);
      }
      st.status = 'Running';
      st.timer = setInterval(() => analyse(st), 80); // analyse() keeps its own pace (src.speed)
      smooth(st);
      if (src.slot) clipWatch(st);
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
    clearInterval(st.preview);
    clearInterval(st.stall);
    clearInterval(st.reload);
    cancelAnimationFrame(st.raf);
    clipUnwatch(id);
    st.media?.srcObject?.getTracks().forEach((t) => t.stop());
    if (st.media && 'pause' in st.media) st.media.pause();
    if (st.url) URL.revokeObjectURL(st.url);
    st.media?.remove?.();
    for (const [, v] of st.inside) if (v.rowId) post('vision/presence-event', { event: 'exit', id: v.rowId }).catch(() => {});
    live.delete(id);
  }

  const ready = (m) => (m instanceof HTMLVideoElement ? m.readyState >= 2 && m.videoWidth > 0 : m?.complete && m.naturalWidth > 0);

  /**
   * The frame the detector sees: in a really dark room, a brightened copy (people in the dark are
   * missed). Brightness is measured on a 32 × 18 copy every 10 frames.
   */
  function forDetector(st, work) {
    st.lumTick = (st.lumTick ?? 0) + 1;
    if (st.lum == null || st.lumTick % 10 === 0) {
      st.lumC ??= Object.assign(document.createElement('canvas'), { width: 32, height: 18 });
      const g = st.lumC.getContext('2d', { willReadFrequently: true });
      g.drawImage(work, 0, 0, 32, 18);
      const d = g.getImageData(0, 0, 32, 18).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      st.lum = sum / (d.length / 4) / 255;
    }
    if (st.lum >= 0.22) return work;
    st.detC ??= Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = st.detC.getContext('2d');
    g.filter = `brightness(${Math.min(2, 0.35 / Math.max(0.05, st.lum)).toFixed(2)}) contrast(1.1)`;
    g.drawImage(work, 0, 0);
    g.filter = 'none';
    return st.detC;
  }

  async function analyse(st) {
    const canvas = canvasOf(st.src.id);
    if (!canvas || st.busy || !ready(st.media)) return;
    // One GPU for every camera and the second look: with more cameras each analyses less often
    // (3 a second alone, about 1 a second each with four), leaving the second look room to run.
    const gap = (SPEED[st.src.speed] ?? SPEED.normal) * Math.max(1, live.size * 0.85);
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
      if (a.has('objects') || a.has('people') || a.has('zones') || a.has('behaviour')) {
        const det = st.detector;
        const preds = await det.detect(forDetector(st, work));
        const weapons = [];
        const devices = [];
        const candidates = [];
        for (const p of preds) {
          const b = [p.bbox[0] / W, p.bbox[1] / H, p.bbox[2] / W, p.bbox[3] / H];
          if (a.has('objects') && WEAPON_CLASSES.has(p.class) && p.score >= sensOf(st).weapon) weapons.push({ box: b, conf: p.score, label: p.class });
          else if (DEVICE_CLASSES.has(p.class) && p.score >= MIN_CONF.device) devices.push({ box: b, conf: p.score, label: p.class });
          else if (p.class === 'person' && p.score >= det.weak) candidates.push({ box: b, conf: p.score });
        }
        candidates.splice(0, candidates.length, ...mergeNested(dedupeBoxes(candidates)));
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
          if (a.has('objects') || a.has('people') || a.has('behaviour')) draw.push({ kind: 'person', box: cand.box, conf: cand.conf, label: 'person' });
        });
        const bodies = people.map((box, i) => ({ box, kp: kps[i] }));
        st.lastPeople = steadyCount((st.countHist ??= []), people.length);
        st.lastBodies = bodies;
        for (const kp of kps) if (kp) draw.push({ kind: 'pose', kp });
        // A weapon at someone's hands is an armed person; one lying about with nobody holding it is less
        // urgent, and with nobody in view at all (a kitchen knife, scissors on a desk) not reported.
        for (const w of people.length || st.src.anyWeapon ? weapons : []) {
          const armed = heldBy(w.box, bodies) >= 0;
          const kind = armed ? 'armed' : 'weapon';
          if (!found[kind] || w.conf > found[kind].conf) found[kind] = { conf: w.conf, label: armed ? `${w.label} in a person’s hand` : w.label, weapon: w.label, box: w.box };
          // With the GPU second look on, this is only a candidate until its close-up check: shown as such.
          draw.push(zsReady ? { kind: 'candidate', box: w.box, conf: w.conf, label: `${w.label} · checking` } : { kind: 'weapon', box: w.box, conf: w.conf, label: armed ? `${w.label} · armed` : w.label });
        }
        if (found.armed) delete found.weapon;
        // Phones / laptops in someone's hands: shown, and reported when a sensor alert asks who is there.
        // A "phone" where the second look just found a weapon is that weapon (the detector knows no gun
        // and calls a handgun a cell phone): drawn as the weapon, following it between second looks.
        // Each "phone" in a hand is checked close up by OWLv2 at once (gun or phone?), ahead of its
        // regular round; while it waits it is shown as being checked. A weapon is followed while the
        // detector keeps seeing it there; a real phone is not checked again for 30 s.
        const zw = st.zsWeapon && Date.now() - st.zsWeapon.t < 15_000 ? st.zsWeapon : null;
        const okPhone = st.phoneOk && Date.now() - st.phoneOk.t < 30_000 ? st.phoneOk : null;
        const held = [];
        for (const d of devices.filter((x) => heldBy(x.box, bodies) >= 0)) {
          if (zw && sameObject(d.box, zw.box)) {
            zw.box = d.box;
            zw.t = Date.now();
            draw.push({ kind: 'weapon', box: d.box, conf: zw.conf, label: `${zw.name} · armed` });
          } else if (zsReady && a.has('objects') && d.label === 'cell phone' && !(okPhone && sameObject(d.box, okPhone.box))) {
            if (!st.phoneCheck) st.phoneCheck = { box: d.box, full: fullFrame(st.media) };
            draw.push({ kind: 'candidate', box: d.box, conf: d.conf, label: 'phone? · checking' });
          } else held.push(d);
        }
        for (const d of held) draw.push({ kind: 'device', box: d.box, conf: d.conf, label: d.label });
        st.lastHolder = held.length ? held.sort((x, y) => y.conf - x.conf)[0].label : null;
        // Tracks carry their keypoints, and stand where the ankles are when those are visible.
        const kpOf = new Map(people.map((b, i) => [b, kps[i]]));
        const tracks = st.tracker(people).map((t) => (t.ghost || !kpOf.get(t.box) ? t : { ...t, kp: kpOf.get(t.box), feet: feetOf(t.box, kpOf.get(t.box)) }));
        // How long each tracked person has been in view; on a perimeter (tower) camera it is on their box.
        st.seenSince ??= new Map();
        const tNow = Date.now();
        for (const t of tracks) if (!st.seenSince.has(t.id)) st.seenSince.set(t.id, tNow);
        const ids = new Set(tracks.map((t) => t.id));
        for (const id of [...st.seenSince.keys()]) if (!ids.has(id)) st.seenSince.delete(id);
        st.dwell = tracks.filter((t) => !t.ghost).map((t) => ({ id: t.id, sec: Math.round((tNow - st.seenSince.get(t.id)) / 1000), box: t.box }));
        if (st.src.role === 'tower') {
          for (const d of st.dwell) {
            const item = draw.find((x) => x.kind === 'person' && iou(x.box, d.box) > 0.5);
            if (item) item.label = `#${d.id} · ${Math.floor(d.sec / 60)}:${String(d.sec % 60).padStart(2, '0')}`;
          }
        }
        if (a.has('zones') && st.src.zones.length) zoneCheck(st, tracks, found);
        sightings(st, tracks);
        objectSightings(st, preds);
        // Time-based rules on the tracks: sensitive area, door, fence, loitering, circling, running, falls.
        const zones = a.has('zones') ? st.src.zones.filter((z) => z.type && z.type !== 'watch') : [];
        if (zones.length || a.has('behaviour')) {
          events = st.behaviour({ t: Date.now(), people: tracks, zones, permitted: Boolean(permitOf(st.src)), behaviour: a.has('behaviour'), presence: st.src.role === 'tower' && a.has('behaviour') });
        }
      }
      sceneSighting(st, work);
      // People for the fire / smoke clock: masked out of it, and next to flames = possible arson.
      st.personBoxes = personBoxes;
      st.peopleBoxes = people;
      clearInterval(st.preview);
      st.painted = true;
      // Thermal: people and fire warm, everything else a cool background.
      if ((st.src.thermal ?? thermal) && scratch) {
        const sc = scratch.getContext('2d', { willReadFrequently: true });
        sc.drawImage(work, 0, 0);
        const img = sc.getImageData(0, 0, W, H);
        const fire = [...draw, ...(st.pxDraw ?? [])].filter((d) => (d.kind === 'fire' || d.kind === 'arson') && d.box).map((d) => d.box);
        thermalize(img.data, W, H, { warm: people, hot: fire, lut: LUT, ...THERMAL_SOFT });
        c.putImageData(img, 0, 0);
      } else c.drawImage(work, 0, 0);
      // Boxes from the second look stay on screen for 5 s (it looks again every few seconds).
      const zsDraw = (st.zsDraw ?? []).filter((d) => Date.now() - d.t < 5000 && !(d.kind === 'weapon' && draw.some((x) => x.kind === 'weapon' && sameObject(x.box, d.box))));
      st.lastDraw = [...draw, ...(st.pxDraw ?? []), ...zsDraw];
      paint(c, st, st.lastDraw);
      for (const ev of events) report(st, ev, canvas);
      for (const kind of ['armed', 'weapon']) confirm(st, kind, found[kind], canvas, null, { verify: 'knife' });
      st.lastWeapon = (found.armed ?? found.weapon)?.weapon ?? null;
      while (st.verify.length) verifyAlert(st, st.verify.shift(), canvas);
      st.fps = 1000 / Math.max(SPEED[st.src.speed] ?? SPEED.normal, performance.now() - t0);
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
    const canvas = canvasOf(st.src.id);
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

  /**
   * The evidence frame: the painted picture with its boxes, or — before the first analysed frame, when
   * the canvas still shows "Starting the analysis…" — the camera picture itself.
   */
  function snapshotOf(st, canvas) {
    if (st.painted || !ready(st.media)) return canvas.toDataURL('image/jpeg', 0.72);
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
    c.getContext('2d').drawImage(st.media, 0, 0, W, H);
    return c.toDataURL('image/jpeg', 0.72);
  }

  /** Camera number, location and (recorded video) the second it was seen at, for the incident. */
  const where = (st) => ({
    cameraNo: st.src.cameraNo ?? null,
    location: st.src.location ?? null,
    recordingId: st.src.recordingId ?? null,
    videoTime: st.testVideo && st.media && 'currentTime' in st.media ? st.media.currentTime : null,
  });
  /** Tells the page an incident was raised or updated by this camera (it saves a video clip). */
  const announce = (st, kind, label, r) => {
    // A recorded camera still seeing it after 3 minutes: the server raised the incident again.
    if (r?.incident?.event === 'realert') notify(`${nameOf(st)}: تذكير — ما زال ظاهراً: ${label}`, r.incident.sev === 'crit' ? 'bad' : 'warn');
    if (r?.incident?.ref && r.incident.event !== 'unchanged') clipCapture(st.src.id, r.incident.ref, where(st).videoTime);
    if (r?.incident) window.dispatchEvent(new CustomEvent('sawn-detection', { detail: { sourceId: st.src.id, kind, label, incident: r.incident, videoTime: where(st).videoTime } }));
    return r;
  };

  /** A behaviour event (already confirmed over time by the rules) goes to the server with the frame. */
  function report(st, ev, canvas) {
    post('vision/detections', {
      kind: ev.kind,
      sourceId: st.src.id,
      sourceName: nameOf(st),
      label: ev.label,
      conf: 0,
      zone: ev.zone?.name ?? null,
      method: METHOD[ev.kind],
      testVideo: Boolean(st.testVideo),
      ...where(st),
      snapshot: snapshotOf(st, canvas),
    })
      .then((r) => announce(st, ev.kind, ev.label, r))
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
      snapshot: snapshotOf(st, canvas),
    }).catch(() => {});
  }

  /**
   * Report only what was seen in CONFIRM of the last 5 frames, then at most every 10 s. `confirmed`:
   * already confirmed over time by the caller (the second look's own rule); `method` overrides.
   */
  function confirm(st, kind, hit, canvas, zone = null, { confirmed = false, method = null, key: keyName = null, verify = null } = {}) {
    const key = keyName ?? (zone ? `zone|${zone.id}` : kind);
    st.hits[key] = [...(st.hits[key] ?? []).slice(-4), Boolean(hit)];
    if (!hit || (!confirmed && st.hits[key].filter(Boolean).length < sensOf(st).confirm)) return;
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
      sourceName: nameOf(st),
      label: hit.label,
      conf: hit.conf,
      zone: zone?.name ?? null,
      method: method ?? METHOD[zone ? 'zone' : kind],
      testVideo: Boolean(st.testVideo),
      ...where(st),
      snapshot: snapshotOf(st, canvas),
    })
      .then((r) => announce(st, zone ? 'zone' : kind, hit.label, r))
      .catch((err) => notify(err.message, 'bad'));
  }

  /** A queued fast finding, looked at again close up; reported only if it holds up. */
  // ---------------------------------------------------------------- evidence clips
  // Each numbered camera's picture (boxes and thermal view included) is recorded in back-to-back
  // segments of 8 s. When the camera raises an incident, the segment holding that moment (the seconds
  // before it) and the next one are saved to the incident. Nothing else is kept.
  const SEGMENT_MS = 8000;
  const recs = new Map();
  const clipSent = new Map();
  const clipMime = () => (typeof MediaRecorder === 'undefined' ? null : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm');
  function clipSend(rec, blob, want, seconds) {
    const q = new URLSearchParams({ seconds: String(Math.round(seconds)), camera: rec.camera });
    if (rec.no) q.set('no', String(rec.no));
    if (want.vt != null) q.set('vt', String(want.vt));
    fetch(`/sawn-demo/api/incidents/${encodeURIComponent(want.ref)}/clips?${q}`, { method: 'POST', body: blob, headers: { 'Content-Type': 'video/webm' }, credentials: 'same-origin' }).catch(() => {});
  }
  function clipSegment(id) {
    const rec = recs.get(id);
    if (!rec || rec.stopped) return;
    const chunks = [];
    let r;
    try {
      r = new MediaRecorder(rec.stream, { mimeType: clipMime(), videoBitsPerSecond: 900_000 });
    } catch {
      return; // no recorder in this browser: the incident keeps its frames
    }
    const started = Date.now();
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      rec.last = blob;
      for (const w of rec.wants) {
        if (w.left > 0) {
          clipSend(rec, blob, w, (Date.now() - started) / 1000);
          w.left -= 1;
        }
      }
      rec.wants = rec.wants.filter((w) => w.left > 0);
      if (!rec.stopped) clipSegment(id);
    };
    rec.recorder = r;
    rec.started = started;
    r.start(1000);
    rec.timer = setTimeout(() => r.state !== 'inactive' && r.stop(), SEGMENT_MS);
  }
  function clipWatch(st) {
    const canvas = canvasOf(st.src.id);
    if (recs.has(st.src.id) || !canvas?.captureStream || !clipMime()) return;
    recs.set(st.src.id, { stream: canvas.captureStream(12), recorder: null, last: null, started: 0, wants: [], camera: nameOf(st), no: st.src.cameraNo ?? null, timer: null, stopped: false });
    clipSegment(st.src.id);
  }
  function clipUnwatch(id) {
    const rec = recs.get(id);
    if (!rec) return;
    rec.stopped = true;
    clearTimeout(rec.timer);
    if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
    rec.stream.getTracks().forEach((t) => t.stop());
    recs.delete(id);
  }
  /** The moment as evidence of an incident: this segment and the next, at most once a minute per incident. */
  function clipCapture(id, ref, vt) {
    const rec = recs.get(id);
    if (!rec || Date.now() - (clipSent.get(ref) ?? 0) < 60_000) return;
    clipSent.set(ref, Date.now());
    if (rec.last && Date.now() - rec.started < 2000) clipSend(rec, rec.last, { ref, vt }, SEGMENT_MS / 1000);
    rec.wants.push({ ref, left: 2, vt });
  }

  /** The current picture at full resolution (up to 1920 px wide), for close-up crops. */
  function fullFrame(media) {
    const mw = media.videoWidth || media.naturalWidth;
    const mh = media.videoHeight || media.naturalHeight;
    const k = Math.min(1, 1920 / mw);
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(mw * k), height: Math.round(mh * k) });
    c.getContext('2d').drawImage(media, 0, 0, c.width, c.height);
    return c;
  }

  /**
   * A "cell phone" in someone's hand, looked at close up by OWLv2: the COCO detectors know no gun and
   * call a handgun a phone (shooting-range video: 0.64). A gun there → an armed person, followed by the
   * detector's box; a phone → left alone for 30 s.
   */
  async function checkPhone(st, zs) {
    const { box, full } = st.phoneCheck;
    try {
      const th = scaled(ZS_THRESHOLDS.gun, sensOf(st).zs);
      const z = await zs.zoom(full, zoomRect(box, full.width, full.height), 'gun');
      if (live.get(st.src.id) !== st) return;
      if (zoomConfirms(z, th.low)) {
        st.zsWeapon = { t: Date.now(), box, conf: z.weapon, name: 'firearm' };
        st.lastWeapon = 'firearm';
        const canvas = canvasOf(st.src.id);
        if (canvas) confirm(st, 'armed', { conf: z.weapon, label: 'firearm in a person’s hand' }, canvas, null, { confirmed: true, method: `${OWL_METHOD} (the detector saw a phone; OWLv2 on the close-up: gun ${z.weapon.toFixed(2)})`, key: 'zs|armed' });
      } else st.phoneOk = { t: Date.now(), box };
    } finally {
      st.phoneCheck = null;
    }
  }

  async function verifyFinding(st, v, zs) {
    const canvas = canvasOf(st.src.id);
    if (!canvas) return;
    let ok;
    if (v.verify === 'fire') {
      const r = await zs.fire(v.full, zoomRect(v.hit.box, v.full.width, v.full.height));
      ok = fireConfirms(r, FIRE_LOW * sensOf(st).zs);
    } else {
      const r = await zs.zoom(v.full, zoomRect(v.hit.box, v.full.width, v.full.height), 'knife');
      ok = knifeConfirms(r, ZS_THRESHOLDS.knife.low * sensOf(st).zs);
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
        sourceName: nameOf(st),
        track: `${st.runId}-${tr.id}`,
        testVideo: Boolean(st.testVideo),
        image: c.toDataURL('image/jpeg', 0.8),
      }).catch(() => {});
      if (++sent >= 2) break;
    }
    // Forget people long gone.
    for (const [id, at] of st.firstSeen) if (t - at > 600_000 && !tracks.some((tr) => tr.id === id)) (st.firstSeen.delete(id), st.sighted.delete(id));
  }

  /**
   * Nashdan (things): a close picture of each object the detector finds — vehicles, bags, laptops,
   * chairs… — once per kind and place in the picture every 2 minutes, at most one every 4 s per
   * camera; objects under 24 px are too small to describe.
   */
  function objectSightings(st, preds) {
    const t = Date.now();
    if (t - (st.objAt ?? 0) < 4000 || !ready(st.media)) return;
    st.objSeen ??= new Map();
    const SW = st.media.videoWidth || st.media.naturalWidth;
    const SH = st.media.videoHeight || st.media.naturalHeight;
    const best = preds
      .filter((p) => THING_CLASSES.has(p.class) && p.score >= 0.45 && p.bbox[2] >= 24 && p.bbox[3] >= 24)
      .map((p) => ({ p, cell: `${p.class}|${Math.floor((p.bbox[0] + p.bbox[2] / 2) / (W / 4))}|${Math.floor((p.bbox[1] + p.bbox[3] / 2) / (H / 3))}` }))
      .filter(({ cell }) => t - (st.objSeen.get(cell) ?? 0) > 120_000)
      .sort((x, y) => y.p.score - x.p.score)[0];
    if (!best) return;
    st.objAt = t;
    st.objSeen.set(best.cell, t);
    const [x, y, w, h] = best.p.bbox.map((v, i) => v * (i % 2 ? SH / H : SW / W));
    const m = 0.3;
    const sx = Math.max(0, x - w * m);
    const sy = Math.max(0, y - h * m);
    const sw = Math.min(SW - sx, w * (1 + 2 * m));
    const sh = Math.min(SH - sy, h * (1 + 2 * m));
    const k = Math.min(1, 320 / Math.max(sw, sh));
    const c = Object.assign(document.createElement('canvas'), { width: Math.max(32, Math.round(sw * k)), height: Math.max(32, Math.round(sh * k)) });
    c.getContext('2d').drawImage(st.media, sx, sy, sw, sh, 0, 0, c.width, c.height);
    post('vision/sightings', { sourceId: st.src.id, sourceName: nameOf(st), track: `${st.runId}-obj-${best.cell}-${Math.floor(t / 600_000)}`, kind: 'object', label: best.p.class, testVideo: Boolean(st.testVideo), image: c.toDataURL('image/jpeg', 0.8) }).catch(() => {});
    for (const [cell, at] of st.objSeen) if (t - at > 600_000) st.objSeen.delete(cell);
  }

  /**
   * Nashdan (scenes): the whole picture, so anything in the facility can be asked about (an open
   * door, water on the floor, a ladder). Sent when the picture has changed, and at least every 5 min.
   */
  function sceneSighting(st, work) {
    const t = Date.now();
    if (t - (st.sceneAt ?? 0) < 15_000) return;
    st.sceneSmall ??= Object.assign(document.createElement('canvas'), { width: 32, height: 18 });
    const sc = st.sceneSmall.getContext('2d', { willReadFrequently: true });
    sc.drawImage(work, 0, 0, 32, 18);
    const px = sc.getImageData(0, 0, 32, 18).data;
    const sig = new Uint8Array(32 * 18);
    for (let i = 0; i < sig.length; i++) sig[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
    let diff = 255;
    if (st.sceneSig) {
      diff = 0;
      for (let i = 0; i < sig.length; i++) diff += Math.abs(sig[i] - st.sceneSig[i]);
      diff /= sig.length;
    }
    if (diff < 6 && t - st.sceneAt < 300_000) return;
    st.sceneAt = t;
    st.sceneSig = sig;
    post('vision/sightings', { sourceId: st.src.id, sourceName: nameOf(st), track: `${st.runId}-scene-${Math.floor(t / 600_000)}`, kind: 'scene', testVideo: Boolean(st.testVideo), image: work.toDataURL('image/jpeg', 0.72) }).catch(() => {});
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
          const canvas = canvasOf(st.src.id);
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
        const phone = [...live.values()].find((s) => s.phoneCheck);
        if (phone) {
          await checkPhone(phone, zs);
          continue;
        }
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
        while (performance.now() < until && live.size && ![...live.values()].some((s) => s.verifyQueue?.length || s.phoneCheck)) await new Promise((r) => setTimeout(r, 250));
      }
    } catch (err) {
      console.warn(`[zero-shot] stopped: ${err.message}`);
    } finally {
      zsLooping = false;
    }
  }

  async function zeroShotStep(st, best, bodies, zs, full) {
    const a = new Set(st.src.analyzers);
    const canvas = canvasOf(st.src.id);
    if (!canvas) return;
    st.zs ??= {};
    const k = sensOf(st).zs;
    const ZS = { gun: scaled(ZS_THRESHOLDS.gun, k), knife: scaled(ZS_THRESHOLDS.knife, k), smoke: scaled(ZS_THRESHOLDS.smoke, k), fire: scaled(ZS_THRESHOLDS.fire, k) };
    const SMK = scaled(SMOKING_THRESHOLDS, k);
    st.zsDraw = (st.zsDraw ?? []).filter((d) => Date.now() - d.t < 5000);

    // Smoking first: a cigarette at the mouth also reads as a thin blade (console test: 'knife' 0.43
    // on a smoker), so whether this person smokes is settled before the knife is judged. One person
    // per look (~4 s per OWLv2 call on an integrated GPU): the one with a faint knife at the face,
    // else a hand at the face, else every third look the largest.
    st.smokeTurn = (st.smokeTurn ?? 0) + 1;
    const knife = best.knife;
    const knifeAtFace = knife && knife.score >= ZS.knife.low ? bodies.findIndex((b) => cigaretteNotKnife(knife.box, knife.score, b.box)) : -1;
    const cand = knifeAtFace >= 0 ? knifeAtFace : bodies.length ? smokingCandidate(bodies) : -1;
    if (a.has('objects') && cand >= 0 && (knifeAtFace >= 0 || handNearFace(bodies[cand].kp) || st.smokeTurn % 3 === 0 || st.src.slot === 'smoking')) {
      const s = await zs.smoking(full, upperBodyRect(bodies[cand].box, full.width, full.height));
      const score = smokingVerdict(s, SMK) ? s.cig : 0;
      st.zs.smoking = [...(st.zs.smoking ?? []).slice(-2), score];
      if (score) {
        st.smokingAt = Date.now();
        st.smokerBox = bodies[cand].box;
        st.zsDraw.push({ t: Date.now(), kind: 'smoking', box: bodies[cand].box, conf: score, label: 'smoking' });
        if (zeroShotConfirmed(st.zs.smoking, SMK)) confirm(st, 'smoking', { conf: score, label: 'person smoking' }, canvas, null, { confirmed: true, method: SMOKING_METHOD, key: 'zs|smoking' });
      }
    }

    // Fire on the whole picture: the colour-and-flicker rule (pixelStep) misses flames that are small,
    // pale or among people (tested: 1 of 4 fire videos; a campfire inside a circle of people was masked
    // out with them), while OWLv2 told 'fire' from sunsets, lamps and tail lights on labelled photos.
    if (a.has('fire') && best.fire) {
      const hit = best.fire;
      st.zs.fire = [...(st.zs.fire ?? []).slice(-2), hit.score >= ZS.fire.low ? hit.score : 0];
      if (hit.score >= ZS.fire.low) {
        const arson = nearBox(hit.box, st.peopleBoxes ?? []);
        st.zsDraw.push({ t: Date.now(), kind: 'fire', box: hit.box, conf: hit.score, label: 'fire' });
        if (zeroShotConfirmed(st.zs.fire, ZS.fire)) {
          st.verifiedAt = { ...(st.verifiedAt ?? {}), fire: Date.now(), arson: Date.now() };
          const kind = arson ? 'arson' : 'fire';
          confirm(st, kind, { conf: hit.score, label: arson ? 'flames next to a person (possible arson)' : 'fire', box: hit.box }, canvas, null, { confirmed: true, method: OWL_FIRE_METHOD, key: `zs|${kind}` });
        }
      }
    }

    for (const target of ['gun', 'knife', 'smoke']) {
      if (target === 'smoke' ? !a.has('smoke') : !a.has('objects')) continue;
      const hit = best[target];
      const th = ZS[target];
      let score = hit?.score ?? 0;
      // A knife with nobody in view is one lying about (a kitchen, a shop shelf): not reported. On 170
      // photos every real knife found had someone in view; the false ones (a drill on a shelf, a poker
      // in a fireplace video) had nobody.
      if (target === 'knife' && !bodies.length && !st.src.anyWeapon) score = 0;
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
      if (target !== 'smoke') st.zsWeapon = { t: Date.now(), box: hit.box, conf: hit.score, name };
      if (!zeroShotConfirmed(st.zs[target], th)) continue;
      const kind = target === 'smoke' ? 'smoke' : held ? 'armed' : target === 'gun' ? 'firearm' : 'weapon';
      if (target !== 'smoke') st.lastWeapon = name;
      const label = target === 'smoke' ? 'smoke' : held ? `${name} in a person’s hand` : name;
      confirm(st, kind, { conf: hit.score, label }, canvas, null, { confirmed: true, method: OWL_METHOD, key: `zs|${kind}` });
    }
  }

  function zoneCheck(st, tracks, found) {
    const canvas = canvasOf(st.src.id);
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
    c.fillText(`${st.src.name}  ${new Date().toLocaleDateString('en-CA')} ${new Date().toTimeString().slice(0, 8)}  ${st.testVideo ? 'TEST VIDEO' : 'LIVE'}  AI${st.detector ? ` · ${st.detector.name}` : ''}${permit}`, 8, 15);
    // People in view.
    const n = st.lastPeople ?? 0;
    const pc = `${n} ${n === 1 ? 'person' : 'people'}`;
    c.font = '700 13px system-ui, sans-serif';
    const cw = c.measureText(pc).width + 16;
    c.fillStyle = n ? 'rgba(14,165,233,.92)' : 'rgba(71,85,105,.85)';
    c.fillRect(8, 28, cw, 22);
    c.fillStyle = '#fff';
    c.fillText(pc, 16, 44);
  }

  /**
   * The live picture at up to 25 frames a second, with the last analysis's boxes over it. The detector
   * analyses each camera about once a second when several share the GPU; showing only the analysed
   * frames made the video jerk. The thermal view is computed per pixel on the CPU: 10 frames a second.
   */
  function smooth(st) {
    let last = 0;
    const step = (t) => {
      if (live.get(st.src.id) !== st) return;
      st.raf = requestAnimationFrame(step);
      const hot = Boolean((st.src.thermal ?? thermal) && scratch);
      if (t - last < (hot ? 100 : 40) || !st.painted || !ready(st.media)) return;
      const canvas = canvasOf(st.src.id);
      if (!canvas) return;
      last = t;
      const c = canvas.getContext('2d');
      const draw = st.lastDraw ?? [];
      if (hot) {
        const sc = scratch.getContext('2d', { willReadFrequently: true });
        sc.drawImage(st.media, 0, 0, W, H);
        const img = sc.getImageData(0, 0, W, H);
        const fire = draw.filter((d) => (d.kind === 'fire' || d.kind === 'arson') && d.box).map((d) => d.box);
        thermalize(img.data, W, H, { warm: st.peopleBoxes ?? [], hot: fire, lut: LUT, ...THERMAL_SOFT });
        c.putImageData(img, 0, 0);
      } else c.drawImage(st.media, 0, 0, W, H);
      paint(c, st, draw);
    };
    st.raf = requestAnimationFrame(step);
  }

  /** Before the first analysed frame: the picture as it is, and what the camera is doing. */
  function preview(st) {
    const c = canvasOf(st.src.id).getContext('2d');
    if (ready(st.media)) c.drawImage(st.media, 0, 0, W, H);
    else {
      c.fillStyle = '#16181D';
      c.fillRect(0, 0, W, H);
    }
    const msg = st.status === 'Running' ? 'Starting the analysis…' : st.status;
    c.font = '600 16px system-ui, sans-serif';
    const mw = c.measureText(msg).width + 28;
    c.fillStyle = 'rgba(15,23,42,.82)';
    c.fillRect((W - mw) / 2, H / 2 - 20, mw, 40);
    c.fillStyle = '#fff';
    c.fillText(msg, (W - mw) / 2 + 14, H / 2 + 6);
  }

  // ---------------------------------------------------------------- zones on a real camera
  const drafts = new Map();
  async function finishZone(src, r) {
    const points = drafts.get(src.id) ?? [];
    if (points.length < 3) return notify('Click at least three corners on the picture.', 'warn');
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

  function addVideo(file) {
    if (!file) return;
    const src = { id: `local-video-${Date.now().toString(36)}`, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Video', kind: 'file', local: true, role: 'general', analyzers: QUICK_ANALYZERS, zones: [], verifyDevices: true, sensors: [] };
    localSources = [...localSources, src];
    render();
    start(src, file);
  }



  const api = {
    load, loadPermits, deviceAlert, grantPermit, revokePermit, editSource, start, stop, finishZone, openLaptopCamera, addVideo,
    sources: () => all(), live: (id) => live.get(id) ?? null, permits: () => permits, permitOf, hasSensitive, drafts, canvasOf,
    saveSources: (next, msg) => save(next, msg), remote: () => sources,
    setLocal: (fn) => { localSources = fn(localSources); for (const st of live.values()) st.src = all().find((s) => s.id === st.src.id) ?? st.src; render(); },
    ANALYZER_LABEL, CAMERA_ROLES, ZONE_TYPES, withRole, QUICK_ANALYZERS,
    /** Running cameras for the smart-detection page: last analysed frame and what was drawn on it. */
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
        kind: st.src.kind,
        thermalOn: Boolean(st.src.thermal ?? thermal),
        peopleBoxes: st.peopleBoxes ?? [],
        dwell: st.dwell ?? [],
        zoneList: st.src.zones ?? [],
        fileName: st.fileName ?? null,
        reportName: nameOf(st),
        fps: st.fps ?? 0,
        secondLook: { looks: st.zsLooks ?? 0, ms: st.zsMs ?? null, last: st.zsLast ?? null, verified: st.verified ?? null },
      })),
    /**
     * Analyse a video file as its own camera (smart-detection test slots). Replaces the slot's
     * previous video. role: 'general' (people, weapons, smoking, fire, smoke) or 'tower' (+ behaviour).
     */
    /** Thermal-style view on or off for every camera (remembered in this browser). */
    thermal: () => thermal,
    setThermal(on) {
      thermal = Boolean(on);
      try {
        localStorage.setItem('sawn.cams.thermal', thermal ? '1' : '0');
      } catch {
        // per-browser convenience only
      }
    },
    // opts: the camera's settings on the page — cameraNo, location, sensitivity, speed, thermal, analyzers.
    analyseFile(file, { name, slot, role = 'general', ...opts }) {
      for (const x of localSources.filter((y) => y.slot === slot)) stop(x.id);
      localSources = localSources.filter((x) => x.slot !== slot);
      const analyzers = opts.analyzers?.length ? opts.analyzers : withRole(QUICK_ANALYZERS, role);
      const src = { id: `slot-${slot}-${Date.now().toString(36)}`, name, slot, kind: 'file', local: true, role, zones: [], verifyDevices: false, sensors: [], ...opts, analyzers };
      localSources = [...localSources, src];
      render();
      start(src, file);
      return src.id;
    },
    /** This computer's camera as a numbered camera (camera 1: live, people count, thermal view). */
    openSlot({ name, slot, role = 'general', ...opts }) {
      for (const x of localSources.filter((y) => y.slot === slot)) stop(x.id);
      localSources = localSources.filter((x) => x.slot !== slot);
      const analyzers = opts.analyzers?.length ? opts.analyzers : ['people'];
      const src = { id: `slot-${slot}-${Date.now().toString(36)}`, name, slot, kind: 'webcam', local: true, role, zones: [], verifyDevices: true, sensors: [], ...opts, analyzers };
      localSources = [...localSources, src];
      render();
      start(src);
      return src.id;
    },
    /**
     * Run a camera of the operations console: { id, name, kind: 'webcam' | 'file', videoUrl,
     * recordingId, cameraNo, location, role, analyzers, thermal, zones }. Replaces a running one with
     * the same id.
     */
    run(def) {
      stop(def.id);
      const src = { zones: [], verifyDevices: def.kind === 'webcam', sensors: [], local: true, ...def, analyzers: withRole(def.analyzers?.length ? def.analyzers : QUICK_ANALYZERS, def.role ?? 'general') };
      localSources = [...localSources.filter((x) => x.id !== src.id), src];
      render();
      start(src);
      return src.id;
    },
    /** The playing video / camera element of a running camera (playback controls). */
    media: (id) => live.get(id)?.media ?? null,
    /** Stop a local camera (this computer's camera, an uploaded or slot video) and remove it. */
    close(id) {
      stop(id);
      localSources = localSources.filter((x) => x.id !== id);
      render();
    },
  };
  return api;
}

const cams = createCams();
window.SAWN_CAMS = Object.assign(cams, { onNotify: (f) => { notify = f; }, onRender: (f) => { render = f; } });
window.dispatchEvent(new Event('sawn-cams'));
export const aiCameras = () => cams;
