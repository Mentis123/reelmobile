import * as THREE from 'three';

import type { ProceduralAudio } from '@/game/audio/procedural';
import { createInitialFish, type FishSnapshot } from '@/game/fish/fishStateMachine';
import { speciesTuning, type FishCueKind } from '@/game/fish/species';
import { DEFAULT_LURE_ID, DEFAULT_ROD_ID, rodMods } from '@/game/gear/gear';
import { add, clamp, clampToPond, distance, lerp, lerpVec, normalize, scale, seededRandom, sub, type Vec2 } from '@/game/math/vec';
import { createVerletLine } from '@/game/physics/verletLine';
import { useGameStore } from '@/game/state/gameStore';
import { vibrate } from '@/game/haptics/haptics';
import { TUNING } from '@/game/tuning/tuning';
import { track } from '@/game/telemetry/track';
import type { DecorFish, Runtime, SceneProps, ScreenPoint } from '@/components/game/types';

export function createRuntime(seed: string, spawnIndex = 0): Runtime {
  const rng = seededRandom(`${seed}-spawn-${spawnIndex}`);
  const lurePos = { ...TUNING.world.lureStart };
  const fish = createInitialFish(rng);
  const fishSpecies = speciesTuning(fish.instance.species);
  // Always fill the pool so the bigger water reads populated and spread out,
  // not sparse (19_THE_FAR_WATER): one primary + (fishMaxVisible - 1) decor.
  const extraCount = TUNING.world.fishMaxVisible - 1;
  const decorFish: DecorFish[] = Array.from({ length: extraCount }, () => ({
    snapshot: createInitialFish(rng),
    fadePhase: rng() * Math.PI * 2,
    fadePeriodMs: lerp(TUNING.world.fishFadeMinPeriodMs, TUNING.world.fishFadeMaxPeriodMs, rng()),
    nextCueAt: nowMs() + lerp(TUNING.fish.decorCueMinMs, TUNING.fish.decorCueMaxMs, rng()),
    cueIndex: 0
  }));

  return {
    state: { kind: 'splash' },
    fish,
    // Default loadout; the component re-stamps the player's saved gear onto the
    // runtime after each createRuntime call (stampGear) so a reset keeps it.
    rodId: DEFAULT_ROD_ID,
    lureId: DEFAULT_LURE_ID,
    fishFadePhase: rng() * Math.PI * 2,
    fishFadePeriodMs: lerp(TUNING.world.fishFadeMinPeriodMs, TUNING.world.fishFadeMaxPeriodMs, rng()),
    decorFish,
    rng,
    lurePos,
    lureVelocity: { x: 0, z: 0 },
    lureY: TUNING.world.lureSurfaceY,
    lureVisible: false,
    lureMovedUntil: 0,
    lureFlashUntil: 0,
    line: createVerletLine(TUNING.world.rodTip, lurePos),
    tension: 0,
    rodOffset: { x: 0, z: 0 },
    rodTargetOffset: { x: 0, z: 0 },
    rodControlActive: false,
    reeling: false,
    reelPulseUntil: 0,
    lastReelTapAt: 0,
    lastBiteAt: 0,
    lastTwitchAt: null,
    focusUntil: 0,
    focusCooldownUntil: 0,
    lateHookUntil: 0,
    hookJerkUntil: 0,
    nextRealCueAt: nowMs() + TUNING.fish.cueRealEveryMs * fishSpecies.cueEveryMultiplier,
    nextFalseCueAt: nowMs() + lerp(TUNING.fish.cueFalseMinMs, TUNING.fish.cueFalseMaxMs, rng()),
    nextStruggleRippleAt: 0,
    nextSurgeAt: 0,
    surgeShakeUntil: 0,
    lastRippleSweepAt: 0,
    spawnIndex,
    realCueIndex: 0,
    restoring: false,
    pondFrozen: false,
    minFps: TUNING.performance.fpsRecovery,
    fpsSamples: [],
    lowFpsSince: 0,
    highFpsSince: 0,
    degradationLevel: 0,
    pixelRatio: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, TUNING.performance.pixelRatioCap),
    aimTarget: null,
    aimSpread: 0
  };
}

