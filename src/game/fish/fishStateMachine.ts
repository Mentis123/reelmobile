import { add, clamp, distance, normalize, scale, sub, type Vec2 } from '@/game/math/vec';
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
  // Equipped-lure gear scalars (22_THE_GEAR): how far this lure draws a fish
  // (notice) and how easily it spooks one (fear). Default lure = 1.0 (no-op).
  // Passed only for the player's primary fish; decor fish get 1.0 (they ignore
  // the lure entirely).
  lureAttractMult: number;
  lureFearMult: number;
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
  // Spawn anywhere across the whole fishable water — near to far — so the fish
  // start spread out across the expanse instead of all bunched in the near
  // foreground (19_THE_FAR_WATER). They wander from there.
  return {
    position: nextWanderTarget(seedRand),
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

/**
 * Evolve one fish for one frame. Pure: (input, snapshot) -> snapshot.
 *
 * State ladder (04_SPOTTING_AND_PERCEPTION / 01_GAME_SPEC):
 *
 *   wander --lure within noticeRadius--> notice --noticeWait--> approach
 *     --within inspectOrbitRadius--> inspect --inspectDuration--> commit
 *     --biteEta expires--> bite --hooked input--> hooked --stamina drained--> landed
 *
 *   bite --biteNoHookMs with no hookset--> flee --fleeDuration--> wander
 *   any pre-hook state --lure moved inside fearRadius--> flee (spook)
 *
 * Durations scale by species multipliers and per-instance personality
 * (hesitation). dt is SECONDS; nowMs is the simulation clock (performance.now).
 */
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
  } else if (input.lureMoved && lurePos && shouldSpook(state.kind) && distance(fish.position, lurePos) < fearRadius(fish.instance, input.lureFearMult)) {
    nextState = { kind: 'flee', targetPos: fleeTarget(fish.position, fish.instance.personality), sinceMs: 0 };
  } else if (state.kind === 'wander') {
    nextState = { ...state, sinceMs: state.sinceMs + dtMs };
    target = state.targetPos;

    if (distance(fish.position, state.targetPos) < TUNING.fish.biteDistanceM) {
      nextState = { kind: 'wander', targetPos: nextWanderTarget(input.rng), sinceMs: 0 };
      target = nextState.targetPos;
    }

    if (lurePos && distance(fish.position, lurePos) < noticeRadius(fish.instance, input.lureAttractMult)) {
      nextState = { kind: 'notice', lurePos, alertness: fish.instance.personality, sinceMs: 0 };
    }
  } else if (state.kind === 'notice') {
    nextState = { ...state, lurePos: lurePos ?? state.lurePos, sinceMs: state.sinceMs + dtMs };
    target = state.lurePos;
    speed = TUNING.fish.wanderSpeedMps * species.wanderSpeedMultiplier;

    const noticeWait =
      TUNING.fish.noticeDurationMs *
      species.commitThresholdMultiplier *
      hesitation(fish.instance.personality);

    if (state.sinceMs > noticeWait && lurePos) {
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
    const inspectDuration =
      TUNING.fish.inspectDurationMs *
      species.inspectDurationMultiplier *
      species.commitThresholdMultiplier *
      hesitation(fish.instance.personality);
    const orbit = {
      x: nextLurePos.x + Math.cos(input.nowMs / inspectDuration) * TUNING.fish.inspectOrbitRadiusM,
      z: nextLurePos.z + Math.sin(input.nowMs / inspectDuration) * TUNING.fish.inspectOrbitRadiusM
    };
    nextState = { ...state, lurePos: nextLurePos, patience: state.patience, sinceMs: state.sinceMs + dtMs };
    target = orbit;
    speed = TUNING.fish.approachSpeedMps * species.approachSpeedMultiplier * state.patience;

    if (state.sinceMs > inspectDuration && lurePos) {
      const biteEtaMs =
        TUNING.fish.commitDurationMs *
        species.commitDurationMultiplier *
        hesitation(fish.instance.personality);
      nextState = { kind: 'commit', lurePos, biteEtaMs, sinceMs: 0 };
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
      nextState = { kind: 'flee', targetPos: fleeTarget(fish.position, fish.instance.personality), sinceMs: 0 };
    }
  } else if (state.kind === 'hooked') {
    const stamina = Math.max(0, state.stamina - TUNING.fish.fishStaminaDrainRate * species.staminaDrainMultiplier * input.dt);
    const baseline =
      TUNING.fish.rageBaseline + fish.instance.personality * TUNING.fish.personalityModulation * 0.5;
    const decayedRage = Math.max(baseline, state.rage - TUNING.fish.rageDecayPerSecond * input.dt);
    nextState = stamina <= TUNING.fish.staminaLandThreshold
      ? { kind: 'landed' }
      : { kind: 'hooked', stamina, rage: decayedRage };
    target = fleeTarget(fish.position, fish.instance.personality);
    speed = TUNING.fish.hookedPullSpeedMps * species.hookedPullMultiplier + decayedRage * TUNING.tension.tensionBurstRate;
  } else if (state.kind === 'flee') {
    nextState = { ...state, sinceMs: state.sinceMs + dtMs };
    target = state.targetPos;
    speed = TUNING.fish.approachSpeedMps * species.approachSpeedMultiplier;

    const fleeDuration =
      TUNING.fish.fleeDurationMs * hesitation(fish.instance.personality);

    if (state.sinceMs > fleeDuration) {
      nextState = { kind: 'wander', targetPos: nextWanderTarget(input.rng), sinceMs: 0 };
    }
  }

  const desired = scale(normalize(sub(target, fish.position)), speed);
  // Frame-rate-normalized damping: pow keeps energy loss per second constant
  // across 60Hz/120Hz displays (raw per-frame multipliers damp twice as fast
  // per second at 120Hz, making fish feel sluggish on ProMotion screens).
  const damping = Math.pow(TUNING.fish.velocityDamping, input.dt * 60);
  const velocity = add(scale(fish.velocity, damping), scale(desired, input.dt));
  const position = add(fish.position, scale(velocity, input.dt));

  return {
    position,
    velocity,
    state: nextState,
    instance: fish.instance
  };
}

