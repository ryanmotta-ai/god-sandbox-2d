import type { Sim } from './sim';
import type { Unit } from './unit';
import type { City } from './city';
import type { Building } from './buildings';
import { moveTo, face, setAct } from './ai';
import { hostile } from './combat';
import { hash2 } from '../core/rng';

/**
 * What people do when there is no work to do — all of it visible: they sleep indoors at night, drink at the tavern in the evening,
 * browse the market by day, fetch water, chat in pairs, play (children), and dance when the town throws a festival.
 * Leisure never outranks danger, hunger or a job in progress; it is only chosen at the moment a unit would otherwise idle.
 */
export const LEISURE = new Set(['tavern', 'market', 'chat', 'play', 'dance', 'water', 'home', 'rest']);

interface Spots { t: number; tavern: Building[]; market: Building[]; well: Building[]; homes: Building[]; plaza: { x: number; y: number } | null }
const SPOTS = new WeakMap<City, Spots>();
const RESIDENCE = new Set(['hut', 'house', 'townhouse', 'keep']);

function spotsOf(sim: Sim, c: City): Spots {
  let s = SPOTS.get(c);
  if (s && sim.time - s.t < 6) return s;
  s = { t: sim.time, tavern: [], market: [], well: [], homes: [], plaza: null };
  for (const id of c.buildings) {
    const b = sim.buildings.get(id);
    if (!b || !b.done || b.ruin) continue;
    if (b.type === 'tavern') s.tavern.push(b); else if (b.type === 'market') s.market.push(b); else if (b.type === 'well') s.well.push(b);
    else if (RESIDENCE.has(b.type)) s.homes.push(b);
    if (!s.plaza && (b.type === 'fountain' || b.type === 'monument')) s.plaza = { x: b.doorX + 0.5, y: b.doorY - 1 };
  }
  if (!s.plaza) { const h = c.hall(sim); if (h) s.plaza = { x: h.doorX + 0.5, y: h.doorY + 1.5 }; }
  SPOTS.set(c, s);
  return s;
}

const isFighter = (u: Unit): boolean => u.role === 'soldier' || u.role === 'archer' || u.role === 'knight' || u.role === 'king';
const night = (p: number): boolean => p > 0.82 || p < 0.17;
const pickOf = (sim: Sim, l: Building[]): Building => l[sim.rng.int(0, l.length - 1)];

function go(u: Unit, mode: string, x: number, y: number, secs = 0): void { u.mode = mode; u.goalX = x; u.goalY = y; u.path = null; u.socialT = secs; u.jobT = 0; }

