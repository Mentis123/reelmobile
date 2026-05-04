'use client';

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { ProceduralAudio } from '@/game/audio/procedural';
import { createInitialFish, type FishSnapshot, updateFish } from '@/game/fish/fishStateMachine';
import { pickSpeciesCue, speciesTuning, type FishCueKind } from '@/game/fish/species';
import { add, clamp, clampToPond, distance, lerp, lerpVec, normalize, scale, seededRandom, sub, type Vec2 } from '@/game/math/vec';
import { createId, dailySeed, type Catch, type Failure, useSessionStore } from '@/game/persistence/sessionStore';
import { createVerletLine, type VerletLine, updateVerletLine } from '@/game/physics/verletLine';
import { useGameStore } from '@/game/state/gameStore';
import type { FailureKind, GameState } from '@/game/state/gameStateMachine';
import { TUNING } from '@/game/tuning/tuning';
import { track } from '@/game/telemetry/track';
import { failureStory, generateStory } from '@/game/ui/storyGenerator';

type PointerSnapshot = {
  id: number;
  mode: 'aiming' | 'pending_lure' | 'rod_control' | 'reeling';
  startX: number;
  startY: number;
  x: number;
  y: number;
  downAt: number;
  startRodOffset: Vec2;
};

type Runtime = {
  state: GameState;
  fish: FishSnapshot;
  rng: () => number;
  lurePos: Vec2;
  lureVelocity: Vec2;
  lureY: number;
  lureVisible: boolean;
  lureMovedUntil: number;
  lureFlashUntil: number;
  line: VerletLine;
  tension: number;
  rodOffset: Vec2;
  rodTargetOffset: Vec2;
  rodControlActive: boolean;
  reeling: boolean;
  lastBiteAt: number;
  lastTwitchAt: number | null;
  focusUntil: number;
  focusCooldownUntil: number;
  lateHookUntil: number;
  hookJerkUntil: number;
  nextRealCueAt: number;
  nextFalseCueAt: number;
  nextStruggleRippleAt: number;
  spawnIndex: number;
  realCueIndex: number;
  restoring: boolean;
  minFps: number;
  fpsSamples: Array<{ at: number; fps: number }>;
  lowFpsSince: number;
  highFpsSince: number;
  degradationLevel: number;
  pixelRatio: number;
  aimTarget: Vec2 | null;
};

type Ripple = {
  id: string;
  pos: Vec2;
  radius: number;
  createdAt: number;
  durationMs: number;
  falseCue: boolean;
  cue: FishCueKind;
};

type AimPreview = {
  power: number;
  target: Vec2;
};

