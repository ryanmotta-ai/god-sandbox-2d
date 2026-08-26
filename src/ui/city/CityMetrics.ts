/**
 * Everything the city dossier knows, computed once.
 *
 * The dossier asks one question — *why is this city doing well or badly?* — and
 * answering it needs figures that no single system holds: population by trade,
 * jobs against workers, a food balance, sector output, trade dependency, rail
 * reach. So this module does the aggregation, in one pass, behind one cache.
 *
 * Two rules govern it.
 *
 * **Every figure traces to something a system recorded.** The workhorse is
 * `CityLedger`, which already books produced / consumed / imported / exported per
 * good per year — so a food deficit is read from the books rather than
 * re-derived from a constant that might drift from the engine's own. Where a
 * figure genuinely cannot be computed it is `null`, and the UI omits the row.
 * Nothing here is estimated, smoothed or filled in.
 *
 * **It is not free, so it is not per frame.** Counting citizens by profession is
 * O(population) and rail connectivity is O(map). Both run on a cadence, on open,
 * or when the year turns — see `CityMetricsCache` at the bottom.
 */
import { BUILDINGS, type BuildingCategory, type BuildingType } from '../../civ/Building';
import { GOODS, productionRecipesFor, ALL_GOODS, type GoodId } from '../../civ/Goods';
import type { GoodFlow } from '../../civ/Economy';
import type { City } from '../../civ/City';
import type { Kingdom } from '../../civ/Kingdom';
import type { Building } from '../../civ/Building';
import type { Entity } from '../../entities/Entity';
import type { GameContext } from '../core/GameContext';
import type { Profession } from '../../entities/Needs';

// ============================ SHAPES ============================

export interface FoodBalance {
  produced: number;
  consumed: number;
  imported: number;
  exported: number;
  /** produced + imported − consumed − exported. Negative drains the store. */
  net: number;
  stock: number;
  /**
   * Supply over demand, clamped to 0..2. `null` when the city consumed nothing
   * last year — a settlement with no recorded demand has no security to measure,
   * and 0/0 shown as 0% would read as a famine that is not happening.
   */
  security: number | null;
  /**
   * Years the store would last at last year's consumption. `null` when nothing
   * was consumed. This is a store-over-rate division, not a projection: it does
   * not know about next year's harvest.
   */
  yearsOfStock: number | null;
}

export interface Employment {
  /** Citizens of working age (18+) living here. */
  workers: number;
  /** Job slots across every building, scaled by level. */
  jobs: number;
  filled: number;
  /**
   * Working-age citizens holding no post. Distinct from vacancies: both can be
   * positive at once when the jobs that exist do not match the people who exist.
   */
  unemployed: number;
  /** Posts with nobody in them. */
  vacancies: number;
  /** filled / workers, or null when nobody is of working age. */
  rate: number | null;
}

export interface Demographics {
  population: number;
  /** Citizens the simulation actually has objects for. May trail `population`,
   *  which the settlement tracks as its own figure. */
  tracked: number;
  infants: number;
  children: number;
  adolescents: number;
  adults: number;
  elders: number;
  /** Head count per profession, only professions actually present. */
  byProfession: { profession: Profession; count: number }[];
}

export interface GoodPosition {
  good: GoodId;
  stock: number;
  flow: GoodFlow;
  net: number;
  /** Share of what was used that was imported, 0..1. */
  importDependency: number;
}

export interface SectorOutput {
  category: BuildingCategory;
  buildings: number;
  workers: number;
  jobs: number;
  /** Rated yearly output per good: definition × level × staffing. Capacity, not
   *  a record of what was made — the engine books production per settlement. */
  ratedOutput: { good: GoodId; amount: number }[];
  /** filled / jobs across the sector, or null when it has no posts. */
  utilization: number | null;
}

export type BottleneckKind =
  | 'missing-input'
  | 'no-workers'
  | 'understaffed'
  | 'depleted-deposit';

export interface Bottleneck {
  kind: BottleneckKind;
  /** What is being held back. */
  subject: string;
  /** What is holding it back, in one line. */
  cause: string;
  /** The good to blame, when there is one — makes the finding navigable. */
  good?: GoodId;
  /** The building at fault, for a jump-to-map. */
  building?: { id: string; type: BuildingType; x: number; y: number };
  severity: 'warning' | 'critical';
}



export interface CityMetrics {
  cityId: string;
  /** Simulated year the figures describe. */
  year: number;

  isCapital: boolean;
  kingdom: Kingdom | null;

  demographics: Demographics;
  employment: Employment;
  food: FoodBalance;

