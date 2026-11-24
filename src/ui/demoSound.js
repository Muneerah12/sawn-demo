// Soft sound effects for the demo scenarios (Web Audio, no files):
//   ping   a track appears            chime  WARNING (two tones)            alarm  RESTRICTED / CRITICAL
// Browsers only allow sound after a user gesture: the context is created on the first click or key.

const KEY = 'sawn.demo.muted';

export function createDemoSound() {
  let ctx = null;
  let muted = false;
  try {
    muted = localStorage.getItem(KEY) === '1';
  } catch {
    // storage blocked: default unmuted
  }

  const unlock = () => {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
  };
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, unlock, { once: true, capture: true });

  function tone(freq, start, dur, { type = 'sine', gain = 0.12 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  return {
    get muted() {
      return muted;
    },
    set muted(v) {
      muted = Boolean(v);
      try {
        localStorage.setItem(KEY, muted ? '1' : '0');
      } catch {
        // per-console convenience only
      }
    },
    play(cue) {
      if (muted || !ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + 0.02;
      if (cue === 'ping') tone(1320, t, 0.25, { gain: 0.08 });
      else if (cue === 'chime') {
        tone(660, t, 0.35, { gain: 0.1 });
        tone(880, t + 0.22, 0.45, { gain: 0.1 });
      } else if (cue === 'alarm') {
        for (let i = 0; i < 3; i++) {
          tone(880, t + i * 0.42, 0.2, { type: 'triangle', gain: 0.12 });
          tone(620, t + i * 0.42 + 0.21, 0.2, { type: 'triangle', gain: 0.12 });
        }
      }
    },
  };
}
