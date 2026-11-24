// Best-effort device type / OS family inference from passively observed metadata.
// Every result carries a confidence (a percentage computed from all the evidence, plus the
// high / medium / low label used by rules) and the evidence it was based on. OS *versions* are
// not broadcast over Wi-Fi or BLE, so only the OS family is ever inferred.

export const DeviceType = Object.freeze({
  PHONE: 'phone',
  TABLET: 'tablet',
  COMPUTER: 'computer',
  WATCH: 'watch',
  WEARABLE: 'wearable',
  AUDIO: 'audio',
  TRACKER: 'tracker',
  TV: 'tv',
  ROUTER: 'router',
  IOT: 'iot',
  ACCESSORY: 'accessory',
  DRONE: 'drone',
  CAMERA: 'camera',
  GLASSES: 'glasses',
  HOTSPOT: 'hotspot',
  ATTACK_TOOL: 'attacktool',
  DEV_BOARD: 'devboard',
  MEDICAL: 'medical',
  VEHICLE: 'vehicle',
  LOCK: 'lock',
  PAYMENT: 'payment',
  UNKNOWN: 'unknown',
});

export const TYPE_LABEL = {
  phone: 'Phone',
  tablet: 'Tablet',
  computer: 'Computer',
  watch: 'Smartwatch',
  wearable: 'Wearable / fitness',
  audio: 'Audio (earbuds, speaker)',
  tracker: 'Tracker tag',
  tv: 'TV / media',
  router: 'Router / access point',
  iot: 'Smart home / IoT',
  accessory: 'Accessory (keyboard, mouse…)',
  drone: 'Drone / drone controller',
  camera: 'Camera (IP, body, action)',
  glasses: 'Smart glasses',
  hotspot: 'Hotspot / mobile router',
  attacktool: 'Hacking tool',
  devboard: 'Dev board (ESP, Raspberry Pi…)',
  medical: 'Medical device',
  vehicle: 'Vehicle / e-scooter',
  lock: 'Smart lock',
  payment: 'Payment terminal',
  unknown: 'Unknown',
};

/** Categories that matter for security decisions. */
export const SENSITIVE_TYPES = Object.freeze({
  attacktool: 'Hacking tools are never allowed inside — confiscate and report.',
  drone: 'Drones and their controllers are not allowed beyond the gate.',
  camera: 'Cameras record restricted areas.',
  glasses: 'Smart glasses can record video unnoticed.',
  hotspot: 'A personal hotspot can move data out of the building.',
  medical: 'Medical devices are never confiscated or blocked automatically — confirm with the person.',
});

// Weight of one piece of evidence by its strength.
export const EVIDENCE_WEIGHT = { high: 0.9, medium: 0.65, low: 0.35 };

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };

const COMPANY = { MICROSOFT: 0x0006, APPLE: 0x004c, SAMSUNG: 0x0075, GOOGLE: 0x00e0 };

// Microsoft Connected Devices Platform beacon (MS-CDP): low 5 bits of byte 3 = device type.
const CDP_DEVICE = {
  1: ['tv', 'Xbox', 'Xbox One'],
  6: ['phone', 'iOS', 'iPhone'],
  7: ['tablet', 'iPadOS', 'iPad'],
  8: ['phone', 'Android', 'Android device'],
  9: ['computer', 'Windows', 'Windows desktop'],
  11: ['phone', 'Windows', 'Windows phone'],
  12: ['computer', 'Linux', 'Linux device'],
  13: ['iot', 'Windows IoT', 'Windows IoT device'],
  14: ['computer', 'Windows', 'Surface Hub'],
  15: ['computer', 'Windows', 'Windows laptop'],
  16: ['tablet', 'Windows', 'Windows tablet'],
};

