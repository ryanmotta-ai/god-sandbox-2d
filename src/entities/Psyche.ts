/**
 * The inner life of a citizen: disposition, what they remember, and who they know.
 *
 * SOC-V2. The layers below this one already give a person a body, a job, a house
 * and a family. What they did not have was a reason to answer the same situation
 * differently from the person standing next to them. A famine emptied every
 * pantry at once and produced one identical reaction; a war reached every street
 * at once and produced another.
 *
 * Nothing here decides anything on its own. It supplies the three inputs the
 * existing decision points were missing — a persistent disposition, a short
 * memory of what has already happened to this person, and the handful of people
 * they actually care about — and the callers weigh those against the situation
 * they can already see. That is deliberately the whole contribution: the spread
 * between two citizens has to come from their histories differing, not from a
 * wider dice roll.
 *
 * Everything is a plain number or a small array, because all of it is saved and
 * all of it is touched once per simulated year for every person alive.
 */

/**
 * Seven dispositions, each 0..1, fixed for life and inherited by children.
 *
 * Kept few and numeric on purpose. Every one of them is read by at least one
 * real decision — a trait nothing branches on is decoration, and decoration is
 * what made `personality` a label the simulation never consulted.
 */
export interface Psyche {
  /** Willingness to face danger rather than leave. Read when war arrives. */
  courage: number;
  /** Appetite for company. Drives socialising and how fast bonds form. */
  sociability: number;
  /** Appetite for a better position. Drives changing jobs and leaving for more. */
  ambition: number;
  /** Readiness to answer a threat with violence rather than distance. */
  aggression: number;
  /** Weight given to kin and to the place they already belong to. */
  loyalty: number;
  /** Pull toward the unknown — exploring, and settling somewhere untried. */
  curiosity: number;
  /** How much uncertainty they will accept for a gain. Distinct from courage:
   *  courage faces a danger in front of them, this one accepts an unknown. */
  riskTolerance: number;
}

export const PSYCHE_KEYS: readonly (keyof Psyche)[] = [
  'courage', 'sociability', 'ambition', 'aggression', 'loyalty', 'curiosity', 'riskTolerance'
];

/** A roll in [0,1). Always the simulation's seeded stream, never Math.random. */
export type Roll = () => number;

/**
 * A fresh disposition.
 *
 * Drawn from the average of two rolls rather than one, so the population centres
 * on the middling and the extremes stay rare. A world where a third of everyone
 * is fearless reads as noise; one where the fearless are unusual reads as people.
 */
export function createPsyche(roll: Roll): Psyche {
  const trait = () => (roll() + roll()) / 2;
  return {
    courage: trait(),
    sociability: trait(),
    ambition: trait(),
    aggression: trait(),
    loyalty: trait(),
    curiosity: trait(),
    riskTolerance: trait()
  };
}

/**
 * A child's disposition: the parents' average, pulled toward the middle and
 * nudged by chance.
 *
 * The pull toward 0.5 matters more than it looks. Without it, a line of
 * courageous ancestors breeds a village of the uniformly fearless within a few
 * generations and the spread this whole file exists to create quietly collapses.
 */
export function inheritPsyche(father: Psyche | null, mother: Psyche | null, roll: Roll): Psyche {
  if (!father && !mother) return createPsyche(roll);
  const blend = {} as Psyche;
  for (const key of PSYCHE_KEYS) {
    const a = father?.[key] ?? mother![key];
    const b = mother?.[key] ?? father![key];
    const mid = (a + b) / 2;
    const drifted = mid * 0.7 + 0.5 * 0.15 + (roll() - 0.5) * 0.3;
    blend[key] = clamp01(drifted);
  }
  return blend;
}

// ============================================================
// MEMORY
// ============================================================

/**
 * The kinds of thing a person carries with them.
 *
 * A closed list, because memory has to stay cheap enough to hold for every
 * citizen alive and because each kind has to be read somewhere — an event no
 * decision consults is not worth remembering.
 */
