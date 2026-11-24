// Aircraft view of the airspace radar: real geography (linear scale, offline vector backdrop),
// layered zones, aircraft and drones with trails and 2-minute predictions, an altitude profile,
// one threat list, and the exhibition demo player (scenario dropdown, timeline, bilingual captions,
// sound, presenter mode). Data comes from the server's `aircraft` message; the server applies the
// rules (src/core/airspaceRules.js) — this module only draws and controls.
import { PATHS, icon } from './icons.js';
import { el } from './dom.js';
import { AIR_SCENARIOS } from '../shared/airScenarios.js';
import { LEVEL_LABEL, fmtMinSec, toLocal } from '../core/airspaceRules.js';
import { AIRFIELDS, CITY_OUTLINE, ROADS } from './geoRiyadh.js';
import { createDemoSound } from './demoSound.js';
import { aroundCandidates, overlaps, placeLabels, ringCandidates } from './labelPlacer.js';
import { createSpaceView } from './spaceView.js';
import { SEGMENTS, segmentOfTrack } from '../shared/defenseLayers.js';

export const ZOOMS = [5, 15, 50];
const SIM = '#c084fc';
const LV = { critical: '#f87171', high: '#fb923c', warning: '#fbbf24', normal: '#5eead4', expected: '#86efac' };
const SEV_COLOR = { critical: '#f87171', high: '#fb923c', warning: '#fbbf24', expected: '#86efac' };
const ZOOM_KEY = 'sawn.sky.zoom';
const KT = 0.514444;
const pathCache = new Map();
const pathFor = (name) => {
  if (!pathCache.has(name)) pathCache.set(name, new Path2D(PATHS[name]));
  return pathCache.get(name);
};
const fmtFt = (v) => (Number.isFinite(v) ? `${Math.round(v).toLocaleString('en-US')} ft` : 'alt ?');
const fmtKm = (m) => (Number.isFinite(m) ? `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km` : '—');
const nameOf = (tr) => tr.callsign || tr.name || tr.registration || tr.hex.toUpperCase();
const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      // per-console convenience only
    }
  },
};

/**
 * @param host        the radar root (goes fullscreen in presenter mode)
 * @param stage       radar stage (canvas container): status chip, captions and zoom are overlaid on it
 * @param profileHost element under the stage for the altitude profile
 * @param demoHost    element under the radar for the demo panel (collapsible)
 * @param side        right-hand panel
 * @param onAction    (action, payload) → app ('demo', { action, id, speed, t }) · ('adsb-mode', mode)
 * @param incidents   () => console incidents (for the presenter list)
 * @param isActive    () => the aircraft view is on screen
 */
