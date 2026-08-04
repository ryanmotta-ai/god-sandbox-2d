import { strict as assert } from 'node:assert';
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { rng } from '../src/core/Random';
import { gradePenalty, roadGrade, crossingSpan, RELIEF_SCALE } from '../src/world/RoadTerrain';
import { surveyRoad, layRoad, tileRoadCost, isSpanTile, GREAT_SPAN } from '../src/civ/RoadEngineering';

rng.setSeed(20260804);

/**
 * Road engineering, tested on ground we control.
 *
 * Procedural terrain is a bad laboratory: a seed decides whether there is even
 * a hill between two points. Every case below builds the landform it is about
 * — a ridge with one saddle, a river with one narrows — so a failure means the
 * surveyor got it wrong, not that the world generator moved.
 */
function flatMap(size: number, height: number = 0.5): TileMap {
  const map = new TileMap(size, size, 'single_continent', 7);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const t = map.grid[x][y];
      t.type = TerrainType.GRASS;
      t.height = height;
      t.roadLevel = 0;
      t.roadDamage = 0;
      t.buildingId = null;
      t.cityId = null;
      t.kingdomId = null;
    }
  }
  return map;
}

function cityWith(name: string, x: number, y: number, stone: number, wood: number): City {
  const city = new City(`c_${name}`, name, SpeciesType.HUMAN, x, y, 'Founder', 1);
  city.stock.capacity = 1_000_000;
  // A new settlement is founded with materials already in hand; clear them so
  // each case is about the stock it declares and nothing else.
  city.stock.take('stone', city.stock.get('stone'));
  city.stock.take('wood', city.stock.get('wood'));
  city.stock.add('stone', stone);
  city.stock.add('wood', wood);
  return city;
}

function maxGradeOf(path: { x: number; y: number }[], map: TileMap): number {
  let worst = 0;
  for (let i = 1; i < path.length; i++) {
    const a = map.getTile(Math.floor(path[i - 1].x), Math.floor(path[i - 1].y))!;
    const b = map.getTile(Math.floor(path[i].x), Math.floor(path[i].y))!;
    const run = a.x !== b.x && a.y !== b.y ? 1.414 : 1;
    worst = Math.max(worst, roadGrade(a, b, run));
  }
  return worst;
}

// ============================================================
// 1. A gradient costs more the steeper it gets
// ============================================================
{
  assert.equal(gradePenalty(0), 1, 'flat ground is the unit of work');
  assert.ok(gradePenalty(6) > gradePenalty(0), '6% must cost more than flat');
  assert.ok(gradePenalty(12) > gradePenalty(6) * 2, 'the curve has to bite, not creep');
  assert.ok(gradePenalty(200) <= 40, 'the penalty is capped so A* can never overflow');
}

// ============================================================
// 2. A surveyed road contours to the saddle instead of climbing the ridge
// ============================================================
{
  const map = flatMap(28);
  // A ridge across the middle of the map, with one low pass at y = 4.
  for (let y = 0; y < 28; y++) {
    if (y === 4) continue;
    for (let x = 12; x <= 14; x++) {
      map.grid[x][y].height = 0.5 + 0.05 * (2 - Math.abs(x - 13));
    }
  }
  const survey = surveyRoad(map, 2, 14, 25, 14, 2);
  assert.ok(survey.path.length > 0, 'a route across the ridge must exist');

  const crest = map.grid[13][14].height;
  const straightGrade = (crest - 0.5) / 1 * RELIEF_SCALE;
  assert.ok(
    survey.maxGrade < straightGrade,
    `survey should never take the crest head-on (${survey.maxGrade.toFixed(1)}% vs ${straightGrade.toFixed(1)}%)`
  );

  const usedThePass = survey.path.some(p => Math.floor(p.y) <= 6 && Math.floor(p.x) >= 12 && Math.floor(p.x) <= 14);
  assert.ok(usedThePass, 'the survey should cross the ridge at the saddle it was given');
}

