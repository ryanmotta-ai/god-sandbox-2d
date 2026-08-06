import { GoodId, GOODS, ALL_GOODS } from './Goods';
import { SpeciesType } from '../entities/Species';
import { rng } from '../core/Random';

/**
 * Money, prices and national accounts.
 *
 * Before the `currency` technology a realm barters — its treasury is measured in
 * raw gold. Once currency is minted the realm gets a named money whose value
 * floats against every other realm's, driven by how much gold backs it and how
 * much of it has been printed.
 */

// ============================ CURRENCY ============================

/**
 * Every realm mints the real. Each one is still its own currency with its own
 * gold backing and its own inflation — the exchange rate between two realms is
 * what drives trade — but they are all denominated in R$, so a price on one
 * screen means the same thing as a price on another.
 */
const CURRENCY_NAME = 'Real';
const CURRENCY_SYMBOL = 'R$';

export interface Currency {
  name: string;
  symbol: string;
  /** Year the mint opened. */
  foundedYear: number;
  /** Value of one unit in abstract world units. Floats with gold backing and money supply. */
  value: number;
  /** Units in circulation. Printing money without gold devalues it. */
  supply: number;
  /** Year-on-year change in value, as a fraction. Positive means the money is losing worth. */
  inflation: number;
}

export function mintCurrency(species: SpeciesType, kingdomName: string, year: number): Currency {
  // The realm's name distinguishes one mint from another: the Real of Frostholm
  // buys a different amount of grain than the Real of Dawnspire.
  const realmWord = kingdomName.split(' ').pop() ?? '';
  const name = realmWord ? `${CURRENCY_NAME} de ${realmWord}` : CURRENCY_NAME;

  return {
    name,
    symbol: CURRENCY_SYMBOL,
    foundedYear: year,
    value: 1,
    supply: 500,
    inflation: 0
  };
}

// ============================ WORLD MARKET ============================

interface MarketEntry {
  price: number;
  /** Units offered for sale across all realms this year. */
  supply: number;
  /** Units realms wanted to buy this year. */
  demand: number;
  /** Rolling price history for the economy screen. */
  history: number[];
}

const MAX_PRICE_HISTORY = 120;

/**
 * A single global market that all realms trade against.
 * Prices move toward whatever clears supply against demand, with the base price
 * acting as a gravity well so nothing runs away entirely.
 */
export class WorldMarket {
  private entries: Map<GoodId, MarketEntry> = new Map();
  public year: number = 1;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.entries.clear();
    for (const good of ALL_GOODS) {
      const base = GOODS[good].basePrice;
      this.entries.set(good, {
        price: base,
        supply: 0,
        demand: 0,
        history: [base, base, base, base, base]
      });
    }
  }

  public price(good: GoodId): number {
    return this.entries.get(good)?.price ?? GOODS[good].basePrice;
  }

  public priceHistory(good: GoodId): number[] {
    return this.entries.get(good)?.history ?? [];
  }

  public supplyOf(good: GoodId): number {
    return this.entries.get(good)?.supply ?? 0;
  }

  public demandOf(good: GoodId): number {
    return this.entries.get(good)?.demand ?? 0;
  }

  /** Called by producers so the market knows what exists this year. */
  public reportSupply(good: GoodId, amount: number): void {
    const entry = this.entries.get(good);
    if (entry) entry.supply += amount;
  }

  /** Called by consumers so the market knows what is wanted this year. */
  public reportDemand(good: GoodId, amount: number): void {
    const entry = this.entries.get(good);
    if (entry) entry.demand += amount;
  }

  /** Value of a basket of goods at current prices. */
  public valueOf(goods: Partial<Record<GoodId, number>>): number {
    let total = 0;
    for (const [good, amount] of Object.entries(goods)) {
      total += this.price(good as GoodId) * (amount as number);
    }
    return total;
  }

  /** Settles the year: prices move, then supply and demand reset. */
  public settle(year: number): void {
    this.year = year;

    for (const good of ALL_GOODS) {
      const entry = this.entries.get(good)!;
      const base = GOODS[good].basePrice;

      // Ratio above 1 means scarcity. Strategic goods can reach higher price spikes (up to 5.5x).
      const ratio = (entry.demand + 1) / (entry.supply + 1);
      const ceiling = GOODS[good].strategic ? 5.5 : 3.5;
      const target = base * Math.max(0.35, Math.min(ceiling, Math.pow(ratio, 0.6)));

      // Prices are sticky — they drift toward the clearing price rather than jumping.
      entry.price += (target - entry.price) * 0.25;
      entry.price = Math.max(base * 0.3, Math.min(base * ceiling, entry.price));

      entry.history.push(Math.round(entry.price * 100) / 100);
      if (entry.history.length > MAX_PRICE_HISTORY) entry.history.shift();

      entry.supply = 0;
      entry.demand = 0;
    }
  }

  public serialize(): any {
    const out: Record<string, any> = {};
    for (const [good, entry] of this.entries) {
      out[good] = { price: entry.price, history: entry.history };
    }
    return { year: this.year, entries: out };
  }

  public deserialize(data: any): void {
    this.reset();
    if (!data?.entries) return;
    this.year = data.year ?? 1;
    for (const [good, saved] of Object.entries<any>(data.entries)) {
      const entry = this.entries.get(good as GoodId);
      if (!entry) continue;
      entry.price = saved.price ?? entry.price;
      entry.history = saved.history ?? entry.history;
    }
  }
}

