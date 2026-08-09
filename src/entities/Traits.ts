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
    name: 'Abençoado',
    description: '+25% HP Máx & Favor Divino',
    color: '#fbbf24',
    inheritChance: 0.3,
    hpMod: 1.25
  },
  [TraitId.GIANT]: {
    id: TraitId.GIANT,
    name: 'Gigante',
    description: '+50% HP Máx, +30% Dano, movimento mais lento',
    color: '#f97316',
    inheritChance: 0.25,
    hpMod: 1.5,
    damageMod: 1.3,
    speedMod: 0.8
  },
  [TraitId.QUICK]: {
    id: TraitId.QUICK,
    name: 'Veloz',
    description: '+40% Velocidade de Movimento',
    color: '#06b6d4',
    inheritChance: 0.4,
    speedMod: 1.4
  },
  [TraitId.GENIUS]: {
    id: TraitId.GENIUS,
    name: 'Gênio',
    description: 'Intelecto alto, trabalho rápido',
    color: '#8b5cf6',
    inheritChance: 0.2
  },
  [TraitId.VETERAN]: {
    id: TraitId.VETERAN,
    name: 'Veterano',
    description: '+15 experiência de combate, +4 Defesa',
    color: '#10b981',
    inheritChance: 0.1,
    defenseMod: 1.2,
    damageMod: 1.15
  },
  [TraitId.REGENERATOR]: {
    id: TraitId.REGENERATOR,
    name: 'Regenerador',
    description: 'Recupera HP continuamente',
    color: '#34d399',
    inheritChance: 0.35
  },
  [TraitId.CURSED]: {
    id: TraitId.CURSED,
    name: 'Amaldiçoado',
    description: '-30% HP Máx, propenso a acidentes',
    color: '#6b21a8',
    inheritChance: 0.2,
    hpMod: 0.7
  },
  [TraitId.IMMORTAL]: {
    id: TraitId.IMMORTAL,
    name: 'Imortal',
    description: 'Não envelhece ou morre de velhice',
    color: '#ec4899',
    inheritChance: 0.05
  },
  [TraitId.FLAMMABLE]: {
    id: TraitId.FLAMMABLE,
    name: 'Inflamável',
    description: 'Recebe o dobro de dano de fogo',
    color: '#ef4444',
    inheritChance: 0.3
  },
  [TraitId.PACIFIST]: {
    id: TraitId.PACIFIST,
    name: 'Pacifista',
    description: 'Evita combate e violência',
    color: '#38bdf8',
    inheritChance: 0.3
  },
  [TraitId.PYROMANIAC]: {
    id: TraitId.PYROMANIAC,
    name: 'Piromaníaco',
    description: 'Adora atear fogo',
    color: '#dc2626',
    inheritChance: 0.15
  },
  [TraitId.IRONCLAD]: {
    id: TraitId.IRONCLAD,
    name: 'Encouraçado',
    description: '+50% bônus de Defesa',
    color: '#64748b',
    inheritChance: 0.25,
    defenseMod: 1.5
  }
};
