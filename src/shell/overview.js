// Command center: the whole facility at a glance — one status line, key figures, what needs
// attention now, who is at the airspace gate, and incident trends. Details are one click away.
import { SEVERITY_LABEL, STATUS_LABEL, isOpen } from '../shared/scenarios.js';
import { operationalIncidents } from '../shared/incidentProvenance.js';
import { barList, chartCard, formatClock, stackedColumns } from '../ui/charts.js';
import { TYPE_ICON } from '../ui/icons.js';
import { get } from './api.js';
import { emit, on, session } from './hub.js';
import { counts, pendingApprovals, sortedIncidents, state } from './store.js';
import { ago, button, dateTime, h, icon } from './ui.js';

const SEV_KEYS = [
  { key: 'crit', name: 'Critical', color: '#d03b3b', iconName: 'shieldAlert' },
  { key: 'high', name: 'High', color: '#ec835a', iconName: 'alert' },
  { key: 'mid', name: 'Medium', color: '#fab219', iconName: 'unknown' },
  { key: 'low', name: 'Info (rules)', color: '#3987e5', iconName: 'rule' },
];
const STATUS_TONE = { AUTHORIZED: 'good', UNKNOWN: 'warning', VERIFIED_UNAUTHORIZED: 'critical' };
const STATUS_TEXT = { AUTHORIZED: 'Authorized', UNKNOWN: 'Unknown', VERIFIED_UNAUTHORIZED: 'Unauthorized' };
export function createOverviewPage({ root }) {
  const $ = (id) => root.querySelector(`#${id}`);
  let activity = [];

  function hourBuckets() {
    const hour = 3_600_000;
    const end = Math.ceil(Date.now() / hour) * hour;
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const start = end - (12 - i) * hour;
      return { start, end: start + hour, crit: 0, high: 0, mid: 0, low: 0 };
    });
    for (const inc of operationalIncidents(state.incidents)) {
      const idx = Math.floor((inc.createdAt - (end - 12 * hour)) / hour);
      if (idx >= 0 && idx < 12) buckets[idx][inc.sev]++;
    }
    return buckets;
  }

  const trendCard = chartCard({
    title: 'Incidents',
    subtitle: 'Last 12 hours · per hour, by severity',
    iconName: 'chart',
    makeChart: () => stackedColumns({ buckets: hourBuckets().map((b) => ({ label: formatClock(b.end), title: `${formatClock(b.start)}–${formatClock(b.end)}`, values: b })), keys: SEV_KEYS }),
    table: () => ({ head: ['Hour', ...SEV_KEYS.map((k) => k.name)], rows: hourBuckets().reverse().map((b) => [`${formatClock(b.start)}–${formatClock(b.end)}`, b.crit, b.high, b.mid, b.low]) }),
  });
  const zoneCard = chartCard({
    title: 'Open incidents by area',
    subtitle: 'Right now',
    iconName: 'map',
    makeChart: () => barList({ items: openByZone(), color: '#3987e5', emptyText: 'No open incidents.' }),
    table: () => ({ head: ['Area', 'Open incidents'], rows: openByZone().map((z) => [z.label, z.value]) }),
  });
  $('ov-charts').replaceChildren(trendCard, zoneCard);

  function openByZone() {
    const m = new Map();
    for (const i of operationalIncidents(state.incidents, isOpen)) {
      const area = i.zone.split('·')[0].trim();
      m.set(area, (m.get(area) ?? 0) + 1);
    }
    return [...m.entries()].map(([label, value]) => ({ label, value, iconName: 'map' })).sort((a, b) => b.value - a.value);
  }

  function heroState() {
    const c = counts();
    const air = state.airspace;
    const top = sortedIncidents(operationalIncidents(state.incidents, isOpen))[0];
    if (air?.level === 'critical' && air.unauthorized) {
      return { level: 'critical', title: 'Unauthorized device at the gate', detail: `${air.heroDetail} — stop the visitor and check.` };
    }
    if (c.crit) return { level: 'critical', title: `${c.crit} critical incident${c.crit > 1 ? 's' : ''} open`, detail: `${top.type} · ${top.zone} (${top.ref}, ${ago(top.createdAt)} ago)` };
    if (air?.level === 'critical') return { level: 'critical', title: 'Gate is not being monitored', detail: air.heroDetail };
    if (c.unclassifiedOpen) return { level: 'warning', title: 'Operational picture needs verification', detail: `${c.unclassifiedOpen} open incident${c.unclassifiedOpen > 1 ? 's have' : ' has'} an unclassified source; review Incidents before treating the site as clear.` };
    if (c.open || air?.level === 'warning') {
      const parts = [c.open ? `${c.open} open incident${c.open > 1 ? 's' : ''}` : null, air?.level === 'warning' ? air.heroTitle : null].filter(Boolean);
      return { level: 'warning', title: parts.join(' · '), detail: top ? `Next: ${top.type} · ${top.zone} (${top.ref})` : air?.heroDetail };
    }
    return { level: 'good', title: 'All clear', detail: `No open incidents · ${air ? `${air.counts.total} wireless devices in range, ${air.counts.atGate} at the gate` : 'airspace feed connecting…'}` };
  }

  function kpi(label, value, iconName, tone, hint, onClick) {
    const tile = h('button', { class: `kpi kpi-${tone} kpi-btn`, attrs: { type: 'button' }, on: { click: onClick } }, [
      h('div', { class: 'kpi-head' }, [h('span', { class: 'kpi-icon' }, [icon(iconName, { size: 18 })]), h('span', { class: 'kpi-label', text: label })]),
      h('div', { class: 'kpi-body' }, [h('span', { class: 'kpi-value', text: String(value) })]),
      hint ? h('div', { class: 'kpi-hint', text: hint }) : null,
    ]);
    return tile;
  }

  function render() {
    if (root.hidden) return;
    const c = counts();
    const air = state.airspace;
    const hero = heroState();
    const HERO_ICON = { critical: 'shieldAlert', warning: 'alert', good: 'shieldCheck' };
    $('ov-hero').className = `hero hero-${hero.level}`;
    $('ov-hero').replaceChildren(
      h('div', { class: 'hero-icon' }, [icon(HERO_ICON[hero.level], { size: 40 })]),
      h('div', { class: 'hero-text' }, [h('div', { class: 'hero-title', text: hero.title }), h('div', { class: 'hero-detail', text: hero.detail ?? '' })]),
      h('div', { class: 'hero-updated', text: `Updated ${new Date().toLocaleTimeString(undefined, { hour12: false })}` }),
    );
    const go = (tab, extra = {}) => () => emit('navigate', { tab, ...extra });
    $('ov-kpis').replaceChildren(...[
      kpi('Open incidents', c.open, 'alert', c.open ? 'warning' : 'neutral', `${c.today} operational in the last 24 h`, go('incidents')),
      kpi('Critical', c.crit, 'shieldAlert', c.crit ? 'critical' : 'neutral', c.escalated ? `${c.escalated} escalated` : 'none escalated', go('incidents')),
      kpi('Gate A hybrid tests (24 h)', `${state.gate.counts24h.deny + state.gate.counts24h.refer} stopped`, 'gate', state.gate.counts24h.deny ? 'warning' : 'info', `${state.gate.counts24h.allow} simulated allows · no door command`, go('checkpoint')),
      kpi('Approvals waiting', pendingApprovals().length, 'key', pendingApprovals().length ? 'warning' : 'neutral', 'two-person rule', go('approvals')),
      (() => {
        const down = state.health.filter((x) => x.status === 'down');
        const warn = state.health.filter((x) => x.status === 'warn');
        return kpi('Readiness', down.length ? `${down.length} down` : warn.length ? `${warn.length} to check` : 'All OK', 'shieldCheck', down.length ? 'critical' : warn.length ? 'warning' : 'good', down[0]?.name ?? warn[0]?.name ?? 'automated checks every 15 s', go('readiness'));
      })(),
      session.can('risk.view') ? kpi('Insider risk', state.people.filter((p) => (p.risk ?? 0) >= 50).length, 'person', state.people.some((p) => (p.risk ?? 0) >= 50) ? 'warning' : 'neutral', 'people with an elevated score', go('facility')) : null,
      kpi('At the gate', air?.counts.atGate ?? '—', 'gate', 'info', air ? `${air.counts.total} in range (last minute)` : 'connecting…', go('airspace')),
      kpi('Unknown at gate', air?.unknownAtGate ?? '—', 'unknown', air?.unknownAtGate ? 'warning' : 'neutral', 'not in the registry', go('airspace')),
      kpi('Unauthorized now', air?.unauthorized ?? '—', 'block', air?.unauthorized ? 'critical' : 'neutral', air?.unauthorized ? 'siren active' : 'none present', go('airspace')),
      (() => {
        const a = state.aircraft;
        const real = a ? a.list.filter((x) => x.kind === 'aircraft' && !x.simulated) : [];
        // Real tracks only: a demo never changes the live picture on the command center.
        const crit = a ? a.list.filter((x) => !x.simulated && (x.level === 'critical' || x.level === 'high')).length : 0;
        const how = !a ? 'connecting…' : a.replay ? 'REPLAY of the recording' : a.mode === 'off' ? 'feed off' : a.error ? 'ERROR — retrying' : `live · ${a.source ?? '…'}`;
        const demo = a?.demo?.status && a.demo.status !== 'idle' ? ' · demo running' : '';
        return kpi('Aircraft', a ? real.length : '—', 'plane', crit ? 'critical' : 'info', `${crit ? `${crit} high / critical track(s)` : 'within 50 km'} · ${how}${demo}`, go('airspace', { aircraft: true }));
      })(),
      kpi('Sensors online', air ? `${air.sensorsOnline}/${air.sensorsTotal}` : '—', 'sensor', air?.sensorOnline ? 'good' : 'critical', air?.sensorOnline ? 'ESP32 reporting' : 'not reporting', go('map')),
      session.can('people.view') ? kpi('People on record', state.people.length, 'people', 'info', `${state.cards.filter((x) => x.status === 'active').length} active cards`, go('facility')) : null,
    ].filter(Boolean));

    const open = sortedIncidents(operationalIncidents(state.incidents, isOpen)).slice(0, 7);
    const attention = [
      ...(open.length
        ? open.map((i) =>
            h('button', { class: 'item', attrs: { type: 'button' }, on: { click: go('incidents', { select: i.id }) } }, [
              h('span', { class: `stripe bg-${i.sev}` }),
              h('span', { class: 'item-main' }, [h('b', { text: i.type }), h('small', { text: `${i.zone} · ${i.ref}` })]),
              h('span', { class: 'ago' }, [h('span', { text: ago(i.createdAt) }), h('span', { class: `pill st-${i.status}`, text: STATUS_LABEL[i.status] }), i.simulated ? h('span', { class: 'badge badge-demo', text: 'SIM' }) : null]),
            ]),
          )
        : [h('div', { class: 'empty' }, [icon(c.unclassifiedOpen ? 'alert' : 'shieldCheck', { size: 32 }), h('p', { text: c.unclassifiedOpen ? 'No verified operational incident is open.' : 'Nothing needs attention.' })])]),
      c.unclassifiedOpen
        ? h('button', { class: 'item item-unclassified', attrs: { type: 'button' }, on: { click: go('incidents') } }, [
            h('span', { class: 'stripe bg-mid' }),
            h('span', { class: 'item-main' }, [h('b', { text: 'Unclassified / verify source' }), h('small', { text: `${c.unclassifiedOpen} open incident${c.unclassifiedOpen > 1 ? 's are' : ' is'} excluded from operational totals.` })]),
          ])
        : null,
    ].filter(Boolean);
    $('ov-attention').replaceChildren(...attention);

    const gate = air?.gateDevices ?? [];
    $('ov-gate').replaceChildren(
      ...(gate.length
        ? gate.slice(0, 8).map((d) =>
            h('div', { class: `gate-dev tone-${STATUS_TONE[d.status]}` }, [
              h('span', { class: 'gate-dev-icon' }, [icon(TYPE_ICON[d.type] ?? 'device', { size: 20 })]),
              h('span', { class: 'gate-dev-main' }, [h('b', { text: d.name }), h('small', { class: 'mono', text: `${d.identifier} · ${Math.round(d.signal)} dBm` })]),
              h('span', { class: `pill tone-pill-${STATUS_TONE[d.status]}`, text: STATUS_TEXT[d.status] }),
            ]),
          )
        : [h('p', { class: 'empty', text: air ? 'No device inside the gate zone.' : 'Waiting for the airspace feed…' })]),
      button('Open airspace radar', { iconName: 'target', cls: 'btn-ghost btn-sm', onClick: go('airspace') }),
    );

    $('ov-activity-card').hidden = !session.can('audit.view');
    $('ov-activity').replaceChildren(
      ...activity.slice(0, 10).map((e) =>
        h('li', {}, [h('time', { text: dateTime(e.t) }), h('span', {}, [h('b', { text: e.actor }), ` ${e.action}`, e.target ? h('span', { class: 'mono sub', text: ` ${e.target}` }) : null])]),
      ),
    );
    for (const card of [trendCard, zoneCard]) if (!card.matches(':hover') && !card.contains(document.activeElement)) card.render();
  }

  async function loadActivity() {
    if (!session.can('audit.view')) return;
    try {
      activity = (await get('audit?limit=12')).entries;
      render();
    } catch {
      // the page still works without the activity feed
    }
  }

  on('incidents', render);
  on('people', render);
  on('approvals', render);
  on('gate', render);
  on('audit-entry', (e) => {
    activity.unshift(e);
    activity.length = Math.min(activity.length, 20);
  });
  setInterval(render, 2000);
  window.addEventListener('resize', () => !root.hidden && [trendCard, zoneCard].forEach((c) => c.render()));

  return {
    show() {
      render();
      loadActivity();
    },
    SEV_LABEL: SEVERITY_LABEL,
  };
}
