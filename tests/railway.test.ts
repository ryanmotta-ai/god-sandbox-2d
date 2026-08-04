/**
 * Headless unit test for the railway logistics phase (Phase I).
 * Covers track laying, connected components, war severing, freight movement,
 * border closures, AI construction and save/load compatibility.
 */
import { strict as assert } from 'node:assert';
import { TileMap } from '../src/world/TileMap';
import { TERRAINS } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';
import { RailwayNetwork, RailwayWorld } from '../src/civ/RailwayNetwork';
import { damageRailAround, repairInfrastructure } from '../src/civ/Infrastructure';
import { GoodId } from '../src/civ/Goods';

rng.setSeed(20260802);

function makeMap(size = 16): TileMap {
  rng.setSeed(20260802 + size);
  return new TileMap(size, size, 'single_continent', 42);
}

function landTile(tileMap: TileMap, x: number, y: number): boolean {
  const t = tileMap.getTile(x, y);
  return !!t && !TERRAINS[t.type].isWater;
}

/** A contiguous run of land along row `y` spanning [fromX, toX], or null. */
function landRow(tileMap: TileMap, fromX: number, toX: number, y: number): boolean {
  for (let x = fromX; x <= toX; x++) if (!landTile(tileMap, x, y)) return false;
  return true;
}

function findLandRow(tileMap: TileMap, fromX: number, toX: number): number {
  for (let y = 2; y < tileMap.height - 2; y++) {
    if (landRow(tileMap, fromX, toX, y)) return y;
  }
  throw new Error('no land row');
}

/** Lays a straight horizontal rail line, tagging the ends as city stations. */
function buildLine(
  tileMap: TileMap,
  fromX: number, toX: number, y: number,
  fromCity: string, toCity: string, ownerId: string | null
): void {
  const rail = new RailwayNetwork();
  for (let x = fromX; x <= toX; x++) {
    const ok = rail.layTrack(tileMap, x, y, ownerId);
    assert.ok(ok, `expected layTrack at (${x}, ${y})`);
    const t = tileMap.getTile(x, y)!;
    if (x === fromX) t.cityId = fromCity;
    if (x === toX) t.cityId = toCity;
  }
}

function makeCity(id: string, name: string, x: number, y: number, kingdomId: string | null): City {
  const city = new City(id, name, SpeciesType.LUMINI, x, y, 'Founder', 1);
  city.kingdomId = kingdomId;
  city.x = x;
  city.y = y;
  return city;
}

function makeKingdom(id: string, name: string, cityIds: string[]): Kingdom {
  const k = new Kingdom(id, name, SpeciesType.LUMINI, '#ffffff', cityIds[0] ?? '', 1);
  for (const cid of cityIds) k.cityIds.add(cid);
  return k;
}

interface FakeWorldOptions {
  agreements?: Set<string>;
  embargoes?: Set<string>;
  wars?: Set<string>;
}

function makeWorld(
  tileMap: TileMap,
  cities: Map<string, City>,
  kingdoms: Map<string, Kingdom>,
  opts: FakeWorldOptions = {}
): RailwayWorld & { demandSpy: number } {
  const demandSpy = { count: 0 };
  const pair = (a: string, b: string): string => [a, b].sort().join(',');
  return {
    year: 100,
    cities,
    kingdoms,
    tileMap,
    diplomacy: { isAtWar: (a, b) => !!opts.wars?.has(pair(a, b)) },
    trade: {
      hasAgreement: (a, b) => a === b || !!opts.agreements?.has(pair(a, b)),
      isEmbargoed: (a, b) => a !== b && !!opts.embargoes?.has(pair(a, b))
    },
    market: { reportDemand: () => { demandSpy.count++; } },
    demandSpy
  } as RailwayWorld & { demandSpy: number };
}

