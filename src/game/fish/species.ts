import { TUNING } from '@/game/tuning/tuning';

export type SpeciesId = keyof typeof TUNING.fish.species;

export type FishCueKind =
  | 'bubble_trail'
  | 'glint'
  | 'surface_rise'
  | 'tail_flash'
  | 'silt_plume'
  | 'wake'
  | 'ripple';

export type FishInstance = {
  species: SpeciesId;
  personality: number;
};

export type SpeciesTuning = typeof TUNING.fish.species[SpeciesId];

export const SPECIES_IDS = Object.keys(TUNING.fish.species) as SpeciesId[];

export const SPECIES_CUE_SIGNATURES: Record<SpeciesId, FishCueKind[]> = {
  bronze_carp: ['bubble_trail', 'ripple'],
  moss_bass: ['glint', 'ripple'],
  moon_minnow: ['surface_rise', 'tail_flash'],
  old_kingfish: ['silt_plume', 'ripple'],
  reed_pike: ['wake', 'ripple']
};

export const SPECIES_STORY_LABELS: Record<SpeciesId, string> = {
  bronze_carp: 'Bronze Carp',
  moss_bass: 'Moss Bass',
  moon_minnow: 'Moon Minnow',
  old_kingfish: 'Old Kingfish',
  reed_pike: 'Reed Pike'
};

export function createFishInstance(rng: () => number): FishInstance {
  return {
    species: pickSpecies(rng),
    personality: rng() * 2 - 1
  };
}

export function createFishInstanceOfSpecies(rng: () => number, species: SpeciesId): FishInstance {
  return {
    species,
    personality: rng() * 2 - 1
  };
}

export function speciesTuning(species: SpeciesId): SpeciesTuning {
  return TUNING.fish.species[species];
}

export function personalityMultiplier(personality: number): number {
  return 1 + personality * TUNING.fish.personalityModulation;
}

export function pickSpeciesCue(species: SpeciesId, cueIndex: number): FishCueKind {
  const cues = SPECIES_CUE_SIGNATURES[species];
  return cues[cueIndex % cues.length];
}

function pickSpecies(rng: () => number): SpeciesId {
  const totalWeight = SPECIES_IDS.reduce((sum, species) => sum + speciesTuning(species).spawnWeight, 0);
  let roll = rng() * totalWeight;

  for (const species of SPECIES_IDS) {
    roll -= speciesTuning(species).spawnWeight;

    if (roll <= 0) {
      return species;
    }
  }

  return 'bronze_carp';
}
