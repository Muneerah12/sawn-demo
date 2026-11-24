// Incident report (print / save as PDF from the browser) and the notice to outside authorities.
// The summary is assembled from the incident record by fixed rules — no external AI service —
// so every sentence can be traced back to a stored fact.
import { SEVERITY_LABEL, STATUS_LABEL } from '../shared/scenarios.js';
import { TASK_STATUS, TEAMS, formatDuration } from '../shared/response.js';
import { get, post } from './api.js';
import { button, dateTime, h, icon, notify } from './ui.js';

const SOURCE = { airspace: 'Airspace sensor', gate: 'Gate A checkpoint', health: 'Health checks', analysis: 'Behaviour analysis', simulator: 'Simulator' };

function modal(cls, title, iconName, content, actions) {
  const dialog = h('dialog', { class: `dialog ${cls}`, attrs: { 'aria-label': title } });
  const close = button('Close', { onClick: () => dialog.close() });
  dialog.append(
    h('div', { class: 'report-wrap' }, [
      h('header', { class: 'dialog-head no-print' }, [icon(iconName, { size: 20 }), h('h2', { text: title })]),
      content,
      h('footer', { class: 'dialog-foot no-print' }, [...actions, close]),
    ]),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/** One line per fact, so each reads on its own (and translates on its own). */
function summaryLines(i, m) {
  return [
    `${i.type} at ${i.zone}.`,
    `Raised ${dateTime(i.createdAt)} by ${SOURCE[i.source] ?? i.source}${i.simulated ? ' (training scenario — simulated)' : ''}.`,
    `Severity: ${SEVERITY_LABEL[i.sev]}. Responsible team: ${TEAMS[i.team] ?? i.team}.`,
    i.assignee ? `Responder: ${i.assignee} (${TASK_STATUS[i.taskStatus] ?? i.taskStatus}).` : 'No responder was assigned.',
    m.toFirstResponse !== null ? `First response after ${formatDuration(m.toFirstResponse)}.` : 'Nobody has responded yet.',
    i.decidedBy ? `Closed as ${STATUS_LABEL[i.status]} by ${i.decidedBy} after ${formatDuration(m.toClose)}.` : `Still open (${STATUS_LABEL[i.status]}).`,
    i.dismissReason ? `Dismissal reason: ${i.dismissReason}.` : null,
  ].filter(Boolean);
}

/** Timeline, notes, audit trail and authority notices in one time-ordered list. */
function events(r) {
  const i = r.incident;
  const list = [
    ...(i.tl ?? []).map(([t, text]) => ({ t, who: 'System', text })),
    ...(i.notes ?? []).map((n) => ({ t: n.t, who: n.by, text: `Note: ${n.text}` })),
    ...r.audit.map((a) => ({ t: a.t, who: a.actor, text: a.detail ? `${a.action}: ${a.detail}` : a.action })),
  ];
  return list.sort((a, b) => a.t - b.t);
}

const table = (head, rows) =>
  h('table', { class: 'report-table' }, [h('thead', {}, [h('tr', {}, head.map((x) => h('th', { text: x })))]), h('tbody', {}, rows.map((row) => h('tr', {}, row.map((x) => h('td', { text: x ?? '—' })))))]);

export async function showReport(ref) {
  let r;
  try {
    r = await get(`incidents/${ref}/report`);
  } catch (err) {
    return notify(err.message, 'bad');
  }
  const i = r.incident;
  const m = r.metrics;
  const details = [
    ['Incident', i.ref],
    ['Type', i.type],
    ['Zone', i.zone],
    ['Source', SOURCE[i.source] ?? i.source],
    ['Severity', SEVERITY_LABEL[i.sev]],
    ['Status', STATUS_LABEL[i.status]],
    ['Responsible team', TEAMS[i.team] ?? i.team],
    ['Raised', dateTime(i.createdAt)],
    ['Last seen', i.repeats ? `${dateTime(i.lastSeenAt)} (${i.repeats + 1} sightings)` : '—'],
    ...(i.card ? [['Card', i.card]] : []),
    ...Object.entries(i.extra ?? {}),
  ];
  const response = [
    ['Responder', i.assignee ?? 'Nobody assigned'],
    ['Assigned by', i.assignedBy ? `${i.assignedBy} · ${dateTime(i.assignedAt)}` : '—'],
    ['Task', TASK_STATUS[i.taskStatus] ?? '—'],
    ['Time to first response', formatDuration(m.toFirstResponse)],
    ['Time to accept', formatDuration(m.toAccept)],
    ['Time to close', formatDuration(m.toClose)],
    ['Closed by', i.decidedBy ? `${i.decidedBy} · ${dateTime(i.decidedAt)}` : '—'],
  ];
  const evidence = [...(i.ev ?? []), ...(i.evx ?? [])];
  const kv = (rows) => h('dl', { class: 'kv report-kv' }, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: String(v ?? '—') })]));
  const sheet = h('article', { class: 'report-sheet' }, [
    h('div', { class: 'report-title' }, [
      h('div', {}, [h('small', { text: 'SAWN · Incident report' }), h('h1', { text: `${i.ref} — ${i.type}` })]),
      i.simulated ? h('span', { class: 'badge badge-demo', text: 'SIMULATED' }) : null,
    ]),
    h('h3', { text: 'Summary' }),
    h('ul', { class: 'report-summary' }, summaryLines(i, m).map((s) => h('li', { text: s }))),
    h('h3', { text: 'Why it was flagged' }),
    h('p', { text: i.reason ?? '—' }),
    h('h3', { text: 'Details' }),
    kv(details),
    h('h3', { text: 'Response' }),
    kv(response),
    h('h3', { text: 'Evidence' }),
    evidence.length ? h('ul', {}, evidence.map((e) => h('li', { text: e }))) : h('p', { text: 'No evidence recorded.' }),
    (i.images ?? []).length
      ? h('div', { class: 'ev-images' }, i.images.map((im) => h('figure', {}, [h('img', { attrs: { src: `api/evidence/${im.file}`, alt: im.label } }), h('figcaption', { text: `${dateTime(im.t)} · ${im.label} ${Number(im.conf).toFixed(2)}` })])))
      : null,
    h('h3', { text: 'Outside authorities' }),
    r.notices.length
      ? table(['Time', 'Authority', 'Reference', 'Reported by', 'Note'], r.notices.map((n) => [dateTime(n.t), n.agency, n.reference, n.author, n.note]))
      : h('p', { text: 'No authority was notified.' }),
    h('h3', { text: 'Timeline and actions' }),
    table(['Time', 'By', 'What happened'], events(r).map((e) => [dateTime(e.t), e.who, e.text])),
    h('p', { class: 'report-foot', text: `Generated by SAWN for ${r.generatedBy} · ${dateTime(r.generatedAt)}. The summary is built from the stored record; check it before sending.` }),
  ].filter(Boolean));
  modal('report-dialog', `Incident report ${i.ref}`, 'report', sheet, [
    button('Print / Save as PDF', { iconName: 'download', cls: 'btn-primary', onClick: () => printSheet(sheet) }),
  ]);
}

