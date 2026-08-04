/**
 * Headless simulation micro-benchmark.
 *
 * Spawns a populated world and times raw `tickAI` throughput. Use it to measure
 * before/after performance of the simulation loop without UI or rendering noise.
 */
import { SimulationEngine } from '../src/ai/EntityAI';
import { TileMap } from '../src/world/TileMap';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType } from '../src/entities/Species';

const SIZE = Number(process.env.SIZE ?? 128);
const SEED = Number(process.env.SEED ?? 777);
const WARMUP_TICKS = Number(process.env.WARMUP ?? 2000);
const MEASURE_TICKS = Number(process.env.TICKS ?? 4000);
/** Also run the full-map fire/fluid pass every 2 ticks + diplomacy every 10, like main.ts does. */
const WITH_FULL_LOOP = process.env.FULL === '1';

const tileMap = new TileMap(SIZE, SIZE, 'single_continent', SEED);
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

const snapshot = () => ({
  ents: sim.entities.length,
  cities: sim.cities.size,
  kingdoms: sim.kingdoms.size,
  households: sim.households.size,
  ships: sim.naval.activeShips.size,
  caravans: sim.caravans.activeCaravans.size,
  year: sim.currentYear
});

for (let t = 0; t < WARMUP_TICKS; t++) {
  sim.tickAI(tileMap, particles);
  if (WITH_FULL_LOOP) {
    if (t % 2 === 0) {
      tileMap.updateFireTick();
      tileMap.updateFluidTick();
    }
    if (t % 10 === 0 && sim.kingdoms.size > 1) sim.diplomacy.tickDiplomacy([...sim.kingdoms.keys()], sim.currentYear);
  }
}

const before = snapshot();
const t0 = process.hrtime.bigint();
for (let t = 0; t < MEASURE_TICKS; t++) {
  sim.tickAI(tileMap, particles);
  if (WITH_FULL_LOOP) {
    if (t % 2 === 0) {
      tileMap.updateFireTick();
      tileMap.updateFluidTick();
    }
    if (t % 10 === 0 && sim.kingdoms.size > 1) sim.diplomacy.tickDiplomacy([...sim.kingdoms.keys()], sim.currentYear);
  }
}
const t1 = process.hrtime.bigint();
const after = snapshot();

const elapsedMs = Number(t1 - t0) / 1e6;
const ticksPerSec = (MEASURE_TICKS / elapsedMs) * 1000;
const msPerTick = elapsedMs / MEASURE_TICKS;

console.log('=== SIM BENCHMARK ===');
console.log(`world=${SIZE}x${SIZE} warmup=${WARMUP_TICKS} measured=${MEASURE_TICKS}`);
console.log(`before: ${JSON.stringify(before)}`);
console.log(`after:  ${JSON.stringify(after)}`);
console.log(`elapsed=${elapsedMs.toFixed(1)}ms  msPerTick=${msPerTick.toFixed(3)}  ticksPerSec=${ticksPerSec.toFixed(1)}`);

// Isolate per-pass costs by timing each subsystem separately.
const iso = (label: string, fn: () => void) => {
  for (let i = 0; i < 5; i++) fn();
  const t2 = process.hrtime.bigint();
  const N = 300;
  for (let i = 0; i < N; i++) fn();
  const t3 = process.hrtime.bigint();
  const per = Number(t3 - t2) / 1e6 / N;
  console.log(`iso  ${label.padEnd(22)} ${per.toFixed(4)} ms/call`);
};
iso('updateFireTick', () => tileMap.updateFireTick());
iso('updateFluidTick', () => tileMap.updateFluidTick());
iso('tickAI (no sub)', () => sim.tickAI(tileMap, particles));

