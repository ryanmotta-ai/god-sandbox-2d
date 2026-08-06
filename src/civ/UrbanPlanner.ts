import { BuildingType, BuildingDefinition, BUILDINGS } from './Building';
import { City, SETTLEMENT_TIERS, SettlementTier } from './City';
import { GoodId, GOODS } from './Goods';
import { TileMap } from '../world/TileMap';
import { TERRAINS, TerrainType } from '../world/Biomes';
import { tileResourceToGood } from '../world/Tile';
import { hashString, hashToUnit } from '../core/Random';

/**
 * Where a building goes.
 *
 * The economy decides *why* a settlement builds something — that stays in
 * `CivilizationEngine.scoreBuilding`, untouched. This module only answers the
 * separate question of *where*, and it answers it the way a place actually
 * grows: along the streets that already exist, near the things that belong
 * next to it, away from the things that do not, and never right on top of the
 * one seam of ore in the region.
 *
 * Nothing here is persisted. Districts are not a zoning map painted onto
 * tiles; they are an affinity that falls out of what is already standing
 * nearby, recomputed from the buildings themselves. That is deliberate: a
 * derived quarter reorganises itself when the city changes, and it costs the
 * save file nothing.
 */

// ============================================================
// DISTRICT AFFINITY
// ============================================================

/**
 * The urban character of a building. Two buildings that share one of these
 * want to be neighbours; the `REPELS` table below says which pairs do not.
 */
export type DistrictAffinity =
  | 'civic'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'agricultural'
  | 'extraction'
  | 'military'
  | 'logistics'
  | 'knowledge';

/**
 * How a building wants to sit in the settlement.
 *
 * Kept in its own table rather than bolted onto `BuildingDefinition`, which is
 * already a long record of economic facts. Placement is a different concern
 * with a different rate of change, and a planner that owns its own metadata
 * can be tuned without touching the economy.
 */
export interface UrbanProfile {
  affinity: DistrictAffinity;
  /**
   * How badly this wants a road at its door, 0..1. Extraction sits on its
   * deposit whether or not a road reaches it, so it scores near zero; a
   * market without a street is pointless, so it scores near one.
   */
  prefersRoad: number;
  /**
   * Where it belongs on the centre-to-edge axis. 1 = the civic core,
   * 0 = the outer fields. Everything else interpolates.
   */
  centerPreference: number;
  /**
   * How much elbow room it wants, in tiles. A row of houses is supposed to
   * touch; a palace with cottages jammed against its walls is not a palace.
   */
  spacing: number;
  /** Tolerance for a crowded neighbourhood, 0..1. Low = wants open ground. */
  densityTolerance: number;
}

const DEFAULT_PROFILE: UrbanProfile = {
  affinity: 'civic',
  prefersRoad: 0.5,
  centerPreference: 0.5,
  spacing: 1,
  densityTolerance: 0.6
};

