import type { Sim, Arrow } from './sim';
import type { Unit } from './unit';
import { SPECIES } from './species';
import { hash2 } from '../core/rng';

/** Who may hurt whom. One rule, used by every AI. */
export function hostile(sim: Sim, a: Unit, b: Unit): boolean {
  if (a === b || !a.alive || !b.alive) return false;
  const da = a.def, db = b.def;
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
    const victim = sim.nearest(a.tx, a.ty, 1.1, o => o.alive && (shooter ? hostile(sim, shooter, o) : (k ? o.kingdomId !== a.kingdom && k.wars.has(o.kingdomId) : false)));
    if (victim) damage(sim, victim, a.dmg, shooter ?? null);
    else sim.fx.push({ t: 'dust', x: a.tx, y: a.ty, a: 0.3 });
  }
}
