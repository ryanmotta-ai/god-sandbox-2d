import type { Sim } from './sim';
import type { Unit } from './unit';
import { YEAR_SECONDS } from './species';
import { findPath, stepCost } from './path';
import { TERRAIN, T, O, OBJECTS, isTree } from '../world/defs';
import { hostile, damage, kill, shoot, attackPower, MELEE } from './combat';
export { updateArrows } from './combat';
import { thinkAnimal, actDragon } from './fauna';
import { hash2 } from '../core/rng';
import type { Building } from './buildings';
import { tryFoundCity, type City } from './city';

const PATHS_PER_TICK = 40;
let pathBudget = PATHS_PER_TICK;

export type Move = 'moving' | 'arrived' | 'blocked';

/** Walk toward (gx,gy) (tile coords, may be fractional). Replans when the goal changes or the way is blocked. */
export function moveTo(sim: Sim, u: Unit, gx: number, gy: number, dt: number, mult = 1, within = 0.35): Move {
  const w = sim.world;
  const dxg = gx - u.x, dyg = gy - u.y;
  if (dxg * dxg + dyg * dyg <= within * within) { u.path = null; return 'arrived'; }
  const flying = u.def.fly === true;
  if (flying) { // birds and dragons ignore terrain
    const l = Math.hypot(dxg, dyg), s = u.def.speed * mult * dt;
    u.x += (dxg / l) * Math.min(s, l); u.y += (dyg / l) * Math.min(s, l); face(u, dxg, dyg);
    return 'moving';
  }
  const goalChanged = Math.abs(u.goalX - gx) > 0.6 || Math.abs(u.goalY - gy) > 0.6;
  if (!u.path || goalChanged) {
    if (pathBudget <= 0) return 'moving';
    pathBudget--;
    u.goalX = gx; u.goalY = gy;
    u.path = findPath(w, Math.floor(u.x), Math.floor(u.y), Math.floor(gx), Math.floor(gy), 2600);
    u.pathI = 0;
    if (!u.path) { u.pathFail++; return 'blocked'; }
    u.pathFail = 0;
  }
  const p = u.path;
  if (u.pathI >= p.length) { u.path = null; return 'arrived'; }
  const ni = p[u.pathI];
  if (stepCost(w, ni) === 0 && u.pathI < p.length - 1 || (w.bld[ni] !== 0 && u.pathI === p.length - 1 && !TERRAIN[w.terrain[ni]].walk)) { u.path = null; return 'moving'; }
  const nx = (ni % w.w) + 0.5, ny = ((ni / w.w) | 0) + 0.5;
  const terr = TERRAIN[w.terrain[(Math.floor(u.y)) * w.w + Math.floor(u.x)]];
  const step = u.def.speed * Math.max(0.35, terr.speed) * mult * dt * (u.age < 16 ? 0.8 : 1) * (u.traits.includes('quick') ? 1.3 : 1);
  const dx = nx - u.x, dy = ny - u.y, d = Math.hypot(dx, dy);
  if (d <= step) { u.x = nx; u.y = ny; u.pathI++; }
  else { u.x += (dx / d) * step; u.y += (dy / d) * step; }
  face(u, dx, dy);
  return 'moving';
}

export function face(u: Unit, dx: number, dy: number): void {
  if (Math.abs(dx) > Math.abs(dy) * 1.2) u.dir = dx > 0 ? 'E' : 'W';
  else if (Math.abs(dy) > Math.abs(dx) * 1.2) u.dir = dy > 0 ? 'S' : 'N';
  if (dx !== 0) u.east = dx > 0;
}

export function setAct(u: Unit, a: Unit['act']): void { if (u.act !== a) { u.act = a; u.actT = 0; } }

/* ---------------------------------------------------------------------------------------------- */

