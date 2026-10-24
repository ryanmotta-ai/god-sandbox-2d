import type { Sim } from './sim';
import type { Unit } from './unit';
import type { Building, BType } from './buildings';
import type { City } from './city';
import { BDEFS } from './buildings';
import { SPECIES, type ShipKind } from './species';
import { TERRAIN, T } from '../world/defs';
import { findPath } from './path';
import { setAct, face, moveTo, type Move } from './ai';
import { siteOk } from './city';
import { hash2 } from '../core/rng';
import { thinkWarship, actWarship, WAR_KINDS } from './fleet';
import type { Race } from '../gfx/humanoid';

/**
 * Ships are units that sail on water: they live at a dock, work a mission (fish, trade, settle, patrol, invade) and bring the
 * goods and people physically. The sea is a second pathing grid (`findPath(..., sea)`); crew and passengers ride hidden aboard.
 */

/* ---- land and sea maps ----------------------------------------------------------------------- */
interface Geo { t: number; land: Uint16Array; sea: Uint16Array; seaSize: Uint32Array }
const GEO = new WeakMap<Sim, Geo>();

function label(out: Uint16Array, ok: Uint8Array, w: number, h: number): Uint32Array {
  const n = w * h, q = new Int32Array(n), sizes: number[] = [0];
  let id = 0;
  for (let s = 0; s < n; s++) {
    if (out[s] || !ok[s]) continue;
    id++; let head = 0, tail = 0, count = 0; q[tail++] = s; out[s] = id;
    while (head < tail) {
      const i = q[head++], x = i % w; count++;
      if (x > 0 && !out[i - 1] && ok[i - 1]) { out[i - 1] = id; q[tail++] = i - 1; }
      if (x < w - 1 && !out[i + 1] && ok[i + 1]) { out[i + 1] = id; q[tail++] = i + 1; }
      if (i >= w && !out[i - w] && ok[i - w]) { out[i - w] = id; q[tail++] = i - w; }
      if (i < n - w && !out[i + w] && ok[i + w]) { out[i + w] = id; q[tail++] = i + w; }
    }
    sizes.push(count);
  }
  return Uint32Array.from(sizes);
}

/** Connected land (walkable terrain, wading included) and connected water, relabelled every half minute. */
export function geo(sim: Sim): Geo {
  let g = GEO.get(sim);
  if (g && sim.time - g.t < 30) return g;
  const w = sim.world, n = w.w * w.h;
  const walk = new Uint8Array(n), wet = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const d = TERRAIN[w.terrain[i]]; walk[i] = d.walk ? 1 : 0; wet[i] = d.water ? 1 : 0; }
  const land = g?.land ?? new Uint16Array(n), sea = g?.sea ?? new Uint16Array(n);
  land.fill(0); sea.fill(0);
  label(land, walk, w.w, w.h);
  const seaSize = label(sea, wet, w.w, w.h);
  g = { t: sim.time, land, sea, seaSize }; GEO.set(sim, g);
  return g;
}
export const landId = (sim: Sim, x: number, y: number): number => geo(sim).land[Math.floor(y) * sim.world.w + Math.floor(x)];
export const seaId = (sim: Sim, x: number, y: number): number => geo(sim).sea[Math.floor(y) * sim.world.w + Math.floor(x)];
const BIG_SEA = 300;

/* ---- water buildings --------------------------------------------------------------------------- */
export const isWaterType = (t: BType): boolean => BDEFS[t].water === true;
const isLand = (sim: Sim, x: number, y: number): boolean => { const w = sim.world; return w.inb(x, y) && !TERRAIN[w.terrain[y * w.w + x]].water && TERRAIN[w.terrain[y * w.w + x]].walk; };

/** The ring of tiles around a footprint (sides only). */
function ring(x: number, y: number, bw: number, bh: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < bw; i++) { out.push([x + i, y - 1], [x + i, y + bh]); }
  for (let j = 0; j < bh; j++) { out.push([x - 1, y + j], [x + bw, y + j]); }
  return out;
}

/** Pick the land tile people use and the water tile ships berth at, and open the pier to walkers. */
export function initPort(sim: Sim, b: Building): void {
  const w = sim.world, d = b.def;
  let ax = -1, ay = -1, bx = -1, by = -1, da = Infinity, db = Infinity;
  const g = geo(sim);
  const city = sim.cities.get(b.cityId), cx = city ? city.x : b.cx, cy = city ? city.y : b.cy;
  for (const [x, y] of ring(b.x, b.y, d.w, d.h)) {
    if (!w.inb(x, y)) continue;
    const i = y * w.w + x;
    if (isLand(sim, x, y) && w.bld[i] === 0 && !OBJ_SOLID(w, i)) { const k = (x - cx) ** 2 + (y - cy) ** 2; if (k < da) { da = k; ax = x; ay = y; } }
    else if (TERRAIN[w.terrain[i]].water && w.bld[i] === 0 && g.seaSize[g.sea[i]] >= BIG_SEA) { const k = (x - b.cx) ** 2 + (y - b.cy) ** 2 + (w.terrain[i] === T.DEEP ? -40 : 0) + hash2(x, y, 5) * 3; if (k < db) { db = k; bx = x; by = y; } }
  }
  b.ax = ax; b.ay = ay; b.bx = bx; b.by = by;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) w.open[(b.y + j) * w.w + b.x + i] = 1;
}
const OBJ_SOLID = (w: Sim['world'], i: number): boolean => w.obj[i] === 16 || w.obj[i] === 17 || w.obj[i] === 18 || w.obj[i] === 19;

