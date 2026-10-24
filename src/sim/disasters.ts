import type { Sim } from './sim';
import { T, O, TERRAIN } from '../world/defs';
import { damage, kill } from './combat';
import { igniteTile } from './ai';
import { hash2 } from '../core/rng';

/** Things that happen over time in one place: tornadoes, volcanoes, meteors, quakes, acid clouds. */
export interface Disaster { id: number; type: 'tornado' | 'volcano' | 'meteor' | 'quake' | 'acid' | 'flood'; x: number; y: number; vx: number; vy: number; t: number; life: number; r: number; data?: number }

export function startDisaster(sim: Sim, type: Disaster['type'], x: number, y: number, r = 5): void {
  const d: Disaster = { id: sim.nextId++, type, x, y, vx: 0, vy: 0, t: 0, life: 10, r };
  if (type === 'tornado') { d.life = 28; d.vx = sim.rng.range(-1.2, 1.2); d.vy = sim.rng.range(-0.9, 0.9); }
  if (type === 'volcano') { d.life = 26; d.r = 4; buildCone(sim, x, y); }
  if (type === 'meteor') { d.life = 1.1; d.vx = -9; d.vy = -9; }
  if (type === 'quake') { d.life = 5; }
  if (type === 'acid') { d.life = 22; d.vx = sim.rng.range(-0.5, 0.5); d.vy = sim.rng.range(-0.5, 0.5); }
  if (type === 'flood') { d.life = 30; d.r = 7; }
  sim.disasters.push(d);
}

function buildCone(sim: Sim, x: number, y: number): void {
  const w = sim.world, cx = Math.floor(x), cy = Math.floor(y);
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    const d = Math.hypot(i, j), tx = cx + i, ty = cy + j;
    if (!w.inb(tx, ty) || d > 4.2 || TERRAIN[w.terrain[ty * w.w + tx]].water) continue;
    const b = w.bld[ty * w.w + tx]; if (b) { const bb = sim.buildings.get(b); if (bb) sim.destroyBuilding(bb, null); }
    w.setTerrain(tx, ty, d < 1.3 ? T.LAVA : d < 3.2 ? T.MOUNTAIN : T.ROCK);
  }
  sim.fx.push({ t: 'boom', x, y });
}

