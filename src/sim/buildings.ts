import type { Race } from '../gfx/humanoid';

export type BType = 'campfire' | 'hut' | 'house' | 'farm' | 'storehouse' | 'lumber' | 'barracks' | 'tower' | 'temple' | 'hall' | 'well' | 'smith' | 'windmill' | 'wall' | 'gate';

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
  hall: { type: 'hall', name: 'Salão', w: 4, h: 3, cost: { wood: 24, stone: 24 }, hp: 900, beds: 4, build: 60, slots: 0 },
  well: { type: 'well', name: 'Poço', w: 1, h: 1, cost: { wood: 2, stone: 6 }, hp: 90, beds: 0, build: 12, slots: 0 },
  smith: { type: 'smith', name: 'Ferraria', w: 2, h: 2, cost: { wood: 8, stone: 10 }, hp: 260, beds: 0, build: 28, slots: 1 },
  wall: { type: 'wall', name: 'Muralha', w: 1, h: 1, cost: { wood: 1, stone: 3 }, hp: 420, beds: 0, build: 5, slots: 0 },
  gate: { type: 'gate', name: 'Portão', w: 1, h: 1, cost: { wood: 4, stone: 4 }, hp: 300, beds: 0, build: 8, slots: 0 },
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
  /** Tower reload. */
  cd = 0;
  constructor(public id: number, public type: BType, public cityId: number, public x: number, public y: number, public race: Race) {
    const d = BDEFS[type];
    this.maxHp = this.hp = d.hp;
  }
  get def(): BDef { return BDEFS[this.type]; }
  get done(): boolean { return this.progress >= 1; }
  /** The tile in front of the door (south-centre, one tile below the footprint). */
  get doorX(): number { return this.x + Math.floor(this.def.w / 2); }
  get doorY(): number { return this.y + this.def.h; }
  get cx(): number { return this.x + this.def.w / 2; }
  get cy(): number { return this.y + this.def.h / 2; }
}
