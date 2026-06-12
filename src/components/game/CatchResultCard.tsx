'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FailureKind, ResultCatch } from '@/game/state/gameStateMachine';
import { SPECIES_IDS, type SpeciesId } from '@/game/fish/species';
import {
  SPECIES_ART,
  drawSpeciesTrophy,
  speciesLabel,
  trophyLengthCm,
  trophySizeWord
} from '@/game/fish/trophy';
import { shareCatch } from '@/game/share/shareCatch';

// Gear-era lures (22_THE_GEAR) plus the pre-gear 'default' kept for catches
// already sitting in players' journals.
const LURE_LABELS: Record<string, string> = {
  default: 'moss-green lure',
  natural: 'natural lure',
  popper: 'popper',
  sinker: 'sinker'
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
  castAgainLabel?: string;
  // The secondary nav link under the buttons. Defaults to "View journal" for the
  // in-game result; pass null to hide it (e.g. on the journal's own catch page).
  journalLink?: { label: string; href: string } | null;
  className?: string;
  inline?: boolean;
};

export function CatchResultCard({
  outcome,
  result,
  storyText,
  dismissReady = true,
  onCastAgain,
  castAgainLabel = 'Cast again.',
  journalLink = { label: 'View journal →', href: '/journal' },
  className,
  inline = false
}: CatchResultCardProps) {
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const classes = ['result-card', inline ? 'result-card--inline' : '', className].filter(Boolean).join(' ');

  const showTrophy = outcome === 'catch' && result && isKnownSpecies(result.species);

  // Modal-like card: move focus into it on mount so keyboard/screen-reader
  // users land on the result instead of staying lost on the canvas behind it.
  // Inline embeds (journal detail page) are normal page content — skip there.
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!inline) {
      cardRef.current?.focus();
    }
  }, [inline]);

  const [shareState, setShareState] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'failed'>('idle');
  const shareLabel =
    shareState === 'working' ? 'Sharing…'
    : shareState === 'shared' ? 'Shared ✓'
    : shareState === 'downloaded' ? 'Saved ✓'
    : shareState === 'failed' ? 'Try again'
    : 'Share';
  const handleShare = async () => {
    if (!result || shareState === 'working') return;
    setShareState('working');
    setShareState(await shareCatch(result));
  };

  return (
    <section
      ref={cardRef}
      className={classes}
      data-testid="result-card"
      onPointerDown={stop}
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-label={outcome === 'catch' ? 'Catch result' : 'Cast result'}
      tabIndex={-1}
    >
      {showTrophy && result ? (
        <>
          <div className="result-trophy">
            <FishPortrait species={result.species as SpeciesId} sizeScore={result.sizeScore} />
          </div>
          {result.personalBest ? (
            <p className="result-eyebrow result-eyebrow--best">
              {result.personalBest === 'first'
                ? 'Your first catch'
                : result.personalBest === 'overall'
                  ? 'Your biggest yet'
                  : `Your biggest ${speciesLabel(result.species)} yet`}
            </p>
          ) : (
            <p className="result-eyebrow">Landed</p>
          )}
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
      <div className="result-actions">
        <button
          type="button"
          className="result-cast-again"
          disabled={!dismissReady}
          onPointerDown={stop}
          onClick={() => {
            if (dismissReady) onCastAgain?.();
          }}
        >
          {castAgainLabel}
        </button>
        {showTrophy ? (
          <button
            type="button"
            className="result-share"
            onPointerDown={stop}
            onClick={handleShare}
            disabled={shareState === 'working'}
          >
            {shareLabel}
          </button>
        ) : null}
      </div>
      {showTrophy && journalLink ? (
        <Link href={journalLink.href} className="result-journal-link" onPointerDown={stop}>
          {journalLink.label}
        </Link>
      ) : null}
    </section>
  );
}
