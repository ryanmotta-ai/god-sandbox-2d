import { GoodId } from './Goods';
import { BuildingType } from './Building';
import { GovernmentType } from './Government';

/**
 * What each age of the world allows.
 *
 * This was a research tree — costs, prerequisites, exclusive branches, points
 * banked per year — and it is now a table. Every entry says which era it belongs
 * to and what that era unlocks: buildings, goods, governments, features, and the
 * modifiers that make an iron-age realm stronger than a stone-age one. A realm
 * knows everything its era carries and nothing beyond it.
 *
 * The entries kept their names and descriptions because they are what the
 * chronicle says when an age turns over, and because "Agricultura unlocks the
 * farm" reads better than a list of building ids.
 */


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
/**
 * How much more a technology of each era costs than its base price.
 *
 * The late entries used to be 6,5 and 11, and combined with base prices climbing
 * from 30 to 2.100 that made the average industrial technology cost 470 times an
 * average stone-age one. Research is paid for by population, which a measured
 * ninety-year run grew fifteenfold, and by the tree's own research multiplier,
 * which `damped` caps near three. Fifty times of income against four hundred and
 * seventy times of cost: the industrial and modern eras were not slow, they were
 * unreachable, and half the tree was content no game would ever see.
 *
 * Eased to 4 and 6. The curve still climbs steeply — a modern technology is far
 * from cheap — but the climb is now something a realm can finish inside a
 * civilisation's lifetime rather than four of them.
 */
const ERA_COST_SCALE: Record<TechEra, number> = {
  stone: 0.6,
  bronze: 0.8,
  iron: 1.1,
  classical: 1.6,
  industrial: 2.2,
  modern: 3.0
};

/**
 * How much cheaper a technology gets per realm in contact that already has it.
 *
 * This is the lever that makes the late tree reachable, and it is deliberately a
 * *world* mechanism rather than a flat buff. Eased era costs and gentler research
 * damping together still left a realm of ordinary size a few centuries short; what
 * closes the gap is that the cost of an era ends up paid by everyone, not by one
 * town of seventy people.
 *
 * It also earns its keep as a rule rather than a correction. Contact and trade
 * gain concrete strategic worth. Isolation acquires a price. A leader drags the
 * world along behind it, so an era becomes a wave that crosses the map instead of
 * one realm's privilege. Conquest transfers knowledge. And a realm that has fallen
 * behind has a way back, which is what stops a single runaway winner.
 */
const DIFFUSION_PER_PEER = 0.20;
const MAX_DIFFUSION_DISCOUNT = 0.75;

/**
 * Compresses a compounded multiplier so long tech chains give strong but
 * survivable advantages. A raw 20× becomes roughly 5×; 1× stays 1×.
 */
function damped(multiplier: number, exponent: number = 0.55): number {
  return multiplier <= 1 ? multiplier : Math.pow(multiplier, exponent);
}

/**
 * Research is damped more gently than the rest.
 *
 * The others are compressed hard for a good reason: a realm with thirty
 * compounding military or production bonuses would be unstoppable. Research is
 * not that kind of advantage — it buys the *right to keep playing the tree*, and
 * at 0,55 the whole tree returned barely 3,3x, against costs that climb in orders
 * of magnitude. A realm that has invested its entire history in scholarship
 * should feel it.
 */
const RESEARCH_DAMPING = 0.88;

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
  | 'railways'          // Train network and locomotives
  | 'mass_production'   // Factory output
  | 'air_defense_grid'  // Layered SAM and interception network
  | 'nuclear_weapons'   // Nuclear enrichment & strategic warheads
  | 'drone_swarms';     // UAV avionics & loitering munitions

export interface TechDefinition {
  id: string;
  name: string;
  era: TechEra;
  icon: string;
  unlocks: TechUnlocks;
  description: string;
  /** Chronicle line written when a kingdom completes it. */
  discovery: string;
}

