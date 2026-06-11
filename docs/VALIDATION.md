# VALIDATION

How to know a build works. Three layers, per `docs/goalpack/12_VALIDATION.md`: **automated**, **instrumented**, **manual**. All three are required before a milestone moves forward — and only the third one judges the actual game.

## Layer 1 — Automated

Run before declaring any work candidate-complete. All must exit 0.

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test          # Node unit tests: tests/unit/*.test.mjs
pnpm test:e2e      # Playwright smoke tests
```

`pnpm test:e2e` runs against a mobile WebKit viewport and needs the browser installed once:

```bash
pnpm exec playwright install webkit
# On a bare Linux/WSL host you may also need: sudo pnpm exec playwright install-deps
```

The smoke tests cover: `/game` loads without console errors, the tap-to-begin gate appears and dismisses, the canvas renders non-zero pixels, the debug HUD shows with `?debug=1` (FPS > 0, state `scouting`), a simulated drag-release transitions `casting → lure_idle`, no GL errors, and the `webglcontextlost`/`restored` handlers are registered.

Playwright cannot validate feel. Do not trust it for that.

The unit tests exercise the headless layer — everything under `src/game/` is plain TypeScript (state machines, math, physics, persistence) precisely so it can be tested under `node --test` with no DOM or renderer. New game logic should land with a unit test there before it grows a React harness.

## Visual spot-checks (dev-only galleries)

- `/dev/caught` — renders the Caught trophy card for all five species side by side, for checking the fish art and card layout without fishing five times.
- `/dev/share` — renders all five share-card composites the same way.

## The debug HUD

Append `?debug=1` to `/game` (default ON in dev). It shows: FPS (current + 1s/5s averages), draw calls, triangles, texture count, JS heap (where available), game state, fish state, lure state, tension, the RNG seed, and the renderer pixel ratio + degradation level. This is the first thing to read when something looks wrong — confirm the state machines are where you think they are before touching code.

For reproducible runs, pin the pond with `?seed=anything` (otherwise the seed is the daily seed and everyone gets the same pond per calendar day).

## Layer 3 — The human gate (the real one)

**On a real iPhone.** Run `pnpm dev`, open `/dev` on the laptop — it shows the local network URL as a QR code plus the current candidate tag and the manual checklist. Scan with the phone and play.

- The checklists live in `src/game/dev/checklists.ts` and render on `/dev`. Each milestone has its own (M0 shell through the current `far-water` gate); the M1 list needs 8 of 10 yes to approve.
- **Tag discipline** (`docs/goalpack/13_CHECKPOINTS.md`): the agent creates `vN.M-name-candidate` after layers 1+2 pass. Only a human, after passing the on-device checklist, creates `vN.M-name-approved`. The agent never creates approved tags, never deletes tags, never force-pushes. A milestone without an `*-approved` tag is not done, regardless of what `DEVLOG.md` says.

What automation cannot tell you — whether the water feels alive, the cast feels right, the bite is satisfying, the fish behaves believably, the session makes you want to come back — is the actual game. Only humans, only on glass.

## Performance: Lighthouse + budgets

Audit against a **production build**, never the dev server:

```bash
pnpm build
pnpm start
# Chrome → open http://localhost:3000/game
# DevTools → Lighthouse → Mode: Navigation, Device: Mobile → Analyze
```

Targets from `docs/goalpack/07_PERFORMANCE_BUDGET.md` (numeric, falsifiable):

| Budget | Target |
| --- | --- |
| Lighthouse Performance (mobile) | ≥ 80 |
| Lighthouse Accessibility | ≥ 90 |
| Lighthouse Best Practices | ≥ 90 |
| Draw calls per frame | < 50 |
| Triangles in scene | < 100k |
| Frame rate | 60fps on iPhone 13+; 30fps floor on iPhone 11 |
| JS heap | < 200MB (Safari kills tabs ~250MB) |
| Initial JS bundle | < 5MB gzip |

Draw calls, triangles, heap, and pixel ratio are all on the debug HUD — check them live during a fight, not just at the splash screen. The renderer self-degrades pixel ratio when average FPS sits below 30 and recovers above 55; if you see the degradation level climbing on a modern phone, that is a failed budget, not a feature.

If the floor is breached, the milestone fails performance validation. The full performance pass (5-minute on-device session, all numbers logged, no frame over 50ms) is the Chapter 9 finish-line gate.

## Failure protocol

If any layer fails: write the details to `DEVLOG.md`, attempt one fix, and if the second attempt also fails — **stop**. No third attempt. Request human review and do not proceed past the failed milestone.
