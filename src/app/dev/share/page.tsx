'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SPECIES_IDS } from '@/game/fish/species';
import { speciesLabel } from '@/game/fish/trophy';
import { renderCatchCard } from '@/game/share/catchCard';

const SAMPLES: Record<string, { sizeScore: number; durationMs: number; nearSnaps: number }> = {
  bronze_carp: { sizeScore: 0.62, durationMs: 19000, nearSnaps: 1 },
  moss_bass: { sizeScore: 0.55, durationMs: 12000, nearSnaps: 0 },
  moon_minnow: { sizeScore: 0.38, durationMs: 5000, nearSnaps: 0 },
  old_kingfish: { sizeScore: 0.92, durationMs: 47000, nearSnaps: 2 },
  reed_pike: { sizeScore: 0.5, durationMs: 23000, nearSnaps: 1 }
};

export default function ShareCardPreviewPage() {
  const [cards, setCards] = useState<Array<{ species: string; url: string }>>([]);

  useEffect(() => {
    let revoked = false;
    const urls: string[] = [];
    (async () => {
      const out: Array<{ species: string; url: string }> = [];
      for (const species of SPECIES_IDS) {
        const s = SAMPLES[species] ?? { sizeScore: 0.6, durationMs: 15000, nearSnaps: 0 };
        const blob = await renderCatchCard({ species, sizeScore: s.sizeScore, durationMs: s.durationMs, nearSnaps: s.nearSnaps });
        if (blob) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          out.push({ species, url });
        }
      }
      if (!revoked) setCards(out);
    })();
    return () => {
      revoked = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  return (
    <main className="caught-preview">
      <header className="caught-preview-head">
        <h1>Share card preview</h1>
        <p>The PNG generated for navigator.share / download, all five species.</p>
        <Link href="/dev/caught">← caught cards</Link>
      </header>
      <div className="caught-preview-grid">
        {cards.map((c) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c.species} src={c.url} alt={`${speciesLabel(c.species)} share card`} style={{ width: '100%', borderRadius: 12 }} />
        ))}
      </div>
    </main>
  );
}
