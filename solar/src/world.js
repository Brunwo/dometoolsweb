// The home world: its ground, and all that grows and stands on it, in paint.
import * as THREE from 'three';
import { shadowed } from './air.js';

/** The ground: six sheets of it, painted as the meadow seen from above (and, close to, as the dark between the blades). */
export function createGround(air, land) {
  const material = shadowed(air, {
    key: 'ground', own: { uLake: { value: land.lake ?? -1e9 } },
    vertexPars: 'varying vec3 vAt; varying vec3 vFace;',
    vertex: '#include <begin_vertex>\n  vAt = position; vFace = normal;',
    fragmentPars: 'uniform float uLake; varying vec3 vAt; varying vec3 vFace;',
    fragment: /* glsl */ `
  vec3 gUp = normalize(vAt), gN = normalize(vFace);
  vec4 gKind = texture2D(tKind, landUv(landST(gUp)));
  vec3 gRoot, gTip; meadow(vAt, length(vAt) - uLand.y, gKind.b, coverAt(gUp), gRoot, gTip);
  float gD = distance(vAt, cameraPosition);
  // near, it is the dark between the blades; further, where the blades give out, it is the grass itself seen from above
  vec3 gCol = mix(gRoot * 1.2, gTip * 0.8, smoothstep(5.0, 40.0, gD));
  // (where the blades have given out it is still grass, and grass is not one tone: it is soft, in tufts. Only
  // in tufts: nothing broader is laid on at random, for the broad tones are the land's own (meadow, in air.js).
  // What is finer than the eye can tell from where it is, is left out, as it would be in the looking)
  float gPx = max(length(dFdx(vAt)), length(dFdy(vAt)));
  mat3 gTurn = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
  vec3 gP = vAt; float gSoft = 0.0, gF = 2.6, gA = 0.2;
  for (int i = 0; i < 2; i++) {
    gSoft += (aNoise3(gP * gF + 7.0) - 0.5) * gA * (1.0 - smoothstep(0.1, 0.34, gPx * gF));
    gP = gTurn * gP; gF *= 0.36; gA *= 1.12;
  }
  gCol *= 1.0 + gSoft * smoothstep(6.0, 28.0, gD) * gKind.a;
  // (trodden earth; and by the lake, sand: paler, and wet and dark at the water's edge)
  {
    float high = length(vAt) - uLand.y - uLake, sandy = 1.0 - smoothstep(0.5, 1.4, high);
    vec3 earth = mix(uEarth, vec3(0.38, 0.34, 0.23), sandy) * mix(1.0, 0.62, sandy * (1.0 - smoothstep(0.0, 0.16, high)));
    gCol = mix(gCol, earth * (0.82 + 0.36 * smoothstep(0.3, 0.7, aNoise3(vAt * 1.3))), gKind.r);
  }
  // bare rock: weathered, a little lighter and darker in drifts, warm here and cool there, and moss where
  // the grass is near (soft, like everything else here: nothing in it is cut into shapes)
  if (gKind.g > 0.004) {
    vec3 rP = gTurn * vAt;
    float rA = aNoise3(vAt * 0.31 + 40.0), rB = aNoise3(rP * 1.1 + 9.0) * (1.0 - smoothstep(0.1, 0.34, gPx * 1.1)), rC = aNoise3(rP * 4.3 + 3.0) * (1.0 - smoothstep(0.1, 0.34, gPx * 4.3));
    vec3 gRock = uRock * (0.7 + 0.34 * rA + 0.2 * rB + 0.12 * rC) * mix(vec3(1.04, 0.98, 0.9), vec3(0.92, 0.97, 1.06), aNoise3(vAt * 0.17 + 5.0));
    // (worn into broad flats, each a tone of its own, their edges soft; and grit, close to)
    gRock *= 0.9 + 0.2 * smoothstep(0.4, 0.6, aNoise3(rP * 0.62 + 21.0)) * (1.0 - smoothstep(0.1, 0.34, gPx * 0.62));
    gRock *= 1.0 + (aNoise3(vAt * 19.0) - 0.5) * 0.16 * (1.0 - smoothstep(0.1, 0.34, gPx * 19.0));
    gRock = mix(gRock, uG4 * 0.55, smoothstep(0.52, 0.72, aNoise3(vAt * 0.55 + 70.0)) * 0.55);
    gCol = mix(gCol, gRock, gKind.g);
  }
  // (under a low sun the ground between the blades is in their shade)
  float gSun = smoothstep(-0.12, 0.5, dot(gN, uSun)) * outgoingLight.g * mix(0.12, 1.0, mix(1.0, smoothstep(0.0, 0.34, sunOver(vAt)), gKind.a));
  // (beyond where the lamp throws shadows, the trees' shade is read from the picture of what stands over the ground)
  { float far = smoothstep(uCover.y, uCover.z, gD); if (far > 0.001) gSun *= 1.0 - 0.92 * far * treeShade(vAt, fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))); }
  // (grass keeps something back from the sun: it is lit through as much as on)
  vec3 gC = nightEye(lit(gCol, vAt, gSun * mix(1.0, 0.66, gKind.a), 1.0), vAt, 0.5, 0.85);
  gC += gCol * shipGlow(vAt);
  gl_FragColor = vec4(gC, 1.0);`,
  });
  const group = new THREE.Group();
  for (const g of land.sheets) {
    const mesh = new THREE.Mesh(g, material);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
