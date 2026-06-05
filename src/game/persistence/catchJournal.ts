import type { Catch } from '@/game/persistence/sessionStore';

// Append-only catch journal persisted to localStorage, per 15_TELEMETRY_AND_SESSION.
// The in-memory sessionStore resets every page load; this is what survives so the
// /journal route can show a player's history across sessions (Chapter 6 / 20_ROADMAP).
const STORAGE_KEY = 'reelmobile.journal.v1';
// Bound the stored history so the payload (re-serialized on every write) and the
// /journal render stay cheap however long someone plays. A few hundred trophies is
// far more than the view needs; oldest entries roll off.
const MAX_JOURNAL_CATCHES = 500;

export type Journal = {
  schemaVersion: 1;
  catches: Catch[];
  totalCasts: number;
  totalSessions: number;
  firstSessionAt: number;
};

function emptyJournal(): Journal {
  return { schemaVersion: 1, catches: [], totalCasts: 0, totalSessions: 0, firstSessionAt: 0 };
}

export function getJournal(): Journal {
  if (typeof window === 'undefined') return emptyJournal();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyJournal();
    const parsed = JSON.parse(raw) as Partial<Journal>;
    // Unknown/breaking schema → start clean rather than render garbage.
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.catches)) return emptyJournal();
    return {
      schemaVersion: 1,
      catches: parsed.catches as Catch[],
      totalCasts: parsed.totalCasts ?? 0,
      totalSessions: parsed.totalSessions ?? 0,
      firstSessionAt: parsed.firstSessionAt ?? 0
    };
  } catch {
    return emptyJournal();
  }
}

function save(journal: Journal): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
  } catch {
    // Private mode / quota — fail silent; the journal is a nicety, never load-bearing.
  }
}

export function appendCatchToJournal(catchEntry: Catch): void {
  const journal = getJournal();
  // Dedupe by id so a double-fire of recordCatch can't double-log a fish.
  if (journal.catches.some((c) => c.id === catchEntry.id)) return;
  journal.catches.push(catchEntry);
  if (journal.catches.length > MAX_JOURNAL_CATCHES) {
    journal.catches = journal.catches.slice(-MAX_JOURNAL_CATCHES);
  }
  if (!journal.firstSessionAt) journal.firstSessionAt = catchEntry.at;
  save(journal);
}

export function noteJournalSessionStart(): void {
  const journal = getJournal();
  journal.totalSessions += 1;
  if (!journal.firstSessionAt) journal.firstSessionAt = Date.now();
  save(journal);
}

export function noteJournalCast(): void {
  const journal = getJournal();
  journal.totalCasts += 1;
  save(journal);
}

export function clearJournal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
