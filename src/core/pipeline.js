import { AuthStatus, Origin, SECURITY_EVENT, Severity } from './constants.js';
import { createClassifier } from './classifier.js';
import { maskIdentifier, normalizeIdentifier, normalizeProtocol } from './identifiers.js';
import { decodeRemoteId } from './remoteId.js';

const SEVERITY_BY_STATUS = {
  [AuthStatus.AUTHORIZED]: Severity.NONE,
  [AuthStatus.UNKNOWN]: Severity.INFO,
  [AuthStatus.VERIFIED_UNAUTHORIZED]: Severity.HIGH,
};

/** Accepts ms or s epoch numbers and ISO strings; anything else (e.g. ESP32 uptime) => receive time. */
export function parseTimestamp(value, now) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 1e12) return value;
    if (value >= 1e9) return value * 1000;
    return now();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return now();
}

export function normalizeObservation(raw, now = Date.now) {
  if (!raw || typeof raw !== 'object') return null;
  const identifier = normalizeIdentifier(raw.id ?? raw.mac ?? raw.address ?? raw.bssid);
  const protocol = normalizeProtocol(raw.protocol ?? raw.type);
  if (!identifier || !protocol) return null;
  const rssi = Number(raw.rssi);
  return {
    identifier,
    protocol,
    sensorId: String(raw.sensorId ?? raw.sensor ?? 'unknown-sensor'),
    observedAt: parseTimestamp(raw.timestamp ?? raw.ts ?? raw.observedAt, now),
    // Number(null) and Number('') are 0 — which would read as the strongest possible signal.
    rssi: raw.rssi !== undefined && raw.rssi !== null && raw.rssi !== '' && Number.isFinite(rssi) ? rssi : null,
    // Average over the sensor's report interval (firmware v0.5+); steadier than the peak.
    rssiAvg: Number.isInteger(raw.rssiAvg) ? raw.rssiAvg : null,
    addressType: raw.addressType ?? null,
    randomized: raw.randomized === true,
    name: text(raw.name),
    source: typeof raw.src === 'string' ? raw.src.slice(0, 16) : null,
    // Optional enrichment (firmware v0.2+ and the local server).
    bssid: raw.bssid ? normalizeIdentifier(raw.bssid) : null,
    probe: text(raw.probe),
    vendor: text(raw.vendor),
    mfrName: text(raw.mfrName),
    mfr: Number.isInteger(raw.mfr) ? raw.mfr : null,
    md: typeof raw.md === 'string' && /^[0-9a-f]{2,64}$/i.test(raw.md) ? raw.md.toLowerCase() : null,
    appearance: Number.isInteger(raw.appearance) ? raw.appearance : null,
    // Drone Remote ID (firmware v0.6+): decoded here so every consumer sees the same fields.
    remoteId: typeof raw.rid === 'string' ? decodeRemoteId(raw.rid, protocol) : null,
    // Store-and-forward: recorded while the sensor or server could not deliver it live.
    offline: raw.offline === 'sensor' || raw.offline === 'server' ? raw.offline : raw.offline === true ? 'sensor' : null,
    firstSeenAt: Number.isFinite(raw.firstSeenAt) ? raw.firstSeenAt : null,
    timeApprox: raw.timeApprox === true,
  };
}

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 64) : null);

export function createSecurityEvent(obs, classification, origin, seq) {
  const key = `${origin}|${obs.protocol}|${obs.identifier}`;
  return Object.freeze({
    id: `${origin}-${seq}`,
    key, // device identity
    // Dedupe per device *and* status (so escalation is never suppressed); replayed offline
    // records have their own key so they never start a cooldown that delays a live alarm.
    alertKey: `${key}|${classification.status}${obs.offline ? '|offline' : ''}`,
    offline: obs.offline,
    firstSeenAt: obs.firstSeenAt,
    timeApprox: obs.timeApprox,
    origin,
    identifier: obs.identifier, // full ID: for registration only, never rendered in notifications
    deviceIdMasked: maskIdentifier(obs.identifier),
    stableIdentifier: classification.stableIdentifier,
    addressType: obs.addressType,
    randomized: obs.randomized,
    name: obs.name,
    source: obs.source,
    bssid: obs.bssid,
    probe: obs.probe,
    vendor: obs.vendor,
    mfrName: obs.mfrName,
    mfr: obs.mfr,
    md: obs.md,
    appearance: obs.appearance,
    remoteId: obs.remoteId,
    protocol: obs.protocol,
    sensorId: obs.sensorId,
    observedAt: obs.observedAt,
    rssi: obs.rssi,
    rssiAvg: obs.rssiAvg,
    status: classification.status,
    severity: SEVERITY_BY_STATUS[classification.status] ?? Severity.INFO,
    reason: classification.reason,
    evidence: Object.freeze([...classification.evidence]),
  });
}

/**
 * Wireless observation -> classification -> security event (published on the bus).
 * Live and demo paths use separate registries and can never be confused: the
 * origin comes from the method called, not from the payload.
 */
export function createPipeline({ liveRegistry, demoRegistry, bus, isDemoEnabled = () => false, now = Date.now }) {
  let classifyLive = createClassifier(liveRegistry);
  const classifyDemo = createClassifier(demoRegistry);
  let seq = 0;
  const stats = { live: 0, demo: 0, dropped: 0 };

  function ingest(raw, origin, classify) {
    const obs = normalizeObservation(raw, now);
    if (!obs) {
      stats.dropped++;
      return null;
    }
    const event = createSecurityEvent(obs, classify(obs), origin, ++seq);
    stats[origin === Origin.DEMO ? 'demo' : 'live']++;
    bus.emit(SECURITY_EVENT, event);
    return event;
  }

  return {
    ingestLive: (raw) => ingest(raw, Origin.LIVE, classifyLive),
    ingestDemo(raw) {
      if (!isDemoEnabled()) throw new Error('Demo mode is disabled; simulated events are rejected.');
      return ingest(raw, Origin.DEMO, classifyDemo);
    },
    setLiveRegistry(registry) {
      classifyLive = createClassifier(registry);
    },
    /** Re-classifies an already-tracked live device (e.g. right after a registry edit). */
    classifyLive: (obs) => classifyLive(obs),
    stats: () => ({ ...stats }),
  };
}
