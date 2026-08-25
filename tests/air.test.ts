import { strict as assert } from 'node:assert';
import { City } from '../src/civ/City';
import { Kingdom, getNextKingdomColor } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';
import { AirSystem, airServiceAvailable, aircraftGenerationFor } from '../src/civ/AirSystem';
import { caravanTypeFor } from '../src/civ/CaravanSystem';
import type { TradeRoute } from '../src/civ/Trade';
import type { GoodId } from '../src/civ/Goods';
import { WorldEra } from '../src/world/WeatherEras';

rng.setSeed(20260805);

/**
 * Two cities a set distance apart, with a live trade route between them.
 *
 * Both realms are given `aviation` by default because that is the generation
 * these cases are about: a biplane realm cannot reach across sixty tiles, and
 * the range progression has a case of its own further down.
 */
function pair(distance: number, techs: string[] = ['powered_flight', 'aviation']): { a: City; b: City; routes: Map<string, TradeRoute>; kingdoms: Map<string, Kingdom>; cities: Map<string, City> } {
  const a = new City('a', 'Aeroport', SpeciesType.HUMAN, 10, 20, 'F', 1);
  const b = new City('b', 'Farfield', SpeciesType.HUMAN, 10 + distance, 20, 'F', 1);
  a.population = 900;
  b.population = 700;
  const ka = new Kingdom('ka', 'A', SpeciesType.HUMAN, getNextKingdomColor(), a.id, 0);
  const kb = new Kingdom('kb', 'B', SpeciesType.HUMAN, getNextKingdomColor(), b.id, 0);
  a.kingdomId = ka.id;
  b.kingdomId = kb.id;
  for (const tech of techs) { ka.research.known.add(tech); kb.research.known.add(tech); }
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
// 8. A realm flies what it has learnt to build, and no further
// ============================================================
{
  // A biplane realm: the runway exists, the aeroplane cannot cross the gap.
  const early = pair(60, ['powered_flight']);
  early.a.addBuilding('airport', early.a.x, early.a.y);
  early.b.addBuilding('airport', early.b.x, early.b.y);
  assert.equal(
    aircraftGenerationFor(early.kingdoms.get('ka')!), 'biplane',
    'powered flight alone is the biplane era'
  );
  assert.equal(
    airServiceAvailable(early.a, early.b, 'biplane'), false,
    'sixty tiles is beyond a biplane, however many runways are built'
  );
  const earlyAir = new AirSystem();
  earlyAir.updateFlights(early.routes, early.cities, early.kingdoms);
  assert.equal(earlyAir.flights.size, 0, 'so no service opens');

  // The short hop it *is* for.
  const hop = pair(20, ['powered_flight']);
  hop.a.addBuilding('airport', hop.a.x, hop.a.y);
  hop.b.addBuilding('airport', hop.b.x, hop.b.y);
  const hopAir = new AirSystem();
  hopAir.updateFlights(hop.routes, hop.cities, hop.kingdoms);
  assert.equal(hopAir.flights.size, 1, 'a biplane opens the short hop');
  assert.equal(hopAir.flights.get('r')!.generation, 'biplane');

  // Line service reaches it; the jet reaches anything.
  const line = pair(60);
  line.a.addBuilding('airport', line.a.x, line.a.y);
  line.b.addBuilding('airport', line.b.x, line.b.y);
  const lineAir = new AirSystem();
  lineAir.updateFlights(line.routes, line.cities, line.kingdoms);
  assert.equal(lineAir.flights.get('r')!.generation, 'propliner', 'aviation is the line-service era');

  const jet = pair(400, ['powered_flight', 'aviation', 'jet_age']);
  jet.a.addBuilding('airport', jet.a.x, jet.a.y);
  jet.b.addBuilding('airport', jet.b.x, jet.b.y);
  assert.equal(aircraftGenerationFor(jet.kingdoms.get('ka')!), 'jet');
  const jetAir = new AirSystem();
  jetAir.updateFlights(jet.routes, jet.cities, jet.kingdoms);
  assert.equal(jetAir.flights.size, 1, 'no distance is too far for a jet');
}

// ============================================================
// 9. A newer aircraft is faster and lifts more over the same route
// ============================================================
{
  const year = (techs: string[]) => {
    const { a, b, routes, cities, kingdoms } = pair(40, techs);
    a.addBuilding('airport', a.x, a.y);
    b.addBuilding('airport', b.x, b.y);
    a.stock.add('tools' as GoodId, 300);
    const air = new AirSystem();
    for (let tick = 0; tick < 7200; tick++) air.updateFlights(routes, cities, kingdoms);
    return air;
  };
  const prop = year(['powered_flight', 'aviation']);
  const jet = year(['powered_flight', 'aviation', 'jet_age']);

  assert.ok(
    jet.yearlyFlights > prop.yearlyFlights,
    `a jet turns round more often: jet ${jet.yearlyFlights} vs propliner ${prop.yearlyFlights}`
  );
  assert.ok(
    jet.yearlyPassengers > prop.yearlyPassengers,
    'and carries more people over the year'
  );
}

// ============================================================
// 10. A runway is finite, so one field cannot serve every route
// ============================================================
{
  const hub = new City('hub', 'Hub', SpeciesType.HUMAN, 10, 20, 'F', 1);
  hub.population = 1200;
  const kh = new Kingdom('kh', 'H', SpeciesType.HUMAN, getNextKingdomColor(), hub.id, 0);
  kh.research.known.add('powered_flight'); kh.research.known.add('aviation');
  hub.kingdomId = kh.id;
  hub.addBuilding('airport', hub.x, hub.y);

  const cities = new Map<string, City>([[hub.id, hub]]);
  const routes = new Map<string, TradeRoute>();
  // Six spokes, all in range, all wanting the one field at the centre.
  for (let i = 0; i < 6; i++) {
    const spoke = new City(`s${i}`, `Spoke${i}`, SpeciesType.HUMAN, 10, 20 + 30 + i * 4, 'F', 1);
    spoke.population = 400;
    spoke.kingdomId = kh.id;
    spoke.addBuilding('airport', spoke.x, spoke.y);
    cities.set(spoke.id, spoke);
    routes.set(`r${i}`, {
      id: `r${i}`, fromCityId: hub.id, toCityId: spoke.id, fromKingdomId: kh.id, toKingdomId: kh.id,
      kind: 'overland', good: 'tools' as never, volume: 40, maxVolume: 40,
      establishedYear: 0, totalValue: 0, active: true
    });
  }

  const air = new AirSystem();
  air.updateFlights(routes, cities, new Map([[kh.id, kh]]));
  const capacity = 1 + Math.max(1, [...hub.buildings.values()].find(b => b.type === 'airport')!.level);
  assert.equal(
    air.flights.size, capacity,
    `one airport works ${capacity} services, not all six spokes`
  );

  // A second field at the hub opens more of them.
  hub.addBuilding('airport', hub.x + 1, hub.y);
  air.updateFlights(routes, cities, new Map([[kh.id, kh]]));
  assert.ok(air.flights.size > capacity, 'building another airport works more routes');
}

// ============================================================
// 11. A war in the air: raids fly, wreck things, and stop with the war
// ============================================================
{
  const { a, b, cities, kingdoms } = pair(60);
  a.addBuilding('airport', a.x, a.y);
  // The target has factories and streets, but no runway of its own to defend it.
  b.addBuilding('factory', b.x, b.y);
  b.addBuilding('house', b.x + 1, b.y);
  const war = { isAtWar: (k1: string, k2: string) => k1 !== k2 };
  const air = new AirSystem();

  air.planSorties(cities, kingdoms, war);
  assert.equal(air.sorties.size, 1, 'a realm at war with a runway sends a raid');
  const sortie = air.sorties.values().next().value!;
  assert.equal(sortie.payload, 'bombs');
  assert.equal(sortie.fromCityId, a.id, 'from the field');
  assert.equal(sortie.toCityId, b.id, 'to the enemy');

  const factory = [...b.buildings.values()].find(x => x.type === 'factory')!;
  const house = [...b.buildings.values()].find(x => x.type === 'house')!;
  const prosperityBefore = b.prosperity;
  for (let tick = 0; tick < 7200; tick++) air.updateSorties(cities, 1900);

  assert.ok(air.yearlySorties > 0, 'raids have to actually arrive');
  assert.ok(air.yearlyBombDamage > 0, 'and do damage that is counted');
  assert.ok(factory.hp < factory.maxHp, 'the works are what a bombing campaign goes for');
  assert.equal(house.hp, house.maxHp, 'not the houses, while anything better is standing');
  assert.ok(b.prosperity < prosperityBefore, 'a bombed city is poorer for it');

  // Peace grounds them.
  air.planSorties(cities, kingdoms, { isAtWar: () => false });
  assert.equal(air.sorties.size, 0, 'peace ends the campaign');
}

// ============================================================
// 12. The runway is the first target, and defends itself
// ============================================================
{
  const undefended = pair(60);
  undefended.a.addBuilding('airport', undefended.a.x, undefended.a.y);
  undefended.b.addBuilding('airport', undefended.b.x, undefended.b.y);
  undefended.b.addBuilding('factory', undefended.b.x + 1, undefended.b.y);
  const war = { isAtWar: (k1: string, k2: string) => k1 !== k2 };

  const air = new AirSystem();
  air.planSorties(undefended.cities, undefended.kingdoms, war);
  // Both ends have a field, so both send a raid at the other.
  assert.equal(air.sorties.size, 2, 'a war in the air is fought both ways');

  const targetField = [...undefended.b.buildings.values()].find(x => x.type === 'airport')!;
  for (let tick = 0; tick < 2600; tick++) air.updateSorties(undefended.cities, 1900);
  assert.ok(
    targetField.hp < targetField.maxHp,
    'the enemy runway is what a raid goes for before anything else'
  );

  // Same raid against a target with no fighters of its own does more harm.
  const open = pair(60);
  open.a.addBuilding('airport', open.a.x, open.a.y);
  open.b.addBuilding('factory', open.b.x, open.b.y);
  const openAir = new AirSystem();
  openAir.planSorties(open.cities, open.kingdoms, { isAtWar: (k1: string, k2: string) => k1 !== k2 });
  for (let tick = 0; tick < 2600; tick++) openAir.updateSorties(open.cities, 1900);

  const defended = new AirSystem();
  const guarded = pair(60);
  guarded.a.addBuilding('airport', guarded.a.x, guarded.a.y);
  guarded.b.addBuilding('airport', guarded.b.x, guarded.b.y);
  guarded.b.addBuilding('factory', guarded.b.x + 1, guarded.b.y);
  defended.planSorties(guarded.cities, guarded.kingdoms, { isAtWar: (k1: string, k2: string) => k1 !== k2 });
  for (let tick = 0; tick < 2600; tick++) defended.updateSorties(guarded.cities, 1900);

  const perSortieOpen = openAir.yearlyBombDamage / Math.max(1, openAir.yearlySorties);
  const perSortieGuarded = defended.yearlyBombDamage / Math.max(1, defended.yearlySorties);
  assert.ok(
    perSortieOpen > perSortieGuarded,
    `fighters flying from the target's own field turn most of a raid back: ${perSortieOpen} vs ${perSortieGuarded}`
  );
}

// ============================================================
// 13. Early flying is dangerous, and it gets safer
// ============================================================
{
  const flownYear = (techs: string[], weather: WorldEra) => {
    const { a, b, routes, cities, kingdoms } = pair(30, techs);
    a.addBuilding('airport', a.x, a.y);
    b.addBuilding('airport', b.x, b.y);
    const air = new AirSystem();
    air.weather = weather;
    for (let tick = 0; tick < 7200 * 6; tick++) air.updateFlights(routes, cities, kingdoms);
    return air;
  };

  const biplane = flownYear(['powered_flight'], WorldEra.GOLDEN_AGE);
  const jet = flownYear(['powered_flight', 'aviation', 'jet_age'], WorldEra.GOLDEN_AGE);
  assert.ok(biplane.yearlyLosses > 0, 'a biplane era has to lose aircraft');
  assert.ok(
    biplane.yearlyLosses > jet.yearlyLosses,
    `flying gets safer: biplane lost ${biplane.yearlyLosses}, jet lost ${jet.yearlyLosses}`
  );
  assert.ok(biplane.lastLoss !== null, 'and a loss can be named for the chronicle');

  // The world's climate is the weather, and ash is worse than a golden age.
  let ashier = 0, calmer = 0;
  for (let run = 0; run < 6; run++) {
    ashier += flownYear(['powered_flight'], WorldEra.AGE_OF_ASHES).yearlyLosses;
    calmer += flownYear(['powered_flight'], WorldEra.ABUNDANCE).yearlyLosses;
  }
  assert.ok(ashier > calmer, `a sky full of ash costs more aircraft: ${ashier} vs ${calmer}`);
}

// ============================================================
// 14. A lost aircraft delivers nothing
// ============================================================
{
  const { a, b, routes, cities, kingdoms } = pair(30, ['powered_flight']);
  a.addBuilding('airport', a.x, a.y);
  b.addBuilding('airport', b.x, b.y);
  const good = 'tools' as GoodId;
  a.stock.add(good, 300);
  const air = new AirSystem();
  air.weather = WorldEra.AGE_OF_ASHES;
  for (let tick = 0; tick < 7200 * 4; tick++) air.updateFlights(routes, cities, kingdoms);

  assert.ok(air.yearlyLosses > 0, 'the setup has to actually lose something');
  // Whatever went down went down with its load: stock is still conserved
  // between the two cities, never created, and the far end never receives
  // more than the near end sent.
  assert.equal(
    300 - a.stock.get(good), b.stock.get(good),
    'a crash must not leave phantom cargo at either end'
  );
}

// ============================================================
// 15. What is on the road tells you the age of the realm
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
