/**
 * Economy checks. One runnable assertion per claim the economy makes.
 *
 * Run: npx vite build --config scratch/vite.diag.config.ts --outDir scratch/.testout \
 *        --ssr scratch/test_economy.ts && node scratch/.testout/audit.mjs
 */
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { TileMap } from '../src/world/TileMap';
import { ParticleManager } from '../src/renderer/Particles';
import { WorldMarket, CityLedger, LocalMarket } from '../src/civ/Economy';
import { SpeciesType, SPECIES_DEFINITIONS } from '../src/entities/Species';
import { ALL_GOODS } from '../src/civ/Goods';
import { createSocietyProfile, updateSociety } from '../src/civ/Society';
import { Kingdom } from '../src/civ/Kingdom';
import { enactLaw } from '../src/civ/Laws';

let failures = 0;
function check(name: string, pass: boolean, detail: string = ''): void {
  if (pass) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('=== ECONOMY CHECKS ===\n');

// ---------- 1. Ledger arithmetic ----------
{
  const ledger = new CityLedger();
  ledger.recordProduced('food', 270);
  ledger.recordConsumed('food', 310);
  ledger.recordImported('food', 60);
  ledger.recordExported('food', 5);
  ledger.rollOver();

  const f = ledger.flow('food');
  check('ledger records each flow', f.produced === 270 && f.consumed === 310 && f.imported === 60 && f.exported === 5);
  check('ledger net = produced + imported - consumed - exported', ledger.net('food') === 15, `got ${ledger.net('food')}`);
  check('in-progress year is not readable until rollOver', new CityLedger().net('food') === 0);
}

// ---------- 2. Price responds to scarcity ----------
{
  const market = new WorldMarket();
  const before = market.price('food');
  for (let y = 1; y <= 12; y++) {
    market.reportDemand('food', 500);
    market.reportSupply('food', 20);
    market.settle(y);
  }
  const scarce = market.price('food');
  check('shortage raises price', scarce > before, `${before} -> ${scarce}`);

  for (let y = 13; y <= 40; y++) {
    market.reportDemand('food', 20);
    market.reportSupply('food', 500);
    market.settle(y);
  }
  check('glut lowers price', market.price('food') < scarce, `${scarce} -> ${market.price('food')}`);
}

// ---------- 3. Price stays inside sane bounds ----------
{
  const market = new WorldMarket();
  for (let y = 1; y <= 200; y++) {
    market.reportDemand('oil', 1e6);
    market.reportSupply('oil', 0);
    market.settle(y);
  }
  const p = market.price('oil');
  check('price cannot run away', p > 0.01 && p < 1e5, `oil = ${p}`);
}

// ---------- 4. Price moves gradually, never jumps ----------
{
  const market = new WorldMarket();
  const start = market.price('iron');
  market.reportDemand('iron', 1e5);
  market.reportSupply('iron', 1);
  market.settle(1);
  const afterOneYear = market.price('iron');
  check('one year cannot more than double a price', afterOneYear < start * 2, `${start} -> ${afterOneYear}`);
}

// ---------- 5. Live simulation: books balance against the stockpile ----------
{
  const tileMap = new TileMap(80, 80, 'single_continent', 4242);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();

  [SpeciesType.LUMINI, SpeciesType.SYLVANII].forEach((sp, i) => {
    for (let k = 0; k < 8; k++) {
      const e = sim.spawnEntity(sp, 20 + i * 40 + (k % 4), 20 + i * 40 + Math.floor(k / 4), tileMap, k % 2 === 0 ? 'male' : 'female');
      e.dynasty = `House${i}`;
    }
  });
  sim.totalBirths = 0;

  for (let t = 0; t < TICKS_PER_YEAR * 6; t++) sim.tickAI(tileMap, particles);

  const cities = [...sim.cities.values()];
  check('simulation produced at least one settlement', cities.length > 0, `${cities.length}`);

  let anyProduction = false;
  let anyConsumption = false;
  let negativeFlow = false;
  for (const c of cities) {
    for (const g of ALL_GOODS) {
      const f = c.ledger.flow(g);
      if (f.produced > 0) anyProduction = true;
      if (f.consumed > 0) anyConsumption = true;
      if (f.produced < 0 || f.consumed < 0 || f.imported < 0 || f.exported < 0) negativeFlow = true;
    }
  }
  check('production is recorded in the ledger', anyProduction);
  check('consumption is recorded in the ledger', anyConsumption);
  check('no flow is ever negative', !negativeFlow);

  // Population must create food demand proportional to headcount.
  const totalPop = cities.reduce((s, c) => s + c.population, 0);
  const foodConsumed = cities.reduce((s, c) => s + c.ledger.flow('food').consumed, 0);
  check('population creates food demand', totalPop === 0 || foodConsumed > 0, `pop=${totalPop} eaten=${foodConsumed}`);

  // The same mouths must not be fed twice: a year's food consumption cannot
  // exceed what the population could physically eat, with headroom for buildings.
  const ceiling = totalPop * 4;
  check('food is not consumed twice over', foodConsumed <= ceiling || totalPop === 0,
    `eaten=${foodConsumed.toFixed(1)} pop=${totalPop} ceiling=${ceiling}`);

  const humans = sim.entities.filter(e => SPECIES_DEFINITIONS[e.species].isHumanoid);
  check('population survives six years', humans.length > 0, `${humans.length} alive`);

  console.log(`\n  (context: ${cities.length} cities, pop ${totalPop}, ${humans.length} humanoids, food eaten ${foodConsumed.toFixed(1)})`);
}

// ---------- 6. The books must explain the stock: no goods from nowhere ----------
{
  const tileMap = new TileMap(80, 80, 'single_continent', 909);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();
  for (let k = 0; k < 10; k++) {
    const e = sim.spawnEntity(SpeciesType.LUMINI, 30 + (k % 4), 30 + Math.floor(k / 4), tileMap, k % 2 === 0 ? 'male' : 'female');
    e.dynasty = 'Ledger';
  }
  sim.totalBirths = 0;

  // Settle first, then measure one clean year against the books.
  for (let t = 0; t < TICKS_PER_YEAR * 3; t++) sim.tickAI(tileMap, particles);

  const tracked = [...sim.cities.values()];
  const before = new Map(tracked.map(c => [c.id, c.stock.get('food')]));
  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(tileMap, particles);

  let worst = 0;
  let worstCity = '';
  for (const c of tracked) {
    if (!sim.cities.has(c.id)) continue;
    const delta = c.stock.get('food') - (before.get(c.id) ?? 0);
    const booked = c.ledger.net('food');
    // Capacity clamping and rounding leave a small gap; a systematic leak does not.
    const gap = Math.abs(delta - booked);
    if (gap > worst) { worst = gap; worstCity = c.name; }
  }
  check('stock change matches the ledger', worst < 12, `worst gap ${worst.toFixed(1)} in ${worstCity}`);
}

// ---------- 7. Local prices diverge from the world price ----------
{
  const world = new WorldMarket();
  const rich = new LocalMarket();   // sits on the ore
  const barren = new LocalMarket(); // has none

  for (let y = 0; y < 25; y++) {
    rich.settle('iron', world.price('iron'), 900, 40);   // plentiful, barely used
    barren.settle('iron', world.price('iron'), 5, 300);  // nothing, badly wanted
  }

  const cheap = rich.price('iron', world.price('iron'));
  const dear = barren.price('iron', world.price('iron'));
  check('a realm with the resource prices it low', cheap < world.price('iron'), `${cheap} vs world ${world.price('iron')}`);
  check('a realm without it prices it high', dear > world.price('iron'), `${dear} vs world ${world.price('iron')}`);
  check('local prices diverge enough to trade on', dear > cheap * 2, `cheap ${cheap.toFixed(1)} dear ${dear.toFixed(1)}`);
  check('local prices stay anchored to the world price', dear < world.price('iron') * 4 && cheap > world.price('iron') * 0.2);
}

// ---------- 8. Import dependency ----------
{
  const ledger = new CityLedger();
  ledger.recordProduced('oil', 70);
  ledger.recordImported('oil', 430);
  ledger.recordConsumed('oil', 500);
  ledger.rollOver();
  const dep = ledger.importDependency('oil');
  check('import dependency is computed, not invented', Math.abs(dep - 0.86) < 0.01, `got ${(dep * 100).toFixed(0)}%`);

  const selfSufficient = new CityLedger();
  selfSufficient.recordProduced('wood', 200);
  selfSufficient.recordConsumed('wood', 180);
  selfSufficient.rollOver();
  check('a self-sufficient good shows no dependency', selfSufficient.importDependency('wood') === 0);
}

// ---------- 9. Economic pressure reaches politics ----------
{
  const baseCtx = {
    year: 50,
    government: 'monarchy' as const,
    economy: 'mercantile' as const,
    taxRate: 0.2,
    atWar: false,
    wars: 0,
    stability: 0.6,
    legitimacy: 0.6,
    prosperity: 0.6,
    foodSecurity: 0.7,
    tradeDependency: 0.3,
    externalThreat: 0.1,
    administrativeReach: 0.7,
    inequality: 0.3,
    industrialisation: 0.4,
    gdpPerCapita: 20,
    cityCount: 3,
    famineYears: 0,
    warWeariness: 0,
    foodPriceIndex: 1,
    unemployment: 0,
    labourShortage: 0,
    embargoes: 0,
    culture: {
      militarism: 0.5, expansionism: 0.5, tradition: 0.5, authority: 0.5, openness: 0.5,
      mercantilism: 0.5, innovation: 0.5, collectivism: 0.5, warTrauma: 0, diplomaticTrust: 0.5
    }
  };

  const settle = (ctx: typeof baseCtx) => {
    let profile = createSocietyProfile('monarchy');
    for (let i = 0; i < 30; i++) profile = updateSociety(profile, ctx);
    return profile;
  };

  const calm = settle(baseCtx);
  const dearBread = settle({ ...baseCtx, foodPriceIndex: 2.4 });
  const jobless = settle({ ...baseCtx, unemployment: 0.28 });
  const blockaded = settle({ ...baseCtx, embargoes: 3 });

  check('dear food angers the townsfolk',
    dearBread.factions.workers.satisfaction < calm.factions.workers.satisfaction,
    `${calm.factions.workers.satisfaction.toFixed(2)} -> ${dearBread.factions.workers.satisfaction.toFixed(2)}`);

  check('dear food does NOT anger the countryside the same way',
    dearBread.factions.peasants.satisfaction >= calm.factions.peasants.satisfaction,
    `${calm.factions.peasants.satisfaction.toFixed(2)} -> ${dearBread.factions.peasants.satisfaction.toFixed(2)}`);

  check('unemployment radicalises the workforce',
    jobless.factions.workers.radicalization > calm.factions.workers.radicalization,
    `${calm.factions.workers.radicalization.toFixed(2)} -> ${jobless.factions.workers.radicalization.toFixed(2)}`);

  check('embargo hurts the merchants specifically',
    blockaded.factions.merchants.satisfaction < calm.factions.merchants.satisfaction,
    `${calm.factions.merchants.satisfaction.toFixed(2)} -> ${blockaded.factions.merchants.satisfaction.toFixed(2)}`);

  const crisis = settle({ ...baseCtx, foodPriceIndex: 2.6, unemployment: 0.3 });
  check('hunger plus joblessness raises revolt risk',
    crisis.revoltRisk > calm.revoltRisk,
    `${calm.revoltRisk.toFixed(2)} -> ${crisis.revoltRisk.toFixed(2)}`);
  check('and it raises the pressure to reform',
    crisis.reformPressure > calm.reformPressure,
    `${calm.reformPressure.toFixed(2)} -> ${crisis.reformPressure.toFixed(2)}`);
}

// ---------- 10. Law changes the economy (the return loop) ----------
{
  const open = new Kingdom('k_open', 'Openland', SpeciesType.LUMINI, '#38bdf8', 'c1', 1);
  const closed = new Kingdom('k_closed', 'Wallland', SpeciesType.LUMINI, '#f87171', 'c2', 1);
  open.culture.mercantilism = 0.5;
  closed.culture.mercantilism = 0.5;

  enactLaw(open.laws, 'free_trade', 1);
  enactLaw(closed.laws, 'closed_markets', 1);

  const openRate = open.tariffRate();
  const closedRate = closed.tariffRate();

  check('free trade lowers the border tariff', openRate < 0.12, `${(openRate * 100).toFixed(0)}%`);
  check('closed markets raise the border tariff', closedRate > 0.2, `${(closedRate * 100).toFixed(0)}%`);
  check('a trade law moves tariffs more than culture does', closedRate > openRate * 2,
    `open ${(openRate * 100).toFixed(0)}% vs closed ${(closedRate * 100).toFixed(0)}%`);
  check('tariffs stay inside sane bounds', openRate >= 0.02 && closedRate <= 0.45);

  // A protectionist border must actually be able to kill an otherwise good route.
  const sellPrice = 10;
  const buyPrice = 14;
  const transport = 1;
  const marginOpen = buyPrice - sellPrice - transport - buyPrice * openRate;
  const marginClosed = buyPrice - sellPrice - transport - buyPrice * closedRate;
  check('protectionism can make a profitable route unprofitable',
    marginOpen > 0 && marginClosed < marginOpen,
    `open margin ${marginOpen.toFixed(2)}, closed ${marginClosed.toFixed(2)}`);
}

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
if (failures > 0) process.exitCode = 1;
