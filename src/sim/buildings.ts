import type { Race } from '../gfx/humanoid';

export type BType = 'campfire' | 'hut' | 'house' | 'farm' | 'storehouse' | 'lumber' | 'barracks' | 'tower' | 'temple' | 'hall' | 'well' | 'smith' | 'windmill' | 'wall' | 'gate' | 'dock' | 'shipyard' | 'fishhut' | 'lighthouse'
  | 'market' | 'tavern' | 'bakery' | 'stable' | 'healer' | 'fountain' | 'keep' | 'monument' | 'orchard' | 'townhouse';

export interface BDef {
  type: BType; name: string;
  w: number; h: number;
  cost: { wood: number; stone: number };
  hp: number;
  /** Residents it houses. */
  beds: number;
  /** Seconds of one builder's work to complete. */
  build: number;
  /** Workers it can employ. */
  slots: number;
  /** Footprint is flattened into farmland. */
  field?: boolean;
  /** Built on the shallows, walkable like a pier; ships berth beside it. */
  water?: boolean;
}

export const BDEFS: Record<BType, BDef> = {
  campfire: { type: 'campfire', name: 'Fogueira', w: 1, h: 1, cost: { wood: 0, stone: 0 }, hp: 40, beds: 0, build: 2, slots: 0 },
  hut: { type: 'hut', name: 'Cabana', w: 2, h: 2, cost: { wood: 6, stone: 0 }, hp: 120, beds: 3, build: 14, slots: 0 },
  house: { type: 'house', name: 'Casa', w: 3, h: 3, cost: { wood: 10, stone: 6 }, hp: 260, beds: 6, build: 26, slots: 0 },
  farm: { type: 'farm', name: 'Fazenda', w: 3, h: 3, cost: { wood: 4, stone: 0 }, hp: 60, beds: 0, build: 10, slots: 2, field: true },
  storehouse: { type: 'storehouse', name: 'Celeiro', w: 3, h: 2, cost: { wood: 12, stone: 2 }, hp: 220, beds: 0, build: 22, slots: 0 },
  lumber: { type: 'lumber', name: 'Serraria', w: 2, h: 2, cost: { wood: 8, stone: 0 }, hp: 140, beds: 0, build: 16, slots: 2 },
  barracks: { type: 'barracks', name: 'Quartel', w: 3, h: 3, cost: { wood: 16, stone: 14 }, hp: 420, beds: 0, build: 36, slots: 4 },
  tower: { type: 'tower', name: 'Torre', w: 2, h: 2, cost: { wood: 8, stone: 18 }, hp: 520, beds: 0, build: 34, slots: 1 },
  temple: { type: 'temple', name: 'Templo', w: 3, h: 3, cost: { wood: 14, stone: 24 }, hp: 380, beds: 0, build: 44, slots: 0 },
  hall: { type: 'hall', name: 'Salão', w: 4, h: 3, cost: { wood: 24, stone: 12 }, hp: 900, beds: 4, build: 60, slots: 0 },
  well: { type: 'well', name: 'Poço', w: 1, h: 1, cost: { wood: 2, stone: 6 }, hp: 90, beds: 0, build: 12, slots: 0 },
  smith: { type: 'smith', name: 'Ferraria', w: 2, h: 2, cost: { wood: 8, stone: 10 }, hp: 260, beds: 0, build: 28, slots: 1 },
  wall: { type: 'wall', name: 'Muralha', w: 1, h: 1, cost: { wood: 1, stone: 3 }, hp: 420, beds: 0, build: 5, slots: 0 },
  gate: { type: 'gate', name: 'Portão', w: 1, h: 1, cost: { wood: 4, stone: 4 }, hp: 300, beds: 0, build: 8, slots: 0 },
  dock: { type: 'dock', name: 'Cais', w: 3, h: 2, cost: { wood: 14, stone: 0 }, hp: 220, beds: 0, build: 18, slots: 0, water: true },
  shipyard: { type: 'shipyard', name: 'Estaleiro', w: 4, h: 3, cost: { wood: 28, stone: 6 }, hp: 340, beds: 0, build: 38, slots: 2, water: true },
  fishhut: { type: 'fishhut', name: 'Rancho de pesca', w: 3, h: 2, cost: { wood: 8, stone: 0 }, hp: 130, beds: 2, build: 14, slots: 2 },
  lighthouse: { type: 'lighthouse', name: 'Farol', w: 2, h: 2, cost: { wood: 6, stone: 22 }, hp: 480, beds: 0, build: 40, slots: 1 },
  market: { type: 'market', name: 'Mercado', w: 4, h: 3, cost: { wood: 18, stone: 4 }, hp: 200, beds: 0, build: 26, slots: 2 },
  tavern: { type: 'tavern', name: 'Taverna', w: 3, h: 3, cost: { wood: 16, stone: 8 }, hp: 280, beds: 2, build: 30, slots: 1 },
  bakery: { type: 'bakery', name: 'Padaria', w: 3, h: 2, cost: { wood: 10, stone: 10 }, hp: 220, beds: 0, build: 22, slots: 1 },
  stable: { type: 'stable', name: 'Estábulo', w: 4, h: 2, cost: { wood: 22, stone: 4 }, hp: 260, beds: 0, build: 28, slots: 1 },
  healer: { type: 'healer', name: 'Casa de cura', w: 3, h: 3, cost: { wood: 12, stone: 8 }, hp: 240, beds: 2, build: 28, slots: 1 },
  fountain: { type: 'fountain', name: 'Chafariz', w: 2, h: 2, cost: { wood: 0, stone: 20 }, hp: 200, beds: 0, build: 20, slots: 0 },
  keep: { type: 'keep', name: 'Fortaleza', w: 5, h: 4, cost: { wood: 30, stone: 70 }, hp: 1300, beds: 6, build: 80, slots: 3 },
  monument: { type: 'monument', name: 'Monumento', w: 2, h: 2, cost: { wood: 0, stone: 30 }, hp: 300, beds: 0, build: 30, slots: 0 },
  orchard: { type: 'orchard', name: 'Pomar', w: 4, h: 4, cost: { wood: 6, stone: 0 }, hp: 80, beds: 0, build: 16, slots: 2 },
  townhouse: { type: 'townhouse', name: 'Sobrado', w: 3, h: 3, cost: { wood: 16, stone: 14 }, hp: 340, beds: 9, build: 36, slots: 0 },
  windmill: { type: 'windmill', name: 'Moinho', w: 2, h: 2, cost: { wood: 14, stone: 6 }, hp: 240, beds: 0, build: 30, slots: 1 },
};