export type MemoryKind =
  | 'bereavement'   // lost someone in the family
  | 'war_survived'  // lived through an enemy at the gate
  | 'battle'        // personally fought
  | 'moved'         // left a settlement behind
  | 'lost_home'     // the roof was destroyed or taken
  | 'jobless'       // a year with no work
  | 'famine'        // a year of real hunger
  | 'fire'          // burned, or watched the town burn
  | 'prospered';    // a genuinely good year

export interface Memory {
  kind: MemoryKind;
  /** Simulated year it happened, for the UI and for age-of-memory checks. */
  year: number;
  /** 0..1. Starts at the severity of the event and fades every year after. */
  weight: number;
}

/** Hard cap. A person is not a log file — the oldest, faintest entry falls off. */
export const MEMORY_CAP = 6;

/**
 * Yearly retention per kind.
 *
 * Trauma outlives good news. Someone who lost a home to a war twenty years ago
 * still leaves early; someone who had one good harvest has long since stopped
 * factoring it in.
 */
const MEMORY_RETENTION: Record<MemoryKind, number> = {
  bereavement: 0.94,
  war_survived: 0.93,
  battle: 0.92,
  lost_home: 0.93,
  fire: 0.90,
  famine: 0.88,
  moved: 0.85,
  jobless: 0.80,
  prospered: 0.78
};

/** Below this a memory no longer changes any decision, so it is dropped. */
const MEMORY_FLOOR = 0.06;

/**
 * Records an event, or deepens one already there.
 *
 * A second famine makes the first one worse rather than taking a second slot:
 * repeated hardship should read as one heavier scar, not as two shallow ones
 * competing for the cap with everything else.
 */
export function remember(memories: Memory[], kind: MemoryKind, year: number, severity: number): void {
  const weight = clamp01(severity);
  if (weight < MEMORY_FLOOR) return;

  const existing = memories.find(m => m.kind === kind);
  if (existing) {
    existing.weight = clamp01(existing.weight + weight * 0.6);
    existing.year = year;
    return;
  }

  memories.push({ kind, year, weight });
  if (memories.length > MEMORY_CAP) {
    let weakest = 0;
    for (let i = 1; i < memories.length; i++) if (memories[i].weight < memories[weakest].weight) weakest = i;
    memories.splice(weakest, 1);
  }
}

/** One year of forgetting. Returns the surviving memories. */
export function decayMemories(memories: Memory[]): Memory[] {
  let write = 0;
  for (let read = 0; read < memories.length; read++) {
    const memory = memories[read];
    memory.weight *= MEMORY_RETENTION[memory.kind] ?? 0.85;
    if (memory.weight >= MEMORY_FLOOR) memories[write++] = memory;
  }
  memories.length = write;
  return memories;
}

/** How strongly a specific kind is still felt, 0..1. */
export function memoryOf(memories: Memory[], kind: MemoryKind): number {
  for (const memory of memories) if (memory.kind === kind) return memory.weight;
  return 0;
}

/**
 * Everything bad this person is still carrying, 0..1.
 *
 * Summed and then compressed rather than averaged, so someone who lost a house
 * *and* a family member is measurably worse off than someone who lost one, but
 * a long list never saturates into a citizen who is simply broken forever.
 */
export function traumaLoad(memories: Memory[]): number {
  let total = 0;
  for (const memory of memories) {
    if (memory.kind === 'prospered') continue;
    total += memory.weight;
  }
  return total / (total + 1.4);
}

// ============================================================
// RELATIONS
// ============================================================

/**
 * Someone this person actually knows, beyond their own family.
 *
 * Family is already recorded on the entity itself (parents, partner, children),
 * so this holds only the ties that would otherwise need a social graph: the
 * friend, the rival, the neighbour whose opinion carries weight. Capped hard —
 * a full graph over thousands of citizens is exactly the cost SOC-V2 is not
 * allowed to pay.
 */
export interface Bond {
  id: string;
  kind: 'friend' | 'rival';
  /** 0..1. Grows with contact, fades without it. */
  strength: number;
}

