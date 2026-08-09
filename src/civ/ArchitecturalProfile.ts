import type { City } from './City';
import type { Kingdom } from './Kingdom';
import type { CulturalProfile } from './Culture';
import type { TechEra } from './TechTree';
import type { TileMap } from '../world/TileMap';
import { TerrainType } from '../world/Biomes';
import { hashString, hashToUnit } from '../core/Random';

export type ArchitecturalTradition =
  | 'vernacular'
  | 'agrarian'
  | 'woodland'
  | 'highland'
  | 'riverine'
  | 'maritime'
  | 'mercantile'
  | 'civic_monumental'
  | 'martial'
  | 'industrial';

export type ArchitecturalMaterial = 'timber' | 'stone' | 'brick' | 'plaster' | 'tile' | 'thatch';
export type ArchitecturalClimate = 'cold' | 'temperate' | 'warm_dry' | 'warm_humid';
export type ArchitecturalWealth = 'poor' | 'modest' | 'prosperous' | 'wealthy';

export interface ArchitecturalInfluence {
  readonly realmId: string;
  readonly weight: number;
  readonly kind: 'local' | 'metropole' | 'former_ruler' | 'trade';
}

export interface ArchitecturalUrbanForm {
  /** Soft occupied-lot target used by CITY-V1's planner. */
  readonly density: number;
  /** Visual road-width multiplier; roads remain one logical tile. */
  readonly streetWidth: number;
  /** 0..1 amount of deterministic deviation in secondary streets. */
  readonly irregularity: number;
  /** -1..1 adjustment to the existing tier-derived block size. */
  readonly blockScale: number;
  readonly buildingScale: number;
  readonly openSpace: number;
  readonly courtyardRate: number;
  readonly propDensity: number;
  readonly landmarkScale: number;
  readonly roadPreference: number;
}

export interface ArchitecturalProfile {
  readonly schema: 1;
  readonly id: string;
  readonly citySeed: number;
  readonly foundingRealmId: string | null;
  readonly currentRealmId: string | null;
  readonly primaryTradition: ArchitecturalTradition;
  readonly secondaryTradition: ArchitecturalTradition;
  readonly primaryMaterial: ArchitecturalMaterial;
  readonly secondaryMaterial: ArchitecturalMaterial;
  readonly biome: TerrainType;
  readonly climate: ArchitecturalClimate;
  readonly wealth: ArchitecturalWealth;
  readonly era: TechEra;
  readonly coastal: boolean;
  readonly urbanForm: ArchitecturalUrbanForm;
  readonly palette: {
    readonly spriteTint: string;
    readonly groundTint: string;
    readonly accent: string;
  };
  readonly influences: readonly ArchitecturalInfluence[];
  /** CITY-V4 extension point; no fortification mechanics are implemented here. */
  readonly fortificationFamily: `${ArchitecturalTradition}:${ArchitecturalMaterial}`;
  readonly signature: string;
  readonly revision: number;
  readonly updatedYear: number;
}

export interface BuildingArchitecturalStamp {
  readonly profileId: string;
  readonly sourceRealmId: string | null;
  readonly tradition: ArchitecturalTradition;
  readonly secondaryTradition: ArchitecturalTradition;
  readonly primaryMaterial: ArchitecturalMaterial;
  readonly secondaryMaterial: ArchitecturalMaterial;
  readonly era: TechEra;
  readonly wealth: ArchitecturalWealth;
  readonly spriteTint: string;
  readonly buildingScale: number;
  readonly landmarkScale: number;
  readonly propDensity: number;
  readonly courtyardRate: number;
  readonly stampedYear: number;
}

interface LocalEnvironment {
  biome: TerrainType;
  temperature: number;
  moisture: number;
  coastal: boolean;
  wooded: number;
  mountainous: number;
  fertile: number;
  waterside: number;
}

const MATERIAL_TINT: Record<ArchitecturalMaterial, string> = {
  timber: '#f4e5cf', stone: '#e4e7e8', brick: '#f3d5c8', plaster: '#fff0cf', tile: '#f2ddd2', thatch: '#efe2b9'
};

const GROUND_TINT: Record<ArchitecturalMaterial, string> = {
  timber: '#8f785d', stone: '#85878a', brick: '#9b6858', plaster: '#b89f75', tile: '#966f63', thatch: '#9c8a5e'
};

const ERA_ORDER: readonly TechEra[] = ['stone', 'bronze', 'iron', 'classical', 'industrial', 'modern'];

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function band(value: number, steps: number = 4): number { return Math.max(0, Math.min(steps, Math.round(value * steps))); }