export class Building {
  /** 0..1; below 1 it is a construction site. */
  progress = 0;
  hp: number;
  maxHp: number;
  /** Farms: crop growth 0..1. */
  crop = 0;
  workers = 0;
  ruin = false;
  burning = 0;
  /** Materials already delivered to the site. */
  haveWood = 0; haveStone = 0;
  /** Flash on damage. */
  hurtT = 0;
  /** Tower reload; shipyards: seconds until the next hull. */
  cd = 0;
  /** Water buildings: land tile people use (a), and the water tile ships berth at (b). -1 = none. */
  ax = -1; ay = -1; bx = -1; by = -1;
  constructor(public id: number, public type: BType, public cityId: number, public x: number, public y: number, public race: Race) {
    const d = BDEFS[type];
    this.maxHp = this.hp = d.hp;
  }
  get def(): BDef { return BDEFS[this.type]; }
  get done(): boolean { return this.progress >= 1; }
  /** The tile in front of the door (south-centre, one tile below the footprint). */
  get doorX(): number { return this.ax >= 0 ? this.ax : this.x + Math.floor(this.def.w / 2); }
  get doorY(): number { return this.ax >= 0 ? this.ay : this.y + this.def.h; }
  get cx(): number { return this.x + this.def.w / 2; }
  get cy(): number { return this.y + this.def.h / 2; }
}
