// Detectors for the AI cameras, run in this browser on real video.
//  • objects: D-FINE-L (Apache 2.0; ONNX run by transformers.js on the GPU through WebGPU), else
//    RT-DETRv2-S (GPU or CPU), else COCO-SSD Lite (TensorFlow.js) — COCO's 80 classes: people,
//    phones / laptops, and knives / scissors / baseball bats reported as weapons (see DETECTORS).
//  • poses: MoveNet SinglePose Thunder (TensorFlow.js, Apache 2.0, from cache/models) — 17 body
//    keypoints per person, each person analysed on their own crop: wrists (weapon in hand, hands on
//    the fence), ankles, torso (falls). Tested on real video: more bodies found than MultiPose
//    Lightning on the whole frame or on crops, at the same speed.
//  • fire, smoke: OWLv2 (loadZeroShot) on the whole picture, plus a colour-and-motion rule
//    (createPixelAnalyzer) for fast candidates that OWLv2 checks close up before they are reported.

import { FIRE_DISTRACTORS, FIRE_PROMPTS, SMOKING_DISTRACTORS, SMOKING_PROMPTS, ZS_DISTRACTORS, ZS_GROUPS, zeroShotBest } from '../shared/cameraRules.js';

let modelPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(s);
  });
}

/** COCO-SSD, loaded once on first use (≈ 1.5 MB code + 17 MB weights, all from this server). */
export function loadObjectModel() {
  modelPromise ??= (async () => {
    // tf.min.js assigns the global regeneratorRuntime and, if that fails, falls back to
    // Function(…), which the console's Content-Security-Policy blocks. Declaring it first keeps
    // the policy strict (no 'unsafe-eval').
    if (!('regeneratorRuntime' in window)) window.regeneratorRuntime = undefined;
    if (!window.tf) await loadScript('vendor/tf/tf.min.js');
    if (!window.cocoSsd) await loadScript('vendor/tf/coco-ssd.min.js');
    try {
      await window.tf.setBackend('webgl');
    } catch {
      await window.tf.setBackend('cpu');
    }
    await window.tf.ready();
    return window.cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: 'vendor/models/ssdlite_mobilenet_v2/model.json' });
  })().catch((err) => {
    modelPromise = null;
    throw err;
  });
  return modelPromise;
}

let detectorPromise = null;
let zeroShotPromise = null;
const OWLV2 = 'onnx-community/owlv2-base-patch16-ONNX';
// People and objects, best first. D-FINE-L (Apache 2.0, Objects365 → COCO, COCO AP 57 vs 48 for
// RT-DETRv2-S). On 170 labelled photos, of the people only one of the two models found, D-FINE-L's
// were nearly all real (people lying down, far away, behind glass, silhouetted) and RT-DETRv2's often
// were not (flames, shadows, hands, hair, paper targets). Full precision only: in fp16 on WebGPU it
// returns flat, meaningless scores. ~0.15 s a frame on an Apple M4 GPU; far too slow on the CPU, so
// RT-DETRv2 int8 there. On a laptop GPU it is too slow as well (measured on Intel Iris Xe: D-FINE-L
// 1.3 s a frame, RT-DETRv2 fp16 0.25 s), so each model is timed once loaded and one slower than
// MAX_FRAME_MS gives way to the next; the choice is remembered in this browser (DETECTOR_KEY).
const MAX_FRAME_MS = 500;
// A GPU that runs the fast model (RT-DETRv2) this quickly is strong enough to try D-FINE-L.
const STRONG_GPU_MS = 120;
const DETECTOR_KEY = 'sawn.detector';
const DETECTORS = [
  { name: 'D-FINE-L', id: 'onnx-community/dfine_l_obj2coco_e25-ONNX', device: 'webgpu', dtype: 'fp32', strong: 0.55, weak: 0.4, timed: true },
  { name: 'RT-DETRv2', id: 'onnx-community/rtdetr_v2_r18vd-ONNX', device: 'webgpu', dtype: 'fp16', strong: 0.5, weak: 0.35 },
  { name: 'RT-DETRv2', id: 'onnx-community/rtdetr_v2_r18vd-ONNX', device: 'wasm', dtype: 'q8', strong: 0.5, weak: 0.35 },
];

