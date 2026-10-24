import type { Sim } from './sim';
import type { Unit } from './unit';
import type { Building } from './buildings';
import type { Kingdom } from './kingdom';
import { moveTo, setAct, face } from './ai';
import { lob } from './combat';
import { hostile } from './combat';
import { hash2 } from '../core/rng';

/** Engines belong to a realm at war. They are built at the capital, travel with the army, and break walls — not people. */
export function thinkEngine(sim: Sim, u: Unit): void {
  u.thinkT = 0.8 + sim.rng.next() * 0.5;
  const k = sim.kingdoms.get(u.kingdomId);
  if (!k || !k.wars.size) { u.idleT = (u.idleT ?? 0) + 1; if (u.idleT > 40) { u.hp = 0; u.state = 'dead'; u.stateT = 9; sim.fx.push({ t: 'rubble', x: u.x, y: u.y }); } return; }
  u.idleT = 0;
  const b = sim.buildings.get(u.job);
  if (b && !b.ruin && enemyOf(sim, k, b)) return;
  u.job = 0;
  // pick the nearest enemy building; the catapult also happily shells a crowd
  let best: Building | null = null, bd = (u.species === 'catapult' ? 34 : 40) ** 2;
  for (const bb of sim.buildings.values()) {
    if (bb.ruin || !enemyOf(sim, k, bb)) continue;
    const d = (bb.cx - u.x) ** 2 + (bb.cy - u.y) ** 2;
    if (d < bd) { bd = d; best = bb; }
  }
  if (best) { u.job = best.id; return; }
  // nothing to break: follow the army's staging point
  if (k.army) { u.goalX = k.army.rx; u.goalY = k.army.ry; u.mode = 'engine-move'; }
}

function enemyOf(sim: Sim, k: Kingdom, b: Building): boolean {
  const c = sim.cities.get(b.cityId);
  return !!c && k.wars.has(c.kingdomId);
}

export function actEngine(sim: Sim, u: Unit, dt: number): void {
  const k = sim.kingdoms.get(u.kingdomId);
  const b = sim.buildings.get(u.job);
  if (!k || !b || b.ruin) {
    if (u.mode === 'engine-move') { const m = moveTo(sim, u, u.goalX, u.goalY, dt, 1, 3); setAct(u, m === 'moving' ? 'walk' : 'idle'); if (m !== 'moving') u.mode = 'engine'; return; }
    setAct(u, 'idle'); return;
  }
  u.mode = 'engine';
  const dx = b.cx - u.x, dy = b.cy - u.y, dist = Math.hypot(dx, dy), edge = dist - b.def.w / 2;
  face(u, dx, dy);
  if (u.species === 'ram') {
    if (edge > 1.7) { const m = moveTo(sim, u, b.doorX + 0.5, b.doorY + 0.8, dt, 1, 1.2); setAct(u, 'walk'); u.state = 'walk'; if (m === 'blocked') u.job = 0; return; }
    u.state = 'fight'; u.path = null;
    if (u.attackCd <= 0) { u.attackCd = 1.8; setAct(u, 'attack'); u.hitT = 0.5; u.shootT = 0.5; }
    if (u.shootT >= 0) { u.shootT -= dt; if (u.shootT < 0) { b.hp -= 70; b.hurtT = 0.3; sim.fx.push({ t: 'rubble', x: b.cx + (hash2(sim.tickN, u.id, 1) - 0.5) * b.def.w * 0.6, y: b.y + b.def.h - 0.2 }); sim.fx.push({ t: 'dust', x: b.cx, y: b.y + b.def.h, a: 0.6 }); if (b.hp <= 0) sim.destroyBuilding(b, u); } }
    else if (u.act === 'attack' && u.actT > 1.0) setAct(u, 'idle');
    return;
  }
  // catapult: close to 8–11 tiles, then lob stones
  if (dist > 11.5) { const m = moveTo(sim, u, b.cx - (dx / dist) * 9, b.cy - (dy / dist) * 9, dt, 1, 1); setAct(u, 'walk'); u.state = 'walk'; if (m === 'blocked') u.job = 0; return; }
  u.state = 'fight'; u.path = null;
  if (u.attackCd <= 0) { u.attackCd = 3.4; setAct(u, 'attack'); u.shootT = 0.55; }
  if (u.shootT >= 0) { u.shootT -= dt; if (u.shootT < 0) lob(sim, u, b.cx + (hash2(sim.tickN, u.id, 2) - 0.5) * 2, b.cy + (hash2(sim.tickN, u.id, 3) - 0.5) * 1.6); }
  else if (u.act === 'attack' && u.actT > 1.1) setAct(u, 'idle');
}

/** The realm commissions engines at its capital while its army is on campaign. */
export function buildEngines(sim: Sim, k: Kingdom, soldiers: number): void {
  if (soldiers < 6 || sim.time < k.engineT) return;
  const cap = sim.cities.get(k.capital);
  if (!cap) return;
  let rams = 0, cats = 0;
  for (const u of sim.units) if (u.kingdomId === k.id && u.alive) { if (u.species === 'ram') rams++; else if (u.species === 'catapult') cats++; }
  const wantRams = Math.min(3, Math.floor(soldiers / 7)), wantCats = soldiers >= 12 ? 1 + (soldiers >= 24 ? 1 : 0) : 0;
  const kind = rams < wantRams ? 'ram' : cats < wantCats ? 'catapult' : null;
  if (!kind) return;
  const cost = kind === 'ram' ? 22 : 30;
  if (cap.stock.wood < cost) return;
  const h = cap.hall(sim);
  const spot = sim.freeSpot(h ? h.doorX + 0.5 : cap.x, h ? h.doorY + 1.5 : cap.y, 4);
  if (!spot) return;
  cap.stock.wood -= cost; k.engineT = sim.time + 14;
  const e = sim.spawn(kind, spot.x, spot.y, { kingdom: k.id, city: cap.id });
  e.mode = 'engine'; e.east = false;
  sim.fx.push({ t: 'dust', x: spot.x, y: spot.y, a: 1 });
}
export { hostile };
