/**
 * Live-world probe: plays the REAL simulation loop (tickAI, same as the game)
 * and reports the handful of numbers that say whether the world is working —
 * do realms ever fight, do they ever raise an army, and does the economy stay
 * bounded.
 *
 * This exists because every war feature so far was validated by synthetic tests
 * on flat ground and none of them had ever been seen running in a live world.
 * A war feature is not finished until these columns move.
 *
 *   WAR_PROBE_YEARS    how long to run            (default 200)
 *   WAR_PROBE_MAP      map edge in tiles          (default 96)
 *   WAR_PROBE_PROVOKE  force a war at this year   (default 0 = let the AI decide)
 *   WAR_PROBE_SEED     world seed                 (default 20260802)
 */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType } from '../src/entities/Species';
import { generateDynastyName } from '../src/civ/Lineage';
import { rng } from '../src/core/Random';

/** WarFronts.ts keeps this private; mirrored here only to label the output. */
const CONTACT_RANGE = 34;

const YEARS = Number(process.env.WAR_PROBE_YEARS ?? 200);
const MAP_SIZE = Number(process.env.WAR_PROBE_MAP ?? 96);
const PROVOKE = Number(process.env.WAR_PROBE_PROVOKE ?? 0);
const SEED = Number(process.env.WAR_PROBE_SEED ?? 20260802);

rng.setSeed(SEED);
const tileMap = new TileMap(MAP_SIZE, MAP_SIZE, 'single_continent', SEED);
const sim = new SimulationEngine();
const particles = new ParticleManager();

// Two founding peoples, same as the journey audit.
for (const _ of [0, 1]) {
  let point = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
  for (let i = 0; i < 400; i++) {
    const x = rng.rangeInt(2, tileMap.width - 3);
    const y = rng.rangeInt(2, tileMap.height - 3);
    const t = tileMap.getTile(x, y);
    if (t && !t.type.includes('ocean') && t.type !== 'mountain' && t.type !== 'lava') { point = { x, y }; break; }
  }
  const dynasty = generateDynastyName(SpeciesType.HUMAN);
  for (let i = 0; i < 8; i++) {
    const e = sim.spawnEntity(SpeciesType.HUMAN, point.x + rng.range(-2, 2), point.y + rng.range(-2, 2), tileMap, i % 2 === 0 ? 'male' : 'female');
    e.dynasty = dynasty;
  }
}

/** Closest pair of settlements belonging to two different realms. */
function closestHostilePair(): { dist: number; a: string; b: string } | null {
  const owned = [...sim.cities.values()].filter(c => c.kingdomId);
  let best: { dist: number; a: string; b: string } | null = null;
  for (let i = 0; i < owned.length; i++) {
    for (let j = i + 1; j < owned.length; j++) {
      if (owned[i].kingdomId === owned[j].kingdomId) continue;
      const d = Math.hypot(owned[i].x - owned[j].x, owned[i].y - owned[j].y);
      if (!best || d < best.dist) best = { dist: d, a: owned[i].kingdomId!, b: owned[j].kingdomId! };
    }
  }
  return best;
}

function census() {
  let soldiers = 0, pop = 0;
  for (const e of sim.entities) {
    if (e.hp <= 0) continue;
    if (e.profession === 'soldier') soldiers++;
    if (e.cityId) pop++;
  }
  let barracks = 0, walls = 0;
  for (const c of sim.cities.values()) {
    barracks += c.countOfType('barracks');
    walls += c.countOfType('wall');
  }
  let treasury = 0, armies = 0;
  for (const k of sim.kingdoms.values()) {
    treasury += k.gold;
    armies += sim.warfare.getArmiesForKingdom(k.id).length;
  }
  return { soldiers, pop, barracks, walls, treasury: Math.round(treasury), armies };
}

let everAtWar = false, peakSectors = 0, yearsWithSectors = 0, yearsAtWar = 0;
let firstWarYear: number | null = null, firstSectorYear: number | null = null;
let firstSoldierYear: number | null = null, firstBarracksYear: number | null = null;
let firstWallYear: number | null = null, peakTreasury = 0, minRelation = 999;

