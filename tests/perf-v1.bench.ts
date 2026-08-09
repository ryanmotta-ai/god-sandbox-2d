import { TileMap } from '../src/world/TileMap';
import { SimulationEngine } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { Entity } from '../src/entities/Entity';
import { SpeciesType } from '../src/entities/Species';
import { TERRAINS } from '../src/world/Biomes';
import { SimplePathfinder } from '../src/ai/Pathfinding';
import { DiplomacyManager } from '../src/civ/Diplomacy';

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    averageMs: Number((sum / sorted.length).toFixed(3)),
    p95Ms: Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(3)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(3))
  };
}

function makeEntityScenario(count: number, lod: boolean) {
  const map = new TileMap(128, 128, 'single_continent', 20260808);
  const land: Array<{ x: number; y: number }> = [];
  for (let x = 1; x < map.width - 1; x++) for (let y = 1; y < map.height - 1; y++) {
    const tile = map.getTile(x, y)!;
    if (!TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) land.push({ x, y });
  }
  const sim = new SimulationEngine();
  sim.performanceFeatures.entityLOD = lod;
  for (let i = 0; i < count; i++) {
    const point = land[(i * 7919) % land.length];
    const entity = new Entity(`bench-${i}`, SpeciesType.HUMAN, point.x + 0.25, point.y + 0.25);
    sim.entities.push(entity);
    sim.spatialHash.insert(entity);
  }
  return { map, sim, particles: new ParticleManager() };
}

function benchEntities(count: number, lod: boolean, samples: number = 30) {
  const { map, sim, particles } = makeEntityScenario(count, lod);
  const context = { centerX: 10, centerY: 10, hotRadius: 24, warmRadius: 56 };
  for (let i = 0; i < 5; i++) sim.tickAI(map, particles, context);
  const timings: number[] = [];
  for (let i = 0; i < samples; i++) {
    const started = performance.now();
    sim.tickAI(map, particles, context);
    timings.push(performance.now() - started);
  }
  return stats(timings);
}

function pathEndpoints(map: TileMap) {
  const land: Array<{ x: number; y: number }> = [];
  for (let x = 2; x < map.width - 2; x++) for (let y = 2; y < map.height - 2; y++) {
    const tile = map.getTile(x, y)!;
    if (!TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) land.push({ x, y });
  }
  return { from: land[0], to: land[land.length - 1] };
}

function benchRepeatedPath(cache: boolean) {
  const map = new TileMap(128, 128, 'single_continent', 20260808);
  const { from, to } = pathEndpoints(map);
  SimplePathfinder.configureCache(cache);
  SimplePathfinder.clearPathCache();
  const timings: number[] = [];
  for (let i = 0; i < 100; i++) {
    const started = performance.now();
    SimplePathfinder.findPath(from.x, from.y, to.x, to.y, map, 'land', 6000);
    timings.push(performance.now() - started);
  }
  return { ...stats(timings), cache: SimplePathfinder.cacheStats() };
}

function benchStableWorld(size: number) {
  const map = new TileMap(size, size, 'single_continent', 20260808);
  map.updateFluidTick();
  while (true) {
    const before = map.terrainVersion;
    map.updateFluidTick();
    if (before === map.terrainVersion) break;
  }
  const fireStarted = performance.now();
  const fires = map.updateFireTick();
  const fireMs = performance.now() - fireStarted;
  const fluidStarted = performance.now();
  map.updateFluidTick();
  const fluidMs = performance.now() - fluidStarted;
  return { size, tiles: size * size, noFireTickMs: Number(fireMs.toFixed(4)), stableFluidTickMs: Number(fluidMs.toFixed(4)), fires };
}

function benchTileSave(size: number) {
  const map = new TileMap(size, size, 'single_continent', 20260808);
  const serializeStarted = performance.now();
  const serialized = map.serialize();
  const serializeMs = performance.now() - serializeStarted;
  const stringifyStarted = performance.now();
  const json = JSON.stringify(serialized);
  const stringifyMs = performance.now() - stringifyStarted;
  return {
    size,
    bytes: new TextEncoder().encode(json).byteLength,
    bytesPerTile: Number((new TextEncoder().encode(json).byteLength / (size * size)).toFixed(1)),
    serializeMs: Number(serializeMs.toFixed(3)),
    stringifyMs: Number(stringifyMs.toFixed(3))
  };
}

function benchDiplomacy(realms: number) {
  const ids = Array.from({ length: realms }, (_, index) => `realm-${index}`);
  const full = new DiplomacyManager();
  const fullTimings: number[] = [];
  for (let sample = 0; sample < 30; sample++) {
    const started = performance.now();
    full.tickDiplomacy(ids, 100);
    fullTimings.push(performance.now() - started);
  }
  const sliced = new DiplomacyManager();
  const sliceTimings: number[] = [];
  for (let sample = 0; sample < 100; sample++) {
    const started = performance.now();
    sliced.tickDiplomacySlice(ids, 100, sample % 10, 10);
    sliceTimings.push(performance.now() - started);
  }
  return { realms, pairs: realms * (realms - 1) / 2, fullPairSpike: stats(fullTimings), staggeredSlice: stats(sliceTimings) };
}

const report = {
  generatedAt: new Date().toISOString(),
  entities: {
    count: 2500,
    legacyFullTick: benchEntities(2500, false),
    relevanceLOD: benchEntities(2500, true)
  },
  populationScale: [
    { scenario: 'SMALL', entities: 500, timings: benchEntities(500, true, 20) },
    { scenario: 'MEDIUM', entities: 2500, timings: benchEntities(2500, true, 20) },
    { scenario: 'LARGE', entities: 10000, timings: benchEntities(10000, true, 12) },
    { scenario: 'STRESS', entities: 25000, timings: benchEntities(25000, true, 8) }
  ],
  repeatedPath100: {
    cacheDisabled: benchRepeatedPath(false),
    cacheEnabled: benchRepeatedPath(true)
  },
  stableWorldScans: [64, 128, 256].map(benchStableWorld),
  tileSave: [64, 128, 256].map(benchTileSave),
  diplomacy: benchDiplomacy(100)
};

SimplePathfinder.configureCache(true);
if (report.entities.relevanceLOD.averageMs >= report.entities.legacyFullTick.averageMs * 0.9) {
  throw new Error('PERF-V1 regression: relevance LOD no longer improves the 2,500-entity scenario by at least 10%');
}
if (report.repeatedPath100.cacheEnabled.cache.hits < 90) {
  throw new Error('PERF-V1 regression: repeated path cache hit rate fell below 90%');
}
console.log(JSON.stringify(report, null, 2));