function surveyEnvironment(city: City, tileMap: TileMap): LocalEnvironment {
  const counts = new Map<TerrainType, number>();
  let temperature = 0, moisture = 0, samples = 0, wooded = 0, mountainous = 0, fertile = 0, waterside = 0;
  let coastal = false;
  for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
    if (dx * dx + dy * dy > 20) continue;
    const tile = tileMap.getTile(Math.floor(city.x + dx), Math.floor(city.y + dy));
    if (!tile) continue;
    counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1);
    temperature += tile.temperature; moisture += tile.moisture; fertile += tile.fertility; samples++;
    if (tile.type === TerrainType.FOREST) wooded++;
    if (tile.type === TerrainType.MOUNTAIN) mountainous++;
    if (tile.type === TerrainType.SHALLOW_WATER || tile.type === TerrainType.DEEP_OCEAN) waterside++;
    if (!coastal && tileMap.isCoastalLand(tile.x, tile.y)) coastal = true;
  }
  const biome = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? TerrainType.GRASS;
  const divisor = Math.max(1, samples);
  return {
    biome, temperature: temperature / divisor, moisture: moisture / divisor, coastal,
    wooded: wooded / divisor, mountainous: mountainous / divisor,
    fertile: fertile / divisor, waterside: waterside / divisor
  };
}

function climateFor(environment: LocalEnvironment): ArchitecturalClimate {
  if (environment.temperature < 7) return 'cold';
  if (environment.temperature > 25 && environment.moisture < .42) return 'warm_dry';
  if (environment.temperature > 22 && environment.moisture >= .42) return 'warm_humid';
  return 'temperate';
}

function wealthFor(prosperity: number): ArchitecturalWealth {
  if (prosperity < .3) return 'poor';
  if (prosperity < .56) return 'modest';
  if (prosperity < .78) return 'prosperous';
  return 'wealthy';
}

function blendedCulture(kingdom: Kingdom | null, metropole: Kingdom | null): CulturalProfile | null {
  if (!kingdom) return null;
  if (!metropole || !kingdom.isColony) return kingdom.culture;
  const localWeight = clamp01(.2 + kingdom.colonialIdentity * .65);
  const result = { ...kingdom.culture, memories: [...kingdom.culture.memories] };
  const numeric = ['militarism', 'expansionism', 'tradition', 'authority', 'openness', 'mercantilism', 'stewardship', 'innovation', 'collectivism', 'warTrauma', 'diplomaticTrust'] as const;
  for (const key of numeric) result[key] = kingdom.culture[key] * localWeight + metropole.culture[key] * (1 - localWeight);
  return result;
}

function chooseTraditions(city: City, environment: LocalEnvironment, culture: CulturalProfile | null, era: TechEra): [ArchitecturalTradition, ArchitecturalTradition] {
  const seed = hashString(city.id);
  const industrialBuildings = city.countOfType('factory') + city.countOfType('refinery') + city.countOfType('smithy') + city.countOfType('workshop');
  const maritimeBuildings = city.countOfType('harbor') + city.countOfType('port');
  const agrarianBuildings = city.countOfType('farm') + city.countOfType('pasture') + city.countOfType('granary');
  const civicBuildings = city.countOfType('palace') + city.countOfType('monument') + city.countOfType('academy') + city.countOfType('library');
  const scores: Record<ArchitecturalTradition, number> = {
    vernacular: .45,
    agrarian: environment.fertile * .72 + (1 - city.prosperity) * .18 + Math.min(.45, agrarianBuildings * .06),
    woodland: environment.wooded * 1.9 + (culture?.stewardship ?? .45) * .42,
    highland: environment.mountainous * 2.1 + (culture?.tradition ?? .5) * .28,
    riverine: environment.waterside * 1.1 + environment.moisture * .42,
    maritime: (environment.coastal ? .9 : 0) + (culture?.openness ?? .5) * .24 + Math.min(.5, maritimeBuildings * .18),
    mercantile: (culture?.mercantilism ?? .4) * .8 + (culture?.openness ?? .5) * .25 + city.prosperity * .24 + Math.min(.35, city.countOfType('market') * .1),
    civic_monumental: (culture?.authority ?? .45) * .55 + (culture?.tradition ?? .5) * .35 + city.prosperity * .24 + Math.min(.4, civicBuildings * .08),
    martial: (culture?.militarism ?? .35) * .85 + (culture?.authority ?? .45) * .2,
    industrial: (ERA_ORDER.indexOf(era) >= ERA_ORDER.indexOf('industrial') ? .72 : 0) + (culture?.innovation ?? .4) * .42 + Math.min(.55, industrialBuildings * .09)
  };
  for (const [index, key] of (Object.keys(scores) as ArchitecturalTradition[]).entries()) {
    scores[key] += hashToUnit(seed, index, city.foundingYear) * .08;
  }
  const sorted = (Object.entries(scores) as Array<[ArchitecturalTradition, number]>).sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[1][0]];
}

