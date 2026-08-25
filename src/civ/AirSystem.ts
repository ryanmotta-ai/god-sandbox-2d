import { GoodId } from './Goods';
import { TradeRoute } from './Trade';
import { City } from './City';
import { Kingdom } from './Kingdom';
import { rng } from '../core/Random';
import { WorldEra } from '../world/WeatherEras';

/** The only thing air freight needs from the wider economy. */
export interface AirMarket {
  reportDemand(good: GoodId, amount: number): void;
}

/** The only thing a bombing campaign needs to know about diplomacy. */
export interface AirWar {
  isAtWar(k1: string, k2: string): boolean;
}

/**
 * Air freight and air travel, once a realm has aerodromes at both ends.
 *
 * An aircraft is the first mover on this map that does not care what is
 * underneath it. Every other kind of traffic is an argument with the ground —
 * a road has to be surveyed around a hill, a ship has to go round a headland,
 * a bridge has to be paid for. A flight goes from one runway to the other in a
 * straight line and the terrain gets no say at all, which is exactly what made
 * aviation worth having and is the whole reason it is modelled here rather
 * than as a faster caravan.
 *
 * It is deliberately not a new kind of trade route. Air service rides on the
 * routes a realm already runs: where two cities trade and both have a working
 * airport, some of that traffic goes by air. The ground route keeps running
 * underneath it, which is what really happens — freight aircraft supplemented
 * lorries, they never replaced them.
 */

/** What a given flight is carrying. */
export type FlightPayload = 'cargo' | 'passengers' | 'bombs';

/** Where a flight is in its profile. Drawn differently in each. */
export type FlightPhase = 'takeoff' | 'cruise' | 'landing';

export interface Flight {
  id: string;
  routeId: string;
  fromCityId: string;
  toCityId: string;
  fromCityName: string;
  toCityName: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  x: number;
  y: number;
  /** 0..1 from the departure runway to the arrival one. */
  progress: number;
  direction: 1 | -1;
  payload: FlightPayload;
  /** Goods aboard, or the number of people if this is a passenger service. */
  cargo: GoodId | null;
  load: number;
  kingdomColor: string;
  /** 0 on the runway, 1 at cruising height. Drives how far the shadow falls. */
  altitude: number;
  phase: FlightPhase;
  headingX: number;
  headingY: number;
  /** Great-circle distance between the two airports, in tiles. */
  routeTiles: number;
  /** Ticks left on the apron before the next departure. */
  turnaround: number;
  /** What the operating realm knew how to build when the service opened. */
  generation: AircraftGeneration;
}

/** Which generation of aircraft a realm can put in the air. */
export type AircraftGeneration = 'biplane' | 'propliner' | 'jet';

/**
 * What each generation is actually good for.
 *
 * Speed is set against a modern truck at 0.130. A propliner is roughly four
 * times as fast door to door and flies straight rather than following a road,
 * so over distance it is far more than four times better — that is the trade
 * the runway is asking the player to make.
 *
 * Range is what makes the progression mean something beyond a bigger number. A
 * biplane cannot cross an ocean: it opens a short hop between neighbours a
 * lorry would take a season over, and nothing else. Line service is what turns
 * flight into infrastructure, and the jet is what makes distance stop
 * mattering at all.
 */
const GENERATION: Record<AircraftGeneration, { speed: number; capacity: number; range: number }> = {
  biplane: { speed: 0.21, capacity: 0.35, range: 46 },
  propliner: { speed: 0.52, capacity: 1, range: 165 },
  jet: { speed: 1.04, capacity: 1.9, range: Infinity }
};

/**
 * What one sortie does to a building it hits, as a fraction of that building's
 * full health.
 *
 * Scaled by generation because the aeroplane is the weapon: a biplane drops a
 * few small bombs over the side and is a nuisance, while a jet flattens a
 * block. That spread is the reason air power reads as an era rather than as a
 * unit, and it is what makes an enemy's runways worth going after first.
 */
