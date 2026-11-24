// User-defined alert rules built from the Live devices filters.
// Within a field values are OR-ed (tablet OR watch); fields are AND-ed (Android AND tablet/watch).
// Rules never trigger the high-priority unauthorized alarm: their action is a visual alert,
// optionally with a softer chime.
import { AuthStatus, DEFAULTS } from './constants.js';
import { DeviceType, osFamily } from './deviceType.js';

export const RuleAction = Object.freeze({ NOTIFY: 'notify', CHIME: 'chime' });
export const OS_FAMILIES = Object.freeze(['apple', 'macos', 'android', 'windows', 'linux', 'unknown']);
const TYPES = new Set(Object.values(DeviceType));
const STATUSES = new Set(Object.values(AuthStatus));
const CONFIDENCE_RANK = { low: 1, medium: 2, high: 3 };
const MAX_RULES = 50;

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = (arr, allowed) => [...new Set((Array.isArray(arr) ? arr : []).filter((v) => allowed.has(v)))];

/** Validates rules (shared by the app and the local server). */
export function sanitizeRules(input) {
  if (!input || !Array.isArray(input.rules)) throw new TypeError('Rules file needs a rules[] array');
  if (input.rules.length > MAX_RULES) throw new RangeError(`At most ${MAX_RULES} rules`);
  const ids = new Set();
  const rules = input.rules.map((raw, i) => {
    const id = text(raw?.id, 40) || `rule-${i + 1}`;
    if (!/^[\w-]+$/.test(id) || ids.has(id)) throw new TypeError(`Invalid or duplicate rule id: ${id}`);
    ids.add(id);
    const name = text(raw?.name, 80);
    if (!name) throw new TypeError('Every rule needs a name');
    const c = raw.conditions ?? {};
    const minRssi = Number(c.minRssi);
    return {
      id,
      name,
      enabled: raw.enabled !== false,
      action: raw.action === RuleAction.CHIME ? RuleAction.CHIME : RuleAction.NOTIFY,
      conditions: {
        types: pick(c.types, TYPES),
        osFamilies: pick(c.osFamilies, new Set(OS_FAMILIES)),
        protocol: ['Wi-Fi', 'BLE'].includes(c.protocol) ? c.protocol : '',
        minRssi: Number.isFinite(minRssi) && minRssi < 0 && minRssi >= -120 ? Math.round(minRssi) : null,
        statuses: pick(c.statuses, STATUSES),
        text: text(c.text, 64),
        minConfidence: CONFIDENCE_RANK[c.minConfidence] ? c.minConfidence : 'medium',
      },
    };
  });
  return { rules };
}

/** Builds rule conditions from the Live devices filter values. */
export function conditionsFromFilters({ types = '', os = '', protocol = '', range = '', status = '', search = '' }) {
  return {
    types: types ? types.split(',') : [],
    osFamilies: os ? [os] : [],
    protocol,
    minRssi: range ? Number(range) : null,
    statuses: status ? [status] : [],
    text: search,
    minConfidence: 'medium',
  };
}

/**
 * @param device tracked device; @param kind inferDeviceType() result; @param host LAN info or null
 */
export function matchRule(rule, device, kind, host = null) {
  const c = rule.conditions;
  if (c.protocol && device.protocol !== c.protocol) return false;
  const rssi = Number.isFinite(device.rssiSmoothed) ? device.rssiSmoothed : device.rssi;
  if (c.minRssi !== null && !(Number.isFinite(rssi) && rssi >= c.minRssi)) return false;
  if (c.statuses.length && !c.statuses.includes(device.status)) return false;

  if (c.types.length || c.osFamilies.length) {
    // Type/OS conditions only count when the inference is confident enough.
    const confident = (CONFIDENCE_RANK[kind.confidence] ?? (kind.os ? 1 : 0)) >= CONFIDENCE_RANK[c.minConfidence];
    if (!confident) return false;
    if (c.types.length && !c.types.includes(kind.type)) return false;
    if (c.osFamilies.length && !c.osFamilies.includes(osFamily(kind.os))) return false;
  }

  if (c.text) {
    const q = c.text.toLowerCase();
    const fields = [device.identifier, device.name, device.vendor, device.mfrName, device.probe, kind.model, kind.family, kind.familyLabel, kind.os, host?.ip, host?.hostname];
    if (!fields.some((v) => v && String(v).toLowerCase().includes(q))) return false;
  }
  return true;
}

/** Human-readable summary of a rule's conditions. */
export function describeRule(rule, { typeLabel = (t) => t, osLabel = (o) => o } = {}) {
  const c = rule.conditions;
  const parts = [];
  if (c.types.length) parts.push(c.types.map(typeLabel).join(' or '));
  if (c.osFamilies.length) parts.push(`OS: ${c.osFamilies.map(osLabel).join(' or ')}`);
  if (c.protocol) parts.push(c.protocol);
  if (c.minRssi !== null) parts.push(`signal ≥ ${c.minRssi} dBm`);
  if (c.statuses.length) parts.push(c.statuses.map((s) => s.toLowerCase().replace('_', ' ')).join(' or '));
  if (c.text) parts.push(`contains “${c.text}”`);
  if (c.types.length || c.osFamilies.length) parts.push(`${c.minConfidence}+ confidence`);
  return parts.length ? parts.join(' · ') : 'any device';
}

/**
 * Fires each rule once per continuous presence of a matching device; it re-fires only after the
 * device has stopped matching (or been absent) for the absence window.
 */
export function createRuleEngine({ now = Date.now, absenceMs = () => DEFAULTS.unknownAbsenceMs } = {}) {
  let rules = [];
  const lastMatch = new Map(); // `${ruleId}|${deviceKey}` -> time

  return {
    setRules(next) {
      rules = next;
    },
    get rules() {
      return rules;
    },
    /** Returns the rules that should alert now for this device. */
    evaluate(device, kind, host = null) {
      const t = now();
      const fired = [];
      for (const rule of rules) {
        if (!rule.enabled || !matchRule(rule, device, kind, host)) continue;
        const key = `${rule.id}|${device.key}`;
        const previous = lastMatch.get(key);
        lastMatch.set(key, t);
        if (previous === undefined || t - previous >= absenceMs()) fired.push(rule);
      }
      if (lastMatch.size > 10_000) {
        for (const [k, v] of lastMatch) if (t - v >= absenceMs()) lastMatch.delete(k);
      }
      return fired;
    },
  };
}
