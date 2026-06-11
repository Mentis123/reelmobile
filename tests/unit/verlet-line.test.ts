import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createVerletLine, updateVerletLine, type VerletLine } from '../../src/game/physics/verletLine';
import { TUNING } from '../../src/game/tuning/tuning';
import type { Vec2 } from '../../src/game/math/vec';

const ANCHOR: Vec2 = { x: 0.55, z: 3.05 };
const END: Vec2 = { x: 0, z: -3.45 };

function settle(line: VerletLine, anchor: Vec2, end: Vec2, seconds: number, dt: number, tension = 0): VerletLine {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    line = updateVerletLine(line, anchor, end, dt, tension);
  }
  return line;
}

test('endpoints stay pinned to the rod tip and lure', () => {
  let line = createVerletLine(ANCHOR, END);
  line = settle(line, ANCHOR, END, 1, 1 / 60);

  const first = line.points[0];
  const last = line.points[line.points.length - 1];
  assert.deepEqual({ x: first.pos.x, z: first.pos.z }, ANCHOR);
  assert.deepEqual({ x: last.pos.x, z: last.pos.z }, END);
});

test('update mutates in place (no per-frame reallocation)', () => {
  const line = createVerletLine(ANCHOR, END);
  const pointsBefore = line.points;
  const result = updateVerletLine(line, ANCHOR, END, 1 / 60, 0.5);
  assert.equal(result, line);
  assert.equal(result.points, pointsBefore);
});

test('constraint solver converges segment lengths', () => {
  // Perturb: create against one geometry, then settle against a shifted end so
  // the solver has real work to do.
  const shiftedEnd: Vec2 = { x: 1.2, z: -2.2 };
  let line = createVerletLine(ANCHOR, END);
  line = settle(line, ANCHOR, shiftedEnd, 2, 1 / 60);

  const segmentLength = Math.hypot(ANCHOR.x - shiftedEnd.x, ANCHOR.z - shiftedEnd.z) / TUNING.line.lineSegments;
  for (let i = 0; i < line.points.length - 1; i += 1) {
    const a = line.points[i].pos;
    const b = line.points[i + 1].pos;
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    assert.ok(
      Math.abs(dist - segmentLength) < segmentLength * 0.25,
      `segment ${i} length ${dist} should be within 25% of ${segmentLength}`
    );
  }
});

test('line shape is frame-rate independent (60Hz vs 120Hz)', () => {
  // Regression test for dt-dependent damping: the same simulated duration at
  // different step rates must land the line in (nearly) the same place, or the
  // game feels different on ProMotion displays.
  const shiftedEnd: Vec2 = { x: 1.2, z: -2.2 };

  let at60 = createVerletLine(ANCHOR, END);
  at60 = settle(at60, ANCHOR, shiftedEnd, 1.5, 1 / 60);

  let at120 = createVerletLine(ANCHOR, END);
  at120 = settle(at120, ANCHOR, shiftedEnd, 1.5, 1 / 120);

  for (let i = 0; i < at60.points.length; i += 1) {
    const a = at60.points[i].pos;
    const b = at120.points[i].pos;
    const drift = Math.hypot(a.x - b.x, a.z - b.z);
    // ~10cm residual (at mid-span, where sag peaks) remains because the
    // constraint solver runs a fixed number of passes per FRAME — 120Hz
    // relaxes twice as often per second, settling to a slightly tauter sag.
    // Velocity damping — the dominant feel term — is dt-normalized, and the
    // sag is visual only (fight tension is computed elsewhere). Driving this
    // bound toward zero needs a fixed-timestep simulation loop (evaluation
    // doc §3.3); tighten the tolerance when that lands.
    assert.ok(drift < 0.15, `point ${i} drifted ${drift}m between step rates`);
  }
});

test('a zero-iteration tuning value cannot disable the solver', () => {
  // updateVerletLine clamps iterations to >= 1; with the pinned endpoints this
  // means interior points always receive at least one constraint pass.
  const original = TUNING.line.lineConstraintIterations;
  (TUNING.line as { lineConstraintIterations: number }).lineConstraintIterations = 0;
  try {
    let line = createVerletLine(ANCHOR, END);
    line = settle(line, ANCHOR, END, 0.5, 1 / 60);
    for (const point of line.points) {
      assert.ok(Number.isFinite(point.pos.x) && Number.isFinite(point.pos.z));
      assert.ok(Math.abs(point.pos.x) < 20 && Math.abs(point.pos.z) < 20, 'points must not fly off');
    }
  } finally {
    (TUNING.line as { lineConstraintIterations: number }).lineConstraintIterations = original;
  }
});
