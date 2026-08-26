import { BuildingType, BuildingDefinition, BUILDINGS } from './Building';
import { City, SETTLEMENT_TIERS, SettlementTier } from './City';
import { GoodId, GOODS } from './Goods';
import { TileMap } from '../world/TileMap';
import { TERRAINS, TerrainType } from '../world/Biomes';
import { tileResourceToGood } from '../world/Tile';
import { hashString, hashToUnit } from '../core/Random';
import { outerFortification, pointInsideFortification, type FortificationLine } from './FortificationPlanner';
import { districtAt } from './UrbanDistricts';
import { blueprintPlotAt, blueprintStreetAt, withinBlueprint } from './CityBlueprints';

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
  town_center: { affinity: 'civic', prefersRoad: 0.95, centerPreference: 1.0, spacing: 1.4, densityTolerance: 0.8 },
  palace: { affinity: 'civic', prefersRoad: 0.95, centerPreference: 0.95, spacing: 1.8, densityTolerance: 0.6 },
  keep: { affinity: 'military', prefersRoad: 0.85, centerPreference: 0.85, spacing: 1.6, densityTolerance: 0.6 },
  monument: { affinity: 'civic', prefersRoad: 0.9, centerPreference: 0.9, spacing: 1.8, densityTolerance: 0.5 },
  great_library: { affinity: 'knowledge', prefersRoad: 0.9, centerPreference: 0.88, spacing: 1.6, densityTolerance: 0.6 },
  colosseum: { affinity: 'civic', prefersRoad: 0.9, centerPreference: 0.8, spacing: 2.0, densityTolerance: 0.5 },
  temple: { affinity: 'knowledge', prefersRoad: 0.8, centerPreference: 0.8, spacing: 1.2, densityTolerance: 0.7 },
  library: { affinity: 'knowledge', prefersRoad: 0.8, centerPreference: 0.75, spacing: 1.0, densityTolerance: 0.75 },
  academy: { affinity: 'knowledge', prefersRoad: 0.85, centerPreference: 0.75, spacing: 1.4, densityTolerance: 0.65 },

  // ---- Residential: clusters tightly, wants streets, forms continuous terraces. ----
  house: { affinity: 'residential', prefersRoad: 0.95, centerPreference: 0.65, spacing: 0.45, densityTolerance: 0.98 },
  aqueduct: { affinity: 'residential', prefersRoad: 0.6, centerPreference: 0.6, spacing: 1.0, densityTolerance: 0.75 },
  grand_aqueduct: { affinity: 'residential', prefersRoad: 0.65, centerPreference: 0.6, spacing: 1.4, densityTolerance: 0.65 },
  granary: { affinity: 'residential', prefersRoad: 0.8, centerPreference: 0.5, spacing: 0.9, densityTolerance: 0.85 },

  // ---- Commerce: wants the busiest corner it can find. ----
  market: { affinity: 'commercial', prefersRoad: 1.0, centerPreference: 0.9, spacing: 1.0, densityTolerance: 0.95 },
  bank: { affinity: 'commercial', prefersRoad: 0.95, centerPreference: 0.9, spacing: 1.0, densityTolerance: 0.95 },
  stock_exchange: { affinity: 'commercial', prefersRoad: 0.95, centerPreference: 0.9, spacing: 1.2, densityTolerance: 0.9 },
  collective: { affinity: 'commercial', prefersRoad: 0.85, centerPreference: 0.65, spacing: 1.0, densityTolerance: 0.85 },

  // ---- Logistics: the waterfront edge of trade. ----
  harbor: { affinity: 'logistics', prefersRoad: 0.85, centerPreference: 0.35, spacing: 1.0, densityTolerance: 0.85 },
  port: { affinity: 'logistics', prefersRoad: 0.9, centerPreference: 0.3, spacing: 1.4, densityTolerance: 0.8 },
  naval_yard: { affinity: 'military', prefersRoad: 0.85, centerPreference: 0.25, spacing: 1.5, densityTolerance: 0.75 },

  // ---- Industry: its own quarter, out toward the edge. ----
  workshop: { affinity: 'industrial', prefersRoad: 0.8, centerPreference: 0.45, spacing: 0.8, densityTolerance: 0.9 },
  smithy: { affinity: 'industrial', prefersRoad: 0.8, centerPreference: 0.4, spacing: 0.9, densityTolerance: 0.85 },
  factory: { affinity: 'industrial', prefersRoad: 0.9, centerPreference: 0.2, spacing: 1.6, densityTolerance: 0.75 },
  refinery: { affinity: 'industrial', prefersRoad: 0.9, centerPreference: 0.15, spacing: 1.8, densityTolerance: 0.7 },
  enrichment_facility: { affinity: 'industrial', prefersRoad: 0.85, centerPreference: 0.1, spacing: 2.2, densityTolerance: 0.65 },

  // ---- Extraction: geology decides, urbanism only breaks ties. ----
  mine: { affinity: 'extraction', prefersRoad: 0.15, centerPreference: 0.05, spacing: 1.0, densityTolerance: 0.75 },
  quarry: { affinity: 'extraction', prefersRoad: 0.15, centerPreference: 0.05, spacing: 1.0, densityTolerance: 0.75 },
  lumber_camp: { affinity: 'extraction', prefersRoad: 0.15, centerPreference: 0.05, spacing: 1.0, densityTolerance: 0.75 },
  oil_well: { affinity: 'extraction', prefersRoad: 0.2, centerPreference: 0.05, spacing: 1.2, densityTolerance: 0.7 },

  // ---- Agriculture: the belt outside the town, forms outer farmland plots. ----
  farm: { affinity: 'agricultural', prefersRoad: 0.2, centerPreference: 0.05, spacing: 0.75, densityTolerance: 0.85 },
  pasture: { affinity: 'agricultural', prefersRoad: 0.15, centerPreference: 0.05, spacing: 0.75, densityTolerance: 0.85 },

  // ---- Military: on the roads, facing outward. ----
  barracks: { affinity: 'military', prefersRoad: 0.85, centerPreference: 0.5, spacing: 1.2, densityTolerance: 0.75 },
  radar_station: { affinity: 'military', prefersRoad: 0.8, centerPreference: 0.3, spacing: 1.5, densityTolerance: 0.7 },
  sam_site: { affinity: 'military', prefersRoad: 0.85, centerPreference: 0.35, spacing: 1.4, densityTolerance: 0.75 },
  missile_silo: { affinity: 'military', prefersRoad: 0.7, centerPreference: 0.15, spacing: 2.0, densityTolerance: 0.6 },
  drone_command: { affinity: 'military', prefersRoad: 0.85, centerPreference: 0.4, spacing: 1.3, densityTolerance: 0.75 },
  bomb_shelter: { affinity: 'residential', prefersRoad: 0.9, centerPreference: 0.6, spacing: 1.2, densityTolerance: 0.85 },
  wall: { affinity: 'military', prefersRoad: 0.2, centerPreference: 0.05, spacing: 0.5, densityTolerance: 1.0 }
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
  harbor: ['port', 'market'],
  naval_yard: ['port', 'harbor', 'barracks']
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
  isolation: 34,
  /**
   * The hand-drawn plan, in the same currency as everything above it. Sized to
   * beat the ordinary run of urban scoring — so a plan is followed — without
   * beating terrain, resources or the hard validity filters, which is why a
   * plot on a swamp still loses to open ground beside it.
   */
  blueprintPlot: 90,
  blueprintAffinity: 52,
  blueprintMismatch: 46
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
  /** Streets, blocks, continuity, coast and rail reservation. */
  urbanFormScore: number;
  /** CITY-V2 historical ring / later infill preference. */
  historicalGrowthScore: number;
  /** The good under the tile, when the building can actually exploit it. */
  resourceGood: GoodId | null;
  /** Tiles of new road this site would need. 0 = already on a street. */
  roadExtensionTiles: number;
}

