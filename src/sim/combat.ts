import type { Sim, Arrow } from './sim';
import type { Unit } from './unit';
import { SPECIES } from './species';
import { hash2 } from '../core/rng';

/** Who may hurt whom. One rule, used by every AI. */
export function hostile(sim: Sim, a: Unit, b: Unit): boolean {
  if (a === b || !a.alive || !b.alive) return false;
  const da = a.def, db = b.def;
  if (a.kingdomId && b.kingdomId) return a.kingdomId !== b.kingdomId && sim.kingdoms.get(a.kingdomId)?.wars.has(b.kingdomId) === true;
  if (a.species === 'zombie') return b.species !== 'zombie';
  if (b.species === 'zombie') return da.civ || da.aggressive === true && db.civ;
  if (da.civ && db.civ) {
    if (!a.kingdomId || !b.kingdomId || a.kingdomId === b.kingdomId) return false;
    return sim.kingdoms.get(a.kingdomId)?.wars.has(b.kingdomId) === true;
  }
  if (da.civ) return db.aggressive === true && b.species !== 'crab';
  if (db.civ) return da.aggressive === true && a.species !== 'crab';
  if (da.aggressive && db.diet === 'herb' && (da.diet === 'carn' || a.species === 'bear')) return true;
  if (a.species === 'dragon') return b.species !== 'dragon';
  if (b.species === 'dragon') return false;
  return false;
}

export function attackPower(u: Unit): number {
  let d = u.def.dmg;
  const l = u.look;
  if (l) {
    d += l.weapon === 'sword' ? 5 : l.weapon === 'spear' ? 4 : l.weapon === 'axe' ? 5 : l.weapon === 'bow' ? 5 : l.weapon === 'hammer' ? 3 : l.weapon === 'pickaxe' ? 3 : l.weapon === 'club' ? 3 : 0;
    if (l.armor === 3) d += 2;
  }
  if (u.traits.includes('strong')) d *= 1.4;
  return d * (u.age < 16 ? 0.4 : 1);
}
export function armorOf(u: Unit): number {
  let a = u.def.armor;
  if (u.look) a += u.look.armor === 1 ? 1.5 : u.look.armor === 2 ? 3.5 : u.look.armor === 3 ? 6 : 0;
  if (u.look?.shield) a += 1.5;
  return a;
}

export function damage(sim: Sim, target: Unit, raw: number, from: Unit | null): void {
  if (!target.alive) return;
  const dmg = Math.max(1, raw * (0.85 + hash2(sim.tickN, target.id, 3) * 0.3) - armorOf(target) * 0.9);
  target.hp -= dmg; target.hurtT = 0.18;
  sim.fx.push({ t: 'hit', x: target.x, y: target.y - 0.4 });
  if (target.def.civ || target.def.diet !== 'none') sim.fx.push({ t: 'blood', x: target.x, y: target.y - 0.3 });
  if (from) {
    const dx = target.x - from.x, dy = target.y - from.y, l = Math.hypot(dx, dy) || 1;
    const nx = target.x + (dx / l) * 0.18, ny = target.y + (dy / l) * 0.18;
    if (sim.walkable(nx, ny)) { target.x = nx; target.y = ny; }
    if (target.mode !== 'attack' && target.mode !== 'flee' && !target.def.civ) { target.target = from.id; target.mode = target.def.skittish ? 'flee' : 'attack'; target.fleeT = 3; }
    if (target.def.civ && !target.target) target.target = from.id;
  }
  if (target.hp <= 0) kill(sim, target, from);
}