/** transformers.js, set up once to load models and ONNX Runtime from this server only. */
async function transformers() {
  const t = await import('/sawn-demo/vendor/tjs/transformers.js');
  t.env.allowRemoteModels = false;
  t.env.allowLocalModels = true;
  // The models come from this server (cache/models); a second copy in the browser's Cache Storage
  // only took disk space (≈ 0.75 GB in the test, on a disk that was full).
  t.env.useBrowserCache = false;
  t.env.localModelPath = '/sawn-demo/vendor/hf/';
  t.env.backends.onnx.wasm.wasmPaths = '/sawn-demo/vendor/ort/';
  t.env.backends.onnx.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  return t;
}

/*
 * ONNX Runtime (WebGPU) crashes — "memory access out of bounds", then every model hangs — when a model
 * is created while another one is running (reproduced in Chrome: OWLv2 loading while the people
 * detector analyses a camera). Runs may overlap each other (tested); creating a model waits until
 * nothing runs, and runs wait while a model is being created.
 */
const onnx = { runs: 0, creating: null, idle: [] };
async function onnxRun(fn) {
  while (onnx.creating) await onnx.creating.catch(() => {});
  onnx.runs++;
  try {
    return await fn();
  } finally {
    if (--onnx.runs === 0) for (const wake of onnx.idle.splice(0)) wake();
  }
}
async function onnxCreate(fn) {
  while (onnx.creating) await onnx.creating.catch(() => {});
  const p = (async () => {
    while (onnx.runs) await new Promise((r) => onnx.idle.push(r));
    return fn();
  })();
  onnx.creating = p;
  try {
    return await p;
  } finally {
    if (onnx.creating === p) onnx.creating = null;
  }
}

async function gpuAdapter() {
  return navigator.gpu ? navigator.gpu.requestAdapter().catch(() => null) : null;
}

/**
 * OWLv2 (Apache 2.0), an open-vocabulary detector told in words what to look for: firearms, knives
 * and smoke, which COCO models do not know (no gun class) or see poorly. A second look: ~4 s per
 * frame on an integrated GPU, so it runs only with WebGPU (on the CPU it would take ~15 s).
 * Resolves to { name, run(canvas) → zeroShotBest(…) } or null.
 */
export function loadZeroShot() {
  zeroShotPromise ??= (async () => {
    try {
      if (!(await gpuAdapter())) return null;
      const { pipeline, RawImage } = await transformers();
      const created = await onnxCreate(() => pipeline('zero-shot-object-detection', OWLV2, { device: 'webgpu', dtype: 'fp16' }));
      const det = (...args) => onnxRun(() => created(...args));
      const labels = [...Object.values(ZS_GROUPS).flat(), ...ZS_DISTRACTORS];
      const groupOf = Object.fromEntries(Object.entries(ZS_GROUPS).flatMap(([g, ps]) => ps.map((p) => [p, g])));
      const run = async (canvas) => zeroShotBest(await det(RawImage.fromCanvas(canvas), labels, { threshold: 0.1, top_k: 50 }), canvas.width, canvas.height);
      /**
       * Looks again at a close crop (canvas, pixels [x, y, w, h]) enlarged to 640 px: the best `group`
       * box near its centre and the best other object there (hands do not count).
       */
      const zoom = async (canvas, [x, y, w, h], group) => {
        const c = Object.assign(document.createElement('canvas'), { width: 640, height: 640 });
        c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, 640, 640);
        const preds = await det(RawImage.fromCanvas(c), labels, { threshold: 0.05, top_k: 50 });
        const near = preds.filter((p) => p.label !== 'a hand' && Math.abs((p.box.xmin + p.box.xmax) / 1280 - 0.5) < 0.25 && Math.abs((p.box.ymin + p.box.ymax) / 1280 - 0.5) < 0.25);
        return {
          weapon: Math.max(0, ...near.filter((p) => groupOf[p.label] === group).map((p) => p.score)),
          rival: Math.max(0, ...near.filter((p) => groupOf[p.label] !== group).map((p) => p.score)),
          cigarette: Math.max(0, ...near.filter((p) => p.label === 'a cigarette').map((p) => p.score)),
        };
      };
      /** Smoking: the head-and-hands crop (pixels [x, y, w, h] of canvas) → best cigarette and best other object. */
      const smokingLabels = [...SMOKING_PROMPTS, ...SMOKING_DISTRACTORS];
      const smoking = async (canvas, [x, y, w, h]) => {
        const c = Object.assign(document.createElement('canvas'), { width: 640, height: 640 });
        c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, 640, 640);
        const preds = await det(RawImage.fromCanvas(c), smokingLabels, { threshold: 0.05, top_k: 50 });
        const best = (want) => Math.max(0, ...preds.filter((p) => want(p.label)).map((p) => p.score));
        return { cig: best((l) => SMOKING_PROMPTS.includes(l)), rival: best((l) => SMOKING_DISTRACTORS.includes(l) && l !== 'a hand') };
      };
      /** Fire: a close crop around a fire candidate → best fire / flames and best other object. */
      const fireLabels = [...FIRE_PROMPTS, ...FIRE_DISTRACTORS];
      const fire = async (canvas, [x, y, w, h]) => {
        const c = Object.assign(document.createElement('canvas'), { width: 640, height: 640 });
        c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, 640, 640);
        const preds = await det(RawImage.fromCanvas(c), fireLabels, { threshold: 0.05, top_k: 50 });
        const best = (want) => Math.max(0, ...preds.filter((p) => want(p.label)).map((p) => p.score));
        return { fire: best((l) => FIRE_PROMPTS.includes(l)), rival: best((l) => FIRE_DISTRACTORS.includes(l)) };
      };
      await run(Object.assign(document.createElement('canvas'), { width: 64, height: 64 }));
      return { name: 'OWLv2 · GPU', run, zoom, smoking, fire };
    } catch (err) {
      console.warn(`[zero-shot] OWLv2 not available: ${err.message}`);
      return null;
    }
  })();
  return zeroShotPromise;
}