function chooseMaterials(city: City, environment: LocalEnvironment, climate: ArchitecturalClimate, era: TechEra): [ArchitecturalMaterial, ArchitecturalMaterial] {
  const industrial = ERA_ORDER.indexOf(era) >= ERA_ORDER.indexOf('industrial');
  const scores: Record<ArchitecturalMaterial, number> = {
    timber: .25 + environment.wooded * 1.4,
    stone: .3 + environment.mountainous * 1.65 + (climate === 'cold' ? .35 : 0),
    brick: .2 + (industrial ? .75 : 0) + (environment.biome === TerrainType.SOIL ? .22 : 0),
    plaster: .18 + (climate === 'warm_dry' ? .82 : 0),
    tile: .22 + (city.prosperity > .58 ? .3 : 0) + (climate === 'warm_humid' ? .2 : 0),
    thatch: .22 + environment.fertile * .38 + (city.prosperity < .35 ? .38 : 0)
  };
  const sorted = (Object.entries(scores) as Array<[ArchitecturalMaterial, number]>).sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[1][0]];
}

function influencesFor(city: City, kingdom: Kingdom | null, metropole: Kingdom | null): ArchitecturalInfluence[] {
  const weights = new Map<string, ArchitecturalInfluence>();
  if (kingdom) weights.set(kingdom.id, { realmId: kingdom.id, weight: kingdom.isColony ? .35 + kingdom.colonialIdentity * .35 : .72, kind: 'local' });
  if (metropole && kingdom?.isColony) weights.set(metropole.id, { realmId: metropole.id, weight: .62 - kingdom.colonialIdentity * .34, kind: 'metropole' });
  const previous = city.architecturalProfile;
  if (previous?.currentRealmId && previous.currentRealmId !== kingdom?.id && !weights.has(previous.currentRealmId)) {
    weights.set(previous.currentRealmId, { realmId: previous.currentRealmId, weight: city.capturedYear ? .25 : .16, kind: 'former_ruler' });
  }
  for (const old of previous?.influences ?? []) {
    if (!weights.has(old.realmId) && weights.size < 3) weights.set(old.realmId, { ...old, weight: Math.min(.16, old.weight) });
  }
  const values = [...weights.values()];
  const total = values.reduce((sum, influence) => sum + influence.weight, 0) || 1;
  return values.map(influence => ({ ...influence, weight: Math.round(influence.weight / total * 100) / 100 }));
}

function urbanFormFor(
  city: City,
  tradition: ArchitecturalTradition,
  climate: ArchitecturalClimate,
  culture: CulturalProfile | null,
  wealth: ArchitecturalWealth
): ArchitecturalUrbanForm {
  const wealthy = wealth === 'wealthy' ? 1 : wealth === 'prosperous' ? .66 : wealth === 'modest' ? .33 : 0;
  const orderly = (culture?.authority ?? .45) * .36 + (culture?.tradition ?? .5) * .24;
  const openness = culture?.openness ?? .5;
  const denseTradition = tradition === 'mercantile' || tradition === 'industrial' || tradition === 'civic_monumental';
  const openTradition = tradition === 'agrarian' || tradition === 'woodland' || tradition === 'maritime';
  const climateOpen = climate === 'warm_dry' || climate === 'warm_humid';
  const openSpace = clamp01(.2 + (openTradition ? .2 : 0) + (climateOpen ? .1 : 0) + wealthy * .08 - (denseTradition ? .12 : 0));
  return {
    density: clamp01(.37 + (denseTradition ? .18 : 0) - openSpace * .15 + city.prosperity * .08),
    streetWidth: .84 + (tradition === 'civic_monumental' ? .22 : 0) + (tradition === 'mercantile' ? .1 : 0) + wealthy * .08,
    irregularity: clamp01(.62 - orderly + (tradition === 'woodland' || tradition === 'riverine' ? .22 : 0)),
    blockScale: clamp01(.38 + orderly + openSpace * .28) * 2 - 1,
    buildingScale: .9 + wealthy * .12 + (denseTradition ? .04 : 0),
    openSpace,
    courtyardRate: clamp01(.08 + openSpace * .5 + (climateOpen ? .18 : 0) + wealthy * .12),
    propDensity: clamp01(.16 + openSpace * .25 + wealthy * .24 + (culture?.stewardship ?? .45) * .2),
    landmarkScale: .96 + wealthy * .18 + (tradition === 'civic_monumental' || tradition === 'martial' ? .13 : 0),
    roadPreference: clamp01(.54 + openness * .18 + (tradition === 'mercantile' ? .22 : 0))
  };
}

