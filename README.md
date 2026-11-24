# DomeTools Web

**Live demo:** https://brunwo.github.io/dometoolsweb/

A web adaptation of [prefrontalcortex/DomeTools](https://github.com/prefrontalcortex/DomeTools) (Unity fulldome toolkit), using plain WebGL2 with no dependencies.

## Projection

Open `index.html` in Chrome, Edge or Firefox (double-clicking it works, no server needed).

Pipeline (same as DomeTools' "traditional cubemap" mode):

1. **Cubemap capture**: the scene is rendered 6 times per frame from the rig position (90° faces, GL cubemap convention).
2. **Warp pass**: a full-screen shader turns every output pixel into a view direction and samples the cubemap.

### Dome master convention
- Circular azimuthal fisheye; the image centre is the dome zenith (tilt 0°).
- With a 180° FOV the rim is the horizon (θ = 90°).
- **Front of the audience is at the bottom of the image**, back at the top, and audience right is image right.
- Equidistant lens (r ∝ θ) is the standard; equisolid, stereographic and orthographic are included for comparison.

Direction for an output pixel `p` in the unit disc:

```
r = |p|, φ = atan2(p.y, p.x), θ = r · FOV/2           (equidistant)
d = sinθ·(cosφ·R + sinφ·U) + cosθ·F
F = dome centre direction, U = image-up (dome back), R = right
```

**Dome tilt** rotates F from the zenith toward the front: 0° is a classic planetarium, 90° looks straight ahead.

### Views
1. Dome master (fisheye): the deliverable
2. Equirectangular 360°: a debug view
3. Perspective preview: a normal camera, sampled from the same cubemap

### Sky
**Deep space** (default): stars all round and the Milky Way, all procedural (no textures). There are 4 layers of stars on a 3D grid, with temperature colours and few bright ones. The band is brighter and warmer toward its bulge, with star clouds, dark dust lanes and filaments, and a few red hydrogen clouds plus one blue reflection nebula. The sun is a hard disc with no atmosphere, and objects get only faint ambient light and no haze. Inspired by a wide-field photo of the galactic centre, not copied from it. **Day sky** brings back the blue sky, clouds and ground. The ground plane can be toggled separately.

### Black hole
A ray-traced Schwarzschild black hole (r_s = 2.5 m, 56 m away, 34° up in front), drawn in the sky shader, so both pipelines get it. Each pixel's ray is traced back through curved space with the exact photon equation a = −1.5 h² p / r⁵, with the weak-field bend added analytically outside 30 r_s. This gives the shadow, the photon ring, the far side of the disk lensed over and under the hole, and stars smeared round it. The accretion disk runs from ISCO (3 r_s) to 13 r_s, with thin-disk emissivity and Keplerian differential rotation (ω ∝ r^-3/2, so the gas winds into streaks). Doppler beaming and gravitational redshift (switchable) make the approaching side brighter and bluer. The spinning cubes and spheres are gone; the pillars and zenith sphere remain as optional reference markers.

### Tidal disruption (a star torn apart), on demand
A star orbits the hole at 11 r_s. **Pull the star in** (button in the Black hole section, or `T`) starts the disruption: the star is peeled into a stream of hot gas that winds ahead of it (inner gas runs faster) and spirals down into the disk. The disk brightens and twin jets light up along its axis while it feeds. Press again to stop: the star stays where it is, partly eaten, and the stream lets go and drains in. Press again to carry on. After about 28 s of feeding the star is gone, and the button brings a new one. The star, the stream (80 moving beads, culled by bounding spheres) and the jets are drawn inside the ray tracing, so they're lensed like everything else.

### Verification aids
- Dome grid overlay: rings every 10° from the zenith, spokes every 30°, and the horizon ring in red.
- Calibration sky: azimuth and elevation lines every 15°, the front meridian in red, and the horizon in yellow.
- Scene: 12 pillars coloured by azimuth (red = front, at -Z), a ground grid with a red forward axis, and a white sphere straight overhead (it should sit at the image centre).

### Export
"Save dome master PNG" renders off-screen at 1024, 2048 or 4096 px. In Auto mode the cubemap face size is matched to the export resolution.

## Two pipelines

The page has two ways to make the dome master. Switch with **Pipeline** in the panel, the `P` key, or `?pipe=cube` / `?pipe=single`.

| | Cubemap | Single-view warp (default) |
| --- | --- | --- |
| Passes per frame | the cube faces the dome can see (5 at 180°) | 1 |
| How | render 90° faces, then look every output pixel up in the cube | every vertex goes straight to its fisheye position in the vertex shader |
| Resampling | yes (cube → fisheye) | none, with optional 2×/4× MSAA |
| Works for | dome master, equirect, perspective, any FOV | dome master only, best up to ~220° |
| Needs | nothing special | meshes dense enough that edges can bend (cubes 10×10 per face; polar ground that follows the rig) |

Single-view vertex projection: `θ = angle(d, F)`, `r = lensR(θ)`, `xy = r · normalize(d·R, d·U)`. Depth is linear distance between near and far, with `w = 1`. Vertices more than 40° behind the dome's rim are pushed past the far plane, so triangles near the back point don't wrap. The sky uses the inverse (`lensTheta`) per pixel, so it's exact.

### Validation against the cubemap template

**Validate** renders the same frame (1024²) through both pipelines and reports the mean |Δ|, PSNR, the share of pixels off by more than 24, and frame times, with cubemap / single / |Δ|×4 thumbnails. Results headless, in SwiftShader (a CPU renderer, so these timings understate a GPU):

| Case | Mean \|Δ\| /255 | PSNR |
| --- | --- | --- |
| 180°, tilt 0 | 0.19 | 41.9 dB |
| 180°, stereographic | 0.21 | 41.9 dB |
| Rig beside a pillar | 0.70 | 35.6 dB |
| Tilt 30° + calibration sky | 2.5 | 29–33 dB |
| 220°, equisolid | 3.1 | 28–30 dB |

The difference images show no shifted geometry. What remains is thin, high-frequency detail (1-px calibration lines, the distant ground grid at the horizon), which the single view draws sharp and the cubemap path softens by resampling.

Speed at 1024², 180°: the cubemap path takes ~150 ms for 5 faces × 896². The single view takes ~53 ms without MSAA (×2.8) and ~100 ms with 4× MSAA (×1.6; MSAA is expensive on a CPU renderer and cheap on a GPU).

## Notes
- Cubemap sampling uses LOD 0 with no mipmaps. Per-face mipmaps cause visible seams at face edges, so the "Auto" face size matches cube texel density to output pixel density instead.

## Next steps (ideas)
- Port the single-view warp to Solar (every material's vertex projection, plus its depth-based air pass).
- Skip cube faces that fall outside the dome cone (for example, the down face at 180° and tilt 0°).
- Load glTF scenes, plus video/NDI-like streaming output (WebRTC / WebCodecs).
- An in-browser dome preview: an inside-the-dome 3D view of the dome master.

## Demo: Solar in fulldome

`solar/` is [blendi/solar](https://patch.gg/play/blendi/solar) (MIT; music by Kevin MacLeod, CC BY 4.0, credited in its menu and in `solar/CREDITS.md`) with a dome mode in both pipelines:

- `solar/?dome`: single-view warp. Every material's vertex shader is wrapped (`solar/src/domewarp.js`), and the ship's long panels are split finer for it (`solar/src/tess.js`). About ×2.4 faster than the cubemap.
- `solar/?dome&domepipe=cube`: cubemap, 5 faces at 180°.
- `solar/validate.html`: the same held frame drawn both ways and diffed. 31.9 dB at the start, 29.4 dB in the cockpit; the cubemap against itself is 57–60 dB.

It's published unbundled: ES modules with an import map for three.js r186 (`solar/vendor/three`, MIT). Details: `solar/README-solar.md`.
