import type { Building, BuildingType } from './Building';
import type { City } from './City';
import type { Kingdom } from './Kingdom';
import type { GoodId } from './Goods';
import type { TileMap } from '../world/TileMap';
import { TERRAINS, TerrainType } from '../world/Biomes';
import { RegionState } from '../world/WorldChunks';
import { hashString, hashToUnit } from '../core/Random';
import { pointInsideFortification } from './FortificationPlanner';

export type UrbanDistrictType =
  | 'historic_core'
  | 'residential_common'
  | 'residential_rich'
  | 'residential_worker'
  | 'commercial'
  | 'artisan'
  | 'civic'
  | 'religious'
  | 'industrial'
  | 'railway'
  | 'port'
  | 'military'
  | 'periphery'
  | 'rural';

export type UrbanSpecializationType =
  | 'mixed'
  | 'agricultural'
  | 'mining'
  | 'industrial'
  | 'port'
  | 'commercial'
  | 'administrative'
  | 'rail_hub'
  | 'military';

export interface UrbanDistrictTransition {
  type: UrbanDistrictType;
  fromYear: number;
  toYear: number;
}

/** Compact, persistent functional cell. It is evidence, not an imposed zone. */
export interface UrbanDistrictCell {
  schema: 1;
  id: string;
  gx: number;
  gy: number;
  centerX: number;
  centerY: number;
  type: UrbanDistrictType;
  secondaryType: UrbanDistrictType | null;
  dominance: number;
  landValue: number;
  desirability: number;
  accessibility: number;
  density: number;
  affluence: number;
  pollution: number;
  foundedYear: number;
  lastChangedYear: number;
  updatedYear: number;
  anchorBuildingId: string | null;
  buildingCount: number;
  history: UrbanDistrictTransition[];
}

export interface UrbanSpecialization {
  schema: 1;
  type: UrbanSpecializationType;
  strength: number;
  updatedYear: number;
  evidence: string[];
}

export interface BuildingUrbanContext {
  districtType: UrbanDistrictType;
  landValue: number;
  desirability: number;
  accessibility: number;
  density: number;
  affluence: number;
  stampedYear: number;
}

export interface DistrictMetrics {
  districts: number;
  types: Partial<Record<UrbanDistrictType, number>>;
  meanLandValue: number;
  meanDensity: number;
  specialization: UrbanSpecializationType;
}

interface RuntimeDistrictCache {
  map: TileMap;
  byId: Map<string, UrbanDistrictCell>;
  dirty: Set<string>;
  buildingPositions: Map<string, string>;
  buildingVersion: number;
  networkSignature: string;
  economySignature: string;
  lastUpdateYear: number;
  rotation: number;
}

interface DistrictEvidence {
  scores: Record<UrbanDistrictType, number>;
  landValue: number;
  desirability: number;
  accessibility: number;
  density: number;
  affluence: number;
  pollution: number;
  anchorBuildingId: string | null;
  buildingCount: number;
}

const CELL_SIZE = 5;
const INFLUENCE_RADIUS = 7.5;
const DISTRICT_TYPES: readonly UrbanDistrictType[] = [
  'historic_core', 'residential_common', 'residential_rich', 'residential_worker',
  'commercial', 'artisan', 'civic', 'religious', 'industrial', 'railway', 'port',
  'military', 'periphery', 'rural'
];
const RUNTIME = new WeakMap<City, RuntimeDistrictCache>();
const WEALTH_SCORE = { poor: .18, modest: .4, prosperous: .68, wealthy: .9 } as const;
const INDUSTRIAL_GOODS = new Set<GoodId>(['steel', 'tools', 'fuel', 'gunpowder', 'machinery', 'cloth', 'bronze']);
const RAW_EXTRACTIVE_GOODS = new Set<GoodId>(['wood', 'stone', 'clay', 'copper', 'tin', 'iron', 'coal', 'salt', 'gold', 'gems', 'oil', 'saltpeter', 'rubber', 'uranium']);

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function cellCoords(x: number, y: number): { gx: number; gy: number } { return { gx: Math.floor(x / CELL_SIZE), gy: Math.floor(y / CELL_SIZE) }; }
function cellId(city: City, gx: number, gy: number): string { return `district:${city.id}:${gx}:${gy}`; }
function cellCenter(gx: number, gy: number): { x: number; y: number } { return { x: gx * CELL_SIZE + CELL_SIZE * .5, y: gy * CELL_SIZE + CELL_SIZE * .5 }; }