/** Hard cap per citizen. Beyond this the weakest tie is forgotten. */
export const BOND_CAP = 4;

/** Strengthens an existing tie or opens a new one, evicting the weakest. */
export function bondWith(bonds: Bond[], id: string, kind: 'friend' | 'rival', amount: number): void {
  const existing = bonds.find(b => b.id === id);
  if (existing) {
    // A tie that keeps being reinforced the other way eventually flips. People
    // who fall out stop being friends rather than accumulating two records.
    if (existing.kind === kind) existing.strength = clamp01(existing.strength + amount);
    else {
      existing.strength -= amount;
      if (existing.strength <= 0) { existing.kind = kind; existing.strength = amount; }
    }
    return;
  }

  bonds.push({ id, kind, strength: clamp01(amount) });
  if (bonds.length > BOND_CAP) {
    let weakest = 0;
    for (let i = 1; i < bonds.length; i++) if (bonds[i].strength < bonds[weakest].strength) weakest = i;
    bonds.splice(weakest, 1);
  }
}

/** One year of drift apart. Ties nobody maintains quietly lapse. */
export function decayBonds(bonds: Bond[]): Bond[] {
  let write = 0;
  for (let read = 0; read < bonds.length; read++) {
    const bond = bonds[read];
    bond.strength *= 0.88;
    if (bond.strength >= 0.08) bonds[write++] = bond;
  }
  bonds.length = write;
  return bonds;
}

// ============================================================
// DECISIONS
// ============================================================

/**
 * Everything a citizen weighs, gathered by the caller that can actually see it.
 *
 * Passed as plain numbers rather than as the entity, so the arithmetic below can
 * be read, tested and tuned without dragging the world in behind it.
 */
export interface LifeSituation {
  /** 0..1 aggregate wellbeing — see `wellbeing`. */
  wellbeing: number;
  /** True when this adult has no job slot at all. */
  jobless: number;
  /** 0..100, straight off the needs block. */
  hunger: number;
  /** 0..1 danger where they stand: war, siege, predators. */
  danger: number;
  /** 0..1 how much family is anchored to this place. */
  familyTies: number;
  /**
   * 0..1 how many generations of this line were born here (SOC-V3).
   *
   * Separate from `familyTies` on purpose: ties are the relatives alive right
   * now, this is the place itself having a claim. A colonist's grandchild can
   * have no living kin left and still belong somewhere.
   */
  rootedness?: number;
  /** 0..1 how much better somewhere else looks. */
  opportunityElsewhere: number;
  /** 0..1 how much they are still carrying from before. */
  trauma: number;
  /** Years lived. The young move; the old have more to unpick. */
  age: number;
}

/**
 * How strongly this person wants to be somewhere else, 0..1.
 *
 * This is the function SOC-V2's whole "hundred citizens, hundred answers" test
 * turns on, so every term is a pressure a person could actually name: I am
 * hungry, I have no work, it is dangerous here, there is better elsewhere —
 * against — my family is here, I belong here, I am too old to start again.
 *
 * The disposition never appears alone. It only scales a pressure that already
 * exists, which is why two identical dispositions in different circumstances
 * still diverge, and why the spread survives without widening the dice.
 */
export function migrationUrge(p: Psyche, s: LifeSituation): number {
  // Push: reasons to leave. Hunger and danger are felt by everyone, but the
  // risk-averse feel danger harder and the loyal discount all of it.
  const hungerPush = clamp01(s.hunger / 100) * 0.55;
  const dangerPush = s.danger * (0.35 + (1 - p.riskTolerance) * 0.55);
  const joblessPush = s.jobless * (0.25 + p.ambition * 0.5);
  const miseryPush = Math.max(0, 0.55 - s.wellbeing) * 0.7;
  // Having been driven out once makes leaving thinkable the next time.
  const fledBefore = s.trauma * 0.25;

  // Pull: reasons to go somewhere specific rather than merely away.
  const opportunityPull = s.opportunityElsewhere * (0.2 + p.ambition * 0.45 + p.curiosity * 0.3);

  // Anchors.
  const kinAnchor = s.familyTies * (0.3 + p.loyalty * 0.6);
  // Belonging is partly disposition and partly how long the family has been
  // here. A third-generation local leaves harder than the settler who arrived —
  // which is precisely how a colony stops being an outpost.
  const belongingAnchor = (p.loyalty * 0.3) + (s.rootedness ?? 0) * (0.1 + p.loyalty * 0.25);
  // Uprooting is a young person's move. By sixty it takes a real crisis.
  const ageAnchor = clamp01((s.age - 22) / 45) * 0.35;

  const push = hungerPush + dangerPush + joblessPush + miseryPush + fledBefore + opportunityPull;
  const hold = kinAnchor + belongingAnchor + ageAnchor;
  return clamp01(push - hold);
}