function profileSignature(city: City, kingdom: Kingdom | null, metropole: Kingdom | null, environment: LocalEnvironment, climate: ArchitecturalClimate, wealth: ArchitecturalWealth, era: TechEra): string {
  const culture = kingdom?.culture;
  const economicRole = [
    city.countOfType('harbor') + city.countOfType('port'),
    city.countOfType('factory') + city.countOfType('refinery') + city.countOfType('smithy') + city.countOfType('workshop'),
    city.countOfType('farm') + city.countOfType('pasture') + city.countOfType('granary'),
    city.countOfType('market') + city.countOfType('bank')
  ].map(value => Math.min(3, value)).join(',');
  return [
    city.kingdomId ?? '-', metropole?.id ?? '-', city.formerOwnerId ?? '-', era, environment.biome, climate, wealth,
    environment.coastal ? 1 : 0, band(environment.wooded), band(environment.mountainous),
    band(culture?.militarism ?? .4), band(culture?.tradition ?? .5), band(culture?.openness ?? .5),
    band(culture?.mercantilism ?? .4), band(culture?.stewardship ?? .45), band(culture?.innovation ?? .4),
    band(kingdom?.colonialIdentity ?? 1), city.currentUrbanGeneration, Math.min(3, city.famineYears), economicRole
  ].join('|');
}

/**
 * Recomputes only on the yearly structural pass and only replaces the profile
 * when a discrete architectural input crosses a band. Render frames merely
 * read the persisted result.
 */
export function refreshArchitecturalProfile(city: City, kingdom: Kingdom | null, tileMap: TileMap, year: number, metropole: Kingdom | null = null): boolean {
  const environment = surveyEnvironment(city, tileMap);
  const climate = climateFor(environment);
  const wealth = wealthFor(city.prosperity);
  const era = kingdom?.operatingEra ?? kingdom?.research.currentEra() ?? 'stone';
  const signature = profileSignature(city, kingdom, metropole, environment, climate, wealth, era);
  if (city.architecturalProfile?.signature === signature) return false;

  const culture = blendedCulture(kingdom, metropole);
  const [primaryTradition, secondaryTradition] = chooseTraditions(city, environment, culture, era);
  const [primaryMaterial, secondaryMaterial] = chooseMaterials(city, environment, climate, era);
  const urbanForm = urbanFormFor(city, primaryTradition, climate, culture, wealth);
  const revision = (city.architecturalProfile?.revision ?? 0) + 1;
  const citySeed = hashString(city.id) >>> 0;
  city.architecturalProfile = {
    schema: 1,
    id: `architecture:${city.id}:${(hashString(signature) >>> 0).toString(36)}`,
    citySeed,
    foundingRealmId: city.architecturalProfile?.foundingRealmId ?? kingdom?.id ?? null,
    currentRealmId: kingdom?.id ?? null,
    primaryTradition,
    secondaryTradition,
    primaryMaterial,
    secondaryMaterial,
    biome: environment.biome,
    climate,
    wealth,
    era,
    coastal: environment.coastal,
    urbanForm,
    palette: {
      spriteTint: MATERIAL_TINT[primaryMaterial],
      groundTint: GROUND_TINT[primaryMaterial],
      accent: kingdom?.secondaryColor ?? '#d6b36a'
    },
    influences: influencesFor(city, kingdom, metropole),
    fortificationFamily: `${primaryTradition}:${primaryMaterial}`,
    signature,
    revision,
    updatedYear: year
  };
  city.architecturalVersion++;
  return true;
}

export function buildingArchitecturalStamp(profile: ArchitecturalProfile, stampedYear: number): BuildingArchitecturalStamp {
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
    stampedYear
  };
}

export function architecturalProfileIsValid(value: unknown): value is ArchitecturalProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ArchitecturalProfile>;
  return candidate.schema === 1 && typeof candidate.id === 'string' && typeof candidate.signature === 'string'
    && !!candidate.urbanForm && !!candidate.palette;
}
