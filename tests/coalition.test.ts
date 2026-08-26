/**
 * Does a runaway realm actually provoke a coalition?
 *
 * Small on purpose: three realms, one of them a giant, a handful of years. The
 * question is whether the balance-of-power reflex fires at all and whether it
 * stays quiet when nobody is dominant — not how a whole world turns out.
 */
import assert from 'node:assert/strict';
import { Kingdom } from '../src/civ/Kingdom';
import { City } from '../src/civ/City';
import { SpeciesType } from '../src/entities/Species';
import { CivilizationEngine } from '../src/civ/CivilizationEngine';
import { DiplomacyManager } from '../src/civ/Diplomacy';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';

function grassWorld(): TileMap {
  const map = new TileMap(48, 48, 'single_continent', 11);
  for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
    const tile = map.getTile(x, y)!;
    tile.type = TerrainType.GRASS;
    tile.height = 0.5;
    tile.fertility = 1;
  }
  return map;
}

/** Three realms in contact, with the military power we choose. */
function scenario(powers: number[]) {
  const map = grassWorld();
  const engine = new CivilizationEngine();
  const kingdoms = new Map<string, Kingdom>();
  const cities = new Map<string, City>();

  powers.forEach((power, index) => {
    const id = `k${index}`;
    const city = new City(`c${index}`, `Reino ${index}`, SpeciesType.HUMAN, 12 + index * 6, 24, 'Fundador', 1);
    city.population = 30;
    const kingdom = new Kingdom(id, `Reino ${index}`, SpeciesType.HUMAN, '#777', city.id, 1);
    kingdom.addCity(city.id);
    city.kingdomId = id;
    kingdoms.set(id, kingdom);
    cities.set(city.id, city);
  });

  const world: any = {
    year: 1, cities, kingdoms, entities: [], tileMap: map,
    diplomacy: new DiplomacyManager(),
    spawn: () => { throw new Error('nao usado'); }
  };

  // Everyone has met everyone, and holds the power we chose.
  for (const [id, kingdom] of kingdoms) {
    for (const other of kingdoms.keys()) if (other !== id) kingdom.knownKingdoms.add(other);
  }
  powers.forEach((power, index) => { kingdoms.get(`k${index}`)!.militaryPower = power; });

  /**
   * The rule under test, called directly.
   *
   * A full `tickYear` would drag in the settlement lifecycle, which abandons a
   * city with no citizens and deletes its realm — so the world being examined
   * would dissolve before the diplomacy ran. The coalition pass reads only
   * militaryPower, knownKingdoms and relations, so it can be exercised on its own.
   */
  const years = (count: number) => {
    for (let year = 1; year <= count; year++) {
      world.year = year;
      (engine as any).tickAntiHegemonicCoalitions(world);
    }
  };

  return { engine, world, kingdoms, years };
}

// ------------------------------------------------- a giant provokes a coalition
{
  const { world, kingdoms, years } = scenario([1000, 120, 100]);
  const before = world.diplomacy.getRelation('k1', 'k2');
  years(12);

  const after = world.diplomacy.getRelation('k1', 'k2');
  const towardGiant = world.diplomacy.getRelation('k1', 'k0');

  assert.ok(after > before, `os ameacados tem de se aproximar (era ${before}, ficou ${after})`);
  assert.ok(towardGiant < 0, `e esfriar com o gigante (ficou ${towardGiant})`);
  assert.ok(
    kingdoms.get('k1')!.externalThreat > 0,
    'a ameaca externa percebida tem de subir'
  );
  console.log(
    `coalition: gigante com 82% do poder · k1<->k2 ${before} -> ${Math.round(after)} · ` +
    `k1->gigante ${Math.round(towardGiant)} · liga ${world.diplomacy.allianceOf('k1') ? 'formada' : 'ainda nao'}`
  );
}

// --------------------------------------------- a balanced world stays balanced
{
  const { world, years } = scenario([100, 100, 100]);
  const before = world.diplomacy.getRelation('k1', 'k2');
  years(12);

  const towardOther = world.diplomacy.getRelation('k1', 'k0');
  assert.ok(
    towardOther >= -6,
    `sem hegemon ninguem deve ser demonizado pela regra de coalizao (ficou ${towardOther})`
  );
  console.log(`coalition: mundo equilibrado (33% cada) nao dispara a regra · k1->k0 ${Math.round(towardOther)}`);
  void before;
}

console.log('coalition.test: passou');
