// What a Nashdan question is about, when it is about the platform rather than a picture search:
// the cameras' state, threats now, the drone, where a registered person was last seen, an incident's
// place on the map or its evidence. Rule based on purpose: every answer comes from SAWN's own data,
// so the question must be understood exactly or not at all (then the picture search / events take it).
import { normalize } from './peopleQuery.js';

// "يا عبدالله، …" / "عبدالله …" in front of a question. Abdullah is the assistant's only name.
const CALL = /^(يا\s*)?(عبدالله|عبد الله|abdullah|abdallah)\s*/;
// His name after a greeting ("هلا عبدالله", "السلام عليكم يا عبدالله"): dropped for greetings only, so
// "وين عبدالله" still searches for a person called Abdullah.
const CALL_END = /\s*(يا\s*)?(عبدالله|عبد الله|abdullah|abdallah)$/;
// Conversation (normalized text: ة→ه, أ/إ/آ→ا, ى→ي): answered with Abdullah's own recordings.
const THANKS = /(يعطيك العافيه|يعطيك الف عافيه|الله يعطيك|مشكور|شكرا|تسلم|thanks|thank you)/;
const GREET = /^((ال)?سلام عليكم( ورحمه الله( وبركاته)?)?|هلا|هلا والله|هلا وغلا|يا هلا|مرحبا|اهلين|اهلا|حياك|حياك الله|صباح الخير|صباح النور|مساء الخير|مساء النور|كيف حالك|كيف الحال|كيفك|وش اخبارك|شخبارك|وش علومك|hello|hi|hey|good morning|good evening|how are you)$/;
const INTRO = /(مين انت|من انت|وش انت|من تكون|وش اسمك|ما اسمك|عرف بنفسك|عرف نفسك|عرفني بنفسك|عرفنا بنفسك|عرفني عليك|عرفنا عليك|وش تقدر تسوي|وش تسوي|ايش تسوي|who are you|what is your name|what can you do|introduce yourself)/;
// "Let me hear you": only as the whole sentence, so "تكلم عن الحوادث" is still a question about incidents.
const SPEAK = /^(تكلم|تكلم معي|احكي|احك|سولف|ابي اسمعك|ابغي اسمعك|ودي اسمعك|اسمعني صوتك|سمعني صوتك|say something|talk to me|speak)$/;
const INCIDENTS = /(حوادث|الحوادث|حادثه|البلاغات|بلاغات|التنبيهات|تنبيهات|incidents?|alerts?)/;
const RESTRICTED = /(المنطقه المحظوره|منطقه محظوره|المحظوره|المنطقه الممنوعه|منطقه ممنوعه|المنطقه المقيده|restricted (zone|area))/;
// "وين أحمد؟" — a person by name, without "آخر ظهور".
const WHERE_NAME = /^وين\s+(.{2,40})$/;
const CAMERAS = /(وضع|حاله|حال|شغال|شغاله|تشتغل|متصل|متصله|اتصال|طافي|طافيه|منقطع|status|online|offline|working).*(الكاميرات|كاميرات|الكامرات|cameras?)|(الكاميرات|كاميرات|الكامرات|cameras?).*(وضع|حاله|حال|شغال|شغاله|تشتغل|متصل|متصله|اتصال|طافي|طافيه|منقطع|status|online|offline|working)/;
const THREATS = /(تهديد|تهديدات|خطر|اخطار|مخاطر|فيه شي خطير|الوضع الامني|threats?|danger)/;
const DRONE = /(درون|الدرون|مسيره|المسيره|المسيّره|drone)/;
const PLACE = /(موقع|مكان|وين صار|وين مكان|على الخريطه|بالخريطه|location|on the map|where)\s*(ال)?(حادث|حادثه|بلاغ|البلاغ|incident)/;
const EVIDENCE = /(ادله|الادله|دليل|الدليل|لقطات|مقاطع|مقطع|صور الحادث|evidence|clips?)/;
const REF = /\b(inc)[\s-]?(\d{1,6})\b/;
// "وين آخر ظهور لـ…", "آخر مرة شفتو فهد", "وين فهد الحين", "last seen …"
const LAST_SEEN = /(اخر ظهور|اخر مره (شفتو|شافته|شافوه|شفته|شفت|ظهر)|وين اخر مره|وين كان|وين شافت|last seen|where was|where is)\s*(ل|لـ|عن|of)?\s*/;
const PERSON_WORDS = /^(ال)?(شخص|موظف|الموظف|الشخص|هالشخص|هذا|هذا الشخص|person|employee)\s*/;

/** The question without "يا نشدان" in front. */
export function stripCall(text) {
  return normalize(text).replace(CALL, '').trim();
}

/**
 * The platform question, or null. { intent: 'cameras' | 'threats' | 'drone' | 'person' |
 * 'incident-place' | 'evidence', name?, ref? }. A person question without a name (“وين آخر ظهور
 * للشخص؟”) has name null: the person of the previous question.
 */
export function detectIntent(text) {
  const s = stripCall(text);
  // Only his name ("يا عبدالله"): he answers that he is listening.
  if (!s) return CALL.test(normalize(text)) ? { intent: 'call' } : null;
  if (THANKS.test(s)) return { intent: 'thanks' };
  const bare = s.replace(CALL_END, '').trim(); // "هلا عبدالله" → "هلا"
  if (GREET.test(s) || (bare && GREET.test(bare))) return { intent: 'greet' };
  if (INTRO.test(s) || SPEAK.test(s) || (bare && SPEAK.test(bare))) return { intent: 'intro' };
  const ref = s.match(REF);
  const refId = ref ? `INC-${ref[2].padStart(4, '0')}` : null;
  const seen = s.match(LAST_SEEN);
  if (seen) {
    const rest = s.slice(seen.index + seen[0].length).replace(PERSON_WORDS, '').replace(/^(ل|لـ)\s*/, '').trim();
    const name = rest.replace(/\s*(الحين|اليوم|now|today)$/, '').replace(PERSON_WORDS, '').trim();
    // "للشخص" / "للموظف": the person of the previous question, not a name.
    return { intent: 'person', name: name.length >= 2 && !/^(ال)?(شخص|موظف|هالشخص|هذا|person|employee)$/.test(name) ? name : null };
  }
  if (PLACE.test(s)) return { intent: 'incident-place', ref: refId };
  if (EVIDENCE.test(s) && /(حادث|حادثه|بلاغ|incident|inc)/.test(s)) return { intent: 'evidence', ref: refId };
  if (DRONE.test(s)) return { intent: 'drone' };
  if (CAMERAS.test(s)) return { intent: 'cameras' };
  if (RESTRICTED.test(s)) return { intent: 'restricted' };
  if (THREATS.test(s)) return { intent: 'threats' };
  if (INCIDENTS.test(s)) return { intent: 'incidents' };
  const where = s.match(WHERE_NAME);
  if (where) {
    const name = where[1].replace(/\s*(الحين|اليوم|now|today)$/, '').replace(PERSON_WORDS, '').trim();
    if (name.length >= 2 && !/(حادث|بلاغ|كاميرا|الكاميرات|درون|incident)/.test(name)) return { intent: 'person', name };
  }
  return null;
}
