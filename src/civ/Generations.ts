/**
 * What passes from one generation to the next.
 *
 * SOC-V3. SOC-V2 gave a citizen an inner life; this gives a *family* a history.
 * People already had parents, a birthplace and a purse — but none of it survived
 * them. A citizen died and their coin vanished, their house emptied, their trade
 * was forgotten, and their children started from nothing in a world that had no
 * memory of where the family came from. Every line began identically, so no line
 * could ever rise or fall.
 *
 * Four things move down the generations here, and nothing else:
 *
 *   an estate  — coin, a roof and a job slot, settled on real heirs;
 *   an origin  — the settlement the family came from, distinct from where its
 *                children happen to be born, and how many generations deep the
 *                line is in the place it lives now;
 *   a trade    — a leaning, never an obligation;
 *   a mark     — the very largest of a parent's memories, carried faintly.
 *
 * All four are a few fields on the entity that already exists. There is no family
 * object, no genealogical tree, no probate. A family is simply the set of people
 * who share a dynasty name and a set of ids — which is what it already was.
 */

import type { Entity } from '../entities/Entity';
import type { Profession } from '../entities/Needs';
import { remember, type Memory, type MemoryKind } from '../entities/Psyche';
import type { Household } from './Household';

// ============================================================
// ORIGIN AND ROOTEDNESS
// ============================================================

/**
 * How many generations of a line born in the same settlement counts as fully
 * rooted there. Chosen so a colony's third native generation belongs to it as
 * completely as anyone in the old country — which is the specific case SOC-V3
 * exists to set up for CULT-V1.
 */
export const ROOTED_GENERATIONS = 3;

/**
 * Records where a newborn's family is from, and how deep it now is where it
 * lives.
 *
 * The origin is inherited, not observed: a child born in a colony to parents
 * from the metropole is *of* the metropole in the first generation and of the
 * colony by the third. That is the whole mechanism behind colonial identity, and
 * it costs two strings and a counter.
 */
export function inheritOrigin(child: Entity, father: Entity | null, mother: Entity | null): void {
  const parent = mother ?? father;
  if (!parent) {
    child.originCityId = child.birthCityId;
    child.originCityName = child.birthCityName;
    child.localGenerations = 1;
    return;
  }

  // The family origin is the ancestral one, carried forward unchanged. Only a
  // line with no recorded origin at all adopts the place it was born.
  child.originCityId = parent.originCityId ?? parent.birthCityId ?? child.birthCityId;
  child.originCityName = parent.originCityName || parent.birthCityName || child.birthCityName;

  // Depth in the *current* settlement. A generation born where its parents
  // already lived goes one deeper; a generation born somewhere new starts over.
  // A parent who moved here themselves is at depth 0 — see `uproot` — so their
  // first child born here is the first generation of the line in this place.
  const bornWhereParentsLive = !!child.birthCityId && child.birthCityId === parent.cityId;
  child.localGenerations = bornWhereParentsLive
    ? Math.min(ROOTED_GENERATIONS + 2, parent.localGenerations + 1)
    : 1;
}

/**
 * Clears a citizen's depth of line when they move.
 *
 * Someone who emigrates is, by definition, not from where they now live —
 * however many generations their family spent in the town they left. Without
 * this the depth counter follows people around and every settlement is instantly
 * full of natives, which is precisely backwards for a colony.
 */
export function uproot(entity: Entity): void {
  entity.localGenerations = 0;
}

/** 0..1 attachment to the settlement this citizen lives in, from depth of line. */
export function rootedness(entity: Entity): number {
  return Math.min(1, entity.localGenerations / ROOTED_GENERATIONS);
}

/** True when this citizen's family came from somewhere other than where they live. */
export function isOfMigrantStock(entity: Entity): boolean {
  return !!entity.originCityId && !!entity.cityId && entity.originCityId !== entity.cityId;
}

// ============================================================
// GENERATIONAL MEMORY
// ============================================================

/**
 * The events large enough to outlive the person they happened to.
 *
 * Deliberately short. A child does not inherit their parent's bad year at work;
 * they inherit that the family lost its home in a war, because that is the kind
 * of thing a household still talks about twenty years later.
 */
const HEREDITARY_MARKS: readonly MemoryKind[] = ['lost_home', 'war_survived', 'famine', 'moved'];
/** A parent's memory must be at least this strong to be worth passing on. */
const MARK_THRESHOLD = 0.5;
/** And it arrives much fainter than it was lived. */
const MARK_ATTENUATION = 0.45;

/**
 * Passes a family's scars, not a parent's diary.
 *
 * Attenuated hard and filtered to four kinds, so a line that has been through
 * something leans measurably more cautious for a generation or two and then
 * stops — the ordinary SOC-V2 decay does the forgetting, exactly as it does for
 * a memory the citizen earned themselves.
 */