export const TECHNOLOGIES: Record<string, TechDefinition> = {
  // ========================= STONE AGE =========================
  stone_tools: {
    id: 'stone_tools',
    name: 'Ferramentas de Pedra',
    era: 'stone',
    icon: '🪓',
    unlocks: { modifiers: { production: 1.15 }, buildings: ['lumber_camp'] },
    description: 'Sílex lascado. Tudo o mais na história se segue a partir disso.',
    discovery: 'aprendeu a moldar pedra em ferramentas'
  },
  fire_mastery: {
    id: 'fire_mastery',
    name: 'Domínio do Fogo',
    era: 'stone',
    icon: '🔥',
    unlocks: { modifiers: { growth: 1.1, military: 1.1 } },
    description: 'Calor, comida cozida e uma arma que se espalha sozinha.',
    discovery: 'domou o fogo'
  },
  agriculture: {
    id: 'agriculture',
    name: 'Agricultura',
    era: 'stone',
    icon: '🌾',
    unlocks: { buildings: ['farm', 'granary'], goods: ['cotton', 'spices'], modifiers: { growth: 1.35 } },
    description: 'Plantar em vez de forragear. As populações param de vagar e começam a contar.',
    discovery: 'começou a cultivar a terra'
  },
  animal_husbandry: {
    id: 'animal_husbandry',
    name: 'Pecuária',
    era: 'stone',
    icon: '🐄',
    unlocks: { buildings: ['pasture'], goods: ['horses', 'furs'], modifiers: { growth: 1.15, production: 1.1 } },
    description: 'Rebanhos que te seguem são melhores que rebanhos que você persegue.',
    discovery: 'domesticou o gado'
  },
  sailing: {
    id: 'sailing',
    name: 'Navegação',
    era: 'stone',
    icon: '⛵',
    unlocks: { buildings: ['harbor'], features: ['maritime_trade', 'colonisation'], modifiers: { trade: 1.3 } },
    description: 'Canoas e ancoradouros de madeira. O mar deixa de ser um muro e se torna uma estrada.',
    discovery: 'aprendeu a navegar pelas águas costeiras'
  },

  // ========================= BRONZE AGE =========================
  pottery: {
    id: 'pottery',
    name: 'Cerâmica e Tecelagem',
    era: 'bronze',
    icon: '🏺',
    // Barter long predates coinage: this is what opens the first caravans.
    // Currency later makes that trade far more valuable, not merely possible.
    unlocks: {
      buildings: ['workshop'],
      goods: ['cloth'],
      features: ['trade_routes'],
      modifiers: { production: 1.1, trade: 1.15 }
    },
    description: 'Armazenamento e tecido. O excedente torna-se possível, e o comércio também.',
    discovery: 'dominou a cerâmica e a tecelagem'
  },
  mining: {
    id: 'mining',
    name: 'Mineração',
    era: 'bronze',
    icon: '⛏️',
    unlocks: { buildings: ['mine', 'quarry'], goods: ['copper', 'tin', 'iron', 'coal', 'salt', 'gold', 'gems', 'saltpeter'], modifiers: { production: 1.2 } },
    description: 'Cavar abaixo da superfície pelo que a terra se recusa a dar livremente.',
    discovery: 'escavou os primeiros poços de mina'
  },
  masonry: {
    id: 'masonry',
    name: 'Alvenaria',
    era: 'bronze',
    icon: '🧱',
    unlocks: { buildings: ['wall'], modifiers: { military: 1.2, territory: 2 } },
    description: 'Pedra talhada. As cidades ganham muros, e os muros ganham significado.',
    discovery: 'ergueu suas primeiras muralhas de pedra'
  },
  bronze_working: {
    id: 'bronze_working',
    name: 'Metalurgia do Bronze',
    era: 'bronze',
    icon: '⚒️',
    unlocks: { buildings: ['smithy', 'barracks'], goods: ['bronze', 'tools'], modifiers: { military: 1.25, production: 1.15 } },
    description: 'Metal em liga. As primeiras ferramentas que duram mais que as mãos que as fizeram.',
    discovery: 'fundiu o bronze'
  },
  writing: {
    id: 'writing',
    name: 'Escrita',
    era: 'bronze',
    icon: '📜',
    unlocks: { buildings: ['library', 'temple'], modifiers: { research: 1.4 }, features: ['writing', 'diplomacy_pacts'] },
    description: 'A memória que sobrevive ao seu dono. Lei, dívida e história se tornam possíveis.',
    discovery: 'inventou a escrita'
  },

  // ========================= IRON AGE =========================
  iron_working: {
    id: 'iron_working',
    name: 'Metalurgia do Ferro',
    era: 'iron',
    icon: '⚔️',
    unlocks: { modifiers: { military: 1.4, production: 1.2 } },
    description: 'Mais duro, mais barato e muito mais comum que o bronze. A guerra se democratiza.',
    discovery: 'forjou o ferro'
  },
  mathematics: {
    id: 'mathematics',
    name: 'Matemática',
    era: 'iron',
    icon: '📐',
    unlocks: { modifiers: { research: 1.25, production: 1.1 } },
    description: 'A contagem vira prova. Os edifícios ficam mais altos e os impostos ficam precisos.',
    discovery: 'formalizou a matemática'
  },
  currency: {
    id: 'currency',
    name: 'Moeda e Câmbio',
    era: 'iron',
    icon: '🪙',
    unlocks: { buildings: ['market'], features: ['currency', 'trade_routes'], modifiers: { trade: 1.5 } },
    description: 'Moeda cunhada. A riqueza deixa de ser grãos no celeiro e se torna um número.',
    discovery: 'cunhou sua primeira moeda'
  },
  roads: {
    id: 'roads',
    name: 'Construção de Estradas',
    era: 'iron',
    icon: '🛣️',
    unlocks: { modifiers: { trade: 1.25, territory: 3, military: 1.1 } },
    description: 'Rotas pavimentadas. Exércitos e caravanas se movem mais rápido — geralmente nessa ordem.',
    discovery: 'pavimentou as primeiras grandes estradas'
  },

  // ========================= CLASSICAL AGE =========================
  engineering: {
    id: 'engineering',
    name: 'Engenharia',
    era: 'classical',
    icon: '🏗️',
    unlocks: { buildings: ['aqueduct', 'port', 'naval_yard'], modifiers: { production: 1.3, growth: 1.2, territory: 3 } },
    description: 'Aquedutos, guindastes e máquinas de cerco. As cidades finalmente podem crescer além de seus poços.',
    discovery: 'dominou a engenharia'
  },
  philosophy: {
    id: 'philosophy',
    name: 'Filosofia',
    era: 'classical',
    icon: '🧠',
    unlocks: { buildings: ['academy'], modifiers: { research: 1.45 } },
    description: 'Perguntar por que o rei é rei. Historicamente, um passatempo perigoso.',
    discovery: 'deu origem aos seus primeiros filósofos'
  },
  medicine: {
    id: 'medicine',
    name: 'Medicina',
    era: 'classical',
    icon: '⚕️',
    unlocks: { modifiers: { growth: 1.35 } },
    description: 'Menos pessoas morrem de coisas que não precisavam matá-las.',
    discovery: 'desenvolveu a medicina formal'
  },
  banking: {
    id: 'banking',
    name: 'Sistema Bancário',
    era: 'classical',
    icon: '🏦',
    unlocks: { buildings: ['bank'], features: ['banking'], modifiers: { trade: 1.5 } },
    description: 'Emprestar dinheiro que você não tem, contra riqueza que ainda não existe.',
    discovery: 'fundou seus primeiros bancos'
  },
  metallurgy: {
    id: 'metallurgy',
    name: 'Metalurgia',
    era: 'classical',
    icon: '🔩',
    unlocks: { goods: ['steel'], modifiers: { military: 1.35, production: 1.25 } },
    description: 'Aço, ligas e altos-fornos. O carvão deixa de ser uma curiosidade.',
    discovery: 'avançou a ciência dos metais'
  },

  // ========================= INDUSTRIAL AGE =========================
  printing_press: {
    id: 'printing_press',
    name: 'Imprensa',
    era: 'industrial',
    icon: '🖨️',
    unlocks: { modifiers: { research: 1.6, growth: 1.1 } },
    description: 'As ideias se reproduzem mais rápido do que as pessoas que as censuram.',
    discovery: 'construiu a imprensa'
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Pólvora',
    era: 'industrial',
    icon: '💥',
    unlocks: { goods: ['gunpowder'], features: ['conscription'], modifiers: { military: 1.7 } },
    description: 'Muralhas deixam de ser a resposta. Cavaleiros também.',
    discovery: 'transformou a pólvora em arma'
  },
  steam_power: {
    id: 'steam_power',
    name: 'Energia a Vapor',
    era: 'industrial',
    icon: '🚂',
    unlocks: { buildings: ['train_station'], features: ['railways'], modifiers: { production: 1.5, trade: 1.3 } },
    description: 'O trabalho deixa de ser limitado por quantos braços você tem.',
    discovery: 'dominou o vapor'
  },
  industrialization: {
    id: 'industrialization',
    name: 'Industrialização',
    era: 'industrial',
    icon: '🏭',
    unlocks: { buildings: ['factory', 'oil_well', 'refinery'], goods: ['oil', 'fuel', 'machinery'], features: ['mass_production'], modifiers: { production: 1.8, growth: 1.2 } },
    description: 'Produção em massa. Riqueza enorme, desigualdade enorme, e um novo tipo de política.',
    discovery: 'entrou na era industrial'
  },

  powered_flight: {
    id: 'powered_flight',
    name: 'Voo Motorizado',
    era: 'industrial',
    icon: '🛩️',
    unlocks: { buildings: ['airport'], modifiers: { research: 1.1 } },
    description: 'Um campo de pouso e uma máquina frágil que sai do chão. Pouca carga e pouco alcance — mas o terreno deixa de opinar.',
    discovery: 'levantou voo pela primeira vez'
  },

  // ========================= MODERN AGE =========================
  electricity: {
    id: 'electricity',
    name: 'Eletricidade',
    era: 'modern',
    icon: '⚡',
    unlocks: { goods: ['uranium'], modifiers: { production: 1.4, research: 1.4, growth: 1.15 } },
    description: 'Luz, motores e comunicação instantânea a qualquer distância.',
    discovery: 'eletrificou suas cidades'
  },
  aviation: {
    id: 'aviation',
    name: 'Aviation',
    era: 'modern',
    icon: '✈️',
    unlocks: { modifiers: { production: 1.15, research: 1.2 } },
    description: 'Aviões de linha: muito mais carga, muito mais alcance. Carga e passageiros passam a ignorar o terreno de verdade.',
    discovery: 'abriu suas linhas aéreas'
  },

  jet_age: {
    id: 'jet_age',
    name: 'Era do Jato',
    era: 'modern',
    icon: '✈️',
    unlocks: { modifiers: { production: 1.2, research: 1.25, growth: 1.1 } },
    description: 'A turbina. O dobro da velocidade do avião a hélice e nenhuma distância grande o bastante para importar.',
    discovery: 'entrou na era do jato'
  },
  mass_media: {
    id: 'mass_media',
    name: 'Mídia de Massa',
    era: 'modern',
    icon: '📡',
    unlocks: { modifiers: { research: 1.3, trade: 1.2 } },
    description: 'Quem controla a transmissão controla o que as pessoas acreditam ter acontecido.',
    discovery: 'construiu um aparato de mídia de massa'
  },
  radar_systems: {
    id: 'radar_systems',
    name: 'Sistemas de Radar',
    era: 'modern',
    icon: '📡',
    unlocks: { buildings: ['radar_station'], features: ['air_defense_grid'] },
    description: 'Varredura e rastreamento por ondas de rádio para detecção de aeronaves e projéteis antes do impacto visual.',
    discovery: 'instalou seus primeiros radares de alerta antecipado'
  },
  rocketry: {
    id: 'rocketry',
    name: 'Foguetes & Balística',
    era: 'modern',
    icon: '🚀',
    unlocks: { buildings: ['missile_silo', 'sam_site'], goods: ['missiles'] },
    description: 'Propulsão a combustível sólido e líquido para projéteis guiados de longo alcance.',
    discovery: 'dominou a tecnologia de foguetes e balística'
  },
  nuclear_fission: {
    id: 'nuclear_fission',
    name: 'Fissão Nuclear',
    era: 'modern',
    icon: '☢️',
    unlocks: { buildings: ['enrichment_facility'], features: ['nuclear_weapons'], modifiers: { production: 1.5, research: 1.6 } },
    description: 'A divisão do átomo: energia massiva e o poder de dissuasão estratégica absoluta.',
    discovery: 'desvendou os segredos da fissão nuclear'
  },
  drone_avionics: {
    id: 'drone_avionics',
    name: 'Aviônica & Drones',
    era: 'modern',
    icon: '🛸',
    unlocks: { buildings: ['drone_command', 'bomb_shelter'], features: ['drone_swarms'] },
    description: 'Veículos aéreos pilotados remotamente com sistemas de navegação autônoma e munições espreitadoras.',
    discovery: 'implementou frotas de drones autônomos'
  },

  // ========================= POLITICAL TRACK =========================
  tribalism: {
    id: 'tribalism',
    name: 'Tribalismo',
    era: 'stone',
    icon: '🪶',
    unlocks: { governments: ['tribe'] },
    description: 'Parentesco e anciãos. A autoridade alcança exatamente até onde todo mundo pode gritar.',
    discovery: 'organizou-se em tribos'
  },
  chiefdom: {
    id: 'chiefdom',
    name: 'Chefia Tribal',
    era: 'stone',
    icon: '🗿',
    unlocks: { governments: ['chiefdom'], modifiers: { growth: 1.1, territory: 1 } },
    description: 'Uma família reivindica o excedente, e os outros permitem.',
    discovery: 'coroou seu primeiro chefe'
  },
  feudalism: {
    id: 'feudalism',
    name: 'Feudalismo',
    era: 'bronze',
    icon: '🛡️',
    unlocks: {
      governments: ['feudal_kingdom'],
      buildings: ['keep'],
      modifiers: { military: 1.25, territory: 2, growth: 1.05 }
    },
    description: 'Terra concedida em troca de juramentos. A lealdade se torna uma forma de propriedade.',
    discovery: 'estabeleceu a ordem feudal'
  },
  monarchy: {
    id: 'monarchy',
    name: 'Monarquia',
    era: 'iron',
    icon: '👑',
    unlocks: {
      governments: ['monarchy'],
      buildings: ['palace'],
      modifiers: { growth: 1.15, trade: 1.1, territory: 3 }
    },
    description: 'A coroa supera os barões. A lei escrita substitui a lealdade pessoal.',
    discovery: 'consolidou o poder sob uma única coroa'
  },
  imperialism: {
    id: 'imperialism',
    name: 'Imperialismo',
    era: 'classical',
    icon: '🦅',
    unlocks: {
      governments: ['empire'],
      modifiers: { military: 1.3, territory: 6, trade: 1.2 }
    },
    description: 'Povos conquistados são governados, não absorvidos. O reino se torna um império.',
    discovery: 'proclamou-se um império'
  },
  constitutionalism: {
    id: 'constitutionalism',
    name: 'Constitucionalismo',
    era: 'industrial',
    icon: '📖',
    unlocks: {
      governments: ['constitutional_monarchy', 'republic'],
      modifiers: { research: 1.2, growth: 1.15, trade: 1.15 }
    },
    description: 'O soberano é limitado por um documento. Todos fingem que isso sempre foi o caso.',
    discovery: 'submeteu seu governante a uma constituição'
  },
  capitalism: {
    id: 'capitalism',
    name: 'Capitalismo',
    era: 'industrial',
    icon: '📈',
    unlocks: {
      governments: ['capitalist_state'],
      buildings: ['stock_exchange'],
      features: ['stock_market'],
      modifiers: { trade: 1.8, production: 1.3, growth: 1.1 }
    },
    description: 'O capital privado direciona a produção. O crescimento acelera; a desigualdade também.',
    discovery: 'abraçou o capitalismo'
  },
  communism: {
    id: 'communism',
    name: 'Comunismo',
    era: 'industrial',
    icon: '☭',
    unlocks: {
      governments: ['communist_state'],
      buildings: ['collective'],
      features: ['central_planning'],
      modifiers: { production: 1.55, growth: 1.25, military: 1.2 }
    },
    description: 'O estado direciona a produção em nome dos trabalhadores. O comércio sofre; a produção não.',
    discovery: 'declarou um estado dos trabalhadores'
  }
};

