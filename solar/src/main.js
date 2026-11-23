// A small solar system, painted. Two worlds one can stand on (the home world and its moon), a sun, a far world in
// the sky, and a ship to cross between them: all of them really there and really moving.
//   ?capture       no clock: window.lab.step(dt, n) advances it (for stills and films)
//   ?patch-test=1  as Patch's test opens it: the title is shown, then it begins by itself; the menu never comes up
//                  over the game; and no controller is read (whatever is plugged into the PC that tests it)
//   ?bare          with no recordings: only the sound that is made in code (as a copy of the repo sounds)
//   ?time=120      the system's time at the start, in seconds (otherwise: late in the day where one stands)
//
// Every world is drawn in its own frame, as if it were the one underfoot: its middle the origin, its ground still.
// Whoever is looking is in one of those frames (the world they stand on, or the one their ship is nearest), and
// where that eye is in the other world's frame is worked out each frame. So nothing changes hands on the way from
// one world to the other: both are always drawn the same way, and only the numbers the eye is kept in change.
import * as THREE from 'three';
// (before anything makes a material: the dome's single-view warp has to see every one; it does nothing without ?dome)
import './domewarp.js';
import { createSystem } from './system.js';
import { createLand } from './land.js';
import { createAir } from './air.js';
import { createGround } from './world.js';
import { createGrass } from './grass.js';
import { createPaint } from './paint.js';
import { createTrees, makeKinds } from './trees.js';
import { createMoon } from './moon.js';
import { createSky } from './sky.js';
import { createPage } from './page.js';
import { Walker, BOB } from './walker.js';
import { Ship, DECK, OUTSIDE, PUSH, LIFT, SUIT, loadShip, shipIn, shipGlass, shipVisor, deckHeight, deckKeep, rampTo } from './ship.js';
import { createPrints, createDials } from './prints.js';
import { createDesk, metres } from './desk.js';
import { Input } from './input.js';
import { createPilot } from './pilot.js';
import { createMotes } from './motes.js';
import { createCover } from './cover.js';
import { createWater } from './water.js';
import { write, width } from './hand.js';
import { createMenu } from './menu.js';
import { createSound } from './sound.js';
import { createWords } from './words.js';
import { createDome } from './dome.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture'), testing = q.has('patch-test');
const timings = {};
let mark = performance.now();
const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };
// (what is said to whoever is playing: drawn, like everything written here)
const words = createWords({ quiet: capture && !q.has('keys') });
// the picture shown while the worlds are made, the title, and the menu (most of what it works on is made further down)
const menu = createMenu({
  quiet: capture && !q.has('menu'), auto: testing,
  get input() { return input; }, words,
  get blur() { return [document.getElementById('view'), desk.glass]; },
  ui: (kind, n) => sound?.ui(kind, n), wake: () => sound?.wake(),
  apply(s) { if (sound) { sound.volume = s.sound; sound.musicVolume = s.music; } input.sensitivity = 0.0022 * s.look; input.stickSpeed = s.stick; input.invertY = s.invert; input.rumble = s.rumble; },
  // (from the title's eye, out over the world, to one's own: through a blink)
  begin() { input.override = null; titleEye = false; veil.classList.add('on'); setTimeout(() => veil.classList.remove('on'), 90); sound?.wake(); renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); },
  resume() { sound?.wake(); renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); },
  wakeByShip() { burn = 1; wake(); },
});
const say = (text) => menu.loading(text);
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2, FOV = 62;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('view').appendChild(renderer.domElement);
// ?dome: the picture as a fulldome dome master (see dome.js)
const dome = q.has('dome') ? createDome(renderer, q) : null;
lap('start');

say('Setting the worlds going');
await turn();
const system = createSystem(), B = system.bodies;
say('Raising the hills');
await turn();
const land = createLand({ radius: B.home.radius });
lap('land');
const air = createAir(land);
const homeScene = new THREE.Scene();
homeScene.add(createGround(air, land));
// grass in two rings: thick underfoot, thinner out to where the world curves away
const grass = [
  createGrass(air, land, { count: 380000, tile: 34, segs: 4, fade: [9, 13.5, 6, -100], size: [0.016, 0.42, 0.012], seed: 11 }),
  createGrass(air, land, { count: 300000, tile: 88, segs: 2, fade: [27, 41, 12, 8], size: [0.03, 0.46, 0.022], seed: 23 }),
];
// what drifts in the air
for (const g of grass) homeScene.add(g.group);
const motes = createMotes(air);
homeScene.add(motes.points);
homeScene.add(createWater(air, land));
say('Planting the woods');
await turn();
// (the hour it begins at: late in the day where one stands, the sun's foot on the edge of the world)
const startTime = q.has('time') ? +q.get('time') : system.when(B.home, land.places.start, -0.05, { setting: true });
system.set(startTime);
const sunset = system.seenFrom(B.home, B.sun, V(0, 0, 0)).normalize();
const kinds = makeKinds(), paint = createPaint(air);
const trees = createTrees(paint, land, { at: land.places.start, facing: sunset }, { kinds });
homeScene.add(trees.group);
// (where the crowns are, as a picture: for the trees' shade seen from far off, and the grass under them)
{ const cover = createCover(land, trees.planted); air.uniforms.tCover.value = cover.texture; air.uniforms.uCover.value.x = cover.squares; }
lap('trees');
timings.planted = trees.count;
say('Cratering the moon');
await turn();
const moon = createMoon(B.moon, kinds);
lap('moon');
const sky = createSky(system);
const page = createPage(renderer, land);
air.uniforms.uSunSize.value = page.uniforms.uSunSize.value = B.sun.radius / B.home.a;
moon.air.uniforms.uSunSize.value = B.sun.radius / B.home.a;

// A lamp for each world: it is only there to throw the shadows of what stands near whoever is looking (see air.js).
function makeLamp(scene) {
  const lamp = new THREE.DirectionalLight('#ffffff', Math.PI);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(4096, 4096);
  Object.assign(lamp.shadow.camera, { left: -64, right: 64, top: 64, bottom: -64, near: 10, far: 420 });
  lamp.shadow.camera.updateProjectionMatrix();
  lamp.shadow.bias = -0.0006;
  lamp.shadow.normalBias = 0.05;
  lamp.shadow.radius = 1.6;
  scene.add(lamp, lamp.target);
  return lamp;
}
const eyeOf = () => new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 2000);
/** The worlds that are places. sun: the way to the sun in that world's frame. pull: how hard it pulls at its ground, against home. */
const worlds = {
  home: { name: 'home', title: 'Home', body: B.home, land, air, scene: homeScene, colliders: trees.colliders, camera: eyeOf(), lamp: makeLamp(homeScene), sun: V(0, 1, 0), pull: 1, parked: false },
  moon: { name: 'moon', title: 'The moon', body: B.moon, land: moon.land, air: moon.air, scene: moon.scene, colliders: moon.stones.colliders, camera: eyeOf(), lamp: makeLamp(moon.scene), sun: V(0, 1, 0), pull: (B.moon.mu / B.moon.radius ** 2) / (B.home.mu / B.home.radius ** 2), parked: false },
};
const behind = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 30, 90000);
const input = new Input(renderer.domElement, { pads: (!capture || q.has('pad')) && !q.has('nopad') && !testing });