  /** population / housingCapacity, or null when there is no housing at all. */
  housingPressure: number | null;
  housingCapacity: number;

  prosperity: number;
  economicOutput: number;
  researchOutput: number;

  /** Every good the city holds or moved, sorted by stock. */
  goods: GoodPosition[];
  /** Goods consumed faster than they arrive, worst first. */
  shortages: GoodPosition[];
  /** Goods piling up, largest net first. */
  surpluses: GoodPosition[];

  sectors: SectorOutput[];
  bottlenecks: Bottleneck[];

  /** Buildings grouped by category, for the buildings tab. */
  buildingsByCategory: { category: BuildingCategory; buildings: Building[] }[];

  siege: { besiegerName: string; progress: number; years: number } | null;
  famineYears: number;
}

// ============================ COMPUTATION ============================

/** Strategic goods, called out separately in the stockpile view. */
export const STRATEGIC_GOODS: GoodId[] = (
  ['iron', 'coal', 'oil', 'fuel', 'steel', 'copper', 'tin', 'bronze', 'machinery', 'tools'] as GoodId[]
).filter(good => Object.prototype.hasOwnProperty.call(GOODS, good));

export function computeCityMetrics(city: City, ctx: GameContext): CityMetrics {
  const sim = ctx.sim;
  const kingdom = city.kingdomId ? sim.kingdoms.get(city.kingdomId) ?? null : null;

  return {
    cityId: city.id,
    year: sim.currentYear,
    isCapital: kingdom?.capitalCityId === city.id,
    kingdom,

    demographics: computeDemographics(city, sim.entities),
    employment: computeEmployment(city, sim.entities),
    food: computeFood(city),

    housingCapacity: city.housingCapacity(),
    housingPressure: city.housingCapacity() > 0 ? city.population / city.housingCapacity() : null,

    prosperity: city.prosperity,
    economicOutput: city.economicOutput,
    researchOutput: city.researchOutput,

    ...computeGoods(city),
    sectors: computeSectors(city),
    bottlenecks: [],  // filled by the cache
    buildingsByCategory: groupBuildings(city),

    siege: city.besiegerId
      ? {
          besiegerName: sim.kingdoms.get(city.besiegerId)?.name ?? 'um exército',
          progress: city.siegeProgress,
          years: city.siegeYears
        }
      : null,
    famineYears: city.famineYears
  };
}

/**
 * Life stages and trades, from one pass over the population.
 *
 * `city.population` is the settlement's own figure and is what the economy runs
 * on; the entity count can trail it. Both are reported rather than reconciled,
 * because silently preferring one would hide a real disagreement between two
 * parts of the simulation.
 */
function computeDemographics(city: City, entities: Entity[]): Demographics {
  let tracked = 0, infants = 0, children = 0, adolescents = 0, adults = 0, elders = 0;
  const professions = new Map<Profession, number>();

  for (const entity of entities) {
    if (entity.cityId !== city.id) continue;
    tracked++;
    switch (entity.lifeStage) {
      case 'infant': infants++; break;
      case 'child': children++; break;
      case 'adolescent': adolescents++; break;
      case 'adult': adults++; break;
      case 'elder': elders++; break;
    }
    if (entity.profession !== 'none') {
      professions.set(entity.profession, (professions.get(entity.profession) ?? 0) + 1);
    }
  }

  return {
    population: city.population,
    tracked, infants, children, adolescents, adults, elders,
    byProfession: [...professions.entries()]
      .map(([profession, count]) => ({ profession, count }))
      .sort((a, b) => b.count - a.count)
  };
}

/**
 * Employment, keeping unemployment and labour shortage apart.
 *
 * The brief is emphatic about this and it matters: 320 workers against 410 jobs
 * is a city that cannot staff its industry, and 410 workers against 320 jobs is a
 * city with idle people. Reporting one number called "unemployment" for both
 * would describe two opposite problems identically. So both sides are counted
 * from the same three real figures and neither is derived from the other.
 */
function computeEmployment(city: City, entities: Entity[]): Employment {
  let workers = 0;
  for (const entity of entities) {
    if (entity.cityId !== city.id) continue;
    if (!entity.isChild) workers++;
  }

  const jobs = city.jobCount();
  const filled = city.filledJobs();

  return {
    workers,
    jobs,
    filled,
    unemployed: Math.max(0, workers - filled),
    vacancies: Math.max(0, jobs - filled),
    rate: workers > 0 ? Math.min(1, filled / workers) : null
  };
}

