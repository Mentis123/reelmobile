'use client';

import { useEffect, useState } from 'react';

import { ensureRegistered, isPwaEnvironment } from './registration';

/**
 * Detects when a new service worker has installed and is waiting to take over,
 * and exposes a one-tap apply that activates it and reloads to the fresh build.
 *
 * Why this exists: the SW caches the shell for offline play, so a returning
 * player can keep seeing an old build after a deploy. The browser only checks
 * for a new worker on its own schedule, so we force an `update()` on load and
 * surface a prompt the moment a new worker is ready — no incognito or manual
 * cache-clear needed. We deliberately do NOT auto-reload: a silent refresh
 * mid-cast would interrupt play, so the player taps when they're ready.
 */
export function usePwaUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const [updateReady, setUpdateReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!isPwaEnvironment()) return;

    let cancelled = false;
    let refreshing = false;
    // Only auto-reload on an UPDATE (we were already controlled), never on the
    // first-ever install — that would bounce a brand-new visitor's first load.
    const hadController = Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      if (hadController) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const markReady = (worker: ServiceWorker | null) => {
      if (cancelled || !worker) return;
      setWaiting(worker);
      setUpdateReady(true);
    };

    const track = (reg: ServiceWorkerRegistration) => {
      // A worker that finished installing while the page was closed.
      if (reg.waiting && navigator.serviceWorker.controller) {
        markReady(reg.waiting);
      }
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // 'installed' + an existing controller == an update is waiting.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            markReady(reg.waiting ?? installing);
          }
        });
      });
    };

    ensureRegistered()
      .then((reg) => {
        if (!reg || cancelled) return;
        track(reg);
        // Actively ask the browser to check for a new worker right now.
        reg.update().catch(() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = () => {
    if (waiting) {
      // The SW message handler calls self.skipWaiting(); activation then fires
      // controllerchange above, which reloads us into the new build.
      waiting.postMessage({ type: 'reel-pwa:skip-waiting' });
    } else {
      window.location.reload();
    }
  };

  return { updateReady, applyUpdate };
}
