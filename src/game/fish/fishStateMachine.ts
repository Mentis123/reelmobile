import { add, distance, normalize, scale, sub, type Vec2 } from '@/game/math/vec';
import { TUNING } from '@/game/tuning/tuning';

export type FishState =
  | { kind: 'wander'; targetPos: Vec2; sinceMs: number }
  | { kind: 'notice'; lurePos: Vec2; alertness: number; sinceMs: number }
  | { kind: 'approach'; lurePos: Vec2; speed: number; sinceMs: number }
  | { kind: 'inspect'; lurePos: Vec2; patience: number; sinceMs: number }
  | { kind: 'commit'; lurePos: Vec2; biteEtaMs: number; sinceMs: number }
  | { kind: 'bite'; biteWindowMs: number; openedAt: number }
  | { kind: 'hooked'; stamina: number; rage: number }
  | { kind: 'flee'; targetPos: Vec2; sinceMs: number }
  | { kind: 'landed' };

export type FishSnapshot = {
  position: Vec2;
  velocity: Vec2;
  state: FishState;
};

export type FishUpdateInput = {
  nowMs: number;
  dt: number;
  lurePos: Vec2 | null;
  lureMoved: boolean;
  hooked: boolean;
  rng: () => number;
};

export function createInitialFish(seedRand: () => number): FishSnapshot {
  const offset = (seedRand() - 0.5) * TUNING.world.fishWanderRadiusM;
  const position = {
    x: TUNING.world.fishStart.x + offset,
    z: TUNING.world.fishStart.z
  };

  return {
    position,
    velocity: { x: 0, z: 0 },
    state: { kind: 'wander', targetPos: nextWanderTarget(seedRand), sinceMs: 0 }
  };
}

export function nextWanderTarget(rng: () => number): Vec2 {
  const margin = TUNING.world.pondMarginRatio * TUNING.world.pondWidthM;

  return {
    x: Math.max(
      -TUNING.world.pondWidthM * 0.5 + margin,
      Math.min(TUNING.world.pondWidthM * 0.5 - margin, TUNING.world.fishStart.x + (rng() - 0.5) * TUNING.world.fishWanderRadiusM)
    ),
    z: Math.max(
      TUNING.world.fishableMinZ,
      Math.min(TUNING.world.pondHeightM * 0.5 - margin, TUNING.world.fishStart.z + (rng() - 0.5) * TUNING.world.fishWanderRadiusM)
    )
  };
}

