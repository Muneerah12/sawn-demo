// Facility A: devices on the site plan (map coordinates in cm on the 120 × 80 model), drone
// destinations and the simulated camera feeds. AS-1 (the ESP32 airspace sensor), PC-1 (this
// console), and A1 (the Gate A NFC reader) are hardware items. Their evidence differs: AS-1 has
// heartbeats, while A1 is verified by an open serial link plus an accepted tap. Everything else
// remains simulated or not integrated until its hardware is connected.
import { TRACKING_CAMERAS, tracksAt } from '../shared/cameraSim.js';

const RAW = [
  ['AS-1', 'Airspace sensor (ESP32)', 'Gate A', 70, 53, 'air'],
  ['PC-1', 'SAWN console PC', 'Gate A', 92, 58, 'pc'],
  ['N1', 'Gate A node', 'Gate A', 64, 50, 'node'], ['N2', 'Levels 4–5 node', 'Level 4', 100, 35, 'node'], ['N3', 'Environment node', 'Zone D', 30, 50, 'node'],
  ['MD-A1', 'Metal detector', 'Gate A', 57, 61, 'det'], ['A6', 'Tray entry beam', 'Gate A', 45, 61, 's'], ['A1', 'Gate NFC reader', 'Gate A', 81.8, 70.6, 's'],
  ['A2', 'Lane beam + lights', 'Gate A', 75, 67, 's'], ['A3', 'Pedestrian barrier', 'Gate A', 79.6, 63.5, 'act'], ['A4', 'Entrance door sensor', 'Level 1', 60, 45, 's'], ['A8', 'Entrance motion sensor', 'Level 1', 69, 45.8, 's'],
  ['B1', 'Overhead camera', 'Levels 1–3', 36, 23, 'cam'], ['B2', 'Office temp/humidity', 'Level 2', 6, 2, 's'], ['CAM-2', 'Behaviour camera', 'Sidewalk', 40, 68.4, 'cam'],
  ['C1', 'Level 4 card + PIN reader', 'Level 4', 79, 17.5, 's'], ['C2', 'Level 4 door sensor', 'Level 4', 80, 24, 's'], ['C3', 'Level 4 motion sensor', 'Level 4', 116, 34, 's'], ['C4', 'Warning beacon', 'Level 4', 100, 22.5, 'act'],
  ['C6', 'Level 5 card + PIN + fingerprint', 'Level 5', 99, 15.6, 's'],
  ['D1', 'Zone D temp/humidity', 'Zone D', 16, 55, 's'], ['D2', 'VOC sensor', 'Zone D', 22, 55, 's'], ['D3', 'OLED display', 'Zone D', 19, 64.6, 'act'], ['D4', 'Zone D warning light', 'Zone D', 27, 65, 'act'],
  ['T-1', 'Watchtower 360° PTZ + searchlight', 'Perimeter', 4.5, 64, 'cam'], ['P1', 'Perimeter camera east', 'Perimeter', 118, 67.5, 'cam'], ['P2', 'Perimeter camera west', 'Perimeter', 1.5, 46, 'cam'], ['P3', 'Perimeter camera centre', 'Perimeter', 118.5, 46, 'cam'],
  ['R1', '360° dome · Level 1', 'Level 1', 60, 37.5, 'cam'], ['R2', '360° dome · Level 2', 'Level 2', 20, 22.5, 'cam'], ['R3', '360° dome · Level 3', 'Level 3', 60, 15, 'cam'], ['R4', '360° dome · Level 4', 'Level 4', 90, 26, 'cam'], ['R5', '360° dome · Level 5', 'Level 5', 110, 9, 'cam'],
  ['G1', 'Gate 1 CCTV · into Level 1', 'Level 1', 60, 39, 'cam'], ['G2', 'Gate 2 CCTV · into Level 2', 'Level 1', 37.5, 38, 'cam'], ['G3', 'Gate 3 CCTV · into Level 3', 'Level 1', 60, 27.5, 'cam'],
  ['G4', 'Gate 4 CCTV · into Level 4', 'Level 3', 82.5, 24, 'cam'], ['G5', 'Gate 5 CCTV · into Level 5', 'Level 4', 102.5, 11, 'cam'],
  ['W3', 'Warehouse camera (fire & smoke)', 'Level 3', 58, 8, 'cam'], ['OG-1', 'OGI gas camera', 'Zone D', 12, 62, 'cam'],
  ['DR-1', 'Drone', 'Zone D', 10, 51, 'drone'],
];

