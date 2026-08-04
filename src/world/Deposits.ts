import { Tile } from './Tile';
import { TerrainType } from './Biomes';
import { RandomService } from '../core/Random';
import { SimplexNoise } from './Noise';
import { GoodId, GOODS } from '../civ/Goods';

/**
 * Geology / surface-resource generation.
 *
 * Design goals:
 * - common resources are widespread;
 * - regional resources occur in recognisable belts/clusters;
 * - strategic resources are deliberately concentrated into a few basins so
 *   trade, diplomacy and conquest have something material to fight over;
 * - every placed resource is already a GoodId, so extraction never needs a
 *   translation table.
 *
 * Geology: the map is divided into a few coarse geological provinces, each with
 * an igneous / sedimentary / metamorphic / alluvial facies. Mineral belts only
 * form inside provinces whose facies actually produces that mineral — copper
 * belongs to igneous ranges, oil to sedimentary basins, salt to evaporite
 * flats. Deposits grow as rotated, elongated veins rather than perfect circles.
 */

export interface DepositSummary {
  tiles: Partial<Record<GoodId, number>>;
  amount: Partial<Record<GoodId, number>>;
}

const RENEWABLE = new Set<GoodId>(['food', 'wood', 'horses', 'cotton', 'spices', 'furs', 'rubber']);

export function isRenewableGood(good: GoodId | null | undefined): boolean {
  return !!good && RENEWABLE.has(good);
}

export function isFiniteDeposit(good: GoodId | null | undefined): boolean {
  return !!good && !RENEWABLE.has(good);
}

function isWater(type: TerrainType): boolean {
  return type === TerrainType.DEEP_OCEAN || type === TerrainType.SHALLOW_WATER;
}

function isLand(tile: Tile): boolean {
  return !isWater(tile.type) && tile.type !== TerrainType.LAVA;
}

function tierRank(good: GoodId | null): number {
  if (!good) return -1;
  const tier = GOODS[good]?.tier;
  return tier === 'strategic' ? 3 : tier === 'regional' ? 2 : 1;
}

function canReplace(existing: GoodId | null, incoming: GoodId): boolean {
  if (!existing || existing === incoming) return true;
  // Higher-tier geology may displace a common surface resource, but two deposits
  // of the same strategic importance should not erase each other by generation order.
  return tierRank(incoming) > tierRank(existing);
}

function setResource(tile: Tile, good: GoodId, amount: number, maxAmount: number = amount): void {
  if (!canReplace(tile.resourceType, good)) return;
  tile.resourceType = good;
  tile.resourceAmount = Math.max(1, Math.round(amount));
  tile.resourceMax = Math.max(tile.resourceAmount, Math.round(maxAmount));
}

function countForArea(width: number, height: number, baseAt128: number, minimum: number = 1): number {
  const scale = (width * height) / (128 * 128);
  return Math.max(minimum, Math.round(baseAt128 * scale));
}

type TilePredicate = (tile: Tile, x: number, y: number, grid: Tile[][]) => boolean;

/** Broad rock families. Each province gets one, biasing which minerals can form. */
type Facies = 'igneous' | 'sedimentary' | 'metamorphic' | 'alluvial';
const FACIES_IDS: Facies[] = ['igneous', 'sedimentary', 'metamorphic', 'alluvial'];
const FACIES_FOR_GOOD: Partial<Record<GoodId, Facies[]>> = {
  copper: ['igneous'],
  iron: ['igneous', 'metamorphic'],
  tin: ['igneous', 'metamorphic'],
  gold: ['igneous', 'metamorphic'],
  gems: ['igneous', 'metamorphic'],
  uranium: ['igneous'],
  coal: ['sedimentary'],
  oil: ['sedimentary', 'alluvial'],
  saltpeter: ['sedimentary', 'alluvial'],
  salt: ['sedimentary', 'alluvial']
};

/**
 * Coarse 3×3 grid of geological provinces carved from two low-frequency noises.
 * Each province is a large, wavy-bordered region with one deterministic facies.
 */
function buildFaciesGrid(
  width: number, height: number, seed: number
): Uint8Array {
  const grid = new Uint8Array(width * height);
  const noiseA = new SimplexNoise(new RandomService(seed + 7100));
  const noiseB = new SimplexNoise(new RandomService(seed + 7200));
  const provinceRng = new RandomService((seed ^ 0x51ab3f2d) >>> 0);
  const provinceFacies: number[] = [];
  for (let p = 0; p < 9; p++) {
    provinceFacies.push(FACIES_IDS.indexOf(provinceRng.pick(FACIES_IDS)));
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const bandA = Math.min(2, Math.floor(noiseA.octave2D(x, y, 3, 0.5, 0.02) * 3));
      const bandB = Math.min(2, Math.floor(noiseB.octave2D(x, y, 3, 0.5, 0.02) * 3));
      grid[x * height + y] = provinceFacies[bandA * 3 + bandB];
    }
  }
  return grid;
}

