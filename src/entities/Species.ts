export enum SpeciesType {
  /** The only civilised species. Everything else in this enum is wildlife. */
  HUMAN = 'human',
  DEER = 'deer',
  WOLF = 'wolf',
  BEAR = 'bear',
  DRAGON = 'dragon',
  BOAR = 'boar',
  EAGLE = 'eagle',
  MAMMOTH = 'mammoth'
}

export interface SpeciesConfig {
  id: SpeciesType;
  name: string;
  isHumanoid: boolean;
  baseHp: number;
  baseSpeed: number;
  baseDamage: number;
  baseDefense: number;
  maxAge: number;
  /** Years between conception and birth. Mother carries the child during this time. */
  gestationYears?: number;
  primaryColor: string;
  buildingStyle: string;
  urbanGridStyle?: 'concentric_rings' | 'organic_canopy' | 'orthogonal_citadel' | 'diagonal_chevron';
  urbanGridName?: string;
  preferredBiomes: string[];
  advantage?: string;
  disadvantage?: string;
}

export const SPECIES_DEFINITIONS: Record<SpeciesType, SpeciesConfig> = {
  [SpeciesType.HUMAN]: {
    id: SpeciesType.HUMAN,
    name: 'Humanos',
    isHumanoid: true,
    baseHp: 100,
    baseSpeed: 1.0,
    baseDamage: 10,
    baseDefense: 5,
    maxAge: 80,
    gestationYears: 1,
    primaryColor: '#d9a066',
    buildingStyle: 'Pedra e Madeira',
    urbanGridStyle: 'concentric_rings',
    urbanGridName: 'Traçado orgânico em anéis ao redor da praça',
    // Humans settle anywhere workable, which is what makes them spread.
    preferredBiomes: ['grass', 'soil', 'forest'],
    advantage: 'Adaptáveis: assentam em qualquer terreno fértil e aprendem rápido',
    disadvantage: 'Sem talento inato — tudo que conquistam vem de trabalho e tecnologia'
  },
  [SpeciesType.DEER]: {
    id: SpeciesType.DEER,
    name: 'Veado Selvagem',
    isHumanoid: false,
    baseHp: 40,
    baseSpeed: 1.4,
    baseDamage: 0,
    baseDefense: 0,
    maxAge: 20,
    gestationYears: 1,
    primaryColor: '#d97706',
    buildingStyle: 'nenhum',
    preferredBiomes: ['forest', 'grass']
  },
  [SpeciesType.WOLF]: {
    id: SpeciesType.WOLF,
    name: 'Lobo Selvagem',
    isHumanoid: false,
    baseHp: 65,
    baseSpeed: 1.3,
    baseDamage: 12,
    baseDefense: 2,
    maxAge: 18,
    gestationYears: 1,
    primaryColor: '#64748b',
    buildingStyle: 'nenhum',
    preferredBiomes: ['forest', 'tundra']
  },
  [SpeciesType.BEAR]: {
    id: SpeciesType.BEAR,
    name: 'Urso Selvagem',
    isHumanoid: false,
    baseHp: 150,
    baseSpeed: 0.8,
    baseDamage: 22,
    baseDefense: 8,
    maxAge: 30,
    gestationYears: 1,
    primaryColor: '#78350f',
    buildingStyle: 'nenhum',
    preferredBiomes: ['forest', 'mountain']
  },
  [SpeciesType.DRAGON]: {
    id: SpeciesType.DRAGON,
    name: 'Dragão Ancião (Boss)',
    isHumanoid: false,
    baseHp: 1200,
    baseSpeed: 1.2,
    baseDamage: 65,
    baseDefense: 25,
    maxAge: 500,
    gestationYears: 3,
    primaryColor: '#ef4444',
    buildingStyle: 'Ninho Volcânico',
    preferredBiomes: ['mountain', 'savanna', 'corrupted']
  },
  [SpeciesType.BOAR]: {
    id: SpeciesType.BOAR,
    name: 'Javali Selvagem',
    isHumanoid: false,
    baseHp: 75,
    baseSpeed: 1.2,
    baseDamage: 10,
    baseDefense: 3,
    maxAge: 22,
    gestationYears: 1,
    primaryColor: '#78350f',
    buildingStyle: 'nenhum',
    preferredBiomes: ['forest', 'savanna']
  },
  [SpeciesType.EAGLE]: {
    id: SpeciesType.EAGLE,
    name: 'Águia Imperial',
    isHumanoid: false,
    baseHp: 35,
    baseSpeed: 1.8,
    baseDamage: 8,
    baseDefense: 1,
    maxAge: 25,
    gestationYears: 1,
    primaryColor: '#fbbf24',
    buildingStyle: 'nenhum',
    preferredBiomes: ['mountain', 'grass']
  },
  [SpeciesType.MAMMOTH]: {
    id: SpeciesType.MAMMOTH,
    name: 'Mamute Ancião',
    isHumanoid: false,
    baseHp: 250,
    baseSpeed: 0.65,
    baseDamage: 28,
    baseDefense: 12,
    maxAge: 70,
    gestationYears: 2,
    primaryColor: '#451a03',
    buildingStyle: 'nenhum',
    preferredBiomes: ['tundra', 'snow']
  }
};
