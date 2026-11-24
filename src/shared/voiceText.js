// One short spoken alert per incident, in natural spoken Arabic WITH diacritics (tashkeel — the
// biggest single pronunciation fix for speech synthesis), English as a fallback, and the list of
// pre-recorded clips that say the same thing (assets/voice/, see manifest.json).
//   e.g. "تَنْبِيهٌ: طَائِرَة مُسَيَّرَة مَجْهُولَة عَلَى بُعْد ثَلَاثَة كِيلُومِتْرَات"
//   clips  ['p-mid', 'drone-approaching']  →  "تَنْبِيهٌ" + "طَائِرَة مُسَيَّرَة مَجْهُولَة تَقْتَرِب مِنَ المُنْشَأَة"
// Final words are pausal (no case endings), as an announcer would say them. Only WARNING (mid),
// HIGH and CRITICAL incidents are spoken; drills start with "مُحَاكَاة".
// DOM-free: tested in Node, used by src/ui/voiceAlerts.js.

export const SPOKEN_SEVERITIES = Object.freeze(['mid', 'high', 'crit']);

/**
 * The fixed phrases that can be recorded (the clip set). Speech adds distances / minutes to some
 * of them; the recorded versions are written so they stand alone without numbers.
 */
export const PHRASES = Object.freeze({
  'p-sim': { ar: 'مُحَاكَاة', en: 'Simulation' },
  'p-mid': { ar: 'تَنْبِيهٌ', en: 'Alert' },
  'p-high': { ar: 'تَحْذِير', en: 'Warning' },
  'p-crit': { ar: 'خَطَر', en: 'Danger' },
  'drone-approaching': { ar: 'طَائِرَة مُسَيَّرَة مَجْهُولَة تَقْتَرِب مِنَ المُنْشَأَة', en: 'an unknown drone is approaching the site' },
  'drone-inside': { ar: 'طَائِرَة مُسَيَّرَة دَاخِل نِطَاق المُنْشَأَة', en: 'a drone is inside the site perimeter' },
  'drone-pilot-inside': { ar: 'مُشَغِّل الطَّائِرَة المُسَيَّرَة دَاخِل حُدُود المُنْشَأَة', en: 'the drone pilot is inside the site boundary' },
  'aircraft-restricted': { ar: 'طَائِرَة دَخَلَت المَجَال الجَوِّيّ المَحْظُور', en: 'an aircraft has entered the restricted airspace' },
  'aircraft-approaching-zone': { ar: 'طَائِرَة تَتَّجِه نَحْوَ المَجَال الجَوِّيّ المَحْظُور', en: 'an aircraft is heading for the restricted airspace' },
  'aircraft-circling': { ar: 'طَائِرَة تَحُوم حَوْلَ المُنْشَأَة', en: 'an aircraft is circling the site' },
  'squawk-7500': { ar: 'طَائِرَة تُبَلِّغ عَنِ اخْتِطَاف', en: 'an aircraft reports a hijack' },
  'squawk-7600': { ar: 'طَائِرَة فَقَدَت الاتِّصَال اللَّاسِلْكِيّ', en: 'an aircraft has lost radio contact' },
  'squawk-7700': { ar: 'طَائِرَة تُعْلِن حَالَة طَوَارِئ', en: 'an aircraft declares an emergency' },
  'gps-jamming': { ar: 'تَشْوِيش مُحْتَمَل عَلَى إِشَارَة تَحْدِيد المَوَاقِع', en: 'possible GPS jamming around the site' },
  'gps-spoofing': { ar: 'انْتِحَال مُحْتَمَل لِإِشَارَة تَحْدِيد المَوَاقِع', en: 'possible GPS spoofing' },
  'sat-soon': { ar: 'قَمَر تَصْوِير سَيَمُرّ فَوْقَ المُنْشَأَة قَرِيبًا. غَطُّوا الأَنْشِطَة الحَسَّاسَة', en: 'an imaging satellite will pass overhead soon, cover sensitive activity' },
  'sat-overhead': { ar: 'قَمَر تَصْوِير فَوْقَ المُنْشَأَة الآن. غَطُّوا الأَنْشِطَة الحَسَّاسَة', en: 'an imaging satellite is overhead now, cover sensitive activity' },
  'radio-hacktool': { ar: 'جِهَاز اخْتِرَاق قُرْبَ البَوَّابَة', en: 'a hacking tool is near the gate' },
  'radio-deauth': { ar: 'هُجُوم يَقْطَع اتِّصَال الوَاي فَاي', en: 'an attack is cutting Wi-Fi connections' },
  'radio-jamming': { ar: 'تَشْوِيش لَاسِلْكِيّ مُحْتَمَل', en: 'possible radio jamming' },
  'radio-eviltwin': { ar: 'نُقْطَة وُصُول وَاي فَاي مُزَيَّفَة', en: 'a fake Wi-Fi access point' },
  'radio-bleflood': { ar: 'إِغْرَاق بِإِشَارَات البْلُوتُوث', en: 'a Bluetooth flood' },
  'device-unauthorized': { ar: 'جِهَاز غَيْر مُصَرَّح بِهِ عِنْدَ البَوَّابَة', en: 'an unauthorized device is at the gate' },
  // AI cameras (scenario cam-<kind>)
  'cam-armed': { ar: 'شَخْصٌ مُسَلَّحٌ، السِّلَاحُ فِي يَدِهِ', en: 'an armed person, weapon in hand' },
  'cam-firearm': { ar: 'سِلَاحٌ نَارِيّ ظَاهِرٌ فِي الكَامِيرَا', en: 'a firearm is visible on camera' },
  'cam-weapon': { ar: 'سِلَاحٌ أَبْيَض ظَاهِرٌ فِي الكَامِيرَا', en: 'a bladed weapon is visible on camera' },
  'cam-arson': { ar: 'إِشْعَالٌ مُتَعَمَّدٌ مُحْتَمَل: نِيرَانٌ بِجَانِبِ شَخْص', en: 'possible arson: flames next to a person' },
  'cam-fire': { ar: 'حَرِيقٌ فِي مَجَالِ الكَامِيرَا', en: 'fire on camera' },
  'cam-smoking': { ar: 'شَخْصٌ يُدَخِّنُ فِي المَوْقِع', en: 'someone is smoking on site' },
  'cam-smoke': { ar: 'دُخَانٌ فِي مَجَالِ الكَامِيرَا', en: 'smoke on camera' },
  'cam-zone': { ar: 'شَخْصٌ فِي مِنْطَقَةٍ مَحْظُورَة', en: 'a person in a restricted zone' },
  'cam-intrusion': { ar: 'شَخْصٌ غَيْرُ مُصَرَّحٍ لَهُ فِي مِنْطَقَةٍ حَسَّاسَة', en: 'an unauthorized person in a sensitive area' },
  'cam-door': { ar: 'شَخْصٌ يُحَاوِلُ فَتْحَ بَابٍ مَحْظُور', en: 'someone is trying to open a restricted door' },
  'cam-dwell': { ar: 'شَخْصٌ بَاقٍ فِي مِنْطَقَةٍ حَسَّاسَة', en: 'someone is staying in a sensitive area' },
  'cam-climb': { ar: 'اخْتِرَاقٌ لِلْمُحِيط: شَخْصٌ يَتَسَلَّقُ السُّور', en: 'perimeter breach: someone is climbing the fence' },
  'cam-person': { ar: 'شَخْصٌ قُرْبَ المَبْنَى', en: 'a person near the building' },
  'cam-loiter': { ar: 'شَخْصٌ يَتَسَكَّعُ حَوْلَ المُنْشَأَة', en: 'someone is loitering around the site' },
  'cam-circling': { ar: 'شَخْصٌ يَدُورُ حَوْلَ المَبْنَى', en: 'someone is circling the building' },
  'cam-running': { ar: 'شَخْصٌ يَرْكُضُ فِي المَوْقِع', en: 'someone is running on site' },
  'cam-fall': { ar: 'شَخْصٌ سَاقِطٌ عَلَى الأَرْض', en: 'a person is down on the ground' },
  generic: { ar: 'حَادِثَةٌ أَمْنِيَّةٌ جَدِيدَةٌ', en: 'a new security incident' },
});

