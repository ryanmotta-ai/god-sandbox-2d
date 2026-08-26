import { GoodId } from './Goods';

/**
 * What a realm is made of, and what its settlements made.
 *
 * There is no market here any more. A good has a worth, and that worth is a
 * fixed property of the good in `Goods.ts` — nothing floats, nothing is bid up,
 * and no price is discovered by a model nobody can see. What a realm has is the
 * gold in its stockpile and the goods on its shelves, and what it produced is
 * counted from the buildings that produced it.
 */
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

/**
 * One realm's condition.
 *
 * No treasury lives here: the realm's gold is real gold, in `Kingdom.treasury`,
 * which is a stockpile like any city's. What is left is the handful of standings
 * the political and social layers read — how content the realm is, how unequally
 * it is doing, how industrial it has become, and how much its buildings make.
 */
export class KingdomEconomy {
  /** What the realm's buildings actually made last pass. */
  public output: number = 0;
  /** Output per citizen — drives government choices and unrest. */
  public outputPerCapita: number = 0;
  /** Fraction of output from factories rather than farms and mines, 0..1. */
  public industrialisation: number = 0;
  /** 0..1 — how content the population is with its material conditions. */
  public stability: number = 0.7;
  /** How unequally the wealth is spread, 0..1. Rises under capitalism. */
  public inequality: number = 0.3;

  public serialize(): any {
    return {
      output: this.output,
      outputPerCapita: this.outputPerCapita,
      industrialisation: this.industrialisation,
      stability: this.stability,
      inequality: this.inequality
    };
  }

  public deserialize(data: any): void {
    if (!data) return;
    // `gdp` is what this was called two renames ago; saves from then still load.
    this.output = data.output ?? data.gdp ?? 0;
    this.outputPerCapita = data.outputPerCapita ?? data.gdpPerCapita ?? 0;
    this.industrialisation = data.industrialisation ?? 0;
    this.stability = data.stability ?? 0.7;
    this.inequality = data.inequality ?? 0.3;
  }
}