/** A single building already standing, flattened for cheap neighbourhood maths. */
interface NearbyBuilding {
  id: string;
  x: number;
  y: number;
  type: BuildingType;
  affinity: DistrictAffinity;
  visualExtent: number;
  builtYear: number;
  originGeneration: number;
}

/**
 * Source-canvas extent in world tiles for the current ART-V1 building class.
 * This is visual clearance only: the economic Building remains a one-tile
 * logical object and saves keep their existing format.
 */
function buildingVisualExtent(type: BuildingType): number {
  if (['palace', 'keep', 'monument', 'great_library', 'grand_aqueduct', 'colosseum'].includes(type)) return 5;
  if (['town_center', 'quarry', 'mine', 'factory', 'library', 'academy', 'temple', 'harbor', 'bank', 'stock_exchange', 'port', 'refinery', 'barracks', 'naval_yard'].includes(type)) return 4;
  if (['farm', 'granary', 'pasture', 'lumber_camp', 'workshop', 'smithy', 'aqueduct', 'collective'].includes(type)) return 3;
  return type === 'wall' || type === 'oil_well' ? 1 : 2;
}

export interface UrbanStreetPlan {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  streetClass: UrbanStreetClass;
  alreadyConnected: boolean;
}

export type UrbanGrowthStage = 'camp' | 'village' | 'city' | 'great_city';
export type UrbanStreetClass = 'primary' | 'secondary';

export interface UrbanLot {
  readonly x: number;
  readonly y: number;
  readonly blockId: string;
  plannedStreet: UrbanStreetClass | null;
  streetFrontage: UrbanStreetClass | null;
  nearRail: boolean;
  coastal: boolean;
  occupied: boolean;
  originYear: number | null;
  originGeneration: number | null;
}

export interface UrbanBlock {
  readonly id: string;
  readonly lotKeys: Set<number>;
  occupied: number;
  readonly affinities: Map<DistrictAffinity, number>;
  originYear: number | null;
  originGeneration: number | null;
}

