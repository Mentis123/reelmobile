# 03_IMPLEMENTATION_PLAN

## Milestones

Each milestone produces a `vX.Y-name-candidate` tag. Human creates the matching `vX.Y-name-approved` tag after iPhone playtest.

### M0 — Repo & deploy shell
- Next.js App Router + TypeScript + pnpm
- Vercel deploy on `main` push
- `/` shows project name and "Tap to begin" gate
- `/dev` shows local IP, QR code, current candidate tag, manual checklist
- `/game` and `/tune` routes exist but empty
- Lint, typecheck, build all pass
- Tag: `v0.0-shell-candidate`

### M1 — Vertical slice (Phase A — the experiment)

**This is the gate. Everything before M1 is plumbing. Everything after M1 depends on M1 passing.**

Required:
- Mobile-first portrait layout
- Tap-to-begin splash (audio unlock, fullscreen, orientation, session start)
- Grey-box pond (3D water plane, dock, fixed cinematic camera)
- One visible-but-ambiguous fish using the spotting cue system per `04_SPOTTING_AND_PERCEPTION.md`
- One lure with splash, sink, twitch behaviour
- Drag/release casting with parabolic arc
- Verlet rope line (8–12 segments) per `05_PHYSICS_AND_FEEL.md`
- Fish state machine (hand-rolled TS unions)
- Hook event with bite window
- Tension system (visible in line + rod bend + splash intensity)
- Three distinct failure modes per `11_FAILURE_AESTHETICS.md`
- Procedural Web Audio sounds (oscillators + noise) for cast, plop, twitch, nibble, hook, snap, splash, catch
- Result screen with story-style copy
- Debug HUD (FPS, draw calls, game state, fish state, tension, seed)
- `/tune` page with hot-reloadable constants from `tuning.ts`
- WebGL context loss + restore handlers
- iOS Safari touch protections (`touch-action`, `user-select`, `-webkit-touch-callout`, `preventDefault`)

Tag: `v0.1-vertical-slice-candidate`

**STOP. Request human review on real iPhone.**

### M2 — Pond visuals
- Water shader (depth fade, fresnel, gentle ripples)
- Reeds (instanced low-poly)
- Dock detail
- Painted background card
- Replace core grey-box art for pond, lure, fish (one species)
- Tag: `v0.2-pond-candidate`

### M3 — Fish variety
- Five species per `01_GAME_SPEC.md`
- Per-species cue signatures from `04_SPOTTING_AND_PERCEPTION.md`
- `personality: -1..1` scalar per instance
- Spawn distribution seeded
- Tag: `v0.3-fish-variety-candidate`

### M4 — Lure & rod variants
- Three lures with distinct sink rate, twitch profile, attraction radius
- Two rods with distinct cast power curve, tension tolerance
- Selection UI (pre-cast, minimal)
- Tag: `v0.4-gear-candidate`

### M5 — Catch journal
- localStorage persistence per schema in `15_TELEMETRY_AND_SESSION.md`
- `/journal` route with chronological catch list
- Each entry: species, size, lure, time, story copy
- Tag: `v0.5-journal-candidate`

### M6 — Audio polish
- Replace procedural with sourced/generated audio per `09_ASSET_GENERATION.md`
- Ambient pond loop (layered: water, distant birds, occasional reed rustle)
- Refined haptic patterns
- Audio settings (mute, haptics on/off)
- Tag: `v0.6-audio-candidate`

### M7 — Share & install
- `navigator.share()` for catch cards (image blob)
- Fallback: copy-to-clipboard with toast
- Catch card image generation (canvas → blob)
- PWA manifest, icons, splash
- Deferred install prompt (after first catch + 2min playtime)
- Tag: `v0.7-share-candidate`

### M8 — Performance pass
- Validate against `07_PERFORMANCE_BUDGET.md` numbers
- Texture atlasing where >8 textures
- Pixel ratio degradation logic
- Memory watchdog
- Lighthouse audit
- Tag: `v0.8-performance-candidate`

## Hard rules
- No milestone progresses without `12_VALIDATION.md` passing.
- No `*-approved` tag is written by the agent.
- Two failures on same milestone → stop, write to DEVLOG, request review.
- Phase B does not begin without `v0.1-vertical-slice-approved`.
