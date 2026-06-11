import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { vibrate, setHapticsEnabled } from '../../src/game/haptics/haptics';

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
(globalThis as Record<string, unknown>).window = { localStorage: storage };

// Imported after the window stub note above — both modules read window/
// navigator at CALL time, so static-import hoisting is safe.
import { appendCatchToJournal } from '../../src/game/persistence/catchJournal';
import { personalBestFor } from '../../src/game/fish/personalBest';
import { trophyLengthCm } from '../../src/game/fish/trophy';
import { getPrefs, setPrefs } from '../../src/game/persistence/prefsStore';
import type { Catch } from '../../src/game/persistence/sessionStore';

function makeCatch(overrides: Partial<Catch> = {}): Catch {
  return {
    id: Math.random().toString(36).slice(2),
    at: Date.now(),
    species: 'moss_bass',
    sizeScore: 0.5,
    lure: 'natural',
    durationMs: 4000,
    peakTension: 0.6,
    nearSnaps: 0,
    storyText: '',
    ...overrides
  };
}

beforeEach(() => {
  storage.clear();
});

test('the first ever catch is recognized as first', () => {
  assert.equal(personalBestFor(makeCatch()), 'first');
});

test('a catch longer than everything in the journal is the overall best', () => {
  appendCatchToJournal(makeCatch({ sizeScore: 0.4 }));
  appendCatchToJournal(makeCatch({ species: 'moon_minnow', sizeScore: 0.9 }));

  // moss_bass at 0.9 outsizes both the smaller bass and the minnow (shorter
  // species), so this is an overall best, not just a species best.
  const bassLen = trophyLengthCm('moss_bass', 0.9);
  const minnowLen = trophyLengthCm('moon_minnow', 0.9);
  assert.ok(bassLen > minnowLen, 'precondition: bass outsizes minnow at equal score');
  assert.equal(personalBestFor(makeCatch({ sizeScore: 0.9 })), 'overall');
});

test('a species-best that is not the overall best is recognized as species', () => {
  appendCatchToJournal(makeCatch({ species: 'old_kingfish', sizeScore: 0.9 }));
  appendCatchToJournal(makeCatch({ species: 'moon_minnow', sizeScore: 0.3 }));

  // A bigger minnow than before, but nowhere near the kingfish.
  assert.equal(personalBestFor(makeCatch({ species: 'moon_minnow', sizeScore: 0.6 })), 'species');
});

test('an ordinary catch gets no recognition', () => {
  appendCatchToJournal(makeCatch({ sizeScore: 0.9 }));
  assert.equal(personalBestFor(makeCatch({ sizeScore: 0.5 })), undefined);
});

test('prefs round-trip and default to everything on', () => {
  assert.deepEqual(getPrefs(), { audio: true, haptics: true });
  setPrefs({ audio: false, haptics: true });
  assert.deepEqual(getPrefs(), { audio: false, haptics: true });
});

test('corrupt prefs fall back to defaults', () => {
  storage.setItem('reelmobile.prefs.v1', '{nope');
  assert.deepEqual(getPrefs(), { audio: true, haptics: true });
});

test('the haptics gate respects the enabled flag and copies readonly patterns', () => {
  const calls: Array<number | number[]> = [];
  // Node 22 ships a real getter-only `navigator` global; shadow it via
  // defineProperty and restore the original descriptor afterwards.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      vibrate: (pattern: number | number[]) => {
        calls.push(pattern);
        return true;
      }
    }
  });

  try {
    setHapticsEnabled(false);
    vibrate([10, 20] as const);
    assert.equal(calls.length, 0, 'disabled haptics must not vibrate');

    setHapticsEnabled(true);
    vibrate([10, 20] as const);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], [10, 20]);

    vibrate(35);
    assert.deepEqual(calls[1], 35);
  } finally {
    setHapticsEnabled(true);
    if (original) {
      Object.defineProperty(globalThis, 'navigator', original);
    } else {
      delete (globalThis as Record<string, unknown>).navigator;
    }
  }
});
