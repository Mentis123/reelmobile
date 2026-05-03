import type { Catch } from '@/game/persistence/sessionStore';

const SPECIES_LABELS: Record<string, string> = {
  generic: 'pond fish'
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

  return `${size} ${speciesLabel}.\nTook the ${lureLabel}.\n${struggle}\n${duration}`.trim();
}

export function failureStory(kind: string): string {
  if (kind === 'missed_early') {
    return 'Too soon. The fish slipped away.';
  }

  if (kind === 'missed_late') {
    return 'Too late. It dropped the lure and bolted.';
  }

  if (kind === 'snap') {
    return 'Snapped. The lure is gone with the fish.';
  }

  if (kind === 'escape') {
    return 'It threw the hook. You let the line go slack.';
  }

  return 'The pond went quiet.';
}
