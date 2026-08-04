import { GoodId } from './Goods';
import { BuildingType } from './Building';
import { GovernmentType } from './Government';

/**
 * The knowledge a civilization accumulates.
 *
 * Two interlocking tracks: `craft` is material technology, `politics` is how a
 * society organises itself. Political techs gate on material ones — you cannot
 * invent feudalism without agriculture, or communism without industry — so the
 * two trees advance together as a single web.
 */

export type TechTrack = 'craft' | 'politics';

export type TechEra =
  | 'stone'
  | 'bronze'
  | 'iron'
  | 'classical'
  | 'industrial'
  | 'modern';

export interface TechEraInfo {
  id: TechEra;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export const TECH_ERAS: Record<TechEra, TechEraInfo> = {
  stone: { id: 'stone', name: 'Era da Pedra', icon: '🪨', color: '#a8a29e', order: 0 },
  bronze: { id: 'bronze', name: 'Era do Bronze', icon: '🏺', color: '#d97706', order: 1 },
  iron: { id: 'iron', name: 'Era do Ferro', icon: '⚔️', color: '#94a3b8', order: 2 },
  classical: { id: 'classical', name: 'Era Clássica', icon: '🏛️', color: '#fbbf24', order: 3 },
  industrial: { id: 'industrial', name: 'Era Industrial', icon: '⚙️', color: '#f97316', order: 4 },
  modern: { id: 'modern', name: 'Era Moderna', icon: '💡', color: '#22d3ee', order: 5 }
};

/**
 * How much slower each era is to research than the last.
 *
 * Raw tech costs are written on a human scale; this curve is what makes progress
 * feel like history. A realm blows through the Stone Age in a few generations and
 * then spends centuries inching toward industry.
 *
 * The curve is deliberately gentler than pure flavour would suggest. A stone-age
 * realm produces only a few research points a year, and every knowledge building
 * sits behind `writing`; scaled any harder, `mining` alone cost more than fifty
 * years and the entire metal economy — quarry, mine, smithy, bronze, tools —
 * stayed permanently out of reach.
 */
const ERA_COST_SCALE: Record<TechEra, number> = {
  stone: 1,
  bronze: 1.2,
  iron: 1.8,
  classical: 2.6,
  industrial: 3.8,
  modern: 5.2
};

/** The real research cost of a technology, after era scaling. */
export function techCost(tech: TechDefinition): number {
  return Math.round(tech.cost * ERA_COST_SCALE[tech.era]);
}

/**
 * Compresses a compounded multiplier so long tech chains give strong but
 * survivable advantages. A raw 20× becomes roughly 5×; 1× stays 1×.
 */
function damped(multiplier: number): number {
  return multiplier <= 1 ? multiplier : Math.pow(multiplier, 0.55);
}

/** Everything a technology can grant when it completes. */
export interface TechUnlocks {
  buildings?: BuildingType[];
  goods?: GoodId[];
  /** Government types this technology makes adoptable. */
  governments?: GovernmentType[];
  /** Flat multipliers applied to the owning kingdom while known. */
  modifiers?: {
    production?: number;
    research?: number;
    growth?: number;
    trade?: number;
    military?: number;
    /** Extra tiles of territory a settlement may claim. */
    territory?: number;
  };
  /** Named capabilities other systems check for. */
  features?: TechFeature[];
}

export type TechFeature =
  | 'currency'          // Kingdom mints its own money
  | 'trade_routes'      // Overland trade with neighbours
  | 'maritime_trade'    // Trade across water
  | 'banking'           // Loans, interest, investment
  | 'stock_market'      // Capitalist economy option
  | 'central_planning'  // Communist economy option
  | 'writing'           // Chronicle detail, diplomacy pacts
  | 'diplomacy_pacts'   // Formal treaties beyond war/peace
  | 'colonisation'      // Settlers can cross water
  | 'conscription'      // Larger armies
  | 'mass_production';  // Factory output

export interface TechDefinition {
  id: string;
  name: string;
  track: TechTrack;
  era: TechEra;
  icon: string;
  /** Research points required. Scaled by era so progress slows realistically. */
  cost: number;
  /** All of these must be known first. */
  requires: string[];
  /** Only one of a mutually exclusive set may ever be taken. */
  excludes?: string[];
  unlocks: TechUnlocks;
  description: string;
  /** Chronicle line written when a kingdom completes it. */
  discovery: string;
}

export const TECHNOLOGIES: Record<string, TechDefinition> = {
  // ========================= STONE AGE =========================
  stone_tools: {
    id: 'stone_tools',
    name: 'Stone Tools',
    track: 'craft',
    era: 'stone',
    icon: '🪓',
    cost: 30,
    requires: [],
    unlocks: { modifiers: { production: 1.15 }, buildings: ['lumber_camp'] },
    description: 'Knapped flint. Everything else in history follows from this.',
    discovery: 'learned to shape stone into tools'
  },
  fire_mastery: {
    id: 'fire_mastery',
    name: 'Mastery of Fire',
    track: 'craft',
    era: 'stone',
    icon: '🔥',
    cost: 40,
    requires: ['stone_tools'],
    unlocks: { modifiers: { growth: 1.1, military: 1.1 } },
    description: 'Warmth, cooked food and a weapon that spreads on its own.',
    discovery: 'tamed fire'
  },
  agriculture: {
    id: 'agriculture',
    name: 'Agriculture',
    track: 'craft',
    era: 'stone',
    icon: '🌾',
    cost: 60,
    requires: ['stone_tools'],
    unlocks: { buildings: ['farm', 'granary'], goods: ['cotton', 'spices'], modifiers: { growth: 1.35 } },
    description: 'Planting instead of foraging. Populations stop wandering and start counting.',
    discovery: 'began to farm the land'
  },
  animal_husbandry: {
    id: 'animal_husbandry',
    name: 'Animal Husbandry',
    track: 'craft',
    era: 'stone',
    icon: '🐄',
    cost: 70,
    requires: ['agriculture'],
    unlocks: { buildings: ['pasture'], goods: ['horses', 'furs'], modifiers: { growth: 1.15, production: 1.1 } },
    description: 'Herds that follow you are better than herds you chase.',
    discovery: 'domesticated livestock'
  },

  // ========================= BRONZE AGE =========================
  pottery: {
    id: 'pottery',
    name: 'Pottery & Weaving',
    track: 'craft',
    era: 'bronze',
    icon: '🏺',
    cost: 110,
    requires: ['agriculture'],
    // Barter long predates coinage: this is what opens the first caravans.
    // Currency later makes that trade far more valuable, not merely possible.
    unlocks: {
      buildings: ['workshop'],
      goods: ['cloth'],
      features: ['trade_routes'],
      modifiers: { production: 1.1, trade: 1.15 }
    },
    description: 'Storage and cloth. Surplus becomes possible, and so does trade.',
    discovery: 'mastered pottery and weaving'
  },
  mining: {
    id: 'mining',
    name: 'Mining',
    track: 'craft',
    era: 'bronze',
    icon: '⛏️',
    cost: 130,
    requires: ['stone_tools'],
    unlocks: { buildings: ['mine', 'quarry'], goods: ['copper', 'tin', 'iron', 'coal', 'salt', 'gold', 'gems', 'saltpeter'], modifiers: { production: 1.2 } },
    description: 'Digging beneath the surface for what the land refuses to give freely.',
    discovery: 'sank the first mine shafts'
  },
  masonry: {
    id: 'masonry',
    name: 'Masonry',
    track: 'craft',
    era: 'bronze',
    icon: '🧱',
    cost: 150,
    requires: ['mining'],
    unlocks: { buildings: ['wall'], modifiers: { military: 1.2, territory: 2 } },
    description: 'Dressed stone. Cities acquire walls, and walls acquire meaning.',
    discovery: 'raised its first stone walls'
  },
  bronze_working: {
    id: 'bronze_working',
    name: 'Bronze Working',
    track: 'craft',
    era: 'bronze',
    icon: '⚒️',
    cost: 180,
    requires: ['mining', 'fire_mastery'],
    unlocks: { buildings: ['smithy', 'barracks'], goods: ['bronze', 'tools'], modifiers: { military: 1.25, production: 1.15 } },
    description: 'Alloyed metal. The first tools that outlast the hands that made them.',
    discovery: 'smelted bronze'
  },
  writing: {
    id: 'writing',
    name: 'Writing',
    track: 'craft',
    era: 'bronze',
    icon: '📜',
    cost: 200,
    requires: ['pottery'],
    unlocks: { buildings: ['library', 'temple'], modifiers: { research: 1.4 }, features: ['writing', 'diplomacy_pacts'] },
    description: 'Memory that survives its owner. Law, debt and history all become possible.',
    discovery: 'invented writing'
  },

  // ========================= IRON AGE =========================
  iron_working: {
    id: 'iron_working',
    name: 'Iron Working',
    track: 'craft',
    era: 'iron',
    icon: '⚔️',
    cost: 280,
    requires: ['bronze_working'],
    unlocks: { modifiers: { military: 1.4, production: 1.2 } },
    description: 'Harder, cheaper and far more common than bronze. War gets democratic.',
    discovery: 'forged iron'
  },
  mathematics: {
    id: 'mathematics',
    name: 'Mathematics',
    track: 'craft',
    era: 'iron',
    icon: '📐',
    cost: 300,
    requires: ['writing'],
    unlocks: { modifiers: { research: 1.25, production: 1.1 } },
    description: 'Counting turns into proof. Buildings get taller and taxes get accurate.',
    discovery: 'formalised mathematics'
  },
  currency: {
    id: 'currency',
    name: 'Currency',
    track: 'craft',
    era: 'iron',
    icon: '🪙',
    cost: 340,
    requires: ['mathematics', 'mining'],
    unlocks: { buildings: ['market'], features: ['currency', 'trade_routes'], modifiers: { trade: 1.5 } },
    description: 'Minted coin. Wealth stops being grain in a barn and becomes a number.',
    discovery: 'minted its first coinage'
  },
  sailing: {
    id: 'sailing',
    name: 'Sailing',
    track: 'craft',
    era: 'iron',
    icon: '⛵',
    cost: 320,
    requires: ['pottery', 'mathematics'],
    unlocks: { buildings: ['harbor'], features: ['maritime_trade', 'colonisation'], modifiers: { trade: 1.3 } },
    description: 'The sea stops being a wall and becomes a road.',
    discovery: 'learned to sail beyond sight of land'
  },
  roads: {
    id: 'roads',
    name: 'Road Building',
    track: 'craft',
    era: 'iron',
    icon: '🛣️',
    cost: 300,
    requires: ['masonry'],
    unlocks: { modifiers: { trade: 1.25, territory: 3, military: 1.1 } },
    description: 'Paved routes. Armies and caravans both move faster — usually in that order.',
    discovery: 'paved the first great roads'
  },

  // ========================= CLASSICAL AGE =========================
  engineering: {
    id: 'engineering',
    name: 'Engineering',
    track: 'craft',
    era: 'classical',
    icon: '🏗️',
    cost: 480,
    requires: ['mathematics', 'masonry'],
    unlocks: { buildings: ['aqueduct', 'port'], modifiers: { production: 1.3, growth: 1.2, territory: 3 } },
    description: 'Aqueducts, cranes and siege engines. Cities can finally outgrow their wells.',
    discovery: 'mastered engineering'
  },
  philosophy: {
    id: 'philosophy',
    name: 'Philosophy',
    track: 'craft',
    era: 'classical',
    icon: '🧠',
    cost: 500,
    requires: ['writing'],
    unlocks: { buildings: ['academy'], modifiers: { research: 1.45 } },
    description: 'Asking why the king is king. Historically, a dangerous pastime.',
    discovery: 'gave rise to its first philosophers'
  },
  medicine: {
    id: 'medicine',
    name: 'Medicine',
    track: 'craft',
    era: 'classical',
    icon: '⚕️',
    cost: 520,
    requires: ['philosophy'],
    unlocks: { modifiers: { growth: 1.35 } },
    description: 'Fewer people die of things that did not need to kill them.',
    discovery: 'developed formal medicine'
  },
  banking: {
    id: 'banking',
    name: 'Banking',
    track: 'craft',
    era: 'classical',
    icon: '🏦',
    cost: 600,
    requires: ['currency', 'mathematics'],
    unlocks: { buildings: ['bank'], features: ['banking'], modifiers: { trade: 1.5 } },
    description: 'Lending money you do not have, against wealth that does not exist yet.',
    discovery: 'founded its first banks'
  },
  metallurgy: {
    id: 'metallurgy',
    name: 'Metallurgy',
    track: 'craft',
    era: 'classical',
    icon: '🔩',
    cost: 620,
    requires: ['iron_working', 'engineering'],
    unlocks: { goods: ['steel'], modifiers: { military: 1.35, production: 1.25 } },
    description: 'Steel, alloys and blast furnaces. Coal stops being a curiosity.',
    discovery: 'advanced the science of metals'
  },

  // ========================= INDUSTRIAL AGE =========================
  printing_press: {
    id: 'printing_press',
    name: 'Printing Press',
    track: 'craft',
    era: 'industrial',
    icon: '🖨️',
    cost: 850,
    requires: ['philosophy', 'metallurgy'],
    unlocks: { modifiers: { research: 1.6, growth: 1.1 } },
    description: 'Ideas reproduce faster than the people who censor them.',
    discovery: 'built the printing press'
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Gunpowder',
    track: 'craft',
    era: 'industrial',
    icon: '💥',
    cost: 900,
    requires: ['metallurgy'],
    unlocks: { goods: ['gunpowder'], features: ['conscription'], modifiers: { military: 1.7 } },
    description: 'Walls stop being the answer. So do knights.',
    discovery: 'weaponised gunpowder'
  },
  steam_power: {
    id: 'steam_power',
    name: 'Steam Power',
    track: 'craft',
    era: 'industrial',
    icon: '🚂',
    cost: 1100,
    requires: ['engineering', 'metallurgy'],
    unlocks: { modifiers: { production: 1.5, trade: 1.3 } },
    description: 'Work stops being limited by how many arms you own.',
    discovery: 'harnessed steam'
  },
  industrialization: {
    id: 'industrialization',
    name: 'Industrialization',
    track: 'craft',
    era: 'industrial',
    icon: '🏭',
    cost: 1400,
    requires: ['steam_power', 'banking'],
    unlocks: { buildings: ['factory', 'oil_well', 'refinery'], goods: ['oil', 'fuel', 'machinery'], features: ['mass_production'], modifiers: { production: 1.8, growth: 1.2 } },
    description: 'Mass production. Enormous wealth, enormous inequality, and a new kind of politics.',
    discovery: 'entered the industrial age'
  },

  // ========================= MODERN AGE =========================
  electricity: {
    id: 'electricity',
    name: 'Electricity',
    track: 'craft',
    era: 'modern',
    icon: '⚡',
    cost: 1800,
    requires: ['industrialization'],
    unlocks: { goods: ['uranium'], modifiers: { production: 1.4, research: 1.4, growth: 1.15 } },
    description: 'Light, motors and instant communication over any distance.',
    discovery: 'electrified its cities'
  },
  aviation: {
    id: 'aviation',
    name: 'Aviation',
    track: 'craft',
    era: 'modern',
    icon: '✈️',
    cost: 2200,
    requires: ['electricity'],
    unlocks: { buildings: ['airport'], modifiers: { production: 1.15, research: 1.2 } },
    description: 'Freight and passengers that ignore the ground entirely — and the aerodromes they need at both ends.',
    discovery: 'took to the air'
  },
  mass_media: {
    id: 'mass_media',
    name: 'Mass Media',
    track: 'craft',
    era: 'modern',
    icon: '📡',
    cost: 2100,
    requires: ['electricity', 'printing_press'],
    unlocks: { modifiers: { research: 1.3, trade: 1.2 } },
    description: 'Whoever controls the broadcast controls what the people believe happened.',
    discovery: 'built a mass media apparatus'
  },

  // ========================= POLITICAL TRACK =========================
  tribalism: {
    id: 'tribalism',
    name: 'Tribalism',
    track: 'politics',
    era: 'stone',
    icon: '🪶',
    cost: 0,
    requires: [],
    unlocks: { governments: ['tribe'] },
    description: 'Kinship and elders. Authority reaches exactly as far as everyone can shout.',
    discovery: 'organised itself into tribes'
  },
  chiefdom: {
    id: 'chiefdom',
    name: 'Chiefdom',
    track: 'politics',
    era: 'stone',
    icon: '🗿',
    cost: 80,
    requires: ['tribalism', 'agriculture'],
    unlocks: { governments: ['chiefdom'], modifiers: { growth: 1.1, territory: 1 } },
    description: 'One family claims the surplus, and the others let them.',
    discovery: 'crowned its first chieftain'
  },
  feudalism: {
    id: 'feudalism',
    name: 'Feudalism',
    track: 'politics',
    era: 'bronze',
    icon: '🛡️',
    cost: 260,
    requires: ['chiefdom', 'masonry', 'agriculture'],
    unlocks: {
      governments: ['feudal_kingdom'],
      buildings: ['keep'],
      modifiers: { military: 1.25, territory: 2, growth: 1.05 }
    },
    description: 'Land granted in exchange for oaths. Loyalty becomes a form of property.',
    discovery: 'established the feudal order'
  },
  monarchy: {
    id: 'monarchy',
    name: 'Monarchy',
    track: 'politics',
    era: 'iron',
    icon: '👑',
    cost: 460,
    requires: ['feudalism', 'writing'],
    unlocks: {
      governments: ['monarchy'],
      buildings: ['palace'],
      modifiers: { growth: 1.15, trade: 1.1, territory: 3 }
    },
    description: 'The crown outranks the barons. Written law replaces personal loyalty.',
    discovery: 'consolidated power under a single crown'
  },
  imperialism: {
    id: 'imperialism',
    name: 'Imperialism',
    track: 'politics',
    era: 'classical',
    icon: '🦅',
    cost: 780,
    requires: ['monarchy', 'roads'],
    unlocks: {
      governments: ['empire'],
      modifiers: { military: 1.3, territory: 6, trade: 1.2 }
    },
    description: 'Conquered peoples are governed, not absorbed. The realm becomes an empire.',
    discovery: 'proclaimed itself an empire'
  },
  constitutionalism: {
    id: 'constitutionalism',
    name: 'Constitutionalism',
    track: 'politics',
    era: 'industrial',
    icon: '📖',
    cost: 1200,
    requires: ['monarchy', 'printing_press', 'philosophy'],
    unlocks: {
      governments: ['constitutional_monarchy', 'republic'],
      modifiers: { research: 1.2, growth: 1.15, trade: 1.15 }
    },
    description: 'The sovereign is bound by a document. Everyone pretends this was always the case.',
    discovery: 'bound its ruler to a constitution'
  },
  capitalism: {
    id: 'capitalism',
    name: 'Capitalism',
    track: 'politics',
    era: 'industrial',
    icon: '📈',
    cost: 1700,
    requires: ['constitutionalism', 'industrialization', 'banking'],
    excludes: ['communism'],
    unlocks: {
      governments: ['capitalist_state'],
      buildings: ['stock_exchange'],
      features: ['stock_market'],
      modifiers: { trade: 1.8, production: 1.3, growth: 1.1 }
    },
    description: 'Private capital directs production. Growth accelerates; so does the gap.',
    discovery: 'embraced capitalism'
  },
  communism: {
    id: 'communism',
    name: 'Communism',
    track: 'politics',
    era: 'industrial',
    icon: '☭',
    cost: 1700,
    requires: ['constitutionalism', 'industrialization'],
    excludes: ['capitalism'],
    unlocks: {
      governments: ['communist_state'],
      buildings: ['collective'],
      features: ['central_planning'],
      modifiers: { production: 1.55, growth: 1.25, military: 1.2 }
    },
    description: 'The state directs production on behalf of the workers. Trade suffers; output does not.',
    discovery: 'declared a workers’ state'
  }
};

export const ALL_TECH_IDS: string[] = Object.keys(TECHNOLOGIES);
export const CRAFT_TECHS: TechDefinition[] = ALL_TECH_IDS.map(id => TECHNOLOGIES[id]).filter(t => t.track === 'craft');
export const POLITICAL_TECHS: TechDefinition[] = ALL_TECH_IDS.map(id => TECHNOLOGIES[id]).filter(t => t.track === 'politics');

/** Techs grouped by era, in progression order. Used by the tech tree screen. */
export function techsByEra(track: TechTrack): { era: TechEraInfo; techs: TechDefinition[] }[] {
  const eras = Object.values(TECH_ERAS).sort((a, b) => a.order - b.order);
  return eras
    .map(era => ({
      era,
      techs: ALL_TECH_IDS.map(id => TECHNOLOGIES[id]).filter(t => t.track === track && t.era === era.id)
    }))
    .filter(group => group.techs.length > 0);
}

/**
 * The research state of one kingdom.
 * Kingdoms accumulate points every year and spend them on whatever they can reach.
 */
// ============================ WHAT TECHNOLOGY MAKES MATTER ============================

/**
 * The demand a technology creates for raw materials.
 *
 * This is the whole point of the tech tree economically: oil is a worthless
 * black puddle until somebody invents an engine, and then wars are fought over
 * it. Nothing here is a flag on the good itself — importance *emerges* from
 * what the realms of the world have actually learned to do.
 *
 * The weight is roughly "units wanted per year per point of industrial base".
 */
const TECH_STRATEGIC_DEMAND: Record<string, Partial<Record<GoodId, number>>> = {
  bronze_working: { copper: 1.0, tin: 1.5 },
  iron_working: { iron: 1.2 },
  metallurgy: { iron: 1.6, coal: 1.4 },
  gunpowder: { saltpeter: 1.7, coal: 0.6 },
  steam_power: { coal: 2.2, iron: 0.9 },
  industrialization: { coal: 1.8, oil: 1.5, rubber: 1.3, steel: 1.4 },
  electricity: { copper: 1.8, oil: 1.0, uranium: 0.5 },
  mass_media: { copper: 0.9 }
};

/**
 * How badly this realm wants a good, purely because of what it knows.
 * Zero means the material is still just a rock to them.
 */
/** The raw-material demand one technology creates, for the tech screen. */
export function demandCreatedBy(techId: string): { good: GoodId; weight: number }[] {
  const demand = TECH_STRATEGIC_DEMAND[techId];
  if (!demand) return [];
  return Object.entries(demand)
    .map(([good, weight]) => ({ good: good as GoodId, weight: weight as number }))
    .sort((a, b) => b.weight - a.weight);
}

export function strategicWeight(research: ResearchState, good: GoodId): number {
  let weight = 0;
  for (const techId of research.known) {
    const demand = TECH_STRATEGIC_DEMAND[techId];
    if (demand && demand[good]) weight += demand[good]!;
  }
  return weight;
}

/** Every good this realm's technology gives it a reason to want, strongest first. */
export function strategicGoodsFor(research: ResearchState): { good: GoodId; weight: number }[] {
  const totals = new Map<GoodId, number>();
  for (const techId of research.known) {
    const demand = TECH_STRATEGIC_DEMAND[techId];
    if (!demand) continue;
    for (const [good, weight] of Object.entries(demand)) {
      totals.set(good as GoodId, (totals.get(good as GoodId) ?? 0) + (weight as number));
    }
  }
  return [...totals.entries()]
    .map(([good, weight]) => ({ good, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/** Whether any realm in the world has a technological reason to want this good yet. */
export function isStrategicNow(researchStates: Iterable<ResearchState>, good: GoodId): boolean {
  for (const research of researchStates) {
    if (strategicWeight(research, good) > 0) return true;
  }
  return false;
}

// ============================ TECHNOLOGY ≠ CAPACITY ============================

export interface TechCapability {
  techId: string;
  name: string;
  /** 0..1 — how much of this technology the realm can actually put to work. */
  capacity: number;
  /** Buildings the technology unlocked that the realm has never built. */
  missingBuildings: BuildingType[];
  /** Materials the technology needs that the realm cannot lay hands on. */
  missingGoods: GoodId[];
}

/**
 * What a realm can actually *do* with what it knows.
 *
 * Discovering combustion does not give you an engine: you still need the oil,
 * the refinery and the industry. A realm can therefore sit on a modern tech tree
 * and operate at a classical level, which is exactly the gap that makes
 * resource geopolitics matter.
 */
export function technologyCapacity(
  research: ResearchState,
  hasBuilding: (type: BuildingType) => boolean,
  canObtain: (good: GoodId) => boolean
): TechCapability[] {
  const out: TechCapability[] = [];

  for (const techId of research.known) {
    const tech = TECHNOLOGIES[techId];
    if (!tech) continue;

    const buildings = tech.unlocks.buildings ?? [];
    const demand = TECH_STRATEGIC_DEMAND[techId] ?? {};
    const goods = Object.keys(demand) as GoodId[];
    // A technology with neither a building nor a material need is pure knowledge
    // (writing, philosophy); it is always fully "operational".
    if (buildings.length === 0 && goods.length === 0) continue;

    const missingBuildings = buildings.filter(b => !hasBuilding(b));
    const missingGoods = goods.filter(g => !canObtain(g));

    const total = buildings.length + goods.length;
    const have = total - missingBuildings.length - missingGoods.length;
    out.push({
      techId,
      name: tech.name,
      capacity: total > 0 ? have / total : 1,
      missingBuildings,
      missingGoods
    });
  }

  return out.sort((a, b) => a.capacity - b.capacity);
}

/**
 * The era a realm can actually operate at, which may lag the era it has read
 * about. A realm that knows industrialization but has no factory, no coal and
 * no steel is still living in the iron age no matter what its library says.
 */
export function operatingEra(research: ResearchState, capabilities: TechCapability[]): TechEra {
  const byId = new Map(capabilities.map(c => [c.techId, c.capacity]));
  let best: TechEra = 'stone';
  let bestOrder = -1;

  for (const techId of research.known) {
    const tech = TECHNOLOGIES[techId];
    if (!tech) continue;
    // Knowledge with nothing to build or burn counts; anything material has to
    // be at least half operational before it lifts the realm's real era.
    const capacity = byId.get(techId);
    if (capacity !== undefined && capacity < 0.5) continue;
    const order = TECH_ERAS[tech.era].order;
    if (order > bestOrder) { bestOrder = order; best = tech.era; }
  }
  return best;
}

export class ResearchState {
  public known: Set<string> = new Set(['tribalism']);
  /** Tech currently being researched, and how many points are banked toward it. */
  public current: string | null = null;
  public progress: number = 0;
  /** Research points produced per year, recomputed by the civilization engine. */
  public output: number = 0;
  /** Techs permanently barred by an exclusive choice already made. */
  public forbidden: Set<string> = new Set();

  public knows(techId: string): boolean {
    return this.known.has(techId);
  }

  public knowsFeature(feature: TechFeature): boolean {
    for (const id of this.known) {
      if (TECHNOLOGIES[id]?.unlocks.features?.includes(feature)) return true;
    }
    return false;
  }

  /** A tech is available when every prerequisite is known and nothing forbids it. */
  public isAvailable(techId: string): boolean {
    if (this.known.has(techId) || this.forbidden.has(techId)) return false;
    const tech = TECHNOLOGIES[techId];
    if (!tech) return false;
    return tech.requires.every(req => this.known.has(req));
  }

  public availableTechs(): TechDefinition[] {
    return ALL_TECH_IDS.filter(id => this.isAvailable(id)).map(id => TECHNOLOGIES[id]);
  }

  /** Every modifier from every known tech, multiplied together. */
  public modifiers(): Required<NonNullable<TechUnlocks['modifiers']>> {
    const total = { production: 1, research: 1, growth: 1, trade: 1, military: 1, territory: 0 };
    for (const id of this.known) {
      const mods = TECHNOLOGIES[id]?.unlocks.modifiers;
      if (!mods) continue;
      if (mods.production) total.production *= mods.production;
      if (mods.research) total.research *= mods.research;
      if (mods.growth) total.growth *= mods.growth;
      if (mods.trade) total.trade *= mods.trade;
      if (mods.military) total.military *= mods.military;
      if (mods.territory) total.territory += mods.territory;
    }

    // Thirty compounding bonuses would multiply out to a twenty-fold advantage
    // and make a single advanced realm unstoppable. Diminishing returns keep the
    // ordering — more technology is always better — without the runaway.
    total.production = damped(total.production);
    total.research = damped(total.research);
    total.growth = damped(total.growth);
    total.trade = damped(total.trade);
    total.military = damped(total.military);

    return total;
  }

  public unlockedBuildings(): Set<BuildingType> {
    const buildings = new Set<BuildingType>();
    for (const id of this.known) {
      for (const b of TECHNOLOGIES[id]?.unlocks.buildings ?? []) buildings.add(b);
    }
    return buildings;
  }

  public unlockedGovernments(): GovernmentType[] {
    const governments: GovernmentType[] = [];
    for (const id of this.known) {
      for (const g of TECHNOLOGIES[id]?.unlocks.governments ?? []) {
        if (!governments.includes(g)) governments.push(g);
      }
    }
    return governments;
  }

  /** Highest era among known craft techs — the kingdom's overall level of development. */
  public currentEra(): TechEra {
    let best: TechEra = 'stone';
    let bestOrder = -1;
    for (const id of this.known) {
      const tech = TECHNOLOGIES[id];
      if (!tech) continue;
      const order = TECH_ERAS[tech.era].order;
      if (order > bestOrder) { bestOrder = order; best = tech.era; }
    }
    return best;
  }

  /** 0..1 across the entire tree, for progress bars. */
  public overallProgress(): number {
    return this.known.size / ALL_TECH_IDS.length;
  }

  /** Marks a tech known and applies its exclusivity. */
  public complete(techId: string): void {
    this.known.add(techId);
    const tech = TECHNOLOGIES[techId];
    for (const excluded of tech?.excludes ?? []) this.forbidden.add(excluded);
    if (this.current === techId) {
      this.current = null;
      this.progress = 0;
    }
  }

  public serialize(): any {
    return {
      known: Array.from(this.known),
      current: this.current,
      progress: this.progress,
      forbidden: Array.from(this.forbidden)
    };
  }

  public deserialize(data: any): void {
    if (!data) return;
    this.known = new Set(data.known ?? ['tribalism']);
    this.current = data.current ?? null;
    this.progress = data.progress ?? 0;
    this.forbidden = new Set(data.forbidden ?? []);
  }
}
