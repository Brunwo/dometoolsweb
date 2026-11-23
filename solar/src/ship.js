// The ship: a round wooden hut that flies.
//
// Barrel staves bound in copper hoops, a copper cone of a roof, a lantern window round the front, four sprung
// legs, a ramp at the back that is also its door; inside, one round room with the pilot's seat at the window. It
// is built in Blender from a script (tools/ship/build.py), which also works out, for every surface, how much of
// the sky reaches it and how its own lamps light it. Here it is painted with those, and with the sun as it is.
//
// It flies by pushing, in whichever way it is asked, and everything that pulls on it really pulls: the world under
// it, and the other one. Nothing holds it up but its own push.
//
// Where it is, is kept in the frame of the world it is nearest: that world's middle is the origin and its ground
// stands still, so a ship at rest on the ground is simply at rest. Because that frame turns (and, for the moon,
// is itself swung round the home world), the ship is also pushed by what a turning frame adds, so that a ship
// drifting free goes exactly as it would if no frame had been chosen. main.js moves it from one world's frame to
// the other's when the other becomes the nearer.
//
// Its own directions: +Y up, the window toward -Z, the door and ramp toward +Z, +X to the pilot's right.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { shadowed } from './air.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** How hard it can push, sideways and along (m/s²), and upward. */
export const PUSH = 22, LIFT = 27;
/** How a thruster comes on: the part of its burn it lights at, the seconds it takes to come up to all of it, and to go out. */
const START = 0.4, RISE = 0.5, OUT = 0.12;
/** The room, in the ship's own directions (metres): its floor; where the ramp is hinged, how far it runs out and how far it swings down; where the seat is; how wide the ship is to a tree. */
export const DECK = { floor: 1.05, hinge: 2.58, long: 2.36, run: 2.113, open: Math.asin(1.05 / 2.36), drop: 0, seat: V(0, 1.05, -0.86), wide: 3.3 };
/** The ramp is let down until its foot meets the ground: drop is how far the ground there is above (or below) the ship's feet. */
export function rampTo(drop) {
  DECK.drop = THREE.MathUtils.clamp(drop, -0.5, 0.5);
  DECK.open = Math.asin((DECK.floor - DECK.drop) / DECK.long);
  DECK.run = DECK.long * Math.cos(DECK.open);
}
const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
const up = V(0, 0, 0), a = V(0, 0, 0), t = V(0, 0, 0), w = V(0, 0, 0), n = V(0, 0, 0), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
/** Where its four feet are, in its own directions. */
const PADS = [[2.56, -2.56], [2.56, 2.56], [-2.56, 2.56], [-2.56, -2.56]], pad = [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)], lean = V(0, 0, 0), mid = V(0, 0, 0);

/** Fetches the ship as built, and the pictures of its light. */
export async function loadShip(base = 'ship/') {
  const picture = (name) => new THREE.TextureLoader().loadAsync(base + name).then((tx) => {
    tx.flipY = false; tx.colorSpace = THREE.NoColorSpace; tx.anisotropy = 8; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter;
    return tx;
  });
  const [gltf, hullLamp, hullSky, roomLamp, roomSky] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(base + 'ship.glb'), picture('hull-lamp.webp'), picture('hull-sky.webp'), picture('room-lamp.webp'), picture('room-sky.webp'),
  ]);
  const parts = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { parts[o.name] = o; });
  for (const o of Object.values(parts)) {
    const g = o.geometry;
    if (!g) continue;
    // (the file is packed: each piece's places are whole numbers, and its own frame says how to read them. They are
    // read here once, into the ship's own metres, about the place the piece is hung from if it is one that moves)
    {
      const pivot = parts['pivot_' + o.name]?.position ?? new THREE.Vector3(), src = g.attributes.position, flat = new Float32Array(src.count * 3), v = new THREE.Vector3();
      o.updateMatrix();
      const M = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z).multiply(o.matrix);
      for (let i = 0; i < src.count; i++) { v.fromBufferAttribute(src, i).applyMatrix4(M); flat[i * 3] = v.x; flat[i * 3 + 1] = v.y; flat[i * 3 + 2] = v.z; }
      g.setAttribute('position', new THREE.BufferAttribute(flat, 3));
      o.position.copy(pivot); o.quaternion.identity(); o.scale.set(1, 1, 1); o.updateMatrix();
    }
    if (g.attributes.color) { g.setAttribute('tint4', g.attributes.color); g.deleteAttribute('color'); }
    // (how its grain runs, and what it is made of: lib.py)
    if (g.attributes.uv1) { g.setAttribute('grain2', g.attributes.uv1); g.deleteAttribute('uv1'); }
    if (g.attributes.uv2) { g.setAttribute('kind2', g.attributes.uv2); g.deleteAttribute('uv2'); }
    g.computeBoundingSphere();
  }
  return { parts, maps: { hull: [hullLamp, hullSky], room: [roomLamp, roomSky] }, eye: parts.seat_eye.position.clone(), swing: parts.screen_swing?.position.x ?? 0 };
}

/**
 * The paint for a part of the ship under one world's light.
 *
 * Every piece says what it is made of (tools/ship/lib.py, KINDS) and which way its grain runs, and is painted
 * accordingly: boards with their rings and knots, paint worn through to the wood along edges, copper going green
 * in its corners, brass rubbed bright where hands reach it, cloth with its weave, padding with its stitches.
 * Where an edge is, is read from how fast the surface turns there. All of it is worked out as it is drawn, so it
 * is as sharp at the length of an arm as from across the grass.
 */