// Apple Continuity message type = first byte after the company ID.
const APPLE_CONTINUITY = {
  0x03: ['iot', 'medium', 'AirPrint printer'],
  0x05: [null, 'low', 'AirDrop (iPhone, iPad or Mac)'],
  0x06: ['iot', 'medium', 'HomeKit accessory'],
  0x07: ['audio', 'high', 'AirPods / Beats'],
  0x09: ['tv', 'medium', 'AirPlay target (Apple TV, HomePod)'],
  0x0b: ['watch', 'medium', 'Apple Watch'],
  0x0c: [null, 'low', 'Handoff (iPhone, iPad or Mac)'],
  0x0e: ['phone', 'medium', 'Instant Hotspot source (iPhone / cellular iPad)'],
  0x0f: [null, 'low', 'Nearby Action (iPhone, iPad or Mac)'],
  0x10: [null, 'low', 'Nearby Info (iPhone, iPad, Mac or Watch)'],
  0x12: ['tracker', 'medium', 'Find My (AirTag or separated Apple device)'],
};

// These broadcasts establish that an Apple device is nearby, but the category is deliberately
// not broadcast. Keep this separate from a device type so it cannot trigger phone rules.
const APPLE_FAMILY = Object.freeze({ name: 'Apple', label: 'Apple device — category not broadcast' });

// Proximity-pairing model IDs (bytes 5–6 of the manufacturer data).
const APPLE_AUDIO_MODEL = {
  '0220': 'AirPods (1st gen)',
  '0f20': 'AirPods (2nd gen)',
  '1320': 'AirPods (3rd gen)',
  '0e20': 'AirPods Pro',
  '1420': 'AirPods Pro (2nd gen)',
  '0a20': 'AirPods Max',
  '0320': 'Powerbeats3',
  '0b20': 'Powerbeats Pro',
  '0520': 'BeatsX',
  '0620': 'Beats Solo3',
  '0920': 'Beats Studio3',
  '0c20': 'Beats Solo Pro',
  '1020': 'Beats Flex',
  '1120': 'Beats Studio Buds',
};

// BLE GAP appearance: category = value >> 6 (Bluetooth Assigned Numbers §2.6).
const APPEARANCE_CATEGORY = {
  1: 'phone',
  2: 'computer',
  3: 'watch',
  5: 'tv',
  6: 'accessory',
  8: 'tracker',
  9: 'tracker',
  10: 'audio',
  13: 'wearable',
  15: 'accessory',
  17: 'wearable',
  18: 'wearable',
  12: 'medical', // thermometer
  14: 'medical', // blood pressure
  16: 'medical', // glucose meter
  37: 'audio',
  49: 'medical', // pulse oximeter
  53: 'medical', // insulin pump
  54: 'medical', // medication delivery
  81: 'wearable',
};
const APPEARANCE_TABLET = 0x0087;