// Sound. A film or a check is made with no clock and no sound card: then the sound is worked out alongside, frame by
// frame, only when it is asked for (?capture&sound=<seconds>).
const sound = q.has('nosound') || (capture && !q.get('sound')) ? null : (() => { try { return createSound({ offline: capture ? Number(q.get('sound')) : 0 }); } catch (e) { console.warn('no sound:', e); return null; } })();
if (sound && !capture) {
  for (const what of ['pointerdown', 'keydown']) addEventListener(what, () => sound.wake());
  addEventListener('keydown', (e) => { if (e.code === 'KeyM') sound.quiet = !sound.quiet; });
}

// --- who is looking: on foot on a world, or in the ship ---
let on = 'home', mode = 'foot';
say('Fitting out the ship');
const kit = await loadShip();
const walker = new Walker(land, trees.colliders);
const ship = new Ship();
// what every part of the ship shares: its lamps, how far its ramp is down, the faint light there is everywhere
const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.needsUpdate = true;
const shipLight = { uLamps: { value: 1 }, uDoor: { value: 1 }, uFill: { value: new THREE.Color(0.012, 0.014, 0.02) }, uThrust: { value: new THREE.Vector3() }, uLit: { value: [0, 0, 0, 0, 0, 0, 0, 0] }, uBack: { value: 0.5 }, tPrint: { value: blank }, tDial: { value: blank } };
// what is printed on things in it, and its dials
const prints = createPrints(), dials = createDials();
shipLight.tPrint.value = prints.texture; shipLight.tDial.value = dials.texture;
const hands = { turn: 0, nod: 0, lift: 0, push: 0 };
const glass = shipGlass();
const desk = createDesk(renderer, system, [{ key: 'home', title: 'Home', body: B.home }, { key: 'moon', title: 'The moon', body: B.moon }, { key: 'far', title: 'The far world', body: B.far }, { key: 'sun', title: 'The sun', body: B.sun }], dials, LIFT * 0.78);
const faces = desk.faces;
for (const w of Object.values(worlds)) {
  // (the ship is one thing, but each world paints with its own light: so each has the ship, and shows it when it is there)
  w.skyK = { value: 1 };
  const made = shipIn(w.air, kit, { ...shipLight, uSkyK: w.skyK }, faces, glass);
  w.ship = made.group; w.ramp = made.ramp; w.hands = made; w.suit = made.suit;
  // (what is seen of the helmet from inside it: lit by the sky there is, and a little by its own small lamp)
  w.visor = shipVisor(w.air, kit, { ...shipLight, uSkyK: w.skyK, uDoor: { value: 0.6 } });
  if (w.visor) { w.visor.visible = false; w.visor.scale.set(1.07, 1.07, 1); w.scene.add(w.visor); }
  w.scene.add(w.ship);
  w.lamp.layers.enable(1);
}
// the eye for what is within arm's reach when the ship is far from any ground (see page.js)
const nearEye = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 60);
nearEye.layers.set(1);
lap('world');

let time = startTime;
let rate = 1, held = false;
// where the ship first stood, and which way it faced: where one comes back to
let homeSpot = null, homeAhead = null;
const tmp = V(0, 0, 0), tmp2 = V(0, 0, 0), sx = V(0, 0, 0), sy = V(0, 0, 0), eyeUp = V(0, 0, 0), at = V(0, 0, 0), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
{
  // (facing the low sun; the ship stands a little ahead and to the left, its window to the sunset)
  system.set(time);
  walker.place(land.places.start, system.seenFrom(B.home, B.sun, tmp).clone());
  const up = land.places.start, ahead = sunset.clone().addScaledVector(up, -sunset.dot(up)).normalize(), right = ahead.clone().cross(up);
  // (in the nearest clearing wide enough for it, and for its ramp)
  let spot = null;
  for (let ring = 0; ring < 8 && !spot; ring++) for (let k = 0; k < (ring ? 12 : 1) && !spot; k++) {
    const dir = up.clone().multiplyScalar(land.radius).addScaledVector(right, -8 + Math.cos(k * 0.5236) * ring * 3).addScaledVector(ahead, 15 + Math.sin(k * 0.5236) * ring * 3).normalize();
    if (trees.colliders.every((c) => c.dir.distanceTo(dir) * land.radius > 7.5 + c.r)) spot = dir;
  }
  homeSpot = spot ?? up.clone().multiplyScalar(land.radius).addScaledVector(right, -8).addScaledVector(ahead, 15).normalize(); homeAhead = ahead.clone();
  ship.park('home', land, homeSpot, homeAhead);
}