function shipPaint(air, lamp, sky, shared, baked = 1, inner = 1, sunK = 1) {
  return shadowed(air, {
    key: 'ship', taps: 16, own: { tLamp: { value: lamp }, tSky: { value: sky }, uBaked: { value: baked }, uInner: { value: inner }, uSunK: { value: sunK }, ...shared },
    vertexPars: `attribute vec4 tint4; attribute vec2 grain2; attribute vec2 kind2;
      varying vec3 vRest; varying vec3 vNl; varying vec4 vTint; varying vec3 vWorld; varying vec2 vLm; varying vec2 vGrain; varying vec2 vKind;
      varying vec3 vSunO; varying vec3 vUpO; varying vec3 vViewO;`,
    vertex: `#include <begin_vertex>
  vRest = position; vNl = normal; vTint = tint4; vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vLm = uv; vGrain = grain2; vKind = kind2;
  // (the light is reckoned in the ship's own directions, where its places are small numbers)
  mat3 sBack = transpose(mat3(modelMatrix));
  vSunO = sBack * uSun; vUpO = sBack * normalize(vWorld); vViewO = sBack * (cameraPosition - vWorld);`,
    fragmentPars: `uniform sampler2D tLamp; uniform sampler2D tSky; uniform sampler2D tPrint; uniform sampler2D tDial;
      uniform float uBaked; uniform float uInner; uniform float uSunK; uniform float uLamps; uniform float uSkyK; uniform float uDoor; uniform vec3 uFill;
      uniform vec3 uThrust; uniform float uLit[8]; uniform float uBack;
      varying vec3 vRest; varying vec3 vNl; varying vec4 vTint; varying vec3 vWorld; varying vec2 vLm; varying vec2 vGrain; varying vec2 vKind;
      varying vec3 vSunO; varying vec3 vUpO; varying vec3 vViewO;
      float sH(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float sN2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sH(i), sH(i + vec2(1.0, 0.0)), f.x), mix(sH(i + vec2(0.0, 1.0)), sH(i + vec2(1.0, 1.0)), f.x), f.y); }
      float sF2(vec2 p) { return sN2(p) * 0.55 + sN2(p * 2.13 + 7.1) * 0.3 + sN2(p * 4.7 + 3.3) * 0.15; }
      vec2 sH2(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
      // the dab of a brush a place is in: a number of the dab's own, how far it is from the dab's edge, how far from its middle
      vec3 sDab(vec2 p) {
        vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0, id = 0.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y)), r = o + sH2(i + o) - f; float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; id = sH(i + o + 7.3); } else if (d < d2) d2 = d;
        }
        return vec3(id, sqrt(d2) - sqrt(d1), sqrt(d1));
      }`,
    fragment: /* glsl */ `
  vec3 sNo = normalize(vNl), sUp = normalize(vUpO), sV = normalize(vViewO), sSunO = normalize(vSunO);
  float sGloss = vTint.a < 0.895 ? vTint.a : 0.0, sGlow = vTint.a >= 0.895 ? (vTint.a - 0.9) * 100.0 : 0.0;
  // what was worked out beforehand: the light of its own lamps, how much sky reaches the place, how deep in a corner it is
  vec3 sLamp = texture2D(tLamp, vLm).rgb; sLamp = sLamp * sLamp * LAMP_TOP;
  vec3 sBaked = texture2D(tSky, vLm).rgb;
  float sSky = sBaked.r * sBaked.r, sCorner = sBaked.g;
  if (uBaked < 0.5) {
    // (the ramp moves, so nothing is worked out for it: open, it lies under the sky; shut, it is one more wall of the room)
    sSky = mix(0.03, 0.55 + 0.45 * dot(sNo, sUp), uDoor); sLamp = vec3(1.0, 0.72, 0.42) * mix(0.22, 0.05, uDoor); sCorner = 1.0;
  }
  // how fast the surface turns here: an edge that sticks out, or a crease
  vec3 sDpx = dFdx(vRest), sDpy = dFdy(vRest);
  float sK = (dot(dFdx(vNl), sDpx) + dot(dFdy(vNl), sDpy)) / max(dot(sDpx, sDpx) + dot(sDpy, sDpy), 1e-10);
  float sEdge = smoothstep(24.0, 90.0, sK), sCrease = smoothstep(24.0, 90.0, -sK);

  vec2 g = vGrain; float kind = floor(vKind.x + 0.5), rnd = vKind.y;
  float sPx = max(max(fwidth(g.x), fwidth(g.y)), 1e-5);
  // (nothing is drawn finer than the picture can show: each pattern goes as its turns come within a few dots of each other)
  float fine = 1.0 - smoothstep(0.0009, 0.003, sPx), mid = 1.0 - smoothstep(0.006, 0.02, sPx), wov = 1.0 - smoothstep(0.0006, 0.0016, sPx);
  // (what is soft was shaped by hand, and its own sheet of places breaks from face to face: what is large on it is
  // laid by where the place is in the ship, which runs unbroken)
  bool sSoft = (kind > 5.5 && kind < 7.5) || (kind > 13.5 && kind < 14.5) || (kind > 17.5 && kind < 18.5) || (kind > 26.5 && kind < 27.5);
  vec2 gb = sSoft ? vRest.xz + vRest.y * vec2(0.71, 0.43) : g;
  float blotch = sF2(gb * 2.3 + rnd * 40.0), blotchB = sF2(gb * 5.1 + rnd * 71.0 + 19.0);
  float streak = sF2(vec2(g.x * 1.6, g.y * 26.0) + rnd * 17.0), speck = mix(0.5, sN2(g * 240.0 + 3.0), fine);
  float wear = sEdge * smoothstep(0.2, 0.62, sN2(g * vec2(38.0, 150.0) + rnd * 3.0) + 0.25 * sEdge);
  // the brush: everything is laid on in dabs, long ones along the grain of wood, short ones on the rest
  bool sWoody = kind < 2.5 || (kind > 12.5 && kind < 13.5);
  vec3 dab = sDab(gb * (sWoody ? vec2(6.0, 30.0) : vec2(21.0, 21.0)) + rnd * 31.0);
  // (outside, seen whole and from a way off, the dabs made the boards busy: there they are all but gone, and the
  // boards are left to their grain, their paint and the weather)
  float dabK = mix(0.14, sWoody ? 0.55 : 1.0, uInner);
  float dabTone = (dab.x - 0.5) * mid * dabK, dabEdge = (1.0 - smoothstep(0.0, 0.16, dab.y)) * mid * dabK;
  // scratches: long thin marks this way and that
  vec2 sG2 = vec2(g.x * 0.8 + g.y * 0.6, g.y * 0.8 - g.x * 0.6);
  float scratch = (smoothstep(0.8, 0.86, sN2(vec2(g.x * 9.0, g.y * 420.0) + rnd * 5.0)) * smoothstep(0.45, 0.7, sN2(g * 6.0 + rnd * 3.0))
    + smoothstep(0.82, 0.88, sN2(vec2(sG2.x * 7.0, sG2.y * 380.0) + rnd * 9.0)) * smoothstep(0.5, 0.75, sN2(sG2 * 5.0 + 4.0))) * fine;
  // dirt: it gathers where two things meet, and under whatever it can run down from
  float dirt = smoothstep(0.86, 0.3, sCorner + (blotchB - 0.5) * 0.5) * (kind < 19.5 ? 1.0 : 0.0);
  vec3 sAlb = vTint.rgb, sEmit = vec3(0.0);
  // (how it rises and falls: h in the large, hm by the finger's width, hf by the hair's)
  float h = 0.0, hm = 0.0, hf = 0.0, metal = 0.0, shine = sGloss, sPow = 40.0, fuzz = 0.0, tilt = 0.05;

  if (kind < 0.5) {
    // ---- paint on something: brushed on, rubbed through to what is under it along edges
    sAlb *= 0.84 + 0.22 * blotch + 0.3 * dabTone;
    sAlb *= 1.0 - 0.04 * dabEdge;
    sAlb = mix(sAlb, sAlb * 0.4 + vec3(0.03, 0.025, 0.02), max(wear, smoothstep(0.76, 0.8, sF2(g * 23.0 + rnd * 19.0)) * mid) * 0.8);
    sAlb *= 1.0 - 0.3 * scratch;
    hm = dabEdge * -2.0; h = sF2(g * 12.0 + rnd * 3.0) * 8.0; shine = max(shine, 0.08); sPow = 30.0;
  } else if (sWoody) {
    // ---- wood: bare, or under paint (and paint in warning stripes)
    float warp = sF2(vec2(g.x * 0.9, g.y * 9.0) + rnd * 23.0);
    float rings = 0.5 + 0.5 * sin(g.y * 150.0 + warp * 26.0 + rnd * 50.0); rings = mix(0.5, rings, mid);
    float vein = smoothstep(0.62, 0.98, rings) * mid;
    float fibre = mix(0.5, sN2(vec2(g.x * 14.0, g.y * 620.0) + rnd * 9.0), fine);
    vec2 kc = vec2(g.x * 0.7, g.y * 6.5) + rnd * 13.0, kf = fract(kc) - 0.5;
    float kd = length(kf * vec2(1.0, 0.42));
    float knot = step(0.8, sH(floor(kc))) * (1.0 - smoothstep(0.0, 0.2, kd)) * mid;
    float kring = step(0.8, sH(floor(kc))) * (0.5 + 0.5 * sin(kd * 150.0)) * (1.0 - smoothstep(0.1, 0.34, kd)) * mid;
    // (the saw's marks across it, and where it has split along its length)
    float saw = smoothstep(0.7, 1.0, sN2(vec2(g.x * 210.0 + rnd * 40.0, g.y * 4.0))) * fine * step(0.6, sH(vec2(rnd * 13.0, 5.0)));
    float split = smoothstep(0.93, 0.955, sN2(vec2(g.x * 1.7 + rnd * 9.0, g.y * 95.0))) * smoothstep(0.55, 0.75, sN2(vec2(g.x * 4.0, g.y * 3.0) + rnd * 2.0)) * mid;
    if (kind < 1.5) {
      sAlb *= 0.74 + 0.34 * streak + 0.42 * dabTone + 0.1 * (fibre - 0.5);
      sAlb *= 1.0 - 0.46 * vein;
      sAlb *= 1.0 - 0.07 * saw - 0.25 * kring;
      sAlb = mix(sAlb, sAlb * vec3(0.36, 0.28, 0.24), knot * 0.85);
      sAlb = mix(sAlb, sAlb * 0.22, split * 0.85);
      sAlb = mix(sAlb, sAlb * 1.75 + 0.04, clamp(sEdge * 0.6 + wear * 0.5, 0.0, 1.0));
      sAlb *= 1.0 - 0.4 * sCrease;
      hm = 2.6 * rings - 6.0 * knot - 5.0 * split; hf = 0.5 * fibre - 0.5 * saw; shine = 0.16; sPow = 16.0; tilt = 0.1;
    } else {
      if (kind > 12.5) {
        float band = smoothstep(0.47, 0.53, abs(fract((g.x + g.y) * 13.0) - 0.5) * 2.0);
        sAlb = mix(vec3(0.5, 0.075, 0.045), vec3(0.72, 0.66, 0.52), band);
      }
      // the brush went along the board: its hairs left streaks, and each load of paint a tone of its own
      float hairs = sF2(vec2(g.x * 3.0, g.y * 110.0) + rnd * 5.0);
      sAlb *= 0.78 + 0.2 * streak + 0.2 * hairs + 0.34 * dabTone;
      sAlb *= 1.0 - 0.14 * vein - 0.1 * dabEdge;
      sAlb = mix(sAlb, sAlb * 1.3 + 0.02, sEdge * 0.4);
      // (the paint is gone from the edges, in flecks, in the tracks of knots, and low down where boots and weather reach)
      float low = uInner > 0.5 ? smoothstep(1.75, 1.1, vRest.y) * 0.16 : smoothstep(2.1, 0.95, vRest.y) * 0.2;
      float peel = sF2(g * vec2(6.0, 30.0) + rnd * 5.0) * (0.74 + 0.55 * sEdge) + low + knot * 0.3;
      float fleck = smoothstep(0.69, 0.73, peel) * mid;
      float bare = max(max(wear, fleck), split);
      // (and it lifts a little round every place it has gone: a darker line)
      sAlb *= 1.0 - 0.3 * (smoothstep(0.63, 0.69, peel) - fleck) * mid;
      sAlb = mix(sAlb, vec3(0.21, 0.13, 0.085) * (0.6 + 0.7 * rings) * (1.0 - 0.5 * vein), bare * 0.9);
      sAlb *= 1.0 - 0.35 * sCrease;
      hm = 1.2 * rings + 0.8 * hairs - bare * 5.0 - 3.0 * knot - dabEdge * 3.0; shine = 0.12; sPow = 24.0; tilt = 0.09;
    }
  } else if (kind < 3.5) {
    // ---- copper: beaten out by hand, brown where it is old, green where the wet sits, bright where it is rubbed
    float ham = dab.z;
    sAlb *= 0.72 + 0.3 * blotch + 0.34 * dabTone;
    sAlb = mix(sAlb, sAlb * vec3(0.5, 0.36, 0.3), smoothstep(0.4, 0.75, blotchB) * 0.6);
    float run = sF2(vec2(g.x * 30.0, g.y * 2.4) + rnd * 4.0);
    float verd = smoothstep(0.5, 0.9, (1.0 - sCorner) * 1.3 + blotchB * 0.6 + sCrease * 0.6 + (uInner < 0.5 ? run * 0.42 : 0.0) - 0.06);
    sAlb = mix(sAlb, vec3(0.11, 0.3, 0.24) * (0.7 + 0.6 * speck), verd * 0.78);
    sAlb = mix(sAlb, sAlb * 1.5 + vec3(0.05, 0.025, 0.006), max(wear, scratch * 0.7) * (1.0 - verd));
    sAlb = mix(vec3(dot(sAlb, vec3(0.333))), sAlb, 0.76) * 0.92;
    metal = 1.0 - verd * 0.85; shine = 0.6 * metal + 0.04; hm = -smoothstep(0.0, 0.5, ham) * 6.0 - verd * 2.0; h = sF2(g * 8.0 + rnd * 4.0) * 10.0; sPow = 30.0; tilt = 0.07;
  } else if (kind < 4.5) {
    // ---- brass: dull in its recesses, rubbed bright on its edges, scratched where things have been set down
    sAlb *= 0.76 + 0.26 * blotch + 0.34 * dabTone;
    // (handled brass is bright; left alone it browns in patches)
    sAlb = mix(sAlb, sAlb * vec3(0.52, 0.44, 0.36), smoothstep(0.42, 0.68, blotch + 0.4 * (blotchB - 0.5)) * 0.55);
    float tarn = smoothstep(0.3, 0.9, (1.0 - sCorner) * 1.4 + blotchB * 0.6 + sCrease * 0.7);
    sAlb = mix(sAlb, sAlb * vec3(0.36, 0.3, 0.25), tarn * 0.85);
    sAlb = mix(sAlb, vec3(0.16, 0.26, 0.2), smoothstep(0.72, 0.86, blotch * (1.0 - sCorner) * 2.4) * 0.5);
    sAlb = mix(sAlb, sAlb * 1.3 + vec3(0.06, 0.05, 0.02), max(wear, scratch * 0.8));
    sAlb = mix(vec3(dot(sAlb, vec3(0.333))), sAlb, 0.78);
    metal = 1.0; shine = 0.74 - 0.46 * tarn; hm = (streak - 0.5) * 1.5; hf = -scratch * 3.0; h = sF2(g * 10.0 + rnd * 6.0) * 5.0; sPow = 60.0; tilt = 0.04;
  } else if (kind < 5.5 || (kind > 14.5 && kind < 15.5)) {
    // ---- iron, cast and pitted, rusting from its edges; and bright steel, drawn fine along its length
    bool bright = kind > 14.5;
    float pit = smoothstep(0.62, 0.8, sN2(g * 150.0 + rnd * 7.0)) * fine;
    sAlb *= 0.78 + 0.26 * streak + 0.26 * dabTone;
    float rust = bright ? smoothstep(0.78, 0.9, sF2(g * 14.0 + rnd * 3.0) + 0.3 * (1.0 - sCorner)) * 0.6 * mid
      : smoothstep(0.56, 0.78, sF2(g * 9.0 + rnd * 3.0) * (0.72 + 0.5 * sEdge + 0.5 * (1.0 - sCorner))) * mid;
    sAlb = mix(sAlb, vec3(0.2, 0.085, 0.04) * (0.6 + 0.8 * speck), rust * 0.8);
    sAlb = mix(sAlb, bright ? sAlb * 1.35 : vec3(0.3, 0.31, 0.34), max(wear * 0.7, scratch * 0.6) * (1.0 - rust));
    sAlb *= 1.0 - 0.3 * pit * (bright ? 0.3 : 1.0);
    float drawn = sN2(vec2(g.x * 6.0, g.y * 900.0) + rnd * 3.0);
    metal = bright ? 1.0 : 0.7; shine = bright ? 0.62 : 0.36 * (1.0 - rust); hf = bright ? drawn * 0.6 : -pit * 2.5; hm = (bright ? 0.0 : streak * 1.2) - rust * 1.6; h = sF2(g * 9.0 + rnd * 8.0) * (bright ? 3.0 : 9.0); sPow = bright ? 70.0 : 28.0; tilt = 0.05;
  } else if (kind < 6.5 || (kind > 17.5 && kind < 18.5)) {
    // ---- cloth, and canvas: woven, faded where it folds, stained, and patched where it tore
    bool coarse = kind > 17.5;
    float pitch = coarse ? 520.0 : 1100.0;
    float warpT = sin(g.x * pitch), weftT = sin(g.y * pitch), weave = warpT * weftT;
    float slub = sN2(vec2(g.x * 4.0, g.y * pitch * 0.16) + rnd * 3.0);
    float fold = sF2(vec2(gb.x * 5.0, gb.y * 13.0) + rnd * 11.0);
    sAlb *= 0.76 + 0.24 * blotch + (coarse ? 0.2 : 0.12) * weave * (coarse ? fine : wov) + 0.16 * (slub - 0.5) * fine + 0.44 * (fold - 0.5) + 0.2 * dabTone;
    float stainN = sF2(gb * 6.5 + rnd * 23.0), stain = smoothstep(0.62, 0.7, stainN);
    sAlb *= 1.0 - (coarse ? 0.24 : 0.14) * stain + 0.06 * smoothstep(0.6, 0.64, stainN) * (1.0 - stain);
    if (coarse) {
      // (a patch: a square of other cloth, sewn on with big stitches)
      vec2 pc = gb * 3.2 + rnd * 17.0, pf = fract(pc) - 0.5; float pid = sH(floor(pc) + 3.0);
      float box = max(abs(pf.x), abs(pf.y) * 1.3), on = step(0.72, pid) * (1.0 - smoothstep(0.26, 0.27, box)) * mid;
      sAlb = mix(sAlb, sAlb * (0.7 + 0.5 * sH(floor(pc) + 9.0)) * vec3(1.0, 0.94, 0.86), on);
      float sew = step(0.72, pid) * (1.0 - smoothstep(0.012, 0.02, abs(box - 0.235))) * step(0.5, fract((abs(pf.x) > abs(pf.y) * 1.3 ? pf.y : pf.x) * 26.0)) * fine;
      sAlb = mix(sAlb, vec3(0.86, 0.8, 0.66), sew * 0.9);
      hm += on * 3.0 + sew * 4.0;
    }
    sAlb = mix(sAlb, sAlb * 1.25, wear * 0.4);
    hf += weave * (coarse ? 1.4 : 0.6); h += fold * 30.0; shine = 0.0; fuzz = coarse ? 0.35 : 0.5; tilt = 0.03;
  } else if (kind < 7.5) {
    // ---- leather: creased, pored, polished by use on every edge, scuffed pale in the middle
    float pore = sN2(g * 520.0), crease = smoothstep(0.0, 0.34, abs(sF2(gb * 22.0 + rnd * 11.0) - 0.5) * 2.0);
    float crack = 0.0;
    sAlb *= (0.76 + 0.24 * blotch + 0.08 * (pore - 0.5) * fine + 0.22 * dabTone) * (0.86 + 0.14 * crease);
    sAlb *= 1.0 - 0.16 * crack * mid;
    sAlb = mix(sAlb, sAlb * 1.6 + 0.03, max(wear * 0.8, smoothstep(0.6, 0.8, blotchB) * 0.35));
    sAlb *= 1.0 - 0.2 * scratch;
    hm = crease * 0.7; hf = pore * 0.5; h = sF2(gb * 9.0 + rnd) * 12.0; shine = 0.24; sPow = 20.0; tilt = 0.04;
  } else if (kind < 8.5) {
    // ---- rope
    float tw = 0.5 + 0.5 * sin(g.x * 320.0 + g.y * 500.0); tw = mix(0.5, tw, fine);
    float fray = sN2(vec2(g.x * 60.0, g.y * 400.0));
    sAlb *= 0.62 + 0.46 * tw + 0.16 * (blotch - 0.5) + 0.12 * (fray - 0.5) * fine; hm = tw * 3.0; shine = 0.0; fuzz = 0.5;
  } else if (kind < 9.5) {
    // ---- paper: fibres, the brown spots of age, a fold, a ring where a mug stood
    float fib = sN2(vec2(g.x * 70.0, g.y * 400.0) + rnd * 3.0);
    sAlb *= 0.88 + 0.12 * blotch + 0.06 * (fib - 0.5) * fine;
    sAlb = mix(sAlb, sAlb * vec3(0.78, 0.6, 0.42), smoothstep(0.66, 0.8, sF2(g * 31.0 + rnd * 9.0)) * 0.6 * mid);
    sAlb *= 1.0 - 0.1 * smoothstep(0.985, 1.0, sin(g.x * 21.0 + rnd * 6.0)) * mid;
    hf = fib * 0.3; tilt = 0.02;
  } else if (kind < 10.5 || (kind > 15.5 && kind < 16.5)) {
    // ---- painted metal: knocked, chipped at its edges, rusting from every chip, grimy in its corners; and glazed ware
    bool glaze = kind > 15.5;
    sAlb *= 0.86 + 0.14 * blotch + (glaze ? 0.08 : 0.26) * dabTone;
    float chip = glaze ? 0.0 : max(wear, smoothstep(0.73, 0.77, sF2(g * 26.0 + rnd * 19.0) * (0.8 + 0.45 * sEdge)) * mid);
    float knock = sF2(g * 15.0 + rnd * 31.0) + (uInner > 0.5 ? -0.08 : -0.02);
    float scab = glaze ? 0.0 : smoothstep(0.7, 0.73, knock) * mid;
    // (rust runs down from where it starts)
    float runs = glaze ? 0.0 : smoothstep(0.6, 0.8, sF2(vec2(g.x * 34.0, g.y * 2.6) + rnd * 8.0)) * smoothstep(0.5, 0.66, knock);
    sAlb = mix(sAlb, sAlb * vec3(0.7, 0.46, 0.3), max((glaze ? 0.0 : smoothstep(0.6, 0.7, knock)) * 0.6, runs * 0.5));
    chip = max(chip, scab);
    sAlb = mix(sAlb, vec3(0.05, 0.035, 0.03) + vec3(0.14, 0.055, 0.02) * speck, chip * 0.9);
    sAlb *= 1.0 - (glaze ? 0.1 : 0.3) * scratch;
    // (glazed ware crazes: a net of fine cracks)
    if (glaze) sAlb *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.04, dab.y)) * fine;
    shine = (glaze ? 0.55 : 0.3) * (1.0 - chip); sPow = glaze ? 90.0 : 50.0; hm = -chip * 5.0; h = sF2(g * 9.0 + rnd * 2.0) * (glaze ? 4.0 : 22.0); tilt = 0.04;
  } else if (kind < 11.5) {
    // ---- rubber: dull, scuffed grey, ribbed
    float rib = 0.5 + 0.5 * sin(g.y * 700.0);
    sAlb *= 0.8 + 0.2 * blotch + 0.1 * rib * fine; sAlb = mix(sAlb, sAlb * 1.6 + 0.04, max(sEdge * 0.5, smoothstep(0.62, 0.8, blotchB) * 0.5)); shine = 0.06; hf = rib * 1.2;
  } else if (kind < 12.5) {
    // (a lamp: it shines of itself, below)
    tilt = 0.0;
  } else if (kind < 14.5) {
    // ---- padding, stitched in diamonds: puffed between its seams, shiny where it has been leaned on
    vec2 qd = vec2(g.x + g.y, g.x - g.y) * 8.0, qf = abs(fract(qd) - 0.5);
    float seam = min(qf.x, qf.y) * 2.0, puff = smoothstep(0.0, 0.55, seam);
    float wv = sin(g.x * 1100.0) * sin(g.y * 1100.0);
    sAlb *= (0.6 + 0.46 * puff) * (0.8 + 0.26 * blotch + 0.1 * wv * wov + 0.2 * dabTone);
    float thread = (1.0 - smoothstep(0.03, 0.07, seam)) * step(0.5, fract((qd.x - qd.y) * 5.0)) * fine;
    sAlb = mix(sAlb, sAlb * 1.7 + 0.04, thread * 0.75);
    sAlb *= 1.0 - 0.2 * smoothstep(0.6, 0.72, sF2(gb * 7.0 + rnd * 5.0));
    hm = puff * 9.0 + sF2(gb * 30.0) * 5.0; h = sF2(gb * 6.0 + rnd * 3.0) * 16.0; shine = 0.07; fuzz = 0.3; tilt = 0.03;
  } else if (kind < 17.5) {
    // ---- soot, where fire has been
    sAlb *= 0.5 + 0.55 * blotch + 0.3 * dabTone; shine = 0.03; hf = speck;
  } else if (kind < 19.5) {
    // ---- bottle glass: dark, with the lamp and the window caught in it, dusty on its shoulders
    sAlb *= 0.42 + 0.14 * blotch;
    sAlb = mix(sAlb, vec3(0.42, 0.4, 0.36), smoothstep(0.3, 0.9, sNo.y) * 0.3 * (0.6 + 0.8 * blotchB));
    sAlb *= 1.0 - 0.2 * scratch;
    shine = 0.95; sPow = 140.0; fuzz = 1.2; tilt = 0.0; h = sF2(g * 9.0 + rnd) * 1.2;
  } else if (kind < 26.0) {
    // ---- a bead of the push glass. Each arm is a thruster, and the one that lights is the one that is burning: the
    // one under the ship to go up, the left one to go right, the near one to go ahead. Its beads light one after
    // another out to the bell as it burns harder, and whiter the harder it burns
    int ax = int(kind) - 20;
    float amt = ax == 0 ? -uThrust.x : ax == 1 ? uThrust.x : ax == 2 ? -uThrust.y : ax == 3 ? uThrust.y : ax == 4 ? uThrust.z : -uThrust.z;
    // (the flame at the bell's mouth has the least to wait for, the bead by the hub the most; nothing is lit by no burn)
    float lit = smoothstep(max(rnd - 0.1, 0.012), max(rnd - 0.02, 0.07), amt);
    vec3 hot = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.78, 0.42), smoothstep(0.5, 1.0, amt));
    sAlb = mix(vec3(0.16, 0.07, 0.03), hot, lit);
    sEmit = mix(vec3(0.05, 0.016, 0.006), hot * (4.0 + 5.0 * amt), lit); shine = 0.6; sPow = 90.0; tilt = 0.0;
  } else if (kind < 26.5) {
    // ---- wicker: canes over and under
    vec2 wc = g * vec2(46.0, 110.0); float col = floor(wc.x), over = mod(col + floor(wc.y), 2.0);
    float cane = sin(fract(wc.y) * 3.1416), stake = sin(fract(wc.x) * 3.1416);
    float up2 = mix(cane * (0.55 + 0.45 * stake), cane, over);
    sAlb *= (0.5 + 0.6 * up2 * mix(1.0, 0.75, 1.0 - over)) * (0.86 + 0.28 * sH(vec2(floor(wc.y), col * 0.37 + rnd)));
    sAlb = mix(sAlb, sAlb * 0.4, (1.0 - smoothstep(0.0, 0.25, cane)) * mid);
    hm = up2 * 5.0; shine = 0.12; sPow = 18.0; tilt = 0.03;
  } else if (kind < 27.5) {
    // ---- knitting: rows of stitches, in bands of this colour and that
    vec2 kn = g * vec2(170.0, 130.0); float row = floor(kn.y);
    float vee = abs(fract(kn.x + 0.5 * mod(row, 2.0)) - 0.5) * 2.0, st = smoothstep(0.0, 0.5, abs(fract(kn.y) - 0.5 - (vee - 0.5) * 0.5) * 2.0);
    float bandN = floor(g.y * 11.0 + rnd * 9.0), bandC = sH(vec2(bandN, rnd * 7.0));
    vec3 other = bandC < 0.34 ? vec3(0.78, 0.72, 0.6) : bandC < 0.5 ? sAlb.gbr * 0.8 + 0.08 : sAlb;
    sAlb = mix(sAlb, other, step(0.5, fract(g.y * 11.0 + rnd * 9.0)) * 0.9);
    sAlb *= (0.6 + 0.44 * mix(1.0, st, fine)) * (0.88 + 0.2 * blotch);
    hf = st * 3.0; h = sF2(gb * 18.0) * 14.0; shine = 0.0; fuzz = 0.75; tilt = 0.03;
  } else if (kind < 28.5) {
    // ---- tinplate: bright once, dented, ribbed, rusting at its seams
    float ribs = pow(0.5 + 0.5 * sin(g.y * 260.0), 6.0);
    sAlb *= 0.8 + 0.2 * blotch + 0.24 * dabTone;
    float rust = smoothstep(0.6, 0.8, sF2(g * 16.0 + rnd * 3.0) * (0.7 + 0.6 * sEdge + 0.6 * (1.0 - sCorner))) * mid;
    sAlb = mix(sAlb, vec3(0.24, 0.1, 0.045) * (0.6 + 0.8 * speck), rust * 0.75);
    sAlb = mix(sAlb, sAlb * 1.3, max(wear, scratch) * (1.0 - rust));
    metal = 0.85 * (1.0 - rust); shine = 0.5 * (1.0 - rust); sPow = 46.0; hm = ribs * 3.0 - rust * 2.0; h = sF2(g * 11.0 + rnd * 5.0) * 26.0; tilt = 0.05;
  } else if (kind < 38.0) {
    // ---- a small lamp that says something: dark glass until it is so
    float lit = uLit[int(kind) - 30];
    sEmit = vTint.rgb * mix(0.035, 5.0, lit); sAlb *= 0.35; shine = 0.6; sPow = 90.0; tilt = 0.0;
  } else if (kind < 40.5) {
    // ---- something printed: a label, a card, a chart
    vec4 pr = texture2D(tPrint, g); sAlb = vTint.rgb * pr.rgb; shine = 0.04 + 0.5 * pr.a * sGloss * 0.0; tilt = 0.0;
  } else {
    // ---- a dial, lit from behind
    vec3 pr = texture2D(tDial, g).rgb; sAlb = pr * 0.8; sEmit = pr * pr * uBack; shine = 0.35; sPow = 80.0; tilt = 0.0;
  }

  if (kind < 19.5) {
    // dirt, in every corner; and a fine dust on whatever faces up in the room
    sAlb = mix(sAlb, sAlb * vec3(0.4, 0.34, 0.29), dirt * 0.62);
    // the boards of the floor are trodden pale from the door to the seat
    if (uInner > 0.5 && sNo.y > 0.8 && abs(vRest.y - 1.05) < 0.04) {
      float way = (1.0 - smoothstep(0.22, 0.62, abs(vRest.x + 0.12 * sin(vRest.z * 2.1)))) * smoothstep(-1.0, -0.2, vRest.z) * (0.5 + 0.7 * blotchB);
      sAlb = mix(sAlb, sAlb * 1.22 + vec3(0.03, 0.025, 0.02), way * 0.6);
      sAlb *= 1.0 - 0.25 * smoothstep(0.7, 0.76, sF2(vRest.xz * 9.0)) * way;
    }
  }
  // weather: what stands outside is streaked where the rain has run down it, bleached above and grimed below
  if (uInner < 0.5 && kind < 19.5) {
    float around = atan(vRest.x, vRest.z);
    float drip = sF2(vec2(around * 16.0, vRest.y * 0.8) + 5.0), grime = sF2(vRest.xz * 1.7 + vRest.y * 2.3);
    float runnel = smoothstep(0.55, 0.8, sF2(vec2(around * 70.0, vRest.y * 1.6) + 9.0)) * smoothstep(0.35, 0.7, sF2(vec2(around * 9.0, vRest.y * 3.0)));
    sAlb *= (0.7 + 0.42 * drip) * (0.84 + 0.24 * grime) * mix(0.78, 1.06, smoothstep(0.8, 3.6, vRest.y));
    sAlb = mix(sAlb, sAlb * vec3(0.5, 0.44, 0.38), runnel * 0.55);
    // (and splashed with mud as high as the legs kick it)
    sAlb = mix(sAlb, vec3(0.16, 0.12, 0.08) * (0.7 + 0.6 * speck), smoothstep(1.5, 0.3, vRest.y + 0.9 * sF2(vec2(around * 22.0, vRest.y * 5.0))) * 0.6);
  }
  // an edge is drawn a little lighter, a crease a little darker, as someone painting it would
  sAlb *= 1.0 + 0.22 * sEdge * (kind < 38.0 ? 1.0 : 0.0);

  // the small ups and downs of it turn its face a little, to the sun and to the lamps; and no two pieces sit quite square
  h += hf * (1.0 - smoothstep(0.0004, 0.0011, sPx)) + hm * (1.0 - smoothstep(0.0016, 0.005, sPx));
  float sHx = dFdx(h), sHy = dFdy(h);
  vec3 sR1 = cross(sDpy, sNo), sR2 = cross(sNo, sDpx); float sDet = dot(sDpx, sR1);
  vec3 sLean = (vec3(sH(vec2(rnd * 91.0, 1.3)), sH(vec2(rnd * 57.0, 2.7)), sH(vec2(rnd * 33.0, 4.1))) - 0.5) * 2.0 * tilt;
  vec3 sBump = (sHx * sR1 + sHy * sR2) * (sign(sDet) / max(abs(sDet), 1e-10)) * 0.0007;
  sBump *= min(1.0, 0.55 / max(length(sBump), 1e-5));
  vec3 sN = normalize(sNo + sLean - sBump);
  if (sN != sN) sN = sNo;
  // corners gather dark, and a little colder
  sAlb *= mix(vec3(0.42, 0.4, 0.5), vec3(1.0), smoothstep(0.05, 0.9, sCorner));

  // (the brush shows in the light too: where light gives way to shade the edge is broken, not ruled)
  float sFace = dot(sN, sSunO) + dabTone * 0.24, sL = smoothstep(0.05, 0.45, sFace) * outgoingLight.g;
  vec3 sSun = sunlight(vWorld) * uSunK, sAround = skylight(vWorld) * uSkyK + uFill;
  // (the light worked out beforehand has no direction left in it: it is given back the one it mostly had)
  vec3 sToLamp = normalize(vec3(0.0, 3.5, 0.0) - vRest), sToSky = normalize(mix(sUp, normalize(vec3(0.0, 2.6, -2.5) - vRest), uInner));
  float sLampLum = dot(sLamp, vec3(0.3, 0.5, 0.2)) * uLamps;
  float sDl = clamp((dot(sN, sToLamp) - dot(sNo, sToLamp)) * 2.2, -0.7, 1.0), sDs = clamp((dot(sN, sToSky) - dot(sNo, sToSky)) * 2.2, -0.7, 1.0);
  vec3 sDiff = sSun * sL + sAround * sSky * (1.0 + sDs) + sLamp * uLamps * (1.0 + sDl);
  vec3 sC = sAlb * sDiff * (1.0 - 0.45 * metal);
  // (the ground gives some of the sun back to what stands over it)
  sC += sAlb * sSun * uBounce * max(-dot(sNo, sUp), 0.0) * sSky * 1.4;
  // what it shows of what is round it: metal, mostly
  vec3 sR = reflect(-sV, sN);
  float sFres = pow(1.0 - max(dot(sN, sV), 0.0), 3.0);
  vec3 sEnv = (sLamp * uLamps * 0.9 + sAround * sSky) * (0.3 + 0.7 * smoothstep(-0.35, 0.8, dot(sR, mix(sUp, sToLamp, uInner * 0.7))));
  sC += sAlb * sEnv * metal * 0.6;
  // the sun caught on it, the lantern caught on it, the sky along its edges
  vec3 sHs = normalize(sSunO + sV), sHl = normalize(sToLamp + sV);
  sC += sSun * outgoingLight.g * pow(max(dot(sN, sHs), 0.0), sPow) * shine * 0.9 * step(0.0, sFace) * mix(vec3(1.0), sAlb * 2.0, metal * 0.7);
  sC += vec3(1.0, 0.74, 0.46) * min(sLampLum, 1.2) * pow(max(dot(sN, sHl), 0.0), sPow * 1.4) * shine * 1.5 * mix(vec3(1.0), sAlb * 2.2, metal * 0.7);
  sC += (sAround * sSky + sLamp * uLamps * 0.35) * sFres * (shine * 0.7 + fuzz * 0.25);
  // what shines of itself
  sC += vTint.rgb * sGlow * 3.4 * uLamps + sEmit;
  gl_FragColor = vec4(sC, 1.0);`.replace('LAMP_TOP', LAMP_TOP.toFixed(2)),
  });
}
/** The brightest light of its lamps the pictures can hold (tools/ship/build.py has the same number). */
const LAMP_TOP = 4;