// Name / hostname patterns, checked in order. [regex, type, os, confidence]
const NAME_RULES = [
  [/flipper|pineapple|deauth|marauder|wifi ?nugget|hak5|bash ?bunny|\bo\.?mg\b|rubber ?ducky|pwnagotchi|esp32 ?marauder/i, 'attacktool', null, 'high'],
  [/dexcom|libre|freestyle|omnipod|medtronic|minimed|t:slim|tandem|phonak|oticon|resound|signia|widex|starkey|hearing ?aid|insulin|glucose|accu-?chek|contour ?next/i, 'medical', null, 'high'],
  [/ray-?ban|\brb ?meta\b|spectacles|meta ?(smart )?glasses|smart ?glasses|xreal|rokid/i, 'glasses', null, 'high'],
  [/tello|\bdji\b|mavic|phantom|\bspark-|anafi|bebop|skydio|autel|\bfpv\b|drone|\bavata\b|mini ?[234] ?(pro)?$/i, 'drone', null, 'high'],
  [/\bcam\b|camera|ipcam|ip-cam|hikvision|dahua|reolink|wyze|arlo|eufy|\bblink\b|gopro|insta360|dash ?cam|ezviz|imou|tapo ?c\d/i, 'camera', null, 'medium'],
  [/mifi|jetpack|hotspot|\bmf\d{3}|\be5\d{3}|nighthawk ?m|\b[45]g ?router/i, 'hotspot', null, 'medium'],
  [/tesla|carplay|android ?auto|\bbmw\b|mercedes|toyota|hyundai|\bkia\b|lexus|nissan|\bford\b|chevrolet|\bobd|vgate|elm327|car ?kit|ninebot|segway|scooter/i, 'vehicle', null, 'medium'],
  [/nuki|\baugust\b|\byale\b|lockly|ultraloq|smart ?lock|igloohome/i, 'lock', null, 'medium'],
  [/sumup|square ?reader|verifone|ingenico|\bpax\b|geidea|zettle|clover|\bpos\b/i, 'payment', null, 'medium'],
  [/arduino|raspberry|\brpi\b|nrf52|micro:?bit|esp8266/i, 'devboard', null, 'medium'],
  [/\biphone\b/i, 'phone', 'iOS', 'high'],
  [/\bipad\b/i, 'tablet', 'iPadOS', 'high'],
  [/apple ?watch/i, 'watch', 'watchOS', 'high'],
  [/airpods|\bbeats\b/i, 'audio', null, 'high'],
  [/macbook|\bimac\b|mac-?mini|mac ?studio|mac ?pro/i, 'computer', 'macOS', 'high'],
  [/galaxy ?tab/i, 'tablet', 'Android', 'high'],
  [/galaxy ?watch/i, 'watch', 'Wear OS', 'high'],
  [/galaxy ?buds|\bbuds\b/i, 'audio', null, 'high'],
  [/galaxy|\bsm-[a-z]\d{3}/i, 'phone', 'Android', 'high'],
  [/pixel ?watch/i, 'watch', 'Wear OS', 'high'],
  [/pixel ?buds/i, 'audio', null, 'high'],
  [/\bpixel\b/i, 'phone', 'Android', 'high'],
  [/^android[-_]/i, 'phone', 'Android', 'medium'],
  [/redmi|xiaomi|\bpoco\b|oneplus|\boppo\b|\bvivo\b|realme|huawei[- ]?(p\d|mate|nova)|\bhonor\b|motorola|moto ?g/i, 'phone', 'Android', 'medium'],
  [/\bband\b|mi ?band|amazfit|fitbit|whoop|\bfit\b/i, 'wearable', null, 'high'],
  [/\bwatch|\bgt ?\d\b/i, 'watch', null, 'medium'],
  [/^(desktop|laptop)-[a-z0-9]+/i, 'computer', 'Windows', 'high'],
  [/\[tv\]|\bbravia\b|\broku\b|chromecast|fire ?tv|android ?tv|webos|\btv\b/i, 'tv', null, 'medium'],
  [/airtag|smarttag|\btile\b/i, 'tracker', null, 'high'],
  [/\bjbl\b|\bbose\b|soundcore|headphone|earbud|speaker|\bwh-|\bwf-|^le-/i, 'audio', null, 'medium'],
  [/keyboard|mouse|\bmx\b|controller|gamepad/i, 'accessory', null, 'medium'],
  [/printer|\bhp\b|epson|canon|brother/i, 'iot', null, 'medium'],
  [/esp32|esp-|shelly|tasmota|tuya|sonoff|\bhue\b|\becho\b|alexa|\bnest\b|\bring\b/i, 'iot', null, 'medium'],
];

// Vendor (IEEE OUI) heuristics for Wi-Fi stations with a stable MAC.
const VENDOR_RULES = [
  [/hak5/i, 'attacktool', null],
  [/sz dji|\bdji\b|parrot|skydio|autel robotics/i, 'drone', null],
  [/hikvision|dahua|axis communications|reolink|ezviz|amcrest|wyze|arlo|uniview|hanwha/i, 'camera', null],
  [/raspberry pi/i, 'devboard', null],
  [/apple/i, 'phone', 'Apple (iOS/iPadOS/macOS)'],
  [/samsung|xiaomi|oppo|vivo|oneplus|huawei device|honor|motorola|realme|google/i, 'phone', 'Android'],
  [/intel|realtek|azurewave|liteon|lite-on|hon hai|foxconn|rivet|killer|dell|lenovo|hewlett|\bhp\b|asustek|micro-star|chicony/i, 'computer', null],
  [/espressif|tuya|shelly|amazon|sonos|signify|philips lighting|nest/i, 'iot', null],
  [/tp-link|huawei technologies|netgear|ubiquiti|cisco|aruba|tenda|d-link|zte|mikrotik|linksys/i, 'router', null],
];

