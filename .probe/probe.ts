import { BUILDINGS } from '../src/civ/Building';
import { City } from '../src/civ/City';
import { UrbanPlanner } from '../src/civ/UrbanPlanner';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
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
city.blueprintId = 'imperial_grid'; city.blueprintRotation = 0; city.population = 1;
for (const s of UrbanPlanner.findBuildingSites(city, BUILDINGS.town_center, map, 7, 6)) {
  console.log(`(${s.x - C},${s.y - C}) total=${s.totalScore.toFixed(0)} central=${s.centralityScore.toFixed(0)} form=${s.urbanFormScore.toFixed(0)} hist=${s.historicalGrowthScore.toFixed(0)} aff=${s.districtAffinityScore.toFixed(0)} road=${s.roadAccessScore.toFixed(0)} space=${s.spacingScore.toFixed(0)}`);
}
