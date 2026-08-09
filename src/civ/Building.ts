import { GoodId } from './Goods';
import type { BuildingArchitecturalStamp } from './ArchitecturalProfile';
import type { BuildingUrbanContext } from './UrbanDistricts';

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
    name: 'Centro da Vila',
    icon: '🏛️',
    category: 'core',
    maxHp: 500,
    cost: {},
    housing: 5,
    storage: 200,
    produces: { food: 2 },
    unique: true,
    description: 'O coração do assentamento. Onde o primeiro fogo foi aceso.'
  },
  house: {
    type: 'house',
    name: 'Casa',
    icon: '🏠',
    category: 'core',
    maxHp: 150,
    cost: { wood: 20 },
    housing: 4,
    description: 'Abrigo. Cada cidadão precisa de um ou o assentamento para de crescer.'
  },

  farm: {
    type: 'farm',
    name: 'Fazenda',
    icon: '🌾',
    category: 'food',
    maxHp: 100,
    cost: { wood: 15 },
    produces: { food: 10 },
    jobs: 2,
    resourceTargets: ['food', 'cotton', 'spices'],
    resourceMode: 'preferred',
    extractionRate: 3,
    description: 'Campos lavrados. Comida primeiro; regiões férteis também podem se especializar em algodão ou especiarias.'
  },
  granary: {
    type: 'granary',
    name: 'Celeiro',
    icon: '🏚️',
    category: 'food',
    maxHp: 180,
    cost: { wood: 30, stone: 15 },
    storage: 250,
    produces: { food: 3 },
    unique: true,
    description: 'Excedente armazenado. Um assentamento com um celeiro sobrevive a um inverno rigoroso.'
  },
  pasture: {
    type: 'pasture',
    name: 'Pastagem',
    icon: '🐄',
    category: 'food',
    maxHp: 120,
    cost: { wood: 20 },
    produces: { food: 6 },
    jobs: 2,
    resourceTargets: ['horses', 'furs'],
    resourceMode: 'preferred',
    extractionRate: 2.5,
    description: 'Rebanhos, currais e áreas de caça manejadas. Regiões de cavalos e peles tornam-se verdadeiras especialidades econômicas.'
  },

  lumber_camp: {
    type: 'lumber_camp',
    name: 'Acampamento Madeireiro',
    icon: '🪵',
    category: 'extraction',
    maxHp: 120,
    cost: { wood: 10 },
    produces: { wood: 8 },
    jobs: 2,
    resourceTargets: ['wood', 'rubber'],
    resourceMode: 'required',
    extractionRate: 8,
    description: 'Silvicultura organizada. Florestas de madeira e seringais tropicais tornam-se locais produtivos.'
  },
  quarry: {
    type: 'quarry',
    name: 'Pedreira',
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
    description: 'Extração de pedra e argila. A arquitetura durável começa com um depósito real sob o local.'
  },
  mine: {
    type: 'mine',
    name: 'Mina',
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
    description: 'Um poço escavado em um veio mineral. A mina extrai qualquer geologia que esteja realmente sob ela.'
  },

  workshop: {
    type: 'workshop',
    name: 'Oficina',
    icon: '🪡',
    category: 'craft',
    maxHp: 160,
    cost: { wood: 30, stone: 10 },
    produces: { cloth: 4 },
    jobs: 3,
    craftCapacity: 3,
    description: 'Artesãos e tecelões. Receitas em Goods.ts decidem o que esta oficina pode realmente fabricar.'
  },
  smithy: {
    type: 'smithy',
    name: 'Forja',
    icon: '⚒️',
    category: 'craft',
    maxHp: 200,
    cost: { wood: 30, stone: 25 },
    produces: { tools: 4 },
    jobs: 4,
    craftCapacity: 2.6,
    description: 'Fundidores e ferreiros. Bronze, aço, ferramentas e pólvora competem pela mesma capacidade especializada.'
  },
  factory: {
    type: 'factory',
    name: 'Fábrica',
    icon: '🏭',
    category: 'craft',
    maxHp: 400,
    cost: { stone: 80, steel: 45, tools: 20 },
    produces: { machinery: 12 },
    jobs: 12,
    craftCapacity: 5.5,
    description: 'Produção em massa. Sua produção é baseada em receitas; sem aço, borracha e combustível, as máquinas silenciam.'
  },

  oil_well: {
    type: 'oil_well',
    name: 'Poço de Petróleo',
    icon: '🛢️',
    category: 'extraction',
    maxHp: 260,
    cost: { steel: 35, tools: 12 },
    produces: { oil: 12 },
    jobs: 5,
    resourceTargets: ['oil'],
    resourceMode: 'required',
    extractionRate: 12,
    description: 'Uma torre de perfuração em uma verdadeira bacia de petróleo. Sem bacia, sem poço; sem óleo, sem logística industrial.'
  },
  refinery: {
    type: 'refinery',
    name: 'Refinaria',
    icon: '⛽',
    category: 'craft',
    maxHp: 320,
    cost: { steel: 35, stone: 70, tools: 16 },
    produces: { fuel: 9 },
    jobs: 7,
    craftCapacity: 4.5,
    description: 'Refina petróleo bruto em combustível usando o sistema de receitas. Frotas modernas agora dependem da capacidade real de refino.'
  },

  library: {
    type: 'library',
    name: 'Biblioteca',
    icon: '📚',
    category: 'knowledge',
    maxHp: 180,
    cost: { wood: 40, stone: 30 },
    research: 6,
    jobs: 2,
    unique: true,
    description: 'Escrita acumulada. Conhecimento que sobrevive às pessoas que o descobriram.'
  },
  academy: {
    type: 'academy',
    name: 'Academia',
    icon: '🎓',
    category: 'knowledge',
    maxHp: 260,
    cost: { stone: 70, wood: 40, gold: 20 },
    research: 16,
    consumes: { food: 6 },
    jobs: 5,
    unique: true,
    description: 'Acadêmicos pagos para pensar. Caro, e a única maneira de alcançar a era moderna.'
  },
  temple: {
    type: 'temple',
    name: 'Templo',
    icon: '⛩️',
    category: 'knowledge',
    maxHp: 300,
    cost: { stone: 50, wood: 25 },
    research: 3,
    jobs: 2,
    unique: true,
    description: 'Um lugar para fazer petições a quem estiver segurando o pincel.'
  },

  market: {
    type: 'market',
    name: 'Mercado',
    icon: '🏪',
    category: 'commerce',
    maxHp: 200,
    cost: { wood: 40, stone: 20 },
    produces: { gold: 5 },
    jobs: 3,
    unique: true,
    description: 'Onde o excedente se torna moeda, e a moeda se torna uma razão para construir estradas.'
  },
  harbor: {
    type: 'harbor',
    name: 'Porto Costeiro',
    icon: '⚓',
    category: 'commerce',
    maxHp: 250,
    cost: { wood: 60, stone: 30 },
    produces: { food: 5, gold: 3 },
    jobs: 4,
    requiresCoast: true,
    unique: true,
    description: 'Um porto costeiro para pesca e comércio marítimo inicial. Agora é necessário antes que o comércio marítimo possa começar.'
  },
  bank: {
    type: 'bank',
    name: 'Banco',
    icon: '🏦',
    category: 'commerce',
    maxHp: 280,
    cost: { stone: 80, gold: 40 },
    produces: { gold: 16 },
    jobs: 4,
    unique: true,
    description: 'Depósitos, empréstimos e juros. A riqueza começa a se multiplicar.'
  },
  stock_exchange: {
    type: 'stock_exchange',
    name: 'Bolsa de Valores',
    icon: '📈',
    category: 'commerce',
    maxHp: 320,
    cost: { stone: 120, gold: 100, tools: 20 },
    produces: { gold: 40 },
    jobs: 6,
    unique: true,
    description: 'Propriedade negociada como papel. O crescimento acelera, assim como as crises.'
  },
  collective: {
    type: 'collective',
    name: 'Coletiva',
    icon: '☭',
    category: 'commerce',
    maxHp: 320,
    cost: { stone: 90, iron: 50, tools: 15 },
    produces: { food: 20 },
    jobs: 10,
    unique: true,
    description: 'Comida e produção básica agrupadas por plano. Ferramentas fabricadas ainda exigem insumos reais de forja e capacidade industrial.'
  },

  aqueduct: {
    type: 'aqueduct',
    name: 'Aqueduto',
    icon: '🌊',
    category: 'infrastructure',
    maxHp: 350,
    cost: { stone: 90, tools: 8 },
    housing: 12,
    produces: { food: 4 },
    unique: true,
    description: 'Água doce em escala. As cidades podem finalmente crescer além de seus poços.'
  },
  wall: {
    type: 'wall',
    name: 'Muralha',
    icon: '🧱',
    category: 'infrastructure',
    maxHp: 400,
    cost: { stone: 40 },
    defense: 1.25,
    description: 'Pedra lavrada entre o seu povo e as ambições de todos os outros.'
  },
  port: {
    type: 'port',
    name: 'Porto',
    icon: '🚢',
    category: 'infrastructure',
    maxHp: 250,
    cost: { wood: 55, stone: 90, tools: 12 },
    produces: { gold: 5 },
    jobs: 6,
    requiresCoast: true,
    unique: true,
    description: 'Docas de águas profundas, guindastes e armazéns. Navegação a vapor e industrial avançada requerem um porto de verdade.'
  },

  barracks: {
    type: 'barracks',
    name: 'Quartel',
    icon: '🏯',
    category: 'power',
    maxHp: 300,
    cost: { wood: 40, stone: 30 },
    consumes: { food: 5 },
    defense: 1.4,
    jobs: 4,
    description: 'Soldados profissionais, alimentados o ano todo, haja ou não uma guerra.'
  },
  keep: {
    type: 'keep',
    name: 'Forte',
    icon: '🏰',
    category: 'power',
    maxHp: 600,
    cost: { stone: 100, wood: 40, tools: 6 },
    defense: 1.8,
    housing: 6,
    consumes: { food: 6 },
    unique: true,
    description: 'A sede fortificada de um lorde. A forma física da autoridade feudal.'
  },
  palace: {
    type: 'palace',
    name: 'Palácio',
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
    description: 'A sede de uma coroa que governa em vez de apenas reinar.'
  },

  monument: {
    type: 'monument',
    name: 'Estátua do Fundador',
    icon: '🗿',
    category: 'infrastructure',
    maxHp: 1000,
    cost: { stone: 200, gold: 100 },
    housing: 10,
    produces: { gold: 15 },
    unique: true,
    description: 'Um monumento colossal financiado por um Grande Construtor. Concede +30% de Estabilidade do Reino.'
  },
  great_library: {
    type: 'great_library',
    name: 'Grande Biblioteca da Sabedoria',
    icon: '📚',
    category: 'knowledge',
    maxHp: 900,
    cost: { stone: 150, wood: 150, gold: 80 },
    research: 50,
    unique: true,
    description: 'Uma maravilha mundial armazenando séculos de conhecimento científico e histórico.'
  },
  grand_aqueduct: {
    type: 'grand_aqueduct',
    name: 'Grande Aqueduto das Nações',
    icon: '🌊',
    category: 'infrastructure',
    maxHp: 850,
    cost: { stone: 250, tools: 20 },
    housing: 30,
    produces: { food: 20 },
    unique: true,
    description: 'Uma maravilha da engenharia fornecendo água doce infinita para a cidade.'
  },
  colosseum: {
    type: 'colosseum',
    name: 'Grande Coliseu das Lendas',
    icon: '🏛️',
    category: 'power',
    maxHp: 1200,
    cost: { stone: 300, gold: 150 },
    defense: 2.0,
    housing: 15,
    unique: true,
    description: 'Uma arena lendária inspirando a moral militar e sufocando a agitação civil.'
  }
};

