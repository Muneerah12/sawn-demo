// Simulated people walking through the scenes of the tracking cameras (B1, CAM-2). There are no
// real cameras yet: positions are a deterministic function of the clock, so the server (zone
// checks, presence log, incidents) and every console (drawing) see the same people in the same
// places. Coordinates are in the 480 × 270 camera frame; (x, y) is where the feet are.

export const TRACKING_CAMERAS = Object.freeze({
  B1: 'B1 · Public hall',
  C2: 'CAM-2 · Sidewalk and visitors',
});

// Each person walks back and forth across the scene. `badge` is the slot of the RFID badge the
// person carries (the n-th active card in People & cards); null = no badge.
const WALKERS = {
  B1: [
    { id: 1, period: 70, phase: 0.1, x0: 30, x1: 450, y: 225, sway: 12, badge: 0 },
    { id: 2, period: 96, phase: 0.55, x0: 60, x1: 440, y: 190, sway: 18, badge: 4 },
    { id: 3, period: 130, phase: 0.8, x0: 40, x1: 460, y: 245, sway: 8, badge: null },
  ],
  C2: [
    { id: 1, period: 84, phase: 0.3, x0: 20, x1: 460, y: 200, sway: 10, badge: 1 },
    { id: 2, period: 110, phase: 0.0, x0: 40, x1: 450, y: 170, sway: 14, badge: null },
    { id: 3, period: 150, phase: 0.65, x0: 30, x1: 440, y: 235, sway: 6, badge: 5 },
  ],
};

const tri = (u) => {
  const f = u - Math.floor(u);
  return f < 0.5 ? f * 2 : 2 - f * 2;
};

/** People in a camera's frame at time tSec (seconds since the epoch). */
export function tracksAt(cam, tSec) {
  return (WALKERS[cam] ?? []).map((w) => {
    const u = tSec / w.period + w.phase;
    return {
      id: w.id,
      track: `${cam}-${w.id}`,
      badge: w.badge,
      x: w.x0 + (w.x1 - w.x0) * tri(u),
      y: w.y + Math.sin(u * Math.PI * 6) * w.sway,
    };
  });
}

export function pointInPolygon([x, y], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Validates zones drawn by an operator; returns a clean list. */
export function sanitizeZones(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 8).map((z, k) => {
    const points = (Array.isArray(z?.points) ? z.points : [])
      .slice(0, 16)
      .map(([x, y]) => [Math.max(0, Math.min(480, Math.round(Number(x) || 0))), Math.max(0, Math.min(270, Math.round(Number(y) || 0)))]);
    const hours = Array.isArray(z?.hours) && z.hours.length === 2 ? z.hours.map((x) => Math.max(0, Math.min(24, Math.round(Number(x) || 0)))) : null;
    return {
      id: String(z?.id ?? `z${k + 1}`).replace(/[^\w-]/g, '').slice(0, 16) || `z${k + 1}`,
      name: String(z?.name ?? '').trim().slice(0, 40) || `Zone ${k + 1}`,
      points,
      minLevel: Math.max(1, Math.min(5, Math.round(Number(z?.minLevel) || 4))),
      maxDwellS: Math.max(0, Math.min(3600, Math.round(Number(z?.maxDwellS) || 0))),
      hours: hours && hours[0] !== hours[1] ? hours : null,
    };
  }).filter((z) => z.points.length >= 3);
}

/** Is the hour (0–23) inside an allowed window [from, to) — windows may wrap past midnight. */
export function withinHours(hours, hour) {
  if (!hours) return true;
  const [from, to] = hours;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}
