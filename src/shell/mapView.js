// Site & airspace page: the 3D scene (siteScene.js) on real imagery plus the side panel —
// layer toggles, camera views, what is selected, the facility device list, legend and levels.
// AS-1, PC-1 and the Gate A NFC reader show evidence-backed states; aircraft and satellites come
// from the server. Model-only items must not appear online by default.
import { isOpen } from '../shared/scenarios.js';
import { on } from './hub.js';
import { DEVICES, deviceById } from './facility.js';
import { state } from './store.js';
import { h } from './ui.js';
import { get } from './api.js';

/** Live status of a plan device: alarms from open incidents, AS-1 from the airspace sensor. */
export function deviceStatus(d) {
  const air = state.airspace;
  const openAlarm = state.incidents.some((i) => isOpen(i.status) && i.createdAt >= Date.now() - 120_000 && (i.alarm ?? []).includes(d.id));
  if (openAlarm) return 'alarm';
  if (d.id === 'AS-1') {
    if (!air?.sensorOnline) return 'offline';
    return air.level === 'critical' ? 'alarm' : air.level === 'warning' ? 'warn' : 'online';
  }
  if (d.id === 'PC-1') return air?.connected ? 'online' : 'warn';
  if (d.id === 'A1') {
    const gate = state.gates?.gates?.find((g) => g.id === 'gate-a');
    const nfc = gate?.components?.find((c) => c.id === 'nfc');
    if (nfc?.state === 'verified-recent') return 'online';
    if (nfc?.state === 'link-open' || nfc?.state === 'connecting') return 'warn';
    return 'offline';
  }
  // Planned or simulated model items are deliberately grey unless an incident is open.  They are
  // not shown as online merely because they have a location in the miniature.
  if (d.integration !== 'hardware') return 'offline';
  if (state.netDown && !['cam', 'drone'].includes(d.kind)) return 'warn';
  return 'online';
}

export function deviceReading(d) {
  const air = state.airspace;
  if (d.id === 'AS-1') return air?.sensorOnline ? `${air.sensorId} · ${air.counts?.total ?? 0} devices in range · ${air.counts?.atGate ?? 0} at the gate` : 'Not reporting';
  if (d.id === 'PC-1') return air?.connected ? 'Live feed connected' : 'Feed disconnected';
  if (d.id === 'A1') {
    const gate = state.gates?.gates?.find((g) => g.id === 'gate-a');
    return gate?.components?.find((c) => c.id === 'nfc')?.detail ?? 'Gate A reader status unavailable.';
  }
  if (d.integration === 'not-integrated') return 'Not integrated — no hardware controller is connected to SAWN.';
  if (d.integration === 'simulated') return 'Simulated subsystem — no live hardware status.';
  const st = deviceStatus(d);
  if (st === 'alarm') return `Alarm · ${state.incidents.find((i) => isOpen(i.status) && (i.alarm ?? []).includes(d.id))?.ref ?? ''}`;
  return state.netDown && st === 'warn' ? 'Connected over USB (fallback)' : d.idle;
}

