// Geometry for the Site & airspace page. DOM-free so it can be tested.
//   local frame   metres around the site: x = east, y = up, z = south (three.js: -z is north)
//   plan          the facility plan (120 × 80 units, 1:50 model in cm) → 0.5 m per unit, centred
//   tiles         Web Mercator (slippy-map) tile numbers and their corner coordinates
//   sky           azimuth / elevation of a satellite → a point on the sky dome above the site

export const PLAN_M = 0.5; // metres per plan unit (the 120 × 80 cm model is 1:50)
export const PLAN_W = 120;
export const PLAN_H = 80;
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320;
const FT = 0.3048;

/** Plan (x along the street, y = 0 at the back wall, growing towards the street) → local metres. */
export const planToLocal = (px, py) => ({ x: (px - PLAN_W / 2) * PLAN_M, z: (py - PLAN_H / 2) * PLAN_M });

/** Latitude / longitude → local metres around `site` (equirectangular; fine within ~100 km). */
export function geoToLocal(site, lat, lon) {
  return { x: (lon - site.lon) * M_PER_DEG_LON * Math.cos((site.lat * Math.PI) / 180), z: -(lat - site.lat) * M_PER_DEG_LAT };
}

/** Height above the site in metres from a barometric altitude in feet (never below the ground). */
export const heightM = (altitudeFt, siteElevationFt = 0) => (Number.isFinite(altitudeFt) ? Math.max(0, (altitudeFt - siteElevationFt) * FT) : 0);

/** Slippy-map tile containing a point. */
export function tileOf(lat, lon, z) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return {
    x: Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n))),
    y: Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n))),
  };
}

/** North-west corner of a tile (lat, lon). */
export function tileCorner(x, y, z) {
  const n = 2 ** z;
  return { lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI, lon: (x / n) * 360 - 180 };
}

/** The (2r+1)² tiles of zoom z around the site, each with its local-metre bounds. */
export function tilesAround(site, z, r) {
  const c = tileOf(site.lat, site.lon, z);
  const n = 2 ** z;
  const out = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const nw = tileCorner(x, y, z);
      const se = tileCorner(x + 1, y + 1, z);
      const a = geoToLocal(site, nw.lat, nw.lon);
      const b = geoToLocal(site, se.lat, se.lon);
      out.push({ z, x, y, x0: a.x, x1: b.x, z0: a.z, z1: b.z });
    }
  }
  return out;
}

/** Azimuth (° from north, clockwise) and elevation (°) → point on a dome of radius r (local metres). */
export function skyPoint(azDeg, elDeg, r) {
  const az = (azDeg * Math.PI) / 180;
  const el = (Math.max(0, elDeg) * Math.PI) / 180;
  return { x: r * Math.cos(el) * Math.sin(az), y: r * Math.sin(el), z: -r * Math.cos(el) * Math.cos(az) };
}
