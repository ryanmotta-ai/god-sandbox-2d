import { strict as assert } from 'node:assert';
import { BUILDINGS } from '../src/civ/Building';
import { City } from '../src/civ/City';
import { UrbanPlanner } from '../src/civ/UrbanPlanner';
import {
  ALL_BLUEPRINT_IDS, CITY_BLUEPRINTS, blueprintPlotAt, blueprintStreetAt,
  chooseOrientation, getCityBlueprint, describeBlueprintFor, assignCityBlueprint
} from '../src/civ/CityBlueprints';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';

const SIZE = 72;
const CENTER = 36;

function ground(waterFrom: number | null = null): TileMap {
  const map = new TileMap(SIZE, SIZE, 'single_continent', 4711);
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) {
    const tile = map.grid[x][y];
    tile.type = waterFrom !== null && y >= waterFrom ? TerrainType.SHALLOW_WATER : TerrainType.GRASS;
    tile.height = .5; tile.fertility = .7;
    tile.resourceType = null; tile.resourceAmount = 0; tile.resourceMax = 0;
    tile.buildingId = null; tile.cityId = null; tile.kingdomId = null;
    tile.roadLevel = 0; tile.roadTraffic = 0; tile.railLevel = 0;
  }
  return map;
}

function town(map: TileMap, blueprintId: string, orientation = 0): City {
  const city = new City('c1', 'Plan', SpeciesType.HUMAN, CENTER, CENTER, 'Founder', 1);
  city.blueprintId = blueprintId;
  city.blueprintRotation = orientation;
  city.tier = 'city';
  city.population = 100;
  const centre = map.getTile(CENTER, CENTER)!;
  centre.buildingId = [...city.buildings.values()][0].id;
  centre.cityId = city.id;
  return city;
}

// Every drawing is a legal drawing. The module throws on a malformed plan when
// it loads, so importing it at all proves the shape, the alphabet, the town hall
// at the centre and the street connectivity; this restates the ones a reader
// would want to see named.
{
  assert.equal(ALL_BLUEPRINT_IDS.length, 5, 'five plans');
  for (const id of ALL_BLUEPRINT_IDS) {
    const blueprint = CITY_BLUEPRINTS[id];
    assert.equal(blueprint.plan.length, 31, `${id}: 31 rows`);
    for (const row of blueprint.plan) assert.equal(row.length, 31, `${id}: 31 columns`);
    assert.equal(blueprint.plan[15][15], 'K', `${id}: the town hall holds the centre`);
  }
  assert.equal(CITY_BLUEPRINTS.maritime_haven.wantsCoast, true, 'the port plan draws its bay');
  assert.equal(CITY_BLUEPRINTS.imperial_grid.wantsCoast, false, 'the colonia does not');
}

// Reading a plan sideways is the same plan. All eight orientations must hold the
// same tiles in different places — a rotation that dropped or duplicated ground
// would quietly give one city more plots than another on the same drawing.
{
  const map = ground();
  for (const id of ALL_BLUEPRINT_IDS) {
    const straight = describeBlueprintFor(town(map, id, 0)).slice(1).join('');
    const tally = (text: string): string => [...new Set(text)].sort()
      .map(char => `${char}${[...text].filter(c => c === char).length}`).join(' ');
    for (let orientation = 1; orientation < 8; orientation++) {
      const turned = describeBlueprintFor(town(map, id, orientation)).slice(1).join('');
      assert.equal(tally(turned), tally(straight), `${id}: orientation ${orientation} keeps every tile`);
      assert.equal(turned[15 * 31 + 15], 'K', `${id}: orientation ${orientation} keeps the hall centred`);
    }
  }
}

// A quay has to face the water. This is the whole reason orientation exists, so
// it is the one thing worth asserting about it: given a coast to the south, the
// port plan must be read in the direction that puts its berths on the shore.
{
  const map = ground(CENTER + 8);
  const orientation = chooseOrientation(getCityBlueprint('maritime_haven'), map, CENTER, CENTER);
  const city = town(map, 'maritime_haven', orientation);
  let berths = 0, onShore = 0;
  for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
    if (!blueprintPlotAt(city, dx, dy)?.coastal) continue;
    berths++;
    if (map.isCoastalLand(CENTER + dx, CENTER + dy)) onShore++;
  }
  assert.ok(berths > 0, 'the port plan draws berths');
  assert.ok(onShore >= berths * .5, `most berths reach the water (${onShore}/${berths}, orientation ${orientation})`);
}

// The plan is chosen and oriented off the ground, once, at founding.
{
  const map = ground(CENTER + 8);
  const city = new City('c2', 'Bay', SpeciesType.HUMAN, CENTER, CENTER, 'Founder', 1);
  assignCityBlueprint(city, map, null);
  assert.equal(city.blueprintId, 'maritime_haven', 'a real bay gets the port plan');
  const inland = new City('c3', 'Inland', SpeciesType.HUMAN, CENTER, CENTER, 'Founder', 1);
  assignCityBlueprint(inland, ground(), null);
  assert.equal(inland.blueprintId, 'imperial_grid', 'flat open country gets the colonia');
}

