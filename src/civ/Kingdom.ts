import { SpeciesType } from '../entities/Species';
import { rng } from '../core/Random';
import { Stockpile, GoodId } from './Goods';
import { ResearchState, type TechCapability, type TechEra } from './TechTree';
import { GovernmentType, GOVERNMENTS, GovernmentDefinition } from './Government';
import { KingdomEconomy } from './Economy';
import { CulturalProfile, createCulturalProfile, deserializeCulturalProfile } from './Culture';
import { SocietyProfile, createSocietyProfile, deserializeSocietyProfile } from './Society';
import type { City } from './City';
import { CompactTerritory } from '../world/CompactTerritory';
import { RealmTrait, realmEffects, realmTraitsOf } from './RealmTraits';
import { traitOfRuler, type RulerTrait } from './Rulers';

// Kingdom emblem IDs for pixel-art badge rendering
export const KINGDOM_EMBLEMS = ['swords', 'shield', 'lion', 'eagle', 'dragon', 'fire', 'lightning', 'moon', 'sun', 'gem', 'castle', 'leaf'] as const;

const NAME_PREFIXES = ['Kingdom of', 'Empire of', 'Realm of', 'Dominion of', 'Republic of', 'Clan of'];
const NAME_ROOTS = [
  'Aethon', 'Valdris', 'Thundara', 'Solheim', 'Frostholm', 'Ironvale',
  'Ashenmoor', 'Crystalfall', 'Dawnspire', 'Shadowfen', 'Stormreach', 'Goldcrest',
  'Thornwood', 'Emberveil', 'Moonhaven', 'Starfell', 'Dragonclaw', 'Stonekeep',
  'Brighthollow', 'Nightbloom', 'Sunridge', 'Deepforge', 'Windhowl', 'Flamecrest'
];

/** Titles a realm takes as its government changes. */
const REALM_TITLES: Partial<Record<GovernmentType, string>> = {
  tribe: 'Clan of',
  chiefdom: 'Clan of',
  feudal_kingdom: 'Kingdom of',
  monarchy: 'Kingdom of',
  empire: 'Empire of',
  constitutional_monarchy: 'Kingdom of',
  republic: 'Republic of',
  capitalist_state: 'Free State of',
  communist_state: "People's Republic of"
};

export function generateKingdomName(): string {
  const prefix = NAME_PREFIXES[Math.floor(rng.next() * NAME_PREFIXES.length)];
  const root = NAME_ROOTS[Math.floor(rng.next() * NAME_ROOTS.length)];
  return `${prefix} ${root}`;
}

const KINGDOM_COLORS = [

  '#e74c3c', '#2ecc71', '#3498db', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#2980b9', '#c0392b', '#27ae60',
  '#8e44ad', '#d35400', '#16a085', '#f1c40f', '#e84393',
  '#00cec9', '#6c5ce7', '#fdcb6e', '#e17055', '#00b894'
];

let colorIndex = 0;
export function getNextKingdomColor(): string {
  const color = KINGDOM_COLORS[colorIndex % KINGDOM_COLORS.length];
  colorIndex++;
  return color;
}

export interface WarReparations {
  creditorId: string;
  annualAmount: number;
  endYear: number;
}

export type DoctrineType = 
  | 'infantry_focus'
  | 'cavalry_focus'
  | 'archery_focus'
  | 'artillery_focus'
  | 'balanced'
  | 'defensive'
  | 'guerrilla';

export type MilitaryTradition =
  | 'shield_wall'
  | 'phalanx'
  | 'heavy_cavalry'
  | 'horse_archers'
  | 'longbow_mastery'
  | 'crossbow_discipline'
  | 'siege_engineering'
  | 'scorched_earth'
  | 'guerrilla_tactics'
  | 'fortification_mastery'
  | 'conscription'
  | 'professional_army';

export interface MilitaryDoctrine {
  type: DoctrineType;
  name: string;
  preferredComposition: {
    infantry: number;
    cavalry: number;
    archers: number;
    artillery: number;
  };
  trainingBonus: number;
  experienceLevel: number;
  traditions: MilitaryTradition[];
  evolvedFromTech: string | null;
}

