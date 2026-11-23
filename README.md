# DomeTools Web

**Live demo:** https://brunwo.github.io/dometoolsweb/

A web adaptation of [prefrontalcortex/DomeTools](https://github.com/prefrontalcortex/DomeTools) (Unity fulldome toolkit), using plain WebGL2 with no dependencies.

## Step 1: projection (done)

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

### Verification aids
- Dome grid overlay: rings every 10° from the zenith, spokes every 30°, and the horizon ring in red.
- Calibration sky: azimuth and elevation lines every 15°, the front meridian in red, and the horizon in yellow.
- Scene: 12 pillars coloured by azimuth (red = front, at -Z), a ground grid with a red forward axis, and a white sphere straight overhead (it should sit at the image centre).

### Export
"Save dome master PNG" renders off-screen at 1024, 2048 or 4096 px. In Auto mode the cubemap face size is matched to the export resolution.

## Notes
- Cubemap sampling uses LOD 0 with no mipmaps. Per-face mipmaps cause visible seams at face edges, so the "Auto" face size matches cube texel density to output pixel density instead.

## Next steps (ideas)
- **Single-view Dome Warp**: DomeTools' efficient mode, which renders one wide view and warps it instead of 6 faces.
- Skip cube faces that fall outside the dome cone (for example, the down face at 180° and tilt 0°).
- Load glTF scenes, plus video/NDI-like streaming output (WebRTC / WebCodecs).
- An in-browser dome preview: an inside-the-dome 3D view of the dome master.
