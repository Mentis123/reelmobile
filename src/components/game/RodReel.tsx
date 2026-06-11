'use client';

import { lerp } from '@/game/math/vec';
import { TUNING } from '@/game/tuning/tuning';
import type { ScreenPoint } from '@/components/game/types';

export function RodReel({ rodButtScreen, rodTipScreen }: { rodButtScreen: ScreenPoint; rodTipScreen: ScreenPoint }) {
  const dx = rodTipScreen.x - rodButtScreen.x;
  const dy = rodTipScreen.y - rodButtScreen.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const tx = dx / length;
  const ty = dy / length;
  const nx = ty;
  const ny = -tx;
  // Single scale factor doubles the whole reel (19_THE_FAR_WATER rod-in-hand).
  const s = TUNING.world.rodReelScale;
  const reelDistance = TUNING.world.rodReelOffsetPx * s;
  const cx = rodButtScreen.x + tx * 18 * s;
  const cy = rodButtScreen.y + ty * 18 * s;
  const reelX = cx + nx * reelDistance;
  const reelY = cy + ny * reelDistance;
  const handleX = reelX + tx * 4 * s + nx * 9 * s;
  const handleY = reelY + ty * 4 * s + ny * 9 * s;
  const knobX = handleX + nx * 4 * s + tx * 1 * s;
  const knobY = handleY + ny * 4 * s + ty * 1 * s;

  return (
    <g className="rod-reel">
      <line
        x1={cx}
        y1={cy}
        x2={reelX + nx * 1.5 * s}
        y2={reelY + ny * 1.5 * s}
        stroke="#3a2718"
        strokeLinecap="round"
        strokeWidth={2.4 * s}
      />
      <circle
        cx={reelX}
        cy={reelY}
        r={9.5 * s}
        fill="rgba(20, 24, 24, 0.78)"
        stroke="var(--moonlight)"
        strokeWidth={1.6 * s}
      />
      <circle cx={reelX} cy={reelY} r={6.5 * s} fill="rgba(40, 44, 44, 0.78)" />
      <circle cx={reelX} cy={reelY} r={3 * s} fill="var(--ui-gold)" />
      <line
        x1={reelX}
        y1={reelY}
        x2={handleX}
        y2={handleY}
        stroke="var(--moonlight)"
        strokeLinecap="round"
        strokeWidth={1.8 * s}
      />
      <circle cx={knobX} cy={knobY} r={2.6 * s} fill="var(--ui-gold)" stroke="rgba(20, 24, 24, 0.7)" strokeWidth={0.8 * s} />
    </g>
  );
}

export function rodPathFromScreen(butt: ScreenPoint, tip: ScreenPoint, hookImpulse: number): string {
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
