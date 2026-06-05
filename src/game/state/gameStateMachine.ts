import type { Vec2 } from '@/game/math/vec';

export type FailureKind = 'missed_early' | 'missed_late' | 'snap' | 'escape' | 'no_bite';

// The catch data surfaced on the result ("Caught") screen — the trophy. Carried on
// the result state so the screen can show the fish, its size, and the fight instead
// of a single line of prose.
export type ResultCatch = {
  species: string;
  sizeScore: number;
  lure: string;
  durationMs: number;
  nearSnaps: number;
  peakTension: number;
};

export type GameState =
  | { kind: 'splash' }
  | { kind: 'scouting'; sinceMs: number }
  | { kind: 'aiming'; startPx: Vec2; currentPx: Vec2; power: number }
  | { kind: 'casting'; from: Vec2; target: Vec2; startedAt: number; flightMs: number; power: number }
  | { kind: 'lure_idle'; lurePos: Vec2; sinceMs: number; lastTwitchAt: number | null }
  | { kind: 'rod_control'; lurePos: Vec2; sinceMs: number; load: number }
  | { kind: 'bite_window'; openedAt: number; closesAt: number; lurePos: Vec2 }
  | { kind: 'hooked'; hookedAt: number; stamina: number; slackMs: number; nearSnaps: number; peakTension: number }
  | { kind: 'result'; outcome: 'catch' | FailureKind; storyText: string; shownAt: number; peakTension: number; catch?: ResultCatch };

export function stateLabel(state: GameState): string {
  return state.kind;
}

export function isResultFailure(outcome: GameState['kind'] | FailureKind | 'catch'): outcome is FailureKind {
  return (
    outcome === 'missed_early' ||
    outcome === 'missed_late' ||
    outcome === 'snap' ||
    outcome === 'escape' ||
    outcome === 'no_bite'
  );
}
