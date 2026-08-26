import { TICKS_PER_YEAR } from '../src/core/Clock';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/ai/EntityAI';
import { CivilizationEngine, type CivWorld } from '../src/civ/CivilizationEngine';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { TERRAINS } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';
import { rng } from '../src/core/Random';

rng.setSeed(20260808);
const tileMap = new TileMap(96, 96, 'single_continent', 20260808);
const sim = new SimulationEngine();

function landAt(preferX: number, preferY: number, farFrom?: { x: number; y: number }): { x: number; y: number } {
  for (let radius = 0; radius < 80; radius++) for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
    const tile = tileMap.getTile(preferX + dx, preferY + dy);
    if (!tile || TERRAINS[tile.type].isWater || (farFrom && Math.hypot(tile.x - farFrom.x, tile.y - farFrom.y) < 30)) continue;
    return { x: tile.x, y: tile.y };
  }
  throw new Error('no suitable land');
}

const origin = landAt(18, 18);
const destination = landAt(76, 76, origin);
const capital = new City('metro-city', 'Aurelia', SpeciesType.HUMAN, origin.x, origin.y, 'Founder', 1);
const metropole = new Kingdom('metro', 'Reino Aurelia', SpeciesType.HUMAN, '#dd8844', capital.id, 1);
capital.kingdomId = metropole.id;
capital.population = 50;
capital.stock.add('food', 500);
capital.stock.add('wood', 200);
metropole.economy.treasury = 500;
metropole.research.known.add('sailing');
tileMap.getTile(origin.x, origin.y)!.cityId = capital.id;
tileMap.getTile(origin.x, origin.y)!.kingdomId = metropole.id;
sim.cities.set(capital.id, capital);
sim.kingdoms.set(metropole.id, metropole);

for (let i = 0; i < 50; i++) {
  const citizen = sim.spawnEntity(SpeciesType.HUMAN, origin.x, origin.y, tileMap);
  citizen.cityId = capital.id;
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
(civ as any).foundColonialRealm(capital, { ...destination, access: 'overland', distance: Math.hypot(destination.x - origin.x, destination.y - origin.y) }, metropole, world);

const colony = [...sim.kingdoms.values()].find(realm => realm.metropoleId === metropole.id);
assert.ok(colony, 'the metropole should found a colonial realm');
assert.equal(colony.colonialStatus, 'COLONY');
assert.ok(metropole.colonyIds.has(colony.id));
assert.ok(colony.name.startsWith('Colônia '));
const colonialCapital = sim.cities.get(colony.capitalCityId)!;
const territoryAtFoundation = colonialCapital.territory.size;

world.year = 2;
runYear();
assert.ok(colonialCapital.territory.size > territoryAtFoundation, 'the colony should expand its own territory');
assert.equal(colony.metropoleId, metropole.id, 'growth must preserve subordination to the metropole');
assert.equal(colony.colonialStatus, 'COLONY');

console.log(`COL-V1 smoke passed: ${metropole.name} -> ${colony.name}`);
