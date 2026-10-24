import { Noise } from '../core/noise';
import { Rng, hash2 } from '../core/rng';
import { World } from './world';
import { T, O } from './defs';

export type Preset = 'continents' | 'pangea' | 'islands' | 'archipelago' | 'lakes';

export interface GenConfig {
  size: number;
  seed: number;
  preset: Preset;
  /** 0..1 share of the map that is water. */
  water: number;
  /** 0..1 */
  mountains: number;
  /** 0..1 */
  forest: number;
  /** 0 = frozen · 0.5 = temperate · 1 = scorched */
  climate: number;
}

export const DEFAULT_GEN: GenConfig = { size: 192, seed: 1, preset: 'continents', water: 0.5, mountains: 0.5, forest: 0.5, climate: 0.5 };

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Land-shape mask in [0,1] for a preset, from normalised coordinates. */
function makeMask(preset: Preset, rng: Rng): (u: number, v: number) => number {
  const blobs: { x: number; y: number; r: number }[] = [];
  const add = (n: number, rMin: number, rMax: number, margin: number) => {
    for (let i = 0; i < n; i++) blobs.push({ x: rng.range(margin, 1 - margin), y: rng.range(margin, 1 - margin), r: rng.range(rMin, rMax) });
  };
  if (preset === 'pangea') add(1, 0.36, 0.42, 0.42);
  else if (preset === 'continents') { blobs.push({ x: rng.range(0.22, 0.34), y: rng.range(0.3, 0.7), r: rng.range(0.24, 0.3) }, { x: rng.range(0.66, 0.78), y: rng.range(0.3, 0.7), r: rng.range(0.24, 0.3) }); add(2, 0.1, 0.16, 0.2); }
  else if (preset === 'islands') add(9, 0.07, 0.15, 0.12);
  else if (preset === 'archipelago') add(22, 0.04, 0.08, 0.08);
  else add(1, 0.55, 0.6, 0.5); // lakes: a land-filling blob, lakes come from noise
  return (u, v) => {
    let m = 0;
    for (const b of blobs) { const d = Math.hypot(u - b.x, v - b.y) / b.r; m = Math.max(m, 1 - smooth(0.35, 1, d)); }
    return m;
  };
}

/** Value that splits `values` so that `frac` of them fall below it. */
function quantile(values: Float32Array, frac: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(frac * sorted.length)))];
}

