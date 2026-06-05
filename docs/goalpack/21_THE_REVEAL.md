# 21_THE_REVEAL

*Mechanic amendment. Completes the far-water loop begun in `19_THE_FAR_WATER` — specifically pillar 3 (visibility falloff) and the paragraph's promise of reeling the unknown "into water I could finally read." Where this conflicts with earlier perception notes, this wins.*

## The promise

From `19_THE_FAR_WATER`: *"Out there you see movement — a roll, a wake, a smudge — not a fish. You cannot tell what it is or how big."* The gamble of a long, inaccurate cast only carries stakes if you genuinely **don't know what you bid on** until it's close. The reveal is the payoff: you hook a shadow in the dark and **reel the mystery into clarity** — its size, then its identity, resolving as it crosses into the near water, and named in full on the Caught screen.

## The resolve gradient

A fish carries two identity tells: its **size** and its **shape/species**. Both should be unreadable far out and resolve as the fish nears the bank.

- **Far (beyond `revealNoneZ`):** the fish reads as a generic, ambiguous shadow — you can see *that* something moves, not *what* or *how big*.
- **Near (inside `revealFullZ`):** fully resolved — true size, true silhouette.
- **Between:** a smoothstep, so a hooked fish **grows (or shrinks) into what it really is** as you fight it toward you. Sometimes the big shadow is a monster; sometimes it's a let-down minnow. That uncertainty is the point.

The Caught screen (`<CatchResultCard>` / the trophy) is the final beat of the reveal — the species named, sized, and seen.

## Implemented (v1 — size concealment)

`fishRevealAmount(position)` = smoothstep over `[revealNoneZ, revealFullZ]`. The fish mesh scale lerps from a uniform generic size (`revealGenericWidthM` × `revealGenericHeightM`) at reveal 0 to the true species size at reveal 1. So far fish all read at one ambiguous size and resolve their real size on approach. This composes with the existing dimming (`fishDistanceVisibility`, pillar 3) — far fish are both dim *and* size-ambiguous.

Tunable in `TUNING.world`: `revealNoneZ`, `revealFullZ`, `revealGenericWidthM`, `revealGenericHeightM`.

## Implemented (v2 — shape + cue concealment, the full resolve gradient)

All three tells now hide in the dark and resolve together on the same `fishRevealAmount` gradient:

- **Shape concealment (crossfade, pop-free).** Each fish has a generic "smudge" twin mesh (`fishGenericRefs`, a soft radial-ellipse texture from `createGenericSilhouette()`). The species silhouette's opacity is multiplied by `reveal`; the twin's by `1 − reveal`. Far → only the smudge shows; near → only the true species silhouette; between → a brief crossfade as it resolves. The twin uses a **neutral** opacity (no `species.opacityMultiplier`) so brightness never leaks which species it is. No texture swap → no pop.
- **Cue genericisation.** `cueForReveal(species, i, reveal, threshold)` returns an identity-free `GENERIC_CUE_KINDS` cue (wake / ripple) at a neutral `genericCueRadiusM` while a fish is below `cueSpeciesRevealThreshold`; only near does its `SPECIES_CUE_SIGNATURES` cue + `primaryCueRadiusM` show. So a far cue tells you *something moved*, not *what*.

Tunable in `TUNING.fish`: `cueSpeciesRevealThreshold`, `genericCueRadiusM`.

## Alive pond (companion to v2)

Now that **any** fish you cast near is catchable (nearest-to-splash promotion), every fish — not just the one primary — leaves the occasional cue out in the water (`decorCueMinMs`..`decorCueMaxMs` per fish), far ones generic via the same `cueForReveal`. The expanse reads populated, and each shadow is a real fish you could cast at, without any of them betraying identity at distance.

## To tune on a real device (feel gates — `16_HUMAN_GATES`)

- The *resolve distances and curve* (`revealNoneZ`/`revealFullZ`) and the *crossfade band* — judged on a real iPhone, not by machine. If the smudge→silhouette crossfade pops or resolves too early/late, these are the knobs.
- Pond cue density (`decorCueMinMs`..`decorCueMaxMs`, `cueRealEveryMs`, the false-cue cadence): alive vs. cluttered is a felt call.
