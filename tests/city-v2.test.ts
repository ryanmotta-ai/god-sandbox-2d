import { strict as assert } from 'node:assert';
import { BUILDINGS } from '../src/civ/Building';
import { City } from '../src/civ/City';
import { UrbanPlanner } from '../src/civ/UrbanPlanner';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

function flatMap(size = 72): TileMap {
  const map = new TileMap(size, size, 'single_continent', 2202);
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) {
    const tile = map.grid[x][y];
    tile.type = TerrainType.GRASS; tile.height = .5; tile.fertility = .7;
    tile.resourceType = null; tile.resourceAmount = 0; tile.resourceMax = 0;
    tile.buildingId = null; tile.cityId = null; tile.kingdomId = null;
    tile.roadLevel = 0; tile.roadTraffic = 0; tile.railLevel = 0;
  }
  return map;
}

function occupy(map: TileMap, city: City, type: 'house' | 'market', x: number, y: number, year: number, generation: number) {
  const building = city.addBuilding(type, x, y);
  building.recordUrbanOrigin(year, city.urbanPhase, generation);
  const tile = map.getTile(x, y)!; tile.buildingId = building.id; tile.cityId = city.id;
  UrbanPlanner.recordConstruction(city, map, building.id);
  return building;
}

const map = flatMap();
const city = new City('historic', 'Oldbridge', SpeciesType.HUMAN, 36, 36, 'Founder', 10);
map.getTile(36, 36)!.buildingId = `b_tc_${city.id}`;
map.getTile(36, 36)!.cityId = city.id;

// Historical high streets predate the later rings.
for (let offset = -12; offset <= 12; offset++) {
  for (const [x, y] of [[36 + offset, 36], [36, 36 + offset]]) {
    const tile = map.getTile(x, y)!; tile.roadLevel = 1; tile.roadTraffic = 90;
    map.markRoadNetworkChanged(x, y);
  }
}

const initial = UrbanPlanner.structure(city, map, 17);
const oldHouses = [
  occupy(map, city, 'house', 33, 34, 11, 0), occupy(map, city, 'house', 39, 34, 12, 0),
  occupy(map, city, 'house', 33, 38, 13, 0), occupy(map, city, 'house', 39, 38, 14, 0)
];
assert.equal(UrbanPlanner.structure(city, map, 17), initial, 'old-core construction must update the cache in place');

// A tier jump creates a new historical generation without rewriting the old core.
city.tier = 'metropolis';
assert.equal(city.recordUrbanPhase(80, 17), true);
assert.equal(city.currentUrbanGeneration, 4);
assert.deepEqual(city.urbanHistory.map(record => record.phase), ['settlement', 'metropolis']);
assert.ok(oldHouses.every(building => building.originPhase === 'settlement' && building.visualPhase === 'settlement'));
const matureStructure = UrbanPlanner.structure(city, map, 17);

const candidates = UrbanPlanner.findBuildingSites(city, BUILDINGS.house, map, 17, 8);
assert.ok(candidates.length > 0);
const firstExpansionDistance = Math.hypot(candidates[0].x - city.x, candidates[0].y - city.y);
assert.ok(firstExpansionDistance > 4.2, `later housing should form an outer expansion, got radius ${firstExpansionDistance.toFixed(2)}`);
assert.ok(candidates[0].historicalGrowthScore > -20, 'the chosen expansion should agree with the historical ring score');

const newHouse = occupy(map, city, 'house', candidates[0].x, candidates[0].y, 81, city.currentUrbanGeneration);
const updated = UrbanPlanner.structure(city, map, 17);
assert.equal(updated, matureStructure, 'one later building must not regenerate the complete urban fabric');
const newLot = updated.lots.get(newHouse.x * map.height + newHouse.y);
assert.equal(newLot?.originYear, 81);
assert.equal(newLot?.originGeneration, 4);

// Renovation is per-building; neighbours remain visually old.
oldHouses[0].recordRenovation(92, city.urbanPhase);
assert.equal(oldHouses[0].visualPhase, 'metropolis');
assert.ok(oldHouses.slice(1).every(building => building.visualPhase === 'settlement'));

// Provenance is save data; derived blocks/lots are intentionally not.
const loaded = City.deserialize(city.serialize());
assert.deepEqual(loaded.urbanHistory, city.urbanHistory);
const loadedOld = loaded.buildings.get(oldHouses[0].id)!;
const loadedNew = loaded.buildings.get(newHouse.id)!;
assert.equal(loadedOld.builtYear, 11);
assert.equal(loadedOld.renovatedYear, 92);
assert.equal(loadedOld.visualPhase, 'metropolis');
assert.equal(loadedNew.originGeneration, 4);
assert.equal(loadedNew.originPhase, 'metropolis');
assert.equal(loaded.x, 36, 'the historic centre remains the founding coordinate');
assert.equal(loaded.y, 36, 'the historic centre remains the founding coordinate');

console.log('city-v2.test: historical core, expansion rings, incremental provenance, gradual renovation and save/load passed');
