# 22_THE_GEAR

*Mechanic amendment for Chapter 8 (`20_ROADMAP`). Defines gear as a pre-cast tactical choice that **deepens the distance gamble**, never an upgrade ladder. Where this conflicts with the roadmap's one-line gear sketch, this wins; it stays inside `14_DO_NOT_BUILD`.*

## The rule that governs everything here

Gear is a **sidegrade, chosen before the cast, that commits you to a way of paying for distance.** It is not progression. There are no tiers, no unlocks, no currency, no "better" rod — only different bets. `14_DO_NOT_BUILD` pre-authorises *exactly* two rod variants and three lure variants; this chapter spends that budget and no more.

The test every gear property must pass: **does it change the wait-for-near vs. gamble-long decision, or how that gamble cashes out?** If it only fiddles a stat orthogonal to distance, it is feature creep and does not ship.

## Two rods — reach vs. placement (and the fight you pay for it)

The core (`00_OVERVIEW`) is a per-cast gamble: wait for a fish in clear near-water and place a true cast, or throw long into the dark and reel the unknown back. The rods make that choice physical — **which rod you bring decides whether you *can even* gamble this session.**

- **The long rod (default).** Reaches the far dark shore. Today's accuracy falloff, today's tension tolerance — *the validated feel, unchanged.* This is the rod that can perform the headline paragraph (a long cast into the dark), so it is the default: first-run play is the canonical experience, and the gamble stays open on every cast. **All multipliers = 1.0.**
- **The short rod (specialist).** **Cannot reach the far dark** — its range tops out in the near/mid clear band. In exchange it lands **near-exact** (a much tighter accuracy ellipse), but it fights on a **tight margin — the stiff blank transmits every surge, so the line snaps easier.** Choosing it is a deliberate renunciation of the gamble: *"I'll wait, place perfectly, and accept a less forgiving fight."*

Neither is better. The long rod keeps the gamble; the short rod buys precision near with reach **and** fight-safety as the price. Precision and forgiveness are split across the two rods so neither dominates.

**Not reel-drag (`14_DO_NOT_BUILD` L99).** Tension tolerance is a *fixed, baked-in* property of each rod (roadmap L41 sanctions "distinct cast power curve + tension tolerance"). It is never a slider, dial, or mid-fight control. That distinction is load-bearing — keep it.

## Three lures — how the lure converts inaccuracy into outcome

The lures do not add a second game beside distance; they modulate **how the cast-accuracy falloff cashes out**. A long cast scatters (`19_THE_FAR_WATER` pillar 2); the lure decides whether that scatter hurts.

The two fish-AI levers a lure expresses are **attraction radius** (how far it draws a fish) and **spook/fear radius** (how easily a careless presentation scares one). *This amendment establishes fear-radius as a sanctioned lure property* — it extends the roadmap's "sink / twitch / attraction" sketch. The fear mechanic already exists in the fish state machine (`fishFearRadius`, the flee-on-twitch); this only lets a lure lean on it. Sink and twitch remain as feel-differentiators, not strategic levers (fish hold at one depth, so sink is presentation, not a depth game).

- **The natural lure (default).** Balanced draw, balanced nerve. The validated feel. **All multipliers = 1.0.**
- **The loud lure (popper).** A **large attraction radius** — it can pull a far fish out of the dark toward an off-target splash, *rescuing a loose long cast* (a genuine alternative to casting precisely or to casting at all). Paid for with a **large fear radius**: it is loud, so a clumsy twitch or a fish you crowd spooks easily. *Bigger net, twitchier to handle.*
- **The quiet lure (stealth).** A **small fear radius** — it won't spook even worked right on a wary fish — paid for with a **small attraction radius**: it draws only from close, so it **demands an accurate cast**, punishing scatter. *Place it true on what you spotted, and it won't bolt.*

So the loud lure *forgives* far inaccuracy (draws the fish in anyway) but punishes bad handling; the quiet lure *punishes* far inaccuracy (no draw) but forgives crowding. Both ride the same distance/accuracy spine. The natural lure leaves the rod in charge.

## Selection — minimal, on the water, wordless

- A small **procedural-glyph strip**, idle/pre-cast only, that **fades out the instant a cast begins** so the water is never cluttered during the read or the fight. Two rod glyphs (drawn as the cast-curve profile — a long shallow arc vs. a short steep arc, so the glyph *is* the rod) and three lure glyphs (abstract marks in the moonlit palette, `08_ART_DIRECTION`). Selected = full opacity; tap to switch; persisted to localStorage.
- **No skeuomorphic chrome, no fake tacklebox/reel/leather, no modal, no labels, no tutorial** (`14_DO_NOT_BUILD` L60/L64). The strip teaches itself through play: because accuracy flows through the single shared source, picking the short rod **visibly tightens the aim reticle** on the next aim, and its shorter reach shows as a preview that can't stretch to the dark. The pond is the tutorial.

## What this must never become (guardrails)

- No third rod or fourth lure. No tiers, "+1" upgrades, unlock gates, currency, or rarity (`14_DO_NOT_BUILD` Progression).
- The lure/rod recorded on a catch is a **flat per-entry attribute** for the journal/share only — **never** a "caught on every lure" coverage grid or completion view (`14_DO_NOT_BUILD` L25/L48).
- Tension tolerance stays a fixed rod property, never an adjustable drag control.

## Implementation shape

- All effects are **multipliers in a `TUNING.gear` block**; every default-gear field is **1.0**, so default play is byte-for-byte today's validated feel and the iPhone gate judges only the deltas.
- Rod multipliers: `rangeMult`, `accuracyMult`, `lineStrengthMult` (snap-threshold scalar). Lure multipliers: `attractMult`, `fearMult`, `sinkMult`, `twitchMult`.
- Selection persists via a small `gearStore` (localStorage, SSR-guarded, mirroring `catchJournal`). Resolved multipliers thread onto the `Runtime` (re-seeded each cast) and into `computeCast`; fish attraction/fear cross into `fishStateMachine` via new `FishUpdateInput` fields applied to the **primary fish only**.
- The selected lure id is written into `ResultCatch.lure` (currently hardcoded `'default'`).

## To tune on a real device (feel gates — `16_HUMAN_GATES`)

The starting multipliers are first guesses (`19_THE_FAR_WATER`: starting values are the gate's to refine):
- short-rod range cap (does it still feel worth bringing? can it reach enough water?) and its accuracy/snap deltas (precise-but-fragile should feel like a real tension, not a punishment);
- loud-lure draw vs. spook balance (rescues a loose cast without trivialising the gamble);
- quiet-lure draw floor (demands placement without feeling dead).