// ============================ GOODS ACCOUNTING ============================

/** One good's flow through one settlement over one year. */
export interface GoodFlow {
  produced: number;
  consumed: number;
  imported: number;
  exported: number;
}

function emptyFlow(): GoodFlow {
  return { produced: 0, consumed: 0, imported: 0, exported: 0 };
}

/**
 * Where every unit of every good came from and went, per settlement, per year.
 *
 * Without this the economy can only report a stock number, which answers "how
 * much is left" but never "why". Production, consumption and trade all write
 * here, so a shortage can be traced to its cause instead of guessed at.
 */
export class CityLedger {
  private current: Map<GoodId, GoodFlow> = new Map();
  private previous: Map<GoodId, GoodFlow> = new Map();

  private entry(good: GoodId): GoodFlow {
    let flow = this.current.get(good);
    if (!flow) {
      flow = emptyFlow();
      this.current.set(good, flow);
    }
    return flow;
  }

  public recordProduced(good: GoodId, amount: number): void {
    if (amount > 0) this.entry(good).produced += amount;
  }

  public recordConsumed(good: GoodId, amount: number): void {
    if (amount > 0) this.entry(good).consumed += amount;
  }

  public recordImported(good: GoodId, amount: number): void {
    if (amount > 0) this.entry(good).imported += amount;
  }

  public recordExported(good: GoodId, amount: number): void {
    if (amount > 0) this.entry(good).exported += amount;
  }

  /** Last completed year's flow. The in-progress year is not yet meaningful. */
  public flow(good: GoodId): GoodFlow {
    return this.previous.get(good) ?? emptyFlow();
  }

  /** produced + imported − consumed − exported. Negative means the stock is draining. */
  public net(good: GoodId): number {
    const f = this.flow(good);
    return f.produced + f.imported - f.consumed - f.exported;
  }

  public goods(): GoodId[] {
    return [...this.previous.keys()];
  }

  /**
   * Share of what was used here that had to come from abroad, 0..1.
   *
   * This is the number that decides whether a war, an embargo or a blockade is a
   * nuisance or a catastrophe: a realm importing 86% of its oil does not have an
   * oil industry, it has a supplier.
   */
  public importDependency(good: GoodId): number {
    const f = this.flow(good);
    const used = f.consumed + f.exported;
    if (used <= 0) return 0;
    return Math.max(0, Math.min(1, f.imported / used));
  }

  /** Closes the year: this year's flows become the readable record. */
  public rollOver(): void {
    this.previous = this.current;
    this.current = new Map();
  }

  public serialize(): Record<string, GoodFlow> {
    const out: Record<string, GoodFlow> = {};
    for (const [good, flow] of this.previous) out[good] = flow;
    return out;
  }

  public deserialize(data: Record<string, GoodFlow> | undefined): void {
    this.previous = new Map();
    this.current = new Map();
    if (!data) return;
    for (const [good, flow] of Object.entries(data)) {
      this.previous.set(good as GoodId, { ...emptyFlow(), ...flow });
    }
  }
}

// ============================ WORLD SUMMARY ============================

/** Everything the economy screen needs about one good, all of it computed. */
export interface GoodSnapshot {
  good: GoodId;
  price: number;
  /** Change against last year's price, as a fraction. */
  priceChange: number;
  produced: number;
  consumed: number;
  traded: number;
  stock: number;
  /** produced + imported − consumed − exported, summed over every settlement. */
  net: number;
  /** Demand met by production, 0..1+. Below 1 means the world is short. */
  coverage: number;
}

