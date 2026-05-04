'use client';

import { useCallback, useEffect, useState } from 'react';

import { clearOfflineCaches } from './registration';
import { usePwaStatus } from './usePwaStatus';

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('debug') === '1') return true;
  try {
    return window.localStorage.getItem('reel:debug') === '1';
  } catch {
    return false;
  }
}

export function OfflineStatus() {
  const status = usePwaStatus();
  const [debug, setDebug] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setDebug(isDebugEnabled());
  }, []);

  const handleClear = useCallback(async () => {
    setClearing(true);
    setCleared(false);
    try {
      await clearOfflineCaches();
      setCleared(true);
    } finally {
      setClearing(false);
    }
  }, []);

  const label = (() => {
    switch (status) {
      case 'ready':
        return 'Ready to play offline ✓';
      case 'registering':
        return 'Caching for offline…';
      case 'unsupported':
        return 'Offline play not supported in this browser';
      case 'error':
        return 'Offline cache unavailable';
      case 'disabled':
      case 'idle':
      default:
        return null;
    }
  })();

  if (!label && !debug) return null;

  return (
    <p className="offline-status" data-status={status}>
      {label ? <span className="offline-status-label">{label}</span> : null}
      {debug ? (
        <button
          type="button"
          className="offline-status-clear"
          onClick={handleClear}
          disabled={clearing}
        >
          {clearing ? 'Clearing…' : cleared ? 'Cleared. Reload to re-cache.' : 'Clear offline cache'}
        </button>
      ) : null}
    </p>
  );
}
