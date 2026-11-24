// Two-person rule: sensitive actions wait here for a second, different person to approve.
// Nobody can approve their own request; both names go on the record.
import { get, post } from './api.js';
import { on, session } from './hub.js';
import { loadApprovals, loadNotifications, pendingApprovals, state } from './store.js';
import { ago, button, dateTime, formDialog, h, icon, notify } from './ui.js';

const STATUS = { pending: ['Waiting', 'st-escalated'], approved: ['Approved', 'st-confirmed'], rejected: ['Rejected', 'st-dismissed'], expired: ['Expired', 'st-dismissed'], failed: ['Failed', 'st-new'] };

export function createApprovalsPage({ root }) {
  const $ = (id) => root.querySelector(`#${id}`);
  let actions = {};

  async function decide(a, approve) {
    const r = await formDialog({
      title: approve ? 'Approve as the second person' : 'Reject the request',
      intro: `${a.summary}${a.reason ? ` — “${a.reason}”` : ''} (requested by ${a.requestedBy}). ${approve ? 'Your name is recorded next to theirs.' : ''}`,
      fields: [{ name: 'note', label: approve ? 'Note (optional)' : 'Why (optional)', type: 'textarea' }],
      submitLabel: approve ? 'Approve' : 'Reject',
      danger: !approve,
    });
    if (!r) return;
    try {
      await post(`approvals/${a.id}/${approve ? 'approve' : 'reject'}`, { note: r.note });
      notify(approve ? 'Approved and applied.' : 'Rejected.');
      await loadApprovals();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  function card(a) {
    const mine = a.requestedById === session.user.id;
    const [label, cls] = STATUS[a.status] ?? [a.status, ''];
    const def = actions[a.action];
    return h('div', { class: `approval ${a.status}` }, [
      h('div', { class: 'approval-head' }, [icon('key', { size: 18 }), h('b', { text: def?.label ?? a.action }), h('span', { class: `pill ${cls}`, text: label })]),
      h('p', { class: 'approval-summary', text: a.summary }),
      a.reason ? h('p', { class: 'sub', text: `Reason: ${a.reason}` }) : null,
      h('p', { class: 'sub', text: `Requested by ${a.requestedBy} · ${ago(a.requestedAt)} ago${a.status === 'pending' ? ` · expires in ${Math.max(0, Math.round((a.expiresAt - Date.now()) / 60000))} min` : ''}${a.decidedBy ? ` · ${label.toLowerCase()} by ${a.decidedBy}${a.decisionNote ? ` (“${a.decisionNote}”)` : ''}` : ''}` }),
      a.status === 'pending'
        ? h('div', { class: 'row wrap' }, mine
            ? [h('span', { class: 'sub', text: 'Your request — someone else must approve it.' }), button('Withdraw', { cls: 'btn-sm', onClick: async () => { try { await post(`approvals/${a.id}/cancel`); await loadApprovals(); } catch (err) { notify(err.message, 'bad'); } } })]
            : [button('Approve', { iconName: 'check', cls: 'btn-ok', perm: def?.approve, onClick: () => decide(a, true) }), button('Reject', { iconName: 'block', cls: 'btn-danger', perm: def?.approve, onClick: () => decide(a, false) })])
        : null,
    ]);
  }

  function render() {
    const pending = pendingApprovals();
    $('ap-pending').replaceChildren(...(pending.length ? pending.map(card) : [h('p', { class: 'empty', text: 'Nothing is waiting for a second approval.' })]));
    const recent = state.approvals.filter((a) => !pending.includes(a)).slice(0, 30);
    $('ap-recent').replaceChildren(...(recent.length ? recent.map(card) : [h('p', { class: 'empty', text: 'No decisions yet.' })]));
  }

  async function renderRules() {
    const r = await get('settings/four-eyes');
    actions = r.actions;
    const admin = session.can('settings.fourEyes');
    $('ap-rules').replaceChildren(
      ...Object.entries(r.actions).map(([k, def]) => {
        const box = h('input', { attrs: { type: 'checkbox' } });
        box.checked = r.fourEyes[k];
        box.disabled = !admin;
        if (!admin) box.title = session.why('settings.fourEyes');
        box.addEventListener('change', async () => {
          try {
            await post('settings/four-eyes', { [k]: box.checked });
            notify(`${def.label}: ${box.checked ? 'second approver required' : 'single person'}.`, box.checked ? 'ok' : 'warn');
          } catch (err) {
            box.checked = !box.checked;
            notify(err.message, 'bad');
          }
        });
        return h('label', { class: 'switch rule-line' }, [box, h('span', { text: def.label })]);
      }),
    );
  }

  on('approvals', () => !root.hidden && render());
  on('four-eyes', () => !root.hidden && renderRules());
  setInterval(() => !root.hidden && render(), 30_000);

  return {
    async show() {
      try {
        await Promise.all([loadApprovals(), renderRules()]);
      } catch (err) {
        notify(err.message, 'bad');
      }
      render();
    },
  };
}

// ------------------------------------------------------------------ notifications bell
export function createNotifications({ onNavigate }) {
  const bell = document.getElementById('btn-bell');
  const panel = document.getElementById('bell-panel');
  const count = document.getElementById('bell-count');

  function renderCount() {
    count.textContent = String(state.unread);
    count.hidden = state.unread === 0;
  }
  function renderPanel() {
    panel.replaceChildren(
      h('div', { class: 'bell-head' }, [h('b', { text: 'Notifications' }), button('Mark all read', { cls: 'btn-ghost btn-sm', onClick: async () => { await post('notifications/read').catch(() => {}); await loadNotifications(); } })]),
      ...(state.notifications.length
        ? state.notifications.slice(0, 30).map((n) =>
            h('button', {
              class: `bell-item sev-${n.severity} ${n.read ? 'read' : ''}`,
              attrs: { type: 'button' },
              on: {
                click: async () => {
                  panel.hidden = true;
                  if (!n.read) post('notifications/read', { id: n.id }).then(loadNotifications).catch(() => {});
                  if (n.link) onNavigate(n.link.slice(1));
                },
              },
            }, [h('b', { text: n.title }), n.body ? h('span', { text: n.body }) : null, h('small', { text: dateTime(n.t) })]),
          )
        : [h('p', { class: 'empty', text: 'No notifications.' })]),
    );
  }
  bell.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    bell.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) renderPanel();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#bell-box')) panel.hidden = true;
  });
  on('notifications', (n) => {
    renderCount();
    if (!panel.hidden) renderPanel();
    if (n?.title) notify(n.title, n.severity === 'bad' ? 'bad' : n.severity === 'warn' ? 'warn' : 'ok');
  });
  loadNotifications().catch(() => {});
  renderCount();
}
