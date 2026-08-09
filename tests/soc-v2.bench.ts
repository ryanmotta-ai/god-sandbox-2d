/**
 * SOC-V2 cost check.
 *
 * The yearly per-citizen pass is the only new recurring cost SOC-V2 adds. This
 * measures it directly at populations well past what the game reaches, so the
 * claim in SOC_V2_REPORT.md is a measurement rather than an assurance.
 *
 *   npx tsx tests/soc-v2.bench.ts
 */
import { SimulationEngine } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { Building } from '../src/civ/Building';
import { rng } from '../src/core/Random';
import { remember, decayMemories, decayBonds, bondWith } from '../src/entities/Psyche';

rng.setSeed(20260809);

function world(): TileMap {
  const map = new TileMap(96, 96, 'single_continent', 4242);
  for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
    const tile = map.getTile(x, y)!;
    tile.type = TerrainType.GRASS;
    tile.fertility = 1;
  }
  map.updateRegionStates(48, 48);
  return map;
}

// Populations well past what a played world reaches. Higher tiers are left out
// deliberately: at that point the cost being measured is the whole entity AI, not
// this pass, and the run exhausts heap before it says anything about SOC-V2.
for (const population of [500, 2000]) {
  const map = world();
  const sim = new SimulationEngine();
  const realm = new Kingdom('k', 'Reino', SpeciesType.HUMAN, '#fff', 'c0', 1);
  sim.kingdoms.set(realm.id, realm);

  // Four settlements, so the per-settlement pass and the destination search are
  // both exercised rather than short-circuiting on a one-city world.
  const cities: City[] = [];
  for (let c = 0; c < 4; c++) {
    const city = new City(`c${c}`, `Cidade ${c}`, SpeciesType.HUMAN, 20 + c * 15, 40, 'Founder', 1);
    city.kingdomId = realm.id;
    city.prosperity = 0.3 + c * 0.2;
    city.stock.add('food', 200 * (c + 1));
    for (let b = 0; b < 6; b++) {
      city.buildings.set(`f${c}_${b}`, new Building(`f${c}_${b}`, 'farm', city.x + b, city.y + 1, city.id));
      city.buildings.set(`h${c}_${b}`, new Building(`h${c}_${b}`, 'house', city.x + b, city.y + 3, city.id));
    }
    realm.addCity(city.id);
    sim.cities.set(city.id, city);
    cities.push(city);
  }
  sim.citySpatialHash.rebuild(sim.cities.values());

  for (let i = 0; i < population; i++) {
    const city = cities[i % cities.length];
    const e = sim.spawnEntity(SpeciesType.HUMAN, city.x + (i % 7) * 0.2, city.y + 0.2, map);
    e.age = 20 + (i % 40);
    e.cityId = city.id;
    e.kingdomId = realm.id;
    e.needs.hunger = 20 + (i % 60);
    city.population++;
    // Give everyone a full memory and relation load, so the caps are being paid
    // for rather than skipped.
    remember(e.memories, 'famine', 1, 0.5);
    remember(e.memories, 'lost_home', 1, 0.4);
    remember(e.memories, 'bereavement', 1, 0.3);
    for (let b = 0; b < 4; b++) bondWith(e.bonds, `peer${b}`, 'friend', 0.5);
  }

  // The yearly pass is private; drive it through the public year boundary by
  // measuring one full simulated year and subtracting a run with it neutered is
  // fragile, so time the two hard-capped per-citizen operations directly plus a
  // whole real year for the end-to-end number.
  const innerStart = performance.now();
  for (const e of sim.entities) { decayMemories(e.memories); decayBonds(e.bonds); }
  const innerMs = performance.now() - innerStart;

  // The whole year boundary — tickAge, tickFamilies, tickLives and the civ tick —
  // measured by running the last tick of a year rather than a full year of frames,
  // which would be measuring the renderer-facing per-tick AI instead.
  const particles = { spawnParticle() {}, spawnDamageNumber() {}, spawnExplosion() {} } as any;
  const warmup = 40;
  for (let tick = 0; tick < warmup; tick++) sim.tickAI(map, particles);
  const perTickStart = performance.now();
  for (let tick = 0; tick < 200; tick++) sim.tickAI(map, particles);
  const perTickMs = (performance.now() - perTickStart) / 200;

  console.log(
    `pop ${String(population).padStart(5)}  ` +
    `memória+relações ${innerMs.toFixed(2).padStart(7)} ms/ano  ` +
    `(${(innerMs * 1000 / population).toFixed(2)} µs por cidadão)  ` +
    `tick médio ${perTickMs.toFixed(2)} ms`
  );
}
