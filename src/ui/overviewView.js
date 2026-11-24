import { el } from './dom.js';
import { icon } from './icons.js';
import { barList, chartCard, formatClock, lineChart, sparkline, stackedColumns } from './charts.js';

// Status colors are reserved for state (good / warning / critical) and always ship with an
// icon + label; series-1 blue is the single-series / non-status color.
export const COLORS = Object.freeze({ good: '#0ca30c', warning: '#fab219', critical: '#d03b3b', series1: '#3987e5' });

const HERO_ICON = { critical: 'shieldAlert', warning: 'alert', good: 'shieldCheck', idle: 'sensor' };

/** Gate status banner, KPI tiles and the trend charts. */
export function createOverview(root = document) {
  const $ = (id) => root.getElementById(id);
  let data = { snapshots: [], buckets: [], types: [], checkpoint: true };

  const points = (field) => data.snapshots.map((s) => ({ t: s.t, v: s[field] ?? 0 }));
  const newestFirst = () => [...data.snapshots].reverse();

  const gateCard = chartCard({
    title: 'Devices at the gate',
    subtitle: 'Last 30 minutes · sampled every 10 s',
    iconName: 'gate',
    makeChart: () => lineChart({ series: [{ name: data.checkpoint ? 'at the gate' : 'close by', color: COLORS.series1, points: points('atGate') }] }),
    table: () => ({ head: ['Time', data.checkpoint ? 'At the gate' : 'Close by'], rows: newestFirst().map((s) => [formatClock(s.t), s.atGate]) }),
  });

  const statusCard = chartCard({
    title: 'Devices in range by status',
    subtitle: 'Last 30 minutes',
    iconName: 'shield',
    makeChart: () =>
      lineChart({
        series: [
          { name: 'Unauthorized', color: COLORS.critical, iconName: 'block', points: points('unauthorized') },
          { name: 'Unknown', color: COLORS.warning, iconName: 'unknown', points: points('unknown') },
          { name: 'Authorized', color: COLORS.good, iconName: 'check', points: points('authorized') },
        ],
      }),
    table: () => ({
      head: ['Time', 'Unauthorized', 'Unknown', 'Authorized'],
      rows: newestFirst().map((s) => [formatClock(s.t), s.unauthorized, s.unknown, s.authorized]),
    }),
  });

  const ALERT_KEYS = [
    { key: 'unauthorized', name: 'Unauthorized (siren)', color: COLORS.critical, iconName: 'block' },
    { key: 'unknown', name: 'Unknown at the gate', color: COLORS.warning, iconName: 'unknown' },
    { key: 'rule', name: 'Rule alerts', color: COLORS.series1, iconName: 'rule' },
  ];
  const alertsCard = chartCard({
    title: 'Alerts',
    subtitle: 'Last hour · per 5 minutes',
    iconName: 'alert',
    makeChart: () =>
      stackedColumns({
        buckets: data.buckets.map((b) => ({ label: formatClock(b.end), title: `${formatClock(b.start)}–${formatClock(b.end)}`, values: b })),
        keys: ALERT_KEYS,
      }),
    table: () => ({
      head: ['Interval', ...ALERT_KEYS.map((k) => k.name)],
      rows: [...data.buckets].reverse().map((b) => [`${formatClock(b.start)}–${formatClock(b.end)}`, b.unauthorized, b.unknown, b.rule]),
    }),
  });

  const typesCard = chartCard({
    title: 'Device types in range',
    subtitle: 'Right now · inferred, see confidence in Live devices',
    iconName: 'chart',
    makeChart: () => barList({ items: data.types, color: COLORS.series1 }),
    table: () => ({ head: ['Type', 'Devices'], rows: data.types.map((t) => [t.label, t.value]) }),
  });

  const cards = [gateCard, statusCard, alertsCard, typesCard];
  $('charts-grid').replaceChildren(...cards);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => cards.forEach((c) => c.render()), 150);
  });

  function renderHero({ level, title, detail, updatedAt }) {
    const hero = $('hero');
    hero.className = `hero hero-${level}`;
    hero.replaceChildren(
      el('div', { className: 'hero-icon' }, [icon(HERO_ICON[level], { size: 40 })]),
      el('div', { className: 'hero-text' }, [
        el('div', { className: 'hero-title', text: title }),
        el('div', { className: 'hero-detail', text: detail }),
      ]),
      el('div', { className: 'hero-updated', text: updatedAt ? `Updated ${formatClock(updatedAt)}` : '' }),
    );
  }

  /** tiles: [{ label, value, iconName, tone, trend, hint }] */
  function renderKpis(tiles) {
    $('kpis').replaceChildren(
      ...tiles.map((t) =>
        el('div', { className: `kpi kpi-${t.tone}` }, [
          el('div', { className: 'kpi-head' }, [el('span', { className: 'kpi-icon' }, [icon(t.iconName, { size: 18 })]), el('span', { className: 'kpi-label', text: t.label })]),
          el('div', { className: 'kpi-body' }, [el('span', { className: 'kpi-value', text: String(t.value) }), t.trend ? sparkline(t.trend) : null]),
          t.hint ? el('div', { className: 'kpi-hint', text: t.hint }) : null,
        ]),
      ),
    );
  }

  function renderCharts(next) {
    data = next;
    gateCard.setTitle(data.checkpoint ? 'Devices at the gate' : 'Devices close by');
    if (!$('trends').open) return;
    // Hold the frame of a chart the operator is reading (hover / keyboard focus).
    for (const c of cards) if (!c.matches(':hover') && !c.contains(document.activeElement)) c.render();
  }

  $('trends').addEventListener('toggle', () => {
    if ($('trends').open) cards.forEach((c) => c.render());
  });

  return { renderHero, renderKpis, renderCharts };
}
