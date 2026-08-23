/**
 * Where does the army pipeline actually stop?
 *
 * `war-contact.probe.ts` shows a live world reaching year 60 with zero soldiers,
 * but it cannot say *why*: the realm never researched `bronze_working`, so the
 * barracks — the only building that produces the `soldier` profession — never
 * existed, and every rule downstream of it was untested.
 *
 * This probe removes that one variable. Two realms are handed the whole bronze
 * chain on year 1 and put at war on year 5, so nothing waits on research. What
 * gets measured is the rest of the chain:
 *
 *   - does `scoreBuilding` ever choose a barracks over another farm or quarry?
 *   - does the peacetime standing army (`assignProfession` soldierBoost) fill it?
 *   - does the wartime levy (`musterArmies`) add anything on top, or does it hit
 *     `openSlots <= 0` and return?
 *   - what fraction of the population ends up under arms, and does it keep
 *     climbing (`produceGoods` re-staffs from scratch every year and nothing ever
 *     demotes a soldier)?
 *
 * Run: npx tsx tests/army-pipeline.probe.ts
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

const YEARS = Number(process.env.ARMY_PROBE_YEARS ?? 70);
const WAR_YEAR = Number(process.env.ARMY_PROBE_WAR ?? 5);
const SEED = Number(process.env.ARMY_PROBE_SEED ?? 20260802);

rng.setSeed(SEED);
const tileMap = new TileMap(64, 64, 'single_continent', SEED);
const sim = new SimulationEngine();

function landNear(x: number, y: number, radius = 10): { x: number; y: number } {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const t = tileMap.getTile(x + dx, y + dy);
        if (t && !TERRAINS[t.type].isWater && t.type !== 'mountain') return { x: t.x, y: t.y };
      }
    }
  }
  throw new Error('no land');
}

const posA = landNear(18, 18);
const posB = landNear(44, 44);

const cityA = new City('cityA', 'Ferrovale', SpeciesType.HUMAN, posA.x, posA.y, 'Fundador', 1);
const cityB = new City('cityB', 'Auroral', SpeciesType.HUMAN, posB.x, posB.y, 'Fundador', 1);
sim.cities.set(cityA.id, cityA);
sim.cities.set(cityB.id, cityB);

const kA = new Kingdom('kA', 'Reino de Ferro', SpeciesType.HUMAN, '#ff6b6b', cityA.id, 1);
const kB = new Kingdom('kB', 'Reino da Aurora', SpeciesType.HUMAN, '#4dabf7', cityB.id, 1);
cityA.kingdomId = kA.id;
cityB.kingdomId = kB.id;
sim.kingdoms.set(kA.id, kA);
sim.kingdoms.set(kB.id, kB);
kA.knownKingdoms.add(kB.id);
kB.knownKingdoms.add(kA.id);

// The whole point of the probe: the tech gate is already open on year 1.
const GRANTED = ['stone_tools', 'fire_mastery', 'agriculture', 'mining', 'masonry', 'bronze_working'];
for (const k of [kA, kB]) for (const tech of GRANTED) k.research.complete(tech);

// Enough founding stock that nothing stalls for want of thirty stone.
for (const c of [cityA, cityB]) {
  c.stock.add('food', 600);
  c.stock.add('wood', 400);
  c.stock.add('stone', 300);
}

function spawnCitizens(city: City, kingdomId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const e = sim.spawnEntity(SpeciesType.HUMAN, city.x, city.y, tileMap, i % 2 === 0 ? 'male' : 'female');
    e.cityId = city.id;
    e.kingdomId = kingdomId;
    e.profession = 'none';
  }
}
spawnCitizens(cityA, kA.id, 40);
spawnCitizens(cityB, kB.id, 40);

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
const warfare = new WarfareSystem();

/** What the barracks itself believes it has hired — the number `musterArmies` reads. */
function registered(city: City): number {
  let total = 0;
  for (const b of city.buildings.values()) {
    if (b.type === 'barracks') total += b.assignedWorkerIds.size;
  }
  return total;
}

