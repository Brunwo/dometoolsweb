// What grows and stands on the home world: broad trees, pines, bushes and boulders.
//
// Each kind is made a few times over (no wood is one tree copied), leaf by leaf, for standing under. From further
// off the same tree is drawn with fewer of its touches, each laid broader (paint.js): it is one tree at every
// distance, and nothing is changed for anything else as one walks up to it. Then they are set out over the world: thick where it is wooded, one here and there in the
// meadows, pines on the high ground, stones where the ground is stony. On a small world most of what is planted
// is always below the horizon, so only what could be seen from where the eye is gets drawn at all.
import * as THREE from 'three';
import { createDabs, createSolids, LEVELS, keepAt } from './paint.js';
import { ball, knead, roll } from './shape.js';
import { rng } from './land.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2, C = (hex) => new THREE.Color(hex);
const GREEN = { ramp: ['#0f4a3a', '#1f7a3c', '#4fa83a', '#9fd040', '#e2e85a'].map(C), gold: C('#f4d84a') };
const WARM = { ramp: ['#1f5236', '#3c8a3a', '#84b838', '#cfd844', '#f6ec6a'].map(C), gold: C('#ffd24a') };
const PINE = { ramp: ['#062a30', '#0d4038', '#1b5c40', '#3c8448', '#86b050'].map(C) };
const ROCK = ['#b4aea4', '#a8a298', '#c0b8aa', '#9c988f'];
// how a thing is made: whole (and what is solid in it: its trunk and boughs); and its trunk alone, in few sides,
// for when it is so far off that a bough is finer than the eye can tell
const FINE = [{ dens: 1, leaf: 1, boughs: 7, extra: true }, { dens: 0.06, leaf: 3.4, boughs: 4, extra: false, bare: true }];
/** How far off (in its own sizes) a thing's trunk is drawn without its boughs. */
const TRUNK_ONLY = 170;

