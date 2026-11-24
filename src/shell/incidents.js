// Incidents: list + detail with the officer's decision, evidence, timeline and notes.
// Every action goes to the server (permission-checked, audited) and comes back to every console.
import { DISMISS_REASONS, SEVERITY_LABEL, STATUS_LABEL, isOpen } from '../shared/scenarios.js';
import { TASK_STATUS, TEAMS, formatDuration, responseMetrics } from '../shared/response.js';
import { SEGMENTS, bandOf, segmentOf } from '../shared/defenseLayers.js';
import { IncidentProvenance, incidentProvenance } from '../shared/incidentProvenance.js';
import { get, post } from './api.js';
import { emit, on, session } from './hub.js';
import { boxLabel, drawFeed } from './facility.js';
import { showAuthorityNotice, showReport } from './report.js';
import { replaceIncident, sortedIncidents, state } from './store.js';
import { ago, button, clock, dateTime, formDialog, h, icon, notify } from './ui.js';

export function createIncidentsPage({ root, onShow3D, onDrone, droneBusy }) {
  let selected = null;
  let filter = 'open';
  let source = '';
  let query = '';
  let team = '';
  const listEl = root.querySelector('#inc-list');
  const detailEl = root.querySelector('#inc-detail');

  for (const b of root.querySelectorAll('[data-f]')) {
    b.addEventListener('click', () => {
      filter = b.dataset.f;
      for (const x of root.querySelectorAll('[data-f]')) x.setAttribute('aria-pressed', String(x === b));
      renderList();
    });
  }
  root.querySelector('#inc-source').addEventListener('change', (e) => {
    source = e.target.value;
    renderList();
  });
  root.querySelector('#inc-team').addEventListener('change', (e) => {
    team = e.target.value;
    renderList();
  });
  root.querySelector('#inc-search').addEventListener('input', (e) => {
    query = e.target.value.trim().toLowerCase();
    renderList();
  });

  const visibleList = () =>
    sortedIncidents().filter((i) => {
      if (filter === 'open' && !isOpen(i.status)) return false;
      if (filter === 'closed' && isOpen(i.status)) return false;
      if (filter === 'crit' && !(i.sev === 'crit' && isOpen(i.status))) return false;
      if (filter === 'mine' && !(i.assignee === session.user?.username && isOpen(i.status))) return false;
      if (team && i.team !== team) return false;
      if (source && i.source !== source) return false;
      if (query && ![i.ref, i.type, i.zone, i.reason, i.assignee, i.airspace?.identifier, i.airspace?.name].some((v) => v && String(v).toLowerCase().includes(query))) return false;
      return true;
    });

  const SOURCE = { airspace: 'AIRSPACE SENSOR', gate: 'GATE A', health: 'HEALTH CHECK', analysis: 'BEHAVIOUR ANALYSIS', simulator: 'SIMULATOR', camera: 'CAMERA ANALYTICS' };
  function sourceBadge(i) {
    const what = SOURCE[i.source] ?? 'LIVE';
    if (i.testVideo) return h('span', { class: 'badge badge-demo', text: `TEST VIDEO · ${what}` });
    const provenance = incidentProvenance(i);
    const label = {
      [IncidentProvenance.OPERATIONAL]: 'OPERATIONAL',
      [IncidentProvenance.REPLAY]: 'REPLAY',
      [IncidentProvenance.EXERCISE]: 'EXERCISE · SIMULATED',
      [IncidentProvenance.HYBRID]: 'HYBRID TEST',
      [IncidentProvenance.UNKNOWN]: 'UNCLASSIFIED · VERIFY SOURCE',
    }[provenance];
    return h('span', { class: `badge ${provenance === IncidentProvenance.OPERATIONAL ? 'badge-live' : 'badge-demo'}`, text: `${label} · ${what}` });
  }

  // Defense-layer segment (space / link / ground / user) and the RF band where it is real.
  function segTags(i) {
    const s = SEGMENTS.find((x) => x.id === segmentOf(i));
    const band = bandOf(i);
    return [s ? h('span', { class: `seg-tag seg-${s.id}`, text: `${s.icon} ${s.en}`, attrs: { title: `Defense layer: ${s.en} / ${s.ar}` } }) : h('span', { class: 'seg-tag seg-unclassified', text: 'Unclassified', attrs: { title: 'No Defense Layer mapping — verify the source and detector context.' } }), band ? h('span', { class: 'band-tag', text: band, attrs: { title: 'RF band of this detection' } }) : null];
  }

  /** Team, responder and "no response" chips next to the source badge. */
  function responseBadges(i, badges) {
    if (isOpen(i.status) && responseMetrics(i).overdue) badges.push(h('span', { class: 'badge badge-overdue', text: 'NO RESPONSE' }));
    badges.push(h('span', { class: `badge team-${i.team}`, text: TEAMS[i.team] ?? i.team }));
    if (i.assignee) badges.push(h('span', { class: 'badge badge-assignee', text: i.assignee === session.user?.username ? 'You' : i.assignee }));
    return badges;
  }

  // Overdue / unassigned / my tasks / median response, from the server.
  let summaryTimer = null;
  function loadSummary() {
    clearTimeout(summaryTimer);
    summaryTimer = setTimeout(async () => {
      try {
        const s = await get('response/summary');
        root.querySelector('#inc-summary').replaceChildren(
          ...[
            ['Overdue', s.overdue, s.overdue ? 'bad' : ''],
            ['Unassigned', s.unassigned, s.unassigned ? 'warn' : ''],
            ['My tasks', s.myTasks, s.myTasks ? 'info' : ''],
            ['Median first response (24 h)', formatDuration(s.medianFirstResponse24h), ''],
          ].map(([label, value, tone]) => h('span', { class: `sum-chip ${tone ? `tone-${tone}` : ''}` }, [h('small', { text: label }), h('b', { text: String(value) })])),
        );
      } catch {
        /* the summary is optional */
      }
    }, 300);
  }

  function renderList() {
    const rows = visibleList();
    root.querySelector('#inc-count').textContent = `${rows.length} shown`;
    if (!rows.length) {
      listEl.replaceChildren(h('p', { class: 'empty', text: state.loaded.incidents ? 'No incidents in this view.' : 'Loading…' }));
      return;
    }
    listEl.replaceChildren(
      ...rows.slice(0, 300).map((i) =>
        h(
          'button',
          {
            class: 'item',
            attrs: { type: 'button', role: 'option', 'aria-selected': String(i.id === selected) },
            on: { click: () => select(i.id) },
          },
          [
            h('span', { class: `stripe bg-${i.sev}` }),
            h('span', { class: 'item-main' }, [
              h('b', { text: i.type }),
              h('small', { text: `${i.zone} · ${i.ref}${i.repeats ? ` · seen ${i.repeats + 1}×` : ''}` }),
              h('span', { class: 'item-badges' }, responseBadges(i, [sourceBadge(i), ...segTags(i)])),
            ]),
            h('span', { class: 'ago' }, [h('span', { text: ago(i.createdAt) }), h('span', { class: `pill st-${i.status}`, text: STATUS_LABEL[i.status] })]),
          ],
        ),
      ),
    );
  }

  async function act(i, action, extra = {}) {
    try {
      const r = await post(`incidents/${i.ref}/action`, { action, ...extra });
      if (r.pending) {
        notify(`A critical incident is not closed by one person — sent for a second approval: ${r.pending.summary}`, 'warn');
        return true;
      }
      replaceIncident(r);
      return true;
    } catch (err) {
      notify(err.message, 'bad');
      return false;
    }
  }

  function select(id) {
    selected = id;
    const i = state.incidents.find((x) => x.id === id);
    // Opening a new incident acknowledges it (recorded under the officer's name).
    if (i && i.status === 'new' && session.can('incidents.handle') && !root.hidden) act(i, 'ack');
    renderList();
    renderDetail();
  }

  async function taskStep(i, action) {
    let note = '';
    if (action === 'decline' || action === 'resolved') {
      const r = await formDialog({
        title: action === 'decline' ? `Decline ${i.ref}` : `Resolved: ${i.ref}`,
        fields: [{ name: 'note', label: action === 'decline' ? 'Why (the supervisor reassigns it)' : 'What was done (optional)', type: 'textarea', required: action === 'decline' }],
        submitLabel: action === 'decline' ? 'Decline' : 'Mark resolved',
      });
      if (!r) return;
      note = r.note;
    }
    try {
      replaceIncident(await post(`incidents/${i.ref}/task`, { action, note }));
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  async function assign(i) {
    let people;
    try {
      people = (await get('response/responders')).responders;
    } catch (err) {
      return notify(err.message, 'bad');
    }
    // Members of the incident's team first.
    people.sort((a, b) => (b.team === i.team) - (a.team === i.team) || a.username.localeCompare(b.username));
    const r = await formDialog({
      title: `Assign ${i.ref}`,
      iconName: 'team',
      intro: `${i.type} · ${TEAMS[i.team] ?? i.team}`,
      fields: [
        { name: 'username', label: 'Responder', type: 'select', options: people.map((p) => [p.username, `${p.displayName} (${p.username})${p.team ? ` · ${TEAMS[p.team]}` : ''}`]), value: i.assignee ?? people[0]?.username },
      ],
      submitLabel: 'Assign',
    });
    if (!r) return;
    try {
      replaceIncident(await post(`incidents/${i.ref}/assign`, { username: r.username }));
      notify(`${i.ref} assigned to ${r.username}.`);
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  async function reroute(i, next) {
    try {
      replaceIncident(await post(`incidents/${i.ref}/route`, { team: next }));
    } catch (err) {
      notify(err.message, 'bad');
      renderDetail();
    }
  }

  function responseBox(i) {
    const open = isOpen(i.status);
    const m = responseMetrics(i);
    const mine = i.assignee === session.user?.username;
    const lead = session.can('incidents.assign');
    const teamCell =
      open && lead
        ? h(
            'select',
            { class: 'team-select', attrs: { 'aria-label': 'Responsible team' }, on: { change: (e) => reroute(i, e.target.value) } },
            Object.entries(TEAMS).map(([k, v]) => h('option', { attrs: { value: k, selected: k === i.team ? '' : null }, text: v })),
          )
        : h('span', { text: TEAMS[i.team] ?? i.team });
    const waiting = m.toFirstResponse === null && open;
    const steps =
      open && i.assignee && (mine || lead)
        ? [
            i.taskStatus === 'assigned' ? button('Accept', { iconName: 'check', cls: 'btn-ok btn-sm', onClick: () => taskStep(i, 'accept') }) : null,
            i.taskStatus === 'assigned' ? button('Decline', { cls: 'btn-sm', onClick: () => taskStep(i, 'decline') }) : null,
            i.taskStatus === 'accepted' ? button('On scene', { iconName: 'target', cls: 'btn-sm', onClick: () => taskStep(i, 'on_scene') }) : null,
            i.taskStatus === 'accepted' || i.taskStatus === 'on_scene' ? button('Resolved', { iconName: 'check', cls: 'btn-ok btn-sm', onClick: () => taskStep(i, 'resolved') }) : null,
          ].filter(Boolean)
        : [];
    return h('div', { class: `response-box ${m.overdue ? 'is-overdue' : ''}` }, [
      h('p', { class: 'sub-h' }, [icon('team', { size: 16 }), ' Response']),
      m.overdue ? h('p', { class: 'overdue-text', text: `Nobody has responded within ${Math.round(m.deadline / 60_000)} min — supervisors have been alerted.` }) : null,
      h('dl', { class: 'kv' }, [
        h('dt', { text: 'Team' }), h('dd', {}, [teamCell]),
        h('dt', { text: 'Responder' }), h('dd', { text: i.assignee ? `${i.assignee}${mine ? ' (you)' : ''} · ${TASK_STATUS[i.taskStatus] ?? '—'}` : 'Nobody assigned' }),
        h('dt', { text: 'First response' }), h('dd', { text: waiting ? `Waiting · deadline ${Math.round(m.deadline / 60_000)} min` : formatDuration(m.toFirstResponse) }),
        ...(i.assignedAt ? [h('dt', { text: 'Accepted after' }), h('dd', { text: formatDuration(m.toAccept) })] : []),
        ...(m.toClose !== null ? [h('dt', { text: 'Closed after' }), h('dd', { text: formatDuration(m.toClose) })] : []),
      ]),
      open && (lead || steps.length)
        ? h('div', { class: 'row wrap' }, [...steps, lead ? button(i.assignee ? 'Reassign…' : 'Assign…', { iconName: 'team', cls: 'btn-sm', onClick: () => assign(i) }) : null].filter(Boolean))
        : null,
    ].filter(Boolean));
  }

  // "Where is the pilot?" — the Remote ID operator position of a drone incident.
  const PILOT_TYPE = { 'Take-off position': 'Take-off point (where the drone launched)', 'Live GNSS': "Live GNSS (the pilot's current position)", Fixed: 'Fixed location (entered by the pilot)' };
  const metres = (v) => (Number.isFinite(v) ? (v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${v} m`) : '—');
  function pilotCard(i, open) {
    const p = i.pilot;
    const coords = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
    const g = i.guardDispatched;
    return h('div', { class: `air-box pilot-box${p.inside ? ' inside' : ''}` }, [
      h('p', { class: 'sub-h' }, [icon('person', { size: 16 }), ' Pilot location', p.inside ? h('span', { class: 'pill s-crit', text: 'INSIDE THE SITE — insider risk' }) : null, i.simulated ? h('span', { class: 'badge badge-sim', text: 'SIMULATED' }) : null]),
      h('dl', { class: 'kv' }, [
        h('dt', { text: 'Coordinates' }), h('dd', { class: 'mono', text: coords }),
        h('dt', { text: 'Location type' }), h('dd', { text: PILOT_TYPE[p.type] ?? p.type ?? '—' }),
        h('dt', { text: 'Operator ID' }), h('dd', { class: 'mono', text: p.operatorId ?? 'not broadcast' }),
        h('dt', { text: 'From the site' }), h('dd', { text: `${metres(p.distanceToSiteM)}${p.inside ? ' — inside the boundary' : p.inside === false ? ' — outside the boundary' : ''}` }),
        h('dt', { text: 'From the drone' }), h('dd', { text: metres(p.distanceToDroneM) }),
        h('dt', { text: 'Guard' }), h('dd', { text: g ? `dispatched by ${g.by} · ${clock(g.at)}` : 'not dispatched' }),
      ]),
      h('div', { class: 'row wrap' }, [
        button('Copy coordinates', {
          iconName: 'copy',
          cls: 'btn-sm',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(coords);
              notify(`Copied ${coords}`);
            } catch {
              notify('Could not copy — select the coordinates and copy them by hand.', 'bad');
            }
          },
        }),
        h('a', { class: 'btn btn-sm', attrs: { href: `https://www.google.com/maps?q=${p.lat},${p.lon}`, target: '_blank', rel: 'noopener noreferrer' } }, [icon('external', { size: 16 }), h('span', { text: 'Open in Google Maps' })]),
        open
          ? button(g ? 'Guard dispatched' : 'Dispatch guard', { iconName: 'person', cls: 'btn-primary btn-sm', perm: 'incidents.handle', attrs: { disabled: g ? '' : null }, onClick: () => act(i, 'dispatch-guard') })
          : null,
      ]),
    ]);
  }

  function renderDetail() {
    const i = state.incidents.find((x) => x.id === selected);
    if (!i) {
      detailEl.replaceChildren(h('div', { class: 'empty big-empty' }, [icon('shieldCheck', { size: 40 }), h('p', { text: 'Select an incident to see why it was flagged, the evidence and your options.' })]));
      return;
    }
    const open = isOpen(i.status);
    const handle = session.can('incidents.handle');
    const escalatedLock = i.status === 'escalated' && !session.can('incidents.decideEscalated');
    const ev = [...(i.ev ?? []), ...(i.evx ?? [])];
    const meta = [
      ['Zone', i.zone],
      ['Device', i.dev ?? '—'],
      ['Raised', dateTime(i.createdAt)],
      ['Last seen', i.repeats ? `${dateTime(i.lastSeenAt)} (${i.repeats + 1} sightings)` : '—'],
      ['Severity', SEVERITY_LABEL[i.sev]],
      ...Object.entries(i.extra ?? {}),
      ...(i.card ? [['Card', i.card]] : []),
      ...(i.decidedBy ? [['Decision', `${i.decidedBy} · ${dateTime(i.decidedAt)}`]] : []),
      ['Incident', i.ref],
    ];

    const decision = open
      ? h('div', { class: 'decision' }, [
          h('p', { class: 'sub-h', text: escalatedLock ? 'Escalated — waiting for the shift supervisor' : 'Your decision' }),
          h('div', { class: 'big' }, [
            button('Confirm incident', { iconName: 'check', cls: 'btn-ok', perm: escalatedLock ? 'incidents.decideEscalated' : 'incidents.handle', onClick: () => act(i, 'confirm') }),
            button('False alarm', {
              iconName: 'close',
              perm: escalatedLock ? 'incidents.decideEscalated' : 'incidents.handle',
              onClick: async () => {
                const r = await formDialog({
                  title: `Dismiss ${i.ref} as a false alarm`,
                  fields: [{ name: 'reason', label: 'Reason', type: 'select', options: DISMISS_REASONS.map((x) => [x, x]), value: i.source === 'airspace' ? 'Device registered after check' : 'Test or drill' }],
                  submitLabel: 'Dismiss',
                });
                if (r) act(i, 'dismiss', { reason: r.reason });
              },
            }),
            i.status !== 'escalated'
              ? button('Escalate to supervisor', {
                  iconName: 'alert',
                  cls: 'btn-warn',
                  perm: 'incidents.handle',
                  onClick: async () => {
                    const r = await formDialog({ title: `Escalate ${i.ref}`, fields: [{ name: 'reason', label: 'Why (optional)', type: 'textarea' }], submitLabel: 'Escalate' });
                    if (r) act(i, 'escalate', { reason: r.reason });
                  },
                })
              : null,
          ]),
        ])
      : h('div', { class: 'decision closed' }, [
          h('p', { text: `Closed by ${i.decidedBy ?? '—'} · ${STATUS_LABEL[i.status]}${i.dismissReason ? ` · reason: ${i.dismissReason}` : ''}` }),
          button('Reopen', { iconName: 'refresh', perm: 'incidents.handle', onClick: () => act(i, 'reopen') }),
        ]);

    const air = i.airspace;
    const airBox = air
      ? h('div', { class: 'air-box' }, [
          h('p', { class: 'sub-h' }, [icon('sensor', { size: 16 }), ' Wireless device']),
          h('dl', { class: 'kv' }, [
            h('dt', { text: 'Device' }), h('dd', { text: air.name ?? '—' }),
            h('dt', { text: 'Address' }), h('dd', { class: 'mono', text: `${air.identifier} (${air.protocol}${air.randomized ? ', randomized' : ''})` }),
            h('dt', { text: 'Type / OS' }), h('dd', { text: [air.deviceType, air.os, air.confidence && `${air.confidence} confidence`].filter(Boolean).join(' · ') || '—' }),
            h('dt', { text: 'Signal' }), h('dd', { text: air.rssi !== null ? `${air.rssi} dBm at ${air.sensorId}` : '—' }),
          ]),
          h('div', { class: 'row wrap' }, [
            button('Review in Device Registry', { iconName: 'registry', cls: 'btn-sm', onClick: () => emit('registry-review', { identifier: air.identifier, protocol: air.protocol, name: air.name }) }),
            button('Show on radar', { iconName: 'target', cls: 'btn-sm', onClick: () => emit('navigate', { tab: 'airspace', focus: `${air.protocol}|${air.identifier}` }) }),
          ]),
        ])
      : null;

    // Real camera frames saved by the server; otherwise the simulated snapshot.
    const images = (i.images ?? []).length
      ? h('div', { class: 'ev-images' }, i.images.map((im) => h('figure', {}, [h('img', { attrs: { src: `api/evidence/${im.file}`, alt: `${im.label} · ${clock(im.t)}`, loading: 'lazy' } }), h('figcaption', { text: `${clock(im.t)} · ${im.label} ${Number(im.conf).toFixed(2)}` })])))
      : null;
    const pilotBox = i.pilot && Number.isFinite(i.pilot.lat) ? pilotCard(i, open) : null;
    const snap = !images && i.cam ? h('canvas', { class: 'snap', attrs: { width: 480, height: 270, 'aria-label': 'Evidence snapshot (simulated)' } }) : null;
    const noteText = h('textarea', { attrs: { 'aria-label': 'New note', placeholder: 'Add a note for the record', maxlength: 1000, rows: 2 } });

    // replaceChildren() would print a null as the text "null": drop the optional parts first.
    detailEl.replaceChildren(...[
      h('div', { class: 'dhead' }, [
        h('h3', { text: i.type }),
        sourceBadge(i),
        ...segTags(i),
        h('span', { class: `pill s-${i.sev}`, text: SEVERITY_LABEL[i.sev] }),
        h('span', { class: `pill st-${i.status}`, text: STATUS_LABEL[i.status] }),
      ]),
      h('div', { class: 'why' }, [
        h('b', {}, ['Why was this flagged?', i.conf ? h('span', { class: 'inf', text: `Camera inference · confidence ${i.conf.toFixed(2)}` }) : null]),
        h('p', { text: i.reason }),
      ]),
      decision,
      responseBox(i),
      pilotBox,
      airBox,
      h('div', { class: 'cols' }, [
        h('div', {}, [h('p', { class: 'sub-h', text: 'Evidence' }), h('ul', { class: 'ev' }, ev.map((e) => h('li', { text: e })))]),
        snap ? h('div', {}, [h('p', { class: 'sub-h', text: 'Evidence snapshot' }), snap]) : null,
        images ? h('div', {}, [h('p', { class: 'sub-h', text: 'Camera frames (evidence)' }), images]) : null,
      ]),
      h('div', { class: 'more' }, [
        button('Report / PDF', { iconName: 'report', onClick: () => showReport(i.ref) }),
        button('Notify authorities', { iconName: 'alert', perm: 'incidents.handle', onClick: () => showAuthorityNotice(i) }),
        button('Show on site view', { iconName: 'map', onClick: () => onShow3D(i) }),
        i.drone === 'done'
          ? h('span', { class: 'pill st-confirmed', text: 'Drone feed attached' })
          : button(i.drone === 'flying' ? 'Drone on the way…' : 'Send drone', {
              iconName: 'drone',
              cls: 'btn-primary',
              perm: 'incidents.handle',
              attrs: { disabled: i.drone === 'flying' || droneBusy() ? '' : null },
              onClick: () => onDrone(i),
            }),
      ]),
      h('details', { class: 'tech', attrs: { open: true } }, [
        h('summary', { text: 'Event timeline and details' }),
        h('ul', { class: 'tl' }, (i.tl ?? []).map(([t, text]) => h('li', {}, [h('time', { text: clock(t) }), h('span', { text })]))),
        h('div', { class: 'meta' }, meta.map(([k, v]) => h('div', {}, [h('small', { text: k }), h('span', { text: String(v) })]))),
      ]),
      h('details', { class: 'tech', attrs: { open: (i.notes ?? []).length > 0 } }, [
        h('summary', { text: `Officer notes (${(i.notes ?? []).length})` }),
        h('div', { class: 'notes' }, [
          ...(i.notes ?? []).map((n) => h('div', { class: 'note', text: `${n.by} · ${dateTime(n.t)}: ${n.text}` })),
          handle ? noteText : null,
          handle
            ? button('Add note', {
                iconName: 'edit',
                onClick: async () => {
                  const text = noteText.value.trim();
                  if (!text) return;
                  try {
                    replaceIncident(await post(`incidents/${i.ref}/notes`, { text }));
                  } catch (err) {
                    notify(err.message, 'bad');
                  }
                },
              })
            : null,
        ]),
      ]),
    ].filter(Boolean));
    if (snap) drawFeed(snap.getContext('2d'), i.cam, performance.now(), { alert: true, label: boxLabel(i), conf: i.conf, frozen: true });
  }

  on('incidents', ({ incident } = {}) => {
    if (root.hidden) return;
    loadSummary();
    renderList();
    if (!incident || incident.id === selected) renderDetail();
  });
  // Every 15 s: ages, "no response" chips and the summary move on with the clock.
  setInterval(() => {
    if (root.hidden) return;
    renderList();
    loadSummary();
  }, 15_000);

  return {
    show() {
      loadSummary();
      if (!selected) selected = sortedIncidents().find((i) => isOpen(i.status))?.id ?? null;
      renderList();
      renderDetail();
      const i = state.incidents.find((x) => x.id === selected);
      if (i && i.status === 'new' && session.can('incidents.handle')) act(i, 'ack');
    },
    select(id) {
      selected = id;
    },
    refresh() {
      renderList();
      renderDetail();
    },
  };
}
