'use client';

/* eslint-disable @next/next/no-img-element */
import { Canvas } from '@react-three/fiber';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IosInstallHint } from '@/components/pwa/IosInstallHint';
import { OfflineStatus } from '@/components/pwa/OfflineStatus';
import { ProceduralAudio } from '@/game/audio/procedural';
import { type FishCueKind } from '@/game/fish/species';
import { DEFAULT_LURE_ID, DEFAULT_ROD_ID, lureMods, rodMods } from '@/game/gear/gear';
import { personalBestFor } from '@/game/fish/personalBest';
import { setHapticsEnabled, vibrate } from '@/game/haptics/haptics';
import { defaultPrefs, getPrefs, setPrefs, type Prefs } from '@/game/persistence/prefsStore';
import { getGear, setGear, type GearSelection } from '@/game/persistence/gearStore';
import { add, clamp, clampToPond, lerp, normalize, scale, sub, type Vec2 } from '@/game/math/vec';
import { createId, dailySeed, type Catch, type Failure, useSessionStore } from '@/game/persistence/sessionStore';
import { useGameStore } from '@/game/state/gameStore';
import type { FailureKind, ResultCatch } from '@/game/state/gameStateMachine';
import { TUNING } from '@/game/tuning/tuning';
import { track } from '@/game/telemetry/track';
import { failureStory, generateStory } from '@/game/ui/storyGenerator';
import { CatchResultCard } from '@/components/game/CatchResultCard';
import { DebugHud } from '@/components/game/DebugHud';
import { GameScene } from '@/components/game/GameScene';
import { GearSelect } from '@/components/game/GearSelect';
import { RodReel, rodPathFromScreen } from '@/components/game/RodReel';
import {
  canPendingTouchBecomeCast,
  clampRodOffset,
  clampToFishableWater,
  createRuntime,
  distancePointToSegment,
  isEarlyHookAttempt,
  rodTipForRuntime,
  scheduleNextSurge
} from '@/components/game/runtime';
import type {
  AimPreview,
  FocusIndicator,
  Overlay,
  PointerSnapshot,
  Ripple,
  Runtime,
  ScreenPoint,
  SplashStage,
  ViewportSize
} from '@/components/game/types';

