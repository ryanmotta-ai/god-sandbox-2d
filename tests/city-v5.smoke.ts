import assert from 'node:assert/strict';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { UrbanDistrictPlanner, districtAt, measureDistricts } from '../src/civ/UrbanDistricts';
import type { BuildingType, UrbanHistoricalPhase } from '../src/civ/Building';

const map = new TileMap(128, 128, 'single_continent', 5510);
for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
  const tile = map.getTile(x, y)!;
  tile.type = TerrainType.GRASS; tile.height = .42; tile.fertility = .8;
  tile.buildingId = null; tile.cityId = null; tile.kingdomId = null;
  tile.roadLevel = 0; tile.roadTraffic = 0; tile.roadDamage = 0;
  tile.railLevel = 0; tile.railDamage = 0;
}
map.updateRegionStates(64, 64);

function makeCity(id: string, x: number, y: number, prosperity: number): { city: City; kingdom: Kingdom } {
  const city = new City(id, id, SpeciesType.HUMAN, x, y, 'Founder', 1);
  const kingdom = new Kingdom(`realm_${id}`, `Realm ${id}`, SpeciesType.HUMAN, '#7f8f5c', city.id, 1);
  city.kingdomId = kingdom.id; city.population = 120; city.prosperity = prosperity; city.updateTier();
  kingdom.totalPopulation = city.population;
  const center = map.getTile(x, y)!; center.buildingId = `b_tc_${id}`; center.cityId = id; center.kingdomId = kingdom.id;
  for (let dx = -14; dx <= 14; dx++) for (let dy = -14; dy <= 14; dy++) {
    const tile = map.getTile(x + dx, y + dy); if (!tile) continue;
    tile.cityId = id; tile.kingdomId = kingdom.id;
    if (dx === 0 || dy === 0) { tile.roadLevel = 2; tile.roadTraffic = 90; }
  }
  return { city, kingdom };
}

function add(city: City, type: BuildingType, x: number, y: number, phase: UrbanHistoricalPhase = 'city', generation = 2): void {
  const building = city.addBuilding(type, x, y);
  building.recordUrbanOrigin(generation + 1, phase, generation);
  const tile = map.getTile(x, y)!; tile.buildingId = building.id; tile.cityId = city.id; tile.kingdomId = city.kingdomId;
}

const agricultural = makeCity('agraria', 24, 24, .58);
for (const [x, y] of [[17,20],[18,23],[19,27],[22,31],[27,31],[31,27]]) add(agricultural.city, 'farm', x, y);
add(agricultural.city, 'pasture', 17, 27); add(agricultural.city, 'granary', 22, 27);
agricultural.city.ledger.deserialize({ food: { produced: 95, consumed: 45, imported: 0, exported: 25 } });

const industrial = makeCity('ferrovia', 70, 25, .44);
for (let x = 56; x <= 84; x++) {
  const tile = map.getTile(x, 31)!; tile.railLevel = 2; tile.roadLevel = 1; tile.roadTraffic = 115; tile.cityId = industrial.city.id;
}
add(industrial.city, 'factory', 68, 29); add(industrial.city, 'refinery', 72, 29);
add(industrial.city, 'smithy', 66, 27); add(industrial.city, 'workshop', 74, 27);
for (const [x, y] of [[66,34],[68,35],[71,35],[73,34],[75,35]]) add(industrial.city, 'house', x, y, 'great_city', 3);
industrial.city.ledger.deserialize({
  machinery: { produced: 48, consumed: 8, imported: 0, exported: 24 },
  steel: { produced: 38, consumed: 22, imported: 5, exported: 7 },
  coal: { produced: 20, consumed: 35, imported: 20, exported: 0 }
});

const port = makeCity('porto', 25, 79, .67);
for (let x = 8; x <= 42; x++) for (let y = 84; y < 92; y++) map.getTile(x, y)!.type = y === 84 ? TerrainType.SHALLOW_WATER : TerrainType.DEEP_OCEAN;
add(port.city, 'harbor', 23, 83); add(port.city, 'port', 28, 83); add(port.city, 'market', 25, 78); add(port.city, 'workshop', 30, 80);
port.city.ledger.deserialize({
  spices: { produced: 24, consumed: 3, imported: 0, exported: 20 },
  cloth: { produced: 8, consumed: 9, imported: 18, exported: 12 },
  tools: { produced: 4, consumed: 7, imported: 16, exported: 8 }
});

