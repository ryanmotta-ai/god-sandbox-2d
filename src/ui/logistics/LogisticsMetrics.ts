/**
 * The world's logistics, computed once.
 *
 * Same discipline as UI-3 through UI-6: **every figure traces to something a
 * system recorded.** This is the most expensive snapshot in the interface — it
 * sweeps the whole tile grid once for roads and rail, walks the rail components,
 * and resolves every route's economics — so it runs behind
 * `LogisticsMetricsCache` on a slow cadence and never inside a render.
 *
 * One absence shapes the whole module and is stated wherever it matters: **there
 * are no trains.** `RailwayNetwork.tickFreight` moves stock directly between
 * stations on the same connected component; nothing physical travels the line.
 * The movers that do exist are caravans and ships, and both carry a real cargo,
 * a real amount and a real progress along a surveyed path — so those are what the
 * screen can follow. `yearlyFreight` is a world total, not a per-corridor figure,
 * and it is labelled as such everywhere it appears.
 */
import { GOODS, type GoodId } from '../../civ/Goods';
import { transportCostPerUnit, type TradeRoute, type RouteKind } from '../../civ/Trade';
import { avgEffectiveRoadLevel, roadCapacityFactor, portCapacityFactor, portOperational } from '../../civ/Infrastructure';
import type { OverlandCaravan } from '../../civ/CaravanSystem';
import type { Ship } from '../../civ/NavalSystem';
import type { City } from '../../civ/City';
import type { Kingdom } from '../../civ/Kingdom';
import type { Tile } from '../../world/Tile';
import type { GameContext } from '../core/GameContext';

// ============================ SHAPES ============================

/** The vocabulary of logistics health. Only states the simulation can prove. */
export type LinkStatus =
  | 'healthy'      // operating within its means
  | 'busy'         // moving near its ceiling
  | 'congested'    // at the ceiling: more trade needs more infrastructure
  | 'damaged'      // the way itself has lost capacity
  | 'blocked'      // embargoed
  | 'war-closed'   // shut by war
  | 'disconnected';// nothing links it

export type NetworkId = 'road' | 'rail' | 'sea';

/** The road network, aggregated from the tile grid. */
export interface RoadNetwork {
  /** Tiles carrying any road. */
  tiles: number;
  /** Tiles per level: index 1 trail, 2 stone, 3 imperial. */
  byLevel: number[];
  /** Tiles whose damage has cost them a level or more. */
  damagedTiles: number;
  /** Total accumulated traffic across every road tile. */
  totalTraffic: number;
  /** The busiest stretches, by accumulated traffic. */
  busiest: { x: number; y: number; level: number; traffic: number; cityId: string | null; cityName: string | null }[];
  /** Mean level across the tiles that have a road at all, or null with none. */
  meanLevel: number | null;
}

/** The rail network, from the tiles and the connectivity walk. */
export interface RailNetwork {
  tiles: number;
  /** Segments damaged past the point where the line is treated as severed. */
  severedTiles: number;
  /** Segments carrying damage but still passable. */
  degradedTiles: number;
  /** Connected components with two or more stations — the working lines. */
  lines: RailLine[];
  /** Settlements standing on track that joins them to nobody. */
  strandedStations: { cityId: string; cityName: string }[];
  /** Freight the whole world moved this year. Not per realm, not per line. */
  worldFreight: number;
  /** Segments laid this year, world-wide. */
  builtThisYear: number;
}

/** One connected rail line, with the settlements it joins. */
export interface RailLine {
  id: string;
  tiles: number;
  /** Mean `railHealth` across the line. Rail throughput scales with it. */
  quality: number;
  stations: { cityId: string; cityName: string; kingdomId: string | null; kingdomName: string | null; x: number; y: number }[];
  /** Realms owning track on this line. */
  owners: { kingdomId: string; name: string; color: string }[];
  /** Goods rail freight can actually carry, filtered to what these stations
   *  produce or can use. */
  goods: GoodId[];
  damagedTiles: number;
  /** A representative tile, for the map jump. */
  at: { x: number; y: number };
  status: LinkStatus;
}

/** One port or harbour, with what passes through it. */
export interface PortView {
  cityId: string;
  cityName: string;
  kingdomId: string | null;
  kingdomName: string | null;
  kingdomColor: string | null;
  /** Harbour and port buildings standing here. */
  berths: number;
  /** Mean condition of those buildings, 0..1. */
  condition: number;
  /** Whether the simulation considers it able to handle trade at all. */
  operational: boolean;
  maritimeRoutes: RouteView[];
  /** Volume arriving and leaving over sea routes touching this city. */
  inboundVolume: number;
  outboundVolume: number;
  majorImports: { good: GoodId; volume: number }[];
  majorExports: { good: GoodId; volume: number }[];
  /** Share of its realm's whole sea trade that runs through this one port. */
  realmSeaShare: number;
  status: LinkStatus;
  x: number;
  y: number;
}

/** A route with its infrastructure and economics resolved. */
export interface RouteView {
  route: TradeRoute;
  kind: RouteKind;
  good: GoodId;
  goodName: string;
  fromCity: City | null;
  toCity: City | null;
  fromKingdom: Kingdom | null;
  toKingdom: Kingdom | null;
  distance: number;
  /** What the way physically allows, 0..1.3+. */
  capacityFactor: number;
  /** volume ÷ maxVolume. */
  utilization: number;
  status: LinkStatus;
  /** Mean effective road level along the surveyed path, land routes only. */
  avgRoadLevel: number | null;
  /** Tiles of the path carrying rail. */
  railTiles: number;
  /** Tiles of the path whose road is damaged. */
  damagedTiles: number;
  sourcePrice: number;
  destPrice: number;
  /** The same figure the trade decision charged, per unit. */
  transportCost: number;
  tariffRate: number;
  marginPerUnit: number;
  /** Physical movers currently running this route. */
  caravans: OverlandCaravan[];
  ships: Ship[];
}