function blankScores(): Record<UrbanDistrictType, number> {
  return Object.fromEntries(DISTRICT_TYPES.map(type => [type, 0])) as Record<UrbanDistrictType, number>;
}

function buildingCell(city: City, building: Building): string {
  const { gx, gy } = cellCoords(building.x, building.y); return cellId(city, gx, gy);
}

function ensureRuntime(city: City, map: TileMap): RuntimeDistrictCache {
  let runtime = RUNTIME.get(city);
  if (!runtime || runtime.map !== map) {
    const byId = new Map(city.urbanDistricts.map(district => [district.id, district]));
    runtime = {
      map,
      byId,
      dirty: new Set(),
      buildingPositions: new Map([...city.buildings.values()].map(building => [building.id, buildingCell(city, building)])),
      buildingVersion: city.buildingVersion,
      networkSignature: '', economySignature: '', lastUpdateYear: -Infinity, rotation: 0
    };
    RUNTIME.set(city, runtime);
  }
  return runtime;
}

function localNetworkSignature(city: City, map: TileMap, radius: number): string {
  const minCX = Math.max(0, Math.floor((city.x - radius) / map.chunkSize));
  const maxCX = Math.min(map.chunkStore.chunksX - 1, Math.floor((city.x + radius) / map.chunkSize));
  const minCY = Math.max(0, Math.floor((city.y - radius) / map.chunkSize));
  const maxCY = Math.min(map.chunkStore.chunksY - 1, Math.floor((city.y + radius) / map.chunkSize));
  const parts: string[] = [];
  for (let cx = minCX; cx <= maxCX; cx++) for (let cy = minCY; cy <= maxCY; cy++) {
    const chunk = map.chunkStore.getChunk(cx, cy);
    if (chunk) parts.push(`${cx}:${cy}:${chunk.roadVersion}:${chunk.railVersion}:${chunk.terrainVersion}`);
  }
  return parts.join('|');
}

function economySignature(city: City): string {
  let produced = 0, traded = 0, industrial = 0, raw = 0;
  for (const good of city.ledger.goods()) {
    const flow = city.ledger.flow(good);
    produced += flow.produced;
    traded += flow.imported + flow.exported;
    if (INDUSTRIAL_GOODS.has(good)) industrial += flow.produced;
    if (RAW_EXTRACTIVE_GOODS.has(good)) raw += flow.produced;
  }
  return `${Math.round(city.prosperity * 10)}:${Math.round(produced / 10)}:${Math.round(traded / 10)}:${Math.round(industrial / 5)}:${Math.round(raw / 5)}:${city.besiegerId ? 1 : 0}`;
}

function updateIntervals(state: RegionState): { interval: number; budget: number } {
  if (state === RegionState.ACTIVE) return { interval: 2, budget: 18 };
  if (state === RegionState.WARM) return { interval: 6, budget: 7 };
  return { interval: 18, budget: 3 };
}

function addCellAndNeighbours(city: City, target: Set<string>, gx: number, gy: number, reach: number = 1): void {
  for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
    target.add(cellId(city, gx + dx, gy + dy));
  }
}

function parseCellId(id: string): { gx: number; gy: number } {
  const parts = id.split(':');
  return { gx: Number(parts[parts.length - 2]), gy: Number(parts[parts.length - 1]) };
}