export const ALL_TECH_IDS: string[] = Object.keys(TECHNOLOGIES);

/** The eras in the order a realm passes through them. */
export const ERA_ORDER: TechEra[] = (Object.keys(TECH_ERAS) as TechEra[])
  .sort((a, b) => TECH_ERAS[a].order - TECH_ERAS[b].order);

/**
 * What a realm has to be before it reaches an era.
 *
 * Both numbers are things a player can count on the map — how many people the
 * realm feeds and how much it has built — so an age turns over because the world
 * visibly changed, not because a bar filled up. These are the pacing dials: turn
 * them down for a fast game, up for a long one.
 */
const ERA_GATES: Record<TechEra, { population: number; buildings: number }> = {
  stone: { population: 0, buildings: 0 },
  bronze: { population: 40, buildings: 12 },
  iron: { population: 110, buildings: 30 },
  classical: { population: 240, buildings: 60 },
  industrial: { population: 480, buildings: 110 },
  modern: { population: 900, buildings: 190 }
};
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
  mass_media: { copper: 0.9 },
  radar_systems: { copper: 1.2, steel: 0.8 },
  rocketry: { fuel: 2.0, steel: 1.8, gunpowder: 1.2 },
  nuclear_fission: { uranium: 2.5, steel: 1.5, fuel: 1.0 },
  drone_avionics: { fuel: 1.2, steel: 1.0, machinery: 1.5 }
};

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

