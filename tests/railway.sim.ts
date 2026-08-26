/**
 * End-to-end railway integration test: drives the REAL CivilizationEngine
 * yearly loop (including the world.sim.railways hook) from a coal producer to
 * a steel forger, then severs the line in war and proves freight stops, and
 * heals it and proves freight resumes.
 *
 * No renderer, no per-frame A*. Everything goes through the shipped hook:
 * CivWorld -> tickYear -> world.sim.railways.tickRailways.
 */
import { TileMap } from '../src/world/TileMap';
import { TERRAINS } from '../src/world/Biomes';
import { SimulationEngine } from '../src/ai/EntityAI';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';
import { CivilizationEngine, CivWorld } from '../src/civ/CivilizationEngine';

rng.setSeed(20260802);

const tileMap = new TileMap(48, 48, 'single_continent', 20260802);
const sim = new SimulationEngine();

function landRow(fromX: number, toX: number): number {
  for (let y = 4; y < tileMap.height - 4; y++) {
    let ok = true;
    for (let x = fromX; x <= toX; x++) {
      const t = tileMap.getTile(x, y);
      if (!t || TERRAINS[t.type].isWater) { ok = false; break; }
    }
    if (ok) return y;
  }
  const midY = 24;
  for (let x = fromX; x <= toX; x++) {
    const t = tileMap.getTile(x, midY);
    if (t) {
      t.type = 'grass' as any;
      t.height = 0.5;
    }
  }
  return midY;
}

const PRODUCER_X = 8;
const CONSUMER_X = 40;
const LINE_Y = landRow(PRODUCER_X, CONSUMER_X);

const producer = new City('p', 'Coalfield', SpeciesType.HUMAN, PRODUCER_X, LINE_Y, 'Founder', 1);
const consumer = new City('c', 'Steelforge', SpeciesType.HUMAN, CONSUMER_X, LINE_Y, 'Founder', 1);
sim.cities.set(producer.id, producer);
sim.cities.set(consumer.id, consumer);

const kingdom = new Kingdom('k', 'Raildom', SpeciesType.HUMAN, '#ff6b6b', producer.id, 1);
kingdom.cityIds.add(consumer.id);
kingdom.research.complete('metallurgy');
kingdom.research.complete('steam_power');
producer.kingdomId = kingdom.id;
consumer.kingdomId = kingdom.id;
sim.kingdoms.set(kingdom.id, kingdom);

// Producer: a working coal mine with a full stockpile to fund construction.
tileMap.getTile(PRODUCER_X, LINE_Y)!.cityId = producer.id;
tileMap.getTile(CONSUMER_X, LINE_Y)!.cityId = consumer.id;
const mine = producer.addBuilding('mine', PRODUCER_X, LINE_Y);
mine.extractedGood = 'coal';
mine.staffing = 1;
consumer.addBuilding('smithy', CONSUMER_X, LINE_Y);
producer.stock.capacity = 5000;
producer.stock.add('coal', 300);
producer.stock.add('steel', 600);
producer.stock.add('wood', 600);

// Citizens so the settlement tick has a labour pool.
function spawnCitizens(city: City, count: number): void {
  for (let i = 0; i < count; i++) {
    const e = sim.spawnEntity(SpeciesType.HUMAN, city.x, city.y, tileMap);
    e.cityId = city.id;
    e.kingdomId = kingdom.id;
    e.profession = 'none';
    sim.entities.push(e);
  }
}
spawnCitizens(producer, 40);
spawnCitizens(consumer, 40);

const world: CivWorld = {
  year: 1,
  cities: sim.cities,
  kingdoms: sim.kingdoms,
  entities: sim.entities,
  tileMap,
  diplomacy: sim.diplomacy,
  market: sim.market,
  trade: sim.trade,
  spawn: (species, x, y) => sim.spawnEntity(species, x, y, tileMap),
  sim
};

const civ = new CivilizationEngine();
const rail = sim.railways;

// ---- Phase 1: the AI lays a line and coal reaches the forge. ----
let connected = false;
let cumulativeFreight = 0;
let connectedYear = -1;
const steelBefore = producer.stock.get('steel');
for (let year = 1; year <= 80 && !connected; year++) {
  world.year = year;
  civ.tickYear(world);
  cumulativeFreight += rail.yearlyFreight;
  if (!connected && rail.connected(tileMap, producer, consumer)) {
    connected = true;
    connectedYear = year;
  }
}
if (!connected) throw new Error(`railway never connected in 80 years (laid=${rail.railTiles(tileMap).length}, lines=${rail.linesBuilt})`);
if (rail.railTiles(tileMap).length === 0) throw new Error('no track laid at all');
if (producer.stock.get('steel') >= steelBefore) throw new Error('construction did not spend steel');
console.log(`[rail.sim] line connected at year ${connectedYear}: ${rail.railTiles(tileMap).length} rail tiles, lines built=${rail.linesBuilt}`);

// Give the line a few more years to actually haul freight.
for (let year = connectedYear + 1; year <= connectedYear + 6; year++) {
  world.year = year;
  civ.tickYear(world);
  cumulativeFreight += rail.yearlyFreight;
}
if (cumulativeFreight <= 0) {
  throw new Error(`no coal ever rode the line (cumulative freight ${cumulativeFreight})`);
}
const importedCoal = consumer.ledger.flow('coal').imported;
if (importedCoal <= 0) throw new Error('consumer ledger shows no rail imports');
console.log(`[rail.sim] freight flowed: cumulative=${cumulativeFreight}, consumer imported ${importedCoal.toFixed(1)} coal`);

// ---- Phase 2: war severs the line; freight halts. ----
// Auto-repair in the settlement tick would heal a lone break in the same year,
// and a single cut can be bypassed over the parallel rail of a zigzag survey.
// A siege grinds a whole band, so sever every link in a cross-section instead.
const midX = Math.floor((PRODUCER_X + CONSUMER_X) / 2);
for (const t of rail.railTiles(tileMap)) {
  if (Math.abs(t.x - midX) <= 1) {
    t.railDamage = 1;
    tileMap.markRailNetworkChanged(t.x, t.y);
  }
}
if (rail.connected(tileMap, producer, consumer)) {
  for (const t of rail.railTiles(tileMap)) {
    if (Math.abs(t.x - midX) <= 3) {
      t.railDamage = 1;
      tileMap.markRailNetworkChanged(t.x, t.y);
    }
  }
}
if (rail.connected(tileMap, producer, consumer)) {
  throw new Error('siege band did not sever the producer from the consumer');
}
rail.yearlyFreight = 0;
rail.tickFreight(world);
if (rail.yearlyFreight > 0) {
  throw new Error(`freight should be zero on a severed line, got ${rail.yearlyFreight}`);
}
console.log('[rail.sim] severed line: components=', rail.components(tileMap).length, ', yearlyFreight=0');

// ---- Phase 3: repair heals the band; freight resumes. ----
for (const t of rail.railTiles(tileMap)) {
  if (Math.abs(t.x - midX) <= 3) {
    t.railDamage = 0;
    tileMap.markRailNetworkChanged(t.x, t.y);
  }
}
if (!rail.connected(tileMap, producer, consumer)) {
  throw new Error('repair did not reconnect the network');
}
rail.yearlyFreight = 0;
rail.tickFreight(world);
if (rail.yearlyFreight <= 0) {
  throw new Error(`freight did not resume after repair (got ${rail.yearlyFreight})`);
}
console.log(`[rail.sim] repaired line: freight resumed (${rail.yearlyFreight.toFixed(1)} this year)`);

console.log('[rail.sim] ALL OK');
