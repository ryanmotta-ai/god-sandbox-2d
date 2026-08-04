/**
 * Economic debug console (item 42).
 *
 * Answers the four questions balancing actually needs, off one simulated world:
 *   CITY    food produced/consumed, jobs, workers, stocks
 *   GOOD    supply, demand, price
 *   TRADE   routes and what limits them
 *   KINGDOM imports, exports, dependency
 *
 * Run:
 *   npx vite build --config scratch/vite.diag.config.ts --outDir scratch/.dbg --ssr scratch/debug_economy.ts
 *   YEARS=8 node scratch/.dbg/audit.mjs
 */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { ALL_GOODS, GOODS, type GoodId } from '../src/civ/Goods';
import { SpeciesType, SPECIES_DEFINITIONS } from '../src/entities/Species';
import { roadCapacityFactor, portCapacityFactor } from '../src/civ/Infrastructure';
import { RandomService } from '../src/core/Random';

const YEARS = Math.min(10, Number(process.env.YEARS ?? 8));
const SIZE = Number(process.env.SIZE ?? 100);
const SEED = Number(process.env.SEED ?? 2024);

const pad = (v: unknown, n: number) => String(v).padEnd(n);
const num = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString();

const map = new TileMap(SIZE, SIZE, 'single_continent', SEED);
const sim = new SimulationEngine();
const particles = new ParticleManager();
const place = new RandomService(SEED);

const species = [SpeciesType.LUMINI, SpeciesType.SYLVANII, SpeciesType.STONEKIN];
const spots = [{ x: SIZE * 0.25, y: SIZE * 0.25 }, { x: SIZE * 0.72, y: SIZE * 0.28 }, { x: SIZE * 0.3, y: SIZE * 0.74 }];
species.forEach((sp, i) => {
  for (let k = 0; k < 8; k++) {
    const e = sim.spawnEntity(sp, spots[i].x + (k % 3), spots[i].y + Math.floor(k / 3), map, k % 2 === 0 ? 'male' : 'female');
    e.dynasty = `House${i}`;
  }
});
const fauna = [SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.BOAR, SpeciesType.WOLF];
for (let i = 0; i < Math.round((SIZE * SIZE) / 700); i++) {
  sim.spawnEntity(fauna[i % fauna.length], place.rangeInt(2, SIZE - 3), place.rangeInt(2, SIZE - 3), map);
}
sim.totalBirths = 0;

for (let t = 0; t < TICKS_PER_YEAR * YEARS; t++) sim.tickAI(map, particles);

console.log(`=== ECONOMIC DEBUG — year ${sim.currentYear}, seed ${SEED} ===`);

// ============================ CITIES ============================
console.log('\n--- CITIES ---');
console.log(`  ${pad('city', 16)}${pad('pop', 5)}${pad('workers', 8)}${pad('jobs', 6)}${pad('unemp', 7)}${pad('foodProd', 9)}${pad('foodCons', 9)}${pad('foodNet', 8)}stock`);
for (const c of sim.cities.values()) {
  const workers = sim.entities.filter(e => e.cityId === c.id && !e.isChild && e.hp > 0).length;
  const jobs = c.jobCount();
  const filled = c.filledJobs();
  const unemp = workers > 0 ? ((workers - filled) / workers) * 100 : 0;
  const f = c.ledger.flow('food');
  console.log(
    `  ${pad(c.name, 16)}${pad(c.population, 5)}${pad(workers, 8)}${pad(`${filled}/${jobs}`, 6)}` +
    `${pad(`${num(unemp, 0)}%`, 7)}${pad(num(f.produced), 9)}${pad(num(f.consumed), 9)}` +
    `${pad(num(c.ledger.net('food')), 8)}${num(c.stock.get('food'), 0)}`
  );
}

