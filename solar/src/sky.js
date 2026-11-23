// What lies beyond the world one is on: the sun and the other worlds, each where it really is. (The stars are
// drawn by the page itself, wherever nothing else is: see page.js.)
//
// These are drawn in the frame of the world underfoot, which turns: so the stars wheel, the sun rises and sets,
// and the moon and the far world cross the sky and show their phases, with no one moving them by hand.
// (The air of one's own world is laid over all of this afterwards, in page.js: it reddens the low sun and puts out
// the stars by day.)
import * as THREE from 'three';

const NOISE = /* glsl */ `
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec3 h33(vec3 p) { return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

export function createSky(system) {
  const scene = new THREE.Scene(), B = system.bodies;

  // --- the sun: a disc brighter than anything, darker toward its rim, in a soft light of its own ---
  const sun = new THREE.Mesh(new THREE.SphereGeometry(B.sun.radius, 48, 24), new THREE.ShaderMaterial({
    uniforms: { uNow: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uNow;
      ${NOISE}
      void main() {
        float face = max(dot(normalize(vN), normalize(vV)), 0.0);
        // its surface is not even: slow cells of brighter and duller fire
        float cells = fbm(normalize(vP) * 5.0 + uNow * 0.012);
        vec3 col = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.82, 0.5), pow(face, 0.5)) * (4.3 + 1.1 * pow(face, 0.6)) * (0.88 + 0.24 * cells);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  // (its light: a glow that faces the eye, much wider than the disc)
  // (in many pieces: the dome's single-view warp bends what it draws, and a glow this wide needs points along it to bend)
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 24, 24), new THREE.ShaderMaterial({
    // (added to what is there, and leaving alone the mark of whether anything solid is: the stars show through it)
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */ `varying vec2 vC; void main() { vC = position.xy * 2.0; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * ${(B.sun.radius * 9).toFixed(1)}; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying vec2 vC; void main() { float r = length(vC) * 4.5; float o = max(r - 0.99, 0.0); float g = 0.8 * exp(-o / 0.07) + 0.5 * exp(-o / 0.24) + 0.13 * exp(-o / 0.6) + 0.022 * exp(-o / 1.6); gl_FragColor = vec4(mix(vec3(1.0, 0.58, 0.32), vec3(1.0, 0.64, 0.29), exp(-o / 0.3)) * g * smoothstep(0.96, 0.995, r) * (1.0 - smoothstep(3.0, 4.5, r)), 0.0); }`,
  }));
  corona.frustumCulled = false;
  corona.renderOrder = 5;
  sun.add(corona);
  scene.add(sun);

  // --- other worlds, seen from far off: a painted ball, lit by the sun from where the sun really is ---
  const worldBall = (body, { seas, lands, cloud, rock, air }) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 96, 48), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) }, uSunSize: { value: 0.1 }, uSeas: { value: new THREE.Color(seas) }, uLands: { value: new THREE.Color(lands) }, uCloud: { value: new THREE.Color(cloud) }, uRock: { value: rock ? 1 : 0 }, uAir: { value: new THREE.Color(air ?? '#000000') }, uNow: { value: 0 } },
      vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main() { vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform vec3 uSun; uniform float uSunSize; uniform vec3 uSeas; uniform vec3 uLands; uniform vec3 uCloud; uniform float uRock; uniform vec3 uAir; uniform float uNow;
        ${NOISE}
        void main() {
          vec3 d = normalize(vP), n = normalize(vN);
          vec3 alb;
          if (uRock > 0.5) {
            // a moon: grey ground, darker plains, and the pale rims of old craters
            float plains = smoothstep(0.42, 0.6, fbm(d * 2.1 + 1.0));
            alb = mix(uLands, uSeas, plains) * (0.85 + 0.3 * fbm(d * 9.0));
            vec3 q = d * 6.0, id = floor(q), c = normalize(id + 0.2 + 0.6 * h33(id)); float a = acos(clamp(dot(d, c), -1.0, 1.0)) * 6.0, r = 0.12 + 0.2 * h3(id + 7.0);
            alb *= 1.0 + 0.3 * (smoothstep(r * 0.75, r, a) - smoothstep(r, r * 1.25, a)) - 0.16 * (1.0 - smoothstep(0.0, r, a));
          } else {
            // a living world: lands and seas in broad brushed shapes, and weather over them
            float land = smoothstep(0.47, 0.53, fbm(d * 1.9 + 5.0) + 0.08 * fbm(d * 9.0));
            alb = mix(uSeas * (0.8 + 0.3 * fbm(d * 5.0)), uLands * (0.7 + 0.6 * fbm(d * 4.0 + 3.0)), land);
            float weather = smoothstep(0.5, 0.68, fbm(d * 3.3 + vec3(uNow * 0.004, 0.0, 0.0)) + 0.15 * fbm(d * 12.0));
            alb = mix(alb, uCloud, weather * 0.92);
          }
          // lit across a broad edge of day (the sun is wide), warm where the light is low
          float h = dot(n, uSun), day = smoothstep(-uSunSize, uSunSize * 2.2, h);
          vec3 light = vec3(1.25, 1.12, 0.92) * mix(mix(vec3(1.0, 0.42, 0.2), vec3(1.0), uRock), vec3(1.0), smoothstep(0.0, 0.45, h)) * day * (0.35 + 0.65 * max(h, 0.0));
          vec3 col = alb * (light + vec3(0.012, 0.016, 0.03));
          // its own air: a rim of light on the day side, bright against the dark of space
          float rim = pow(1.0 - max(dot(n, vV), 0.0), 3.5);
          col += uAir * rim * (0.15 + 1.5 * smoothstep(-0.25, 0.5, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    scene.add(m);
    return m;
  };
  // (the moon is not here: it is a place, drawn as one, wherever it is seen from)
  const far = worldBall(B.far, { seas: '#1c4a78', lands: '#b88a58', cloud: '#efe6d6', air: '#5f9cff' });

  const p = new THREE.Vector3();
  return {
    scene,
    /** Puts everything where it is, as seen from the ground of `from` (a body), for an eye at `eye` in that body's frame. */
    update(from, eye, now) {
      sun.material.uniforms.uNow.value = now;
      system.seenFrom(from, B.sun, sun.position);
      for (const [mesh, body] of [[far, B.far]]) {
        system.seenFrom(from, body, mesh.position, mesh.quaternion);
        // (the way from it to the sun, and how wide the sun is from there)
        p.copy(sun.position).sub(mesh.position);
        const d = p.length();
        mesh.material.uniforms.uSun.value.copy(p).divideScalar(d);
        mesh.material.uniforms.uSunSize.value = B.sun.radius / d;
        mesh.material.uniforms.uNow.value = now;
      }
    },
    /** The way to the sun from the middle of the frame, as a unit vector. */
    sunDir: (out) => out.copy(sun.position).normalize(),
  };
}