const BOMB_DAMAGE: Record<AircraftGeneration, number> = {
  biplane: 0.05,
  propliner: 0.16,
  jet: 0.3
};

/**
 * How much of a raid gets through when the target has a working runway of its
 * own. Fighters flew from the same fields, so an airport is both the thing
 * worth bombing and the thing that stops the bombing.
 */
const INTERCEPTION_SURVIVAL = 0.45;

/** What a raid costs the place underneath it, beyond the wreckage. */
const BOMB_PROSPERITY_COST = 0.012;

/**
 * The chance a completed leg ends in a loss instead of an arrival.
 *
 * Early flying really was this dangerous, and the drop across the generations
 * is the part worth modelling: the biplane era loses aircraft often enough that
 * a long service is a bad idea on its own terms, without any rule saying so,
 * while a jet is lost about once in a thousand legs. It is the same argument
 * range makes, said a second way.
 */
const LOSS_RATE: Record<AircraftGeneration, number> = {
  biplane: 0.022,
  propliner: 0.004,
  jet: 0.0008
};

/**
 * What the world's climate does to that risk.
 *
 * A sky full of ash and a winter that lasts half the year are flying weather in
 * the way a golden age is not, and the world already tracks exactly this. No
 * separate storm system: the era the whole world is living through is the
 * weather, and it grounds nothing outright — it just makes the odds worse.
 */
const WEATHER_RISK: Record<WorldEra, number> = {
  [WorldEra.GOLDEN_AGE]: 1,
  [WorldEra.ABUNDANCE]: 0.8,
  [WorldEra.AGE_OF_ASHES]: 2.4,
  [WorldEra.DARK_AGE]: 1.5,
  [WorldEra.FROZEN_AGE]: 2.1
};

/** The generation a realm flies, which is simply the best one it has learnt. */
export function aircraftGenerationFor(kingdom: Kingdom | null | undefined): AircraftGeneration {
  if (kingdom?.research.knows('jet_age')) return 'jet';
  if (kingdom?.research.knows('aviation')) return 'propliner';
  return 'biplane';
}

/**
 * Concurrent services one city can work.
 *
 * An airport is a runway, an apron and a tower, and all three are finite.
 * Without a ceiling a single field quietly becomes the hub of every route the
 * realm has, which is the sort of thing that is invisible until someone asks
 * why one city is doing all the trade. A bigger airport works more.
 */
function airportCapacity(city: City): number {
  let slots = 0;
  for (const b of city.buildings.values()) {
    if (b.type === 'airport' && b.hp / b.maxHp > 0.5) slots += 1 + Math.max(1, b.level);
  }
  return slots;
}

/** Fraction of the route spent climbing, and the same again descending. */
const CLIMB_FRACTION = 0.14;

/** Ticks an aircraft sits on the apron between flights, loading. */
const TURNAROUND_TICKS = 240;

/** Below this, the two cities are close enough that flying is absurd. */
const MIN_AIR_DISTANCE = 12;

/**
 * How much of a route's volume one departure carries.
 *
 * Calibrated against the railway rather than invented: rail moves
 * BASE_THROUGHPUT (10) of a good per city pair per year, in bulk. A 60-tile air
 * service turns round roughly twenty times in a 7200-tick year, so carrying a
 * tenth of the route volume each time would put two hundred units a year in the
 * air and make the railway pointless. Air freight is the premium, low-volume,
 * fast option — a unit or two a flight — which is both the real shape of it and
 * what keeps the ground routes worth running.
 */
const AIR_LOAD_FRACTION: readonly [min: number, max: number] = [0.02, 0.06];

/** A city keeps this much of a good back rather than flying it out. */
const AIR_SURPLUS_FLOOR = 4;