export function createDefaultDoctrine(namePrefix = ''): MilitaryDoctrine {
  return {
    type: 'balanced',
    name: namePrefix ? `Doutrina de ${namePrefix}` : 'Doutrina de Armas Combinadas',
    preferredComposition: {
      infantry: 0.45,
      cavalry: 0.20,
      archers: 0.25,
      artillery: 0.10
    },
    trainingBonus: 0.05,
    experienceLevel: 0.1,
    traditions: ['shield_wall'],
    evolvedFromTech: null
  };
}

/**
 * A realm remains the political unit used by diplomacy, territory and cities.
 * Colonial realms use the same unit, with an explicit constitutional link to
 * their metropole instead of being disguised as a distant city or a vassal.
 */
export type ColonialStatus = 'COLONY' | 'AUTONOMOUS_COLONY' | 'INDEPENDENT';
export type ColonialAccess = 'maritime' | 'overland' | null;
export type SeparatistMovement = 'none' | 'organizing' | 'revolt';

export class Kingdom {
  public id: string;
  public name: string;
  public color: string;
  public species: SpeciesType;
  public capitalCityId: string;
  public rulerId: string | null = null;
  public cityIds: Set<string> = new Set();
  public foundingYear: number;

  public warReparations: WarReparations | null = null;

  public emblem: string;
  public secondaryColor: string;
  public rgbColor: { r: number; g: number; b: number };
  public cachedRgba18: string;
  public cachedRgba45: string;
  public cachedRgbaBorder: string;
  public cachedCenter: { x: number; y: number } = { x: 64, y: 64 };

  /** Territory tile count, refreshed each macro tick. */
  public territorySize: number = 0;
  public totalPopulation: number = 0;
  public militaryPower: number = 0;
  public warWeariness: number = 0;
  /** 0..1 - public belief that the current order has a right to rule. */
  public legitimacy: number = 0.7;
  /** 0..1 - how well the capital can actually administer far-flung cities. */
  public administrativeReach: number = 1;
  /**
   * How devout the realm is, 0..1.
   *
   * There was no religion in this world at all. Temples were filed under
   * `knowledge`, produced research points, and their own description — "a place
   * to petition whoever is holding the brush" — described a system that did not
   * exist. A god sandbox in which the god's worshippers are a research building
   * is missing its subject.
   *
   * Faith is what a population's relationship to the hand on the brush actually
   * does to a realm: it legitimises a crown that has no other claim, it keeps the
   * clergy loyal, and it holds a hungry settlement together for one more winter
   * than reason would. It is grown by temples and by divine attention, and it
   * decays wherever both are absent.
   */
  public faith: number = 0.2;
  /** Faith won or lost by the god's own acts, decaying year on year. */
  public divineFavour: number = 0;
  /** 0..1 - strategic reserve and reliability of food supply. */
  public foodSecurity: number = 1;
  /** 0..1 - pressure from stronger neighbours and active enemies. */
  public externalThreat: number = 0;
  /** 0..1 - how much the realm depends on imported goods and trade income. */
  public tradeDependency: number = 0;
  /** Collective values, memories and social temperament of the realm. */
  public culture: CulturalProfile;
  /** Internal social factions and their political pressure. */
  public society: SocietyProfile;
  /** Current legal code: taxes, rights, land, trade, army, labour and reforms. */
  /**
   * What kind of realm this is, derived rather than stored.
   *
   * Read off the government and whoever is on the throne, so it can never drift
   * out of step with either. `rulerTrait` is set by whoever last looked at the
   * king; a realm with no king on record behaves as a cautious one.
   */
  public rulerTrait: RulerTrait = 'peaceful';

  public get realmTraits(): RealmTrait[] {
    return realmTraitsOf(this.government, this.rulerTrait);
  }

  // ============ WARFARE & MILITARY STRATEGY (WAR-V1 & WAR-V6) ============
  public armyIds: Set<string> = new Set();
  public militaryUpkeepGold: number = 0;
  public militaryUpkeepFood: number = 0;
  public mercenaryCompanyIds: Set<string> = new Set();
  public commanderIds: Set<string> = new Set();
  public doctrine: MilitaryDoctrine;

  // ============ TRADE BALANCE & MERCANTILISM STATS ============
  public pirateRaidsDefeated: number = 0;

  // ============ DEEP SIMULATION STATE ============

  /** The national reserve — taxed from cities, spent on projects and trade. */
  public treasury: Stockpile = new Stockpile(4000);

