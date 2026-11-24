// Incident provenance is deliberately separate from lifecycle status.  It answers where an
// incident came from, not whether it is still open, acknowledged, or resolved.
//
// Be conservative: `simulated: false` is not evidence on its own.  Older records without
// enough machine-readable context remain UNKNOWN rather than being shown as operational.

export const IncidentProvenance = Object.freeze({
  OPERATIONAL: 'operational',
  REPLAY: 'replay',
  EXERCISE: 'exercise',
  HYBRID: 'hybrid',
  UNKNOWN: 'unknown',
});

const EXPLICIT = new Set(Object.values(IncidentProvenance));
const DIRECT_OPERATIONAL_SOURCES = new Set(['airspace', 'health']);

/**
 * Classify only from structured source/context fields.  Do not inspect titles, reasons, or
 * other descriptive text: those are for people, not a safe provenance contract.
 */
export function incidentProvenance(incident) {
  if (!incident || typeof incident !== 'object') return IncidentProvenance.UNKNOWN;

  // New records carry this explicit marker in their JSON data, which db.mjs exposes at top level.
  if (EXPLICIT.has(incident.provenance)) return incident.provenance;

  // Backward-compatible structured contexts for records already stored before the marker.
  if (incident.source === 'simulator' && incident.simulated === true) return IncidentProvenance.EXERCISE;
  if (incident.source === 'gate' && incident.simulated === true && incident.gateCheck !== undefined) return IncidentProvenance.HYBRID;
  if (incident.source === 'health' && incident.simulated === true) return IncidentProvenance.EXERCISE;
  if (incident.source === 'airspace' && incident.simulated === true && incident.demoRun) return IncidentProvenance.EXERCISE;

  // These two sources are generated only by server-side live detectors when explicitly marked
  // non-simulated.  Analysis is intentionally excluded: older analysis records may have been
  // derived from a simulator run and therefore need an explicit marker.
  if (incident.simulated === false && DIRECT_OPERATIONAL_SOURCES.has(incident.source)) return IncidentProvenance.OPERATIONAL;
  if (incident.simulated === false && incident.source === 'gate') return IncidentProvenance.OPERATIONAL;

  return IncidentProvenance.UNKNOWN;
}

export const isOperationalIncident = (incident) => incidentProvenance(incident) === IncidentProvenance.OPERATIONAL;

export function operationalIncidents(incidents = [], isOpen = null) {
  return incidents.filter((incident) => isOperationalIncident(incident) && (!isOpen || isOpen(incident.status)));
}

/** Shared operational totals used by the Command Center.  Non-operational records stay intact. */
export function operationalIncidentCounts(incidents = [], { isOpen, now = Date.now } = {}) {
  const all = Array.isArray(incidents) ? incidents : [];
  const open = operationalIncidents(all, isOpen);
  const dayAgo = now() - 86_400_000;
  const unclassifiedOpen = all.filter((incident) => (!isOpen || isOpen(incident.status)) && incidentProvenance(incident) === IncidentProvenance.UNKNOWN);
  return {
    open: open.length,
    crit: open.filter((incident) => incident.sev === 'crit').length,
    escalated: open.filter((incident) => incident.status === 'escalated').length,
    today: all.filter((incident) => incident.createdAt >= dayAgo && isOperationalIncident(incident)).length,
    airspaceOpen: open.filter((incident) => incident.source === 'airspace').length,
    unclassifiedOpen: unclassifiedOpen.length,
  };
}