/** A settlement's economic position, computed from its own books. */
export interface CitySnapshot {
  id: string;
  name: string;
  kingdomId: string | null;
  population: number;
  workers: number;
  jobs: number;
  unemployment: number;
  output: number;
  foodNet: number;
  foodStock: number;
  shortages: GoodId[];
}

interface LedgerHolder {
  id: string;
  name: string;
  kingdomId: string | null;
  population: number;
  ledger: CityLedger;
  stock: { get(good: GoodId): number };
  economicOutput: number;
}

/**
 * Rolls every settlement's books up into a world view.
 *
 * Read on demand by the economy screen rather than kept live: one pass over
 * settlements × goods is cheap, and nothing here may be invented — every figure
 * traces back to a flow some system actually recorded.
 */
export function summariseGoods(cities: Iterable<LedgerHolder>, market: WorldMarket): GoodSnapshot[] {
  const out: GoodSnapshot[] = [];

  for (const good of ALL_GOODS) {
    let produced = 0;
    let consumed = 0;
    let traded = 0;
    let stock = 0;

    for (const city of cities) {
      const f = city.ledger.flow(good);
      produced += f.produced;
      consumed += f.consumed;
      traded += f.exported;
      stock += city.stock.get(good);
    }

    const history = market.priceHistory(good);
    const price = market.price(good);
    const previous = history.length > 1 ? history[history.length - 2] : price;

    out.push({
      good,
      price,
      priceChange: previous > 0 ? (price - previous) / previous : 0,
      produced,
      consumed,
      traded,
      stock,
      net: produced - consumed,
      coverage: consumed > 0 ? produced / consumed : produced > 0 ? 2 : 1
    });
  }

  return out;
}

/** Goods the world consumes faster than it makes them, worst first. */
export function shortages(snapshots: GoodSnapshot[], limit: number = 5): GoodSnapshot[] {
  return snapshots
    .filter(s => s.consumed > 0 && s.coverage < 0.95)
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, limit);
}

/** Goods piling up unused, largest first. */
export function surpluses(snapshots: GoodSnapshot[], limit: number = 5): GoodSnapshot[] {
  return snapshots
    .filter(s => s.produced > 0 && s.coverage > 1.15)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, limit);
}

/** The sharpest price moves this year, in either direction. */
export function marketShocks(snapshots: GoodSnapshot[], limit: number = 5): GoodSnapshot[] {
  return snapshots
    .filter(s => Math.abs(s.priceChange) > 0.02)
    .sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange))
    .slice(0, limit);
}

// ============================ LOCAL MARKET ============================

/** How far a local price may drift from the world reference, either way. */
const LOCAL_PRICE_FLOOR = 0.35;
const LOCAL_PRICE_CEILING = 3.5;

/**
 * One realm's own prices.
 *
 * The world market is the reference every realm trades against, but a realm sat
 * on a coal seam does not pay the world price for coal, and a realm with none
 * pays far more. Without that divergence there is no such thing as buying low
 * and selling high, so no economic reason for a trade route to exist.
 *
 * Local prices are anchored to the world price and pulled away from it by local
 * scarcity, so they can diverge sharply but never run off on their own.
 */
export class LocalMarket {
  private prices: Map<GoodId, number> = new Map();

  /** This realm's price, falling back to the world price where it has no history. */
  public price(good: GoodId, worldPrice: number): number {
    return this.prices.get(good) ?? worldPrice;
  }

  public hasPrice(good: GoodId): boolean {
    return this.prices.has(good);
  }

  /**
   * Re-prices one good against what the realm actually holds and uses.
   * `available` is stock plus what was produced; `wanted` is what was consumed.
   */
  public settle(good: GoodId, worldPrice: number, available: number, wanted: number): void {
    const ratio = (wanted + 1) / (available + 1);
    const ceiling = GOODS[good]?.strategic ? 5.5 : LOCAL_PRICE_CEILING;
    const pressure = Math.max(LOCAL_PRICE_FLOOR, Math.min(ceiling, Math.pow(ratio, 0.6)));
    const target = worldPrice * pressure;

    const current = this.prices.get(good) ?? worldPrice;
    // Sticky, like the world market: a local price drifts, it does not jump.
    const next = current + (target - current) * 0.3;
    this.prices.set(good, Math.max(worldPrice * LOCAL_PRICE_FLOOR, Math.min(worldPrice * ceiling, next)));
  }

  public serialize(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [good, price] of this.prices) out[good] = Math.round(price * 100) / 100;
    return out;
  }

  public deserialize(data: Record<string, number> | undefined): void {
    this.prices.clear();
    if (!data) return;
    for (const [good, price] of Object.entries(data)) this.prices.set(good as GoodId, price);
  }
}

