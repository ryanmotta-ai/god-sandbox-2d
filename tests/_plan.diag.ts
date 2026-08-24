/**
 * Throwaway diagnostic: grow one city on known ground and look at the plan.
 *
 * The full simulation diagnostic (`_urban.diag.ts`) shows what a city becomes
 * after ninety years of economy, war and geology, which is the thing that
 * matters — but it takes minutes and a third of its buildings are mines sitting
 * on ore seams miles from town, so it is useless for judging a street plan.
 * This drives the placement pipeline directly on flat ground, one building a
 * year, paving the plan the way the engine paves it. Seconds, not minutes.
 *
 *   BP=imperial_grid ROT=0 N=70 npx tsx tests/_plan.diag.ts
 */
import { BUILDINGS, type BuildingType } from '../src/civ/Building';
import { City, type SettlementTier } from '../src/civ/City';
import { UrbanPlanner, urbanProfile } from '../src/civ/UrbanPlanner';
import { ALL_BLUEPRINT_IDS, blueprintPlotAt, describeBlueprintFor, chooseOrientation, getCityBlueprint } from '../src/civ/CityBlueprints';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType, TERRAINS } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

const SIZE = 64;
const CENTER = 32;
const TARGET = Number(process.env.N ?? 70);
const ONLY = process.env.BP ?? '';
const ROTATION = process.env.ROT === undefined ? null : Number(process.env.ROT);
const COAST = process.env.COAST === '1';

/** Flat grass, optionally with an ocean filling everything south of the town. */
function ground(): TileMap {
  const map = new TileMap(SIZE, SIZE, 'single_continent', 1701);
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) {
    const tile = map.grid[x][y];
    tile.type = COAST && y >= CENTER + 8 ? TerrainType.SHALLOW_WATER : TerrainType.GRASS;
    tile.height = .5; tile.fertility = .72;
    tile.resourceType = null; tile.resourceAmount = 0; tile.resourceMax = 0;
    tile.buildingId = null; tile.cityId = null; tile.kingdomId = null;
    tile.roadLevel = 0; tile.roadTraffic = 0; tile.railLevel = 0;
  }
  return map;
}

/**
 * What a settlement of this size would plausibly have standing. Taken from the
 * building mix the real simulation produces, minus extraction, which geology
 * places and no plan governs.
 */
const PROGRAMME: BuildingType[] = [
  'house', 'farm', 'house', 'house', 'granary', 'house', 'farm',
  'market', 'house', 'house', 'temple', 'house', 'workshop', 'house', 'farm',
  'house', 'smithy', 'house', 'library', 'house', 'house', 'barracks', 'farm',
  'house', 'aqueduct', 'house', 'market', 'house', 'academy', 'house', 'house',
  'palace', 'house', 'farm', 'workshop', 'house', 'monument', 'house', 'bank',
  'house', 'house', 'pasture', 'house', 'smithy', 'house', 'colosseum', 'house',
  'granary', 'house', 'factory', 'house', 'house', 'great_library', 'house',
  'farm', 'house', 'stock_exchange', 'house', 'refinery', 'house', 'house',
  'grand_aqueduct', 'house', 'harbor', 'house', 'port', 'house', 'farm', 'house'
];

function tierFor(count: number): SettlementTier {
  if (count >= 50) return 'metropolis';
  if (count >= 36) return 'city';
  if (count >= 26) return 'town';
  if (count >= 16) return 'village';
  return count >= 8 ? 'hamlet' : 'camp';
}

function surveyRadius(city: City): number {
  const bonus = ({ camp: 0, hamlet: 1, village: 2, town: 4, city: 6, metropolis: 8 } as Record<string, number>)[city.tier] ?? 0;
  return Math.min(22, 7 + bonus + Math.floor(Math.sqrt(Math.max(0, city.population)) / 2));
}

