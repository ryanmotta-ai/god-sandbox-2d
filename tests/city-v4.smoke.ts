import assert from 'node:assert/strict';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { DiplomacyManager } from '../src/civ/Diplomacy';
import { FortificationPlanner, isFortificationBarrierId, pointInsideFortification } from '../src/civ/FortificationPlanner';
import { SimplePathfinder } from '../src/ai/Pathfinding';

const map = new TileMap(72, 72, 'single_continent', 4404);
for (let x = 8; x < 64; x++) for (let y = 8; y < 64; y++) {
  const tile = map.getTile(x, y)!;
  tile.type = TerrainType.GRASS;
  tile.height = .45;
  tile.buildingId = null;
  tile.cityId = null;
  tile.kingdomId = null;
  tile.railLevel = 0;
  tile.roadLevel = x === 36 || y === 36 ? 2 : 0;
}

const city = new City('city_v4_smoke', 'Porta Velha', SpeciesType.HUMAN, 36, 36, 'Ada', 1);
const kingdom = new Kingdom('realm_v4_smoke', 'Reino da Porta', SpeciesType.HUMAN, '#9b5c42', city.id, 1);
city.kingdomId = kingdom.id;
kingdom.totalPopulation = 100;
kingdom.externalThreat = .72;
kingdom.operatingEra = 'iron';
kingdom.research.known.add('masonry');
city.population = 10;
city.prosperity = .9;
city.updateTier();
const diplomacy = new DiplomacyManager();
const cadenceYear = (from: number): number => {
  let year = from;
  while ((year + Math.abs([...city.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0))) % 3 !== 0) year++;
  return year;
};

let year = cadenceYear(6);
assert.equal(FortificationPlanner.tickCity(city, kingdom, { year, tileMap: map, diplomacy }).built, null, 'small hamlets must remain unwalled');

city.population = 105;
city.updateTier();
city.stock.add('stone', 180);
city.stock.add('wood', 120);
for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
  if ((dx === 0 && dy === 0) || Math.abs(dx) + Math.abs(dy) > 6 || dx === 0 || dy === 0) continue;
  const x = 36 + dx, y = 36 + dy;
  const building = city.addBuilding((dx + dy) % 4 === 0 ? 'market' : 'house', x, y);
  building.recordUrbanOrigin(2 + Math.abs(dx) + Math.abs(dy), 'city', 2);
  const tile = map.getTile(x, y)!;
  tile.buildingId = building.id; tile.cityId = city.id; tile.kingdomId = kingdom.id;
}

year = cadenceYear(year + 3);
const first = FortificationPlanner.tickCity(city, kingdom, { year, tileMap: map, diplomacy }).built;
assert.ok(first, 'an important threatened masonry city should build a wall');
assert.ok(first!.perimeter >= 12);
assert.ok(first!.gateIds.length >= 2);
assert.ok(first!.towerIds.length > 0);
assert.ok(first!.buildingIds.every(id => city.buildings.get(id)?.fortificationLineId === first!.id));
assert.ok(first!.gateIds.every(id => city.buildings.get(id)?.fortificationRole === 'gate'));
assert.ok(first!.buildingIds.some(id => isFortificationBarrierId(id)));

const outsideGate = city.buildings.get(first!.gateIds[0])!;
const outwardX = outsideGate.x + Math.sign(outsideGate.x - city.x) * 4;
const outwardY = outsideGate.y + Math.sign(outsideGate.y - city.y) * 4;
const route = SimplePathfinder.findPath(city.x, city.y, outwardX, outwardY, map, 'land', 8000);
assert.ok(route.length > 0, 'citizens and trade routes must leave the enclosure');
assert.ok(route.some(point => map.getTile(point.x, point.y)?.buildingId?.startsWith('fort_gate_')), 'the route should cross a gate');

let addedOutside = 0;
for (let radius = 10; radius <= 20 && addedOutside < 24; radius++) for (let angle = 0; angle < 40 && addedOutside < 24; angle++) {
  const x = Math.round(city.x + Math.cos(angle / 40 * Math.PI * 2) * radius);
  const y = Math.round(city.y + Math.sin(angle / 40 * Math.PI * 2) * radius);
  const tile = map.getTile(x, y);
  if (!tile || tile.buildingId || tile.roadLevelEffective > 0 || pointInsideFortification(first!, x + .5, y + .5)) continue;
  const building = city.addBuilding(addedOutside % 4 === 0 ? 'workshop' : 'house', x, y);
  building.recordUrbanOrigin(year + 2, 'great_city', 3);
  tile.buildingId = building.id; tile.cityId = city.id; tile.kingdomId = kingdom.id;
  addedOutside++;
}
assert.ok(addedOutside >= 10, 'the smoke scene needs a real extramural suburb');
city.population = 190;
city.updateTier();
kingdom.totalPopulation = 190;
city.stock.add('stone', 220);
city.stock.add('wood', 140);
year = cadenceYear(year + 15);
const secondResult = FortificationPlanner.tickCity(city, kingdom, { year, tileMap: map, diplomacy });
const second = secondResult.built;
if (!second) console.log({
  secondWallReason: secondResult.reason, addedOutside, firstPerimeter: first!.perimeter,
  age: year - first!.builtYear,
  outsideShare: [...city.buildings.values()].filter(building => !building.fortificationRole)
    .filter(building => !pointInsideFortification(first!, building.x + .5, building.y + .5)).length
    / [...city.buildings.values()].filter(building => !building.fortificationRole).length
});
assert.ok(second, 'sustained extramural growth should permit a second line');
assert.equal(first!.status, 'historic', 'the old line must survive as an internal historical wall');
assert.equal(city.fortificationLines.length, 2);
assert.ok(second!.perimeter > first!.perimeter, 'the second enclosure should be larger');

const loaded = City.deserialize(city.serialize());
assert.equal(loaded.fortificationLines.length, 2, 'wall history must survive .aethoria save/load');
assert.equal(loaded.buildings.get(first!.gateIds[0])?.fortificationRole, 'gate');
assert.ok(loaded.defenseMultiplier() > 1, 'fortifications must contribute bounded real defence');

console.log(JSON.stringify({
  smallCity: 'PASS', firstWall: 'PASS', gates: first!.gateIds.length,
  towers: first!.towerIds.length, extramuralBuildings: addedOutside,
  secondWall: 'PASS', oldWallPreserved: first!.status === 'historic', saveLoad: 'PASS'
}));