  /** Gold in the till, by weight. */
  public get gold(): number {
    return this.treasury.get('gold');
  }

  /**
   * Puts gold in the till, returning what actually fitted.
   *
   * A stockpile has a capacity, so a realm can be too rich for its own vaults —
   * which is a real limit on a physical hoard and not a bug to route around.
   */
  public addGold(amount: number): number {
    if (amount <= 0) return 0;
    const stored = this.treasury.add('gold', amount);
    this.wealth = this.treasury.get('gold');
    return stored;
  }

  /** Takes gold out of the till, returning what was actually there to take. */
  public takeGold(amount: number): number {
    if (amount <= 0) return 0;
    const taken = this.treasury.take('gold', amount);
    this.wealth = this.treasury.get('gold');
    return taken;
  }
  public research: ResearchState = new ResearchState();
  public economy: KingdomEconomy = new KingdomEconomy();
  public government: GovernmentType = 'tribe';
  /** Year of the last government change, so realms don't flip-flop. */
  public governmentSince: number = 1;
  /** The ruling family name. Succession prefers this bloodline. */
  public dynasty: string = '';
  /** Realms this one has ever exchanged an envoy with. */
  public knownKingdoms: Set<string> = new Set();
  /** Realms that swore fealty to this one. */
  public vassalIds: Set<string> = new Set();
  /** Set when this realm is itself a vassal. */
  public overlordId: string | null = null;

  /** Constitutional state reserved for COL-V1 and later autonomy/independence work. */
  public colonialStatus: ColonialStatus = 'INDEPENDENT';
  /** Founding realm while this realm is a colonial subject; never uses vassalage. */
  public metropoleId: string | null = null;
  /** Colonial realms founded by this metropole. */
  public colonyIds: Set<string> = new Set();
  /** Route class that made the initial expedition viable. */
  public colonialAccess: ColonialAccess = null;
  /** 0..1 — local control over colonial affairs; 1 after independence. */
  public colonialAutonomy: number = 1;
  /** 0..1 — willingness to remain under the metropole's rule. */
  public colonialLoyalty: number = 1;
  /** 0..1 — accumulated constitutional and material conflict with the metropole. */
  public colonialTension: number = 0;
  /** 0..1 — distinct colonial political identity, built by time and distance. */
  public colonialIdentity: number = 1;
  /** Separatist organisation is stateful; escalation is driven by pressure, not a dice roll. */
  public separatistMovement: SeparatistMovement = 'none';
  public separatistSince: number | null = null;
  public revoltYear: number | null = null;
  /** Material and diplomatic aid supplied by outside powers during a revolt. */
  public foreignSupport: number = 0;

  /** Kept for the old culture-level display. Now derived from research. */
  public cultureLevel: number = 1;
  /** Legacy numeric wealth, mirrored from the economy treasury. */
  /**
   * The realm's gold, by weight, as a number for anything that only wants to
   * read it. The gold itself lives in `treasury` — this is a mirror kept in step
   * by `addGold`/`takeGold`, because power scores, the inspector and the AI all
   * want a plain number and none of them should reach into the stockpile.
   */
  public wealth: number = 100;

  constructor(id: string, name: string, species: SpeciesType, color: string, capitalCityId: string, foundingYear: number) {
    this.id = id;
    this.name = name;
    this.species = species;
    this.color = color;
    this.capitalCityId = capitalCityId;
    this.cityIds.add(capitalCityId);
    this.foundingYear = foundingYear;
    this.emblem = rng.pick([...KINGDOM_EMBLEMS]);
    this.secondaryColor = this.lightenColor(color, 40);
    this.governmentSince = foundingYear;
    this.culture = createCulturalProfile(species);
    this.society = createSocietyProfile();
    this.doctrine = createDefaultDoctrine(name);

    const num = parseInt(color.replace('#', ''), 16);
    this.rgbColor = {
      r: (num >> 16) & 0xff,
      g: (num >> 8) & 0xff,
      b: num & 0xff
    };
    this.cachedRgba18 = `rgba(${this.rgbColor.r}, ${this.rgbColor.g}, ${this.rgbColor.b}, 0.18)`;
    this.cachedRgba45 = `rgba(${this.rgbColor.r}, ${this.rgbColor.g}, ${this.rgbColor.b}, 0.45)`;
    this.cachedRgbaBorder = `rgba(${this.rgbColor.r}, ${this.rgbColor.g}, ${this.rgbColor.b}, 0.7)`;
  }

