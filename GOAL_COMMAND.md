# GOAL_COMMAND.md

The exact `/goal` prompt to run against this repo.

---

## Phase A — Run this first

Paste this into Codex CLI from the repo root. Do not modify it.

```
/goal Execute a controlled experiment to prove that Reel Mobile's fishing loop feels good on mobile Safari, then stop for human review.

Read in order before coding:
- AGENTS.md
- docs/goalpack/00_OVERVIEW.md
- docs/goalpack/01_GAME_SPEC.md
- docs/goalpack/02_EXPERIMENT_PLAN.md
- docs/goalpack/03_IMPLEMENTATION_PLAN.md
- docs/goalpack/04_SPOTTING_AND_PERCEPTION.md
- docs/goalpack/05_PHYSICS_AND_FEEL.md
- docs/goalpack/06_MOBILE_WEB_CONSTRAINTS.md
- docs/goalpack/07_PERFORMANCE_BUDGET.md
- docs/goalpack/08_ART_DIRECTION.md
- docs/goalpack/09_ASSET_GENERATION.md
- docs/goalpack/10_AUDIO_HAPTICS.md
- docs/goalpack/11_FAILURE_AESTHETICS.md
- docs/goalpack/12_VALIDATION.md
- docs/goalpack/13_CHECKPOINTS.md
- docs/goalpack/14_DO_NOT_BUILD.md
- docs/goalpack/15_TELEMETRY_AND_SESSION.md
- docs/goalpack/16_HUMAN_GATES.md
- docs/goalpack/17_RESEARCH_NOTES.md

Build only Phase A: Milestone 0 (shell + /dev page) and Milestone 1 (vertical slice).

Milestone 0 requires:
- Next.js App Router + TypeScript + pnpm scaffold
- Vercel-ready deploy config
- /, /game, /tune, /dev routes
- /dev page shows local IP, QR code, current candidate tag, manual checklist for current milestone
- pnpm typecheck && pnpm lint && pnpm build all pass
- Commit and tag v0.0-shell-candidate

Milestone 1 requires (full vertical slice):
- Mobile-first portrait layout with Tap-to-begin splash per 06_MOBILE_WEB_CONSTRAINTS.md
- Grey-box pond (3D water plane, dock, fixed cinematic camera, no orbit)
- One visible-but-ambiguous fish using cue system per 04_SPOTTING_AND_PERCEPTION.md (shadow + occasional ripple)
- One lure with splash, sink, twitch behaviour
- Drag/release casting with parabolic arc and dotted preview
- Verlet rope line with 10 segments per 05_PHYSICS_AND_FEEL.md
- Hand-rolled TypeScript discriminated union for game state and fish state machines
- Hook event with bite window, three failure modes per 11_FAILURE_AESTHETICS.md
- Tension system visible in line + rod bend + splash intensity
- Procedural Web Audio sounds (oscillators + filtered noise) for all events in 10_AUDIO_HAPTICS.md
- Result screen with story-style copy via storyGenerator
- Debug HUD (toggle with two-finger tap or ?debug=1) showing FPS, draw calls, game state, fish state, tension, seed, pixel ratio
- /tune page with hot-reloadable constants from src/game/tuning/tuning.ts
- WebGL context loss + restore handlers
- iOS Safari touch protections (touch-action, user-select, -webkit-touch-callout, preventDefault on touchstart)
- Pixel-ratio degradation logic per 07_PERFORMANCE_BUDGET.md
- Telemetry track() hook called for every event in 15_TELEMETRY_AND_SESSION.md (console.log only for now)
- Commit and tag v0.1-vertical-slice-candidate

Hard rules:
- All feel constants live in src/game/tuning/tuning.ts. No magic numbers in gameplay code.
- Never create *-approved tags. Only humans create those.
- Do not delete tags. Do not force-push.
- Do not add anything from 14_DO_NOT_BUILD.md.
- Run pnpm typecheck && pnpm lint && pnpm build before declaring any milestone complete.
- If a validation check fails twice on the same milestone, stop, write the failure to DEVLOG.md, and ask for review.
- If image generation is unavailable, continue Phase A with grey-box only and record the missing capability in DEVLOG.md. Do not attempt Phase B.
- Update DEVLOG.md after each milestone with: Shipped / Cut / Discovered / Next.

After v0.1-vertical-slice-candidate is tagged, STOP.
Do not begin Phase B. Output a summary of what shipped and request human review on a real iPhone.
```

---

## Phase B — Run only after `v0.1-vertical-slice-approved` exists

```
/goal Continue Reel Mobile build into Phase B per docs/goalpack/03_IMPLEMENTATION_PLAN.md.

The human has tagged v0.1-vertical-slice-approved, confirming the vertical slice passed manual iPhone validation. Phase A is complete.

Build milestones M2 through M8 sequentially:
- M2: Pond visuals (water shader, depth, reeds, dock detail) → v0.2-pond-candidate
- M3: Fish variety, five species per 01_GAME_SPEC.md → v0.3-fish-variety-candidate
- M4: Lure variants (3) and rod variants (2) → v0.4-gear-candidate
- M5: Catch journal with localStorage per 15_TELEMETRY_AND_SESSION.md → v0.5-journal-candidate
- M6: Audio polish, sourced/generated per 09_ASSET_GENERATION.md → v0.6-audio-candidate
- M7: Share via navigator.share(), PWA manifest, deferred install prompt → v0.7-share-candidate
- M8: Performance pass, validate against 07_PERFORMANCE_BUDGET.md → v0.8-performance-candidate

Apply the tiered placeholder rule from 09_ASSET_GENERATION.md:
- Core art (water, fish, lure, rod, line, primary UI) becomes final by M2
- Decorative art (reeds, rocks, dock detail, distant background, particles) can stay grey-box until later milestones

Same hard rules as Phase A apply. Same stop rules apply. Stop after each *-candidate tag and request human review before proceeding to the next milestone.

Do not skip milestones. Do not combine milestones. Do not create *-approved tags.
```

---

## Notes for the human running these

**Before Phase A:**
1. `git init && git add -A && git commit -m "Initial Goal Pack"`
2. `git tag v0.0-init` (this is the only approved tag the human writes pre-build)
3. Verify Codex CLI has image generation capability if you want it (not required for Phase A)
4. Verify your laptop and iPhone are on the same WiFi for the QR-code workflow

**Between Phase A and Phase B:**
1. `pnpm dev` on laptop, open `/dev`
2. Scan QR with iPhone, play through the 10-question checklist in `12_VALIDATION.md`
3. If 8+ yes: `git tag v0.1-vertical-slice-approved && git push --tags`
4. If <8 yes: write what failed to `DEVLOG.md`, do not approve, re-prompt the agent at the broken mechanic

**During Phase B:**
- Same loop: candidate → real iPhone test → approved tag (or rollback)
- Each milestone is its own gate. Don't batch them.
- If Phase B drifts from the pack, the agent should be reading the pack again, not improvising
