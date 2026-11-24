import { DEFAULTS } from '../core/constants.js';
import { createMemoryPrefs } from './preferences.js';

export const AlarmSound = Object.freeze({
  UNAUTHORIZED: 'unauthorized', // high-priority siren: verified unauthorized devices only
  WARNING: 'warning', // attention tone: unknown device at a checkpoint
  RULE: 'rule', // softer chime for user-defined alert rules
  // New incidents, by severity (played before the spoken alert):
  DANGER: 'danger', // critical: impact, air-raid wail, low dissonant stabs (~3.6 s)
  THREAT: 'threat', // high: impact and a dissonant klaxon (~1.3 s)
  ALERT: 'alert', // warning level: urgent falling two-tone (~0.7 s)
});

// A higher-priority sound may cut in over a lower one; equal or lower never overlaps.
const PRIORITY = {
  [AlarmSound.DANGER]: 4,
  [AlarmSound.UNAUTHORIZED]: 3,
  [AlarmSound.THREAT]: 3,
  [AlarmSound.WARNING]: 2,
  [AlarmSound.ALERT]: 2,
  [AlarmSound.RULE]: 1,
};

// Unknown at a checkpoint: three clear alternating beeps — attention, not danger (~0.7 s).
export const WARNING_PATTERN = Object.freeze({ frequencies: [740, 988, 740], wave: 'triangle', noteSec: 0.16, gapSec: 0.08 });
export const WARNING_OSCILLATORS = WARNING_PATTERN.frequencies.length;

// Unauthorized: three rising, distorted, warbling siren wails followed by two harsh stabs (~2.4 s).
export const SIREN_PATTERN = Object.freeze({
  sweeps: 3,
  sweepSec: 0.55,
  gapSec: 0.07,
  fromHz: 420,
  toHz: 1500,
  detuneHz: 9, // second voice slightly off-pitch for a rough, beating tone
  warbleHz: 16,
  stabs: 2,
  stabHz: 1800,
  stabSec: 0.09,
  stabGapSec: 0.05,
});
// 2 voices per sweep + stabs + the warble LFO.
export const SIREN_OSCILLATORS = SIREN_PATTERN.sweeps * 2 + SIREN_PATTERN.stabs + 1;

// Rule alert: gentle two-note chime.
export const CHIME_PATTERN = Object.freeze({ frequencies: [880, 1175], noteSec: 0.18, gapSec: 0.04 });
export const CHIME_OSCILLATORS = CHIME_PATTERN.frequencies.length;

// Critical incident: a deep impact, two air-raid wails (rise and fall) doubled a semitone apart so
// they beat and grate, under a fast tremolo and distortion, then three low dissonant stabs.
export const DANGER_PATTERN = Object.freeze({
  boomFromHz: 95,
  boomToHz: 28,
  boomSec: 0.8,
  wails: 2,
  lowHz: 240,
  highHz: 920,
  riseSec: 0.85,
  fallSec: 0.55,
  semitone: 1.0595, // second voice a semitone up: the clash is what makes it unsettling
  tremoloHz: 7,
  stabs: 3,
  stabHz: [174.6, 185], // F3 + F#3, a minor second
  stabSec: 0.14,
  stabGapSec: 0.07,
});
// impact + (rise and fall, two voices) per wail + two voices per stab + tremolo LFO
export const DANGER_OSCILLATORS = 1 + DANGER_PATTERN.wails * 4 + DANGER_PATTERN.stabs * 2 + 1;

// High incident: an impact, then four harsh klaxon blasts a semitone apart.
export const THREAT_PATTERN = Object.freeze({ boomFromHz: 80, boomToHz: 35, boomSec: 0.45, blasts: 4, blastHz: [311, 330], blastSec: 0.2, gapSec: 0.1 });
export const THREAT_OSCILLATORS = 1 + THREAT_PATTERN.blasts * 2;

// Warning-level incident: an urgent falling two-tone, twice.
export const ALERT_PATTERN = Object.freeze({ frequencies: [932, 698, 932, 698], noteSec: 0.15, gapSec: 0.04 });
export const ALERT_OSCILLATORS = ALERT_PATTERN.frequencies.length;

