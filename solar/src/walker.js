// Whoever is walking on a world: seen through their eyes.
//
// A small world has no fixed "up": up is wherever the ground is not. So nothing here is kept as a compass bearing.
// The walker is a place (from the world's middle), and a way they are facing that lies along the ground; as they
// walk on, that facing is carried with them, turned only as much as the ground itself has turned under their feet.
// Walk straight on and you come back to where you began, still facing the way you set out.
//
// They can also leave their body and fly (for looking at a world from far off, until there is a ship): the eye
// goes where it looks, faster the higher it is.
import * as THREE from 'three';

const EYE = 1.66, WALK = 4.2, RUN = 6.6, JUMP = 4.6, FALL = 12.5;
/** How far the eye's rise and fall has gone per metre walked (radians): one dip, and so one step, every 1.85 m. */
export const BOB = 3.4;
const up = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3(), flat = new THREE.Vector3(), v = new THREE.Vector3(), q = new THREE.Quaternion();

export class Walker {
  /** land: the ground (see land.js). colliders: [{ dir, r }] trunks and stones, each a direction and a width. */
  constructor(land, colliders = []) {
    this.land = land; this.colliders = colliders; this.fall = FALL;
    this.feet = new THREE.Vector3(); this.fwd = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.pitch = 0.04; // + looks down
    this.speed = 0; this.stride = 0; this.air = 0; this.landed = 0; this.grounded = true;
    // flying free of the body: where the eye is, how it is turned, how fast it goes
    this.flying = false; this.eye = new THREE.Vector3(); this.turn = new THREE.Quaternion(); this.drift = new THREE.Vector3();
    // floor: a rule for what is underfoot in place of the ground (a ship's deck). also: more that is in the way (feet) => {}
    this.floor = null; this.also = null; this.soft = 0; this.wasFloor = null;
    this.place(land.places.start, new THREE.Vector3(1, 0, 0));
  }

  /** Moves them to another world: its ground, what stands on it, and how hard it pulls (1 is home). */
  setWorld(land, colliders, pull = 1) { this.land = land; this.colliders = colliders; this.fall = FALL * pull; }

  /** Sets them down on the ground at a direction from the world's middle, facing as nearly `toward` as the ground allows. */
  place(dir, toward) {
    up.copy(dir).normalize();
    this.feet.copy(up).multiplyScalar(this.land.ground(up));
    this.fwd.copy(toward).addScaledVector(up, -toward.dot(up));
    if (this.fwd.lengthSq() < 1e-6) this.fwd.set(up.y, -up.x, 0);
    this.fwd.normalize();
    this.vel.set(0, 0, 0); this.grounded = true; this.speed = 0; this.flying = false;
  }

  update(dt, inp) {
    if (this.flying) return this.fly(dt, inp);
    const f = this.feet, land = this.land;
    up.copy(f).normalize();
    // turning: about the upright
    this.fwd.applyAxisAngle(up, -inp.look.x);
    this.pitch = THREE.MathUtils.clamp(this.pitch + inp.look.y, -1.35, 1.35);
    right.crossVectors(this.fwd, up);
    // where they mean to go, along the ground
    // (wading is slow going)
    const top = (inp.sprint ? RUN : WALK) * ((land.water?.(up) ?? 0) > 0.2 ? 0.55 : 1);
    wish.copy(this.fwd).multiplyScalar(inp.move.y * top).addScaledVector(right, inp.move.x * top);
    const rise = this.vel.dot(up);
    flat.copy(this.vel).addScaledVector(up, -rise);
    flat.lerp(wish, 1 - Math.exp(-dt * (this.grounded ? 11 : 2.5)));
    f.addScaledVector(flat, dt);
    // trunks and stones
    for (const c of this.colliders) {
      const along = f.dot(c.dir);
      if (along < 0) continue;
      v.copy(f).addScaledVector(c.dir, -along);
      const d = v.length(), min = c.r + 0.32;
      if (d < min && d > 1e-4) f.addScaledVector(v, (min - d) / d);
    }
    if (this.also) this.also(f);
    // the ground has turned under them: what lay along it is laid along it again
    const r0 = f.length();
    up.copy(f).divideScalar(r0);
    this.fwd.addScaledVector(up, -this.fwd.dot(up)).normalize();
    flat.addScaledVector(up, -flat.dot(up));
    // the ground, and leaving it
    const g = this.floor ? this.floor(up) : land.ground(up);
    // (stepping onto a deck or off it, the feet are not snatched to their new height)
    if (this.floor !== this.wasFloor) { this.wasFloor = this.floor; this.soft = 0.3; }
    this.soft = Math.max(0, this.soft - dt);
    let r = this.grounded ? (this.soft > 0 ? r0 + (g - r0) * Math.min(1, dt * 14) : g) : r0, vr = this.grounded ? 0 : rise;
    if (this.grounded && inp.jump) { vr = JUMP; this.grounded = false; this.air = 0; }
    if (!this.grounded) {
      vr -= this.fall * dt; r += vr * dt; this.air += dt;
      if (r <= g && vr < 0) { r = g; this.landed = Math.min(1, -vr / 6); vr = 0; this.grounded = true; }
    }
    f.copy(up).multiplyScalar(r);
    this.vel.copy(flat).addScaledVector(up, vr);
    this.landed = Math.max(0, this.landed - dt * 3.2);
    this.speed = flat.length();
    if (this.grounded) this.stride += this.speed * dt;
  }

