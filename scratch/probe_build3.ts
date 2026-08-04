import { SimulationEngine } from '../src/ai/EntityAI';
import { TileMap } from '../src/world/TileMap';
import { ParticleManager } from '../src/renderer/Particles';

const tileMap = new TileMap(100, 100, 'archipelago');
const sim = new SimulationEngine();
const particles = new ParticleManager();

sim.spawnEntity('lumini' as any, 25, 25, tileMap);
sim.spawnEntity('lumini' as any, 26, 25, tileMap);
sim.spawnEntity('lumini' as any, 25, 26, tileMap);

sim.spawnEntity('sylvanii' as any, 75, 25, tileMap);
sim.spawnEntity('sylvanii' as any, 76, 25, tileMap);
sim.spawnEntity('sylvanii' as any, 75, 26, tileMap);

sim.spawnEntity('stonekin' as any, 25, 75, tileMap);
sim.spawnEntity('stonekin' as any, 26, 75, tileMap);

sim.spawnEntity('emberkin' as any, 75, 75, tileMap);
sim.spawnEntity('emberkin' as any, 76, 75, tileMap);

const TICKS = 500000; // ~70 years
for (let tick = 1; tick <= TICKS; tick++) {
  sim.tickAI(tileMap, particles);
}

console.log('Year:', sim.currentYear);
for (const kingdom of sim.kingdoms.values()) {
  const techs = [...kingdom.research.known];
  console.log(`\nKingdom ${kingdom.name} (${kingdom.species}): techs=${techs.join(', ') || 'NONE'}`);
}
for (const city of sim.cities.values()) {
  const buildings = [...city.buildings.values()];
  const types: Record<string, number> = {};
  for (const b of buildings) types[b.type] = (types[b.type] ?? 0) + 1;
  console.log(`\nCity ${city.name}: pop=${city.population} tier=${city.tier} prosperity=${city.prosperity.toFixed(2)}`);
  console.log(`  Buildings: ${Object.entries(types).map(([t, n]) => `${t}x${n}`).join(', ')}`);
  console.log(`  housingCapacity=${city.housingCapacity()} slots=${city.buildingSlots} used=${city.buildings.size}`);
  console.log(`  food=${city.stock.get('food').toFixed(0)} wood=${city.stock.get('wood').toFixed(0)} stone=${city.stock.get('stone').toFixed(0)}`);
}
