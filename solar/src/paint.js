// The painted things that are not grass: leaves, and solid things (trunks, rocks).
//
// Leaves are touches of a brush ("dabs"): small marks that face the eye. One touch lays down several leaves at
// once. A crown is a few thousand touches about its boughs, and each knows which way out of the crown it faces:
// that, and not the flat mark's own facing, is what it is lit by, so a tree is shaded as the round thing it is.
//
// Bark is painted the way a brush would do it: a few broad planes of colour with dark lines drawn between (its
// cracks), each plane a little lighter on the edge it turns to the sun and darker on the other.
//
// Stone is not cut into planes at all. Its shape is in the stone itself (it has been split, and its faces are
// its own); what is painted on it is soft: tone that drifts, a rough skin that catches the sun grain by grain,
// small dark pits, and whatever has settled on top of it (moss on the home world, dust on the moon).
//
// A thing in leaf is the same thing from any distance. It is made once, leaf by leaf, and from further off fewer
// of its touches are laid and each of those is laid broader, so that the crown stays as full as it was: a touch
// goes by shrinking to nothing, each at its own distance, and nothing is ever swapped for something else.
//
// A thing is made once, standing at the origin with +Y for its upright, and may then be set down anywhere on a
// world, turned so that its upright is the world's there, and at any size.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AIR, CELLS, shadowed } from './air.js';

/**
 * How a thing in leaf thins with distance. near: how far off (in its own sizes: metres over its size) it is still
 * whole; from there the part of its touches that is kept falls as (near / far) ^ power, down to least; grow: each
 * touch kept is that much broader (as a power of one over the part kept: a half would keep the crown's paint the same).
 */
export const PRUNE = { near: 17, power: 1.1, least: 0.05, grow: 0.47 };
export const keepAt = (far) => Math.min(1, Math.max(PRUNE.least, (PRUNE.near / Math.max(far, 1e-3)) ** PRUNE.power));
/** The parts of a thing's touches that there are pieces for (its buffers are shared: a piece is only a count). */
export const LEVELS = [1, 0.6, 0.36, 0.2, 0.11, 0.056];
const FAR_TONE = '0.56, 0.7, 0.8';

