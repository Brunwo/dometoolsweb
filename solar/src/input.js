// Keyboard, mouse and gamepad, read once a frame into one plain state: what is being asked for, whatever it is asked
// with. A pad and the keys can be used together, turn and turn about; what is shown on the glass follows whichever
// was touched last.
//
//   move: {x, y}   x right, y forward, each -1..1: on a pad, how far the stick is pushed is how hard
//   look: {x, y}   radians this frame (the mouse, and the pad's right stick); stick: the pad's part of it
//   sprint, jump   on one's feet
//   up, down       0..1: the ship's lift and sink (on a pad, how far each trigger is pulled)
//   roll           -1..1
//   match          held: match speed
//   free           held: look about the cockpit while the ship keeps its heading
//   board, lock, view, again   pressed this frame: use what is at hand (or leave the seat); lock the world framed;
//                              the landing glass; show the keys again
//   auto           pressed this frame: the autopilot, on or off
//   menu           pressed this frame: the menu (Tab or Esc; a pad's Options)
//   fine           true when the lift and the pushes are given by how far something is pulled, not by a key
//   device         'keys' or 'pad';  pad: 'ps' or 'xbox' (which names its buttons go by)
//
// The pad is laid out as people who have flown such a ship know it:
//   on foot    left stick walk (press it to run), right stick look, cross jump, square use
//   the ship   left stick push ahead, back, aside; R2 up and L2 down, as hard as they are pulled; right stick turn;
//              hold L1 and the right stick rolls; hold cross to match speed; press the left stick to lock; square the
//              landing glass; hold d-pad down to look about; d-pad up is the autopilot; circle gets up from the seat
//   Options opens the menu.
//
// What the menu sets: sensitivity (the mouse), stickSpeed (the right stick), invertY (pushing up looks down),
// rumble (whether a pad is made to shake).

/** The buttons of a pad as browsers number them. */
const B = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };
const STICK_DEAD = 0.14, TRIGGER_DEAD = 0.06;

