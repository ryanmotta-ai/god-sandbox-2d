import type { Building, BuildingType } from '../civ/Building';
import type { City } from '../civ/City';
import type { BuildingArchitecturalStamp } from '../civ/ArchitecturalProfile';
import { CITY_ASSET_MANIFEST, cityAssetAtlasKey, cityAssetEntry } from '../assets/CityAssetManifest';
import { hashString, hashToUnit } from '../core/Random';
import { districtForBuilding } from '../civ/UrbanDistricts';

/**
 * How much of a tile a building is allowed to take up.
 *
 * Both draw paths used to size a building at a full tile wide — the canvas
 * renderer at `tileSize * levelScale`, the WebGPU one at the asset's own canvas
 * over the manifest's tile pixels — so an ordinary house filled its plot edge to
 * edge and a landmark overflowed onto its neighbours. At that size the street
 * plan, the lot backdrops and the district gaps all disappear behind the
 * silhouettes, and a town reads as one solid mass rather than as buildings with
 * space between them.
 *
 * One constant for both renderers so they cannot drift apart. Existing anchor and
 * offset maths is all relative, so shrinking here re-centres each sprite in its
 * plot and settles it onto the ground without further adjustment.
 */
export const BUILDING_DRAW_SCALE = 0.78;

export interface CityBuildingDecoration {
  atlasKey: string;
  assetId: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

export interface CityBuildingVisual {
  atlasKey: string;
  /** World-tile extent of the source canvas at ART-V1's declared density. */
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  assetId: string | null;
  /** Near-white material cast, multiplied by the WebGPU instance shader. */
  tint: string;
  scale: number;
  decorations: readonly CityBuildingDecoration[];
}

const FALLBACK_VISUAL = { width: 1, height: 1.15, anchorX: .5, anchorY: 1 } as const;

const NORMAL_ASSET: Partial<Record<BuildingType, string>> = {
  town_center: 'city.civic.town_center.large.v01',
  farm: 'city.agriculture.farm.medium.v01',
  granary: 'city.agriculture.granary.medium.v01',
  pasture: 'city.agriculture.pasture.medium.v01',
  lumber_camp: 'city.industrial.lumber_camp.medium.v01',
  quarry: 'city.industrial.quarry.large.v01',
  mine: 'city.industrial.mine.large.v01',
  workshop: 'city.industrial.workshop.medium.v01',
  smithy: 'city.industrial.smithy.medium.v01',
  factory: 'city.industrial.factory.large.v01',
  library: 'city.civic.library.large.v01',
  academy: 'city.civic.academy.large.v01',
  temple: 'city.religious.temple.large.v01',
  market: 'city.commercial.market.medium.v01',
  harbor: 'city.transport.harbor.large.v01',
  bank: 'city.commercial.bank.large.v01',
  port: 'city.transport.port.large.v01',
  barracks: 'city.military.barracks.large.v01',
  keep: 'city.military.keep.landmark.v01',
  palace: 'city.civic.palace.landmark.v01',
  monument: 'city.civic.monument.landmark.v01',
  wall: 'city.walls.segment.linear.v01'
};

const LANDMARK_TYPES = new Set<BuildingType>(['town_center', 'palace', 'keep', 'monument', 'temple', 'library', 'academy']);
const VISUAL_CACHE = new WeakMap<Building, { key: string; visual: CityBuildingVisual }>();

function stableVariant(building: Building, salt: number = 0): number {
  return hashToUnit(hashString(building.id), Math.floor(building.x) + salt * 17, Math.floor(building.y) - salt * 23);
}

function profileStamp(city: City, building: Building): BuildingArchitecturalStamp | null {
  if (building.architecture) return building.architecture;
  const profile = city.architecturalProfile;
  if (!profile) return null;
  return {
    profileId: profile.id,
    sourceRealmId: profile.currentRealmId,
    tradition: profile.primaryTradition,
    secondaryTradition: profile.secondaryTradition,
    primaryMaterial: profile.primaryMaterial,
    secondaryMaterial: profile.secondaryMaterial,
    era: profile.era,
    wealth: profile.wealth,
    spriteTint: profile.palette.spriteTint,
    buildingScale: profile.urbanForm.buildingScale,
    landmarkScale: profile.urbanForm.landmarkScale,
    propDensity: profile.urbanForm.propDensity,
    courtyardRate: profile.urbanForm.courtyardRate,
    stampedYear: building.builtYear
  };
}

function houseAsset(building: Building, variant: number, stamp: BuildingArchitecturalStamp | null): string {
  const phase = building.visualPhase;
  const district = building.urbanContext?.districtType;
  if (district === 'residential_worker' || district === 'periphery') {
    return variant < .3 ? 'city.residential.cabin.small.v01' : variant < .74
      ? 'city.residential.house.small.v01' : 'city.residential.house.small.v02';
  }
  if (district === 'residential_rich') {
    return phase === 'settlement' || phase === 'village'
      ? 'city.residential.house.medium.v01'
      : variant < .72 ? 'city.residential.house.rich.large.v01' : 'city.residential.courtyard.medium.v01';
  }
  if (phase === 'settlement') return variant < .58 ? 'city.residential.cabin.small.v01' : 'city.residential.house.small.v01';
  if (stamp?.wealth === 'poor') return variant < .34 ? 'city.residential.cabin.small.v01' : variant < .72
    ? 'city.residential.house.small.v01' : 'city.residential.house.small.v02';
  if ((phase === 'city' || phase === 'great_city' || phase === 'metropolis') && stamp && variant < stamp.courtyardRate * .48) {
    return 'city.residential.courtyard.medium.v01';
  }
  if (stamp?.wealth === 'wealthy' && (phase === 'great_city' || phase === 'metropolis')) return variant < .68
    ? 'city.residential.house.rich.large.v01' : 'city.residential.house.medium.v01';
  if (phase === 'village') return variant < .5 ? 'city.residential.house.small.v01' : 'city.residential.house.small.v02';
  if (phase === 'city') return building.level >= 2 || variant < .48
    ? 'city.residential.house.medium.v01' : variant < .74 ? 'city.residential.house.small.v01' : 'city.residential.house.small.v02';
  return building.level >= 2 || variant < .56 ? 'city.residential.house.rich.large.v01' : 'city.residential.house.medium.v01';
}

function healthyAsset(city: City, building: Building, variant: number, stamp: BuildingArchitecturalStamp | null): string | null {
  if (building.type === 'wall') {
    if (building.fortificationRole === 'gate') return 'city.military.gatehouse.large.v01';
    if (building.fortificationRole === 'tower') return 'city.military.watchtower.medium.v01';
    if (building.fortificationRole === 'corner') return 'city.walls.corner.linear.v01';
    return 'city.walls.segment.linear.v01';
  }
  if (building.type === 'house') return houseAsset(building, variant, stamp);
  if (building.type === 'market') {
    if (stamp?.wealth === 'poor') return 'city.commercial.shop.small.v01';
    if (stamp?.tradition === 'mercantile' && variant < .24) return 'city.commercial.inn.medium.v01';
    return variant < .5 ? 'city.commercial.market.medium.v01' : 'city.commercial.market.medium.v02';
  }
  if (building.type === 'farm') return variant < .5 ? 'city.agriculture.farm.medium.v01' : 'city.agriculture.farm.medium.v02';
  if (building.type === 'temple' && (building.visualPhase === 'settlement' || building.visualPhase === 'village') && stamp?.wealth !== 'wealthy') {
    return 'city.religious.shrine.small.v01';
  }
  return NORMAL_ASSET[building.type] ?? null;
}

function damagedAsset(building: Building, hpRatio: number): string | null {
  if (building.type === 'house') return hpRatio <= .32 ? 'city.residential.house.ruined.v01' : 'city.residential.house.damaged.v01';
  if (building.type === 'town_center') return 'city.civic.town_center.damaged.v01';
  if (building.type === 'temple') return 'city.religious.temple.damaged.v01';
  if (building.type === 'keep' && hpRatio <= .5) return 'city.military.keep.ruined.v01';
  if (building.type === 'wall') return hpRatio <= .32 ? 'city.walls.segment.ruined.v01' : 'city.walls.segment.damaged.v01';
  return null;
}

function ruinedAsset(building: Building): string {
  if (building.type === 'house') {
    return building.lastDamageCause === 'fire'
      ? 'city.ruins.burned_house.small.v01'
      : 'city.residential.house.ruined.v01';
  }
  if (building.type === 'wall') return 'city.walls.segment.ruined.v01';
  if (building.type === 'keep') return 'city.military.keep.ruined.v01';
  if (building.type === 'monument') return 'city.ruins.monument.large.v01';
  return 'city.ruins.rubble.small.v01';
}

function decorationAsset(city: City, building: Building, stamp: BuildingArchitecturalStamp | null): string | null {
  if (building.lifecycleState === 'construction' || building.lifecycleState === 'reconstruction') return null;
  if (building.lifecycleState === 'abandoned' || building.lifecycleState === 'ruin') {
    if (building.natureReclaim < .24) return null;
    return stableVariant(building, 91) < .58
      ? 'city.props.shrub_planter.prop.v01'
      : 'city.props.tree_deciduous.prop.v01';
  }
  if (building.fortificationRole) return null;
  const district = districtForBuilding(city, building);
  if (district?.anchorBuildingId === building.id) {
    if (district.type === 'railway') {
      return ['factory', 'refinery', 'workshop', 'smithy'].includes(building.type)
        ? 'city.transport.rail_depot.large.v01'
        : 'city.transport.rail_station.large.v01';
    }
    if (district.type === 'port' || district.type === 'industrial') return 'city.commercial.warehouse.large.v01';
  }
  const supportsMarketProps = building.type === 'market'
    || building.type === 'bank'
    || building.type === 'stock_exchange'
    || building.type === 'house';
  if ((district?.type === 'commercial' || district?.type === 'historic_core') && supportsMarketProps) {
    return stableVariant(building, 72) < .58 ? 'city.props.market_stall.small.v01' : 'city.props.crates.prop.v01';
  }
  if (district?.type === 'residential_rich' && building.type === 'house') {
    return stableVariant(building, 72) < .55 ? 'city.props.shrub_planter.prop.v01' : 'city.props.tree_deciduous.prop.v01';
  }
  if (district?.type === 'residential_worker' && building.type === 'house') {
    return stableVariant(building, 72) < .62 ? 'city.props.fence.linear.v01' : 'city.props.well.prop.v01';
  }
  if (!stamp || stableVariant(building, 71) > stamp.propDensity) return null;
  const variant = stableVariant(building, 72);
  if (building.type === 'market' || building.type === 'bank') {
    return variant < .42 ? 'city.props.market_stall.small.v01' : variant < .72 ? 'city.props.crates.prop.v01' : 'city.props.cart.prop.v01';
  }
  if (building.type === 'town_center' || building.type === 'palace' || building.type === 'temple') {
    if (stamp.era === 'industrial' || stamp.era === 'modern') return variant < .45 ? 'city.props.lamp.prop.v01' : 'city.props.shrub_planter.prop.v01';
    return variant < .5 ? 'city.props.well.prop.v01' : 'city.props.tree_deciduous.prop.v01';
  }
  if (building.type === 'house') {
    if (stamp.tradition === 'woodland' || stamp.primaryMaterial === 'timber') return 'city.props.tree_deciduous.prop.v01';
    if (stamp.wealth === 'wealthy' || stamp.courtyardRate > .5) return 'city.props.shrub_planter.prop.v01';
    return variant < .62 ? 'city.props.fence.linear.v01' : 'city.props.well.prop.v01';
  }
  if (['workshop', 'smithy', 'factory', 'mine', 'quarry', 'lumber_camp'].includes(building.type)) {
    return variant < .62 ? 'city.props.crates.prop.v01' : 'city.props.cart.prop.v01';
  }
  if (building.type === 'farm' || building.type === 'pasture' || building.type === 'granary') {
    return variant < .7 ? 'city.props.fence.linear.v01' : 'city.props.cart.prop.v01';
  }
  if (city.architecturalProfile?.coastal && (building.type === 'harbor' || building.type === 'port')) return 'city.props.crates.prop.v01';
  return null;
}

function decoration(city: City, building: Building, stamp: BuildingArchitecturalStamp | null): CityBuildingDecoration[] {
  const assetId = decorationAsset(city, building, stamp);
  if (!assetId) return [];
  const entry = cityAssetEntry(assetId), atlasKey = cityAssetAtlasKey(assetId);
  if (!entry || !atlasKey) return [];
  const sourcePixelsPerTile = CITY_ASSET_MANIFEST.tilePixels;
  const isRailLandmark = assetId.includes('rail_station') || assetId.includes('rail_depot');
  const isWarehouse = assetId.includes('warehouse');
  const scale = isRailLandmark ? .62 : isWarehouse ? .58 : 1;
  const side = (stableVariant(building, 73) < .5 ? -1 : 1) * (isRailLandmark ? .95 : isWarehouse ? .78 : .42);
  return [{
    atlasKey, assetId, offsetX: side, offsetY: .22,
    width: entry.canvas[0] / sourcePixelsPerTile * scale,
    height: entry.canvas[1] / sourcePixelsPerTile * scale,
    anchorX: entry.anchor[0], anchorY: entry.anchor[1]
  }];
}

/**
 * Separates economic Building identity from a stable historical visual. Asset,
 * material, scale and prop choices depend on the construction/renovation stamp,
 * never on a render-frame random value.
 */
export function resolveCityBuildingVisual(city: City, building: Building, fallbackAtlasKey: string): CityBuildingVisual {
  const hpRatio = building.maxHp > 0 ? building.hp / building.maxHp : 1;
  const variant = stableVariant(building);
  const stamp = profileStamp(city, building);
  const lifecycleBand = building.lifecycleState === 'construction' || building.lifecycleState === 'reconstruction'
    ? Math.floor(building.lifecycleProgress * 3)
    : building.lifecycleState;
  const damageBand = hpRatio <= .32 ? 'ruined' : hpRatio <= .68 ? 'damaged' : 'healthy';
  const urban = building.urbanContext;
  const cacheKey = `${fallbackAtlasKey}|${damageBand}:${lifecycleBand}:n${Math.floor(building.natureReclaim * 4)}|${building.level}|${building.visualPhase}|${building.fortificationRole ?? '-'}|${urban?.districtType ?? '-'}:${urban ? Math.round(urban.affluence * 4) : '-'}|d${city.districtVersion}|${stamp?.profileId ?? city.architecturalProfile?.id ?? '-'}`;
  const cached = VISUAL_CACHE.get(building);
  if (cached?.key === cacheKey) return cached.visual;
  let assetId: string | null;
  if (building.lifecycleState === 'ruin') assetId = ruinedAsset(building);
  else if ((building.lifecycleState === 'construction' || building.lifecycleState === 'reconstruction') && building.lifecycleProgress < .36) {
    assetId = 'city.ruins.rubble.small.v01';
  } else if (building.lifecycleState === 'abandoned') {
    assetId = damagedAsset(building, .5) ?? healthyAsset(city, building, variant, stamp);
  } else {
    assetId = hpRatio <= .68 ? damagedAsset(building, hpRatio) : healthyAsset(city, building, variant, stamp);
  }
  const decorations = decoration(city, building, stamp);
  const fortificationScale = building.fortificationRole === 'gate' ? 1.13 : building.fortificationRole === 'tower' ? 1.07 : .96;
  const lifecycleScale = building.lifecycleState === 'construction' || building.lifecycleState === 'reconstruction'
    ? .5 + building.lifecycleProgress * .5
    : building.lifecycleState === 'ruin' ? .88 : 1;
  const scale = (stamp?.buildingScale ?? 1)
    * (LANDMARK_TYPES.has(building.type) ? stamp?.landmarkScale ?? 1 : 1)
    * (building.fortificationRole ? fortificationScale : 1)
    * lifecycleScale;
  const tint = building.lifecycleState === 'abandoned' ? '#929985'
    : building.lifecycleState === 'construction' || building.lifecycleState === 'reconstruction' ? '#d5c8ad'
    : building.lifecycleState === 'ruin' ? '#b0a18e'
    : stamp?.spriteTint ?? '#ffffff';
  if (!assetId) {
    const visual = { atlasKey: fallbackAtlasKey, ...FALLBACK_VISUAL, assetId: null, tint, scale, decorations };
    VISUAL_CACHE.set(building, { key: cacheKey, visual });
    return visual;
  }
  const entry = cityAssetEntry(assetId);
  const atlasKey = cityAssetAtlasKey(assetId);
  if (!entry || !atlasKey) {
    const visual = { atlasKey: fallbackAtlasKey, ...FALLBACK_VISUAL, assetId: null, tint, scale, decorations };
    VISUAL_CACHE.set(building, { key: cacheKey, visual });
    return visual;
  }
  const sourcePixelsPerTile = CITY_ASSET_MANIFEST.tilePixels;
  const visual: CityBuildingVisual = {
    atlasKey,
    width: entry.canvas[0] / sourcePixelsPerTile,
    height: entry.canvas[1] / sourcePixelsPerTile,
    anchorX: entry.anchor[0],
    anchorY: entry.anchor[1],
    assetId,
    tint,
    scale,
    decorations
  };
  VISUAL_CACHE.set(building, { key: cacheKey, visual });
  return visual;
}
