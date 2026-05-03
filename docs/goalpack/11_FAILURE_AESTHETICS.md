# 11_FAILURE_AESTHETICS

A snapped line is the most emotionally loaded moment in a fishing game. Failure must feel **earned, distinct, and learnable** — never like a bug.

## Three failure modes (plus two missed-hooksets)

| Outcome | Cause | Aesthetic |
|---------|-------|-----------|
| `missed_early` | Hook tap before bite window | "Too soon." Brief tug, fish vanishes. |
| `missed_late` | Hook tap after bite window | "Too late." Fish flicks away with audible flick. |
| `line_snap` | Tension exceeds `lineSnapThreshold` | Loud, sudden, dramatic. |
| `fish_escape` | Slack below threshold for `slackEscapeWindowMs` | Anticlimactic. Line goes limp. |
| `no_bite` | Player retrieved without engagement | Silent. Reel back, cast again. |

Each has its own animation, audio, haptics, and result line.

## `missed_early` — "Too soon"

- Visual: Lure jerks slightly, fish silhouette darts away into deep water
- Audio: Brief water flick (`fish_splash` short variant), no `hookset_thunk`
- Haptic: single short pulse `[10]`
- Result line: *"Too soon. The fish slipped away."*
- Time-to-prompt: 1200ms

## `missed_late` — "Too late"

- Visual: Lure twitches, fish silhouette spits the lure (small particle burst), fish flees
- Audio: Soft "spit" sound (filtered noise burst), no `hookset_thunk`
- Haptic: single pulse `[10]`
- Result line: *"Too late. It dropped the lure and bolted."*
- Time-to-prompt: 1200ms

## `line_snap` — the dramatic one

This is the only **loud** moment in the entire game.

- **Visual sequence (1500ms total):**
  1. Tension peaks to red, line maxes thickness (50ms)
  2. Snap: line whips back to rod tip with whip animation (200ms)
  3. Lure splashes once at last position (concurrent)
  4. Bubble trail rises from where lure sank (800ms)
  5. Fish silhouette flashes once visible then vanishes into deep water (400ms)
  6. Camera shake: single sharp shake, ~6px, settling immediately (300ms)

- **Audio sequence:**
  1. `line_snap` one-shot (sharp twang)
  2. Receding `fish_splash` panned to fish exit direction
  3. **1.5 seconds of pond ambient only** — no UI sound, no music sting
  4. Soft chime when result line appears

- **Haptic:** `[80]` single strong pulse on snap

- **Beat of silence:** 1.5 seconds before "Cast again" prompt fades in. This is what gives the catch its weight. Do not rush it.

- Result line: *"Snapped. The lure is gone with the fish."* (Player loses that lure for the session — minor consequence, no economy.)

## `fish_escape` — the anticlimax

When tension stays slack too long, fish throws the hook.

- Visual: Line goes limp gradually over 600ms, lure floats to surface with tiny splash, fish silhouette moves away calmly (no flee-burst)
- Audio: `escape_splash`, then ambient only
- Haptic: `[15, 15]`
- Result line: *"It threw the hook. You let the line go slack."*
- Time-to-prompt: 1000ms (faster than snap — anticlimactic loss should not linger)

## `no_bite` — silent failure

Player retrieves lure without any fish engagement.

- Visual: Lure reels in normally, no special animation
- Audio: `reel_click_loop` continues, no special cue
- Result line: none (no result screen — direct return to scout state)

## Result screen pattern (all outcomes)

For all outcomes that show a result line:

```
[800ms after outcome resolves]
  Result text fades in (400ms)
  "Cast again" button fades in (200ms after text)
[After button visible]
  Tap anywhere to dismiss → return to scout state
  Auto-dismiss after 6 seconds if no input
```

## Anti-patterns

- **No "GAME OVER" screen.** Reel Mobile has no game over.
- **No loss leaderboard.**
- **No "you suck" tone.** Failure copy is observational, not judgemental.
- **No long failure animations.** Total time-to-cast-again should be under 3 seconds for missed/escape, under 4 seconds for snap.
- **No retry penalties.** No cooldown, no "wait to fish again." Cast again immediately.

## The principle

Failure is the cost that makes catches mean something. Make it feel earned, not punishing. The player should feel "I'll do better next time," never "this game is broken."

A snap should make the player wince, then immediately want to cast again.