// --- aboard: the ship's room and ramp are ground to walk on while it stands ---
/** aboard: on its ramp or in its room. door: how far the ramp is down, 0 shut to 1. ease: the eye is on its way between standing and the seat. */
let aboard = false, door = 1, ease = 0;
/** The suit: on or off; and how far its helmet has come down over the eye. */
let suited = false, visorK = 0;
/** Whoever is on their feet in the room while the ship flies: where, in the ship's own directions, and which way they look (pitch: + down). */
const cab = { x: 0, z: 0.6, yaw: 0, pitch: 0, vx: 0, vz: 0, speed: 0, stride: 0, grounded: true, landed: 0 };
const IDLE = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, up: 0, down: 0, roll: 0, match: false }, Yax = V(0, 1, 0), Xax = V(1, 0, 0);
const local = V(0, 0, 0), shipUp = V(0, 0, 0), sq = new THREE.Quaternion(), easeFrom = { pos: V(0, 0, 0), quat: new THREE.Quaternion() };
/** A place in the frame of the world the ship stands on, in the ship's own directions; and back. */
const toShip = (p, out) => out.copy(p).sub(ship.pos).applyQuaternion(sq.copy(ship.quat).invert());
const fromShip = (p, out) => out.copy(p).applyQuaternion(ship.quat).add(ship.pos);
/** How far from the world's middle the ship's floor (or its ramp) is, along a line out from the middle. */
function deckGround(up) {
  toShip(shipUp.copy(up).multiplyScalar(walker.feet.length()), local);
  const h = deckHeight(local.x, local.z);
  shipUp.set(0, 1, 0).applyQuaternion(ship.quat);
  return (h + ship.pos.dot(shipUp)) / up.dot(shipUp);
}
/** Where someone on foot cannot go because the ship is there. */
walker.also = (f) => {
  if (ship.on !== on) return;
  toShip(f, local);
  if (local.lengthSq() > 64) return;
  const y = local.y;
  if (aboard) deckKeep(local, door > 0.95);
  else {
    const lane = Math.abs(local.x) < 0.56 && local.z > 0 && local.z < DECK.hinge + DECK.run + 0.1;
    if (lane && deckHeight(local.x, local.z) - DECK.drop > 0.3) local.x = Math.sign(local.x || 1) * 0.56;
    for (const [cx, cz, r] of OUTSIDE) {
      if (cx === 0 && lane) continue;
      const dx = local.x - cx, dz = local.z - cz, d = Math.hypot(dx, dz), min = r + 0.3;
      if (d < min && d > 1e-4) { local.x = cx + (dx / d) * min; local.z = cz + (dz / d) * min; }
    }
  }
  local.y = y;
  fromShip(local, f);
};
function sit() {
  mode = 'ship'; ship.head.yaw = ship.head.pitch = 0;
  easeFrom.pos.copy(worlds[on].camera.position); easeFrom.quat.copy(worlds[on].camera.quaternion); ease = 1;
}
/** On one's feet in the room, the ship standing: beside the seat, or at a place in the ship's own directions, looking a given way. */
function stand(x = -0.66, z = -0.3, yaw = ship.head.yaw, pitch = -ship.head.pitch) {
  const w = worlds[ship.on];
  mode = 'foot'; on = ship.on; aboard = true;
  easeFrom.pos.copy(w.camera.position); easeFrom.quat.copy(w.camera.quaternion); ease = 1;
  walker.setWorld(w.land, w.colliders, w.pull);
  walker.flying = false; walker.floor = deckGround;
  fromShip(local.set(x, DECK.floor, z), walker.feet);
  const up = walker.feet.clone().normalize();
  walker.fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)).applyQuaternion(ship.quat);
  walker.fwd.addScaledVector(up, -walker.fwd.dot(up)).normalize();
  walker.pitch = pitch; walker.vel.set(0, 0, 0); walker.grounded = true; walker.speed = 0;
}
/** Getting up from the seat while the ship flies: the room's floor is down, whichever way the ship is pointing. */
function rise() {
  const cam = worlds[on].camera;
  mode = 'cabin'; aboard = true;
  easeFrom.pos.copy(cam.position); easeFrom.quat.copy(cam.quaternion); ease = 1;
  Object.assign(cab, { x: -0.66, z: -0.3, yaw: ship.head.yaw, pitch: -ship.head.pitch, vx: 0, vz: 0, speed: 0 });
}
/** Is the other world now the nearer? Then the ship is kept in its frame from here on. */
function nearer() {
  if (ship.landed) return;
  const here = worlds[ship.on], there = worlds[other(ship.on)];
  system.seenFrom(here.body, there.body, at);
  if (ship.pos.distanceTo(at) - there.body.radius < 0.9 * over(here, ship.pos)) { reframe(here.body, there.body, ship.pos, ship.vel, ship.quat); ship.on = there.name; desk.track(0, there); }
}
/** What someone on their feet in the room can do where they stand (x, z in the ship's directions): sit, or put the suit on or take it off. Returns what to ask. */
function reach(x, z, press) {
  if (z < 0.9 && Math.hypot(x - DECK.seat.x, z - DECK.seat.z) < 1.2) { if (press) sit(); return 'E  sit'; }
  const noAir = ship.landed && ship.on !== 'home' && !suited && z > 1.5 && Math.abs(x) < 0.8;
  if (kit.parts.suit && z < DECK.hinge - 0.4 && Math.hypot(x - SUIT.x, z - SUIT.z) < 1.3) { if (press) suited = !suited; return suited ? 'E  take the suit off' : noAir ? 'No air out there  ·  E  put the suit on' : 'E  put the suit on'; }
  if (noAir) return 'No air out there  ·  the suit is on its stand';
  return '';
}

/** What the ship needs to know of the world whose frame it is in. */
const others = { home: [{ body: B.moon, at: V(0, 0, 0) }], moon: [{ body: B.home, at: V(0, 0, 0) }] }, swing = V(0, 0, 0);
// The sun, close to. Within two and a half of its own widths from its middle a ship takes fire; and nearer than
// that it pulls, harder the nearer (it is let alone further off: the worlds go round it and the ship with them).
const SUN_HOT = 2.4 * B.sun.radius, sunIn = V(0, 0, 0), sunRound = [{ body: { radius: SUN_HOT - 55 }, at: sunIn }];
function sunPull(p, out) {
  out.copy(sunIn).sub(p);
  const r = Math.max(out.length(), B.sun.radius * 0.5);
  return out.multiplyScalar(((16 * (B.sun.radius / r) ** 2) * (1 - THREE.MathUtils.smoothstep(r, 2.2 * B.sun.radius, 3.5 * B.sun.radius))) / r);
}
function around(name) {
  const w = worlds[name], o = others[name];
  system.seenFrom(w.body, o[0].body, o[0].at);
  system.seenFrom(w.body, B.sun, sunIn);
  // (the moon's frame is itself swung round the home world: by exactly the home world's pull at the moon's middle)
  if (name === 'moon') system.pull(B.home, tmp.copy(o[0].at).negate(), swing); else swing.set(0, 0, 0);
  return { land: w.land, colliders: w.colliders, body: w.body, turn: TAU / w.body.turn, others: o, swing, pull: system.pull, sunPull, avoid: sunRound };
}
/** Takes a place, a speed and a facing kept in one world's frame into another's. */
function reframe(from, to, p, v, quat) {
  // out of the turning frame, to the stars' own directions about that world's middle
  v.add(tmp.set(0, TAU / from.turn, 0).cross(p));
  p.applyQuaternion(from.quat); v.applyQuaternion(from.quat); quat.premultiply(from.quat);
  // from one middle to the other
  p.add(from.pos).sub(to.pos); v.add(from.vel).sub(to.vel);
  // and into the other's turning frame
  qa.copy(to.quat).invert();
  p.applyQuaternion(qa); v.applyQuaternion(qa); quat.premultiply(qa).normalize();
  v.sub(tmp.set(0, TAU / to.turn, 0).cross(p));
}
const other = (name) => (name === 'home' ? 'moon' : 'home');
/** What is under the walker's feet: grass, dirt (the trodden way), stone, or the moon's dust. */
function surface() {
  if (aboard || mode === 'cabin') return 'stone';
  if (on !== 'home') return 'dust';
  if (land.water(tmp2.copy(walker.feet).normalize()) > 0.08) return 'water';
  const k = land.kind(tmp2.copy(walker.feet).normalize());
  return k[1] > 0.45 ? 'stone' : k[0] > 0.45 ? 'dirt' : 'grass';
}
/** How near the eye is to a tree in leaf on the home world: 0 none within reach, 1 under one. */
const leafy = trees.planted.filter((p) => p.kind.dabs && p.kind.solids);
function treesNear() {
  const eye = worlds.home.camera.position;
  let near = 0;
  for (const p of leafy) { const d = eye.distanceToSquared(p.pos); if (d < 900) near = Math.max(near, 1 - (Math.sqrt(d) - 3 * p.size) / 14); }
  return Math.max(0, Math.min(1, near));
}
/** How far over a world's own radius a place in its frame is. */
const over = (w, p) => p.length() - w.body.radius;