// A dab is four corners at one place; they are set out toward the eye here.
const DAB_VERTEX = /* glsl */ `
  vec3 transformed = offset;
  float dSeed = fract(dabB.y);
  // the bough it is on moves in the wind, and it stirs on the bough
  vec3 dPlace = (modelMatrix * vec4(offset, 1.0)).xyz, dBlow = windAt(dPlace);
  float dBig = length(modelMatrix[0].xyz);
  // how many of its touches are laid, from this far off (in its own sizes), and how much broader each is for it
  float dFar = distance(uEye, modelMatrix[3].xyz) / dBig, dKeep = clamp(pow(${PRUNE.near.toFixed(1)} / dFar, ${PRUNE.power.toFixed(2)}), ${PRUNE.least.toFixed(3)}, 1.0);
  // (a soft dark mass under a bough's needles is let grow far less than the needles are: or from far off it would stand out past them)
  float dGrow = dabB.y >= 1.0 ? 1.0 : (1.0 - smoothstep(dKeep * 0.7, dKeep, dSeed)) * pow(dKeep, dabB.z > 1.5 ? -0.16 : -${PRUNE.grow.toFixed(2)});
  vec3 dWind = transpose(mat3(modelMatrix)) * dBlow / (dBig * dBig);
  float dGust = aNoise3(dPlace * 0.05 - dBlow * uNow * 1.5);
  transformed += dWind * dabB.w * (0.05 + 0.28 * dGust * dGust) * (0.6 + 0.4 * sin(uNow * 1.3 + offset.y * 0.7 + dSeed * 6.0));
  transformed.y += dabB.w * 0.03 * sin(uNow * 2.1 + dSeed * 40.0) * uWind.w;
  vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const DAB_PROJECT = /* glsl */ `
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  {
    float a = dabB.x + dabB.w * 0.16 * sin(uNow * 1.7 + dSeed * 30.0) * uWind.w;
    // (a touch is laid on upright, and upright is away from the world's middle)
    vec2 dUp = (viewMatrix * vec4(normalize(vWorld), 0.0)).xy;
    if (dot(dUp, dUp) > 1e-4) a += atan(-dUp.x, dUp.y);
    vec2 o = position.xy * dabS * dBig * dGrow;
    mvPosition.xy += vec2(cos(a) * o.x - sin(a) * o.y, sin(a) * o.x + cos(a) * o.y);
    vC = position.xy; vDab = dabB;
  }
  gl_Position = projectionMatrix * mvPosition;`;
// The shape of a touch. r: 0 at the middle of the nearest mark in it, 1 at that mark's edge. tone: how much paint
// was on the brush for that mark, -1 to 1.
const DAB_SHAPE = /* glsl */ `
  vec2 dP = vC; float dSeed = fract(vDab.y), dK = vDab.z, dR = 2.0, dTone = 0.0;
  if (dK < 0.5) {
    // leaves: four to seven of them, each pointed at both ends and a little bent
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      if (fi > 3.5 + dSeed * 3.5) break;
      vec3 h = fract(sin(vec3(fi * 12.9898 + dSeed * 91.7, fi * 78.233 + dSeed * 47.3, fi * 37.719 + dSeed * 13.1)) * 43758.5453);
      vec2 q = dP - (h.xy - 0.5) * 1.05;
      float a = (h.z - 0.5) * 1.9, ca = cos(a), sa = sin(a);
      q = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
      float s = 0.3 + 0.16 * h.x, y = q.y / s;
      float r = abs(y) < 1.0 ? abs(q.x + 0.1 * s * sin(y * 2.5 + h.y * 9.0)) / (s * 0.5 * pow(1.0 - y * y, 0.7) + 0.004) : 2.0;
      if (r < dR) { dR = r; dTone = h.z * 2.0 - 1.0; }
    }
  } else if (dK < 1.5) {
    // a spray of needles: they fan from the twig, which runs up the middle
    for (int i = 0; i < 9; i++) {
      float fi = float(i), side = mod(fi, 2.0) * 2.0 - 1.0, at = -0.85 + fi * 0.2;
      vec2 h = fract(sin(vec2(fi * 12.9898 + dSeed * 91.7, fi * 78.233 + dSeed * 47.3)) * 43758.5453);
      vec2 from = vec2(0.0, at), dir = normalize(vec2(side * (0.75 + 0.3 * h.x), -0.55 - 0.3 * h.y));
      vec2 q = dP - from; float al = dot(q, dir), len = 0.62 + 0.25 * h.x;
      float r = (al > 0.0 && al < len) ? abs(dot(q, vec2(-dir.y, dir.x))) / (0.085 * (1.0 - al / len) + 0.02) : 2.0;
      if (r < dR) { dR = r; dTone = h.y * 2.0 - 1.0; }
    }
    dR = min(dR, abs(dP.x) / 0.05 + step(0.9, abs(dP.y)) * 2.0);
  } else {
    // a soft ragged mass
    float ang = atan(dP.y, dP.x);
    // (kept inside the touch's own square, or its straight sides would show)
    dR = length(dP) * 1.32 * (1.0 + 0.14 * sin(ang * 3.0 + dSeed * 40.0) + 0.08 * sin(ang * 5.0 + dSeed * 91.0));
  }`;

export function createPaint(air) {
  const { leaf, solid } = paintFor(air);
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  leafDepth.onBeforeCompile = (s) => {
    air.share(s);
    s.vertexShader = AIR + DAB_PARS + '\n' + s.vertexShader.replace('#include <begin_vertex>', DAB_VERTEX).replace('#include <project_vertex>', DAB_PROJECT);
    s.fragmentShader = 'varying vec2 vC; flat varying vec4 vDab;\n' + s.fragmentShader.replace('void main() {', `void main() {${DAB_SHAPE}\n  if (dR > 1.0) discard;`);
  };
  leafDepth.customProgramCacheKey = () => 'leaf-depth';
  return { leaf, solid, leafDepth };
}

const DAB_PARS = 'attribute vec3 offset; attribute vec3 crown; attribute vec4 dabC; attribute vec2 dabS; attribute vec4 dabB; varying vec2 vC; flat varying vec4 vDab; varying vec3 vWorld;';

// Smooth noise for the skin of a stone, with which way it slopes (x: its value, about -1 to 1; yzw: how fast that
// changes each way). Worked by whole numbers, so that there is no grid to be seen in it however close one comes.
const STONE = /* glsl */ `
vec3 sWay(ivec3 p) {
  uint h = uint(p.x) * 374761393u + uint(p.y) * 668265263u + uint(p.z) * 2147483647u; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u;
  return vec3(float(h & 1023u), float((h >> 10u) & 1023u), float((h >> 20u) & 1023u)) / 511.5 - 1.0;
}
vec4 sNoise(vec3 x) {
  ivec3 i = ivec3(floor(x)); vec3 f = fract(x), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0), du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec3 ga = sWay(i), gb = sWay(i + ivec3(1, 0, 0)), gc = sWay(i + ivec3(0, 1, 0)), gd = sWay(i + ivec3(1, 1, 0)), ge = sWay(i + ivec3(0, 0, 1)), gf = sWay(i + ivec3(1, 0, 1)), gg = sWay(i + ivec3(0, 1, 1)), gh = sWay(i + ivec3(1, 1, 1));
  float va = dot(ga, f), vb = dot(gb, f - vec3(1.0, 0.0, 0.0)), vc = dot(gc, f - vec3(0.0, 1.0, 0.0)), vd = dot(gd, f - vec3(1.0, 1.0, 0.0)), ve = dot(ge, f - vec3(0.0, 0.0, 1.0)), vf = dot(gf, f - vec3(1.0, 0.0, 1.0)), vg = dot(gg, f - vec3(0.0, 1.0, 1.0)), vh = dot(gh, f - vec3(1.0, 1.0, 1.0));
  float kxy = va - vb - vc + vd, kyz = va - vc - ve + vg, kzx = va - vb - ve + vf, kall = -va + vb + vc - vd + ve - vf - vg + vh;
  return vec4(va + u.x * (vb - va) + u.y * (vc - va) + u.z * (ve - va) + u.x * u.y * kxy + u.y * u.z * kyz + u.z * u.x * kzx + kall * u.x * u.y * u.z,
    ga + u.x * (gb - ga) + u.y * (gc - ga) + u.z * (ge - ga) + u.x * u.y * (ga - gb - gc + gd) + u.y * u.z * (ga - gc - ge + gg) + u.z * u.x * (ga - gb - ge + gf) + (-ga + gb + gc - gd + ge - gf - gg + gh) * u.x * u.y * u.z
    + du * (vec3(vb, vc, ve) - va + u.yzx * vec3(kxy, kyz, kzx) + u.zxy * vec3(kzx, kxy, kyz) + u.yzx * u.zxy * kall));
}
`;

function paintFor(air) {
  const leaf = shadowed(air, {
    side: THREE.DoubleSide, key: 'leaf', alphaToCoverage: true,
    vertexPars: DAB_PARS + 'flat varying vec3 vN; flat varying vec4 vCol; flat varying float vFar;',
    vertex: DAB_VERTEX + '  vN = normalize(mat3(modelMatrix) * crown); vCol = dabC; vFar = dFar;',
    fragmentPars: 'varying vec2 vC; flat varying vec4 vDab; flat varying vec3 vN; flat varying vec4 vCol; varying vec3 vWorld; flat varying float vFar;',
    fragment: DAB_SHAPE + /* glsl */ `
  float dAA = fwidth(dR) + 1e-4, dA = 1.0 - smoothstep(1.0 - dAA, 1.0 + dAA, dR);
  // (it gives way to an eye among the leaves)
  dA *= smoothstep(0.3, 1.3, distance(cameraPosition, vWorld));
  if (dA < 0.04) discard;
  vec3 dV = normalize(cameraPosition - vWorld), dSky = normalize(vWorld);
  // lit as the round crown it is part of; a bough in another's shadow is darker; deep inside is darker still
  vec3 dAt = lowered(vWorld);
  float dL = smoothstep(-0.45, 0.7, dot(vN, uSun)) * mix(0.5, 1.0, outgoingLight.g) * (0.35 + 0.65 * vCol.a);
  vec3 dAlb = vCol.rgb * (1.0 + 0.2 * dTone);
  // (seen from far off a wood is darker and cooler than the meadow round it: its own shade is in it)
  dAlb *= mix(vec3(1.0), vec3(${FAR_TONE}), smoothstep(26.0, 190.0, vFar));
  vec3 dC = lit(dAlb, dAt, dL, (0.3 + 0.7 * (dot(vN, dSky) * 0.5 + 0.5)) * vCol.a);
  // against the sun, the leaves at a crown's edge are lit through
  dC += dAlb * sunlight(dAt) * vec3(1.0, 0.92, 0.3) * pow(max(dot(-dV, uSun), 0.0), 3.0) * vCol.a * vCol.a * 0.6;
  // (by night a tree is a dark shape against the sky, a little paler where the sky's light is on its top: its greens are gone)
  dC = nightEye(dC, dAt, 0.85, 0.5) + dAlb * shipGlow(vWorld) * 0.45;
  gl_FragColor = vec4(dC, dA);`,
  });
  leaf.onBeforeCompile = ((base) => (s) => { base(s); s.vertexShader = s.vertexShader.replace('#include <project_vertex>', DAB_PROJECT); })(leaf.onBeforeCompile);
  // --- solid things ---
  const solid = shadowed(air, {
    key: 'solid',
    vertexPars: 'attribute vec3 tint; attribute vec4 kind; varying vec3 vRest; varying vec3 vNw; varying vec3 vNo; varying vec3 vTint; flat varying vec4 vKind; varying vec3 vWorld; flat varying vec3 vSunIn;',
    vertex: '#include <begin_vertex>\n  vRest = position; vNo = normal; vNw = normalize(mat3(modelMatrix) * normal); vTint = tint; vKind = kind; vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vSunIn = normalize(transpose(mat3(modelMatrix)) * uSun);',
    fragmentPars: CELLS + STONE + 'varying vec3 vRest; varying vec3 vNw; varying vec3 vNo; varying vec3 vTint; flat varying vec4 vKind; varying vec3 vWorld; flat varying vec3 vSunIn;',
    fragment: /* glsl */ `
  // kind.x: 0 bark, 1 rock. kind.y: how big its planes are. kind.z: its own seed. kind.w: how much moss.
  vec3 sN = normalize(vNw), sSky = normalize(vWorld), sAlb;
  float sRock = step(0.5, vKind.x), sUp = dot(sN, sSky), sFace = dot(sN, uSun);
  if (vKind.x > 0.5) {
    // stone: soft tone in four sizes, and with each a roughness of its own, which turns the light as the skin
    // of a stone does (what is finer than the eye can tell from where it is, is left out)
    vec3 p = (vRest + vKind.z) * vKind.y, nO = normalize(vNo), lie = vec3(0.0);
    float px = max(length(dFdx(vRest)), length(dFdy(vRest))) * vKind.y, tone = 0.0, f = 1.2;
    for (int i = 0; i < 4; i++) {
      float k = 1.0 - smoothstep(0.08, 0.26, px * f);
      if (k > 0.01) {
        vec4 n = sNoise(p * f + float(i) * 17.3);
        tone += n.x * k * (i == 0 ? 0.2 : i == 1 ? 0.15 : 0.11);
        lie += n.yzw * k * (i == 0 ? 0.16 : i == 3 ? 0.24 : 0.28);
      }
      f *= 3.1;
    }
    sAlb = vTint * (0.92 + tone) * mix(vec3(1.04, 1.0, 0.94), vec3(0.94, 0.98, 1.06), aNoise3(p * 0.7 + 5.0));
    // (the light on it, as its rough skin turns it; worked in the stone's own directions, where the roughness is)
    lie -= nO * dot(lie, nO);
    sFace += (dot(normalize(nO - lie), vSunIn) - dot(nO, vSunIn)) * 0.7;
  } else {
    float sEdge; vec3 sId, sMid;
    cells3((vRest + vKind.z) * vec3(1.0, 0.22, 1.0) * vKind.y, sEdge, sId, sMid);
    sAlb = vTint * (0.8 + 0.4 * sId.x);
    // each plane: lighter on the edge it turns to the sun, darker on the other; and a dark line between planes
    float sBevel = (1.0 - smoothstep(0.03, 0.26, sEdge)) * dot(normalize(-sMid + 1e-4), normalize(vSunIn * vec3(1.0, 0.22, 1.0)));
    sAlb *= 1.0 + 0.32 * sBevel * dayAt(vWorld);
    sAlb = mix(sAlb, vTint * vec3(0.3, 0.26, 0.4), 1.0 - smoothstep(0.012, 0.05, sEdge));
  }
  // moss where it faces the sky, in patches
  float sMoss = max(vKind.w, 0.0) * smoothstep(0.25, 0.75, sUp + (aNoise3(vWorld * 1.4) - 0.5) * 0.9);
  sAlb = mix(sAlb, mix(uG4, uG2, aNoise3(vWorld * 3.0)) * 0.8, sMoss);
  vec3 sAt = lowered(vWorld);
  float sL = smoothstep(-0.05, 0.5, sFace) * outgoingLight.g;
  vec3 sC = lit(sAlb, sAt, sL, 0.35 + 0.65 * (sUp * 0.5 + 0.5));
  // (stone takes some warmth up from the grass it stands in)
  sC += sAlb * sunlight(sAt) * uBounce * (1.0 - sUp) * sRock;
  // (a lit window, a lamp: kind.w below nothing is how brightly it shines of itself)
  sC = nightEye(sC, sAt, 0.8, 0.55) + sAlb * shipGlow(vWorld);
  sC += vTint * max(-vKind.w, 0.0) * 2.4;
  gl_FragColor = vec4(sC, 1.0);`,
  });
  return { leaf, solid };
}

/** Collects touches of the brush and makes one piece of them. */
export function createDabs() {
  const c = new THREE.Color();
  let cap = 1 << 13, n = 0, far = 0, wide = 0;
  const cols = { offset: 3, crown: 3, dabC: 4, dabS: 2, dabB: 4 }, data = {};
  for (const k of Object.keys(cols)) data[k] = new Float32Array(cap * cols[k]);
  const grow = () => { cap *= 2; for (const k of Object.keys(cols)) { const more = new Float32Array(cap * cols[k]); more.set(data[k]); data[k] = more; } };
  return {
    /** One touch at (x, y, z). w, h: half its width and height. kind: 0 leaves, 1 a spray of needles, 2 a soft mass.
     *  normal: which way out of its crown it faces. inner: 0 deep inside the crown to 1 at its surface. */
    add(x, y, z, { w, h = w, turn = 0, seed = 0.5, kind = 0, colour, normal, inner = 1, sway = 0.5, always = false }) {
      if (n === cap) grow();
      c.set(colour);
      data.offset.set([x, y, z], n * 3); data.crown.set([normal.x, normal.y, normal.z], n * 3); data.dabC.set([c.r, c.g, c.b, inner], n * 4);
      data.dabS.set([w, h], n * 2); data.dabB.set([turn, Math.min(seed, 0.999) + (always ? 1 : 0), kind, sway], n * 4);
      far = Math.max(far, Math.hypot(x, y, z) + Math.max(w, h)); if (!always) wide = Math.max(wide, w, h);
      n++;
    },
    /** The piece, once for each of LEVELS: the same touches, in the order they are given up in, and so many of them. */
    build() {
      // (a touch is given up when the part of them all that is kept falls below its own number: so the first are
      // those never given up, and then each in the order of its number)
      const rank = (i) => (data.dabB[i * 4 + 1] >= 1 ? -1 : data.dabB[i * 4 + 1]);
      const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => rank(a) - rank(b));
      const corners = new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3), index = new THREE.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1), attrs = {};
      for (const k of Object.keys(cols)) {
        const c = cols[k], from = data[k], to = new Float32Array(n * c);
        order.forEach((i, j) => { for (let e = 0; e < c; e++) to[j * c + e] = from[i * c + e]; });
        attrs[k] = new THREE.InstancedBufferAttribute(to, c);
      }
      return LEVELS.map((keep) => {
        const g = new THREE.InstancedBufferGeometry();
        g.setAttribute('position', corners); g.setIndex(index);
        for (const k of Object.keys(cols)) g.setAttribute(k, attrs[k]);
        let count = 0; while (count < n && rank(order[count]) < keep) count++;
        g.instanceCount = count;
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), far + wide * (PRUNE.least ** -PRUNE.grow - 1));
        return g;
      });
    },
    get count() { return n; },
  };
}

/** Collects solid pieces and makes one piece of them. bark: it is a trunk (its planes run up it). scale: how many
 *  planes to a metre. moss: 0 to 1. */
export function createSolids() {
  const parts = [], T = new THREE.Color();
  let k = 0;
  return {
    add(g, colour, { bark = false, scale = 1, moss = 0, glow = 0 } = {}) {
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.position.count, tint = new Float32Array(n * 3), kind = new Float32Array(n * 4), seed = (++k * 7.31) % 50;
      T.set(colour);
      for (let i = 0; i < n; i++) { tint.set([T.r, T.g, T.b], i * 3); kind.set([bark ? 0 : 1, scale, seed, glow ? -glow : moss], i * 4); }
      g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
      g.setAttribute('kind', new THREE.BufferAttribute(kind, 4));
      g.deleteAttribute('uv');
      parts.push(g.index ? g.toNonIndexed() : g);
      return g;
    },
    build() {
      if (!parts.length) return null;
      const g = mergeGeometries(parts);
      g.computeBoundingSphere();
      return g;
    },
    get count() { return parts.length; },
  };
}