const NODE_OF = { 'Gate A': 'N1', 'Level 1': 'N1', 'Level 4': 'N2', 'Level 5': 'N2', 'Zone D': 'N3', 'Level 2': 'N3' };
const READ = { B2: '24.1°C · 41%', D1: '24.3°C · 40%', D2: 'VOC 102', 'MD-A1': 'Armed · no alarm', A3: 'Closed', C2: 'Closed', A4: 'Closed' };

export const DEVICES = RAW.map(([id, name, zone, x, y, kind]) => ({
  id,
  name,
  zone,
  x,
  y,
  kind,
  // A1 is now a real NFC ESP32.  C6/Level 5 remains a planned, not-integrated controller.
  real: kind === 'air' || kind === 'pc' || id === 'A1',
  integration: kind === 'air' || kind === 'pc' || id === 'A1' ? 'hardware' : id === 'C6' ? 'not-integrated' : 'simulated',
  status: 'online',
  node: kind === 'node' || kind === 'air' || kind === 'pc' ? '—' : kind === 'cam' ? 'Local computer (USB)' : kind === 'drone' ? 'Drone link' : (NODE_OF[zone] ?? '—'),
  last: READ[id] ?? (kind === 'cam' ? 'Streaming 25 fps (simulated)' : 'OK (simulated)'),
  idle: READ[id] ?? (kind === 'cam' ? 'Streaming 25 fps (simulated)' : 'OK (simulated)'),
}));
export const deviceById = (id) => DEVICES.find((d) => d.id === id);

export const DRONE_TARGETS = [
  ['A · Checkpoint', [57, 61]],
  ['A · Pedestrian gate', [80, 70]],
  ['Level 2 · Offices', [20, 22]],
  ['Level 4 · Server room', [90, 26]],
  ['Perimeter · east fence', [106, 64]],
  ['D · Environment room', [20, 57]],
  ['Sidewalk', [40, 70.5]],
];

export const CAM_LABEL = { C2: 'CAM-2', DR: 'DR-1', T1: 'T-1 PTZ', B1: 'B1', W3: 'W3', OG: 'OG-1 OGI' };

export function boxLabel(i) {
  return ({ metal: 'tray', intr: 'person', loiter: 'person 75s', fight: 'pose: altercation', bag: 'unattended bag 60s', weapon: 'knife', pattern: 'person 90s', breach: 'person · fence', escort: 'visitor · no escort', fire: 'flame', smoke: 'smoke', gas: 'CH4 plume', 'zone-entry': 'person · no clearance', 'zone-dwell': 'person · long stay' })[i.key] ?? 'object';
}

/**
 * Simulated camera frame (clearly labelled SIMULATED).
 * o: alert, label, conf, frozen — plus for the tracking cameras `zones` (drawn by operators),
 * `presence` (track → authorized?) and `time` (ms; the people's positions); for W3 / OG-1
 * `effect` ('fire' | 'smoke' | 'gas').
 */
