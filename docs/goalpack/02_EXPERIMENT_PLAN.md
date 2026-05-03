# 02_EXPERIMENT_PLAN

## Reframe

This is not a build. This is a **controlled experiment** with a hypothesis, a method, and a falsifiable result.

## Hypothesis

> A real iPhone player can read a grey-box pond, cast at a shadow, feel a bite, fight tension, land or lose, and want to cast again — without a tutorial, without text instructions, without polished art.

If this hypothesis fails, no amount of art polish will save the game. If it succeeds, polish multiplies it.

## Phase A — Feel Lab

Goal: prove the hypothesis with the minimum possible build.

**Output:** ugly-but-playable. One pond, one fish, one lure, one cast, one hook, one fight, one result. Grey-box. Procedural audio. Debug HUD on by default.

**Constraints:**
- No final art
- No multiple species
- No journal
- No share cards
- No PWA polish
- No day/night
- No weather
- No upgrades
- No accounts

**Success test (after M1):** human plays on a real iPhone, scores ≥8 of 10 on the manual checklist in `12_VALIDATION.md`.

**If success:** human creates `v0.1-vertical-slice-approved` tag and Phase B begins.
**If failure:** human and agent identify which feel mechanic is broken, agent re-prompts targeted at the failure, no horizontal expansion until Phase A passes.

## Phase B — Beautiful Pond

Only after Phase A is `*-approved`.

**Goal:** scale the proven feel into a polished, playable, shareable experience.

**Order:**
1. Pond visuals (water shader, depth, reeds)
2. Fish variety (5 species per `01_GAME_SPEC.md`)
3. Lure variants (3) and rod variants (2)
4. Catch journal with localStorage
5. Audio polish (sourced/generated)
6. Failure aesthetics polish
7. Share cards via `navigator.share()`
8. PWA install flow
9. Performance pass against `07_PERFORMANCE_BUDGET.md`

Each milestone produces a `*-candidate` tag. Each candidate is gated by a real-iPhone test that produces a `*-approved` tag.

## What "controlled" means

- Fixed inputs: the Goal Pack docs
- Fixed method: milestone-by-milestone, validation-gated, human-tested
- Fixed escape hatches: rollback to prior `*-approved` tag, write to DEVLOG, stop on second failure
- Variable being measured: does the paragraph in `00_OVERVIEW.md` happen?

## Stopping criteria

The experiment **stops** if:
- Validation fails twice on the same milestone
- A dependency choice violates the pack
- Image generation is unavailable (Phase A continues; Phase B halts)
- Performance budget is breached and not recoverable
- The human gate is required and not yet recorded

The experiment **succeeds** when Phase A and Phase B are both `*-approved` and the manual checklist passes on a real iPhone with five different first-time players.