const LEVEL_CLIP = { mid: 'p-mid', high: 'p-high', crit: 'p-crit' };

/**
 * SAWN's own recorded alerts (assets/voice/sawn-<kind>-ar.mp3 and -en.mp3): a whole announcement in
 * Arabic, then the same in English, each already carrying its level ("Critical security alert…").
 * When an incident is one of these kinds they replace the generic level + phrase clips.
 */
export const SAWN_ALERTS = Object.freeze({
  'sawn-aircraft': { ar: 'تنبيه بشأن المجال الجوي. تم رصد نشاط طائرات بالقرب من المنطقة الخاضعة للمراقبة. يلزم التحقق من الرحلة الجوية.', en: 'Airspace advisory. Aircraft activity detected near the monitored area. Flight verification is required.' },
  'sawn-drone': { ar: 'تنبيه أمني للمجال الجوي. تم رصد طائرة بدون طيار يحتمل أن تكون غير مصرح بها داخل المجال الجوي الخاضع للمراقبة. على أفراد الأمن إجراء تحقيق فوري.', en: 'Airspace security alert. A potentially unauthorized drone has been detected in monitored airspace. Security personnel, investigate immediately.' },
  'sawn-fence': { ar: 'تنبيه هام بشأن المحيط الخارجي. تم رصد احتمالية تسلق السياج. على أفراد الأمن التوجه فوراً إلى المنطقة المعنية.', en: 'Critical perimeter alert. Possible fence climbing detected. Security personnel, investigate the affected zone immediately.' },
  'sawn-weapon': { ar: 'تنبيه أمني عاجل. تشير تحليلات الكاميرا إلى احتمال وقوع حادثة تتعلق بسلاح. يلزم التحقق الفوري واتخاذ إجراء أمني.', en: 'Critical security alert. Camera analytics indicate a possible weapon-related incident. Immediate verification and security response are required.' },
  'sawn-vault': { ar: 'تنبيه أمني حرج. تم رصد فتح غير مصرح به للخزنة. يلزم اتخاذ إجراء أمني فوري.', en: 'Critical security alert. Unauthorized vault opening detected. Immediate security response required.' },
  'sawn-gateb': { ar: 'تنبيه بشأن تقييد الوصول. تم رصد محاولة دخول عند البوابة ب، في الطابق الخامس. يرجى التحقق من بيانات الاعتماد والتصريح الأمني.', en: 'Restricted access alert. An access attempt has been detected at Gate B, Level Five. Verify credentials and security clearance.' },
  'sawn-wireless': { ar: 'تنبيه أمني. تم رصد جهاز لاسلكي مجهول بالقرب من المنطقة الخاضعة للمراقبة. يلزم التحقق من التصريح.', en: 'Security advisory. An unknown wireless device has been detected near the monitored zone. Authorization verification is required.' },
  'sawn-metal': { ar: 'تحذير أمني. تم رصد معدن عند نقطة التفتيش. يلزم إجراء فحص إضافي.', en: 'Security warning. Metal detected at the screening checkpoint. Additional inspection is required.' },
  'sawn-space': { ar: 'تحذير أمن الفضاء. تم الإبلاغ عن حدث غير معروف يتعلق بقمر صناعي. يلزم التحقق من المصدر.', en: 'Space security advisory. An unrecognized satellite-related event has been reported. Source verification is required.' },
  'sawn-system': { ar: 'تحذير من النظام. فقد الاتصال بأحد الأنظمة الفرعية الأمنية. يلزم إجراء تحقيق فني.', en: 'System warning. Communication with a security subsystem has been lost. Technical investigation is required.' },
});

