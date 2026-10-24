import type { Sim } from './sim';
import type { Unit } from './unit';
import { SPECIES } from './species';
import { TERRAIN, T } from '../world/defs';
import { hostile, damage } from './combat';
import { moveTo, setAct, igniteTile } from './ai';
import { hash2 } from '../core/rng';

/** Wildlife decisions. Civilised units live in ai.ts; everything else lands here. */
export function thinkAnimal(sim: Sim, u: Unit): void {
  const d = u.def;
  u.thinkT = 0.45 + sim.rng.next() * 0.7;
  if (u.species === 'dragon') return thinkDragon(sim, u);
  if (u.species === 'zombie') {
    const f = sim.nearest(u.x, u.y, d.sight, o => hostile(sim, u, o));
    if (f) { u.target = f.id; u.mode = 'attack'; } else if (u.mode === 'attack') u.mode = 'wander';
    if (u.mode !== 'attack') wander(sim, u, 6);
    return;
  }
  if (u.mode === 'attack' || u.mode === 'flee') {
    const t = sim.byId.get(u.target);
    if (t && t.alive && u.fleeT > 0) { u.fleeT -= 0.5; return; }
    u.mode = 'wander'; u.target = 0;
  }
  // skittish animals bolt from anything dangerous nearby
  if (d.skittish) {
    const threat = sim.nearest(u.x, u.y, d.sight * 0.75, o => o !== u && (o.def.civ && o.age > 6 || (o.def.aggressive === true && o.def.dmg > 0 && o.species !== 'crab' && o.species !== 'snake')));
    if (threat) { u.mode = 'flee'; u.target = threat.id; u.fleeT = 3.2; return; }
  }
  // predators and the bad-tempered
  if (d.aggressive) {
    const hungry = u.hunger > 35 || d.diet === 'none' || u.species === 'boar' || u.species === 'snake';
    const reach = hungry ? d.sight : 3;
    const prey = sim.nearest(u.x, u.y, reach, o => hostile(sim, u, o) && !(o.species === 'dragon'));
    if (prey) { u.mode = 'attack'; u.target = prey.id; u.fleeT = 6; return; }
  }
  breed(sim, u);
  if (d.fly) { // birds just drift around
    const a = sim.rng.range(0, 6.283), r = sim.rng.range(4, 14);
    u.goalX = Math.max(1, Math.min(sim.world.w - 2, u.x + Math.cos(a) * r)); u.goalY = Math.max(1, Math.min(sim.world.h - 2, u.y + Math.sin(a) * r)); u.mode = 'goto'; return;
  }
  if (d.diet === 'herb' && u.hunger > 30 && sim.rng.chance(0.5)) { u.mode = 'graze'; u.path = null; return; }
  if (sim.rng.chance(0.25)) { setAct(u, 'idle'); u.mode = 'wander'; u.thinkT = sim.rng.range(1, 3.5); return; }
  wander(sim, u, d.herd ? 5 : 8);
}

function wander(sim: Sim, u: Unit, r: number): void {
  let cx = u.x, cy = u.y;
  if (u.def.herd) { // drift toward a herd-mate so groups hold together
    const mate = sim.nearest(u.x, u.y, 12, o => o !== u && o.species === u.species);
    if (mate && Math.hypot(mate.x - u.x, mate.y - u.y) > 3) { cx = mate.x; cy = mate.y; }
  }
  const a = sim.rng.range(0, 6.283), dd = sim.rng.range(1, r);
  const gx = cx + Math.cos(a) * dd, gy = cy + Math.sin(a) * dd;
  const t = sim.world.t(Math.floor(gx), Math.floor(gy));
  if (sim.walkable(gx, gy) && (u.species !== 'crab' || t === T.SAND) && (u.species !== 'snake' || t !== T.SHALLOW) && !(TERRAIN[t].water && u.def.diet === 'herb')) { u.mode = 'goto'; u.goalX = gx; u.goalY = gy; u.path = null; }
  else u.mode = 'wander';
}

