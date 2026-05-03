import { create } from 'zustand';

import type { FishState } from '@/game/fish/fishStateMachine';
import type { GameState } from '@/game/state/gameStateMachine';
import { TUNING } from '@/game/tuning/tuning';

export type DebugMetrics = {
  fps: number;
  avgFps1s: number;
  avgFps5s: number;
  drawCalls: number;
  triangles: number;
  textureCount: number;
  jsHeapMb: number | null;
  pixelRatio: number;
  degradationLevel: number;
};

type GameStore = {
  gameState: GameState;
  fishState: FishState;
  tension: number;
  reeling: boolean;
  seed: string;
  lureState: string;
  debugMetrics: DebugMetrics;
  glHandlersReady: boolean;
  setGameState: (gameState: GameState) => void;
  setFishState: (fishState: FishState) => void;
  setTension: (tension: number) => void;
  setReeling: (reeling: boolean) => void;
  setSeed: (seed: string) => void;
  setLureState: (lureState: string) => void;
  setDebugMetrics: (debugMetrics: DebugMetrics) => void;
  setGlHandlersReady: (glHandlersReady: boolean) => void;
};

export const useGameStore = create<GameStore>((set) => ({
  gameState: { kind: 'splash' },
  fishState: { kind: 'wander', targetPos: { x: TUNING.world.fishStart.x, z: TUNING.world.fishStart.z }, sinceMs: 0 },
  tension: 0,
  reeling: false,
  seed: '',
  lureState: 'waiting',
  debugMetrics: {
    fps: 0,
    avgFps1s: 0,
    avgFps5s: 0,
    drawCalls: 0,
    triangles: 0,
    textureCount: 0,
    jsHeapMb: null,
    pixelRatio: 1,
    degradationLevel: 0
  },
  glHandlersReady: false,
  setGameState: (gameState) => set({ gameState }),
  setFishState: (fishState) => set({ fishState }),
  setTension: (tension) => set({ tension }),
  setReeling: (reeling) => set({ reeling }),
  setSeed: (seed) => set({ seed }),
  setLureState: (lureState) => set({ lureState }),
  setDebugMetrics: (debugMetrics) => set({ debugMetrics }),
  setGlHandlersReady: (glHandlersReady) => set({ glHandlersReady })
}));
