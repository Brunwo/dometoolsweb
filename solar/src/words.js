// What is said to whoever is playing: what a key will do where they stand, the keys there are for what they are
// doing, and the line shown while the worlds are being made. All of it is drawn with the game's own lettering
// (src/hand.js) on a sheet laid over the picture: a key is a small dark tile with its name on it.
//
// A line to ask is written as it always was: 'E  sit', 'Space  lift off  ·  E  stand up'. Two spaces part a key
// from what it does; a dot between two spaces parts one thing from the next. A piece that begins with no key is
// simply said.
import { write, width } from './hand.js';

const INK = '255, 236, 196', DARK = '9, 8, 11';
const isKey = (s) => /^(hold )?(Space|Shift|mouse|click|Tab|[A-Z0-9]( [A-Z0-9])*)$/.test(s);

// On a pad the same lines are drawn with its buttons: a round tile for a button on its face (Sony's by their
// shapes, anyone else's by their letters) and for a stick, a long one for a shoulder or a trigger.
const FACE = { cross: 'A', circle: 'B', square: 'X', triangle: 'Y' }, LONG = { xbox: { L1: 'LB', R1: 'RB', L2: 'LT', R2: 'RT', L3: 'LS', R3: 'RS', options: 'MENU' }, ps: { options: 'OPTIONS' } };
/** What a key named in a line is on a pad. seat: said to someone in the ship's seat. */
const onPad = (key, seat) => ({ E: seat ? 'circle' : 'square', Space: seat ? 'R2' : 'cross', V: 'square', R: 'L3', X: 'cross', H: 'options', Shift: 'L2', G: 'up' })[key] ?? null;
const PADS = {
  foot: [['LS', 'walk'], ['L3', 'run'], ['cross', 'jump'], ['RS', 'look about']],
  aboard: [['LS', 'walk'], ['square', 'sit, or take the suit'], ['RS', 'look about']],
  seat: [['R2', 'lift off'], ['circle', 'stand up'], ['RS', 'look about']],
  fly: [['LS', 'push ahead, back, aside'], ['R2', 'push up'], ['L2', 'push down'], ['RS', 'turn'], ['hold L1 RS', 'roll'], ['L3', 'lock the world framed'], ['up', 'autopilot, to the world locked'], ['hold cross', 'match its speed'], ['square', 'the landing glass'], ['hold down', 'look about'], ['circle', 'get up']],
  cabin: [['LS', 'walk'], ['square', 'sit, or take the suit'], ['RS', 'look about']],
};

/** The keys there are, for each thing one can be doing: shown for a while the first time, and again with H. */
const KEYS = {
  foot: [['W A S D', 'walk'], ['Shift', 'run'], ['Space', 'jump'], ['mouse', 'look about']],
  aboard: [['W A S D', 'walk'], ['E', 'sit, or take the suit'], ['mouse', 'look about']],
  seat: [['Space', 'lift off'], ['E', 'stand up'], ['mouse', 'look about']],
  fly: [['W A S D', 'push ahead, back, aside'], ['Space', 'push up'], ['Shift', 'push down'], ['mouse', 'turn'], ['Z C', 'roll'], ['R', 'lock the world framed'], ['G', 'autopilot, to the world locked'], ['hold X', 'match its speed'], ['V', 'the landing glass'], ['E', 'get up']],
  cabin: [['W A S D', 'walk'], ['E', 'sit, or take the suit'], ['mouse', 'look about']],
};

