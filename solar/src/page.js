// How the painted world is finally seen.
//
//   1. The air. A world has a thin shell of air round it, thickest at the ground. Along every line of sight the
//      light that the air throws toward the eye is added up, and what lies behind is dimmed by the air in front of
//      it. That one sum is the whole sky: blue overhead by day; a band of orange and rose at the edge of day,
//      because the sun's light has come a long way through air to get there; a thin bright rim round the world
//      seen from outside; and black once one has risen out of it. Nothing is switched between the ground and
//      space: the eye simply has less and less air above it.
//      The sun is wide in this sky, so its light does not end at a line on the world but fades over a broad band,
//      and the world's own shadow in its air has a soft edge.
//      One liberty is taken. A shell of air this thin, thick enough to make a sky, would hide a tree at thirty
//      metres in blue fog. So between the eye and anything near, the air is counted at a fifth, coming up to its
//      full thickness for what is far off (the world seen from above) and for the sky itself.
//   2. Bright things glow a little into what is round them.
//   3. It is brought into the range a screen can show, kept rich in colour, and the corners are let fall away.
import * as THREE from 'three';

const QUAD = /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** The air of a world: how high it reaches, how fast it thins, and what it does to light. */
export const AIR_OF = {
  top: 46,       // metres over the ground where it is counted as ended
  thin: 6,       // it is 1/e as thick for every so many metres up: it lies close to the ground, so that overhead
                 // the sky is dark and toward the horizon, where one looks along it, it is bright
  mist: 3,       // the same for the haze that lies in it
  // how much of each colour a metre of air at the ground scatters (blue far more than red)
  scatter: new THREE.Vector3(0.0075, 0.018, 0.044),
  haze: 0.0055,
  // what the haze takes out of light passing through it, and gives nothing back for: it is what reddens a low sun
  dust: new THREE.Vector3(0.004, 0.03, 0.066),
  sun: 4.6,      // how bright the sun is to the air
};