function collectRelevantCells(city: City, map: TileMap, radius: number, target: Set<string>): void {
  for (const building of city.buildings.values()) {
    if (building.fortificationRole) continue;
    const { gx, gy } = cellCoords(building.x, building.y);
    addCellAndNeighbours(city, target, gx, gy, city.tier === 'city' || city.tier === 'metropolis' ? 1 : 0);
  }
  const center = cellCoords(city.x, city.y); addCellAndNeighbours(city, target, center.gx, center.gy, 1);
  const minX = Math.max(0, Math.floor(city.x - radius)), maxX = Math.min(map.width - 1, Math.ceil(city.x + radius));
  const minY = Math.max(0, Math.floor(city.y - radius)), maxY = Math.min(map.height - 1, Math.ceil(city.y + radius));
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    if (Math.hypot(x - city.x, y - city.y) > radius) continue;
    const tile = map.getTile(x, y);
    if (!tile) continue;
    if (tile.railLevelEffective > 0 || (tile.roadTraffic >= 100 && tile.roadLevelEffective >= 2)) {
      const { gx, gy } = cellCoords(x, y); addCellAndNeighbours(city, target, gx, gy, 1);
    }
  }
}

function ledgerSignals(city: City): { agricultural: number; extractive: number; industrial: number; trade: number } {
  let agricultural = 0, extractive = 0, industrial = 0, trade = 0;
  for (const good of city.ledger.goods()) {
    const flow = city.ledger.flow(good);
    if (good === 'food' || good === 'cotton' || good === 'spices' || good === 'horses' || good === 'furs') agricultural += flow.produced;
    if (RAW_EXTRACTIVE_GOODS.has(good)) extractive += flow.produced;
    if (INDUSTRIAL_GOODS.has(good)) industrial += flow.produced;
    trade += flow.imported + flow.exported;
  }
  const scale = Math.max(8, city.population * .3);
  return {
    agricultural: clamp01(agricultural / scale), extractive: clamp01(extractive / scale),
    industrial: clamp01(industrial / scale), trade: clamp01(trade / scale)
  };
}

function addBuildingEvidence(scores: Record<UrbanDistrictType, number>, building: Building, weight: number): void {
  const type = building.type;
  if (type === 'house' || type === 'aqueduct' || type === 'grand_aqueduct') scores.residential_common += 1.4 * weight;
  if (type === 'market' || type === 'bank' || type === 'stock_exchange' || type === 'collective') scores.commercial += 1.8 * weight;
  if (type === 'workshop' || type === 'smithy') scores.artisan += 1.75 * weight;
  if (type === 'factory' || type === 'refinery' || type === 'oil_well') scores.industrial += 2.3 * weight;
  if (type === 'town_center' || type === 'palace' || type === 'monument' || type === 'library' || type === 'academy' || type === 'great_library' || type === 'colosseum') scores.civic += 1.8 * weight;
  if (type === 'temple') scores.religious += 2.1 * weight;
  if (type === 'harbor' || type === 'port') scores.port += 2.7 * weight;
  if (type === 'barracks' || type === 'keep' || building.fortificationRole) scores.military += 2 * weight;
  if (type === 'farm' || type === 'pasture' || type === 'granary') scores.rural += 2.1 * weight;
  if (type === 'mine' || type === 'quarry' || type === 'lumber_camp') scores.industrial += 1.25 * weight;
  if (building.originGeneration <= 1) scores.historic_core += 1.15 * weight;
}

function urbanActivityFactor(building: Building): number {
  if (building.lifecycleState === 'ruin') return .03;
  if (building.lifecycleState === 'abandoned') return .08;
  if (building.lifecycleState === 'construction') return building.lifecycleProgress * .28;
  if (building.lifecycleState === 'reconstruction') return .18 + building.lifecycleProgress * .42;
  return building.lifecycleState === 'damaged' ? Math.max(.2, building.operationalFactor()) : 1;
}

