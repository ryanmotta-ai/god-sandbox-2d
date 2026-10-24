import type { Game } from '../game';
import { World } from '../world/world';
import { Sim } from '../sim/sim';
import { Unit } from '../sim/unit';
import { Building } from '../sim/buildings';
import { City } from '../sim/city';
import { Kingdom } from '../sim/kingdom';
import { rng } from './rng';
import type { Species } from '../sim/species';
import type { Race } from '../gfx/humanoid';

/**
 * One versioned snapshot. The field lists below are the single source of truth for what survives a save:
 * add a field to a class and to its entry here, and a test (tests/save.test.ts) round-trips a live world to catch drift.
 * Transient state (paths, targets, fire, particles) is rebuilt, not stored.
 */
export const SAVE_VERSION = 1;
const KEY = 'aethoria-save-1';

const b64 = (a: ArrayBufferView): string => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = <T extends Uint8Array | Uint16Array>(s: string, Ctor: new (b: ArrayBuffer) => T): T => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Ctor(u.buffer); };

export interface Snapshot { version: number; seed: number; w: number; h: number; world: Record<string, string>; sim: Record<string, unknown>; units: unknown[]; buildings: unknown[]; cities: unknown[]; kingdoms: unknown[] }

export function snapshot(sim: Sim): Snapshot {
  const w = sim.world;
  return {
    version: SAVE_VERSION, seed: w.seed, w: w.w, h: w.h,
    world: { terrain: b64(w.terrain), height: b64(w.height), moist: b64(w.moist), temp: b64(w.temp), obj: b64(w.obj), objAge: b64(w.objAge), zone: b64(w.zone), bld: b64(w.bld) },
    sim: { time: sim.time, tickN: sim.tickN, nextId: sim.nextId, rng: sim.rng.state, grng: rng.state, weather: sim.weather, weatherT: sim.weatherT, stats: sim.stats, log: sim.log.slice(-40) },
    units: sim.units.filter(u => u.alive).map(u => [u.id, u.species, +u.x.toFixed(3), +u.y.toFixed(3), u.dir, u.hp, u.maxHp, u.age, u.female, u.name, u.hunger, u.cityId, u.kingdomId, u.role, u.variant, u.carry, u.traits, u.kills, u.mode === 'march' || u.mode === 'siege' || u.mode === 'settle' ? u.mode : 'wander', u.goalX, u.goalY, u.job, u.east]),
    buildings: [...sim.buildings.values()].map(b => [b.id, b.type, b.cityId, b.x, b.y, b.race, b.progress, b.hp, b.crop, b.burning]),
    cities: [...sim.cities.values()].map(c => [c.id, c.name, c.race, c.kingdomId, c.x, c.y, c.stock, c.loyalty, c.radius, c.hallId, c.buildings, c.founded, c.wallsPlanned, c.wallQueue]),
    kingdoms: [...sim.kingdoms.values()].map(k => [k.id, k.name, k.race, k.color, k.trait, k.founded, k.cities, k.king, k.capital, [...k.relations], [...k.wars], [...k.truce], [...k.warSince]]),
  };
}

export function restore(s: Snapshot): Sim {
  if (s.version !== SAVE_VERSION) throw new Error(`save version ${s.version} is not ${SAVE_VERSION}`);
  const world = new World(s.w, s.h, s.seed);
  world.terrain = unb64(s.world.terrain, Uint8Array); world.height = unb64(s.world.height, Uint8Array); world.moist = unb64(s.world.moist, Uint8Array);
  world.temp = unb64(s.world.temp, Uint8Array); world.obj = unb64(s.world.obj, Uint8Array); world.objAge = unb64(s.world.objAge, Uint8Array);
  world.zone = unb64(s.world.zone, Uint16Array); world.bld = unb64(s.world.bld, Uint16Array);
  world.chunkVer.fill(1);
  const sim = new Sim(world, s.seed);
  const m = s.sim as { time: number; tickN: number; nextId: number; rng: number; grng: number; weather: Sim['weather']; weatherT: number; stats: Sim['stats']; log: Sim['log'] };
  sim.time = m.time; sim.tickN = m.tickN; sim.nextId = m.nextId; sim.rng.state = m.rng; rng.state = m.grng; sim.weather = m.weather; sim.weatherT = m.weatherT; sim.stats = m.stats; sim.log = m.log;
  for (const r of s.kingdoms as any[]) {
    const k = new Kingdom(r[0], r[1], r[2] as Race, r[3], r[4], r[5]);
    k.cities = r[6]; k.king = r[7]; k.capital = r[8]; k.relations = new Map(r[9]); k.wars = new Set(r[10]); k.truce = new Map(r[11]); k.warSince = new Map(r[12]);
    sim.kingdoms.set(k.id, k);
  }
  for (const r of s.cities as any[]) {
    const c = new City(r[0], r[1], r[2] as Race, r[3], r[4], r[5]);
    c.stock = r[6]; c.loyalty = r[7]; c.radius = r[8]; c.hallId = r[9]; c.buildings = r[10]; c.founded = r[11]; c.zoneRadius = c.radius; c.wallsPlanned = r[12] ?? false; c.wallQueue = r[13] ?? [];
    sim.cities.set(c.id, c);
  }
  for (const r of s.buildings as any[]) {
    const b = new Building(r[0], r[1], r[2], r[3], r[4], r[5] as Race);
    b.progress = r[6]; b.hp = r[7]; b.crop = r[8]; b.burning = r[9];
    sim.buildings.set(b.id, b);
    if (b.type === 'gate') for (let j = 0; j < b.def.h; j++) for (let i = 0; i < b.def.w; i++) world.open[(b.y + j) * world.w + b.x + i] = 1;
  }
  for (const r of s.units as any[]) {
    const u = new Unit(r[0], r[1] as Species, r[2], r[3]);
    u.dir = r[4]; u.hp = r[5]; u.maxHp = r[6]; u.age = r[7]; u.female = r[8]; u.name = r[9]; u.hunger = r[10]; u.cityId = r[11]; u.kingdomId = r[12]; u.role = r[13]; u.variant = r[14];
    u.carry = r[15]; u.traits = r[16]; u.kills = r[17]; u.mode = r[18]; u.goalX = r[19]; u.goalY = r[20]; u.job = r[21]; u.east = r[22];
    sim.units.push(u); sim.byId.set(u.id, u);
    if (u.def.civ) sim.refreshLook(u);
  }
  for (const u of sim.units) if (u.job) { const b = sim.buildings.get(u.job); if (b) b.workers++; else u.job = 0; }
  return sim;
}

export function saveGame(g: Game): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(snapshot(g.sim))); return true; } catch { return false; }
}
export function hasSave(): boolean { try { return localStorage.getItem(KEY) !== null; } catch { return false; } }
export function loadGame(g: Game): boolean {
  try { const raw = localStorage.getItem(KEY); if (!raw) return false; g.useSim(restore(JSON.parse(raw))); return true; } catch (e) { console.error('load failed', e); return false; }
}
export function exportSave(g: Game): void {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(snapshot(g.sim))], { type: 'application/json' })); a.download = 'aethoria-mundo.json'; a.click(); URL.revokeObjectURL(a.href);
}
export async function importSave(g: Game, file: File): Promise<boolean> {
  try { g.useSim(restore(JSON.parse(await file.text()))); return true; } catch (e) { console.error('import failed', e); return false; }
}
