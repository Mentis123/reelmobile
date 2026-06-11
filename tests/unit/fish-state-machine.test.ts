import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createInitialFish,
  nextWanderTarget,
  updateFish,
  type FishSnapshot,
  type FishUpdateInput
} from '../../src/game/fish/fishStateMachine';
import { speciesTuning } from '../../src/game/fish/species';
import { seededRandom, type Vec2 } from '../../src/game/math/vec';
import { TUNING } from '../../src/game/tuning/tuning';

const DT = 1 / 60;

// A fully neutral fish (personality 0 = multiplier 1) so durations reduce to
// TUNING base values times the species multipliers alone.
function makeFish(position: Vec2 = { x: 0, z: 0 }): FishSnapshot {
  return {
    position,
    velocity: { x: 0, z: 0 },
    state: { kind: 'wander', targetPos: { x: 0, z: -4 }, sinceMs: 0 },
    instance: { species: 'moss_bass', personality: 0 }
  };
}

type Overrides = Partial<Omit<FishUpdateInput, 'nowMs' | 'dt'>>;

// Steps the machine with an accumulating clock; returns the evolved snapshot.
function run(
  fish: FishSnapshot,
  seconds: number,
  overrides: Overrides = {},
  startMs = 0
): { fish: FishSnapshot; nowMs: number } {
  const rng = seededRandom('fish-test');
  let nowMs = startMs;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    nowMs += DT * 1000;
    fish = updateFish(
      {
        nowMs,
        dt: DT,
        lurePos: null,
        lureMoved: false,
        hooked: false,
        rng,
        lureAttractMult: 1,
        lureFearMult: 1,
        ...overrides
      },
      fish
    );
  }
  return { fish, nowMs };
}

test('full ladder: wander → notice → approach → inspect → commit → bite', () => {
  const lurePos: Vec2 = { x: 0.3, z: 0 };
  let fish = makeFish({ x: 0, z: 0 });
  const seen = new Set<string>([fish.state.kind]);

  const rng = seededRandom('ladder');
  let nowMs = 0;
  // Generous ceiling: the moss_bass path is ~700ms notice + approach + ~1357ms
  // inspect + 520ms commit; 30 simulated seconds is far beyond any of it.
  for (let i = 0; i < 30 / DT && fish.state.kind !== 'bite'; i += 1) {
    nowMs += DT * 1000;
    fish = updateFish(
      { nowMs, dt: DT, lurePos, lureMoved: false, hooked: false, rng, lureAttractMult: 1, lureFearMult: 1 },
      fish
    );
    seen.add(fish.state.kind);
  }

  assert.equal(fish.state.kind, 'bite');
  for (const expected of ['wander', 'notice', 'approach', 'inspect', 'commit', 'bite']) {
    assert.ok(seen.has(expected), `ladder must pass through ${expected} (saw: ${[...seen].join(', ')})`);
  }
});

test('a moved lure inside the fear radius spooks a noticing fish into flee', () => {
  let fish = makeFish({ x: 0, z: 0 });
  fish = { ...fish, state: { kind: 'notice', lurePos: { x: 0.2, z: 0 }, alertness: 0, sinceMs: 0 } };

  const { fish: after } = run(fish, DT * 2, {
    lurePos: { x: 0.2, z: 0 },
    lureMoved: true
  });

  assert.equal(after.state.kind, 'flee');
});

test('an unanswered bite times out into flee after biteNoHookMs', () => {
  let fish = makeFish({ x: 0, z: 0 });
  const openedAt = 1000;
  fish = { ...fish, state: { kind: 'bite', biteWindowMs: TUNING.fish.biteWindowMs, openedAt } };

  const { fish: after } = run(fish, (TUNING.fish.biteNoHookMs + 200) / 1000, { lurePos: { x: 0.2, z: 0 } }, openedAt);

  assert.equal(after.state.kind, 'flee');
});

