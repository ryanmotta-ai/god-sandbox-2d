/**
 * Headless systems audit.
 *
 * Runs a real world for N simulated years and reports which subsystems actually
 * came alive: deposits, extraction, crafting chains, trade, naval, caravans.
 * Anything that stays at zero is a system that is wired up but never connects.
 */
import { SimulationEngine } from '../src/ai/EntityAI';
import { TileMap } from '../src/world/TileMap';
import { ParticleManager } from '../src/renderer/Particles';
import { ALL_GOODS, GOODS, GoodId, CRAFTED_GOODS } from '../src/civ/Goods';
import { ALL_BUILDING_TYPES, BuildingType } from '../src/civ/Building';
import { SpeciesType, SPECIES_DEFINITIONS } from '../src/entities/Species';
import { TECHNOLOGIES, techCost } from '../src/civ/TechTree';

const YEARS = Number(process.env.YEARS ?? 12);
const SIZE = Number(process.env.SIZE ?? 100);
const SEED = Number(process.env.SEED ?? 12345);
import { TICKS_PER_YEAR } from '../src/ai/EntityAI';

function pad(s: any, n: number): string {
  return String(s).padEnd(n);
}
function num(n: number, d = 1): string {
  return (Math.round(n * 10 ** d) / 10 ** d).toString();
}

console.log(`=== AETHORIA SYSTEMS AUDIT ===`);
console.log(`size=${SIZE} seed=${SEED} years=${YEARS} ticksPerYear=${TICKS_PER_YEAR}\n`);

const tileMap = new TileMap(SIZE, SIZE, 'single_continent', SEED);

// ---------------- 1. Deposit coverage ----------------
const depTiles: Partial<Record<GoodId, number>> = {};
const depAmount: Partial<Record<GoodId, number>> = {};
for (let x = 0; x < tileMap.width; x++) {
  for (let y = 0; y < tileMap.height; y++) {
    const t = tileMap.getTile(x, y);
    if (!t?.resourceType) continue;
    depTiles[t.resourceType] = (depTiles[t.resourceType] ?? 0) + 1;
    depAmount[t.resourceType] = (depAmount[t.resourceType] ?? 0) + t.resourceAmount;
  }
}
console.log('--- DEPOSITS ON MAP ---');
const missingDeposits: GoodId[] = [];
for (const g of ALL_GOODS) {
  if (GOODS[g].kind !== 'raw') continue;
  const n = depTiles[g] ?? 0;
  if (n === 0) missingDeposits.push(g);
  console.log(`  ${pad(g, 12)} tiles=${pad(n, 6)} amount=${num(depAmount[g] ?? 0, 0)}`);
}
if (missingDeposits.length) console.log(`  !! RAW GOODS WITH ZERO DEPOSITS: ${missingDeposits.join(', ')}`);

// ---------------- 2. Run the simulation ----------------
const sim = new SimulationEngine();
const particles = new ParticleManager();

const startSpecies = [SpeciesType.LUMINI, SpeciesType.SYLVANII, SpeciesType.STONEKIN, SpeciesType.EMBERKIN];
const spots = [
  { x: SIZE * 0.25, y: SIZE * 0.25 },
  { x: SIZE * 0.75, y: SIZE * 0.25 },
  { x: SIZE * 0.25, y: SIZE * 0.75 },
  { x: SIZE * 0.75, y: SIZE * 0.75 }
];
startSpecies.forEach((sp, i) => {
  for (let k = 0; k < 6; k++) {
    const e = sim.spawnEntity(sp, spots[i].x + (k % 3), spots[i].y + Math.floor(k / 3), tileMap, k % 2 === 0 ? 'male' : 'female');
    e.dynasty = `House${i}`;
  }
});
sim.totalBirths = 0;

function totalBuildings(): number {
  let n = 0;
  for (const c of sim.cities.values()) n += c.buildings.size;
  return n;
}

const totalTicks = YEARS * TICKS_PER_YEAR;
const t0 = Date.now();
let peakShips = 0;
let peakCaravans = 0;
let peakRoutes = 0;
const yearLog: string[] = [];

const firstBuiltYear = new Map<string, number>();
const firstGoodYear = new Map<string, number>();
const firstTechYear = new Map<string, number>();