/** The SAWN recorded alert for this incident, or null (then the generic phrases are used). */
export function sawnAlertOf(inc) {
  const title = String(inc.type ?? '');
  const sc = String(inc.scenario ?? inc.key ?? '');
  if (/squawking (7500|7600|7700)/.test(title) || /GPS (jamming|spoofing)/i.test(title)) return null; // their own phrases
  if (sc === 'vault' || /^Vault alarm/i.test(title)) return 'sawn-vault';
  if (sc === 'vault-pin' || /wrong PIN at the vault|Gate B/i.test(title)) return 'sawn-gateb';
  if (/^cam-(weapon|firearm|armed)$/.test(sc)) return 'sawn-weapon';
  if (sc === 'cam-climb' || /fence|climb/i.test(title)) return 'sawn-fence';
  if (sc === 'air-drone' || /drone/i.test(title)) return 'sawn-drone';
  if (/restricted airspace|circling|aircraft/i.test(title)) return 'sawn-aircraft';
  if (/^sat-/.test(sc) || /satellite/i.test(title)) return 'sawn-space';
  if (/metal/i.test(title) || sc === 'metal') return 'sawn-metal';
  if (/(unauthori[sz]ed|unknown) (wireless )?device/i.test(title)) return 'sawn-wireless';
  if (/(lost contact|connection lost|communication lost|went offline|not responding|disconnected)/i.test(title)) return 'sawn-system';
  return null;
}

