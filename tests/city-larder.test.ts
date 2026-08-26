/**
 * The city store is the only larder: citizens eat off its shelves, a reserve is
 * held back from casual meals, and someone actually starving eats into it.
 */
import { SimulationEngine } from '../src/ai/EntityAI';
import { City } from '../src/civ/City';
import { Household } from '../src/civ/Household';
import { SpeciesType } from '../src/entities/Species';
import { Entity } from '../src/entities/Entity';
import { HUNGER_STARVING, MEAL_ADULT } from '../src/entities/Needs';
import assert from 'node:assert/strict';

function town(food: number, population: number): { sim: SimulationEngine; city: City; e: Entity } {
  const sim = new SimulationEngine();
  const city = new City('c', 'Vila', SpeciesType.HUMAN, 10, 10, 'Founder', 1);
  city.population = population;
  // A new city is founded holding food already, against a capped store. Clear
  // it and raise the cap so the scenario is exactly the number asked for.
  city.stock.capacity = Math.max(city.stock.capacity, food * 2 + 10);
  city.stock.take('food', city.stock.get('food'));
  city.stock.add('food', food);
  assert.equal(city.stock.get('food'), food, 'scenario holds the food it asked for');
  sim.cities.set(city.id, city);
  const e = new Entity('e1', SpeciesType.HUMAN, 10, 10);
  e.cityId = city.id;
  sim.entities.push(e);
  return { sim, city, e };
}

// The private eater, reached the way the daily pass reaches it.
const eat = (sim: SimulationEngine, e: Entity, starving: boolean) =>
  (sim as any).eatFromCityStore(e, MEAL_ADULT, starving) as boolean;

// ---- a well-stocked store feeds people, and the food really leaves it ----
{
  const { sim, city, e } = town(500, 100);
  const before = city.stock.get('food');
  assert.equal(eat(sim, e, false), true, 'a full store feeds a citizen');
  assert.ok(Math.abs(city.stock.get('food') - (before - MEAL_ADULT)) < 1e-9, 'the meal leaves the store');
  // Recorded as consumption, which is the only book there is now: the aggregate
  // annual ration that used to double-count these mouths is gone. The ledger
  // reports closed years, so close one to read it.
  city.ledger.rollOver();
  assert.ok(Math.abs(city.ledger.flow('food').consumed - MEAL_ADULT) < 1e-9, 'and is recorded as eaten');
}

// ---- the reserve is held back from a casual meal ----
{
  // 100 people, so the floor is 150. A store of 150 has nothing spare.
  const { sim, city, e } = town(150, 100);
  assert.equal(eat(sim, e, false), false, 'a merely hungry citizen does not eat the reserve');
  assert.equal(city.stock.get('food'), 150, 'and the store is untouched');

  // ---- but starvation does eat into it ----
  e.needs.hunger = HUNGER_STARVING;
  assert.equal(eat(sim, e, true), true, 'someone starving eats the reserve rather than dying beside it');
  assert.ok(city.stock.get('food') < 150, 'the store gives it up');
}

// ---- an empty store feeds nobody, however desperate ----
{
  const { sim, e } = town(0, 10);
  assert.equal(eat(sim, e, true), false, 'no food is no food');
}

// ---- a citizen with no settlement has no store to eat from ----
{
  const { sim, e } = town(500, 10);
  e.cityId = null;
  assert.equal(eat(sim, e, true), false, 'a wanderer forages instead');
}

// ---- a household is who lives there, and survives a save round trip ----
{
  const h = new Household('hh', 'c', 'house1', 7);
  h.memberIds.add('a');
  h.memberIds.add('b');
  const back = Household.deserialize(JSON.parse(JSON.stringify(h.serialize())));
  assert.equal(back.size, 2);
  assert.equal(back.cityId, 'c');
  assert.equal(back.homeBuildingId, 'house1');
  assert.equal(back.foundedYear, 7);

  // A pre-purge save carried a purse and a pantry. Loading one must not fail.
  const legacy = Household.deserialize({
    id: 'old', cityId: 'c', homeBuildingId: null, memberIds: ['x'], foundedYear: 3,
    coin: 240, pantry: { food: 12 }
  } as any);
  assert.equal(legacy.size, 1);
  assert.equal(legacy.foundedYear, 3);
  assert.equal((legacy as any).coin, undefined, 'no purse survives the load');
  assert.equal((legacy as any).pantry, undefined, 'no pantry either');
}

console.log('city-larder.test: store feeds people, reserve holds, starvation overrides, saves load');