/** Derived urban fabric. It is deliberately runtime-only and never serialized. */
export interface UrbanStructureSnapshot {
  readonly stage: UrbanGrowthStage;
  readonly radius: number;
  readonly blockSize: number;
  readonly streets: Map<number, UrbanStreetClass>;
  readonly lots: Map<number, UrbanLot>;
  readonly blocks: Map<string, UrbanBlock>;
  readonly buildings: NearbyBuilding[];
  readonly reservedRailTiles: Set<number>;
}

interface CachedUrbanStructure extends UrbanStructureSnapshot {
  cityVersion: number;
  architectureVersion: number;
  networkSignature: string;
  map: TileMap;
}

const URBAN_STRUCTURE_CACHE = new WeakMap<City, CachedUrbanStructure>();

function growthStage(city: City): UrbanGrowthStage {
  if (city.tier === 'camp') return 'camp';
  if (city.tier === 'hamlet' || city.tier === 'village') return 'village';
  if (city.tier === 'town' || city.tier === 'city') return 'city';
  return 'great_city';
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function urbanTileKey(tileMap: TileMap, x: number, y: number): number { return x * tileMap.height + y; }

function localNetworkSignature(city: City, tileMap: TileMap, radius: number): string {
  const minCX = Math.max(0, Math.floor((city.x - radius) / tileMap.chunkSize));
  const maxCX = Math.min(tileMap.chunkStore.chunksX - 1, Math.floor((city.x + radius) / tileMap.chunkSize));
  const minCY = Math.max(0, Math.floor((city.y - radius) / tileMap.chunkSize));
  const maxCY = Math.min(tileMap.chunkStore.chunksY - 1, Math.floor((city.y + radius) / tileMap.chunkSize));
  const parts: string[] = [];
  for (let cx = minCX; cx <= maxCX; cx++) for (let cy = minCY; cy <= maxCY; cy++) {
    const chunk = tileMap.chunkStore.getChunk(cx, cy);
    if (chunk) parts.push(`${cx}:${cy}:${chunk.terrainVersion}:${chunk.roadVersion}:${chunk.railVersion}`);
  }
  return parts.join('|');
}

function plannedStreetAt(city: City, stage: UrbanGrowthStage, blockSize: number, radius: number, x: number, y: number): UrbanStreetClass | null {
  const dx = x - Math.floor(city.x), dy = y - Math.floor(city.y);
  const distance = Math.hypot(dx, dy);
  if (distance > radius) return null;

  // The hand-drawn plan owns every tile it covers — including the ones where it
  // says there is deliberately no street, which is how a plan keeps a green or
  // the middle of a block open. Only past the edge of the drawing does the
  // procedural grid take over, and it has to: the drawing reaches fifteen tiles
  // and a metropolis surveys twenty-two, so the outlying farm lanes are still
  // laid the old way. Reading the plan as "no street anywhere it did not draw
  // one" is what silently deleted the grid from every city in the game, since
  // `blueprintId` is never empty and the drawings only went out five tiles.
  if (withinBlueprint(dx, dy)) return blueprintStreetAt(city, dx, dy, stage);

  // The two axes are the historical high streets beyond the drawn plan.
  if (dx === 0 || dy === 0) return 'primary';
  if (stage === 'camp') return null;
  const irregularity = city.architecturalProfile?.urbanForm.irregularity ?? .35;
  const row = Math.floor(dy / blockSize), column = Math.floor(dx / blockSize);
  const rowDeviation = irregularity < .34 ? 0 : Math.round((hashToUnit(hashString(city.id), row, 301) - .5) * irregularity * 3);
  const columnDeviation = irregularity < .34 ? 0 : Math.round((hashToUnit(hashString(city.id), column, 302) - .5) * irregularity * 3);
  const rowStagger = positiveModulo(row, 2) + rowDeviation;
  const colStagger = positiveModulo(column, 2) + columnDeviation;
  const onVertical = positiveModulo(dx + rowStagger, blockSize) === 0;
  const onHorizontal = positiveModulo(dy + colStagger, blockSize) === 0;
  return onVertical || onHorizontal ? 'secondary' : null;
}

function blockIdFor(city: City, blockSize: number, x: number, y: number): string {
  const bx = Math.floor((x - Math.floor(city.x) + Math.floor(blockSize / 2)) / blockSize);
  const by = Math.floor((y - Math.floor(city.y) + Math.floor(blockSize / 2)) / blockSize);
  return `${bx}:${by}`;
}

function syncStructureBuildings(cache: CachedUrbanStructure, city: City): void {
  cache.buildings.length = 0;
  for (const block of cache.blocks.values()) { block.occupied = 0; block.affinities.clear(); block.originYear = null; block.originGeneration = null; }
  for (const lot of cache.lots.values()) { lot.occupied = false; lot.originYear = null; lot.originGeneration = null; }
  for (const building of city.buildings.values()) {
    // Fortification pieces occupy their physical tiles, but they are not lots
    // or district anchors. Treating forty curtain segments as urban buildings
    // would pull every subsequent house toward the wall itself.
    if (building.fortificationRole) continue;
    const affinity = urbanProfile(building.type).affinity;
    cache.buildings.push({
      id: building.id, x: building.x, y: building.y, type: building.type, affinity,
      visualExtent: buildingVisualExtent(building.type), builtYear: building.builtYear,
      originGeneration: building.originGeneration
    });
    const key = urbanTileKey(cache.map, Math.floor(building.x), Math.floor(building.y));
    const lot = cache.lots.get(key);
    if (!lot) continue;
    lot.occupied = true;
    lot.originYear = building.builtYear;
    lot.originGeneration = building.originGeneration;
    const block = cache.blocks.get(lot.blockId);
    if (block) {
      block.occupied++; block.affinities.set(affinity, (block.affinities.get(affinity) ?? 0) + 1);
      block.originYear = block.originYear === null ? building.builtYear : Math.min(block.originYear, building.builtYear);
      block.originGeneration = block.originGeneration === null ? building.originGeneration : Math.min(block.originGeneration, building.originGeneration);
    }
  }
  cache.cityVersion = city.buildingVersion;
}

function buildUrbanStructure(city: City, tileMap: TileMap, radius: number): CachedUrbanStructure {
  const stage = growthStage(city);
  const baseBlockSize = stage === 'camp' ? 4 : stage === 'village' ? 5 : stage === 'city' ? 6 : 7;
  const blockSize = Math.max(3, Math.min(9, Math.round(baseBlockSize + (city.architecturalProfile?.urbanForm.blockScale ?? 0) * 1.35)));
  const streets = new Map<number, UrbanStreetClass>();
  const lots = new Map<number, UrbanLot>();
  const blocks = new Map<string, UrbanBlock>();
  const reservedRailTiles = new Set<number>();
  const minX = Math.max(0, Math.floor(city.x - radius)), maxX = Math.min(tileMap.width - 1, Math.ceil(city.x + radius));
  const minY = Math.max(0, Math.floor(city.y - radius)), maxY = Math.min(tileMap.height - 1, Math.ceil(city.y + radius));

  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    if (Math.hypot(x - city.x, y - city.y) > radius) continue;
    const tile = tileMap.getTile(x, y); if (!tile) continue;
    const terrain = TERRAINS[tile.type];
    if (terrain.isWater || !terrain.isWalkable || tile.type === TerrainType.LAVA || tile.type === TerrainType.MOUNTAIN) continue;
    const key = urbanTileKey(tileMap, x, y);
    if (tile.railLevelEffective > 0) { reservedRailTiles.add(key); continue; }
    const plannedStreet = plannedStreetAt(city, stage, blockSize, radius, x, y);
    if (tile.roadLevelEffective > 0) {
      streets.set(key, tile.roadTraffic >= 70 || plannedStreet === 'primary' ? 'primary' : 'secondary');
      continue;
    }
    const blockId = blockIdFor(city, blockSize, x, y);
    let block = blocks.get(blockId);
    if (!block) { block = { id: blockId, lotKeys: new Set(), occupied: 0, affinities: new Map(), originYear: null, originGeneration: null }; blocks.set(blockId, block); }
    const lot: UrbanLot = {
      x, y, blockId, plannedStreet, streetFrontage: null,
      nearRail: tileMap.getNeighbors(x, y, true).some(neighbor => neighbor.railLevelEffective > 0),
      coastal: tileMap.isCoastalLand(x, y), occupied: !!tile.buildingId,
      originYear: null, originGeneration: null
    };
    lots.set(key, lot); block.lotKeys.add(key);
  }

  // Street frontage belongs to lots, so site scoring is O(1).
  for (const [key, streetClass] of streets) {
    const x = Math.floor(key / tileMap.height), y = key % tileMap.height;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const lot = lots.get(urbanTileKey(tileMap, x + dx, y + dy));
      if (lot && (streetClass === 'primary' || lot.streetFrontage === null)) lot.streetFrontage = streetClass;
    }
  }

  const cache: CachedUrbanStructure = {
    stage, radius, blockSize, streets, lots, blocks, buildings: [], reservedRailTiles,
    cityVersion: -1, architectureVersion: city.architecturalVersion,
    networkSignature: localNetworkSignature(city, tileMap, radius), map: tileMap
  };
  syncStructureBuildings(cache, city);
  return cache;
}

