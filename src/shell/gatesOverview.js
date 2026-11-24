// The gate overview deliberately reports integration evidence, rather than turning a
// simulation or an empty incident list into a claim that a doorway is operational.
import { emit, on } from './hub.js';
import { loadGates, state } from './store.js';
import { dateTime, h, notify } from './ui.js';

const STATE = {
  'verified-recent': ['NFC verified recently', 'good'],
  'link-open': ['Reader link open · tap needed', 'warning'],
  connecting: ['Connecting', 'warning'],
  'not-connected': ['Not connected', 'critical'],
  reporting: ['Reporting', 'good'],
  'not-reporting': ['Not reporting', 'critical'],
  simulated: ['Simulated', 'warning'],
  'not-integrated': ['Not integrated', 'warning'],
  partial: ['Partially integrated', 'warning'],
  attention: ['Needs attention', 'warning'],
};

const statusFor = (value) => STATE[value] ?? ['Status unavailable', 'warning'];

export function createGatesOverviewPage({ root }) {
  const $ = (id) => root.querySelector(`#${id}`);

  function render() {
    if (root.hidden) return;
    const gates = state.gates?.gates ?? [];
    const card = (gate, tab) => {
      const nfc = gate.components?.find((component) => component.id === 'nfc');
      const [stateLabel, tone] = statusFor(gate.state);
      const [nfcLabel] = statusFor(nfc?.state);
      const evidence = gate.lastNfcTap?.receivedAt
        ? `Last NFC evidence: ${dateTime(gate.lastNfcTap.receivedAt)}`
        : gate.id === 'gate-a'
          ? 'No accepted NFC tap recorded in this server session.'
          : 'No Level 5 reader event path exists.';
      return h('button', {
        class: `gate-overview-card tone-${tone}`,
        attrs: { type: 'button' },
        on: { click: () => emit('navigate', { tab }) },
      }, [
        h('div', { class: 'gate-overview-head' }, [
          h('div', {}, [h('b', { text: gate.title }), h('small', { class: 'sub', text: gate.subtitle })]),
          h('span', { class: 'pill', attrs: { 'data-tone': tone === 'good' ? 'ok' : tone === 'critical' ? 'bad' : 'warn' }, text: stateLabel }),
        ]),
        h('p', { class: 'gate-overview-detail', text: gate.detail }),
        h('p', { class: 'gate-overview-evidence', text: evidence }),
        h('small', { class: 'sub', text: `${nfc?.label ?? 'NFC reader'}: ${nfcLabel}` }),
      ]);
    };
    const gateA = gates.find((gate) => gate.id === 'gate-a') ?? { id: 'gate-a', title: 'Gate A', subtitle: 'Main entrance', components: [] };
    const gateB = gates.find((gate) => gate.id === 'gate-b') ?? { id: 'gate-b', title: 'Gate B', subtitle: 'Level 5', components: [] };
    $('gates-overview-list').replaceChildren(
      ...(gates.length ? [card(gateA, 'checkpoint'), card(gateB, 'gateb')] : [h('p', { class: 'empty', text: 'Loading gate hardware status…' })]),
    );
  }

  on('gates', render);

  return {
    async show() {
      try {
        await loadGates();
      } catch (err) {
        notify(err.message, 'bad');
      }
      render();
    },
  };
}