/** Called when a civilised unit has nothing urgent to do. True if it chose a pastime. */
export function thinkLeisure(sim: Sim, u: Unit, c: City): boolean {
  if (u.carry || u.inShip || u.mode === 'board') return false;
  const k = sim.kingdoms.get(c.kingdomId), war = (k?.wars.size ?? 0) > 0, p = sim.dayPhase, sp = spotsOf(sim, c), fighter = isFighter(u), r = sim.rng.next();
  const child = u.age < 16;
  // night: the town goes to bed (some keep working through the dark)
  if (night(p) && !(fighter && war) && u.role !== 'king' && hash2(u.id, 1, 2) < (child ? 1 : 0.65)) {
    const home = sim.buildings.get(u.home);
    const h = home && !home.ruin && home.cityId === c.id ? home : sp.homes.length ? pickOf(sim, sp.homes) : null;
    if (h) { u.home = h.id; go(u, 'home', h.doorX + 0.5, h.doorY + 0.5); return true; }
    const hall = c.hall(sim); if (hall) { go(u, 'rest', hall.doorX + sim.rng.range(-3, 3), hall.doorY + sim.rng.range(1, 3), 20); return true; }
  }
  if (child) { // children run about the square and chase one another
    if (r < 0.7) { const a = sim.rng.range(0, 6.283), d = sim.rng.range(2, 8), pl = sp.plaza ?? { x: c.x, y: c.y }; go(u, 'play', pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d, sim.rng.range(10, 25)); return true; }
    return false;
  }
  if (c.festT > 0 && sp.plaza && !(war && fighter) && r < 0.85) { const a = sim.rng.range(0, 6.283), d = sim.rng.range(0.8, 3.6); go(u, 'dance', sp.plaza.x + Math.cos(a) * d, sp.plaza.y + Math.sin(a) * d * 0.7, c.festT); return true; }
  const eager = u.role === 'peasant' ? 1 : fighter ? 0.25 : 0.12; // idle hands loaf more than working ones
  if (p > 0.58 && p <= 0.82 && sp.tavern.length && r < 0.5 * eager && !(war && fighter)) { const t = pickOf(sim, sp.tavern); go(u, 'tavern', t.doorX + 0.5 + sim.rng.range(-2.2, 2.2), t.doorY + 0.6 + sim.rng.range(0, 1.6), sim.rng.range(15, 35)); return true; }
  if (p > 0.28 && p <= 0.6 && sp.market.length && r < 0.22 * eager) { const m = pickOf(sim, sp.market); go(u, 'market', m.x + sim.rng.range(0.5, m.def.w - 0.5), m.y + m.def.h + sim.rng.range(0.2, 1.2), sim.rng.range(10, 22)); return true; }
  if (sp.well.length && sp.homes.length && r < 0.06 * eager) { const w = pickOf(sim, sp.well); go(u, 'water', w.doorX + 0.5, w.doorY + 0.5); return true; }
  if (r < 0.1 * eager) { // a word with whoever is close
    const friend = sim.nearest(u.x, u.y, 3.2, o => o !== u && o.def.civ && o.alive && o.cityId === u.cityId && !o.inShip && !o.inside && o.age >= 16 && (o.mode === 'wander' || o.mode === 'goto') && !o.carry);
    if (friend) {
      const t = sim.rng.range(6, 13);
      u.mode = 'chat'; u.partner = friend.id; u.socialT = t; u.path = null; friend.mode = 'chat'; friend.partner = u.id; friend.socialT = t; friend.path = null;
      return true;
    }
  }
  return false;
}

function end(u: Unit): void { u.mode = 'wander'; u.partner = 0; u.thinkT = 0.2; u.socialT = 0; setAct(u, 'idle'); u.state = 'idle'; }

