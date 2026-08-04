/**
 * Measures the pure-JS cost of the terrain render math (colour interpolation,
 * hashing, string building) that runs per visible tile each frame. Canvas
 * fillRect rasterisation is not included — this isolates the CPU hot path.
 *
 * Mirrors the OPTIMIZED renderer path: per-tile surface colour is cached and
 * validated, and noise hashes use the trig-identity fast hash (h()).
 */
import { TileMap } from '../src/world/TileMap';
import { Tile } from '../src/world/Tile';
import {
  terrainSurfaceColor,
  mixColor,
  withAlpha,
  parseColor,
  TERRAIN_VISUALS
} from '../src/renderer/TerrainPalette';

const SIZE = 128;
const tileMap = new TileMap(SIZE, SIZE, 'single_continent', 777);

let sink = 0;
const tiles: Tile[] = [];
for (let x = 0; x < SIZE; x++) {
  for (let y = 0; y < SIZE; y++) {
    tiles.push(tileMap.grid[x][y]);
  }
}

// Fast hash tables (identical to the renderer's).
const MAX_SALT = 1024;
const COS_TABLE = new Float64Array(MAX_SALT);
const SIN_TABLE = new Float64Array(MAX_SALT);
for (let s = 0; s < MAX_SALT; s++) {
  const b = s * 74.7;
  COS_TABLE[s] = Math.cos(b);
  SIN_TABLE[s] = Math.sin(b);
}
let hSin = 0;
let hCos = 0;
const h = (salt: number): number => {
  const n = (hSin * COS_TABLE[salt] + hCos * SIN_TABLE[salt]) * 43758.5453123;
  const f = n % 1;
  return f < 0 ? f + 1 : f;
};
const setHashBase = (x: number, y: number): void => {
  const a = x * 127.1 + y * 311.7;
  hSin = Math.sin(a);
  hCos = Math.cos(a);
};

// Per-tile cached surface colour, emulating Tile.renderSurface validation.
const colorCache = new Map<number, string>();

const WARM = 1000;
const PASSES = 10;
let anim = 0;

const oneTile = (tile: Tile, x: number, y: number) => {
  setHashBase(x, y);

  // Cached static surface colour (validation only).
  const key = x * SIZE + y;
  let color = colorCache.get(key);
  if (color === undefined) {
    color = terrainSurfaceColor(tile, x, y, anim);
    colorCache.set(key, color);
  }
  sink += color.length;

  // drawTerrainTexture flecks (grass: 1 fleck at 16px).
  const visual = TERRAIN_VISUALS[tile.type];
  for (let i = 0; i < 1; i++) {
    const rx = h(240 + i);
    const ry = h(250 + i);
    const strong = h(260 + i) > 0.55;
    const size = Math.max(1, 16 * (0.035 + h(270 + i) * 0.035));
    const c = withAlpha(strong ? visual.high : visual.low, strong ? 0.16 : 0.14);
    sink += rx + ry + size + c.length;
  }
  // drawTerrainDetails grass blades
  for (let i = 0; i < 3; i++) {
    const rx = 0.16 + h(300 + i) * 0.68;
    const ry = 0.26 + h(310 + i) * 0.55;
    const a = withAlpha(visual.accent, 0.34);
    const b = withAlpha(visual.high, 0.26);
    sink += rx + ry + a.length + b.length;
  }
  if (h(330) > 0.82) sink += mixColor('#fef08a', '#000', 0.5).length;
  const east = tileMap.getTile(x + 1, y);
  const south = tileMap.getTile(x, y + 1);
  if (east && tile.height - east.height > 0.055) sink += color.length;
  if (south && tile.height - south.height > 0.055) sink += color.length;
  return color;
};

for (let i = 0; i < WARM; i++) oneTile(tiles[i], tiles[i].x, tiles[i].y);
// Warm the colour cache for every tile (steady-state: every tile rendered every frame).
for (let i = 0; i < tiles.length; i++) oneTile(tiles[i], tiles[i].x, tiles[i].y);

const t0 = process.hrtime.bigint();
for (let p = 0; p < PASSES; p++) {
  for (let i = 0; i < tiles.length; i++) oneTile(tiles[i], tiles[i].x, tiles[i].y);
}
const t1 = process.hrtime.bigint();
const per = Number(t1 - t0) / 1e6 / (PASSES * tiles.length);
console.log('=== TERRAIN MATH BENCHMARK (optimized path) ===');
console.log(`per-tile JS (cached colour + fast hash, no canvas): ${(per * 1000).toFixed(2)} µs`);
console.log(`est. visible 8160 tiles @16px: ${(per * 8160).toFixed(2)} ms`);
console.log(`est. visible 130k tiles @4px:  ${(per * 130000).toFixed(2)} ms`);
console.log(`sink=${sink}`);

// ---- Component isolation ----
const bench = (label: string, fn: () => void, iters = 200000) => {
  for (let i = 0; i < 20000; i++) fn();
  const t2 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn();
  const t3 = process.hrtime.bigint();
  const ns = Number(t3 - t2) / iters;
  console.log(`comp  ${label.padEnd(28)} ${ns.toFixed(1)} ns/op`);
};

let acc = 0;
const t = tiles[1000];
bench('hash2 (Math.sin)', () => { acc += Math.sin(11 * 127.1 + 23 * 311.7 + 240 * 74.7); });
bench('fast hash h(salt)', () => { setHashBase(11, 23); acc += h(240); });
bench('parseColor(#hex) [memoized]', () => { acc += parseColor('#3f9849').r; });
bench('withAlpha(color,0.34) [memoized]', () => { acc += withAlpha('#3f9849', 0.34).length; });
bench('terrainSurfaceColor(grass) [1st]', () => { acc += terrainSurfaceColor(t, 11, 23, 1.2).length; });
console.log(`acc=${acc}`);
