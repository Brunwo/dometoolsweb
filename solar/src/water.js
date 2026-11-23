// The lake in the great hollow of the home world.
//
// Still water. What it shows depends on how one looks at it, as water does: across it, from its shore, it is a
// glass for the sky (the last light of the dusk, and the sun itself, broken into a path of sparks by the little
// that moves on it); straight down into it, from the air, it is dark and clear, its bed showing through where it
// is shallow. So it is one bright sheet from the shore at sunset, and from space a dark eye in the green with the
// sun glancing off it when the sun, the lake and the ship are in a line.
//
// It is a round sheet at the water's level, wider than the lake: the ground stands up through it wherever the
// ground is higher, and that is the shore. How deep it is at a place is read from the picture of the ground's height.
import * as THREE from 'three';
import { shadowed } from './air.js';

/** land: the home world's ground, with a lake (land.lake: its level, metres over the radius; land.places.hollow: its middle). */
export function createWater(air, land, { reach = 48, rings = 26, around = 72 } = {}) {
  const H = land.places.hollow, R = land.radius + land.lake;
  const e1 = new THREE.Vector3(0.3, 0.8, 0.5).cross(H).normalize(), e2 = new THREE.Vector3().crossVectors(H, e1), d = new THREE.Vector3();
  const pos = [0, 0, 0], nor = [0, 0, 0], index = [];
  d.copy(H).multiplyScalar(R).toArray(pos, 0); H.toArray(nor, 0);
  for (let j = 1; j <= rings; j++) for (let i = 0; i < around; i++) {
    const a = (i / around) * Math.PI * 2, r = (j / rings) * reach;
    d.copy(H).multiplyScalar(land.radius).addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r).normalize();
    nor.push(d.x, d.y, d.z); pos.push(d.x * R, d.y * R, d.z * R);
  }
  for (let i = 0; i < around; i++) index.push(0, 1 + i, 1 + ((i + 1) % around));
  for (let j = 1; j < rings; j++) for (let i = 0; i < around; i++) {
    const a = 1 + (j - 1) * around + i, b = 1 + (j - 1) * around + ((i + 1) % around), c = a + around, e = b + around;
    index.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  const material = shadowed(air, {
    key: 'water', taps: 8, own: { uLake: { value: land.lake } },
    vertexPars: 'varying vec3 vAt;',
    vertex: '#include <begin_vertex>\n  vAt = position;',
    fragmentPars: 'uniform float uLake; varying vec3 vAt;',
    fragment: /* glsl */ `
  vec3 wUp = normalize(vAt), wV = normalize(cameraPosition - vAt);
  float wD = distance(vAt, cameraPosition), wPx = max(length(dFdx(vAt)), length(dFdy(vAt)));
  float wDeep = uLake - texture2D(tHeight, landUv(landST(wUp))).r;
  // the little that moves on it: three soft swells crossing one another, drifting with the wind (what is finer
  // than the eye can tell from where it is, is left out)
  vec3 wE1 = normalize(cross(wUp, vec3(0.3, 0.8, 0.5))), wE2 = cross(wUp, wE1);
  vec2 wQ = vec2(dot(vAt, wE1), dot(vAt, wE2)), wLie = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    float f = i == 0 ? 0.55 : i == 1 ? 1.7 : 4.6, k = (1.0 - smoothstep(0.1, 0.34, wPx * f)) * (i == 0 ? 1.0 : i == 1 ? 0.7 : 0.45);
    vec3 q = vec3(wQ * f + vec2(0.11, 0.07) * uNow * (0.6 + float(i)), float(i) * 7.3 + uNow * 0.05);
    float n0 = aNoise3(q);
    wLie += (vec2(aNoise3(q + vec3(0.35, 0.0, 0.0)), aNoise3(q + vec3(0.0, 0.35, 0.0))) - n0) * k;
  }
  vec3 wN = normalize(wUp - (wE1 * wLie.x + wE2 * wLie.y) * 0.55);
  vec3 wR = reflect(-wV, wN);
  // (a ripple's far side cannot throw the eye's line down into the water)
  wR = normalize(wR + wUp * max(0.0, 0.02 - dot(wR, wUp)));
  float wLook = max(dot(wV, wN), 0.0), wGlass = 0.025 + 0.975 * pow(1.0 - wLook, 5.0);
  // --- the sky in it: brighter toward the horizon; the dusk's glow round where the sun is; and the sun ---
  float wHigh = max(dot(wR, wUp), 0.0), wToSun = dot(wR, uSun), wSh = outgoingLight.g;
  { float far = smoothstep(uCover.y, uCover.z, wD); if (far > 0.001) wSh *= 1.0 - 0.9 * far * treeShade(vAt, fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))); }
  // (the sky as it is seen from the ground, which is paler than the light it gives: slate by day, deep blue by night,
  // and rose only low down and toward where the sun went)
  float wH = sunOver(vAt), wLow = 1.0 - pow(wHigh, 0.5);
  vec3 wSun = sunlight(vAt), wSky = uSkyNight * 1.6 + mix(uSkyDay, vec3(dot(uSkyDay, vec3(0.3, 0.5, 0.2))) * vec3(0.8, 0.95, 1.25), 0.55) * smoothstep(-0.2, 0.4, wH) * mix(1.0, 2.3, wLow);
  wSky += uSkyDusk * exp(-pow((wH - 0.03) / 0.24, 2.0)) * wLow * (0.35 + 1.3 * max(wToSun, 0.0));
  wSky += wSun * (0.34 * pow(max(wToSun, 0.0), 4.0) + 0.5 * pow(max(wToSun, 0.0), 24.0)) * (1.0 - 0.5 * wHigh);
  float wEdge = sqrt(max(1.0 - uSunSize * uSunSize, 0.0));
  wSky += wSun * 4.2 * smoothstep(wEdge - 0.006, wEdge + 0.004, wToSun) * wSh;
  // --- what is in it: its bed, where it is shallow; further in, dark clear water ---
  vec3 wBed = uEarth * 0.55 * (0.8 + 0.4 * aNoise3(vAt * 1.3));
  vec3 wBody = mix(wBed, vec3(0.03, 0.13, 0.15), 1.0 - exp(-wDeep * 2.6));
  wBody = nightEye(lit(wBody, vAt, wSh * 0.7 * max(dot(wUp, uSun), 0.0), 1.0), vAt, 0.6, 0.7);
  vec3 wC = mix(wBody, wSky, wGlass) + wBody * shipGlow(vAt);
  // (at its very edge it thins away over the bed: there is no line where the water begins)
  gl_FragColor = vec4(min(wC, vec3(9.0)), smoothstep(0.0, 0.07, wDeep));`,
  });
  material.transparent = true;
  material.depthWrite = false;
  const mesh = new THREE.Mesh(g, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  return mesh;
}
