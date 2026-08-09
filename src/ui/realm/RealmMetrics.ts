/**
 * Everything the realm dossier knows, computed once.
 *
 * A realm is the widest aggregation in the game — it spans every settlement, every
 * citizen, every route and every treaty — so this is also the most expensive
 * thing the interface computes. It runs behind a cache on a slow cadence, never
 * per frame. See `RealmMetricsCache`.
 *
 * The same rule as UI-3 governs it: **every figure traces to something a system
 * recorded.** `Kingdom` already keeps most of what the dossier needs as live
 * fields — legitimacy, foodSecurity, tradeDependency, warWeariness — and
 * `KingdomEconomy.ledger` keeps a year-by-year book of tax, trade and upkeep. What
 * remains is genuinely aggregation: counting soldiers, summing a strategic good's
 * flows across a realm's cities, grouping routes by partner. Where a figure
 * cannot be computed it is `null` and its row is omitted.
 *
 * Deliberately shaped for reuse. Item 36 of the brief asks for realm-to-realm
 * comparison later, so `RealmMetrics` is a plain value object with no DOM and no
 * simulation references — two of them can be diffed without any of this changing.
 */
import { BUILDINGS, type BuildingCategory } from '../../civ/Building';
import { GOODS, ALL_GOODS, type GoodId } from '../../civ/Goods';
import { TECHNOLOGIES, TECH_ERAS, demandCreatedBy, techCost, type TechEra, type TechCapability } from '../../civ/TechTree';
import { activeLawDefinitions, type LawDefinition } from '../../civ/Laws';
import { SOCIAL_FACTIONS, type FactionState, type SocialFactionId, type SocietyProfile } from '../../civ/Society';
import type { CulturalProfile } from '../../civ/Culture';
import type { GovernmentDefinition, EconomicSystem } from '../../civ/Government';
import type { GoodFlow } from '../../civ/Economy';
import type { City } from '../../civ/City';
import type { Kingdom } from '../../civ/Kingdom';
import type { WarRecord } from '../../civ/Diplomacy';
import type { TradeRoute } from '../../civ/Trade';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import type { Entity } from '../../entities/Entity';
import type { Profession } from '../../entities/Needs';
import type { GameContext } from '../core/GameContext';

// ============================ SHAPES ============================

/**
 * The goods a realm's survival and war-making actually turn on.
 *
 * Named explicitly rather than derived, because "strategic" is a judgement about
 * consequence, not a property of the good. Filtered against the registry so a
 * rename in Goods.ts drops the entry instead of producing an empty row.
 */
export const STRATEGIC_GOODS: GoodId[] = (
  ['iron', 'coal', 'oil', 'rubber', 'saltpeter', 'uranium', 'steel', 'fuel', 'gunpowder', 'machinery'] as GoodId[]
).filter(good => Object.prototype.hasOwnProperty.call(GOODS, good));

/** Goods a war effort consumes, for the military-economy panel. */
export const MILITARY_GOODS: GoodId[] = (
  ['steel', 'food', 'fuel', 'gunpowder', 'machinery'] as GoodId[]
).filter(good => Object.prototype.hasOwnProperty.call(GOODS, good));

export interface RealmGoodPosition {
  good: GoodId;
  /** Summed across every settlement in the realm. */
  flow: GoodFlow;
  stock: number;
  net: number;
  /** imported ÷ (consumed + exported) across the realm, 0..1. */
  importDependency: number;
  /** Who supplied the imports, by share of inbound volume. Empty when nothing
   *  was imported over a route this dossier can see. */
  suppliers: { kingdomId: string; name: string; share: number; volume: number }[];
}

/** What a settlement is *for*, derived from what it actually produces. */
export type EconomicRole =
  | 'capital'
  | 'industrial'
  | 'mining'
  | 'agricultural'
  | 'port'
  | 'trade-hub'
  | 'knowledge'
  | 'settlement';

export interface CitySummary {
  id: string;
  name: string;
  population: number;
  tier: string;
  prosperity: number;
  role: EconomicRole;
  /** The two or three goods it is rated to produce most of. */
  outputs: { good: GoodId; amount: number }[];
  /** The single worst thing about it, or null when nothing is wrong. */
  problem: { label: string; severity: 'warning' | 'critical' } | null;
  x: number;
  y: number;
}

export interface ArmyComposition {
  /** Every citizen of this realm bearing a military profession. */
  soldiers: number;
  archers: number;
  total: number;
  /** Armed with a real weapon from `Equipment`. */
  armed: number;
  armoured: number;
  /** Weapon names in service, commonest first. */
  equipment: { name: string; count: number }[];
}

export interface WarSummary {
  war: WarRecord;
  enemyId: string;
  enemyName: string;
  /** True when this realm opened the war. */
  aggressor: boolean;
  years: number;
  /** Kills this realm inflicted / suffered. Real figures from the war record. */
  killsInflicted: number;
  killsSuffered: number;
}

