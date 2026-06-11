import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
  appendCatchToJournal,
  clearJournal,
  getJournal,
  noteJournalCast,
  noteJournalSessionStart
} from '../../src/game/persistence/catchJournal';

// Minimal localStorage stub installed BEFORE the module under test is used.
// catchJournal checks `typeof window` at call time, so a global stub is enough.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const storage = new MemoryStorage();
// Static import is safe here even though it hoists above this assignment:
// catchJournal checks `typeof window` at CALL time, and all calls happen
// inside tests, after this module-level stub is in place.
(globalThis as Record<string, unknown>).window = { localStorage: storage };

type Catch = ReturnType<typeof getJournal>['catches'][number];

const STORAGE_KEY = 'reelmobile.journal.v1';

function makeCatch(id: string, at = Date.now()): Catch {
  return {
    id,
    at,
    species: 'moss_bass',
    sizeScore: 0.5,
    lure: 'natural',
    durationMs: 4200,
    peakTension: 0.7,
    nearSnaps: 1,
    storyText: 'Caught.'
  };
}

beforeEach(() => {
  storage.clear();
});

test('empty storage yields an empty journal', () => {
  const journal = getJournal();
  assert.equal(journal.schemaVersion, 1);
  assert.deepEqual(journal.catches, []);
  assert.equal(journal.totalCasts, 0);
});

test('appended catches round-trip through storage', () => {
  appendCatchToJournal(makeCatch('a'));
  appendCatchToJournal(makeCatch('b'));

  const journal = getJournal();
  assert.equal(journal.catches.length, 2);
  assert.deepEqual(journal.catches.map((c) => c.id), ['a', 'b']);
});

test('a double-fired catch id is deduplicated', () => {
  const entry = makeCatch('same-id');
  appendCatchToJournal(entry);
  appendCatchToJournal(entry);
  assert.equal(getJournal().catches.length, 1);
});

test('the journal is capped and the oldest entries roll off', () => {
  for (let i = 0; i < 510; i += 1) {
    appendCatchToJournal(makeCatch(`c-${i}`));
  }
  const journal = getJournal();
  assert.equal(journal.catches.length, 500);
  assert.equal(journal.catches[0].id, 'c-10');
  assert.equal(journal.catches[499].id, 'c-509');
});

test('corrupt JSON falls back to an empty journal instead of throwing', () => {
  storage.setItem(STORAGE_KEY, '{not json');
  const journal = getJournal();
  assert.deepEqual(journal.catches, []);
});

test('an unknown future schema version starts clean rather than rendering garbage', () => {
  storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, catches: [{ weird: true }] }));
  const journal = getJournal();
  assert.equal(journal.schemaVersion, 1);
  assert.deepEqual(journal.catches, []);
});

test('cast and session counters persist', () => {
  noteJournalSessionStart();
  noteJournalCast();
  noteJournalCast();
  const journal = getJournal();
  assert.equal(journal.totalSessions, 1);
  assert.equal(journal.totalCasts, 2);
  assert.ok(journal.firstSessionAt > 0);
});

test('clearJournal wipes storage', () => {
  appendCatchToJournal(makeCatch('x'));
  clearJournal();
  assert.equal(getJournal().catches.length, 0);
});

test('a quota error on write is swallowed (journal is never load-bearing)', () => {
  appendCatchToJournal(makeCatch('pre'));
  const original = storage.setItem.bind(storage);
  storage.setItem = () => {
    throw new DOMException('quota', 'QuotaExceededError');
  };
  try {
    assert.doesNotThrow(() => appendCatchToJournal(makeCatch('post')));
  } finally {
    storage.setItem = original;
  }
  // The failed write must not have corrupted what was already stored.
  assert.deepEqual(getJournal().catches.map((c) => c.id), ['pre']);
});