// Bluetooth SIG company names (resolved by the server) that reveal the category.
const COMPANY_RULES = [
  [/dexcom|medtronic|abbott|insulet|tandem diabetes|sonova|demant|gn hearing|ws audiology|starkey|widex|roche diabetes/i, 'medical', 'high'],
  [/meta platforms|facebook technologies|snap inc/i, 'glasses', 'low'],
  [/\bdji\b|parrot/i, 'drone', 'high'],
  [/tesla|bmw|mercedes|toyota|hyundai|volkswagen|general motors|ford motor/i, 'vehicle', 'medium'],
  [/flipper devices/i, 'attacktool', 'high'],
];

// Names of networks broadcast by access points: most are routers, some reveal something else.
const AP_RULES = [
  [/pineapple|deauth|marauder|evil ?twin/i, 'attacktool', null, 'high', 'network name of a known attack tool'],
  [/tello|\bdji\b|mavic|spark-|anafi|bebop|skydio|autel|drone|\bfpv\b/i, 'drone', null, 'high', 'drone Wi-Fi network'],
  [/iphone|ipad/i, 'hotspot', 'iOS', 'high', 'personal hotspot of an Apple device'],
  [/androidap|galaxy|redmi|xiaomi|pixel|oneplus|huawei|honor|oppo|vivo|realme/i, 'hotspot', 'Android', 'medium', 'personal hotspot of an Android phone'],
  // Not plain "-5G": dual-band home routers use that suffix for their 5 GHz network.
  [/mifi|jetpack|\bmf\d{3}|\be5\d{3}|nighthawk ?m|\b(zain|mobily|stc|virgin|lebara)[ _-]?(4g|5g|lte|mifi)|\blte\b|[45]g[ _-]?(router|mifi|cpe)/i, 'hotspot', null, 'medium', 'mobile router'],
  [/\bcam\b|camera|ipcam|gopro|insta360|dashcam|ezviz|imou|reolink|wyze|tapo_c/i, 'camera', null, 'medium', 'camera Wi-Fi network'],
  [/^esp[_-]|^esp32|^esp8266|raspberry/i, 'devboard', null, 'medium', 'development board access point'],
];

const hexByte = (hex, i) => (hex && hex.length >= (i + 1) * 2 ? parseInt(hex.slice(i * 2, i * 2 + 2), 16) : null);

/**
 * @param d    tracked device (protocol, source, name, vendor, mfr, md, appearance, stableIdentifier)
 * @param host optional LAN info { hostname, ttl } for this device's MAC
 * @returns {{ type, os, model, family, familyLabel, confidence, evidence: string[] }}
 */