/**
 * The odds this person stands their ground instead of running, 0..1.
 *
 * Called at the moment a threat is visible, so the observable facts — how
 * outnumbered, whether they are holding anything — dominate, and disposition
 * decides between two people looking at the same odds.
 */
export function standGroundChance(
  p: Psyche,
  s: { outnumbered: number; armed: boolean; protectingFamily: boolean; trauma: number; isFighter: boolean }
): number {
  if (s.isFighter) return 1;

  let stand = 0.1 + p.courage * 0.5 + p.aggression * 0.2;
  if (s.armed) stand += 0.2;
  // Someone with family at their back does not simply run, whatever they are.
  if (s.protectingFamily) stand += 0.12 + p.loyalty * 0.2;
  // Being outnumbered is the fact everyone can see, and it dominates everything.
  stand -= clamp01(s.outnumbered / 3) * 0.55;
  // Having survived one war makes the next one easier to read and harder to face.
  stand -= s.trauma * 0.2;
  return clamp01(stand);
}

/** Whether this person would take the risk of hunting rather than go without. */
export function huntWillingness(p: Psyche, hunger: number): number {
  return clamp01(p.courage * 0.35 + p.riskTolerance * 0.3 + clamp01(hunger / 100) * 0.45);
}

/**
 * One number for how well life is going, 0..1.
 *
 * Deliberately derived rather than stored, for the same reason `socialClass` is:
 * a satisfaction value that is written in one place and read in another drifts
 * out of step with the needs that are supposed to produce it. POL-V2 can average
 * this across a settlement when it wants a public mood.
 */
export function wellbeing(s: {
  hunger: number; comfort: number; safety: number; social: number;
  hasJob: boolean; hasHome: boolean; hasFamily: boolean; trauma: number;
}): number {
  const fed = 1 - clamp01(s.hunger / 100);
  const value =
    fed * 0.3 +
    clamp01(s.comfort / 100) * 0.14 +
    clamp01(s.safety / 100) * 0.2 +
    clamp01(s.social / 100) * 0.1 +
    (s.hasJob ? 0.11 : 0) +
    (s.hasHome ? 0.08 : 0) +
    (s.hasFamily ? 0.07 : 0);
  return clamp01(value - s.trauma * 0.2);
}

/** A short human-readable reason, for the citizen inspector and the chronicle. */
export function describePsyche(p: Psyche): string {
  const labels: [keyof Psyche, string, string][] = [
    ['courage', 'Corajoso', 'Medroso'],
    ['sociability', 'Sociável', 'Reservado'],
    ['ambition', 'Ambicioso', 'Contente'],
    ['aggression', 'Agressivo', 'Brando'],
    ['loyalty', 'Leal', 'Desapegado'],
    ['curiosity', 'Curioso', 'Caseiro'],
    ['riskTolerance', 'Audacioso', 'Cauteloso']
  ];
  // The two dispositions furthest from the middle are the ones that actually
  // show in behaviour, so they are the two worth naming.
  return labels
    .map(([key, high, low]) => ({ text: p[key] >= 0.5 ? high : low, distance: Math.abs(p[key] - 0.5) }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 2)
    .map(entry => entry.text)
    .join(', ');
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
