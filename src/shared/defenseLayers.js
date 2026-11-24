// Defense layers: SAWN's detections framed in the aerospace-security segment model.
//   🛰️ Space   الفضاء     satellites over the site (imaging exposure)
//   📡 Link    الوصلة     the radio links everything depends on: GPS, Wi-Fi (jamming, spoofing, deauth)
//   🏢 Ground  الأرضي     the site itself: devices, rogue access points, hacking tools, drones and
//                         aircraft over it, perimeter and screening, system health
//   👤 User    المستخدم   people: card identity, access levels, Gate A / Level 5 verification, insider risk
// RF bands are given only where they are real and simple: GPS = L-band, imaging-satellite
// downlink = X-band, everything the ESP32 sensor hears (Wi-Fi / Bluetooth LE) = 2.4 GHz.
// DOM-free: the incidents page, the threat list and the Defense layers panel all use it.
import { IncidentProvenance, incidentProvenance } from './incidentProvenance.js';

export const SEGMENTS = Object.freeze([
  { id: 'space', icon: '🛰️', ar: 'الفضاء', en: 'Space', desc: { ar: 'الأقمار الصناعية فوق المنشأة', en: 'Satellites over the site' } },
  { id: 'link', icon: '📡', ar: 'الوصلة', en: 'Link', desc: { ar: 'الإشارات اللاسلكية: GPS والواي فاي', en: 'Radio links: GPS, Wi-Fi' } },
  { id: 'ground', icon: '🏢', ar: 'الأرضي', en: 'Ground', desc: { ar: 'المنشأة وأجهزتها والأجواء فوقها', en: 'The site, its devices and the airspace above it' } },
  { id: 'user', icon: '👤', ar: 'المستخدم', en: 'User', desc: { ar: 'الهوية وصلاحيات الدخول', en: 'Identity and access' } },
]);
export const SEGMENT_IDS = Object.freeze(SEGMENTS.map((s) => s.id));

export const BANDS = Object.freeze({ L: 'L-band', X: 'X-band', ISM24: '2.4 GHz' });

/**
 * What SAWN detects, per segment. `keys` are incident scenario keys (server detections and the
 * training simulator); `match` refines by title. status: 'live' = a real detector, 'simulated' =
 * subsystem without hardware yet (training scenarios only), 'gap' = not covered.
 */
