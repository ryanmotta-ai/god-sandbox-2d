import { Entity } from '../entities/Entity';
import { SpeciesType, SPECIES_DEFINITIONS } from '../entities/Species';
import { TraitId, TRAIT_DEFINITIONS } from '../entities/Traits';
import { rng } from '../core/Random';

/**
 * Families, bloodlines and inheritance.
 *
 * Children are born to a specific pair, inherit traits from both parents, and
 * carry a family name. Once a realm has a crown, that family name becomes the
 * dynasty and succession follows it.
 */

const DYNASTY_ROOTS: Record<SpeciesType, string[]> = {
  // Houses named for a place, a trade or a deed, as human dynasties tend to be.
  [SpeciesType.HUMAN]: [
    'Valmont', 'Ashford', 'Duarte', 'Ravenna', 'Castellan', 'Almeida',
    'Thornbury', 'Sarmento', 'Vasconcelos', 'Halloran', 'Beaumont', 'Ferreiro'
  ],
  [SpeciesType.DEER]: ['Fawnwood'],
  [SpeciesType.WOLF]: ['Fangmoor'],
  [SpeciesType.BEAR]: ['Grimclaw'],
  [SpeciesType.DRAGON]: ['Wyrmscale'],
  [SpeciesType.BOAR]: ['Ironbristle'],
  [SpeciesType.EAGLE]: ['Skysoar'],
  [SpeciesType.MAMMOTH]: ['Frosttusk']
};

export function generateDynastyName(species: SpeciesType): string {
  return rng.pick(DYNASTY_ROOTS[species] ?? ['Nameless']);
}

export interface DeceasedEntityRecord {
  id: string;
  name: string;
  dynasty: string;
  fullName: string;
  species: SpeciesType;
  gender: 'male' | 'female';
  birthYear: number;
  deathYear: number;
  ageAtDeath: number;
  profession: string;
  title: string | null;
  isGreatPerson: boolean;
  /** Explicitly marked worth keeping (SOC-V3). Exempt from ancestor pruning. */
  historic?: boolean;
  fatherId: string | null;
  motherId: string | null;
  partnerId: string | null;
  childrenIds: string[];
  generation: number;
  isDeceased: true;
}

export type FamilyMember = Entity | DeceasedEntityRecord;

export interface FamilyTreeData {
  target: FamilyMember;
  father: FamilyMember | null;
  mother: FamilyMember | null;
  partner: FamilyMember | null;
  children: FamilyMember[];
  siblings: FamilyMember[];
  grandparents: FamilyMember[];
  generation: number;
  dynasty: string;
}

export function isDeceasedRecord(member: FamilyMember): member is DeceasedEntityRecord {
  return (member as DeceasedEntityRecord).isDeceased === true;
}

export function getFamilyTreeData(
  targetId: string,
  entities: Entity[],
  deceasedMap: Map<string, DeceasedEntityRecord>
): FamilyTreeData | null {
  const findMember = (id: string | null): FamilyMember | null => {
    if (!id) return null;
    const active = entities.find(e => e.id === id);
    if (active) return active;
    return deceasedMap.get(id) ?? null;
  };

  const target = findMember(targetId);
  if (!target) return null;

  const father = findMember(target.fatherId);
  const mother = findMember(target.motherId);
  const partner = findMember(target.partnerId);

  const children = target.childrenIds.map(cid => findMember(cid)).filter((m): m is FamilyMember => m !== null);

  // Siblings: share father or mother
  const siblingsSet = new Set<string>();
  const siblings: FamilyMember[] = [];

  if (target.fatherId || target.motherId) {
    for (const e of entities) {
      if (e.id !== target.id) {
        if ((target.fatherId && e.fatherId === target.fatherId) || (target.motherId && e.motherId === target.motherId)) {
          if (!siblingsSet.has(e.id)) { siblingsSet.add(e.id); siblings.push(e); }
        }
      }
    }
    for (const d of deceasedMap.values()) {
      if (d.id !== target.id) {
        if ((target.fatherId && d.fatherId === target.fatherId) || (target.motherId && d.motherId === target.motherId)) {
          if (!siblingsSet.has(d.id)) { siblingsSet.add(d.id); siblings.push(d); }
        }
      }
    }
  }

  // Grandparents: parents of father and mother
  const grandparents: FamilyMember[] = [];
  if (father) {
    const f1 = findMember(father.fatherId); if (f1) grandparents.push(f1);
    const f2 = findMember(father.motherId); if (f2) grandparents.push(f2);
  }
  if (mother) {
    const m1 = findMember(mother.fatherId); if (m1) grandparents.push(m1);
    const m2 = findMember(mother.motherId); if (m2) grandparents.push(m2);
  }

  return {
    target,
    father,
    mother,
    partner,
    children,
    siblings,
    grandparents,
    generation: target.generation,
    dynasty: target.dynasty
  };
}

/** How closely two entities are related. Used to prevent incestuous pairings. */
export function areRelated(a: Entity, b: Entity): boolean {
  if (a.id === b.id) return true;
  if (a.fatherId && a.fatherId === b.fatherId) return true;
  if (a.motherId && a.motherId === b.motherId) return true;
  if (a.childrenIds.includes(b.id) || b.childrenIds.includes(a.id)) return true;
  if (a.fatherId === b.id || a.motherId === b.id) return true;
  if (b.fatherId === a.id || b.motherId === a.id) return true;
  return false;
}

/** Two entities may marry if they are fertile, unattached, unrelated and of the same species. */
export function canPairWith(a: Entity, b: Entity): boolean {
  if (a.species !== b.species) return false;
  if (a.gender === b.gender) return false;
  if (a.partnerId || b.partnerId) return false;
  if (areRelated(a, b)) return false;

  const maxAge = SPECIES_DEFINITIONS[a.species].maxAge;
  return a.isFertile(maxAge) && b.isFertile(maxAge);
}

