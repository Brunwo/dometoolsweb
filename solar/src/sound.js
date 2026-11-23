// Sound. Every sound here is built from layers at the moment it is wanted, and each layer has a part made in code:
// tones, noise shaped by filters, and the room they are heard in. Over those, where the files are there, go
// recordings (public/audio, cut by tools/sounds.mjs; a copy without them still sounds, thinner). The engine of it
// (the mixing, the rooms, the recordings, working it out with no sound card) is Small Magic's.
//
// What decides everything is the air. Sound is carried by air, and here the air is a thin shell round one world:
//   - on the home world's ground there is wind, grass, trees, birds by day and crickets at dusk, and one's own steps;
//   - going up, all of that thins away with the air, until there is nothing outside to hear at all;
//   - in the ship, what is outside comes through the wall dulled, and what the ship does comes through its frame:
//     the engine is felt as much as heard, and in space that is all there is of it;
//   - on the moon there is no air: one hears one's own breath, and one's steps through one's own body.
//
// Music is not of the world, so it does not go through its air: one piece for the title and the menu, and one
// that comes up only where there is no air to carry anything else (out in space, and on the moon). On the home
// world's ground there is none: the wind and the birds are the music there. The menu's own sounds are small
// plucked notes in the key the music is in (C minor: both pieces), so that a note never jars with it.
//
// Nothing here is timed by the page's clock. A sound is asked for at a time on the sound card's own clock; and the
// same code can be run with no sound card at all, as fast as it will go, to write down what would have been heard
// (`offline`, for checking it without playing it, and for films).
import { BOB } from './walker.js';

const WANTED = 48000, RECORDINGS = 'audio/';

