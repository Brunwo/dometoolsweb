// Flowers in the meadow. PARKED (2026-11-17): not in the game. Tried and taken out again: against the grass thinning
// with distance they made that thinning show more. Kept to come back to; nothing brings this file in. (Since then
// the land's third number is no longer where flowers grow, but how much of a hollow a place is: see land.js.)
//
// They grow where the land says flowers grow (land.js: what the ground is, its third number), and in drifts, each
// drift mostly of one kind: white with a gold eye, buttercup, poppy, cornflower, pink. A flower is a thin stem and
// a head of a few petals, turned partly up and partly toward whoever is looking, so that it is never seen as a
// line. Like the grass they are not planted anywhere: each has a place in a square tile laid again and again round
// the eye (grass.js), and they move in the same wind. From far off, and from above, the ground itself is touched
// with the colour of the drift (world.js), so that a drift is seen before its flowers are.
import * as THREE from 'three';
import { shadowed } from './air.js';
import { FACES, onFace, rng } from './land.js';
import { PLACE, LEAN } from './grass.js';

/** count: how many to a tile; tile: its side, metres; fade: [from, to, raggedness, inner edge], metres from the eye. */
export function createFlowers(air, land, { count = 64000, tile = 32, fade = [22, 31, 7, -100], seed = 37 } = {}) {
  // a stem (a thin strip, foot to head) and a head (a square): where a corner is, and which of the two it is part of
  const pos = [-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0, -1, -1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1], index = [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6];
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  const R = rng(seed), seeds = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) seeds[i] = R();
  g.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4));
  g.instanceCount = count;
  const metre = 1 / (land.radius * Math.PI / 4), reach = fade[1] * metre * 1.35;
  const group = new THREE.Group(), sheets = [];
  for (let f = 0; f < 6; f++) {
    const own = {
      uTile: { value: tile * metre }, uFade: { value: new THREE.Vector4(...fade) },
      uFaceA: { value: FACES[f].A }, uFaceU: { value: FACES[f].U }, uFaceV: { value: FACES[f].V }, uFace: { value: f }, uEyeST: { value: new THREE.Vector2() },
    };
    const m = shadowed(air, {
      side: THREE.DoubleSide, key: 'flowers', taps: 6, alphaToCoverage: true,
      vertexPars: 'attribute vec4 seed; uniform float uTile; uniform vec4 uFade; uniform vec3 uFaceA; uniform vec3 uFaceU; uniform vec3 uFaceV; uniform float uFace; uniform vec2 uEyeST; varying vec3 vC; varying vec3 vHue; varying vec3 vAt; varying float vSeed;',
      vertex: PLACE + LEAN + /* glsl */ `
  // whether one grows here: where the land has flowers, in the drifts, and thinner toward a drift's edge
  float fThick = smoothstep(0.06, 0.45, gKind.b) * smoothstep(0.4, 0.62, gKind.a) * flowerDrift(gAt);
  // (never many: a flower to every few hands of grass where they are thickest, and one here and there elsewhere)
  float fGrown = step(seed.w, 0.004 + fThick * fThick * 0.13) * gKeep;
  float fH = (0.36 + 0.32 * seed.z) * (0.8 + 0.4 * aNoise3(gAt * 0.06 + 9.0)) * fGrown;
  vec2 fLean = gLean * 0.55 * fH;
  vec3 fHead = gAt + gE * fLean.x + gF * fLean.y + gUp * fH;
  vec3 fEye = cameraPosition - fHead; float fD = length(fEye);
  vec3 transformed;
  if (position.z < 0.5) {
    // the stem: a hair wide, turned to the eye, bending as it goes up
    float t = position.y;
    vec3 across = normalize(cross(gUp, fEye) + 1e-5);
    transformed = gAt + (gE * fLean.x + gF * fLean.y) * t * t + gUp * (fH * t) + across * position.x * 0.0035 * (1.0 + fD * 0.06) * step(0.001, fH);
  } else {
    // the head: its face turned partly to the sky and partly to the eye
    vec3 n = normalize(gUp * 0.6 + (fEye / fD) * 0.7), a1 = normalize(cross(n, gUp) + 1e-5), a2 = cross(n, a1);
    float r = (0.03 + 0.026 * seed.x) * (1.0 + fD * 0.03) * step(0.001, fH);
    transformed = fHead + (a1 * position.x + a2 * position.y) * r;
  }
  // (its colour: the drift's, and a little its own)
  vHue = flowerHue(gAt, seed.y) * (0.85 + 0.3 * seed.x);
  vC = position; vAt = transformed; vSeed = seed.x;`,
      fragmentPars: 'varying vec3 vC; varying vec3 vHue; varying vec3 vAt; varying float vSeed;',
      fragment: /* glsl */ `
  vec3 fAlb; float fA = 1.0;
  if (vC.z < 0.5) fAlb = uG4 * 0.55;
  else {
    // five to seven petals round an eye
    float r = length(vC.xy), ang = atan(vC.y, vC.x), n = 5.0 + floor(vSeed * 3.0);
    float edge = 0.5 + 0.48 * pow(abs(cos(ang * n * 0.5 + vSeed * 20.0)), 0.55);
    float w = fwidth(r) + 1e-4;
    fA = 1.0 - smoothstep(edge - w, edge + w, r);
    if (fA < 0.05) discard;
    // (paler toward the tips, darker at the throat; and its eye, gold, or dark in a poppy)
    fAlb = vHue * mix(0.72, 1.12, smoothstep(0.2, 0.9, r / edge));
    vec3 eye = vHue.r > 0.5 && vHue.g < 0.2 ? vec3(0.05, 0.035, 0.04) : vec3(0.85, 0.6, 0.08);
    fAlb = mix(eye, fAlb, smoothstep(0.2, 0.27, r));
  }
  float fSh = outgoingLight.g;
  vec3 fV = normalize(cameraPosition - vAt), fSun = sunlight(vAt);
  vec3 fC = lit(fAlb, vAt, fSh * 0.85, 0.9);
  // (a petal against the sun is lit through)
  fC += fAlb * fSun * pow(max(dot(-fV, uSun), 0.0), 2.0) * fSh * 0.5 * step(0.5, vC.z);
  fC = nightEye(min(fC, vec3(6.0)), vAt, 0.8, 0.4);
  gl_FragColor = vec4(fC, fA);`,
    });
    m.onBeforeCompile = ((base) => (s) => { base(s); Object.assign(s.uniforms, own); })(m.onBeforeCompile);
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    sheets.push({ mesh, own, f });
  }
  const dir = new THREE.Vector3();
  return {
    group,
    /** Lays the tiles on the sheets near the eye (a place, from the world's middle). From high up there are none to see. */
    update(eye) {
      dir.copy(eye).normalize();
      const high = eye.length() - land.radius;
      for (const s of sheets) {
        const st = onFace(s.f, dir);
        s.mesh.visible = !!st && high < fade[1] + 14 && Math.max(Math.abs(st[0]), Math.abs(st[1])) < 1 + reach;
        if (s.mesh.visible) s.own.uEyeST.value.set(st[0], st[1]);
      }
    },
  };
}
