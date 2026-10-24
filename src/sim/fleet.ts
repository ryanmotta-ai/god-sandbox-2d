import type { Sim } from './sim';
import type { Unit } from './unit';
import type { City } from './city';
import type { Building } from './buildings';
import type { ShipKind } from './species';
import { hostile, damage, lob } from './combat';
import { setAct } from './ai';
import { homeDock, sailTo, geo, landRiders } from './navy';
import { TERRAIN } from '../world/defs';
import { hash2 } from '../core/rng';

/** The fighting fleet: rams ships and piers, shoots shore parties, and lobs stones from the big hulls. */
export const WAR_KINDS: ShipKind[] = ['longship', 'galley', 'galleon'];
const isWater = (b: Building): boolean => b.type === 'dock' || b.type === 'shipyard';

function enemyBuilding(sim: Sim, u: Unit, b: Building): boolean {
  const c = sim.cities.get(b.cityId), k = sim.kingdoms.get(u.kingdomId);
  return !!c && !!k && k.wars.has(c.kingdomId);
}

export function thinkWarship(sim: Sim, u: Unit, c: City): void {
  const k = sim.kingdoms.get(u.kingdomId);
  if (u.mission === 'invade' || u.mission === 'return') return;
  if (u.legT > 0) { u.legT -= u.thinkT; return; }
  if (!k || !k.wars.size) { // peacetime: show the flag now and then, otherwise rest at the quay
    if (u.mission === 'patrol' && sim.rng.chance(0.08)) { u.mission = 'return'; return; }
    if (u.mission === 'moor' && sim.rng.chance(0.06)) { u.mission = 'patrol'; u.phase = 0; u.path = null; }
    return;
  }
  if (u.hp < u.maxHp * 0.3 && u.mission !== 'moor') { u.mission = 'return'; u.target = 0; return; }
  if (u.mission === 'hunt') { const t = sim.byId.get(u.target); if (t && t.alive && hostile(sim, u, t)) return; }
  const foe = sim.nearest(u.x, u.y, u.def.sight, o => hostile(sim, u, o) && (o.def.ship || shoreNear(sim, o)));
  if (foe) { u.mission = 'hunt'; u.target = foe.id; u.path = null; return; }
  if (u.mission === 'raid') { const b = sim.buildings.get(u.dest); if (b && !b.ruin) return; }
  // otherwise go looking for an enemy pier on our sea
  const home = homeDock(sim, u), g = geo(sim);
  if (!home) return;
  const sid = g.sea[home.by * sim.world.w + home.bx];
  let best: Building | null = null, bd = 150 * 150;
  for (const b of sim.buildings.values()) {
    if (b.ruin || !isWater(b) || b.bx < 0 || !enemyBuilding(sim, u, b) || g.sea[b.by * sim.world.w + b.bx] !== sid) continue;
    const d = (b.bx - u.x) ** 2 + (b.by - u.y) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  if (best) { u.mission = 'raid'; u.dest = best.id; u.path = null; u.legT = 0; return; }
  if (u.mission !== 'patrol') { u.mission = 'patrol'; u.phase = 0; u.path = null; }
  void c;
}

/** Is this thing on dry land close enough to the water for a ship to shoot at? */
function shoreNear(sim: Sim, o: Unit): boolean {
  const w = sim.world, x = Math.floor(o.x), y = Math.floor(o.y);
  for (let j = -6; j <= 6; j += 2) for (let i = -6; i <= 6; i += 2) if (w.inb(x + i, y + j) && TERRAIN[w.terrain[(y + j) * w.w + x + i]].water) return true;
  return false;
}

export function actWarship(sim: Sim, u: Unit, dt: number): void {
  const home = homeDock(sim, u);
  const go = (x: number, y: number, within = 0.8): boolean => { const m = sailTo(sim, u, x, y, dt, within); setAct(u, m === 'moving' ? 'sail' : 'idle'); u.state = m === 'moving' ? 'walk' : 'idle'; return m === 'moving'; };
  if (u.mission === 'adrift') { setAct(u, 'idle'); return; }
  if (u.mission === 'moor' || !home) { setAct(u, 'idle'); u.state = 'idle'; return; }
  if (u.mission === 'return') { if (!go(home.bx + 0.5, home.by + 0.5)) { landRiders(sim, u, home); u.mission = 'moor'; u.legT = 10; u.target = 0; } return; }
  if (u.mission === 'invade') return; // run by navy.ts
  if (u.mission === 'patrol') {
    if (u.phase === 0) { const a = sim.rng.range(0, 6.283), r = sim.rng.range(5, 16), x = home.bx + Math.cos(a) * r, y = home.by + Math.sin(a) * r, w = sim.world; const i = Math.floor(y) * w.w + Math.floor(x); if (w.inb(Math.floor(x), Math.floor(y)) && TERRAIN[w.terrain[i]].water && !w.bld[i]) { u.goalX = x; u.goalY = y; u.phase = 1; } return; }
    if (!go(u.goalX, u.goalY, 1.2)) { u.phase = 0; u.legT = sim.rng.range(2, 6); }
    return;
  }
  if (u.mission === 'hunt') {
    const t = sim.byId.get(u.target);
    if (!t || !t.alive || !hostile(sim, u, t)) { u.mission = 'patrol'; u.phase = 0; u.target = 0; return; }
    const dist = Math.hypot(t.x - u.x, t.y - u.y);
    const standoff = t.def.ship ? (u.species === 'galleon' ? 9 : 1.5) : 7;
    if (dist > standoff + 0.4) { go(t.x, t.y, standoff); } else { setAct(u, 'idle'); u.state = 'fight'; u.path = null; }
    volley(sim, u, t, dist);
    return;
  }
  if (u.mission === 'raid') {
    const b = sim.buildings.get(u.dest);
    if (!b || b.ruin) { u.mission = 'patrol'; u.phase = 0; return; }
    if (go(b.bx + 0.5, b.by + 0.5, 1.4)) return;
    setAct(u, 'idle'); u.state = 'fight';
    if (u.attackCd <= 0) { u.attackCd = 3; b.hp -= u.def.dmg * 2.2; b.hurtT = 0.3; sim.fx.push({ t: 'rubble', x: b.cx + (hash2(sim.tickN, u.id, 1) - 0.5) * b.def.w * 0.6, y: b.cy }); sim.fx.push({ t: 'boom', x: b.cx, y: b.cy, a: 0.3 }); if (b.hp <= 0) sim.destroyBuilding(b, u); }
  }
}

/** Ram, shoot or lob, whichever the hull and the range allow. */
function volley(sim: Sim, u: Unit, t: Unit, dist: number): void {
  if (u.attackCd > 0) return;
  if (t.def.ship && dist < 2.2) { u.attackCd = 3.4; damage(sim, t, u.def.dmg * 1.9, u); sim.fx.push({ t: 'boom', x: (u.x + t.x) / 2, y: (u.y + t.y) / 2, a: 0.25 }); return; }
  if (u.species === 'galleon' && dist > 3 && dist < 14) { u.attackCd = 4; lob(sim, u, t.x + (hash2(sim.tickN, u.id, 2) - 0.5) * 1.4, t.y + (hash2(sim.tickN, u.id, 3) - 0.5) * 1.2); return; }
  if (dist < 9.5) { u.attackCd = 1.6; sim.arrows.push({ x: u.x, y: u.y - 0.9, tx: t.x + (t.x - t.px) * 4, ty: t.y + (t.y - t.py) * 4, t: 0, dur: Math.max(0.25, dist / 14), dmg: u.species === 'galley' ? 11 : 9, from: u.id, kingdom: u.kingdomId, z: 0 }); sim.fx.push({ t: 'arrow', x: u.x, y: u.y - 0.9 }); }
}