export const URBAN_PROFILES: Partial<Record<BuildingType, UrbanProfile>> = {
  // ---- Civic core: the silhouette a city is recognised by. Needs room. ----
  town_center: { affinity: 'civic', prefersRoad: 0.9, centerPreference: 1.0, spacing: 1.6, densityTolerance: 0.7 },
  palace: { affinity: 'civic', prefersRoad: 0.95, centerPreference: 0.92, spacing: 2.2, densityTolerance: 0.45 },
  keep: { affinity: 'military', prefersRoad: 0.8, centerPreference: 0.8, spacing: 1.8, densityTolerance: 0.5 },
  monument: { affinity: 'civic', prefersRoad: 0.85, centerPreference: 0.85, spacing: 2.4, densityTolerance: 0.4 },
  great_library: { affinity: 'knowledge', prefersRoad: 0.85, centerPreference: 0.82, spacing: 2.0, densityTolerance: 0.5 },
  colosseum: { affinity: 'civic', prefersRoad: 0.85, centerPreference: 0.75, spacing: 2.4, densityTolerance: 0.4 },
  temple: { affinity: 'knowledge', prefersRoad: 0.7, centerPreference: 0.72, spacing: 1.5, densityTolerance: 0.6 },
  library: { affinity: 'knowledge', prefersRoad: 0.75, centerPreference: 0.7, spacing: 1.2, densityTolerance: 0.65 },
  academy: { affinity: 'knowledge', prefersRoad: 0.8, centerPreference: 0.72, spacing: 1.6, densityTolerance: 0.55 },

  // ---- Residential: clusters, wants streets, hates chimneys. ----
  house: { affinity: 'residential', prefersRoad: 0.85, centerPreference: 0.55, spacing: 0.9, densityTolerance: 0.95 },
  aqueduct: { affinity: 'residential', prefersRoad: 0.6, centerPreference: 0.6, spacing: 1.2, densityTolerance: 0.7 },
  grand_aqueduct: { affinity: 'residential', prefersRoad: 0.65, centerPreference: 0.6, spacing: 1.8, densityTolerance: 0.55 },
  granary: { affinity: 'residential', prefersRoad: 0.75, centerPreference: 0.55, spacing: 1.1, densityTolerance: 0.75 },

  // ---- Commerce: wants the busiest corner it can find. ----
  market: { affinity: 'commercial', prefersRoad: 1.0, centerPreference: 0.85, spacing: 1.3, densityTolerance: 0.9 },
  bank: { affinity: 'commercial', prefersRoad: 0.95, centerPreference: 0.85, spacing: 1.2, densityTolerance: 0.9 },
  stock_exchange: { affinity: 'commercial', prefersRoad: 0.95, centerPreference: 0.88, spacing: 1.4, densityTolerance: 0.85 },
  collective: { affinity: 'commercial', prefersRoad: 0.85, centerPreference: 0.6, spacing: 1.3, densityTolerance: 0.8 },

  // ---- Logistics: the waterfront edge of trade. ----
  harbor: { affinity: 'logistics', prefersRoad: 0.8, centerPreference: 0.35, spacing: 1.2, densityTolerance: 0.8 },
  port: { affinity: 'logistics', prefersRoad: 0.85, centerPreference: 0.3, spacing: 1.6, densityTolerance: 0.75 },

  // ---- Industry: its own quarter, out toward the edge. ----
  workshop: { affinity: 'industrial', prefersRoad: 0.75, centerPreference: 0.45, spacing: 1.1, densityTolerance: 0.85 },
  smithy: { affinity: 'industrial', prefersRoad: 0.75, centerPreference: 0.4, spacing: 1.2, densityTolerance: 0.8 },
  factory: { affinity: 'industrial', prefersRoad: 0.85, centerPreference: 0.2, spacing: 2.0, densityTolerance: 0.7 },
  refinery: { affinity: 'industrial', prefersRoad: 0.85, centerPreference: 0.15, spacing: 2.2, densityTolerance: 0.65 },

  // ---- Extraction: geology decides, urbanism only breaks ties. ----
  mine: { affinity: 'extraction', prefersRoad: 0.15, centerPreference: 0.1, spacing: 1.2, densityTolerance: 0.7 },
  quarry: { affinity: 'extraction', prefersRoad: 0.15, centerPreference: 0.1, spacing: 1.2, densityTolerance: 0.7 },
  lumber_camp: { affinity: 'extraction', prefersRoad: 0.15, centerPreference: 0.1, spacing: 1.2, densityTolerance: 0.7 },
  oil_well: { affinity: 'extraction', prefersRoad: 0.2, centerPreference: 0.1, spacing: 1.4, densityTolerance: 0.6 },

  // ---- Agriculture: the belt outside the town, wants space. ----
  farm: { affinity: 'agricultural', prefersRoad: 0.3, centerPreference: 0.12, spacing: 1.3, densityTolerance: 0.45 },
  pasture: { affinity: 'agricultural', prefersRoad: 0.25, centerPreference: 0.1, spacing: 1.5, densityTolerance: 0.4 },

  // ---- Military: on the roads, facing outward. ----
  barracks: { affinity: 'military', prefersRoad: 0.8, centerPreference: 0.5, spacing: 1.4, densityTolerance: 0.7 },
  wall: { affinity: 'military', prefersRoad: 0.2, centerPreference: 0.05, spacing: 0.6, densityTolerance: 1.0 }
};

