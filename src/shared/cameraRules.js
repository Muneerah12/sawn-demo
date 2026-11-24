// Behaviour rules for the AI cameras. The console's model finds people in each frame and a simple
// tracker follows them; these rules turn the tracks into events over time:
//   • sensitive area (permit needed): someone inside without a permit, trying the door, or staying
//     longer than the zone allows;
//   • tower / perimeter: someone loitering, circling the building, climbing the fence;
//   • behaviour: running, a person down.
// Pure functions of the tracks and the clock (no DOM), so they run in the browser and in tests.

export const CAMERA_ROLES = Object.freeze({
  general: 'General camera',
  sensitive: 'Sensitive area camera (permit needed)',
  tower: 'Tower 360° camera (perimeter)',
});

export const ZONE_TYPES = Object.freeze({
  restricted: 'Sensitive area (permit needed)',
  door: 'Door',
  fence: 'Fence / wall (climbing)',
  watch: 'Watch zone (log entries only)',
});

/** Analyses a role always needs, added to the ones chosen by hand. */
export const ROLE_ANALYZERS = Object.freeze({
  general: [],
  sensitive: ['objects', 'zones'],
  tower: ['objects', 'behaviour', 'zones', 'fire', 'smoke'],
});

export const RULES = Object.freeze({
  dwellMin: 5, // sensitive area: minutes inside before "staying too long"
  enterSec: 1, // inside this long before it counts as an entry (ignores a box flickering at the edge)
  doorSec: 4, // at the door this long without a permit = trying to open it
  gapSec: 10, // a person unseen for less than this is still the same visit
  loiterMin: 2, // someone in the tower's view this long = loitering
  circlingSec: 30, // circling needs at least this much time on the move…
  circlingSpan: 0.3, // …walking back and forth over this share of the picture (two turns)…
  aroundSpan: 0.75, // …or sweeping across most of the 360° picture
  turnDist: 0.05, // walking back this far from the furthest point = a turn
  runSpeed: 1.5, // body heights per second
  runSec: 1.5,
  fallRatio: 1.25, // box wider than tall by this much = lying
  fallSec: 3,
  climbRise: 0.2, // feet this share of the fence height above its base = on the fence
  climbSec: 1,
  climbTop: 0.15, // the top of the body (head / raised hands) within this share of the fence height of its top
  climbMinSize: 0.6, // a climber is at least this share of the fence height tall (smaller = far behind it)
  climbKeepSize: 0.8, // …and keeps this share of the height they had at the fence base (smaller = walking away)
  presenceSec: 3, // tower: someone in view this long = a person near the building
  edge: 0.06, // 360° picture: leaving at one edge and coming back at the other is the same walk
  wrapSec: 6,
  forgetSec: 5,
});

