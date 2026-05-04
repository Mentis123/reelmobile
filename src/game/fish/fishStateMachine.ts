import { add, distance, normalize, scale, sub, type Vec2 } from '@/game/math/vec';
import { TUNING } from '@/game/tuning/tuning';
import { createFishInstance, createFishInstanceOfSpecies, personalityMultiplier, speciesTuning, type FishInstance, type SpeciesId } from '@/game/fish/species';

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
  instance: FishInstance;
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
  const instance = createFishInstance(seedRand);
  return spawnFishFromInstance(seedRand, instance);
}

export function createDecorFish(seedRand: () => number, species: SpeciesId): FishSnapshot {
  const instance = createFishInstanceOfSpecies(seedRand, species);
  return spawnFishFromInstance(seedRand, instance);
}

function spawnFishFromInstance(seedRand: () => number, instance: FishInstance): FishSnapshot {
  const offset = (seedRand() - 0.5) * TUNING.world.fishWanderRadiusM;
  const position = {
    x: TUNING.world.fishStart.x + offset,
    z: TUNING.world.fishStart.z + (seedRand() - 0.5) * TUNING.world.fishWanderRadiusM * 0.5
  };

  return {
    position,
    velocity: { x: 0, z: 0 },
    state: { kind: 'wander', targetPos: nextWanderTarget(seedRand), sinceMs: 0 },
    instance
  };
}

export function nextWanderTarget(rng: () => number): Vec2 {
  const margin = TUNING.world.pondMarginRatio * TUNING.world.pondWidthM;
  const minX = -TUNING.world.pondWidthM * 0.5 + margin;
  const maxX = TUNING.world.pondWidthM * 0.5 - margin;
  const minZ = TUNING.world.fishableMinZ;
  const maxZ = TUNING.world.fishableMaxZ;

  return {
    x: minX + rng() * (maxX - minX),
    z: minZ + rng() * (maxZ - minZ)
  };
}