/** A mover on the map: a caravan or a ship, normalised. */
export interface MoverView {
  id: string;
  kind: 'caravan' | 'ship';
  /** Caravan type or ship tier, as the simulation labels it. */
  variant: string;
  routeId: string;
  fromName: string;
  toName: string;
  good: GoodId;
  goodName: string;
  amount: number;
  /** 0..1 along the surveyed path. */
  progress: number;
  /** Outbound to the destination, or returning. */
  outbound: boolean;
  color: string;
  x: number;
  y: number;
  /** True when the route it belongs to is shut. */
  routeClosed: boolean;
}

/** A corridor: routes aggregated by the pair of settlements they join. */
export interface CorridorView {
  id: string;
  fromCityId: string;
  fromName: string;
  toCityId: string;
  toName: string;
  fromKingdomId: string | null;
  toKingdomId: string | null;
  /** Every transport mode carrying goods along this pair. */
  modes: RouteKind[];
  /** True when part of the land path is railed. */
  railed: boolean;
  routes: RouteView[];
  goods: { good: GoodId; volume: number }[];
  totalVolume: number;
  totalValue: number;
  /** Mean utilisation across the routes. */
  utilization: number;
  /** Worst status among the routes. */
  status: LinkStatus;
  /** True when the two ends are in different realms. */
  international: boolean;
  /** Diplomatic footing between the two realms, when they differ. */
  relation: { status: string; score: number } | null;
}

/** Something the network cannot do, with what it costs downstream. */
export interface Bottleneck {
  id: string;
  kind: 'rail-severed' | 'route-closed' | 'route-congested' | 'road-damaged' | 'port-down' | 'disconnected' | 'stranded-station';
  network: NetworkId | 'trade';
  /** Where it is, in words. */
  location: string;
  problem: string;
  severity: 'warning' | 'critical';
  /** Goods whose movement this blocks. */
  affectedGoods: GoodId[];
  /** Settlements on the wrong side of it. */
  affectedCities: { id: string; name: string }[];
  /** Realms on the wrong side of it. */
  affectedKingdoms: { id: string; name: string }[];
  /** The consequence, when the stock and the recipes prove one. */
  consequence: string | null;
  at: { x: number; y: number } | null;
  cityId?: string;
  kingdomId?: string;
}

/** A settlement's access to the wider world. */
export interface CityAccess {
  cityId: string;
  cityName: string;
  kingdomId: string | null;
  kingdomName: string | null;
  population: number;
  /** Best road level anywhere in its territory. */
  roadLevel: number;
  railTiles: number;
  /** True when its rail joins it to at least one other settlement. */
  railConnected: boolean;
  hasPort: boolean;
  portOperational: boolean;
  routesIn: number;
  routesOut: number;
  routesClosed: number;
  /** No road, no rail, no route: nothing reaches it. */
  isolated: boolean;
  /** Goods it imports and would stop receiving if its routes shut. */
  importedGoods: { good: GoodId; volume: number }[];
  x: number;
  y: number;
}

export interface LogisticsMetrics {
  year: number;

  roads: RoadNetwork;
  rail: RailNetwork;
  ports: PortView[];
  routes: RouteView[];
  corridors: CorridorView[];
  movers: MoverView[];
  cities: CityAccess[];
  bottlenecks: Bottleneck[];

  // ---- World totals ----
  landTradeVolume: number;
  seaTradeVolume: number;
  activeRoutes: number;
  closedRoutes: number;
  totalTradeValue: number;
  /** Caravans and ships on the map right now. */
  activeCaravans: number;
  activeShips: number;
}

// ============================ ROAD LEVEL VOCABULARY ============================

/** The names the simulation's own comment gives each road level. */
export const ROAD_LEVEL_LABEL: Record<number, string> = {
  0: 'Sem via',
  1: 'Trilha de terra',
  2: 'Via de pedra',
  3: 'Estrada imperial'
};

// ============================ COMPUTATION ============================

export function computeLogisticsMetrics(ctx: GameContext): LogisticsMetrics {
  const sim = ctx.sim;
  const cities = [...sim.cities.values()];

  // One sweep of the grid serves both networks. This is the expensive part and
  // the reason the whole module is cached.
  const { roads, railTiles } = sweepGrid(ctx);
  const rail = buildRail(railTiles, ctx);
  const routes = collectRoutes(ctx);
  const movers = collectMovers(routes, ctx);
  const ports = collectPorts(cities, routes, ctx);
  const corridors = buildCorridors(routes, ctx);
  const cityAccess = buildCityAccess(cities, routes, rail, ctx);

  const land = routes.filter(r => r.kind === 'overland');
  const sea = routes.filter(r => r.kind === 'maritime');

  return {
    year: sim.currentYear,

    roads,
    rail,
    ports,
    routes,
    corridors,
    movers,
    cities: cityAccess,
    bottlenecks: detectBottlenecks(roads, rail, routes, ports, cityAccess, ctx),

    landTradeVolume: land.reduce((s, r) => s + r.route.volume, 0),
    seaTradeVolume: sea.reduce((s, r) => s + r.route.volume, 0),
    activeRoutes: routes.filter(r => r.route.active).length,
    closedRoutes: routes.filter(r => !r.route.active).length,
    totalTradeValue: routes.reduce((s, r) => s + r.route.totalValue, 0),
    activeCaravans: sim.caravans.activeCaravans.size,
    activeShips: sim.naval.activeShips.size
  };
}

