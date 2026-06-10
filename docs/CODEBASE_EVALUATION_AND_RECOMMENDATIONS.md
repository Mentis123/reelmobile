# Reel Mobile — Comprehensive Codebase Evaluation & Recommendations

**Date:** 2026-06-10
**Scope:** Full repository — architecture, game systems, correctness, performance, state management, audio, persistence, UI/UX, accessibility, CSS, PWA/service worker, build/deploy, security, testing, documentation, process, and game design.
**Method:** Four parallel deep-review passes (architecture/game systems, UI/UX/frontend, PWA/build/testing, spec-vs-implementation alignment) plus direct verification of every load-bearing claim against the working tree, and a full run of the project's quality gates.

---

## 0. Executive Summary

Reel Mobile is a **remarkably well-crafted codebase** for what it is: a mobile-web fishing-feel experiment built around a single emotional north star ("I saw something move… I nearly snapped the line… I want to do that again"). The architecture is genuinely good — pure, framework-agnostic game modules under `src/game/`, discriminated-union state machines, a centralized tuning table, deterministic seeded RNG, an exemplary hand-rolled service-worker generator, and a disciplined design-doc ("goalpack") culture that the implementation actually follows, including the prohibitions in `14_DO_NOT_BUILD.md`.

The headline problems are concentrated, not diffuse:

1. **`GameClient.tsx` is a 3,219-line god component** — roughly a third of all source code in one file, and the single biggest threat to the project's future velocity.
2. **Test coverage is effectively zero** for everything that matters: one trivial unit test (tag naming) and two Playwright smoke specs cover ~10,800 lines of game logic. The physics, fish AI, tension/fight model, and persistence layers — the heart of the game — have no tests at all. There is also **no CI pipeline**.
3. **Timing and frame-rate correctness debt**: mixed `Date.now()`/`performance.now()` time bases inside the game loop (7 vs 30 call sites in GameClient), no fixed-timestep simulation, and dt-free damping terms in both the verlet line and fish movement — the game literally feels different at 120 Hz than at 60 Hz.
4. **Per-frame allocation and re-render churn**: the verlet update allocates a fresh point array every frame, `setGameState`/`setTension`/`setOverlay` push new objects through Zustand/React state at 60 Hz, and the line overlay re-renders an SVG polyline every frame.
5. **Process drift**: per `13_CHECKPOINTS.md`, work should pause at human-approved tags; instead four unreviewed candidate stages have stacked on `main` since `v0.2-pond-approved`. The README still says "not yet playable," and cruft (`helloworld.txt`, `CODEX_REELMOBILE_HANDOFF.md`, a 1.6 MB unused mascot PNG) has accumulated.

**Quality gates as of this evaluation:** `tsc --noEmit` ✅, `next lint` ✅, unit tests ✅ (1/1), production build ✅. Route sizes: `/game` is 236 kB route / **340 kB first-load JS** (three.js dominates); all other routes are ≤106 kB first-load.

**Overall assessment: 8.5/10.** Production-quality implementation of a thoughtfully designed game, held back by a monolithic main component, a near-empty test suite, and timing/allocation debt in the hot loop.

---

## 1. What Is Done Exceptionally Well (Preserve These)

Before the critique, the things that should be explicitly protected during any refactor:

