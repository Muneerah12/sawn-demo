// Label placement for the aircraft radar: every label (zone rings, airfields, roads, tracks,
// pilots) asks for a few candidate positions; the most important labels are placed first and each
// takes the first candidate that stays on screen and touches nothing already placed (labels,
// icons, the site marker). A label that finds no free spot is left out rather than overlapping.
// DOM-free so it can be tested in Node.

/** Axis-aligned overlap of two [x, y, w, h] boxes (touching edges do not count). */
export const overlaps = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

/**
 * Boxes centred on a ring, tried in this order: bottom-right, bottom-left, top-right, top-left,
 * right, left, bottom, top (canvas angles: y grows downwards).
 */
export function ringCandidates(cx, cy, r, w, h) {
  return [45, 135, -45, -135, 0, 180, 90, -90].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * r - w / 2, cy + Math.sin(a) * r - h / 2];
  });
}

/** Boxes around a point (an icon): right, left, below, above and the diagonals, at growing distances. */
export function aroundCandidates(x, y, w, h, gaps = [16]) {
  const out = [];
  for (const d of gaps) {
    out.push([x + d, y - h / 2], [x - d - w, y - h / 2], [x - w / 2, y + d], [x - w / 2, y - d - h], [x + d * 0.7, y + d * 0.7], [x - d * 0.7 - w, y - d * 0.7 - h], [x + d * 0.7, y - d * 0.7 - h], [x - d * 0.7 - w, y + d * 0.7]);
  }
  return out;
}

/**
 * @param requests  [{ id, w, h, priority (lower = first), cands: [[x, y], …] }]
 * @param bounds    { width, height, margin }
 * @param obstacles boxes nothing may cover (icons, the site marker)
 * @returns Map id → [x, y, w, h] for the labels that were placed
 */
export function placeLabels(requests, { width, height, margin = 2 }, obstacles = []) {
  const placed = [...obstacles];
  const out = new Map();
  const order = [...requests].sort((a, b) => a.priority - b.priority);
  for (const r of order) {
    for (const [x, y] of r.cands) {
      const box = [x, y, r.w, r.h];
      if (x < margin || y < margin || x + r.w > width - margin || y + r.h > height - margin) continue;
      if (placed.some((p) => overlaps(p, box))) continue;
      placed.push(box);
      out.set(r.id, box);
      break;
    }
  }
  return out;
}
