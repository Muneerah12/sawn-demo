import { RegistryStatus } from '../core/classifier.js';

// Demo fixtures live in their own registry so they can never affect live classification.
export const DEMO_SENSOR = 'DEMO-SENSOR-A';

export const DEMO_REGISTRY = Object.freeze({
  trustedSensors: [DEMO_SENSOR],
  devices: [
    { id: 'D0:E0:00:00:00:01', protocol: 'Wi-Fi', status: RegistryStatus.AUTHORIZED, label: 'Demo staff laptop', verifiedBy: 'demo-fixture' },
    { id: 'D0:E0:00:00:00:02', protocol: 'Wi-Fi', status: RegistryStatus.AUTHORIZED, label: 'Demo staff phone', verifiedBy: 'demo-fixture' },
    { id: 'D0:E0:00:00:00:03', protocol: 'BLE', status: RegistryStatus.AUTHORIZED, label: 'Demo staff smartwatch', verifiedBy: 'demo-fixture' },
    { id: 'D0:E0:00:00:00:04', protocol: 'Wi-Fi', status: RegistryStatus.AUTHORIZED, label: 'Demo contractor tablet', verifiedBy: 'demo-fixture' },
    {
      id: 'D0:E0:00:00:00:99',
      protocol: 'BLE',
      status: RegistryStatus.DENIED,
      reason: 'Simulated: revoked contractor BLE tag detected in restricted zone',
      verifiedBy: 'demo-fixture',
      verifiedAt: '2026-01-01',
    },
    {
      id: 'D0:E0:00:00:00:98',
      protocol: 'Wi-Fi',
      status: RegistryStatus.DENIED,
      reason: 'Simulated: personal phone banned after a data-leak incident',
      verifiedBy: 'demo-fixture',
      verifiedAt: '2026-01-01',
    },
    {
      id: 'D0:E0:00:00:00:97',
      protocol: 'Wi-Fi',
      status: RegistryStatus.DENIED,
      reason: 'Simulated: unregistered laptop seized at an earlier visit',
      verifiedBy: 'demo-fixture',
      verifiedAt: '2026-01-01',
    },
  ],
});

const observation = (id, protocol, rssi) => ({
  id,
  protocol,
  sensorId: DEMO_SENSOR,
  timestamp: Date.now(),
  rssi,
  addressType: 'public',
});

export const DEMO_SCENARIOS = Object.freeze({
  authorized: () => [observation('D0:E0:00:00:00:01', 'wifi', -48)],
  unknown: () => [observation('D0:E0:00:00:00:42', 'wifi', -71)],
  unauthorized: () => [observation('D0:E0:00:00:00:99', 'ble', -59)],
  // Same unauthorized device seen 6 times in ~2.5s: should alarm once, then fold into repeats.
  burst: () => Array.from({ length: 6 }, (_, i) => ({ ...observation('D0:E0:00:00:00:99', 'ble', -60 + i), delayMs: i * 500 })),
});

export function runDemoScenario(name, ingestDemo, { schedule = setTimeout } = {}) {
  const make = DEMO_SCENARIOS[name];
  if (!make) throw new Error(`Unknown demo scenario: ${name}`);
  for (const { delayMs = 0, ...obs } of make()) {
    schedule(() => ingestDemo({ ...obs, timestamp: Date.now() }), delayMs);
  }
}

// ---------------------------------------------------------------- training drill
// Visitors approaching the checkpoint, each carrying devices. Correct call: let them through only
// when every device they carry is authorized; stop them otherwise (unknown or unauthorized).
const AUTHORIZED = [
  { id: 'D0:E0:00:00:00:01', protocol: 'Wi-Fi', type: 'computer', label: 'Staff laptop' },
  { id: 'D0:E0:00:00:00:02', protocol: 'Wi-Fi', type: 'phone', label: 'Staff phone' },
  { id: 'D0:E0:00:00:00:03', protocol: 'BLE', type: 'watch', label: 'Staff smartwatch' },
  { id: 'D0:E0:00:00:00:04', protocol: 'Wi-Fi', type: 'tablet', label: 'Contractor tablet' },
];
const DENIED = [
  { id: 'D0:E0:00:00:00:99', protocol: 'BLE', type: 'tracker', label: 'Revoked BLE tag' },
  { id: 'D0:E0:00:00:00:98', protocol: 'Wi-Fi', type: 'phone', label: 'Banned phone' },
  { id: 'D0:E0:00:00:00:97', protocol: 'Wi-Fi', type: 'computer', label: 'Seized laptop' },
];
const UNKNOWN_TYPES = [
  ['phone', 'Wi-Fi', 'Unregistered phone'],
  ['computer', 'Wi-Fi', 'Personal laptop (PC)'],
  ['audio', 'BLE', 'Wireless earbuds'],
  ['watch', 'BLE', 'Smartwatch'],
  ['tablet', 'Wi-Fi', 'Tablet'],
];
const NAMES = ['Visitor A. Salem', 'Contractor R. Omar', 'Staff N. Khalid', 'Courier L. Hamad', 'Staff S. Faisal', 'Visitor M. Yousef', 'Engineer H. Nasser', 'Guest D. Ali', 'Staff J. Saad', 'Auditor K. Fahd'];

const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

/** A round of visitors. Unknown devices get fresh addresses so each round is new to the classifier. */
export function makeDrillRound(count = 8, rnd = Math.random) {
  const visitors = [];
  let unknownSeq = Math.floor(rnd() * 200);
  const unknown = () => {
    const [type, protocol, label] = pick(UNKNOWN_TYPES, rnd);
    unknownSeq = (unknownSeq + 1) % 256;
    const tail = unknownSeq.toString(16).padStart(2, '0').toUpperCase();
    // Never 00, so an unknown device can never collide with a fixture (D0:E0:00:00:00:xx).
    const mid = (1 + Math.floor(rnd() * 255)).toString(16).padStart(2, '0').toUpperCase();
    return { id: `D0:E0:00:00:${mid}:${tail}`, protocol, type, label };
  };
  for (let i = 0; i < count; i++) {
    const r = rnd();
    const kind = r < 0.45 ? 'clear' : r < 0.75 ? 'unknown' : 'denied';
    const devices = [pick(AUTHORIZED, rnd)];
    if (rnd() < 0.5) devices.push(pick(AUTHORIZED.filter((d) => d !== devices[0]), rnd));
    if (kind === 'unknown') devices.push(unknown());
    if (kind === 'denied') devices.push(pick(DENIED, rnd));
    visitors.push({ name: NAMES[(i + Math.floor(rnd() * NAMES.length)) % NAMES.length], devices: shuffle(devices, rnd), shouldStop: kind !== 'clear', kind });
  }
  return visitors;
}

function shuffle(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