// ---------------- Grid sweep ----------------

/**
 * One pass over the map for both surface networks.
 *
 * `roadLevelEffective` already encodes what damage costs a road, so a tile is
 * counted as damaged when its effective level is below the level that was
 * actually built — which is the same test the movers apply.
 */
function sweepGrid(ctx: GameContext): { roads: RoadNetwork; railTiles: Tile[] } {
  const map = ctx.tileMap;
  const byLevel = [0, 0, 0, 0];
  const railTiles: Tile[] = [];
  const busiest: RoadNetwork['busiest'] = [];

  let tiles = 0;
  let damagedTiles = 0;
  let totalTraffic = 0;
  let levelSum = 0;

  for (let x = 0; x < map.width; x++) {
    for (let y = 0; y < map.height; y++) {
      const tile = map.grid[x][y];
      if (tile.railLevel > 0) railTiles.push(tile);
      if (tile.roadLevel <= 0) continue;

      tiles++;
      byLevel[Math.min(3, tile.roadLevel)]++;
      levelSum += tile.roadLevel;
      totalTraffic += tile.roadTraffic;
      if (tile.roadLevelEffective < tile.roadLevel) damagedTiles++;

      // A small running top-N beats sorting every road tile on a large map.
      if (tile.roadTraffic > 0) {
        busiest.push({
          x: tile.x, y: tile.y, level: tile.roadLevel, traffic: tile.roadTraffic,
          cityId: tile.cityId ?? null,
          cityName: tile.cityId ? ctx.sim.cities.get(tile.cityId)?.name ?? null : null
        });
        if (busiest.length > 400) {
          busiest.sort((a, b) => b.traffic - a.traffic);
          busiest.length = 200;
        }
      }
    }
  }

  busiest.sort((a, b) => b.traffic - a.traffic);

  return {
    roads: {
      tiles,
      byLevel,
      damagedTiles,
      totalTraffic,
      busiest: busiest.slice(0, 12),
      meanLevel: tiles > 0 ? levelSum / tiles : null
    },
    railTiles
  };
}

// ---------------- Rail ----------------

/**
 * The rail network, from the engine's own connectivity walk.
 *
 * `components()` treats a segment damaged past its floor as absent, so a broken
 * rail genuinely splits a line in two rather than acting as a bridge. That is the
 * behaviour the freight tick sees, so it is the behaviour reported here.
 */
function buildRail(railTiles: Tile[], ctx: GameContext): RailNetwork {
  const sim = ctx.sim;

  let severedTiles = 0;
  let degradedTiles = 0;
  for (const tile of railTiles) {
    if (tile.railLevelEffective <= 0) severedTiles++;
    else if (tile.railDamage > 0.01) degradedTiles++;
  }

  const lines: RailLine[] = [];
  const strandedStations: RailNetwork['strandedStations'] = [];

  // Only walk the components when there is track at all: `components()` sweeps
  // the whole grid and a stone-age world has nothing for it to find.
  if (railTiles.length > 0) {
    let index = 0;
    for (const component of sim.railways.components(ctx.tileMap)) {
      index++;
      const stations: RailLine['stations'] = [];
      const owners = new Map<string, { kingdomId: string; name: string; color: string }>();
      let damaged = 0;

      for (const tile of component) {
        if (tile.railDamage > 0.01) damaged++;
        if (tile.railOwnerId) {
          const owner = sim.kingdoms.get(tile.railOwnerId);
          if (owner && !owners.has(owner.id)) {
            owners.set(owner.id, { kingdomId: owner.id, name: owner.name, color: owner.color });
          }
        }
        if (!tile.cityId) continue;
        const city = sim.cities.get(tile.cityId);
        if (!city || stations.some(s => s.cityId === city.id)) continue;
        const kingdom = city.kingdomId ? sim.kingdoms.get(city.kingdomId) ?? null : null;
        stations.push({
          cityId: city.id, cityName: city.name,
          kingdomId: kingdom?.id ?? null, kingdomName: kingdom?.name ?? null,
          x: city.x, y: city.y
        });
      }

      const quality = sim.railways.lineQuality(component);

      // A single-station component is track that joins a settlement to nothing.
      // That is a real finding, not a line.
      if (stations.length < 2) {
        for (const station of stations) {
          strandedStations.push({ cityId: station.cityId, cityName: station.cityName });
        }
        if (stations.length === 0) continue;
      }

      lines.push({
        id: `line_${index}`,
        tiles: component.length,
        quality,
        stations,
        owners: [...owners.values()],
        // The goods rail freight is written to carry, narrowed to the ones these
        // stations actually hold or want. Anything else would be speculation.
        goods: railGoodsFor(stations, ctx),
        damagedTiles: damaged,
        at: { x: component[0].x, y: component[0].y },
        status: stations.length < 2 ? 'disconnected'
          : quality < 0.5 ? 'damaged'
          : damaged > 0 ? 'busy'
          : 'healthy'
      });
    }
  }

  return {
    tiles: railTiles.length,
    severedTiles,
    degradedTiles,
    lines: lines.sort((a, b) => b.stations.length - a.stations.length || b.tiles - a.tiles),
    strandedStations,
    worldFreight: sim.railways.yearlyFreight,
    builtThisYear: sim.railways.yearlyConstructed
  };
}

/** Freight goods these stations hold or consume. The engine hauls only these. */
const FREIGHT_GOODS: GoodId[] = ['coal', 'iron', 'oil', 'steel'];

