/** Terrain and object tables. Ids are stored in Uint8Arrays, so order is part of the save format. */

export const T = {
  DEEP: 0, SHALLOW: 1, SAND: 2, DIRT: 3, GRASS: 4, JUNGLE: 5, SAVANNA: 6, DESERT: 7, SWAMP: 8,
  TUNDRA: 9, SNOW: 10, HILL: 11, MOUNTAIN: 12, PEAK: 13, LAVA: 14, ROCK: 15, ASH: 16, FIELD: 17,
  ROAD: 18, ENCHANTED: 19, CORRUPTED: 20,
} as const;
export type Terrain = number;

export interface TerrainDef {
  name: string;
  /** 0 water · 1 ground · 2 hill. Drives cliffs and shoreline art. Mountains are sprites on rocky ground, so they stay level 1. */
  level: 0 | 1 | 2;
  walk: boolean;
  /** Movement multiplier. */
  speed: number;
  flammable: number;
  water: boolean;
  /** Base colour ramp (dark → light) as hex; art derives everything else from it. */
  ramp: [string, string, string, string];
}

export const TERRAIN: TerrainDef[] = [
  { name: 'Oceano profundo', level: 0, walk: false, speed: 0, flammable: 0, water: true, ramp: ['#0b2a52', '#0f3a6b', '#14508a', '#1c66a3'] },
  { name: 'Água rasa', level: 0, walk: true, speed: 0.55, flammable: 0, water: true, ramp: ['#1d6fae', '#2a8bc4', '#43a6d6', '#7cc7e8'] },
  { name: 'Areia', level: 1, walk: true, speed: 0.85, flammable: 0, water: false, ramp: ['#c2a35a', '#d8bd72', '#e6d08c', '#f1e2a8'] },
  { name: 'Terra', level: 1, walk: true, speed: 1, flammable: 0.05, water: false, ramp: ['#6b4a30', '#80593a', '#966a45', '#ab7d54'] },
  { name: 'Grama', level: 1, walk: true, speed: 1, flammable: 0.6, water: false, ramp: ['#3d7a2c', '#4a9034', '#5aa43f', '#74bb4e'] },
  { name: 'Selva', level: 1, walk: true, speed: 0.9, flammable: 0.7, water: false, ramp: ['#1f6b2c', '#2a8135', '#369a40', '#4db253'] },
  { name: 'Savana', level: 1, walk: true, speed: 1, flammable: 0.8, water: false, ramp: ['#9a9a3a', '#b0ae48', '#c4c058', '#d6d072'] },
  { name: 'Deserto', level: 1, walk: true, speed: 0.8, flammable: 0, water: false, ramp: ['#d2a95c', '#e0ba6a', '#ecca7c', '#f5da96'] },
  { name: 'Pântano', level: 1, walk: true, speed: 0.6, flammable: 0.2, water: false, ramp: ['#2d4a35', '#37593f', '#456b4a', '#58805a'] },
  { name: 'Tundra', level: 1, walk: true, speed: 0.9, flammable: 0.1, water: false, ramp: ['#7d8a78', '#8d9a88', '#9eaa98', '#b3bdae'] },
  { name: 'Neve', level: 1, walk: true, speed: 0.75, flammable: 0, water: false, ramp: ['#c3d3e6', '#d6e3f1', '#e8f0f9', '#f8fcff'] },
  { name: 'Colina', level: 2, walk: true, speed: 0.8, flammable: 0.3, water: false, ramp: ['#4a8030', '#5a9438', '#6aa844', '#82bd58'] },
  { name: 'Montanha', level: 1, walk: false, speed: 0, flammable: 0, water: false, ramp: ['#4d4a52', '#66636b', '#827f86', '#a19ea3'] },
  { name: 'Pico nevado', level: 1, walk: false, speed: 0, flammable: 0, water: false, ramp: ['#8f98a8', '#b4bccb', '#dce3ee', '#fafcff'] },
  { name: 'Lava', level: 1, walk: false, speed: 0, flammable: 0, water: false, ramp: ['#7a1408', '#b82a0a', '#f06418', '#ffb23a'] },
  { name: 'Rocha', level: 1, walk: true, speed: 0.95, flammable: 0, water: false, ramp: ['#3b3a40', '#4c4b53', '#5f5e68', '#76757e'] },
  { name: 'Cinzas', level: 1, walk: true, speed: 1, flammable: 0, water: false, ramp: ['#2a2826', '#363330', '#46423e', '#58534d'] },
  { name: 'Campo', level: 1, walk: true, speed: 1, flammable: 0.5, water: false, ramp: ['#7a5a2a', '#8f6b30', '#a37c38', '#b88f45'] },
  { name: 'Estrada', level: 1, walk: true, speed: 1.3, flammable: 0, water: false, ramp: ['#8a7355', '#9d8664', '#b19a76', '#c4af8a'] },
  { name: 'Encantado', level: 1, walk: true, speed: 1, flammable: 0.2, water: false, ramp: ['#6a3fa0', '#7d4fb8', '#9462d0', '#b284e8'] },
  { name: 'Corrompido', level: 1, walk: true, speed: 0.9, flammable: 0.3, water: false, ramp: ['#3a2a3f', '#4b3552', '#5e4268', '#74537e'] },
];