export interface Relationship {
  kingdomId: string;
  name: string;
  color: string;
  /** −100..100 from the diplomacy manager. */
  relation: number;
  status: 'neutral' | 'friendly' | 'hostile' | 'war' | 'alliance';
  /** Value moved between the two realms over routes this dossier can see. */
  tradeVolume: number;
  hasAgreement: boolean;
  /** Truce end year, when one is in force. */
  truceUntil: number | null;
  embargoed: boolean;
  isVassal: boolean;
  isOverlord: boolean;
}

export interface Infrastructure {
  /** Best road level anywhere in the realm. */
  roadLevel: number;
  railTiles: number;
  /** Segments at or beyond the damage threshold that severs a line. */
  railDamagedTiles: number;
  /** Settlements joined by an unbroken shared rail component. */
  railConnectedCities: number;
  /** Freight the network moved last year, world-wide — the engine tracks it
   *  globally rather than per realm, and it is labelled as such. */
  worldFreight: number;
  ports: number;
  harbours: number;
  maritimeRoutes: number;
  overlandRoutes: number;
  routesActive: number;
  routesSuspended: number;
  /** Bottlenecks the network's own state proves, each navigable. */
  bottlenecks: InfraBottleneck[];
}

/** Something the logistics network cannot currently do, and where to look. */
export interface InfraBottleneck {
  kind: 'rail-damaged' | 'route-suspended' | 'no-road' | 'unconnected';
  subject: string;
  cause: string;
  severity: 'warning' | 'critical';
  cityId?: string;
  kingdomId?: string;
  good?: GoodId;
  at?: { x: number; y: number };
}

/**
 * Work across the realm, counted exactly as the society tick counts it.
 *
 * `unemployment` and `labourShortage` use the same arithmetic as
 * `CivilizationEngine.economicPressures`, on the same inputs, so the dossier and
 * the factions are reading one number rather than two that drift apart.
 */
export interface RealmEmployment {
  /** Working-age humanoids of this realm. */
  workers: number;
  jobs: number;
  filled: number;
  unemployed: number;
  vacancies: number;
  /** (workers − filled) ÷ workers, or null with no working-age population. */
  unemployment: number | null;
  /** (jobs − filled) ÷ jobs, or null where the realm has no jobs at all. */
  labourShortage: number | null;
}

/** One productive sector of the realm, from the buildings that make it up. */
export interface IndustrySector {
  category: BuildingCategory;
  buildings: number;
  jobs: number;
  filled: number;
  /** Filled ÷ jobs, or null for a sector with no jobs. */
  utilization: number | null;
  /** Rated capacity — base output × level × staffing, summed. Not effective
   *  production, which the ledger only keeps per settlement. */
  ratedOutput: { good: GoodId; amount: number }[];
}

export interface TechnologyState {
  era: TechEra;
  eraName: string;
  known: number;
  current: { id: string; name: string; progress: number; cost: number } | null;
  output: number;
  /** 0..1 — how much of what it knows the realm can actually operate. */
  capacity: number;
  /** Technologies known but not fully usable, worst first. */
  idleCapabilities: TechCapability[];
  /** The last few technologies completed, newest first. */
  recent: { id: string; name: string; era: TechEra; unlockedBuildings: string[]; demands: GoodId[] }[];
}

export interface RealmMetrics {
  kingdomId: string;
  year: number;

  // ---- Identity ----
  age: number;
  capital: City | null;
  ruler: Entity | null;
  rulerYears: number | null;
  heir: Entity | null;

  // ---- Scale ----
  population: number;
  cities: CitySummary[];
  territory: number;

  // ---- Economy ----
  gdp: number;
  gdpPerCapita: number;
  treasury: number;
  industrialisation: number;
  stability: number;
  inequality: number;
  /** Last closed year's book, or null before any year has closed. */
  lastLedger: { year: number; taxIncome: number; tradeIncome: number; upkeep: number; net: number } | null;
  tariffRevenue: number;
  exportVolume: number;
  importVolume: number;

  // ---- Realm-wide goods ----
  goods: RealmGoodPosition[];
  strategic: RealmGoodPosition[];
  military: RealmGoodPosition[];
  topExports: RealmGoodPosition[];
  topImports: RealmGoodPosition[];
  dependencies: RealmGoodPosition[];

  // ---- Society & politics ----
  /** The realm's own society state — cohesion, risks, pressures. */
  society: SocietyProfile;
  factions: FactionState[];
  culture: CulturalProfile;
  laws: LawDefinition[];
  government: GovernmentDefinition;
  economicSystem: EconomicSystem;
  taxRate: number;
  dynasty: string;
  governmentSince: number;
  /** 0..1 — public belief the current order has a right to rule. */
  legitimacy: number;
  /** 0..1 — how much of the realm the crown can actually govern. */
  administrativeReach: number;
  cultureLevel: number;

