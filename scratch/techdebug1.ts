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

const TICKS = 150000; // ~20 years
for (let tick = 1; tick <= TICKS; tick++) {
  sim.tickAI(tileMap, particles);
}
console.log('Year:', sim.currentYear);