/** Makes the kinds. Each is { dabs: [a piece for each of LEVELS] or null, solids: [whole, trunk alone] or null, high, wide, trunk }. */
export function makeKinds() {
  const tmp = new THREE.Color(), nrm = V(0, 1, 0);
  const ramp = (pal, t) => { t = Math.min(0.999, Math.max(0, t)) * 4; const i = Math.floor(t); return tmp.copy(pal.ramp[i]).lerp(pal.ramp[i + 1], t - i); };
  /** A bough of leaves: a dark mass, and touches of leaves all over it and loosely round its edge. `mid`: the middle of the whole crown. */
  function clump(R, dabs, c, r, pal, mid, F, { leaf = 0.2, dens = 150, squash = 0.8, sway = 0.6 } = {}) {
    nrm.copy(c).sub(mid).normalize();
    dabs.add(c.x, c.y - r * 0.08, c.z, { w: r * 0.9, h: r * 0.8 * squash, turn: R() * TAU, seed: R(), kind: 2, colour: ramp(pal, 0.12 + 0.1 * R()), normal: nrm.clone(), inner: 0.35, sway, always: true });
    const n = Math.max(6, Math.round(dens * r * r * F.dens));
    for (let i = 0; i < n * 1.3; i++) {
      const edge = i >= n, u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u), k = edge ? 0.95 + 0.32 * R() : 0.4 + 0.6 * Math.cbrt(R());
      const px = c.x + Math.cos(a) * s * r * k, py = c.y + u * r * squash * k, pz = c.z + Math.sin(a) * s * r * k;
      // (which way out of the crown it faces: half from the bough it is on, half from the whole tree)
      nrm.set(Math.cos(a) * s, u, Math.sin(a) * s).multiplyScalar(0.55).add(V(px - mid.x, py - mid.y, pz - mid.z).normalize().multiplyScalar(0.75)).normalize();
      // (its own green: lighter the more it faces the sky, with a little chance in it. The sun does the rest, wherever it is)
      const tone = 0.22 + 0.4 * (nrm.y * 0.5 + 0.5) + 0.22 * (R() - 0.5) + (edge ? 0.05 : 0);
      ramp(pal, tone);
      if (pal.gold && tone > 0.62 && R() < 0.12) tmp.lerp(pal.gold, 0.5);
      tmp.offsetHSL((R() - 0.5) * 0.025, 0, (R() - 0.5) * 0.04);
      const w = leaf * F.leaf * (0.75 + 0.6 * R()) * (edge ? 0.8 : 1);
      dabs.add(px, py, pz, { w, turn: R() * TAU, seed: R(), kind: 0, colour: tmp, normal: nrm.clone(), inner: edge ? 1 : 0.45 + 0.55 * Math.min(1, k), sway });
    }
  }
  /** A round tree: a trunk that forks, boughs out to its crown, and the crown a dome of boughs of leaves. */
  function tree(seed, F, { h = 9, spread = 4, pal = GREEN, lean = 0, bark = '#7d5a44' } = {}) {
    const R = rng(seed), dabs = createDabs(), solids = createSolids(), r0 = 0.1 + h * 0.034;
    const fork = V(lean * 0.4 + (R() - 0.5) * 0.4, h * 0.42, (R() - 0.5) * 0.4), top = V(lean, h * 0.66, (R() - 0.5) * 0.5), mid = V(lean, h * 0.66, 0);
    const pts = [V(0, -0.4, 0), V(lean * 0.1 + (R() - 0.5) * 0.3, h * 0.2, (R() - 0.5) * 0.3), fork, top], rad = (t) => r0 * (1.3 - 0.95 * t) * (1 + 0.9 * Math.max(0, 0.1 - t) / 0.1);
    solids.add(F.extra ? knead(roll(pts, rad, { around: 12, every: 0.3 }), 0.03, 2.2, seed) : roll(pts, rad, { around: 6, every: 1.2 }), bark, { bark: true, scale: 13, moss: 0.35 });
    clump(R, dabs, top.clone().add(V(0, spread * 0.55, 0)), spread * 0.52, pal, mid, F);
    if (F.extra) for (let i = 0; i < 3; i++) clump(R, dabs, top.clone().add(V((R() - 0.5) * spread * 0.9, spread * (0.5 + 0.3 * R()), (R() - 0.5) * spread * 0.9)), spread * 0.36, pal, mid, F);
    for (let i = 0; i < F.boughs; i++) {
      const a = (i / F.boughs) * TAU + R() * 0.6, out = spread * (0.62 + 0.22 * R()), end = V(mid.x + Math.cos(a) * out, mid.y + (R() - 0.25) * spread * 0.4, mid.z + Math.sin(a) * out);
      const from = fork.clone().lerp(top, R() * 0.7);
      if (!F.bare) solids.add(roll([from, from.clone().lerp(end, 0.55).add(V(0, 0.2 * out, 0)), end], (t) => r0 * (0.42 - 0.34 * t), { around: F.extra ? 7 : 5, every: F.extra ? 0.45 : 1.2 }), bark, { bark: true, scale: 16 });
      clump(R, dabs, end, spread * (0.4 + 0.12 * R()), pal, mid, F);
      if (F.extra) clump(R, dabs, V(end.x + (R() - 0.5) * spread * 0.5, end.y + spread * (0.22 + 0.2 * R()), end.z + (R() - 0.5) * spread * 0.5), spread * (0.3 + 0.1 * R()), pal, mid, F);
    }
    for (let i = 0; i < (F.extra ? 4 : 2); i++) clump(R, dabs, V(mid.x + (R() - 0.5) * spread * 0.9, mid.y + spread * (0.3 + 0.3 * R()), mid.z + (R() - 0.5) * spread * 0.9), spread * (0.34 + 0.1 * R()), pal, mid, F);
    return { dabs: F.bare ? null : dabs.build(), solids: solids.build(), high: h * 0.66 + spread * 1.15, wide: spread * 1.25, trunk: r0 + 0.25 };
  }
  /** A pine: a tall dark stem, tiers of boughs that droop and lift at their ends, bare stubs low down. */
  function pine(seed, F, h = 15) {
    const R = rng(seed), dabs = createDabs(), solids = createSolids(), r0 = 0.16 + h * 0.016, far = !F.extra;
    const pts = [V(0, -0.4, 0), V((R() - 0.5) * 0.3, h * 0.5, (R() - 0.5) * 0.3), V(0, h * 0.98, 0)], rad = (t) => r0 * (1.25 - 1.1 * t) * (1 + 0.7 * Math.max(0, 0.08 - t) / 0.08);
    solids.add(F.extra ? knead(roll(pts, rad, { around: 10, every: 0.5 }), 0.02, 2.5, seed) : roll(pts, rad, { around: 6, every: 1.5 }), '#5e4234', { bark: true, scale: 12, moss: 0.2 });
    const tiers = Math.max(4, Math.round(h * 0.95 * (F.dens < 0.1 ? 0.4 : F.dens < 0.5 ? 0.7 : 1))), from = 0.2;
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1), y = h * (from + (1 - from) * t), reach = (1 - t) ** 0.85 * h * 0.3 + 0.5, arms = F.dens < 0.1 ? 4 : far ? 5 : 7 + Math.floor(R() * 2);
      for (let j = 0; j < arms; j++) {
        const a = (j / arms) * TAU + k * 0.9 + R() * 0.5, dx = Math.cos(a), dz = Math.sin(a), len = reach * (0.75 + 0.4 * R()), steps = Math.max(2, Math.round(len / (F.dens < 0.1 ? 1.9 : far ? 0.8 : 0.27)));
        for (let s = 1; s <= steps; s++) {
          const u = s / steps, out = len * u, droop = -len * 0.34 * Math.sin(u * 2.4) + len * 0.1 * u * u;
          nrm.set(dx * 0.6, 0.75, dz * 0.6).normalize();
          ramp(PINE, 0.2 + 0.5 * u + 0.25 * (R() - 0.5));
          const w = (F.dens < 0.1 ? 2.1 : far ? 1.0 : 0.44) * (1.05 - 0.4 * u) * (0.85 + 0.3 * R());
          // (the bough itself, under its needles: a dark flat mass, so that a pine is a solid thing and not a haze of lines)
          // (it is given up, from far off, at the same moment as the needles on it: a bough is never left bare)
          let rank = null;
          // (it is kept well inside its needles, smaller toward the bough's end, and there is none at the very
          // tip: a bough ends in needles, not in a dark flat shape standing out past them)
          if ((s % 2 === 1 || far) && s < steps) { const body = PINE.ramp[0].clone().lerp(PINE.ramp[2], 0.25 + 0.45 * u), turn = (R() - 0.5) * 0.3; rank = R(); dabs.add(dx * out * 0.86, y + droop - 0.16, dz * out * 0.86, { w: w * (1.1 - 0.45 * u), h: w * 0.4, turn, seed: rank, kind: 2, colour: body, normal: nrm.clone(), inner: 0.4 + 0.5 * u, sway: 0.3 + 0.5 * u }); }
          dabs.add(dx * out + (R() - 0.5) * 0.15, y + droop + (R() - 0.5) * 0.1, dz * out + (R() - 0.5) * 0.15, { w, h: w * 1.05, turn: (R() - 0.5) * 0.7, seed: rank ?? R(), kind: 1, colour: tmp, normal: nrm.clone(), inner: 0.45 + 0.55 * u, sway: 0.3 + 0.5 * u });
        }
      }
    }
    // the stubs of boughs it has lost
    if (F.extra) for (let i = 0; i < 5; i++) { const a = R() * TAU, y = h * (0.1 + 0.2 * R()), l = 0.5 + 0.9 * R(); solids.add(roll([V(0, y, 0), V(Math.cos(a) * l, y + 0.15 * l, Math.sin(a) * l)], (t) => 0.06 - 0.045 * t, { around: 5, every: 0.5 }), '#4a2c26', { bark: true, scale: 14 }); }
    return { dabs: F.bare ? null : dabs.build(), solids: solids.build(), high: h, wide: h * 0.34, trunk: r0 + 0.25 };
  }
  /** A bush: a low heap of leaves. */
  function bush(seed, F, r = 1, pal = GREEN) {
    const R = rng(seed), dabs = createDabs(), mid = V(0, r * 0.3, 0), o = { leaf: 0.15, dens: 170, squash: 0.7 };
    clump(R, dabs, V(0, r * 0.5, 0), r, pal, mid, F, o);
    for (let i = 0; i < 2; i++) clump(R, dabs, V((R() - 0.5) * r * 1.5, r * 0.34, (R() - 0.5) * r * 1.5), r * 0.62, pal, mid, F, o);
    return { dabs: F.bare ? null : dabs.build(), solids: null, high: r * 1.5, wide: r * 1.7, trunk: 0 };
  }
  /** A boulder: a lump that has been split, so that it has faces of its own, worn at their edges and rough all over. */
  function boulder(seed, F, s = 1) {
    const R = rng(seed), solids = createSolids(), C = rng(seed * 13 + 5), d = V(0, 0, 0), v = V(0, 0, 0);
    const sx = s * (0.9 + 0.4 * R()), sy = s * (0.6 + 0.25 * R()), sz = s * (0.8 + 0.35 * R());
    let g = ball(1, F.bare ? 2 : 4).scale(sx, sy, sz);
    // (each split takes off what lies beyond a plane: seven or so, at any angle, some deep and most shallow. They
    // are worked out from the stone's own measure, so that it is the same stone in however many pieces it is made)
    const p = g.attributes.position;
    for (let k = 0; k < 8; k++) {
      const u = C() * 2 - 1, a = C() * TAU, w = Math.sqrt(1 - u * u);
      d.set(Math.cos(a) * w, u * 0.8 + 0.15, Math.sin(a) * w).normalize();
      const reach = Math.hypot(sx * d.x, sy * d.y, sz * d.z) * (0.5 + 0.42 * C() ** 0.7);
      for (let i = 0; i < p.count; i++) { const t = v.fromBufferAttribute(p, i).dot(d) - reach; if (t > 0) p.setXYZ(i, v.x - d.x * t * 0.97, v.y - d.y * t * 0.97, v.z - d.z * t * 0.97); }
    }
    g.computeVertexNormals();
    g = knead(knead(g, s * 0.09, 1.2 / s, seed), s * 0.03, 4.4 / s, seed + 9);
    solids.add(g.translate(0, s * 0.08, 0), ROCK[Math.floor(R() * ROCK.length)], { scale: 0.9 / s + 0.5, moss: 0.4 });
    // (from forty of its own sizes off it is drawn in few sides: by then they cannot be told from many)
    return { dabs: null, solids: solids.build(), high: s, wide: s * 1.2, trunk: s * 0.85, bareAt: 40 };
  }
  const three = (make) => { const whole = make(FINE[0]), bare = make(FINE[1]); return { dabs: whole.dabs, solids: whole.solids ? [whole.solids, bare.solids] : null, high: whole.high, wide: whole.wide, trunk: whole.trunk, bareAt: whole.bareAt ?? TRUNK_ONLY }; };
  return {
    tree: [
      three((F) => tree(101, F, { h: 11.5, spread: 5.2, lean: -0.6 })), three((F) => tree(102, F, { h: 9, spread: 4.2, pal: WARM })), three((F) => tree(103, F, { h: 10, spread: 4.6, pal: WARM, lean: 0.5 })),
      three((F) => tree(104, F, { h: 10.5, spread: 4.8 })), three((F) => tree(105, F, { h: 8.5, spread: 3.8, lean: -0.8 })),
    ],
    pine: [three((F) => pine(201, F, 17)), three((F) => pine(202, F, 14.5)), three((F) => pine(203, F, 16))],
    bush: [three((F) => bush(301, F, 1.1)), three((F) => bush(302, F, 0.9, WARM)), three((F) => bush(303, F, 1.0))],
    boulder: [three((F) => boulder(401, F, 1.0)), three((F) => boulder(402, F, 1.4)), three((F) => boulder(403, F, 0.7))],
  };
}