export function createSound({ offline = 0 } = {}) {
  const AC = window.AudioContext ?? window.webkitAudioContext;
  let ctx;
  if (offline) ctx = new OfflineAudioContext(2, Math.ceil(offline * WANTED), WANTED);
  else { try { ctx = new AC({ latencyHint: 'interactive', sampleRate: WANTED }); } catch { ctx = new AC({ latencyHint: 'interactive' }); } }
  const RATE = ctx.sampleRate;
  const t = () => ctx.currentTime;
  const R = Math.random;
  const G = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const O = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const P = (pan = 0) => { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); return p; };
  /** Joins them in a row; gives back the last. */
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
  /** A value over time: [[seconds after `at`, value], ...], in straight lines, or falling away as sounds do (`curve`). */
  const env = (param, at, points, curve = false) => {
    param.cancelScheduledValues(at);
    param.setValueAtTime(points[0][1], at + points[0][0]);
    for (let i = 1; i < points.length; i++) {
      if (curve && points[i][1] > 0 && points[i - 1][1] > 0) param.exponentialRampToValueAtTime(points[i][1], at + points[i][0]);
      else param.linearRampToValueAtTime(points[i][1], at + points[i][0]);
    }
  };
  const to = (param, value, k = 0.08) => param.setTargetAtTime(value, t(), k);
  /** A level that rises and falls with no edge to it: nothing at `at`, `peak` part-way, nothing again `lasts` later. */
  const swell = (param, at, lasts, peak, lean = 1) => param.setValueCurveAtTime(Float32Array.from({ length: 48 }, (_, i) => peak * Math.sin(Math.PI * (i / 47) ** lean) ** 2), at, lasts);
  const shaper = (hard) => { const w = ctx.createWaveShaper(); w.curve = Float32Array.from({ length: 1025 }, (_, i) => Math.tanh(((i - 512) / 512) * hard)); return w; };

  // ---- what everything passes through: mixed, pressed so that nothing clips, and let out
  // (`world`: all of the world's sound together, let down to nothing while the menu is up over it)
  const mix = G(1), pre = G(0.5), press = ctx.createDynamicsCompressor(), soft = ctx.createWaveShaper(), world = G(1), out = G(0.9);
  Object.assign(press.threshold, { value: -6 }); Object.assign(press.knee, { value: 6 }); Object.assign(press.ratio, { value: 8 }); Object.assign(press.attack, { value: 0.003 }); Object.assign(press.release, { value: 0.3 });
  soft.curve = Float32Array.from({ length: 2049 }, (_, i) => Math.tanh(((i - 1024) / 1024) * 1.5) / Math.tanh(1.5));
  soft.oversample = '2x';
  chain(mix, pre, press, soft, world, out, ctx.destination);
  // What is outside, carried by the air: it goes through the ship's wall (open, when one is not in the ship), and
  // there is as much of it as there is air (`thin`).
  const outside = G(1), wall = F('lowpass', 20000, 0.5), thin = G(1);
  chain(outside, wall, thin, mix);
  // the air round about: a burst of noise dying away, duller as it dies, with a few early returns
  const room = ctx.createConvolver(), roomIn = G(1);
  {
    const n = Math.floor(RATE * 3.2), b = ctx.createBuffer(2, n, RATE);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const s = i / RATE; lp += (0.03 + 0.55 * Math.exp(-s * 1.6)) * (R() * 2 - 1 - lp); d[i] = lp * Math.exp(-s * 2.1) * Math.min(1, s / 0.01); }
      for (let k = 0; k < 7; k++) { const at = Math.floor(RATE * (0.018 + 0.14 * R())); d[at] += (R() < 0.5 ? -1 : 1) * (0.9 - 0.08 * k); }
    }
    room.buffer = b;
  }
  chain(roomIn, room, G(0.8), outside);
  // ---- music, and the menu's notes: straight to what is let out, with a little air of their own round the notes
  const musicBus = G(0.7), ui = G(1.5), uiRoom = ctx.createConvolver(), tunes = {};
  const meter = ctx.createAnalyser(); meter.fftSize = 8192; out.connect(meter);
  musicBus.connect(out); ui.connect(out); uiRoom.buffer = room.buffer; chain(ui, uiRoom, G(0.3), out);
  // (each piece is played as it comes off the disc, not held whole: seven minutes of it would be a great weight)
  const MUSIC = { title: ['music/dreams_become_real.ogg', 1.6], space: ['music/floating_cities.ogg', 0.7] };
  if (!offline) for (const [name, [src, level]] of Object.entries(MUSIC)) {
    try {
      // (fetched whole and played from what was fetched: then it can go round again whatever is serving the game)
      const el = new Audio(); el.loop = true;
      fetch(src).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) el.src = URL.createObjectURL(b); }).catch(() => {});
      const g = G(0); chain(ctx.createMediaElementSource(el), G(level), g, musicBus);
      tunes[name] = { el, gain: g.gain, want: 0, idle: 0 };
    } catch { /* no music, then */ }
  }
  const NOTE = { C4: 261.63, G4: 392.0, Bb4: 466.16, C5: 523.25, Eb5: 622.25, F5: 698.46, G5: 783.99, Bb5: 932.33, C6: 1046.5, Eb6: 1244.51, F6: 1396.91, G6: 1567.98 };
  /** A small soft note, plucked: a clear tone with a little of its octave over it, dying away. */
  function pluck(f, at, level = 0.08, lasts = 0.5) {
    const e = G(0), low = F('lowpass', Math.min(9000, f * 5), 0.5);
    for (const [k, v, type] of [[1, 1, 'sine'], [2.003, 0.2, 'sine'], [3.01, 0.05, 'sine'], [0.5, 0.1, 'triangle']]) { const o = O(type, f * k); chain(o, G(v), low); o.start(at); o.stop(at + lasts + 0.1); }
    env(e.gain, at, [[0, 0.0001], [0.006, level], [lasts, 0.0001]], true);
    chain(low, e, ui);
  }
  // the hills: it comes back, late and dull, and comes back again fainter
  const hillsIn = G(1), far = ctx.createDelay(2), farLow = F('lowpass', 1250, 0.5);
  far.delayTime.value = 0.71;
  chain(hillsIn, far, farLow, G(0.85), outside); chain(farLow, G(0.34), far);
  // the room of the ship: small and hard, a short ring
  const cabin = ctx.createConvolver(), cabinIn = G(1);
  {
    const n = Math.floor(RATE * 0.5), b = ctx.createBuffer(2, n, RATE);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const s = i / RATE; d[i] = (R() * 2 - 1) * Math.exp(-s * 13) * Math.min(1, s / 0.002); } for (let k = 0; k < 9; k++) d[Math.floor(RATE * (0.004 + 0.03 * R()))] += (R() < 0.5 ? -1 : 1) * 0.7; }
    cabin.buffer = b;
  }
  chain(cabinIn, cabin, G(0.5), mix);

  // ---- what sounds are made of
  const noises = {};
  for (const kind of ['white', 'pink', 'brown']) {
    const n = Math.floor(RATE * 3), b = ctx.createBuffer(2, n, RATE);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = R() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.24; }
        else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      }
    }
    noises[kind] = b;
  }
  const noise = (kind, at, until) => { const s = ctx.createBufferSource(); s.buffer = noises[kind]; s.loop = true; s.start(at, R() * 2.5); if (until) s.stop(until); return s; };
  // a click with a little body: a latch, a tick of cooling iron
  const grain = ctx.createBuffer(1, Math.floor(RATE * 0.04), RATE);
  { const d = grain.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (R() * 2 - 1) * Math.exp(-i / (RATE * 0.006)); }
  const tick = (at, f, level, dest) => { const s = ctx.createBufferSource(), e = G(level); s.buffer = grain; chain(s, F('bandpass', f, 5), e, dest); s.start(at); };
  /** A slow uneven swell on a level: so that what burns and what rumbles is never still. */
  const waver = (node, at, rates, depth) => { for (const r of rates) { const l = O('sine', r * (0.9 + 0.2 * R())); chain(l, G(depth / rates.length), node.gain); l.start(at); } };
  /** Something to pass a burning sound through: its level trembles, fast and slow, as fire's does. */
  const flutter = () => { const m = G(1); for (const [f, d] of [[3.1, 0.07], [11.3, 0.11], [23.7, 0.09]]) { const l = O('sine', f * (0.9 + 0.2 * R())); chain(l, G(d), m.gain); l.start(t()); } return m; };
  /** Where a sound goes: where it is told, and how much of it to the air round about and to the hills. */
  const send = (node, { air = 0, hills = 0, to: dest = outside } = {}) => { node.connect(dest); if (air) chain(node, G(air), roomIn); if (hills) chain(node, G(hills), hillsIn); return node; };
  /** Something heavy met: a low knock with no edge. */
  function thud(at, level, lasts, dest) {
    const low = F('lowpass', 260, 0.8), e = G(0);
    env(low.frequency, at, [[0, 260], [lasts * 0.6, 55]], true); env(e.gain, at, [[0, 0.0001], [0.006, level], [lasts, 0.0001]], true);
    chain(noise('brown', at, at + lasts + 0.05), low, e, shaper(3), dest);
  }

  // ---- recordings
  const buffers = {};
  let loaded = false;
  const ready = (async () => {
    let names = [];
    // (?bare: as a copy of the repo sounds, with no recordings)
    if (!new URLSearchParams(location.search).has('bare')) try { const r = await fetch(`${RECORDINGS}manifest.json`); if (r.ok) names = await r.json(); } catch { /* none: all of it is made here */ }
    await Promise.all(names.map(async (name) => {
      try { const r = await fetch(`${RECORDINGS}${name}.ogg`); if (r.ok) buffers[name] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch { /* that one is done without */ }
    }));
    await Promise.all([1, 2, 3, 4, 5].map(async (i) => { try { const r = await fetch(`sfx/step${i}.ogg`); if (r.ok) buffers[`free${i}`] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch { /* none */ } }));
    // (said once, where an agent or a person looking will see it; not an error)
    if (!names.length) console.info('Sound: playing with no recordings, only what is made in code. MISSING_ASSETS.md says what the full game adds.');
    loaded = true;
    begin();
  })();
  /** Plays a recording, if it is there. */
  function play(name, { at = t(), gain = 1, rate = 1, pan = 0, low = 0, high = 0, air = 0, hills = 0, to: dest = outside, loop = false, fadeIn = 0, shape = null, from = 0 } = {}) {
    const b = buffers[name];
    if (!b) return null;
    const s = ctx.createBufferSource(), g = G(gain);
    s.buffer = b; s.playbackRate.value = rate; s.loop = loop;
    if (fadeIn) env(g.gain, at, [[0, 0], [fadeIn, gain]]);
    // (`shape`: how its level goes, as parts of `gain` over seconds, falling away as sounds do)
    if (shape) env(g.gain, at, shape.map(([s, v]) => [s, Math.max(v * gain, 0.0001)]), true);
    // (`low`: nothing above this is let through; `high`: nothing below)
    const cut = low ? chain(s, F('lowpass', low, 0.5)) : s;
    send(chain(high ? chain(cut, F('highpass', high, 0.5)) : cut, g, P(pan)), { air, hills, to: dest });
    s.start(at, loop ? R() * b.duration : from);
    s.level = g;
    return s;
  }
  /** A recording going round and round on a level of its own, which starts at nothing. */
  const loop = (name, dest, o = {}) => { const g = G(0); g.connect(dest); play(name, { ...o, loop: true, to: g }); return g.gain; };
  /** Noise through whatever is given, on a level of its own, which starts at nothing. */
  const hiss = (kind, dest, ...through) => { const g = G(0); chain(noise(kind, t()), ...through, g, dest); return g.gain; };

  // ---- what is always going, each on its own level (set in update)
  let L = null;
  let burnWas = false;
  function begin() {
    const at = t();
    L = {};
    // the place: wind over open ground, wind in grass and in tree tops, a tree creaking, birds, crickets; and, high
    // up where the air is nearly gone, what is left of the wind is thin and whistles
    { const low = F('lowpass', 420, 0.6), g = G(0); chain(noise('pink', at), low, g, outside); const l = O('sine', 0.07); chain(l, G(170), low.frequency); l.start(at); L.windMade = g.gain; L.windBody = g; }
    L.wind = loop('wind', outside);
    L.thinWind = loop('whistle', outside, { rate: 1.15 });
    L.grass = loop('grassy', outside);
    L.trees = loop('treetops', outside, { high: 300 });
    L.creaks = loop('creaks', outside, { rate: 0.7 });
    L.birds = loop('birds', outside, { high: 1100 });
    L.crickets = loop('crickets', outside, { high: 900 });
    // the air going past: whatever moves fast through air hears it
    { const band = F('bandpass', 500, 0.5); L.rush = hiss('pink', outside, band); L.rushBand = band.frequency; L.gusts = loop('gusts', outside, { rate: 1.25 }); }

    // the ship's engine. Through its frame: a weight of low noise that opens as it is pushed, two low notes under
    // it, and the rumble of the fire. Through the air, where there is any: the roar of the fire itself.
    { const low = F('lowpass', 150, 0.9); L.hull = hiss('brown', mix, low, shaper(2.5), flutter()); L.hullLow = low.frequency; }
    { const g = G(0), low = F('lowpass', 190, 1.4); for (const f of [41.2, 61.9]) { const o = O('sawtooth', f); o.connect(low); o.start(at); L[`note${f}`] = o; } chain(low, g, mix); chain(g, G(0.5), cabinIn); L.notes = g.gain; L.note = [L['note41.2'], L['note61.9']]; }
    { const low = F('lowpass', 300, 0.6), g = G(0); g.connect(mix); play('firetex', { loop: true, rate: 0.8, to: low }); chain(low, flutter(), g); L.rumble = g.gain; }
    { const band = F('bandpass', 760, 0.5); L.roar = hiss('pink', outside, band, flutter()); L.roarBand = band.frequency; L.fire = loop('firewind', outside, { rate: 0.72 }); }
    // the sun, when it has hold of the ship: the wall roaring as it takes fire, and a note under it that climbs
    { const band = F('bandpass', 240, 0.7); L.burn = hiss('brown', mix, band, shaper(3), flutter()); L.burnBand = band.frequency; }
    { const g = G(0), low = F('lowpass', 420, 2), o = O('sawtooth', 58); o.connect(low); o.start(at); chain(low, g, mix); L.burnNote = g.gain; L.burnPitch = o.frequency; }
    // the small jets that turn it: a hiss in the wall
    L.jets = hiss('white', mix, F('highpass', 2600, 0.6), F('lowpass', 7000, 0.5));
    // the room of the ship when one is in it: a hum, and its air moving
    { const g = G(0); g.connect(mix); for (const [f, v] of [[55, 0.016], [82.6, 0.01], [110.3, 0.004]]) { const o = O('sine', f); chain(o, G(v), g); o.start(at); } chain(noise('pink', at), F('bandpass', 2300, 0.4), G(0.007), g); waver(g, at, [0.13, 0.31], 0.12); L.cabin = g.gain; }
    // a suit, where there is no air to breathe: its own faint hum (the breathing is made breath by breath, below)
    { const g = G(0); g.connect(mix); const o = O('sine', 118); chain(o, G(0.008), g); o.start(at); chain(noise('pink', at), F('bandpass', 3400, 0.5), G(0.004), g); L.suit = g.gain; }
  }

  // ---- their own footsteps
  const STEPS = { grass: 'grassstep', stone: 'stonestep', dirt: 'dirtstep', dust: 'dirtstep', water: 'dirtstep' };
  // (with no recordings: the five steps on grass that come with the game, shaped to stand for the rest)
  const SHAPED = { grass: {}, dirt: { low: 2600, rate: 0.9 }, stone: { rate: 1.25 }, dust: { low: 420, rate: 0.8 }, water: { low: 900, rate: 0.7 } };
  const lastTake = {}, stepsAt = [];
  let foot = 1, dipWas = null, groundedWas = true;
  /** One step. `hard`: 0 strolling to 1 at a run. Never the same recording twice running; each foot a little to its own side. */
  function step(surface, hard, airy, at = t()) {
    foot = -foot;
    // (for the measuring tools: when each was heard, and on what)
    if (stepsAt.length < 400) stepsAt.push([Math.round(at * 1000) / 1000, surface]);
    let take;
    do take = 1 + Math.floor(R() * 8); while (take === lastTake[surface]);
    lastTake[surface] = take;
    const o = { at, gain: (0.17 + 0.13 * hard) * (0.85 + 0.3 * R()), rate: 0.94 + 0.12 * R(), pan: 0.14 * foot, air: 0.08 * airy, to: mix };
    if (surface === 'water') {
      // wading: the foot's own sound is dull, under water; what is heard is the water it pushes aside and lets fall
      Object.assign(o, { low: 900, gain: o.gain * 0.5, rate: o.rate * 0.7 });
      const e = G(0), band = F('bandpass', 700 + 500 * R(), 0.7);
      env(e.gain, at, [[0, 0.0001], [0.05, 0.05 + 0.04 * hard], [0.16, 0.022], [0.5, 0.0001]], true);
      env(band.frequency, at, [[0, 1500], [0.4, 520]], true);
      send(chain(noise('white', at, at + 0.6), band, e, P(0.2 * foot)), { air: 0.12 * airy, to: outside });
    }
    if (surface === 'dust' || airy < 0.15) {
      // no air: a step is heard through one's own body, as a knock with nothing sharp in it
      Object.assign(o, { low: 420, gain: o.gain * 0.9, rate: o.rate * 0.85, air: 0 });
      thud(at, 0.035 + 0.03 * hard, 0.16, mix);
    }
    if (!play(STEPS[surface] + take, o)) play(`free${1 + Math.floor(R() * 5)}`, { ...o, ...SHAPED[surface], rate: o.rate * (SHAPED[surface].rate ?? 1) });
  }
  function stepFeed(walker, surface, airy) {
    // (the eye is lowest three quarters of the way through each rise and fall: that is when a foot is down)
    const dip = Math.floor((walker.stride * BOB) / (2 * Math.PI) - 0.75), at = t();
    if (dipWas !== null && dip !== dipWas && walker.grounded && walker.speed > 0.8) step(surface(), Math.min(1, walker.speed / 6.6), airy);
    dipWas = dip;
    if (walker.grounded && !groundedWas) {
      // down from a jump: both feet, a moment apart, and the weight of it
      const s = surface();
      step(s, 1, airy, at); step(s, 1, airy, at + 0.035);
      if (s === 'stone' && airy > 0.3) play(`landstep${1 + Math.floor(R() * 3)}`, { at, gain: 0.3, air: 0.1, to: mix });
      thud(at, (0.12 + 0.2 * walker.landed) * (0.45 + 0.55 * airy), 0.25, mix);
    } else if (!walker.grounded && groundedWas && airy > 0.15) {
      // up: cloth, and the air
      const e = G(0);
      swell(e.gain, at, 0.28, 0.07 * airy, 0.5);
      chain(noise('pink', at, at + 0.3), F('bandpass', 700, 0.8), e, mix);
    }
    groundedWas = walker.grounded;
  }

  // ---- breathing, where there is no air but one's own: in, and out, a little quicker for having run
  let breathIn = 1.2, breathFast = 0;
  function breathe(dt, level, working) {
    breathFast += ((working ? 1 : 0) - breathFast) * Math.min(1, dt * 0.4);
    if ((breathIn -= dt) > 0 || level < 0.05) return;
    const at = t() + 0.02, k = 1 - 0.3 * breathFast, inFor = 1.25 * k, outFor = 1.7 * k;
    for (const [when, lasts, f, peak, lean] of [[0, inFor, 1150, 0.075, 0.8], [inFor + 0.12, outFor, 720, 0.1, 0.55]]) {
      const e = G(0), band = F('bandpass', f, 1.0);
      swell(e.gain, at + when, lasts, peak * level * (1 + 0.5 * breathFast), lean);
      env(band.frequency, at + when, [[0, f], [lasts, f * (when ? 0.75 : 1.2)]], true);
      chain(noise('white', at + when, at + when + lasts + 0.05), band, F('lowpass', 2600, 0.5), e, mix);
    }
    breathIn = (inFor + outFor + 0.12) + 0.9 * k + 0.3 * R();
  }

  // ---- things that happen once
  /** Getting into the ship: the hatch pulled to, its latch, and the room's air let in. Getting out: the other way about. */
  function hatch(into, airy) {
    const at = t() + 0.02;
    if (into) {
      thud(at, 0.2, 0.22, mix); tick(at + 0.07, 1700, 0.28, mix); tick(at + 0.13, 2300, 0.2, mix); tick(at + 0.14, 900, 0.25, cabinIn);
      const e = G(0); env(e.gain, at + 0.2, [[0, 0.0001], [0.04, 0.05], [0.7, 0.0001]], true);
      chain(noise('white', at + 0.2, at + 1), F('highpass', 3200, 0.6), e, mix);
    } else {
      // (where there is no air outside, the room's air goes out first, and takes a while about it)
      const lasts = airy > 0.3 ? 0.4 : 1.1, e = G(0), band = F('bandpass', 4200, 0.7);
      env(e.gain, at, [[0, 0.0001], [0.05, airy > 0.3 ? 0.05 : 0.09], [lasts, 0.0001]], true); env(band.frequency, at, [[0, 4200], [lasts, 1500]], true);
      chain(noise('white', at, at + lasts + 0.1), band, e, mix);
      tick(at + lasts * 0.5, 2100, 0.22, mix); thud(at + lasts * 0.6, 0.18, 0.25, mix);
    }
  }
  /** The ship set down, or come down hard. `speed`: how fast it met the ground, m/s. */
  function touchdown(speed, airy) {
    const at = t() + 0.01, hard = Math.min(1, speed / 14);
    thud(at, 0.25 + 0.9 * hard, 0.3 + 0.45 * hard, mix);
    for (let i = 0; i < 3; i++) tick(at + 0.012 * i + 0.01 * R(), 500 + 900 * R(), 0.25 + 0.5 * hard, cabinIn);
    if (hard > 0.3) play('slam', { at, gain: 0.55 * hard * hard, low: 1100, to: mix });
    if (hard > 0.75) play('dark', { at, gain: 0.5 * hard, low: 1400, to: mix });
    // its legs taking the weight
    const s = play('stress', { at: at + 0.05, gain: 0.22 + 0.35 * hard, rate: 1.25, low: 2400, from: 2 + 8 * R(), shape: [[0, 0.15], [0.12, 1], [0.9 + 0.5 * hard, 0.001]], to: mix });
    s?.stop(at + 1.6);
    if (!s) { const o = O('triangle', 180), e = G(0); env(o.frequency, at, [[0, 190], [0.5, 120]], true); env(e.gain, at, [[0, 0.0001], [0.05, 0.03 + 0.05 * hard], [0.6, 0.0001]], true); chain(o, e, mix); o.start(at); o.stop(at + 0.65); }
    // and, where there is air and grass, what the feet and the last of the fire did to them
    if (airy > 0.3) play('leaves', { at: at + 0.03, gain: 0.3 + 0.3 * hard, rate: 0.85, air: 0.2 });
  }
  /** The engine lit from cold: the fire taking. */
  function ignite(airy) {
    const at = t();
    thud(at, 0.35, 0.4, mix);
    play('swoosh', { at, gain: 0.3 + 0.35 * airy, low: 700 + 2600 * airy, to: mix });
    if (airy > 0.3) play('fireball', { at, gain: 0.25 * airy, rate: 1.2, shape: [[0, 0.3], [0.1, 1], [1.6, 0.001]], air: 0.3 })?.stop(at + 1.8);
  }
  /** The engine cut: the last of it, and then iron cooling, ticking, for a while after. */
  let cooling = 0, coolIn = 0;
  function cool(dt, inside) {
    if (cooling <= 0) return;
    cooling -= dt;
    if ((coolIn -= dt) > 0) return;
    coolIn = (0.25 + 1.6 * R()) * (1.6 - Math.min(1, cooling / 14));
    if (inside) tick(t() + 0.01, 2600 + 2400 * R(), 0.05 + 0.06 * R(), R() < 0.5 ? mix : cabinIn);
  }

  // ---- what is watched, each frame
  let volume = 1, quiet = false, T = 0, rendering = null, lookIn = 0;
  let suitWas = false, glassWas = false;
  let pushed = 0, cold = 2, insideWas = false, landedWas = true, near = 0, flown = 0, kept = { airy: 1, inside: 0, day: 1 };
  return {
    ctx, ready, stepsAt,
    /** The sound card wakes at the first key or click: until then a page may make no sound. */
    wake() { if (!offline && ctx.state === 'suspended') ctx.resume(); },
    sleep() { if (!offline && ctx.state === 'running') { for (const m of Object.values(tunes)) m.el.pause(); ctx.suspend(); } },
    /** For checks: what the sound card is doing, each piece of music, and how loud what is let out is just now (dB). */
    debug() {
      const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v;
      return { ctx: ctx.state, world: +world.gain.value.toFixed(2), out: +(10 * Math.log10(s / d.length + 1e-12)).toFixed(1), tunes: Object.fromEntries(Object.entries(tunes).map(([k, m]) => [k, { playing: !m.el.paused, at: +m.el.currentTime.toFixed(1), level: +m.gain.value.toFixed(2), error: m.el.error?.message ?? null }])) };
    },
    /** How loud the music is, of how loud everything is (0 to 1). */
    set musicVolume(v) { musicBus.gain.setTargetAtTime(v, t(), 0.05); },
    /**
     * What is up, said every frame (also while the world stands still): 'loading', 'title', 'paused' or 'play'; and,
     * in play, how much of the piece for airless places is wanted (0 to 1). With the menu up the world is let down
     * to nothing and the title's piece comes up; begun, it goes, and the world comes back.
     */
    scene(state, space = 0) {
      if (offline) return;
      const menuUp = state !== 'play';
      to(world.gain, menuUp ? 0 : 1, menuUp ? 0.12 : 0.4);
      const want = { title: state === 'paused' ? 0.6 : menuUp ? 1 : 0, space: menuUp ? 0 : space };
      for (const [name, m] of Object.entries(tunes)) {
        const w = want[name];
        if (w > 0.001 && m.el.paused && m.el.src && ctx.state === 'running') m.el.play().catch(() => {});
        // (it comes in slowly; the title's piece goes quickly when the game is begun, the other lingers)
        if (Math.abs(w - m.want) > 0.01 || (w === 0 && m.want !== 0)) { m.gain.setTargetAtTime(w, t(), w > m.want ? 2.2 : name === 'title' ? 1.2 : menuUp ? 0.7 : 3); m.want = w; }
        // (silent for a good while, it is stopped where it is; wanted again, it goes on from there)
        if (w <= 0.001) { if (++m.idle > 900 && !m.el.paused) m.el.pause(); } else m.idle = 0;
      }
    },
    /**
     * A sound of the menu. 'move' (n: which line, from the top: lower down, a lower note), 'choose', 'back', 'open',
     * 'resume', 'begin', 'set' (n: 0 to 1, how far along its thread a setting now is), 'on' and 'off'.
     */
    ui(kind, n = 0) {
      if (offline || ctx.state !== 'running') return;
      const at = t() + 0.005, N = NOTE;
      if (kind === 'move') pluck([N.C6, N.Bb5, N.G5, N.F5, N.Eb5, N.C5, N.Bb4, N.G4][Math.min(7, Math.max(0, n))], at, 0.06, 0.32);
      else if (kind === 'choose') { pluck(N.G5, at, 0.075, 0.45); pluck(N.C6, at + 0.075, 0.075, 0.8); }
      else if (kind === 'back') { pluck(N.G5, at, 0.06, 0.35); pluck(N.Eb5, at + 0.075, 0.06, 0.6); }
      else if (kind === 'open') { pluck(N.C4, at, 0.1, 1.0); pluck(N.G4, at + 0.06, 0.07, 1.0); pluck(N.Eb5, at + 0.12, 0.045, 1.1); }
      else if (kind === 'resume') { pluck(N.Eb5, at, 0.06, 0.5); pluck(N.G5, at + 0.06, 0.06, 0.6); }
      else if (kind === 'begin') [N.C5, N.G5, N.C6, N.Eb6, N.G6].forEach((f, i) => pluck(f, at + i * 0.11, 0.075 - 0.008 * i, 1.8));
      else if (kind === 'set') pluck([N.C5, N.Eb5, N.F5, N.G5, N.Bb5, N.C6, N.Eb6, N.F6, N.G6][Math.round(Math.min(1, Math.max(0, n)) * 8)], at, 0.06, 0.3);
      else if (kind === 'on') { pluck(N.F5, at, 0.06, 0.3); pluck(N.Bb5, at + 0.06, 0.06, 0.45); }
      else if (kind === 'off') { pluck(N.Bb5, at, 0.06, 0.3); pluck(N.F5, at + 0.06, 0.06, 0.45); }
    },
    get volume() { return volume; }, set volume(v) { volume = v; out.gain.setTargetAtTime(quiet ? 0 : 0.9 * v, t(), 0.03); },
    get quiet() { return quiet; }, set quiet(v) { quiet = v; out.gain.setTargetAtTime(v ? 0 : 0.9 * volume, t(), 0.03); },
    /**
     * What is going on, each frame:
     *   airy     how much air there is round the listener, 0 (none: space, the moon) to 1 (the home world's ground)
     *   inside   in the ship;  shut  its ramp is up (or coming up): heard when that changes
     *   high     metres over the ground
     *   day      0 night to 1 day, where the listener is
     *   walker   { speed, stride, grounded, landed } when on foot;  surface()  what is underfoot: grass, dirt, stone, dust
     *   trees()  how near a tree in leaf is, 0 to 1 (asked a few times a second)
     *   ship     { push (0..1), speed, landed, struck (how fast it has just met the ground: taken, and set back to 0), turning (rad/s) }
     */
    update(dt, { airy, inside, shut = inside, high, day, walker, surface, trees, ship, suit = false, glass = false, heat = 0, burn = 0 }) {
      if (!loaded || !L) return;
      // near the sun: the roar comes up with the heat; and at the end one soft blow, and then it is all gone to nothing
      to(L.burn, 1.1 * heat ** 1.5 * (1 - burn), 0.12); to(L.burnBand, 200 + 950 * heat, 0.2);
      to(L.burnNote, 0.06 * heat * heat * (1 - burn), 0.15); to(L.burnPitch, 58 + 130 * heat * heat, 0.2);
      if (burn > 0 && !burnWas) thud(t() + 0.02, 0.5, 0.6, mix);
      burnWas = burn > 0;
      const k = Math.min(1, dt * 4);
      kept.airy += (airy - kept.airy) * k; kept.inside += ((inside ? 1 : 0) - kept.inside) * Math.min(1, dt * 9); kept.day += (day - kept.day) * k;
      const A = kept.airy, I = kept.inside;
      // what is outside: as much as there is air, and through the wall when in the ship
      to(thin.gain, A * (1 - 0.72 * I), 0.1);
      to(wall.frequency, 20000 * Math.pow(1000 / 20000, I), 0.05);
      if ((lookIn -= dt) <= 0) { lookIn = 0.25; near = walker || high < 30 ? trees() : 0; }
      const low = Math.max(0, 1 - high / 14), ground = Math.max(0, 1 - high / 5), dusk = Math.exp(-(((kept.day - 0.35) / 0.3) ** 2));
      to(L.windMade, 0.04 + 0.03 * (1 - low), 0.4);
      to(L.wind, 0.45, 0.4);
      to(L.thinWind, 0.5 * Math.min(1, high / 25) * (1 - low), 0.5);
      to(L.grass, 0.8 * ground * (1 - 0.6 * near), 0.4);
      to(L.trees, 0.8 * near * low, 0.5);
      to(L.creaks, 0.35 * near * low, 0.6);
      to(L.birds, 2.2 * low * (0.12 + 0.88 * kept.day) * (0.55 + 0.45 * near), 0.8);
      to(L.crickets, 1.6 * low * (0.25 + 0.75 * (1 - kept.day)) * (0.6 + 0.4 * dusk), 0.8);
      // the air going past
      const speed = ship && inside ? ship.speed : walker ? walker.speed * 0.3 : 0, fast = Math.min(1, speed / 110) ** 1.5;
      to(L.rush, 0.9 * fast, 0.15); to(L.rushBand, 380 + 9 * Math.min(speed, 160), 0.15); to(L.gusts, 0.9 * fast, 0.2);

      // on foot
      if (walker) stepFeed(walker, surface, A);
      else { dipWas = null; groundedWas = true; }
      // a suit: where there is no air and no ship round one
      const suited = suit ? Math.max(0.5, (1 - A) * (1 - I)) : 0;
      if (glass !== glassWas) {
        // (the glass on the desk waking, or going back to rest: a switch, and the thin rising note of a set warming)
        const at = t() + 0.01;
        // (and before that the glass itself, swung up off the desk on its hinge to knock against its stays, or laid back down)
        tick(at, glass ? 1900 : 1300, 0.14, cabinIn);
        thud(at + (glass ? 0.36 : 0.42), glass ? 0.2 : 0.26, 0.09, cabinIn); tick(at + (glass ? 0.37 : 0.43), 2600, 0.1, cabinIn); tick(at + (glass ? 0.52 : 0.55), 2300, 0.05, cabinIn);
        if (glass) { const at0 = at; { const at = at0 + 0.5; const o = O('sine', 2500), e = G(0); env(e.gain, at, [[0, 0.0001], [0.06, 0.01], [0.8, 0.0001]], true); env(o.frequency, at, [[0, 2500], [0.55, 9000]], true); chain(o, e, cabinIn); o.start(at); o.stop(at + 1); } }
        glassWas = glass;
      }
      if (suit !== suitWas) {
        // (the helmet's ring turned home; and, going on, its air let in)
        const at = t() + 0.02;
        thud(at, 0.16, 0.2, mix); tick(at + 0.1, 1500, 0.22, mix); tick(at + 0.22, 2600, 0.16, mix);
        if (suit) { const e = G(0); env(e.gain, at + 0.3, [[0, 0.0001], [0.05, 0.06], [0.9, 0.0001]], true); chain(noise('white', at + 0.3, at + 1.3), F('bandpass', 3000, 0.8), e, mix); }
        suitWas = suit;
      }
      to(L.suit, suited, 0.4);
      breathe(dt, suited, !!walker && (walker.speed > 4.5 || !walker.grounded));

      // the ship
      const push = ship && inside ? ship.push : 0;
      pushed += (push - pushed) * Math.min(1, dt * (push > pushed ? 14 : 7));
      cold = push > 0.04 ? 0 : cold + dt;
      if (ship && inside) {
        if (push > 0.2 && flown > 0.6) { ignite(A); flown = 0; }
        if (push < 0.04) flown += dt; else if (push > 0.2) flown = 0;
        if (ship.struck > 0.5) { touchdown(ship.struck, A); ship.struck = 0; }
        if (ship.landed && !landedWas) { cooling = 16; coolIn = 0.8; }
        landedWas = ship.landed;
      }
      const p = pushed, body = p ** 0.75;
      to(L.hull, 0.4 * body, 0.04); to(L.hullLow, 120 + 300 * p, 0.05);
      to(L.notes, 0.065 * p, 0.05); L.note[0].frequency.setTargetAtTime(41.2 * (0.94 + 0.12 * p), t(), 0.1); L.note[1].frequency.setTargetAtTime(61.9 * (0.94 + 0.12 * p), t(), 0.1);
      to(L.rumble, 0.55 * body, 0.06);
      to(L.roar, 0.55 * body, 0.05); to(L.roarBand, 560 + 520 * p, 0.08); to(L.fire, 0.95 * body, 0.06);
      to(L.jets, I * Math.min(1, (ship?.turning ?? 0) / 1.6) * 0.035, 0.03);
      to(L.cabin, I, 0.25);
      cool(dt, inside);
      // getting in and out
      if (shut !== insideWas) { hatch(shut, A); insideWas = shut; if (shut) { flown = 1; landedWas = true; } }
    },
    /** With no sound card: lets `dt` of it be worked out, and waits until it has been. */
    async advance(dt) { T += dt; const there = ctx.suspend(T); if (rendering) ctx.resume(); else rendering = ctx.startRendering(); await there; },
    /** With no sound card: works out the rest and gives all of it back as a WAV file, in base64. */
    async finish() {
      ctx.resume();
      const b = await rendering, n = b.length, data = new DataView(new ArrayBuffer(44 + n * 4)), Lc = b.getChannelData(0), Rc = b.getChannelData(1);
      const text = (at, s) => { for (let i = 0; i < s.length; i++) data.setUint8(at + i, s.charCodeAt(i)); };
      text(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); text(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
      data.setUint32(24, RATE, true); data.setUint32(28, RATE * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); text(36, 'data'); data.setUint32(40, n * 4, true);
      let peak = 0;
      for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(Lc[i]), Math.abs(Rc[i])); data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, Lc[i])) * 32767, true); data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rc[i])) * 32767, true); }
      const bytes = new Uint8Array(data.buffer); let s = '';
      for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return { wav: btoa(s), peak };
    },
  };
}
