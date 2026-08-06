/**
 * The world economy, computed once.
 *
 * This is the widest aggregation in the game — every settlement's books, every
 * route, every deposit on the map — so it runs behind a cache on a slow cadence
 * and never inside a render. See `EconomyMetricsCache`.
 *
 * The discipline is the same one that governed UI-3 and UI-4: **every figure
 * traces to something a system recorded.** Supply and demand are the world's
 * closed-year production and consumption from `CityLedger`, not the mid-year
 * accumulators on `WorldMarket` — those reset at every settle, so reading them
 * halfway through a year reports a fraction of the truth. Prices and their
 * history come straight from `WorldMarket`, which persists them across saves.
 * Transport cost calls the same `transportCostPerUnit` the trade decision used.
 * Anything that cannot be computed is `null` and its row is omitted.
 */
import { BUILDINGS, type BuildingCategory } from '../../civ/Building';
import {
  GOODS, ALL_GOODS, MINEABLE_GOODS, QUARRY_GOODS, FORESTRY_GOODS,
  FARM_GOODS, PASTURE_GOODS, WELL_GOODS,
  type GoodId, type GoodTier, type GoodKind
} from '../../civ/Goods';
import { transportCostPerUnit, type TradeRoute, type RouteKind } from '../../civ/Trade';
import { avgEffectiveRoadLevel, roadCapacityFactor, portCapacityFactor } from '../../civ/Infrastructure';
import type { GoodFlow } from '../../civ/Economy';
import type { City } from '../../civ/City';
import type { Kingdom } from '../../civ/Kingdom';
import type { GameContext } from '../core/GameContext';

// ============================ SHAPES ============================

/** The categories the goods filter offers, derived from the registry's own fields. */
export type GoodCategory = 'all' | 'raw' | 'crafted' | 'strategic' | 'food' | 'industrial';

/** Goods a war economy and an industrial base actually run on. */
export const INDUSTRIAL_GOODS: GoodId[] = (
  ['iron', 'coal', 'steel', 'fuel', 'machinery', 'tools', 'gunpowder', 'bronze'] as GoodId[]
).filter(good => Object.prototype.hasOwnProperty.call(GOODS, good));

/** Goods that feed people, for the food filter and the food-supply indicator. */
export const FOOD_GOODS: GoodId[] = (['food', 'spices', 'salt'] as GoodId[])
  .filter(good => Object.prototype.hasOwnProperty.call(GOODS, good));

export interface WorldGoodPosition {
  good: GoodId;
  name: string;
  tier: GoodTier;
  kind: GoodKind;
  strategic: boolean;

  price: number;
  basePrice: number;
  /** Change against the previous settled year, as a fraction. */
  priceChange: number;
  /** Price against base, so "expensive by historical standards" is visible. */
  priceIndex: number;
  /** The market's own price series, oldest first. Persisted across saves. */
  history: number[];

  /** World production last closed year. This is supply. */
  supply: number;
  /** World consumption last closed year. This is demand. */
  demand: number;
  /** supply − demand. Negative is a deficit. */
  balance: number;
  /** supply ÷ demand, or null when nothing consumes the good at all. */
  coverage: number | null;
  stock: number;
  /** Units moved between settlements. Internal to the world, so not net supply. */
  imported: number;
  exported: number;
  /** Years the world stock covers at current consumption, or null. */
  yearsOfStock: number | null;
  /** Settlements holding or moving this good. */
  activeCities: number;
}

export interface SectorView {
  id: string;
  label: string;
  /** Building categories that make up the sector. */
  categories: BuildingCategory[];
  goods: GoodId[];
  buildings: number;
  jobs: number;
  filled: number;
  /** Rated output at full staffing — the sector's ceiling. */
  capacity: number;
  /** Rated output at current staffing. */
  actual: number;
  /** actual ÷ capacity, or null for a sector with no rated output. */
  utilization: number | null;
  /** The worst input shortage behind the gap, when one is determinable. */
  constraint: { good: GoodId; label: string } | null;
}

export interface BottleneckView {
  /** The good whose production is blocked. */
  output: GoodId;
  cityId: string;
  cityName: string;
  kingdomId: string | null;
  kingdomName: string | null;
  /** What is missing. */
  constraint: GoodId;
  severity: 'warning' | 'critical';
  /** Units of the missing input in stock. */
  available: number;
  /** Units the recipe needs per cycle. */
  required: number;
  x: number;
  y: number;
}

