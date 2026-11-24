// Small dependency-free SVG/HTML charts following the dashboard's data-viz rules:
// 2px lines, hairline solid grid, 2px surface gaps between stacked segments, 4px rounded data
// ends, ≥8px end markers with a surface ring, hover/focus tooltips (values lead, labels follow),
// and every chart has a table view. All labels are inserted with textContent.
import { el } from './dom.js';
import { icon } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function svgText(x, y, text, attrs = {}) {
  const t = svgEl('text', { x, y, ...attrs });
  t.textContent = text;
  return t;
}

/** Clean axis ticks from 0 to ≥ max. */
export function niceTicks(max, count = 4) {
  const top = Math.max(1, max);
  const raw = top / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks.at(-1) < top) ticks.push(ticks.at(-1) + step);
  return ticks;
}

export const formatClock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
const formatClockSeconds = (t) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

// ------------------------------------------------------------------ tooltip (one, shared)

let tooltipNode = null;
function tooltip() {
  if (!tooltipNode) {
    tooltipNode = el('div', { className: 'chart-tooltip', attrs: { role: 'status' } });
    tooltipNode.hidden = true;
    document.body.append(tooltipNode);
  }
  return tooltipNode;
}

/** rows: [{ value, label, color, keyShape: 'line' | 'rect' }] */
function showTooltip(clientX, clientY, title, rows) {
  const tip = tooltip();
  tip.replaceChildren(
    el('div', { className: 'tt-title', text: title }),
    ...rows.map((r) =>
      el('div', { className: 'tt-row' }, [
        el('span', { className: `tt-key tt-key-${r.keyShape ?? 'line'}`, attrs: { style: `background:${r.color}` } }),
        el('strong', { text: r.value }),
        el('span', { className: 'tt-label', text: r.label }),
      ]),
    ),
  );
  tip.hidden = false;
  const { innerWidth, innerHeight } = window;
  const rect = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(clientX + 14, innerWidth - rect.width - 8)}px`;
  tip.style.top = `${Math.min(clientY + 14, innerHeight - rect.height - 8)}px`;
}

export function hideTooltip() {
  if (tooltipNode) tooltipNode.hidden = true;
}

// ------------------------------------------------------------------ legend

/** items: [{ name, color, iconName, shape: 'line' | 'rect' }] */
export function legend(items) {
  return el(
    'div',
    { className: 'chart-legend' },
    items.map((i) =>
      el('span', { className: 'legend-item' }, [
        el('span', { className: `legend-key legend-key-${i.shape ?? 'line'}`, attrs: { style: `background:${i.color}` } }),
        i.iconName ? icon(i.iconName, { size: 14 }) : null,
        document.createTextNode(i.name),
      ]),
    ),
  );
}

// ------------------------------------------------------------------ line / area chart

/**
 * series: [{ name, color, iconName, points: [{ t, v }] }] — all series share timestamps.
 * A single series gets a 10% area wash and no legend (the card title names it).
 */
export function lineChart({ series, height = 170, valueFormat = (v) => String(v), emptyText = 'Collecting data…' }) {
  const wrap = el('div', { className: 'chart' });
  const draw = () => {
    const width = Math.max(260, wrap.clientWidth || 420);
    const n = series[0]?.points.length ?? 0;
    if (n < 2) {
      wrap.replaceChildren(el('p', { className: 'chart-empty', text: emptyText }));
      return;
    }
    const pad = { top: 10, right: series.length > 1 ? 92 : 44, bottom: 22, left: 30 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const times = series[0].points.map((p) => p.t);
    const t0 = times[0];
    const t1 = times.at(-1);
    const max = Math.max(...series.flatMap((s) => s.points.map((p) => p.v)));
    const ticks = niceTicks(max);
    const yMax = ticks.at(-1);
    const x = (t) => pad.left + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * plotW);
    const y = (v) => pad.top + plotH - (v / yMax) * plotH;

    const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img' });
    svg.setAttribute('aria-label', `${series.map((s) => s.name).join(', ')} over time`);

    for (const v of ticks) {
      svg.append(svgEl('line', { x1: pad.left, x2: pad.left + plotW, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }));
      svg.append(svgText(pad.left - 6, y(v) + 3, String(v), { class: 'tick', 'text-anchor': 'end' }));
    }
    // Short spans need seconds, or the axis repeats the same minute.
    const clock = t1 - t0 < 10 * 60_000 ? formatClockSeconds : formatClock;
    for (const t of [t0, t0 + (t1 - t0) / 2, t1]) {
      svg.append(svgText(x(t), height - 6, clock(t), { class: 'tick', 'text-anchor': t === t0 ? 'start' : t === t1 ? 'end' : 'middle' }));
    }

    for (const s of series) {
      const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
      if (series.length === 1) {
        svg.append(svgEl('path', { d: `${d}L${x(t1)},${y(0)}L${x(t0)},${y(0)}Z`, fill: s.color, 'fill-opacity': 0.1, stroke: 'none' }));
      }
      svg.append(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    }

    // End markers + selective direct labels (the last value) — ≤ 4 series only.
    const ends = series.map((s) => ({ s, p: s.points.at(-1) }));
    for (const { s, p } of ends) svg.append(svgEl('circle', { cx: x(p.t), cy: y(p.v), r: 4, fill: s.color, class: 'ring' }));
    if (series.length <= 4) {
      const placed = [];
      for (const { s, p } of [...ends].sort((a, b) => b.p.v - a.p.v)) {
        let ly = y(p.v) + 4;
        if (placed.some((py) => Math.abs(py - ly) < 12)) continue; // collide → legend + tooltip carry it
        placed.push(ly);
        svg.append(svgText(x(p.t) + 8, ly, series.length > 1 ? `${valueFormat(p.v)} ${s.name}` : valueFormat(p.v), { class: 'end-label' }));
      }
    }

    // Crosshair + tooltip: hit area is the whole plot; snaps to the nearest sample.
    const cross = svgEl('line', { y1: pad.top, y2: pad.top + plotH, class: 'crosshair', visibility: 'hidden' });
    const dots = series.map((s) => svgEl('circle', { r: 4, fill: s.color, class: 'ring', visibility: 'hidden' }));
    const hit = svgEl('rect', { x: pad.left, y: pad.top, width: plotW, height: plotH, fill: 'transparent', tabindex: 0, class: 'hit' });
    let index = n - 1;
    const point = (i, clientX, clientY) => {
      index = Math.max(0, Math.min(n - 1, i));
      const t = times[index];
      cross.setAttribute('x1', x(t));
      cross.setAttribute('x2', x(t));
      cross.setAttribute('visibility', 'visible');
      series.forEach((s, k) => {
        dots[k].setAttribute('cx', x(t));
        dots[k].setAttribute('cy', y(s.points[index].v));
        dots[k].setAttribute('visibility', 'visible');
      });
      showTooltip(clientX, clientY, formatClockSeconds(t), series.map((s) => ({ value: valueFormat(s.points[index].v), label: s.name, color: s.color })));
    };
    const nearest = (clientX) => {
      const px = clientX - svg.getBoundingClientRect().left;
      let best = 0;
      times.forEach((t, i) => {
        if (Math.abs(x(t) - px) < Math.abs(x(times[best]) - px)) best = i;
      });
      return best;
    };
    const clear = () => {
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((dt) => dt.setAttribute('visibility', 'hidden'));
      hideTooltip();
    };
    hit.addEventListener('pointermove', (e) => point(nearest(e.clientX), e.clientX, e.clientY));
    hit.addEventListener('pointerleave', clear);
    hit.addEventListener('blur', clear);
    hit.addEventListener('focus', () => {
      const r = svg.getBoundingClientRect();
      point(index, r.left + x(times[index]), r.top + pad.top);
    });
    hit.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const i = index + (e.key === 'ArrowRight' ? 1 : -1);
      point(i, r.left + x(times[Math.max(0, Math.min(n - 1, i))]), r.top + pad.top);
    });
    svg.append(cross, ...dots, hit);

    wrap.replaceChildren(svg, series.length > 1 ? legend(series.map((s) => ({ name: s.name, color: s.color, iconName: s.iconName }))) : '');
  };
  wrap.draw = draw;
  return wrap;
}

// ------------------------------------------------------------------ stacked columns

/** buckets: [{ label, title, values: { key: n } }]; keys: [{ key, name, color, iconName }] */
export function stackedColumns({ buckets, keys, height = 170 }) {
  const wrap = el('div', { className: 'chart' });
  const draw = () => {
    const width = Math.max(260, wrap.clientWidth || 420);
    const pad = { top: 16, right: 8, bottom: 22, left: 30 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const totals = buckets.map((b) => keys.reduce((s, k) => s + (b.values[k.key] ?? 0), 0));
    const ticks = niceTicks(Math.max(...totals, 1));
    const yMax = ticks.at(-1);
    const band = plotW / buckets.length;
    const colW = Math.min(24, band * 0.6);
    const y = (v) => pad.top + plotH - (v / yMax) * plotH;

    const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img' });
    svg.setAttribute('aria-label', 'Alerts per interval');
    for (const v of ticks) {
      svg.append(svgEl('line', { x1: pad.left, x2: pad.left + plotW, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }));
      svg.append(svgText(pad.left - 6, y(v) + 3, String(v), { class: 'tick', 'text-anchor': 'end' }));
    }

    buckets.forEach((b, i) => {
      const cx = pad.left + band * i + band / 2;
      const x0 = cx - colW / 2;
      let acc = 0;
      const present = keys.filter((k) => (b.values[k.key] ?? 0) > 0);
      present.forEach((k, j) => {
        const v = b.values[k.key];
        const top = y(acc + v);
        const bottom = y(acc) - (j ? 2 : 0); // 2px surface gap between segments
        const h = Math.max(1, bottom - top);
        const isTop = j === present.length - 1;
        const r = isTop ? Math.min(4, h / 2, colW / 2) : 0; // rounded data end only, square at baseline
        const d = `M${x0},${top + h}V${top + r}${r ? `Q${x0},${top} ${x0 + r},${top}` : ''}H${x0 + colW - r}${r ? `Q${x0 + colW},${top} ${x0 + colW},${top + r}` : ''}V${top + h}Z`;
        svg.append(svgEl('path', { d, fill: k.color }));
        acc += v;
      });
      if (totals[i] > 0) svg.append(svgText(cx, y(totals[i]) - 4, String(totals[i]), { class: 'end-label', 'text-anchor': 'middle' }));
      if (i % Math.ceil(buckets.length / 4) === 0 || i === buckets.length - 1) {
        svg.append(svgText(cx, height - 6, b.label, { class: 'tick', 'text-anchor': 'middle' }));
      }
      // Hit target: the whole band, not just the painted column.
      const hit = svgEl('rect', { x: pad.left + band * i, y: pad.top, width: band, height: plotH, fill: 'transparent', tabindex: 0, class: 'hit' });
      const show = (cx2, cy2) =>
        showTooltip(cx2, cy2, b.title, [
          ...keys.map((k) => ({ value: String(b.values[k.key] ?? 0), label: k.name, color: k.color, keyShape: 'rect' })),
          { value: String(totals[i]), label: 'total', color: 'transparent' },
        ]);
      hit.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
      hit.addEventListener('pointerleave', hideTooltip);
      hit.addEventListener('focus', () => {
        const r = hit.getBoundingClientRect();
        show(r.left + r.width / 2, r.top);
      });
      hit.addEventListener('blur', hideTooltip);
      svg.append(hit);
    });

    wrap.replaceChildren(svg, legend(keys.map((k) => ({ name: k.name, color: k.color, iconName: k.iconName, shape: 'rect' }))));
  };
  wrap.draw = draw;
  return wrap;
}

// ------------------------------------------------------------------ horizontal bars (HTML)

/** items: [{ label, iconName, value }] — one series, one color. */
export function barList({ items, color, emptyText = 'No devices in range.' }) {
  const wrap = el('div', { className: 'barlist' });
  wrap.draw = () => {
    if (!items.length) {
      wrap.replaceChildren(el('p', { className: 'chart-empty', text: emptyText }));
      return;
    }
    const max = Math.max(...items.map((i) => i.value), 1);
    wrap.replaceChildren(
      ...items.map((i) => {
        const bar = el('div', { className: 'bar', attrs: { style: `width:${(i.value / max) * 100}%;background:${color}` } });
        const row = el('div', { className: 'bar-row', attrs: { tabindex: 0 } }, [
          el('span', { className: 'bar-label' }, [icon(i.iconName, { size: 16 }), document.createTextNode(i.label)]),
          el('span', { className: 'bar-track' }, [bar, el('span', { className: 'bar-value', text: String(i.value) })]),
        ]);
        const show = (x, y) => showTooltip(x, y, i.label, [{ value: String(i.value), label: 'devices in range', color, keyShape: 'rect' }]);
        row.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
        row.addEventListener('pointerleave', hideTooltip);
        row.addEventListener('focus', () => {
          const r = row.getBoundingClientRect();
          show(r.right - 40, r.top);
        });
        row.addEventListener('blur', hideTooltip);
        return row;
      }),
    );
  };
  return wrap;
}

// ------------------------------------------------------------------ sparkline & meter

/** 12-point trend: de-emphasis line, current value as an accent dot. */
export function sparkline(values, { width = 96, height = 26, accent = 'var(--series-1)' } = {}) {
  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'sparkline', 'aria-hidden': 'true' });
  if (values.length < 2) return svg;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i) => 4 + (i / (values.length - 1)) * (width - 8);
  const y = (v) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  svg.append(svgEl('path', { d: values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(''), class: 'spark-line' }));
  svg.append(svgEl('circle', { cx: x(values.length - 1), cy: y(values.at(-1)), r: 3, fill: accent }));
  return svg;
}

/**
 * Signal meter: fill shows signal strength from -100 (empty) to -30 dBm (full) in one hue;
 * an optional tick marks the gate-zone threshold.
 */
export function signalMeter(rssi, { threshold = null } = {}) {
  const pct = (v) => Math.max(0, Math.min(100, ((v + 100) / 70) * 100));
  const track = el('span', { className: 'meter', attrs: { role: 'meter', 'aria-valuemin': '-100', 'aria-valuemax': '-30', 'aria-valuenow': String(Math.round(rssi)) } }, [
    el('span', { className: 'meter-fill', attrs: { style: `width:${pct(rssi)}%` } }),
    Number.isFinite(threshold) ? el('span', { className: 'meter-tick', attrs: { style: `left:${pct(threshold)}%`, title: `Gate edge ${threshold} dBm` } }) : null,
  ]);
  return track;
}

// ------------------------------------------------------------------ chart card with table view

/**
 * Card with title, subtitle and a Chart/Table toggle. `makeChart()` builds the chart from the
 * current data; `table()` returns { head: [...], rows: [[...]] } for the same data.
 */
export function chartCard({ title, subtitle, iconName, makeChart, table }) {
  let showTable = false;
  const body = el('div', { className: 'chart-body' });
  const toggle = el('button', { className: 'btn btn-ghost btn-sm', attrs: { type: 'button', 'aria-pressed': 'false', title: 'Show as table' } }, [icon('table', { size: 16 })]);
  const renderTable = () => {
    const { head, rows } = table();
    return el('div', { className: 'table-wrap' }, [
      el('table', { className: 'data-table' }, [
        el('thead', {}, [el('tr', {}, head.map((h) => el('th', { text: h })))]),
        el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', { text: String(c) }))))),
      ]),
    ]);
  };
  const render = () => {
    if (showTable) {
      body.replaceChildren(renderTable());
      return;
    }
    const chart = makeChart();
    body.replaceChildren(chart);
    chart.draw(); // after insertion, so it can measure its width
  };
  toggle.addEventListener('click', () => {
    showTable = !showTable;
    toggle.setAttribute('aria-pressed', String(showTable));
    toggle.replaceChildren(icon(showTable ? 'chart' : 'table', { size: 16 }));
    toggle.title = showTable ? 'Show as chart' : 'Show as table';
    render();
  });
  const subtitleNode = el('p', { className: 'sub', text: subtitle });
  const titleNode = el('h3', { text: title });
  const card = el('section', { className: 'card chart-card' }, [
    el('div', { className: 'card-head' }, [
      el('div', { className: 'card-title' }, [icon(iconName, { size: 18 }), el('div', {}, [titleNode, subtitleNode])]),
      toggle,
    ]),
    body,
  ]);
  card.render = render;
  card.setTitle = (t, s) => {
    titleNode.textContent = t;
    if (s !== undefined) subtitleNode.textContent = s;
  };
  return card;
}
