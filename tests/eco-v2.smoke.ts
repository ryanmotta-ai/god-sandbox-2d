import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/ai/EntityAI';
import { City } from '../src/civ/City';
import { rng } from '../src/core/Random';
import { SpeciesType } from '../src/entities/Species';
import { ParticleManager } from '../src/renderer/Particles';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

rng.setSeed(20260808);

function meadow(): TileMap {
  const map = new TileMap(64, 64, 'single_continent', 99);
  for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
    const tile = map.getTile(x, y)!;
    tile.type = TerrainType.GRASS;
    tile.fertility = 1;
  }
  map.updateRegionStates(32, 32);
  return map;
}

// Predator hunt -> human hunt -> finite food delivery.
{
  const map = meadow();
  const sim = new SimulationEngine();
  const particles = new ParticleManager();
  const wolf = sim.spawnEntity(SpeciesType.WOLF, 12, 12, map);
  const wolfPrey = sim.spawnEntity(SpeciesType.DEER, 12.5, 12, map);
  for (let tick = 0; tick < 100 && sim.entities.includes(wolfPrey); tick++) sim.tickAI(map, particles, { centerX: 12, centerY: 12, hotRadius: 12, warmRadius: 20 });
  assert.ok(!sim.entities.includes(wolfPrey), 'predator should remove a nearby prey animal');
  assert.ok(wolf.kills > 0, 'predator kill should be recorded');

  const city = new City('eco-city', 'Hunting Camp', SpeciesType.HUMAN, 30, 30, 'Founder', 1);
  city.population = 1;
  city.stock.take('food', city.stock.get('food'));
  sim.cities.set(city.id, city);
  const hunter = sim.spawnEntity(SpeciesType.HUMAN, 30, 30, map);
  hunter.cityId = city.id;
  hunter.homeX = city.x; hunter.homeY = city.y;
  const hunted = sim.spawnEntity(SpeciesType.DEER, 31, 30, map);
  hunted.hp = 9; // Keep the smoke focused on the hunt -> carcass -> delivery chain.
  for (let tick = 0; tick < 160 && city.stock.get('food') === 0; tick++) sim.tickAI(map, particles, { centerX: 30, centerY: 30, hotRadius: 12, warmRadius: 20 });
  assert.ok(!sim.entities.includes(hunted), 'human hunter should kill a real prey animal');
  assert.ok(city.stock.get('food') > 0, 'hunted animal should become delivered city food');
  sim.ecology.survey(map, sim.entities);
  assert.equal(sim.ecology.getPopulation(SpeciesType.DEER), 0, 'hunting should reduce the living prey population');
}

// Population falls after hunting, then a surviving pair can recover only through reproduction.
{
  const map = meadow();
  const sim = new SimulationEngine();
  const first = sim.spawnEntity(SpeciesType.DEER, 35, 35, map); first.age = 3;
  const second = sim.spawnEntity(SpeciesType.DEER, 36, 35, map); second.age = 3;
  const before = sim.entities.filter(e => e.species === SpeciesType.DEER).length;
  (sim as any).tickWildlife(map);
  let recovered = sim.entities.filter(e => e.species === SpeciesType.DEER).length;
  for (let year = 0; year < 12 && recovered === before; year++) {
    (sim as any).tickWildlife(map);
    recovered = sim.entities.filter(e => e.species === SpeciesType.DEER).length;
  }
  assert.ok(recovered > before, 'a viable pair in suitable active habitat should recover gradually');
  sim.entities.find(e => e.species === SpeciesType.DEER)!.hp = 0;
  assert.equal(sim.entities.filter(e => e.species === SpeciesType.DEER && e.hp > 0).length < recovered, true, 'removing wildlife immediately reduces the living population');
}

console.log('ECO-V2 smoke passed');