/**
 * The person / object detector, loaded once: D-FINE-L on WebGPU, else RT-DETRv2 on WebGPU (fp16) or
 * WASM (int8), else COCO-SSD Lite. Resolves to { name, strong, weak, detect(canvas) → [{ class, score,
 * bbox: [x, y, w, h] }] } (pixels of the canvas); strong / weak are its person-score thresholds (each
 * model's scores are calibrated differently).
 */
export function loadDetector() {
  detectorPromise ??= (async () => {
    try {
      const { pipeline, RawImage } = await transformers();
      const gpu = await gpuAdapter();
      const probe = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
      let slow = null;
      try {
        slow = localStorage.getItem(DETECTOR_KEY);
      } catch {}
      const make = async (m) => {
        const created = await onnxCreate(() => pipeline('object-detection', m.id, { device: m.device, dtype: m.dtype }));
        const det = (...args) => onnxRun(() => created(...args));
        const detect = async (canvas) =>
          (await det(RawImage.fromCanvas(canvas), { threshold: 0.3 })).map((p) => ({ class: p.label, score: p.score, bbox: [p.box.xmin, p.box.ymin, p.box.xmax - p.box.xmin, p.box.ymax - p.box.ymin] }));
        await detect(probe); // fails here, not on the first real frame, if this device cannot run it
        return { m, created, detect, out: { name: `${m.name} · ${m.device === 'webgpu' ? 'GPU' : 'CPU'}`, strong: m.strong, weak: m.weak, detect } };
      };
      // The model's own input size (640 px) whatever the picture: two runs after the first give its pace.
      const pace = async (detect) => {
        const t0 = performance.now();
        await detect(probe);
        await detect(probe);
        return (performance.now() - t0) / 2;
      };
      const drop = async (x) => {
        try {
          await x?.created?.dispose?.();
        } catch {}
      };
      const markSlow = (m) => {
        try {
          localStorage.setItem(DETECTOR_KEY, `${m.id}|slow`);
        } catch {}
      };
      const [best, fast, cpu] = DETECTORS;
      if (gpu) {
        // The fast model first: a camera is analysing within seconds. Only a GPU that runs it well
        // under STRONG_GPU_MS tries the more accurate D-FINE-L (on Intel Iris Xe the fast model takes
        // ~250 ms and D-FINE-L 1.3–8.9 s a frame: loading and timing it held the camera ~50 s).
        try {
          const f = await make(fast);
          const fMs = await pace(f.detect);
          if (fMs <= STRONG_GPU_MS && slow !== `${best.id}|slow`) {
            try {
              const b = await make(best);
              const bMs = await pace(b.detect);
              if (bMs <= MAX_FRAME_MS) {
                await drop(f);
                return b.out;
              }
              console.warn(`[detector] ${best.name} takes ${Math.round(bMs)} ms a frame on this GPU — keeping ${fast.name}`);
              markSlow(best);
              await drop(b);
            } catch (err) {
              console.warn(`[detector] ${best.name} failed: ${err.message}`);
            }
          } else if (fMs > STRONG_GPU_MS) markSlow(best);
          return f.out;
        } catch (err) {
          console.warn(`[detector] ${fast.name} on the GPU failed: ${err.message}`);
        }
      }
      try {
        return (await make(cpu)).out;
      } catch (err) {
        console.warn(`[detector] ${cpu.name} on the CPU failed: ${err.message}`);
      }
    } catch (err) {
      console.warn(`[detector] transformers.js not available: ${err.message}`);
    }
    const coco = await loadObjectModel();
    return { name: 'COCO-SSD Lite', strong: 0.55, weak: 0.4, detect: (canvas) => coco.detect(canvas, 20, 0.4) };
  })();
  return detectorPromise;
}

