import { GoodId, GOODS } from './Goods';
import { events } from '../core/EventBus';

/**
 * Commerce between realms.
 *
 * A trade agreement is the diplomatic permission; a trade route is the physical
 * link between two cities that actually moves goods. Routes need the `trade_routes`
 * technology overland, or `maritime_trade` to cross water.
 */

export type RouteKind = 'overland' | 'maritime';

export interface TradeRoute {
  id: string;
  fromCityId: string;
  toCityId: string;
  fromKingdomId: string;
  toKingdomId: string;
  kind: RouteKind;
  /** What flows from → to. */
  good: GoodId;
  /** Units moved per year. */
  volume: number;
  /** Ceiling the route regenerates toward after being raided. Set once at opening. */
  maxVolume: number;
  establishedYear: number;
  /** Total world-unit value moved over the route's lifetime. */
  totalValue: number;
  /** Physical units delivered in the current economic year; reset by the trade pass. */
  deliveredThisYear: number;
  /** Suspended while the two realms are at war or embargoed. */
  active: boolean;
  /** Internal metropole-colony route. It uses the ordinary trade stock and logistics. */
  colonialRoute?: boolean;
  /** Direction of the colonial flow, used only for accounting and Chronicle context. */
  colonialDirection?: 'colony_to_metropole' | 'metropole_to_colony';
  /** Surveyed path the route physically uses, so capacity can be re-evaluated
   *  against the live condition of the road or sea it crosses. */
  path?: { x: number; y: number }[];
}

export interface TradeAgreement {
  id: string;
  kingdomA: string;
  kingdomB: string;
  signedYear: number;
  /** Fraction of trade value each side skims, 0..0.4. */
  tariff: number;
  /** Cumulative value exchanged, used for the diplomacy relation bonus. */
  volumeTraded: number;
}

export interface Embargo {
  byKingdom: string;
  againstKingdom: string;
  year: number;
  reason: string;
}

const MAX_ROUTES_PER_KINGDOM = 6;

export class TradeNetwork {
  public routes: Map<string, TradeRoute> = new Map();
  public agreements: Map<string, TradeAgreement> = new Map();
  public embargoes: Embargo[] = [];

  /** Total value moved across the whole world this year. Reset each settle. */
  public yearlyVolume: number = 0;

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  // ============================ AGREEMENTS ============================

  public hasAgreement(kingdomA: string, kingdomB: string): boolean {
    return this.agreements.has(this.pairKey(kingdomA, kingdomB));
  }

  public getAgreement(kingdomA: string, kingdomB: string): TradeAgreement | null {
    return this.agreements.get(this.pairKey(kingdomA, kingdomB)) ?? null;
  }

  public signAgreement(kingdomA: string, kingdomB: string, year: number, tariff: number = 0.08): TradeAgreement | null {
    if (kingdomA === kingdomB) return null;
    const key = this.pairKey(kingdomA, kingdomB);
    if (this.agreements.has(key)) return null;
    if (this.isEmbargoed(kingdomA, kingdomB)) return null;

    const agreement: TradeAgreement = {
      id: key,
      kingdomA,
      kingdomB,
      signedYear: year,
      tariff: Math.max(0, Math.min(0.4, tariff)),
      volumeTraded: 0
    };
    this.agreements.set(key, agreement);
    events.emit('tradeAgreementSigned', { agreement, kingdomA, kingdomB, year });
    return agreement;
  }

  public cancelAgreement(kingdomA: string, kingdomB: string, year: number, reason: string): void {
    const key = this.pairKey(kingdomA, kingdomB);
    if (!this.agreements.delete(key)) return;

    // Routes between these two realms die with the treaty.
    for (const [routeId, route] of [...this.routes]) {
      if (this.pairKey(route.fromKingdomId, route.toKingdomId) === key) {
        this.routes.delete(routeId);
      }
    }
    events.emit('tradeAgreementBroken', { kingdomA, kingdomB, year, reason });
  }