// كِيلُومِتْر is masculine: 3–10 take the feminine number form (ثَلَاثَة كِيلُومِتْرَات).
const AR_KM = ['', '', '', 'ثَلَاثَة', 'أَرْبَعَة', 'خَمْسَة', 'سِتَّة', 'سَبْعَة', 'ثَمَانِيَة', 'تِسْعَة', 'عَشَرَة'];
// دَقِيقَة is feminine: 3–10 take the masculine number form (خَمْس دَقَائِق).
const AR_MIN = ['', '', '', 'ثَلَاث', 'أَرْبَع', 'خَمْس', 'سِتّ', 'سَبْع', 'ثَمَانِي', 'تِسْع', 'عَشْر'];
const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** Distance in words: under 1 km in hundreds of metres, then whole kilometres. */
export function arDistance(m) {
  if (!Number.isFinite(m)) return null;
  if (m < 950) return `${Math.max(100, Math.round(m / 100) * 100)} مِتْر`;
  const km = Math.round(m / 1000);
  if (km === 1) return 'كِيلُومِتْر وَاحِد';
  if (km === 2) return 'كِيلُومِتْرَيْن';
  if (km <= 10) return `${AR_KM[km]} كِيلُومِتْرَات`;
  return `${km} كِيلُومِتْرًا`;
}
export function enDistance(m) {
  if (!Number.isFinite(m)) return null;
  if (m < 950) return `${Math.max(100, Math.round(m / 100) * 100)} metres`;
  const km = Math.round(m / 1000);
  return `${km <= 10 ? EN_NUM[km] : km} kilometre${km === 1 ? '' : 's'}`;
}
export function arMinutes(n) {
  if (n <= 0) return 'أَقَلّ مِن دَقِيقَة';
  if (n === 1) return 'دَقِيقَة وَاحِدَة';
  if (n === 2) return 'دَقِيقَتَيْن';
  if (n <= 10) return `${AR_MIN[n]} دَقَائِق`;
  if (n === 15) return 'خَمْسَ عَشْرَة دَقِيقَة';
  return `${n} دَقِيقَة`;
}
export const enMinutes = (n) => (n <= 0 ? 'less than a minute' : `${n <= 10 ? EN_NUM[n] : n} minute${n === 1 ? '' : 's'}`);

/** Distance of the incident's subject from the site, from its data or its text. */
function distanceOf(inc) {
  if (Number.isFinite(inc.aircraft?.distanceM)) return inc.aircraft.distanceM;
  const text = `${inc.type ?? ''} ${inc.reason ?? ''}`;
  const km = text.match(/(\d+(?:\.\d+)?) km(?: from the site|\b)/);
  if (km) return Number(km[1]) * 1000;
  const m = text.match(/(\d+) m from the site/);
  return m ? Number(m[1]) : null;
}

const RADIO = [
  [/hacking tool/i, 'radio-hacktool'],
  [/deauthentication/i, 'radio-deauth'],
  [/radio jamming/i, 'radio-jamming'],
  [/evil twin/i, 'radio-eviltwin'],
  [/bluetooth advertisement flood/i, 'radio-bleflood'],
  [/unauthori[sz]ed/i, 'device-unauthorized'],
];