export function updateUnits(sim: Sim, dt: number): void {
  pathBudget = PATHS_PER_TICK;
  const units = sim.units;
  const w = sim.world;
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    u.px = u.x; u.py = u.y;
    u.stateT += dt; u.actT += dt;
    if (u.hurtT > 0) u.hurtT -= dt;
    if (u.attackCd > 0) u.attackCd -= dt;
    if (u.state === 'dead') {
      if (u.stateT > 2.4) { units[i] = units[units.length - 1]; units.pop(); sim.byId.delete(u.id); }
      continue;
    }
    const d = u.def;
    u.age += dt / YEAR_SECONDS;
    if (u.age > d.maxAge * (0.85 + hash2(u.id, 1, 9) * 0.3)) { kill(sim, u, null, 'velhice'); continue; }
    // hunger: civs and carnivores feel it; herbivores graze it off
    if (d.diet !== 'none' && u.species !== 'zombie') {
      u.hunger += dt * (d.civ ? 0.55 : 0.35);
      if (u.hunger >= 100) { u.hp -= dt * 1.2; if (u.hp <= 0) { kill(sim, u, null, 'fome'); continue; } }
    }
    // drowning / lava
    const ti = Math.floor(u.y) * w.w + Math.floor(u.x);
    const tt = w.terrain[ti];
    if (!d.fly) {
      if (tt === T.DEEP) { u.hp -= 25 * dt; if (u.hp <= 0) { sim.fx.push({ t: 'splash', x: u.x, y: u.y }); kill(sim, u, null, 'afogamento'); continue; } }
      else if (tt === T.LAVA) { kill(sim, u, null, 'lava'); continue; }
    }
    if (u.burning > 0) {
      u.burning -= dt; u.hp -= 7 * dt;
      if (TERRAIN[tt].water) u.burning = 0;
      if (hash2(sim.tickN, u.id, 5) < 0.2) sim.fx.push({ t: 'fire', x: u.x, y: u.y - 0.5 });
      if (u.hp <= 0) { kill(sim, u, null, 'fogo'); continue; }
      if (w.fire[ti] === 0 && TERRAIN[tt].flammable > 0.3 && hash2(sim.tickN, u.id, 6) < 0.02) igniteTile(sim, Math.floor(u.x), Math.floor(u.y));
    }
    if (u.hp < u.maxHp && d.civ && u.hunger < 60) u.hp = Math.min(u.maxHp, u.hp + dt * 0.5);
    u.thinkT -= dt;
    if (u.hitT > 0) { u.hitT -= dt; if (u.hitT <= 0) resolveHit(sim, u); }
    if (u.thinkT <= 0) {
      if (d.civ) thinkCiv(sim, u); else thinkAnimal(sim, u);
    }
    act(sim, u, dt);
  }
  // grow-ups: keep the look in step with age (child → adult)
  for (let i = sim.tickN % 20; i < units.length; i += 20) { const u = units[i]; if (u.def.civ && u.look && (u.look.age === 'child') !== (u.age < 16)) sim.refreshLook(u); }
}

export function igniteTile(sim: Sim, x: number, y: number): void {
  const w = sim.world;
  if (!w.inb(x, y)) return;
  const i = y * w.w + x;
  if (TERRAIN[w.terrain[i]].water || w.fire[i] > 0) return;
  w.fire[i] = 1; w.activeFires.add(i);
}

function resolveHit(sim: Sim, u: Unit): void {
  const t = sim.byId.get(u.target);
  if (!t || !t.alive) return;
  if (u.mode === 'chop' || u.mode === 'mine') return;
  const d = Math.hypot(t.x - u.x, t.y - u.y);
  if (d <= MELEE + 0.9) damage(sim, t, attackPower(u), u);
}

/* ---- decisions ------------------------------------------------------------------------------ */
function isFighter(u: Unit): boolean { return u.role === 'soldier' || u.role === 'archer' || u.role === 'knight' || u.role === 'king'; }

function findHostile(sim: Sim, u: Unit, r: number): Unit | null {
  return sim.nearest(u.x, u.y, r, o => hostile(sim, u, o));
}

const BUSY = new Set(['chop', 'mine', 'quarry', 'farm', 'build', 'haul', 'eat', 'forage', 'settle', 'goto', 'patrol']);