/**
 * The ship as it stands in one world: that world's light on it. kit: what loadShip gave. shared: the numbers every
 * part of it shares { uLamps, uSkyK, uDoor, uFill }. faces: { name: material } for the glasses on the pilot's desk.
 * Returns { group, ramp, stick, lift, push } (the last three: the stick and the two levers, to be leaned).
 */
export function shipIn(air, kit, shared, faces, glass) {
  const group = new THREE.Group(), P = kit.parts;
  const piece = (name, material) => {
    const src = P[name], m = new THREE.Mesh(src.geometry, material);
    m.position.copy(src.position); m.quaternion.copy(src.quaternion);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  piece('hull', shipPaint(air, kit.maps.hull[0], kit.maps.hull[1], shared, 1, 0));
  piece('room', shipPaint(air, kit.maps.room[0], kit.maps.room[1], shared));
  const ramp = piece('ramp', shipPaint(air, kit.maps.room[0], kit.maps.room[1], shared, 0));
  // (what the pilot's hands are on: they move as the ship is flown)
  const room = shipPaint(air, kit.maps.room[0], kit.maps.room[1], shared);
  const stick = P.stick ? piece('stick', room) : null, lift = P.lever_lift ? piece('lever_lift', room) : null, push = P.lever_push ? piece('lever_push', room) : null;
  // (the suit on its stand, and its helmet: not there while they are being worn)
  const suit = P.suit ? piece('suit', room) : null;
  // (the landing glass: hung from its hinge, with its picture; laid on the desk until it is wanted)
  let screen = null;
  if (P.screen && P.pivot_screen) {
    screen = new THREE.Group(); screen.position.copy(P.pivot_screen.position); group.add(screen);
    const m = piece('screen', room); m.position.set(0, 0, 0); screen.add(m);
  }
  const g = piece('glass', glass);
  // (where each place on the glass is in the ship's own measure: the piece is kept in a measure of its own)
  g.updateMatrixWorld(true);
  g.traverse((o) => { if (o.isMesh) glass.uniforms.uToShip.value.copy(o.matrixWorld); });
  g.castShadow = g.receiveShadow = false; g.renderOrder = 2;
  for (const name of Object.keys(faces)) {
    const f = piece(name, faces[name]); f.castShadow = f.receiveShadow = false;
    if (name === 'face_main' && screen) { f.position.copy(screen.position).negate(); screen.add(f); }
  }
  // (seen by the eye that looks at the worlds, and by the one that looks only at what is within arm's reach)
  // (and layer 2 is all of it that is solid: everything but the window glass)
  group.traverse((o) => { o.layers.enable(1); if (o.isMesh && o !== g) o.layers.enable(2); });
  group.visible = false;
  return { group, ramp, stick, lift, push, suit, screen };
}

/** Where the suit hangs, in the ship's own directions. */
export const SUIT = { x: 0.904, z: 1.94 };
/** What is seen of the helmet from inside it, under one world's light: a thing to be kept at the eye. Nothing, if the ship as built has none. */
export function shipVisor(air, kit, shared) {
  const src = kit.parts.visor;
  if (!src?.geometry) return null;
  // (the helmet's own rim is in the helmet's shade: little of the sun reaches it)
  const m = new THREE.Mesh(src.geometry, shipPaint(air, kit.maps.room[0], kit.maps.room[1], shared, 0, 1, 0.22));
  m.receiveShadow = true; m.frustumCulled = false;
  m.layers.enable(1); m.layers.enable(2);
  return m;
}

/** The window glass: all but clear seen square on, catching the sky at a slant. */
export function shipGlass() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uSheen: { value: new THREE.Color(0.2, 0.26, 0.34) }, uToShip: { value: new THREE.Matrix4() } },
    // (the window is round the ship, and its glass is lit as if it were one bent sheet, facing straight out from the
    // ship's middle all the way round: so where two flat panes meet there is nothing to see)
    vertexShader: /* glsl */ `uniform mat4 uToShip; varying vec3 vN; varying vec3 vV;
      void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vec3 s = (uToShip * vec4(position, 1.0)).xyz; vN = normalMatrix * normalize(vec3(s.x, 0.0, s.z)); vV = -p.xyz; gl_Position = projectionMatrix * p; }`,
    fragmentShader: /* glsl */ `uniform vec3 uSheen; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(uSheen, 0.04 + 0.4 * f); }`,
  });
}