// ============================================================
// 1. Laying and removing track
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 8);
  assert.ok(rail.layTrack(tileMap, 3, y, 'k1'), 'land tile lays');
  assert.equal(tileMap.getTile(3, y)!.railLevel, 1);
  assert.equal(tileMap.getTile(3, y)!.railOwnerId, 'k1');
  assert.equal(rail.layTrack(tileMap, 3, y, 'k1'), false, 'double lay rejected');
  assert.equal(tileMap.getTile(3, y)!.railLevel, 1, 'double lay keeps level 1');

  let waterFound = false;
  for (let x = 0; x < tileMap.width; x++) {
    if (!landTile(tileMap, x, 0)) {
      assert.equal(rail.layTrack(tileMap, x, 0, 'k1'), false, 'water never lays');
      waterFound = true;
      break;
    }
  }
  assert.ok(waterFound, 'map has some water to test');

  rail.removeTrack(tileMap, 3, y);
  assert.equal(tileMap.getTile(3, y)!.railLevel, 0);
  assert.equal(tileMap.getTile(3, y)!.railOwnerId, null);
}

// ============================================================
// 2. Connected components and severing
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 9);
  // Two isolated tiles => two components.
  rail.layTrack(tileMap, 3, y, 'k1');
  rail.layTrack(tileMap, 9, y, 'k1');
  assert.equal(rail.components(tileMap).length, 2, 'isolated tiles are separate components');

  // Bridge the gap into one continuous line.
  for (let x = 4; x <= 8; x++) rail.layTrack(tileMap, x, y, 'k1');
  assert.equal(rail.components(tileMap).length, 1, 'connected run is one component');

  // Sever the middle: one broken link splits the line in two.
  const mid = tileMap.getTile(6, y)!;
  mid.railDamage = 1;
  assert.equal(mid.railLevelEffective, 0, 'fully damaged rail severs');
  assert.equal(rail.components(tileMap).length, 2, 'severing cuts one component into two');

  // Light damage keeps the line connected but costs capacity.
  mid.railDamage = 0.3;
  assert.equal(mid.railLevelEffective, 1, 'light damage keeps a rail usable');
  assert.equal(rail.components(tileMap).length, 1, 'light damage does not sever');
}

// ============================================================
// 3. Line quality
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 7);
  for (let x = 2; x <= 6; x++) rail.layTrack(tileMap, x, y, 'k1');
  const tiles = rail.railTiles(tileMap);
  assert.equal(rail.lineQuality(tiles), 1, 'healthy line is full quality');
  const t = tileMap.getTile(4, y)!;
  t.railDamage = 0.5;
  const damagedQ = rail.lineQuality(tiles);
  assert.ok(damagedQ < 1 && damagedQ > 0.5, `damage lowers quality (${damagedQ})`);
  assert.equal(rail.lineQuality([]), 0, 'empty line has no quality');
}

// ============================================================
// 4. Freight floor: nothing ships below the surplus threshold
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 8);
  buildLine(tileMap, 3, 8, y, 'cA', 'cB', 'k1');

  const k1 = makeKingdom('k1', 'Realm A', ['cA', 'cB']);
  k1.research.complete('metallurgy');
  const cityA = makeCity('cA', 'Miner', 3, y, 'k1');
  const cityB = makeCity('cB', 'Forge', 8, y, 'k1');
  cityB.addBuilding('smithy', 8, y);
  const cities = new Map([[cityA.id, cityA], [cityB.id, cityB]]);
  const kingdoms = new Map([[k1.id, k1]]);

  cityA.stock.add('coal', 6); // surplus == 0 exactly
  let world = makeWorld(tileMap, cities, kingdoms);
  rail.tickFreight(world);
  assert.equal(cityB.stock.get('coal'), 0, 'exactly-at-floor stock does not ship');

  cityA.stock.add('coal', 2); // surplus = 2
  world = makeWorld(tileMap, cities, kingdoms);
  rail.tickFreight(world);
  assert.equal(cityB.stock.get('coal'), 2, 'above-floor surplus ships');
  assert.equal(cityA.stock.get('coal'), 6, 'producer drops to the floor');
}

