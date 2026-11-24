// Spoken alerts: every new WARNING / HIGH / CRITICAL incident is announced once.
//   recorded  plays pre-recorded clips from assets/voice/ (best quality, offline), e.g.
//             [مُحَاكَاة] [تَنْبِيه] [طَائِرَة مُسَيَّرَة مَجْهُولَة تَقْتَرِب مِنَ المُنْشَأَة];
//             when a clip is missing (or still the silent placeholder) the speech below is used
//   speech    Web Speech API with the best Arabic voice: Microsoft Hamed Online (Natural), Saudi,
//             in Edge (chosen by the site: natural sounding; it sends the sentence's text to
//             Microsoft and needs the internet), then another neural Arabic voice, then one installed
//             on the computer (Naayf, Majed) — also used when the online voice fails — then English; slightly slower than default (0.9) at natural pitch, and the
//             Arabic text carries full diacritics so it is pronounced correctly
//   off       silent (config/site-policy.json "voice": { "mode": "off" })
// Browsers only play sound after the user has clicked or pressed a key on the page: alerts that
// arrive before that wait (the last three) and play on the first click.
import { incidentSentence, sawnAlertOf } from '../shared/voiceText.js';

const KEY = 'sawn.voice.enabled';
export const VOICE_MODES = Object.freeze(['recorded', 'speech', 'off']);
export const SPEECH = Object.freeze({ rate: 0.9, pitch: 1.0 });
// Critical alerts: lower and slower — grave, not chatty.
export const SPEECH_CRITICAL = Object.freeze({ rate: 0.82, pitch: 0.75 });
// Chromium commonly populates speechSynthesis.getVoices() asynchronously.  A short wait avoids
// speaking the first incident in English just because the Arabic voice list is still loading.
export const VOICE_DISCOVERY_MS = 750;

const norm = (v) => String(v?.lang ?? '').replace('_', '-').toLowerCase();
/**
 * Higher = better. Hamed (Saudi, neural) > other neural Arabic > named Arabic voices on the computer
 * > ar-SA > ar-* > English > anything. The neural voices are Edge's online ones.
 */
export function voiceScore(v) {
  const lang = norm(v);
  const name = String(v?.name ?? '');
  if (lang.startsWith('ar')) {
    const saudi = lang === 'ar-sa' ? 5 : 0;
    if (/natural|neural/i.test(name)) return 100 + saudi + (/hamed/i.test(name) ? 3 : 0);
    if (/hamed|naayf|majed|maged|zariyah|tarik|laila/i.test(name)) return 80 + saudi;
    return 50 + saudi;
  }
  if (lang.startsWith('en')) return 10 + (v?.localService ? 1 : 0);
  return 0;
}

/**
 * What a sentence sounds like, not how it looks: emoji and decoration are dropped (a neural voice reads
 * "👋" or "👍" out as words), quotes and bullets go, and a dash becomes a pause.
 */
