import { DEFAULTS } from './constants.js';

export function createAlertHistory({ limit = DEFAULTS.historyLimit } = {}) {
  const entries = [];
  const latestByKey = new Map();
  const listeners = new Set();
  let seq = 0;

  const emit = () => listeners.forEach((fn) => fn());

  return {
    add(event, { sound }) {
      const entry = {
        id: `alert-${++seq}`,
        key: event.key,
        alertKey: event.alertKey,
        origin: event.origin,
        status: event.status,
        severity: event.severity,
        deviceIdMasked: event.deviceIdMasked,
        protocol: event.protocol,
        sensorId: event.sensorId,
        reason: event.reason,
        evidence: event.evidence,
        ruleName: event.ruleName ?? null,
        offline: event.offline ?? null,
        timeApprox: event.timeApprox === true,
        firstSeen: event.firstSeenAt ?? event.observedAt,
        lastSeen: event.observedAt,
        sound,
        repeats: 0,
      };
      entries.unshift(entry);
      if (entries.length > limit) {
        const removed = entries.pop();
        if (latestByKey.get(removed.alertKey) === removed) latestByKey.delete(removed.alertKey);
      }
      latestByKey.set(entry.alertKey, entry);
      emit();
      return entry;
    },

    /** Folds a cooldown-suppressed observation into the alert it repeats. */
    recordRepeat(event) {
      const entry = latestByKey.get(event.alertKey);
      if (!entry) return null;
      entry.repeats++;
      entry.lastSeen = Math.max(entry.lastSeen, event.observedAt);
      entry.sensorId = event.sensorId;
      emit();
      return entry;
    },

    list({ origin } = {}) {
      return origin ? entries.filter((e) => e.origin === origin) : [...entries];
    },

    clear() {
      entries.length = 0;
      latestByKey.clear();
      emit();
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