export const DETECTIONS = Object.freeze([
  { id: 'sat-overflight', segment: 'space', band: BANDS.X, en: 'Imaging-satellite overflight', ar: 'عبور أقمار التصوير', keys: ['sat-overflight'], status: 'live' },
  { id: 'gps-jamming', segment: 'link', band: BANDS.L, en: 'GPS jamming', ar: 'تشويش GPS', keys: ['air-gnss'], match: /jamming/i, status: 'live' },
  { id: 'gps-spoofing', segment: 'link', band: BANDS.L, en: 'GPS spoofing', ar: 'انتحال GPS', keys: ['air-gnss'], match: /spoofing/i, status: 'live' },
  { id: 'rf-jamming', segment: 'link', band: BANDS.ISM24, en: 'RF jamming', ar: 'تشويش لاسلكي', keys: ['air-jamming', 'jamming'], status: 'live' },
  { id: 'deauth', segment: 'link', band: BANDS.ISM24, en: 'Wi-Fi deauthentication', ar: 'هجوم قطع الواي فاي', keys: ['air-deauth', 'deauth'], status: 'live' },
  { id: 'replay', segment: 'link', band: null, en: 'Replay attacks', ar: 'هجمات إعادة الإرسال', keys: [], status: 'gap' },
  { id: 'devices', segment: 'ground', band: BANDS.ISM24, en: 'Unauthorized / unknown devices', ar: 'أجهزة غير مصرح بها', keys: ['air-unauth', 'air-unknown', 'air-rule'], status: 'live' },
  { id: 'eviltwin', segment: 'ground', band: BANDS.ISM24, en: 'Evil twin access points', ar: 'نقاط وصول مزيفة', keys: ['air-eviltwin', 'eviltwin'], status: 'live' },
  { id: 'hacktools', segment: 'ground', band: BANDS.ISM24, en: 'Hacking tools (Flipper, Pineapple)', ar: 'أدوات الاختراق', keys: ['air-attacktool', 'hacktool'], status: 'live' },
  { id: 'floods', segment: 'ground', band: BANDS.ISM24, en: 'Beacon / Bluetooth floods', ar: 'إغراق الإشارات', keys: ['air-beaconflood', 'air-blespam', 'blespam'], status: 'live' },
  { id: 'drones', segment: 'ground', band: BANDS.ISM24, en: 'Drones (Remote ID) and pilots', ar: 'الطائرات المسيّرة ومشغّلوها', keys: ['air-drone', 'drone'], status: 'live' },
  { id: 'aircraft', segment: 'ground', band: null, en: 'Aircraft over the site (ADS-B)', ar: 'الطائرات فوق المنشأة', keys: ['aircraft-intrusion'], status: 'live' },
  { id: 'reader-tamper', segment: 'ground', band: null, en: 'Card-reader tamper', ar: 'العبث بقارئ البطاقات', keys: [], status: 'gap' },
  { id: 'physical', segment: 'ground', band: null, en: 'Perimeter, cameras and screening', ar: 'المحيط والكاميرات والتفتيش', keys: ['metal', 'etd', 'door', 'intr', 'breach', 'circling', 'loiter', 'fight', 'bag', 'weapon', 'env', 'fire', 'smoke', 'gas'], status: 'simulated' },
  { id: 'ai-cameras', segment: 'ground', band: null, en: 'AI cameras (weapons, fire, sensitive areas, perimeter, behaviour)', ar: 'كاميرات الذكاء الاصطناعي', keys: ['cam-armed', 'cam-firearm', 'cam-weapon', 'cam-arson', 'cam-fire', 'cam-smoking', 'cam-smoke', 'cam-zone', 'cam-intrusion', 'cam-door', 'cam-dwell', 'cam-loiter', 'cam-person', 'cam-circling', 'cam-climb', 'cam-running', 'cam-fall', 'zone-entry', 'zone-dwell'], sources: ['camera'], status: 'live' },
  { id: 'health', segment: 'ground', band: null, en: 'System health (sensors, links)', ar: 'سلامة الأنظمة', keys: ['health'], status: 'live' },
  { id: 'card', segment: 'user', band: null, en: 'Card identity and access level', ar: 'هوية البطاقة ومستوى الصلاحية', keys: ['revoked', 'cross'], sources: ['gate'], status: 'live' },
  { id: 'level5', segment: 'user', band: null, en: 'Level 5 verification (card + PIN + fingerprint)', ar: 'تحقق المستوى الخامس', keys: ['bio'], status: 'simulated' },
  { id: 'escort', segment: 'user', band: null, en: 'Visitor escort rule', ar: 'قاعدة مرافقة الزوار', keys: ['escort'], status: 'simulated' },
  { id: 'behaviour', segment: 'user', band: null, en: 'Behaviour pattern / insider risk', ar: 'أنماط السلوك وخطر المطّلعين', keys: ['pattern', 'risk'], status: 'live' },
]);

/** The detection an incident belongs to (null when unknown). */
export function detectionOf(inc) {
  if (!inc) return null;
  const key = inc.scenario ?? inc.key ?? '';
  const title = String(inc.type ?? '');
  const byKey = DETECTIONS.filter((d) => d.keys.includes(key));
  const hit = byKey.find((d) => !d.match || d.match.test(title)) ?? DETECTIONS.find((d) => d.sources?.includes(inc.source)) ?? null;
  return hit;
}

/** Segment id of an incident. Unmapped incidents remain unclassified; do not silently call them Ground. */
export function segmentOf(inc) {
  return detectionOf(inc)?.segment ?? (inc?.source === 'gate' ? 'user' : null);
}

/** RF band of an incident's detection, only where it is real (GPS, satellite downlink, 2.4 GHz). */
export const bandOf = (inc) => detectionOf(inc)?.band ?? null;

/** Segment of a radar track: GPS trouble is a Link threat, everything else flies over the Ground. */
export function segmentOfTrack(tr) {
  if (tr?.spoof || tr?.nav?.status === 'lost') return 'link';
  return 'ground';
}

/**
 * Coverage per segment for the panel. Every provenance is counted separately; only explicit
 * operational records contribute to operational counts.
 */
export function coverage(incidents = [], isOpen = (s) => ['new', 'ack', 'escalated'].includes(s)) {
  const open = incidents.filter((i) => isOpen(i.status));
  const countByProvenance = (list) => Object.fromEntries(Object.values(IncidentProvenance).map((kind) => [kind, list.filter((i) => incidentProvenance(i) === kind).length]));
  return SEGMENTS.map((seg) => {
    const dets = DETECTIONS.filter((d) => d.segment === seg.id).map((d) => {
      const mine = open.filter((i) => detectionOf(i)?.id === d.id);
      return { ...d, ...countByProvenance(mine) };
    });
    const segOpen = open.filter((i) => segmentOf(i) === seg.id);
    return { ...seg, detections: dets, ...countByProvenance(segOpen) };
  });
}