/** Where a dock or shipyard fits: all footprint on the shallows, touching land on one side and open sea on another. */
export function findDockSite(sim: Sim, c: City, type: 'dock' | 'shipyard'): { x: number; y: number } | null {
  const w = sim.world, d = BDEFS[type], g = geo(sim);
  const R = Math.max(8, Math.min(24, c.radius + 4));
  let best: { x: number; y: number } | null = null, bs = Infinity;
  for (let y = Math.max(1, Math.floor(c.y - R)); y <= Math.min(w.h - d.h - 2, Math.floor(c.y + R)); y++) for (let x = Math.max(1, Math.floor(c.x - R)); x <= Math.min(w.w - d.w - 2, Math.floor(c.x + R)); x++) {
    let ok = true;
    for (let j = 0; j < d.h && ok; j++) for (let i = 0; i < d.w; i++) {
      const idx = (y + j) * w.w + x + i, z = w.zone[idx];
      if (w.terrain[idx] !== T.SHALLOW || w.bld[idx] !== 0 || (z !== 0 && z !== c.id)) { ok = false; break; }
    }
    if (!ok) continue;
    let land = false, sea = false;
    for (const [rx, ry] of ring(x, y, d.w, d.h)) {
      if (!w.inb(rx, ry)) continue;
      const i = ry * w.w + rx;
      if (isLand(sim, rx, ry) && w.bld[i] === 0 && !OBJ_SOLID(w, i) && (w.zone[i] === 0 || w.zone[i] === c.id)) land = true;
      else if (TERRAIN[w.terrain[i]].water && w.bld[i] === 0 && g.seaSize[g.sea[i]] >= BIG_SEA) sea = true;
    }
    if (!land || !sea) continue;
    let tooClose = false;
    for (const b of sim.buildings.values()) if (isWaterType(b.type) && Math.abs(b.x - x) < d.w + 3 && Math.abs(b.y - y) < d.h + 3) { tooClose = true; break; }
    if (tooClose) continue;
    const s = (x + d.w / 2 - c.x) ** 2 + (y + d.h / 2 - c.y) ** 2;
    if (s < bs) { bs = s; best = { x, y }; }
  }
  return best;
}

/** Shallow tiles inside the town's reach: is there a coast worth building on? Cached for half a minute. */
const COAST = new WeakMap<City, { t: number; n: number }>();
export function coastTiles(sim: Sim, c: City): number {
  const cached = COAST.get(c);
  if (cached && sim.time - cached.t < 30) return cached.n;
  const w = sim.world, R = Math.floor(c.radius + 4);
  let n = 0;
  for (let y = Math.max(0, c.y - R); y <= Math.min(w.h - 1, c.y + R); y++) for (let x = Math.max(0, c.x - R); x <= Math.min(w.w - 1, c.x + R); x++) if (w.terrain[y * w.w + x] === T.SHALLOW) n++;
  COAST.set(c, { t: sim.time, n });
  return n;
}
export function nearWater(sim: Sim, x: number, y: number, r: number): boolean {
  const w = sim.world;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (w.inb(x + i, y + j) && w.terrain[(y + j) * w.w + x + i] === T.SHALLOW) return true;
  return false;
}

/** Port buildings a town should add next, in order. */
export function portWants(sim: Sim, c: City): BType[] {
  if (coastTiles(sim, c) < 16 || c.pop < 8) return [];
  const has = (t: BType): number => c.count(sim, t);
  const want: BType[] = [];
  if (has('fishhut') < Math.min(3, Math.ceil(c.pop / 14))) want.push('fishhut');
  if (c.pop >= 12 && has('dock') < 1 + Math.floor(c.pop / 45)) want.push('dock');
  if (c.count(sim, 'dock', true) && c.pop >= 18 && !has('shipyard')) want.push('shipyard');
  if (c.count(sim, 'dock', true) && c.pop >= 30 && !has('lighthouse')) want.push('lighthouse');
  return want;
}

/* ---- the fleet ----------------------------------------------------------------------------------- */
interface Hull { wood: number; ore: number; stone: number; crew: number }
export const HULLS: Record<ShipKind, Hull> = {
  canoe: { wood: 8, ore: 0, stone: 0, crew: 1 }, fishboat: { wood: 16, ore: 0, stone: 0, crew: 2 }, cog: { wood: 32, ore: 0, stone: 0, crew: 3 },
  longship: { wood: 30, ore: 0, stone: 0, crew: 4 }, galley: { wood: 44, ore: 4, stone: 0, crew: 5 }, galleon: { wood: 84, ore: 12, stone: 6, crew: 8 },
};
const PREFIX = ['Gaivota', 'Andorinha', 'Tormenta', 'Maré', 'Estrela', 'Aurora', 'Pérola', 'Vento', 'Corsário', 'Albatroz', 'Sereia', 'Trovão', 'Horizonte', 'Fortuna', 'Delfim'];
const SUFFIX = ['do Norte', 'Dourada', 'Veloz', 'Valente', 'do Mar', 'Branca', 'Audaz', 'da Aurora', 'Negra', 'Real'];

