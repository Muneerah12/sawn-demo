import { AuthStatus, Origin } from '../core/constants.js';

// All sensor-supplied text is written with textContent (never innerHTML): observations are untrusted.

export const STATUS_LABEL = {
  [AuthStatus.AUTHORIZED]: 'Authorized',
  [AuthStatus.UNKNOWN]: 'Unknown',
  [AuthStatus.VERIFIED_UNAUTHORIZED]: 'Verified unauthorized',
};

export const formatTime = (ms) => new Date(ms).toLocaleString(undefined, { hour12: false });

export function formatAge(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  for (const [k, v] of Object.entries(attrs ?? {})) node.setAttribute(k, v);
  for (const child of children) if (child) node.append(child);
  return node;
}

export const originBadge = (origin) =>
  el('span', {
    className: `badge ${origin === Origin.DEMO ? 'badge-demo' : 'badge-live'}`,
    text: origin === Origin.DEMO ? 'DEMO · SIMULATED' : 'LIVE',
  });

export const statusBadge = (status) =>
  el('span', { className: `badge status-${String(status).toLowerCase()}`, text: STATUS_LABEL[status] ?? status });
