// What every painted thing on a world shares: its sun, the light of its sky, its wind, one clock, and the pictures
// of its ground.
//
// Everything on a world is drawn in that world's own frame: its middle is the origin, and it does not turn (the
// sun and the stars go round it). So a place on the ground keeps its numbers for good, and "up" at any place is
// the way from the middle to it.
//
// The look is a painter's. The sun is warm and the sky's light is blue, so whatever the sun does not reach goes
// cool, never grey. And because a world is small, every hour of the day is somewhere on it at once: each place
// works out for itself how high the sun stands over it. Where the sun is high its light is clear; near the edge of
// day it has come a long way through the air and is orange, then red; past the edge there is only the sky's last
// violet, and then the night, which is never black.
//
// (The air between the eye and a thing is not painted here: that is done once for the whole picture, in page.js.)
import * as THREE from 'three';
import { LAND } from './land.js';

const lin = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

export function createAir(land) {
  const uniforms = {
    uNow: { value: 0 },
    uEye: { value: new THREE.Vector3() }, // where whoever is looking is (which is not always where a picture is taken from: a shadow, the glass on the desk)
    uSun: { value: new THREE.Vector3(0, 1, 0) }, // the way to the sun
    uSunCol: { value: lin('#fff0d2', 1.5) },
    // how much of each colour a clear noon's worth of air takes out of the sun's light
    uTau: { value: new THREE.Vector3(0.034, 0.135, 0.5) },
    uSunSize: { value: 0.17 }, // half the sun's width in the sky, as a sine
    uSkyDay: { value: lin('#7c92ff', 0.42) }, uSkyDusk: { value: lin('#d0688e', 0.3) }, uSkyNight: { value: lin('#3a4c9a', 0.085) },
    uWind: { value: new THREE.Vector4(0.15, 1, 0.1, 0.55) }, // the axis the wind goes round, and how hard it blows
    uPush: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] }, // who is in the grass: where, and how wide they part it
    tHeight: { value: land.tHeight }, tKind: { value: land.tKind }, uLand: { value: new THREE.Vector2(land.squares, land.radius) },
    // the meadow's greens: fresh, yellow, straw, lush
    uG1: { value: lin('#56b23a') }, uG2: { value: lin('#8cc63a') }, uG3: { value: lin('#cfd058') }, uG4: { value: lin('#2a8c46') },
    // another world that can come between a place and the sun: its middle (in this frame) and its radius; and the
    // little light that still comes round its edge when it hides the sun whole
    // what the ground throws back up onto the undersides of things standing on it
    uBounce: { value: new THREE.Color(0.05, 0.065, 0.02) },
    uShade: { value: new THREE.Vector4(0, 1e7, 0, 1) }, uShadeGlow: { value: new THREE.Color(0, 0, 0) },
    uEarth: { value: lin('#d4a468') }, uRock: { value: lin('#8f887d') },
    // how soft a shadow's edge is: x, across how many dots of the shadow's own picture it is spread; y, the same
    // as a depth in that picture (set in main.js as the picture is drawn wider or closer)
    uShadowSoft: { value: new THREE.Vector2(4, 0.0003) },
    // what stands over the ground (cover.js; none, until it is given): x, how many squares to a sheet's side; and
    // from how far off (y) to how far (z) the shade of trees is read from it and not from the lamp
    // the light of the ship's lamps and windows on what stands round it: where the ship stands (xyz) and how
    // strong (w: nothing, when it is not on this world); and the way out of its door, if the door is open
    uGlow: { value: new THREE.Vector4(0, 1, 0, 0) }, uGlowDoor: { value: new THREE.Vector3() },
    tCover: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) }, uCover: { value: new THREE.Vector3(1, 45, 70) },
  };
  uniforms.uWind.value.set(...new THREE.Vector3(0.15, 1, 0.1).normalize().toArray(), 0.55);
  return { uniforms, share(s) { for (const k of Object.keys(uniforms)) s.uniforms[k] = uniforms[k]; } };
}

