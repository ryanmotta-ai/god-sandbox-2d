import type { Sim } from './sim';
import type { Unit, Carry } from './unit';
import { Building, BDEFS, type BType } from './buildings';
import { TERRAIN, T, OBJECTS, O } from '../world/defs';
import type { Race } from '../gfx/humanoid';
import { placeName } from './names';
import { Kingdom, newKingdom } from './kingdom';
import type { Role } from '../gfx/looks';
import { updateSocial } from './social';
import { portWants, findDockSite, yardStep, nearWater, requestSettlement } from './navy';

export class City {
  buildings: number[] = [];
  stock = { food: 0, wood: 0, stone: 0, ore: 0, gold: 0 };
  /** 0..100. Falls with hunger, distance from the crown and war; at 0 the town rebels. */
  loyalty = 70;
  radius = 7;
  hallId = 0;
  pop = 0;
  adults = 0;
  roles: Partial<Record<Role, number>> = {};
  t = 0; planT = 0; roleT = 0; birthT = 0; failedLots = 0; settleT = 0; zoneRadius = 0;
  founded = 0;
  empty = 0;
  /** Wall ring: planned once, then placed segment by segment as stone allows. [x, y, 1 = gate]. */
  wallsPlanned = false;
  wallQueue: [number, number, number][] = [];
  /** A site across the water a merchant ship will carry settlers to, and when it was asked for. */
  seaSite: { x: number; y: number; wx: number; wy: number; t: number } | null = null;
  portT = 0;
  /** Festival seconds left, and when the last one began. */
  festT = 0; festLast = -999;
  /** Derived each second from what stands in town: not saved. */
  perks = { bakery: false, healer: false, content: 0 };
  constructor(public id: number, public name: string, public race: Race, public kingdomId: number, public x: number, public y: number) {}

