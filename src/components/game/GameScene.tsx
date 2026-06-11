'use client';

import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { updateFish } from '@/game/fish/fishStateMachine';
import { cueForReveal, speciesTuning, SPECIES_IDS, type SpeciesId } from '@/game/fish/species';
import { lureMods } from '@/game/gear/gear';
import { clamp, lerp, lerpVec } from '@/game/math/vec';
import { createId, useSessionStore } from '@/game/persistence/sessionStore';
import { updateVerletLine } from '@/game/physics/verletLine';
import { useGameStore } from '@/game/state/gameStore';
import { vibrate } from '@/game/haptics/haptics';
import { TUNING } from '@/game/tuning/tuning';
import { track } from '@/game/telemetry/track';
import {
  biteContactBlend,
  cueDuration,
  falseCueKind,
  fishDistanceVisibility,
  fishFadeMultiplier,
  fishRevealAmount,
  hookImpulseFor,
  projectVecToScreen,
  projectVecToScreenInto,
  promoteNearestFish,
  rodTipFor,
  rodTipForRuntime,
  THREE_UP,
  updateFight,
  updateHookedContactPoint,
  updatePerformance,
  updateRodControl,
  visualLineTensionFor
} from '@/components/game/runtime';
import { Backdrop, Foreshore, Moon, PondWater, Reeds } from '@/components/game/scene/Environment';
import { createGenericSilhouette, createSpeciesSilhouettes } from '@/components/game/scene/silhouettes';
import { WaterRipples } from '@/components/game/scene/WaterRipples';
import type { SceneProps, ScreenPoint } from '@/components/game/types';

const ASSETS = {
  waterNormal: '/assets/textures/water_normal.webp',
  lureDefault: '/assets/sprites/lure_default.webp'
} as const;

