// Nashdan (نشدان), the camera assistant: turns a staff member's message (Arabic or English) into
//   • a search for people:  "رجل يلبس ثوب أبيض وشماغ أحمر في كاميرا البوابة آخر ساعة"
//     → { target: 'people', prompt: 'a photo of a man wearing a white thobe and a red and white
//         checkered headscarf', since: now − 1 h, cam: 'Gate' }
//   • a search for things and scenes in the facility: "شنطة سوداء متروكة" → { target: 'things',
//     prompt: 'a photo of an unattended black bag' }
//   • a question about what happened: "وش صار اليوم في كاميرا 3؟" → { action: 'events', … }
// The image model (SigLIP 2) matches English descriptions much better than Arabic ones (tested on
// 409 real person crops: "white shirt" 8/8 in English, "hat" 6/8 vs 3/8 in Arabic, "child" 0/8 in
// Arabic), so Arabic is translated word by word with the dictionary below — offline, no service.
// A message with only a time, a camera or "more" refines the previous search (the chat context).
// DOM-free: used by the server and tested in Node.

const TASHKEEL = /[ً-ٰٟـ]/g;
/** Arabic spelling variants folded together (أ إ آ → ا, ة → ه, ى → ي) and lower-case Latin. */
export function normalize(text) {
  return String(text ?? '')
    .replace(TASHKEEL, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[،,.!؟?؛;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Colours (masculine and feminine forms).
const COLORS = {
  red: ['احمر', 'حمراء', 'حمرا'],
  blue: ['ازرق', 'زرقاء', 'زرقا'],
  'navy blue': ['كحلي', 'كحليه'],
  green: ['اخضر', 'خضراء', 'خضرا'],
  yellow: ['اصفر', 'صفراء', 'صفرا'],
  black: ['اسود', 'سوداء', 'سودا'],
  white: ['ابيض', 'بيضاء', 'بيضا'],
  gray: ['رمادي', 'رماديه', 'رصاصي'],
  brown: ['بني', 'بنيه'],
  orange: ['برتقالي', 'برتقاليه'],
  pink: ['وردي', 'ورديه', 'زهري', 'زهريه'],
  purple: ['بنفسجي', 'بنفسجيه', 'موف'],
  beige: ['بيج'],
};
// Clothes and what people wear on the head / face.
const WEAR = {
  shirt: ['قميص', 'قميصه'],
  't-shirt': ['تيشيرت', 'تيشرت', 'تي شيرت', 'فانيله'],
  jacket: ['جاكيت', 'جاكت', 'جكيت', 'سترة', 'ستره'],
  coat: ['معطف', 'بالطو', 'كوت'],
  hoodie: ['هودي', 'هوديه'],
  suit: ['بدله', 'بدلة'],
  trousers: ['بنطلون', 'بنطال', 'سروال'],
  jeans: ['جينز'],
  shorts: ['شورت'],
  dress: ['فستان'],
  skirt: ['تنوره', 'تنورة'],
  'black abaya': ['عبايه', 'عباية', 'عباءه'],
  thobe: ['ثوب', 'دشداشه', 'كندوره'],
  'red and white checkered headscarf': ['شماغ'],
  'white headscarf': ['غتره', 'غترة'],
  hijab: ['حجاب'],
  niqab: ['نقاب'],
  cap: ['كاب', 'كاسكيت', 'قبعه', 'قبعة', 'طاقيه', 'طاقية'],
  glasses: ['نظاره', 'نظارات', 'نظارة'],
  sunglasses: ['نظاره شمسيه', 'نظارة شمسية'],
  'face mask': ['كمامه', 'كمامة'],
  vest: ['فست', 'صديري'],
  uniform: ['زي رسمي', 'يونيفورم'],
};
// Things carried.
const CARRY = {
  backpack: ['حقيبه ظهر', 'شنطه ظهر', 'شنطة ظهر', 'حقيبة ظهر'],
  suitcase: ['شنطه سفر', 'حقيبه سفر', 'شنطة سفر', 'حقيبة سفر'],
  handbag: ['حقيبه يد', 'شنطه يد', 'حقيبة يد', 'شنطة يد'],
  bag: ['حقيبه', 'شنطه', 'كيس'],
  'mobile phone': ['جوال', 'جواله', 'موبايل', 'تلفون', 'هاتف'],
  umbrella: ['مظله', 'شمسيه'],
  box: ['كرتون', 'صندوق'],
  laptop: ['لابتوب', 'لاب توب'],
};
const WHO = {
  man: ['رجل', 'رجال', 'ريال', 'شاب', 'ولد'],
  woman: ['امراه', 'امرأة', 'مرأة', 'مره', 'حرمه', 'بنت', 'فتاه', 'سيده'],
  child: ['طفل', 'طفله', 'اطفال', 'صغير'],
  'elderly person': ['شايب', 'عجوز', 'كبير في السن', 'كبيره في السن'],
  person: ['شخص', 'احد', 'انسان', 'واحد'],
};
const HAIR = { long: ['طويل', 'طويله'], short: ['قصير', 'قصيره'], blond: ['اشقر', 'شقراء'], bald: ['اصلع', 'صلعه'], 'gray-haired': ['شايب الشعر'] };
// Things and places in a facility (searched in the cameras' object and scene pictures).
const OBJECTS = {
  car: ['سياره', 'سيارات', 'موتر', 'كار'],
  'pickup truck': ['ونيت', 'بيك اب', 'بكب'],
  truck: ['شاحنه', 'تريله', 'لوري'],
  bus: ['باص', 'حافله'],
  motorcycle: ['دباب', 'دراجه ناريه', 'موتورسيكل'],
  bicycle: ['سيكل', 'دراجه هوائيه', 'دراجه'],
  door: ['باب', 'ابواب', 'بوابه'],
  gate: ['بوابه رئيسيه'],
  window: ['شباك', 'نافذه'],
  ladder: ['سلم', 'سلالم'],
  stairs: ['درج', 'الدرج'],
  fence: ['سور', 'سياج', 'شبك'],
  'fire extinguisher': ['طفايه', 'طفاية حريق', 'طفايه حريق'],
  'gas cylinder': ['جره غاز', 'اسطوانه غاز', 'اسطوانه', 'جره'],
  chair: ['كرسي', 'كراسي'],
  table: ['طاوله', 'طاولة', 'مكتب'],
  computer: ['كمبيوتر', 'حاسب', 'حاسوب'],
  screen: ['شاشه', 'تلفزيون'],
  printer: ['طابعه'],
  server: ['سيرفر', 'خادم'],
  'server rack': ['راك', 'خزانه سيرفرات'],
  cable: ['سلك', 'اسلاك', 'كيبل', 'كيابل'],
  pallet: ['طبليه', 'باليت'],
  tools: ['عده', 'ادوات', 'مفك', 'شنيور'],
  drone: ['درون', 'طائره مسيره', 'مسيره'],
  gun: ['مسدس', 'سلاح', 'بندقيه', 'رشاش'],
  knife: ['سكين', 'خنجر'],
  bottle: ['قاروره', 'علبه', 'قزازه'],
  trash: ['زباله', 'نفايات', 'قمامه'],
  fire: ['حريق', 'نار', 'لهب'],
  smoke: ['دخان'],
  'water on the floor': ['تسريب', 'تسريب ماء', 'ماء على الارض', 'مويه على الارض', 'ماء', 'مويه'],
  'a crowd of people': ['زحمه', 'زحام', 'تجمع', 'ناس كثير'],
  'an empty room': ['غرفه فاضيه', 'مكان فاضي'],
  'a parking lot': ['مواقف', 'موقف سيارات', 'باركنج'],
  'a corridor': ['ممر', 'ممرات', 'سيب'],
};
// What a thing is like ("باب مفتوح", "شنطة متروكة"): placed before the noun in English.
const STATE = {
  unattended: ['متروك', 'متروكه', 'مهجور', 'مهجوره', 'منسي', 'منسيه', 'لحالها', 'لحاله'],
  open: ['مفتوح', 'مفتوحه'],
  closed: ['مسكر', 'مسكره', 'مقفل', 'مقفله', 'مغلق', 'مغلقه'],
  broken: ['مكسور', 'مكسوره', 'خربان', 'خربانه'],
  parked: ['واقفه', 'موقوفه', 'مصفوفه'],
  big: ['كبير', 'كبيره', 'ضخم'],
  small: ['صغيره'],
};
// Uncountable or already with their article: no "a" in front.
const NO_ARTICLE = /^((fire|smoke|tools|water on the floor|stairs)$|an? )/;
// Words that carry no description (verbs, prepositions, chat filler).
const FILLER = new Set(
  ['ابحث', 'دور', 'دورلي', 'وريني', 'اعرض', 'ابي', 'ابغى', 'ابغي', 'عن', 'على', 'علي', 'في', 'فيه', 'من', 'مع', 'و', 'او', 'يلبس', 'لابس', 'لابسه', 'تلبس', 'يحمل', 'تحمل', 'شايل', 'شايله', 'ماسك', 'ماسكه', 'معه', 'معها', 'عنده', 'عندها', 'له', 'لها', 'اللي', 'الي', 'الذي', 'التي', 'هل', 'شفت', 'شوف', 'كان', 'كانت', 'لون', 'لونه', 'بلون', 'ب', 'ال', 'شعر', 'شعره', 'شعرها', 'كاميرا', 'الكاميرا', 'كاميره', 'show', 'find', 'search', 'for', 'me', 'please', 'any', 'someone', 'with', 'in', 'a', 'an', 'the', 'wearing', 'who', 'is', 'was'].map(normalize),
);

const flat = (dict) => Object.entries(dict).flatMap(([en, ars]) => ars.map((a) => [normalize(a), en]));
const MULTI = [...flat(WEAR), ...flat(CARRY), ...flat(WHO), ...flat(HAIR), ...flat(OBJECTS)].filter(([a]) => a.includes(' ')).sort((a, b) => b[0].length - a[0].length);
const LOOKUP = {
  color: new Map(flat(COLORS)),
  wear: new Map(flat(WEAR)),
  carry: new Map(flat(CARRY)),
  who: new Map(flat(WHO)),
  hair: new Map(flat(HAIR)),
  object: new Map(flat(OBJECTS)),
  state: new Map(flat(STATE)),
};
const DICTS = { wear: WEAR, carry: CARRY, who: WHO, hair: HAIR, object: OBJECTS };
const KIND_OF = (word) => Object.entries(LOOKUP).find(([, m]) => m.has(word))?.[0] ?? null;
// The article/prefix forms: "الاحمر" → "احمر", "بقميص" → "قميص", "وشماغ" → "شماغ".
function stem(word) {
  for (const w of [word, word.replace(/^ال/, ''), word.replace(/^(و|ب|ل|ف)/, ''), word.replace(/^(و|ب|ل|ف)ال/, '')]) if (KIND_OF(w)) return w;
  return word;
}

const AR_NUM = { واحد: 1, وحده: 1, اثنين: 2, ثنتين: 2, ساعتين: 2, ثلاث: 3, ثلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5, عشر: 10, عشره: 10, ربع: 0.25, نص: 0.5, نصف: 0.5 };

/** Time window from the message: { since, until } in ms, or null. now: ms; tz: minutes east of UTC. */
export function parseTime(text, now = Date.now(), tzOffsetMin = -new Date(now).getTimezoneOffset()) {
  const s = normalize(text).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const dayStart = (t) => {
    const local = t + tzOffsetMin * 60_000;
    return local - (local % 86_400_000) - tzOffsetMin * 60_000;
  };
  let m;
  if ((m = s.match(/(?:اخر|خلال|last|past)\s+(\d+|\S+)?\s*(دقيقه|دقايق|دقائق|minutes?|mins?)/))) return { since: now - (Number(m[1]) || AR_NUM[m[1]] || 1) * 60_000, until: null };
  if ((m = s.match(/(?:اخر|خلال|last|past)\s+(\d+|\S+)?\s*(ساعه|ساعات|ساعتين|hours?)/))) return { since: now - (m[2] === 'ساعتين' ? 2 : Number(m[1]) || AR_NUM[m[1]] || 1) * 3_600_000, until: null };
  if (/(اخر|خلال)\s+ساعتين/.test(s)) return { since: now - 2 * 3_600_000, until: null };
  if (/امس|البارحه|yesterday/.test(s)) return { since: dayStart(now) - 86_400_000, until: dayStart(now) };
  if ((m = s.match(/(?:بعد|after|since)\s+(?:الساعه\s+)?(\d{1,2})(?::(\d{2}))?\s*(pm|am|م|ص|مساء|العصر|الظهر)?/))) {
    let hh = Number(m[1]);
    if (/pm|م|مساء|العصر/.test(m[3] ?? '') && hh < 12) hh += 12;
    return { since: dayStart(now) + hh * 3_600_000 + Number(m[2] ?? 0) * 60_000, until: null };
  }
  if (/اليوم|today/.test(s)) return { since: dayStart(now), until: null };
  return null;
}

/**
 * Description from the message, translated to an English prompt for the image model.
 * Returns { prompt, target: 'people' | 'things', understood: [English terms], unknown: [Arabic words
 * not understood] } or null. A person word or clothes → people; otherwise things and scenes.
 */
export function describe(text) {
  let s = normalize(text);
  // Drop the time and camera parts (handled separately).
  s = s
    .replace(/(اخر|خلال|last|past)\s+(\d+\s*)?\S*\s*(دقيقه|دقايق|دقائق|ساعه|ساعات|ساعتين|minutes?|hours?|mins?)/g, ' ')
    .replace(/(بعد|after|since)\s+(الساعه\s+)?\d{1,2}(:\d{2})?\s*(pm|am|م|ص|مساء|العصر|الظهر)?/g, ' ')
    .replace(/اليوم|امس|البارحه|today|yesterday/g, ' ')
    .replace(/(كاميرا|كاميره|كام|camera|cam)\s*\d+/g, ' ');
  // English stays English: the model reads it directly.
  if (/[a-z]{3,}/.test(s) && !/[؀-ۿ]/.test(s)) {
    const words = s.split(' ').filter((w) => w && !FILLER.has(w) && !/^(more|new|camera|cam|hour|hours|minute|minutes|last|today)$/.test(w));
    const target = /\b(man|men|woman|women|person|people|child|kid|boy|girl|guy|lady|wearing|worker|employee|someone)\b/.test(s) ? 'people' : 'things';
    return words.length ? { prompt: `a photo of ${s.replace(/^(show|find|search)( me)?( for)?\s*/, '').trim()}`, target, understood: words, unknown: [] } : null;
  }
  // Phrases first, marked (§) so their English is not looked up again as Arabic.
  for (const [ar, en] of MULTI) s = s.replaceAll(ar, ` §${en.replace(/ /g, '_')} `);
  const tokens = s.split(' ').filter(Boolean);
  const items = [];
  const unknown = [];
  for (const raw of tokens) {
    if (raw.startsWith('§')) {
      const en = raw.slice(1).replace(/_/g, ' ');
      const kind = Object.entries(DICTS).find(([, d]) => d[en])?.[0];
      items.push({ kind, en });
      continue;
    }
    const w = stem(raw);
    const kind = KIND_OF(w);
    if (kind) items.push({ kind, en: LOOKUP[kind].get(w) });
    else if (!FILLER.has(raw) && !FILLER.has(w) && !/^\d+$/.test(raw)) unknown.push(raw);
  }
  if (!items.length) return null;
  const isPeople = items.some((x) => x.kind === 'who' || x.kind === 'wear' || x.kind === 'hair') || items.every((x) => x.kind === 'color');
  // Arabic puts the colour and the state after the noun ("شنطه سوداء متروكه"), English before it
  // ("unattended black bag").
  let who = null;
  const wear = [];
  const carry = [];
  const hair = [];
  const things = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'wear' || it.kind === 'carry' || it.kind === 'object') {
      const color = [];
      const state = [];
      while (items[i + 1]?.kind === 'color' || items[i + 1]?.kind === 'state') {
        const m = items[++i];
        (m.kind === 'color' ? color : state).push(m.en);
      }
      const phrase = [...state, ...color, it.en].join(' ');
      if (it.kind === 'wear') wear.push(phrase);
      else if (isPeople) carry.push(phrase);
      else things.push(phrase);
    } else if (it.kind === 'who') who ??= it.en;
    else if (it.kind === 'hair') hair.push(it.en);
    else if (it.kind === 'color') (isPeople ? wear : things).push(isPeople ? `${it.en} clothes` : `something ${it.en}`);
    else if (it.kind === 'state' && !isPeople) things.push(`something ${it.en}`);
  }
  const an = (x) => (NO_ARTICLE.test(x) ? x : `a ${x}`);
  const fix = (p) => p.replace(/\ba ([aeiou])/g, 'an $1');
  const understood = items.map((x) => x.en);
  if (!isPeople) return things.length ? { prompt: fix(`a photo of ${things.map(an).join(' and ')}`), target: 'things', understood, unknown } : null;
  const subject = who ?? 'person';
  const article = /^[aeiou]/.test(subject) ? 'an' : 'a';
  const parts = [`a photo of ${article} ${subject}`];
  if (hair.length) parts.push(`with ${hair.join(' ')} hair`);
  if (wear.length) parts.push(`wearing ${wear.map((x) => (/(trousers|jeans|shorts|glasses|clothes)$/.test(x) ? x : `a ${x}`)).join(' and ')}`);
  const held = carry.filter((x) => Object.keys(CARRY).some((k) => x.endsWith(k)));
  const near = carry.filter((x) => !held.includes(x));
  if (held.length) parts.push(`carrying ${held.map(an).join(' and ')}`);
  if (near.length) parts.push(`next to ${near.map(an).join(' and ')}`);
  return { prompt: fix(parts.join(' ')), target: 'people', understood, unknown };
}

// "What happened" questions: answered from the camera incidents, not from the pictures.
const EVENT_RE = /(تنبيه|تنبيهات|انذار|انذارات|حدث|احداث|حوادث|حادثه|وش صار|ايش صار|وش حصل|ايش حصل|ماذا حدث|ملخص|تقرير|\balerts?\b|\bincidents?\b|\bevents?\b|happened|summary)/;
const EVENT_KINDS = [
  [/حريق|نار|لهب|اشعال|fire|arson/, ['fire', 'arson']],
  [/دخان|smoke/, ['smoke']],
  [/سلاح|مسلح|مسدس|سكين|بندقيه|weapon|gun|knife|armed/, ['armed', 'weapon', 'firearm', 'knife']],
  [/تدخين|يدخن|سيجاره|smok(ing|er)/, ['smoking']],
  [/تسكع|متسكع|loiter/, ['loiter']],
  [/دوران|يدور|circling/, ['circling']],
  [/ركض|يركض|running/, ['running']],
  [/سقوط|طاح|سقط|fall/, ['fall']],
  [/تسلق|سور|climb/, ['climb']],
  [/تسلل|دخول|منطقه حساسه|بدون تصريح|intrusion|permit/, ['intrusion', 'door', 'dwell', 'zone']],
];
/** The camera number in the message ("كاميرا 3", "cam 3"), or null. */
export function cameraNumber(text) {
  const m = normalize(text).match(/(?:كاميرا|كاميره|كام|camera|cam)\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Which known camera the message names (longest name first), or null. */
export function findCamera(text, cameras = []) {
  const s = normalize(text);
  const named = [...cameras].sort((a, b) => b.length - a.length).find((c) => c && s.includes(normalize(c)));
  if (named) return named;
  // "كاميرا 3" / "cam 3" → the camera whose name ends in 3 ("كاميرا 3", "Camera 3").
  const n = cameraNumber(text);
  return n == null ? null : (cameras.find((c) => new RegExp(`(^|\\D)${n}$`).test(normalize(c))) ?? null);
}

/**
 * One chat turn. context: the previous search ({ prompt, since, until, cam, page }) or null.
 * Returns { action: 'search' | 'help' | 'reset', search, understood, unknown }.
 */
export function parseMessage(text, { context = null, cameras = [], now = Date.now(), tzOffsetMin } = {}) {
  const s = normalize(text);
  if (!s || /^(مساعده|ساعدني|help|\?)$/.test(s)) return { action: 'help' };
  if (/^(بحث جديد|جديد|مسح|new search|reset|clear)$/.test(s)) return { action: 'reset' };
  const more = /^(المزيد|كمان|زود|التالي|more|next)$/.test(s);
  const time = parseTime(text, now, tzOffsetMin);
  const cam = findCamera(text, cameras);
  const camNo = cameraNumber(text);
  const allCams = /كل الكاميرات|all cameras/.test(s);
  // "What happened …" — or a time / camera alone right after such a question — is about the events.
  const eventsAsked = EVENT_RE.test(s);
  if (eventsAsked || (context?.type === 'events' && !more && (time || cam || camNo || allCams))) {
    const prev = eventsAsked ? {} : context;
    const kinds = EVENT_KINDS.filter(([re]) => re.test(s)).flatMap(([, k]) => k);
    return {
      action: 'events',
      events: {
        type: 'events',
        since: time ? time.since : (prev.since ?? null),
        until: time ? time.until : (prev.until ?? null),
        cam: allCams ? null : (cam ?? prev.cam ?? null),
        camNo: allCams || cam ? null : (camNo ?? prev.camNo ?? null),
        kinds: kinds.length ? kinds : (prev.kinds ?? []),
      },
    };
  }
  const desc = more ? null : describe(cam ? s.replace(normalize(cam), ' ') : text);
  const ctx = context?.type === 'events' ? null : context;
  if (!desc && !ctx) return time || cam ? { action: 'help', reason: 'no-description' } : { action: 'help', reason: 'not-understood' };
  const prev = ctx ?? {};
  const search = {
    target: desc?.target ?? prev.target ?? 'people',
    prompt: desc?.prompt ?? prev.prompt,
    since: time ? time.since : desc ? null : (prev.since ?? null),
    until: time ? time.until : desc ? null : (prev.until ?? null),
    cam: allCams ? null : (cam ?? (desc ? null : (prev.cam ?? null))),
    page: more ? (prev.page ?? 0) + 1 : 0,
  };
  return { action: 'search', search, understood: desc?.understood ?? [], unknown: desc?.unknown ?? [] };
}