// ============================================================
// 3. A road crosses a river at its narrows, not at the nearest bank
// ============================================================
{
  const map = flatMap(28);
  // A river three tiles wide down the middle, pinched to one tile at y = 6.
  for (let y = 0; y < 28; y++) {
    const cols = y === 6 ? [13] : [12, 13, 14];
    for (const x of cols) map.grid[x][y].type = TerrainType.SHALLOW_WATER;
  }
  assert.equal(crossingSpan(map, 13, 6, 1, 0), 1, 'the narrows is one tile wide');
  assert.equal(crossingSpan(map, 13, 20, 1, 0), 3, 'the broad reach is three tiles wide');

  const survey = surveyRoad(map, 3, 20, 24, 20, 2);
  assert.ok(survey.path.length > 0, 'a route across the river must exist');
  assert.ok(survey.spanTiles > 0, 'the route has to cross the water somewhere');
  assert.equal(survey.spanTiles, 1, `the crossing should be the one-tile ford, got ${survey.spanTiles} tiles of span`);

  const crossedAtTheNarrows = survey.path.some(p => Math.floor(p.y) <= 8 && Math.floor(p.x) === 13);
  assert.ok(crossedAtTheNarrows, 'the survey should walk upstream to the narrows');
}

// ============================================================
// 4. A span costs more than the road that leads to it
// ============================================================
{
  const map = flatMap(20);
  for (let y = 0; y < 20; y++) map.grid[10][y].type = TerrainType.SHALLOW_WATER;

  const land = map.grid[5][10];
  const water = map.grid[10][10];
  assert.ok(isSpanTile(water) && !isSpanTile(land), 'the water tile is the one carried on a structure');

  const landCost = tileRoadCost(map, land, 2, map.grid[4][10]);
  const spanCost = tileRoadCost(map, water, 2, map.grid[9][10]);
  assert.ok(
    spanCost.stone > landCost.stone * 10,
    `a stone arch must dwarf a tile of paving (${spanCost.stone.toFixed(1)} vs ${landCost.stone.toFixed(1)})`
  );

  // And a long crossing costs more per tile than a short one, because the
  // piers have to stand in deeper, faster water.
  const wide = flatMap(20);
  for (let y = 0; y < 20; y++) for (let x = 8; x <= 12; x++) wide.grid[x][y].type = TerrainType.SHALLOW_WATER;
  const widePier = tileRoadCost(wide, wide.grid[10][10], 2, wide.grid[9][10]);
  assert.ok(widePier.stone > spanCost.stone, 'a five-tile crossing needs bigger piers than a one-tile one');
}

// ============================================================
// 5. Roadworks are paid for out of the stockpile
// ============================================================
{
  const map = flatMap(24);
  const city = cityWith('Quarrytown', 3, 12, 400, 400);
  const survey = surveyRoad(map, 3, 12, 20, 12, 2);
  assert.ok(survey.bill.stone > 0, 'a stone road has to cost stone');

  const stoneBefore = city.stock.get('stone');
  const works = layRoad(city, map, survey, 2);
  assert.equal(works.stoppedBy, 'complete', 'a rich city finishes its road');
  assert.ok(works.spent.stone > 0, 'materials must actually leave the stockpile');
  assert.ok(
    Math.abs((stoneBefore - city.stock.get('stone')) - works.spent.stone) < 0.001,
    'the reported spend must match what the stockpile lost'
  );
  const paved = survey.path.filter(p => map.getTile(Math.floor(p.x), Math.floor(p.y))!.roadLevel === 2);
  assert.ok(paved.length > survey.path.length * 0.9, 'nearly the whole route should be at grade');
}

// ============================================================
// 6. A city that runs out of stone gets a dirt track, not a gap
// ============================================================
{
  const map = flatMap(24);
  const city = cityWith('Poortown', 3, 12, 6, 400);
  const survey = surveyRoad(map, 3, 12, 20, 12, 2);
  const works = layRoad(city, map, survey, 2);

  assert.ok(works.tilesLaid > works.tilesAtGrade, 'the paving should have degraded partway along');
  assert.ok(works.tilesLaid >= survey.path.length - 1, 'but the road still has to reach the far end');
  const levels = survey.path.map(p => map.getTile(Math.floor(p.x), Math.floor(p.y))!.roadLevel);
  assert.ok(levels.every(l => l >= 1), 'every tile on the route carries a road of some grade');
  assert.ok(levels.includes(1) && levels.includes(2), 'and the route shows both grades');
}

