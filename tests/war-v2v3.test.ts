import assert from 'node:assert/strict';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { Entity } from '../src/entities/Entity';
import { SpeciesType } from '../src/entities/Species';
import { DiplomacyManager } from '../src/civ/Diplomacy';
import { RailwayNetwork } from '../src/civ/RailwayNetwork';
import { WarFrontSystem, SIEGE_GATE_PUSH } from '../src/civ/WarFronts';
import { MilitaryLogistics } from '../src/civ/MilitaryLogistics';
import { WarfareSystem } from '../src/civ/Warfare';
import { rng } from '../src/core/Random';

/**
 * WAR-V2 and WAR-V3, on ground we control.
 *
 * A war is only interesting if it can be going differently in two places at
 * once, if ground has to be taken before a city can be, and if the line behind
 * an army decides what that army is worth. Every case below builds exactly the
 * situation it is about, so a failure means the war model is wrong rather than
 * that a procedural world moved.
 */

const SIZE = 96;

function flatWorld(): TileMap {
  const map = new TileMap(SIZE, SIZE, 'single_continent', 90210);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.getTile(x, y)!;
      t.type = TerrainType.GRASS;
      t.height = 0.5;
      t.roadLevel = 0;
      t.roadDamage = 0;
      t.railLevel = 0;
      t.railDamage = 0;
      t.buildingId = null;
      t.cityId = null;
      t.kingdomId = null;
      t.resourceType = null;
    }
  }
  map.updateRegionStates(SIZE / 2, SIZE / 2);
  return map;
}

interface Harness {
  map: TileMap;
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
  entities: Entity[];
  diplomacy: DiplomacyManager;
  railways: RailwayNetwork;
  fronts: WarFrontSystem;
  logistics: MilitaryLogistics;
  year: number;
}

function harness(): Harness {
  rng.setSeed(4711);
  return {
    map: flatWorld(),
    cities: new Map(),
    kingdoms: new Map(),
    entities: [],
    diplomacy: new DiplomacyManager(),
    railways: new RailwayNetwork(),
    fronts: new WarFrontSystem(),
    logistics: new MilitaryLogistics(),
    year: 100
  };
}

/** A settlement of `population`, owning a disc of ground around itself. */
function settle(h: Harness, id: string, kingdomId: string, x: number, y: number, population = 60, radius = 6): City {
  const city = new City(id, `City_${id}`, SpeciesType.HUMAN, x, y, 'Fundador', 1);
  city.kingdomId = kingdomId;
  city.population = population;
  city.updateTier();
  h.cities.set(id, city);

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.hypot(dx, dy) > radius) continue;
      const tx = x + dx, ty = y + dy;
      const tile = h.map.getTile(tx, ty);
      if (!tile || tile.kingdomId) continue;
      tile.kingdomId = kingdomId;
      tile.cityId = id;
      city.territory.add(`${tx},${ty}`);
    }
  }
  return city;
}

function realm(h: Harness, id: string, name: string, capital: string): Kingdom {
  const k = new Kingdom(id, name, SpeciesType.HUMAN, '#888', capital, 1);
  h.kingdoms.set(id, k);
  return k;
}

function soldiers(h: Harness, kingdomId: string, x: number, y: number, count: number, power = 1): Entity[] {
  const made: Entity[] = [];
  for (let i = 0; i < count; i++) {
    const e = new Entity(`s_${kingdomId}_${x}_${y}_${i}`, SpeciesType.HUMAN, x + (i % 3) * 0.4, y + Math.floor(i / 3) * 0.4);
    e.age = 25;
    e.kingdomId = kingdomId;
    e.profession = 'soldier';
    e.damage = 10 * power;
    e.defense = 6 * power;
    e.level = 2;
    e.hp = e.maxHp;
    h.entities.push(e);
    made.push(e);
  }
  return made;
}

const frontWorld = (h: Harness) => ({
  year: h.year, cities: h.cities, kingdoms: h.kingdoms,
  entities: h.entities, tileMap: h.map, diplomacy: h.diplomacy
});
const logiWorld = (h: Harness) => ({ ...frontWorld(h), railways: h.railways, fronts: h.fronts });

/** The sector nearest a point — a border can hold several, so never assume one. */
function sectorAt(h: Harness, x: number, y: number) {
  let best: any = null, bestD = Infinity;
  for (const s of h.fronts.sectors.values()) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bestD) { bestD = d; best = s; }
  }
  assert.ok(best, 'expected at least one sector');
  return best!;
}

/** One full war year, in the order the engine runs it. */
function warYear(h: Harness, warfare?: WarfareSystem): void {
  h.fronts.tickYear(frontWorld(h));
  h.logistics.tickYear(logiWorld(h));
  h.fronts.resolveYear(frontWorld(h));
  if (warfare) warfare.tickYear({ ...frontWorld(h), fronts: h.fronts });
  h.year++;
}