/** The engine's own street works, reduced to what it does to the tile map. */
function paveStreetPlan(city: City, map: TileMap): void {
  const structure = UrbanPlanner.structure(city, map, surveyRadius(city));
  const paved = new Set<string>();
  for (const key of structure.streets.keys()) paved.add(`${Math.floor(key / map.height)},${key % map.height}`);
  if (paved.size === 0) paved.add(`${Math.floor(city.x)},${Math.floor(city.y)}`);

  const served = new Set<string>();
  for (const building of city.buildings.values()) {
    const bx = Math.round(building.x), by = Math.round(building.y);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) served.add(`${bx + dx},${by + dy}`);
  }

  const budget = Math.min(5, 1 + Math.floor(city.population / 45));
  for (let laid = 0; laid < budget; laid++) {
    let best: { x: number; y: number; streetClass: 'primary' | 'secondary'; score: number } | null = null;
    for (const lot of structure.lots.values()) {
      if (!lot.plannedStreet || !served.has(`${lot.x},${lot.y}`)) continue;
      const tile = map.getTile(lot.x, lot.y);
      if (!tile || tile.buildingId || tile.roadLevelEffective > 0) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => paved.has(`${lot.x + dx},${lot.y + dy}`))) continue;
      const score = (lot.plannedStreet === 'primary' ? 80 : 20) - Math.hypot(lot.x - city.x, lot.y - city.y) * 2;
      if (!best || score > best.score) best = { x: lot.x, y: lot.y, streetClass: lot.plannedStreet, score };
    }
    if (!best) return;
    const tile = map.getTile(best.x, best.y)!;
    tile.roadLevel = 1;
    tile.roadTraffic = best.streetClass === 'primary' ? 90 : 35;
    map.markRoadNetworkChanged(best.x, best.y);
    UrbanPlanner.recordStreetPath(city, map, [{ x: best.x, y: best.y }], best.streetClass);
    paved.add(`${best.x},${best.y}`);
  }
}

/** The connector lane the engine runs out to each new building. */
function connect(city: City, map: TileMap, x: number, y: number): void {
  const plan = UrbanPlanner.planStreetConnection(city, map, x, y, surveyRadius(city));
  if (!plan || plan.alreadyConnected) return;
  let cx = plan.fromX, cy = plan.fromY;
  for (let step = 0; step < 24 && (cx !== plan.toX || cy !== plan.toY); step++) {
    if (cx !== plan.toX) cx += Math.sign(plan.toX - cx);
    else cy += Math.sign(plan.toY - cy);
    const tile = map.getTile(cx, cy);
    if (!tile || tile.buildingId || TERRAINS[tile.type].isWater) break;
    if (tile.roadLevelEffective === 0) {
      tile.roadLevel = 1;
      tile.roadTraffic = plan.streetClass === 'primary' ? 90 : 35;
      map.markRoadNetworkChanged(cx, cy);
      UrbanPlanner.recordStreetPath(city, map, [{ x: cx, y: cy }], plan.streetClass);
    }
  }
}

const GLYPH: Record<string, string> = {
  town_center: '@', palace: 'P', keep: 'K', monument: 'M', colosseum: 'O',
  house: 'h', aqueduct: 'a', grand_aqueduct: 'A', granary: 'g',
  market: 'k', bank: 'b', stock_exchange: 'e', collective: 'c',
  temple: 't', library: 'i', great_library: 'I', academy: 'y',
  workshop: 'w', smithy: 's', factory: 'F', refinery: 'R',
  harbor: 'H', port: 'p', barracks: 'B', farm: 'f', pasture: 'u'
};

