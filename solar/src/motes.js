// What is in the air of the home world, near the eye.
//
// By day, and most of all at dusk: seeds and pollen, drifting on the wind. They are nothing in themselves; they are
// what the low sun shows up, bright when one looks toward it through them and all but gone with one's back to it.
// By night: fireflies, low over the grass, each coming up to a slow green glow and going out again.
//
// They are a few hundred points kept in a box round the eye: one that drifts out of one side of it comes in again
// at the other, so that wherever one goes there are as many. There are none high up, where there is no air.
import * as THREE from 'three';
import { AIR } from './air.js';
import { rng } from './land.js';

export function createMotes(air, { count = 700, reach = 12, seed = 71 } = {}) {
  const R = rng(seed), seeds = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) seeds[i] = R();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  const own = { uReach: { value: reach }, uScale: { value: 800 } };
  const material = new THREE.ShaderMaterial({
    uniforms: { ...air.uniforms, ...own },
    // (added to what is there, and leaving alone the mark of whether anything solid is: see sky.js)
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: AIR + /* glsl */ `
      attribute vec4 seed; uniform float uReach; uniform float uScale; varying vec3 vCol;
      void main() {
        // (about one in six is a firefly)
        bool fly = seed.w > 0.83;
        vec3 wander = vec3(sin(uNow * 0.31 + seed.x * 40.0), sin(uNow * 0.23 + seed.y * 40.0), cos(uNow * 0.27 + seed.z * 40.0));
        vec3 p = seed.xyz * 2.0 * uReach + (fly ? wander * 1.4 : windAt(cameraPosition) * uNow * 0.5 + wander * 0.35);
        p = mod(p - cameraPosition + uReach, 2.0 * uReach) - uReach + cameraPosition;
        vec3 up = normalize(p); float ground = uLand.y + texture2D(tHeight, landUv(landST(up))).r, high = length(p) - ground;
        // (a firefly keeps low over the grass, rising and sinking a little)
        if (fly) { high = 0.3 + 1.3 * fract(seed.w * 37.0) + 0.25 * sin(uNow * 0.7 + seed.x * 20.0); p = up * (ground + high); }
        vec3 to = p - cameraPosition; float d = length(to);
        float there = smoothstep(0.6, 1.8, d) * (1.0 - smoothstep(uReach * 0.7, uReach, d)) * step(0.05, high) * (1.0 - smoothstep(12.0, 26.0, high));
        float day = dayAt(p), size;
        if (fly) {
          float pulse = pow(max(sin(uNow * (0.9 + 0.8 * seed.y) + seed.x * 30.0), 0.0), 5.0);
          vCol = vec3(0.62, 1.0, 0.25) * pulse * 4.0 * (1.0 - smoothstep(0.0, 0.35, day)) * there;
          size = 0.045;
        } else {
          // (lit by the sun as it is there, low and red or high and white; seen against it, far brighter)
          float toward = pow(max(dot(to / d, uSun), 0.0), 3.0), turn = 0.6 + 0.4 * sin(uNow * (1.5 + seed.y * 2.0) + seed.x * 50.0);
          vCol = sunlight(p) * (0.1 + 2.6 * toward) * turn * there;
          size = 0.014 + 0.016 * seed.y;
        }
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * size / max(-mv.z, 0.1), 1.5, 16.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0, a = max(1.0 - r, 0.0);
        gl_FragColor = vec4(vCol * a * a, 0.0);
      }`,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return {
    points,
    /** shown: whether there is anyone out in the air to see them; fov (degrees) and the picture's height (dots): for how large a mote is drawn. */
    update(shown, fov, height) {
      points.visible = shown;
      own.uScale.value = height / (2 * Math.tan((fov * Math.PI) / 360));
    },
  };
}
