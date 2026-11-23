// What is seen before the game and over it: the picture shown while the worlds are made, the title, and the menu.
//
// All of it is drawn with the game's own lettering (src/hand.js) on a sheet laid over everything: no boxes, no
// buttons, nothing that looks like a page. What is chosen has a small sun beside it.
//
//   loading   a painted picture of the home world at dusk (the sun going down behind its edge, the ship standing
//             among the trees, the moon up), the name, and six beads on a thread that light as the worlds are made
//   title     the picture lifts off the world itself, which is by then there and going; the name stays, and under
//             it: Begin, Controls, Settings
//   paused    Tab, Esc or a pad's Options, while playing: the world stops and blurs; Resume, Controls, Settings,
//             Wake by the ship
//
// It is worked with the mouse, with the arrow keys (or W and S), Enter, and Esc to go back; or with a pad: up and
// down, cross to choose, circle to go back. Left and right change a setting. What is set is kept for next time.
import { write, width } from './hand.js';

const INK = '255, 236, 196', GOLD = '255, 204, 138', DARK = '7, 8, 13';
const KEEP = 'solar.settings';
const DEFAULTS = { sound: 0.8, music: 0.7, look: 1, stick: 1, invert: false, rumble: true };
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/**
 * quiet: no menu at all (checks and films). input: the game's Input (for which pad is in hand). words: the sheet of
 * prompts (it draws a line of keys for the Controls page, and is hushed while the title is up). blur: what is
 * behind the menu, to be dimmed and softened while paused. apply(settings): takes what is set. begin(), resume(),
 * wakeByShip(): what the choices do.
 */
