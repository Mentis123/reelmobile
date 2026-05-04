'use client';

export type PwaStatus = 'idle' | 'registering' | 'ready' | 'unsupported' | 'disabled' | 'error';

const SW_URL = '/sw.js';

export function isPwaEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  // Skip in dev: Next.js HMR + a SW caching shell HTML is a recipe for stale-page pain.
  if (process.env.NODE_ENV !== 'production') return false;
  // file:// or other non-secure contexts can't host a SW.
  if (!window.isSecureContext) return false;
  return true;
}

export async function ensureRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (!isPwaEnvironment()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_URL);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  } catch (err) {
    console.warn('[pwa] registration failed', err);
    return null;
  }
}

export async function clearOfflineCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('reel-')).map((k) => caches.delete(k)));
  }
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    if (reg?.active) {
      reg.active.postMessage({ type: 'reel-pwa:clear' });
    }
    if (reg) {
      await reg.unregister();
    }
  }
}
