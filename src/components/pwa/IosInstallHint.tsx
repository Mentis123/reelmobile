'use client';

import { useEffect, useState } from 'react';

import { getJournal } from '@/game/persistence/catchJournal';

// One quiet line on the splash credits card, iOS Safari only: Apple gives
// PWAs no install prompt at all, so without this the offline/home-screen
// path is undiscoverable. Earned, not naggy — it appears only after the
// player has landed at least one fish (they're invested), only outside
// standalone mode, and it's a passive sentence, never a popup.
export function IosInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent;
      const isIos = /iPhone|iPad|iPod/.test(ua);
      const isSafari = isIos && !/CriOS|FxiOS|EdgiOS/.test(ua);
      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches === true ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIos && isSafari && !standalone && getJournal().catches.length > 0) {
        setShow(true);
      }
    } catch {
      // Detection is best-effort; stay hidden on any failure.
    }
  }, []);

  if (!show) {
    return null;
  }

  return (
    <p className="install-hint">
      Share → <b>Add to Home Screen</b> — the pond keeps, even offline.
    </p>
  );
}