export function urbanProfile(type: BuildingType): UrbanProfile {
  return URBAN_PROFILES[type] ?? DEFAULT_PROFILE;
}

/**
 * Which quarters actively push each other apart. Everything not listed is
 * simply neutral — the attraction between like affinities is what does most
 * of the sorting, and a repulsion table that tried to encode every pair would
 * be unreadable and impossible to tune.
 */
const REPELS: Partial<Record<DistrictAffinity, DistrictAffinity[]>> = {
  residential: ['industrial', 'extraction'],
  industrial: ['residential', 'civic'],
  extraction: ['residential', 'civic'],
  civic: ['industrial', 'extraction'],
  agricultural: ['industrial', 'extraction'],
  knowledge: ['industrial', 'extraction']
};

/** Pairs that specifically want each other, beyond sharing an affinity. */
const ATTRACTS: Partial<Record<BuildingType, BuildingType[]>> = {
  house: ['house', 'market', 'granary', 'aqueduct', 'temple', 'town_center'],
  market: ['house', 'town_center', 'bank', 'granary', 'harbor'],
  bank: ['market', 'stock_exchange', 'town_center'],
  stock_exchange: ['bank', 'market'],
  smithy: ['workshop', 'mine', 'quarry'],
  workshop: ['smithy', 'lumber_camp', 'market'],
  factory: ['refinery', 'smithy', 'workshop', 'port'],
  refinery: ['factory', 'oil_well', 'port'],
  palace: ['town_center', 'monument', 'temple', 'keep'],
  monument: ['town_center', 'palace'],
  granary: ['farm', 'pasture', 'market'],
  farm: ['farm', 'pasture', 'granary'],
  pasture: ['pasture', 'farm'],
  barracks: ['keep', 'wall', 'barracks'],
  port: ['harbor', 'market', 'factory'],
  harbor: ['port', 'market']
};

// ============================================================
// TUNING
// ============================================================

/**
 * Every weight the planner uses, in one place. Scattering these through the
 * scoring code is how a system like this becomes impossible to balance.
 */
export const PLANNER_WEIGHTS = {
  roadAccess: 46,
  centrality: 26,
  affinity: 34,
  repulsion: 52,
  spacing: 22,
  density: 30,
  desirability: 18,
  terrain: 14,
  resourceFit: 40,
  /** Subtracted per tile of new road the site would need. */
  roadExtensionPerTile: 7,
  /** Flat penalty for a site with no road anywhere in reach. */
  isolation: 34
};

/**
 * Soft coverage targets per settlement tier, as a fraction of the built-up
 * footprint. These are pressure, not a cap: exceeding one makes further
 * building in that neighbourhood progressively less attractive rather than
 * forbidden, so a city under real economic pressure can still densify.
 */
const TIER_DENSITY_TARGET: Record<SettlementTier, number> = {
  camp: 0.20,
  hamlet: 0.28,
  village: 0.38,
  town: 0.48,
  city: 0.55,
  metropolis: 0.60
};

/**
 * How far a settlement of each tier will reasonably run a new street to reach
 * a site. A hamlet does not drive an avenue twenty tiles across a valley to
 * site one cottage; a metropolis genuinely does open new corridors.
 */
const TIER_ROAD_EXTENSION: Record<SettlementTier, number> = {
  camp: 2,
  hamlet: 3,
  village: 5,
  town: 7,
  city: 10,
  metropolis: 14
};

export function maxRoadExtensionFor(city: City): number {
  return TIER_ROAD_EXTENSION[city.tier] ?? 3;
}

// ============================================================
// CANDIDATE
// ============================================================

export interface BuildingSiteCandidate {
  x: number;
  y: number;
  totalScore: number;
  roadAccessScore: number;
  centralityScore: number;
  districtAffinityScore: number;
  spacingScore: number;
  densityScore: number;
  desirabilityScore: number;
  terrainScore: number;
  resourceFitScore: number;
  /** The good under the tile, when the building can actually exploit it. */
  resourceGood: GoodId | null;
  /** Tiles of new road this site would need. 0 = already on a street. */
  roadExtensionTiles: number;
}