export const AIR = /* glsl */ `
uniform float uNow; uniform vec3 uEye; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uTau; uniform float uSunSize;
uniform vec3 uSkyDay; uniform vec3 uSkyDusk; uniform vec3 uSkyNight; uniform vec4 uWind; uniform vec4 uPush[2];
uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3; uniform vec3 uG4; uniform vec3 uEarth; uniform vec3 uRock;
uniform vec4 uShade; uniform vec3 uShadeGlow; uniform vec3 uBounce;
uniform sampler2D tCover; uniform vec3 uCover; uniform vec4 uGlow; uniform vec3 uGlowDoor;
` + LAND + /* glsl */ `
float aHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float aHash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float aNoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(aHash3(i), aHash3(i + vec3(1, 0, 0)), f.x), mix(aHash3(i + vec3(0, 1, 0)), aHash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(aHash3(i + vec3(0, 0, 1)), aHash3(i + vec3(1, 0, 1)), f.x), mix(aHash3(i + vec3(0, 1, 1)), aHash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// How high the sun stands over a place: its sine, measured from that place's own horizon (which dips, the higher
// one is over the ground).
float sunOver(vec3 p) { float r = length(p); return dot(p / r, uSun) + sqrt(max(0.0, 1.0 - (uLand.y * uLand.y) / (r * r))); }
// How much of the sun's disc is over the edge of the world there: 0 night, 1 day.
float dayAt(vec3 p) { return smoothstep(-uSunSize, uSunSize, sunOver(p)); }
// How much of the sun another world hides from a place: 0 none of it, 1 all (an eclipse). Both are discs in the
// sky there, and it is how far one lies over the other.
float hidden(vec3 p) {
  vec3 to = uShade.xyz - p; float d = length(to);
  float apart = acos(clamp(dot(to / d, uSun), -1.0, 1.0)), wide = asin(clamp(uShade.w / d, 0.0, 1.0)), sun = asin(uSunSize);
  return (1.0 - smoothstep(abs(wide - sun), wide + sun, apart)) * min(1.0, (wide * wide) / (sun * sun));
}
// The sun's light at a place, before anything near casts a shadow on it.
vec3 sunlight(vec3 p) {
  float h = sunOver(p), gone = hidden(p);
  // (how much air its light has come through: one noon's worth overhead, many at the edge of day)
  float air = min(1.0 / (max(h, 0.0) + 0.1), 5.2) * exp(-max(length(p) - uLand.y, 0.0) / 6.0);
  return (uSunCol * exp(-uTau * air) * (1.0 - gone) + uShadeGlow * gone) * smoothstep(-uSunSize, uSunSize, h);
}
// The light of the sky at a place.
vec3 skylight(vec3 p) {
  float h = sunOver(p);
  return uSkyNight + uSkyDay * smoothstep(-0.2, 0.4, h) + uSkyDusk * exp(-pow((h - 0.03) / 0.24, 2.0));
}
// A thing's colour at a place, under so much of the sun (0 to 1: how squarely it faces it, and whether it is in
// shadow) and so much open sky (0 to 1).
vec3 lit(vec3 albedo, vec3 p, float sun, float sky) { return albedo * (sunlight(p) * sun + skylight(p) * (0.42 + 0.58 * sky)); }
// The wind at a place: it goes round the world, along the ground. xyz the way it blows, already as strong as it is.
vec3 windAt(vec3 p) { vec3 w = cross(uWind.xyz, normalize(p)); return w * uWind.w; }
// A place as the light is worked out for a thing that stands up from the ground. On a world this small the top of
// a tree sees a good way over the horizon, and would stand in full sun long after dark had come to its foot: so
// its light is worked out as if it stood a fifth as high. Its top still keeps the last red of the sun a little
// after the grass has lost it, and then it too is dark.
vec3 lowered(vec3 p) { float r = length(p); return p * ((uLand.y + (r - uLand.y) * 0.2) / r); }
// The light the ship throws on what is round it: warm, from its windows, its lanterns and the bulbs under its
// eaves. None under the ship itself; most a few paces out from its wall, and out of its open door; gone by
// twenty paces. (It is added after the night has taken the colour out of things: by lamplight they have theirs.)
vec3 shipGlow(vec3 p) {
  if (uGlow.w <= 0.0) return vec3(0.0);
  vec3 up = normalize(uGlow.xyz), to = p - uGlow.xyz; float high = dot(to, up); vec3 along = to - up * high; float d = length(along);
  float ring = smoothstep(1.4, 3.6, d) / (1.0 + d * d / 30.0) * (1.0 - smoothstep(12.0, 24.0, d));
  float door = pow(max(dot(along / max(d, 0.01), uGlowDoor), 0.0), 3.0);
  return vec3(1.0, 0.55, 0.2) * uGlow.w * ring * (0.7 + 1.1 * door) * (1.0 - smoothstep(5.0, 14.0, abs(high)));
}
// By night the eye loses its colours before it loses its sight: what is dim goes grey and a little blue, and
// darker than it was. much: how far a thing goes that way at full night (0 to 1); dim: how much of its light it keeps.
vec3 nightEye(vec3 c, vec3 p, float much, float dim) {
  float night = 1.0 - smoothstep(-0.24, 0.1, sunOver(p));
  return mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))) * vec3(0.6, 0.76, 1.0) * dim, night * much);
}
// The meadow's flowers grow in drifts, each drift mostly of one kind: how thick a drift is at a place (0 to 1:
// the land has its own say as well), and what colour its flowers are.
float flowerDrift(vec3 p) { return smoothstep(0.3, 0.55, aNoise3(p * 0.09 + 40.0)); }
// (own: a flower's own number, 0 to 1: at a drift's edge the kinds are mixed, and a stray grows anywhere)
vec3 flowerHue(vec3 p, float own) {
  float h = clamp((aNoise3(p * 0.035 + 70.0) - 0.28) / 0.44 + (own - 0.5) * 0.34, 0.0, 0.999) * 5.0;
  if (h < 1.0) return vec3(0.78, 0.76, 0.68);   // white, with a gold eye
  if (h < 2.0) return vec3(0.82, 0.62, 0.08);   // buttercup
  if (h < 3.0) return vec3(0.7, 0.1, 0.06);     // poppy
  if (h < 4.0) return vec3(0.22, 0.28, 0.74);   // cornflower
  return vec3(0.76, 0.38, 0.52);                // pink
}
// what stands over the ground in a direction (cover.js): r crown, g how high its top (over 24 m), b how near a tree
vec4 coverAt(vec3 d) { vec3 st = landST(d); return textureLod(tCover, (vec2(mod(st.z, 3.0), floor(st.z / 3.0)) + (1.0 + (st.xy * 0.5 + 0.5) * uCover.x) / (uCover.x + 2.0)) / vec2(3.0, 2.0), 0.0); }
// How much a place on the ground is in the shade of trees, 0 to 1: a line is walked from it toward the sun, and
// wherever a crown stands higher than the line is there, the place is shaded. (jit: 0 to 1, a different number for
// each dot of the picture, so that twelve looks along the line do the work of many.)
float treeShade(vec3 p, float jit) {
  vec3 up = normalize(p); float sinE = dot(up, uSun);
  if (sinE <= 0.0) return 0.0;
  float tanE = sinE / sqrt(max(1.0 - sinE * sinE, 1e-4)), reach = min(22.0 / max(tanE, 0.02), 64.0), shade = 0.0;
  vec3 along = normalize(uSun - up * sinE);
  for (int i = 0; i < 12; i++) {
    float s = reach * (float(i) + jit) / 12.0;
    vec4 c = coverAt(normalize(p + along * s));
    shade = max(shade, c.r * (1.0 - smoothstep(c.g * 24.0 - 2.0, c.g * 24.0, s * tanE)));
  }
  return shade * smoothstep(0.0, 0.1, sinE);
}
// The meadow's colour at a place: at the foot of its grass, and at the tips. It follows the land, as grass does,
// broadly and gently: fresh green on the low ground, yellower as the ground rises, straw on the heights; a shade
// deeper only in the great hollow, and under the trees. It is a light, sunny meadow everywhere: nothing in it is
// dark. So what is seen from above is the lie of the land, and not paint laid on at random.
// h: how high the ground is there (metres); hollow: 0 a crest to 1 a hollow; cover: what stands over it.
void meadow(vec3 p, float h, float hollow, vec4 cover, out vec3 root, out vec3 tip) {
  // (the lie of the land as one number, its edges a little ragged)
  float lie = h * 0.16 + (0.5 - hollow) * 0.5 + (aNoise3(p * 0.09 + 31.0) - 0.5) * 0.3 + (aNoise3(p * 0.035 + 3.0) - 0.5) * 0.4;
  tip = mix(uG1, uG2, smoothstep(-0.7, 0.8, lie));
  tip = mix(tip, uG3, smoothstep(0.9, 1.7, lie) * 0.42);
  tip = mix(tip, uG4, (1.0 - smoothstep(-1.15, -0.55, lie)) * 0.28);
  tip = mix(tip, uG4 * 0.95, min(cover.b, 1.0) * 0.3);
  root = tip * vec3(0.2, 0.42, 0.5);
}
`;