export function drawFeed(c, cam, now, o = {}) {
  const w = 480;
  const h = 270;
  if (cam === 'W3' || cam === 'OG') {
    drawHazardScene(c, cam, o.frozen ? 1000 : now / 1000, o);
    stamp(c, cam, o);
    return;
  }
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0c1422');
  g.addColorStop(1, '#1a2433');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(148,163,184,.18)';
  c.lineWidth = 1;
  if (cam === 'DR') {
    for (let i = 0; i < 10; i++) {
      c.beginPath();
      c.moveTo(i * 54, 0);
      c.lineTo(i * 54, h);
      c.stroke();
      c.beginPath();
      c.moveTo(0, i * 30);
      c.lineTo(w, i * 30);
      c.stroke();
    }
  } else {
    for (let i = -6; i <= 6; i++) {
      c.beginPath();
      c.moveTo(w / 2 + i * 20, 90);
      c.lineTo(w / 2 + i * 80, h);
      c.stroke();
    }
    for (let y = 100; y < h; y += 22) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
  }
  const t = o.frozen ? 1000 : now / 1000;
  const tracked = Boolean(TRACKING_CAMERAS[cam]);
  if (tracked && o.zones?.length) drawZones(c, o.zones);
  else if (cam === 'B1') {
    c.fillStyle = 'rgba(248,113,113,.15)';
    c.strokeStyle = 'rgba(248,113,113,.7)';
    c.setLineDash([6, 4]);
    c.beginPath();
    c.moveTo(320, 120);
    c.lineTo(420, 120);
    c.lineTo(460, 250);
    c.lineTo(300, 250);
    c.closePath();
    c.fill();
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#fca5a5';
    c.font = '12px ui-monospace, monospace';
    c.fillText('ZONE B3', 330, 138);
  }
  if (cam === 'C2') {
    c.fillStyle = 'rgba(96,165,250,.12)';
    c.fillRect(0, 200, w, 70);
  }
  const tracks = tracked ? tracksAt(cam, (o.time ?? Date.now()) / 1000) : null;
  const people = tracks
    ? tracks.map((p) => [p.x, p.y])
    : cam === 'DR'
      ? [[200 + Math.sin(t) * 20, 130], [260, 160]]
      : [[120 + Math.sin(t * 0.6) * 60, 190], [250 + Math.cos(t * 0.5) * 40, 170], [380 + Math.sin(t * 0.8) * 20, 200]];
  people.forEach(([x, y]) => {
    c.fillStyle = 'rgba(226,232,240,.75)';
    if (cam === 'DR') {
      c.beginPath();
      c.arc(x, y, 7, 0, 7);
      c.fill();
    } else {
      c.beginPath();
      c.ellipse(x, y - 28, 8, 8, 0, 0, 7);
      c.fill();
      c.fillRect(x - 9, y - 18, 18, 36);
    }
  });
  // Tracking cameras: a box per person inside a zone — green with a valid badge, red without.
  if (tracks && o.presence) {
    for (const p of tracks) {
      const ok = o.presence.get(p.track);
      if (ok === undefined) continue;
      box(c, p.x - 18, p.y - 42, 36, 66, ok ? '#22c55e' : '#ff3b3b', `ID ${p.id} · ${ok ? 'authorized' : 'no clearance'}`);
    }
  } else if (o.alert) {
    const [x, y] = people[o.label && o.label.startsWith('unattended') ? 2 : 0];
    const dr = cam === 'DR';
    box(c, dr ? x - 16 : x - 18, dr ? y - 16 : y - 42, dr ? 32 : 36, dr ? 32 : 66, '#ff3b3b', (o.label || '') + (o.conf ? ` ${o.conf.toFixed(2)}` : ''));
  }
  stamp(c, cam, o);
}

function box(c, bx, by, bw, bh, color, txt) {
  c.strokeStyle = color;
  c.lineWidth = 2.5;
  c.strokeRect(bx, by, bw, bh);
  c.font = '600 12px ui-monospace, monospace';
  c.fillStyle = color;
  c.fillRect(bx, by - 18, Math.max(bw, c.measureText(txt).width + 10), 18);
  c.fillStyle = '#fff';
  c.fillText(txt, bx + 4, by - 5);
}

/** Camera name, clock and the SIMULATED mark. */
function stamp(c, cam, o) {
  c.fillStyle = 'rgba(0,0,0,.5)';
  c.fillRect(0, 0, 480, 22);
  c.fillStyle = '#e2e8f0';
  c.font = '12px ui-monospace, monospace';
  c.textAlign = 'left';
  c.fillText(`${CAM_LABEL[cam] ?? cam}  ${new Date().toTimeString().slice(0, 8)}${o.frozen ? '  SNAPSHOT' : '  LIVE'}`, 8, 15);
  c.textAlign = 'right';
  c.fillText('SIMULATED', 472, 15);
  c.textAlign = 'left';
}

/** Operator-drawn zones (and the polygon being drawn, `draft`). */
export function drawZones(c, zones, draft = null) {
  c.save();
  c.setLineDash([6, 4]);
  c.lineWidth = 1.5;
  c.font = '600 12px ui-monospace, monospace';
  for (const z of zones) {
    c.fillStyle = 'rgba(248,113,113,.14)';
    c.strokeStyle = 'rgba(248,113,113,.85)';
    c.beginPath();
    z.points.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
    c.stroke();
    const [lx, ly] = z.points.reduce(([ax, ay], [x, y]) => [Math.min(ax, x), Math.min(ay, y)], [480, 270]);
    c.fillStyle = '#fca5a5';
    c.fillText(`${z.name} · L${z.minLevel}+`, lx + 4, Math.max(36, ly + 14));
  }
  if (draft?.length) {
    c.setLineDash([]);
    c.strokeStyle = '#facc15';
    c.fillStyle = '#facc15';
    c.beginPath();
    draft.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    for (const [x, y] of draft) c.fillRect(x - 3, y - 3, 6, 6);
  }
  c.restore();
}