// ============================================================
// 5. Freight moves within a component; ledger + demand recorded
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 9);
  buildLine(tileMap, 3, 9, y, 'cA', 'cB', 'k1');

  const k1 = makeKingdom('k1', 'Realm A', ['cA', 'cB']);
  k1.research.complete('metallurgy');
  const cityA = makeCity('cA', 'Miner', 3, y, 'k1');
  const cityB = makeCity('cB', 'Forge', 9, y, 'k1');
  cityB.addBuilding('smithy', 9, y);
  const cities = new Map([[cityA.id, cityA], [cityB.id, cityB]]);
  const kingdoms = new Map([[k1.id, k1]]);
  cityA.stock.add('coal', 100);

  const world = makeWorld(tileMap, cities, kingdoms);
  const before = world.demandSpy.count;
  rail.tickFreight(world);
  cityA.ledger.rollOver();
  cityB.ledger.rollOver();

  const shipped = 100 - cityA.stock.get('coal');
  assert.ok(shipped >= 6, `surplus shipped over the floor (shipped ${shipped})`);
  assert.ok(shipped <= 10, `shipped at most one route's throughput (shipped ${shipped})`);
  assert.equal(cityB.stock.get('coal'), shipped, 'consumer received exactly what left the producer');
  assert.equal(rail.yearlyFreight, shipped, 'yearlyFreight counts the haul');
  assert.ok(cityA.ledger.flow('coal').exported > 0, 'producer ledger records exports');
  assert.ok(cityB.ledger.flow('coal').imported > 0, 'consumer ledger records imports');
  assert.ok(world.demandSpy.count > before, 'market demand reported for hauled coal');
}

// ============================================================
// 6. Consumer gates: smithy + tech required
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 8);
  buildLine(tileMap, 3, 8, y, 'cA', 'cB', 'k1');
  const k1 = makeKingdom('k1', 'Realm A', ['cA', 'cB']);
  const cityA = makeCity('cA', 'Miner', 3, y, 'k1');
  const cityB = makeCity('cB', 'Plain', 8, y, 'k1');
  const cities = new Map([[cityA.id, cityA], [cityB.id, cityB]]);
  const kingdoms = new Map([[k1.id, k1]]);
  cityA.stock.add('coal', 100);

  // No smithy, no metallurgy: nothing moves.
  rail.tickFreight(makeWorld(tileMap, cities, kingdoms));
  assert.equal(cityB.stock.get('coal'), 0, 'a town with no smithy receives no coal');

  // Smithy without metallurgy: still no coal (but iron would flow).
  cityB.addBuilding('smithy', 8, y);
  rail.tickFreight(makeWorld(tileMap, cities, kingdoms));
  assert.equal(cityB.stock.get('coal'), 0, 'smithy without metallurgy cannot forge coal');
  cityA.stock.add('iron', 100);
  rail.tickFreight(makeWorld(tileMap, cities, kingdoms));
  assert.ok(cityB.stock.get('iron') > 0, 'iron ships to any smithy');
}

// ============================================================
// 7. Border closures: agreement needed, embargo and war block
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 8);
  buildLine(tileMap, 3, 8, y, 'cA', 'cB', 'k1');

  const k1 = makeKingdom('k1', 'Realm A', ['cA']);
  const k2 = makeKingdom('k2', 'Realm B', ['cB']);
  k2.research.complete('metallurgy');
  const cityA = makeCity('cA', 'Miner', 3, y, 'k1');
  const cityB = makeCity('cB', 'Forge', 8, y, 'k2');
  cityB.addBuilding('smithy', 8, y);
  const cities = new Map([[cityA.id, cityA], [cityB.id, cityB]]);
  const kingdoms = new Map([[k1.id, k1], [k2.id, k2]]);
  cityA.stock.add('coal', 100);

  // No treaty: cross-border freight is blocked.
  rail.tickFreight(makeWorld(tileMap, cities, kingdoms));
  assert.equal(cityB.stock.get('coal'), 0, 'no agreement means no cross-border rail');

  // Agreement opens the border.
  const agreed = makeWorld(tileMap, cities, kingdoms, { agreements: new Set(['k1,k2']) });
  rail.tickFreight(agreed);
  const afterAgree = cityB.stock.get('coal');
  assert.ok(afterAgree > 0, 'an agreement opens the border');

  // Embargo shuts it again.
  cityA.stock.add('coal', 100 - cityA.stock.get('coal'));
  const embargoed = makeWorld(tileMap, cities, kingdoms, {
    agreements: new Set(['k1,k2']),
    embargoes: new Set(['k1,k2'])
  });
  cityB.stock.take('coal', cityB.stock.get('coal'));
  rail.tickFreight(embargoed);
  assert.equal(cityB.stock.get('coal'), 0, 'an embargo blocks rail freight');

  // War blocks too.
  cityA.stock.add('coal', 100 - cityA.stock.get('coal'));
  const atWar = makeWorld(tileMap, cities, kingdoms, {
    agreements: new Set(['k1,k2']),
    wars: new Set(['k1,k2'])
  });
  rail.tickFreight(atWar);
  assert.equal(cityB.stock.get('coal'), 0, 'war blocks rail freight');
}

