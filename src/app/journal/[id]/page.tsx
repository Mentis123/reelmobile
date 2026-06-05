'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CatchResultCard } from '@/components/game/CatchResultCard';
import { getJournal } from '@/game/persistence/catchJournal';
import type { Catch } from '@/game/persistence/sessionStore';
import type { ResultCatch } from '@/game/state/gameStateMachine';

function toResult(c: Catch): ResultCatch {
  return {
    species: c.species,
    sizeScore: c.sizeScore,
    lure: c.lure,
    durationMs: c.durationMs,
    nearSnaps: c.nearSnaps,
    peakTension: c.peakTension
  };
}

export default function CatchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // The journal lives in localStorage — resolve the catch after mount.
  const [state, setState] = useState<{ loaded: boolean; result: ResultCatch | null }>({ loaded: false, result: null });

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const found = getJournal().catches.find((c) => c.id === id) ?? null;
    setState({ loaded: true, result: found ? toResult(found) : null });
  }, [params]);

  if (!state.loaded) {
    return <main className="catch-detail" />;
  }

  if (!state.result) {
    return (
      <main className="catch-detail">
        <div className="catch-detail-missing">
          <p>That catch isn&apos;t in this journal.</p>
          <Link href="/journal" className="journal-cta">← Back to journal</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="catch-detail">
      <CatchResultCard
        outcome="catch"
        result={state.result}
        storyText=""
        castAgainLabel="← Back to journal"
        onCastAgain={() => router.push('/journal')}
        journalLink={null}
      />
    </main>
  );
}