function noticeRadius(instance: FishInstance, lureAttractMult = 1): number {
  return TUNING.fish.fishNoticeRadius * speciesTuning(instance.species).noticeRadiusMultiplier * personalityMultiplier(instance.personality) * lureAttractMult;
}

function fearRadius(instance: FishInstance, lureFearMult = 1): number {
  return TUNING.fish.fishFearRadius * speciesTuning(instance.species).fearRadiusMultiplier * personalityMultiplier(instance.personality) * lureFearMult;
}

function curiosityForTwitch(lureMoved: boolean, instance: FishInstance): number {
  const personality = personalityMultiplier(instance.personality);
  return lureMoved ? personality : 2 - personality;
}

function shouldSpook(kind: FishState['kind']): boolean {
  return kind === 'wander' || kind === 'notice' || kind === 'approach' || kind === 'inspect';
}

function hesitation(personality: number): number {
  return Math.max(0.4, 1 - personality * TUNING.fish.personalityHesitation);
}

function fleeTarget(position: Vec2, personality = 0): Vec2 {
  const reach = TUNING.world.fishWanderRadiusM * (1 + personality * TUNING.fish.personalityModulation);
  const bias = Math.sign(position.x) || (personality >= 0 ? 1 : -1);
  // Keep the flee/fight target inside the visible arena. Unbounded, x could push
  // ~7.8m past the fish — far off the visible water (a hooked fish swimming off
  // screen). Clamp x to the on-screen arena and z to the fishable band so the
  // fight always plays out where the player can see it.
  return {
    x: clamp(position.x + bias * reach, -TUNING.world.hookedArenaHalfWidthM, TUNING.world.hookedArenaHalfWidthM),
    z: clamp(Math.min(position.z + reach, TUNING.world.fishableMaxZ), TUNING.world.fishableMinZ, TUNING.world.fishableMaxZ)
  };
}
