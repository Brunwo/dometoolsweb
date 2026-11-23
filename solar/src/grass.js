// Grass, on a round world.
//
// A blade is a thin strip of a few pieces, wide at its foot and coming to a point. There are some hundreds of
// thousands of them, and they are not planted anywhere: each has a place in a square tile, and the tile is laid
// again and again round the eye, so that wherever one stands the grass is thick underfoot and thins with distance
// into the painted ground, which is the colour the grass was. What a blade is (how tall, what green, which way it
// leans) it works out for itself, each frame, from where it has ended up.
//
// A ball cannot be tiled with squares. But each of the six sheets the ground is laid out on (land.js) can: so the
// tiles are laid on whichever sheets are near the eye, and a blade that falls off the edge of its sheet is left
// out, because the next sheet has laid its own there.
import * as THREE from 'three';
import { shadowed } from './air.js';
import { FACES, onFace, rng } from './land.js';

export const PLACE = /* glsl */ `
  vec2 gCell = seed.xy * uTile;
  vec2 gST = gCell + floor((uEyeST - gCell) / uTile + 0.5) * uTile;
  float gIn = step(max(abs(gST.x), abs(gST.y)), 1.0);
  vec3 gUp = normalize(uFaceA + uFaceU * tan(gST.x * 0.7853982) + uFaceV * tan(gST.y * 0.7853982));
  vec2 gUv = landUv(vec3(gST, uFace));
  float gY = texture2D(tHeight, gUv).r;
  vec4 gKind = texture2D(tKind, gUv);
  vec3 gAt = gUp * (uLand.y + gY - 0.03);
  float gDist = distance(gAt, cameraPosition);
  // two ways along the ground there
  vec3 gE = normalize(cross(gUp, uFaceU)), gF = cross(gUp, gE);
  // (it thins out toward the edge of its tile, each blade at its own distance, so there is no line where grass stops)
  float gKeep = (1.0 - smoothstep(uFade.x, uFade.y, gDist + (seed.z - 0.5) * uFade.z)) * gIn;
  gKeep *= smoothstep(uFade.w - 2.0, uFade.w + 2.0, gDist + (seed.w - 0.5) * 3.0);
`;
export const LEAN = /* glsl */ `
  float gAng = seed.z * 18.85;
  vec2 gFace = vec2(cos(gAng), sin(gAng)), gOwn = vec2(-gFace.y, gFace.x);
  // the wind comes over the meadow in gusts
  vec3 gWind3 = windAt(gAt); vec2 gWind = vec2(dot(gWind3, gE), dot(gWind3, gF));
  float gGust = aNoise3(gAt * 0.055 - gWind3 * uNow * 1.5); gGust *= gGust;
  float gFlutter = sin(uNow * (2.3 + seed.w * 1.7) + seed.z * 40.0 + gAt.x * 0.7);
  vec2 gLean = gFace * (0.16 + 0.26 * seed.w) + gWind * (0.4 + 1.73 * gGust) + gOwn * gFlutter * 0.06 * uWind.w;
  // and it bends away from whoever is in it
  for (int i = 0; i < 2; i++) { vec3 dv = gAt - uPush[i].xyz; float dl = length(dv); gLean += vec2(dot(dv, gE), dot(dv, gF)) / max(dl, 0.05) * (1.0 - smoothstep(0.0, max(uPush[i].w, 0.01), dl)) * 0.9 * step(0.01, uPush[i].w); }
  float gLL = length(gLean); if (gLL > 1.5) { gLean *= 1.5 / gLL; gLL = 1.5; }
`;

function seeds(count, seed) {
  const R = rng(seed), a = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) a[i] = R();
  return a;
}

/**
 * One layer of grass. tile: the side of the square it is laid in, in metres. fade: [from, to, raggedness, inner
 * edge], metres from the eye. size: [half width, height, how much wider with distance].
 */
