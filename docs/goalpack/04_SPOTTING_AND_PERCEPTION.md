# 04_SPOTTING_AND_PERCEPTION

**Spotting is core gameplay. This is the wedge that distinguishes Reel Mobile from generic fishing games.**

The player should not see labelled fish swimming around. The player should *read the water* the way a real angler does — pattern-matching ambiguous cues, sometimes wrong, occasionally rewarded with "I knew it."

## Cue taxonomy

| Cue | Visual | Duration | Detectability |
|-----|--------|----------|---------------|
| **Shadow** | Slow, broad, low-opacity dark shape beneath surface | 3–8s | Easy at depth, hard at edge of visibility |
| **Glint** | Brief silver/gold flash from scales | 100–300ms | Hard, requires attention |
| **Ripple** | Concentric surface circles | 1–2s | Easy but ambiguous (wind also causes them) |
| **Wake** | V-shaped directional surface disturbance | 2–4s | Medium, indicates direction |
| **Silt plume** | Cloudy plume rising from pond floor | 2–5s | Indicates bottom-feeder |
| **Tail flash** | One-frame to short-duration fin flick | 80–200ms | Very hard, rewards focus |
| **Bubble trail** | Small repeated bubbles | 2–6s | Easy, indicates carp-type |
| **Surface rise** | Slight bulge in waterline, no break | 400–800ms | Medium, indicates surface feeder |

## Ambiguity budget

**20–30% of all visible cues should be false positives.**

False sources:
- Wind ripples
- Floating leaves causing surface motion
- Light refraction creating glint-like artefacts
- Cloud shadows passing
- Surface plant movement

The player should regularly think "Was that a fish?" and sometimes be wrong. This is what creates *I think it was big*.

Implementation: every 2–6 seconds, spawn a "noise cue" that mimics a real cue type but resolves to nothing. Seed-driven for reproducibility.

## Per-species cue signatures (Phase B)

| Species | Primary cues | Behaviour signature |
|---------|--------------|---------------------|
| **Bronze Carp** | Bubble trail + slow rounded shadow | Patrols mid-depth, gentle approach |
| **Moss Bass** | Glint + medium-speed shadow | Curious, circles before commit |
| **Moon Minnow** | Surface rise + tiny tail flashes | Fast, aggressive, short bite window |
| **Old Kingfish** | Large slow shadow + occasional silt plume | Rarely surfaces, very long inspect phase |
| **Reed Pike** | Fast wake near reed clusters | Sudden directional strikes from cover |

In Phase A, one generic fish uses **shadow + occasional ripple** only.

## Focus gesture

A single-finger press-and-hold on the water enters Focus Water mode.

**Pinned timings (in `tuning.ts`):**
```ts
focus_duration_ms: 1800
focus_cooldown_ms: 4000
focus_glare_reduction: 0.6
focus_water_speed_multiplier: 0.7
```

**During focus:**
- Surface glare reduces (specular shader uniform drops)
- Water animation slows
- Camera dampens (no drift)
- Cues become slightly more readable but never labelled
- A faint vignette indicates the focused state

**Cooldown** prevents spamming. After focus ends, 4 seconds before it can re-engage. Visual cooldown indicator: a subtle ring at finger position fading out.

## Audio perception

- **Distant splash** — fires when an offscreen fish surfaces, panned to its direction
- **Low underwater thrum** — ambient layer that swells when a large fish (Old Kingfish, Reed Pike) is within 3m of the dock
- **Bubble pop** — close-range cue for surface bubbles
- **Reed rustle** — indicates a Reed Pike has moved through cover

These reward attention without revealing position visually.

## Hard rules

- **Never label fish.** No "Bronze Carp" text floating above a fish.
- **Never show rarity stars during scouting.**
- **Never make fish constantly obvious.** A pond where every fish is visible is a different game.
- **Never resolve cue ambiguity for the player.** They cast or they don't. The game does not say "that wasn't a fish."
- **Always seed the cue spawn.** Reproducible bugs require deterministic perception layer.
