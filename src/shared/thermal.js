// Thermal-style view of an ordinary camera picture. NOT a temperature measurement: there is no
// thermal sensor. Brightness becomes a cool background (black → blue → purple) and the people the
// detector found are painted warm (red → orange → yellow → white), the way bodies stand out on a
// real thermal camera — so people are easy to see and count at a glance, day or night.
// DOM-free (works on an RGBA array): used by the Smart detection page and tested in Node.

// Ironbow-like colour stops, position 0..1 → RGB.
const STOPS = [
  [0, [0, 0, 12]],
  [0.18, [28, 0, 110]],
  [0.38, [120, 0, 150]],
  [0.58, [215, 40, 60]],
  [0.76, [250, 130, 0]],
  [0.9, [255, 215, 40]],
  [1, [255, 255, 235]],
];

/** 256-entry palette as a flat Uint8Array [r, g, b, r, g, b, …]. */
export function thermalPalette() {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let k = 0;
    while (k < STOPS.length - 2 && v > STOPS[k + 1][0]) k++;
    const [a, ca] = STOPS[k];
    const [b, cb] = STOPS[k + 1];
    const f = (v - a) / (b - a);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(ca[c] + (cb[c] - ca[c]) * f);
  }
  return lut;
}

const COOL_MAX = 0.5; // the background stays in the cool half of the palette
const WARM_MIN = 0.62; // people start in the warm half

/**
 * In place on RGBA `data` of a width × height picture. warm: person boxes [x, y, w, h] (0..1); each
 * is painted as a warm body (an ellipse inside the box, hottest at its centre-top, where the head
 * and torso are).
 * mix (0..1): how much of the palette replaces the picture — 1 is the full thermal look; lower keeps
 * the real picture under it (people and fire stay at least 0.85). lift (< 1): brightens dark scenes
 * before colouring (a gamma), so a dim room is not a black screen.
 */
export function thermalize(data, width, height, { warm = [], hot = [], lut = thermalPalette(), mix = 1, lift = 1 } = {}) {
  const heat = new Float32Array(width * height);
  for (let i = 0, p = 0; p < heat.length; i += 4, p++) heat[p] = ((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255) ** lift * COOL_MAX;
  for (const [bx, by, bw, bh] of warm) {
    const cx = (bx + bw / 2) * width;
    const cy = (by + bh * 0.4) * height;
    const rx = (bw / 2) * width * 0.95;
    const ry = (bh / 2) * height * 1.05;
    const x0 = Math.max(0, Math.floor(bx * width));
    const x1 = Math.min(width - 1, Math.ceil((bx + bw) * width));
    const y0 = Math.max(0, Math.floor(by * height));
    const y1 = Math.min(height - 1, Math.ceil((by + bh) * height));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1) continue;
        const p = y * width + x;
        // Warm body: hotter towards the centre, and the picture's own detail (face, clothes) kept
        // as texture so it reads as a person, not a flat blob.
        const v = WARM_MIN - 0.08 + (1 - WARM_MIN) * (1 - d) * 0.55 + (heat[p] / COOL_MAX) * 0.3;
        if (v > heat[p]) heat[p] = Math.min(1, v);
      }
    }
  }
  // Fire: the hottest thing in view — its bright pixels go to the white-hot end.
  for (const [bx, by, bw, bh] of hot) {
    for (let y = Math.max(0, Math.floor(by * height)); y <= Math.min(height - 1, Math.ceil((by + bh) * height)); y++) {
      for (let x = Math.max(0, Math.floor(bx * width)); x <= Math.min(width - 1, Math.ceil((bx + bw) * width)); x++) {
        const p = y * width + x;
        heat[p] = Math.max(heat[p], 0.7 + (heat[p] / COOL_MAX) * 0.3);
      }
    }
  }
  for (let i = 0, p = 0; p < heat.length; i += 4, p++) {
    const k = Math.round(heat[p] * 255) * 3;
    if (mix >= 1) {
      data[i] = lut[k];
      data[i + 1] = lut[k + 1];
      data[i + 2] = lut[k + 2];
      continue;
    }
    // Warm things (people, fire) keep their colour; the background is a tint over the real picture.
    const m = heat[p] > COOL_MAX ? Math.max(mix, 0.85) : mix;
    data[i] = Math.round(lut[k] * m + data[i] * (1 - m));
    data[i + 1] = Math.round(lut[k + 1] * m + data[i + 1] * (1 - m));
    data[i + 2] = Math.round(lut[k + 2] * m + data[i + 2] * (1 - m));
  }
  return data;
}
