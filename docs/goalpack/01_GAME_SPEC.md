# 01_GAME_SPEC

## The 60-second loop

The player opens the pond. Within 5 seconds they notice movement under the water — a shadow, a glint, a ripple. They drag the screen to aim, release to cast. The lure splashes. They tap to twitch the lure. A fish approaches. The line tightens. They feel the bite. They tap to set the hook. The fight begins. They hold to reel, easing off when tension peaks. They land the fish. The result tells a small story. They want to cast again.

## Core verbs

- **Scout** — read the water for cues
- **Aim** — drag direction
- **Cast** — release to launch
- **Sink** — let the lure descend
- **Twitch** — tap to animate the lure
- **Tease** — wait, repeat, vary rhythm
- **Hook** — tap when bite registers
- **Fight** — hold to reel, modulate tension
- **Land** — fish exhausted, brought to dock
- **Log** — result screen, brief story

## Core loop

```
SCOUT → AIM → CAST → SINK → TWITCH → INTEREST → BITE → HOOK → FIGHT → LAND/LOSE → RESULT → SCOUT
```

## Fish behaviour ladder

```
WANDER → NOTICE → APPROACH → INSPECT → COMMIT → BITE → (HOOKED | FLEE)
HOOKED → STRUGGLE → TIRE → LANDED
```

State transitions are functions of: lure proximity, lure motion type, lure rhythm, time-in-state, fish personality scalar.

## Fish state machine (implementation)

Hand-rolled TypeScript discriminated union. No XState. Located at `src/game/fish/fishStateMachine.ts`.

```ts
type FishState =
  | { kind: 'wander'; targetPos: Vec2; sinceMs: number }
  | { kind: 'notice'; lurePos: Vec2; alertness: number }
  | { kind: 'approach'; lurePos: Vec2; speed: number }
  | { kind: 'inspect'; lurePos: Vec2; patience: number }
  | { kind: 'commit'; lurePos: Vec2; biteEtaMs: number }
  | { kind: 'bite'; biteWindowMs: number }
  | { kind: 'hooked'; stamina: number; rage: number }
  | { kind: 'flee'; targetPos: Vec2 }
  | { kind: 'landed' }
```

## MVP fish

**Phase A (M1):** One generic pond fish. No species name. Grey-box.

**Phase B (M3+):**
- **Bronze Carp** — bubbles + slow rounded shadow, gentle bites
- **Moss Bass** — glint + medium-speed shadow, curious
- **Moon Minnow** — surface rises + tiny flashes, fast aggressive bites
- **Old Kingfish** — large slow shadow, occasional silt, rarely surfaces, hardest catch
- **Reed Pike** — fast wakes near reeds, sudden directional strikes

Each fish has a `personality: -1..1` scalar that modulates notice radius, fear radius, and commit threshold by ±15%. Two Pike instances should feel slightly different.

## Win/loss

There is no game over. Every cast resolves as one of:

- **Catch** — fish landed, logged with a story
- **Snap** — line broke, fish gone with the lure
- **Escape** — fish threw the hook (slack too long)
- **Missed early** — hook set before bite window
- **Missed late** — hook set after bite window
- **No bite** — never engaged, retrieve and cast again

The player can always cast again. There is no resource cost in MVP.

## Result screen

A short text card, generated from session data but presented as story:

> *A heavy Bronze Carp.*
> *Took the moss-green lure on the third twitch.*
> *Nearly snapped twice.*
> *Landed at the edge of the reeds.*

Below the card: "Cast again." button. That's it.