/** W3 (warehouse, fire & smoke analytics) and OG-1 (optical gas imaging) scenes. */
function drawHazardScene(c, cam, t, o) {
  const ogi = cam === 'OG';
  // OGI cameras show a monochrome thermal-style picture.
  const g = c.createLinearGradient(0, 0, 0, 270);
  g.addColorStop(0, ogi ? '#2a2a2a' : '#101826');
  g.addColorStop(1, ogi ? '#4a4a4a' : '#1f2937');
  c.fillStyle = g;
  c.fillRect(0, 0, 480, 270);
  if (ogi) {
    // Meter skid: pipes, regulator and a valve.
    c.fillStyle = '#9a9a9a';
    c.fillRect(40, 170, 400, 14);
    c.fillRect(120, 110, 14, 74);
    c.fillRect(330, 120, 14, 64);
    c.fillStyle = '#c8c8c8';
    c.fillRect(110, 96, 34, 22);
    c.beginPath();
    c.arc(337, 112, 14, 0, 7);
    c.fill();
    c.fillStyle = '#6b6b6b';
    c.fillRect(0, 230, 480, 40);
  } else {
    // Warehouse racks with boxes.
    for (const x of [30, 150, 270, 390]) {
      c.fillStyle = '#334155';
      c.fillRect(x, 80, 8, 150);
      c.fillRect(x + 62, 80, 8, 150);
      for (const y of [100, 150, 200]) {
        c.fillRect(x, y, 70, 5);
        c.fillStyle = '#7c5a3a';
        c.fillRect(x + 8, y - 22, 24, 22);
        c.fillRect(x + 36, y - 16, 22, 16);
        c.fillStyle = '#334155';
      }
    }
    c.fillStyle = '#0f172a';
    c.fillRect(0, 230, 480, 40);
  }
  const effect = o.effect ?? null;
  if (effect === 'fire') {
    // Flickering flames at the base of rack 4.
    const bx = 300;
    for (let k = 0; k < 9; k++) {
      const fx = bx + k * 9;
      const fh = 30 + 26 * Math.abs(Math.sin(t * 7 + k * 1.7));
      const grd = c.createLinearGradient(0, 228 - fh, 0, 228);
      grd.addColorStop(0, 'rgba(254,240,138,0)');
      grd.addColorStop(0.4, 'rgba(251,146,60,.85)');
      grd.addColorStop(1, 'rgba(239,68,68,.95)');
      c.fillStyle = grd;
      c.beginPath();
      c.moveTo(fx - 7, 228);
      c.quadraticCurveTo(fx, 228 - fh * 1.2, fx + 7, 228);
      c.fill();
    }
    c.fillStyle = 'rgba(251,146,60,.12)';
    c.fillRect(250, 120, 180, 110);
    box(c, 290, 160, 92, 72, '#ff3b3b', `flame ${(o.conf ?? 0.91).toFixed(2)}`);
  } else if (effect === 'smoke') {
    // A grey plume rising and spreading.
    for (let k = 0; k < 14; k++) {
      const u = ((t * 0.15 + k / 14) % 1 + 1) % 1;
      const r = 14 + u * 46;
      c.fillStyle = `rgba(203,213,225,${0.32 * (1 - u)})`;
      c.beginPath();
      c.arc(200 + Math.sin(k * 2.1 + t) * 18 + u * 40, 220 - u * 170, r, 0, 7);
      c.fill();
    }
    box(c, 168, 40, 140, 190, '#f59e0b', `smoke ${(o.conf ?? 0.84).toFixed(2)}`);
  } else if (effect === 'gas') {
    // Methane plume as the segmentation mask sees it: dark cloud + outline.
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const r = 1 + 0.18 * Math.sin(a * 3 + t * 2) + 0.1 * Math.sin(a * 5 - t * 3);
      pts.push([127 + 70 + Math.cos(a) * 85 * r, 100 + Math.sin(a) * 42 * r - 6]);
    }
    c.fillStyle = 'rgba(15,15,15,.55)';
    c.beginPath();
    pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.fill();
    c.strokeStyle = '#e879f9';
    c.lineWidth = 2;
    c.stroke();
    c.font = '600 12px ui-monospace, monospace';
    c.fillStyle = '#e879f9';
    c.fillText(`CH4 plume ${(o.conf ?? 0.88).toFixed(2)} · drift →`, 150, 40);
  } else {
    c.font = '12px ui-monospace, monospace';
    c.fillStyle = ogi ? '#d4d4d4' : '#94a3b8';
    c.fillText(ogi ? 'OGI · no gas plume segmented' : 'No flame or smoke detected', 12, 258);
  }
}