function railGoodsFor(stations: RailLine['stations'], ctx: GameContext): GoodId[] {
  const out = new Set<GoodId>();
  for (const station of stations) {
    const city = ctx.sim.cities.get(station.cityId);
    if (!city) continue;
    for (const good of FREIGHT_GOODS) {
      const flow = city.ledger.flow(good);
      if (city.stock.get(good) > 0.01 || flow.produced > 0 || flow.consumed > 0) out.add(good);
    }
  }
  return [...out];
}

// ---------------- Routes ----------------

/**
 * Every route with its infrastructure and its economics resolved.
 *
 * Transport cost calls the simulation's own `transportCostPerUnit`, so the figure
 * shown is the figure charged when the route was opened. The four prices together
 * are why the route exists at all.
 */
function collectRoutes(ctx: GameContext): RouteView[] {
  const sim = ctx.sim;
  const out: RouteView[] = [];

  for (const route of sim.trade.routes.values()) {
    const fromCity = sim.cities.get(route.fromCityId) ?? null;
    const toCity = sim.cities.get(route.toCityId) ?? null;
    const fromKingdom = sim.kingdoms.get(route.fromKingdomId) ?? null;
    const toKingdom = sim.kingdoms.get(route.toKingdomId) ?? null;

    const distance = fromCity && toCity ? Math.hypot(fromCity.x - toCity.x, fromCity.y - toCity.y) : 0;
    const worldPrice = sim.market.price(route.good);
    const isSea = route.kind === 'maritime';
    const avgRoad = isSea ? null : avgEffectiveRoadLevel(route.path, ctx.tileMap);
    const capacityFactor = isSea
      ? (fromCity && toCity ? portCapacityFactor(fromCity, toCity) : 0)
      : roadCapacityFactor(route.path, ctx.tileMap);

    let railTiles = 0;
    let damagedTiles = 0;
    for (const step of route.path ?? []) {
      const tile = ctx.tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
      if (!tile) continue;
      if (tile.railLevel > 0) railTiles++;
      if (tile.roadLevel > 0 && tile.roadLevelEffective < tile.roadLevel) damagedTiles++;
    }

    const sourcePrice = fromKingdom ? fromKingdom.economy.market.price(route.good, worldPrice) : worldPrice;
    const destPrice = toKingdom ? toKingdom.economy.market.price(route.good, worldPrice) : worldPrice;
    const treaty = sim.trade.getAgreement(route.fromKingdomId, route.toKingdomId)?.tariff;
    const tariffRate = treaty ?? toKingdom?.tariffRate() ?? 0;
    const transportCost = transportCostPerUnit(route.kind, distance, worldPrice, avgRoad ?? 1.5);
    const utilization = route.maxVolume > 0 ? Math.min(1, route.volume / route.maxVolume) : 0;
    const embargoed = sim.trade.isEmbargoed(route.fromKingdomId, route.toKingdomId) ||
      sim.trade.isEmbargoed(route.toKingdomId, route.fromKingdomId);

    out.push({
      route,
      kind: route.kind,
      good: route.good,
      goodName: GOODS[route.good]?.name ?? route.good,
      fromCity, toCity, fromKingdom, toKingdom,
      distance,
      capacityFactor,
      utilization,
      // Only states the simulation can prove. An inactive route is shut either by
      // war or by embargo, and `isEmbargoed` tells the two apart.
      status: !route.active
        ? (embargoed ? 'blocked' : 'war-closed')
        : damagedTiles > 0 || capacityFactor < 0.75 ? 'damaged'
        : utilization >= 0.99 ? 'congested'
        : utilization >= 0.8 ? 'busy'
        : 'healthy',
      avgRoadLevel: avgRoad,
      railTiles,
      damagedTiles,
      sourcePrice,
      destPrice,
      transportCost,
      tariffRate,
      marginPerUnit: destPrice - sourcePrice - transportCost - destPrice * tariffRate,
      caravans: [],
      ships: []
    });
  }

  return out.sort((a, b) => b.route.totalValue - a.route.totalValue);
}

// ---------------- Movers ----------------

/**
 * The things actually moving on the map.
 *
 * Caravans and ships are the whole population of physical movers — there is no
 * train entity, because rail freight is a direct transfer between stations on a
 * connected line. Each mover carries a real cargo and a real amount, so a player
 * can ask what a caravan is hauling and get an answer.
 */
function collectMovers(routes: RouteView[], ctx: GameContext): MoverView[] {
  const byRoute = new Map(routes.map(r => [r.route.id, r]));
  const out: MoverView[] = [];

  for (const caravan of ctx.sim.caravans.activeCaravans.values()) {
    const route = byRoute.get(caravan.routeId);
    if (route) route.caravans.push(caravan);
    out.push({
      id: caravan.id,
      kind: 'caravan',
      variant: CARAVAN_LABEL[caravan.caravanType] ?? caravan.caravanType,
      routeId: caravan.routeId,
      fromName: caravan.fromCityName,
      toName: caravan.toCityName,
      good: caravan.cargo,
      goodName: GOODS[caravan.cargo]?.name ?? caravan.cargo,
      amount: caravan.cargoAmount,
      progress: caravan.progress,
      outbound: caravan.direction === 1,
      color: caravan.kingdomColor,
      x: caravan.x,
      y: caravan.y,
      routeClosed: route ? !route.route.active : false
    });
  }

  for (const ship of ctx.sim.naval.activeShips.values()) {
    const route = byRoute.get(ship.routeId);
    if (route) route.ships.push(ship);
    out.push({
      id: ship.id,
      kind: 'ship',
      variant: `Nau nível ${ship.tier}`,
      routeId: ship.routeId,
      fromName: ship.fromCityName,
      toName: ship.toCityName,
      good: ship.cargo,
      goodName: GOODS[ship.cargo]?.name ?? ship.cargo,
      amount: ship.cargoAmount,
      progress: ship.progress,
      outbound: ship.direction === 1,
      color: ship.kingdomColor,
      x: ship.x,
      y: ship.y,
      routeClosed: route ? !route.route.active : false
    });
  }

  return out.sort((a, b) => b.amount - a.amount);
}

