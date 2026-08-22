import assert from 'node:assert/strict';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { CivilizationEngine } from '../src/civ/CivilizationEngine';
import { UrbanLifecycleManager } from '../src/civ/UrbanLifecycle';
import { SpeciesType } from '../src/entities/Species';

/**
 * The stone supply, tested where it actually broke.
 *
 * Fortification costs stone and timber together, so `FortificationPlanner`
 * fails on `materials` for as long as a realm cannot produce or move any. Two
 * faults did that, and neither was a shortage of rock: workings stood on ground
 * they had already emptied and never came down, and a realm had no way at all to
 * move a staple between its own settlements.
 */

function grassWorld(size = 48): TileMap {
  const map = new TileMap(size, size, 'single_continent', 4242);
  for (let x = 0; x < map.width; x++) {
    for (let y = 0; y < map.height; y++) {
      const t = map.getTile(x, y)!;
      t.type = TerrainType.GRASS;
      t.height = 0.5;
      t.buildingId = null;
      t.resourceType = null;
      t.resourceAmount = 0;
    }
  }
  map.updateRegionStates(size / 2, size / 2);
  return map;
}

function town(id: string, x: number, y: number, population: number): City {
  const c = new City(id, `Town${id}`, SpeciesType.HUMAN, x, y, 'Fundador', 1);
  c.kingdomId = 'k1';
  c.population = population;
  c.updateTier();
  return c;
}

// --- A working that has emptied its ground comes down -----------------------
// Without this the plot is held for the rest of the game, and a city that has
// mined out its only quarry can never open another anywhere.
{
  const map = grassWorld();
  const city = town('c1', 20, 20, 40);
  const quarry = city.addBuilding('quarry', 22, 20);
  map.getTile(22, 20)!.buildingId = quarry.id;

  // Standing on ground it has already emptied.
  quarry.depositExhausted = true;
  quarry.staffing = 0.15;

  const before = city.buildings.size;
  let retired = false;
  // The lifecycle runs on a cadence and only looks at part of the town each
  // pass, so give it years rather than one tick.
  for (let year = 2; year < 90 && !retired; year++) {
    UrbanLifecycleManager.tickCity(city, null, map, year);
    if (quarry.lifecycleState !== 'normal' || !city.buildings.has(quarry.id)) retired = true;
  }

  assert.ok(
    retired,
    'a quarry on worked-out ground was never abandoned — it will hold its plot forever'
  );
  assert.ok(city.buildings.size <= before, 'retiring a working should not add buildings');
}

// --- A working with ground left is left alone -------------------------------
// The pressure must come from the seam being gone, not from being a quarry.
{
  const map = grassWorld();
  const city = town('c2', 20, 20, 40);
  city.prosperity = 0.8;
  city.peakPopulation = 40;
  const quarry = city.addBuilding('quarry', 22, 20);
  map.getTile(22, 20)!.buildingId = quarry.id;
  quarry.depositExhausted = false;
  quarry.staffing = 1;

  for (let year = 2; year < 60; year++) UrbanLifecycleManager.tickCity(city, null, map, year);

  assert.equal(
    quarry.lifecycleState,
    'normal',
    'a working with deposit left, fully staffed, in a prosperous town should not be abandoned'
  );
}

// --- A realm moves a staple to the settlement that ran short ----------------
{
  const civ = new CivilizationEngine();
  const rich = town('rich', 10, 10, 30);
  const poor = town('poor', 22, 14, 60);

  rich.stock.add('stone', 200);
  poor.stock.take('stone', poor.stock.get('stone')); // start it at nothing

  const kingdom = new Kingdom('k1', 'Reino', SpeciesType.HUMAN, '#fff', rich.id, 1);
  kingdom.cityIds = new Set([rich.id, poor.id]) as any;

  const world = { cities: new Map([[rich.id, rich], [poor.id, poor]]) } as any;

  const richBefore = rich.stock.get('stone');
  (civ as any).distributeStaples(kingdom, world);

  const moved = richBefore - rich.stock.get('stone');
  const arrived = poor.stock.get('stone');

  assert.ok(arrived > 0, 'a realm should be able to supply its own short settlement');
  assert.ok(moved > 0 && moved <= 30, `a shipment is capped per year, moved ${moved}`);
  assert.ok(arrived < moved, 'hauling costs something — nothing should arrive whole');
  assert.ok(
    rich.stock.get('stone') >= 25,
    `the donor keeps its floor, held ${rich.stock.get('stone')}`
  );
  assert.ok(arrived <= 50, `a receiver is only topped up to its target, got ${arrived}`);
}

// --- Nobody is stripped to supply somebody else -----------------------------
{
  const civ = new CivilizationEngine();
  const a = town('a', 10, 10, 30);
  const b = town('b', 16, 12, 30);
  // Both are short; neither is above the donor floor.
  for (const c of [a, b]) c.stock.take('stone', c.stock.get('stone'));
  a.stock.add('stone', 20);

  const kingdom = new Kingdom('k1', 'Reino', SpeciesType.HUMAN, '#fff', a.id, 1);
  kingdom.cityIds = new Set([a.id, b.id]) as any;
  const world = { cities: new Map([[a.id, a], [b.id, b]]) } as any;

  (civ as any).distributeStaples(kingdom, world);

  assert.equal(a.stock.get('stone'), 20, 'a settlement below the floor must not be raided');
  assert.equal(b.stock.get('stone'), 0, 'and nothing should arrive from one');
}

// --- Distance bounds the haul ----------------------------------------------
{
  const civ = new CivilizationEngine();
  const rich = town('rich', 5, 5, 30);
  const faraway = town('far', 100, 100, 30);
  rich.stock.add('stone', 200);
  faraway.stock.take('stone', faraway.stock.get('stone'));

  const kingdom = new Kingdom('k1', 'Reino', SpeciesType.HUMAN, '#fff', rich.id, 1);
  kingdom.cityIds = new Set([rich.id, faraway.id]) as any;
  const world = { cities: new Map([[rich.id, rich], [faraway.id, faraway]]) } as any;

  (civ as any).distributeStaples(kingdom, world);

  assert.equal(faraway.stock.get('stone'), 0, 'a settlement out of range receives nothing');
}

console.log('eco-staples.test: worked-out sites retire, realms supply their own, nobody is stripped');