// ============================================================
// 8. Throughput scales with line quality
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 10);
  buildLine(tileMap, 3, 10, y, 'cA', 'cB', 'k1');
  const k1 = makeKingdom('k1', 'Realm A', ['cA', 'cB']);
  k1.research.complete('metallurgy');
  const cityA = makeCity('cA', 'Miner', 3, y, 'k1');
  const cityB = makeCity('cB', 'Forge', 10, y, 'k1');
  cityB.addBuilding('smithy', 10, y);
  const cities = new Map([[cityA.id, cityA], [cityB.id, cityB]]);
  const kingdoms = new Map([[k1.id, k1]]);

  cityA.stock.add('coal', 100);
  rail.tickFreight(makeWorld(tileMap, cities, kingdoms));
  const healthy = cityB.stock.get('coal');
  assert.equal(healthy, 10, 'healthy line moves full throughput');

  // Damage part of the line: still connected, but half the capacity.
  for (let x = 3; x <= 6; x++) {
    tileMap.getTile(x, y)!.railDamage = 0.5;
  }
  cityA.stock.take('coal', cityA.stock.get('coal'));
  cityA.stock.add('coal', 100);
  cityB.stock.take('coal', cityB.stock.get('coal'));
  rail.tickFreight(makeWorld(tileMap, cities, kingdoms));
  const damaged = cityB.stock.get('coal');
  assert.ok(damaged < healthy, `damaged line carries less (${damaged} vs ${healthy})`);
  assert.ok(damaged > 0, 'damaged line still carries something');
}

// ============================================================
// 9. AI construction: coal kingdom lays a line across years
// ============================================================
{
  const tileMap = makeMap(24);
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 18);
  const cityA = makeCity('cA', 'Coalfield', 3, y, 'k1');
  const cityB = makeCity('cB', 'Ironforge', 18, y, 'k1');
  tileMap.getTile(3, y)!.cityId = 'cA';
  tileMap.getTile(18, y)!.cityId = 'cB';

  const k1 = makeKingdom('k1', 'Realm A', ['cA', 'cB']);
  k1.research.complete('metallurgy');
  k1.research.complete('steam_power');
  const mine = cityA.addBuilding('mine', 3, y);
  mine.extractedGood = 'coal';
  mine.staffing = 1;
  cityB.addBuilding('smithy', 18, y);
  cityA.stock.add('coal', 200);
  cityA.stock.capacity = 5000;
  cityA.stock.add('steel', 500);
  cityA.stock.add('wood', 500);

  const cities = new Map([[cityA.id, cityA], [cityB.id, cityB]]);
  const kingdoms = new Map([[k1.id, k1]]);
  const world = makeWorld(tileMap, cities, kingdoms);
  const steelBefore = cityA.stock.get('steel');
  const woodBefore = cityA.stock.get('wood');

  let totalLaid = 0;
  let lineBuilt = false;
  for (let i = 0; i < 120 && !lineBuilt; i++) {
    world.year = 100 + i;
    rail.tickRailways(world);
    totalLaid += rail.yearlyConstructed;
    if (rail.connected(tileMap, cityA, cityB)) lineBuilt = true;
  }
  assert.ok(totalLaid > 0, 'construction laid track over the years');
  assert.ok(lineBuilt, 'the coal line eventually connects producer and consumer');
  assert.ok(rail.linesBuilt >= 1, 'a completed line is recorded');
  assert.ok(cityA.stock.get('steel') < steelBefore, 'construction paid steel');
  assert.ok(cityA.stock.get('wood') < woodBefore, 'construction paid wood');
}