let poseFailed = false;
let posePromise = null;

/**
 * MoveNet SinglePose Thunder, loaded once on first use (≈ 13 MB weights from this server). Resolves to null
 * when it cannot load (model not downloaded yet): the cameras then judge people by their boxes.
 */
export function loadPoseModel() {
  if (poseFailed) return Promise.resolve(null);
  posePromise ??= (async () => {
    await loadObjectModel(); // TensorFlow.js and its backend
    if (!window.poseDetection) await loadScript('vendor/tf/pose-detection.min.js');
    const pd = window.poseDetection;
    return pd.createDetector(pd.SupportedModels.MoveNet, {
      modelType: pd.movenet.modelType.SINGLEPOSE_THUNDER,
      modelUrl: 'vendor/models/movenet_singlepose_thunder/model.json',
      // Keep weak poses (people in the dark score ~0.3 overall): each keypoint is checked on its own.
      minPoseScore: 0.05,
      enableTracking: false, // people are tracked by the cameras' own tracker
    });
  })().catch((err) => {
    console.warn(`[poses] not available: ${err.message}`);
    poseFailed = true;
    return null;
  });
  return posePromise;
}

const CROP_W = 192;
const CROP_H = 256;
let cropCanvas = null;

/**
 * Body keypoints for each person box (top-down): every person is cut out of the full-resolution
 * picture with a margin, enlarged to 192 × 256 and given to MoveNet on its own. On the whole frame
 * MoveNet sees only 256 px, so people far from the camera (40 px tall) get no pose at all.
 * boxes: [x, y, w, h] in 0..1; source: the video / image (any size). Returns { name: [x, y] } (0..1)
 * or null per box; the largest `max` people only.
 */
