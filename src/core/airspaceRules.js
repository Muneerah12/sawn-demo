// Airspace rules for every track around the site (aircraft from ADS-B, drones from Remote ID and
// the demo scenarios):
//   zones       MONITOR 25 km · WARNING 10 km · RESTRICTED 5 km below the ceiling (a cylinder)
//   prediction  straight line from track + speed (+ vertical rate) for the next 2 minutes, and the
//               time until the track enters the restricted cylinder
//   airports    aircraft on the extended centreline of a RUH runway, aligned with it, descending
//               towards it (or climbing away), with a callsign, are "Expected – RUH traffic"
//   squawks     7500 hijack · 7600 radio failure · 7700 emergency → critical
//   loitering   an aircraft that turns ≥ 300° within 6 minutes inside the WARNING ring
// DOM-free: the server raises incidents with it; the console uses the same geometry to draw.

export const Level = Object.freeze({ CRITICAL: 'critical', HIGH: 'high', WARNING: 'warning', NORMAL: 'normal', EXPECTED: 'expected' });
export const LEVEL_RANK = Object.freeze({ critical: 0, high: 1, warning: 2, normal: 3, expected: 4 });
export const LEVEL_LABEL = Object.freeze({ critical: 'CRITICAL', high: 'HIGH', warning: 'WARNING', normal: 'Traffic', expected: 'Expected' });

const KT = 0.514444; // m/s per knot
const FT = 3.28084; // ft per metre
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
/** Smallest angle between two bearings (0…180). */
export const angleDiff = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

// ---------------------------------------------------------------- geometry (flat earth: fine within ~100 km)
export function toLocal(origin, p) {
  return { e: (p.lon - origin.lon) * 111_320 * Math.cos(rad(origin.lat)), n: (p.lat - origin.lat) * 110_574 };
}
export function fromLocal(origin, e, n) {
  return { lat: origin.lat + n / 110_574, lon: origin.lon + e / (111_320 * Math.cos(rad(origin.lat))) };
}
/** The point `distM` metres from `p` along `bearingDeg` (0 = north). */
export function offsetPoint(p, bearingDeg, distM) {
  return fromLocal(p, distM * Math.sin(rad(bearingDeg)), distM * Math.cos(rad(bearingDeg)));
}
export function bearingTo(a, b) {
  const { e, n } = toLocal(a, b);
  return (deg(Math.atan2(e, n)) + 360) % 360;
}
export const fmtMinSec = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- drone pilot (Remote ID operator location)
/**
 * The pilot's position from a Remote ID System message.
 * @param rid       decoded Remote ID ({ operatorLat, operatorLon, operatorLocationType, operatorId, lat, lon })
 * @param site      { lat, lon } or null
 * @param boundaryM site boundary radius (metres); null = unknown
 * @returns {{ lat, lon, type, operatorId, distanceToSiteM, distanceToDroneM, inside } | null}
 */
export function pilotOf(rid, { site = null, boundaryM = null } = {}) {
  if (!rid || !Number.isFinite(rid.operatorLat) || !Number.isFinite(rid.operatorLon)) return null;
  const p = { lat: rid.operatorLat, lon: rid.operatorLon };
  const dist = (a, b) => {
    const d = toLocal(a, b);
    return Math.round(Math.hypot(d.e, d.n));
  };
  const distanceToSiteM = site ? dist(site, p) : null;
  return {
    ...p,
    type: rid.operatorLocationType ?? 'Unknown',
    operatorId: rid.operatorId ?? null,
    distanceToSiteM,
    distanceToDroneM: Number.isFinite(rid.lat) && Number.isFinite(rid.lon) ? dist(p, { lat: rid.lat, lon: rid.lon }) : null,
    inside: distanceToSiteM !== null && Number.isFinite(boundaryM) ? distanceToSiteM <= boundaryM : null,
  };
}

