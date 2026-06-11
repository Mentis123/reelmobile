# ARCHITECTURE

How the code is shaped. For *why* the game is shaped this way, read `docs/goalpack/` — this file is about the seams.

## Module map

```
src/
  game/            Pure framework-agnostic TypeScript. No React, no three.js imports.
    math/          vec.ts — Vec2 ops, lerp/clamp, seededRandom (mulberry-style string-seeded RNG)
    physics/       verletLine.ts — the fishing line as a Verlet rope
    fish/          fishStateMachine.ts (AI), species.ts (5 species + personality), trophy.ts (procedural portrait)
    state/         gameStateMachine.ts (GameState union), gameStore.ts (Zustand projection store)
    tuning/        tuning.ts — every gameplay/visual/audio constant, one table (no magic numbers; 14_DO_NOT_BUILD)
    gear/          gear.ts — rod/lure ids and multiplier resolvers (22_THE_GEAR)
    audio/         procedural.ts — Web Audio synthesis (plops, ticks, tension loops); no audio files
    persistence/   catchJournal.ts, gearStore.ts (localStorage), sessionStore.ts (in-memory session)
    share/         catchCard.ts (canvas composite), shareCatch.ts (navigator.share / download)
    telemetry/     track.ts
    dev/           checklists.ts — the per-milestone human gate checklists rendered on /dev
  components/      The React / three.js host layer.
    game/          GameClient.tsx (the R3F scene + frame loop), CatchResultCard.tsx
    pwa/           SW registration, update prompt, offline status
    tune/, dev/    /tune and /dev clients
  app/             Next.js App Router routes: /, /game, /journal, /tune, /dev (+ /dev/caught, /dev/share)
```

**Dependency direction is one-way: `components` → `game`, never the reverse.** Everything under `src/game/` is plain TypeScript that runs headless — state machines, physics, tuning, persistence, audio graph construction — which is what makes it unit-testable under `node --test` without a DOM or a renderer. The Zustand stores live in `src/game/` (zustand has no React dependency at the store level); React components subscribe to them but the game logic never imports a component.

## The tuning table

`src/game/tuning/tuning.ts` is the single home for every constant that shapes feel — the no-magic-numbers rule (`14_DO_NOT_BUILD`) extended to visuals. One `as const` object, sectioned:

```
TUNING.seed         default daily-seed suffix
TUNING.session      session id formatting
TUNING.world        pond geometry, cast range/spread, fishable band, reveal distances, rod anchor
TUNING.visual       water/void/fog colours, caustics, backdrop placement, moon
TUNING.input        drag thresholds, cast arc, twitch, focus
TUNING.line         Verlet segment count, damping, sag
TUNING.lure         sink rate, ripple radii, bite tug animation
TUNING.fish         radii, speeds, state durations, cue cadence, reveal thresholds
TUNING.tension      fight model: rise/decay rates, snap thresholds, surge bursts
TUNING.gear         rod/lure multiplier tables (every default field 1.0)
TUNING.timing       unit conversions, shared durations
TUNING.performance  FPS floors, DPR degrade/recover holds, ripple sweep cadence
TUNING.audio        synth frequencies, gains, loop parameters
TUNING.haptics      vibration patterns
TUNING.ui           overlay sizing
```

If a change needs a new number, it goes here — never inline. `/tune` renders this table live in dev, which is how feel constants get adjusted on a phone without redeploying.

## The two state machines

Both are hand-rolled discriminated unions — no library. Each state carries exactly the data that state needs.

### Game (`src/game/state/gameStateMachine.ts`)

```
splash ──tap──▶ scouting ──drag──▶ aiming ──release──▶ casting
                   ▲                                      │ splash-down
                   │                                      ▼
                   │                          lure_idle ⇄ rod_control
                   │                               │  (drag the rod to work
                   │                               │   the lure without recasting)
                   │                               │ fish bites
                   │                               ▼
                   │                          bite_window ──tap in window──▶ hooked
                   │                               │ window lapses                │ land / snap /
                   │                               ▼                              │ escape
                   │                          lure_idle (missed)                  ▼
                   └────────── cast again ◀─────────────────────────────────── result
```

