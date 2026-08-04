import { TileMap } from '../src/world/TileMap';
import { TERRAINS } from '../src/world/Biomes';

const maps: Array<[string, Array<[number, number]>]> = [
  ['archipelago', [[25, 25], [75, 25], [25, 75], [75, 75]]],
  ['continents', [[25, 25], [75, 25], [25, 75], [75, 75]]],
  ['single_continent', [[25, 25], [75, 25], [25, 75], [75, 75]]],
];

for (const [preset, cities] of maps) {
  const tm = new TileMap(100, 100, preset);
  console.log(`\n=== ${preset} ===`);
  for (const [cx, cy] of cities) {
    const counts: Record<string, number> = {};
    for (let x = Math.max(0, cx - 10); x <= Math.min(99, cx + 10); x++) {
      for (let y = Math.max(0, cy - 10); y <= Math.min(99, cy + 10); y++) {
        const t = tm.getTile(x, y)!;
        if (t.resourceType) counts[t.resourceType] = (counts[t.resourceType] ?? 0) + 1;
      }
    }
    console.log(`city@(${cx},${cy}): ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ') || 'NO RESOURCES'}`);
  }
}
