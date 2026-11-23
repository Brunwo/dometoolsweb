// The autopilot: it takes the ship to a world that has been locked, stops it a little way off, holds it there at
// that world's own speed, and gives it back for the landing, which is the pilot's.
//
// It flies with the same thrusters a pilot has, no harder, by asking for them as a hand would (ship.update is told
// what to push, never where to be). It works out the speed it wants, toward the place it is making for, from how
// much room there is left to stop in; pushes toward that speed; and carries the ship against whatever is pulling
// on it meanwhile. It turns the ship to face where it is going, so the world comes up in the window. A world in
// the way is gone round, not through.
//
// It is over when the ship is where it was going and still: then it holds (as holding X does) until the pilot
// pushes on anything.
import * as THREE from 'three';
import { PUSH, LIFT } from './ship.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** How far over a world's ground it stops: nearer a small one. */
export const standOff = (radius) => THREE.MathUtils.clamp(radius * 0.7, 70, 150);
const FASTEST = 180, BRAKE = 11, SETTLE = 0.6, CLEAR = 55, TURN = 0.9;
const clamp1 = (v) => Math.min(1, Math.max(-1, v));

export function createPilot() {
  const r = V(), dir = V(), c = V(), n = V(), g = V(), a = V(), w = V(), t = V(), vrel = V(), fwd = V(), q = new THREE.Quaternion();
  const ctl = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, up: 0, down: 0, roll: 0, match: false, matchTo: null, board: false, free: false, fine: true };
  let state = 'off', to = null, still = 0, left = 0;
  return {
    /** 'off', 'go' (on its way) or 'hold' (there, and holding still by it). */
    get state() { return state; },
    /** Which world it is making for. */
    get to() { return to; },
    /** How far it has still to go, metres (while it is on its way). */
    get left() { return left; },
    start(key) { state = 'go'; to = key; still = 0; },
    stop() { state = 'off'; to = null; },
    /**
     * A step of it. target: { at, vel, body } (the world it is making for, as the frame the ship is in has it);
     * env: what ship.update is given; hand: what the pilot is asking for (their look is passed on while it holds,
     * and always turns their head if they are looking about). Gives back what to ask of the ship, or nothing.
     */
    step(dt, ship, env, target, hand) {
      if (state === 'off') return null;
      const own = target.body === env.body;
      ctl.board = false; ctl.free = !!hand?.free; ctl.roll = 0;
      if (state === 'hold') {
        ctl.move.x = ctl.move.y = ctl.up = ctl.down = 0; ctl.fine = false;
        ctl.match = true; ctl.matchTo = own ? null : target.vel;
        ctl.look.x = hand?.look.x ?? 0; ctl.look.y = hand?.look.y ?? 0; ctl.roll = hand?.roll ?? 0;
        return ctl;
      }
      // where it is making for: the place so far over that world's ground, on the side the ship comes from
      r.copy(target.at).sub(ship.pos);
      const far = r.length(), togo = far - target.body.radius - standOff(target.body.radius);
      dir.copy(r).divideScalar(far).multiplyScalar(Math.sign(togo) || 1);
      left = Math.abs(togo);
      // a world in the way is gone round. From outside it, the way is the line that just clears it, on the side
      // the straight way already leans to. From close in (standing on it, with the other world under one's feet)
      // the way is up and along, more up the nearer the ground, until it is clear.
      // (the sun is gone round too, by a long way: env.avoid)
      const ways = env.avoid ? env.others.concat(env.avoid) : env.others;
      for (let i = -1; i < ways.length; i++) {
        const body = i < 0 ? env.body : ways[i].body;
        if (body === target.body) continue;
        if (i < 0) c.copy(ship.pos).negate(); else c.copy(ways[i].at).sub(ship.pos);
        const along = c.dot(dir), clear = body.radius + CLEAR, from = c.length();
        if (along <= 0 || along > left + clear) continue;
        if (n.copy(c).addScaledVector(dir, -along).length() >= clear) continue;
        // (which way round: the straight way, less whatever of it is toward that world's middle)
        c.divideScalar(from);
        n.copy(dir).addScaledVector(c, -dir.dot(c));
        if (n.lengthSq() < 1e-6) { n.set(0, 0, -1).applyQuaternion(ship.quat).addScaledVector(c, -n.dot(c)); if (n.lengthSq() < 1e-6) n.set(1, 0, 0).applyQuaternion(ship.quat).addScaledVector(c, -n.dot(c)); }
        n.normalize();
        if (from <= clear) { const deep = Math.min(1, (clear - from) / CLEAR); dir.copy(n).multiplyScalar(1 - 0.6 * deep).addScaledVector(c, -(0.25 + deep)).normalize(); }
        else { const lean = Math.min(1.5, Math.asin(clear / from) * 1.08); dir.copy(c).multiplyScalar(Math.cos(lean)).addScaledVector(n, Math.sin(lean)).normalize(); }
      }
      // the speed wanted: all that there is room to stop from, and gently in at the end
      const speed = Math.min(FASTEST, Math.sqrt(2 * BRAKE * left), left / 1.1);
      vrel.copy(ship.vel); if (!own) vrel.sub(target.vel);
      // what is pulling on the ship (the worlds, and what a turning frame adds): it is carried against all of it
      env.pull(env.body, ship.pos, g);
      for (const o of env.others) g.add(env.pull(o.body, t.copy(ship.pos).sub(o.at), n));
      g.sub(env.swing);
      if (env.sunPull) g.add(env.sunPull(ship.pos, n));
      w.set(0, env.turn, 0);
      g.addScaledVector(n.crossVectors(w, ship.vel), -2);
      g.sub(n.crossVectors(w, t.crossVectors(w, ship.pos)));
      a.copy(dir).multiplyScalar(speed).sub(vrel).multiplyScalar(1 / SETTLE).sub(g);
      // (asked of the thrusters, each way as hard as that one can push)
      a.applyQuaternion(q.copy(ship.quat).invert());
      const lift = clamp1(a.y / LIFT);
      ctl.move.x = clamp1(a.x / PUSH); ctl.move.y = clamp1(-a.z / PUSH); ctl.up = Math.max(0, lift); ctl.down = Math.max(0, -lift);
      ctl.fine = true; ctl.match = false; ctl.matchTo = null;
      ctl.look.x = ctl.free ? hand.look.x : 0; ctl.look.y = ctl.free ? hand.look.y : 0;
      // it turns to face the world it is making for (but not close to the ground, where the ship stands itself up)
      if (!ship.landed && ship.alt > 40) {
        fwd.set(0, 0, -1).applyQuaternion(ship.quat);
        t.copy(r).divideScalar(far);
        const off = fwd.angleTo(t);
        if (off > 0.004) {
          n.crossVectors(fwd, t);
          if (n.lengthSq() < 1e-8) n.set(0, 1, 0).applyQuaternion(ship.quat);
          // (slowing as it comes round, so that it does not arrive with a jerk)
          ship.quat.premultiply(q.setFromAxisAngle(n.normalize(), Math.min(off, TURN * dt * Math.min(1, off / 0.35 + 0.08)))).normalize();
        }
      }
      // there, and still: it holds
      still = left < 8 && vrel.length() < 2 ? still + dt : 0;
      if (still > 0.4) state = 'hold';
      return ctl;
    },
  };
}
