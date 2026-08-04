export const ALL_GOODS: GoodId[] = Object.keys(GOODS) as GoodId[];
export const RAW_GOODS: GoodId[] = ALL_GOODS.filter(id => GOODS[id].kind === 'raw');
export const CRAFTED_GOODS: GoodId[] = ALL_GOODS.filter(id => GOODS[id].kind === 'crafted');

/**
 * A container of goods with a soft capacity.
 * Cities, kingdoms and caravans all use one.
 */
export class Stockpile {
  private amounts: Map<GoodId, number> = new Map();
  public capacity: number;

  constructor(capacity: number = 500, initial?: Partial<Record<GoodId, number>>) {
    this.capacity = capacity;
    if (initial) {
      for (const [good, amount] of Object.entries(initial)) {
        this.amounts.set(good as GoodId, amount as number);
      }
    }
  }

  public get(good: GoodId): number {
    return this.amounts.get(good) ?? 0;
  }

  public has(good: GoodId, amount: number): boolean {
    return this.get(good) >= amount;
  }

  public hasAll(cost: Partial<Record<GoodId, number>>): boolean {
    for (const [good, amount] of Object.entries(cost)) {
      if (this.get(good as GoodId) < (amount as number)) return false;
    }
    return true;
  }

  /** Adds goods, clamped to capacity. Returns how much actually fit. */
  public add(good: GoodId, amount: number): number {
    if (amount <= 0) return 0;
    const current = this.get(good);
    const room = Math.max(0, this.capacity - current);
    const stored = Math.min(amount, room);
    this.amounts.set(good, current + stored);
    return stored;
  }

  /** Removes goods. Returns how much was actually available and taken. */
  public take(good: GoodId, amount: number): number {
    if (amount <= 0) return 0;
    const current = this.get(good);
    const taken = Math.min(amount, current);
    this.amounts.set(good, current - taken);
    return taken;
  }

  /** Atomically spends a whole cost, or nothing at all. */
  public spend(cost: Partial<Record<GoodId, number>>): boolean {
    if (!this.hasAll(cost)) return false;
    for (const [good, amount] of Object.entries(cost)) {
      this.take(good as GoodId, amount as number);
    }
    return true;
  }

  public set(good: GoodId, amount: number): void {
    this.amounts.set(good, Math.max(0, Math.min(this.capacity, amount)));
  }

  public total(): number {
    let sum = 0;
    for (const amount of this.amounts.values()) sum += amount;
    return sum;
  }

  /** Fraction of capacity used, averaged across stored goods. */
  public fullness(): number {
    const stored = this.total();
    const maxTotal = this.capacity * ALL_GOODS.length;
    return maxTotal <= 0 ? 0 : stored / maxTotal;
  }

  /** Goods sorted by amount, largest first. Used by the trade AI to pick exports. */
  public entries(): { good: GoodId; amount: number }[] {
    return ALL_GOODS
      .map(good => ({ good, amount: this.get(good) }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }

  /** The good this stockpile has most of relative to capacity. */
  public largestSurplus(exclude: GoodId[] = []): { good: GoodId; amount: number } | null {
    const candidates = this.entries().filter(e => !exclude.includes(e.good));
    return candidates.length ? candidates[0] : null;
  }

  /** The good this stockpile most lacks, among the ones it should have. */
  public largestDeficit(wanted: GoodId[]): { good: GoodId; amount: number } | null {
    let worst: { good: GoodId; amount: number } | null = null;
    for (const good of wanted) {
      const amount = this.get(good);
      if (!worst || amount < worst.amount) worst = { good, amount };
    }
    return worst;
  }

  public serialize(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [good, amount] of this.amounts) {
      if (amount > 0) out[good] = Math.round(amount * 100) / 100;
    }
    return out;
  }

  public deserialize(data: Record<string, number> | undefined): void {
    this.amounts.clear();
    if (!data) return;
    for (const [good, amount] of Object.entries(data)) {
      this.amounts.set(good as GoodId, amount);
    }
  }

  public clone(): Stockpile {
    const copy = new Stockpile(this.capacity);
    for (const [good, amount] of this.amounts) copy.amounts.set(good, amount);
    return copy;
  }
}