function ensureUrbanStructure(city: City, tileMap: TileMap, radius: number): CachedUrbanStructure {
  let cache = URBAN_STRUCTURE_CACHE.get(city);
  const signature = localNetworkSignature(city, tileMap, radius);
  if (!cache || cache.map !== tileMap || cache.radius !== radius || cache.stage !== growthStage(city)
    || cache.architectureVersion !== city.architecturalVersion || cache.networkSignature !== signature) {
    cache = buildUrbanStructure(city, tileMap, radius); URBAN_STRUCTURE_CACHE.set(city, cache); return cache;
  }
  if (cache.cityVersion !== city.buildingVersion) syncStructureBuildings(cache, city);
  return cache;
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
  structure: CachedUrbanStructure;
  currentGeneration: number;
  historicalRadius: number;
  outerWall: FortificationLine | null;
  /** 0..1 pressure to leave the currently active enclosure. */
  enclosurePressure: number;
}

function buildContext(city: City, tileMap: TileMap, radius: number): CityContext {
  const structure = ensureUrbanStructure(city, tileMap, radius);
  const buildings = structure.buildings;
  let sumDist = 0;
  let historicalRadius = 0;
  const currentGeneration = city.currentUrbanGeneration;
  for (const b of buildings) {
    const distance = Math.hypot(b.x - city.x, b.y - city.y);
    sumDist += distance;
    if (b.originGeneration < currentGeneration) historicalRadius = Math.max(historicalRadius, distance);
  }
  const outerWall = outerFortification(city);
  let enclosurePressure = 0;
  if (outerWall?.status === 'active') {
    const inside = buildings.filter(building => pointInsideFortification(outerWall, building.x + .5, building.y + .5)).length;
    const practicalCapacity = outerWall.originalUrbanBuildings + Math.max(5, Math.round(outerWall.perimeter * .13));
    enclosurePressure = Math.max(0, Math.min(1, inside / Math.max(1, practicalCapacity)));
  }
  return {
    city,
    centerX: city.x,
    centerY: city.y,
    buildings,
    builtRadius: buildings.length > 0 ? Math.max(2, sumDist / buildings.length) : 2,
    densityTarget: (TIER_DENSITY_TARGET[city.tier] ?? 0.35) * .58 + (city.architecturalProfile?.urbanForm.density ?? .42) * .42,
    maxExtension: maxRoadExtensionFor(city),
    structure,
    currentGeneration,
    historicalRadius: Math.max(2, historicalRadius),
    outerWall,
    enclosurePressure
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

/** Distance in tiles to the nearest tile carrying rail, up to `limit`. */
function railDistance(tileMap: TileMap, x: number, y: number, limit: number): number {
  for (let r = 0; r <= limit; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tile = tileMap.getTile(x + dx, y + dy);
        if (tile && tile.railLevelEffective > 0) return r;
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
  const culturalSpacing = profile.spacing * (1 + (ctx.city.architecturalProfile?.urbanForm.openSpace ?? .25) * .28);
  if (closest < culturalSpacing) {
    spacing = -(culturalSpacing - closest) / Math.max(0.3, culturalSpacing);
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

function scoreUrbanForm(ctx: CityContext, type: BuildingType, profile: UrbanProfile, tileMap: TileMap, x: number, y: number): number {
  const key = urbanTileKey(tileMap, x, y);
  const lot = ctx.structure.lots.get(key);
  if (!lot) return -70;
  let score = 0;

  // Preserve future corridors. A city may consume one under extreme physical
  // pressure, but normal construction leaves the street skeleton open.
  if (lot.plannedStreet === 'primary') score -= 72;
  else if (lot.plannedStreet === 'secondary') score -= 38;

  let plannedFrontage: UrbanStreetClass | null = null;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const neighborKey = urbanTileKey(tileMap, x + dx, y + dy);
    const realized = ctx.structure.streets.get(neighborKey);
    const planned = ctx.structure.lots.get(neighborKey)?.plannedStreet ?? null;
    const found = realized ?? planned;
    if (found === 'primary') { plannedFrontage = 'primary'; break; }
    if (found === 'secondary') plannedFrontage = 'secondary';
  }
  const frontage = lot.streetFrontage ?? plannedFrontage;
  if (frontage) {
    const coreUse = profile.affinity === 'civic' || profile.affinity === 'commercial' || profile.affinity === 'knowledge';
    const neighbourhoodUse = profile.affinity === 'residential' || profile.affinity === 'agricultural';
    score += frontage === 'primary' ? (coreUse ? 34 : 18) : (neighbourhoodUse ? 30 : 20);
    if (lot.streetFrontage) score += 12;
  } else if (profile.prefersRoad > .7) score -= 24 * (ctx.city.architecturalProfile?.urbanForm.roadPreference ?? 1);

  const block = ctx.structure.blocks.get(lot.blockId);
  const matching = block?.affinities.get(profile.affinity) ?? 0;
  if (matching > 0) score += Math.min(28, matching * 9);
  if (block && block.occupied / Math.max(1, block.lotKeys.size) > ctx.densityTarget) score -= 12 * (1 - profile.densityTolerance);

  let nearbyUrban = 0;
  for (const building of ctx.structure.buildings) {
    const d = Math.hypot(building.x - x, building.y - y);
    if (d <= 2.25) nearbyUrban++;
  }
  score += Math.min(18, nearbyUrban * 5); // continuity, not isolated dots

  // Rail pulls production and pushes housing away, and the pull has to reach
  // further than the shove. A hand-drawn plan settles the industrial quarter
  // before any track is laid, and it usually draws that quarter symmetrically —
  // so with attraction that only fired on an adjacent tile, two identical works
  // plots either side of the centre were a coin toss and the tracks lost it.
  // Graded over three tiles, the siding side wins, which is the whole point of
  // a siding. Housing stays a flat shove: a cottage three tiles off the line is
  // fine, one against it is not.
  const railReach = railDistance(tileMap, x, y, 3);
  if (profile.affinity === 'industrial' || profile.affinity === 'logistics' || profile.affinity === 'extraction') {
    if (railReach <= 3) score += 44 - railReach * 10;
  } else if (lot.nearRail && (profile.affinity === 'residential' || profile.affinity === 'civic')) {
    // Sized against the plan, not against the old scale. A drawn housing plot
    // is worth well over a hundred points now, so the old shove of 32 no longer
    // moved anyone off the ballast — a cottage would take the trackside plot and
    // leave the identical plot one block back empty.
    score -= 68;
  }
  if (lot.coastal) {
    if (profile.affinity === 'logistics') score += 36;
    else if (profile.affinity === 'residential' || profile.affinity === 'commercial') score += 6;
  }

  // CITY-V5: existing activity creates functional gravity. This is not a
  // zoning permission â€” any valid lot can still win â€” but real commercial,
  // rail, port and industrial concentrations pull compatible construction.
  const district = districtAt(ctx.city, x, y);
  if (district) {
    const functional = district.type;
    if (profile.affinity === 'industrial') {
      if (functional === 'industrial' || functional === 'railway' || functional === 'port' || functional === 'artisan') score += 34;
      if (functional === 'residential_rich' || functional === 'historic_core' || functional === 'civic') score -= 42;
      score += district.accessibility * 22 - district.landValue * 10;
    } else if (profile.affinity === 'logistics') {
      if (functional === 'port' || functional === 'railway' || functional === 'industrial') score += 42;
      score += district.accessibility * 28;
    } else if (profile.affinity === 'commercial') {
      if (functional === 'commercial' || functional === 'historic_core' || functional === 'railway' || functional === 'port') score += 34;
      score += district.accessibility * 20 + district.landValue * 13;
    } else if (profile.affinity === 'residential') {
      if (functional === 'residential_common' || functional === 'residential_rich' || functional === 'residential_worker') score += 28;
      if (functional === 'industrial') score -= 42;
      score += district.desirability * 24 - district.pollution * 28;
      if (functional === 'residential_rich') score -= Math.max(0, district.density - .45) * 38;
      if (functional === 'residential_worker') score += district.density * 14; // compact housing close to work
    } else if (profile.affinity === 'civic' || profile.affinity === 'knowledge') {
      if (functional === 'historic_core' || functional === 'civic' || functional === 'religious') score += 32;
      score += district.landValue * 18 - district.pollution * 24;
    } else if (profile.affinity === 'agricultural') {
      if (functional === 'rural' || functional === 'periphery') score += 36;
      score -= district.landValue * 10;
    } else if (profile.affinity === 'military') {
      if (functional === 'military' || functional === 'periphery') score += 28;
    }
    if ((type === 'factory' || type === 'refinery') && functional === 'railway') score += 24;
    if ((type === 'market' || type === 'bank') && functional === 'railway') score += 18; // second centre around a station
  }
  return score;
}

/**
 * A structure big enough that it has to be given ground of its own.
 *
 * `buildingVisualExtent` is the sprite canvas measured in tiles: a `small`
 * asset is 64px against a 32px tile, so two. That canvas carries roof height
 * and transparent margin above a footprint of one single tile, which is all
 * the simulation ever marks on the map. Two ordinary buildings whose canvases
 * overlap by a tile are a terrace, drawn back to front, and a terrace is what
 * a street of houses is supposed to look like.
 *
 * Treating that canvas as ground is what emptied the settlements. Every pair of
 * buildings was pushed at least 1.5 tiles apart, so nothing could ever stand
 * beside anything: measured over grown cities, 8% of buildings had a neighbour
 * and a town sat on a quarter of its own land while the planner's own density
 * target asks for half. Only monumental work reserves space now, which is what
 * the rule was always for. A palace should not be lost behind a colosseum; two
 * cottages sharing a wall are just a street.
 */
const MONUMENTAL_EXTENT = 4;

function hasVisualClearance(ctx: CityContext, type: BuildingType, x: number, y: number): boolean {
  const extent = buildingVisualExtent(type) * (ctx.city.architecturalProfile?.urbanForm.buildingScale ?? 1);
  for (const building of ctx.buildings) {
    if (extent < MONUMENTAL_EXTENT && building.visualExtent < MONUMENTAL_EXTENT) continue;
    const clearance = (extent + building.visualExtent) * .25;
    if (Math.hypot(building.x - x, building.y - y) < clearance) return false;
  }
  return true;
}

function scoreHistoricalGrowth(ctx: CityContext, profile: UrbanProfile, x: number, y: number): number {
  if (ctx.currentGeneration <= 0) return 0;
  const distance = Math.hypot(x - ctx.centerX, y - ctx.centerY);
  const mature = ctx.currentGeneration >= 3;
  // Mature cities occasionally fill an older block; most projects establish
  // the next readable ring beyond the previous phase.
  const infillPass = mature && (ctx.buildings.length + ctx.currentGeneration) % 5 === 0;
  const target = infillPass
    ? Math.max(2.5, ctx.historicalRadius * .62)
    : Math.min(ctx.structure.radius * .84, ctx.historicalRadius + 1.5 + ctx.currentGeneration * .35);
  let score = 42 - Math.abs(distance - target) * 11;
  const lot = ctx.structure.lots.get(urbanTileKey(ctx.structure.map, x, y));
  const block = lot ? ctx.structure.blocks.get(lot.blockId) : undefined;
  if (!infillPass && block?.originGeneration !== null && block?.originGeneration !== undefined && block.originGeneration < ctx.currentGeneration) score -= 24;
  if (!infillPass && distance <= ctx.historicalRadius + .5 && profile.affinity !== 'civic' && profile.affinity !== 'commercial') score -= 62;
  if (infillPass && block && block.occupied > 0) score += 14;
  if (ctx.outerWall?.status === 'active') {
    const inside = pointInsideFortification(ctx.outerWall, x + .5, y + .5);
    // A newly enclosed city fills protected land first. Once that land is
    // pressured, continuity immediately outside the gates becomes preferable;
    // growth never stops merely because the curtain is full.
    if (ctx.enclosurePressure < .78) score += inside ? 34 : -46;
    else if (ctx.enclosurePressure < .92) score += inside ? 10 : 18;
    else score += inside ? -28 : 48;
  }
  return score;
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
    const ctx = buildContext(city, tileMap, radius);
    const profile = urbanProfile(def.type);

    const raw: BuildingSiteCandidate[] = [];

    // ---- Extraction: geology chooses the site, not the town plan. ----
    if (def.resourceMode === 'required' && def.resourceTargets?.length) {
      for (const tile of tileMap.findResourceSites(city.x, city.y, radius, def.resourceTargets, false)) {
        if (!this.tileIsBuildable(tileMap, city, tile.x, tile.y) || !hasVisualClearance(ctx, def.type, tile.x, tile.y)) continue;
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
        if (!this.tileIsBuildable(tileMap, city, x, y) || !hasVisualClearance(ctx, def.type, x, y)) continue;
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
    if (tile.roadLevelEffective > 0 || tile.railLevelEffective > 0) return false;
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
    const urbanFormScore = scoreUrbanForm(ctx, def.type, profile, tileMap, x, y);
    const historicalGrowthScore = scoreHistoricalGrowth(ctx, profile, x, y);

    // What the hand-drawn plan makes of this tile.
    //
    // A plot is worth a lot to the building it was drawn for, something to a
    // building of the right kind, and *costs* a building of the wrong kind. The
    // penalty is the half that matters: without it a plot is worth nothing to
    // the wrong tenant and nothing to no tenant at all, so a row of cottages
    // squats the forum and the monument ends up in the tanneries — which is
    // precisely what a plan exists to prevent.
    //
    // Geology still owns extraction. A seam is where it is, and no drawing
    // moves it, so a mine is never judged against the plan.
    let blueprintBonus = 0;
    if (profile.affinity !== 'extraction') {
      const plot = blueprintPlotAt(ctx.city, x - Math.floor(ctx.centerX), y - Math.floor(ctx.centerY));
      if (plot) {
        blueprintBonus = plot.prefer.includes(def.type)
          ? PLANNER_WEIGHTS.blueprintPlot + plot.importance * 6
          : plot.affinity === profile.affinity
            ? PLANNER_WEIGHTS.blueprintAffinity + plot.importance * 3
            : -(PLANNER_WEIGHTS.blueprintMismatch + plot.importance * 5);
      }
    }

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
      urbanFormScore +
      historicalGrowthScore +
      blueprintBonus +
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
      urbanFormScore,
      historicalGrowthScore,
      resourceGood,
      roadExtensionTiles: 0
    };
  }

  /** Runtime-only urban fabric for diagnostics and CITY-V1 tests. */
  public static structure(city: City, tileMap: TileMap, radius: number): UrbanStructureSnapshot {
    return ensureUrbanStructure(city, tileMap, radius);
  }

  /** Incremental building update: no rescan of the urban survey area. */
  public static recordConstruction(city: City, tileMap: TileMap, buildingId: string): void {
    const cache = URBAN_STRUCTURE_CACHE.get(city);
    const building = city.buildings.get(buildingId);
    if (!cache || cache.map !== tileMap || !building) return;
    const affinity = urbanProfile(building.type).affinity;
    if (!cache.buildings.some(item => item.id === building.id)) {
      cache.buildings.push({
        id: building.id, x: building.x, y: building.y, type: building.type, affinity,
        visualExtent: buildingVisualExtent(building.type), builtYear: building.builtYear,
        originGeneration: building.originGeneration
      });
    }
    const lot = cache.lots.get(urbanTileKey(tileMap, Math.floor(building.x), Math.floor(building.y)));
    if (lot && !lot.occupied) {
      lot.occupied = true;
      lot.originYear = building.builtYear;
      lot.originGeneration = building.originGeneration;
      const block = cache.blocks.get(lot.blockId);
      if (block) {
        block.occupied++; block.affinities.set(affinity, (block.affinities.get(affinity) ?? 0) + 1);
        block.originYear = block.originYear === null ? building.builtYear : Math.min(block.originYear, building.builtYear);
        block.originGeneration = block.originGeneration === null ? building.originGeneration : Math.min(block.originGeneration, building.originGeneration);
      }
    }
    cache.cityVersion = city.buildingVersion;
  }

  /**
   * Connects a building frontage to the nearest realised street, not blindly
   * back to city hall. This is what lets blocks grow outward incrementally.
   */
  public static planStreetConnection(city: City, tileMap: TileMap, buildingX: number, buildingY: number, radius: number): UrbanStreetPlan | null {
    const cache = ensureUrbanStructure(city, tileMap, radius);
    const approaches: Array<{ x: number; y: number; planned: UrbanStreetClass | null }> = [];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x = Math.floor(buildingX + dx), y = Math.floor(buildingY + dy);
      const tile = tileMap.getTile(x, y); if (!tile || tile.buildingId || tile.railLevelEffective > 0) continue;
      const terrain = TERRAINS[tile.type]; if (terrain.isWater || !terrain.isWalkable || tile.type === TerrainType.LAVA || tile.type === TerrainType.MOUNTAIN) continue;
      const key = urbanTileKey(tileMap, x, y);
      const existing = cache.streets.get(key);
      if (tile.roadLevelEffective > 0 || existing) {
        return { fromX: x, fromY: y, toX: x, toY: y, streetClass: existing ?? 'secondary', alreadyConnected: true };
      }
      approaches.push({ x, y, planned: cache.lots.get(key)?.plannedStreet ?? null });
    }
    if (approaches.length === 0) return null;

    // A building already fronting a *planned* street gets no bespoke lane. The
    // street works will lay that tile in a year or two anyway, and a surveyed
    // connector cutting across town to reach it does real damage: the survey
    // knows about relief and water but nothing about the plan, so it happily
    // paves the cathedral plot on its way past. Measured over grown cities that
    // was most of the plots the plan lost. The building waits for its street,
    // which is what a building on a planned street is supposed to do.
    if (approaches.some(approach => approach.planned !== null)) {
      const front = approaches.find(approach => approach.planned !== null)!;
      return { fromX: front.x, fromY: front.y, toX: front.x, toY: front.y, streetClass: front.planned!, alreadyConnected: true };
    }

    let best: { approach: typeof approaches[number]; streetX: number; streetY: number; streetClass: UrbanStreetClass; distance: number } | null = null;
    for (const approach of approaches) for (const [key, streetClass] of cache.streets) {
      const streetX = Math.floor(key / tileMap.height), streetY = key % tileMap.height;
      const distance = Math.abs(streetX - approach.x) + Math.abs(streetY - approach.y) - (approach.planned === 'primary' ? .5 : 0);
      if (!best || distance < best.distance) best = { approach, streetX, streetY, streetClass, distance };
    }

    if (!best) {
      // First street: leave the town-center tile free and depart from the gate
      // on the side facing the new lot.
      const centerX = Math.floor(city.x), centerY = Math.floor(city.y);
      const approach = approaches.sort((a, b) => Math.hypot(a.x-centerX,a.y-centerY) - Math.hypot(b.x-centerX,b.y-centerY))[0];
      const dx = Math.abs(approach.x-centerX) >= Math.abs(approach.y-centerY) ? Math.sign(approach.x-centerX) : 0;
      const dy = dx === 0 ? Math.sign(approach.y-centerY) : 0;
      const gateX = centerX + (dx || 1), gateY = centerY + dy;
      return { fromX: gateX, fromY: gateY, toX: approach.x, toY: approach.y, streetClass: 'primary', alreadyConnected: false };
    }

    const streetClass: UrbanStreetClass = best.streetClass === 'primary' || best.approach.planned === 'primary' ? 'primary' : 'secondary';
    return { fromX: best.streetX, fromY: best.streetY, toX: best.approach.x, toY: best.approach.y, streetClass, alreadyConnected: false };
  }

  /** Incrementally folds new road tiles into lots/blocks and advances the local signature. */
  public static recordStreetPath(city: City, tileMap: TileMap, path: readonly { x: number; y: number }[], streetClass: UrbanStreetClass): void {
    const cache = URBAN_STRUCTURE_CACHE.get(city);
    if (!cache || cache.map !== tileMap) return;
    for (const point of path) {
      const x = Math.floor(point.x), y = Math.floor(point.y), key = urbanTileKey(tileMap, x, y);
      const planned = plannedStreetAt(city, cache.stage, cache.blockSize, cache.radius, x, y);
      const resolved = streetClass === 'primary' || planned === 'primary' ? 'primary' : 'secondary';
      cache.streets.set(key, resolved);
      const formerLot = cache.lots.get(key);
      if (formerLot) { cache.blocks.get(formerLot.blockId)?.lotKeys.delete(key); cache.lots.delete(key); }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const lot = cache.lots.get(urbanTileKey(tileMap, x + dx, y + dy));
        if (lot && (resolved === 'primary' || lot.streetFrontage === null)) lot.streetFrontage = resolved;
      }
    }
    cache.networkSignature = localNetworkSignature(city, tileMap, cache.radius);
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