const CARAVAN_LABEL: Record<string, string> = {
  donkey: 'Comboio de burros', camel: 'Caravana de camelos', cart: 'Comboio de carroças'
};

// ---------------- Ports ----------------

/**
 * Ports, with what actually passes through them.
 *
 * The share figure is the reason a port is geopolitically interesting: a harbour
 * handling most of a realm's sea trade is a single point the whole realm hangs
 * from, and that is computable from the routes rather than asserted.
 */
function collectPorts(cities: City[], routes: RouteView[], ctx: GameContext): PortView[] {
  const seaRoutes = routes.filter(r => r.kind === 'maritime');
  const out: PortView[] = [];

  // Sea volume per realm, so each port's share of its realm is real.
  const realmSeaVolume = new Map<string, number>();
  for (const route of seaRoutes) {
    for (const id of [route.fromKingdom?.id, route.toKingdom?.id]) {
      if (id) realmSeaVolume.set(id, (realmSeaVolume.get(id) ?? 0) + route.route.volume);
    }
  }

  for (const city of cities) {
    let berths = 0;
    let hp = 0;
    let maxHp = 0;
    for (const building of city.buildings.values()) {
      if (building.type !== 'port' && building.type !== 'harbor') continue;
      berths++;
      hp += building.hp;
      maxHp += building.maxHp;
    }
    if (berths === 0) continue;

    const mine = seaRoutes.filter(r => r.route.fromCityId === city.id || r.route.toCityId === city.id);
    const inbound = new Map<GoodId, number>();
    const outbound = new Map<GoodId, number>();
    let inboundVolume = 0;
    let outboundVolume = 0;

    for (const route of mine) {
      if (route.route.toCityId === city.id) {
        inbound.set(route.good, (inbound.get(route.good) ?? 0) + route.route.volume);
        inboundVolume += route.route.volume;
      } else {
        outbound.set(route.good, (outbound.get(route.good) ?? 0) + route.route.volume);
        outboundVolume += route.route.volume;
      }
    }

    const kingdom = city.kingdomId ? ctx.sim.kingdoms.get(city.kingdomId) ?? null : null;
    const condition = maxHp > 0 ? hp / maxHp : 1;
    const operational = portOperational(city);
    const realmVolume = kingdom ? realmSeaVolume.get(kingdom.id) ?? 0 : 0;

    out.push({
      cityId: city.id,
      cityName: city.name,
      kingdomId: kingdom?.id ?? null,
      kingdomName: kingdom?.name ?? null,
      kingdomColor: kingdom?.color ?? null,
      berths,
      condition,
      operational,
      maritimeRoutes: mine,
      inboundVolume,
      outboundVolume,
      majorImports: topGoods(inbound),
      majorExports: topGoods(outbound),
      realmSeaShare: realmVolume > 0 ? (inboundVolume + outboundVolume) / realmVolume : 0,
      status: !operational ? 'damaged'
        : mine.some(r => r.status === 'war-closed') ? 'war-closed'
        : mine.some(r => r.status === 'blocked') ? 'blocked'
        : condition < 0.75 ? 'damaged'
        : mine.length === 0 ? 'disconnected'
        : 'healthy',
      x: city.x,
      y: city.y
    });
  }

  return out.sort((a, b) => (b.inboundVolume + b.outboundVolume) - (a.inboundVolume + a.outboundVolume));
}

