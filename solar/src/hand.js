// The lettering: everything written in the game is drawn with this, as strokes of a pen.
//
// Every letter is a few strokes (lines and round turns) on a small grid; nothing here is taken from a typeface.
// It is one hand that can be several things by how it is asked for: engraved or sign-painted capitals on brass
// and enamel (upright, a little heavy), the pilot's own writing on notes and charts (slanted, with a wobble),
// thin steady instrument lettering on glass, and marks painted on the hull through a stencil.
//
//   write(ctx, text, x, y, size, opts)   draws on a 2D canvas; y is the line the letters stand on, size the height
//                                        of a capital in pixels; gives back how wide it came out
//   width(text, size, opts)              how wide it would come out
//
// opts: align 'left' | 'center' | 'right'; weight (the pen's width as a part of a capital's height, about 0.11);
// slant (how far a capital's top leans to the right, as a part of its height); wobble 0..1 (how much a hand
// shows: no two letters alike) with seed (the same seed, the same hand); track (more room between letters, in
// capital heights); color (otherwise the canvas's own stroke colour); glow (pixels of light round it) and
// glowColor; mono (every sign as wide as every other); tab: false (figures set close, each as wide as it is:
// otherwise they are all one width, so a number that changes does not jump about); stencil (strokes broken where
// a stencil must hold together); dry 0..1 (a brush running out of paint); pen 0..1 (a flat pen held at an angle:
// down-strokes heavier than cross-strokes, strokes thinning to their ends), or its parts: press 0..1, nib (the
// pen's angle, degrees) and taper 0..1.
//
// Plain writing (none of wobble, stencil, dry, pen) is one path stroked once and is kept from one frame to the
// next, so a dozen lines a frame on the window glass cost almost nothing. The rest is worked out once for each
// line and kept too.

/** A capital is 1 high and stands on 0; small letters are XH high, their tall strokes ASC; tails go down to DESC. */
export const XH = 0.58, ASC = 1.06, DESC = -0.3;
const RAD = Math.PI / 180;