export function inferDeviceType(d, host = null) {
  const candidates = [];
  const add = (type, os, confidence, evidence, model = null, family = null) => candidates.push({ type, os, confidence, evidence, model, family });

  if (d.remoteId) add('drone', null, 'high', `drone Remote ID broadcast${d.remoteId.uasId ? ` (${d.remoteId.uasId})` : ''}`, d.remoteId.uaType ?? null);
  if (d.source === 'ap') {
    const rule = d.name ? AP_RULES.find(([re]) => re.test(d.name)) : null;
    if (rule) add(rule[1], rule[2], rule[3], `${rule[4]} “${d.name}”`);
    else add('router', null, 'high', 'broadcasts a Wi-Fi network');
  }
  if (d.mfrName) {
    const rule = COMPANY_RULES.find(([re]) => re.test(d.mfrName));
    if (rule) add(rule[1], null, rule[2], `Bluetooth company ${d.mfrName}`);
  }
  if (host?.os) add('computer', host.os, 'high', 'this PC (reported by its own OS)');

  // Manufacturer-specific BLE payloads.
  if (d.mfr === COMPANY.MICROSOFT && hexByte(d.md, 2) === 0x01) {
    const entry = CDP_DEVICE[hexByte(d.md, 3) & 0x1f];
    if (entry) add(entry[0], entry[1], 'high', `Microsoft CDP beacon: ${entry[2]}`, entry[2]);
  } else if (d.mfr === COMPANY.MICROSOFT && hexByte(d.md, 2) === 0x03) {
    add('accessory', null, 'high', 'Microsoft Swift Pair (accessory in pairing mode)');
  }
  if (d.mfr === COMPANY.APPLE) {
    const kind = hexByte(d.md, 2);
    const entry = APPLE_CONTINUITY[kind];
    if (entry) {
      // Name the specific audio model when known; otherwise describe what the message implies.
      const model = (kind === 0x07 ? APPLE_AUDIO_MODEL[d.md?.slice(10, 14)] : null) ?? entry[2];
      if (entry[0] === null) {
        add('unknown', null, entry[1], `Apple Continuity: ${entry[2]}`, null, APPLE_FAMILY);
      } else {
        const os = entry[0] === 'phone' ? 'iOS (likely)' : entry[0] === 'watch' ? 'watchOS' : null;
        add(entry[0], os, entry[1], `Apple Continuity: ${entry[2]}`, model);
      }
    } else {
      add('unknown', 'Apple', 'low', 'Apple BLE advertisement');
    }
  }
  if (d.mfr === COMPANY.SAMSUNG) add('unknown', 'Android / Tizen (Samsung)', 'low', 'Samsung BLE advertisement');

  // Standard BLE appearance.
  if (Number.isInteger(d.appearance) && d.appearance > 0) {
    const type = d.appearance === APPEARANCE_TABLET ? 'tablet' : APPEARANCE_CATEGORY[d.appearance >> 6];
    if (type) add(type, null, 'high', `BLE appearance 0x${d.appearance.toString(16).padStart(4, '0')}`);
  }

  // Advertised names and router hostnames.
  for (const [label, value] of [['name', d.name], ['hostname', host?.hostname]]) {
    if (!value || d.source === 'ap') continue;
    const rule = NAME_RULES.find(([re]) => re.test(value));
    if (rule) add(rule[1], rule[2], rule[3], `${label} “${value}”`);
  }

  // OUI vendor of a stable Wi-Fi MAC.
  if (d.protocol === 'Wi-Fi' && d.source !== 'ap' && d.stableIdentifier && d.vendor) {
    const rule = VENDOR_RULES.find(([re]) => re.test(d.vendor));
    if (rule) add(rule[1], rule[2], 'low', `vendor ${d.vendor}`);
  }

  // Randomized Wi-Fi stations are overwhelmingly modern phones (iOS 14+ / Android 10+).
  if (d.protocol === 'Wi-Fi' && d.source !== 'ap' && !d.stableIdentifier) {
    add('phone', null, 'low', 'randomized Wi-Fi MAC (default on modern phones)');
  }

  // Ping TTL from this PC's network: 128 = Windows, 64 = Linux/Android/Apple, 255 = network gear.
  if (Number.isInteger(host?.ttl)) {
    if (host.ttl > 64 && host.ttl <= 128) add('unknown', 'Windows', 'medium', `ping TTL ${host.ttl}`);
    else if (host.ttl <= 64) add('unknown', 'Linux / Android / Apple', 'low', `ping TTL ${host.ttl}`);
    else add('router', null, 'low', `ping TTL ${host.ttl}`);
  }

  if (!candidates.length) return { type: 'unknown', os: null, model: null, family: null, familyLabel: null, familyScore: 0, familyEvidence: null, confidence: null, typeScore: 0, osScore: 0, evidence: [], evidenceDetail: [] };

  const byConfidence = [...candidates].sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]);
  const type = pickType(candidates);
  const withOs = byConfidence.find((c) => c.os);
  const familyCandidate = byConfidence.find((c) => c.family);
  const family = familyCandidate?.family?.name ?? null;
  const typeScore = type === 'unknown' ? 0 : score(candidates, (c) => c.type === type, (c) => c.type !== 'unknown' && c.type !== type);
  const os = refineOs(type, withOs?.os ?? null);
  const osScore = os ? score(candidates.filter((c) => c.os), (c) => familyOf(c.os) === familyOf(withOs.os), (c) => familyOf(c.os) !== familyOf(withOs.os)) : 0;
  const familyScore = family ? score(candidates, (c) => c.family?.name === family, () => false) : 0;
  return {
    type,
    os,
    model: byConfidence.find((c) => c.model && (c.type === type || c.type === 'unknown'))?.model ?? null,
    family,
    familyLabel: familyCandidate?.family?.label ?? null,
    familyScore,
    familyEvidence: familyCandidate?.evidence ?? null,
    confidence: type === 'unknown' ? null : labelOf(typeScore),
    typeScore,
    osScore,
    evidence: byConfidence.map((c) => c.evidence),
    evidenceDetail: byConfidence.map((c) => ({
      text: c.evidence,
      weight: Math.round(EVIDENCE_WEIGHT[c.confidence] * 100),
      supports: c.type === type && type !== 'unknown' ? 'type' : c.family ? 'family' : c.type === 'unknown' ? (c.os ? 'os' : 'none') : 'other',
      type: c.type,
    })),
  };
}

