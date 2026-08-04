import { Tile } from './Tile';
import { TileMap } from './TileMap';
import { TerrainType } from './Biomes';

/**
 * The ground a road has to be built on.
 *
 * A road is not a line drawn between two dots: it is an earthwork. It has a
 * gradient it cannot exceed without becoming unusable, a subsoil that decides
 * how much material the bed swallows, and rivers that have to be spanned at a
 * narrows because a span is the most expensive thing a road ever buys.
 *
 * This module holds the pure terrain side of that — no cities, no stockpiles —
 * so both the surveyor (A*) and the works office (RoadEngineering) can agree
 * on what a piece of ground costs.
 */

/**
 * Converts a normalised height difference into a road gradient in percent.
 *
 * The generator's height field spans roughly 0.375 (sea level) to 0.89 over
 * land, and one tile of horizontal run is a few hundred metres at that scale.
 * At 400 that puts the median tile-to-tile step (~0.009) near 3.7% and the
 * steepest ground on the map (~0.106) near 42% — the same numbers real
 * surveyors design around, which is why the thresholds below read like a
 * highway manual.
 */
export const RELIEF_SCALE = 400;

/** Gradient in percent between two tiles, `run` measured in tiles. */
export function roadGrade(from: Tile, to: Tile, run: number = 1): number {
  return (Math.abs(to.height - from.height) / Math.max(0.001, run)) * RELIEF_SCALE;
}

/**
 * What a gradient multiplies the work by. Flat ground is 1×, a 6% grade 2×,
 * a 12% grade 5×, and past 20% the cut-and-fill is so expensive that a
 * surveyor will happily spend a dozen extra tiles contouring around it.
 * That single curve is what makes roads hug valleys and take saddles instead
 * of running straight over a shoulder of hill.
 */
export function gradePenalty(grade: number): number {
  return Math.min(40, 1 + (grade / 6) ** 2);
}

/**
 * Subsoil factor: how much extra bed a terrain swallows before it will carry
 * traffic. Swamp needs a piled causeway, forest needs clearing and grubbing,
 * permafrost heaves every thaw, sand will not stay where it is put.
 */
const GROUNDWORK: Partial<Record<TerrainType, number>> = {
  [TerrainType.SWAMP]: 2.4,
  [TerrainType.FOREST]: 1.5,
  [TerrainType.SNOW]: 1.6,
  [TerrainType.TUNDRA]: 1.25,
  [TerrainType.SAND]: 1.2,
  [TerrainType.CORRUPTED]: 1.35
};

export function groundworkFactor(type: TerrainType): number {
  return GROUNDWORK[type] ?? 1.0;
}

/** Longest water crossing a survey will even consider, in tiles. */
export const MAX_SPAN = 10;

/**
 * Width of the water crossing that this tile belongs to, measured along the
 * direction the road is travelling. A river taken at right angles at its
 * narrows is one or two tiles; the same river taken obliquely, or a bay, runs
 * to five or ten. Since the span sets the price of the bridge, measuring it
 * here is what makes a surveyed road walk upstream to the ford instead of
 * charging straight across the widest part.
 */
export function crossingSpan(tileMap: TileMap, x: number, y: number, dx: number, dy: number): number {
  const isWet = (tx: number, ty: number): boolean => {
    const t = tileMap.getTile(tx, ty);
    // Off the edge of the map counts as water still running. Treating it as
    // dry land makes every river look narrow at the world border, and a
    // surveyor that believes it will walk a road twenty tiles to the map edge
    // to cross there — which is precisely what it used to do.
    if (!t) return true;
    return t.type === TerrainType.SHALLOW_WATER || t.type === TerrainType.DEEP_OCEAN;
  };
  if (dx === 0 && dy === 0) return 1;
  let span = 1;
  for (let i = 1; i <= MAX_SPAN && isWet(x + dx * i, y + dy * i); i++) span++;
  for (let i = 1; i <= MAX_SPAN && isWet(x - dx * i, y - dy * i); i++) span++;
  return span;
}

/**
 * Terrain families that share a road surface. A track through dune sand is
 * pale and dusty, one across permafrost is grey and frost-heaved, a causeway
 * over marsh is dark and wet — the same construction, a different colour,
 * because the bed is made of whatever the road was cut through.
 */
export type RoadSurfaceFamily = 'temperate' | 'arid' | 'cold' | 'wet';

export function roadSurfaceFamily(type: TerrainType): RoadSurfaceFamily {
  switch (type) {
    case TerrainType.SAND:
    case TerrainType.SAVANNA:
      return 'arid';
    case TerrainType.SNOW:
    case TerrainType.TUNDRA:
      return 'cold';
    case TerrainType.SWAMP:
      return 'wet';
    default:
      return 'temperate';
  }
}
