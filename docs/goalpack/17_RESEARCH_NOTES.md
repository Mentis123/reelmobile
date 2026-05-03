# 17_RESEARCH_NOTES

## Market context

The mobile fishing game market is dominated by two patterns:
1. **Idle/economy fishers** — tap to cast, automatic catch, currency loop, upgrade rod tiers, progression treadmill (Fishing Clash, Hooked Inc, etc.)
2. **Sim/realism fishers** — bass tournament aesthetic, real species, real lures, sim-heavy controls (Bassmaster, Fishing Planet)

**Reel Mobile is neither.**

The wedge is **tactile contemplative fishing in a single contained pond** — closer to the Ocarina of Time pond memory than to any current mobile fishing game. The market has no offering in this space because it doesn't optimise for whales, retention metrics, or daily login mechanics. That's the opportunity.

## Reference experiences (mood, not assets)

- **Ocarina of Time pond** — fixed camera, contemplative pace, mystery beneath the surface, the thrill of the rare Hylian Loach
- **Sayonara Wild Hearts** — restrained UI, atmospheric colour, every frame composed
- **Alto's Odyssey** — silhouette-forward art, mood over detail, mobile-first
- **Studio Ghibli pond scenes** — twilight palette, intimate scale (mood reference only — no IP)
- **Stardew Valley fishing** — rhythm-based tension, simple input, addictive loop

**No assets, names, or content from any of these are used.** They are calibration references for the human and agent, nothing more.

## Rendering strategy: Three.js vs alternatives

**Decision: Three.js (via React Three Fiber).** Justification:

- Water shader — Three.js gives us programmable shaders for the water surface, which is half the visual signature
- Depth — fish at varying depths under a refractive surface is much harder in Canvas2D
- Reeds with vertex-shader sway — trivial in Three.js, painful elsewhere
- R3F integrates cleanly with Next.js and React state

**Considered alternatives:**

- **PixiJS** — 200KB bundle (vs ~700KB for Three.js), excellent 2D perf, but no shader pipeline that helps us. Rejected because water depth is core.
- **Plain Canvas2D** — fastest possible bundle, but cannot do the water signature. Rejected.
- **Babylon.js** — too heavy, no advantage over Three.js for this scope. Rejected.

**Hybrid 2.5D approach:** Three.js for water plane and reeds; sprite billboards for fish; HTML/CSS for UI. This keeps the scene cheap while preserving depth and shader capability.

## Performance research

Three.js mobile performance pitfalls (from community wisdom):

- Draw calls > 50 = mobile frame drops
- Texture uploads > 20MB = Safari texture eviction
- Pixel ratio = 3 (iPhone 12+ default) is *too high* — cap at 2
- Post-processing = mobile-killer; avoid in MVP
- ShaderMaterial recompilations stutter; bake shaders at boot
- Geometry over 100k tris on mobile = thermal throttling within 2 minutes

We respect all of these in `07_PERFORMANCE_BUDGET.md`.

## Mobile WebGL constraints (research)

iOS Safari WebGL is the strictest environment we target. Known constraints:

- WebGL 1.0 only (WebGL 2.0 partial support, treat as unavailable)
- Some shader extensions silently unsupported (always feature-detect)
- GL context loss on backgrounding is **the** biggest cause of broken mobile WebGL games — explicit handlers required
- Audio cannot play before user gesture (Tap-to-begin gate solves this)
- `navigator.vibrate()` not supported; visual + audio must cover the haptic cases
- `100vh` reports incorrectly when URL bar is visible — use `100dvh`
- Memory ceiling around 250MB; Safari kills tabs above
- Rotation lock unreliable outside fullscreen — use portrait-first design pattern

All addressed in `06_MOBILE_WEB_CONSTRAINTS.md`.

## State management

**Decision: Zustand for game state, hand-rolled TypeScript discriminated unions for state machines (game state, fish state).**

- Zustand: small, no boilerplate, works fine outside React (good for game loops)
- Hand-rolled FSM: type-safe via TS unions, no XState dep (~30KB saved), implementation is ~50 lines
- XState rejected: overkill for our state count, dependency cost > benefit at this scale

## Physics

**Verlet rope** for the line. Standard implementation. ~80 lines of code. Handles slack, tension, sag, whip-back on snap. Reference: Hitman: Codename 47 (2000) used Verlet for cloth — proven simple technique.

**No physics engine** (Cannon, Rapier, etc.). All gameplay forces are scripted steering behaviours plus the rope. Saves bundle, saves complexity.

## Audio

Web Audio API procedural in M1 (saves M1 from waiting on assets). Sourced/generated audio in M6. This split, suggested by Codex round 4, prevents audio from blocking the experiment.

Procedural feasibility verified: all 12 sounds in `10_AUDIO_HAPTICS.md` can be synthesised with `OscillatorNode`, `BiquadFilterNode`, `GainNode`, and `AudioBufferSourceNode` (for noise). No exotic web audio extensions needed.

## Risks (technical, in priority order)

1. **iOS Safari touch + WebGL combination** — most likely to cause unique bugs. Mitigation: real device test at every gate.
2. **Line physics feel** — most likely to be "technically working but unsatisfying." Mitigation: M1 vertical slice gate with manual checklist.
3. **Spotting cue ambiguity tuning** — too obvious = generic; too subtle = frustrating. Mitigation: `tuning.ts` constants tuneable via `/tune` page.
4. **Performance under thermal throttling** — iPhone GPU throttles after ~2 min of WebGL load. Mitigation: pixel ratio degradation logic, performance budget enforcement.
5. **Image generation availability** — agent might not have access. Mitigation: explicit Phase A continues without it; Phase B halts.
6. **Asset consistency** — generated assets might drift from art direction. Mitigation: per-asset acceptance criteria, regenerate up to 2 times then stop.
7. **Agent scope drift** — most likely social/process risk. Mitigation: `14_DO_NOT_BUILD.md`, two-failure stop rule, `*-approved` tag discipline.

## Out-of-scope (intentional)

These would be sensible additions for a future product but are explicitly **not** in MVP:

- Multiple ponds (each with own seed, mood, species mix)
- Daily pond mood (one of N presets, rotating by date)
- Friend ghosts (see another player's casts as faint silhouettes)
- Memorable encounter system (named legendary fish that appear once per season)
- Soft progression via "regulars" (fish you've caught before greet you)
- Time-of-day shifts within a single session

They are not in `14_DO_NOT_BUILD.md` permanently — they're parked.

## What we'll learn from MVP

If MVP succeeds (Phase A + Phase B both `*-approved`, five testers smile):
- The market gap thesis was correct
- Tactile contemplative mobile fishing has an audience
- Three.js + React + procedural audio is a viable stack at this scale
- Goal Pack discipline produces builds the human respects

If MVP fails:
- The data tells us *which* part failed (feel? performance? perception? art?)
- Each of those failures has a different next move
- The Goal Pack remains useful as a reusable scaffolding for the next experiment
