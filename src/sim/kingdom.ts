import type { Sim } from './sim';
import type { Unit } from './unit';
import type { City } from './city';
import type { Race } from '../gfx/humanoid';
import { realmName } from './names';
import { buildEngines } from './siege';

export type Trait = 'warlike' | 'peaceful' | 'greedy' | 'diplomat' | 'tyrant' | 'zealot';
export const TRAIT_NAMES: Record<Trait, string> = { warlike: 'Belicoso', peaceful: 'Pacífico', greedy: 'Ganancioso', diplomat: 'Diplomata', tyrant: 'Tirano', zealot: 'Fanático' };

const COLORS = ['#c0392b', '#2e86de', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#16a085', '#d35400', '#e84393', '#5f6a6a', '#0abde3', '#b8e994', '#ff6b81', '#7f8fa6', '#a3cb38', '#f8a5c2', '#3c40c6', '#cd6133'];

export interface Army { target: number; phase: 'rally' | 'assault'; rx: number; ry: number; since: number }

export class Kingdom {
  cities: number[] = [];
  king = 0;
  capital = 0;
  relations = new Map<number, number>();
  wars = new Set<number>();
  allies = new Set<number>();
  truce = new Map<number, number>();
  army: Army | null = null;
  warSince = new Map<number, number>();
  t = 0;
  losses = 0;
  engineT = 0;
  constructor(public id: number, public name: string, public race: Race, public color: string, public trait: Trait, public founded: number) {}
}

export function newKingdom(sim: Sim, race: Race): Kingdom {
  const used = new Set([...sim.kingdoms.values()].map(k => k.color));
  const free = COLORS.filter(c => !used.has(c));
  const color = free.length ? sim.rng.pick(free) : '#' + Math.floor(sim.rng.next() * 0xffffff).toString(16).padStart(6, '0');
  const k = new Kingdom(sim.nextId++, realmName(sim.rng, race), race, color, sim.rng.pick<Trait>(['warlike', 'peaceful', 'greedy', 'diplomat', 'tyrant', 'zealot']), sim.time);
  for (const [, o] of sim.kingdoms) {
    const base = baseline(race, o.race) + sim.rng.range(-12, 12);
    k.relations.set(o.id, base); o.relations.set(k.id, base);
  }
  sim.kingdoms.set(k.id, k);
  return k;
}

function baseline(a: Race, b: Race): number {
  if (a === b) return 8;
  const key = [a, b].sort().join('+');
  return ({ 'elf+orc': -45, 'human+orc': -28, 'dwarf+orc': -34, 'dwarf+elf': -8, 'elf+human': 10, 'dwarf+human': 12 } as Record<string, number>)[key] ?? 0;
}

const ALLY_AT = 24;
const dist = (a: City, b: City): number => Math.hypot(a.x - b.x, a.y - b.y);
const closest = (sim: Sim, ka: Kingdom, kb: Kingdom): { a: City; b: City; d: number } | null => {
  let best: { a: City; b: City; d: number } | null = null;
  for (const ia of ka.cities) for (const ib of kb.cities) {
    const a = sim.cities.get(ia), b = sim.cities.get(ib);
    if (!a || !b) continue;
    const d = dist(a, b);
    if (!best || d < best.d) best = { a, b, d };
  }
  return best;
};
export const soldiersOf = (sim: Sim, k: Kingdom): Unit[] => sim.units.filter(u => u.kingdomId === k.id && u.alive && (u.role === 'soldier' || u.role === 'archer' || u.role === 'knight') && u.age >= 16);

export function declareWar(sim: Sim, a: Kingdom, b: Kingdom, why: string): void {
  if (a.wars.has(b.id)) return;
  if (a.allies.delete(b.id)) { b.allies.delete(a.id); sim.note(`A aliança entre ${a.name} e ${b.name} acabou.`, 'war'); }
  a.wars.add(b.id); b.wars.add(a.id); a.warSince.set(b.id, sim.time); b.warSince.set(a.id, sim.time);
  a.relations.set(b.id, Math.min(a.relations.get(b.id) ?? 0, -40)); b.relations.set(a.id, Math.min(b.relations.get(a.id) ?? 0, -40));
  sim.note(`${a.name} declarou guerra a ${b.name} (${why}).`, 'war');
  // allies answer the call, unless they are friends with the other side too
  for (const [x, y] of [[a, b], [b, a]]) for (const id of x.allies) {
    const ally = sim.kingdoms.get(id);
    if (ally && !y.allies.has(id) && ally.trait !== 'peaceful') declareWar(sim, ally, y, `aliança com ${x.name}`);
  }
}
export function makePeace(sim: Sim, a: Kingdom, b: Kingdom, truce = 100): void {
  if (!a.wars.has(b.id)) return;
  a.wars.delete(b.id); b.wars.delete(a.id);
  a.truce.set(b.id, sim.time + truce); b.truce.set(a.id, sim.time + truce);
  a.relations.set(b.id, -10); b.relations.set(a.id, -10);
  if (a.army && sim.cities.get(a.army.target)?.kingdomId === b.id) a.army = null;
  if (b.army && sim.cities.get(b.army.target)?.kingdomId === a.id) b.army = null;
  for (const u of sim.units) if ((u.kingdomId === a.id || u.kingdomId === b.id) && (u.mode === 'march' || u.mode === 'siege') && !(sim.kingdoms.get(u.kingdomId)?.wars.size)) { u.mode = 'wander'; u.target = 0; u.thinkT = 0; }
  sim.note(`${a.name} e ${b.name} fizeram as pazes.`, 'peace');
}

export function captureCity(sim: Sim, c: City, by: Kingdom): void {
  const old = sim.kingdoms.get(c.kingdomId);
  if (!old || old === by) return;
  old.cities = old.cities.filter(id => id !== c.id);
  by.cities.push(c.id);
  c.kingdomId = by.id; c.loyalty = 35;
  for (const u of sim.units) if (u.cityId === c.id) {
    u.kingdomId = by.id; if (u.role === 'king') u.role = 'peasant';
    if (u.mode === 'attack' || u.mode === 'flee') { u.mode = 'wander'; u.target = 0; }
    sim.refreshLook(u);
  }
  if (old.capital === c.id) old.capital = old.cities[0] ?? 0;
  old.losses++;
  sim.zoneVer++;
  sim.note(`${by.name} conquistou ${c.name} de ${old.name}!`, 'war');
}

export function updateKingdoms(sim: Sim, dt: number): void {
  for (const [id, k] of sim.kingdoms) {
    k.t += dt;
    if (k.t < 2) continue;
    k.t -= 2;
    k.cities = k.cities.filter(cid => sim.cities.get(cid)?.kingdomId === id);
    if (!k.cities.length) { // a realm with no towns is gone
      for (const [, o] of sim.kingdoms) { o.wars.delete(id); o.allies.delete(id); o.relations.delete(id); o.truce.delete(id); }
      for (const u of sim.units) if (u.kingdomId === id) { u.kingdomId = 0; if (u.role === 'king') u.role = 'peasant'; }
      sim.kingdoms.delete(id); sim.note(`${k.name} deixou de existir.`, 'war');
      continue;
    }
    if (!sim.cities.has(k.capital)) k.capital = k.cities[0];
    ruler(sim, k);
    diplomacy(sim, k);
    campaign(sim, k);
  }
}

function ruler(sim: Sim, k: Kingdom): void {
  const cur = sim.byId.get(k.king);
  if (cur && cur.alive) return;
  const cap = sim.cities.get(k.capital);
  if (!cap) return;
  const heir = sim.units.filter(u => u.cityId === cap.id && u.age >= 18 && u.alive).sort((a, b) => (b.kills * 4 + b.age) - (a.kills * 4 + a.age))[0];
  if (!heir) return;
  heir.role = 'king'; k.king = heir.id; sim.refreshLook(heir);
  sim.note(`${heir.name} foi coroado rei de ${k.name} (${TRAIT_NAMES[k.trait]}).`, 'info');
}

function diplomacy(sim: Sim, k: Kingdom): void {
  for (const [, o] of sim.kingdoms) {
    if (o === k) continue;
    const near = closest(sim, k, o);
    let rel = k.relations.get(o.id) ?? 0;
    const base = baseline(k.race, o.race);
    rel += (base - rel) * 0.012;
    if (!k.wars.has(o.id) && !k.allies.has(o.id)) {
      // friendship grows between kindred or diplomatic realms, and fast between those fighting the same enemy
      if (base > 0) rel += 0.14;
      if (k.trait === 'diplomat') rel += 0.25;
      for (const e of k.wars) if (o.wars.has(e)) { rel += 0.6; break; }
    }
    if (k.allies.has(o.id)) rel += 0.2;
    if (near && near.d < 32 && !k.allies.has(o.id)) rel -= 0.7 * (1 - near.d / 32) * (k.trait === 'warlike' ? 1.6 : k.trait === 'peaceful' ? 0.4 : k.trait === 'diplomat' ? 0.6 : 1);
    if (k.wars.has(o.id)) rel = Math.min(rel, -35);
    rel = Math.max(-100, Math.min(100, rel));
    k.relations.set(o.id, rel);
    if (k.wars.has(o.id)) {
      const since = k.warSince.get(o.id) ?? sim.time, mine = soldiersOf(sim, k).length, theirs = soldiersOf(sim, o).length;
      const dur = sim.time - since;
      // exhaustion: outnumbered or long stalemate, and a king who would rather talk
      const wants = (mine < theirs * 0.35 && dur > 25) || dur > 150 || (k.trait === 'peaceful' && dur > 45) || (k.trait === 'diplomat' && dur > 70);
      if (wants && sim.rng.chance(0.3) && sim.rng.chance(acceptance(sim, o, k))) makePeace(sim, k, o, 90 + (k.trait === 'diplomat' ? 90 : 0));
      continue;
    }
    if (k.allies.has(o.id)) continue;
    if (rel > ALLY_AT && k.id < o.id && k.allies.size < 2 && o.allies.size < 2 && near && near.d < 110 && sim.rng.chance(0.08)
      && ![...o.allies].some(x => k.wars.has(x)) && ![...k.allies].some(x => o.wars.has(x))) {
      k.allies.add(o.id); o.allies.add(k.id);
      sim.note(`${k.name} e ${o.name} firmaram uma aliança.`, 'peace');
      continue;
    }
    if (!near || near.d > 70 || sim.time < (k.truce.get(o.id) ?? 0)) continue;
    const mine = soldiersOf(sim, k).length;
    const thresh = -22 + (k.trait === 'warlike' ? 22 : k.trait === 'peaceful' ? -30 : k.trait === 'tyrant' ? 12 : k.trait === 'greedy' ? 8 : k.trait === 'diplomat' ? -14 : 0) + (k.trait === 'zealot' && k.race !== o.race ? 25 : 0);
    if (rel < thresh && mine >= 3 && sim.time - k.founded > 40 && sim.rng.chance(0.16)) declareWar(sim, k, o, rel < -45 ? 'ódio antigo' : near.d < 25 ? 'disputa de fronteira' : 'ambição');
  }
}

/** Would `a` agree to peace asked by `b`? A winner on the march rarely stops; a pacifist almost always does. */
function acceptance(sim: Sim, a: Kingdom, b: Kingdom): number {
  let p = a.trait === 'warlike' ? 0.15 : a.trait === 'tyrant' ? 0.3 : a.trait === 'zealot' ? 0.3 : a.trait === 'peaceful' || a.trait === 'diplomat' ? 0.9 : 0.5;
  if (a.army && b.cities.includes(a.army.target)) p *= 0.2;
  return p;
}

/** Muster, march in formation, assault. Armies are just soldiers with orders: the battle is ordinary combat. */
function campaign(sim: Sim, k: Kingdom): void {
  if (!k.wars.size) { k.army = null; return; }
  const sol = soldiersOf(sim, k).filter(u => u.hp > u.maxHp * 0.3 && u.cityId > 0);
  if (sol.length < 3) { k.army = null; for (const u of sol) if (u.mode === 'march' || u.mode === 'siege') { u.mode = 'wander'; u.thinkT = 0; } return; }
  let a = k.army;
  const tcity = a ? sim.cities.get(a.target) : null;
  if (!a || !tcity || !k.wars.has(tcity.kingdomId)) {
    // pick the enemy town nearest to our capital
    const cap = sim.cities.get(k.capital);
    let best: City | null = null, bd = Infinity;
    for (const eid of k.wars) { const ek = sim.kingdoms.get(eid); if (!ek) continue; for (const cid of ek.cities) { const c = sim.cities.get(cid); if (c && cap) { const d = dist(c, cap); if (d < bd) { bd = d; best = c; } } } }
    if (!best || !cap) { k.army = null; return; }
    const dx = cap.x - best.x, dy = cap.y - best.y, l = Math.hypot(dx, dy) || 1;
    const stage = Math.min(l, 16);
    a = k.army = { target: best.id, phase: 'rally', rx: best.x + (dx / l) * stage, ry: best.y + (dy / l) * stage, since: sim.time };
    sim.note(`${k.name} reúne um exército contra ${best.name}.`, 'war');
  }
  const tgt = sim.cities.get(a.target)!;
  const dxr = tgt.x - a.rx, dyr = tgt.y - a.ry, lr = Math.hypot(dxr, dyr) || 1, fx = dxr / lr, fy = dyr / lr;
  const sx = -fy, sy = fx; // sideways
  const COLS = Math.max(4, Math.ceil(Math.sqrt(sol.length * 1.5)));
  let arrived = 0;
  sol.forEach((u, i) => {
    if (u.mode === 'attack' && u.target) return; // already in a fight
    const col = (i % COLS) - (COLS - 1) / 2, row = Math.floor(i / COLS);
    if (a!.phase === 'rally') {
      u.mode = 'march'; u.goalX = a!.rx + sx * col * 1.15 - fx * row * 1.2; u.goalY = a!.ry + sy * col * 1.15 - fy * row * 1.2;
      if (Math.hypot(u.goalX - u.x, u.goalY - u.y) < 5) arrived++;
    } else {
      u.mode = 'siege'; u.goalX = tgt.x + sx * col * 1.1 - fx * (row * 1.2 - 3); u.goalY = tgt.y + sy * col * 1.1 - fy * (row * 1.2 - 3);
    }
  });
  buildEngines(sim, k, sol.length);
  if (a.phase === 'rally' && (arrived >= sol.length * 0.7 || sim.time - a.since > 60)) { a.phase = 'assault'; sim.note(`O exército de ${k.name} avança sobre ${tgt.name}!`, 'war'); }
}
