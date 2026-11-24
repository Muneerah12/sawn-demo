// People & cards: who may enter, at which security level, with which access cards and which
// registered wireless devices. Adding / editing / removing people and issuing / revoking cards
// are permission-checked by the server and recorded in the audit log.
import { del, get, patch, post } from './api.js';
import { emit, on, session } from './hub.js';
import { loadPeople, state } from './store.js';
import { button, confirmDialog, formDialog, h, icon, notify } from './ui.js';

export const LEVELS = {
  1: 'Level 1 · Reception (public lobby)',
  2: 'Level 2 · Offices',
  3: 'Level 3 · Warehouses',
  4: 'Level 4 · Server room and labs',
  5: 'Level 5 · Control room and vault',
};
const KIND = { staff: 'Staff', contractor: 'Contractor', visitor: 'Visitor' };
const CARD_STATUS = { active: ['Active', 'st-confirmed'], revoked: ['Revoked', 'st-new'], suspended: ['Suspended', 'st-escalated'] };

/** "Test Visitor" → TV, "Staff 01" → ST (numbers are not initials). */
function initials(name) {
  const words = name.split(/\s+/).filter(Boolean);
  const last = words.at(-1);
  return (words.length > 1 && /^\p{L}/u.test(last) ? words[0][0] + last[0] : words[0].slice(0, 2)).toUpperCase();
}