// ---------------------------------------------------------------- squawks
export const SQUAWK = Object.freeze({
  7500: { code: '7500', name: 'hijack', en: 'Unlawful interference — the crew is reporting a hijacking.', ar: 'تدخّل غير مشروع — الطاقم يبلغ عن اختطاف' },
  7600: { code: '7600', name: 'radio failure', en: 'Radio failure — the aircraft cannot talk to air traffic control.', ar: 'عطل في الاتصال اللاسلكي — لا تستطيع الطائرة التواصل مع المراقبة الجوية' },
  7700: { code: '7700', name: 'general emergency', en: 'General emergency — for example engine failure, fire or a medical emergency on board.', ar: 'حالة طوارئ عامة — مثل عطل محرك أو حريق أو حالة طبية على متن الطائرة' },
});
const EMERGENCY_FIELD = { unlawful: '7500', nordo: '7600', general: '7700', downed: '7700' }; // readsb "emergency"
export function emergencyOf(tr) {
  if (tr.kind === 'drone') return null;
  const code = SQUAWK[tr.squawk] ? tr.squawk : EMERGENCY_FIELD[tr.emergency];
  return code ? SQUAWK[code] : null;
}

// ---------------------------------------------------------------- zones & config
// RUH runway ends from public aeronautical databases (SkyVector / airport databases, not the
// Saudi AIP): good enough to recognise approach and departure traffic.
export const RUH_CORRIDORS = Object.freeze([
  { name: 'RUH 15L/33R', airport: 'RUH', ends: [[24.9769, 46.702], [24.944, 46.7228]], fieldElevationFt: 2049, lengthM: 20000, halfWidthM: 1500, maxHeadingDiffDeg: 20, maxAboveFieldFt: 7000 },
  { name: 'RUH 15R/33L', airport: 'RUH', ends: [[24.9709, 46.6749], [24.938, 46.6957]], fieldElevationFt: 2049, lengthM: 20000, halfWidthM: 1500, maxHeadingDiffDeg: 20, maxAboveFieldFt: 7000 },
]);

const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const clamp = (v, lo, hi, fallback) => {
  const n = num(v);
  return n !== null && n >= lo && n <= hi ? n : fallback;
};

export function sanitizeCorridors(list) {
  if (!Array.isArray(list)) return RUH_CORRIDORS.map((c) => ({ ...c, ends: c.ends.map((e) => [...e]) }));
  const out = [];
  for (const c of list) {
    if (!c || c.enabled === false || !Array.isArray(c.ends) || c.ends.length !== 2) continue;
    const ends = c.ends.map((e) => [num(e?.[0]), num(e?.[1])]);
    if (ends.some(([la, lo]) => la === null || lo === null || Math.abs(la) > 90 || Math.abs(lo) > 180)) continue;
    out.push({
      name: String(c.name ?? 'Runway').slice(0, 40),
      airport: String(c.airport ?? '').slice(0, 8),
      ends,
      fieldElevationFt: clamp(c.fieldElevationFt, -1500, 20000, 0),
      lengthM: clamp(c.lengthM, 1000, 60000, 20000),
      halfWidthM: clamp(c.halfWidthM, 100, 10000, 1500),
      maxHeadingDiffDeg: clamp(c.maxHeadingDiffDeg, 5, 60, 20),
      maxAboveFieldFt: clamp(c.maxAboveFieldFt, 500, 20000, 7000),
    });
  }
  return out;
}

/** The track's ring: 'restricted' | 'warning' | 'monitor' | 'outside'. */
export function zoneOf(distanceM, cfg) {
  if (!Number.isFinite(distanceM)) return 'outside';
  return distanceM <= cfg.restrictedRadiusM ? 'restricted' : distanceM <= cfg.warningRadiusM ? 'warning' : distanceM <= cfg.monitorRadiusM ? 'monitor' : 'outside';
}

/** Inside the restricted cylinder: within the radius AND below the ceiling (above the site). */
export function inCylinder(distanceM, altitudeFt, cfg) {
  return Number.isFinite(distanceM) && Number.isFinite(altitudeFt) && distanceM <= cfg.restrictedRadiusM && altitudeFt - (cfg.siteElevationFt ?? 0) < cfg.restrictedCeilingFt;
}

