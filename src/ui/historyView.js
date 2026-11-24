// Airspace History (Airspace page → History): aircraft that came within 50 km (stored 30 days on the
// server) and past satellite passes over the site, each with a replay of its path.
import { el } from './dom.js';
import { icon } from './icons.js';
import { get } from '../shell/api.js';

const H = 3_600_000;
const D = 86_400_000;
const LEVEL_TEXT = { critical: 'CRITICAL', high: 'HIGH', warning: 'WARNING', normal: 'Traffic', expected: 'Expected' };
const AIR_RANGES = [
  ['6h', 'Last 6 hours', 6 * H],
  ['24h', 'Last 24 hours', D],
  ['7d', 'Last 7 days', 7 * D],
  ['30d', 'Last 30 days', 30 * D],
];
const fmtT = (t) => (t ? new Date(t).toLocaleString(undefined, { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
const fmtHM = (t) => (t ? new Date(t).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDur = (ms) => {
  const m = Math.round(ms / 60_000);
  return m < 1 ? '< 1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const km = (m) => (Number.isFinite(m) ? `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km` : '—');
const ft = (v) => (Number.isFinite(v) ? `${Math.round(v).toLocaleString('en-US')} ft` : '—');

/**
 * @param host     element the view renders into
 * @param context  () => { site, zones } from the live aircraft message (for the map rings)
 */
export function createHistoryView({ host, context = () => ({}) }) {
  const css = getComputedStyle(document.documentElement);
  const C = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const COL = { text: C('--text', '#e6edf6'), muted: C('--muted', '#9aabc2'), line: C('--line', '#223047'), accent: C('--accent', '#2dd4bf'), crit: C('--critical-ink', '#f87171'), warn: C('--warning-ink', '#fbbf24'), good: C('--good-ink', '#4ade80') };
  const LEVEL_COL = { critical: COL.crit, high: '#fb923c', warning: COL.warn, normal: COL.accent, expected: COL.good };

  let tab = 'aircraft';
  let airRange = '24h';
  let alertsOnly = false;
  let search = '';
  let satDay = 0; // days back
  let allSats = false;
  let rows = [];
  let selected = null; // aircraft visit (with points) or satellite pass
  let pos = 1; // 0..1 along the selected path
  let playing = null;
  let loading = false;
  let error = null;
  let meta = null;

  // ---------------------------------------------------------------- DOM
  const tabAir = el('button', { className: 'btn btn-sm', attrs: { type: 'button', 'aria-pressed': 'true' } }, [icon('plane', { size: 14 }), document.createTextNode('Aircraft')]);
  const tabSat = el('button', { className: 'btn btn-sm', attrs: { type: 'button', 'aria-pressed': 'false' } }, [icon('satellite', { size: 14 }), document.createTextNode('Satellites')]);
  const rangeSel = el('select', { attrs: { 'aria-label': 'Time range' } });
  const filterSel = el('select', { attrs: { 'aria-label': 'Which aircraft' } }, [el('option', { text: 'All aircraft', attrs: { value: 'all' } }), el('option', { text: 'Alerts only', attrs: { value: 'alerts' } })]);
  const satSel = el('select', { attrs: { 'aria-label': 'Satellites' } }, [el('option', { text: 'Imaging satellites', attrs: { value: 'imaging' } }), el('option', { text: 'All tracked satellites', attrs: { value: 'all' } })]);
  const searchBox = el('input', { className: 'hist-search', attrs: { type: 'search', placeholder: 'Callsign, ICAO, registration…', 'aria-label': 'Search aircraft' } });
  const refreshBtn = el('button', { className: 'btn btn-sm', text: 'Refresh', attrs: { type: 'button' } });
  const summary = el('p', { className: 'hist-summary' });
  const list = el('ul', { className: 'hist-list', attrs: { role: 'listbox', 'aria-label': 'History' } });
  const canvas = el('canvas', { className: 'hist-canvas', attrs: { role: 'img', 'aria-label': 'Replay of the selected path' } });
  const slider = el('input', { className: 'hist-slider', attrs: { type: 'range', min: '0', max: '1000', value: '1000', 'aria-label': 'Replay position' } });
  const playBtn = el('button', { className: 'btn btn-sm', text: '▶ Replay', attrs: { type: 'button' } });
  const clock = el('span', { className: 'hist-clock' });
  const facts = el('dl', { className: 'hist-facts' });
  const detailTitle = el('h3', { className: 'hist-title' });
  const detail = el('div', { className: 'hist-detail' }, [detailTitle, el('div', { className: 'hist-stage' }, [canvas]), el('div', { className: 'hist-player' }, [playBtn, slider, clock]), facts]);
  const root = el('section', { className: 'hist', attrs: { 'aria-label': 'Airspace history' } }, [
    el('div', { className: 'hist-bar' }, [el('div', { className: 'seg', attrs: { role: 'group', 'aria-label': 'History type' } }, [tabAir, tabSat]), rangeSel, filterSel, satSel, searchBox, refreshBtn]),
    summary,
    el('div', { className: 'hist-body' }, [list, detail]),
  ]);
  host.replaceChildren(root);

  function fillRange() {
    const opts = tab === 'aircraft' ? AIR_RANGES.map(([v, t]) => [v, t]) : Array.from({ length: 7 }, (_, i) => [String(i), i === 0 ? 'Last 24 hours' : i === 1 ? 'The day before (24–48 h ago)' : `${i}–${i + 1} days ago`]);
    rangeSel.replaceChildren(...opts.map(([v, t]) => el('option', { text: t, attrs: { value: v } })));
    rangeSel.value = tab === 'aircraft' ? airRange : String(satDay);
    filterSel.hidden = tab !== 'aircraft';
    searchBox.hidden = tab !== 'aircraft';
    satSel.hidden = tab !== 'satellites';
  }

  // ---------------------------------------------------------------- data
  let seq = 0;
  async function load() {
    const my = ++seq;
    loading = true;
    error = null;
    renderList();
    try {
      const to = Date.now();
      if (tab === 'aircraft') {
        const span = AIR_RANGES.find(([v]) => v === airRange)[2];
        const r = await get(`airspace/history/aircraft?from=${to - span}&to=${to}${alertsOnly ? '&only=alerts' : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`);
        if (my !== seq) return;
        rows = r.list;
        meta = r;
      } else {
        const end = to - satDay * D;
        const r = await get(`airspace/history/satellites?from=${end - D}&to=${end}${allSats ? '&all=1' : ''}`);
        if (my !== seq) return;
        rows = r.passes;
        meta = r;
      }
    } catch (err) {
      if (my !== seq) return;
      rows = [];
      error = err.message;
    }
    loading = false;
    if (selected && !rows.some((x) => key(x) === key(selected))) select(null);
    renderList();
  }
  const key = (x) => (x ? (tab === 'aircraft' ? `a${x.id}` : `s${x.norad}|${x.aos}`) : '');

  async function select(x) {
    stop();
    if (!x) {
      selected = null;
      renderDetail();
      return;
    }
    if (tab === 'aircraft') {
      try {
        selected = await get(`airspace/history/aircraft/${x.id}`);
      } catch (err) {
        error = err.message;
        selected = null;
      }
    } else selected = x;
    pos = 1;
    slider.value = '1000';
    renderList();
    renderDetail();
  }

  // ---------------------------------------------------------------- list
  function renderList() {
    const name = (r) => r.callsign || r.registration || r.hex.toUpperCase();
    if (tab === 'aircraft') {
      const since = meta?.since ? ` · stored since ${fmtT(meta.since)}` : '';
      summary.textContent = loading ? 'Loading…' : error ? `Could not load the history: ${error}` : `${rows.length} aircraft visit${rows.length === 1 ? '' : 's'} within 50 km${alertsOnly ? ' with an alert' : ''} · kept ${meta?.retentionDays ?? 30} days${since}. Only live data is stored — never replays or demo (SIMULATED) tracks.`;
    } else {
      summary.textContent = loading ? 'Computing passes…' : error ? `Could not load the passes: ${error}` : meta?.note ? `No passes: ${meta.note}.` : `${rows.length} pass${rows.length === 1 ? '' : 'es'} of ${allSats ? 'tracked' : 'imaging'} satellites reaching ≥ ${meta?.minElevationDeg ?? 30}° · ${fmtT(meta?.from)} – ${fmtT(meta?.to)} · computed from the current orbital elements (CelesTrak).`;
    }
    const items = rows.map((r) => {
      const k = key(r);
      const li = el('li', { className: `hist-row${k === key(selected) ? ' selected' : ''}`, attrs: { role: 'option', tabindex: '0', 'aria-selected': String(k === key(selected)) } });
      if (tab === 'aircraft') {
        li.classList.add(`lv-${r.restricted ? 'high' : (r.level ?? 'normal')}`);
        li.append(
          el('div', { className: 'hist-main' }, [el('b', { text: name(r) }), el('span', { className: 'hist-sub', text: [r.type, r.registration && r.registration !== name(r) ? r.registration : null, `ICAO ${r.hex.toUpperCase()}`].filter(Boolean).join(' · ') })]),
          el('div', { className: 'hist-mid' }, [el('span', { text: `${fmtT(r.firstSeen)} · ${fmtDur(r.lastSeen - r.firstSeen)}` }), el('span', { className: 'hist-sub', text: `closest ${km(r.minDistanceM)} · lowest ${r.minAltFt === null ? 'on ground' : ft(r.minAltFt)}` })]),
          el('span', { className: `hist-badge lv-${r.restricted ? 'high' : (r.level ?? 'normal')}`, text: r.restricted ? 'RESTRICTED' : (LEVEL_TEXT[r.level] ?? 'Traffic') }),
        );
      } else {
        li.classList.add(r.alert ? 'lv-warning' : 'lv-normal');
        li.append(
          el('div', { className: 'hist-main' }, [el('b', { text: r.name }), el('span', { className: 'hist-sub', text: `NORAD ${r.norad}${r.imaging ? ' · imaging' : ''}` })]),
          el('div', { className: 'hist-mid' }, [el('span', { text: `${fmtT(r.aos)} – ${fmtHM(r.los)}` }), el('span', { className: 'hist-sub', text: `highest ${r.maxElevationDeg}° · ${fmtDur(r.los - r.aos)}` })]),
          el('span', { className: `hist-badge ${r.alert ? 'lv-warning' : 'lv-normal'}`, text: r.alert ? `ALERT ${r.alert.ref ?? ''}`.trim() : r.imaging ? 'No alert' : '—' }),
        );
      }
      const pick = () => select(r);
      li.addEventListener('click', pick);
      li.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick()));
      return li;
    });
    if (!items.length && !loading) items.push(el('li', { className: 'hist-empty', text: tab === 'aircraft' ? 'No aircraft in this period. Visits are stored from now on, whenever the live feed sees an aircraft within 50 km.' : 'No passes in this period.' }));
    list.replaceChildren(...items);
  }

  // ---------------------------------------------------------------- detail + replay
  function fact(k, v) {
    return [el('dt', { text: k }), el('dd', { text: v })];
  }

  function renderDetail() {
    detail.classList.toggle('empty', !selected);
    if (!selected) {
      detailTitle.textContent = tab === 'aircraft' ? 'Select an aircraft to replay its path' : 'Select a pass to replay it on the sky chart';
      facts.replaceChildren();
      clock.textContent = '';
      draw();
      return;
    }
    const s = selected;
    if (tab === 'aircraft') {
      detailTitle.textContent = `${s.callsign || s.registration || s.hex.toUpperCase()}${s.restricted ? ' — entered the restricted airspace' : ''}`;
      facts.replaceChildren(
        ...fact('ICAO address', s.hex.toUpperCase()),
        ...fact('Registration / type', [s.registration, s.type].filter(Boolean).join(' · ') || '—'),
        ...fact('First seen', fmtT(s.firstSeen)),
        ...fact('Last seen', `${fmtT(s.lastSeen)} (${fmtDur(s.lastSeen - s.firstSeen)})`),
        ...fact('Closest to the site', km(s.minDistanceM)),
        ...fact('Altitude', s.minAltFt === null ? 'on the ground' : `${ft(s.minAltFt)} – ${ft(s.maxAltFt)}`),
        ...fact('Highest level', s.restricted ? 'HIGH — restricted airspace' : (LEVEL_TEXT[s.level] ?? 'Traffic')),
        ...fact('Squawk', s.squawks.join(', ') || '—'),
        ...fact('Data', `ADS-B via ${s.source ?? '—'} · ${s.points.length} positions`),
      );
    } else {
      detailTitle.textContent = `${s.name}${s.alert ? ` — alert ${s.alert.ref ?? ''} (${s.alert.status})` : ''}`;
      facts.replaceChildren(
        ...fact('NORAD', String(s.norad)),
        ...fact('Rise', `${fmtT(s.aos)} · azimuth ${s.azAos}°`),
        ...fact('Highest', `${s.maxElevationDeg}° at ${fmtT(s.tca)} · azimuth ${s.azTca}°`),
        ...fact('Set', `${fmtT(s.los)} · azimuth ${s.azLos}°`),
        ...fact('Duration', fmtDur(s.los - s.aos)),
        ...fact('Overflight alert', s.alert ? `${s.alert.ref ?? s.alert.id} · ${s.alert.sev} · ${s.alert.status}` : s.imaging ? 'none raised (SAWN was not running then, or the alert elevation was higher)' : 'not an imaging satellite'),
      );
    }
    draw();
  }

  function span() {
    if (!selected) return [0, 0];
    return tab === 'aircraft' ? [selected.points[0]?.[0] ?? selected.firstSeen, selected.points.at(-1)?.[0] ?? selected.lastSeen] : [selected.aos, selected.los];
  }

  function draw() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.max(260, rect.width);
    const Hh = Math.max(260, Math.min(460, rect.width * 0.8));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${Hh}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hh);
    const cx = W / 2;
    const cy = Hh / 2;
    const R = Math.min(W, Hh) / 2 - 22;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const [t0, t1] = span();
    const tNow = t0 + (t1 - t0) * pos;
    clock.textContent = selected ? fmtT(tNow) : '';
    if (tab === 'aircraft') drawAir(ctx, cx, cy, R, tNow);
    else drawSky(ctx, cx, cy, R, tNow);
  }

  function drawAir(ctx, cx, cy, R, tNow) {
    const ctxInfo = context() ?? {};
    const site = ctxInfo.site ?? { lat: 24.7136, lon: 46.6753 };
    const z = ctxInfo.zones ?? { restrictedM: 5000, warningM: 10_000, monitorM: 25_000 };
    const pts = selected?.points ?? [];
    // Scale: fit the path, at least the warning ring, at most 50 km.
    const kx = 111_320 * Math.cos((site.lat * Math.PI) / 180);
    const xy = (lat, lon) => [(lon - site.lon) * kx, (lat - site.lat) * 111_320];
    const far = Math.max(z.warningM * 1.1, ...pts.map((p) => Math.hypot(...xy(p[1], p[2]))));
    const maxM = Math.min(52_000, far * 1.08);
    const P = (lat, lon) => {
      const [x, y] = xy(lat, lon);
      return [cx + (x / maxM) * R, cy - (y / maxM) * R];
    };
    for (const [m, color, label] of [[z.restrictedM, COL.crit, 'restricted'], [z.warningM, COL.warn, 'warning'], [z.monitorM, COL.muted, 'monitor'], [50_000, COL.line, '50 km']]) {
      if (m > maxM * 1.02) continue;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash(m === 50_000 ? [4, 4] : []);
      ctx.beginPath();
      ctx.arc(cx, cy, (m / maxM) * R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.fillText(`${label} ${Math.round(m / 1000)} km`, cx, cy - (m / maxM) * R + 9);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COL.muted;
    ctx.fillText('N', cx, cy - R - 10);
    // site
    ctx.fillStyle = COL.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    if (!pts.length) return;
    // path: flown part solid, rest faint
    const color = selected.restricted ? '#fb923c' : (LEVEL_COL[selected.level] ?? COL.accent);
    for (const [part, alpha] of [[pts, 0.25], [pts.filter((p) => p[0] <= tNow), 1]]) {
      if (part.length < 2) continue;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      part.forEach((p, i) => (i ? ctx.lineTo(...P(p[1], p[2])) : ctx.moveTo(...P(p[1], p[2]))));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // aircraft at tNow (interpolated)
    let i = pts.findIndex((p) => p[0] > tNow);
    if (i === -1) i = pts.length;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i)];
    const f = b[0] > a[0] ? Math.min(1, Math.max(0, (tNow - a[0]) / (b[0] - a[0]))) : 0;
    const lat = a[1] + (b[1] - a[1]) * f;
    const lon = a[2] + (b[2] - a[2]) * f;
    const alt = Number.isFinite(a[3]) && Number.isFinite(b[3]) ? a[3] + (b[3] - a[3]) * f : a[3];
    const [x, y] = P(lat, lon);
    const trk = ((a[4] ?? b[4] ?? 0) * Math.PI) / 180;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(trk);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = COL.text;
    ctx.textAlign = 'left';
    const d = Math.hypot(...xy(lat, lon));
    ctx.fillText(`${selected.callsign || selected.hex.toUpperCase()} · ${alt === 0 ? 'ground' : ft(alt)} · ${km(d)}`, x + 10, y - 10);
    ctx.textAlign = 'center';
  }

  function drawSky(ctx, cx, cy, R, tNow) {
    // Polar sky chart: centre = straight overhead, edge = horizon, north up.
    for (const el0 of [0, 30, 60]) {
      const r = R * (1 - el0 / 90);
      ctx.strokeStyle = el0 === 0 ? COL.muted : COL.line;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (el0) {
        ctx.fillStyle = COL.muted;
        ctx.fillText(`${el0}°`, cx + 12, cy - r + 8);
      }
    }
    ctx.fillStyle = COL.muted;
    for (const [lab, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const a = (az * Math.PI) / 180;
      ctx.fillText(lab, cx + Math.sin(a) * (R + 12), cy - Math.cos(a) * (R + 12));
    }
    ctx.fillStyle = COL.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    const path = selected?.path ?? [];
    if (path.length < 2) return;
    const P = ([az, elv]) => {
      const r = R * (1 - Math.max(0, elv) / 90);
      const a = (az * Math.PI) / 180;
      return [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
    };
    const color = selected.alert ? COL.warn : selected.imaging ? '#c4b5fd' : COL.accent;
    const k = Math.round(pos * (path.length - 1));
    for (const [part, alpha] of [[path, 0.3], [path.slice(0, k + 1), 1]]) {
      if (part.length < 2) continue;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      part.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const fpos = pos * (path.length - 1);
    const a = path[Math.floor(fpos)];
    const b = path[Math.min(path.length - 1, Math.floor(fpos) + 1)];
    const f = fpos - Math.floor(fpos);
    let daz = b[0] - a[0];
    if (daz > 180) daz -= 360;
    if (daz < -180) daz += 360;
    const cur = [(a[0] + daz * f + 360) % 360, a[1] + (b[1] - a[1]) * f];
    const [x, y] = P(cur);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.text;
    ctx.textAlign = 'left';
    ctx.fillText(`${selected.name} · elevation ${Math.round(cur[1])}° · azimuth ${Math.round(cur[0])}°`, x + 10, y - 10);
    ctx.textAlign = 'center';
  }

  function stop() {
    if (playing) cancelAnimationFrame(playing);
    playing = null;
    playBtn.textContent = '▶ Replay';
  }
  function play() {
    if (!selected) return;
    if (playing) return stop();
    if (pos >= 1) pos = 0;
    playBtn.textContent = '❚❚ Pause';
    let last = performance.now();
    const step = (t) => {
      pos = Math.min(1, pos + (t - last) / 20_000); // the whole path in 20 s
      last = t;
      slider.value = String(Math.round(pos * 1000));
      draw();
      if (pos >= 1) return stop();
      playing = requestAnimationFrame(step);
    };
    playing = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------- events
  function setTab(next) {
    if (next === tab) return;
    tab = next;
    tabAir.setAttribute('aria-pressed', String(tab === 'aircraft'));
    tabSat.setAttribute('aria-pressed', String(tab === 'satellites'));
    rows = [];
    meta = null;
    selected = null;
    stop();
    fillRange();
    renderDetail();
    load();
  }
  tabAir.addEventListener('click', () => setTab('aircraft'));
  tabSat.addEventListener('click', () => setTab('satellites'));
  rangeSel.addEventListener('change', () => {
    if (tab === 'aircraft') airRange = rangeSel.value;
    else satDay = Number(rangeSel.value);
    load();
  });
  filterSel.addEventListener('change', () => {
    alertsOnly = filterSel.value === 'alerts';
    load();
  });
  satSel.addEventListener('change', () => {
    allSats = satSel.value === 'all';
    load();
  });
  let searchTimer = null;
  searchBox.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      search = searchBox.value.trim();
      load();
    }, 300);
  });
  refreshBtn.addEventListener('click', load);
  playBtn.addEventListener('click', play);
  slider.addEventListener('input', () => {
    stop();
    pos = Number(slider.value) / 1000;
    draw();
  });
  new ResizeObserver(() => draw()).observe(detail);

  fillRange();
  renderDetail();
  return {
    show(on) {
      root.hidden = !on;
      if (on) load();
      else stop();
    },
    reload: load,
  };
}
