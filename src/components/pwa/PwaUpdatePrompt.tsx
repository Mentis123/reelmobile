'use client';

import { usePwaUpdate } from './usePwaUpdate';

/**
 * Unobtrusive toast shown only when a newer build is cached and ready. Tapping
 * it activates the waiting worker and reloads into the fresh build. Mounted
 * globally so it can appear on any route the player happens to be on.
 */
export function PwaUpdatePrompt() {
  const { updateReady, applyUpdate } = usePwaUpdate();

  if (!updateReady) return null;

  return (
    <button type="button" className="pwa-update-prompt" onClick={applyUpdate}>
      Update available — tap to refresh
    </button>
  );
}