function thinkCiv(sim: Sim, u: Unit): void {
  const city = sim.cities.get(u.cityId);
  u.thinkT = 0.5 + sim.rng.next() * 0.8;
  if (u.mode === 'march' || u.mode === 'siege') { // orders from the crown stay in force; only fight what is close
    const foe = findHostile(sim, u, 6);
    if (foe) { u.target = foe.id; u.mode = u.mode === 'siege' ? 'siege' : 'march'; }
    return;
  }
  const foe = findHostile(sim, u, u.def.sight);
  if (foe) {
    const bravery = isFighter(u) ? 1 : u.traits.includes('brave') ? 0.6 : 0.12;
    const stronger = foe.def.dmg * (foe.hp / foe.maxHp) > u.hp * 0.25;
    if (sim.rng.next() < bravery && !(stronger && !isFighter(u))) { u.mode = 'attack'; u.target = foe.id; return; }
    u.mode = 'flee'; u.fleeT = 3; u.target = foe.id; return;
  }
  // hunger outranks chores: idle walkers stop to eat at 62, workers finish their load first unless famished
  const eating = u.mode === 'eat' || u.mode === 'forage' || u.mode === 'haul';
  if (u.hunger > 62 && !eating && (u.hunger > 86 || !BUSY.has(u.mode) || u.mode === 'goto' || u.mode === 'patrol')) {
    if (city && city.stock.food > 0) { const h = city.hall(sim); if (h) { u.mode = 'eat'; u.goalX = h.doorX + 0.5; u.goalY = h.doorY + 0.5; u.path = null; releaseJob(sim, u); return; } }
    const berry = findObj(sim, u, 14, o => o === O.BERRIES);
    if (berry) { u.mode = 'forage'; u.goalX = berry.x + 0.5; u.goalY = berry.y + 0.5; u.path = null; releaseJob(sim, u); return; }
  }
  if (BUSY.has(u.mode)) return; // let the job finish; act() ends it
  if (u.mode === 'attack' || u.mode === 'flee') { u.mode = 'wander'; u.target = 0; }
  if (u.age < 16) { if (city) { const h = city.hall(sim); if (h && sim.rng.chance(0.7)) { wanderNear(sim, u, h.doorX, h.doorY, 6); return; } } u.mode = 'wander'; return; }
  if (!city) {
    if (u.mode === 'settle') return;
    // drifters join the nearest friendly town, or found one with company
    let best: City | null = null, bd = 30 * 30;
    for (const [, c] of sim.cities) if (c.race === u.species && (!u.kingdomId || c.kingdomId === u.kingdomId)) { const d = (c.x - u.x) ** 2 + (c.y - u.y) ** 2; if (d < bd) { bd = d; best = c; } }
    if (best) { u.cityId = best.id; u.kingdomId = best.kingdomId; sim.refreshLook(u); u.mode = 'wander'; return; }
    tryFoundCity(sim, u); wanderLoose(sim, u); return;
  }
  // carrying something? deliver first
  if (u.carry) { const dst = city.dropoff(sim); if (dst) { u.mode = 'haul'; u.goalX = dst.doorX + 0.5; u.goalY = dst.doorY + 0.5; u.path = null; return; } u.carry = null; }
  switch (u.role) {
    case 'woodcutter': return startGather(sim, u, city, 'chop', 16, (o) => isTree(o) && o !== O.DEAD_TREE ? true : o === O.DEAD_TREE);
    case 'miner': return startGather(sim, u, city, 'mine', 18, (o) => o === O.ROCK || o === O.BOULDER || o === O.ORE_IRON || o === O.ORE_COPPER || o === O.ORE_GOLD);
    case 'farmer': return startFarm(sim, u, city);
    case 'builder': return startBuild(sim, u, city);
    case 'soldier': case 'archer': case 'knight': return startPatrol(sim, u, city);
    case 'king': { const h = city.hall(sim); if (h && sim.rng.chance(0.5)) { u.mode = 'goto'; u.goalX = h.doorX + sim.rng.range(-3, 3); u.goalY = h.doorY + sim.rng.range(0, 3); } return; }
    default: break;
  }
  if (sim.rng.chance(0.65)) { // idle hands are never wasted: fetch whichever of wood/stone the town lacks
    if (city.stock.wood <= city.stock.stone * 1.4 + 20) return startGather(sim, u, city, 'chop', 16, o => isTree(o) && o !== O.DEAD_TREE);
    return startGather(sim, u, city, 'mine', 18, o => o === O.ROCK || o === O.BOULDER);
  }
  wanderNear(sim, u, city.x + 0.5, city.y + 0.5, 7 + city.radius * 0.4);
}

function wanderLoose(sim: Sim, u: Unit): void { wanderNear(sim, u, u.x, u.y, 8); }

