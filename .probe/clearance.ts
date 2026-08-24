import { BUILDINGS, type BuildingType } from '../src/civ/Building';
import { City, type SettlementTier } from '../src/civ/City';
import { UrbanPlanner } from '../src/civ/UrbanPlanner';
import { blueprintPlotAt } from '../src/civ/CityBlueprints';
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
city.blueprintId = 'imperial_grid'; city.blueprintRotation = 0;

// Fill every housing plot the plan drew, then ask for each monument in turn.
for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
  const plot = blueprintPlotAt(city, dx, dy);
  if (!plot || !plot.prefer.includes('house')) continue;
  const b = city.addBuilding('house', C + dx, C + dy);
  const tile = map.getTile(C + dx, C + dy)!;
  tile.buildingId = b.id; tile.cityId = city.id;
}
city.tier = 'metropolis' as SettlementTier;
city.population = 200;
UrbanPlanner.recordConstruction(city, map, [...city.buildings.values()][0].id);

for (const type of ['palace', 'monument', 'colosseum', 'great_library', 'temple', 'library'] as BuildingType[]) {
  const sites = UrbanPlanner.findBuildingSites(city, BUILDINGS[type], map, 21, 3);
  const shown = sites.map(s => {
    const plot = blueprintPlotAt(city, s.x - C, s.y - C);
    return `(${s.x - C},${s.y - C})${plot ? '=' + plot.prefer[0] : '=LIVRE'}:${s.totalScore.toFixed(0)}`;
  });
  console.log(`${type.padEnd(14)} ${shown.join('  ')}`);
}
