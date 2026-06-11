import { SPECIES_IDS, type SpeciesId } from '@/game/fish/species';
import { trophyLengthCm } from '@/game/fish/trophy';
import { getJournal } from '@/game/persistence/catchJournal';
import type { Catch } from '@/game/persistence/sessionStore';

function isKnownSpecies(species: string): species is SpeciesId {
  return (SPECIES_IDS as string[]).includes(species);
}

// Personal recognition for a just-landed catch, judged against the player's
// OWN journal only (14_DO_NOT_BUILD forbids leaderboards/comparison; this is
// the player vs. their past self, the one comparison the game allows):
//   'first'   — the first fish they have ever landed
//   'overall' — longer than every fish in their journal
//   'species' — their biggest of this species so far
// Call BEFORE the catch is appended to the journal, or it compares to itself.
export function personalBestFor(entry: Catch): 'first' | 'overall' | 'species' | undefined {
  const previous = getJournal().catches;
  if (previous.length === 0) {
    return 'first';
  }
  if (!isKnownSpecies(entry.species)) {
    return undefined;
  }

  const lengthCm = trophyLengthCm(entry.species, entry.sizeScore);
  let overallBest = 0;
  let speciesBest = 0;
  for (const past of previous) {
    if (!isKnownSpecies(past.species)) continue;
    const pastLength = trophyLengthCm(past.species, past.sizeScore);
    if (pastLength > overallBest) overallBest = pastLength;
    if (past.species === entry.species && pastLength > speciesBest) speciesBest = pastLength;
  }

  if (lengthCm > overallBest) {
    return 'overall';
  }
  if (lengthCm > speciesBest) {
    return 'species';
  }
  return undefined;
}