export class Input {
  constructor(el, { pads = true } = {}) {
    this.el = el;
    this.pads = pads; // off in headless checks: this PC's real gamepad shows up in headless browsers too
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, wheel: 0, right: false };
    this.walkToggle = false;
    this.sensitivity = 0.0022;
    this.stickSpeed = 1; this.invertY = false; this.rumble = true;
    this.override = null; // scripted input for captures
    this.lockable = true;
    this.device = 'keys';
    this.padKind = 'ps';
    // the pad: which one, what was down on it last frame, whether running was asked for, and what it was last made to feel
    this.pad = { index: -1, was: [], run: false, felt: 0, low: 0, high: 0 };
    const typing = () => document.activeElement?.tagName === 'INPUT';
    const down = (e) => {
      if (typing()) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
      // (a key held down says so again and again: only the first counts as a press)
      if (!this.keys.has(e.code) && !e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.device = 'keys';
      if (e.code === 'CapsLock') this.walkToggle = !this.walkToggle;
    };
    const up = (e) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.mouse.right = true;
      this.device = 'keys';
      // a click locks the mouse for looking, except while a panel or the replay wants the mouse
      if (e.button === 0 && this.lockable && document.pointerLockElement !== el) el.requestPointerLock?.()?.catch?.(() => {});
    });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.mouse.right = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === el || this.mouse.right) { this.mouse.x += e.movementX; this.mouse.y += e.movementY; if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.device = 'keys'; }
    });
    el.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  /** The pad in use: the one last touched (there may be several plugged in), or none. */
  current() {
    if (!this.pads) return null;
    const all = [...(navigator.getGamepads?.() ?? [])].filter((p) => p && p.connected && p.buttons.length >= 16);
    if (!all.length) { this.pad.index = -1; return null; }
    const busy = (p) => p.buttons.some((b, i) => i < 16 && (b.pressed || b.value > 0.3)) || Math.hypot(p.axes[0] ?? 0, p.axes[1] ?? 0) > 0.4 || Math.hypot(p.axes[2] ?? 0, p.axes[3] ?? 0) > 0.4;
    let pad = all.find((p) => p.index === this.pad.index);
    if (!pad || !busy(pad)) { const other = all.find((p) => p !== pad && busy(p)); if (other || !pad) { pad = other ?? all[0]; this.pad.was = []; } }
    if (pad.index !== this.pad.index) {
      this.pad.index = pad.index;
      // (a pad says who made it: Sony's are named by their shapes, the rest by their letters)
      this.padKind = /054c|dualshock|dualsense|playstation|wireless controller/i.test(pad.id) ? 'ps' : 'xbox';
    }
    return pad;
  }

  /** where: 'foot', 'cabin' (on one's feet in the ship as it flies), 'seat' (in the seat, on the ground) or 'fly'. */
  read(dt, where = 'foot') {
    if (this.override) return this.override(dt);
    const k = this.keys, P = this.pressed, flying = where === 'fly', seated = flying || where === 'seat';
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const s = {
      move: { x, y },
      walk: this.walkToggle !== (k.has('AltLeft') || k.has('AltRight')),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      jump: P.has('Space'),
      look: { x: this.mouse.x * this.sensitivity, y: this.mouse.y * this.sensitivity },
      stick: { x: 0, y: 0 },
      up: k.has('Space') ? 1 : 0, down: k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0,
      roll: (k.has('KeyC') ? 1 : 0) - (k.has('KeyZ') ? 1 : 0),
      match: k.has('KeyX'), free: false,
      board: P.has('KeyE'), lock: P.has('KeyR'), view: P.has('KeyV'), again: P.has('KeyH'), auto: P.has('KeyG'), menu: P.has('Tab') || P.has('Escape'),
      fine: false, zoom: this.mouse.wheel,
    };
    this.mouse.x = this.mouse.y = this.mouse.wheel = 0;
    P.clear();

    const pad = this.current();
    if (pad) {
      const was = this.pad.was, held = (i) => !!pad.buttons[i]?.pressed, hit = (i) => held(i) && !was[i];
      // a stick: nothing in its middle (it never rests quite there), then smoothly out to its edge, the same all round
      const stick = (ax, ay) => { const l = Math.hypot(ax, ay); if (l < STICK_DEAD) return [0, 0, 0]; const m = Math.min(1, (l - STICK_DEAD) / (1 - STICK_DEAD - 0.04)); return [(ax / l) * m, (ay / l) * m, m]; };
      const pull = (i) => { const v = pad.buttons[i]?.value ?? 0; return v < TRIGGER_DEAD ? 0 : Math.min(1, (v - TRIGGER_DEAD) / (1 - TRIGGER_DEAD - 0.04)); };
      const [lx, ly, lm] = stick(pad.axes[0] ?? 0, pad.axes[1] ?? 0), [rx, ry, rm] = stick(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      const r2 = pull(B.r2), l2 = pull(B.l2);
      if (lm > 0) { s.move = { x: lx, y: -ly }; s.walk = false; }
      // the right stick: gently near its middle, for aiming, and quickly at its edge; the ship is heavier to turn than a head
      const fast = (rm * rm * (seated ? 1.9 : 3.3) + rm * 0.35) * this.stickSpeed;
      const turnX = rm > 0 ? (rx / rm) * fast * dt : 0, turnY = rm > 0 ? (ry / rm) * fast * (seated ? 1 : 0.72) * dt : 0;
      if (flying && held(B.l1)) { s.roll = Math.min(1, Math.max(-1, s.roll + (rm > 0 ? rx : 0))); s.stick = { x: 0, y: turnY }; }
      else s.stick = { x: turnX, y: turnY };
      s.look.x += s.stick.x; s.look.y += s.stick.y;
      if (seated) {
        if (r2 > 0 || l2 > 0 || lm > 0) s.fine = true;
        s.up = Math.max(s.up, r2); s.down = Math.max(s.down, l2);
        s.match = s.match || (flying && held(B.cross));
        s.free = flying && held(B.down);
        if (hit(B.l3)) s.lock = true;
        if (hit(B.up)) s.auto = true;
        if (flying && hit(B.square)) s.view = true;
        if (hit(B.circle)) s.board = true;
      } else {
        if (hit(B.cross)) s.jump = true;
        if (hit(B.square)) s.board = true;
        // (pressing the left stick in sets one running, until one stops)
        if (hit(B.l3)) this.pad.run = !this.pad.run;
        if (lm < 0.25) this.pad.run = false;
        if (this.pad.run) s.sprint = true;
      }
      if (hit(B.options)) s.menu = true;
      if (lm > 0 || rm > 0 || r2 > 0 || l2 > 0 || pad.buttons.some((b, i) => i < 16 && b.pressed)) this.device = 'pad';
      for (let i = 0; i < 16; i++) was[i] = held(i);
    }
    if (this.invertY) { s.look.y = -s.look.y; s.stick.y = -s.stick.y; }
    s.device = this.device; s.pad = this.padKind;
    return s;
  }

  /**
   * What the pad is made to feel, said once a frame: low (the heavy motor) and high (the light one), each 0..1. It
   * is passed on a few times a second, and only while there is something to feel.
   */
  feel(low, high, now = performance.now()) {
    if (this.device !== 'pad' || this.pad.index < 0) return;
    if (!this.rumble) low = high = 0;
    low = Math.min(1, Math.max(0, low)); high = Math.min(1, Math.max(0, high));
    const quiet = low < 0.01 && high < 0.01;
    if (quiet && this.pad.low < 0.01 && this.pad.high < 0.01) return;
    // (at once when it jumps; otherwise every tenth of a second, each time for a little longer than that)
    if (now - this.pad.felt < 90 && Math.abs(low - this.pad.low) < 0.25 && Math.abs(high - this.pad.high) < 0.25 && !quiet) return;
    this.pad.felt = now; this.pad.low = low; this.pad.high = high;
    const pad = navigator.getGamepads?.()[this.pad.index], motor = pad?.vibrationActuator;
    if (!motor?.playEffect) return;
    motor.playEffect('dual-rumble', { startDelay: 0, duration: quiet ? 1 : 160, strongMagnitude: low, weakMagnitude: high }).catch(() => {});
  }
}