// Each: [how wide its strokes reach, the strokes, room to its left, room to its right].
// M x y: pen down at; L x y: a line to; A cx cy rx ry a0 a1: round a middle, from one angle to another (degrees,
// anticlockwise positive); Q cx cy x y and C x1 y1 x2 y2 x y: bends; Z: back to where the stroke began.
const S = 0.17, O = 0.10;
const DOT = (x, y) => `M${x + 0.014} ${y} A${x} ${y} 0.014 0.014 0 360 Z`;
const G = {
  A: [0.80, 'M0 0 L0.40 1 L0.80 0 M0.115 0.28 L0.685 0.28', 0.05, 0.05],
  B: [0.51, 'M0 0 L0 1 M0 1 L0.22 1 A0.22 0.78 0.21 0.22 90 -90 L0 0.56 M0 0.56 L0.24 0.56 A0.24 0.28 0.27 0.28 90 -90 L0 0', S, 0.10],
  C: [0.80, 'A0.46 0.5 0.46 0.51 42 318', O, 0.06],
  D: [0.74, 'M0 0 L0 1 M0 1 L0.24 1 A0.24 0.5 0.50 0.5 90 -90 L0 0', S, O],
  E: [0.46, 'M0.46 1 L0 1 L0 0 L0.46 0 M0 0.58 L0.38 0.58', S, 0.07],
  F: [0.44, 'M0.44 1 L0 1 L0 0 M0 0.57 L0.36 0.57', S, 0.04],
  G: [0.905, 'A0.46 0.5 0.46 0.51 42 345 L0.905 0.47 L0.52 0.47', O, 0.13],
  H: [0.66, 'M0 0 L0 1 M0.66 0 L0.66 1 M0 0.58 L0.66 0.58', S, S],
  I: [0, 'M0 0 L0 1', S, S],
  J: [0.36, 'M0.36 1 L0.36 0.20 A0.16 0.20 0.20 0.21 0 -140', 0.07, S],
  K: [0.60, 'M0 0 L0 1 M0.58 1 L0 0.50 M0.16 0.638 L0.62 0', S, 0.03],
  L: [0.44, 'M0 1 L0 0 L0.44 0', S, 0.04],
  M: [0.88, 'M0 0 L0.12 1 L0.44 0.04 L0.76 1 L0.88 0', 0.13, 0.13],
  N: [0.70, 'M0 0 L0 1 L0.70 0 L0.70 1', S, S],
  O: [0.94, 'A0.47 0.5 0.47 0.51 90 450 Z', O, O],
  P: [0.50, 'M0 0 L0 1 M0 1 L0.22 1 A0.22 0.71 0.28 0.29 90 -90 L0 0.42', S, 0.05],
  Q: [0.94, 'A0.47 0.5 0.47 0.51 90 450 Z M0.48 0.28 Q0.62 -0.08 1.04 -0.12', O, O],
  R: [0.58, 'M0 0 L0 1 M0 1 L0.22 1 A0.22 0.73 0.27 0.27 90 -90 L0 0.46 M0.24 0.46 L0.47 0.11 Q0.54 0.01 0.64 0', S, 0.05],
  S: [0.52, 'A0.245 0.775 0.20 0.235 35 250 A0.26 0.255 0.26 0.265 70 -145', 0.09, 0.10],
  T: [0.62, 'M0 1 L0.62 1 M0.31 1 L0.31 0', 0.05, 0.05],
  U: [0.62, 'M0 1 L0 0.31 A0.31 0.31 0.31 0.32 180 360 L0.62 1', S, S],
  V: [0.76, 'M0 1 L0.38 0 L0.76 1', 0.04, 0.04],
  W: [1.08, 'M0 1 L0.27 0 L0.54 1 L0.81 0 L1.08 1', 0.04, 0.04],
  X: [0.64, 'M0 1 L0.64 0 M0.64 1 L0 0', 0.05, 0.05],
  Y: [0.68, 'M0 1 L0.34 0.42 L0.68 1 M0.34 0.42 L0.34 0', 0.03, 0.03],
  Z: [0.60, 'M0.02 1 L0.60 1 L0 0 L0.60 0', 0.08, 0.08],

  0: [0.52, 'A0.26 0.5 0.26 0.51 90 450 Z'],
  1: [0.30, 'M0 0.74 L0.30 1 L0.30 0'],
  2: [0.54, 'A0.27 0.74 0.24 0.26 165 -30 C0.44 0.40 0.06 0.24 0.02 0 L0.54 0'],
  3: [0.52, 'M0.04 1 L0.50 1 L0.24 0.63 A0.25 0.31 0.27 0.32 92 -148'],
  4: [0.58, 'M0.34 1 L0 0.30 L0.58 0.30 M0.44 0.66 L0.44 0'],
  5: [0.52, 'M0.48 1 L0.07 1 L0.04 0.55 A0.25 0.31 0.27 0.32 140 -148'],
  6: [0.52, 'M0.46 1 C0.18 0.86 0.0 0.60 0.0 0.31 A0.26 0.31 0.26 0.32 180 468'],
  7: [0.54, 'M0.02 1 L0.54 1 Q0.28 0.52 0.22 0'],
  8: [0.52, 'A0.26 0.765 0.21 0.245 90 450 Z A0.26 0.265 0.26 0.275 90 450 Z'],
  9: [0.52, 'M0.06 0 C0.34 0.14 0.52 0.40 0.52 0.69 A0.26 0.69 0.26 0.32 0 282'],

  a: [0.58, 'A0.29 0.29 0.29 0.30 0 360 Z M0.58 0.58 L0.58 0.10 A0.68 0.10 0.10 0.10 180 265', O, 0.10],
  b: [0.58, 'M0 1.06 L0 0 M0 0.29 A0.29 0.29 0.29 0.30 180 540 Z', 0.15, O],
  c: [0.50, 'A0.29 0.29 0.29 0.30 44 316', O, 0.05],
  d: [0.58, 'A0.29 0.29 0.29 0.30 0 360 Z M0.58 1.06 L0.58 0.10 A0.68 0.10 0.10 0.10 180 265', O, 0.10],
  e: [0.58, 'M0.006 0.23 L0.574 0.352 A0.29 0.29 0.29 0.30 12 322', O, 0.07],
  f: [0.36, 'A0.34 0.84 0.21 0.22 35 180 L0.13 0 M0 0.58 L0.34 0.58', 0.05, 0.04],
  g: [0.58, 'A0.29 0.29 0.29 0.30 0 360 Z M0.58 0.58 L0.58 -0.06 A0.30 -0.06 0.28 0.24 0 -172', O, 0.15],
  h: [0.46, 'M0 1.06 L0 0 M0 0.34 A0.23 0.34 0.23 0.25 180 0 L0.46 0', 0.15, 0.15],
  i: [0, 'M0 0.58 L0 0 ' + DOT(0, 0.84), 0.15, 0.15],
  j: [0.18, 'M0.18 0.58 L0.18 -0.10 A0 -0.10 0.18 0.20 0 -125 ' + DOT(0.18, 0.84), 0.12, 0.15],
  k: [0.42, 'M0 1.06 L0 0 M0.40 0.58 L0 0.22 M0.14 0.346 L0.42 0', 0.15, 0.03],
  l: [0.17, 'M0 1.06 L0 0.15 A0.15 0.15 0.15 0.15 180 280', 0.15, 0.06],
  m: [0.76, 'M0 0.58 L0 0 M0 0.36 A0.19 0.36 0.19 0.23 180 0 L0.38 0 M0.38 0.36 A0.57 0.36 0.19 0.23 180 0 L0.76 0', 0.15, 0.15],
  n: [0.46, 'M0 0.58 L0 0 M0 0.34 A0.23 0.34 0.23 0.25 180 0 L0.46 0', 0.15, 0.15],
  o: [0.60, 'A0.30 0.29 0.30 0.30 90 450 Z', O, O],
  p: [0.58, 'M0 0.58 L0 -0.30 M0 0.29 A0.29 0.29 0.29 0.30 180 540 Z', 0.15, O],
  q: [0.58, 'A0.29 0.29 0.29 0.30 0 360 Z M0.58 0.58 L0.58 -0.30', O, 0.15],
  r: [0.27, 'M0 0.58 L0 0 M0 0.36 A0.20 0.36 0.20 0.23 180 72', 0.15, 0.03],
  s: [0.40, 'A0.20 0.445 0.17 0.145 35 250 A0.205 0.145 0.20 0.155 70 -145', 0.09, 0.09],
  t: [0.36, 'M0.13 0.90 L0.13 0.16 A0.29 0.16 0.16 0.16 180 285 M0.02 0.58 L0.38 0.58', 0.04, 0.03],
  u: [0.46, 'M0 0.58 L0 0.23 A0.23 0.23 0.23 0.24 180 360 M0.46 0.58 L0.46 0.10 A0.56 0.10 0.10 0.10 180 265', 0.15, 0.10],
  v: [0.50, 'M0 0.58 L0.25 0 L0.50 0.58', 0.04, 0.04],
  w: [0.76, 'M0 0.58 L0.19 0 L0.38 0.50 L0.57 0 L0.76 0.58', 0.04, 0.04],
  x: [0.46, 'M0 0.58 L0.46 0 M0.46 0.58 L0 0', 0.05, 0.05],
  y: [0.50, 'M0 0.58 L0.265 0.03 M0.50 0.58 L0.22 -0.10 Q0.13 -0.29 0.0 -0.27 Q-0.07 -0.25 -0.07 -0.18', 0.04, 0.04],
  z: [0.46, 'M0.02 0.58 L0.46 0.58 L0 0 L0.46 0', 0.07, 0.07],

  '.': [0, DOT(0, 0.014), 0.13, 0.13],
  ',': [0.07, DOT(0.05, 0.014) + ' M0.064 0.014 Q0.075 -0.10 0.0 -0.17', 0.10, 0.12],
  ':': [0, DOT(0, 0.014) + ' ' + DOT(0, 0.44), 0.14, 0.14],
  ';': [0.07, DOT(0.05, 0.014) + ' M0.064 0.014 Q0.075 -0.10 0.0 -0.17 ' + DOT(0.05, 0.44), 0.10, 0.13],
  '!': [0, 'M0 1 L0 0.30 ' + DOT(0, 0.014), 0.15, 0.15],
  '?': [0.46, 'A0.23 0.745 0.23 0.265 165 -40 Q0.23 0.47 0.23 0.28 ' + DOT(0.23, 0.014), 0.10, 0.10],
  "'": [0, 'M0 1 L0 0.76', 0.10, 0.10],
  '"': [0.18, 'M0 1 L0 0.76 M0.18 1 L0.18 0.76', 0.10, 0.10],
  '-': [0.30, 'M0 0.32 L0.30 0.32', 0.09, 0.09],
  '–': [0.56, 'M0 0.32 L0.56 0.32', 0.09, 0.09],
  '·': [0, DOT(0, 0.32), 0.16, 0.16],
  '/': [0.40, 'M0 -0.08 L0.40 1.06', 0.05, 0.05],
  '(': [0.20, 'M0.20 1.10 Q-0.07 0.46 0.20 -0.18', 0.10, 0.05],
  ')': [0.20, 'M0 1.10 Q0.27 0.46 0 -0.18', 0.05, 0.10],
  '+': [0.48, 'M0 0.36 L0.48 0.36 M0.24 0.60 L0.24 0.12', 0.10, 0.10],
  '=': [0.48, 'M0 0.46 L0.48 0.46 M0 0.24 L0.48 0.24', 0.10, 0.10],
  '%': [0.70, 'M0.08 0 L0.62 1 M0.13 0.99 A0.13 0.80 0.13 0.19 90 450 Z M0.57 0.39 A0.57 0.20 0.13 0.19 90 450 Z', 0.09, 0.09],
  '°': [0.24, 'A0.12 0.86 0.12 0.13 90 450 Z', 0.07, 0.07],
  '&': [0.68, 'M0.66 0 L0.146 0.687 A0.30 0.78 0.17 0.22 205 -30 A0.30 0.27 0.30 0.28 150 388 L0.68 0.55', 0.10, 0.07],
  '#': [0.74, 'M0.22 0.04 L0.32 0.96 M0.44 0.04 L0.54 0.96 M0.02 0.34 L0.68 0.34 M0.08 0.66 L0.74 0.66', 0.08, 0.06],
  '*': [0.40, 'M0.20 0.96 L0.20 0.52 M0.01 0.85 L0.39 0.63 M0.39 0.85 L0.01 0.63', 0.08, 0.08],
  '<': [0.42, 'M0.42 0.60 L0 0.36 L0.42 0.12', 0.10, 0.10],
  '>': [0.42, 'M0 0.60 L0.42 0.36 L0 0.12', 0.10, 0.10],
  '[': [0.18, 'M0.18 1.10 L0 1.10 L0 -0.18 L0.18 -0.18', 0.14, 0.05],
  ']': [0.18, 'M0 1.10 L0.18 1.10 L0.18 -0.18 L0 -0.18', 0.05, 0.14],
  '_': [0.56, 'M0 -0.14 L0.56 -0.14', 0.04, 0.04],
  '|': [0, 'M0 1.08 L0 -0.18', 0.14, 0.14],
  '→': [0.80, 'M0 0.36 L0.80 0.36 M0.57 0.58 L0.80 0.36 L0.57 0.14', 0.10, 0.10],
  '←': [0.80, 'M0.80 0.36 L0 0.36 M0.23 0.58 L0 0.36 L0.23 0.14', 0.10, 0.10],
  '↑': [0.46, 'M0.23 0 L0.23 0.92 M0 0.68 L0.23 0.92 L0.46 0.68', 0.10, 0.10],
  '↓': [0.46, 'M0.23 0.92 L0.23 0 M0 0.24 L0.23 0 L0.46 0.24', 0.10, 0.10],
  '×': [0.40, 'M0 0.56 L0.40 0.16 M0.40 0.56 L0 0.16', 0.10, 0.10],
  '\u25a1': [0.40, 'M0 0 L0.40 0 L0.40 0.58 L0 0.58 Z', 0.10, 0.10],
};
const SAME = { '’': "'", '‘': "'", '“': '"', '”': '"', '—': '–', '−': '-', ' ': ' ' };
/** Every sign there is a drawing for. */
export const SIGNS = Object.keys(G).filter((c) => c !== '□');
const SPACE = 0.40, FIGURE = 0.72, CELL = 0.84, FIT = 0.105;