function wanderNear(sim: Sim, u: Unit, cx: number, cy: number, r: number): void {
  const a = sim.rng.range(0, 6.283), d = sim.rng.range(1.5, r);
  const gx = cx + Math.cos(a) * d, gy = cy + Math.sin(a) * d;
  if (sim.walkable(gx, gy)) { u.mode = 'goto'; u.goalX = gx; u.goalY = gy; u.path = null; }
  else { u.mode = 'wander'; u.thinkT = 0.4; }
}

export function findObj(sim: Sim, u: Unit, r: number, pred: (o: number) => boolean, cx = u.x, cy = u.y): { x: number; y: number } | null {
  const w = sim.world, x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w.w - 1, Math.floor(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(w.h - 1, Math.floor(cy + r));
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w.w + x, o = w.obj[i];
    if (o === 0 || !pred(o)) continue;
    if (isTree(o) && w.objAge[i] < 170) continue; // let saplings grow
    const d = (x - u.x) ** 2 + (y - u.y) ** 2 + hash2(x, y, 3) * 4;
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}

function startGather(sim: Sim, u: Unit, city: City, mode: 'chop' | 'mine', r: number, pred: (o: number) => boolean): void {
  const t = findObj(sim, u, r, pred, city.x, city.y) ?? findObj(sim, u, r * 0.7, pred);
  if (!t && mode === 'mine') { // no loose stone nearby: work the mountain face
    const q = findQuarry(sim, city.x, city.y, 26, u);
    if (q) { u.mode = 'quarry'; u.goalX = q.x + 0.5; u.goalY = q.y + 0.5; u.jobT = 0; u.path = null; return; }
  }
  if (!t) { wanderNear(sim, u, city.x + 0.5, city.y + 0.5, 8); return; }
  u.mode = mode; u.goalX = t.x + 0.5; u.goalY = t.y + 0.5; u.jobT = 0; u.path = null; u.job = 0;
}

/** A walkable tile touching a mountain or hill face, near (cx,cy): somewhere to cut stone from the rock itself. */
function findQuarry(sim: Sim, cx: number, cy: number, r: number, u: Unit): { x: number; y: number } | null {
  const w = sim.world;
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (let y = Math.max(1, Math.floor(cy - r)); y <= Math.min(w.h - 2, Math.floor(cy + r)); y++) for (let x = Math.max(1, Math.floor(cx - r)); x <= Math.min(w.w - 2, Math.floor(cx + r)); x++) {
    if (!w.isWalkable(x, y) || TERRAIN[w.terrain[y * w.w + x]].water) continue;
    const t = w.terrain[(y - 1) * w.w + x];
    if (t !== T.MOUNTAIN && t !== T.PEAK) continue; // the face is north of where one stands
    const d = (x - cx) ** 2 + (y - cy) ** 2 + (x - u.x) ** 2 * 0.3 + hash2(x, y, 7) * 30;
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}

function startFarm(sim: Sim, u: Unit, city: City): void {
  let best: Building | null = null, bs = -1;
  for (const id of city.buildings) {
    const b = sim.buildings.get(id);
    if (!b || b.type !== 'farm' || !b.done || b.ruin || b.workers >= b.def.slots) continue;
    const s = b.crop + 0.3 - Math.hypot(b.cx - u.x, b.cy - u.y) * 0.01;
    if (s > bs) { bs = s; best = b; }
  }
  if (!best) { wanderNear(sim, u, city.x + 0.5, city.y + 0.5, 7); return; }
  best.workers++; u.job = best.id; u.mode = 'farm'; u.goalX = best.cx; u.goalY = best.cy; u.jobT = 0; u.path = null;
}

function startBuild(sim: Sim, u: Unit, city: City): void {
  let best: Building | null = null, bd = Infinity;
  for (const id of city.buildings) {
    const b = sim.buildings.get(id);
    if (!b || b.ruin) continue;
    const need = !b.done || b.hp < b.maxHp * 0.7;
    if (!need) continue;
    const d = Math.hypot(b.cx - u.x, b.cy - u.y) + b.workers * 6;
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) { wanderNear(sim, u, city.x + 0.5, city.y + 0.5, 6); return; }
  best.workers++; u.job = best.id; u.mode = 'build'; u.goalX = best.doorX + 0.5; u.goalY = best.doorY + 0.5; u.jobT = 0; u.path = null;
}

function startPatrol(sim: Sim, u: Unit, city: City): void {
  const h = city.hall(sim);
  const cx = h ? h.doorX : city.x, cy = h ? h.doorY : city.y;
  u.mode = 'patrol';
  const a = sim.rng.range(0, 6.283), d = sim.rng.range(3, 5 + city.radius * 0.6);
  u.goalX = cx + Math.cos(a) * d; u.goalY = cy + Math.sin(a) * d; u.path = null;
}

/* ---- acting --------------------------------------------------------------------------------- */
function releaseJob(sim: Sim, u: Unit): void {
  if (u.job) { const b = sim.buildings.get(u.job); if (b && b.workers > 0) b.workers--; u.job = 0; }
}

function act(sim: Sim, u: Unit, dt: number): void {
  const city = sim.cities.get(u.cityId);
  const idleAct = (): void => setAct(u, 'idle');
  switch (u.mode) {
    case 'wander': { idleAct(); u.state = 'idle'; return; }
    case 'goto': case 'patrol': {
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, u.mode === 'patrol' ? 0.8 : 0.85);
      if (m === 'moving') { setAct(u, u.carry ? 'carry' : 'walk'); u.state = 'walk'; }
      else { u.mode = 'wander'; u.thinkT = sim.rng.range(0.8, 3); idleAct(); u.state = 'idle'; }
      return;
    }
    case 'eat': {
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 1, 1.0);
      if (m === 'moving') { setAct(u, 'walk'); return; }
      if (m === 'blocked') { u.mode = 'wander'; return; }
      setAct(u, 'eat'); u.state = 'eat';
      if (u.actT > 1.3) { if (city && city.stock.food > 0) { city.stock.food -= 1; u.hunger = Math.max(0, u.hunger - 65); } u.mode = 'wander'; u.thinkT = 0.2; }
      return;
    }
    case 'forage': {
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 1, 0.8);
      if (m === 'moving') { setAct(u, 'walk'); return; }
      const tx = Math.floor(u.goalX), ty = Math.floor(u.goalY), i = ty * sim.world.w + tx;
      if (m === 'arrived' && sim.world.obj[i] === O.BERRIES) { setAct(u, 'eat'); if (u.actT > 1.2) { u.hunger = Math.max(0, u.hunger - 40); sim.world.obj[i] = O.BUSH; u.mode = 'wander'; } return; }
      u.mode = 'wander'; return;
    }
    case 'chop': case 'mine': {
      const tx = Math.floor(u.goalX), ty = Math.floor(u.goalY), w = sim.world, i = ty * w.w + tx;
      const o = w.obj[i];
      if (o === 0) { u.mode = 'wander'; u.thinkT = 0.1; return; }
      const near = Math.hypot(u.goalX - u.x, u.goalY - u.y) < 1.5;
      if (!near) {
        const m = moveTo(sim, u, u.goalX, u.goalY, dt, 1, 1.2);
        if (m === 'moving') { setAct(u, 'walk'); return; }
        if (m === 'blocked' && Math.hypot(u.goalX - u.x, u.goalY - u.y) > 2.5) { u.mode = 'wander'; return; }
      }
      face(u, u.goalX - u.x, u.goalY - u.y);
      setAct(u, u.mode === 'chop' ? 'chop' : 'mine'); u.state = 'work';
      u.jobT += dt;
      if (u.jobT > 3.4) {
        u.jobT = 0;
        const od = OBJECTS[o];
        if (u.mode === 'chop' && isTree(o)) { u.carry = { good: 'wood', n: od.yield }; w.obj[i] = O.STUMP; w.objAge[i] = 255; sim.fx.push({ t: 'leaf', x: tx + 0.5, y: ty + 0.5 }); }
        else if (u.mode === 'mine') {
          const good = o === O.ORE_GOLD ? 'gold' : o === O.ORE_IRON || o === O.ORE_COPPER ? 'ore' : 'stone';
          u.carry = { good, n: Math.min(od.yield, 5) };
          if (good === 'stone') w.obj[i] = 0; else { const left = w.objAge[i] - 70; if (left <= 0) w.obj[i] = 0; else w.objAge[i] = left; }
          sim.fx.push({ t: 'spark', x: tx + 0.5, y: ty + 0.5 });
        } else { w.obj[i] = 0; }
        u.mode = 'wander'; u.thinkT = 0.05;
      }
      return;
    }
    case 'quarry': {
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 1, 0.6);
      if (m === 'moving') { setAct(u, 'walk'); return; }
      if (m === 'blocked') { u.mode = 'wander'; return; }
      u.dir = 'N'; setAct(u, 'mine'); u.state = 'work'; u.jobT += dt;
      if (u.jobT > 3.4) { u.jobT = 0; u.carry = { good: 'stone', n: 4 }; sim.fx.push({ t: 'spark', x: u.x, y: u.y - 0.8 }); u.mode = 'wander'; u.thinkT = 0.05; }
      return;
    }
    case 'haul': {
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 0.95, 1.2);
      if (m === 'moving') { setAct(u, 'carry'); u.state = 'walk'; return; }
      if (city && u.carry) { city.deposit(u.carry); sim.fx.push({ t: 'coin', x: u.x, y: u.y - 0.6 }); }
      u.carry = null; u.mode = 'wander'; u.thinkT = 0.1; return;
    }
    case 'farm': {
      const b = sim.buildings.get(u.job);
      if (!b || b.ruin) { releaseJob(sim, u); u.mode = 'wander'; return; }
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 0.9, 0.5);
      if (m === 'moving') { setAct(u, 'walk'); return; }
      setAct(u, 'farm'); u.state = 'work';
      b.crop = Math.min(1, b.crop + dt * 0.012);
      u.jobT += dt;
      if (u.jobT > 5.5) {
        u.jobT = 0;
        if (b.crop >= 0.7) { u.carry = { good: 'food', n: Math.round(6 + b.crop * 6) }; b.crop = 0.05; releaseJob(sim, u); u.mode = 'wander'; u.thinkT = 0.05; }
      }
      return;
    }
    case 'build': {
      const b = sim.buildings.get(u.job);
      if (!b || b.ruin) { releaseJob(sim, u); u.mode = 'wander'; return; }
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 1, 1.1);
      if (m === 'moving') { setAct(u, 'walk'); return; }
      if (m === 'blocked') { releaseJob(sim, u); u.mode = 'wander'; return; }
      face(u, b.cx - u.x, b.cy - u.y);
      setAct(u, 'hammer'); u.state = 'work';
      if (!b.done) {
        b.progress = Math.min(1, b.progress + dt / b.def.build);
        if (b.done) { sim.fx.push({ t: 'dust', x: b.cx, y: b.cy, a: b.def.w }); sim.zoneVer++; city?.onBuilt(sim, b); releaseJob(sim, u); u.mode = 'wander'; u.thinkT = 0.1; }
        else if (hash2(sim.tickN, u.id, 8) < 0.04) sim.fx.push({ t: 'dust', x: b.x + hash2(sim.tickN, u.id, 1) * b.def.w, y: b.y + b.def.h - 0.3, a: 1 });
      } else if (b.hp < b.maxHp) {
        b.hp = Math.min(b.maxHp, b.hp + dt * 18);
        if (b.hp >= b.maxHp) { releaseJob(sim, u); u.mode = 'wander'; u.thinkT = 0.1; }
      } else { releaseJob(sim, u); u.mode = 'wander'; }
      return;
    }
    case 'flee': {
      u.fleeT -= dt;
      const foe = sim.byId.get(u.target);
      if (!foe || u.fleeT <= 0) { u.mode = 'wander'; u.target = 0; u.thinkT = 0.2; return; }
      const dx = u.x - foe.x, dy = u.y - foe.y, l = Math.hypot(dx, dy) || 1;
      const m = moveTo(sim, u, u.x + (dx / l) * 5, u.y + (dy / l) * 5, dt, 1.45, 0.4);
      if (m === 'moving') { setAct(u, 'run'); u.state = 'walk'; } else { idleAct(); }
      return;
    }
    case 'attack': case 'march': case 'siege': {
      const t = sim.byId.get(u.target);
      if (!t || !t.alive || !hostile(sim, u, t)) {
        u.target = 0;
        if (u.mode === 'attack') { u.mode = 'wander'; u.thinkT = 0.1; idleAct(); return; }
        return marchOn(sim, u, dt);
      }
      return fightTarget(sim, u, t, dt);
    }
    case 'settle': {
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 0.9, 2);
      if (m === 'moving') { setAct(u, 'walk'); u.state = 'walk'; return; }
      if (m === 'blocked') { u.mode = 'wander'; return; }
      u.mode = 'wander'; u.thinkT = 0; tryFoundCity(sim, u, true); return;
    }
    case 'graze': { setAct(u, 'eat'); if (u.actT > 2.4) { u.hunger = Math.max(0, u.hunger - 28); u.mode = 'wander'; u.thinkT = 0.2; } return; }
    case 'dragon': return actDragon(sim, u, dt);
    case 'dead': return;
    default: u.mode = 'wander';
  }
}