export const aboard = (sim: Sim, ship: Unit): Unit[] => sim.units.filter(c => c.inShip === ship.id && c.alive);
const fleetOf = (sim: Sim, c: City): Unit[] => sim.units.filter(u => u.def.ship && u.alive && u.cityId === c.id);

function docksOf(sim: Sim, c: City, done = true): Building[] {
  const out: Building[] = [];
  for (const id of c.buildings) { const b = sim.buildings.get(id); if (b && (b.type === 'dock' || b.type === 'shipyard') && !b.ruin && (!done || b.done) && b.bx >= 0) out.push(b); }
  return out;
}
export const homeDock = (sim: Sim, u: Unit): Building | null => {
  const b = sim.buildings.get(u.dock);
  if (b && !b.ruin) return b;
  const c = sim.cities.get(u.cityId);
  const alt = c ? docksOf(sim, c).sort((p, q) => Math.hypot(p.cx - u.x, p.cy - u.y) - Math.hypot(q.cx - u.x, q.cy - u.y))[0] : null;
  if (alt) u.dock = alt.id;
  return alt ?? null;
};

/** Which hull the town wants next: fishing first, then merchants, then (in war or by temperament) the fighting fleet. */
export function nextHull(sim: Sim, c: City): ShipKind | null {
  const k = sim.kingdoms.get(c.kingdomId), fleet = fleetOf(sim, c);
  const n = (kinds: ShipKind[]): number => fleet.filter(s => kinds.includes(s.species as ShipKind)).length;
  const fishWant = Math.min(1 + c.count(sim, 'fishhut', true), Math.floor(c.pop / 12));
  if (n(['canoe', 'fishboat']) < fishWant) return c.pop < 20 ? 'canoe' : 'fishboat';
  const war = (k?.wars.size ?? 0) > 0 || k?.trait === 'warlike';
  const warWant = war ? Math.min(5, 1 + Math.floor(c.pop / 24)) : 0;
  const traders = n(['cog']), tradeWant = c.pop >= 22 ? Math.min(2, 1 + Math.floor(c.pop / 80)) : 0;
  if (war && n(WAR_KINDS) < Math.ceil(warWant / 2) ) return warHull(sim, c);
  if (traders < tradeWant) return 'cog';
  if (n(WAR_KINDS) < warWant) return warHull(sim, c);
  return null;
}
function warHull(sim: Sim, c: City): ShipKind | null {
  if (c.pop >= 60 && c.count(sim, 'smith', true) && c.stock.ore >= 12) return 'galleon';
  if (c.pop >= 34) return 'galley';
  if (c.pop >= 22) return 'longship';
  return null;
}

/** Shipyards launch a hull when the town can pay for it and crew it. Once a second per town. */
export function yardStep(sim: Sim, c: City): void {
  const yards = c.buildings.map(id => sim.buildings.get(id)).filter((b): b is Building => !!b && b.type === 'shipyard' && b.done && !b.ruin && b.bx >= 0);
  if (!yards.length) return;
  const yard = yards[0];
  if (yard.cd > 0) { yard.cd -= 1; return; }
  const kind = nextHull(sim, c);
  if (!kind) return;
  const h = HULLS[kind];
  if (c.stock.wood < h.wood || c.stock.ore < h.ore || c.stock.stone < h.stone) return;
  const hands = sim.units.filter(u => u.def.civ && u.cityId === c.id && u.alive && !u.inShip && u.age >= 17 && u.role !== 'king' && u.role !== 'soldier' && u.role !== 'archer' && u.role !== 'knight' && !u.carry && u.mode !== 'board');
  if (hands.length < h.crew + 3) return;
  c.stock.wood -= h.wood; c.stock.ore -= h.ore; c.stock.stone -= h.stone;
  yard.cd = 18;
  const ship = sim.spawn(kind, yard.bx + 0.5, yard.by + 0.5, { kingdom: c.kingdomId, city: c.id });
  ship.age = 0; ship.mode = 'ship'; ship.mission = 'moor'; ship.phase = 0; ship.legT = 4 + sim.rng.next() * 25; ship.dock = (docksOf(sim, c).find(b => b.type === 'dock') ?? yard).id;
  ship.variant = ['human', 'elf', 'dwarf', 'orc'].indexOf(c.race);
  ship.name = `${sim.rng.pick(PREFIX)} ${sim.rng.pick(SUFFIX)}`;
  const peasants = hands.filter(u => u.role === 'peasant');
  const crew = (peasants.length >= h.crew ? peasants : hands).slice(0, h.crew);
  const fishing = kind === 'canoe' || kind === 'fishboat';
  for (const u of crew) embark(sim, u, ship, fishing ? 'fisher' : 'sailor');
  sim.fx.push({ t: 'splash', x: ship.x, y: ship.y }); sim.fx.push({ t: 'dust', x: yard.cx, y: yard.cy, a: 1.4 });
  if (kind === 'galleon' || kind === 'galley') sim.note(`${c.name} lançou ${ship.name}, ${SPECIES[kind].name.toLowerCase()} de guerra.`, 'city');
}

function embark(sim: Sim, u: Unit, ship: Unit, role?: 'fisher' | 'sailor'): void {
  if (u.job) { const b = sim.buildings.get(u.job); if (b && b.workers > 0) b.workers--; u.job = 0; }
  u.inShip = ship.id; u.mode = 'aboard'; u.path = null; u.carry = null; u.x = ship.x; u.y = ship.y; u.px = ship.x; u.py = ship.y;
  if (role) { u.role = role; sim.refreshLook(u); }
}