/** Acting out a pastime. */
export function actSocial(sim: Sim, u: Unit, dt: number): void {
  const city = sim.cities.get(u.cityId);
  if (!city) { end(u); return; }
  switch (u.mode) {
    case 'home': {
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 0.95, 0.9);
      if (m === 'moving') { setAct(u, 'walk'); u.state = 'walk'; return; }
      const b = sim.buildings.get(u.home);
      if (b && !b.ruin && night(sim.dayPhase)) { u.inside = b.id; u.mode = 'rest'; u.path = null; setAct(u, 'sleep'); return; }
      end(u); return;
    }
    case 'rest': { // asleep (indoors when the town has houses): wake at dawn, when hungry, or when an enemy is near
      const inB = u.inside ? sim.buildings.get(u.inside) : null;
      if (u.inside && !inB) { u.inside = 0; end(u); return; }
      if (!u.inside) { const m = moveTo(sim, u, u.goalX, u.goalY, dt, 0.9, 0.8); if (m === 'moving') { setAct(u, 'walk'); u.state = 'walk'; return; } setAct(u, 'sleep'); u.state = 'sleep'; u.socialT -= dt; if (!night(sim.dayPhase) || u.socialT <= 0) end(u); return; }
      return;
    }
    case 'tavern': case 'market': case 'play': case 'dance': {
      if (u.socialT > 0 && u.mode !== 'dance') u.socialT -= dt;
      if (u.mode === 'dance' && (city.festT <= 0)) { end(u); return; }
      if (u.socialT <= 0 && u.mode !== 'dance') { end(u); return; }
      if (u.mode === 'play' && u.jobT <= 0) { // pick the next place to run to, sometimes after a friend
        const kid = sim.rng.chance(0.4) ? sim.nearest(u.x, u.y, 6, o => o !== u && o.def.civ && o.age < 16 && o.mode === 'play') : null;
        if (kid) { u.goalX = kid.x; u.goalY = kid.y; } else { const sp = spotsOf(sim, city).plaza ?? { x: city.x, y: city.y }, a = sim.rng.range(0, 6.283), d = sim.rng.range(2, 8); u.goalX = sp.x + Math.cos(a) * d; u.goalY = sp.y + Math.sin(a) * d; }
        u.jobT = sim.rng.range(1.5, 4); u.path = null;
      }
      u.jobT -= dt;
      const near = Math.hypot(u.goalX - u.x, u.goalY - u.y) < 0.7;
      if (!near) {
        const m = moveTo(sim, u, u.goalX, u.goalY, dt, u.mode === 'play' ? 1.5 : 0.9, 0.6);
        if (m === 'moving') { setAct(u, u.mode === 'play' ? 'run' : 'walk'); u.state = 'walk'; return; }
        if (m === 'blocked') { end(u); return; }
      }
      u.state = 'idle';
      if (u.mode === 'dance') { setAct(u, 'cast'); if (hash2(sim.tickN, u.id, 14) < 0.02) sim.fx.push({ t: 'note', x: u.x, y: u.y - 1.2 }); face(u, (u.goalX - city.x) * 0.1 + 0.01, 1); return; }
      if (u.mode === 'tavern') { setAct(u, Math.floor(u.socialT / 2.6) % 2 === 0 ? 'eat' : 'idle'); return; }
      if (u.mode === 'market') { setAct(u, 'idle'); if (hash2(sim.tickN, u.id, 15) < 0.01) face(u, sim.rng.range(-1, 1), sim.rng.range(-1, 1)); return; }
      setAct(u, 'idle'); return;
    }
    case 'chat': {
      const o = sim.byId.get(u.partner);
      u.socialT -= dt;
      if (!o || !o.alive || o.mode !== 'chat' || o.partner !== u.id || u.socialT <= 0) { end(u); return; }
      face(u, o.x - u.x, o.y - u.y); setAct(u, 'idle'); u.state = 'idle';
      return;
    }
    case 'water': { // the well, then a bucket carried to a house
      const m = moveTo(sim, u, u.goalX, u.goalY, dt, 0.9, 0.9);
      if (m === 'moving') { setAct(u, u.carry ? 'carry' : 'walk'); u.state = 'walk'; return; }
      const sp = spotsOf(sim, city);
      if (!u.carry && sp.homes.length) { u.carry = { good: 'food', n: 0 }; const h = pickOf(sim, sp.homes); u.goalX = h.doorX + 0.5; u.goalY = h.doorY + 0.5; u.path = null; return; }
      u.carry = null; end(u); return;
    }
    default: end(u);
  }
}

/** Once a second per town: the festival clock, and the starting gun. */
export function updateSocial(sim: Sim, c: City): void {
  if (c.festT > 0) { c.festT -= 1; const sp = spotsOf(sim, c); if (sp.plaza && c.festT % 2 === 0) { sim.fx.push({ t: 'confetti', x: sp.plaza.x + sim.rng.range(-3, 3), y: sp.plaza.y + sim.rng.range(-2, 2) }); sim.fx.push({ t: 'note', x: sp.plaza.x + sim.rng.range(-2, 2), y: sp.plaza.y - 1 }); } return; }
  const k = sim.kingdoms.get(c.kingdomId), p = sim.dayPhase;
  if (!k || k.wars.size || c.pop < 20 || c.stock.food < c.pop * 4 || sim.time - c.festLast < 260 || p < 0.34 || p > 0.6) return;
  if (!sim.rng.chance(0.02)) return;
  const sp = spotsOf(sim, c);
  if (!sp.plaza) return;
  c.festT = 45; c.festLast = sim.time; c.loyalty = Math.min(100, c.loyalty + 6);
  sim.note(`${c.name} faz uma festa!`, 'city');
}

/** Whoever is indoors: wake at dawn, hungry, or when an enemy comes near; or step out when the house is gone. Called from updateUnits. */
export function tickInside(sim: Sim, u: Unit, dt: number): boolean {
  const b = sim.buildings.get(u.inside);
  const wake = (): void => { u.inside = 0; if (b) { u.x = b.doorX + 0.5; u.y = b.doorY + 0.5; u.px = u.x; u.py = u.y; } end(u); };
  if (!b || b.ruin) { wake(); return false; }
  u.hunger += dt * 0.2;
  if (!night(sim.dayPhase) || u.hunger > 85) { wake(); return false; }
  if ((sim.tickN + u.id) % 20 === 0 && sim.nearest(b.cx, b.cy, 14, o => hostile(sim, u, o))) { wake(); return false; }
  return true;
}
