/**
 * Determinism: the same seed must produce the same world, twice.
 *
 * Without this, balancing is guesswork — you can never tell your tuning from
 * the noise. Two runs are executed inside one process and their entire
 * simulation state is compared field by field.
 */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType, SPECIES_DEFINITIONS } from '../src/entities/Species';
import { ALL_GOODS } from '../src/civ/Goods';
import { rng, resetIds } from '../src/core/Random';

let failures = 0;
function check(name: string, pass: boolean, detail: string = ''): void {
  if (pass) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const SEED = 31337;
const YEARS = 6;
const SIZE = 80;

/** Runs a world from a clean seeded start and returns a fingerprint of it. */
function run(): {
  summary: string;
  entities: string[];
  cities: string[];
  market: string[];
} {
  // Exactly what main.ts does when it builds a world.
  rng.setSeed((SEED ^ 0x9e3779b9) >>> 0);
  resetIds();

  const map = new TileMap(SIZE, SIZE, 'single_continent', SEED);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();

  const species = [SpeciesType.LUMINI, SpeciesType.SYLVANII, SpeciesType.STONEKIN];
  const spots = [{ x: 20, y: 20 }, { x: 58, y: 22 }, { x: 24, y: 58 }];
  species.forEach((sp, i) => {
    for (let k = 0; k < 8; k++) {
      const e = sim.spawnEntity(sp, spots[i].x + (k % 3), spots[i].y + Math.floor(k / 3), map, k % 2 === 0 ? 'male' : 'female');
      e.dynasty = `House${i}`;
    }
  });
  const fauna = [SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.BOAR, SpeciesType.WOLF];
  for (let i = 0; i < 12; i++) {
    sim.spawnEntity(fauna[i % fauna.length], rng.rangeInt(2, SIZE - 3), rng.rangeInt(2, SIZE - 3), map);
  }
  sim.totalBirths = 0;
  sim.totalDeaths = 0;

  for (let t = 0; t < TICKS_PER_YEAR * YEARS; t++) sim.tickAI(map, particles);

  const humans = sim.entities.filter(e => SPECIES_DEFINITIONS[e.species].isHumanoid);
  return {
    summary: [
      `year=${sim.currentYear}`,
      `entities=${sim.entities.length}`,
      `humans=${humans.length}`,
      `cities=${sim.cities.size}`,
      `kingdoms=${sim.kingdoms.size}`,
      `births=${sim.totalBirths}`,
      `deaths=${sim.totalDeaths}`,
      `households=${sim.households.size}`,
      `routes=${sim.trade.routes.size}`
    ].join(' '),
    // Positions and hunger catch any divergence in per-tick behaviour.
    entities: sim.entities
      .map(e => `${e.id}|${e.species}|${e.x.toFixed(4)},${e.y.toFixed(4)}|hp${e.hp.toFixed(2)}|h${e.needs.hunger.toFixed(2)}|${e.profession}`)
      .sort(),
    cities: [...sim.cities.values()]
      .map(c => `${c.id}|${c.name}|pop${c.population}|terr${c.territory.size}|b${c.buildings.size}|` +
        ALL_GOODS.map(g => c.stock.get(g).toFixed(2)).join(','))
      .sort(),
    market: ALL_GOODS.map(g => `${g}:${rngSafe(g)}`),
  };

  function rngSafe(g: (typeof ALL_GOODS)[number]): string {
    return sim.market.price(g).toFixed(4);
  }
}

console.log('=== DETERMINISM ===\n');

const a = run();
const b = run();

console.log(`  run A: ${a.summary}`);
console.log(`  run B: ${b.summary}\n`);

check('the same seed produces the same world summary', a.summary === b.summary);
check('the same seed produces the same market prices', a.market.join('|') === b.market.join('|'));
check('the same seed produces the same number of entities', a.entities.length === b.entities.length,
  `${a.entities.length} vs ${b.entities.length}`);
check('the same seed produces the same number of settlements', a.cities.length === b.cities.length,
  `${a.cities.length} vs ${b.cities.length}`);

// Field-by-field so a failure names the first thing that diverged.
let firstEntityDiff = '';
for (let i = 0; i < Math.min(a.entities.length, b.entities.length); i++) {
  if (a.entities[i] !== b.entities[i]) {
    firstEntityDiff = `\n      A: ${a.entities[i]}\n      B: ${b.entities[i]}`;
    break;
  }
}
check('every citizen is in the same place with the same state', firstEntityDiff === '', firstEntityDiff);

let firstCityDiff = '';
for (let i = 0; i < Math.min(a.cities.length, b.cities.length); i++) {
  if (a.cities[i] !== b.cities[i]) {
    firstCityDiff = `\n      A: ${a.cities[i]}\n      B: ${b.cities[i]}`;
    break;
  }
}
check('every settlement holds exactly the same goods', firstCityDiff === '', firstCityDiff);

// A different seed must actually produce a different world, or "determinism"
// would just mean the simulation ignores its seed.
const differentSummary = (() => {
  rng.setSeed((999 ^ 0x9e3779b9) >>> 0);
  resetIds();
  const map = new TileMap(SIZE, SIZE, 'single_continent', 999);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();
  for (let k = 0; k < 8; k++) {
    sim.spawnEntity(SpeciesType.LUMINI, 20 + (k % 3), 20 + Math.floor(k / 3), map, k % 2 === 0 ? 'male' : 'female');
  }
  for (let t = 0; t < TICKS_PER_YEAR * YEARS; t++) sim.tickAI(map, particles);
  return `${sim.entities.length}|${sim.cities.size}`;
})();
check('a different seed produces a different world',
  differentSummary !== `${a.entities.length}|${a.cities.length}`, `both ${differentSummary}`);

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
if (failures > 0) process.exitCode = 1;