/** Which phrase an incident is, and the (spoken-only) extra: distance or time. */
function classify(inc) {
  const title = String(inc.type ?? '');
  const scenario = inc.scenario ?? inc.key ?? '';
  const d = distanceOf(inc);
  const away = d !== null ? { ar: `عَلَى بُعْد ${arDistance(d)}`, en: `${enDistance(d)} away` } : null;
  const sq = title.match(/squawking (7500|7600|7700)/);
  if (sq) return sq[1] === '7500' ? { key: 'squawk-7500', speech: { ar: 'طَائِرَة تُبَلِّغ عَنِ اخْتِطَاف، الرَّمْز سَبْعَة خَمْسَة صِفْر صِفْر', en: 'an aircraft reports a hijack, squawk seven five zero zero' } } : { key: `squawk-${sq[1]}`, away };
  if (scenario === 'sat-overflight') {
    if (/OVERHEAD NOW/.test(title)) return { key: 'sat-overhead' };
    const n = Number(title.match(/in (\d+) min/)?.[1] ?? 15);
    return { key: 'sat-soon', speech: { ar: `قَمَر تَصْوِير سَيَمُرّ فَوْقَ المُنْشَأَة خِلَال ${arMinutes(n)}. غَطُّوا الأَنْشِطَة الحَسَّاسَة`, en: `an imaging satellite passes overhead in ${enMinutes(n)}, cover sensitive activity` } };
  }
  // AI cameras: one phrase per detection kind.
  if (/^cam-/.test(scenario) && PHRASES[scenario]) return { key: scenario };
  if (/GPS jamming/i.test(title)) return { key: 'gps-jamming' };
  if (/GPS spoofing/i.test(title)) return { key: 'gps-spoofing' };
  if (scenario === 'air-drone' || /drone/i.test(title)) {
    if (inc.pilot?.inside) return { key: 'drone-pilot-inside' };
    if (inc.sev === 'crit' && /perimeter|over the site/i.test(title)) return { key: 'drone-inside' };
    return { key: 'drone-approaching', speech: away ? { ar: `طَائِرَة مُسَيَّرَة مَجْهُولَة ${away.ar}`, en: `an unknown drone ${away.en}` } : null };
  }
  if (/inside restricted airspace/i.test(title)) return { key: 'aircraft-restricted', away };
  const enter = title.match(/will enter restricted airspace in (\d+):(\d+)/);
  if (enter) {
    const n = Math.round((Number(enter[1]) * 60 + Number(enter[2])) / 60);
    return { key: 'aircraft-approaching-zone', speech: { ar: `طَائِرَة سَتَدْخُل المَجَال الجَوِّيّ المَحْظُور خِلَال ${arMinutes(n)}`, en: `an aircraft will enter the restricted airspace in ${enMinutes(n)}` } };
  }
  if (/circling/i.test(title)) return { key: 'aircraft-circling', away };
  const radio = RADIO.find(([re]) => re.test(title));
  if (radio) return { key: radio[1] };
  return { key: 'generic', speech: { ar: PHRASES.generic.ar, en: `a new incident: ${title}` } };
}

/**
 * @returns {{ ar: string, en: string, clips: string[], key: string } | null}
 *          null when the incident is not spoken (Info level)
 */
export function incidentSentence(inc) {
  if (!inc || !SPOKEN_SEVERITIES.includes(inc.sev)) return null;
  const c = classify(inc);
  const phrase = PHRASES[c.key];
  const body = c.speech ?? (c.away ? { ar: `${phrase.ar}، ${c.away.ar}`, en: `${phrase.en}, ${c.away.en}` } : phrase);
  const level = PHRASES[LEVEL_CLIP[inc.sev]];
  return {
    key: c.key,
    sev: inc.sev,
    ar: `${inc.simulated ? `${PHRASES['p-sim'].ar}. ` : ''}${level.ar}: ${body.ar}`,
    en: `${inc.simulated ? 'Simulation. ' : ''}${level.en}: ${body.en}`,
    clips: [...(inc.simulated ? ['p-sim'] : []), LEVEL_CLIP[inc.sev], c.key],
  };
}