/** Put one rider ashore on the nearest land to (x,y). */
function disembark(sim: Sim, u: Unit, x: number, y: number): void {
  const s = sim.freeSpot(x, y, 6);
  u.inShip = 0; u.mode = 'wander'; u.path = null; u.thinkT = 0.2;
  if (s) { u.x = s.x; u.y = s.y; u.px = s.x; u.py = s.y; }
  if (u.role === 'fisher' || u.role === 'sailor') { u.role = 'peasant'; sim.refreshLook(u); }
}

/* ---- sailing ------------------------------------------------------------------------------------------ */
let navTick = -1, navLeft = 0;
export function sailTo(sim: Sim, u: Unit, gx: number, gy: number, dt: number, within = 0.7): Move {
  const w = sim.world, dxg = gx - u.x, dyg = gy - u.y;
  if (dxg * dxg + dyg * dyg <= within * within) { u.path = null; return 'arrived'; }
  u.repathT -= dt;
  const moved = Math.abs(u.goalX - gx) > 0.6 || Math.abs(u.goalY - gy) > 0.6;
  if (!u.path || (moved && (u.repathT <= 0 || Math.hypot(u.goalX - gx, u.goalY - gy) > 5))) {
    if (u.failT > 0) { u.failT -= dt; return 'blocked'; }
    if (sim.tickN !== navTick) { navTick = sim.tickN; navLeft = 2; }
    if (navLeft <= 0) return 'moving';
    navLeft--;
    u.goalX = gx; u.goalY = gy; u.repathT = 1.2;
    u.path = findPath(w, Math.floor(u.x), Math.floor(u.y), Math.floor(gx), Math.floor(gy), 7000, true); u.pathI = 0;
    if (!u.path) { u.failT = 3; return 'blocked'; }
  }
  const p = u.path;
  if (u.pathI >= p.length) { u.path = null; return 'arrived'; }
  const ni = p[u.pathI], nx = (ni % w.w) + 0.5, ny = ((ni / w.w) | 0) + 0.5;
  if (w.bld[ni] !== 0 && u.pathI < p.length - 1) { u.path = null; return 'moving'; }
  const shallow = w.terrain[Math.floor(u.y) * w.w + Math.floor(u.x)] === T.SHALLOW;
  const step = u.def.speed * (shallow ? 0.7 : 1) * dt, dx = nx - u.x, dy = ny - u.y, d = Math.hypot(dx, dy);
  if (d <= step) { u.x = nx; u.y = ny; u.pathI++; } else { u.x += (dx / d) * step; u.y += (dy / d) * step; }
  face(u, dx, dy);
  return 'moving';
}

const GOODS = ['food', 'wood', 'stone', 'ore'] as const;
type Good = typeof GOODS[number];
const keep = (c: City, g: Good): number => (g === 'food' ? c.pop * 2.5 + 12 : g === 'wood' ? 55 : g === 'stone' ? 50 : 14);
const surplus = (c: City, g: Good): number => Math.max(0, c.stock[g] - keep(c, g) * 1.5);
const lack = (c: City, g: Good): number => Math.max(0, keep(c, g) - c.stock[g]);
const holdTotal = (u: Unit): number => (u.hold ? u.hold.reduce((a, v) => a + v, 0) : 0);

/** Fish are a physical stock per 8×8 patch of sea; they come back slowly. */
const FISH = new WeakMap<Sim, Map<number, { n: number; t: number }>>();
function fishCell(sim: Sim, x: number, y: number): { n: number; t: number } {
  let m = FISH.get(sim); if (!m) { m = new Map(); FISH.set(sim, m); }
  const cx = Math.floor(x) >> 3, cy = Math.floor(y) >> 3, key = cy * 4096 + cx;
  let c = m.get(key);
  if (!c) { c = { n: 90 + hash2(cx, cy, 77) * 160, t: sim.time }; m.set(key, c); }
  c.n = Math.min(260, c.n + (sim.time - c.t) * 0.5); c.t = sim.time;
  return c;
}
const fishSpot = (sim: Sim, u: Unit, dock: Building): { x: number; y: number } | null => {
  const w = sim.world, g = geo(sim), sid = g.sea[dock.by * w.w + dock.bx];
  let best: { x: number; y: number } | null = null, bs = 0;
  for (let k = 0; k < 28; k++) {
    const a = sim.rng.range(0, 6.283), r = sim.rng.range(4, 15), x = Math.floor(dock.bx + Math.cos(a) * r), y = Math.floor(dock.by + Math.sin(a) * r);
    if (!w.inb(x, y)) continue;
    const i = y * w.w + x;
    if (g.sea[i] !== sid || w.bld[i] !== 0) continue;
    const s = fishCell(sim, x, y).n - r * 2 + (w.terrain[i] === T.DEEP ? 25 : 0);
    if (s > bs) { bs = s; best = { x: x + 0.5, y: y + 0.5 }; }
  }
  return bs > 30 ? best : null;
};

