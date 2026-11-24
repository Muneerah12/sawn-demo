// Arabic dictionary and translate(), without touching the page (shared by the console and the
// SAWN main interface). i18n.js adds the page layer on top. Originally: this layer
// translates what reaches the page — text nodes, a few attributes, canvas labels — from a
// dictionary, and switches the page to right-to-left. Switching back restores the English text.
//
// Dictionary lines: "English ⇒ Arabic". {0}, {1}… stand for variable parts; each captured part
// is translated again when it is itself a dictionary entry (e.g. a status inside a sentence).
import UI from './i18n/ar-ui.js';
import AIRSPACE from './i18n/ar-airspace.js';
import OPS from './i18n/ar-ops.js';
import RESPONSE from './i18n/ar-response.js';
import VISION from './i18n/ar-vision.js';
import AICAMS from './i18n/ar-aicams.js';
import REEM from './i18n/ar-reem.js';

const LATIN = /[A-Za-z]{2}/;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const SEPARATORS = [' · ', ' — ', ': ', ', '];

const exact = new Map();
const patterns = [];

function load(text) {
  for (const raw of text.split('\n')) {
    const i = raw.indexOf(' ⇒ ');
    if (i < 0) continue;
    const en = norm(raw.slice(0, i));
    const ar = raw.slice(i + 3).trim();
    if (!en || !ar) continue;
    if (!/\{\d\}/.test(en)) {
      exact.set(en, ar);
      exact.set(en.toLowerCase(), exact.get(en.toLowerCase()) ?? ar);
      continue;
    }
    const parts = en.split(/\{(\d)\}/);
    const order = [];
    let source = '^';
    let longest = '';
    // A one-letter prefix such as "L{0}" (L3 = Level 3) must be followed by a digit, or it would
    // rewrite names: "Layla" → "مayla".
    const shortPrefix = parts.length === 3 && !parts[2] && parts[0].trim().length === 1;
    parts.forEach((p, k) => {
      if (k % 2) {
        order.push(Number(p));
        source += shortPrefix ? '(\\d.*?)' : '(.+?)';
      } else {
        source += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (p.trim().length > longest.length) longest = p.trim();
      }
    });
    const len = parts.filter((_, k) => k % 2 === 0).join('').length;
    const literal = parts.filter((_, k) => k % 2 === 0).join('{}');
    const early = Boolean(parts[0]) || SEPARATORS.some((sep) => literal.includes(sep));
    patterns.push({ re: new RegExp(`${source}$`), order, ar, head: parts[0], key: longest, len, dot: en.includes('·'), early });
  }
}
load(UI);
load(AIRSPACE);
load(OPS);
load(RESPONSE);
load(VISION);
load(AICAMS);
load(REEM);
// Most specific first, so "{0} · {1}" never wins over a full sentence.
patterns.sort((a, b) => b.len - a.len);

function splitOutsideBrackets(s, sep) {
  const pieces = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && s.startsWith(sep, i)) {
      pieces.push(s.slice(start, i));
      start = i + sep.length;
      i += sep.length - 1;
    }
  }
  pieces.push(s.slice(start));
  return pieces;
}

const cache = new Map();
// `whole`: only a dictionary entry or pattern for the full string, no splitting.
function lookup(s, depth = 0, whole = false) {
  const hit = exact.get(s) ?? exact.get(s.toLowerCase());
  if (hit) return hit;
  if (depth > 2) return null;
  // A leading bullet or punctuation from a split sentence ("· Gate A node", ". Trusted sensors:").
  const lead = s.match(/^[·.,;:—–-]+\s*/)?.[0];
  if (lead && lead.length < s.length) {
    const t = lookup(s.slice(lead.length), depth + 1);
    if (t) return lead + t;
  }
  // Patterns that start with fixed text, or contain a separator themselves, are the most specific.
  const early = matchPattern(s, depth, (p) => p.early);
  if (early) return early;
  if (whole) return null;
  // Labels joined with separators: translate each piece.
  for (const sep of SEPARATORS) {
    if (!s.includes(sep)) continue;
    const pieces = splitOutsideBrackets(s, sep);
    if (pieces.length < 2) continue;
    // Longest run of pieces first, so a sentence that itself contains the separator stays whole.
    let changed = false;
    const out = [];
    for (let i = 0; i < pieces.length; ) {
      let j = Math.min(pieces.length, i + 3);
      let t = null;
      for (; j > i; j--) {
        const run = pieces.slice(i, j).join(sep).trim();
        if (j - i === pieces.length) continue; // the whole string was already tried above
        t = run && LATIN.test(run) ? lookup(run, depth + 1, j - i > 1) : null;
        if (t) break;
      }
      if (t) {
        changed = true;
        out.push(t);
        i = j;
      } else {
        out.push(pieces[i]);
        i++;
      }
    }
    if (changed) return out.join(sep === ', ' ? '، ' : sep);
  }
  // Last: short patterns that start with a variable ("{0} down"), which would otherwise match too much.
  return matchPattern(s, depth, (p) => !p.early);
}

function matchPattern(s, depth, which) {
  for (const p of patterns) {
    if (!which(p)) continue;
    if (p.head && !s.startsWith(p.head)) continue;
    if (p.key && !s.includes(p.key)) continue;
    const m = p.re.exec(s);
    if (!m) continue;
    const values = [];
    p.order.forEach((n, k) => (values[n] = m[k + 1]));
    const out = values.map((v = '') => (LATIN.test(v) ? lookup(v, depth + 1) : v));
    // A short pattern must not swallow a whole "a · b · c" list unless that part is itself known;
    // otherwise the separator rule handles it.
    if (!p.dot && values.some((v, k) => v?.includes(' · ') && out[k] === null)) continue;
    return p.ar.replace(/\{(\d)\}/g, (_, n) => out[Number(n)] ?? values[Number(n)] ?? '');
  }
  return null;
}

/** English → Arabic for one string (whitespace kept); returns the input when there is no entry. */
export function toArabic(text) {
  if (!text || !/[A-Za-z]/.test(text)) return text;
  if (cache.has(text)) return cache.get(text);
  const lead = text.match(/^\s*/)[0];
  const trail = text.slice(lead.length).match(/\s*$/)[0];
  const core = norm(text);
  const t = lookup(core);
  const out = t ? lead + t + trail : text;
  if (cache.size > 20000) cache.clear();
  cache.set(text, out);
  return out;
}
