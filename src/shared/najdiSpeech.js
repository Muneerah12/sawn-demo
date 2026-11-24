// Nashdan's spoken Najdi: what a reply sounds like, separate from how it is shown. The text on screen
// keeps digits and times ("15:15"); what is said is how someone from Riyadh would say it
// ("ثلاث وربع العصر"). Used for every voice (browser or a Najdi TTS service): the dialect is in
// the words, the service only gives them a voice.

const HOURS = ['اثنعش', 'وحدة', 'ثنتين', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع', 'عشر', 'حدعش'];
// Minutes rounded to five, as people say them; 40 and later count down to the next hour.
const MINUTES = { 0: '', 5: 'وخمس', 10: 'وعشر', 15: 'وربع', 20: 'وثلث', 25: 'ونص إلا خمس', 30: 'ونص', 35: 'ونص وخمس', 40: 'إلا ثلث', 45: 'إلا ربع', 50: 'إلا عشر', 55: 'إلا خمس' };

/** Part of the day for an hour 0–23: الفجر، الصبح، الظهر، العصر، المغرب، الليل. */
export function dayPart(h) {
  if (h >= 4 && h < 6) return 'الفجر';
  if (h >= 6 && h < 12) return 'الصبح';
  if (h >= 12 && h < 15) return 'الظهر';
  if (h >= 15 && h < 18) return 'العصر';
  if (h === 18) return 'المغرب';
  return 'الليل';
}

/** 15:15 → "ثلاث وربع العصر"; 9:40 → "عشر إلا ثلث الصبح"; 12:00 → "اثنعش الظهر". */
export function spokenTime(hours, minutes) {
  let h = Number(hours);
  let m = Math.round(Number(minutes) / 5) * 5;
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  const say = m >= 40 ? (h + 1) % 24 : h;
  const part = dayPart(m >= 40 ? say : h);
  return [HOURS[say % 12], MINUTES[m], part].filter(Boolean).join(' ');
}

/**
 * A reply as Nashdan says it: times in words, incident numbers as numbers, symbols and emoji out.
 * "الساعة 15:15" → "الساعة ثلاث وربع العصر"; "INC-0042" → "البلاغ رقم 42".
 */
export function najdiSpeech(text) {
  return String(text ?? '')
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/g, (_, h, m) => spokenTime(h, m))
    .replace(/(?:البلاغ\s+)?\bINC-0*(\d+)\b/gi, 'البلاغ رقم $1')
    .replace(/\bCAM-0*(\d+)\b/gi, 'كاميرا $1')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/[«»"“”•·]/g, ' ')
    .replace(/\s*[—–]\s*/g, '، ')
    .replace(/\s+([،,.؟?!])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sentences for testing a voice: Najdi words and the security terms Nashdan says most, each in a
 * sentence the way he would use it.
 */
export const PRONUNCIATION_TEST = Object.freeze([
  'أبشر، آخر ظهور له كان عند البوابة الشمالية الساعة ثلاث وربع العصر. تبي أعرض لك التسجيل؟',
  'الكاميرات كلها شغّالة، بس الكاميرا الثالثة انقطع اتصالها قبل دقيقتين.',
  'حسب آخر تحديث، ما فيه تهديدات نشطة حالياً.',
  'وش تبيني أدوّر لك عليه؟ شخص، غرض، ولا مكان؟',
  'فيه بلاغ حرج: شخص مسلّح عند المدخل الرئيسي، والأدلة جاهزة.',
  'الدرون على منصّته، والبطارية ستة وتسعين بالمية.',
  'ترى هذا الموظف ما عنده صلاحية لهالمنطقة، والبطاقة موقوفة.',
  'رصدنا تسلّق على السور الشرقي، وتسكّع قرب البوابة من ربع ساعة.',
]);
