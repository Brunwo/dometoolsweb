// The moon: a small bare world, and a place one can stand.
//
// It has no air, so nothing softens it: the sun's light is white and hard, a shadow is nearly black (only the
// light of the home world, hanging always in the same part of its sky, gets into it), the sky is black at noon,
// and the edge of day is a line. Its ground is dust over rock, beaten into bowls by whatever has fallen on it:
// a few broad old ones, many small young ones with pale dust thrown out round them, and dark plains between.
//
// The broad bowls and the middling ones are in the ground itself (one can walk down into them). The small ones,
// down to a hand's width, and the stones lying in the dust, are painted: but painted as shapes, each with its own
// place, width and age, so that the sun lights the wall that faces it and leaves the other dark, wherever the sun
// is. They are scattered, never set out: no two the same distance apart. And the dust between is one soft tone
// that drifts a little: there are no patches in it.
import * as THREE from 'three';
import { createAir, shadowed, CELLS } from './air.js';
import { shapeLand, fbm3, noise3, rng } from './land.js';
import { createPaint } from './paint.js';
import { createTrees } from './trees.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lin = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// Bowls of one size (or stones), scattered over the ground. up: the place, as a direction; st: where that is on the
// six sheets; n: how many squares to a sheet's side they are scattered in, one to a square or none (much: how many
// of the squares have one); seen: 0 to 1, how much of them the eye can tell from where it is; stone: 0 bowls, 1
// stones. Each has its own place in its square, its own width (most small, a few several times that) and its own
// age: a young one is deep and sharp with pale dust thrown out round it, an old one is a shallow soft dip.
// Adds to slope (the lie of the ground: which way is uphill and how steeply, metres up for a metre along) and to
// pale (how much paler the dust is).
const BOWLS = /* glsl */ `
// fine grains, by whole numbers (the other noise here goes to lines when its numbers get large)
float grainAt(ivec2 p, int s) { uint h = uint(p.x) * 374761393u + uint(p.y) * 668265263u + uint(s) * 2246822519u; h = (h ^ (h >> 13u)) * 1274126177u; return float(h ^ (h >> 16u)) / 4294967295.0; }
vec2 grainWay(ivec2 p, int s) { float a = grainAt(p, s) * 6.2831853; return vec2(cos(a), sin(a)); }
// (x: its value, about -0.7 to 0.7; yz: how fast that changes along each way)
vec3 grain(vec2 q, int s) {
  ivec2 i = ivec2(floor(q)); vec2 f = fract(q), w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0), dw = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = grainWay(i, s), gb = grainWay(i + ivec2(1, 0), s), gc = grainWay(i + ivec2(0, 1), s), gd = grainWay(i + ivec2(1, 1), s);
  float a = dot(ga, f), b = dot(gb, f - vec2(1.0, 0.0)), c = dot(gc, f - vec2(0.0, 1.0)), d = dot(gd, f - vec2(1.0, 1.0)), m = a - b - c + d;
  return vec3(a + w.x * (b - a) + w.y * (c - a) + w.x * w.y * m, ga + w.x * (gb - ga) + w.y * (gc - ga) + w.x * w.y * (ga - gb - gc + gd) + dw * (w.yx * m + vec2(b, c) - a));
}
void bowls(vec3 up, vec3 st, float n, float seed, float much, float seen, float stone, inout vec3 slope, inout float pale, inout float shade) {
  vec2 q = (st.xy * 0.5 + 0.5) * n, sq = floor(q);
  float pace = uLand.y * 1.5707963 / n;
  // (the way to the sun along the ground, and how high it stands: for the shadow a lip or a stone throws)
  vec3 sunT = uSun - up * dot(uSun, up); float sunL = max(length(sunT), 1e-4), sunHigh = dot(uSun, up) / sunL; sunT /= sunL;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = sq + vec2(float(i), float(j));
    if (c.x < 0.0 || c.y < 0.0 || c.x >= n || c.y >= n) continue;
    vec3 h = cHash3(vec3(c, st.z * 13.0 + seed)), k = cHash3(vec3(c + 57.0, st.z * 7.0 + seed + n));
    float r = mix(0.09, 0.4, k.y * k.y * k.y);
    vec2 at = (c + h.xy) / n * 2.0 - 1.0;
    vec3 mid = landDir(at, st.z);
    // (they fell in showers: thick in one place and few in the next)
    if (k.x > much * mix(0.25, 1.0, smoothstep(0.3, 0.7, aNoise3(mid * uLand.y * 0.2 / pace + seed)))) continue;
    // (one that would lie across the edge of its sheet is left out: the next sheet knows nothing of it)
    if (max(abs(at.x), abs(at.y)) + r * 5.2 / n > 1.0) continue;
    vec3 to = up - mid; to -= up * dot(to, up);
    float d = length(to) * uLand.y, x = d / (r * pace);
    if (x >= 2.0) continue;
    vec3 out1 = to / max(length(to), 1e-6);
    // (a stone is not round: it is wider one way than another, with a corner or two)
    if (stone > 0.5) { float th = atan(dot(out1, cross(up, sunT)), dot(out1, sunT)); x /= 1.0 + 0.24 * sin(2.0 * th + h.z * 6.28) + 0.13 * sin(3.0 * th + k.z * 19.0) + 0.07 * sin(5.0 * th + h.z * 40.0); }
    float age = k.z * k.z * k.z, edge = 1.0 - smoothstep(1.5, 2.0, x), dh;
    float u = x * dot(out1, sunT), v = sqrt(max(x * x - u * u, 0.0));
    if (stone > 0.5) {
      // a stone: a low dome, steep at its sides
      float tall = 1.1 + 1.5 * age;
      dh = x < 1.0 ? -tall * x * (1.0 - x * x * x * x) : 0.0;
      // (and the shadow it throws, away from the sun, as long as the sun is low)
      float tail = tall / 3.0 / max(sunHigh, 0.08);
      float along = clamp(-u / tail, 0.0, 1.0);
      shade = max(shade, (1.0 - smoothstep(0.45, 0.9, v / (1.0 - 0.6 * along))) * step(u, 0.0) * (1.0 - smoothstep(0.7, 1.0, along)) * smoothstep(0.8, 1.0, x) * edge * seen);
      pale += (h.z - 0.35) * 0.5 * (1.0 - smoothstep(0.7, 1.0, x)) * seen;
    } else {
      // a bowl, and its lip: the lip narrow and steep when young, broad and low when old
      float deep = mix(0.05, 0.27, age), lip = mix(0.01, 0.055, age), w = x < 1.0 ? mix(0.3, 0.2, age) : mix(0.55, 0.3, age);
      dh = (x < 1.0 ? 2.0 * deep * x * (1.0 - smoothstep(mix(0.6, 0.86, age), 1.0, x)) : 0.0) - lip * exp(-(x - 1.0) * (x - 1.0) / (w * w)) * 2.0 * (x - 1.0) / (w * w);
      // (the shadow its sunward wall throws across its floor: a bowl this deep, the sun this high)
      shade = max(shade, smoothstep(-0.12, 0.12, u + sqrt(max(1.0 - v * v, 0.0)) - sunHigh / deep) * (1.0 - smoothstep(0.88, 1.0, x)) * seen);
      pale += smoothstep(0.45, 1.0, age) * exp(-x * x / 1.3) * 0.34 * edge * seen;
    }
    slope += out1 * dh * edge * seen;
  }
}
`;