export function updateFight(runtime: Runtime, dt: number, onResult: SceneProps['onResult'], audio: ProceduralAudio) {
  if (runtime.state.kind !== 'hooked') {
    return;
  }

  const species = speciesTuning(runtime.fish.instance.species);
  const personalityPull = 1 + runtime.fish.instance.personality * TUNING.fish.personalityModulation;
  const now = performance.now();

  if (runtime.nextSurgeAt > 0 && now >= runtime.nextSurgeAt) {
    const spike = species.surgeTensionSpike * personalityPull;
    runtime.tension = clamp(runtime.tension + spike, 0, 1);
    if (runtime.fish.state.kind === 'hooked') {
      runtime.fish.state = {
        ...runtime.fish.state,
        rage: Math.max(runtime.fish.state.rage, TUNING.fish.fightSurgeRageBoost * personalityPull)
      };
    }
    audio.fishSplash(species.surgeAudioIntensity);
    vibrate(TUNING.haptics.fishSurge);
    runtime.surgeShakeUntil = now + TUNING.ui.surgeShakeMs;
    runtime.nextSurgeAt = scheduleNextSurge(runtime, now);
  }

  const fishPull = runtime.fish.state.kind === 'hooked'
    ? runtime.fish.state.rage * species.hookedPullMultiplier * personalityPull
    : TUNING.fish.personalityScalar;
  // Tap-to-reel tension model. `reeling` is the brief per-tap pulse window (set in
  // reelTap, expired in the frame loop). Inside the pulse, tension still climbs
  // continuously (the fish fights as you crank) on top of the instant per-tap burst
  // reelTap already applied — so sustained rapid tapping stacks toward the snap line.
  // Out of pulse, tension bleeds off at tensionTapDecayRate, so pausing your cadence
  // is what saves the line. (Faster than the old tensionFallRate hold-release fall,
  // because a tap injects a discrete jolt that needs to clear before the next tap.)
  const rise = runtime.reeling
    ? (TUNING.tension.tensionRiseRate + TUNING.tension.tensionReelBoost + fishPull * TUNING.tension.tensionBurstRate) * dt
    : -TUNING.tension.tensionTapDecayRate * dt;
  runtime.tension = clamp(runtime.tension + rise, 0, 1);

  if (!runtime.reeling && runtime.tension < TUNING.tension.lineSlackEscapeThreshold) {
    runtime.state = {
      ...runtime.state,
      slackMs: runtime.state.slackMs + dt * TUNING.timing.msPerSecond
    };
  } else {
    runtime.state = { ...runtime.state, slackMs: 0 };
  }

  if (runtime.tension > runtime.state.peakTension) {
    runtime.state = { ...runtime.state, peakTension: runtime.tension };
  }

  if (runtime.fish.state.kind === 'landed') {
    onResult('catch', runtime.state.peakTension, runtime.state.nearSnaps, runtime.state.hookedAt);
    return;
  }

  // Rod line strength (22_THE_GEAR): the short rod's lower scalar pulls both snap
  // thresholds down so it snaps (and warns) earlier. Matches the render-side
  // effNearSnapThreshold so the warning visual and the actual snap agree. 1.0 default.
  const lineStrengthMult = rodMods(runtime.rodId).lineStrengthMult;
  const effNearSnap = TUNING.tension.nearSnapThreshold * lineStrengthMult;
  const effLineSnap = TUNING.tension.lineSnapThreshold * lineStrengthMult;

  if (runtime.tension > effNearSnap) {
    runtime.state = { ...runtime.state, nearSnaps: runtime.state.nearSnaps + 1 };
    audio.fishSplash(TUNING.audio.struggleSplashIntensity);
  }

  if (runtime.tension > effLineSnap) {
    audio.lineSnap();
    vibrate(TUNING.haptics.lineSnap);
    // The snap kicks the camera harder and longer than any surge (the window
    // overdrives the surge decay curve — see TUNING.ui.snapShakeMs).
    runtime.surgeShakeUntil = now + TUNING.ui.snapShakeMs;
    onResult('snap', runtime.state.peakTension, runtime.state.nearSnaps, runtime.state.hookedAt);
    return;
  }

  if (runtime.state.slackMs > TUNING.tension.slackEscapeWindowMs) {
    audio.escapeSplash();
    vibrate(TUNING.haptics.escape);
    onResult('escape', runtime.state.peakTension, runtime.state.nearSnaps, runtime.state.hookedAt);
    return;
  }

}

