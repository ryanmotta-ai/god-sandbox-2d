import { BUILDINGS, type BuildingType } from '../src/civ/Building';
import { City, type SettlementTier } from '../src/civ/City';
import { UrbanPlanner } from '../src/civ/UrbanPlanner';
import { blueprintPlotAt } from '../src/civ/CityBlueprints';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType, TERRAINS } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

const S = 64, C = 32;
const map = new TileMap(S, S, 'single_continent', 1701);
for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) {
  const t = map.grid[x][y];
  t.type = TerrainType.GRASS; t.height = .5; t.fertility = .72;
  t.resourceType = null; t.resourceAmount = 0; t.resourceMax = 0;
  t.buildingId = null; t.cityId = null; t.kingdomId = null;
  t.roadLevel = 0; t.roadTraffic = 0; t.railLevel = 0;
}
const city = new City('c1', 'c1', SpeciesType.HUMAN, C, C, 'F', 1);
city.blueprintId = 'imperial_grid'; city.blueprintRotation = 0;

const PROGRAMME: BuildingType[] = [
  'house', 'farm', 'house', 'house', 'granary', 'house', 'farm',
  'market', 'house', 'house', 'temple', 'house', 'workshop', 'house', 'farm',
  'house', 'smithy', 'house', 'library', 'house', 'house', 'barracks', 'farm',
  'house', 'aqueduct', 'house', 'market', 'house', 'academy', 'house', 'house',
  'palace', 'house', 'farm', 'workshop', 'house', 'monument', 'house', 'bank',
  'house', 'house', 'pasture', 'house', 'smithy', 'house', 'colosseum', 'house',
  'granary', 'house', 'factory', 'house', 'house', 'great_library', 'house'
];
const BIG = new Set(['temple','library','academy','palace','monument','colosseum','great_library','bank','stock_exchange','barracks','factory','refinery','market']);
let n = 1;
for (const type of PROGRAMME) {
  const radius = 21;
  const sites = UrbanPlanner.findBuildingSites(city, BUILDINGS[type], map, radius, 4);
  if (sites.length === 0) continue;
  const s = sites[0];
  if (BIG.has(type)) {
    const plot = blueprintPlotAt(city, s.x - C, s.y - C);
    const alt = sites.slice(0, 3).map(c => `(${c.x - C},${c.y - C})${blueprintPlotAt(city, c.x - C, c.y - C)?.prefer[0] ?? 'LIVRE'}:${c.totalScore.toFixed(0)}`).join(' ');
    console.log(`${String(n).padStart(2)} ${type.padEnd(14)} -> ${plot ? plot.prefer[0] : 'FORA DO PLANO'}   [${alt}]`);
  }
  const b = city.addBuilding(type, s.x, s.y);
  const tile = map.getTile(s.x, s.y)!;
  tile.buildingId = b.id; tile.cityId = city.id;
  UrbanPlanner.recordConstruction(city, map, b.id);
  city.population = Math.max(1, n * 3);
  city.tier = (n >= 50 ? 'metropolis' : n >= 36 ? 'city' : n >= 26 ? 'town' : n >= 16 ? 'village' : n >= 8 ? 'hamlet' : 'camp') as SettlementTier;
  n++;
}
