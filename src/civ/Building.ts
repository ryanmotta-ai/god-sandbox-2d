import { GoodId } from './Goods';

/**
 * Everything a settlement can build.
 *
 * A building is the unit of economic capacity: it produces goods, houses people,
 * enables research or projects military power. Which ones are available depends
 * entirely on the owning kingdom's technology.
 */

export type BuildingType =
  // Core
  | 'town_center'
  | 'house'
  // Food
  | 'farm'
  | 'granary'
  | 'pasture'
  // Extraction
  | 'lumber_camp'
  | 'quarry'
  | 'mine'
  // Craft
  | 'workshop'
  | 'smithy'
  | 'factory'
  // Knowledge
  | 'library'
  | 'academy'
  | 'temple'
  // Commerce
  | 'market'
  | 'harbor'
  | 'bank'
  | 'stock_exchange'
  | 'collective'
  // Infrastructure
  | 'aqueduct'
  | 'wall'
  | 'port'
  | 'refinery'
  | 'oil_well'
  // Power
  | 'barracks'
  | 'keep'
  | 'palace'
  // Historic Wonders & Monuments
  | 'monument'
  | 'great_library'
  | 'grand_aqueduct'
  | 'colosseum';

export type BuildingCategory = 'core' | 'food' | 'extraction' | 'craft' | 'knowledge' | 'commerce' | 'infrastructure' | 'power';

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  icon: string;
  category: BuildingCategory;
  maxHp: number;
  /** Goods consumed to construct it. */
  cost: Partial<Record<GoodId, number>>;
  /** Goods produced per year at level 1, before modifiers. */
  produces?: Partial<Record<GoodId, number>>;
  /** Goods consumed per year to keep running. Production halts if unaffordable. */
  consumes?: Partial<Record<GoodId, number>>;
  /** Citizens this building supports. */
  housing?: number;
  /** Workers needed for full output. */
  jobs?: number;
  /** Research points generated per year. */
  research?: number;
  /** Multiplier on the settlement's military strength. */
  defense?: number;
  /** Extra stockpile capacity. */
  storage?: number;
  /** @deprecated Exact single-resource placement. Prefer resourceTargets/resourceMode. */
  requiresTileResource?: 'wood' | 'stone' | 'iron' | 'coal' | 'gold' | 'gems' | 'oil';
  /** Natural resources this building can physically exploit. */
  resourceTargets?: GoodId[];
  /** required = cannot be built without a matching deposit; preferred = normal output plus bonus resource harvesting. */
  resourceMode?: 'required' | 'preferred';
  /** Base units removed from a natural deposit per year at level 1/full staffing. */
  extractionRate?: number;
  /** Production cycles per year for recipe-driven craft buildings. */
  craftCapacity?: number;
  /** Must be placed next to water. */
  requiresCoast?: boolean;
  /** Only one per settlement. */
  unique?: boolean;
  description: string;
}

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  town_center: {
    type: 'town_center',
    name: 'Town Center',
    icon: '🏛️',
    category: 'core',
    maxHp: 500,
    cost: {},
    housing: 5,
    storage: 200,
    produces: { food: 2 },
    unique: true,
    description: 'The heart of the settlement. Where the first fire was lit.'
  },
  house: {
    type: 'house',
    name: 'House',
    icon: '🏠',
    category: 'core',
    maxHp: 150,
    cost: { wood: 20 },
    housing: 4,
    description: 'Shelter. Every citizen needs one or the settlement stops growing.'
  },

  farm: {
    type: 'farm',
    name: 'Farm',
    icon: '🌾',
    category: 'food',
    maxHp: 100,
    cost: { wood: 15 },
    produces: { food: 10 },
    jobs: 2,
    resourceTargets: ['food', 'cotton', 'spices'],
    resourceMode: 'preferred',
    extractionRate: 3,
    description: 'Tilled fields. Food first; fertile regions may also specialise in cotton or spices.'
  },
  granary: {
    type: 'granary',
    name: 'Granary',
    icon: '🏚️',
    category: 'food',
    maxHp: 180,
    cost: { wood: 30, stone: 15 },
    storage: 250,
    produces: { food: 3 },
    unique: true,
    description: 'Stored surplus. A settlement with a granary survives a bad winter.'
  },
  pasture: {
    type: 'pasture',
    name: 'Pasture',
    icon: '🐄',
    category: 'food',
    maxHp: 120,
    cost: { wood: 20 },
    produces: { food: 6 },
    jobs: 2,
    resourceTargets: ['horses', 'furs'],
    resourceMode: 'preferred',
    extractionRate: 2.5,
    description: 'Herds, corrals and managed hunting grounds. Horse and fur regions become real economic specialities.'
  },

  lumber_camp: {
    type: 'lumber_camp',
    name: 'Lumber Camp',
    icon: '🪵',
    category: 'extraction',
    maxHp: 120,
    cost: { wood: 10 },
    produces: { wood: 8 },
    jobs: 2,
    resourceTargets: ['wood', 'rubber'],
    resourceMode: 'required',
    extractionRate: 8,
    description: 'Organised forestry. Timber forests and tropical rubber stands become productive sites.'
  },
  quarry: {
    type: 'quarry',
    name: 'Quarry',
    icon: '🪨',
    category: 'extraction',
    maxHp: 200,
    // Deliberately costs no tools. The quarry is the only source of stone, and
    // tools need a smithy (25 stone) plus a mine (20 stone) — more than a new
    // settlement owns. Charging tools for it deadlocks the entire build tree.
    cost: { wood: 25 },
    produces: { stone: 7 },
    jobs: 3,
    resourceTargets: ['stone', 'clay'],
    resourceMode: 'required',
    extractionRate: 7,
    description: 'Stone and clay workings. Durable architecture begins with a real deposit under the site.'
  },
  mine: {
    type: 'mine',
    name: 'Mine',
    icon: '⛏️',
    category: 'extraction',
    maxHp: 220,
    cost: { wood: 30, stone: 20 },
    // Actual yield depends on the vein under the shaft.
    produces: { iron: 6 },
    jobs: 4,
    resourceTargets: ['copper', 'tin', 'iron', 'coal', 'salt', 'gold', 'gems', 'saltpeter', 'uranium'],
    resourceMode: 'required',
    extractionRate: 6,
    description: 'A shaft sunk into a mineral vein. The mine extracts whatever geology is really underneath it.'
  },

  workshop: {
    type: 'workshop',
    name: 'Workshop',
    icon: '🪡',
    category: 'craft',
    maxHp: 160,
    cost: { wood: 30, stone: 10 },
    produces: { cloth: 4 },
    jobs: 3,
    craftCapacity: 3,
    description: 'Artisans and weavers. Recipes in Goods.ts decide what this workshop can actually manufacture.'
  },
  smithy: {
    type: 'smithy',
    name: 'Smithy',
    icon: '⚒️',
    category: 'craft',
    maxHp: 200,
    cost: { wood: 30, stone: 25 },
    produces: { tools: 4 },
    jobs: 4,
    craftCapacity: 2.6,
    description: 'Smelters and smiths. Bronze, steel, tools and gunpowder all compete for the same skilled capacity.'
  },
  factory: {
    type: 'factory',
    name: 'Factory',
    icon: '🏭',
    category: 'craft',
    maxHp: 400,
    cost: { stone: 80, steel: 45, tools: 20 },
    produces: { machinery: 12 },
    jobs: 12,
    craftCapacity: 5.5,
    description: 'Mass production. Its output is recipe-driven; without steel, rubber and fuel the machines fall silent.'
  },

  oil_well: {
    type: 'oil_well',
    name: 'Oil Well',
    icon: '🛢️',
    category: 'extraction',
    maxHp: 260,
    cost: { steel: 35, tools: 12 },
    produces: { oil: 12 },
    jobs: 5,
    resourceTargets: ['oil'],
    resourceMode: 'required',
    extractionRate: 12,
    description: 'A derrick sunk into a real petroleum basin. No basin, no well; no oil, no industrial logistics.'
  },
  refinery: {
    type: 'refinery',
    name: 'Refinery',
    icon: '⛽',
    category: 'craft',
    maxHp: 320,
    cost: { steel: 35, stone: 70, tools: 16 },
    produces: { fuel: 9 },
    jobs: 7,
    craftCapacity: 4.5,
    description: 'Cracks crude oil into fuel using the recipe system. Modern fleets now depend on actual refining capacity.'
  },

  library: {
    type: 'library',
    name: 'Library',
    icon: '📚',
    category: 'knowledge',
    maxHp: 180,
    cost: { wood: 40, stone: 30 },
    research: 6,
    jobs: 2,
    unique: true,
    description: 'Accumulated writing. Knowledge that outlives the people who found it.'
  },
  academy: {
    type: 'academy',
    name: 'Academy',
    icon: '🎓',
    category: 'knowledge',
    maxHp: 260,
    cost: { stone: 70, wood: 40, gold: 20 },
    research: 16,
    consumes: { food: 6 },
    jobs: 5,
    unique: true,
    description: 'Scholars paid to think. Expensive, and the only way to reach the modern age.'
  },
  temple: {
    type: 'temple',
    name: 'Temple',
    icon: '⛩️',
    category: 'knowledge',
    maxHp: 300,
    cost: { stone: 50, wood: 25 },
    research: 3,
    jobs: 2,
    unique: true,
    description: 'A place to petition whoever is holding the brush.'
  },

  market: {
    type: 'market',
    name: 'Market',
    icon: '🏪',
    category: 'commerce',
    maxHp: 200,
    cost: { wood: 40, stone: 20 },
    produces: { gold: 5 },
    jobs: 3,
    unique: true,
    description: 'Where surplus becomes coin, and coin becomes a reason to build roads.'
  },
  harbor: {
    type: 'harbor',
    name: 'Harbor',
    icon: '⚓',
    category: 'commerce',
    maxHp: 250,
    cost: { wood: 60, stone: 30 },
    produces: { food: 5, gold: 3 },
    jobs: 4,
    requiresCoast: true,
    unique: true,
    description: 'A coastal harbor for fishing and early maritime commerce. It is now required before sea trade can begin.'
  },
  bank: {
    type: 'bank',
    name: 'Bank',
    icon: '🏦',
    category: 'commerce',
    maxHp: 280,
    cost: { stone: 80, gold: 40 },
    produces: { gold: 16 },
    jobs: 4,
    unique: true,
    description: 'Deposits, loans and interest. Wealth begins to compound.'
  },
  stock_exchange: {
    type: 'stock_exchange',
    name: 'Stock Exchange',
    icon: '📈',
    category: 'commerce',
    maxHp: 320,
    cost: { stone: 120, gold: 100, tools: 20 },
    produces: { gold: 40 },
    jobs: 6,
    unique: true,
    description: 'Ownership traded as paper. Growth accelerates, and so do the crashes.'
  },
  collective: {
    type: 'collective',
    name: 'Collective',
    icon: '☭',
    category: 'commerce',
    maxHp: 320,
    cost: { stone: 90, iron: 50, tools: 15 },
    produces: { food: 20 },
    jobs: 10,
    unique: true,
    description: 'Food and basic output pooled by plan. Crafted tools still require real smithing inputs and industrial capacity.'
  },

  aqueduct: {
    type: 'aqueduct',
    name: 'Aqueduct',
    icon: '🌊',
    category: 'infrastructure',
    maxHp: 350,
    cost: { stone: 90, tools: 8 },
    housing: 12,
    produces: { food: 4 },
    unique: true,
    description: 'Fresh water at scale. Cities can finally grow past their wells.'
  },
  wall: {
    type: 'wall',
    name: 'Wall',
    icon: '🧱',
    category: 'infrastructure',
    maxHp: 400,
    // Priced per segment, not per wall. A curtain is thirty-odd of these, so the
    // old 40-stone figure — set when a "wall" was one standalone building — made
    // a complete ring cost over 1200 stone and put it permanently out of reach.
    cost: { stone: 12 },
    // The value of the *finished* circuit. A partial ring is credited pro rata;
    // see City.defenseMultiplier.
    defense: 1.25,
    description: 'Dressed stone between your people and everyone else’s ambitions.'
  },
  port: {
    type: 'port',
    name: 'Port',
    icon: '🚢',
    category: 'infrastructure',
    maxHp: 250,
    cost: { wood: 55, stone: 90, tools: 12 },
    produces: { gold: 5 },
    jobs: 6,
    requiresCoast: true,
    unique: true,
    description: 'Deep-water docks, cranes and warehouses. Advanced steam and industrial shipping requires a real port.'
  },

  barracks: {
    type: 'barracks',
    name: 'Barracks',
    icon: '🏯',
    category: 'power',
    maxHp: 300,
    cost: { wood: 40, stone: 30 },
    consumes: { food: 5 },
    defense: 1.4,
    jobs: 4,
    description: 'Professional soldiers, fed year-round whether or not there is a war.'
  },
  keep: {
    type: 'keep',
    name: 'Keep',
    icon: '🏰',
    category: 'power',
    maxHp: 600,
    cost: { stone: 100, wood: 40, tools: 6 },
    defense: 1.8,
    housing: 6,
    consumes: { food: 6 },
    unique: true,
    description: 'A lord’s fortified seat. The physical form of feudal authority.'
  },
  palace: {
    type: 'palace',
    name: 'Palace',
    icon: '🏛️',
    category: 'power',
    maxHp: 700,
    cost: { stone: 150, gold: 80, tools: 12 },
    defense: 1.5,
    housing: 10,
    produces: { gold: 10 },
    consumes: { food: 10 },
    research: 4,
    unique: true,
    description: 'The seat of a crown that rules rather than merely reigns.'
  },

  monument: {
    type: 'monument',
    name: 'Statue of the Founder',
    icon: '🗿',
    category: 'infrastructure',
    maxHp: 1000,
    cost: { stone: 200, gold: 100 },
    housing: 10,
    produces: { gold: 15 },
    unique: true,
    description: 'A colossal monument financed by a Great Builder. Grants +30% Kingdom Stability.'
  },
  great_library: {
    type: 'great_library',
    name: 'Great Library of Wisdom',
    icon: '📚',
    category: 'knowledge',
    maxHp: 900,
    cost: { stone: 150, wood: 150, gold: 80 },
    research: 50,
    unique: true,
    description: 'A world wonder storing centuries of scientific and historical knowledge.'
  },
  grand_aqueduct: {
    type: 'grand_aqueduct',
    name: 'Grand Aqueduct of Nations',
    icon: '🌊',
    category: 'infrastructure',
    maxHp: 850,
    cost: { stone: 250, tools: 20 },
    housing: 30,
    produces: { food: 20 },
    unique: true,
    description: 'A engineering wonder supplying endless fresh water to the city.'
  },
  colosseum: {
    type: 'colosseum',
    name: 'Grand Colosseum of Legends',
    icon: '🏛️',
    category: 'power',
    maxHp: 1200,
    cost: { stone: 300, gold: 150 },
    defense: 2.0,
    housing: 15,
    unique: true,
    description: 'A legendary arena inspiring military morale and quelling civil unrest.'
  }
};