function createMoonLand(radius) {
  const R = rng(90210), craters = [], d0 = new THREE.Vector3();
  for (let i = 0; i < 400 && craters.length < 58; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u), dir = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s);
    // (its width as an angle: most are a few paces across, a few are a tenth of the moon)
    const wide = 0.07 + 0.21 * R() ** 3.2, metres = wide * radius;
    // (a new one is not let fall right on the rim of a big one: it would break the ring)
    if (craters.some((c) => { const far = Math.acos(Math.min(1, c.dir.dot(dir))); return Math.abs(far - c.wide) < wide * 0.7 && c.wide > wide * 1.5; })) continue;
    craters.push({ dir, wide, reach: Math.cos(Math.min(3, wide * 2.2)), deep: Math.min(metres * 0.3, 4.6) * (0.7 + 0.5 * R()), rim: Math.min(metres * 0.085, 1.3) * (0.6 + 0.7 * R()), fresh: R() ** 2 });
  }
  // and the middling ones, a few paces across: far more of them, anywhere (in a broad one's floor, on its lip, on each other)
  for (let i = 0; i < 230; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u), dir = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s);
    const wide = 0.026 + 0.05 * R() ** 2.4, metres = wide * radius, age = R();
    craters.push({ dir, wide, reach: Math.cos(wide * 2.2), deep: metres * (0.1 + 0.2 * age) * (0.8 + 0.4 * R()), rim: metres * (0.02 + 0.05 * age), fresh: age ** 3 * 0.7 });
  }
  function height(d) {
    let h = 1.3 * fbm3(d.x * 1.3 + 4.1, d.y * 1.3 - 2.2, d.z * 1.3 + 0.4, 4) + 0.45 * fbm3(d.x * 5.7, d.y * 5.7, d.z * 5.7, 3) + 0.1 * noise3(d.x * 23, d.y * 23, d.z * 23);
    // the plains lie low and level
    const plain = sstep(0.02, 0.3, fbm3(d.x * 1.5 + 20.5, d.y * 1.5 + 3.3, d.z * 1.5 - 7.1, 3));
    h = h * (1 - 0.7 * plain) - 1.6 * plain;
    for (const c of craters) {
      const cos = d.dot(c.dir);
      if (cos < c.reach) continue;
      const x = Math.acos(Math.min(1, cos)) / c.wide;
      // a bowl, flat in the middle if it is a wide one, and a raised lip that falls away outside
      if (x < 1) h -= c.deep * (1 - x * x) ** 1.45;
      h += c.rim * Math.exp(-(((x - 1) / (x < 1 ? 0.24 : 0.36)) ** 2));
    }
    return h;
  }
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), dd = new THREE.Vector3();
  function steep(d) {
    e1.set(0.31, 0.83, 0.46); if (Math.abs(d.dot(e1.normalize())) > 0.9) e1.set(1, 0, 0); e1.cross(d).normalize(); e2.crossVectors(d, e1);
    const eps = 0.5 / radius, h0 = height(d), hx = height(dd.copy(d).addScaledVector(e1, eps).normalize()), hy = height(dd.copy(d).addScaledVector(e2, eps).normalize());
    return Math.hypot(hx - h0, hy - h0) / 0.5;
  }
  /** What the ground is: [dark plain, broken rock, pale dust thrown from a young crater, nothing]. */
  function kind(d) {
    const plain = sstep(0.02, 0.3, fbm3(d.x * 1.5 + 20.5, d.y * 1.5 + 3.3, d.z * 1.5 - 7.1, 3));
    let thrown = 0;
    for (const c of craters) {
      const cos = d.dot(c.dir);
      if (cos < c.reach) continue;
      const x = Math.acos(Math.min(1, cos)) / c.wide;
      // (it lies thickest on the lip and in streaks outward)
      const streak = 0.6 + 0.4 * noise3(d0.copy(d).sub(c.dir).normalize().x * 9 + c.wide * 50, d0.y * 9, d0.z * 9);
      thrown += c.fresh * Math.exp(-(((x - 1.05) / (x < 1.05 ? 0.2 : 0.75)) ** 2)) * streak;
    }
    return [plain, sstep(0.3, 0.62, steep(d)), Math.min(1, thrown), 0];
  }
  return { ...shapeLand({ radius, squares: 160, mesh: 240, height, kind }), places: { start: new THREE.Vector3(0, 1, 0) }, craters };
}

