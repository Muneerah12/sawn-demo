// Small UI toolkit for the console: element builder, notices, modal dialogs and IAM locks.
// All text is set with textContent; nothing user- or sensor-supplied goes through innerHTML.
import { icon } from '../ui/icons.js';
import { session } from './hub.js';

export function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  const { class: cls, text, attrs, on, style, data, ...rest } = props;
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  for (const [k, v] of Object.entries(attrs ?? {})) if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  for (const [k, v] of Object.entries(on ?? {})) node.addEventListener(k, v);
  for (const [k, v] of Object.entries(style ?? {})) node.style.setProperty(k, v);
  for (const [k, v] of Object.entries(data ?? {})) node.dataset[k] = v;
  Object.assign(node, rest);
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
  return node;
}

export { icon };

export const clock = (t) => (t ? new Date(t).toLocaleTimeString(undefined, { hour12: false }) : '—');
export const dateTime = (t) => (t ? new Date(t).toLocaleString(undefined, { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
export function ago(t, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Button with an optional icon; `perm` locks it (with the reason) when the role lacks it. */
export function button(label, { iconName = null, cls = '', onClick = null, perm = null, title = null, type = 'button', attrs = {} } = {}) {
  const b = h('button', { class: `btn ${cls}`.trim(), attrs: { type, title, ...attrs } }, [iconName ? icon(iconName, { size: 16 }) : null, label ? h('span', { text: label }) : null]);
  if (perm && !session.can(perm)) lock(b, perm);
  if (onClick) {
    b.addEventListener('click', (e) => {
      if (b.classList.contains('locked')) return notify(session.why(b.dataset.perm), 'bad');
      onClick(e);
    });
  }
  return b;
}

export function lock(node, perm) {
  node.classList.add('locked');
  node.dataset.perm = perm;
  node.setAttribute('aria-disabled', 'true');
  node.title = session.why(perm);
}

// ------------------------------------------------------------------ notices
let noticeTimer = null;
export function notify(message, tone = 'ok') {
  const n = document.getElementById('notice');
  if (!n) return;
  n.textContent = message;
  n.className = `notice notice-${tone}`;
  n.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (n.hidden = true), tone === 'bad' ? 6000 : 3500);
}

// ------------------------------------------------------------------ dialogs
/**
 * Modal form. fields: [{ name, label, type: text|password|number|select|textarea|checkbox,
 * options: [[value, label]], value, required, hint, min, max, maxlength, placeholder }].
 * Resolves with the values, or null when cancelled.
 */
export function formDialog({ title, intro = null, fields, submitLabel = 'Save', danger = false, iconName = null }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog', attrs: { 'aria-label': title } });
    const form = h('form', { attrs: { method: 'dialog' } });
    const inputs = {};
    const body = h('div', { class: 'dialog-body' });
    for (const f of fields) {
      const id = `dlg-${f.name}`;
      let input;
      if (f.type === 'select') {
        input = h('select', { attrs: { id, name: f.name, required: f.required } }, f.options.map(([v, l]) => h('option', { attrs: { value: v }, text: l })));
        if (f.value !== undefined && f.value !== null) input.value = String(f.value);
      } else if (f.type === 'textarea') {
        input = h('textarea', { attrs: { id, name: f.name, required: f.required, maxlength: f.maxlength ?? 500, placeholder: f.placeholder, rows: 3 } });
        input.value = f.value ?? '';
      } else if (f.type === 'checkbox') {
        input = h('input', { attrs: { id, name: f.name, type: 'checkbox' } });
        input.checked = Boolean(f.value);
      } else {
        input = h('input', {
          attrs: { id, name: f.name, type: f.type ?? 'text', required: f.required, min: f.min, max: f.max, maxlength: f.maxlength ?? 120, placeholder: f.placeholder, autocomplete: f.type === 'password' ? 'new-password' : 'off', pattern: f.pattern },
        });
        input.value = f.value ?? '';
      }
      inputs[f.name] = input;
      body.append(
        f.type === 'checkbox'
          ? h('label', { class: 'switch' }, [input, h('span', { text: f.label })])
          : h('label', { class: 'field', attrs: { for: id } }, [h('span', { text: f.label }), input, f.hint ? h('small', { class: 'hint', text: f.hint }) : null]),
      );
    }
    const msg = h('p', { class: 'dialog-msg', attrs: { role: 'alert' } });
    const cancel = h('button', { class: 'btn', text: 'Cancel', attrs: { type: 'button', value: 'cancel' } });
    const submit = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, text: submitLabel, attrs: { type: 'submit', value: 'ok' } });
    form.append(
      h('header', { class: 'dialog-head' }, [iconName ? icon(iconName, { size: 20 }) : null, h('h2', { text: title })]),
      intro ? h('p', { class: 'dialog-intro', text: intro }) : null,
      body,
      msg,
      h('footer', { class: 'dialog-foot' }, [cancel, submit]),
    );
    dialog.append(form);
    document.body.append(dialog);
    let result = null;
    cancel.addEventListener('click', () => dialog.close());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {};
      for (const [name, input] of Object.entries(inputs)) values[name] = input.type === 'checkbox' ? input.checked : input.value.trim();
      result = values;
      dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });
    dialog.showModal();
    (Object.values(inputs).find((i) => !i.value) ?? Object.values(inputs)[0] ?? submit).focus();
  });
}

export async function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  const r = await formDialog({ title, intro: message, fields: [], submitLabel: confirmLabel, danger });
  return r !== null;
}

// ------------------------------------------------------------------ IAM locks
/** Static controls carry data-perm="…": lock them when the role lacks it. */
export function applyPermissions(root = document) {
  for (const node of root.querySelectorAll('[data-perm]')) {
    const allowed = session.can(node.dataset.perm);
    if (node.matches('input, select, textarea')) {
      node.disabled = !allowed || node.dataset.lockedBySite === 'true';
      if (!allowed) node.title = session.why(node.dataset.perm);
    } else if (!allowed) lock(node, node.dataset.perm);
  }
}

// Buttons rendered by the Airspace and Facility views. Airspace may open a registry review,
// while actual registry decisions stay permission-gated in Facility Profile.
const ACTION_PERM = {
  'registry-authorize': 'devices.authorize',
  'registry-deny': 'devices.deny',
  'registry-unregister': 'devices.remove',
  'registry-calibrate': 'site.edit',
  'remove-entry': 'devices.remove',
  'toggle-trust': 'sensors.trust',
  'edit-rule': 'rules.edit',
  'delete-rule': 'rules.edit',
  'toggle-rule': 'rules.edit',
  'adsb-mode': 'site.edit',
  fr24: 'site.edit',
};
const TOAST_PERM = {};

function guard(node) {
  const perm = ACTION_PERM[node.dataset.action] ?? TOAST_PERM[node.dataset.toastAction];
  if (!perm || session.can(perm)) return;
  if (node.matches('input, select')) {
    node.disabled = true;
    node.title = session.why(perm);
  } else lock(node, perm);
}

/** Locks permission-gated buttons as the airspace views render them. */
export function startPermissionGuard(root = document.body) {
  const scan = (el) => {
    if (el.nodeType !== 1) return;
    if (el.matches('[data-action], [data-toast-action]')) guard(el);
    for (const n of el.querySelectorAll('[data-action], [data-toast-action]')) guard(n);
  };
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(scan))).observe(root, { childList: true, subtree: true });
  scan(root);
  // A locked button explains itself instead of acting.
  root.addEventListener(
    'click',
    (e) => {
      const locked = e.target.closest('.locked');
      if (!locked) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      notify(session.why(locked.dataset.perm), 'bad');
    },
    true,
  );
}