  // ============================ EMBARGOES ============================

  public isEmbargoed(kingdomA: string, kingdomB: string): boolean {
    return this.embargoes.some(
      e =>
        (e.byKingdom === kingdomA && e.againstKingdom === kingdomB) ||
        (e.byKingdom === kingdomB && e.againstKingdom === kingdomA)
    );
  }

  public declareEmbargo(byKingdom: string, againstKingdom: string, year: number, reason: string): void {
    if (this.isEmbargoed(byKingdom, againstKingdom)) return;
    this.embargoes.push({ byKingdom, againstKingdom, year, reason });
    this.cancelAgreement(byKingdom, againstKingdom, year, `Embargo: ${reason}`);
    events.emit('embargoDeclared', { byKingdom, againstKingdom, year, reason });
  }

  public liftEmbargo(byKingdom: string, againstKingdom: string): void {
    this.embargoes = this.embargoes.filter(
      e => !(e.byKingdom === byKingdom && e.againstKingdom === againstKingdom)
    );
  }

  // ============================ ROUTES ============================

  public routesFor(kingdomId: string): TradeRoute[] {
    return [...this.routes.values()].filter(
      r => r.fromKingdomId === kingdomId || r.toKingdomId === kingdomId
    );
  }

  public routeCountFor(kingdomId: string): number {
    return this.routesFor(kingdomId).length;
  }

  public canOpenRoute(kingdomId: string): boolean {
    return this.routeCountFor(kingdomId) < MAX_ROUTES_PER_KINGDOM;
  }

  public hasRouteBetween(fromCityId: string, toCityId: string, good: GoodId): boolean {
    for (const route of this.routes.values()) {
      if (route.good !== good) continue;
      if (
        (route.fromCityId === fromCityId && route.toCityId === toCityId) ||
        (route.fromCityId === toCityId && route.toCityId === fromCityId)
      ) {
        return true;
      }
    }
    return false;
  }

  public openRoute(params: {
    fromCityId: string;
    toCityId: string;
    fromKingdomId: string;
    toKingdomId: string;
    kind: RouteKind;
    good: GoodId;
    volume: number;
    year: number;
    path?: { x: number; y: number }[];
    colonialRoute?: boolean;
    colonialDirection?: 'colony_to_metropole' | 'metropole_to_colony';
  }): TradeRoute {
    const route: TradeRoute = {
      id: `route_${params.fromCityId}_${params.toCityId}_${params.good}`,
      fromCityId: params.fromCityId,
      toCityId: params.toCityId,
      fromKingdomId: params.fromKingdomId,
      toKingdomId: params.toKingdomId,
      kind: params.kind,
      good: params.good,
      volume: params.volume,
      maxVolume: params.volume,
      establishedYear: params.year,
      totalValue: 0,
      deliveredThisYear: 0,
      active: true,
      colonialRoute: params.colonialRoute ?? false,
      colonialDirection: params.colonialDirection,
      path: params.path
    };
    this.routes.set(route.id, route);
    events.emit('tradeRouteOpened', { route });
    return route;
  }

  public closeRoute(routeId: string): void {
    this.routes.delete(routeId);
  }

  /** Removes any route touching a city that no longer exists. */
  public pruneRoutes(cityExists: (cityId: string) => boolean): void {
    for (const [id, route] of [...this.routes]) {
      if (!cityExists(route.fromCityId) || !cityExists(route.toCityId)) {
        this.routes.delete(id);
      }
    }
  }

  /** Suspends routes between realms at war, reactivates the rest. */
  public updateRouteStatus(isAtWar: (a: string, b: string) => boolean): void {
    for (const route of this.routes.values()) {
      const blocked = isAtWar(route.fromKingdomId, route.toKingdomId) ||
        this.isEmbargoed(route.fromKingdomId, route.toKingdomId);
      route.active = !blocked;
    }
  }

