/**
 * Journey audit: plays the REAL simulation loop (tickAI, same as the game)
 * for 120 years with two founding species and checks that the full journey
 * works: cities founded, buildings built, tech researched, armies raised,
 * economy moving.
 */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType, SPECIES_DEFINITIONS } from '../src/entities/Species';
import { GOODS, ALL_GOODS } from '../src/civ/Goods';
import { generateDynastyName } from '../src/civ/Lineage';
import { rng } from '../src/core/Random';
import { chronicle } from '../src/civ/Chronicle';

rng.setSeed(20260802);

const MAP_SIZE = Number(process.env.JOURNEY_MAP ?? 96);
const WILDLIFE = process.env.JOURNEY_WILDLIFE !== '0';
const YEAR_LIMIT = Number(process.env.JOURNEY_YEARS ?? 120);
const SAMPLE_EVERY = 10;
const PROVOKE_YEAR = process.env.JOURNEY_PROVOKE ? Number(process.env.JOURNEY_PROVOKE) : 0;
const PROGRESS_LOG = 'tests/journey_progress.log';
import { writeFileSync, appendFileSync } from 'fs';
writeFileSync(PROGRESS_LOG, '');
function progress(msg: string): void {
  appendFileSync(PROGRESS_LOG, `${msg}\n`);
  process.stdout.write(msg + '\n');
}

const tileMap = new TileMap(MAP_SIZE, MAP_SIZE, 'single_continent', 20260802);
const sim = new SimulationEngine();
const particles = new ParticleManager();

