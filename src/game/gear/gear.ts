import { TUNING } from '@/game/tuning/tuning';

// Two rods + three lures as pre-cast sidegrades (22_THE_GEAR). Ids index the
// TUNING.gear multiplier tables; every default-gear multiplier is 1.0 so the
// default loadout is exactly today's validated feel.
export type RodId = keyof typeof TUNING.gear.rods;
export type LureId = keyof typeof TUNING.gear.lures;
export type RodMods = typeof TUNING.gear.rods[RodId];
export type LureMods = typeof TUNING.gear.lures[LureId];

export const ROD_IDS = Object.keys(TUNING.gear.rods) as RodId[];
export const LURE_IDS = Object.keys(TUNING.gear.lures) as LureId[];

export const DEFAULT_ROD_ID: RodId = TUNING.gear.defaultRodId;
export const DEFAULT_LURE_ID: LureId = TUNING.gear.defaultLureId;

// Spare, distance-first names (no RPG/brand naming, 14_DO_NOT_BUILD). Used by the
// glyph strip's a11y labels and the journal/share attribution — never a tier badge.
export const ROD_LABELS: Record<RodId, string> = {
  long: 'Long rod',
  short: 'Short rod'
};
export const LURE_LABELS: Record<LureId, string> = {
  natural: 'Natural',
  popper: 'Popper',
  sinker: 'Sinker'
};

export function isRodId(id: string): id is RodId {
  return (ROD_IDS as string[]).includes(id);
}
export function isLureId(id: string): id is LureId {
  return (LURE_IDS as string[]).includes(id);
}

export function rodMods(id: RodId): RodMods {
  return TUNING.gear.rods[id];
}
export function lureMods(id: LureId): LureMods {
  return TUNING.gear.lures[id];
}
