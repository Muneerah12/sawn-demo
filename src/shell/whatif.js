// SAWN WHAT-IF: analyses a possible situation without creating anything — which team would get
// it, who would be paged, how the response would unfold against the deadlines, what failed
// components change, and the recommended steps. Rules come from src/shared/response.js and
// src/shared/playbooks.js; people and contacts from the database.
import { FAILURES, failureEffects, playbook, suggestedAuthorities } from '../shared/playbooks.js';
import { RESPONSE_DEADLINE_MIN, TEAMS, routeIncident } from '../shared/response.js';
import { SCENARIOS, SCENARIO_GROUPS, SEVERITY_LABEL } from '../shared/scenarios.js';
import { get, post } from './api.js';
import { button, h, notify } from './ui.js';

export function createWhatIf({ root }) {
  const box = root.querySelector('#whatif');
  let responders = null;
  let contacts = [];

  const scenario = h('select', { attrs: { id: 'wi-scenario', 'aria-label': 'Situation' } },
    SCENARIO_GROUPS.map(([group, keys]) => h('optgroup', { attrs: { label: group } }, keys.filter((k) => SCENARIOS[k]).map((k) => h('option', { attrs: { value: k }, text: SCENARIOS[k].label })))),
  );
  scenario.value = 'fire';
  const failures = Object.entries(FAILURES).map(([k, label]) => {
    const input = h('input', { attrs: { type: 'checkbox', value: k } });
    input.addEventListener('change', render);
    return [k, input, h('label', { class: 'switch' }, [input, h('span', { text: label })])];
  });
  const result = h('div', { class: 'whatif-result' });
  scenario.addEventListener('change', render);

  box.replaceChildren(
    h('div', { class: 'whatif-form' }, [
      h('label', { class: 'field', attrs: { for: 'wi-scenario' } }, [h('span', { text: 'Situation' }), scenario]),
      h('div', { class: 'field' }, [h('span', { text: 'What is not working' }), h('div', { class: 'whatif-fails' }, failures.map(([, , el]) => el))]),
      button('Run as training scenario', {
        iconName: 'play',
        perm: 'incidents.simulate',
        onClick: async () => {
          try {
            const r = await post('incidents/simulate', { scenario: scenario.value });
            notify(`Training incident ${r.incident.ref} created — see Incidents.`);
          } catch (err) {
            notify(err.message, 'bad');
          }
        },
      }),
    ]),
    result,
  );

  const section = (title, children) => h('div', { class: 'whatif-card' }, [h('h3', { text: title }), ...children]);

  function render() {
    const key = scenario.value;
    const s = SCENARIOS[key];
    const team = routeIncident({ scenario: key, title: s.type, zone: s.zone });
    const fails = failures.filter(([, input]) => input.checked).map(([k]) => k);
    const deadline = RESPONSE_DEADLINE_MIN[s.sev] ?? 15;
    const staff = responders ?? [];
    const members = staff.filter((p) => p.team === team);
    const paged = members.length ? members : staff;
    // Night: assume half the team is on site.
    const onSite = fails.includes('night') ? Math.ceil(paged.length / 2) : paged.length;

    const risks = [
      !members.length ? `Nobody is in the ${TEAMS[team]} team — every responder is paged instead. Put people in the team under Users & roles.` : null,
      onSite === 0 ? 'Nobody would be paged: no active user can handle incidents.' : null,
      onSite === 1 ? 'Only one responder: if they are busy, nobody responds before the deadline.' : null,
      s.sev === 'crit' ? 'Critical: closing it as a false alarm needs a second approver (two-person rule).' : null,
      fails.includes('drone') && ['breach', 'circling', 'drone', 'fire'].includes(key) ? 'The drone is a key check here and it is unavailable.' : null,
      fails.includes('sensor') && ['hacktool', 'deauth', 'jamming', 'eviltwin', 'blespam', 'drone'].includes(key) ? 'This situation is detected by the airspace sensor — with it offline it would not be detected at all.' : null,
    ].filter(Boolean);

    const timeline = [
      ['0 s', `Detected: “${s.type}” at ${s.zone} (${SEVERITY_LABEL[s.sev]})`],
      ['≈5 s', `${TEAMS[team]} paged: ${paged.length ? paged.map((p) => p.displayName).join(', ') : 'nobody'}`],
      [`${deadline} min`, 'If nobody has responded: shift supervisors alerted'],
      [`${deadline * 3} min`, 'Still nobody: supervisors alerted again'],
    ];
    const authorities = suggestedAuthorities(key, team, contacts);

    result.replaceChildren(
      section('Who handles it', [
        h('dl', { class: 'kv' }, [
          h('dt', { text: 'Team' }), h('dd', { text: TEAMS[team] }),
          h('dt', { text: 'Severity' }), h('dd', { text: SEVERITY_LABEL[s.sev] }),
          h('dt', { text: 'Response deadline' }), h('dd', { text: `${deadline} min` }),
          h('dt', { text: 'Responders available' }), h('dd', { text: responders ? `${onSite} of ${paged.length}${fails.includes('night') ? ' (night: about half on site)' : ''}` : 'loading…' }),
        ]),
      ]),
      section('How the response would unfold', [h('ul', { class: 'tl' }, timeline.map(([t, text]) => h('li', {}, [h('time', { text: t }), h('span', { text })])))]),
      section('Risks', risks.length ? [h('ul', { class: 'whatif-risks' }, risks.map((r) => h('li', { text: r })))] : [h('p', { class: 'sub', text: 'No particular risk found for this situation.' })]),
      section('What the failures change', fails.length ? [h('ul', {}, failureEffects(fails).map((f) => h('li', {}, [h('b', { text: f.failure }), h('span', { text: ` — ${f.effect}` })])))] : [h('p', { class: 'sub', text: 'Everything working.' })]),
      section('Recommended steps', [h('ol', {}, playbook(key, team).map((step) => h('li', { text: step })))]),
      section('Outside authorities', authorities.length
        ? [h('ul', { class: 'contacts' }, authorities.map((c) => h('li', {}, [h('b', { text: c.agency }), c.phone ? h('span', { class: 'mono', text: c.phone }) : null].filter(Boolean))))]
        : [h('p', { class: 'sub', text: 'No matching contact in the list — an administrator adds them under Users & roles.' })]),
    );
  }

  async function load() {
    try {
      responders = (await get('response/responders')).responders;
    } catch {
      responders = [];
    }
    try {
      contacts = (await get('response/contacts')).contacts;
    } catch {
      contacts = [];
    }
    render();
  }

  render();
  return { show: load };
}
