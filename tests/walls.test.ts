import { strict as assert } from 'node:assert';
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { BUILDINGS } from '../src/civ/Building';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { rng } from '../src/core/Random';
import { wallRing, WALL_MIN_URBAN_BUILDINGS } from '../src/civ/UrbanPlanner';

/**
 * Curtain walls, tested on ground we control.
 *
 * A wall is the one structure whose correctness is a property of the whole set
 * rather than of any one piece: thirty segments that do not join are not a wall.
 * So these check the line — that it closes around the town, that consecutive
 * segments touch, that roads leave gates — and that a finished ring is worth
 * exactly one wall's defence rather than one per stone laid.
 */

const SIZE = 40;
const CENTRE = 20;

function flatMap(): TileMap {
  rng.setSeed(20260808);
  const map = new TileMap(SIZE, SIZE, 'single_continent', 7);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      t.type = TerrainType.GRASS;
      t.height = 0.5;
      t.roadLevel = 0;
      t.buildingId = null;
      t.cityId = null;
      t.resourceType = null;
    }
  }
  return map;
}

/** A town with `count` urban buildings scattered inside `radius` of the centre. */
function makeTown(map: TileMap, radius: number, count: number): City {
  const city = new City('c1', 'Testburgh', SpeciesType.HUMAN, CENTRE, CENTRE, 'Founder', 1);
  city.kingdomId = 'k1';
  // A real town, so its tier grants the plot budget the slot test is about.
  city.population = 60;
  city.updateTier();
  let placed = 0;
  for (let ring = 1; ring <= radius && placed < count; ring++) {
    for (let i = 0; i < 8 && placed < count; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.round(CENTRE + Math.cos(a) * ring);
      const y = Math.round(CENTRE + Math.sin(a) * ring);
      const t = map.getTile(x, y)!;
      if (t.buildingId) continue;
      const b = city.addBuilding('house', x, y);
      t.buildingId = b.id;
      t.cityId = city.id;
      placed++;
    }
  }
  return city;
}

// --- A town too small to be a town gets no wall ----------------------------
{
  const map = flatMap();
  const hamlet = makeTown(map, 1, WALL_MIN_URBAN_BUILDINGS - 2);
  assert.equal(wallRing(hamlet, map).length, 0, 'a handful of huts should not be walled');
}

// --- The line closes around the town, and its segments touch ---------------
{
  const map = flatMap();
  const town = makeTown(map, 4, 20);
  const ring = wallRing(town, map);

  assert.ok(ring.length >= 16, `ring too short to enclose anything: ${ring.length}`);

  // Every sector of the compass is covered — this is what "encloses" means, and
  // what the old scattered placement never achieved.
  const sectors = new Array(8).fill(0);
  for (const p of ring) {
    const a = Math.atan2(p.y - town.y, p.x - town.x);
    sectors[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 8]++;
  }
  assert.equal(sectors.filter(s => s > 0).length, 8, `ring leaves sectors open: [${sectors}]`);

  // Contiguous: each segment has a neighbour it visually joins to.
  for (const p of ring) {
    let nearest = Infinity;
    for (const o of ring) {
      if (o === p) continue;
      nearest = Math.min(nearest, Math.hypot(p.x - o.x, p.y - o.y));
    }
    assert.ok(nearest <= 1.5, `segment at ${p.x},${p.y} is orphaned (nearest ${nearest.toFixed(2)})`);
  }

  // It goes around the buildings, not through them. Rounding a circle onto a
  // tile grid pulls some samples inward by up to half a tile, so the bound is
  // the town's own reach rather than the nominal radius.
  let reach = 0;
  for (const b of town.buildings.values()) {
    if (b.type === 'wall') continue;
    reach = Math.max(reach, Math.hypot(b.x - town.x, b.y - town.y));
  }
  const occupied = new Set(
    [...town.buildings.values()].map(b => `${Math.round(b.x)},${Math.round(b.y)}`)
  );
  for (const p of ring) {
    const d = Math.hypot(p.x - town.x, p.y - town.y);
    assert.ok(d >= reach - 0.75, `ring cuts inside the town at ${p.x},${p.y} (d=${d.toFixed(2)}, reach ${reach.toFixed(2)})`);
    assert.ok(!occupied.has(`${p.x},${p.y}`), `ring runs through a building at ${p.x},${p.y}`);
  }
}

// --- Roads become gates, and unbuildable ground stays a gap ----------------
{
  const map = flatMap();
  const town = makeTown(map, 4, 20);
  const baseline = wallRing(town, map);

  // Drive a road due east out of the town, and put a lake due west.
  for (let x = CENTRE; x < SIZE - 1; x++) map.getTile(x, CENTRE)!.roadLevel = 2;
  for (let y = CENTRE - 2; y <= CENTRE + 2; y++) {
    for (let x = CENTRE - 8; x <= CENTRE - 5; x++) map.getTile(x, y)!.type = TerrainType.DEEP_OCEAN;
  }

  const ring = wallRing(town, map);
  assert.ok(ring.length < baseline.length, 'road and lake should open the line');
  assert.ok(
    !ring.some(p => map.getTile(p.x, p.y)!.roadLevel > 0),
    'a wall was laid across a road instead of leaving a gate'
  );
  assert.ok(
    !ring.some(p => map.getTile(p.x, p.y)!.type === TerrainType.DEEP_OCEAN),
    'a wall was laid on open water'
  );
}

// --- A finished ring is one wall's worth of defence, not thirty ------------
{
  const map = flatMap();
  const town = makeTown(map, 4, 20);
  const ring = wallRing(town, map);
  town.wallRingLength = ring.length;

  const undefended = town.defenseMultiplier();
  assert.equal(undefended, 1, 'an unwalled town should have no wall bonus');

  // Lay the whole circuit.
  for (const p of ring) {
    const b = town.addBuilding('wall', p.x, p.y);
    map.getTile(p.x, p.y)!.buildingId = b.id;
  }

  assert.equal(town.wallCoverage(), 1, 'a complete circuit should read as complete');
  const walled = town.defenseMultiplier();
  const expected = BUILDINGS.wall.defense!;
  assert.ok(
    Math.abs(walled - expected) < 1e-9,
    `a full ring should be worth exactly ${expected}x, got ${walled} (per-segment multiplication would give ${expected ** ring.length})`
  );

  // Half a ring is worth about half the bonus — a wall with a hole in it is
  // not a wall, and should not be priced like one.
  const half = new City('c2', 'Halfburgh', SpeciesType.HUMAN, CENTRE, CENTRE, 'F', 1);
  half.wallRingLength = ring.length;
  for (let i = 0; i < Math.floor(ring.length / 2); i++) half.addBuilding('wall', ring[i].x, ring[i].y);
  const halfBonus = half.defenseMultiplier();
  assert.ok(halfBonus > 1 && halfBonus < walled, `partial ring should be partial: ${halfBonus}`);
}

// --- Segments are a perimeter, not premises: they cost no building slots ---
{
  const map = flatMap();
  const town = makeTown(map, 4, 20);
  const ring = wallRing(town, map);

  const slotsBefore = town.buildingSlots;
  assert.ok(town.hasFreeBuildingSlot(), 'test town should start with room to build');

  for (const p of ring) town.addBuilding('wall', p.x, p.y);

  assert.equal(town.buildingSlots, slotsBefore, 'walls should not change the slot budget');
  assert.ok(
    town.hasFreeBuildingSlot(),
    `a ring of ${ring.length} segments consumed the town's plots — walls must not count as premises`
  );
}

console.log('walls.test: all assertions passed');