// --- what is said on the glass ---
function tell(text, ask) {
  // (in the seat the desk is at the foot of the picture: what is asked goes to the head of the window)
  words.prompt(ask, mode === 'ship');
  words.doing(mode === 'ship' ? (ship.landed ? 'seat' : 'fly') : mode === 'cabin' ? 'cabin' : aboard ? 'aboard' : 'foot');
}
const veil = document.getElementById('veil');
// While the title is up the world is seen from outside it: from over the edge of day, the sun half gone behind
// the world's rim, low in the picture, and the ground turning slowly away underneath. (It is the picture shown
// while the worlds were made, come true.)
let titleEye = !capture || q.has('menu');
const titleUp = V(0, 0, 0), titleAt = V(0, 0, 0);
function titleView(cam) {
  const s = worlds.home.sun, far = land.radius + 118, rim = Math.asin(land.radius / far) + 0.035;
  titleUp.set(0, 1, 0).cross(s).normalize();
  cam.position.copy(s).multiplyScalar(-far * Math.cos(rim)).addScaledVector(titleUp, far * Math.sin(rim));
  // (the sun's middle stands three tenths of the picture's height below its middle)
  const low = Math.atan(0.6 * Math.tan((cam.fov * Math.PI) / 360));
  cam.up.copy(titleUp);
  cam.lookAt(titleAt.copy(cam.position).addScaledVector(s, Math.cos(low)).addScaledVector(titleUp, Math.sin(low)));
  cam.up.set(0, 1, 0);
}
// the autopilot; and a line said for a few seconds when it cannot do what it was asked
const auto = createPilot();
// how hot the ship is from the sun (0 to 1, and at 1 it is gone); how far everything has gone to white (0 to 1); and
// whether it is going (1) or one is coming back out of it, by the ship at home (2)
let heat = 0, burn = 0, dying = 0, spaceMusic = 0;
const sunAt = V(0, 0, 0);
/** After the end: the ship stands where it first stood, on the home world, and one is on one's feet beside it. */
function wake() {
  ship.park('home', land, homeSpot, homeAhead);
  ship.on = 'home'; ship.landed = true; ship.vel.set(0, 0, 0); ship.lev.set(0, 0, 0); ship.thrust.set(0, 0, 0); ship.push = 0; ship.hard = 0; ship.head.yaw = ship.head.pitch = 0;
  mode = 'foot'; on = 'home'; aboard = false; suited = false; visorK = 0; door = 1; ease = 0;
  walker.setWorld(land, trees.colliders, worlds.home.pull);
  walker.flying = false; walker.floor = null;
  fromShip(local.set(1.5, 0, DECK.hinge + DECK.run + 3.4), tmp);
  walker.place(tmp.clone().normalize(), tmp2.set(-0.38, 0, -1).applyQuaternion(ship.quat));
  desk.locked = null; auto.stop(); heat = 0; dying = 2;
}
let note = '', noteFor = 0;
const named = (key) => desk.seen[key].title.replace(/^The /, 'the ');
let blink = 0, was = 'foot';