  // ============================ GOVERNMENT ============================

  public get governmentInfo(): GovernmentDefinition {
    return GOVERNMENTS[this.government];
  }

  public get rulerTitle(): string {
    return this.governmentInfo.rulerTitle;
  }

  public get isEmpire(): boolean {
    return this.government === 'empire';
  }

  public get isColony(): boolean {
    return this.colonialStatus === 'COLONY' || this.colonialStatus === 'AUTONOMOUS_COLONY';
  }

  /** Establish the non-vassal constitutional relation used by colonial realms. */
  public establishColony(metropoleId: string, access: Exclude<ColonialAccess, null>): void {
    this.colonialStatus = 'COLONY';
    this.metropoleId = metropoleId;
    this.colonialAccess = access;
    this.colonialAutonomy = 0.12;
    this.colonialLoyalty = 0.78;
    this.colonialTension = 0.08;
    this.colonialIdentity = 0.12;
    this.separatistMovement = 'none';
    this.separatistSince = null;
    this.revoltYear = null;
    this.foreignSupport = 0;
  }

  public addColony(colonyId: string): void {
    this.colonyIds.add(colonyId);
  }

  public removeColony(colonyId: string): void {
    this.colonyIds.delete(colonyId);
  }

  /**
   * Adopts a new government and renames the realm to match its new form.
   * Returns the old name so the chronicle can describe the transition.
   */
  public adoptGovernment(government: GovernmentType, year: number): string {
    const previousName = this.name;
    this.government = government;
    this.governmentSince = year;

    const title = REALM_TITLES[government];
    if (title) {
      const root = this.name.split(' ').pop() ?? 'Aethon';
      this.name = `${title} ${root}`;
    }
    return previousName;
  }

  // ============================ TECHNOLOGY IN PRACTICE ============================

  /**
   * Units of each good this realm's technology gives it a reason to want per
   * year. Empty in the stone age; it is what makes oil worth a war later.
   */
  public strategicDemand: Map<GoodId, number> = new Map();
  /** What the realm can actually operate, recomputed each year. */
  public techCapabilities: TechCapability[] = [];
  /**
   * The era the realm can really function at, which may lag the era it has
   * researched — knowing about factories is not the same as having one.
   */
  public operatingEra: TechEra = 'stone';

  /** Fraction of this realm's material technology it can actually put to work, 0..1. */
  public technologicalCapacity(): number {
    if (this.techCapabilities.length === 0) return 1;
    let sum = 0;
    for (const c of this.techCapabilities) sum += c.capacity;
    return sum / this.techCapabilities.length;
  }

  // ============================ TRADE POLICY ============================

  
  // ============================ POWER ============================

  /** Combined strength used for war resolution and the power ranking. */
  /**
   * The national effects of the Great Wonders, as their own descriptions promise.
   *
   * All four wonders were built, placed, rendered, protected from demolition and
   * scored by the district planner — and not one of their advertised bonuses
   * existed anywhere in the simulation. `MONUMENT_TYPES` announced "+30% realm
   * stability", "+50% national research", "+50% city capacity and harvest" and
   * "+30% military morale, reduces war exhaustion" to the player, and the code
   * behind them granted a pile of housing and a research figure. A wonder that
   * costs three hundred stone and a Great Person has to change the realm.
   *
   * Recomputed from the buildings each year rather than cached, so a ruined
   * wonder stops helping and a rebuilt one starts again.
   */
  public wonderEffects(cities: Map<string, City>): { stability: number; research: number; morale: number } {
    let stability = 1;
    let research = 1;
    let morale = 1;
    for (const cityId of this.cityIds) {
      const city = cities.get(cityId);
      if (!city) continue;
      for (const building of city.buildings.values()) {
        const share = building.operationalFactor();
        if (share <= 0) continue;
        if (building.type === 'monument') stability = Math.max(stability, 1 + 0.3 * share);
        if (building.type === 'great_library') research = Math.max(research, 1 + 0.5 * share);
        if (building.type === 'colosseum') morale = Math.max(morale, 1 + 0.3 * share);
      }
    }
    return { stability, research, morale };
  }

