export const CURRENT_CANDIDATE_TAG =
  process.env.NEXT_PUBLIC_REEL_CANDIDATE_TAG ?? 'v0.4-far-water-candidate';

export const CURRENT_MILESTONE = process.env.NEXT_PUBLIC_REEL_MILESTONE ?? 'far-water';

export function approvedTagFor(candidateTag: string): string {
  return candidateTag.replace('-candidate', '-approved');
}