/** A route with its economics resolved: prices at both ends, tariff, haul cost. */
export interface RouteView {
  route: TradeRoute;
  fromCity: City | null;
  toCity: City | null
  fromKingdom: Kingdom | null;
  toKingdom: Kingdom | null;
  kind: RouteKind;
  distance: number;
  /** Capacity factor the infrastructure allows, 0..1.3+. */
  capacityFactor: number;
  utilization: number;
  status: 'active' | 'capacity-limited' | 'war-closed' | 'embargoed' | 'damaged';
  /** Local price where the good leaves. */
  sourcePrice: number;
  /** Local price where it arrives. */
  destPrice: number;
  /** Same formula the trade decision charged, per unit. */
  transportCost: number;
  /** Treaty tariff if there is one, otherwise the buyer's own rate. */
  tariffRate: number;
  /** destPrice − sourcePrice − transport − tariff. Why the route exists. */
  marginPerUnit: number;
  /** Tiles of the route's surveyed path carrying rail, when it has a path. */
  railTiles: number;
}

export interface CityEconomy {
  id: string;
  name: string;
  kingdomId: string | null;
  kingdomName: string | null;
  kingdomColor: string | null;
  population: number;
  output: number;
  jobs: number;
  filled: number;
  /** filled ÷ jobs, or null with no jobs. */
  employment: number | null;
  /** (produced + imported) ÷ consumed for food, or null with no demand. */
  foodSecurity: number | null;
  imported: number;
  exported: number;
  /** The sector with the most rated output here. */
  topIndustry: string | null;
  problem: { label: string; severity: 'warning' | 'critical' } | null;
  x: number;
  y: number;
}

export interface RealmEconomy {
  id: string;
  name: string;
  color: string;
  gdp: number;
  treasury: number;
  imported: number;
  exported: number;
  /** exported − imported, in units moved. */
  tradeBalance: number;
  foodSecurity: number;
  industrialisation: number;
  /** The engine's own trade-dependency figure, 0..1. */
  tradeDependency: number;
  /** Inflation, only when the realm has minted a currency. */
  inflation: number | null;
  /** Strategic goods this realm mostly buys rather than makes. */
  dependencies: { good: GoodId; share: number; imported: number; used: number }[];
  cities: number;
}

/** Deposits still in the ground, by good. Counted from the map's own tiles. */
export interface ReserveView {
  good: GoodId;
  remaining: number;
  max: number;
  deposits: number;
  /** Deposits with nothing left. */
  exhausted: number;
  /** Who holds the remaining tonnage. Unclaimed ground is excluded. */
  byRealm: { kingdomId: string; name: string; color: string; remaining: number; share: number }[];
}

export interface EconomyMetrics {
  year: number;

  // ---- World indicators ----
  worldOutput: number;
  urbanPopulation: number;
  jobs: number;
  filled: number;
  workers: number;
  /** (workers − filled) ÷ workers, or null with no working-age population. */
  unemployment: number | null;
  tradeVolume: number;
  activeRoutes: number;
  suspendedRoutes: number;
  maritimeRoutes: number;
  overlandRoutes: number;
  ships: number;
  caravans: number;
  railTiles: number;
  railFreight: number;
  /** Mean price ÷ base price across goods the world actually trades, or null. */
  pricePressure: number | null;
  foodCoverage: number | null;
  industrialOutput: number;

  // ---- Goods ----
  goods: WorldGoodPosition[];
  shortages: WorldGoodPosition[];
  surpluses: WorldGoodPosition[];
  gainers: WorldGoodPosition[];
  decliners: WorldGoodPosition[];
  strategic: WorldGoodPosition[];

  // ---- Production ----
  sectors: SectorView[];
  bottlenecks: BottleneckView[];
  reserves: ReserveView[];

  // ---- Trade, cities, realms ----
  routes: RouteView[];
  cities: CityEconomy[];
  realms: RealmEconomy[];

  /**
   * Per-settlement flows, kept so "who makes the most steel" is a lookup rather
   * than a second pass over every ledger every time the question is asked.
   */
  cityFlows: Map<string, Map<GoodId, { produced: number; consumed: number }>>;
}

/** One settlement's production or consumption of one good. Zero when unrecorded. */
export function flowFor(
  m: EconomyMetrics,
  cityId: string,
  good: GoodId,
  which: 'produced' | 'consumed'
): number {
  return m.cityFlows.get(cityId)?.get(good)?.[which] ?? 0;
}

// ============================ SECTOR DEFINITIONS ============================

