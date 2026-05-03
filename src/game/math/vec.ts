export type Vec2 = {
  x: number;
  z: number;
};

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function scale(v: Vec2, amount: number): Vec2 {
  return { x: v.x * amount, z: v.z * amount };
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.z);
}

export function distance(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

export function normalize(v: Vec2): Vec2 {
  const magnitude = length(v);

  if (magnitude === 0) {
    return { x: 0, z: 0 };
  }

  return { x: v.x / magnitude, z: v.z / magnitude };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: lerp(a.x, b.x, t),
    z: lerp(a.z, b.z, t)
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function clampToPond(point: Vec2, width: number, height: number, marginRatio: number): Vec2 {
  const marginX = width * marginRatio;
  const marginZ = height * marginRatio;

  return {
    x: clamp(point.x, width * -0.5 + marginX, width * 0.5 - marginX),
    z: clamp(point.z, height * -0.5 + marginZ, height * 0.5 - marginZ)
  };
}

export function seededRandom(seed: string) {
  let hash = 2166136261;

  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