// ============================================================
// 10. Vassals do not build their own lines
// ============================================================
{
  const tileMap = makeMap(24);
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 18);
  const cityA = makeCity('cA', 'Coalfield', 3, y, 'k1');
  const cityB = makeCity('cB', 'Ironforge', 18, y, 'k1');
  tileMap.getTile(3, y)!.cityId = 'cA';
  tileMap.getTile(18, y)!.cityId = 'cB';

  const k1 = makeKingdom('k1', 'Realm A', ['cA', 'cB']);
  k1.overlordId = 'k0';
  k1.research.complete('steam_power');
  k1.research.complete('metallurgy');
  const mine = cityA.addBuilding('mine', 3, y);
  mine.extractedGood = 'coal';
  mine.staffing = 1;
  cityB.addBuilding('smithy', 18, y);
  cityA.stock.add('coal', 200);
  cityA.stock.add('steel', 500);
  cityA.stock.add('wood', 500);

  const cities = new Map([[cityA.id, cityA], [cityB.id, cityB]]);
  const kingdoms = new Map([[k1.id, k1]]);
  const world = makeWorld(tileMap, cities, kingdoms);
  for (let i = 0; i < 5; i++) {
    world.year = 100 + i;
    rail.tickRailways(world);
  }
  assert.equal(rail.yearlyConstructed, 0, 'a vassal lays no track');
  assert.equal(rail.linesBuilt, 0, 'a vassal completes no line');
}

// ============================================================
// 11. Siege damages rails; repair fixes them with steel + stone
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 7);
  buildLine(tileMap, 3, 7, y, 'cA', 'cB', 'k1');

  const damaged = tileMap.getTile(5, y)!;
  damageRailAround(tileMap, 5, y, 1);
  assert.ok(damaged.railDamage > 0, 'siege damage lands on rails');

  const cityA = makeCity('cA', 'Miner', 3, y, 'k1');
  cityA.territory.add(`${damaged.x},${damaged.y}`);
  cityA.stock.add('steel', 50);
  cityA.stock.add('stone', 50);
  const before = damaged.railDamage;
  repairInfrastructure(cityA, tileMap);
  assert.ok(damaged.railDamage < before, 'repair pass heals rail damage');
  assert.ok(damaged.railDamage >= 0, 'rail damage never goes negative');
}

// ============================================================
// 12. Save/load round-trips; old saves load as empty rails
// ============================================================
{
  const tileMap = makeMap();
  const rail = new RailwayNetwork();
  const y = findLandRow(tileMap, 3, 7);
  for (let x = 2; x <= 6; x++) rail.layTrack(tileMap, x, y, 'k1');
  const t = tileMap.getTile(4, y)!;
  t.railDamage = 0.4;

  const data = tileMap.serialize();
  const reload = new TileMap(1, 1, 'single_continent', 1);
  reload.deserialize(data);
  const back = reload.getTile(4, y)!;
  assert.equal(back.railLevel, 1, 'railLevel survives round-trip');
  assert.equal(back.railOwnerId, 'k1', 'railOwnerId survives round-trip');
  assert.ok(Math.abs(back.railDamage - 0.4) < 0.001, 'railDamage survives round-trip');

  // Simulate a save from before railways existed.
  for (const item of data.tiles) {
    delete item.rail;
    delete item.raild;
    delete item.railo;
  }
  const oldReload = new TileMap(1, 1, 'single_continent', 1);
  oldReload.deserialize(data);
  const oldBack = oldReload.getTile(4, y)!;
  assert.equal(oldBack.railLevel, 0, 'old save loads with no rails');
  assert.equal(oldBack.railDamage, 0, 'old save loads with no rail damage');
  assert.equal(oldBack.railOwnerId, null, 'old save loads with no rail owner');
}

console.log('[railway] ALL OK');