/**
 * The food balance, straight from the settlement's books.
 *
 * Demand is `consumed + exported` — everything that left. Supply is
 * `produced + imported` — everything that arrived. Security is supply over
 * demand, which is 1.0 for a city exactly feeding itself, below 1 for one eating
 * into its store, above 1 for one building one up.
 *
 * Deliberately *not* `population × FOOD_PER_CITIZEN`: that constant lives inside
 * the civilisation engine, and a second copy of it here would be a formula that
 * silently disagrees with the simulation the first time either changes.
 */
function computeFood(city: City): FoodBalance {
  const flow = city.ledger.flow('food');
  const demand = flow.consumed + flow.exported;
  const supply = flow.produced + flow.imported;
  const stock = city.stock.get('food');

  return {
    produced: flow.produced,
    consumed: flow.consumed,
    imported: flow.imported,
    exported: flow.exported,
    net: city.ledger.net('food'),
    stock,
    security: demand > 0 ? Math.min(2, supply / demand) : null,
    yearsOfStock: flow.consumed > 0 ? stock / flow.consumed : null
  };
}

/** Stock and flow for every good this city holds or moved. */
function computeGoods(city: City): {
  goods: GoodPosition[];
  shortages: GoodPosition[];
  surpluses: GoodPosition[];
} {
  const positions: GoodPosition[] = [];

  for (const good of ALL_GOODS) {
    const stock = city.stock.get(good);
    const flow = city.ledger.flow(good);
    const touched = stock > 0.01 || flow.produced > 0 || flow.consumed > 0 || flow.imported > 0 || flow.exported > 0;
    if (!touched) continue;

    positions.push({
      good,
      stock,
      flow,
      net: city.ledger.net(good),
      importDependency: city.ledger.importDependency(good)
    });
  }

  positions.sort((a, b) => b.stock - a.stock);

  return {
    goods: positions,
    // A shortage is a good being drained: real demand, and a negative balance.
    shortages: positions
      .filter(p => p.flow.consumed > 0 && p.net < -0.01)
      .sort((a, b) => a.net - b.net),
    surpluses: positions
      .filter(p => p.net > 0.01 && p.flow.produced > 0)
      .sort((a, b) => b.net - a.net)
  };
}

/**
 * Output by sector, built from the buildings that are actually standing.
 *
 * No "industry score" — the brief rules that out and it would be meaningless
 * anyway. A sector is just its buildings: how many, how staffed, and what they
 * are rated to produce.
 */
function computeSectors(city: City): SectorOutput[] {
  const byCategory = new Map<BuildingCategory, SectorOutput>();

  for (const building of city.buildings.values()) {
    const def = BUILDINGS[building.type];
    if (!def) continue;

    let sector = byCategory.get(def.category);
    if (!sector) {
      sector = { category: def.category, buildings: 0, workers: 0, jobs: 0, ratedOutput: [], utilization: null };
      byCategory.set(def.category, sector);
    }

    sector.buildings++;
    sector.workers += building.assignedWorkerIds.size;
    sector.jobs += (def.jobs ?? 0) * building.level;

    // Rated capacity: the same scaling the engine applies, applied to the
    // definition's figure. Labelled as capacity everywhere it is shown.
    const scale = building.level * building.staffing;
    for (const [good, base] of Object.entries(def.produces ?? {})) {
      const amount = (base as number) * scale;
      if (amount <= 0) continue;
      const existing = sector.ratedOutput.find(o => o.good === good);
      if (existing) existing.amount += amount;
      else sector.ratedOutput.push({ good: good as GoodId, amount });
    }
  }

  const sectors = [...byCategory.values()];
  for (const sector of sectors) {
    sector.utilization = sector.jobs > 0 ? Math.min(1, sector.workers / sector.jobs) : null;
    sector.ratedOutput.sort((a, b) => b.amount - a.amount);
  }
  return sectors.sort((a, b) => b.buildings - a.buildings);
}

/** The recipe input a converting building is short of, with what it makes. */
/**
 * What is actually holding this city back, read off the buildings themselves.
 *
 * Every finding is checked against a real number — a deposit against zero,
 * staffing against posts, a recipe input against the store. There is no
 * heuristic and no guess: an unexplained problem is left unreported rather
 * than attributed to a plausible cause.
 */
