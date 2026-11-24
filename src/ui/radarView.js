// Airspace live view: a top-down radar of the gate. The ESP32 sensor sits in the middle of the
// checkpoint lane, the console PC is linked to it, and every device heard in the last minute is
// a token whose distance from the centre is estimated from its smoothed signal.
// One sensor measures signal strength only, not direction: the angle of a token is a stable
// placement derived from its address, and the view says so.
//
// The simulation machinery below is retained for controlled exercises, but it is deliberately
// not exposed in this operations view. Airspace is for live monitoring and investigation.
import { PATHS, TYPE_ICON, icon } from './icons.js';
import { el } from './dom.js';
import { DEMO_SENSOR, makeDrillRound } from '../demo/demoScenarios.js';
import { createSkyView } from './skyView.js';
import { createHistoryView } from './historyView.js';

export const RSSI_1M = { 'Wi-Fi': -45, BLE: -55 }; // ESP32 PCB antenna, indoors, phone-class transmitter
const PATH_LOSS_N = 3;
const MAX_D = 30;
const RINGS = [1, 3, 8, 20];

/** Log-distance path-loss estimate in metres (rough: walls and bodies shift it a lot). */
export function distanceFromRssi(rssi, protocol) {
  if (!Number.isFinite(rssi)) return null;
  return Math.min(60, Math.max(0.3, 10 ** (((RSSI_1M[protocol] ?? -45) - rssi) / (10 * PATH_LOSS_N))));
}
export const rssiAtDistance = (d, protocol) => (RSSI_1M[protocol] ?? -45) - 10 * PATH_LOSS_N * Math.log10(Math.max(0.3, d));

const STATUS_TEXT = { AUTHORIZED: 'Authorized', UNKNOWN: 'Unknown', VERIFIED_UNAUTHORIZED: 'Unauthorized' };
const STATUS_GLYPH = { AUTHORIZED: '✓', UNKNOWN: '?', VERIFIED_UNAUTHORIZED: '!' };

function hashAngle(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  // Keep tokens out of the visitor lane (straight below / above the gate).
  const a = ((h >>> 0) / 4294967296) * Math.PI * 2;
  const lane = 0.22;
  const below = Math.PI / 2;
  const above = -Math.PI / 2 + Math.PI * 2;
  for (const c of [below, above, above - Math.PI * 2]) if (Math.abs(a - c) < lane) return c + (a < c ? -lane : lane);
  return a;
}

const pathCache = new Map();
const pathFor = (name) => {
  if (!pathCache.has(name)) pathCache.set(name, new Path2D(PATHS[name] ?? PATHS.device));
  return pathCache.get(name);
};

function drawIcon(ctx, name, x, y, size, color, width = 1.8) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = (width * 24) / size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(pathFor(name));
  ctx.restore();
}

