/**
 * One table for the whole balance of a live world.
 *
 * `balance-pacing.probe.ts` answers whether the tech tree is reachable from the
 * cost tables alone. This one is the opposite: it runs the real loop and reports
 * the ratios that decide how the world FEELS — how much of a population is under
 * arms, whether the levy's food gate is what holds that number down, whether
 * anybody is fed, and how often kings actually fight.
 *
 * The columns exist because each one is a lever somebody will want to pull. If a
 * number here is wrong, the fix is a constant, not a redesign.
 *
 *   YEARS    how long to run          (default 80)
 *   PEOPLES  independent founders     (default 2 — one people makes a family, not rivals)
 *   MAP      map edge in tiles        (default 96)
 *   SEED     world seed               (default 20260802)
 */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';

const YEARS = Number(process.env.YEARS ?? 80);
const PEOPLES = Number(process.env.PEOPLES ?? 2);
const MAP = Number(process.env.MAP ?? 96);
const SEED = Number(process.env.SEED ?? 20260802);

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

let warYears = 0, peakSoldierShare = 0;

console.log(`${PEOPLES} povo(s), ${YEARS} anos, mapa ${MAP}, seed ${SEED}\n`);
console.log('ano  pop cid rei | sold  %pop prof mil | travadas famintas comida/hab | exerc  maior | ouro | era      | guerras');
for (let y = 1; y <= YEARS; y++) {
  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(tileMap, particles);
  if (sim.diplomacy.activeWars.size > 0) warYears++;
  if (y % 10 !== 0 && y !== YEARS) continue;

  const humans = sim.entities.filter(e => e.hp > 0 && e.cityId);
  const soldiers = humans.filter(e => e.profession === 'soldier');
  const professionals = soldiers.filter(e => e.workplaceId).length;

  // The levy's own food gate, evaluated exactly as musterArmies evaluates it.
  let gated = 0, hungry = 0, foodPerHead = 0, cities = 0;
  for (const c of sim.cities.values()) {
    if (c.population <= 0) continue;
    cities++;
    const food = c.stock.get('food');
    foodPerHead += food / c.population;
    if (food < c.population * 0.8) gated++;      // no pool at all unless 1.5x
    if (food < c.population * 0.5) hungry++;
  }

  const armies = [...sim.kingdoms.values()].flatMap(k => sim.warfare.getArmiesForKingdom(k.id));
  const biggest = armies.reduce((m, a: any) => Math.max(m, a.soldierIds?.size ?? a.strength ?? 0), 0);
  const gold = [...sim.kingdoms.values()].reduce((t, k) => t + k.gold, 0);
  const eras = new Map<string, number>();
  for (const k of sim.kingdoms.values()) eras.set(k.research.era, (eras.get(k.research.era) ?? 0) + 1);
  const eraStr = [...eras.entries()].map(([e, n]) => `${e.slice(0, 4)}:${n}`).join(' ');

  const share = humans.length ? soldiers.length / humans.length : 0;
  peakSoldierShare = Math.max(peakSoldierShare, share);

  console.log(
    `${String(y).padStart(3)} ${String(humans.length).padStart(4)} ${String(cities).padStart(3)} ${String(sim.kingdoms.size).padStart(3)} |` +
    ` ${String(soldiers.length).padStart(4)} ${(share * 100).toFixed(0).padStart(4)}% ${String(professionals).padStart(4)} ${String(soldiers.length - professionals).padStart(3)} |` +
    ` ${String(`${gated}/${cities}`).padStart(8)} ${String(`${hungry}/${cities}`).padStart(8)} ${(cities ? foodPerHead / cities : 0).toFixed(1).padStart(11)} |` +
    ` ${String(armies.length).padStart(5)} ${String(biggest).padStart(6)} | ${String(Math.round(gold)).padStart(4)} | ${eraStr.padEnd(8)} | ${sim.diplomacy.activeWars.size}`
  );
}

console.log(`\nanos em guerra: ${warYears}/${YEARS} · guerras no historico: ${sim.diplomacy.warHistory.length}`);
console.log(`pico de soldados: ${(peakSoldierShare * 100).toFixed(1)}% da populacao`);
console.log('\ncolunas: travadas = cidades sob o portao de comida do alistamento (food < pop*0.8)');
console.log('         famintas = cidades com menos de meia racao no celeiro');
