// What is printed, engraved or painted on things in the ship: the names on brass plates, the charts on the walls
// and the table, the card of what to do before lifting, the ship's mark, the faces of its dials.
//
// All of it is drawn here, once, onto one sheet; tools/ship/prints.json says where on the sheet each thing is, and
// the ship's builder (tools/ship) puts each piece's corners there. The dials whose needles move have a second,
// small sheet, which is drawn afresh as the ship flies.
import * as THREE from 'three';
import layout from '../tools/ship/prints.json' with { type: 'json' };
import { write, width, engrave } from './hand.js';

const INKD = '#2b2118', PAPER = '#e9dfc4', BRASSY = '#b99a55';

/** A small steady source of numbers, so that what is drawn by lot is the same every time. */
function lot(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** Every name on a plate, in the order the sheet has them. */
const LABELS = [...layout.labels, ...layout.labels_cockpit, ...layout.labels_room, ...layout.labels_out];
function cellOf(name) {
  if (layout.cells[name]) return layout.cells[name];
  const [lw, lh, per] = layout.label, i = LABELS.indexOf(name);
  return [(i % per) * lw, Math.floor(i / per) * lh, lw, lh];
}

/** A sheet of paper that has been about: not quite even, darker at its edges. */
function paper(x, w, h, tone = PAPER, r = lot(7)) {
  x.fillStyle = tone; x.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 900; i++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '120, 90, 50' : '255, 250, 235'}, ${0.03 + 0.05 * r()})`;
    x.beginPath(); x.ellipse(r() * w, r() * h, 4 + r() * 26, 3 + r() * 14, r() * 3, 0, 7); x.fill();
  }
  const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.56);
  g.addColorStop(0, 'rgba(90, 60, 30, 0)'); g.addColorStop(1, 'rgba(90, 60, 30, 0.3)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}
// Three ways of writing: what is printed (upright, even), what the pilot wrote (leaning, quick: asked for as
// 'italic'), and what is cut into brass. size is as it was reckoned for type: a capital is about 0.72 of it.
const PRINTED = { weight: 0.125, pen: 0.6, wobble: 0.1 }, WRITTEN = { weight: 0.095, slant: 0.22, wobble: 0.45, pen: 0.6, tab: false }, CUT = { weight: 0.12, track: 0.14, pen: 0.35, wobble: 0.05 };
const seedOf = (s) => { let n = 7; for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0; return n; };
const words = (x, s, px, py, size, style = '', align = 'left', col = INKD) => write(x, s, px, py, size * 0.72, { ...(style.includes('italic') ? WRITTEN : PRINTED), ...(style.includes('bold') ? { weight: 0.15 } : {}), align, color: col, seed: seedOf(s) });
/** A name cut into metal, as large as will go into a width. */
function cut(x, s, cx, cy, size, most, col = '#2a2010') {
  while (size > 5 && width(s, size, CUT) > most) size -= 0.5;
  engrave(x, s, cx, cy + size / 2, size, { ...CUT, align: 'center', color: col, seed: seedOf(s) });
}
/** A wobbling closed line round a middle: a coast, an island. */
function coast(x, cx, cy, R, r, n = 46, rough = 0.3) {
  const ph = [r() * 7, r() * 7, r() * 7];
  x.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + rough * (0.5 * Math.sin(a * 3 + ph[0]) + 0.3 * Math.sin(a * 5 + ph[1]) + 0.2 * Math.sin(a * 9 + ph[2]));
    const px = cx + Math.cos(a) * R * k, py = cy + Math.sin(a) * R * k * 0.8;
    if (i) x.lineTo(px, py); else x.moveTo(px, py);
  }
  x.closePath();
}

const DRAW = {
  /** The road of every world round the sun, as someone drew it by hand. */
  chart_wall(x, w, h) {
    const r = lot(3); paper(x, w, h);
    x.strokeStyle = INKD; x.lineWidth = 2; x.strokeRect(10, 10, w - 20, h - 20); x.lineWidth = 1; x.strokeRect(15, 15, w - 30, h - 30);
    const cx = w * 0.4, cy = h * 0.54;
    x.fillStyle = '#d9913a'; x.beginPath(); x.arc(cx, cy, 20, 0, 7); x.fill(); x.stroke();
    for (let i = 0; i < 12; i++) { const a = i * 0.5236; x.beginPath(); x.moveTo(cx + Math.cos(a) * 25, cy + Math.sin(a) * 25); x.lineTo(cx + Math.cos(a) * 33, cy + Math.sin(a) * 33); x.stroke(); }
    x.setLineDash([5, 4]);
    for (const R of [92, 150]) { x.beginPath(); x.ellipse(cx, cy, R, R * 0.8, 0, 0, 7); x.stroke(); }
    x.setLineDash([]);
    const hx = cx + 92 * Math.cos(-0.7), hy = cy + 92 * 0.8 * Math.sin(-0.7);
    x.fillStyle = '#5f8f4e'; x.beginPath(); x.arc(hx, hy, 11, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.ellipse(hx, hy, 24, 19, 0, 0, 7); x.stroke();
    x.fillStyle = '#b9b2a0'; x.beginPath(); x.arc(hx + 24, hy + 2, 4.5, 0, 7); x.fill(); x.stroke();
    const fx = cx + 150 * Math.cos(2.3), fy = cy + 150 * 0.8 * Math.sin(2.3);
    x.fillStyle = '#8a6a8f'; x.beginPath(); x.arc(fx, fy, 14, 0, 7); x.fill(); x.stroke();
    words(x, 'Home', hx + 18, hy - 22, 17, 'italic'); words(x, 'the moon', hx + 34, hy + 8, 13, 'italic');
    words(x, 'the far world', fx - 34, fy + 34, 15, 'italic'); words(x, 'The Sun', cx - 26, cy + 52, 15, 'italic');
    words(x, 'THE ROADS OF THE WORLDS', w - 30, 44, 19, '', 'right');
    words(x, 'as reckoned from Home', w - 30, 64, 13, 'italic', 'right');
    // a rose of the winds, and a scale
    const rx = w - 76, ry = h - 86;
    for (let i = 0; i < 8; i++) { const a = i * 0.7854, L = i % 2 ? 22 : 38; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx + Math.cos(a) * L, ry + Math.sin(a) * L); x.stroke(); }
    x.beginPath(); x.arc(rx, ry, 26, 0, 7); x.stroke();
    x.fillStyle = INKD; for (let i = 0; i < 5; i++) if (i % 2 === 0) x.fillRect(36 + i * 22, h - 44, 22, 5); x.strokeRect(36, h - 44, 110, 5);
    words(x, 'one year: eight minutes', 36, h - 52, 12, 'italic');
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(43, 33, 24, ${0.25 + r() * 0.4})`; x.beginPath(); x.arc(24 + r() * (w - 48), 24 + r() * (h - 48), 0.8 + r(), 0, 7); x.fill(); }
  },
  /** A chart of the country round where the ship stands, with a way pencilled on it. */
  chart_table(x, w, h) {
    const r = lot(11); paper(x, w, h, '#e3d9bb');
    x.strokeStyle = 'rgba(60, 90, 110, 0.35)'; x.lineWidth = 1;
    for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo((i * w) / 8, 0); x.lineTo((i * w) / 8, h); x.stroke(); }
    for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(0, (i * h) / 6); x.lineTo(w, (i * h) / 6); x.stroke(); }
    for (const [cx, cy, R, tone] of [[150, 150, 96, '#b9c79a'], [360, 250, 120, '#c4cc9c'], [260, 96, 44, '#b9c79a'], [80, 300, 40, '#c9c296']]) {
      coast(x, cx, cy, R, r); x.fillStyle = tone; x.fill(); x.strokeStyle = INKD; x.lineWidth = 1.6; x.stroke();
      x.strokeStyle = 'rgba(43, 33, 24, 0.3)'; x.lineWidth = 1;
      for (const k of [0.66, 0.36]) { coast(x, cx + 4, cy - 3, R * k, r, 36, 0.22); x.stroke(); }
    }
    // woods as small rings, a tor, a hollow
    x.strokeStyle = 'rgba(40, 70, 40, 0.7)';
    for (let i = 0; i < 46; i++) { const px = 300 + r() * 150, py = 190 + r() * 110; x.beginPath(); x.arc(px, py, 4 + r() * 3, 0, 7); x.stroke(); }
    words(x, 'the wood', 372, 244, 15, 'italic'); words(x, 'the tor', 118, 128, 15, 'italic'); words(x, 'the hollow', 54, 356, 13, 'italic');
    x.strokeStyle = '#a03a2a'; x.lineWidth = 2; x.setLineDash([7, 5]);
    x.beginPath(); x.moveTo(150, 170); x.bezierCurveTo(210, 210, 250, 150, 300, 200); x.bezierCurveTo(330, 230, 350, 240, 372, 262); x.stroke(); x.setLineDash([]);
    x.beginPath(); x.moveTo(366, 256); x.lineTo(378, 268); x.moveTo(378, 256); x.lineTo(366, 268); x.stroke();
    words(x, 'HOME, by the wood', 20, 30, 18); words(x, 'north pole sheet', 20, 48, 12, 'italic');
    const rx = w - 62, ry = 62; x.strokeStyle = INKD; x.lineWidth = 1.4;
    x.beginPath(); x.arc(rx, ry, 30, 0, 7); x.stroke();
    x.beginPath(); x.moveTo(rx, ry - 40); x.lineTo(rx + 7, ry); x.lineTo(rx, ry + 40); x.lineTo(rx - 7, ry); x.closePath(); x.stroke();
    x.fillStyle = INKD; x.beginPath(); x.moveTo(rx, ry - 40); x.lineTo(rx + 7, ry); x.lineTo(rx - 7, ry); x.fill();
  },
  /** What to do before lifting: it is also how the ship is flown. */
  checklist(x, w, h) {
    paper(x, w, h, '#ece3c8', lot(5));
    words(x, 'BEFORE LIFTING', w / 2, 46, 27, '', 'center');
    x.strokeStyle = INKD; x.lineWidth = 2; x.beginPath(); x.moveTo(40, 60); x.lineTo(w - 40, 60); x.stroke();
    const rows = ['Kettle off the stove', 'Sit: the ramp comes up', 'Lamp RAMP is green', 'Look below, then lift', 'Frame a world, lock it', 'Brake when the ring fills', 'Match its speed, then land', 'Come down gently'];
    rows.forEach((s, i) => {
      const y = 104 + i * 46;
      x.strokeRect(34, y - 19, 22, 22);
      if (i < 3) { x.beginPath(); x.moveTo(37, y - 9); x.lineTo(44, y); x.lineTo(58, y - 24); x.stroke(); }
      words(x, s, 70, y, 21);
    });
    words(x, 'and mind the trees', w - 34, h - 26, 17, 'italic', 'right');
  },
  /** The keys, engraved on a brass plate at the front of the desk. */
  pilot_card(x, w, h) {
    brass(x, w, h);
    const rows = [['W A S D', 'push ahead, back, aside'], ['SPACE  SHIFT', 'lift, sink'], ['MOUSE', 'turn'], ['Z  C', 'roll'], ['R', 'lock the world framed'], ['X', 'hold: match its speed'], ['V', 'the landing glass'], ['E', 'get up']];
    rows.forEach(([k, s], i) => { const y = 34 + i * 28; words(x, k, 22, y, 17, 'bold', 'left', '#2a2010'); words(x, s, 164, y, 16, 'italic', 'left', '#2a2010'); });
    for (const [px, py] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) { x.fillStyle = '#6b5a30'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
  },
  postcard_a(x, w, h) { view(x, w, h, ['#f3c27a', '#e8926a', '#6a5a8a'], '#3d5a3a', 0.62, lot(21)); },
  postcard_b(x, w, h) { view(x, w, h, ['#1d2a4a', '#3a4a7a', '#8a6a8f'], '#2a2f3a', 0.7, lot(22), true); },
  /** When the moon goes red: a table kept by hand. */
  almanac(x, w, h) {
    paper(x, w, h, '#e6dcc0', lot(9));
    words(x, 'THE MOON', w / 2, 44, 28, '', 'center'); words(x, 'her faces, and when she goes red', w / 2, 68, 15, 'italic', 'center');
    for (let i = 0; i < 8; i++) {
      const cx = 48 + (i % 4) * 96, cy = 126 + Math.floor(i / 4) * 92, ph = i / 8;
      x.fillStyle = '#2b2118'; x.beginPath(); x.arc(cx, cy, 30, 0, 7); x.fill();
      x.fillStyle = i === 5 ? '#a8452e' : '#e9dfc4';
      x.beginPath(); x.arc(cx, cy, 28, -Math.PI / 2, Math.PI / 2, ph > 0.5); x.ellipse(cx, cy, Math.abs(Math.cos(ph * Math.PI * 2)) * 28 + 0.01, 28, 0, Math.PI / 2, -Math.PI / 2, (ph % 0.5) < 0.25); x.fill();
    }
    x.strokeStyle = INKD; x.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const y = 296 + i * 22; x.beginPath(); x.moveTo(30, y + 5); x.lineTo(w - 30, y + 5); x.stroke(); words(x, ['goes round Home in', 'red, in Home\'s shadow', 'her pull, to ours', 'no air: wear the suit'][i], 34, y, 15, 'italic'); words(x, ['3 min', 'each 8 min', 'a third', ''][i], w - 34, y, 15, '', 'right'); }
  },
  stars(x, w, h) {
    const r = lot(31); x.fillStyle = '#1c2740'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(233, 223, 196, 0.5)'; x.lineWidth = 1;
    for (const R of [60, 120, 176]) { x.beginPath(); x.arc(w / 2, h / 2, R, 0, 7); x.stroke(); }
    for (let i = 0; i < 12; i++) { const a = i * 0.5236; x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 60); x.lineTo(w / 2 + Math.cos(a) * 176, h / 2 + Math.sin(a) * 176); x.stroke(); }
    const pts = [];
    for (let i = 0; i < 90; i++) { const a = r() * 7, d = Math.sqrt(r()) * 170, px = w / 2 + Math.cos(a) * d, py = h / 2 + Math.sin(a) * d, s = 0.8 + r() * r() * 3.4; pts.push([px, py, s]); x.fillStyle = '#f4ecd2'; x.beginPath(); x.arc(px, py, s, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(244, 236, 210, 0.75)'; x.lineWidth = 1.2;
    const big = pts.filter((p) => p[2] > 2.1);
    for (let i = 0; i + 1 < big.length; i += 2) if (Math.hypot(big[i][0] - big[i + 1][0], big[i][1] - big[i + 1][1]) < 130) { x.beginPath(); x.moveTo(big[i][0], big[i][1]); x.lineTo(big[i + 1][0], big[i + 1][1]); x.stroke(); }
    words(x, 'the sky over Home', w / 2, h - 12, 15, 'italic', 'center', '#f4ecd2');
  },
  /** The ship's mark: a hut under a ring, with three stars. */
  emblem(x, w, h) {
    x.fillStyle = '#d6c7a6'; x.fillRect(0, 0, w, h);
    const c = w / 2;
    x.fillStyle = '#a8402a'; x.beginPath(); x.arc(c, c, w * 0.47, 0, 7); x.fill();
    x.fillStyle = '#d6c7a6'; x.beginPath(); x.arc(c, c, w * 0.4, 0, 7); x.fill();
    x.strokeStyle = '#2f3a52'; x.lineWidth = 7; x.beginPath(); x.ellipse(c, c + 6, w * 0.31, w * 0.11, -0.35, 0, 7); x.stroke();
    x.fillStyle = '#2f3a52';
    x.beginPath(); x.moveTo(c - 44, c + 6); x.lineTo(c, c - 44); x.lineTo(c + 44, c + 6); x.closePath(); x.fill();
    x.fillRect(c - 32, c + 6, 64, 36);
    x.fillStyle = '#e8b85a'; x.fillRect(c - 9, c + 14, 18, 28);
    for (const [dx, dy] of [[-52, -52], [0, -74], [52, -52]]) star(x, c + dx, c + dy, 9, '#2f3a52');
  },
  gauge_a(x, w, h) { dialFace(x, w, 'AIR', ['0', '4', '8', '12'], '#e9dfc4', 0.64); },
  gauge_b(x, w, h) { dialFace(x, w, 'OIL', ['0', '', '½', '', '1'], '#e9dfc4', 0.8); },
  gauge_c(x, w, h) { dialFace(x, w, 'WATER', ['0', '', '½', '', '1'], '#e9dfc4', 0.42); },
  radio_scale(x, w, h) {
    x.fillStyle = '#f0d9a0'; x.fillRect(0, 0, w, h);
    x.strokeStyle = INKD; x.fillStyle = INKD; x.lineWidth = 1.5;
    for (let i = 0; i <= 40; i++) { const px = 16 + (i * (w - 32)) / 40; x.beginPath(); x.moveTo(px, 44); x.lineTo(px, i % 5 ? 56 : 68); x.stroke(); if (i % 10 === 0) words(x, `${5 + i / 2}`, px, 36, 16, '', 'center'); }
    x.fillStyle = '#a03a2a'; x.fillRect(16 + 0.37 * (w - 32) - 2, 20, 4, h - 30);
    words(x, 'HOME   ·   TOR   ·   MOON', w / 2, h - 8, 12, 'italic', 'center');
  },
  notes(x, w, h) {
    paper(x, w, h, '#efe7cf', lot(41));
    words(x, 'Things to find out', 16, 30, 18, 'italic');
    ['why the moon goes red', 'what is on the far world', 'who left the light on', 'more tea'].forEach((s, i) => { words(x, `- ${s}`, 18, 64 + i * 30, 16, 'italic'); });
    x.strokeStyle = '#a03a2a'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(30, 160); x.lineTo(92, 160); x.stroke();
  },
  doormat(x, w, h) {
    x.fillStyle = '#7a5f3c'; x.fillRect(0, 0, w, h);
    const r = lot(51);
    for (let i = 0; i < 2600; i++) { x.strokeStyle = `rgba(${r() < 0.5 ? '40, 28, 14' : '190, 160, 110'}, 0.35)`; const px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py + 5 + r() * 6); x.stroke(); }
    x.strokeStyle = '#3a2816'; x.lineWidth = 8; x.strokeRect(14, 14, w - 28, h - 28);
    words(x, 'WELCOME', w / 2, h / 2 + 2, 52, 'bold', 'center', '#2a1c0e');
    words(x, 'ABOARD', w / 2, h / 2 + 50, 34, 'bold', 'center', '#2a1c0e');
  },
  calendar(x, w, h) {
    paper(x, w, h, '#ece3c8', lot(61));
    x.fillStyle = '#a03a2a'; x.fillRect(0, 0, w, 54); words(x, 'DAYS OUT', w / 2, 37, 26, 'bold', 'center', '#f3ead0');
    x.strokeStyle = INKD; x.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const cx = 22 + (i % 6) * 36, cy = 74 + Math.floor(i / 6) * 46;
      x.strokeRect(cx, cy, 32, 40); words(x, `${i + 1}`, cx + 4, cy + 14, 12);
      if (i < 17) { x.strokeStyle = '#a03a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx + 6, cy + 34); x.lineTo(cx + 26, cy + 16); x.stroke(); x.strokeStyle = INKD; x.lineWidth = 1; }
    }
  },
  /** A drawing of the ship itself, pinned over the table. */
  sketch(x, w, h) {
    paper(x, w, h, '#e9e1c9', lot(71));
    x.strokeStyle = '#2f3a52'; x.lineWidth = 1.6; const c = w / 2, b = h * 0.68;
    x.strokeRect(c - 92, b - 84, 184, 84);
    x.beginPath(); x.moveTo(c - 108, b - 84); x.lineTo(c, b - 144); x.lineTo(c + 108, b - 84); x.closePath(); x.stroke();
    x.strokeRect(c - 84, b - 62, 104, 36); x.beginPath(); x.arc(c + 56, b - 44, 15, 0, 7); x.stroke();
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(c + s * 70, b - 30); x.lineTo(c + s * 132, b + 30); x.moveTo(c + s * 118, b + 30); x.lineTo(c + s * 146, b + 30); x.stroke(); }
    x.beginPath(); x.moveTo(c, b - 144); x.lineTo(c, b - 184); x.stroke();
    x.lineWidth = 1; x.setLineDash([3, 3]);
    for (const [x0, y0, x1, y1, s] of [[c - 92, b + 44, c + 92, b + 44, 'five paces'], [c + 150, b - 144, c + 150, b + 30, '']]) { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); if (s) words(x, s, (x0 + x1) / 2, y0 + 18, 14, 'italic', 'center', '#2f3a52'); }
    x.setLineDash([]);
    words(x, 'the hut, as built', 20, 30, 17, 'italic', 'left', '#2f3a52');
    words(x, 'window', c - 32, b - 68, 12, 'italic', 'center', '#2f3a52'); words(x, 'lamp', c + 14, b - 176, 12, 'italic', 'left', '#2f3a52');
  },
  ticks(x, w, h) { brass(x, w, h); },
  /** A poster: the moon over the hills, for whoever might go. */
  poster_a(x, w, h) {
    const r = lot(81), g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#141d38'); g.addColorStop(0.62, '#3a4576'); g.addColorStop(0.8, '#8a6f8f');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(244, 236, 210, ${0.4 + 0.6 * r()})`; const s = 1 + r() * 1.8; x.fillRect(r() * w, r() * h * 0.6, s, s); }
    const cx = w * 0.5, cy = h * 0.4, R = w * 0.29;
    x.fillStyle = '#ece3c6'; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
    for (let i = 0; i < 16; i++) { const a = r() * 7, d = Math.sqrt(r()) * R * 0.82, k = 5 + r() * r() * 22; x.fillStyle = 'rgba(120, 110, 100, 0.28)'; x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, k, 0, 7); x.fill(); x.strokeStyle = 'rgba(255, 250, 235, 0.5)'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, k, 0.6, 2.4); x.stroke(); }
    for (let k = 0; k < 3; k++) { x.fillStyle = ['#2a3358', '#1f2745', '#141a30'][k]; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 16; i++) x.lineTo((i / 16) * w, h * (0.7 + 0.06 * k) - 20 * Math.sin(i * 0.8 + k * 2.2) - 8 * r()); x.lineTo(w, h); x.fill(); }
    // the hut on its hill, its lamp lit
    x.fillStyle = '#0d1122'; x.fillRect(w * 0.2, h * 0.705, 34, 22); x.beginPath(); x.moveTo(w * 0.2 - 6, h * 0.705); x.lineTo(w * 0.2 + 17, h * 0.705 - 18); x.lineTo(w * 0.2 + 40, h * 0.705); x.fill();
    x.fillStyle = '#ffcf7a'; x.fillRect(w * 0.2 + 12, h * 0.705 + 6, 9, 9);
    write(x, 'THE MOON', w / 2, 62, 40, { align: 'center', weight: 0.14, track: 0.08, color: '#f4ecd2', press: 0.4, wobble: 0.08, seed: 3 });
    write(x, 'three minutes round', w / 2, h - 64, 21, { align: 'center', weight: 0.12, color: '#f4ecd2', wobble: 0.1, seed: 4 });
    write(x, 'no air: bring your own', w / 2, h - 32, 15, { align: 'center', weight: 0.11, slant: 0.16, color: '#e8c98a', wobble: 0.3, seed: 5 });
    x.strokeStyle = '#f4ecd2'; x.lineWidth = 12; x.strokeRect(0, 0, w, h);
  },
  /** A poster: the far world, where nobody has been. */
  poster_b(x, w, h) {
    const r = lot(83); x.fillStyle = '#e6d6ac'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#b5482e'; x.fillRect(22, 22, w - 44, h - 44);
    for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (i - 6.5) * 0.24; x.fillStyle = i % 2 ? '#c4583a' : '#b5482e'; x.beginPath(); x.moveTo(w / 2, h * 0.52); x.arc(w / 2, h * 0.52, h, a - 0.12, a + 0.12); x.fill(); }
    x.fillStyle = '#b5482e'; x.fillRect(22, h * 0.52, w - 44, h * 0.48 - 22);
    const cx = w / 2, cy = h * 0.42, R = w * 0.25;
    x.fillStyle = '#6f587c'; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 7); x.clip();
    for (let i = 0; i < 7; i++) { x.fillStyle = `rgba(${i % 2 ? '150, 120, 160' : '70, 52, 84'}, 0.6)`; x.fillRect(cx - R, cy - R + i * R * 0.3 + 6 * Math.sin(i), R * 2, R * 0.13); }
    x.fillStyle = 'rgba(20, 12, 30, 0.35)'; x.beginPath(); x.arc(cx + R * 0.5, cy + R * 0.2, R * 1.1, 0, 7); x.fill(); x.restore();
    x.strokeStyle = '#f0dfb0'; x.lineWidth = 5; x.beginPath(); x.ellipse(cx, cy, R * 1.6, R * 0.34, -0.3, 0.25, Math.PI - 0.1); x.stroke();
    write(x, 'THE FAR', w / 2, 84, 38, { align: 'center', weight: 0.15, track: 0.1, color: '#f0dfb0', press: 0.4, wobble: 0.08, seed: 7 });
    write(x, 'WORLD', w / 2, 132, 38, { align: 'center', weight: 0.15, track: 0.1, color: '#f0dfb0', press: 0.4, wobble: 0.08, seed: 8 });
    write(x, 'nobody has been', w / 2, h - 106, 23, { align: 'center', weight: 0.12, color: '#f0dfb0', wobble: 0.1, seed: 9 });
    write(x, 'WHO WILL GO?', w / 2, h - 58, 27, { align: 'center', weight: 0.15, track: 0.06, color: '#2a1c14', press: 0.4, seed: 10 });
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(60, 30, 20, ${0.05 + r() * 0.1})`; x.beginPath(); x.ellipse(r() * w, r() * h, 3 + r() * 30, 2 + r() * 10, r() * 3, 0, 7); x.fill(); }
  },
  /** The moon's near face, charted by hand, with where the ship came down. */
  map_moon(x, w, h) {
    const r = lot(85); paper(x, w, h, '#e4dac0', lot(86));
    x.strokeStyle = 'rgba(60, 90, 110, 0.3)'; x.lineWidth = 1;
    for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo((i * w) / 10, 0); x.lineTo((i * w) / 10, h); x.stroke(); }
    for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(0, (i * h) / 8); x.lineTo(w, (i * h) / 8); x.stroke(); }
    const cx = w * 0.56, cy = h * 0.54, R = h * 0.4;
    x.fillStyle = '#d4cdb8'; x.strokeStyle = INKD; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); x.stroke();
    const named = [[-0.3, -0.25, 34, 'the Thumbprint'], [0.32, 0.1, 46, 'Dry Sea'], [-0.1, 0.42, 22, 'Kettle'], [0.42, -0.42, 17, 'the Step']];
    for (let i = 0; i < 26; i++) { const a = r() * 7, d = Math.sqrt(r()) * R * 0.88, k = 3 + r() * r() * 14; x.lineWidth = 1; x.strokeStyle = 'rgba(43, 33, 24, 0.55)'; x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, k, 0, 7); x.stroke(); }
    for (const [dx, dy, k, name] of named) {
      const px = cx + dx * R, py = cy + dy * R;
      x.fillStyle = 'rgba(150, 140, 120, 0.5)'; x.strokeStyle = INKD; x.lineWidth = 1.6; x.beginPath(); x.arc(px, py, k, 0, 7); x.fill(); x.stroke();
      x.lineWidth = 1; for (let j = 0; j < 9; j++) { const a = j * 0.7; x.beginPath(); x.moveTo(px + Math.cos(a) * k, py + Math.sin(a) * k); x.lineTo(px + Math.cos(a) * (k + 5), py + Math.sin(a) * (k + 5)); x.stroke(); }
      words(x, name, px, py + k + 18, 15, 'italic', 'center');
    }
    x.strokeStyle = '#a03a2a'; x.lineWidth = 2.5; const lx = cx - R * 0.52, ly = cy + R * 0.14;
    x.beginPath(); x.moveTo(lx - 8, ly - 8); x.lineTo(lx + 8, ly + 8); x.moveTo(lx + 8, ly - 8); x.lineTo(lx - 8, ly + 8); x.stroke();
    words(x, 'came down here', lx, ly - 16, 14, 'italic', 'center', '#a03a2a');
    words(x, 'THE MOON', 22, 40, 26); words(x, 'her near face', 24, 62, 15, 'italic'); words(x, 'as seen coming in', 24, h - 20, 13, 'italic');
  },
  /** A drawing of one of the four jets, white on blue. */
  blueprint(x, w, h) {
    const r = lot(87); x.fillStyle = '#25456c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255, 255, 255' : '10, 20, 40'}, ${0.03 + r() * 0.05})`; x.beginPath(); x.ellipse(r() * w, r() * h, 4 + r() * 40, 3 + r() * 14, r() * 3, 0, 7); x.fill(); }
    const L = 'rgba(232, 240, 250, 0.92)'; x.strokeStyle = L; x.lineWidth = 2; x.strokeRect(12, 12, w - 24, h - 24); x.lineWidth = 1; x.strokeRect(17, 17, w - 34, h - 34);
    // the jet from the side: a tank, a throat, a bell; a pipe in; its ring to turn on
    const ox = 110, oy = h * 0.5;
    x.lineWidth = 2;
    x.beginPath(); x.roundRect(ox - 50, oy - 34, 90, 68, 18); x.stroke();
    x.beginPath(); x.moveTo(ox + 40, oy - 16); x.lineTo(ox + 78, oy - 12); x.lineTo(ox + 78, oy + 12); x.lineTo(ox + 40, oy + 16); x.stroke();
    x.beginPath(); x.moveTo(ox + 78, oy - 12); x.bezierCurveTo(ox + 110, oy - 20, ox + 150, oy - 52, ox + 196, oy - 64); x.lineTo(ox + 196, oy + 64); x.bezierCurveTo(ox + 150, oy + 52, ox + 110, oy + 20, ox + 78, oy + 12); x.stroke();
    for (const k of [0.3, 0.55, 0.8]) { const px = ox + 78 + 118 * k, hh = 12 + 52 * k * k * 0.9 + 4; x.beginPath(); x.moveTo(px, oy - hh); x.lineTo(px, oy + hh); x.stroke(); }
    x.lineWidth = 1; x.setLineDash([8, 4, 2, 4]); x.beginPath(); x.moveTo(ox - 70, oy); x.lineTo(ox + 220, oy); x.stroke(); x.setLineDash([]);
    x.lineWidth = 2; x.beginPath(); x.moveTo(ox - 20, oy - 34); x.lineTo(ox - 20, oy - 70); x.lineTo(ox + 40, oy - 70); x.stroke(); x.beginPath(); x.arc(ox - 20, oy - 52, 7, 0, 7); x.stroke();
    x.beginPath(); x.ellipse(ox + 62, oy, 9, 30, 0, 0, 7); x.stroke();
    // measures
    x.lineWidth = 1; const dim = (x0, y0, x1, y1, s, off) => { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); for (const [px, py] of [[x0, y0], [x1, y1]]) { x.beginPath(); x.moveTo(px - 4, py + 4); x.lineTo(px + 4, py - 4); x.stroke(); } write(x, s, (x0 + x1) / 2 + (off?.[0] ?? 0), (y0 + y1) / 2 + (off?.[1] ?? -6), 10, { align: 'center', weight: 0.11, color: L, slant: 0.14, wobble: 0.3, seed: seedOf(s) }); };
    dim(ox - 50, oy + 86, ox + 196, oy + 86, 'two hands and a span'); dim(ox + 214, oy - 64, ox + 214, oy + 64, 'a hand', [22, 4]);
    for (const [px, py, tx, ty, s] of [[ox - 10, oy - 10, 300, 52, 'water in'], [ox + 62, oy - 30, 330, 84, 'it turns on this ring'], [ox + 150, oy + 30, 356, h - 96, 'keep hands away']]) { x.beginPath(); x.moveTo(px, py); x.lineTo(tx - 6, ty - 4); x.stroke(); write(x, s, tx, ty, 11, { weight: 0.105, color: L, slant: 0.16, wobble: 0.35, seed: seedOf(s) }); }
    write(x, 'JET, ONE OF FOUR', 30, 46, 15, { weight: 0.13, track: 0.06, color: L });
    x.strokeRect(w - 190, h - 74, 166, 50); x.beginPath(); x.moveTo(w - 190, h - 50); x.lineTo(w - 24, h - 50); x.stroke();
    write(x, 'as fitted to the hut', w - 182, h - 56, 9.5, { weight: 0.11, color: L }); write(x, 'drawn after the fact', w - 182, h - 33, 9.5, { weight: 0.1, color: L, slant: 0.16, wobble: 0.3, seed: 2 });
  },
  photo_a(x, w, h) { view(x, w, h, ['#f6d28a', '#eaa070', '#7a6a96'], '#46603c', 0.6, lot(91)); },
  photo_b(x, w, h) { view(x, w, h, ['#18223f', '#2e3c6a', '#7a6a8f'], '#20242e', 0.66, lot(92), true); },
  /** The log, open at today: two pages in the pilot's hand. */
  note_a(x, w, h) {
    paper(x, w, h, '#efe6c8', lot(93));
    x.strokeStyle = 'rgba(60, 40, 20, 0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
    const left = ['day 17', 'up at first light', 'kettle OFF before lifting', 'moon in three minutes'], right = ['came down by the Thumbprint', 'no air. dust in everything', 'home hangs overhead', 'more tea'];
    [left, right].forEach((col, c) => col.forEach((s, i) => { let k = i ? 9 : 11; while (k > 4 && width(s, k, WRITTEN) > w / 2 - 20) k -= 0.5; write(x, s, c * (w / 2) + 11, 24 + i * 26, k, { ...WRITTEN, color: i || c ? INKD : '#a03a2a', seed: 930 + c * 10 + i }); }));
  },
  note_b(x, w, h) { note(x, w, h, ['water the plant', '(not from the tank)'], 94); },
  /** Over the ramp's lever: what to do before it goes down where there is no air. */
  note_c(x, w, h) {
    paper(x, w, h, '#efe6c8', lot(95));
    x.fillStyle = '#8f3524'; x.beginPath(); x.arc(w / 2, 10, 5, 0, 7); x.fill();
    ['NO AIR? then:', '1  suit on, collar turned home', '2  air on, glass reads 12', '3  then the ramp'].forEach((s, i) => { let k = i ? 10.5 : 13; while (k > 4 && width(s, k, WRITTEN) > w - 26) k -= 0.5; write(x, s, 14, 34 + i * 26, k, { ...WRITTEN, color: i ? INKD : '#a03a2a', seed: 950 + i }); });
  },
  note_d(x, w, h) { note(x, w, h, ['dust gets in', 'everything. sweep.'], 96); },
  /** The maker's plate on the back of the landing glass, which is what is seen of it while it lies folded on the desk. */
  c3_glass(x, w, h) {
    brass(x, w, h);
    cut(x, 'LANDING GLASS', w / 2, 34, 30, w - 60);
    x.fillStyle = 'rgba(42, 32, 16, 0.7)'; x.fillRect(46, 55, w - 92, 2);
    cut(x, 'RAISED BY HAND  ·  V', w / 2, 73, 11, w - 50);
    for (const [px, py] of [[13, 13], [w - 13, 13], [13, h - 13], [w - 13, h - 13]]) { x.fillStyle = '#6b5a30'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
  },
  /** Kept in the well under the landing glass, and seen only when it is up: how to come down. */
  c3_card(x, w, h) {
    paper(x, w, h, '#efe6c8', lot(131));
    ['COMING DOWN', '1  feet to the ground', '2  slow: under 5 at 20 m', '3  kill the drift, then sit', 'gently. she is only wood'].forEach((s, i) => { let k = i ? 10 : 12.5; while (k > 4 && width(s, k, WRITTEN) > w - 26) k -= 0.5; write(x, s, 14, 26 + i * 23, k, { ...WRITTEN, color: i ? INKD : '#a03a2a', seed: 1310 + i }); });
  },
  /** Painted on the hull through a stencil: her number, between two rules. */
  mark_a(x, w, h) {
    x.fillStyle = '#d6c7a6'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2f2a26'; x.fillRect(18, 14, w - 36, 6); x.fillRect(18, h - 20, w - 36, 6);
    write(x, 'No. 2', w / 2, 92, 58, { align: 'center', weight: 0.17, track: 0.08, stencil: true, dry: 0.35, color: '#2f2a26', seed: 11 });
  },
  /** By the filler: what goes in there burns. */
  mark_b(x, w, h) {
    x.fillStyle = '#d6c7a6'; x.fillRect(0, 0, w, h);
    const c = w / 2;
    x.strokeStyle = '#8f3524'; x.lineWidth = 8; x.lineJoin = 'round'; x.beginPath(); x.moveTo(c, 10); x.lineTo(w - 10, c); x.lineTo(c, h - 10); x.lineTo(10, c); x.closePath(); x.stroke();
    x.fillStyle = '#8f3524'; x.beginPath(); x.moveTo(c, 28); x.bezierCurveTo(c + 30, 58, c + 24, 92, c, 96); x.bezierCurveTo(c - 26, 92, c - 22, 66, c - 8, 56); x.bezierCurveTo(c - 6, 68, c + 2, 62, c, 28); x.fill();
    x.fillStyle = '#d6c7a6'; x.beginPath(); x.moveTo(c + 2, 66); x.bezierCurveTo(c + 12, 78, c + 8, 90, c, 90); x.bezierCurveTo(c - 9, 88, c - 6, 76, c + 2, 66); x.fill();
  },
  /** On the door of the small white locker by the hammock: what is in it is for mending people. */
  r3_cross(x, w, h) {
    const r = lot(73), c = w / 2;
    x.fillStyle = '#cfc8b2'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#356a68'; x.beginPath(); x.arc(c, c, c - 12, 0, 7); x.fill();
    x.strokeStyle = '#e6dec6'; x.lineWidth = 3; x.beginPath(); x.arc(c, c, c - 19, 0, 7); x.stroke();
    x.fillStyle = '#e6dec6'; x.fillRect(c - 10, c - 30, 20, 60); x.fillRect(c - 30, c - 10, 60, 20);
    // (the paint has been knocked off it here and there)
    for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(207, 200, 178, ${0.35 + 0.5 * r()})`; x.beginPath(); x.ellipse(c + (r() - 0.5) * (w - 30), c + (r() - 0.5) * (h - 30), 1 + r() * 3.4, 0.8 + r() * 1.8, r() * 3, 0, 7); x.fill(); }
  },
  /** A slate by the door: the trips she has made, in chalk, five to a gate. */
  o3_slate(x, w, h) {
    const r = lot(61), CHALK = 'rgba(232, 228, 214, 0.9)';
    x.fillStyle = '#2b3033'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '210, 214, 210' : '10, 12, 14'}, ${0.03 + 0.05 * r()})`; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 30, 3 + r() * 10, r() * 3, 0, 7); x.fill(); }
    write(x, 'moon', 14, 38, 17, { ...WRITTEN, color: CHALK, seed: 611 });
    write(x, 'home', 14, 92, 17, { ...WRITTEN, color: CHALK, seed: 612 });
    x.strokeStyle = CHALK; x.lineCap = 'round';
    const tally = (x0, y0, n) => {
      for (let i = 0; i < n; i++) {
        const g = Math.floor(i / 5), k = i % 5, px = x0 + g * 44 + k * 7;
        x.lineWidth = 2.2 + r() * 0.8; x.beginPath();
        if (k < 4) { x.moveTo(px + (r() - 0.5) * 2, y0 - 12 + (r() - 0.5) * 3); x.lineTo(px + (r() - 0.5) * 2, y0 + 12 + (r() - 0.5) * 3); }
        else { x.moveTo(x0 + g * 44 - 5, y0 + 9 + (r() - 0.5) * 3); x.lineTo(x0 + g * 44 + 27, y0 - 9 + (r() - 0.5) * 3); }
        x.stroke();
      }
    };
    tally(92, 30, 13); tally(92, 84, 12);
    x.strokeStyle = 'rgba(232, 228, 214, 0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(10, 58); x.lineTo(w - 10, 59); x.stroke();
  },
  /** Pasted on a crate: which way up, and what is in it. */
  o3_crate(x, w, h) {
    paper(x, w, h, '#e3d6b0', lot(71));
    x.strokeStyle = '#8f3524'; x.lineWidth = 5; x.strokeRect(7, 7, w - 14, h - 14);
    x.fillStyle = '#8f3524'; x.beginPath(); x.moveTo(44, 16); x.lineTo(66, 44); x.lineTo(52, 44); x.lineTo(52, 80); x.lineTo(36, 80); x.lineTo(36, 44); x.lineTo(22, 44); x.closePath(); x.fill();
    write(x, 'THIS WAY UP', 86, 46, 24, { weight: 0.15, track: 0.08, stencil: true, dry: 0.3, color: '#2f2a26', seed: 71 });
    write(x, 'spares: jets, small', 88, 76, 15, { ...WRITTEN, color: '#2f2a26', seed: 72 });
  },
};