interface ClusterSpec {
  good: GoodId;
  clusters: number;
  radius: number;
  minAmount: number;
  maxAmount: number;
  density: number;
  predicate: TilePredicate;
  /** Restricts the primary predicate to provinces of these facies. */
  facies?: Facies[];
  /** Progressively relaxed predicates tried when the primary one finds no tiles. */
  fallbacks?: TilePredicate[];
}

function placeClusteredResource(
  grid: Tile[][],
  width: number,
  height: number,
  rng: RandomService,
  spec: ClusterSpec,
  faciesGrid?: Uint8Array
): void {
  const collect = (pred: TilePredicate, facies?: Facies[]): Array<{ x: number; y: number }> => {
    const list: Array<{ x: number; y: number }> = [];
    const allowed = facies ? new Set<number>(facies.map(f => FACIES_IDS.indexOf(f))) : null;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (!pred(grid[x][y], x, y, grid)) continue;
        if (allowed && !allowed.has(faciesGrid![x * height + y])) continue;
        list.push({ x, y });
      }
    }
    return list;
  };

  let eligible = collect(spec.predicate, spec.facies);
  let match: TilePredicate = spec.predicate;
  // Fallbacks deliberately drop the facies filter: if a province cannot host the
  // mineral at all, it still appears somewhere plausible instead of vanishing.
  for (const fb of spec.fallbacks ?? []) {
    if (eligible.length > 0) break;
    eligible = collect(fb);
    match = fb;
  }
  if (eligible.length === 0) return;

  const usedCenters: Array<{ x: number; y: number }> = [];
  const minimumCenterDistance = Math.max(4, spec.radius * 2.2);

  for (let cluster = 0; cluster < spec.clusters; cluster++) {
    let center = rng.pick(eligible);
    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = rng.pick(eligible);
      const separated = usedCenters.every(c => Math.hypot(c.x - candidate.x, c.y - candidate.y) >= minimumCenterDistance);
      if (separated) {
        center = candidate;
        break;
      }
    }
    usedCenters.push(center);

    // Geological veins are elongated and rotated, not perfect circles: each
    // cluster gets its own strike direction and aspect ratio.
    const r = spec.radius;
    const angle = rng.range(0, Math.PI);
    const elongation = rng.range(0.4, 0.9);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const rx = r;
    const ry = Math.max(1, r * elongation);
    const invX = 1 / (rx + 0.75);
    const invY = 1 / (ry + 0.75);

    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const x = center.x + dx;
        const y = center.y + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const tile = grid[x][y];
        if (!match(tile, x, y, grid)) continue;

        // Rotate into the vein's local frame and measure the ellipse distance.
        const u = dx * cosA + dy * sinA;
        const v = -dx * sinA + dy * cosA;
        const eDist = Math.hypot(u * invX, v * invY);
        if (eDist > 1.15) continue;
        const centerBias = Math.max(0, 1 - eDist);
        const chance = Math.min(0.98, spec.density * (0.48 + centerBias * 0.72));
        if (!rng.chance(chance) && !(dx === 0 && dy === 0)) continue;

        const richness = 0.75 + centerBias * 0.55 + rng.range(-0.12, 0.12);
        const maxAmount = rng.range(spec.minAmount, spec.maxAmount) * richness;
        const initial = maxAmount * rng.range(0.72, 1.0);
        setResource(tile, spec.good, initial, maxAmount);
      }
    }
  }
}

function coastalLand(grid: Tile[][], width: number, height: number, x: number, y: number): boolean {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    if (isWater(grid[nx][ny].type)) return true;
  }
  return false;
}