function tradePartner(sim: Sim, u: Unit, c: City, home: Building): { dock: Building; city: City; score: number } | null {
  const k = sim.kingdoms.get(c.kingdomId), g = geo(sim), sid = g.sea[home.by * sim.world.w + home.bx];
  let best: { dock: Building; city: City; score: number } | null = null;
  for (const b of sim.buildings.values()) {
    if (b.type !== 'dock' || !b.done || b.ruin || b.bx < 0 || b.cityId === c.id) continue;
    const o = sim.cities.get(b.cityId), ok = o && sim.kingdoms.get(o.kingdomId);
    if (!o || !ok || !k) continue;
    if (o.kingdomId !== c.kingdomId && (k.wars.has(o.kingdomId) || (k.relations.get(o.kingdomId) ?? 0) < -30)) continue;
    if (g.sea[b.by * sim.world.w + b.bx] !== sid) continue;
    const d = Math.hypot(b.bx - home.bx, b.by - home.by);
    if (d > 150) continue;
    let score = 0;
    for (const gd of GOODS) score += Math.min(surplus(c, gd), lack(o, gd), 18) + Math.min(surplus(o, gd), lack(c, gd), 18) * 0.7;
    score -= d * 0.04;
    if (!best || score > best.score) best = { dock: b, city: o, score };
  }
  return best && best.score >= 8 ? best : null;
}

function load(c: City, u: Unit, to: City, cap: number): void {
  const hold = u.hold ?? [0, 0, 0, 0];
  let room = cap - holdTotal(u);
  GOODS.forEach((gd, i) => {
    const n = Math.floor(Math.min(surplus(c, gd), lack(to, gd), 18, room));
    if (n > 0) { c.stock[gd] -= n; hold[i] += n; room -= n; }
  });
  u.hold = hold;
}
function unload(sim: Sim, u: Unit, c: City): number {
  let moved = 0;
  GOODS.forEach((gd, i) => { const n = u.hold?.[i] ?? 0; if (n > 0) { c.deposit({ good: gd, n }); moved += n; } });
  u.hold = null;
  if (moved) sim.fx.push({ t: 'coin', x: u.x, y: u.y - 0.6 });
  return moved;
}

/** One docked ship deciding what to do next. */
export function thinkShip(sim: Sim, u: Unit): void {
  u.thinkT = 0.7 + sim.rng.next() * 0.5;
  const c = sim.cities.get(u.cityId);
  if (!c) { if (u.mission !== 'adrift') { u.mission = 'adrift'; u.legT = 0; } return; }
  if (WAR_KINDS.includes(u.species as ShipKind)) return thinkWarship(sim, u, c);
  if (u.mission !== 'moor') return;
  const home = homeDock(sim, u);
  if (!home) { u.legT += u.thinkT; if (u.legT > 40) decommission(sim, u, c); return; }
  if (u.legT > 0) { u.legT -= u.thinkT; return; }
  const sp = u.species as ShipKind;
  if ((sp === 'canoe' || sp === 'fishboat') && sim.weather !== 'storm' && (sim.dayPhase > 0.24 && sim.dayPhase < 0.8)) {
    const spot = fishSpot(sim, u, home);
    if (spot) { u.mission = 'fish'; u.phase = 0; u.goalX = spot.x; u.goalY = spot.y; u.path = null; u.hold = [0, 0, 0, 0]; }
    else u.legT = 15;
    return;
  }
  if (sp === 'cog' && sim.weather !== 'storm') {
    const want = c.seaSite;
    if (want && sim.time - want.t > 150) c.seaSite = null;
    else if (want && aboardWaiting(sim, u) === 0 && tryBoardSettlers(sim, u, c, home, want)) { c.seaSite = null; return; }
    const p = tradePartner(sim, u, c, home);
    if (p) { load(c, u, p.city, 36); u.mission = 'trade'; u.phase = 1; u.dest = p.dock.id; u.goalX = p.dock.bx + 0.5; u.goalY = p.dock.by + 0.5; u.path = null; return; }
    u.legT = 20;
  }
}

/** Settlers wait for a ship: a town asks (`requestSettlement`), a moored merchant answers. */
const aboardWaiting = (sim: Sim, ship: Unit): number => sim.units.filter(p => p.dest === ship.id && (p.mode === 'board' || p.inShip === ship.id) && !isCrew(p)).length;
const isCrew = (u: Unit): boolean => u.role === 'sailor' || u.role === 'fisher';