export function GameScene({ started, runtime, audio, setOverlay, setRipples, ripples, setRodOffset, setPixelRatio, onResult, onRestoringChange, onFocusActiveChange }: SceneProps) {
  const fishRefs = useRef<Array<THREE.Mesh | null>>(
    Array.from({ length: TUNING.world.fishMaxVisible }, () => null)
  );
  // Generic "smudge" twin per fish — shown when the fish is far/unknown and
  // crossfaded out as its true silhouette resolves near the clear water
  // (21_THE_REVEAL: identity, not just size, is hidden in the dark).
  const fishGenericRefs = useRef<Array<THREE.Mesh | null>>(
    Array.from({ length: TUNING.world.fishMaxVisible }, () => null)
  );
  const lureRef = useRef<THREE.Mesh>(null);
  const { camera, gl, size } = useThree();
  const cameraShakenRef = useRef(false);
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }, []);
  const projVecRef = useRef(new THREE.Vector3());
  const fishQuatTargetRef = useRef(new THREE.Quaternion());
  const fishQuatFlatRef = useRef(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  const fishYawRef = useRef(new THREE.Quaternion());
  const fishFacingAnglesRef = useRef<Array<number | null>>(
    Array.from({ length: TUNING.world.fishMaxVisible }, () => null)
  );
  const [waterNormalTexture, lureTexture] = useLoader(THREE.TextureLoader, [
    ASSETS.waterNormal,
    ASSETS.lureDefault
  ]);
  const silhouettes = useMemo(() => createSpeciesSilhouettes(), []);
  const genericSilhouette = useMemo(() => createGenericSilhouette(), []);
  const lastSilhouetteSpecies = useRef<Array<SpeciesId | null>>(
    Array.from({ length: TUNING.world.fishMaxVisible }, () => null)
  );
  const setFishState = useGameStore((state) => state.setFishState);
  const setGameState = useGameStore((state) => state.setGameState);
  const setTension = useGameStore((state) => state.setTension);
  const setReeling = useGameStore((state) => state.setReeling);
  const setLureState = useGameStore((state) => state.setLureState);
  const setDebugMetrics = useGameStore((state) => state.setDebugMetrics);
  const setGlHandlersReady = useGameStore((state) => state.setGlHandlersReady);
  const recordPerf = useSessionStore((state) => state.recordPerf);
  const recordPixelRatioDegradation = useSessionStore((state) => state.recordPixelRatioDegradation);
  const recordGlContextLoss = useSessionStore((state) => state.recordGlContextLoss);
  const focusActiveRef = useRef(false);
  const lastSentTensionRef = useRef(0);
  // Reused screen-projection buffer for the line overlay: the points are
  // mutated in place each frame instead of allocating segments+1 fresh objects
  // per frame (GC pressure in the hot loop). setOverlay still receives a new
  // wrapper object, which is what triggers the React update.
  const linePointsBufferRef = useRef<ScreenPoint[]>([]);

  useEffect(() => {
    camera.lookAt(new THREE.Vector3(...TUNING.world.cameraTarget));
  }, [camera]);

  useEffect(() => {
    waterNormalTexture.wrapS = THREE.RepeatWrapping;
    waterNormalTexture.wrapT = THREE.RepeatWrapping;
    waterNormalTexture.repeat.set(2, 2);
    waterNormalTexture.colorSpace = THREE.NoColorSpace;
    waterNormalTexture.needsUpdate = true;

    lureTexture.colorSpace = THREE.SRGBColorSpace;
  }, [lureTexture, waterNormalTexture]);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      runtime.current.restoring = true;
      onRestoringChange(true);
      recordGlContextLoss();
      track({ type: 'gl_context_lost' });
    };
    const restored = () => {
      runtime.current.restoring = false;
      onRestoringChange(false);
      track({ type: 'gl_context_restored' });
    };

    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    setGlHandlersReady(true);

    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      setGlHandlersReady(false);
    };
  }, [gl, onRestoringChange, recordGlContextLoss, runtime, setGlHandlersReady]);

  useFrame((_, rawDt) => {
    if (!started || runtime.current.restoring) {
      return;
    }

    // Clamp runaway frames (tab switch back, GC pause): one huge dt would
    // tunnel through bite windows or snap the line in a single step.
    const dt = Math.min(rawDt, TUNING.timing.maxFrameDtSeconds);

    // Reading the rod/lure explainer pauses the pond — freeze the whole sim so the
    // water and fish hold still. Only ever set during scouting, where nothing
    // time-sensitive (cast/bite/fight) is in flight, so a clean early-return is safe.
    if (runtime.current.pondFrozen) {
      return;
    }

    const now = performance.now();
    const current = runtime.current;
    const gameState = current.state;
    const nextFocusActive = now < current.focusUntil;

    if (nextFocusActive !== focusActiveRef.current) {
      focusActiveRef.current = nextFocusActive;
      onFocusActiveChange(nextFocusActive);
    }

    // Surge camera shake: a fish surge (updateFight) jolts the camera for
    // surgeShakeMs — a decaying lateral tremor so the spike lands physically,
    // not just in the tension bar. Position-only (no re-lookAt): the slight
    // aim wander IS the effect. Skipped under prefers-reduced-motion.
    const shakeRemaining = current.surgeShakeUntil - now;
    if (shakeRemaining > 0 && !reducedMotionRef.current) {
      const decay = shakeRemaining / TUNING.ui.surgeShakeMs;
      const amp = TUNING.ui.surgeShakeAmplitudeM * decay * decay;
      camera.position.set(
        TUNING.world.cameraPosition[0] + Math.sin(now * 0.085) * amp,
        TUNING.world.cameraPosition[1] + Math.cos(now * 0.117) * amp * 0.6,
        TUNING.world.cameraPosition[2]
      );
      cameraShakenRef.current = true;
    } else if (cameraShakenRef.current) {
      cameraShakenRef.current = false;
      camera.position.set(...TUNING.world.cameraPosition);
    }

    if (gameState.kind === 'result') {
      return;
    }

    if (gameState.kind === 'casting') {
      const t = clamp((now - gameState.startedAt) / gameState.flightMs, 0, 1);
      current.lurePos = lerpVec(gameState.from, gameState.target, t);
      current.lureY = TUNING.world.lureSurfaceY + Math.sin(Math.PI * t) * TUNING.input.castArcHeightM * gameState.power;
      setLureState('casting');

      if (t >= 1) {
        // Whichever fish is nearest where the lure just splashed becomes the
        // catchable one — so casting at any visible fish (not just the single
        // privileged primary) makes that fish turn toward the splash and engage.
        // Without this, the 4 decor fish are inert silhouettes that ignore the
        // lure no matter how perfectly you cast at them.
        promoteNearestFish(current, gameState.target);
        current.state = { kind: 'lure_idle', lurePos: gameState.target, sinceMs: now, lastTwitchAt: current.lastTwitchAt };
        current.lureY = TUNING.world.lureSurfaceY;
        audio.current.lurePlop(gameState.power);
        audio.current.fishSplash(TUNING.audio.impactSplashIntensity);
        setRipples((value) => [
          ...value,
          {
            id: createId(),
            pos: gameState.target,
            radius: TUNING.lure.rippleRadiusOnImpactM,
            createdAt: now,
            durationMs: TUNING.fish.cueRippleDurationMs,
            falseCue: false,
            cue: 'ripple'
          }
        ]);
        setGameState(current.state);
      }
    } else if (gameState.kind === 'lure_idle' || gameState.kind === 'rod_control') {
      current.lureY = Math.max(TUNING.world.lureSinkDepthY, current.lureY - TUNING.lure.lureSinkRate * lureMods(current.lureId).sinkMult * dt);
      updateRodControl(current, dt);
      if (gameState.kind === 'rod_control') {
        // Keep the runtime's own state fresh, but don't push it through the
        // store: nothing in React reads lurePos/load, only `.kind` (which is
        // unchanged here), and a per-frame setGameState re-renders every
        // subscriber at 60Hz for nothing.
        current.state = { ...gameState, lurePos: current.lurePos, load: current.tension };
      }
      setLureState(current.rodControlActive ? 'rod-pull' : now < current.lureMovedUntil ? 'twitch' : 'sink');
    } else if (gameState.kind === 'bite_window') {
      const biteT = clamp((now - gameState.openedAt) / TUNING.lure.lureBiteTugDurationMs, 0, 1);
      const tug = Math.sin(biteT * Math.PI * TUNING.lure.lureBiteTugPulses) * (1 - biteT) * TUNING.lure.lureBiteTugAmplitudeM;
      current.lureY = TUNING.world.lureSinkDepthY + tug;
      current.lurePos = lerpVec(gameState.lurePos, current.fish.position, biteContactBlend(current.fish));
      setLureState('twitch');
    } else if (gameState.kind === 'hooked') {
      const hookImpulse = hookImpulseFor(current, now);
      if (hookImpulse > 0) {
        current.lurePos = {
          x: current.lurePos.x + (current.fish.position.x - current.lurePos.x) * hookImpulse * biteContactBlend(current.fish),
          z: current.lurePos.z + TUNING.lure.lureHookJerkDistanceM * hookImpulse
        };
      }
      // Tap-to-reel: a tap set reelPulseUntil; `reeling` is true only inside that
      // pulse window. updateFight + updateHookedContactPoint read this flag, so each
      // tap reels in / raises tension for the pulse, then it lapses until the next tap.
      const wasReeling = current.reeling;
      current.reeling = now < current.reelPulseUntil;
      if (wasReeling && !current.reeling) {
        setReeling(false);
      }
      updateFight(current, dt, onResult, audio.current);
      if (current.tension > TUNING.tension.splashHighTension && now > current.nextStruggleRippleAt) {
        current.nextStruggleRippleAt = now + TUNING.haptics.tensionRepeatMs;
        setRipples((value) => [
          ...value,
          {
            id: createId(),
            pos: current.fish.position,
            radius: TUNING.lure.rippleRadiusOnImpactM * current.tension,
            createdAt: now,
            durationMs: TUNING.fish.cueRippleDurationMs,
            falseCue: false,
            cue: 'ripple'
          }
        ]);
      }
      // No setGameState here: while hooked, updateFight mutates slackMs /
      // nearSnaps / peakTension every frame but React only reads `.kind` and
      // `hookedAt` (both set once at hookset). The result transition publishes
      // through finishResult.
    }

    if (now > current.nextRealCueAt) {
      const species = speciesTuning(current.fish.instance.species);
      // While the catchable fish is still out in the dark its cue is identity-free
      // movement at a neutral radius; only as it resolves near does its own species
      // cue + size show (21_THE_REVEAL).
      const cueReveal = fishRevealAmount(current.fish.position);
      const cue = cueForReveal(current.fish.instance.species, current.realCueIndex, cueReveal, TUNING.fish.cueSpeciesRevealThreshold);
      const cueRadius = cueReveal < TUNING.fish.cueSpeciesRevealThreshold ? TUNING.fish.genericCueRadiusM : species.primaryCueRadiusM;
      current.realCueIndex += 1;
      current.nextRealCueAt = now + TUNING.fish.cueRealEveryMs * species.cueEveryMultiplier;
      setRipples((value) => [
        ...value,
        {
          id: createId(),
          pos: current.fish.position,
          radius: cueRadius,
          createdAt: now,
          durationMs: cueDuration(cue),
          falseCue: false,
          cue
        }
      ]);
    }

    if (now > current.nextFalseCueAt) {
      current.nextFalseCueAt = now + lerp(TUNING.fish.cueFalseMinMs, TUNING.fish.cueFalseMaxMs, current.rng());
      setRipples((value) => [
        ...value,
        {
          id: createId(),
          pos: {
            x: (current.rng() - 0.5) * TUNING.world.pondWidthM,
            z: (current.rng() - 0.5) * TUNING.world.pondHeightM
          },
          radius: TUNING.lure.rippleRadiusOnTwitchM,
          createdAt: now,
          durationMs: TUNING.fish.cueRippleDurationMs,
          falseCue: true,
          cue: falseCueKind(current.rng)
        }
      ]);
    }

    if (current.state.kind === 'bite_window' && now > current.state.closesAt) {
      current.lateHookUntil = now + TUNING.fish.biteNoHookMs;
      current.state = { kind: 'lure_idle', lurePos: current.lurePos, sinceMs: now, lastTwitchAt: current.lastTwitchAt };
      setGameState(current.state);
    }

    if (current.lateHookUntil > 0 && current.state.kind === 'lure_idle' && now > current.lateHookUntil) {
      current.lateHookUntil = 0;
      audio.current.fishSplash(TUNING.audio.missedSplashIntensity);
      vibrate(TUNING.haptics.missed);
      onResult('missed_late', current.tension, 0, now);
      return;
    }

    const previousFishKind: string = current.fish.state.kind;
    const equippedLure = lureMods(current.lureId);
    current.fish = updateFish({
      nowMs: now,
      dt,
      lurePos: current.lureVisible ? current.lurePos : null,
      lureMoved: now < current.lureMovedUntil,
      hooked: current.state.kind === 'hooked',
      rng: current.rng,
      // The equipped lure draws/spooks only the player's primary fish.
      lureAttractMult: equippedLure.attractMult,
      lureFearMult: equippedLure.fearMult
    }, current.fish);
    updateHookedContactPoint(current, dt);

    if (previousFishKind !== 'bite' && current.fish.state.kind === 'bite') {
      const openedAt = now;
      current.lastBiteAt = openedAt;
      current.state = {
        kind: 'bite_window',
        openedAt,
        closesAt: openedAt + TUNING.fish.biteWindowMs,
        lurePos: current.lurePos
      };
      current.lureFlashUntil = openedAt + TUNING.fish.biteWindowMs + TUNING.fish.biteNoHookMs;
      current.lureMovedUntil = openedAt + TUNING.fish.biteWindowMs;
      current.lureY = TUNING.world.lureSinkDepthY;
      setRipples((value) => [
        ...value,
        {
          id: createId(),
          pos: current.fish.position,
          radius: TUNING.lure.rippleRadiusOnTwitchM,
          createdAt: now,
          durationMs: TUNING.fish.cueRippleDurationMs,
          falseCue: false,
          cue: 'ripple'
        },
        {
          id: createId(),
          pos: current.lurePos,
          radius: TUNING.lure.rippleRadiusOnTwitchM,
          createdAt: now,
          durationMs: TUNING.fish.cueRippleDurationMs,
          falseCue: false,
          cue: 'ripple'
        }
      ]);
      audio.current.nibbleTick();
      vibrate(TUNING.haptics.nibbleTick);
      track({ type: 'bite_window_open' });
      setGameState(current.state);
    }

    for (let i = 0; i < current.decorFish.length; i++) {
      const decor = current.decorFish[i];
      decor.snapshot = updateFish({
        nowMs: now,
        dt,
        lurePos: null,
        lureMoved: false,
        hooked: false,
        rng: current.rng,
        // Decor fish ignore the lure entirely — neutral gear (no draw/spook).
        lureAttractMult: 1,
        lureFearMult: 1
      }, decor.snapshot);

      // Alive pond: every fish — not just the catchable one — leaves the odd cue
      // out in the water. Far ones read as identity-free movement, so the whole
      // expanse feels populated without revealing what's where (21_THE_REVEAL).
      if (now > decor.nextCueAt) {
        const decorReveal = fishRevealAmount(decor.snapshot.position);
        const decorSpecies = speciesTuning(decor.snapshot.instance.species);
        const decorCue = cueForReveal(decor.snapshot.instance.species, decor.cueIndex, decorReveal, TUNING.fish.cueSpeciesRevealThreshold);
        const decorRadius = decorReveal < TUNING.fish.cueSpeciesRevealThreshold ? TUNING.fish.genericCueRadiusM : decorSpecies.primaryCueRadiusM;
        decor.cueIndex += 1;
        decor.nextCueAt = now + lerp(TUNING.fish.decorCueMinMs, TUNING.fish.decorCueMaxMs, current.rng());
        setRipples((value) => [
          ...value,
          {
            id: createId(),
            pos: { x: decor.snapshot.position.x, z: decor.snapshot.position.z },
            radius: decorRadius,
            createdAt: now,
            durationMs: cueDuration(decorCue),
            falseCue: false,
            cue: decorCue
          }
        ]);
      }
    }

    const slerpAlpha = Math.min(1, dt * TUNING.fish.fishFacingTurnRate);

    for (let i = 0; i < TUNING.world.fishMaxVisible; i++) {
      const mesh = fishRefs.current[i];
      if (!mesh) {
        const orphanTwin = fishGenericRefs.current[i];
        if (orphanTwin) {
          orphanTwin.visible = false;
        }
        continue;
      }

      const isPrimary = i === 0;
      const snapshot = isPrimary ? current.fish : current.decorFish[i - 1]?.snapshot;
      if (!snapshot) {
        mesh.visible = false;
        const hiddenTwin = fishGenericRefs.current[i];
        if (hiddenTwin) {
          hiddenTwin.visible = false;
        }
        continue;
      }

      mesh.visible = true;
      mesh.position.set(snapshot.position.x, TUNING.world.fishDepthY, snapshot.position.z);
      const speciesId = snapshot.instance.species;
      const species = speciesTuning(speciesId);
      // Size is concealed at distance and resolves on approach (21_THE_REVEAL):
      // far fish render at a uniform ambiguous size, growing (or shrinking) to
      // their true size as they near the clear water.
      const reveal = fishRevealAmount(snapshot.position);
      const commitScalar = snapshot.state.kind === 'commit' ? 1 + TUNING.fish.personalityScalar : 1;
      const fishScaleX = lerp(TUNING.world.revealGenericWidthM, species.widthM * commitScalar, reveal);
      const fishScaleY = lerp(TUNING.world.revealGenericHeightM, species.heightM, reveal);
      mesh.scale.set(fishScaleX, fishScaleY, 1);
      const material = mesh.material as THREE.MeshBasicMaterial;
      if (lastSilhouetteSpecies.current[i] !== speciesId) {
        material.map = silhouettes.get(speciesId) ?? null;
        material.needsUpdate = true;
        lastSilhouetteSpecies.current[i] = speciesId;
      }
      const baseOpacity = snapshot.state.kind === 'commit' || snapshot.state.kind === 'bite'
        ? TUNING.world.fishCommitOpacity
        : TUNING.world.fishCueOpacity;
      const fade = isPrimary
        ? fishFadeMultiplier(now, current.fishFadePhase, current.fishFadePeriodMs)
        : fishFadeMultiplier(now, current.decorFish[i - 1].fadePhase, current.decorFish[i - 1].fadePeriodMs);
      const distanceVis = fishDistanceVisibility(snapshot.position);
      // Crossfade species silhouette (visible only as it resolves near) against
      // the generic smudge twin (visible only while far/unknown), driven by the
      // same reveal amount as the size lerp — so shape, size AND identity all
      // hide in the dark and resolve together (21_THE_REVEAL).
      material.opacity = baseOpacity * species.opacityMultiplier * distanceVis * fade * reveal;
      const twin = fishGenericRefs.current[i];
      if (twin) {
        twin.visible = true;
        twin.position.set(snapshot.position.x, TUNING.world.fishDepthY, snapshot.position.z);
        // Share the species mesh's reveal-lerped size so the crossfade is pure
        // shape — smudge and resolving silhouette stay the same size, not two
        // different-sized shadows blending.
        twin.scale.set(fishScaleX, fishScaleY, 1);
        const twinMaterial = twin.material as THREE.MeshBasicMaterial;
        // One neutral, dampened brightness (no species.opacityMultiplier) so a far
        // shadow neither leaks which species it is nor reads brighter/more spottable
        // than the old per-species far shadow did.
        twinMaterial.opacity = TUNING.world.fishCueOpacity * TUNING.world.revealGenericOpacityMultiplier * distanceVis * fade * (1 - reveal);
      }
      material.color.set(snapshot.state.kind === 'commit' || snapshot.state.kind === 'bite' ? '#202323' : '#111718');

      const speed = Math.hypot(snapshot.velocity.x, snapshot.velocity.z);
      const cachedAngle = fishFacingAnglesRef.current[i];
      if (speed > TUNING.fish.fishFacingMinSpeed || cachedAngle === null) {
        const targetAngle = speed > TUNING.fish.fishFacingMinSpeed
          ? Math.atan2(snapshot.velocity.z, -snapshot.velocity.x)
          : (cachedAngle ?? 0);
        fishFacingAnglesRef.current[i] = targetAngle;
      }
      const targetAngle = fishFacingAnglesRef.current[i] ?? 0;
      fishYawRef.current.setFromAxisAngle(THREE_UP, targetAngle);
      fishQuatTargetRef.current.copy(fishYawRef.current).multiply(fishQuatFlatRef.current);
      mesh.quaternion.slerp(fishQuatTargetRef.current, slerpAlpha);
    }

    if (lureRef.current) {
      lureRef.current.visible = current.lureVisible;
      lureRef.current.position.set(current.lurePos.x, current.lureY, current.lurePos.z);
      const flashing = now < current.lureFlashUntil;
      const material = lureRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = flashing ? 1 : 0.95;
      material.color.set(flashing ? '#f1d47a' : '#ffffff');
    }

    current.line = updateVerletLine(current.line, rodTipForRuntime(current, hookImpulseFor(current, now)), current.lurePos, dt, current.tension);

    const projVec = projVecRef.current;
    const lineSagBase = (1 - visualLineTensionFor(current.tension)) * TUNING.world.lineSagAmplitudeY;
    const linePoints = linePointsBufferRef.current;
    if (linePoints.length !== current.line.points.length) {
      linePoints.length = 0;
      for (let i = 0; i < current.line.points.length; i += 1) {
        linePoints.push({ x: 0, y: 0 });
      }
    }
    for (let index = 0; index < current.line.points.length; index += 1) {
      const point = current.line.points[index];
      const t = index / (current.line.points.length - 1);
      const segmentY = lerp(TUNING.world.rodTipY, current.lureY, t) - Math.sin(t * Math.PI) * lineSagBase;
      projVec.set(point.pos.x, segmentY, point.pos.z);
      projectVecToScreenInto(projVec, camera, size, linePoints[index]);
    }

    const bend = rodTipFor(current.tension, hookImpulseFor(current, now));
    // Aim-sway: while choosing a cast, the visual rod tip leans toward the aim
    // point so the rod tracks where you're about to throw (19_THE_FAR_WATER).
    // This is visual only — the cast origin stays TUNING.world.rodTip — and the
    // line isn't drawn while aiming, so there's nothing to disconnect.
    let tipX = bend.x + current.rodOffset.x;
    let tipZ = bend.z + current.rodOffset.z;
    if (current.aimTarget) {
      tipX += (current.aimTarget.x - TUNING.world.rodTip.x) * TUNING.world.rodAimLeanFraction;
      tipZ += (current.aimTarget.z - TUNING.world.rodTip.z) * TUNING.world.rodAimLeanFraction;
    }
    projVec.set(tipX, TUNING.world.rodTipY, tipZ);
    const rodTipScreen = projectVecToScreen(projVec, camera, size);

    projVec.set(current.lurePos.x, current.lureY, current.lurePos.z);
    const lureScreen = projectVecToScreen(projVec, camera, size);

    let aimTargetScreen: ScreenPoint | null = null;
    let aimRingRx = 0;
    let aimRingRy = 0;
    if (current.aimTarget) {
      const r = current.aimSpread;
      const surfaceY = TUNING.world.lureSurfaceY;
      // Center stays the direct projection of the aim point (keeps the dotted
      // aim line ending exactly on target). The ring is the real landing disc of
      // radius r on the water plane: project its four cardinal points and read
      // the screen half-spans. A Z offset foreshortens far harder than an X
      // offset under this camera, so rx > ry — the ring reads as an ellipse
      // lying on the pond, flatter the farther you aim (19_THE_FAR_WATER).
      projVec.set(current.aimTarget.x, surfaceY, current.aimTarget.z);
      aimTargetScreen = projectVecToScreen(projVec, camera, size);

      projVec.set(current.aimTarget.x + r, surfaceY, current.aimTarget.z);
      const east = projectVecToScreen(projVec, camera, size);
      projVec.set(current.aimTarget.x - r, surfaceY, current.aimTarget.z);
      const west = projectVecToScreen(projVec, camera, size);
      projVec.set(current.aimTarget.x, surfaceY, current.aimTarget.z + r);
      const nearEdge = projectVecToScreen(projVec, camera, size);
      projVec.set(current.aimTarget.x, surfaceY, current.aimTarget.z - r);
      const farEdge = projectVecToScreen(projVec, camera, size);

      aimRingRx = (Math.abs(east.x - aimTargetScreen.x) + Math.abs(aimTargetScreen.x - west.x)) * 0.5;
      const rawRy = (Math.abs(nearEdge.y - aimTargetScreen.y) + Math.abs(aimTargetScreen.y - farEdge.y)) * 0.5;
      // rawRy is the honest projected z-extent. Floor it only against a truly
      // degenerate grazing collapse to a line — across the real fishable range
      // the true ry/rx never drops below ~0.44, so this legibility guard stays
      // inert and never overstates the actual landing zone.
      aimRingRy = Math.max(rawRy, aimRingRx * 0.1);
    }

    // Sweep faded ripples so their meshes/geometries/materials unmount instead of
    // piling up for the whole cast cycle (07_PERFORMANCE_BUDGET draw-call/triangle
    // budget). Throttled, and only commits a new array when something actually
    // expired — a no-op sweep must not re-render WaterRipples.
    if (now - current.lastRippleSweepAt > TUNING.performance.rippleSweepIntervalMs) {
      current.lastRippleSweepAt = now;
      const grace = TUNING.performance.rippleSweepGraceMs;
      setRipples((value) => {
        const alive = value.filter((ripple) => now - ripple.createdAt < ripple.durationMs + grace);
        return alive.length === value.length ? value : alive;
      });
    }

    setOverlay({ linePoints, rodTip: rodTipScreen, lure: lureScreen, aimTarget: aimTargetScreen, aimRingRx, aimRingRy });
    setRodOffset(current.rodOffset);
    // Publish fish state only on kind transitions — the UI reads `.kind` alone
    // (data attribute + debug HUD), and per-frame pushes re-render subscribers
    // at 60Hz over a `sinceMs` counter nothing displays.
    if (current.fish.state.kind !== previousFishKind) {
      setFishState(current.fish.state);
    }
    // Tension drives the HUD bar and line colour; quantize updates below the
    // threshold of a visible change (~0.4% of the bar) instead of 60Hz pushes.
    if (Math.abs(current.tension - lastSentTensionRef.current) > 0.004) {
      lastSentTensionRef.current = current.tension;
      setTension(current.tension);
    }
    // Tap-to-reel uses a discrete reelTick() per tap, so the continuous reel-click LOOP
    // is now driven only by rod-control handling — not the brief per-tap pulse — to
    // avoid doubling a click on top of each tap's tick.
    audio.current.updateLoops(current.tension, current.rodControlActive, current.rodControlActive);
    updatePerformance(current, dt, gl, setPixelRatio, setDebugMetrics, recordPerf, recordPixelRatioDegradation);
  });

  return (
    <>
      <color attach="background" args={[TUNING.visual.voidColor]} />
      <fog attach="fog" args={[TUNING.visual.fogColor, TUNING.visual.fogNear, TUNING.visual.fogFar]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[2.4, 5, 3]} intensity={1.35} />
      <Backdrop />
      <Moon runtime={runtime} />
      <PondWater runtime={runtime} normalMap={waterNormalTexture} />
      <WaterRipples ripples={ripples} />
      <Reeds runtime={runtime} />
      <Foreshore />
      {Array.from({ length: TUNING.world.fishMaxVisible }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            fishRefs.current[i] = node;
          }}
          renderOrder={1}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[TUNING.world.fishStart.x, TUNING.world.fishDepthY, TUNING.world.fishStart.z]}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={silhouettes.get(SPECIES_IDS[0]) ?? null} color="#111718" transparent opacity={TUNING.world.fishCueOpacity} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {Array.from({ length: TUNING.world.fishMaxVisible }, (_, i) => (
        <mesh
          key={`generic-${i}`}
          ref={(node) => {
            fishGenericRefs.current[i] = node;
          }}
          renderOrder={1}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[TUNING.world.fishStart.x, TUNING.world.fishDepthY, TUNING.world.fishStart.z]}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={genericSilhouette} color="#111718" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh ref={lureRef} visible={false} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[TUNING.world.lureStart.x, TUNING.world.lureSurfaceY, TUNING.world.lureStart.z]}>
        <planeGeometry args={[TUNING.lure.lureRadiusM * 4.6, TUNING.lure.lureRadiusM * 2.7]} />
        <meshBasicMaterial map={lureTexture} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
