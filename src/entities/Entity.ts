import { SpeciesType, SPECIES_DEFINITIONS } from './Species';
import { TraitId, TRAIT_DEFINITIONS } from './Traits';
import { Profession, PersonalityType, AIState, EntityNeeds, createNeeds } from './Needs';
import { SocialClass, deriveSocialClass, startingWealthFor } from './Identity';
import type { GoodId } from '../civ/Goods';
import { HasPosition } from '../core/SpatialHash';
import { rng, hashString, hashToUnit } from '../core/Random';

/**
 * Given names for citizens. Deliberately plain and human — the chronicle reads
 * better when the person who founded a city is called Mariana than Vulth.
 */
const HUMAN_GIVEN_NAMES = [
  'Adela', 'Afonso', 'Alda', 'Almir', 'Amara', 'Anselmo', 'Aurora', 'Baltasar',
  'Beatriz', 'Bento', 'Brígida', 'Caetano', 'Camila', 'Cosme', 'Dinis', 'Elvira',
  'Emídio', 'Ester', 'Fabiano', 'Filipa', 'Gaspar', 'Genoveva', 'Gilberto', 'Guiomar',
  'Heitor', 'Helena', 'Inácio', 'Isaura', 'Joana', 'Jorge', 'Leonor', 'Lourenço',
  'Lucrécia', 'Manuel', 'Mariana', 'Martim', 'Matilde', 'Nuno', 'Ofélia', 'Osvaldo',
  'Petra', 'Rafael', 'Rosalina', 'Rodrigo', 'Sancha', 'Sebastião', 'Teodora', 'Tomás',
  'Úrsula', 'Valentim', 'Vicente', 'Violante', 'Xavier', 'Zulmira'
];

export class Entity implements HasPosition {
  public id: string;
  public name: string;
  public species: SpeciesType;
  public age: number;
  public gender: 'male' | 'female';

  public x: number;
  public y: number;
  public targetX: number | null = null;
  public targetY: number | null = null;
  /**
   * Renderer cache: ground covered on foot, in tiles. Drives the walk cycle so
   * a stride is a stride and never a fixed cadence the body outruns.
   */
  public renderWalked: number = 0;
  public prevX: number = 0;
  public prevY: number = 0;
  public facing: number = 1; // 1 = right, -1 = left
  public facingAngle: number = 0; // Movement direction angle in radians
  public stuckTicks: number = 0;

  /**
   * Fixed per-citizen sideways bias, in tiles, applied when walking toward a
   * destination. Deterministic from `id` so it never flickers frame to frame —
   * it's why two neighbours walking the same errand take slightly different
   * lines instead of sharing one pixel-perfect path.
   */
  public laneOffset: number = 0;
  /** Eased ground speed (tiles/tick), ramping toward the requested speed instead of snapping to it. */
  public currentSpeed: number = 0;
  /** Ticks remaining on a brief "checking the way" pause before setting off on a new errand. */
  public hesitationTicks: number = 0;

  public hp: number;
  public maxHp: number;
  public damage: number;
  public defense: number;
  public speed: number;

  public level: number = 1;
  public xp: number = 0;
  public kills: number = 0;

  public traits: Set<TraitId> = new Set();
  public profession: Profession = 'none';
  public personality: PersonalityType = 'peaceful';

  /** AI behavioral state machine */
  public aiState: AIState = 'idle';
  /** Ticks until AI re-evaluates state */
  public aiCooldown: number = 0;
  /** Combat attack cooldown (prevents rapid hits) */
  public attackCooldown: number = 0;
  /** Visual status emote displayed above entity (e.g. 🪓, 🌾, ⛏️, ⚔️, 😴, ❤️) */
  public emote: string | null = null;
  /** Ticks remaining for the current emote display */
  public emoteTimer: number = 0;

  /** Energy / Stamina (0 = exhausted, 100 = full) */
  public energy: number = 100;
  public maxEnergy: number = 100;

  /** Building ID this citizen is assigned to work at. */
  public workplaceId: string | null = null;
  /** Home position (city center ± offset), assigned when job is taken. */
  public homeX: number | null = null;
  public homeY: number | null = null;
  /** Consecutive jitter escapes without reaching target. */
  public _jitterFailures: number = 0;

  /** Great Person Ascension & Historic Title */
  public isGreatPerson: boolean = false;
  public greatPersonType: 'scholar' | 'builder' | 'hero' | 'diplomat' | null = null;
  public title: string | null = null;

  public kingdomId: string | null = null;
  public cityId: string | null = null;