/**
 * How much more of a good the shipper needs before a flight is worth loading.
 *
 * Freight flies toward scarcity. Without a gradient the return leg re-exports
 * whatever the outbound leg just delivered — the departure city is simply
 * whichever end the aircraft happens to be sitting at — and a service spends
 * the year shuttling the same crates back and forth, booking tonnage both ways
 * for no net movement at all. Comfortably above a single load, so a delivery
 * cannot flip the gradient and start the whole thing oscillating.
 */
const AIR_MIN_GRADIENT = 8;

/**
 * Prosperity a single full passenger flight is worth to each end.
 *
 * Prosperity accumulates rather than being recomputed each year, so this has to
 * stay small: twenty flights a year at a few hundred passengers each should be
 * felt over a decade, not settle the matter in one.
 */
const PASSENGER_PROSPERITY_PER_1K = 0.004;

/** An airport below half health cannot work its runway. */
function workingAirport(city: City): boolean {
  for (const b of city.buildings.values()) {
    if (b.type === 'airport' && b.hp / b.maxHp > 0.5) return true;
  }
  return false;
}

/**
 * Whether a pair of cities can run a service between them at all.
 *
 * Too close and flying is absurd; too far and the aircraft of the day cannot
 * make it. The far limit is what the realm has learnt to build, so a route can
 * sit unflyable for an age and then open on its own the year the tech lands.
 */
export function airServiceAvailable(
  from: City, to: City, generation: AircraftGeneration = 'propliner'
): boolean {
  if (!workingAirport(from) || !workingAirport(to)) return false;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return distance >= MIN_AIR_DISTANCE && distance <= GENERATION[generation].range;
}

export class AirSystem {
  public flights: Map<string, Flight> = new Map();
  /**
   * Bombing runs, kept apart from the scheduled services.
   *
   * They are the same Flight and fly the same profile — which is the point,
   * because it means the movement, the altitude, the shadow and the sprite all
   * come for free — but they are opened by a war rather than a trade route, so
   * mixing them into one map would have the service cleanup delete them every
   * tick.
   */
  public sorties: Map<string, Flight> = new Map();
  /** Flights completed this year, for the yearly report. */
  public yearlyFlights: number = 0;
  public yearlyPassengers: number = 0;
  public yearlyFreight: number = 0;
  public yearlySorties: number = 0;
  /** Health destroyed by bombing this year, across every target. */
  public yearlyBombDamage: number = 0;
  /** Aircraft lost this year, and the last one, so a loss can be named. */
  public yearlyLosses: number = 0;
  public lastLoss: { from: string; to: string; payload: FlightPayload } | null = null;
  /** The world's climate, which is the only weather a flight has to argue with. */
  public weather: WorldEra = WorldEra.GOLDEN_AGE;

  /** Everything in the air, for the renderer, which does not care why it flies. */
  public *airborne(): Generator<Flight> {
    yield* this.flights.values();
    yield* this.sorties.values();
  }

  /** Called once a year, after the totals have been read. */
  public resetYear(): void {
    this.yearlyFlights = 0;
    this.yearlyPassengers = 0;
    this.yearlyFreight = 0;
    this.yearlySorties = 0;
    this.yearlyBombDamage = 0;
    this.yearlyLosses = 0;
  }

  /**
   * Whether this leg ended in a loss rather than an arrival.
   *
   * Rolled at the arrival because that is where a leg is resolved, not because
   * aircraft only fall out of the sky over airfields. A lost aircraft delivers
   * nothing: whatever was aboard goes with it, which is what makes an early
   * service a real gamble rather than a slower one.
   */
  private lost(flight: Flight): boolean {
    const risk = LOSS_RATE[flight.generation] * (WEATHER_RISK[this.weather] ?? 1);
    if (!rng.chance(risk)) return false;
    this.yearlyLosses++;
    this.lastLoss = {
      from: flight.fromCityName, to: flight.toCityName, payload: flight.payload
    };
    return true;
  }

