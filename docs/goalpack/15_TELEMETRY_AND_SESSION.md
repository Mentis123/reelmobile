# 15_TELEMETRY_AND_SESSION

No backend in MVP. But the **shape** of telemetry must be right from M1 so we can wire up Plausible/PostHog later without restructuring.

## Session model

Single object held in Zustand store. Reset per session (page load).

```ts
type Session = {
  id: string;                    // uuid
  pondSeed: string;              // YYYY-MM-DD-Aletter (deterministic per day)
  startedAt: number;             // Date.now()
  endedAt: number | null;
  device: {
    userAgent: string;
    pixelRatio: number;
    viewportW: number;
    viewportH: number;
    isIOSSafari: boolean;
    isAndroidChrome: boolean;
  };
  prefs: {
    haptics: boolean;
    audio: boolean;
    reducedMotion: boolean;
  };
  casts: number;
  catches: Catch[];
  failures: Failure[];
  perf: {
    avgFps: number;
    minFps: number;
    pixelRatioDegradationsCount: number;
    glContextLossCount: number;
  };
};

type Catch = {
  id: string;
  at: number;
  species: string;       // 'generic' in M1
  sizeScore: number;     // 0..1
  lure: string;
  durationMs: number;    // hook to land
  peakTension: number;
  nearSnaps: number;     // tension > 0.85 events
  storyText: string;     // generated narrative
};

type Failure = {
  at: number;
  kind: 'missed_early' | 'missed_late' | 'snap' | 'escape' | 'no_bite';
  context: {
    fishSpecies?: string;
    peakTension?: number;
    distanceToFish?: number;
  };
};
```

Stored in `src/game/persistence/sessionStore.ts`.

## Persistence

**Catch journal** persists to localStorage:

```ts
const STORAGE_KEY = 'reelmobile.journal.v1';

type Journal = {
  schemaVersion: 1;
  catches: Catch[];           // append-only
  totalCasts: number;
  totalSessions: number;
  firstSessionAt: number;
};
```

Schema version is bumped on breaking changes; migration path in `persistence/migrations.ts`.

## Tracking hook

Single function for all events. Today: console.log. Tomorrow: Plausible/PostHog.

```ts
// src/game/telemetry/track.ts
type TrackEvent =
  | { type: 'session_start' }
  | { type: 'session_end' }
  | { type: 'cast' }
  | { type: 'bite_window_open' }
  | { type: 'hook_attempt'; result: 'success' | 'early' | 'late' }
  | { type: 'catch'; catch: Catch }
  | { type: 'failure'; failure: Failure }
  | { type: 'focus_used' }
  | { type: 'gl_context_lost' }
  | { type: 'gl_context_restored' }
  | { type: 'pixel_ratio_degraded'; from: number; to: number }
  | { type: 'install_prompt_shown' }
  | { type: 'install_prompt_accepted' }
  | { type: 'share_initiated' };

export function track(event: TrackEvent): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[track]', event);
  }
  // Future: send to Plausible / PostHog
}
```

Every gameplay event passes through `track()`. No event firing without it.

## Determinism / seeds

`pondSeed` controls deterministic things:
- Fish patrol paths
- Fish spawn positions
- Species distribution (Phase B)
- Cue noise spawn timing (the "false positive" cues per `04`)

Non-deterministic (real RNG):
- Bite outcomes (`commit` → `bite` decision)
- Tension spike intensity during fight
- Escape attempt timing

This balance: the world is replayable, the moments aren't. Two players on the same seed see the same fish in the same places, but their catches differ.

Seed format:
```
YYYY-MM-DD-A   (today, default seed)
YYYY-MM-DD-B   (alt seed for same day, for sharing)
```

URL override: `/game?seed=2026-05-03-A`

## Story generation

Result text generated from Catch data. Located at `src/game/ui/storyGenerator.ts`. Uses simple template fills, no LLM needed.

```ts
function generateStory(c: Catch): string {
  const size = c.sizeScore > 0.7 ? 'A heavy' : c.sizeScore > 0.4 ? 'A solid' : 'A small';
  const speciesLabel = SPECIES_LABELS[c.species] ?? 'pond fish';
  const lureLabel = LURE_LABELS[c.lure] ?? 'lure';
  const struggle = c.nearSnaps >= 2 ? 'Nearly snapped twice.' :
                   c.nearSnaps === 1 ? 'Almost lost it once.' : 'Steady fight.';
  const duration = c.durationMs > 15000 ? `Took over ${Math.round(c.durationMs/1000)} seconds.` : '';
  return `${size} ${speciesLabel}.\nTook the ${lureLabel}.\n${struggle}\n${duration}`.trim();
}
```

Output is short, observational, story-shaped — never stat-heavy.

## What we never log

- IP addresses
- Geolocation
- Device IDs beyond user agent
- Personal info (no auth, no email, no name)
- Anything that could re-identify a player

This is a small private game. Telemetry is for product learning, not surveillance.