type FocusIndicator = {
  id: string;
  x: number;
  y: number;
  createdAt: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type ScreenPoint = {
  x: number;
  y: number;
};

type Overlay = {
  linePoints: ScreenPoint[];
  rodTip: ScreenPoint;
  lure: ScreenPoint;
  aimTarget: ScreenPoint | null;
};

type SceneProps = {
  started: boolean;
  runtime: React.MutableRefObject<Runtime>;
  audio: React.MutableRefObject<ProceduralAudio>;
  setOverlay: React.Dispatch<React.SetStateAction<Overlay>>;
  setRipples: React.Dispatch<React.SetStateAction<Ripple[]>>;
  ripples: Ripple[];
  setRodOffset: (offset: Vec2) => void;
  setPixelRatio: (pixelRatio: number) => void;
  onResult: (outcome: 'catch' | FailureKind, peakTension: number, nearSnaps: number, hookedAt: number) => void;
  onRestoringChange: (restoring: boolean) => void;
  onFocusActiveChange: (active: boolean) => void;
};

const ASSETS = {
  waterNormal: '/assets/textures/water_normal.webp',
  dockPlanks: '/assets/textures/dock_planks.webp',
  fishGeneric: '/assets/sprites/fish_generic.webp',
  lureDefault: '/assets/sprites/lure_default.webp'
} as const;

export function GameClient() {
  const searchParams = useSearchParams();
  const seed = searchParams.get('seed') ?? dailySeed();
  const queryDebug = searchParams.get('debug') === '1';
  const [started, setStarted] = useState(false);
  const [debugOpen, setDebugOpen] = useState(queryDebug || (process.env.NODE_ENV === 'development' && TUNING.ui.debugDefaultDev));
  const [aimPreview, setAimPreview] = useState<AimPreview | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ linePoints: [], rodTip: { x: 0, y: 0 }, lure: { x: 0, y: 0 }, aimTarget: null });
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [rodOffset, setRodOffset] = useState<Vec2>({ x: 0, z: 0 });
  const [pixelRatio, setPixelRatio] = useState(1);
  const [restoring, setRestoring] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const [resultDismissReady, setResultDismissReady] = useState(false);
  const [focusActive, setFocusActive] = useState(false);
  const [focusIndicators, setFocusIndicators] = useState<FocusIndicator[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerSnapshot | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const spawnIndexRef = useRef(0);
  const audio = useRef(new ProceduralAudio());
  const setGameState = useGameStore((state) => state.setGameState);
  const setFishState = useGameStore((state) => state.setFishState);
  const setSeed = useGameStore((state) => state.setSeed);
  const setReeling = useGameStore((state) => state.setReeling);
  const setTension = useGameStore((state) => state.setTension);
  const sessionStore = useSessionStore();
  const gameState = useGameStore((state) => state.gameState);
  const fishState = useGameStore((state) => state.fishState);
  const tension = useGameStore((state) => state.tension);
  const reeling = useGameStore((state) => state.reeling);
  const lureState = useGameStore((state) => state.lureState);
  const debugMetrics = useGameStore((state) => state.debugMetrics);
  const glHandlersReady = useGameStore((state) => state.glHandlersReady);

  const runtime = useRef<Runtime>(createRuntime(seed));

  useEffect(() => {
    spawnIndexRef.current = 0;
    runtime.current = createRuntime(seed);
    startedRef.current = false;
    setStarted(false);
    setSeed(seed);
    setGameState({ kind: 'splash' });
    setFishState(runtime.current.fish.state);
  }, [seed, setFishState, setGameState, setSeed]);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const preventTouch = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-testid="tap-to-begin"], [data-testid="result-card"]')) {
        return;
      }

      event.preventDefault();
    };
    const preventGesture = (event: Event) => {
      event.preventDefault();
    };
    const updateOrientation = () => {
      const nextViewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      setViewport(nextViewport);
      setLandscape(nextViewport.width / nextViewport.height > TUNING.ui.landscapeMinAspect);
    };

    root.addEventListener('touchstart', preventTouch, { passive: false });
    document.addEventListener('gesturestart', preventGesture);
    updateOrientation();
    window.addEventListener('resize', updateOrientation);

    return () => {
      root.removeEventListener('touchstart', preventTouch);
      document.removeEventListener('gesturestart', preventGesture);
      window.removeEventListener('resize', updateOrientation);
    };
  }, []);

  const begin = useCallback(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    void audio.current.unlock()
      .then(() => {
        audio.current.beginConfirm();
      })
      .catch(() => undefined);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    const orientation = screen.orientation as (ScreenOrientation & { lock?: (orientation: 'portrait') => Promise<void> }) | undefined;
    void orientation?.lock?.('portrait').catch(() => undefined);
    navigator.vibrate?.(TUNING.haptics.tapBegin);
    sessionStore.startSession(seed);
    track({ type: 'session_start' });
    runtime.current.state = { kind: 'scouting', sinceMs: performance.now() };
    setGameState(runtime.current.state);
    setStarted(true);
  }, [seed, sessionStore, setGameState]);

  const finishResult = useCallback((outcome: 'catch' | FailureKind, peakTension: number, nearSnaps: number, hookedAt: number) => {
    if (runtime.current.state.kind === 'result') {
      return;
    }

    const now = Date.now();
    let storyText = failureStory(outcome);
    audio.current.stopLoops();

    if (outcome === 'catch') {
      const catchEntry: Catch = {
        id: createId(),
        at: now,
        species: runtime.current.fish.instance.species,
        sizeScore: clamp(peakTension, TUNING.fish.catchMinSizeScore, TUNING.fish.catchMaxSizeScore),
        lure: 'default',
        durationMs: now - hookedAt,
        peakTension,
        nearSnaps,
        storyText: ''
      };
      catchEntry.storyText = generateStory(catchEntry);
      storyText = catchEntry.storyText;
      sessionStore.recordCatch(catchEntry);
      track({ type: 'catch', catch: catchEntry });
      audio.current.catchChime();
      navigator.vibrate?.(TUNING.haptics.catch);
    } else {
      const failure: Failure = {
        at: now,
        kind: outcome,
        context: {
          fishSpecies: runtime.current.fish.instance.species,
          peakTension
        }
      };
      sessionStore.recordFailure(failure);
      track({ type: 'failure', failure });
    }

    runtime.current.state = { kind: 'result', outcome, storyText, shownAt: now, peakTension };
    runtime.current.reeling = false;
    runtime.current.tension = 0;
    runtime.current.lateHookUntil = 0;
    setReeling(false);
    setTension(0);
    setGameState(runtime.current.state);
  }, [sessionStore, setGameState, setReeling, setTension]);

  const resetCast = useCallback(() => {
    spawnIndexRef.current += 1;
    const nextRuntime = createRuntime(seed, spawnIndexRef.current);
    nextRuntime.state = { kind: 'scouting', sinceMs: performance.now() };
    runtime.current = nextRuntime;
    setOverlay({ linePoints: [], rodTip: { x: 0, y: 0 }, lure: { x: 0, y: 0 }, aimTarget: null });
    setRipples([]);
    setRodOffset({ x: 0, z: 0 });
    setReeling(false);
    setGameState(nextRuntime.state);
    setFishState(nextRuntime.fish.state);
  }, [seed, setFishState, setGameState, setReeling]);

  useEffect(() => {
    if (gameState.kind !== 'result') {
      setResultDismissReady(false);
      return undefined;
    }

    setResultDismissReady(false);
    const timeout = window.setTimeout(() => {
      setResultDismissReady(true);
    }, TUNING.timing.resultDismissLockMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [gameState]);

  const clearFocusHold = useCallback(() => {
    if (focusTimeoutRef.current !== null) {
      window.clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }
  }, []);

  const armFocusHold = useCallback((pointerId: number, x: number, y: number) => {
    clearFocusHold();

    if (runtime.current.focusCooldownUntil > performance.now()) {
      return;
    }

    focusTimeoutRef.current = window.setTimeout(() => {
      const pointer = pointerRef.current;
      const state = runtime.current.state.kind;

      if (!pointer || pointer.id !== pointerId || pointer.mode !== 'pending_lure' || (state !== 'scouting' && state !== 'lure_idle')) {
        return;
      }

      const now = performance.now();
      runtime.current.focusUntil = now + TUNING.input.focusDurationMs;
      runtime.current.focusCooldownUntil = runtime.current.focusUntil + TUNING.input.focusCooldownMs;
      setFocusActive(true);
      setFocusIndicators((value) => [...value, { id: createId(), x, y, createdAt: now }]);
      track({ type: 'focus_used' });

      window.setTimeout(() => {
        if (runtime.current.focusUntil <= performance.now()) {
          setFocusActive(false);
        }
      }, TUNING.input.focusDurationMs);
    }, TUNING.input.focusHoldMs);
  }, [clearFocusHold]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!started || runtime.current.state.kind === 'splash') {
      return;
    }

    if (event.pointerType === 'touch' && event.isPrimary === false) {
      setDebugOpen((value) => !value);
      return;
    }

    pointerRef.current = {
      id: event.pointerId,
      mode: 'pending_lure',
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      downAt: performance.now(),
      startRodOffset: { ...runtime.current.rodOffset }
    };
    armFocusHold(event.pointerId, event.clientX, event.clientY);

    if (runtime.current.state.kind === 'hooked') {
      clearFocusHold();
      pointerRef.current.mode = 'reeling';
      runtime.current.reeling = true;
      setReeling(true);
      return;
    }

    if (runtime.current.state.kind === 'lure_idle' && runtime.current.lateHookUntil > performance.now()) {
      resolveMiss('missed_late');
      return;
    }

    if (runtime.current.state.kind === 'lure_idle' && viewport && isRodTouch(event.clientX, event.clientY, viewport)) {
      clearFocusHold();
      pointerRef.current.mode = 'rod_control';
      runtime.current.rodControlActive = true;
      runtime.current.state = {
        kind: 'rod_control',
        lurePos: runtime.current.lurePos,
        sinceMs: performance.now(),
        load: runtime.current.tension
      };
      setGameState(runtime.current.state);
      return;
    }

    if (runtime.current.state.kind === 'scouting') {
      pointerRef.current.mode = 'aiming';
      const cast = computeCast(event.clientX, event.clientY, event.clientX, event.clientY);
      runtime.current.state = {
        kind: 'aiming',
        startPx: { x: event.clientX, z: event.clientY },
        currentPx: { x: event.clientX, z: event.clientY },
        power: cast.power
      };
      runtime.current.aimTarget = cast.target;
      setGameState(runtime.current.state);
      setAimPreview({ power: cast.power, target: cast.target });
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;

    if (!pointer || pointer.id !== event.pointerId) {
      return;
    }

    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) >= TUNING.input.tapMoveTolerancePx) {
      clearFocusHold();
    }

    if (pointer.mode === 'rod_control') {
      runtime.current.rodTargetOffset = clampRodOffset({
        x: pointer.startRodOffset.x + (pointer.x - pointer.startX) / TUNING.ui.worldProjectScale,
        z: pointer.startRodOffset.z - (pointer.y - pointer.startY) / TUNING.input.rodControlScreenPixels
      });
      return;
    }

    if (pointer.mode === 'pending_lure') {
      const moved = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY);

      if (moved < TUNING.input.tapMoveTolerancePx) {
        return;
      }

      if (!canPendingTouchBecomeCast(runtime.current)) {
        return;
      }

      pointer.mode = 'aiming';
      const cast = computeCast(pointer.startX, pointer.startY, pointer.x, pointer.y);
      runtime.current.state = {
        kind: 'aiming',
        startPx: { x: pointer.startX, z: pointer.startY },
        currentPx: { x: pointer.x, z: pointer.y },
        power: cast.power
      };
      runtime.current.aimTarget = cast.target;
      setGameState(runtime.current.state);
      setAimPreview({ power: cast.power, target: cast.target });
      return;
    }

    if (pointer.mode !== 'aiming' || runtime.current.state.kind !== 'aiming') {
      return;
    }

    const cast = computeCast(pointer.startX, pointer.startY, pointer.x, pointer.y);
    runtime.current.state = {
      ...runtime.current.state,
      currentPx: { x: pointer.x, z: pointer.y },
      power: cast.power
    };
    runtime.current.aimTarget = cast.target;
    setGameState(runtime.current.state);
    setAimPreview({ power: cast.power, target: cast.target });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    pointerRef.current = null;
    clearFocusHold();

    if (!started) {
      return;
    }

    if (pointer?.mode === 'reeling' || runtime.current.state.kind === 'hooked') {
      runtime.current.reeling = false;
      setReeling(false);
      return;
    }

    if (pointer?.mode === 'rod_control') {
      runtime.current.rodControlActive = false;
      runtime.current.rodTargetOffset = { x: 0, z: 0 };

      if (runtime.current.state.kind === 'rod_control') {
        runtime.current.state = { kind: 'lure_idle', lurePos: runtime.current.lurePos, sinceMs: performance.now(), lastTwitchAt: runtime.current.lastTwitchAt };
        setGameState(runtime.current.state);
      }
      return;
    }

    if (runtime.current.state.kind === 'bite_window') {
      runtime.current.fish.state = { kind: 'hooked', stamina: TUNING.fish.hookedInitialStamina, rage: runtime.current.rng() };
      runtime.current.tension = TUNING.tension.hookedInitialTension;
      runtime.current.hookJerkUntil = performance.now() + TUNING.timing.hookJerkMs;
      runtime.current.lureMovedUntil = performance.now() + TUNING.timing.hookJerkMs;
      runtime.current.lureFlashUntil = performance.now() + TUNING.timing.hookJerkMs;
      runtime.current.state = {
        kind: 'hooked',
        hookedAt: Date.now(),
        stamina: TUNING.fish.hookedInitialStamina,
        slackMs: 0,
        nearSnaps: 0,
        peakTension: runtime.current.tension
      };
      track({ type: 'hook_attempt', result: 'success' });
      audio.current.hooksetThunk();
      addRipple(runtime.current.lurePos, TUNING.lure.rippleRadiusOnTwitchM, false);
      addRipple(runtime.current.fish.position, TUNING.lure.rippleRadiusOnImpactM, false);
      navigator.vibrate?.(TUNING.haptics.hookset);
      setGameState(runtime.current.state);
      setFishState(runtime.current.fish.state);
      return;
    }

    if (!pointer || pointer.mode === 'pending_lure' || runtime.current.state.kind !== 'aiming') {
      if (runtime.current.state.kind === 'lure_idle' || runtime.current.state.kind === 'rod_control') {
        twitchLure();
      } else if (runtime.current.lateHookUntil > performance.now()) {
        resolveMiss('missed_late');
      }
      return;
    }

    const moved = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    setAimPreview(null);
    runtime.current.aimTarget = null;

    if (moved < TUNING.input.tapMoveTolerancePx && runtime.current.state.kind === 'aiming') {
      if (runtime.current.lateHookUntil > performance.now()) {
        resolveMiss('missed_late');
        return;
      }

      if (isEarlyHookAttempt(runtime.current.fish.state.kind)) {
        resolveMiss('missed_early');
        return;
      }

      runtime.current.state = { kind: 'lure_idle', lurePos: runtime.current.lurePos, sinceMs: performance.now(), lastTwitchAt: runtime.current.lastTwitchAt };
      setGameState(runtime.current.state);
      twitchLure();
      return;
    }

    const cast = computeCast(pointer.startX, pointer.startY, event.clientX, event.clientY);
    const now = Date.now();
    runtime.current.state = {
      kind: 'casting',
      from: TUNING.world.rodTip,
      target: cast.target,
      startedAt: now,
      flightMs: cast.flightMs,
      power: cast.power
    };
    runtime.current.lureVisible = true;
    runtime.current.lurePos = TUNING.world.rodTip;
    runtime.current.lureVelocity = { x: 0, z: 0 };
    runtime.current.lureY = TUNING.world.lureSurfaceY;
    sessionStore.recordCast();
    track({ type: 'cast' });
    audio.current.castWhoosh(cast.power);
    setGameState(runtime.current.state);
  };

  function twitchLure() {
    if (!runtime.current.lureVisible || (runtime.current.state.kind !== 'lure_idle' && runtime.current.state.kind !== 'rod_control')) {
      return;
    }

    if (runtime.current.lateHookUntil > performance.now()) {
      resolveMiss('missed_late');
      return;
    }

    const now = performance.now();
    runtime.current.lastTwitchAt = now;
    runtime.current.lureMovedUntil = now + TUNING.lure.lureTwitchDurationMs;
    runtime.current.lureFlashUntil = now + TUNING.lure.lureFlashDurationMs;
    runtime.current.lurePos = clampToFishableWater({
      x: runtime.current.lurePos.x + (runtime.current.rng() - TUNING.lure.lureTwitchSidewaysRatio) * TUNING.lure.lureTwitchDistanceM,
      z: runtime.current.lurePos.z + TUNING.lure.lureTwitchDistanceM
    });
    runtime.current.lureVelocity = { x: 0, z: 0 };
    runtime.current.state = { kind: 'lure_idle', lurePos: runtime.current.lurePos, sinceMs: now, lastTwitchAt: now };
    addRipple(runtime.current.lurePos, TUNING.lure.rippleRadiusOnTwitchM, false);
    audio.current.lureTwitch();
    setGameState(runtime.current.state);
  }

  function resolveMiss(kind: 'missed_early' | 'missed_late') {
    track({ type: 'hook_attempt', result: kind === 'missed_early' ? 'early' : 'late' });
    audio.current.fishSplash(TUNING.audio.missedSplashIntensity);
    navigator.vibrate?.(TUNING.haptics.missed);
    finishResult(kind, runtime.current.tension, 0, Date.now());
  }

  function addRipple(pos: Vec2, radius: number, falseCue: boolean, cue: FishCueKind = 'ripple') {
    setRipples((value) => [
      ...value,
      {
        id: createId(),
        pos,
        radius,
        createdAt: performance.now(),
        durationMs: falseCue ? TUNING.fish.cueRippleDurationMs : TUNING.fish.cueShadowDurationMs,
        falseCue,
        cue
      }
    ]);
  }

  const previewDots = useMemo(() => {
    if (!aimPreview || !overlay.aimTarget || overlay.rodTip.y <= 0) {
      return [];
    }

    const start = overlay.rodTip;
    const end = overlay.aimTarget;

    return Array.from({ length: TUNING.input.aimPreviewDots }, (_, index) => {
      const t = index / (TUNING.input.aimPreviewDots - 1);
      return {
        id: index,
        x: lerp(start.x, end.x, t),
        y: lerp(start.y, end.y, t) - Math.sin(Math.PI * t) * TUNING.input.aimPreviewPowerPx * aimPreview.power,
        scale: lerp(TUNING.input.aimPreviewDotMinScale, TUNING.input.aimPreviewDotMaxScale, t)
      };
    });
  }, [aimPreview, overlay.aimTarget, overlay.rodTip]);

  const lineColor = tension > TUNING.tension.nearSnapThreshold
    ? TUNING.line.lineSnapColour
    : tension >= TUNING.tension.tensionSweetSpotMin
      ? TUNING.line.lineTautColour
      : TUNING.line.lineSlackColour;
  const hookImpulse = gameState.kind === 'hooked'
    ? Math.max(0, 1 - (Date.now() - gameState.hookedAt) / TUNING.timing.hookJerkMs)
    : 0;
  const lineWidth = (tension > TUNING.tension.nearSnapThreshold
    ? TUNING.line.lineSnapWidthPx
    : tension >= TUNING.tension.tensionSweetSpotMin
      ? TUNING.line.lineTautWidthPx
      : TUNING.line.lineSlackWidthPx) + hookImpulse * TUNING.line.lineHookWidthBoostPx;

  const showLine = gameState.kind === 'casting'
    || gameState.kind === 'lure_idle'
    || gameState.kind === 'rod_control'
    || gameState.kind === 'bite_window'
    || gameState.kind === 'hooked';

  const rodButtScreen = useMemo<ScreenPoint | null>(() => {
    if (!viewport) {
      return null;
    }

    return {
      x: viewport.width * TUNING.world.rodScreenButtXRatio,
      y: viewport.height * (1 - TUNING.world.rodScreenButtBottomRatio)
    };
  }, [viewport]);

  const biteHaloPos = gameState.kind === 'bite_window' ? overlay.lure : null;
  const cuePrompt: { kind: 'tap' | 'hold' | 'ease'; text: string } | null =
    gameState.kind === 'bite_window'
      ? { kind: 'tap', text: 'Tap!' }
      : gameState.kind === 'hooked' && tension > TUNING.ui.reelHintTensionWarn
        ? { kind: 'ease', text: 'Ease off' }
        : gameState.kind === 'hooked' && !reeling
          ? { kind: 'hold', text: 'Hold to reel' }
          : null;
  const showTensionBar = gameState.kind === 'hooked' || gameState.kind === 'rod_control';

  return (
    <main
      ref={rootRef}
      className="game-root"
      data-testid="game-route"
      data-game-state={gameState.kind}
      data-fish-state={fishState.kind}
      data-webgl-handlers={glHandlersReady ? 'ready' : 'pending'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Canvas
        className="game-canvas"
        dpr={pixelRatio}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        camera={{ position: TUNING.world.cameraPosition, fov: TUNING.world.cameraFov }}
      >
        <Suspense fallback={null}>
          <GameScene
            started={started}
            runtime={runtime}
            audio={audio}
            setOverlay={setOverlay}
            setRipples={setRipples}
            ripples={ripples}
            setRodOffset={setRodOffset}
            setPixelRatio={setPixelRatio}
            onResult={finishResult}
            onRestoringChange={setRestoring}
            onFocusActiveChange={setFocusActive}
          />
        </Suspense>
      </Canvas>

      {viewport && rodButtScreen && started && overlay.rodTip.y > 0 ? (
        <svg className="line-overlay" aria-hidden="true">
          {showLine && overlay.linePoints.length > 1 ? (
            <polyline
              points={overlay.linePoints.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={lineColor}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={lineWidth}
            />
          ) : null}
          <defs>
            <linearGradient id="rod-gradient" gradientUnits="userSpaceOnUse"
              x1={rodButtScreen.x} y1={rodButtScreen.y} x2={overlay.rodTip.x} y2={overlay.rodTip.y}>
              <stop offset="0%" stopColor="#2a1a10" />
              <stop offset="35%" stopColor="#5a3e28" />
              <stop offset="78%" stopColor="#8a6a48" />
              <stop offset="100%" stopColor="#c2a878" />
            </linearGradient>
          </defs>
          <path
            d={rodPathFromScreen(rodButtScreen, overlay.rodTip, hookImpulse)}
            fill="none"
            stroke="url(#rod-gradient)"
            strokeLinecap="round"
            strokeWidth={TUNING.world.rodScreenStrokeWidthPx}
          />
          <RodReel rodButtScreen={rodButtScreen} rodTipScreen={overlay.rodTip} />
        </svg>
      ) : null}

      {previewDots.map((dot) => (
        <span
          key={dot.id}
          className="preview-dot"
          style={{ transform: `translate(${dot.x}px, ${dot.y}px) scale(${dot.scale})` }}
        />
      ))}

      {biteHaloPos ? (
        <span
          className="bite-halo"
          style={{ transform: `translate(${biteHaloPos.x}px, ${biteHaloPos.y}px)` }}
        >
          <span className="bite-halo-ring" />
        </span>
      ) : null}

      {focusActive ? <div className="focus-vignette" aria-hidden="true" /> : null}

      {focusIndicators.map((indicator) => {
        const age = performance.now() - indicator.createdAt;
        const opacity = Math.max(0, 1 - age / TUNING.input.focusCooldownMs);

        if (opacity <= 0) {
          return null;
        }

        return (
          <span
            key={indicator.id}
            className="focus-ring"
            style={{
              opacity,
              transform: `translate(${indicator.x}px, ${indicator.y}px) translate(-50%, -50%) scale(${1 + (1 - opacity) * 1.8})`
            }}
          />
        );
      })}

      {cuePrompt ? (
        <div className={`cue-prompt ${cuePrompt.kind}`} data-testid="cue-prompt">
          {cuePrompt.text}
        </div>
      ) : null}

      {showTensionBar ? (
        <div className="tension-bar" aria-hidden="true">
          <div
            className="tension-bar-mark danger"
            style={{ bottom: `${TUNING.tension.nearSnapThreshold * 100}%` }}
          />
          <div
            className="tension-bar-mark"
            style={{ bottom: `${TUNING.tension.tensionSafeHold * 100}%` }}
          />
          <div
            className="tension-bar-fill"
            style={{ height: `${Math.min(1, Math.max(0, tension)) * 100}%` }}
          />
        </div>
      ) : null}

      {started ? null : (
        <button
          className="splash-gate"
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            begin();
          }}
          onClick={begin}
          data-testid="tap-to-begin"
        >
          <span>Reel Mobile</span>
        </button>
      )}

      {gameState.kind === 'result' ? (
        <section
          className="result-card"
          data-testid="result-card"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <p>{gameState.storyText}</p>
          <button
            type="button"
            disabled={!resultDismissReady}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => {
              if (resultDismissReady) {
                resetCast();
              }
            }}
          >
            Cast again.
          </button>
        </section>
      ) : null}

      {restoring ? <div className="restore-overlay">Restoring...</div> : null}
      {landscape ? <div className="restore-overlay">Rotate back to portrait</div> : null}

      {debugOpen ? (
        <DebugHud
          metrics={debugMetrics}
          gameState={gameState.kind}
          fishState={fishState.kind}
          lureState={lureState}
          tension={tension}
          seed={seed}
        />
      ) : null}
    </main>
  );

  function computeCast(startX: number, startY: number, endX: number, endY: number) {
    const drag = {
      x: (endX - startX) / TUNING.input.dragPowerPixels,
      z: (endY - startY) / TUNING.input.dragPowerPixels
    };
    const dragLength = Math.hypot(drag.x, drag.z);
    const power = clamp(dragLength, TUNING.input.castPowerMin, TUNING.input.castPowerMax);
    const rawDirection = normalize(drag);
    const direction = {
      x: rawDirection.x,
      z: Math.min(rawDirection.z, 0)
    };
    const target = clampToPond(
      {
        x: TUNING.world.rodTip.x + direction.x * power * TUNING.input.castMaxRangeM,
        z: TUNING.world.rodTip.z + direction.z * power * TUNING.input.castMaxRangeM
      },
      TUNING.world.pondWidthM,
      TUNING.world.pondHeightM,
      TUNING.world.pondMarginRatio
    );
    const visibleTarget = {
      x: clamp(target.x, -TUNING.input.castVisibleHalfWidthM, TUNING.input.castVisibleHalfWidthM),
      z: Math.min(target.z, TUNING.world.rodTip.z - TUNING.input.castMinForwardM)
    };

    return {
      target: clampToFishableWater(visibleTarget),
      power,
      flightMs: lerp(TUNING.input.castFlightTimeMin, TUNING.input.castFlightTimeMax, power) * TUNING.timing.msPerSecond
    };
  }
}