// The cells a surface is cut into (for cracks in bark, facets of rock): how far to the nearest wall, three numbers
// that are the cell's own, and where its middle is.
export const CELLS = /* glsl */ `
vec3 cHash3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
void cells3(vec3 p, out float edge, out vec3 id, out vec3 centre) {
  vec3 n = floor(p), f = fract(p), mg = vec3(0.0), mr = vec3(0.0); float md = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k)), r = g + cHash3(n + g) - f; float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = mg + vec3(float(i), float(j), float(k)), r = g + cHash3(n + g) - f, dr = r - mr;
    if (dot(dr, dr) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(dr)));
  }
  edge = md; id = cHash3(n + mg + 17.0); centre = mr;
}
`;

// The edge of a shadow. The sun is wide in this sky (a fifth of a hand at arm's length would not cover it), so a
// shadow has no hard edge: a thing a pace from a wall throws one a hand's breadth soft, and a nail, a wire or the
// joint between two boards throws none that can be seen. That is also what keeps shadows still. The sun moves
// fast here, the shadows' picture is drawn afresh every frame from a new side, and anything in it finer than one
// of its dots is caught in one frame and missed in the next: spread wide, with many looks at it, that averages
// away. A surface the light only grazes is given more room (aSlope), or the wider look would find it in its own shade.
const SOFT = (taps) => /* glsl */ `
uniform vec2 uShadowSoft;
float aSlope = 0.0;
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
float softShadow(sampler2DShadow map, vec2 size, float bias, vec4 c) {
  c.xyz /= c.w; c.z += bias - uShadowSoft.y * aSlope;
  // (outside the shadows' picture there is no shadow)
  bool inside = c.x >= 0.0 && c.x <= 1.0 && c.y >= 0.0 && c.y <= 1.0 && c.z <= 1.0;
  float phi = interleavedGradientNoise(gl_FragCoord.xy) * PI2, r = uShadowSoft.x / size.x, s = 0.0;
  for (int i = 0; i < ${taps}; i++) s += texture(map, vec3(c.xy + vogelDiskSample(i, ${taps}, phi) * r, c.z));
  return inside ? s / ${taps}.0 : 1.0;
}
#endif
`;
const SHADOW_CALL = 'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )';
if (!THREE.ShaderChunk.lights_fragment_begin.includes(SHADOW_CALL)) console.warn('shadows: three.js has changed how it asks for a shadow; they are drawn its way, with harder edges');
const LIGHTS = THREE.ShaderChunk.lights_fragment_begin.replace(SHADOW_CALL, 'softShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, vDirectionalShadowCoord[ i ] )');