  /** Leaves the body where it stands and flies; or comes back down to the ground under the eye. */
  toggleFlight(camera) {
    if (!this.flying) {
      this.flying = true;
      this.eye.copy(camera.position); this.turn.copy(camera.quaternion); this.drift.set(0, 0, 0);
    } else {
      v.set(0, 0, -1).applyQuaternion(this.turn);
      this.place(this.eye.clone().normalize(), v);
      this.pitch = 0.04;
    }
  }

  fly(dt, inp) {
    up.copy(this.eye).normalize();
    // (it turns about the upright of whatever is under it, so the horizon stays level; far out, about itself)
    q.setFromAxisAngle(up, -inp.look.x); this.turn.premultiply(q);
    right.set(1, 0, 0).applyQuaternion(this.turn);
    q.setFromAxisAngle(right, -inp.look.y); this.turn.premultiply(q).normalize();
    const high = Math.max(this.eye.length() - this.land.radius, 2), top = Math.max(6, high * 0.7) * (inp.sprint ? 4 : 1);
    wish.set(inp.move.x, (inp.jump || inp.rise ? 1 : 0) - (inp.sink ? 1 : 0), -inp.move.y).multiplyScalar(top).applyQuaternion(this.turn);
    this.drift.lerp(wish, 1 - Math.exp(-dt * 5));
    this.eye.addScaledVector(this.drift, dt);
    // (not into the ground)
    const g = this.land.ground(up.copy(this.eye).normalize()) + 0.4;
    if (this.eye.length() < g) this.eye.setLength(g);
    this.speed = this.drift.length();
  }

  /** How high the eye is over the world's own radius. */
  get height() { return (this.flying ? this.eye.length() : this.feet.length() + EYE) - this.land.radius; }

  /** Puts the eye where theirs is. */
  look(camera) {
    if (this.flying) { camera.position.copy(this.eye); camera.quaternion.copy(this.turn); return; }
    const s = Math.min(1, this.speed / WALK);
    const bob = Math.sin(this.stride * BOB) * 0.028 * s, sway = Math.cos(this.stride * BOB * 0.5) * 0.016 * s;
    up.copy(this.feet).normalize();
    right.crossVectors(this.fwd, up);
    camera.position.copy(this.feet).addScaledVector(up, EYE + bob - 0.09 * this.landed).addScaledVector(right, sway);
    // looking along the ground, then tipped down or up
    const c = Math.cos(this.pitch), sn = Math.sin(this.pitch);
    v.copy(this.fwd).multiplyScalar(c).addScaledVector(up, -sn);
    camera.up.copy(up).multiplyScalar(c).addScaledVector(this.fwd, sn);
    camera.lookAt(flat.copy(camera.position).add(v));
  }
}