// Pairs that would otherwise stand too far apart (in hundredths of a capital's height).
const KERN = {};
for (const [pairs, k] of [
  ['AV VA AY YA', -14], ['AT TA LT LV LY', -12], ['AW WA LW', -9], ['PA FA', -10], ['AO OA AC AG AQ LO DA KO', -3],
  ['F. F, P. P, Y. Y,', -15], ['T. T, V. V,', -13], ['W. W,', -9],
  ['To Ta Te Tc Td Tg Tq Ts', -14], ['Tr Tu Tm Tn Tp', -9], ['Ty Tw Tv', -6], ['Yo Ya Ye Yd Yg Yq Ys', -11], ['Vo Va Ve Vd Vg', -7], ['Wo Wa We', -4],
  ['r. r,', -10], ['y. y, v. v,', -8], ['w. w, f. f,', -6], ['ra rc rd re rg ro rq', -3], ['ka kc kd ke ko', -3], ['fa fo fe', -3], ['ff ft tt', -2],
  ['"A \'A', -10], ['A" A\'', -10], ['/s', -2], ['m/ n/', -2],
]) for (const p of pairs.split(' ')) KERN[p] = k / 100;

// ------------------------------------------------------------------------------------------------- the strokes
/** The strokes of a drawing as runs of points [x0, y0, x1, y1, ...]; a run that comes back to its start has .closed. */
function flatten(src) {
  const tok = src.replace(/([MLQCAZ])/g, ' $1 ').trim().split(/\s+/), runs = [];
  let cur = null, i = 0, x = 0, y = 0;
  const num = () => parseFloat(tok[i++]);
  const begin = (nx, ny) => { cur = [nx, ny]; runs.push(cur); x = nx; y = ny; };
  const to = (nx, ny) => { cur.push(nx, ny); x = nx; y = ny; };
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') begin(num(), num());
    else if (c === 'L') to(num(), num());
    else if (c === 'Q') {
      const cx = num(), cy = num(), ex = num(), ey = num(), x0 = x, y0 = y;
      for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; to(u * u * x0 + 2 * u * t * cx + t * t * ex, u * u * y0 + 2 * u * t * cy + t * t * ey); }
    } else if (c === 'C') {
      const ax = num(), ay = num(), bx = num(), by = num(), ex = num(), ey = num(), x0 = x, y0 = y;
      for (let k = 1; k <= 14; k++) { const t = k / 14, u = 1 - t; to(u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * ex, u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * ey); }
    } else if (c === 'A') {
      const cx = num(), cy = num(), rx = num(), ry = num(), a0 = num(), a1 = num(), n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 7.5));
      for (let k = 0; k <= n; k++) {
        const t = (a0 + ((a1 - a0) * k) / n) * RAD, px = cx + rx * Math.cos(t), py = cy + ry * Math.sin(t);
        if (k === 0) { if (!cur) begin(px, py); else if (Math.hypot(px - x, py - y) > 1e-4) to(px, py); } else to(px, py);
      }
    } else if (c === 'Z') {
      if (Math.hypot(cur[0] - x, cur[1] - y) > 1e-4) cur.push(cur[0], cur[1]); else { cur[cur.length - 2] = cur[0]; cur[cur.length - 1] = cur[1]; }
      cur.closed = true; cur = null;
    }
    if (c === 'M' || c === 'Z') continue;
  }
  return runs;
}