export function createSkyView({ host, stage, profileHost, demoHost, side, onAction = () => {}, incidents = () => [], isActive = () => false, voice = null }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound = createDemoSound();
  let data = null;
  let zoomKm = Number(store.get(ZOOM_KEY, 15));
  if (!ZOOMS.includes(zoomKm)) zoomKm = 15;
  let selected = null;
  let hover = null;
  let drawn = []; // [{ tr, x, y }] from the last frame, for hit tests
  let presenter = false;
  let lastRun = null;
  let sel = null; // scenario chosen in the dropdown (for Play when idle)

  // ------------------------------------------------------------------ overlays on the stage
  const statusChip = el('div', { className: 'sky-status', attrs: { role: 'status' } });
  const simChip = el('div', { className: 'sky-sim', attrs: { hidden: '' } });
  const gnssChip = el('div', { className: 'sky-status sky-gnss', attrs: { role: 'status', hidden: '' } });
  const chips = el('div', { className: 'sky-chips' }, [statusChip, gnssChip, simChip]);
  const zoomButtons = ZOOMS.map((z) => el('button', { className: 'btn btn-sm', text: `${z} km`, attrs: { type: 'button', 'aria-pressed': String(z === zoomKm), 'data-zoom': String(z) } }));
  const zoomCtl = el('div', { className: 'sky-zoom seg', attrs: { role: 'group', 'aria-label': 'Radar range' } }, zoomButtons);
  zoomCtl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (b) setZoom(Number(b.dataset.zoom));
  });
  const capAr = el('div', { className: 'ar', attrs: { lang: 'ar', dir: 'rtl' } });
  const capEn = el('div', { className: 'en', attrs: { lang: 'en' } });
  const caption = el('div', { className: 'sky-caption', attrs: { hidden: '', 'aria-live': 'polite' } }, [capAr, capEn]);
  const overlays = [chips, zoomCtl, caption];
  stage.append(...overlays);
  // Empty sky: say why (public ADS-B receivers barely cover some regions) and where the nearest
  // visible traffic is, instead of an unexplained blank radar.
  const emptyBox = el('div', { className: 'sky-empty', attrs: { hidden: '', role: 'status' } });
  stage.append(emptyBox);
  const fmtFar = (a) => `${a.name} — ${Math.round(a.distanceM / 1000)} km ${a.compass}${a.onGround ? ', on the ground' : Number.isFinite(a.altitudeFt) ? `, ${a.altitudeFt.toLocaleString('en-US')} ft` : ''}`;
  function renderEmpty() {
    const m = data;
    const demoOn = m?.demo?.status && m.demo.status !== 'idle';
    const hasTracks = (m?.list ?? []).some((t) => Number.isFinite(t.lat));
    emptyBox.hidden = !m || hasTracks || demoOn || !overlays[0].isConnected || zoomCtl.hidden;
    if (emptyBox.hidden) return;
    const near = m.far?.nearest?.[0];
    let why;
    if (m.mode === 'off') why = 'The aircraft feed is switched off.';
    else if (m.replay) why = 'The recording has no aircraft near the site.';
    else if (m.error && !m.far) why = 'The aircraft feed is not answering right now — retrying automatically.';
    else if (near) why = `Public ADS-B receivers barely cover this area. Nearest aircraft they can see: ${fmtFar(near)}. ${m.far.count} aircraft within ${Math.round(m.far.radiusM / 1000)} km are shown as arrows at the edge.`;
    else if (m.far) why = `Public ADS-B receivers see no aircraft within ${Math.round(m.far.radiusM / 1000)} km of the site right now.`;
    else why = 'Waiting for the next update of the aircraft feed.';
    emptyBox.replaceChildren(
      el('b', { className: 'ar', text: 'لا توجد طائرات ضمن 50 كم الآن', attrs: { lang: 'ar', dir: 'rtl' } }),
      el('b', { text: 'No aircraft within 50 km right now' }),
      el('p', { text: why }),
    );
  }

  // ------------------------------------------------------------------ altitude profile
  const profile = el('canvas', { className: 'sky-profile-canvas', attrs: { role: 'img', 'aria-label': 'Altitude profile: distance from the site against altitude' } });
  const space = createSpaceView(profileHost);
  profileHost.append(el('div', { className: 'sky-profile-head' }, [el('b', { text: 'Altitude profile' }), el('span', { className: 'sub', text: 'side view · distance from the site → · altitude ↑ · red box = restricted airspace up to its ceiling' })]), profile);

  // ------------------------------------------------------------------ demo panel
  // Collapsed by default (opens by itself while a demo runs): one dropdown to pick the scenario,
  // the player on one row, a one-line description, and sound / voice / presenter underneath.
  const DEMO_OPEN_KEY = 'sawn.demo.open';
  const sevLabel = (s) => (s === 'expected' ? 'no alarm' : s.toUpperCase());
  const pick = el(
    'select',
    { className: 'sky-pick', attrs: { 'aria-label': 'Demo scenario', 'data-action': 'demo-play' } },
    AIR_SCENARIOS.map((sc) => el('option', { text: `${sc.key} · ${sc.title.en} — ${sc.title.ar} (${fmtMinSec(sc.duration)}, ${sevLabel(sc.severity)})`, attrs: { value: sc.id } })),
  );
  sel = AIR_SCENARIOS[0].id;
  pick.addEventListener('change', () => {
    sel = pick.value;
    renderDemo();
  });
  const pickDesc = el('p', { className: 'sky-pick-desc' });
  const btn = (label, iconName, title, cls = '') => el('button', { className: `btn btn-sm ${cls}`, attrs: { type: 'button', title } }, [icon(iconName, { size: 14 }), document.createTextNode(label)]);
  const bPlay = btn('Play', 'play', 'Play / pause (Space)', 'btn-primary');
  bPlay.dataset.action = 'demo-play';
  const bStop = btn('Stop', 'close', 'Stop and clean up (Esc)');
  const bRestart = btn('Restart', 'refresh', 'Start this scenario again');
  const speedBtns = [1, 2, 4].map((x) => el('button', { className: 'btn btn-sm', text: `${x}×`, attrs: { type: 'button', 'data-speed': String(x), 'aria-pressed': String(x === 1) } }));
  const speedCtl = el('div', { className: 'seg', attrs: { role: 'group', 'aria-label': 'Playback speed' } }, speedBtns);
  const bar = el('div', { className: 'sky-progress', attrs: { role: 'slider', 'aria-label': 'Scenario timeline', 'aria-valuemin': '0' } });
  const fill = el('div', { className: 'sky-progress-fill' });
  bar.append(fill);
  const clock = el('span', { className: 'sky-clock mono', text: '0:00 / 0:00' });
  const bMute = el('button', { className: 'btn btn-sm btn-ghost', attrs: { type: 'button', 'aria-pressed': String(sound.muted) } });
  const bPresent = btn('Presenter mode', 'monitor', 'Full screen: radar, profile, captions and incidents only', 'btn-ghost');
  // Voice alerts toggle (shared with the header button through voice.onChange).
  const bVoice = el('button', { className: 'btn btn-sm btn-ghost', attrs: { type: 'button', title: 'Speak new WARNING / HIGH / CRITICAL incidents aloud' } });
  const renderVoice = () => {
    const on = Boolean(voice?.enabled && voice?.supported);
    bVoice.replaceChildren(icon(on ? 'volume' : 'mute', { size: 14 }), document.createTextNode(voice?.supported === false ? 'Voice n/a' : on ? 'Voice on' : 'Voice off'));
    bVoice.setAttribute('aria-pressed', String(on));
    bVoice.disabled = !voice?.supported;
  };
  bVoice.addEventListener('click', () => {
    if (voice) voice.enabled = !voice.enabled;
  });
  voice?.onChange(renderVoice);
  renderVoice();
  const renderMute = () => {
    bMute.replaceChildren(icon(sound.muted ? 'mute' : 'volume', { size: 14 }), document.createTextNode(sound.muted ? 'Sound off' : 'Sound on'));
    bMute.setAttribute('aria-pressed', String(sound.muted));
  };
  renderMute();
  const demoState = el('span', { className: 'sky-demo-state' });
  const demoPanel = el('details', { className: 'sky-demo' }, [
    el('summary', {}, [icon('demo', { size: 16 }), el('b', { text: 'Demo scenarios' }), el('span', { className: 'badge badge-sim', text: 'SIMULATED' }), demoState]),
    el('div', { className: 'sky-demo-body' }, [
      el('div', { className: 'sky-pick-row' }, [pick, bPlay, bStop, bRestart, speedCtl]),
      pickDesc,
      el('div', { className: 'sky-timeline' }, [bar, clock]),
      el('div', { className: 'sky-demo-tools' }, [bMute, bVoice, bPresent, el('span', { className: 'sub', text: 'Keys 1–9 start · Space pause · Esc stop · everything is SIMULATED and removed when stopped' })]),
    ]),
  ]);
  demoPanel.open = store.get(DEMO_OPEN_KEY, '0') === '1';
  demoPanel.addEventListener('toggle', () => store.set(DEMO_OPEN_KEY, demoPanel.open ? '1' : '0'));
  demoHost.append(demoPanel);

  bPlay.addEventListener('click', () => {
    const st = data?.demo?.status ?? 'idle';
    if (st === 'idle') demo('play', { id: sel ?? AIR_SCENARIOS[0].id });
    else demo('toggle');
  });
  bStop.addEventListener('click', () => demo('stop'));
  bRestart.addEventListener('click', () => demo('restart'));
  speedCtl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-speed]');
    if (b) demo('speed', { speed: Number(b.dataset.speed) });
  });
  bar.addEventListener('click', (e) => {
    const d = data?.demo;
    if (!d || d.status === 'idle') return;
    const m = e.target.closest('[data-t]');
    const r = bar.getBoundingClientRect();
    const t = m ? Number(m.dataset.t) : ((e.clientX - r.left) / r.width) * d.duration;
    demo('seek', { t: Math.max(0, Math.min(d.duration, t)) });
  });
  bMute.addEventListener('click', () => {
    sound.muted = !sound.muted;
    renderMute();
  });
  bPresent.addEventListener('click', () => setPresenter(!presenter));
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && presenter) setPresenter(false, { fromExit: true });
  });

  function demo(action, payload = {}) {
    onAction('demo', { action, ...payload });
  }

  function setPresenter(on, { fromExit = false } = {}) {
    presenter = on;
    host.classList.toggle('presenter', on);
    bPresent.setAttribute('aria-pressed', String(on));
    if (on && host.requestFullscreen && !document.fullscreenElement) host.requestFullscreen().catch(() => {});
    if (!on && !fromExit && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    lastSideSig = '';
    renderSide();
  }

  document.addEventListener('keydown', (e) => {
    if (!isActive() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, select, textarea, [contenteditable="true"]')) return;
    if (e.key === 'Escape' && presenter) {
      setPresenter(false); // first Esc leaves presenter mode (when the browser did not take it for fullscreen)
    }
  });

  function setZoom(z) {
    zoomKm = z;
    store.set(ZOOM_KEY, String(z));
    for (const b of zoomButtons) b.setAttribute('aria-pressed', String(Number(b.dataset.zoom) === z));
  }

  // ------------------------------------------------------------------ data
  function setData(msg) {
    const prevRun = data?.demo?.runId ?? null;
    data = msg;
    const d = msg.demo ?? { status: 'idle' };
    if (d.runId && d.runId !== prevRun && d.zoomKm) setZoom(d.zoomKm); // a scenario chooses its range
    if (d.runId && d.runId !== lastRun) {
      lastRun = d.runId;
      sel = d.id;
    }
    for (const cue of msg.cues ?? []) sound.play(cue);
    if (selected && !msg.list.some((t) => t.hex === selected)) selected = null;
    renderStatus();
    renderDemo();
    renderEmpty();
    renderSide();
  }

  // Paid Flightradar24 source: credits used today, and why it is paused (the free source then shows).
  function fr24Note(f) {
    if (!f) return '';
    const n = (v) => Number(v ?? 0).toLocaleString('en-US');
    const why = f.paused === 'budget' ? ' · FR24 daily credit cap reached' : f.lastError ? ` · FR24 ${f.lastError}` : '';
    return ` · FR24 ${n(f.creditsToday)} / ${n(f.budget)} credits today${why}`;
  }

  function renderStatus() {
    const m = data;
    const time = (t) => (t ? new Date(t).toLocaleTimeString(undefined, { hour12: false }) : '—');
    let tone;
    let label;
    let detail;
    if (!m) [tone, label, detail] = ['off', 'CONNECTING', ''];
    else if (m.replay) [tone, label, detail] = ['replay', 'REPLAY', m.replay.recordedAt ? `recorded ${new Date(m.replay.recordedAt).toLocaleString(undefined, { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${m.replay.auto ? ' · internet down' : ''}` : 'no recording yet'];
    else if (m.mode === 'off') [tone, label, detail] = ['off', 'OFF', 'aircraft feed switched off'];
    else if (m.error) [tone, label, detail] = ['error', 'ERROR', `retrying · last data ${time(m.fetchedAt)}`];
    else [tone, label, detail] = ['live', 'LIVE', `${m.source ?? ''} · updated ${time(m.fetchedAt)}${fr24Note(m.fr24)}`];
    statusChip.dataset.tone = tone;
    statusChip.replaceChildren(el('span', { className: 'dot' }), el('b', { text: label }), el('span', { text: detail }));
    statusChip.title = m?.error ?? '';
    // GPS health from the aircraft's navigation integrity (the demo's own picture when it is worse).
    const order = { unknown: 0, ok: 1, degraded: 2, jamming: 3 };
    const g = [m?.gnss?.real, m?.gnss?.sim].filter(Boolean).sort((a, b) => order[b.level] - order[a.level])[0];
    gnssChip.hidden = !g || (g.level === 'unknown' && !g.total);
    if (!gnssChip.hidden) {
      const sim = g === m.gnss.sim && g.level !== 'unknown' && order[g.level] > order[m.gnss.real?.level ?? 'unknown'];
      gnssChip.dataset.tone = sim ? 'sim' : { ok: 'live', degraded: 'replay', jamming: 'error', unknown: 'off' }[g.level];
      gnssChip.replaceChildren(el('span', { className: 'dot' }), el('b', { text: { ok: 'GPS OK', degraded: 'GPS DEGRADED', jamming: 'GPS JAMMING?', unknown: 'GPS ?' }[g.level] }), el('span', { text: `${g.bad} of ${g.total} aircraft with poor GPS${sim ? ' · SIMULATED' : ''}` }));
    }
    const d = m?.demo;
    simChip.hidden = !d || d.status === 'idle';
    if (!simChip.hidden) simChip.textContent = `SIMULATION · ${d.title?.en ?? d.id}${d.status === 'paused' ? ' · paused' : d.status === 'ended' ? ' · ended' : ''}`;
  }

  let markersFor = null;
  function renderDemo() {
    const d = data?.demo ?? { status: 'idle' };
    const active = d.status !== 'idle';
    if (active) {
      pick.value = d.id;
      if (!demoPanel.open) demoPanel.open = true; // a running demo always shows its controls
    }
    pick.disabled = active;
    demoState.textContent = active ? `● ${d.title?.en ?? d.id} · ${fmtMinSec(d.t)}${d.status === 'paused' ? ' · paused' : ''}` : '';
    bPlay.replaceChildren(icon(d.status === 'playing' ? 'pause' : 'play', { size: 14 }), document.createTextNode(d.status === 'playing' ? 'Pause' : d.status === 'paused' ? 'Resume' : 'Play'));
    bStop.disabled = !active;
    bRestart.disabled = !active;
    for (const b of speedBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === (d.speed ?? 1)));
    const sc = AIR_SCENARIOS.find((s) => s.id === (active ? d.id : sel));
    const dur = sc?.duration ?? 0;
    pickDesc.replaceChildren(el('span', { text: sc?.desc.en ?? '' }), el('span', { className: 'ar', text: sc?.desc.ar ?? '', attrs: { lang: 'ar', dir: 'rtl' } }));
    if (markersFor !== sc?.id) {
      markersFor = sc?.id ?? null;
      bar.replaceChildren(fill, ...(sc?.steps ?? []).map((s) => el('button', { className: `sky-mark cue-${s.cue ?? s.action ?? 'info'}`, attrs: { type: 'button', 'data-t': String(s.t), style: `left:${(s.t / dur) * 100}%`, title: `${fmtMinSec(s.t)} · ${s.en}`, 'aria-label': `Jump to ${fmtMinSec(s.t)}: ${s.en}` } })));
      bar.setAttribute('aria-valuemax', String(dur));
    }
    fill.style.width = `${active && dur ? Math.min(100, (d.t / dur) * 100) : 0}%`;
    bar.setAttribute('aria-valuenow', String(active ? d.t : 0));
    for (const m of bar.querySelectorAll('.sky-mark')) m.classList.toggle('done', active && Number(m.dataset.t) <= d.t);
    clock.textContent = `${fmtMinSec(active ? d.t : 0)} / ${fmtMinSec(dur)}`;
    caption.hidden = !active || !d.caption;
    if (!caption.hidden) {
      capAr.textContent = d.caption.ar;
      capEn.textContent = d.caption.en;
    }
  }

  // ------------------------------------------------------------------ side panel
  const sideStatus = el('p', { className: 'hint' });
  const modeSel = el('select', { attrs: { 'data-action': 'adsb-mode', 'aria-label': 'Aircraft data source' } }, [
    el('option', { text: 'Live (internet)', attrs: { value: 'live' } }),
    el('option', { text: 'Replay recording', attrs: { value: 'replay' } }),
    el('option', { text: 'Off', attrs: { value: 'off' } }),
  ]);
  modeSel.addEventListener('change', () => onAction('adsb-mode', modeSel.value));
  // Paid Flightradar24: used only while switched on here (turns itself off after autoOffMin).
  const fr24Btn = el('button', { className: 'btn btn-sm sky-fr24', attrs: { type: 'button', 'data-action': 'fr24', hidden: '' } });
  const fr24Info = el('p', { className: 'hint sky-fr24-info', attrs: { hidden: '' } });
  fr24Btn.addEventListener('click', () => onAction('fr24', !(data?.fr24?.on)));
  function renderFr24() {
    const f = data?.fr24;
    const show = Boolean(f && f.manual);
    fr24Btn.hidden = !show;
    fr24Info.hidden = !show;
    if (!show) return;
    const n = (v) => Number(v ?? 0).toLocaleString('en-US');
    const left = f.onUntil ? Math.max(1, Math.ceil((f.onUntil - Date.now()) / 60_000)) : 0;
    fr24Btn.classList.toggle('on', f.on);
    fr24Btn.setAttribute('aria-pressed', String(f.on));
    fr24Btn.replaceChildren(icon('plane', { size: 14 }), document.createTextNode(f.on ? ` Flightradar24 ON · ${left} min left — Stop` : ' Use Flightradar24'));
    const why = f.paused === 'budget' ? ' Daily credit cap reached — free source until tomorrow (UTC).' : f.paused === 'no-console' ? ' Paused: no console open.' : f.lastError ? ` Last FR24 error: ${f.lastError}.` : '';
    fr24Btn.title = f.on ? 'Stop using Flightradar24 now (saves credits)' : `Use Flightradar24 for ${f.autoOffMin} minutes`;
    fr24Info.textContent = `${f.on ? `Paid source in use, switches off by itself after ${f.autoOffMin} min.` : 'Free source (adsb.lol) in use. Press to see all aircraft from Flightradar24 (uses paid credits).'} ${n(f.creditsToday)} / ${n(f.budget)} credits used today.${why}`;
  }
  // The minutes left keep counting between feed updates (one per minute).
  setInterval(() => data?.fr24?.on && isActive() && renderFr24(), 15_000);
  const listBox = el('ul', { className: 'sky-list', attrs: { 'aria-label': 'Tracks by threat' } });
  listBox.addEventListener('click', (e) => {
    const li = e.target.closest('[data-hex]');
    if (!li) return;
    selected = li.dataset.hex;
    lastSideSig = '';
    renderSide();
  });
  const incBox = el('ul', { className: 'sky-incidents' });
  const intro = [
    el('h3', {}, [icon('plane', { size: 16 }), document.createTextNode(' Airspace picture')]),
    sideStatus,
    el('label', { className: 'field sky-source' }, [el('span', { text: 'Aircraft data' }), modeSel]),
    fr24Btn,
    fr24Info,
    el('h4', { className: 'sky-list-h', text: 'By threat' }),
    listBox,
  ];
  const exitPresenter = el('button', { className: 'btn btn-ghost btn-sm sky-exit', text: 'Exit presenter (Esc)', attrs: { type: 'button' } });
  exitPresenter.addEventListener('click', () => setPresenter(false));
  const presenterIntro = [exitPresenter, el('h3', { text: 'Threats' }), listBox, el('h3', { text: 'Incidents' }), incBox];

  let lastSideSig = '';
  function renderSide() {
    if (!isActive()) return;
    const list = data?.list ?? [];
    const tr = selected ? list.find((t) => t.hex === selected) : null;
    if (document.activeElement !== modeSel && data?.mode) modeSel.value = data.mode;
    renderFr24();
    sideStatus.textContent = !data
      ? 'Waiting for the server…'
      : `${list.filter((t) => t.kind === 'aircraft' && !t.simulated).length} aircraft and ${list.filter((t) => t.kind === 'drone' && !t.simulated).length} drone(s) within 50 km${data.demo?.status && data.demo.status !== 'idle' ? ' · demo running (SIMULATED tracks in purple)' : ''}.`;
    renderList(list);
    if (presenter) renderIncidents();
    const sig = tr ? `tr|${tr.hex}|${tr.level}|${tr.altitudeFt}|${tr.distanceM}|${tr.timeToZoneSec}|${tr.squawk}` : presenter ? 'presenter' : 'intro';
    if (sig === lastSideSig) return;
    lastSideSig = sig;
    if (!tr) {
      side.replaceChildren(...(presenter ? presenterIntro : intro));
      return;
    }
    side.replaceChildren(...details(tr));
  }

  function levelPill(tr) {
    const text = tr.expected ? `Expected – ${tr.expected.airport} traffic` : tr.emergencyInfo ? `SQUAWK ${tr.emergencyInfo.code}` : LEVEL_LABEL[tr.level];
    return el('span', { className: `lv-pill lv-${tr.level}`, text });
  }

  const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
  /** "MS461 · CAI → RUH · A320 · SU-GFL" when Flightradar24 "full" provides it. */
  function routeOf(tr) {
    if (tr.kind !== 'aircraft' || tr.simulated) return '';
    const route = tr.origin || tr.destination ? `${tr.origin ?? '?'} → ${tr.destination ?? '?'}` : null;
    const flight = tr.flightNumber && tr.flightNumber !== tr.callsign ? tr.flightNumber : null;
    return [flight, route, tr.type, tr.registration].filter(Boolean).join(' · ');
  }
  function climbText(tr) {
    const v = tr.verticalRateFpm;
    if (tr.onGround || !Number.isFinite(v) || Math.abs(v) < 300) return null;
    return `${v > 0 ? '↑' : '↓'} ${Math.abs(Math.round(v / 100) * 100).toLocaleString('en-US')} ft/min`;
  }

  function renderList(list) {
    const rows = list.slice(0, 40).map((tr) =>
      el('li', { className: `sky-row lv-${tr.level}${tr.simulated ? ' sim' : ''}${tr.hex === selected ? ' selected' : ''}${data?.demo?.status !== 'idle' && data?.demo && !tr.simulated ? ' dim' : ''}`, attrs: { 'data-hex': tr.hex, tabindex: '0' } }, [
        el('span', { className: 'sky-row-icon' }, [icon(tr.kind === 'drone' ? 'drone' : 'plane', { size: 16 })]),
        el('span', { className: 'sky-row-main' }, [
          el('span', { className: 'sky-row-head' }, [
            el('b', { text: nameOf(tr) }),
            tr.simulated ? el('span', { className: 'badge badge-sim', text: 'SIM' }) : null,
            // The defense-layer tag only when it says something: a GPS-link problem.
            segmentOfTrack(tr) === 'link'
              ? (() => {
                  const s = SEGMENTS.find((x) => x.id === 'link');
                  return el('span', { className: `seg-tag seg-${s.id}`, text: `${s.icon} GPS link`, attrs: { title: `Defense layer: ${s.en} / ${s.ar} — navigation signal problem` } });
                })()
              : null,
            levelPill(tr),
          ]),
          routeOf(tr) ? el('small', { className: 'sky-route', text: routeOf(tr) }) : null,
          el('small', { text: [Number.isFinite(tr.altitudeFt) ? (tr.onGround ? 'on the ground' : fmtFt(tr.altitudeFt)) : null, fmtKm(tr.distanceM), Number.isFinite(tr.speedKt) ? `${tr.speedKt} kt` : null, climbText(tr)].filter(Boolean).join(' · ') }),
          tr.level !== 'normal' && !tr.expected ? el('small', { className: 'sky-why', text: tr.reason }) : tr.expected ? el('small', { className: 'sky-why', text: `${cap(tr.expected.phase)} · ${tr.expected.runway}` }) : null,
        ]),
      ]),
    );
    const farRows = (data?.far?.nearest ?? []).map((a) => el('li', { className: 'sky-far', text: fmtFar(a) }));
    listBox.replaceChildren(
      ...(rows.length ? rows : [el('li', { className: 'sub', text: data ? 'No aircraft or drones within 50 km.' : 'Waiting for data…' })]),
      ...(farRows.length ? [el('li', { className: 'sky-far-h', text: `Nearest visible beyond 50 km · information only (${data.far.count} within ${Math.round(data.far.radiusM / 1000)} km)` }), ...farRows] : []),
    );
  }

  function renderIncidents() {
    const open = incidents()
      .filter((i) => ['new', 'ack', 'escalated'].includes(i.status) && (i.source === 'airspace' || /aircraft|drone|squawk/i.test(i.type)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6);
    incBox.replaceChildren(
      ...(open.length
        ? open.map((i) => el('li', { className: `sev-${i.sev}` }, [el('b', { text: i.type }), el('small', { text: `${i.ref} · ${i.status}${i.simulated ? ' · SIMULATED' : ''}` })]))
        : [el('li', { className: 'sub', text: 'No airspace incidents.' })]),
    );
  }

  function details(tr) {
    const ago = (ms) => `${Math.max(0, Math.round((Date.now() - ms) / 1000))} s ago`;
    const rows = [
      ['Threat', `${tr.expected ? 'Expected traffic' : LEVEL_LABEL[tr.level]} — ${tr.reason}`],
      tr.emergencyInfo ? ['Squawk', `${tr.emergencyInfo.code} — ${tr.emergencyInfo.en}`] : ['Squawk', tr.squawk ?? '—'],
      ['Kind', tr.kind === 'drone' ? `Drone${tr.detection ? ` · ${tr.detection}` : ''}` : [tr.type, tr.registration].filter(Boolean).join(' · ') || 'Aircraft'],
      tr.kind === 'aircraft' && (tr.flightNumber || tr.origin || tr.destination) ? ['Flight', [tr.flightNumber, tr.origin || tr.destination ? `${tr.origin ?? '?'} → ${tr.destination ?? '?'}` : null, tr.operator ? `operator ${tr.operator}` : null].filter(Boolean).join(' · ')] : null,
      tr.kind === 'aircraft' ? ['ICAO address', tr.simulated ? '— (simulated)' : tr.hex.toUpperCase()] : null,
      ['Altitude', tr.onGround ? 'On the ground' : `${fmtFt(tr.altitudeFt)}${Number.isFinite(tr.verticalRateFpm) && Math.abs(tr.verticalRateFpm) >= 100 ? ` · ${tr.verticalRateFpm > 0 ? 'climbing' : 'descending'} ${Math.abs(tr.verticalRateFpm).toLocaleString('en-US')} ft/min` : ''}`],
      ['Speed · track', `${Number.isFinite(tr.speedKt) ? `${tr.speedKt} kt (${Math.round(tr.speedKt * 1.852)} km/h)` : '—'} · ${Number.isFinite(tr.track) ? `${tr.track}°` : '—'}`],
      ['From the site', fmtKm(tr.distanceM)],
      ['Restricted zone', tr.restricted ? 'INSIDE' : tr.timeToZoneSec !== null && tr.timeToZoneSec !== undefined ? `predicted entry in ${fmtMinSec(tr.timeToZoneSec)}` : 'not on a course into it'],
      tr.expected ? ['Airport', `${tr.expected.phase} · ${tr.expected.runway}`] : null,
      tr.kind === 'aircraft' ? ['GPS integrity', tr.nav?.text ?? '—'] : null,
      tr.spoof ? ['GPS spoofing?', tr.spoof] : null,
      (() => {
        const s = SEGMENTS.find((x) => x.id === segmentOfTrack(tr));
        return s ? ['Defense layer', `${s.icon} ${s.en} — ${s.desc.en}`] : null;
      })(),
      tr.pilot ? ['Pilot', `${tr.pilot.lat.toFixed(5)}, ${tr.pilot.lon.toFixed(5)} · ${tr.pilot.type}${tr.pilot.operatorId ? ` · ${tr.pilot.operatorId}` : ''}`] : null,
      tr.pilot ? ['Pilot distance', `${fmtKm(tr.pilot.distanceToDroneM)} to the drone · ${fmtKm(tr.pilot.distanceToSiteM)} from the site${tr.pilot.inside ? ' — INSIDE the boundary (insider risk)' : ''}`] : null,
      Number.isFinite(tr.lat) ? ['Position', `${tr.lat.toFixed(4)}, ${tr.lon.toFixed(4)}`] : ['Position', 'not broadcast'],
      ['Last update', tr.seenAt ? ago(tr.seenAt) : '—'],
      ['Data', tr.simulated ? 'SIMULATED (demo scenario)' : tr.kind === 'drone' ? 'Gate sensor (Remote ID)' : data?.replay ? 'Recorded ADS-B (replay)' : `ADS-B via ${data?.source ?? '—'}`],
    ].filter(Boolean);
    const dl = el('dl', { className: 'kv' });
    for (const [k, v] of rows) dl.append(el('dt', { text: k }), el('dd', { text: v }));
    const back = el('button', { className: 'btn btn-ghost btn-sm', text: '← All tracks', attrs: { type: 'button' } });
    back.addEventListener('click', () => {
      selected = null;
      renderSide();
    });
    return [
      el('div', { className: 'radar-device' }, [
        el('span', { className: `sky-row-icon big lv-${tr.level}${tr.simulated ? ' sim' : ''}` }, [icon(tr.kind === 'drone' ? 'drone' : 'plane', { size: 24 })]),
        el('div', {}, [el('strong', { text: nameOf(tr) }), el('div', {}, [levelPill(tr)])]),
        tr.simulated ? el('span', { className: 'badge badge-sim', text: 'SIMULATED' }) : null,
      ]),
      dl,
      back,
    ];
  }

  // ------------------------------------------------------------------ drawing (radar)
  let geo = { cx: 0, cy: 0, R: 1, W: 0, H: 0 };
  const scale = () => geo.R / (zoomKm * 1000); // px per metre
  function proj(lat, lon) {
    const p = toLocal(data.site, { lat, lon });
    const k = scale();
    return { x: geo.cx + p.e * k, y: geo.cy - p.n * k };
  }
  /**
   * Real aircraft keep moving along their track between feed updates (dead reckoning). The feed
   * polls every 90–180 s to stay within the provider's daily limit, so the extrapolation covers one
   * full interval plus a margin (at most 4 minutes), instead of freezing after 15 s.
   */
  const deadReckonSec = () => Math.min(240, Math.max(15, (data?.pollSec ?? 10) * 1.3));
  function nowPos(tr) {
    if (tr.simulated || tr.onGround || !Number.isFinite(tr.speedKt) || !Number.isFinite(tr.track)) return proj(tr.lat, tr.lon);
    const dt = Math.min(deadReckonSec(), Math.max(0, (Date.now() - (tr.seenAt ?? Date.now())) / 1000));
    const d = tr.speedKt * KT * dt;
    const b = (tr.track * Math.PI) / 180;
    const p = proj(tr.lat, tr.lon);
    return { x: p.x + d * Math.sin(b) * scale(), y: p.y - d * Math.cos(b) * scale() };
  }

  function line(ctx, pts) {
    ctx.beginPath();
    pts.forEach(([la, lo], i) => {
      const p = proj(la, lo);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
  }

  // Labels are collected while drawing and placed together at the end (src/ui/labelPlacer.js):
  // the most important first, never overlapping each other, the icons or the overlays.
  let labelReqs = [];
  let obstacles = [];
  const FONT = { ring: '700 11.5px system-ui, sans-serif', field: '600 11.5px system-ui, sans-serif', road: '10.5px system-ui, sans-serif', title: '700 12.5px system-ui, sans-serif', line: '600 11.5px system-ui, sans-serif' };

  /** A label box: lines [{ text, color, font }]; border colour; optional anchor for a leader line. */
  function boxRequest(ctx, { id, priority, lines, border = null, bg = 'rgba(6,10,18,0.86)', alpha = 1, anchor = null, cands }) {
    const w = Math.ceil(Math.max(...lines.map((l) => ((ctx.font = l.font ?? FONT.line), ctx.measureText(l.text).width)))) + 12;
    const h = lines.length * 15 + 4;
    labelReqs.push({
      id,
      priority,
      w,
      h,
      cands: typeof cands === 'function' ? cands(w, h) : cands,
      draw(box) {
        ctx.globalAlpha = alpha;
        if (anchor) {
          const lx = Math.max(box[0], Math.min(anchor.x, box[0] + w));
          const ly = Math.max(box[1], Math.min(anchor.y, box[1] + h));
          if (Math.hypot(lx - anchor.x, ly - anchor.y) > 20) {
            ctx.strokeStyle = 'rgba(226,232,240,0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(anchor.x, anchor.y);
            ctx.lineTo(lx, ly);
            ctx.stroke();
          }
        }
        if (bg) {
          ctx.fillStyle = bg;
          roundRect(ctx, box[0], box[1], w, h, 5);
          ctx.fill();
          if (border) {
            ctx.strokeStyle = border;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        ctx.textAlign = 'left';
        lines.forEach((l, i) => {
          ctx.font = l.font ?? FONT.line;
          ctx.fillStyle = l.color;
          ctx.fillText(l.text, box[0] + 6, box[1] + 14 + i * 15);
        });
        ctx.globalAlpha = 1;
      },
    });
  }

  /** The HTML overlays on the stage (chips, zoom, caption, HUD) are no-go areas for labels. */
  function overlayObstacles() {
    const s = stage.getBoundingClientRect();
    const out = [];
    for (const n of stage.querySelectorAll('.radar-hud, .sky-chips, .sky-zoom, .sky-caption, .sky-empty')) {
      if (n.hidden || !n.offsetWidth) continue;
      const r = n.getBoundingClientRect();
      out.push([r.left - s.left - 4, r.top - s.top - 4, r.width + 8, r.height + 8]);
    }
    return out;
  }

  function drawBackdrop(ctx) {
    // City
    line(ctx, CITY_OUTLINE);
    ctx.closePath();
    ctx.fillStyle = 'rgba(148,163,184,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Highways (names only when zoomed in, and only where they fit)
    for (const r of ROADS) {
      line(ctx, r.pts);
      ctx.strokeStyle = 'rgba(203,213,225,0.20)';
      ctx.lineWidth = zoomKm <= 15 ? 2 : 1.2;
      ctx.stroke();
      if (zoomKm <= 15) {
        const m = proj(...r.pts[Math.floor(r.pts.length / 2)]);
        boxRequest(ctx, { id: `road|${r.name}`, priority: 9, bg: null, lines: [{ text: r.name, color: 'rgba(203,213,225,0.5)', font: FONT.road }], cands: (w, h) => [[m.x - w / 2, m.y - h - 2], [m.x - w / 2, m.y + 2], [m.x + 6, m.y - h / 2]] });
      }
    }
    // Airport corridors (expected traffic)
    for (const c of data.corridors ?? []) {
      const [A, B] = c.ends.map(([la, lo]) => ({ lat: la, lon: lo }));
      const a = proj(A.lat, A.lon);
      const b = proj(B.lat, B.lon);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const ext = c.lengthM * scale();
      const w0 = c.halfWidthM * scale();
      const w1 = (c.halfWidthM + c.lengthM * 0.08) * scale();
      ctx.beginPath();
      for (const [px, py, sgn] of [[a.x, a.y, -1], [b.x, b.y, 1]]) {
        const ex = px + ux * ext * sgn;
        const ey = py + uy * ext * sgn;
        ctx.moveTo(px - uy * w0, py + ux * w0);
        ctx.lineTo(ex - uy * w1, ey + ux * w1);
        ctx.lineTo(ex + uy * w1, ey - ux * w1);
        ctx.lineTo(px + uy * w0, py - ux * w0);
      }
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(134,239,172,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Airfields
    for (const f of AIRFIELDS) {
      const xs = [];
      const ys = [];
      for (const r of f.runways) {
        const a = proj(...r.ends[0]);
        const b = proj(...r.ends[1]);
        ctx.strokeStyle = 'rgba(226,232,240,0.75)';
        ctx.lineWidth = zoomKm >= 50 ? 2.5 : 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.lineCap = 'butt';
        xs.push(a.x, b.x);
        ys.push(a.y, b.y);
      }
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const my = (y0 + y1) / 2;
      const mx = (x0 + x1) / 2;
      boxRequest(ctx, {
        id: `field|${f.code}`,
        priority: 2,
        bg: 'rgba(6,10,18,0.6)',
        lines: [{ text: f.name, color: 'rgba(226,232,240,0.9)', font: FONT.field }],
        cands: (w, h) => [[x1 + 8, my - h / 2], [x0 - 8 - w, my - h / 2], [mx - w / 2, y0 - 6 - h], [mx - w / 2, y1 + 6], [x1 + 8, y0 - h], [x1 + 8, y1]],
      });
    }
  }

  function drawZones(ctx, t) {
    const z = data.zones;
    const k = scale();
    const { cx, cy } = geo;
    const intrusion = data.list.some((x) => x.restricted && x.kind === 'aircraft');
    // MONITOR
    ctx.strokeStyle = 'rgba(148,163,184,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, z.monitorM * k, 0, Math.PI * 2);
    ctx.stroke();
    // WARNING
    ctx.strokeStyle = 'rgba(251,191,36,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, z.warningM * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // RESTRICTED (filled)
    const p = reduce || !intrusion ? 0 : (Math.sin(t / 260) + 1) / 2;
    ctx.fillStyle = `rgba(248,113,113,${intrusion ? 0.16 + 0.1 * p : 0.12})`;
    ctx.beginPath();
    ctx.arc(cx, cy, z.restrictedM * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ring labels sit ON their ring, bottom-right first, then the other free sides.
    for (const [id, r, text, color] of [
      ['ring|restricted', z.restrictedM * k, `RESTRICTED ${z.restrictedM / 1000} km · below ${z.ceilingFt.toLocaleString('en-US')} ft`, '#fca5a5'],
      ['ring|warning', z.warningM * k, `WARNING ${z.warningM / 1000} km`, '#fbbf24'],
      ['ring|monitor', z.monitorM * k, `MONITOR ${z.monitorM / 1000} km`, '#cbd5e1'],
    ]) {
      boxRequest(ctx, { id, priority: 1, bg: 'rgba(6,10,18,0.82)', lines: [{ text, color, font: FONT.ring }], cands: (w, h) => ringCandidates(cx, cy, r, w, h) });
    }
  }

  /** GPS interference area estimated from aircraft whose GPS integrity collapsed (real and demo). */
  function drawGnss(ctx) {
    for (const [kind, g] of Object.entries(data.gnss ?? {})) {
      if (!g || !g.centre || !['jamming', 'degraded'].includes(g.level)) continue;
      const c = proj(g.centre.lat, g.centre.lon);
      const r = g.radiusM * scale();
      const sim = kind === 'sim';
      const color = sim ? SIM : g.level === 'jamming' ? '#fb923c' : '#fbbf24';
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 2;
      for (let x = c.x - r; x < c.x + r; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, c.y - r);
        ctx.lineTo(x + 2 * r, c.y + r);
        ctx.stroke();
      }
      ctx.restore();
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      boxRequest(ctx, {
        id: `gnss|${kind}`,
        priority: 1.5,
        border: color,
        lines: [
          { text: `${g.level === 'jamming' ? 'GPS JAMMING?' : 'GPS DEGRADED'}${sim ? '  SIM' : ''}`, color, font: FONT.title },
          { text: `${g.bad} of ${g.total} aircraft · area estimated`, color: '#e2e8f0' },
        ],
        cands: (w, h) => ringCandidates(c.x, c.y, r, w, h),
      });
    }
  }

  function drawFrame(ctx) {
    const { cx, cy, H } = geo;
    // North
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 26, 70);
    ctx.beginPath();
    ctx.moveTo(26, 40);
    ctx.lineTo(20, 56);
    ctx.lineTo(32, 56);
    ctx.closePath();
    ctx.fill();
    obstacles.push([14, 36, 26, 40]);
    // Scale bar
    const k = scale();
    const nice = [0.5, 1, 2, 5, 10, 20].find((km) => km * 1000 * k >= 70) ?? 20;
    const len = nice * 1000 * k;
    const x0 = 18;
    const y0 = H - 22;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 5);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + len, y0);
    ctx.lineTo(x0 + len, y0 - 5);
    ctx.stroke();
    ctx.font = '11.5px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${nice} km`, x0 + len + 6, y0 + 1);
    obstacles.push([x0 - 4, y0 - 12, len + 60, 18]);
    // Site
    ctx.fillStyle = '#0f3d38';
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    obstacles.push([cx - 10, cy - 10, 20, 20]);
    boxRequest(ctx, { id: 'site', priority: 0.5, bg: 'rgba(6,10,18,0.7)', lines: [{ text: 'SITE', color: '#99f6e4', font: '700 11px system-ui, sans-serif' }], cands: (w, h) => aroundCandidates(cx, cy, w, h, [14, 30]) });
  }

  /** The drone's pilot (Remote ID operator position): person icon, dashed line, distances. */
  function drawPilot(ctx, p, demoOn) {
    const { tr } = p;
    const pl = tr.pilot;
    if (!pl || !Number.isFinite(pl.lat)) return null;
    const q = proj(pl.lat, pl.lon);
    const color = tr.simulated ? SIM : pl.inside ? '#f87171' : '#fbbf24';
    ctx.globalAlpha = demoOn && !tr.simulated ? 0.3 : 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(6,10,18,0.92)';
    ctx.beginPath();
    ctx.arc(q.x, q.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pl.inside ? '#f87171' : color;
    ctx.lineWidth = pl.inside ? 3 : 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(q.x - 8, q.y - 8);
    ctx.scale(16 / 24, 16 / 24);
    ctx.strokeStyle = tr.simulated ? '#e9d5ff' : '#f8fafc';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.stroke(pathFor('person'));
    ctx.restore();
    ctx.globalAlpha = 1;
    obstacles.push([q.x - 12, q.y - 12, 24, 24]);
    const m = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${v} m`);
    boxRequest(ctx, {
      id: `pilot|${tr.hex}`,
      priority: pl.inside ? 2.9 : 3.6,
      border: pl.inside ? '#f87171' : color,
      alpha: demoOn && !tr.simulated ? 0.45 : 1,
      anchor: q,
      lines: [
        { text: `PILOT${tr.simulated ? '  SIM' : ''} · ${pl.type}`, color: tr.simulated ? '#e9d5ff' : '#f1f5f9', font: FONT.title },
        { text: `${Number.isFinite(pl.distanceToDroneM) ? m(pl.distanceToDroneM) : '?'} to drone · ${Number.isFinite(pl.distanceToSiteM) ? m(pl.distanceToSiteM) : '?'} from site`, color: '#cbd5e1' },
        ...(pl.inside ? [{ text: 'INSIDE SITE BOUNDARY — INSIDER RISK', color: '#fca5a5' }] : []),
      ],
      cands: (w, h) => aroundCandidates(q.x, q.y, w, h, [16, 44, 76]),
    });
    return { tr, x: q.x, y: q.y };
  }

  function drawTracks(ctx, t) {
    const demoOn = data.demo && data.demo.status !== 'idle';
    const list = data.list.filter((tr) => Number.isFinite(tr.lat) && Number.isFinite(tr.lon));
    const pos = list.map((tr) => ({ tr, ...nowPos(tr) }));
    const visible = (p) => p.x > -40 && p.x < geo.W + 40 && p.y > -40 && p.y < geo.H + 40;
    // Trails and predictions first (under the icons).
    for (const p of pos) {
      if (!visible(p)) continue;
      const { tr } = p;
      const color = tr.simulated ? SIM : LV[tr.level];
      const trail = tr.trail ?? [];
      for (let i = 1; i < trail.length; i++) {
        const a = proj(trail[i - 1][0], trail[i - 1][1]);
        const b = proj(trail[i][0], trail[i][1]);
        if (Math.hypot(b.x - a.x, b.y - a.y) > geo.R) continue; // a spoofed jump is not a path
        ctx.strokeStyle = color;
        ctx.globalAlpha = (demoOn && !tr.simulated ? 0.3 : 1) * (0.1 + (0.5 * i) / trail.length);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = demoOn && !tr.simulated ? 0.3 : 0.85;
      const end = tr.projection?.at(-1);
      if (end && tr.projection.length > 1) {
        const e = proj(end[0], end[1]);
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (tr.timeToZoneSec > 0 && Number.isFinite(tr.speedKt)) {
          const d = tr.speedKt * KT * tr.timeToZoneSec * scale();
          const b = (tr.track * Math.PI) / 180;
          const ex = p.x + d * Math.sin(b);
          const ey = p.y - d * Math.cos(b);
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex - 5, ey - 5);
          ctx.lineTo(ex + 5, ey + 5);
          ctx.moveTo(ex + 5, ey - 5);
          ctx.lineTo(ex - 5, ey + 5);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    // Pilots, then icons (least important first so threats sit on top).
    const order = [...pos].filter(visible).sort((a, b) => rank(b.tr) - rank(a.tr));
    const pilots = order.filter((p) => p.tr.kind === 'drone' && p.tr.pilot).map((p) => drawPilot(ctx, p, demoOn)).filter(Boolean);
    for (const p of order) {
      drawIcon(ctx, p, t, demoOn);
      obstacles.push([p.x - 13, p.y - 13, 26, 26]);
    }
    for (const p of order) {
      const { tr } = p;
      const important = tr.hex === selected || tr.hex === hover || tr.simulated || ['critical', 'high', 'warning'].includes(tr.level);
      if (!important && !showAllLabels()) continue;
      const lines = labelLines(tr).map((l, i) => ({ ...l, font: i === 0 ? FONT.title : FONT.line }));
      const priority = tr.hex === selected ? 2.5 : 3 + rank(tr) / 10 + (important ? 0 : 3);
      boxRequest(ctx, {
        id: `track|${tr.hex}`,
        priority,
        lines,
        border: tr.simulated ? SIM : LV[tr.level],
        alpha: demoOn && !tr.simulated ? 0.45 : 1,
        anchor: { x: p.x, y: p.y },
        cands: (w, h) => aroundCandidates(p.x, p.y, w, h, important ? [16, 44, 76, 110] : [16, 34]),
      });
    }
    drawn = [...order, ...pilots];
    // Tracks within 50 km that fall outside the (enlarged) map: an arrow at the edge, never hidden.
    for (const p of pos.filter((q) => !visible(q))) {
      const { tr } = p;
      const b = Math.atan2(p.x - geo.cx, -(p.y - geo.cy));
      const color = tr.simulated ? SIM : LV[tr.level];
      const e = edgeArrow(ctx, { bearing: b, color, alpha: demoOn && !tr.simulated ? 0.3 : 1, size: 1.2 });
      drawn.push({ tr, x: e.x, y: e.y });
      boxRequest(ctx, {
        id: `edge|${tr.hex}`,
        priority: 3 + rank(tr) / 10,
        border: color,
        alpha: demoOn && !tr.simulated ? 0.45 : 1,
        anchor: e,
        lines: [
          { text: `${nameOf(tr)}${tr.simulated ? '  SIM' : ''} · ${fmtKm(tr.distanceM)}`, color: '#f1f5f9', font: FONT.title },
          { text: `${tr.onGround ? 'on the ground' : fmtFt(tr.altitudeFt)} · off the map — zoom out or select`, color: '#94a3b8' },
        ],
        cands: (w, h) => aroundCandidates(e.x, e.y, w, h, [14, 30]),
      });
    }
    drawFar(ctx, demoOn);
  }

  /** A triangle at the edge of the radar pointing along `bearing` (radians from north). */
  function edgeArrow(ctx, { bearing, color, alpha = 0.9, size = 1 }) {
    const m = 26;
    const dx = Math.sin(bearing);
    const dy = -Math.cos(bearing);
    const tx = dx > 1e-6 ? (geo.W - m - geo.cx) / dx : dx < -1e-6 ? (m - geo.cx) / dx : Infinity;
    const ty = dy > 1e-6 ? (geo.H - m - geo.cy) / dy : dy < -1e-6 ? (m - geo.cy) / dy : Infinity;
    const t = Math.min(tx, ty);
    const x = geo.cx + dx * t;
    const y = geo.cy + dy * t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(bearing);
    ctx.scale(size, size);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 6);
    ctx.lineTo(-7, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    obstacles.push([x - 10, y - 10, 20, 20]);
    return { x, y };
  }

  /** Arrows at the edge of the radar towards the nearest aircraft beyond 50 km (information only). */
  function drawFar(ctx, demoOn) {
    for (const a of (data.far?.nearest ?? []).slice(0, 3)) {
      const { x, y } = edgeArrow(ctx, { bearing: (a.bearingDeg * Math.PI) / 180, color: '#94a3b8', alpha: demoOn ? 0.3 : 0.9 });
      boxRequest(ctx, {
        id: `far|${a.hex}`,
        priority: 7,
        border: '#64748b',
        alpha: demoOn ? 0.4 : 1,
        anchor: { x, y },
        lines: [
          { text: `${a.name} · ${Math.round(a.distanceM / 1000)} km ${a.compass}`, color: '#e2e8f0', font: FONT.title },
          { text: `${a.onGround ? 'on the ground' : fmtFt(a.altitudeFt)} · beyond 50 km, not monitored`, color: '#94a3b8' },
        ],
        cands: (w, h) => aroundCandidates(x, y, w, h, [14, 30]),
      });
    }
  }

  // At 50 km few labels fit: normal traffic is labelled only when the picture is not crowded.
  const showAllLabels = () => !(zoomKm >= 50 && (data?.list?.length ?? 0) > 25);
  const rank = (tr) => ({ critical: 0, high: 1, warning: 2, normal: 3, expected: 4 })[tr.level] - (tr.simulated ? 0.5 : 0) - (tr.hex === selected ? 10 : 0);
  const overlap = overlaps;

  function labelLines(tr) {
    const first = { text: `${nameOf(tr)}${tr.simulated ? '  SIM' : ''}`, color: tr.simulated ? '#e9d5ff' : '#f1f5f9' };
    const second = { text: `${tr.onGround ? 'GND' : fmtFt(tr.altitudeFt)} · ${fmtKm(tr.distanceM)}`, color: '#cbd5e1' };
    let third = null;
    if (tr.emergencyInfo) third = { text: `SQUAWK ${tr.emergencyInfo.code} · ${tr.emergencyInfo.name.toUpperCase()}`, color: '#fca5a5' };
    else if (tr.spoof) third = { text: 'GPS SPOOFED?', color: '#fdba74' };
    else if (tr.expected) third = { text: `Expected – ${tr.expected.airport} traffic`, color: '#86efac' };
    else if (tr.restricted && tr.kind === 'aircraft') third = { text: 'IN RESTRICTED ZONE', color: '#fca5a5' };
    else if (tr.loitering) third = { text: 'CIRCLING', color: '#fde68a' };
    else if (tr.level === 'warning' && tr.timeToZoneSec !== null) third = { text: `enters zone in ${fmtMinSec(tr.timeToZoneSec)}`, color: '#fde68a' };
    else if (tr.nav?.status === 'lost') third = { text: 'GPS LOST', color: '#fde68a' };
    else if (tr.kind === 'drone' && tr.pilot?.inside) third = { text: 'PILOT INSIDE SITE', color: '#fca5a5' };
    else if (tr.kind === 'drone' && tr.level !== 'normal') third = { text: tr.level === 'critical' ? (tr.distanceM <= 300 ? 'DRONE OVER SITE' : 'INSIDE PERIMETER') : 'DRONE APPROACHING', color: tr.level === 'critical' ? '#fca5a5' : '#fde68a' };
    return [first, second, third].filter(Boolean);
  }

  function drawIcon(ctx, p, t, demoOn) {
    const { tr, x, y } = p;
    const color = LV[tr.level];
    const fillColor = tr.simulated ? SIM : color;
    ctx.globalAlpha = demoOn && !tr.simulated ? 0.3 : 1;
    if ((tr.level === 'critical' || tr.level === 'high') && !reduce) {
      const k = (t / (tr.level === 'critical' ? 700 : 1000)) % 1;
      ctx.strokeStyle = color;
      ctx.globalAlpha *= 0.9 * (1 - k);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 15 + k * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = demoOn && !tr.simulated ? 0.3 : 1;
    }
    if (tr.kind === 'drone') {
      ctx.fillStyle = 'rgba(6,10,18,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.save();
      ctx.translate(x - 9, y - 9);
      ctx.scale(18 / 24, 18 / 24);
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.stroke(pathFor('drone'));
      ctx.restore();
    } else {
      const size = tr.hex === selected ? 30 : 25;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((tr.track ?? 0) * Math.PI) / 180);
      ctx.scale(size / 24, size / 24);
      ctx.translate(-12, -12);
      ctx.fillStyle = fillColor;
      ctx.fill(pathFor('plane'));
      ctx.strokeStyle = tr.simulated ? '#f5f3ff' : '#06121a';
      ctx.lineWidth = 1.1;
      ctx.stroke(pathFor('plane'));
      ctx.restore();
      if (tr.simulated && tr.level !== 'normal') {
        // simulated = purple; its threat level shows as the ring around it
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (tr.nav?.status === 'lost' || tr.spoof) {
        // GPS trouble: a dashed ring
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = tr.spoof ? '#fb923c' : '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 19, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (tr.hex === selected || tr.hex === hover) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  /** Draws the aircraft view on the radar canvas. */
  function draw(ctx, g, t) {
    // At 50 km the map is enlarged to fill the panel (the 50 km circle runs past the edges) and the
    // site sits a little below centre, so the whole MONITOR ring and RUH (27 km north) stay in view.
    geo = zoomKm >= 50 ? { ...g, cy: g.H * 0.58, R: Math.max(g.R, Math.min(g.W * 0.49, g.H * 0.75)) } : g;
    const bg = ctx.createRadialGradient(g.cx, g.cy, 10, g.cx, g.cy, Math.max(g.W, g.H) * 0.75);
    bg.addColorStop(0, '#0b1622');
    bg.addColorStop(1, '#050910');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, g.W, g.H);
    if (!data) {
      ctx.fillStyle = '#9aabc2';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for the airspace picture…', g.cx, g.cy);
      return;
    }
    labelReqs = [];
    obstacles = overlayObstacles();
    drawBackdrop(ctx);
    drawZones(ctx, t);
    drawGnss(ctx);
    drawFrame(ctx);
    drawTracks(ctx, t);
    const placed = placeLabels(labelReqs, { width: g.W, height: g.H }, obstacles);
    for (const r of labelReqs) if (placed.has(r.id)) r.draw(placed.get(r.id));
    drawProfile();
  }


  // ------------------------------------------------------------------ altitude profile
  function drawProfile() {
    const rect = profile.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = rect.width;
    const H = rect.height;
    if (profile.width !== Math.round(W * dpr) || profile.height !== Math.round(H * dpr)) {
      profile.width = Math.round(W * dpr);
      profile.height = Math.round(H * dpr);
    }
    const ctx = profile.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060b14';
    ctx.fillRect(0, 0, W, H);
    const z = data.zones;
    const elev = z.siteElevationFt ?? 0;
    const top = elev + ({ 5: 6000, 15: 12000, 50: 24000 }[zoomKm] ?? 12000);
    const L = 58;
    const R = W - 14;
    const T = 12;
    const B = H - 24;
    const X = (m) => L + (Math.min(m, zoomKm * 1000) / (zoomKm * 1000)) * (R - L);
    const Y = (ft) => B - ((Math.min(ft, top) - Math.min(elev, 0)) / (top - Math.min(elev, 0))) * (B - T);
    // grid
    ctx.font = '11px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'right';
    const stepFt = top > 15000 ? 5000 : top > 7000 ? 2000 : 1000;
    for (let f = 0; f <= top; f += stepFt) {
      ctx.strokeStyle = 'rgba(148,163,184,0.12)';
      ctx.beginPath();
      ctx.moveTo(L, Y(f));
      ctx.lineTo(R, Y(f));
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${f.toLocaleString('en-US')}`, L - 6, Y(f) + 4);
    }
    ctx.textAlign = 'center';
    for (const km of [0, zoomKm / 5, (2 * zoomKm) / 5, (3 * zoomKm) / 5, (4 * zoomKm) / 5, zoomKm]) ctx.fillText(`${km} km`, X(km * 1000), H - 7);
    // ground
    ctx.fillStyle = 'rgba(120,113,108,0.35)';
    ctx.fillRect(L, Y(elev), R - L, B - Y(elev) + 1);
    // zones
    ctx.fillStyle = 'rgba(248,113,113,0.22)';
    ctx.fillRect(L, Y(elev + z.ceilingFt), X(z.restrictedM) - L, Y(elev) - Y(elev + z.ceilingFt));
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    ctx.strokeRect(L, Y(elev + z.ceilingFt), X(z.restrictedM) - L, Y(elev) - Y(elev + z.ceilingFt));
    ctx.fillStyle = '#fca5a5';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`RESTRICTED < ${z.ceilingFt.toLocaleString('en-US')} ft`, L + 6, Y(elev + z.ceilingFt) - 5);
    for (const [m, color, label] of [[z.warningM, '#fbbf24', 'WARNING'], [z.monitorM, '#94a3b8', 'MONITOR']]) {
      if (m > zoomKm * 1000) continue;
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(X(m), T);
      ctx.lineTo(X(m), B);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.fillText(label, X(m) + 4, T + 10);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('ft', 6, T + 2);
    // tracks
    const demoOn = data.demo && data.demo.status !== 'idle';
    ctx.font = '700 11px system-ui, sans-serif';
    const placed = [[L + 4, Y(elev + z.ceilingFt) - 16, ctx.measureText(`RESTRICTED < ${z.ceilingFt.toLocaleString('en-US')} ft`).width + 6, 14]];
    const list = data.list.filter((tr) => Number.isFinite(tr.distanceM) && Number.isFinite(tr.altitudeFt) && tr.distanceM <= zoomKm * 1000 * 1.02);
    for (const tr of [...list].sort((a, b) => rank(b) - rank(a))) {
      const color = tr.simulated ? SIM : LV[tr.level];
      const x = X(tr.distanceM);
      const y = Y(tr.altitudeFt);
      ctx.globalAlpha = demoOn && !tr.simulated ? 0.3 : 1;
      const end = tr.projection?.at(-1);
      if (end && tr.projection.length > 1 && Number.isFinite(end[2])) {
        const p = toLocal(data.site, { lat: end[0], lon: end[1] });
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(X(Math.hypot(p.e, p.n)), Y(end[2]));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      if (tr.kind === 'drone') ctx.rect(x - 5, y - 5, 10, 10);
      else ctx.arc(x, y, tr.hex === selected ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tr.simulated ? LV[tr.level] : '#06121a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (tr.altitudeFt > top) {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`↑${Math.round(tr.altitudeFt / 1000)}k`, x + 8, y + 12);
      }
      const text = nameOf(tr);
      ctx.font = '600 11px system-ui, sans-serif';
      const w = ctx.measureText(text).width;
      // Stack labels upwards when dots share a spot (drones over the site); skip if no room.
      for (let k = 0; k < 4; k++) {
        const r = [x + 8, y - 16 - k * 14, w + 4, 13];
        if (r[1] < T - 4 || placed.some((q) => overlap(q, r))) continue;
        placed.push(r);
        ctx.fillStyle = tr.simulated ? '#e9d5ff' : '#e2e8f0';
        ctx.textAlign = 'left';
        ctx.fillText(text, x + 9, r[1] + 10);
        if (k) {
          ctx.strokeStyle = 'rgba(226,232,240,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 3, y - 3);
          ctx.lineTo(x + 8, r[1] + 7);
          ctx.stroke();
        }
        break;
      }
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ pointer
  function hit(px, py) {
    let best = null;
    let bd = 20;
    for (const p of drawn) {
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < bd) {
        bd = d;
        best = p.tr;
      }
    }
    return best;
  }

  return {
    draw,
    setData,
    setSpace: (msg) => space.setData(msg),
    /** Site and zone radii of the latest live message (the History map uses the same rings). */
    context: () => ({ site: data?.site ?? null, zones: data?.zones ?? null }),
    /** Shows / hides the parts of the view that live outside the canvas. */
    show(on) {
      for (const o of overlays) o.hidden = !on || (o === caption && !(data?.demo?.status && data.demo.status !== 'idle' && data.demo.caption));
      if (on) renderStatus();
      renderEmpty();
      profileHost.hidden = !on;
      space.show(on);
      demoHost.hidden = !on;
      if (on) {
        lastSideSig = '';
        renderSide();
      } else if (presenter) setPresenter(false);
    },
    pointerMove(px, py) {
      const tr = hit(px, py);
      hover = tr?.hex ?? null;
      if (!tr) return null;
      return `${nameOf(tr)}${tr.simulated ? ' (SIMULATED)' : ''} · ${tr.onGround ? 'ground' : fmtFt(tr.altitudeFt)} · ${fmtKm(tr.distanceM)} · ${tr.expected ? `Expected – ${tr.expected.airport} traffic` : LEVEL_LABEL[tr.level]} — ${tr.reason}`;
    },
    pointerLeave() {
      hover = null;
    },
    click(px, py) {
      selected = hit(px, py)?.hex ?? null;
      lastSideSig = '';
      renderSide();
    },
    select(hex) {
      selected = hex;
      lastSideSig = '';
      renderSide();
    },
    renderSide: () => {
      lastSideSig = '';
      renderSide();
    },
    hudChips(chip) {
      const list = data?.list ?? [];
      const n = (f) => list.filter(f).length;
      return [
        chip('aircraft', n((t) => t.kind === 'aircraft' && !t.simulated), 'info'),
        chip('drones', n((t) => t.kind === 'drone' && !t.simulated), 'info'),
        chip('critical', n((t) => t.level === 'critical'), n((t) => t.level === 'critical') ? 'crit' : 'good'),
        chip('high', n((t) => t.level === 'high'), n((t) => t.level === 'high') ? 'crit' : 'good'),
        chip('warning', n((t) => t.level === 'warning'), n((t) => t.level === 'warning') ? 'warn' : 'good'),
      ];
    },
    get data() {
      return data;
    },
    get presenter() {
      return presenter;
    },
  };
}
