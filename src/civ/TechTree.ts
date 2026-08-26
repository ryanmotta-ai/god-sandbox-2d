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
 * The real research cost of a technology.
 *
 * `diffusion` is the discount, 0..1, earned from neighbours who already know it —
 * see `ResearchState.diffusionOf`. Knowledge that exists somewhere in the world is
 * cheaper to reach than knowledge nobody has: there are people to ask, artefacts
 * to copy and craftsmen to poach.
 */
export function techCost(tech: TechDefinition, cityCount: number = 1, diffusion: number = 0): number {
  const expansionFactor = 1 + Math.max(0, (cityCount - 1) * 0.04);
  const discount = 1 - Math.max(0, Math.min(MAX_DIFFUSION_DISCOUNT, diffusion));
  return Math.round(tech.cost * ERA_COST_SCALE[tech.era] * expansionFactor * discount);
}

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
    name: 'Ferramentas de Pedra',
    track: 'craft',
    era: 'stone',
    icon: '🪓',
    cost: 30,
    requires: [],
    unlocks: { modifiers: { production: 1.15 }, buildings: ['lumber_camp'] },
    description: 'Sílex lascado. Tudo o mais na história se segue a partir disso.',
    discovery: 'aprendeu a moldar pedra em ferramentas'
  },
  fire_mastery: {
    id: 'fire_mastery',
    name: 'Domínio do Fogo',
    track: 'craft',
    era: 'stone',
    icon: '🔥',
    cost: 40,
    requires: ['stone_tools'],
    unlocks: { modifiers: { growth: 1.1, military: 1.1 } },
    description: 'Calor, comida cozida e uma arma que se espalha sozinha.',
    discovery: 'domou o fogo'
  },
  agriculture: {
    id: 'agriculture',
    name: 'Agricultura',
    track: 'craft',
    era: 'stone',
    icon: '🌾',
    cost: 60,
    requires: ['stone_tools'],
    unlocks: { buildings: ['farm', 'granary'], goods: ['cotton', 'spices'], modifiers: { growth: 1.35 } },
    description: 'Plantar em vez de forragear. As populações param de vagar e começam a contar.',
    discovery: 'começou a cultivar a terra'
  },
  animal_husbandry: {
    id: 'animal_husbandry',
    name: 'Pecuária',
    track: 'craft',
    era: 'stone',
    icon: '🐄',
    cost: 70,
    requires: ['agriculture'],
    unlocks: { buildings: ['pasture'], goods: ['horses', 'furs'], modifiers: { growth: 1.15, production: 1.1 } },
    description: 'Rebanhos que te seguem são melhores que rebanhos que você persegue.',
    discovery: 'domesticou o gado'
  },
  sailing: {
    id: 'sailing',
    name: 'Navegação',
    track: 'craft',
    era: 'stone',
    icon: '⛵',
    cost: 40,
    requires: ['stone_tools'],
    unlocks: { buildings: ['harbor'], features: ['maritime_trade', 'colonisation'], modifiers: { trade: 1.3 } },
    description: 'Canoas e ancoradouros de madeira. O mar deixa de ser um muro e se torna uma estrada.',
    discovery: 'aprendeu a navegar pelas águas costeiras'
  },

  // ========================= BRONZE AGE =========================
  pottery: {
    id: 'pottery',
    name: 'Cerâmica e Tecelagem',
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
    description: 'Armazenamento e tecido. O excedente torna-se possível, e o comércio também.',
    discovery: 'dominou a cerâmica e a tecelagem'
  },
  mining: {
    id: 'mining',
    name: 'Mineração',
    track: 'craft',
    era: 'bronze',
    icon: '⛏️',
    cost: 130,
    requires: ['stone_tools'],
    unlocks: { buildings: ['mine', 'quarry'], goods: ['copper', 'tin', 'iron', 'coal', 'salt', 'gold', 'gems', 'saltpeter'], modifiers: { production: 1.2 } },
    description: 'Cavar abaixo da superfície pelo que a terra se recusa a dar livremente.',
    discovery: 'escavou os primeiros poços de mina'
  },
  masonry: {
    id: 'masonry',
    name: 'Alvenaria',
    track: 'craft',
    era: 'bronze',
    icon: '🧱',
    cost: 150,
    requires: ['mining'],
    unlocks: { buildings: ['wall'], modifiers: { military: 1.2, territory: 2 } },
    description: 'Pedra talhada. As cidades ganham muros, e os muros ganham significado.',
    discovery: 'ergueu suas primeiras muralhas de pedra'
  },
  bronze_working: {
    id: 'bronze_working',
    name: 'Metalurgia do Bronze',
    track: 'craft',
    era: 'bronze',
    icon: '⚒️',
    cost: 180,
    requires: ['mining', 'fire_mastery'],
    unlocks: { buildings: ['smithy', 'barracks'], goods: ['bronze', 'tools'], modifiers: { military: 1.25, production: 1.15 } },
    description: 'Metal em liga. As primeiras ferramentas que duram mais que as mãos que as fizeram.',
    discovery: 'fundiu o bronze'
  },
  writing: {
    id: 'writing',
    name: 'Escrita',
    track: 'craft',
    era: 'bronze',
    icon: '📜',
    cost: 200,
    requires: ['pottery'],
    unlocks: { buildings: ['library', 'temple'], modifiers: { research: 1.4 }, features: ['writing', 'diplomacy_pacts'] },
    description: 'A memória que sobrevive ao seu dono. Lei, dívida e história se tornam possíveis.',
    discovery: 'inventou a escrita'
  },

  // ========================= IRON AGE =========================
  iron_working: {
    id: 'iron_working',
    name: 'Metalurgia do Ferro',
    track: 'craft',
    era: 'iron',
    icon: '⚔️',
    cost: 280,
    requires: ['bronze_working'],
    unlocks: { modifiers: { military: 1.4, production: 1.2 } },
    description: 'Mais duro, mais barato e muito mais comum que o bronze. A guerra se democratiza.',
    discovery: 'forjou o ferro'
  },
  mathematics: {
    id: 'mathematics',
    name: 'Matemática',
    track: 'craft',
    era: 'iron',
    icon: '📐',
    cost: 300,
    requires: ['writing'],
    unlocks: { modifiers: { research: 1.25, production: 1.1 } },
    description: 'A contagem vira prova. Os edifícios ficam mais altos e os impostos ficam precisos.',
    discovery: 'formalizou a matemática'
  },
  currency: {
    id: 'currency',
    name: 'Moeda e Câmbio',
    track: 'politics',
    era: 'iron',
    icon: '🪙',
    cost: 280,
    requires: ['mathematics', 'mining'],
    unlocks: { buildings: ['market'], features: ['currency', 'trade_routes'], modifiers: { trade: 1.5 } },
    description: 'Moeda cunhada. A riqueza deixa de ser grãos no celeiro e se torna um número.',
    discovery: 'cunhou sua primeira moeda'
  },
  roads: {
    id: 'roads',
    name: 'Construção de Estradas',
    track: 'craft',
    era: 'iron',
    icon: '🛣️',
    cost: 300,
    requires: ['masonry'],
    unlocks: { modifiers: { trade: 1.25, territory: 3, military: 1.1 } },
    description: 'Rotas pavimentadas. Exércitos e caravanas se movem mais rápido — geralmente nessa ordem.',
    discovery: 'pavimentou as primeiras grandes estradas'
  },

  // ========================= CLASSICAL AGE =========================
  engineering: {
    id: 'engineering',
    name: 'Engenharia',
    track: 'craft',
    era: 'classical',
    icon: '🏗️',
    cost: 480,
    requires: ['mathematics', 'masonry'],
    unlocks: { buildings: ['aqueduct', 'port', 'naval_yard'], modifiers: { production: 1.3, growth: 1.2, territory: 3 } },
    description: 'Aquedutos, guindastes e máquinas de cerco. As cidades finalmente podem crescer além de seus poços.',
    discovery: 'dominou a engenharia'
  },
  philosophy: {
    id: 'philosophy',
    name: 'Filosofia',
    track: 'craft',
    era: 'classical',
    icon: '🧠',
    cost: 500,
    requires: ['writing'],
    unlocks: { buildings: ['academy'], modifiers: { research: 1.45 } },
    description: 'Perguntar por que o rei é rei. Historicamente, um passatempo perigoso.',
    discovery: 'deu origem aos seus primeiros filósofos'
  },
  medicine: {
    id: 'medicine',
    name: 'Medicina',
    track: 'craft',
    era: 'classical',
    icon: '⚕️',
    cost: 520,
    requires: ['philosophy'],
    unlocks: { modifiers: { growth: 1.35 } },
    description: 'Menos pessoas morrem de coisas que não precisavam matá-las.',
    discovery: 'desenvolveu a medicina formal'
  },
  banking: {
    id: 'banking',
    name: 'Sistema Bancário',
    track: 'craft',
    era: 'classical',
    icon: '🏦',
    cost: 600,
    requires: ['currency', 'mathematics'],
    unlocks: { buildings: ['bank'], features: ['banking'], modifiers: { trade: 1.5 } },
    description: 'Emprestar dinheiro que você não tem, contra riqueza que ainda não existe.',
    discovery: 'fundou seus primeiros bancos'
  },
  metallurgy: {
    id: 'metallurgy',
    name: 'Metalurgia',
    track: 'craft',
    era: 'classical',
    icon: '🔩',
    cost: 620,
    requires: ['iron_working', 'engineering'],
    unlocks: { goods: ['steel'], modifiers: { military: 1.35, production: 1.25 } },
    description: 'Aço, ligas e altos-fornos. O carvão deixa de ser uma curiosidade.',
    discovery: 'avançou a ciência dos metais'
  },

  // ========================= INDUSTRIAL AGE =========================
  printing_press: {
    id: 'printing_press',
    name: 'Imprensa',
    track: 'craft',
    era: 'industrial',
    icon: '🖨️',
    cost: 850,
    requires: ['philosophy', 'metallurgy'],
    unlocks: { modifiers: { research: 1.6, growth: 1.1 } },
    description: 'As ideias se reproduzem mais rápido do que as pessoas que as censuram.',
    discovery: 'construiu a imprensa'
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Pólvora',
    track: 'craft',
    era: 'industrial',
    icon: '💥',
    cost: 900,
    requires: ['metallurgy'],
    unlocks: { goods: ['gunpowder'], features: ['conscription'], modifiers: { military: 1.7 } },
    description: 'Muralhas deixam de ser a resposta. Cavaleiros também.',
    discovery: 'transformou a pólvora em arma'
  },
  steam_power: {
    id: 'steam_power',
    name: 'Energia a Vapor',
    track: 'craft',
    era: 'industrial',
    icon: '🚂',
    cost: 1100,
    requires: ['engineering', 'metallurgy'],
    unlocks: { buildings: ['train_station'], features: ['railways'], modifiers: { production: 1.5, trade: 1.3 } },
    description: 'O trabalho deixa de ser limitado por quantos braços você tem.',
    discovery: 'dominou o vapor'
  },
  industrialization: {
    id: 'industrialization',
    name: 'Industrialização',
    track: 'craft',
    era: 'industrial',
    icon: '🏭',
    cost: 1400,
    requires: ['steam_power', 'banking'],
    unlocks: { buildings: ['factory', 'oil_well', 'refinery'], goods: ['oil', 'fuel', 'machinery'], features: ['mass_production'], modifiers: { production: 1.8, growth: 1.2 } },
    description: 'Produção em massa. Riqueza enorme, desigualdade enorme, e um novo tipo de política.',
    discovery: 'entrou na era industrial'
  },

  powered_flight: {
    id: 'powered_flight',
    name: 'Voo Motorizado',
    track: 'craft',
    era: 'industrial',
    icon: '🛩️',
    cost: 1600,
    requires: ['industrialization'],
    unlocks: { buildings: ['airport'], modifiers: { research: 1.1 } },
    description: 'Um campo de pouso e uma máquina frágil que sai do chão. Pouca carga e pouco alcance — mas o terreno deixa de opinar.',
    discovery: 'levantou voo pela primeira vez'
  },

  // ========================= MODERN AGE =========================
  electricity: {
    id: 'electricity',
    name: 'Eletricidade',
    track: 'craft',
    era: 'modern',
    icon: '⚡',
    cost: 1800,
    requires: ['industrialization'],
    unlocks: { goods: ['uranium'], modifiers: { production: 1.4, research: 1.4, growth: 1.15 } },
    description: 'Luz, motores e comunicação instantânea a qualquer distância.',
    discovery: 'eletrificou suas cidades'
  },
  aviation: {
    id: 'aviation',
    name: 'Aviation',
    track: 'craft',
    era: 'modern',
    icon: '✈️',
    cost: 2200,
    requires: ['electricity', 'powered_flight'],
    unlocks: { modifiers: { production: 1.15, research: 1.2 } },
    description: 'Aviões de linha: muito mais carga, muito mais alcance. Carga e passageiros passam a ignorar o terreno de verdade.',
    discovery: 'abriu suas linhas aéreas'
  },

  jet_age: {
    id: 'jet_age',
    name: 'Era do Jato',
    track: 'craft',
    era: 'modern',
    icon: '✈️',
    cost: 2800,
    requires: ['aviation'],
    unlocks: { modifiers: { production: 1.2, research: 1.25, growth: 1.1 } },
    description: 'A turbina. O dobro da velocidade do avião a hélice e nenhuma distância grande o bastante para importar.',
    discovery: 'entrou na era do jato'
  },
  mass_media: {
    id: 'mass_media',
    name: 'Mídia de Massa',
    track: 'craft',
    era: 'modern',
    icon: '📡',
    cost: 2100,
    requires: ['electricity', 'printing_press'],
    unlocks: { modifiers: { research: 1.3, trade: 1.2 } },
    description: 'Quem controla a transmissão controla o que as pessoas acreditam ter acontecido.',
    discovery: 'construiu um aparato de mídia de massa'
  },
  radar_systems: {
    id: 'radar_systems',
    name: 'Sistemas de Radar',
    track: 'craft',
    era: 'modern',
    icon: '📡',
    cost: 2400,
    requires: ['electricity', 'aviation'],
    unlocks: { buildings: ['radar_station'], features: ['air_defense_grid'] },
    description: 'Varredura e rastreamento por ondas de rádio para detecção de aeronaves e projéteis antes do impacto visual.',
    discovery: 'instalou seus primeiros radares de alerta antecipado'
  },
  rocketry: {
    id: 'rocketry',
    name: 'Foguetes & Balística',
    track: 'craft',
    era: 'modern',
    icon: '🚀',
    cost: 3000,
    requires: ['gunpowder', 'jet_age'],
    unlocks: { buildings: ['missile_silo', 'sam_site'], goods: ['missiles'] },
    description: 'Propulsão a combustível sólido e líquido para projéteis guiados de longo alcance.',
    discovery: 'dominou a tecnologia de foguetes e balística'
  },
  nuclear_fission: {
    id: 'nuclear_fission',
    name: 'Fissão Nuclear',
    track: 'craft',
    era: 'modern',
    icon: '☢️',
    cost: 4200,
    requires: ['electricity', 'rocketry'],
    unlocks: { buildings: ['enrichment_facility'], features: ['nuclear_weapons'], modifiers: { production: 1.5, research: 1.6 } },
    description: 'A divisão do átomo: energia massiva e o poder de dissuasão estratégica absoluta.',
    discovery: 'desvendou os segredos da fissão nuclear'
  },
  drone_avionics: {
    id: 'drone_avionics',
    name: 'Aviônica & Drones',
    track: 'craft',
    era: 'modern',
    icon: '🛸',
    cost: 3400,
    requires: ['mass_media', 'jet_age'],
    unlocks: { buildings: ['drone_command', 'bomb_shelter'], features: ['drone_swarms'] },
    description: 'Veículos aéreos pilotados remotamente com sistemas de navegação autônoma e munições espreitadoras.',
    discovery: 'implementou frotas de drones autônomos'
  },

  // ========================= POLITICAL TRACK =========================
  tribalism: {
    id: 'tribalism',
    name: 'Tribalismo',
    track: 'politics',
    era: 'stone',
    icon: '🪶',
    cost: 0,
    requires: [],
    unlocks: { governments: ['tribe'] },
    description: 'Parentesco e anciãos. A autoridade alcança exatamente até onde todo mundo pode gritar.',
    discovery: 'organizou-se em tribos'
  },
  chiefdom: {
    id: 'chiefdom',
    name: 'Chefia Tribal',
    track: 'politics',
    era: 'stone',
    icon: '🗿',
    cost: 80,
    requires: ['tribalism', 'agriculture'],
    unlocks: { governments: ['chiefdom'], modifiers: { growth: 1.1, territory: 1 } },
    description: 'Uma família reivindica o excedente, e os outros permitem.',
    discovery: 'coroou seu primeiro chefe'
  },
  feudalism: {
    id: 'feudalism',
    name: 'Feudalismo',
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
    description: 'Terra concedida em troca de juramentos. A lealdade se torna uma forma de propriedade.',
    discovery: 'estabeleceu a ordem feudal'
  },
  monarchy: {
    id: 'monarchy',
    name: 'Monarquia',
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
    description: 'A coroa supera os barões. A lei escrita substitui a lealdade pessoal.',
    discovery: 'consolidou o poder sob uma única coroa'
  },
  imperialism: {
    id: 'imperialism',
    name: 'Imperialismo',
    track: 'politics',
    era: 'classical',
    icon: '🦅',
    cost: 780,
    requires: ['monarchy', 'roads'],
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
    track: 'politics',
    era: 'industrial',
    icon: '📖',
    cost: 1200,
    requires: ['monarchy', 'printing_press', 'philosophy'],
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
    description: 'O capital privado direciona a produção. O crescimento acelera; a desigualdade também.',
    discovery: 'abraçou o capitalismo'
  },
  communism: {
    id: 'communism',
    name: 'Comunismo',
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
    description: 'O estado direciona a produção em nome dos trabalhadores. O comércio sofre; a produção não.',
    discovery: 'declarou um estado dos trabalhadores'
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
  mass_media: { copper: 0.9 },
  radar_systems: { copper: 1.2, steel: 0.8 },
  rocketry: { fuel: 2.0, steel: 1.8, gunpowder: 1.2 },
  nuclear_fission: { uranium: 2.5, steel: 1.5, fuel: 1.0 },
  drone_avionics: { fuel: 1.2, steel: 1.0, machinery: 1.5 }
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

  /**
   * Diffusion discount per technology, 0..1, refreshed once a year by the
   * civilization engine from the realms this one has actually met.
   *
   * Derived, so it is not serialised — the first yearly tick after a load fills it
   * in again. Held here rather than recomputed at each call site so the interface
   * shows the player the same cost the simulation is charging.
   */
  public diffusion: Map<string, number> = new Map();

  public knows(techId: string): boolean {
    return this.known.has(techId);
  }

  public diffusionOf(techId: string): number {
    return this.diffusion.get(techId) ?? 0;
  }

  /** Cost of a technology to *this* realm, contact and all. */
  public costOf(tech: TechDefinition, cityCount: number): number {
    return techCost(tech, cityCount, this.diffusionOf(tech.id));
  }

  /**
   * Recomputes the discounts from the realms this one knows about.
   *
   * `peers` is every realm in contact; only their known sets are read, so a realm
   * learns nothing from a civilisation it has never met — which is the whole point.
   */
  public refreshDiffusion(peers: Iterable<ResearchState>): void {
    const counts = new Map<string, number>();
    for (const peer of peers) {
      for (const id of peer.known) {
        if (this.known.has(id)) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    this.diffusion.clear();
    for (const [id, peersKnowing] of counts) {
      this.diffusion.set(id, Math.min(MAX_DIFFUSION_DISCOUNT, peersKnowing * DIFFUSION_PER_PEER));
    }
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

  /** Completes all technologies belonging to a specific era. */
  public completeEra(era: TechEra): void {
    for (const tech of Object.values(TECHNOLOGIES)) {
      if (tech.era === era && !this.forbidden.has(tech.id)) {
        this.complete(tech.id);
      }
    }
  }

  /** Completes every non-forbidden technology in the entire tree. */
  public completeAll(): void {
    for (const tech of Object.values(TECHNOLOGIES)) {
      if (!this.forbidden.has(tech.id)) {
        this.complete(tech.id);
      }
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