/**
 * The sectors of an economy, each defined by the buildings that constitute it.
 *
 * Named rather than derived, because a "sector" is a way of grouping industry
 * that only a person cares about — the simulation knows building categories and
 * recipes, not that a smithy and a foundry are both metallurgy. The goods list is
 * filtered against the registry so a rename in Goods.ts drops the entry.
 */
interface SectorDef { id: string; label: string; categories: BuildingCategory[]; goods: GoodId[] }

const SECTOR_DEFS: SectorDef[] = ([
  { id: 'agriculture', label: 'Agricultura', categories: ['food'], goods: ['food', 'spices', 'cotton', 'horses', 'furs'] },
  { id: 'mining', label: 'Mineração', categories: ['extraction'], goods: ['iron', 'coal', 'copper', 'tin', 'gold', 'gems', 'stone', 'clay', 'salt', 'saltpeter', 'uranium', 'oil'] },
  { id: 'metallurgy', label: 'Metalurgia', categories: ['craft'], goods: ['bronze', 'steel', 'tools'] },
  { id: 'textiles', label: 'Têxtil', categories: ['craft'], goods: ['cloth'] },
  { id: 'fuel', label: 'Combustível', categories: ['craft', 'power'], goods: ['fuel'] },
  { id: 'machinery', label: 'Maquinário', categories: ['craft'], goods: ['machinery'] },
  { id: 'military', label: 'Indústria militar', categories: ['craft'], goods: ['gunpowder'] }
] as SectorDef[]).map(def => ({ ...def, goods: def.goods.filter(g => Object.prototype.hasOwnProperty.call(GOODS, g)) }));

/**
 * Goods that come out of the ground, so only they can have a reserve.
 *
 * Assembled from the extraction tables the simulation already keeps, rather than
 * listed again here — a crafted good has no deposit, and reporting zero reserves
 * for steel would read as a shortage rather than as a category error.
 */
const DEPOSIT_GOODS: GoodId[] = [
  ...MINEABLE_GOODS, ...QUARRY_GOODS, ...FORESTRY_GOODS,
  ...FARM_GOODS, ...PASTURE_GOODS, ...WELL_GOODS
];

// ============================ COMPUTATION ============================

export function computeEconomyMetrics(ctx: GameContext): EconomyMetrics {
  const sim = ctx.sim;
  const cities = [...sim.cities.values()];
  const kingdoms = [...sim.kingdoms.values()];

  const goods = aggregateGoods(cities, ctx);
  const byGood = new Map(goods.map(p => [p.good, p]));

  // The per-city split, collected in the same sweep the totals came from.
  const cityFlows = new Map<string, Map<GoodId, { produced: number; consumed: number }>>();
  for (const city of cities) {
    const perGood = new Map<GoodId, { produced: number; consumed: number }>();
    for (const good of ALL_GOODS) {
      const flow = city.ledger.flow(good);
      if (flow.produced > 0 || flow.consumed > 0) {
        perGood.set(good, { produced: flow.produced, consumed: flow.consumed });
      }
    }
    cityFlows.set(city.id, perGood);
  }

  let worldOutput = 0, urbanPopulation = 0, jobs = 0, filled = 0;
  for (const city of cities) {
    worldOutput += city.economicOutput;
    urbanPopulation += city.population;
    jobs += city.jobCount();
    filled += city.filledJobs();
  }

  // Working-age citizens are the only honest denominator for unemployment.
  let workers = 0;
  for (const e of sim.entities) {
    if (!e.cityId || e.isChild || e.hp <= 0) continue;
    workers++;
  }

  const routes = collectRoutes(cities, ctx);
  const railTiles = ctx.sim.railways.railTiles(ctx.tileMap).length;

  // Price pressure across goods the world actually moves. A world where nothing
  // is traded has no price level to report, so it is null rather than 1.0.
  const traded = goods.filter(p => p.supply > 0 || p.demand > 0);
  const pricePressure = traded.length
    ? traded.reduce((sum, p) => sum + p.priceIndex, 0) / traded.length
    : null;

  const foodPosition = byGood.get('food') ?? null;

  return {
    year: sim.currentYear,

    worldOutput,
    urbanPopulation,
    jobs,
    filled,
    workers,
    unemployment: workers > 0 ? Math.max(0, Math.min(1, (workers - filled) / workers)) : null,
    tradeVolume: sim.trade.yearlyVolume,
    activeRoutes: routes.filter(r => r.route.active).length,
    suspendedRoutes: routes.filter(r => !r.route.active).length,
    maritimeRoutes: routes.filter(r => r.kind === 'maritime').length,
    overlandRoutes: routes.filter(r => r.kind === 'overland').length,
    ships: sim.naval.activeShips.size,
    caravans: sim.caravans.activeCaravans.size,
    railTiles,
    railFreight: sim.railways.yearlyFreight,
    pricePressure,
    foodCoverage: foodPosition?.coverage ?? null,
    industrialOutput: goods
      .filter(p => GOODS[p.good].kind === 'crafted')
      .reduce((sum, p) => sum + p.supply, 0),

    goods,
    shortages: goods
      .filter(p => p.demand > 0 && p.coverage !== null && p.coverage < 0.95)
      .sort((a, b) => (a.coverage ?? 1) - (b.coverage ?? 1)),
    surpluses: goods
      .filter(p => p.supply > 0 && p.coverage !== null && p.coverage > 1.15)
      .sort((a, b) => (b.coverage ?? 1) - (a.coverage ?? 1)),
    gainers: goods
      .filter(p => p.priceChange > 0.02)
      .sort((a, b) => b.priceChange - a.priceChange)
      .slice(0, 5),
    decliners: goods
      .filter(p => p.priceChange < -0.02)
      .sort((a, b) => a.priceChange - b.priceChange)
      .slice(0, 5),
    strategic: goods.filter(p => p.strategic),

    sectors: computeSectors(cities),
    bottlenecks: computeBottlenecks(cities, ctx),
    reserves: computeReserves(ctx),

    routes,
    cities: cities.map(city => summariseCity(city, ctx)).sort((a, b) => b.output - a.output),
    realms: kingdoms.map(k => summariseRealm(k, ctx)).sort((a, b) => b.gdp - a.gdp),

    cityFlows
  };
}

