// Evidence strengths for each separate claim the system makes about a device. These are
// explainable heuristic scores, not calibrated probabilities and never a single verdict.
// Shown wherever a decision is made (device rows, radar, gate, incidents), so "likely a phone
// (35 %)" never looks the same as "phone (95 %)".
//
//   identity  — will this address mean the same device tomorrow? (stable vs. randomized)
//   distance  — signal consistency only, not a precise physical-distance claim
//   type / os — from the device-type inference (src/core/deviceType.js)

const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function identityConfidence(d) {
  if (d.stableIdentifier === false || d.randomized) {
    return { pct: 30, reason: 'Randomized address — the same device will appear under a new address later' };
  }
  if (d.protocol === 'BLE' && d.addressType === 'static') return { pct: 75, reason: 'Bluetooth static random address — stable until the device is reset' };
  if (d.stableIdentifier) return { pct: 95, reason: 'Stable (manufacturer-assigned) address' };
  return { pct: 50, reason: 'Address type not reported' };
}

/** Readings in the smoothing window and how much they vary (median absolute deviation). */
export function distanceConfidence(d) {
  const values = (d.samples ?? []).map((s) => s.v);
  if (!values.length) return { pct: Number.isFinite(d.rssi) ? 25 : 0, reason: Number.isFinite(d.rssi) ? 'One reading only' : 'No signal reading' };
  const m = median(values);
  const spread = median(values.map((v) => Math.abs(v - m)));
  const countFactor = Math.min(1, values.length / 5);
  const spreadFactor = Math.max(0.1, 1 - spread / 10);
  const pct = Math.round(100 * countFactor * spreadFactor * 0.95);
  return { pct, reason: `${values.length} reading${values.length > 1 ? 's' : ''} in 20 s, spread ±${spread.toFixed(1)} dB` };
}

/**
 * @param d    tracked device
 * @param kind inferDeviceType() result
 */
export function confidenceOf(d, kind) {
  const identity = identityConfidence(d);
  const distance = distanceConfidence(d);
  const family = kind?.family
    ? { pct: kind.familyScore ?? 0, reason: kind.familyEvidence ?? `${kind.family} family broadcast` }
    : null;
  const type = kind?.type === 'unknown' && family
    ? { pct: 0, reason: 'Category not broadcast' }
    : { pct: kind?.typeScore ?? 0, reason: kind?.evidence?.[0] ?? 'No identifying broadcast' };
  const os = { pct: kind?.osScore ?? 0, reason: kind?.os ? `Family ${kind.os} — versions are never broadcast` : family ? 'OS family not broadcast' : 'Operating system not identifiable' };
  return { identity, distance, family, type, os };
}

export const confidenceTone = (pct) => (pct >= 80 ? 'high' : pct >= 55 ? 'medium' : 'low');
