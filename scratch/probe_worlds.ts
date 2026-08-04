/**
 * Probes the refined WorldGenerator across every preset: guarantees land,
 * keeps magic regions as real clusters, and stays deterministic. Also checks
 * the road-surveying A* mode crosses shallow water (bridges).
 */
import { WorldGenerator } from '../src/world/WorldGenerator';
import { TerrainType } from '../src/world/Biomes';
import { GeneratorPreset } from '../src/world/WorldGenerator';
import { SimplePathfinder } from '../src/ai/Pathfinding';
import { TileMap } from '../src/world/TileMap';
import { Tile } from '../src/world/Tile';

const PRESETS: GeneratorPreset[] = ['single_continent', 'two_continents', 'archipelago', 'ring_atoll', 'fragmented', 'desert', 'frozen', 'random'];
const SEEDS = [12345, 777, 20260802];

let failures = 0;
for (const preset of PRESETS) {
  for (const seed of SEEDS) {
    const grid = WorldGenerator.generate(128, 128, preset, seed);
    const counts: Record<string, number> = {};
    for (const row of grid) for (const t of row) counts[t.type] = (counts[t.type] ?? 0) + 1;

    const land = grid.length * grid[0].length - (counts.deep_ocean ?? 0) - (counts.shallow_water ?? 0);
    const magic = (counts.arcane ?? 0) + (counts.corrupted ?? 0);
    const landPct = (land / (grid.length * grid[0].length)) * 100;

    const ok = landPct > 5 && landPct < 99;
    const magicOk = magic === 0 || (magic > 20 && magic < 10000);

    if (!ok || !magicOk) {
      failures++;
      console.log(`FAIL preset=${preset} seed=${seed} land=${landPct.toFixed(1)}% magic=${magic} counts=${JSON.stringify(counts)}`);
    }

    const grid2 = WorldGenerator.generate(128, 128, preset, seed);
    let same = true;
    for (let x = 0; x < 128 && same; x++) {
      for (let y = 0; y < 128 && same; y++) {
        if (grid[x][y].type !== grid2[x][y].type) same = false;
      }
    }
    if (!same) {
      failures++;
      console.log(`FAIL determinism preset=${preset} seed=${seed}`);
    }
  }
}

// Count magic regions (4-connected components) — salt-and-pepper would give
// hundreds of tiny regions; real clusters stay few.
let components = 0;
const componentSizes: number[] = [];
{
  const grid = WorldGenerator.generate(128, 128, 'single_continent', 12345);
  const seen = new Set<string>();
  const magicTypes = new Set([TerrainType.ARCANE, TerrainType.CORRUPTED]);
  for (let x = 0; x < 128; x++) {
    for (let y = 0; y < 128; y++) {
      const t = grid[x][y];
      if (!magicTypes.has(t.type) || seen.has(`${x},${y}`)) continue;
      components++;
      let size = 0;
      const stack: Array<[number, number]> = [[x, y]];
      seen.add(`${x},${y}`);
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        size++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= 128 || ny >= 128) continue;
          const key = `${nx},${ny}`;
          if (seen.has(key)) continue;
          const nt = grid[nx][ny];
          if (nt.type === t.type) {
            seen.add(key);
            stack.push([nx, ny]);
          }
        }
      }
      componentSizes.push(size);
    }
  }
}
console.log(`magic components=${components} sizes=${componentSizes.sort((a, b) => b - a).slice(0, 10).join(',')}`);
if (components > 30) {
  failures++;
  console.log(`FAIL magic regions=${components} (too fragmented)`);
} else {
  console.log(`magic ok (cohesive)`);
}

// --- ROADS: the survey A* mode must bridge shallow water ---
{
  const map = new TileMap(128, 128, 'single_continent', 555);
  const grid = map.grid;
  const isW = (t?: Tile) => !t || t.type === 'deep_ocean' || t.type === 'shallow_water';
  let strait: { start: { x: number; y: number }; end: { x: number; y: number } } | null = null;
  outer:
  for (let x = 4; x < 124; x++) {
    for (let y = 4; y < 124; y++) {
      if (grid[x][y].type !== 'shallow_water') continue;
      let lx = x - 1;
      while (lx > 0 && isW(grid[lx][y])) lx--;
      let rx = x + 1;
      while (rx < 128 && isW(grid[rx][y])) rx++;
      if (x - lx >= 1 && x - lx <= 10 && rx - x >= 1 && rx - x <= 10) {
        strait = { start: { x: lx, y }, end: { x: rx, y } };
        break outer;
      }
    }
  }
  if (!strait) {
    console.log('bridge test skipped (no strait found on this world)');
  } else {
    const landPath = SimplePathfinder.findPath(strait.start.x, strait.start.y, strait.end.x, strait.end.y, map, 'land');
    const roadPath = SimplePathfinder.findPath(strait.start.x, strait.start.y, strait.end.x, strait.end.y, map, 'road');
    const crossesWater = roadPath.some(p => grid[Math.floor(p.x)][Math.floor(p.y)].type === 'shallow_water');
    if (roadPath.length === 0 || !crossesWater) {
      failures++;
      console.log(`FAIL road bridge: land=${landPath.length} road=${roadPath.length} crossesWater=${crossesWater}`);
    } else {
      console.log(`bridge ok: land path=${landPath.length} road path=${roadPath.length} (${roadPath.filter(p => grid[Math.floor(p.x)][Math.floor(p.y)].type === 'shallow_water').length} water tiles bridged)`);
    }
  }
}

console.log(failures === 0 ? 'ALL PRESETS OK' : `${failures} FAILURES`);
