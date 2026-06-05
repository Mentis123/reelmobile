# 20_ROADMAP

*Planning amendment. Reconciles the drift from `03_IMPLEMENTATION_PLAN`'s M0–M8 list (which assumed a linear gear/journal path) with what actually got built, and sequences the rest. Where this conflicts with `03`'s milestone ordering, this wins. `03`'s per-milestone **content** still stands; only the order and the chapter framing change.*

## Where we are (2026-06-05)

Last **human-approved** state: `v0.2-pond-approved` (+ `v0.1.5-hook-guard-approved`).

Unreviewed candidate stack, all bundled into the current gate:
`v0.3-fish-variety` → `v0.3.1-fish-feel` → `v0.3.2-pond-polish` → **`v0.4-far-water`** (at the iPhone gate now).

**Approving `v0.4-far-water-approved` retires the whole stack** — it is the superset build. That gate is the immediate next action and a precondition for everything below. *Lesson banked: we let four candidates stack unreviewed. From here, one chapter = one candidate = one gate. No new chapter starts while the prior one is ungated.*

### Built vs. the old M-plan
- M0 shell, M1 vertical slice, M2 pond — **approved.**
- M3 fish variety (5 procedural species: Bronze Carp, Moss Bass, Moon Minnow, Old Kingfish, Reed Pike) — built, clears with the far-water gate.
- M4 gear, M5 journal, M6 audio polish, M7 share/install, M8 perf — **not built** (M7 PWA shell partially exists). The v0.4 slot was repurposed for the far-water chapter.

## The forward arc

The remaining work clusters into one coherent emotional arc — *the catch, revealed, named, kept, and shown* — then two separable layers (depth, finish). Sequenced for momentum and dependency, not the old numeric order.

### Chapter 5 — The Catch, Revealed
*The headline payoff of `19_THE_FAR_WATER`, finally closed, fused with the trophy moment.* Two halves of one beat:

1. **The reveal as a knowledge mechanic.** Today distance only hides a fish *visually* (opacity falloff); the cue system still tells you what it is. Make a distant fish's **identity genuinely unknown** — far cues read as movement (wake / roll / smudge), not a named species — and lock species + size until the hooked fish is reeled across into near-water. The gamble of a long cast now carries real stakes: you don't know what you bid on until it's close.
2. **A visible trophy fish on the "Caught" screen.** The result screen resolves the unknown into a **named, seen** fish — the moment of revelation. Build a procedural side-profile "trophy" render per species (see *Asset approach* below) in a reusable `<FishPortrait species>` slot.

Why first: highest leverage on what we just doubled down on, it's what the player wants, and it's the visual foundation the next two chapters reuse.
Tag: `v0.5-the-catch-candidate`.

### Chapter 6 — The Journal
*M5, now that a catch has a face and a name.* localStorage persistence per `15_TELEMETRY_AND_SESSION`, `/journal` route, chronological entries each showing the trophy `<FishPortrait>` + story copy + species/size/lure/time. Depends on Ch5 (the portrait + resolved identity).
Tag: `v0.6-journal-candidate`.

### Chapter 7 — Share & Install
*M7.* The trophy/journal entry composites to a canvas **catch-card** (fish portrait + story copy → image blob), shared via `navigator.share()` with copy-to-clipboard fallback; deferred install prompt (after first catch + playtime). Reuses Ch5's portrait as the card hero. PWA manifest/SW/update-prompt already exist.
Tag: `v0.7-share-candidate`.

### Chapter 8 — Gear
*M4.* Three lures (distinct sink / twitch / attraction radius) and two rods (distinct cast power curve + tension tolerance), minimal pre-cast selection. Tie the rod into the far-water distance axis: a long-reach rod that throws into the dark vs. a precise short rod that lands true near. Independent of the catch-loop chapters; placed after them so depth lands on a sealed core, but movable earlier if a playtest says the loop needs more decisions first.
Tag: `v0.8-gear-candidate`.

### Chapter 9 — Finish
*M6 + M8, last on purpose — tune and optimize the final shape once.* Sourced/ambient audio over procedural (layered pond loop) per `09_ASSET_GENERATION` + `10_AUDIO_HAPTICS`, mute/haptic settings; then the `07_PERFORMANCE_BUDGET` validation + Lighthouse pass, texture atlasing, memory watchdog.
Tags: `v0.9-audio-candidate`, `v1.0-performance-candidate`.

## Build approach (the standing method)

- **One chapter, one candidate, one iPhone gate.** Never stack unreviewed candidates again. The prior chapter is `*-approved` before the next begins.
- **Ultracode per chapter.** Machine-checkable concerns (build, regression, perf budget, no-magic-numbers, `14_DO_NOT_BUILD`) are adversarially self-verified inside the workflow (`18_ULTRACODE_PARADIGM`). Feel, the paragraph, OLED coherence, jank, and audio stay mandatory human iPhone gates (`16_HUMAN_GATES`).
- **Canon-first for mechanics.** Any new loop (the reveal, gear) gets its amendment written *before* the build, the way `19_THE_FAR_WATER` was.
- **Procedural-first for assets; generated art is an upgrade, never a dependency.** Ship the procedural version into a named seam (`<FishPortrait>`, an audio layer), see it on a real iPhone, *then* decide if hand-generated art is worth swapping into that same seam. We never block a feature on an asset batch.
- **Constants discipline holds.** New numbers go in `tuning.ts` (`14_DO_NOT_BUILD` / no-magic-numbers, extended to visual constants).
- **`*-approved` tags stay human-only.** The agent writes candidates and DEVLOG slices; never approved tags, never deletes, never force-pushes (`13_CHECKPOINTS`).

## Asset approach for the trophy fish (Chapter 5 decision)

The in-game fish are top-down procedural silhouettes (`createSpeciesSilhouettes()`) — shadows, by design, for the spotting wedge. A Caught-page trophy wants a readable **side profile** instead.

**Default: procedural side-profile render** — a sibling `createSpeciesTrophy(speciesId)` drawing body shape + dorsal/tail fins + species colour + a marking from per-species visual params, tinted to the moonlit palette. Consistent with the project's procedural DNA (audio, water, silhouettes are all code-generated), covers all five species + any future one for free, zero asset sprawl, no `14_DO_NOT_BUILD` risk.

**Upgrade path (optional): generated illustrations.** The Caught screen is the emotional trophy; if the procedural fish undersells it on-device, a hand-generated set swaps straight into `<FishPortrait>`. Requirements if we go there: one plate per species, **side profile, transparent background, moonlit palette matched to `08_ART_DIRECTION`, consistent framing/scale across all five**, ~1024px. Sequenced as a polish swap, not a Chapter-5 blocker.