  /**
   * Chooses this year's targets.
   *
   * Run once a year rather than per tick: picking targets means scanning cities
   * for enemies in range, and a war lasts years, so doing it 7200 times over is
   * work for an answer that does not change. Sorties in the air keep flying;
   * what this decides is which ones exist at all, so a raid stops when the war
   * ends, the runway is lost, or the target is taken.
   */
  public planSorties(
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>,
    war: AirWar
  ): void {
    const wanted = new Set<string>();
    const bases: City[] = [];
    for (const city of cities.values()) if (city.kingdomId && workingAirport(city)) bases.push(city);

    for (const base of bases) {
      const generation = aircraftGenerationFor(kingdoms.get(base.kingdomId!));
      const reach = GENERATION[generation].range;
      // One raid per field, against the nearest enemy it can actually reach:
      // a bomber force goes for what is in front of it, not the far capital.
      let best: City | null = null;
      let bestDistance = Infinity;
      for (const target of cities.values()) {
        if (!target.kingdomId || target.kingdomId === base.kingdomId) continue;
        if (!war.isAtWar(base.kingdomId!, target.kingdomId)) continue;
        const distance = Math.hypot(target.x - base.x, target.y - base.y);
        if (distance < MIN_AIR_DISTANCE || distance > reach || distance >= bestDistance) continue;
        best = target;
        bestDistance = distance;
      }
      if (!best) continue;

      const id = `sortie:${base.id}:${best.id}`;
      wanted.add(id);
      if (this.sorties.has(id)) continue;
      const sortie = this.openSortie(base, best, kingdoms.get(base.kingdomId!) ?? null, generation);
      this.sorties.set(id, sortie);
    }

    for (const id of [...this.sorties.keys()]) if (!wanted.has(id)) this.sorties.delete(id);
  }

  /** Moves every raid in the air, and lets the ones that arrive do their work. */
  public updateSorties(cities: Map<string, City>, year: number): void {
    for (const [id, sortie] of this.sorties) {
      const base = cities.get(sortie.fromCityId);
      const target = cities.get(sortie.toCityId);
      if (!base || !target || !workingAirport(base)) { this.sorties.delete(id); continue; }
      this.flySortie(sortie, base, target, year);
    }
  }

  private openSortie(base: City, target: City, kingdom: Kingdom | null, generation: AircraftGeneration): Flight {
    return {
      id: `bomb_${base.id}_${target.id}`,
      routeId: '',
      fromCityId: base.id,
      toCityId: target.id,
      fromCityName: base.name,
      toCityName: target.name,
      startX: base.x, startY: base.y,
      endX: target.x, endY: target.y,
      x: base.x, y: base.y,
      progress: 0,
      direction: 1,
      payload: 'bombs',
      cargo: null,
      load: 0,
      generation,
      kingdomColor: kingdom?.color ?? '#e2e8f0',
      altitude: 0,
      phase: 'takeoff',
      headingX: 0, headingY: -1,
      routeTiles: Math.max(1, Math.hypot(target.x - base.x, target.y - base.y)),
      turnaround: TURNAROUND_TICKS
    };
  }

  /**
   * A raid flies the same profile as a service, and drops its load at the far
   * end only. The return leg is empty, so an aircraft that has already bombed
   * does not bomb its own base on the way home.
   */
  private flySortie(sortie: Flight, base: City, target: City, year: number): void {
    sortie.startX = base.x; sortie.startY = base.y;
    sortie.endX = target.x; sortie.endY = target.y;
    sortie.routeTiles = Math.max(1, Math.hypot(target.x - base.x, target.y - base.y));

    if (sortie.turnaround > 0) {
      sortie.turnaround--;
      sortie.altitude = 0;
      sortie.phase = 'takeoff';
      return;
    }

    const outbound = sortie.direction > 0;
    sortie.progress += (GENERATION[sortie.generation].speed / sortie.routeTiles) * sortie.direction;
    if (sortie.progress >= 1) {
      sortie.progress = 1;
      sortie.direction = -1;
      sortie.turnaround = TURNAROUND_TICKS;
      if (outbound) {
        // A raid that does not arrive does no damage. The interception rule
        // handles what the defending fighters turn back; this is everything
        // else — the weather, the flak and the machine itself.
        if (this.lost(sortie)) {
          this.sorties.delete(`sortie:${sortie.fromCityId}:${sortie.toCityId}`);
          return;
        }
        this.bomb(sortie, target, year);
      }
    } else if (sortie.progress <= 0) {
      sortie.progress = 0;
      sortie.direction = 1;
      sortie.turnaround = TURNAROUND_TICKS;
    }

    this.place(sortie);
  }