  public computePower(): number {
    const techMods = this.research.modifiers();
    const gov = this.governmentInfo;
    const base = this.totalPopulation * 2 + this.territorySize * 0.6 + this.cityIds.size * 25;
    const cohesion = 0.72 + this.legitimacy * 0.18 + this.administrativeReach * 0.18;
    const exhaustion = Math.max(0.65, 1 - this.warWeariness * 0.0025);
    const warCulture = 0.9 + this.culture.militarism * 0.15 + this.culture.authority * 0.08 - this.culture.warTrauma * 0.09;
    // A realm whose provinces are loyal musters more of them, and one whose
    // court is plotting musters less.
    const socialMobilisation = 0.88 + this.society.cohesion * 0.16 - this.society.coupRisk * 0.12;
    const lawMilitary = 1 + (realmEffects(this.realmTraits).military ?? 0);
    return Math.round(base * techMods.military * gov.military * cohesion * exhaustion * warCulture * socialMobilisation * lawMilitary);
  }

  /** Total territory this realm controls including its vassals' pledged land. */
  public effectiveTerritory(kingdoms: Map<string, Kingdom>): number {
    let total = this.territorySize;
    for (const vassalId of this.vassalIds) {
      total += kingdoms.get(vassalId)?.territorySize ?? 0;
    }
    return total;
  }

  // ============================ CITIES ============================

  public addCity(cityId: string): void {
    this.cityIds.add(cityId);
  }

  public removeCity(cityId: string): void {
    this.cityIds.delete(cityId);
  }