export function biteContactBlend(fish: FishSnapshot): number {
  return TUNING.fish.personalityScalar * (1 + fish.instance.personality * TUNING.fish.personalityModulation);
}

export function scheduleNextSurge(runtime: Runtime, now: number): number {
  const species = speciesTuning(runtime.fish.instance.species);
  const surgeMul = Math.max(0.5, 1 + runtime.fish.instance.personality * TUNING.fish.personalityModulation);
  const range = species.surgeIntervalMaxMs - species.surgeIntervalMinMs;
  const intervalMs = (species.surgeIntervalMinMs + runtime.rng() * range) / surgeMul;
  return now + intervalMs;
}

export function cueDuration(cue: FishCueKind): number {
  if (cue === 'glint' || cue === 'tail_flash') {
    return TUNING.fish.cueRippleDurationMs * TUNING.fish.cueFlashDurationMultiplier;
  }

  if (cue === 'surface_rise') {
    return TUNING.fish.cueRippleDurationMs * TUNING.fish.cueSurfaceRiseDurationMultiplier;
  }

  if (cue === 'wake' || cue === 'silt_plume' || cue === 'bubble_trail') {
    return TUNING.fish.cueShadowDurationMs * TUNING.fish.cueLongDurationMultiplier;
  }

  return TUNING.fish.cueRippleDurationMs;
}

export function falseCueKind(rng: () => number): FishCueKind {
  const cues: FishCueKind[] = ['ripple', 'glint', 'surface_rise'];
  return cues[Math.floor(rng() * cues.length)] ?? 'ripple';
}

export function updateRodControl(runtime: Runtime, dt: number) {
  runtime.rodOffset = lerpVec(
    runtime.rodOffset,
    runtime.rodControlActive ? runtime.rodTargetOffset : { x: 0, z: 0 },
    Math.min(1, dt * TUNING.input.rodControlReturnRate)
  );

  const rodTip = rodTipForRuntime(runtime);
  const lineVector = sub(rodTip, runtime.lurePos);
  const lineDistance = Math.hypot(lineVector.x, lineVector.z);
  const rodLoad = clamp(
    Math.hypot(runtime.rodOffset.x, runtime.rodOffset.z) / TUNING.input.rodControlMaxOffsetM * TUNING.input.rodControlTensionGain,
    0,
    1
  );
  runtime.tension = runtime.rodControlActive
    ? lerp(runtime.tension, rodLoad, Math.min(1, dt * TUNING.input.rodControlReturnRate))
    : Math.max(0, runtime.tension - TUNING.tension.tensionSlackFallRate * dt);

  if (runtime.rodControlActive && lineDistance > TUNING.lure.lureTwitchDistanceM) {
    const desiredVelocity = scale(normalize(lineVector), TUNING.input.rodControlLurePullMps * runtime.tension);
    runtime.lureVelocity = lerpVec(
      runtime.lureVelocity,
      desiredVelocity,
      Math.min(1, dt * TUNING.input.rodControlLureAccel)
    );
  } else {
    const decay = Math.exp(-TUNING.input.rodControlLureDamping * dt);
    runtime.lureVelocity = scale(runtime.lureVelocity, decay);
  }

  const speed = Math.hypot(runtime.lureVelocity.x, runtime.lureVelocity.z);
  if (speed > TUNING.input.rodControlLureMinSpeedMps) {
    runtime.lurePos = clampToFishableWater(add(runtime.lurePos, scale(runtime.lureVelocity, dt)));
    runtime.lureMovedUntil = performance.now() + TUNING.lure.lureTwitchDurationMs;
    runtime.lureFlashUntil = performance.now() + TUNING.lure.lureFlashDurationMs;
  } else {
    runtime.lureVelocity = { x: 0, z: 0 };
  }
}

