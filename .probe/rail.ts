import { BUILDINGS } from '../src/civ/Building';
import { City } from '../src/civ/City';
import { UrbanPlanner } from '../src/civ/UrbanPlanner';
import { blueprintPlotAt } from '../src/civ/CityBlueprints';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

const size = 80;
const map = new TileMap(size, size, 'single_continent', 1701);
for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) {
  const t = map.grid[x][y];
  t.type = TerrainType.GRASS; t.height = .5; t.fertility = .72;
  t.resourceType = null; t.resourceAmount = 0; t.resourceMax = 0;
  t.buildingId = null; t.cityId = null; t.kingdomId = null;
  t.roadLevel = 0; t.roadTraffic = 0; t.railLevel = 0;
}
for (let y = 0; y < size; y++) map.grid[55][y].type = TerrainType.SHALLOW_WATER;
const city = new City('port-rail', 'port-rail', SpeciesType.HUMAN, 46, 40, 'F', 1);
city.tier = 'city';
map.getTile(46, 40)!.buildingId = 'b_tc_port-rail';
map.getTile(46, 40)!.cityId = city.id;
for (let i = 0; i < 17; i++) {
  const t = map.getTile(39 + i, 40)!; t.roadLevel = 1; t.roadTraffic = 90;
  map.markRoadNetworkChanged(39 + i, 40);
}
for (let y = 31; y <= 49; y++) { map.grid[50][y].railLevel = 1; map.markRailNetworkChanged(50, y); }

const structure = UrbanPlanner.structure(city, map, 15);
for (const type of ['factory', 'house'] as const) {
  console.log(type);
  for (const s of UrbanPlanner.findBuildingSites(city, BUILDINGS[type], map, 15, 16)) {
    const p = blueprintPlotAt(city, s.x - 46, s.y - 40);
    const lot = structure.lots.get(s.x * map.height + s.y);
    console.log(
      `  (${s.x},${s.y}) dR=${Math.abs(s.x - 50)} ${(p ? p.prefer[0] : 'livre').padEnd(8)}` +
      ` rail=${lot?.nearRail ? 'Y' : 'n'} tot=${s.totalScore.toFixed(0)}` +
      ` form=${s.urbanFormScore.toFixed(0)} hist=${s.historicalGrowthScore.toFixed(0)}` +
      ` cen=${s.centralityScore.toFixed(0)} aff=${s.districtAffinityScore.toFixed(0)}`
    );
  }
}