export async function posesForPeople(detector, source, boxes, { max = 6, minScore = 0.3 } = {}) {
  const out = boxes.map(() => null);
  if (!detector || !boxes.length) return out;
  const SW = source.videoWidth || source.naturalWidth || source.width;
  const SH = source.videoHeight || source.naturalHeight || source.height;
  cropCanvas ??= Object.assign(document.createElement('canvas'), { width: CROP_W, height: CROP_H });
  const g = cropCanvas.getContext('2d', { willReadFrequently: true });
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b][2] * boxes[b][3] - boxes[a][2] * boxes[a][3]).slice(0, max);
  for (const i of order) {
    const [x, y, w, h] = boxes[i];
    // Crop with a margin, widened or heightened to the crop's 3:4 shape, centred on the person.
    let cw = w * 1.3 * SW;
    let ch = h * 1.15 * SH;
    if (cw / ch > CROP_W / CROP_H) ch = (cw * CROP_H) / CROP_W;
    else cw = (ch * CROP_W) / CROP_H;
    const sx = (x + w / 2) * SW - cw / 2;
    const sy = (y + h / 2) * SH - ch / 2;
    g.fillStyle = '#000';
    g.fillRect(0, 0, CROP_W, CROP_H);
    // Only the part of the crop inside the picture is drawn (the rest stays black).
    const ix = Math.max(0, sx);
    const iy = Math.max(0, sy);
    const iw = Math.min(SW, sx + cw) - ix;
    const ih = Math.min(SH, sy + ch) - iy;
    if (iw <= 1 || ih <= 1) continue;
    g.drawImage(source, ix, iy, iw, ih, ((ix - sx) * CROP_W) / cw, ((iy - sy) * CROP_H) / ch, (iw * CROP_W) / cw, (ih * CROP_H) / ch);
    const poses = await detector.estimatePoses(cropCanvas, { maxPoses: 3 });
    // The pose of this person: most confident keypoints inside their own box.
    const inBox = (k) => {
      const px = sx + (k.x * cw) / CROP_W;
      const py = sy + (k.y * ch) / CROP_H;
      return px >= x * SW && px <= (x + w) * SW && py >= y * SH && py <= (y + h) * SH;
    };
    let best = null;
    let bestN = 3;
    for (const p of poses) {
      const n = p.keypoints.filter((k) => (k.score ?? 0) >= minScore && inBox(k)).length;
      if (n > bestN) [best, bestN] = [p, n];
    }
    if (!best) continue;
    const kp = {};
    for (const k of best.keypoints) if (k.name && (k.score ?? 0) >= minScore) kp[k.name] = [(sx + (k.x * cw) / CROP_W) / SW, (sy + (k.y * ch) / CROP_H) / SH];
    out[i] = kp;
  }
  return out;
}

/** Skeleton lines between MoveNet keypoints, for drawing. */
export const SKELETON = [
  ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'], ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
];

export const WEAPON_CLASSES = new Set(['knife', 'scissors', 'baseball bat']);

/**
 * Colour / motion analysis on a small frame (ImageData). Keeps a background model per source.
 * Returns { fire, smoke }: each null or { conf, box: [x, y, w, h] (0..1) }.
 */
export function createPixelAnalyzer() {
  let bg = null; // running-average grey background
  let prevGrey = null;
  let smokeHistory = []; // last regions (or null), newest last
  let fireHistory = [];

  return function analyze(img, { fire = false, smoke = false, mask = [] } = {}) {
    const { data, width: w, height: h } = img;
    const n = w * h;
    // Cells inside a person's box (grown by 10 %) are left out: moving clothes are not flames or smoke.
    const masked = new Uint8Array(n);
    for (const [bx, by, bw, bh] of mask) {
      const x0 = Math.max(0, Math.floor((bx - bw * 0.1) * w));
      const x1 = Math.min(w - 1, Math.ceil((bx + bw * 1.1) * w));
      const y0 = Math.max(0, Math.floor((by - bh * 0.1) * h));
      const y1 = Math.min(h - 1, Math.ceil((by + bh * 1.1) * h));
      for (let y = y0; y <= y1; y++) masked.fill(1, y * w + x0, y * w + x1 + 1);
    }
    const grey = new Float32Array(n);
    for (let i = 0; i < n; i++) grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    if (!bg) {
      bg = Float32Array.from(grey);
      prevGrey = grey;
      return { fire: null, smoke: null };
    }
    // Whole picture changing (camera moved, lights switched): learn it, report nothing.
    let changed = 0;
    for (let i = 0; i < n; i++) if (Math.abs(grey[i] - bg[i]) > 25) changed++;
    const globalChange = changed / n > 0.45;

    const out = { fire: null, smoke: null };
    // Tested on real video: orange clothes passed for flames and scattered motion all over a crowd
    // for smoke. Flames and smoke are one connected patch that stays in place (a flame flickers
    // where it burns, clothes walk across the picture), so only such a patch counts.
    if (fire) {
      // Flame colours (bright, red ≥ green > blue, saturated) that flicker between frames.
      const flags = new Uint8Array(n);
      if (!globalChange) {
        for (let i = 0; i < n; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          if (!masked[i] && r > 180 && r >= g && g > b && r - b > 90 && Math.abs(grey[i] - prevGrey[i]) > 6) flags[i] = 1;
        }
      }
      const blob = largestBlob(flags, w, h);
      const reg = blob.length >= 8 ? region(blob, w, h, Math.min(0.97, 0.55 + (blob.length / n) * 25)) : null;
      fireHistory = [...fireHistory.slice(-(STEADY_FIRE - 1)), reg];
      if (reg && steady(fireHistory, STEADY_FIRE, 0.08)) out.fire = reg;
    }
    if (smoke) {
      // Moving, low-saturation regions that differ from the background.
      const flags = new Uint8Array(n);
      if (!globalChange) {
        for (let i = 0; i < n; i++) {
          const d = Math.abs(grey[i] - bg[i]);
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          // Smoke also churns from frame to frame: a ghost left where someone stood (the background
          // still learning the spot) differs from the background but does not move.
          if (!masked[i] && sat < 28 && grey[i] > 70 && grey[i] < 235 && d > 14 && Math.abs(grey[i] - prevGrey[i]) > 3) flags[i] = 1;
        }
      }
      const blob = largestBlob(flags, w, h);
      let reg = null;
      if (blob.length >= n * 0.015) {
        reg = region(blob, w, h, Math.min(0.9, 0.45 + (blob.length / n) * 4));
        const [, , bw, bh] = reg.box;
        if (blob.length / (bw * w * bh * h) < 0.3) reg = null; // a thin web of motion, not a cloud
      }
      smokeHistory = [...smokeHistory.slice(-(STEADY_SMOKE - 1)), reg];
      if (reg && steady(smokeHistory, STEADY_SMOKE, 0.12)) out.smoke = reg;
    }
    // Slow background update; faster while nothing is moving.
    const k = globalChange ? 0.5 : 0.03;
    for (let i = 0; i < n; i++) bg[i] += (grey[i] - bg[i]) * k;
    prevGrey = grey;
    return out;
  };
}