export function kill(sim: Sim, u: Unit, by: Unit | null, why = ''): void {
  if (!u.alive) return;
  u.state = 'dead'; u.act = 'die'; u.actT = 0; u.stateT = 0; u.path = null; u.mode = 'dead'; u.hp = 0;
  sim.stats.deaths++;
  if (by) {
    by.kills++; sim.stats.kills++;
    const f = u.def.food;
    if (f > 0 && by.def.civ && by.def.diet !== 'herb') by.carry = { good: 'food', n: f };
    if (by.def.diet === 'carn' || by.def.diet === 'omni') by.hunger = Math.max(0, by.hunger - f * 9);
    if (by.target === u.id) by.target = 0;
  }
  if (u.def.civ) {
    sim.fx.push({ t: 'blood', x: u.x, y: u.y - 0.3 });
    const k = sim.kingdoms.get(u.kingdomId);
    if (k && k.king === u.id) { sim.note(`${k.name}: o rei ${u.name} morreu${by ? ` (${by.def.name})` : why ? ` (${why})` : ''}.`, 'death'); k.king = 0; }
  }
  if (u.species === 'dragon') sim.note('Um dragão foi abatido!', 'death');
  // the dead rise: a zombie's victim, or the plague's, comes back wrong
  if (u.def.civ && (by?.species === 'zombie' || (u.traits.includes('plague') && sim.rng.chance(0.45)))) { u.stateT = 99; sim.spawn('zombie', u.x, u.y); }
}

/** A catapult stone: slow, high, and it breaks things where it lands. */
export function lob(sim: Sim, from: Unit, tx: number, ty: number): void {
  const dist = Math.hypot(tx - from.x, ty - from.y);
  sim.arrows.push({ x: from.x, y: from.y - 0.8, tx, ty, t: 0, dur: Math.max(0.6, dist / 7), dmg: -1, from: from.id, kingdom: from.kingdomId, z: 1 });
  sim.fx.push({ t: 'boom', x: from.x, y: from.y - 0.4, a: 0.2 });
}

export function shoot(sim: Sim, from: Unit, target: Unit): void {
  const dx = target.x - from.x, dy = target.y - from.y, dist = Math.hypot(dx, dy);
  const lead = Math.min(1.2, dist * 0.05);
  const a: Arrow = { x: from.x, y: from.y - 0.5, tx: target.x + (target.x - target.px) * lead * 8, ty: target.y + (target.y - target.py) * lead * 8, t: 0, dur: Math.max(0.25, dist / 14), dmg: attackPower(from) * 0.9, from: from.id, kingdom: from.kingdomId, z: 0 };
  sim.arrows.push(a);
  sim.fx.push({ t: 'arrow', x: from.x, y: from.y - 0.5 });
}
export const MELEE = 1.2;
export const speciesName = (u: Unit): string => SPECIES[u.species].name;

/** Arrows fly for `dur` seconds; on landing they hurt the nearest foe of the shooter's kingdom (or of the shooter). */
export function updateArrows(sim: Sim, dt: number): void {
  const arr = sim.arrows;
  for (let i = arr.length - 1; i >= 0; i--) {
    const a = arr[i];
    a.t += dt;
    if (a.t < a.dur) continue;
    arr[i] = arr[arr.length - 1]; arr.pop();
    const shooter = sim.byId.get(a.from);
    const k = sim.kingdoms.get(a.kingdom);
    if (a.z === 1) { // stone: area damage to people and buildings of the enemy
      sim.fx.push({ t: 'rubble', x: a.tx, y: a.ty }); sim.fx.push({ t: 'boom', x: a.tx, y: a.ty, a: 0.3 });
      sim.near(a.tx, a.ty, 2.2, o => { if (o.alive && k && o.kingdomId && o.kingdomId !== a.kingdom && k.wars.has(o.kingdomId)) damage(sim, o, 55, shooter ?? null); });
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const bi = sim.world.bld[(Math.floor(a.ty) + j) * sim.world.w + Math.floor(a.tx) + i]; if (!bi) continue; const b = sim.buildings.get(bi), c = b && sim.cities.get(b.cityId); if (b && c && k?.wars.has(c.kingdomId)) { b.hp -= 45; b.hurtT = 0.25; if (b.hp <= 0) sim.destroyBuilding(b, shooter ?? null); } }
      continue;
    }
    const victim = sim.nearest(a.tx, a.ty, 1.1, o => o.alive && (shooter ? hostile(sim, shooter, o) : (k ? (o.kingdomId !== a.kingdom && k.wars.has(o.kingdomId)) || o.species === 'zombie' || o.species === 'dragon' : false)));
    if (victim) damage(sim, victim, a.dmg, shooter ?? null);
    else sim.fx.push({ t: 'dust', x: a.tx, y: a.ty, a: 0.3 });
  }
}
