# 10_AUDIO_HAPTICS

Audio is part of core feel, not polish. **Procedural Web Audio in M1.** Sourced/generated audio in M6.

## Audio unlock

Web Audio is gated behind user gesture on iOS Safari. The Tap-to-begin splash (`06_MOBILE_WEB_CONSTRAINTS.md`) is the unlock. Until then, no audio plays.

## M1 — Procedural sound design

All sounds synthesised at runtime via Web Audio nodes. No asset files. Implementation in `src/game/audio/procedural.ts`.

| Sound | Method | Notes |
|-------|--------|-------|
| `cast_whoosh` | Filtered noise burst, 200ms, lowpass sweep 2k→500Hz | Volume scales with cast power |
| `lure_plop` | Sine plus noise, 80ms, pitched downward | Pitch varies with impact velocity |
| `lure_twitch` | Short bandpass noise tick, 40ms | Subtle, almost subliminal |
| `nibble_tick` | Two quick wood-block ticks (50Hz triangle), 30ms each | Fires at start of bite window |
| `hookset_thunk` | Lowpassed sine impact at 80Hz + noise click | Plays only on successful hook |
| `line_zip_loop` | Sawtooth at 200Hz with vibrato, gain modulated by tension | Continuous during fight, only audible above 0.4 tension |
| `reel_click_loop` | Filtered noise pulses at intervals proportional to reel speed | Subtle ratchet feel |
| `fish_splash` | Noise burst with lowpass sweep + envelope | Random pitch/duration variants |
| `line_snap` | Sharp sawtooth twang at 800Hz dropping to 200Hz, 200ms | Sole "loud" moment in the game |
| `catch_chime` | Two-note major third (392Hz + 494Hz), soft sine, 800ms decay | Warm, not victorious |
| `escape_splash` | Wider noise burst, falling pitch | Distinct from regular splash |
| `ambient_pond` | Layered: brown noise lowpassed at 200Hz + occasional sine "drips" | Loops continuously after unlock |

## Master mix

```ts
masterGain: 0.7
ambientGain: 0.3   // relative to master
sfxGain: 1.0       // relative to master
musicGain: 0.0     // no music in MVP
```

User-toggleable mute in settings (M6+).

## Spatial audio (light)

Pan SFX based on world position relative to camera centre. Pure stereo pan, no HRTF.

```ts
function panFor(worldX: number, screenWidth: number): number {
  return clamp((worldX - cameraCentreX) / (screenWidth * 0.5), -1, 1);
}
```

## Event timing rules

| Event | Sound trigger |
|-------|---------------|
| Cast released | `cast_whoosh` |
| Lure hits water | `lure_plop` + `fish_splash` (small) |
| Lure tap | `lure_twitch` |
| Fish enters bite window | `nibble_tick` |
| Player taps within window | `hookset_thunk` |
| Tension > 0.4 | `line_zip_loop` starts, gain proportional to (tension - 0.4) |
| Tension > 0.92 (snap) | `line_snap` (one-shot) |
| Reel input held | `reel_click_loop`, rate ∝ reel speed |
| Fish lands | `catch_chime` |
| Fish escapes via slack | `escape_splash` |
| Distant offscreen surface event | `fish_splash` panned + low-passed |
| Large fish within 3m, unseen | `ambient_pond` adds low thrum layer (sine at 60Hz, gain 0.1) |

## Haptics

`navigator.vibrate()` with iOS fallback rule.

| Event | Pattern (ms) | iOS fallback |
|-------|--------------|--------------|
| Tap-to-begin | `[10]` | None needed (silent on iOS) |
| Nibble tick | `[15]` per tick | Visual line jerk + audio |
| Hookset thunk | `[20, 40, 20]` | Visual rod bend + audio |
| Tension > 0.7 | `[30]` repeated every 200ms while above | Visual line colour + audio |
| Line snap | `[80]` | Visual + screen shake + audio |
| Catch | `[10, 30, 10, 30, 60]` | Visual + audio |

**Haptics are a setting.** Default ON. User can disable in settings. Persisted to localStorage as `pref_haptics: boolean`.

**Never rely on haptics for critical feedback.** Visual + audio must convey everything haptics convey.

## Reduced motion

If `prefers-reduced-motion: reduce`:
- `line_zip_loop` max gain reduced 30%
- Haptic patterns dampened to single short pulses
- Ambient thrum disabled

## Acceptance for M1

- All 12 sounds fire at correct events
- No clicks or pops on loop boundaries
- Master gain controllable
- iOS Safari plays everything after Tap-to-begin
- No console errors related to AudioContext state