export function createRadar(root, { onAction = () => {}, statusOf = () => null, ingestDemo = () => {}, setDemo = () => {}, isDemo = () => false, incidents = () => [], voice = null } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const C = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const COL = {
    good: C('--good-ink', '#4ade80'),
    warn: C('--warning-ink', '#fbbf24'),
    crit: C('--critical-ink', '#f87171'),
    accent: C('--accent', '#2dd4bf'),
    text: C('--text', '#e6edf6'),
    muted: C('--muted', '#9aabc2'),
    line: C('--line', '#223047'),
    panel: C('--panel-2', '#0e1520'),
  };
  const statusColor = (s) => (s === 'AUTHORIZED' ? COL.good : s === 'VERIFIED_UNAUTHORIZED' ? COL.crit : s === 'UNKNOWN' ? COL.warn : COL.muted);

  // ------------------------------------------------------------------ DOM
  const canvas = el('canvas', { className: 'radar-canvas', attrs: { role: 'img', 'aria-label': 'Airspace radar: devices around the gate sensor' } });
  const tip = el('div', { className: 'radar-tip', attrs: { hidden: '' } });
  const hud = el('div', { className: 'radar-hud' });
  const stage = el('div', { className: 'radar-stage' }, [canvas, hud, tip]);
  const profileHost = el('div', { className: 'sky-profile', attrs: { hidden: '' } });
  const demoHost = el('div', { className: 'sky-demo-host', attrs: { hidden: '' } });
  const side = el('aside', { className: 'radar-side', attrs: { 'aria-live': 'polite' } });
  const modeLive = el('button', { className: 'btn btn-sm', text: 'Devices', attrs: { type: 'button', 'aria-pressed': 'true' } });
  const modeSky = el('button', { className: 'btn btn-sm', attrs: { type: 'button', 'aria-pressed': 'false', title: 'Real aircraft around the site (ADS-B) and the restricted airspace' } }, [icon('plane', { size: 14 }), document.createTextNode('Aircraft (ADS-B)')]);
  const modeHist = el('button', { className: 'btn btn-sm', attrs: { type: 'button', 'aria-pressed': 'false', title: 'Aircraft that came within 50 km (30 days) and past satellite passes, with replay' } }, [icon('history', { size: 14 }), document.createTextNode('History')]);
  // Kept detached so an explicitly invoked controlled exercise can still use its state machine,
  // without making a drill launcher part of the live Airspace console.
  const modeDrill = el('button', { className: 'btn btn-sm', attrs: { type: 'button', 'aria-pressed': 'false' } });
  const gateOnly = el('input', { attrs: { type: 'checkbox' } });
  const showRandom = el('input', { attrs: { type: 'checkbox', checked: '' } });
  // Labels are opt-in: a crowded gate stays readable while markers retain their
  // status colour, type icon, and selected-device detail.
  const showLabels = el('input', { attrs: { type: 'checkbox' } });
  const gateOnlyControl = el('label', { className: 'switch' }, [gateOnly, document.createTextNode('At gate only')]);
  const viewOptions = el('details', { className: 'radar-options' }, [
    el('summary', { text: 'View options' }),
    el('div', { className: 'radar-options-body' }, [
      el('label', { className: 'switch', attrs: { title: 'Show devices using a rotating Wi-Fi or Bluetooth address' } }, [showRandom, document.createTextNode('Show rotating IDs')]),
      el('label', { className: 'switch' }, [showLabels, document.createTextNode('Show labels')]),
    ]),
  ]);
  const liveControls = [gateOnlyControl, viewOptions];
  const GATE_NOTE = 'Distance is estimated; direction is not measured.';
  const SKY_NOTE = 'North up · true scale · aircraft (ADS-B) and drones (Remote ID) · dashed line = next 2 minutes';
  const note = el('span', { className: 'radar-note', text: GATE_NOTE });
  const toolbar = el('div', { className: 'radar-toolbar' }, [
    el('div', { className: 'seg', attrs: { role: 'group', 'aria-label': 'Radar mode' } }, [modeLive, modeSky, modeHist]),
    ...liveControls,
    note,
  ]);
  // The demo player remains constructed for controlled-exercise plumbing, but is not attached
  // to the live operations DOM. It must not compete with real monitoring controls.
  const radarBox = el('div', { className: 'radar' }, [el('div', { className: 'radar-col' }, [stage, profileHost]), side]);
  const histHost = el('div', { className: 'hist-host', attrs: { hidden: '' } });
  root.replaceChildren(toolbar, radarBox, histHost);

  // ------------------------------------------------------------------ state
  let mode = 'live';
  let site = { zoneRssi: -65, zoneRssiBle: -72, mode: 'monitor' };
  let link = { usb: false, wifi: false };
  let sensor = null;
  const tokens = new Map(); // key -> token
  const packets = [];
  let selectedKey = null;
  let hoverKey = null;
  let W = 0;
  let H = 0;
  let geo = { cx: 0, cy: 0, R: 1 };

  const radiusFor = (d) => geo.R * (Math.log1p(d) / Math.log1p(MAX_D));
  const metersAt = (r) => Math.expm1((r / geo.R) * Math.log1p(MAX_D));

  function resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(300, rect.width);
    H = Math.max(360, rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    geo = { cx: W / 2, cy: H * 0.5, R: Math.min(W * 0.44, H * 0.44) };
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Aircraft view (src/ui/skyView.js): its own drawing, side panel, profile and demo player.
  const sky = createSkyView({
    host: root,
    stage,
    profileHost,
    demoHost,
    side,
    onAction: (action, payload) => onAction(action, payload),
    incidents,
    voice,
    isActive: () => mode === 'sky' && root.getClientRects().length > 0, // offsetParent is null in (fixed) presenter mode
  });
  // Aircraft-source chips and kilometre range controls belong to Aircraft mode.
  // Hide them explicitly when the Gate A device picture is first rendered.
  sky.show(false);
  // History (src/ui/historyView.js): replaces the radar while selected.
  let history = null;

  // ------------------------------------------------------------------ live data
  /** devices: [{ key, identifier, protocol, status, signal, name, vendor, type, stable, observations, lastSeen, atGate, reason, ownerName }] */
  function update(next) {
    site = next.site ?? site;
    link = next.link ?? link;
    sensor = next.sensor ?? sensor;
    const seen = new Set();
    const t = performance.now();
    for (const d of next.devices ?? []) {
      seen.add(d.key);
      const dist = distanceFromRssi(d.signal, d.protocol) ?? MAX_D;
      let tok = tokens.get(d.key);
      if (!tok) {
        tok = { key: d.key, angle: hashAngle(d.key), r: radiusFor(MAX_D), born: t, obs: d.observations };
        tokens.set(d.key, tok);
      } else if (d.observations > tok.obs && !reduce) {
        packets.push({ from: tok, t0: t, color: statusColor(d.status) });
      }
      Object.assign(tok, d, { dist, targetR: radiusFor(dist), obs: d.observations, gone: false });
    }
    for (const [k, tok] of tokens) if (!seen.has(k)) tok.gone = true;
    if (next.reading && !reduce) packets.push({ toPc: true, t0: t, color: COL.accent });
    if (packets.length > 120) packets.splice(0, packets.length - 120);
    renderHud();
    if (mode === 'live') renderSide();
  }

  const visible = (tok) => !tok.gone && (!gateOnly.checked || tok.atGate) && (showRandom.checked || tok.stable);

  function renderHud() {
    const list = [...tokens.values()].filter((t) => !t.gone);
    const count = (s) => list.filter((t) => t.status === s).length;
    const gate = list.filter((t) => t.atGate).length;
    const chip = (label, value, tone) => el('span', { className: `hud-chip hud-${tone}` }, [el('b', { text: String(value) }), document.createTextNode(` ${label}`)]);
    if (mode === 'drill') {
      hud.replaceChildren(chip('visitor', drill ? `${Math.min(drill.index + 1, drill.visitors.length)}/${drill.visitors.length}` : '—', 'info'), chip('points', drill?.score ?? 0, 'good'), chip('streak', drill?.streak ?? 0, 'warn'));
      return;
    }
    if (mode === 'sky') {
      hud.replaceChildren(...sky.hudChips(chip));
      return;
    }
    hud.replaceChildren(
      ...[
        chip('observed', list.length, 'info'),
        chip('at the gate', gate, 'warn'),
        chip('need review', count('UNKNOWN'), 'warn'),
        chip('unauthorized', count('VERIFIED_UNAUTHORIZED'), 'crit'),
      ].filter(Boolean),
    );
  }

  // ------------------------------------------------------------------ side panel (live)
  let lastSideKey = '';
  function renderSide() {
    const tok = selectedKey ? tokens.get(selectedKey) : null;
    const confidenceKey = tok?.confidence ? [tok.confidence.type.pct, tok.confidence.identity.pct, tok.confidence.distance.pct, tok.confidence.family?.pct ?? '', tok.confidence.os.pct].join('|') : '';
    const sig = tok ? `${tok.key}|${tok.status}|${Math.round(tok.signal ?? 0)}|${tok.atGate}|${tok.name}|${tok.typeLabel}|${tok.identifier}|${tok.reason}|${tok.ownerName}|${confidenceKey}` : 'none';
    if (sig === lastSideKey) return;
    lastSideKey = sig;
    if (!tok) {
      side.replaceChildren(
        el('h3', {}, [icon('target', { size: 16 }), document.createTextNode(' Select a device')]),
        el('p', { className: 'hint', text: 'Select a marker to see its status, location estimate, and the next review step.' }),
        legend(),
      );
      return;
    }
    const rows = [
      ['Status', STATUS_TEXT[tok.status] ?? tok.status],
      tok.confidence?.family ? ['Observed family', `${tok.confidence.family.pct}% — ${tok.confidence.family.reason}`] : null,
      ['Classification evidence', tok.confidence ? `${tok.confidence.type.pct}% — ${tok.confidence.type.reason}` : '—'],
      ['Identity continuity', tok.confidence ? `${tok.confidence.identity.pct}% — ${tok.confidence.identity.reason}` : '—'],
      ['Signal consistency', tok.confidence ? `${tok.confidence.distance.pct}% — ${tok.confidence.distance.reason}` : '—'],
      ['OS-family evidence', tok.confidence ? `${tok.confidence.os.pct}% — ${tok.confidence.os.reason}` : '—'],
      ['Address', `${tok.identifier}${tok.stable ? '' : ' (randomized)'}`],
      ['Protocol', tok.protocol === 'BLE' ? 'Bluetooth LE' : 'Wi-Fi'],
      ['Signal', Number.isFinite(tok.signal) ? `${Math.round(tok.signal)} dBm · ≈ ${tok.dist < 10 ? tok.dist.toFixed(1) : Math.round(tok.dist)} m` : '—'],
      ['At the gate', tok.atGate ? 'Yes — inside the gate zone' : 'No'],
      ['Vendor', tok.vendor ?? '—'],
      ['Owner', tok.ownerName ?? '—'],
      ['Why', tok.reason ?? '—'],
    ].filter(Boolean);
    const dl = el('dl', { className: 'kv' });
    for (const [k, v] of rows) dl.append(el('dt', { text: k }), el('dd', { text: v }));
    const act = (label, action, cls, iconName) =>
      el('button', { className: `btn btn-sm ${cls}`, attrs: { type: 'button', 'data-action': action, 'data-key': tok.key } }, [icon(iconName, { size: 14 }), document.createTextNode(label)]);
    // The radar is an investigative surface. It can hand a sighting to Device
    // Registry, but never makes an authorization decision in place.
    const actions = el('div', { className: 'row wrap' }, [
      act('Review in Device Registry', 'review-registry', '', 'registry'),
    ]);
    actions.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-action]');
      if (b && !b.classList.contains('locked')) onAction(b.dataset.action, b.dataset.key);
    });
    const fact = (label, value) => el('div', {}, [el('dt', { text: label }), el('dd', { text: value })]);
    const distance = Number.isFinite(tok.signal)
      ? `${Math.round(tok.signal)} dBm, estimated ${tok.dist < 10 ? tok.dist.toFixed(1) : Math.round(tok.dist)} m`
      : 'Not available';
    const facts = el('dl', { className: 'radar-facts' }, [
      fact('Location', tok.atGate ? 'Inside Gate A zone' : 'Outside gate zone'),
      fact('Signal', distance),
      fact('Input', tok.protocol === 'BLE' ? 'Bluetooth LE' : 'Wi-Fi'),
    ]);
    const reason = el('div', { className: 'radar-reason' }, [
      el('span', { className: 'sub', text: 'Registry status' }),
      el('strong', { text: tok.reason ?? 'Not in authorization registry — needs review' }),
    ]);
    const evidence = el('details', { className: 'radar-evidence' }, [
      el('summary', { text: 'Evidence & identifiers' }),
      dl,
    ]);
    const clear = el('button', { className: 'btn btn-ghost btn-sm radar-clear', text: 'Clear selection', attrs: { type: 'button' } });
    side.replaceChildren(
      el('div', { className: 'radar-device' }, [
        el('span', { className: `radar-device-icon tone-${tok.status}` }, [icon(TYPE_ICON[tok.type] ?? 'device', { size: 26 })]),
        el('div', { className: 'radar-device-title' }, [
          el('strong', { text: tok.name ?? 'Unidentified device' }),
          el('span', { className: `radar-status tone-${tok.status}`, text: STATUS_TEXT[tok.status] ?? tok.status }),
          el('div', { className: 'sub', text: tok.typeLabel ?? '' }),
        ]),
      ]),
      facts,
      reason,
      actions,
      evidence,
      clear,
    );
    clear.addEventListener('click', () => {
      selectedKey = null;
      renderSide();
    });
  }

  function legend() {
    const item = (color, text, glyph) => el('li', {}, [el('span', { className: 'legend-dot', attrs: { style: `border-color:${color};color:${color}` }, text: glyph }), document.createTextNode(text)]);
    return el('ul', { className: 'radar-legend' }, [
      item(COL.good, 'Authorized — recorded in Device Registry', '✓'),
      item(COL.warn, 'Unknown — send for registry review', '?'),
      item(COL.crit, 'Unauthorized — follow the incident procedure', '!'),
      el('li', { className: 'hint', text: 'Dashed ring = randomized address (can’t be registered reliably). Amber area = gate zone.' }),
    ]);
  }

  // ------------------------------------------------------------------ drill
  let drill = null;
  let drillTimer = null;
  const best = () => Number(localStorage.getItem('sawn.drill.best') ?? 0);

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    modeLive.setAttribute('aria-pressed', String(mode === 'live'));
    modeSky.setAttribute('aria-pressed', String(mode === 'sky'));
    modeHist.setAttribute('aria-pressed', String(mode === 'history'));
    modeDrill.setAttribute('aria-pressed', String(mode === 'drill'));
    root.classList.toggle('drill-on', mode === 'drill');
    for (const f of liveControls) f.hidden = mode === 'sky' || mode === 'history';
    note.textContent = mode === 'sky' ? SKY_NOTE : mode === 'history' ? 'Stored live data only · replays and demo tracks are never kept' : GATE_NOTE;
    radarBox.hidden = mode === 'history';
    histHost.hidden = mode !== 'history';
    if (mode === 'history') history ??= createHistoryView({ host: histHost, context: () => sky.context() });
    history?.show(mode === 'history');
    if (mode === 'drill') drillIntro();
    else stopDrill();
    lastSideKey = '';
    tip.hidden = true;
    sky.show(mode === 'sky');
    renderHud();
    if (mode === 'live') renderSide();
  }
  modeLive.addEventListener('click', () => setMode('live'));
  modeSky.addEventListener('click', () => setMode('sky'));
  modeHist.addEventListener('click', () => setMode('history'));

  function drillIntro() {
    side.replaceChildren(
      el('h3', {}, [icon('trophy', { size: 16 }), document.createTextNode(' Checkpoint training drill')]),
      el('p', { text: 'Eight visitors walk up to the gate. Watch what the system detects on their devices, then let each one through or stop them for a check.' }),
      el('ul', { className: 'drill-rules' }, [
        el('li', { text: 'Let through only when every device is authorized (green ✓).' }),
        el('li', { text: 'Stop anyone carrying an unknown (?) or unauthorized (!) device.' }),
        el('li', { text: '+100 for a correct call, up to +50 for speed, ×1.5 on a streak of 3. −50 for a wrong call.' }),
      ]),
      el('p', { className: 'hint', text: `Uses demo mode: events are labelled DEMO · SIMULATED and never touch the live registry. Best score: ${best()}` }),
      el('button', { className: 'btn btn-primary', attrs: { type: 'button' } }, [icon('play', { size: 16 }), document.createTextNode('Start drill')]),
    );
    side.lastElementChild.addEventListener('click', startDrill);
  }

  function startDrill() {
    const wasDemo = isDemo();
    setDemo(true);
    drill = { wasDemo, visitors: makeDrillRound(8), index: 0, score: 0, streak: 0, correct: 0, reactions: [], current: null, feedback: null };
    nextVisitor();
    clearInterval(drillTimer);
    drillTimer = setInterval(drillTick, 600);
  }

  function stopDrill() {
    clearInterval(drillTimer);
    drillTimer = null;
    if (drill && !drill.wasDemo) setDemo(false);
    drill = null;
  }

  function nextVisitor() {
    if (drill.index >= drill.visitors.length) return endDrill();
    const v = drill.visitors[drill.index];
    drill.current = { ...v, phase: 'approach', t0: performance.now(), x: 0, y: 1, exitDir: 0 };
    renderDrillSide();
  }

  // Visitor position in [0..1] along the lane: y = 1 at the far edge, 0 at the gate.
  function visitorPos(v, t) {
    const e = (t - v.t0) / 1000;
    if (v.phase === 'approach') {
      const k = Math.min(1, e / 6);
      v.y = 1 - (1 - (1 - k) ** 2) * 0.78; // ease out, stop at the gate (≈1–2 m from the sensor, inside the zone)
      if (k >= 1) {
        v.phase = 'waiting';
        v.waitStart = t;
        renderDrillSide();
      }
    } else if (v.phase === 'leaving') {
      const k = Math.min(1, (t - v.leaveStart) / 1800);
      if (v.exitDir === 0) v.y = 0.22 - k * 1.4; // through the gate
      else v.x = v.exitDir * k * 0.9; // stepped aside for a check
      if (k >= 1 && !v.done) {
        v.done = true;
        drill.index++;
        setTimeout(() => drill && nextVisitor(), 400);
      }
    } else if (v.phase === 'waiting' && t - v.waitStart > 15000) {
      decide(false, true);
    }
    return v;
  }

  function visitorXY(v) {
    const laneLen = geo.R * 1.02;
    return { x: geo.cx + v.x * geo.R, y: geo.cy + v.y * laneLen };
  }

  // Devices "transmit" while the visitor approaches and waits: the real pipeline classifies them.
  function drillTick() {
    const v = drill?.current;
    if (!v || v.phase === 'leaving') return;
    const { x, y } = visitorXY(v);
    const meters = Math.max(0.5, metersAt(Math.hypot(x - geo.cx, y - geo.cy)));
    for (const d of v.devices) {
      const rssi = Math.round(rssiAtDistance(meters, d.protocol) + (Math.random() * 4 - 2));
      try {
        ingestDemo({ id: d.id, protocol: d.protocol === 'BLE' ? 'ble' : 'wifi', sensorId: DEMO_SENSOR, timestamp: Date.now(), rssi, addressType: 'public', name: d.label });
      } catch {
        // demo mode switched off elsewhere: the drill keeps running visually
      }
    }
    packets.push({ toPc: true, t0: performance.now(), color: COL.accent });
    renderDrillSide();
  }

  function decide(allow, timedOut = false) {
    const v = drill?.current;
    if (!v || v.phase === 'leaving') return;
    if (v.phase !== 'waiting') v.waitStart = performance.now();
    const correct = !timedOut && allow === !v.shouldStop;
    const reaction = (performance.now() - v.waitStart) / 1000;
    let gained = 0;
    if (correct) {
      drill.streak++;
      drill.correct++;
      drill.reactions.push(reaction);
      gained = Math.round((100 + Math.max(0, 50 - reaction * 10)) * (drill.streak >= 3 ? 1.5 : 1));
    } else {
      drill.streak = 0;
      gained = -50;
    }
    drill.score = Math.max(0, drill.score + gained);
    const bad = v.devices.filter((d) => statusOf(d.protocol, d.id) !== 'AUTHORIZED');
    drill.feedback = {
      ok: correct,
      text: timedOut
        ? 'Too slow — the visitor walked through without a decision.'
        : correct
          ? v.shouldStop
            ? `Correct — ${bad.map((d) => d.label).join(', ')} ${bad.length > 1 ? 'are' : 'is'} not authorized.`
            : 'Correct — every device was authorized.'
          : v.shouldStop
            ? `Missed — ${bad.map((d) => `${d.label} (${STATUS_TEXT[statusOf(d.protocol, d.id)] ?? 'not authorized'})`).join(', ')} should have stopped them.`
            : 'Wrong call — every device was authorized; the visitor was held for nothing.',
      gained,
    };
    v.phase = 'leaving';
    v.leaveStart = performance.now();
    v.exitDir = allow || timedOut ? 0 : 1;
    v.decision = allow ? 'allowed' : 'stopped';
    renderDrillSide();
  }

  function endDrill() {
    clearInterval(drillTimer);
    const prevBest = best();
    if (drill.score > prevBest) localStorage.setItem('sawn.drill.best', String(drill.score));
    const n = drill.visitors.length;
    const stars = drill.correct === n ? 3 : drill.correct >= n - 2 ? 2 : drill.correct >= n / 2 ? 1 : 0;
    const avg = drill.reactions.length ? (drill.reactions.reduce((a, b) => a + b, 0) / drill.reactions.length).toFixed(1) : '—';
    side.replaceChildren(
      el('h3', {}, [icon('trophy', { size: 16 }), document.createTextNode(' Drill complete')]),
      el('div', { className: 'drill-stars', attrs: { 'aria-label': `${stars} of 3 stars` }, text: '★'.repeat(stars) + '☆'.repeat(3 - stars) }),
      el('dl', { className: 'kv' }, [
        el('dt', { text: 'Score' }), el('dd', { text: `${drill.score}${drill.score > prevBest ? ' — new best!' : ''}` }),
        el('dt', { text: 'Correct calls' }), el('dd', { text: `${drill.correct} of ${n}` }),
        el('dt', { text: 'Average reaction' }), el('dd', { text: `${avg} s` }),
        el('dt', { text: 'Best score' }), el('dd', { text: String(Math.max(prevBest, drill.score)) }),
      ]),
      el('div', { className: 'row wrap' }, [
        el('button', { className: 'btn btn-primary', text: 'Play again', attrs: { type: 'button', 'data-drill': 'again' } }),
        el('button', { className: 'btn', text: 'Back to live airspace', attrs: { type: 'button', 'data-drill': 'exit' } }),
      ]),
    );
    drill.current = null;
    side.querySelector('[data-drill="again"]').addEventListener('click', () => {
      stopDrill();
      startDrill();
    });
    side.querySelector('[data-drill="exit"]').addEventListener('click', () => setMode('live'));
    renderHud();
  }

  // Built once per visitor and updated in place: re-creating the buttons while the officer
  // clicks would swallow the click.
  let drillDom = null;
  function buildDrillSide(v) {
    const statusEls = [];
    const devList = el(
      'ul',
      { className: 'drill-devices' },
      v.devices.map((d) => {
        const st = el('span', { className: 'drill-status' });
        const li = el('li', {}, [icon(TYPE_ICON[d.type] ?? 'device', { size: 18 }), el('span', { text: d.label }), st]);
        statusEls.push({ d, li, st });
        return li;
      }),
    );
    const allow = el('button', { className: 'btn btn-ok btn-lg', attrs: { type: 'button' } }, [icon('check', { size: 18 }), document.createTextNode('Let through')]);
    const stop = el('button', { className: 'btn btn-danger btn-lg', attrs: { type: 'button' } }, [icon('block', { size: 18 }), document.createTextNode('Stop & check')]);
    allow.addEventListener('click', () => decide(true));
    stop.addEventListener('click', () => decide(false));
    const quit = el('button', { className: 'btn btn-ghost btn-sm', text: 'Quit drill', attrs: { type: 'button' } });
    quit.addEventListener('click', () => setMode('live'));
    const score = el('b');
    const streak = el('b');
    const count = el('b');
    const sub = el('div', { className: 'sub' });
    const bar = el('i');
    const timer = el('div', { className: 'drill-timer', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '15', 'aria-label': 'Time left to decide' } }, [bar]);
    const feedback = el('p', { className: 'drill-feedback' });
    side.replaceChildren(
      el('div', { className: 'drill-score' }, [
        el('div', {}, [el('small', { text: 'Score' }), score]),
        el('div', {}, [el('small', { text: 'Streak' }), streak]),
        el('div', {}, [el('small', { text: 'Visitor' }), count]),
      ]),
      el('div', { className: 'drill-visitor' }, [icon('person', { size: 22 }), el('div', {}, [el('strong', { text: v.name }), sub])]),
      devList,
      timer,
      el('div', { className: 'row wrap drill-actions' }, [allow, stop]),
      feedback,
      quit,
    );
    drillDom = { v, statusEls, allow, stop, score, streak, count, sub, bar, timer, feedback };
  }

  function renderDrillSide() {
    if (!drill?.current) return;
    const v = drill.current;
    if (drillDom?.v !== v) buildDrillSide(v);
    const dom = drillDom;
    dom.score.textContent = String(drill.score);
    dom.streak.textContent = `${drill.streak}${drill.streak >= 3 ? ' ×1.5' : ''}`;
    dom.count.textContent = `${drill.index + 1}/${drill.visitors.length}`;
    dom.sub.textContent = v.phase === 'waiting' ? 'At the gate — your call' : v.phase === 'approach' ? 'Approaching the gate…' : v.decision === 'allowed' ? 'Let through' : 'Stopped for a check';
    for (const { d, li, st } of dom.statusEls) {
      const s = statusOf(d.protocol, d.id);
      li.className = `tone-${s ?? 'none'}`;
      st.textContent = s ? STATUS_TEXT[s] : 'not heard yet';
    }
    const remaining = v.phase === 'waiting' ? Math.max(0, 15 - (performance.now() - v.waitStart) / 1000) : 15;
    dom.bar.style.width = `${(remaining / 15) * 100}%`;
    dom.timer.setAttribute('aria-valuenow', String(Math.round(remaining)));
    dom.allow.disabled = dom.stop.disabled = v.phase === 'leaving';
    const f = drill.feedback;
    dom.feedback.hidden = !f;
    if (f) {
      dom.feedback.className = `drill-feedback ${f.ok ? 'ok' : 'bad'}`;
      dom.feedback.textContent = `${f.gained > 0 ? '+' : ''}${f.gained} · ${f.text}`;
    }
  }


  // ------------------------------------------------------------------ drawing
  const ctx = canvas.getContext('2d');

  function drawBackground(t) {
    const { cx, cy, R } = geo;
    const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#0d1a2a');
    bg.addColorStop(1, '#060a12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Visitor lane (bottom → gate → top).
    ctx.fillStyle = 'rgba(45,212,191,0.05)';
    ctx.fillRect(cx - 34, 0, 68, H);
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    for (const dx of [-34, 34]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, 0);
      ctx.lineTo(cx + dx, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Gate zones (Wi-Fi solid, Bluetooth dashed).
    const zW = radiusFor(distanceFromRssi(site.zoneRssi, 'Wi-Fi'));
    const zB = radiusFor(distanceFromRssi(site.zoneRssiBle, 'BLE'));
    ctx.fillStyle = site.mode === 'checkpoint' ? 'rgba(251,191,36,0.10)' : 'rgba(96,165,250,0.06)';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(zW, zB), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = site.mode === 'checkpoint' ? 'rgba(251,191,36,0.75)' : 'rgba(96,165,250,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, zW, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, zB, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = site.mode === 'checkpoint' ? '#fbbf24' : '#93c5fd';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(site.mode === 'checkpoint' ? 'GATE ZONE' : 'CLOSE RANGE', cx + Math.max(zW, zB) * 0.72 + 4, cy - Math.max(zW, zB) * 0.72);

    // Distance rings.
    ctx.strokeStyle = 'rgba(148,163,184,0.16)';
    ctx.fillStyle = 'rgba(154,171,194,0.75)';
    ctx.font = '11px ui-monospace, Consolas, monospace';
    for (const d of RINGS) {
      const r = radiusFor(d);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${d} m`, cx + r * 0.71 + 3, cy + r * 0.71 + 12);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(45,212,191,0.25)';
    ctx.stroke();

    // Sweep.
    if (!reduce && ctx.createConicGradient) {
      const a = (t / 2600) % (Math.PI * 2);
      const g = ctx.createConicGradient(a, cx, cy);
      g.addColorStop(0, 'rgba(45,212,191,0.22)');
      g.addColorStop(0.08, 'rgba(45,212,191,0)');
      g.addColorStop(1, 'rgba(45,212,191,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function pcPos() {
    return { x: W - 64, y: H - 54 };
  }

  function drawInfrastructure(t) {
    const { cx, cy } = geo;
    const pc = pcPos();
    // Link sensor -> PC.
    ctx.strokeStyle = link.usb || link.wifi ? 'rgba(45,212,191,0.55)' : 'rgba(248,113,113,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash(link.usb ? [] : [5, 6]);
    ctx.beginPath();
    ctx.moveTo(cx + 18, cy + 10);
    ctx.quadraticCurveTo(pc.x - 40, cy + 30, pc.x - 4, pc.y - 26);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COL.muted;
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(link.usb && link.wifi ? 'USB + Wi-Fi' : link.usb ? 'USB' : link.wifi ? 'Wi-Fi' : 'NO LINK', (cx + pc.x) / 2 + 20, (cy + pc.y) / 2 - 6);

    // PC.
    ctx.fillStyle = 'rgba(14,21,32,0.95)';
    roundRect(pc.x - 46, pc.y - 30, 92, 64, 10);
    ctx.fill();
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    drawIcon(ctx, 'pc', pc.x, pc.y - 6, 26, COL.accent, 1.8);
    ctx.fillStyle = COL.text;
    ctx.font = '600 10.5px system-ui, sans-serif';
    ctx.fillText('SAWN console', pc.x, pc.y + 22);

    // Sensor (ESP32 board) at the gate.
    const online = sensor?.online !== false;
    const pulse = reduce ? 0 : (t / 1400) % 1;
    if (online && !reduce) {
      ctx.strokeStyle = `rgba(45,212,191,${0.5 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 16 + pulse * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    // gate pillars
    ctx.fillStyle = '#334155';
    roundRect(cx - 44, cy - 9, 10, 18, 3);
    ctx.fill();
    roundRect(cx + 34, cy - 9, 10, 18, 3);
    ctx.fill();
    ctx.fillStyle = online ? '#0f3d38' : '#3b1414';
    roundRect(cx - 17, cy - 11, 34, 22, 4);
    ctx.fill();
    ctx.strokeStyle = online ? COL.accent : COL.crit;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = online ? '#bff7ee' : '#fecaca';
    ctx.font = '700 8.5px ui-monospace, Consolas, monospace';
    ctx.fillText('ESP32', cx, cy + 3);
    // antenna
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy - 11);
    ctx.lineTo(cx + 10, cy - 18);
    ctx.lineTo(cx + 14, cy - 18);
    ctx.strokeStyle = online ? COL.accent : COL.crit;
    ctx.stroke();
    ctx.fillStyle = COL.muted;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(sensor?.id ? `${sensor.id}${online ? '' : ' · OFFLINE'}` : 'no sensor', cx, cy + 26);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function tokenXY(tok) {
    return { x: geo.cx + Math.cos(tok.angle) * tok.r, y: geo.cy + Math.sin(tok.angle) * tok.r };
  }

  function drawToken(tok, t, { x, y }, { size = 15, label = true, faded = false } = {}) {
    const color = statusColor(tok.status);
    const age = (t - (tok.born ?? 0)) / 400;
    const s = reduce ? 1 : Math.min(1, age < 1 ? 0.4 + 0.6 * (1 - (1 - age) ** 3) : 1);
    ctx.globalAlpha = faded ? 0.35 : 1;
    if (tok.status === 'VERIFIED_UNAUTHORIZED' && !reduce) {
      const p = (t / 700) % 1;
      ctx.strokeStyle = `rgba(248,113,113,${0.9 * (1 - p)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, size + 4 + p * 18, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tok.atGate && tok.status === 'UNKNOWN' && !reduce) {
      const p = (t / 1200) % 1;
      ctx.strokeStyle = `rgba(251,191,36,${0.7 * (1 - p)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, size + 3 + p * 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = COL.panel;
    ctx.beginPath();
    ctx.arc(x, y, size * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = tok.key === selectedKey ? 3.5 : 2;
    if (tok.stable === false) ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    drawIcon(ctx, TYPE_ICON[tok.type] ?? 'device', x, y, size * 1.15 * s, COL.text, 1.7);
    // status badge
    const bx = x + size * 0.75;
    const by = y - size * 0.75;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx, by, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06121a';
    ctx.font = '800 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(STATUS_GLYPH[tok.status] ?? '·', bx, by + 3.2);
    if (tok.key === hoverKey || tok.key === selectedKey) {
      ctx.strokeStyle = 'rgba(230,237,246,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, size + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (label) {
      const text = labelText(tok);
      ctx.font = LABEL_FONT;
      const w = ctx.measureText(text).width + 10;
      ctx.fillStyle = 'rgba(6,10,18,0.78)';
      roundRect(x - w / 2, y + size + 4, w, 15, 4);
      ctx.fill();
      ctx.fillStyle = COL.text;
      ctx.fillText(text, x, y + size + 15);
    }
    ctx.globalAlpha = 1;
  }

  const LABEL_FONT = '600 10.5px system-ui, sans-serif';
  const labelText = (tok) => `${(tok.name ?? tok.typeLabel ?? 'Device').slice(0, 20)}${Number.isFinite(tok.signal) ? ` · ${Math.round(tok.signal)}` : ''}`;
  const labelPriority = (tok) =>
    (tok.key === selectedKey ? 1000 : 0) + (tok.key === hoverKey ? 900 : 0) + (tok.status === 'VERIFIED_UNAUTHORIZED' ? 500 : 0) + (tok.atGate ? 200 : 0) + (Number.isFinite(tok.signal) ? tok.signal + 100 : 0);

  /** Which tokens get a label this frame: by priority, never overlapping another label or the sensor. */
  function placeLabels(shown, wantAll) {
    ctx.font = LABEL_FONT;
    const placed = [[geo.cx - 30, geo.cy - 20, 60, 50]]; // keep the sensor readable
    const out = new Set();
    for (const tok of [...shown].sort((a, b) => labelPriority(b) - labelPriority(a))) {
      const forced = tok.key === selectedKey || tok.key === hoverKey;
      if (!wantAll && !forced && tok.status !== 'VERIFIED_UNAUTHORIZED') continue;
      const { x, y } = tokenXY(tok);
      const w = ctx.measureText(labelText(tok)).width + 10;
      const rect = [x - w / 2, y + 19, w, 15];
      const hits = placed.some(([px, py, pw, ph]) => rect[0] < px + pw && rect[0] + rect[2] > px && rect[1] < py + ph && rect[1] + rect[3] > py);
      if (hits && !forced) continue;
      placed.push(rect);
      out.add(tok.key);
    }
    return out;
  }

  function drawPackets(t) {
    const pc = pcPos();
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      const k = (t - p.t0) / (p.toPc ? 900 : 650);
      if (k >= 1) {
        packets.splice(i, 1);
        continue;
      }
      let x;
      let y;
      if (p.toPc) {
        // along the curve sensor -> PC
        const x0 = geo.cx + 18;
        const y0 = geo.cy + 10;
        const qx = pc.x - 40;
        const qy = geo.cy + 30;
        const x1 = pc.x - 4;
        const y1 = pc.y - 26;
        x = (1 - k) ** 2 * x0 + 2 * (1 - k) * k * qx + k ** 2 * x1;
        y = (1 - k) ** 2 * y0 + 2 * (1 - k) * k * qy + k ** 2 * y1;
      } else {
        const from = tokenXY(p.from);
        x = from.x + (geo.cx - from.x) * k;
        y = from.y + (geo.cy - from.y) * k;
      }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - k * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawVisitor(v, t) {
    visitorPos(v, t);
    const { x, y } = visitorXY(v);
    // person
    ctx.fillStyle = v.phase === 'leaving' ? (v.decision === 'allowed' ? '#14532d' : '#7f1d1d') : '#1e293b';
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COL.text;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawIcon(ctx, 'person', x, y, 20, COL.text, 1.8);
    ctx.fillStyle = COL.text;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v.name, x, y - 26);
    // carried devices orbit the visitor
    v.devices.forEach((d, i) => {
      const a = (i / v.devices.length) * Math.PI * 2 + (reduce ? 0 : t / 2200);
      const tok = { key: `drill|${d.id}`, status: statusOf(d.protocol, d.id) ?? 'NONE', type: d.type, stable: true, born: v.t0, atGate: v.phase === 'waiting' };
      drawToken(tok, t, { x: x + Math.cos(a) * 34, y: y + Math.sin(a) * 34 }, { size: 11, label: false });
    });
  }

  function frame(t) {
    requestAnimationFrame(frame);
    if (!canvas.offsetParent) return; // page not visible: skip drawing
    if (mode === 'sky') {
      sky.draw(ctx, { cx: W / 2, cy: H / 2, R: Math.min(W, H) * 0.47, W, H }, t);
      return;
    }
    drawBackground(t);
    drawInfrastructure(t);
    if (mode === 'live') {
      const list = [...tokens.values()];
      for (const tok of list) {
        if (tok.gone) {
          tokens.delete(tok.key);
          continue;
        }
        tok.r += ((tok.targetR ?? tok.r) - tok.r) * (reduce ? 1 : 0.08);
      }
      const shown = list.filter(visible).sort((a, b) => (a.status === 'VERIFIED_UNAUTHORIZED') - (b.status === 'VERIFIED_UNAUTHORIZED'));
      const labelled = placeLabels(shown, showLabels.checked);
      for (const tok of shown) drawToken(tok, t, tokenXY(tok), { label: labelled.has(tok.key) });
      if (!shown.length) {
        ctx.fillStyle = COL.muted;
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tokens.size ? 'No device matches the filters' : 'Waiting for the sensor…', geo.cx, geo.cy - geo.R * 0.5);
      }
    } else if (drill?.current) {
      drawVisitor(drill.current, t);
      if (drill.current.phase === "waiting") renderDrillSide();
    }
    drawPackets(t);
  }
  requestAnimationFrame(frame);

  // ------------------------------------------------------------------ pointer
  function hit(ev) {
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    let bestTok = null;
    let bestD = 22;
    for (const tok of tokens.values()) {
      if (!visible(tok)) continue;
      const { x, y } = tokenXY(tok);
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) {
        bestD = d;
        bestTok = tok;
      }
    }
    return { tok: bestTok, px, py };
  }
  canvas.addEventListener('pointermove', (ev) => {
    if (mode === 'sky') {
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const text = sky.pointerMove(px, py);
      canvas.style.cursor = text ? 'pointer' : 'default';
      tip.hidden = !text;
      if (!text) return;
      tip.textContent = text;
      tip.style.left = `${Math.min(px + 14, W - 270)}px`;
      tip.style.top = `${py + 14}px`;
      return;
    }
    if (mode !== 'live') return;
    const { tok, px, py } = hit(ev);
    hoverKey = tok?.key ?? null;
    canvas.style.cursor = tok ? 'pointer' : 'default';
    if (!tok) {
      tip.hidden = true;
      return;
    }
    tip.textContent = `${tok.name ?? 'Unidentified'} · ${tok.typeLabel || 'type unknown'}${tok.typeScore ? ` (${tok.typeScore}%)` : ''} · ${STATUS_TEXT[tok.status]} · ${tok.protocol} · ${Number.isFinite(tok.signal) ? `${Math.round(tok.signal)} dBm ≈ ${tok.dist.toFixed(1)} m` : 'no signal'}`;
    tip.hidden = false;
    tip.style.left = `${Math.min(px + 14, W - 260)}px`;
    tip.style.top = `${py + 14}px`;
  });
  canvas.addEventListener('pointerleave', () => {
    hoverKey = null;
    sky.pointerLeave();
    tip.hidden = true;
  });
  canvas.addEventListener('click', (ev) => {
    if (mode === 'sky') {
      const rect = canvas.getBoundingClientRect();
      sky.click(ev.clientX - rect.left, ev.clientY - rect.top);
      return;
    }
    if (mode !== 'live') return;
    selectedKey = hit(ev).tok?.key ?? null;
    lastSideKey = '';
    renderSide();
  });
  for (const box of [gateOnly, showRandom, showLabels]) box.addEventListener('change', () => renderHud());

  renderSide();
  renderHud();

  return {
    update,
    /** The server's airspace picture (aircraft, drones, demo state). */
    setAircraft(msg) {
      sky.setData(msg);
      renderHud();
    },
    /** Satellites over the site (Space panel). */
    setSpace(msg) {
      sky.setSpace(msg);
    },
    /** Opens the aircraft view (optionally with one track selected). */
    showAircraft(hex = null) {
      setMode('sky');
      if (hex) sky.select(hex);
    },
    select(key) {
      selectedKey = key;
      lastSideKey = '';
      renderSide();
    },
    get mode() {
      return mode;
    },
  };
}