/** How high the room's floor (or the ramp) is over the ship's feet, at a place in the ship's own directions. */
export function deckHeight(x, z) { return z <= DECK.hinge ? DECK.floor : Math.max(DECK.drop, DECK.floor - ((z - DECK.hinge) / DECK.run) * (DECK.floor - DECK.drop)); }
const SEAT_R = 0.56, STOVE = { x: -0.925, z: 1.6, r: 0.64 }, ROOM = 1.45, DOORWAY = 0.36;
/** Keeps someone aboard to where they can walk: the middle of the room, the way to the door, the ramp. p: { x, z } in the ship's directions, changed in place. open: whether the ramp is down. */
export function deckKeep(p, open) {
  if (p.z > 2.25 && Math.abs(p.x) < 0.6) {
    // the doorway and the ramp
    if (!open) p.z = Math.min(p.z, 2.25);
    else if (p.z < DECK.hinge + 0.5 || deckHeight(p.x, p.z) - DECK.drop > 0.42) p.x = THREE.MathUtils.clamp(p.x, -DOORWAY, DOORWAY);
    return;
  }
  const r = Math.hypot(p.x, p.z);
  // (toward the window the desk stands out into the room, with the stick and the levers before it)
  const reach = ROOM - 0.3 * THREE.MathUtils.smoothstep(-p.z, 0.2, 1.0);
  if (r > reach && !(p.z > 1.0 && Math.abs(p.x) < DOORWAY)) { p.x *= reach / r; p.z *= reach / r; }
  for (const c of [{ x: DECK.seat.x, z: DECK.seat.z, r: SEAT_R }, STOVE]) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    if (d < c.r && d > 1e-4) { p.x = c.x + (dx / d) * c.r; p.z = c.z + (dz / d) * c.r; }
  }
}
/** What someone outside walks round: the hull, the legs, the tanks. [x, z, r] in the ship's directions. */
export const OUTSIDE = [[0, 0, 2.62], [2.56, -2.56, 0.36], [-2.56, -2.56, 0.36], [2.56, 2.56, 0.36], [-2.56, 2.56, 0.36], [3.05, 0.5, 0.5], [3.05, -0.3, 0.5], [-3.05, 0.5, 0.5], [-3.05, -0.3, 0.5]];

