import { strict as assert } from 'node:assert';
import { City } from '../src/civ/City';
import { Kingdom, getNextKingdomColor } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';
import { AirSystem, airServiceAvailable } from '../src/civ/AirSystem';
import { caravanTypeFor } from '../src/civ/CaravanSystem';
import type { TradeRoute } from '../src/civ/Trade';
import type { GoodId } from '../src/civ/Goods';

rng.setSeed(20260805);

function pair(distance: number): { a: City; b: City; routes: Map<string, TradeRoute>; kingdoms: Map<string, Kingdom>; cities: Map<string, City> } {
  const a = new City('a', 'Aeroport', SpeciesType.HUMAN, 10, 20, 'F', 1);
  const b = new City('b', 'Farfield', SpeciesType.HUMAN, 10 + distance, 20, 'F', 1);
  a.population = 900;
  b.population = 700;
  const ka = new Kingdom('ka', 'A', SpeciesType.HUMAN, getNextKingdomColor(), a.id, 0);
  const kb = new Kingdom('kb', 'B', SpeciesType.HUMAN, getNextKingdomColor(), b.id, 0);
  a.kingdomId = ka.id;
  b.kingdomId = kb.id;
  const route: TradeRoute = {
    id: 'r', fromCityId: a.id, toCityId: b.id, fromKingdomId: ka.id, toKingdomId: kb.id,
    kind: 'overland', good: 'tools' as never, volume: 40, maxVolume: 40,
    establishedYear: 0, totalValue: 0, active: true
  };
  return {
    a, b,
    routes: new Map([[route.id, route]]),
    kingdoms: new Map([[ka.id, ka], [kb.id, kb]]),
    cities: new Map([[a.id, a], [b.id, b]])
  };
}

// ============================================================
// 1. Air service needs a working runway at BOTH ends
// ============================================================
{
  const { a, b, routes, cities, kingdoms } = pair(60);
  const air = new AirSystem();

  assert.equal(airServiceAvailable(a, b), false, 'no airports, no service');
  air.updateFlights(routes, cities, kingdoms);
  assert.equal(air.flights.size, 0, 'and nothing takes off');

  a.addBuilding('airport', a.x, a.y);
  assert.equal(airServiceAvailable(a, b), false, 'one end is not a route');

  b.addBuilding('airport', b.x, b.y);
  assert.equal(airServiceAvailable(a, b), true, 'two ends make a service');
  air.updateFlights(routes, cities, kingdoms);
  assert.equal(air.flights.size, 1, 'and a service opens');

  // A bombed runway grounds it, which is what makes an airport worth defending.
  for (const building of a.buildings.values()) if (building.type === 'airport') building.hp = 1;
  air.updateFlights(routes, cities, kingdoms);
  assert.equal(air.flights.size, 0, 'a wrecked runway ends the service');
}

// ============================================================
// 2. Nobody flies between neighbours
// ============================================================
{
  const { a, b, routes, cities, kingdoms } = pair(6);
  a.addBuilding('airport', a.x, a.y);
  b.addBuilding('airport', b.x, b.y);
  assert.equal(airServiceAvailable(a, b), false, 'six tiles is a lorry job, not a flight');
  const air = new AirSystem();
  air.updateFlights(routes, cities, kingdoms);
  assert.equal(air.flights.size, 0, 'so no service opens');
}

// ============================================================
// 3. A flight climbs, cruises, descends, and turns round
// ============================================================
{
  const { a, b, routes, cities, kingdoms } = pair(60);
  a.addBuilding('airport', a.x, a.y);
  b.addBuilding('airport', b.x, b.y);
  const air = new AirSystem();

  const phases = new Set<string>();
  let maxAltitude = 0;
  let minAirborne = 1;
  let arrivals = 0;
  let lastDirection = 1;
  for (let tick = 0; tick < 4000; tick++) {
    air.updateFlights(routes, cities, kingdoms);
    const flight = air.flights.get('r')!;
    if (flight.turnaround === 0) {
      phases.add(flight.phase);
      maxAltitude = Math.max(maxAltitude, flight.altitude);
      minAirborne = Math.min(minAirborne, flight.altitude);
      assert.ok(
        Math.abs(Math.hypot(flight.headingX, flight.headingY) - 1) < 0.001,
        'the heading must stay a unit vector, or the sprite points nowhere'
      );
    }
    if (flight.direction !== lastDirection) { arrivals++; lastDirection = flight.direction; }
  }

  assert.ok(phases.has('takeoff') && phases.has('cruise') && phases.has('landing'),
    `a flight must climb, cruise and descend, saw ${[...phases].join(',')}`);
  assert.ok(maxAltitude > 0.99, 'it has to reach cruising height');
  assert.ok(minAirborne < 0.05, 'and be on the runway at each end');
  assert.ok(arrivals >= 4, `a 60-tile service should turn round several times, got ${arrivals}`);
  assert.ok(air.yearlyFlights === arrivals, 'every arrival is booked exactly once');
}