function tick(dt) {
  dt = Math.min(dt, 1 / 20);
  // (what a key or a button means depends on what one is doing: see input.js)
  const inp = input.read(dt, mode === 'ship' ? (ship.landed ? 'seat' : 'fly') : mode === 'cabin' ? 'cabin' : 'foot'), k = input.keys;
  inp.rise = k.has('KeyE'); inp.sink = k.has('KeyQ');
  const ctl = { move: inp.move, look: inp.look, up: +inp.up || 0, down: +inp.down || 0, roll: inp.roll || 0, match: !!inp.match, board: !!inp.board, free: !!inp.free, fine: !!inp.fine };
  words.using(input.device === 'pad' ? input.padKind : null);
  if (inp.again) words.again();
  if (inp.menu && !dying && !testing) menu.open();
  // time: it runs; it can be held; and it can be wound on or back
  const wind = (k.has('BracketRight') ? 1 : 0) - (k.has('BracketLeft') ? 1 : 0);
  time += dt * (wind ? wind * 40 : held ? 0 : rate);
  system.set(time);
  desk.track(dt, worlds[mode === 'ship' ? ship.on : on]);
  ctl.matchTo = desk.locked && desk.locked !== ship.on ? desk.seen[desk.locked].vel : null;
  // --- the autopilot: asked for from the seat; it goes on if the pilot gets up; it is off when they push on anything ---
  let flown = null;
  noteFor = Math.max(0, noteFor - dt);
  if (mode !== 'ship' && mode !== 'cabin') auto.stop();
  else {
    if (inp.auto && mode === 'ship') {
      // (it goes to what is locked; with nothing locked, to what is framed, which it locks. Asked again on its
      // way, or while it holds with nowhere new to go, it is off; holding, with another world locked, it sets out)
      if (auto.state === 'off' && !desk.locked && desk.nav.m) desk.locked = desk.nav.m.key;
      const key = desk.locked;
      if (auto.state === 'go' || (auto.state === 'hold' && (!key || key === auto.to))) auto.stop();
      else if (!key) { note = 'nothing is locked  ·  R  locks the world framed'; noteFor = 3.5; }
      else if (!worlds[key]) { note = 'the autopilot knows only Home and the moon'; noteFor = 3.5; }
      else auto.start(key);
    } else if (auto.state !== 'off' && mode === 'ship' && (Math.hypot(ctl.move.x, ctl.move.y) > 0.2 || ctl.up > 0.1 || ctl.down > 0.1 || inp.lock || (auto.state === 'go' && (ctl.match || Math.abs(ctl.roll) > 0.3)))) auto.stop();
    if (auto.state !== 'off') flown = auto.step(dt, ship, around(ship.on), desk.seen[auto.to], mode === 'ship' ? ctl : null);
  }

  // --- the sun: near it the ship takes fire, slowly and then fast; let it go on and that is the end of her ---
  if (mode === 'ship' || mode === 'cabin') {
    const far = system.seenFrom(worlds[ship.on].body, B.sun, sunAt).distanceTo(ship.pos), near = THREE.MathUtils.clamp((SUN_HOT - far) / (SUN_HOT - B.sun.radius), 0, 1);
    if (!dying) {
      heat = THREE.MathUtils.clamp(heat + dt * (0.55 * near * near + 3 * near ** 6 - 0.1 * (1 - near)), 0, 1);
      if (heat >= 1 || far < B.sun.radius) { dying = 1; heat = 1; auto.stop(); flown = null; }
    }
  } else if (!dying) heat = Math.max(0, heat - dt * 0.3);
  if (dying === 1) {
    // (nothing answers any more)
    ctl.move = inp.move = { x: 0, y: 0 }; ctl.up = ctl.down = ctl.roll = 0; ctl.match = ctl.board = false; inp.jump = false;
    burn = Math.min(1, burn + dt / 1.3);
    if (burn >= 1) wake();
  } else if (dying === 2) { burn = Math.max(0, burn - dt / 3.4); if (burn <= 0) dying = 0; }
  page.uniforms.uHeat.value = dying === 2 ? 0 : heat; page.uniforms.uBurn.value = burn * burn * (3 - 2 * burn);

  // --- whoever is looking ---
  let ask = '', text = '';
  // the ramp is down only for someone on their feet, with the ship standing, and air outside it or a suit on them
  const doorWant = mode === 'foot' && ship.landed && (ship.on === 'home' || suited) ? 1 : 0;
  door = THREE.MathUtils.clamp(door + THREE.MathUtils.clamp(doorWant - door, -dt / 1.6, dt / 1.6), 0, 1);
  shipLight.uDoor.value = door;
  if (ship.landed) {
    // (the ramp's foot goes down to the ground, however the ship stands)
    const w = worlds[ship.on];
    fromShip(local.set(0, 0, DECK.hinge + DECK.run), tmp);
    tmp2.copy(tmp).normalize();
    rampTo(toShip(tmp2.multiplyScalar(w.land.ground(tmp2)), local).y - 0.03);
  }
  if (mode === 'foot') {
    if (aboard) inp.jump = false;
    walker.update(dt, inp);
    walker.look(worlds[on].camera);
    if (!walker.flying && ship.on === on) {
      // stepping onto the foot of the ramp is coming aboard; walking off its end is leaving
      toShip(walker.feet, local);
      const onRamp = door > 0.95 && Math.abs(local.x) < 0.56 && local.z > DECK.hinge && local.z < DECK.hinge + DECK.run;
      if (!aboard && onRamp && deckHeight(local.x, local.z) - DECK.drop <= 0.3 && Math.abs(local.y - DECK.drop) < 0.8) aboard = true;
      else if (aboard && (local.z > DECK.hinge + DECK.run || (local.z > DECK.hinge + 0.5 && Math.abs(local.x) > 0.57))) aboard = false;
      walker.floor = aboard ? deckGround : null;
      if (aboard) { ask = reach(local.x, local.z, ctl.board); ctl.board = false; }
    } else { aboard = false; walker.floor = null; }
  }
  if (mode === 'cabin') {
    // on one's feet in the room while the ship flies: nobody is at the stick, and it goes on as it was going
    ship.update(dt, flown ?? IDLE, around(ship.on));
    nearer();
    on = ship.on;
    if (ship.landed) { stand(cab.x, cab.z, cab.yaw, cab.pitch); ease = 0; walker.look(worlds[on].camera); }
    else {
      cab.yaw -= inp.look.x; cab.pitch = THREE.MathUtils.clamp(cab.pitch + inp.look.y, -1.35, 1.35);
      const top = inp.sprint ? 3.6 : 2.7, cy = Math.cos(cab.yaw), sy = Math.sin(cab.yaw), k = 1 - Math.exp(-dt * 11);
      cab.vx += ((inp.move.x * cy - inp.move.y * sy) * top - cab.vx) * k; cab.vz += ((-inp.move.x * sy - inp.move.y * cy) * top - cab.vz) * k;
      local.set(cab.x + cab.vx * dt, 0, cab.z + cab.vz * dt);
      deckKeep(local, false);
      cab.speed = Math.hypot(local.x - cab.x, local.z - cab.z) / Math.max(dt, 1e-4); cab.x = local.x; cab.z = local.z; cab.stride += cab.speed * dt;
      const sp = Math.min(1, cab.speed / 4.2), bob = Math.sin(cab.stride * BOB) * 0.028 * sp, sway = Math.cos(cab.stride * BOB * 0.5) * 0.016 * sp, cam = worlds[on].camera;
      cam.quaternion.copy(ship.quat).multiply(qa.setFromAxisAngle(Yax, cab.yaw)).multiply(qb.setFromAxisAngle(Xax, -cab.pitch));
      cam.position.set(cab.x + sway * cy, DECK.floor + 1.66 + bob + 0.05 * ship.hard * Math.sin(ship.shake * 2.3), cab.z - sway * sy).applyQuaternion(ship.quat).add(ship.pos);
      ask = reach(cab.x, cab.z, ctl.board); ctl.board = false;
    }
  }
  if (mode === 'ship') {
    // (it does not lift off with its ramp down)
    if (flown) { flown.board = ctl.board; Object.assign(ctl, flown); }
    if (ship.landed && door > 0.03) ctl.up = 0;
    ship.update(dt, ctl, around(ship.on));
    nearer();
    on = ship.on;
    ship.look(worlds[on].camera, kit.eye, desk.lean);
    const w = worlds[on];
    if (auto.state === 'go') ask = `autopilot to ${named(auto.to)}  ·  G  off`;
    else if (auto.state === 'hold') ask = `holding by ${named(auto.to)}  ·  push on anything to take her`;
    else if (noteFor > 0) ask = note;
    else if (ship.landed) ask = door > 0.03 ? 'E  stand up' : 'Space  lift off  ·  E  stand up';
    // (getting up: on the ground, as ever; in flight, onto the room's own floor, and the ship goes on as it was going)
    if (ctl.board) { if (ship.landed) { stand(); walker.look(w.camera); } else rise(); ask = ''; }
  }
  if (dying === 1) ask = '';
  else if ((mode === 'ship' || mode === 'cabin') && heat > 0.1) ask = heat > 0.5 ? 'she is burning  ·  get away from the sun' : 'the sun is too near  ·  turn away';
  tell(text, ask);
  // (in the hands, on a pad: the engine as hard as it is burning, and the ground when it is met too fast)
  if (mode === 'ship' && !ship.landed) input.feel(0.9 * ship.hard + 0.22 * Math.max(0, ship.push - 0.55) + 0.8 * heat * heat, (ship.push > 0.02 ? 0.1 + 0.3 * Math.min(1, ship.push) : 0) + 0.5 * heat);
  else input.feel(mode === 'cabin' ? 0.6 * ship.hard : 0, 0);
  if (titleEye && on === 'home') { system.seenFrom(B.home, B.sun, worlds.home.sun).normalize(); titleView(worlds.home.camera); ease = 0; }
  // (the eye does not jump between standing and the seat: it is carried across)
  if (ease > 0) {
    ease = Math.max(0, ease - dt / 0.6);
    const k = ease * ease * (3 - 2 * ease), cam = worlds[on].camera;
    cam.position.lerp(easeFrom.pos, k); cam.quaternion.slerp(easeFrom.quat, k);
  }

  // --- the eye, in each world's own frame ---
  const eye = worlds[on].camera;
  eye.updateMatrixWorld(true);
  // the helmet, when it is on: it comes down over the eye, and goes where the eye goes
  visorK = THREE.MathUtils.clamp(visorK + ((suited ? 1 : -1) * dt) / 0.5, 0, 1);
  for (const w of Object.values(worlds)) {
    if (w.suit) w.suit.visible = !suited;
    if (!w.visor) continue;
    w.visor.visible = visorK > 0.001 && w.name === on;
    if (!w.visor.visible) continue;
    const k = visorK * visorK * (3 - 2 * visorK);
    w.visor.quaternion.copy(eye.quaternion);
    w.visor.position.set(0, (1 - k) * 0.7, 0).applyQuaternion(eye.quaternion).add(eye.position);
    w.visor.updateMatrixWorld(true);
  }
  let high = Infinity, far = 0;
  for (const w of Object.values(worlds)) {
    if (w.name !== on) {
      system.seenFrom(worlds[on].body, w.body, at, qa);
      qb.copy(qa).invert();
      w.camera.position.copy(eye.position).sub(at).applyQuaternion(qb);
      w.camera.quaternion.copy(qb).multiply(eye.quaternion);
    }
    w.high = w.camera.position.length() - w.land.ground(tmp.copy(w.camera.position).normalize());
    high = Math.min(high, w.high);
    far = Math.max(far, w.camera.position.length() + w.body.radius + 200);
  }
  // (how near and how far the eye needs to see depends on how high it is over whatever is nearest)
  high = Math.max(high, 0);
  const near = THREE.MathUtils.clamp((high - 1.5) * 0.04, 0.1, 40);
  for (const w of Object.values(worlds)) {
    w.camera.near = near; w.camera.far = far;
    w.camera.updateProjectionMatrix();
    w.camera.updateMatrixWorld(true);
    system.seenFrom(w.body, B.sun, w.sun).normalize();
    w.air.uniforms.uSun.value.copy(w.sun);
    w.air.uniforms.uNow.value = time;
    w.air.uniforms.uEye.value.copy(w.camera.position);
    // (the other world, which can come between this one and the sun)
    { const o = worlds[other(w.name)]; system.seenFrom(w.body, o.body, tmp); w.air.uniforms.uShade.value.set(tmp.x, tmp.y, tmp.z, o.body.radius); }
    // the ship, where it is, its ramp as far down as it has come
    w.ship.visible = ship.on === w.name;
    // (its lamps on the ground round it: all of them by night, a little by day; less the higher it is)
    {
      const glow = w.air.uniforms.uGlow.value;
      if (!w.ship.visible) glow.w = 0;
      else {
        tmp.copy(ship.pos).normalize();
        const night = 1 - THREE.MathUtils.smoothstep(w.sun.dot(tmp), -0.12, 0.22);
        glow.set(tmp.x, tmp.y, tmp.z, 0).multiplyScalar(w.land.ground(tmp)); glow.w = (0.62 * (0.2 + 0.8 * night)) / (1 + (Math.max(ship.alt, 0) / 6) ** 2);
        tmp2.set(0, 0, 1).applyQuaternion(ship.quat); w.air.uniforms.uGlowDoor.value.copy(tmp2).addScaledVector(tmp, -tmp2.dot(tmp)).normalize().multiplyScalar(door);
      }
    }
    if (w.ship.visible) {
      w.ship.position.copy(ship.pos); w.ship.quaternion.copy(ship.quat);
      const s = door * door * (3 - 2 * door);
      w.ramp.rotation.set(THREE.MathUtils.lerp(-Math.PI / 2, DECK.open, s), 0, 0);
      // (the stick leans the way the ship is being turned; the levers go forward with lift and with push)
      w.hands.stick?.rotation.set(-0.3 * hands.nod, 0, -0.3 * hands.turn);
      w.hands.lift?.rotation.set(-0.55 * hands.lift, 0, 0);
      w.hands.push?.rotation.set(-0.55 * hands.push, 0, 0);
      // (the landing glass, as far up from the desk as it has come)
      w.hands.screen?.rotation.set(kit.swing * (1 - desk.raise), 0, 0);
      w.ship.updateMatrixWorld(true);
    }
  }
  // (the sky lights the ship as far as there is sky: none, a little way up from the home world)
  worlds.home.skyK.value = Math.exp(-Math.max(worlds.home.high, 0) / 30);
  behind.position.copy(eye.position); behind.quaternion.copy(eye.quaternion); behind.updateMatrixWorld(true);
  if (behind.fov !== eye.fov) { behind.fov = eye.fov; behind.updateProjectionMatrix(); }

  sky.update(worlds[on].body, eye.position, time);
  const homeEye = worlds.home.camera, moonEye = worlds.moon.camera;
  for (const g of grass) g.update(homeEye.position);
  // (motes and fireflies: for someone out in the home world's air, not shut in the ship)
  motes.update(on === 'home' && mode === 'foot' && !aboard && worlds.home.high < 30, homeEye.fov, renderer.domElement.height);
  trees.update(homeEye.position);
  moon.stones.update(moonEye.position);
  air.uniforms.uPush.value[0].set(walker.feet.x, walker.feet.y, walker.feet.z, on === 'home' && mode === 'foot' && !walker.flying ? 0.9 : 0);

  // the shadows of what stands near: thrown from the sun's side, and stepped along in whole squares of the
  // shadow's own picture so that they do not swim as the eye moves. Only the world one is at has them.
  const here = worlds[on];
  eyeUp.copy(eye.position).normalize();
  const sunUp = here.sun.dot(eyeUp);
  for (const w of Object.values(worlds)) {
    // (in flight the ship is all there is to throw a shadow, on itself: the lamp closes in on it, and the shadows sharpen)
    const lamp = w.lamp, lit = w === here && (mode !== 'foot' || (sunUp > -0.2 && high < 400));
    // (and for someone in its room it closes in part of the way, so the light through the windows has clean edges)
    const wanted = mode !== 'foot' ? THREE.MathUtils.lerp(24, 9, THREE.MathUtils.smoothstep(ship.alt, 10, 70)) : aboard ? 24 : 64;
    w.span = (w.span ?? 64) + THREE.MathUtils.clamp(wanted - (w.span ?? 64), -dt * 50, dt * 50);
    const span = w.span;
    if (lit && lamp.shadow.camera.right !== span) { Object.assign(lamp.shadow.camera, { left: -span, right: span, top: span, bottom: -span }); lamp.shadow.camera.updateProjectionMatrix(); }
    if (!lit) {
      // (set aside, far from everything, rather than put out: putting a lamp out makes every paint be made again)
      if (!w.parked) { lamp.position.set(0, 2e6, 0); lamp.target.position.set(0, 2e6 - 210, 0); lamp.target.updateMatrixWorld(); lamp.shadow.autoUpdate = true; w.parked = 3; }
      else if (w.parked > 1 && --w.parked === 1) lamp.shadow.autoUpdate = false;
      continue;
    }
    w.parked = false; lamp.shadow.autoUpdate = true;
    sx.crossVectors(w.sun, Math.abs(w.sun.y) > 0.9 ? tmp.set(1, 0, 0) : tmp.set(0, 1, 0)).normalize(); sy.crossVectors(w.sun, sx);
    const cell = (2 * span) / 4096;
    // (a shadow's edge is about a hand's breadth soft, whatever the picture's scale: but never under three of its dots, nor over fourteen)
    { const dots = THREE.MathUtils.clamp(0.12 / cell, 3, 14); w.air.uniforms.uShadowSoft.value.set(dots, (dots * cell) / (lamp.shadow.camera.far - lamp.shadow.camera.near)); }
    if (mode !== 'foot') at.copy(ship.pos); else if (walker.flying) at.copy(eyeUp).multiplyScalar(w.land.ground(eyeUp)); else at.copy(walker.feet);
    const u = Math.round(at.dot(sx) / cell) * cell, v = Math.round(at.dot(sy) / cell) * cell, d = at.dot(w.sun);
    lamp.target.position.copy(sx).multiplyScalar(u).addScaledVector(sy, v).addScaledVector(w.sun, d);
    lamp.position.copy(lamp.target.position).addScaledVector(w.sun, 210);
    lamp.target.updateMatrixWorld();
  }
  // the eye opens as the light goes: dusk and night are seen brighter than they are
  const lowSun = sunUp + Math.sqrt(Math.max(0, 1 - (here.body.radius / eye.position.length()) ** 2));
  page.uniforms.uExposure.value += ((1 + 0.9 * THREE.MathUtils.smoothstep(-lowSun, -0.3, 0.3)) - page.uniforms.uExposure.value) * Math.min(1, dt * 1.5);

  // what is inside the ship: lit through its window by the sun and by whatever sky there is
  // (far from the ground the worlds are drawn from some way off, and the room would be cut away: so it is drawn again,
  // last, by an eye that sees only the ship and sees it from a hand's breadth)
  let inside = null;
  if (mode !== 'foot' && near > 0.1001) {
    nearEye.position.copy(eye.position); nearEye.quaternion.copy(eye.quaternion); nearEye.updateMatrixWorld(true);
    inside = { scene: here.scene, camera: nearEye, lamp: here.lamp };
  }
  {
    const day = THREE.MathUtils.smoothstep(lowSun, -0.17, 0.17), airy = on === 'home' ? Math.exp(-Math.max(high, 0) / 30) : 0;
    glass.uniforms.uSheen.value.setRGB(0.03 + 0.2 * day * airy, 0.035 + 0.26 * day * airy, 0.05 + 0.36 * day * airy);
  }

{
    // what the pilot's hands are doing, and which way the ship is pushing: for the stick, the levers, the push glass
    const flying = mode === 'ship' && !ship.landed, ease = Math.min(1, dt * 9), K = LIFT / PUSH;
    hands.turn += ((flying ? THREE.MathUtils.clamp((ctl.look.x / Math.max(dt, 1e-3)) * 0.45 + (ctl.roll || 0) * 0.6, -1, 1) : 0) - hands.turn) * ease;
    hands.nod += ((flying ? THREE.MathUtils.clamp((ctl.look.y / Math.max(dt, 1e-3)) * 0.45, -1, 1) : 0) - hands.nod) * ease;
    hands.lift += ((mode === 'ship' ? THREE.MathUtils.clamp(ship.thrust.y, -1, 1) : 0) - hands.lift) * ease;
    hands.push += ((mode === 'ship' ? THREE.MathUtils.clamp(-ship.thrust.z * K, -1, 1) : 0) - hands.push) * ease;
    const th = shipLight.uThrust.value;
    if (flying) th.set(THREE.MathUtils.clamp(ship.thrust.x * K, -1, 1), THREE.MathUtils.clamp(ship.thrust.y, -1, 1), THREE.MathUtils.clamp(ship.thrust.z * K, -1, 1)); else th.multiplyScalar(Math.max(0, 1 - dt * 8));
    // (the dials are lit from behind more as the light goes)
    shipLight.uBack.value = 0.12 + 0.5 * THREE.MathUtils.smoothstep(page.uniforms.uExposure.value, 1.0, 1.8);
  }
  desk.update({
    dt, now: time, seated: mode === 'ship', aboard: aboard || mode === 'cabin', flying: mode === 'ship' && !ship.landed, ship, eye, frame: here, worlds, lockPressed: !!inp.lock, viewPressed: !!inp.view, auto: auto.state,
    matching: !!ctl.match && mode === 'ship' && !ship.landed, exposure: page.uniforms.uExposure.value, lit: shipLight.uLit.value, door,
    sunHeat: heat, dayPart: ((time / 600) % 1 + 1) % 1, pull: Math.min(1, system.pull(worlds[ship.on].body, ship.pos, tmp).length() / 9.8),
  });
  // (by the ramp: a green lamp when there is air outside, a red one when there is none)
  if (mode !== 'foot' || aboard) { shipLight.uLit.value[6] = ship.landed && ship.on === 'home' ? 1 : 0; shipLight.uLit.value[7] = ship.landed && ship.on === 'home' ? 0 : 1; }
  // (which worlds the sun is in front of, as the eye has it: they are drawn before it, and the home world's air with them)
  for (const w of [worlds.home, worlds.moon]) {
    const toSun = system.seenFrom(w.body, B.sun, tmp).sub(w.camera.position), ds = toSun.length(), dw = w.camera.position.length();
    w.behindSun = dw > ds && toSun.angleTo(tmp2.copy(w.camera.position).negate()) < Math.asin(Math.min(1, B.sun.radius / ds)) + Math.asin(Math.min(1, (w.body.radius + 60) / dw));
  }
  page.uniforms.uAir.value = worlds.home.behindSun ? 0 : 1;
  if (dome) {
    // (fulldome: the page is drawn once for each side of a cube round the eye, then laid out as a dome master)
    const eyes = [behind, worlds.home.camera, worlds.moon.camera]; if (inside) eyes.push(inside.camera);
    dome.render(page, eyes, (out) => page.render(sky.scene, behind, [worlds.home, worlds.moon], inside, homeEye, worlds.home.sun, B.home.quat, time, out), [sky.scene, worlds.home.scene, worlds.moon.scene], [worlds.home.ship, worlds.moon.ship]);
  } else page.render(sky.scene, behind, [worlds.home, worlds.moon], inside, homeEye, worlds.home.sun, B.home.quat, time);

  words.draw(dt);

  // what is heard: there is as much to hear outside as there is air (and there is air only low over the home world)
  // (music where there is no air to carry anything else: out in space, and, lower, on the moon on foot; none as she burns)
  spaceMusic = THREE.MathUtils.smoothstep(Math.max(worlds.home.high, 0), 24, 70) * (mode === 'foot' ? 0.5 : 1) * (1 - Math.min(1, heat * 1.5)) * (dying ? 0 : 1);
  sound?.update(dt, {
    airy: Math.max(0, 1 - Math.max(worlds.home.high, 0) / 46) ** 1.5, inside: mode !== 'foot' || (aboard && toShip(walker.feet, local).z < DECK.hinge - 0.2), shut: doorWant === 0, suit: suited, glass: mode !== 'foot' && desk.up, high, day: THREE.MathUtils.smoothstep(lowSun, -0.17, 0.25),
    walker: mode === 'foot' && !walker.flying ? walker : mode === 'cabin' ? cab : null, surface, trees: treesNear, ship, heat: dying === 2 ? 0 : heat, burn: dying === 1 ? burn : 0,
  });
}