function evaluateCell(city: City, kingdom: Kingdom | null, map: TileMap, gx: number, gy: number): DistrictEvidence | null {
  const center = cellCenter(gx, gy);
  if (!map.getTile(center.x, center.y)) return null;
  const scores = blankScores();
  const nearby: Array<{ building: Building; distance: number; activity: number }> = [];
  let architectureWealth = 0, architectureSamples = 0;
  for (const building of city.buildings.values()) {
    const distance = Math.hypot(building.x + .5 - center.x, building.y + .5 - center.y);
    if (distance > INFLUENCE_RADIUS) continue;
    const activity = urbanActivityFactor(building);
    nearby.push({ building, distance, activity });
    const weight = 1 / (1 + distance * distance * .12);
    addBuildingEvidence(scores, building, weight * activity);
    if (building.originGeneration <= 1 && activity < .25) scores.historic_core += weight * .34;
    if (building.architecture) {
      architectureWealth += WEALTH_SCORE[building.architecture.wealth] * weight;
      architectureSamples += weight;
    }
  }

  let roads = 0, roadQuality = 0, traffic = 0, damage = 0, rails = 0, coastal = 0, green = 0, walkable = 0;
  const minX = gx * CELL_SIZE - 2, maxX = minX + CELL_SIZE + 3;
  const minY = gy * CELL_SIZE - 2, maxY = minY + CELL_SIZE + 3;
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    const tile = map.getTile(x, y); if (!tile) continue;
    const terrain = TERRAINS[tile.type];
    if (!terrain.isWater && terrain.isWalkable) walkable++;
    if (tile.roadLevelEffective > 0) { roads++; roadQuality += tile.roadLevelEffective / 3; traffic += Math.min(1, tile.roadTraffic / 140); damage += tile.roadDamage; }
    if (tile.railLevelEffective > 0) rails++;
    if (map.isCoastalLand(x, y)) coastal++;
    if (tile.type === TerrainType.FOREST || tile.type === TerrainType.GRASS || tile.type === TerrainType.SOIL) green++;
  }
  const samples = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
  const roadAccess = clamp01(roads / 10 * .5 + roadQuality / Math.max(1, roads) * .3 + traffic / Math.max(1, roads) * .2);
  const railAccess = clamp01(rails / 5);
  const portBuilding = nearby.some(item => item.building.type === 'harbor' || item.building.type === 'port');
  const portAccess = portBuilding ? 1 : clamp01(coastal / 10) * .25;
  const accessibility = clamp01(roadAccess * .55 + railAccess * .28 + portAccess * .17);
  const buildingCount = nearby
    .filter(item => item.distance <= CELL_SIZE * .78 && !item.building.fortificationRole)
    .reduce((sum, item) => sum + item.activity, 0);
  const density = clamp01(buildingCount / Math.max(3, CELL_SIZE * CELL_SIZE * .2));
  const industryPresence = clamp01(scores.industrial / 3.2 + scores.artisan / 8);
  const pollution = clamp01(industryPresence * .72 + damage / Math.max(1, roads) * .25 + (city.besiegerId ? .2 : 0));
  const distance = Math.hypot(center.x - city.x, center.y - city.y);
  const centerValue = clamp01(1 - distance / Math.max(8, 10 + city.currentUrbanGeneration * 3));
  const serviceValue = clamp01((scores.commercial + scores.civic + scores.religious) / 6);
  const natureValue = clamp01(green / samples * 1.6 + coastal / samples * 2.4);
  const danger = city.besiegerId ? .3 : Math.min(.18, (kingdom?.externalThreat ?? 0) * .12);
  const desirability = clamp01(.28 + centerValue * .22 + serviceValue * .18 + natureValue * .2 + roadAccess * .12 - pollution * .35 - danger);
  const landValue = clamp01(.16 + centerValue * .27 + serviceValue * .24 + accessibility * .28 + natureValue * .12 - pollution * .31 - damage / Math.max(1, roads) * .12 - danger);
  const inheritedWealth = architectureSamples > 0 ? architectureWealth / architectureSamples : city.prosperity;
  const affluence = clamp01(city.prosperity * .4 + landValue * .38 + inheritedWealth * .22 - pollution * .16);
  const ledger = ledgerSignals(city);

  const localIndustry = scores.industrial;
  scores.railway += railAccess * (2.4 + ledger.trade * .7 + ledger.industrial * .8)
    * (1 - clamp01(localIndustry / 6) * .55);
  scores.port += portAccess * (1.6 + ledger.trade * 1.5);
  scores.industrial += industryPresence * ledger.industrial * 2.1 + railAccess * Math.min(1.45, localIndustry * .45);
  scores.commercial += traffic / Math.max(1, roads) * 1.25 + ledger.trade * Math.min(1.4, scores.commercial * .35 + .2);
  scores.rural += ledger.agricultural * Math.min(1.2, scores.rural * .3 + .2);

  const houses = nearby.filter(item => item.building.type === 'house' && item.distance <= INFLUENCE_RADIUS * .8)
    .reduce((sum, item) => sum + item.activity, 0);
  if (houses > 0) {
    scores.residential_common += houses * .42;
    if (affluence >= .62 && landValue >= .58 && pollution < .34) scores.residential_rich += houses * (.75 + affluence * .6);
    const jobs = scores.industrial + scores.artisan + scores.railway + scores.port;
    if (jobs > 1.1 && (affluence < .58 || pollution > .35)) scores.residential_worker += houses * (.7 + Math.min(1, jobs * .16));
  }

  const firstWall = city.fortificationLines[0];
  if (distance <= Math.max(4, city.urbanHistory[1]?.radius ?? 5)) scores.historic_core += 1.1 * centerValue;
  if (firstWall && pointInsideFortification(firstWall, center.x, center.y)) scores.historic_core += .75;
  if (distance > 6 + city.currentUrbanGeneration * 2 && density < .48) scores.periphery += 1.25 + distance * .025;
  if (density < .2 && scores.rural < .8) scores.periphery += .6;
  if (walkable === 0 || nearby.length === 0 && rails === 0 && roads === 0) return null;

  const anchor = nearby
    .filter(item => item.distance <= CELL_SIZE && item.activity >= .18)
    .sort((a, b) => {
      const order: BuildingType[] = ['port', 'harbor', 'factory', 'market', 'town_center', 'palace', 'workshop', 'barracks'];
      const importance = (building: Building): number => {
        const index = order.indexOf(building.type); return index < 0 ? 0 : order.length - index;
      };
      return importance(b.building) - importance(a.building) || a.distance - b.distance;
    })[0]?.building.id ?? null;
  return { scores, landValue, desirability, accessibility, density, affluence, pollution, anchorBuildingId: anchor, buildingCount };
}

