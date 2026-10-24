import type { Sim } from './sim';
import { TERRAIN, T, O, OBJECTS, isTree } from '../world/defs';
import { hash2 } from '../core/rng';
import { damage } from './combat';
import { igniteTile } from './ai';

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Fire, regrowth, lava, tree growth — the slow living background, sampled instead of swept. */
export function updateDynamics(sim: Sim, dt: number): void {
  const w = sim.world;
  weather(sim, dt);
  if (sim.tickN % 4 === 0) fire(sim);
  // random sampling: every tile is visited roughly every minute
  const samples = Math.max(8, Math.floor((w.w * w.h) / 600));
  for (let n = 0; n < samples; n++) {
    const i = sim.rng.int(0, w.w * w.h - 1), x = i % w.w, y = (i / w.w) | 0, t = w.terrain[i], o = w.obj[i];
    if (isTree(o)) {
      if (w.objAge[i] < 255) w.objAge[i] = Math.min(255, w.objAge[i] + 10);
      else if (sim.rng.chance(0.012)) seed(sim, x, y, o);
    } else if (o === O.STUMP && sim.rng.chance(0.08)) w.obj[i] = 0;
    switch (t) {
      case T.ASH: if (sim.rng.chance(0.06)) w.setTerrain(x, y, T.DIRT); break;
      case T.DIRT: if (sim.rng.chance(0.03) && nearTerrain(w, x, y, T.GRASS) && w.bld[i] === 0 && w.zone[i] === 0) w.setTerrain(x, y, T.GRASS); break;
      case T.LAVA: if (sim.rng.chance(0.03)) { w.setTerrain(x, y, T.ROCK); sim.fx.push({ t: 'smoke', x: x + 0.5, y: y + 0.5 }); } else lavaFlow(sim, x, y); break;
      case T.FIELD: if (w.bld[i] === 0 && sim.rng.chance(0.05)) w.setTerrain(x, y, T.DIRT); break;
      case T.ROAD: if (w.zone[i] === 0 && sim.rng.chance(0.01)) w.setTerrain(x, y, T.DIRT); break;
      default: break;
    }
  }
  void dt;
}

function weather(sim: Sim, dt: number): void {
  sim.weatherT -= dt;
  const wet = sim.weather === 'rain' || sim.weather === 'storm';
  if (sim.weatherT <= 0) {
    const s = sim.season, r = sim.rng.next();
    sim.weather = s === 3 ? (r < 0.55 ? 'snow' : r < 0.7 ? 'fog' : 'clear') : s === 1 ? (r < 0.14 ? 'storm' : r < 0.26 ? 'rain' : 'clear') : (r < 0.3 ? 'rain' : r < 0.38 ? 'fog' : r < 0.45 ? 'storm' : 'clear');
    sim.weatherT = sim.rng.range(35, 90);
  }
  if (sim.weather === 'storm' && sim.rng.chance(dt * 0.06)) { // a bolt somewhere in the world
    const x = sim.rng.int(2, sim.world.w - 3), y = sim.rng.int(2, sim.world.h - 3);
    sim.fx.push({ t: 'lightning', x: x + 0.5, y: y + 0.5 });
    sim.near(x + 0.5, y + 0.5, 1.8, u => { damage(sim, u, 60, null); });
    igniteTile(sim, x, y);
  }
  if (wet && sim.tickN % 8 === 0) for (const i of [...sim.world.activeFires]) if (sim.rng.chance(0.35)) { sim.world.fire[i] = 0; sim.world.activeFires.delete(i); }
}

function nearTerrain(w: Sim['world'], x: number, y: number, t: number): boolean {
  for (const [dx, dy] of NB) if (w.t(x + dx, y + dy) === t) return true;
  return false;
}

function seed(sim: Sim, x: number, y: number, kind: number): void {
  const w = sim.world, nx = x + sim.rng.int(-3, 3), ny = y + sim.rng.int(-3, 3);
  if (!w.inb(nx, ny)) return;
  const i = ny * w.w + nx, t = w.terrain[i];
  if (w.obj[i] !== 0 || w.bld[i] !== 0 || w.zone[i] !== 0) return;
  const ok = kind === O.PALM ? t === T.SAND : kind === O.PINE || kind === O.SNOW_PINE ? t === T.TUNDRA || t === T.SNOW || t === T.GRASS || t === T.HILL : kind === O.JUNGLE_TREE ? t === T.JUNGLE : kind === O.ACACIA ? t === T.SAVANNA : (t === T.GRASS || t === T.DIRT);
  if (!ok) return;
  let crowd = 0;
  for (let j = -2; j <= 2; j++) for (let ii = -2; ii <= 2; ii++) if (isTree(w.obj[(ny + j) * w.w + nx + ii] ?? 0)) crowd++;
  if (crowd > 8) return;
  w.obj[i] = kind; w.objAge[i] = 20;
  if (t === T.DIRT) w.setTerrain(nx, ny, T.GRASS);
}

function lavaFlow(sim: Sim, x: number, y: number): void {
  const w = sim.world;
  for (const [dx, dy] of NB) {
    const t = w.t(x + dx, y + dy);
    if (TERRAIN[t].water) { w.setTerrain(x, y, T.ROCK); sim.fx.push({ t: 'smoke', x: x + 0.5, y: y + 0.5 }); sim.fx.push({ t: 'splash', x: x + 0.5, y: y + 0.5 }); return; }
    if (sim.rng.chance(0.006) && (t === T.GRASS || t === T.DIRT || t === T.SAND || t === T.ASH) && w.bld[(y + dy) * w.w + x + dx] === 0) { w.setTerrain(x + dx, y + dy, T.LAVA); }
  }
}

function fire(sim: Sim): void {
  const w = sim.world;
  const burning = [...w.activeFires];
  for (const i of burning) {
    const x = i % w.w, y = (i / w.w) | 0;
    const age = w.fire[i]++;
    if (age % 3 === 0) sim.fx.push({ t: 'fire', x: x + 0.5, y: y + 0.5 });
    if (age === 5) sim.fx.push({ t: 'smoke', x: x + 0.5, y: y + 0.5 });
    // hurt whoever stands in it; set buildings alight
    if (age % 5 === 1) {
      sim.near(x + 0.5, y + 0.5, 0.8, u => { if (u.alive && !u.def.fly) { damage(sim, u, 5, null); u.burning = Math.max(u.burning, 3); } });
      const bi = w.bld[i];
      if (bi) { const b = sim.buildings.get(bi); if (b && !b.ruin) { b.hp -= 15; b.burning = Math.max(b.burning, 6); b.hurtT = 0.2; if (b.hp <= 0) sim.destroyBuilding(b, null); } }
    }
    // spread
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy;
      if (!w.inb(nx, ny)) continue;
      const ni = ny * w.w + nx;
      if (w.fire[ni]) continue;
      const fl = Math.max(TERRAIN[w.terrain[ni]].flammable, OBJECTS[w.obj[ni]].flammable, w.bld[ni] ? 0.5 : 0);
      if (fl > 0 && hash2(sim.tickN, ni, i) < fl * 0.09) { w.fire[ni] = 1; w.activeFires.add(ni); }
    }
    if (age > 9 + (hash2(i, 1, 1) * 8 | 0)) { // burnt out
      w.fire[i] = 0; w.activeFires.delete(i);
      const t = w.terrain[i];
      if (TERRAIN[t].flammable > 0.1 || OBJECTS[w.obj[i]].flammable > 0) { if (t !== T.ROAD && !w.bld[i]) w.setTerrain(x, y, T.ASH); w.obj[i] = 0; w.touch(x, y, 1); }
    }
  }
}