function GameScene({ started, runtime, audio, setOverlay, setRipples, ripples, setRodOffset, setPixelRatio, onResult, onRestoringChange, onFocusActiveChange }: SceneProps) {
  const fishRef = useRef<THREE.Mesh>(null);
  const lureRef = useRef<THREE.Mesh>(null);
  const { camera, gl, size } = useThree();
  const projVecRef = useRef(new THREE.Vector3());
  const fishQuatTargetRef = useRef(new THREE.Quaternion());
  const fishQuatFlatRef = useRef(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  const fishYawRef = useRef(new THREE.Quaternion());
  const fishFacingAngleRef = useRef<number | null>(null);
  const [waterNormalTexture, dockTexture, fishTexture, lureTexture] = useLoader(THREE.TextureLoader, [
    ASSETS.waterNormal,
    ASSETS.dockPlanks,
    ASSETS.fishGeneric,
    ASSETS.lureDefault
  ]);
  const setFishState = useGameStore((state) => state.setFishState);
  const setGameState = useGameStore((state) => state.setGameState);
  const setTension = useGameStore((state) => state.setTension);
  const setLureState = useGameStore((state) => state.setLureState);
  const setDebugMetrics = useGameStore((state) => state.setDebugMetrics);
  const setGlHandlersReady = useGameStore((state) => state.setGlHandlersReady);
  const recordPerf = useSessionStore((state) => state.recordPerf);
  const recordPixelRatioDegradation = useSessionStore((state) => state.recordPixelRatioDegradation);
  const recordGlContextLoss = useSessionStore((state) => state.recordGlContextLoss);
  const focusActiveRef = useRef(false);

  useEffect(() => {
    camera.lookAt(new THREE.Vector3(...TUNING.world.cameraTarget));
  }, [camera]);

  useEffect(() => {
    waterNormalTexture.wrapS = THREE.RepeatWrapping;
    waterNormalTexture.wrapT = THREE.RepeatWrapping;
    waterNormalTexture.repeat.set(2, 2);
    waterNormalTexture.colorSpace = THREE.NoColorSpace;
    waterNormalTexture.needsUpdate = true;

    dockTexture.wrapS = THREE.RepeatWrapping;
    dockTexture.wrapT = THREE.ClampToEdgeWrapping;
    dockTexture.repeat.set(1, 1);
    dockTexture.colorSpace = THREE.SRGBColorSpace;
    dockTexture.needsUpdate = true;

    fishTexture.colorSpace = THREE.SRGBColorSpace;
    lureTexture.colorSpace = THREE.SRGBColorSpace;
  }, [dockTexture, fishTexture, lureTexture, waterNormalTexture]);

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

  useFrame((_, dt) => {
    if (!started || runtime.current.restoring) {
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

    if (gameState.kind === 'result') {
      return;
    }

    if (gameState.kind === 'casting') {
      const t = clamp((Date.now() - gameState.startedAt) / gameState.flightMs, 0, 1);
      current.lurePos = lerpVec(gameState.from, gameState.target, t);
      current.lureY = TUNING.world.lureSurfaceY + Math.sin(Math.PI * t) * TUNING.input.castArcHeightM * gameState.power;
      setLureState('casting');

      if (t >= 1) {
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
      current.lureY = Math.max(TUNING.world.lureSinkDepthY, current.lureY - TUNING.lure.lureSinkRate * dt);
      updateRodControl(current, dt);
      if (gameState.kind === 'rod_control') {
        current.state = { ...gameState, lurePos: current.lurePos, load: current.tension };
        setGameState(current.state);
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
      setGameState(current.state);
    }

    if (now > current.nextRealCueAt) {
      const cue = pickSpeciesCue(current.fish.instance.species, current.realCueIndex);
      const species = speciesTuning(current.fish.instance.species);
      current.realCueIndex += 1;
      current.nextRealCueAt = now + TUNING.fish.cueRealEveryMs * species.cueEveryMultiplier;
      setRipples((value) => [
        ...value,
        {
          id: createId(),
          pos: current.fish.position,
          radius: species.primaryCueRadiusM,
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
      navigator.vibrate?.(TUNING.haptics.missed);
      onResult('missed_late', current.tension, 0, Date.now());
      return;
    }

    const previousFishKind: string = current.fish.state.kind;
    current.fish = updateFish({
      nowMs: now,
      dt,
      lurePos: current.lureVisible ? current.lurePos : null,
      lureMoved: now < current.lureMovedUntil,
      hooked: current.state.kind === 'hooked',
      rng: current.rng
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
      navigator.vibrate?.(TUNING.haptics.nibbleTick);
      track({ type: 'bite_window_open' });
      setGameState(current.state);
    }

    if (fishRef.current) {
      fishRef.current.position.set(current.fish.position.x, TUNING.world.fishDepthY, current.fish.position.z);
      const species = speciesTuning(current.fish.instance.species);
      fishRef.current.scale.set(
        species.widthM * (current.fish.state.kind === 'commit' ? 1 + TUNING.fish.personalityScalar : 1),
        species.heightM,
        1
      );
      const material = fishRef.current.material as THREE.MeshBasicMaterial;
      const baseOpacity = current.fish.state.kind === 'commit' || current.fish.state.kind === 'bite'
        ? TUNING.world.fishCommitOpacity
        : TUNING.world.fishCueOpacity;
      material.opacity = baseOpacity * species.opacityMultiplier * fishDepthVisibility(current.fish.position);
      material.color.set(current.fish.state.kind === 'commit' || current.fish.state.kind === 'bite' ? '#202323' : '#111718');

      const speed = Math.hypot(current.fish.velocity.x, current.fish.velocity.z);
      if (speed > TUNING.fish.fishFacingMinSpeed || fishFacingAngleRef.current === null) {
        const targetAngle = speed > TUNING.fish.fishFacingMinSpeed
          ? Math.atan2(current.fish.velocity.z, -current.fish.velocity.x)
          : (fishFacingAngleRef.current ?? 0);
        fishFacingAngleRef.current = targetAngle;
      }
      const targetAngle = fishFacingAngleRef.current ?? 0;
      fishYawRef.current.setFromAxisAngle(THREE_UP, targetAngle);
      fishQuatTargetRef.current.copy(fishYawRef.current).multiply(fishQuatFlatRef.current);
      const slerpAlpha = Math.min(1, dt * TUNING.fish.fishFacingTurnRate);
      fishRef.current.quaternion.slerp(fishQuatTargetRef.current, slerpAlpha);
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
    const linePoints: ScreenPoint[] = current.line.points.map((point, index) => {
      const t = index / (current.line.points.length - 1);
      const segmentY = lerp(TUNING.world.rodTipY, current.lureY, t) - Math.sin(t * Math.PI) * lineSagBase;
      projVec.set(point.pos.x, segmentY, point.pos.z);
      return projectVecToScreen(projVec, camera, size);
    });

    const bend = rodTipFor(current.tension, hookImpulseFor(current, now));
    projVec.set(bend.x + current.rodOffset.x, TUNING.world.rodTipY, bend.z + current.rodOffset.z);
    const rodTipScreen = projectVecToScreen(projVec, camera, size);

    projVec.set(current.lurePos.x, current.lureY, current.lurePos.z);
    const lureScreen = projectVecToScreen(projVec, camera, size);

    let aimTargetScreen: ScreenPoint | null = null;
    if (current.aimTarget) {
      projVec.set(current.aimTarget.x, TUNING.world.lureSurfaceY, current.aimTarget.z);
      aimTargetScreen = projectVecToScreen(projVec, camera, size);
    }

    setOverlay({ linePoints, rodTip: rodTipScreen, lure: lureScreen, aimTarget: aimTargetScreen });
    setRodOffset(current.rodOffset);
    setFishState(current.fish.state);
    setTension(current.tension);
    audio.current.updateLoops(current.tension, current.reeling || current.rodControlActive, current.rodControlActive);
    updatePerformance(current, dt, gl, setPixelRatio, setDebugMetrics, recordPerf, recordPixelRatioDegradation);
  });

  return (
    <>
      <color attach="background" args={['#1a2b30']} />
      <fog attach="fog" args={['#1a2b30', 10, 18]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[2.4, 5, 3]} intensity={1.35} />
      <BackgroundCard />
      <PondWater runtime={runtime} normalMap={waterNormalTexture} />
      <WaterRipples ripples={ripples} />
      <Reeds />
      <Dock texture={dockTexture} />
      <Foreshore />
      <mesh ref={fishRef} renderOrder={1} rotation={[-Math.PI / 2, 0, 0]} position={[TUNING.world.fishStart.x, TUNING.world.fishDepthY, TUNING.world.fishStart.z]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={fishTexture} color="#111718" transparent opacity={TUNING.world.fishCueOpacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={lureRef} visible={false} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[TUNING.world.lureStart.x, TUNING.world.lureSurfaceY, TUNING.world.lureStart.z]}>
        <planeGeometry args={[TUNING.lure.lureRadiusM * 4.6, TUNING.lure.lureRadiusM * 2.7]} />
        <meshBasicMaterial map={lureTexture} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function PondWater({ runtime, normalMap }: { runtime: React.MutableRefObject<Runtime>; normalMap: THREE.Texture }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFocus: { value: 0 },
    uNormalMap: { value: normalMap },
    uDeep: { value: new THREE.Color('#1a2b30') },
    uShallow: { value: new THREE.Color('#2f4948') },
    uMoonlight: { value: new THREE.Color('#c8c4b2') },
    uGlareReduction: { value: TUNING.input.focusGlareReduction }
  }), [normalMap]);

  useFrame((_, dt) => {
    const focused = performance.now() < runtime.current.focusUntil;
    uniforms.uFocus.value = focused ? 1 : 0;
    uniforms.uTime.value += dt * (focused ? TUNING.input.focusWaterSpeedMultiplier : 1);
  });

  return (
    <mesh renderOrder={0} rotation={[-Math.PI / 2, 0, 0]} position={[0, TUNING.world.waterY, 0]}>
      <planeGeometry args={[TUNING.world.pondWidthM, TUNING.world.pondHeightM, TUNING.world.waterSegments, TUNING.world.waterSegments]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z += sin((position.x * 1.4) + (position.y * 0.7)) * 0.018;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uFocus;
          uniform sampler2D uNormalMap;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uMoonlight;
          uniform float uGlareReduction;
          varying vec2 vUv;

          void main() {
            vec2 flowA = vUv * 2.0 + vec2(uTime * 0.018, uTime * 0.007);
            vec2 flowB = vUv * 1.15 + vec2(-uTime * 0.009, uTime * 0.012);
            vec3 normalA = texture2D(uNormalMap, flowA).rgb * 2.0 - 1.0;
            vec3 normalB = texture2D(uNormalMap, flowB).rgb * 2.0 - 1.0;
            vec3 normal = normalize(vec3(normalA.xy * 0.58 + normalB.xy * 0.28, 1.0));
            float depth = smoothstep(0.02, 0.92, vUv.y);
            float shore = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
            float fresnel = pow(1.0 - max(normal.z, 0.0), 2.0);
            float focusGlare = 0.24 * (1.0 - uGlareReduction);
            float glint = pow(max(normal.x * 0.65 + normal.y * 0.35, 0.0), 2.0) * mix(0.36, focusGlare, uFocus);
            float wash = 0.04 + 0.035 * sin((vUv.x + vUv.y) * 8.0 + uTime * 0.24);
            vec3 water = mix(uShallow * 1.18, uDeep * 1.08, depth);
            water = mix(water, uMoonlight, fresnel * mix(0.24, 0.1, uFocus) + glint + wash);
            water = mix(water * 0.9, water, shore);
            gl_FragColor = vec4(water, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function WaterRipples({ ripples }: { ripples: Ripple[] }) {
  return (
    <group>
      {ripples.map((ripple) => (
        <WaterRipple key={ripple.id} ripple={ripple} />
      ))}
    </group>
  );
}

function WaterRipple({ ripple }: { ripple: Ripple }) {
  const meshRef = useRef<THREE.Object3D | null>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const setObjectRef = useCallback((node: THREE.Object3D | null) => {
    meshRef.current = node;
  }, []);

  useFrame(() => {
    const age = performance.now() - ripple.createdAt;
    const progress = clamp(age / ripple.durationMs, 0, 1);
    const scaleValue = 0.42 + progress * 1.35;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(scaleValue);
    }

    if (materialRef.current) {
      materialRef.current.opacity = (1 - progress) * (ripple.falseCue ? 0.22 : 0.48);
    }
  });

  const opacity = ripple.falseCue ? 0.22 : 0.48;
  const color = cueColor(ripple);

  if (ripple.cue === 'bubble_trail') {
    return (
      <group position={[ripple.pos.x, TUNING.world.waterY + 0.018, ripple.pos.z]}>
        {[0, 1, 2].map((index) => (
          <mesh key={index} ref={index === 0 ? setObjectRef : undefined} renderOrder={3} rotation={[-Math.PI / 2, 0, 0]} position={[(index - 1) * ripple.radius * 0.62, 0, -index * ripple.radius * 0.44]}>
            <ringGeometry args={[ripple.radius * 0.16, ripple.radius * 0.26, 16]} />
            <meshBasicMaterial ref={index === 0 ? materialRef : undefined} color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    );
  }

  if (ripple.cue === 'glint' || ripple.cue === 'tail_flash') {
    return (
      <mesh ref={setObjectRef} renderOrder={4} rotation={[-Math.PI / 2, 0, Math.PI * 0.16]} position={[ripple.pos.x, TUNING.world.waterY + 0.024, ripple.pos.z]}>
        <planeGeometry args={[ripple.radius * (ripple.cue === 'tail_flash' ? 0.72 : 1.1), ripple.radius * 0.12]} />
        <meshBasicMaterial ref={materialRef} color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  if (ripple.cue === 'silt_plume') {
    return (
      <mesh ref={setObjectRef} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[ripple.pos.x, TUNING.world.waterY + 0.012, ripple.pos.z]}>
        <circleGeometry args={[ripple.radius, 24]} />
        <meshBasicMaterial ref={materialRef} color={color} transparent opacity={opacity * 0.58} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  if (ripple.cue === 'wake') {
    return (
      <group ref={setObjectRef} position={[ripple.pos.x, TUNING.world.waterY + 0.02, ripple.pos.z]}>
        {[-1, 1].map((side) => (
          <mesh key={side} renderOrder={3} rotation={[-Math.PI / 2, 0, side * Math.PI * 0.18]} position={[side * ripple.radius * 0.24, 0, -ripple.radius * 0.2]}>
            <planeGeometry args={[ripple.radius * 1.15, ripple.radius * 0.06]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <mesh
      ref={setObjectRef}
      renderOrder={3}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[ripple.pos.x, TUNING.world.waterY + 0.018, ripple.pos.z]}
    >
      <ringGeometry args={[ripple.radius * (ripple.cue === 'surface_rise' ? 0.44 : 0.74), ripple.radius, TUNING.world.rippleSegments]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function cueColor(ripple: Ripple): string {
  if (ripple.falseCue) {
    return '#c8c4b2';
  }

  if (ripple.cue === 'glint' || ripple.cue === 'tail_flash') {
    return '#f1d47a';
  }

  if (ripple.cue === 'silt_plume') {
    return '#78684d';
  }

  return '#d8d4c2';
}

function Dock({ texture }: { texture: THREE.Texture }) {
  return (
    <group position={[0, TUNING.world.dockY, TUNING.world.dockZ]}>
      {Array.from({ length: TUNING.world.dockPlankCount }, (_, index) => {
        const width = TUNING.world.dockWidthM / TUNING.world.dockPlankCount - TUNING.world.dockPlankGapM;
        const x = -TUNING.world.dockWidthM * 0.5 + width * 0.5 + index * (width + TUNING.world.dockPlankGapM);
        return (
          <mesh key={index} position={[x, 0, 0]}>
            <boxGeometry args={[width, TUNING.world.dockThicknessM, TUNING.world.dockLengthM]} />
            <meshStandardMaterial map={texture} color="#d0a06d" roughness={0.88} />
          </mesh>
        );
      })}
      <mesh position={[0, -0.04, -TUNING.world.dockLengthM * 0.46]}>
        <boxGeometry args={[TUNING.world.dockWidthM + 0.16, TUNING.world.dockThicknessM * 0.72, 0.12]} />
        <meshStandardMaterial color="#4f3422" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Reeds() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const reedPositions = useMemo(() => {
    const positions: Array<{ x: number; z: number; h: number; s: number }> = [];
    const rng = seededRandom('m2-reeds');

    for (let index = 0; index < 44; index += 1) {
      const side = index % 3;
      const x = side === 0
        ? -TUNING.world.pondWidthM * 0.5 + rng() * 0.45
        : side === 1
          ? TUNING.world.pondWidthM * 0.5 - rng() * 0.45
          : (rng() - 0.5) * TUNING.world.pondWidthM;
      const z = side === 2
        ? TUNING.world.pondHeightM * 0.5 - rng() * 0.7
        : -TUNING.world.pondHeightM * 0.2 + rng() * TUNING.world.pondHeightM * 0.72;
      positions.push({ x, z, h: 0.55 + rng() * 0.75, s: rng() * Math.PI * 2 });
    }

    return positions;
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scaleVec = new THREE.Vector3();

    reedPositions.forEach((reed, index) => {
      const sway = Math.sin(clock.elapsedTime * 0.7 + reed.s) * 0.08;
      quat.setFromEuler(new THREE.Euler(sway, reed.s, 0));
      scaleVec.set(0.08, reed.h, 0.08);
      matrix.compose(new THREE.Vector3(reed.x, TUNING.world.waterY + reed.h * 0.24, reed.z), quat, scaleVec);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, reedPositions.length]} frustumCulled>
      <coneGeometry args={[1, 1, 5]} />
      <meshStandardMaterial color="#4a5d3a" roughness={0.92} />
    </instancedMesh>
  );
}

function BackgroundCard() {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') {
      return new THREE.Texture();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#172629');
      gradient.addColorStop(1, '#223732');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(74, 93, 58, 0.78)';
      for (let index = 0; index < 54; index += 1) {
        const x = (index * 37) % canvas.width;
        const h = 42 + ((index * 19) % 80);
        ctx.fillRect(x, canvas.height - h, 4 + (index % 4), h);
      }
      ctx.fillStyle = 'rgba(200, 196, 178, 0.1)';
      ctx.fillRect(0, 34, canvas.width, 3);
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);

  return (
    <mesh position={[0, 1.18, TUNING.world.pondHeightM * 0.5 + 0.15]} rotation={[-0.22, 0, 0]}>
      <planeGeometry args={[TUNING.world.pondWidthM * 1.28, 2.4]} />
      <meshBasicMaterial map={texture} color="#c8c4b2" />
    </mesh>
  );
}

function Foreshore() {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') {
      return new THREE.Texture();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Canvas top = water edge of bank; bottom = player-side grass top.
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#2a3a32');
      gradient.addColorStop(0.12, '#3a3a26');
      gradient.addColorStop(0.4, '#4a4128');
      gradient.addColorStop(0.7, '#3d4a26');
      gradient.addColorStop(1, '#314026');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Wet shoreline darkening just below the water edge.
      const wetline = ctx.createLinearGradient(0, 0, 0, 24);
      wetline.addColorStop(0, 'rgba(20, 30, 32, 0.55)');
      wetline.addColorStop(1, 'rgba(20, 30, 32, 0)');
      ctx.fillStyle = wetline;
      ctx.fillRect(0, 0, canvas.width, 24);

      // Pebble flecks across the muddy mid-band.
      ctx.fillStyle = 'rgba(72, 60, 44, 0.55)';
      for (let index = 0; index < 220; index += 1) {
        const x = (index * 41) % canvas.width;
        const y = 30 + ((index * 7) % (canvas.height - 90));
        ctx.fillRect(x, y, 2 + (index % 3), 1 + (index % 2));
      }

      // Grass tufts clustered toward the player-side (bottom of canvas).
      ctx.fillStyle = 'rgba(78, 102, 60, 0.78)';
      for (let index = 0; index < 180; index += 1) {
        const x = (index * 23) % canvas.width;
        const y = canvas.height - 10 - ((index * 17) % (canvas.height * 0.55));
        ctx.fillRect(x, y, 2 + (index % 3), 4 + (index % 6));
      }

      // Brighter grass blades near the very top of the bank.
      ctx.fillStyle = 'rgba(120, 150, 84, 0.6)';
      for (let index = 0; index < 90; index += 1) {
        const x = (index * 31) % canvas.width;
        const y = canvas.height - 4 - ((index * 11) % 28);
        ctx.fillRect(x, y, 1 + (index % 2), 5 + (index % 4));
      }
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.set(2, 1);
    return map;
  }, []);

  // Bank slopes from water level at the front (z=2.5, y=0) up to the
  // raised player-side at (z=4.5, y=1.0) so it sits inside the visible
  // frustum and reads as the ground we cast over.
  const slopeRun = 2.0;
  const slopeRise = 1.0;
  const slopeLength = Math.hypot(slopeRun, slopeRise);
  const tilt = -(Math.PI / 2 + Math.atan2(slopeRise, slopeRun));

  return (
    <mesh
      renderOrder={2}
      rotation={[tilt, 0, 0]}
      position={[0, slopeRise * 0.5, 3.5]}
    >
      <planeGeometry args={[TUNING.world.pondWidthM * 1.18, slopeLength]} />
      <meshBasicMaterial
        map={texture}
        color="#a89878"
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function RodReel({ rodButtScreen, rodTipScreen }: { rodButtScreen: ScreenPoint; rodTipScreen: ScreenPoint }) {
  const dx = rodTipScreen.x - rodButtScreen.x;
  const dy = rodTipScreen.y - rodButtScreen.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const tx = dx / length;
  const ty = dy / length;
  const nx = ty;
  const ny = -tx;
  const reelDistance = TUNING.world.rodReelOffsetPx;
  const cx = rodButtScreen.x + tx * 18;
  const cy = rodButtScreen.y + ty * 18;
  const reelX = cx + nx * reelDistance;
  const reelY = cy + ny * reelDistance;
  const handleX = reelX + tx * 4 + nx * 9;
  const handleY = reelY + ty * 4 + ny * 9;
  const knobX = handleX + nx * 4 + tx * 1;
  const knobY = handleY + ny * 4 + ty * 1;

  return (
    <g className="rod-reel">
      <line
        x1={cx}
        y1={cy}
        x2={reelX + nx * 1.5}
        y2={reelY + ny * 1.5}
        stroke="#3a2718"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <circle
        cx={reelX}
        cy={reelY}
        r="9.5"
        fill="rgba(20, 24, 24, 0.78)"
        stroke="var(--moonlight)"
        strokeWidth="1.6"
      />
      <circle cx={reelX} cy={reelY} r="6.5" fill="rgba(40, 44, 44, 0.78)" />
      <circle cx={reelX} cy={reelY} r="3" fill="var(--ui-gold)" />
      <line
        x1={reelX}
        y1={reelY}
        x2={handleX}
        y2={handleY}
        stroke="var(--moonlight)"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx={knobX} cy={knobY} r="2.6" fill="var(--ui-gold)" stroke="rgba(20, 24, 24, 0.7)" strokeWidth="0.8" />
    </g>
  );
}

function DebugHud({ metrics, gameState, fishState, lureState, tension, seed }: {
  metrics: ReturnType<typeof useGameStore.getState>['debugMetrics'];
  gameState: string;
  fishState: string;
  lureState: string;
  tension: number;
  seed: string;
}) {
  return (
    <aside className="debug-hud" data-testid="debug-hud">
      <span>FPS {metrics.fps.toFixed(0)} / {metrics.avgFps1s.toFixed(0)} / {metrics.avgFps5s.toFixed(0)}</span>
      <span>Draw {metrics.drawCalls}</span>
      <span>Tris {metrics.triangles}</span>
      <span>Textures {metrics.textureCount}</span>
      <span>Heap {metrics.jsHeapMb === null ? 'n/a' : metrics.jsHeapMb.toFixed(1)}</span>
      <span>Game {gameState}</span>
      <span>Fish {fishState}</span>
      <span>Lure {lureState}</span>
      <span>Tension {tension.toFixed(2)}</span>
      <span>Seed {seed}</span>
      <span>Pixel {metrics.pixelRatio.toFixed(1)} / d{metrics.degradationLevel}</span>
    </aside>
  );
}

function createRuntime(seed: string, spawnIndex = 0): Runtime {
  const rng = seededRandom(`${seed}-spawn-${spawnIndex}`);
  const lurePos = { ...TUNING.world.lureStart };
  const fish = createInitialFish(rng);
  const fishSpecies = speciesTuning(fish.instance.species);

  return {
    state: { kind: 'splash' },
    fish,
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
    lastBiteAt: 0,
    lastTwitchAt: null,
    focusUntil: 0,
    focusCooldownUntil: 0,
    lateHookUntil: 0,
    hookJerkUntil: 0,
    nextRealCueAt: nowMs() + TUNING.fish.cueRealEveryMs * fishSpecies.cueEveryMultiplier,
    nextFalseCueAt: nowMs() + lerp(TUNING.fish.cueFalseMinMs, TUNING.fish.cueFalseMaxMs, rng()),
    nextStruggleRippleAt: 0,
    spawnIndex,
    realCueIndex: 0,
    restoring: false,
    minFps: TUNING.performance.fpsRecovery,
    fpsSamples: [],
    lowFpsSince: 0,
    highFpsSince: 0,
    degradationLevel: 0,
    pixelRatio: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, TUNING.performance.pixelRatioCap),
    aimTarget: null
  };
}

function updateFight(runtime: Runtime, dt: number, onResult: SceneProps['onResult'], audio: ProceduralAudio) {
  if (runtime.state.kind !== 'hooked') {
    return;
  }

  const species = speciesTuning(runtime.fish.instance.species);
  const personalityPull = 1 + runtime.fish.instance.personality * TUNING.fish.personalityModulation;
  const fishPull = runtime.fish.state.kind === 'hooked'
    ? runtime.fish.state.rage * species.hookedPullMultiplier * personalityPull
    : TUNING.fish.personalityScalar;
  const rise = runtime.reeling
    ? (TUNING.tension.tensionRiseRate + TUNING.tension.tensionReelBoost + fishPull * TUNING.tension.tensionBurstRate) * dt
    : -TUNING.tension.tensionFallRate * dt;
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

  if (runtime.tension > TUNING.tension.nearSnapThreshold) {
    runtime.state = { ...runtime.state, nearSnaps: runtime.state.nearSnaps + 1 };
    audio.fishSplash(TUNING.audio.struggleSplashIntensity);
  }

  if (runtime.tension > TUNING.tension.lineSnapThreshold) {
    audio.lineSnap();
    navigator.vibrate?.(TUNING.haptics.lineSnap);
    onResult('snap', runtime.state.peakTension, runtime.state.nearSnaps, runtime.state.hookedAt);
    return;
  }

  if (runtime.state.slackMs > TUNING.tension.slackEscapeWindowMs) {
    audio.escapeSplash();
    navigator.vibrate?.(TUNING.haptics.escape);
    onResult('escape', runtime.state.peakTension, runtime.state.nearSnaps, runtime.state.hookedAt);
    return;
  }

}

function biteContactBlend(fish: FishSnapshot): number {
  return TUNING.fish.personalityScalar * (1 + fish.instance.personality * TUNING.fish.personalityModulation);
}

function cueDuration(cue: FishCueKind): number {
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

function falseCueKind(rng: () => number): FishCueKind {
  const cues: FishCueKind[] = ['ripple', 'glint', 'surface_rise'];
  return cues[Math.floor(rng() * cues.length)] ?? 'ripple';
}

function updateRodControl(runtime: Runtime, dt: number) {
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

function updateHookedContactPoint(runtime: Runtime, dt: number) {
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

  runtime.lurePos = { x: runtime.fish.position.x, z: runtime.fish.position.z };
  runtime.lureY = TUNING.world.lureSinkDepthY;
}

function updatePerformance(
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

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const THREE_UP = new THREE.Vector3(0, 1, 0);

function projectVecToScreen(vec: THREE.Vector3, camera: THREE.Camera, size: { width: number; height: number }): ScreenPoint {
  vec.project(camera);
  return {
    x: (vec.x * 0.5 + 0.5) * size.width,
    y: (-vec.y * 0.5 + 0.5) * size.height
  };
}

function visualLineTensionFor(tension: number): number {
  const range = TUNING.line.lineVisualTautFull - TUNING.line.lineVisualTautStart;

  if (range <= 0) {
    return tension;
  }

  return Math.min(1, Math.max(0, (tension - TUNING.line.lineVisualTautStart) / range));
}

function rodTipFor(tension: number, hookImpulse = 0): Vec2 {
  return {
    x: TUNING.world.rodTip.x - TUNING.world.rodBendMaxM * (tension + hookImpulse),
    z: TUNING.world.rodTip.z + TUNING.world.rodBendMaxM * (tension + hookImpulse)
  };
}

function rodTipForRuntime(runtime: Runtime, hookImpulse = 0): Vec2 {
  const bend = rodTipFor(runtime.tension, hookImpulse);

  return {
    x: bend.x + runtime.rodOffset.x,
    z: bend.z + runtime.rodOffset.z
  };
}

function isEarlyHookAttempt(fishStateKind: string): boolean {
  return TUNING.fish.earlyHookStates.some((state) => state === fishStateKind);
}

function canPendingTouchBecomeCast(runtime: Runtime): boolean {
  return runtime.state.kind === 'lure_idle' && runtime.lateHookUntil <= performance.now();
}

function rodPathFromScreen(butt: ScreenPoint, tip: ScreenPoint, hookImpulse: number): string {
  const dx = tip.x - butt.x;
  const dy = tip.y - butt.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const bowAmount = length * TUNING.world.rodScreenBowFraction + hookImpulse * TUNING.ui.hookJerkScreenPx;
  const control = {
    x: lerp(butt.x, tip.x, 0.55) + nx * bowAmount,
    y: lerp(butt.y, tip.y, 0.55) + ny * bowAmount
  };

  return `M ${butt.x} ${butt.y} Q ${control.x} ${control.y} ${tip.x} ${tip.y}`;
}

function isRodTouch(screenX: number, screenY: number, viewport: ViewportSize): boolean {
  const buttX = viewport.width * TUNING.world.rodScreenButtXRatio;
  const buttY = viewport.height * (1 - TUNING.world.rodScreenButtBottomRatio);
  const tipX = viewport.width * TUNING.ui.worldProjectOffsetXRatio
    + TUNING.world.rodTip.x * TUNING.ui.worldProjectScale;
  const tipY = viewport.height * TUNING.ui.worldProjectOffsetYRatio
    - TUNING.world.rodTip.z * TUNING.ui.worldProjectScale;

  return distancePointToSegment(
    { x: screenX, z: screenY },
    { x: buttX, z: buttY },
    { x: tipX, z: tipY }
  ) <= TUNING.input.rodTouchRadiusPx;
}

function distancePointToSegment(point: Vec2, start: Vec2, end: Vec2): number {
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

function clampRodOffset(offset: Vec2): Vec2 {
  const length = Math.hypot(offset.x, offset.z);

  if (length <= TUNING.input.rodControlMaxOffsetM) {
    return offset;
  }

  return scale(normalize(offset), TUNING.input.rodControlMaxOffsetM);
}

function hookImpulseFor(runtime: Runtime, now: number): number {
  if (now >= runtime.hookJerkUntil) {
    return 0;
  }

  return (runtime.hookJerkUntil - now) / TUNING.timing.hookJerkMs;
}

function fishDepthVisibility(position: Vec2): number {
  const depth = clamp(
    (position.z - TUNING.world.fishableMinZ) / (TUNING.world.pondHeightM * 0.72),
    0,
    1
  );

  return lerp(TUNING.world.fishShallowOpacityMultiplier, TUNING.world.fishDeepOpacityMultiplier, depth);
}

function nowMs(): number {
  return typeof performance === 'undefined' ? 0 : performance.now();
}

function clampToFishableWater(point: Vec2): Vec2 {
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

function worldToScreen(point: Vec2, viewport: ViewportSize) {
  return {
    x: viewport.width * TUNING.ui.worldProjectOffsetXRatio + point.x * TUNING.ui.worldProjectScale,
    y: viewport.height * TUNING.ui.worldProjectOffsetYRatio - point.z * TUNING.ui.worldProjectScale
  };
}