// ============================================================
// WAR-V2
// ============================================================

// --- A front forms where realms face each other, in more than one place -----
{
  const h = harness();
  realm(h, 'A', 'Norte', 'a1');
  realm(h, 'B', 'Sul', 'b1');
  // A long border: two facing pairs, far apart along it.
  settle(h, 'a1', 'A', 24, 24); settle(h, 'a2', 'A', 24, 62);
  settle(h, 'b1', 'B', 46, 24); settle(h, 'b2', 'B', 46, 62);
  h.kingdoms.get('A')!.cityIds = new Set(['a1', 'a2']);
  h.kingdoms.get('B')!.cityIds = new Set(['b1', 'b2']);
  h.diplomacy.declareWar('A', 'B', h.year, 'Disputa territorial');

  h.fronts.tickYear(frontWorld(h));

  const sectors = [...h.fronts.sectors.values()];
  assert.ok(sectors.length >= 2, `a long border should hold more than one sector, got ${sectors.length}`);
  const spread = Math.max(...sectors.map(s => s.y)) - Math.min(...sectors.map(s => s.y));
  assert.ok(spread > 20, `sectors should be distributed along the border, spread was ${spread}`);
  for (const s of sectors) {
    assert.equal(s.push, 0, 'a fresh sector starts on the line where the realms met');
  }
}

// --- A lone warband cannot annex a realm ------------------------------------
// The case the whole phase exists for.
{
  const h = harness();
  realm(h, 'A', 'Invasor', 'a1');
  realm(h, 'B', 'Defensor', 'b1');
  settle(h, 'a1', 'A', 20, 40);
  const target = settle(h, 'b1', 'B', 44, 40, 60);
  h.kingdoms.get('A')!.cityIds = new Set(['a1']);
  h.kingdoms.get('B')!.cityIds = new Set(['b1']);
  h.diplomacy.declareWar('A', 'B', h.year, 'Conquista');

  // An overwhelming army standing right on the town, and nothing else: no
  // ground taken, no border won, no corridor cut.
  soldiers(h, 'A', 44, 41, 30, 6);

  const warfare = new WarfareSystem();
  for (let i = 0; i < 12; i++) warYear(h, warfare);

  assert.equal(target.kingdomId, 'B', 'a city was annexed without the ground around it being taken');
  assert.ok(
    target.siegeProgress <= 0.4,
    `siege progress should stall without the front, was ${target.siegeProgress.toFixed(2)}`
  );
}

// --- Ground changes hands gradually, and the line moves --------------------
{
  const h = harness();
  realm(h, 'A', 'Forte', 'a1');
  realm(h, 'B', 'Fraco', 'b1');
  settle(h, 'a1', 'A', 30, 40);
  settle(h, 'b1', 'B', 50, 40);
  h.kingdoms.get('A')!.cityIds = new Set(['a1']);
  h.kingdoms.get('B')!.cityIds = new Set(['b1']);
  h.diplomacy.declareWar('A', 'B', h.year, 'Conquista');

  // Both sides man the line; A is far stronger, so A should advance.
  soldiers(h, 'A', 40, 40, 20, 4);
  soldiers(h, 'B', 41, 40, 4, 1);
  // Depots, so neither side is judged on an empty stomach.
  for (const id of ['a1', 'b1']) {
    const c = h.cities.get(id)!;
    c.stock.add('food', 900);
    c.stock.add('tools', 400);
  }

  const owned = () => {
    let a = 0, b = 0;
    for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) {
      const t = h.map.getTile(x, y)!;
      if (t.kingdomId === 'A') a++;
      else if (t.kingdomId === 'B') b++;
    }
    return { a, b };
  };

  const before = owned();
  const pushes: number[] = [];
  for (let i = 0; i < 6; i++) {
    warYear(h);
    pushes.push(sectorAt(h, 40, 40).push);
  }
  const after = owned();

  const front = sectorAt(h, 40, 40);
  const aIsSideA = front.aId === 'A';
  const advance = aIsSideA ? front.push : -front.push;

  assert.ok(advance > 0.1, `the stronger side should be advancing, push was ${advance.toFixed(2)}`);
  assert.ok(after.a > before.a, 'the advancing realm should have gained ground');
  assert.ok(after.b < before.b, 'the losing realm should have lost ground');
  assert.ok(
    h.cities.get('b1')!.kingdomId === 'B',
    'losing the countryside is not the same as losing the city'
  );
  // Continuous, not a flip: each year moves the line a bounded amount.
  for (let i = 1; i < pushes.length; i++) {
    assert.ok(pushes[i] - pushes[i - 1] <= 0.23 + 1e-9, `the line jumped ${pushes[i] - pushes[i - 1]} in one year`);
  }
  assert.ok(pushes[pushes.length - 1] > pushes[0], 'the line should keep moving while one side dominates');
}