export function generateWorld(cfg: GenConfig): World {
  const { size, seed } = cfg;
  const rng = new Rng(seed * 2654435761);
  const world = new World(size, size, seed);
  const nElev = new Noise(seed), nWarp = new Noise(seed + 11), nRidge = new Noise(seed + 23);
  const nMoist = new Noise(seed + 37), nTemp = new Noise(seed + 41), nVeg = new Noise(seed + 53);
  const mask = makeMask(cfg.preset, rng);
  const n = size * size;
  const elev = new Float32Array(n), ridge = new Float32Array(n);

  // ---- elevation: warped fbm blended with the preset mask --------------------------------------
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const wx = u + nWarp.fbm(u * 2.4, v * 2.4, 3) * 0.07, wy = v + nWarp.fbm(u * 2.4 + 9, v * 2.4 + 9, 3) * 0.07;
    const base = nElev.fbm(wx * 3.2, wy * 3.2, 5) * 0.5 + 0.5;
    let e = base * (cfg.preset === 'lakes' ? 0.9 : 0.55) + mask(wx, wy) * (cfg.preset === 'lakes' ? 0.5 : 0.62);
    const edge = Math.min(u, v, 1 - u, 1 - v);
    e *= smooth(0.0, 0.07, edge) * 0.6 + 0.4 * smooth(0, 0.14, edge); // keep a sea border
    elev[y * size + x] = e;
    // ridged noise: sharp mountain chains
    ridge[y * size + x] = 1 - Math.abs(nRidge.fbm(wx * 5.5, wy * 5.5, 4));
  }

  const seaFrac = Math.min(0.9, Math.max(0.1, cfg.water * (cfg.preset === 'lakes' ? 0.45 : 1)));
  const sea = quantile(elev, seaFrac);
  const deepCut = quantile(elev, seaFrac * 0.55);

  // ---- terrain by elevation, then biome by temperature × moisture ------------------------------
  // Mountains follow ridged-noise chains (lifted a little by the land's own height), not just the
  // highest blob of the continent — that is what makes ranges instead of plateaus.
  const score = new Float32Array(n);
  const landScore: number[] = [];
  const eMax = Math.max(...elev) || 1;
  for (let i = 0; i < n; i++) {
    score[i] = ridge[i] * 0.62 + ((elev[i] - sea) / Math.max(0.01, eMax - sea)) * 0.38;
    if (elev[i] >= sea) landScore.push(score[i]);
  }
  landScore.sort((a, b) => a - b);
  const q = (f: number) => landScore[Math.min(landScore.length - 1, Math.floor(f * landScore.length))] ?? 1;
  const mtFrac = 0.04 + cfg.mountains * 0.14;
  const hillCut = q(1 - mtFrac * 2.6), mtCut = q(1 - mtFrac);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, e = elev[i];
    world.height[i] = Math.min(255, Math.max(0, Math.floor(score[i] * 255)));
    if (e < deepCut) world.terrain[i] = T.DEEP;
    else if (e < sea) world.terrain[i] = T.SHALLOW;
    else world.terrain[i] = score[i] > mtCut ? T.MOUNTAIN : score[i] > hillCut ? T.HILL : T.GRASS;
  }

  // ---- climate fields ---------------------------------------------------------------------------
  const wd = world.waterDistance(30);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, u = x / size, v = y / size;
    const lat = Math.abs(v - 0.5) * 2; // 0 equator → 1 pole
    const alt = Math.max(0, (elev[i] - sea) / Math.max(0.01, eMax - sea));
    let temp = 0.84 - lat * 0.6 + nTemp.fbm(u * 3, v * 3, 3) * 0.26 - Math.max(0, alt - 0.55) * 0.5;
    temp += (cfg.climate - 0.5) * 0.8;
    world.temp[i] = Math.floor(Math.min(1, Math.max(0, temp)) * 255);
    const m = 0.5 + nMoist.fbm(u * 3.4, v * 3.4, 4) * 0.55 + Math.max(0, 0.22 - wd[i] * 0.012) - (temp > 0.7 ? 0.1 : 0);
    world.moist[i] = Math.floor(Math.min(1, Math.max(0, m)) * 255);
  }

  for (let i = 0; i < n; i++) {
    const t = world.terrain[i];
    if (t !== T.GRASS && t !== T.HILL && t !== T.MOUNTAIN) continue;
    const temp = world.temp[i] / 255, moist = world.moist[i] / 255;
    if (t === T.MOUNTAIN) { if (temp < 0.4 || world.height[i] > 225) world.terrain[i] = T.PEAK; continue; }
    if (t === T.HILL) { if (temp < 0.16) world.terrain[i] = T.SNOW; continue; }
    let b: number = T.GRASS;
    if (temp < 0.14) b = T.SNOW;
    else if (temp < 0.3) b = T.TUNDRA;
    else if (temp > 0.72) b = moist < 0.36 ? T.DESERT : moist < 0.55 ? T.SAVANNA : T.JUNGLE;
    else if (moist < 0.2) b = T.DIRT;
    else if (moist > 0.78 && world.height[i] < 110 && wd[i] < 6) b = T.SWAMP;
    world.terrain[i] = b;
  }

  // ---- beaches: land touching water becomes sand (except cold shores) ---------------------------
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const i = y * size + x, t = world.terrain[i];
    if (t === T.MOUNTAIN || t === T.PEAK || t === T.HILL || t === T.SHALLOW || t === T.DEEP) continue;
    if (world.temp[i] < 80) continue;
    if (world.terrain[i - 1] === T.SHALLOW || world.terrain[i + 1] === T.SHALLOW || world.terrain[i - size] === T.SHALLOW || world.terrain[i + size] === T.SHALLOW)
      if (hash2(x, y, seed) < 0.9) world.terrain[i] = t === T.DESERT ? T.DESERT : T.SAND;
  }

  // A shallow shelf always rims the land (two tiles), like WorldBox's beaches-into-sea gradient.
  for (let pass = 0; pass < 2; pass++) {
    const mark: number[] = [];
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (world.terrain[i] !== T.DEEP) continue;
      let land = false;
      for (let dy = -1; dy <= 1 && !land; dy++) for (let dx = -1; dx <= 1; dx++) { const t = world.terrain[i + dy * size + dx]; if (t !== T.DEEP && t !== T.SHALLOW) { land = true; break; } }
      if (land) mark.push(i);
    }
    for (const i of mark) world.terrain[i] = T.SHALLOW;
  }

  carveRivers(world, rng);
  scatterObjects(world, nVeg, cfg);
  for (let cy = 0; cy < world.chunkVer.length; cy++) world.chunkVer[cy]++;
  return world;
}