export function inRestrictedAirspace(ac, cfg) {
  if (!ac || ac.onGround) return false;
  return inCylinder(ac.distanceM, ac.altitudeFt, cfg);
}

// ---------------------------------------------------------------- prediction
/**
 * Straight-line prediction. `path` has a point every 30 s ([lat, lon, altitudeFt]); time to zone
 * is the first 5-second step inside the restricted cylinder (0 = already inside), or null.
 */
export function predictTrack(tr, cfg, site, { horizonSec = cfg.predictionSec ?? 120, stepSec = 5, inside = null } = {}) {
  const test = inside ?? ((d, alt) => inCylinder(d, alt, cfg));
  const moving = !tr.onGround && Number.isFinite(tr.speedKt) && tr.speedKt > 0.5 && Number.isFinite(tr.track);
  const p0 = toLocal(site, tr);
  const v = moving ? tr.speedKt * KT : 0;
  const b = rad(tr.track ?? 0);
  const vr = Number.isFinite(tr.verticalRateFpm) ? tr.verticalRateFpm : 0;
  const floor = cfg.siteElevationFt ?? 0;
  const path = [];
  let timeToZoneSec = null;
  for (let t = 0; t <= horizonSec; t += stepSec) {
    const e = p0.e + v * t * Math.sin(b);
    const n = p0.n + v * t * Math.cos(b);
    const alt = Number.isFinite(tr.altitudeFt) ? Math.max(floor, tr.altitudeFt + (vr * t) / 60) : null;
    if (t % 30 === 0 && (moving || t === 0)) {
      const p = fromLocal(site, e, n);
      path.push([Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5, alt === null ? null : Math.round(alt)]);
    }
    if (timeToZoneSec === null && test(Math.hypot(e, n), alt)) timeToZoneSec = t;
    if (!moving && t > 0) break;
  }
  return { path, timeToZoneSec };
}

// ---------------------------------------------------------------- airport corridors
/**
 * Whether the aircraft is flying an approach to / departure from one of the runways.
 * @returns {{ name, airport, phase, ok: boolean, why: string } | null} null when outside every corridor
 */
export function corridorMatch(tr, corridors = RUH_CORRIDORS) {
  if (!Number.isFinite(tr.lat) || !Number.isFinite(tr.lon)) return null;
  let failed = null;
  for (const c of corridors) {
    const A = { lat: c.ends[0][0], lon: c.ends[0][1] };
    const B = { lat: c.ends[1][0], lon: c.ends[1][1] };
    const mid = { lat: (A.lat + B.lat) / 2, lon: (A.lon + B.lon) / 2 };
    const b = toLocal(mid, B);
    const half = Math.hypot(b.e, b.n);
    const ux = b.e / half;
    const uy = b.n / half; // unit vector mid → B
    const p = toLocal(mid, tr);
    const along = p.e * ux + p.n * uy;
    const cross = Math.abs(-p.e * uy + p.n * ux);
    const beyond = Math.max(0, Math.abs(along) - half);
    if (beyond > c.lengthM || cross > c.halfWidthM + beyond * 0.08) continue; // widens ≈ 4.6° each side
    const res = { name: c.name, airport: c.airport, phase: null, ok: false, why: '' };
    const axis = (deg(Math.atan2(ux, uy)) + 360) % 360;
    if (!Number.isFinite(tr.track) || Math.min(angleDiff(tr.track, axis), angleDiff(tr.track, axis + 180)) > c.maxHeadingDiffDeg) {
      failed ??= { ...res, why: `heading does not match the ${c.name} runway` };
      continue;
    }
    const above = (tr.altitudeFt ?? Infinity) - c.fieldElevationFt;
    if (!(above <= c.maxAboveFieldFt)) {
      failed ??= { ...res, why: 'too high for an approach or departure' };
      continue;
    }
    const towardB = Math.cos(rad(tr.track - axis)) > 0;
    const closing = Math.abs(along) <= half || (along < 0) === towardB; // moving towards the runway
    const vr = tr.verticalRateFpm;
    if (Math.abs(along) <= half && above <= 600) res.phase = 'runway';
    else if (closing && Number.isFinite(vr) && vr <= -100) res.phase = 'approach';
    else if (!closing && Number.isFinite(vr) && vr >= 100) res.phase = 'departure';
    if (!res.phase) {
      failed ??= { ...res, why: closing ? 'not descending towards the runway' : 'not climbing away from the runway' };
      continue;
    }
    return { ...res, ok: true, why: `${res.phase === 'approach' ? 'on approach to' : res.phase === 'departure' ? 'departing' : 'on the runway of'} ${c.airport} (${c.name})` };
  }
  return failed;
}

