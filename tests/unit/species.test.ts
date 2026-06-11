import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createFishInstance,
  cueForReveal,
  GENERIC_CUE_KINDS,
  personalityMultiplier,
  pickSpeciesCue,
  SPECIES_CUE_SIGNATURES,
  SPECIES_IDS,
  speciesTuning
} from '../../src/game/fish/species';
import { seededRandom } from '../../src/game/math/vec';
import { TUNING } from '../../src/game/tuning/tuning';

test('weighted spawn distribution tracks the tuning weights', () => {
  const rng = seededRandom('distribution');
  const counts = new Map<string, number>(SPECIES_IDS.map((id) => [id, 0]));
  const samples = 10_000;

  for (let i = 0; i < samples; i += 1) {
    const instance = createFishInstance(rng);
    counts.set(instance.species, (counts.get(instance.species) ?? 0) + 1);
  }

  const totalWeight = SPECIES_IDS.reduce((sum, id) => sum + speciesTuning(id).spawnWeight, 0);
  for (const id of SPECIES_IDS) {
    const expected = (speciesTuning(id).spawnWeight / totalWeight) * samples;
    const actual = counts.get(id) ?? 0;
    // ±25% relative tolerance is generous for 10k samples but immune to flake;
    // a broken roll (e.g. the old hardcoded fallback biasing one species)
    // distorts far beyond this.
    assert.ok(
      Math.abs(actual - expected) < expected * 0.25,
      `${id}: expected ~${Math.round(expected)}, got ${actual}`
    );
  }
});

test('every species is reachable from the spawn roll', () => {
  const rng = seededRandom('coverage');
  const seen = new Set<string>();
  for (let i = 0; i < 5_000; i += 1) {
    seen.add(createFishInstance(rng).species);
  }
  for (const id of SPECIES_IDS) {
    assert.ok(seen.has(id), `${id} never spawned in 5000 rolls`);
  }
});

test('personality multiplier stays inside its documented bounds', () => {
  // personality ∈ [-1, 1] → multiplier ∈ [1 - modulation, 1 + modulation]
  const lo = 1 - TUNING.fish.personalityModulation;
  const hi = 1 + TUNING.fish.personalityModulation;
  for (const p of [-1, -0.5, 0, 0.5, 1]) {
    const m = personalityMultiplier(p);
    assert.ok(m >= lo - 1e-9 && m <= hi + 1e-9, `multiplier ${m} for personality ${p}`);
  }
  assert.equal(personalityMultiplier(0), 1);
});

test('far fish emit only identity-free cues; near fish emit their signature', () => {
  const threshold = TUNING.fish.cueSpeciesRevealThreshold;
  for (const species of SPECIES_IDS) {
    for (let cueIndex = 0; cueIndex < 4; cueIndex += 1) {
      const farCue = cueForReveal(species, cueIndex, threshold - 0.01, threshold);
      assert.ok(GENERIC_CUE_KINDS.includes(farCue), `far cue ${farCue} must be generic`);

      const nearCue = cueForReveal(species, cueIndex, threshold + 0.01, threshold);
      assert.equal(nearCue, pickSpeciesCue(species, cueIndex));
      assert.ok(SPECIES_CUE_SIGNATURES[species].includes(nearCue));
    }
  }
});
