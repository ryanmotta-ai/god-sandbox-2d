import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import {
  ALL_TECH_IDS, TECHNOLOGIES, operatingEra, techCost, technologyCapacity
} from '../src/civ/TechTree';
import { chronicle } from '../src/civ/Chronicle';
import {
  computeTechnologyUISnapshot, TechnologyUISnapshotCache, technologyUIPerformance,
  type CapabilityView
} from '../src/ui/technology/TechnologyMetrics';
import type { LogisticsMetrics } from '../src/ui/logistics/LogisticsMetrics';

function makeRealm(): { kingdom: Kingdom; cities: Map<string, City> } {
  const capital = new City('c1', 'Ironvale', SpeciesType.LUMINI, 10, 10, 'Founder', 1);
  const second = new City('c2', 'Stonebridge', SpeciesType.LUMINI, 20, 10, 'Founder', 2);
  const kingdom = new Kingdom('k1', 'Aethorian Test Realm', SpeciesType.LUMINI, '#8f7a52', capital.id, 1);
  capital.kingdomId = kingdom.id;
  second.kingdomId = kingdom.id;
  kingdom.cityIds.add(second.id);
  return { kingdom, cities: new Map([[capital.id, capital], [second.id, second]]) };
}

function logisticsFor(kingdom: Kingdom, connected = 0, damaged = 0): LogisticsMetrics {
  const cityIds = [...kingdom.cityIds];
  return {
    year: 100,
    roads: { tiles: 0, byLevel: [0, 0, 0, 0], damagedTiles: 0, totalTraffic: 0, busiest: [], meanLevel: null },
    rail: {
      tiles: connected ? 12 : 0,
      severedTiles: damaged,
      degradedTiles: 0,
      lines: connected ? [{
        id: 'line-1', tiles: 12, quality: damaged ? 0.5 : 1,
        stations: cityIds.slice(0, connected).map((cityId, index) => ({
          cityId, cityName: `City ${index + 1}`, kingdomId: kingdom.id, kingdomName: kingdom.name, x: index * 10, y: 10
        })),
        owners: [{ kingdomId: kingdom.id, name: kingdom.name, color: kingdom.color }],
        goods: ['coal', 'iron'], damagedTiles: damaged, at: { x: 10, y: 10 }, status: damaged ? 'damaged' : 'healthy'
      }] : [],
      strandedStations: [], worldFreight: 0, builtThisYear: 0
    },
    ports: [], routes: [], corridors: [], movers: [],
    cities: cityIds.map((cityId, index) => ({
      cityId, cityName: `City ${index + 1}`, kingdomId: kingdom.id, kingdomName: kingdom.name,
      population: 10, roadLevel: 0, railTiles: index < connected ? 2 : 0,
      railConnected: index < connected, hasPort: false, portOperational: false,
      routesIn: 0, routesOut: 0, routesClosed: 0, isolated: !connected,
      importedGoods: [], x: index * 10, y: 10
    })),
    bottlenecks: [], landTradeVolume: 0, seaTradeVolume: 0, activeRoutes: 0,
    closedRoutes: 0, totalTradeValue: 0, activeCaravans: 0, activeShips: 0
  };
}

function context(kingdom: Kingdom, cities: Map<string, City>, entities: any[] = []): any {
  return {
    sim: { currentYear: 100, cities, kingdoms: new Map([[kingdom.id, kingdom]]), entities }
  };
}

function refreshEngineCapacity(kingdom: Kingdom, cities: Map<string, City>): void {
  const realmCities = [...cities.values()];
  const hasBuilding = (type: any) => realmCities.some(city => city.hasBuilding(type));
  const canObtain = (good: any) => realmCities.some(city => {
    const flow = city.ledger.flow(good);
    return city.stock.get(good) > 0 || flow.produced > 0 || flow.imported > 0;
  });
  kingdom.techCapabilities = technologyCapacity(kingdom.research, hasBuilding, canObtain);
  kingdom.operatingEra = operatingEra(kingdom.research, kingdom.techCapabilities);
}

function capability(snapshot: ReturnType<typeof computeTechnologyUISnapshot>, techId: string): CapabilityView {
  const result = snapshot.capabilities.find(item => item.techId === techId);
  assert.ok(result, `expected capability for ${techId}`);
  return result;
}

chronicle.clear();