  // ============ IDENTITY (layer 1) ============
  /** Year this citizen was born. `age` is kept in step with it. */
  public birthYear: number = 1;
  /** Settlement this citizen was born in — not always where they live now. */
  public birthCityId: string | null = null;
  /** Kept as a name too, because the birth city may not outlive the person. */
  public birthCityName: string = '';
  /** The house this citizen actually lives in, when one has been claimed. */
  public homeBuildingId: string | null = null;
  /** Household (family economic unit) this citizen belongs to. */
  public householdId: string | null = null;
  /** Personal coin. Wages come in here, purchases go out of here. */
  public wealth: number = 0;

  // ============ NEEDS (layer 4) ============
  /** Hunger, comfort and safety. Ticked once per in-world day. */
  public needs: EntityNeeds = createNeeds();
  /** Days in a row spent starving. Drives real harm rather than instant death. */
  public starvingDays: number = 0;

  // ============ REAL WORK (layer 3) ============
  /** What this citizen is physically carrying back to the settlement. */
  public carrying: { good: GoodId; amount: number } | null = null;

  // ============ FAMILY ============
  public fatherId: string | null = null;
  public motherId: string | null = null;
  /** Current life partner. Couples raise children together. */
  public partnerId: string | null = null;
  public childrenIds: string[] = [];
  /** Family name. Royal children inherit the dynasty and with it a claim. */
  public dynasty: string = '';
  /** Years before this entity can conceive again. */
  public fertilityCooldown: number = 0;
  /** Pregnancy timer in years (0 = not pregnant, >0 = months remaining) */
  public isPregnant: boolean = false;
  public pregnancyTimer: number = 0;
  /** Pregnancy father ID */
  public pregnantFatherId: string | null = null;
  /** Generations from the world's first settlers. */
  public generation: number = 1;

  public isFavorite: boolean = false;
  public inventory: Record<string, number> = { wood: 0, stone: 0, food: 0 };
  public equipment: { weapon?: any; armor?: any } = {};
  /** Hunter id is retained until the death pass turns a carcass into food. */
  public huntedById: string | null = null;
  /** 0..1 annual environmental food stress, managed by ECO-V3. */
  public ecologyHunger: number = 0;

  constructor(id: string, species: SpeciesType, x: number, y: number, name?: string) {
    this.id = id;
    this.species = species;
    this.x = x;
    this.y = y;
    this.laneOffset = (hashToUnit(hashString(id)) - 0.5) * 0.7;

    const config = SPECIES_DEFINITIONS[species];
    this.name = name ?? this.generateName(species);
    this.gender = rng.chance(0.5) ? 'male' : 'female';
    this.age = rng.rangeInt(16, 30);

    this.maxHp = config.baseHp;
    this.damage = config.baseDamage;
    this.defense = config.baseDefense;
    this.speed = config.baseSpeed;

    this.personality = rng.pick(['ambitious', 'diplomatic', 'aggressive', 'paranoid', 'peaceful', 'greedy']);
    this.wealth = startingWealthFor(this.profession, (min, max) => rng.rangeInt(min, max));

    // Random initial trait
    if (rng.chance(0.35)) {
      const traitList = Object.keys(TRAIT_DEFINITIONS) as TraitId[];
      this.addTrait(rng.pick(traitList));
    }

    this.recalculateStats();
    this.hp = this.maxHp;
  }

  public showEmote(emoji: string, durationTicks: number = 25): void {
    this.emote = emoji;
    this.emoteTimer = durationTicks;
  }

  public addTrait(traitId: TraitId): void {
    this.traits.add(traitId);
    this.recalculateStats();
  }

  public removeTrait(traitId: TraitId): void {
    this.traits.delete(traitId);
    this.recalculateStats();
  }