export const O = {
  NONE: 0, OAK: 1, PINE: 2, BIRCH: 3, PALM: 4, JUNGLE_TREE: 5, ACACIA: 6, DEAD_TREE: 7, CACTUS: 8,
  BUSH: 9, BERRIES: 10, FLOWER_RED: 11, FLOWER_YELLOW: 12, FLOWER_BLUE: 13, REED: 14, ROCK: 15, BOULDER: 16,
  ORE_IRON: 17, ORE_GOLD: 18, ORE_COPPER: 19, MUSHROOM: 20, STUMP: 21, SNOW_PINE: 22, GRASS_TUFT: 23, BONES: 24,
} as const;

export interface ObjectDef {
  name: string;
  /** Blocks walking (trees do not: people walk among them). */
  solid: boolean;
  tree: boolean;
  /** Wood yielded when felled (trees) or units yielded (ore/rock). */
  yield: number;
  flammable: number;
}

const obj = (name: string, solid: boolean, tree: boolean, yieldAmt: number, flammable: number): ObjectDef =>
  ({ name, solid, tree, yield: yieldAmt, flammable });

export const OBJECTS: ObjectDef[] = [
  obj('', false, false, 0, 0),
  obj('Carvalho', false, true, 4, 0.7), obj('Pinheiro', false, true, 4, 0.8), obj('Bétula', false, true, 3, 0.7),
  obj('Palmeira', false, true, 3, 0.5), obj('Árvore da selva', false, true, 5, 0.6), obj('Acácia', false, true, 3, 0.6),
  obj('Árvore seca', false, true, 2, 0.9), obj('Cacto', false, false, 0, 0.1),
  obj('Arbusto', false, false, 0, 0.8), obj('Frutinhas', false, false, 2, 0.8),
  obj('Flor', false, false, 0, 0.9), obj('Flor', false, false, 0, 0.9), obj('Flor', false, false, 0, 0.9),
  obj('Junco', false, false, 0, 0.6), obj('Pedra', false, false, 2, 0), obj('Rochedo', true, false, 4, 0),
  obj('Ferro', true, false, 6, 0), obj('Ouro', true, false, 4, 0), obj('Cobre', true, false, 5, 0),
  obj('Cogumelo', false, false, 1, 0.3), obj('Toco', false, false, 1, 0.4), obj('Pinheiro nevado', false, true, 4, 0.7),
  obj('Capim', false, false, 0, 0.9), obj('Ossos', false, false, 0, 0),
];

export const isTree = (o: number): boolean => OBJECTS[o].tree;