// ---------------------------------------------------------------- GPS jamming / spoofing (from ADS-B)
// ADS-B positions come from the aircraft's own GPS, and every message says how good that position
// is: NIC (integrity containment, 0–11), NACp (accuracy, 0–11) and SIL. When GPS is jammed these
// collapse to 0 on many aircraft in the same area at once (the method behind gpsjam.org); readsb
// also reports `gpsOkBefore` when an aircraft just lost GPS. Spoofing instead gives a wrong but
// "healthy" position: it shows as impossible jumps, a GPS altitude far from the barometric one,
// or several aircraft reporting the very same spot.
export const GNSS_THRESHOLDS = Object.freeze({ degradedNic: 6, degradedNacP: 7, jamRatio: 0.5, jamMin: 3, degradedRatio: 0.25, degradedMin: 2, minAircraft: 3, jumpM: 3000, jumpSpeedMs: 350, altDiffFt: 2500, clusterM: 300, clusterMin: 3 });

/** Whether this track's position comes from its own GPS via ADS-B (not MLAT / TIS-B / a drone). */
const gpsBased = (tr) => tr.kind === 'aircraft' && !tr.onGround && (!tr.adsbType || /^adsb|^adsr/.test(tr.adsbType)) && (Number.isFinite(tr.nic) || Number.isFinite(tr.nacP) || Number.isFinite(tr.gpsOkBefore));

/** Navigation integrity of one aircraft: { status: 'ok' | 'degraded' | 'lost' | 'unknown', text }. */
export function navIntegrity(tr) {
  if (!gpsBased(tr)) return { status: 'unknown', text: 'no integrity data' };
  const parts = [Number.isFinite(tr.nic) ? `NIC ${tr.nic}` : null, Number.isFinite(tr.nacP) ? `NACp ${tr.nacP}` : null, Number.isFinite(tr.sil) ? `SIL ${tr.sil}` : null].filter(Boolean).join(' · ');
  if (Number.isFinite(tr.gpsOkBefore) || tr.nic === 0 || tr.nacP === 0) return { status: 'lost', text: `GPS lost (${parts || 'gpsOkBefore'})` };
  if ((Number.isFinite(tr.nic) && tr.nic <= GNSS_THRESHOLDS.degradedNic) || (Number.isFinite(tr.nacP) && tr.nacP <= GNSS_THRESHOLDS.degradedNacP)) return { status: 'degraded', text: `GPS degraded (${parts})` };
  return { status: 'ok', text: `GPS OK (${parts})` };
}

/**
 * GPS picture over a set of aircraft.
 * @returns {{ level: 'unknown' | 'ok' | 'degraded' | 'jamming', bad, total, ratio, centre, radiusM, hexes }}
 */