/** A single building already standing, flattened for cheap neighbourhood maths. */
interface NearbyBuilding {
  x: number;
  y: number;
  type: BuildingType;
  affinity: DistrictAffinity;
}

/**
 * Everything about a settlement that every candidate in one planning pass
 * shares. Computed once per building project rather than once per candidate
 * tile — with a survey radius of 22 that is the difference between reading the
 * city's buildings a few hundred times and reading them once.
 */
interface CityContext {
  city: City;
  centerX: number;
  centerY: number;
  buildings: NearbyBuilding[];
  /** Mean distance of existing buildings from the centre — the built-up radius. */
  builtRadius: number;
  densityTarget: number;
  maxExtension: number;
}

function buildContext(city: City): CityContext {
  const buildings: NearbyBuilding[] = [];
  let sumDist = 0;
  for (const b of city.buildings.values()) {
    buildings.push({
      x: b.x,
      y: b.y,
      type: b.type,
      affinity: urbanProfile(b.type).affinity
    });
    sumDist += Math.hypot(b.x - city.x, b.y - city.y);
  }
  return {
    city,
    centerX: city.x,
    centerY: city.y,
    buildings,
    builtRadius: buildings.length > 0 ? Math.max(2, sumDist / buildings.length) : 2,
    densityTarget: TIER_DENSITY_TARGET[city.tier] ?? 0.35,
    maxExtension: maxRoadExtensionFor(city)
  };
}

// ============================================================
// SCORING PARTS
// ============================================================

/** Distance in tiles to the nearest tile carrying a road, up to `limit`. */
function roadDistance(tileMap: TileMap, x: number, y: number, limit: number): number {
  for (let r = 0; r <= limit; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        // Only the ring at exactly radius r — inner rings were already checked.
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const t = tileMap.getTile(x + dx, y + dy);
        if (t && t.roadLevelEffective > 0) return r;
      }
    }
  }
  return limit + 1;
}

/**
 * How well the neighbours suit this building, and how badly they clash.
 *
 * This is the whole district system. Nothing marks a tile as "industrial" —
 * a smithy simply scores well beside another smithy and badly beside a row of
 * houses, and quarters emerge because every building placed makes the next
 * one of its kind more likely to land next door.
 */
function neighbourScores(
  ctx: CityContext,
  type: BuildingType,
  profile: UrbanProfile,
  x: number,
  y: number
): { affinity: number; repulsion: number; density: number; spacing: number } {
  const attracts = ATTRACTS[type] ?? [];
  const repelled = REPELS[profile.affinity] ?? [];

  let affinity = 0;
  let repulsion = 0;
  let neighbours = 0;
  let closest = Infinity;

  for (const b of ctx.buildings) {
    const d = Math.hypot(b.x - x, b.y - y);
    if (d > 6) continue; // beyond this nothing about a neighbour matters
    if (d < closest) closest = d;
    if (d <= 3.5) neighbours++;

    // Influence falls off with distance — a smithy two tiles away is a
    // neighbour, one six tiles away is just somewhere else in town.
    const falloff = 1 / (1 + d * d * 0.25);

    if (b.affinity === profile.affinity) affinity += falloff * 0.8;
    if (attracts.includes(b.type)) affinity += falloff * 1.4;
    if (repelled.includes(b.affinity)) {
      // Heavy industry next door is far worse than heavy industry in view.
      repulsion += falloff * (d <= 1.6 ? 2.6 : 1.0);
    }
  }

  // Local coverage: how much of this neighbourhood is already built on.
  const area = Math.PI * 3.5 * 3.5;
  const localDensity = neighbours / area;
  const over = Math.max(0, localDensity - ctx.densityTarget);
  const density = -over * (2 - profile.densityTolerance) * 12;

  // Spacing: too close to anything is bad, and how bad depends on what this
  // building is. A palace wants a courtyard; a terrace of houses does not.
  let spacing = 0;
  if (closest < profile.spacing) {
    spacing = -(profile.spacing - closest) / Math.max(0.3, profile.spacing);
  }

  return { affinity: Math.min(3, affinity), repulsion: Math.min(4, repulsion), density, spacing };
}