export class Ship {
  constructor() {
    this.pos = V(0, 0, 0); this.vel = V(0, 0, 0); this.quat = new THREE.Quaternion();
    this.on = 'home'; this.landed = true; this.touching = true;
    this.head = { yaw: 0, pitch: 0 };
    this.alt = 0; this.speed = 0; this.push = 0; this.hard = 0; this.shake = 0;
    // for whoever is listening: how fast it has just met the ground (m/s; they set it back to 0), how fast it is being turned (rad/s)
    this.struck = 0; this.turning = 0;
    // how it is pushing, in its own directions, each as a part of all it can do
    this.thrust = V(0, 0, 0);
    // how hard each pair of thrusters has come to burn (side to side, up and down, along), as a part of all it can
    this.lev = V(0, 0, 0);
    // how far above the ground under its middle it comes to rest, standing on its four feet
    this.lift = 0;
  }

  /** Stands it on the ground of a world at a direction from that world's middle, its window toward `toward`. */
  park(name, land, dir, toward) {
    up.copy(dir).normalize();
    this.pos.copy(up).multiplyScalar(land.ground(up));
    t.copy(toward).addScaledVector(up, -toward.dot(up)).normalize();
    // (its own -Z is the way its window faces, its +Y is up)
    a.crossVectors(up, t.clone().negate()).normalize();
    this.quat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, up, t.clone().negate()));
    // (and then square to the ground under its four feet)
    for (let i = 0; i < 3; i++) {
      const r = this.stance(land, lean);
      a.set(-1, 0, 0).applyQuaternion(this.quat); a.addScaledVector(lean, -a.dot(lean)).normalize();
      this.quat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(a.clone().negate(), lean, a.clone().negate().cross(lean)));
      this.pos.setLength(r);
    }
    this.vel.set(0, 0, 0); this.on = name; this.landed = this.touching = true; this.alt = 0; this.speed = 0;
  }

  /**
   * How it would stand where it is: out, the upright square to the ground under its four feet (never far from
   * straight up); and, given back, how far from the world's middle its own middle then is.
   */
  stance(land, out) {
    for (let i = 0; i < 4; i++) {
      n.set(PADS[i][0], 0, PADS[i][1]).applyQuaternion(this.quat).add(this.pos).normalize();
      pad[i].copy(n).multiplyScalar(land.ground(n));
    }
    out.copy(pad[0]).sub(pad[2]).cross(n.copy(pad[1]).sub(pad[3])).normalize();
    mid.copy(this.pos).normalize();
    if (out.dot(mid) < 0) out.negate();
    const tilt = Math.acos(Math.min(1, out.dot(mid)));
    if (tilt > 0.24) out.lerp(mid, 1 - 0.24 / tilt).normalize();
    n.copy(pad[0]).add(pad[1]).add(pad[2]).add(pad[3]).multiplyScalar(0.25);
    return n.dot(out) / mid.dot(out);
  }

  /**
   * A step of flying. ctl: { move: {x, y}, look: {x, y}, up, down (0..1), roll, match, free (the look turns the
   * head, not the ship), fine (the pushes are as hard as they are asked for, not keys) }.
   * env: { land, colliders, body, turn (how fast its frame turns, rad/s), others: [{ body, at }] (other worlds:
   * where each one's middle is in this frame), swing (how the frame's own middle is being pulled, m/s²), pull(body, p, out) }.
   */
  update(dt, ctl, env) {
    const pushing = Math.abs(ctl.move.x) + Math.abs(ctl.move.y) > 0.01 || ctl.up || ctl.down;
    // --- turning: on the ground the head turns in the room; in flight the ship does ---
    this.turning += (((this.landed || ctl.free ? 0 : Math.abs(ctl.look.x) + Math.abs(ctl.look.y)) / Math.max(dt, 1e-3) + (this.landed ? 0 : Math.abs(ctl.roll || 0) * 1.3)) - this.turning) * Math.min(1, dt * 12);
    // (in flight the head can be turned too, while it is asked for: the ship keeps the way it was pointing)
    if (this.landed || ctl.free) {
      this.head.yaw = THREE.MathUtils.clamp(this.head.yaw - ctl.look.x, -2.2, 2.2);
      this.head.pitch = THREE.MathUtils.clamp(this.head.pitch - ctl.look.y, -0.9, 1.0);
    } else {
      const ease = Math.exp(-dt * 6);
      this.head.yaw *= ease; this.head.pitch *= ease;
      this.quat.multiply(q.setFromAxisAngle(Y, -ctl.look.x)).multiply(q.setFromAxisAngle(X, -ctl.look.y));
      if (ctl.roll) this.quat.multiply(q.setFromAxisAngle(Z, -ctl.roll * 1.3 * dt));
      this.quat.normalize();
    }
    if (this.landed && !(+ctl.up > 0.05)) { this.push = 0; this.speed = 0; this.thrust.set(0, 0, 0); this.lev.set(0, 0, 0); this.hard = Math.max(0, this.hard - dt * 2); return; }
    this.landed = false;

    // --- what it is asked to do ---
    // (a thruster lights at a little under half its burn and comes up to all of it in half a second: a tap is a
    // gentle push, a held key the whole of it. Let go, it is out in a moment)
    {
      const lev = this.lev;
      for (let i = 0; i < 3; i++) {
        const w = i === 0 ? ctl.move.x : i === 1 ? (+ctl.up || 0) - (+ctl.down || 0) : -ctl.move.y;
        let l = lev.getComponent(i);
        // (asked for by how far a trigger or a stick is pushed, it burns just that hard, and follows the hand)
        if (ctl.fine) { const d = w - l, most = dt / 0.07; l += Math.abs(d) <= most ? d : Math.sign(d) * most; }
        else if (Math.abs(w) < 0.01) l = Math.abs(l) <= dt / OUT ? 0 : l - (Math.sign(l) * dt) / OUT;
        else {
          if (l * w <= 0 || Math.abs(l) < START * Math.abs(w)) l = START * w;
          l += Math.sign(w) * dt * ((1 - START) / RISE);
          if (Math.abs(l) > Math.abs(w)) l = w;
        }
        lev.setComponent(i, l);
      }
      t.set(lev.x * PUSH, lev.y * LIFT, lev.z * PUSH).applyQuaternion(this.quat);
    }
    if (ctl.match && !pushing) {
      // hold still against the ground below: push against whatever speed there is, and against the fall
      up.copy(this.pos).normalize();
      env.pull(env.body, this.pos, a);
      t.copy(ctl.matchTo ?? n.set(0, 0, 0)).sub(this.vel).multiplyScalar(1 / Math.max(dt, 1 / 120)).sub(a);
      if (t.length() > LIFT) t.setLength(LIFT);
    }
    this.push = t.length() / LIFT;
    this.thrust.copy(t).applyQuaternion(q.copy(this.quat).invert()).divideScalar(LIFT);

    // --- going: in small steps, so the ground is never stepped through ---
    const steps = Math.max(1, Math.min(12, Math.ceil((this.vel.length() * dt) / 1.2))), h = dt / steps;
    let impact = 0;
    const touched = this.touching;
    this.touching = false;
    w.set(0, env.turn, 0);
    for (let i = 0; i < steps; i++) {
      env.pull(env.body, this.pos, a);
      for (const o of env.others) a.add(env.pull(o.body, n.copy(this.pos).sub(o.at), up));
      a.sub(env.swing);
      // (the sun, close to: it takes hold)
      if (env.sunPull) a.add(env.sunPull(this.pos, n));
      // (what a turning frame adds: the sideways push on whatever moves, and the outward one)
      a.addScaledVector(n.crossVectors(w, this.vel), -2);
      a.sub(n.crossVectors(w, up.crossVectors(w, this.pos)));
      a.add(t);
      this.vel.addScaledVector(a, h);
      this.pos.addScaledVector(this.vel, h);
      const r = this.pos.length();
      up.copy(this.pos).divideScalar(r);
      const ground = env.land.ground(up) + this.lift;
      if (r <= ground) {
        const vr = this.vel.dot(up);
        if (vr < 0) { impact = Math.max(impact, -vr); this.vel.addScaledVector(up, -vr); }
        this.pos.copy(up).multiplyScalar(ground);
        this.vel.multiplyScalar(Math.exp(-h * 5));
        this.touching = true;
      } else if (r <= ground + 0.06 && this.vel.dot(up) < 0.3) this.touching = true;
      // trunks and stones
      if (r - ground < 14) for (const c of env.colliders) {
        const along = this.pos.dot(c.dir);
        if (along < 0) continue;
        n.copy(this.pos).addScaledVector(c.dir, -along);
        const d = n.length(), min = c.r + DECK.wide;
        if (d < min && d > 1e-4) { n.divideScalar(d); this.pos.addScaledVector(n, min - d); const into = this.vel.dot(n); if (into < 0) this.vel.addScaledVector(n, -into); }
      }
    }
    const r = this.pos.length();
    up.copy(this.pos).divideScalar(r);
    const under = env.land.ground(up);
    this.alt = r - under - this.lift;
    // (close to the ground, where it will stand is found from where its feet will come down)
    const stand = this.alt < 8 ? this.stance(env.land, lean) : 0;
    this.lift = this.alt < 8 ? THREE.MathUtils.clamp(stand - under, -0.35, 0.7) : 0;
    this.speed = this.vel.length();
    if (impact > 7) this.hard = Math.min(1, impact / 22);
    if (impact > 0.5 && !touched) this.struck = impact;
    this.hard = Math.max(0, this.hard - dt * 1.6);

    // --- near the ground it rights itself, feet down; on the ground it stands ---
    const right = this.touching ? 9 : this.alt < 30 ? 2.4 * (1 - this.alt / 30) ** 2 : 0;
    if (right > 0) {
      a.copy(Y).applyQuaternion(this.quat);
      q.setFromUnitVectors(a, this.alt < 8 ? up.lerp(lean, THREE.MathUtils.smoothstep(this.alt, 6, 0.5)).normalize() : up);
      q2.copy(q).multiply(this.quat);
      this.quat.slerp(q2, 1 - Math.exp(-right * dt)).normalize();
    }
    if (this.touching && this.speed < 0.9 && !pushing) { this.landed = true; this.vel.set(0, 0, 0); this.speed = 0; this.push = 0; this.thrust.set(0, 0, 0); this.lev.set(0, 0, 0); }
    this.shake += dt * (18 + 30 * this.push);
  }

  /** Puts the eye in the seat. eye: where the pilot sits, in the ship own directions. lean: 0..1, how far they are leaning in to the glass they land by. */
  look(camera, eye, lean = 0) {
    q.setFromAxisAngle(Y, this.head.yaw).multiply(q2.setFromAxisAngle(X, this.head.pitch - 0.06 * lean));
    camera.quaternion.copy(this.quat).multiply(q);
    // (the engine can be felt: the seat trembles with it, and jolts when the ground is met too fast)
    const tremble = 0.004 * this.push + 0.05 * this.hard;
    a.set(eye.x + Math.sin(this.shake * 1.7) * tremble, eye.y + Math.sin(this.shake * 2.3) * tremble - 0.02 * lean, eye.z - 0.1 * lean).applyQuaternion(this.quat);
    camera.position.copy(this.pos).add(a);
  }
}
