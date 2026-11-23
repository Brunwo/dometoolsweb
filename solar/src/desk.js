// What helps the pilot: what is drawn on the window glass in flight, the two glasses on the desk, the dials, and
// the five small lamps over the screen.
//
// On the window: every world in the sky is marked. The one being looked at (or the one that has been locked, with
// R) is framed, with how far its ground is and how fast it is coming; a ring round the frame fills as the room
// left to stop in runs out, and when it is full it is time to brake (hold X); a dotted line shows which way the
// ship is sliding past, so that it can be pushed against. A small ring shows which way the ship is going. Low
// over a world: how high, how fast down, how fast along. The sun is marked, but never framed: nobody lands there.
//
// On the desk: the landing glass lies folded until V raises it. Low over a world it shows what is under the ship
// (an eye in its chin looks straight down), and otherwise the world it is making for, as through a spyglass, with
// how the approach stands; V again turns it to the other view, and once more lays it down. To the left, a chart of the home world and its moon from above. To the right, the
// dials: speed, height, climb, the time of day; and heat, air, pull and lean.
import * as THREE from 'three';
import { write } from './hand.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const INK = '255, 232, 184', WARN = '255, 150, 96', GLOW = '190, 255, 215';
export const metres = (m) => (m >= 9950 ? `${Math.round(m / 1000)} km` : m >= 995 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(m))} m`);
const seconds = (t) => (t >= 90 ? `${Math.round(t / 60)} min` : `${Math.max(0, Math.round(t))} s`);

/**
 * renderer; system; marks: [{ key, title, body }] what there is in the sky; dials: what createDials gave; brake:
 * how hard the ship can stop (m/s²); chin: where the eye that looks down is, in the ship's own directions.
 */
export function createDesk(renderer, system, marks, dials, brake = 21, chin = V(0, 0.95, -2.78), pane = { sill: V(0, 1.9, -2.42), head: V(0, 3.16, -2.42) }) {
  // ---- the glass: a sheet over the picture, drawn on only in flight ----
  const glass = document.createElement('canvas');
  glass.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
  document.getElementById('view').after(glass);
  const g = glass.getContext('2d');
  let gw = 0, gh = 0, px = 1, U = 1;
  function fit() {
    px = Math.min(devicePixelRatio || 1, 2);
    if (glass.width !== Math.round(innerWidth * px) || glass.height !== Math.round(innerHeight * px)) { glass.width = Math.round(innerWidth * px); glass.height = Math.round(innerHeight * px); }
    gw = innerWidth; gh = innerHeight;
    // (what is written on the glass is as large on a small window as on a wide one)
    U = THREE.MathUtils.clamp(gh / 900, 0.95, 1.9);
  }

  // ---- the desk's glasses ----
  const sheet = (w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tx = new THREE.CanvasTexture(c); tx.flipY = false; tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    return { c, x: c.getContext('2d'), tx, w, h };
  };
  const ink = sheet(640, 400), chart = sheet(384, 384);
  const below = new THREE.WebGLRenderTarget(512, 320, { type: THREE.HalfFloatType, depthBuffer: true });
  const scopeEye = new THREE.PerspectiveCamera(72, 512 / 320, 0.25, 4000);
  const mainFace = new THREE.ShaderMaterial({
    uniforms: { tBelow: { value: below.texture }, tInk: { value: ink.tx }, uOn: { value: 0 }, uGain: { value: 1 }, uNow: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tBelow; uniform sampler2D tInk; uniform float uOn; uniform float uGain; uniform float uNow; uniform float uOpen; varying vec2 vUv;
      void main() {
        // the picture opens out of a bright line across the middle of the glass, and closes back to one
        float tall = max(0.006, smoothstep(0.14, 0.82, uOpen)), wide = smoothstep(0.0, 0.18, uOpen);
        vec2 e = vUv - 0.5, uv = vec2(vUv.x, 0.5 + e.y / tall);
        float lit = (1.0 - smoothstep(0.5 * tall - 0.004, 0.5 * tall, abs(e.y))) * (1.0 - smoothstep(0.5 * wide - 0.012, 0.5 * wide, abs(e.x))) * step(0.001, uOpen);
        // what the eye sees: as a lamp-lit glass shows it, pale green on dark, in fine lines
        vec3 v = texture2D(tBelow, vec2(uv.x, 1.0 - uv.y)).rgb * uGain;
        float l = dot(v, vec3(0.3, 0.55, 0.15)); l = pow(l / (1.0 + l), 0.8);
        vec3 c = mix(vec3(0.012, 0.035, 0.03), vec3(0.62, 0.95, 0.74), l) * uOn;
        c *= 0.86 + 0.14 * sin(vUv.y * 880.0) + 0.03 * sin(vUv.y * 14.0 + uNow * 5.0);
        vec4 k = texture2D(tInk, uv);
        c = mix(c, k.rgb, k.a);
        // (squeezed thin it is at its brightest; and it comes up unsteadily, as a set does that has been cold)
        float warm = smoothstep(0.1, 1.0, uOpen);
        c *= (1.0 + 3.0 * (1.0 - smoothstep(0.0, 0.5, tall))) * (0.72 + 0.28 * warm + 0.22 * (1.0 - warm) * sin(uNow * 70.0)) * lit;
        // at rest: dark glass, and one small ember low in a corner to say the set is live
        float ember = 1.0 - smoothstep(0.0, 0.016, length((vUv - vec2(0.935, 0.91)) * vec2(1.0, 1.55)));
        c += vec3(0.008, 0.016, 0.014) + vec3(0.9, 0.4, 0.1) * ember * (0.3 + 0.2 * sin(uNow * 1.6)) * (1.0 - warm);
        c *= 1.0 - 0.9 * dot(e, e);
        gl_FragColor = vec4(c * 1.25, 1.0);
      }`,
  });
  const faces = { face_main: mainFace, face_chart: new THREE.MeshBasicMaterial({ map: chart.tx }) };
  faces.face_chart.color.setScalar(1.25);

  // ---- what is where in the sky, as the ship's own frame has it ----
  const seen = {};
  for (const m of marks) seen[m.key] = { ...m, at: V(0, 0, 0), vel: V(0, 0, 0), was: V(0, 0, 0), cam: V(0, 0, 0), fresh: false, sx: 0, sy: 0, front: false, r: 0, off: 9, dist: 0 };
  let frameWas = '', locked = null, flown = 0, tickN = 0, pref = null, first = 'below', heat = 0, away = true;
  // the screen: which picture is up ('rest', 'below', 'ahead'), how far it has opened, whether a landing is on, how far the pilot leans in to it
  let shown = 'rest', open = 0, landing = false, lean = 0, raise = 0, raiseV = 0, upWant = false;
  const trail = [];
  const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0), q = new THREE.Quaternion(), c2 = new THREE.Quaternion(), rel = V(0, 0, 0);
  // how the approach to what is framed stands: worked out once a turn, used on the glass, the screen and the lamps
  const nav = { m: null, d: 0, ground: 0, closing: 0, slide: 0, sx: 0, sy: 0, stop: 0, fill: 0, brakeIn: Infinity, arrive: Infinity };

  /** Where each mark is, and how it is moving, in the frame of the world the eye is kept in. Before the ship is moved. */
  function track(dt, frame) {
    for (const s of Object.values(seen)) {
      system.seenFrom(frame.body, s.body, s.at);
      if (frame.name === frameWas && s.fresh && dt > 1e-5) s.vel.copy(s.at).sub(s.was).divideScalar(dt); else s.vel.set(0, 0, 0);
      s.was.copy(s.at); s.fresh = true;
    }
    frameWas = frame.name;
  }

  const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  // (written thin and steady, as on an instrument, with a little light of its own; and a dark edge, to read over a bright sky)
  const text = (s, x, y, size = 13, align = 'left', alpha = 0.92, col = INK, style = '') => {
    const cap = size * 0.76 * U, o = { align, track: 0.045, weight: THREE.MathUtils.clamp(0.148 - 0.0028 * cap, 0.085, 0.13) + (style === 'bold' ? 0.03 : 0), slant: style === 'italic' ? 0.14 : 0 };
    write(g, s, x, y, cap, { ...o, weight: o.weight + 0.18, color: `rgba(6, 7, 10, ${0.42 * alpha})` });
    write(g, s, x, y, cap, { ...o, color: `rgba(${col}, ${alpha})`, glow: 0.45 * cap, glowColor: `rgba(${col}, ${0.6 * alpha})` });
  };

  /**
   * s: { dt, now, flying (in the seat and off the ground), seated, aboard, ship, eye, frame (the world whose frame
   * the eye is in: { name, title, body, scene, lamp }), worlds: { name: { scene, camera, lamp, body } }, lockPressed,
   * viewPressed, matching, exposure, lit (the five lamps, to be set), door (0 shut .. 1 open), dayPart (0..1),
   * pull (how hard the ship is pulled, as a part of the pull at home) }.
   */
  function update(s) {
    fit();
    const { ship, eye, frame } = s;
    tickN++;
    g.setTransform(px, 0, 0, px, 0, 0);
    g.clearRect(0, 0, gw, gh);
    if (!s.seated) flown = 0;
    if (!s.seated && !s.aboard) { locked = null; pref = null; landing = false; lean = 0; raise = 0; raiseV = 0; upWant = false; open = 0; shown = 'rest'; if (s.lit) s.lit.fill(0); away = true; return; }
    // (coming aboard, everything on the desk is drawn at once: nothing is seen dark)
    const fresh = away; away = false;

    // ---- which mark is where on the glass ----
    const f = 1 / Math.tan((eye.fov * Math.PI) / 360);
    q.copy(eye.quaternion).invert();
    let pick = null;
    for (const m of Object.values(seen)) {
      rel.copy(m.at).sub(eye.position);
      m.dist = rel.length();
      const wide = Math.asin(Math.min(1, m.body.radius / m.dist));
      a.copy(rel).applyQuaternion(q);
      m.front = a.z < 0;
      m.sx = (0.5 + (0.5 * (a.x / -a.z) * f) / eye.aspect) * gw; m.sy = (0.5 - 0.5 * (a.y / -a.z) * f) * gh;
      m.r = Math.tan(wide) * f * gh * 0.5;
      m.off = Math.acos(THREE.MathUtils.clamp(-a.z / m.dist, -1, 1));
      // (a world that fills the window is not a mark in the sky: it is where one is)
      m.big = wide > 0.5;
      m.cam.copy(a);
      m.wide = wide;
    }
    // (what is behind the sun cannot be seen, nor marked, nor framed)
    const S = seen.sun, sunWide = Math.asin(Math.min(1, S.body.radius / S.dist));
    for (const m of Object.values(seen)) {
      m.hid = m !== S && m.dist > S.dist && m.cam.angleTo(S.cam) < sunWide + 0.3 * m.wide;
      if (m.key !== 'sun' && !m.big && !m.hid && m.front && m.off < 0.2 + m.wide && (!pick || m.off < pick.off)) pick = m;
    }
    if (s.lockPressed && s.seated) locked = locked ? null : pick?.key ?? null;
    if (locked && seen[locked].big && frame.name === locked) locked = null;
    const target = locked ? seen[locked] : pick;
    if (!s.flying) flown = 0; else flown += s.dt;

    // ---- how the approach stands ----
    let vrel = ship.vel;
    nav.m = target ?? null; nav.fill = 0; nav.brakeIn = Infinity; nav.arrive = Infinity; nav.slide = 0;
    if (target) {
      const own = frame.name === target.key;
      vrel = own ? ship.vel : b.copy(ship.vel).sub(target.vel);
      rel.copy(target.at).sub(ship.pos);
      nav.d = rel.length(); nav.ground = Math.max(0, nav.d - target.body.radius); nav.closing = vrel.dot(rel) / nav.d;
      c.copy(vrel).addScaledVector(rel, -nav.closing / nav.d);
      nav.slide = c.length();
      c.applyQuaternion(q); nav.sx = c.x; nav.sy = c.y;
      if (nav.closing > 2) {
        // (room to stop in, with a moment to think and a little to spare)
        nav.stop = (nav.closing * nav.closing) / (2 * brake) + nav.closing * 0.6;
        const room = Math.max(nav.ground - 25, 1);
        nav.fill = Math.min(1, nav.stop / room); nav.brakeIn = (room - nav.stop) / nav.closing; nav.arrive = nav.ground / nav.closing;
      }
    }
    const speedRel = vrel.length();
    const up = a.copy(ship.pos).normalize(), down = -ship.vel.dot(up), along = c.copy(ship.vel).addScaledVector(up, down).length();
    const hard = s.flying && ship.alt < 260 && down > 7 && ship.alt < down * 6, late = s.flying && nav.fill >= 1 && !(target && frame.name === target.key && ship.alt < 260);
    if (s.lit) {
      s.lit[0] = s.door < 0.03 ? 1 : 0; s.lit[1] = ship.landed ? 1 : 0; s.lit[2] = locked ? 1 : 0; s.lit[3] = s.matching ? 1 : 0;
      s.lit[4] = (hard || late) && (s.now * 3) % 1 < 0.6 ? 1 : 0;
    }

    if (s.flying) {
      g.lineCap = 'round';
      // (the window's glass, on the screen: from its head to its sill)
      const edge = (p) => { a.copy(p).applyQuaternion(ship.quat).add(ship.pos).sub(eye.position).applyQuaternion(q); return (0.5 - 0.5 * (a.y / -a.z) * f) * gh; };
      const top = Math.max(0, edge(pane.head)), foot = Math.min(gh, edge(pane.sill));
      g.save(); g.beginPath(); g.rect(0, top, gw, foot - top); g.clip();
      for (const m of Object.values(seen)) {
        if (m === target || m.big || !m.front || m.hid) continue;
        if (m.sx < -40 || m.sx > gw + 40 || m.sy < -40 || m.sy > gh + 40) continue;
        // the others: a small tick over each, and its name
        const R = Math.max(m.r + 7 * U, 10 * U);
        g.strokeStyle = `rgba(${INK}, 0.4)`; g.lineWidth = U;
        line(m.sx, m.sy - R, m.sx, m.sy - R - 9 * U);
        text(m.title, m.sx, m.sy - R - 14 * U, 12, 'center', 0.5, INK, 'italic');
      }
      // ---- the one framed ----
      if (target) {
        const m = target;
        const inView = m.front && m.sx > 30 && m.sx < gw - 30 && m.sy > top + 10 && m.sy < foot - 10;
        const col = nav.fill >= 1 ? WARN : INK;
        if (inView) {
          const R = Math.max(m.r + 14 * U, 24 * U), k = Math.min(R * 0.42, 16 * U);
          g.strokeStyle = `rgba(${INK}, 0.9)`; g.lineWidth = (locked ? 2.2 : 1.3) * U;
          for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            g.beginPath(); g.moveTo(m.sx + dx * R, m.sy + dy * (R - k)); g.lineTo(m.sx + dx * R, m.sy + dy * R); g.lineTo(m.sx + dx * (R - k), m.sy + dy * R); g.stroke();
          }
          // the room left to stop in: a ring that fills, from the top round
          if (nav.fill > 0.02) {
            const Rr = R * 1.42 + 6 * U;
            g.strokeStyle = `rgba(${INK}, 0.22)`; g.lineWidth = 2 * U; g.beginPath(); g.arc(m.sx, m.sy, Rr, 0, 7); g.stroke();
            g.strokeStyle = `rgba(${col}, 0.95)`; g.lineWidth = 4 * U; g.beginPath(); g.arc(m.sx, m.sy, Rr, -Math.PI / 2, -Math.PI / 2 + nav.fill * Math.PI * 2); g.stroke();
          }
          // which way the ship is sliding past it: a dotted line out from the frame, longer the faster
          if (nav.slide > 0.8) {
            const len = Math.hypot(nav.sx, nav.sy);
            if (len > 0.4 * nav.slide) {
              const ux = nav.sx / len, uy = -nav.sy / len, L = (16 + 22 * Math.log2(1 + nav.slide)) * U, R0 = R * 1.42 + 14 * U;
              g.strokeStyle = `rgba(${INK}, 0.9)`; g.lineWidth = 1.5 * U;
              g.setLineDash([2 * U, 5 * U]); line(m.sx + ux * R0, m.sy + uy * R0, m.sx + ux * (R0 + L), m.sy + uy * (R0 + L)); g.setLineDash([]);
              const hx = m.sx + ux * (R0 + L + 6 * U), hy = m.sy + uy * (R0 + L + 6 * U), ang = Math.atan2(uy, ux);
              g.beginPath(); g.moveTo(hx + Math.cos(ang) * 6 * U, hy + Math.sin(ang) * 6 * U); g.lineTo(hx + Math.cos(ang + 2.5) * 6 * U, hy + Math.sin(ang + 2.5) * 6 * U); g.lineTo(hx + Math.cos(ang - 2.5) * 6 * U, hy + Math.sin(ang - 2.5) * 6 * U); g.closePath(); g.fillStyle = `rgba(${INK}, 0.9)`; g.fill();
              text(`${Math.round(nav.slide)}`, m.sx + ux * (R0 + L + 22 * U), m.sy + uy * (R0 + L + 22 * U) + 4 * U, 12, 'center', 0.75);
            }
          }
          const tx = m.sx + R * 1.42 + 22 * U, ty = m.sy - 14 * U;
          text(m.title, tx, ty, 18, 'left', 0.95, INK, 'italic');
          text(metres(nav.ground), tx, ty + 23 * U, 17);
          const fast = Math.abs(nav.closing) >= 0.5;
          text(!fast ? 'holding' : `${nav.closing > 0 ? 'closing' : 'opening'}  ${Math.round(Math.abs(nav.closing))} m/s`, tx, ty + 43 * U, 14, 'left', 0.85);
          if (nav.fill >= 1) text('brake', tx, ty + 64 * U, 17, 'left', (s.now * 3) % 1 < 0.6 ? 1 : 0.35, WARN, 'bold');
          else if (nav.brakeIn < 60) text(`brake in  ${seconds(nav.brakeIn)}`, tx, ty + 62 * U, 14, 'left', 0.9);
          else if (nav.arrive < 3600) text(`there in  ${seconds(nav.arrive)}`, tx, ty + 62 * U, 13, 'left', 0.6, INK, 'italic');
          if (locked) text(s.auto === 'go' ? 'locked · autopilot' : s.matching ? 'locked · matching' : 'locked', tx, ty - 22 * U, 11, 'left', 0.6, INK, 'italic');
        } else if (locked) {
          // locked and out of sight: an arrow at the edge of the glass, toward it
          let ax = m.cam.x, ay = m.cam.y; const n = Math.hypot(ax, ay) || 1; ax /= n; ay /= n;
          const ex = gw / 2 + ax * (gw / 2 - 70) * 0.9, ey = (top + foot) / 2 - ay * ((foot - top) / 2 - 40) * 0.9;
          g.save(); g.translate(ex, ey); g.rotate(Math.atan2(-ay, ax));
          g.strokeStyle = `rgba(${col}, 0.95)`; g.lineWidth = 2.5 * U; g.beginPath(); g.moveTo(-9 * U, -9 * U); g.lineTo(5 * U, 0); g.lineTo(-9 * U, 9 * U); g.stroke(); g.restore();
          text(m.title, ex - ax * 34 * U, ey + ay * 34 * U + 4, 13, 'center', 0.85, INK, 'italic');
          text(metres(nav.ground), ex - ax * 34 * U, ey + ay * 34 * U + 4 + 17 * U, 12, 'center', 0.7);
        }
      }
      // ---- which way the ship is going (past what is framed, if anything is) ----
      const sp = vrel.length();
      if (sp > 1.5) {
        a.copy(vrel).divideScalar(sp).applyQuaternion(q);
        const back = a.z > 0;
        if (back) a.negate();
        const x = (0.5 + (0.5 * (a.x / -a.z) * f) / eye.aspect) * gw, y = (0.5 - 0.5 * (a.y / -a.z) * f) * gh;
        if (x > 20 && x < gw - 20 && y > 20 && y < gh - 20) {
          g.strokeStyle = `rgba(${back ? WARN : INK}, 0.85)`; g.lineWidth = 1.5 * U;
          const r = 8 * U;
          if (!back) { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); line(x - r * 1.8, y, x - r, y); line(x + r, y, x + r * 1.8, y); line(x, y - r, x, y - r * 1.8); }
          else { line(x - r, y - r, x + r, y + r); line(x - r, y + r, x + r, y - r); }
          text(`${Math.round(sp)} m/s`, x, y + r + 16 * U, 11, 'center', 0.7, back ? WARN : INK);
        }
      }
      g.restore();
      // ---- low over a world: how high, how fast down, how fast along ----
      if (ship.alt < 260) {
        const x = gw * 0.5 - Math.min(gw * 0.3, 430 * U), y = (top + foot) / 2 + 20 * U;
        text('above the ground', x, y - 34 * U, 12, 'right', 0.6, INK, 'italic');
        text(metres(ship.alt), x, y, 30, 'right', 0.95, hard ? WARN : INK);
        text(`${down >= 0 ? 'down' : 'up'}  ${Math.abs(down).toFixed(1)} m/s`, x, y + 26 * U, 16, 'right', 0.9, hard ? WARN : INK);
        text(`along  ${along.toFixed(1)} m/s`, x, y + 48 * U, 16, 'right', 0.8, along > 6 && ship.alt < 30 ? WARN : INK);
        // (a bar: the ground at its foot)
        g.strokeStyle = `rgba(${INK}, 0.4)`; g.lineWidth = U; line(x + 16 * U, y - 48 * U, x + 16 * U, y + 54 * U); line(x + 10 * U, y + 54 * U, x + 22 * U, y + 54 * U);
        const hy = y + 54 * U - 102 * U * Math.min(1, ship.alt / 260);
        g.fillStyle = `rgba(${hard ? WARN : INK}, 0.95)`; g.beginPath(); g.moveTo(x + 16 * U, hy); g.lineTo(x + 27 * U, hy - 6 * U); g.lineTo(x + 27 * U, hy + 6 * U); g.fill();
      }
      if (s.matching && !(locked && seen[locked])) text('holding still', gw / 2, foot - 46 * U, 13, 'center', 0.75, INK, 'italic');
    }

    // ---- the screen ----
    // It rests dark and folded, and does nothing of itself: V raises it. The first press brings up what is of use
    // where the ship is (what is below, when it is low over a world; otherwise the world made for, as through a
    // spyglass), the next the other picture, and the third lays it down. Getting up from the seat lays it down too.
    const feet = b.set(0, -1, 0).applyQuaternion(ship.quat).dot(up.copy(ship.pos).normalize()) < -0.45;
    // (a landing is on: coming down low, feet first. It is only for how far the pilot leans in to the glass)
    if (!landing && s.seated && !ship.landed && feet && ship.alt < 140 && down > 0.5) landing = true;
    else if (landing && (ship.alt > 190 || !feet || down < -6 || ship.landed || !s.seated)) landing = false;
    if (!s.seated) pref = null;
    else if (s.viewPressed) {
      if (!pref) first = !ship.landed && ship.alt < 260 ? 'below' : 'ahead';
      const order = ['rest', first, first === 'below' ? 'ahead' : 'below'], next = order[(order.indexOf(pref ?? 'rest') + 1) % 3];
      pref = next === 'rest' ? null : next;
    }
    const want = pref ?? 'rest';
    // (one picture goes out before the next comes up)
    // (the glass lies on the desk until it is wanted. It swings up on its hinge and knocks against its stays, and
    // only then does its picture come up; going back, the picture goes out first, and then it is laid down)
    upWant = want !== 'rest';
    {
      const tgt = upWant || open > 0 ? 1 : 0, h = Math.min(s.dt, 0.033);
      raiseV += ((tgt - raise) * 46 - raiseV * 5.5) * h; raise += raiseV * h;
      if (raise > 1) { raise = 1; raiseV *= -0.32; } else if (raise < 0) { raise = 0; raiseV *= -0.25; }
    }
    if (shown !== want) { open = Math.max(0, open - s.dt / 0.16); if (open <= 0 && (want === 'rest' || raise > 0.93)) shown = want; }
    else open = shown === 'rest' ? 0 : Math.min(1, open + s.dt / 0.75);
    lean += ((landing && shown === 'below' ? 1 : 0) - lean) * Math.min(1, s.dt * 2.2);
    if (s.lit) s.lit[5] = shown === 'below' && open > 0.4 ? 1 : 0;
    const view = shown;
    const world = view === 'ahead' && target && s.worlds[target.key] ? s.worlds[target.key] : null;
    mainFace.uniforms.uOpen.value = open; mainFace.uniforms.uNow.value = s.now;
    if (view !== 'rest' && (fresh || tickN % 2 === 0)) {
      let w = frame, lit = 1;
      if (view === 'below' || !world) {
        // the eye in the chin: straight down, the way ahead at the top of its picture; or, for the other view with
        // no world to look at, straight ahead
        a.copy(chin).applyQuaternion(ship.quat).add(ship.pos);
        scopeEye.position.copy(a);
        if (view === 'below') { scopeEye.up.set(0, 0, -1).applyQuaternion(ship.quat); scopeEye.lookAt(b.set(chin.x, chin.y - 10, chin.z).applyQuaternion(ship.quat).add(ship.pos)); scopeEye.fov = 72; }
        else { scopeEye.up.set(0, 1, 0).applyQuaternion(ship.quat); scopeEye.lookAt(b.set(chin.x, chin.y, chin.z - 10).applyQuaternion(ship.quat).add(ship.pos)); scopeEye.fov = 46; lit = 0.6; }
        scopeEye.near = 0.25; scopeEye.far = Math.max(600, ship.alt * 3 + 600);
      } else {
        // the spyglass: the world made for, filling the glass, from where the ship is in that world's own frame
        w = world;
        const d = w.camera.position.length(), R = w.body.radius;
        scopeEye.position.copy(w.camera.position);
        scopeEye.up.set(0, 1, 0).applyQuaternion(w.camera.quaternion);
        scopeEye.lookAt(0, 0, 0);
        scopeEye.fov = THREE.MathUtils.clamp(((2 * Math.asin(Math.min(0.99, R / d)) * 180) / Math.PI) * 1.5, 1.2, 80);
        scopeEye.near = Math.max(0.5, d - R * 1.5); scopeEye.far = d + R * 1.5;
      }
      scopeEye.updateProjectionMatrix(); scopeEye.updateMatrixWorld(true);
      const shadow = w.lamp.shadow, was = shadow.autoUpdate, target0 = renderer.getRenderTarget();
      shadow.autoUpdate = false; shadow.needsUpdate = false;
      renderer.setRenderTarget(below); renderer.setClearColor(0x000000, 1); renderer.clear();
      renderer.render(w.scene, scopeEye);
      renderer.setRenderTarget(target0); shadow.autoUpdate = was;
      mainFace.uniforms.uOn.value = lit; mainFace.uniforms.uGain.value = (view === 'below' ? 0.9 : 1.5) * (s.exposure ?? 1); mainFace.uniforms.uNow.value = s.now;
    }
    if (fresh || tickN % 4 === 1) {
      const x = ink.x, W = ink.w, H = ink.h, C = `rgba(${GLOW}, 0.95)`, hot = 'rgba(255, 190, 130, 1)';
      x.clearRect(0, 0, W, H);
      x.strokeStyle = `rgba(${GLOW}, 0.85)`; x.fillStyle = C; x.lineWidth = 2.5; x.lineCap = 'round';
      const say = (t, px2, py2, size, align = 'left', style = '', col = C) => { write(x, t, px2, py2, size * 0.74, { align, color: col, track: 0.04, weight: (size > 30 ? 0.095 : 0.11) + (style === 'bold' ? 0.035 : 0), slant: style === 'italic' ? 0.14 : 0, glow: size * 0.3 }); };
      if (view === 'rest') {
        // (nothing: the glass is dark)
      } else if (view === 'below') {
        // a cross where the ship will come down, how high, and which way it is drifting
        x.beginPath(); x.moveTo(W / 2 - 42, H / 2); x.lineTo(W / 2 - 12, H / 2); x.moveTo(W / 2 + 12, H / 2); x.lineTo(W / 2 + 42, H / 2); x.moveTo(W / 2, H / 2 - 42); x.lineTo(W / 2, H / 2 - 12); x.moveTo(W / 2, H / 2 + 12); x.lineTo(W / 2, H / 2 + 42); x.stroke();
        say('below', 20, 38, 27, 'left', 'italic');
        say(ship.landed ? 'landed' : metres(ship.alt), W - 20, 42, 38, 'right', '', hard ? hot : C);
        if (!ship.landed) {
          // (the drift over the ground, in the ship's own directions: a line from the middle, the way the ground is sliding under)
          const v = b.copy(ship.vel).addScaledVector(up.copy(ship.pos).normalize(), down).applyQuaternion(c2.copy(ship.quat).invert());
          const sp = Math.hypot(v.x, v.z);
          if (sp > 0.3) { const L = Math.min(150, 32 * Math.log2(1 + sp)); x.lineWidth = 4; x.beginPath(); x.moveTo(W / 2, H / 2); x.lineTo(W / 2 + (v.x / sp) * L, H / 2 + (v.z / sp) * L); x.stroke(); x.beginPath(); x.arc(W / 2 + (v.x / sp) * L, H / 2 + (v.z / sp) * L, 6, 0, 7); x.fill(); }
          say(`${Math.abs(down).toFixed(1)} m/s ${down >= 0 ? 'down' : 'up'}`, W - 20, H - 20, 27, 'right', '', hard ? hot : C);
          say(`${sp.toFixed(1)} along`, 20, H - 20, 27);
        }
      } else if (target) {
        // how the approach stands: the middle is "straight at it"; the dot is where the ship is really going
        const cx = W / 2, cy = H / 2 + 6;
        x.lineWidth = 1.5; x.strokeStyle = `rgba(${GLOW}, 0.4)`;
        for (const R of [46, 100]) { x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke(); }
        x.beginPath(); x.moveTo(cx - 120, cy); x.lineTo(cx - 100, cy); x.moveTo(cx + 100, cy); x.lineTo(cx + 120, cy); x.moveTo(cx, cy - 120); x.lineTo(cx, cy - 100); x.moveTo(cx, cy + 100); x.lineTo(cx, cy + 120); x.stroke();
        x.strokeStyle = `rgba(${GLOW}, 0.9)`; x.lineWidth = 3;
        const len = Math.hypot(nav.sx, nav.sy) || 1, L = Math.min(118, 30 * Math.log2(1 + nav.slide)), dx = (nav.sx / len) * L, dy = (-nav.sy / len) * L;
        if (nav.slide > 0.5) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + dx, cy + dy); x.stroke(); }
        x.beginPath(); x.arc(cx + (nav.slide > 0.5 ? dx : 0), cy + (nav.slide > 0.5 ? dy : 0), 8, 0, 7); x.fill();
        say(target.title, 20, 38, 27, 'left', 'italic');
        say(metres(nav.ground), W - 20, 42, 38, 'right');
        const late2 = nav.fill >= 1;
        say(Math.abs(nav.closing) < 0.5 ? 'holding' : `${nav.closing > 0 ? 'closing' : 'opening'} ${Math.round(Math.abs(nav.closing))} m/s`, 20, H - 20, 27);
        if (late2) say('BRAKE', W - 20, H - 20, 30, 'right', 'bold', hot);
        else if (nav.brakeIn < 600) say(`brake in ${seconds(nav.brakeIn)}`, W - 20, H - 20, 27, 'right');
        else if (nav.slide > 0.5) say(`aside ${Math.round(nav.slide)} m/s`, W - 20, H - 20, 27, 'right');
        // the room left to stop in, as a bar up the right-hand edge
        x.strokeStyle = `rgba(${GLOW}, 0.5)`; x.lineWidth = 2; x.strokeRect(W - 34, 66, 14, H - 132);
        x.fillStyle = late2 ? hot : C; x.fillRect(W - 32, 66 + (H - 132) * (1 - nav.fill), 10, (H - 132) * nav.fill);
      } else {
        say('ahead', 20, 38, 27, 'left', 'italic');
        say('no world framed', W / 2, H / 2 + 8, 27, 'center', 'italic', `rgba(${GLOW}, 0.6)`);
        say(`${Math.round(ship.vel.length())} m/s`, W - 20, 42, 38, 'right');
      }
      if (view !== 'rest') say('V', W / 2, 30, 17, 'center', '', `rgba(${GLOW}, 0.45)`);
      ink.tx.needsUpdate = true;
    }
    if (fresh || tickN % 6 === 3) {
      // the chart: the home world and its moon from above the moon's road, the ship, where it has been, the way to the sun
      const x = chart.x, W = chart.w, C = W / 2, home = seen.home, moon = seen.moon;
      x.fillStyle = '#06100e'; x.fillRect(0, 0, W, W);
      // (in the stars' own directions about the home world's middle: what is kept in a turning frame is turned back)
      const fq = frame.body.quat, flat = (p, out) => out.copy(p).sub(home.at).applyQuaternion(fq);
      const scale = (C * 0.62) / moon.body.a, put = (v) => [C + v.x * scale, C + v.z * scale];
      x.strokeStyle = `rgba(${GLOW}, 0.25)`; x.lineWidth = 1.5;
      x.beginPath(); x.arc(C, C, moon.body.a * scale, 0, 7); x.stroke();
      x.fillStyle = `rgba(${GLOW}, 0.9)`;
      x.beginPath(); x.arc(C, C, Math.max(5, home.body.radius * scale), 0, 7); x.fill();
      const mp = put(flat(moon.at, a));
      x.beginPath(); x.arc(mp[0], mp[1], Math.max(3.5, moon.body.radius * scale), 0, 7); x.fill();
      if (locked === 'moon' || locked === 'home') { const lp = locked === 'moon' ? mp : [C, C]; x.strokeStyle = `rgba(${GLOW}, 0.9)`; x.lineWidth = 1.5; x.strokeRect(lp[0] - 11, lp[1] - 11, 22, 22); }
      const sun = flat(seen.sun.at, a).setY(0).normalize();
      x.strokeStyle = 'rgba(255, 220, 150, 0.9)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(C + sun.x * C * 0.86, C + sun.z * C * 0.86); x.lineTo(C + sun.x * C * 0.95, C + sun.z * C * 0.95); x.stroke();
      const here = flat(ship.pos, b);
      if (tickN % 30 === 3) { trail.push(here.clone()); if (trail.length > 90) trail.shift(); }
      x.strokeStyle = `rgba(${GLOW}, 0.45)`; x.lineWidth = 1.5; x.beginPath();
      trail.forEach((p, i) => { const [u, v] = put(p); if (i) x.lineTo(u, v); else x.moveTo(u, v); });
      x.stroke();
      let [sx, sy] = put(here); const far = Math.hypot(sx - C, sy - C), rim = C * 0.84;
      if (far > rim) { sx = C + ((sx - C) / far) * rim; sy = C + ((sy - C) / far) * rim; }
      x.fillStyle = '#fff4d0'; x.beginPath(); x.arc(sx, sy, 5, 0, 7); x.fill();
      const ahead = c.set(0, 0, -1).applyQuaternion(ship.quat).applyQuaternion(fq);
      x.strokeStyle = '#fff4d0'; x.lineWidth = 2; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + ahead.x * 16, sy + ahead.z * 16); x.stroke();
      // (the glass is round: what is outside the ring is the brass)
      x.globalCompositeOperation = 'destination-in'; x.beginPath(); x.arc(C, C, C * 0.97, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
      chart.tx.needsUpdate = true;
    }
    // ---- the dials ----
    if (dials && (fresh || tickN % 3 === 2)) {
      const sp = ship.landed ? 0 : speedRel, vz = ship.landed ? 0 : -down;
      heat += ((ship.landed ? 0 : ship.push) - heat) * Math.min(1, s.dt * 3 * 0.5);
      dials.set('speed', sp < 3 ? (sp / 3) * 0.2 : 0.2 * (1 + Math.log(sp / 3) / Math.log(3.16)));
      dials.set('height', ship.alt < 10 ? (Math.max(ship.alt, 0) / 10) * 0.25 : 0.25 * (1 + Math.log10(ship.alt / 10)));
      dials.set('climb', 0.5 + vz / 80);
      dials.clock(s.dayPart ?? 0);
      dials.set('heat', 0.08 + 0.86 * Math.max(heat, s.sunHeat ?? 0));
      dials.set('air', 0.8 + 0.006 * Math.sin(s.now * 0.7));
      dials.set('pull', s.pull ?? 0);
      const lean = b.set(0, 1, 0).applyQuaternion(ship.quat), side = c.set(1, 0, 0).applyQuaternion(ship.quat);
      dials.set('lean', 0.5 + (Math.asin(THREE.MathUtils.clamp(side.dot(up.copy(ship.pos).normalize()), -1, 1)) * 57.3) / 80 * (lean.dot(up) < 0 ? -1 : 1));
      dials.draw();
    }
  }
  return { faces, track, update, seen, nav, get locked() { return locked; }, set locked(k) { locked = k; }, get view() { return shown; }, get lean() { return lean; }, get raise() { return raise; }, get up() { return upWant; }, glass };
}
