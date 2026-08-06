/**
 * Centralized Seeded Randomness Service using Mulberry32.
 * Ensures reproducible procedural generation and deterministic simulation behavior.
 */
export class RandomService {
  private seed: number;

  constructor(seed: number = Math.floor(Math.random() * 2147483647)) {
    this.seed = seed;
  }

  public getSeed(): number {
    return this.seed;
  }

  public setSeed(seed: number): void {
    this.seed = seed;
  }

  /** Returns float between 0 (inclusive) and 1 (exclusive) */
  public next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns float between [min, max) */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns integer between [min, max] */
  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Returns true with given probability [0, 1] */
  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick random item from array */
  public pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export const rng = new RandomService();

/**
 * Deterministic identifiers.
 *
 * Ids used to be built from `Date.now()` and `Math.random()`, which meant two
 * runs of the same seed produced different worlds and made balance changes
 * impossible to evaluate — you could never tell your tuning from the noise.
 * A plain counter is enough: ids only need to be unique within one world.
 */
let idCounter = 0;

export function nextId(prefix: string): string {
  return `${prefix}_${(idCounter++).toString(36)}`;
}

/** Called when a world is built so a replayed seed yields the same ids. */
export function resetIds(): void {
  idCounter = 0;
}

/** Deterministic string→integer hash (Java-style), for a stable per-entity seed. */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Mixes one or more integers into a float in [0, 1). Same mixing core as
 * Mulberry32 above, but pure and stateless — so a stable seed (an entity id,
 * a route id) always maps to the same value instead of consuming the shared
 * RNG stream. Used for cosmetic per-agent variety (lane choice, ring
 * position, path tie-breaking) that must stay identical between renders of
 * the same tick rather than reroll every frame.
 */
export function hashToUnit(...values: number[]): number {
  let t = 0;
  for (const v of values) t = (t + v + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