// ---------------- Goods ----------------

/**
 * Every good, summed across the world.
 *
 * Supply and demand are production and consumption from the closed-year ledgers.
 * Imports and exports are also summed, but they are *internal transfers* — a unit
 * exported from one settlement is imported by another, so they never enter the
 * balance. That distinction is why a world can be in deficit while every route
 * runs at capacity.
 */
function aggregateGoods(cities: City[], ctx: GameContext): WorldGoodPosition[] {
  const market = ctx.sim.market;
  const out: WorldGoodPosition[] = [];

  for (const good of ALL_GOODS) {
    let supply = 0, demand = 0, imported = 0, exported = 0, stock = 0, activeCities = 0;
    for (const city of cities) {
      const flow: GoodFlow = city.ledger.flow(good);
      const held = city.stock.get(good);
      supply += flow.produced;
      demand += flow.consumed;
      imported += flow.imported;
      exported += flow.exported;
      stock += held;
      if (held > 0.01 || flow.produced > 0 || flow.consumed > 0 || flow.imported > 0 || flow.exported > 0) {
        activeCities++;
      }
    }

    const def = GOODS[good];
    const history = market.priceHistory(good);
    const price = market.price(good);
    const previous = history.length > 1 ? history[history.length - 2] : price;

    out.push({
      good,
      name: def.name,
      tier: def.tier,
      kind: def.kind,
      strategic: Boolean(def.strategic) || def.tier === 'strategic',
      price,
      basePrice: def.basePrice,
      priceChange: previous > 0 ? (price - previous) / previous : 0,
      priceIndex: def.basePrice > 0 ? price / def.basePrice : 1,
      history,
      supply,
      demand,
      balance: supply - demand,
      // A good nothing consumes has no coverage. Reporting 2.0 would put grain
      // and unwanted gemstones in the same "surplus" bucket.
      coverage: demand > 0 ? supply / demand : null,
      stock,
      imported,
      exported,
      yearsOfStock: demand > 0 ? stock / demand : null,
      activeCities
    });
  }

  return out.sort((a, b) => b.price * b.stock - a.price * a.stock);
}

/** Filters a goods list by the categories the UI offers. */
export function filterGoods(goods: WorldGoodPosition[], category: GoodCategory): WorldGoodPosition[] {
  switch (category) {
    case 'raw': return goods.filter(p => p.kind === 'raw');
    case 'crafted': return goods.filter(p => p.kind === 'crafted');
    case 'strategic': return goods.filter(p => p.strategic);
    case 'food': return goods.filter(p => FOOD_GOODS.includes(p.good));
    case 'industrial': return goods.filter(p => INDUSTRIAL_GOODS.includes(p.good));
    default: return goods;
  }
}

// ---------------- Sectors ----------------

