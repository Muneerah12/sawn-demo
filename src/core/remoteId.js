// Drone Remote ID decoder — ASTM F3411 / ASD-STAN prEN 4709-002 ("Open Drone ID") broadcast.
//
// Transports the ESP32 receives (firmware v0.6+ forwards the raw bytes as `rid` hex):
//   Bluetooth 4 legacy advertising: service data UUID 0xFFFA → [0x0D app code][counter][message 25 B]
//   Wi-Fi beacon:                    vendor element OUI FA:0B:BC type 0x0D → [counter][message pack]
// Every message is 25 bytes; the high nibble of byte 0 is the message type:
//   0 Basic ID · 1 Location/vector · 2 Authentication · 3 Self-ID · 4 System · 5 Operator ID · F pack
// DOM-free: used by the server (drone tracking, incidents) and testable in Node.

export const UA_TYPE = [
  'Undeclared', 'Aeroplane', 'Multirotor / helicopter', 'Gyroplane', 'Hybrid lift (VTOL)', 'Ornithopter', 'Glider', 'Kite',
  'Free balloon', 'Captive balloon', 'Airship', 'Parachute', 'Rocket', 'Tethered powered aircraft', 'Ground obstacle', 'Other',
];
export const ID_TYPE = ['None', 'Serial number (CTA-2063-A)', 'CAA registration', 'UTM UUID', 'Specific session ID'];
export const UA_STATUS = ['Undeclared', 'On the ground', 'Airborne', 'EMERGENCY', 'Remote ID failure'];

const MESSAGE = 25;

function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const v = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(v)) return null;
    out[i] = v;
  }
  return out;
}

const ascii = (b, from, len) =>
  String.fromCharCode(...b.slice(from, from + len))
    .replace(/\0.*$/s, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim();
const i32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >> 0;
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const coord = (v) => (v === 0 ? null : Math.round(v) / 1e7);
const altitude = (v) => (v === 0 ? null : Math.round((v * 0.5 - 1000) * 10) / 10);

function decodeMessage(b, o, out) {
  const type = b[o] >> 4;
  if (type === 0) {
    out.idType = ID_TYPE[b[o + 1] >> 4] ?? 'Reserved';
    out.uaType = UA_TYPE[b[o + 1] & 0x0f];
    const id = ascii(b, o + 2, 20);
    if (id) out.uasId = id;
  } else if (type === 1) {
    const flags = b[o + 1];
    out.status = UA_STATUS[flags >> 4] ?? 'Reserved';
    const ewDir = (flags >> 1) & 1;
    const speedMult = flags & 1;
    const dir = b[o + 2] + (ewDir ? 180 : 0);
    out.heading = dir <= 360 ? dir : null;
    const s = b[o + 3];
    out.speed = s === 255 ? null : Math.round((speedMult ? s * 0.75 + 255 * 0.25 : s * 0.25) * 10) / 10; // m/s
    const vs = (b[o + 4] << 24) >> 24;
    out.verticalSpeed = vs === 63 ? null : vs * 0.5; // m/s (int8, 0.5 resolution)
    out.lat = coord(i32(b, o + 5));
    out.lon = coord(i32(b, o + 9));
    out.altitudeBaro = altitude(u16(b, o + 13));
    out.altitudeGeo = altitude(u16(b, o + 15));
    out.height = altitude(u16(b, o + 17));
    out.heightRef = (flags >> 2) & 1 ? 'above ground' : 'above take-off';
  } else if (type === 3) {
    const text = ascii(b, o + 2, 23);
    if (text) out.description = text;
  } else if (type === 4) {
    out.operatorLat = coord(i32(b, o + 2));
    out.operatorLon = coord(i32(b, o + 6));
    out.operatorLocationType = ['Take-off position', 'Live GNSS', 'Fixed'][b[o + 1] & 0x03] ?? 'Reserved';
  } else if (type === 5) {
    const id = ascii(b, o + 2, 20);
    if (id) out.operatorId = id;
  } else if (type === 2) {
    out.authenticated = true; // authentication page present (not verified here)
  }
  out.messages.push(type);
}

function decodeAt(b, o, out) {
  if (o >= b.length) return;
  if (b[o] >> 4 === 0xf) {
    const size = b[o + 1];
    const count = b[o + 2];
    if (size !== MESSAGE || count > 9) return;
    for (let i = 0; i < count && o + 3 + (i + 1) * size <= b.length; i++) decodeMessage(b, o + 3 + i * size, out);
  } else if (o + MESSAGE <= b.length) {
    decodeMessage(b, o, out);
  }
}

/**
 * @param hex      payload from the sensor (`rid` field)
 * @param protocol 'BLE' | 'Wi-Fi'
 * @returns decoded fields, or null when the payload is not Remote ID
 */
export function decodeRemoteId(hex, protocol) {
  const b = hexToBytes(hex);
  if (!b || b.length < 3) return null;
  const out = { messages: [], transport: protocol === 'BLE' ? 'Bluetooth (legacy advertising)' : 'Wi-Fi beacon' };
  if (protocol === 'BLE') {
    if (b[0] !== 0x0d) return null;
    decodeAt(b, 2, out); // [app code][counter][message or pack]
  } else {
    decodeAt(b, 1, out); // [counter][message pack]
  }
  if (!out.messages.length) return null;
  return out;
}

/** Distance in metres between two WGS-84 points (haversine). */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------- test helper (encoder)
/** Builds Remote ID payloads (used by tests and the training simulator). */
export function encodeRemoteId({ uasId = 'SIM1581F5FKD229400A', uaType = 2, lat, lon, height = 60, speed = 4, heading = 90, status = 2, operatorLat, operatorLon, operatorId = 'SAU-OP-0001' }, protocol = 'Wi-Fi') {
  const msg = (type) => {
    const m = new Uint8Array(MESSAGE);
    m[0] = (type << 4) | 2;
    return m;
  };
  const put32 = (m, o, v) => {
    const x = Math.round(v * 1e7) | 0;
    m[o] = x & 0xff;
    m[o + 1] = (x >> 8) & 0xff;
    m[o + 2] = (x >> 16) & 0xff;
    m[o + 3] = (x >> 24) & 0xff;
  };
  const put16 = (m, o, v) => {
    m[o] = v & 0xff;
    m[o + 1] = (v >> 8) & 0xff;
  };
  const basic = msg(0);
  basic[1] = (1 << 4) | uaType;
  for (let i = 0; i < Math.min(20, uasId.length); i++) basic[2 + i] = uasId.charCodeAt(i);
  const loc = msg(1);
  loc[1] = (status << 4) | (heading >= 180 ? 2 : 0);
  loc[2] = heading >= 180 ? heading - 180 : heading;
  loc[3] = Math.round(speed / 0.25);
  put32(loc, 5, lat);
  put32(loc, 9, lon);
  put16(loc, 17, Math.round((height + 1000) / 0.5));
  const sys = msg(4);
  sys[1] = 1;
  put32(sys, 2, operatorLat ?? lat);
  put32(sys, 6, operatorLon ?? lon);
  const op = msg(5);
  for (let i = 0; i < Math.min(20, operatorId.length); i++) op[2 + i] = operatorId.charCodeAt(i);
  const hex = (arr) => [...arr].map((v) => v.toString(16).padStart(2, '0')).join('');
  if (protocol === 'BLE') return hex([0x0d, 0x01, ...loc]); // BT4 legacy carries one message per advertisement
  return hex([0x01, 0xf2, MESSAGE, 4, ...basic, ...loc, ...sys, ...op]);
}