function brass(x, w, h) {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c9ab63'); g.addColorStop(0.5, BRASSY); g.addColorStop(1, '#a48646');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = lot(w * 31 + h);
  for (let i = 0; i < (w * h) / 260; i++) { x.strokeStyle = `rgba(${r() < 0.5 ? '255, 240, 190' : '80, 60, 20'}, ${0.05 + r() * 0.07})`; const py = r() * h, px = r() * w; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 10 + r() * 40, py + (r() - 0.5) * 2); x.stroke(); }
  x.strokeStyle = 'rgba(60, 44, 14, 0.55)'; x.lineWidth = 2; x.strokeRect(3, 3, w - 6, h - 6);
}
/** A note pinned up: a few words in the pilot's hand. */
function note(x, w, h, lines, seed, col = INKD) {
  paper(x, w, h, '#efe6c8', lot(seed));
  x.fillStyle = '#8f3524'; x.beginPath(); x.arc(w / 2, 12, 6, 0, 7); x.fill(); x.fillStyle = 'rgba(255, 240, 220, 0.6)'; x.beginPath(); x.arc(w / 2 - 2, 10, 2, 0, 7); x.fill();
  lines.forEach((s, i) => { let k = 21; while (k > 8 && width(s, k, WRITTEN) > w - 30) k -= 0.5; write(x, s, 16, 54 + i * 40, k, { ...WRITTEN, color: i ? INKD : col, seed: seed * 7 + i }); });
}
function tag(x, w, h, s) { paper(x, w, h, '#e6d9b4', lot(s.length)); x.fillStyle = INKD; x.beginPath(); x.arc(14, h / 2, 5, 0, 7); x.fill(); words(x, s, 28, h / 2 + 6, 18, 'italic'); }
function star(x, cx, cy, R, col) { x.fillStyle = col; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * 0.6283, d = i % 2 ? R * 0.45 : R; x.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); } x.closePath(); x.fill(); }
/** A small painted view: a sky in bands, hills, a sun or a moon. */
function view(x, w, h, sky, hill, horizon, r, night = false) {
  const g = x.createLinearGradient(0, 0, 0, h * horizon); sky.forEach((c, i) => g.addColorStop(i / (sky.length - 1), night ? c : sky[sky.length - 1 - i]));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = night ? '#e9dfc4' : '#fff0c0'; x.beginPath(); x.arc(w * (night ? 0.7 : 0.36), h * (night ? 0.26 : horizon - 0.04), night ? 16 : 26, 0, 7); x.fill();
  if (night) for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(244, 236, 210, 0.9)'; x.fillRect(r() * w, r() * h * 0.6, 1.6, 1.6); }
  for (let k = 0; k < 3; k++) {
    x.fillStyle = k === 2 ? hill : `rgba(40, 50, 60, ${0.25 + 0.2 * k})`; x.beginPath(); x.moveTo(0, h);
    for (let i = 0; i <= 16; i++) x.lineTo((i / 16) * w, h * (horizon + 0.07 * k) - 16 * Math.sin(i * 0.9 + k * 2 + r()) - 8 * r());
    x.lineTo(w, h); x.fill();
  }
  x.strokeStyle = '#f3ead0'; x.lineWidth = 10; x.strokeRect(0, 0, w, h);
}
/** The face of a dial: a pale ground, marks round three quarters of it, numbers, its name. `at` (0..1): a needle drawn on, for dials that do not move. */
function dialFace(x, S, name, numbers, tone = '#ece4cb', at = null, red = null) {
  const c = S / 2, R = S * 0.46;
  x.fillStyle = '#17120c'; x.fillRect(0, 0, S, S);
  const g = x.createRadialGradient(c, c * 0.9, R * 0.2, c, c, R); g.addColorStop(0, '#f4ecd4'); g.addColorStop(1, tone);
  x.fillStyle = g; x.beginPath(); x.arc(c, c, R, 0, 7); x.fill();
  const A0 = Math.PI * 0.75, A1 = Math.PI * 2.25, n = numbers.length - 1;
  if (red) { x.strokeStyle = '#b3432a'; x.lineWidth = S * 0.045; x.beginPath(); x.arc(c, c, R * 0.88, A0 + (A1 - A0) * red[0], A0 + (A1 - A0) * red[1]); x.stroke(); }
  x.strokeStyle = INKD; x.fillStyle = INKD;
  for (let i = 0; i <= n * 5; i++) {
    const a = A0 + ((A1 - A0) * i) / (n * 5), major = i % 5 === 0;
    x.lineWidth = major ? S * 0.022 : S * 0.01;
    x.beginPath(); x.moveTo(c + Math.cos(a) * R * (major ? 0.74 : 0.82), c + Math.sin(a) * R * (major ? 0.74 : 0.82)); x.lineTo(c + Math.cos(a) * R * 0.93, c + Math.sin(a) * R * 0.93); x.stroke();
    if (major && numbers[i / 5]) write(x, numbers[i / 5], c + Math.cos(a) * R * 0.55, c + Math.sin(a) * R * 0.55 + S * 0.036, S * 0.072, { align: 'center', weight: 0.13, pen: 0.4, tab: false, color: INKD });
  }
  if (name) { let k = S * 0.058; while (k > 3 && width(name, k, { weight: 0.13, track: 0.2 }) > R * 0.74) k -= 0.25; write(x, name, c, c + R * 0.8, k, { align: 'center', weight: 0.13, track: 0.2, color: 'rgba(43, 33, 24, 0.85)' }); }
  if (at !== null) needle(x, S, A0 + (A1 - A0) * at);
}
function needle(x, S, a, col = '#a8321e') {
  const c = S / 2, R = S * 0.46;
  x.strokeStyle = 'rgba(0, 0, 0, 0.25)'; x.lineWidth = S * 0.03; x.beginPath(); x.moveTo(c + 2 - Math.cos(a) * R * 0.18, c + 3 - Math.sin(a) * R * 0.18); x.lineTo(c + 2 + Math.cos(a) * R * 0.8, c + 3 + Math.sin(a) * R * 0.8); x.stroke();
  x.strokeStyle = col; x.lineCap = 'round'; x.lineWidth = S * 0.028; x.beginPath(); x.moveTo(c - Math.cos(a) * R * 0.2, c - Math.sin(a) * R * 0.2); x.lineTo(c + Math.cos(a) * R * 0.82, c + Math.sin(a) * R * 0.82); x.stroke();
  x.fillStyle = '#2b2118'; x.beginPath(); x.arc(c, c, S * 0.055, 0, 7); x.fill();
  x.fillStyle = BRASSY; x.beginPath(); x.arc(c, c, S * 0.025, 0, 7); x.fill();
}