/** Springs on high ground follow steepest descent to the sea; dead ends breach their basin. */
function carveRivers(world: World, rng: Rng): void {
  const { w, h } = world, size = w;
  const count = Math.max(2, Math.floor(size / 9));
  const springs: number[] = [];
  for (let tries = 0; tries < count * 30 && springs.length < count; tries++) {
    const i = rng.int(0, w * h - 1);
    const t = world.terrain[i];
    if ((t === T.HILL || t === T.MOUNTAIN || t === T.PEAK) && world.height[i] > 150) springs.push(i);
  }
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const s of springs) {
    let x = s % w, y = (s / w) | 0, steps = 0;
    const visited = new Set<number>();
    while (steps++ < size * 3) {
      const i = y * w + x;
      visited.add(i);
      const t = world.terrain[i];
      if (t === T.SHALLOW || t === T.DEEP) break;
      if (t !== T.MOUNTAIN && t !== T.PEAK) {
        world.terrain[i] = T.SHALLOW; world.obj[i] = O.NONE;
        if (steps > 40 && hash2(x, y, 7) < 0.5) { const j = i + (hash2(x, y, 8) < 0.5 ? 1 : w); if (j < w * h && world.terrain[j] !== T.DEEP && world.terrain[j] !== T.MOUNTAIN && world.terrain[j] !== T.PEAK) world.terrain[j] = T.SHALLOW; }
      }
      // choose lowest unvisited neighbour with a little meander
      let best = -1, bestV = 1e9;
      for (let d = 0; d < 8; d++) {
        const nx = x + dirs[d][0], ny = y + dirs[d][1];
        if (!world.inb(nx, ny)) continue;
        const j = ny * w + nx;
        if (visited.has(j)) continue;
        const v = world.height[j] + (d >= 4 ? 3 : 0) + hash2(nx, ny, 5) * 6 + (world.terrain[j] === T.MOUNTAIN ? 18 : 0);
        if (v < bestV) { bestV = v; best = j; }
      }
      if (best < 0) break;
      x = best % w; y = (best / w) | 0;
    }
  }
}

