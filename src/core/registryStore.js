import { RegistryStatus } from './classifier.js';
import { normalizeIdentifier, normalizeProtocol } from './identifiers.js';
import { sanitizeRegistry } from './registryValidation.js';

/**
 * Operator edits to the live authorization registry. Every change is validated, persisted
 * through `save` (which returns the stored registry), then announced via `onChange`.
 * Writes are serialized so rapid clicks cannot interleave, and each change is applied to the
 * latest saved registry (via `load`) so a stale tab can never overwrite newer edits.
 */
export function createRegistryStore({ initial, save, load = null, onChange = () => {}, now = () => new Date() }) {
  let registry = sanitizeRegistry(initial);
  let queue = Promise.resolve();

  const sameDevice = (a, id, protocol) => a.id === id && a.protocol === protocol;

  function commit(mutate) {
    const run = async () => {
      const base = load ? sanitizeRegistry(await load()) : registry;
      const next = sanitizeRegistry(mutate(structuredClone(base)));
      registry = sanitizeRegistry((await save(next)) ?? next);
      onChange(registry);
      return registry;
    };
    queue = queue.then(run, run);
    return queue;
  }

  function upsert({ identifier, protocol, ...fields }) {
    const id = normalizeIdentifier(identifier);
    const proto = normalizeProtocol(protocol);
    if (!id || !proto) return Promise.reject(new TypeError('Device identifier and protocol are required'));
    return commit((r) => {
      r.devices = r.devices.filter((d) => !sameDevice(d, id, proto));
      r.devices.push({ id, protocol: proto, verifiedBy: 'operator', verifiedAt: now().toISOString(), ...fields });
      return r;
    });
  }

  return {
    get: () => registry,

    /** Adopts a registry saved elsewhere (another tab). */
    replace(next) {
      registry = sanitizeRegistry(next);
      onChange(registry);
    },

    find(identifier, protocol) {
      const id = normalizeIdentifier(identifier);
      const proto = normalizeProtocol(protocol);
      return registry.devices.find((d) => sameDevice(d, id, proto)) ?? null;
    },

    authorize: ({ identifier, protocol, label, ownerId }) =>
      upsert({ identifier, protocol, status: RegistryStatus.AUTHORIZED, label: label || undefined, ownerId: ownerId || undefined }),

    deny({ identifier, protocol, reason, ownerId }) {
      if (!reason?.trim()) return Promise.reject(new TypeError('A reason is required to deny a device'));
      return upsert({ identifier, protocol, status: RegistryStatus.DENIED, reason: reason.trim(), ownerId: ownerId || undefined });
    },

    remove({ identifier, protocol }) {
      const id = normalizeIdentifier(identifier);
      const proto = normalizeProtocol(protocol);
      return commit((r) => ({ ...r, devices: r.devices.filter((d) => !sameDevice(d, id, proto)) }));
    },

    setSensorTrusted(sensorId, trusted) {
      return commit((r) => {
        const set = new Set(r.trustedSensors);
        if (trusted) set.add(sensorId);
        else set.delete(sensorId);
        return { ...r, trustedSensors: [...set] };
      });
    },
  };
}