function breed(sim: Sim, u: Unit): void {
  const d = u.def;
  if (d.breed <= 0 || u.age < d.maxAge * 0.15 || u.hunger > 70) return;
  u.breedT += u.thinkT;
  if (u.breedT < d.breed * (0.7 + hash2(u.id, 4, 4) * 0.6)) return;
  u.breedT = 0;
  const land = sim.landTiles || 1;
  const cap = Math.max(2, (d.cap * land) / 1000);
  if ((sim.counts[u.species] ?? 0) >= cap) return;
  let crowd = 0;
  sim.near(u.x, u.y, 8, o => { if (o.species === u.species) crowd++; });
  if (crowd > 7) return;
  const spot = sim.freeSpot(u.x, u.y, 2);
  if (!spot) return;
  const kid = sim.spawn(u.species, spot.x, spot.y, { age: 0 });
  sim.counts[u.species] = (sim.counts[u.species] ?? 0) + 1;
  sim.fx.push({ t: 'heart', x: u.x, y: u.y - 0.8 });
  void kid;
}

/* ---- dragon ----------------------------------------------------------------------------------- */
function thinkDragon(sim: Sim, u: Unit): void {
  u.mode = 'dragon';
  const t = sim.byId.get(u.target);
  if (t && t.alive && Math.hypot(t.x - u.x, t.y - u.y) < 40) return;
  const prey = sim.nearest(u.x, u.y, 26, o => o.species !== 'dragon' && o.alive && (o.def.civ || o.species === 'zombie' || o.def.diet === 'herb'));
  if (prey) { u.target = prey.id; return; }
  u.target = 0;
  const a = sim.rng.range(0, 6.283), r = sim.rng.range(10, 30);
  u.goalX = Math.max(3, Math.min(sim.world.w - 4, u.x + Math.cos(a) * r)); u.goalY = Math.max(3, Math.min(sim.world.h - 4, u.y + Math.sin(a) * r));
}

export function actDragon(sim: Sim, u: Unit, dt: number): void {
  const t = sim.byId.get(u.target);
  if (!t || !t.alive) {
    const m = moveTo(sim, u, u.goalX, u.goalY, dt, 0.55, 1.5);
    setAct(u, 'fly'); u.state = 'walk';
    if (m === 'arrived') u.thinkT = 0;
    return;
  }
  const dx = t.x - u.x, dy = t.y - u.y, dist = Math.hypot(dx, dy);
  if (dist > 7) { moveTo(sim, u, t.x, t.y, dt, 1, 6); setAct(u, 'fly'); u.state = 'walk'; return; }
  // hover and breathe: a cone of fire toward the target
  setAct(u, 'breath'); u.state = 'fight';
  if (Math.abs(dx) > 0.3) { u.east = dx > 0; u.dir = dx > 0 ? 'E' : 'W'; }
  u.breathT += dt;
  if (u.breathT >= 0.25) {
    u.breathT = 0;
    const l = dist || 1, ux = dx / l, uy = dy / l;
    for (let k = 1; k <= 6; k++) {
      const px = u.x + ux * k * 1.1 + (hash2(sim.tickN, k, 1) - 0.5) * 1.6, py = u.y + uy * k * 1.1 + (hash2(sim.tickN, k, 2) - 0.5) * 1.6;
      sim.fx.push({ t: 'fire', x: px, y: py, a: 1 });
      igniteTile(sim, Math.floor(px), Math.floor(py));
      sim.near(px, py, 1.3, o => { if (o !== u && o.alive && o.species !== 'dragon' && hash2(sim.tickN, o.id, k) < 0.5) { damage(sim, o, 14, u); o.burning = 4; } });
      const bi = sim.world.bld[Math.floor(py) * sim.world.w + Math.floor(px)];
      if (bi) { const b = sim.buildings.get(bi); if (b) { b.hp -= 22; b.burning = 8; b.hurtT = 0.2; if (b.hp <= 0) sim.destroyBuilding(b, u); } }
    }
  }
}
void SPECIES;