export function speakable(text) {
  return String(text ?? '')
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3]/gu, '')
    .replace(/[«»"“”•·⏹▶]/g, ' ')
    .replace(/\s*[—–]\s*/g, '، ')
    .replace(/\s+([،,.؟?!])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** An online voice (it needs the internet; when it fails, a voice on the computer takes over). */
export const isOnlineVoice = (v) => v?.localService === false || /online|natural|neural/i.test(String(v?.name ?? ''));

/** Best voice on this computer. @returns {{ voice, lang: 'ar' | 'en' }} */
export function pickVoice(voices = []) {
  let best = null;
  for (const v of voices) if (!best || voiceScore(v) > voiceScore(best)) best = v;
  return { voice: best, lang: best && voiceScore(best) >= 50 ? 'ar' : 'en' };
}

/**
 * @param synth      speechSynthesis (injectable for tests)
 * @param Utterance  SpeechSynthesisUtterance
 * @param AudioCtor  Audio (HTMLAudioElement) for recorded clips
 * @param storage    localStorage-like ({ getItem, setItem }) for the on/off choice
 * @param doc        document (for the first-click unlock); null = already unlocked
 */
// ownOnly: alerts are announced ONLY with SAWN's own recordings (sawn-<kind>-ar then -en); an incident
// with no such recording is not spoken, and the older generic phrases / browser speech are never used
// for alerts. (The assistant's say() below is not affected.)
export function createVoiceAlerts({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, AudioCtor = globalThis.Audio, storage = globalThis.localStorage, doc = globalThis.document, ownOnly = false } = {}) {
  const canSpeak = Boolean(synth && Utterance);
  let enabled = true;
  try {
    enabled = storage?.getItem(KEY) !== '0';
  } catch {
    // storage blocked: default on
  }
  let mode = 'speech';
  let clips = {}; // phrase key -> url of a real recording (missing / placeholder clips are absent)
  const spoken = new Set(); // incident ids already announced (never repeat one)
  let waiting = []; // sentences before the first click
  let waitingForVoice = []; // sentences held briefly while the browser loads Arabic voices
  let unlocked = !doc;
  let playing = Promise.resolve(); // recorded clips play one alert after another
  // One loudspeaker with the assistant (Abdullah): an alert waits until he finishes his sentence, and
  // he waits while an alert plays (otherBusy is set by the page; alertPlaying is read by it).
  let otherBusy = () => false;
  let alertPlaying = false;
  const OTHER_WAIT_MAX_MS = 30_000;
  const waitForOther = async () => {
    const until = Date.now() + OTHER_WAIT_MAX_MS;
    while (otherBusy() && Date.now() < until) await new Promise((r) => setTimeout(r, 200));
  };
  const playOwn = (urls) => {
    playing = playing.then(async () => {
      await waitForOther();
      alertPlaying = true;
      try {
        for (const url of urls) await playClip(url);
      } finally {
        alertPlaying = false;
      }
    });
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(enabled));
  const canRefreshVoices = Boolean(synth?.addEventListener || 'onvoiceschanged' in (synth ?? {}));
  let voices = [];
  let discoveryFinished = !canSpeak || !canRefreshVoices;
  let discoveryTimer = null;

  function loadVoices() {
    try {
      voices = [...(synth?.getVoices?.() ?? [])];
    } catch {
      voices = [];
    }
    return voices;
  }

  function selectedVoice() {
    return pickVoice(voices);
  }

  function hasArabicVoice() {
    return selectedVoice().lang === 'ar';
  }

  function sayNow(sentence) {
    if (!canSpeak) return 'none';
    const { voice, lang } = selectedVoice();
    const u = new Utterance(lang === 'ar' ? sentence.ar : sentence.en);
    u.lang = voice?.lang ?? (lang === 'ar' ? 'ar-SA' : 'en-US');
    if (voice) u.voice = voice;
    const tune = sentence.sev === 'crit' ? SPEECH_CRITICAL : SPEECH;
    u.rate = tune.rate;
    u.pitch = tune.pitch;
    synth.speak(u);
    return 'speech';
  }

  function clearVoiceWait() {
    if (discoveryTimer) clearTimeout(discoveryTimer);
    discoveryTimer = null;
    waitingForVoice = [];
  }

  function flushVoiceWait() {
    const queued = waitingForVoice;
    waitingForVoice = [];
    for (const sentence of queued) sayNow(sentence);
  }

  function finishVoiceDiscovery() {
    if (discoveryFinished) return;
    discoveryFinished = true;
    if (discoveryTimer) clearTimeout(discoveryTimer);
    discoveryTimer = null;
    flushVoiceWait();
  }

  function refreshVoices() {
    loadVoices();
    // Do not delay if an Arabic voice is already available.  If this browser exposes only
    // English at first, wait briefly for its voiceschanged event before using that fallback.
    if (hasArabicVoice()) finishVoiceDiscovery();
    emit();
  }

  function say(sentence) {
    if (!canSpeak) return 'none';
    if (discoveryFinished || hasArabicVoice()) return sayNow(sentence);
    waitingForVoice = [...waitingForVoice, sentence].slice(-3);
    if (!discoveryTimer) {
      discoveryTimer = setTimeout(() => finishVoiceDiscovery(), VOICE_DISCOVERY_MS);
    }
    return 'queued';
  }

  function playClip(url) {
    return new Promise((resolve) => {
      const a = new AudioCtor(url);
      a.onended = resolve;
      a.onerror = resolve;
      const p = a.play?.();
      if (p?.catch) p.catch(resolve);
    });
  }

  /** Recorded clips when every one of them exists, else the tuned speech. */
  function deliver(sentence) {
    // SAWN's own recorded announcement for this kind of incident (Arabic, then English) when both
    // recordings are on the platform; otherwise the generic level + phrase clips below.
    if (sentence.own && mode === 'recorded' && AudioCtor) {
      const keys = [...(sentence.clips[0] === 'p-sim' ? ['p-sim'] : []), `${sentence.own}-ar`, `${sentence.own}-en`];
      const own = keys.map((k) => clips[k]);
      if (own.every(Boolean)) {
        playOwn(own);
        return 'recorded';
      }
    }
    if (ownOnly) return 'none'; // no SAWN recording available for it: stay silent, never the old voice
    const urls = sentence.clips.map((k) => clips[k]);
    if (mode === 'recorded' && AudioCtor && urls.every(Boolean)) {
      playOwn(urls);
      return 'recorded';
    }
    return say(sentence);
  }

  if (canSpeak) {
    refreshVoices();
    const onVoicesChanged = () => refreshVoices();
    if (synth?.addEventListener) synth.addEventListener('voiceschanged', onVoicesChanged);
    else if (synth && 'onvoiceschanged' in synth) synth.onvoiceschanged = onVoicesChanged;
  }

  if (doc) {
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      const queued = waiting;
      waiting = [];
      if (enabled && mode !== 'off') for (const s of queued) deliver(s);
    };
    for (const ev of ['pointerdown', 'keydown']) doc.addEventListener(ev, unlock, { once: true, capture: true });
    synth?.getVoices?.(); // starts loading the voice list
  }

  return {
    /**
     * Speak a free sentence now (the Nashdan assistant), replacing what is being said. Not tied to
     * the alert switch: the assistant has its own. lang: 'ar' | 'en'. Returns false without speech.
     */
    say(text, { lang = 'ar', onend = null, voiceName = null } = {}) {
      text = speakable(text);
      if (!canSpeak || !text) return false;
      synth.cancel();
      // A voice the operator chose (Nashdan's voice picker), else the best one.
      const chosen = voiceName ? (synth.getVoices?.() ?? []).find((x) => x.name === voiceName) : null;
      const { voice, lang: best } = chosen ? { voice: chosen, lang: norm(chosen).startsWith('ar') ? 'ar' : 'en' } : selectedVoice();
      const u = new Utterance(String(text));
      if (lang === 'ar' && voice && best === 'ar') {
        u.voice = voice;
        u.lang = voice.lang;
      } else u.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
      u.rate = SPEECH.rate;
      u.pitch = SPEECH.pitch;
      // A neural voice sounds natural at the normal pace; the old voices are clearer a little slower.
      if (isOnlineVoice(u.voice)) u.rate = 1;
      if (onend) u.onend = () => onend();
      u.onerror = (e) => {
        // The online voice failed (no internet): the same sentence again with a voice on the computer.
        if (u.voice && isOnlineVoice(u.voice) && e?.error !== 'interrupted' && e?.error !== 'canceled') {
          const local = pickVoice((synth.getVoices?.() ?? []).filter((x) => !isOnlineVoice(x)));
          const again = new Utterance(String(text));
          if (lang === 'ar' && local.voice && local.lang === 'ar') {
            again.voice = local.voice;
            again.lang = local.voice.lang;
          } else again.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
          again.rate = SPEECH.rate;
          again.pitch = SPEECH.pitch;
          if (onend) again.onend = again.onerror = () => onend();
          synth.speak(again);
          return;
        }
        if (onend) onend();
      };
      synth.speak(u);
      return true;
    },
    /** The Arabic voices of this browser, best first: [{ name, lang, online }] (Nashdan's voice picker). */
    arabicVoices() {
      return (synth?.getVoices?.() ?? []).filter((v) => norm(v).startsWith('ar')).sort((a, b) => voiceScore(b) - voiceScore(a)).map((v) => ({ name: v.name, lang: v.lang, online: isOnlineVoice(v) }));
    },
    /** Stop speaking. */
    hush() {
      synth?.cancel?.();
    },
    /** fn() → true while the assistant is talking; alerts wait for it (at most 30 s). */
    setOtherBusy(fn) {
      otherBusy = typeof fn === 'function' ? fn : () => false;
    },
    /** True while a recorded alert is playing: the assistant waits for it. */
    get alertPlaying() {
      return alertPlaying;
    },
    get canSay() {
      return canSpeak;
    },
    get supported() {
      return canSpeak || (mode === 'recorded' && Boolean(AudioCtor));
    },
    get mode() {
      return mode;
    },
    /** The current browser choice, useful for an operator to confirm the Arabic voice in use. */
    get selectedVoice() {
      const { voice, lang } = selectedVoice();
      return { name: voice?.name ?? null, lang, loading: !discoveryFinished && !hasArabicVoice() };
    },
    /** Site setting from the server: { mode, clips: { key: { url, available } } }. */
    configure({ mode: m = 'speech', clips: c = {} } = {}) {
      mode = VOICE_MODES.includes(m) ? m : 'speech';
      clips = Object.fromEntries(Object.entries(c).filter(([, v]) => v?.available && v.url).map(([k, v]) => [k, v.url]));
      emit();
    },
    get enabled() {
      return enabled && mode !== 'off';
    },
    set enabled(v) {
      enabled = Boolean(v);
      try {
        storage?.setItem(KEY, enabled ? '1' : '0');
      } catch {
        // per-console convenience only
      }
      if (!enabled) {
        waiting = [];
        clearVoiceWait();
        synth?.cancel?.();
      }
      emit();
    },
    /** fn(enabled) whenever the toggle or the mode changes (keeps several toggle buttons in step). */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /**
     * Announces a new incident once. delayMs: wait first (e.g. for the incident alarm to finish).
     * @returns the sentence ({ ar, en, clips, via: 'recorded' | 'speech' | 'queued' | 'delayed' }) or null
     */
    announce(inc, { delayMs = 0 } = {}) {
      if (!inc || spoken.has(inc.id)) return null;
      spoken.add(inc.id); // also while muted: switching the voice on never replays old incidents
      if (!enabled || mode === 'off') return null;
      const sentence = incidentSentence(inc);
      if (!sentence) return null;
      const own = sawnAlertOf(inc);
      if (ownOnly && !own) return null; // only the new recorded alerts are spoken
      if (own) Object.defineProperty(sentence, 'own', { value: own, enumerable: false });
      if (!unlocked) {
        waiting = [...waiting, sentence].slice(-3);
        return { ...sentence, via: 'queued' };
      }
      if (delayMs > 0) {
        setTimeout(() => enabled && mode !== 'off' && deliver(sentence), delayMs);
        return { ...sentence, via: 'delayed' };
      }
      const via = deliver(sentence);
      return via === 'none' ? null : { ...sentence, via };
    },
  };
}