// ------------------------------------------------------------------------------------------------- the window
let fitW = 0, fitH = 0;
function fitView() {
  fitW = innerWidth; fitH = innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [worlds.home.camera, worlds.moon.camera, behind, nearEye]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
  page.resize();
}
addEventListener('resize', fitView);
fitView();
// (Patch's player can ask for a lighter picture: it changes how many dots a point of the screen is)
window.patch?.addEventListener?.('qualitychange', () => { renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); fitView(); });
addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && mode === 'foot') walker.toggleFlight(worlds[on].camera);
  if (e.code === 'KeyT') held = !held;
});

const still = () => ({ move: { x: 0, y: 0 }, sprint: false, jump: false, look: { x: 0, y: 0 } });
window.lab = {
  THREE, renderer, walker, ship, system, land, air, page, sky, worlds, input, timings, trees, moon, kit, shipLight, sound, menu, hand: { write, width },
  dome,
  /** One frame, and the sound of it worked out before the next (checks and films with sound). */
  async stepSound(dt = 1 / 60) { tick(dt); await sound.advance(dt); },
  physics: { around, reframe },
  get camera() { return worlds[on].camera; },
  get scene() { return worlds[on].scene; },
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); },
  setInput(fn) { input.override = fn; },
  /** The system's time: read, or set. */
  time(t) { if (t != null) { time = t; system.set(t); } return time; },
  hold(yes = true) { held = yes; },
  /** The time at which the sun stands so high (its sine) over a place on the world one is at: going down, or with setting false, coming up. */
  when: (place, sine, setting = true) => system.when(worlds[on].body, typeof place === 'string' ? worlds[on].land.places[place] : V(...place), sine, { setting, from: time }),
  /** Sets the walker down on a world ('home' or 'moon') at a place (a name, or a direction [x, y, z]) facing toward another, or toward the sun. */
  at(place, toward, world = on) {
    const w = worlds[world];
    on = world; mode = 'foot'; aboard = false; walker.floor = null;
    walker.setWorld(w.land, w.colliders, w.pull);
    const dir = typeof place === 'string' ? w.land.places[place] : V(...place).normalize();
    walker.place(dir, toward ? (typeof toward === 'string' ? w.land.places[toward] : V(...toward)) : system.seenFrom(w.body, B.sun, V(0, 0, 0)));
    tick(1 / 60);
  },
  /** Stands the ship on a world at a direction, its window toward another (or toward the sun). */
  park(world, place, toward) {
    const w = worlds[world], dir = typeof place === 'string' ? w.land.places[place] : V(...place).normalize();
    ship.park(world, w.land, dir, toward ? V(...toward) : system.seenFrom(w.body, B.sun, V(0, 0, 0)));
  },
  /** Sits in the ship (or, with false, is simply out of it, wherever the walker was). */
  board(yes = true) { if (yes) { mode = 'ship'; on = ship.on; aboard = true; door = 0; ease = 0; ship.head.yaw = ship.head.pitch = 0; } else { stand(); ease = 0; door = 1; } tick(1 / 60); },
  /** Stands the walker in the ship at a place in its own directions (x to the right, z to the back), turned so many degrees to the right of ahead. */
  inside(x = 0, z = 0.6, turn = 0, pitch = 0.04) {
    stand(); ease = 0; door = 1;
    fromShip(local.set(x, DECK.floor, z), walker.feet);
    const up = walker.feet.clone().normalize(), a = (turn * Math.PI) / 180;
    walker.fwd.set(Math.sin(a), 0, -Math.cos(a)).applyQuaternion(ship.quat); walker.fwd.addScaledVector(up, -walker.fwd.dot(up)).normalize();
    walker.pitch = pitch;
    tick(1 / 60);
  },
  /** Out of the ship: at the foot of its ramp, a few paces off, looking back at it (or, turned, away). */
  /** Locks a world (or none) as the pilot would with R; the screen's other view as with V. */
  lock(key) { desk.locked = key; },
  get cab() { return cab; },
  /** Puts the suit on, or takes it off. */
  suit(yes = true) { suited = yes; visorK = yes ? 1 : 0; },
  /** On one's feet in the room while the ship flies: at a place in its own directions, turned so many degrees to the right of ahead. */
  cabin(x = 0, z = 0.6, turn = 0, pitch = 0.04) { mode = 'cabin'; aboard = true; ease = 0; door = 0; Object.assign(cab, { x, z, yaw: -(turn * Math.PI) / 180, pitch, vx: 0, vz: 0 }); tick(1 / 60); },
  desk,
  leave(back = 5, side = 0, turn = 0) {
    const w = worlds[ship.on];
    mode = 'foot'; on = ship.on; aboard = false; door = 1; ease = 0; walker.floor = null;
    walker.setWorld(w.land, w.colliders, w.pull);
    fromShip(local.set(side, 0, DECK.hinge + DECK.run + back), tmp);
    const a = (turn * Math.PI) / 180;
    walker.place(tmp.clone().normalize(), tmp2.set(Math.sin(a), 0, -Math.cos(a)).applyQuaternion(ship.quat));
    tick(1 / 60);
  },
  get door() { return door; }, set door(v) { door = v; },
  /** Where a world's middle is from the one whose frame the eye is in. */
  where: (name) => system.seenFrom(worlds[on].body, B[name], V(0, 0, 0)).toArray(),
  /** Puts a free eye at a place (metres from the middle of the world one is at) looking at another. */
  fly(eye, target, up) {
    mode = 'foot';
    walker.flying = true;
    walker.eye.set(...eye);
    const m = new THREE.Matrix4().lookAt(walker.eye, V(...target), up ? V(...up) : walker.eye.clone().normalize());
    walker.turn.setFromRotationMatrix(m);
    walker.drift.set(0, 0, 0);
    tick(1 / 60);
  },
  /** Sets the walker down on the moon so many metres short of its nth stone, facing it. */
  stone(nth = 0, back = 4) {
    const p = moon.stones.planted[nth], R = moon.land.radius, side = V(0.3, 0.2, 0.9).cross(p.dir).normalize();
    window.lab.at(p.dir.toArray(), undefined, 'moon');
    walker.place(p.dir.clone().multiplyScalar(R).addScaledVector(side, back).normalize(), p.dir.clone().multiplyScalar(R).sub(walker.feet));
    walker.fwd.copy(p.pos).sub(walker.feet).addScaledVector(walker.feet.clone().normalize(), -p.pos.clone().sub(walker.feet).dot(walker.feet.clone().normalize())).normalize();
    tick(1 / 60);
    return +p.size.toFixed(2);
  },
  /** Sets the walker down so many metres short of the nth tree, facing it. */
  tree(nth = 0, back = 10) {
    window.lab.at('start', undefined, 'home');
    const p = trees.planted[nth], side = V(0.3, 0.2, 0.9).cross(p.dir).normalize();
    walker.place(p.dir.clone().multiplyScalar(land.radius).addScaledVector(side, back).normalize(), p.dir.clone().multiplyScalar(land.radius).sub(walker.feet));
    walker.fwd.copy(p.pos).sub(walker.feet).addScaledVector(walker.feet.clone().normalize(), -p.pos.clone().sub(walker.feet).dot(walker.feet.clone().normalize())).normalize();
    tick(1 / 60);
  },
  /** The eye's angle of view, in degrees. */
  lens(fov) { for (const c of [worlds.home.camera, worlds.moon.camera, nearEye]) { c.fov = fov; c.updateProjectionMatrix(); } },
  /** The way to the sun from the middle of the world one is at. */
  sun: () => worlds[on].sun.toArray(),
  auto,
  info: () => ({ time: +time.toFixed(1), on, mode, aboard, suited, heat: +heat.toFixed(2), dying, auto: auto.state, glass: desk.view, door: +door.toFixed(2), high: +(mode === 'ship' ? ship.alt : walker.height).toFixed(1), speed: +(mode === 'ship' ? ship.speed : walker.speed).toFixed(1), landed: ship.landed, sun: +worlds[on].sun.dot(worlds[on].camera.position.clone().normalize()).toFixed(3), flying: walker.flying, feet: walker.feet.toArray().map((x) => +x.toFixed(1)) }),
};
if (capture) input.override = still;

