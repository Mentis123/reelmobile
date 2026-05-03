# 05_PHYSICS_AND_FEEL

Use simple, **tunable game-feel physics**, not realism.

All numeric constants live in `src/game/tuning/tuning.ts`. No magic numbers in gameplay code.

## Cast

- **Input:** drag from rod position (or anywhere on lower screen), direction = aim, drag length = power
- **Power curve:** clamp drag length to `[castPowerMin, castPowerMax]`, normalise, apply ease-out cubic
- **Trajectory:** parabolic arc, target point = rod + direction × power × maxRange
- **Clamp:** target stays within pond bounds with 5% margin
- **Visual:** dotted preview arc appears under finger during drag, fades on release
- **Audio:** `cast_whoosh` on release, `lure_plop` on water contact
- **Timing:** flight time scales with power (0.5s short → 1.2s long)

```ts
castPowerMin: 0.15
castPowerMax: 1.0
castMaxRangeM: 8
castFlightTimeMin: 0.5
castFlightTimeMax: 1.2
```

## Line — Verlet rope

**Required implementation:** Verlet-integrated rope with `lineSegments: 10` constraints.

- Anchor: rod tip (follows rod orientation)
- End: lure position
- Constraint pass: 4 iterations per frame
- Gravity: small downward force, modulated by tension
- Damping: 0.98

**Visual:**
- Thin curved line, drawn as `MeshLine` or thick `Line2`
- Sags below water surface when slack
- Straightens when taut
- **Colour shifts** with tension: pale when slack, golden when taut, red when near snap
- **Thickness shifts** with tension: 1.2px slack → 2.0px taut → 2.5px near snap

```ts
lineSegments: 10
lineConstraintIterations: 4
lineGravity: 0.3
lineDamping: 0.98
lineSlackColour: '#d8d4c2'
lineTautColour: '#e8c878'
lineSnapColour: '#c84848'
```

## Tension system

Tension is a scalar `0..1`.

**Rises when:**
- Player reels while fish pulls away
- Rod angle opposes fish direction
- Fish performs burst movement (state: hooked + rage spike)

**Falls when:**
- Player stops reeling
- Rod angle follows fish
- Fish stamina depletes

**Outcomes:**
- Tension > `lineSnapThreshold` → snap (line breaks, see `11_FAILURE_AESTHETICS.md`)
- Tension < `lineSlackEscapeThreshold` for > `slackEscapeWindowMs` → fish throws hook

```ts
lineSnapThreshold: 0.92
lineSlackEscapeThreshold: 0.05
slackEscapeWindowMs: 1500
tensionRiseRate: 0.6
tensionFallRate: 0.4
```

## Tension is visual in three places

Per round-3 refinement: tension is read in three places, not just a meter.

1. **Line** — colour and thickness (above)
2. **Rod bend** — rod tip flexes proportional to tension, max 30° at snap threshold
3. **Surface splash** — fish struggle creates more aggressive splash particles at high tension

The HUD supports the feel; the scene communicates it.

## Lure behaviour

The lure is a character, not a dot.

**Properties:**
- Sink rate (per lure type)
- Wobble amplitude (subtle idle motion)
- Twitch impulse (on tap)
- Flash duration (on twitch)
- Ripple radius on impact and twitch

**Twitch rhythm:**
- Tapping faster than `twitchPanicThresholdMs` increases nearby fish fear radius briefly
- Tapping with 800–2000ms gaps maximises curiosity
- This converts twitch from a button into a skill

```ts
lureSinkRate: 0.4
lureWobbleAmplitude: 0.05
lureTwitchImpulse: 0.3
twitchPanicThresholdMs: 250
twitchOptimalGapMinMs: 800
twitchOptimalGapMaxMs: 2000
```

## Fish AI — steering behaviours

No pathfinding. Use steering behaviours: seek, wander, flee, pursue.

**Per-state forces:**
- `wander` — random wander vector
- `notice` — face lure, slow drift
- `approach` — seek lure with reduced speed
- `inspect` — orbit lure at distance, low speed
- `commit` — seek lure aggressively
- `bite` — snap to lure position
- `flee` — flee from rod
- `hooked` — tug-of-war with rod

**Per-fish modulation:**
```ts
fishNoticeRadius: 2.0      // base
fishFearRadius: 0.4         // base
biteWindowMs: 600           // window for hookset
fishStaminaDrainRate: 0.15
personalityScalar: -1..1    // ±15% modulation
```

## Hook event

When fish enters `bite` state, a 600ms window opens.

- Tap before window → `missed_early`
- Tap during window → hook set, transition to `hooked`
- Tap after window → `missed_late`
- No tap → fish enters `flee`, returns to wander

The bite window is announced by:
- `nibble_tick` audio
- Brief line-tip jerk (visual)
- Light haptic pulse (Android only)

## Fight

Hold-to-reel input. Player modulates pressure.

- Reeling at full while fish pulls away → tension climbs
- Reeling matched to fish stamina → tension stable
- Releasing → tension falls but fish gains slack-escape progress

Fish stamina decays during fight at `fishStaminaDrainRate`. When stamina < 0.1, fish enters `tire` substate, easier to land.

Successful land = stamina depleted AND tension never snapped AND slack-escape never triggered.
