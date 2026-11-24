// Site-wide alerting policy.
//   monitor:    general airspace monitoring — unknown devices get a visual notice only.
//   checkpoint: sensor at the entrance of a sensitive area — only authorized devices may pass,
//               so any unknown device inside the gate zone raises an alert (warning tone).
// In every mode the high-priority siren is reserved for verified unauthorized devices.
//
// Phones transmit Bluetooth far weaker than Wi-Fi, so the same distance gives a lower BLE
// reading: the gate zone has a separate threshold per protocol (calibrate both on site).

export const SiteMode = Object.freeze({ MONITOR: 'monitor', CHECKPOINT: 'checkpoint' });
export const UnknownAlert = Object.freeze({ SOUND: 'sound', VISUAL: 'visual' });

export const DEFAULT_SITE_POLICY = Object.freeze({
  mode: SiteMode.MONITOR,
  zoneRssi: -65, // Wi-Fi: gate zone ≈ 1–5 m from the sensor
  zoneRssiBle: -72, // Bluetooth: same distance reads weaker
  confirmReadings: 2, // readings inside the zone before alerting (filters one-off spikes)
  unknownAlert: UnknownAlert.SOUND,
  includeRandomized: true, // visitors' phones usually use randomized addresses
});

const zone = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n <= -30 && n >= -95 ? Math.round(n) : fallback;
};

export function sanitizeSitePolicy(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Site policy must be an object');
  const confirm = Number(input.confirmReadings);
  return {
    mode: Object.values(SiteMode).includes(input.mode) ? input.mode : DEFAULT_SITE_POLICY.mode,
    zoneRssi: zone(input.zoneRssi, DEFAULT_SITE_POLICY.zoneRssi),
    zoneRssiBle: zone(input.zoneRssiBle, DEFAULT_SITE_POLICY.zoneRssiBle),
    confirmReadings: Number.isInteger(confirm) && confirm >= 1 && confirm <= 3 ? confirm : DEFAULT_SITE_POLICY.confirmReadings,
    unknownAlert: Object.values(UnknownAlert).includes(input.unknownAlert) ? input.unknownAlert : DEFAULT_SITE_POLICY.unknownAlert,
    includeRandomized: input.includeRandomized !== false,
  };
}

/** Gate-zone threshold for a protocol ('Wi-Fi' | 'BLE'). */
export const zoneFor = (protocol, policy) => (protocol === 'BLE' ? policy.zoneRssiBle : policy.zoneRssi);

/** Whether a reading puts the device inside the checkpoint zone. */
export const inZone = (rssi, policy, protocol) => Number.isFinite(rssi) && rssi >= zoneFor(protocol, policy);