// 1. Full real tree, AND prerequisites, availability and city-scaled cost.
{
  const { kingdom, cities } = makeRealm();
  kingdom.research.current = 'stone_tools';
  kingdom.research.progress = 10;
  refreshEngineCapacity(kingdom, cities);
  const snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  assert.equal(snapshot.technologies.length, ALL_TECH_IDS.length);
  assert.equal(snapshot.current?.cost, techCost(TECHNOLOGIES.stone_tools, 2), 'UI uses expansion-scaled cost');
  assert.equal(snapshot.technologies.find(view => view.definition.id === 'bronze_working')?.status, 'locked');
  assert.equal(snapshot.technologies.find(view => view.definition.id === 'stone_tools')?.status, 'researching');
}

// 2. An undiscovered technology cannot have a deployable capability.
{
  const { kingdom, cities } = makeRealm();
  refreshEngineCapacity(kingdom, cities);
  const snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  assert.equal(snapshot.capabilities.some(item => item.techId === 'steam_power'), false);
  assert.equal(snapshot.current, null, 'early-game realm has no active research');
  assert.equal(snapshot.technologies.find(item => item.definition.id === 'stone_tools')?.status, 'available');
}

// 3. Steam knowledge without Coal/Iron or rail is materially unavailable.
{
  const { kingdom, cities } = makeRealm();
  kingdom.research.complete('steam_power');
  refreshEngineCapacity(kingdom, cities);
  const snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  const steam = capability(snapshot, 'steam_power');
  assert.equal(steam.state, 'unavailable');
  assert.deepEqual(new Set(steam.missingGoods), new Set(['coal', 'iron']));
  assert.equal(kingdom.research.knows('steam_power'), true, 'knowledge remains even when capability is absent');
  assert.equal(snapshot.knownEra, 'industrial', 'knowledge advances the known era');
  assert.equal(snapshot.operatingEra, 'stone', 'weak material capacity leaves operation behind knowledge');
}

// 4. Materials make railway capability available; connected cities deploy it.
{
  const { kingdom, cities } = makeRealm();
  kingdom.research.complete('steam_power');
  cities.get('c1')!.stock.add('coal', 20);
  cities.get('c1')!.stock.add('iron', 20);
  refreshEngineCapacity(kingdom, cities);
  let snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  assert.equal(capability(snapshot, 'steam_power').state, 'available', 'requirements exist but no railway is deployed');
  snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom, 2));
  assert.equal(capability(snapshot, 'steam_power').state, 'deployed');
  assert.equal(capability(snapshot, 'steam_power').infrastructure[0].deployed, 2);
}

// 5. Destroyed rail lowers deployment while knowledge remains discovered.
{
  const { kingdom, cities } = makeRealm();
  kingdom.research.complete('steam_power');
  cities.get('c1')!.stock.add('coal', 20);
  cities.get('c1')!.stock.add('iron', 20);
  refreshEngineCapacity(kingdom, cities);
  const snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom, 1, 4));
  assert.equal(capability(snapshot, 'steam_power').state, 'limited');
  assert.equal(kingdom.research.knows('steam_power'), true);
}

// 6. Industrialization requires its real industry and strategic materials.
{
  const { kingdom, cities } = makeRealm();
  kingdom.research.complete('industrialization');
  refreshEngineCapacity(kingdom, cities);
  let snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  assert.equal(capability(snapshot, 'industrialization').state, 'unavailable');

  const capital = cities.get('c1')!;
  const factory = capital.addBuilding('factory', 10, 10);
  capital.addBuilding('oil_well', 11, 10);
  capital.addBuilding('refinery', 12, 10);
  for (const good of ['coal', 'oil', 'rubber', 'steel'] as const) capital.stock.add(good, 30);
  capital.ledger.recordProduced('fuel', 8);
  capital.ledger.recordProduced('machinery', 5);
  capital.ledger.rollOver();
  refreshEngineCapacity(kingdom, cities);
  snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  const industry = capability(snapshot, 'industrialization');
  assert.equal(industry.missingBuildings.length, 0);
  assert.equal(industry.missingGoods.length, 0);
  assert.ok(industry.goods.find(item => item.good === 'fuel')?.producing);

  capital.removeBuilding(factory.id);
  refreshEngineCapacity(kingdom, cities);
  snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  assert.ok(capability(snapshot, 'industrialization').missingBuildings.includes('factory'), 'destroyed industry changes deployment diagnosis');
}

// 7. Real military adoption is counted from equipped soldiers, not inferred.
{
  const { kingdom, cities } = makeRealm();
  kingdom.research.complete('gunpowder');
  for (const good of ['saltpeter', 'coal'] as const) cities.get('c1')!.stock.add(good, 20);
  refreshEngineCapacity(kingdom, cities);
  const entities = [
    { kingdomId: kingdom.id, hp: 10, profession: 'soldier', equipment: { weapon: { name: 'Mosquete de Mecha' } } },
    { kingdomId: kingdom.id, hp: 10, profession: 'soldier', equipment: { weapon: { name: 'Espada Larga de Ferro' } } }
  ];
  const snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities, entities), logisticsFor(kingdom));
  const deployment = capability(snapshot, 'gunpowder').military;
  assert.equal(deployment?.adopted, 1);
  assert.equal(deployment?.total, 2);
}

