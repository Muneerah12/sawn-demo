// Shared state of the console: the signed-in session and a small event hub that connects the
// airspace module (src/app.js) with the operations pages.
import { ROLE_LABEL, roleNeeded } from '../shared/iam.js';

const target = new EventTarget();

export function on(type, fn) {
  const handler = (e) => fn(e.detail);
  target.addEventListener(type, handler);
  return () => target.removeEventListener(type, handler);
}

export const emit = (type, detail) => target.dispatchEvent(new CustomEvent(type, { detail }));

export const session = {
  user: null,
  permissions: new Set(),
  set(data) {
    this.user = data?.user ?? null;
    this.permissions = new Set(data?.permissions ?? []);
    emit('session', this);
  },
  can(permission) {
    return this.permissions.has(permission);
  },
  get roleLabel() {
    return this.user ? ROLE_LABEL[this.user.role] : '';
  },
  /** "Needs Shift supervisor" style explanation for a locked control. */
  why(permission) {
    return `Your role (${this.roleLabel}) cannot do this — it needs ${roleNeeded(permission)}.`;
  },
};
