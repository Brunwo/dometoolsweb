---
kind: game
engine: three.js
---

# Solar

A small solar system, painted, at dusk. A home world you can walk round in a few minutes, its moon to land on, a sun
you had better not fly into, and a wooden ship with a stove and a hammock to cross between them: all of it really
there and really moving, with no loading between the grass and open space. It is a place and a ship so far, not yet
a game. The idea, in the words of the person it was made for, is in `BRIEF.md`.

Play it: https://patch.gg/play/blendi/solar

![The ship standing in the grass at dusk, the sun going down behind it](docs/dusk.jpg)

## Playing

| | Keyboard and mouse | Controller (PlayStation names; an Xbox pad's in brackets) |
| --- | --- | --- |
| Walk, look | WASD, mouse | left stick, right stick |
| Run, jump | Shift, Space | press the left stick, cross (A) |
| Sit, take the suit | E | square (X) |
| Thrust up, down | Space, Shift | R2 (RT), L2 (LT): as hard as they are pulled |
| Thrust ahead, back, aside | WASD | left stick |
| Turn the ship, roll it | mouse, Z and C | right stick; hold L1 (LB) and it rolls |
| Lock the world framed | R | press the left stick |
| Autopilot to the world locked | G | d-pad up |
| Match its speed | hold X | hold cross (A) |
| The landing glass | V | square (X) |
| Look about the cockpit | | hold d-pad down |
| Get up from the seat | E | circle (B) |
| The menu | Tab or Esc | Options (Menu) |

H shows the keys for whatever you are doing. M turns the sound off and on.

## For agents: read this before changing or publishing it

**1. The sound has two parts, and only one of them is in this repo.**

- **In the repo:** every sound is built in layers in `src/sound.js`, and each has a part made in code. Five footsteps
  on grass (`public/sfx`, CC0) are here too. So a fresh copy plays and sounds, with nothing added.
- **Not in the repo:** the published game also plays 43 short recordings cut from the Sonniss GDC Game Audio Bundles
  (wind, birds, crickets, footsteps, the engine's fire). Their licence lets a game use them but does not let anyone
  pass the files on, so they are left out, and `.gitignore` keeps them out.

To get them, **ask the person first** (it downloads about 725 MB from Sonniss's official mirror), then:

```sh
node tools/sounds.mjs fetch    # downloads 20 recordings and cuts them into public/audio (needs ffmpeg with libvorbis)
node tools/sounds.mjs check    # names every sound file as ok or MISSING; exits 0 when all are there
npm run build
```

Rules: never commit `public/audio/*.ogg`, `public/audio/manifest.json` or `sonniss/` to a repo others can read; a
game you publish may play them; say so in its credits, and don't call its sound CC0 or CC BY. `MISSING_ASSETS.md` has
the reasons, every recording by name with what it is for, and how to use your own. Open the game with `?bare` to
hear it without them.

**2. The music is in the repo, and its licence asks for a credit.** Two pieces by Kevin MacLeod, CC BY 4.0, in
`public/music`. The credit is on the menu's Credits page (`CREDITS` in `src/menu.js`) and in `public/CREDITS.md`.
Keep both whenever the pieces stay; change both if you change the music (`MUSIC` in `src/sound.js`).

**3. The ship is built, not drawn by hand.** `public/ship` (the model and four pictures of its light) is written by
`tools/ship/build.py`, run in Blender 5.2. You only need Blender to change the ship: the files it wrote are here.
"The ship", below, says how. Never edit `public/ship` by hand.

**4. Before you publish, run the checks** (they need the build, and a Chromium for Playwright: set `CHROME` to one,
or `npx playwright install chromium`). They are headless and muted, and never take the mouse.

```sh
node tools/checks/pad.mjs                # a stand-in controller: every button does what the table above says
node tools/checks/menu.mjs               # the loading picture, title and menu; stills in shots/work
node tools/checks/music.mjs              # the right piece plays when, and how loud
node tools/checks/flicker.mjs            # how much the picture changes from frame to frame with the eye held still
node tools/probe.mjs --name auto --try "auto::@tools/checks/auto.js"   # the autopilot, from three places
```

After it is out, `node tools/checks/live.mjs <its address on the game host>` opens the published copy the same way
and says whether it gets ready and begins, how many recordings it fetched, and that it asked no other host for anything.

Patch's own test opens the game with `?patch-test=1`: the title shows, then it begins by itself, the menu never
comes up over the game, and no controller is read. `patch.json` tells that test to hold W.

**5. The cover is the game's own picture.** `node tools/cover.mjs` writes `docs/cover-wide.jpg` and
`docs/cover-tall.jpg` from the opening view, with the name lettered by the game's own hand.

## Fulldome (dome master) output

Open the game with `?dome` on its address and it is drawn as a **dome master**: a circle as tall as the screen, in
its middle, with the zenith at the centre and the way one faces at the bottom (the planetarium convention; an
equidistant fisheye). It follows DomeTools (https://github.com/prefrontalcortex/DomeTools), in two ways, and the
dome turns with the head in both:

- **Single-view warp (the default).** Every vertex of every material is sent straight to its place in the fisheye
  (`src/domewarp.js` wraps every material's vertex shader; `page.js` reads each pixel's direction from the lens and
  its distance from a linear depth). The page is drawn once, into the circle: about 2.4× faster than the cubemap.
  The ship's long panels are split finer the first time it is drawn this way (`src/tess.js`), since straight
  edges between vertices cannot follow the fisheye's curves; the sun's glow is drawn in many pieces for the
  same reason. Up to 240° wide; wider, it uses the cubemap.
- **Cubemap** (`?domepipe=cube`). The page, air and all, is drawn once for each side of a cube round the eye
  that the dome can see (five of six at 180°), and every pixel of the circle looks up its own direction in it.

| Address | |
| --- | --- |
| `?dome` | dome master, tilt 0° (classic planetarium), single-view warp |
| `?dome=30` | tilted 30° toward the front (0 to 90; 90 looks straight ahead) |
| `?domefov=200` | dome width in degrees (90 to 360, default 180) |
| `?domepipe=cube` | the cubemap way |
| `?domeface=1024` | cube side size in pixels (cubemap only; default: matched to the screen, at most 2048) |

Keys in dome mode: PageUp / PageDown tilt, `-` / `=` widen / narrow, O toggles a 10° grid (red ring = 90°),
P switches between the two ways. Effects tied to the edges of a flat screen (corner darkening, heat shimmer and
fire from the edges, sun beams) are left out in the dome.

**Checked against each other** (`validate.html`: the same held frame drawn both ways, compared inside the circle;
the cubemap against itself a frame later scores 57–60 dB):

| Where | Mean \|Δ\| /255 | PSNR | Pixels off by > 24 |
| --- | --- | --- | --- |
| Standing at the start, dusk | 3.1 | 31.9 dB | 2.3% |
| In the cockpit, tilt 60° | 3.1 | 29.4 dB | 3.8% |

What differs is fine detail: the painted leaves' speckle, the size of the faintest stars (each is kept at least
a pixel wide, and the two ways measure a pixel differently), and edges. Frame time (SwiftShader, 720²): 10.2 s →
4.3 s at the start, 17.0 s → 7.3 s in the cockpit, ×2.4 either way.

## Building and running

```sh
npm install
npm run build      # writes dist/, with the licence files and whatever recordings are there
npm run serve      # serves dist/ at http://127.0.0.1:5520/
```

## How it plays, in full

- **On foot:** click to look, WASD to move, Shift to run, Space to jump. The ship is a room: walk up its ramp and in.
  At the seat, E sits; the ramp comes up behind.
- **In the seat:** Space lifts off. WASD pushes forward, back and sideways, Space up, Shift down, the mouse turns the
  ship, Z and C roll it. R locks whichever world is framed on the glass; a ring round it fills as the room left to
  stop in runs out; holding X matches its speed (with nothing locked, it brings the ship to rest over the ground
  below). It rights itself near the ground and stands, square to the ground under its four feet, when it is set
  down gently.
- **The landing glass** lies folded flat on the desk, its back uppermost, so that the window is clear. It does
  nothing of itself: V swings it up on its hinge, it knocks against its stays, and its picture opens. Low over a
  world the first press shows what is under the ship (the pilot leans in to it coming down); otherwise the world
  made for, as through a spyglass. V again is the other picture, and a third press lays it down, as getting up
  from the seat does.
- **The thrusters** light at a little under half their burn and come up to all of it in half a second: a tap is a
  gentle push, a held key the whole of it. The cage of beads by the dials shows which is burning and how hard (the
  one under the ship to go up, the left one to go right, the near one to go ahead).
- **E gets up, on the ground or in flight.** In flight the room's floor is down whichever way the ship points, the
  ship goes on as it was going with nobody at the stick, and the ramp stays shut. E at the seat sits again.
- **The suit** hangs by the door: E beside it puts it on or takes it off. Where there is no air outside (anywhere
  but the home world) the ramp stays up until it is on; a red lamp by the ramp says so.
- H shows the keys for whatever one is doing (they also show by themselves the first time).
- **The sun burns.** Within about two and a half of its own widths from its middle the ship takes fire, slowly and
  then fast: the picture swims and goes to gold, fire comes in from its edges, sparks stream past, the wall roars.
  Nearer still the sun pulls. Turn away in time and she cools. Let it go on and everything goes to white gold, and
  one wakes on one's feet by the ship, where it first stood on the home world. The autopilot goes round the sun.
- **The menu.** While the worlds are made a painted picture of the home world at dusk is shown, with six beads
  that light as they are made. It lifts to show the world itself from over the edge of day, with the title: Begin,
  Controls, Settings. Tab, Esc or a pad's Options brings the menu while playing: the world stops and blurs.
  Settings (sound, how fast the mouse and the stick look, up and down turned over, whether the pad shakes) are
  kept in the browser for next time. It is worked with the mouse, the arrow keys and Enter, or a pad.
- **Music.** One piece on the title and in the menu, and another that comes up only where there is no air: out
  in space, and more quietly on the moon on foot. On the home world's ground there is none; the wind and the
  birds are the music there. The menu has small plucked notes of its own. Settings has a thread for Music.
- **The autopilot** (G, or d-pad up) takes the ship to the world that is locked (or, with nothing locked, the one
  framed): it lifts off if it must, goes round a world that is in the way, turns to face where it is going, stops
  about 70 m over the moon or 150 m over the home world, and holds there at that world's own speed. Pushing on
  anything takes the ship back; the landing is the pilot's. It goes on if the pilot gets up and walks about.
  `node tools/probe.mjs --name auto --try "auto::@tools/checks/auto.js"` flies it from three places and says how
  each went.
- **On a pad** (laid out as people who have flown such a ship know it; a PlayStation pad's names, with an Xbox
  pad's in brackets). On foot: left stick walks, as fast as it is pushed; press it in to run; right stick looks;
  cross (A) jumps; square (X) uses what is at hand. In the seat: R2 (RT) lifts and L2 (LT) sinks, each as hard as
  it is pulled; the left stick pushes ahead, back and aside by how far it is pushed; the right stick turns the
  ship, and rolls it while L1 (LB) is held; hold cross (A) to match speed; press the left stick to lock the world
  framed; square (X) is the landing glass; hold d-pad down to look about the cockpit; d-pad up is the autopilot; circle (B) gets up. Options
  (Menu) shows the buttons. The engine and a hard landing are felt in the hands. What is shown on the glass
  follows whichever was touched last, pad or keys, and names a pad's buttons as that pad does.
- M turns the sound off and on. T holds time, `[` and `]` wind it back and on. F lets a free eye leave the body (Space up, Q down, Shift fast).

## What is where

| File | What it is |
| --- | --- |
| `src/system.js` | The sun, the worlds and the moon on their orbits; where one body is as seen from another; how hard each pulls |
| `src/land.js` | A round ground made from a rule for its height (`shapeLand`), and the home world's own (`createLand`) |
| `src/moon.js` | The moon: its craters, its dust, its hard light, its stones |
| `src/air.js` | What every painted thing on a world shares: the sun over each place, the sky's light, the wind |
| `src/page.js` | Draws the worlds, then what is inside the ship; the air (one sum along every line of sight), the stars, the glow |
| `src/sky.js` | The sun and its glow, and the far world as a painted ball |
| `src/world.js`, `src/grass.js` | The home world's painted ground and its grass |
| `src/paint.js`, `src/trees.js` | Leaves in touches of a brush, trunks in planes, stones rough and whole; what is planted where, and how many of a thing's touches are laid from how far off |
| `src/walker.js` | Walking on a ball, on any world, and the free eye |
| `src/ship.js` | The ship: fetching it as built, its paint, where one can walk in it, and how it flies |
| `src/desk.js` | What helps the pilot: the marks on the window glass, the screen (at rest, what is below, or the world made for), the chart, the dials, the small lamps |
| `src/hand.js` | The lettering: every letter a few strokes of a pen, drawn by us, written as cut plates, the pilot's hand, light on glass, or a stencil |
| `src/words.js` | What is said to whoever is playing: what a key will do here, the keys there are, the line while the worlds are made |
| `src/prints.js` | Everything printed or engraved in the ship (names on brass, charts, the pilot's card, dial faces), drawn onto one sheet; `tools/ship/prints.json` says where each is |
| `tools/ship/build.py`, `lib.py`, `dims.py`, `cockpit.py`, `detail.py`, `cockpit2.py`, `room2.py`, `outside2.py` | The ship itself, built in Blender from a script (the hull and room; the helpers; sizes, colours and small fittings; the pilot's place; the small things outside and in; and more of each), and the light worked out on it |
| `src/sound.js` | Everything heard: built in code in layers, with recordings over them where they are there; what there is to hear follows the air |
| `src/main.js` | Who is looking and from which world's frame; boarding, getting up in flight, the suit and the ramp |

## How two worlds are drawn, and how the ship flies

- **Every world is drawn in its own frame**, as if it were the one underfoot (its middle the origin, its ground still),
  with the eye placed where it is in that frame. Both are always drawn this way and share one depth, so nothing
  changes hands on the way across. Only the numbers the eye is kept in change, to the frame of whichever world is
  nearer.
- **The ship is pulled by both worlds**, and because a world's frame turns (and the moon's is swung round the home
  world) it is also pushed by what such a frame adds. `tools/checks/frames.js` lets a ship fall from the same start
  kept in either frame and compares: they agree to millimetres.
- **The ship is one thing, inside and out**, in the scene of the world it is at. Far from the ground the worlds are
  drawn from some way off, which would cut the room away: so there it is drawn once more, last, into the nearest
  sliver of depth by an eye that sees only the ship (layer 1), with the shadows the world's lamp has just thrown.
- **Aboard, the ship's floor and ramp are the ground** (`walker.floor`), and `walker.also` keeps feet out of its
  walls from either side. Coming aboard is stepping onto the foot of the ramp; nothing is pressed.
- A lamp that is not wanted is set aside far away, never put out: putting one out makes every paint compile again.

## How it is checked

Everything is looked at headless and muted, with the clock stepped by hand.

- `sh tools/go.sh --name x --steps "wait 1; shot start; flyto moon under:52; shot landed; board out; shot out"` builds
  and takes stills (`tools/look.mjs` lists the steps).
- `node tools/film.mjs --out shots/x.mp4 --keep --steps "toship; flyto moon under:52; out; walk 5; gaze home 4"` films,
  and `python -I tools/pops.py` reads the frames for anything that jumps.
- `node tools/hear.mjs --name x --seconds 30 --steps "board; ship 3 up; wait 4"` works out what would be heard with
  no sound card and nothing played: a WAV, a picture of it, and how loud it is second by second. `tools/film.mjs
  --sound <seconds>` lays the same under a film.
- `tools/checks/pilot.js` is the pilot both use: it flies only through the controls a person has.
- `node tools/probe.mjs --try "name::code"` (or `name::@file`) runs code in the page: to switch parts of the picture
  off, or to run a check such as `tools/checks/frames.js`.

## The ship

A round wooden hut that flies: barrel staves in copper hoops, a copper roof, a lantern window, four sprung legs, a
ramp that is its door. It is built from a script, so that it can be changed and built again:

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/ship/build.py -- preview bake export
```

- `preview` (optionally with view names: front back side door seat aft left right) renders pictures into
  `tools/ship/out`. `bake` works out, on every surface, the light of the sky (with its bounces), of the ship's own
  lamps, and how deep in a corner the place is, into `public/ship/{hull,room}-{lamp,sky}.webp` (it needs ffmpeg on the path). `export` writes
  `public/ship/ship.glb`, packed to a quarter of its size by glTF Transform if `npx` can fetch it (the game reads it
  either way). A bake and export take about five minutes on the 4090 (`BAKE_SAMPLES=64` in the
  environment for a rough one in a minute and a half, while shaping things).
- Each piece carries a colour and, in its alpha, how it shines (0 to 0.8 metal, 0.9 and over a lamp); what it is
  made of (`KINDS` in `lib.py`: bare wood, painted wood, copper, brass, iron, cloth, leather, rope, enamel, padding
  and so on, taken from its colour unless `mat=` says otherwise); and which way its grain runs. They go out as the
  colour and two more sets of texture coordinates.
- The game paints each kind in its own way (`shipPaint` in `src/ship.js`), as it draws, so it is sharp at any
  distance. Everything is laid on in dabs of a brush (long ones along the grain of wood), and nothing is left
  smooth: boards have rings, knots, splits and the saw's marks; paint has the brush's streaks and is gone from
  edges, in flecks and low down; copper is beaten, brown, and green where the wet sits; brass is patchy and rubbed
  bright; iron is pitted and rusts from its edges; cloth is woven, faded along its folds, stained, and canvas is
  patched; there are scratches on what is hard and dirt in every corner; the floor is trodden pale from the door to
  the seat. No two pieces sit quite square to the light. Edges are found from how fast the surface turns (no extra
  data). Bumps are in three sizes, each shown only as near as the picture can hold it (finer, and a bump worked
  out from one dot to the next goes to blocks). Light: the sun as it is (through the world's shadow lamp, so the
  light through the windows is real), the sky as far as the bake says it reaches, the lamps; metal shows the
  lantern and the sky. Outside, everything is also streaked, grimed and splashed.
- `part(..., rough=, grit=, sub=)` pushes a shape's corners about so that nothing soft or beaten is a clean
  shape. Only for things nothing is fixed to.
- Things printed are flat pieces of kind `print` whose corners are places on the sheet `src/prints.js` draws
  (`label('LIFT', frame, width)` in `dims.py`); dials with moving needles are kind `dial` on a second small sheet.
  A new name: add it to one of the `labels` lists in `prints.json` (both sides read them). A new picture: a cell there, and a
  function of the same name in `DRAW`.
- Small lamps that say something are kind `lit0`..`lit7` (the game sets `uLit`: ramp, ground, locked, match, too
  fast, landing; by the ramp, air and no air); the beads of the push glass are `push_*`, each with `val=` its place
  along its arm (least at the bell, most by the hub). Each arm is a thruster, and the one that lights is the one
  burning: its flame first, then its beads back to the hub as it burns harder.
- The landing glass is built standing, every piece of it `tag='screen'`; `cockpit.SCREEN_HINGE` is a place on its
  hinge and `cockpit.SCREEN_SWING` how far round it swings to lie down (`SHIP_SCREEN=down` shows that in a
  preview). The game hangs it and its picture from `pivot_screen`.
- The light worked out beforehand is one picture for the whole room: a small piece gets only a few dots of it.
  `fatten()` in build.py sees that none gets fewer than two or three (with none, a name plate came out black).
- The ramp, the window glass and the two desk glasses (`face_main`, `face_chart`) are their own pieces; so are the
  stick and the two levers (pieces built with `tag=` are taken out of the room after the bake, with their own
  pivots, and leaned by the game); `suit` (the suit, its helmet and pack) is hidden while it is worn, and `visor`
  (built round the origin, never baked) is what is then seen of the helmet from inside it; `seat_eye` is where the
  pilot's eye is.
- What one can walk on is written by hand to match (`DECK`, `deckKeep`, `OUTSIDE` in `src/ship.js`): change the
  room's furniture and change those.
- `tools/checks/walkin.js` walks up the ramp, sits, stands and leaves through the controls; `tools/checks/settle.js`
  hops and comes down.

## Things worth knowing

- **Where one starts is near the pole.** There the sun goes round the horizon, so it is dusk or a low sun most of
  the time. Toward the equator there is a whole day and night.
- **The moon keeps one face to the home world**, so the home world hangs in one part of its sky and only nods a few
  degrees. Land on the near side to have it overhead.
- **The air is one thin shell** (46 m) round the home world only. One liberty: air between the eye and anything near
  is counted at a fifth, or a tree at thirty metres would be in fog.
- **A thing in leaf is one thing at every distance.** It is made once, leaf by leaf. From further off fewer of its
  touches are laid and each is laid broader (`PRUNE` in `src/paint.js`): a touch goes by shrinking to nothing, each at
  its own distance, so nothing is ever swapped for something else and there is nothing to see as one walks up to a
  tree. The pieces it is drawn from (`LEVELS`) share their buffers and differ only in how many touches they hold;
  the touches a smaller piece leaves out have shrunk to nothing already. A shadow thins by where the eye is
  (`uEye`), not by where the lamp is.
- **Ground is the same from any height.** Nothing in a ground's painting comes in or goes out with distance: what
  is finer than one dot of the picture covers (`gPx`) is left out, and that is all. There are no cells in it.
- **Input is read into what is asked for, not which key** (`src/input.js`): `read(dt, where)` is told what one is
  doing (on foot, in the room, in the seat, flying), because a button means different things in each. A pad sets
  `fine`, and the ship then burns exactly as hard as it is asked (`ship.update`); keys keep their half-second
  build-up. `node tools/checks/pad.mjs [--kind xbox]` plays the built page with a stand-in pad and says what
  passed; the PC's own pad is hidden from it.
- **The pilot sees out.** The three panes in the middle of the window meet glass to glass, with no post between
  them (`hull()` in `build.py`); the seat stands close to the desk (`SEAT_Y`, `EYE` in `dims.py`; `DECK.seat` in
  `src/ship.js` must agree), so that from it the nearest posts are outside the picture, the window's head is at
  its top edge and the desk is its bottom quarter. The window's glass is lit as one bent sheet (`shipGlass` in
  `src/ship.js`), so that where two panes meet nothing shows. Nothing stands in the glass: the six lamps are two low strips
  on the desk's far edge (`post_lamps`), and what hung on the middle posts hangs on the next ones out.
- **What is behind the sun is not seen.** The worlds that are places are drawn after everything far off and do
  not share its depth, so which is in front is settled by order: a world the sun is in front of (`behindSun`, set
  in `src/main.js`) is drawn before the sky, and the home world's air is left out with it. The desk leaves out
  the marks of whatever the sun hides. Heat and the end are two numbers the page is given (`uHeat`, `uBurn`).
  `tools/checks/sun-setup.js` puts the ship by the sun for stills (as `--setup` to `probe.mjs`).
- **Music is played from files, not held whole** (`MUSIC` in `src/sound.js`; the files are in `public/music`, CC
  BY 4.0, named in `public/CREDITS.md` and on the menu's Credits page, which the licence asks for). `scene()` is
  told every frame what is up, and lets the world down to nothing under the menu. The menu's notes (`ui()`) are in
  C minor, the key both pieces are in. `node tools/checks/music.mjs` says what plays when, and how loud.
- **The loading picture, the title and the menu are one sheet** (`src/menu.js`), drawn with the game's lettering,
  with no boxes or buttons: what is chosen has a small sun beside it. It takes every key while it is up (asked
  first, in the capture phase), so none reaches the game. The title's eye is `titleView` in `src/main.js`.
  `node tools/checks/menu.mjs` takes stills of every page and says whether the menu does what it says.
- **The lake.** Water stands in the great hollow (`LAKE` in `src/land.js`: its level; `land.water`, `land.shore`,
  and `land.ground`, which lets nobody stand deeper than the knee). The way from the start leads down to it.
  `src/water.js` draws it: a glass for the sky seen across, dark and clear seen from above, the sun mirrored in it
  and the bed showing at its edge. Nothing but the sky and the sun is mirrored (no trees, no ship). Nothing grows
  in it or on its sand; wading is slow, and sounds like it (made in code, `step` in `src/sound.js`).
- **The ship lights the ground round it** (`shipGlow` in `src/air.js`, `uGlow` set in `src/main.js`): warm, most a
  few paces out from its wall and out of its open door, all of it by night and a fifth by day, added after the
  night has taken the colour out of things.
- **A pine's boughs end in needles.** The dark mass under a bough's needles is kept inside them, is left out at
  the tip, and grows far less with distance than the needles do (`pine` in `src/trees.js`, `dGrow` in `src/paint.js`).
- **The home world from above.** Two things made its ground read as paint laid on at random. One: trees threw
  no shadow there, since the lamp only throws them near the eye. `src/cover.js` keeps where the crowns are and how
  high, as a picture, and the ground walks a line toward the sun through it (`treeShade` in `src/air.js`), from
  45 m off outward: so shadows lie right, lengthen at dusk and turn with the day, seen from any height. Two: the
  meadow's broad tones were noise. They now follow the land (`meadow` in `src/air.js`): yellower as the ground
  rises, a shade deeper in the great hollow and under trees, and never dark. The ground's own noise is only fine
  tufts. (A first try also darkened every small dip; it looked like a swamp and was taken out.)
- **Two things for the look of the home world's ground.** Motes by day and fireflies by night (`src/motes.js`:
  points kept in a box round the eye). And night: `nightEye` (`src/air.js`) takes the colour out of what is dim,
  and a tree's light is worked out as if it stood a fifth as high (`lowered`), because on a world this small its
  top sees over the horizon and would stand in sun long after dark. Two more were tried and parked, and are still
  in the code, switched off: beams of the sun in the air (`uShaft` in `src/page.js`, left at nothing) and flowers
  (`src/flowers.js`, which nothing brings in). The third of the land's numbers, which was where flowers grow, is now how
  much of a hollow a place is.
- **A shadow's edge is soft, and that is what keeps shadows still.** The sun moves fast here, so the shadows'
  picture is drawn from a new side every frame, and anything in it finer than one of its dots (a joint between
  boards, a wire, a nail) is caught in one frame and missed in the next: that was a fast flicker, worst on the
  ship. Every painted thing now reads the shadows through `softShadow` (`src/air.js`): many looks spread over
  about a hand's breadth (`uShadowSoft`, set in `src/main.js` as the picture is drawn wider or closer), with more
  room given to a surface the light only grazes. It is also true to this sun, which is wide in the sky.
  `node tools/checks/flicker.mjs` holds the eye still by the ship and says how much the picture changes from
  frame to frame (`--code "L.air.uniforms.uWind.value.w = 0;"` stills the wind, which is real movement).
- **A stone has no cells and no flats painted on it.** Its shape is its own: a ball split by eight planes and
  kneaded (`boulder` in `src/trees.js`), in many sides near and few from forty of its sizes off. Its skin is smooth
  noise with its slope (`STONE` in `src/paint.js`), which turns the light grain by grain. Bark keeps its planes.
- **The moon's small craters and stones are painted as shapes** (`BOWLS` in `src/moon.js`): each has a place, a
  width and an age, scattered on the six sheets (one that would cross a sheet's edge is left out). They turn the
  light as if they were there, and a bowl's sunward lip and a stone throw a real shadow, worked out from how deep
  the bowl is and how high the sun stands. The broad and middling craters are in the ground's own height.
- **Bright values at a thin triangle's edge**: anything raised to a power in a fragment shader is clamped first
  (`grass.js`), or it sparks.
- A closed `roll()` needs `every` small enough for its size, or a small ring comes out a triangle.

## Sound

What there is to hear follows the air. On the home world's ground: wind, grass, trees, birds by day and crickets at
dusk, one's own steps. Going up it all thins away with the air. In the ship the outside comes through the wall
dulled, and the engine comes through the frame; in space that is all there is of it. On the moon there is no air:
only breathing, and steps felt more than heard. Recordings are laid over the parts made in code where they are
there; they are not in the repo (`MISSING_ASSETS.md`), and `?bare` plays the game without them.

## Not done

It is a place and a ship, and not yet a game: there is no reason to go anywhere but to see it. Engine fire seen from
outside (nothing of it can be seen from the seat). The suit has no air to run out of. The far world is a painted
ball only. Nothing but the sky and the sun is mirrored in the lake. Beams of the sun in the air, and flowers, were
tried and taken out again; both are still in the code, switched off (`uShaft` in `src/page.js`; `src/flowers.js`).
A quality setting.