export function inheritFamilyMarks(child: Entity, father: Entity | null, mother: Entity | null): void {
  const strongest = new Map<MemoryKind, number>();
  for (const parent of [father, mother]) {
    for (const memory of parent?.memories ?? []) {
      if (!HEREDITARY_MARKS.includes(memory.kind) || memory.weight < MARK_THRESHOLD) continue;
      strongest.set(memory.kind, Math.max(strongest.get(memory.kind) ?? 0, memory.weight));
    }
  }
  for (const [kind, weight] of strongest) {
    remember(child.memories, kind, child.birthYear, weight * MARK_ATTENUATION);
  }
}

// ============================================================
// INHERITANCE
// ============================================================

export interface Estate {
  /** Who received something, in the order they were considered. */
  heirs: Entity[];
  coin: number;
  /** Set when an heir took over the deceased's job. */
  trade: Profession | null;
  home: boolean;
}

/**
 * Settles what a dead citizen leaves behind.
 *
 * Order of claim is the one every inheritance system in history starts from and
 * needs no law to justify: the surviving spouse, then the children, then the
 * house. Anything with no heir at all falls to the household still living under
 * the roof, and if there is nobody there either it is simply gone — a family can
 * die out, and that has to be one of the ways a line ends.
 *
 * There is no probate, no will and no court. The whole estate is a number, a
 * building id and a job slot.
 */
export function settleEstate(
  dead: Entity,
  lookup: (id: string | null | undefined) => Entity | null,
  household: Household | null,
  workplaceStillOpen: boolean
): Estate {
  const estate: Estate = { heirs: [], coin: dead.wealth, trade: null, home: false };
  if (estate.coin <= 0 && !dead.homeBuildingId && !dead.workplaceId) return estate;

  const partner = lookup(dead.partnerId);
  const children = dead.childrenIds
    .map(id => lookup(id))
    .filter((child): child is Entity => !!child && child.hp > 0 && child.cityId === dead.cityId);

  // The spouse first, then children, eldest first — an eldest child is the one
  // most likely to be adult, employable and able to hold a house together.
  const claimants: Entity[] = [];
  if (partner && partner.hp > 0 && partner.cityId === dead.cityId) claimants.push(partner);
  claimants.push(...children.sort((a, b) => b.age - a.age));

  if (claimants.length === 0) {
    // No heir. What was theirs is split between whoever still lives in the house.
    const survivors = [...(household?.memberIds ?? [])]
      .map(id => lookup(id))
      .filter((member): member is Entity => !!member && member.hp > 0 && member !== dead);
    if (survivors.length > 0) {
      const each = estate.coin / survivors.length;
      for (const survivor of survivors) survivor.wealth += each;
    }
    dead.wealth = 0;
    return estate;
  }

  // Coin divides evenly. Splitting rather than primogeniture matters: it is why
  // a large family disperses a fortune and a small one concentrates it, which is
  // most of what makes a line rise or fall without any rule saying so.
  const share = estate.coin / claimants.length;
  for (const heir of claimants) {
    heir.wealth += share;
    estate.heirs.push(heir);
  }
  dead.wealth = 0;

  /**
   * The house passes to whoever is actually living in it, or failing that to the
   * first claimant who has no better one.
   *
   * The cohabitation case used to be missed entirely: this looked only for an
   * heir with `!homeBuildingId`, and a child is born under their mother's roof
   * with `homeBuildingId` already set. So the one person who unambiguously lives
   * in the house — the son who never left home — failed the test, no inheritance
   * was recorded, and `estate.home` stayed false. The caller then never added
   * anyone to the building's resident list, and the family home was released as
   * vacant with the family still inside it.
   */
  const successorHome =
    claimants.find(heir => dead.homeBuildingId && heir.homeBuildingId === dead.homeBuildingId) ??
    claimants.find(heir => !heir.homeBuildingId);
  if (dead.homeBuildingId && successorHome) {
    successorHome.homeBuildingId = dead.homeBuildingId;
    successorHome.homeX = dead.homeX;
    successorHome.homeY = dead.homeY;
    estate.home = true;
  }

  // The trade passes to an adult heir with nothing better going on, and only if
  // the workplace still exists to be worked. This is family continuity as an
  // opportunity, never as an obligation — an heir who already has a job keeps it.
  const successor = claimants.find(heir => !heir.isChild && heir.profession === 'none');
  if (successor && workplaceStillOpen && dead.workplaceId) {
    successor.profession = dead.profession;
    successor.workplaceId = dead.workplaceId;
    estate.trade = dead.profession;
  }

  // The family's trade is remembered whether or not anyone took it up this time,
  // so a grandchild can still be drawn to what the house has always done.
  if (dead.profession !== 'none') {
    for (const heir of claimants) if (heir.familyTrade === 'none') heir.familyTrade = dead.profession;
  }

  return estate;
}

