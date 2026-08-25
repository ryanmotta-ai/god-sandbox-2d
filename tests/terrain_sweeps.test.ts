import { strict as assert } from 'node:assert';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { rng } from '../src/core/Random';

/**
 * The fire and fluid sweeps skip themselves once the map has settled.
 *
 * That gate is worth ~60% of simulation CPU and is only safe if "settled"
 * really means "nothing left to do": the cases below check that a skipped
 * sweep produces the same world as an unskipped one, and — the failure that
 * would actually matter — that a fire lit long after the map went quiet still
 * catches and spreads.
 */

const SIZE = 48;
const SEED = 20260808;

function freshMap(): TileMap {
  rng.setSeed(SEED);
  return new TileMap(SIZE, SIZE, 'single_continent', SEED);
}

function snapshot(map: TileMap): string {
  const out: string[] = [];
  for (let x = 0; x < map.width; x++) {
    for (let y = 0; y < map.height; y++) {
      const t = map.grid[x][y];
      out.push(`${t.type}${t.isOnFire ? '!' : ''}`);
    }
  }
  return out.join(',');
}

// --- Water still spills exactly as far as it used to -----------------------
// The gate must not stop the spill early. Both maps get the same number of
// ticks; the gated one just stops doing work once nothing more can convert.
{
  const map = freshMap();
  for (let i = 0; i < 200; i++) map.updateFluidTick();
  const settled = snapshot(map);

  // Another 200 ticks must be a no-op — that is what "settled" claims.
  for (let i = 0; i < 200; i++) map.updateFluidTick();
  assert.equal(snapshot(map), settled, 'fluid sweep kept changing the map after settling');

  // And the settled map must have no low land left touching water anywhere.
  for (let x = 0; x < map.width; x++) {
    for (let y = 0; y < map.height; y++) {
      const t = map.grid[x][y];
      if (t.type !== TerrainType.SHALLOW_WATER && t.type !== TerrainType.DEEP_OCEAN) continue;
      for (const n of map.getNeighbors(x, y, false)) {
        const spillable = n.height < 0.25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN;
        assert.ok(!spillable, `water at ${x},${y} never spilled into ${n.x},${n.y}`);
      }
    }
  }
}

// --- A fire lit on a quiet map still burns ---------------------------------
// The regression the gate could plausibly cause: the sweep goes to sleep and
// never wakes, so a wildfire silently does nothing.
{
  const map = freshMap();
  for (let i = 0; i < 300; i++) { map.updateFireTick(); map.updateFluidTick(); }
  assert.equal(map.updateFireTick(), 0, 'a quiet map reported fires');

  // Light one, the way disasters and god powers do.
  const forest: { x: number; y: number }[] = [];
  for (let x = 1; x < map.width - 1; x++) {
    for (let y = 1; y < map.height - 1; y++) {
      if (map.grid[x][y].type === TerrainType.FOREST) forest.push({ x, y });
    }
  }
  assert.ok(forest.length > 0, 'test map has no forest to burn');
  const seat = forest[Math.floor(forest.length / 2)];
  map.applyBrush(seat.x, seat.y, 1.5, t => { t.isOnFire = true; });

  assert.ok(map.updateFireTick() > 0, 'fire lit after the map settled was never seen');

  // It must burn itself out rather than smoulder forever, and the sweep must
  // go quiet again afterwards.
  let sawSpread = false;
  for (let i = 0; i < 400; i++) {
    if (map.updateFireTick() > 0) sawSpread = true;
  }
  assert.ok(sawSpread, 'fire went out instantly instead of burning');
  assert.equal(map.updateFireTick(), 0, 'fire never burned out');
}

console.log('terrain sweeps: ok');
