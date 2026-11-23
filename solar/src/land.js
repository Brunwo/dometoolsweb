// The ground of a small round world.
//
// A world is a ball with hills on it: at every direction from its middle the ground stands so many metres above or
// below the ball's own radius. That one rule (`height`) is what the walker stands on, what the mesh is made from,
// and what everything planted is set upon.
//
// For shaders the ground is also kept as pictures. A ball has no flat map, so the pictures are laid out as six
// square sheets, one to each side of a cube blown out into the ball (each sheet bent so that its squares stay
// nearly the same size all over). Each sheet is drawn a little past its own edge, so that reading the picture
// near an edge is seamless:
//   tHeight  how high the ground is (metres over the radius);
//   tKind    what it is: r trodden earth (the path), g bare rock, b how much of a hollow it is (0 a crest, a half
//            level ground, 1 a hollow), a how well grass grows.
import * as THREE from 'three';

const Q = Math.PI / 4;
/** The six sheets: the way each faces (A), and the two ways across it (U, V). */
export const FACES = [
  { A: [1, 0, 0], U: [0, 0, -1], V: [0, 1, 0] }, { A: [-1, 0, 0], U: [0, 0, 1], V: [0, 1, 0] },
  { A: [0, 1, 0], U: [1, 0, 0], V: [0, 0, -1] }, { A: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1] },
  { A: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0] }, { A: [0, 0, -1], U: [-1, 0, 0], V: [0, 1, 0] },
].map((f) => ({ A: new THREE.Vector3(...f.A), U: new THREE.Vector3(...f.U), V: new THREE.Vector3(...f.V) }));
/** The direction at (s, t), each -1..1, on sheet f. */
export function dirOf(f, s, t, out = new THREE.Vector3()) {
  const F = FACES[f], a = Math.tan(s * Q), b = Math.tan(t * Q);
  return out.set(F.A.x + F.U.x * a + F.V.x * b, F.A.y + F.U.y * a + F.V.y * b, F.A.z + F.U.z * a + F.V.z * b).normalize();
}
/** Where a direction falls on a given sheet (which need not be the sheet it is nearest to): [s, t], or null if it faces away. */
export function onFace(f, d) {
  const F = FACES[f], k = d.dot(F.A);
  if (k < 0.2) return null;
  return [Math.atan(d.dot(F.U) / k) / Q, Math.atan(d.dot(F.V) / k) / Q];
}

export const LAND = /* glsl */ `
uniform sampler2D tHeight; uniform sampler2D tKind; uniform vec2 uLand; // x: squares to a sheet's side, y: the world's radius
// where a direction falls: xy on its sheet (-1..1), z which sheet
vec3 landST(vec3 d) {
  vec3 a = abs(d); float f; vec2 q;
  if (a.x >= a.y && a.x >= a.z) { f = d.x > 0.0 ? 0.0 : 1.0; q = (d.x > 0.0 ? vec2(-d.z, d.y) : vec2(d.z, d.y)) / a.x; }
  else if (a.y >= a.z) { f = d.y > 0.0 ? 2.0 : 3.0; q = (d.y > 0.0 ? vec2(d.x, -d.z) : vec2(d.x, d.z)) / a.y; }
  else { f = d.z > 0.0 ? 4.0 : 5.0; q = (d.z > 0.0 ? vec2(d.x, d.y) : vec2(-d.x, d.y)) / a.z; }
  return vec3(atan(q) * 1.2732395, f);
}
// and back: the direction a place on a sheet lies in
vec3 landDir(vec2 st, float f) {
  vec2 t = tan(st * 0.7853982);
  if (f < 0.5) return normalize(vec3(1.0, t.y, -t.x));
  if (f < 1.5) return normalize(vec3(-1.0, t.y, t.x));
  if (f < 2.5) return normalize(vec3(t.x, 1.0, -t.y));
  if (f < 3.5) return normalize(vec3(t.x, -1.0, t.y));
  if (f < 4.5) return normalize(vec3(t.x, t.y, 1.0));
  return normalize(vec3(-t.x, t.y, -1.0));
}
// where in the pictures that is
vec2 landUv(vec3 st) { return (vec2(mod(st.z, 3.0), floor(st.z / 3.0)) + (1.0 + (st.xy * 0.5 + 0.5) * uLand.x) / (uLand.x + 2.0)) / vec2(3.0, 2.0); }
`;

