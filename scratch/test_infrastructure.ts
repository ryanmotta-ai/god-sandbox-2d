/**
 * Review checks for Phase H (infrastructure capacity) and Phase I (railways),
 * work done by another agent. One runnable assertion per claim it makes.
 */
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';

/** Test isolation: procedural terrain may put water anywhere, and layTrack
 *  silently refuses water tiles. Force a strip of land so rail tests are
 *  about the railway logic, not about where a seed happened to put ocean. */
function forceLand(map: TileMap, tiles: { x: number; y: number }[]): void {
  for (const p of tiles) {
    const t = map.getTile(p.x, p.y)!;
    t.type = TerrainType.GRASS;
  }
}
import {
  roadCapacityFactor,
  portCapacityFactor,
  portOperational,
  damageRoadsAround,
  repairInfrastructure
} from '../src/civ/Infrastructure';
import { RailwayNetwork, type RailwayWorld } from '../src/civ/RailwayNetwork';
import { Kingdom } from '../src/civ/Kingdom';

let failures = 0;
function check(name: string, pass: boolean, detail: string = ''): void {
  if (pass) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('=== PHASE H+I REVIEW CHECKS ===\n');

// ---------- 1. Road capacity scales with real road level ----------
{
  const map = new TileMap(40, 40, 'single_continent', 111);
  const path = [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }];

  const noRoad = roadCapacityFactor(path, map);
  for (const p of path) map.getTile(p.x, p.y)!.roadLevel = 1;
  const dirt = roadCapacityFactor(path, map);
  for (const p of path) map.getTile(p.x, p.y)!.roadLevel = 3;
  const highway = roadCapacityFactor(path, map);

  check('no road is the slowest', noRoad < dirt, `${noRoad} vs ${dirt}`);
  check('a highway beats a dirt trail', highway > dirt, `${dirt} vs ${highway}`);
  check('capacity factor stays in a sane band', noRoad >= 0.3 && highway <= 1.5, `${noRoad}..${highway}`);
}

// ---------- 2. War damage on a road actually lowers its capacity ----------
{
  const map = new TileMap(40, 40, 'single_continent', 222);
  const path = [{ x: 20, y: 20 }, { x: 21, y: 20 }];
  for (const p of path) map.getTile(p.x, p.y)!.roadLevel = 3;

  const before = roadCapacityFactor(path, map);
  damageRoadsAround(map, 20, 20, 2);
  const after = roadCapacityFactor(path, map);
  check('war damage reduces road capacity', after < before, `${before} -> ${after}`);
}

// ---------- 3. A destroyed port collapses maritime capacity to zero ----------
{
  const a = new City('ca', 'Porttown', SpeciesType.LUMINI, 0, 0, 'Founder', 1);
  const b = new City('cb', 'Shoretown', SpeciesType.LUMINI, 10, 0, 'Founder', 1);
  const portA = a.addBuilding('port', 0, 0);
  const portB = b.addBuilding('port', 10, 0);

  const healthy = portCapacityFactor(a, b);
  check('two healthy ports carry real capacity', healthy > 0, `${healthy}`);
  check('a healthy port is operational', portOperational(a));

  portA.hp = Math.round(portA.maxHp * 0.3); // knocked below the 50% threshold
  portB.hp = Math.round(portB.maxHp * 0.3);
  check('a knocked-out port is not operational', !portOperational(a));

  const wrecked = portCapacityFactor(a, b);
  check('destroyed ports collapse maritime capacity', wrecked < healthy, `${healthy} -> ${wrecked}`);
}

// ---------- 4. Repairs consume real materials, not free healing ----------
{
  const map = new TileMap(20, 20, 'single_continent', 333);
  const city = new City('cr', 'Fixtown', SpeciesType.LUMINI, 5, 5, 'Founder', 1);
  const wall = city.addBuilding('wall', 5, 5);
  wall.hp = Math.round(wall.maxHp * 0.5);
  city.stock.set('stone', 0);
  city.stock.set('wood', 0);
  city.stock.set('tools', 0);

  const hpBefore = wall.hp;
  repairInfrastructure(city, map);
  check('no materials means no repair happens', wall.hp === hpBefore, `${hpBefore} -> ${wall.hp}`);

  city.stock.set('stone', 500);
  city.stock.set('wood', 500);
  city.stock.set('tools', 500);
  repairInfrastructure(city, map);
  check('materials in stock actually get spent on repair', wall.hp > hpBefore, `${hpBefore} -> ${wall.hp}`);
  check('repair consumed stone from the stockpile', city.stock.get('stone') < 500, `${city.stock.get('stone')}`);
}

// ---------- 5. Railway: connected components sever on heavy damage ----------
{
  const map = new TileMap(30, 30, 'single_continent', 444);
  const rail = new RailwayNetwork();
  const line = [
    { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }
  ];
  forceLand(map, line);
  for (const p of line) check(`segment (${p.x},${p.y}) was actually laid`, rail.layTrack(map, p.x, p.y, 'k1'));

  const before = rail.components(map);
  check('a freshly laid line is one component', before.length === 1 && before[0].length === 5, `${before.length} comps`);

  // Sever the middle segment.
  map.getTile(7, 5)!.railDamage = 0.9;
  const after = rail.components(map);
  check('heavy damage to one segment splits the line in two', after.length === 2, `${after.length} comps`);
}