// 8. Research-source allocation reconciles to the engine-recorded total.
{
  const { kingdom, cities } = makeRealm();
  const capital = cities.get('c1')!;
  capital.population = 20;
  capital.addBuilding('library', 10, 10);
  capital.researchOutput = 42;
  kingdom.research.output = 42;
  refreshEngineCapacity(kingdom, cities);
  const snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  const sum = snapshot.researchSources.reduce((total, source) => total + source.amount, 0);
  assert.ok(Math.abs(sum - 42) < 1e-8);
  assert.ok(snapshot.researchSources.some(source => source.id === 'population'));
  assert.ok(snapshot.researchSources.some(source => source.id === 'building:library'));
}

// 9. Chronicle years are the only source of recent-discovery dates.
{
  const { kingdom, cities } = makeRealm();
  kingdom.research.complete('stone_tools');
  chronicle.log(77, 'tech', `${kingdom.name} learned stone tools.`, {
    refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }, { kind: 'tech', id: 'stone_tools', name: 'Stone Tools' }],
    tags: ['technology']
  });
  refreshEngineCapacity(kingdom, cities);
  const snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  assert.equal(snapshot.recentDiscoveries[0]?.event.year, 77);
  chronicle.clear();
}

// 10. Navigation wiring remains present for every mandatory cross-link.
{
  const screen = readFileSync(new URL('../src/ui/screens/TechTreeScreen.ts', import.meta.url), 'utf8');
  const tabs = readFileSync(new URL('../src/ui/technology/TechnologyTabs.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const alerts = readFileSync(new URL('../src/ui/core/Alerts.ts', import.meta.url), 'utf8');
  assert.match(screen, /screens\.open\('chronicle'/, 'Technology to Chronicle');
  assert.match(tabs, /kind: 'building'/, 'Technology to Building');
  assert.match(screen, /screens\.open\('economy', \{ good \}\)/, 'Technology → Good/Economy');
  assert.match(screen, /screens\.open\('infrastructure'/, 'Technology → Infrastructure');
  assert.match(screen, /screens\.open\('city'/, 'Technology → City');
  assert.match(screen, /screens\.open\('realm'/, 'Technology → Realm');
  assert.match(main, /registerOpener\('technology'/, 'ObjectLink → Technology');
  assert.match(alerts, /kind: 'technology'.*context:/s, 'Alert → Technology with realm context');
}

// 11. Snapshot generation stays comfortably outside frame-time work.
{
  const { kingdom, cities } = makeRealm();
  for (const id of ALL_TECH_IDS) kingdom.research.complete(id);
  refreshEngineCapacity(kingdom, cities);
  const started = performance.now();
  const snapshot = computeTechnologyUISnapshot(kingdom, context(kingdom, cities), logisticsFor(kingdom));
  const elapsed = performance.now() - started;
  assert.equal(snapshot.technologies.length, ALL_TECH_IDS.length);
  assert.equal(technologyUIPerformance.capabilitySnapshotMs, snapshot.buildTimeMs);
  assert.ok(elapsed < 1000, `snapshot should be cached-scale work, got ${elapsed.toFixed(2)}ms`);
  console.log(`[technology-ui] snapshot ${elapsed.toFixed(2)}ms · internal ${snapshot.buildTimeMs.toFixed(2)}ms`);
}

// 12. Repeated updates reuse the same snapshot until a year boundary invalidates it.
{
  const { kingdom, cities } = makeRealm();
  const ctx = context(kingdom, cities);
  const logistics = logisticsFor(kingdom);
  const cache = new TechnologyUISnapshotCache();
  const first = cache.get(kingdom, ctx, logistics, 100);
  const started = performance.now();
  const cached = cache.get(kingdom, ctx, logistics, 101);
  const updateMs = performance.now() - started;
  assert.equal(cached, first, 'same-year update should be a cache hit');
  ctx.sim.currentYear++;
  assert.notEqual(cache.get(kingdom, ctx, logistics, 102), first, 'year transition rebuilds the snapshot');
  assert.ok(updateMs < 10, `cached update should be negligible, got ${updateMs.toFixed(3)}ms`);
  console.log(`[technology-ui] cached update ${updateMs.toFixed(3)}ms`);
}

console.log('technology-ui.test: all assertions passed');
