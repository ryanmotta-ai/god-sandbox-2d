/**
 * Why does a settlement never build a quarry or a mine?
 *
 * Founds cities at plausible spots, grants the mining technology outright, and
 * reports whether a physical site for each extraction building can be found
 * inside the settlement's survey radius.
 */
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { BUILDINGS, BuildingType } from '../src/civ/Building';
import { TERRAINS, TerrainType } from '../src/world/Biomes';
import { GoodId } from '../src/civ/Goods';
import { SpeciesType } from '../src/entities/Species';

const SIZE = 100;
const SEEDS = [12345, 777, 2024, 99, 5150];

function surveyRadius(pop: number, tier: string): number {
  const tierBonus = ({ camp: 0, hamlet: 1, village: 2, town: 4, city: 6, metropolis: 8 } as Record<string, number>)[tier] ?? 0;
  return Math.min(22, 7 + tierBonus + Math.floor(Math.sqrt(Math.max(0, pop)) / 2));
}

for (const seed of SEEDS) {
  const map = new TileMap(SIZE, SIZE, 'single_continent', seed);

  // Pick a few plausible settlement spots the way the game does: walkable land.
  const spots: { x: number; y: number }[] = [];
  for (let attempt = 0; attempt < 4000 && spots.length < 6; attempt++) {
    const x = 2 + Math.floor(Math.random() * (SIZE - 4));
    const y = 2 + Math.floor(Math.random() * (SIZE - 4));
    const t = map.getTile(x, y)!;
    if (TERRAINS[t.type].isWater || t.type === TerrainType.MOUNTAIN || t.type === TerrainType.LAVA) continue;
    if (spots.some(s => Math.hypot(s.x - x, s.y - y) < 18)) continue;
    spots.push({ x, y });
  }

  console.log(`\n=== SEED ${seed} — ${spots.length} settlement sites ===`);

  for (const spot of spots) {
    const city = new City(`c_${spot.x}_${spot.y}`, `Test${spot.x}`, SpeciesType.LUMINI, spot.x, spot.y, 'Probe', 1);
    city.population = 25; // village tier: a realistic radius
    city.updateTier();
    const radius = surveyRadius(city.population, city.tier);

    const found: Record<string, string> = {};
    for (const type of ['quarry', 'mine', 'lumber_camp', 'farm', 'oil_well'] as BuildingType[]) {
      const def = BUILDINGS[type];
      const targets = def.resourceTargets ?? [];
      const sites = map.findResourceSites(city.x, city.y, radius, targets as GoodId[], false);
      const usable = sites.filter(t => !TERRAINS[t.type].isWater && t.type !== TerrainType.LAVA && t.resourceAmount > 0);
      const kinds = new Set(usable.map(t => t.resourceType));
      found[type] = usable.length > 0 ? `${usable.length} sites (${[...kinds].join('/')})` : 'NONE';
    }

    // What is actually on the ground nearby, regardless of building rules?
    const nearby: Partial<Record<GoodId, number>> = {};
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const t = map.getTile(city.x + dx, city.y + dy);
        if (!t?.resourceType || t.resourceAmount <= 0) continue;
        if (Math.hypot(dx, dy) > radius) continue;
        nearby[t.resourceType] = (nearby[t.resourceType] ?? 0) + 1;
      }
    }

    console.log(`  (${spot.x},${spot.y}) tier=${city.tier} r=${radius}`);
    console.log(`     sites: quarry=${found.quarry} | mine=${found.mine} | lumber=${found.lumber_camp} | farm=${found.farm}`);
    console.log(`     ground: ${Object.entries(nearby).map(([k, v]) => `${k}:${v}`).join(' ') || '(nothing)'}`);
  }
}