export function createGrass(air, land, { count, tile, segs, fade, size, seed }) {
  const pos = [], index = [];
  for (let j = 0; j < segs; j++) pos.push(-1, j / segs, 0, 1, j / segs, 0);
  pos.push(0, 1, 0);
  for (let j = 0; j < segs - 1; j++) { const a = j * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  { const a = (segs - 1) * 2; index.push(a, a + 1, a + 2); }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds(count, seed), 4));
  g.instanceCount = count;
  // (a metre along the ground is this much of a sheet, at its middle)
  const metre = 1 / (land.radius * Math.PI / 4), reach = fade[1] * metre * 1.35;
  const group = new THREE.Group(), sheets = [];
  for (let f = 0; f < 6; f++) {
    const own = {
      uTile: { value: tile * metre }, uFade: { value: new THREE.Vector4(...fade) }, uSize: { value: new THREE.Vector3(...size) },
      uFaceA: { value: FACES[f].A }, uFaceU: { value: FACES[f].U }, uFaceV: { value: FACES[f].V }, uFace: { value: f }, uEyeST: { value: new THREE.Vector2() },
    };
    const m = shadowed(air, {
      side: THREE.DoubleSide, key: 'grass', taps: 6,
      vertexPars: 'attribute vec4 seed; uniform float uTile; uniform vec4 uFade; uniform vec3 uSize; uniform vec3 uFaceA; uniform vec3 uFaceU; uniform vec3 uFaceV; uniform float uFace; uniform vec2 uEyeST; varying float vT; varying vec3 vTip; varying vec3 vRoot; varying vec3 vAt; varying float vGust;',
      vertex: PLACE + LEAN + /* glsl */ `
  float gGrow = smoothstep(0.35, 0.6, gKind.a);
  float gH = uSize.y * (0.5 + 0.8 * seed.w * seed.w + 0.25 * seed.z) * gGrow * gKeep * (0.75 + 0.6 * aNoise3(gAt * 0.06 + 9.0));
  float gWd = uSize.x * (0.7 + 0.6 * seed.z) * (1.0 + gDist * uSize.z) * step(0.001, gH);
  float gT = position.y;
  // (its width is turned mostly square to the eye: a blade is never seen edge-on)
  vec3 gEye = cameraPosition - gAt;
  vec2 gToEye = normalize(vec2(dot(gEye, gE), dot(gEye, gF)) + 1e-4), gSq = vec2(-gToEye.y, gToEye.x);
  vec2 gAcross = normalize(mix(gOwn * sign(dot(gOwn, gSq) + 1e-4), gSq, 0.6));
  vec2 gOff = gLean * gT * gT * gH + gAcross * position.x * gWd * pow(1.0 - gT, 0.7);
  vec3 transformed = gAt + gE * gOff.x + gF * gOff.y + gUp * (gH * gT * (1.0 - 0.3 * gLL * gLL * gT));
  vec3 gRoot, gTip; meadow(gAt, gY, gKind.b, coverAt(gUp), gRoot, gTip);
  gTip *= 0.8 + 0.4 * seed.w;
  gTip = mix(gTip, uG3 * 1.05, step(0.94, seed.z) * 0.7);
  vT = gT; vTip = gTip; vRoot = gRoot; vAt = transformed; vGust = gGust;`,
      fragmentPars: 'varying float vT; varying vec3 vTip; varying vec3 vRoot; varying vec3 vAt; varying float vGust;',
      fragment: /* glsl */ `
  // (how far up the blade: kept between its foot and its tip. At a blade's very edge the graphics card guesses this from
  // beyond the blade, and a guess of 5 cubed is a spark in the grass)
  float gT = clamp(vT, 0.0, 1.0);
  float gSh = outgoingLight.g;
  vec3 gAlb = mix(vRoot, vTip, smoothstep(0.0, 0.85, gT));
  vec3 gV = normalize(cameraPosition - vAt), gSunHere = sunlight(vAt);
  // against the sun a blade is lit through
  float gBack = pow(max(dot(-gV, uSun), 0.0), 2.0);
  // (when the sun is low the grass shades itself: its feet go into shadow first, and its tips keep the light longest)
  float gLow = smoothstep(0.0, 0.34, sunOver(vAt));
  vec3 gC = lit(gAlb, vAt, gSh * (0.5 + 0.5 * gT) * mix(gT * gT * gT, 1.0, gLow), 0.3 + 0.7 * gT);
  gC += gAlb * gSunHere * vec3(0.85, 1.0, 0.3) * gBack * gSh * gT * 0.42;
  gC += gSunHere * 0.06 * gSh * vGust * gT * gT;
  gC = nightEye(min(gC, vec3(6.0)), vAt, 0.5, 0.85);
  gC += gAlb * shipGlow(vAt) * (0.4 + 0.6 * gT);
  gl_FragColor = vec4(gC, 1.0);`,
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
    /** Lays the tiles on the sheets near the eye (a place, from the world's middle). Above a certain height there is no grass to see. */
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
