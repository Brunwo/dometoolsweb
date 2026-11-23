// What stands over the ground of a world, kept as a picture: where the crowns of its trees are, and how high.
//
// A tree's shadow is thrown by the lamp only near the eye (the shadows' picture is a few tens of metres wide). Seen
// from a hill, from the air or from space, that left every tree standing on the ground like a thing cut out and
// stuck there. This picture is what the ground reads instead, from any distance (air.js, treeShade): a line is
// walked from each place on the ground toward the sun, and if it passes through a crown that place is in shade.
// So shadows lie the right way, grow long as the sun goes down, and turn with the day, everywhere at once.
//
// It is laid out as the ground's own pictures are (land.js): six sheets, each drawn one dot past its own edge.
//   r  how much of a crown is over this place (0 none .. 1 its middle)
//   g  how high that crown's top stands (over 24 metres)
//   b  how near a tree is, loosely: under and round its crown the grass is darker and lusher, and thins to moss
import * as THREE from 'three';
import { dirOf, onFace } from './land.js';

/** land: a world's ground. planted: what stands on it (trees.js): only what has leaves counts. */
export function createCover(land, planted, { squares = 384 } = {}) {
  const N = squares, T = N + 2, W = T * 3, H = T * 2, data = new Uint8Array(W * H * 4), d = new THREE.Vector3();
  const metre = (land.radius * Math.PI) / 2 / N;
  for (const p of planted) {
    if (!p.kind.dabs) continue;
    const crown = 0.8 * p.kind.wide * p.size, top = Math.min(255, (p.kind.high * p.size / 24) * 255), reach = crown * 2.6, span = Math.ceil(reach / metre) + 2;
    for (let f = 0; f < 6; f++) {
      const st = onFace(f, p.dir);
      if (!st || Math.max(Math.abs(st[0]), Math.abs(st[1])) > 1.2) continue;
      const ci = Math.round((st[0] * 0.5 + 0.5) * N + 0.5), cj = Math.round((st[1] * 0.5 + 0.5) * N + 0.5);
      for (let j = Math.max(0, cj - span); j <= Math.min(T - 1, cj + span); j++) for (let i = Math.max(0, ci - span); i <= Math.min(T - 1, ci + span); i++) {
        dirOf(f, ((i - 0.5) / N) * 2 - 1, ((j - 0.5) / N) * 2 - 1, d);
        const far = Math.acos(Math.min(1, d.dot(p.dir))) * land.radius;
        if (far > reach) continue;
        const k = (((f / 3) | 0) * T + j) * W * 4 + ((f % 3) * T + i) * 4;
        // (a crown is ragged at its edge, and thinner there)
        const u = (far - 0.62 * crown) / (0.42 * crown), over = far < 0.62 * crown ? 1 : u < 1 ? 1 - u * u * (3 - 2 * u) : 0;
        if (over * 255 > data[k]) data[k] = over * 255;
        if (over > 0.05 && top > data[k + 1]) data[k + 1] = top;
        const near = Math.exp(-((far / (1.25 * crown)) ** 2));
        data[k + 2] = Math.min(255, data[k + 2] + near * 150);
      }
    }
  }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, squares: N };
}
