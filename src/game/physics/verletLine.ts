import { lerpVec, type Vec2 } from '@/game/math/vec';
import { TUNING } from '@/game/tuning/tuning';

export type LinePoint = {
  pos: Vec2;
  prev: Vec2;
};

export type VerletLine = {
  points: LinePoint[];
};

// Damping below is normalized to a 60Hz frame: pow(lineDamping, dt * 60) keeps
// the energy loss per SECOND constant whatever the display refresh rate, so the
// line feels the same on a 120Hz ProMotion iPhone as at 60Hz.
const DAMPING_REFERENCE_HZ = 60;

export function createVerletLine(anchor: Vec2, end: Vec2): VerletLine {
  const points: LinePoint[] = [];

  for (let index = 0; index <= TUNING.line.lineSegments; index += 1) {
    const t = index / TUNING.line.lineSegments;
    const pos = lerpVec(anchor, end, t);
    points.push({ pos: { ...pos }, prev: { ...pos } });
  }

  return { points };
}

// Mutates the line in place and returns it. This runs every frame of the render
// loop — the previous immutable version allocated a fresh array plus ~3 objects
// per point per frame (hundreds of short-lived objects at 60fps), which is
// exactly the GC pressure the adaptive-DPR system then has to absorb as jank.
export function updateVerletLine(line: VerletLine, anchor: Vec2, end: Vec2, dt: number, tension: number): VerletLine {
  const points = line.points;
  const last = points.length - 1;
  const visualTension = visualLineTension(tension);
  const damping = Math.pow(TUNING.line.lineDamping, dt * DAMPING_REFERENCE_HZ);
  const gravity = TUNING.line.lineGravity * TUNING.line.lineSlackGravityMultiplier * (1 - visualTension) * dt * dt;

  for (let index = 0; index <= last; index += 1) {
    const point = points[index];

    if (index === 0) {
      point.pos.x = anchor.x;
      point.pos.z = anchor.z;
      point.prev.x = anchor.x;
      point.prev.z = anchor.z;
      continue;
    }

    if (index === last) {
      point.pos.x = end.x;
      point.pos.z = end.z;
      point.prev.x = end.x;
      point.prev.z = end.z;
      continue;
    }

    const vx = (point.pos.x - point.prev.x) * damping;
    const vz = (point.pos.z - point.prev.z) * damping;
    point.prev.x = point.pos.x;
    point.prev.z = point.pos.z;
    point.pos.x += vx;
    point.pos.z += vz - gravity;
  }

  const segmentLength = distanceFor(anchor, end) / TUNING.line.lineSegments;
  // < 1 iteration would silently disable the solver and let the points fly.
  const iterations = Math.max(1, TUNING.line.lineConstraintIterations);

  for (let pass = 0; pass < iterations; pass += 1) {
    points[0].pos.x = anchor.x;
    points[0].pos.z = anchor.z;
    points[last].pos.x = end.x;
    points[last].pos.z = end.z;

    for (let index = 0; index < last; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const deltaX = next.pos.x - current.pos.x;
      const deltaZ = next.pos.z - current.pos.z;
      const dist = Math.hypot(deltaX, deltaZ) || segmentLength;
      const difference = (dist - segmentLength) / dist;
      const correctionX = deltaX * difference;
      const correctionZ = deltaZ * difference;

      if (index !== 0) {
        current.pos.x += correctionX * 0.5;
        current.pos.z += correctionZ * 0.5;
      }

      if (index + 1 !== last) {
        next.pos.x -= correctionX * 0.5;
        next.pos.z -= correctionZ * 0.5;
      }
    }
  }

  points[0].pos.x = anchor.x;
  points[0].pos.z = anchor.z;
  points[last].pos.x = end.x;
  points[last].pos.z = end.z;

  return line;
}

function visualLineTension(tension: number): number {
  const range = TUNING.line.lineVisualTautFull - TUNING.line.lineVisualTautStart;

  if (range <= 0) {
    return tension;
  }

  return Math.min(1, Math.max(0, (tension - TUNING.line.lineVisualTautStart) / range));
}

function distanceFor(a: Vec2, b: Vec2): number {
  return Math.max(Math.hypot(a.x - b.x, a.z - b.z), TUNING.lure.lureRadiusM);
}
