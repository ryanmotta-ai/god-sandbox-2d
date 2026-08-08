/** Perf probe: how fast does the real tickAI run headless? */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType } from '../src/entities/Species';
import { generateDynastyName } from '../src/civ/Lineage';
import { rng } from '../src/core/Random';

rng.setSeed(12345);

const tileMap = new TileMap(96, 96, 'single_continent', 20260802);
const sim = new SimulationEngine();
const particles = new ParticleManager();

// Humans are the only civilised species left; the probe wants the expensive one.
const species = [SpeciesType.HUMAN];
const spawnPoints = species.map(() => {
  for (let i = 0; i < 400; i++) {
    const x = rng.rangeInt(2, tileMap.width - 3);
    const y = rng.rangeInt(2, tileMap.height - 3);
    const t = tileMap.getTile(x, y);
    if (t && !t.type.includes('ocean') && t.type !== 'mountain' && t.type !== 'lava') return { x, y };
  }
  return { x: 48, y: 48 };
});

species.forEach((sp, index) => {
  const point = spawnPoints[index] ?? spawnPoints[0];
  const dynasty = generateDynastyName(sp);
  for (let i = 0; i < 6; i++) {
    const e = sim.spawnEntity(sp, point.x + rng.range(-2, 2), point.y + rng.range(-2, 2), tileMap, i % 2 === 0 ? 'male' : 'female');
    e.dynasty = dynasty;
  }
});
const fauna = [SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.BOAR, SpeciesType.BOAR, SpeciesType.EAGLE, SpeciesType.WOLF, SpeciesType.BEAR];
const wildCount = Math.round((tileMap.width * tileMap.height) / 700);
for (let i = 0; i < wildCount; i++) {
  const x = rng.rangeInt(2, tileMap.width - 3);
  const y = rng.rangeInt(2, tileMap.height - 3);
  sim.spawnEntity(fauna[rng.rangeInt(0, fauna.length - 1)], x, y, tileMap);
}

const start = Date.now();
// Mirrors main.ts's updateSimulation. The terrain sweeps used to be missing
// here, which is why this probe read clean while they were the most expensive
// thing in the game — a probe that skips half the tick measures half the game.
for (let y = 0; y < 1; y++) {
  for (let t = 0; t < TICKS_PER_YEAR; t++) {
    sim.tickAI(tileMap, particles);
    if (t % 2 === 0) {
      tileMap.updateFireTick();
      tileMap.updateFluidTick();
    }
    if (t % 10 === 0 && sim.kingdoms.size > 1) {
      sim.diplomacy.tickDiplomacy([...sim.kingdoms.keys()], sim.currentYear);
    }
  }
}
const elapsed = Date.now() - start;
console.log(`1 year (${TICKS_PER_YEAR} ticks) took ${elapsed}ms; entities=${sim.entities.length}, cities=${sim.cities.size}, kingdoms=${sim.kingdoms.size}`);
console.log(`projected: 60 years ≈ ${Math.round((elapsed * 60) / 1000)}s, 120 years ≈ ${Math.round((elapsed * 120) / 1000)}s`);