/** The sheet of everything printed: { texture }. */
export function createPrints() {
  const S = layout.size, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#888'; x.fillRect(0, 0, S, S);
  const within = (cell, draw) => { const [cx, cy, w, h] = cell; x.save(); x.translate(cx, cy); x.beginPath(); x.rect(0, 0, w, h); x.clip(); x.lineCap = 'butt'; x.setLineDash([]); draw(x, w, h); x.restore(); };
  // the names, each on its own small brass plate, cut into it
  for (const name of LABELS) within(cellOf(name), (x2, w, h) => {
    brass(x2, w, h);
    cut(x2, name, w / 2, h / 2, 23, w - 26);
  });
  for (const [name, cell] of Object.entries(layout.cells)) if (DRAW[name]) within(cell, DRAW[name]);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
  return { texture };
}

/**
 * The dials whose needles move. set(name, value 0..1) turns one's needle; clock(hours, minutes) sets the clock;
 * draw() puts what has changed on the sheet. names: speed, height, climb, clock, heat, air, pull, lean.
 */
export function createDials() {
  const D = layout.dials, S = D.size, C = D.cell, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#17120c'; x.fillRect(0, 0, S, S);
  const faces = {
    speed: ['SPEED', ['0', '3', '10', '30', '100', '300'], null],
    height: ['HEIGHT', ['0', '10', '100', '1k', '10k'], null],
    climb: ['CLIMB', ['-40', '-20', '0', '20', '40'], [0, 0.18]],
    clock: ['', [], null],
    heat: ['HEAT', ['0', '', '', '', '1'], [0.82, 1]],
    air: ['AIR', ['0', '4', '8', '12'], [0, 0.15]],
    pull: ['PULL', ['0', '', '½', '', '1'], null],
    lean: ['LEAN', ['-40', '', '0', '', '40'], null],
  };
  const still = {}, value = {}, shown = {};
  for (const name of D.names) {
    const f = document.createElement('canvas'); f.width = f.height = C; const fx = f.getContext('2d');
    if (name === 'clock') {
      dialFace(fx, C, '', [], '#ece4cb');
      const cc = C / 2, R = C * 0.46;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; fx.strokeStyle = INKD; fx.lineWidth = i % 3 ? 1.5 : 3; fx.beginPath(); fx.moveTo(cc + Math.cos(a) * R * 0.78, cc + Math.sin(a) * R * 0.78); fx.lineTo(cc + Math.cos(a) * R * 0.93, cc + Math.sin(a) * R * 0.93); fx.stroke(); }
      words(fx, 'day', cc, cc + R * 0.52, C * 0.1, 'italic', 'center');
    } else dialFace(fx, C, faces[name][0], faces[name][1], '#ece4cb', null, faces[name][2]);
    still[name] = f; value[name] = 0; shown[name] = -9;
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
  let hands = [0, 0];
  // (the faces are on the sheet from the first: no dial is ever seen blank)
  D.names.forEach((name, i) => x.drawImage(still[name], (i % 4) * C, Math.floor(i / 4) * C));
  return {
    texture,
    set(name, v) { value[name] = Math.min(1, Math.max(0, v)); },
    clock(dayPart) { hands = [dayPart, (dayPart * 12) % 1]; value.clock = dayPart; },
    draw() {
      let any = false;
      D.names.forEach((name, i) => {
        if (Math.abs(value[name] - shown[name]) < 0.0025) return;
        shown[name] = value[name]; any = true;
        const ox = (i % 4) * C, oy = Math.floor(i / 4) * C;
        x.drawImage(still[name], ox, oy);
        x.save(); x.translate(ox, oy);
        if (name === 'clock') { needle(x, C, hands[1] * Math.PI * 2 - Math.PI / 2, '#2b2118'); const cc = C / 2; x.strokeStyle = '#2b2118'; x.lineWidth = C * 0.04; x.beginPath(); x.moveTo(cc, cc); x.lineTo(cc + Math.cos(hands[0] * Math.PI * 2 - Math.PI / 2) * C * 0.24, cc + Math.sin(hands[0] * Math.PI * 2 - Math.PI / 2) * C * 0.24); x.stroke(); }
        else needle(x, C, Math.PI * 0.75 + Math.PI * 1.5 * value[name]);
        x.restore();
      });
      if (any) texture.needsUpdate = true;
    },
  };
}
