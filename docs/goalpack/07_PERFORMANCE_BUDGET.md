# 07_PERFORMANCE_BUDGET

## Targets (numeric, falsifiable)

### Frame rate
- **60fps** target on iPhone 13+
- **30fps** floor on iPhone 11
- **45fps** average across a 60-second session on iPhone 12

If the floor is breached, the milestone fails performance validation.

### Render
- **< 50** draw calls per frame
- **< 100k** triangles in scene
- **< 8** texture units in use simultaneously (atlas if more)
- **< 20MB** total texture memory
- Renderer pixel ratio: cap at `min(window.devicePixelRatio, 2)`

### Memory
- **< 200MB** total JS heap (Safari kills tabs above ~250MB)
- Track via `performance.memory` where available (Chromium); FPS-trip on Safari

### Bundle
- **< 5MB** initial JS bundle (gzip)
- **< 15MB** total assets (textures, audio, models)
- First Contentful Paint **< 2.0s** on 4G
- First Interaction **< 2.5s** on 4G

### Lighthouse (mobile)
- Performance: **≥ 80**
- Accessibility: **≥ 90**
- Best Practices: **≥ 90**

## Required debug HUD

A toggleable HUD (default ON in dev, OFF in production unless `?debug=1`).

Must show:
- FPS (current + 1s avg + 5s avg)
- Draw calls
- Triangles
- Texture count
- JS heap (if available)
- Game state (e.g. `scouting`, `casting`, `hooked`)
- Fish state (e.g. `wander`, `inspect`, `commit`)
- Lure state
- Tension value (0–1)
- RNG seed
- Renderer pixel ratio (and any degradation level)

Toggle with two-finger tap or `?debug=1` URL flag.

## Pixel-ratio degradation logic

```ts
const FPS_FLOOR = 30;
const FPS_RECOVERY = 55;
const DEGRADE_HOLD_MS = 5000;
const RECOVER_HOLD_MS = 10000;

let pixelRatio = Math.min(window.devicePixelRatio, 2);
let lowFpsSince = 0;
let highFpsSince = 0;

each frame:
  if (avgFps < FPS_FLOOR) {
    lowFpsSince += dt;
    highFpsSince = 0;
    if (lowFpsSince > DEGRADE_HOLD_MS && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.5);
      renderer.setPixelRatio(pixelRatio);
      lowFpsSince = 0;
    }
  } else if (avgFps > FPS_RECOVERY) {
    highFpsSince += dt;
    lowFpsSince = 0;
    if (highFpsSince > RECOVER_HOLD_MS && pixelRatio < 2) {
      pixelRatio = Math.min(2, pixelRatio + 0.5);
      renderer.setPixelRatio(pixelRatio);
      highFpsSince = 0;
    }
  }
```

## Optimisation rules

- **Atlas textures** when count exceeds 8. Use `tileMap` or hand-built atlas in M2.
- **Instance** repeated geometry (reeds, rocks, particles).
- **Pool** particle systems and ripple effects, never `new` per emission.
- **Frustum cull** aggressively (Three.js default is good).
- **No post-processing** in M1. Bloom and DoF only after performance validates clean.
- **Compress textures** to `.webp` or `.ktx2` for production.
- **Lazy-load** non-essential assets (catch journal art, share card templates).

## Validation

The performance pass milestone (`v0.8`) requires:

- Real iPhone 12 test, 5-minute session, all numbers logged
- All targets met or documented as exceptions in `DEVLOG.md`
- Lighthouse mobile run on production deploy
- No frame longer than 50ms in the 5-minute session (no jank spikes)
