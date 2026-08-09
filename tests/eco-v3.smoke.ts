import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

function grassWorld(): TileMap {
  const map = new TileMap(64, 64, 'single_continent', 2048);
  for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
    const tile = map.getTile(x, y)!;
    tile.type = TerrainType.GRASS;
    tile.fertility = 1;
  }
  map.updateRegionStates(32, 32);
  return map;
}

// Excess herbivores consume vegetation, then receive food stress/deaths.
{
  const map = grassWorld();
  const sim = new SimulationEngine();
  for (let i = 0; i < 18; i++) sim.spawnEntity(SpeciesType.DEER, 6 + (i % 4), 6 + Math.floor(i / 4), map).age = 3;
  sim.ecology.advanceYear(map, sim.entities);
  const afterGrazing = sim.ecology.vegetationAt(7, 7, map);
  const collapse = sim.ecology.advanceYear(map, sim.entities);
  assert.ok(afterGrazing < .8, 'too many herbivores should visibly reduce regional vegetation');
  assert.ok(collapse.deaths.length > 0, 'food stress should kill animals once the herd exceeds plant capacity');
}

// Changing one trophic level changes the reproduction pressure on another.
{
  const map = grassWorld();
  const sim = new SimulationEngine();
  for (let i = 0; i < 8; i++) sim.spawnEntity(SpeciesType.DEER, 40 + (i % 3), 40 + Math.floor(i / 3), map).age = 3;
  const wolves = [
    sim.spawnEntity(SpeciesType.WOLF, 42, 42, map),
    sim.spawnEntity(SpeciesType.WOLF, 43, 42, map)
  ];
  sim.ecology.advanceYear(map, sim.entities);
  const withPredators = sim.ecology.birthChance(SpeciesType.DEER);
  for (const wolf of wolves) wolf.hp = 0;
  sim.ecology.advanceYear(map, sim.entities);
  const withoutPredators = sim.ecology.birthChance(SpeciesType.DEER);
  assert.ok(withoutPredators > withPredators, 'removing predators should raise herbivore reproduction pressure');
}

// A disturbed chunk exports herbivores to an adjacent recovering habitat.
{
  const map = grassWorld();
  for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) map.getTile(x, y)!.buildingId = 'abandoned-footprint';
  const sim = new SimulationEngine();
  const deer = sim.spawnEntity(SpeciesType.DEER, 10, 10, map);
  sim.spawnEntity(SpeciesType.DEER, 11, 10, map);
  sim.ecology.advanceYear(map, sim.entities);
  assert.ok(deer.x >= 32 || deer.y >= 32, 'animals should migrate out of unsuitable human-disturbed habitat');
}

console.log('ECO-V3 smoke passed');
