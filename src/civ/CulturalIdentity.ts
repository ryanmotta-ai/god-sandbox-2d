/**
 * Cultures that live in people, not in realms.
 *
 * CULT-V1. `Culture.ts` already models what a *realm* values — militarism,
 * openness, war trauma — and feeds laws, tariffs and faction satisfaction. That
 * is a property of a state, and it changes when the state changes. This is a
 * different thing entirely: who a *population* is. It is carried by citizens,
 * inherited through families, taken along when people move, and it does not
 * change because a border moved.
 *
 * The distinction is the whole point of the layer. A realm can contain several
 * cultures; a culture can span several realms; conquest redraws the political
 * map in one year and the cultural map in none.
 *
 * Everything here is deliberately small:
 *
 *   an identity   — an id, a name, a parent it diverged from, and a slight lean
 *                   that architecture can read;
 *   a citizen     — one culture id and one number saying how much the place they
 *                   live has worn off on them;
 *   a settlement  — a cached share table, accumulated during a walk that was
 *                   already happening.
 *
 * There is no per-citizen comparison, no culture graph, and no distance field.
 * Cultures reach new ground the way they actually do: somebody carries them
 * there.
 */

import type { Entity } from '../entities/Entity';
import { rng } from '../core/Random';

/** The trait keys a cultural identity may lean on, shared with `CulturalProfile`. */
export type CulturalLean = Partial<Record<
  'militarism' | 'expansionism' | 'tradition' | 'authority' | 'openness' |
  'mercantilism' | 'stewardship' | 'innovation' | 'collectivism',
  number
>>;

export interface CulturalIdentity {
  id: string;
  name: string;
  /** The culture this one diverged from, if any. Depth is capped by `lineageDepth`. */
  parentId: string | null;
  foundedYear: number;
  /** Where it emerged. Used to tell an isolated branch from the old country. */
  homeCityId: string | null;
  /** How many divergences deep. Kept so names and drift do not run away. */
  lineageDepth: number;
  /**
   * A slight bias the architecture layer reads. Small on purpose — a culture is
   * not a set of stat bonuses, and CULT-V1 is explicitly not allowed to become
   * a political or religious system.
   */
  lean: CulturalLean;
}

/** Shares of each culture present in a settlement, summing to 1. */
export type CultureMix = Record<string, number>;

// ============================================================
// THE REGISTRY
// ============================================================

/**
 * Every culture that exists, and nothing else.
 *
 * Small enough to serialize whole. Cultures are never deleted — one that loses
 * its last speaker stays in the record, because the Chronicle refers to it and a
 * dead culture is a historical fact rather than a leak. The cap on creation (see
 * `MAX_CULTURES`) is what keeps the map bounded.
 */
export class CultureRegistry {
  private readonly cultures = new Map<string, CulturalIdentity>();
  private counter = 0;

  public get size(): number { return this.cultures.size; }
  public get(id: string | null | undefined): CulturalIdentity | null {
    return id ? this.cultures.get(id) ?? null : null;
  }
  public all(): CulturalIdentity[] { return [...this.cultures.values()]; }

  public create(
    name: string,
    year: number,
    homeCityId: string | null,
    parent: CulturalIdentity | null = null,
    lean: CulturalLean = {}
  ): CulturalIdentity {
    const identity: CulturalIdentity = {
      id: `cult_${(this.counter++).toString(36)}`,
      name,
      parentId: parent?.id ?? null,
      foundedYear: year,
      homeCityId,
      lineageDepth: (parent?.lineageDepth ?? -1) + 1,
      // A branch keeps most of what it came from and drifts a little.
      lean: parent ? driftLean(parent.lean) : lean
    };
    this.cultures.set(identity.id, identity);
    return identity;
  }

  /** True when this culture descends from `ancestorId`, at any depth. */
  public descendsFrom(id: string | null, ancestorId: string): boolean {
    let current = this.get(id);
    let guard = 0;
    while (current && guard++ < 12) {
      if (current.id === ancestorId) return true;
      current = this.get(current.parentId);
    }
    return false;
  }

  /**
   * How alien two cultures are to each other, 0..1.
   *
   * Branches of the same trunk are close; unrelated cultures are far. This is
   * what makes assimilating into a sibling culture easy and assimilating into a
   * stranger slow, without anyone writing a compatibility table.
   */
  public distance(a: string | null, b: string | null): number {
    if (!a || !b) return 1;
    if (a === b) return 0;
    const left = this.lineage(a);
    const right = this.lineage(b);
    for (let i = 0; i < left.length; i++) {
      const shared = right.indexOf(left[i]);
      if (shared >= 0) return Math.min(1, (i + shared) * 0.28);
    }
    return 1;
  }

  private lineage(id: string): string[] {
    const chain: string[] = [];
    let current = this.get(id);
    let guard = 0;
    while (current && guard++ < 12) { chain.push(current.id); current = this.get(current.parentId); }
    return chain;
  }

