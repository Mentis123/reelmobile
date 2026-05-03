import type { Catch, Failure } from '@/game/persistence/sessionStore';

export type TrackEvent =
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
  console.log('[track]', event);
}
