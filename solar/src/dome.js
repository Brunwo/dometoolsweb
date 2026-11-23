// Fulldome output: the whole picture as a dome master (DomeTools' cubemap way, after prefrontalcortex/DomeTools).
//
//   ?dome            dome master, zenith in the middle, the way one faces at the bottom of the circle
//   ?dome=30         the same with the dome tilted 30° toward the front (0 = planetarium, 90 = looking ahead)
//   ?domefov=200     how wide the dome is, in degrees (default 180)
//   ?domeface=1024   the size of each cube face (default: matched to the screen)
//   ?domepipe=cube   the cubemap way (default: single, the single-view warp)
//
// Keys while it is on: PageUp and PageDown tilt the dome, - and = widen or narrow it, O shows the 10° grid,
// P switches between the two ways.
//
// Two ways, the same picture:
//  - single (the default): every vertex of every material is sent straight to its place in the fisheye
//    (domewarp.js), so the page is drawn once, into the circle. Up to 240°; wider, it falls back to the cube.
//  - cube: the eye is turned to each of the six sides of a cube in turn (only those the dome can see), and the
//    whole page is drawn for each, air and all, into one side of a cube texture. Every pixel of the circle then
//    looks up its own direction in that cube.
// Both lay the dome out in the eye's own frame, so the dome turns as the head turns.
import * as THREE from 'three';
import { DOME } from './domewarp.js';
import { refine } from './tess.js';

// the six sides, as GL lays out a cube texture (and as three's CubeCamera draws them)
const FACES = [
  { at: [1, 0, 0], up: [0, -1, 0] }, { at: [-1, 0, 0], up: [0, -1, 0] },
  { at: [0, 1, 0], up: [0, 0, 1] }, { at: [0, -1, 0], up: [0, 0, -1] },
  { at: [0, 0, 1], up: [0, -1, 0] }, { at: [0, 0, -1], up: [0, -1, 0] },
].map(({ at, up }) => {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), new THREE.Vector3(...at), new THREE.Vector3(...up));
  return { dir: new THREE.Vector3(...at), turn: new THREE.Quaternion().setFromRotationMatrix(m) };
});
const HALF_DIAGONAL = Math.atan(Math.SQRT2); // from a face's middle to its corner: 54.7°