  hall(sim: Sim): Building | null {
    const h = sim.buildings.get(this.hallId);
    if (h && h.done && !h.ruin) return h;
    for (const id of this.buildings) { const b = sim.buildings.get(id); if (b && b.type === 'campfire' && !b.ruin) return b; }
    return null;
  }
  dropoff(sim: Sim): Building | null {
    let best: Building | null = null, bd = Infinity;
    for (const id of this.buildings) {
      const b = sim.buildings.get(id);
      if (!b || !b.done || b.ruin || (b.type !== 'storehouse' && b.type !== 'hall' && b.type !== 'campfire')) continue;
      const d = (b.cx - this.x) ** 2 + (b.cy - this.y) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  get cap(): number { return 80 + this.buildings.length * 12; }
  deposit(c: Carry): void {
    const s = this.stock;
    if (c.good === 'food') s.food = Math.min(this.cap * 2, s.food + c.n);
    else if (c.good === 'wood') s.wood = Math.min(this.cap * 2, s.wood + c.n);
    else if (c.good === 'stone') s.stone = Math.min(this.cap * 2, s.stone + c.n);
    else if (c.good === 'ore') s.ore += c.n;
    else s.gold += c.n;
  }
  count(sim: Sim, type: BType, doneOnly = false): number {
    let n = 0;
    for (const id of this.buildings) { const b = sim.buildings.get(id); if (b && b.type === type && !b.ruin && (!doneOnly || b.done)) n++; }
    return n;
  }
  onBuilt(sim: Sim, b: Building): void {
    if (b.type === 'hall') this.hallId = b.id;
    paintRoad(sim, this, b);
    sim.zoneVer++;
  }
}

/* ---- lots ----------------------------------------------------------------------------------- */
const LOT = 5;
const OK_BUILD = new Set<number>([T.GRASS, T.DIRT, T.SAVANNA, T.TUNDRA, T.SNOW, T.DESERT, T.SAND, T.ROAD, T.JUNGLE, T.HILL, T.ASH, T.ENCHANTED]);
const OK_FARM = new Set<number>([T.GRASS, T.DIRT, T.SAVANNA, T.JUNGLE, T.FIELD, T.ENCHANTED, T.TUNDRA, T.HILL]);
const LOTS: [number, number][] = [];
for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) if (i || j) LOTS.push([i, j]);
LOTS.sort((a, b) => Math.hypot(a[0], a[1] * 1.15) - Math.hypot(b[0], b[1] * 1.15));

export function footprintOk(sim: Sim, city: City, x: number, y: number, type: BType): boolean {
  const w = sim.world, d = BDEFS[type], ok = d.field ? OK_FARM : OK_BUILD;
  for (let j = -1; j <= d.h; j++) for (let i = 0; i < d.w; i++) {
    const tx = x + i, ty = y + j;
    if (!w.inb(tx, ty)) return false;
    const idx = ty * w.w + tx;
    const inside = j >= 0 && j < d.h;
    if (inside) {
      if (!ok.has(w.terrain[idx]) || w.bld[idx] !== 0 || OBJECTS[w.obj[idx]].solid || w.fire[idx]) return false;
      const z = w.zone[idx];
      if (z !== 0 && z !== city.id) return false;
    } else if (j === d.h) { // door tile must be walkable and not blocked
      if (!TERRAIN[w.terrain[idx]].walk || w.bld[idx] !== 0) return false;
    }
  }
  return true;
}

/** Find a lot for `type` around the town centre (inner ring first; farms prefer the outside). */
export function findLot(sim: Sim, city: City, type: BType, pred?: (x: number, y: number) => boolean): { x: number; y: number } | null {
  const d = BDEFS[type], ax = city.x - 2, ay = city.y - 2;
  const maxD = Math.max(2.9, city.radius / LOT + 0.6);
  const minRing = type === 'farm' || type === 'windmill' || type === 'orchard' ? 1.0 : type === 'tower' || type === 'lighthouse' ? 2.4 : 0;
  for (const [i, j] of LOTS) {
    const ring = Math.hypot(i, j);
    if (ring > maxD) break;
    if (ring < minRing) continue;
    const x = ax + i * LOT + Math.floor((LOT - d.w) / 2), y = ay + j * LOT + Math.floor((LOT - d.h) / 2) + (d.h <= 2 ? 0 : 0);
    if (footprintOk(sim, city, x, y, type) && (!pred || pred(x, y))) return { x, y };
  }
  return null;
}

function paintRoad(sim: Sim, city: City, b: Building): void {
  const w = sim.world, hx = city.x, hy = city.y + 1;
  let x = b.doorX, y = b.doorY;
  const put = (tx: number, ty: number): void => {
    if (!w.inb(tx, ty)) return;
    const i = ty * w.w + tx;
    if (w.bld[i] !== 0) return;
    const t = w.terrain[i];
    if (t === T.GRASS || t === T.DIRT || t === T.SAVANNA || t === T.SAND || t === T.JUNGLE || t === T.TUNDRA || t === T.ASH || t === T.DESERT) { w.setTerrain(tx, ty, T.ROAD); if (OBJECTS[w.obj[i]].tree || w.obj[i] === O.GRASS_TUFT || w.obj[i] === O.BUSH) w.obj[i] = 0; }
  };
  if (b.type === 'hall' || b.type === 'keep' || b.type === 'temple' || b.type === 'tavern' || b.type === 'healer') { // a paved forecourt
    for (let j = 0; j <= 1; j++) for (let i = -1; i <= b.def.w; i++) put(b.x + i, b.y + b.def.h + j);
    if (b.type === 'hall') for (let j = -1; j <= b.def.h; j++) { put(b.x - 1, b.y + j); put(b.x + b.def.w, b.y + j); }
  }
  put(x, y);
  let guard = 60;
  while ((x !== hx || y !== hy) && guard-- > 0) {
    if (Math.abs(x - hx) > 0 && (y === hy || (x - hx) % 5 !== 0 || Math.abs(y - hy) < 1)) x += Math.sign(hx - x); else y += Math.sign(hy - y);
    put(x, y);
  }
}

/* ---- founding ------------------------------------------------------------------------------- */
export function siteOk(sim: Sim, x: number, y: number, minGap: number, kingdomId = 0): boolean {
  const w = sim.world;
  if (!w.inb(x, y) || !OK_FARM.has(w.t(x, y))) return false;
  for (let j = -2; j <= 3; j++) for (let i = -2; i <= 2; i++) { const t = w.t(x + i, y + j); if (!OK_BUILD.has(t) || w.bld[(y + j) * w.w + x + i] !== 0 && w.inb(x + i, y + j)) return false; }
  for (const [, c] of sim.cities) {
    const gap = c.kingdomId === kingdomId ? minGap * 0.7 : minGap;
    if (Math.hypot(c.x - x, c.y - y) < gap) return false;
  }
  return true;
}

export function foundCity(sim: Sim, race: Race, x: number, y: number, founders: Unit[], kingdom?: Kingdom): City {
  const id = sim.nextId++;
  const name = placeName(sim.rng, race);
  let k = kingdom;
  if (!k) { k = newKingdom(sim, race); }
  const c = new City(id, name, race, k.id, x, y);
  c.founded = sim.time;
  c.stock.food = 10; c.stock.wood = 12;
  sim.cities.set(id, c);
  k.cities.push(id);
  if (!k.capital) k.capital = id;
  sim.addBuilding('campfire', id, x, y, race, true);
  paintZone(sim, c);
  let first = true;
  for (const u of founders) {
    u.cityId = id; u.kingdomId = k.id; u.mode = 'wander';
    if (first && !k.king) { u.role = 'king'; k.king = u.id; first = false; } else if (u.role === 'king') u.role = 'peasant';
    sim.refreshLook(u);
  }
  sim.zoneVer++;
  sim.note(`${k.name} fundou ${name}.`, 'city');
  return c;
}

export function tryFoundCity(sim: Sim, u: Unit, force = false): void {
  const x = Math.floor(u.x), y = Math.floor(u.y);
  const group: Unit[] = [];
  sim.near(u.x, u.y, 7, o => { if (o.def.civ && o.species === u.species && !o.cityId && o.age >= 16 && o.alive && (force || !o.kingdomId || o.kingdomId === u.kingdomId)) group.push(o); });
  if (group.length < (force ? 1 : 2)) return;
  if (!siteOk(sim, x, y, 16, u.kingdomId)) return;
  const prev = sim.kingdoms.get(u.kingdomId);
  foundCity(sim, u.species as Race, x, y, group.slice(0, 6), prev);
}

/* ---- zone (territory) ---------------------------------------------------------------------- */
export function paintZone(sim: Sim, c: City): void {
  const w = sim.world, r = c.radius, r2 = r * r;
  const x0 = Math.max(0, Math.floor(c.x - r - 1)), x1 = Math.min(w.w - 1, Math.ceil(c.x + r + 1)), y0 = Math.max(0, Math.floor(c.y - r - 1)), y1 = Math.min(w.h - 1, Math.ceil(c.y + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w.w + x, inside = (x - c.x) ** 2 + (y - c.y) ** 2 <= r2;
    if (inside && (w.zone[i] === 0)) w.zone[i] = c.id;
    else if (!inside && w.zone[i] === c.id) w.zone[i] = 0;
  }
  c.zoneRadius = r;
  sim.zoneVer++;
}

/* ---- per-second town logic ----------------------------------------------------------------- */
/** Towers shoot the realm's enemies — and zombies, and dragons — with real arrows. */
function towers(sim: Sim, dt: number): void {
  for (const b of sim.buildings.values()) {
    if ((b.type !== 'tower' && b.type !== 'keep') || !b.done || b.ruin) continue;
    b.cd -= dt; if (b.cd > 0) continue;
    const c = sim.cities.get(b.cityId), k = c && sim.kingdoms.get(c.kingdomId);
    if (!k) continue;
    const foe = sim.nearest(b.cx, b.cy, 11, o => o.alive && ((o.kingdomId !== 0 && k.wars.has(o.kingdomId)) || o.species === 'zombie' || o.species === 'dragon'));
    if (!foe) { b.cd = 0.5; continue; }
    b.cd = b.type === 'keep' ? 1.1 : 1.5;
    const dist = Math.hypot(foe.x - b.cx, foe.y - b.cy);
    for (let n = 0; n < (b.type === 'keep' ? 2 : 1); n++) sim.arrows.push({ x: b.cx + n * 1.5 - 0.7, y: b.y - 0.9, tx: foe.x, ty: foe.y, t: 0, dur: Math.max(0.3, dist / 13), dmg: b.type === 'keep' ? 17 : 14, from: 0, kingdom: k.id, z: 0 });
    sim.fx.push({ t: 'arrow', x: b.cx, y: b.y - 0.9 });
  }
}

export function updateCities(sim: Sim, dt: number): void {
  towers(sim, dt);
  if (sim.tickN % 20 === 0) countPeople(sim);
  for (const [, c] of sim.cities) {
    c.t += dt; c.planT += dt; c.roleT += dt; c.birthT += dt; c.settleT += dt;
    if (c.t < 1) continue;
    c.t -= 1;
    cityStep(sim, c);
  }
}

function countPeople(sim: Sim): void {
  for (const [, c] of sim.cities) { c.pop = 0; c.adults = 0; c.roles = {}; }
  for (const k of Object.keys(sim.counts)) delete sim.counts[k as keyof typeof sim.counts];
  for (const u of sim.units) {
    if (!u.alive) continue;
    sim.counts[u.species] = (sim.counts[u.species] ?? 0) + 1;
    const c = sim.cities.get(u.cityId);
    if (!c || !u.def.civ) continue;
    c.pop++;
    if (u.age >= 16) { c.adults++; c.roles[u.role] = (c.roles[u.role] ?? 0) + 1; }
  }
}

function cityStep(sim: Sim, c: City): void {
  const k = sim.kingdoms.get(c.kingdomId);
  // a town nobody lives in is abandoned: its buildings fall, its land is free again
  c.empty = c.pop === 0 && sim.time - c.founded > 30 ? c.empty + 1 : 0;
  if (c.empty > 60) { for (const id of [...c.buildings]) { const b = sim.buildings.get(id); if (b) sim.removeBuilding(b, true); } sim.cities.delete(c.id); for (const kk of sim.kingdoms.values()) kk.cities = kk.cities.filter(id => id !== c.id); for (let i = 0; i < sim.world.zone.length; i++) if (sim.world.zone[i] === c.id) sim.world.zone[i] = 0; sim.zoneVer++; sim.note(`${c.name} foi abandonada.`, 'city'); return; }
  // tier & territory
  const targetR = Math.min(26, 6 + 2.3 * Math.sqrt(c.pop));
  if (Math.abs(targetR - c.radius) > 0.25) { c.radius += Math.sign(targetR - c.radius) * 0.25; if (Math.floor(c.radius * 2) !== Math.floor(c.zoneRadius * 2)) paintZone(sim, c); }
  // farms ripen even untended; windmills speed it up
  const mills = c.count(sim, 'windmill', true);
  for (const id of c.buildings) {
    const b = sim.buildings.get(id);
    if (!b || !b.done || b.ruin) continue;
    if (b.type === 'farm') b.crop = Math.min(1, b.crop + 0.012 + mills * 0.004);
    if (b.type === 'orchard') b.crop = Math.min(1, b.crop + 0.008);
    if (b.burning > 0) { b.burning--; b.hp -= 20; if (b.hp <= 0) sim.destroyBuilding(b, null); }
  }
  updateSocial(sim, c);
  c.perks = perksOf(sim, c);
  if (c.perks.healer) healPeople(sim, c);
  if (c.roleT >= 4) { c.roleT = 0; balanceRoles(sim, c); }
  if (c.planT >= 3) { c.planT = 0; planBuilding(sim, c); }
  yardStep(sim, c);
  // births: housing and food permitting
  const housing = homes(sim, c);
  if (c.birthT >= Math.max(3.5, 14 / (1 + c.adults / 7)) && c.adults >= 2 && c.pop < housing && c.stock.food >= Math.min(12, c.pop * 2 + 2)) {
    c.birthT = 0;
    const mothers = sim.units.filter(u => u.cityId === c.id && u.female && u.age >= 18 && u.age < 45 && u.alive && !u.inShip);
    const m = mothers.length ? sim.rng.pick(mothers) : null;
    const h = c.hall(sim);
    const spot = sim.freeSpot(m ? m.x : (h ? h.doorX : c.x), m ? m.y : (h ? h.doorY : c.y), 3);
    if (spot) {
      const kid = sim.spawn(c.race, spot.x, spot.y, { age: 0, city: c.id, kingdom: c.kingdomId, role: 'peasant' });
      kid.hunger = 20; sim.stats.births++;
      sim.fx.push({ t: 'heart', x: spot.x, y: spot.y - 0.6 });
    }
  }
  // loyalty: fed and near the crown is content
  if (k) {
    const cap = sim.cities.get(k.capital);
    const far = cap && cap !== c ? Math.hypot(cap.x - c.x, cap.y - c.y) : 0;
    const target = 78 + (c.stock.food > c.pop * 2 ? 8 : -22) - Math.max(0, far - 24) * 0.6 - (k.wars.size ? 10 : 0) - (c.pop > 40 ? 6 : 0) + (k.trait === 'tyrant' ? -10 : k.trait === 'diplomat' ? 6 : 0) + c.perks.content;
    c.loyalty += (target - c.loyalty) * 0.04;
    if (c.loyalty < 14 && c.id !== k.capital && c.pop >= 6) rebel(sim, c, k);
  }
  // expansion: crowded, big towns send settlers
  if (c.settleT > 25 && c.adults >= 14 && c.failedLots >= 2 && k) { c.settleT = 0; sendSettlers(sim, c, k); }
}

/** What the finished civic buildings do for a town: bread feeds better, healers mend, plazas and taverns calm people. */
function perksOf(sim: Sim, c: City): City['perks'] {
  let bakery = false, healer = false, content = 0;
  for (const id of c.buildings) {
    const b = sim.buildings.get(id);
    if (!b || !b.done || b.ruin) continue;
    if (b.type === 'bakery') bakery = true; else if (b.type === 'healer') healer = true;
    else if (b.type === 'fountain') content += 3; else if (b.type === 'monument') content += 4; else if (b.type === 'tavern') content += 3; else if (b.type === 'market') content += 2;
  }
  return { bakery, healer, content: Math.min(8, content) };
}
function healPeople(sim: Sim, c: City): void {
  for (const id of c.buildings) {
    const b = sim.buildings.get(id);
    if (!b || b.type !== 'healer' || !b.done || b.ruin) continue;
    sim.near(b.doorX + 0.5, b.doorY + 0.5, 7, u => { if (u.def.civ && u.cityId === c.id && (u.hp < u.maxHp || u.traits.includes('plague'))) { u.hp = Math.min(u.maxHp, u.hp + 6); if (u.traits.includes('plague') && sim.rng.chance(0.3)) u.traits = u.traits.filter(t => t !== 'plague'); if (sim.rng.chance(0.25)) sim.fx.push({ t: 'heal', x: u.x, y: u.y - 0.5 }); } });
  }
}

function homes(sim: Sim, c: City): number {
  let n = 0;
  for (const id of c.buildings) { const b = sim.buildings.get(id); if (b && b.done && !b.ruin) n += b.def.beds; }
  return n + 3;
}

function balanceRoles(sim: Sim, c: City): void {
  const adults = sim.units.filter(u => u.def.civ && u.cityId === c.id && u.age >= 16 && u.alive && !u.inShip && u.role !== 'king' && u.mode !== 'march' && u.mode !== 'siege' && u.mode !== 'settle' && u.mode !== 'board');
  if (!adults.length) return;
  const n = adults.length;
  const farms = c.count(sim, 'farm', true) + c.count(sim, 'orchard', true);
  const sites = c.buildings.reduce((a, id) => { const b = sim.buildings.get(id); return a + (b && !b.done && !b.ruin ? 1 : 0); }, 0);
  const damaged = c.buildings.some(id => { const b = sim.buildings.get(id); return b && b.done && b.hp < b.maxHp * 0.6; });
  const war = sim.kingdoms.get(c.kingdomId)?.wars.size ?? 0;
  const barracks = c.count(sim, 'barracks', true);
  const soldiers = n < 5 ? 0 : Math.max(2, Math.round(n * (barracks ? (war ? 0.4 : 0.28) : 0.18)));
  const want: Partial<Record<Role, number>> = {
    farmer: Math.min(Math.ceil(n * 0.4), farms * 2),
    woodcutter: Math.max(1, Math.round(n * (c.stock.wood < 30 ? 0.3 : 0.14))),
    builder: sites > 0 ? Math.min(5, 1 + sites) : damaged ? 1 : 0,
    miner: c.stock.stone < 60 ? Math.max(0, Math.round(n * 0.16)) : 0,
    soldier: Math.max(1, Math.round(soldiers * 0.6)), archer: Math.round(soldiers * 0.3), knight: c.count(sim, 'smith', true) && c.stock.ore >= 10 ? Math.round(soldiers * 0.2) : 0,
  };
  const have: Partial<Record<Role, number>> = {};
  for (const u of adults) have[u.role] = (have[u.role] ?? 0) + 1;
  const order: Role[] = ['farmer', 'builder', 'woodcutter', 'soldier', 'archer', 'miner', 'knight'];
  const idle = adults.filter(u => u.role === 'peasant');
  for (const r of order) {
    let need = (want[r] ?? 0) - (have[r] ?? 0);
    while (need > 0) {
      let u = idle.pop();
      if (!u) { // steal from the most over-staffed civilian role
        const over = adults.find(a => (a.role === 'woodcutter' || a.role === 'miner' || a.role === 'farmer') && a.role !== r && (have[a.role] ?? 0) > (want[a.role] ?? 0) + 1);
        if (!over) break;
        have[over.role] = (have[over.role] ?? 1) - 1; u = over;
      }
      u.role = r; u.thinkT = 0; u.mode = 'wander'; u.path = null; releaseJobOf(sim, u); sim.refreshLook(u); need--; have[r] = (have[r] ?? 0) + 1;
    }
    // trim
    let extra = (have[r] ?? 0) - (want[r] ?? 0) - 1;
    for (const u of adults) { if (extra <= 0) break; if (u.role === r && r !== 'farmer') { u.role = 'peasant'; releaseJobOf(sim, u); sim.refreshLook(u); extra--; } }
  }
}
function releaseJobOf(sim: Sim, u: Unit): void { if (u.job) { const b = sim.buildings.get(u.job); if (b && b.workers > 0) b.workers--; u.job = 0; } }

/** Where the ring goes: a rectangle around every building that is not a field, with a gate in the middle of each side. */
function planWalls(sim: Sim, c: City): void {
  const k = sim.kingdoms.get(c.kingdomId);
  if (c.wallsPlanned || c.pop < 22 || !(c.count(sim, 'barracks', true) || (k && k.wars.size)) || c.stock.stone < 45 || c.stock.wood < 20) return;
  let x0 = c.x, x1 = c.x, y0 = c.y, y1 = c.y, n = 0;
  for (const id of c.buildings) {
    const b = sim.buildings.get(id);
    if (!b || b.ruin || b.type === 'farm' || b.type === 'windmill' || b.type === 'wall' || b.type === 'gate' || b.type === 'lumber') continue;
    x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.def.w - 1); y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y + b.def.h); n++;
  }
  if (n < 5) return;
  const M = 3, w = sim.world;
  x0 = Math.max(1, x0 - M); y0 = Math.max(1, y0 - M); x1 = Math.min(w.w - 2, x1 + M); y1 = Math.min(w.h - 2, y1 + M);
  const mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1, ring: [number, number, number][] = [];
  const add = (x: number, y: number): void => { ring.push([x, y, (x === mx && (y === y0 || y === y1)) || (y === my && (x === x0 || x === x1)) ? 1 : 0]); };
  for (let x = x0; x <= x1; x++) { add(x, y0); add(x, y1); }
  for (let y = y0 + 1; y < y1; y++) { add(x0, y); add(x1, y); }
  // gates first, then walls from the gates outward, so the town is never sealed while it is half built
  ring.sort((a, b) => b[2] - a[2] || Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
  c.wallQueue = ring; c.wallsPlanned = true;
  sim.note(`${c.name} começa a erguer muralhas.`, 'city');
}

function wallTileOk(sim: Sim, c: City, x: number, y: number): boolean {
  const w = sim.world;
  if (!w.inb(x, y)) return false;
  const i = y * w.w + x;
  return OK_BUILD.has(w.terrain[i]) && w.bld[i] === 0 && !OBJECTS[w.obj[i]].solid && (w.zone[i] === 0 || w.zone[i] === c.id);
}

function placeWalls(sim: Sim, c: City): void {
  if (!c.wallQueue.length) return;
  let sites = 0;
  for (const id of c.buildings) { const b = sim.buildings.get(id); if (b && (b.type === 'wall' || b.type === 'gate') && !b.done) sites++; }
  for (let placed = 0; placed < 3 && sites < 6 && c.wallQueue.length; ) {
    const [x, y, gate] = c.wallQueue[0];
    if (!wallTileOk(sim, c, x, y)) { c.wallQueue.shift(); continue; }
    const type: BType = gate ? 'gate' : 'wall', d = BDEFS[type];
    if (c.stock.wood < d.cost.wood || c.stock.stone < d.cost.stone) return;
    c.wallQueue.shift(); c.stock.wood -= d.cost.wood; c.stock.stone -= d.cost.stone;
    if (gate) { const w = sim.world, i = y * w.w + x; if (w.terrain[i] !== T.ROAD) w.setTerrain(x, y, T.ROAD); }
    sim.addBuilding(type, c.id, x, y, c.race, false);
    placed++; sites++;
  }
}

function planBuilding(sim: Sim, c: City): void {
  planWalls(sim, c);
  placeWalls(sim, c);
  const sites = c.buildings.reduce((a, id) => { const b = sim.buildings.get(id); return a + (b && !b.done && !b.ruin && b.type !== 'wall' && b.type !== 'gate' ? 1 : 0); }, 0);
  if (sites >= 1 + Math.floor(c.pop / 12)) return;
  const housing = homes(sim, c), adults = c.adults;
  const has = (t: BType): number => c.count(sim, t);
  const want: BType[] = [];
  const home = (): BType => (c.stock.stone >= 14 && c.pop >= 26 && sim.rng.chance(0.45) ? 'townhouse' : c.stock.stone >= 6 && c.pop >= 8 ? 'house' : 'hut');
  const homesWanted: BType[] = [];
  if (housing < c.pop + 2) homesWanted.push(home());
  if (has('farm') < Math.ceil(adults / 5)) want.push('farm');
  if (!has('storehouse') && c.pop >= 5) want.push('storehouse');
  want.push(...portWants(sim, c));
  if (!has('lumber') && c.pop >= 7) want.push('lumber');
  if (!c.hallId && c.pop >= 8 && !has('hall')) want.push('hall');
  if (!has('well') && c.pop >= 12) want.push('well');
  if (!has('barracks') && c.pop >= 10 && c.hallId) want.push('barracks');
  if (!has('smith') && c.pop >= 16 && has('barracks')) want.push('smith');
  if (has('farm') >= 3 && !has('windmill')) want.push('windmill');
  if (!has('temple') && c.pop >= 20) want.push('temple');
  if (has('tower') < Math.floor(c.pop / 16)) want.push('tower');
  if (c.pop >= 14 && housing < c.pop + 6) homesWanted.push(home());
  if (c.pop >= 14 && has('house') + has('townhouse') >= 2 && has('tavern') < 1 + Math.floor(c.pop / 40)) want.push('tavern');
  if (c.pop >= 16 && has('market') < 1 + Math.floor(c.pop / 60)) want.push('market');
  if (c.pop >= 18 && has('windmill') && !has('bakery')) want.push('bakery');
  if (c.pop >= 20 && !has('fountain') && c.hallId) want.push('fountain');
  if (c.pop >= 22 && has('farm') >= 3 && has('orchard') < Math.min(2, Math.floor(c.pop / 30))) want.push('orchard');
  if (c.pop >= 24 && has('healer') < Math.floor(c.pop / 50) + (c.pop >= 24 ? 1 : 0)) want.push('healer');
  if (c.pop >= 26 && has('barracks') && !has('stable')) want.push('stable');
  if (c.pop >= 38 && !has('monument')) want.push('monument');
  if (c.pop >= 60 && has('barracks') && !has('keep')) want.push('keep');
  // houses first only when the shortage is bad (and then half the time), so halls and barracks are not starved by a growing town
  const deficit = c.pop + 2 - housing, saving = !c.hallId && !has('hall') && c.pop >= 8;
  // no hall yet: save up for it (huts would eat every plank), unless people are sleeping outdoors
  const order = saving ? ['hall' as BType, ...want.filter(t => t === 'farm' || t === 'storehouse' || t === 'lumber'), ...(deficit > 10 ? homesWanted : [])]
    : deficit > 8 && sim.rng.chance(0.5) ? [...homesWanted, ...want] : [...want, ...homesWanted];
  for (const type of order) {
    // a hall with no stone to be had: after a while, log it instead
    const d = type === 'hall' && c.stock.stone < BDEFS.hall.cost.stone && sim.time - c.founded > 90 ? { ...BDEFS.hall, cost: { wood: 44, stone: 0 } } : BDEFS[type];
    if (c.stock.wood < d.cost.wood || c.stock.stone < d.cost.stone) continue;
    let spot: { x: number; y: number } | null;
    if (type === 'dock' || type === 'shipyard') { spot = sim.time >= c.portT ? findDockSite(sim, c, type) : null; if (!spot) { c.portT = Math.max(c.portT, sim.time + 40); continue; } }
    else if (type === 'fishhut' || type === 'lighthouse') { const r = type === 'fishhut' ? 5 : 3; spot = findLot(sim, c, type, (x, y) => nearWater(sim, x + (BDEFS[type].w >> 1), y + BDEFS[type].h, r)); if (!spot) { c.portT = Math.max(c.portT, sim.time + 40); continue; } }
    else { spot = findLot(sim, c, type); if (!spot) { c.failedLots++; continue; } }
    if (type === 'hall') { // the hall replaces the campfire at the centre
      const camp = c.buildings.map(id => sim.buildings.get(id)).find(b => b && b.type === 'campfire');
      if (camp) sim.removeBuilding(camp, false);
      spot = { x: c.x - 1, y: c.y - 1 };
      if (!footprintOk(sim, c, spot.x, spot.y, 'hall')) { spot = findLot(sim, c, 'hall'); if (!spot) { sim.addBuilding('campfire', c.id, c.x, c.y, c.race, true); continue; } }
    }
    c.failedLots = 0;
    c.stock.wood -= d.cost.wood; c.stock.stone -= d.cost.stone;
    const b = sim.addBuilding(type, c.id, spot.x, spot.y, c.race, false);
    if (type === 'hall') c.hallId = 0;
    void b;
    return;
  }
}

/* ---- politics of a town --------------------------------------------------------------------- */
function rebel(sim: Sim, c: City, parent: Kingdom): void {
  const k = newKingdom(sim, c.race);
  parent.cities = parent.cities.filter(id => id !== c.id);
  c.kingdomId = k.id; k.cities.push(c.id); k.capital = c.id; c.loyalty = 65;
  for (const u of sim.units) if (u.cityId === c.id) { u.kingdomId = k.id; if (u.role === 'king') u.role = 'peasant'; }
  const lead = sim.units.filter(u => u.cityId === c.id && u.age >= 18 && u.alive).sort((a, b) => b.age - a.age)[0];
  if (lead) { lead.role = 'king'; k.king = lead.id; }
  for (const u of sim.units) if (u.cityId === c.id) sim.refreshLook(u);
  k.wars.add(parent.id); parent.wars.add(k.id); k.relations.set(parent.id, -80); parent.relations.set(k.id, -80);
  sim.zoneVer++;
  sim.note(`${c.name} se rebelou contra ${parent.name} e fundou ${k.name}!`, 'war');
}

function sendSettlers(sim: Sim, c: City, k: Kingdom): void {
  const h = c.hall(sim);
  if (!h) return;
  for (let tries = 0; tries < 40; tries++) {
    const a = sim.rng.range(0, 6.283), d = sim.rng.range(c.radius + 8, c.radius + 20);
    const x = Math.floor(c.x + Math.cos(a) * d), y = Math.floor(c.y + Math.sin(a) * d);
    if (!siteOk(sim, x, y, 15, k.id)) continue;
    const crew = sim.units.filter(u => u.cityId === c.id && u.age >= 18 && u.alive && (u.role === 'peasant' || u.role === 'woodcutter') && !u.carry).slice(0, 4);
    if (crew.length < 2) return;
    for (const u of crew) { u.cityId = 0; u.mode = 'settle'; u.goalX = x + 0.5 + sim.rng.range(-1, 1); u.goalY = y + 0.5 + sim.rng.range(0, 2); u.path = null; u.role = 'peasant'; }
    sim.note(`${c.name} enviou colonos para fundar uma nova vila.`, 'city');
    return;
  }
  requestSettlement(sim, c); // no room by land: a merchant ship will carry them across the water
}