export function createMenu(D) {
  // (what it is given is looked up when it is used: the menu is made before most of the game is)
  const quiet = !!D.quiet;
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
  document.body.appendChild(c);
  const g = c.getContext('2d');
  let W = 0, H = 0, U = 1, px = 1;
  let art = null, artW = 0, artH = 0;
  // what is up, which page of the menu, which line of it; and how far each has come (for coming and going softly)
  let state = 'loading', page = 'main', sel = 0, line = '', done = 0, of = 6;
  let lift = 0, shown = 0, now = 0, hot = [], padWas = [], padHeld = 0, padDir = 0;

  const settings = { ...DEFAULTS };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEEP) ?? '{}')); } catch { /* nothing kept */ }
  for (const k of Object.keys(DEFAULTS)) if (typeof settings[k] !== typeof DEFAULTS[k]) settings[k] = DEFAULTS[k];
  const keep = () => { try { localStorage.setItem(KEEP, JSON.stringify(settings)); } catch { /* it is kept for now only */ } D.apply?.(settings); };

  function fit() {
    px = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * px), h = Math.round(innerHeight * px);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    W = innerWidth; H = innerHeight; U = clamp(H / 900, 0.7, 1.9);
    g.setTransform(px, 0, 0, px, 0, 0);
  }

  // ------------------------------------------------------------------------------------------ the picture
  /** The home world at dusk, painted once for a window of this size. */
  function paint() {
    art = document.createElement('canvas'); artW = art.width = Math.round(W * px); artH = art.height = Math.round(H * px);
    const a = art.getContext('2d'), R = rng(20261117);
    a.setTransform(px, 0, 0, px, 0, 0);
    // the sky: night overhead, down through violet to the fire along the world's edge
    const sky = a.createLinearGradient(0, 0, 0, H);
    for (const [at, col] of [[0, '#04050b'], [0.26, '#0b102c'], [0.48, '#241f4c'], [0.63, '#5b3358'], [0.75, '#b55a44'], [0.85, '#eb9650'], [1, '#f6c477']]) sky.addColorStop(at, col);
    a.fillStyle = sky; a.fillRect(0, 0, W, H);
    // the band the stars are thickest along, and the stars
    a.save(); a.translate(W * 0.5, H * 0.3); a.rotate(-0.5);
    const band = a.createLinearGradient(0, -H * 0.16, 0, H * 0.16);
    band.addColorStop(0, 'rgba(120, 130, 200, 0)'); band.addColorStop(0.5, 'rgba(150, 140, 200, 0.075)'); band.addColorStop(1, 'rgba(120, 130, 200, 0)');
    a.fillStyle = band; a.fillRect(-W, -H * 0.16, W * 2, H * 0.32); a.restore();
    for (let i = 0; i < 340; i++) {
      const x = R() * W, y = R() ** 1.5 * H * 0.7, r = (0.45 + 1.25 * R() ** 4) * U, al = (0.25 + 0.75 * R()) * (1 - ease(y / (H * 0.7)) * 0.9), warm = R() < 0.25;
      a.fillStyle = `rgba(${warm ? '255, 226, 190' : '214, 226, 255'}, ${al})`;
      a.beginPath(); a.arc(x, y, r, 0, 7); a.fill();
      if (r > 1.25 * U) { const gl = a.createRadialGradient(x, y, 0, x, y, r * 6); gl.addColorStop(0, `rgba(220, 228, 255, ${0.28 * al})`); gl.addColorStop(1, 'rgba(220, 228, 255, 0)'); a.fillStyle = gl; a.beginPath(); a.arc(x, y, r * 6, 0, 7); a.fill(); }
    }
    // the far world, a pale blue point; and the moon, lit from below by the sun that is going down
    a.fillStyle = 'rgba(150, 190, 255, 0.9)'; a.beginPath(); a.arc(W * 0.19, H * 0.3, 2.6 * U, 0, 7); a.fill();
    {
      const mx = W * 0.5 + Math.min(W * 0.3, H * 0.52), my = H * 0.2, mr = H * 0.036;
      const gl = a.createRadialGradient(mx, my, mr, mx, my, mr * 4); gl.addColorStop(0, 'rgba(230, 220, 200, 0.16)'); gl.addColorStop(1, 'rgba(230, 220, 200, 0)');
      a.fillStyle = gl; a.beginPath(); a.arc(mx, my, mr * 4, 0, 7); a.fill();
      a.save(); a.beginPath(); a.arc(mx, my, mr, 0, 7); a.clip();
      a.fillStyle = '#d8cfbb'; a.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      for (const [dx, dy, r] of [[-0.3, 0.2, 0.3], [0.25, 0.42, 0.2], [0.1, -0.2, 0.24], [-0.5, -0.3, 0.14], [0.5, 0.0, 0.12]]) { a.fillStyle = 'rgba(120, 112, 104, 0.4)'; a.beginPath(); a.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 7); a.fill(); }
      // (its dark side: a second disc laid over, up and to the right)
      a.fillStyle = 'rgba(9, 10, 22, 0.9)'; a.beginPath(); a.arc(mx + mr * 0.52, my - mr * 0.6, mr * 1.08, 0, 7); a.fill();
      a.restore();
    }
    // the sun, half gone behind the world's edge, and its light in the air
    const sx = W * 0.5, sy = H * 0.815, sr = H * 0.2;
    for (const [r, al] of [[sr * 4.2, 0.2], [sr * 2.4, 0.3], [sr * 1.45, 0.5]]) { const gl = a.createRadialGradient(sx, sy, sr * 0.6, sx, sy, r); gl.addColorStop(0, `rgba(255, 196, 120, ${al})`); gl.addColorStop(1, 'rgba(255, 150, 90, 0)'); a.fillStyle = gl; a.fillRect(0, 0, W, H); }
    { const d = a.createRadialGradient(sx, sy - sr * 0.2, 0, sx, sy, sr); d.addColorStop(0, '#fff6dc'); d.addColorStop(0.7, '#ffe2a6'); d.addColorStop(1, '#ffc67a'); a.fillStyle = d; a.beginPath(); a.arc(sx, sy, sr, 0, 7); a.fill(); }
    // the world's edge: a great round, dark against the light, lit along its top where the sun is behind it
    const gr = Math.max(W * 1.25, H * 1.9), gx = W * 0.5, gy = H * 0.855 + gr;
    const up = (x) => gy - Math.sqrt(Math.max(gr * gr - (x - gx) ** 2, 0));
    const lit = (x) => Math.exp(-(((x - sx) / (sr * 1.9)) ** 2));
    // (what stands on it is drawn first, so that the ground comes up over its feet)
    const dark = (x, k = 1) => { const l = lit(x) * k; return `rgb(${Math.round(10 + 34 * l)}, ${Math.round(20 + 16 * l)}, ${Math.round(18 + 4 * l)})`; };
    const lean = (x) => Math.atan2(x - gx, gy - up(x)) ;
    const stand = (x, draw) => { a.save(); a.translate(x, up(x) + 2 * U); a.rotate(lean(x)); draw(); a.restore(); };
    const rim = (x) => `rgba(255, ${Math.round(170 + 40 * lit(x))}, ${Math.round(96 + 40 * lit(x))}, ${0.25 + 0.65 * lit(x)})`;
    const tree = (x, h, seed) => stand(x, () => {
      const T = rng(seed), side = x < sx ? 1 : -1;
      a.strokeStyle = dark(x); a.lineCap = 'round'; a.lineWidth = h * 0.085;
      a.beginPath(); a.moveTo(0, 0); a.quadraticCurveTo(h * 0.04 * (T() - 0.5), -h * 0.3, h * 0.03 * (T() - 0.5), -h * 0.56); a.stroke();
      a.lineWidth = h * 0.035;
      for (const s of [-1, 1]) { a.beginPath(); a.moveTo(0, -h * 0.42); a.lineTo(s * h * 0.2, -h * 0.66); a.stroke(); }
      const blobs = Array.from({ length: 9 }, (_, i) => { const an = (i / 9) * 6.283 + T(), rr = i ? h * (0.2 + 0.1 * T()) : 0; return [Math.cos(an) * rr * 1.2, -h * 0.74 + Math.sin(an) * rr * 0.8, h * (0.17 + 0.07 * T())]; });
      // (the light catches the side of the crown that is toward the sun)
      a.fillStyle = rim(x); for (const [bx, by, br] of blobs) { a.beginPath(); a.arc(bx + side * br * 0.11, by + br * 0.05, br, 0, 7); a.fill(); }
      a.fillStyle = dark(x); for (const [bx, by, br] of blobs) { a.beginPath(); a.arc(bx, by, br, 0, 7); a.fill(); }
    });
    const pine = (x, h, seed) => stand(x, () => {
      const T = rng(seed), side = x < sx ? 1 : -1;
      a.strokeStyle = dark(x); a.lineWidth = h * 0.04; a.beginPath(); a.moveTo(0, 0); a.lineTo(0, -h); a.stroke();
      for (const [col, off] of [[rim(x), side * h * 0.012], [dark(x), 0]]) {
        a.fillStyle = col;
        for (let k = 0; k < 7; k++) { const y = -h * (0.2 + 0.115 * k), w = h * (0.21 - 0.024 * k) * (0.9 + 0.2 * T()); a.beginPath(); a.moveTo(off - w, y + h * 0.05); a.quadraticCurveTo(off, y - h * 0.02, off + w, y + h * 0.05); a.lineTo(off, y - h * 0.2); a.closePath(); a.fill(); }
      }
    });
    // the ship: a round house on four legs, its roof, its chimney, its mast with a lamp, a lit window, its ramp down
    const ship = (x, h) => stand(x, () => {
      const w = h * 0.5, side = x < sx ? 1 : -1;
      a.strokeStyle = dark(x); a.lineCap = 'round'; a.lineWidth = h * 0.035;
      for (const s of [-1, 1]) { a.beginPath(); a.moveTo(s * w * 0.62, -h * 0.34); a.lineTo(s * w * 1.05, 0); a.stroke(); a.beginPath(); a.moveTo(s * w * 0.3, -h * 0.3); a.lineTo(s * w * 0.42, 0); a.stroke(); }
      for (const [col, off] of [[rim(x), side * h * 0.014], [dark(x), 0]]) {
        a.fillStyle = col;
        a.beginPath(); a.roundRect(off - w * 0.78, -h * 0.72, w * 1.56, h * 0.44, h * 0.05); a.fill();
        a.beginPath(); a.moveTo(off - w * 0.92, -h * 0.71); a.quadraticCurveTo(off, -h * 1.02, off + w * 0.92, -h * 0.71); a.closePath(); a.fill();
        a.fillRect(off + w * 0.3, -h * 1.0, h * 0.045, h * 0.2);
      }
      a.strokeStyle = dark(x); a.lineWidth = h * 0.014; a.beginPath(); a.moveTo(-w * 0.2, -h * 0.86); a.lineTo(-w * 0.2, -h * 1.3); a.stroke();
      // (the ramp, down at its back; the window, lit; the lamp at the masthead)
      a.fillStyle = dark(x); a.beginPath(); a.moveTo(-side * w * 0.5, -h * 0.3); a.lineTo(-side * w * 1.5, 0); a.lineTo(-side * w * 1.3, 0); a.lineTo(-side * w * 0.36, -h * 0.3); a.closePath(); a.fill();
      a.fillStyle = '#ffd898'; a.shadowColor = 'rgba(255, 200, 120, 0.9)'; a.shadowBlur = h * 0.14 * px;
      a.beginPath(); a.roundRect(side * w * 0.05 - w * 0.34, -h * 0.63, w * 0.68, h * 0.13, h * 0.02); a.fill();
      a.fillStyle = '#ffb070'; a.beginPath(); a.arc(-w * 0.2, -h * 1.32, h * 0.022, 0, 7); a.fill();
      // (a string of small bulbs under the eave)
      a.shadowBlur = h * 0.05 * px; a.fillStyle = '#ffe0a8';
      for (let i = 0; i < 9; i++) { const t = i / 8, bx = (t - 0.5) * w * 1.6; a.beginPath(); a.arc(bx, -h * 0.7 + Math.sin(t * Math.PI) * h * 0.03, h * 0.011, 0, 7); a.fill(); }
      a.shadowBlur = 0;
      // (and a dish on the roof, turned to the sky)
      a.strokeStyle = dark(x); a.lineWidth = h * 0.02; a.beginPath(); a.moveTo(w * 0.05, -h * 0.9); a.lineTo(w * 0.1, -h * 1.06); a.stroke();
      a.fillStyle = dark(x); a.beginPath(); a.ellipse(w * 0.12, -h * 1.09, h * 0.1, h * 0.03, -0.5, 0, 7); a.fill();
    });
    const wide = Math.min(W, H * 2.1);
    pine(gx - wide * 0.43, H * 0.2, 11); tree(gx - wide * 0.36, H * 0.15, 12); pine(gx - wide * 0.31, H * 0.16, 13);
    ship(gx - wide * 0.215, H * 0.135);
    tree(gx + wide * 0.24, H * 0.17, 14); tree(gx + wide * 0.33, H * 0.13, 15); pine(gx + wide * 0.39, H * 0.21, 16); pine(gx + wide * 0.45, H * 0.15, 17);
    // (the ground)
    a.beginPath(); a.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 6) a.lineTo(x, up(x));
    a.lineTo(W + 10, H + 10); a.closePath();
    { const gd = a.createLinearGradient(0, H * 0.84, 0, H); gd.addColorStop(0, '#1b2a20'); gd.addColorStop(0.35, '#101a16'); gd.addColorStop(1, '#070b0b'); a.fillStyle = gd; a.fill(); }
    // (its lit edge, and the grass along it: blades against the light)
    for (let x = -4; x <= W + 4; x += 2.2 * U) {
      const y = up(x), l = lit(x), h = (5 + 13 * R()) * U * (0.7 + 0.5 * l), bend = (R() - 0.4) * 7 * U;
      a.strokeStyle = R() < 0.3 + 0.5 * l ? `rgba(255, ${Math.round(190 + 40 * l)}, ${Math.round(110 + 50 * l)}, ${0.35 + 0.6 * l})` : dark(x, 0.6);
      a.lineWidth = (0.9 + 0.9 * R()) * U; a.lineCap = 'round';
      a.beginPath(); a.moveTo(x, y + 2 * U); a.quadraticCurveTo(x + bend * 0.3, y - h * 0.6, x + bend, y - h); a.stroke();
    }
    // the corners let fall away, and a grain over all of it, as paint has
    { const v = a.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, Math.hypot(W, H) * 0.62); v.addColorStop(0, 'rgba(0, 0, 0, 0)'); v.addColorStop(1, 'rgba(0, 0, 0, 0.5)'); a.fillStyle = v; a.fillRect(0, 0, W, H); }
    for (let i = 0; i < (W * H) / 260; i++) { a.fillStyle = R() < 0.5 ? 'rgba(255, 240, 220, 0.035)' : 'rgba(0, 0, 10, 0.045)'; a.fillRect(R() * W, R() * H, (1 + 2 * R()) * U, (1 + R()) * U); }
  }

  // ---------------------------------------------------------------------------------------------- lettering
  /** Writing that reads over anything: a dark edge under the pale letter. */
  function say(s, x, y, size, a = 1, o = {}) {
    write(g, s, x, y, size, { track: 0.05, ...o, weight: (o.weight ?? 0.1) + 0.2, color: `rgba(${DARK}, ${0.5 * a})` });
    return write(g, s, x, y, size, { weight: 0.1, track: 0.05, ...o, color: `rgba(${o.rgb ?? INK}, ${a})` });
  }
  function title(a, y, size) {
    write(g, 'SOLAR', W / 2, y, size, { align: 'center', weight: 0.2, track: 0.5, color: `rgba(${DARK}, ${0.35 * a})` });
    write(g, 'SOLAR', W / 2, y, size, { align: 'center', weight: 0.072, track: 0.5, color: `rgba(${INK}, ${0.97 * a})`, glow: 20 * U, glowColor: `rgba(255, 196, 124, ${0.55 * a})` });
    say('a small system, at dusk', W / 2, y + size * 0.78, size * 0.25, 0.7 * a, { align: 'center', slant: 0.14, weight: 0.1 });
  }
  /** A small sun: what marks the line that is chosen, and the knob on a setting's thread. */
  function sunAt(x, y, r, a) {
    const gl = g.createRadialGradient(x, y, 0, x, y, r * 3.4); gl.addColorStop(0, `rgba(255, 200, 120, ${0.5 * a})`); gl.addColorStop(1, 'rgba(255, 200, 120, 0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 3.4, 0, 7); g.fill();
    g.fillStyle = `rgba(255, 232, 180, ${a})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }

  // -------------------------------------------------------------------------------------------- the pages
  const PAGES = {
    main: () => (state === 'title'
      ? [{ name: 'Begin', act: () => leave(() => D.begin?.()) }, { name: 'Controls', act: () => go('controls') }, { name: 'Settings', act: () => go('settings') }, { name: 'Credits', act: () => go('credits') }]
      : [{ name: 'Resume', act: () => leave(() => D.resume?.()) }, { name: 'Controls', act: () => go('controls') }, { name: 'Settings', act: () => go('settings') }, { name: 'Credits', act: () => go('credits') }, { name: 'Wake by the ship', act: () => leave(() => { D.resume?.(); D.wakeByShip?.(); }) }]),
    settings: () => [
      { name: 'Sound', key: 'sound', min: 0, max: 1, step: 0.1 },
      { name: 'Music', key: 'music', min: 0, max: 1, step: 0.1 },
      { name: 'Looking, with the mouse', key: 'look', min: 0.4, max: 2, step: 0.1 },
      { name: 'Looking, with the stick', key: 'stick', min: 0.4, max: 2, step: 0.1 },
      { name: 'Up and down', key: 'invert', words: ['as they are', 'turned over'] },
      { name: 'The pad shakes', key: 'rumble', words: ['no', 'yes'] },
      { name: 'Back', act: () => go('main') },
    ],
    controls: () => [{ name: 'Back', act: () => go('main') }],
    credits: () => [{ name: 'Back', act: () => go('main') }],
  };
  const items = () => PAGES[page]();
  /** A sound of the menu (src/sound.js). */
  const ui = (kind, n) => D.ui?.(kind, n);
  // who made what is not ours, as each asks to be named
  const CREDITS = [
    ['Music', ['"Dreams Become Real" and "Floating Cities"', 'by Kevin MacLeod (incompetech.com)', 'Licensed under Creative Commons: By Attribution 4.0', 'creativecommons.org/licenses/by/4.0']],
    ['Sound', ['Footsteps on grass: Kenney (kenney.nl), CC0', 'Recordings from the Sonniss GDC Game Audio Bundles']],
    ['Made with', ['three.js (MIT)']],
    ['Everything else', ['is made in code, by Patch']],
  ];
  function go(to) { const from = page; page = to; sel = to === 'main' ? Math.max(0, items().findIndex((i) => i.name.toLowerCase() === from)) : 0; }
  function leave(then) {
    state = 'play'; page = 'main'; sel = 0;
    c.style.pointerEvents = 'none'; c.style.cursor = '';
    for (const el of D.blur ?? []) el.style.filter = '';
    D.input.keys.clear(); D.input.pressed.clear();
    D.words.hush(false);
    then?.();
  }
  function change(it, dir) {
    if (!it.key) return;
    if (it.words) settings[it.key] = !settings[it.key];
    else settings[it.key] = Math.round(clamp(settings[it.key] + dir * it.step, it.min, it.max) * 100) / 100;
    keep();
    if (it.words) ui(settings[it.key] ? 'on' : 'off'); else ui('set', (settings[it.key] - it.min) / (it.max - it.min));
  }
  function choose(it) {
    if (it.act) { ui(it.name === 'Begin' ? 'begin' : it.name === 'Resume' ? 'resume' : it.name === 'Back' ? 'back' : 'choose'); it.act(); }
    else if (it.words) change(it, 1);
  }
  function back() { if (page !== 'main') { ui('back'); go('main'); } else if (state === 'paused') { ui('resume'); leave(() => D.resume?.()); } }
  const move = (to) => { if (to !== sel) { sel = to; ui('move', sel); } };

  // -------------------------------------------------------------------------------- what the hands are doing
  // (while the menu is up no key gets past it to the game: it is asked first, and stops there)
  addEventListener('keydown', (e) => {
    if (state !== 'title' && state !== 'paused') return;
    e.stopImmediatePropagation();
    D.input.device = 'keys'; D.wake?.();
    const n = items().length, k = e.code;
    // (a key held down says so again and again: that moves along the list or a thread, but chooses and goes back only once)
    if (e.repeat && !k.startsWith('Arrow')) { e.preventDefault(); return; }
    if (k === 'ArrowUp' || k === 'KeyW') move((sel + n - 1) % n);
    else if (k === 'ArrowDown' || k === 'KeyS') move((sel + 1) % n);
    else if (k === 'ArrowLeft' || k === 'KeyA') change(items()[sel], -1);
    else if (k === 'ArrowRight' || k === 'KeyD') change(items()[sel], 1);
    else if (k === 'Enter' || k === 'Space' || k === 'KeyE') choose(items()[sel]);
    else if (k === 'Escape' || k === 'Backspace' || k === 'Tab') back();
    else return;
    e.preventDefault();
  }, true);
  const at = (e) => hot.find((h) => e.clientX >= h.x0 && e.clientX <= h.x1 && e.clientY >= h.y0 && e.clientY <= h.y1);
  c.addEventListener('mousemove', (e) => { const h = at(e); if (h) move(h.i); c.style.cursor = h ? 'pointer' : ''; });
  c.addEventListener('mousedown', (e) => {
    const h = at(e); if (!h) return;
    sel = h.i; const it = items()[h.i];
    // (a setting on a thread is set by where along it one presses)
    if (it.key && !it.words && h.t0 != null) { settings[it.key] = Math.round(clamp(it.min + ((e.clientX - h.t0) / (h.t1 - h.t0)) * (it.max - it.min), it.min, it.max) / it.step) * it.step; settings[it.key] = Math.round(settings[it.key] * 100) / 100; keep(); ui('set', (settings[it.key] - it.min) / (it.max - it.min)); }
    else choose(it);
  });
  function pad(dt) {
    const p = D.input.current?.();
    if (!p) { padWas = []; return; }
    const held = (i) => !!p.buttons[i]?.pressed, hit = (i) => held(i) && !padWas[i], n = items().length;
    if (p.buttons.some((b, i) => i < 16 && b.pressed) || Math.hypot(p.axes[0] ?? 0, p.axes[1] ?? 0) > 0.5) D.input.device = 'pad';
    const y = (held(13) ? 1 : 0) - (held(12) ? 1 : 0) || (Math.abs(p.axes[1] ?? 0) > 0.55 ? Math.sign(p.axes[1]) : 0);
    const x = (held(15) ? 1 : 0) - (held(14) ? 1 : 0) || (Math.abs(p.axes[0] ?? 0) > 0.55 ? Math.sign(p.axes[0]) : 0);
    // (held, a way goes on being taken: after a moment, and then steadily)
    const dir = y ? y * 2 : x;
    if (dir !== padDir) { padDir = dir; padHeld = 0; if (y) move((sel + n + y) % n); else if (x) change(items()[sel], x); }
    else if (dir) { padHeld += dt; if (padHeld > 0.42) { padHeld -= 0.11; if (y) move((sel + n + y) % n); else change(items()[sel], x); } }
    if (hit(0)) { D.wake?.(); choose(items()[sel]); } else if (hit(1)) back(); else if (hit(9) && state === 'paused') { ui('resume'); leave(() => D.resume?.()); }
    for (let i = 0; i < 16; i++) padWas[i] = held(i);
  }

  // ------------------------------------------------------------------------------------------------ drawing
  function menu(a, top) {
    hot = [];
    const list = items(), size = 21 * U, gap = size * 2.5;
    if (page === 'controls') {
      // (the keys stand either side of a thread down the middle: to its left what is done on foot, to its right in the ship)
      const kind = D.input.device === 'pad' ? D.input.padKind : null, s2 = 12.5 * U, y0 = top + s2 * 1.4, off = 30 * U;
      say(kind ? 'with the pad' : 'with the keys', W / 2, top - s2 * 2.6, 13 * U, 0.6 * a, { align: 'center', slant: 0.14 });
      g.strokeStyle = `rgba(${INK}, ${0.2 * a})`; g.lineWidth = U; g.beginPath(); g.moveTo(W / 2, y0 - s2 * 1.2); g.lineTo(W / 2, y0 + s2 * 3.05 * 11.1); g.stroke();
      for (const [k, head, names] of [[-1, 'on foot', ['foot', 'aboard']], [1, 'in the ship', ['fly']]]) {
        const right = W / 2 + k * off;
        say(head, right, y0, 15 * U, 0.85 * a, { align: k < 0 ? 'right' : 'left', rgb: GOLD });
        const rows = names.flatMap((nm) => D.words.rowsOf(nm, kind)).filter((r, i, all) => all.findIndex((q) => q[1] === r[1]) === i);
        D.words.drawRows(g, rows, right, y0 + s2 * 3.2, s2, 0.92 * a, kind, k);
      }
      top = Math.min(H - 70 * U, y0 + s2 * 3.05 * 12.4);
    }
    if (page === 'credits') {
      let y = top;
      for (const [head, lines] of CREDITS) {
        say(head, W / 2, y, 14 * U, 0.8 * a, { align: 'center', rgb: GOLD });
        y += 27 * U;
        for (const l of lines) { say(l, W / 2, y, 13.5 * U, 0.88 * a, { align: 'center' }); y += 25 * U; }
        y += 20 * U;
      }
      top = Math.min(H - 70 * U, y + 14 * U);
    }
    list.forEach((it, i) => {
      const y = top + i * gap, on = i === sel, al = a * (on ? 1 : 0.62);
      if (it.key) {
        // a setting: its name to the left of the middle, and to the right its thread with a sun on it, or its word
        const xl = W / 2 - 28 * U, xr = W / 2 + 28 * U, len = 230 * U;
        say(it.name, xl, y, size * 0.86, al, { align: 'right' });
        if (it.words) say(it.words[settings[it.key] ? 1 : 0], xr, y, size * 0.86, al, { rgb: on ? GOLD : INK, slant: 0.14 });
        else {
          const t = (settings[it.key] - it.min) / (it.max - it.min), yy = y - size * 0.36;
          g.lineCap = 'round'; g.lineWidth = 1.6 * U;
          g.strokeStyle = `rgba(${INK}, ${0.28 * al})`; g.beginPath(); g.moveTo(xr, yy); g.lineTo(xr + len, yy); g.stroke();
          g.strokeStyle = `rgba(${GOLD}, ${0.9 * al})`; g.beginPath(); g.moveTo(xr, yy); g.lineTo(xr + len * t, yy); g.stroke();
          sunAt(xr + len * t, yy, (on ? 6.5 : 5) * U, al);
          hot.push({ i, x0: xr - 14 * U, x1: xr + len + 14 * U, y0: y - size * 1.5, y1: y + size * 0.8, t0: xr, t1: xr + len });
        }
        hot.push({ i, x0: xl - width(it.name, size * 0.86) - 30 * U, x1: it.words ? xr + 200 * U : xr - 15 * U, y0: y - size * 1.5, y1: y + size * 0.8 });
        if (on) sunAt(xl - width(it.name, size * 0.86, { track: 0.05 }) - 22 * U, y - size * 0.36, 4.5 * U, a);
      } else {
        const w = say(it.name, W / 2, y, size, al, { align: 'center', rgb: on ? '255, 244, 214' : INK });
        const half = (w || width(it.name, size, { track: 0.05 })) / 2;
        if (on) sunAt(W / 2 - half - 24 * U, y - size * 0.38, 5.5 * U, a);
        hot.push({ i, x0: W / 2 - half - 44 * U, x1: W / 2 + half + 44 * U, y0: y - size * 1.5, y1: y + size * 0.85 });
      }
    });
    // (how it is worked, said low and small)
    const tip = D.input.device === 'pad' ? 'up and down to move  ·  cross to choose  ·  circle to go back' : 'arrows to move  ·  Enter to choose  ·  Esc to go back';
    say(D.input.device === 'pad' && D.input.padKind === 'xbox' ? 'up and down to move  ·  A to choose  ·  B to go back' : tip, W / 2, H - 34 * U, 11.5 * U, 0.42 * a, { align: 'center', slant: 0.14 });
  }

  function draw(dt = 0) {
    fit();
    now += dt;
    g.clearRect(0, 0, W, H);
    if (state === 'play') return;
    if (state === 'loading' || lift < 1) {
      if (!art || artW !== Math.round(W * px) || artH !== Math.round(H * px)) paint();
      g.globalAlpha = 1 - ease(lift); g.drawImage(art, 0, 0, W, H); g.globalAlpha = 1;
    }
    if (state === 'loading') {
      title(1, H * 0.34, 62 * U);
      // six beads on a thread, lit one by one as the worlds are made; and under them, what is being made
      const y = H * 0.34 + 62 * U * 1.6, gapB = 30 * U, x0 = W / 2 - (gapB * (of - 1)) / 2;
      g.strokeStyle = `rgba(${INK}, 0.28)`; g.lineWidth = U; g.beginPath(); g.moveTo(x0 - 16 * U, y); g.lineTo(x0 + gapB * (of - 1) + 16 * U, y); g.stroke();
      for (let i = 0; i < of; i++) {
        if (i < done) sunAt(x0 + i * gapB, y, 4.6 * U, 1);
        else { g.fillStyle = `rgba(${DARK}, 0.7)`; g.strokeStyle = `rgba(${INK}, ${i === done ? 0.9 : 0.4})`; g.lineWidth = 1.3 * U; g.beginPath(); g.arc(x0 + i * gapB, y, 4 * U, 0, 7); g.fill(); g.stroke(); }
      }
      say(line, W / 2, y + 36 * U, 15.5 * U, 0.86, { align: 'center', slant: 0.2, wobble: 0.3, pen: 0.5, seed: 5 });
      return;
    }
    // the title, over the world itself; or the menu, over the world stopped
    if (state === 'title') { lift = Math.min(1, lift + dt / 1.6); shown = Math.min(1, shown + dt / 0.9); } else shown = Math.min(1, shown + dt / 0.25);
    pad(dt);
    if (state === 'play') { g.clearRect(0, 0, W, H); return; }
    const a = ease(shown);
    // (a soft dark from above and below, so the lettering reads over a bright sky)
    const shade = g.createLinearGradient(0, 0, 0, H);
    const k = state === 'paused' ? 1.35 : 0.55;
    shade.addColorStop(0, `rgba(${DARK}, ${0.62 * a * k})`); shade.addColorStop(0.42, `rgba(${DARK}, ${0.3 * a * k})`); shade.addColorStop(0.7, `rgba(${DARK}, ${0.34 * a * k})`); shade.addColorStop(0.92, `rgba(${DARK}, ${0.5 * a * k})`); shade.addColorStop(1, `rgba(${DARK}, ${0.85 * a})`);
    g.fillStyle = shade; g.fillRect(0, 0, W, H);
    const small = page !== 'main';
    title(small ? 0.85 : 1, small ? H * 0.15 : H * 0.34, (small ? 34 : 62) * U);
    menu(a, page === 'main' ? H * 0.34 + 62 * U * 2.15 : page === 'settings' ? H * 0.3 : page === 'credits' ? H * 0.29 : H * 0.3);
  }

  return {
    settings,
    get state() { return state; },
    /** While the worlds are made: what is being made, and how many of the things to make are done. */
    loading(text, total = of) { if (line && text !== line) done++; line = text; of = total; state = 'loading'; draw(0); },
    /** The worlds are made: the picture lifts off them, and the title is up (or, with no menu, the game is). */
    ready() {
      done = of;
      D.apply?.(settings);
      if (quiet) { state = 'play'; lift = 1; g.clearRect(0, 0, W, H); return; }
      state = 'title'; page = 'main'; sel = 0; shown = 0; lift = 0;
      // (for Patch's test, which presses nothing in particular: the title is shown a while, and then it begins)
      if (D.auto) setTimeout(() => { if (state === 'title') { page = 'main'; leave(() => D.begin?.()); } }, 6000);
      D.wake?.();
      c.style.pointerEvents = 'auto';
      D.words.hush(true);
    },
    /** The menu, over the game stopped. */
    open() {
      if (quiet || state !== 'play') return;
      state = 'paused'; page = 'main'; sel = 0; shown = 0; padWas = Array(16).fill(true);
      ui('open');
      c.style.pointerEvents = 'auto';
      document.exitPointerLock?.();
      for (const el of D.blur ?? []) el.style.filter = 'blur(7px) brightness(0.62) saturate(0.85)';
    },
    draw,
  };
}
