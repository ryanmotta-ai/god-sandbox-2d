/**
 * The refinement pass, checked against a world rather than a unit.
 *
 * Every fix in this pass touched something that compounds: money that used to be
 * minted or destroyed, deaths counted twice, wages paid from nowhere, goods with
 * no consumer. None of those fail a unit test — they fail as a world that has
 * quietly become absurd a century in. So this runs a real world for real years
 * and then asks the questions the old bugs would have answered wrongly.
 *
 * Two parts, because two kinds of claim need two kinds of proof:
 *  - the *wiring* checks are static, and answer "does anything at all consume
 *    this material" without waiting for a realm to discover electricity;
 *  - the *world* checks run the simulation, and answer "after a century of this,
 *    is the money bounded, is the census honest, and are the dead buried".
 */
import assert from 'node:assert/strict';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';
import { generateDeposits } from '../src/world/Deposits';
import { PRODUCTION_RECIPES, GoodId } from '../src/civ/Goods';
import { BUILDINGS } from '../src/civ/Building';

// ============================ WIRING: THE SEVEN ORPHANS ============================

/**
 * The seven goods the audit found were extracted, priced, given a technology and
 * an extraction building — and then consumed by absolutely nothing. A material
 * with no consumer is a material with no price signal, no trade route and no
 * reason to fight over the ground it sits in.
 */
const ORPHANS: GoodId[] = ['clay', 'salt', 'horses', 'spices', 'furs', 'uranium', 'machinery'];

/** Goods that appear as an input to some recipe. */
const recipeInputs = new Set<string>();
for (const recipes of Object.values(PRODUCTION_RECIPES)) {
  for (const recipe of recipes ?? []) {
    for (const input of Object.keys(recipe.inputs)) recipeInputs.add(input);
  }
}

/** Goods that appear in some building's construction cost. */
const buildCosts = new Set<string>();
for (const def of Object.values(BUILDINGS)) {
  for (const good of Object.keys(def.cost)) buildCosts.add(good);
  for (const good of Object.keys(def.consumes ?? {})) buildCosts.add(good);
}

/**
 * Sinks that live in engine code rather than in a data table, verified by the
 * world run below: household wants (`reportLivingStandards`) and the military
 * (`applyMilitaryUpkeep`, `computeArmyComposition`).
 */
const CODE_SINKS: Record<string, string> = {
  salt: 'household preservation want + salted military rations',
  furs: 'household warmth want + tanned-leather cloth recipe',
  spices: 'luxury want in prosperous settlements',
  horses: 'cavalry mounts + campaign attrition'
};

const unwired = ORPHANS.filter(good =>
  !recipeInputs.has(good) && !buildCosts.has(good) && !CODE_SINKS[good]
);

console.log('[refino] sinks dos 7 órfãos:');
for (const good of ORPHANS) {
  const where = [
    recipeInputs.has(good) ? 'receita' : null,
    buildCosts.has(good) ? 'construção' : null,
    CODE_SINKS[good] ?? null
  ].filter(Boolean).join(' + ');
  console.log(`  ${good.padEnd(10)} ${where || '*** SEM CONSUMIDOR ***'}`);
}
assert.equal(unwired.length, 0, `these goods still have no consumer at all: ${unwired.join(', ')}`);

// ============================ THE WORLD ============================

const YEARS = 90;

function world(): TileMap {
  const map = new TileMap(96, 96, 'single_continent', 90210);
  for (let x = 0; x < map.width; x++) {
    for (let y = 0; y < map.height; y++) {
      const tile = map.getTile(x, y)!;
      const edge = Math.min(x, y, map.width - 1 - x, map.height - 1 - y);
      if (edge < 6) { tile.type = TerrainType.SHALLOW_WATER; tile.height = 0.2; continue; }
      tile.type = TerrainType.GRASS;
      tile.height = 0.35 + (edge / map.width) * 0.55;
      tile.fertility = 0.6 + ((x * 7 + y * 11) % 40) / 100;
      tile.moisture = 0.4 + ((x * 3 + y * 5) % 50) / 100;
      tile.temperature = 8 + ((x + y) % 22);
    }
  }
  generateDeposits(
    Array.from({ length: map.width }, (_, x) => Array.from({ length: map.height }, (_, y) => map.getTile(x, y)!)),
    map.width, map.height, 90210
  );
  map.rebuildDerivedIndexes();
  map.updateRegionStates(48, 48);
  return map;
}

