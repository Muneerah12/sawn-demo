import { AuthStatus, Severity } from './constants.js';

const SEVERITY_RANK = { [Severity.HIGH]: 0, [Severity.INFO]: 1, [Severity.NONE]: 2 };
const SEVERITY_BY_STATUS = {
  [AuthStatus.VERIFIED_UNAUTHORIZED]: Severity.HIGH,
  [AuthStatus.UNKNOWN]: Severity.INFO,
  [AuthStatus.AUTHORIZED]: Severity.NONE,
};

// RSSI smoothing: median of the readings in the last SAMPLE_WINDOW_MS (one noisy reading — a
// body turning, a reflection — moves the median far less than it moves the latest value).
const SAMPLE_WINDOW_MS = 20_000;
const MAX_SAMPLES = 9;
export const CONFIRM_WINDOW_MS = 12_000; // readings counted towards "confirmed at the gate"

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Best current signal estimate for a device: smoothed when available. */
export const signalOf = (d) => (Number.isFinite(d?.rssiSmoothed) ? d.rssiSmoothed : (d?.rssi ?? null));

const inRange = (d, minRssi) => {
  if (minRssi === undefined) return true;
  const rssi = signalOf(d);
  return Number.isFinite(rssi) && rssi >= minRssi;
};

/** Rough distance band from RSSI (ESP32 PCB antenna, indoors). Walls and bodies shift this a lot. */
export function proximity(rssi) {
  if (!Number.isFinite(rssi)) return null;
  if (rssi >= -55) return 'very close (≈1–3 m)';
  if (rssi >= -67) return 'same room (≈3–8 m)';
  if (rssi >= -80) return 'nearby (≈8–20 m)';
  return 'far (20 m+ / other rooms or neighbours)';
}

/** Current picture of the airspace: every device seen recently, whatever its status. */
export function createDeviceTracker({ ttlMs = 5 * 60_000, limit = 3000, now = Date.now } = {}) {
  const devices = new Map(); // event.key -> device

  function prune() {
    const t = now();
    for (const [k, d] of devices) if (t - d.lastSeen > ttlMs) devices.delete(k);
    if (devices.size > limit) {
      const oldest = [...devices.values()].sort((a, b) => a.lastSeen - b.lastSeen).slice(0, devices.size - limit);
      for (const d of oldest) devices.delete(d.key);
    }
  }

  return {
    update(event) {
      const existing = devices.get(event.key);
      const d = existing ?? { key: event.key, firstSeen: event.observedAt, observations: 0 };
      Object.assign(d, {
        origin: event.origin,
        identifier: event.identifier,
        deviceIdMasked: event.deviceIdMasked,
        protocol: event.protocol,
        sensorId: event.sensorId,
        rssi: event.rssi,
        status: event.status,
        severity: event.severity,
        reason: event.reason,
        stableIdentifier: event.stableIdentifier,
        addressType: event.addressType,
        randomized: event.randomized,
        // Descriptive fields arrive intermittently; keep the last known value.
        name: event.name ?? d.name ?? null,
        source: event.source ?? d.source ?? null,
        bssid: event.bssid ?? d.bssid ?? null,
        probe: event.probe ?? d.probe ?? null,
        vendor: event.vendor ?? d.vendor ?? null,
        mfrName: event.mfrName ?? d.mfrName ?? null,
        mfr: event.mfr ?? d.mfr ?? null,
        md: event.md ?? d.md ?? null,
        appearance: event.appearance ?? d.appearance ?? null,
        // Remote ID arrives one message type at a time (Bluetooth): merge into one drone record.
        remoteId: event.remoteId ? { ...(d.remoteId ?? {}), ...event.remoteId, messages: undefined, seenAt: event.observedAt } : (d.remoteId ?? null),
        lastSeen: Math.max(d.lastSeen ?? 0, event.observedAt),
      });
      d.observations++;

      const reading = Number.isFinite(event.rssiAvg) ? event.rssiAvg : event.rssi;
      if (Number.isFinite(reading)) {
        const t = event.observedAt;
        d.samples = [...(d.samples ?? []).filter((s) => t - s.t <= SAMPLE_WINDOW_MS), { t, v: reading }].slice(-MAX_SAMPLES);
      }
      const t = d.lastSeen;
      d.rssiSmoothed = median((d.samples ?? []).map((s) => s.v));
      d.recentReadings = (d.samples ?? []).filter((s) => t - s.t <= CONFIRM_WINDOW_MS).length;
      devices.set(event.key, d);
      if (!existing && devices.size > limit) prune();
      return d;
    },

    get: (key) => devices.get(key) ?? null,

    /** minRssi limits the list to devices heard at least that strongly (i.e. physically closer). */
    list({ origin, status, hideUnattributable = false, minRssi } = {}) {
      prune();
      return [...devices.values()]
        .filter(
          (d) =>
            (!origin || d.origin === origin) &&
            (!status || d.status === status) &&
            (!hideUnattributable || d.stableIdentifier) &&
            inRange(d, minRssi),
        )
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.lastSeen - a.lastSeen);
    },

    /** Applies a new registry to tracked devices immediately, without waiting for the next sighting. */
    reclassify(classify, origin) {
      for (const d of devices.values()) {
        if (origin && d.origin !== origin) continue;
        const c = classify({
          identifier: d.identifier,
          protocol: d.protocol,
          sensorId: d.sensorId,
          addressType: d.addressType,
          randomized: d.randomized,
        });
        d.status = c.status;
        d.reason = c.reason;
        d.severity = SEVERITY_BY_STATUS[c.status];
        d.stableIdentifier = c.stableIdentifier;
      }
    },

    counts(origin, { minRssi } = {}) {
      prune();
      const out = { total: 0, [AuthStatus.AUTHORIZED]: 0, [AuthStatus.UNKNOWN]: 0, [AuthStatus.VERIFIED_UNAUTHORIZED]: 0 };
      for (const d of devices.values()) {
        if ((origin && d.origin !== origin) || !inRange(d, minRssi)) continue;
        out.total++;
        out[d.status]++;
      }
      return out;
    },

    clear() {
      devices.clear();
    },
  };
}
