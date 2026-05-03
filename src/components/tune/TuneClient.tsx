'use client';

import { useMemo, useState } from 'react';

import { TUNING } from '@/game/tuning/tuning';

type FlatEntry = {
  path: string;
  value: string;
};

export function TuneClient() {
  const entries = useMemo(() => flatten(TUNING), []);
  const [filter, setFilter] = useState('');

  const visible = entries.filter((entry) => entry.path.toLowerCase().includes(filter.toLowerCase()));

  return (
    <main className="tune-page" data-testid="tune-route">
      <header className="tune-header">
        <p className="eyebrow">Milestone 1</p>
        <h1>Feel constants</h1>
        <input
          aria-label="Filter tuning constants"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="filter"
        />
      </header>
      <section className="tune-grid" aria-label="Hot-reloadable constants from tuning.ts">
        {visible.map((entry) => (
          <label key={entry.path} className="tune-row">
            <span>{entry.path}</span>
            <input readOnly value={entry.value} />
          </label>
        ))}
      </section>
    </main>
  );
}

function flatten(value: unknown, prefix = ''): FlatEntry[] {
  if (typeof value !== 'object' || value === null) {
    return [{ path: prefix, value: String(value) }];
  }

  if (Array.isArray(value)) {
    return [{ path: prefix, value: value.join(', ') }];
  }

  return Object.entries(value).flatMap(([key, nextValue]) => flatten(nextValue, prefix ? `${prefix}.${key}` : key));
}