// ---------- 6. Railway freight only moves what a station actually has and wants ----------
{
  const map = new TileMap(30, 30, 'single_continent', 555);
  const rail = new RailwayNetwork();
  const kingdom = new Kingdom('k1', 'Ironrealm', SpeciesType.STONEKIN, '#94a3b8', 'miner', 1);
  kingdom.research.complete('mining');
  kingdom.research.complete('bronze_working');
  kingdom.research.complete('iron_working');
  kingdom.research.complete('metallurgy'); // wantsGood('coal') requires this

  const miner = new City('miner', 'Coalpit', SpeciesType.STONEKIN, 5, 5, 'Founder', 1);
  const forge = new City('forge', 'Forgetown', SpeciesType.STONEKIN, 6, 5, 'Founder', 1);
  miner.kingdomId = 'k1';
  forge.kingdomId = 'k1';
  forge.addBuilding('smithy', 6, 5);
  kingdom.cityIds.add('miner');
  kingdom.cityIds.add('forge');

  miner.stock.set('coal', 100);
  const cities = new Map([['miner', miner], ['forge', forge]]);
  const kingdoms = new Map([['k1', kingdom]]);

  const world: RailwayWorld = {
    year: 10,
    cities,
    kingdoms,
    tileMap: map,
    diplomacy: { isAtWar: () => false },
    trade: { hasAgreement: () => true, isEmbargoed: () => false }
  };

  // No track laid yet: nothing should move.
  rail.tickFreight(world);
  check('no track means no freight moves', forge.stock.get('coal') === 0, `${forge.stock.get('coal')}`);

  forceLand(map, [{ x: 5, y: 5 }, { x: 6, y: 5 }]);
  map.getTile(5, 5)!.cityId = 'miner';
  map.getTile(6, 5)!.cityId = 'forge';
  rail.layTrack(map, 5, 5, 'k1');
  rail.layTrack(map, 6, 5, 'k1');
  rail.tickFreight(world);
  check('connected track moves coal to the smithy that wants it', forge.stock.get('coal') > 0, `${forge.stock.get('coal')}`);
  check('the miner is left with its surplus floor, not drained to zero', miner.stock.get('coal') >= 5, `${miner.stock.get('coal')}`);

  const delivered = forge.stock.get('coal');
  // CityLedger.flow() only reads the rolled-over year (see Phase B) — close the
  // books before checking what got recorded this year.
  miner.ledger.rollOver();
  forge.ledger.rollOver();
  check('the move is booked in both ledgers', miner.ledger.flow('coal').exported >= delivered - 0.01 &&
    forge.ledger.flow('coal').imported >= delivered - 0.01,
    `exported=${miner.ledger.flow('coal').exported} imported=${forge.ledger.flow('coal').imported}`);
}

// ---------- 7. Railway freight respects a war/embargo border closure ----------
{
  const map = new TileMap(30, 30, 'single_continent', 666);
  const rail = new RailwayNetwork();
  const kA = new Kingdom('kA', 'Alpha', SpeciesType.STONEKIN, '#94a3b8', 'a1', 1);
  const kB = new Kingdom('kB', 'Beta', SpeciesType.STONEKIN, '#f87171', 'b1', 1);
  for (const k of [kA, kB]) {
    k.research.complete('mining');
    k.research.complete('bronze_working');
    k.research.complete('iron_working');
    k.research.complete('metallurgy');
  }

  const a1 = new City('a1', 'Mineburg', SpeciesType.STONEKIN, 5, 5, 'Founder', 1);
  const b1 = new City('b1', 'Steelburg', SpeciesType.STONEKIN, 6, 5, 'Founder', 1);
  a1.kingdomId = 'kA'; b1.kingdomId = 'kB';
  b1.addBuilding('smithy', 6, 5);
  a1.stock.set('coal', 100);

  forceLand(map, [{ x: 5, y: 5 }, { x: 6, y: 5 }]);
  map.getTile(5, 5)!.cityId = 'a1';
  map.getTile(6, 5)!.cityId = 'b1';
  rail.layTrack(map, 5, 5, 'kA');
  rail.layTrack(map, 6, 5, 'kB');

  const cities = new Map([['a1', a1], ['b1', b1]]);
  const kingdoms = new Map([['kA', kA], ['kB', kB]]);

  const atWar: RailwayWorld = {
    year: 1, cities, kingdoms, tileMap: map,
    diplomacy: { isAtWar: () => true },
    trade: { hasAgreement: () => true, isEmbargoed: () => false }
  };
  rail.tickFreight(atWar);
  check('rail freight does not cross a war border', b1.stock.get('coal') === 0, `${b1.stock.get('coal')}`);

  const noTreaty: RailwayWorld = {
    year: 2, cities, kingdoms, tileMap: map,
    diplomacy: { isAtWar: () => false },
    trade: { hasAgreement: () => false, isEmbargoed: () => false }
  };
  rail.tickFreight(noTreaty);
  check('rail freight does not cross into a realm with no trade agreement', b1.stock.get('coal') === 0, `${b1.stock.get('coal')}`);

  const friendly: RailwayWorld = {
    year: 3, cities, kingdoms, tileMap: map,
    diplomacy: { isAtWar: () => false },
    trade: { hasAgreement: () => true, isEmbargoed: () => false }
  };
  rail.tickFreight(friendly);
  check('rail freight crosses once the two realms have a real trade agreement', b1.stock.get('coal') > 0, `${b1.stock.get('coal')}`);
}

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
if (failures > 0) process.exitCode = 1;