  public serialize(): { counter: number; cultures: CulturalIdentity[] } {
    return { counter: this.counter, cultures: this.all() };
  }

  public deserialize(data: { counter?: number; cultures?: CulturalIdentity[] } | null | undefined): void {
    this.cultures.clear();
    this.counter = data?.counter ?? 0;
    for (const identity of data?.cultures ?? []) this.cultures.set(identity.id, identity);
  }

  public clear(): void { this.cultures.clear(); this.counter = 0; }
}

function driftLean(lean: CulturalLean): CulturalLean {
  const drifted: CulturalLean = {};
  for (const [key, value] of Object.entries(lean) as [keyof CulturalLean, number][]) {
    drifted[key] = clamp(value + (rng.next() - 0.5) * 0.2, -0.4, 0.4);
  }
  return drifted;
}

// ============================================================
// TUNING
// ============================================================

/**
 * Hard ceiling on how many cultures may exist.
 *
 * Not a balance value — a cost ceiling. Every settlement caches a share table
 * keyed by culture, so an unbounded registry means unbounded per-city state.
 */
export const MAX_CULTURES = 48;

/** A settlement needs at least this many people before it can birth a culture. */
export const EMERGENCE_POPULATION = 25;
/** And the situation has to have held for at least this many years. */
export const EMERGENCE_YEARS = 40;
/** A hybrid needs both parents to be at least this large a share of the town. */
export const HYBRID_MIN_SHARE = 0.25;
/** A colonial branch needs this much of the town to be locally rooted. */
export const DIVERGENCE_ROOTED_SHARE = 0.55;

/** Yearly rate at which living among another culture wears off on someone. */
const ASSIMILATION_BASE = 0.05;
/** Absorbed local influence above which a citizen may actually change identity. */
const ASSIMILATION_THRESHOLD = 0.85;

// ============================================================
// CITIZENS
// ============================================================

/**
 * A child's culture: mostly the family's, partly the street's.
 *
 * Parents dominate, but a child raised in a town where their family's culture is
 * a small minority is genuinely likely to grow up belonging to the majority
 * instead. That single probability is what turns migration into assimilation
 * over generations without any assimilation system existing.
 */
export function inheritCulture(
  father: Entity | null,
  mother: Entity | null,
  localMix: CultureMix,
  localDominant: string | null
): { cultureId: string; localAffinity: number } {
  const family = mother?.cultureId || father?.cultureId || localDominant || '';
  const localShare = localDominant ? localMix[localDominant] ?? 0 : 0;

  // The family's own standing where they live. A household that is part of the
  // majority passes its culture on almost untouched.
  const familyShare = localMix[family] ?? 0;
  const pullToLocal = localDominant && localDominant !== family
    ? localShare * (1 - familyShare) * 0.55
    : 0;

  // Parents who have themselves absorbed the place make it likelier still.
  const parentAffinity = Math.max(mother?.localAffinity ?? 0, father?.localAffinity ?? 0);
  const chance = Math.min(0.8, pullToLocal + parentAffinity * 0.25);

  if (localDominant && chance > 0 && rng.chance(chance)) {
    return { cultureId: localDominant, localAffinity: 0.2 };
  }
  // A child of the minority still starts life half-steeped in the place.
  return { cultureId: family, localAffinity: Math.min(0.6, parentAffinity * 0.5 + localShare * 0.3) };
}

/**
 * One year of living among other people.
 *
 * Assimilation is gradual and never automatic. It depends on how outnumbered the
 * citizen's culture is, how culturally distant the local majority is, how long
 * they have been there, and how settled the place is. Someone can spend a whole
 * life absorbing a town and still die belonging to where they came from — their
 * children are the ones who change.
 *
 * Returns the culture the citizen now belongs to, which is usually their old one.
 */
export function assimilate(
  entity: Entity,
  localMix: CultureMix,
  localDominant: string | null,
  registry: CultureRegistry,
  stability: number
): string {
  if (!localDominant || localDominant === entity.cultureId) {
    // Living among your own slowly undoes any drift.
    entity.localAffinity = Math.max(0, entity.localAffinity - 0.03);
    return entity.cultureId;
  }

  const ownShare = localMix[entity.cultureId] ?? 0;
  const localShare = localMix[localDominant] ?? 0;
  // Distance between cultures damps everything: joining a sibling branch is easy,
  // joining a stranger is slow.
  const closeness = 1 - registry.distance(entity.cultureId, localDominant);

  const rate = ASSIMILATION_BASE
    * (localShare - ownShare > 0 ? localShare - ownShare : 0.15)
    * (0.4 + closeness * 1.2)
    * (0.5 + stability * 0.8);

  entity.localAffinity = Math.min(1, entity.localAffinity + rate);

  // Even fully absorbed, a first-generation newcomer keeps their identity. It is
  // the generation that grew up here that flips.
  if (entity.localAffinity >= ASSIMILATION_THRESHOLD && entity.localGenerations >= 1 && rng.chance(0.25)) {
    entity.localAffinity = 0.5;
    return localDominant;
  }
  return entity.cultureId;
}

