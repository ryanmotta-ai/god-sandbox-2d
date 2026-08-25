/**
 * The world outside a city stays unmarked.
 *
 * Long-distance overland trade used to write itself into the terrain twice
 * over: a trade agreement surveyed and paved a road between the two cities,
 * and the convoy running it wore a second track wherever it walked. Both are
 * gone, so the only made ground in this world is a city's own streets — and
 * the visible long-distance infrastructure starts with the railway.
 *
 * The economy is deliberately untouched by that: goods still move, because
 * they never moved on the back of the caravan in the first place.
 *
 *   npx tsx tests/wilderness.test.ts
 */
import { strict as assert } from 'node:assert';
import { CaravanSystem } from '../src/civ/CaravanSystem';
import { transportCostPerUnit } from '../src/civ/Trade';
import { TileMap } from '../src/world/TileMap';
import { rng } from '../src/core/Random';

rng.setSeed(20260825);

// ============================================================
// 1. Convoys stand down, including any a previous save left mid-route
// ============================================================
{
  const caravans = new CaravanSystem();
  caravans.deserialize({
    caravans: [
      { id: 'legacy-1', routeId: 'r1', progress: 0.5, x: 10, y: 10 },
      { id: 'legacy-2', routeId: 'r2', progress: 0.2, x: 30, y: 12 }
    ]
  });
  assert.equal(caravans.activeCaravans.size, 2, 'an old save really does carry convoys');

  caravans.standDown();
  assert.equal(
    caravans.activeCaravans.size, 0,
    'they have to be cleared, or they sit frozen on the map for ever'
  );
  caravans.standDown();
  assert.equal(caravans.activeCaravans.size, 0, 'and standing down twice is harmless');
}

// ============================================================
// 2. A city keeps its streets; the wilderness loses its tracks
// ============================================================
{
  const map = new TileMap(48, 48, 'single_continent', 4242);
  const street = map.getTile(10, 10)!;
  const track = map.getTile(30, 30)!;

  // A paved street inside a city, and an old track out in the open.
  street.roadLevel = 2; street.roadTraffic = 90; street.cityId = 'city-1';
  track.roadLevel = 2; track.roadTraffic = 90; track.cityId = null;

  const caravans = new CaravanSystem();
  for (let year = 0; year < 120; year++) caravans.decayRoadTraffic(map);

  assert.equal(street.roadLevel, 2, 'a city maintains its own streets, with or without convoys');
  assert.equal(street.roadTraffic, 90, 'so their traffic is never eaten away');
  assert.equal(
    track.roadLevel, 0,
    'an unclaimed track fades once nothing walks it, which clears older saves'
  );
}

// ============================================================
// 3. The yearly sweep stops walking a world with nothing left to decay
// ============================================================
{
  const map = new TileMap(64, 64, 'single_continent', 99);
  const caravans = new CaravanSystem();
  let reads = 0;
  // Count how much of the grid each sweep actually touches.
  const grid = map.grid;
  const counted = grid.map(column => new Proxy(column, {
    get(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
      return (target as never)[key as never];
    }
  }));
  (map as unknown as { grid: typeof grid }).grid = counted as typeof grid;

  caravans.decayRoadTraffic(map);
  const first = reads;
  assert.ok(first > 0, 'the first sweep has to look at the world at all');

  reads = 0;
  for (let year = 0; year < 20; year++) caravans.decayRoadTraffic(map);
  assert.equal(
    reads, 0,
    'twenty quiet years must cost nothing once the sweep has settled'
  );
}

// ============================================================
// 4. Unmade ground is the baseline, not a penalty nobody can work off
// ============================================================
{
  const price = 10, distance = 40;
  const unmade = transportCostPerUnit('overland', distance, price, 0);
  const dirt = transportCostPerUnit('overland', distance, price, 1);

  // What a route used to pay once its trade road appeared is what it pays now
  // from the start, so removing the roads is not a silent tax on every haul.
  const oldDirtCost = price * distance * 0.004 * (1.5 - 0.3 * 1);
  assert.equal(
    +unmade.toFixed(6), +oldDirtCost.toFixed(6),
    'crossing open ground now costs what a dirt road used to'
  );
  assert.ok(dirt < unmade, 'and a city street at the ends is still worth something');
}

console.log('wilderness.test: all assertions passed');
