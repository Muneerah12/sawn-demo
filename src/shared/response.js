// Incident response: which team handles an incident, how fast someone must take it, and the
// response times. Shared by the server (routing, escalation, reports) and the console.

export const TEAMS = Object.freeze({
  security: 'Security',
  safety: 'Safety (HSE)',
  emergency: 'Emergency response',
});

/** Minutes until someone must respond (acknowledge or accept) before supervisors are alerted. */
export const RESPONSE_DEADLINE_MIN = Object.freeze({ crit: 2, high: 5, mid: 15, low: 60 });

export const TASK_STATUS = Object.freeze({
  assigned: 'Assigned — waiting for acceptance',
  accepted: 'Accepted',
  on_scene: 'On scene',
  resolved: 'Resolved by responder',
  declined: 'Declined',
});
export const TASK_ACTIONS = Object.freeze(['accept', 'decline', 'on_scene', 'resolved']);

// Life-safety threats go to emergency response; fire, smoke, gas and air quality to safety;
// everything else (access, devices, perimeter, behaviour) to security.
const EMERGENCY = /explosive|weapon|firearm|violence|altercation|armed|arson|person down/i;
const SAFETY = /fire|smoke|smoking|gas|methane|environment|air quality|voc/i;
const EMERGENCY_SCENARIOS = new Set(['etd', 'weapon', 'fight']);
const SAFETY_SCENARIOS = new Set(['env']);

export function routeIncident({ scenario = null, title = '', zone = '' } = {}) {
  const text = `${title} ${zone}`;
  if (EMERGENCY_SCENARIOS.has(scenario) || EMERGENCY.test(text)) return 'emergency';
  if (SAFETY_SCENARIOS.has(scenario) || SAFETY.test(text)) return 'safety';
  return 'security';
}

const isOpenStatus = (s) => s === 'new' || s === 'ack' || s === 'escalated';

/** Response times of one incident (ms, null while not reached) and whether it is overdue. */
export function responseMetrics(i, now = Date.now()) {
  const deadline = (RESPONSE_DEADLINE_MIN[i.sev] ?? 15) * 60_000;
  const firstResponse = i.firstResponseAt ?? null;
  const taken = i.acceptedAt ?? null;
  return {
    toFirstResponse: firstResponse ? firstResponse - i.createdAt : null,
    toAccept: taken && i.assignedAt ? taken - i.assignedAt : null,
    toClose: i.decidedAt ? i.decidedAt - i.createdAt : null,
    deadline,
    overdue: isOpenStatus(i.status) && !firstResponse && now - i.createdAt > deadline,
  };
}

/** "1 min 05 s", "3 h 20 min" — durations for the console and reports. */
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  return `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`;
}

export function median(values) {
  const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}
