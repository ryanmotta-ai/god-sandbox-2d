import { strict as assert } from 'node:assert';
import { SpatialHash } from '../src/core/SpatialHash';
import { Entity } from '../src/entities/Entity';
import { SpeciesType } from '../src/entities/Species';
import { classifyEntity, EntityRelevanceTracker, shouldTickEntity } from '../src/perf/EntityRelevance';
import { SimulationScheduler } from '../src/perf/SimulationScheduler';
import { TileMap } from '../src/world/TileMap';
import { TERRAINS } from '../src/world/Biomes';
import { SimplePathfinder } from '../src/ai/Pathfinding';
import { RailwayNetwork } from '../src/civ/RailwayNetwork';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SimulationEngine } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { rng } from '../src/core/Random';

function landPoints(map: TileMap, count: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let x = 1; x < map.width - 1 && points.length < count; x++) {
    for (let y = 1; y < map.height - 1 && points.length < count; y++) {
      const tile = map.getTile(x, y)!;
      if (!TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) points.push({ x, y });
    }
  }
  return points;
}

// Incremental spatial index and allocation-reusing viewport query.
{
  const index = new SpatialHash<Entity>(8);
  const a = new Entity('a', SpeciesType.HUMAN, 2, 2);
  const b = new Entity('b', SpeciesType.HUMAN, 20, 20);
  index.insert(a); index.insert(b);
  assert.equal(index.size, 2);
  assert.deepEqual(index.queryRect(0, 0, 8, 8).map(e => e.id), ['a']);
  a.x = 18; a.y = 18; index.update(a, 2, 2);
  assert.equal(index.queryRadius(20, 20, 5).length, 2);
  index.remove(b);
  assert.equal(index.size, 1);
}

// HOT/WARM/COLD policy and stable phasing.
{
  const entity = new Entity('stable-phase', SpeciesType.HUMAN, 5, 5);
  const context = { centerX: 0, centerY: 0, hotRadius: 10, warmRadius: 30 };
  assert.equal(classifyEntity(entity, context), 'hot');
  entity.x = 20; assert.equal(classifyEntity(entity, context), 'warm');
  entity.x = 80; assert.equal(classifyEntity(entity, context), 'cold');
  entity.hp = entity.maxHp * 0.2; assert.equal(classifyEntity(entity, context), 'hot');
  entity.hp = entity.maxHp;
  const due = Array.from({ length: 30 }, (_, tick) => shouldTickEntity(entity, 'cold', tick)).filter(Boolean).length;
  assert.equal(due, 1, 'a cold entity runs exactly once per 30-tick phase');

  const tracker = new EntityRelevanceTracker();
  entity.x = 5;
  assert.equal(tracker.classify(entity, context, 0), 'hot');
  entity.x = 20;
  assert.equal(tracker.classify(entity, context, 30), 'hot', 'hysteresis holds hot at the boundary');
  assert.equal(tracker.classify(entity, context, 61), 'warm');
  entity.x = 80;
  assert.equal(tracker.classify(entity, context, 120), 'warm');
  assert.equal(tracker.classify(entity, context, 242), 'cold');
  assert.equal(tracker.classify(entity, { ...context, selectedEntityIds: new Set([entity.id]) }, 243), 'hot');
}

