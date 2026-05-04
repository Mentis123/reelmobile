import type { Catch } from '@/game/persistence/sessionStore';
import { SPECIES_STORY_LABELS } from '@/game/fish/species';

const SPECIES_LABELS: Record<string, string> = {
  generic: 'pond fish',
  ...SPECIES_STORY_LABELS
};

const LURE_LABELS: Record<string, string> = {
  default: 'moss-green lure'
};

export function generateStory(catchEntry: Catch): string {
  const size = catchEntry.sizeScore > 0.7
    ? 'A heavy'
    : catchEntry.sizeScore > 0.4
      ? 'A solid'
      : 'A small';
  const speciesLabel = SPECIES_LABELS[catchEntry.species] ?? 'pond fish';
  const lureLabel = LURE_LABELS[catchEntry.lure] ?? 'lure';
  const struggle = catchEntry.nearSnaps >= 2
    ? 'Nearly snapped twice.'
    : catchEntry.nearSnaps === 1
      ? 'Almost lost it once.'
      : 'Steady fight.';
  const duration = catchEntry.durationMs > 15000
    ? `Took over ${Math.round(catchEntry.durationMs / 1000)} seconds.`
    : 'Came in close to the dock.';

  return `Caught.\n${size} ${speciesLabel}.\nTook the ${lureLabel}.\n${struggle}\n${duration}`.trim();
}

export function failureStory(kind: string): string {
  if (kind === 'missed_early') {
    return 'Missed.\nToo soon. The fish slipped away.';
  }

  if (kind === 'missed_late') {
    return 'Missed.\nToo late. It dropped the lure and bolted.';
  }

  if (kind === 'snap') {
    return 'Lost.\nSnapped. The lure is gone with the fish.';
  }

  if (kind === 'escape') {
    return 'Lost.\nYou stopped reeling. The line went slack and the fish threw the hook.';
  }

  return 'No fish.\nThe pond went quiet.';
}