export function createPeoplePage({ root }) {
  const body = root.querySelector('#people-body');
  const cardsBody = root.querySelector('#cards-body');
  let query = '';
  let kind = '';
  const expanded = new Set();

  root.querySelector('#people-search').addEventListener('input', (e) => {
    query = e.target.value.trim().toLowerCase();
    render();
  });
  root.querySelector('#people-kind').addEventListener('change', (e) => {
    kind = e.target.value;
    render();
  });
  const addSlot = root.querySelector('#people-add-slot');
  function mountAdd() {
    addSlot.replaceChildren(button('Add person', { iconName: 'plus', cls: 'btn-primary', perm: 'people.manage', onClick: () => editPerson(null) }));
  }

  /** Runs an API call; a "pending" answer means it waits for a second approver. */
  async function run(promise, ok) {
    try {
      const r = await promise;
      if (r?.pending) notify(`Sent for a second approval: ${r.pending.summary}`, 'warn');
      else notify(ok);
      await loadPeople();
      return r;
    } catch (err) {
      notify(err.message, 'bad');
      return null;
    }
  }

  let staff = [];
  async function loadStaff() {
    staff = (await get('staff').catch(() => ({ staff: [] }))).staff;
  }
  const toLocal = (t) => (t ? new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');

  async function editPerson(p) {
    await loadStaff();
    const fields = [
      { name: 'name', label: 'Full name', required: true, value: p?.name, maxlength: 80 },
      { name: 'kind', label: 'Type', type: 'select', options: Object.entries(KIND), value: p?.kind ?? 'visitor' },
      { name: 'organization', label: 'Organization / department', value: p?.organization ?? '', maxlength: 80 },
      { name: 'clearance', label: 'Highest security level', type: 'select', options: Object.entries(LEVELS), value: p?.clearance ?? 1 },
      {
        name: 'validUntil',
        label: 'Access ends (required for visitors and contractors)',
        type: 'datetime-local',
        value: p ? toLocal(p.validUntil) : toLocal(Date.now() + 8 * 3_600_000),
        hint: 'Cards and device authorizations are removed automatically at this time; the sponsor is told. Leave empty for permanent staff.',
      },
      { name: 'sponsorUserId', label: 'Sponsor (responsible employee)', type: 'select', options: [['', '— none —'], ...staff.map((u) => [String(u.id), u.displayName])], value: p?.sponsorUserId ?? session.user.id, hint: 'Gets the reminders, and is warned if this person tries to enter after their access ends.' },
      { name: 'faceEnrolled', label: 'Face enrolled for the gate camera', type: 'checkbox', value: p ? p.faceEnrolled : false },
      { name: 'escortRequired', label: 'Needs an escort beyond reception', type: 'checkbox', value: p ? p.escortRequired : true },
      { name: 'notes', label: 'Notes', type: 'textarea', value: p?.notes ?? '' },
    ];
    if (!p && session.can('cards.manage')) {
      fields.push({ name: 'issueCard', label: 'Issue an access card now (valid until the same end time)', type: 'checkbox', value: true });
      fields.push({ name: 'cardId', label: 'Card number (leave empty for the next free one)', placeholder: 'C-1234', maxlength: 10, pattern: '[Cc]-\\d{3,6}' });
    }
    const r = await formDialog({ title: p ? `Edit ${p.name}` : 'Add a person', iconName: 'person', fields, submitLabel: p ? 'Save' : 'Add person' });
    if (!r) return;
    const payload = {
      name: r.name, kind: r.kind, organization: r.organization, clearance: Number(r.clearance), escortRequired: r.escortRequired, notes: r.notes,
      validUntil: r.validUntil ? new Date(r.validUntil).getTime() : null,
      sponsorUserId: r.sponsorUserId ? Number(r.sponsorUserId) : null,
      faceEnrolled: r.faceEnrolled,
    };
    if (p) await run(patch(`people/${p.id}`, payload), `${r.name} updated.`);
    else {
      const out = await run(post('people', { ...payload, issueCard: r.issueCard, cardId: r.cardId || null }), `${r.name} added.`);
      if (out?.card) notify(`${r.name} added with card ${out.card.id}.`);
    }
  }

  async function showRisk(p) {
    try {
      const r = await get(`people/${p.id}/risk`);
      await formDialog({
        title: `Insider risk: ${p.name} (score ${r.score})`,
        intro:
          (r.events.length ? r.events.slice(0, 12).map((e) => `${new Date(e.t).toLocaleString()} — ${e.detail ?? e.kind} (+${e.points})`).join('\n') : 'No events.') +
          '\n\nEach event fades with a 14-day half-life. The score is a prompt for a review, not a verdict.',
        fields: [],
        submitLabel: 'Close',
      });
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  const accessCell = (p) => {
    if (p.deprovisionedAt) return h('span', { class: 'pill st-new', text: 'Ended · removed automatically' });
    if (!p.validUntil) return h('span', { class: 'sub', text: 'Permanent' });
    const left = p.validUntil - Date.now();
    const txt = left <= 0 ? 'ended' : left < 3_600_000 ? `${Math.ceil(left / 60_000)} min left` : left < 86_400_000 ? `${Math.round(left / 3_600_000)} h left` : `until ${new Date(p.validUntil).toLocaleDateString()}`;
    return h('span', { class: `pill ${left < 86_400_000 ? 'st-escalated' : 'st-ack'}`, text: txt, attrs: { title: new Date(p.validUntil).toLocaleString() } });
  };
  const riskCell = (p) => {
    if (p.risk === null || p.risk === undefined) return h('span', { class: 'sub', text: '—' });
    const tone = p.risk >= 80 ? 'st-new' : p.risk >= 50 ? 'st-escalated' : p.risk > 0 ? 'st-ack' : 'st-dismissed';
    return button(String(p.risk), { cls: `btn-sm risk-btn ${tone}`, title: 'Insider-risk score — click for the events', onClick: () => showRisk(p) });
  };

  async function removePerson(p) {
    const authorized = p.devices.filter((d) => d.status === 'AUTHORIZED').length;
    const activeCards = p.cards.filter((c) => c.status !== 'revoked').map((c) => c.id);
    const ok = await confirmDialog({
      title: `Remove ${p.name}?`,
      message:
        `This offboards ${p.name}: ` +
        [activeCards.length ? `card${activeCards.length > 1 ? 's' : ''} ${activeCards.join(', ')} will be revoked` : 'no active cards', authorized ? `${authorized} wireless device authorization${authorized > 1 ? 's' : ''} will be lifted (the devices become UNKNOWN at the gate)` : 'no authorized devices'].join(', ') +
        '. Unauthorized-device entries stay. The removal is recorded in the audit log.',
      confirmLabel: 'Remove person',
      danger: true,
    });
    if (ok) await run(del(`people/${p.id}`), `${p.name} removed.`);
  }

  async function issueCard(p) {
    const r = await formDialog({ title: `Issue a card to ${p.name}`, iconName: 'card', fields: [{ name: 'id', label: 'Card number (leave empty for the next free one)', placeholder: 'C-1234', maxlength: 10, pattern: '[Cc]-\\d{3,6}' }], submitLabel: 'Issue card' });
    if (r) await run(post('cards', { personId: p.id, id: r.id || null }), `Card issued to ${p.name}.`);
  }

  const setCard = (c, status) => run(patch(`cards/${c.id}`, { status }), `${c.id}: ${CARD_STATUS[status][0]}.`);

  async function setPin(c) {
    const r = await formDialog({
      title: `${c.pinSet ? 'Change' : 'Set'} PIN for ${c.id}`,
      iconName: 'key',
      intro: `A 4–8 digit second factor for ${c.holder ?? c.id}. A copied card cannot pass without it. The PIN is hashed on the server and never shown again.`,
      fields: [{ name: 'pin', label: 'New PIN (4–8 digits)', type: 'password', required: true, attrs: { inputmode: 'numeric', pattern: '\\d{4,8}', maxlength: '8' } }],
      submitLabel: 'Set PIN',
    });
    if (r) await run(post(`cards/${c.id}/pin`, { pin: r.pin }), `PIN set for ${c.id}.`);
  }
  async function clearPin(c) {
    const ok = await confirmDialog({
      title: `Remove the PIN from ${c.id}?`,
      message: `${c.holder ?? 'The holder'} will no longer be asked for a PIN — the card becomes the only factor. Recorded in the audit log.`,
      confirmLabel: 'Remove PIN',
      danger: true,
    });
    if (ok) await run(post(`cards/${c.id}/pin`, { pin: '' }), `PIN removed from ${c.id}.`);
  }

  async function unlinkPhysicalCredential(c) {
    const ok = await confirmDialog({
      title: `Unlink the physical NFC card from ${c.id}?`,
      message: `Future Gate A taps of this physical card will be unlinked. ${c.holder ?? 'The current holder'} keeps the logical SAWN card ${c.id}; this action does not revoke it. The change is recorded in the audit log.`,
      confirmLabel: 'Unlink physical NFC card',
      danger: true,
    });
    if (ok) await run(del(`cards/${c.id}/physical-credential`), `Physical NFC credential unlinked from ${c.id}.`);
  }

  function render() {
    const list = state.people.filter((p) => (!kind || p.kind === kind) && (!query || [p.name, p.organization, ...p.cards.map((c) => c.id)].some((v) => v && v.toLowerCase().includes(query))));
    root.querySelector('#people-count').textContent = `${list.length} of ${state.people.length} people · ${state.cards.filter((c) => c.status === 'active').length} active cards`;
    root.querySelector('#people-empty').hidden = list.length > 0;
    const rows = [];
    for (const p of list) {
      const open = expanded.has(p.id);
      rows.push(
        h('tr', { class: p.status === 'suspended' ? 'row-muted' : '' }, [
          h('td', {}, [
            h('div', { class: 'person' }, [
              h('span', { class: `avatar kind-${p.kind}`, text: initials(p.name) }),
              h('div', {}, [h('strong', { text: p.name }), h('div', { class: 'sub', text: p.organization ?? '' })]),
            ]),
          ]),
          h('td', {}, [h('span', { class: `badge kind-badge kind-${p.kind}`, text: KIND[p.kind] })]),
          h('td', {}, [h('span', { class: `lvl lvl-${p.clearance}`, text: `L${p.clearance}`, attrs: { title: LEVELS[p.clearance] } }), p.escortRequired ? h('span', { class: 'sub', text: ' escort' }) : null]),
          h('td', {}, [
            accessCell(p),
            h('div', { class: 'sub', text: p.sponsorName ? `sponsor ${p.sponsorName}` : p.kind === 'staff' ? '' : 'no sponsor' }),
            p.reviewDue
              ? button('Review due', { cls: 'btn-sm btn-warn', perm: 'people.manage', title: 'Confirm this person still needs this level of access', onClick: () => run(post(`people/${p.id}/review`), `Access review recorded for ${p.name}.`) })
              : null,
            !p.faceEnrolled ? h('div', { class: 'sub warn-text', text: 'face not enrolled' }) : null,
          ]),
          h('td', {}, p.cards.length ? p.cards.map((c) => h('span', { class: 'card-link-state' }, [
            h('span', { class: `pill ${CARD_STATUS[c.status][1]} mono`, text: c.id, attrs: { title: CARD_STATUS[c.status][0] } }),
            h('small', { class: c.physicalCredential ? 'sub good-text' : 'sub', text: c.physicalCredential ? ' NFC enrolled' : ' NFC not enrolled' }),
          ])) : [h('span', { class: 'sub', text: 'no card' })]),
          h('td', {}, [
            button(`${p.devices.length}`, { iconName: 'wifi', cls: 'btn-ghost btn-sm', title: 'Registered wireless devices', onClick: () => (expanded.has(p.id) ? expanded.delete(p.id) : expanded.add(p.id), render()), attrs: { 'aria-expanded': String(open) } }),
          ]),
          h('td', {}, [riskCell(p)]),
          h('td', {}, [h('span', { class: `pill ${p.status === 'active' ? 'st-confirmed' : 'st-escalated'}`, text: p.status === 'active' ? 'Active' : 'Suspended' })]),
          h('td', { class: 'actions-col' }, [
            h('div', { class: 'row' }, [
              button('', { iconName: 'edit', cls: 'btn-icon', title: 'Edit', perm: 'people.manage', onClick: () => editPerson(p), attrs: { 'aria-label': `Edit ${p.name}` } }),
              button('', { iconName: 'card', cls: 'btn-icon', title: 'Issue card', perm: 'cards.manage', onClick: () => issueCard(p), attrs: { 'aria-label': `Issue a card to ${p.name}` } }),
              button('', {
                iconName: p.status === 'active' ? 'lock' : 'check',
                cls: 'btn-icon',
                title: p.status === 'active' ? 'Suspend' : 'Reinstate',
                perm: 'people.manage',
                onClick: () => run(patch(`people/${p.id}`, { status: p.status === 'active' ? 'suspended' : 'active' }), `${p.name} ${p.status === 'active' ? 'suspended' : 'reinstated'}.`),
                attrs: { 'aria-label': `${p.status === 'active' ? 'Suspend' : 'Reinstate'} ${p.name}` },
              }),
              button('', { iconName: 'trash', cls: 'btn-icon btn-danger', title: 'Remove person', perm: 'people.manage', onClick: () => removePerson(p), attrs: { 'aria-label': `Remove ${p.name}` } }),
            ]),
          ]),
        ]),
      );
      if (open) {
        rows.push(
          h('tr', { class: 'detail-row' }, [
            h('td', { attrs: { colspan: 9 } }, [
              p.devices.length
                ? h(
                    'ul',
                    { class: 'owned' },
                    p.devices.map((d) =>
                      h('li', {}, [
                        icon(d.status === 'AUTHORIZED' ? 'check' : 'block', { size: 16 }),
                        h('span', { class: 'mono', text: `${d.id}` }),
                        h('span', { class: 'sub', text: `${d.protocol} · ${d.label ?? ''}` }),
                        h('span', { class: `pill ${d.status === 'AUTHORIZED' ? 'st-confirmed' : 'st-new'}`, text: d.status === 'AUTHORIZED' ? 'Authorized' : 'Unauthorized' }),
                        button('Review in Device Registry', { cls: 'btn-sm', onClick: () => emit('registry-review', { identifier: d.id, protocol: d.protocol, name: d.label ?? null }) }),
                      ]),
                    ),
                  )
                : h('p', { class: 'hint', text: 'No registered devices. Review an observed device in Device Registry and choose this person as its owner.' }),
            ]),
          ]),
        );
      }
    }
    body.replaceChildren(...rows);

    cardsBody.replaceChildren(
      ...state.cards.map((c) => {
        const [label, cls] = CARD_STATUS[c.status];
        return h('tr', {}, [
          h('td', {}, [
            h('span', { class: 'mono', text: c.id }),
            h('div', { class: c.physicalCredential ? 'sub good-text' : 'sub', text: `${c.physicalCredential ? `NFC enrolled · ${c.physicalCredential.readerId}` : 'Physical NFC not enrolled'}${c.pinSet ? ' · PIN set' : ''}` }),
          ]),
          h('td', { text: c.holder ?? '— unassigned —' }),
          h('td', { text: c.kind ? KIND[c.kind] : '—' }),
          h('td', { text: c.clearance ? `Gate · Levels 1–${c.clearance}` : '—' }),
          h('td', {}, [h('span', { class: `pill ${cls}`, text: label })]),
          h('td', { text: c.lastUsed ?? '—' }),
          h('td', { class: 'actions-col' }, [
            h('div', { class: 'row' }, [
              c.status === 'active'
                ? button('Revoke', { cls: 'btn-sm btn-danger', perm: 'cards.manage', onClick: () => setCard(c, 'revoked') })
                : button('Reactivate', { cls: 'btn-sm btn-ok', perm: 'cards.manage', onClick: () => setCard(c, 'active') }),
              c.status === 'active' ? button('Suspend', { cls: 'btn-sm', perm: 'cards.manage', onClick: () => setCard(c, 'suspended') }) : null,
              button(c.pinSet ? 'Change PIN' : 'Set PIN', { cls: 'btn-sm', perm: 'cards.manage', onClick: () => setPin(c) }),
              c.pinSet ? button('Remove PIN', { cls: 'btn-sm btn-ghost', perm: 'cards.manage', onClick: () => clearPin(c) }) : null,
              c.physicalCredential ? button('Unlink NFC', { cls: 'btn-sm btn-danger', perm: 'cards.manage', onClick: () => unlinkPhysicalCredential(c) }) : null,
            ]),
          ]),
        ]);
      }),
    );
  }

  on('people', () => !root.hidden && render());
  on('session', mountAdd);
  mountAdd();

  return {
    show() {
      mountAdd();
      render();
      loadPeople().catch((err) => notify(err.message, 'bad'));
    },
  };
}
