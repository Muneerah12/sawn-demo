// Site & airspace: one 3D scene, in real units, on real satellite imagery of the site.
//   ground     Esri World Imagery tiles at several zoom levels (server/mapTiles.mjs caches them),
//              a plain desert ground underneath when the tiles cannot be loaded
//   facility   the plan at true size (0.5 m per plan unit → 60 × 40 m): buildings coloured by
//              security level, checkpoint A, zone D annex, parking, watchtower, fence and street
//   devices    every plan device as a pin coloured by its live status; open incidents pulse
//   wireless   the gate zone around AS-1 (ESP32) and the devices it hears, at their distance
//   airspace   aircraft (ADS-B) and drones at their real position and height, with trails, the
//              restricted / warning / monitor rings and the restricted ceiling
//   space      imaging satellites by direction in the sky (a dome above the site, not to scale),
//              the paths of passes in progress / next, OVERHEAD NOW highlighted
// The console bridge is the same as the old 3D model: trigger / focusKey / droneTo / droneRecall /
// drawScreen / setAirspace / resize, plus setAircraft / setSpace / setSigns / select.
import * as THREE from '/sawn-demo/vendor/three/three.module.js';
import { OrbitControls } from '/sawn-demo/vendor/three/OrbitControls.js';
import { PATHS, TYPE_ICON } from '../ui/icons.js';
import { AIRFIELDS } from '../ui/geoRiyadh.js';
import { DEVICES } from './facility.js';
import { geoToLocal, heightM, planToLocal, PLAN_H, PLAN_M, PLAN_W, skyPoint, tilesAround } from '../shared/siteGeo.js';

const SKY_R = 45_000; // sky dome radius (m): beyond the 25 km monitor ring
// [zoom, radius in tiles]: sharp around the facility, coarser further out; the zoom-13 block
// (≈ 31 km) reaches past the 25 km monitor ring so no imagery seam crosses the airspace rings.
const TILE_LAYERS = [
  [8, 1],
  [11, 2],
  [13, 3],
  [15, 3],
  [17, 2],
  [18, 2],
];
export const LEVEL_COLOR = { critical: '#f87171', high: '#fb923c', warning: '#fbbf24', normal: '#5eead4', expected: '#86efac' };
export const SIM_COLOR = '#c084fc';
const STATUS_COLOR = { online: '#4ade80', alarm: '#f87171', offline: '#ef4444', warn: '#fbbf24', unconfigured: '#94a3b8', unknown: '#94a3b8', sim: '#c084fc' };
const WIFI_COLOR = { AUTHORIZED: '#4ade80', UNKNOWN: '#fbbf24', VERIFIED_UNAUTHORIZED: '#f87171' };

// Buildings on the plan: [x0, y0, x1, y1, height m, roof colour, name, sub]
const BUILDINGS = [
  [0, 0, 40, 45, 8, 0x8cc7a3, 'Level 2', 'Offices', 'Z2'],
  [40, 0, 80, 30, 10, 0x4f9e72, 'Level 3', 'Warehouses', 'Z3'],
  [40, 30, 80, 45, 5, 0xd6efe0, 'Level 1 · Gate A', 'Reception', 'Z1'],
  [80, 0, 120, 45, 7, 0x2f7a54, 'Level 4', 'Servers and labs', 'Z4'],
  [100, 0, 120, 18, 9.5, 0x1d5c40, 'Level 5 · Gate B', 'Vault · 3 factors', 'Z5'],
];

// Incident scenario → plan point to look at (same points as the old 3D model).
const FOCUS = {
  metal: [55, 58.5], etd: [55, 58.5], granted: [76, 66], revoked: [78, 68], expired: [85, 72], face: [85, 72],
  door: [70, 13], intr: [60, 17], cross: [68, 19], loiter: [55, 15], escort: [66, 13], bio: [90, 12],
  env: [18, 59.5], fight: [48, 71], bag: [61, 71], weapon: [55, 71], pattern: [84, 72], breach: [106, 64], circling: [100, 70],
  drone: [90, 30], 'air-drone': [90, 30],
};
const GATE_KEYS = ['air-unauth', 'air-unknown', 'air-rule', 'hacktool', 'deauth', 'jamming', 'eviltwin', 'blespam', 'air-attacktool', 'air-deauth', 'air-jamming', 'air-eviltwin', 'air-blespam', 'air-beaconflood'];