// ============================================================
// 7. A city that cannot afford the span leaves its road at the bank
// ============================================================
{
  const map = flatMap(24);
  // A river three tiles wide from bank to bank: no ford anywhere, and the
  // piers for a crossing that wide are a generation of quarrying.
  for (let y = 0; y < 24; y++) for (let x = 11; x <= 13; x++) map.grid[x][y].type = TerrainType.SHALLOW_WATER;
  const city = cityWith('Fordless', 3, 12, 60, 60);
  const survey = surveyRoad(map, 3, 12, 20, 12, 2);
  assert.ok(survey.spanTiles >= 3, 'the only route crosses three tiles of water');
  assert.ok(survey.spanBill.stone > 60, 'the span is beyond what this city can quarry');

  const works = layRoad(city, map, survey, 2);
  assert.equal(works.stoppedBy, 'span', 'the works must halt at the water');
  assert.equal(works.spansBuilt, 0, 'and no half-bridge may be left standing');
  assert.ok(works.haltedAt !== null && works.haltedAt.x === 11, "the road stops at the water's edge");

  const farSide = survey.path.filter(p => Math.floor(p.x) > 13);
  assert.ok(farSide.length > 0, 'the survey did reach the far bank');
  assert.ok(
    farSide.every(p => map.getTile(Math.floor(p.x), Math.floor(p.y))!.roadLevel === 0),
    'nothing beyond the unbuilt crossing may be paved'
  );

  // Give the same city a quarry's worth of stone and the bridge goes up.
  city.stock.add('stone', 400);
  city.stock.add('wood', 400);
  const second = layRoad(city, map, surveyRoad(map, 3, 12, 20, 12, 2), 2);
  assert.equal(second.spansBuilt, 3, 'a solvent city builds the whole crossing');
  assert.equal(second.stoppedBy, 'complete', 'and the road reaches the far side');
  assert.ok(second.spent.stone > 90, 'a three-tile bridge costs more than most buildings');
}

// ============================================================
// 8. Boggy and broken ground costs more to build on than good ground
// ============================================================
{
  const map = flatMap(12);
  map.grid[5][5].type = TerrainType.SWAMP;
  map.grid[6][5].type = TerrainType.FOREST;
  const good = tileRoadCost(map, map.grid[4][5], 2, map.grid[3][5]);
  const marsh = tileRoadCost(map, map.grid[5][5], 2, map.grid[4][5]);
  const wood = tileRoadCost(map, map.grid[6][5], 2, map.grid[5][5]);
  assert.ok(marsh.stone > wood.stone, 'a causeway over marsh costs more than clearing forest');
  assert.ok(wood.stone > good.stone, 'clearing forest costs more than open grass');

  // The same tile costs more when it has to be cut into a slope.
  const steep = flatMap(12);
  steep.grid[6][5].height = 0.58;
  const cut = tileRoadCost(steep, steep.grid[6][5], 2, steep.grid[5][5]);
  const level = tileRoadCost(steep, steep.grid[4][5], 2, steep.grid[3][5]);
  assert.ok(cut.stone > level.stone * 2, 'cut-and-fill on a steep bench is not a rounding error');
}

