// Gate A live view: physical NFC presentations only. A card presentation identifies a holder
// after supervised enrollment; it is never presented as proof of entry without door feedback.
import { post } from './api.js';
import { emit, on, session } from './hub.js';
import { loadGate, loadGates, loadPeople, state } from './store.js';
import { dateTime, formDialog, h, icon, notify } from './ui.js';

const READER_STATE = {
  'verified-recent': ['NFC VERIFIED', 'ok', 'check'],
  'link-open': ['LINK OPEN · TAP NEEDED', 'warn', 'alert'],
  connecting: ['CONNECTING', 'warn', 'clock'],
  'not-connected': ['NOT CONNECTED', 'bad', 'block'],
};
const GATE_A_READER_ID = 'gate-level-1';
const COMPONENT_STATE = {
  'verified-recent': ['Recently verified', 'ok', 'check'],
  'link-open': ['Link open · tap needed', 'warn', 'alert'],
  connecting: ['Connecting', 'warn', 'clock'],
  'not-connected': ['Not connected', 'bad', 'block'],
  reporting: ['Reporting', 'ok', 'check'],
  'not-reporting': ['Not reporting', 'bad', 'block'],
  simulated: ['Training only', 'warn', 'demo'],
  'not-integrated': ['Not integrated', 'warn', 'alert'],
};
const PRESENTATION = {
  identified: ['Recognised card', 'ok', 'check'],
  'not-eligible': ['Card not eligible', 'bad', 'block'],
  'enrolled-after-tap': ['Linked · tap again', 'warn', 'clock'],
  unlinked: ['Unlinked card', 'warn', 'unknown'],
  'suspect-clone': ['CLONED CARD?', 'bad', 'alert'],
};

const statusFor = (table, value, fallback) => table[value] ?? fallback;

export function createGateLivePage({ root }) {
  const $ = (id) => root.querySelector(`#${id}`);

  const gateA = () => state.gates?.gates?.find((gate) => gate.id === 'gate-a') ?? null;

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
      notify(`Physical credential linked to ${response.cardId}. Tap that card once more to verify its holder.`, 'ok');
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  function renderState() {
    const gate = gateA();
    const nfc = gate?.components?.find((component) => component.id === 'nfc');
    const [label, tone] = statusFor(READER_STATE, nfc?.state, ['STATUS UNAVAILABLE', 'warn', 'unknown']);
    $('ga-reader-state').textContent = label;
    $('ga-reader-state').dataset.tone = tone;
    $('ga-reader-detail').textContent = nfc?.detail ?? 'Gate A reader status is unavailable. Do not assume the gate is covered.';
  }

  function renderComponents() {
    const components = gateA()?.components ?? [];
    $('ga-components').replaceChildren(
      ...(components.length
        ? components.map((component) => {
            const [label, tone, iconName] = statusFor(COMPONENT_STATE, component.state, ['Status unavailable', 'warn', 'unknown']);
            return h('article', { class: `gate-component tone-${tone}` }, [
              h('div', { class: 'gate-component-head' }, [
                h('div', {}, [h('b', { text: component.label }), h('span', { class: component.required ? 'badge badge-offline' : 'badge badge-demo', text: component.required ? 'REQUIRED' : 'DEFERRED' })]),
                h('span', { class: 'pill', attrs: { 'data-tone': tone }, text: label }),
              ]),
              h('p', { class: 'sub', text: component.source }),
              h('p', { class: 'gate-component-detail' }, [icon(iconName, { size: 14 }), ` ${component.detail}`]),
            ]);
          })
        : [h('p', { class: 'empty', text: 'Loading Gate A integration status…' })]),
    );
  }

  function eventText(event) {
    if (event.credentialState === 'suspect-clone') return `${event.personName ?? 'Card holder'} · ${event.cardId ?? 'card'} — possible clone`;
    if (event.credentialState === 'identified') return `${event.personName} · ${event.cardId}`;
    if (event.credentialState === 'not-eligible') return `${event.personName ?? 'Unknown holder'} · ${event.cardId ?? 'card'} is not eligible`;
    if (event.credentialState === 'enrolled-after-tap') return `${event.personName ?? 'Card holder'} · ${event.cardId} linked after this presentation`;
    return 'Unlinked physical card';
  }

  function renderEvents() {
    const events = (state.gate.readerEvents ?? []).filter((event) => event.readerId === GATE_A_READER_ID);
    $('ga-reader-events').replaceChildren(
      ...(events.length
        ? events.slice(0, 30).map((event) => {
            const [label, tone, iconName] = statusFor(PRESENTATION, event.credentialState, ['Status unavailable', 'warn', 'unknown']);
            return h('div', { class: `reader-event tone-${tone}` }, [
              h('div', { class: 'reader-event-main' }, [
                icon(iconName, { size: 16 }),
                h('div', {}, [
                  h('b', { text: eventText(event) }),
                  h('small', { class: 'sub', text: `${dateTime(event.receivedAt)} · NFC presentation at Gate A${event.simulated ? ' · SIMULATED drill' : ''}` }),
                  event.cloneReason ? h('small', { class: 'reader-event-clone', text: event.cloneReason }) : null,
                ].filter(Boolean)),
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
        : [h('div', { class: 'empty' }, [icon('card', { size: 32 }), h('p', { text: 'No physical NFC cards have been presented to Gate A yet.' })])]),
    );
  }

  function render() {
    if (root.hidden) return;
    renderState();
    renderComponents();
    renderEvents();
  }

  on('gates', render);
  on('reader-event', render);
  on('people', render);

  return {
    async show() {
      try {
        await Promise.all([loadGate(), loadGates(), loadPeople()]);
      } catch (err) {
        notify(err.message, 'bad');
      }
      render();
    },
  };
}