function selectTypes(evidence: DistrictEvidence): { primary: UrbanDistrictType; secondary: UrbanDistrictType | null; dominance: number } {
  const ranked = (Object.entries(evidence.scores) as Array<[UrbanDistrictType, number]>).sort((a, b) => b[1] - a[1]);
  let primary = ranked[0][0];
  if (ranked[0][1] < .72) primary = evidence.density > .28 ? 'residential_common' : 'periphery';
  const secondary = ranked[1][1] >= ranked[0][1] * .62 && ranked[1][1] > .6 ? ranked[1][0] : null;
  const dominance = clamp01(ranked[0][1] / Math.max(1, ranked[0][1] + ranked[1][1]));
  return { primary, secondary, dominance };
}

function mergeDistrict(city: City, runtime: RuntimeDistrictCache, id: string, evidence: DistrictEvidence, year: number): { district: UrbanDistrictCell; changed: boolean } {
  const coords = parseCellId(id), center = cellCenter(coords.gx, coords.gy), selected = selectTypes(evidence);
  const previous = runtime.byId.get(id);
  if (!previous) {
    const district: UrbanDistrictCell = {
      schema: 1, id, gx: coords.gx, gy: coords.gy, centerX: center.x, centerY: center.y,
      type: selected.primary, secondaryType: selected.secondary, dominance: selected.dominance,
      landValue: evidence.landValue, desirability: evidence.desirability, accessibility: evidence.accessibility,
      density: evidence.density, affluence: evidence.affluence, pollution: evidence.pollution,
      foundedYear: year, lastChangedYear: year, updatedYear: year,
      anchorBuildingId: evidence.anchorBuildingId, buildingCount: evidence.buildingCount, history: []
    };
    runtime.byId.set(id, district); return { district, changed: true };
  }
  const metricDelta = Math.abs(previous.landValue - evidence.landValue) + Math.abs(previous.density - evidence.density) + Math.abs(previous.accessibility - evidence.accessibility);
  let type = previous.type, typeChanged = false;
  if (selected.primary !== previous.type) {
    const matureEnough = year - previous.lastChangedYear >= 8;
    const decisive = selected.dominance >= previous.dominance + .08 || selected.dominance >= .66;
    if (matureEnough && decisive) {
      previous.history.push({ type: previous.type, fromYear: previous.lastChangedYear, toYear: year });
      if (previous.history.length > 5) previous.history.shift();
      type = selected.primary; typeChanged = true;
    }
  }
  previous.type = type;
  previous.secondaryType = selected.secondary;
  previous.dominance = previous.dominance * .45 + selected.dominance * .55;
  previous.landValue = previous.landValue * .35 + evidence.landValue * .65;
  previous.desirability = previous.desirability * .35 + evidence.desirability * .65;
  previous.accessibility = previous.accessibility * .35 + evidence.accessibility * .65;
  previous.density = previous.density * .35 + evidence.density * .65;
  previous.affluence = previous.affluence * .35 + evidence.affluence * .65;
  previous.pollution = previous.pollution * .35 + evidence.pollution * .65;
  previous.anchorBuildingId = evidence.anchorBuildingId;
  previous.buildingCount = evidence.buildingCount;
  previous.updatedYear = year;
  if (typeChanged) previous.lastChangedYear = year;
  return { district: previous, changed: typeChanged || metricDelta > .12 };
}

