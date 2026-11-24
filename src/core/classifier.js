import { AuthStatus } from './constants.js';
import { hasStableIdentifier, normalizeIdentifier, normalizeProtocol } from './identifiers.js';

export const RegistryStatus = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  DENIED: 'DENIED',
});

export const EMPTY_REGISTRY = Object.freeze({ trustedSensors: [], devices: [] });

const keyOf = (protocol, identifier) => `${protocol}|${identifier}`;

/**
 * Registry shape:
 * {
 *   trustedSensors: ["sensor-id", ...],
 *   devices: [{ id, protocol, status: "AUTHORIZED" | "DENIED", label?, reason?, verifiedBy?, verifiedAt? }]
 * }
 */
export function createClassifier(registry = EMPTY_REGISTRY) {
  const trustedSensors = new Set((registry.trustedSensors ?? []).map(String));
  const devices = new Map();
  for (const entry of registry.devices ?? []) {
    const protocol = normalizeProtocol(entry.protocol);
    const identifier = normalizeIdentifier(entry.id);
    if (!protocol || !identifier) continue;
    devices.set(keyOf(protocol, identifier), { ...entry, protocol, id: identifier });
  }

  return function classify(obs) {
    const entry = devices.get(keyOf(obs.protocol, obs.identifier));
    const stableIdentifier = hasStableIdentifier(obs);
    const result = (status, reason, evidence) => ({ status, reason, evidence, stableIdentifier });

    if (!entry) {
      return result(AuthStatus.UNKNOWN, 'Not in authorization registry — needs review', []);
    }

    if (entry.status === RegistryStatus.AUTHORIZED) {
      return result(AuthStatus.AUTHORIZED, `Authorized: ${entry.label ?? 'registered device'}`, [
        `registry:${entry.verifiedBy ?? 'listed'}`,
      ]);
    }

    if (entry.status !== RegistryStatus.DENIED) {
      return result(AuthStatus.UNKNOWN, 'Registry entry has no recognised status — not verified', []);
    }

    // A denylist hit only becomes VERIFIED_UNAUTHORIZED when every piece of evidence holds.
    const gaps = [];
    if (!entry.verifiedBy) gaps.push('denied entry has no verification source');
    if (!trustedSensors.has(obs.sensorId)) gaps.push(`sensor "${obs.sensorId}" is not trusted`);
    if (!stableIdentifier) gaps.push('address is randomized / not stable');

    if (gaps.length) {
      return result(AuthStatus.UNKNOWN, `Matches denied entry, but not verified: ${gaps.join('; ')}`, []);
    }

    return result(AuthStatus.VERIFIED_UNAUTHORIZED, entry.reason ?? 'Device is denied in authorization registry', [
      `registry:${entry.verifiedBy}${entry.verifiedAt ? ` @ ${entry.verifiedAt}` : ''}`,
      `trusted-sensor:${obs.sensorId}`,
      'stable-identifier',
    ]);
  };
}