// The plan decides where a building goes. Not a nudge among twelve others: the
// temple, the palace and the foundry each land on the plot drawn for them.
{
  const map = ground();
  const city = town(map, 'imperial_grid');
  const lands = (type: keyof typeof BUILDINGS): { dx: number; dy: number; drawnFor: string } => {
    const site = UrbanPlanner.findBuildingSites(city, BUILDINGS[type], map, 18, 1)[0];
    assert.ok(site, `${type} finds a site at all`);
    const plot = blueprintPlotAt(city, site.x - CENTER, site.y - CENTER);
    return { dx: site.x - CENTER, dy: site.y - CENTER, drawnFor: plot ? plot.prefer[0] : 'nothing' };
  };
  for (const [type, expected] of [
    ['temple', 'temple'], ['library', 'temple'], ['palace', 'palace'], ['monument', 'palace'],
    ['market', 'market'], ['bank', 'market'], ['factory', 'factory'], ['barracks', 'barracks'],
    ['workshop', 'workshop'], ['house', 'house'], ['farm', 'farm']
  ] as const) {
    const site = lands(type);
    assert.equal(site.drawnFor, expected, `${type} takes ground drawn for ${expected}, not ${site.drawnFor} at ${site.dx},${site.dy}`);
  }
}

// The penalty half of the plan. A plot drawn for a monument costs a cottage
// something, so the forum does not fill up with houses before the palace is
// affordable — which is the failure the whole plan exists to prevent.
{
  const map = ground();
  const city = town(map, 'imperial_grid');
  for (const site of UrbanPlanner.findBuildingSites(city, BUILDINGS.house, map, 18, 12)) {
    const plot = blueprintPlotAt(city, site.x - CENTER, site.y - CENTER);
    assert.ok(
      !plot || plot.affinity === 'residential' || plot.affinity === 'agricultural',
      `a house would not take ground drawn for ${plot?.prefer[0]} at ${site.x - CENTER},${site.y - CENTER}`
    );
  }
}

// Every street a plan draws must be walkable from the town hall's square,
// edge to edge and never through a corner — because `paveStreetPlan` lays one
// tile at a time and only ever beside ground it already paved. A street the walk
// cannot reach can never be built: a permanent hole in the grid, and a bespoke
// lane surveyed across town for every building along it. The works-town plan
// shipped exactly that and lost four fifths of its roads to it. The module
// throws on load, so this restates the property on the plans as shipped.
{
  const map = ground();
  for (const id of ALL_BLUEPRINT_IDS) {
    const city = town(map, id);
    const street = (dx: number, dy: number): boolean =>
      Math.abs(dx) <= 15 && Math.abs(dy) <= 15 && blueprintStreetAt(city, dx, dy, 'great_city') !== null;
    let total = 0;
    for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) if (street(dx, dy)) total++;
    const seen = new Set<string>();
    const queue = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => street(dx, dy));
    assert.ok(queue.length > 0, `${id}: the hall has a square beside it`);
    for (const [dx, dy] of queue) seen.add(`${dx},${dy}`);
    while (queue.length > 0) {
      const [x, y] = queue.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + dx},${y + dy}`;
        if (!street(x + dx, y + dy) || seen.has(key)) continue;
        seen.add(key); queue.push([x + dx, y + dy]);
      }
    }
    assert.equal(seen.size, total, `${id}: all ${total} drawn street tiles can be paved`);
  }
}

// Past the edge of the drawing the procedural grid still runs. Reading the plan
// as "no street anywhere it did not draw one" silently deleted the street grid
// from every city in the game, because `blueprintId` is never empty and the
// drawings only reach fifteen tiles while a metropolis surveys twenty-two.
{
  const map = ground();
  const city = town(map, 'imperial_grid');
  city.tier = 'metropolis';
  const structure = UrbanPlanner.structure(city, map, 20);
  const axis = structure.lots.get((CENTER + 18) * map.height + CENTER);
  assert.ok(axis, 'a lot exists eighteen tiles out');
  assert.equal(axis.plannedStreet, 'primary', 'the historical high street continues past the drawing');
  const drawn = structure.lots.get((CENTER + 4) * map.height + CENTER + 12);
  assert.ok(drawn, 'a lot exists inside the drawing');
}

// Inside the drawing, the plan is the only authority — including where it says
// there is deliberately nothing. A green stays a green.
{
  const map = ground();
  const city = town(map, 'imperial_grid');
  assert.equal(blueprintStreetAt(city, 0, -9, 'city'), 'primary', 'the cardo is drawn');
  assert.equal(blueprintStreetAt(city, 1, 1, 'city'), 'primary', 'the forum square is paved');
  assert.equal(blueprintStreetAt(city, -1, -2, 'great_city'), null, 'the garden beside the monument is not a street');
  assert.equal(blueprintPlotAt(city, -1, -2), null, 'and it is not a plot either — it is the monument\'s setback');
  assert.equal(blueprintPlotAt(city, -2, -2)?.prefer[0], 'palace', 'the monuments hold the forum corners');
  assert.equal(blueprintPlotAt(city, 0, 0)?.prefer[0], 'town_center', 'the hall holds the middle');
}

console.log('city-blueprints: plans, orientation, placement and street continuity all hold.');