export function updateFish(input: FishUpdateInput, fish: FishSnapshot): FishSnapshot {
  const dtMs = input.dt * TUNING.timing.msPerSecond;
  const state = fish.state;
  const lurePos = input.lurePos;
  let nextState: FishState = state;
  let target = state.kind === 'wander' ? state.targetPos : fish.position;
  let speed: number = TUNING.fish.wanderSpeedMps;

  if (input.hooked && state.kind !== 'hooked' && state.kind !== 'landed') {
    nextState = { kind: 'hooked', stamina: TUNING.fish.staminaLandThreshold + 0.9, rage: input.rng() };
  } else if (state.kind === 'wander') {
    nextState = { ...state, sinceMs: state.sinceMs + dtMs };
    target = state.targetPos;

    if (distance(fish.position, state.targetPos) < TUNING.fish.biteDistanceM) {
      nextState = { kind: 'wander', targetPos: nextWanderTarget(input.rng), sinceMs: 0 };
      target = nextState.targetPos;
    }

    if (lurePos && distance(fish.position, lurePos) < noticeRadius()) {
      nextState = { kind: 'notice', lurePos, alertness: TUNING.fish.personalityScalar, sinceMs: 0 };
    }
  } else if (state.kind === 'notice') {
    nextState = { ...state, lurePos: lurePos ?? state.lurePos, sinceMs: state.sinceMs + dtMs };
    target = state.lurePos;
    speed = TUNING.fish.wanderSpeedMps;

    if (state.sinceMs > TUNING.fish.noticeDurationMs && lurePos) {
      nextState = { kind: 'approach', lurePos, speed: TUNING.fish.approachSpeedMps, sinceMs: 0 };
    }
  } else if (state.kind === 'approach') {
    const nextLurePos = lurePos ?? state.lurePos;
    nextState = { ...state, lurePos: nextLurePos, sinceMs: state.sinceMs + dtMs };
    target = nextLurePos;
    speed = state.speed;

    if (distance(fish.position, nextLurePos) < TUNING.fish.inspectOrbitRadiusM) {
      nextState = { kind: 'inspect', lurePos: nextLurePos, patience: curiosityForTwitch(input.lureMoved), sinceMs: 0 };
    }
  } else if (state.kind === 'inspect') {
    const nextLurePos = lurePos ?? state.lurePos;
    const orbit = {
      x: nextLurePos.x + Math.cos(input.nowMs / TUNING.fish.inspectDurationMs) * TUNING.fish.inspectOrbitRadiusM,
      z: nextLurePos.z + Math.sin(input.nowMs / TUNING.fish.inspectDurationMs) * TUNING.fish.inspectOrbitRadiusM
    };
    nextState = { ...state, lurePos: nextLurePos, patience: state.patience, sinceMs: state.sinceMs + dtMs };
    target = orbit;
    speed = TUNING.fish.approachSpeedMps * state.patience;

    if (state.sinceMs > TUNING.fish.inspectDurationMs && lurePos) {
      nextState = { kind: 'commit', lurePos, biteEtaMs: TUNING.fish.commitDurationMs, sinceMs: 0 };
    }
  } else if (state.kind === 'commit') {
    const nextLurePos = lurePos ?? state.lurePos;
    nextState = { ...state, lurePos: nextLurePos, biteEtaMs: state.biteEtaMs - dtMs, sinceMs: state.sinceMs + dtMs };
    target = nextLurePos;
    speed = TUNING.fish.approachSpeedMps + TUNING.fish.hookedPullSpeedMps;

    if (state.biteEtaMs <= 0) {
      nextState = { kind: 'bite', biteWindowMs: TUNING.fish.biteWindowMs, openedAt: input.nowMs };
    }
  } else if (state.kind === 'bite') {
    if (input.nowMs - state.openedAt > TUNING.fish.biteNoHookMs) {
      nextState = { kind: 'flee', targetPos: fleeTarget(fish.position), sinceMs: 0 };
    }
  } else if (state.kind === 'hooked') {
    const stamina = Math.max(0, state.stamina - TUNING.fish.fishStaminaDrainRate * input.dt);
    nextState = stamina <= TUNING.fish.staminaLandThreshold
      ? { kind: 'landed' }
      : { kind: 'hooked', stamina, rage: state.rage };
    target = fleeTarget(fish.position);
    speed = TUNING.fish.hookedPullSpeedMps + state.rage * TUNING.tension.tensionBurstRate;
  } else if (state.kind === 'flee') {
    nextState = { ...state, sinceMs: state.sinceMs + dtMs };
    target = state.targetPos;
    speed = TUNING.fish.approachSpeedMps;

    if (state.sinceMs > TUNING.fish.fleeDurationMs) {
      nextState = { kind: 'wander', targetPos: nextWanderTarget(input.rng), sinceMs: 0 };
    }
  }

  const desired = scale(normalize(sub(target, fish.position)), speed);
  const velocity = add(scale(fish.velocity, TUNING.line.lineDamping), scale(desired, input.dt));
  const position = add(fish.position, scale(velocity, input.dt));

  return {
    position,
    velocity,
    state: nextState
  };
}

function noticeRadius(): number {
  return TUNING.fish.fishNoticeRadius * (1 + TUNING.fish.personalityScalar);
}

function curiosityForTwitch(lureMoved: boolean): number {
  return lureMoved ? 1 + TUNING.fish.personalityScalar : 1 - TUNING.fish.personalityScalar;
}

function fleeTarget(position: Vec2): Vec2 {
  return {
    x: position.x + TUNING.world.fishWanderRadiusM,
    z: position.z + TUNING.world.fishWanderRadiusM
  };
}