export function promoteNearestFish(runtime: Runtime, point: Vec2) {
  // Only repoint while nothing is engaged yet — once the active fish has noticed
  // the lure it owns the cast, so we don't yank the catchable identity out from
  // under an in-progress approach. Decor fish always wander (they're updated with
  // no lure), so any of them is a valid fresh candidate.
  if (runtime.fish.state.kind !== 'wander') {
    return;
  }

  let bestIndex = -1;
  let bestDist = distance(runtime.fish.position, point);
  for (let i = 0; i < runtime.decorFish.length; i++) {
    const d = distance(runtime.decorFish[i].snapshot.position, point);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) {
    // Swap snapshots only; the slot's fade phase/period stay put. The fish that
    // was nearest the splash is now the primary (catchable) fish, and the old
    // primary drifts on as decor. If even the nearest fish is beyond its notice
    // radius (a long blind cast into empty dark), it simply won't engage — the
    // cast misses, which is the intended gamble, not a guaranteed bite.
    const promoted = runtime.decorFish[bestIndex].snapshot;
    runtime.decorFish[bestIndex].snapshot = runtime.fish;
    runtime.fish = promoted;
  }
}

export function updateHookedContactPoint(runtime: Runtime, dt: number) {
  if (runtime.state.kind !== 'hooked') {
    return;
  }

  const waterEntryTarget = clampToFishableWater(rodTipForRuntime(runtime));

  if (runtime.reeling) {
    const toRod = sub(waterEntryTarget, runtime.fish.position);
    const distanceToRod = Math.hypot(toRod.x, toRod.z);
    const pullDistance = Math.min(
      distanceToRod,
      TUNING.fish.reelContactPullMps * (0.35 + runtime.tension) * dt
    );

    if (distanceToRod > 0) {
      const pull = scale(normalize(toRod), pullDistance);
      runtime.fish = {
        ...runtime.fish,
        position: add(runtime.fish.position, pull)
      };
    }
  }

  // Hard safety net: momentum (lineDamping 0.98) can carry the fish past its
  // clamped flee target, so pin the hooked fish inside the visible arena every
  // frame — it can fight to the edge of the frame but never swim out of it.
  runtime.fish = {
    ...runtime.fish,
    position: {
      x: clamp(runtime.fish.position.x, -TUNING.world.hookedArenaHalfWidthM, TUNING.world.hookedArenaHalfWidthM),
      z: clamp(runtime.fish.position.z, TUNING.world.fishableMinZ, TUNING.world.fishableMaxZ)
    }
  };

  runtime.lurePos = { x: runtime.fish.position.x, z: runtime.fish.position.z };
  runtime.lureY = TUNING.world.lureSinkDepthY;
}