/**
 * Capacity against actual output, per sector.
 *
 * Capacity is the rated output at full staffing; actual is the rated output at
 * the staffing the buildings really have. Both are *ratings*, not effective
 * production — the ledger records production per settlement, never per building —
 * and the interface says so wherever it shows them.
 */
function computeSectors(cities: City[]): SectorView[] {
  const out: SectorView[] = [];

  for (const def of SECTOR_DEFS) {
    let buildings = 0, jobs = 0, filled = 0, capacity = 0, actual = 0;
    // Missing inputs across the sector, weighted by how short each one is.
    const missing = new Map<GoodId, number>();

    for (const city of cities) {
      for (const building of city.buildings.values()) {
        const bdef = BUILDINGS[building.type];
        if (!bdef || !def.categories.includes(bdef.category)) continue;

        // A building belongs to the sector only if it makes one of its goods.
        const produces = Object.keys(bdef.produces ?? {}) as GoodId[];
        const relevant = produces.filter(g => def.goods.includes(g));
        if (!relevant.length) continue;

        buildings++;
        const slots = (bdef.jobs ?? 0) * building.level;
        const staffed = Math.min(slots, building.assignedWorkerIds.size);
        jobs += slots;
        filled += staffed;

        // The engine's own output curve, so a rating here scales exactly the way
        // production does. Staffing is derived from the workers actually assigned
        // rather than read off `building.staffing`, which the engine only refreshes
        // on its yearly pass — a world that has not ticked yet still carries the
        // constructor's 1.0 and would report an empty workshop at full output.
        const levelScale = 1 + (building.level - 1) * 0.55;
        const staffingRatio = slots > 0 ? staffed / slots : 1;

        for (const good of relevant) {
          const base = (bdef.produces as Record<string, number>)[good] ?? 0;
          capacity += base * levelScale;
          actual += base * levelScale * staffingRatio;

          // The recipe's inputs are what can stop it. Only counted where the
          // shortfall is real: something in the recipe with nothing in store.
          const recipe = GOODS[good].recipe;
          if (!recipe) continue;
          for (const [input, qty] of Object.entries(recipe)) {
            const need = (qty as number) * building.level;
            const have = city.stock.get(input as GoodId);
            if (have >= need) continue;
            missing.set(input as GoodId, (missing.get(input as GoodId) ?? 0) + (need - have));
          }
        }
      }
    }

    if (buildings === 0) continue;

    const worst = [...missing.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({
      id: def.id,
      label: def.label,
      categories: def.categories,
      goods: def.goods,
      buildings,
      jobs,
      filled,
      capacity,
      actual,
      // Staffing is what utilisation means for a sector with jobs; output ratio is
      // the fallback only where there are no posts to fill at all.
      utilization: jobs > 0
        ? Math.min(1, filled / jobs)
        : capacity > 0 ? Math.min(1, actual / capacity) : null,
      constraint: worst ? { good: worst[0], label: GOODS[worst[0]]?.name ?? worst[0] } : null
    });
  }

  return out.sort((a, b) => b.capacity - a.capacity);
}

// ---------------- Bottlenecks ----------------

/**
 * Production that is blocked, and by what.
 *
 * Only reported where the recipe and the stockpile together prove it: a building
 * that makes X, a recipe that needs Y, and less Y in the city than one cycle
 * requires. Everything else is a guess.
 */
function computeBottlenecks(cities: City[], ctx: GameContext): BottleneckView[] {
  const out: BottleneckView[] = [];

  for (const city of cities) {
    const kingdom = city.kingdomId ? ctx.sim.kingdoms.get(city.kingdomId) ?? null : null;
    // One entry per (output, constraint) pair per city — twenty smithies short of
    // the same coal is one problem, not twenty.
    const seen = new Set<string>();

    for (const building of city.buildings.values()) {
      const bdef = BUILDINGS[building.type];
      if (!bdef?.produces) continue;

      for (const good of Object.keys(bdef.produces) as GoodId[]) {
        const recipe = GOODS[good]?.recipe;
        if (!recipe) continue;

        for (const [input, qty] of Object.entries(recipe)) {
          const required = (qty as number) * building.level;
          const available = city.stock.get(input as GoodId);
          if (available >= required) continue;

          const key = `${good}:${input}`;
          if (seen.has(key)) continue;
          seen.add(key);

          out.push({
            output: good,
            cityId: city.id,
            cityName: city.name,
            kingdomId: kingdom?.id ?? null,
            kingdomName: kingdom?.name ?? null,
            constraint: input as GoodId,
            // Nothing at all in store stops the line; a partial stock slows it.
            severity: available <= 0.01 ? 'critical' : 'warning',
            available,
            required,
            x: building.x,
            y: building.y
          });
        }
      }
    }
  }

  return out.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return (a.available / Math.max(0.01, a.required)) - (b.available / Math.max(0.01, b.required));
  });
}