/** Cheap, derived land quality — no persistent heatmap. */
function desirability(tileMap: TileMap, x: number, y: number): number {
  const tile = tileMap.getTile(x, y);
  if (!tile) return 0;
  let score = 0;
  if (tile.fertility > 0.6) score += 0.3;
  if (tileMap.isCoastalLand(x, y)) score += 0.5;
  if (tile.type === TerrainType.GRASS || tile.type === TerrainType.SOIL) score += 0.4;
  if (tile.type === TerrainType.SWAMP) score -= 0.6;
  if (tile.type === TerrainType.SAND) score -= 0.25;
  return score;
}

/** Terrain suitability — building on rough or awkward ground costs more. */
function terrainScore(tileMap: TileMap, x: number, y: number): number {
  const tile = tileMap.getTile(x, y);
  if (!tile) return -1;
  const moveCost = TERRAINS[tile.type].moveCost;
  // moveCost stands in for how hard the ground is to work: 1 is easy, 3 is not.
  return -(moveCost - 1) * 0.5;
}

/**
 * Whether an ordinary building would be paving over geology worth keeping.
 *
 * A house on the only uranium seam in the region is a permanent, silent loss —
 * the deposit is still there, but nothing can ever be built to reach it. The
 * planner refuses those tiles outright rather than pricing them, because no
 * housing demand is worth a strategic resource.
 */
export function wouldWasteResource(tileMap: TileMap, x: number, y: number, def: BuildingDefinition): boolean {
  const tile = tileMap.getTile(x, y);
  if (!tile || !tile.resourceType || tile.resourceAmount <= 0) return false;
  const good = tileResourceToGood(tile.resourceType);
  if (!good) return false;
  // A building that can actually exploit this deposit is exactly what should
  // be here.
  if (def.resourceTargets?.includes(good)) return false;
  const info = GOODS[good];
  if (!info) return false;
  return info.strategic || info.kind === 'raw';
}

// ============================================================
// THE PLANNER
// ============================================================

