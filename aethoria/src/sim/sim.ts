import type { World } from '../world/world';
import { TERRAIN, T } from '../world/defs';
import { Rng, rng } from '../core/rng';
import { TICK_DT } from '../core/config';
import { Unit } from './unit';
import { SPECIES, YEAR_SECONDS, type Species } from './species';
import { Building, type BType } from './buildings';
import { captureCity } from './kingdom';
import { makeLook, type Role } from '../gfx/looks';
import type { Race } from '../gfx/humanoid';
import { personName } from './names';
import type { City } from './city';
import type { Kingdom } from './kingdom';
import { updateUnits, updateArrows } from './ai';
import { updateCities } from './city';
import { updateKingdoms } from './kingdom';
import { updateDynamics } from './dynamics';

export interface FxEvent { t: 'blood' | 'hit' | 'spark' | 'smoke' | 'fire' | 'dust' | 'heal' | 'curse' | 'boom' | 'splash' | 'arrow' | 'flash' | 'coin' | 'rubble' | 'lightning' | 'meteor' | 'leaf' | 'zzz' | 'heart'; x: number; y: number; a?: number; b?: number; c?: string }
export interface LogEntry { t: number; text: string; kind: 'info' | 'war' | 'birth' | 'death' | 'disaster' | 'city' | 'peace' }
export interface Arrow { x: number; y: number; tx: number; ty: number; t: number; dur: number; dmg: number; from: number; kingdom: number; z: number }

const CELL = 8;

/** The whole living world: tiles, creatures, towns, realms. One instance; `tick` is the only thing that advances it. */
export class Sim {
  world: World;
  units: Unit[] = [];
  byId = new Map<number, Unit>();
  buildings = new Map<number, Building>();
  cities = new Map<number, City>();
  kingdoms = new Map<number, Kingdom>();
  arrows: Arrow[] = [];
  fx: FxEvent[] = [];
  log: LogEntry[] = [];
  time = 0;
  tickN = 0;
  nextId = 1;
  rng: Rng;
  /** Spatial hash: unit indices by 8×8-tile cell, rebuilt each tick. */
  grid: Unit[][];
  gw: number;
  paused = false;
  /** Which wars/zones changed, so overlays only rebuild when needed. */
  zoneVer = 1;
  stats = { births: 0, deaths: 0, kills: 0 };
  dayLength = 120;
  /** Population per species, refreshed once a second. */
  counts: Partial<Record<Species, number>> = {};
  landTiles = 0;
  weather: 'clear' | 'rain' | 'storm' | 'snow' | 'fog' = 'clear';
  weatherT = 40;

  constructor(world: World, seed: number) {
    this.world = world;
    this.rng = new Rng(seed ^ 0x5eed);
    this.gw = Math.ceil(world.w / CELL);
    this.grid = Array.from({ length: this.gw * Math.ceil(world.h / CELL) }, () => [] as Unit[]);
    rng.state = seed >>> 0;
    for (const t of world.terrain) if (!TERRAIN[t].water) this.landTiles++;
  }

  get year(): number { return this.time / YEAR_SECONDS; }
  /** 0..1 through the day; 0.25 = dawn, 0.5 = noon. */
  get dayPhase(): number { return (this.time / this.dayLength) % 1; }
  /** 0 spring, 1 summer, 2 autumn, 3 winter. Four seasons per world year pair for slower, readable change. */
  get season(): 0 | 1 | 2 | 3 { return (Math.floor(this.time / (YEAR_SECONDS * 3)) % 4) as 0 | 1 | 2 | 3; }

  note(text: string, kind: LogEntry['kind'] = 'info'): void {
    this.log.push({ t: this.time, text, kind });
    if (this.log.length > 200) this.log.splice(0, 50);
  }

  /* ---- spawning ------------------------------------------------------------------------------ */
  spawn(species: Species, x: number, y: number, opts: { age?: number; role?: Role; kingdom?: number; city?: number; female?: boolean } = {}): Unit {
    const u = new Unit(this.nextId++, species, x, y);
    const d = SPECIES[species];
    u.age = opts.age ?? (d.civ ? this.rng.range(18, 40) : this.rng.range(1, d.maxAge * 0.5));
    u.female = opts.female ?? this.rng.chance(0.5);
    u.variant = this.rng.int(0, 7);
    u.thinkT = this.rng.range(0, 1.5);
    u.born = this.time;
    u.kingdomId = opts.kingdom ?? 0; u.cityId = opts.city ?? 0;
    if (d.civ) {
      u.name = personName(this.rng, species as Race);
      u.role = opts.role ?? 'peasant';
      this.refreshLook(u);
    }
    this.units.push(u); this.byId.set(u.id, u);
    return u;
  }

  /** (Re)build a civilised unit's appearance from role/kingdom. */
  refreshLook(u: Unit): void {
    const k = this.kingdoms.get(u.kingdomId);
    const role: Role = u.age < 16 ? 'child' : u.role;
    u.look = makeLook(u.species as Race, role, u.id * 31 + u.variant, k?.color ?? '#c0392b', u.female);
  }