// Cap master gain so 100% volume is loud but not painful.
const MAX_GAIN = {
  [AlarmSound.DANGER]: 0.4,
  [AlarmSound.THREAT]: 0.38,
  [AlarmSound.ALERT]: 0.4,
  [AlarmSound.UNAUTHORIZED]: 0.3,
  [AlarmSound.WARNING]: 0.45,
  [AlarmSound.RULE]: 0.35,
};

export const AudioStatus = Object.freeze({
  UNSUPPORTED: 'unsupported',
  LOCKED: 'locked', // browser autoplay policy: needs a user gesture
  MUTED: 'muted',
  ENABLED: 'enabled',
});

function defaultContextFactory() {
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return Ctor ? () => new Ctor() : null;
}

const clampVolume = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULTS.volume;
};

export class AudioAlertService {
  #ctx = null;
  #createContext;
  #prefs;
  #listeners = new Set();
  #busyUntil = 0;
  #busySound = null;
  #muted;
  #volume;
  #enabledThisSession;

  constructor({ createContext = defaultContextFactory(), prefs = createMemoryPrefs() } = {}) {
    this.#createContext = createContext;
    this.#prefs = prefs;
    const saved = prefs.load();
    this.#muted = saved.muted === true;
    this.#volume = clampVolume(saved.volume ?? DEFAULTS.volume);
    this.#enabledThisSession = saved.soundEnabled === true;
  }

  get supported() {
    return typeof this.#createContext === 'function';
  }