  public recordTrade(route: TradeRoute, value: number): void {
    route.totalValue += value;
    this.yearlyVolume += value;
    const agreement = this.getAgreement(route.fromKingdomId, route.toKingdomId);
    if (agreement) agreement.volumeTraded += value;
  }

  public resetYearlyVolume(): void {
    this.yearlyVolume = 0;
  }

  /** The busiest routes in the world, for the economy screen. */
  public topRoutes(limit: number = 10): TradeRoute[] {
    return [...this.routes.values()].sort((a, b) => b.totalValue - a.totalValue).slice(0, limit);
  }

  /** Total lifetime value moved by one realm. */
  public tradeValueFor(kingdomId: string): number {
    return this.routesFor(kingdomId).reduce((sum, r) => sum + r.totalValue, 0);
  }

  public serialize(): any {
    return {
      routes: [...this.routes.values()].map(r => ({
        id: r.id,
        fromCityId: r.fromCityId,
        toCityId: r.toCityId,
        fromKingdomId: r.fromKingdomId,
        toKingdomId: r.toKingdomId,
        kind: r.kind,
        good: r.good,
        volume: r.volume,
        maxVolume: r.maxVolume,
        establishedYear: r.establishedYear,
        totalValue: r.totalValue,
        deliveredThisYear: r.deliveredThisYear,
        active: r.active,
        colonialRoute: r.colonialRoute ?? false,
        colonialDirection: r.colonialDirection,
        path: r.path
      })),
      agreements: [...this.agreements.values()],
      embargoes: this.embargoes
    };
  }

  public deserialize(data: any): void {
    this.routes.clear();
    this.agreements.clear();
    this.embargoes = data?.embargoes ?? [];
    for (const route of data?.routes ?? []) {
      // Older saves predate maxVolume; fall back to volume so a loaded route can
      // still recover toward its current level rather than being capped at 0.
      if (route.maxVolume == null) route.maxVolume = route.volume;
      route.deliveredThisYear = route.deliveredThisYear ?? 0;
      route.colonialRoute = route.colonialRoute ?? false;
      route.path = route.path ?? undefined;
      this.routes.set(route.id, route);
    }
    for (const agreement of data?.agreements ?? []) this.agreements.set(agreement.id, agreement);
  }
}

/** Human-readable summary of a route, used by the economy screen. */
/**
 * What it costs to haul one unit of a good along a route, in world units.
 *
 * Extracted from the route-opening decision so the economy screen can report the
 * same figure the simulation charged rather than a second estimate of it. Sea
 * freight is cheaper per tile than land, and a good road cuts the land cost by up
 * to 30% — which is the whole reason infrastructure changes what trade is
 * possible.
 */
export function transportCostPerUnit(
  kind: RouteKind,
  distance: number,
  worldPrice: number,
  avgRoadLevel: number
): number {
  // 1.5 used to be the penalty for hauling over unmade ground, and it was rare:
  // a trade agreement laid a road, so a route was on dirt within a few years
  // and paid 1.2. Now that overland trade leaves the wilderness alone, unmade
  // ground is the normal condition rather than a temporary one, so the baseline
  // is rebased onto what a route actually used to pay. Without this every land
  // route in the world would quietly take a 25% rise it can never work off, and
  // the ancient economy would be throttled by a change meant to be cosmetic.
  //
  // The road term is kept because it is still live at the ends, where a route
  // runs through a city's own streets — and because it is what a paved highway
  // would use if this world ever builds one. Between cities the improvement now
  // comes from the railway, which delivers on its own account and never asks
  // this function anything.
  return kind === 'maritime'
    ? worldPrice * distance * 0.003
    : worldPrice * distance * 0.004 * (1.2 - 0.3 * avgRoadLevel);
}

export function describeRoute(route: TradeRoute): string {
  const good = GOODS[route.good];
  return `${good.icon} ${good.name} ×${Math.round(route.volume)}/yr`;
}
