import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SPECIES_IDS, speciesTuning } from '../../src/game/fish/species';
import { TUNING } from '../../src/game/tuning/tuning';

// Invariants the simulation assumes but nothing previously enforced — a tuning
// "tweak" that breaks one of these corrupts feel or physics silently.

test('line physics constants are sane', () => {
  assert.ok(TUNING.line.lineSegments >= 2, 'a line needs at least 2 segments');
  assert.ok(TUNING.line.lineConstraintIterations >= 1, 'solver needs >= 1 pass');
  assert.ok(TUNING.line.lineDamping > 0 && TUNING.line.lineDamping <= 1);
  assert.ok(TUNING.line.lineGravity >= 0);
});

test('fish constants are sane', () => {
  assert.ok(TUNING.fish.velocityDamping > 0 && TUNING.fish.velocityDamping <= 1);
  assert.ok(TUNING.fish.biteWindowMs > 0);
  assert.ok(TUNING.fish.biteNoHookMs > 0);
  assert.ok(TUNING.fish.fishStaminaDrainRate > 0, 'a hooked fish must eventually land');
  assert.ok(TUNING.fish.staminaLandThreshold >= 0);
  assert.ok(TUNING.fish.fleeDurationMs > 0);
  assert.ok(TUNING.fish.wanderSpeedMps > 0);
  assert.ok(TUNING.fish.approachSpeedMps > 0);
  assert.ok(TUNING.fish.personalityModulation >= 0 && TUNING.fish.personalityModulation < 1,
    'modulation >= 1 would allow zero/negative multipliers');
});

test('per-species multipliers are positive and weights well-formed', () => {
  for (const id of SPECIES_IDS) {
    const s = speciesTuning(id);
    assert.ok(s.spawnWeight > 0, `${id} spawnWeight`);
    assert.ok(s.widthM > 0 && s.heightM > 0, `${id} dimensions`);
    assert.ok(s.wanderSpeedMultiplier > 0, `${id} wander speed`);
    assert.ok(s.approachSpeedMultiplier > 0, `${id} approach speed`);
    assert.ok(s.biteWindowMultiplier > 0, `${id} bite window`);
    assert.ok(s.staminaDrainMultiplier > 0, `${id} stamina drain`);
    assert.ok(s.surgeIntervalMinMs <= s.surgeIntervalMaxMs, `${id} surge interval ordering`);
  }
});

test('the reveal gradient is ordered and inside the fishable water', () => {
  assert.ok(TUNING.world.revealNoneZ < TUNING.world.revealFullZ, 'reveal must resolve toward the near water');
  assert.ok(TUNING.world.fishableMinZ < TUNING.world.fishableMaxZ);
  assert.ok(TUNING.world.revealNoneZ >= TUNING.world.fishableMinZ);
  assert.ok(TUNING.world.revealFullZ <= TUNING.world.fishableMaxZ);
});

test('timing and tension constants are sane', () => {
  assert.ok(TUNING.timing.maxFrameDtSeconds > 0 && TUNING.timing.maxFrameDtSeconds <= 0.5);
  assert.ok(TUNING.timing.msPerSecond === 1000);
  assert.ok(TUNING.tension.lineSnapThreshold > TUNING.tension.nearSnapThreshold,
    'the warning must fire before the snap');
  assert.ok(TUNING.tension.nearSnapThreshold > TUNING.tension.tensionSweetSpotMin,
    'the sweet spot must sit below the warning band');
});

test('audio bus gains stay inside [0, 1]', () => {
  assert.ok(TUNING.audio.masterGain >= 0 && TUNING.audio.masterGain <= 1);
  assert.ok(TUNING.audio.ambientGain >= 0 && TUNING.audio.ambientGain <= 1);
  assert.ok(TUNING.audio.sfxGain >= 0 && TUNING.audio.sfxGain <= 1);
});

test('performance degradation ladder is ordered', () => {
  assert.ok(TUNING.performance.fpsFloor < TUNING.performance.fpsRecovery,
    'hysteresis requires recovery above the floor');
  assert.ok(TUNING.performance.pixelRatioMin <= TUNING.performance.pixelRatioCap);
  assert.ok(TUNING.performance.pixelRatioStep > 0);
});

test('gear sidegrade guardrail: the default loadout is exactly neutral', () => {
  // 22_THE_GEAR: defaults must be 1.0 multipliers (byte-identical feel), so
  // gear stays a sidegrade — never a stat ladder (14_DO_NOT_BUILD).
  const rod = TUNING.gear.rods.long;
  const lure = TUNING.gear.lures.natural;
  assert.equal(rod.rangeMult, 1);
  assert.equal(rod.accuracyMult, 1);
  assert.equal(rod.lineStrengthMult, 1);
  assert.equal(lure.attractMult, 1);
  assert.equal(lure.fearMult, 1);
});
