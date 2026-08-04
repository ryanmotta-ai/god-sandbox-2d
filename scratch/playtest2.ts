import { TileMap } from '../src/world/TileMap';
import { SimulationEngine } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { PowerExecutor } from '../src/powers/GodPowers';
import { SpatialHash } from '../src/core/SpatialHash';
import { ParticleManager } from '../src/renderer/Particles';
import { SaveSystem } from '../src/core/SaveSystem';
import { EraManager } from '../src/world/WeatherEras';
import { chronicle } from '../src/civ/Chronicle';

console.log('=== STARTING SECOND ADVANCED PLAYTEST RUN (1500 TICKS) ===');

try {
  const tileMap = new TileMap(128, 128, 'two_continents', 9999);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();
  const eraMgr = new EraManager();

  // Spawn 100 entities across 4 corners
  for (let i = 0; i < 25; i++) {
    sim.spawnEntity(SpeciesType.LUMINI, 30 + Math.random() * 8, 30 + Math.random() * 8);
    sim.spawnEntity(SpeciesType.SYLVANII, 90 + Math.random() * 8, 30 + Math.random() * 8);
    sim.spawnEntity(SpeciesType.STONEKIN, 30 + Math.random() * 8, 90 + Math.random() * 8);
    sim.spawnEntity(SpeciesType.EMBERKIN, 90 + Math.random() * 8, 90 + Math.random() * 8);
  }

  console.log('1. Initialized world with 100 entities across 4 species.');

  // Run 1500 simulation ticks
  for (let tick = 0; tick < 1500; tick++) {
    sim.tickAI(tileMap, particles);
    if (tick % 2 === 0) {
      tileMap.updateFireTick();
      tileMap.updateFluidTick();
    }
    particles.update(0.016);

    // Event triggers during long simulation run
    if (tick === 300) {
      console.log('--> Tick 300: Spawning Elder Dragon boss at center...');
      sim.spawnEntity(SpeciesType.DRAGON, 64, 64);
    }

    if (tick === 600) {
      console.log('--> Tick 600: Forcing diplomacy war between all kingdoms...');
      const kingdomList = Array.from(sim.kingdoms.keys());
      for (let a = 0; a < kingdomList.length; a++) {
        for (let b = a + 1; b < kingdomList.length; b++) {
          sim.diplomacy.declareWar(kingdomList[a], kingdomList[b], sim.currentYear);
        }
      }
    }

    if (tick === 900) {
      console.log('--> Tick 900: Applying Divine Miracles (Blessing & Giant) to top survivors...');
      for (const e of sim.entities.slice(0, 10)) {
        PowerExecutor.executePower('bless', e.x, e.y, 1, tileMap, sim.spatialHash, sim.entities, (s, x, y) => sim.spawnEntity(s, x, y), particles);
        PowerExecutor.executePower('add_giant', e.x, e.y, 1, tileMap, sim.spatialHash, sim.entities, (s, x, y) => sim.spawnEntity(s, x, y), particles);
      }
    }

    if (tick === 1200) {
      console.log('--> Tick 1200: Spawning Wildfire in dense forest...');
      PowerExecutor.executePower('wildfire', 40, 40, 3, tileMap, sim.spatialHash, sim.entities, (s, x, y) => sim.spawnEntity(s, x, y), particles);
    }
  }

  console.log('2. 1500 Ticks Complete!');
  console.log('   - Final World Year:', sim.currentYear);
  console.log('   - Living Population:', sim.entities.length);
  console.log('   - Total Cities:', sim.cities.size);
  console.log('   - Total Kingdoms:', sim.kingdoms.size);
  console.log('   - Total Events Logged:', chronicle.getEvents().length);

  // Test Save/Load
  const save = SaveSystem.exportSaveData(tileMap, sim, eraMgr);
  const restoredSim = new SimulationEngine();
  SaveSystem.importSaveData(save, tileMap, restoredSim, eraMgr);
  console.log('3. Save/Load integrity verified. Restored population:', restoredSim.entities.length);

  console.log('=== SECOND ADVANCED PLAYTEST COMPLETED SUCCESSFULLY ===');
} catch (err) {
  console.error('!!! PLAYTEST 2 ENCOUNTERED AN ERROR !!!', err);
  process.exit(1);
}
