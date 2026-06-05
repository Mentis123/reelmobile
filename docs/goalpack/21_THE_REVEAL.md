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

## Next (to tune on a real device)

- **Shape concealment:** swap a far fish to a generic silhouette, resolving to its species silhouette on approach (a crossfade, not a pop — needs sighted tuning, so deferred from v1).
- **Cue genericisation:** species-distinct cues (`SPECIES_CUE_SIGNATURES`) shouldn't betray identity at distance.
- These are feel/visual gates (`16_HUMAN_GATES`): the *resolve distances and curve* are judged on a real iPhone, not by machine.
