// Finer meshes for the dome's single-view warp.
//
// The warp (domewarp.js) puts each vertex exactly where the fisheye wants it, but draws straight between them:
// a long edge close to the eye (a cabin wall, a window post, a print on the ceiling) should bend and does not,
// and what lies just in front of a surface can show through it or vanish. So, the first time the single view
// draws a small thing (the ship, what is in it, a tree), every triangle edge longer than `edge` metres is split
// at its middle, again and again, every attribute carried along. Only the ship is given to it (dome.js): the
// ground and the worlds are fine enough already, and grass, flowers and leaves are drawn from the order of
// their own vertices, which splitting would undo. Anything skinned or morphed is left alone.
import * as THREE from 'three';

const done = new WeakSet(), made = new WeakMap();   // (a geometry shared by many meshes is split once)

/** Split a geometry's triangles until no edge is longer than L (in the geometry's own units). Returns a new, non-indexed geometry. */
export function subdivide(geometry, L, maxDepth = 6) {
  const pos = geometry.attributes.position, names = Object.keys(geometry.attributes);
  const attrs = names.map((n) => geometry.attributes[n]);
  const sizes = attrs.map((a) => a.itemSize);
  const index = geometry.index, triCount = (index ? index.count : pos.count) / 3;
  const out = attrs.map(() => []);
  const get = [(a, i) => a.getX(i), (a, i) => a.getY(i), (a, i) => a.getZ(i), (a, i) => a.getW(i)];
  const vert = (i) => attrs.map((a, k) => { const v = new Array(sizes[k]); for (let c = 0; c < sizes[k]; c++) v[c] = get[c](a, i); return v; });
  const len2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const L2 = L * L, P = names.indexOf('position'), N = names.indexOf('normal');
  const mid = (a, b) => a.map((va, k) => {
    const m = va.map((x, c) => (x + b[k][c]) / 2);
    if (k === N) { const l = Math.hypot(m[0], m[1], m[2]) || 1; m[0] /= l; m[1] /= l; m[2] /= l; }
    return m;
  });
  const push = (v) => { for (let k = 0; k < v.length; k++) for (const x of v[k]) out[k].push(x); };
  const emit = (a, b, c, depth) => {
    const ab = len2(a[P], b[P]), bc = len2(b[P], c[P]), ca = len2(c[P], a[P]), m = Math.max(ab, bc, ca);
    if (m <= L2 || depth >= maxDepth) { push(a); push(b); push(c); return; }
    // split the longest edge; the two halves keep the winding
    if (m === ab) { const x = mid(a, b); emit(a, x, c, depth + 1); emit(x, b, c, depth + 1); }
    else if (m === bc) { const x = mid(b, c); emit(b, x, a, depth + 1); emit(x, c, a, depth + 1); }
    else { const x = mid(c, a); emit(c, x, b, depth + 1); emit(x, a, b, depth + 1); }
  };
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: triCount * 3, materialIndex: 0 }];
  const g = new THREE.BufferGeometry();
  for (const gr of groups) {
    const start = out[P].length / 3;
    for (let t = gr.start / 3; t < Math.min((gr.start + gr.count) / 3, triCount); t++) {
      const i0 = index ? index.getX(t * 3) : t * 3, i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1, i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      emit(vert(i0), vert(i1), vert(i2), 0);
    }
    if (geometry.groups.length) g.addGroup(start, out[P].length / 3 - start, gr.materialIndex);
  }
  names.forEach((n, k) => g.setAttribute(n, new THREE.Float32BufferAttribute(out[k], sizes[k])));
  g.computeBoundingSphere(); g.computeBoundingBox();
  g.userData = geometry.userData;
  return g;
}

/** Make the small things in a scene fine enough for the single-view warp (once each). edge: metres. */
export function refine(scene, edge = 0.15, small = 30) {
  scene.traverse((o) => {
    if (!o.isMesh || done.has(o) || o.isSkinnedMesh || o.geometry?.morphAttributes?.position) return;
    done.add(o);
    const g = o.geometry;
    if (!g?.attributes?.position || g.attributes.position.count < 3) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const scale = o.matrixWorld.getMaxScaleOnAxis() || 1;
    if (g.boundingSphere.radius * scale > small) return;
    // (only if something is too long: most small things already are fine)
    const L = edge / scale, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
    let long = false;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < n && !long; i += 3) for (let e = 0; e < 3; e++) {
      const i0 = idx ? idx.getX(i + e) : i + e, i1 = idx ? idx.getX(i + ((e + 1) % 3)) : i + ((e + 1) % 3);
      if (a.fromBufferAttribute(pos, i0).distanceToSquared(b.fromBufferAttribute(pos, i1)) > L * L) { long = true; break; }
    }
    if (!long) return;
    let fine = made.get(g);
    if (!fine) { fine = subdivide(g, L); made.set(g, fine); }
    o.geometry = fine;
  });
}