say('Lighting the sun');
await turn();
if (!capture) { await renderer.compileAsync(homeScene, worlds.home.camera); await renderer.compileAsync(moon.scene, worlds.moon.camera); }
for (let i = 0; i < 3; i++) tick(1 / 60);
lap('first frames');

let last = performance.now(), shown = true;
function run() {
  last = performance.now();
  // (with the menu up over the game the world stands still: only the menu is drawn)
  renderer.setAnimationLoop(shown && !capture ? () => { if (innerWidth !== fitW || innerHeight !== fitH) fitView(); const now = performance.now(), dt = (now - last) / 1000; last = now; if (menu.state !== 'paused') tick(dt); menu.draw(Math.min(dt, 0.1)); sound?.scene(menu.state, spaceMusic); } : null);
}
document.addEventListener('visibilitychange', () => { shown = !document.hidden; run(); if (sound && !capture) { if (shown) sound.wake(); else sound.sleep(); } });
run();
if (sound && capture) await sound.ready;
// (behind the title the world is there and going, with nobody at the keys)
if (!capture) input.override = still;
menu.ready();
// (Esc, with the mouse held for looking, is taken by the browser to let the mouse go: that too brings the menu)
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && menu.state === 'play' && !capture && !testing && !dying) menu.open(); });
window.lab.ready = true;
