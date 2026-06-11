import type { ProceduralAudio } from '@/game/audio/procedural';
import type { FishSnapshot } from '@/game/fish/fishStateMachine';
import type { FishCueKind } from '@/game/fish/species';
import type { LureId, RodId } from '@/game/gear/gear';
import type { Vec2 } from '@/game/math/vec';
import type { VerletLine } from '@/game/physics/verletLine';
import type { FailureKind, GameState } from '@/game/state/gameStateMachine';

export type PointerSnapshot = {
  id: number;
  mode: 'aiming' | 'pending_lure' | 'rod_control' | 'reeling';
  startX: number;
  startY: number;
  x: number;
  y: number;
  downAt: number;
  startRodOffset: Vec2;
};

export type DecorFish = {
  snapshot: FishSnapshot;
  fadePhase: number;
  fadePeriodMs: number;
  nextCueAt: number;
  cueIndex: number;
};

export type Runtime = {
  state: GameState;
  fish: FishSnapshot;
  // Equipped gear ids (22_THE_GEAR), stamped onto the runtime so the per-frame
  // fight/lure/fish code resolves the same loadout the player chose pre-cast.
  rodId: RodId;
  lureId: LureId;
  fishFadePhase: number;
  fishFadePeriodMs: number;
  decorFish: DecorFish[];
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
  // Tap-to-reel: `reeling` is now a transient per-tap PULSE, not a held flag. A tap
  // sets reelPulseUntil = now + tapReelPulseMs; the frame loop derives
  // `reeling = now < reelPulseUntil` so the existing reel pull / tension rise / reel
  // audio all run for the brief pulse window, then stop until the next tap.
  reeling: boolean;
  reelPulseUntil: number;
  lastReelTapAt: number;
  lastBiteAt: number;
  lastTwitchAt: number | null;
  focusUntil: number;
  focusCooldownUntil: number;
  lateHookUntil: number;
  hookJerkUntil: number;
  nextRealCueAt: number;
  nextFalseCueAt: number;
  nextStruggleRippleAt: number;
  nextSurgeAt: number;
  lastRippleSweepAt: number;
  spawnIndex: number;
  realCueIndex: number;
  restoring: boolean;
  // True while the rod/lure explainer is open — freezes the pond sim so the
  // water holds still while reading (set from the overlay, read in GameScene).
  pondFrozen: boolean;
  minFps: number;
  fpsSamples: Array<{ at: number; fps: number }>;
  lowFpsSince: number;
  highFpsSince: number;
  degradationLevel: number;
  pixelRatio: number;
  aimTarget: Vec2 | null;
  aimSpread: number;
};

export type Ripple = {
  id: string;
  pos: Vec2;
  radius: number;
  createdAt: number;
  durationMs: number;
  falseCue: boolean;
  cue: FishCueKind;
};

export type AimPreview = {
  power: number;
  target: Vec2;
};

export type FocusIndicator = {
  id: string;
  x: number;
  y: number;
  createdAt: number;
};

export type SplashStage = 'primary' | 'secondary';

export type ViewportSize = {
  width: number;
  height: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type Overlay = {
  linePoints: ScreenPoint[];
  rodTip: ScreenPoint;
  lure: ScreenPoint;
  aimTarget: ScreenPoint | null;
  // Screen-space radii of the landing-zone reticle. rx != ry because the world
  // circle on the water plane projects to a foreshortened ellipse under the
  // over-the-water camera — flatter the farther you aim (19_THE_FAR_WATER).
  aimRingRx?: number;
  aimRingRy?: number;
};

export type SceneProps = {
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
