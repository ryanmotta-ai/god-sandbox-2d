/** Why do starting realms die out? Isolates predation from everything else. */
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { TileMap } from '../src/world/TileMap';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType, SPECIES_DEFINITIONS } from '../src/entities/Species';
import { RandomService } from '../src/core/Random';

const YEARS = 10;
const SIZE = 96;

function run(label: string, wildlife: boolean, seed: number): void {
  const map = new TileMap(SIZE, SIZE, 'single_continent', seed);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();

  const species = [SpeciesType.LUMINI, SpeciesType.SYLVANII, SpeciesType.STONEKIN];
  const spots = [{ x: 24, y: 24 }, { x: 72, y: 24 }, { x: 24, y: 72 }];
  species.forEach((sp, i) => {
    for (let k = 0; k < 6; k++) {
      const e = sim.spawnEntity(sp, spots[i].x + (k % 3), spots[i].y + Math.floor(k / 3), map, k % 2 === 0 ? 'male' : 'female');
      e.dynasty = `House${i}`;
    }
  });

  if (wildlife) {
    const fauna = [SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER,
      SpeciesType.DEER, SpeciesType.BOAR, SpeciesType.BOAR, SpeciesType.EAGLE,
      SpeciesType.WOLF, SpeciesType.BEAR];
    const count = Math.round((SIZE * SIZE) / 700);
    // Seeded placement: balance numbers are worthless if two runs of the same
    // seed put the wolves somewhere else.
    const place = new RandomService(seed ^ 0x9e3779b9);
    for (let i = 0; i < count; i++) {
      sim.spawnEntity(fauna[i % fauna.length], place.rangeInt(2, SIZE - 3), place.rangeInt(2, SIZE - 3), map);
    }
  }
  sim.totalBirths = 0;
  sim.totalDeaths = 0;

  const isHum = (s: SpeciesType) => SPECIES_DEFINITIONS[s].isHumanoid;
  const startHum = sim.entities.filter(e => isHum(e.species)).length;

  const perYear: string[] = [];
  for (let y = 0; y < YEARS; y++) {
    for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(map, particles);
    const hum = sim.entities.filter(e => isHum(e.species)).length;
    const wild = sim.entities.length - hum;
    perYear.push(`y${sim.currentYear}:${hum}/${wild}`);
  }

  const hum = sim.entities.filter(e => isHum(e.species));
  const bySpecies: Record<string, number> = {};
  for (const e of hum) bySpecies[e.species] = (bySpecies[e.species] ?? 0) + 1;

  console.log(`\n--- ${label} (seed ${seed}) ---`);
  console.log(`  humanoids ${startHum} -> ${hum.length}   kingdoms=${sim.kingdoms.size} cities=${sim.cities.size}`);
  console.log(`  births=${sim.totalBirths} deaths=${sim.totalDeaths}`);
  console.log(`  surviving species: ${JSON.stringify(bySpecies)}`);
  console.log(`  humanoid/wild per year: ${perYear.join(' ')}`);
}

for (const seed of [31337, 777]) {
  run('WITH wildlife', true, seed);
  run('WITHOUT wildlife', false, seed);
}