export const ALL_BUILDING_TYPES: BuildingType[] = Object.keys(BUILDINGS) as BuildingType[];

/** Buildings available with no technology at all — every settlement starts with these. */
export const BASE_BUILDINGS: BuildingType[] = ['town_center', 'house'];

export type UrbanHistoricalPhase = 'settlement' | 'village' | 'city' | 'great_city' | 'metropolis';

export type BuildingLifecycleState =
  | 'construction'
  | 'normal'
  | 'damaged'
  | 'abandoned'
  | 'ruin'
  | 'reconstruction';

export type BuildingDamageCause = 'fire' | 'war' | 'disaster' | 'abandonment' | 'unknown';

export interface BuildingLifecycleTransition {
  from: BuildingLifecycleState;
  to: BuildingLifecycleState;
  year: number;
  cause: BuildingDamageCause | 'construction' | 'recovery' | 'repair';
}

/** CITY-V4 physical role. Every piece still uses the ordinary wall gameplay type. */
export type FortificationRole = 'segment' | 'corner' | 'tower' | 'gate';

export interface BuildingData {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  level: number;
  hp: number;
  maxHp: number;
  cityId: string;
  builtYear: number;
  originPhase: UrbanHistoricalPhase;
  originGeneration: number;
  renovatedYear: number | null;
  visualPhase: UrbanHistoricalPhase;
  architecture: BuildingArchitecturalStamp | null;
  fortificationRole: FortificationRole | null;
  fortificationLineId: string | null;
  urbanContext: BuildingUrbanContext | null;
  lifecycleState: BuildingLifecycleState;
  lifecycleProgress: number;
  stateSinceYear: number;
  lastLifecycleYear: number;
  abandonmentYears: number;
  natureReclaim: number;
  lastDamageYear: number | null;
  lastDamageCause: BuildingDamageCause | null;
  lifecycleHistory: BuildingLifecycleTransition[];
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
  /** CITY-V2 provenance. These are durable facts, not renderer caches. */
  public builtYear: number = 0;
  public originPhase: UrbanHistoricalPhase = 'settlement';
  public originGeneration: number = 0;
  public renovatedYear: number | null = null;
  public visualPhase: UrbanHistoricalPhase = 'settlement';
  /** CITY-V3 historical visual identity. It survives conquest and later eras. */
  public architecture: BuildingArchitecturalStamp | null = null;
  /** CITY-V4 metadata used by routing, defence and the asset resolver. */
  public fortificationRole: FortificationRole | null = null;
  public fortificationLineId: string | null = null;
  /** CITY-V5 district/land-value context at construction or last renovation. */
  public urbanContext: BuildingUrbanContext | null = null;
  /** CITY-V6 durable physical state. It advances periodically, never per frame. */
  public lifecycleState: BuildingLifecycleState = 'normal';
  public lifecycleProgress: number = 1;
  public stateSinceYear: number = 0;
  public lastLifecycleYear: number = 0;
  public abandonmentYears: number = 0;
  public natureReclaim: number = 0;
  public lastDamageYear: number | null = null;
  public lastDamageCause: BuildingDamageCause | null = null;
  public lifecycleHistory: BuildingLifecycleTransition[] = [];
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
    const capacity = (BUILDINGS[this.type]?.housing ?? 0) * this.level * this.operationalFactor();
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
    return (1 + (this.level - 1) * 0.55) * this.staffing * this.operationalFactor();
  }

  /** A damaged building works poorly; an unfinished, empty or ruined one does not work at all. */
  public operationalFactor(): number {
    if (this.lifecycleState !== 'normal' && this.lifecycleState !== 'damaged') return 0;
    const health = Math.max(0, Math.min(1, this.hp / Math.max(1, this.maxHp)));
    return this.lifecycleState === 'damaged' ? Math.max(.15, health) : Math.max(.45, health);
  }

  public isOperational(): boolean { return this.operationalFactor() > 0; }

  public countsTowardBuildingSlots(): boolean {
    return this.lifecycleState !== 'abandoned' && this.lifecycleState !== 'ruin';
  }

  public beginConstruction(year: number): void {
    this.transitionLifecycle('construction', year, 'construction');
    this.lifecycleProgress = .12;
    this.hp = Math.max(1, this.maxHp * .18);
  }

  public beginReconstruction(year: number): void {
    this.transitionLifecycle('reconstruction', year, 'recovery');
    this.lifecycleProgress = .12;
    this.hp = Math.max(1, this.maxHp * .16);
    this.natureReclaim = 0;
  }

  public completeConstruction(year: number): void {
    this.lifecycleProgress = 1;
    this.hp = this.maxHp;
    this.abandonmentYears = 0;
    this.natureReclaim = 0;
    this.transitionLifecycle('normal', year, 'recovery');
  }

  public applyDamage(amount: number, year: number, cause: BuildingDamageCause): void {
    if (amount <= 0) return;
    const activeProject = this.lifecycleState === 'construction' || this.lifecycleState === 'reconstruction';
    this.hp = Math.max(0, this.hp - amount);
    this.lastDamageYear = year;
    this.lastDamageCause = cause;
    const ratio = this.hp / Math.max(1, this.maxHp);
    if (ratio <= .12) {
      this.hp = Math.max(1, this.maxHp * .08);
      this.lifecycleProgress = 0;
      this.transitionLifecycle('ruin', year, cause);
    } else if (activeProject) {
      this.lifecycleProgress = Math.min(this.lifecycleProgress, Math.max(.05, ratio));
    } else if (this.lifecycleState !== 'abandoned') {
      this.transitionLifecycle('damaged', year, cause);
    }
  }

  public transitionLifecycle(
    next: BuildingLifecycleState,
    year: number,
    cause: BuildingLifecycleTransition['cause']
  ): boolean {
    if (this.lifecycleState === next) return false;
    this.lifecycleHistory.push({ from: this.lifecycleState, to: next, year, cause });
    if (this.lifecycleHistory.length > 8) this.lifecycleHistory.shift();
    this.lifecycleState = next;
    this.stateSinceYear = year;
    this.lastLifecycleYear = year;
    return true;
  }

  public upgrade(): void {
    if (this.level < 3) {
      this.level++;
      this.maxHp = Math.round(this.maxHp * 1.5);
      this.hp = this.maxHp;
    }
  }

  public recordUrbanOrigin(year: number, phase: UrbanHistoricalPhase, generation: number): void {
    this.builtYear = year;
    this.originPhase = phase;
    this.originGeneration = generation;
    this.visualPhase = phase;
  }

  public recordRenovation(year: number, phase: UrbanHistoricalPhase): void {
    this.renovatedYear = year;
    this.visualPhase = phase;
  }

  public recordArchitecture(stamp: BuildingArchitecturalStamp): void { this.architecture = stamp; }

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
