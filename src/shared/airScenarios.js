// Exhibition demo scenarios for the airspace picture. Each is a scripted timeline: tracks follow
// keyframes (linear between them) and narration steps fire in order. Everything a scenario
// produces is SIMULATED; the server plays it through the same rules as real traffic.
// DOM-free: the server player and the console's scenario cards both read this file.
//
// Keyframe positions: { brg, km } around the site · { lat, lon } absolute · { e, n } metres east /
// north of the site. Altitude `ft` is above the site unless `msl: true`.
// Step captions may use {km} {alt} {tte}, filled from the scenario's `focus` track when the step fires.
import { RUH_CORRIDORS, bearingTo, offsetPoint } from '../core/airspaceRules.js';

/** Keyframes flying `turns` circles of `radiusKm` around a point `km` out on bearing `brg`. */
function circle({ brg, km, radiusKm, from, periodSec, turns, ft, startAngle = 0 }) {
  const c = { e: km * 1000 * Math.sin((brg * Math.PI) / 180), n: km * 1000 * Math.cos((brg * Math.PI) / 180) };
  const keys = [];
  const steps = Math.round(turns * 24);
  for (let i = 0; i <= steps; i++) {
    const a = ((startAngle + (i / 24) * 360) * Math.PI) / 180;
    keys.push({ t: from + (i / 24) * periodSec, e: c.e + radiusKm * 1000 * Math.sin(a), n: c.n + radiusKm * 1000 * Math.cos(a), ft });
  }
  return keys;
}

// Final approach to RUH runway 33R: 10 km out on the extended centreline, 3° glide.
const RUH = RUH_CORRIDORS[0];
const thr33R = { lat: RUH.ends[1][0], lon: RUH.ends[1][1] };
const outbound = bearingTo({ lat: RUH.ends[0][0], lon: RUH.ends[0][1] }, thr33R); // 15L → 33R, continued
const final10 = offsetPoint(thr33R, outbound, 10_000);
// GPS integrity levels for the jamming demo (NIC / NACp / SIL as broadcast in ADS-B).
const GPS_OK = { nic: 8, nacP: 10, sil: 3 };
const GPS_POOR = { nic: 4, nacP: 6, sil: 3 };
const GPS_LOST = { nic: 0, nacP: 0, sil: 3 };

// ≈ 250 kt, 5°/s: loitering is recognised after ≈ 60 s of circling (300° turned).
const loiter = circle({ brg: 200, km: 8, radiusKm: 1.5, from: 12, periodSec: 72, turns: 1.4, ft: 2500 });