console.log(`probe: ${YEARS} anos, mapa ${MAP_SIZE}x${MAP_SIZE}, seed ${SEED}, provocar=${PROVOKE || 'nao'}\n`);
console.log('ano  reinos cidades dist  rel  guerras setores  sold quart mural exerc    tesouro');

for (let y = 1; y <= YEARS; y++) {
  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(tileMap, particles);

  if (PROVOKE > 0 && y === PROVOKE) {
    const sorted = [...sim.kingdoms.values()].sort((a, b) => b.totalPopulation - a.totalPopulation);
    const [a, b] = sorted;
    if (a && b && a.id !== b.id && !sim.diplomacy.isAtWar(a.id, b.id)) {
      const ok = sim.diplomacy.declareWar(a.id, b.id, sim.currentYear, 'Divine Provocation');
      console.log(`>>> provocacao ano ${y}: ${a.name} x ${b.name} — ${ok ? 'declarada' : 'FALHOU'}`);
    }
  }

  const pair = closestHostilePair();
  const c = census();
  const sectors = sim.fronts.sectors.size;
  const wars = sim.diplomacy.activeWars.size;

  if (wars > 0) { yearsAtWar++; if (!everAtWar) { everAtWar = true; firstWarYear = y; } }
  if (sectors > 0) { yearsWithSectors++; if (firstSectorYear === null) firstSectorYear = y; }
  if (c.soldiers > 0 && firstSoldierYear === null) firstSoldierYear = y;
  if (c.barracks > 0 && firstBarracksYear === null) firstBarracksYear = y;
  if (c.walls > 0 && firstWallYear === null) firstWallYear = y;
  peakSectors = Math.max(peakSectors, sectors);
  peakTreasury = Math.max(peakTreasury, c.treasury);
  if (pair) minRelation = Math.min(minRelation, sim.diplomacy.getRelation(pair.a, pair.b));

  if (y % 10 === 0 || y === YEARS) {
    const rel = pair ? sim.diplomacy.getRelation(pair.a, pair.b).toFixed(0) : '--';
    const dist = pair ? pair.dist.toFixed(0) : '--';
    console.log(
      `${String(y).padStart(4)} ${String(sim.kingdoms.size).padStart(5)} ${String(sim.cities.size).padStart(6)}` +
      ` ${dist.padStart(5)} ${rel.padStart(5)} ${String(wars).padStart(6)} ${String(sectors).padStart(7)}` +
      ` ${String(c.soldiers).padStart(5)} ${String(c.barracks).padStart(5)} ${String(c.walls).padStart(5)}` +
      ` ${String(c.armies).padStart(5)} ${String(c.treasury).padStart(10)}`
    );
  }
}

const c = census();
console.log('\n================ VEREDITO ================');
console.log(`guerra                 ${everAtWar ? `SIM (1a no ano ${firstWarYear})` : 'NUNCA'} — ${yearsAtWar}/${YEARS} anos em guerra`);
console.log(`frentes                ${peakSectors > 0 ? `SIM (ano ${firstSectorYear}, pico ${peakSectors})` : 'NUNCA'} — ${yearsWithSectors}/${YEARS} anos com frente`);
console.log(`relacao mais hostil    ${minRelation === 999 ? '--' : minRelation.toFixed(0)}`);
console.log(`soldados               ${firstSoldierYear ? `1o no ano ${firstSoldierYear}` : 'NUNCA'} — ${c.soldiers} no fim`);
console.log(`quarteis               ${firstBarracksYear ? `1o no ano ${firstBarracksYear}` : 'NUNCA'} — ${c.barracks} no fim`);
console.log(`muralhas               ${firstWallYear ? `1a no ano ${firstWallYear}` : 'NUNCA'} — ${c.walls} no fim`);
console.log(`exercitos no fim       ${c.armies}`);
console.log(`tesouro somado         ${c.treasury} (pico ${peakTreasury}) para ${c.pop} habitantes`);
console.log(`guerras no historico   ${sim.diplomacy.warHistory.length}`);
