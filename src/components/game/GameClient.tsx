'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { ProceduralAudio } from '@/game/audio/procedural';
import { createInitialFish, type FishSnapshot, updateFish } from '@/game/fish/fishStateMachine';
import { add, clamp, clampToPond, distance, easeOutCubic, lerp, lerpVec, normalize, scale, seededRandom, sub, type Vec2 } from '@/game/math/vec';
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
  restoring: boolean;
  minFps: number;
  fpsSamples: Array<{ at: number; fps: number }>;
  lowFpsSince: number;
  highFpsSince: number;
  degradationLevel: number;
  pixelRatio: number;
};

type Ripple = {
  id: string;
  pos: Vec2;
  radius: number;
  createdAt: number;
  durationMs: number;
  falseCue: boolean;
};

type AimPreview = {
  power: number;
  target: Vec2;
};

type ViewportSize = {
  width: number;
  height: number;
};

type SceneProps = {
  started: boolean;
  runtime: React.MutableRefObject<Runtime>;
  audio: React.MutableRefObject<ProceduralAudio>;
  setLinePoints: (points: Vec2[]) => void;
  setRipples: React.Dispatch<React.SetStateAction<Ripple[]>>;
  setRodOffset: (offset: Vec2) => void;
  setPixelRatio: (pixelRatio: number) => void;
  onResult: (outcome: 'catch' | FailureKind, peakTension: number, nearSnaps: number, hookedAt: number) => void;
  onRestoringChange: (restoring: boolean) => void;
};