`result` carries `outcome: 'catch' | FailureKind` (`missed_early | missed_late | snap | escape | no_bite`), the story text, and — on a catch — a `ResultCatch` (species, size, lure, fight stats) that feeds the trophy screen and the journal.

### Fish (`src/game/fish/fishStateMachine.ts`)

```
wander ──lure in notice radius──▶ notice ──▶ approach ──▶ inspect ──▶ commit ──▶ bite
   ▲                                                                              │
   │                                  bite window untaken                         │ hook set
   │                                       │                                      ▼
   └────────── flee (timed) ◀──────────────┘                                   hooked ──stamina
                  ▲                                                               │     drained
                  │  lure moved inside fear radius                                ▼
                  └── (spooks wander / notice / approach / inspect)            landed
```

`updateFish(input, snapshot) → snapshot` is a pure function: it takes the lure position, whether the lure moved, the hooked flag, an RNG, and the equipped lure's attract/fear multipliers, and returns the next snapshot. Species tuning and per-fish personality scale every radius, speed, and hesitation. The same function drives the catchable fish and the four decor fish (decor get `lurePos: null` and neutral gear multipliers, so they swim and emit cues but ignore the lure — until a cast lands nearer to one of them, which promotes it to primary).

## The runtime-ref contract

This is the load-bearing pattern in `GameClient.tsx`:

- **Per-frame simulation truth lives in a single mutable `Runtime` object held in a React ref** (`GameClient.tsx`, the `Runtime` type around line 44): game state, fish snapshot, decor fish, lure position/velocity, Verlet line, tension, RNG, gear ids, aim target/spread, FPS samples, pixel-ratio degradation state.
- **The runtime is mutated only inside the `useFrame` tick** (plus input handlers, which write intent fields like `aimTarget`, `reelPulseUntil`, `focusUntil` for the next tick to consume). Nothing else writes it.
- **React reads projections, not the runtime.** The Zustand `gameStore` holds cheap snapshots — `gameState`, `fishState`, `tension`, `lureState`, `debugMetrics` — and overlay components subscribe to those.
- **The store is updated at state-kind transitions, not per frame.** A 60Hz `set()` on every field would re-render the React tree every frame; instead `setGameState` fires when the kind changes (cast lands, bite opens, hook sets, result shows), and the per-frame visuals (fish meshes, lure, line) are written directly to three.js objects via refs.

If you add simulation state, it goes on `Runtime`. If you add UI that needs to see it, project it through the store or the overlay snapshot — never read the ref from a component render.

## Frame pipeline order

One `useFrame` tick (`GameClient.tsx` ~1246–1677), in order:

1. **Gates** — bail if not started, restoring, or `pondFrozen` (explainer open).
2. **Per-state update** — `casting`: lerp the lure along the arc, splash-down promotes the nearest fish and transitions to `lure_idle`. `lure_idle`/`rod_control`: sink the lure (lure gear sink multiplier), run rod-control pull. `bite_window`: tug animation, blend lure toward the fish mouth. `hooked`: resolve the tap-reel pulse, `updateFight` (tension, snap/escape/land outcomes).
3. **Cues** — the primary fish's real cue (identity-free generic cue while far, species cue when near — `cueForReveal`, 21_THE_REVEAL) and randomized false cues.
4. **Bite window close / late-hook miss.**
5. **Fish AI** — `updateFish` for the primary (with equipped-lure attract/fear), then `updateHookedContactPoint`; a `bite` transition opens the bite window. Then the decor fish loop (neutral input) with their own ambient cues.
6. **Fish visuals** — per-mesh position, the reveal crossfade (species silhouette × `reveal` vs generic smudge twin × `1 − reveal`, size lerped on the same gradient), distance visibility, facing slerp.
7. **Lure mesh**, then **Verlet line** (`updateVerletLine` between rod tip and lure).
8. **Screen projections** — line points, rod tip (with aim-sway lean), lure, and the aim ellipse (four cardinal points of the real landing disc projected to screen → `aimRingRx/Ry`).
9. **Ripple sweep** (throttled GC of expired ripple meshes), then **store/overlay commits** — `setOverlay`, `setFishState`, `setTension`.
10. **Audio loops** — `audio.updateLoops(tension, …)`.
11. **Performance** — FPS sampling and the pixel-ratio degrade/recover ladder (`07_PERFORMANCE_BUDGET`), debug metrics.

