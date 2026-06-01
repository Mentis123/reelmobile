export const CURRENT_CANDIDATE_TAG =
  process.env.NEXT_PUBLIC_REEL_CANDIDATE_TAG ?? 'v0.3.2-pond-polish-candidate';

export const CURRENT_MILESTONE = process.env.NEXT_PUBLIC_REEL_MILESTONE ?? 'm3.2';

export function approvedTagFor(candidateTag: string): string {
  return candidateTag.replace('-candidate', '-approved');
}