// --- smooth noise in three dimensions, and a seeded dice ---
const perm = new Uint8Array(512);
{
  let s = 20261116;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
/** Perlin noise, about -1..1. */
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z), A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(
    lerp(lerp(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u), lerp(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u), lerp(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}
export function fbm3(x, y, z, octaves = 4) { let s = 0, a = 0.5; for (let i = 0; i < octaves; i++) { s += a * noise3(x, y, z); x = x * 2.03 + 7.1; y = y * 2.03 - 3.7; z = z * 2.03 + 1.9; a *= 0.5; } return s; }
export function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * The home world's ground. Its places are named by the direction they lie in from its middle:
 *   start   a low rise in open meadow, where one first stands;
 *   tor     a rocky hill, the highest ground;
 *   hollow  a wide dip, with a lake in it;
 * and a trodden way runs from the start over toward the tor and on round to the hollow.
 */
export function createLand({ radius = 220, squares = 256, mesh = 176 } = {}) {
  const START = V(0.1, 1, 0.16).normalize(), TOR = V(0.86, 0.5, -0.3).normalize(), HOLLOW = V(-0.55, 0.45, 0.75).normalize();
  // the way: a line of places, each walked to along the shortest path from the last
  const WAY = [START, V(0.34, 0.95, 0.02), V(0.58, 0.82, -0.22), V(0.8, 0.6, -0.3), V(0.5, 0.75, 0.42), V(0.05, 0.72, 0.72), V(-0.36, 0.56, 0.78), HOLLOW].map((p) => p.clone().normalize());
  const a = V(0, 0, 0), b = V(0, 0, 0), n = V(0, 0, 0), c = V(0, 0, 0);
  // The lake: water stands in the great hollow up to this level (metres over the radius). Nowhere else: another
  // dip as low, somewhere, is dry. About fifty paces across, and under two metres at its deepest.
  const LAKE = -5.7, lakeAt = (d) => (d.dot(HOLLOW) > Math.cos(52 / radius) ? LAKE : -1e9);
  /** How far a direction is from the way, in metres over the ground. */
  function wayDist(d) {
    let best = Infinity;
    for (let i = 0; i < WAY.length - 1; i++) {
      const p = WAY[i], q = WAY[i + 1];
      n.crossVectors(p, q).normalize();
      // the nearest point of the great circle through p and q, kept between them
      c.copy(d).addScaledVector(n, -d.dot(n)).normalize();
      if (a.crossVectors(p, c).dot(n) < 0) c.copy(p); else if (b.crossVectors(c, q).dot(n) < 0) c.copy(q);
      best = Math.min(best, Math.acos(Math.min(1, d.dot(c))) * radius);
    }
    // (it wanders a little: it was made by feet)
    return best + 0.5 * noise3(d.x * 26, d.y * 26, d.z * 26);
  }
  const bump = (d, at, wide) => { const ang = Math.acos(Math.min(1, d.dot(at))); return Math.exp(-((ang / wide) ** 2)); };
  /** Metres above the world's radius, for a direction (a unit vector). */
  function height(d) {
    let h = 7.5 * fbm3(d.x * 1.7 + 3.1, d.y * 1.7 - 1.3, d.z * 1.7 + 0.7, 4) + 1.5 * fbm3(d.x * 6.1, d.y * 6.1, d.z * 6.1, 3);
    const tor = bump(d, TOR, 0.17);
    h += 15 * tor + 2.4 * tor * noise3(d.x * 19, d.y * 19, d.z * 19);
    h -= 6.5 * bump(d, HOLLOW, 0.2);
    // the rise one starts on: gathered up a little and levelled on top
    const s = bump(d, START, 0.13);
    return h * (1 - 0.55 * s) + 2.6 * s;
  }
  /** How steep the ground is at a direction: the sine of its slope, about. */
  const e1 = V(0, 0, 0), e2 = V(0, 0, 0), dd = V(0, 0, 0);
  function tangents(d) { e1.set(0.31, 0.83, 0.46); if (Math.abs(d.dot(e1.normalize())) > 0.9) e1.set(1, 0, 0); e1.cross(d).normalize(); e2.crossVectors(d, e1); }
  function steep(d) {
    tangents(d);
    const eps = 0.6 / radius, h0 = height(d), hx = height(dd.copy(d).addScaledVector(e1, eps).normalize()), hy = height(dd.copy(d).addScaledVector(e2, eps).normalize());
    return Math.hypot(hx - h0, hy - h0) / 0.6;
  }
  /** What the ground is at a direction: [earth, rock, how much of a hollow, grass], each 0..1. */
  function kind(d) {
    const way = 1 - sstep(0.55, 1.25, wayDist(d)), slope = steep(d), tor = bump(d, TOR, 0.085);
    const rock = Math.min(1, sstep(0.42, 0.7, slope + 0.25 * noise3(d.x * 40, d.y * 40, d.z * 40)) + sstep(0.35, 0.8, tor + 0.3 * noise3(d.x * 30, d.y * 30, d.z * 30)));
    // how much of a hollow: the ground ten paces off all round, less the ground here
    tangents(d);
    const far = 11 / radius, here = height(d);
    let round = 0;
    for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) round += height(dd.copy(d).addScaledVector(e1, u * far).addScaledVector(e2, v * far).normalize());
    const hollow = Math.min(1, Math.max(0, 0.5 + (round / 4 - here) / 1.6));
    // (under the lake and a step up its shore there is no grass: wet sand, and the lake's bed)
    const wet = 1 - sstep(-0.1, 0.42, here - lakeAt(d));
    return [Math.max(way, wet) * (1 - rock), rock, hollow, (1 - way) * (1 - rock) * (1 - wet)];
  }
  /** How wooded a direction is, 0 (open meadow) to 1 (deep wood). */
  function wood(d) {
    const w = sstep(-0.06, 0.2, fbm3(d.x * 2.3 - 5.5, d.y * 2.3 + 8.2, d.z * 2.3 + 2.4, 3));
    return w * (1 - bump(d, START, 0.062)) * (1 - bump(d, TOR, 0.1)) * (1 - sstep(2.5, 0.8, wayDist(d)) * 0.9);
  }

  const shaped = shapeLand({ radius, squares, mesh, height, kind });
  return {
    ...shaped, wood, steep, wayDist, places: { start: START, tor: TOR, hollow: HOLLOW, way: WAY }, lake: LAKE,
    /** How deep the water is at a direction (nothing, where there is none). */
    water: (d) => Math.max(0, lakeAt(d) - height(d)),
    /** Whether a direction is in the lake or on its beach (nothing grows there). */
    shore: (d) => height(d) - lakeAt(d) < 0.8,
    /** Where whoever stands there stands: on the ground, or, in the lake, no deeper than the knee (nobody is let go under). */
    ground: (d) => Math.max(shaped.ground(d), radius + lakeAt(d) - 0.45),
  };
}

/**
 * A round ground made from a rule for its height (metres over the radius, for a direction) and a rule for what it
 * is there (four numbers, 0..1): the pictures the painting reads, the six sheets of the ground itself, and where the
 * ground is for whoever stands on it.
 */
export function shapeLand({ radius, squares = 256, mesh = 176, height, kind }) {
  const e1 = V(0, 0, 0), e2 = V(0, 0, 0), dd = V(0, 0, 0);
  function tangents(d) { e1.set(0.31, 0.83, 0.46); if (Math.abs(d.dot(e1.normalize())) > 0.9) e1.set(1, 0, 0); e1.cross(d).normalize(); e2.crossVectors(d, e1); }
  // --- the pictures ---
  const N = squares, T = N + 2, W = T * 3, Ht = T * 2;
  const heights = new Uint16Array(W * Ht), kinds = new Uint8Array(W * Ht * 4), d = V(0, 0, 0);
  for (let f = 0; f < 6; f++) for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    dirOf(f, ((i - 0.5) / N) * 2 - 1, ((j - 0.5) / N) * 2 - 1, d);
    const k = ((f / 3 | 0) * T + j) * W + (f % 3) * T + i;
    heights[k] = THREE.DataUtils.toHalfFloat(height(d));
    const [r, g, bl, al] = kind(d);
    kinds.set([r * 255, g * 255, bl * 255, al * 255], k * 4);
  }
  const tHeight = new THREE.DataTexture(heights, W, Ht, THREE.RedFormat, THREE.HalfFloatType), tKind = new THREE.DataTexture(kinds, W, Ht, THREE.RGBAFormat, THREE.UnsignedByteType);
  for (const t of [tHeight, tKind]) { t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; }

  // --- the ground itself: six sheets of it ---
  const M = mesh, sheets = [], p = V(0, 0, 0), q = V(0, 0, 0), r = V(0, 0, 0), nn = V(0, 0, 0);
  const at = (dir, out) => out.copy(dir).multiplyScalar(radius + height(dir));
  for (let f = 0; f < 6; f++) {
    const pos = new Float32Array((M + 1) * (M + 1) * 3), nor = new Float32Array((M + 1) * (M + 1) * 3), index = new Uint32Array(M * M * 6);
    for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) {
      dirOf(f, (i / M) * 2 - 1, (j / M) * 2 - 1, d);
      at(d, p);
      // which way the ground faces there: from two places a pace off
      tangents(d);
      const eps = 0.9 / radius;
      at(dd.copy(d).addScaledVector(e1, eps).normalize(), q).sub(p);
      at(dd.copy(d).addScaledVector(e2, eps).normalize(), r).sub(p);
      nn.crossVectors(q, r).normalize();
      if (nn.dot(d) < 0) nn.negate();
      const k = (j * (M + 1) + i) * 3;
      pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z; nor[k] = nn.x; nor[k + 1] = nn.y; nor[k + 2] = nn.z;
    }
    // (the sheets are not all wound the same way round: each is wound so that it faces out)
    const F = FACES[f], out = q.crossVectors(F.U, F.V).dot(F.A) > 0;
    let k = 0;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const v0 = j * (M + 1) + i, v1 = v0 + 1, v2 = v0 + M + 1, v3 = v2 + 1;
      if (out) { index[k++] = v0; index[k++] = v1; index[k++] = v2; index[k++] = v1; index[k++] = v3; index[k++] = v2; }
      else { index[k++] = v0; index[k++] = v2; index[k++] = v1; index[k++] = v1; index[k++] = v2; index[k++] = v3; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeBoundingSphere();
    sheets.push(g);
  }

  return {
    radius, squares: N, height, kind, sheets, tHeight, tKind,
    /** The ground's radius at a direction (metres from the world's middle). */
    ground: (dir) => radius + height(dir),
    /** Which way the ground faces at a direction. */
    normal(dir, out = new THREE.Vector3()) {
      tangents(dir);
      const eps = 0.9 / radius;
      at(dir, p);
      at(dd.copy(dir).addScaledVector(e1, eps).normalize(), q).sub(p);
      at(dd.copy(dir).addScaledVector(e2, eps).normalize(), r).sub(p);
      out.crossVectors(q, r).normalize();
      return out.dot(dir) < 0 ? out.negate() : out;
    },
  };
}
