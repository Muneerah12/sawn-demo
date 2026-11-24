import { DEFAULTS, Severity } from './constants.js';
import { DEFAULT_SITE_POLICY, SiteMode, UnknownAlert, inZone, sanitizeSitePolicy } from './sitePolicy.js';

export const AlertAction = Object.freeze({
  IGNORE: 'ignore', // authorized, or unattributable unknown: nothing to show
  NOTIFY: 'notify', // new alert (visual, plus audible if high severity)
  SUPPRESS: 'suppress', // repeat inside cooldown: update existing alert only
});

const PRUNE_THRESHOLD = 5000;

export function clampCooldown(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return DEFAULTS.cooldownMs;
  return Math.min(DEFAULTS.maxCooldownMs, Math.max(DEFAULTS.minCooldownMs, Math.round(n)));
}

/**
 * HIGH: siren, at most once per device per cooldown, so a device that stays present re-alarms
 *       once per cooldown instead of on every observation.
 * INFO (unknown): one alert per continuous presence; re-alerted only after the device has been
 *       absent for a full window.
 *         monitor mode:    visual only; randomized addresses only if `notifyUnattributable`.
 *         checkpoint mode: only devices inside the gate zone, randomized ones included (unless
 *                          disabled), with a warning tone unless the site chose visual-only.
 * Decisions carry `sound`: 'siren' | 'warning' | null.
 *
 * `presence` (optional) is the tracker's view of the device: smoothed RSSI and the number of
 * recent readings. Checkpoint decisions use it so a single noisy reading can neither put a
 * device in the zone nor trigger an alert on its own. Without it (e.g. replayed offline
 * summaries) the event's own RSSI is used and the reading counts as confirmed.
 */
export function createAlertPolicy({
  cooldownMs = DEFAULTS.cooldownMs,
  unknownAbsenceMs = DEFAULTS.unknownAbsenceMs,
  notifyUnattributable = false,
  sitePolicy = DEFAULT_SITE_POLICY,
  now = Date.now,
} = {}) {
  let cooldown = clampCooldown(cooldownMs);
  let includeUnattributable = notifyUnattributable;
  let site = sanitizeSitePolicy(sitePolicy);
  const lastAlertAt = new Map();
  const lastSeenAt = new Map();

  const infoWindow = () => Math.max(cooldown, unknownAbsenceMs);

  function prune(map, windowMs, t) {
    if (map.size < PRUNE_THRESHOLD) return;
    for (const [k, v] of map) if (t - v >= windowMs) map.delete(k);
  }

  return {
    evaluate(event, presence = null) {
      if (event.severity === Severity.NONE) return { action: AlertAction.IGNORE };
      const checkpoint = site.mode === SiteMode.CHECKPOINT;
      if (event.severity === Severity.INFO) {
        if (checkpoint) {
          const rssi = presence?.rssi ?? event.rssi;
          if (!inZone(rssi, site, event.protocol)) return { action: AlertAction.IGNORE };
          if ((presence ? presence.readings : Infinity) < site.confirmReadings) return { action: AlertAction.IGNORE };
        }
        const allowRandomized = checkpoint ? site.includeRandomized : includeUnattributable;
        if (!event.stableIdentifier && !allowRandomized) return { action: AlertAction.IGNORE };
      }
      const t = now();
      const key = event.alertKey;

      if (event.severity === Severity.HIGH) {
        prune(lastAlertAt, cooldown, t);
        const previous = lastAlertAt.get(key);
        if (previous !== undefined && t - previous < cooldown) {
          return { action: AlertAction.SUPPRESS, remainingMs: cooldown - (t - previous) };
        }
        lastAlertAt.set(key, t);
        return { action: AlertAction.NOTIFY, sound: 'siren' };
      }

      prune(lastSeenAt, infoWindow(), t);
      const seen = lastSeenAt.get(key);
      lastSeenAt.set(key, t);
      if (seen !== undefined && t - seen < infoWindow()) return { action: AlertAction.SUPPRESS };
      const warn = checkpoint && site.unknownAlert === UnknownAlert.SOUND;
      return { action: AlertAction.NOTIFY, sound: warn ? 'warning' : null };
    },
    get sitePolicy() {
      return site;
    },
    setSitePolicy(next) {
      site = sanitizeSitePolicy(next);
      return site;
    },
    get cooldownMs() {
      return cooldown;
    },
    setCooldown(ms) {
      cooldown = clampCooldown(ms);
      return cooldown;
    },
    get notifyUnattributable() {
      return includeUnattributable;
    },
    setNotifyUnattributable(value) {
      includeUnattributable = Boolean(value);
    },
  };
}