export function updatePerformance(
  runtime: Runtime,
  dt: number,
  gl: THREE.WebGLRenderer,
  setPixelRatio: (pixelRatio: number) => void,
  setDebugMetrics: ReturnType<typeof useGameStore.getState>['setDebugMetrics'],
  recordPerf: (avgFps: number, minFps: number) => void,
  recordPixelRatioDegradation: () => void
) {
  const now = performance.now();
  const fps = 1 / Math.max(dt, 1 / TUNING.performance.fpsRecovery);
  runtime.minFps = Math.min(runtime.minFps, fps);
  runtime.fpsSamples.push({ at: now, fps });
  runtime.fpsSamples = runtime.fpsSamples.filter((sample) => now - sample.at < TUNING.timing.debugFiveSecondMs);
  const oneSecond = runtime.fpsSamples.filter((sample) => now - sample.at < TUNING.timing.debugSampleMs);
  const avg1 = average(oneSecond.map((sample) => sample.fps));
  const avg5 = average(runtime.fpsSamples.map((sample) => sample.fps));

  if (avg1 < TUNING.performance.fpsFloor) {
    runtime.lowFpsSince += dt * TUNING.timing.msPerSecond;
    runtime.highFpsSince = 0;

    if (runtime.lowFpsSince > TUNING.performance.degradeHoldMs && runtime.pixelRatio > TUNING.performance.pixelRatioMin) {
      const from = runtime.pixelRatio;
      runtime.pixelRatio = Math.max(TUNING.performance.pixelRatioMin, runtime.pixelRatio - TUNING.performance.pixelRatioStep);
      runtime.degradationLevel += 1;
      gl.setPixelRatio(runtime.pixelRatio);
      setPixelRatio(runtime.pixelRatio);
      runtime.lowFpsSince = 0;
      recordPixelRatioDegradation();
      track({ type: 'pixel_ratio_degraded', from, to: runtime.pixelRatio });
    }
  } else if (avg1 > TUNING.performance.fpsRecovery) {
    runtime.highFpsSince += dt * TUNING.timing.msPerSecond;
    runtime.lowFpsSince = 0;

    if (runtime.highFpsSince > TUNING.performance.recoverHoldMs && runtime.pixelRatio < TUNING.performance.pixelRatioCap) {
      runtime.pixelRatio = Math.min(TUNING.performance.pixelRatioCap, runtime.pixelRatio + TUNING.performance.pixelRatioStep);
      gl.setPixelRatio(runtime.pixelRatio);
      setPixelRatio(runtime.pixelRatio);
      runtime.highFpsSince = 0;
    }
  }

  const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
  const jsHeapMb = memory.memory
    ? memory.memory.usedJSHeapSize / (TUNING.timing.msPerSecond * TUNING.timing.msPerSecond)
    : null;

  setDebugMetrics({
    fps,
    avgFps1s: avg1,
    avgFps5s: avg5,
    drawCalls: gl.info.render.calls,
    triangles: gl.info.render.triangles,
    textureCount: gl.info.memory.textures,
    jsHeapMb,
    pixelRatio: runtime.pixelRatio,
    degradationLevel: runtime.degradationLevel
  });
  recordPerf(avg5, runtime.minFps);
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const THREE_UP = new THREE.Vector3(0, 1, 0);

export function projectVecToScreen(vec: THREE.Vector3, camera: THREE.Camera, size: { width: number; height: number }): ScreenPoint {
  vec.project(camera);
  return {
    x: (vec.x * 0.5 + 0.5) * size.width,
    y: (-vec.y * 0.5 + 0.5) * size.height
  };
}

// Allocation-free variant for the per-frame line projection: writes into `out`.
export function projectVecToScreenInto(vec: THREE.Vector3, camera: THREE.Camera, size: { width: number; height: number }, out: ScreenPoint): void {
  vec.project(camera);
  out.x = (vec.x * 0.5 + 0.5) * size.width;
  out.y = (-vec.y * 0.5 + 0.5) * size.height;
}

export function visualLineTensionFor(tension: number): number {
  const range = TUNING.line.lineVisualTautFull - TUNING.line.lineVisualTautStart;

  if (range <= 0) {
    return tension;
  }

  return Math.min(1, Math.max(0, (tension - TUNING.line.lineVisualTautStart) / range));
}

export function rodTipFor(tension: number, hookImpulse = 0): Vec2 {
  return {
    x: TUNING.world.rodTip.x - TUNING.world.rodBendMaxM * (tension + hookImpulse),
    z: TUNING.world.rodTip.z + TUNING.world.rodBendMaxM * (tension + hookImpulse)
  };
}

export function rodTipForRuntime(runtime: Runtime, hookImpulse = 0): Vec2 {
  const bend = rodTipFor(runtime.tension, hookImpulse);

  return {
    x: bend.x + runtime.rodOffset.x,
    z: bend.z + runtime.rodOffset.z
  };
}

export function isEarlyHookAttempt(fishStateKind: string): boolean {
  return TUNING.fish.earlyHookStates.some((state) => state === fishStateKind);
}

export function canPendingTouchBecomeCast(runtime: Runtime): boolean {
  return runtime.state.kind === 'lure_idle' && runtime.lateHookUntil <= performance.now();
}

export function distancePointToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const segment = sub(end, start);
  const lengthSq = segment.x * segment.x + segment.z * segment.z;

  if (lengthSq === 0) {
    return distance(point, start);
  }

  const t = clamp(((point.x - start.x) * segment.x + (point.z - start.z) * segment.z) / lengthSq, 0, 1);
  return distance(point, {
    x: start.x + segment.x * t,
    z: start.z + segment.z * t
  });
}

