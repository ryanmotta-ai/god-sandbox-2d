import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { CivilizationEngine, CivWorld } from '../src/civ/CivilizationEngine';
import { NavalSystem } from '../src/civ/NavalSystem';
import { ParticleManager } from '../src/renderer/Particles';
import { TradeNetwork } from '../src/civ/Trade';
import { DiplomacyManager } from '../src/civ/Diplomacy';
import { WorldMarket } from '../src/civ/Economy';
import { SimplePathfinder } from '../src/ai/Pathfinding';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
}

console.log('--- RUNNING NAVAL & TRADE AUTOMATED TESTS ---');

// 1. Setup a test map with an ocean between two coastal cities
const mapWidth = 60;
const mapHeight = 40;
const tileMap = new TileMap(mapWidth, mapHeight, 16);

// Fill with grass land first
for (let x = 0; x < mapWidth; x++) {
  for (let y = 0; y < mapHeight; y++) {
    const tile = tileMap.getTile(x, y)!;
    tile.type = TerrainType.GRASS;
  }
}

// Create a sea channel in the middle (x from 22 to 37)
for (let x = 22; x < 38; x++) {
  for (let y = 0; y < mapHeight; y++) {
    const tile = tileMap.getTile(x, y)!;
    tile.type = TerrainType.SHALLOW_WATER;
  }
}

// Rebuild derived indexes / chunk caches if needed
tileMap.rebuildDerivedIndexes();

// Test A: isCoastalLand correctly identifies coastal border
assert(tileMap.isCoastalLand(21, 15), 'Tile (21,15) should be coastal land');
assert(tileMap.isCoastalLand(38, 15), 'Tile (38,15) should be coastal land');
assert(!tileMap.isCoastalLand(5, 5), 'Tile (5,5) should not be coastal land');

console.log('✓ Coastal land detection verified');

// 2. Setup Kingdoms and Cities
const civEngine = new CivilizationEngine();
const trade = new TradeNetwork();
const diplomacy = new DiplomacyManager();
const market = new WorldMarket();
const particles = new ParticleManager();

const world: CivWorld = {
  cities: new Map(),
  kingdoms: new Map(),
  tileMap,
  trade,
  diplomacy,
  market,
  year: 100
};

const kingdomA = new Kingdom('k_alpha', 'Alpha Realm', '#38bdf8', 'human');
const kingdomB = new Kingdom('k_beta', 'Beta Realm', '#fbbf24', 'human');
world.kingdoms.set(kingdomA.id, kingdomA);
world.kingdoms.set(kingdomB.id, kingdomB);

const cityA = new City('c_alpha_port', 'Port Alpha', 'human', 20, 15, 'Founder A', 100);
cityA.kingdomId = kingdomA.id;
cityA.population = 30;
cityA.stock.add('wood', 200);
cityA.stock.add('stone', 150);
cityA.stock.add('cloth', 100);
world.cities.set(cityA.id, cityA);
kingdomA.addCity(cityA.id);

const cityB = new City('c_beta_port', 'Port Beta', 'human', 40, 15, 'Founder B', 100);
cityB.kingdomId = kingdomB.id;
cityB.population = 30;
cityB.stock.add('wood', 200);
cityB.stock.add('stone', 150);
cityB.stock.add('iron', 80);
world.cities.set(cityB.id, cityB);
kingdomB.addCity(cityB.id);

// Discover each other
kingdomA.knownKingdoms.add(kingdomB.id);
kingdomB.knownKingdoms.add(kingdomA.id);

// Test B: Research priority for coastal kingdom
const techChoice = (civEngine as any).chooseTech(kingdomA, world);
assert(techChoice !== null, 'Kingdom should choose a technology');
console.log(`✓ Coastal kingdom AI chose tech: ${techChoice?.name} (${techChoice?.id})`);

// Complete sailing tech for both realms
kingdomA.research.complete('agriculture');
kingdomA.research.complete('pottery');
kingdomA.research.complete('writing');
kingdomA.research.complete('mathematics');
kingdomA.research.complete('sailing');

kingdomB.research.complete('agriculture');
kingdomB.research.complete('pottery');
kingdomB.research.complete('writing');
kingdomB.research.complete('mathematics');
kingdomB.research.complete('sailing');

assert(kingdomA.research.unlockedBuildings().has('harbor'), 'Sailing should unlock harbor');

// Test C: Harbor Construction
// Place harbor in City A and City B directly on coastal spots
const harborA = cityA.addBuilding('harbor', 21, 15);
harborA.completeConstruction(100);
const tileA = tileMap.getTile(21, 15)!;
tileA.buildingId = harborA.id;
tileA.cityId = cityA.id;

const harborB = cityB.addBuilding('harbor', 38, 15);
harborB.completeConstruction(100);
const tileB = tileMap.getTile(38, 15)!;
tileB.buildingId = harborB.id;
tileB.cityId = cityB.id;

assert(cityA.hasBuilding('harbor'), 'City A should have harbor');
assert(cityB.hasBuilding('harbor'), 'City B should have harbor');
console.log('✓ Harbors placed and completed');

// Test D: Route Kind Determination between Port Alpha and Port Beta
const landPath = SimplePathfinder.findPath(cityA.x, cityA.y, cityB.x, cityB.y, tileMap, 'land');
const routeKind = (civEngine as any).determineRouteKind(cityA, cityB, tileMap, landPath);
assert(routeKind === 'maritime', `Route between Port Alpha and Port Beta should be maritime (got: ${routeKind})`);
console.log('✓ determineRouteKind correctly selected maritime route');

// Test E: Open Maritime Trade Route
trade.signAgreement(kingdomA.id, kingdomB.id, 100, 0.05);
const maritimeRoute = trade.openRoute({
  fromCityId: cityA.id,
  toCityId: cityB.id,
  fromKingdomId: kingdomA.id,
  toKingdomId: kingdomB.id,
  kind: 'maritime',
  good: 'cloth',
  volume: 15,
  year: 100
});

assert(maritimeRoute.kind === 'maritime', 'Route should be maritime');
assert(trade.routes.has(maritimeRoute.id), 'Trade network should contain the route');
console.log(`✓ Maritime route opened: ${maritimeRoute.id}`);

// Test F: NavalSystem updates and launches ship
const naval = new NavalSystem();
naval.updateShips(trade.routes, world.cities, world.kingdoms, tileMap, particles, 100);

assert(naval.activeShips.size === 1, `NavalSystem should have 1 active ship (found ${naval.activeShips.size})`);
const ship = naval.activeShips.get(maritimeRoute.id)!;
assert(ship !== undefined, 'Ship should exist for route');
assert(ship.cargo === 'cloth', 'Ship should carry cloth');
assert(ship.path !== undefined && ship.path.length > 0, 'Ship should have calculated sea path');
console.log(`✓ Ship launched! Tier ${ship.tier} (${ship.fromCityName} -> ${ship.toCityName}) with ${ship.path?.length} waypoints`);

// Advance ship ticks
const initialProgress = ship.progress;
for (let tick = 0; tick < 100; tick++) {
  naval.updateShips(trade.routes, world.cities, world.kingdoms, tileMap, particles, 100);
}
assert(ship.progress > initialProgress, `Ship should make progress along water route (was ${initialProgress}, now ${ship.progress})`);
console.log(`✓ Ship sailed forward! Progress: ${(ship.progress * 100).toFixed(2)}%`);

console.log('ALL NAVAL & TRADE TESTS PASSED SUCCESSFULLY! 🎉');