const made = new Map();
/** A sign, ready to draw: { w, l, r, runs }. */
function sign(ch) {
  let g = made.get(ch);
  if (g) return g;
  const src = G[ch] ?? G[SAME[ch]] ?? G['□'];
  const figure = ch >= '0' && ch <= '9';
  const w = src[0], l = figure ? (FIGURE - w) / 2 : src[2] ?? S, r = figure ? (FIGURE - w) / 2 : src[3] ?? S;
  g = { w, l, r, runs: flatten(src[1]) };
  made.set(ch, g);
  return g;
}

/** Where each sign of a line stands: { items: [{ ch, g, x }], w }, in capital heights, from the first stroke to the last. */
function layout(text, track, mono, tab = true) {
  const items = [];
  let pen = 0, prev = '', first = null, end = 0;
  for (const ch of text) {
    if (ch === ' ') { pen += (mono ? CELL : SPACE) + track; prev = ch; continue; }
    const g = sign(ch);
    let x;
    if (mono) { x = pen + (CELL - g.w) / 2; pen += CELL + track; }
    else if (!tab && ch >= '0' && ch <= '9') { x = pen + FIT; pen += FIT + g.w + FIT + track; }
    else { pen += KERN[prev + ch] ?? 0; x = pen + g.l; pen += g.l + g.w + g.r + track; }
    if (first === null) first = x;
    items.push({ ch, g, x }); end = x + g.w; prev = ch;
  }
  if (first === null) return { items, w: Math.max(0, pen - track) };
  // (a line begins at its first stroke and ends at its last: so it can be set against an edge exactly)
  for (const it of items) it.x -= first;
  return { items, w: end - first };
}

