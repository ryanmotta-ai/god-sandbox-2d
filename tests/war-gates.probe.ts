/**
 * Which gate in tickGeopolitics actually stops a declaration?
 *
 * A browser world sat at -99 with seven realms and never declared. Rather than
 * read the code again and guess, this walks every known pair each year and
 * reports which of the guards it fails, in the same order tickGeopolitics
 * applies them. `pior_rel` alone was misleading: the most hostile pair can be
 * the most DISTANT pair, and distance is a hard gate (proximity <= 0).
 */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';

const YEARS = Number(process.env.YEARS ?? 70), MAP = 96, SEED = 20260802;
const PEOPLES = Number(process.env.PEOPLES ?? 1);
rng.setSeed(SEED);
const tileMap = new TileMap(MAP, MAP, 'single_continent', SEED);
const sim = new SimulationEngine();
const particles = new ParticleManager();

for (let p = 0; p < PEOPLES; p++) {
  let point = { x: MAP / 2, y: MAP / 2 };
  for (let i = 0; i < 400; i++) {
    const x = rng.rangeInt(2, tileMap.width - 3), y = rng.rangeInt(2, tileMap.height - 3);
    const t = tileMap.getTile(x, y);
    if (t && !String(t.type).includes('ocean') && t.type !== 'mountain' && t.type !== 'lava') { point = { x, y }; break; }
  }
  for (let i = 0; i < 8; i++) {
    sim.spawnEntity(SpeciesType.HUMAN, point.x + rng.range(-2, 2), point.y + rng.range(-2, 2), tileMap, i % 2 === 0 ? 'male' : 'female');
  }
}

const WAR_GRIEVANCE_PROXIMITY = 30; // mirrored from EntityAI to label the output

console.log(`${PEOPLES} povo(s), ${YEARS} anos\n`);
console.log('ano reinos pares  vassal  longe  amistoso  ELEGÍVEL   melhorPar(rel/dist)      guerras hist');
for (let y = 1; y <= YEARS; y++) {
  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(tileMap, particles);
  if (y % 10 !== 0) continue;

  const ks = [...sim.kingdoms.values()];
  let pairs = 0, vassal = 0, tooFar = 0, tooFriendly = 0, eligible = 0;
  let best: { rel: number; dist: number } | null = null;

  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = ks[i], b = ks[j];
    if (!a.knownKingdoms.has(b.id)) continue;
    pairs++;
    if (a.overlordId === b.id || b.overlordId === a.id || (a.overlordId && a.overlordId === b.overlordId)) { vassal++; continue; }
    const rel = sim.diplomacy.getRelation(a.id, b.id);
    const dist = sim.civ.closestRealmDistance(a, b, sim.cities);
    const proximity = Math.min(1, Math.max(0, 1 - dist / 70));
    if (proximity <= 0) { tooFar++; continue; }
    // The clause the declaration actually has to clear, after year 40.
    if (rel > 6 + proximity * WAR_GRIEVANCE_PROXIMITY) { tooFriendly++; continue; }
    eligible++;
    // Closest eligible pair — the one most likely to actually go.
    if (!best || dist < best.dist) best = { rel, dist };
  }

  console.log(
    `${String(y).padStart(3)} ${String(ks.length).padStart(6)} ${String(pairs).padStart(5)}` +
    ` ${String(vassal).padStart(7)} ${String(tooFar).padStart(6)} ${String(tooFriendly).padStart(9)}` +
    ` ${String(eligible).padStart(9)}   ${(best ? `${best.rel.toFixed(0)} / ${best.dist.toFixed(0)} tiles` : '--').padStart(20)}` +
    ` ${String(sim.diplomacy.activeWars.size).padStart(7)} ${String(sim.diplomacy.warHistory.length).padStart(4)}`
  );
}
