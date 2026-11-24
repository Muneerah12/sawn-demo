// Gate B / Level 5 keeps its physical NFC evidence separate from Gate A. A recognised
// Level-5 card is one factor only: it never becomes an entry decision before the other factors
// and door feedback are integrated.
import { post } from './api.js';
import { emit, on, session } from './hub.js';
import { loadGate, loadGates, loadPeople, state } from './store.js';
import { dateTime, formDialog, h, icon, notify } from './ui.js';

const GATE_B_READER_ID = 'gate-level-5';
const STATE = {
  'verified-recent': ['Recently verified', 'ok', 'check'],
  'link-open': ['Link open · tap needed', 'warn', 'alert'],
  connecting: ['Connecting', 'warn', 'clock'],
  'not-connected': ['Not connected', 'bad', 'block'],
  reporting: ['Reporting', 'ok', 'check'],
  'not-reporting': ['Not reporting', 'bad', 'block'],
  'not-integrated': ['Not integrated', 'warn', 'alert'],
  attention: ['Needs attention', 'warn', 'alert'],
  partial: ['Partially integrated', 'warn', 'alert'],
};

const gateById = (id) => state.gates?.gates?.find((g) => g.id === id) ?? null;
const labelFor = (stateName) => STATE[stateName] ?? [String(stateName ?? 'Unknown'), 'warn', 'unknown'];

function presentationFor(event) {
  if (event.credentialState === 'identified' && event.level5Eligible === true) return ['L5 card factor recognised', 'warn', 'check'];
  if (event.credentialState === 'identified' && event.level5Eligible === false) return ['Not cleared for Level 5', 'bad', 'block'];
  if (event.credentialState === 'identified') return ['Identity recognised · verify clearance', 'warn', 'alert'];
  if (event.credentialState === 'not-eligible') return ['Card not eligible', 'bad', 'block'];
  if (event.credentialState === 'enrolled-after-tap') return ['Linked · tap again', 'warn', 'clock'];
  return ['Unlinked card', 'warn', 'unknown'];
}

function eventText(event) {
  if (event.credentialState === 'identified' && event.level5Eligible === true) return `${event.personName} · ${event.cardId} · other factors required`;
  if (event.credentialState === 'identified' && event.level5Eligible === false) return `${event.personName} · ${event.cardId} · not cleared for Level 5`;
  if (event.credentialState === 'identified') return `${event.personName} · ${event.cardId}`;
  if (event.credentialState === 'not-eligible') return `${event.personName ?? 'Unknown holder'} · ${event.cardId ?? 'card'} is not eligible`;
  if (event.credentialState === 'enrolled-after-tap') return `${event.personName ?? 'Card holder'} · ${event.cardId} linked after this presentation`;
  return 'Unlinked physical card';
}

export function createGateBPage({ root }) {
  const $ = (id) => root.querySelector(`#${id}`);

  async function linkEvent(event) {
    const cards = state.cards.filter((card) => card.status === 'active' && card.personId && card.holder && !card.physicalCredential);
    if (!cards.length) {
      notify('No active issued SAWN card is available for physical-card enrollment.', 'warn');
      return;
    }
    const response = await formDialog({
      title: 'Link physical card to a SAWN card',
      iconName: 'card',
      intro: 'This uses the just-read card internally. Its UID is not shown or stored. Choose the issued SAWN card and its existing holder.',
      fields: [{ name: 'cardId', label: 'Issued SAWN card', type: 'select', options: cards.map((card) => [card.id, `${card.id} · ${card.holder} · Level ${card.clearance}`]), required: true }],
      submitLabel: 'Link physical card',
    });
    if (!response) return;
    try {
      await post(`gate/reader-events/${event.id}/link`, { cardId: response.cardId });
      await Promise.all([loadGate(), loadGates(), loadPeople()]);
      notify(`Physical credential linked to ${response.cardId}. Tap that card once more to verify the Level 5 card factor.`, 'ok');
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  function renderEvents() {
    const events = (state.gate.readerEvents ?? []).filter((event) => event.readerId === GATE_B_READER_ID);
    $('gb-reader-events').replaceChildren(
      ...(events.length
        ? events.slice(0, 30).map((event) => {
            const [label, tone, iconName] = presentationFor(event);
            return h('div', { class: `reader-event tone-${tone}` }, [
              h('div', { class: 'reader-event-main' }, [
                icon(iconName, { size: 16 }),
                h('div', {}, [
                  h('b', { text: eventText(event) }),
                  h('small', { class: 'sub', text: `${dateTime(event.receivedAt)} · NFC presentation at Gate B · no entry confirmed` }),
                ]),
              ]),
              h('div', { class: 'row wrap' }, [
                h('span', { class: 'pill', attrs: { 'data-tone': tone }, text: label }),
                event.enrollmentEligible && session.can('cards.manage')
                  ? h('button', { class: 'btn btn-sm', attrs: { type: 'button' }, on: { click: () => linkEvent(event) } }, [icon('card', { size: 14 }), ' Link to SAWN card'])
                  : null,
                event.cardId && session.can('audit.view')
                  ? h('button', { class: 'btn btn-sm btn-ghost', attrs: { type: 'button' }, on: { click: () => emit('navigate', { tab: 'audit' }) } }, [icon('history', { size: 14 }), ' Audit'])
                  : null,
              ].filter(Boolean)),
            ]);
          })
        : [h('div', { class: 'empty' }, [icon('card', { size: 32 }), h('p', { text: 'No physical NFC cards have been presented to Gate B yet.' })])]),
    );
  }

  function render() {
    if (root.hidden) return;
    const gate = gateById('gate-b');
    const [label, tone] = labelFor(gate?.state ?? 'not-integrated');
    const stateEl = $('gb-state');
    stateEl.textContent = label.toUpperCase();
    stateEl.dataset.tone = tone;
    $('gb-detail').textContent = gate?.detail ?? 'Gate B status is unavailable; do not treat this as confirmation of coverage.';
    const nfc = gate?.components?.find((component) => component.id === 'nfc');
    $('gb-reader-detail').textContent = nfc?.detail ?? 'Gate B reader status is unavailable. Do not assume the Level 5 door is covered.';

    const components = gate?.components ?? [];
    $('gb-components').replaceChildren(
      ...(components.length
        ? components.map((component) => {
            const [componentLabel, componentTone, iconName] = labelFor(component.state);
            return h('article', { class: `gate-component tone-${componentTone}` }, [
              h('div', { class: 'gate-component-head' }, [
                h('div', {}, [h('b', { text: component.label }), component.required ? h('span', { class: 'badge badge-offline', text: 'REQUIRED' }) : h('span', { class: 'badge badge-demo', text: 'DEFERRED' })]),
                h('span', { class: 'pill', attrs: { 'data-tone': componentTone }, text: componentLabel }),
              ]),
              h('p', { class: 'sub', text: component.source }),
              h('p', { class: 'gate-component-detail' }, [icon(iconName, { size: 14 }), ` ${component.detail}`]),
            ]);
          })
        : [h('p', { class: 'empty', text: 'No Gate B integration data is available.' })]),
    );
    renderEvents();
  }

  on('gates', render);
  on('reader-event', render);
  on('people', render);

  return {
    async show() {
      try {
        await Promise.all([loadGate(), loadGates()]);
      } catch (err) {
        notify(err.message, 'bad');
      }
      render();
    },
  };
}