const kept = new Map();
function plain(text, track, mono, tab = true) {
  const key = (mono ? 'm' : tab ? 'p' : 'f') + track + '|' + text;
  let L = kept.get(key);
  if (L) return L;
  L = layout(text, track, mono, tab);
  if (typeof Path2D !== 'undefined') {
    const p = new Path2D();
    for (const { g, x } of L.items) for (const run of g.runs) {
      p.moveTo(x + run[0], run[1]);
      for (let i = 2; i < run.length; i += 2) p.lineTo(x + run[i], run[i + 1]);
      if (run.closed) p.closePath();
    }
    L.path = p;
  }
  if (kept.size > 500) kept.clear();
  kept.set(key, L);
  return L;
}

/** How wide a line comes out, in pixels. */
export function width(text, size, opts = {}) { return plain(String(text), opts.track ?? 0, !!opts.mono, opts.tab !== false).w * size; }

// ----------------------------------------------------------------------------------- the hand, and the stencil
/** A number from 0 to 1 that is always the same for the same n. */
function lot(n) {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** A number from 0 to 1 that changes smoothly from place to place. */
function drift(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => lot(a * 73856093 + b * 19349663);
  return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy;
}

const lengthOf = (p) => { let s = 0; for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return s; };
/** The part of a run between two distances along it. */
function between(p, s0, s1) {
  const out = [];
  let s = 0;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1], d = Math.hypot(bx - ax, by - ay), e = s + d;
    if (d > 0 && e > s0 && s < s1) {
      const t0 = Math.max(0, (s0 - s) / d), t1 = Math.min(1, (s1 - s) / d);
      if (!out.length) out.push(ax + (bx - ax) * t0, ay + (by - ay) * t0);
      out.push(ax + (bx - ax) * t1, ay + (by - ay) * t1);
    }
    s = e;
  }
  return out;
}
/** How near a place is to a run, leaving out the run's own first (or last) `skip` of length. */
function nearRun(x, y, p, skipStart = 0, skipEnd = 0) {
  const L = lengthOf(p);
  let best = Infinity, s = 0;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1], dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy), e = s + d;
    if (d > 0 && e > skipStart && s < L - skipEnd) {
      const t0 = Math.max(0, (skipStart - s) / d), t1 = Math.min(1, (L - skipEnd - s) / d);
      const t = Math.max(t0, Math.min(t1, ((x - ax) * dx + (y - ay) * dy) / (d * d)));
      best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
    }
    s = e;
  }
  return best;
}
const cutKept = new Map();
/**
 * A sign as a stencil has it: a stroke that ends on another stops short of it, and a stroke that goes right
 * round is broken at its top and its foot, so that the middle of an O does not fall out of the sheet.
 */