export function gnssArea(tracks, site) {
  const T = GNSS_THRESHOLDS;
  const rated = tracks.filter((t) => navIntegrity(t).status !== 'unknown');
  const bad = rated.filter((t) => ['lost', 'degraded'].includes(navIntegrity(t).status));
  const total = rated.length;
  const ratio = total ? bad.length / total : 0;
  let level = 'unknown';
  if (total >= T.minAircraft || bad.length >= T.jamMin) level = ratio >= T.jamRatio && bad.length >= T.jamMin ? 'jamming' : ratio >= T.degradedRatio && bad.length >= T.degradedMin ? 'degraded' : 'ok';
  let centre = null;
  let radiusM = 0;
  if (bad.length && site) {
    const pts = bad.filter((t) => Number.isFinite(t.lat)).map((t) => toLocal(site, t));
    const e = pts.reduce((s, p) => s + p.e, 0) / pts.length;
    const n = pts.reduce((s, p) => s + p.n, 0) / pts.length;
    centre = fromLocal(site, e, n);
    radiusM = Math.round(Math.max(3000, ...pts.map((p) => Math.hypot(p.e - e, p.n - n))) + 2000);
  }
  return { level, bad: bad.length, total, ratio: Math.round(ratio * 100) / 100, centre, radiusM, hexes: bad.map((t) => t.hex) };
}

/** Signs of a spoofed position for one aircraft, given its history ([{ t, lat, lon }]). @returns {string | null} */
export function spoofSign(tr, history = []) {
  const T = GNSS_THRESHOLDS;
  if (tr.kind !== 'aircraft' || tr.onGround || !Number.isFinite(tr.lat)) return null;
  const prev = history.length >= 2 ? history.at(-2) : null;
  const last = history.at(-1);
  if (prev && last && last.t > prev.t) {
    const d = toLocal(prev, last);
    const m = Math.hypot(d.e, d.n);
    const dt = (last.t - prev.t) / 1000;
    if (m >= T.jumpM && m / dt > Math.max(T.jumpSpeedMs, (tr.speedKt ?? 0) * KT * 2)) return `position jumped ${(m / 1000).toFixed(1)} km in ${Math.round(dt)} s`;
  }
  if (Number.isFinite(tr.altGeomFt) && Number.isFinite(tr.altitudeFt) && Math.abs(tr.altGeomFt - tr.altitudeFt) >= T.altDiffFt) return `GPS altitude ${tr.altGeomFt.toLocaleString('en-US')} ft vs barometric ${tr.altitudeFt.toLocaleString('en-US')} ft`;
  return null;
}

/** Groups of ≥ 3 aircraft reporting (almost) the same position at different altitudes: a spoofed fix. */
export function sameSpotClusters(tracks) {
  const T = GNSS_THRESHOLDS;
  const air = tracks.filter((t) => t.kind === 'aircraft' && !t.onGround && Number.isFinite(t.lat));
  const used = new Set();
  const out = [];
  for (const a of air) {
    if (used.has(a.hex)) continue;
    const near = air.filter((b) => {
      const d = toLocal(a, b);
      return Math.hypot(d.e, d.n) <= T.clusterM;
    });
    const alts = near.map((b) => b.altitudeFt).filter(Number.isFinite);
    if (near.length >= T.clusterMin && Math.max(...alts) - Math.min(...alts) >= 2000) {
      near.forEach((b) => used.add(b.hex));
      out.push({ lat: a.lat, lon: a.lon, hexes: near.map((b) => b.hex) });
    }
  }
  return out;
}

// ---------------------------------------------------------------- loitering
/** Degrees turned within the last `windowMs` of a track history ([{ t, track }]). */
export function turnWithin(history, windowMs = 360_000) {
  if (!history?.length) return 0;
  const from = history.at(-1).t - windowMs;
  let sum = 0;
  let prev = null;
  for (const h of history) {
    if (h.t < from || !Number.isFinite(h.track)) continue;
    if (prev !== null) sum += angleDiff(h.track, prev);
    prev = h.track;
  }
  return sum;
}

// ---------------------------------------------------------------- classification
/**
 * @param tr       normalized track ({ kind, hex, callsign, lat, lon, altitudeFt, speedKt, track, verticalRateFpm, distanceM, squawk, onGround })
 * @param ctx      { cfg, site, history }
 * @returns { level, reason, zone, restricted, timeToZoneSec, projection, loitering, expected, emergencyInfo, corridor }
 */