function topGoods(map: Map<GoodId, number>): { good: GoodId; volume: number }[] {
  return [...map.entries()]
    .map(([good, volume]) => ({ good, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);
}

// ---------------- Corridors ----------------

/**
 * Routes aggregated by the pair of settlements they join.
 *
 * A corridor is not a simulation entity and is not made into one — it is the
 * answer to "what moves between these two places", assembled from the routes that
 * already exist. Direction is folded together on purpose: coal going one way and
 * steel coming back is one corridor, not two.
 */
function buildCorridors(routes: RouteView[], ctx: GameContext): CorridorView[] {
  const groups = new Map<string, RouteView[]>();

  for (const route of routes) {
    if (!route.fromCity || !route.toCity) continue;
    const a = route.fromCity.id;
    const b = route.toCity.id;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const list = groups.get(key) ?? [];
    list.push(route);
    groups.set(key, list);
  }

  const out: CorridorView[] = [];
  for (const [key, list] of groups) {
    const first = list[0];
    // The pair is ordered by the key, so the same corridor always reads the same
    // way round no matter which route happened to be found first.
    const [aId] = key.split('|');
    const head = first.fromCity!.id === aId ? first.fromCity! : first.toCity!;
    const tail = first.fromCity!.id === aId ? first.toCity! : first.fromCity!;

    const goods = new Map<GoodId, number>();
    for (const route of list) goods.set(route.good, (goods.get(route.good) ?? 0) + route.route.volume);

    const headKingdom = head.kingdomId ? ctx.sim.kingdoms.get(head.kingdomId) ?? null : null;
    const tailKingdom = tail.kingdomId ? ctx.sim.kingdoms.get(tail.kingdomId) ?? null : null;
    const international = Boolean(headKingdom && tailKingdom && headKingdom.id !== tailKingdom.id);

    out.push({
      id: key,
      fromCityId: head.id,
      fromName: head.name,
      toCityId: tail.id,
      toName: tail.name,
      fromKingdomId: headKingdom?.id ?? null,
      toKingdomId: tailKingdom?.id ?? null,
      modes: [...new Set(list.map(r => r.kind))],
      railed: list.some(r => r.railTiles > 0),
      routes: list,
      goods: [...goods.entries()].map(([good, volume]) => ({ good, volume })).sort((a, b) => b.volume - a.volume),
      totalVolume: list.reduce((s, r) => s + r.route.volume, 0),
      totalValue: list.reduce((s, r) => s + r.route.totalValue, 0),
      utilization: list.reduce((s, r) => s + r.utilization, 0) / list.length,
      status: worstStatus(list.map(r => r.status)),
      international,
      relation: international && headKingdom && tailKingdom
        ? {
            status: ctx.sim.diplomacy.getStatus(headKingdom.id, tailKingdom.id),
            score: ctx.sim.diplomacy.getRelation(headKingdom.id, tailKingdom.id)
          }
        : null
    });
  }

  return out.sort((a, b) => b.totalValue - a.totalValue);
}

const STATUS_RANK: Record<LinkStatus, number> = {
  'war-closed': 0, blocked: 1, damaged: 2, disconnected: 3, congested: 4, busy: 5, healthy: 6
};

function worstStatus(list: LinkStatus[]): LinkStatus {
  return list.reduce((worst, s) => (STATUS_RANK[s] < STATUS_RANK[worst] ? s : worst), 'healthy' as LinkStatus);
}

// ---------------- City access ----------------

function buildCityAccess(
  cities: City[],
  routes: RouteView[],
  rail: RailNetwork,
  ctx: GameContext
): CityAccess[] {
  const railConnected = new Set<string>();
  for (const line of rail.lines) {
    if (line.stations.length < 2) continue;
    for (const station of line.stations) railConnected.add(station.cityId);
  }

  return cities.map(city => {
    let roadLevel = 0;
    let railTiles = 0;
    for (const key of city.territory) {
      const [xs, ys] = key.split(',');
      const tile = ctx.tileMap.getTile(Number(xs), Number(ys));
      if (!tile) continue;
      if (tile.roadLevelEffective > roadLevel) roadLevel = tile.roadLevelEffective;
      if (tile.railLevel > 0) railTiles++;
    }

    const mine = routes.filter(r => r.route.fromCityId === city.id || r.route.toCityId === city.id);
    const inbound = mine.filter(r => r.route.toCityId === city.id);
    const kingdom = city.kingdomId ? ctx.sim.kingdoms.get(city.kingdomId) ?? null : null;
    const hasPort = city.hasBuilding('port') || city.hasBuilding('harbor');

    const importedGoods = new Map<GoodId, number>();
    for (const route of inbound) {
      importedGoods.set(route.good, (importedGoods.get(route.good) ?? 0) + route.route.volume);
    }

    return {
      cityId: city.id,
      cityName: city.name,
      kingdomId: kingdom?.id ?? null,
      kingdomName: kingdom?.name ?? null,
      population: city.population,
      roadLevel,
      railTiles,
      railConnected: railConnected.has(city.id),
      hasPort,
      portOperational: hasPort ? portOperational(city) : false,
      routesIn: inbound.length,
      routesOut: mine.length - inbound.length,
      routesClosed: mine.filter(r => !r.route.active).length,
      // Nothing reaches it: no usable road, no rail joining it to anyone, no route.
      isolated: roadLevel === 0 && !railConnected.has(city.id) && mine.length === 0,
      importedGoods: topGoods(importedGoods),
      x: city.x,
      y: city.y
    };
  }).sort((a, b) => b.population - a.population);
}

// ---------------- Bottlenecks ----------------

/**
 * What the network cannot do, and what that costs.
 *
 * Every entry is proved by state: a severed rail tile, a route the trade network
 * marked inactive, a road whose effective level fell, a port the simulation calls
 * inoperable, a settlement nothing reaches. The consequence line is only written
 * when the stock and the recipes support it — otherwise it is null and the row
 * says what is broken without claiming what it will cause.
 */
function detectBottlenecks(
  roads: RoadNetwork,
  rail: RailNetwork,
  routes: RouteView[],
  ports: PortView[],
  cities: CityAccess[],
  ctx: GameContext
): Bottleneck[] {
  const out: Bottleneck[] = [];

  // ---- Rail cut in two ----
  if (rail.severedTiles > 0) {
    const affected = rail.lines.filter(l => l.damagedTiles > 0);
    const cityList = affected.flatMap(l => l.stations.map(s => ({ id: s.cityId, name: s.cityName })));
    const goods = [...new Set(affected.flatMap(l => l.goods))];
    out.push({
      id: 'rail-severed',
      kind: 'rail-severed',
      network: 'rail',
      location: railLocationLabel(affected),
      problem: `${rail.severedTiles} trecho(s) com dano acima do limite que rompe a linha`,
      severity: 'critical',
      affectedGoods: goods,
      affectedCities: cityList.slice(0, 6),
      affectedKingdoms: uniqueKingdoms(affected.flatMap(l => l.owners)),
      consequence: consequenceOfLostFreight(goods, cityList.map(c => c.id), ctx),
      at: affected[0]?.at ?? null
    });
  }

  // ---- Track that joins a settlement to nobody ----
  for (const stranded of rail.strandedStations) {
    const city = ctx.sim.cities.get(stranded.cityId);
    out.push({
      id: `stranded:${stranded.cityId}`,
      kind: 'stranded-station',
      network: 'rail',
      location: stranded.cityName,
      problem: 'Trilhos assentados que não alcançam nenhuma outra estação',
      severity: 'warning',
      affectedGoods: [],
      affectedCities: [{ id: stranded.cityId, name: stranded.cityName }],
      affectedKingdoms: [],
      consequence: 'A malha só move carga entre estações do mesmo trecho contínuo, então esta linha não transporta nada.',
      at: city ? { x: city.x, y: city.y } : null,
      cityId: stranded.cityId
    });
  }

  // ---- Routes the world shut ----
  for (const route of routes) {
    if (route.status !== 'war-closed' && route.status !== 'blocked') continue;
    const destination = route.toCity;
    out.push({
      id: `closed:${route.route.id}`,
      kind: 'route-closed',
      network: 'trade',
      location: `${route.fromCity?.name ?? '?'} → ${route.toCity?.name ?? '?'}`,
      problem: route.status === 'blocked'
        ? 'Rota fechada por embargo entre os reinos'
        : 'Rota fechada pela guerra entre os reinos',
      severity: 'critical',
      affectedGoods: [route.good],
      affectedCities: destination ? [{ id: destination.id, name: destination.name }] : [],
      affectedKingdoms: uniqueKingdoms([route.fromKingdom, route.toKingdom]
        .filter(Boolean)
        .map(k => ({ kingdomId: k!.id, name: k!.name, color: k!.color }))),
      consequence: destination ? consequenceOfLostGood(route.good, destination, ctx) : null,
      at: route.fromCity ? { x: route.fromCity.x, y: route.fromCity.y } : null,
      cityId: destination?.id,
      kingdomId: route.toKingdom?.id
    });
  }

  // ---- Corridors at their ceiling ----
  for (const route of routes) {
    if (route.status !== 'congested') continue;
    out.push({
      id: `congested:${route.route.id}`,
      kind: 'route-congested',
      network: route.kind === 'maritime' ? 'sea' : 'road',
      location: `${route.fromCity?.name ?? '?'} → ${route.toCity?.name ?? '?'}`,
      problem: `Movendo ${route.route.volume.toFixed(0)} de um teto de ${route.route.maxVolume.toFixed(0)} — mais comércio exige melhor infraestrutura`,
      severity: 'warning',
      affectedGoods: [route.good],
      affectedCities: route.toCity ? [{ id: route.toCity.id, name: route.toCity.name }] : [],
      affectedKingdoms: [],
      consequence: route.kind === 'overland' && route.avgRoadLevel !== null && route.avgRoadLevel < 2
        ? `A via média no caminho é ${ROAD_LEVEL_LABEL[Math.round(route.avgRoadLevel)] ?? 'precária'}: melhorá-la eleva o teto.`
        : null,
      at: route.fromCity ? { x: route.fromCity.x, y: route.fromCity.y } : null
    });
  }

  // ---- Roads that lost a level to war ----
  const damagedRoutes = routes.filter(r => r.damagedTiles > 0 && r.route.active);
  if (roads.damagedTiles > 0 && damagedRoutes.length) {
    out.push({
      id: 'road-damaged',
      kind: 'road-damaged',
      network: 'road',
      location: damagedRoutes.slice(0, 2).map(r => `${r.fromCity?.name ?? '?'} → ${r.toCity?.name ?? '?'}`).join(', '),
      problem: `${roads.damagedTiles} tile(s) de via degradados, atingindo ${damagedRoutes.length} rota(s)`,
      severity: damagedRoutes.length >= 3 ? 'critical' : 'warning',
      affectedGoods: [...new Set(damagedRoutes.map(r => r.good))],
      affectedCities: damagedRoutes.slice(0, 4).map(r => ({ id: r.toCity?.id ?? '', name: r.toCity?.name ?? '?' })).filter(c => c.id),
      affectedKingdoms: [],
      consequence: 'Uma via danificada baixa o nível efetivo da estrada, o que reduz a capacidade da rota e encarece o transporte por unidade.',
      at: damagedRoutes[0].fromCity ? { x: damagedRoutes[0].fromCity.x, y: damagedRoutes[0].fromCity.y } : null
    });
  }

  // ---- Ports that cannot work ----
  for (const port of ports) {
    if (port.operational && port.condition >= 0.75) continue;
    const city = ctx.sim.cities.get(port.cityId);
    out.push({
      id: `port:${port.cityId}`,
      kind: 'port-down',
      network: 'sea',
      location: port.cityName,
      problem: port.operational
        ? `Ancoradouro em ${Math.round(port.condition * 100)}% de condição`
        : 'Porto inoperante — a simulação não o considera capaz de movimentar comércio',
      severity: port.operational ? 'warning' : 'critical',
      affectedGoods: [...new Set([...port.majorImports, ...port.majorExports].map(g => g.good))],
      affectedCities: [{ id: port.cityId, name: port.cityName }],
      affectedKingdoms: port.kingdomId && port.kingdomName
        ? [{ id: port.kingdomId, name: port.kingdomName }]
        : [],
      consequence: port.realmSeaShare >= 0.5 && port.kingdomName
        ? `Este porto responde por ${Math.round(port.realmSeaShare * 100)}% de todo o comércio marítimo de ${port.kingdomName}.`
        : city ? consequenceOfPortLoss(port, city, ctx) : null,
      at: { x: port.x, y: port.y },
      cityId: port.cityId,
      kingdomId: port.kingdomId ?? undefined
    });
  }

  // ---- Settlements nothing reaches ----
  for (const city of cities) {
    if (!city.isolated || city.population < 10) continue;
    out.push({
      id: `isolated:${city.cityId}`,
      kind: 'disconnected',
      network: 'road',
      location: city.cityName,
      problem: `${city.population} habitantes sem via, sem trilho e sem rota`,
      severity: city.population >= 40 ? 'critical' : 'warning',
      affectedGoods: [],
      affectedCities: [{ id: city.cityId, name: city.cityName }],
      affectedKingdoms: city.kingdomId && city.kingdomName ? [{ id: city.kingdomId, name: city.kingdomName }] : [],
      consequence: 'Sem ligação, este assentamento só consome o que produz por conta própria.',
      at: { x: city.x, y: city.y },
      cityId: city.cityId
    });
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
}

/**
 * A name for the broken stretch of rail.
 *
 * Two or more stations read as the corridor they join. One station is not a
 * corridor, and printing its name alone would suggest a route that does not
 * exist — so it says what it actually is.
 */
function railLocationLabel(lines: RailLine[]): string {
  const line = lines[0];
  if (!line) return 'Malha ferroviária';
  if (line.stations.length >= 2) return line.stations.map(s => s.cityName).join(' → ');
  if (line.stations.length === 1) return `Trilhos de ${line.stations[0].cityName}`;
  return 'Trecho ferroviário sem estação';
}

function uniqueKingdoms(list: { kingdomId: string; name: string }[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const entry of list) seen.set(entry.kingdomId, entry.name);
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

/**
 * What losing a good at one settlement actually costs it.
 *
 * Only claimed when the books prove it: the city consumes the good, and either
 * its stock is short or a recipe of something it makes needs it. Otherwise null.
 */
function consequenceOfLostGood(good: GoodId, city: City, ctx: GameContext): string | null {
  const flow = city.ledger.flow(good);
  if (flow.consumed <= 0 && flow.imported <= 0) return null;

  const stock = city.stock.get(good);
  const name = GOODS[good]?.name ?? good;
  const parts: string[] = [];

  if (flow.imported > 0 && flow.consumed > 0) {
    const share = Math.min(1, flow.imported / flow.consumed);
    parts.push(`${city.name} importava ${Math.round(share * 100)}% do ${name} que consome`);
  }
  if (stock <= 0.01) parts.push('e não tem nada em estoque');
  else if (flow.consumed > 0) parts.push(`e tem ${stock.toFixed(0)} em estoque, ${(stock / flow.consumed).toFixed(1)} ano(s) de consumo`);

  // Anything this city makes whose recipe needs the good is what stops next.
  const blocked = downstreamOf(good, city);
  if (blocked.length) {
    parts.push(`— sem ele, ${blocked.map(g => GOODS[g]?.name ?? g).join(' e ')} para de ser produzido aqui`);
  }

  void ctx;
  return parts.length ? `${parts.join(' ')}.` : null;
}

/** What a lost freight flow costs the stations that were receiving it. */
function consequenceOfLostFreight(goods: GoodId[], cityIds: string[], ctx: GameContext): string | null {
  const parts: string[] = [];
  for (const good of goods.slice(0, 3)) {
    const consumers = cityIds
      .map(id => ctx.sim.cities.get(id))
      .filter((c): c is City => Boolean(c) && c!.ledger.flow(good).consumed > 0);
    if (!consumers.length) continue;
    const blocked = [...new Set(consumers.flatMap(c => downstreamOf(good, c)))];
    parts.push(blocked.length
      ? `${GOODS[good]?.name ?? good} deixa de chegar a ${consumers.map(c => c.name).join(', ')}, travando ${blocked.map(g => GOODS[g]?.name ?? g).join(' e ')}`
      : `${GOODS[good]?.name ?? good} deixa de chegar a ${consumers.map(c => c.name).join(', ')}`);
  }
  return parts.length ? `${parts.join('; ')}.` : null;
}

/** What a port going down costs the city behind it. */
function consequenceOfPortLoss(port: PortView, city: City, ctx: GameContext): string | null {
  if (!port.majorImports.length) return null;
  const first = port.majorImports[0];
  return consequenceOfLostGood(first.good, city, ctx);
}

/**
 * Goods this settlement makes whose recipe consumes the given input.
 *
 * Read from `GOODS[x].recipe` — the same table the simulation crafts from — and
 * narrowed to what this city actually produces. That narrowing is what makes the
 * claim safe: a city with no smithy is not "blocked on steel".
 */
function downstreamOf(input: GoodId, city: City): GoodId[] {
  const out: GoodId[] = [];
  for (const [good, def] of Object.entries(GOODS)) {
    const recipe = def.recipe;
    if (!recipe || !(input in recipe)) continue;
    const id = good as GoodId;
    if (city.ledger.flow(id).produced > 0 || city.stock.get(id) > 0.01) out.push(id);
  }
  return out;
}

// ============================ CACHE ============================

/** Longest a logistics snapshot is trusted. It sweeps the whole map. */
const MAX_AGE_MS = 3000;

/**
 * Holds the world's logistics and decides when to recompute.
 *
 * A year boundary forces a rebuild: freight settles, routes are re-evaluated and
 * the ledgers roll over together. Otherwise the cadence is deliberately slow —
 * this is the single most expensive read in the interface, walking width × height
 * tiles plus every rail component, and it must never run per frame.
 */
export class LogisticsMetricsCache {
  private metrics: LogisticsMetrics | null = null;
  private builtAt = -Infinity;
  private builtYear = -1;

  public get(ctx: GameContext, now: number): LogisticsMetrics {
    const yearChanged = ctx.sim.currentYear !== this.builtYear;
    const stale = now - this.builtAt >= MAX_AGE_MS;
    if (this.metrics && !yearChanged && !stale) return this.metrics;

    this.metrics = computeLogisticsMetrics(ctx);
    this.builtAt = now;
    this.builtYear = ctx.sim.currentYear;
    return this.metrics;
  }

  public invalidate(): void {
    this.builtAt = -Infinity;
  }
}