  /** Center of territory for badge placement. */
  public computeCenter(cities: Map<string, { x: number; y: number; territory: CompactTerritory | Set<string> }>): { x: number; y: number } {
    let totalX = 0;
    let totalY = 0;
    let count = 0;
    for (const cityId of this.cityIds) {
      const city = cities.get(cityId);
      if (city) {
        if (city.territory instanceof CompactTerritory) {
          city.territory.forEachXY((tx, ty) => {
            totalX += tx;
            totalY += ty;
            count++;
          });
        } else {
          for (const key of city.territory) {
            const [tx, ty] = key.split(',').map(Number);
            totalX += tx;
            totalY += ty;
            count++;
          }
        }
      }
    }
    if (count === 0) {
      this.cachedCenter = { x: 64, y: 64 };
      return this.cachedCenter;
    }
    this.cachedCenter = { x: Math.round(totalX / count), y: Math.round(totalY / count) };
    return this.cachedCenter;
  }

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + percent);
    const g = Math.min(255, ((num >> 8) & 0xff) + percent);
    const b = Math.min(255, (num & 0xff) + percent);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // ============================ PERSISTENCE ============================

  public serialize(): any {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      species: this.species,
      capitalCityId: this.capitalCityId,
      rulerId: this.rulerId,
      cityIds: Array.from(this.cityIds),
      foundingYear: this.foundingYear,
      emblem: this.emblem,
      territorySize: this.territorySize,
      totalPopulation: this.totalPopulation,
      warWeariness: this.warWeariness,
      legitimacy: this.legitimacy,
      administrativeReach: this.administrativeReach,
      faith: this.faith,
      divineFavour: this.divineFavour,
      foodSecurity: this.foodSecurity,
      externalThreat: this.externalThreat,
      tradeDependency: this.tradeDependency,
      culture: this.culture,
      society: this.society,
      rulerTrait: this.rulerTrait,
      treasury: this.treasury.serialize(),
      research: this.research.serialize(),
      economy: this.economy.serialize(),
      government: this.government,
      governmentSince: this.governmentSince,
      dynasty: this.dynasty,
      knownKingdoms: Array.from(this.knownKingdoms),
      vassalIds: Array.from(this.vassalIds),
      overlordId: this.overlordId,
      colonialStatus: this.colonialStatus,
      metropoleId: this.metropoleId,
      colonyIds: Array.from(this.colonyIds),
      colonialAccess: this.colonialAccess,
      colonialAutonomy: this.colonialAutonomy,
      colonialLoyalty: this.colonialLoyalty,
      colonialTension: this.colonialTension,
      colonialIdentity: this.colonialIdentity,
      separatistMovement: this.separatistMovement,
      separatistSince: this.separatistSince,
      revoltYear: this.revoltYear,
      foreignSupport: this.foreignSupport,
      cultureLevel: this.cultureLevel,
      wealth: this.wealth,
      pirateRaidsDefeated: this.pirateRaidsDefeated,
      armyIds: Array.from(this.armyIds),
      militaryUpkeepGold: this.militaryUpkeepGold,
      militaryUpkeepFood: this.militaryUpkeepFood,
      mercenaryCompanyIds: Array.from(this.mercenaryCompanyIds),
      commanderIds: Array.from(this.commanderIds),
      doctrine: this.doctrine
    };
  }

  public static deserialize(data: any): Kingdom {
    const kingdom = new Kingdom(data.id, data.name, data.species, data.color, data.capitalCityId, data.foundingYear);
    kingdom.rulerId = data.rulerId ?? null;
    kingdom.cityIds = new Set(data.cityIds ?? [data.capitalCityId]);
    if (data.emblem) kingdom.emblem = data.emblem;
    kingdom.territorySize = data.territorySize ?? 0;
    kingdom.totalPopulation = data.totalPopulation ?? 0;
    kingdom.warWeariness = data.warWeariness ?? 0;
    kingdom.legitimacy = data.legitimacy ?? 0.7;
    kingdom.administrativeReach = data.administrativeReach ?? 1;
    kingdom.faith = data.faith ?? 0.2;
    kingdom.divineFavour = data.divineFavour ?? 0;
    kingdom.foodSecurity = data.foodSecurity ?? 1;
    kingdom.externalThreat = data.externalThreat ?? 0;
    kingdom.tradeDependency = data.tradeDependency ?? 0;
    kingdom.treasury.deserialize(data.treasury);
    kingdom.research.deserialize(data.research);
    kingdom.economy.deserialize(data.economy);
    kingdom.government = data.government ?? 'tribe';
    kingdom.culture = deserializeCulturalProfile(data.culture, kingdom.species);
    kingdom.society = deserializeSocietyProfile(data.society);
    kingdom.rulerTrait = data.rulerTrait ?? 'peaceful';
    kingdom.governmentSince = data.governmentSince ?? data.foundingYear ?? 1;
    kingdom.dynasty = data.dynasty ?? '';
    kingdom.knownKingdoms = new Set(data.knownKingdoms ?? []);
    kingdom.vassalIds = new Set(data.vassalIds ?? []);
    kingdom.overlordId = data.overlordId ?? null;
    kingdom.colonialStatus = data.colonialStatus ?? 'INDEPENDENT';
    kingdom.metropoleId = data.metropoleId ?? null;
    kingdom.colonyIds = new Set(data.colonyIds ?? []);
    kingdom.colonialAccess = data.colonialAccess === 'maritime' || data.colonialAccess === 'overland'
      ? data.colonialAccess
      : null;
    kingdom.colonialAutonomy = data.colonialAutonomy ?? (kingdom.isColony ? 0.12 : 1);
    kingdom.colonialLoyalty = data.colonialLoyalty ?? (kingdom.isColony ? 0.78 : 1);
    kingdom.colonialTension = data.colonialTension ?? (kingdom.isColony ? 0.08 : 0);
    kingdom.colonialIdentity = data.colonialIdentity ?? (kingdom.isColony ? 0.12 : 1);
    kingdom.separatistMovement = data.separatistMovement === 'organizing' || data.separatistMovement === 'revolt'
      ? data.separatistMovement
      : 'none';
    kingdom.separatistSince = data.separatistSince ?? null;
    kingdom.revoltYear = data.revoltYear ?? null;
    kingdom.foreignSupport = data.foreignSupport ?? 0;
    kingdom.cultureLevel = data.cultureLevel ?? 1;
    kingdom.wealth = data.wealth ?? 100;
    kingdom.pirateRaidsDefeated = data.pirateRaidsDefeated ?? 0;
    kingdom.armyIds = new Set(data.armyIds ?? []);
    kingdom.militaryUpkeepGold = data.militaryUpkeepGold ?? 0;
    kingdom.militaryUpkeepFood = data.militaryUpkeepFood ?? 0;
    kingdom.mercenaryCompanyIds = new Set(data.mercenaryCompanyIds ?? []);
    kingdom.commanderIds = new Set(data.commanderIds ?? []);
    kingdom.doctrine = data.doctrine ?? createDefaultDoctrine(kingdom.name);
    return kingdom;
  }
}
