'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FishPortrait } from '@/components/game/CatchResultCard';
import { SPECIES_IDS, type SpeciesId } from '@/game/fish/species';
import { speciesLabel, trophyLengthCm, trophySizeWord } from '@/game/fish/trophy';
import { getJournal, type Journal } from '@/game/persistence/catchJournal';
import type { Catch } from '@/game/persistence/sessionStore';

function isKnownSpecies(species: string): species is SpeciesId {
  return (SPECIES_IDS as string[]).includes(species);
}

function fightLine(c: Catch): string {
  const seconds = Math.round(c.durationMs / 1000);
  const duration = seconds >= 1 ? `${seconds}s` : 'under a second';
  const struggle = c.nearSnaps >= 2 ? 'nearly snapped twice' : c.nearSnaps === 1 ? 'almost lost it once' : 'a steady fight';
  return `${duration} · ${struggle}`;
}

function whenLabel(at: number): string {
  try {
    const d = new Date(at);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function JournalPage() {
  // localStorage is client-only — read after mount to avoid a hydration mismatch.
  const [journal, setJournal] = useState<Journal | null>(null);
  useEffect(() => {
    setJournal(getJournal());
  }, []);

  const catches = useMemo(() => {
    if (!journal) return [];
    return [...journal.catches].sort((a, b) => b.at - a.at);
  }, [journal]);

  const speciesCount = useMemo(() => new Set(catches.map((c) => c.species)).size, [catches]);

  const best = useMemo(() => {
    let top: { len: number; species: SpeciesId; entry: Catch } | null = null;
    for (const c of catches) {
      if (!isKnownSpecies(c.species)) continue;
      const len = trophyLengthCm(c.species, c.sizeScore);
      if (!top || len > top.len) top = { len, species: c.species, entry: c };
    }
    return top;
  }, [catches]);

  if (!journal) {
    return <main className="journal" />;
  }

  return (
    <main className="journal">
      <header className="journal-head">
        <h1>Journal</h1>
        {catches.length > 0 ? (
          <p className="journal-totals">
            {catches.length} landed · {speciesCount} {speciesCount === 1 ? 'kind' : 'kinds'}
          </p>
        ) : null}
        <Link href="/game" className="journal-back">Cast a line →</Link>
      </header>

      {best ? (
        // The biggest catch is the journal's hero — the trophy wall's centre
        // piece, not a stat line. Personal recognition only (14_DO_NOT_BUILD).
        <Link href={`/journal/${best.entry.id}`} className="journal-hero">
          <div className="journal-hero-fish">
            <FishPortrait species={best.species} sizeScore={best.entry.sizeScore} />
          </div>
          <div className="journal-hero-body">
            <p className="journal-hero-eyebrow">Biggest catch</p>
            <h2 className="journal-hero-name">{speciesLabel(best.species)}</h2>
            <p className="journal-hero-meta">
              {best.len} cm · {trophySizeWord(best.entry.sizeScore)} · {whenLabel(best.entry.at)}
            </p>
          </div>
        </Link>
      ) : null}

      {catches.length === 0 ? (
        <div className="journal-empty">
          <p>No catches yet.</p>
          <p className="journal-empty-sub">The pond is waiting.</p>
          <Link href="/game" className="journal-cta">Cast a line →</Link>
        </div>
      ) : (
        <ul className="journal-list">
          {catches.map((c) => (
            <li key={c.id}>
              <Link href={`/journal/${c.id}`} className="journal-entry">
                <div className="journal-entry-fish">
                  {isKnownSpecies(c.species) ? (
                    <FishPortrait species={c.species} sizeScore={c.sizeScore} />
                  ) : null}
                </div>
                <div className="journal-entry-body">
                  <h2 className="journal-entry-name">{speciesLabel(c.species)}</h2>
                  <p className="journal-entry-meta">
                    {isKnownSpecies(c.species) ? `${trophyLengthCm(c.species, c.sizeScore)} cm · ` : ''}
                    {trophySizeWord(c.sizeScore)}
                  </p>
                  <p className="journal-entry-fight">{fightLine(c)}</p>
                  <p className="journal-entry-when">{whenLabel(c.at)}</p>
                </div>
                <span className="journal-entry-chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