/**
 * A MeshLambertMaterial used only for what three.js knows how to do (shadows, and being drawn into them): in its
 * fragment shader, outgoingLight.g is how much of the sun reaches the place past whatever stands near, 0 to 1.
 * The painting is ours. taps: how many looks are taken at the shadows' picture for each dot drawn (more is smoother,
 * and dearer).
 */
export function shadowed(air, { side = THREE.FrontSide, vertexPars = '', vertex = '', fragmentPars = '', fragment = '', key, alphaToCoverage = false, own = null, taps = 8 }) {
  const m = new THREE.MeshLambertMaterial({ side, alphaToCoverage });
  m.onBeforeCompile = (s) => {
    air.share(s);
    if (own) Object.assign(s.uniforms, own);
    s.vertexShader = AIR + vertexPars + '\n' + s.vertexShader.replace('#include <begin_vertex>', vertex);
    s.fragmentShader = AIR + fragmentPars + '\n' + s.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n' + SOFT(taps))
      .replace('#include <lights_fragment_begin>', LIGHTS)
      // (how steeply the light grazes this surface: 0 square on, to 6)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  { float aC = dot(normal, directionalLights[0].direction); aSlope = min(sqrt(max(1.0 - aC * aC, 0.0)) / max(aC, 0.05), 6.0); }\n  normal = directionalLights[0].direction;')
      .replace('#include <opaque_fragment>', fragment);
  };
  m.customProgramCacheKey = () => `${key}:${taps}`;
  return m;
}