// Scheduler preserves fixed ordering and bounds both burst and debt.
{
  const scheduler = new SimulationScheduler({ frameBudgetMs: 1000, maxTicksPerFrame: 4, maxDebtTicks: 7 });
  const ticks: number[] = [];
  const first = scheduler.runFrame(20, tick => ticks.push(tick));
  assert.equal(first.ticksRun, 4);
  assert.equal(first.remainingDebt, 3);
  scheduler.runFrame(1, tick => ticks.push(tick));
  assert.deepEqual(ticks, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(scheduler.pendingTicks <= 7);

  for (const speed of [1, 2, 5, 10]) {
    const speedScheduler = new SimulationScheduler({ frameBudgetMs: 1000, maxTicksPerFrame: 20 });
    assert.equal(speedScheduler.runFrame(speed, () => {}).ticksRun, speed, `${speed}x schedules the expected fixed ticks when budget allows`);
  }
}

// Bounded path cache, hits and versioned invalidation.
{
  const map = new TileMap(40, 40, 'single_continent', 9191);
  const points = landPoints(map, 20);
  assert.ok(points.length >= 2);
  SimplePathfinder.configureCache(true);
  SimplePathfinder.clearPathCache();
  const from = points[0]; const to = points[points.length - 1];
  const first = SimplePathfinder.findPath(from.x, from.y, to.x, to.y, map, 'land');
  const second = SimplePathfinder.findPath(from.x, from.y, to.x, to.y, map, 'land');
  assert.deepEqual(second, first);
  assert.equal(SimplePathfinder.cacheStats().hits, 1);
  map.markTerrainChanged(from.x, from.y);
  SimplePathfinder.findPath(from.x, from.y, to.x, to.y, map, 'land');
  assert.equal(SimplePathfinder.cacheStats().misses, 2);
  for (let seed = 0; seed < 300; seed++) SimplePathfinder.findPath(from.x, from.y, to.x, to.y, map, 'land', 3000, seed + 1);
  assert.ok(SimplePathfinder.cacheStats().size <= SimplePathfinder.cacheStats().limit);
}

// Event-indexed fire and topology-versioned rail components.
{
  const map = new TileMap(48, 48, 'single_continent', 5150);
  const points = landPoints(map, 12);
  map.ignite(points[0].x, points[0].y);
  assert.ok(map.updateFireTick() >= 1);

  const rail = new RailwayNetwork();
  const row = points.find(point => {
    for (let x = point.x; x < Math.min(map.width - 1, point.x + 5); x++) {
      const tile = map.getTile(x, point.y);
      if (!tile || TERRAINS[tile.type].isWater) return false;
    }
    return true;
  });
  assert.ok(row);
  for (let x = row!.x; x < row!.x + 5; x++) rail.layTrack(map, x, row!.y, 'realm');
  assert.equal(rail.components(map).length, 1);
  rail.removeTrack(map, row!.x + 2, row!.y);
  assert.equal(rail.components(map).length, 2);
}

// Cold abstraction never replaces or mutates identity/state ownership fields.
{
  const map = new TileMap(64, 64, 'single_continent', 1234);
  const point = landPoints(map, 1)[0];
  const sim = new SimulationEngine();
  const entity = sim.spawnEntity(SpeciesType.HUMAN, point.x, point.y, map);
  entity.cityId = 'city-stable';
  entity.kingdomId = 'realm-stable';
  const identity = { id: entity.id, name: entity.name, cityId: entity.cityId, kingdomId: entity.kingdomId };
  const particles = new ParticleManager();
  for (let tick = 0; tick < 60; tick++) sim.tickAI(map, particles, { centerX: map.width + 100, centerY: map.height + 100, hotRadius: 5, warmRadius: 10 });
  assert.equal(sim.entities.length, 1);
  assert.deepEqual({ id: entity.id, name: entity.name, cityId: entity.cityId, kingdomId: entity.kingdomId }, identity);

  for (let i = 0; i < 1000; i++) particles.spawnParticle(point.x, point.y, '#fff');
  assert.ok(particles.activeParticles.length <= 250, 'particle storage remains globally bounded');
}

// Same-seed macro consistency across one complete simulated year.
function runMacroYear(entityLOD: boolean) {
  rng.setSeed(770077);
  const map = new TileMap(64, 64, 'single_continent', 770077);
  const points = landPoints(map, 400);
  const aPos = points[0];
  const bPos = points[points.length - 1];
  const sim = new SimulationEngine();
  sim.performanceFeatures.entityLOD = entityLOD;
  const cityA = new City('macro-a', 'A', SpeciesType.HUMAN, aPos.x, aPos.y, 'A', 1);
  const cityB = new City('macro-b', 'B', SpeciesType.HUMAN, bPos.x, bPos.y, 'B', 1);
  const realmA = new Kingdom('realm-a', 'Realm A', SpeciesType.HUMAN, '#ef4444', cityA.id, 1);
  const realmB = new Kingdom('realm-b', 'Realm B', SpeciesType.HUMAN, '#3b82f6', cityB.id, 1);
  cityA.kingdomId = realmA.id; cityB.kingdomId = realmB.id;
  sim.cities.set(cityA.id, cityA); sim.cities.set(cityB.id, cityB);
  sim.kingdoms.set(realmA.id, realmA); sim.kingdoms.set(realmB.id, realmB);
  realmA.knownKingdoms.add(realmB.id); realmB.knownKingdoms.add(realmA.id);
  sim.diplomacy.setRelation(realmA.id, realmB.id, 20);
  sim.trade.signAgreement(realmA.id, realmB.id, 1, 0.05);
  for (const city of [cityA, cityB]) {
    city.stock.add('food', 300); city.stock.add('wood', 150); city.stock.add('stone', 100); city.stock.add('gold', 500);
  }
  for (let i = 0; i < 40; i++) {
    const city = i < 20 ? cityA : cityB;
    const realm = i < 20 ? realmA : realmB;
    const entity = sim.spawnEntity(SpeciesType.HUMAN, city.x + (i % 4) * 0.2, city.y + (i % 5) * 0.2, map);
    entity.cityId = city.id; entity.kingdomId = realm.id;
  }
  const particles = new ParticleManager();
  for (let tick = 0; tick < 7200; tick++) {
    sim.tickAI(map, particles, { centerX: cityA.x, centerY: cityA.y, hotRadius: 12, warmRadius: 24 });
  }
  return {
    population: sim.entities.length,
    cities: sim.cities.size,
    production: [...sim.cities.values()].reduce((sum, city) => sum + city.economicOutput, 0),
    routes: sim.trade.routes.size,
    wars: sim.diplomacy.activeWars.size,
    technologies: [...sim.kingdoms.values()].reduce((sum, kingdom) => sum + kingdom.research.known.size, 0)
  };
}

{
  const full = runMacroYear(false);
  const lod = runMacroYear(true);
  const ratio = (a: number, b: number) => Math.abs(a - b) / Math.max(1, a);
  assert.ok(ratio(full.population, lod.population) <= 0.25, `population diverged: ${JSON.stringify({ full, lod })}`);
  assert.equal(lod.cities, full.cities);
  assert.ok(ratio(full.production, lod.production) <= 0.35, `production diverged: ${JSON.stringify({ full, lod })}`);
  assert.ok(Math.abs(full.routes - lod.routes) <= 2);
  assert.ok(Math.abs(full.wars - lod.wars) <= 1);
  assert.ok(Math.abs(full.technologies - lod.technologies) <= 2);
}

console.log('[PERF-V1] all performance foundation checks passed');