export function GameClient() {
  const searchParams = useSearchParams();
  const seed = searchParams.get('seed') ?? dailySeed();
  const queryDebug = searchParams.get('debug') === '1';
  const [started, setStarted] = useState(false);
  const [debugOpen, setDebugOpen] = useState(queryDebug || (process.env.NODE_ENV === 'development' && TUNING.ui.debugDefaultDev));
  const [aimPreview, setAimPreview] = useState<AimPreview | null>(null);
  const [linePoints, setLinePoints] = useState<Vec2[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [rodOffset, setRodOffset] = useState<Vec2>({ x: 0, z: 0 });
  const [pixelRatio, setPixelRatio] = useState(1);
  const [restoring, setRestoring] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const [resultDismissReady, setResultDismissReady] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerSnapshot | null>(null);
  const startedRef = useRef(false);
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
    runtime.current = createRuntime(seed);
    startedRef.current = false;
    setStarted(false);
    setSeed(seed);
    setGameState({ kind: 'splash' });
    setFishState(runtime.current.fish.state);
  }, [seed, setFishState, setGameState, setSeed]);

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
        species: 'generic',
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
          fishSpecies: 'generic',
          peakTension
        }
      };
      sessionStore.recordFailure(failure);
      track({ type: 'failure', failure });
    }

    runtime.current.state = { kind: 'result', outcome, storyText, shownAt: now, peakTension };
    runtime.current.reeling = false;
    runtime.current.tension = 0;
    setReeling(false);
    setTension(0);
    setGameState(runtime.current.state);
  }, [sessionStore, setGameState, setReeling, setTension]);

  const resetCast = useCallback(() => {
    const nextRuntime = createRuntime(seed);
    nextRuntime.state = { kind: 'scouting', sinceMs: performance.now() };
    runtime.current = nextRuntime;
    setLinePoints([]);
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

    if (runtime.current.state.kind === 'hooked') {
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
    setGameState(runtime.current.state);
    setAimPreview({ power: cast.power, target: cast.target });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    pointerRef.current = null;

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

  function addRipple(pos: Vec2, radius: number, falseCue: boolean) {
    setRipples((value) => [
      ...value,
      {
        id: createId(),
        pos,
        radius,
        createdAt: performance.now(),
        durationMs: falseCue ? TUNING.fish.cueRippleDurationMs : TUNING.fish.cueShadowDurationMs,
        falseCue
      }
    ]);
  }

  const previewDots = useMemo(() => {
    if (!aimPreview || !viewport) {
      return [];
    }

    const start = worldToScreen(TUNING.world.rodTip, viewport);
    const end = worldToScreen(aimPreview.target, viewport);

    return Array.from({ length: TUNING.input.aimPreviewDots }, (_, index) => {
      const t = index / (TUNING.input.aimPreviewDots - 1);
      return {
        id: index,
        x: lerp(start.x, end.x, t),
        y: lerp(start.y, end.y, t) - Math.sin(Math.PI * t) * TUNING.input.aimPreviewPowerPx * aimPreview.power,
        scale: lerp(TUNING.input.aimPreviewDotMinScale, TUNING.input.aimPreviewDotMaxScale, t)
      };
    });
  }, [aimPreview, viewport]);

  const lineScreenPoints = useMemo(
    () => viewport ? linePoints.map((point) => worldToScreen(point, viewport)) : [],
    [linePoints, viewport]
  );
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

  const biteHaloPos = gameState.kind === 'bite_window' && viewport
    ? worldToScreen(gameState.lurePos, viewport)
    : null;
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
            setLinePoints={setLinePoints}
            setRipples={setRipples}
            setRodOffset={setRodOffset}
            setPixelRatio={setPixelRatio}
            onResult={finishResult}
            onRestoringChange={setRestoring}
          />
        </Suspense>
      </Canvas>

      {viewport ? (
        <svg className="line-overlay" aria-hidden="true">
          <polyline
            points={lineScreenPoints.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke={lineColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={lineWidth}
          />
          <path
            d={rodPathFor(tension, viewport, hookImpulse, rodOffset)}
            fill="none"
            stroke="var(--dock-warm)"
            strokeLinecap="round"
            strokeWidth={TUNING.line.lineSnapWidthPx}
          />
        </svg>
      ) : null}

      {previewDots.map((dot) => (
        <span
          key={dot.id}
          className="preview-dot"
          style={{ transform: `translate(${dot.x}px, ${dot.y}px) scale(${dot.scale})` }}
        />
      ))}

      {viewport ? ripples.map((ripple) => {
        const point = worldToScreen(ripple.pos, viewport);
        const age = performance.now() - ripple.createdAt;
        const opacity = Math.max(0, 1 - age / ripple.durationMs);
        return (
          <span
            key={ripple.id}
            className={ripple.falseCue ? 'water-ripple false-cue' : 'water-ripple'}
            style={{
              width: ripple.radius * TUNING.ui.worldProjectScale,
              height: ripple.radius * TUNING.ui.worldProjectScale,
              opacity,
              transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(${1 + (1 - opacity)})`
            }}
          />
        );
      }) : null}

      {biteHaloPos ? (
        <span
          className="bite-halo"
          style={{ transform: `translate(${biteHaloPos.x}px, ${biteHaloPos.y}px)` }}
        >
          <span className="bite-halo-ring" />
        </span>
      ) : null}

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
      z: (startY - endY) / TUNING.input.dragPowerPixels
    };
    const dragLength = Math.hypot(drag.x, drag.z);
    const normalizedPower = clamp(dragLength, TUNING.input.castPowerMin, TUNING.input.castPowerMax);
    const power = easeOutCubic(normalizedPower);
    const direction = normalize(drag);
    const target = clampToPond(
      {
        x: TUNING.world.rodTip.x + direction.x * power * TUNING.input.castMaxRangeM,
        z: TUNING.world.rodTip.z + direction.z * power * TUNING.input.castMaxRangeM
      },
      TUNING.world.pondWidthM,
      TUNING.world.pondHeightM,
      TUNING.world.pondMarginRatio
    );

    return {
      target: clampToFishableWater(target),
      power,
      flightMs: lerp(TUNING.input.castFlightTimeMin, TUNING.input.castFlightTimeMax, power) * TUNING.timing.msPerSecond
    };
  }
}

function GameScene({ started, runtime, audio, setLinePoints, setRipples, setRodOffset, setPixelRatio, onResult, onRestoringChange }: SceneProps) {
  const fishRef = useRef<THREE.Mesh>(null);
  const lureRef = useRef<THREE.Mesh>(null);
  const waterRef = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  const setFishState = useGameStore((state) => state.setFishState);
  const setGameState = useGameStore((state) => state.setGameState);
  const setTension = useGameStore((state) => state.setTension);
  const setLureState = useGameStore((state) => state.setLureState);
  const setDebugMetrics = useGameStore((state) => state.setDebugMetrics);
  const setGlHandlersReady = useGameStore((state) => state.setGlHandlersReady);
  const recordPerf = useSessionStore((state) => state.recordPerf);
  const recordPixelRatioDegradation = useSessionStore((state) => state.recordPixelRatioDegradation);
  const recordGlContextLoss = useSessionStore((state) => state.recordGlContextLoss);

  useEffect(() => {
    camera.lookAt(new THREE.Vector3(...TUNING.world.cameraTarget));
  }, [camera]);

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

    if (waterRef.current) {
      waterRef.current.rotation.z = Math.sin(now / TUNING.fish.cueShadowDurationMs) * TUNING.lure.lureWobbleAmplitude;
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
            falseCue: false
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
      current.lurePos = lerpVec(gameState.lurePos, current.fish.position, TUNING.fish.personalityScalar);
      setLureState('twitch');
    } else if (gameState.kind === 'hooked') {
      const hookImpulse = hookImpulseFor(current, now);
      if (hookImpulse > 0) {
        current.lurePos = {
          x: current.lurePos.x + (current.fish.position.x - current.lurePos.x) * hookImpulse * TUNING.fish.personalityScalar,
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
            falseCue: false
          }
        ]);
      }
      setGameState(current.state);
    }

    if (now > current.nextRealCueAt) {
      current.nextRealCueAt = now + TUNING.fish.cueRealEveryMs;
      setRipples((value) => [
        ...value,
        {
          id: createId(),
          pos: current.fish.position,
          radius: TUNING.lure.rippleRadiusOnTwitchM,
          createdAt: now,
          durationMs: TUNING.fish.cueRippleDurationMs,
          falseCue: false
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
          falseCue: true
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
          falseCue: false
        },
        {
          id: createId(),
          pos: current.lurePos,
          radius: TUNING.lure.rippleRadiusOnTwitchM,
          createdAt: now,
          durationMs: TUNING.fish.cueRippleDurationMs,
          falseCue: false
        }
      ]);
      audio.current.nibbleTick();
      navigator.vibrate?.(TUNING.haptics.nibbleTick);
      track({ type: 'bite_window_open' });
      setGameState(current.state);
    }

    if (fishRef.current) {
      fishRef.current.position.set(current.fish.position.x, TUNING.world.fishDepthY, current.fish.position.z);
      fishRef.current.scale.set(
        TUNING.world.fishVisualWidthM * (current.fish.state.kind === 'commit' ? 1 + TUNING.fish.personalityScalar : 1),
        TUNING.world.fishVisualHeightM,
        1
      );
      const material = fishRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = current.fish.state.kind === 'commit' || current.fish.state.kind === 'bite'
        ? TUNING.world.fishCommitOpacity
        : TUNING.world.fishCueOpacity;
    }

    if (lureRef.current) {
      lureRef.current.visible = current.lureVisible;
      lureRef.current.position.set(current.lurePos.x, current.lureY, current.lurePos.z);
      const flashing = now < current.lureFlashUntil;
      const material = lureRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = flashing ? TUNING.audio.sfxGain : TUNING.lure.lureWobbleAmplitude;
    }

    current.line = updateVerletLine(current.line, rodTipForRuntime(current, hookImpulseFor(current, now)), current.lurePos, dt, current.tension);
    setLinePoints(current.line.points.map((point) => point.pos));
    setRodOffset(current.rodOffset);
    setFishState(current.fish.state);
    setTension(current.tension);
    audio.current.updateLoops(current.tension, current.reeling || current.rodControlActive, current.rodControlActive);
    updatePerformance(current, dt, gl, setPixelRatio, setDebugMetrics, recordPerf, recordPixelRatioDegradation);
  });

  return (
    <>
      <color attach="background" args={['#1a2b30']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[2.4, 5, 3]} intensity={1.7} />
      <mesh ref={waterRef} renderOrder={0} rotation={[-Math.PI / 2, 0, 0]} position={[0, TUNING.world.waterY, 0]}>
        <planeGeometry args={[TUNING.world.pondWidthM, TUNING.world.pondHeightM, TUNING.world.waterSegments, TUNING.world.waterSegments]} />
        <meshStandardMaterial color="#2f4948" roughness={0.75} metalness={0.05} transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <Dock />
      <mesh ref={fishRef} renderOrder={1} rotation={[-Math.PI / 2, 0, 0]} position={[TUNING.world.fishStart.x, TUNING.world.fishDepthY, TUNING.world.fishStart.z]}>
        <circleGeometry args={[1, TUNING.world.rippleSegments]} />
        <meshBasicMaterial color="#0a0e10" transparent opacity={TUNING.world.fishCueOpacity} depthWrite={false} />
      </mesh>
      <mesh ref={lureRef} visible={false} position={[TUNING.world.lureStart.x, TUNING.world.lureSurfaceY, TUNING.world.lureStart.z]}>
        <sphereGeometry args={[TUNING.lure.lureRadiusM, 16, 12]} />
        <meshStandardMaterial color="#6a7a45" emissive="#c8a85c" emissiveIntensity={TUNING.lure.lureWobbleAmplitude} />
      </mesh>
    </>
  );
}

function Dock() {
  return (
    <group position={[0, TUNING.world.dockY, TUNING.world.dockZ]}>
      {Array.from({ length: TUNING.world.dockPlankCount }, (_, index) => {
        const width = TUNING.world.dockWidthM / TUNING.world.dockPlankCount - TUNING.world.dockPlankGapM;
        const x = -TUNING.world.dockWidthM * 0.5 + width * 0.5 + index * (width + TUNING.world.dockPlankGapM);
        return (
          <mesh key={index} position={[x, 0, 0]}>
            <boxGeometry args={[width, TUNING.world.dockThicknessM, TUNING.world.dockLengthM]} />
            <meshStandardMaterial color="#6b4a32" roughness={0.86} />
          </mesh>
        );
      })}
    </group>
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

function createRuntime(seed: string): Runtime {
  const rng = seededRandom(seed);
  const lurePos = { ...TUNING.world.lureStart };

  return {
    state: { kind: 'splash' },
    fish: createInitialFish(rng),
    rng,
    lurePos,
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
    nextRealCueAt: nowMs() + TUNING.fish.cueRealEveryMs,
    nextFalseCueAt: nowMs() + lerp(TUNING.fish.cueFalseMinMs, TUNING.fish.cueFalseMaxMs, rng()),
    nextStruggleRippleAt: 0,
    restoring: false,
    minFps: TUNING.performance.fpsRecovery,
    fpsSamples: [],
    lowFpsSince: 0,
    highFpsSince: 0,
    degradationLevel: 0,
    pixelRatio: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, TUNING.performance.pixelRatioCap)
  };
}

function updateFight(runtime: Runtime, dt: number, onResult: SceneProps['onResult'], audio: ProceduralAudio) {
  if (runtime.state.kind !== 'hooked') {
    return;
  }

  const fishPull = runtime.fish.state.kind === 'hooked' ? runtime.fish.state.rage : TUNING.fish.personalityScalar;
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
    const pull = scale(normalize(lineVector), TUNING.input.rodControlLurePullMps * runtime.tension * dt);
    runtime.lurePos = clampToFishableWater(add(runtime.lurePos, pull));
    runtime.lureMovedUntil = performance.now() + TUNING.lure.lureTwitchDurationMs;
    runtime.lureFlashUntil = performance.now() + TUNING.lure.lureFlashDurationMs;
  }
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

function rodPathFor(tension: number, viewport: ViewportSize, hookImpulse: number, rodOffset: Vec2): string {
  const butt = worldToScreen(TUNING.world.rodButt, viewport);
  const bentTip = rodTipFor(tension, hookImpulse);
  const tip = worldToScreen({ x: bentTip.x + rodOffset.x, z: bentTip.z + rodOffset.z }, viewport);
  const control = {
    x: lerp(butt.x, tip.x, 0.55) - TUNING.world.rodBendMaxM * TUNING.ui.worldProjectScale * tension,
    y: lerp(butt.y, tip.y, 0.55) - hookImpulse * TUNING.ui.hookJerkScreenPx
  };

  return `M ${butt.x} ${butt.y} Q ${control.x} ${control.y} ${tip.x} ${tip.y}`;
}

function isRodTouch(screenX: number, screenY: number, viewport: ViewportSize): boolean {
  const butt = worldToScreen(TUNING.world.rodButt, viewport);
  const tip = worldToScreen(TUNING.world.rodTip, viewport);

  return distancePointToSegment({ x: screenX, z: screenY }, { x: butt.x, z: butt.y }, { x: tip.x, z: tip.y }) <= TUNING.input.rodTouchRadiusPx;
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
    z: Math.max(TUNING.world.fishableMinZ, clamped.z)
  };
}

function worldToScreen(point: Vec2, viewport: ViewportSize) {
  return {
    x: viewport.width * TUNING.ui.worldProjectOffsetXRatio + point.x * TUNING.ui.worldProjectScale,
    y: viewport.height * TUNING.ui.worldProjectOffsetYRatio - point.z * TUNING.ui.worldProjectScale
  };
}