function stencilled(ch, g, gap) {
  const key = ch + '|' + gap.toFixed(3);
  let out = cutKept.get(key);
  if (out) return out;
  out = [];
  g.runs.forEach((run, j) => {
    const L = lengthOf(run), n = run.length;
    if (L < gap * 1.6) { out.push(run); return; }
    if (run.closed) {
      // (its highest and its lowest places)
      let top = 0, foot = 0, s = 0, sTop = 0, sFoot = 0;
      for (let i = 2; i < n; i += 2) {
        s += Math.hypot(run[i] - run[i - 2], run[i + 1] - run[i - 1]);
        if (run[i + 1] > run[top + 1] + 1e-6) { top = i; sTop = s; }
        if (run[i + 1] < run[foot + 1] - 1e-6) { foot = i; sFoot = s; }
      }
      const cuts = [sTop, sFoot].sort((a, b) => a - b);
      const one = between(run, cuts[0] + gap / 2, cuts[1] - gap / 2);
      const two = between(run, cuts[1] + gap / 2, L).concat(between(run, 0, cuts[0] - gap / 2).slice(cuts[0] - gap / 2 > 0 ? 2 : 0));
      if (one.length >= 4) out.push(one);
      if (two.length >= 4) out.push(two);
      return;
    }
    let s0 = 0, s1 = L;
    const touches = (x, y, atStart) => {
      for (let k = 0; k < g.runs.length; k++) {
        const o = g.runs[k];
        if (k === j) { if (nearRun(x, y, o, atStart ? 0.2 : 0, atStart ? 0 : 0.2) < 0.03) return true; continue; }
        if (lengthOf(o) < 0.02) continue;
        const endOn = Math.min(Math.hypot(o[0] - x, o[1] - y), Math.hypot(o[o.length - 2] - x, o[o.length - 1] - y)) < 0.03;
        // (two strokes that meet end to end: only the later one stops short)
        if (endOn && !o.closed) { if (k < j) return true; continue; }
        if (nearRun(x, y, o) < 0.03) return true;
      }
      return false;
    };
    if (touches(run[0], run[1], true)) s0 = gap;
    if (touches(run[n - 2], run[n - 1], false)) s1 = L - gap;
    out.push(s0 > 0 || s1 < L ? between(run, s0, s1) : run);
  });
  cutKept.set(key, out);
  return out;
}

