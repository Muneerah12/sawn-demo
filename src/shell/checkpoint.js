// Gate A training lane. This is intentionally separate from the live Gate A page: its badge,
// face, metal and ETD inputs are simulated and must never be mistaken for a physical entry.
import { TYPE_LABEL } from '../core/deviceType.js';
import { post } from './api.js';
import { on, session } from './hub.js';
import { LEVELS } from './people.js';
import { loadGate, state } from './store.js';
import { dateTime, h, icon, notify } from './ui.js';

const STAGES = [
  ['badge', 'Badge', 'card', 'Who are you? Card + directory (works offline from the local copy)'],
  ['face', 'Face match', 'eye', 'Is it really you? Camera vs. enrolled face'],
  ['metal', 'Metal detector', 'shieldAlert', 'Weapons, metal and switched-off devices'],
  ['etd', 'Explosive trace', 'alert', 'Swab analysed by the ETD'],
  ['airspace', 'Wireless devices', 'sensor', 'Every device in the gate zone authorized for that level'],
];
const RESULT = {
  allow: ['ALLOW', 'Gate opens', 'good'],
  deny: ['DENY', 'Gate stays closed', 'critical'],
  refer: ['REFER', 'Officer must check by hand before opening', 'warning'],
};
const STATUS_ICON = { pass: 'check', deny: 'block', refer: 'unknown', skip: 'clock' };

