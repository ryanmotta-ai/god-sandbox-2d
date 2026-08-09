import { strict as assert } from 'node:assert';
import { BUILDINGS, Building } from '../src/civ/Building';
import { City, type SettlementTier } from '../src/civ/City';
import { UrbanPlanner } from '../src/civ/UrbanPlanner';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

function flatMap(size = 96): TileMap {
  const map = new TileMap(size, size, 'single_continent', 1701);
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) {
    const tile = map.grid[x][y];
    tile.type = TerrainType.GRASS;
    tile.height = .5;
    tile.fertility = .72;
    tile.resourceType = null;
    tile.resourceAmount = 0;
    tile.resourceMax = 0;
    tile.buildingId = null;
    tile.cityId = null;
    tile.kingdomId = null;
    tile.roadLevel = 0;
    tile.roadTraffic = 0;
    tile.railLevel = 0;
  }
  return map;
}

function makeCity(map: TileMap, id: string, x: number, y: number, tier: SettlementTier): City {
  const city = new City(id, id, SpeciesType.HUMAN, x, y, 'Founder', 1);
  city.tier = tier;
  const center = map.getTile(x, y)!;
  center.buildingId = `b_tc_${id}`;
  center.cityId = id;
  return city;
}

function addBuilding(map: TileMap, city: City, type: keyof typeof BUILDINGS, x: number, y: number): Building {
  const building = city.addBuilding(type, x, y);
  const tile = map.getTile(x, y)!;
  tile.buildingId = building.id;
  tile.cityId = city.id;
  UrbanPlanner.recordConstruction(city, map, building.id);
  return building;
}

function layStreet(map: TileMap, city: City, points: Array<{ x: number; y: number }>, streetClass: 'primary' | 'secondary'): void {
  for (const point of points) {
    const tile = map.getTile(point.x, point.y)!;
    tile.roadLevel = 1;
    tile.roadTraffic = streetClass === 'primary' ? 90 : 35;
    map.markRoadNetworkChanged(point.x, point.y);
  }
  UrbanPlanner.recordStreetPath(city, map, points, streetClass);
}

// Camp -> village -> city -> great city changes the cached street/block form.
{
  const map = flatMap();
  const stages: Array<[SettlementTier, string]> = [
    ['camp', 'camp'], ['village', 'village'], ['city', 'city'], ['metropolis', 'great_city']
  ];
  for (const [tier, expected] of stages) {
    const city = makeCity(map, `stage-${tier}`, 20 + stages.indexOf(stages.find(item => item[0] === tier)!) * 18, 20, tier);
    assert.equal(UrbanPlanner.structure(city, map, 12).stage, expected);
  }
}

// One construction and one street update mutate the same cached fabric instead
// of rescanning the complete city radius.
{
  const map = flatMap(64);
  const city = makeCity(map, 'incremental', 30, 30, 'village');
  const before = UrbanPlanner.structure(city, map, 14);
  const house = addBuilding(map, city, 'house', 28, 28);
  const afterBuilding = UrbanPlanner.structure(city, map, 14);
  assert.equal(afterBuilding, before, 'a single building must keep the derived urban cache resident');
  assert.ok(afterBuilding.buildings.some(item => item.id === house.id));
  assert.equal(afterBuilding.lots.get(28 * map.height + 28)?.occupied, true);

  const street = [{ x: 30, y: 29 }, { x: 30, y: 28 }, { x: 29, y: 28 }];
  layStreet(map, city, street, 'primary');
  const afterStreet = UrbanPlanner.structure(city, map, 14);
  assert.equal(afterStreet, before, 'a local street extension must update the cache in place');
  assert.equal(afterStreet.streets.get(30 * map.height + 29), 'primary');
  assert.equal(afterStreet.lots.get(29 * map.height + 28), undefined, 'street tiles are no longer lots');
}

// Residential and commercial growth fronts streets and preserves their tiles.
{
  const map = flatMap(72);
  const city = makeCity(map, 'street-town', 36, 36, 'town');
  layStreet(map, city, Array.from({ length: 17 }, (_, i) => ({ x: 28 + i, y: 36 })), 'primary');
  layStreet(map, city, Array.from({ length: 11 }, (_, i) => ({ x: 32, y: 31 + i })), 'secondary');
  const houses = UrbanPlanner.findBuildingSites(city, BUILDINGS.house, map, 15, 8);
  const markets = UrbanPlanner.findBuildingSites(city, BUILDINGS.market, map, 15, 8);
  assert.ok(houses.length >= 4 && markets.length >= 4);
  for (const site of [...houses, ...markets]) {
    const tile = map.getTile(site.x, site.y)!;
    assert.equal(tile.roadLevelEffective, 0, 'buildings never consume a realised street');
    assert.equal(tile.railLevelEffective, 0, 'buildings never consume rail reserve');
  }
  assert.ok(markets[0].urbanFormScore > -20, 'the market should find a coherent central/frontage site');
}

// Coast and railway constrain the plan without a global layout rebuild.
{
  const map = flatMap(80);
  for (let y = 0; y < 80; y++) map.grid[55][y].type = TerrainType.SHALLOW_WATER;
  const city = makeCity(map, 'port-rail', 46, 40, 'city');
  layStreet(map, city, Array.from({ length: 17 }, (_, i) => ({ x: 39 + i, y: 40 })), 'primary');
  for (let y = 31; y <= 49; y++) {
    map.grid[50][y].railLevel = 1;
    map.markRailNetworkChanged(50, y);
  }
  const harbor = UrbanPlanner.findBuildingSites(city, BUILDINGS.harbor, map, 15, 5);
  assert.ok(harbor.length > 0 && harbor.every(site => map.isCoastalLand(site.x, site.y)), 'harbors stay on the coast');
  const factory = UrbanPlanner.findBuildingSites(city, BUILDINGS.factory, map, 15, 8);
  const homes = UrbanPlanner.findBuildingSites(city, BUILDINGS.house, map, 15, 8);
  assert.ok(factory.length > 0 && homes.length > 0);
  assert.ok(factory.every(site => map.getTile(site.x, site.y)!.railLevelEffective === 0), 'industry reserves the track itself');
  const factoryRailDistance = Math.min(...factory.map(site => Math.abs(site.x - 50)));
  const homeRailDistance = Math.min(...homes.map(site => Math.abs(site.x - 50)));
  assert.ok(factoryRailDistance <= homeRailDistance, 'production is at least as rail-oriented as housing');
}

console.log('city-v1.test: organic stages, streets, blocks, coast, rail and incremental cache passed');