/**
 * How advanced a realm is, and what that lets it do.
 *
 * This used to be a research tree: fifty-eight technologies, each with a cost,
 * prerequisites, mutually exclusive branches, research points produced per year
 * by libraries, a diffusion discount from whatever the neighbours knew, and a
 * choice of what to pursue next. All of it was managed through a screen of
 * tables, and none of it was visible on the map.
 *
 * What was visible is the era: stone gives way to bronze gives way to iron, and
 * the buildings, units and sprites change with it. So the era is the whole model
 * now. It advances on its own as a realm grows, and everything a realm can do is
 * read off it — the technology table survives purely as the data that says which
 * era unlocks what, which is what it was always really carrying.
 */
export class ResearchState {
  /** How far this realm has come. Everything it can do is derived from this. */
  public era: TechEra = 'stone';

  /**
   * Every technology the era carries, cached.
   *
   * Derived, not stored: an era knows what an era knows. Rebuilt when the era
   * turns over, because the rest of the simulation asks this question constantly
   * and rebuilding a set of sixty ids per call is a waste.
   */
  private cachedKnown: Set<string> | null = null;
  private cachedFor: TechEra | null = null;

  public get known(): Set<string> {
    if (this.cachedKnown && this.cachedFor === this.era) return this.cachedKnown;
    const reached = TECH_ERAS[this.era].order;
    const known = new Set<string>();
    for (const id of ALL_TECH_IDS) {
      if (TECH_ERAS[TECHNOLOGIES[id].era].order <= reached) known.add(id);
    }
    this.cachedKnown = known;
    this.cachedFor = this.era;
    return known;
  }

