import { Protocol } from './constants.js';

const MAC_RE = /^[0-9A-F]{2}([:-]?)(?:[0-9A-F]{2}\1){4}[0-9A-F]{2}$/i;
const UNSTABLE_BLE_ADDRESS_TYPES = new Set(['random', 'rpa', 'nrpa', 'resolvable', 'non-resolvable', 'private']);

export function normalizeProtocol(value) {
  const s = String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['wifi', 'wlan', '80211'].includes(s)) return Protocol.WIFI;
  if (['ble', 'bluetooth', 'bluetoothle', 'btle'].includes(s)) return Protocol.BLE;
  return null;
}

export function isMac(value) {
  return MAC_RE.test(String(value ?? '').trim());
}

/** Upper-cases and converts MAC-like values to AA:BB:CC:DD:EE:FF. */
export function normalizeIdentifier(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toUpperCase();
  if (!s) return null;
  if (isMac(s)) {
    const hex = s.replace(/[:-]/g, '');
    return hex.match(/.{2}/g).join(':');
  }
  return s;
}

/** Locally administered bit set => randomized / not a stable hardware address. */
export function isLocallyAdministeredMac(mac) {
  if (!isMac(mac)) return false;
  const firstOctet = parseInt(normalizeIdentifier(mac).slice(0, 2), 16);
  return (firstOctet & 0x02) === 0x02;
}

/**
 * Whether the identifier is stable enough to attribute to a specific device.
 * Randomized identifiers can collide or rotate, so they can never be "verified".
 */
export function hasStableIdentifier(obs) {
  if (obs.randomized === true) return false;
  if (obs.protocol === Protocol.WIFI) return !isLocallyAdministeredMac(obs.identifier);
  if (obs.protocol === Protocol.BLE) {
    const type = String(obs.addressType ?? 'public').toLowerCase();
    return !UNSTABLE_BLE_ADDRESS_TYPES.has(type);
  }
  return false;
}

/** Masks identifiers for display: AA:••:••:••:••:FF, or ab••••yz for other IDs. */
export function maskIdentifier(value) {
  const id = normalizeIdentifier(value);
  if (!id) return '—';
  if (isMac(id)) {
    const parts = id.split(':');
    return [parts[0], '••', '••', '••', '••', parts[5]].join(':');
  }
  if (id.length <= 4) return '••••';
  return `${id.slice(0, 2)}${'•'.repeat(Math.min(id.length - 4, 6))}${id.slice(-2)}`;
}