for (let tick = 1; tick <= totalTicks; tick++) {
  sim.tickAI(tileMap, particles);

  // Record the first year each building type, good and technology appears — this
  // is what shows whether the production chain actually unlocks in sequence.
  if (tick % TICKS_PER_YEAR === 0) {
    for (const c of sim.cities.values()) {
      for (const b of c.buildings.values()) {
        if (!firstBuiltYear.has(b.type)) firstBuiltYear.set(b.type, sim.currentYear);
      }
      for (const g of ALL_GOODS) {
        if (c.stock.get(g) > 0 && !firstGoodYear.has(g)) firstGoodYear.set(g, sim.currentYear);
      }
    }
    for (const k of sim.kingdoms.values()) {
      for (const t of k.research.known) {
        if (!firstTechYear.has(t)) firstTechYear.set(t, sim.currentYear);
      }
    }
  }
  if (tick % 2 === 0) {
    tileMap.updateFireTick();
    tileMap.updateFluidTick();
  }
  if (tick % 10 === 0 && sim.kingdoms.size > 1) {
    sim.diplomacy.tickDiplomacy([...sim.kingdoms.keys()], sim.currentYear);
  }
  peakShips = Math.max(peakShips, sim.naval.activeShips.size);
  peakCaravans = Math.max(peakCaravans, sim.caravans.activeCaravans.size);
  peakRoutes = Math.max(peakRoutes, sim.trade.routes.size);

  if (tick % TICKS_PER_YEAR === 0) {
    let pop = 0;
    let prosp = 0;
    let food = 0;
    for (const c of sim.cities.values()) {
      pop += c.population;
      prosp += c.prosperity;
      food += c.stock.get('food');
    }
    const nCities = Math.max(1, sim.cities.size);
    const k0 = [...sim.kingdoms.values()][0];
    const curTech = k0?.research.current;
    const techInfo = curTech
      ? `${curTech} ${num(k0.research.progress, 0)}/${num(techCost(TECHNOLOGIES[curTech]), 0)}`
      : '(idle)';
    yearLog.push(
      `  y${pad(sim.currentYear, 4)} ents=${pad(sim.entities.length, 5)} cities=${pad(sim.cities.size, 4)} pop=${pad(pop, 5)} prosp=${pad(num(prosp / nCities, 2), 6)} food=${pad(num(food, 0), 7)} rsch/yr=${pad(num(k0?.research.output ?? 0, 2), 6)} tech=${pad(techInfo, 26)} bld=${pad(totalBuildings(), 4)} routes=${pad(sim.trade.routes.size, 3)} ships=${pad(sim.naval.activeShips.size, 3)} carv=${sim.caravans.activeCaravans.size}`
    );
  }
}
const elapsed = (Date.now() - t0) / 1000;

console.log(`\n--- YEAR BY YEAR (${num(elapsed)}s wall, ${num(totalTicks / elapsed, 0)} ticks/s) ---`);
yearLog.forEach(l => console.log(l));

// ---------------- 3. Building coverage ----------------
console.log('\n--- BUILDINGS BUILT ---');
const buildCount: Partial<Record<BuildingType, number>> = {};
for (const c of sim.cities.values()) {
  for (const b of c.buildings.values()) buildCount[b.type] = (buildCount[b.type] ?? 0) + 1;
}
const neverBuilt: BuildingType[] = [];
for (const bt of ALL_BUILDING_TYPES) {
  const n = buildCount[bt] ?? 0;
  if (n === 0) neverBuilt.push(bt);
  else console.log(`  ${pad(bt, 18)} ${n}`);
}
console.log(`  NEVER BUILT (${neverBuilt.length}): ${neverBuilt.join(', ')}`);