export function updateFish(input: FishUpdateInput, fish: FishSnapshot): FishSnapshot {
  const dtMs = input.dt * TUNING.timing.msPerSecond;
  const state = fish.state;
  const lurePos = input.lurePos;
  let nextState: FishState = state;
  let target = state.kind === 'wander' ? state.targetPos : fish.position;
  const species = speciesTuning(fish.instance.species);
  const personality = personalityMultiplier(fish.instance.personality);
  let speed: number = TUNING.fish.wanderSpeedMps * species.wanderSpeedMultiplier * personality;

  if (input.hooked && state.kind !== 'hooked' && state.kind !== 'landed') {
    nextState = { kind: 'hooked', stamina: TUNING.fish.staminaLandThreshold + 0.9, rage: input.rng() };
  } else if (input.lureMoved && lurePos && shouldSpook(state.kind) && distance(fish.position, lurePos) < fearRadius(fish.instance)) {
    nextState = { kind: 'flee', targetPos: fleeTarget(fish.position), sinceMs: 0 };
  } else if (state.kind === 'wander') {
    nextState = { ...state, sinceMs: state.sinceMs + dtMs };
    target = state.targetPos;

    if (distance(fish.position, state.targetPos) < TUNING.fish.biteDistanceM) {
      nextState = { kind: 'wander', targetPos: nextWanderTarget(input.rng), sinceMs: 0 };
      target = nextState.targetPos;
    }

    if (lurePos && distance(fish.position, lurePos) < noticeRadius(fish.instance)) {
      nextState = { kind: 'notice', lurePos, alertness: fish.instance.personality, sinceMs: 0 };
    }
  } else if (state.kind === 'notice') {
    nextState = { ...state, lurePos: lurePos ?? state.lurePos, sinceMs: state.sinceMs + dtMs };
    target = state.lurePos;
    speed = TUNING.fish.wanderSpeedMps * species.wanderSpeedMultiplier;

    if (state.sinceMs > TUNING.fish.noticeDurationMs * species.commitThresholdMultiplier && lurePos) {
      nextState = { kind: 'approach', lurePos, speed: TUNING.fish.approachSpeedMps * species.approachSpeedMultiplier * personality, sinceMs: 0 };
    }
  } else if (state.kind === 'approach') {
    const nextLurePos = lurePos ?? state.lurePos;
    nextState = { ...state, lurePos: nextLurePos, sinceMs: state.sinceMs + dtMs };
    target = nextLurePos;
    speed = state.speed;

    if (distance(fish.position, nextLurePos) < TUNING.fish.inspectOrbitRadiusM) {
      nextState = { kind: 'inspect', lurePos: nextLurePos, patience: curiosityForTwitch(input.lureMoved, fish.instance), sinceMs: 0 };
    }
  } else if (state.kind === 'inspect') {
    const nextLurePos = lurePos ?? state.lurePos;
    const inspectDuration = TUNING.fish.inspectDurationMs * species.inspectDurationMultiplier * species.commitThresholdMultiplier;
    const orbit = {
      x: nextLurePos.x + Math.cos(input.nowMs / inspectDuration) * TUNING.fish.inspectOrbitRadiusM,
      z: nextLurePos.z + Math.sin(input.nowMs / inspectDuration) * TUNING.fish.inspectOrbitRadiusM
    };
    nextState = { ...state, lurePos: nextLurePos, patience: state.patience, sinceMs: state.sinceMs + dtMs };
    target = orbit;
    speed = TUNING.fish.approachSpeedMps * species.approachSpeedMultiplier * state.patience;

    if (state.sinceMs > inspectDuration && lurePos) {
      nextState = { kind: 'commit', lurePos, biteEtaMs: TUNING.fish.commitDurationMs * species.commitDurationMultiplier, sinceMs: 0 };
    }
  } else if (state.kind === 'commit') {
    const nextLurePos = lurePos ?? state.lurePos;
    nextState = { ...state, lurePos: nextLurePos, biteEtaMs: state.biteEtaMs - dtMs, sinceMs: state.sinceMs + dtMs };
    target = nextLurePos;
    speed = (TUNING.fish.approachSpeedMps * species.approachSpeedMultiplier) + (TUNING.fish.hookedPullSpeedMps * species.hookedPullMultiplier);

    if (state.biteEtaMs <= 0) {
      nextState = { kind: 'bite', biteWindowMs: TUNING.fish.biteWindowMs * species.biteWindowMultiplier, openedAt: input.nowMs };
    }
  } else if (state.kind === 'bite') {
    if (input.nowMs - state.openedAt > TUNING.fish.biteNoHookMs) {
      nextState = { kind: 'flee', targetPos: fleeTarget(fish.position), sinceMs: 0 };
    }
  } else if (state.kind === 'hooked') {
    const stamina = Math.max(0, state.stamina - TUNING.fish.fishStaminaDrainRate * species.staminaDrainMultiplier * input.dt);
    nextState = stamina <= TUNING.fish.staminaLandThreshold
      ? { kind: 'landed' }
      : { kind: 'hooked', stamina, rage: state.rage };
    target = fleeTarget(fish.position);
    speed = TUNING.fish.hookedPullSpeedMps * species.hookedPullMultiplier + state.rage * TUNING.tension.tensionBurstRate;
  } else if (state.kind === 'flee') {
    nextState = { ...state, sinceMs: state.sinceMs + dtMs };
    target = state.targetPos;
    speed = TUNING.fish.approachSpeedMps * species.approachSpeedMultiplier;

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
    state: nextState,
    instance: fish.instance
  };
}

function noticeRadius(instance: FishInstance): number {
  return TUNING.fish.fishNoticeRadius * speciesTuning(instance.species).noticeRadiusMultiplier * personalityMultiplier(instance.personality);
}

function fearRadius(instance: FishInstance): number {
  return TUNING.fish.fishFearRadius * speciesTuning(instance.species).fearRadiusMultiplier * personalityMultiplier(instance.personality);
}

function curiosityForTwitch(lureMoved: boolean, instance: FishInstance): number {
  const personality = personalityMultiplier(instance.personality);
  return lureMoved ? personality : 2 - personality;
}

function shouldSpook(kind: FishState['kind']): boolean {
  return kind === 'wander' || kind === 'notice' || kind === 'approach' || kind === 'inspect';
}

function fleeTarget(position: Vec2): Vec2 {
  return {
    x: position.x + TUNING.world.fishWanderRadiusM,
    z: Math.min(position.z + TUNING.world.fishWanderRadiusM, TUNING.world.fishableMaxZ)
  };
}
