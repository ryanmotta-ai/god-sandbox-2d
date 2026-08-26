import { TICKS_PER_YEAR } from '../src/core/Clock';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/ai/EntityAI';
import { City } from '../src/civ/City';
import { CivilizationEngine, type CivWorld } from '../src/civ/CivilizationEngine';
import { Kingdom } from '../src/civ/Kingdom';
import { rng } from '../src/core/Random';
import { SpeciesType } from '../src/entities/Species';
import { TERRAINS } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

rng.setSeed(20260810);
const tileMap = new TileMap(80, 80, 'single_continent', 20260810);
const sim = new SimulationEngine();

function landNear(x: number, y: number, minimumDistance = 0, from?: { x: number; y: number }): { x: number; y: number } {
  for (let radius = 0; radius < 70; radius++) for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
    const tile = tileMap.getTile(x + dx, y + dy);
    if (!tile || TERRAINS[tile.type].isWater) continue;
    if (from && Math.hypot(tile.x - from.x, tile.y - from.y) < minimumDistance) continue;
    return { x: tile.x, y: tile.y };
  }
  throw new Error('no suitable land');
}

const origin = landNear(16, 16);
const destination = landNear(64, 64, 30, origin);
const city = new City('metro-city', 'Aurelia', SpeciesType.HUMAN, origin.x, origin.y, 'Founder', 1);
const metropole = new Kingdom('metro', 'Reino Aurelia', SpeciesType.HUMAN, '#c2410c', city.id, 1);
city.kingdomId = metropole.id;
city.population = 50;
city.stock.add('food', 500);
city.stock.add('wood', 200);
metropole.economy.treasury = 500;
tileMap.getTile(origin.x, origin.y)!.cityId = city.id;
tileMap.getTile(origin.x, origin.y)!.kingdomId = metropole.id;
sim.cities.set(city.id, city);
sim.kingdoms.set(metropole.id, metropole);
for (let i = 0; i < 50; i++) {
  const citizen = sim.spawnEntity(SpeciesType.HUMAN, origin.x, origin.y, tileMap);
  citizen.cityId = city.id;
  citizen.kingdomId = metropole.id;
  sim.entities.push(citizen);
}

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
(civ as any).foundColonialRealm(city, { ...destination, access: 'overland', distance: Math.hypot(destination.x - origin.x, destination.y - origin.y) }, metropole, world);
const colony = [...sim.kingdoms.values()].find(realm => realm.metropoleId === metropole.id)!;
const colonialCapital = sim.cities.get(colony.capitalCityId)!;
const territoryAtFoundation = colonialCapital.territory.size;

world.year = 2;
runYear();
assert.ok(colonialCapital.territory.size > territoryAtFoundation, 'the colonial realm should grow before the crisis');

// Deliberately severe, observable conditions drive a deterministic separatist sequence.
colony.colonialIdentity = 0.99;
colony.colonialAutonomy = 0.95;
colony.colonialTension = 0.99;
colony.colonialLoyalty = 0.01;
colony.economy.stability = 0.05;
colony.foodSecurity = 0.05;
colony.warWeariness = 80;
colony.totalPopulation = 100;
metropole.totalPopulation = 10;
world.diplomacy.setRelation(colony.id, metropole.id, -80);

world.year = 12;
(civ as any).tickColonialPolitics(world);
assert.equal(colony.separatistMovement, 'organizing', 'pressure should create a separatist movement');
world.year = 14;
(civ as any).tickColonialPolitics(world);
assert.equal(colony.separatistMovement, 'revolt', 'the movement should escalate into revolt');
assert.ok(world.diplomacy.isAtWar(colony.id, metropole.id), 'the metropole should attempt repression through war');

colony.foreignSupport = 1;
world.year = 16;
(civ as any).tickColonialPolitics(world);
assert.equal(colony.colonialStatus, 'INDEPENDENT', 'the colonial realm should become independent');
assert.equal(colony.metropoleId, null);
assert.ok(!metropole.colonyIds.has(colony.id));
assert.equal(colonialCapital.kingdomId, colony.id, 'cities and territory remain under the new independent realm');

world.year = 17;
runYear();
assert.ok(sim.kingdoms.has(colony.id), 'the new realm continues through the normal simulation');

console.log(`COL-V3 smoke passed: ${colony.name} became independent and remained active`);
