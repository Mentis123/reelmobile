import assert from 'node:assert/strict';
import { test } from 'node:test';

import { failureStory, generateStory } from '../../src/game/ui/storyGenerator';

const FAILURE_KINDS = ['missed_early', 'missed_late', 'snap', 'escape', 'no_bite'] as const;

function makeCatch(overrides: Partial<Parameters<typeof generateStory>[0]> = {}) {
  return {
    id: 'test',
    at: 0,
    species: 'moss_bass',
    sizeScore: 0.5,
    lure: 'default',
    durationMs: 4000,
    peakTension: 0.7,
    nearSnaps: 0,
    storyText: '',
    ...overrides
  };
}

test('every failure kind produces distinct, non-empty copy', () => {
  const stories = FAILURE_KINDS.map((kind) => failureStory(kind));
  for (const story of stories) {
    assert.ok(story.length > 0);
  }
  assert.equal(new Set(stories).size, stories.length, 'failure copy must be distinct per kind');
});

test('catch stories are deterministic for the same catch', () => {
  const entry = makeCatch();
  assert.equal(generateStory(entry), generateStory(entry));
});

test('size bands change the opening line', () => {
  const small = generateStory(makeCatch({ sizeScore: 0.2 }));
  const solid = generateStory(makeCatch({ sizeScore: 0.5 }));
  const heavy = generateStory(makeCatch({ sizeScore: 0.9 }));
  assert.ok(small.includes('small'));
  assert.ok(solid.includes('solid'));
  assert.ok(heavy.includes('heavy'));
});

test('near-snap count shapes the struggle line', () => {
  assert.ok(generateStory(makeCatch({ nearSnaps: 0 })).includes('Steady fight'));
  assert.ok(generateStory(makeCatch({ nearSnaps: 1 })).includes('Almost lost it once'));
  assert.ok(generateStory(makeCatch({ nearSnaps: 3 })).includes('Nearly snapped twice'));
});

test('an unknown species falls back to generic copy instead of breaking', () => {
  const story = generateStory(makeCatch({ species: 'unheard_of_fish' }));
  assert.ok(story.includes('pond fish'));
});