  /**
   * What a raid does when it gets there.
   *
   * It goes for what a bombing campaign went for — the runway that launched the
   * last raid, then the works that build the weapons — and only hits ordinary
   * streets when there is nothing else standing. A target with a working runway
   * of its own gets most of the raid turned back, because the fighters flew
   * from those same fields: an airport is at once the thing worth bombing and
   * the thing that stops the bombing.
   */
  private bomb(sortie: Flight, target: City, year: number): void {
    this.yearlySorties++;
    const standing = [...target.buildings.values()].filter(b => b.hp > 0);
    if (!standing.length) return;

    const priority = (type: string): number =>
      type === 'airport' ? 0 : type === 'barracks' || type === 'keep' || type === 'factory' ? 1
        : type === 'refinery' || type === 'workshop' || type === 'smithy' || type === 'oil_well' ? 2 : 3;
    const best = Math.min(...standing.map(b => priority(b.type)));
    const pool = standing.filter(b => priority(b.type) === best);
    const hit = pool[Math.floor(rng.next() * pool.length)];

    const survival = workingAirport(target) ? INTERCEPTION_SURVIVAL : 1;
    const damage = hit.maxHp * BOMB_DAMAGE[sortie.generation] * survival;
    if (damage <= 0) return;
    hit.applyDamage(damage, year, 'war');
    this.yearlyBombDamage += damage;
    target.prosperity = Math.max(0, target.prosperity - BOMB_PROSPERITY_COST * survival);
  }

  public updateFlights(
    routes: Map<string, TradeRoute>,
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>,
    market?: AirMarket
  ): void {
    const served = new Set<string>();
    // Slots left at each field this tick. Services already running keep theirs,
    // so a new route cannot evict an established one just by being iterated
    // first — the ceiling decides who never opens, not who gets thrown out.
    const free = new Map<string, number>();
    const slotsAt = (city: City): number => {
      let left = free.get(city.id);
      if (left === undefined) {
        left = airportCapacity(city);
        free.set(city.id, left);
      }
      return left;
    };
    const takeSlots = (from: City, to: City): void => {
      free.set(from.id, slotsAt(from) - 1);
      free.set(to.id, slotsAt(to) - 1);
    };

    for (const route of routes.values()) {
      if (!route.active) continue;
      const from = cities.get(route.fromCityId);
      const to = cities.get(route.toCityId);
      if (!from || !to) continue;
      const generation = aircraftGenerationFor(route.fromKingdomId ? kingdoms.get(route.fromKingdomId) : null);
      if (!airServiceAvailable(from, to, generation)) continue;

      const flight = this.flights.get(route.id);
      if (flight) {
        served.add(route.id);
        takeSlots(from, to);
        this.fly(flight, from, to, route, market);
        continue;
      }
      // A field with no apron left simply does not open the service this tick.
      if (slotsAt(from) < 1 || slotsAt(to) < 1) continue;
      served.add(route.id);
      takeSlots(from, to);
      const opened = this.open(route, from, to, kingdoms, generation);
      this.flights.set(route.id, opened);
      this.fly(opened, from, to, route, market);
    }

    // A service stops the moment its route closes or an airport is knocked out.
    for (const id of [...this.flights.keys()]) {
      if (!served.has(id)) this.flights.delete(id);
    }
  }