export class UrbanPlanner {
  /**
   * Ranked places this building could go, best first.
   *
   * Runs as a funnel so the expensive parts only ever see a handful of tiles:
   * a hard validity filter, then cheap neighbourhood scoring over what
   * survives, then a road-distance probe on the top few. Called once per
   * building project per year — never from a render frame.
   */
  public static findBuildingSites(
    city: City,
    def: BuildingDefinition,
    tileMap: TileMap,
    radius: number,
    limit: number = 6
  ): BuildingSiteCandidate[] {
    const ctx = buildContext(city);
    const profile = urbanProfile(def.type);

    const raw: BuildingSiteCandidate[] = [];

    // ---- Extraction: geology chooses the site, not the town plan. ----
    if (def.resourceMode === 'required' && def.resourceTargets?.length) {
      for (const tile of tileMap.findResourceSites(city.x, city.y, radius, def.resourceTargets, false)) {
        if (!this.tileIsBuildable(tileMap, city, tile.x, tile.y)) continue;
        const good = tileResourceToGood(tile.resourceType);
        if (!good) continue;
        const c = this.scoreSite(ctx, def, profile, tileMap, tile.x, tile.y, good);
        // The deposit itself dominates: a richer, more strategic seam wins
        // even if the urban approach to it is worse.
        c.resourceFitScore = PLANNER_WEIGHTS.resourceFit *
          (1 + Math.min(1, tile.resourceAmount / 200) + (GOODS[good]?.strategic ? 0.8 : 0));
        c.totalScore += c.resourceFitScore;
        raw.push(c);
      }
      raw.sort((a, b) => b.totalScore - a.totalScore);
      return raw.slice(0, limit);
    }

    // ---- Everything else: scan the survey area. ----
    const minX = Math.max(0, Math.floor(city.x - radius));
    const maxX = Math.min(tileMap.width - 1, Math.ceil(city.x + radius));
    const minY = Math.max(0, Math.floor(city.y - radius));
    const maxY = Math.min(tileMap.height - 1, Math.ceil(city.y + radius));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (Math.hypot(x - city.x, y - city.y) > radius) continue;
        if (!this.tileIsBuildable(tileMap, city, x, y)) continue;
        if (def.requiresCoast && !tileMap.isCoastalLand(x, y)) continue;
        if (wouldWasteResource(tileMap, x, y, def)) continue;

        const tile = tileMap.getTile(x, y)!;
        if (tile.type === TerrainType.MOUNTAIN) continue;

        const resourceGood = tileResourceToGood(tile.resourceType);
        const usable = !!resourceGood && !!def.resourceTargets?.includes(resourceGood);
        raw.push(this.scoreSite(ctx, def, profile, tileMap, x, y, usable ? resourceGood : null));
      }
    }

    if (raw.length === 0) return [];

    // Cheap pass done. Only the strongest handful pay for a road probe.
    raw.sort((a, b) => b.totalScore - a.totalScore);
    const shortlist = raw.slice(0, Math.max(limit, 12));

    for (const c of shortlist) {
      const dist = roadDistance(tileMap, c.x, c.y, ctx.maxExtension + 1);
      c.roadExtensionTiles = Math.max(0, dist - 1);

      if (dist === 0 || dist === 1) {
        // Already fronting a street — the coarse pass has already credited
        // this, so adding it again here would count frontage twice.
        c.roadAccessScore = 0;
      } else if (dist <= ctx.maxExtension) {
        c.roadAccessScore = PLANNER_WEIGHTS.roadAccess * profile.prefersRoad * 0.35
          - c.roadExtensionTiles * PLANNER_WEIGHTS.roadExtensionPerTile * profile.prefersRoad;
      } else {
        // Out of reach of the street network entirely. Fields and mines can
        // live like that; a market or a bank cannot.
        c.roadAccessScore = -PLANNER_WEIGHTS.isolation * profile.prefersRoad;
      }
      c.totalScore += c.roadAccessScore;
    }

    shortlist.sort((a, b) => b.totalScore - a.totalScore);
    return shortlist.slice(0, limit);
  }

  /** Hard validity — the things no amount of good scoring can excuse. */
  private static tileIsBuildable(tileMap: TileMap, city: City, x: number, y: number): boolean {
    const tile = tileMap.getTile(x, y);
    if (!tile || tile.buildingId) return false;
    const terrain = TERRAINS[tile.type];
    if (terrain.isWater || !terrain.isWalkable || tile.type === TerrainType.LAVA) return false;
    if (tile.cityId && tile.cityId !== city.id) return false;
    if (tile.kingdomId && city.kingdomId && tile.kingdomId !== city.kingdomId) return false;
    return true;
  }

  /** Everything that can be judged without probing the road network. */
  private static scoreSite(
    ctx: CityContext,
    def: BuildingDefinition,
    profile: UrbanProfile,
    tileMap: TileMap,
    x: number,
    y: number,
    resourceGood: GoodId | null
  ): BuildingSiteCandidate {
    const dist = Math.hypot(x - ctx.centerX, y - ctx.centerY);

    // Centre preference is measured against the settlement's own built-up
    // radius, so "central" means central *for this city* rather than a fixed
    // number of tiles. A hamlet's centre is three tiles wide.
    const normalised = Math.min(1.5, dist / Math.max(2, ctx.builtRadius));
    const wanted = 1 - profile.centerPreference;
    const centralityScore = PLANNER_WEIGHTS.centrality * (1 - Math.abs(normalised - wanted * 1.5));

    const n = neighbourScores(ctx, def.type, profile, x, y);
    const districtAffinityScore = PLANNER_WEIGHTS.affinity * n.affinity;
    const repulsionScore = -PLANNER_WEIGHTS.repulsion * n.repulsion;
    const spacingScore = PLANNER_WEIGHTS.spacing * n.spacing;
    const densityScore = PLANNER_WEIGHTS.density * n.density * 0.1;
    const desirabilityScore = PLANNER_WEIGHTS.desirability * desirability(tileMap, x, y);
    const terrScore = PLANNER_WEIGHTS.terrain * terrainScore(tileMap, x, y);

    let resourceFitScore = 0;
    if (resourceGood) {
      const tile = tileMap.getTile(x, y);
      resourceFitScore = PLANNER_WEIGHTS.resourceFit * 0.5 *
        (1 + Math.min(1, (tile?.resourceAmount ?? 0) / 200));
    }

    // Cheap frontage signal, folded into the coarse pass.
    //
    // The full road probe below only runs on the shortlist — so without this,
    // a tile with a street at its door could be eliminated before the probe
    // ever saw it, and the shortlist would be chosen with no road awareness at
    // all. Measured over 50 seeds that cost ~11 points of road connectivity
    // against the old placement rule. This is four tile lookups, which the
    // coarse pass can afford; the expensive ring search still waits.
    let frontage = 0;
    const here = tileMap.getTile(x, y);
    if (here && here.roadLevelEffective > 0) {
      frontage = 1;
    } else if (
      tileMap.getTile(x + 1, y)?.roadLevelEffective ||
      tileMap.getTile(x - 1, y)?.roadLevelEffective ||
      tileMap.getTile(x, y + 1)?.roadLevelEffective ||
      tileMap.getTile(x, y - 1)?.roadLevelEffective
    ) {
      frontage = 1;
    }
    const frontageScore = PLANNER_WEIGHTS.roadAccess * profile.prefersRoad * frontage;

    // A deterministic hair of noise so two equally-good tiles don't always
    // resolve the same way, without ever using Math.random.
    const jitter = (hashToUnit(hashString(ctx.city.id), x, y) - 0.5) * 4;

    const totalScore =
      centralityScore +
      districtAffinityScore +
      repulsionScore +
      spacingScore +
      densityScore +
      desirabilityScore +
      terrScore +
      resourceFitScore +
      frontageScore +
      jitter;

    return {
      x,
      y,
      totalScore,
      roadAccessScore: 0,
      centralityScore,
      districtAffinityScore: districtAffinityScore + repulsionScore,
      spacingScore,
      densityScore,
      desirabilityScore,
      terrainScore: terrScore,
      resourceFitScore,
      resourceGood,
      roadExtensionTiles: 0
    };
  }
}

