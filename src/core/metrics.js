// Short-term history for the dashboard charts: periodic snapshots of device counts and a log
// of alert times. Kept for the current browser session (survives a refresh, not a new tab).
const STORAGE_KEY = 'sawn.metrics.v1';

export const AlertKind = Object.freeze({ UNAUTHORIZED: 'unauthorized', UNKNOWN: 'unknown', RULE: 'rule' });

export function createMetrics({
  intervalMs = 10_000,
  windowMs = 30 * 60_000,
  alertWindowMs = 60 * 60_000,
  storage = globalThis.sessionStorage ?? null,
  now = Date.now,
} = {}) {
  let snapshots = [];
  let alerts = []; // { t, kind }

  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(saved?.snapshots)) snapshots = saved.snapshots;
    if (Array.isArray(saved?.alerts)) alerts = saved.alerts;
  } catch {
    // corrupt or unavailable storage: start empty
  }

  function trim() {
    const t = now();
    snapshots = snapshots.filter((s) => t - s.t <= windowMs);
    alerts = alerts.filter((a) => t - a.t <= alertWindowMs);
  }

  function persist() {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify({ snapshots, alerts }));
    } catch {
      // storage full / unavailable: history then lasts for this page only
    }
  }

  return {
    /** Records a snapshot if at least `intervalMs` passed since the last one. Returns true if recorded. */
    sample(counts) {
      const t = now();
      const last = snapshots.at(-1);
      if (last && t - last.t < intervalMs) return false;
      snapshots.push({ t, ...counts });
      trim();
      persist();
      return true;
    },

    recordAlert(kind) {
      alerts.push({ t: now(), kind });
      trim();
      persist();
    },

    snapshots() {
      trim();
      return [...snapshots];
    },

    /** Last `n` values of one snapshot field (for sparklines). */
    recent(field, n = 12) {
      return snapshots.slice(-n).map((s) => s[field] ?? 0);
    },

    /** Alert counts per bucket over the alert window, oldest first. */
    alertBuckets(bucketMs = 5 * 60_000) {
      const t = now();
      const count = Math.round(alertWindowMs / bucketMs);
      const start = t - count * bucketMs;
      const buckets = Array.from({ length: count }, (_, i) => ({
        start: start + i * bucketMs,
        end: start + (i + 1) * bucketMs,
        unauthorized: 0,
        unknown: 0,
        rule: 0,
      }));
      for (const a of alerts) {
        // The newest bucket ends at "now" inclusive, so an alert from this instant is counted.
        const i = Math.min(count - 1, Math.floor((a.t - start) / bucketMs));
        if (i >= 0 && i < count && a.kind in buckets[i]) buckets[i][a.kind]++;
      }
      return buckets;
    },

    alertsSince(ms) {
      const t = now();
      return alerts.filter((a) => t - a.t <= ms).length;
    },
  };
}
