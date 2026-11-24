export const AuthStatus = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  UNKNOWN: 'UNKNOWN',
  VERIFIED_UNAUTHORIZED: 'VERIFIED_UNAUTHORIZED',
});

export const Protocol = Object.freeze({
  WIFI: 'Wi-Fi',
  BLE: 'BLE',
});

// Origin is assigned by the ingestion path, never taken from the payload.
export const Origin = Object.freeze({
  LIVE: 'LIVE',
  DEMO: 'DEMO',
});

export const Severity = Object.freeze({
  NONE: 'none', // authorized: silent, not notified
  INFO: 'info', // unknown: visual notification only
  HIGH: 'high', // verified unauthorized: visual + audible alarm
  RULE: 'rule', // user-defined alert rule: visual, optional chime (never the high-priority alarm)
});

export const DEFAULTS = Object.freeze({
  cooldownMs: 30_000,
  minCooldownMs: 5_000,
  maxCooldownMs: 3_600_000,
  unknownAbsenceMs: 120_000,
  volume: 0.6,
  historyLimit: 200,
});

export const SECURITY_EVENT = 'security-event';