// ---------------- 4. Goods actually in circulation ----------------
console.log('\n--- GOODS IN CITY STOCKPILES ---');
const stock: Partial<Record<GoodId, number>> = {};
for (const c of sim.cities.values()) {
  for (const g of ALL_GOODS) stock[g] = (stock[g] ?? 0) + c.stock.get(g);
}
const neverProduced: GoodId[] = [];
for (const g of ALL_GOODS) {
  const n = stock[g] ?? 0;
  if (n <= 0) neverProduced.push(g);
  else console.log(`  ${pad(g, 12)} ${num(n)}`);
}
console.log(`  ZERO STOCK (${neverProduced.length}): ${neverProduced.join(', ')}`);
console.log(`  CRAFTED NEVER MADE: ${CRAFTED_GOODS.filter(g => (stock[g] ?? 0) <= 0).join(', ') || '(none)'}`);

// ---------------- 5. Kingdom / tech / trade state ----------------
console.log('\n--- KINGDOMS ---');
for (const k of sim.kingdoms.values()) {
  console.log(
    `  ${pad(k.name, 22)} cities=${pad(k.cityIds.size, 3)} pop=${pad(k.totalPopulation, 6)} techs=${pad(k.research.known.size, 4)} gold=${pad(num(k.treasury.get('gold'), 0), 8)} gov=${pad(k.government, 14)} wealth=${num(k.wealth, 0)}`
  );
}

console.log('\n--- TRADE / LOGISTICS ---');
console.log(`  trade routes now=${sim.trade.routes.size} peak=${peakRoutes}`);
console.log(`  ships now=${sim.naval.activeShips.size} peak=${peakShips}`);
console.log(`  caravans now=${sim.caravans.activeCaravans.size} peak=${peakCaravans}`);
const byKind: Record<string, number> = {};
for (const r of sim.trade.routes.values()) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
console.log(`  routes by kind: ${JSON.stringify(byKind)}`);

console.log('\n--- UNLOCK TIMELINE (first year seen) ---');
const techLine = [...firstTechYear.entries()].sort((a, b) => a[1] - b[1]).map(([t, y]) => `${t}@y${y}`);
console.log(`  techs:     ${techLine.join(', ') || '(none)'}`);
const bldLine = [...firstBuiltYear.entries()].sort((a, b) => a[1] - b[1]).map(([t, y]) => `${t}@y${y}`);
console.log(`  buildings: ${bldLine.join(', ') || '(none)'}`);
const goodLine = [...firstGoodYear.entries()].sort((a, b) => a[1] - b[1]).map(([t, y]) => `${t}@y${y}`);
console.log(`  goods:     ${goodLine.join(', ') || '(none)'}`);

console.log('\n--- TERRITORY & BORDERS ---');
{
  let claimed = 0;
  let land = 0;
  const byKingdom = new Map<string, number>();
  for (let x = 0; x < tileMap.width; x++) {
    for (let y = 0; y < tileMap.height; y++) {
      const t = tileMap.getTile(x, y)!;
      const water = t.type.includes('ocean') || t.type === 'shallow_water';
      if (!water) land++;
      if (t.kingdomId) {
        claimed++;
        byKingdom.set(t.kingdomId, (byKingdom.get(t.kingdomId) ?? 0) + 1);
      }
    }
  }

  // Border contact: land tiles whose orthogonal neighbour belongs to another realm.
  let contacts = 0;
  const pairs = new Set<string>();
  for (let x = 0; x < tileMap.width; x++) {
    for (let y = 0; y < tileMap.height; y++) {
      const t = tileMap.getTile(x, y)!;
      if (!t.kingdomId) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const n = tileMap.getTile(x + dx, y + dy);
        if (!n?.kingdomId || n.kingdomId === t.kingdomId) continue;
        contacts++;
        pairs.add([t.kingdomId, n.kingdomId].sort().join('|'));
      }
    }
  }

  console.log(`  land tiles=${land} claimed=${claimed} (${num((claimed / Math.max(1, land)) * 100)}% of land)`);
  console.log(`  border contact tiles=${contacts} across ${pairs.size} realm pairs`);
  for (const c of sim.cities.values()) {
    console.log(`  ${pad(c.name, 16)} tier=${pad(c.tier, 11)} pop=${pad(c.population, 4)} territory=${pad(c.territory.size, 5)} limit=${c.territoryLimit(8)}`);
  }
}