// ============================================================
// SETTLEMENTS
// ============================================================

/** Accumulates a settlement's cultural composition during an existing walk. */
export class CultureCensus {
  private readonly counts = new Map<string, Map<string, number>>();
  private readonly totals = new Map<string, number>();
  private readonly rooted = new Map<string, number>();

  public count(cityId: string, cultureId: string, isRooted: boolean): void {
    let byCulture = this.counts.get(cityId);
    if (!byCulture) { byCulture = new Map(); this.counts.set(cityId, byCulture); }
    byCulture.set(cultureId, (byCulture.get(cultureId) ?? 0) + 1);
    this.totals.set(cityId, (this.totals.get(cityId) ?? 0) + 1);
    if (isRooted) this.rooted.set(cityId, (this.rooted.get(cityId) ?? 0) + 1);
  }

  public mixFor(cityId: string): { mix: CultureMix; dominant: string | null; counted: number; rootedShare: number } {
    const byCulture = this.counts.get(cityId);
    const total = this.totals.get(cityId) ?? 0;
    if (!byCulture || total === 0) return { mix: {}, dominant: null, counted: 0, rootedShare: 0 };

    const mix: CultureMix = {};
    let dominant: string | null = null;
    let best = 0;
    for (const [cultureId, count] of byCulture) {
      const share = count / total;
      mix[cultureId] = share;
      if (share > best) { best = share; dominant = cultureId; }
    }
    return { mix, dominant, counted: total, rootedShare: (this.rooted.get(cityId) ?? 0) / total };
  }

  public cityIds(): string[] { return [...this.counts.keys()]; }
}

// ============================================================
// EMERGENCE
// ============================================================

export interface EmergenceContext {
  cityId: string;
  cityName: string;
  year: number;
  population: number;
  mix: CultureMix;
  dominant: string | null;
  /** Share of residents whose line is generations deep here. */
  rootedShare: number;
  /** How long the settlement has been culturally settled, in years. */
  yearsStable: number;
  /** True when this settlement is politically separate from the culture's home. */
  isolated: boolean;
}

export type EmergenceKind = 'hybrid' | 'divergence';

export interface Emergence {
  kind: EmergenceKind;
  identity: CulturalIdentity;
  /** The culture(s) the new one grew out of. */
  fromIds: string[];
}

/**
 * Decides whether a settlement has earned a culture of its own.
 *
 * Two ways, and both are deliberately hard to reach. A small mixed town does not
 * invent an identity; a colony does not stop being of the old country the moment
 * it is founded. Population, time and stability are all required, because
 * without all three every busy port in the world would spawn a culture.
 */
export function considerEmergence(
  ctx: EmergenceContext,
  registry: CultureRegistry
): Emergence | null {
  if (registry.size >= MAX_CULTURES) return null;
  if (ctx.population < EMERGENCE_POPULATION) return null;
  if (ctx.yearsStable < EMERGENCE_YEARS) return null;
  if (!ctx.dominant) return null;

  // --- Hybrid: two large populations that have lived together a long time.
  const large = Object.entries(ctx.mix)
    .filter(([, share]) => share >= HYBRID_MIN_SHARE)
    .sort((a, b) => b[1] - a[1]);
  if (large.length >= 2) {
    const [first, second] = large;
    // Never out of an existing hybrid of the same pair — one blending is enough.
    const parent = registry.get(first[0]);
    const other = registry.get(second[0]);
    if (parent && other && !registry.descendsFrom(parent.id, other.id) && !registry.descendsFrom(other.id, parent.id)) {
      const name = `${shortName(parent.name)}-${shortName(other.name)} de ${ctx.cityName}`;
      const identity = registry.create(name, ctx.year, ctx.cityId, parent, blendLean(parent.lean, other.lean));
      return { kind: 'hybrid', identity, fromIds: [parent.id, other.id] };
    }
  }

  // --- Divergence: one culture, far from home, generations deep, on its own.
  if (ctx.isolated && ctx.rootedShare >= DIVERGENCE_ROOTED_SHARE) {
    const parent = registry.get(ctx.dominant);
    if (parent && parent.homeCityId !== ctx.cityId && parent.lineageDepth < 4) {
      const identity = registry.create(`${shortName(parent.name)} de ${ctx.cityName}`, ctx.year, ctx.cityId, parent);
      return { kind: 'divergence', identity, fromIds: [parent.id] };
    }
  }

  return null;
}

function shortName(name: string): string {
  return name.split(' de ')[0].split('-')[0];
}

function blendLean(a: CulturalLean, b: CulturalLean): CulturalLean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof CulturalLean>;
  const blended: CulturalLean = {};
  for (const key of keys) blended[key] = ((a[key] ?? 0) + (b[key] ?? 0)) / 2;
  return blended;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