/** Prints a plain copy of the sheet (a modal dialog would be clipped to one screen when printed). */
function printSheet(sheet) {
  const copy = h('div', { class: 'print-sheet' }, [sheet.cloneNode(true)]);
  document.body.append(copy);
  document.documentElement.classList.add('printing');
  const done = () => {
    copy.remove();
    document.documentElement.classList.remove('printing');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

/** Prepares what to tell an outside authority and records that they were told. */
export async function showAuthorityNotice(i) {
  let contacts = [];
  try {
    contacts = (await get('response/contacts')).contacts;
  } catch {
    /* no contacts configured: the officer types the authority */
  }
  const brief = h('div', { class: 'brief' }, [
    h('div', { text: `Facility: SAWN · ${i.zone}` }),
    h('div', { text: `What: ${i.type} (${i.ref})` }),
    h('div', { text: `When: ${dateTime(i.createdAt)}` }),
    h('div', { text: `Severity: ${SEVERITY_LABEL[i.sev]}` }),
    h('div', { text: `Details: ${i.reason ?? '—'}` }),
    i.simulated ? h('div', { text: 'This is a TRAINING scenario (simulated).' }) : null,
  ].filter(Boolean));
  const agency = h('input', { attrs: { id: 'auth-agency', list: 'auth-agency-list', maxlength: 80, required: true, placeholder: 'e.g. Police, Civil Defense' } });
  const datalist = h('datalist', { attrs: { id: 'auth-agency-list' } }, contacts.map((c) => h('option', { attrs: { value: c.agency } })));
  const reference = h('input', { attrs: { id: 'auth-ref', maxlength: 60, placeholder: 'Case or call number they gave you' } });
  const note = h('textarea', { attrs: { id: 'auth-note', maxlength: 500, rows: 2, placeholder: 'What they said or will do' } });
  const msg = h('p', { class: 'dialog-msg', attrs: { role: 'alert' } });
  const content = h('div', { class: 'dialog-body' }, [
    h('p', { class: 'dialog-intro', text: 'SAWN does not contact authorities by itself. Call them, read out or send the brief below, then record the call so it is part of the incident file.' }),
    contacts.length
      ? h('ul', { class: 'contacts' }, contacts.map((c) => h('li', {}, [h('b', { text: c.agency }), c.phone ? h('span', { class: 'mono', text: c.phone }) : null, c.note ? h('small', { text: c.note }) : null].filter(Boolean))))
      : h('p', { class: 'hint', text: 'No authority contacts set yet — an administrator adds them under Users & roles.' }),
    h('p', { class: 'sub-h', text: 'Brief to read out or send' }),
    brief,
    h('label', { class: 'field', attrs: { for: 'auth-agency' } }, [h('span', { text: 'Authority contacted' }), agency, datalist]),
    h('label', { class: 'field', attrs: { for: 'auth-ref' } }, [h('span', { text: 'Their reference (optional)' }), reference]),
    h('label', { class: 'field', attrs: { for: 'auth-note' } }, [h('span', { text: 'Note (optional)' }), note]),
    msg,
  ]);
  const dialog = modal('authority-dialog', `Notify authorities · ${i.ref}`, 'alert', content, [
    button('Copy brief', {
      iconName: 'copy',
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(brief.innerText);
          notify('Brief copied.');
        } catch {
          notify('Copy is not available here — select the text instead.', 'warn');
        }
      },
    }),
    button('Record notification', {
      iconName: 'check',
      cls: 'btn-primary',
      onClick: async () => {
        if (!agency.value.trim()) {
          msg.textContent = 'Which authority was contacted?';
          return agency.focus();
        }
        try {
          await post(`incidents/${i.ref}/authority`, { agency: agency.value, reference: reference.value, note: note.value });
          notify('Recorded in the incident file.');
          dialog.close();
        } catch (err) {
          msg.textContent = err.message;
        }
      },
    }),
  ]);
  agency.focus();
}