export function createCheckpointPage({ root }) {
  const $ = (id) => root.querySelector(`#${id}`);
  let shown = null; // gate check on display

  function fillForm() {
    const cards = state.cards.length ? state.cards : [];
    const sel = $('gc-card');
    const current = sel.value;
    sel.replaceChildren(
      ...cards.map((c) => h('option', { attrs: { value: c.id }, text: `${c.id} · ${c.holder ?? 'unassigned'}${c.status !== 'active' ? ` (${c.status})` : ''}` })),
      h('option', { attrs: { value: 'C-9999' }, text: 'C-9999 · unknown card' }),
    );
    if (current) sel.value = current;
    $('gc-level').replaceChildren(...Object.entries(LEVELS).map(([v, l]) => h('option', { attrs: { value: v }, text: l })));
  }

  $('gc-run').addEventListener('click', async () => {
    try {
      const check = await post('gate/check', {
        cardId: $('gc-card').value,
        level: Number($('gc-level').value),
        face: $('gc-face').value,
        metal: $('gc-metal').value,
        etd: $('gc-etd').value,
      });
      shown = check.id;
      renderLane(check);
    } catch (err) {
      notify(err.message, 'bad');
    }
  });

  function renderLane(check) {
    const lane = $('gc-lane');
    if (!check) {
      lane.replaceChildren(h('div', { class: 'empty big-empty' }, [icon('demo', { size: 40 }), h('p', { text: 'Run a training check — every result here is simulated.' })]));
      $('gc-result').replaceChildren();
      return;
    }
    const byId = Object.fromEntries(check.stages.map((s) => [s.id, s]));
    lane.replaceChildren(
      ...STAGES.map(([id, name, iconName, hint], i) => {
        const s = byId[id] ?? { status: 'skip', detail: 'Not reached.' };
        return h('div', { class: `stage stage-${s.status}` }, [
          h('div', { class: 'stage-head' }, [h('span', { class: 'stage-n', text: String(i + 1) }), icon(iconName, { size: 18 }), h('b', { text: name }), h('span', { class: 'stage-status' }, [icon(STATUS_ICON[s.status] ?? 'device', { size: 16 }), ` ${s.status.toUpperCase()}`])]),
          h('p', { class: 'stage-detail', text: s.detail }),
          s.source ? h('small', { class: 'sub', text: `Source: ${s.source}` }) : null,
          s.devices?.length
            ? h('ul', { class: 'stage-devices' }, s.devices.map((d) => h('li', { class: `tone-${d.status}` }, [icon(d.type === 'computer' ? 'laptop' : d.type === 'unknown' ? 'device' : d.type, { size: 14 }), ` ${d.name ?? TYPE_LABEL[d.type] ?? 'Device'} · ${d.rssi} dBm · ${d.status === 'VERIFIED_UNAUTHORIZED' ? 'UNAUTHORIZED' : d.status.toLowerCase()}`])))
            : null,
          h('small', { class: 'stage-hint', text: hint }),
        ]);
      }),
    );
    const [label, sub, tone] = RESULT[check.result];
    // Old exercise records may contain an approved override.  Show that historical fact,
    // but do not offer an override from the training screen.
    const overridden = Boolean(check.overrideBy);
    $('gc-result').replaceChildren(
      h('div', { class: `gate-result tone-${overridden ? 'warning' : tone}` }, [
        h('div', { class: 'gate-result-main' }, [
          h('b', { text: overridden ? 'ALLOW (override)' : label }),
          h('span', { text: overridden ? `Opened by ${check.overrideBy} against the system’s decision` : sub }),
        ]),
        h('div', { class: 'gate-result-meta' }, [
          h('span', { text: `${check.personName ?? 'Unknown person'} · ${check.cardId || '—'} · #${check.id}` }),
          h('span', { class: `pill ${check.mode === 'online' ? 'st-confirmed' : 'st-escalated'}`, text: check.mode === 'online' ? 'Online' : 'Offline — local directory copy' }),
          check.simulated ? h('span', { class: 'badge badge-demo', text: 'HYBRID TEST · SIMULATED INPUTS' }) : null,
        ]),
        h('span', { class: 'sub', text: 'Training result only — no physical door command is sent.' }),
      ]),
    );
  }

  function renderStatus() {
    const g = state.gate;
    const d = g.directory;
    $('gc-mode').replaceChildren(
      h('span', { class: `chip-lg tone-${g.mode === 'online' ? 'good' : 'warning'}` }, [icon(g.mode === 'online' ? 'check' : 'alert', { size: 16 }), g.mode === 'online' ? ' Training directory: online' : ' Training directory: local copy']),
      h('span', { class: 'sub', text: d ? `Training uses ${d.people} directory records · copy synced ${dateTime(d.syncedAt)}` : 'Training directory copy not created yet' }),
      h('span', { class: 'sub', text: 'Simulation only · live physical cards appear on Gate A' }),
    );
    const p = g.policy;
    if (p) {
      $('gc-policy').replaceChildren(
        ...[1, 2, 3, 4, 5].map((lvl) =>
          h('div', { class: 'policy-row' }, [
            h('span', { class: `lvl lvl-${lvl}`, text: `L${lvl}` }),
            h('span', { text: p.restricted[lvl]?.length ? `Must be registered to the person: ${p.restricted[lvl].map((t) => TYPE_LABEL[t] ?? t).join(', ')}` : 'Any authorized device' }),
          ]),
        ),
        h('p', { class: 'hint', text: `Unregistered device: ${p.unknownDevice === 'deny' ? 'deny' : 'refer to officer'} · face match ≥ ${p.faceMinScore} · local copy valid ${p.directoryCacheMaxAgeHours} h` }),
      );
    }
    const comps = Object.entries(g.components ?? {});
    $('gc-components').replaceChildren(...comps.map(([id, st]) => {
      const label = id === 'A1-SIM' ? 'Badge input · HYBRID TEST' : id;
      return h('span', { class: `pill ${st === 'ok' ? 'st-confirmed' : 'st-new'}`, text: `${label} ${st === 'ok' ? 'OK' : 'DOWN'}` });
    }));
  }

  function renderHistory() {
    const checks = state.gate.checks.filter((check) => check.simulated);
    $('gc-history').replaceChildren(
      ...checks.slice(0, 60).map((c) =>
        h('tr', { class: c.id === shown ? 'row-sel' : '', on: { click: () => ((shown = c.id), renderLane(c), renderHistory()) } }, [
          h('td', { class: 'mono nowrap', text: dateTime(c.t) }),
          h('td', { text: `${c.personName ?? '—'}` }),
          h('td', { class: 'mono', text: c.cardId || '—' }),
          h('td', {}, [h('span', { class: `pill gate-${c.overrideBy ? 'override' : c.result}`, text: c.overrideBy ? 'ALLOW*' : c.result.toUpperCase() })]),
          h('td', { text: c.mode === 'online' ? 'online' : 'offline' }),
          h('td', { class: 'wrap', text: c.overrideBy ? `Override by ${c.overrideBy}` : (c.reasons[0] ?? 'All stages passed') }),
        ]),
      ),
    );
    $('gc-history-empty').hidden = checks.length > 0;
  }

  on('gate', (check) => {
    if (root.hidden) return;
    renderStatus();
    renderHistory();
    if (check?.simulated && check.id === shown) renderLane(check);
  });
  on('people', () => !root.hidden && fillForm());

  return {
    async show() {
      fillForm();
      try {
        await loadGate();
      } catch (err) {
        notify(err.message, 'bad');
      }
      renderStatus();
      renderHistory();
      const checks = state.gate.checks.filter((check) => check.simulated);
      renderLane(checks.find((check) => check.id === shown) ?? checks[0] ?? null);
      if (!shown && checks[0]) shown = checks[0].id;
      $('gc-run').disabled = !session.can('incidents.simulate');
    },
  };
}
