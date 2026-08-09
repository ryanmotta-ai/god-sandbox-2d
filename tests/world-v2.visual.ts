import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { TerrainType, TERRAINS } from '../src/world/Biomes';
import { WorldGenerator, type GeneratorPreset } from '../src/world/WorldGenerator';
import type { Tile } from '../src/world/Tile';

const SIZE = 512;
const outputDir = 'scratch/world-v2-visuals';
mkdirSync(outputDir, { recursive: true });

const colors: Record<TerrainType, [number, number, number]> = {
  [TerrainType.DEEP_OCEAN]: [15, 34, 58], [TerrainType.SHALLOW_WATER]: [35, 78, 135],
  [TerrainType.SAND]: [210, 174, 84], [TerrainType.SOIL]: [126, 91, 51],
  [TerrainType.GRASS]: [77, 132, 73], [TerrainType.FOREST]: [35, 91, 55],
  [TerrainType.SAVANNA]: [167, 142, 53], [TerrainType.SWAMP]: [64, 91, 55],
  [TerrainType.TUNDRA]: [94, 132, 137], [TerrainType.SNOW]: [218, 226, 229],
  [TerrainType.MOUNTAIN]: [91, 96, 105], [TerrainType.LAVA]: [200, 63, 45],
  [TerrainType.ARCANE]: [139, 92, 181], [TerrainType.CORRUPTED]: [87, 42, 109]
};

function nearbyResourceScore(grid: Tile[][], x: number, y: number): number {
  let score = 0;
  for (let dx = -5; dx <= 5; dx += 2) for (let dy = -5; dy <= 5; dy += 2) {
    if (grid[x + dx]?.[y + dy]?.resourceType) score++;
  }
  return score;
}

function settlementSites(grid: Tile[][]): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number; score: number }> = [];
  for (let x = 8; x < SIZE - 8; x += 6) for (let y = 8; y < SIZE - 8; y += 6) {
    const tile = grid[x][y];
    if (!TERRAINS[tile.type].isWalkable || tile.fertility < 0.4) continue;
    let coast = 0;
    for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) {
      const nearby = grid[x + dx]?.[y + dy];
      if (nearby && TERRAINS[nearby.type].isWater) coast = 1;
    }
    candidates.push({ x, y, score: tile.fertility * 10 + nearbyResourceScore(grid, x, y) + coast * 2 });
  }
  candidates.sort((a, b) => b.score - a.score || a.x - b.x || a.y - b.y);
  const selected: Array<{ x: number; y: number }> = [];
  for (const candidate of candidates) {
    if (selected.every(site => Math.hypot(site.x - candidate.x, site.y - candidate.y) >= 44)) {
      selected.push(candidate);
      if (selected.length === 9) break;
    }
  }
  return selected;
}

function componentSizes(grid: Tile[][], predicate: (tile: Tile) => boolean): number[] {
  const visited = new Uint8Array(SIZE * SIZE);
  const sizes: number[] = [];
  const queue = new Int32Array(SIZE * SIZE);
  for (let sx = 0; sx < SIZE; sx++) for (let sy = 0; sy < SIZE; sy++) {
    const start = sx * SIZE + sy;
    if (visited[start] || !predicate(grid[sx][sy])) continue;
    let head = 0, tail = 0, size = 0;
    queue[tail++] = start; visited[start] = 1;
    while (head < tail) {
      const index = queue[head++]; size++;
      const x = Math.floor(index / SIZE), y = index % SIZE;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, next = nx * SIZE + ny;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || visited[next] || !predicate(grid[nx][ny])) continue;
        visited[next] = 1; queue[tail++] = next;
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

function writePreview(path: string, grid: Tile[][], sites: Array<{ x: number; y: number }>): void {
  const pixels = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const tile = grid[x][y];
    let color = colors[tile.type];
    if (tile.type === TerrainType.SHALLOW_WATER && tile.height >= 0.34) color = [55, 166, 190];
    if (tile.resourceType && !TERRAINS[tile.type].isWater) {
      color = [Math.min(255, color[0] + 48), Math.min(255, color[1] + 27), Math.max(20, color[2] - 16)];
    }
    const offset = (y * SIZE + x) * 3;
    pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
  }
  for (const site of sites) for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
    if (dx * dx + dy * dy > 10) continue;
    const x = site.x + dx, y = site.y + dy, offset = (y * SIZE + x) * 3;
    pixels[offset] = 255; pixels[offset + 1] = dx === 0 && dy === 0 ? 80 : 245; pixels[offset + 2] = dx === 0 && dy === 0 ? 70 : 225;
  }
  writeFileSync(path, Buffer.concat([Buffer.from(`P6\n${SIZE} ${SIZE}\n255\n`), pixels]));
}

const cases: Array<{ preset: GeneratorPreset; seed: number }> = [
  { preset: 'single_continent', seed: 1103 },
  { preset: 'two_continents', seed: 8675309 },
  { preset: 'archipelago', seed: 20260808 }
];

const results = [];
for (const scenario of cases) {
  const started = performance.now();
  const grid = WorldGenerator.generate(SIZE, SIZE, scenario.preset, scenario.seed);
  const generationMs = performance.now() - started;
  const sites = settlementSites(grid);
  const terrain: Partial<Record<TerrainType, number>> = {};
  const resources: Record<string, number> = {};
  let inlandWater = 0;
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) {
    const tile = grid[x][y];
    terrain[tile.type] = (terrain[tile.type] ?? 0) + 1;
    if (tile.resourceType) resources[tile.resourceType] = (resources[tile.resourceType] ?? 0) + 1;
    if (tile.type === TerrainType.SHALLOW_WATER && tile.height >= 0.34) inlandWater++;
  }
  const landComponents = componentSizes(grid, tile => !TERRAINS[tile.type].isWater);
  const mountainComponents = componentSizes(grid, tile => tile.type === TerrainType.MOUNTAIN);
  const basename = `${scenario.preset}-seed-${scenario.seed}`;
  writePreview(`${outputDir}/${basename}.ppm`, grid, sites);
  results.push({
    ...scenario,
    generationMs: Math.round(generationMs),
    landPercent: Math.round(((SIZE * SIZE - (terrain.deep_ocean ?? 0) - (terrain.shallow_water ?? 0)) / (SIZE * SIZE)) * 1000) / 10,
    largestLandmass: landComponents[0] ?? 0,
    largestMountainChain: mountainComponents[0] ?? 0,
    inlandWater,
    citySites: sites,
    terrain,
    resources,
    preview: `${outputDir}/${basename}.ppm`
  });
}

const repeatA = WorldGenerator.generate(96, 96, 'single_continent', 4242);
const repeatB = WorldGenerator.generate(96, 96, 'single_continent', 4242);
for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
  if (repeatA[x][y].type !== repeatB[x][y].type || repeatA[x][y].resourceType !== repeatB[x][y].resourceType) {
    throw new Error(`determinism failure at ${x},${y}`);
  }
}

writeFileSync(`${outputDir}/measurements.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
console.log('WORLD-V2 visual probe passed: 512x512 generation, regional metrics, spaced city sites, and deterministic replay.');