function updateSpecialization(city: City, kingdom: Kingdom | null, map: TileMap, year: number): boolean {
  const counts = (types: BuildingType[]): number => [...city.buildings.values()]
    .filter(building => !building.fortificationRole && types.includes(building.type))
    .reduce((sum, building) => sum + urbanActivityFactor(building), 0);
  const ledger = ledgerSignals(city);
  let railTiles = 0;
  const radius = 10 + city.currentUrbanGeneration * 3;
  for (let x = Math.max(0, Math.floor(city.x - radius)); x <= Math.min(map.width - 1, Math.ceil(city.x + radius)); x++) {
    for (let y = Math.max(0, Math.floor(city.y - radius)); y <= Math.min(map.height - 1, Math.ceil(city.y + radius)); y++) {
      if (map.getTile(x, y)?.railLevelEffective) railTiles++;
    }
  }
  const scores: Record<Exclude<UrbanSpecializationType, 'mixed'>, number> = {
    agricultural: counts(['farm', 'pasture', 'granary']) * 1.35 + ledger.agricultural * 4,
    mining: counts(['mine', 'quarry', 'lumber_camp', 'oil_well']) * 1.5 + ledger.extractive * 3,
    industrial: counts(['factory', 'refinery', 'smithy', 'workshop']) * 1.45 + ledger.industrial * 4,
    port: counts(['harbor', 'port']) * 2.8 + ledger.trade * 2.5,
    commercial: counts(['market', 'bank', 'stock_exchange']) * 1.8 + ledger.trade * 3,
    administrative: counts(['palace', 'town_center', 'academy', 'library', 'monument']) * 1.15 + (kingdom?.capitalCityId === city.id ? 3 : 0),
    rail_hub: Math.min(7, railTiles * .2) + ledger.trade * 1.5,
    military: counts(['barracks', 'keep', 'wall']) * .65 + (kingdom?.externalThreat ?? 0) * 3
  };
  const ranked = (Object.entries(scores) as Array<[Exclude<UrbanSpecializationType, 'mixed'>, number]>).sort((a, b) => b[1] - a[1]);
  const strongest = ranked[0], runnerUp = ranked[1];
  const type: UrbanSpecializationType = strongest[1] < 2 || strongest[1] < runnerUp[1] * 1.12 ? 'mixed' : strongest[0];
  const strength = clamp01((strongest[1] - runnerUp[1] * .55) / Math.max(2, strongest[1]));
  const evidence = ranked.slice(0, 3).map(([candidate, score]) => `${candidate}:${score.toFixed(1)}`);
  const previous = city.urbanSpecialization;
  if (previous && previous.type === type && Math.abs(previous.strength - strength) < .08 && year - previous.updatedYear < 10) return false;
  city.urbanSpecialization = { schema: 1, type, strength, updatedYear: year, evidence };
  return true;
}