/**
 * Type with the most combined support. Independent pieces of evidence combine as
 * 1 − Π(1 − w): two medium clues (0.65 each) beat one low one, one high clue (0.9) beats two
 * low ones (0.58).
 */
function pickType(candidates) {
  const support = new Map();
  for (const c of candidates) {
    if (c.type === 'unknown') continue;
    support.set(c.type, 1 - (1 - (support.get(c.type) ?? 0)) * (1 - EVIDENCE_WEIGHT[c.confidence]));
  }
  let best = 'unknown';
  let bestScore = 0;
  for (const [type, value] of support) {
    if (value > bestScore) {
      best = type;
      bestScore = value;
    }
  }
  return best;
}

/** Combined support for the chosen answer, reduced by each contradicting clue. Returns 0–100. */
function score(candidates, supports, contradicts) {
  let p = 0;
  for (const c of candidates) if (supports(c)) p = 1 - (1 - p) * (1 - EVIDENCE_WEIGHT[c.confidence]);
  for (const c of candidates) if (contradicts(c)) p *= 1 - 0.5 * EVIDENCE_WEIGHT[c.confidence];
  return Math.round(p * 100);
}

export const labelOf = (pct) => (pct >= 80 ? 'high' : pct >= 55 ? 'medium' : pct > 0 ? 'low' : null);
const familyOf = (os) => osFamily(os);

// A generic OS hint becomes specific once the device type is known.
function refineOs(type, os) {
  if (type === 'router' && os === 'Linux / Android / Apple') return 'Linux-based firmware';
  if (!os || !/^Apple/.test(os)) return os;
  return { phone: 'iOS', tablet: 'iPadOS', computer: 'macOS', watch: 'watchOS', tv: 'tvOS' }[type] ?? os;
}

/** OS filter buckets used by the UI. */
export function osFamily(os) {
  if (!os) return 'unknown';
  if (/iOS|iPadOS|watchOS|tvOS|macOS|Apple/.test(os)) return /macOS/.test(os) ? 'macos' : 'apple';
  if (/Android|Wear OS/.test(os)) return 'android';
  if (/Windows|Xbox/.test(os)) return 'windows';
  if (/Linux/.test(os)) return 'linux';
  return 'other';
}
