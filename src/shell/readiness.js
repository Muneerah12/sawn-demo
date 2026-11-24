// Readiness: is the facility actually protected right now? Automated health checks, business
// continuity (what still works when a part fails), defense in depth, maintenance and signage.
import { get, post } from './api.js';
import { on } from './hub.js';
import { state } from './store.js';
import { ago, button, dateTime, formDialog, h, icon, notify } from './ui.js';
import { createWhatIf } from './whatif.js';

const ST = { ok: ['OK', 'good', 'check'], warn: ['Attention', 'warning', 'alert'], down: ['Down', 'critical', 'block'] };
const SIGN_KIND = {
  'electric-fence': 'Electric fence', 'armed-response': 'Armed response', cctv: 'CCTV in operation', screening: 'Screening', 'no-devices': 'No unregistered devices',
  'prohibited-items': 'Prohibited items', restricted: 'Restricted area', vehicle: 'Vehicle checkpoint',
};
const MAINT = { ok: ['OK', 'st-confirmed'], 'due-soon': ['Due soon', 'st-escalated'], overdue: ['Overdue', 'st-new'], 'test-due': ['Test due', 'st-escalated'] };

export function createReadinessPage({ root, onNavigate }) {
  const whatIf = createWhatIf({ root });
  const $ = (id) => root.querySelector(`#${id}`);
  let data = null;

  async function load() {
    try {
      data = await get('readiness');
      state.health = data.health;
      render();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }
  const act = async (promise, ok) => {
    try {
      await promise;
      if (ok) notify(ok);
      await load();
    } catch (err) {
      notify(err.message, 'bad');
    }
  };

  function renderContinuity() {
    const c = data.continuity;
    const health = Object.fromEntries(data.health.map((x) => [x.id, x]));
    const tile = (title, status, lines, actions = []) =>
      h('div', { class: `cont-tile tone-${ST[status][1]}` }, [h('div', { class: 'cont-head' }, [icon(ST[status][2], { size: 18 }), h('b', { text: title })]), ...lines.map((l) => h('p', { text: l })), actions.length ? h('div', { class: 'row wrap' }, actions) : null]);
    $('rd-continuity').replaceChildren(
      tile('Gate directory', health.directory?.status ?? 'warn', [
        health.directory?.detail ?? 'Directory reachability has not been verified.',
        c.directory ? `Local copy: ${c.directory.people} people, ${ago(c.directory.syncedAt)} old (valid ${c.gatePolicy.directoryCacheMaxAgeHours} h, then fail-secure).` : 'No local copy yet.',
      ], [button('Refresh local copy', { cls: 'btn-sm', perm: 'system.control', onClick: () => act(post('directory/sync'), 'Local directory copy refreshed.') })]),
      tile('Airspace sensor', health['AS-1']?.status ?? 'warn', [health['AS-1']?.detail ?? '—', 'When the server is unreachable the ESP32 stores sightings and replays them later.']),
      tile('Alerts without a console', health.consoles?.status === 'ok' ? 'ok' : 'warn', ['Incidents are raised by the server and stored even when no console is open.', health.consoles?.detail ?? '']),
      tile('Backups', health.backup?.status ?? 'warn', [health.backup?.detail ?? '—'], [button('Back up now', { cls: 'btn-sm', perm: 'system.control', onClick: () => act(post('backup'), 'Backup written to data/backups.') })]),
    );
  }

  function renderHealth() {
    $('rd-health').replaceChildren(
      ...data.health.map((x) =>
        h('div', { class: `health-tile tone-${ST[x.status][1]}` }, [
          h('div', { class: 'health-head' }, [icon(ST[x.status][2], { size: 16 }), h('b', { text: x.name }), h('span', { class: 'health-st', text: ST[x.status][0] })]),
          h('p', { text: x.detail }),
          !x.real ? h('span', { class: 'badge badge-offline', text: 'NOT INTEGRATED' }) : null,
        ]),
      ),
    );
    $('rd-log').replaceChildren(...data.log.slice(0, 12).map((l) => h('li', {}, [h('time', { text: dateTime(l.t) }), h('span', { text: `${l.component}: ${l.status} — ${l.detail ?? ''}` })])));
  }

  function renderLayers() {
    const health = Object.fromEntries(data.health.map((x) => [x.id, x]));
    const signsByKind = (kinds) => data.signs.filter((s) => kinds.includes(s.kind));
    const controlStatus = (id) => {
      if (id === 'signs:perimeter') return signsByKind(['electric-fence', 'armed-response', 'cctv']).some((s) => s.status !== 'installed') ? 'down' : 'ok';
      if (id === 'signs:vehicle') return signsByKind(['vehicle']).some((s) => s.status !== 'installed') ? 'warn' : 'ok';
      // Gate B / Level 5 has a model entry and scenarios, but no controller integration yet.
      // It must never inherit an "OK" state merely because it appears in the protection diagram.
      if (id === 'C6') return 'warn';
      return health[id]?.status ?? 'ok';
    };
    $('rd-layers').replaceChildren(
      ...data.layers.map((layer, i) => {
        const statuses = layer.controls.map(([id]) => controlStatus(id));
        const worst = statuses.includes('down') ? 'down' : statuses.includes('warn') ? 'warn' : 'ok';
        return h('div', { class: `layer tone-${ST[worst][1]}`, style: { '--depth': String(i) } }, [
          h('div', { class: 'layer-name' }, [h('span', { class: 'layer-n', text: String(i + 1) }), h('div', {}, [h('b', { text: layer.name }), h('small', { text: layer.goal })])]),
          h('div', { class: 'layer-controls' }, layer.controls.map(([id, label], k) => h('span', { class: `ctl tone-${ST[statuses[k]][1]}` }, [icon(ST[statuses[k]][2], { size: 13 }), ` ${label}${id === 'C6' ? ' · not integrated' : ''}`]))),
        ]);
      }),
    );
  }

  function renderMaintenance() {
    const rec = (a, kind, result, label, cls = 'btn-sm') => button(label, { cls, perm: 'maintenance.record', onClick: async () => {
      let notes = '';
      if (kind === 'fault' || result === 'fail') {
        const r = await formDialog({ title: `${a.name}: ${kind === 'fault' ? 'report a fault' : 'function test failed'}`, fields: [{ name: 'notes', label: 'What happened', type: 'textarea', required: true }], submitLabel: 'Record', danger: true });
        if (!r) return;
        notes = r.notes;
      }
      act(post(`maintenance/${a.id}`, { kind, result, notes }), `${a.id}: recorded.`);
    } });
    $('rd-assets').replaceChildren(
      ...data.assets.map((a) => {
        const [label, cls] = MAINT[a.state];
        return h('tr', {}, [
          h('td', {}, [h('b', { class: 'mono', text: a.id }), ' ', h('span', { text: a.name }), a.real ? h('span', { class: 'badge badge-live', text: 'REAL' }) : null]),
          h('td', { text: a.zone }),
          h('td', { text: a.lastServiceAt ? dateTime(a.lastServiceAt) : 'never' }),
          h('td', { text: `${dateTime(a.nextDueAt)} (every ${a.intervalDays} d)` }),
          h('td', { text: a.testIntervalHours ? (a.lastTestAt ? `${ago(a.lastTestAt)} ago` : 'never') : '—' }),
          h('td', {}, [h('span', { class: `pill ${cls}`, text: label })]),
          h('td', { class: 'actions-col' }, [h('div', { class: 'row' }, [
            rec(a, 'service', 'done', 'Serviced'),
            a.testIntervalHours ? rec(a, 'test', 'pass', 'Test passed', 'btn-sm btn-ok') : null,
            a.testIntervalHours ? rec(a, 'test', 'fail', 'Test failed', 'btn-sm btn-danger') : null,
            rec(a, 'fault', 'fail', 'Fault', 'btn-sm btn-danger'),
            rec(a, 'repair', 'done', 'Repaired'),
          ])]),
        ]);
      }),
    );
  }

  function renderSigns() {
    $('rd-signs').replaceChildren(
      ...data.signs.map((s) =>
        h('tr', { class: s.status !== 'installed' && s.hazard ? 'row-crit' : '' }, [
          h('td', { class: 'mono', text: s.id }),
          h('td', { text: s.zone }),
          h('td', {}, [h('b', { text: SIGN_KIND[s.kind] ?? s.kind }), s.hazard ? h('span', { class: 'badge hazard-badge', text: 'HAZARD' }) : null, h('div', { class: 'sub sign-wording', text: `“${s.wording}”` })]),
          h('td', {}, [h('span', { class: `pill ${s.status === 'installed' ? 'st-confirmed' : 'st-new'}`, text: s.status })]),
          h('td', { text: s.lastInspectedAt ? `${dateTime(s.lastInspectedAt)}${s.inspectionDue ? ' · due' : ''}` : 'never' }),
          h('td', { class: 'actions-col' }, [h('div', { class: 'row' }, ['installed', 'damaged', 'missing'].map((st) => button(st === 'installed' ? 'OK' : st === 'damaged' ? 'Damaged' : 'Missing', { cls: `btn-sm ${st === 'installed' ? 'btn-ok' : 'btn-danger'}`, perm: 'maintenance.record', onClick: () => act(post(`signs/${s.id}`, { status: st }), `${s.id} inspected: ${st}.`) })))]),
        ]),
      ),
    );
    const hazards = data.signs.filter((s) => s.hazard && s.status !== 'installed');
    $('rd-sign-note').textContent = hazards.length
      ? `${hazards.length} hazard warning sign(s) missing or damaged (${hazards.map((s) => s.id).join(', ')}). A forceful or dangerous measure must be clearly signed before it is relied on.`
      : 'Every hazard is signed. Inspect each sign at least every 30 days.';
    $('rd-sign-note').className = hazards.length ? 'hint warn-text' : 'hint';
  }

  function renderReviews() {
    const list = data.reviewsDue;
    $('rd-reviews').replaceChildren(...[
      ...(list.length
        ? list.map((r) => h('li', {}, [h('span', { class: `lvl lvl-${r.clearance}`, text: `L${r.clearance}` }), h('span', { text: ` ${r.name} — last reviewed ${r.lastReviewAt ? dateTime(r.lastReviewAt) : 'never'} (every ${r.periodDays} d)` })]))
        : [h('li', { class: 'sub', text: 'No access review is due.' })]),
      list.length ? h('li', {}, [button('Review in Facility Profile', { cls: 'btn-sm', onClick: () => onNavigate('facility') })]) : null,
    ].filter(Boolean));
  }

  function renderAccessHealth() {
    const ah = data.accessHealth;
    if (!ah) return;
    const tone = ah.summary.crit ? 'bad' : ah.summary.warn ? 'warn' : 'ok';
    const sum = $('rd-access-summary');
    sum.dataset.tone = tone;
    sum.textContent = `${ah.summary.total} cards · ${ah.summary.crit} critical · ${ah.summary.warn} to review · ${ah.summary.noPin} without PIN`;
    const yesNo = (ok, yes, no) => h('span', { class: `pill pill-sm`, attrs: { 'data-tone': ok ? 'ok' : 'warn' }, text: ok ? yes : no });
    const accessCell = (r) => {
      if (r.expired) return h('span', { class: 'pill pill-sm', attrs: { 'data-tone': 'bad' }, text: 'ended' });
      if (r.personStatus && r.personStatus !== 'active') return h('span', { class: 'pill pill-sm', attrs: { 'data-tone': 'bad' }, text: r.personStatus });
      if (r.expiringSoon) return h('span', { class: 'pill pill-sm', attrs: { 'data-tone': 'warn' }, text: `until ${dateTime(r.validUntil)}` });
      return h('span', { class: 'pill pill-sm', attrs: { 'data-tone': 'ok' }, text: r.validUntil ? `until ${dateTime(r.validUntil)}` : 'no end date' });
    };
    $('rd-access').replaceChildren(
      ...(ah.rows.length
        ? ah.rows.map((r) =>
            h('tr', { class: r.severity === 'crit' ? 'row-bad' : r.severity === 'warn' ? 'row-warn' : '' }, [
              h('td', {}, [h('b', { text: r.holder ?? '—' })]),
              h('td', { text: r.cardId }),
              h('td', {}, [h('span', { class: `lvl lvl-${r.clearance}`, text: `L${r.clearance}` })]),
              h('td', {}, [accessCell(r)]),
              h('td', {}, [yesNo(r.physicalLinked, 'linked', 'none')]),
              h('td', {}, [yesNo(r.pinSet, 'set', 'off')]),
              h('td', { text: r.lastEntryAt ? dateTime(r.lastEntryAt) : 'never' }),
              h('td', { class: 'sub', text: [r.issues.join(' · '), r.pendingApproval ? 'approval pending' : null].filter(Boolean).join(' · ') || 'OK' }),
            ]),
          )
        : [h('tr', {}, [h('td', { attrs: { colspan: '8' }, class: 'sub', text: 'No issued cards yet.' })])]),
    );
  }

  function render() {
    if (!data || root.hidden) return;
    const issues = data.health.filter((x) => x.status !== 'ok').length;
    $('rd-summary').textContent = issues ? `${issues} check(s) need attention` : 'All automated checks pass';
    renderContinuity();
    renderAccessHealth();
    renderHealth();
    renderLayers();
    renderMaintenance();
    renderSigns();
    renderReviews();
  }

  on('health', () => {
    if (!data || root.hidden) return;
    data.health = state.health;
    render();
  });

  return {
    show() {
      whatIf.show();
      return load();
    },
  };
}