// ============================================================
// QA METRICS (diagnostics only — never read by gameplay)
// ============================================================

export interface UrbanMetrics {
  buildings: number;
  /** Share of non-extraction, non-agricultural buildings within 1 tile of a road. */
  roadConnectivity: number;
  /** Mean distance from any house to the nearest heavy-industry building. */
  industrialSeparation: number;
  /** Mean distance of civic/commercial buildings from the centre. */
  centrality: number;
  /** Share of tiles in the built-up disc with nothing on them. */
  openSpace: number;
  /** Mean distance of all buildings from the centre. */
  sprawl: number;
  /** Mean distance between buildings sharing an affinity — lower means tighter quarters. */
  clustering: number;
}

const HEAVY_INDUSTRY: BuildingType[] = ['factory', 'refinery', 'smithy', 'oil_well', 'quarry', 'mine'];

export function measureCity(city: City, tileMap: TileMap): UrbanMetrics {
  const all = [...city.buildings.values()];
  if (all.length === 0) {
    return { buildings: 0, roadConnectivity: 1, industrialSeparation: 0, centrality: 0, openSpace: 1, sprawl: 0, clustering: 0 };
  }

  // Road connectivity — only for buildings that are supposed to want a street.
  let urbanCount = 0;
  let connected = 0;
  for (const b of all) {
    const p = urbanProfile(b.type);
    if (p.affinity === 'extraction' || p.affinity === 'agricultural') continue;
    urbanCount++;
    if (roadDistance(tileMap, b.x, b.y, 1) <= 1) connected++;
  }

  // Residential / heavy-industry separation.
  const houses = all.filter(b => b.type === 'house');
  const industry = all.filter(b => HEAVY_INDUSTRY.includes(b.type));
  let sepSum = 0;
  let sepCount = 0;
  for (const h of houses) {
    let nearest = Infinity;
    for (const i of industry) nearest = Math.min(nearest, Math.hypot(i.x - h.x, i.y - h.y));
    if (Number.isFinite(nearest)) { sepSum += nearest; sepCount++; }
  }

  // Centrality of the buildings that are meant to be central.
  let civicSum = 0;
  let civicCount = 0;
  let sprawlSum = 0;
  for (const b of all) {
    const d = Math.hypot(b.x - city.x, b.y - city.y);
    sprawlSum += d;
    const a = urbanProfile(b.type).affinity;
    if (a === 'civic' || a === 'commercial') { civicSum += d; civicCount++; }
  }

  // Open space inside the built-up disc.
  const radius = Math.max(3, Math.ceil(sprawlSum / all.length) + 2);
  let inDisc = 0;
  let built = 0;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.hypot(dx, dy) > radius) continue;
      const t = tileMap.getTile(Math.round(city.x + dx), Math.round(city.y + dy));
      if (!t) continue;
      const terr = TERRAINS[t.type];
      if (terr.isWater || !terr.isWalkable) continue;
      inDisc++;
      if (t.buildingId) built++;
    }
  }

  // Clustering: mean distance to the nearest building of the same affinity.
  let clusterSum = 0;
  let clusterCount = 0;
  for (const b of all) {
    const a = urbanProfile(b.type).affinity;
    let nearest = Infinity;
    for (const o of all) {
      if (o.id === b.id) continue;
      if (urbanProfile(o.type).affinity !== a) continue;
      nearest = Math.min(nearest, Math.hypot(o.x - b.x, o.y - b.y));
    }
    if (Number.isFinite(nearest)) { clusterSum += nearest; clusterCount++; }
  }

  return {
    buildings: all.length,
    roadConnectivity: urbanCount > 0 ? connected / urbanCount : 1,
    industrialSeparation: sepCount > 0 ? sepSum / sepCount : 0,
    centrality: civicCount > 0 ? civicSum / civicCount : 0,
    openSpace: inDisc > 0 ? 1 - built / inDisc : 1,
    sprawl: sprawlSum / all.length,
    clustering: clusterCount > 0 ? clusterSum / clusterCount : 0
  };
}

