'use client';

import { useGameStore } from '@/game/state/gameStore';

export function DebugHud({ metrics, gameState, fishState, lureState, tension, seed }: {
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
