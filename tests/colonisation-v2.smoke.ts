import { TICKS_PER_YEAR } from '../src/core/Clock';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/ai/EntityAI';
import { SimplePathfinder } from '../src/ai/Pathfinding';
import { Building } from '../src/civ/Building';
import { City } from '../src/civ/City';
import { CivilizationEngine, type CivWorld } from '../src/civ/CivilizationEngine';
import { Kingdom } from '../src/civ/Kingdom';
import { rng } from '../src/core/Random';
import { SpeciesType } from '../src/entities/Species';
import { TERRAINS } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

rng.setSeed(20260809);
const tileMap = new TileMap(72, 72, 'single_continent', 20260809);
const sim = new SimulationEngine();

function landNear(x: number, y: number, distantFrom?: { x: number; y: number }): { x: number; y: number } {
  for (let radius = 0; radius < 60; radius++) for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
    const tile = tileMap.getTile(x + dx, y + dy);
    if (!tile || TERRAINS[tile.type].isWater) continue;
    if (distantFrom && (Math.hypot(tile.x - distantFrom.x, tile.y - distantFrom.y) < 26 || !SimplePathfinder.findPath(distantFrom.x, distantFrom.y, tile.x, tile.y, tileMap, 'land').length)) continue;
    return { x: tile.x, y: tile.y };
  }
  throw new Error('no suitable land');
}

function addCitizens(city: City, realm: Kingdom, count: number): void {
  for (let i = 0; i < count; i++) {
    const citizen = sim.spawnEntity(SpeciesType.HUMAN, city.x, city.y, tileMap);
    citizen.cityId = city.id;
    citizen.kingdomId = realm.id;
    sim.entities.push(citizen);
  }
}

function addFarm(city: City, x: number, y: number, index: number): void {
  const tile = tileMap.getTile(x, y)!;
  tile.resourceType = 'cotton';
  tile.resourceAmount = 80;
  tile.resourceMax = 80;
  tile.cityId = city.id;
  tile.kingdomId = city.kingdomId;
  tile.buildingId = `farm-${index}`;
  city.territory.add(`${x},${y}`);
  city.buildings.set(`farm-${index}`, new Building(`farm-${index}`, 'farm', x, y, city.id));
}

const metroPos = landNear(14, 14);
const colonyPos = landNear(57, 57, metroPos);
const metroCity = new City('metro-city', 'Aurelia', SpeciesType.HUMAN, metroPos.x, metroPos.y, 'Founder', 1);
const colonyCity = new City('colony-city', 'Algodão', SpeciesType.HUMAN, colonyPos.x, colonyPos.y, 'Founder', 1);
const metropole = new Kingdom('metro', 'Reino Aurelia', SpeciesType.HUMAN, '#d97706', metroCity.id, 1);
const colony = new Kingdom('colony', 'Colônia Algodão', SpeciesType.HUMAN, '#d97706', colonyCity.id, 1);
colony.establishColony(metropole.id, 'overland');
metropole.addColony(colony.id);
metropole.research.known.add('pottery');
metroCity.kingdomId = metropole.id;
colonyCity.kingdomId = colony.id;
metroCity.stock.add('food', 120);
colonyCity.stock.add('food', 180);
tileMap.getTile(metroPos.x, metroPos.y)!.cityId = metroCity.id;
tileMap.getTile(metroPos.x, metroPos.y)!.kingdomId = metropole.id;
tileMap.getTile(colonyPos.x, colonyPos.y)!.cityId = colonyCity.id;
tileMap.getTile(colonyPos.x, colonyPos.y)!.kingdomId = colony.id;
sim.cities.set(metroCity.id, metroCity);
sim.cities.set(colonyCity.id, colonyCity);
sim.kingdoms.set(metropole.id, metropole);
sim.kingdoms.set(colony.id, colony);

const workshopTile = landNear(metroPos.x + 1, metroPos.y + 1);
metroCity.buildings.set('workshop', new Building('workshop', 'workshop', workshopTile.x, workshopTile.y, metroCity.id));
for (let i = 0; i < 5; i++) addFarm(colonyCity, colonyPos.x + 1 + i, colonyPos.y + 1, i);
addCitizens(metroCity, metropole, 5);
addCitizens(colonyCity, colony, 10);

const world: CivWorld = {
  year: 1, cities: sim.cities, kingdoms: sim.kingdoms, entities: sim.entities,
  tileMap, diplomacy: sim.diplomacy, market: sim.market, trade: sim.trade,
  spawn: (species, x, y) => sim.spawnEntity(species, x, y, tileMap), sim
};
const civ = new CivilizationEngine();
// Civilisation runs continuously now, so a headless driver has to hand it a
// clock and step it a year of ticks at a time instead of calling one pulse.
let civTick = 0;
const runYear = () => { civTick = civ.advanceTicks(world, civTick, TICKS_PER_YEAR); civ.tickYearBoundary(world); };

runYear(); // Farms produce actual cotton; COL-V2 opens and runs the route.
const cottonRoute = [...sim.trade.routes.values()].find(route => route.colonialRoute && route.good === 'cotton');
assert.ok(cottonRoute, 'colonial cotton surplus should create a preferential route');
assert.ok(metroCity.stock.get('cotton') > 0, 'real cotton stock should reach the metropole');
assert.ok(colonyCity.ledger.flow('cotton').exported > 0, 'the colony must export cotton from its real stock');
assert.ok(metroCity.ledger.flow('cotton').imported > 0, 'the metropole must import that colonial cotton');

world.year = 2;
runYear(); // The workshop consumes imported cotton and produces cloth.
const clothWithRoute = metroCity.ledger.flow('cloth').produced;
assert.ok(clothWithRoute > 0, 'metropole textile production must use colonial cotton');

cottonRoute.active = false;
(civ as any).runTradeRoutes(world); // Records the logistics interruption before the embargo keeps it closed.
sim.trade.declareEmbargo(metropole.id, colony.id, world.year, 'COL-V2 smoke blockade');
assert.ok(sim.trade.isEmbargoed(metropole.id, colony.id), 'the blockade embargo must be active');
assert.equal(sim.trade.routes.size, 0, 'the blockade must close its existing colonial routes');
world.year = 3;
runYear();
world.year = 4;
runYear();
const clothWithoutRoute = metroCity.ledger.flow('cloth').produced;
assert.ok(clothWithoutRoute < clothWithRoute, 'blocked colonial cotton must reduce textile output');
assert.equal(sim.trade.routes.size, 0, 'the embargo should remove the colonial route');

console.log(`COL-V2 smoke passed: cotton ${clothWithRoute.toFixed(1)} cloth with route -> ${clothWithoutRoute.toFixed(1)} after blockade`);