// --- A settlement whose corridor home is overrun becomes isolated ----------
{
  const h = harness();
  realm(h, 'A', 'Cercador', 'a1');
  realm(h, 'B', 'Cercado', 'bCap');
  settle(h, 'a1', 'A', 10, 40, 60, 4);
  settle(h, 'bCap', 'B', 30, 40, 80, 5);
  const outpost = settle(h, 'bOut', 'B', 70, 40, 30, 5);
  h.kingdoms.get('A')!.cityIds = new Set(['a1']);
  h.kingdoms.get('B')!.cityIds = new Set(['bCap', 'bOut']);
  h.diplomacy.declareWar('A', 'B', h.year, 'Cerco');

  h.fronts.tickYear(frontWorld(h));
  h.fronts.resolveYear(frontWorld(h));
  assert.ok(!h.fronts.isIsolated(outpost.id), 'an outpost with a clear road home is not isolated');

  // Drive a wall of hostile ground clean across the corridor between them.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 48; x <= 52; x++) {
      const t = h.map.getTile(x, y)!;
      t.kingdomId = 'A';
      t.cityId = 'a1';
    }
  }

  h.fronts.tickYear(frontWorld(h));
  h.fronts.resolveYear(frontWorld(h));

  assert.ok(
    h.fronts.isIsolated(outpost.id),
    'a settlement cut off from its capital by enemy ground should be isolated'
  );
  assert.ok(!h.fronts.isIsolated('bCap'), 'the seat of power is never isolated from itself');
}

// ============================================================
// WAR-V3
// ============================================================

function supplyHarness() {
  const h = harness();
  realm(h, 'A', 'Abastecido', 'depot');
  realm(h, 'B', 'Inimigo', 'b1');
  const depot = settle(h, 'depot', 'A', 20, 40, 80, 5);
  settle(h, 'railhead', 'A', 40, 40, 40, 4);
  h.cities.get('railhead')!.kingdomId = 'A';
  settle(h, 'b1', 'B', 50, 40, 60, 5);
  h.kingdoms.get('A')!.cityIds = new Set(['depot', 'railhead']);
  h.kingdoms.get('B')!.cityIds = new Set(['b1']);
  h.diplomacy.declareWar('A', 'B', h.year, 'Guerra');
  depot.stock.add('food', 2000);
  depot.stock.add('tools', 900);
  return h;
}

// --- An army with a depot behind it is supplied; one without is not --------
{
  const h = supplyHarness();
  soldiers(h, 'A', 45, 40, 10);
  h.fronts.tickYear(frontWorld(h));
  h.logistics.tickYear(logiWorld(h));

  const sector = sectorAt(h, 45, 40);
  const supply = h.fronts.sideOf(sector, 'A') === 'a' ? sector.supplyA : sector.supplyB;
  assert.ok(supply > 0.8, `an army with a full depot in reach should be fed, supply was ${supply.toFixed(2)}`);

  const line = h.logistics.lineFor(sector.id, 'A');
  assert.ok(line, 'a supplied sector should have a line describing how');
  assert.ok(line!.foodDelivered > 0, 'food should actually leave the depot');
  assert.ok(h.cities.get('depot')!.stock.get('food') < 2000, 'the depot pays for it');

  // Empty every store in the realm and the same army starves.
  for (const id of ['depot', 'railhead']) {
    const c = h.cities.get(id)!;
    c.stock.take('food', c.stock.get('food'));
    c.stock.take('tools', c.stock.get('tools'));
  }
  h.logistics.tickYear(logiWorld(h));
  const starved = h.fronts.sideOf(sector, 'A') === 'a' ? sector.supplyA : sector.supplyB;
  assert.ok(starved < 0.3, `an army with nothing behind it should be starving, supply was ${starved.toFixed(2)}`);
}

// --- Rail carries a war; road merely serves it -----------------------------
{
  const roadOnly = supplyHarness();
  soldiers(roadOnly, 'A', 45, 40, 12);
  roadOnly.fronts.tickYear(frontWorld(roadOnly));
  roadOnly.logistics.tickYear(logiWorld(roadOnly));
  const roadSector = sectorAt(roadOnly, 45, 40);
  const roadLine = roadOnly.logistics.lineFor(roadSector.id, 'A')!;

  const railed = supplyHarness();
  soldiers(railed, 'A', 45, 40, 12);
  // Lay track from the depot to the settlement behind the front.
  for (let x = 20; x <= 40; x++) railed.railways.layTrack(railed.map, x, 40, 'A');
  railed.fronts.tickYear(frontWorld(railed));
  railed.logistics.tickYear(logiWorld(railed));
  const railSector = sectorAt(railed, 45, 40);
  const railLine = railed.logistics.lineFor(railSector.id, 'A')!;

  assert.equal(railLine.mode, 'rail', 'a military railway to the front should be used as one');
  assert.notEqual(roadLine.mode, 'rail', 'without track there is no rail line');
  assert.ok(
    railLine.capacity > roadLine.capacity * 1.5,
    `rail should move far more than road: rail ${railLine.capacity.toFixed(0)} vs road ${roadLine.capacity.toFixed(0)}`
  );
}