  /** Opens a service on a route, on the apron and ready to depart. */
  private open(
    route: TradeRoute, from: City, to: City, kingdoms: Map<string, Kingdom>, generation: AircraftGeneration
  ): Flight {
    const kingdom = route.fromKingdomId ? kingdoms.get(route.fromKingdomId) : null;
    return {
      id: `air_${route.id}`,
      routeId: route.id,
      fromCityId: from.id,
      toCityId: to.id,
      fromCityName: from.name,
      toCityName: to.name,
      startX: from.x,
      startY: from.y,
      endX: to.x,
      endY: to.y,
      x: from.x,
      y: from.y,
      progress: 0,
      direction: 1,
      ...this.manifest(route, from, generation),
      generation,
      kingdomColor: kingdom?.color ?? '#e2e8f0',
      altitude: 0,
      phase: 'takeoff',
      headingX: 0,
      headingY: -1,
      routeTiles: Math.max(1, Math.hypot(to.x - from.x, to.y - from.y)),
      turnaround: TURNAROUND_TICKS
    };
  }

  /**
   * What the next departure is carrying.
   *
   * A route that moves goods flies freight most of the time; the rest is
   * people, because an airport that only ever saw cargo would be a depot. The
   * busier the city, the more of its flights carry passengers — which is the
   * shape real air service takes as a place grows.
   */
  private manifest(
    route: TradeRoute, from: City, generation: AircraftGeneration
  ): Pick<Flight, 'payload' | 'cargo' | 'load'> {
    const capacity = GENERATION[generation].capacity;
    const passengerBias = Math.min(0.65, 0.2 + from.population / 4000);
    if (!route.good || rng.chance(passengerBias)) {
      return {
        payload: 'passengers',
        cargo: null,
        load: Math.max(8, Math.round(from.population * rng.range(0.004, 0.012) * capacity))
      };
    }
    return {
      payload: 'cargo',
      cargo: route.good,
      load: Math.max(1, Math.round(route.volume * rng.range(AIR_LOAD_FRACTION[0], AIR_LOAD_FRACTION[1]) * capacity))
    };
  }