/** Soldiers on campaign with no target: head for the goal the crown set. */
function marchOn(sim: Sim, u: Unit, dt: number): void {
  const m = moveTo(sim, u, u.goalX, u.goalY, dt, 1.0, 1.5);
  if (m === 'moving') { setAct(u, 'walk'); u.state = 'walk'; return; }
  setAct(u, 'idle'); u.state = 'idle';
  if (u.mode === 'siege') {
    // at the walls with nobody to fight: hammer the nearest enemy building
    const b = nearestEnemyBuilding(sim, u, 14);
    if (b) { u.goalX = b.doorX + 0.5; u.goalY = b.doorY + 0.5 + (hash2(u.id, 1, 2) - 0.5) * 2; u.jobT = b.id; siegeBuilding(sim, u, b, dt); }
  }
}

export function nearestEnemyBuilding(sim: Sim, u: Unit, r: number): Building | null {
  const k = sim.kingdoms.get(u.kingdomId);
  if (!k) return null;
  let best: Building | null = null, bd = r * r;
  for (const [, b] of sim.buildings) {
    if (b.ruin) continue;
    const c = sim.cities.get(b.cityId);
    if (!c || !k.wars.has(c.kingdomId)) continue;
    const d = (b.cx - u.x) ** 2 + (b.cy - u.y) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function siegeBuilding(sim: Sim, u: Unit, b: Building, dt: number): void {
  const d = Math.hypot(b.cx - u.x, b.cy - u.y);
  if (d > b.def.w / 2 + 1.6) { moveTo(sim, u, b.doorX + 0.5, b.doorY + 0.5, dt, 1, 1.2); setAct(u, 'run'); return; }
  face(u, b.cx - u.x, b.cy - u.y);
  if (u.attackCd <= 0) {
    u.attackCd = 1.1; setAct(u, 'attack'); u.hitT = 0;
    b.hp -= attackPower(u) * 1.5; b.hurtT = 0.2;
    sim.fx.push({ t: 'spark', x: b.cx + (hash2(sim.tickN, u.id, 3) - 0.5) * b.def.w, y: b.y + b.def.h - 0.4 });
    if (b.hp <= 0) sim.destroyBuilding(b, u);
  }
}

function fightTarget(sim: Sim, u: Unit, t: Unit, dt: number): void {
  const dx = t.x - u.x, dy = t.y - u.y, dist = Math.hypot(dx, dy);
  face(u, dx, dy);
  const ranged = u.look?.weapon === 'bow';
  if (ranged && dist < 8.5 && dist > 2.2) {
    setAct(u, 'shoot'); u.state = 'fight'; u.path = null;
    if (u.attackCd <= 0) { u.attackCd = 1.7; u.actT = 0; u.shootT = 0.5; }
    if (u.shootT >= 0) { u.shootT -= dt; if (u.shootT < 0) shoot(sim, u, t); }
    return;
  }
  if (ranged && dist <= 2.2) { // back away from melee
    moveTo(sim, u, u.x - dx * 2, u.y - dy * 2, dt, 1.1, 0.3); setAct(u, 'run'); return;
  }
  if (dist > MELEE) {
    const m = moveTo(sim, u, t.x, t.y, dt, 1.18, MELEE * 0.9);
    if (m === 'blocked') { u.pathFail++; if (u.pathFail > 3) { u.target = 0; u.mode = u.mode === 'attack' ? 'wander' : u.mode; } }
    setAct(u, 'run'); u.state = 'fight'; return;
  }
  u.state = 'fight'; u.path = null;
  if (u.attackCd <= 0) {
    u.attackCd = 1.0 + hash2(sim.tickN, u.id, 4) * 0.3; setAct(u, 'attack'); u.hitT = 0.3;
    if (u.species === 'dragon') { u.hitT = 0.4; }
  } else if (u.act !== 'attack' || u.actT > 0.7) setAct(u, 'idle');
}