/** Generate every natural resource deposit in a deterministic pass. */
export function generateDeposits(grid: Tile[][], width: number, height: number, seed: number): DepositSummary {
  const rng = new RandomService((seed ^ 0x5f3759df) >>> 0);
  const faciesGrid = buildFaciesGrid(width, height, seed);

  // ---------------- Common surface resources ----------------
  // In a single-biome (grass) world the height/moisture/temperature fields still
  // vary, so resources are keyed to climate instead of terrain type — otherwise a
  // grass-only map would generate no timber, no stone and no clay at all.
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const tile = grid[x][y];
      if (!isLand(tile)) continue;

      const dampWoodland = tile.moisture >= 0.52 && tile.fertility >= 0.5;

      // Timber: densest in damp, fertile stands, sparse elsewhere.
      if (tile.type === TerrainType.FOREST) {
        if (rng.chance(0.85)) {
          const max = rng.range(80, 170) * (0.75 + tile.moisture * 0.5);
          setResource(tile, 'wood', max * rng.range(0.72, 1), max);
        } else if (rng.chance(0.25)) {
          // Wild forest berry & mushroom food deposits
          const max = rng.range(50, 120) * (0.8 + tile.fertility * 0.5);
          setResource(tile, 'food', max * rng.range(0.6, 0.95), max);
        }
      } else if (dampWoodland && rng.chance(0.5)) {
        const max = rng.range(50, 130) * (0.8 + tile.fertility * 0.5);
        setResource(tile, 'wood', max * rng.range(0.65, 1), max);
      } else if (rng.chance(0.08)) {
        const max = rng.range(30, 75);
        setResource(tile, 'wood', max * rng.range(0.6, 0.95), max);
      }

      if ((tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && rng.chance(0.35 + tile.moisture * 0.25)) {
        // Generous wild food, fruit trees and berry bush deposits
        const max = rng.range(60, 150) * (0.8 + tile.fertility * 0.6);
        setResource(tile, 'food', max * rng.range(0.65, 1.0), max);
      }

      // Acacia, scrub and palm stands (kept for multi-biome worlds).
      if (!tile.resourceType && (tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SWAMP) && rng.chance(0.2)) {
        const max = rng.range(35, 80);
        setResource(tile, 'wood', max * rng.range(0.6, 0.95), max);
      }

      // Stone is a `common` good and half the build tree needs it, so it cannot be
      // locked behind mountain peaks alone: exposed rock also occurs on highlands,
      // tundra and snow. Mountains stay by far the richest source.
      const rockyGround =
        tile.type === TerrainType.TUNDRA ||
        tile.type === TerrainType.SNOW ||
        ((tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS || tile.type === TerrainType.SAND) && tile.height > 0.58);

      if (tile.type === TerrainType.MOUNTAIN && rng.chance(0.62)) {
        const max = rng.range(90, 190);
        setResource(tile, 'stone', max * rng.range(0.75, 1), max);
      } else if (rockyGround && rng.chance(0.3)) {
        const max = rng.range(45, 110);
        setResource(tile, 'stone', max * rng.range(0.7, 1), max);
      } else if ((tile.type === TerrainType.SOIL || tile.type === TerrainType.SAND) && rng.chance(coastalLand(grid, width, height, x, y) ? 0.22 : 0.09)) {
        const max = rng.range(50, 110);
        setResource(tile, 'clay', max * rng.range(0.7, 1), max);
      } else if (tile.height > 0.66 && rng.chance(0.16)) {
        // Bare rock on the high plains of a grass world still yields stone.
        const max = rng.range(45, 100);
        setResource(tile, 'stone', max * rng.range(0.7, 1), max);
      } else if (coastalLand(grid, width, height, x, y) && rng.chance(0.2)) {
        const max = rng.range(40, 95);
        setResource(tile, 'clay', max * rng.range(0.7, 1), max);
      }
    }
  }

  // Single-biome world: every land tile is GRASS, so mineral belts are keyed to
  // height/moisture/temperature gradients instead of exotic terrain types. The
  // terrain checks below are kept so multi-biome worlds still work too.
  const highland: TilePredicate = tile =>
    tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SOIL || (tile.type === TerrainType.GRASS && tile.height > 0.61);

  const rockyDry: TilePredicate = tile =>
    tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SAND || ((tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS) && tile.moisture < 0.42);

  const warmField: TilePredicate = tile =>
    (tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && tile.temperature >= 14;

  const tropical: TilePredicate = tile =>
    (tile.type === TerrainType.GRASS || tile.type === TerrainType.FOREST || tile.type === TerrainType.SWAMP) && tile.temperature >= 22 && tile.moisture >= 0.55;

  const coldLand: TilePredicate = tile =>
    tile.type === TerrainType.TUNDRA || tile.type === TerrainType.SNOW || (tile.type === TerrainType.GRASS && tile.temperature < 2);

  const coastalLow: TilePredicate = (tile, x, y, g) =>
    !isWater(tile.type) && coastalLand(g, width, height, x, y) && tile.height < 0.72;

  const swampy: TilePredicate = tile =>
    tile.type === TerrainType.SWAMP || (tile.type === TerrainType.GRASS && tile.moisture >= 0.58 && tile.fertility >= 0.5);

  // ---------------- Regional resources ----------------
  const regional: ClusterSpec[] = [
    { good: 'copper', clusters: countForArea(width, height, 11, 4), radius: 2, minAmount: 55, maxAmount: 120, density: 0.72, predicate: highland, facies: ['igneous'], fallbacks: [highland] },
    { good: 'iron', clusters: countForArea(width, height, 13, 5), radius: 2, minAmount: 75, maxAmount: 155, density: 0.78, predicate: highland, facies: ['igneous', 'metamorphic'], fallbacks: [highland] },
    { good: 'coal', clusters: countForArea(width, height, 9, 3), radius: 3, minAmount: 85, maxAmount: 180, density: 0.68, predicate: tile => highland(tile, 0, 0, grid) || swampy(tile, 0, 0, grid), facies: ['sedimentary'], fallbacks: [tile => highland(tile, 0, 0, grid) || swampy(tile, 0, 0, grid)] },
    { good: 'salt', clusters: countForArea(width, height, 7, 3), radius: 2, minAmount: 60, maxAmount: 135, density: 0.62, predicate: coastalLow, facies: ['sedimentary', 'alluvial'], fallbacks: [coastalLow] },
    { good: 'gold', clusters: countForArea(width, height, 5, 2), radius: 2, minAmount: 30, maxAmount: 75, density: 0.5, predicate: highland, facies: ['igneous', 'metamorphic'], fallbacks: [highland] },
    { good: 'gems', clusters: countForArea(width, height, 4, 2), radius: 1, minAmount: 24, maxAmount: 58, density: 0.6, predicate: tile => (tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS) && tile.height > 0.7, facies: ['igneous', 'metamorphic'], fallbacks: [tile => (tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.GRASS) && tile.height > 0.6] },
    { good: 'horses', clusters: countForArea(width, height, 8, 3), radius: 3, minAmount: 45, maxAmount: 100, density: 0.5, predicate: tile => tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA, fallbacks: [tile => tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL] },
    { good: 'cotton', clusters: countForArea(width, height, 9, 3), radius: 3, minAmount: 55, maxAmount: 115, density: 0.58, predicate: warmField, fallbacks: [warmField] },
    { good: 'spices', clusters: countForArea(width, height, 5, 2), radius: 2, minAmount: 35, maxAmount: 85, density: 0.5, predicate: tropical, fallbacks: [tropical] },
    { good: 'furs', clusters: countForArea(width, height, 6, 2), radius: 3, minAmount: 40, maxAmount: 90, density: 0.5, predicate: coldLand, fallbacks: [tile => tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.TUNDRA || (tile.type === TerrainType.GRASS && tile.temperature < 5)] }
  ];
  for (const spec of regional) placeClusteredResource(grid, width, height, rng, spec, faciesGrid);

  // ---------------- Strategic resources ----------------
  // Few clusters, but each cluster is rich enough to support a region for many years.
  const strategic: ClusterSpec[] = [
    { good: 'tin', clusters: countForArea(width, height, 5, 2), radius: 2, minAmount: 45, maxAmount: 100, density: 0.56, predicate: highland, facies: ['igneous', 'metamorphic'], fallbacks: [tile => tile.type === TerrainType.MOUNTAIN || tile.height > 0.55] },
    { good: 'oil', clusters: countForArea(width, height, 4, 2), radius: 3, minAmount: 140, maxAmount: 310, density: 0.7, predicate: tile => !isWater(tile.type) && tile.height < 0.72 && tile.moisture < 0.65, facies: ['sedimentary', 'alluvial'], fallbacks: [tile => !isWater(tile.type) && tile.height < 0.72] },
    { good: 'saltpeter', clusters: countForArea(width, height, 5, 2), radius: 2, minAmount: 55, maxAmount: 120, density: 0.55, predicate: rockyDry, facies: ['sedimentary', 'alluvial'], fallbacks: [rockyDry] },
    { good: 'rubber', clusters: countForArea(width, height, 5, 2), radius: 3, minAmount: 70, maxAmount: 150, density: 0.58, predicate: tropical, fallbacks: [tropical] },
    { good: 'uranium', clusters: countForArea(width, height, 2, 1), radius: 2, minAmount: 45, maxAmount: 95, density: 0.48, predicate: tile => (tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS) && tile.height > 0.78, facies: ['igneous'], fallbacks: [tile => (tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.GRASS) && tile.height > 0.6] }
  ];
  for (const spec of strategic) placeClusteredResource(grid, width, height, rng, spec, faciesGrid);

  const summary: DepositSummary = { tiles: {}, amount: {} };
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const tile = grid[x][y];
      const good = tile.resourceType;
      if (!good) continue;
      summary.tiles[good] = (summary.tiles[good] ?? 0) + 1;
      summary.amount[good] = (summary.amount[good] ?? 0) + tile.resourceAmount;
    }
  }
  return summary;
}