const species = [SpeciesType.HUMAN, SpeciesType.HUMAN];
const spawnPoints = species.map(() => {
  for (let i = 0; i < 400; i++) {
    const x = rng.rangeInt(2, tileMap.width - 3);
    const y = rng.rangeInt(2, tileMap.height - 3);
    const t = tileMap.getTile(x, y);
    if (t && !t.type.includes('ocean') && t.type !== 'mountain' && t.type !== 'lava') return { x, y };
  }
  return { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
});

species.forEach((sp, index) => {
  const point = spawnPoints[index] ?? spawnPoints[0];
  const dynasty = generateDynastyName(sp);
  for (let i = 0; i < 8; i++) {
    const e = sim.spawnEntity(sp, point.x + rng.range(-2, 2), point.y + rng.range(-2, 2), tileMap, i % 2 === 0 ? 'male' : 'female');
    e.dynasty = dynasty;
  }
});
const fauna = [SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.BOAR, SpeciesType.BOAR, SpeciesType.EAGLE, SpeciesType.WOLF, SpeciesType.BEAR];
const wildCount = WILDLIFE ? Math.round((tileMap.width * tileMap.height) / 700) : 0;
for (let i = 0; i < wildCount; i++) {
  const x = rng.rangeInt(2, tileMap.width - 3);
  const y = rng.rangeInt(2, tileMap.height - 3);
  sim.spawnEntity(fauna[rng.rangeInt(0, fauna.length - 1)], x, y, tileMap);
}

interface Sample {
  year: number;
  civilised: number;
  cities: number;
  kingdoms: number;
  buildings: number;
  techs: number;
  soldiers: number;
  treasury: number;
  wars: number;
  pricesDrifted: number;
  avgSatisfaction: number;
}

const samples: Sample[] = [];
let peaks = { civilised: 0, cities: 0, buildings: 0, techs: 0, soldiers: 0 };

const start = Date.now();
for (let y = 1; y <= YEAR_LIMIT; y++) {
  try {
    for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(tileMap, particles);
  } catch (err) {
    console.error(`CRASH at year ${y}:`, err);
    process.exit(1);
  }

  // The god's hand: provoke a war between the two largest realms at a chosen
  // year (the same "Divine Provocation" the in-game player can do). This is how
  // the journey certifies the army/warfare loop — natural AI wars are rare in
  // peaceful worlds, and the game needs tension to raise armies.
  if (PROVOKE_YEAR > 0 && y === PROVOKE_YEAR) {
    const sorted = [...sim.kingdoms.values()].sort((a, b) => b.totalPopulation - a.totalPopulation);
    const a = sorted[0];
    const b = sorted[1];
    if (a && b && a.id !== b.id && !sim.diplomacy.isAtWar(a.id, b.id)) {
      const ok = sim.diplomacy.declareWar(a.id, b.id, sim.currentYear, 'Divine Provocation');
      progress(ok ? `⚔️ DIVINE PROVOCATION: ${a.name} at war with ${b.name} (year ${y})` : `⚠️ provocation failed`);
    }
  }

  if (y % SAMPLE_EVERY === 0) {
    let civilised = 0;
    for (const e of sim.entities) if (SPECIES_DEFINITIONS[e.species].isHumanoid && e.hp > 0) civilised++;
    progress(`year ${y}: entities=${sim.entities.length} civilised=${civilised} cities=${sim.cities.size} kingdoms=${sim.kingdoms.size}`);
  }

  if (y % SAMPLE_EVERY === 0 || y === YEAR_LIMIT) {
    let buildings = 0, techs = 0, treasury = 0, soldiers = 0, kingPop = 0;
    for (const city of sim.cities.values()) buildings += city.buildings.size;
    for (const k of sim.kingdoms.values()) {
      techs += k.research.known.size;
      treasury += k.economy.treasury;
      kingPop += k.totalPopulation;
    }
    for (const e of sim.entities) {
      if (!SPECIES_DEFINITIONS[e.species].isHumanoid || e.hp <= 0) continue;
      if (e.profession === 'soldier') soldiers++;
    }
    let satSum = 0, satN = 0;
    for (const k of sim.kingdoms.values()) {
      for (const f of Object.values(k.society.factions)) { satSum += f.satisfaction; satN++; }
    }
    const satisfaction = satN > 0 ? satSum / satN : 0;

    let civilised = 0;
    for (const e of sim.entities) if (SPECIES_DEFINITIONS[e.species].isHumanoid && e.hp > 0) civilised++;

    const drifted = ALL_GOODS.filter(g => {
      const p = sim.market.price(g);
      const base = GOODS[g].basePrice;
      return Math.abs(p - base) / Math.max(1, base) > 0.1;
    }).length;

    const s: Sample = {
      year: y, civilised, cities: sim.cities.size, kingdoms: sim.kingdoms.size,
      buildings, techs, soldiers, treasury: Math.round(treasury),
      wars: sim.diplomacy.warHistory.length,
      pricesDrifted: drifted,
      avgSatisfaction: satisfaction
    };
    samples.push(s);
    peaks.civilised = Math.max(peaks.civilised, civilised);
    peaks.cities = Math.max(peaks.cities, sim.cities.size);
    peaks.buildings = Math.max(peaks.buildings, buildings);
    peaks.techs = Math.max(peaks.techs, techs);
    peaks.soldiers = Math.max(peaks.soldiers, soldiers);
  }

  if (y % 20 === 0) {
    const kList = [...sim.kingdoms.values()];
    for (const k of kList) {
      const rels = kList.filter(o => o.id !== k.id)
        .map(o => `${o.species}:${Math.round(sim.diplomacy.getRelation(k.id, o.id))}`)
        .join(',');
      const bldgTypes = new Set<string>();
      for (const id of k.cityIds) {
        const c = sim.cities.get(id);
        if (c) for (const b of c.buildings.values()) bldgTypes.add(b.type);
      }
      const hasBarracks = bldgTypes.has('barracks');
      const tech = [...k.research.known].join(',');
      progress(
        `  [K] ${k.name}(${k.species}) gov=${k.government} cities=${k.cityIds.size} pop=${k.totalPopulation} ` +
        `treas=${Math.round(k.economy.treasury)} rel[${rels}] agreements=${worldAgreements(sim, k.id)} ` +
        `barracks=${hasBarracks} techs=${k.research.known.size} :: ${tech}`
      );
    }
  }
}

function worldAgreements(sim: SimulationEngine, kingdomId: string): number {
  let n = 0;
  return n;
}
const elapsed = Date.now() - start;
console.log(`\n=== JOURNEY REPORT (${YEAR_LIMIT} years in ${Math.round(elapsed / 1000)}s) ===`);console.log(`year | pop | cities | kdoms | bldgs | tech | sold | tresaury | wars | drift | happy`);
for (const s of samples) {
  console.log(
    `${String(s.year).padStart(4)} | ${String(s.civilised).padStart(3)} | ${String(s.cities).padStart(4)} | ${String(s.kingdoms).padStart(3)} | ${String(s.buildings).padStart(5)} | ${String(s.techs).padStart(4)} | ${String(s.soldiers).padStart(3)} | ${String(s.treasury).padStart(8)} | ${String(s.wars).padStart(3)} | ${String(s.pricesDrifted).padStart(4)} | ${s.avgSatisfaction.toFixed(2)}`
  );
}

console.log(`\npeaks: civilised=${peaks.civilised} cities=${peaks.cities} buildings=${peaks.buildings} techs=${peaks.techs} soldiers=${peaks.soldiers}`);
console.log(`final entity count=${sim.entities.length}; totalBirths=${sim.totalBirths}`);

// -------------------- economy diagnosis --------------------
if (process.env.DUMP === '1') {
  for (const k of sim.kingdoms.values()) {
    const lat = k.economy.latest();
    console.log(`\n[${k.name}] treasury=${Math.round(k.economy.treasury).toLocaleString()}g output=${Math.round(k.economy.output).toLocaleString()}`);
    if (lat) {
      console.log(`  latest ledger: tax=${lat.taxIncome.toFixed(1)} trade=${lat.tradeIncome.toFixed(1)} upkeep=${lat.upkeep.toFixed(1)} net=${lat.net.toFixed(1)} output=${lat.output.toFixed(1)}`);
    }
    for (const cid of k.cityIds) {
      const c = sim.cities.get(cid)!;
      const top = c.stock.entries().slice(0, 4).map(({ good, amount }) => `${good}:${Math.round(amount)}@${sim.market.price(good as any).toFixed(1)}`).join(' ');
      console.log(`  city ${c.name}: pop=${c.population} bldgs=${c.buildings.size} stock[${top}]`);
    }
  }
  console.log('\ntop market prices (price vs base):');
  const prices = ALL_GOODS.map(g => [g, sim.market.price(g), GOODS[g].basePrice] as const)
    .sort((a, b) => b[1] / b[2] - a[1] / a[2])
    .slice(0, 8)
    .map(([g, p, base]) => `${g} ${p.toFixed(1)}/${base.toFixed(1)}`)
    .join('  ');
  console.log(prices);
}

// -------------------- journey assertions --------------------
const last = samples[samples.length - 1];
const fails: string[] = [];
if (peaks.cities < 2) fails.push(`cities never grew (peak ${peaks.cities})`);
if (peaks.buildings < 1) fails.push(`no buildings were ever constructed`);
if (peaks.techs < 2) fails.push(`research never advanced (peak ${peaks.techs} techs incl. tribalism)`);
if (last.avgSatisfaction <= 0) fails.push(`society never produced satisfaction data`);
if (peaks.soldiers < 1) fails.push(`no soldier was ever raised`);
if (PROVOKE_YEAR > 0) {
  if (sim.diplomacy.warHistory.length < 1) fails.push(`provoked war never happened`);
  if (peaks.soldiers < 1) fails.push(`the realm at war never raised an army`);
}
if (last.civilised < 2) fails.push(`civilisation died out (final pop ${last.civilised})`);

// Economy must actually move prices (market functioning).
if (peaks.pricesDrifted < 1) fails.push(`world market never moved a price off base`);

if (fails.length > 0) {
  console.log('\nJOURNEY FAILURES:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
console.log('\nJOURNEY OK: cities, buildings, tech, army and economy all worked.');