export function classifyTrack(tr, { cfg, site, history = [] }) {
  const zone = zoneOf(tr.distanceM, cfg);
  if (tr.kind === 'drone') {
    const crit = cfg.droneCriticalRadiusM ?? 1000;
    const hasPos = Number.isFinite(tr.distanceM);
    const pred = hasPos ? predictTrack(tr, cfg, site, { inside: (d) => d <= crit }) : { path: [], timeToZoneSec: null };
    const insider = tr.pilot?.inside === true;
    const level = insider ? Level.CRITICAL : !hasPos ? Level.HIGH : tr.distanceM <= crit ? Level.CRITICAL : tr.distanceM <= crit * 2 ? Level.HIGH : Level.WARNING;
    const reason = insider
      ? 'Pilot INSIDE the site boundary — insider risk'
      : !hasPos ? 'Drone detected — position not broadcast' : level === Level.CRITICAL ? (tr.distanceM <= 300 ? 'Drone over the site' : 'Drone inside the site perimeter') : level === Level.HIGH ? 'Drone approaching the site' : 'Drone in range';
    return { level, reason, zone, restricted: hasPos && tr.distanceM <= crit, timeToZoneSec: pred.timeToZoneSec, projection: pred.path, loitering: false, expected: null, emergencyInfo: null, corridor: null, nav: { status: 'unknown', text: 'not applicable' }, spoof: null };
  }
  const nav = navIntegrity(tr);
  const spoof = spoofSign(tr, history);
  const emergencyInfo = emergencyOf(tr);
  const restricted = inRestrictedAirspace(tr, cfg);
  const pred = predictTrack(tr, cfg, site);
  const loitering = !tr.onGround && zone !== 'monitor' && zone !== 'outside' && turnWithin(history) >= 300;
  const corridor = tr.onGround ? null : corridorMatch(tr, cfg.corridors);
  const expected = !emergencyInfo && corridor?.ok && tr.callsign && !loitering ? corridor : null;
  let level = Level.NORMAL;
  let reason = zone === 'outside' ? 'Outside the monitored area' : 'Normal traffic';
  if (emergencyInfo) {
    level = Level.CRITICAL;
    reason = `Squawk ${emergencyInfo.code}: ${emergencyInfo.en}`;
  } else if (tr.onGround) {
    reason = 'On the ground';
  } else if (spoof) {
    level = Level.HIGH;
    reason = `Possible GPS spoofing: ${spoof}`;
  } else if (expected) {
    level = Level.EXPECTED;
    reason = `Expected – ${expected.airport} traffic, ${expected.why}`;
  } else if (restricted) {
    level = Level.HIGH;
    reason = 'Inside the restricted airspace';
  } else if (loitering) {
    level = Level.WARNING;
    reason = `Circling ${(tr.distanceM / 1000).toFixed(1)} km from the site`;
  } else if ((zone === 'warning' || zone === 'restricted') && pred.timeToZoneSec !== null) {
    level = Level.WARNING;
    reason = `Will enter the restricted airspace in ${fmtMinSec(pred.timeToZoneSec)}`;
  } else if (nav.status === 'lost') {
    level = Level.WARNING;
    reason = `${nav.text} — position may be inaccurate (jamming?)`;
  } else if (corridor && !corridor.ok) {
    reason = `In the ${corridor.name} corridor but ${corridor.why}${tr.callsign ? '' : ' (no callsign)'}`;
  } else if (corridor?.ok && !tr.callsign) {
    reason = `In the ${corridor.name} corridor without a callsign`;
  }
  return { level, reason, zone, restricted, timeToZoneSec: pred.timeToZoneSec, projection: pred.path, loitering, expected, emergencyInfo, corridor, nav, spoof };
}

export const feetFromMetres = (m) => m * FT;
export const KNOT = KT;