function syncCityList(city: City, runtime: RuntimeDistrictCache): void {
  city.urbanDistricts = [...runtime.byId.values()].sort((a, b) => a.gx - b.gx || a.gy - b.gy);
}

export function districtAt(city: City, x: number, y: number): UrbanDistrictCell | null {
  const { gx, gy } = cellCoords(x, y);
  const runtime = RUNTIME.get(city);
  // The renderer reaches this with whatever city-shaped thing it is drawing,
  // which is not always a fully built City — a partial one crashed the whole
  // snapshot build here rather than simply having no districts.
  const districts = city.urbanDistricts ?? [];
  const exact = runtime?.byId.get(cellId(city, gx, gy)) ?? districts.find(district => district.gx === gx && district.gy === gy);
  if (exact) return exact;
  let nearest: UrbanDistrictCell | null = null, best = CELL_SIZE * 1.7;
  for (const district of runtime?.byId.values() ?? districts) {
    const distance = Math.hypot(district.centerX - x, district.centerY - y);
    if (distance < best) { best = distance; nearest = district; }
  }
  return nearest;
}

export function districtForBuilding(city: City, building: Building): UrbanDistrictCell | null {
  return districtAt(city, building.x, building.y);
}

export function urbanContextAt(city: City, x: number, y: number, year: number): BuildingUrbanContext {
  const district = districtAt(city, x, y);
  return {
    districtType: district?.type ?? 'periphery',
    landValue: district?.landValue ?? city.prosperity * .45,
    desirability: district?.desirability ?? .4,
    accessibility: district?.accessibility ?? 0,
    density: district?.density ?? 0,
    affluence: district?.affluence ?? city.prosperity,
    stampedYear: year
  };
}

export class UrbanDistrictPlanner {
  public static markDirty(city: City, map: TileMap, x: number, y: number): void {
    const runtime = ensureRuntime(city, map), coords = cellCoords(x, y);
    addCellAndNeighbours(city, runtime.dirty, coords.gx, coords.gy, 1);
  }

  /** Immediate local fold after construction; no whole-city regeneration. */
  public static recordConstruction(city: City, kingdom: Kingdom | null, map: TileMap, building: Building, year: number): void {
    const runtime = ensureRuntime(city, map), coords = cellCoords(building.x, building.y);
    addCellAndNeighbours(city, runtime.dirty, coords.gx, coords.gy, 1);
    const evidence = evaluateCell(city, kingdom, map, coords.gx, coords.gy);
    if (evidence) {
      const result = mergeDistrict(city, runtime, cellId(city, coords.gx, coords.gy), evidence, year);
      building.urbanContext = urbanContextAt(city, building.x, building.y, year);
      if (result.changed) { map.markRenderDirty(building.x, building.y); city.districtVersion++; }
      syncCityList(city, runtime);
    }
    runtime.buildingPositions.set(building.id, buildingCell(city, building));
    runtime.buildingVersion = city.buildingVersion;
  }