export function createWords({ quiet = false } = {}) {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
  document.body.appendChild(c);
  let g = c.getContext('2d');
  let W = 0, H = 0, U = 1;
  function fit() {
    const px = Math.min(devicePixelRatio || 1, 2), w = Math.round(innerWidth * px), h = Math.round(innerHeight * px);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    W = innerWidth; H = innerHeight; U = Math.min(1.9, Math.max(0.9, H / 900));
    g.setTransform(px, 0, 0, px, 0, 0);
  }
  /** Writing that reads over anything: a dark edge under the pale letter. */
  function say(s, x, y, size, a = 1, o = {}) {
    write(g, s, x, y, size, { track: 0.04, ...o, weight: (o.weight ?? 0.108) + 0.2, color: `rgba(${DARK}, ${0.55 * a})` });
    return write(g, s, x, y, size, { weight: 0.108, track: 0.04, ...o, color: `rgba(${o.rgb ?? INK}, ${a})`, glow: o.glow ?? 0 });
  }
  const KEY = { weight: 0.13 };
  let pad = null; // 'ps' or 'xbox' while a pad is what is in the hands
  /** A pad's button, as it is drawn: round with a shape or a letter in it, or long with its name. */
  const button = (name) => {
    if (FACE[name]) return pad === 'ps' ? { round: true, shape: name } : { round: true, text: FACE[name] };
    if (name === 'LS' || name === 'RS') return { round: true, text: name[0], ring: true };
    if (name === 'down' || name === 'up') return { round: true, shape: name };
    return { text: LONG[pad]?.[name] ?? name };
  };
  const capW = (name, size, isPad = false) => {
    if (isPad) { const b = button(name); return b.round ? size * 2.15 : Math.max(width(b.text, size * 0.86, KEY) + size * 1.2, size * 2.5); }
    return Math.max(width(name, size, KEY) + size * 1.3, size * 2.15);
  };
  function padCap(name, x, y, size, a) {
    const b = button(name), w = capW(name, size, true), h = size * 2.15, top = y - size - (h - size) / 2, cx = x + w / 2, cy = top + h / 2, r = h / 2;
    const tile = (dy, fill) => { g.beginPath(); if (b.round) g.arc(cx, cy + dy, r, 0, 7); else g.roundRect(x, top + dy, w, h, h * 0.42); g.fillStyle = fill; g.fill(); };
    tile(size * 0.16, `rgba(${DARK}, ${0.5 * a})`); tile(0, `rgba(28, 24, 22, ${0.86 * a})`);
    g.strokeStyle = `rgba(${INK}, ${0.9 * a})`; g.lineWidth = Math.max(1, size * 0.12); g.stroke();
    // (a stick: a ring inside the tile, as its cap has)
    if (b.ring) { g.beginPath(); g.arc(cx, cy, r * 0.72, 0, 7); g.lineWidth = Math.max(1, size * 0.07); g.strokeStyle = `rgba(${INK}, ${0.45 * a})`; g.stroke(); }
    if (b.text) { const s2 = b.round ? size : size * 0.86; write(g, b.text, cx, cy + s2 * 0.5, s2, { ...KEY, align: 'center', color: `rgba(${INK}, ${a})` }); return w; }
    g.strokeStyle = g.fillStyle = `rgba(${INK}, ${a})`; g.lineWidth = Math.max(1.2, size * 0.17); g.lineCap = 'round'; g.lineJoin = 'round';
    const k = r * 0.44;
    g.beginPath();
    if (b.shape === 'cross') { g.moveTo(cx - k, cy - k); g.lineTo(cx + k, cy + k); g.moveTo(cx + k, cy - k); g.lineTo(cx - k, cy + k); g.stroke(); }
    else if (b.shape === 'circle') { g.arc(cx, cy, k * 1.12, 0, 7); g.stroke(); }
    else if (b.shape === 'square') { g.rect(cx - k, cy - k, k * 2, k * 2); g.stroke(); }
    else if (b.shape === 'triangle') { g.moveTo(cx, cy - k * 1.15); g.lineTo(cx + k * 1.2, cy + k * 0.85); g.lineTo(cx - k * 1.2, cy + k * 0.85); g.closePath(); g.stroke(); }
    else {
      // the four-way pad, the arm that is meant filled
      const t = k * 0.42, e = k * 1.3;
      g.lineWidth = Math.max(1, size * 0.09); g.strokeStyle = `rgba(${INK}, ${0.5 * a})`;
      g.moveTo(cx - t, cy - e); g.lineTo(cx + t, cy - e); g.lineTo(cx + t, cy - t); g.lineTo(cx + e, cy - t); g.lineTo(cx + e, cy + t); g.lineTo(cx + t, cy + t); g.lineTo(cx + t, cy + e); g.lineTo(cx - t, cy + e); g.lineTo(cx - t, cy + t); g.lineTo(cx - e, cy + t); g.lineTo(cx - e, cy - t); g.lineTo(cx - t, cy - t); g.closePath(); g.stroke();
      g.beginPath(); g.rect(cx - t, b.shape === 'up' ? cy - e : cy + t, t * 2, e - t); g.fill();
    }
    return w;
  }
  /** One key: its left edge, the line its name stands on. Gives back how wide it is. */
  function cap(name, x, y, size, a) {
    const w = capW(name, size), h = size * 2.15, top = y - size - (h - size) / 2, r = size * 0.5;
    g.beginPath(); g.roundRect(x, top + size * 0.16, w, h, r);
    g.fillStyle = `rgba(${DARK}, ${0.5 * a})`; g.fill();
    g.beginPath(); g.roundRect(x, top, w, h, r);
    g.fillStyle = `rgba(28, 24, 22, ${0.86 * a})`; g.fill();
    g.strokeStyle = `rgba(${INK}, ${0.9 * a})`; g.lineWidth = Math.max(1, size * 0.12); g.stroke();
    write(g, name, x + w / 2, y, size, { ...KEY, align: 'center', color: `rgba(${INK}, ${a})` });
    return w;
  }
  /** A piece of a line, cut into what is to be drawn: keys, and what is said. */
  function pieces(seg, seat = false) {
    const parts = seg.split(/ {2,}/), out = [];
    if (parts.length > 1 && isKey(parts[0])) {
      let k = parts.shift();
      if (k.startsWith('hold ')) { out.push({ say: 'hold' }); k = k.slice(5); }
      for (const one of /^[A-Z0-9]( [A-Z0-9])+$/.test(k) ? k.split(' ') : [k]) { const b = pad && onPad(one, seat); out.push(b ? { key: b, pad: true } : { key: one }); }
    }
    if (parts.length) out.push({ say: parts.join('  ') });
    return out;
  }
  const GAP = 0.62;
  function measure(list, size) { let w = 0; list.forEach((p, i) => { w += (p.key ? capW(p.key, size, p.pad) : width(p.say, size)) + (i ? size * (p.key && list[i - 1].key ? 0.3 : GAP) : 0); }); return w; }
  function lay(list, x, y, size, a) {
    list.forEach((p, i) => {
      if (i) x += size * (p.key && list[i - 1].key ? 0.3 : GAP);
      x += p.key ? (p.pad ? padCap : cap)(p.key, x, y, size, a) : say(p.say, x, y, size, a);
    });
  }
  /** A row of the list of keys, cut up: for the keyboard as a line is, for a pad by its buttons' names. */
  const row = (k) => (pad ? k.split(' ').map((t) => (t === 'hold' ? { say: 'hold' } : { key: t, pad: true })) : pieces(`${k}  x`).filter((p) => p.key || p.say === 'hold'));
  const table = () => (pad ? PADS : KEYS);

  let ask = '', shown = '', askA = 0, high = false, waiting = null, hushed = false;
  let rows = null, rowsFor = 0, rowsAge = 0, what = '';
  const seen = new Set();
  function draw(dt) {
    fit();
    g.clearRect(0, 0, W, H);
    if (waiting !== null || hushed) return;
    // ---- what a key will do here: one line, low in the picture (or, in the seat, high in the window) ----
    if (shown !== ask) { askA = Math.max(0, askA - dt / 0.14); if (askA <= 0) shown = ask; }
    else askA = Math.min(1, askA + dt / 0.22);
    if (shown && askA > 0.01) {
      const size = 14.5 * U, segs = shown.split(/ {2}· {2}/).map((seg) => pieces(seg, high)), dot = size * 1.7;
      const total = segs.reduce((w, s2) => w + measure(s2, size), 0) + dot * (segs.length - 1);
      let x = W / 2 - total / 2; const y = high ? H * 0.2 : H * 0.86;
      segs.forEach((s2, i) => {
        if (i) { say('·', x + dot / 2, y, size, askA * 0.7, { align: 'center' }); x += dot; }
        lay(s2, x, y, size, askA); x += measure(s2, size);
      });
    }
    // ---- the keys there are: a column down the right-hand edge, for a while ----
    if (rows && rowsFor > 0) {
      rowsFor -= dt; rowsAge += dt;
      const a = Math.min(1, rowsFor / 1.2, rowsAge / 0.4) * 0.95, size = 12.5 * U, right = W - 34 * U;
      rows.forEach(([k, s], i) => {
        const list = row(k), kw = measure(list, size), y = 62 * U + i * size * 3.05;
        lay(list, right - kw, y, size, a);
        say(s, right - kw - size * 0.9, y, size, a, { align: 'right' });
      });
    } else if (!quiet && what) {
      // (small, in the corner: how to see the keys again, and how to get to the menu)
      const size = 10.5 * U, a = 0.42, right = W - 30 * U;
      (pad ? [['options', 'menu']] : [['H', 'keys'], ['Tab', 'menu']]).forEach(([k, s], i) => {
        const kw = capW(k, size, !!pad), y = 50 * U + i * size * 2.9;
        (pad ? padCap : cap)(k, right - kw, y, size, a); say(s, right - kw - size * 0.8, y, size, a, { align: 'right' });
      });
    }
  }
  return {
    /** What a key will do where one stands ('' for nothing). high: it goes at the head of the window, not the foot of the picture. */
    prompt(line, atTop = false) { ask = line || ''; high = atTop; },
    /** What one is doing: 'foot', 'aboard', 'seat', 'fly', 'cabin'. Its keys are shown the first time, for a while. */
    doing(name) {
      if (name === what) return;
      what = name;
      if (!seen.has(name) && !quiet) { seen.add(name); rows = table()[name]; rowsFor = name === 'fly' ? 18 : 11; rowsAge = 0; } else if (rows !== table()[name]) rowsFor = Math.min(rowsFor, 0.6);
    },
    /** The keys for what one is doing, again. */
    again() { if (table()[what]) { rows = table()[what]; rowsFor = 12; rowsAge = 0; } },
    /** Nothing is said or shown while this is on (the title is up); when it goes off, it is as if one had just come. */
    hush(yes) { hushed = yes; if (!yes) { what = ''; ask = shown = ''; askA = 0; } },
    /** The keys (or, for a kind of pad, the buttons) for one thing one can be doing. */
    rowsOf: (name, kind) => (kind ? PADS : KEYS)[name] ?? [],
    /**
     * Draws such rows on another sheet (the menu's), the line the first stands on at `top`. side -1: what each does
     * and then its keys, the keys ending at x. side 1: its keys, beginning at x, and then what each does.
     */
    drawRows(ctx, rows, x, top, size, a, kind, side = -1) {
      const mine = g, was = pad;
      g = ctx; pad = kind;
      rows.forEach(([k, s], i) => {
        const list = row(k), kw = measure(list, size), y = top + i * size * 3.05;
        if (side < 0) { lay(list, x - kw, y, size, a); say(s, x - kw - size * 0.9, y, size, a, { align: 'right' }); }
        else { lay(list, x, y, size, a); say(s, x + kw + size * 0.9, y, size, a); }
      });
      g = mine; pad = was;
    },
    /** What is in the hands: a pad ('ps' or 'xbox'), or nothing (the keys). What is shown follows it at once. */
    using(kind) {
      if (kind === pad) return;
      const showing = rows && rowsFor > 0 && rows === table()[what];
      pad = kind;
      if (showing) rows = table()[what];
    },
    /** The line shown while the worlds are made (nothing: they are made). */
    loading(line) {
      waiting = line; fit(); g.clearRect(0, 0, W, H);
      if (line === null) return;
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#07080d'); sky.addColorStop(0.7, '#141526'); sky.addColorStop(1, '#2b2026');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      write(g, 'SOLAR', W / 2, H * 0.46, 58 * U, { align: 'center', weight: 0.075, track: 0.5, color: `rgba(${INK}, 0.96)`, glow: 18 * U, glowColor: 'rgba(255, 200, 130, 0.5)' });
      write(g, 'a small system, at dusk', W / 2, H * 0.46 + 46 * U, 15 * U, { align: 'center', weight: 0.1, slant: 0.14, track: 0.06, color: `rgba(${INK}, 0.62)` });
      write(g, line, W / 2, H * 0.46 + 120 * U, 16 * U, { align: 'center', weight: 0.1, slant: 0.2, wobble: 0.3, pen: 0.5, seed: 5, color: `rgba(${INK}, 0.85)` });
    },
    draw,
  };
}