/** Where a run turns a sharp corner: the runs of points between, as [first, last]. (Each is drawn with round ends, which makes the corner round.) */
function atCorners(run) {
  const parts = [], n = run.length / 2;
  let from = 0;
  for (let i = 1; i < n - 1; i++) {
    const ax = run[i * 2] - run[i * 2 - 2], ay = run[i * 2 + 1] - run[i * 2 - 1], bx = run[i * 2 + 2] - run[i * 2], by = run[i * 2 + 3] - run[i * 2 + 1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la > 1e-6 && lb > 1e-6 && (ax * bx + ay * by) / (la * lb) < 0.8) { parts.push([from, i]); from = i; }
  }
  parts.push([from, n - 1]);
  return parts;
}
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const drawn = new Map();
/** A line as a hand, a brush or a stencil leaves it: { path, fill } or { path, lineWidth }, about the line's own start. */
function byHand(text, L, size, o, weight, slant) {
  const wob = o.wobble ?? 0, seed = (o.seed ?? 1) | 0, dry = o.dry ?? 0, pen = o.pen ?? 0, press = o.press ?? pen * 0.55, taper = o.taper ?? Math.max(wob * 0.5, pen * 0.4), half = (weight * size) / 2;
  const nib = (o.nib ?? (pen ? 18 : 0)) * RAD, nx = Math.cos(nib), ny = -Math.sin(nib);
  const key = [text, size, weight, slant, wob, seed, dry, press, taper, nib, o.stencil ? 1 : 0, o.track ?? 0, o.mono ? 1 : 0, o.tab === false ? 0 : 1].join('|');
  let made = drawn.get(key);
  if (made) return made;
  const pieces = [];      // each: { p: [x, y, ...] in pixels, h: [half the stroke's width at each point], closed }
  L.items.forEach((it, gi) => {
    const runs = o.stencil ? stencilled(it.ch, it.g, weight + 0.04) : it.g.runs;
    const r = (k) => lot(seed * 7919 + gi * 104729 + k * 1299709);
    // (each letter a little off its line, a little turned, a little large or small, leaning a little more or less)
    const rot = (r(1) - 0.5) * 0.3 * wob, dy = (r(2) - 0.5) * 0.16 * wob + Math.sin(it.x * 1.3 + seed) * 0.05 * wob, sc = 1 + (r(3) - 0.5) * 0.22 * wob, dx = (r(4) - 0.5) * 0.1 * wob, lean = slant + (r(7) - 0.5) * 0.26 * wob;
    const cx = it.g.w / 2, cy = 0.3, cs = Math.cos(rot) * sc, sn = Math.sin(rot) * sc, ox = r(5) * 40, oy = r(6) * 40;
    runs.forEach((run, ri) => {
      const n = run.length / 2, along = new Array(n);
      along[0] = 0;
      for (let i = 1; i < n; i++) along[i] = along[i - 1] + Math.hypot(run[i * 2] - run[i * 2 - 2], run[i * 2 + 1] - run[i * 2 - 1]);
      const len = along[n - 1], open = !run.closed && len > 0.12;
      // (a stroke begun or ended a touch early or late)
      const e0 = wob && open ? (lot(seed + gi * 31 + ri * 7) - 0.35) * 0.07 * wob : 0, e1 = wob && open ? (lot(seed + gi * 37 + ri * 11 + 1) - 0.35) * 0.07 * wob : 0;
      const P = new Array(n * 2), Hh = new Array(n);
      for (let i = 0; i < n; i++) {
        let u = run[i * 2], v = run[i * 2 + 1];
        if (i === 0 && e0) { const d = Math.hypot(run[2] - u, run[3] - v) || 1; u -= ((run[2] - u) / d) * e0; v -= ((run[3] - v) / d) * e0; }
        if (i === n - 1 && e1) { const a = run[i * 2 - 2], b = run[i * 2 - 1], d = Math.hypot(u - a, v - b) || 1; u += ((u - a) / d) * e1; v += ((v - b) / d) * e1; }
        let uu = cx + (u - cx) * cs - (v - cy) * sn + dx, vv = cy + (u - cx) * sn + (v - cy) * cs + dy;
        let hw = half;
        if (wob) {
          uu += (drift(u * 1.9 + ox, v * 1.9 + oy) - 0.5) * 0.2 * wob + (drift(u * 8 + oy, v * 8 + ox) - 0.5) * 0.035 * wob;
          vv += (drift(u * 1.9 + oy + 9, v * 1.9 + ox + 5) - 0.5) * 0.2 * wob + (drift(u * 8 + ox + 3, v * 8 + oy + 8) - 0.5) * 0.035 * wob;
          hw *= 1 + (drift(u * 3.1 + ox + 3, v * 3.1 + oy + 7) - 0.5) * 0.5 * wob;
        }
        // (a pen lifts as it comes to the end of a stroke)
        if (taper && open) hw *= 1 - taper * 0.6 * (1 - ease(Math.min(along[i], len - along[i]) / 0.2));
        P[i * 2] = size * (it.x + uu + lean * vv); P[i * 2 + 1] = -size * vv; Hh[i] = hw;
      }
      if (press) for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), tx = P[b * 2] - P[a * 2], ty = P[b * 2 + 1] - P[a * 2 + 1], d = Math.hypot(tx, ty);
        // (a flat pen held at an angle: heavy across its edge, light along it)
        if (d > 1e-6) Hh[i] *= 1 + press * 0.8 * (Math.abs(tx * ny - ty * nx) / d - 0.6);
      }
      const parts = atCorners(run), whole = run.closed && parts.length === 1;
      parts.forEach(([i0, i1], pi) => pieces.push({ p: P.slice(i0 * 2, i1 * 2 + 2), h: Hh.slice(i0, i1 + 1), closed: whole, len: (along[i1] - along[i0]) * size, key: seed + gi * 131 + ri * 17 + pi }));
    });
  });

  const path = new Path2D();
  if (dry > 0) {
    // a brush running dry: the stroke is so many hairs side by side, and each gives out here and there
    const hairs = Math.max(3, Math.min(9, Math.round((2 * half) / 1.4))), unit = Math.max(size, 1);
    for (const { p, h, len, key } of pieces) {
      const n = p.length / 2;
      for (let b = 0; b < hairs; b++) {
        const side = ((b + 0.5) / hairs - 0.5) * 2, edge = Math.abs(side);
        let s = 0, down = false;
        for (let i = 0; i < n; i++) {
          const a = Math.max(0, i - 1), c = Math.min(n - 1, i + 1), tx = p[c * 2] - p[a * 2], ty = p[c * 2 + 1] - p[a * 2 + 1], d = Math.hypot(tx, ty) || 1;
          if (i) s += Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]);
          const x = p[i * 2] + (-ty / d) * side * h[i] * 0.86, yy = p[i * 2 + 1] + (tx / d) * side * h[i] * 0.86;
          const far = len > 0 ? s / len : 0;
          const v = drift((s / unit) * 3.3 + key * 0.37, b * 3.7 + key) * 0.7 + drift((s / unit) * 15 + b * 9.1, key * 1.3) * 0.3;
          const alive = v > dry * (0.42 + 0.3 * edge * edge + 0.3 * far * far);
          if (alive) { if (down) path.lineTo(x, yy); else { path.moveTo(x, yy); path.lineTo(x + 0.01, yy); down = true; } } else down = false;
        }
      }
    }
    made = { path, lineWidth: Math.max(0.6, ((2 * half) / hairs) * 1.55) };
  } else {
    // otherwise each stroke is filled as the shape the pen left, so that it can be heavier in one place than another
    for (const { p, h, closed } of pieces) {
      const n = p.length / 2;
      const dot = (i) => { path.moveTo(p[i * 2] + h[i], p[i * 2 + 1]); path.arc(p[i * 2], p[i * 2 + 1], h[i], 0, Math.PI * 2); };
      if (n < 2) { dot(0); continue; }
      const edge = new Array(n * 4), m = 2 * n;
      for (let i = 0; i < n; i++) {
        let a = i - 1, b = i + 1;
        if (closed) { if (a < 0) a = n - 2; if (b > n - 1) b = 1; } else { a = Math.max(0, a); b = Math.min(n - 1, b); }
        const tx = p[b * 2] - p[a * 2], ty = p[b * 2 + 1] - p[a * 2 + 1], d = Math.hypot(tx, ty) || 1, nx = -ty / d, ny = tx / d;
        edge[i * 2] = p[i * 2] + nx * h[i]; edge[i * 2 + 1] = p[i * 2 + 1] + ny * h[i];
        edge[(m - 1 - i) * 2] = p[i * 2] - nx * h[i]; edge[(m - 1 - i) * 2 + 1] = p[i * 2 + 1] - ny * h[i];
      }
      // (all one way round, so that where strokes cross nothing is left unfilled)
      let area = 0;
      for (let i = 0; i < m; i++) { const j = (i + 1) % m; area += edge[i * 2] * edge[j * 2 + 1] - edge[j * 2] * edge[i * 2 + 1]; }
      if (area >= 0) { path.moveTo(edge[0], edge[1]); for (let i = 1; i < m; i++) path.lineTo(edge[i * 2], edge[i * 2 + 1]); }
      else { path.moveTo(edge[(m - 1) * 2], edge[(m - 1) * 2 + 1]); for (let i = m - 2; i >= 0; i--) path.lineTo(edge[i * 2], edge[i * 2 + 1]); }
      path.closePath();
      dot(0); dot(n - 1);
    }
    made = { path, fill: true };
  }
  if (drawn.size > 400) drawn.clear();
  drawn.set(key, made);
  return made;
}

