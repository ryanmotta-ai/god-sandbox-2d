import type { AnimalKind } from '../gfx/animals';
import type { Race } from '../gfx/humanoid';

export type ShipKind = 'canoe' | 'fishboat' | 'cog' | 'longship' | 'galley' | 'galleon';
export type Species = Race | AnimalKind | 'zombie' | 'ram' | 'catapult' | ShipKind;
export type Diet = 'herb' | 'carn' | 'omni' | 'none';

export interface SpeciesDef {
  id: Species;
  name: string;
  civ: boolean;
  hp: number; dmg: number; armor: number;
  /** Tiles per second on flat ground. */
  speed: number;
  /** Lifespan in world years (1 year = YEAR_SECONDS of real time at 1×). */
  maxAge: number;
  sight: number;
  diet: Diet;
  /** Runs from anything that can hurt it. */
  skittish?: boolean;
  /** Attacks what it considers prey/threat on sight. */
  aggressive?: boolean;
  herd?: boolean;
  fly?: boolean;
  /** Sails on water: pathing, drawing and AI live in navy.ts. */
  ship?: boolean;
  /** Seconds between litters when conditions allow; 0 = does not breed on its own. */
  breed: number;
  food: number;
  /** Largest sensible population per 1000 tiles of land. */
  cap: number;
}

export const YEAR_SECONDS = 12;