  // ---- Live pressures the engine keeps on the realm itself ----
  /** 0..1 — food stock per head against the four-year reserve the engine treats
   *  as full. A *stock* measure, not the city dossier's flow ratio. */
  foodSecurity: number;
  /** 0..1 — value moved over active routes against GDP. */
  tradeDependency: number;
  /** 0..1 — the worst power-and-proximity threat among known realms. */
  externalThreat: number;
  /** 0..1, normalised here from the engine's 0..100 scale. */
  warWeariness: number;

  // ---- Diplomacy ----
  relations: Relationship[];
  tradePartners: { kingdomId: string; name: string; color: string; volume: number; share: number }[];
  wars: WarSummary[];

  // ---- Military ----
  militaryPower: number;
  army: ArmyComposition;

  infrastructure: Infrastructure;
  technology: TechnologyState;

  // ---- Work and industry ----
  employment: RealmEmployment;
  industries: IndustrySector[];

  /** Head count per profession across the realm. */
  professions: { profession: Profession; count: number }[];
}

// ============================ COMPUTATION ============================

export function computeRealmMetrics(kingdom: Kingdom, ctx: GameContext): RealmMetrics {
  const sim = ctx.sim;

  // The realm's own settlements, resolved once. `cityIds` can name a city that
  // has since been razed, so misses are dropped rather than trusted.
  const cities: City[] = [];
  for (const cityId of kingdom.cityIds) {
    const city = sim.cities.get(cityId);
    if (city) cities.push(city);
  }

  const routes = collectRoutes(kingdom, cities, ctx);
  const people = countPeople(kingdom, sim.entities);

  let population = 0;
  let territory = 0;
  for (const city of cities) {
    population += city.population;
    territory += city.territory.size;
  }

  const capital = sim.cities.get(kingdom.capitalCityId) ?? null;
  const ruler = kingdom.rulerId ? sim.entities.find(e => e.id === kingdom.rulerId) ?? null : null;
  const goods = aggregateGoods(kingdom, cities, routes, ctx);

  return {
    kingdomId: kingdom.id,
    year: sim.currentYear,

    age: Math.max(0, sim.currentYear - kingdom.foundingYear),
    capital,
    ruler,
    // Years in power is only calculable when the government's start year is the
    // ruler's accession, which is what `governmentSince` records for a monarchy.
    // Anything else would be a guess, so it is null.
    rulerYears: ruler ? Math.max(0, sim.currentYear - kingdom.governmentSince) : null,
    heir: ruler ? findHeir(ruler, sim.entities) : null,

    population,
    cities: cities.map(city => summariseCity(city, kingdom, ctx)).sort((a, b) => b.population - a.population),
    territory,

    gdp: kingdom.economy.gdp,
    gdpPerCapita: kingdom.economy.gdpPerCapita,
    treasury: kingdom.economy.treasury,
    industrialisation: kingdom.economy.industrialisation,
    stability: kingdom.economy.stability,
    inequality: kingdom.economy.inequality,
    lastLedger: lastClosedLedger(kingdom),
    tariffRevenue: kingdom.tariffRevenue,
    exportVolume: kingdom.exportVolume,
    importVolume: kingdom.importVolume,

    ...goods,

    society: kingdom.society,
    factions: orderedFactions(kingdom),
    culture: kingdom.culture,
    laws: activeLawDefinitions(kingdom.laws),
    government: kingdom.governmentInfo,
    economicSystem: kingdom.governmentInfo.economy,
    taxRate: kingdom.governmentInfo.taxRate,
    dynasty: kingdom.dynasty,
    governmentSince: kingdom.governmentSince,
    legitimacy: kingdom.legitimacy,
    administrativeReach: kingdom.administrativeReach,
    cultureLevel: kingdom.cultureLevel,

    foodSecurity: kingdom.foodSecurity,
    tradeDependency: kingdom.tradeDependency,
    externalThreat: kingdom.externalThreat,
    // The only one of these the engine keeps on a 0..100 scale. Normalised here so
    // everything downstream compares like with like — a mixed convention is how a
    // 60% weariness ends up drawn as a full bar.
    warWeariness: Math.max(0, Math.min(1, kingdom.warWeariness / 100)),

    ...computeDiplomacy(kingdom, routes, ctx),

    militaryPower: kingdom.militaryPower,
    army: people.army,

    infrastructure: computeInfrastructure(kingdom, cities, routes, ctx),
    technology: computeTechnology(kingdom),

    employment: computeEmployment(cities, people.workingAge),
    industries: aggregateIndustries(cities),

    professions: people.professions
  };
}

// ---------------- Routes ----------------

interface RouteContext {
  /** Every route with one end inside this realm. */
  all: TradeRoute[];
  inbound: TradeRoute[];
  outbound: TradeRoute[];
  /** City ids belonging to this realm, for fast membership tests. */
  own: Set<string>;
}

