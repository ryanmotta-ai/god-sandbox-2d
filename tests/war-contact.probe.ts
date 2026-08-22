/**
 * War contact probe: plays the REAL simulation loop (tickAI, same as the game)
 * and answers the one question every war feature depends on — do two realms
 * ever get close enough, and hostile enough, for a war the front system can
 * actually stage?
 *
 * Reports per sample year: how far apart the realms are, how much they like
 * each other, whether anyone is at war, and how many front sectors exist.
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

let everInContact = false;
let everAtWar = false;
let peakSectors = 0;
let firstContactYear: number | null = null;
let firstWarYear: number | null = null;
let firstSectorYear: number | null = null;
let yearsWithSectors = 0;

console.log(`probe: ${YEARS} anos, mapa ${MAP_SIZE}x${MAP_SIZE}, seed ${SEED}, provocar=${PROVOKE || 'nao'}`);
console.log(`CONTACT_RANGE = ${CONTACT_RANGE} tiles (abaixo disso uma frente pode se formar)\n`);
console.log('ano   reinos cidades  dist-min  relacao  guerras  setores');

for (let y = 1; y <= YEARS; y++) {
  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(tileMap, particles);

  if (PROVOKE > 0 && y === PROVOKE) {
    const sorted = [...sim.kingdoms.values()].sort((a, b) => b.totalPopulation - a.totalPopulation);
    const [a, b] = sorted;
    if (a && b && a.id !== b.id && !sim.diplomacy.isAtWar(a.id, b.id)) {
      const ok = sim.diplomacy.declareWar(a.id, b.id, sim.currentYear, 'Divine Provocation');
      console.log(`>>> provocacao no ano ${y}: ${a.name} x ${b.name} — ${ok ? 'guerra declarada' : 'FALHOU'}`);
    }
  }

  const pair = closestHostilePair();
  const sectors = sim.fronts.sectors.size;
  const wars = sim.diplomacy.activeWars.size;

  if (pair && pair.dist <= CONTACT_RANGE && !everInContact) { everInContact = true; firstContactYear = y; }
  if (wars > 0 && !everAtWar) { everAtWar = true; firstWarYear = y; }
  if (sectors > 0) {
    yearsWithSectors++;
    if (firstSectorYear === null) firstSectorYear = y;
  }
  peakSectors = Math.max(peakSectors, sectors);

  if (y % 10 === 0 || y === YEARS) {
    const rel = pair ? sim.diplomacy.getRelation(pair.a, pair.b).toFixed(0) : '--';
    const dist = pair ? pair.dist.toFixed(1) : '--';
    const flag = pair && pair.dist <= CONTACT_RANGE ? ' <= CONTATO' : '';
    console.log(
      `${String(y).padStart(4)}  ${String(sim.kingdoms.size).padStart(6)} ${String(sim.cities.size).padStart(7)}  ${dist.padStart(8)}  ${rel.padStart(7)}  ${String(wars).padStart(7)}  ${String(sectors).padStart(7)}${flag}`
    );
  }
}

console.log('\n================ VEREDITO ================');
console.log(`reinos chegaram a <= ${CONTACT_RANGE} tiles?  ${everInContact ? `SIM (ano ${firstContactYear})` : 'NUNCA'}`);
console.log(`houve guerra?                     ${everAtWar ? `SIM (ano ${firstWarYear})` : 'NUNCA'}`);
console.log(`alguma frente se formou?          ${peakSectors > 0 ? `SIM (ano ${firstSectorYear}, pico ${peakSectors} setores)` : 'NUNCA'}`);
console.log(`anos com frente ativa:            ${yearsWithSectors} de ${YEARS}`);
console.log(`guerras no historico:             ${sim.diplomacy.warHistory.length}`);