/** Barracks job slots in a city, the ceiling `musterArmies` refuses to cross. */
function slots(city: City): number {
  let total = 0;
  for (const b of city.buildings.values()) {
    if (b.type === 'barracks' && b.isOperational()) total += (b.definition.jobs ?? 0) * b.level;
  }
  return total;
}

function soldiersIn(cityId: string): number {
  return sim.entities.filter(e => e.cityId === cityId && e.hp > 0 && e.profession === 'soldier').length;
}

let firstBarracksYear: number | null = null;
let firstSoldierYear: number | null = null;

console.log(`probe: ${YEARS} anos, guerra no ano ${WAR_YEAR}, seed ${SEED}`);
console.log('bronze_working concedido no ano 1 — nada aqui espera pesquisa\n');
console.log('ano  guerra   popA  quartA vagasA regA soldA  %A   popB quartB soldB   levaA_alvo');

for (let year = 1; year <= YEARS; year++) {
  world.year = year;
  sim.currentYear = year;

  if (year === WAR_YEAR && !sim.diplomacy.isAtWar(kA.id, kB.id)) {
    sim.diplomacy.declareWar(kA.id, kB.id, year, 'Provocação da sonda');
  }

  civ.tickYear(world);
  // musterArmies is private; the yearly EntityAI pass is what calls it in game,
  // so drive the real thing rather than a reimplementation of the levy.
  (sim as unknown as { musterArmies(): void }).musterArmies();
  warfare.tickYear(world);

  const barracksA = cityA.countOfType('barracks');
  const soldA = soldiersIn(cityA.id);
  const soldB = soldiersIn(cityB.id);
  if (barracksA > 0 && firstBarracksYear === null) firstBarracksYear = year;
  if (soldA + soldB > 0 && firstSoldierYear === null) firstSoldierYear = year;

  if (year % 5 === 0 || year === YEARS) {
    const openA = Math.max(0, slots(cityA) - soldA);
    const levyTarget = Math.max(2, Math.round(cityA.population * 0.12));
    const pct = cityA.population > 0 ? ((soldA / cityA.population) * 100).toFixed(0) : '0';
    console.log(
      `${String(year).padStart(3)} ${String(sim.diplomacy.isAtWar(kA.id, kB.id) ? 'sim' : 'nao').padStart(7)}` +
      ` ${String(cityA.population).padStart(6)} ${String(barracksA).padStart(7)} ${String(openA).padStart(6)}` +
      ` ${String(registered(cityA)).padStart(4)} ${String(soldA).padStart(5)} ${pct.padStart(4)}%` +
      ` ${String(cityB.population).padStart(6)} ${String(cityB.countOfType('barracks')).padStart(6)} ${String(soldB).padStart(6)}` +
      ` ${String(levyTarget).padStart(12)}`
    );
  }
}

const soldA = soldiersIn(cityA.id);
console.log('\n================ VEREDITO ================');
console.log(`1o quartel             ${firstBarracksYear ? `ano ${firstBarracksYear}` : 'NUNCA'}`);
console.log(`1o soldado             ${firstSoldierYear ? `ano ${firstSoldierYear}` : 'NUNCA'}`);
console.log(`quarteis em A          ${cityA.countOfType('barracks')} (${slots(cityA)} vagas)`);
console.log(`soldados em A          ${soldA} de ${cityA.population} habitantes` +
  ` (${cityA.population > 0 ? ((soldA / cityA.population) * 100).toFixed(1) : '0'}%)`);
console.log(`alvo da leva de guerra ${Math.max(2, Math.round(cityA.population * 0.12))} (12% da populacao)`);
console.log(`teto imposto por vagas ${slots(cityA)}`);
console.log(`assignedWorkerIds      ${registered(cityA)} — o que musterArmies acha que existe`);
console.log(`predios em A           ${[...cityA.buildings.values()].map(b => b.type).sort().join(', ')}`);
