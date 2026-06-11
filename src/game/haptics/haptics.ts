// Central haptics gate. Every vibration in the game goes through vibrate() so
// two policies hold everywhere at once:
//  - the player's haptics preference (settings strip / prefsStore), and
//  - prefers-reduced-motion, which collapses multi-pulse patterns to a single
//    short pulse (06_MOBILE_WEB_CONSTRAINTS: "haptics dampened to single
//    pulses under reduced motion").
let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

export function vibrate(pattern: number | readonly number[]): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    const first = typeof pattern === 'number' ? pattern : pattern[0] ?? 0;
    if (first > 0) {
      navigator.vibrate(Math.min(first, 20));
    }
    return;
  }

  navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern]);
}