const capital = makeCity('capital', 80, 78, .92);
add(capital.city, 'palace', 80, 75, 'village', 1); add(capital.city, 'market', 78, 79, 'village', 1);
add(capital.city, 'bank', 82, 79, 'city', 2); add(capital.city, 'temple', 78, 75, 'village', 1);
for (const [x, y] of [[86,76],[87,78],[88,80],[85,81],[89,75],[86,83]]) add(capital.city, 'house', x, y, 'great_city', 3);
capital.city.ledger.deserialize({ gold: { produced: 42, consumed: 8, imported: 6, exported: 18 } });

for (const sample of [agricultural, industrial, port, capital]) {
  const changed = UrbanDistrictPlanner.tickCity(sample.city, sample.kingdom, map, 20, 20);
  assert.ok(changed > 0);
  assert.ok(sample.city.urbanDistricts.length > 0);
  assert.equal(UrbanDistrictPlanner.tickCity(sample.city, sample.kingdom, map, 20, 20), 0, 'stable district state should do no repeated work');
}

assert.equal(agricultural.city.urbanSpecialization?.type, 'agricultural');
assert.ok(agricultural.city.urbanDistricts.some(district => district.type === 'rural'));
assert.equal(industrial.city.urbanSpecialization?.type, 'industrial');
assert.ok(industrial.city.urbanDistricts.some(district => district.type === 'industrial'));
assert.ok(industrial.city.urbanDistricts.some(district => district.type === 'railway' || district.secondaryType === 'railway'));
assert.ok(industrial.city.urbanDistricts.some(district => district.type === 'residential_worker' || district.secondaryType === 'residential_worker'));
assert.equal(port.city.urbanSpecialization?.type, 'port');
assert.ok(port.city.urbanDistricts.some(district => district.type === 'port'));
assert.ok(capital.city.urbanDistricts.some(district => district.type === 'historic_core'));
const wealthyResidential = capital.city.urbanDistricts.find(district => district.type === 'residential_rich' || district.secondaryType === 'residential_rich');
assert.ok(wealthyResidential, 'high-value serviced housing should read as wealthy');
assert.ok((districtAt(capital.city, 87, 78)?.landValue ?? 0) > .45);

// A former artisan cell transforms gradually only after decisive later industry arrives.
const transforming = makeCity('transformacao', 105, 30, .52);
add(transforming.city, 'workshop', 106, 31, 'village', 1); add(transforming.city, 'smithy', 108, 31, 'village', 1);
add(transforming.city, 'house', 106, 34, 'city', 2);
UrbanDistrictPlanner.tickCity(transforming.city, transforming.kingdom, map, 5, 16);
const before = districtAt(transforming.city, 107, 31)!;
const beforeType = before.type;
assert.ok(before.type === 'artisan' || before.secondaryType === 'artisan');
for (const [type, x, y] of [['factory',104,32],['factory',109,32],['refinery',107,29]] as Array<[BuildingType, number, number]>) add(transforming.city, type, x, y, 'great_city', 3);
for (let x = 98; x <= 116; x++) map.getTile(x, 36)!.railLevel = 2;
transforming.city.ledger.deserialize({ machinery: { produced: 60, consumed: 10, imported: 0, exported: 30 } });
map.updateRegionStates(transforming.city.x, transforming.city.y);
UrbanDistrictPlanner.tickCity(transforming.city, transforming.kingdom, map, 16, 18);
const after = districtAt(transforming.city, 107, 31)!;
assert.ok(after.type === 'industrial' || after.secondaryType === 'industrial');
assert.ok(after.history.length > 0 || beforeType === after.type, 'functional change keeps a compact history when the dominant type changes');

const loaded = City.deserialize(industrial.city.serialize());
assert.equal(loaded.urbanDistricts.length, industrial.city.urbanDistricts.length);
assert.equal(loaded.urbanSpecialization?.type, 'industrial');

console.log(JSON.stringify({
  agricultural: measureDistricts(agricultural.city),
  industrial: measureDistricts(industrial.city),
  port: measureDistricts(port.city),
  capital: measureDistricts(capital.city),
  transformation: `${beforeType}->${after.type}`,
  incrementalStableWork: 0,
  saveLoad: 'PASS'
}));