// ============================================================
// 9. A crossing wide enough to be a public work reports itself as one
// ============================================================
{
  const map = flatMap(30);
  // Water the full height of the map, GREAT_SPAN tiles wide: no ford, no way
  // round, and the only route is the one that has to be paid for outright.
  for (let y = 0; y < 30; y++) {
    for (let x = 12; x < 12 + GREAT_SPAN; x++) map.grid[x][y].type = TerrainType.SHALLOW_WATER;
  }
  const city = cityWith('Bridgeport', 3, 15, 5000, 5000);
  const survey = surveyRoad(map, 3, 15, 26, 15, 2);
  assert.ok(survey.spanTiles >= GREAT_SPAN, `the crossing must be a great one, got ${survey.spanTiles}`);

  const works = layRoad(city, map, survey, 2);
  assert.equal(works.stoppedBy, 'complete', 'a very rich city finishes it');
  assert.equal(works.greatCrossings.length, 1, 'exactly one public work was raised');
  assert.equal(works.greatCrossings[0].span, GREAT_SPAN, 'and its span is the width of the water');
  assert.ok(works.spent.stone > 200, `a great bridge costs more than any building, got ${works.spent.stone}`);

  // Walking over it again is not a second opening.
  const again = layRoad(city, map, surveyRoad(map, 3, 15, 26, 15, 2), 2);
  assert.equal(again.greatCrossings.length, 0, 'an existing bridge is not re-inaugurated');
}

// ============================================================
// 10. An ordinary crossing stays ordinary
// ============================================================
{
  const map = flatMap(30);
  for (let y = 0; y < 30; y++) {
    for (let x = 12; x < 12 + (GREAT_SPAN - 2); x++) map.grid[x][y].type = TerrainType.SHALLOW_WATER;
  }
  const city = cityWith('Smalltown', 3, 15, 5000, 5000);
  const works = layRoad(city, map, surveyRoad(map, 3, 15, 26, 15, 2), 2);
  assert.ok(works.spansBuilt > 0, 'the bridge still went up');
  assert.equal(works.greatCrossings.length, 0, 'but a short crossing is not a public work');

  // Nor is a long one at the dirt grade — a timber trestle is not a monument.
  const trail = flatMap(30);
  for (let y = 0; y < 30; y++) {
    for (let x = 12; x < 12 + GREAT_SPAN; x++) trail.grid[x][y].type = TerrainType.SHALLOW_WATER;
  }
  const village = cityWith('Trailhead', 3, 15, 5000, 5000);
  const trailWorks = layRoad(village, trail, surveyRoad(trail, 3, 15, 26, 15, 1), 1);
  assert.ok(trailWorks.spansBuilt > 0, 'the trestle went up');
  assert.equal(trailWorks.greatCrossings.length, 0, 'a timber trestle is never a public work');
}

// ============================================================
// 11. A road with no reason to turn does not turn
// ============================================================
{
  // Featureless ground: every route of the same length costs the same, so
  // nothing but the tie-break decides the shape of the road. A* used to
  // mutate nodes already inside its heap, which broke the heap invariant and
  // let a plainly worse route win; the result was roads that staircased
  // across open country for no reason at all.
  const map = flatMap(40);
  const survey = surveyRoad(map, 4, 20, 35, 20, 2);
  assert.ok(survey.path.length > 0, 'a route across open ground must exist');
  assert.equal(survey.path.length, 32, `a straight run is 32 tiles, got ${survey.path.length}`);
  const rows = new Set(survey.path.map(p => Math.floor(p.y)));
  assert.equal(rows.size, 1, `the road should stay on one row, used ${[...rows].join(',')}`);
}

// ============================================================
// 12. A river of even width is not crossed at the edge of the world
// ============================================================
{
  // Off-map used to read as dry land, so the span measured at the border came
  // out short and every river looked narrow there. A surveyor that believes
  // it will walk a road to the map edge to cross.
  const map = flatMap(40);
  for (let y = 0; y < 40; y++) for (let x = 18; x <= 22; x++) map.grid[x][y].type = TerrainType.SHALLOW_WATER;
  const survey = surveyRoad(map, 4, 20, 35, 20, 2);
  assert.ok(survey.path.length > 0, 'a route across the river must exist');
  assert.equal(survey.spanTiles, 5, `it crosses the river square, got ${survey.spanTiles} tiles of span`);

  const wet = survey.path.filter(p => map.getTile(Math.floor(p.x), Math.floor(p.y))!.type === TerrainType.SHALLOW_WATER);
  for (const p of wet) {
    const y = Math.floor(p.y);
    assert.ok(y > 2 && y < 37, `the crossing must not run to the map edge, found one at y=${y}`);
  }
}

console.log('roads.test: all assertions passed');