  addBuilding(type: BType, cityId: number, x: number, y: number, race: Race, done = false): Building {
    const b = new Building(this.nextId++, type, cityId, x, y, race);
    const w = this.world;
    for (let j = 0; j < b.def.h; j++) for (let i = 0; i < b.def.w; i++) {
      const idx = (y + j) * w.w + x + i;
      w.bld[idx] = b.id;
      w.obj[idx] = 0;
      if (b.def.field) w.setTerrain(x + i, y + j, T.FIELD);
    }
    w.touch(x, y, 3);
    if (done) { b.progress = 1; b.crop = type === 'farm' ? 0.2 : 0; }
    this.buildings.set(b.id, b);
    const c = this.cities.get(cityId);
    if (c) c.buildings.push(b.id);
    return b;
  }

  removeBuilding(b: Building, rubble = true): void {
    const w = this.world;
    for (let j = 0; j < b.def.h; j++) for (let i = 0; i < b.def.w; i++) {
      const idx = (b.y + j) * w.w + b.x + i;
      if (w.bld[idx] === b.id) w.bld[idx] = 0;
    }
    w.touch(b.x, b.y, 3);
    this.buildings.delete(b.id);
    const c = this.cities.get(b.cityId);
    if (c) c.buildings = c.buildings.filter(id => id !== b.id);
    for (const u of this.units) if (u.job === b.id) u.job = 0;
    if (rubble) this.fx.push({ t: 'rubble', x: b.cx, y: b.cy, a: b.def.w });
  }

  /** A building falls: rubble, ruin, and — if it was the heart of a town under attack — conquest. */
  destroyBuilding(b: Building, by: Unit | null): void {
    if (b.ruin) return;
    const city = this.cities.get(b.cityId);
    this.fx.push({ t: 'boom', x: b.cx, y: b.cy, a: b.def.w });
    this.removeBuilding(b, true);
    if (!city) return;
    const attacker = by ? this.kingdoms.get(by.kingdomId) : null;
    const heart = b.type === 'hall' || b.type === 'campfire';
    if (heart && b.type === 'hall') city.hallId = 0;
    if (heart && attacker && attacker.id !== city.kingdomId && this.kingdoms.get(city.kingdomId)?.wars.has(attacker.id)) {
      captureCity(this, city, attacker);
      this.addBuilding('campfire', city.id, city.x, city.y, city.race, true);
    } else if (!city.buildings.length && !this.units.some(u => u.cityId === city.id && u.alive)) {
      this.cities.delete(city.id); for (const k of this.kingdoms.values()) k.cities = k.cities.filter(id => id !== city.id);
      for (let i = 0; i < this.world.zone.length; i++) if (this.world.zone[i] === city.id) this.world.zone[i] = 0;
      this.zoneVer++; this.note(`${city.name} foi destruída.`, 'war');
    }
  }

  /* ---- queries ------------------------------------------------------------------------------- */
  private rebuildGrid(): void {
    for (const c of this.grid) c.length = 0;
    const gw = this.gw;
    for (const u of this.units) {
      if (u.state === 'dead') continue;
      const cx = Math.min(gw - 1, Math.max(0, (u.x / CELL) | 0)), cy = Math.max(0, (u.y / CELL) | 0);
      const cell = this.grid[cy * gw + cx];
      if (cell) cell.push(u);
    }
  }
  /** Calls `fn` for every living unit within `r` tiles of (x,y). Return true from fn to stop. */
  near(x: number, y: number, r: number, fn: (u: Unit, d2: number) => boolean | void): void {
    const gw = this.gw, gh = Math.ceil(this.world.h / CELL);
    const x0 = Math.max(0, ((x - r) / CELL) | 0), x1 = Math.min(gw - 1, ((x + r) / CELL) | 0), y0 = Math.max(0, ((y - r) / CELL) | 0), y1 = Math.min(gh - 1, ((y + r) / CELL) | 0);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (const u of this.grid[cy * gw + cx]) {
      const dx = u.x - x, dy = u.y - y, d2 = dx * dx + dy * dy;
      if (d2 <= r2 && fn(u, d2) === true) return;
    }
  }
  nearest(x: number, y: number, r: number, pred: (u: Unit) => boolean): Unit | null {
    let best: Unit | null = null, bd = Infinity;
    this.near(x, y, r, (u, d2) => { if (d2 < bd && pred(u)) { bd = d2; best = u; } });
    return best;
  }
  unitAt(x: number, y: number, r = 0.9): Unit | null { return this.nearest(x, y, r, () => true); }
  walkable(x: number, y: number): boolean { return this.world.isWalkable(Math.floor(x), Math.floor(y)); }

  /** Nearest walkable land tile to (x,y) within `r`, or null. */
  freeSpot(x: number, y: number, r = 6): { x: number; y: number } | null {
    const w = this.world, cx = Math.floor(x), cy = Math.floor(y);
    for (let d = 0; d <= r; d++) for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== d) continue;
      const tx = cx + i, ty = cy + j;
      if (w.isWalkable(tx, ty) && !TERRAIN[w.t(tx, ty)].water) return { x: tx + 0.5, y: ty + 0.5 };
    }
    return null;
  }

  /* ---- main step ----------------------------------------------------------------------------- */
  tick(): void {
    if (this.paused) return;
    this.time += TICK_DT; this.tickN++;
    this.rebuildGrid();
    updateUnits(this, TICK_DT);
    updateArrows(this, TICK_DT);
    updateCities(this, TICK_DT);
    updateKingdoms(this, TICK_DT);
    updateDynamics(this, TICK_DT);
  }

}