  public recalculateStats(): void {
    const config = SPECIES_DEFINITIONS[this.species];
    let hpMultiplier = 1;
    let speedMultiplier = 1;
    let damageMultiplier = 1;
    let defenseMultiplier = 1;

    for (const traitId of this.traits) {
      const def = TRAIT_DEFINITIONS[traitId];
      if (def) {
        if (def.hpMod) hpMultiplier *= def.hpMod;
        if (def.speedMod) speedMultiplier *= def.speedMod;
        if (def.damageMod) damageMultiplier *= def.damageMod;
        if (def.defenseMod) defenseMultiplier *= def.defenseMod;
      }
    }

    // Level scaling
    const levelBonus = 1 + (this.level - 1) * 0.1;

    // Life stage scaling — infants and children are much weaker than adults.
    const stage = this.lifeStageMultiplier;

    // Equipment bonus
    const eqWeaponDmg = this.equipment.weapon?.damageBonus || 0;
    const eqArmorDef = this.equipment.armor?.defenseBonus || 0;
    const eqHpBonus = (this.equipment.weapon?.hpBonus || 0) + (this.equipment.armor?.hpBonus || 0);

    this.maxHp = Math.round(config.baseHp * hpMultiplier * levelBonus * stage.hp + eqHpBonus);
    this.speed = config.baseSpeed * speedMultiplier * stage.speed;
    this.damage = Math.round(config.baseDamage * damageMultiplier * levelBonus * stage.damage + eqWeaponDmg);
    this.defense = Math.round(config.baseDefense * defenseMultiplier * stage.hp + eqArmorDef);

    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  public gainXp(amount: number): boolean {
    this.xp += amount;
    if (this.xp >= this.level * 50) {
      this.xp -= this.level * 50;
      this.level++;
      this.recalculateStats();
      this.hp = this.maxHp;
      return true; // Leveled up!
    }
    return false;
  }

  /** Adults of breeding age (18+). Children and the elderly do not pair off. */
  public isFertile(maxAge: number): boolean {
    return !this.isPregnant && this.age >= 18 && this.age <= maxAge * 0.7 && this.fertilityCooldown <= 0 && this.hp > this.maxHp * 0.5;
  }

  /** Stage multipliers for stats — babies are fragile, adolescents nearly full-grown. */
  public get lifeStageMultiplier(): { hp: number; damage: number; speed: number } {
    switch (this.lifeStage) {
      case 'infant':  return { hp: 0.15, damage: 0.10, speed: 0.30 };
      case 'child':   return { hp: 0.40, damage: 0.30, speed: 0.50 };
      case 'adolescent': return { hp: 0.70, damage: 0.60, speed: 0.80 };
      case 'adult':   return { hp: 1.00, damage: 1.00, speed: 1.00 };
      case 'elder':   return { hp: 0.85, damage: 0.90, speed: 0.70 };
    }
  }

  public get lifeStage(): 'infant' | 'child' | 'adolescent' | 'adult' | 'elder' {
    const maxAge = SPECIES_DEFINITIONS[this.species]?.maxAge ?? 80;
    if (this.age <= 2) return 'infant';
    if (this.age <= 12) return 'child';
    if (this.age <= 17) return 'adolescent';
    if (this.age > maxAge * 0.75) return 'elder';
    return 'adult';
  }

  public get lifeStageLabel(): string {
    switch (this.lifeStage) {
      case 'infant': return 'Bebê 👶';
      case 'child': return 'Criança 🎈';
      case 'adolescent': return 'Adolescente 📖';
      case 'adult': return 'Adulto 🧑';
      case 'elder': return 'Idoso 👴';
    }
  }

  public get isChild(): boolean {
    return this.age < 18;
  }

  /** Full name including the family line, once dynasties exist. */
  public get fullName(): string {
    return this.dynasty ? `${this.name} ${this.dynasty}` : this.name;
  }

  /** Standing in the social order. Derived so it tracks wealth and job exactly. */
  public get socialClass(): SocialClass {
    return deriveSocialClass(this);
  }

  /** True once this citizen has claimed a real house rather than a spot of ground. */
  public get hasHome(): boolean {
    return this.homeBuildingId !== null;
  }

  private generateName(species: SpeciesType): string {
    // People get whole names; animals get the syllable-and-suffix treatment, so
    // a wolf reads as a beast and a citizen reads as someone you could talk to.
    if (species === SpeciesType.HUMAN) {
      return rng.pick(HUMAN_GIVEN_NAMES);
    }
    const prefixes: Partial<Record<SpeciesType, string[]>> = {
      [SpeciesType.DEER]: ['Bambi', 'Cervo'],
      [SpeciesType.WOLF]: ['Presa', 'Sombra'],
      [SpeciesType.BEAR]: ['Garra', 'Urso'],
      [SpeciesType.DRAGON]: ['Ignis', 'Pyroth'],
      [SpeciesType.BOAR]: ['Chifre', 'Marfim'],
      [SpeciesType.EAGLE]: ['Águia', 'Rasante'],
      [SpeciesType.MAMMOTH]: ['Marfim', 'Gelo']
    };
    const suffixes = ['is', 'or', 'an', 'us', 'ia', 'en', 'os', 'th', 'ar'];
    const p = rng.pick(prefixes[species] ?? ['An']);
    const s = rng.pick(suffixes);
    return p + s;
  }
}