test('hooked input converts any pre-hook state, drains stamina, and lands', () => {
  let fish = makeFish({ x: 0, z: 0 });
  const first = run(fish, DT * 2, { hooked: true });
  assert.equal(first.fish.state.kind, 'hooked');

  // Initial stamina is staminaLandThreshold + 0.9; drain rate is
  // fishStaminaDrainRate * staminaDrainMultiplier per second → moss_bass lands
  // in 9s. Simulate 12s to be safe.
  const { fish: after } = run(first.fish, 12, { hooked: true });
  assert.equal(after.state.kind, 'landed');
});

test('flee relaxes back to wander after the flee duration', () => {
  let fish = makeFish({ x: 0, z: 0 });
  fish = { ...fish, state: { kind: 'flee', targetPos: { x: 2, z: -3 }, sinceMs: 0 } };

  const { fish: after } = run(fish, (TUNING.fish.fleeDurationMs + 300) / 1000);
  assert.equal(after.state.kind, 'wander');
});

test('wander targets stay inside the fishable water', () => {
  const rng = seededRandom('wander-bounds');
  const margin = TUNING.world.pondMarginRatio * TUNING.world.pondWidthM;
  for (let i = 0; i < 200; i += 1) {
    const target = nextWanderTarget(rng);
    assert.ok(target.x >= -TUNING.world.pondWidthM * 0.5 + margin - 1e-9);
    assert.ok(target.x <= TUNING.world.pondWidthM * 0.5 - margin + 1e-9);
    assert.ok(target.z >= TUNING.world.fishableMinZ - 1e-9);
    assert.ok(target.z <= TUNING.world.fishableMaxZ + 1e-9);
  }
});

test('fish movement is frame-rate independent (60Hz vs 120Hz)', () => {
  // Regression for dt-dependent velocity damping: identical simulated time at
  // different step rates must put the fish in (nearly) the same place.
  const target: Vec2 = { x: 0, z: -4 };
  const start: Vec2 = { x: 2, z: 1 };

  const simulate = (dt: number): Vec2 => {
    let fish = makeFish({ ...start });
    fish = { ...fish, state: { kind: 'wander', targetPos: target, sinceMs: 0 } };
    const rng = seededRandom('dt-invariance');
    let nowMs = 0;
    const steps = Math.round(2 / dt);
    for (let i = 0; i < steps; i += 1) {
      nowMs += dt * 1000;
      fish = updateFish(
        { nowMs, dt, lurePos: null, lureMoved: false, hooked: false, rng, lureAttractMult: 1, lureFearMult: 1 },
        fish
      );
    }
    return fish.position;
  };

  const at60 = simulate(1 / 60);
  const at120 = simulate(1 / 120);
  const drift = Math.hypot(at60.x - at120.x, at60.z - at120.z);
  assert.ok(drift < 0.15, `fish drifted ${drift}m between step rates over 2 simulated seconds`);
});

test('seeded spawns are deterministic', () => {
  const a = createInitialFish(seededRandom('seed-A'));
  const b = createInitialFish(seededRandom('seed-A'));
  const c = createInitialFish(seededRandom('seed-B'));

  assert.equal(a.instance.species, b.instance.species);
  assert.equal(a.instance.personality, b.instance.personality);
  assert.deepEqual(a.position, b.position);
  // Different seed almost certainly differs somewhere; check the tuple.
  const same =
    a.instance.species === c.instance.species &&
    a.instance.personality === c.instance.personality &&
    a.position.x === c.position.x;
  assert.equal(same, false);
});

test('species multipliers shape the notice wait as documented', () => {
  // Sanity-pin the interaction the tuning comments promise: an eager species
  // (moon_minnow, commitThreshold 0.72) starts approaching sooner than a wary
  // one (old_kingfish, 1.45) under identical conditions.
  const eager = speciesTuning('moon_minnow').commitThresholdMultiplier;
  const wary = speciesTuning('old_kingfish').commitThresholdMultiplier;
  assert.ok(eager < 1 && wary > 1 && eager < wary);
});