// ---------------- Reserves ----------------

/**
 * What is still in the ground.
 *
 * One pass over the map, which is why this whole module is cached. Only goods
 * that are actually extracted from tiles appear — a crafted good has no deposit,
 * and reporting zero reserves for steel would read as a shortage rather than as a
 * category error.
 */
function computeReserves(ctx: GameContext): ReserveView[] {
  const totals = new Map<GoodId, { remaining: number; max: number; deposits: number; exhausted: number }>();
  const byRealm = new Map<GoodId, Map<string, number>>();
  const map = ctx.tileMap;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.getTile(x, y);
      if (!tile?.resourceType || tile.resourceMax <= 0) continue;
      const good = tile.resourceType as GoodId;
      if (!DEPOSIT_GOODS.includes(good)) continue;

      const entry = totals.get(good) ?? { remaining: 0, max: 0, deposits: 0, exhausted: 0 };
      entry.remaining += Math.max(0, tile.resourceAmount);
      entry.max += tile.resourceMax;
      entry.deposits++;
      if (tile.resourceAmount <= 0) entry.exhausted++;
      totals.set(good, entry);

      if (tile.kingdomId && tile.resourceAmount > 0) {
        const perRealm = byRealm.get(good) ?? new Map<string, number>();
        perRealm.set(tile.kingdomId, (perRealm.get(tile.kingdomId) ?? 0) + tile.resourceAmount);
        byRealm.set(good, perRealm);
      }
    }
  }

  const out: ReserveView[] = [];
  for (const [good, entry] of totals) {
    const perRealm = byRealm.get(good);
    const claimed = perRealm ? [...perRealm.values()].reduce((a, b) => a + b, 0) : 0;
    out.push({
      good,
      remaining: entry.remaining,
      max: entry.max,
      deposits: entry.deposits,
      exhausted: entry.exhausted,
      byRealm: perRealm && claimed > 0
        ? [...perRealm.entries()]
            .map(([kingdomId, remaining]) => {
              const k = ctx.sim.kingdoms.get(kingdomId);
              return {
                kingdomId,
                name: k?.name ?? 'reino desconhecido',
                color: k?.color ?? 'var(--ae-accent)',
                remaining,
                share: remaining / claimed
              };
            })
            .sort((a, b) => b.remaining - a.remaining)
        : []
    });
  }

  return out.sort((a, b) => b.remaining - a.remaining);
}

// ---------------- Routes ----------------

/**
 * Every route with its economics resolved.
 *
 * The price gap is the reason the route exists, so it is reported in full: what
 * the good costs where it leaves, what it costs where it lands, what the haul
 * takes, and what the border takes. Transport cost calls the simulation's own
 * `transportCostPerUnit`, so the figure shown is the figure charged.
 */