let wipe = null;
export function createPage(renderer, land) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const scene = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  scene.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
  const print = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: {
      tDrawn: { value: scene.texture }, tDepth: { value: scene.depthTexture }, uSize: { value: size.clone() },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uEye: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
      uR: { value: land.radius }, uTop: { value: land.radius + AIR_OF.top }, uThin: { value: new THREE.Vector2(AIR_OF.thin, AIR_OF.mist) },
      uScatter: { value: AIR_OF.scatter }, uHaze: { value: AIR_OF.haze }, uDust: { value: AIR_OF.dust }, uPx: { value: 0.001 }, uSunPower: { value: AIR_OF.sun }, uSunSize: { value: 0.17 },
      uAir: { value: 1 }, uExposure: { value: 1 }, uSunDim: { value: new THREE.Vector3(1, 1, 1) }, uStars: { value: new THREE.Matrix3() }, uNow: { value: 0 },
      // how hot whoever is looking is (0 to 1: the picture swims, fire comes in from its edges, sparks go by), and how far gone (0 to 1: all of it to white gold)
      uHeat: { value: 0 }, uBurn: { value: 0 },
      // (1 while one side of the dome's cube is drawn: nothing that belongs to the screen's edges or middle, or it would show at the sides' seams)
      uFlat: { value: 0 },
      // (single-view dome: the picture is already a fisheye; each pixel's direction comes from the lens, and the
      // depth is the distance, linear from near to far: see domewarp.js)
      uSingle: { value: 0 }, uDomeF: { value: new THREE.Vector3(0, 1, 0) }, uDomeU: { value: new THREE.Vector3(0, 0, 1) }, uDomeR: { value: new THREE.Vector3(1, 0, 0) },
      uDomeTmax: { value: Math.PI / 2 }, uNF: { value: new THREE.Vector2(0.1, 2000) },
      // the sun in the picture (xy: where, 0 to 1; z: how wide its half is, in picture heights), and how much its light is seen in the air as beams
      uSunUV: { value: new THREE.Vector3(0.5, 0.5, 0.14) }, uShaft: { value: 0 },
    },
    vertexShader: QUAD,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tDrawn; uniform sampler2D tDepth; uniform vec2 uSize; uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec3 uEye; uniform vec3 uSun;
      uniform float uR; uniform float uTop; uniform vec2 uThin; uniform vec3 uScatter; uniform float uHaze; uniform vec3 uDust; uniform float uPx; uniform float uSunPower; uniform float uSunSize; uniform float uAir; uniform float uExposure; uniform vec3 uSunDim; uniform mat3 uStars; uniform float uNow;
      uniform float uHeat; uniform float uBurn; uniform vec3 uSunUV; uniform float uShaft; uniform float uFlat;
      uniform float uSingle; uniform vec3 uDomeF; uniform vec3 uDomeU; uniform vec3 uDomeR; uniform float uDomeTmax; uniform vec2 uNF;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      const float PI = 3.14159265;
      // where a line from o along d meets a ball of radius r about the middle: (in, out), or in > out if it misses
      vec2 ball(vec3 o, vec3 d, float r) { float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c; if (h < 0.0) return vec2(1.0, -1.0); h = sqrt(h); return vec2(-b - h, -b + h); }
      // how thick the air (x) and its haze (y) are at a place
      vec2 thick(vec3 p) { float h = max(length(p) - uR, 0.0); return max(exp(-h / uThin) - exp(-(uTop - uR) / uThin), 0.0); }
      // how much air and haze lie between a place and the sun
      vec2 toSun(vec3 p) {
        float far = ball(p, uSun, uTop).y; vec2 sum = vec2(0.0);
        for (int i = 0; i < 4; i++) sum += thick(p + uSun * far * (float(i) + 0.5) * 0.25);
        return sum * far * 0.25;
      }
      // How much of the sun a place in the air can see past the world itself: the world's shadow, with the soft
      // edge a wide sun gives it (wider the further behind the world the place is).
      float sunPast(vec3 p) {
        float b = dot(p, uSun);
        if (b > 0.0) return 1.0;
        float miss = sqrt(max(dot(p, p) - b * b, 0.0)), soft = max(1.5, uSunSize * -b);
        return smoothstep(uR - soft, uR + soft, miss);
      }

      // --- the stars ---
      vec3 h33(vec3 p) { return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
      float n3(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        float a = h33(i).x, b = h33(i + vec3(1, 0, 0)).x, c = h33(i + vec3(0, 1, 0)).x, d = h33(i + vec3(1, 1, 0)).x, e = h33(i + vec3(0, 0, 1)).x, f1 = h33(i + vec3(1, 0, 1)).x, g = h33(i + vec3(0, 1, 1)).x, h = h33(i + vec3(1, 1, 1)).x;
        return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
      }
      // The sky is laid out as six square sheets (one to each side of a cube round the eye), each cut into cells,
      // and some cells hold a star: so every star is whole, wherever it falls.
      vec3 sheetOf(vec3 d) {
        vec3 a = abs(d); float f; vec2 q;
        if (a.x >= a.y && a.x >= a.z) { f = d.x > 0.0 ? 0.0 : 1.0; q = (d.x > 0.0 ? vec2(-d.z, d.y) : vec2(d.z, d.y)) / a.x; }
        else if (a.y >= a.z) { f = d.y > 0.0 ? 2.0 : 3.0; q = (d.y > 0.0 ? vec2(d.x, -d.z) : vec2(d.x, d.z)) / a.y; }
        else { f = d.z > 0.0 ? 4.0 : 5.0; q = (d.z > 0.0 ? vec2(d.x, d.y) : vec2(-d.x, d.y)) / a.z; }
        return vec3(q, f);
      }
      vec3 onSheet(float f, vec2 q) {
        if (f < 0.5) return normalize(vec3(1.0, q.y, -q.x)); if (f < 1.5) return normalize(vec3(-1.0, q.y, q.x));
        if (f < 2.5) return normalize(vec3(q.x, 1.0, -q.y)); if (f < 3.5) return normalize(vec3(q.x, -1.0, q.y));
        if (f < 4.5) return normalize(vec3(q.x, q.y, 1.0)); return normalize(vec3(-q.x, q.y, -1.0));
      }
      // px: how wide one pixel is, as an angle
      vec3 starLayer(vec3 d, vec3 sheet, float cells, float chance, float size, float bright, float px) {
        vec2 p = (sheet.xy * 0.5 + 0.5) * cells, id = floor(p); vec3 sum = vec3(0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 c = id + vec2(float(i), float(j));
          if (c.x < 0.0 || c.y < 0.0 || c.x >= cells || c.y >= cells) continue;
          vec3 h = h33(vec3(c, sheet.z * 19.0 + cells)), k = h33(vec3(c + 71.0, sheet.z * 7.0 + cells));
          vec3 at = onSheet(sheet.z, ((c + 0.22 + 0.56 * k.xy) / cells) * 2.0 - 1.0);
          // (more of them near the band)
          float band = exp(-pow(dot(at, vec3(0.34, 0.86, 0.38)) / 0.19, 2.0));
          if (h.x > chance * (0.45 + 2.2 * band)) continue;
          float ang = acos(clamp(dot(d, at), -1.0, 1.0)), mag = pow(h.y, 7.0);
          // a point of light: never smaller than a pixel (it would flicker); the few bright ones a little wider, with a faint glow
          float r = max(size * (0.7 + 1.3 * mag), px * 0.7), core = exp(-pow(ang / r, 2.0)) * (0.16 + 3.4 * mag) * bright * min(1.0, size / (px * 0.7));
          // (but not round one in a cell at its sheet's edge: the next sheet does not know of it, and the glow would end at a line)
          if (c.x >= 1.0 && c.y >= 1.0 && c.x < cells - 1.0 && c.y < cells - 1.0) core += exp(-ang / (r * 2.6)) * mag * mag * bright * 0.3;
          vec3 tint = mix(vec3(0.74, 0.84, 1.0), vec3(1.0, 0.8, 0.58), smoothstep(0.35, 0.95, h.z));
          sum += tint * core * (0.9 + 0.1 * sin(uNow * (0.5 + 2.0 * h.z) + h.x * 40.0));
        }
        return sum;
      }
      vec3 stars(vec3 d, float px) {
        vec3 sheet = sheetOf(d);
        vec3 col = starLayer(d, sheet, 44.0, 0.34, 0.00075, 0.6, px) + starLayer(d, sheet, 17.0, 0.3, 0.0011, 1.0, px) + starLayer(d, sheet, 6.0, 0.22, 0.0015, 1.9, px);
        // the band they are thickest along: only the faintest light, a shade warmer at its heart
        float lat = dot(d, vec3(0.34, 0.86, 0.38)), river = exp(-pow(lat / 0.16, 2.0));
        float cloud = n3(d * 3.1 + 4.0) * 0.6 + n3(d * 7.3 - 2.0) * 0.4;
        col += mix(vec3(0.012, 0.016, 0.03), vec3(0.036, 0.03, 0.036), river) * river * (0.2 + 1.3 * cloud * cloud);
        return col;
      }
      void main() {
        // (in great heat nothing is seen straight: the picture swims, as over a fire)
        vec2 uv = vUv;
        if (uHeat > 0.001 && uFlat < 0.5) uv += uHeat * uHeat * 0.0045 * vec2(sin(vUv.y * 61.0 + uNow * 6.3) + sin(vUv.y * 23.0 - uNow * 4.1), cos(vUv.x * 47.0 + uNow * 5.2) + sin(vUv.x * 19.0 + uNow * 3.3));
        vec4 drawn = textureLod(tDrawn, uv, 0.0);
        vec3 c = drawn.rgb;
        float depth = textureLod(tDepth, uv, 0.0).r;
        vec3 view, rd;
        bool open = depth > 0.9999999;
        float dist;
        if (uSingle > 0.5) {
          vec2 p = uv * 2.0 - 1.0; float r = length(p);
          if (r > 1.02) { outC = vec4(0.0, 0.0, 0.0, 1.0); return; }
          float th = min(r, 1.0) * uDomeTmax, ph = atan(p.y, p.x);
          vec3 dv = sin(th) * (cos(ph) * uDomeR + sin(ph) * uDomeU) + cos(th) * uDomeF;
          dist = open ? 1e9 : uNF.x + depth * (uNF.y - uNF.x);
          view = dv * min(dist, 1e6); rd = normalize(mat3(uCamWorld) * dv);
        } else {
          vec4 vp = uInvProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          view = vp.xyz / vp.w; rd = normalize(mat3(uCamWorld) * view);
          dist = open ? 1e9 : length(view);
        }
        // (the stars are wherever nothing solid was drawn; the sun's glow is not solid, but puts out those near it)
        vec3 starry = open && drawn.a < 0.999 ? stars(uStars * rd, uPx) * (1.0 - drawn.a) * (1.0 - smoothstep(0.0, 0.25, max(c.r, c.g))) : vec3(0.0);
        // --- the air ---
        vec2 shell = ball(uEye, rd, uTop);
        float t0 = max(shell.x, 0.0), t1 = min(shell.y, dist);
        // (a line that would go through the world stops at its ground, whether or not anything was drawn there)
        vec2 core = ball(uEye, rd, uR - 12.0);
        if (core.x > 0.0 && core.y > core.x) t1 = min(t1, core.x);
        if (uAir > 0.0 && t1 > t0) {
          const int STEPS = 16;
          float dt = (t1 - t0) / float(STEPS), jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float mu = dot(rd, uSun), phaseAir = 0.0596831 * (1.0 + mu * mu), g = 0.74, phaseHaze = 0.0795775 * (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
          // (see the note at the top: what is near is seen through little of the air)
          float nearby = open ? 1.0 : mix(0.2, 1.0, smoothstep(50.0, 520.0, dist));
          vec2 along = vec2(0.0); vec3 lightAir = vec3(0.0), lightHaze = vec3(0.0), second = vec3(0.0);
          for (int i = 0; i < STEPS; i++) {
            vec3 p = uEye + rd * (t0 + (float(i) + jit) * dt);
            vec2 here = thick(p) * dt * nearby;
            along += here * 0.5;
            float seen = sunPast(p);
            if (seen > 0.001) {
              vec2 sunward = toSun(p);
              vec3 left = exp(-uScatter * (along.x + sunward.x) - (uHaze + uDust) * (along.y + sunward.y));
              lightAir += left * here.x * seen; lightHaze += left * here.y * seen;
            }
            // (light that has already been scattered once lights the air again: without it the edge of night is too black)
            second += exp(-uScatter * along.x - (uHaze + uDust) * along.y) * here.x * smoothstep(-0.45, 0.25, dot(normalize(p), uSun));
            along += here * 0.5;
          }
          vec3 dim = exp(-uScatter * along.x - (uHaze + uDust) * along.y);
          vec3 glow = uSunPower * (lightAir * uScatter * phaseAir + lightHaze * uHaze * phaseHaze) + second * uScatter * vec3(0.4, 0.55, 1.0) * 0.8;
          // stars do not show through a bright sky
          starry *= 1.0 - smoothstep(0.01, 0.16, dot(glow, vec3(0.3, 0.5, 0.2)));
          c = (c + starry) * mix(vec3(1.0), dim, uAir) + glow * uAir;
          starry = vec3(0.0);
        }
        c += starry;
        // --- beams --- (PARKED, 2026-11-17: tried and found too much. uShaft is left at nothing, so none of this is done.)
        // Where the sun is part hidden (by a tree's crown, by the ship, by a window's post) what gets past is seen
        // in the air as beams, fanning out from it. From each dot of the picture a line is walked toward the sun,
        // and what of the sun's own disc is found along it, unhidden, is what lights the air there.
        if (uShaft > 0.001 && uFlat < 0.5) {
          vec2 asp = vec2(uSize.x / uSize.y, 1.0), toSun = uSunUV.xy - vUv;
          float far = length(toSun * asp), beam = 0.0, jitB = fract(52.9829189 * fract(dot(gl_FragCoord.xy + 31.0, vec2(0.06711056, 0.00583715))));
          for (int i = 0; i < 28; i++) {
            vec2 q = vUv + toSun * ((float(i) + jitB) / 28.0);
            float fromSun = length((q - uSunUV.xy) * asp) / uSunUV.z;
            float seen = smoothstep(1.0, 2.8, dot(textureLod(tDrawn, q, 3.0).rgb, vec3(0.3, 0.5, 0.2)));
            beam += seen * (1.0 - smoothstep(0.85, 1.25, fromSun)) * step(0.0, min(min(q.x, q.y), min(1.0 - q.x, 1.0 - q.y)));
          }
          // (more of them the further one looks through the air; none on what is within arm's reach)
          float through = open ? 1.0 : smoothstep(1.5, 45.0, dist);
          c += vec3(1.0, 0.74, 0.44) * uSunDim * (beam / 28.0) * exp(-far * 1.3) * uShaft * 2.6 * through;
        }
        // --- glow ---
        vec3 bloom = vec3(0.0);
        for (int i = 2; i <= 6; i++) bloom += max(textureLod(tDrawn, vUv, float(i)).rgb - 1.1, 0.0) * (i < 4 ? 0.1 : 0.16);
        // (it is the sun's, nearly all of it: so it is dimmed as the sun is by the air it is seen through)
        c += bloom * 0.45 * uSunDim;
        // --- burning: fire in from the edges of the picture, in tongues, and sparks streaming out past the eye ---
        if (uHeat > 0.001 && uFlat < 0.5) {
          vec2 e = (vUv - 0.5) * vec2(1.0, 0.82); float far = length(e), ang = atan(e.y, e.x);
          float edge = pow(clamp(far * 1.6, 0.0, 1.0), 2.3), lick = 0.5 + 0.5 * sin(ang * 9.0 + uNow * 3.1 + 2.0 * sin(ang * 4.0 - uNow * 1.7));
          vec3 fire = mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.76, 0.34), uHeat);
          c += fire * uHeat * uHeat * (edge * (0.5 + 1.9 * lick * uHeat) * 2.4 + 0.3 * uHeat);
          for (int k = 0; k < 2; k++) {
            float fk = float(k);
            vec2 pc = vec2((ang / 6.2831853 + 0.5) * (46.0 + 24.0 * fk), far * (7.0 + 4.0 * fk) - uNow * (1.3 + 0.8 * fk));
            vec2 id = floor(pc), f = fract(pc) - 0.5; float h = fract(sin(dot(id, vec2(127.1, 311.7)) + fk * 17.0) * 43758.5453);
            float d = length(vec2(f.x + (fract(h * 7.3) - 0.5) * 0.5, f.y * 0.3));
            c += vec3(1.0, 0.62, 0.22) * step(1.0 - 0.3 * uHeat, h) * smoothstep(0.1, 0.0, d) * 5.0 * uHeat * smoothstep(0.1, 0.34, far);
          }
        }
        // --- seen ---
        c *= uExposure * (1.0 + 1.6 * uHeat * uHeat * uHeat);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= (1.0 + l / 9.0) / (1.0 + l * 0.62);
        l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.14);
        // (what is still brighter than the screen's white keeps its colour and goes white only by degrees: a low
        // sun stays orange, and only the sun at noon is white)
        float top = max(c.r, max(c.g, c.b));
        if (top > 1.0) c = mix(c / top, vec3(1.0), 1.0 - exp(-(top - 1.0) * 0.15));
        c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
        // a little more depth in the darks, and the corners eased
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.2);
        c *= 1.0 - 0.28 * pow(length(vUv - 0.5) * 1.25, 3.0) * (1.0 - uFlat);
        // (the end: everything goes to white gold, from the middle out; and one comes back out of it the same way)
        if (uBurn > 0.001) c = mix(c, mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.97, 0.9), uBurn), clamp(uBurn * 1.5 - 0.5 * length(vUv - 0.5) * (1.0 - uFlat), 0.0, 1.0));
        // (too little to see, enough that a smooth sky is not laid down in bands)
        c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy + 17.0, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
        outC = vec4(c, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), print);
  quad.frustumCulled = false;
  const stage = new THREE.Scene();
  stage.add(quad);
  const flat = new THREE.Camera(), flatM = new THREE.Matrix4(), at = new THREE.Vector3();
  // how much of each colour the air lets through from the sun to the eye
  const sunThrough = (eye, sun, out) => {
    const R = land.radius, top = R + AIR_OF.top, b = eye.dot(sun), c = eye.lengthSq() - top * top, h = b * b - c;
    if (h <= 0) return out.set(1, 1, 1);
    const t0 = Math.max(-b - Math.sqrt(h), 0), t1 = -b + Math.sqrt(h);
    if (t1 <= t0) return out.set(1, 1, 1);
    let air = 0, mist = 0;
    const n = 24, dt = (t1 - t0) / n, endA = Math.exp(-AIR_OF.top / AIR_OF.thin), endM = Math.exp(-AIR_OF.top / AIR_OF.mist);
    for (let i = 0; i < n; i++) {
      const high = Math.max(at.copy(eye).addScaledVector(sun, t0 + (i + 0.5) * dt).length() - R, 0);
      air += Math.max(Math.exp(-high / AIR_OF.thin) - endA, 0) * dt; mist += Math.max(Math.exp(-high / AIR_OF.mist) - endM, 0) * dt;
    }
    const S = AIR_OF.scatter, D = AIR_OF.dust, H = AIR_OF.haze;
    return out.set(Math.exp(-S.x * air - (H + D.x) * mist), Math.exp(-S.y * air - (H + D.y) * mist), Math.exp(-S.z * air - (H + D.z) * mist));
  };
  return {
    uniforms: print.uniforms,
    resize() {
      renderer.getDrawingBufferSize(size);
      scene.setSize(size.x, size.y);
      print.uniforms.uSize.value.copy(size);
    },
    /** Draw at a size other than the screen's (the dome's cube sides). */
    fit(w, h) {
      size.set(w, h);
      scene.setSize(w, h);
      print.uniforms.uSize.value.copy(size);
    },
    /**
     * behind: what lies too far off to be a place (the sun, stars, far worlds) and the camera to see it with.
     * worlds: [{ scene, camera }] each world that is a place, with the eye where it is in that world's own frame
     * (so every world is drawn as if it were the one underfoot, and all share one depth). inside: { scene, camera }
     * what is within the ship, or nothing. airCamera: the eye in the frame of the world that has air. sun: the way
     * to the sun in that frame. turn: how that world is turned against the stars. out: where the finished picture
     * goes ({ target, face, flat }), or the screen.
     */
    render(behind, behindCamera, worlds, inside, airCamera, sun, turn, now = 0, out = null) {
      wipe ??= new THREE.MeshBasicMaterial({ colorWrite: false, depthFunc: THREE.AlwaysDepth });
      const u = print.uniforms, camera = worlds[0].camera;
      u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uCamWorld.value.copy(airCamera.matrixWorld); u.uEye.value.copy(airCamera.position); u.uSun.value.copy(sun);
      if (turn) u.uStars.value.setFromMatrix4(flatM.makeRotationFromQuaternion(turn));
      u.uNow.value = now;
      u.uFlat.value = out?.flat ? 1 : 0;
      const one = out?.single;
      u.uSingle.value = one ? 1 : 0;
      if (one) { u.uDomeF.value.copy(one.F); u.uDomeU.value.copy(one.U); u.uDomeR.value.copy(one.R); u.uDomeTmax.value = one.tmax; u.uNF.value.set(camera.near, camera.far); }
      sunThrough(airCamera.position, sun, u.uSunDim.value);
      u.uPx.value = one ? (2 * one.tmax) / size.y : (2 * Math.tan((camera.fov * Math.PI) / 360)) / size.y;
      renderer.setRenderTarget(scene);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      // (a world that is behind the sun, as the eye has it, is drawn first, and the sun over it: the worlds do not
      // share their depth with what is far off, so which is in front is settled by the order they are drawn in)
      let early = false;
      for (const w of worlds) if (w.behindSun) { renderer.render(w.scene, w.camera); early = true; }
      if (early) renderer.clearDepth();
      renderer.render(behind, behindCamera);
      renderer.clearDepth();
      for (const w of worlds) if (!w.behindSun) renderer.render(w.scene, w.camera);
      if (inside) {
        // (what is within arm's reach is drawn into the nearest sliver of depth: it hides the worlds, and they keep theirs)
        const gl = renderer.getContext();
        // (its shadows are the ones just thrown, with everything there to throw them)
        const shadow = inside.lamp?.shadow, was = shadow?.autoUpdate;
        if (shadow) { shadow.autoUpdate = false; shadow.needsUpdate = false; }
// (first, wherever the ship is solid, the depth the worlds' eye left is put back to the sliver's far end: that
        // eye's near plane cuts through the room, and the cut's edge would otherwise show through as a dark band)
        const mask = inside.camera.layers.mask, bg = inside.scene.background;
        inside.camera.layers.set(2); inside.scene.overrideMaterial = wipe; inside.scene.background = null;
        gl.depthRange(0.25, 0.25);
        renderer.render(inside.scene, inside.camera);
        inside.camera.layers.mask = mask; inside.scene.overrideMaterial = null; inside.scene.background = bg;
        gl.depthRange(0, 0.25);
        renderer.render(inside.scene, inside.camera);
        gl.depthRange(0, 1);
        if (shadow) shadow.autoUpdate = was;
      }
      // where the sun is in the picture (if it is before the eye at all)
      at.copy(sun).multiplyScalar(1e6).add(airCamera.position).applyMatrix4(airCamera.matrixWorldInverse);
      if (at.z < 0) {
        at.applyMatrix4(camera.projectionMatrix);
        u.uSunUV.value.set(at.x * 0.5 + 0.5, at.y * 0.5 + 0.5, Math.tan(Math.asin(u.uSunSize.value)) / Math.tan((camera.fov * Math.PI) / 360) / 2);
      } else u.uSunUV.value.set(-9, -9, 0.1);
      renderer.setRenderTarget(out?.target ?? null, out?.face ?? 0);
      renderer.render(stage, flat);
    },
  };
}