  /**
   * Advances one service by a tick.
   *
   * The profile is the real one and not a slide along a line: the aircraft
   * sits on the apron, rolls and climbs away over the first stretch, cruises
   * flat, descends into the far field, then sits again. Altitude is derived
   * from progress rather than stored, so it can never drift out of step with
   * where the aircraft actually is.
   */
  private fly(flight: Flight, from: City, to: City, route: TradeRoute, market?: AirMarket): void {
    // Airports move when a city is refounded elsewhere; keep the ends current.
    flight.startX = from.x;
    flight.startY = from.y;
    flight.endX = to.x;
    flight.endY = to.y;
    flight.routeTiles = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));

    if (flight.turnaround > 0) {
      flight.turnaround--;
      flight.altitude = 0;
      flight.phase = 'takeoff';
      return;
    }

    flight.progress += (GENERATION[flight.generation].speed / flight.routeTiles) * flight.direction;

    if (flight.progress >= 1) {
      flight.progress = 1;
      flight.direction = -1;
      flight.turnaround = TURNAROUND_TICKS;
      this.arrive(flight, route, from, to, market);
    } else if (flight.progress <= 0) {
      flight.progress = 0;
      flight.direction = 1;
      flight.turnaround = TURNAROUND_TICKS;
      this.arrive(flight, route, to, from, market);
    }

    this.place(flight);
  }

  /**
   * Where an aircraft is, how high, and which way it points, from its progress
   * alone.
   *
   * Altitude is derived rather than stored so it can never drift out of step
   * with the position, and a raid flies the identical profile to a scheduled
   * service — so this is shared rather than written twice, and the two can
   * never disagree about what a climb looks like.
   */
  private place(flight: Flight): void {
    const t = flight.progress;
    flight.x = flight.startX + (flight.endX - flight.startX) * t;
    flight.y = flight.startY + (flight.endY - flight.startY) * t;

    // Height: up over the first stretch, level, down into the far field.
    const climb = Math.min(0.45, CLIMB_FRACTION);
    flight.altitude = t < climb ? t / climb
      : t > 1 - climb ? (1 - t) / climb
        : 1;
    flight.phase = t < climb ? 'takeoff' : t > 1 - climb ? 'landing' : 'cruise';
    if (flight.direction < 0) {
      flight.phase = t < climb ? 'landing' : t > 1 - climb ? 'takeoff' : 'cruise';
    }

    const legX = (flight.endX - flight.startX) * flight.direction;
    const legY = (flight.endY - flight.startY) * flight.direction;
    const len = Math.hypot(legX, legY);
    if (len > 0.0001) {
      flight.headingX = legX / len;
      flight.headingY = legY / len;
    }
  }

  /**
   * Books the arrival, then loads the next departure.
   *
   * The manifest is drawn fresh every turnaround rather than once when the
   * service opened. Otherwise a route that happened to start with freight
   * flies freight for ever, and the airport never sees a passenger — which is
   * both wrong and dull to watch.
   */
  private arrive(flight: Flight, route: TradeRoute, origin: City, at: City, market?: AirMarket): void {
    this.yearlyFlights++;
    if (this.lost(flight)) {
      // Whatever was aboard went with it. Dropping the service here leaves the
      // route unserved, and the next tick opens a replacement — a realm buying
      // another aircraft, which is the right amount of consequence: expensive
      // in lost cargo and a pause, not the permanent end of the line.
      this.flights.delete(route.id);
      return;
    }
    if (flight.payload === 'passengers') this.carryPassengers(flight, origin, at);
    else this.unload(flight, origin, at, market);
    Object.assign(flight, this.manifest(route, at, flight.generation));
  }

  /**
   * Puts the freight where the flight took it.
   *
   * This is the whole point of an air service and it was missing: the system
   * counted tonnage into a yearly total that only the chronicle ever read, so
   * an airport cost stone, steel, fuel and ten jobs and moved nothing. Freight
   * now leaves the departure stockpile and lands in the arrival one, through
   * the same take/add/ledger path the railway uses, so both ends show it in
   * their trade figures and the market hears the demand.
   *
   * A city keeps a floor back for itself, so an air link cannot strip the place
   * that built the runway. Below that floor the aircraft flies empty, which is
   * a real outcome and worth being able to see.
   */
  private unload(flight: Flight, origin: City, destination: City, market?: AirMarket): void {
    if (!flight.cargo) return;
    if (origin.stock.get(flight.cargo) - destination.stock.get(flight.cargo) < AIR_MIN_GRADIENT) return;
    const surplus = Math.floor(origin.stock.get(flight.cargo) - AIR_SURPLUS_FLOOR);
    const amount = Math.min(flight.load, surplus);
    if (amount < 1) return;

    const moved = origin.stock.take(flight.cargo, amount);
    const delivered = destination.stock.add(flight.cargo, moved);
    // The arrival can be full; what will not fit goes back on the apron.
    if (delivered < moved) origin.stock.add(flight.cargo, moved - delivered);
    origin.ledger.recordExported(flight.cargo, delivered);
    destination.ledger.recordImported(flight.cargo, delivered);
    market?.reportDemand(flight.cargo, delivered);
    this.yearlyFreight += delivered;
  }

  /**
   * What a passenger service is worth to the two places it joins.
   *
   * There is no passenger cargo to deliver, so the effect has to be on the
   * cities themselves: being reachable by air makes a place wealthier, at both
   * ends and by the same amount, because the route works in both directions.
   */
  private carryPassengers(flight: Flight, origin: City, destination: City): void {
    this.yearlyPassengers += flight.load;
    const worth = PASSENGER_PROSPERITY_PER_1K * (flight.load / 1000);
    origin.prosperity = Math.min(1, origin.prosperity + worth);
    destination.prosperity = Math.min(1, destination.prosperity + worth);
  }
}