function collectRoutes(cities: City[], ctx: GameContext): RouteView[] {
  const sim = ctx.sim;
  const out: RouteView[] = [];

  for (const route of sim.trade.routes.values()) {
    const fromCity = sim.cities.get(route.fromCityId) ?? null;
    const toCity = sim.cities.get(route.toCityId) ?? null;
    const fromKingdom = sim.kingdoms.get(route.fromKingdomId) ?? null;
    const toKingdom = sim.kingdoms.get(route.toKingdomId) ?? null;

    const distance = fromCity && toCity ? Math.hypot(fromCity.x - toCity.x, fromCity.y - toCity.y) : 0;
    const worldPrice = sim.market.price(route.good);
    const avgRoad = route.kind === 'maritime' ? 1.5 : avgEffectiveRoadLevel(route.path, ctx.tileMap);
    const capacityFactor = route.kind === 'maritime'
      ? (fromCity && toCity ? portCapacityFactor(fromCity, toCity) : 0)
      : roadCapacityFactor(route.path, ctx.tileMap);

    const sourcePrice = fromKingdom ? fromKingdom.economy.market.price(route.good, worldPrice) : worldPrice;
    const destPrice = toKingdom ? toKingdom.economy.market.price(route.good, worldPrice) : worldPrice;
    const treaty = sim.trade.getAgreement(route.fromKingdomId, route.toKingdomId)?.tariff;
    const tariffRate = treaty ?? toKingdom?.tariffRate() ?? 0;
    const transportCost = transportCostPerUnit(route.kind, distance, worldPrice, avgRoad);

    // Rail on the surveyed path, so the freight advantage can be pointed at.
    let railTiles = 0;
    for (const step of route.path ?? []) {
      const tile = ctx.tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
      if (tile && tile.railLevel > 0) railTiles++;
    }

    const utilization = route.maxVolume > 0 ? Math.min(1, route.volume / route.maxVolume) : 0;
    const embargoed = sim.trade.isEmbargoed(route.fromKingdomId, route.toKingdomId) ||
      sim.trade.isEmbargoed(route.toKingdomId, route.fromKingdomId);

    out.push({
      route,
      fromCity,
      toCity,
      fromKingdom,
      toKingdom,
      kind: route.kind,
      distance,
      capacityFactor,
      utilization,
      // Only states the simulation can prove. An inactive route is closed either
      // by war or by embargo, and `isEmbargoed` tells the two apart.
      status: !route.active
        ? (embargoed ? 'embargoed' : 'war-closed')
        : capacityFactor < 0.75 ? 'damaged'
        : utilization >= 0.99 ? 'capacity-limited'
        : 'active',
      sourcePrice,
      destPrice,
      transportCost,
      tariffRate,
      marginPerUnit: destPrice - sourcePrice - transportCost - destPrice * tariffRate,
      railTiles
    });
  }

  return out.sort((a, b) => b.route.totalValue - a.route.totalValue);
}

// ---------------- Cities ----------------

function summariseCity(city: City, ctx: GameContext): CityEconomy {
  const kingdom = city.kingdomId ? ctx.sim.kingdoms.get(city.kingdomId) ?? null : null;
  const jobs = city.jobCount();
  const filled = city.filledJobs();

  let imported = 0, exported = 0;
  for (const good of ALL_GOODS) {
    const flow = city.ledger.flow(good);
    imported += flow.imported;
    exported += flow.exported;
  }

  const food = city.ledger.flow('food');
  const besieger = city.besiegerId ? ctx.sim.kingdoms.get(city.besiegerId) : null;

  // The sector with the most rated output here, from the same definitions the
  // production tab uses.
  let topIndustry: string | null = null;
  let best = 0;
  for (const def of SECTOR_DEFS) {
    let rated = 0;
    for (const building of city.buildings.values()) {
      const bdef = BUILDINGS[building.type];
      if (!bdef?.produces || !def.categories.includes(bdef.category)) continue;
      const slots = (bdef.jobs ?? 0) * building.level;
      const staffingRatio = slots > 0 ? Math.min(slots, building.assignedWorkerIds.size) / slots : 1;
      for (const [good, base] of Object.entries(bdef.produces)) {
        if (!def.goods.includes(good as GoodId)) continue;
        rated += (base as number) * (1 + (building.level - 1) * 0.55) * staffingRatio;
      }
    }
    if (rated > best) { best = rated; topIndustry = def.label; }
  }

  return {
    id: city.id,
    name: city.name,
    kingdomId: kingdom?.id ?? null,
    kingdomName: kingdom?.name ?? null,
    kingdomColor: kingdom?.color ?? null,
    population: city.population,
    output: city.economicOutput,
    jobs,
    filled,
    employment: jobs > 0 ? Math.min(1, filled / jobs) : null,
    foodSecurity: food.consumed > 0
      ? Math.min(2, (food.produced + food.imported) / food.consumed)
      : null,
    imported,
    exported,
    topIndustry,
    problem: besieger
      ? { label: `Sitiada por ${besieger.name}`, severity: 'critical' }
      : city.famineYears > 0
        ? { label: `Fome há ${city.famineYears} ano(s)`, severity: 'critical' }
        : food.consumed > 0 && city.stock.get('food') <= 0
          ? { label: 'Sem comida em estoque', severity: 'critical' }
          : jobs > 0 && filled === 0
            ? { label: 'Nenhum posto ocupado', severity: 'warning' }
            : null,
    x: city.x,
    y: city.y
  };
}

// ---------------- Realms ----------------

