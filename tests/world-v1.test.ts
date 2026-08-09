import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { SimplePathfinder } from '../src/ai/Pathfinding';
import { CompactTerritory } from '../src/world/CompactTerritory';
import { TERRAINS } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';
import { RegionState } from '../src/world/WorldChunks';

interface WorldMeasurement { size: number; generationMs: number; storageBytes: number; serializedBytes: number; }
const measurements: WorldMeasurement[] = [];
let largest: TileMap | null = null;

for (const size of [128, 256, 512]) {
  const started = performance.now();
  const map = new TileMap(size, size, 'single_continent', 1);
  const generationMs = performance.now() - started;
  assert.equal(map.chunkStore.chunks.length, (size / 32) ** 2);
  assert.equal(map.grid.length, size);
  const sample = map.getTile(Math.floor(size / 2), Math.floor(size / 2))!;
  const previousTraffic = sample.roadTraffic;
  sample.roadTraffic++;
  assert.equal(map.getTile(sample.x, sample.y)!.roadTraffic, previousTraffic + 1, 'facades must persist into SoA storage');
  const regions = map.updateRegionStates(size / 2, size / 2);
  assert.ok(regions.active > 0 && regions.sleeping >= 0);
  assert.equal(map.regionStateAt(size / 2, size / 2), RegionState.ACTIVE);
  const serialized = map.serialize();
  const serializedBytes = JSON.stringify(serialized).length;
  measurements.push({ size, generationMs, storageBytes: map.approximateTileStorageBytes, serializedBytes });
  if (size === 128) {
    const restored = new TileMap(32, 32, 'single_continent', 1);
    restored.deserialize(serialized);
    assert.equal(restored.width, size);
    assert.equal(restored.getTile(sample.x, sample.y)!.roadTraffic, previousTraffic + 1);
  }
  if (size === 512) largest = map;
}

const territory = new CompactTerritory();
for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) territory.add(`${x},${y}`);
assert.equal(territory.size, 10_000);
assert.ok(territory.has('99,99'));
assert.equal([...territory].length, 10_000);

assert.ok(largest);
let endpoints: [{ x: number; y: number }, { x: number; y: number }] | null = null;
let bestRun = 0;
for (let y = 0; y < largest.height; y += 2) {
  let start = -1;
  for (let x = 0; x <= largest.width; x++) {
    const tile = x < largest.width ? largest.getTile(x, y) : null;
    const passable = !!tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable;
    if (passable && start < 0) start = x;
    if ((!passable || x === largest.width) && start >= 0) {
      const length = x - start;
      if (length > bestRun) { bestRun = length; endpoints = [{ x: start + .5, y: y + .5 }, { x: x - .5, y: y + .5 }]; }
      start = -1;
    }
  }
}
assert.ok(endpoints, 'large generated continent should expose a long route');
assert.ok(bestRun > 128, 'large generated continent should expose a route crossing several chunks');
const pathStarted = performance.now();
const path = SimplePathfinder.findPath(endpoints[0].x, endpoints[0].y, endpoints[1].x, endpoints[1].y, largest, 'land', 12_000, 77);
const pathMs = performance.now() - pathStarted;
assert.ok(path.length > 0, 'hierarchical route should connect distant land points');

console.log(JSON.stringify({ measurements, path: { distance: Math.hypot(endpoints[1].x - endpoints[0].x, endpoints[1].y - endpoints[0].y), points: path.length, ms: pathMs } }, null, 2));
console.log('WORLD-V1 architecture tests passed');