/** Trees, rocks, ore and decor, by biome. Density is cluster-noise × biome × config. */
function scatterObjects(world: World, nVeg: Noise, cfg: GenConfig): void {
  const { w, h, seed } = world;
  const forest = 0.25 + cfg.forest * 0.9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, t = world.terrain[i], r = hash2(x, y, seed + 3), r2 = hash2(x, y, seed + 4);
    const u = x / w, v = y / h;
    const cluster = nVeg.fbm(u * 9, v * 9, 3) * 0.5 + 0.5; // 0..1 patches
    const dense = Math.max(0, cluster - 0.34) * forest * 1.7;
    let o = 0;
    switch (t) {
      case T.GRASS:
        if (r < dense * 1.5) o = r2 < 0.65 ? O.OAK : r2 < 0.85 ? O.BIRCH : O.PINE;
        else if (r < 0.03 * forest + dense * 0.2) o = O.BUSH;
        else if (r < 0.05 + dense * 0.1) o = r2 < 0.4 ? O.FLOWER_RED : r2 < 0.7 ? O.FLOWER_YELLOW : O.FLOWER_BLUE;
        else if (r < 0.14) o = O.GRASS_TUFT;
        else if (r < 0.145) o = O.ROCK;
        else if (r < 0.15) o = O.BERRIES;
        break;
      case T.JUNGLE: if (r < 0.2 + dense * 1.3) o = O.JUNGLE_TREE; else if (r < 0.3) o = O.BUSH; else if (r < 0.34) o = r2 < 0.5 ? O.FLOWER_RED : O.MUSHROOM; break;
      case T.SAVANNA: if (r < 0.03 + dense * 0.25) o = O.ACACIA; else if (r < 0.1) o = O.GRASS_TUFT; else if (r < 0.105) o = O.BUSH; break;
      case T.DESERT: if (r < 0.012) o = O.CACTUS; else if (r < 0.014) o = O.DEAD_TREE; else if (r < 0.018) o = O.BONES; else if (r < 0.025) o = O.ROCK; break;
      case T.SWAMP: if (r < 0.1 + dense * 0.4) o = O.DEAD_TREE; else if (r < 0.2) o = O.REED; else if (r < 0.24) o = O.MUSHROOM; break;
      case T.TUNDRA: if (r < dense * 0.9) o = O.PINE; else if (r < 0.04) o = O.ROCK; else if (r < 0.06) o = O.GRASS_TUFT; break;
      case T.SNOW: if (r < dense * 0.8) o = O.SNOW_PINE; else if (r < 0.02) o = O.ROCK; break;
      case T.SAND: if (r < 0.008) o = O.ROCK; else if (r < 0.03 && world.temp[i] > 150) o = O.PALM; break;
      case T.DIRT: if (r < 0.04) o = O.ROCK; else if (r < 0.07) o = O.GRASS_TUFT; else if (r < 0.075) o = O.BOULDER; break;
      case T.HILL:
        if (r < 0.04 + dense * 0.5) o = world.temp[i] < 110 ? O.SNOW_PINE : O.PINE;
        else if (r < 0.07) o = O.ROCK; else if (r < 0.08) o = O.BOULDER;
        else if (r < 0.095) o = r2 < 0.6 ? O.ORE_IRON : r2 < 0.85 ? O.ORE_COPPER : O.ORE_GOLD;
        break;
      case T.MOUNTAIN: case T.PEAK:
        if (r < 0.035) o = r2 < 0.55 ? O.ORE_IRON : r2 < 0.8 ? O.ORE_COPPER : O.ORE_GOLD;
        break;
      case T.SHALLOW: break;
      default: break;
    }
    if (o) { world.obj[i] = o; world.objAge[i] = OBJECTS_GROWN(o, r2); }
  }
  // reeds along calm shorelines
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (world.obj[i] !== O.NONE) continue;
    const t = world.terrain[i];
    if ((t === T.GRASS || t === T.SWAMP || t === T.JUNGLE) && world.terrain[i + 1] === T.SHALLOW && hash2(x, y, 99) < 0.35) world.obj[i] = O.REED;
  }
}

/** Trees spawn at assorted growth stages so a fresh world isn't a monoculture of adults. */
function OBJECTS_GROWN(o: number, r: number): number {
  if (o === O.OAK || o === O.PINE || o === O.BIRCH || o === O.PALM || o === O.JUNGLE_TREE || o === O.ACACIA || o === O.SNOW_PINE) return r < 0.12 ? 40 : r < 0.3 ? 120 : 255;
  if (o >= O.ORE_IRON && o <= O.ORE_COPPER) return 255;
  return 255;
}
