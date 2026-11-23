// The single-view dome warp, for every material in the game.
//
// Each vertex shader is wrapped: its own main() runs as before, and the clip-space position it leaves is turned
// back into a view-space point (using the camera's own projection matrix) and sent straight to where an
// equidistant fisheye puts its direction. So the whole page is drawn once, into the circle, with no cube and no
// resampling (see dome.js). Nothing changes unless the warp is switched on: `DOME.on` is 0 outside the dome's
// own pass, and orthographic cameras (the sun's shadow) are never warped.
//
// It has to be in place before any material is made, so main.js imports this first. It only does anything when
// the address asks for the dome (?dome).
//
// Depth: linear distance between the camera's near and far planes (so page.js can read distance straight back),
// written with w = the distance, so what a triangle carries across it is still interpolated as seen from the eye.
// Edges stay straight between vertices, so very large triangles close to the eye are drawn a little off their
// true curve. Vertices well behind the dome's rim are sent past the far plane, so a triangle round the point
// straight behind does not wrap across the picture.
import * as THREE from 'three';

export const DOME = {
  on: { value: 0 },
  F: { value: new THREE.Vector3(0, 1, 0) },   // the dome's middle, in the eye's own frame
  U: { value: new THREE.Vector3(0, 0, 1) },   // the circle's "up": the back of the dome
  R: { value: new THREE.Vector3(1, 0, 0) },
  tmax: { value: Math.PI / 2 },               // half the dome's width
};

const WARP = /* glsl */ `
// --- dome warp (domewarp.js) ---
uniform float uDomeOn; uniform vec3 uDomeF; uniform vec3 uDomeU; uniform vec3 uDomeR; uniform float uDomeTmax;
vec4 domeWarp(vec4 c) {
  if (uDomeOn < 0.5 || projectionMatrix[3][3] > 0.5) return c;
  // back to the eye's frame (a symmetric perspective: x = cx / P00, y = cy / P11, z = -w)
  vec3 v = vec3(c.x / projectionMatrix[0][0], c.y / projectionMatrix[1][1], -c.w);
  float near = projectionMatrix[3][2] / (projectionMatrix[2][2] - 1.0);
  float far = projectionMatrix[3][2] / (projectionMatrix[2][2] + 1.0);
  float len = length(v); vec3 d = v / max(len, 1e-6);
  float th = acos(clamp(dot(d, uDomeF), -1.0, 1.0));
  vec2 q = vec2(dot(d, uDomeR), dot(d, uDomeU)); float ql = length(q);
  vec2 xy = (ql > 1e-7 ? q / ql : vec2(1.0, 0.0)) * (th / uDomeTmax);
  float z = (len - near) / (far - near) * 2.0 - 1.0;
  if (th > uDomeTmax + 0.7) z = 1.5;
  float w = max(len, 1e-4);
  return vec4(xy * w, z * w, w);
}
`;
const MARK = '// --- dome warp (domewarp.js) ---';

function patch(shader) {
  const vs = shader.vertexShader;
  if (vs.includes(MARK)) return;
  const at = vs.search(/\bvoid\s+main\s*\(\s*(void)?\s*\)/);
  if (at < 0) return;
  shader.vertexShader = vs.slice(0, at) + WARP + vs.slice(at).replace(/\bvoid\s+main\s*\(\s*(void)?\s*\)/, 'void domeMain_()') +
    '\nvoid main() { domeMain_(); gl_Position = domeWarp(gl_Position); }\n';
  Object.assign(shader.uniforms, { uDomeOn: DOME.on, uDomeF: DOME.F, uDomeU: DOME.U, uDomeR: DOME.R, uDomeTmax: DOME.tmax });
}

// Every material, whatever its own onBeforeCompile does: the prototype's onBeforeCompile becomes an accessor, so a
// material's own hook (set before or after) still runs, and the warp is added after it. The wrapper's text
// carries the material's own hook's, so three's program cache still tells different hooks apart.
if (new URLSearchParams(location.search).has('dome')) {
  // (a wrapper is made round whichever hook is there when it is read: a material that reads its hook to chain
  // onto it, as grass.js does, gets that wrapper, and the warp, added twice, is added only once)
  const own = new WeakMap(), wrapped = new WeakMap(), inner = new WeakMap();
  const bare = (shader) => patch(shader);
  bare.toString = () => 'dome:';
  const wrap = (fn) => {
    if (!fn) return bare;
    let w = wrapped.get(fn);
    if (!w) {
      w = function (shader, renderer) { fn.call(this, shader, renderer); patch(shader); };
      w.toString = () => `dome:${fn.toString()}`;
      wrapped.set(fn, w); inner.set(w, fn);
    }
    return w;
  };
  Object.defineProperty(THREE.Material.prototype, 'onBeforeCompile', {
    configurable: true,
    get() { return wrap(own.get(this)); },
    // (a wrapper handed back in is unwrapped, so it is not wrapped twice)
    set(fn) { own.set(this, fn === bare ? undefined : inner.get(fn) ?? fn); },
  });
}
