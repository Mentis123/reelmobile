import { DEFAULT_LURE_ID, DEFAULT_ROD_ID, isLureId, isRodId, type LureId, type RodId } from '@/game/gear/gear';

// The player's pre-cast gear choice, persisted across sessions (22_THE_GEAR).
// SSR-guarded + schema-validated + try/catch like catchJournal — gear is
// non-critical, so any read/write failure falls back to the default loadout.
const STORAGE_KEY = 'reelmobile.gear.v1';

export type GearSelection = { rodId: RodId; lureId: LureId };

export function defaultGear(): GearSelection {
  return { rodId: DEFAULT_ROD_ID, lureId: DEFAULT_LURE_ID };
}

export function getGear(): GearSelection {
  const fallback = defaultGear();
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<GearSelection>;
    return {
      rodId: typeof parsed.rodId === 'string' && isRodId(parsed.rodId) ? parsed.rodId : fallback.rodId,
      lureId: typeof parsed.lureId === 'string' && isLureId(parsed.lureId) ? parsed.lureId : fallback.lureId
    };
  } catch {
    return fallback;
  }
}

export function setGear(selection: GearSelection): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch (error) {
    // Gear is non-critical, but name the cause so support reports are diagnosable.
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('[gear] localStorage quota exceeded; selection not saved.');
    } else {
      console.warn('[gear] localStorage unavailable (private mode?); selection not saved.');
    }
  }
}
