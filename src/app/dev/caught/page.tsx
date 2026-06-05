'use client';

import Link from 'next/link';
import { CatchResultCard } from '@/components/game/CatchResultCard';
import { SPECIES_IDS } from '@/game/fish/species';
import type { ResultCatch } from '@/game/state/gameStateMachine';

// Representative sample catches so every species' trophy can be eyeballed live
// without playing a full session. Sizes/fights chosen to span the range.
const SAMPLES: Record<string, { sizeScore: number; durationMs: number; nearSnaps: number }> = {
  bronze_carp: { sizeScore: 0.62, durationMs: 19000, nearSnaps: 1 },
  moss_bass: { sizeScore: 0.55, durationMs: 12000, nearSnaps: 0 },
  moon_minnow: { sizeScore: 0.38, durationMs: 5000, nearSnaps: 0 },
  old_kingfish: { sizeScore: 0.92, durationMs: 47000, nearSnaps: 2 },
  reed_pike: { sizeScore: 0.5, durationMs: 23000, nearSnaps: 1 }
};

export default function CaughtPreviewPage() {
  return (
    <main className="caught-preview">
      <header className="caught-preview-head">
        <h1>Caught screen — trophy preview</h1>
        <p>Generated hero art per species (procedural draw is the fallback). All five, on the real card layout.</p>
        <p className="caught-preview-nav">
          <Link href="/dev">← /dev</Link> · <Link href="/journal">journal</Link> · <Link href="/dev/share">share cards</Link>
        </p>
      </header>

      <div className="caught-preview-grid">
        {SPECIES_IDS.map((species) => {
          const sample = SAMPLES[species] ?? { sizeScore: 0.6, durationMs: 15000, nearSnaps: 0 };
          const result: ResultCatch = {
            species,
            sizeScore: sample.sizeScore,
            lure: 'natural',
            durationMs: sample.durationMs,
            nearSnaps: sample.nearSnaps,
            peakTension: sample.sizeScore
          };
          return (
            <CatchResultCard
              key={species}
              outcome="catch"
              result={result}
              storyText=""
              inline
              onCastAgain={() => undefined}
            />
          );
        })}
      </div>
    </main>
  );
}
