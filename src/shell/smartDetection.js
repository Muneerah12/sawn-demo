// Smart detection: the live AI cameras side by side — in a thermal-style view by default, with the
// number of people in each — and the current camera detections (weapons, smoking, fire, zones…)
// next to them. The cameras themselves run in the AI cameras engine (aiCameras.js); this page
// shows their latest analysed frame and what was found on it.
import { isOpen } from '../shared/scenarios.js';
import { thermalPalette, thermalize } from '../shared/thermal.js';
import { aiCameras } from './aiCameras.js';
import { on, session } from './hub.js';
import { state } from './store.js';
import { button, h } from './ui.js';

const W = 640;
const H = 360;
const SEV = { crit: ['Critical', 'sev-crit'], high: ['High', 'sev-high'], mid: ['Medium', 'sev-mid'], low: ['Low', 'sev-low'] };
// What is worth labelling on the tiles (people get a thin outline only).
const LABEL = { candidate: '#94a3b8', weapon: '#ff4d4d', smoking: '#f59e0b', fire: '#fb923c', smoke: '#e2e8f0', device: '#a78bfa' };
const KEY = 'sawn.smart.thermal';
const ROLE = { general: 'General', sensitive: 'Sensitive area', tower: 'Tower 360°' };
// Test slots: upload a video of a situation and watch what the AI finds in it.
const SLOTS = [
  { slot: 'fire', title: 'Fire', hint: 'Flames, a burning car or building', role: 'general' },
  { slot: 'smoke', title: 'Smoke', hint: 'Smoke rising, a smoky room', role: 'general' },
  { slot: 'weapon', title: 'Armed person', hint: 'Someone holding a pistol, rifle or knife', role: 'general' },
  { slot: 'smoking', title: 'Smoking', hint: 'Someone smoking a cigarette', role: 'general' },
  { slot: 'crowd', title: 'Crowd · people count', hint: 'A busy entrance, a queue, a hall', role: 'general' },
  { slot: 'behaviour', title: 'Behaviour', hint: 'Running, a fall, loitering, circling', role: 'tower' },
];
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export function createSmartDetection({ root, onNavigate = () => {} }) {
  const lut = thermalPalette();
  let thermal = true;
  try {
    thermal = localStorage.getItem(KEY) !== '0';
  } catch {
    // storage blocked: thermal on
  }
  let visible = false;
  let timer = null;
  let frames = 0;
  const tiles = new Map(); // camera id → { el, canvas, ctx, scratch }

  const summary = h('p', { class: 'sub sd-summary' });
  const thermalBtn = button('', { cls: 'btn-sm', onClick: () => setThermal(!thermal) });
  const grid = h('div', { class: 'sd-grid' });
  const camCount = h('span', { class: 'sd-chip' });
  const list = h('div', { class: 'sd-list' });
  const detCount = h('span', { class: 'sd-chip' });
  const slotsBox = h('div', { class: 'sd-slots' });
  const slotEls = new Map(); // slot → { card, body, findings, tileHost, camId }
  root.replaceChildren(
    h('div', { class: 'sd-head' }, [
      h('div', {}, [h('p', { class: 'sd-crumb', text: 'Operations' }), h('h1', { class: 'sd-title', text: 'Smart detection' }), summary]),
      h('div', { class: 'sd-actions' }, [
        thermalBtn,
        button('Open laptop camera', { iconName: 'camera', cls: 'btn-sm', perm: 'incidents.handle', onClick: () => aiCameras()?.openLaptopCamera() }),
        button('Upload video', { iconName: 'play', cls: 'btn-sm', perm: 'incidents.handle', onClick: () => aiCameras()?.uploadVideo() }),
      ]),
    ]),
    h('div', { class: 'sd-cols' }, [
      h('section', { class: 'sd-panel sd-live' }, [h('div', { class: 'sd-panel-head' }, [h('h2', { text: 'Live cameras' }), camCount]), grid, h('p', { class: 'sub sd-note', text: 'Thermal view is a colour rendering of the ordinary camera picture with the detected people shown warm — it does not measure temperature.' })]),
      h('section', { class: 'sd-panel sd-dets' }, [h('div', { class: 'sd-panel-head' }, [h('h2', { text: 'Current detections' }), detCount]), list]),
    ]),
    h('section', { class: 'sd-panel sd-tests' }, [
      h('div', { class: 'sd-panel-head' }, [h('h2', { text: 'Test videos · AI analysis' }), h('span', { class: 'sd-chip', text: 'Test' })]),
      h('p', { class: 'sub sd-note sd-note-top', text: 'Upload a video for a situation and the AI analyses it like a live camera: what it finds appears under the video and in Current detections, marked TEST VIDEO. The video stays on this computer.' }),
      slotsBox,
    ]),
  );

  function setThermal(on) {
    thermal = on;
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      // per-console convenience only
    }
    thermalBtn.querySelector('span')?.remove();
    thermalBtn.append(h('span', { text: on ? 'Thermal view: on' : 'Thermal view: off' }));
    thermalBtn.classList.toggle('btn-primary', on);
  }
  setThermal(thermal);

  function tileFor(cam) {
    let t = tiles.get(cam.id);
    if (t) return t;
    // dir=ltr: in the Arabic (right-to-left) page the canvas would otherwise draw text leftwards from x.
    const canvas = h('canvas', { class: 'sd-canvas', attrs: { width: W, height: H, 'aria-label': cam.name, dir: 'ltr' } });
    const el = h('figure', { class: 'sd-tile' }, [canvas]);
    t = { el, canvas, ctx: canvas.getContext('2d'), scratch: Object.assign(document.createElement('canvas'), { width: W, height: H }) };
    tiles.set(cam.id, t);
    return t;
  }

  function drawTile(cam, t) {
    const c = t.ctx;
    const people = cam.draw.filter((d) => d.kind === 'person' && d.box);
    const mediaReady = cam.media && (cam.media.readyState >= 2 || cam.media.naturalWidth > 0);
    if (!cam.work && mediaReady) {
      // The picture before the first analysis (models still loading): shown as it is.
      c.drawImage(cam.media, 0, 0, W, H);
    } else if (cam.work) {
      if (thermal) {
        const sc = t.scratch.getContext('2d', { willReadFrequently: true });
        sc.drawImage(cam.work, 0, 0, W, H);
        const img = sc.getImageData(0, 0, W, H);
        // People and fire are the warm things on a thermal camera (fire the hottest).
        thermalize(img.data, W, H, { warm: people.map((d) => d.box), hot: cam.draw.filter((d) => (d.kind === 'fire' || d.kind === 'arson') && d.box).map((d) => d.box), lut });
        c.putImageData(img, 0, 0);
      } else c.drawImage(cam.work, 0, 0, W, H);
    } else {
      c.fillStyle = '#111827';
      c.fillRect(0, 0, W, H);
    }
    c.lineWidth = 2;
    for (const d of people) {
      const [x, y, w, hh] = d.box;
      c.strokeStyle = thermal ? 'rgba(255,255,255,.55)' : 'rgba(56,189,248,.8)';
      c.strokeRect(x * W, y * H, w * W, hh * H);
    }
    // Findings: a coloured box with its name above it.
    c.font = '600 15px system-ui, sans-serif';
    for (const d of cam.draw) {
      const color = LABEL[d.kind];
      if (!color || !d.box) continue;
      const [x, y, w, hh] = d.box;
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.strokeRect(x * W, y * H, w * W, hh * H);
      const txt = d.label ?? d.kind;
      const tw = c.measureText(txt).width + 12;
      c.fillStyle = color;
      c.fillRect(x * W, Math.max(0, y * H - 22), tw, 22);
      c.fillStyle = '#fff';
      c.fillText(txt, x * W + 6, Math.max(16, y * H - 6));
    }
    // Header: camera name and LIVE; footer: where and when; people count.
    const grad = c.createLinearGradient(0, 0, 0, 44);
    grad.addColorStop(0, 'rgba(0,0,0,.65)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, 44);
    c.fillStyle = '#fff';
    c.font = '700 17px system-ui, sans-serif';
    c.fillText(cam.name.slice(0, 32), 14, 26);
    const live = cam.testVideo ? 'TEST VIDEO' : 'LIVE';
    c.font = '700 13px system-ui, sans-serif';
    const lw = c.measureText(live).width + 30;
    c.fillStyle = '#dc2626';
    roundRect(c, W - lw - 12, 10, lw, 24, 6);
    c.fillStyle = '#fff';
    c.fillText(live, W - lw - 2, 27);
    c.beginPath();
    c.arc(W - 24, 22, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(0,0,0,.6)';
    const place = cam.zones[0] ?? ROLE[cam.role] ?? cam.role;
    c.font = '600 13px system-ui, sans-serif';
    const pw = c.measureText(place).width + 16;
    roundRect(c, 12, H - 34, pw, 24, 6);
    c.fillStyle = '#fff';
    c.fillText(place, 20, H - 17);
    const ts = stamp();
    c.font = '600 13px ui-monospace, monospace';
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.fillText(ts, W - c.measureText(ts).width - 14, H - 17);
    // Not analysing yet (models loading, waiting for camera permission, an error): say so.
    if (!cam.work || cam.status !== 'Running') {
      const msg = cam.status === 'Running' ? 'Starting the analysis…' : cam.status;
      c.font = '600 16px system-ui, sans-serif';
      const mw = c.measureText(msg).width + 28;
      c.fillStyle = 'rgba(15,23,42,.82)';
      roundRect(c, (W - mw) / 2, H / 2 - 20, mw, 40, 10);
      c.fillStyle = '#fff';
      c.fillText(msg, (W - mw) / 2 + 14, H / 2 + 6);
    }
    // People in view.
    const n = cam.people;
    const pc = `${n} ${n === 1 ? 'person' : 'people'}`;
    c.font = '700 14px system-ui, sans-serif';
    const cw = c.measureText(pc).width + 18;
    c.fillStyle = n ? 'rgba(14,165,233,.9)' : 'rgba(71,85,105,.85)';
    roundRect(c, 12, 44, cw, 24, 12);
    c.fillStyle = '#fff';
    c.fillText(pc, 21, 61);
  }

  function renderGrid() {
    const all = aiCameras()?.cameras() ?? [];
    renderSlots(all.filter((c) => c.slot));
    const cams = all.filter((c) => !c.slot);
    const total = cams.reduce((s, c) => s + c.people, 0);
    summary.textContent = `${cams.length} cameras · ${total} people in view`;
    camCount.textContent = `${cams.length} cameras`;
    if (!cams.length) {
      tiles.clear();
      grid.replaceChildren(h('div', { class: 'sd-empty' }, [h('p', { text: 'No camera is running. Open the laptop camera or upload a video — or start a camera on the Drone & cameras page.' })]));
      return;
    }
    const want = cams.map((cam) => tileFor(cam).el);
    if (want.length !== grid.children.length || want.some((el, i) => grid.children[i] !== el)) grid.replaceChildren(...want);
    for (const id of [...tiles.keys()]) if (!cams.some((c) => c.id === id)) tiles.delete(id);
    for (const cam of cams) drawTile(cam, tiles.get(cam.id));
  }

  function renderList() {
    const dets = state.incidents.filter((i) => i.source === 'camera' && isOpen(i.status)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
    detCount.textContent = `${dets.length} open`;
    if (!dets.length) {
      list.replaceChildren(h('p', { class: 'sub sd-empty', text: 'No open camera detections.' }));
      return;
    }
    list.replaceChildren(
      ...dets.map((i) => {
        const [sevText, sevCls] = SEV[i.sev] ?? SEV.low;
        const conf = i.conf ? ` · ${Math.round(i.conf * 100)} %` : '';
        return h('button', { class: `sd-det ${i.sev === 'crit' || i.sev === 'high' ? 'sd-det-hot' : ''}`, attrs: { type: 'button' }, on: { click: () => onNavigate('incidents', i.ref) } }, [
          h('span', { class: `sd-sev ${sevCls}`, text: sevText }),
          h('span', { class: 'sd-det-main' }, [h('b', { text: i.type }), h('span', { class: 'sub', text: `${i.zone}${conf}` })]),
          h('span', { class: 'sd-det-time', text: clock(i.createdAt) }),
        ]);
      }),
    );
  }

  // ---------------------------------------------------------------- test slots
  function slotEl(def) {
    let s = slotEls.get(def.slot);
    if (s) return s;
    const input = h('input', { attrs: { type: 'file', accept: 'video/*', hidden: true } });
    const pick = (file) => {
      if (!file || !/^video\//.test(file.type || 'video/')) return;
      const id = aiCameras()?.analyseFile(file, { name: `Test · ${def.title}`, slot: def.slot, role: def.role });
      if (id) s.camId = id;
    };
    input.addEventListener('change', () => {
      pick(input.files[0]);
      input.value = '';
    });
    const drop = h('div', { class: 'sd-drop', attrs: { tabindex: '0', role: 'button' }, on: { click: () => input.click(), keydown: (e) => (e.key === 'Enter' || e.key === ' ') && input.click() } }, [
      h('b', { text: 'Drop a video here' }),
      h('span', { class: 'sub', text: 'or click to choose one' }),
    ]);
    for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => (e.preventDefault(), drop.classList.add('sd-drop-on')));
    drop.addEventListener('dragleave', () => drop.classList.remove('sd-drop-on'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('sd-drop-on');
      pick(e.dataTransfer?.files?.[0]);
    });
    const tileHost = h('div', { class: 'sd-slot-tile' });
    const findings = h('div', { class: 'sd-findings' });
    const meta = h('p', { class: 'sub sd-slot-meta' });
    const actions = h('div', { class: 'sd-slot-actions' }, [
      button('Another video', { cls: 'btn-sm', perm: 'incidents.handle', onClick: () => input.click() }),
      button('Remove', { cls: 'btn-sm', onClick: () => s.camId && aiCameras()?.close(s.camId) }),
    ]);
    const card = h('article', { class: 'sd-slot', attrs: { 'data-slot': def.slot } }, [h('header', {}, [h('h3', { text: def.title }), h('span', { class: 'sub', text: def.hint })]), drop, tileHost, meta, findings, actions, input]);
    s = { card, drop, tileHost, findings, meta, actions, camId: null, def };
    slotEls.set(def.slot, s);
    return s;
  }

  function renderSlots(slotCams) {
    if (!slotsBox.children.length) slotsBox.replaceChildren(...SLOTS.map((d) => slotEl(d).card));
    for (const def of SLOTS) {
      const s = slotEl(def);
      const cam = slotCams.find((c) => c.slot === def.slot);
      s.card.classList.toggle('sd-slot-on', Boolean(cam));
      s.drop.hidden = Boolean(cam);
      s.actions.hidden = !cam;
      if (!cam) {
        s.tileHost.replaceChildren();
        s.findings.replaceChildren();
        s.meta.textContent = '';
        continue;
      }
      s.camId = cam.id;
      const t = tileFor(cam);
      if (t.el.parentNode !== s.tileHost) s.tileHost.replaceChildren(t.el);
      drawTile(cam, t);
      const look = cam.secondLook;
      s.meta.textContent = [cam.fileName, cam.status === 'Running' ? `${cam.people} people in view` : cam.status, look?.looks ? `${look.looks} close looks (OWLv2)` : null].filter(Boolean).join(' · ');
    }
  }

  /** What the AI found in each slot's video: the camera incidents raised from it. */
  function renderFindings() {
    for (const s of slotEls.values()) {
      const cam = (aiCameras()?.cameras() ?? []).find((c) => c.id === s.camId);
      if (!cam) continue;
      const found = state.incidents.filter((i) => i.source === 'camera' && i.zone === cam.reportName).sort((a, b) => b.createdAt - a.createdAt);
      s.findings.replaceChildren(
        ...(found.length
          ? found.map((i) => {
              const [sevText, sevCls] = SEV[i.sev] ?? SEV.low;
              return h('button', { class: 'sd-finding', attrs: { type: 'button' }, on: { click: () => onNavigate('incidents', i.ref) } }, [
                h('span', { class: `sd-sev ${sevCls}`, text: sevText }),
                h('span', { text: i.type }),
                h('span', { class: 'sub', text: `${i.conf ? `${Math.round(i.conf * 100)} % · ` : ''}${clock(i.createdAt)}` }),
              ]);
            })
          : [h('p', { class: 'sub', text: 'Nothing found yet — the AI is still watching.' })]),
      );
    }
  }

  on('incidents', () => visible && (renderList(), renderFindings()));

  return {
    show() {
      visible = true;
      renderList();
      renderGrid();
      renderFindings();
      clearInterval(timer);
      // ~7 frames a second: the analysed frames arrive about 3 times a second.
      timer = setInterval(() => {
        if (!visible || root.hidden || root.closest('[hidden]')) {
          visible = false;
          clearInterval(timer);
          return;
        }
        renderGrid();
        if (++frames % 20 === 0) renderFindings(); // every ~3 s (also on every incident push)
      }, 150);
    },
  };
}

function roundRect(c, x, y, w, hgt, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + hgt, r);
  c.arcTo(x + w, y + hgt, x, y + hgt, r);
  c.arcTo(x, y + hgt, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  c.fill();
}