  get status() {
    if (!this.supported) return AudioStatus.UNSUPPORTED;
    if (!this.#isRunning()) return AudioStatus.LOCKED;
    return this.#muted ? AudioStatus.MUTED : AudioStatus.ENABLED;
  }

  get muted() {
    return this.#muted;
  }

  get volume() {
    return this.#volume;
  }

  get needsActivation() {
    return this.supported && !this.#isRunning();
  }

  /** True after a refresh when sound was enabled earlier in this session but the browser re-locked it. */
  get needsReactivation() {
    return this.#enabledThisSession && this.needsActivation;
  }

  /**
   * Creates the AudioContext without resuming it. If the browser's autoplay policy already
   * allows audio, the service becomes enabled with no click; otherwise it stays LOCKED.
   */
  probe() {
    if (!this.supported || this.#ctx) return this.status;
    try {
      this.#ctx = this.#makeContext();
    } catch (err) {
      console.warn('[SAWN] AudioContext could not be created', err);
    }
    this.#emit();
    return this.status;
  }

  /** Must be called from a user gesture (click/keypress) to satisfy autoplay restrictions. */
  async enable() {
    if (!this.supported) return false;
    try {
      this.#ctx ??= this.#makeContext();
      if (this.#ctx.state !== 'running') await this.#ctx.resume();
    } catch (err) {
      console.warn('[SAWN] Audio could not be enabled', err);
    }
    const ok = this.#isRunning();
    if (ok) {
      this.#enabledThisSession = true;
      this.#persist();
    }
    this.#emit();
    return ok;
  }

  setMuted(muted) {
    this.#muted = Boolean(muted);
    this.#persist();
    this.#emit();
  }

  toggleMute() {
    this.setMuted(!this.#muted);
    return this.#muted;
  }

  setVolume(volume) {
    this.#volume = clampVolume(volume);
    this.#persist();
    this.#emit();
  }

  /** Plays a sound unless muted, locked, silent, or another alert sound is already playing. */
  playAlarm(sound = AlarmSound.UNAUTHORIZED) {
    if (!this.supported) return { played: false, reason: 'unsupported' };
    if (this.#muted) return { played: false, reason: 'muted' };
    if (!this.#isRunning()) return { played: false, reason: 'locked' };
    if (this.#volume === 0) return { played: false, reason: 'volume-zero' };

    const now = this.#ctx.currentTime;
    const kind = PRIORITY[sound] ? sound : AlarmSound.UNAUTHORIZED;
    if (now < this.#busyUntil && PRIORITY[kind] <= PRIORITY[this.#busySound]) {
      return { played: false, reason: 'already-playing' };
    }

    try {
      const schedule = {
        [AlarmSound.UNAUTHORIZED]: scheduleSiren,
        [AlarmSound.WARNING]: scheduleWarning,
        [AlarmSound.RULE]: scheduleChime,
        [AlarmSound.DANGER]: scheduleDanger,
        [AlarmSound.THREAT]: scheduleThreat,
        [AlarmSound.ALERT]: scheduleAlert,
      }[kind];
      this.#busySound = kind;
      this.#busyUntil = schedule(this.#ctx, now + 0.02, this.#volume * MAX_GAIN[kind]);
    } catch (err) {
      console.warn('[SAWN] Alarm playback failed', err);
      return { played: false, reason: 'error' };
    }
    // seconds: how long until it ends (the spoken alert waits for it).
    return { played: true, endsAt: this.#busyUntil, seconds: Math.max(0, this.#busyUntil - now) };
  }

  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #makeContext() {
    const ctx = this.#createContext();
    ctx.addEventListener?.('statechange', () => this.#emit());
    return ctx;
  }

  #isRunning() {
    return this.#ctx?.state === 'running';
  }

  #persist() {
    this.#prefs.save({ muted: this.#muted, volume: this.#volume, soundEnabled: this.#enabledThisSession });
  }

  #emit() {
    this.#listeners.forEach((fn) => fn(this));
  }
}

/** Soft-clipping curve that makes the siren sound harsh and urgent. */
function distortionCurve(amount = 40, samples = 1024) {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/** One enveloped oscillator voice; returns the oscillator. */
function voice(ctx, { type, from, to, start, duration, destination, attack = 0.02, release = 0.04 }) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(1, start + attack);
  env.gain.setValueAtTime(1, start + duration - release);
  env.gain.linearRampToValueAtTime(0, start + duration);
  osc.connect(env);
  env.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
  return osc;
}

/** Unauthorized siren on the audio clock; returns the time it finishes. */
function scheduleSiren(ctx, start, gain) {
  const p = SIREN_PATTERN;
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);

  const shaper = ctx.createWaveShaper();
  shaper.curve = distortionCurve();
  shaper.oversample = '2x';
  shaper.connect(master);

  // Fast amplitude warble (tremolo) for an alarm-like pulsing.
  const warble = ctx.createGain();
  warble.gain.value = 0.75;
  warble.connect(shaper);
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.type = 'square';
  lfo.frequency.value = p.warbleHz;
  depth.gain.value = 0.25;
  lfo.connect(depth);
  depth.connect(warble.gain);

  let t = start;
  for (let i = 0; i < p.sweeps; i++) {
    voice(ctx, { type: 'sawtooth', from: p.fromHz, to: p.toHz, start: t, duration: p.sweepSec, destination: warble });
    voice(ctx, { type: 'square', from: p.fromHz + p.detuneHz, to: p.toHz + p.detuneHz, start: t, duration: p.sweepSec, destination: warble });
    t += p.sweepSec + p.gapSec;
  }
  let last = null;
  for (let i = 0; i < p.stabs; i++) {
    last = voice(ctx, { type: 'square', from: p.stabHz, start: t, duration: p.stabSec, destination: shaper, attack: 0.005, release: 0.01 });
    t += p.stabSec + p.stabGapSec;
  }
  lfo.start(start);
  lfo.stop(t);
  last.onended = () => master.disconnect();
  return t - p.stabGapSec;
}

/** Checkpoint warning beeps; returns the time they finish. */
function scheduleWarning(ctx, start, gain) {
  const p = WARNING_PATTERN;
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  let t = start;
  let last = null;
  for (const hz of p.frequencies) {
    last = voice(ctx, { type: p.wave, from: hz, start: t, duration: p.noteSec, destination: master, attack: 0.01, release: 0.03 });
    t += p.noteSec + p.gapSec;
  }
  last.onended = () => master.disconnect();
  return t - p.gapSec;
}

/** Rule-alert chime; returns the time it finishes. */
function scheduleChime(ctx, start, gain) {
  const p = CHIME_PATTERN;
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  let t = start;
  let last = null;
  for (const hz of p.frequencies) {
    last = voice(ctx, { type: 'sine', from: hz, start: t, duration: p.noteSec, destination: master, attack: 0.01, release: 0.08 });
    t += p.noteSec + p.gapSec;
  }
  last.onended = () => master.disconnect();
  return t - p.gapSec;
}

/** A deep falling sine "impact" straight to the master (no distortion, so it stays a thump). */
function impact(ctx, master, { fromHz, toHz, sec, start, level = 1.6 }) {
  const g = ctx.createGain();
  g.gain.value = level;
  g.connect(master);
  return voice(ctx, { type: 'sine', from: fromHz, to: toHz, start, duration: sec, destination: g, attack: 0.005, release: sec * 0.6 });
}

/** Critical incident alarm; returns the time it finishes. */
function scheduleDanger(ctx, start, gain) {
  const p = DANGER_PATTERN;
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  const shaper = ctx.createWaveShaper();
  shaper.curve = distortionCurve(60);
  shaper.oversample = '2x';
  shaper.connect(master);
  // Fast tremolo on the wail: it throbs instead of droning.
  const trem = ctx.createGain();
  trem.gain.value = 0.7;
  trem.connect(shaper);
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.type = 'square';
  lfo.frequency.value = p.tremoloHz;
  depth.gain.value = 0.3;
  lfo.connect(depth);
  depth.connect(trem.gain);

  impact(ctx, master, { fromHz: p.boomFromHz, toHz: p.boomToHz, sec: p.boomSec, start });
  let t = start + 0.12;
  for (let i = 0; i < p.wails; i++) {
    for (const k of [1, p.semitone]) {
      const type = k === 1 ? 'sawtooth' : 'square';
      voice(ctx, { type, from: p.lowHz * k, to: p.highHz * k, start: t, duration: p.riseSec, destination: trem, attack: 0.05, release: 0.02 });
      voice(ctx, { type, from: p.highHz * k, to: p.lowHz * k, start: t + p.riseSec, duration: p.fallSec, destination: trem, attack: 0.01, release: 0.08 });
    }
    t += p.riseSec + p.fallSec;
  }
  let last = null;
  t += 0.05;
  for (let i = 0; i < p.stabs; i++) {
    for (const hz of p.stabHz) last = voice(ctx, { type: 'square', from: hz, start: t, duration: p.stabSec, destination: shaper, attack: 0.004, release: 0.03 });
    t += p.stabSec + p.stabGapSec;
  }
  lfo.start(start);
  lfo.stop(t);
  last.onended = () => master.disconnect();
  return t - p.stabGapSec;
}

/** High incident alarm; returns the time it finishes. */
function scheduleThreat(ctx, start, gain) {
  const p = THREAT_PATTERN;
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  const shaper = ctx.createWaveShaper();
  shaper.curve = distortionCurve(50);
  shaper.oversample = '2x';
  shaper.connect(master);
  impact(ctx, master, { fromHz: p.boomFromHz, toHz: p.boomToHz, sec: p.boomSec, start, level: 1.3 });
  let t = start + 0.08;
  let last = null;
  for (let i = 0; i < p.blasts; i++) {
    for (const hz of p.blastHz) last = voice(ctx, { type: 'square', from: hz, start: t, duration: p.blastSec, destination: shaper, attack: 0.006, release: 0.03 });
    t += p.blastSec + p.gapSec;
  }
  last.onended = () => master.disconnect();
  return t - p.gapSec;
}

/** Warning-level incident alert; returns the time it finishes. */
function scheduleAlert(ctx, start, gain) {
  const p = ALERT_PATTERN;
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  let t = start;
  let last = null;
  for (const hz of p.frequencies) {
    last = voice(ctx, { type: 'triangle', from: hz, start: t, duration: p.noteSec, destination: master, attack: 0.008, release: 0.03 });
    t += p.noteSec + p.gapSec;
  }
  last.onended = () => master.disconnect();
  return t - p.gapSec;
}
