// The solar system: where every body is at any moment, and how it is turned.
//
// The bodies keep to fixed paths (circles, each about its parent), so the system can never drift apart, and where
// anything is depends only on what time it is: time can be set, held or run back and everything is where it should
// be. The paths are not arbitrary: each body's period is the one real gravity gives a circle of that size, so that
// whatever is free (a walker in the air, a ship) and is pulled by real gravity sees a sky that obeys the same law.
//
// Distances are metres, times seconds. Everything is small and close: that is the point.
import * as THREE from 'three';

const TAU = Math.PI * 2, G0 = 9.8;
/** The pull of a body: its surface gravity times its radius squared (m³/s²). */
const mu = (surface, radius) => surface * radius * radius;
/** How long a circle of radius `a` about a body of pull `m` takes. */
const period = (a, m) => TAU * Math.sqrt((a * a * a) / m);

// The sun's pull is what makes a year of eight minutes at seven kilometres.
const SUN_MU = (4 * Math.PI * Math.PI * 7000 ** 3) / 480 ** 2;
export const PLAN = {
  sun: { radius: 1200, mu: SUN_MU },
  // (its day: the sun comes round every ten minutes. It turns the way it goes round the sun, so it must turn once
  // against the stars in rather less: 1/day = 1/turn - 1/year)
  home: { radius: 220, mu: mu(G0, 220), about: 'sun', a: 7000, phase: 0.0, tilt: 0.21, day: 600 },
  moon: { radius: 70, mu: mu(0.3 * G0, 70), about: 'home', a: 900, phase: 2.4, incline: 0.16, locked: true },
  far: { radius: 300, mu: mu(1.1 * G0, 300), about: 'sun', a: 11000, phase: 5.55, tilt: 0.4, day: 420 },
};

export function createSystem() {
  const bodies = {};
  for (const [name, p] of Object.entries(PLAN)) {
    const b = { name, ...p, pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), year: 0, turn: 0, axis: new THREE.Quaternion() };
    if (p.about) {
      b.year = period(p.a, PLAN[p.about].mu);
      // once round against the stars: as often as its year for a moon that keeps one face to its world
      b.turn = p.locked ? b.year : 1 / (1 / p.day + 1 / b.year);
      b.axis.setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.tilt ?? 0);
      b.plane = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p.incline ?? 0);
    }
    bodies[name] = b;
  }
  const order = ['sun', 'home', 'far', 'moon'], spin = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), inv = new THREE.Quaternion();
  const system = {
    bodies, time: 0,
    /** Puts every body where it is at time t. */
    set(t) {
      system.time = t;
      for (const name of order) {
        const b = bodies[name];
        if (!b.about) continue;
        const parent = bodies[b.about], w = TAU / b.year, ang = b.phase + w * t;
        b.pos.set(Math.cos(ang) * b.a, 0, -Math.sin(ang) * b.a).applyQuaternion(b.plane).add(parent.pos);
        b.vel.set(-Math.sin(ang) * b.a * w, 0, -Math.cos(ang) * b.a * w).applyQuaternion(b.plane).add(parent.vel);
        // (a locked moon faces its world: its turn starts where its place on its path does)
        b.quat.copy(b.axis).multiply(spin.setFromAxisAngle(UP, (TAU / b.turn) * t + (b.locked ? b.phase : 0)));
      }
    },
    /** Where another body is, and how it is turned, as seen from a body's own ground (which turns with it). */
    seenFrom(from, other, pos, quat) {
      inv.copy(from.quat).invert();
      pos.copy(other.pos).sub(from.pos).applyQuaternion(inv);
      if (quat) quat.copy(inv).multiply(other.quat);
      return pos;
    },
    /** The pull at a place in a body's own frame (m/s², toward its middle), from that body alone. */
    pull(body, p, out) {
      const r2 = Math.max(p.lengthSq(), (body.radius * 0.5) ** 2);
      return out.copy(p).multiplyScalar(-body.mu / (r2 * Math.sqrt(r2)));
    },
    /** The time at which the sun stands at a given height (its sine, -1..1) over a place on a body, going down (dusk) or coming up, next after t0. */
    when(body, place, sine, { setting = true, from = 0 } = {}) {
      const up = v, sunAt = new THREE.Vector3(), at = (t) => { system.set(t); return system.seenFrom(body, bodies.sun, sunAt).normalize().dot(up.copy(place).normalize()); };
      const keep = system.time, step = 1;
      let found = from;
      for (let t = from; t < from + 2400; t += step) {
        const a = at(t), b = at(t + step);
        if ((setting ? a >= sine && b < sine : a <= sine && b > sine)) { found = t + (step * (a - sine)) / (a - b); break; }
      }
      system.set(keep);
      return found;
    },
  };
  system.set(0);
  return system;
}