/**
 * A human-readable urban report for one settlement, for the debug panel and
 * the console. Everything here is derived on demand — calling it has no effect
 * on the simulation, so it is safe to hit at any point in a tick.
 */
export function describeCity(city: City, tileMap: TileMap): string {
  const m = measureCity(city, tileMap);
  const all = [...city.buildings.values()];

  const byAffinity = new Map<DistrictAffinity, number>();
  for (const b of all) {
    const a = urbanProfile(b.type).affinity;
    byAffinity.set(a, (byAffinity.get(a) ?? 0) + 1);
  }
  const distribution = [...byAffinity.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a, n]) => `${a} ${n}`)
    .join(', ');

  // What it would currently cost, in new street tiles, to reach the places
  // this settlement is most likely to build next.
  let extensionSum = 0;
  let extensionCount = 0;
  for (const site of UrbanPlanner.findBuildingSites(city, BUILDINGS.house, tileMap, 12, 5)) {
    extensionSum += site.roadExtensionTiles;
    extensionCount++;
  }

  return [
    `— ${city.name} (${city.tier}, pop ${city.population}) —`,
    `buildings          ${m.buildings}  [${distribution}]`,
    `slots used         ${all.length}/${city.buildingSlots}`,
    `road connectivity  ${(m.roadConnectivity * 100).toFixed(1)}%`,
    `open space         ${(m.openSpace * 100).toFixed(1)}%`,
    `sprawl (mean dist) ${m.sprawl.toFixed(2)} tiles`,
    `civic centrality   ${m.centrality.toFixed(2)} tiles`,
    `house<->industry   ${m.industrialSeparation.toFixed(2)} tiles`,
    `quarter tightness  ${m.clustering.toFixed(2)} tiles`,
    `next-site road ext ${extensionCount > 0 ? (extensionSum / extensionCount).toFixed(2) : 'n/a'} tiles`
  ].join('\n');
}