const STEADY_FIRE = 3; // frames in a row (≈ 0.9 s)
const STEADY_SMOKE = 6; // ≈ 1.8 s

/** The last `count` regions all exist and their centres stay within `dist` (picture units) of their mean. */
function steady(history, count, dist) {
  if (history.length < count || history.some((r) => !r)) return false;
  const c = history.map(({ box: [x, y, w, h] }) => [x + w / 2, y + h / 2]);
  const mx = c.reduce((s, p) => s + p[0], 0) / c.length;
  const my = c.reduce((s, p) => s + p[1], 0) / c.length;
  return c.every(([x, y]) => Math.hypot(x - mx, y - my) <= dist);
}

/** Cells of the largest 8-connected patch of set flags. */
export function largestBlob(flags, w, h) {
  const seen = new Uint8Array(flags.length);
  let best = [];
  const stack = [];
  for (let s = 0; s < flags.length; s++) {
    if (!flags[s] || seen[s]) continue;
    const blob = [];
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      blob.push(i);
      const x = i % w;
      const y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (flags[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    if (blob.length > best.length) best = blob;
  }
  return best;
}

/** Bounding box (0..1) of the cells. */
function region(cells, w, h, conf) {
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (const i of cells) {
    const x = i % w;
    const y = (i / w) | 0;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { conf, box: [x0 / w, y0 / h, (x1 - x0 + 1) / w, (y1 - y0 + 1) / h] };
}

/** Simple tracker: matches people between frames by the nearest centre. */
export function createTracker() {
  let next = 1;
  let tracks = [];
  return function update(boxes) {
    const used = new Set();
    const out = [];
    for (const b of boxes) {
      const cx = b[0] + b[2] / 2;
      const cy = b[1] + b[3] / 2;
      let best = null;
      let bestD = 0.12;
      for (const t of tracks) {
        if (used.has(t.id)) continue;
        const d = Math.hypot(t.cx - cx, t.cy - cy);
        if (d < bestD) {
          best = t;
          bestD = d;
        }
      }
      const id = best ? best.id : next++;
      used.add(id);
      out.push({ id, cx, cy, box: b, feet: [cx, b[1] + b[3]], seen: 0 });
    }
    // Keep lost tracks a few frames so a missed detection does not count as leaving.
    for (const t of tracks) if (!used.has(t.id) && t.seen < 4) out.push({ ...t, seen: t.seen + 1, ghost: true });
    tracks = out;
    return out;
  };
}

export function pointInPolygon([x, y], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