const S = (d: SpeciesDef): SpeciesDef => d;
export const SPECIES: Record<Species, SpeciesDef> = {
  human: S({ id: 'human', name: 'Humano', civ: true, hp: 100, dmg: 9, armor: 1, speed: 1.9, maxAge: 72, sight: 9, diet: 'omni', breed: 0, food: 0, cap: 0 }),
  elf: S({ id: 'elf', name: 'Elfo', civ: true, hp: 85, dmg: 8, armor: 0, speed: 2.2, maxAge: 220, sight: 12, diet: 'herb', breed: 0, food: 0, cap: 0 }),
  dwarf: S({ id: 'dwarf', name: 'Anão', civ: true, hp: 130, dmg: 11, armor: 3, speed: 1.5, maxAge: 140, sight: 8, diet: 'omni', breed: 0, food: 0, cap: 0 }),
  orc: S({ id: 'orc', name: 'Orc', civ: true, hp: 150, dmg: 13, armor: 1, speed: 1.9, maxAge: 48, sight: 9, diet: 'carn', breed: 0, food: 0, cap: 0 }),
  zombie: S({ id: 'zombie', name: 'Zumbi', civ: false, hp: 90, dmg: 10, armor: 0, speed: 1.1, maxAge: 9999, sight: 10, diet: 'none', aggressive: true, breed: 0, food: 0, cap: 0 }),
  ram: S({ id: 'ram', name: 'Aríete', civ: false, hp: 320, dmg: 0, armor: 7, speed: 0.95, maxAge: 9999, sight: 12, diet: 'none', breed: 0, food: 0, cap: 0 }),
  catapult: S({ id: 'catapult', name: 'Catapulta', civ: false, hp: 150, dmg: 0, armor: 3, speed: 0.75, maxAge: 9999, sight: 16, diet: 'none', breed: 0, food: 0, cap: 0 }),
  canoe: S({ id: 'canoe', name: 'Canoa', civ: false, hp: 45, dmg: 0, armor: 0, speed: 1.9, maxAge: 9999, sight: 10, diet: 'none', ship: true, breed: 0, food: 0, cap: 0 }),
  fishboat: S({ id: 'fishboat', name: 'Barco de pesca', civ: false, hp: 110, dmg: 0, armor: 1, speed: 1.7, maxAge: 9999, sight: 12, diet: 'none', ship: true, breed: 0, food: 0, cap: 0 }),
  cog: S({ id: 'cog', name: 'Mercante', civ: false, hp: 260, dmg: 0, armor: 2, speed: 1.45, maxAge: 9999, sight: 14, diet: 'none', ship: true, breed: 0, food: 0, cap: 0 }),
  longship: S({ id: 'longship', name: 'Barco de guerra', civ: false, hp: 220, dmg: 14, armor: 2, speed: 2.3, maxAge: 9999, sight: 14, diet: 'none', ship: true, breed: 0, food: 0, cap: 0 }),
  galley: S({ id: 'galley', name: 'Galé', civ: false, hp: 320, dmg: 26, armor: 4, speed: 2.0, maxAge: 9999, sight: 16, diet: 'none', ship: true, breed: 0, food: 0, cap: 0 }),
  galleon: S({ id: 'galleon', name: 'Galeão', civ: false, hp: 640, dmg: 34, armor: 8, speed: 1.25, maxAge: 9999, sight: 18, diet: 'none', ship: true, breed: 0, food: 0, cap: 0 }),
  sheep: S({ id: 'sheep', name: 'Ovelha', civ: false, hp: 30, dmg: 0, armor: 0, speed: 1.3, maxAge: 14, sight: 6, diet: 'herb', skittish: true, herd: true, breed: 40, food: 4, cap: 18 }),
  cow: S({ id: 'cow', name: 'Vaca', civ: false, hp: 55, dmg: 0, armor: 0, speed: 1.1, maxAge: 20, sight: 5, diet: 'herb', herd: true, breed: 55, food: 7, cap: 10 }),
  chicken: S({ id: 'chicken', name: 'Galinha', civ: false, hp: 10, dmg: 0, armor: 0, speed: 1.4, maxAge: 8, sight: 4, diet: 'herb', skittish: true, herd: true, breed: 30, food: 1, cap: 14 }),
  rabbit: S({ id: 'rabbit', name: 'Coelho', civ: false, hp: 8, dmg: 0, armor: 0, speed: 2.8, maxAge: 7, sight: 7, diet: 'herb', skittish: true, breed: 22, food: 1, cap: 30 }),
  deer: S({ id: 'deer', name: 'Cervo', civ: false, hp: 40, dmg: 0, armor: 0, speed: 3.0, maxAge: 18, sight: 10, diet: 'herb', skittish: true, herd: true, breed: 45, food: 5, cap: 14 }),
  boar: S({ id: 'boar', name: 'Javali', civ: false, hp: 70, dmg: 9, armor: 2, speed: 2.1, maxAge: 18, sight: 6, diet: 'omni', aggressive: true, breed: 60, food: 6, cap: 8 }),
  wolf: S({ id: 'wolf', name: 'Lobo', civ: false, hp: 55, dmg: 9, armor: 1, speed: 3.0, maxAge: 16, sight: 11, diet: 'carn', aggressive: true, herd: true, breed: 80, food: 3, cap: 5 }),
  bear: S({ id: 'bear', name: 'Urso', civ: false, hp: 160, dmg: 20, armor: 4, speed: 1.7, maxAge: 28, sight: 8, diet: 'omni', aggressive: true, breed: 140, food: 9, cap: 2 }),
  snake: S({ id: 'snake', name: 'Cobra', civ: false, hp: 14, dmg: 7, armor: 0, speed: 1.2, maxAge: 10, sight: 4, diet: 'carn', aggressive: true, breed: 90, food: 1, cap: 4 }),
  crab: S({ id: 'crab', name: 'Caranguejo', civ: false, hp: 12, dmg: 3, armor: 3, speed: 1.0, maxAge: 8, sight: 3, diet: 'none', breed: 45, food: 1, cap: 6 }),
  bird: S({ id: 'bird', name: 'Pássaro', civ: false, hp: 5, dmg: 0, armor: 0, speed: 3.4, maxAge: 9, sight: 8, diet: 'none', fly: true, skittish: true, breed: 50, food: 0, cap: 8 }),
  dragon: S({ id: 'dragon', name: 'Dragão', civ: false, hp: 900, dmg: 55, armor: 12, speed: 3.6, maxAge: 500, sight: 18, diet: 'carn', aggressive: true, fly: true, breed: 0, food: 0, cap: 0 }),
};

export const isAnimal = (s: Species): boolean => !SPECIES[s].civ && !SPECIES[s].ship && s !== 'zombie' && s !== 'ram' && s !== 'catapult';
export const isShip = (s: Species): boolean => SPECIES[s].ship === true;
export const isEngine = (s: Species): boolean => s === 'ram' || s === 'catapult';
export const RACES: Race[] = ['human', 'elf', 'dwarf', 'orc'];
