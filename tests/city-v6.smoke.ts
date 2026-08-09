import assert from 'node:assert/strict';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import type { Building, BuildingType } from '../src/civ/Building';
import { UrbanLifecycleManager, measureUrbanLifecycle } from '../src/civ/UrbanLifecycle';
import { buildingArchitecturalStamp, refreshArchitecturalProfile } from '../src/civ/ArchitecturalProfile';
import { chronicle } from '../src/civ/Chronicle';

const map = new TileMap(96, 96, 'single_continent', 6606);
for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
  const tile = map.getTile(x, y)!;
  tile.type = TerrainType.GRASS; tile.height = .42; tile.fertility = .8;
  tile.buildingId = null; tile.cityId = null; tile.kingdomId = null;
  tile.roadLevel = 1; tile.roadDamage = 0; tile.railLevel = 0; tile.railDamage = 0;
  tile.isOnFire = false; tile.fireTimer = 0;
}
map.updateRegionStates(48, 48);
chronicle.clear();

function makeCity(): { city: City; kingdom: Kingdom } {
  const city = new City('city_v6', 'Cinzas Novas', SpeciesType.HUMAN, 48, 48, 'Iria', 1);
  const kingdom = new Kingdom('realm_v6', 'Reino das Cinzas', SpeciesType.HUMAN, '#835f46', city.id, 1);
  city.kingdomId = kingdom.id; city.population = 90; city.peakPopulation = 90; city.prosperity = .82; city.updateTier();
  kingdom.totalPopulation = city.population; kingdom.operatingEra = 'iron'; kingdom.externalThreat = .08;
  const center = map.getTile(city.x, city.y)!;
  center.buildingId = `b_tc_${city.id}`; center.cityId = city.id; center.kingdomId = kingdom.id;
  refreshArchitecturalProfile(city, kingdom, map, 1);
  return { city, kingdom };
}

function add(city: City, type: BuildingType, x: number, y: number): Building {
  const building = city.addBuilding(type, x, y);
  building.recordUrbanOrigin(1, 'city', 2);
  if (city.architecturalProfile) building.recordArchitecture(buildingArchitecturalStamp(city.architecturalProfile, 1));
  building.urbanContext = {
    districtType: type === 'factory' ? 'industrial' : 'residential_common',
    landValue: .48, desirability: .48, accessibility: .55, density: .45, affluence: .5, stampedYear: 1
  };
  const tile = map.getTile(x, y)!;
  tile.buildingId = building.id; tile.cityId = city.id; tile.kingdomId = city.kingdomId;
  return building;
}

const { city, kingdom } = makeCity();

// New work appears as a foundation/build site and only becomes useful after periodic progress.
const newHouse = add(city, 'house', 50, 48);
newHouse.beginConstruction(1);
assert.equal(newHouse.operationalFactor(), 0);
UrbanLifecycleManager.tickCity(city, kingdom, map, 2);
assert.equal(newHouse.lifecycleState, 'construction');
UrbanLifecycleManager.tickCity(city, kingdom, map, 3);
const completed = UrbanLifecycleManager.tickCity(city, kingdom, map, 4);
assert.equal(newHouse.lifecycleState, 'normal');
assert.ok(completed.constructionCompleted >= 1);
assert.ok(city.housingCapacity() > 0, 'normal urban growth must still add usable housing');
assert.equal(UrbanLifecycleManager.tickCity(city, kingdom, map, 4).inspected, 0, 'same-year stable state must do no repeated lifecycle work');

// Existing fire propagation names only the burning building tiles and leaves physical ruins.
const burned = [add(city, 'house', 45, 47), add(city, 'house', 45, 48), add(city, 'house', 45, 49)];
for (const building of burned) map.applyBrush(building.x, building.y, 0, tile => { tile.isOnFire = true; });
for (let tick = 0; tick < 10; tick++) map.updateFireTick();
const fireSummary = UrbanLifecycleManager.applyDamageEvents(new Map([[city.id, city]]), map, map.drainBuildingDamageEvents(), 5);
assert.equal(fireSummary[0]?.fire, 3);
assert.ok(burned.every(building => building.lifecycleState === 'ruin'));
assert.ok(burned.every(building => map.getTile(building.x, building.y)?.buildingId === building.id), 'ruins must retain their footprint');
assert.ok(chronicle.getEvents().some(event => event.tags.includes('fire') && event.refs.some(ref => ref.id === city.id)));

// Real depopulation + economic/job collapse gradually empties a local group.
const declining = [
  add(city, 'factory', 52, 52), add(city, 'factory', 53, 52),
  add(city, 'house', 52, 53), add(city, 'house', 53, 53)
];
for (const building of declining) {
  building.staffing = 0;
  building.urbanContext = {
    districtType: building.type === 'factory' ? 'industrial' : 'residential_worker',
    landValue: .12, desirability: .08, accessibility: .06, density: .35, affluence: .1, stampedYear: 6
  };
}
city.peakPopulation = 120; city.population = 10; city.prosperity = .08; city.famineYears = 4;
for (let year = 6; year <= 10; year++) UrbanLifecycleManager.tickCity(city, kingdom, map, year);
assert.ok(declining.filter(building => building.lifecycleState === 'abandoned').length >= 3, 'caused crisis should create coherent abandonment');

// Prosperity, population, security and materials return; ruins rebuild in the current architecture.
city.population = 105; city.prosperity = .92; city.famineYears = 0;
city.stock.add('wood', 300); city.stock.add('stone', 300); city.stock.add('tools', 100);
kingdom.externalThreat = .02; kingdom.operatingEra = 'industrial';
refreshArchitecturalProfile(city, kingdom, map, 14);
const currentProfileId = city.architecturalProfile!.id;
const reconstruction = UrbanLifecycleManager.tickCity(city, kingdom, map, 14);
assert.ok(reconstruction.reconstructionStarted >= 2, 'healthy demand and resources should begin gradual reconstruction');
for (let year = 15; year <= 20; year++) UrbanLifecycleManager.tickCity(city, kingdom, map, year);
assert.ok(burned.filter(building => building.lifecycleState === 'normal').length >= 2);
assert.ok(burned.filter(building => building.architecture?.profileId === currentProfileId).length >= 2, 'rebuilding must stamp the current architecture');
assert.ok(burned.some(building => building.lifecycleHistory.some(entry => entry.to === 'ruin')));
assert.ok(burned.some(building => building.lifecycleHistory.some(entry => entry.to === 'reconstruction')));

const loaded = City.deserialize(city.serialize());
assert.deepEqual(measureUrbanLifecycle(loaded), measureUrbanLifecycle(city));
assert.ok(loaded.buildings.get(burned[0].id)?.lifecycleHistory.length);
assert.equal(loaded.peakPopulation, city.peakPopulation);

console.log(JSON.stringify({
  construction: 'PASS', fire: fireSummary[0], abandonment: declining.map(building => building.lifecycleState),
  lifecycle: measureUrbanLifecycle(city), historicalRestamp: currentProfileId, saveLoad: 'PASS'
}));