/** body: the moon in the system. kinds: the stones there are to set on it (trees.js). */
export function createMoon(body, kinds) {
  const land = createMoonLand(body.radius), air = createAir(land), U = air.uniforms;
  // no air: white light, nothing taken from it; no sky, only the home world's light; and no wind
  U.uSunCol.value = lin('#fff3df', 1.7);
  U.uTau.value.set(0, 0, 0);
  U.uSkyDay.value.setRGB(0, 0, 0); U.uSkyDusk.value.setRGB(0, 0, 0); U.uSkyNight.value = lin('#6c86c8', 0.05);
  U.uWind.value.w = 0;
  // (when the home world hides the sun, the light that comes round it through its air is a dull red)
  U.uShadeGlow.value.setRGB(0.05, 0.012, 0.005);
  // (what the greens of the home world are here: there is no moss, only dust in the stones' hollows)
  for (const k of ['uG1', 'uG2', 'uG3', 'uG4']) U[k].value = lin('#8c877f');
  U.uRock.value = lin('#a8a297'); U.uEarth.value = lin('#5b5754');
  U.uBounce.value.setRGB(0.035, 0.033, 0.03);

  const ground = shadowed(air, {
    key: 'moon-ground',
    vertexPars: 'varying vec3 vAt; varying vec3 vFace;',
    vertex: '#include <begin_vertex>\n  vAt = position; vFace = normal;',
    fragmentPars: CELLS + BOWLS + 'varying vec3 vAt; varying vec3 vFace;',
    fragment: /* glsl */ `
  vec3 gUp = normalize(vAt), gN = normalize(vFace), gST = landST(gUp);
  vec4 gKind = texture2D(tKind, landUv(gST));
  float gD = distance(vAt, cameraPosition);
  // (how much ground one dot of the picture covers here: what is finer than that is left out)
  float gPx = max(length(dFdx(vAt)), length(dFdy(vAt)));
  // dust: pale on the high ground, dark on the plains, palest where it was thrown out of a young crater
  vec3 gCol = mix(uRock, uEarth, gKind.r) * (1.0 + 0.6 * gKind.b);
  // it is one soft tone that drifts: a little lighter here, a little darker there, broadly and finely
  {
    mat3 turn = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
    vec3 p = vAt; float f = 0.035, a = 0.2, drift = 0.0;
    for (int i = 0; i < 5; i++) {
      drift += (aNoise3(p * f + 3.0) - 0.5) * a * (1.0 - smoothstep(0.1, 0.34, gPx * f));
      p = turn * p; f *= 3.1; a *= 0.72;
    }
    gCol *= 1.0 + drift;
  }
  // the bowls beaten into it, in four sizes from a few paces down to a hand's width, and the stones that lie on it
  vec3 gSlope = vec3(0.0); float gPale = 0.0, gShade = 0.0;
  for (int i = 0; i < 5; i++) {
    float n = i == 0 ? 22.0 : i == 1 ? 52.0 : i == 2 ? 124.0 : i == 3 ? 300.0 : 720.0, pace = uLand.y * 1.5707963 / n;
    float seen = 1.0 - smoothstep(0.035, 0.11, gPx / pace);
    if (seen > 0.01) bowls(gUp, gST, n, float(i) * 17.3, i < 2 ? 0.74 : i == 2 ? 0.5 : 0.26, seen, 0.0, gSlope, gPale, gShade);
  }
  {
    float n = 1100.0, pace = uLand.y * 1.5707963 / n, seen = 1.0 - smoothstep(0.02, 0.07, gPx / pace);
    if (seen > 0.01) bowls(gUp, gST, n, 91.0, 0.3, seen, 1.0, gSlope, gPale, gShade);
  }
  gCol *= 1.0 + 0.5 * gPale;
  // grains: the dust is fine, and close to it is seen to be made of something
  // the dust itself: fine, but close to it is seen to be made of grains and crumbs, each catching the sun a little
  {
    float per = uLand.y * 1.5707963; vec2 q = (gST.xy * 0.5 + 0.5) * per; int sheet = int(gST.z);
    // (the two ways along a sheet, here)
    vec3 eS = normalize(landDir(gST.xy + vec2(2e-3, 0.0), gST.z) - gUp), eT = normalize(landDir(gST.xy + vec2(0.0, 2e-3), gST.z) - gUp);
    float tone = 0.0; vec2 lie = vec2(0.0);
    for (int i = 0; i < 4; i++) {
      float f = i == 0 ? 9.0 : i == 1 ? 27.0 : i == 2 ? 70.0 : 170.0, k = 1.0 - smoothstep(0.05, 0.17, gPx * f);
      if (k < 0.01) continue;
      vec3 g = grain(q * f, sheet + i * 7);
      tone += g.x * 0.09 * k;
      // (crumbs of a size stand about so high: a twentieth of their width)
      lie += g.yz * k * (i == 0 ? 0.03 : 0.085);
    }
    gCol *= 1.0 + tone;
    gSlope += eS * lie.x + eT * lie.y;
  }
  // where it is steep the dust has slid off the rock
  // (how steep, from the lie of the ground itself, which is finer than the picture of what the ground is)
  float gTan = length(gN - gUp * dot(gN, gUp)) / max(dot(gN, gUp), 0.2);
  gCol = mix(gCol, gCol * vec3(0.66, 0.64, 0.66), smoothstep(0.3, 0.62, gTan) * 0.75);
  // hard light: ground turned from the sun goes dark as it turns, and there is nothing to fill the shadow but the
  // home world's glow
  // (what is painted turns the light as it would if it were there: a wall toward the sun is brighter, one turned
  // from it darker, and in the shadow of a lip or a stone there is no sun at all)
  float gFace = dot(gN, uSun), gTurn = clamp(1.0 + (dot(normalize(gN - gSlope), uSun) - gFace) / max(gFace, 0.12), 0.1, 2.3) * (1.0 - gShade);
  float gSun = smoothstep(-0.04, 0.24, gFace) * (0.3 + 0.7 * clamp(gFace * 1.15, 0.0, 1.0)) * gTurn * outgoingLight.g;
  vec3 gC = lit(gCol, vAt, gSun, 1.0);
  gC += gCol * shipGlow(vAt);
  gl_FragColor = vec4(gC, 1.0);`,
  });
  const scene = new THREE.Scene();
  for (const g of land.sheets) {
    const mesh = new THREE.Mesh(g, ground);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  const paint = createPaint(air), stones = createTrees(paint, land, null, { bare: 170, kinds });
  scene.add(stones.group);
  return { land, air, scene, stones, paint };
}