// ============================ NATIONAL ACCOUNTS ============================

export interface YearlyLedger {
  year: number;
  taxIncome: number;
  tradeIncome: number;
  upkeep: number;
  net: number;
  gdp: number;
  treasury: number;
}

const MAX_LEDGER_HISTORY = 120;

/**
 * One kingdom's economy: what it owns, what it earns, and what its money is worth.
 */
export class KingdomEconomy {
  /** Held in the realm's own currency once minted, otherwise in raw gold. */
  public treasury: number = 100;
  public currency: Currency | null = null;
  /** What goods actually cost inside this realm. Diverges from the world price. */
  public market: LocalMarket = new LocalMarket();

  /** Total value of everything produced last year. */
  public gdp: number = 0;
  /** Value produced per citizen — drives government choices and unrest. */
  public gdpPerCapita: number = 0;
  /** Fraction of output from factories rather than farms and mines, 0..1. */
  public industrialisation: number = 0;
  /** 0..1 — how content the population is with its material conditions. */
  public stability: number = 0.7;
  /** How unequally the wealth is spread, 0..1. Rises under capitalism. */
  public inequality: number = 0.3;

  public ledger: YearlyLedger[] = [];

  public get hasCurrency(): boolean {
    return this.currency !== null;
  }

  public get moneyName(): string {
    return this.currency?.name ?? 'ouro bruto';
  }

  public get moneySymbol(): string {
    // Before a realm mints coin it still trades, by weight of raw gold.
    return this.currency?.symbol ?? 'g';
  }

  /** Formats an amount in this realm's money, Brazilian style. */
  public format(amount: number): string {
    const rounded = Math.round(amount);
    return `${this.moneySymbol} ${rounded.toLocaleString('pt-BR')}`;
  }

  /** Converts an amount of this realm's money into abstract world units. */
  public toWorldValue(amount: number): number {
    return amount * (this.currency?.value ?? 1);
  }

  /** Converts abstract world units into this realm's money. */
  public fromWorldValue(worldValue: number): number {
    const rate = this.currency?.value ?? 1;
    return rate <= 0 ? worldValue : worldValue / rate;
  }

  public recordYear(entry: YearlyLedger): void {
    this.ledger.push(entry);
    if (this.ledger.length > MAX_LEDGER_HISTORY) this.ledger.shift();
  }

  public latest(): YearlyLedger | null {
    return this.ledger.length ? this.ledger[this.ledger.length - 1] : null;
  }

  /**
   * Revalues the currency. Money backed by real gold reserves and real output
   * holds its worth; money printed to cover deficits does not.
   */
  public revalue(goldReserves: number, output: number): void {
    if (!this.currency) return;

    const backing = (goldReserves * 6 + output) / Math.max(1, this.currency.supply);
    const target = Math.max(0.15, Math.min(4, backing));
    const previous = this.currency.value;

    this.currency.value += (target - this.currency.value) * 0.2;
    this.currency.inflation = previous > 0 ? (previous - this.currency.value) / previous : 0;
  }

  /** Printing money to cover a shortfall. Cheap now, expensive later. */
  public printMoney(amount: number): void {
    if (!this.currency) return;
    this.currency.supply += amount;
    this.treasury += amount;
  }

  public serialize(): any {
    return {
      treasury: this.treasury,
      currency: this.currency,
      gdp: this.gdp,
      gdpPerCapita: this.gdpPerCapita,
      industrialisation: this.industrialisation,
      stability: this.stability,
      inequality: this.inequality,
      ledger: this.ledger,
      prices: this.market.serialize()
    };
  }

  public deserialize(data: any): void {
    if (!data) return;
    this.treasury = data.treasury ?? 100;
    this.currency = data.currency ?? null;
    this.gdp = data.gdp ?? 0;
    this.gdpPerCapita = data.gdpPerCapita ?? 0;
    this.industrialisation = data.industrialisation ?? 0;
    this.stability = data.stability ?? 0.7;
    this.inequality = data.inequality ?? 0.3;
    this.ledger = data.ledger ?? [];
    this.market.deserialize(data.prices);
  }
}

/**
 * Exchange rate between two realms' currencies.
 * Returns how many units of `to` one unit of `from` buys.
 */
export function exchangeRate(from: KingdomEconomy, to: KingdomEconomy): number {
  const fromValue = from.currency?.value ?? 1;
  const toValue = to.currency?.value ?? 1;
  if (toValue <= 0) return 0;
  return fromValue / toValue;
}
