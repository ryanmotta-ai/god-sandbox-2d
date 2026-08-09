export enum TerrainType {
  DEEP_OCEAN = 'deep_ocean',
  SHALLOW_WATER = 'shallow_water',
  SAND = 'sand',
  SOIL = 'soil',
  GRASS = 'grass',
  FOREST = 'forest',
  SAVANNA = 'savanna',
  SWAMP = 'swamp',
  TUNDRA = 'tundra',
  SNOW = 'snow',
  MOUNTAIN = 'mountain',
  LAVA = 'lava',
  ARCANE = 'arcane',
  CORRUPTED = 'corrupted'
}

export interface TerrainConfig {
  id: TerrainType;
  name: string;
  color: string;
  isWater: boolean;
  isWalkable: boolean;
  flammability: number; // 0 to 1
  fertility: number; // 0 to 1
  moveCost: number;
}

export const TERRAINS: Record<TerrainType, TerrainConfig> = {
  [TerrainType.DEEP_OCEAN]: {
    id: TerrainType.DEEP_OCEAN,
    name: 'Oceano Profundo',
    color: '#0f172a',
    isWater: true,
    isWalkable: false,
    flammability: 0,
    fertility: 0,
    moveCost: 99
  },
  [TerrainType.SHALLOW_WATER]: {
    id: TerrainType.SHALLOW_WATER,
    name: 'Água Rasa',
    color: '#1e3a8a',
    isWater: true,
    isWalkable: false,
    flammability: 0,
    fertility: 0.1,
    moveCost: 99
  },
  [TerrainType.SAND]: {
    id: TerrainType.SAND,
    name: 'Areia',
    color: '#fde047',
    isWater: false,
    isWalkable: true,
    flammability: 0.0,
    fertility: 0.2,
    moveCost: 1.3
  },
  [TerrainType.SOIL]: {
    id: TerrainType.SOIL,
    name: 'Terra',
    color: '#854d0e',
    isWater: false,
    isWalkable: true,
    flammability: 0.0,
    fertility: 0.8,
    moveCost: 1.0
  },
  [TerrainType.GRASS]: {
    id: TerrainType.GRASS,
    name: 'Pastagem',
    color: '#15803d',
    isWater: false,
    isWalkable: true,
    flammability: 0.35,
    fertility: 1.0,
    moveCost: 1.0
  },
  [TerrainType.FOREST]: {
    id: TerrainType.FOREST,
    name: 'Floresta Densa',
    color: '#166534',
    isWater: false,
    isWalkable: true,
    flammability: 0.65,
    fertility: 0.9,
    moveCost: 1.4
  },
  [TerrainType.SAVANNA]: {
    id: TerrainType.SAVANNA,
    name: 'Savana',
    color: '#ca8a04',
    isWater: false,
    isWalkable: true,
    flammability: 0.5,
    fertility: 0.5,
    moveCost: 1.1
  },
  [TerrainType.SWAMP]: {
    id: TerrainType.SWAMP,
    name: 'Pântano',
    color: '#3f6212',
    isWater: false,
    isWalkable: true,
    flammability: 0.2,
    fertility: 0.6,
    moveCost: 2.0
  },
  [TerrainType.TUNDRA]: {
    id: TerrainType.TUNDRA,
    name: 'Tundra',
    color: '#0e7490',
    isWater: false,
    isWalkable: true,
    flammability: 0.2,
    fertility: 0.3,
    moveCost: 1.2
  },
  [TerrainType.SNOW]: {
    id: TerrainType.SNOW,
    name: 'Neve',
    color: '#e2e8f0',
    isWater: false,
    isWalkable: true,
    flammability: 0.0,
    fertility: 0.1,
    moveCost: 1.8
  },
  [TerrainType.MOUNTAIN]: {
    id: TerrainType.MOUNTAIN,
    name: 'Montanha',
    color: '#475569',
    isWater: false,
    isWalkable: false,
    flammability: 0.0,
    fertility: 0.1,
    moveCost: 99
  },
  [TerrainType.LAVA]: {
    id: TerrainType.LAVA,
    name: 'Lava',
    color: '#ef4444',
    isWater: false,
    isWalkable: false,
    flammability: 0.0,
    fertility: 0.0,
    moveCost: 99
  },
  [TerrainType.ARCANE]: {
    id: TerrainType.ARCANE,
    name: 'Bosque Arcano',
    color: '#a855f7',
    isWater: false,
    isWalkable: true,
    flammability: 0.3,
    fertility: 1.2,
    moveCost: 0.9
  },
  [TerrainType.CORRUPTED]: {
    id: TerrainType.CORRUPTED,
    name: 'Terras Corrompidas',
    color: '#581c87',
    isWater: false,
    isWalkable: true,
    flammability: 0.7,
    fertility: 0.1,
    moveCost: 1.5
  }
};
