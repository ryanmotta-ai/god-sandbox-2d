/** Terrain + deposit distribution across several presets and seeds. */
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { GoodId } from '../src/civ/Goods';

const PRESETS = ['single_continent', 'archipelago', 'two_continents', 'ring_atoll', 'frozen', 'desert'];
const SEEDS = [12345, 777, 2024, 99];
const SIZE = 100;

for (const preset of PRESETS) {
  const terrainAgg: Record<string, number> = {};
  const depositAgg: Partial<Record<GoodId, number>> = {};
  let heightBuckets = { lt61: 0, gte61: 0, gte70: 0, gte78: 0 };

  for (const seed of SEEDS) {
    let map: TileMap;
    try {
      map = new TileMap(SIZE, SIZE, preset as any, seed);
    } catch (e) {
      console.log(`preset ${preset} failed: ${(e as Error).message}`);
      break;
    }
    for (let x = 0; x < map.width; x++) {
      for (let y = 0; y < map.height; y++) {
        const t = map.getTile(x, y)!;
        terrainAgg[t.type] = (terrainAgg[t.type] ?? 0) + 1;
        if (t.resourceType) depositAgg[t.resourceType] = (depositAgg[t.resourceType] ?? 0) + 1;
        if (t.height >= 0.78) heightBuckets.gte78++;
        else if (t.height >= 0.7) heightBuckets.gte70++;
        else if (t.height >= 0.61) heightBuckets.gte61++;
        else heightBuckets.lt61++;
      }
    }
  }

  const total = SIZE * SIZE * SEEDS.length;
  console.log(`\n=== PRESET: ${preset} (${SEEDS.length} seeds, ${total} tiles) ===`);
  console.log('  terrain:');
  Object.entries(terrainAgg)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`    ${k.padEnd(16)} ${String(v).padStart(7)}  ${((v / total) * 100).toFixed(2)}%`));
  console.log(`  height: <0.61=${heightBuckets.lt61} 0.61-0.70=${heightBuckets.gte61} 0.70-0.78=${heightBuckets.gte70} >=0.78=${heightBuckets.gte78}`);
  console.log(`  MOUNTAIN tiles = ${terrainAgg[TerrainType.MOUNTAIN] ?? 0}`);
  console.log('  deposits:');
  const missing: string[] = [];
  for (const g of ['food','wood','stone','clay','copper','tin','iron','coal','salt','gold','gems','horses','cotton','spices','furs','oil','saltpeter','rubber','uranium'] as GoodId[]) {
    const n = depositAgg[g] ?? 0;
    if (n === 0) missing.push(g);
    console.log(`    ${g.padEnd(12)} ${n}`);
  }
  console.log(`  ZERO: ${missing.join(', ') || '(none)'}`);
}