/**
 * Writes a line. y: the line the letters stand on; size: the height of a capital, in pixels. Gives back how wide
 * it came out. See the head of this file for what can be asked.
 */
export function write(ctx, text, x, y, size, opts = {}) {
  text = String(text);
  const weight = opts.weight ?? 0.11, slant = opts.slant ?? 0;
  const L = plain(text, opts.track ?? 0, !!opts.mono, opts.tab !== false), W = L.w * size;
  if (!L.items.length) return W;
  const x0 = opts.align === 'center' ? x - W / 2 : opts.align === 'right' ? x - W : x;
  ctx.save();
  if (opts.color) { ctx.strokeStyle = opts.color; ctx.fillStyle = opts.color; } else ctx.fillStyle = ctx.strokeStyle;
  if (opts.glow) { ctx.shadowColor = opts.glowColor ?? opts.color ?? ctx.strokeStyle; ctx.shadowBlur = opts.glow; ctx.shadowOffsetX = ctx.shadowOffsetY = 0; }
  if (opts.wobble || opts.stencil || opts.dry || opts.press || opts.taper || opts.pen) {
    const made = byHand(text, L, size, opts, weight, slant);
    ctx.translate(x0, y);
    if (made.fill) ctx.fill(made.path, 'nonzero');
    else { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]); ctx.lineWidth = made.lineWidth; ctx.stroke(made.path); }
  }
  else {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    ctx.transform(size, 0, slant * size, -size, x0, y);
    ctx.lineWidth = weight;
    ctx.stroke(L.path);
  }
  ctx.restore();
  return W;
}

/**
 * Letters cut into metal (or, with raised, standing out of it): written three times, a light edge and a dark
 * edge either side of the letter itself. light and dark are colours; depth is how far apart, as a part of size.
 */
export function engrave(ctx, text, x, y, size, opts = {}) {
  const d = (opts.depth ?? 0.035) * size * (opts.raised ? -1 : 1);
  write(ctx, text, x + d, y + d, size, { ...opts, color: opts.light ?? 'rgba(255, 240, 200, 0.55)', glow: 0 });
  write(ctx, text, x - d * 0.6, y - d * 0.6, size, { ...opts, color: opts.dark ?? 'rgba(20, 12, 4, 0.5)', glow: 0 });
  return write(ctx, text, x, y, size, opts);
}