const ST_LABEL = { online: 'Online', alarm: 'Alarm', offline: 'Offline', warn: 'Warning' };
const deviceStatusLabel = (d, st) => (d.integration === 'not-integrated' && st !== 'alarm' ? 'Not integrated' : d.integration === 'simulated' && st !== 'alarm' ? 'Simulated' : ST_LABEL[st]);
const LEVEL_LABEL = { critical: 'Critical', high: 'High', warning: 'Warning', normal: 'Normal', expected: 'Expected (airport traffic)' };
const WIFI_LABEL = { AUTHORIZED: 'Authorized', UNKNOWN: 'Unknown', VERIFIED_UNAUTHORIZED: 'Unauthorized (verified)' };
const fmt = (n, unit) => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('en-US')} ${unit}` : '—');

/**
 * @param root      the page section
 * @param getScene  () => Promise<scene> (created on first view: three.js loads only then)
 */
export function createMapPage({ root, getScene }) {
  const info = root.querySelector('#dev-info');
  const list = root.querySelector('#dev-list');
  const statusEl = root.querySelector('#site-status');
  let pick = { kind: 'device', id: 'AS-1' };
  let scene = null;
  let signs = [];

  // Camera views
  const viewBtns = [...root.querySelectorAll('[data-view3]')];
  for (const b of viewBtns) {
    b.addEventListener('click', () => {
      for (const o of viewBtns) o.setAttribute('aria-pressed', String(o === b));
      scene?.view(b.dataset.view3);
    });
  }
  // Layer toggles
  for (const b of root.querySelectorAll('[data-layer]')) {
    b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', () => {
      const v = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(v));
      scene?.toggle(b.dataset.layer, v);
    });
  }

  // Roofs: lift them off to see inside each level, put them back.
  const roofBtn = root.querySelector('#site-roofs');
  let roofsOn = true;
  roofBtn?.addEventListener('click', () => {
    roofsOn = !roofsOn;
    roofBtn.textContent = roofsOn ? 'Remove roofs' : 'Put roofs back';
    roofBtn.classList.toggle('on', !roofsOn);
    scene?.toggle('roofs', roofsOn);
  });

  function choose(p, fly = false) {
    pick = p;
    if (fly) scene?.select(p);
    renderInfo();
    renderList();
  }

  function rowsFor(p) {
    if (p.kind === 'device') {
      const d = deviceById(p.id);
      if (!d) return null;
      const rel = state.incidents.filter((i) => isOpen(i.status) && (i.alarm ?? []).includes(d.id));
      return [
        `${d.id} · ${d.name}`,
        [
          ['Zone', d.zone],
          ['Connected via', d.id === 'AS-1' ? (state.airspace?.link?.usb ? 'USB serial' : state.airspace?.link?.wifi ? 'Wi-Fi' : '—') : d.node],
          ['Status', deviceStatusLabel(d, deviceStatus(d))],
          ['Reading', deviceReading(d)],
          ['Open incidents', rel.length ? rel.map((r) => r.ref).join(', ') : 'None'],
          ['Data', d.integration === 'hardware' ? 'Hardware status' : d.integration === 'not-integrated' ? 'Not integrated' : 'Simulated subsystem'],
        ],
      ];
    }
    if (p.kind === 'wifi') {
      const d = p.device;
      return [
        `Wireless device · ${d.type ?? 'unknown'}`,
        [
          ['Status', WIFI_LABEL[d.status] ?? d.status],
          ['Distance from AS-1', Number.isFinite(d.dist) ? `≈ ${d.dist.toFixed(1)} m` : '—'],
          ['In the gate zone', d.atGate ? 'Yes' : 'No'],
          ['Heard by', 'AS-1 airspace sensor (ESP32) · real'],
        ],
      ];
    }
    if (p.kind === 'track') {
      const tr = scene?.trackData(p.hex);
      if (!tr) return ['Track no longer reported', []];
      const name = tr.callsign || tr.name || tr.registration || tr.hex.toUpperCase();
      return [
        `${tr.kind === 'drone' ? 'Drone' : 'Aircraft'} · ${name}`,
        [
          ['Level', LEVEL_LABEL[tr.level] ?? tr.level ?? '—'],
          ['Why', tr.reason ?? '—'],
          ['Altitude', tr.onGround ? 'On the ground' : fmt(tr.altitudeFt, 'ft')],
          ['Distance', Number.isFinite(tr.distanceM) ? `${(tr.distanceM / 1000).toFixed(1)} km from the site` : '—'],
          ['Speed · track', `${fmt(tr.speedKt, 'kt')} · ${Number.isFinite(tr.track) ? `${tr.track}°` : '—'}`],
          ...(tr.kind === 'aircraft' ? [['ICAO · squawk', `${tr.hex.toUpperCase()} · ${tr.squawk ?? '—'}`]] : []),
          ['Source', tr.simulated ? 'SIMULATED (demo scenario)' : tr.kind === 'drone' ? 'Remote ID via AS-1 · real' : 'ADS-B · real'],
        ],
      ];
    }
    if (p.kind === 'sat') {
      const s = p.sat;
      return [
        `Satellite · ${s.name}`,
        [
          ['Type', s.imaging ? 'Imaging (optical / radar)' : 'Other (weather, science, station)'],
          ['Now', s.overhead ? 'OVERHEAD — cover sensitive activity' : `Azimuth ${Math.round(s.az)}° · elevation ${Math.round(s.el)}°`],
          ['Source', s.simulated ? 'SIMULATED (demo scenario)' : 'CelesTrak orbit data (SGP4) · real'],
          ['On the view', 'Shown by direction in the sky, not to scale'],
        ],
      ];
    }
    if (p.kind === 'sign') {
      const s = p.sign;
      return [`Sign ${s.id}`, [['Zone', s.zone], ['Status', s.status], ['Wording', s.wording], ['Hazard warning', s.hazard ? 'Yes' : 'No']]];
    }
    return null;
  }

  function renderInfo() {
    const r = rowsFor(pick);
    if (!r) return info.replaceChildren(h('p', { class: 'hint', text: 'Click anything on the view: a device, an aircraft, a drone or a satellite.' }));
    const [title, rows] = r;
    info.replaceChildren(h('b', { class: 'site-sel-title', text: title }), h('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: String(v) })])));
  }

  function renderList() {
    list.replaceChildren(
      ...DEVICES.map((d) => {
        const st = deviceStatus(d);
        const on = pick.kind === 'device' && pick.id === d.id;
        return h('button', { class: `map-dev-row ${on ? 'on' : ''}`, attrs: { type: 'button' }, on: { click: () => choose({ kind: 'device', id: d.id }, true) } }, [
          h('span', {}, [h('b', { class: 'mono', text: d.id }), ` · ${d.name}`, d.real ? h('span', { class: 'badge badge-live', text: 'REAL' }) : null]),
          h('span', { class: `dot-label st-${st}`, text: deviceStatusLabel(d, st) }),
        ]);
      }),
    );
  }

  function renderStatus() {
    if (!scene) return;
    const c = scene.counts();
    const t = scene.tileStatus();
    const parts = [
      `${c.aircraft} aircraft`,
      `${c.drones} drone${c.drones === 1 ? '' : 's'}`,
      `${c.imaging} imaging satellite${c.imaging === 1 ? '' : 's'} above the horizon`,
      `${c.wifi} wireless device${c.wifi === 1 ? '' : 's'} at Gate A`,
    ];
    statusEl.replaceChildren(
      ...(c.overhead ? [h('b', { class: 'site-overhead', text: 'Imaging satellite OVERHEAD' })] : []),
      h('span', { text: parts.join(' · ') }),
      ...(t.total && t.ok === 0 && t.failed > 0 ? [h('span', { class: 'site-offline', text: 'Map imagery offline — plain ground shown' })] : []),
    );
  }

  const ready = (s) => {
    if (scene) return;
    scene = s;
    scene.setSigns(signs);
    get('airspace/aircraft').then((m) => scene.setAircraft(m)).catch(() => {});
    get('airspace/space').then((m) => scene.setSpace(m)).catch(() => {});
    renderStatus();
  };
  on('server-message', (msg) => {
    if (!scene) return;
    if (msg.type === 'aircraft') scene.setAircraft(msg);
    else if (msg.type === 'space') scene.setSpace(msg);
  });
  on('incidents', () => !root.hidden && renderInfo());
  setInterval(() => {
    if (root.hidden) return;
    renderInfo();
    renderList();
    renderStatus();
  }, 2000);

  return {
    /** Called by the scene when something on the view is clicked. */
    showPick: (p) => choose(p),
    show() {
      getScene().then((s) => {
        ready(s);
        s.resize();
      });
      renderInfo();
      renderList();
      get('readiness')
        .then((r) => {
          signs = r.signs ?? [];
          scene?.setSigns(signs);
        })
        .catch(() => {});
    },
  };
}
