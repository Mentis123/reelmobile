import { lerpVec, type Vec2 } from '@/game/math/vec';
import { TUNING } from '@/game/tuning/tuning';

export type LinePoint = {
  pos: Vec2;
  prev: Vec2;
};

export type VerletLine = {
  points: LinePoint[];
};

export function createVerletLine(anchor: Vec2, end: Vec2): VerletLine {
  const points: LinePoint[] = [];

  for (let index = 0; index <= TUNING.line.lineSegments; index += 1) {
    const t = index / TUNING.line.lineSegments;
    const pos = lerpVec(anchor, end, t);
    points.push({ pos, prev: pos });
  }

  return { points };
}

export function updateVerletLine(line: VerletLine, anchor: Vec2, end: Vec2, dt: number, tension: number): VerletLine {
  const visualTension = visualLineTension(tension);
  const points = line.points.map((point, index) => {
    if (index === 0) {
      return { pos: anchor, prev: anchor };
    }

    if (index === line.points.length - 1) {
      return { pos: end, prev: end };
    }

    const velocity = {
      x: (point.pos.x - point.prev.x) * TUNING.line.lineDamping,
      z: (point.pos.z - point.prev.z) * TUNING.line.lineDamping
    };
    const gravity = TUNING.line.lineGravity * TUNING.line.lineSlackGravityMultiplier * (1 - visualTension) * dt * dt;
    const pos = {
      x: point.pos.x + velocity.x,
      z: point.pos.z + velocity.z - gravity
    };

    return { pos, prev: point.pos };
  });

  const segmentLength = distanceFor(anchor, end) / TUNING.line.lineSegments;

  for (let pass = 0; pass < TUNING.line.lineConstraintIterations; pass += 1) {
    points[0].pos = anchor;
    points[points.length - 1].pos = end;

    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const delta = {
        x: next.pos.x - current.pos.x,
        z: next.pos.z - current.pos.z
      };
      const dist = Math.hypot(delta.x, delta.z) || segmentLength;
      const difference = (dist - segmentLength) / dist;
      const correction = {
        x: delta.x * difference,
        z: delta.z * difference
      };

      if (index !== 0) {
        current.pos = {
          x: current.pos.x + correction.x * 0.5,
          z: current.pos.z + correction.z * 0.5
        };
      }

      if (index + 1 !== points.length - 1) {
        next.pos = {
          x: next.pos.x - correction.x * 0.5,
          z: next.pos.z - correction.z * 0.5
        };
      }
    }
  }

  points[0].pos = anchor;
  points[points.length - 1].pos = end;

  return { points };
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