export function createSiteScene(stage, { getIncidents = () => [], deviceStatus = () => 'online', statusLabel = () => '', labelText = (k, t, s2) => [t, s2], imagery = true, onSelect = () => {} } = {}) {
  // labels come from the console (language, facility zone names, active-policy zone types); the English text is the fallback
  const L = (k, t, s2 = '') => { try { const r = labelText(k, t, s2); return Array.isArray(r) ? r : [t, s2]; } catch { return [t, s2]; } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noop = () => {};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  } catch (err) {
    stage.append(Object.assign(document.createElement('p'), { className: 'empty', textContent: `3D view unavailable: WebGL is not supported here (${err.message}).` }));
    return { trigger: noop, focusKey: noop, droneTo: noop, droneRecall: noop, drawScreen: noop, setAirspace: noop, setAircraft: noop, setSpace: noop, setSigns: noop, select: noop, view: noop, toggle: noop, resize: noop };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  stage.prepend(renderer.domElement);
  const labelsEl = document.createElement('div');
  labelsEl.className = 'm3-labels';
  labelsEl.setAttribute('aria-hidden', 'true');
  stage.append(labelsEl);
  const tmpV = new THREE.Vector3();
  const labels = [];
  const layers = { labels: true, facility: true, wireless: true, aircraft: true, satellites: true, roofs: true };
  let roofOp = 1; // 1 = roofs on, 0 = lifted off (animated)
  let peekUntil = 0; // an incident inside a building lifts the roofs for a few seconds

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c3d9);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 4_000_000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 260_000;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.screenSpacePanning = false;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9c8a6a, 0.75));
  const sun = new THREE.DirectionalLight(0xfff4e0, 0.95);
  sun.position.set(-90, 160, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 500 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.88, metalness: 0 }, o));
  const flat = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c, depthTest: false, depthWrite: false }, o));
  const P = (px, py) => planToLocal(px, py);

  // ================================================================= ground
  let site = { lat: 24.7136, lon: 46.6753 };
  let siteElevationFt = 0;
  const ground = new THREE.Group();
  scene.add(ground);
  const groundPlane = (w, d, mat, x, z, order) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0, z);
    m.renderOrder = order;
    ground.add(m);
    return m;
  };
  const baseMat = flat(imagery ? 0xcbb48a : 0xdedbd4);
  groundPlane(4_000_000, 4_000_000, baseMat, 0, 0, -20); // desert under everything (neutral when the location is unverified)
  let imageryOn = imagery;
  const schematic = new THREE.GridHelper(1200, 120, 0xb9b4aa, 0xcfcbc3);
  schematic.material.depthTest = false;
  schematic.material.depthWrite = false;
  schematic.renderOrder = -15;
  schematic.visible = !imagery;
  ground.add(schematic);
  const tileGroup = new THREE.Group();
  ground.add(tileGroup);
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  let tileKey = '';
  let tilesOk = 0;
  let tilesFailed = 0;
  const tileStatus = { ok: 0, failed: 0, total: 0 };
  function loadTiles() {
    if (!imageryOn) { tileGroup.clear(); tileKey = ''; tileStatus.ok = tileStatus.failed = tileStatus.total = 0; return; }
    const key = `${site.lat.toFixed(5)},${site.lon.toFixed(5)}`;
    if (key === tileKey) return;
    tileKey = key;
    tileGroup.clear();
    tilesOk = 0;
    tilesFailed = 0;
    let order = -19;
    let total = 0;
    for (const [z, r] of TILE_LAYERS) {
      order++;
      for (const t of tilesAround(site, z, r)) {
        total++;
        const mat = flat(0xffffff, { transparent: true, opacity: 0 });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(t.x1 - t.x0, t.z1 - t.z0), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set((t.x0 + t.x1) / 2, 0, (t.z0 + t.z1) / 2);
        m.renderOrder = order;
        tileGroup.add(m);
        loader.load(
          `/tiles/${t.z}/${t.x}/${t.y}.jpg`,
          (tex) => {
            tex.encoding = THREE.sRGBEncoding;
            tex.anisotropy = maxAniso;
            mat.map = tex;
            mat.opacity = 1;
            mat.transparent = false;
            mat.needsUpdate = true;
            tilesOk++;
            tileStatus.ok = tilesOk;
          },
          undefined,
          () => {
            tilesFailed++;
            tileStatus.failed = tilesFailed;
          },
        );
      }
    }
    tileStatus.total = total;
  }

  // The compound: our own ground over the imagery (the facility is drawn on top of it).
  const planRect = (x0, y0, x1, y1, color, order, o = {}) => {
    const a = P(x0, y0);
    const b = P(x1, y1);
    return groundPlane(b.x - a.x, b.z - a.z, flat(color, o), (a.x + b.x) / 2, (a.z + b.z) / 2, order);
  };
  planRect(-6, -6, 126, 69, 0xbfb29a, -10); // compound yard
  planRect(-30, 72, 150, 82, 0x3a3e43, -10); // street
  planRect(-30, 69, 150, 72, 0xa39d90, -10); // sidewalk
  planRect(-30, 76.8, 150, 77.2, 0xf5f5f4, -9); // lane marking
  planRect(40, 45, 80, 69, 0xd8d2c4, -9); // Gate A apron
  planRect(80, 45, 120, 69, 0x55595e, -9); // parking asphalt
  for (let x = 82; x <= 118; x += 6) planRect(x, 47, x + 0.4, 55, 0xe7e5e4, -8); // parking bays
  for (let x = 82; x <= 118; x += 6) planRect(x, 59, x + 0.4, 67, 0xe7e5e4, -8);
  planRect(0, 45, 40, 69, 0xc9c0a8, -9); // zone D yard
  // Shadow catcher over the compound so buildings throw shadows onto the ground.
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.32, depthWrite: false });
  {
    const a = P(-30, -30);
    const b = P(150, 90);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b.x - a.x, b.z - a.z), shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    m.receiveShadow = true;
    m.renderOrder = -5;
    scene.add(m);
  }

  // ================================================================= facility
  const facility = new THREE.Group();
  scene.add(facility);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x3b3326, transparent: true, opacity: 0.35 });
  // Roofs (slabs, parapets, the Level 5 gold outline) live in their own group so they can be
  // lifted off to look inside; everything else is in `facility`.
  const roofGroup = new THREE.Group();
  scene.add(roofGroup);
  const roofMats = new Set();
  let into = facility;
  function block(x0, y0, x1, y1, h, mat, y = 0, edges = true) {
    const a = P(x0, y0);
    const b = P(x1, y1);
    const g = new THREE.BoxGeometry(b.x - a.x, h, b.z - a.z);
    const m = new THREE.Mesh(g, mat);
    m.position.set((a.x + b.x) / 2, y + h / 2, (a.z + b.z) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    into.add(m);
    if (edges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat);
      e.position.copy(m.position);
      into.add(e);
    }
    return m;
  }
  /** Adds roof parts: block() calls inside `fn` go to the roof group. */
  function roof(fn) {
    into = roofGroup;
    fn();
    into = facility;
  }
  // Façade texture: sand-coloured Najdi walls with framed glass windows, floor bands and weathering.
  function facadeTexture(widthM, heightM2) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#e2d1aa');
    g.addColorStop(1, '#ccb98e');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    // faint vertical weathering streaks
    x.fillStyle = 'rgba(110,88,54,0.06)';
    for (let i = 0; i < 55; i++) x.fillRect(Math.random() * 256, Math.random() * 256, 2, 12 + Math.random() * 28);
    // cornice band at the top
    x.fillStyle = '#c7b082';
    x.fillRect(0, 0, 256, 9);
    // four window floors, each a framed pane of glass with a reflection and a mullion
    for (let fy = 30; fy < 250; fy += 56) {
      x.strokeStyle = 'rgba(92,72,46,0.16)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(0, fy - 10);
      x.lineTo(256, fy - 10);
      x.stroke();
      for (let wx = 18; wx < 250; wx += 46) {
        x.fillStyle = '#b4a079';
        x.fillRect(wx - 2, fy - 2, 32, 40);
        const wg = x.createLinearGradient(wx, fy, wx + 28, fy + 36);
        wg.addColorStop(0, '#5c7384');
        wg.addColorStop(0.5, '#44555f');
        wg.addColorStop(1, '#374651');
        x.fillStyle = wg;
        x.fillRect(wx, fy, 28, 36);
        x.fillStyle = 'rgba(255,255,255,0.13)';
        x.fillRect(wx + 2, fy + 2, 11, 15);
        x.fillStyle = 'rgba(0,0,0,0.20)';
        x.fillRect(wx + 13, fy, 2, 36);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(widthM / 10)), Math.max(1, Math.round(heightM2 / 11)));
    return tex;
  }
  // Buildings: four façade walls, a floor in the level's colour, and a removable roof.
  const roofHeights = [];
  const T = 0.6; // wall thickness in plan units (0.3 m)
  const parapetMat = M(0xc5ae84);
  roofMats.add(parapetMat);
  for (const [bx0, by0, bx1, by1, h, roofCol, name, sub, zid] of BUILDINGS) {
    // Level 5 sits inside Level 4: inset its walls so they do not share a face with Level 4's.
    const ins = name === 'Level 5' ? T * 1.5 : 0;
    const [x0, y0, x1, y1] = [bx0 + ins, by0 + ins, bx1 - ins, by1 - ins];
    const a = P(x0, y0);
    const b = P(x1, y1);
    const wX = b.x - a.x;
    const wZ = b.z - a.z;
    const alongX = M(0xffffff, { map: facadeTexture(wX, h) });
    const alongZ = M(0xffffff, { map: facadeTexture(wZ, h) });
    block(x0, y0, x1, y0 + T, h, alongX, 0, false);
    block(x0, y1 - T, x1, y1, h, alongX, 0, false);
    block(x0, y0 + T, x0 + T, y1 - T, h, alongZ, 0, false);
    block(x1 - T, y0 + T, x1, y1 - T, h, alongZ, 0, false);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(wX, h, wZ)), edgeMat);
    outline.position.set((a.x + b.x) / 2, h / 2, (a.z + b.z) / 2);
    facility.add(outline);
    const floor = new THREE.Color(roofCol).lerp(new THREE.Color(0xf5f1e8), 0.55);
    block(x0 + T, y0 + T, x1 - T, y1 - T, 0.08, M(floor, { roughness: 0.7 }), 0, false);
    // Realistic concrete/gravel roof, with a faint tint of the level colour so it still reads from above.
    const top = M(new THREE.Color(0xb3ab9a).lerp(new THREE.Color(roofCol), 0.16), { roughness: 0.97 });
    roofMats.add(top);
    const acMat = M(0x9aa0a6, { roughness: 0.6, metalness: 0.25 });
    const ductMat = M(0x8a9097, { roughness: 0.7 });
    roofMats.add(acMat);
    roofMats.add(ductMat);
    roof(() => {
      block(x0, y0, x1, y1, 0.3, top, h - 0.3, false);
      block(x0, y0, x1, y0 + T, 0.8, parapetMat, h, false);
      block(x0, y1 - T, x1, y1, 0.8, parapetMat, h, false);
      block(x0, y0, x0 + T, y1, 0.8, parapetMat, h, false);
      block(x1 - T, y0, x1, y1, 0.8, parapetMat, h, false);
      // rooftop plant: a couple of AC units and a duct run, scaled to the roof
      const cxp = (x0 + x1) / 2, cyp = (y0 + y1) / 2, wx2 = Math.min(5, (x1 - x0) * 0.18);
      block(cxp - wx2, cyp - 3, cxp - wx2 + 4, cyp - 0.5, 1.1, acMat, h, false);
      block(cxp + 1.5, cyp + 0.5, cxp + 5, cyp + 3, 0.9, acMat, h, false);
      block(cxp - wx2 + 4, cyp - 2, cxp + 1.5, cyp - 1.2, 0.35, ductMat, h + 0.2, false);
    });
    roofHeights.push({ x0: bx0, y0: by0, x1: bx1, y1: by1, h });
    // label anchor: the roof centre, except where a smaller building or the gate label sits on it
    const la = zid === 'Z4' ? P(88, 34) : zid === 'Z1' ? P(73, 36) : null;
    addLabel(...L(`zone:${zid}`, name, sub), () => tmpV.set(la ? la.x : (a.x + b.x) / 2, h * roofOp + 3, la ? la.z : (a.z + b.z) / 2), { maxDist: 900, cls: zid === 'Z5' ? 'alert' : '', pri: 4 });
  }
  // Level 5 vault: gold outline on its roof.
  {
    const a = P(100, 0);
    const b = P(120, 18);
    const pts = [[a.x, a.z], [b.x, a.z], [b.x, b.z], [a.x, b.z], [a.x, a.z]].map(([x, z]) => new THREE.Vector3(x, 10.4, z));
    const goldMat = new THREE.LineBasicMaterial({ color: 0xd4a017 });
    roofMats.add(goldMat);
    roofGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), goldMat));
  }
  const roofAt = (px, py) => roofHeights.filter((r) => px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1).reduce((m, r) => Math.max(m, r.h), 0);

  // Inside (seen with the roofs off): what each level holds.
  {
    const desk = M(0xe7dcc8, { roughness: 0.7 });
    const chair = M(0x334155);
    for (let px = 4; px <= 32; px += 7) for (let py = 5; py <= 38; py += 6.5) {
      block(px, py, px + 3.6, py + 1.6, 0.75, desk, 0, false); // Level 2 offices: desks
      block(px + 1.2, py + 1.9, px + 2.4, py + 3, 0.5, chair, 0, false);
    }
    block(19.5, 1, 20.1, 44, 3, M(0xd9c6a2), 0, false); // Level 2 corridor wall
    const rack = M(0x9aa3ab, { roughness: 0.5, metalness: 0.4 });
    const cargo = M(0xb7884f);
    for (let py = 4; py <= 24; py += 5) {
      block(43, py, 77, py + 1.6, 3.4, rack, 0, false); // Level 3 warehouse racks
      for (let px = 44; px < 76; px += 4.5) block(px, py + 0.2, px + 2.6, py + 1.4, 0.9, cargo, 1.2, false);
    }
    block(53, 37, 67, 39.5, 1.1, desk, 0, false); // Level 1 reception desk
    for (let px = 44; px <= 50; px += 3) block(px, 33, px + 2, 35, 0.45, chair, 0, false);
    const server = M(0x1e293b, { roughness: 0.4, metalness: 0.3 });
    const led = M(0x0b1220, { emissive: 0x22c55e, emissiveIntensity: 0.6 });
    for (let px = 83; px <= 96; px += 3.5) {
      block(px, 22, px + 1.6, 42, 2.1, server, 0, false); // Level 4 server racks
      block(px + 1.6, 23, px + 1.65, 41, 1.6, led, 0.3, false);
    }
    for (let py = 23; py <= 37; py += 7) block(103, py, 117, py + 2.4, 0.9, M(0xf1f5f9, { roughness: 0.5 }), 0, false); // labs
    block(107, 4, 115, 12, 2.6, M(0x6b7280, { roughness: 0.3, metalness: 0.7 }), 0, true); // Level 5 vault
    block(110, 11.9, 112, 12.3, 1.6, M(0xd4a017, { roughness: 0.3, metalness: 0.8 }), 0.4, false);
  }

  // Checkpoint A: screening canopy on posts, kiosk and the pedestrian barrier.
  const white = M(0xf4f4f2, { roughness: 0.6 });
  const steel = M(0x9aa3ab, { roughness: 0.4, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false });
  block(43, 51.5, 71, 69.5, 0.35, white, 4.2);
  for (const [x, y] of [[43.5, 52], [70.5, 52], [43.5, 69], [70.5, 69]]) block(x - 0.4, y - 0.4, x + 0.4, y + 0.4, 4.2, steel, 0, false);
  block(44, 58, 70, 64, 2.6, glass, 0, true); // screening tunnel
  block(80.6, 69.6, 83, 71.6, 2.2, M(0x2a3138)); // Gate A kiosk
  block(76, 63, 84, 63.5, 1.1, steel, 0, false); // barrier
  addLabel(...L('zone:GA', 'Gate A · Level 1', 'Entry checkpoint · screening'), () => tmpV.copy(pv(57, 60)).setY(7), { maxDist: 600, pri: 4 });
  addLabel(...L('kiosk:A', 'Gate A', 'NFC reader kiosk'), () => tmpV.copy(pv(82, 70.6)).setY(4.5), { maxDist: 160, pri: 1 });

  // Zone D: glass environmental annex, drone pad beside it.
  block(7, 52, 29, 67, 4.5, glass, 0, true);
  block(6.6, 51.6, 29.4, 67.4, 0.3, white, 4.5);
  addLabel(...L('zone:D', 'Zone D', 'Environmental annex'), () => tmpV.copy(pv(18, 59.5)).setY(7.5), { maxDist: 600, pri: 3 });
  const padPos = pv(10, 51);
  {
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40), new THREE.MeshBasicMaterial({ color: 0xf2b705 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(padPos.x, 0.05, padPos.z);
    facility.add(pad);
  }

  // Watchtower (T-1) and the perimeter fence with a gap at Gate A.
  {
    const t = pv(4.5, 64);
    const col = new THREE.Mesh(new THREE.BoxGeometry(2.4, 12, 2.4), M(0xd9c6a2));
    col.position.set(t.x, 6, t.z);
    col.castShadow = true;
    facility.add(col);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 3.6), glass);
    cab.position.set(t.x, 13.2, t.z);
    facility.add(cab);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), M(0xc5ae84));
    cap.position.set(t.x, 14.6, t.z);
    cap.castShadow = true;
    facility.add(cap);
    addLabel(...L('tower:T-1', 'Watchtower T-1', '360° camera'), () => tmpV.set(t.x, 17, t.z), { maxDist: 600, pri: 3 });
  }
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, transparent: true, opacity: 0.55, depthWrite: false });
  for (const [x0, y0, x1, y1] of [[-4, -4, 124, -3.6], [-4, -4, -3.6, 69], [123.6, -4, 124, 69], [-4, 68.6, 76, 69], [84, 68.6, 124, 69]]) block(x0, y0, x1, y1, 2.4, fenceMat, 0, false);
  // Parked cars and palms along the street (for scale).
  const carCols = [0xf1f5f9, 0x1f2937, 0x94a3b8, 0x7f1d1d, 0xe5e7eb, 0x334155];
  [[85, 49], [97, 49], [109, 49], [91, 61], [103, 61], [115, 61]].forEach(([x, y], i) => {
    block(x - 1, y, x + 2.6, y + 8.6, 1.4, M(carCols[i % carCols.length], { roughness: 0.4, metalness: 0.3 }), 0, false);
    block(x - 0.6, y + 2, x + 2.2, y + 6, 0.6, M(0x1e293b, { roughness: 0.2 }), 1.4, false);
  });
  // Date palms: a slim trunk and drooping fronds.
  const trunk = M(0x8b6b45);
  const frond = M(0x355e2b, { side: THREE.DoubleSide });
  const frondG = new THREE.PlaneGeometry(0.5, 2.4);
  frondG.translate(0, 1.2, 0);
  for (let x = -20; x <= 140; x += 16) {
    const p = pv(x, 70.5);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 6.5, 6), trunk);
    tr.position.set(p.x, 3.25, p.z);
    tr.castShadow = true;
    facility.add(tr);
    for (let k = 0; k < 9; k++) {
      const f = new THREE.Mesh(frondG, frond);
      f.position.set(p.x, 6.4, p.z);
      f.rotation.set(0, (k / 9) * Math.PI * 2 + x, 0, 'YXZ');
      f.rotateX(-1.15);
      f.castShadow = true;
      facility.add(f);
    }
  }

  // ================================================================= labels
  function pv(px, py) {
    const p = P(px, py);
    return new THREE.Vector3(p.x, 0, p.z);
  }
  /** HTML label at a 3D point; shown only within [minDist, maxDist] of the camera and while its layer is on. */
  function addLabel(text, sub, at, { maxDist = Infinity, minDist = 0, cls = '', layer = null, pri = 2 } = {}) {
    const el = document.createElement('div');
    el.className = `m3-lbl ${cls}`.trim();
    el.textContent = text;
    const small = document.createElement('small');
    if (sub) small.textContent = sub;
    el.append(small);
    labelsEl.append(el);
    const l = { el, small, at, maxDist, minDist, layer, pri: cls === 'alert' ? Math.max(pri, 5) : pri, w: 0, h: 0 };
    labels.push(l);
    return l;
  }
  function removeLabel(l) {
    if (!l) return;
    l.el.remove();
    const i = labels.indexOf(l);
    if (i >= 0) labels.splice(i, 1);
  }

  // ================================================================= icons
  const texCache = new Map();
  /** Round badge with an icon (devices the ESP32 hears, plan devices). */
  function badgeTexture(iconName, ring, fill = 'rgba(10,15,26,0.92)') {
    const k = `b|${iconName}|${ring}|${fill}`;
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = fill;
    x.beginPath();
    x.arc(48, 48, 40, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = ring;
    x.lineWidth = 8;
    x.stroke();
    if (iconName) {
      x.save();
      x.translate(24, 24);
      x.scale(2, 2);
      x.strokeStyle = '#f1f5f9';
      x.lineWidth = 1.9;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.stroke(new Path2D(PATHS[iconName] ?? PATHS.device));
      x.restore();
    }
    const tex = new THREE.CanvasTexture(c);
    texCache.set(k, tex);
    return tex;
  }
  /** Filled silhouette (aircraft, satellite) in a colour, nose up. */
  function glyphTexture(iconName, color, filled) {
    const k = `g|${iconName}|${color}|${filled}`;
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.translate(16, 16);
    x.scale(4, 4);
    const p = new Path2D(PATHS[iconName]);
    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(8,12,20,0.9)';
    x.lineWidth = 2.6;
    x.stroke(p);
    if (filled) {
      x.fillStyle = color;
      x.fill(p);
    } else {
      x.strokeStyle = color;
      x.lineWidth = 1.7;
      x.stroke(p);
    }
    const tex = new THREE.CanvasTexture(c);
    texCache.set(k, tex);
    return tex;
  }
  const screenSprite = (tex, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
    s.scale.set(size, size, 1);
    s.renderOrder = 20;
    return s;
  };

  // ================================================================= plan devices
  const pickables = [];
  const devGroup = new THREE.Group();
  scene.add(devGroup);
  const KIND_ICON = { air: 'sensor', pc: 'device', node: 'device', cam: 'eye', drone: 'drone', det: 'shield', act: 'alert', s: 'sensor' };
  const devPins = new Map();
  const pinLineMat = new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.55 });
  for (const d of DEVICES) {
    if (d.id === 'DR-1') continue; // the drone model itself is the marker
    const base = pv(d.x, d.y);
    const roofH = roofAt(d.x, d.y);
    const h = roofH + (d.real ? 4.5 : 2.6);
    const inH = roofH > 0 ? 2.4 : h; // with the roof off, pins inside drop to the room
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([base.clone().setY(roofH), base.clone().setY(h)]), pinLineMat);
    devGroup.add(line);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(KIND_ICON[d.kind], STATUS_COLOR.online), depthTest: true }));
    const sz = d.real ? 2.6 : 1.7;
    s.scale.set(sz, sz, 1);
    s.position.copy(base).setY(h);
    s.userData = { pick: { kind: 'device', id: d.id }, sz };
    devGroup.add(s);
    pickables.push(s);
    const lbl = addLabel(d.id, '', () => tmpV.copy(s.position).setY(s.position.y + 1.6), { maxDist: d.real ? 260 : 48, cls: d.real ? 'air' : 'shape', layer: 'facility', pri: d.real ? 2 : 0 });
    devPins.set(d.id, { d, s, line, lbl, status: null, roofH, outH: h, inH });
  }
  /** Pins follow the roofs: on the roof when it is on, inside the room when it is off. */
  function placePins() {
    for (const p of devPins.values()) {
      if (p.roofH === 0) continue;
      const y = p.inH + (p.outH - p.inH) * roofOp;
      p.s.position.y = y;
      const pos = p.line.geometry.attributes.position;
      pos.setY(0, p.roofH * roofOp);
      pos.setY(1, y);
      pos.needsUpdate = true;
    }
    for (const sp of signGroup.children) {
      const { outH, inH } = sp.userData;
      sp.position.y = inH + (outH - inH) * roofOp;
    }
  }
  function refreshDevices() {
    for (const p of devPins.values()) {
      const st = deviceStatus(p.d);
      if (st === p.status) continue;
      p.status = st;
      p.s.material.map = badgeTexture(KIND_ICON[p.d.kind], STATUS_COLOR[st] ?? STATUS_COLOR.unknown);
      p.s.material.needsUpdate = true;
      p.lbl.small.textContent = statusLabel(st, p.d) || '';
      p.lbl.w = 0;
    }
  }

  // ================================================================= incidents and signs
  const incGroup = new THREE.Group();
  scene.add(incGroup);
  const incRingMat = new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
  const incBeamMat = new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.18, depthWrite: false });
  function drawIncidents() {
    incGroup.clear();
    for (const i of getIncidents()) {
      if (!Array.isArray(i.at)) continue;
      const p = pv(i.at[0], i.at[1]);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2, 40), incRingMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.15, p.z);
      ring.userData.pulse = true;
      incGroup.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 12, 1, true), incBeamMat);
      beam.position.set(p.x, 15, p.z);
      incGroup.add(beam);
    }
  }
  const signGroup = new THREE.Group();
  scene.add(signGroup);
  function signTexture(bad, hazard) {
    const k = `s|${bad}|${hazard}`;
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.beginPath();
    x.moveTo(32, 6);
    x.lineTo(60, 56);
    x.lineTo(4, 56);
    x.closePath();
    x.fillStyle = bad ? '#f87171' : '#facc15';
    x.fill();
    x.lineWidth = hazard ? 5 : 2;
    x.strokeStyle = '#0f172a';
    x.stroke();
    const tex = new THREE.CanvasTexture(c);
    texCache.set(k, tex);
    return tex;
  }
  function setSigns(signs = []) {
    signGroup.clear();
    for (const s of signs) {
      if (s.x === null || s.y === null || s.x === undefined) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(s.status !== 'installed', s.hazard) }));
      sp.scale.set(1.1, 1.1, 1);
      const outH = roofAt(s.x, s.y) + 1.2;
      sp.userData = { pick: { kind: 'sign', sign: s }, outH, inH: roofAt(s.x, s.y) > 0 ? 1.8 : outH };
      sp.position.copy(pv(s.x, s.y)).setY(sp.userData.inH + (outH - sp.userData.inH) * roofOp);
      signGroup.add(sp);
      pickables.push(sp);
    }
  }

  // ================================================================= wireless layer at Gate A
  const wifiGroup = new THREE.Group();
  const as1 = DEVICES.find((d) => d.id === 'AS-1');
  const as1Pos = pv(as1.x, as1.y);
  wifiGroup.position.copy(as1Pos);
  scene.add(wifiGroup);
  const zoneMat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
  const ZONE_R = 8;
  wifiGroup.add(new THREE.Mesh(new THREE.SphereGeometry(ZONE_R, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), zoneMat));
  const zoneEdgeMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 });
  wifiGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(ZONE_R, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)), zoneEdgeMat));
  const wifiRingMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const wifiPulse = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 48), wifiRingMat);
  wifiPulse.rotation.x = -Math.PI / 2;
  wifiPulse.position.y = 0.2;
  wifiGroup.add(wifiPulse);
  const wifiMarkers = new Map();
  let wifi = { level: 'idle', devices: [] };
  const hashA = (s) => {
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return (h / 4294967296) * Math.PI * 2;
  };
  /** state: { level: good|warning|critical|idle, devices: [{ key, type, status, dist (m), atGate }] } */
  function setAirspace(state) {
    wifi = state ?? { level: 'idle', devices: [] };
    const col = { good: 0x4ade80, warning: 0xfbbf24, critical: 0xf87171, idle: 0x64748b }[wifi.level] ?? 0x64748b;
    zoneMat.color.setHex(col);
    zoneEdgeMat.color.setHex(col);
    const shown = (wifi.devices ?? []).slice(0, 24);
    const keep = new Set(shown.map((d) => d.key));
    for (const [k, s] of wifiMarkers) {
      if (!keep.has(k)) {
        wifiGroup.remove(s);
        wifiMarkers.delete(k);
        const i = pickables.indexOf(s);
        if (i >= 0) pickables.splice(i, 1);
      }
    }
    for (const d of shown) {
      let s = wifiMarkers.get(d.key);
      if (!s) {
        s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
        s.renderOrder = 10;
        s.userData.angle = hashA(d.key);
        wifiGroup.add(s);
        wifiMarkers.set(d.key, s);
        pickables.push(s);
      }
      s.material.map = badgeTexture(TYPE_ICON[d.type] ?? 'device', WIFI_COLOR[d.status] ?? '#9aabc2');
      s.material.needsUpdate = true;
      s.userData.r = Math.min(40, Math.max(1.5, d.dist ?? 10));
      s.userData.status = d.status;
      s.userData.pick = { kind: 'wifi', device: d };
    }
  }

  // ================================================================= airspace: zones, airports, tracks
  const airGroup = new THREE.Group();
  scene.add(airGroup);
  const zoneGroup = new THREE.Group();
  airGroup.add(zoneGroup);
  const ringLabels = [];
  function circle(r, color, y = 1, dashed = false, opacity = 0.9) {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sin(a) * r, y, -Math.cos(a) * r));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: r / 40, gapSize: r / 60, transparent: true, opacity }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.Line(g, mat);
    if (dashed) l.computeLineDistances();
    return l;
  }
  let zones = null;
  function drawZones(z) {
    const key = JSON.stringify(z);
    if (zones === key) return;
    zones = key;
    zoneGroup.clear();
    ringLabels.splice(0).forEach(removeLabel);
    // Each ring's label sits at its own bearing so they never stack.
    const ring = (r, hex, name, dashed, minD, maxD, bearing) => {
      if (!Number.isFinite(r) || r <= 0) return;
      zoneGroup.add(circle(r, hex, 2, dashed));
      const a = (bearing * Math.PI) / 180;
      ringLabels.push(addLabel(name, `${(r / 1000).toFixed(r < 10_000 ? 1 : 0)} km`, () => tmpV.set(Math.sin(a) * r, 4, -Math.cos(a) * r), { minDist: minD, maxDist: maxD, cls: 'ring', layer: 'aircraft' }));
    };
    ring(z.monitorM, 0x5eead4, L('ring:monitor', 'Monitor')[0], false, 6000, 160_000, 90);
    ring(z.warningM, 0xfbbf24, L('ring:warning', 'Warning')[0], false, 4000, 90_000, 60);
    ring(z.restrictedM, 0xf87171, L('ring:restricted', 'Restricted')[0], false, 2000, 60_000, 30);
    ring(z.droneCriticalM, 0xf87171, L('ring:drone', 'Drone critical')[0], true, 400, 25_000, 0);
    // Restricted volume: a cylinder up to the ceiling.
    const ceil = heightM(z.ceilingFt, 0);
    if (z.restrictedM && ceil > 0) {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(z.restrictedM, z.restrictedM, ceil, 96, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }),
      );
      cyl.position.y = ceil / 2;
      zoneGroup.add(cyl);
      zoneGroup.add(circle(z.restrictedM, 0xf87171, ceil, true, 0.6));
    }
  }
  const airportGroup = new THREE.Group();
  airGroup.add(airportGroup);
  const airportLabels = [];
  function drawAirports() {
    airportGroup.clear();
    airportLabels.splice(0).forEach(removeLabel);
    for (const a of AIRFIELDS) {
      for (const rw of a.runways ?? []) {
        const [p, q] = rw.ends.map(([lat, lon]) => geoToLocal(site, lat, lon));
        airportGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x, 3, p.z), new THREE.Vector3(q.x, 3, q.z)]), new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.8 })));
      }
      const rw = a.runways?.[0];
      if (!rw) continue;
      const m = geoToLocal(site, (rw.ends[0][0] + rw.ends[1][0]) / 2, (rw.ends[0][1] + rw.ends[1][1]) / 2);
      airportLabels.push(addLabel(a.code, a.name, () => tmpV.set(m.x, 60, m.z), { minDist: 3000, maxDist: 90_000, cls: 'ring', layer: 'aircraft' }));
    }
  }

  const trackGroup = new THREE.Group();
  airGroup.add(trackGroup);
  const tracks = new Map(); // hex -> { sprite, stem, trail, label, data, base, t }
  let aircraftMsg = null;
  const KT = 0.514444;
  function trackColor(tr) {
    return tr.simulated ? SIM_COLOR : (LEVEL_COLOR[tr.level] ?? LEVEL_COLOR.normal);
  }
  function setAircraft(msg) {
    aircraftMsg = msg;
    if (msg?.site && Number.isFinite(msg.site.lat)) {
      const moved = Math.abs(msg.site.lat - site.lat) > 1e-6 || Math.abs(msg.site.lon - site.lon) > 1e-6;
      site = { lat: msg.site.lat, lon: msg.site.lon };
      if (moved || (!tileKey && imageryOn)) {
        loadTiles();
        drawAirports();
      }
    }
    if (msg?.zones) {
      siteElevationFt = msg.zones.siteElevationFt ?? 0;
      drawZones(msg.zones);
    }
    const list = (msg?.list ?? []).filter((t) => (t.kind === 'aircraft' || t.kind === 'drone') && Number.isFinite(t.lat) && Number.isFinite(t.lon));
    const keep = new Set(list.map((t) => t.hex));
    for (const [hex, o] of tracks) {
      if (keep.has(hex)) continue;
      trackGroup.remove(o.sprite, o.stem, o.trail);
      removeLabel(o.label);
      const i = pickables.indexOf(o.sprite);
      if (i >= 0) pickables.splice(i, 1);
      tracks.delete(hex);
    }
    for (const tr of list) {
      const color = trackColor(tr);
      const iconName = tr.kind === 'drone' ? 'drone' : 'plane';
      let o = tracks.get(tr.hex);
      if (!o) {
        const sprite = screenSprite(glyphTexture(iconName, color, iconName === 'plane'), tr.kind === 'drone' ? 0.05 : 0.055);
        const stem = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color, dashSize: 40, gapSize: 30, transparent: true, opacity: 0.55 }));
        const trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
        trackGroup.add(sprite, stem, trail);
        pickables.push(sprite);
        o = { sprite, stem, trail, label: addLabel('', '', () => tmpV.copy(o.sprite.position), { cls: 'track', layer: 'aircraft' }) };
        tracks.set(tr.hex, o);
      }
      const ground = geoToLocal(site, tr.lat, tr.lon);
      const y = heightM(tr.altitudeFt, siteElevationFt);
      o.base = new THREE.Vector3(ground.x, Math.max(y, 3), ground.z);
      o.t = performance.now();
      o.data = tr;
      o.sprite.material.map = glyphTexture(iconName, color, iconName === 'plane');
      o.sprite.material.rotation = -(((tr.track ?? 0) * Math.PI) / 180);
      o.sprite.material.needsUpdate = true;
      o.sprite.userData.pick = { kind: 'track', hex: tr.hex };
      o.stem.material.color.set(color);
      o.trail.material.color.set(color);
      o.trail.geometry.setFromPoints((tr.trail ?? []).filter((p) => Number.isFinite(p[0])).map(([lat, lon, alt]) => {
        const g = geoToLocal(site, lat, lon);
        return new THREE.Vector3(g.x, Math.max(heightM(alt, siteElevationFt), 3), g.z);
      }));
      const name = tr.callsign || tr.name || tr.registration || tr.hex.toUpperCase();
      o.label.el.firstChild.textContent = `${tr.simulated ? 'SIM · ' : ''}${name}`;
      o.label.small.textContent = `${Number.isFinite(tr.altitudeFt) ? `${Math.round(tr.altitudeFt).toLocaleString('en-US')} ft` : 'alt ?'} · ${Number.isFinite(tr.distanceM) ? `${(tr.distanceM / 1000).toFixed(1)} km` : ''}`;
      o.label.el.style.borderColor = color;
    }
  }
  function moveTracks(now) {
    for (const o of tracks.values()) {
      const tr = o.data;
      const p = o.base.clone();
      // Dead reckoning between updates (≤ 15 s) so the aircraft glide instead of jumping.
      if (!reduce && Number.isFinite(tr.speedKt) && Number.isFinite(tr.track) && !tr.onGround) {
        const dt = Math.min(15, (now - o.t) / 1000);
        const d = tr.speedKt * KT * dt;
        const a = (tr.track * Math.PI) / 180;
        p.x += Math.sin(a) * d;
        p.z -= Math.cos(a) * d;
      }
      o.sprite.position.copy(p);
      o.stem.geometry.setFromPoints([new THREE.Vector3(p.x, 0, p.z), p]);
      o.stem.computeLineDistances();
    }
  }

  // ================================================================= space: the sky dome
  const spaceGroup = new THREE.Group();
  scene.add(spaceGroup);
  const domeGrid = new THREE.Group();
  spaceGroup.add(domeGrid);
  {
    const gridMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.35 });
    for (const el of [0, 30, 60]) {
      const pts = [];
      for (let az = 0; az <= 360; az += 3) {
        const q = skyPoint(az, el, SKY_R);
        pts.push(new THREE.Vector3(q.x, q.y + (el === 0 ? 30 : 0), q.z));
      }
      domeGrid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (const az of [0, 90, 180, 270]) {
      const pts = [];
      for (let el = 0; el <= 90; el += 3) {
        const q = skyPoint(az, el, SKY_R);
        pts.push(new THREE.Vector3(q.x, q.y, q.z));
      }
      domeGrid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
  }
  ['N', 'E', 'S', 'W'].forEach((n, i) => addLabel(L(`sky:${n}`, n)[0], i === 0 ? L('sky:note', 'sky dome · not to scale')[0] : '', () => {
    const q = skyPoint(i * 90, 0, SKY_R);
    return tmpV.set(q.x, 400, q.z);
  }, { minDist: 15_000, cls: 'ring', layer: 'satellites' }));
  const satGroup = new THREE.Group();
  spaceGroup.add(satGroup);
  const sats = new Map(); // norad|name -> { sprite, label }
  let spaceMsg = null;
  let overheadNames = new Set();
  const footprintMat = new THREE.LineDashedMaterial({ color: 0xf87171, dashSize: 900, gapSize: 600, transparent: true, opacity: 0.9 });
  function setSpace(msg) {
    spaceMsg = msg;
    satGroup.clear();
    for (const o of sats.values()) {
      removeLabel(o.label);
      const i = pickables.indexOf(o.sprite);
      if (i >= 0) pickables.splice(i, 1);
    }
    sats.clear();
    if (!msg) return;
    overheadNames = new Set(msg.overhead ?? []);
    // Paths of passes in progress / next (the server sends paths for the first few).
    for (const p of (msg.passes ?? []).filter((x) => x.path?.length).slice(0, 4)) {
      const pts = p.path.map(([az, el]) => {
        const q = skyPoint(az, el, SKY_R);
        return new THREE.Vector3(q.x, q.y, q.z);
      });
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: p.imaging ? 0x7dd3fc : 0x94a3b8, dashSize: 1200, gapSize: 900, transparent: true, opacity: p.imaging ? 0.8 : 0.4 }));
      l.computeLineDistances();
      satGroup.add(l);
    }
    const now = [...(msg.sky ?? [])];
    if (msg.demo?.pos) now.push({ name: msg.demo.name, norad: msg.demo.norad, imaging: true, az: msg.demo.pos.az, el: msg.demo.pos.el, simulated: true });
    for (const s of now) {
      const over = overheadNames.has(s.name) || (s.simulated && msg.demo?.countdownSec <= 0);
      const color = s.simulated ? SIM_COLOR : over ? '#f87171' : s.imaging ? '#7dd3fc' : '#94a3b8';
      const sprite = screenSprite(glyphTexture('satellite', color, false), s.imaging ? 0.045 : 0.026);
      const q = skyPoint(s.az, s.el, SKY_R);
      sprite.position.set(q.x, q.y, q.z);
      sprite.userData.pick = { kind: 'sat', sat: { ...s, overhead: over } };
      satGroup.add(sprite);
      pickables.push(sprite);
      let label = null;
      if (s.imaging) {
        label = addLabel(`${s.simulated ? L('sat:sim', 'SIM')[0] + ' · ' : ''}${s.name}`, over ? L('sat:over', 'OVERHEAD NOW')[0] : `${L('sat:el', 'el')[0]} ${Math.round(s.el)}°`, () => tmpV.copy(sprite.position), { cls: over ? 'alert' : 'sat', layer: 'satellites' });
        label.el.style.borderColor = color;
      }
      if (over) {
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([sprite.position.clone(), new THREE.Vector3(0, 0, 0)]), footprintMat);
        l.computeLineDistances();
        satGroup.add(l);
      }
      sats.set(`${s.norad}|${s.name}`, { sprite, label });
    }
  }

  // ================================================================= drone DR-1
  const dark = M(0x1f2427, { roughness: 0.5 });
  const drone = new THREE.Group();
  scene.add(drone);
  const DHOME = new THREE.Vector3(padPos.x, 0.5, padPos.z);
  drone.position.copy(DHOME);
  drone.scale.setScalar(1.6);
  drone.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), dark));
  const rotors = [];
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.1), dark);
    arm.position.set(a * 0.3, 0, b * 0.3);
    arm.rotation.y = Math.atan2(-b, a);
    drone.add(arm);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.07), dark);
    blade.position.set(a * 0.6, 0.1, b * 0.6);
    drone.add(blade);
    rotors.push(blade);
  });
  const droneLed = M(0x111111, { emissive: 0x22c55e, emissiveIntensity: 1 });
  {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.15), droneLed);
    led.position.set(0, 0.14, -0.22);
    drone.add(led);
  }
  drone.traverse((o) => (o.castShadow = true));
  const droneHit = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture('drone', STATUS_COLOR.online), depthTest: true }));
  droneHit.scale.set(1.4, 1.4, 1);
  droneHit.position.y = 1.6;
  droneHit.userData.pick = { kind: 'device', id: 'DR-1' };
  drone.add(droneHit);
  pickables.push(droneHit);
  addLabel(...L('drone:DR-1', 'DR-1', 'Drone'), () => tmpV.copy(drone.position).setY(drone.position.y + 4), { maxDist: 300, cls: 'shape', layer: 'facility', pri: 1 });
  const dconeG = new THREE.ConeGeometry(8, 22, 32, 1, true);
  dconeG.translate(0, -11, 0);
  const dcone = new THREE.Mesh(dconeG, new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
  dcone.visible = false;
  dcone.scale.setScalar(1 / 1.6);
  drone.add(dcone);
  let flight = null;

  // ================================================================= camera presets and focus
  const VIEWS = {
    facility: { pos: [70, 62, 92], tgt: [0, 0, 6] },
    gate: { pos: [as1Pos.x + 26, 22, as1Pos.z + 34], tgt: [as1Pos.x, 2, as1Pos.z] },
    airspace: { pos: [0, 21_000, 30_000], tgt: [0, 0, 0] },
    sky: { pos: [0, 52_000, 118_000], tgt: [0, 9_000, 0] },
  };
  let fly = null;
  function flyToPose(pos, tgt) {
    fly = { from: camera.position.clone(), fromT: controls.target.clone(), to: new THREE.Vector3(...pos), toT: new THREE.Vector3(...tgt), s: performance.now() };
  }
  function view(name) {
    const v = VIEWS[name];
    if (v) flyToPose(v.pos, v.tgt);
  }
  function flyToPoint(p, dist = 70) {
    const off = camera.position.clone().sub(controls.target);
    if (off.length() > 2000 || off.length() < 1) off.set(0.6, 0.55, 0.75);
    off.normalize().multiplyScalar(dist);
    off.y = Math.max(off.y, dist * 0.5);
    fly = { from: camera.position.clone(), fromT: controls.target.clone(), to: p.clone().add(off), toT: p.clone(), s: performance.now() };
  }
  camera.position.set(...VIEWS.facility.pos);
  controls.target.set(...VIEWS.facility.tgt);

  const flashes = []; // { pos, t0 }
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const flashMesh = new THREE.Mesh(new THREE.RingGeometry(2, 2.6, 48), flashMat);
  flashMesh.rotation.x = -Math.PI / 2;
  flashMesh.visible = false;
  scene.add(flashMesh);
  function pointOf(k) {
    if (FOCUS[k]) return pv(...FOCUS[k]);
    if (GATE_KEYS.includes(k)) return as1Pos.clone();
    const inc = getIncidents().find((i) => i.key === k);
    return Array.isArray(inc?.at) ? pv(inc.at[0], inc.at[1]) : null;
  }
  function trigger(k) {
    if (typeof k === 'string' && /^airspace\|/.test(k)) return view('airspace');
    if (typeof k === 'string' && /sat|space/.test(k)) return view('sky');
    const p = pointOf(k);
    if (!p) return;
    flashes.push({ pos: p, t0: performance.now() });
    if (insideBuilding(p)) peekUntil = performance.now() + 8000;
    flyToPoint(p, 60);
  }
  const insideBuilding = (p) => roofAt(p.x / PLAN_M + PLAN_W / 2, p.z / PLAN_M + PLAN_H / 2) > 0;
  function focusKey(k) {
    const p = pointOf(k);
    if (p) flyToPoint(p, 80);
  }
  function droneTo(k, atPlan) {
    const p = (k && pointOf(k)) || (Array.isArray(atPlan) ? pv(atPlan[0], atPlan[1]) : null);
    if (!p) return;
    flight = { target: p, t0: performance.now() };
    flyToPoint(p, 90);
  }
  function droneRecall() {
    if (flight) flight.t0 = performance.now() - 7500;
  }

  // ================================================================= picking and selection
  const ray = new THREE.Raycaster();
  ray.camera = camera;
  let down = null;
  let selectedPick = null;
  const selRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, transparent: true }));
  selRing.visible = false;
  selRing.renderOrder = 25;
  scene.add(selRing);
  renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    const hit = ray.intersectObjects(pickables.filter((o) => isShown(o)), false)[0];
    if (hit) {
      selectedPick = hit.object.userData.pick;
      onSelect(selectedPick);
    }
  });
  const isShown = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  /** Selection from the side list (devices). */
  function select(pick) {
    selectedPick = pick;
    if (pick?.kind === 'device') {
      const p = devPins.get(pick.id);
      if (p) flyToPoint(p.s.position.clone(), 45);
      else if (pick.id === 'DR-1') flyToPoint(drone.position.clone(), 45);
    }
  }
  function selectedObject() {
    if (!selectedPick) return null;
    if (selectedPick.kind === 'device') return selectedPick.id === 'DR-1' ? droneHit : devPins.get(selectedPick.id)?.s;
    if (selectedPick.kind === 'track') return tracks.get(selectedPick.hex)?.sprite;
    return null;
  }
  const trackData = (hex) => tracks.get(hex)?.data ?? null;

  // ================================================================= toggles
  function toggle(name, on) {
    layers[name] = on;
    if (name === 'wireless') wifiGroup.visible = on;
    if (name === 'aircraft') airGroup.visible = on;
    if (name === 'satellites') spaceGroup.visible = on;
    if (name === 'facility') devGroup.visible = signGroup.visible = on;
    if (name === 'roofs') {
      peekUntil = 0;
      // Looking inside needs a view from above: tilt down over the facility unless already steep.
      const off = camera.position.clone().sub(controls.target);
      if (!on && off.length() < 600 && off.y / off.length() < 0.8) flyToPose([18, 92, 62], [0, 0, -2]);
    }
  }

  // ================================================================= frame loop
  function resize() {
    const w = stage.clientWidth;
    const hgt = stage.clientHeight;
    if (!w || !hgt) return;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.fov = w < 560 ? 50 : 40;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  const green = new THREE.Color(0x22c55e);
  const amber = new THREE.Color(0xf59e0b);
  const proj = new THREE.Vector3();
  let lastSlow = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    if (stage.offsetParent === null) return; // hidden page: no GPU work
    const now = performance.now();
    if (fly) {
      const k = Math.min(1, (t - fly.s) / (reduce ? 1 : 1400));
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      // Long moves (facility ↔ airspace) interpolate the distance logarithmically.
      camera.position.lerpVectors(fly.from, fly.to, e);
      controls.target.lerpVectors(fly.fromT, fly.toT, e);
      if (k >= 1) fly = null;
    }
    const blink = reduce ? 1 : Math.sin(t / 140) > 0 ? 1 : 0.3;
    // roofs: fade and lift off / settle back
    const wantRoof = layers.roofs && now > peekUntil ? 1 : 0;
    if (Math.abs(wantRoof - roofOp) > 0.001) {
      roofOp = reduce ? wantRoof : roofOp + (wantRoof - roofOp) * 0.12;
      if (Math.abs(wantRoof - roofOp) < 0.01) roofOp = wantRoof;
      for (const m of roofMats) {
        m.transparent = roofOp < 1;
        m.depthWrite = roofOp === 1;
        m.opacity = roofOp;
        m.needsUpdate = true;
      }
      roofGroup.visible = roofOp > 0.01;
      roofGroup.position.y = (1 - roofOp) * 6;
      placePins();
    }
    if (t - lastSlow > 1000) {
      lastSlow = t;
      refreshDevices();
    }
    // incidents pulse
    const pk = reduce ? 0.5 : (t / 1400) % 1;
    for (const m of incGroup.children) if (m.userData.pulse) m.scale.setScalar(1 + pk * 2.5);
    incRingMat.opacity = 0.75 * (1 - pk);
    // trigger flash
    while (flashes.length && now - flashes[0].t0 > 8000) flashes.shift();
    flashMesh.visible = flashes.length > 0;
    if (flashes.length) {
      const f = flashes.at(-1);
      flashMesh.position.set(f.pos.x, 0.2, f.pos.z);
      flashMesh.scale.setScalar(1 + ((now - f.t0) % 1200) / 300);
      flashMat.opacity = 0.7 * blink;
    }
    // wireless layer
    if (wifiGroup.visible) {
      wifiPulse.scale.setScalar(1 + pk * ZONE_R);
      wifiRingMat.opacity = 0.55 * (1 - pk);
      zoneMat.opacity = wifi.level === 'critical' ? 0.08 + 0.14 * blink : 0.12;
      for (const s of wifiMarkers.values()) {
        s.userData.angle += reduce ? 0 : 0.0015;
        s.position.set(Math.cos(s.userData.angle) * s.userData.r, 1.6 + (reduce ? 0 : Math.sin(t / 600 + s.userData.angle * 3) * 0.2), Math.sin(s.userData.angle) * s.userData.r);
        const big = s.userData.status === 'VERIFIED_UNAUTHORIZED' ? 1.6 + (reduce ? 0 : 0.3 * blink) : 1.2;
        s.scale.set(big, big, 1);
      }
    }
    moveTracks(now);
    // drone DR-1 (same timing as the console's drone panel: 3.2 s out, hover to 7.5 s, back by 10.7 s)
    if (flight) {
      const e = (now - flight.t0) / 1000;
      const T = flight.target;
      const up = new THREE.Vector3(DHOME.x, 25, DHOME.z);
      const over = new THREE.Vector3(T.x, 22, T.z);
      let q;
      if (e < 1) q = DHOME.clone().lerp(up, e);
      else if (e < 3.2) q = up.clone().lerp(over, (e - 1) / 2.2);
      else if (e < 7.5) {
        q = over.clone();
        if (!reduce) q.x += Math.sin(e * 2) * 0.6;
      } else if (e < 9.7) q = over.clone().lerp(up, (e - 7.5) / 2.2);
      else if (e < 10.7) q = up.clone().lerp(DHOME, e - 9.7);
      else {
        q = DHOME.clone();
        flight = null;
      }
      drone.position.copy(q);
      dcone.visible = e >= 3.2 && e < 7.5;
      droneLed.emissive.copy(flight ? amber : green);
      if (!reduce) rotors.forEach((r, k) => (r.rotation.y += k % 2 ? 0.9 : -0.9));
    }
    // selection ring
    const so = selectedObject();
    selRing.visible = Boolean(so && isShown(so));
    if (selRing.visible) {
      so.getWorldPosition(proj);
      selRing.position.copy(proj);
      selRing.quaternion.copy(camera.quaternion);
      const d = camera.position.distanceTo(proj);
      selRing.scale.setScalar(so.material.sizeAttenuation === false ? d * 0.04 : so.scale.x * 0.75);
    }
    controls.update();
    renderer.render(scene, camera);
    // HTML labels follow their anchors (and only appear at the distances where they help)
    labelsEl.hidden = !layers.labels;
    if (layers.labels) {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const cand = [];
      for (const l of labels) {
        const p = l.at();
        const d = camera.position.distanceTo(p);
        proj.copy(p).project(camera);
        const off = (l.layer && !layers[l.layer]) || d > l.maxDist || d < l.minDist || proj.z > 1 || proj.x < -1.05 || proj.x > 1.05 || proj.y < -1.05 || proj.y > 1.05;
        if (off) { l.el.style.visibility = 'hidden'; continue; }
        if (!l.w) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; }
        cand.push({ l, x: ((proj.x + 1) / 2) * w, y: ((1 - proj.y) / 2) * h, d });
      }
      cand.sort((a2, b2) => b2.l.pri - a2.l.pri || a2.d - b2.d);
      const placed = [];
      for (const c of cand) {
        const r = { x0: c.x - c.l.w / 2 - 2, x1: c.x + c.l.w / 2 + 2, y0: c.y - c.l.h - 2, y1: c.y + 2 };
        const hit = placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
        c.l.el.style.visibility = hit ? 'hidden' : 'visible';
        if (hit) continue;
        placed.push(r);
        c.l.el.style.transform = `translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) translate(-50%,-100%)`;
      }
    }
  }
  requestAnimationFrame(loop);
  drawIncidents();
  loadTiles();
  drawAirports();

  return {
    trigger,
    focusKey,
    droneTo,
    droneRecall,
    drawScreen: drawIncidents,
    setAirspace,
    setAircraft,
    setSpace,
    setSigns,
    select,
    view,
    toggle,
    resize,
    trackData,
    tileStatus: () => ({ ...tileStatus }),
    setImagery(on) {
      on = Boolean(on);
      if (on === imageryOn) return;
      imageryOn = on;
      baseMat.color.set(on ? 0xcbb48a : 0xdedbd4);
      schematic.visible = !on;
      tileKey = '';
      loadTiles();
    },
    imagery: () => imageryOn,
    counts: () => ({ aircraft: [...tracks.values()].filter((o) => o.data.kind === 'aircraft').length, drones: [...tracks.values()].filter((o) => o.data.kind === 'drone').length, satellites: spaceMsg?.sky?.length ?? 0, imaging: (spaceMsg?.sky ?? []).filter((s) => s.imaging).length, overhead: overheadNames.size, wifi: wifiMarkers.size }),
    site: () => ({ ...site }),
  };
}