export function clampRodOffset(offset: Vec2): Vec2 {
  const length = Math.hypot(offset.x, offset.z);

  if (length <= TUNING.input.rodControlMaxOffsetM) {
    return offset;
  }

  return scale(normalize(offset), TUNING.input.rodControlMaxOffsetM);
}

export function hookImpulseFor(runtime: Runtime, now: number): number {
  if (now >= runtime.hookJerkUntil) {
    return 0;
  }

  return (runtime.hookJerkUntil - now) / TUNING.timing.hookJerkMs;
}

export function fishDistanceVisibility(position: Vec2): number {
  // 1 at the near foreshore (clear water), fading to fishFarVisibility out at the
  // far shore — the dark you cast blind into, and the clarity you reel a hooked
  // fish back into (19_THE_FAR_WATER). Curve > 1 so the far half goes murky fast.
  const nearness = clamp(
    (position.z - TUNING.world.fishableMinZ) / (TUNING.world.fishableMaxZ - TUNING.world.fishableMinZ),
    0,
    1
  );
  const shaped = Math.pow(nearness, TUNING.world.fishFarVisibilityCurve);

  return lerp(TUNING.world.fishFarVisibility, TUNING.world.fishNearVisibility, shaped);
}

export function fishRevealAmount(position: Vec2): number {
  // 0 = far in the dark (size unknown), 1 = near in clear water (fully resolved).
  // Smoothstep so identity eases in as a hooked fish is reeled toward the bank,
  // and a far shadow stays ambiguous until it commits to the near water
  // (21_THE_REVEAL).
  const a = TUNING.world.revealNoneZ;
  const b = TUNING.world.revealFullZ;
  const t = clamp((position.z - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function fishFadeMultiplier(nowMs: number, phase: number, periodMs: number): number {
  const t = (Math.sin((nowMs / periodMs) * Math.PI * 2 + phase) + 1) * 0.5;
  return lerp(TUNING.world.fishFadeMinMultiplier, TUNING.world.fishFadeMaxMultiplier, t);
}

export function nowMs(): number {
  return typeof performance === 'undefined' ? 0 : performance.now();
}

export function clampToFishableWater(point: Vec2): Vec2 {
  const clamped = clampToPond(
    point,
    TUNING.world.pondWidthM,
    TUNING.world.pondHeightM,
    TUNING.world.pondMarginRatio
  );

  return {
    ...clamped,
    z: clamp(clamped.z, TUNING.world.fishableMinZ, TUNING.world.fishableMaxZ)
  };
}