function grow(blueprintId: string): void {
  const map = ground();
  const city = new City('c1', blueprintId, SpeciesType.HUMAN, CENTER, CENTER, 'Founder', 1);
  city.blueprintId = blueprintId;
  city.blueprintRotation = ROTATION ?? chooseOrientation(getCityBlueprint(blueprintId), map, CENTER, CENTER);
  city.population = 1;

  let placed = 0;
  for (const type of PROGRAMME) {
    if (placed >= TARGET) break;
    city.tier = tierFor(placed);
    city.population = Math.max(1, placed * 3);
    paveStreetPlan(city, map);
    const sites = UrbanPlanner.findBuildingSites(city, BUILDINGS[type], map, surveyRadius(city), 4);
    if (sites.length === 0) continue;
    const site = sites[0];
    const building = city.addBuilding(type, site.x, site.y);
    const tile = map.getTile(site.x, site.y)!;
    tile.buildingId = building.id; tile.cityId = city.id;
    UrbanPlanner.recordConstruction(city, map, building.id);
    connect(city, map, site.x, site.y);
    placed++;
  }

  // ---- measurement ----
  const all = [...city.buildings.values()];
  const urban = all.filter(b => urbanProfile(b.type).affinity !== 'extraction');
  const occupied = new Set(all.map(b => `${b.x},${b.y}`));
  let touching = 0;
  for (const b of urban) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => occupied.has(`${b.x + dx},${b.y + dy}`))) touching++;
  }
  // What happened to every plot the plan drew for a big building — the ones
  // that carry a city's silhouette, and the ones clearance can quietly lose.
  const BIG = ['town_center', 'palace', 'temple', 'market', 'factory', 'barracks', 'harbor'];
  const fate: string[] = [];
  for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
    const plot = blueprintPlotAt(city, dx, dy);
    if (!plot || !BIG.includes(plot.prefer[0])) continue;
    const here = all.find(b => b.x === CENTER + dx && b.y === CENTER + dy);
    const tile = map.getTile(CENTER + dx, CENTER + dy);
    fate.push(here ? (plot.prefer.includes(here.type) ? '.' : '?') : tile?.roadLevel ? 'r' : '-');
  }
  const filled = fate.filter(f => f === '.').length;
  const paved = fate.filter(f => f === 'r').length;
  // The plots outnumber the big buildings on purpose, so an empty plot is not a
  // failure. A *paved* one is: a road took ground the plan was holding.
  const bigStanding = all.filter(b => BIG.includes(urbanProfile(b.type).affinity === 'extraction' ? '' : b.type)
    || ['temple', 'library', 'academy', 'palace', 'monument', 'colosseum', 'great_library',
      'bank', 'stock_exchange', 'barracks', 'keep', 'factory', 'refinery', 'harbor', 'port',
      'market', 'town_center'].includes(b.type));
  const bigOnPlot = bigStanding.filter(b => blueprintPlotAt(city, b.x - CENTER, b.y - CENTER)?.prefer.includes(b.type)).length;
  console.log(`    GRANDES NO LOTE ${bigOnPlot}/${bigStanding.length}   lotes ocupados ${filled}/${fate.length}, pavimentados ${paved}  [${fate.join('')}]`);

  let onPlan = 0, wrongPlot = 0, offPlan = 0;
  for (const b of urban) {
    const plot = blueprintPlotAt(city, b.x - CENTER, b.y - CENTER);
    if (!plot) offPlan++;
    else if (plot.prefer.includes(b.type) || plot.affinity === urbanProfile(b.type).affinity) onPlan++;
    else wrongPlot++;
  }

  const radius = 15;
  let land = 0, roads = 0, built = 0;
  for (let x = CENTER - radius; x <= CENTER + radius; x++) for (let y = CENTER - radius; y <= CENTER + radius; y++) {
    const tile = map.getTile(x, y);
    if (!tile || TERRAINS[tile.type].isWater) continue;
    land++;
    if (tile.roadLevel > 0) roads++;
    else if (tile.buildingId) built++;
  }

  console.log(`\n=== ${blueprintId} (rot ${city.blueprintRotation}) — ${all.length} prédios, tier ${city.tier} ===`);
  console.log(`    NO PLANO ${(onPlan / urban.length * 100).toFixed(0)}%  (lote errado ${wrongPlot}, fora do plano ${offPlan}, de ${urban.length})`);
  console.log(`    ADJACENCIA ${(touching / urban.length * 100).toFixed(0)}%   RUAS ${roads}/${land} = ${(roads / land * 100).toFixed(0)}%   construído ${(built / land * 100).toFixed(0)}%`);

  const at = new Map<string, string>();
  for (const b of all) at.set(`${b.x},${b.y}`, GLYPH[b.type] ?? '?');
  const drawn = describeBlueprintFor(city).slice(1);
  const big = all.filter(b => ["town_center","palace","monument","colosseum","great_library","keep","temple","library","academy","bank","stock_exchange","market","factory","refinery","barracks","harbor","port"].includes(b.type));
  console.log("    grandes: " + big.map(b => `${b.type}(${b.x - CENTER},${b.y - CENTER})=${blueprintPlotAt(city, b.x - CENTER, b.y - CENTER) ? "plot" : "LIVRE"}`).join(" "));
  const ruler = Array.from({ length: radius * 2 + 1 }, (_, i) => (i === radius ? '|' : '.')).join('');
  console.log(`    ${ruler}   plano: ${ruler}`);
  for (let y = CENTER - radius; y <= CENTER + radius; y++) {
    let line = '';
    for (let x = CENTER - radius; x <= CENTER + radius; x++) {
      const glyph = at.get(`${x},${y}`);
      if (glyph) { line += glyph; continue; }
      const tile = map.getTile(x, y);
      if (!tile) { line += ' '; continue; }
      if (TERRAINS[tile.type].isWater) { line += '~'; continue; }
      line += tile.roadTraffic >= 90 ? '=' : tile.roadLevel > 0 ? '-' : ' ';
    }
    const mark = y === CENTER ? '-' : ' ';
    console.log(`   ${mark}${line}${mark}       ${drawn[y - CENTER + 15]}`);
  }
}

for (const id of ONLY ? [ONLY] : ALL_BLUEPRINT_IDS) grow(id);