/** Find a site across the water for a daughter town, with a beach to land on. */
export function requestSettlement(sim: Sim, c: City): boolean {
  if (c.seaSite || !docksOf(sim, c).some(b => b.type === 'dock') || !fleetOf(sim, c).some(s => s.species === 'cog')) return false;
  const k = sim.kingdoms.get(c.kingdomId), g = geo(sim), w = sim.world;
  if (!k) return false;
  const home = docksOf(sim, c).find(b => b.type === 'dock')!, sid = g.sea[home.by * w.w + home.bx];
  for (let tries = 0; tries < 80; tries++) {
    const a = sim.rng.range(0, 6.283), d = sim.rng.range(14, 70), x = Math.floor(c.x + Math.cos(a) * d), y = Math.floor(c.y + Math.sin(a) * d);
    if (!w.inb(x, y) || !isLand(sim, x, y) || !siteOk(sim, x, y, 15, k.id)) continue;
    // a water tile of our sea within 5 tiles of the site is where the boat lands
    let wx = -1, wy = -1, bd = Infinity;
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
      const tx = x + i, ty = y + j;
      if (!w.inb(tx, ty) || !TERRAIN[w.terrain[ty * w.w + tx]].water || g.sea[ty * w.w + tx] !== sid || w.bld[ty * w.w + tx]) continue;
      const dd = i * i + j * j; if (dd < bd) { bd = dd; wx = tx; wy = ty; }
    }
    if (wx < 0) continue;
    c.seaSite = { x, y, wx, wy, t: sim.time };
    return true;
  }
  return false;
}
function tryBoardSettlers(sim: Sim, ship: Unit, c: City, home: Building, site: { x: number; y: number; wx: number; wy: number }): boolean {
  const crew = sim.units.filter(u => u.def.civ && u.cityId === c.id && u.alive && !u.inShip && u.age >= 18 && (u.role === 'peasant' || u.role === 'woodcutter') && !u.carry && u.mode !== 'board').slice(0, 4);
  if (crew.length < 2) return false;
  ship.mission = 'settle'; ship.phase = 0; ship.legT = 30; ship.hold = [site.x, site.y, site.wx, site.wy]; ship.path = null;
  for (const u of crew) {
    if (u.job) { const b = sim.buildings.get(u.job); if (b && b.workers > 0) b.workers--; u.job = 0; }
    u.cityId = 0; u.role = 'peasant'; u.mode = 'board'; u.dest = ship.id; u.goalX = home.doorX + 0.5; u.goalY = home.doorY + 0.5; u.path = null;
  }
  sim.fx.push({ t: 'splash', x: ship.x, y: ship.y });
  return true;
}

/** A settler walking to the quay and stepping aboard. */
export function actBoard(sim: Sim, u: Unit, dt: number): void {
  const ship = sim.byId.get(u.dest);
  if (!ship || !ship.alive || (ship.mission !== 'settle' && ship.mission !== 'invade') || ship.phase !== 0) { u.mode = 'wander'; u.dest = 0; return; }
  const m = moveTo(sim, u, u.goalX, u.goalY, dt, 1, 1.6);
  if (m === 'moving') { setAct(u, 'walk'); u.state = 'walk'; return; }
  if (m === 'blocked') { u.mode = 'wander'; u.dest = 0; return; }
  u.inShip = ship.id; u.mode = 'aboard'; u.path = null; u.x = ship.x; u.y = ship.y;
  const site = ship.hold; if (site) { u.goalX = site[0] + 0.5; u.goalY = site[1] + 0.5; }
}

/** Running a mission, every tick. */
export function actShip(sim: Sim, u: Unit, dt: number): void {
  if (u.mission === 'invade') return runInvade(sim, u, dt);
  if (WAR_KINDS.includes(u.species as ShipKind)) return actWarship(sim, u, dt);
  const c = sim.cities.get(u.cityId), home = homeDock(sim, u);
  if (u.mission === 'adrift') { setAct(u, 'idle'); u.legT += dt; if (u.legT > 30) decommission(sim, u, null); return; }
  if (u.mission === 'moor' || !home) { setAct(u, 'idle'); u.state = 'idle'; return; }
  const berth = { x: home.bx + 0.5, y: home.by + 0.5 };
  const go = (x: number, y: number, within = 0.8): Move => { const m = sailTo(sim, u, x, y, dt, within); setAct(u, m === 'moving' ? 'sail' : 'idle'); u.state = m === 'moving' ? 'walk' : 'idle'; return m; };
  const abort = (): void => { u.mission = 'return'; u.phase = 0; u.path = null; };
  if (u.mission === 'return') { if (go(berth.x, berth.y) !== 'moving') { if (c && u.hold) unload(sim, u, c); landRiders(sim, u, home); u.hold = null; u.mission = 'moor'; u.legT = 8; } return; }
  if (u.mission === 'fish') {
    if (sim.weather === 'storm' && u.phase < 2) u.phase = 2;
    if (u.phase === 0) { const m = go(u.goalX, u.goalY, 1.0); if (m === 'blocked') abort(); else if (m === 'arrived') { u.phase = 1; u.legT = 0; } }
    else if (u.phase === 1) {
      setAct(u, 'idle'); u.legT += dt;
      const cell = fishCell(sim, u.x, u.y), crew = aboard(sim, u).length, hold = u.hold ?? (u.hold = [0, 0, 0, 0]);
      if (u.legT >= 1) { u.legT -= 1; const n = Math.min(cell.n, 0.3 * crew + 0.15, (u.species === 'canoe' ? 14 : 30) - hold[0]); cell.n -= n; hold[0] += n; if (hash2(sim.tickN, u.id, 9) < 0.5) sim.fx.push({ t: 'splash', x: u.x + (sim.rng.next() - 0.5) * 1.6, y: u.y + 0.6 }); }
      if (hold[0] >= (u.species === 'canoe' ? 14 : 30) - 0.5 || cell.n < 5 || sim.dayPhase > 0.8 || sim.dayPhase < 0.22) u.phase = 2;
    } else if (u.phase === 2) {
      const m = go(berth.x, berth.y); if (m !== 'moving') { if (c && u.hold) { const n = Math.floor(u.hold[0]); if (n > 0) { c.deposit({ good: 'food', n }); sim.fx.push({ t: 'coin', x: u.x, y: u.y - 0.6 }); } } u.hold = null; u.mission = 'moor'; u.legT = 5; }
    }
    return;
  }
  if (u.mission === 'trade') {
    const dest = sim.buildings.get(u.dest), dc = dest && sim.cities.get(dest.cityId), k = c && sim.kingdoms.get(c.kingdomId);
    if (u.phase === 1) {
      if (!dest || dest.ruin || !dc || (k && dc.kingdomId !== c?.kingdomId && k.wars.has(dc.kingdomId))) { u.phase = 3; return; }
      const m = go(dest.bx + 0.5, dest.by + 0.5);
      if (m === 'blocked') u.phase = 3;
      else if (m === 'arrived') {
        unload(sim, u, dc);
        if (c) { load(dc, u, c, 36); const ok = sim.kingdoms.get(dc.kingdomId); if (k && ok && ok !== k) { k.relations.set(ok.id, Math.min(60, (k.relations.get(ok.id) ?? 0) + 1.5)); ok.relations.set(k.id, Math.min(60, (ok.relations.get(k.id) ?? 0) + 1.5)); } }
        u.phase = 3; u.path = null;
      }
    } else if (u.phase === 3) {
      const m = go(berth.x, berth.y);
      if (m !== 'moving') { if (c) unload(sim, u, c); u.mission = 'moor'; u.legT = 10; }
    }
    return;
  }
  if (u.mission === 'settle') {
    const site = u.hold;
    if (!site || !c) return abort();
    if (u.phase === 0) { // wait at the quay for the settlers to come aboard
      setAct(u, 'idle'); u.legT -= dt;
      const riders = sim.units.filter(p => p.inShip === u.id && !isCrew(p)).length, coming = sim.units.filter(p => p.dest === u.id && p.mode === 'board').length;
      if (riders >= 2 && (coming === 0 || u.legT <= 0)) { u.phase = 1; u.goalX = site[2] + 0.5; u.goalY = site[3] + 0.5; u.path = null; }
      else if (riders < 2 && u.legT <= -20) { for (const p of sim.units) if (p.dest === u.id && p.mode === 'board') { p.mode = 'wander'; p.dest = 0; } abort(); }
    } else if (u.phase === 1) {
      const m = go(site[2] + 0.5, site[3] + 0.5, 1.2);
      if (m === 'blocked') { for (const p of sim.units) if (p.inShip === u.id && !isCrew(p)) disembark(sim, p, home.doorX, home.doorY); u.phase = 2; }
      else if (m === 'arrived') {
        for (const p of sim.units) if (p.inShip === u.id && !isCrew(p)) { disembark(sim, p, site[0] + 0.5, site[1] + 0.5); p.mode = 'settle'; p.goalX = site[0] + 0.5; p.goalY = site[1] + 0.5; p.cityId = 0; }
        sim.note(`${c.name} enviou colonos por mar.`, 'city');
        u.phase = 2; u.path = null;
      }
    } else if (u.phase === 2) { abort(); u.hold = null; }
  }
}