export function GameClient() {
  const searchParams = useSearchParams();
  const seed = searchParams.get('seed') ?? dailySeed();
  const queryDebug = searchParams.get('debug') === '1';
  const [started, setStarted] = useState(false);
  const [splashStage, setSplashStage] = useState<SplashStage>('primary');
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
  const lureState = useGameStore((state) => state.lureState);
  const debugMetrics = useGameStore((state) => state.debugMetrics);
  const glHandlersReady = useGameStore((state) => state.glHandlersReady);

  const runtime = useRef<Runtime>(createRuntime(seed));

  // Pre-cast gear (22_THE_GEAR). gearRef is the always-current selection the
  // runtime + cast closures read; `gear` drives the picker UI. Saved gear loads on
  // mount (client-only — avoids a hydration mismatch) and is re-stamped onto the
  // runtime after every reset so a fresh cast keeps the chosen loadout.
  const gearRef = useRef<GearSelection>({ rodId: DEFAULT_ROD_ID, lureId: DEFAULT_LURE_ID });
  const [gear, setGearState] = useState<GearSelection>({ rodId: DEFAULT_ROD_ID, lureId: DEFAULT_LURE_ID });
  const stampGear = useCallback(() => {
    runtime.current.rodId = gearRef.current.rodId;
    runtime.current.lureId = gearRef.current.lureId;
  }, []);
  useEffect(() => {
    const saved = getGear();
    gearRef.current = saved;
    setGearState(saved);
    stampGear();
  }, [stampGear]);
  const applyGear = useCallback((next: GearSelection) => {
    gearRef.current = next;
    setGearState(next);
    setGear(next);
    stampGear();
  }, [stampGear]);

  // Feel preferences (sound / haptics): loaded client-side like gear, applied
  // to the audio bus and the central haptics gate immediately on change.
  const [prefs, setPrefsState] = useState<Prefs>(defaultPrefs());
  useEffect(() => {
    const saved = getPrefs();
    setPrefsState(saved);
    audio.current.setMuted(!saved.audio);
    setHapticsEnabled(saved.haptics);
  }, []);
  const togglePref = useCallback((key: 'audio' | 'haptics') => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefsState(next);
    setPrefs(next);
    audio.current.setMuted(!next.audio);
    setHapticsEnabled(next.haptics);
    if (key === 'haptics' && next.haptics) {
      // A single confirming pulse so re-enabling haptics answers in kind.
      vibrate(15);
    }
  }, [prefs]);

  // First-session coaching: two quiet, diegetic hints (read the water → cast;
  // twitch the lure) shown once ever, then the pond goes wordless for good.
  // The bite/fight prompts ("Tap!", "Ease off") are permanent HUD, not coaching.
  const [coachHint, setCoachHint] = useState<string | null>(null);
  const coachRef = useRef({ cast: false, twitch: false, done: false });
  useEffect(() => {
    try {
      if (window.localStorage.getItem('reelmobile.coach.v1') === '1') {
        coachRef.current.done = true;
      }
    } catch {
      // Private mode: coach once per load instead.
    }
  }, []);
  useEffect(() => {
    if (!started || coachRef.current.done) {
      return undefined;
    }
    const kind = gameState.kind;
    if (kind === 'scouting' && !coachRef.current.cast) {
      coachRef.current.cast = true;
      setCoachHint('Read the water — drag to cast toward a ripple.');
      return undefined;
    }
    if (kind === 'lure_idle' && !coachRef.current.twitch) {
      coachRef.current.twitch = true;
      setCoachHint('Tap to twitch the lure. Movement draws eyes.');
      const timeout = window.setTimeout(() => setCoachHint(null), TUNING.ui.coachHintAutoHideMs);
      return () => window.clearTimeout(timeout);
    }
    if (kind === 'aiming' || kind === 'casting' || kind === 'bite_window' || kind === 'hooked') {
      setCoachHint(null);
      return undefined;
    }
    if (kind === 'result') {
      coachRef.current.done = true;
      setCoachHint(null);
      try {
        window.localStorage.setItem('reelmobile.coach.v1', '1');
      } catch {
        // ignore
      }
    }
    return undefined;
  }, [gameState.kind, started]);

  // The rod/lure explainer is opened from the gear strip but it pauses the pond,
  // so the open-state lives here (not inside GearSelect): the runtime needs to see
  // it. Frozen only while the explainer is open AND we're scouting; the cleanup +
  // the leave-scouting reset guarantee the freeze can never leak into a cast.
  const [gearHelpOpen, setGearHelpOpen] = useState(false);
  useEffect(() => {
    runtime.current.pondFrozen = gearHelpOpen && gameState.kind === 'scouting';
    return () => {
      runtime.current.pondFrozen = false;
    };
  }, [gearHelpOpen, gameState.kind]);
  useEffect(() => {
    if (gameState.kind !== 'scouting' && gearHelpOpen) {
      setGearHelpOpen(false);
    }
  }, [gameState.kind, gearHelpOpen]);

  useEffect(() => {
    spawnIndexRef.current = 0;
    runtime.current = createRuntime(seed);
    stampGear();
    startedRef.current = false;
    setStarted(false);
    setSplashStage('primary');
    setSeed(seed);
    setGameState({ kind: 'splash' });
    setFishState(runtime.current.fish.state);
  }, [seed, setFishState, setGameState, setSeed, stampGear]);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  // Audio lifecycle (06_MOBILE_WEB_CONSTRAINTS): suspend the AudioContext when
  // the tab is backgrounded (battery; iOS audio-session courtesy) and resume on
  // return; tear the whole context down on unmount so the looping ambient
  // source doesn't outlive the /game route.
  useEffect(() => {
    const instance = audio.current;
    const onVisibilityChange = () => {
      if (document.hidden) {
        void instance.suspend();
      } else if (startedRef.current) {
        void instance.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      instance.dispose();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const preventTouch = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-testid="tap-to-begin"], [data-testid="result-card"], [data-testid="gear-select"], [data-testid="prefs-strip"]')) {
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
    vibrate(TUNING.haptics.tapBegin);
    sessionStore.startSession(seed);
    track({ type: 'session_start' });
    runtime.current.state = { kind: 'scouting', sinceMs: performance.now() };
    setGameState(runtime.current.state);
    setStarted(true);
  }, [seed, sessionStore, setGameState]);

  const advanceSplash = useCallback(() => {
    if (startedRef.current) {
      return;
    }

    if (splashStage === 'primary') {
      setSplashStage('secondary');
      return;
    }

    begin();
  }, [begin, splashStage]);

  const finishResult = useCallback((outcome: 'catch' | FailureKind, peakTension: number, nearSnaps: number, hookedAt: number) => {
    if (runtime.current.state.kind === 'result') {
      return;
    }

    // Two clocks, deliberately: Date.now() is the wall-clock persistence
    // timestamp (journal `at`); performance.now() is the monotonic simulation
    // clock (durations, state timing) immune to NTP/clock adjustments mid-fight.
    const simNow = performance.now();
    let storyText = failureStory(outcome);
    let resultCatch: ResultCatch | undefined;
    audio.current.stopLoops();

    if (outcome === 'catch') {
      const catchEntry: Catch = {
        id: createId(),
        at: Date.now(),
        species: runtime.current.fish.instance.species,
        sizeScore: clamp(peakTension, TUNING.fish.catchMinSizeScore, TUNING.fish.catchMaxSizeScore),
        // The lure this fish was actually caught on (22_THE_GEAR) — a flat journal
        // attribute, never a coverage/completion grid (14_DO_NOT_BUILD).
        lure: runtime.current.lureId,
        durationMs: Math.max(0, Math.round(simNow - hookedAt)),
        peakTension,
        nearSnaps,
        storyText: ''
      };
      catchEntry.storyText = generateStory(catchEntry);
      storyText = catchEntry.storyText;
      // Personal-best check happens BEFORE recordCatch appends this catch to
      // the journal, so the comparison is against history only.
      const personalBest = personalBestFor(catchEntry);
      resultCatch = {
        species: catchEntry.species,
        sizeScore: catchEntry.sizeScore,
        lure: catchEntry.lure,
        durationMs: catchEntry.durationMs,
        nearSnaps: catchEntry.nearSnaps,
        peakTension: catchEntry.peakTension,
        personalBest
      };
      sessionStore.recordCatch(catchEntry);
      track({ type: 'catch', catch: catchEntry });
      audio.current.catchChime();
      vibrate(personalBest ? TUNING.haptics.personalBest : TUNING.haptics.catch);
    } else {
      const failure: Failure = {
        at: Date.now(),
        kind: outcome,
        context: {
          fishSpecies: runtime.current.fish.instance.species,
          peakTension
        }
      };
      sessionStore.recordFailure(failure);
      track({ type: 'failure', failure });
    }

    runtime.current.state = { kind: 'result', outcome, storyText, shownAt: simNow, peakTension, catch: resultCatch };
    runtime.current.reeling = false;
    runtime.current.reelPulseUntil = 0;
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
    nextRuntime.rodId = gearRef.current.rodId;
    nextRuntime.lureId = gearRef.current.lureId;
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
      reelTap();
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
      runtime.current.aimTarget = cast.aimTarget;
      runtime.current.aimSpread = cast.spreadRadius;
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
      runtime.current.aimTarget = cast.aimTarget;
      runtime.current.aimSpread = cast.spreadRadius;
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
    runtime.current.aimTarget = cast.aimTarget;
    runtime.current.aimSpread = cast.spreadRadius;
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

    // Tap-to-reel: releasing the finger does NOT stop the reel. Each tap fired one
    // discrete pulse on pointer-down; the pulse expires on its own in the frame loop
    // (reelPulseUntil), so lifting up just ends this tap's pointer and the player taps
    // again to keep the line coming.
    if (pointer?.mode === 'reeling' || runtime.current.state.kind === 'hooked') {
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
      runtime.current.nextSurgeAt = scheduleNextSurge(runtime.current, performance.now());
      runtime.current.state = {
        kind: 'hooked',
        hookedAt: performance.now(),
        stamina: TUNING.fish.hookedInitialStamina,
        slackMs: 0,
        nearSnaps: 0,
        peakTension: runtime.current.tension
      };
      track({ type: 'hook_attempt', result: 'success' });
      audio.current.hooksetThunk();
      addRipple(runtime.current.lurePos, TUNING.lure.rippleRadiusOnTwitchM, false);
      addRipple(runtime.current.fish.position, TUNING.lure.rippleRadiusOnImpactM, false);
      vibrate(TUNING.haptics.hookset);
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
    const now = performance.now();
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

  function reelTap() {
    if (runtime.current.state.kind !== 'hooked') {
      return;
    }

    const now = performance.now();
    // Debounce a single physical tap firing twice (pointer jitter): one finger tap is
    // one pulse. The cadence skill lives well above this floor.
    if (now - runtime.current.lastReelTapAt < TUNING.input.tapReelMinIntervalMs) {
      return;
    }
    runtime.current.lastReelTapAt = now;

    // Instant tension burst (the jolt of cranking the handle) plus a reel pulse window
    // during which updateFight keeps tension rising and updateHookedContactPoint pulls
    // the fish in. Tapping again before the pulse expires stacks bursts toward the snap
    // threshold; pausing lets tension bleed off (tensionTapDecayRate).
    runtime.current.tension = clamp(runtime.current.tension + TUNING.tension.tensionPerTap, 0, 1);
    runtime.current.reelPulseUntil = now + TUNING.input.tapReelPulseMs;
    runtime.current.reeling = true;
    setReeling(true);

    // Immediate chunk of line yanked in on the tap itself (clamped to the remaining
    // distance), so the fish visibly jerks rodward the instant you tap — the pulse
    // window then keeps it coming for tapReelPulseMs. Mirrors updateHookedContactPoint.
    const waterEntry = clampToFishableWater(rodTipForRuntime(runtime.current));
    const toRod = sub(waterEntry, runtime.current.fish.position);
    const distanceToRod = Math.hypot(toRod.x, toRod.z);
    if (distanceToRod > 0) {
      const pull = scale(normalize(toRod), Math.min(distanceToRod, TUNING.input.tapReelImpulse));
      runtime.current.fish = {
        ...runtime.current.fish,
        position: add(runtime.current.fish.position, pull)
      };
      runtime.current.lurePos = { x: runtime.current.fish.position.x, z: runtime.current.fish.position.z };
    }

    audio.current.reelTick();
    vibrate(TUNING.haptics.reelTap);
  }

  function twitchLure() {
    if (!runtime.current.lureVisible || (runtime.current.state.kind !== 'lure_idle' && runtime.current.state.kind !== 'rod_control')) {
      return;
    }

    if (runtime.current.lateHookUntil > performance.now()) {
      resolveMiss('missed_late');
      return;
    }

    const now = performance.now();
    // Lure gear (22_THE_GEAR): twitchMult scales the hop distance only (presentation
    // feel). Applied here at the hop sites, NOT to the rod-control deadband, which
    // shares lureTwitchDistanceM but is unrelated handling.
    const twitchMult = lureMods(runtime.current.lureId).twitchMult;
    runtime.current.lastTwitchAt = now;
    runtime.current.lureMovedUntil = now + TUNING.lure.lureTwitchDurationMs;
    runtime.current.lureFlashUntil = now + TUNING.lure.lureFlashDurationMs;
    runtime.current.lurePos = clampToFishableWater({
      x: runtime.current.lurePos.x + (runtime.current.rng() - TUNING.lure.lureTwitchSidewaysRatio) * TUNING.lure.lureTwitchDistanceM * twitchMult,
      z: runtime.current.lurePos.z + TUNING.lure.lureTwitchDistanceM * twitchMult
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
    vibrate(TUNING.haptics.missed);
    finishResult(kind, runtime.current.tension, 0, performance.now());
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

  // The equipped rod's line strength scales the snap thresholds (22_THE_GEAR): the
  // short rod snaps easier, so the "near snap" warning visuals must fire at its
  // lower effective threshold too — not the raw constant — or the red warning lies.
  // updateFight() applies the same scalar to the snap LOGIC. Default rod = 1.0.
  const effNearSnapThreshold = TUNING.tension.nearSnapThreshold * rodMods(gear.rodId).lineStrengthMult;
  const lineColor = tension > effNearSnapThreshold
    ? TUNING.line.lineSnapColour
    : tension >= TUNING.tension.tensionSweetSpotMin
      ? TUNING.line.lineTautColour
      : TUNING.line.lineSlackColour;
  const hookImpulse = gameState.kind === 'hooked'
    ? Math.max(0, 1 - (performance.now() - gameState.hookedAt) / TUNING.timing.hookJerkMs)
    : 0;
  const lineWidth = (tension > effNearSnapThreshold
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
  // Tap-to-reel HUD: while hooked, prompt "Tap to reel" until the line nears the snap
  // line, then flip to "Ease off" (stop tapping, let tension bleed). The prompt is NOT
  // gated on the per-tap `reeling` pulse (that flickers every tap) — it shows whenever
  // it's safe to keep cranking, so the instruction reads steady.
  const cuePrompt: { kind: 'tap' | 'reel' | 'ease'; text: string } | null =
    gameState.kind === 'bite_window'
      ? { kind: 'tap', text: 'Tap!' }
      : gameState.kind === 'hooked' && tension > TUNING.ui.reelHintTensionWarn
        ? { kind: 'ease', text: 'Ease off' }
        : gameState.kind === 'hooked'
          ? { kind: 'reel', text: 'Tap to reel' }
          : null;
  const showTensionBar = gameState.kind === 'hooked' || gameState.kind === 'rod_control';

  // Fight drama: a red vignette breathes in from the screen edges as tension
  // closes on the snap line — the danger should be felt at the edges of vision
  // before the player ever reads the bar. Scaled to the EFFECTIVE threshold so
  // the short rod's earlier snap point also warns earlier.
  const dangerStart = effNearSnapThreshold * TUNING.ui.dangerVignetteStartRatio;
  const dangerOpacity = gameState.kind === 'hooked'
    ? clamp((tension - dangerStart) / Math.max(0.001, 1 - dangerStart), 0, 1)
    : 0;

  return (
    <main
      ref={rootRef}
      className="game-root"
      data-testid="game-route"
      data-game-state={gameState.kind}
      data-fish-state={fishState.kind}
      data-started={started ? 'true' : 'false'}
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

      {aimPreview && overlay.aimTarget && (overlay.aimRingRx ?? 0) > 1.5 ? (
        <span
          className="aim-spread-ring"
          aria-hidden="true"
          style={{
            transform: `translate(${overlay.aimTarget.x}px, ${overlay.aimTarget.y}px) translate(-50%, -50%)`,
            width: `${(overlay.aimRingRx ?? 0) * 2}px`,
            height: `${(overlay.aimRingRy ?? 0) * 2}px`
          }}
        />
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
        // role=status/aria-live: the prompt is the game's only textual
        // instruction stream ("Tap!", "Ease off") — announce it to screen
        // readers instead of leaving the canvas game silent.
        <div className={`cue-prompt ${cuePrompt.kind}`} data-testid="cue-prompt" role="status" aria-live="polite">
          {cuePrompt.text}
        </div>
      ) : null}

      {coachHint ? (
        <div className="coach-hint" role="status">
          {coachHint}
        </div>
      ) : null}

      {dangerOpacity > 0.02 ? (
        <div className="danger-vignette" aria-hidden="true" style={{ opacity: dangerOpacity }} />
      ) : null}

      {showTensionBar ? (
        <div className="tension-bar" aria-hidden="true">
          <div
            className="tension-bar-mark danger"
            style={{ bottom: `${effNearSnapThreshold * 100}%` }}
          />
          <div
            className="tension-bar-mark"
            style={{ bottom: `${TUNING.tension.tensionSafeHold * 100}%` }}
          />
          <div
            className={`tension-bar-fill${
              tension > effNearSnapThreshold ? ' danger' : tension >= TUNING.tension.tensionSweetSpotMin ? ' sweet' : ''
            }`}
            style={{ height: `${Math.min(1, Math.max(0, tension)) * 100}%` }}
          />
        </div>
      ) : null}

      {started && gameState.kind === 'scouting' ? (
        <GearSelect gear={gear} onSelect={applyGear} explainerOpen={gearHelpOpen} onExplainerOpenChange={setGearHelpOpen} />
      ) : null}

      {started && gameState.kind === 'scouting' ? (
        // Feel preferences, idle-only like the gear strip: two wordless glyphs
        // (sound, haptics) tucked top-right. No settings page, no modal — the
        // pond stays the interface (08_ART_DIRECTION).
        <div className="prefs-strip" data-testid="prefs-strip">
          <button
            type="button"
            className={`gear-glyph prefs-glyph${prefs.audio ? ' selected' : ''}`}
            aria-pressed={prefs.audio}
            aria-label={prefs.audio ? 'Turn sound off' : 'Turn sound on'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => togglePref('audio')}
          >
            {soundGlyph(prefs.audio)}
          </button>
          <button
            type="button"
            className={`gear-glyph prefs-glyph${prefs.haptics ? ' selected' : ''}`}
            aria-pressed={prefs.haptics}
            aria-label={prefs.haptics ? 'Turn vibration off' : 'Turn vibration on'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => togglePref('haptics')}
          >
            {hapticsGlyph(prefs.haptics)}
          </button>
        </div>
      ) : null}

      {started ? null : splashStage === 'primary' ? (
        <button
          className="splash-title-screen"
          type="button"
          aria-label="Continue to Vibe Academy splash"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
          }}
          // onClick is the SOLE advance trigger (covers touch, mouse and
          // keyboard). Advancing from onPointerUp as well double-fired per
          // tap on Chromium: pointerup advanced to the credits screen, then
          // the same tap's synthesized click advanced again through the
          // re-rendered closure — skipping the credits screen entirely.
          onClick={advanceSplash}
          data-testid="tap-to-begin"
        >
          <img
            src="/images/reel-mobile-splash.png?v=20260525-game-splash"
            alt="Reel Mobile"
            className="splash-title-image"
            draggable={false}
          />
          <span className="splash-hint">Tap to continue</span>
        </button>
      ) : (
        // A div, not a <button>: the card nests links and OfflineStatus's
        // clear-cache button, and interactive elements inside a <button> are
        // invalid HTML (React hydration warning, broken a11y tree). The whole
        // screen stays tappable via onClick; the "Tap to start" pill below is
        // the real, keyboard-focusable button.
        <div
          className="splash-credit-screen"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
          }}
          onClick={begin}
          data-testid="tap-to-begin"
        >
          <span className="splash-credit-card">
            <span className="splash-kicker">Birb Labs Artefact</span>
            <span className="splash-title">Build yours at Vibe Academy</span>
            <span className="splash-copy">
              From the mind of Mentis. A small playable pond, shipped as a
              breakable toy for builders to inspect, remix, and learn from.
            </span>
            <span className="splash-links">
              <a
                href="https://www.vibeacademy.com.au/"
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Vibe Academy
              </a>
              <a
                href="https://x.com/adam_x_mentis"
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Mentis
              </a>
            </span>
            <OfflineStatus />
            <IosInstallHint />
          </span>
          <button type="button" className="splash-hint" aria-label="Enter the pond" onClick={begin}>
            Tap to start
          </button>
        </div>
      )}

      {gameState.kind === 'result' ? (
        <CatchResultCard
          outcome={gameState.outcome}
          result={gameState.catch ?? null}
          storyText={gameState.storyText}
          dismissReady={resultDismissReady}
          onCastAgain={resetCast}
        />
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
    // Rod gear (22_THE_GEAR): rangeMult scales how far a full cast throws (the short
    // rod literally can't reach the far dark); accuracyMult scales the landing
    // spread below. reachT deliberately stays on the GLOBAL castMaxRangeM so spread
    // reads as f(physical reach) — a short rod confined to near water is tight, and
    // accuracyMult tightens it further; it does NOT make the short rod scatter more
    // per metre. Both scatter and the aim reticle read the one spreadRadius below.
    const rod = rodMods(gearRef.current.rodId);
    const effMaxRange = TUNING.input.castMaxRangeM * rod.rangeMult;
    const target = clampToPond(
      {
        x: TUNING.world.rodTip.x + direction.x * power * effMaxRange,
        z: TUNING.world.rodTip.z + direction.z * power * effMaxRange
      },
      TUNING.world.pondWidthM,
      TUNING.world.pondHeightM,
      TUNING.world.pondMarginRatio
    );
    const visibleTarget = {
      x: clamp(target.x, -TUNING.input.castVisibleHalfWidthM, TUNING.input.castVisibleHalfWidthM),
      z: Math.min(target.z, TUNING.world.rodTip.z - TUNING.input.castMinForwardM)
    };

    // Accuracy falloff (19_THE_FAR_WATER): scatter the landing point by a radius
    // that grows with how far the cast reaches. Deterministic per gesture (hashed
    // from the release point) so the same drag always lands the same — testable,
    // and not a slot machine. sqrt() keeps the scatter uniform across the disc.
    const reach = Math.hypot(visibleTarget.x - TUNING.world.rodTip.x, visibleTarget.z - TUNING.world.rodTip.z);
    const reachT = clamp(reach / TUNING.input.castMaxRangeM, 0, 1);
    const spreadRadius = lerp(
      TUNING.input.castSpreadNearM,
      TUNING.input.castSpreadFarM,
      Math.pow(reachT, TUNING.input.castSpreadCurve)
    ) * rod.accuracyMult;
    const hash = (n: number) => {
      const s = Math.sin(n) * 43758.5453;
      return s - Math.floor(s);
    };
    const spreadAngle = hash(endX * 12.9898 + endY * 78.233) * Math.PI * 2;
    const spreadDist = Math.sqrt(hash(endX * 39.346 + endY * 11.135)) * spreadRadius;
    const scattered = {
      x: visibleTarget.x + Math.cos(spreadAngle) * spreadDist,
      z: visibleTarget.z + Math.sin(spreadAngle) * spreadDist
    };

    return {
      target: clampToFishableWater(scattered),
      aimTarget: clampToFishableWater(visibleTarget),
      spreadRadius,
      power,
      flightMs: lerp(TUNING.input.castFlightTimeMin, TUNING.input.castFlightTimeMax, power) * TUNING.timing.msPerSecond
    };
  }
}

// Wordless prefs glyphs, same abstract-mark language as the gear strip
// (14_DO_NOT_BUILD: no skeuomorphic chrome). A slash through the mark = off.
function soundGlyph(on: boolean) {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true">
      <path d="M7 11v6h4l5 4V7l-5 4H7Z" fill="currentColor" />
      {on ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M19.5 11a4.4 4.4 0 0 1 0 6" />
          <path d="M22 8.6a8 8 0 0 1 0 10.8" opacity="0.55" />
        </g>
      ) : (
        <path d="M19 11l6 6M25 11l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

function hapticsGlyph(on: boolean) {
  return (
    <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true">
      <rect x="10" y="6" width="8" height="16" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {on ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6.4 10.5v7" />
          <path d="M21.6 10.5v7" />
        </g>
      ) : (
        <path d="M6.5 6.5l15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
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