function summariseRealm(kingdom: Kingdom, ctx: GameContext): RealmEconomy {
  const cities: City[] = [];
  for (const id of kingdom.cityIds) {
    const city = ctx.sim.cities.get(id);
    if (city) cities.push(city);
  }

  let imported = 0, exported = 0;
  const dependencies: RealmEconomy['dependencies'] = [];

  for (const good of ALL_GOODS) {
    let gotIn = 0, used = 0;
    for (const city of cities) {
      const flow = city.ledger.flow(good);
      gotIn += flow.imported;
      used += flow.consumed + flow.exported;
      imported += flow.imported;
      exported += flow.exported;
    }
    // Dependency computed on the realm's combined books: one city importing what
    // another exports is internally balanced, not half dependent.
    if (used > 0.5 && gotIn > 0) {
      const share = Math.min(1, gotIn / used);
      if (share >= 0.2) dependencies.push({ good, share, imported: gotIn, used });
    }
  }

  return {
    id: kingdom.id,
    name: kingdom.name,
    color: kingdom.color,
    gdp: kingdom.economy.gdp,
    treasury: kingdom.economy.treasury,
    imported,
    exported,
    tradeBalance: exported - imported,
    foodSecurity: kingdom.foodSecurity,
    industrialisation: kingdom.economy.industrialisation,
    tradeDependency: kingdom.tradeDependency,
    // Only a realm that has minted coin has an inflation rate to report.
    inflation: kingdom.economy.currency?.inflation ?? null,
    dependencies: dependencies.sort((a, b) => b.share - a.share).slice(0, 6),
    cities: cities.length
  };
}

// ---------------- Production chain ----------------

export interface ChainNode {
  good: GoodId;
  name: string;
  /** 0 = raw, higher = further downstream. From `productionDepth`. */
  depth: number;
  /** Direct inputs, with the quantity the recipe consumes. */
  inputs: { good: GoodId; qty: number }[];
  /** Goods whose recipe consumes this one. */
  feeds: GoodId[];
}

/**
 * The recipe graph around one good, upstream and downstream.
 *
 * Read from `GOODS[x].recipe` — the same table the simulation crafts from — so
 * the chain shown is the chain that exists. `rawInputsOf` already walks it
 * transitively and guards against cycles.
 */
export function chainAround(good: GoodId): { upstream: ChainNode[]; node: ChainNode; downstream: ChainNode[] } {
  const node = chainNode(good);
  const upstream = node.inputs.map(i => chainNode(i.good));
  const downstream = node.feeds.map(g => chainNode(g));
  return { upstream, node, downstream };
}

export function chainNode(good: GoodId): ChainNode {
  const def = GOODS[good];
  const recipe = def?.recipe ?? {};
  return {
    good,
    name: def?.name ?? good,
    depth: productionDepthOf(good),
    inputs: (Object.entries(recipe) as [GoodId, number][]).map(([g, qty]) => ({ good: g, qty })),
    feeds: ALL_GOODS.filter(g => {
      const r = GOODS[g]?.recipe;
      return Boolean(r) && good in r!;
    })
  };
}

/**
 * How many crafting steps deep a good sits.
 *
 * Raw goods are 0. Kept local rather than using `productionDepth` from Goods.ts
 * because that one counts the deepest *raw input path*; this one is the display
 * tier the production network draws with.
 */
function productionDepthOf(good: GoodId, seen: Set<GoodId> = new Set()): number {
  const recipe = GOODS[good]?.recipe;
  if (!recipe || seen.has(good)) return 0;
  seen.add(good);
  let deepest = 0;
  for (const input of Object.keys(recipe) as GoodId[]) {
    deepest = Math.max(deepest, productionDepthOf(input, seen));
  }
  return deepest + 1;
}

// ============================ CACHE ============================

/** Longest a world snapshot is trusted. The most expensive read in the UI. */
const MAX_AGE_MS = 2500;

/**
 * Holds the world economy and decides when to recompute.
 *
 * A year boundary forces a rebuild: every ledger rolls over and the market
 * settles at once, so every figure here changes together. Otherwise the cadence
 * is deliberately slow — this walks every settlement, every route and every tile
 * on the map, and it must never run per frame.
 */
export class EconomyMetricsCache {
  private metrics: EconomyMetrics | null = null;
  private builtAt = -Infinity;
  private builtYear = -1;

  public get(ctx: GameContext, now: number): EconomyMetrics {
    const yearChanged = ctx.sim.currentYear !== this.builtYear;
    const stale = now - this.builtAt >= MAX_AGE_MS;
    if (this.metrics && !yearChanged && !stale) return this.metrics;

    this.metrics = computeEconomyMetrics(ctx);
    this.builtAt = now;
    this.builtYear = ctx.sim.currentYear;
    return this.metrics;
  }

  public invalidate(): void {
    this.builtAt = -Infinity;
  }
}