  /** Periodic and region-aware. Stable cities do no district work. */
  public static tickCity(city: City, kingdom: Kingdom | null, map: TileMap, year: number, radius: number): number {
    const runtime = ensureRuntime(city, map);
    const state = map.regionStateAt(city.x, city.y), cadence = updateIntervals(state);
    const network = localNetworkSignature(city, map, radius);
    const economy = economySignature(city);
    const firstPass = runtime.byId.size === 0;

    if (runtime.buildingVersion !== city.buildingVersion) {
      const next = new Map<string, string>();
      for (const building of city.buildings.values()) {
        if (building.fortificationRole) continue;
        const position = buildingCell(city, building); next.set(building.id, position);
        if (runtime.buildingPositions.get(building.id) !== position) {
          const coords = cellCoords(building.x, building.y); addCellAndNeighbours(city, runtime.dirty, coords.gx, coords.gy, 1);
        }
      }
      for (const [id, position] of runtime.buildingPositions) if (!next.has(id)) {
        const coords = parseCellId(position); addCellAndNeighbours(city, runtime.dirty, coords.gx, coords.gy, 1);
      }
      runtime.buildingPositions = next; runtime.buildingVersion = city.buildingVersion;
    }
    if (network !== runtime.networkSignature || firstPass) {
      collectRelevantCells(city, map, radius, runtime.dirty);
      runtime.networkSignature = network;
    }
    const due = year - runtime.lastUpdateYear >= cadence.interval;
    if (economy !== runtime.economySignature || due) {
      const existing = [...runtime.byId.keys()];
      if (existing.length > 0) {
        const amount = Math.min(cadence.budget, existing.length);
        for (let index = 0; index < amount; index++) runtime.dirty.add(existing[(runtime.rotation + index) % existing.length]);
        runtime.rotation = (runtime.rotation + amount) % existing.length;
      }
      runtime.economySignature = economy;
    }
    if (!firstPass && !due && runtime.dirty.size === 0) return 0;

    const ids = [...runtime.dirty].slice(0, firstPass ? 64 : cadence.budget);
    let changed = 0;
    for (const id of ids) {
      runtime.dirty.delete(id);
      const { gx, gy } = parseCellId(id);
      const evidence = evaluateCell(city, kingdom, map, gx, gy);
      if (!evidence) continue;
      const result = mergeDistrict(city, runtime, id, evidence, year);
      if (!result.changed) continue;
      changed++;
      for (const building of city.buildings.values()) {
        if (buildingCell(city, building) === id) map.markRenderDirty(building.x, building.y);
      }
    }
    if (updateSpecialization(city, kingdom, map, year)) changed++;
    if (changed > 0 || firstPass) {
      syncCityList(city, runtime);
      city.districtVersion++;
    }
    runtime.lastUpdateYear = year;
    return changed;
  }
}

export function measureDistricts(city: City): DistrictMetrics {
  const types: Partial<Record<UrbanDistrictType, number>> = {};
  let land = 0, density = 0;
  for (const district of city.urbanDistricts) {
    types[district.type] = (types[district.type] ?? 0) + 1;
    land += district.landValue; density += district.density;
  }
  const count = city.urbanDistricts.length;
  return {
    districts: count, types,
    meanLandValue: count > 0 ? land / count : 0,
    meanDensity: count > 0 ? density / count : 0,
    specialization: city.urbanSpecialization?.type ?? 'mixed'
  };
}

/** Compact developer overlay payload; UI may consume it without recomputation. */
export function districtDebugSnapshot(city: City): ReadonlyArray<Pick<UrbanDistrictCell, 'centerX' | 'centerY' | 'type' | 'landValue' | 'density'>> {
  return city.urbanDistricts.map(({ centerX, centerY, type, landValue, density }) => ({ centerX, centerY, type, landValue, density }));
}
