// Console data shared by the pages: incidents, people and cards from the database (kept current
// by live pushes over the feed), plus the latest airspace snapshot from the airspace module.
import { SEVERITY_RANK, isOpen } from '../shared/scenarios.js';
import { operationalIncidentCounts } from '../shared/incidentProvenance.js';
import { get } from './api.js';
import { emit, on, session } from './hub.js';

export const state = {
  incidents: [],
  people: [],
  cards: [],
  airspace: null, // published by src/app.js every second
  aircraft: null, // last ADS-B message from the server ({ list, source, mode, replay, … })
  netDown: false,
  approvals: [],
  notifications: [],
  unread: 0,
  health: [],
  gate: { checks: [], readerEvents: [], counts24h: { allow: 0, deny: 0, refer: 0 }, mode: 'online', directory: null, policy: null, components: {} },
  gates: { generatedAt: null, gates: [] },
  loaded: { incidents: false, people: false },
};

export async function loadApprovals() {
  const r = await get('approvals?status=all');
  state.approvals = r.approvals;
  emit('approvals');
}

export async function loadNotifications() {
  const r = await get('notifications');
  state.notifications = r.notifications;
  state.unread = r.unread;
  emit('notifications');
}

export async function loadGate() {
  const gate = await get('gate');
  state.gate = { ...gate, readerEvents: gate.readerEvents ?? [] };
  emit('gate');
}

/** Non-PII operating status for Gate A and Gate B. */
export async function loadGates() {
  state.gates = await get('gates');
  emit('gates');
}

export const pendingApprovals = () => state.approvals.filter((a) => a.status === 'pending' && a.expiresAt > Date.now());

export function counts() {
  return operationalIncidentCounts(state.incidents, { isOpen });
}

/** Open first (by severity, newest), then closed (newest). */
export function sortedIncidents(list = state.incidents) {
  return [...list].sort((a, b) => {
    const ao = isOpen(a.status);
    const bo = isOpen(b.status);
    if (ao !== bo) return ao ? -1 : 1;
    if (ao && a.sev !== b.sev) return SEVERITY_RANK[a.sev] - SEVERITY_RANK[b.sev];
    return b.createdAt - a.createdAt;
  });
}

export async function loadIncidents() {
  const r = await get('incidents?limit=500');
  state.incidents = r.incidents;
  state.loaded.incidents = true;
  emit('incidents', { reload: true });
}

export async function loadPeople() {
  if (!session.can('people.view')) return;
  const r = await get('people');
  state.people = r.people;
  state.cards = r.cards;
  state.loaded.people = true;
  emit('people');
}

function upsertIncident(incident) {
  const i = state.incidents.findIndex((x) => x.id === incident.id);
  if (i >= 0) state.incidents[i] = incident;
  else state.incidents.unshift(incident);
}

// Live pushes from the server (forwarded by the airspace feed in src/app.js).
on('server-message', (msg) => {
  if (msg.type === 'incident') {
    upsertIncident(msg.incident);
    emit('incidents', { incident: msg.incident, event: msg.event });
  } else if (msg.type === 'presence') {
    emit('presence');
  } else if (msg.type === 'config' && msg.what === 'permits') {
    emit('config', 'permits');
  } else if (msg.type === 'config' && msg.what === 'cameraZones') {
    emit('config', 'cameraZones');
  } else if (msg.type === 'config' && msg.what === 'people') {
    loadPeople().catch(() => {});
  } else if (msg.type === 'config' && msg.what === 'registry') {
    // Device owners changed: people's device lists too.
    loadPeople().catch(() => {});
  } else if (msg.type === 'audit') {
    emit('audit-entry', msg.entry);
  } else if (msg.type === 'sim' && msg.what === 'net') {
    state.netDown = msg.down;
    emit('net', msg.down);
  } else if (msg.type === 'sim' && msg.what === 'granted') {
    emit('sim-granted');
  } else if (msg.type === 'config' && msg.what === 'users') {
    emit('users-changed');
  } else if (msg.type === 'notification') {
    state.notifications.unshift(msg.notification);
    state.unread++;
    emit('notifications', msg.notification);
  } else if (msg.type === 'approval') {
    const i = state.approvals.findIndex((a) => a.id === msg.approval.id);
    if (i >= 0) state.approvals[i] = msg.approval;
    else state.approvals.unshift(msg.approval);
    emit('approvals', msg.approval);
  } else if (msg.type === 'gate') {
    const i = state.gate.checks.findIndex((c) => c.id === msg.check.id);
    if (i >= 0) state.gate.checks[i] = msg.check;
    else {
      state.gate.checks.unshift(msg.check);
      state.gate.counts24h[msg.check.result] = (state.gate.counts24h[msg.check.result] ?? 0) + 1;
    }
    emit('gate', msg.check);
  } else if (msg.type === 'reader_event') {
    const events = state.gate.readerEvents ?? (state.gate.readerEvents = []);
    const i = events.findIndex((e) => e.id === msg.event.id || (e.readerId === msg.event.readerId && e.eventId === msg.event.eventId));
    if (i >= 0) events[i] = msg.event;
    else events.unshift(msg.event);
    if (events.length > 60) events.length = 60;
    emit('reader-event', msg.event);
    // A successful tap can change the relevant gate from "link open" to "recently verified".
    loadGates().catch(() => {});
  } else if (msg.type === 'health') {
    state.health = msg.health;
    emit('health');
  } else if (msg.type === 'config' && msg.what === 'fourEyes') {
    emit('four-eyes');
  }
});

// Reader-link status changes independently from Airspace observations. Refresh the compact gate
// picture; this remains non-PII and never exposes a physical card UID to the browser.
on('bridge-status', () => loadGates().catch(() => {}));

on('airspace', (snap) => {
  state.airspace = snap;
});

export function replaceIncident(incident) {
  upsertIncident(incident);
  emit('incidents', { incident, event: 'updated' });
}