function collectRoutes(kingdom: Kingdom, cities: City[], ctx: GameContext): RouteContext {
  const own = new Set(cities.map(c => c.id));
  const all: TradeRoute[] = [];
  const inbound: TradeRoute[] = [];
  const outbound: TradeRoute[] = [];

  for (const route of ctx.sim.trade.routes.values()) {
    const fromMine = own.has(route.fromCityId);
    const toMine = own.has(route.toCityId);
    // Internal routes belong to neither side of the trade balance.
    if (fromMine === toMine) {
      if (fromMine) all.push(route);
      continue;
    }
    all.push(route);
    if (toMine) inbound.push(route);
    else outbound.push(route);
  }

  return { all, inbound, outbound, own };
}

// ---------------- People ----------------

/**
 * One pass over the population.
 *
 * This is the expensive part — O(entities) — and the reason the whole module is
 * cached. Professions and army composition come out of the same loop rather than
 * two.
 */
function countPeople(kingdom: Kingdom, entities: Entity[]): {
  professions: { profession: Profession; count: number }[];
  army: ArmyComposition;
  workingAge: number;
} {
  const professions = new Map<Profession, number>();
  const weapons = new Map<string, number>();
  let soldiers = 0, archers = 0, armed = 0, armoured = 0, workingAge = 0;

  for (const entity of entities) {
    if (entity.kingdomId !== kingdom.id) continue;

    // The same predicate `CivilizationEngine.economicPressures` uses, so the
    // dossier's unemployment figure is the one the factions actually reacted to.
    if (entity.hp > 0 && SPECIES_DEFINITIONS[entity.species].isHumanoid && !entity.isChild) workingAge++;

    if (entity.profession !== 'none') {
      professions.set(entity.profession, (professions.get(entity.profession) ?? 0) + 1);
    }
    if (entity.profession === 'soldier') soldiers++;
    else if (entity.profession === 'archer') archers++;
    else continue;

    const weapon = entity.equipment.weapon;
    if (weapon?.name) {
      armed++;
      weapons.set(weapon.name, (weapons.get(weapon.name) ?? 0) + 1);
    }
    if (entity.equipment.armor) armoured++;
  }

  return {
    professions: [...professions.entries()]
      .map(([profession, count]) => ({ profession, count }))
      .sort((a, b) => b.count - a.count),
    army: {
      soldiers, archers, total: soldiers + archers, armed, armoured,
      equipment: [...weapons.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    },
    workingAge
  };
}

// ---------------- Work ----------------

function computeEmployment(cities: City[], workingAge: number): RealmEmployment {
  let jobs = 0;
  let filled = 0;
  for (const city of cities) {
    jobs += city.jobCount();
    filled += city.filledJobs();
  }

  return {
    workers: workingAge,
    jobs,
    filled,
    // Two opposite problems, counted separately. One rate cannot describe both a
    // realm with idle people and a realm with idle workshops.
    unemployed: Math.max(0, workingAge - filled),
    vacancies: Math.max(0, jobs - filled),
    unemployment: workingAge > 0 ? Math.max(0, Math.min(1, (workingAge - filled) / workingAge)) : null,
    labourShortage: jobs > 0 ? Math.max(0, Math.min(1, (jobs - filled) / jobs)) : null
  };
}

/**
 * The realm's productive sectors, built from the buildings that exist.
 *
 * There is no "industry score" here and no weighting invented to produce one —
 * item 14 of the brief rules that out. A sector is a count of buildings, the jobs
 * they open, the jobs that are filled, and the goods they are rated to make.
 */
function aggregateIndustries(cities: City[]): IndustrySector[] {
  const sectors = new Map<BuildingCategory, {
    buildings: number; jobs: number; filled: number; output: Map<GoodId, number>;
  }>();

  for (const city of cities) {
    for (const building of city.buildings.values()) {
      const def = BUILDINGS[building.type];
      if (!def) continue;

      const entry = sectors.get(def.category)
        ?? { buildings: 0, jobs: 0, filled: 0, output: new Map<GoodId, number>() };
      entry.buildings++;
      entry.jobs += (def.jobs ?? 0) * building.level;
      entry.filled += building.assignedWorkerIds.size;

      const scale = building.level * building.staffing;
      for (const [good, base] of Object.entries(def.produces ?? {})) {
        const amount = (base as number) * scale;
        if (amount > 0) entry.output.set(good as GoodId, (entry.output.get(good as GoodId) ?? 0) + amount);
      }
      sectors.set(def.category, entry);
    }
  }

  return [...sectors.entries()]
    .map(([category, entry]) => ({
      category,
      buildings: entry.buildings,
      jobs: entry.jobs,
      filled: entry.filled,
      utilization: entry.jobs > 0 ? Math.min(1, entry.filled / entry.jobs) : null,
      ratedOutput: [...entry.output.entries()]
        .map(([good, amount]) => ({ good, amount }))
        .sort((a, b) => b.amount - a.amount)
    }))
    .sort((a, b) => b.buildings - a.buildings);
}

// ---------------- Goods ----------------

/**
 * Every good, summed across the realm, with its suppliers named.
 *
 * Import dependency is computed on the realm's *combined* books rather than
 * averaged across cities — a realm where one city imports everything and another
 * exports it is not 50% dependent, it is internally balanced, and only the
 * summed figures show that.
 */
function aggregateGoods(kingdom: Kingdom, cities: City[], routes: RouteContext, ctx: GameContext): {
  goods: RealmGoodPosition[];
  strategic: RealmGoodPosition[];
  military: RealmGoodPosition[];
  topExports: RealmGoodPosition[];
  topImports: RealmGoodPosition[];
  dependencies: RealmGoodPosition[];
} {
  // Inbound volume per good per supplying realm, for the supplier breakdown.
  const supplyByGood = new Map<GoodId, Map<string, number>>();
  for (const route of routes.inbound) {
    const fromCity = ctx.sim.cities.get(route.fromCityId);
    const supplierId = fromCity?.kingdomId ?? route.fromKingdomId;
    if (!supplierId || supplierId === kingdom.id) continue;
    const perRealm = supplyByGood.get(route.good) ?? new Map<string, number>();
    perRealm.set(supplierId, (perRealm.get(supplierId) ?? 0) + route.volume);
    supplyByGood.set(route.good, perRealm);
  }

  const positions: RealmGoodPosition[] = [];

  for (const good of ALL_GOODS) {
    let produced = 0, consumed = 0, imported = 0, exported = 0, stock = 0;
    for (const city of cities) {
      const flow = city.ledger.flow(good);
      produced += flow.produced;
      consumed += flow.consumed;
      imported += flow.imported;
      exported += flow.exported;
      stock += city.stock.get(good);
    }
    const touched = stock > 0.01 || produced > 0 || consumed > 0 || imported > 0 || exported > 0;
    if (!touched) continue;

    const used = consumed + exported;
    const perRealm = supplyByGood.get(good);
    const supplyTotal = perRealm ? [...perRealm.values()].reduce((a, b) => a + b, 0) : 0;

    positions.push({
      good,
      flow: { produced, consumed, imported, exported },
      stock,
      net: produced + imported - consumed - exported,
      importDependency: used > 0 ? Math.max(0, Math.min(1, imported / used)) : 0,
      suppliers: perRealm && supplyTotal > 0
        ? [...perRealm.entries()]
            .map(([kingdomId, volume]) => ({
              kingdomId,
              name: ctx.sim.kingdoms.get(kingdomId)?.name ?? 'reino desconhecido',
              volume,
              share: volume / supplyTotal
            }))
            .sort((a, b) => b.share - a.share)
        : []
    });
  }

  const byGood = new Map(positions.map(p => [p.good, p]));
  const pick = (list: GoodId[]) => list.map(g => byGood.get(g)).filter((p): p is RealmGoodPosition => Boolean(p));

  return {
    goods: positions.sort((a, b) => b.stock - a.stock),
    strategic: pick(STRATEGIC_GOODS),
    military: pick(MILITARY_GOODS),
    topExports: [...positions].filter(p => p.flow.exported > 0).sort((a, b) => b.flow.exported - a.flow.exported).slice(0, 6),
    topImports: [...positions].filter(p => p.flow.imported > 0).sort((a, b) => b.flow.imported - a.flow.imported).slice(0, 6),
    // A dependency only matters where there is real consumption behind it.
    dependencies: [...positions]
      .filter(p => p.flow.consumed > 0.5 && p.importDependency >= 0.2)
      .sort((a, b) => b.importDependency - a.importDependency)
  };
}

// ---------------- Cities ----------------

/**
 * What a settlement is for, and the worst thing about it.
 *
 * The role is derived from rated output and building mix — never from the name,
 * which the brief rules out and which would break the moment a city is renamed.
 * Capital wins outright because administration is what the capital *is*,
 * whatever else it also does.
 */
function summariseCity(city: City, kingdom: Kingdom, ctx: GameContext): CitySummary {
  const outputByGood = new Map<GoodId, number>();
  const byCategory = new Map<BuildingCategory, number>();
  let hasPort = false;

  for (const building of city.buildings.values()) {
    const def = BUILDINGS[building.type];
    if (!def) continue;
    byCategory.set(def.category, (byCategory.get(def.category) ?? 0) + 1);
    if (building.type === 'harbor' || building.type === 'port') hasPort = true;

    const scale = building.level * building.staffing;
    for (const [good, base] of Object.entries(def.produces ?? {})) {
      const amount = (base as number) * scale;
      if (amount > 0) outputByGood.set(good as GoodId, (outputByGood.get(good as GoodId) ?? 0) + amount);
    }
  }

  const outputs = [...outputByGood.entries()]
    .map(([good, amount]) => ({ good, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const role: EconomicRole =
    kingdom.capitalCityId === city.id ? 'capital'
    : (byCategory.get('craft') ?? 0) >= 2 ? 'industrial'
    : (byCategory.get('extraction') ?? 0) >= 2 ? 'mining'
    : hasPort ? 'port'
    : (byCategory.get('commerce') ?? 0) >= 2 ? 'trade-hub'
    : (byCategory.get('knowledge') ?? 0) >= 2 ? 'knowledge'
    : (byCategory.get('food') ?? 0) >= 2 ? 'agricultural'
    : 'settlement';

  // One problem, the worst one. A list of five per city across twenty cities is
  // a wall nobody reads.
  const besieger = city.besiegerId ? ctx.sim.kingdoms.get(city.besiegerId) : null;
  const problem: CitySummary['problem'] =
    besieger ? { label: `Sitiada por ${besieger.name}`, severity: 'critical' }
    : city.famineYears > 0 ? { label: `Fome há ${city.famineYears} ano(s)`, severity: 'critical' }
    : city.population > city.housingCapacity() ? { label: 'Superlotada', severity: 'warning' }
    : city.jobCount() > 0 && city.filledJobs() === 0 ? { label: 'Nenhum posto ocupado', severity: 'warning' }
    : null;

  return {
    id: city.id,
    name: city.name,
    population: city.population,
    tier: city.tierInfo.name,
    prosperity: city.prosperity,
    role,
    outputs,
    problem,
    x: city.x,
    y: city.y
  };
}

// ---------------- Diplomacy ----------------

function computeDiplomacy(kingdom: Kingdom, routes: RouteContext, ctx: GameContext): {
  relations: Relationship[];
  tradePartners: { kingdomId: string; name: string; color: string; volume: number; share: number }[];
  wars: WarSummary[];
} {
  const sim = ctx.sim;
  const diplomacy = sim.diplomacy;
  const trade = sim.trade;

  // Trade volume per partner realm, from routes with one end here.
  const volumeByRealm = new Map<string, number>();
  for (const route of routes.all) {
    const fromCity = sim.cities.get(route.fromCityId);
    const toCity = sim.cities.get(route.toCityId);
    const otherId = routes.own.has(route.fromCityId)
      ? toCity?.kingdomId ?? route.toKingdomId
      : fromCity?.kingdomId ?? route.fromKingdomId;
    if (!otherId || otherId === kingdom.id) continue;
    volumeByRealm.set(otherId, (volumeByRealm.get(otherId) ?? 0) + route.volume);
  }
  const totalVolume = [...volumeByRealm.values()].reduce((a, b) => a + b, 0);

  // Everyone this realm has met, plus anyone it trades with or fights.
  const contacts = new Set<string>(kingdom.knownKingdoms);
  for (const id of volumeByRealm.keys()) contacts.add(id);
  for (const war of diplomacy.activeWars.values()) {
    if (war.attacker === kingdom.id) contacts.add(war.defender);
    else if (war.defender === kingdom.id) contacts.add(war.attacker);
  }
  for (const id of kingdom.vassalIds) contacts.add(id);
  if (kingdom.overlordId) contacts.add(kingdom.overlordId);
  contacts.delete(kingdom.id);

  const relations: Relationship[] = [];
  for (const otherId of contacts) {
    const other = sim.kingdoms.get(otherId);
    if (!other) continue;
    const truce = diplomacy.getTruce(kingdom.id, otherId, sim.currentYear);
    relations.push({
      kingdomId: otherId,
      name: other.name,
      color: other.color,
      relation: diplomacy.getRelation(kingdom.id, otherId),
      status: diplomacy.getStatus(kingdom.id, otherId),
      tradeVolume: volumeByRealm.get(otherId) ?? 0,
      hasAgreement: trade.hasAgreement(kingdom.id, otherId),
      truceUntil: truce ? truce.untilYear : null,
      embargoed: trade.isEmbargoed(kingdom.id, otherId) || trade.isEmbargoed(otherId, kingdom.id),
      isVassal: kingdom.vassalIds.has(otherId),
      isOverlord: kingdom.overlordId === otherId
    });
  }

  const wars: WarSummary[] = [];
  for (const war of diplomacy.activeWars.values()) {
    const aggressor = war.attacker === kingdom.id;
    if (!aggressor && war.defender !== kingdom.id) continue;
    const enemyId = aggressor ? war.defender : war.attacker;
    wars.push({
      war,
      enemyId,
      enemyName: sim.kingdoms.get(enemyId)?.name ?? 'reino desconhecido',
      aggressor,
      years: Math.max(0, sim.currentYear - war.startYear),
      // The record counts kills by side, so which column is "ours" depends on
      // which side of the war this realm is on.
      killsInflicted: aggressor ? war.attackerKills : war.defenderKills,
      killsSuffered: aggressor ? war.defenderKills : war.attackerKills
    });
  }

  return {
    relations: relations.sort((a, b) => b.tradeVolume - a.tradeVolume || b.relation - a.relation),
    tradePartners: [...volumeByRealm.entries()]
      .map(([kingdomId, volume]) => ({
        kingdomId,
        name: sim.kingdoms.get(kingdomId)?.name ?? 'reino desconhecido',
        color: sim.kingdoms.get(kingdomId)?.color ?? 'var(--ae-accent)',
        volume,
        share: totalVolume > 0 ? volume / totalVolume : 0
      }))
      .sort((a, b) => b.volume - a.volume),
    wars: wars.sort((a, b) => b.years - a.years)
  };
}

// ---------------- Infrastructure ----------------

/**
 * Roads, rail and harbours across the realm.
 *
 * Territory sweeps are bounded by the realm's own tiles. Rail connectivity needs
 * `components()`, which walks the whole map, so it only runs when the realm has
 * track at all — and once, not once per city pair.
 */
function computeInfrastructure(
  kingdom: Kingdom,
  cities: City[],
  routes: RouteContext,
  ctx: GameContext
): Infrastructure {
  let roadLevel = 0;
  let railTiles = 0;
  let railDamagedTiles = 0;
  let ports = 0;
  let harbours = 0;
  const bottlenecks: InfraBottleneck[] = [];

  for (const city of cities) {
    if (city.hasBuilding('port')) ports += city.countOfType('port');
    if (city.hasBuilding('harbor')) harbours += city.countOfType('harbor');

    let cityRoad = 0;
    let worstBreak: { x: number; y: number; damage: number } | null = null;
    for (const key of city.territory) {
      const [xs, ys] = key.split(',');
      const tile = ctx.tileMap.getTile(Number(xs), Number(ys));
      if (!tile) continue;
      if (tile.roadLevel > cityRoad) cityRoad = tile.roadLevel;
      if (tile.railLevel > 0) {
        railTiles++;
        // 0.5 is the level at which the railway network treats a line as severed,
        // so it is the threshold the dossier reports against too.
        if (tile.railDamage >= 0.5) {
          railDamagedTiles++;
          if (!worstBreak || tile.railDamage > worstBreak.damage) {
            worstBreak = { x: tile.x, y: tile.y, damage: tile.railDamage };
          }
        }
      }
    }
    if (cityRoad > roadLevel) roadLevel = cityRoad;

    if (worstBreak) {
      bottlenecks.push({
        kind: 'rail-damaged',
        subject: `Ferrovia de ${city.name}`,
        cause: `Trecho com ${Math.round(worstBreak.damage * 100)}% de dano — acima de 50% a linha é tratada como rompida`,
        severity: 'critical',
        cityId: city.id,
        at: { x: worstBreak.x, y: worstBreak.y }
      });
    }
    // Only worth reporting once a settlement is big enough for the lack of a road
    // to be a limitation rather than simply its stage of development.
    if (cityRoad === 0 && city.population >= 30) {
      bottlenecks.push({
        kind: 'no-road',
        subject: city.name,
        cause: `${city.population} habitantes sem nenhuma via no território`,
        severity: 'warning',
        cityId: city.id,
        at: { x: city.x, y: city.y }
      });
    }
  }

  let railConnectedCities = 0;
  if (railTiles > 0) {
    const own = new Set(cities.map(c => c.id));
    const connected = new Set<string>();
    for (const component of ctx.sim.railways.components(ctx.tileMap)) {
      const joined = new Set<string>();
      for (const tile of component) {
        if (tile.cityId && own.has(tile.cityId)) joined.add(tile.cityId);
      }
      // A component joining two or more of the realm's own settlements is a line
      // that actually connects something.
      if (joined.size >= 2) {
        railConnectedCities += joined.size;
        for (const id of joined) connected.add(id);
      }
    }
    // A realm that has built rail and left a city off it has an actual gap. A
    // realm with no rail at all has not — so this only runs inside this branch.
    for (const city of cities) {
      if (connected.has(city.id) || city.population < 50) continue;
      bottlenecks.push({
        kind: 'unconnected',
        subject: city.name,
        cause: `${city.population} habitantes fora da malha ferroviária do reino`,
        severity: 'warning',
        cityId: city.id,
        at: { x: city.x, y: city.y }
      });
    }
  }

  let routesActive = 0;
  let routesSuspended = 0;
  for (const route of routes.all) {
    if (route.active) { routesActive++; continue; }
    routesSuspended++;
    const outbound = routes.own.has(route.fromCityId);
    const partnerId = outbound ? route.toKingdomId : route.fromKingdomId;
    const partner = ctx.sim.cities.get(outbound ? route.toCityId : route.fromCityId);
    bottlenecks.push({
      kind: 'route-suspended',
      subject: `${GOODS[route.good]?.name ?? route.good} · ${outbound ? 'saída' : 'entrada'}`,
      cause: partner
        ? `Rota com ${partner.name} fechada — guerra ou embargo entre os reinos`
        : 'Rota fechada — guerra ou embargo entre os reinos',
      severity: 'critical',
      good: route.good,
      cityId: partner?.id,
      kingdomId: partnerId && partnerId !== kingdom.id ? partnerId : undefined,
      at: partner ? { x: partner.x, y: partner.y } : undefined
    });
  }

  return {
    roadLevel,
    railTiles,
    railDamagedTiles,
    railConnectedCities,
    worldFreight: ctx.sim.railways.yearlyFreight,
    ports,
    harbours,
    maritimeRoutes: routes.all.filter(r => r.kind === 'maritime').length,
    overlandRoutes: routes.all.filter(r => r.kind === 'overland').length,
    routesActive,
    routesSuspended,
    bottlenecks: bottlenecks.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
  };
}

// ---------------- Technology ----------------

/**
 * What the realm knows, and what it can actually do with it.
 *
 * The second half is the interesting one and the engine already computes it:
 * `techCapabilities` carries a per-technology `capacity` plus the buildings and
 * goods that are missing. A realm that has researched combustion with no oil and
 * no refinery is a realm that has not industrialised, and this is where that
 * shows.
 */
function computeTechnology(kingdom: Kingdom): TechnologyState {
  const research = kingdom.research;
  const currentDef = research.current ? TECHNOLOGIES[research.current] : undefined;

  const recent = [...research.known]
    .map(id => TECHNOLOGIES[id])
    .filter(Boolean)
    // Later eras are later discoveries; the research state keeps no timestamps,
    // so era order is the only honest ordering available.
    .sort((a, b) => (TECH_ERAS[b.era]?.order ?? 0) - (TECH_ERAS[a.era]?.order ?? 0))
    .slice(0, 6)
    .map(tech => ({
      id: tech.id,
      name: tech.name,
      era: tech.era,
      unlockedBuildings: (tech.unlocks.buildings ?? []).map(type => BUILDINGS[type]?.name ?? type),
      demands: demandCreatedBy(tech.id).map(d => d.good)
    }));

  return {
    era: kingdom.operatingEra,
    eraName: TECH_ERAS[kingdom.operatingEra]?.name ?? kingdom.operatingEra,
    known: research.known.size,
    current: currentDef
      ? { id: currentDef.id, name: currentDef.name, progress: research.progress, cost: techCost(currentDef, kingdom.cityIds.size) }
      : null,
    output: research.output,
    capacity: kingdom.technologicalCapacity(),
    idleCapabilities: [...kingdom.techCapabilities]
      .filter(c => c.capacity < 0.95 && (c.missingBuildings.length > 0 || c.missingGoods.length > 0))
      .sort((a, b) => a.capacity - b.capacity),
    recent
  };
}

// ---------------- Small helpers ----------------

function lastClosedLedger(kingdom: Kingdom): RealmMetrics['lastLedger'] {
  const ledger = kingdom.economy.ledger;
  if (!ledger.length) return null;
  const last = ledger[ledger.length - 1];
  return {
    year: last.year,
    taxIncome: last.taxIncome,
    tradeIncome: last.tradeIncome,
    upkeep: last.upkeep,
    net: last.net
  };
}

/** Factions in a stable display order, strongest influence first. */
function orderedFactions(kingdom: Kingdom): FactionState[] {
  const ids = Object.keys(SOCIAL_FACTIONS) as SocialFactionId[];
  return ids
    .map(id => kingdom.society.factions[id])
    .filter((f): f is FactionState => Boolean(f))
    .sort((a, b) => b.influence - a.influence);
}

/**
 * The ruler's likely successor.
 *
 * Deliberately shallow: the eldest living child. The engine has its own
 * `chooseSuccessor` with the real rules, and duplicating them here would produce
 * a second answer that disagrees with the one the simulation acts on — so this is
 * labelled as the eldest heir rather than as *the* heir.
 */
function findHeir(ruler: Entity, entities: Entity[]): Entity | null {
  if (!ruler.childrenIds.length) return null;
  let best: Entity | null = null;
  for (const entity of entities) {
    if (!ruler.childrenIds.includes(entity.id)) continue;
    if (!best || entity.age > best.age) best = entity;
  }
  return best;
}

// ============================ CACHE ============================

/** Longest a realm snapshot is trusted. Slower than the city's: it costs more. */
const MAX_AGE_MS = 2000;

/**
 * Holds one realm's metrics and decides when to recompute.
 *
 * A year boundary forces a rebuild: the ledgers roll over annually and every flow
 * figure changes at once. Otherwise the cadence is slow on purpose — this is the
 * single most expensive computation the interface performs.
 */
export class RealmMetricsCache {
  private metrics: RealmMetrics | null = null;
  private builtAt = -Infinity;
  private builtYear = -1;
  private builtFor = '';

  public get(kingdom: Kingdom, ctx: GameContext, now: number): RealmMetrics {
    const yearChanged = ctx.sim.currentYear !== this.builtYear;
    const realmChanged = kingdom.id !== this.builtFor;
    const stale = now - this.builtAt >= MAX_AGE_MS;

    if (this.metrics && !yearChanged && !realmChanged && !stale) return this.metrics;

    this.metrics = computeRealmMetrics(kingdom, ctx);
    this.builtAt = now;
    this.builtYear = ctx.sim.currentYear;
    this.builtFor = kingdom.id;
    return this.metrics;
  }

  public invalidate(): void {
    this.builtAt = -Infinity;
  }
}