/** Plants the world. Returns { group, colliders, update(eye), count }. */
/** stage: { at, facing }: where one first stands and the way one first looks (toward the setting sun): what is near there is set out by hand. */
export function createTrees(paint, land, stage, { bare = 0, kinds = makeKinds() } = {}) {
  const R = rng(bare ? 777 : 4242), group = new THREE.Group(), planted = [], colliders = [];
  const d = V(0, 0, 0), Y = V(0, 1, 0), q = new THREE.Quaternion(), spin = new THREE.Quaternion();
  const START = land.places.start, TOR = land.places.tor;
  const anywhere = () => { const u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u); return d.set(Math.cos(a) * s, u, Math.sin(a) * s); };
  const apart = (dir, far) => planted.every((p) => p.dir.distanceTo(dir) * land.radius > far + p.room);
  function plant(kind, dir, size, room, turn = R() * TAU) {
    const item = { kind, dir: dir.clone(), size, room, pos: dir.clone().multiplyScalar(land.ground(dir) - 0.12 * size), leaf: null, solid: null, seen: false, top: kind.high * size };
    q.setFromUnitVectors(Y, dir).multiply(spin.setFromAxisAngle(Y, turn));
    const m = new THREE.Matrix4().compose(item.pos, q, V(size, size, size));
    // (one piece for its leaves and one for what is solid in it; which of the kind's pieces each is drawn from is
    // chosen as the eye moves)
    for (const [name, g, material, depth] of [['leaf', kind.dabs?.[0], paint.leaf, paint.leafDepth], ['solid', kind.solids?.[0], paint.solid, null]]) {
      if (!g) continue;
      const mesh = new THREE.Mesh(g, material);
      if (depth) mesh.customDepthMaterial = depth;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.matrix.copy(m); mesh.matrixWorld.copy(m); mesh.matrixWorldAutoUpdate = false;
      mesh.visible = false;
      group.add(mesh);
      item[name] = mesh;
    }
    planted.push(item);
    // (what is thick enough to stop a walker)
    if (kind.trunk * size > 0.3) colliders.push({ dir: item.dir, r: kind.trunk * size });
    return item;
  }
  // the place one starts at: two broad trees and a pine to frame the way the sun goes down, with a bush and stones at their feet
  if (stage) {
    const up = stage.at.clone().normalize(), ahead = stage.facing.clone().addScaledVector(up, -stage.facing.dot(up)).normalize(), right = ahead.clone().cross(up);
    const at = (r, a) => up.clone().multiplyScalar(land.radius).addScaledVector(right, r).addScaledVector(ahead, a).normalize();
    for (const [kind, i, r, a, size, turn] of [['tree', 0, -9.5, 16, 1.12, 0.6], ['tree', 3, 12, 21, 0.98, 2.4], ['pine', 0, 17, 13, 0.92, 0], ['pine', 2, -17, 27, 1.0, 1], ['bush', 0, -5.5, 12.5, 1.0, 0], ['bush', 2, 9.5, 17.5, 0.9, 1], ['boulder', 1, 4.2, 9, 0.9, 0.7], ['boulder', 2, 5.6, 9.9, 0.8, 2], ['boulder', 0, -12.5, 14, 1.0, 4], ['tree', 4, -21, 6, 0.9, 5], ['bush', 1, 20, 4, 1.1, 3]]) plant(kinds[kind][i], at(r, a), size, kind === 'tree' ? 2.6 : 1.2, turn);
  }
  // trees: tried at many places, kept where the land is wooded (and now and then where it is not)
  for (let i = 0; i < (bare ? 0 : 26000) && planted.length < 560; i++) {
    const dir = anywhere(), wood = land.wood(dir);
    if (R() > wood * wood * 0.95 + 0.008) continue;
    if (dir.distanceTo(START) * land.radius < 26 || land.wayDist(dir) < 2.6 || land.kind(dir)[1] > 0.3 || land.shore?.(dir)) continue;
    // pines on high and stony ground, and in drifts of their own
    const high = land.height(dir), piney = Math.min(1, Math.max(0, (high - 3) / 6) + Math.exp(-(((dir.distanceTo(TOR) * land.radius) / 60) ** 2)) * 0.8);
    const isPine = R() < 0.12 + 0.75 * piney;
    const kind = isPine ? kinds.pine[Math.floor(R() * kinds.pine.length)] : kinds.tree[Math.floor(R() * kinds.tree.length)], size = 0.78 + 0.5 * R();
    const room = (isPine ? 1.5 : 2.5) * size;
    if (!apart(dir, room)) continue;
    plant(kind, dir, size, room);
  }
  const trees = planted.filter((p) => p.kind.dabs && p.kind.solids).length, treesEnd = planted.length;
  // bushes: at the feet of the woods, and here and there
  for (let i = 0; i < (bare ? 0 : 6000) && planted.length < treesEnd + 190; i++) {
    const dir = anywhere(), wood = land.wood(dir);
    if (R() > 0.06 + 0.5 * wood * (1 - wood) * 4) continue;
    if (dir.distanceTo(START) * land.radius < 24 || land.wayDist(dir) < 2 || land.kind(dir)[1] > 0.3 || land.shore?.(dir) || !apart(dir, 1.2)) continue;
    plant(kinds.bush[Math.floor(R() * kinds.bush.length)], dir, 0.8 + 0.5 * R(), 1.1);
  }
  const bushesEnd = planted.length, bushes = planted.filter((p) => !p.kind.solids).length;
  // boulders: where the ground is stony, and a few strays
  for (let i = 0; i < (bare ? 0 : 5200) && planted.length < bushesEnd + 95; i++) {
    const dir = anywhere(), rock = land.kind(dir)[1];
    if (R() > 0.03 + rock * 0.8) continue;
    if (dir.distanceTo(START) * land.radius < 24 || land.wayDist(dir) < 1.8 || land.water?.(dir) > 0.25 || !apart(dir, 0.6)) continue;
    plant(kinds.boulder[Math.floor(R() * kinds.boulder.length)], dir, 0.6 + 1.1 * R() * R(), 0.9);
  }

  // a bare world: stones only, most where the ground is broken
  for (let i = 0; i < 9000 && planted.length < bare; i++) {
    const dir = anywhere();
    if (R() > 0.12 + land.kind(dir)[1] * 0.88 || !apart(dir, 0.5)) continue;
    plant(kinds.boulder[Math.floor(R() * kinds.boulder.length)], dir, 0.3 + 1.5 * R() * R(), 0.8);
  }

  const eyeDir = V(0, 0, 0), low = land.radius - 9;
  return {
    group, colliders, planted, count: { trees, bushes, boulders: planted.length - trees - bushes },
    /** Shows what can be seen from where the eye is, each thing drawn from as many of its touches as its distance asks. */
    update(eye) {
      const r = eye.length(), dip = Math.acos(Math.min(1, low / r));
      eyeDir.copy(eye).divideScalar(r);
      for (const p of planted) {
        // (below the horizon? a thing of that height shows over it only so far round the world)
        const round = Math.acos(THREE.MathUtils.clamp(eyeDir.dot(p.dir), -1, 1));
        const seen = round < dip + Math.acos(Math.min(1, low / (land.radius + p.top + 4)));
        if (seen !== p.seen) { p.seen = seen; if (p.leaf) p.leaf.visible = seen; if (p.solid) p.solid.visible = seen; }
        if (!seen) continue;
        const far = eye.distanceTo(p.pos) / p.size;
        if (p.leaf) {
          // (the smallest piece that still holds every touch that is laid from this far off: the touches it leaves
          // out have shrunk to nothing already, so going from one piece to the next shows nothing)
          const keep = keepAt(far) * 1.02;
          let k = LEVELS.length - 1; while (k > 0 && LEVELS[k] < keep) k--;
          const g = p.kind.dabs[k];
          if (p.leaf.geometry !== g) p.leaf.geometry = g;
        }
        if (p.solid) { const g = p.kind.solids[far < p.kind.bareAt ? 0 : 1]; if (p.solid.geometry !== g) p.solid.geometry = g; }
      }
    },
  };
}
