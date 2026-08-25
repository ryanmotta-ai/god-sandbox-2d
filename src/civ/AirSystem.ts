import { GoodId } from './Goods';
import { TradeRoute } from './Trade';
import { City } from './City';
import { Kingdom } from './Kingdom';
import { rng } from '../core/Random';

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
export type FlightPayload = 'cargo' | 'passengers';

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
}

/**
 * Cruising speed in tiles per tick.
 *
 * Set against a modern truck at 0.130: an aircraft is roughly four times as
 * fast door to door, and it is straight rather than following a road, so on a
 * long route it is far more than four times better. That is the trade the
 * player is being shown — the runway costs a great deal and only pays for
 * itself over distance.
 */
const CRUISE_SPEED = 0.52;

/** Fraction of the route spent climbing, and the same again descending. */
const CLIMB_FRACTION = 0.14;

/** Ticks an aircraft sits on the apron between flights, loading. */
const TURNAROUND_TICKS = 240;

/** Below this, the two cities are close enough that flying is absurd. */
const MIN_AIR_DISTANCE = 12;

/** An airport below half health cannot work its runway. */
function workingAirport(city: City): boolean {
  for (const b of city.buildings.values()) {
    if (b.type === 'airport' && b.hp / b.maxHp > 0.5) return true;
  }
  return false;
}

/** Whether a pair of cities can run a service between them at all. */
export function airServiceAvailable(from: City, to: City): boolean {
  if (!workingAirport(from) || !workingAirport(to)) return false;
  return Math.hypot(to.x - from.x, to.y - from.y) >= MIN_AIR_DISTANCE;
}

export class AirSystem {
  public flights: Map<string, Flight> = new Map();
  /** Flights completed this year, for the yearly report. */
  public yearlyFlights: number = 0;
  public yearlyPassengers: number = 0;
  public yearlyFreight: number = 0;

  /** Called once a year, after the totals have been read. */
  public resetYear(): void {
    this.yearlyFlights = 0;
    this.yearlyPassengers = 0;
    this.yearlyFreight = 0;
  }

  public updateFlights(
    routes: Map<string, TradeRoute>,
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>
  ): void {
    const served = new Set<string>();

    for (const route of routes.values()) {
      if (!route.active) continue;
      const from = cities.get(route.fromCityId);
      const to = cities.get(route.toCityId);
      if (!from || !to || !airServiceAvailable(from, to)) continue;
      served.add(route.id);

      let flight = this.flights.get(route.id);
      if (!flight) {
        flight = this.open(route, from, to, kingdoms);
        this.flights.set(route.id, flight);
      }
      this.fly(flight, from, to, route);
    }

    // A service stops the moment its route closes or an airport is knocked out.
    for (const id of [...this.flights.keys()]) {
      if (!served.has(id)) this.flights.delete(id);
    }
  }

  /** Opens a service on a route, on the apron and ready to depart. */
  private open(route: TradeRoute, from: City, to: City, kingdoms: Map<string, Kingdom>): Flight {
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
      ...this.manifest(route, from),
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
  private manifest(route: TradeRoute, from: City): Pick<Flight, 'payload' | 'cargo' | 'load'> {
    const passengerBias = Math.min(0.65, 0.2 + from.population / 4000);
    if (!route.good || rng.chance(passengerBias)) {
      return {
        payload: 'passengers',
        cargo: null,
        load: Math.max(20, Math.round(from.population * rng.range(0.004, 0.012)))
      };
    }
    return {
      payload: 'cargo',
      cargo: route.good,
      load: Math.max(1, Math.round(route.volume * rng.range(0.1, 0.3)))
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
  private fly(flight: Flight, from: City, to: City, route: TradeRoute): void {
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

    flight.progress += (CRUISE_SPEED / flight.routeTiles) * flight.direction;

    if (flight.progress >= 1) {
      flight.progress = 1;
      flight.direction = -1;
      flight.turnaround = TURNAROUND_TICKS;
      this.arrive(flight, route, to);
    } else if (flight.progress <= 0) {
      flight.progress = 0;
      flight.direction = 1;
      flight.turnaround = TURNAROUND_TICKS;
      this.arrive(flight, route, from);
    }

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
  private arrive(flight: Flight, route: TradeRoute, at: City): void {
    this.yearlyFlights++;
    if (flight.payload === 'passengers') this.yearlyPassengers += flight.load;
    else this.yearlyFreight += flight.load;
    Object.assign(flight, this.manifest(route, at));
  }
}
