// Player feel preferences (sound / haptics), persisted across sessions. Same
// SSR-guarded, schema-validated, fail-soft pattern as gearStore — prefs are
// never load-bearing, defaults always work.
const STORAGE_KEY = 'reelmobile.prefs.v1';

export type Prefs = {
  audio: boolean;
  haptics: boolean;
};

export function defaultPrefs(): Prefs {
  return { audio: true, haptics: true };
}

export function getPrefs(): Prefs {
  const fallback = defaultPrefs();
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      audio: typeof parsed.audio === 'boolean' ? parsed.audio : fallback.audio,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : fallback.haptics
    };
  } catch {
    return fallback;
  }
}

export function setPrefs(prefs: Prefs): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota / private mode — the toggle still applies for this session.
  }
}
