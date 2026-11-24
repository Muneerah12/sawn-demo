import { emit } from './hub.js';

/** JSON API call; throws Error(message from the server). A 401 means the session ended. */
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`api/${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('login') && !path.startsWith('setup')) emit('session-expired');
  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const get = (path) => api(path);
export const post = (path, body = {}) => api(path, { method: 'POST', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });
