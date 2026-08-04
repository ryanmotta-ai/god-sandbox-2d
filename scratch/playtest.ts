import { TileMap } from '../src/world/TileMap';
import { SimulationEngine } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { PowerExecutor } from '../src/powers/GodPowers';
import { SpatialHash } from '../src/core/SpatialHash';
import { ParticleManager } from '../src/renderer/Particles';
import { SaveSystem } from '../src/core/SaveSystem';
import { EraManager } from '../src/world/WeatherEras';
import { chronicle } from '../src/civ/Chronicle';

console.log('=== STARTING AUTOMATED PLAYTEST RUN ===');

try {
  const tileMap = new TileMap(128, 128, 'single_continent', 12345);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();
  const eraMgr = new EraManager();

  console.log('1. World Generated successfully. Tiles:', tileMap.width * tileMap.height);

  // Spawn initial populations
  console.log('2. Spawning 20 Lumini, 20 Sylvanii, 20 Stonekin, 20 Emberkin...');
  for (let i = 0; i < 20; i++) {
    sim.spawnEntity(SpeciesType.LUMINI, 40 + Math.random() * 10, 64 + Math.random() * 10);
    sim.spawnEntity(SpeciesType.SYLVANII, 80 + Math.random() * 10, 64 + Math.random() * 10);
    sim.spawnEntity(SpeciesType.STONEKIN, 64 + Math.random() * 10, 40 + Math.random() * 10);
    sim.spawnEntity(SpeciesType.EMBERKIN, 64 + Math.random() * 10, 80 + Math.random() * 10);
  }

  console.log('Total entities spawned:', sim.entities.length);

  // Run 500 simulation ticks
  console.log('3. Simulating 500 ticks...');
  for (let tick = 0; tick < 500; tick++) {
    sim.tickAI(tileMap, particles);
    if (tick % 5 === 0) tileMap.updateFireTick();
    particles.update(0.016);

    // Mid-playtest god power interference
    if (tick === 100) {
      console.log('--> Triggering Meteor Strike at center (64, 64)...');
      PowerExecutor.executePower('meteorite', 64, 64, 5, tileMap, sim.spatialHash, sim.entities, (s, x, y) => sim.spawnEntity(s, x, y), particles);
    }
    if (tick === 200) {
      console.log('--> Triggering Lightning strike and Rain...');
      PowerExecutor.executePower('lightning', 45, 65, 3, tileMap, sim.spatialHash, sim.entities, (s, x, y) => sim.spawnEntity(s, x, y), particles);
      PowerExecutor.executePower('rain', 45, 65, 5, tileMap, sim.spatialHash, sim.entities, (s, x, y) => sim.spawnEntity(s, x, y), particles);
    }
    if (tick === 300) {
      console.log('--> Triggering Plague at (85, 65)...');
      PowerExecutor.executePower('plague', 85, 65, 4, tileMap, sim.spatialHash, sim.entities, (s, x, y) => sim.spawnEntity(s, x, y), particles);
    }
  }

  console.log('4. Post-simulation stats:');
  console.log('   - Remaining Entities:', sim.entities.length);
  console.log('   - Cities Founded:', sim.cities.size);
  console.log('   - Kingdoms Formed:', sim.kingdoms.size);
  console.log('   - Chronicle Events:', chronicle.getEvents().length);

  // Test Save and Load serialization
  console.log('5. Testing Save & Load Serialization...');
  const saveData = SaveSystem.exportSaveData(tileMap, sim, eraMgr);
  const jsonStr = JSON.stringify(saveData);
  console.log('   - Exported Save Size:', (jsonStr.length / 1024).toFixed(2), 'KB');

  const restoredTileMap = new TileMap(128, 128, 'random');
  const restoredSim = new SimulationEngine();
  const restoredEraMgr = new EraManager();
  SaveSystem.importSaveData(JSON.parse(jsonStr), restoredTileMap, restoredSim, restoredEraMgr);

  console.log('   - Restored Entities:', restoredSim.entities.length);
  console.log('   - Restored Cities:', restoredSim.cities.size);
  console.log('   - Restored Kingdoms:', restoredSim.kingdoms.size);

  console.log('=== AUTOMATED PLAYTEST COMPLETED SUCCESSFULLY ===');
} catch (err) {
  console.error('!!! PLAYTEST ENCOUNTERED AN ERROR !!!', err);
  process.exit(1);
}