export const AIR_SCENARIOS = Object.freeze([
  {
    id: 'drone',
    key: '1',
    icon: 'drone',
    severity: 'critical',
    title: { en: 'Drone intrusion', ar: 'اختراق بطائرة مسيّرة' },
    desc: { en: 'A hobby drone approaches and hovers over the site', ar: 'طائرة مسيّرة هاوية تقترب وتحوم فوق المنشأة' },
    zoomKm: 5,
    duration: 150,
    focus: 'd1',
    tracks: [{ id: 'd1', kind: 'drone', name: 'Unknown drone', keys: [{ t: 0, brg: 50, km: 2.4, ft: 400 }, { t: 120, brg: 50, km: 0.05, ft: 250 }, { t: 150, brg: 50, km: 0.05, ft: 250 }] }],
    steps: [
      { t: 0, cue: 'ping', ar: 'طائرة مسيّرة مجهولة تقترب من المنشأة — {km} كم', en: 'Unknown drone approaching the site — {km} km' },
      { t: 21, cue: 'chime', ar: 'المسيّرة على بعد {km} كم — تحذير، تم إبلاغ فريق الاستجابة', en: 'Drone {km} km away — WARNING, response team informed' },
      { t: 72, cue: 'alarm', ar: 'المسيّرة داخل نطاق المنشأة ({km} كم) — إنذار حرج', en: 'Drone inside the site perimeter ({km} km) — CRITICAL' },
      { t: 95, action: 'respond', ar: 'المشغّل أكّد الحادثة — تم إغلاق البوابات', en: 'Operator acknowledged — gates locked' },
      { t: 125, ar: 'المسيّرة تحوم فوق المنشأة — حدّد موقع المشغّل', en: 'Drone hovering over the site — locate the pilot' },
    ],
  },
  {
    id: 'lowfly',
    key: '2',
    icon: 'plane',
    severity: 'high',
    title: { en: 'Low-flying aircraft', ar: 'طائرة على ارتفاع منخفض' },
    desc: { en: 'Enters the restricted zone below 3,000 ft', ar: 'تدخل المنطقة المحظورة تحت 3,000 قدم' },
    zoomKm: 15,
    duration: 135,
    focus: 'a1',
    tracks: [{ id: 'a1', kind: 'aircraft', callsign: 'SIM142', keys: [{ t: 0, brg: 300, km: 15, ft: 1500 }, { t: 120, brg: 300, km: 0, ft: 1200 }, { t: 135, brg: 120, km: 1.9, ft: 1150 }] }],
    steps: [
      { t: 0, cue: 'ping', ar: 'طائرة على ارتفاع منخفض تقترب — {km} كم، {alt} قدم', en: 'Low-flying aircraft approaching — {km} km, {alt} ft' },
      { t: 40, cue: 'chime', ar: 'تحذير: ستدخل المجال الجوي المحظور خلال {tte}', en: 'WARNING: will enter restricted airspace in {tte}' },
      { t: 80, cue: 'alarm', ar: 'الطائرة داخل المجال الجوي المحظور — {alt} قدم', en: 'Aircraft inside restricted airspace — {alt} ft' },
      { t: 100, action: 'respond', ar: 'المشغّل أكّد — تم إبلاغ المراقبة الجوية وإغلاق البوابات', en: 'Operator acknowledged — ATC liaison informed, gates locked' },
      { t: 118, ar: 'الطائرة تعبر فوق المنشأة', en: 'Aircraft passing over the site' },
    ],
  },
  {
    id: 'sq7700',
    key: '3',
    icon: 'alert',
    severity: 'critical',
    title: { en: 'Emergency squawk 7700', ar: 'رمز طوارئ 7700' },
    desc: { en: 'An aircraft declares an emergency nearby', ar: 'طائرة تعلن حالة طوارئ بالقرب من المنشأة' },
    zoomKm: 50,
    duration: 110,
    focus: 'a1',
    tracks: [{ id: 'a1', kind: 'aircraft', callsign: 'SIM770', squawk: [[0, '2316'], [15, '7700']], keys: [{ t: 0, brg: 280, km: 20, ft: 9000 }, { t: 110, brg: 330, km: 18, ft: 6500 }] }],
    steps: [
      { t: 0, cue: 'ping', ar: 'طائرة ركاب على بعد {km} كم، ارتفاع {alt} قدم', en: 'Airliner {km} km away at {alt} ft' },
      { t: 15, cue: 'alarm', ar: 'الطائرة أعلنت حالة طوارئ — رمز 7700', en: 'Aircraft declares an EMERGENCY — squawk 7700' },
      { t: 35, ar: 'الرمز 7700 يعني طوارئ عامة: عطل محرك أو حريق أو حالة طبية', en: '7700 means general emergency: engine failure, fire or medical' },
      { t: 60, action: 'respond', ar: 'المشغّل أكّد — تم إبلاغ الدفاع المدني والإسعاف', en: 'Operator acknowledged — civil defence and ambulance informed' },
      { t: 90, ar: 'الطائرة تتجه نحو مطار الملك خالد للهبوط الاضطراري', en: 'Aircraft diverting to King Khalid International' },
    ],
  },
  {
    id: 'sq7500',
    key: '4',
    icon: 'shieldAlert',
    severity: 'critical',
    title: { en: 'Hijack squawk 7500', ar: 'رمز اختطاف 7500' },
    desc: { en: 'CRITICAL — an aircraft reports a hijacking and turns towards the city', ar: 'حرج — طائرة تبلغ عن اختطاف وتتجه نحو المدينة' },
    zoomKm: 50,
    duration: 120,
    focus: 'a1',
    tracks: [{ id: 'a1', kind: 'aircraft', callsign: 'SIM750', squawk: [[0, '4521'], [12, '7500']], keys: [{ t: 0, brg: 230, km: 24, ft: 11000 }, { t: 40, brg: 215, km: 19, ft: 10500 }, { t: 120, brg: 210, km: 7, ft: 6000 }] }],
    steps: [
      { t: 0, cue: 'ping', ar: 'طائرة على بعد {km} كم، ارتفاع {alt} قدم', en: 'Aircraft {km} km away at {alt} ft' },
      { t: 12, cue: 'alarm', ar: 'رمز 7500 — بلاغ اختطاف! إنذار حرج', en: 'Squawk 7500 — HIJACK reported! CRITICAL' },
      { t: 40, ar: 'الطائرة غيّرت مسارها نحو المدينة — {km} كم', en: 'Aircraft turned towards the city — {km} km' },
      { t: 70, action: 'respond', ar: 'المشغّل أكّد — إبلاغ الجهات الأمنية، إغلاق البوابات، الاحتماء داخل المبنى', en: 'Operator acknowledged — authorities alerted, gates locked, shelter in place' },
      { t: 100, ar: 'الطائرة على بعد {km} كم — المتابعة مستمرة', en: 'Aircraft {km} km away — tracking continues' },
    ],
  },
  {
    id: 'expected',
    key: '5',
    icon: 'check',
    severity: 'expected',
    title: { en: 'Expected airport traffic', ar: 'حركة مطار متوقعة' },
    desc: { en: 'A RUH approach that is correctly NOT alarmed', ar: 'طائرة تهبط في مطار الملك خالد — بدون إنذار كاذب' },
    zoomKm: 50,
    duration: 130,
    focus: 'a1',
    tracks: [{ id: 'a1', kind: 'aircraft', callsign: 'SIM330', keys: [{ t: 0, lat: final10.lat, lon: final10.lon, ft: 3800, msl: true }, { t: 130, lat: thr33R.lat, lon: thr33R.lon, ft: 2100, msl: true }] }],
    steps: [
      { t: 0, cue: 'ping', ar: 'طائرة تقترب للهبوط في مطار الملك خالد الدولي', en: 'Aircraft on final approach to King Khalid International (RUH)' },
      { t: 10, ar: 'تم التعرّف عليها كحركة مطار متوقعة — لا إنذار', en: 'Recognised as expected RUH traffic — no alarm' },
      { t: 50, ar: 'تحقّقنا من: رمز النداء، اتجاه المدرج، والنزول التدريجي', en: 'Checked: callsign, runway heading and steady descent' },
      { t: 120, ar: 'هبطت الطائرة — صفر إنذارات كاذبة', en: 'Aircraft landed — zero false alarms' },
    ],
  },
  {
    id: 'combined',
    key: '6',
    icon: 'target',
    severity: 'critical',
    title: { en: 'Combined attack', ar: 'هجوم منسّق' },
    desc: { en: 'Three drones from different directions + a suspicious aircraft', ar: 'ثلاث مسيّرات من اتجاهات مختلفة وطائرة مشبوهة' },
    zoomKm: 15,
    duration: 160,
    focus: 'x1',
    tracks: [
      { id: 'd1', kind: 'drone', name: 'Drone north', keys: [{ t: 0, brg: 0, km: 1.8, ft: 300 }, { t: 90, brg: 0, km: 0.15, ft: 250 }, { t: 160, brg: 0, km: 0.15, ft: 250 }] },
      { id: 'd2', kind: 'drone', name: 'Drone east', keys: [{ t: 0, brg: 100, km: 1.6, ft: 350 }, { t: 80, brg: 100, km: 0.1, ft: 200 }, { t: 160, brg: 100, km: 0.1, ft: 200 }] },
      { id: 'd3', kind: 'drone', name: 'Drone south-west', keys: [{ t: 0, brg: 225, km: 2.0, ft: 300 }, { t: 100, brg: 225, km: 0.2, ft: 250 }, { t: 160, brg: 225, km: 0.2, ft: 250 }] },
      // Appears circling 8 km out, then breaks off towards the site (≈ 250 kt throughout).
      { id: 'x1', kind: 'aircraft', callsign: null, keys: [...loiter, { t: 155, brg: 200, km: 3.5, ft: 2200 }, { t: 160, brg: 200, km: 2.9, ft: 2150 }] },
    ],
    steps: [
      { t: 0, cue: 'ping', ar: 'ثلاث طائرات مسيّرة تقترب من ثلاثة اتجاهات', en: 'Three drones approaching from three directions' },
      { t: 14, cue: 'ping', ar: 'طائرة بدون رمز نداء تحوم على بعد {km} كم', en: 'Aircraft with no callsign circling {km} km away' },
      { t: 35, cue: 'alarm', ar: 'أول مسيّرة داخل نطاق المنشأة — إنذار حرج', en: 'First drone inside the site perimeter — CRITICAL' },
      { t: 74, cue: 'chime', ar: 'تحذير: الطائرة تحوم حول المنشأة', en: 'WARNING: aircraft loitering near the site' },
      { t: 88, ar: 'ثلاث مسيّرات فوق المنشأة — هجوم منسّق', en: 'Three drones over the site — coordinated attack' },
      { t: 100, action: 'respond', ar: 'المشغّل أكّد — إغلاق البوابات وإبلاغ الجهات الأمنية', en: 'Operator acknowledged — gates locked, authorities alerted' },
      { t: 116, cue: 'chime', ar: 'الطائرة تتجه نحو المنشأة — {km} كم', en: 'Aircraft now heading for the site — {km} km' },
      { t: 145, cue: 'alarm', ar: 'الطائرة داخل المجال الجوي المحظور', en: 'Aircraft inside restricted airspace' },
    ],
  },
  {
    id: 'pilot',
    key: '7',
    icon: 'person',
    severity: 'critical',
    title: { en: 'Drone with pilot located', ar: 'مسيّرة مع تحديد موقع المشغّل' },
    desc: { en: 'Remote ID reveals where the pilot stands — inside our boundary', ar: 'معرّف التتبع عن بُعد يكشف موقع المشغّل — داخل حدود المنشأة' },
    zoomKm: 5,
    duration: 120,
    focus: 'd1',
    tracks: [
      {
        id: 'd1',
        kind: 'drone',
        name: 'DJI Mini 4 Pro',
        operatorId: 'SAU-OP-48213',
        pilot: { from: 0, brg: 200, km: 0.15, type: 'Live GNSS' }, // in the car park, inside the boundary (Remote ID sends it from the start)
        keys: [{ t: 0, brg: 20, km: 1.6, ft: 350 }, { t: 70, brg: 20, km: 0.6, ft: 300 }, { t: 120, brg: 20, km: 0.6, ft: 300 }],
      },
    ],
    steps: [
      { t: 0, cue: 'ping', ar: 'مسيّرة تبث معرّف التتبع عن بُعد — {km} كم', en: 'Drone broadcasting Remote ID — {km} km' },
      { t: 6, cue: 'alarm', ar: 'تم تحديد موقع المشغّل: داخل حدود المنشأة! خطر داخلي', en: 'Pilot located INSIDE the site boundary — insider risk!' },
      { t: 25, ar: 'المشغّل على بعد {pilotKm} كم من المسيّرة و{pilotM} م من مركز المنشأة', en: 'Pilot {pilotKm} km from the drone, {pilotM} m from the site centre' },
      { t: 45, action: 'respond', dispatch: true, ar: 'تم إرسال حارس إلى موقع المشغّل', en: 'Guard dispatched to the pilot location' },
      { t: 90, ar: 'الحارس يقترب من المشغّل — المسيّرة تحوم على بعد {km} كم', en: 'Guard closing in on the pilot — drone holding {km} km out' },
    ],
  },
  {
    id: 'gnss',
    key: '8',
    icon: 'radio',
    severity: 'high',
    title: { en: 'GPS jamming & spoofing', ar: 'تشويش وانتحال GPS' },
    desc: { en: 'Aircraft lose GPS integrity together, then one position jumps', ar: 'طائرات تفقد دقة GPS معاً ثم يقفز موقع إحداها' },
    zoomKm: 50,
    duration: 100,
    focus: 'a5',
    tracks: [
      { id: 'a1', kind: 'aircraft', callsign: 'SIM901', nav: [[0, GPS_OK], [14, GPS_LOST]], keys: [{ t: 0, brg: 300, km: 30, ft: 12000 }, { t: 100, brg: 335, km: 25, ft: 11000 }] },
      { id: 'a2', kind: 'aircraft', callsign: 'SIM902', nav: [[0, GPS_OK], [16, GPS_POOR], [24, GPS_LOST]], keys: [{ t: 0, brg: 60, km: 28, ft: 9000 }, { t: 100, brg: 25, km: 22, ft: 8000 }] },
      { id: 'a3', kind: 'aircraft', callsign: 'SIM903', nav: [[0, GPS_OK], [22, GPS_LOST]], keys: [{ t: 0, brg: 160, km: 32, ft: 15000 }, { t: 100, brg: 130, km: 30, ft: 15000 }] },
      { id: 'a4', kind: 'aircraft', callsign: 'SIM904', nav: [[0, GPS_OK], [25, GPS_LOST]], keys: [{ t: 0, brg: 230, km: 20, ft: 7000 }, { t: 100, brg: 255, km: 26, ft: 7500 }] },
      // Spoofed: its GPS still looks healthy, but the position jumps 25 km in half a second.
      { id: 'a5', kind: 'aircraft', callsign: 'SIM905', nav: [[0, GPS_OK]], keys: [{ t: 0, brg: 100, km: 35, ft: 20000 }, { t: 50, brg: 95, km: 30, ft: 20000 }, { t: 50.5, brg: 20, km: 12, ft: 20000 }, { t: 100, brg: 10, km: 8, ft: 20000 }] },
    ],
    steps: [
      { t: 0, cue: 'ping', ar: 'خمس طائرات تبث مواقعها عبر ADS-B — دقة GPS طبيعية', en: 'Five aircraft broadcasting ADS-B — GPS integrity normal' },
      { t: 15, cue: 'chime', ar: 'دقة GPS تنهار لدى إحدى الطائرات', en: 'GPS integrity collapsing on one aircraft' },
      { t: 26, cue: 'alarm', ar: 'تشويش محتمل على GPS — {bad} من {total} طائرات فقدت دقة GPS', en: 'Possible GPS jamming — {bad} of {total} aircraft lost GPS integrity' },
      { t: 54, cue: 'alarm', ar: 'انتحال محتمل: موقع طائرة قفز مسافة مستحيلة', en: 'Possible spoofing: an aircraft position jumped an impossible distance' },
      { t: 70, action: 'respond', ar: 'المشغّل أكّد — إبلاغ المراقبة الجوية وفحص الأنظمة المعتمدة على GPS', en: 'Operator acknowledged — ATC liaison informed, GPS-dependent systems checked' },
      { t: 88, ar: 'كشف المسيّرات بالراديو لا يعتمد على GPS — المراقبة مستمرة', en: 'Radio-based drone detection does not depend on GPS — monitoring continues' },
    ],
  },
  {
    // No tracks: server/satellites.mjs fast-forwards to the next REAL imaging pass (or a sample
    // pass when no orbit data is available) and runs the steps marked sat-alert / sat-overhead.
    id: 'satellite',
    key: '9',
    icon: 'satellite',
    severity: 'warning',
    kind: 'space',
    title: { en: 'Satellite overflight', ar: 'عبور قمر صناعي' },
    desc: { en: 'Fast-forward to the next real imaging-satellite pass over the site', ar: 'تقديم سريع إلى العبور الحقيقي التالي لقمر تصوير فوق المنشأة' },
    zoomKm: null,
    duration: 100,
    focus: null,
    tracks: [],
    steps: [
      { t: 0, cue: 'ping', ar: 'تقديم سريع إلى العبور الحقيقي التالي: {sat} الساعة {passTime}', en: 'Fast-forward to the next real imaging pass: {sat} at {passTime}' },
      { t: 2, cue: 'chime', action: 'sat-alert', ar: 'قمر التصوير {sat} يمر فوق المنشأة خلال {mins} دقيقة — غطِّ الأنشطة الحساسة', en: 'Imaging satellite {sat} passes overhead in {mins} min — cover sensitive activity' },
      { t: 36, cue: 'alarm', action: 'sat-overhead', ar: 'القمر الصناعي فوق المنشأة الآن — أقصى ارتفاع {el} درجة', en: 'OVERHEAD NOW — max elevation {el} degrees' },
      { t: 50, action: 'respond', ar: 'المشغّل أكّد — تغطية المعدات الحساسة وإيقاف الأنشطة الخارجية', en: 'Operator acknowledged — sensitive equipment covered, outdoor activity paused' },
      { t: 90, ar: 'انتهى العبور — غاب القمر الصناعي تحت الأفق', en: 'Pass over — the satellite has set below the horizon' },
    ],
  },
]);

export const scenarioById = (id) => AIR_SCENARIOS.find((s) => s.id === id) ?? null;