export function formPartnership(a: Entity, b: Entity): void {
  a.partnerId = b.id;
  b.partnerId = a.id;

  // The couple settles on one family name — whichever line already has standing,
  // otherwise a new one is founded.
  const name = a.dynasty || b.dynasty || generateDynastyName(a.species);
  a.dynasty = name;
  b.dynasty = name;
}

export function dissolvePartnership(entity: Entity, partner: Entity | undefined): void {
  if (partner && partner.partnerId === entity.id) partner.partnerId = null;
  entity.partnerId = null;
}

export interface BirthResult {
  child: Entity;
  inheritedTraits: TraitId[];
}

/**
 * Produces a child from two parents.
 * Traits pass down probabilistically at each trait's own inherit chance, and a
 * small chance of spontaneous mutation keeps the gene pool from stagnating.
 */
export function conceiveChild(
  father: Entity,
  mother: Entity,
  x: number,
  y: number,
  makeId: () => string
): BirthResult {
  const child = new Entity(makeId(), mother.species, x, y);

  child.fatherId = father.id;
  child.motherId = mother.id;
  child.dynasty = father.dynasty || mother.dynasty || generateDynastyName(mother.species);
  child.generation = Math.max(father.generation, mother.generation) + 1;
  child.cityId = mother.cityId ?? father.cityId;
  child.kingdomId = mother.kingdomId ?? father.kingdomId;

  // Born as an infant, not a fully grown adult.
  child.age = 0;
  child.profession = 'none';

  // Trait inheritance from both parents.
  const inherited: TraitId[] = [];
  const parentTraits = new Set<TraitId>([...father.traits, ...mother.traits]);
  for (const trait of parentTraits) {
    const def = TRAIT_DEFINITIONS[trait];
    if (!def) continue;
    // A trait carried by both parents is far more likely to pass on.
    const bothCarry = father.traits.has(trait) && mother.traits.has(trait);
    const chance = bothCarry ? Math.min(0.95, def.inheritChance * 2.2) : def.inheritChance;
    if (rng.chance(chance)) {
      child.addTrait(trait);
      inherited.push(trait);
    }
  }

  // Rare spontaneous mutation.
  if (rng.chance(0.04)) {
    const allTraits = Object.keys(TRAIT_DEFINITIONS) as TraitId[];
    const mutation = rng.pick(allTraits);
    if (!child.traits.has(mutation)) {
      child.addTrait(mutation);
      inherited.push(mutation);
    }
  }

  // Personality leans toward a parent's, but is not fixed by it.
  child.personality = rng.chance(0.6) ? rng.pick([father.personality, mother.personality]) : child.personality;

  child.recalculateStats();
  child.hp = child.maxHp;

  father.childrenIds.push(child.id);
  mother.childrenIds.push(child.id);

  // Parents cannot conceive again immediately.
  // Cooldowns applied only after birth, not at conception.
  // The caller (EntityAI.tickAge) handles cooldowns once the child
  // is actually born from pregnancy.

  return { child, inheritedTraits: inherited };
}

/**
 * Picks the next ruler when a crown falls vacant.
 *
 * `bloodline` succession prefers the dead ruler's children, then their dynasty,
 * then falls back to the strongest subject. `election` picks the most capable
 * adult regardless of birth. `strongest` is raw might.
 */
export function chooseSuccessor(
  deceasedRulerId: string | null,
  dynasty: string,
  candidates: Entity[],
  mode: 'bloodline' | 'election' | 'strongest'
): Entity | null {
  const adults = candidates.filter(e => !e.isChild && e.hp > 0);
  if (adults.length === 0) return null;

  const merit = (e: Entity) => e.level * 100 + e.kills * 5 + e.age;

  if (mode === 'bloodline' && deceasedRulerId) {
    // Direct heirs first.
    const heirs = adults.filter(e => e.fatherId === deceasedRulerId || e.motherId === deceasedRulerId);
    if (heirs.length > 0) {
      return heirs.sort((a, b) => b.age - a.age)[0];
    }
    // Then anyone of the same house.
    const kin = adults.filter(e => dynasty && e.dynasty === dynasty);
    if (kin.length > 0) {
      return kin.sort((a, b) => merit(b) - merit(a))[0];
    }
  }

  if (mode === 'election') {
    // Elections favour experience and standing over raw combat power.
    return adults.sort((a, b) => (b.level * 60 + b.age * 3) - (a.level * 60 + a.age * 3))[0];
  }

  return adults.sort((a, b) => merit(b) - merit(a))[0];
}

/** Summary of a family, shown in the inspector. */
export interface FamilySummary {
  father: Entity | null;
  mother: Entity | null;
  partner: Entity | null;
  children: Entity[];
  siblings: Entity[];
}

export function buildFamilySummary(entity: Entity, lookup: (id: string) => Entity | undefined): FamilySummary {
  const father = entity.fatherId ? lookup(entity.fatherId) ?? null : null;
  const mother = entity.motherId ? lookup(entity.motherId) ?? null : null;
  const partner = entity.partnerId ? lookup(entity.partnerId) ?? null : null;
  const children = entity.childrenIds.map(lookup).filter((e): e is Entity => !!e);

  const siblings: Entity[] = [];
  for (const parent of [father, mother]) {
    for (const siblingId of parent?.childrenIds ?? []) {
      if (siblingId === entity.id) continue;
      const sibling = lookup(siblingId);
      if (sibling && !siblings.some(s => s.id === sibling.id)) siblings.push(sibling);
    }
  }

  return { father, mother, partner, children, siblings };
}