## Persistence and determinism

Three stores, three lifetimes:

| Store | Where | Key / lifetime |
| --- | --- | --- |
| `catchJournal.ts` | localStorage | `reelmobile.journal.v1` — append-only catches (schema per `15_TELEMETRY_AND_SESSION`), `schemaVersion: 1` validated on read, dedupe by catch id, capped at 500 (oldest roll off), plus totals (casts/sessions/firstSessionAt). SSR-guarded; all writes try/catch (private mode is non-fatal). |
| `gearStore.ts` | localStorage | `reelmobile.gear.v1` — the rod/lure selection; invalid ids fall back to defaults. |
| `sessionStore.ts` | in-memory Zustand | One `Session` per page load: seed, device caps, casts, catches, failures, perf counters. `recordCatch`/`recordCast`/`startSession` also forward into the journal — the session is the telemetry unit, the journal is what survives. |

**Determinism:** all gameplay randomness flows through `seededRandom(seed)` (`src/game/math/vec.ts`). The `/game` seed is `?seed=` if present, else `dailySeed()` (the ISO date + a suffix — everyone fishes the same pond on the same day). Sub-systems derive namespaced seeds (`${seed}-spawn-${n}`, `'m2-reeds'`, …) so visuals and spawns are reproducible per seed. Cast scatter is hashed from the release point, so the same drag always lands the same.

## PWA

- `scripts/generate-sw.mjs` runs on `predev`/`prebuild` and writes `public/sw.js`. The cache version is a content hash folding in the precache URL list, each asset's bytes, and the deploy's commit SHA (`VERCEL_GIT_COMMIT_SHA`) — so every deploy byte-changes the worker, which is what triggers the in-app update prompt.
- **Precache on install:** the shell (`/`, `/game`, manifest, icons) plus everything under `public/assets/` and `public/images/`. Per-URL fetch with failure tolerance (a 404 asset can't block install).
- **Fetch strategy:** HTML is network-first with cache fallback (falling back to the nearest shell entry, so `/game?seed=abc` boots offline); static assets (`/assets/`, `/images/`, `/_next/static/`) are cache-first; `/api/` bypasses the SW entirely.
- The client side lives in `src/components/pwa/` — registration, the skip-waiting update prompt, and offline status.

## Where a change goes

- **A new feel constant** → `tuning.ts`, then read it where needed. Never an inline literal.
- **New simulation state** → a field on `Runtime`, mutated only in `useFrame` or an input handler.
- **New UI that reflects sim state** → project it through `gameStore` (on transitions) or the per-frame `overlay` snapshot; never read the runtime ref in a render.
- **New fish behaviour** → `fishStateMachine.ts`, keeping `updateFish` pure (inputs in, snapshot out) so it stays headless-testable and shared between primary and decor fish.
- **A new catch attribute** → `ResultCatch` (game state) + `Catch` (sessionStore/journal). Flat attributes only — never a completion grid (`22_THE_GEAR`).
- **A new asset under `public/assets/`** → nothing else to do; `generate-sw.mjs` picks it up and re-versions the worker on the next build.