/* ---- invasion by sea ---------------------------------------------------------------------------- */
const CAP: Partial<Record<ShipKind, number>> = { cog: 6, longship: 10, galley: 5, galleon: 14 };
export interface Landing { x: number; y: number; wx: number; wy: number }

/** A beach near an enemy town, outside its walls, on a sea one of our ships can reach. */
export function planLanding(sim: Sim, tgt: City, sid: number): Landing | null {
  const w = sim.world, g = geo(sim);
  let best: Landing | null = null, bs = Infinity;
  for (let j = -30; j <= 30; j++) for (let i = -30; i <= 30; i++) {
    const x = Math.floor(tgt.x) + i, y = Math.floor(tgt.y) + j, d = Math.hypot(i, j);
    if (d < 7 || d > 30 || !isLand(sim, x, y) || w.bld[y * w.w + x] || OBJ_SOLID(w, y * w.w + x)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const wx = x + dx, wy = y + dy;
      if (!w.inb(wx, wy)) continue;
      const wi = wy * w.w + wx;
      if (!TERRAIN[w.terrain[wi]].water || g.sea[wi] !== sid || w.bld[wi]) continue;
      const s = d + hash2(x, y, 3) * 2;
      if (s < bs) { bs = s; best = { x, y, wx, wy }; }
    }
  }
  return best;
}

/** Ships of this realm riding at anchor, any hull that can carry people. */
export function transportsOf(sim: Sim, kingdomId: number): Unit[] {
  return sim.units.filter(u => u.def.ship && u.alive && u.kingdomId === kingdomId && u.mission === 'moor' && (CAP[u.species as ShipKind] ?? 0) > 0 && homeDock(sim, u));
}

/** Send hulls to carry soldiers to a beach by `tgt`. Returns the landing, or null if no ship can reach it. */
export function orderInvasion(sim: Sim, kingdomId: number, tgt: City): Landing | null {
  const g = geo(sim), w = sim.world;
  const ships = transportsOf(sim, kingdomId).sort((p, q) => (CAP[q.species as ShipKind] ?? 0) - (CAP[p.species as ShipKind] ?? 0));
  if (!ships.length) return null;
  const sid = (() => { const d = homeDock(sim, ships[0])!; return g.sea[d.by * w.w + d.bx]; })();
  const land = planLanding(sim, tgt, sid);
  if (!land) return null;
  let sent = 0;
  for (const ship of ships) {
    const d = homeDock(sim, ship)!;
    if (g.sea[d.by * w.w + d.bx] !== sid || sent >= 3) continue;
    const cap = CAP[ship.species as ShipKind] ?? 0;
    const men = sim.units.filter(u => u.def.civ && u.cityId === ship.cityId && u.alive && !u.inShip && u.mode !== 'board' && (u.role === 'soldier' || u.role === 'archer' || u.role === 'knight') && u.age >= 16).slice(0, cap);
    if (men.length < 3) continue;
    ship.mission = 'invade'; ship.phase = 0; ship.legT = 30; ship.hold = [land.x, land.y, land.wx, land.wy]; ship.path = null;
    for (const p of men) { p.mode = 'board'; p.dest = ship.id; p.goalX = d.doorX + 0.5; p.goalY = d.doorY + 0.5; p.path = null; }
    sent++;
  }
  return sent ? land : null;
}

