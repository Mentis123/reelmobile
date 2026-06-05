# 19_THE_FAR_WATER

*Canon amendment. Supersedes the dock framing and the small-pond cast bounds in `00_OVERVIEW`, `01_GAME_SPEC`, `04_SPOTTING_AND_PERCEPTION`, and `05_PHYSICS_AND_FEEL` wherever they conflict. The paragraph in `00_OVERVIEW` is the version of record; this document explains the mechanics that make it happen.*

## The new story

The old game was a small slab of water you could see all of, where every cast landed exactly where you put it. This amendment makes **distance the spine of the game.**

The loop:

1. **You watch the whole expanse**, from the bank at your feet out to the far shore.
2. **The far water is dark.** Out there you see *movement* — a roll, a wake, a smudge — not a fish. You cannot tell what it is or how big.
3. **You choose.** Wait for it to wander into the clear near-water where a cast lands true — or gamble a long cast now, into the dark, where you can't place it precisely.
4. **The long cast scatters.** It lands *near* what you aimed at, not on it. The farther you reach, the looser it gets.
5. **If it works, you lure the unknown in.** A fish that takes interest follows the lure back toward you — out of the dark, into water you can finally read. The reveal is spatial: you reel the mystery into clarity, and only then see what you hooked.
6. **Then the old core still fires:** the strike, the panic, the near-snap, the land, the *again*.

This is why every change below exists. Map them to the paragraph and they line up one-to-one.

## The four mechanic pillars

### 1. The castable expanse (near → far)
The whole body of water is in play. You can drop a lure just off the bank in front of you (the foreshore) and you can reach all the way out toward the far shore. Range is no longer a narrow mid-lane; it spans from your feet to the horizon, left to right across the width.

- *Paragraph line:* "I aimed long … and let go." / "wander in close, where my cast would land true."

### 2. Accuracy falloff with distance
A short cast is precise. A long cast scatters — the intended landing point gets a random offset whose size grows with how far you reach. Near the bank the offset is negligible; at the far shore it is large enough that you are bidding on a *zone*, not a point. **This must read as a designed mechanic, never as a bug:** the aim preview widens with distance so the player *sees* the imprecision before committing, and feels the trade when they choose to reach.

The tell is the **landing-zone reticle** — drawn at the cast's *exact* scatter radius, so what you see is literally where the lure can land (an honest telegraph, not a vague hint). It is a **perspective ellipse lying on the water**, not a flat screen circle: a tight, near-pointlike mark up close, opening into a broad foreshortened ellipse at the far shore. Because a depth offset foreshortens harder than a width offset under this camera, the ellipse flattens the farther you aim — it sits *on* the pond surface, and that flattening is itself a distance cue.

- *Paragraph line:* "The lure dropped near it. Not dead on. Near enough."

### 3. Visibility falloff with distance
Near water is legible; far water is murky. Fish and their cues fade as they get farther out, until distant fish are barely-there suggestions. This is not a penalty — it is the *point*. It creates the dark you cast into and the clarity you reel a fish back into. The far shore is where the big mysterious ones live precisely because you can't see them well there.

- *Paragraph line:* "out past where the water went dark" / "into water I could finally read."

### 4. Fish roam the whole expanse
Fish wander the full fishable water, near to far, not a central band. Most of the time the interesting ones are far and dim. A hooked fish is drawn back toward you as you fight it, traversing distance from dark to clear — that traversal *is* the reveal.

- *Paragraph line:* "It followed the lure in, out of the dark."

## The rod is in your hand now (no dock)

The dock is gone. You are on the bank, and the rod is **in your hand, in the bottom-right corner of the screen** — large, present, first-person. It is no longer scenery you look at; it is the instrument you point.

- **Doubled in size** — rod and reel both. It reads as *yours*, close to the camera.
- **Anchored bottom-right**, butt in the corner, pointing up and out toward the middle of the water.
- **Sways to track your aim.** As you drag to choose a casting spot, the rod tip leans toward it and back — the rod *aims* with you, so the cast feels like an extension of your hand rather than a projected line.
- The fight still loads the rod: tension and the hookset still bend it. Aiming-sway and fight-bend coexist.

The dock leaving canon means the old paragraph line "I crept along the dock to get a better angle" is retired. The new angle-finding is *casting itself* — choosing where, and how far, to place the lure.

## What stays sacred

Nothing here weakens the existing invariants. The strike / panic / near-snap / land / repeat core is untouched and is still the destination of every long cast. No labels, no rarity, no transparent water, no HUD-first reading. The water is still read by *feel and surface*, only now across a distance that means something.

## This is a canary change

Range, accuracy, visibility, and fish roam all alter the **spotting read**, and the rod change alters **cast feel** — both are mandatory human-iPhone-gate concerns under `16_HUMAN_GATES` / `18_ULTRACODE_PARADIGM` §4. The workflow may self-certify the wiring (constants lifted, builds, no dangling dock references, accuracy is deterministic-per-gesture for testability), but whether the *gamble feels worth it* and whether the *reveal lands* is judged on glass. The starting values (how far, how loose, how dark, rod angle/size/sway) are a co-tuned first guess; they are for the gate to refine, not deliverables.