// --- Wreck the railway and the front it fed weakens ------------------------
// The example the phase was asked for, end to end.
{
  const h = supplyHarness();
  // A big army, so demand outruns what a road could carry and rail matters.
  soldiers(h, 'A', 45, 40, 40);
  for (let x = 20; x <= 40; x++) h.railways.layTrack(h.map, x, 40, 'A');

  h.fronts.tickYear(frontWorld(h));
  h.logistics.tickYear(logiWorld(h));
  const sector = sectorAt(h, 45, 40);
  const side = h.fronts.sideOf(sector, 'A')!;
  const intactSupply = side === 'a' ? sector.supplyA : sector.supplyB;
  const intactLine = h.logistics.lineFor(sector.id, 'A')!;
  assert.equal(intactLine.mode, 'rail');
  assert.ok(intactLine.integrity > 0.8, `an untouched line should be sound, was ${intactLine.integrity.toFixed(2)}`);

  // Blow the track: every rail tile ruined.
  for (let x = 20; x <= 40; x++) {
    const t = h.map.getTile(x, 40)!;
    if (t.railLevel > 0) t.railDamage = 1;
  }

  h.logistics.tickYear(logiWorld(h));
  const brokenLine = h.logistics.lineFor(sector.id, 'A')!;
  const brokenSupply = side === 'a' ? sector.supplyA : sector.supplyB;

  assert.ok(
    brokenLine.integrity < intactLine.integrity || brokenLine.mode !== 'rail',
    'a destroyed railway must not deliver as if it were whole'
  );
  assert.ok(
    brokenSupply < intactSupply,
    `supply should fall when the line is cut: ${intactSupply.toFixed(2)} -> ${brokenSupply.toFixed(2)}`
  );
}

// --- An unsupplied army loses men without a battle ------------------------
{
  const h = supplyHarness();
  const army = soldiers(h, 'A', 45, 40, 8);
  // Nothing in any store: the front is at the end of a cut line.
  for (const id of ['depot', 'railhead']) {
    const c = h.cities.get(id)!;
    c.stock.take('food', c.stock.get('food'));
    c.stock.take('tools', c.stock.get('tools'));
  }
  const before = army.reduce((sum, e) => sum + e.hp, 0);

  h.fronts.tickYear(frontWorld(h));
  h.logistics.tickYear(logiWorld(h));

  const after = army.reduce((sum, e) => sum + e.hp, 0);
  assert.ok(after < before, 'an army at the end of a cut line should be wasting away');
  assert.ok(
    army.some(e => e.needs.hunger > 0),
    'and the men should actually be hungry, not merely weaker'
  );
}

// --- Supply is what a paper army is worth ---------------------------------
// Same bodies, same ground: only the stores differ.
{
  const fed = supplyHarness();
  soldiers(fed, 'A', 45, 40, 14);
  soldiers(fed, 'B', 46, 40, 14);
  fed.cities.get('b1')!.stock.add('food', 2000);
  fed.cities.get('b1')!.stock.add('tools', 900);
  for (let i = 0; i < 4; i++) warYear(fed);
  const evenPush = Math.abs(sectorAt(fed, 45, 40).push);

  const hungry = supplyHarness();
  soldiers(hungry, 'A', 45, 40, 14);
  soldiers(hungry, 'B', 46, 40, 14);
  // B has nothing at all; A has a full depot.
  const bCity = hungry.cities.get('b1')!;
  bCity.stock.take('food', bCity.stock.get('food'));
  bCity.stock.take('tools', bCity.stock.get('tools'));
  for (let i = 0; i < 4; i++) warYear(hungry);
  const sector = sectorAt(hungry, 45, 40);
  const aAdvance = hungry.fronts.pushFor(sector, 'A');

  assert.ok(evenPush < 0.12, `two equally supplied armies should deadlock, push was ${evenPush.toFixed(2)}`);
  assert.ok(aAdvance > 0.1, `a fed army should beat an identical starving one, push was ${aAdvance.toFixed(2)}`);
}

console.log('war-v2v3.test: fronts form and move, ground is taken gradually, cities are cut off, and supply decides what an army is worth');
