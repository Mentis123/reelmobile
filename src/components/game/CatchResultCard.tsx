'use client';

import { useEffect, useRef } from 'react';
import type { FailureKind, ResultCatch } from '@/game/state/gameStateMachine';
import { SPECIES_IDS, type SpeciesId } from '@/game/fish/species';
import {
  SPECIES_ART,
  drawSpeciesTrophy,
  speciesLabel,
  trophyLengthCm,
  trophySizeWord
} from '@/game/fish/trophy';

const LURE_LABELS: Record<string, string> = {
  default: 'moss-green lure'
};

function isKnownSpecies(species: string): species is SpeciesId {
  return (SPECIES_IDS as string[]).includes(species);
}

function fightLine(durationMs: number, nearSnaps: number): string {
  const seconds = Math.round(durationMs / 1000);
  const duration = seconds >= 1 ? `${seconds}s` : 'under a second';
  const struggle =
    nearSnaps >= 2 ? 'nearly snapped twice' : nearSnaps === 1 ? 'almost lost it once' : 'a steady fight';
  return `${duration} · ${struggle}`;
}

/** Moonlit side-profile trophy fish. Uses generated art if present, else procedural. */
export function FishPortrait({ species, sizeScore }: { species: SpeciesId; sizeScore: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const art = SPECIES_ART[species];

  useEffect(() => {
    if (art) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSpeciesTrophy(ctx, w, h, species, sizeScore);
  }, [art, species, sizeScore]);

  if (art) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="fish-portrait" src={art} alt={`${speciesLabel(species)} you caught`} />;
  }
  return <canvas ref={canvasRef} className="fish-portrait" aria-label={`${speciesLabel(species)} you caught`} role="img" />;
}

type CatchResultCardProps = {
  outcome: 'catch' | FailureKind;
  result: ResultCatch | null;
  storyText: string;
  dismissReady?: boolean;
  onCastAgain?: () => void;
  className?: string;
  inline?: boolean;
};

export function CatchResultCard({
  outcome,
  result,
  storyText,
  dismissReady = true,
  onCastAgain,
  className,
  inline = false
}: CatchResultCardProps) {
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const classes = ['result-card', inline ? 'result-card--inline' : '', className].filter(Boolean).join(' ');

  const showTrophy = outcome === 'catch' && result && isKnownSpecies(result.species);

  return (
    <section className={classes} data-testid="result-card" onPointerDown={stop}>
      {showTrophy && result ? (
        <>
          <div className="result-trophy">
            <FishPortrait species={result.species as SpeciesId} sizeScore={result.sizeScore} />
          </div>
          <p className="result-eyebrow">Landed</p>
          <h2 className="result-headline">{speciesLabel(result.species)}</h2>
          <p className="result-meta">
            {trophyLengthCm(result.species as SpeciesId, result.sizeScore)} cm · {trophySizeWord(result.sizeScore)}
          </p>
          <p className="result-fight">{fightLine(result.durationMs, result.nearSnaps)}</p>
          <p className="result-lure">Took the {LURE_LABELS[result.lure] ?? 'lure'}.</p>
        </>
      ) : (
        <p className="result-miss-text">{storyText}</p>
      )}
      <button
        type="button"
        className="result-cast-again"
        disabled={!dismissReady}
        onPointerDown={stop}
        onClick={() => {
          if (dismissReady) onCastAgain?.();
        }}
      >
        Cast again.
      </button>
    </section>
  );
}