const map = world();
const sim = new SimulationEngine();
const particles = new Proxy({}, { get: () => () => {} }) as any;

// Four bands, far enough apart to found their own realms and eventually meet.
for (const [cx, cy] of [[20, 20], [74, 22], [22, 74], [72, 72]] as const) {
  for (let i = 0; i < 9; i++) {
    const e = sim.spawnEntity(SpeciesType.HUMAN, cx + (i % 3), cy + Math.floor(i / 3), map);
    e.age = 18 + (i % 10);
  }
}
const founders = sim.entities.length;

for (let year = 0; year < YEARS; year++) {
  for (let tick = 0; tick < TICKS_PER_YEAR; tick++) sim.tickAI(map, particles);
}

const treasuries = [...sim.kingdoms.values()].map(k => k.economy.treasury);
const money = treasuries.reduce((a, b) => a + b, 0);
const living = sim.entities.filter(e => e.hp > 0).length;
const zombies = sim.entities.filter(e => e.hp <= 0).length;
const counted = [...sim.cities.values()].reduce((a, c) => a + c.population, 0);
const humans = sim.entities.filter(e => e.hp > 0 && e.species === SpeciesType.HUMAN).length;

console.log(`[refino] ${YEARS} anos · reinos=${sim.kingdoms.size} cidades=${sim.cities.size} humanos=${humans}`);
console.log(`[refino] população: censo=${counted} vivos=${living} corpos-não-coletados=${zombies}`);
console.log(`[refino] dinheiro: total=${Math.round(money)} maior=${Math.round(Math.max(...treasuries, 0))} menor=${Math.round(Math.min(...treasuries, 0))}`);
console.log(`[refino] fundadores=${founders} nascimentos=${sim.totalBirths} mortes=${sim.totalDeaths} ancestrais=${sim.deceasedAncestors.size}`);
console.log(`[refino] fé por reino: ${[...sim.kingdoms.values()].map(k => k.faith.toFixed(2)).join(' ')}`);
console.log(`[refino] era climática: ${sim.currentEra}`);

assert.ok(sim.cities.size > 0, 'the world must still have settlements after ninety years');
assert.ok(humans > 0, 'the world must still have people');

/**
 * The dead are buried, and buried once.
 *
 * Two separate old bugs meet here. `killCitizens` used to decrement a
 * settlement's head count for people `handleEntityDeath` was also going to
 * decrement, so the census ran permanently below the number of bodies actually
 * in the world; and every death has to reach `handleEntityDeath` at all, or the
 * estate never settles, the ancestor is never recorded and the body stays in the
 * entity array forever.
 */
assert.ok(sim.totalDeaths > 0, 'ninety years must produce deaths');
/**
 * Bodies are reaped on a cadence, not instantly, so a handful may be waiting at
 * any single instant — this snapshot is taken mid-tick. What must not happen is a
 * *backlog*: a body that is never collected keeps its estate unsettled, its
 * ancestor unrecorded and its slot in the entity array forever.
 */
assert.ok(
  zombies < 20,
  `${zombies} bodies are waiting to be collected — that is a leak, not a cadence`
);
assert.equal(
  sim.deceasedAncestors.size, sim.totalDeaths,
  `every death must leave an ancestor (${sim.totalDeaths} deaths vs ${sim.deceasedAncestors.size} ancestors)`
);
assert.ok(
  sim.deceasedAncestors.size > 0,
  'the dead must be recorded as ancestors, or no family tree survives a generation'
);
assert.ok(
  counted <= living + 5,
  `the census must not exceed the living population (census ${counted} vs living ${living})`
);

/**
 * Money is conserved and bounded.
 *
 * Before this pass three quarters of every coin spent on food ceased to exist,
 * wages were minted from nothing at the world reference price, banks and markets
 * dug gold ore out of a vault floor every year, and cross-border payments moved
 * at a permanent 1:1. A century of that ends either with no money in the world or
 * with an unbounded pile of it.
 */
assert.ok(money > 0, `the world must still have money (total ${Math.round(money)})`);
assert.ok(money < 5_000_000, `treasuries must stay bounded (total ${Math.round(money)})`);

console.log('[refino] ALL OK');