  /**
   * Moves the realm on when it has outgrown its era.
   *
   * A realm advances by being a bigger, more built place than it was — which is
   * a thing you can see on the map, unlike a research point. Returns the new era
   * when it changed, so the caller can announce it.
   */
  public advance(population: number, buildings: number): TechEra | null {
    const next = ERA_ORDER[TECH_ERAS[this.era].order + 1];
    if (!next) return null;
    const gate = ERA_GATES[next];
    if (population < gate.population || buildings < gate.buildings) return null;
    this.era = next;
    return next;
  }

  /**
   * Pushes the realm into the next age regardless of whether it has grown into
   * one. For the scholar whose life's work is the breakthrough itself.
   */
  public forceAdvance(): TechEra | null {
    const next = ERA_ORDER[TECH_ERAS[this.era].order + 1];
    if (!next) return null;
    this.era = next;
    return next;
  }

  public knows(techId: string): boolean {
    return this.known.has(techId);
  }

  public knowsFeature(feature: TechFeature): boolean {
    for (const id of this.known) {
      if (TECHNOLOGIES[id]?.unlocks.features?.includes(feature)) return true;
    }
    return false;
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
    total.research = damped(total.research, RESEARCH_DAMPING);
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
    return this.era;
  }

  public serialize(): any {
    return { era: this.era };
  }

  public deserialize(data: any): void {
    if (!data) return;
    if (data.era && TECH_ERAS[data.era as TechEra]) {
      this.era = data.era as TechEra;
      return;
    }
    // A save from the tree era carries a list of known technologies instead.
    // The era it had reached is the furthest era anything on that list belongs
    // to, which is exactly what `currentEra` used to compute.
    let best: TechEra = 'stone';
    for (const id of (data.known ?? []) as string[]) {
      const tech = TECHNOLOGIES[id];
      if (tech && TECH_ERAS[tech.era].order > TECH_ERAS[best].order) best = tech.era;
    }
    this.era = best;
  }
}
