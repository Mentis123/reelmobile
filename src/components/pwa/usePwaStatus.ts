'use client';

import { useEffect, useState } from 'react';

import { ensureRegistered, isPwaEnvironment, type PwaStatus } from './registration';

function readInitialStatus(): PwaStatus {
  if (typeof window === 'undefined') return 'idle';
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  if (!isPwaEnvironment()) return 'disabled';
  return navigator.serviceWorker.controller ? 'ready' : 'registering';
}

export function usePwaStatus(): PwaStatus {
  const [status, setStatus] = useState<PwaStatus>('idle');

  useEffect(() => {
    setStatus(readInitialStatus());

    if (!isPwaEnvironment()) return;

    let cancelled = false;

    const handleControllerChange = () => {
      if (!cancelled && navigator.serviceWorker.controller) {
        setStatus('ready');
      }
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === 'reel-pwa:ready') setStatus('ready');
      if (data?.type === 'reel-pwa:cleared') setStatus('disabled');
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.addEventListener('message', handleMessage);

    ensureRegistered()
      .then((reg) => {
        if (cancelled) return;
        if (!reg) {
          setStatus('unsupported');
          return;
        }
        if (navigator.serviceWorker.controller) {
          setStatus('ready');
          return;
        }
        const sw = reg.installing || reg.waiting || reg.active;
        if (sw?.state === 'activated') {
          setStatus('ready');
        }
        sw?.addEventListener('statechange', () => {
          if (!cancelled && sw.state === 'activated') setStatus('ready');
        });
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return status;
}