function runInvade(sim: Sim, u: Unit, dt: number): void {
  const home = homeDock(sim, u), land = u.hold;
  if (!home || !land) { u.mission = 'return'; return; }
  const go = (x: number, y: number, within: number): Move => { const m = sailTo(sim, u, x, y, dt, within); setAct(u, m === 'moving' ? 'sail' : 'idle'); u.state = m === 'moving' ? 'walk' : 'idle'; return m; };
  const riders = (): Unit[] => sim.units.filter(p => p.inShip === u.id && !isCrew(p));
  if (u.phase === 0) {
    setAct(u, 'idle'); u.legT -= dt;
    const n = riders().length, coming = sim.units.filter(p => p.dest === u.id && p.mode === 'board').length;
    if (n >= (CAP[u.species as ShipKind] ?? 4) || (n >= 2 && (coming === 0 || u.legT <= 0))) { u.phase = 1; u.goalX = land[2] + 0.5; u.goalY = land[3] + 0.5; u.path = null; }
    else if (u.legT <= -25) { for (const p of sim.units) if (p.dest === u.id && p.mode === 'board') { p.mode = 'wander'; p.dest = 0; } for (const p of riders()) disembark(sim, p, home.doorX, home.doorY); u.mission = 'moor'; u.hold = null; u.legT = 20; }
  } else if (u.phase === 1) {
    const m = go(land[2] + 0.5, land[3] + 0.5, 1.2);
    if (m === 'blocked') { for (const p of riders()) disembark(sim, p, home.doorX, home.doorY); u.mission = 'return'; u.hold = null; }
    else if (m === 'arrived') {
      for (const p of riders()) { disembark(sim, p, land[0] + 0.5, land[1] + 0.5); p.dest = 0; p.mode = 'march'; p.thinkT = 0; }
      sim.fx.push({ t: 'splash', x: u.x, y: u.y }); sim.fx.push({ t: 'dust', x: land[0] + 0.5, y: land[1] + 0.5, a: 1.2 });
      u.hold = null; u.mission = 'return'; u.path = null;
    }
  }
}

/** Whoever rides as a passenger steps ashore at the home quay (after a recall, or when the voyage was called off). */
export function landRiders(sim: Sim, u: Unit, home: Building): void {
  for (const p of sim.units) if (p.inShip === u.id && !isCrew(p)) { disembark(sim, p, home.doorX + 0.5, home.doorY + 0.5); p.dest = 0; }
}
/** Peace: troop ships turn for home. */
export function recallInvasions(sim: Sim, kingdomId: number): void {
  for (const u of sim.units) if (u.def.ship && u.alive && u.kingdomId === kingdomId && u.mission === 'invade') { u.mission = 'return'; u.hold = null; u.path = null; for (const p of sim.units) if (p.dest === u.id && p.mode === 'board') { p.mode = 'wander'; p.dest = 0; } }
}

/** A ship with nowhere to go: the crew walk ashore and the hull is broken up. */
function decommission(sim: Sim, u: Unit, c: City | null): void {
  for (const p of sim.units) if (p.inShip === u.id) disembark(sim, p, u.x, u.y);
  sim.fx.push({ t: 'splash', x: u.x, y: u.y });
  u.hp = 0; u.state = 'dead'; u.stateT = 9; u.mode = 'dead';
  void c;
}

/** A ship goes down: whoever was aboard is in the water. */
export function sinkShip(sim: Sim, u: Unit): void {
  sim.fx.push({ t: 'boom', x: u.x, y: u.y, a: 1.2 }); sim.fx.push({ t: 'splash', x: u.x, y: u.y });
  const k = sim.kingdoms.get(u.kingdomId);
  for (const p of sim.units) if (p.inShip === u.id) { p.inShip = 0; p.x = u.x + (hash2(p.id, 1, 1) - 0.5) * 1.5; p.y = u.y + (hash2(p.id, 2, 1) - 0.5) * 1.5; p.px = p.x; p.py = p.y; p.mode = 'wander'; p.path = null; }
  sim.note(`${u.name || SPECIES[u.species].name}${k ? ` de ${k.name}` : ''} afundou.`, 'war');
}

const MISSION: Record<string, string> = { moor: 'Ancorado', fish: 'Pescando', trade: 'Comerciando', settle: 'Levando colonos', return: 'Voltando ao porto', adrift: 'À deriva', patrol: 'Patrulhando', hunt: 'Caçando navios', invade: 'Invadindo', bombard: 'Bombardeando', raid: 'Atacando o porto' };
export const shipMission = (u: Unit): string => MISSION[u.mission] ?? u.mission;
export const shipRace = (u: Unit): Race => (['human', 'elf', 'dwarf', 'orc'] as Race[])[Math.max(0, Math.min(3, u.variant))];