- **Module layering.** `src/game/**` (math, physics, fish AI, tuning, audio, persistence, share, telemetry) is pure TypeScript with no React imports. Dependency direction is clean: components depend on game modules, never the reverse. This is the right shape and most teams fail to achieve it.
- **Discriminated-union state machines.** Both `gameStateMachine.ts` and `fishStateMachine.ts` model state as tagged unions (`{ kind: 'hooked'; stamina; slackMs; … }`), making illegal states unrepresentable. `updateFish()` is a pure function of `(input, snapshot) → snapshot` — eminently testable (which makes the absence of tests sting more).
- **The tuning table.** `src/game/tuning/tuning.ts` (557 lines) centralizes every gameplay constant with *why*-comments explaining co-tuning relationships (e.g., `fishCueOpacity` vs `waterDeep`). Almost no magic numbers leak into logic. The `/tune` route exposing constants is a great touch.
- **Deterministic, seeded gameplay.** Seeded RNG (`seededRandom` in `vec.ts`) flows through fish spawning, cues, and cast scatter — same seed, same pond. This supports reproducible testing and replay.
- **The service-worker generator.** `scripts/generate-sw.mjs` derives the cache version from a content hash of the precache list plus the Vercel commit SHA, precaches with per-asset fetch-and-skip-4xx (so one flaky asset can't brick install), uses network-first for HTML with a layered shell fallback (`exact path → /game → /`), and cleans old caches on activate. This is better than most workbox configs.
- **Persistence discipline.** `catchJournal.ts` and `gearStore.ts` have SSR guards, `schemaVersion` validation, try/catch on every read/write, ID-based dedupe against double-recording, and a bounded history (500 entries). Exactly right for localStorage.
- **Mobile-web hardening.** `100dvh`, `env(safe-area-inset-*)` with `max()` fallbacks everywhere, `touch-action: manipulation`, `overscroll-behavior: none`, `viewportFit: 'cover'`, gesture/zoom suppression, WebGL context-loss handlers, audio unlocked on user gesture, adaptive DPR degradation (2 → 1.5 → 1 with hysteresis and telemetry). The `06_MOBILE_WEB_CONSTRAINTS.md` checklist was actually implemented.
- **Game-feel feedback stack.** Every meaningful event fires sound + haptic + visual in concert (hookset: thunk + vibration + dual ripples). Failure aesthetics per `11_FAILURE_AESTHETICS.md` are fully realized with distinct copy, audio, and haptics per outcome.
- **Spec fidelity.** The goalpack (23 docs) is exceptional technical writing, and the implementation tracks it closely — including honoring every prohibition in `14_DO_NOT_BUILD.md` (no XP, no tiers, no dailies, no leaderboards). DEVLOG claims were spot-checked against code and found honest.

---

## 2. Architecture

### 2.1 [CRITICAL] Decompose `GameClient.tsx` (3,219 lines)

`src/components/game/GameClient.tsx` contains the splash flow, the entire game loop (`useFrame`), input handling, the 3D scene (water, sky, moon, treeline, fish meshes, ripples, rod/reel), the SVG overlay (line, aim reticle, tension bar, cue prompts), gear selection UI, the debug HUD, procedural texture generation, and performance management. It holds 11+ `useState`s, 15+ refs, and 10+ effects.

This is the project's largest liability: it is untestable in isolation, every change risks unrelated regressions, and any contributor (human or AI) must load ~3.2k lines of context to change anything.

**Recommended decomposition** (preserve the runtime-ref pattern; this is file splitting, not a rewrite):

```
src/components/game/
├── GameClient.tsx          // orchestration + composition only (~200 lines)
├── useGameRuntime.ts       // runtime ref creation, reset, cast/fight logic
├── useGameInput.ts         // pointer handlers, gesture suppression
├── GameScene.tsx           // <Canvas> contents: water, fish, lure, ripples
├── scene/textures.ts       // createSkyTexture, createMoonTexture, silhouettes
├── GameOverlay.tsx         // SVG line, aim reticle, tension bar, cue prompt
├── GearSelect.tsx          // gear strip + explainer dialog
├── DebugHud.tsx            // debug metrics panel
└── ResultLayer.tsx         // CatchResultCard wrapper + focus management
```

Similarly, split `globals.css` (1,268 lines) into `splash.css`, `game.css`, `journal.css`, `dev.css` (or CSS modules per component) — the custom-property palette in `:root` stays global.

**Priority: P0 — do this before any further feature work.** Each extraction is mechanical and independently verifiable by the existing e2e smoke tests.

### 2.2 [HIGH] The mutable `runtime` ref needs a documented contract

The per-frame world state lives in a mutable ref mutated inside `useFrame`. This is the right performance call, but it is an undocumented escape hatch: nothing prevents a future effect or handler from mutating it outside the frame callback, and there is no read-only snapshot boundary between "simulation truth" (the ref) and "UI projection" (Zustand). When you extract `useGameRuntime.ts`, write the contract at the top: *all mutation happens inside the frame tick; React reads only via the store projections; the store is updated only at state-kind transitions or at a throttled cadence.*

### 2.3 [MEDIUM] Add error boundaries

There is no `src/app/error.tsx`, no `global-error.tsx`, and no error boundary around the Canvas. A render-time throw anywhere in GameClient (e.g., a WebGL initialization failure on an old device) currently white-screens the app. Add:
- `src/app/error.tsx` with a themed "the pond glitched — tap to recast" recovery UI,
- an error boundary around `<Canvas>` specifically, falling back to a "this device can't run the pond" message, since WebGL failures are the most likely production crash.

### 2.4 [LOW] Consolidate the duplicate seeded RNG

There are two seeded-RNG implementations: `seededRandom` in `src/game/math/vec.ts` (FNV-1a init + LCG) and a simpler `seededRng` in `src/game/fish/trophy.ts`. Keep the `vec.ts` one, delete the other, and re-export it from a `src/game/math/rng.ts` so the math module doesn't become a grab bag.

---

## 3. Correctness & Timing

### 3.1 [HIGH] Unify the time base: `performance.now()` only inside the simulation

GameClient mixes `Date.now()` (7 call sites) and `performance.now()` (30 call sites) for game timing. `Date.now()` is wall-clock: it jumps on NTP sync, timezone/DST handling, and OS clock adjustment — mid-fight, that can instantly expire a bite window or a `lateHookUntil` deadline. Rule: **simulation and state-machine timing uses `performance.now()` exclusively; `Date.now()` is reserved for persistence timestamps** (`Catch.at`, `Session.startedAt`), which are correctly wall-clock. This is a small, mechanical fix; do it before the decomposition so the new modules inherit the clean convention.

### 3.2 [HIGH] Frame-rate-dependent damping (verlet line and fish movement)

Two integrators apply damping as a raw per-frame multiplier, not normalized by dt:

- `verletLine.ts` (~line 36): `velocity = (pos - prev) * lineDamping` — at 120 Hz the line loses energy twice as fast per second as at 60 Hz. iPhone ProMotion devices (the primary target!) will feel a stiffer, deader line than 60 Hz devices.
- `fishStateMachine.ts` (~line 180): `velocity = add(scale(fish.velocity, TUNING.line.lineDamping), scale(desired, dt))` — same issue, and note it **reuses the fishing-line damping constant for fish movement**, coupling two unrelated feel parameters. Tuning the line will silently change how fish swim.

**Fix:** either (a) normalize damping per-frame: `effective = Math.pow(damping, dt * 60)`, or (b) adopt a fixed-timestep accumulator (see 3.3), which makes raw multipliers correct by construction. Either way, give fish their own `TUNING.fish.velocityDamping` constant.

### 3.3 [MEDIUM] Adopt a fixed-timestep simulation loop

The whole simulation (fish AI, verlet, tension/fight) runs on variable `dt` from `useFrame`. Beyond the damping bug above, this breaks cross-device determinism for a game that is otherwise carefully seeded-deterministic, and a single long frame (GC pause, tab switch back) delivers a huge dt that can tunnel through bite windows. Standard fix:

```ts
const STEP = 1 / 60;
accumulator += Math.min(dt, 0.25);   // clamp runaway frames
while (accumulator >= STEP) {
  stepSimulation(STEP);              // fish, verlet, tension
  accumulator -= STEP;
}
// render interpolation optional; at 60Hz step it's imperceptible
```

This also makes simulation unit tests trivial: `for (let i = 0; i < 600; i++) stepSimulation(STEP)` is ten deterministic seconds.

### 3.4 [LOW] Small hardening items

- `verletLine.ts`: `lineConstraintIterations: 0` in tuning would silently disable the solver — clamp with `Math.max(1, …)` or document the invariant next to the constant.
- `species.ts` `pickSpecies()`: the weighted roll falls through to a hardcoded fallback; compute `TOTAL_SPAWN_WEIGHT` once at module scope and return the last species explicitly when the loop exhausts, so a future zero/negative weight can't bias silently.
- `fishStateMachine.ts` `updateFish()` (116 lines, 8 branches) deserves a state-diagram docblock: `wander → notice → approach → inspect → commit → bite → (hooked | flee)`, `hooked → landed`, `flee → wander`.

---

## 4. Performance

The adaptive-DPR system, ripple sweep throttling, and texture memoization are excellent. The remaining issues are allocation and re-render churn in the 60 Hz path:

### 4.1 [HIGH] Per-frame allocations in the hot loop

- **`updateVerletLine()` allocates a new array plus ~11 new point objects and ~22 vec literals every frame**, and the constraint solver allocates delta/correction objects per segment per iteration (4 iterations × 10 segments). That's hundreds of short-lived objects per frame → GC pressure → exactly the stutters the DPR degradation system then tries to paper over. Convert to in-place mutation over a preallocated buffer (the function already owns its data; immutability buys nothing here), or flat `Float64Array`s for x/z.
- **`linePoints` screen-projection array** is rebuilt with fresh objects every frame before `setOverlay`. Reuse a buffer.
- **Ripple objects** are allocated per event and the ripples array is re-spread on every addition. Fine at current volumes, but a small object pool would eliminate it; lower priority than the line.

### 4.2 [HIGH] 60 Hz `setState` through Zustand/React

Every frame calls `setGameState`, `setFishState`, `setTension`, `setOverlay`, and `setRodOffset`. `gameState`/`fishState` carry per-frame counters (`sinceMs`), so even "unchanged" states are new objects — every subscriber re-renders at 60 Hz. Recommendations:

- Push `gameState`/`fishState` to the store **only when `.kind` changes** (the HUD and overlays key off kind, not off `sinceMs`).
- Throttle `tension` updates to ~10–15 Hz or on |Δ| > 0.01 — the tension bar is a CSS-rendered element; 60 Hz React updates are wasted.
- Longer-term: render the line, reticle, and tension bar **inside the WebGL canvas or via direct DOM mutation from the frame loop** (write `style.transform`/`stroke-dashoffset` on refs), bypassing React reconciliation entirely for per-frame visuals. The SVG-polyline-through-React-state approach is the single largest main-thread tax after the allocations.

### 4.3 [MEDIUM] Per-ripple `useFrame` subscriptions

Each `WaterRipple` registers its own `useFrame` callback. With N live ripples that's N callbacks per frame plus re-registration churn. Animate all ripples in one pass in the scene's main frame callback, writing to mesh/material refs.

### 4.4 [MEDIUM] Bundle: 340 kB first-load on `/game`

three.js + @react-three/fiber are used in exactly one file. The scene uses planes, sprites, and canvas textures — no GLTF, no complex materials. Options, in increasing effort: (a) accept it (it's within the goalpack's 5 MB budget and loads once into SW cache — defensible); (b) ensure `next/dynamic` lazy-loading of GameClient so `/`, `/journal` never pay for it (verify — home is currently 89 kB so this appears right); (c) long-term, this scene is achievable with raw WebGL or even 2D canvas + the existing math module, dropping ~200 kB. Don't do (c) before the feel gate passes; do note it in the roadmap.

### 4.5 [MEDIUM] The 2.1 MB splash PNG is precached on every install/update

`public/images/reel-mobile-splash.png` (2,165,228 bytes) is in the SW precache, dominating install payload (everything else totals ~300 kB). Re-encode it (a dithered WebP/AVIF of this art should land 100–300 kB), or drop it from the precache list and let the runtime cache pick it up on first view.

### 4.6 [LOW] Run the Lighthouse audit

`07_PERFORMANCE_BUDGET.md` mandates Lighthouse ≥80 perf / ≥90 a11y / ≥90 best-practices; no audit is recorded in DEVLOG. The M2 smoke numbers (10 draw calls, 2.7k triangles, ≤9 textures) are comfortably inside budget, so this is likely a quick win — run it, record it, and wire `lhci` into CI (see §8).

---

## 5. Audio

`ProceduralAudio` is idiomatic Web Audio with a clean gain-bus topology (sfx/ambient → master) and correct gesture-gated unlock. Lifecycle gaps:

- **[HIGH] No `visibilitychange` suspend/resume.** Backgrounding the tab leaves the AudioContext running — battery drain, and on iOS it competes with music/calls. Add a document `visibilitychange` listener that calls `ctx.suspend()`/`ctx.resume()`.
- **[MEDIUM] The `lineZip` oscillator is never stopped** — its gain is ramped to 0 but the oscillator runs forever once created. Stop and null it ~100 ms after the gain ramp hits zero, recreating on demand (the lazy-create path already exists).
- **[MEDIUM] No `dispose()` method.** The looping ambient source, lineZip, and reel timer are never torn down; navigating away from `/game` leaks the context. Add `dispose()` (stop sources, clear timer, `ctx.close()`) and call it from the GameClient unmount cleanup.
- **[LOW] Reel-click cadence uses `window.setTimeout`**, which drifts and stalls under main-thread load — exactly when the player is reeling hardest. Schedule clicks on the AudioContext clock (lookahead scheduler pattern) for rock-solid cadence.
- **[LOW] Clamp tuning-supplied gains** to [0, 1] at the assignment sites so a tuning typo can't produce clipping.

---

## 6. State, Persistence & Data

- **[MEDIUM] Differentiate localStorage write failures.** All `setItem` failures are swallowed identically. Distinguish `QuotaExceededError` from private-mode `SecurityError` with a one-line `console.warn` each, and emit a telemetry event — otherwise "my journal disappeared" reports will be undiagnosable.
- **[MEDIUM] Write the v1→v2 migration scaffold now.** `getJournal()` nukes history on any unknown `schemaVersion`. That's correct for garbage, but the first time you legitimately need schema v2, you'll be tempted to ship a breaking change that erases players' journals. Add a `migrate(parsed)` dispatch (even with only the v1 identity case) so the pattern exists.
- **[LOW] Telemetry the journal cap.** When the 500-entry cap rotates entries off, `track({ type: 'journal_rotation' })` — you'll want to know if real players ever hit it.
- **[LOW] Reset store state on session restart** explicitly rather than relying on the next frame to overwrite it.

---

## 7. UI/UX & Accessibility

The interaction design is the strongest part of the product: tri-modal feedback on every event, honest WYSIWYG cast reticle, evocative copy ("The pond is waiting."), correct empty/error states, 44 px tap targets, AA-passing contrast, safe-area handling throughout. Remaining gaps:

### 7.1 [HIGH] `prefers-reduced-motion` coverage is incomplete

Only the splash hint honors it. The cue-prompt pulse, bite-halo pulse, trophy glow, PWA-prompt rise, and the fish fade-breathing animation all ignore it. Add a consolidated reduced-motion block to the CSS, and read `matchMedia('(prefers-reduced-motion: reduce)')` once in GameClient to flatten the programmatic fish-fade and (per the spec's own promise in `06_MOBILE_WEB_CONSTRAINTS.md`) collapse multi-pulse haptics to single pulses.

### 7.2 [HIGH] Screen-reader and focus gaps

- The cue prompt ("Tap!", "Ease off") is purely visual. Add `role="status" aria-live="polite"` to the cue-prompt element — for a canvas game this one line is most of the achievable SR experience.
- The result card is modal-like but takes no focus. On entering `result`, move focus to the card's first action; restore focus to the game root on dismiss; give it `role="dialog"` + `aria-modal`.

### 7.3 [MEDIUM] Touch listener hygiene

The root `touchstart` listener is registered `{ passive: false }` and decides whether to `preventDefault()` via DOM traversal per event. Split it: a passive listener for state tracking, and a non-passive one that early-returns before any traversal unless the target matches the suppression selector. Keeps the compositor unblocked for the 99% case.

### 7.4 [LOW] Polish items

- Add a settings affordance for haptics/audio mute (the spec's M6/M9 already plans this; the session store already records prefs — wire them).
- Remove the redundant `typeof navigator !== 'undefined'` guards around `navigator.vibrate?.()` in client-only code (style only).
- `journal/page.tsx` renders an empty `<main>` during hydration; a skeleton shimmer would remove a flash on slow devices. Minor.

---

## 8. Testing & CI — the largest gap in the project

**Current state:** one unit test (`tag-naming.test.mjs` — tests dev tooling, not the game), two e2e smoke specs, no CI of any kind, no `.github/workflows/`. Meanwhile the most testable code imaginable — pure state machines and physics with seeded RNG — sits untested. The `18_ULTRACODE_PARADIGM.md` amendment explicitly assigns "machine-checkable" verification to the agent; a test suite is the durable form of that, far better than the one-off greps DEVLOG records.

### 8.1 [CRITICAL] Unit tests for the pure core (~30–50 cases, all trivially writable today)

| Module | What to assert |
|---|---|
| `fishStateMachine.ts` | Full ladder traversal under a scripted lure (wander→notice→approach→inspect→commit→bite); spook on lure movement inside fear radius; bite timeout → flee; hooked stamina drain → landed; flee → wander after `fleeDurationMs`; clamped flee targets stay inside the arena |
| `verletLine.ts` | Endpoints pinned after update; segment lengths converge under constraint passes; **same total simulated time at dt=1/30 vs dt=1/120 yields equivalent line shape** (this test fails today — see §3.2 — write it first as the bug's regression test) |
| `species.ts` | Weighted spawn distribution over 10k seeded rolls; personality multiplier bounds [0.58, 1.42]; size-band correctness |
| `catchJournal.ts` / `gearStore.ts` | Round-trip, dedupe-by-id, cap-at-500 rolloff, corrupt-JSON → empty, unknown schema → empty (run under a localStorage stub) |
| `tuning.ts` | Sanity invariants: no negative speeds/durations, `lineConstraintIterations ≥ 1`, gains within [0,1], `revealNoneZ < revealFullZ` |
| `storyGenerator.ts` | Deterministic output per seed; every outcome kind produces copy |

Use the existing `node --test` runner (zero new deps) — pure modules need no React harness. Note: the game modules are `.ts`, so either run via `tsx`/`ts-node` test loader or add a tiny build step; pick whichever keeps `pnpm test` one command.

### 8.2 [HIGH] CI pipeline

```yaml
# .github/workflows/ci.yml — lint → typecheck → unit → build → e2e
```
Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then Playwright against the production build. The repo already has every script; this is a one-file addition. Without it, the human-gate workflow has no machine floor under it — a regression can ride into a candidate tag unnoticed.

### 8.3 [MEDIUM] E2E additions

- **Offline flow:** load `/game`, let the SW install, go offline (Playwright `context.setOffline(true)`), reload, assert the shell serves and a cast completes.
- **SW update flow:** bump `SW_BUILD_TAG`, regenerate, assert the update prompt appears and reload activates the new worker.
- **Persistence:** complete a catch (or seed localStorage), reload, assert `/journal` shows it.
- **Determinism:** same `?seed=` twice → identical first-fish species/position via the debug HUD.

---

## 9. PWA, Build & Deployment

Mostly excellent (see §1). Remaining items:

- **[MEDIUM] iOS home-screen icon.** Only `icon.svg` is declared for `apple` icons; older iOS (≤15) doesn't reliably render SVG apple-touch-icons and will fall back to a screenshot. Ship a 180×180 PNG and declare it with explicit sizes. (Also revisit `purpose` coverage in the manifest while there.)
- **[MEDIUM] Security headers.** `next.config.mjs` sets none. Add `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or `frame-ancestors`), `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP (this app needs no third-party origins, so a tight CSP is cheap — note `'unsafe-inline'`/`'unsafe-eval'` needs verification against Next.js runtime and the canvas-texture code before enforcing; start with `Content-Security-Policy-Report-Only`).
- **[LOW] Gate or remove `/api/dev-info`.** It returns the server's LAN IPv4 and port to any caller in production. The data is low-sensitivity (and on Vercel the interface IP is meaningless), but it has no production purpose: return 404 unless `NODE_ENV === 'development'`. Better: derive the QR URL client-side from `window.location` and delete the route.
- **[LOW] Runtime cache growth.** `RUNTIME_CACHE` persists across deploys and accrues an entry per unique URL (`/game?seed=…` variants). Add an LRU trim (cap ~50 entries) in the fetch handler, or strip search params from the cache key for HTML.
- **[LOW] Stale-shell skew documentation.** Network-first HTML + cache-first assets means an offline client on an old shell whose hashed chunks were evicted gets a broken page until it's back online. Rare and self-healing, but worth a paragraph in the docs plus the SW version comment already embedded — consider a startup version-skew check that surfaces the existing update prompt.
- **[LOW] `generate-sw.mjs` failure messaging.** A missing `public/assets` fails the whole build with a bare stack; add a hint line to the `main().catch` handler.

---

## 10. Documentation, Process & Hygiene

### 10.1 [HIGH] Re-establish checkpoint discipline

Per `13_CHECKPOINTS.md`, `*-approved` tags are the human gate and the rollback anchors. Reality: four candidate stages (`v0.3` … `v0.4-far-water` + chapters 5–8) have stacked on `main` since `v0.2-pond-approved`, with `buildInfo.ts` hardcoding `v0.4-far-water-candidate`. (Note: no tags are visible in this clone at all — if that's true at origin and not a clone artifact, the rollback procedure documented in DEVLOG is currently unexecutable; verify and re-push tags.) The work itself looks ship-quality; the *process state* is the issue. Either hold the line — run the 8-item `/dev` checklist on a real iPhone, mint `v0.4-far-water-approved`, and resume staged development — or amend `13_CHECKPOINTS.md` to honestly describe the batched-gate model now being practiced.

### 10.2 [MEDIUM] Fix doc drift and delete cruft

- `README.md` says "Pre-Phase-A. Not yet playable." — false for over a month; rewrite with current state, route map, and a screenshot.
- Delete `helloworld.txt` (literally "hello world").
- Delete `CODEX_REELMOBILE_HANDOFF.md` (references a dead OneDrive path and a completed one-off task).
- Delete or relocate `reelmobile-surprise-mascot.png` (1.6 MB at repo root, referenced by nothing).
- `GOAL_COMMAND.md` / `RUN_THIS_FIRST.md`: fold into README or a `docs/workflow.md`.

### 10.3 [MEDIUM] Add the two missing docs that matter

- **`docs/ARCHITECTURE.md`** — one page: module map, the runtime-ref ↔ store contract (§2.2), both state-machine diagrams, frame pipeline order (input → fish → verlet → tension → projections → store). This plus the goalpack is full onboarding.
- **`docs/VALIDATION.md`** — how to run the device gate: debug HUD flags, Lighthouse procedure, the per-milestone checklist location, how to read draw-call counts. `12_VALIDATION.md` covers the *what*; this is the *how*.

---

## 11. Game Design Observations

(From the spec-alignment review; the feel verdict itself belongs to the human iPhone gate, as the goalpack rightly insists.)

- **The spotting wedge is the game.** Ambiguous cues + 20–30% seeded false positives + species cue signatures create real decisions before any physics runs. Protect its unpredictability — it is the long-tail retention mechanism, and the *only* one, by design.
- **The Reveal (Ch. 21) is the best idea in the goalpack** — size/shape/cue resolving spatially as the fish nears is a per-catch suspense engine that costs no content. The v2 implementation (generic smudge crossfade, cue genericization below the reveal threshold) is complete and elegant.
- **Watch the tap-cadence reel.** The last six commits soften per-tap tension and speed recovery — healthy iteration, but tap-cadence risks turning a tense *hold-and-judge* fight into a rhythm tapper, and it stretches fight duration, which presses on the 5–10-minute session target. This is the single most important question for the v0.4 gate; consider keeping the hold-to-reel variant behind a tuning flag for A/B on device.
- **Gear is correctly invisible-until-wanted.** Sidegrades with honest tradeoffs (short rod: tighter spread, weaker line) and no progression ladder — exactly per `22_THE_GEAR.md`. Don't let future contributors "fix" the absence of upgrades.
- **Retention is intentionally feel-load-bearing.** With dailies/streaks/completion grids prohibited, everything rides on loop tightness + journal + share. That's a coherent premium-game bet; the share card (canvas-rendered, `navigator.share` with download fallback) is the growth loop — make sure the card art is strong enough to be the de facto marketing asset.

---

## 12. Prioritized Action Plan

**P0 — before any new feature work**
1. Decompose `GameClient.tsx` per §2.1 (and split `globals.css`).
2. Unit-test the pure core + add the CI workflow (§8.1, §8.2) — write the dt-invariance test first.
3. Unify on `performance.now()` in the simulation (§3.1).

**P1 — correctness & feel integrity**
4. Fix dt-dependent damping; give fish their own damping constant (§3.2). Then run the human iPhone gate on v0.4 and mint the approved tag (§10.1).
5. Fixed-timestep accumulator (§3.3).
6. Eliminate hot-loop allocations: in-place verlet, reused projection buffers (§4.1).
7. Throttle store updates to kind-changes / ~10 Hz; move per-frame visuals off React state (§4.2).
8. Audio lifecycle: visibility suspend/resume, `dispose()`, stop `lineZip` (§5).
9. Reduced-motion coverage + cue-prompt live region + result-card focus (§7.1, §7.2).

**P2 — production hardening**
10. Security headers + gate `/api/dev-info` (§9).
11. Error boundaries (§2.3).
12. Re-encode/de-precache the 2.1 MB splash; add 180 px apple-touch-icon (§4.5, §9).
13. Offline/update/persistence e2e tests (§8.3); run and record Lighthouse (§4.6).
14. localStorage error differentiation + migration scaffold (§6).

**P3 — hygiene & docs**
15. Delete cruft; rewrite README; add ARCHITECTURE.md and VALIDATION.md (§10.2, §10.3).
16. Consolidate RNG; tuning-table extraction of `trophy.ts` composition ratios; state-machine docblocks (§2.4, §3.4).
17. Settings UI for haptics/audio (§7.4); runtime-cache LRU (§9).

---

## 13. Closing Assessment

This codebase reads like it was built by someone who has shipped games before: the feel-first priorities, the tuning-table discipline, the refusal to add systems the design doesn't need, and the mobile-Safari battle scars are all real. The flaws are the classic flaws of fast solo iteration — one file that ate the project, tests deferred until "after the feel is right," and a process ledger that drifted from practice.

None of the P0/P1 items threaten the design; they protect it. The dt-damping fix in particular is not a refactor nicety — it is a *feel correctness* bug on the exact device class (ProMotion iPhones) the entire goalpack is aimed at. Fix the clock, fix the damping, split the file, put tests under the state machines, and this project is in genuinely excellent shape to pass its gate and grow.