export function inPolygon([x, y], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bounds(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

const mins = (ms) => Math.max(1, Math.round(ms / 60_000));

// ---------------------------------------------------------------- body keypoints (MoveNet)
// A pose is { name: [x, y] } in 0..1 picture units with only the confident points (MoveNet names:
// nose, left_shoulder, right_shoulder, left_wrist, right_wrist, left_hip, right_hip, left_ankle…).
// Every rule below uses them when they are there and falls back to the person's box when not.
export const KP_MIN_SCORE = 0.3;

/** MoveNet pose (pixel keypoints with scores) → { name: [x, y] } in 0..1 units, confident points only. */
export function keypointsOf(pose, width, height, min = KP_MIN_SCORE) {
  const kp = {};
  for (const k of pose?.keypoints ?? []) if (k.name && (k.score ?? 0) >= min) kp[k.name] = [k.x / width, k.y / height];
  return kp;
}

/**
 * Gives each person box the pose most of whose keypoints lie inside it (the box grown by 10 %).
 * Returns one pose (or null) per box, each pose used once.
 */
export function attachPoses(boxes, poses) {
  const out = boxes.map(() => null);
  const used = new Set();
  boxes.forEach(([x, y, w, h], i) => {
    let best = -1;
    let bestShare = 0.6;
    poses.forEach((kp, j) => {
      if (used.has(j)) return;
      const pts = Object.values(kp);
      if (pts.length < 4) return;
      const inside = pts.filter(([px, py]) => px >= x - w * 0.1 && px <= x + w * 1.1 && py >= y - h * 0.1 && py <= y + h * 1.1).length / pts.length;
      if (inside > bestShare) [best, bestShare] = [j, inside];
    });
    if (best >= 0) {
      used.add(best);
      out[i] = poses[best];
    }
  });
  return out;
}

// ---------------------------------------------------------------- open-vocabulary second look (OWLv2)
// Prompts per target, plus distractors: things people hold that are not weapons, so a phone or an
// umbrella is labelled as such instead of as the nearest weapon. Every box keeps its best prompt.
export const ZS_GROUPS = Object.freeze({
  gun: ['a gun', 'a handgun', 'a pistol', 'a rifle'],
  knife: ['a knife', 'a blade', 'a machete'],
  smoke: ['smoke', 'a smoke plume'],
  fire: ['fire', 'flames', 'a burning fire'],
});
// 'a cigarette': in the console test a cigarette in the hand read as 'a blade' (0.41) without it.
// Lamps, lights and sunsets: what flames are confused with.
export const ZS_DISTRACTORS = Object.freeze(['a mobile phone', 'an umbrella', 'a camera', 'a hand', 'a bottle', 'a tool', 'a cigarette', 'clouds', 'the sky', 'fog', 'a lamp', 'a light', 'a sunset']);
// Thresholds from the test on 81 labelled images (15 guns, 12 knives, 11 smoke, 28 CCTV frames from
// real footage, 15 people holding phones / umbrellas / cameras): guns 15/15, knives 12/12, smoke 9/11,
// no false alarm at these values. The lowest true score was 0.32 (gun) / 0.25 (knife); the highest
// on the CCTV frames 0.18 / 0.14 / 0.14. A target counts when it scores `high` once, or `low` in two
// looks in a row.
// Smoke is stricter (0.35 / 0.5): a cloudy sky reached 0.43 in the video test, real smoke 0.42–0.71
// — smoke against clouds is still not reliable.
// Fire (whole picture, 640 × 360): the four fire videos scored 0.47–0.68 in most looks (a campfire
// among people, a distant house fire, a bonfire, a car fire); 15 no-fire videos (tail lights, neon,
// sunsets, orange clothes, crowds) at most 0.45, once. Photos: 15 of 20 fires ≥ 0.4, 1 of 150 others
// (a smoke plume, 0.45). The guns / knives were re-checked on 170 photos: guns 34/35, knives 13/18
// (misses: cooking and sharpening), 2 false alarms on 118 weapon-free photos.
export const ZS_THRESHOLDS = Object.freeze({ gun: { low: 0.25, high: 0.4 }, knife: { low: 0.22, high: 0.4 }, smoke: { low: 0.35, high: 0.5 }, fire: { low: 0.4, high: 0.5 } });

/**
 * Zoom check for a weapon candidate: in a small view a black camera scored "handgun 0.83" (video
 * test: 7 false alarms in 8 frames). Looked at again on a close crop, the camera read "camera
 * 0.64–0.75" and every real weapon but one stayed a weapon (22/23, 0 false). The crop: centred on
 * the candidate, 3× its size and at least 30 % of the picture's short side, kept inside the picture.
 * box: [x, y, w, h] (0..1) of a width × height picture; returns the crop in pixels [x, y, w, h].
 */
export function zoomRect([bx, by, bw, bh], width, height) {
  const side = Math.min(Math.max(3 * Math.max(bw * width, bh * height), 0.3 * Math.min(width, height)), Math.min(width, height));
  const x = Math.min(Math.max(0, (bx + bw / 2) * width - side / 2), width - side);
  const y = Math.min(Math.max(0, (by + bh / 2) * height - side / 2), height - side);
  return [Math.round(x), Math.round(y), Math.round(side), Math.round(side)];
}

/**
 * The verdict on the zoomed crop: the best weapon box near the crop's centre must reach the target's
 * low threshold and be close to (75 % of) the best other object there — a real pistol read
 * "pistol 0.35" next to "bottle 0.38"; the camera read "camera 0.64" with no weapon at all.
 */
export function zoomConfirms({ weapon = 0, rival = 0 }, low) {
  return weapon >= low && weapon >= 0.75 * rival;
}

/**
 * A knife must also beat 'a cigarette' outright on the close-up: in the console test a cigarette in
 * the hand kept reading as a blade (0.41) — a real knife or machete outscores a cigarette easily.
 */
export function knifeConfirms(z, low) {
  return zoomConfirms(z, low) && (z.weapon ?? 0) > (z.cigarette ?? 0);
}

/**
 * Best box per target from zero-shot predictions ([{ label, score, box: { xmin, ymin, xmax, ymax } }]
 * in pixels of a width × height picture). Boxes overlapping a stronger one (IoU > 0.6) are the same
 * object under another prompt and are dropped first. Returns { gun, knife, smoke, fire }: null or
 * { score, label, box: [x, y, w, h] (0..1) }.
 */
export function zeroShotBest(preds, width, height) {
  const groupOf = Object.fromEntries(Object.entries(ZS_GROUPS).flatMap(([g, ps]) => ps.map((p) => [p, g])));
  const kept = [];
  for (const p of [...preds].sort((a, b) => b.score - a.score)) {
    const box = [p.box.xmin / width, p.box.ymin / height, (p.box.xmax - p.box.xmin) / width, (p.box.ymax - p.box.ymin) / height];
    if (kept.some((k) => iou(k.box, box) > 0.6)) continue;
    kept.push({ group: groupOf[p.label] ?? null, score: p.score, label: p.label, box });
  }
  return Object.fromEntries(Object.keys(ZS_GROUPS).map((g) => {
    const best = kept.find((k) => k.group === g);
    return [g, best ? { score: best.score, label: best.label, box: best.box } : null];
  }));
}

/** history: the target's score in the last looks (newest last, 0 = not seen). */
export function zeroShotConfirmed(history, { low, high }) {
  const last = history.at(-1) ?? 0;
  return last >= high || (last >= low && (history.at(-2) ?? 0) >= low);
}

// ---------------------------------------------------------------- smoking (OWLv2 on a close crop)
// A cigarette is a few pixels in a whole frame: on 42 labelled photos (20 smokers; 22 people with a
// hand at the face — phone calls, drinking, eating, thinking) OWLv2 on the whole image found 7/20 with
// no false alarm. On a square crop of the head and hands, with the cigarette scoring at least 75 % of
// the best other object there (phone, cup, bottle, food…), it found 14/20 with none, 12/20 at ≥ 0.5.
// Misses: smokers far away (under ~250 px tall) and cigarettes hidden in the hand.
export const SMOKING_PROMPTS = Object.freeze(['a cigarette', 'a lit cigarette']);
export const SMOKING_DISTRACTORS = Object.freeze(['a mobile phone', 'a cup', 'a mug', 'a bottle', 'food', 'a sandwich', 'a hand', 'a pen', 'a straw', 'a microphone']);
export const SMOKING_THRESHOLDS = Object.freeze({ low: 0.35, high: 0.5 });

/**
 * The head-and-hands crop of a person box [x, y, w, h] (0..1) in a width × height picture, in
 * pixels [x, y, side, side]: centred on the upper body, the larger of 1.5× the body width and 60 %
 * of its height, kept inside the picture.
 */
export function upperBodyRect([bx, by, bw, bh], width, height) {
  const side = Math.min(Math.max(bw * width * 1.5, bh * height * 0.6), width, height);
  const x = Math.min(Math.max(0, (bx + bw / 2) * width - side / 2), width - side);
  const y = Math.min(Math.max(0, (by + bh * 0.3) * height - side / 2), height - side);
  return [Math.round(x), Math.round(y), Math.round(side), Math.round(side)];
}

/** On the crop, the cigarette must be clear enough and not lose to a phone, cup or food there. */
export function smokingVerdict({ cig = 0, rival = 0 }, { low } = SMOKING_THRESHOLDS) {
  return cig >= low && cig >= 0.75 * rival;
}

/** A wrist close to the face (nose, eyes or ears): within 60 % of the shoulder-to-hip length. */
export function handNearFace(kp) {
  if (!kp) return false;
  const face = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'].map((k) => kp[k]).filter(Boolean);
  const wrists = [kp.left_wrist, kp.right_wrist].filter(Boolean);
  const sh = kp.left_shoulder ?? kp.right_shoulder;
  const hip = kp.left_hip ?? kp.right_hip;
  if (!face.length || !wrists.length || !sh || !hip) return false;
  const reach = 0.6 * Math.hypot(sh[0] - hip[0], sh[1] - hip[1]);
  return wrists.some((w) => face.some((f) => Math.hypot(w[0] - f[0], w[1] - f[1]) < reach));
}

/** Whom to check for smoking this time (one crop per look): a hand at the face first, then the largest. */
export function smokingCandidate(bodies) {
  let best = -1;
  let bestScore = -1;
  bodies.forEach((b, i) => {
    const s = (handNearFace(b.kp) ? 1 : 0) + b.box[2] * b.box[3];
    if (s > bestScore) [best, bestScore] = [i, s];
  });
  return best;
}

// ---------------------------------------------------------------- close-up check of fast detections
// The fast analyses raise critical alerts on their own evidence — RT-DETR's knife / scissors class
// and the colour-and-motion fire rule. In the console test both did: a cigarette in the hand became
// "armed person" (0.50) and an orange wall behind a phone call became "possible arson". When the GPU
// second look is there, such a report waits for OWLv2 to confirm it on a close crop.
export const FIRE_PROMPTS = Object.freeze(['fire', 'flames', 'a burning fire']);
export const FIRE_DISTRACTORS = Object.freeze(['an orange wall', 'a lamp', 'a light', 'orange clothes', 'a red object', 'the sun', 'a reflection', 'a sign', 'a person']);
/**
 * 0.4, as on the whole picture: at 0.3 a street lamp on a night bridge passed the close-up check (fire
 * videos scored 0.54–0.73 close up).
 */
export const FIRE_LOW = 0.4;
export function fireConfirms({ fire = 0, rival = 0 }, low = FIRE_LOW) {
  return fire >= low && fire >= 0.75 * rival;
}

/**
 * A 'knife' at the mouth of someone just seen smoking is the cigarette (console test: 0.25 twice, then
 * 0.43, after the smoking alert) unless it is very clear — the real knives in the tests scored
 * 0.61–0.70. True when the candidate's centre is in that person's head-and-hands area and it scores
 * below `clear`. Boxes are [x, y, w, h] in 0..1.
 */
export function cigaretteNotKnife(knifeBox, score, smokerBox, clear = 0.6) {
  if (!smokerBox || score >= clear) return false;
  const [x, y, s] = upperBodyRect(smokerBox, 1000, 1000);
  const cx = (knifeBox[0] + knifeBox[2] / 2) * 1000;
  const cy = (knifeBox[1] + knifeBox[3] / 2) * 1000;
  return cx >= x && cx <= x + s && cy >= y && cy <= y + s;
}

/** Overlap of two [x, y, w, h] boxes: intersection over union. */
export function iou([ax, ay, aw, ah], [bx, by, bw, bh]) {
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const inter = ix * iy;
  return inter ? inter / (aw * ah + bw * bh - inter) : 0;
}

/**
 * A COCO "phone" (or other device) that is really the weapon the second look found: the detectors know
 * no gun and call a handgun in a hand a cell phone (seen on a shooting-range video, 0.64). True when
 * the boxes cover each other by more than a third of the smaller one.
 */
export function sameObject([ax, ay, aw, ah], [bx, by, bw, bh]) {
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const small = Math.min(aw * ah, bw * bh);
  return small > 0 && (ix * iy) / small > 1 / 3;
}

/**
 * One box per person: of boxes overlapping more than `limit` (IoU), the highest score is kept.
 * Items are { box, conf }; tested on real video, the detector sometimes gives one person two boxes.
 */
export function dedupeBoxes(items, limit = 0.7) {
  const kept = [];
  for (const it of [...items].sort((a, b) => b.conf - a.conf)) if (!kept.some((k) => iou(k.box, it.box) > limit)) kept.push(it);
  return kept;
}

/** Share of box a ([x, y, w, h]) that lies inside box b. */
export function within([ax, ay, aw, ah], [bx, by, bw, bh]) {
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  return aw * ah > 0 ? (ix * iy) / (aw * ah) : 0;
}

/**
 * Person boxes nested in each other, which IoU dedupe lets through (seen on a meeting room behind
 * glass: 6 boxes for 4 people): a small box inside a person's box (a head, a torso, an arm) is part
 * of that person and is dropped. (Dropping "group" boxes holding two smaller boxes was tried and
 * removed: the two were often the head and torso of one person, and that person was lost.)
 * Items are { box, conf }.
 */
export function mergeNested(items, inside = 0.8) {
  const area = (b) => b[2] * b[3];
  return items.filter((x, j) => !items.some((b, i) => i !== j && area(x.box) < 0.4 * area(b.box) && within(x.box, b.box) >= inside));
}

/** The middle of the last `n` counts: a steady people count instead of one that jumps every frame. */
export function steadyCount(history, count, n = 5) {
  history.push(count);
  if (history.length > n) history.shift();
  const s = [...history].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

/** A real body: at least 8 joints, with a shoulder and a hip. */
export function isBody(kp) {
  return Boolean(kp && Object.keys(kp).length >= 8 && (kp.left_shoulder || kp.right_shoulder) && (kp.left_hip || kp.right_hip));
}

/**
 * Should a person detection count? Strong (≥ strong) boxes count, except one covering over half the
 * picture with no body in it (a false detection over a crowd); weak boxes (≥ weak) count only with a
 * body in them. Without a pose model, only strong boxes count.
 */
export function acceptPerson(conf, [, , w, h], kp, { strong = 0.55, weak = 0.4, posesKnown = true } = {}) {
  if (!posesKnown) return conf >= strong;
  if (conf >= strong) return w * h <= 0.5 || isBody(kp);
  return conf >= weak && isBody(kp);
}

const mid = (a, b) => (a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : (a ?? b ?? null));
const wristsOf = (kp) => [kp?.left_wrist, kp?.right_wrist].filter(Boolean);

/** Where the person stands: between the ankles when they are visible, else the bottom of the box. */
export function feetOf([x, y, w, h], kp) {
  const ankles = mid(kp?.left_ankle, kp?.right_ankle);
  return ankles ?? [x + w / 2, y + h];
}

/** Torso direction (hips → shoulders) as [dx, dy], or null without both. */
function torsoOf(kp) {
  const s = mid(kp?.left_shoulder, kp?.right_shoulder);
  const hp = mid(kp?.left_hip, kp?.right_hip);
  return s && hp ? [s[0] - hp[0], s[1] - hp[1]] : null;
}

/**
 * Is an object (weapon, phone, laptop) in a person's hands? With keypoints: within reach of a wrist
 * (the object's own size, at least 15 % of the body height). Without: beside or in front of the body
 * (half a body width either side), between the shoulders and the knees — not on the floor at their
 * feet nor far away. People are [x, y, w, h] boxes or { box, kp }. Returns the index of the holder, or -1.
 */
export function heldBy(obj, people) {
  const cx = obj[0] + obj[2] / 2;
  const cy = obj[1] + obj[3] / 2;
  let best = -1;
  let bestD = Infinity;
  people.forEach((p, i) => {
    const [x, y, w, h] = Array.isArray(p) ? p : p.box;
    const wrists = Array.isArray(p) ? [] : wristsOf(p.kp);
    let d;
    if (wrists.length) {
      d = Math.min(...wrists.map(([wx, wy]) => Math.hypot(cx - wx, cy - wy)));
      if (d > Math.max(h * 0.15, Math.hypot(obj[2], obj[3]) * 0.6)) return;
    } else {
      if (cx < x - w * 0.5 || cx > x + w * 1.5 || cy < y + h * 0.1 || cy > y + h * 0.8) return;
      d = Math.abs(cx - (x + w / 2));
    }
    if (d < bestD) [best, bestD] = [i, d];
  });
  return best;
}

/** Is a person close to a region (fire): within one body width of it, at a height that overlaps it. */
export function nearBox(region, people) {
  const [rx, ry, rw, rh] = region;
  return people.some(([x, y, w, h]) => x + w >= rx - w && x <= rx + rw + w && y + h >= ry - h * 0.2 && y <= ry + rh + h * 0.2);
}

/**
 * One behaviour engine per camera. Call step() for every analysed frame with
 *   t: time in ms, people: [{ id, box: [x, y, w, h], feet: [x, y], kp?, ghost? }] (0..1 picture units; kp = body keypoints),
 *   zones: [{ id, name, type, points, dwellMin? }], permitted: kept for old callers; the console always passes
 *   false, because these cameras cannot tell who a person is (a personal exception never silences them),
 *   behaviour: run the loitering / circling / running / fall rules.
 * Returns the new events: { kind, key, label, trackId?, zone? } — each reported once per visit.
 */
export function createBehaviour(options = {}) {
  const R = { ...RULES, ...options };
  const tracks = new Map();
  const zoneState = new Map();
  const view = { since: null, last: null, done: false };
  let lostAtEdge = [];

  const sideOf = (x) => (x < R.edge ? 'left' : x > 1 - R.edge ? 'right' : null);

  function newTrack(p, t, realIds) {
    const x = p.feet[0];
    const side = sideOf(x);
    // 360° picture: the same person walking on round the building comes back at the other edge.
    if (side) {
      const fresh = (s) => s.lastReal < t && t - s.lastReal <= R.wrapSec * 1000 && sideOf(s.path.at(-1)?.x ?? 0.5) === (side === 'left' ? 'right' : 'left');
      let prev = [...tracks.values()].find((s) => !realIds.has(s.id) && fresh(s));
      if (prev) tracks.delete(prev.id);
      else {
        const k = lostAtEdge.findIndex((l) => fresh(l.s));
        if (k >= 0) [{ s: prev }] = lostAtEdge.splice(k, 1);
      }
      if (prev) return { ...prev, id: p.id, wraps: prev.wraps + 1, path: [], dir: 0, anchorX: x, minX: x, maxX: x };
    }
    return { id: p.id, first: t, last: t, lastReal: t, path: [], minX: x, maxX: x, dir: 0, reversals: 0, wraps: 0, uprightSeen: false, lyingSince: null, fastSince: null, at: new Map(), below: new Set(), done: new Set() };
  }

  function once(s, key, event, out) {
    if (s.done.has(key)) return;
    s.done.add(key);
    out.push(event);
  }

  return function step({ t, people = [], zones = [], permitted = false, behaviour = false, presence = false }) {
    const out = [];
    const real = people.filter((p) => !p.ghost);
    for (const p of people) {
      const s = tracks.get(p.id);
      if (s) s.last = t;
    }

    const realIds = new Set(real.map((p) => p.id));
    for (const p of real) {
      let s = tracks.get(p.id);
      if (!s) tracks.set(p.id, (s = newTrack(p, t, realIds)));
      s.last = t;
      s.lastReal = t;
      const [bx, by, bw, bh] = p.box;
      const [fx, fy] = p.feet;
      s.path = [...s.path.filter((q) => t - q.t <= 2000), { t, x: fx, y: fy, h: bh }];
      s.minX = Math.min(s.minX, fx);
      s.maxX = Math.max(s.maxX, fx);
      // Direction changes along the picture (walking back and forth past the building): measured
      // against the last turning point, so slow walkers count too and jitter does not.
      s.anchorX ??= fx;
      const dx = fx - s.anchorX;
      if (Math.abs(dx) > R.turnDist) {
        const dir = Math.sign(dx);
        if (s.dir && dir !== s.dir) s.reversals++;
        s.dir = dir;
        s.anchorX = fx;
      } else if (s.dir && Math.sign(dx) === s.dir) s.anchorX = fx;

      if (behaviour) {
        // Running: feet moving faster than runSpeed body heights per second, for runSec.
        const old = s.path[0];
        const dt = (t - old.t) / 1000;
        const speed = dt >= 0.5 ? Math.hypot(fx - old.x, fy - old.y) / Math.max(0.05, bh) / dt : 0;
        if (speed >= R.runSpeed) {
          s.fastSince ??= t;
          if (t - s.fastSince >= R.runSec * 1000) once(s, 'running', { kind: 'running', key: `running|${p.id}`, label: 'person running', trackId: p.id }, out);
        } else s.fastSince = null;

        // A person down: was upright, now lying for fallSec. With keypoints the torso (hips →
        // shoulders) tells it — near vertical = upright, closer to horizontal = lying; without them,
        // a box much wider than tall.
        const torso = torsoOf(p.kp);
        const upright = torso ? Math.abs(torso[1]) > Math.abs(torso[0]) * 2 : bh > bw * 1.3;
        const lying = torso ? Math.abs(torso[1]) < Math.abs(torso[0]) : bw >= bh * R.fallRatio;
        if (upright) {
          s.uprightSeen = true;
          s.lyingSince = null;
        } else if (s.uprightSeen && lying) {
          s.lyingSince ??= t;
          if (t - s.lyingSince >= R.fallSec * 1000) once(s, 'fall', { kind: 'fall', key: `fall|${p.id}`, label: 'person down (lying on the ground)', trackId: p.id }, out);
        }

        // Circling: on the move long enough, and back and forth along the site or right round it.
        const span = s.maxX - s.minX;
        if (t - s.first >= R.circlingSec * 1000 && (s.wraps >= 1 || span >= R.aroundSpan || (s.reversals >= 2 && span >= R.circlingSpan))) {
          const how = s.wraps >= 1 ? 'went right round the 360° view' : span >= R.aroundSpan ? `crossed ${Math.round(span * 100)} % of the 360° view` : `walked back and forth ${s.reversals} times`;
          once(s, 'circling', { kind: 'circling', key: `circling|${p.id}`, label: `person circling the building (${how})`, trackId: p.id }, out);
        }
      }

      for (const z of zones) {
        if (z.type === 'door' && !permitted) {
          const cx = bx + bw / 2;
          const near = inPolygon(p.feet, z.points) || inPolygon([cx, by + bh / 2], z.points);
          if (near) {
            if (!s.at.has(z.id)) s.at.set(z.id, t);
            const sec = (t - s.at.get(z.id)) / 1000;
            if (sec >= R.doorSec) once(s, `door|${z.id}`, { kind: 'door', key: `door|${z.id}|${p.id}`, label: `person at the door “${z.name}” for ${Math.round(sec)} s without a permit`, trackId: p.id, zone: z }, out);
          } else s.at.delete(z.id);
        }
        if (z.type === 'fence') {
          // Feet on the fence (well above its base) or crossing from below it to above its top.
          // Only a body the size of someone at the fence counts: a person standing far behind it
          // looks small with their feet high in the picture, and someone walking away from the
          // camera shrinks as their feet rise — neither is a climb.
          const b = bounds(z.points);
          const fenceH = b.maxY - b.minY;
          const withinX = fx >= b.minX && fx <= b.maxX;
          if (withinX && fy >= b.maxY - 0.02) {
            s.below.add(z.id);
            s.baseH ??= new Map();
            s.baseH.set(z.id, bh);
          }
          const baseH = s.baseH?.get(z.id);
          const fullSize = baseH ? bh >= baseH * R.climbKeepSize : bh >= fenceH * R.climbMinSize;
          // Hands at the top of the fence (wrists when the pose is known, else the top of the body).
          const wrists = wristsOf(p.kp);
          const top = wrists.length ? Math.min(...wrists.map((q) => q[1])) : by;
          const reachesTop = top <= b.minY + fenceH * R.climbTop;
          const raised = inPolygon(p.feet, z.points) && fy < b.maxY - R.climbRise * fenceH && fullSize && reachesTop;
          const crossed = withinX && fy < b.minY && s.below.has(z.id) && fullSize;
          const key = `fence|${z.id}`;
          if (raised || crossed) {
            if (!s.at.has(key)) s.at.set(key, t);
            if (crossed || t - s.at.get(key) >= R.climbSec * 1000) once(s, key, { kind: 'climb', key: `climb|${z.id}|${p.id}`, label: crossed ? `person crossed “${z.name}”` : `person climbing “${z.name}”`, trackId: p.id, zone: z }, out);
          } else s.at.delete(key);
        }
      }
    }

    // Sensitive areas: one visit while anyone is inside (short gaps allowed), whoever the tracker thinks it is.
    for (const z of zones.filter((x) => x.type === 'restricted')) {
      const occupied = real.some((p) => inPolygon(p.feet, z.points));
      let zs = zoneState.get(z.id);
      if (occupied) {
        if (!zs || t - zs.last > R.gapSec * 1000) zoneState.set(z.id, (zs = { since: t, last: t, done: new Set() }));
        zs.last = t;
        const inside = t - zs.since;
        const limit = (Number(z.dwellMin) > 0 ? Number(z.dwellMin) : R.dwellMin) * 60_000;
        if (!permitted && inside >= R.enterSec * 1000 && !zs.done.has('intrusion')) {
          zs.done.add('intrusion');
          out.push({ kind: 'intrusion', key: `intrusion|${z.id}|${zs.since}`, label: `person in “${z.name}” without a permit`, zone: z });
        }
        if (!permitted && inside >= limit && !zs.done.has('dwell')) {
          zs.done.add('dwell');
          out.push({ kind: 'dwell', key: `dwell|${z.id}|${zs.since}`, label: `person in “${z.name}” for ${mins(inside)} min without a permit`, zone: z });
        }
      }
    }

    // Loitering: someone in view (short gaps allowed) for loiterMin.
    // Tower: a person near the building (first step of the perimeter incident) after presenceSec.
    if (behaviour || presence) {
      if (real.length) {
        if (view.since === null || t - view.last > R.gapSec * 1000) Object.assign(view, { since: t, done: false, seen: false });
        view.last = t;
        if (presence && !view.seen && t - view.since >= R.presenceSec * 1000) {
          view.seen = true;
          out.push({ kind: 'person', key: `person|${view.since}`, label: real.length > 1 ? `${real.length} people near the building` : 'person near the building' });
        }
        if (behaviour && !view.done && t - view.since >= R.loiterMin * 60_000) {
          view.done = true;
          out.push({ kind: 'loiter', key: `loiter|${view.since}`, label: `person around the site for ${mins(t - view.since)} min` });
        }
      }
    }

    // Forget tracks gone for a while; remember the ones that left at a 360° edge.
    lostAtEdge = lostAtEdge.filter((l) => t - l.s.lastReal <= R.wrapSec * 1000);
    for (const [id, s] of tracks) {
      if (t - s.last <= R.forgetSec * 1000) continue;
      tracks.delete(id);
      if (sideOf(s.path.at(-1)?.x ?? 0.5)) lostAtEdge.push({ s });
    }
    return out;
  };
}
