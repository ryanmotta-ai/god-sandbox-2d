export enum TraitId {
  BLESSED = 'blessed',
  GIANT = 'giant',
  QUICK = 'quick',
  GENIUS = 'genius',
  VETERAN = 'veteran',
  REGENERATOR = 'regenerator',
  CURSED = 'cursed',
  IMMORTAL = 'immortal',
  FLAMMABLE = 'flammable',
  PACIFIST = 'pacifist',
  PYROMANIAC = 'pyromaniac',
  IRONCLAD = 'ironclad'
}

export interface TraitDefinition {
  id: TraitId;
  name: string;
  description: string;
  color: string;
  inheritChance: number; // 0 to 1
  hpMod?: number;        // Multiplier e.g. 1.2
  speedMod?: number;
  damageMod?: number;
  defenseMod?: number;
}

export const TRAIT_DEFINITIONS: Record<TraitId, TraitDefinition> = {
  [TraitId.BLESSED]: {
    id: TraitId.BLESSED,
    name: 'Blessed',
    description: '+25% Max HP & Divine Favor',
    color: '#fbbf24',
    inheritChance: 0.3,
    hpMod: 1.25
  },
  [TraitId.GIANT]: {
    id: TraitId.GIANT,
    name: 'Giant',
    description: '+50% Max HP, +30% Damage, slower movement',
    color: '#f97316',
    inheritChance: 0.25,
    hpMod: 1.5,
    damageMod: 1.3,
    speedMod: 0.8
  },
  [TraitId.QUICK]: {
    id: TraitId.QUICK,
    name: 'Quick',
    description: '+40% Movement Speed',
    color: '#06b6d4',
    inheritChance: 0.4,
    speedMod: 1.4
  },
  [TraitId.GENIUS]: {
    id: TraitId.GENIUS,
    name: 'Genius',
    description: 'High intellect, fast work output',
    color: '#8b5cf6',
    inheritChance: 0.2
  },
  [TraitId.VETERAN]: {
    id: TraitId.VETERAN,
    name: 'Veteran',
    description: '+15 combat experience, +4 Defense',
    color: '#10b981',
    inheritChance: 0.1,
    defenseMod: 1.2,
    damageMod: 1.15
  },
  [TraitId.REGENERATOR]: {
    id: TraitId.REGENERATOR,
    name: 'Regenerator',
    description: 'Continuously recovers health',
    color: '#34d399',
    inheritChance: 0.35
  },
  [TraitId.CURSED]: {
    id: TraitId.CURSED,
    name: 'Cursed',
    description: '-30% Max HP, prone to accidents',
    color: '#6b21a8',
    inheritChance: 0.2,
    hpMod: 0.7
  },
  [TraitId.IMMORTAL]: {
    id: TraitId.IMMORTAL,
    name: 'Immortal',
    description: 'Does not age or suffer old age death',
    color: '#ec4899',
    inheritChance: 0.05
  },
  [TraitId.FLAMMABLE]: {
    id: TraitId.FLAMMABLE,
    name: 'Flammable',
    description: 'Takes double fire damage',
    color: '#ef4444',
    inheritChance: 0.3
  },
  [TraitId.PACIFIST]: {
    id: TraitId.PACIFIST,
    name: 'Pacifist',
    description: 'Avoids combat and violence',
    color: '#38bdf8',
    inheritChance: 0.3
  },
  [TraitId.PYROMANIAC]: {
    id: TraitId.PYROMANIAC,
    name: 'Pyromaniac',
    description: 'Loves setting fires',
    color: '#dc2626',
    inheritChance: 0.15
  },
  [TraitId.IRONCLAD]: {
    id: TraitId.IRONCLAD,
    name: 'Ironclad',
    description: '+50% Defense boost',
    color: '#64748b',
    inheritChance: 0.25,
    defenseMod: 1.5
  }
};