export function updateDisasters(sim: Sim, dt: number): void {
  const w = sim.world;
  for (let n = sim.disasters.length - 1; n >= 0; n--) {
    const d = sim.disasters[n];
    d.t += dt;
    if (d.t >= d.life) { if (d.type === 'meteor') impact(sim, d); sim.disasters.splice(n, 1); continue; }
    switch (d.type) {
      case 'tornado': {
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (hash2(sim.tickN, d.id, 1) < 0.04) { d.vx += (hash2(sim.tickN, d.id, 2) - 0.5) * 1.2; d.vy += (hash2(sim.tickN, d.id, 3) - 0.5) * 1.2; }
        d.vx = Math.max(-2.2, Math.min(2.2, d.vx)); d.vy = Math.max(-2.2, Math.min(2.2, d.vy));
        if (d.x < 3 || d.x > w.w - 3) d.vx = -d.vx; if (d.y < 3 || d.y > w.h - 3) d.vy = -d.vy;
        sim.near(d.x, d.y, 3.4, u => {
          if (!u.alive) return;
          const dx = u.x - d.x, dy = u.y - d.y, l = Math.hypot(dx, dy) || 1;
          const nx = u.x + (-dy / l) * 2.5 * dt + (-dx / l) * 1.4 * dt, ny = u.y + (dx / l) * 2.5 * dt + (-dy / l) * 1.4 * dt;
          if (sim.walkable(nx, ny) || u.def.fly) { u.x = nx; u.y = ny; }
          if (hash2(sim.tickN, u.id, 4) < 0.05) damage(sim, u, 9, null);
        });
        for (let k = 0; k < 3; k++) {
          const tx = Math.floor(d.x + (hash2(sim.tickN, k, 5) - 0.5) * 5), ty = Math.floor(d.y + (hash2(sim.tickN, k, 6) - 0.5) * 5);
          if (!w.inb(tx, ty)) continue;
          const i = ty * w.w + tx;
          if (w.obj[i] !== O.NONE && w.obj[i] !== O.BOULDER && hash2(sim.tickN, i, 7) < 0.25) { w.obj[i] = O.NONE; sim.fx.push({ t: 'leaf', x: tx + 0.5, y: ty + 0.5 }); }
          const b = w.bld[i]; if (b) { const bb = sim.buildings.get(b); if (bb) { bb.hp -= 30 * dt * 3; bb.hurtT = 0.2; if (bb.hp <= 0) sim.destroyBuilding(bb, null); } }
        }
        if (sim.tickN % 3 === 0) sim.fx.push({ t: 'dust', x: d.x + (hash2(sim.tickN, d.id, 8) - 0.5) * 2, y: d.y + 0.5, a: 1 });
        break;
      }
      case 'volcano': {
        if (sim.tickN % 5 === 0) {
          const a = hash2(sim.tickN, d.id, 1) * 6.283, r = 2 + hash2(sim.tickN, d.id, 2) * 3.5;
          const tx = Math.floor(d.x + Math.cos(a) * r), ty = Math.floor(d.y + Math.sin(a) * r);
          sim.fx.push({ t: 'fire', x: d.x, y: d.y, a: 1 }); sim.fx.push({ t: 'spark', x: d.x, y: d.y - 0.5 }); sim.fx.push({ t: 'smoke', x: d.x, y: d.y - 1 });
          if (w.inb(tx, ty) && !TERRAIN[w.terrain[ty * w.w + tx]].water && w.terrain[ty * w.w + tx] !== T.MOUNTAIN) {
            const b = w.bld[ty * w.w + tx]; if (b) { const bb = sim.buildings.get(b); if (bb) sim.destroyBuilding(bb, null); }
            w.setTerrain(tx, ty, T.LAVA); igniteTile(sim, tx + 1, ty);
            sim.near(tx + 0.5, ty + 0.5, 1.5, u => { damage(sim, u, 30, null); u.burning = 5; });
          }
        }
        break;
      }
      case 'quake': {
        sim.fx.push({ t: 'meteor', x: d.x, y: d.y });
        for (let k = 0; k < 6; k++) {
          const tx = Math.floor(d.x + (hash2(sim.tickN, k, 1) - 0.5) * d.r * 2), ty = Math.floor(d.y + (hash2(sim.tickN, k, 2) - 0.5) * d.r * 2);
          if (!w.inb(tx, ty) || Math.hypot(tx - d.x, ty - d.y) > d.r) continue;
          const i = ty * w.w + tx, t = w.terrain[i];
          if (!TERRAIN[t].water && t !== T.LAVA && hash2(sim.tickN, i, 3) < 0.25) { w.setTerrain(tx, ty, hash2(i, 1, 4) < 0.3 ? T.ROCK : T.DIRT); w.obj[i] = O.NONE; sim.fx.push({ t: 'dust', x: tx + 0.5, y: ty + 0.5, a: 1 }); }
          const b = w.bld[i]; if (b) { const bb = sim.buildings.get(b); if (bb && hash2(sim.tickN, i, 5) < 0.3) { bb.hp -= 120; bb.hurtT = 0.2; if (bb.hp <= 0) sim.destroyBuilding(bb, null); } }
        }
        sim.near(d.x, d.y, d.r, u => { if (!u.def.fly && hash2(sim.tickN, u.id, 6) < 0.04) damage(sim, u, 12, null); });
        break;
      }
      case 'acid': {
        d.x += d.vx * dt; d.y += d.vy * dt;
        sim.near(d.x, d.y, d.r, u => { if (hash2(sim.tickN, u.id, 9) < 0.5) damage(sim, u, 1.4, null); });
        for (let k = 0; k < 4; k++) {
          const tx = Math.floor(d.x + (hash2(sim.tickN, k, 1) - 0.5) * d.r * 2), ty = Math.floor(d.y + (hash2(sim.tickN, k, 2) - 0.5) * d.r * 2);
          if (!w.inb(tx, ty) || Math.hypot(tx - d.x, ty - d.y) > d.r) continue;
          const i = ty * w.w + tx; sim.fx.push({ t: 'splash', x: tx + 0.5, y: ty + 0.5 });
          if (w.obj[i] !== O.NONE && w.obj[i] < O.ROCK && w.obj[i] !== O.REED && hash2(sim.tickN, i, 3) < 0.2) w.obj[i] = O.DEAD_TREE;
          const b = w.bld[i]; if (b) { const bb = sim.buildings.get(b); if (bb) { bb.hp -= 6; if (bb.hp <= 0) sim.destroyBuilding(bb, null); } }
        }
        break;
      }
      case 'flood': {
        if (sim.tickN % 6 === 0) for (let k = 0; k < 14; k++) {
          const a = hash2(sim.tickN, k, 1) * 6.283, r = hash2(sim.tickN, k, 2) * d.r * Math.min(1, d.t / 8);
          const tx = Math.floor(d.x + Math.cos(a) * r), ty = Math.floor(d.y + Math.sin(a) * r);
          if (!w.inb(tx, ty)) continue;
          const i = ty * w.w + tx, t = w.terrain[i];
          if (t !== T.DEEP && t !== T.SHALLOW && t !== T.MOUNTAIN && t !== T.PEAK && t !== T.LAVA && d.t < d.life - 10) { w.setTerrain(tx, ty, T.SHALLOW); sim.fx.push({ t: 'splash', x: tx + 0.5, y: ty + 0.5 }); (d.data ??= 0); w.moist[i] = 255; }
        }
        break;
      }
      default: break;
    }
  }
}

function impact(sim: Sim, d: Disaster): void {
  const w = sim.world, cx = Math.floor(d.x), cy = Math.floor(d.y), R = 7;
  sim.fx.push({ t: 'boom', x: d.x, y: d.y }); sim.fx.push({ t: 'flash', x: d.x, y: d.y, a: 0.8 });
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const dd = Math.hypot(i, j), tx = cx + i, ty = cy + j;
    if (dd > R || !w.inb(tx, ty)) continue;
    const idx = ty * w.w + tx, b = w.bld[idx];
    if (b && dd < 5) { const bb = sim.buildings.get(b); if (bb) sim.destroyBuilding(bb, null); }
    if (TERRAIN[w.terrain[idx]].water) continue;
    if (dd < 1.8) w.setTerrain(tx, ty, T.LAVA);
    else if (dd < 3.6) { w.setTerrain(tx, ty, T.ROCK); w.obj[idx] = O.NONE; }
    else if (dd < R) { if (w.terrain[idx] !== T.MOUNTAIN && w.terrain[idx] !== T.PEAK) w.setTerrain(tx, ty, T.ASH); w.obj[idx] = O.NONE; if (hash2(idx, 1, 2) < 0.35) igniteTile(sim, tx, ty); }
  }
  sim.near(d.x, d.y, R + 2, u => { const dist = Math.hypot(u.x - d.x, u.y - d.y); if (dist < 4) kill(sim, u, null, 'meteoro'); else damage(sim, u, 140 / dist, null); });
}
