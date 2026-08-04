/**
 * Phase L: the checks from item 43 that the earlier suites did not cover, plus
 * an honest performance profile of the simulation at scale.
 */
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType, SPECIES_DEFINITIONS } from '../src/entities/Species';
import { SimulationEngine, TICKS_PER_YEAR, TICKS_PER_DAY } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { TradeNetwork } from '../src/civ/Trade';
import { RailwayNetwork, type RailwayWorld } from '../src/civ/RailwayNetwork';
import { TerrainType } from '../src/world/Biomes';
import { RandomService } from '../src/core/Random';
import type { GoodId } from '../src/civ/Goods';

let failures = 0;
function check(name: string, pass: boolean, detail: string = ''): void {
  if (pass) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

function forceLand(map: TileMap, tiles: { x: number; y: number }[]): void {
  for (const p of tiles) map.getTile(p.x, p.y)!.type = TerrainType.GRASS;
}

console.log('=== PHASE L: BALANCE, PERFORMANCE, REMAINING TESTS ===\n');

// ---------- item 43.4: a missing input stops production ----------
{
  const map = new TileMap(40, 40, 'single_continent', 1234);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();

  const kingdom = new Kingdom('kf', 'Forgeland', SpeciesType.STONEKIN, '#94a3b8', 'cf', 1);
  for (const t of ['mining', 'bronze_working', 'iron_working', 'metallurgy']) kingdom.research.complete(t);
  const city = new City('cf', 'Forgeholm', SpeciesType.STONEKIN, 20, 20, 'Founder', 1);
  city.kingdomId = 'kf';
  kingdom.cityIds.add('cf');
  city.addBuilding('smithy', 20, 20);
  sim.kingdoms.set('kf', kingdom);
  sim.cities.set('cf', city);

  // Steel needs iron AND coal. Give iron only.
  city.stock.set('iron', 200);
  city.stock.set('coal', 0);
  city.stock.set('steel', 0);

  // Populate the smithy so it is staffed, then run a year of the civ layer.
  for (let k = 0; k < 6; k++) {
    const e = sim.spawnEntity(SpeciesType.STONEKIN, 20, 20, map, k % 2 === 0 ? 'male' : 'female');
    e.cityId = 'cf';
    e.kingdomId = 'kf';
  }
  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(map, particles);

  check('a smithy with no coal forges no steel', city.stock.get('steel') === 0,
    `steel=${city.stock.get('steel')}`);
  check('and the iron it could not use is still sitting there', city.stock.get('iron') > 0,
    `iron=${city.stock.get('iron')}`);

  // Now supply the missing input and let it run again.
  city.stock.set('coal', 200);
  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(map, particles);
  check('supplying the missing input restarts production', city.stock.get('steel') > 0,
    `steel=${city.stock.get('steel')}`);
}

// ---------- item 43.6: an embargo reduces trade ----------
{
  const trade = new TradeNetwork();
  trade.signAgreement('kA', 'kB', 1, 0.1);
  const route = trade.openRoute({
    fromCityId: 'c1', toCityId: 'c2', fromKingdomId: 'kA', toKingdomId: 'kB',
    kind: 'overland', good: 'iron', volume: 20, year: 1
  });

  trade.updateRouteStatus(() => false);
  check('a route between friendly realms runs', route.active && trade.routes.has(route.id));

  trade.declareEmbargo('kA', 'kB', 2, 'test');
  // An embargo does not merely pause the traffic: it closes the route outright.
  check('an embargo removes the route entirely', !trade.routes.has(route.id), `${trade.routes.size} rotas`);
  check('an embargo also tears up the trade agreement', !trade.hasAgreement('kA', 'kB'));
  check('an embargoed pair cannot sign a new agreement',
    trade.signAgreement('kA', 'kB', 3, 0.1) === null);

  trade.liftEmbargo('kA', 'kB');
  check('lifting the embargo lets them deal again', trade.signAgreement('kA', 'kB', 4, 0.1) !== null);

  // War suspends a live route without deleting it, so peace can restore it.
  const warRoute = trade.openRoute({
    fromCityId: 'c1', toCityId: 'c2', fromKingdomId: 'kA', toKingdomId: 'kB',
    kind: 'overland', good: 'iron', volume: 20, year: 5
  });
  trade.updateRouteStatus(() => true);
  check('war suspends the route', !warRoute.active);
  trade.updateRouteStatus(() => false);
  check('peace restores it', warRoute.active);
}

// ---------- item 43.8: a railway increases transport capacity ----------
{
  const map = new TileMap(30, 30, 'single_continent', 4321);
  const rail = new RailwayNetwork();
  const kingdom = new Kingdom('kr', 'Railand', SpeciesType.STONEKIN, '#94a3b8', 'r1', 1);
  for (const t of ['mining', 'bronze_working', 'iron_working', 'metallurgy']) kingdom.research.complete(t);

  const mine = new City('r1', 'Pit', SpeciesType.STONEKIN, 5, 5, 'F', 1);
  const forge = new City('r2', 'Forge', SpeciesType.STONEKIN, 6, 5, 'F', 1);
  mine.kingdomId = 'kr'; forge.kingdomId = 'kr';
  forge.addBuilding('smithy', 6, 5);
  kingdom.cityIds.add('r1'); kingdom.cityIds.add('r2');

  forceLand(map, [{ x: 5, y: 5 }, { x: 6, y: 5 }]);
  map.getTile(5, 5)!.cityId = 'r1';
  map.getTile(6, 5)!.cityId = 'r2';
  rail.layTrack(map, 5, 5, 'kr');
  rail.layTrack(map, 6, 5, 'kr');

  const world: RailwayWorld = {
    year: 1,
    cities: new Map([['r1', mine], ['r2', forge]]),
    kingdoms: new Map([['kr', kingdom]]),
    tileMap: map,
    diplomacy: { isAtWar: () => false },
    trade: { hasAgreement: () => true, isEmbargoed: () => false }
  };

  // A pristine line.
  mine.stock.set('coal', 500); forge.stock.set('coal', 0);
  rail.tickFreight(world);
  const healthyMove = forge.stock.get('coal');
  check('a working railway carries freight', healthyMove > 0, `${healthyMove}`);

  // The same line, badly damaged but not severed: capacity must drop.
  map.getTile(5, 5)!.railDamage = 0.6;
  map.getTile(6, 5)!.railDamage = 0.6;
  mine.stock.set('coal', 500); forge.stock.set('coal', 0);
  rail.tickFreight(world);
  const damagedMove = forge.stock.get('coal');
  check('a damaged railway carries less', damagedMove < healthyMove, `${healthyMove} -> ${damagedMove}`);

  // Severed: nothing crosses at all.
  map.getTile(5, 5)!.railDamage = 0.9;
  mine.stock.set('coal', 500); forge.stock.set('coal', 0);
  rail.tickFreight(world);
  check('a severed railway carries nothing', forge.stock.get('coal') === 0, `${forge.stock.get('coal')}`);
}

// ---------- Performance: the simulation at a realistic population ----------
{
  const map = new TileMap(128, 128, 'single_continent', 909);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();
  const place = new RandomService(909);

  const species = [SpeciesType.LUMINI, SpeciesType.SYLVANII, SpeciesType.STONEKIN, SpeciesType.EMBERKIN];
  species.forEach((sp, i) => {
    for (let k = 0; k < 12; k++) {
      const e = sim.spawnEntity(sp, 20 + i * 28 + (k % 4), 20 + i * 20 + Math.floor(k / 4), map, k % 2 === 0 ? 'male' : 'female');
      e.dynasty = `H${i}`;
    }
  });
  const fauna = [SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.BOAR, SpeciesType.WOLF];
  for (let i = 0; i < 26; i++) {
    sim.spawnEntity(fauna[i % fauna.length], place.rangeInt(2, 125), place.rangeInt(2, 125), map);
  }

  // Warm up so the world has cities, buildings and routes to carry.
  for (let t = 0; t < TICKS_PER_YEAR * 6; t++) sim.tickAI(map, particles);

  const entities = sim.entities.length;
  const humans = sim.entities.filter(e => SPECIES_DEFINITIONS[e.species].isHumanoid).length;

  // Ordinary ticks (no year boundary).
  const t0 = Date.now();
  const SAMPLE = 6000;
  for (let t = 0; t < SAMPLE; t++) sim.tickAI(map, particles);
  const msPerTick = (Date.now() - t0) / SAMPLE;

  // The heaviest tick of the year is the one that crosses into a new year and
  // runs the entire civilisation layer. Find it by watching the year roll over
  // and timing every tick until it does.
  let yearTickMs = 0;
  const startYear = sim.currentYear;
  for (let t = 0; t < TICKS_PER_YEAR + 1; t++) {
    const a = Date.now();
    sim.tickAI(map, particles);
    const cost = Date.now() - a;
    if (sim.currentYear !== startYear) { yearTickMs = cost; break; }
  }

  console.log(`\n  world: ${entities} entities (${humans} humanoid), ${sim.cities.size} cities, ${sim.kingdoms.size} realms`);
  console.log(`  ordinary tick: ${msPerTick.toFixed(4)} ms  (${Math.round(1000 / msPerTick)} ticks/s)`);
  console.log(`  year-boundary tick: ${yearTickMs} ms (whole civilisation layer)`);
  console.log(`  a year is ${TICKS_PER_YEAR} ticks of ${TICKS_PER_DAY}/day\n`);

  // At 60fps and speed 10x the loop asks for 600 ticks a second.
  check('the sim keeps ahead of the fastest game speed', 1000 / msPerTick > 600,
    `${Math.round(1000 / msPerTick)} ticks/s vs 600 needed`);
  check('a year boundary does not stall the frame past a blink', yearTickMs < 250, `${yearTickMs} ms`);
  check('the world is actually populated for this measurement', humans > 10 && sim.cities.size > 0,
    `${humans} humanoids, ${sim.cities.size} cities`);
}

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
if (failures > 0) process.exitCode = 1;

export type _Unused = GoodId;