export function createDome(renderer, q) {
  const state = {
    tilt: THREE.MathUtils.clamp(parseFloat(q.get('dome')) || 0, 0, 90),
    fov: THREE.MathUtils.clamp(parseFloat(q.get('domefov')) || 180, 90, 360),
    face: parseInt(q.get('domeface')) || 0,
    grid: false,
    pipe: q.get('domepipe') === 'cube' ? 'cube' : 'single',
  };
  // what the single view is drawn into: a square the size of the circle
  const flatRT = new THREE.WebGLRenderTarget(256, 256, { type: THREE.UnsignedByteType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const cube = new THREE.WebGLCubeRenderTarget(256, { type: THREE.UnsignedByteType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });

  const warp = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: {
      tCube: { value: cube.texture }, tFlat: { value: flatRT.texture }, uSingle: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) }, uFov: { value: Math.PI },
      uF: { value: new THREE.Vector3() }, uU: { value: new THREE.Vector3() }, uGrid: { value: 0 },
    },
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform samplerCube tCube; uniform sampler2D tFlat; uniform float uSingle; uniform vec2 uScreen; uniform float uFov; uniform vec3 uF; uniform vec3 uU; uniform float uGrid;
      layout(location = 0) out vec4 outC;
      float lineAA(float x) { float w = fwidth(x); return 1.0 - smoothstep(0.0, 1.2, abs(fract(x - 0.5) - 0.5) / max(w, 1e-5)); }
      void main() {
        // the circle: as tall as the screen, in its middle; +y in it is the back of the dome
        vec2 p = (gl_FragCoord.xy - 0.5 * uScreen) / (0.5 * min(uScreen.x, uScreen.y));
        float r = length(p), aa = fwidth(r), inside = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
        float th = min(r, 1.0) * uFov * 0.5, ph = atan(p.y, p.x);   // equidistant: distance from the middle is angle from the zenith
        vec3 R = cross(uF, uU);   // audience right is image right
        vec3 d = sin(th) * (cos(ph) * R + sin(ph) * uU) + cos(th) * uF;
        // (kept off the cube's exact edges and corners: some GL implementations stall there)
        vec3 c = uSingle > 0.5 ? textureLod(tFlat, clamp(p * 0.5 + 0.5, 0.0, 1.0), 0.0).rgb   // single view: already a fisheye
                               : textureLod(tCube, normalize(d + vec3(1.3e-5, 2.1e-5, 0.7e-5)), 0.0).rgb;
        if (uGrid > 0.5) {
          float td = degrees(th);
          float l = max(lineAA(td / 10.0), lineAA(degrees(ph) / 30.0) * smoothstep(0.02, 0.1, r));
          c = mix(c, vec3(1.0, 0.72, 0.3), l * 0.5);
          c = mix(c, vec3(1.0, 0.2, 0.2), 1.0 - smoothstep(0.0, 2.0, abs(td - 90.0) / max(fwidth(td), 1e-5)));
        }
        outC = vec4(c * inside, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), warp);
  quad.frustumCulled = false;
  const stage = new THREE.Scene(), flat = new THREE.Camera();
  stage.add(quad);

  // the dome's middle and its "up" (the back), in the eye's frame: the eye looks down -z with +y up
  const F = new THREE.Vector3(), U = new THREE.Vector3();
  const aim = () => {
    const e = THREE.MathUtils.degToRad(90 - state.tilt);
    F.set(0, Math.sin(e), -Math.cos(e));
    U.set(0, Math.cos(e), Math.sin(e));
  };
  const faceSize = () => {
    if (state.face) return state.face;
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    // one cube texel to one pixel of the circle at its middle
    const n = (2 * Math.min(s.x, s.y)) / THREE.MathUtils.degToRad(state.fov);
    return THREE.MathUtils.clamp(Math.ceil(n / 64) * 64, 256, 2048);
  };

  addEventListener('keydown', (e) => {
    if (e.code === 'PageDown') state.tilt = Math.max(0, state.tilt - 5);
    else if (e.code === 'PageUp') state.tilt = Math.min(90, state.tilt + 5);
    else if (e.code === 'Minus') state.fov = Math.min(360, state.fov + 10);
    else if (e.code === 'Equal') state.fov = Math.max(90, state.fov - 10);
    else if (e.code === 'KeyO') state.grid = !state.grid;
    else if (e.code === 'KeyP') state.pipe = state.pipe === 'single' ? 'cube' : 'single';
  });
  document.body.classList.add('dome');

  const keep = new Map(), culled = [];
  const finish = (single) => {
    renderer.getDrawingBufferSize(warp.uniforms.uScreen.value);
    warp.uniforms.uFov.value = THREE.MathUtils.degToRad(state.fov);
    warp.uniforms.uF.value.copy(F); warp.uniforms.uU.value.copy(U);
    warp.uniforms.uGrid.value = state.grid ? 1 : 0;
    warp.uniforms.uSingle.value = single ? 1 : 0;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(stage, flat);
  };
  // The single-view way: one pass, every vertex warped (domewarp.js). The eyes keep their way of looking; their
  // projection only has to be a plain one the warp can undo. Nothing may be culled against a 90° frustum when
  // the dome sees 180°, so culling is off for this pass.
  const single = (page, eyes, draw, scenes, fine) => {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2()), n = Math.min(Math.min(s.x, s.y), 2048);
    if (flatRT.width !== n) flatRT.setSize(n, n);
    page.fit(n, n);
    for (const c of eyes) { keep.set(c, { fov: c.fov, aspect: c.aspect }); c.fov = 90; c.aspect = 1; c.updateProjectionMatrix(); }
    // (the ship's long panels split finer the first time they are seen this way: see tess.js)
    for (const r of fine) if (r) refine(r);
    for (const sc of scenes) sc.traverse((o) => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
    const R = new THREE.Vector3().crossVectors(F, U);
    DOME.F.value.copy(F); DOME.U.value.copy(U); DOME.R.value.copy(R); DOME.tmax.value = THREE.MathUtils.degToRad(state.fov / 2);
    DOME.on.value = 1;
    try {
      draw({ target: flatRT, face: 0, flat: true, single: { F, U, R, tmax: DOME.tmax.value } });
    } finally {
      DOME.on.value = 0;
      for (const o of culled) o.frustumCulled = true;
      culled.length = 0;
      for (const c of eyes) { const k = keep.get(c); c.fov = k.fov; c.aspect = k.aspect; c.updateProjectionMatrix(); }
    }
    finish(true);
  };
  return {
    state,
    /** Draw the dome: once (single view), or once for each side of the cube it can see; then the circle to the screen. */
    render(page, eyes, draw, scenes = [], fine = []) {
      aim();
      if (state.pipe === 'single' && state.fov <= 240) return single(page, eyes, draw, scenes, fine);
      const n = faceSize();
      if (cube.width !== n) cube.setSize(n, n);
      page.fit(n, n);
      // every eye the page will use, as it is now
      for (const c of eyes) keep.set(c, { q: c.quaternion.clone(), fov: c.fov, aspect: c.aspect });
      const shadows = renderer.shadowMap.autoUpdate;
      let first = true;
      for (let i = 0; i < 6; i++) {
        // (a side wholly outside the dome is not drawn: at 180° that is one of the six)
        if (FACES[i].dir.angleTo(F) > THREE.MathUtils.degToRad(state.fov / 2) + HALF_DIAGONAL) continue;
        for (const c of eyes) {
          const k = keep.get(c);
          c.quaternion.copy(k.q).multiply(FACES[i].turn);
          c.fov = 90; c.aspect = 1; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
        }
        draw({ target: cube, face: i, flat: true });
        // (the sun's shadows do not depend on which way the eye looks: thrown once, for the first side)
        if (first) { renderer.shadowMap.autoUpdate = false; first = false; }
      }
      renderer.shadowMap.autoUpdate = shadows;
      for (const c of eyes) {
        const k = keep.get(c);
        c.quaternion.copy(k.q); c.fov = k.fov; c.aspect = k.aspect; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
      }
      finish(false);
    },
  };
}