// ============================================================
// 4. Successive departures do not all carry the same thing
// ============================================================
{
  const { a, b, routes, cities, kingdoms } = pair(60);
  a.addBuilding('airport', a.x, a.y);
  b.addBuilding('airport', b.x, b.y);
  const air = new AirSystem();
  const payloads = new Set<string>();
  for (let tick = 0; tick < 20000; tick++) {
    air.updateFlights(routes, cities, kingdoms);
    payloads.add(air.flights.get('r')!.payload);
  }
  assert.equal(payloads.size, 2, 'an airport that only ever saw cargo would be a depot');
}

// ============================================================
// 5. Freight actually lands, and comes out of the other city's stockpile
// ============================================================
{
  const { a, b, routes, cities, kingdoms } = pair(60);
  a.addBuilding('airport', a.x, a.y);
  b.addBuilding('airport', b.x, b.y);
  const air = new AirSystem();
  const good = 'tools' as GoodId;

  // One end holds the surplus, so there is a gradient to fly down.
  a.stock.add(good, 200);
  const before = a.stock.get(good) + b.stock.get(good);

  const demanded: number[] = [];
  const market = { reportDemand: (_g: GoodId, n: number) => demanded.push(n) };

  for (let tick = 0; tick < 7200; tick++) air.updateFlights(routes, cities, kingdoms, market);

  assert.ok(air.yearlyFlights > 0, 'a year of service has to fly something');
  assert.ok(air.yearlyFreight > 0, 'and freight has to actually arrive, not just be counted');
  assert.equal(
    a.stock.get(good) + b.stock.get(good), before,
    'freight moves between stockpiles; it is not created or destroyed in the air'
  );
  assert.ok(demanded.length > 0, 'the market has to hear the demand, as it does for rail');
  assert.ok(
    demanded.every(n => n >= 1), 'an empty flight must not be reported as a delivery'
  );
  // Calibration guard: air is the premium option, not a second railway. Rail
  // moves 10 per good per city pair per year; a year of flights must stay in
  // that neighbourhood rather than an order of magnitude above it.
  assert.ok(
    air.yearlyFreight < 60,
    `air freight is meant to be low-volume, got ${air.yearlyFreight} in one year`
  );
  // Booked tonnage must equal net movement. The departure city is simply
  // whichever end the aircraft is parked at, so without a scarcity gradient the
  // return leg re-exports the outbound delivery and the year's figure counts
  // the same crates several times over while nothing actually goes anywhere.
  assert.equal(
    air.yearlyFreight, b.stock.get(good),
    'every unit booked has to have actually ended up at the far end'
  );
  assert.equal(200 - a.stock.get(good), b.stock.get(good), 'and left the near one');
}

// ============================================================
// 6. A city will not let an air link strip its own stockpile
// ============================================================
{
  const { a, b, routes, cities, kingdoms } = pair(60);
  a.addBuilding('airport', a.x, a.y);
  b.addBuilding('airport', b.x, b.y);
  const air = new AirSystem();
  const good = 'tools' as GoodId;

  // Only a trickle at each end: everything here is under the floor.
  a.stock.add(good, 3);
  b.stock.add(good, 3);
  for (let tick = 0; tick < 7200; tick++) air.updateFlights(routes, cities, kingdoms);

  assert.equal(a.stock.get(good), 3, 'the shipper keeps its floor');
  assert.equal(b.stock.get(good), 3, 'and so does the other end');
  assert.equal(air.yearlyFreight, 0, 'nothing was above the floor, so nothing flew as freight');
  assert.ok(air.yearlyFlights > 0, 'the aircraft still flew — empty, which is a real outcome');
}

// ============================================================
// 7. Passenger service makes both ends wealthier, and only by a little
// ============================================================
{
  const { a, b, routes, cities, kingdoms } = pair(60);
  a.addBuilding('airport', a.x, a.y);
  b.addBuilding('airport', b.x, b.y);
  // No tradeable good on the route, so every departure is a passenger service.
  routes.get('r')!.good = null as never;
  const air = new AirSystem();
  const startA = a.prosperity, startB = b.prosperity;

  for (let tick = 0; tick < 7200; tick++) air.updateFlights(routes, cities, kingdoms);

  assert.ok(air.yearlyPassengers > 0, 'passengers have to be carried');
  assert.ok(a.prosperity > startA, 'the departure end gains');
  assert.ok(b.prosperity > startB, 'and so does the arrival end');
  assert.ok(
    a.prosperity - startA < 0.1,
    `one year of flights must not settle a city's prosperity, gained ${a.prosperity - startA}`
  );
}

// ============================================================
// 8. What is on the road tells you the age of the realm
// ============================================================
{
  assert.equal(caravanTypeFor('stone', 4), 'donkey');
  assert.equal(caravanTypeFor('bronze', 40), 'camel', 'the long haul is what camels are for');
  assert.equal(caravanTypeFor('iron', 40), 'cart');
  assert.equal(caravanTypeFor('classical', 40), 'wagon');
  assert.equal(caravanTypeFor('classical', 4), 'cart', 'a wagon is not worth harnessing to cross town');
  assert.equal(caravanTypeFor('industrial', 40), 'lorry');
  assert.equal(caravanTypeFor('modern', 4), 'truck', 'the modern era puts a truck on every route');
  assert.equal(caravanTypeFor('modern', 40), 'truck');
}

console.log('air.test: all assertions passed');