function computeBottlenecks(city: City, ctx: GameContext): Bottleneck[] {
  const found: Bottleneck[] = [];
  const seen = new Set<string>();
  const push = (b: Bottleneck) => {
    const key = `${b.kind}:${b.subject}:${b.good ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(b);
  };

  for (const building of city.buildings.values()) {
    const def = BUILDINGS[building.type];
    if (!def) continue;
    const jobs = (def.jobs ?? 0) * building.level;
    const staffed = building.assignedWorkerIds.size;
    const label = def.name ?? building.type;
    const at = { id: building.id, type: building.type, x: building.x, y: building.y };

    // A worked-out deposit is terminal, so it outranks everything else.
    if (def.extractionRate || building.extractedGood) {
      const tile = ctx.tileMap.getTile(building.x, building.y);
      const good = building.extractedGood ?? tile?.resourceType ?? null;
      if (good && tile && tile.resourceMax > 0 && tile.resourceAmount <= 0) {
        push({
          kind: 'depleted-deposit',
          subject: label,
          cause: `A jazida de ${GOODS[good]?.name ?? good} está esgotada`,
          good, building: at, severity: 'critical'
        });
        continue;
      }
    }

    if (jobs > 0 && staffed === 0) {
      push({
        kind: 'no-workers', subject: label,
        cause: `Nenhum dos ${jobs} postos está ocupado`,
        building: at, severity: 'critical'
      });
      continue;
    }

    // Recipe inputs, for the buildings that convert goods.
    const missing = missingInput(building, city);
    if (missing) {
      push({
        kind: 'missing-input',
        subject: missing.output ? `Produção de ${GOODS[missing.output]?.name ?? missing.output}` : label,
        cause: `${GOODS[missing.good]?.name ?? missing.good}: ${missing.available.toFixed(1)} em estoque, ${missing.needed.toFixed(1)} por ciclo`,
        good: missing.good, building: at, severity: 'critical'
      });
      continue;
    }

    if (jobs > 0 && staffed < jobs) {
      push({
        kind: 'understaffed', subject: label,
        cause: `${staffed} de ${jobs} postos ocupados`,
        building: at, severity: 'warning'
      });
    }
  }

  return found;
}

function missingInput(
  building: Building,
  city: City
): { good: GoodId; needed: number; available: number; output: GoodId | null } | null {
  const def = BUILDINGS[building.type];
  if (!def) return null;

  if (def.category === 'craft' && def.craftCapacity) {
    for (const goodId of ALL_GOODS) {
      if (GOODS[goodId].producedBy !== building.type) continue;
      for (const recipe of productionRecipesFor(goodId)) {
        for (const [input, amount] of Object.entries(recipe.inputs ?? {})) {
          const needed = amount as number;
          const available = city.stock.get(input as GoodId);
          if (available < needed) {
            return { good: input as GoodId, needed, available, output: goodId };
          }
        }
      }
    }
    return null;
  }

  for (const [input, amount] of Object.entries(def.consumes ?? {})) {
    const needed = amount as number;
    const available = city.stock.get(input as GoodId);
    if (available < needed) return { good: input as GoodId, needed, available, output: null };
  }
  return null;
}

function groupBuildings(city: City): { category: BuildingCategory; buildings: Building[] }[] {
  const groups = new Map<BuildingCategory, Building[]>();
  for (const building of city.buildings.values()) {
    const def = BUILDINGS[building.type];
    if (!def) continue;
    const list = groups.get(def.category) ?? [];
    list.push(building);
    groups.set(def.category, list);
  }
  return [...groups.entries()]
    .map(([category, buildings]) => ({ category, buildings }))
    .sort((a, b) => b.buildings.length - a.buildings.length);
}

// ============================ CACHE ============================

/** Longest a metrics snapshot is trusted. */
const MAX_AGE_MS = 1500;

/**
 * Holds one city's metrics and decides when to recompute.
 *
 * A year boundary forces a rebuild regardless of the clock, because the ledger
 * rolls over on the year and every flow figure changes at once. Otherwise the
 * cadence is deliberately slow: none of these numbers move faster than a
 * simulated day, and the sweep is the most expensive thing the UI does.
 */
export class CityMetricsCache {
  private metrics: CityMetrics | null = null;
  private builtAt = -Infinity;
  private builtYear = -1;
  private builtFor = '';

  /** Returns metrics for this city, recomputing only when stale. */
  public get(city: City, ctx: GameContext, now: number): CityMetrics {
    const yearChanged = ctx.sim.currentYear !== this.builtYear;
    const cityChanged = city.id !== this.builtFor;
    const stale = now - this.builtAt >= MAX_AGE_MS;

    if (this.metrics && !yearChanged && !cityChanged && !stale) return this.metrics;

    const metrics = computeCityMetrics(city, ctx);
    metrics.bottlenecks = computeBottlenecks(city, ctx);

    this.metrics = metrics;
    this.builtAt = now;
    this.builtYear = ctx.sim.currentYear;
    this.builtFor = city.id;
    return metrics;
  }

  /** Forces the next `get` to recompute. Called when the screen opens. */
  public invalidate(): void {
    this.builtAt = -Infinity;
  }
}
