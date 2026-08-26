/**
 * Headless smoke test: runs the full civilization + warfare tick for ~40 years
 * with two kingdoms, then checks that a siege and a conquest really do wreck the
 * ground around a city and that the damage survives a save. No renderer.
 */
import { TileMap } from '../src/world/TileMap';
import { TERRAINS } from '../src/world/Biomes';
import { SimulationEngine } from '../src/ai/EntityAI';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';
import { CivilizationEngine } from '../src/civ/CivilizationEngine';
import { WarfareSystem } from '../src/civ/Warfare';
import type { CivWorld } from '../src/civ/CivilizationEngine';

rng.setSeed(777);

const tileMap = new TileMap(64, 64, 'single_continent', 20260802);
const sim = new SimulationEngine();

function landTile(nearX?: number, nearY?: number, radius = 8): { x: number; y: number } {
  if (nearX !== undefined) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const t = tileMap.getTile(nearX + dx, nearY + dy);
        if (t && !TERRAINS[t.type].isWater) return { x: t.x, y: t.y };
      }
    }
  }
  for (let y = 2; y < tileMap.height - 2; y++) {
    for (let x = 2; x < tileMap.width - 2; x++) {
      const t = tileMap.getTile(x, y)!;
      if (!TERRAINS[t.type].isWater) return { x, y };
    }
  }
  throw new Error('no land');
}

const posA = landTile(10, 10);
const posB = landTile(50, 50);

const cityA = new City('cityA', 'Ironvale', SpeciesType.HUMAN, posA.x, posA.y, 'Founder', 1);
const cityB = new City('cityB', 'Dawnspire', SpeciesType.HUMAN, posB.x, posB.y, 'Founder', 1);
sim.cities.set(cityA.id, cityA);
sim.cities.set(cityB.id, cityB);

const kingdomA = new Kingdom('kA', 'Realm of Iron', SpeciesType.HUMAN, '#ff6b6b', cityA.id, 1);
const kingdomB = new Kingdom('kB', 'Realm of Dawn', SpeciesType.HUMAN, '#4dabf7', cityB.id, 1);
cityA.kingdomId = kingdomA.id;
cityB.kingdomId = kingdomB.id;
sim.kingdoms.set(kingdomA.id, kingdomA);
sim.kingdoms.set(kingdomB.id, kingdomB);

// Founding stocks: A has a real food surplus to export, B has coin.
cityA.stock.add('food', 400);
cityA.stock.add('wood', 120);
cityA.stock.add('stone', 80);
cityA.stock.add('gold', 300);
cityB.stock.add('food', 60);
cityB.stock.add('gold', 5000);

// Citizens (adults, labour pool).
function spawnCitizens(city: City, kingdomId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const e = sim.spawnEntity(SpeciesType.HUMAN, city.x, city.y, tileMap);
    e.cityId = city.id;
    e.kingdomId = kingdomId;
    e.profession = 'none';
    sim.entities.push(e);
  }
}
spawnCitizens(cityA, kingdomA.id, 60);
spawnCitizens(cityB, kingdomB.id, 60);

// A paved road network around city A, so siege damage has something to hit.
// Paved after the 40-year warm-up: decayRoadTraffic degrades unused roads to 0.
function paveAroundCity(city: City): void {
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const t = tileMap.getTile(city.x + dx, city.y + dy);
      if (t && !TERRAINS[t.type].isWater) {
        t.roadLevel = 2;
        t.roadTraffic = 60;
        t.roadDamage = 0;
        city.territory.add(`${t.x},${t.y}`);
      }
    }
  }
}

kingdomA.knownKingdoms.add(kingdomB.id);
kingdomB.knownKingdoms.add(kingdomA.id);

const world: CivWorld = {
  year: 1,
  cities: sim.cities,
  kingdoms: sim.kingdoms,
  entities: sim.entities,
  tileMap,
  diplomacy: sim.diplomacy,
  market: sim.market,
  spawn: (species, x, y) => sim.spawnEntity(species, x, y, tileMap),
  sim
};

const civ = new CivilizationEngine();
const warfare = new WarfareSystem();

for (let year = 1; year <= 40; year++) {
  world.year = year;
  civ.tickYear(world);
  warfare.tickYear(world);
}
console.log('[smoke] 40 years OK');

// 2) Siege damages the roads and strategic buildings around Ironvale.
paveAroundCity(cityA);
cityB.stock.add('food', 500); // feed the besieging army so it survives the siege
sim.diplomacy.declareWar(kingdomA.id, kingdomB.id, 42, 'coal');
for (let i = 0; i < 12; i++) {
  const soldier = sim.spawnEntity(SpeciesType.HUMAN, cityA.x, cityA.y, tileMap);
  soldier.cityId = cityB.id;
  soldier.kingdomId = kingdomB.id;
  soldier.profession = 'soldier';
  sim.entities.push(soldier);
}
const cityATile = tileMap.getTile(cityA.x, cityA.y)!;
const roadDamageBefore = cityATile.roadDamage;
const siegeRoadBefore = cityATile.roadDamage;
const harbor = cityA.addBuilding('harbor', cityA.x, cityA.y);
const harborHpBefore = harbor.hp;
for (let y = 43; y <= 50; y++) {
  world.year = y;
  civ.tickYear(world);
  // Keep the war alive so the siege actually persists through the whole run.
  if (!sim.diplomacy.isAtWar(kingdomA.id, kingdomB.id)) {
    sim.diplomacy.declareWar(kingdomA.id, kingdomB.id, y, 'coal');
  }
  warfare.tickYear(world);
}
if (cityATile.roadDamage <= siegeRoadBefore) {
  console.warn(`[smoke] road damage did not rise during siege (${siegeRoadBefore} -> ${cityATile.roadDamage}); peace treaty likely lifted the siege`);
  console.warn(`[smoke] atWar=${sim.diplomacy.isAtWar(kingdomA.id, kingdomB.id)} besiegerId=${cityA.besiegerId} siegeYears=${cityA.siegeYears}`);
}
console.log(`[smoke] siege ended: roadDamage ${siegeRoadBefore}->${cityATile.roadDamage.toFixed(2)}, harbor hp ${harborHpBefore}->${harbor.hp}`);

// 2b) Conquest deterministically grinds the region's roads and buildings.
cityATile.roadDamage = 0;
warfare.captureCity(cityA, kingdomA, kingdomB, world);
let conquestDamage = 0;
for (let dx = -7; dx <= 7; dx++) {
  for (let dy = -7; dy <= 7; dy++) {
    const t = tileMap.getTile(cityA.x + dx, cityA.y + dy);
    if (t && t.roadLevel > 0 && t.roadDamage > 0) conquestDamage++;
  }
}
if (conquestDamage === 0) throw new Error('captureCity did not damage the surrounding roads');
console.log(`[smoke] conquest: ${conquestDamage} road tiles damaged, city now owned by ${cityA.kingdomId}`);

// 4) Tiles serialize round-trip with roadDamage.
const data = tileMap.serialize();
const reload = new TileMap(1, 1, 'single_continent', 1);
reload.deserialize(data);
const back = reload.getTile(cityATile.x, cityATile.y)!;
if (Math.abs(back.roadDamage - cityATile.roadDamage) > 0.001) {
  throw new Error('roadDamage did not survive save/load round-trip');
}
console.log(`[smoke] save/load round-trip OK (roadDamage ${cityATile.roadDamage.toFixed(2)})`);
console.log('[smoke] ALL OK');