// ============================ GOODS ============================
// The market's supply/demand are per-year accumulators that settle() zeroes at
// the year boundary, so reading them here would always print 0. The ledger keeps
// the completed year, which is the number worth balancing against.
console.log('\n--- GOODS (world, last completed year) ---');
console.log(`  ${pad('good', 12)}${pad('price', 8)}${pad('produced', 10)}${pad('consumed', 10)}${pad('net', 9)}stock`);
for (const g of ALL_GOODS) {
  let produced = 0;
  let consumed = 0;
  let stock = 0;
  for (const c of sim.cities.values()) {
    const f = c.ledger.flow(g);
    produced += f.produced;
    consumed += f.consumed;
    stock += c.stock.get(g);
  }
  if (produced === 0 && consumed === 0 && stock === 0) continue;
  const net = produced - consumed;
  console.log(
    `  ${pad(g, 12)}${pad(num(sim.market.price(g), 2), 8)}${pad(num(produced), 10)}` +
    `${pad(num(consumed), 10)}${pad(`${net >= 0 ? '+' : ''}${num(net)}`, 9)}${num(stock, 0)}`
  );
}

// ============================ TRADE ============================
console.log('\n--- TRADE ---');
if (sim.trade.routes.size === 0) {
  console.log('  (no routes — a route needs surplus on one side, scarcity on the other, and a margin that survives haulage and tariff)');
} else {
  for (const r of sim.trade.routes.values()) {
    const from = sim.cities.get(r.fromCityId);
    const to = sim.cities.get(r.toCityId);
    const capacity = r.kind === 'maritime'
      ? (from && to ? portCapacityFactor(from, to) : 0)
      : roadCapacityFactor(r.path, map);
    console.log(
      `  ${pad(GOODS[r.good].name, 12)} ${pad(from?.name ?? '?', 14)}→ ${pad(to?.name ?? '?', 14)}` +
      `vol=${pad(num(r.volume, 0), 5)}cap=${pad(`${num(capacity * 100, 0)}%`, 6)}${r.active ? 'active' : 'SUSPENDED'}`
    );
  }
}
console.log(`  embargoes: ${sim.trade.embargoes.length}  agreements: ${sim.trade.agreements.size}`);

// ============================ KINGDOMS ============================
console.log('\n--- KINGDOMS ---');
for (const k of sim.kingdoms.values()) {
  const cities = [...k.cityIds].map(id => sim.cities.get(id)).filter(Boolean);
  let imported = 0;
  let exported = 0;
  const deps: string[] = [];
  for (const g of ALL_GOODS) {
    let imp = 0;
    let used = 0;
    for (const c of cities) {
      const f = c!.ledger.flow(g);
      imp += f.imported;
      used += f.consumed + f.exported;
      imported += f.imported;
      exported += f.exported;
    }
    if (used > 0 && imp / used > 0.2) deps.push(`${g} ${num((imp / used) * 100, 0)}%`);
  }
  console.log(`  ${k.name}`);
  console.log(`     tariff=${num(k.tariffRate() * 100, 0)}%  treasury=${num(k.economy.treasury, 0)}  gdp=${num(k.economy.gdp, 0)}`);
  console.log(`     era researched=${k.research.currentEra()}  operating=${k.operatingEra}  capacity=${num(k.technologicalCapacity(), 2)}`);
  console.log(`     imports=${num(imported)}  exports=${num(exported)}  dependency: ${deps.join(', ') || 'self-sufficient'}`);
  const wants = [...k.strategicDemand.entries()].map(([g, v]) => `${g}:${num(v)}`).join(' ');
  console.log(`     strategic demand: ${wants || '(none — nothing it knows needs raw materials yet)'}`);
  const factions = ['peasants', 'workers', 'merchants', 'military'] as const;
  console.log(`     factions: ${factions.map(f => `${f} ${num(k.society.factions[f].satisfaction * 100, 0)}%`).join('  ')}`);
  console.log(`     revoltRisk=${num(k.society.revoltRisk * 100, 0)}%  reformPressure=${num(k.society.reformPressure * 100, 0)}%`);
}

// ============================ POPULATION ============================
const humans = sim.entities.filter(e => SPECIES_DEFINITIONS[e.species].isHumanoid);
const wild = sim.entities.length - humans.length;
const starving = humans.filter(e => e.needs.hunger >= 88).length;
console.log('\n--- POPULATION ---');
console.log(`  humanoids=${humans.length}  wildlife=${wild}  births=${sim.totalBirths}  deaths=${sim.totalDeaths}`);
console.log(`  starving=${starving}  households=${sim.households.size}  avg hunger=${num(humans.reduce((s, e) => s + e.needs.hunger, 0) / Math.max(1, humans.length), 0)}`);

export type _Unused = GoodId;