console.log('\n--- LAYER 1: IDENTITY ---');
{
  const humans = sim.entities.filter(e => SPECIES_DEFINITIONS[e.species].isHumanoid);
  const withHome = humans.filter(e => e.homeBuildingId).length;
  const withOrigin = humans.filter(e => e.birthCityId).length;
  const withHousehold = humans.filter(e => e.householdId).length;
  const withJob = humans.filter(e => e.workplaceId).length;
  const migrants = humans.filter(e => e.birthCityId && e.cityId && e.birthCityId !== e.cityId).length;
  const wealth = humans.map(e => e.wealth);
  const byClass: Record<string, number> = {};
  for (const e of humans) byClass[e.socialClass] = (byClass[e.socialClass] ?? 0) + 1;

  console.log(`  humanoids=${humans.length}`);
  console.log(`  with birthplace = ${withOrigin}/${humans.length}`);
  console.log(`  with real home  = ${withHome}/${humans.length}`);
  console.log(`  with household  = ${withHousehold}/${humans.length}`);
  console.log(`  with workplace  = ${withJob}/${humans.length}`);
  console.log(`  migrants        = ${migrants}`);
  console.log(`  wealth: min=${Math.min(...wealth, 0)} max=${Math.max(...wealth, 0)} avg=${num(wealth.reduce((a, b) => a + b, 0) / Math.max(1, wealth.length))}`);
  console.log(`  social classes: ${JSON.stringify(byClass)}`);

  const sample = humans.slice(0, 3);
  for (const s of sample) {
    console.log(`  · ${s.fullName}, ${s.age}a, ${s.profession}, ${s.socialClass}, nasceu em "${s.birthCityName || '—'}" y${s.birthYear}, casa=${s.homeBuildingId ? 'sim' : 'nao'}, moedas=${Math.round(s.wealth)}`);
  }
}

console.log('\n--- LAYERS 2-6: ROUTINE, WORK, NEEDS, HOUSEHOLD, PRIORITY ---');
{
  const humans = sim.entities.filter(e => SPECIES_DEFINITIONS[e.species].isHumanoid);
  const states: Record<string, number> = {};
  for (const e of humans) states[e.aiState] = (states[e.aiState] ?? 0) + 1;

  const hunger = humans.map(e => e.needs.hunger);
  const starving = humans.filter(e => e.needs.hunger >= 88).length;
  const carrying = humans.filter(e => e.carrying).length;
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  console.log(`  aiStates: ${JSON.stringify(states)}`);
  console.log(`  hunger avg=${num(avg(hunger))} max=${num(Math.max(...hunger, 0))} starving=${starving}/${humans.length}`);
  console.log(`  comfort avg=${num(avg(humans.map(e => e.needs.comfort)))} safety avg=${num(avg(humans.map(e => e.needs.safety)))}`);
  console.log(`  energy avg=${num(avg(humans.map(e => e.energy)))}`);
  console.log(`  carrying a load right now = ${carrying}`);

  const hh = [...sim.households.values()];
  const coin = hh.map(h => h.coin);
  const pantry = hh.map(h => h.pantry.get('food'));
  console.log(`  households=${hh.length} avgSize=${num(avg(hh.map(h => h.size)))}`);
  console.log(`  household coin: avg=${num(avg(coin))} max=${num(Math.max(...coin, 0))}`);
  console.log(`  household pantry food: avg=${num(avg(pantry))} empty=${pantry.filter(p => p <= 0).length}/${hh.length}`);
  console.log(`  personal wealth: avg=${num(avg(humans.map(e => e.wealth)))} max=${num(Math.max(...humans.map(e => e.wealth), 0))}`);
}

console.log('\n--- ROADS (after 8 years) ---');
{
  const roadCount = [0, 0, 0, 0];
  for (let x = 0; x < tileMap.width; x++) {
    for (let y = 0; y < tileMap.height; y++) {
      roadCount[tileMap.getTile(x, y)?.roadLevel ?? 0]++;
    }
  }
  console.log(`  dirt(1)=${roadCount[1]} stone(2)=${roadCount[2]} imperial(3)=${roadCount[3]} total=${roadCount[1] + roadCount[2] + roadCount[3]}`);
}

console.log('\n--- POPULATION ---');
console.log(`  entities=${sim.entities.length} births=${sim.totalBirths} deaths=${sim.totalDeaths} year=${sim.currentYear}`);
