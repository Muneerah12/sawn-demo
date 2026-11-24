import { normalizeIdentifier, normalizeProtocol } from './identifiers.js';

// Shared by the browser app and the local server so a saved registry is always well-formed.
const STATUSES = new Set(['AUTHORIZED', 'DENIED']);
const MAX_DEVICES = 5000;
const MAX_SENSORS = 100;

const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

export function sanitizeRegistry(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Registry must be an object');
  if (!Array.isArray(input.devices) || !Array.isArray(input.trustedSensors)) {
    throw new TypeError('Registry needs devices[] and trustedSensors[]');
  }
  if (input.devices.length > MAX_DEVICES) throw new RangeError(`At most ${MAX_DEVICES} devices`);
  if (input.trustedSensors.length > MAX_SENSORS) throw new RangeError(`At most ${MAX_SENSORS} trusted sensors`);

  const trustedSensors = [...new Set(input.trustedSensors.map((s) => text(s, 64)).filter(Boolean))];

  const seen = new Set();
  const devices = [];
  for (const raw of input.devices) {
    const id = normalizeIdentifier(text(raw?.id, 64));
    const protocol = normalizeProtocol(raw?.protocol);
    const status = String(raw?.status ?? '').toUpperCase();
    if (!id || !protocol || !STATUSES.has(status)) throw new TypeError(`Invalid device entry: ${JSON.stringify(raw)}`);
    const key = `${protocol}|${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = { id, protocol, status };
    for (const field of ['label', 'reason', 'verifiedBy', 'verifiedAt', 'ownerName']) {
      const value = text(raw[field], 200);
      if (value) entry[field] = value;
    }
    // Person the device belongs to (People & cards); resolved and checked by the server.
    const ownerId = Number(raw.ownerId);
    if (Number.isInteger(ownerId) && ownerId > 0) entry.ownerId = ownerId;
    devices.push(entry);
  }

  const result = { trustedSensors, devices };
  if (typeof input._comment === 'string') result._comment = input._comment.slice(0, 1000);
  return result;
}
