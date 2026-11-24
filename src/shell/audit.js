// Audit log: every sign-in, decision and change, under the user who made it (from the database).
import { get } from './api.js';
import { on, session } from './hub.js';
import { dateTime, h, notify } from './ui.js';

export function createAuditPage({ root }) {
  const body = root.querySelector('#audit-body');
  const actorSel = root.querySelector('#audit-actor');
  const search = root.querySelector('#audit-search');
  let entries = [];
  let oldest = null;

  async function load({ more = false } = {}) {
    if (!session.can('audit.view')) return;
    const qs = new URLSearchParams({ limit: '200' });
    if (actorSel.value) qs.set('actor', actorSel.value);
    if (more && oldest) qs.set('before', String(oldest));
    try {
      const r = await get(`audit?${qs}`);
      entries = more ? [...entries, ...r.entries] : r.entries;
      oldest = entries.at(-1)?.id ?? null;
      const current = actorSel.value;
      actorSel.replaceChildren(h('option', { attrs: { value: '' }, text: 'All users' }), ...r.actors.map((a) => h('option', { attrs: { value: a }, text: a })));
      actorSel.value = current;
      root.querySelector('#audit-more').hidden = r.entries.length < 200;
      render();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const list = q ? entries.filter((e) => [e.actor, e.action, e.target, e.detail].some((v) => v && v.toLowerCase().includes(q))) : entries;
    body.replaceChildren(
      ...list.map((e) =>
        h('tr', { class: /denied|failed|revoked|unauthorized|removed|deleted/i.test(e.action) ? 'row-attn' : '' }, [
          h('td', { class: 'mono nowrap', text: dateTime(e.t) }),
          h('td', {}, [h('span', { class: `who ${e.actor === 'System' ? 'who-system' : ''}`, text: e.actor })]),
          h('td', { text: e.action }),
          h('td', { class: 'mono', text: e.target ?? '—' }),
          h('td', { class: 'wrap', text: e.detail ?? '' }),
        ]),
      ),
    );
    root.querySelector('#audit-empty').hidden = list.length > 0;
  }

  actorSel.addEventListener('change', () => load());
  search.addEventListener('input', render);
  root.querySelector('#audit-more').addEventListener('click', () => load({ more: true }));
  on('audit-entry', (entry) => {
    if (root.hidden || (actorSel.value && entry.actor !== actorSel.value)) return;
    entries.unshift(entry);
    render();
  });

  return { show: () => load() };
}
