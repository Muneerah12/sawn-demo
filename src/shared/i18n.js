// Bilingual console (English / Arabic). The modules build their text in English; this layer
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

const STORAGE_KEY = 'sawn.lang';
const ATTRS = ['placeholder', 'title', 'aria-label'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
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
    parts.forEach((p, k) => {
      if (k % 2) {
        order.push(Number(p));
        source += '(.+?)';
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
export function translate(text) {
  if (lang !== 'ar' || !text || !/[A-Za-z]/.test(text)) return text;
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

// ------------------------------------------------------------------ DOM
// English unless the viewer picked Arabic with the language button.
let lang = 'en';
try {
  lang = localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en';
} catch {
  /* storage blocked: stay in English */
}

const textState = new WeakMap(); // text node → { en, out }
const attrState = new WeakMap(); // element → { [attr]: { en, out } }

function skipped(el) {
  for (let n = el; n; n = n.parentElement) {
    if (SKIP_TAGS.has(n.tagName) || n.isContentEditable) return true;
    if (n.dataset && 'i18nSkip' in n.dataset) return true;
  }
  return false;
}

function doText(node) {
  if (!node.parentElement || skipped(node.parentElement)) return;
  const rec = textState.get(node);
  const en = rec && node.data === rec.out ? rec.en : node.data;
  const out = translate(en);
  textState.set(node, { en, out });
  if (node.data !== out) node.data = out;
}

function doAttrs(el) {
  if (skipped(el)) return;
  let recs = attrState.get(el);
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null) continue;
    recs ??= {};
    const rec = recs[a];
    const en = rec && cur === rec.out ? rec.en : cur;
    const out = translate(en);
    recs[a] = { en, out };
    if (cur !== out) el.setAttribute(a, out);
  }
  if (recs) attrState.set(el, recs);
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  doAttrs(root);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n);
    else doAttrs(n);
  }
}

const observer = new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'characterData') doText(r.target);
    else if (r.type === 'attributes') doAttrs(r.target);
    else for (const n of r.addedNodes) walk(n);
  }
});

function applyDocument() {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  walk(root);
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = lang === 'ar' ? 'English' : 'عربي';
    btn.setAttribute('aria-label', lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
  }
  for (const b of document.querySelectorAll('.lang-toggle')) if (b !== btn) b.textContent = btn?.textContent ?? '';
}

export function getLanguage() {
  return lang;
}

export function setLanguage(next) {
  lang = next === 'ar' ? 'ar' : 'en';
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private window: the choice lasts for this page only */
  }
  cache.clear();
  applyDocument();
  window.dispatchEvent(new CustomEvent('sawn:language', { detail: lang }));
}

// Canvas labels (radar, charts, 3D model signs) go through the same dictionary.
const fillText = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
  return fillText.call(this, typeof text === 'string' ? translate(text) : text, ...rest);
};
const measureText = CanvasRenderingContext2D.prototype.measureText;
CanvasRenderingContext2D.prototype.measureText = function (text) {
  return measureText.call(this, typeof text === 'string' ? translate(text) : text);
};

for (const name of ['alert', 'confirm', 'prompt']) {
  const original = window[name];
  window[name] = (message, ...rest) => original.call(window, typeof message === 'string' ? translate(message) : message, ...rest);
}

applyDocument();
observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
document.addEventListener('click', (e) => {
  if (e.target.closest?.('.lang-toggle')) setLanguage(lang === 'ar' ? 'en' : 'ar');
});