export const ALL_BUILDING_TYPES: BuildingType[] = Object.keys(BUILDINGS) as BuildingType[];

/** Buildings available with no technology at all — every settlement starts with these. */
export const BASE_BUILDINGS: BuildingType[] = ['town_center', 'house'];

export interface BuildingData {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  level: number;
  hp: number;
  maxHp: number;
  cityId: string;
}

export class Building implements BuildingData {
  public id: string;
  public type: BuildingType;
  public x: number;
  public y: number;
  public level: number;
  public hp: number;
  public maxHp: number;
  public cityId: string;
  /** Set for mines and camps: what the tile underneath actually yields. */
  public extractedGood: GoodId | null = null;
  /** 0..1 — how well staffed the building is. Scales its output. */
  public staffing: number = 1;
  /** Entity IDs assigned to jobs in this building. Capped by definition.jobs. */
  public assignedWorkerIds: Set<string> = new Set();
  /** Entity IDs that live here. Capped by definition.housing. */
  public residentIds: Set<string> = new Set();

  /** People this building can still take in, accounting for its level. */
  public freeHousing(): number {
    const capacity = (BUILDINGS[this.type]?.housing ?? 0) * this.level;
    return Math.max(0, capacity - this.residentIds.size);
  }

  constructor(id: string, type: BuildingType, x: number, y: number, cityId: string) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.cityId = cityId;
    this.level = 1;
    this.maxHp = BUILDINGS[type]?.maxHp ?? 150;
    this.hp = this.maxHp;
  }

  public get definition(): BuildingDefinition {
    return BUILDINGS[this.type];
  }

  /** Output scales with level and staffing. */
  public outputMultiplier(): number {
    return (1 + (this.level - 1) * 0.55) * this.staffing;
  }

  public upgrade(): void {
    if (this.level < 3) {
      this.level++;
      this.maxHp = Math.round(this.maxHp * 1.5);
      this.hp = this.maxHp;
    }
  }

  /** Cost to raise this building one level. */
  public upgradeCost(): Partial<Record<GoodId, number>> {
    const base = this.definition.cost;
    const scale = 1.6 * this.level;
    const cost: Partial<Record<GoodId, number>> = {};
    for (const [good, amount] of Object.entries(base)) {
      cost[good as GoodId] = Math.ceil((amount as number) * scale);
    }
    return cost;
  }
}