/**
 * How much of a head start this citizen's family gives them, 0..1.
 *
 * Read when a young adult takes their first job. It is a probability, never a
 * guarantee, and it is bounded well below 1 so that the child of a rich house
 * is advantaged rather than destined — which is the difference between social
 * mobility and a caste system.
 */
export function familyAdvantage(entity: Entity, familyWealthPerHead: number): number {
  return Math.min(0.75, (Math.max(0, familyWealthPerHead) + entity.wealth) / 260);
}

// ============================================================
// DEMOGRAPHY
// ============================================================

/**
 * Light aggregates over the living, for the interface and for whatever reads
 * population pressure later.
 *
 * Accumulated during a pass that was already walking every citizen, never by a
 * scan of its own. Everything here is derived and none of it is saved.
 */
export interface Demographics {
  year: number;
  population: number;
  children: number;
  adults: number;
  elders: number;
  meanAge: number;
  households: number;
  /** Citizens whose family came from another settlement. */
  migrantStock: number;
  /** Citizens whose line is ROOTED_GENERATIONS deep where they live. */
  rooted: number;
  /** Mean generation number — how many lifetimes deep the world is. */
  meanGeneration: number;
  /** Relocations recorded in the year this snapshot covers. */
  relocations: number;
  births: number;
  deaths: number;
  /** Mean personal coin, the number social mobility actually moves. */
  meanWealth: number;
}

export function emptyDemographics(): Demographics {
  return {
    year: 0, population: 0, children: 0, adults: 0, elders: 0, meanAge: 0,
    households: 0, migrantStock: 0, rooted: 0, meanGeneration: 0,
    relocations: 0, births: 0, deaths: 0, meanWealth: 0
  };
}

/** Running totals, folded once per citizen inside an existing loop. */
export class DemographicsAccumulator {
  private readonly totals = emptyDemographics();
  private ageSum = 0;
  private generationSum = 0;
  private wealthSum = 0;

  public count(entity: Entity): void {
    this.totals.population++;
    this.ageSum += entity.age;
    this.generationSum += entity.generation;
    this.wealthSum += entity.wealth;
    if (entity.isChild) this.totals.children++;
    else if (entity.lifeStage === 'elder') this.totals.elders++;
    else this.totals.adults++;
    if (isOfMigrantStock(entity)) this.totals.migrantStock++;
    if (entity.localGenerations >= ROOTED_GENERATIONS) this.totals.rooted++;
  }

  public finish(year: number, households: number, births: number, deaths: number, relocations: number): Demographics {
    const people = Math.max(1, this.totals.population);
    return {
      ...this.totals,
      year,
      households,
      births,
      deaths,
      relocations,
      meanAge: this.ageSum / people,
      meanGeneration: this.generationSum / people,
      meanWealth: this.wealthSum / people
    };
  }
}

// ============================================================
// THE DEAD
// ============================================================

/**
 * How many ordinary dead are kept as ancestor records.
 *
 * The genealogy map used to grow without limit, which over a long game is an
 * unbounded leak in the one structure guaranteed to only ever get bigger. The
 * cap is generous enough that a player can walk back several generations of any
 * living family, and the people history actually turns on are exempt from it.
 */
export const ANCESTOR_LIMIT = 600;

/** The shape the retention policy needs. Anything richer is the caller's business. */
export interface AncestorLike {
  isGreatPerson: boolean;
  historic?: boolean;
  title: string | null;
  profession: string;
}

/** True for the dead worth keeping forever: rulers, great persons, the marked. */
export function isHistoric(record: AncestorLike): boolean {
  return record.isGreatPerson || !!record.historic || !!record.title
    || record.profession === 'king' || record.profession === 'leader';
}

/**
 * Forgets the ordinary dead once there are too many of them, oldest first.
 *
 * Insertion order is death order, so the map's own iteration order is already
 * the right one — no sort, no timestamps, no second index.
 */
export function pruneAncestors<T extends AncestorLike>(
  ancestors: Map<string, T>,
  limit: number = ANCESTOR_LIMIT
): number {
  if (ancestors.size <= limit) return 0;
  let removed = 0;
  for (const [id, record] of ancestors) {
    if (ancestors.size - removed <= limit) break;
    if (isHistoric(record)) continue;
    ancestors.delete(id);
    removed++;
  }
  return removed;
}

/** Re-exported so callers handling marks do not need to import from two places. */
export type { Memory };
