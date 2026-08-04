// Test findPortWaterTile with flood fill
import { City } from '../src/civ/City';
import { BUILDINGS } from '../src/civ/Building';
import { TileMap } from '../src/world/TileMap';
import { NavalSystem } from '../src/civ/NavalSystem';
import { TERRAINS } from '../src/world/Biomes';

const maps = ['archipelago', 'continents', 'single_continent', 'two_continents', 'ring_atoll'] as const;

for (const preset of maps) {
  const tm = new TileMap(120, 120, preset);

  // Find coastal for many spots
  let ok = 0;
  for (let ox = 10; ox < 110; ox += 30) {
    for (let oy = 10; oy < 110; oy += 30) {
      for (let dx = -15; dx <= 15; dx++) {
        for (let dy = -15; dy <= 15; dy++) {
          const t = tm.getTile(ox + dx, oy + dy);
          if (!t || TERRAINS[t.type].isWater) continue;
          const nbs = tm.getNeighbors(t.x, t.y, true);
          if (!nbs.some(n => TERRAINS[n.type].isWater)) continue;
          // simulate city on tile with harbor
          const c = new City('test', 'TC', 'lumini' as any, t.x, t.y, 'test', 1);
          c.addBuilding('harbor', t.x, t.y);
          const waterTile = NavalSystem.prototype.findPortWaterTile.call(navalInstance, c, tm);
          if (waterTile) {
            // flood fill size via internal code (duplicate check)
            // Build water body size analyser
            const visited = new Set<string>();
            const sx = Math.floor(waterTile.x), sy = Math.floor(waterTile.y);
            const queue: [number, number][] = [[sx, sy]];
            visited.add(`${sx},${sy}`);
            let count = 0;
            while (queue.length > 0 && count < 10000) {
              const [cx, cy] = queue.shift()!;
              const tt = tm.getTile(cx, cy);
              if (!tt || !TERRAINS[tt.type].isWater) continue;
              count++;
              for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nx = cx + ddx, ny = cy + ddy, k = `${nx},${ny}`;
                if (visited.has(k)) continue;
                const nt = tm.getTile(nx, ny);
                if (nt && TERRAINS[nt.type].isWater) {
                  visited.add(k);
                  queue.push([nx, ny]);
                }
              }
            }
            ok++;
            if (count < 10) console.log(`  SMALL POCKET preset=${preset} tile=(${sx},${sy}) count=${count}`);
          }
          break; // One coastal per ox,oy block
        }
      }
    }
  }
  console.log(`${preset}: tested OK=${ok}`);
}

// needed because findPortWaterTile is a method
const navalInstance = new NavalSystem();