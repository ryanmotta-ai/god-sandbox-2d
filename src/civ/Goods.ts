/**
 * The economic substance of the world.
 *
 * Materials sit in three tiers of scarcity, and that scarcity is the engine of
 * the whole geopolitical simulation:
 *
 *  - `common`    exists nearly everywhere. Nobody fights over timber.
 *  - `regional`  needs the right terrain and climate. Most realms have some.
 *  - `strategic` appears in a handful of places on the entire map, and advanced
 *                technology cannot proceed without it. Whoever sits on the oil
 *                sells to everyone — or gets invaded for it.
 *
 * Crafted goods form multi-stage chains, so a realm's industry can be broken by
 * cutting off a single input three steps upstream.
 */

export type GoodId =
  // ---- Common raw: broadly available ----
  | 'food'
  | 'wood'
  | 'stone'
  | 'clay'
  // ---- Regional raw: terrain and climate dependent ----
  | 'copper'
  | 'tin'
  | 'iron'
  | 'coal'
  | 'salt'
  | 'gold'
  | 'gems'
  | 'horses'
  | 'cotton'
  | 'spices'
  | 'furs'
  // ---- Strategic raw: rare, concentrated, decisive ----
  | 'oil'
  | 'saltpeter'
  | 'rubber'
  | 'uranium'
  // ---- Crafted: multi-stage industry ----
  | 'bronze'
  | 'steel'
  | 'tools'
  | 'cloth'
  | 'fuel'
  | 'gunpowder'
  | 'machinery'
  | 'missiles';

export type GoodTier = 'common' | 'regional' | 'strategic';
export type GoodKind = 'raw' | 'crafted';

export type ExtractionMethod = 'farm' | 'forestry' | 'quarry' | 'mine' | 'pasture' | 'well';

export interface ProductionRecipe {
  /** Inputs consumed for one production cycle. */
  inputs: Partial<Record<GoodId, number>>;
  /** Units created by one complete cycle. */
  output: number;
  /** Optional higher-tier method; the first available recipe is not always the best one. */
  requiresTech?: string;
  label?: string;
}

export interface GoodDefinition {
  id: GoodId;
  name: string;
  icon: string;
  color: string;
  kind: GoodKind;
  /** How hard this material is to find in the world at all. */
  tier: GoodTier;
  /** Baseline market price in abstract world units, before supply and demand. */
  basePrice: number;
  /** Inputs consumed to craft one unit (crafted goods only). */
  recipe?: Partial<Record<GoodId, number>>;
  /** Balanced production recipes. When present these are authoritative over legacy `recipe`. */
  recipes?: ProductionRecipe[];
  /** Technology required before a settlement can produce this at all. */
  requiresTech?: string;
  /** Building that turns the recipe into output. */
  producedBy?: string;
  /**
   * A realm that cannot obtain this good is blocked from part of the tech tree.
   * This is what turns a deposit into a casus belli.
   */
  strategic?: boolean;
  description: string;
}

export const GOODS: Record<GoodId, GoodDefinition> = {
  // ============================ COMMON RAW ============================
  food: {
    id: 'food',
    name: 'Alimento',
    icon: '🌾',
    color: '#fbbf24',
    kind: 'raw',
    tier: 'common',
    basePrice: 2,
    description: 'Grãos, caça e frutos. Todo cidadão come todo ano, ou passa fome.'
  },
  wood: {
    id: 'wood',
    name: 'Madeira',
    icon: '🌲',
    color: '#22c55e',
    kind: 'raw',
    tier: 'common',
    basePrice: 3,
    description: 'Derrubada das florestas. A base de toda construção primitiva.'
  },
  stone: {
    id: 'stone',
    name: 'Pedra',
    icon: '🪨',
    color: '#94a3b8',
    kind: 'raw',
    tier: 'common',
    basePrice: 4,
    description: 'Rocha extraída. Necessária para muralhas, estradas e arquitetura duradoura.'
  },
  clay: {
    id: 'clay',
    name: 'Argila',
    icon: '🧱',
    color: '#b45309',
    kind: 'raw',
    tier: 'common',
    basePrice: 3,
    description: 'Barro de várzea. Tijolo, cerâmica e a primeira indústria de qualquer povo.'
  },

  // ============================ REGIONAL RAW ============================
  copper: {
    id: 'copper',
    name: 'Cobre',
    icon: '🟠',
    color: '#ea580c',
    kind: 'raw',
    tier: 'regional',
    basePrice: 11,
    requiresTech: 'mining',
    description: 'Metal maleável das montanhas. Sozinho é fraco; ligado ao estanho, muda a história.'
  },
  tin: {
    id: 'tin',
    name: 'Estanho',
    icon: '⚪',
    color: '#cbd5e1',
    kind: 'raw',
    tier: 'strategic',
    basePrice: 26,
    requiresTech: 'mining',
    strategic: true,
    description: 'Raríssimo e disperso. Sem ele não existe bronze — a razão das primeiras rotas de longa distância.'
  },
  iron: {
    id: 'iron',
    name: 'Ferro',
    icon: '⛏️',
    color: '#94a3b8',
    kind: 'raw',
    tier: 'regional',
    basePrice: 9,
    requiresTech: 'mining',
    description: 'Minério comum nas montanhas. Fundido em aço, arma exércitos inteiros.'
  },
  coal: {
    id: 'coal',
    name: 'Carvão',
    icon: '⬛',
    color: '#475569',
    kind: 'raw',
    tier: 'regional',
    basePrice: 8,
    requiresTech: 'mining',
    strategic: true,
    description: 'Inútil até alguém inventar uma fornalha que o exija. Depois disso, indispensável.'
  },
  salt: {
    id: 'salt',
    name: 'Sal',
    icon: '🧂',
    color: '#f1f5f9',
    kind: 'raw',
    tier: 'regional',
    basePrice: 13,
    description: 'Conserva alimento e mantém exércitos em campanha. Valeu mais que ouro por milênios.'
  },
  gold: {
    id: 'gold',
    name: 'Ouro',
    icon: '🪙',
    color: '#f59e0b',
    kind: 'raw',
    tier: 'regional',
    basePrice: 28,
    description: 'Raro, denso e desejado por todos. A semente de qualquer moeda.'
  },
  gems: {
    id: 'gems',
    name: 'Gemas',
    icon: '💎',
    color: '#a855f7',
    kind: 'raw',
    tier: 'regional',
    basePrice: 44,
    requiresTech: 'mining',
    description: 'Bem de luxo. Nobres exigem, camponeses ressentem.'
  },
  horses: {
    id: 'horses',
    name: 'Cavalos',
    icon: '🐎',
    color: '#a16207',
    kind: 'raw',
    tier: 'regional',
    basePrice: 18,
    requiresTech: 'animal_husbandry',
    description: 'Criados nas planícies abertas. Transformam um exército de pés em um exército de rodas.'
  },
  cotton: {
    id: 'cotton',
    name: 'Algodão',
    icon: '🤍',
    color: '#e2e8f0',
    kind: 'raw',
    tier: 'regional',
    basePrice: 7,
    requiresTech: 'agriculture',
    description: 'Fibra das terras quentes. Matéria-prima do primeiro grande comércio de manufaturas.'
  },
  spices: {
    id: 'spices',
    name: 'Especiarias',
    icon: '🌶️',
    color: '#dc2626',
    kind: 'raw',
    tier: 'regional',
    basePrice: 38,
    description: 'Só crescem no calor úmido. Impérios inteiros foram construídos sobre pimenta.'
  },
  furs: {
    id: 'furs',
    name: 'Peles',
    icon: '🦫',
    color: '#78350f',
    kind: 'raw',
    tier: 'regional',
    basePrice: 16,
    description: 'Caçadas no frio extremo. A única exportação valiosa das terras congeladas.'
  },

  // ============================ STRATEGIC RAW ============================
  oil: {
    id: 'oil',
    name: 'Petróleo',
    icon: '🛢️',
    color: '#1c1917',
    kind: 'raw',
    tier: 'strategic',
    basePrice: 55,
    requiresTech: 'industrialization',
    strategic: true,
    description: 'Poças negras sob o deserto e o pântano. Inútil por toda a história — e depois, o mundo inteiro depende dela.'
  },
  saltpeter: {
    id: 'saltpeter',
    name: 'Salitre',
    icon: '💠',
    color: '#e0f2fe',
    kind: 'raw',
    tier: 'strategic',
    basePrice: 34,
    requiresTech: 'mining',
    strategic: true,
    description: 'Cristais de cavernas áridas. Sem salitre não há pólvora, e sem pólvora as muralhas continuam de pé.'
  },
  rubber: {
    id: 'rubber',
    name: 'Borracha',
    icon: '🟤',
    color: '#292524',
    kind: 'raw',
    tier: 'strategic',
    basePrice: 42,
    strategic: true,
    description: 'Seiva de árvores tropicais. Vedações, pneus e correias — a indústria para sem ela.'
  },
  uranium: {
    id: 'uranium',
    name: 'Urânio',
    icon: '☢️',
    color: '#84cc16',
    kind: 'raw',
    tier: 'strategic',
    basePrice: 120,
    requiresTech: 'electricity',
    strategic: true,
    description: 'Rocha pesada e luminosa das montanhas profundas. Quem a domina não precisa negociar.'
  },

  // ============================ CRAFTED ============================
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    icon: '🟫',
    color: '#b45309',
    kind: 'crafted',
    tier: 'regional',
    basePrice: 30,
    recipe: { copper: 3, tin: 1 },
    requiresTech: 'bronze_working',
    producedBy: 'smithy',
    description: 'Cobre ligado a estanho. O primeiro metal que sobrevive a quem o forjou.'
  },
  steel: {
    id: 'steel',
    name: 'Aço',
    icon: '⚙️',
    color: '#64748b',
    kind: 'crafted',
    tier: 'regional',
    basePrice: 40,
    recipe: { iron: 3, coal: 2 },
    requiresTech: 'metallurgy',
    producedBy: 'smithy',
    description: 'Ferro purificado a carvão. Trilhos, canhões e arranha-céus saem daqui.'
  },
  tools: {
    id: 'tools',
    name: 'Ferramentas',
    icon: '🔨',
    color: '#f97316',
    kind: 'crafted',
    tier: 'common',
    basePrice: 24,
    recipe: { bronze: 1, wood: 1 },
    requiresTech: 'bronze_working',
    producedBy: 'smithy',
    description: 'Multiplica quanto cada trabalhador arranca da terra.'
  },
  cloth: {
    id: 'cloth',
    name: 'Tecido',
    icon: '🧵',
    color: '#38bdf8',
    kind: 'crafted',
    tier: 'common',
    basePrice: 15,
    recipe: { cotton: 2 },
    requiresTech: 'pottery',
    producedBy: 'workshop',
    description: 'Vestuário e velas de navio. O primeiro bem feito só para ser vendido.'
  },
  fuel: {
    id: 'fuel',
    name: 'Combustível',
    icon: '⛽',
    color: '#f59e0b',
    kind: 'crafted',
    tier: 'strategic',
    basePrice: 70,
    recipe: { oil: 2 },
    requiresTech: 'industrialization',
    producedBy: 'refinery',
    strategic: true,
    description: 'Petróleo refinado. Move fábricas, frotas e exércitos inteiros.'
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Pólvora',
    icon: '💥',
    color: '#ef4444',
    kind: 'crafted',
    tier: 'strategic',
    basePrice: 58,
    recipe: { saltpeter: 2, coal: 1 },
    requiresTech: 'gunpowder',
    producedBy: 'smithy',
    strategic: true,
    description: 'O fim da era das muralhas e dos cavaleiros.'
  },
  machinery: {
    id: 'machinery',
    name: 'Maquinário',
    icon: '🏗️',
    color: '#0ea5e9',
    kind: 'crafted',
    tier: 'strategic',
    basePrice: 95,
    recipe: { steel: 3, rubber: 1, fuel: 1 },
    requiresTech: 'industrialization',
    producedBy: 'factory',
    strategic: true,
    description: 'Aço, borracha e combustível numa só peça. Uma fábrica delas supera uma província de camponeses.'
  },
  missiles: {
    id: 'missiles',
    name: 'Mísseis & Guiados',
    icon: '🚀',
    color: '#ef4444',
    kind: 'crafted',
    tier: 'strategic',
    basePrice: 140,
    recipe: { steel: 2, fuel: 2, machinery: 1, gunpowder: 1 },
    requiresTech: 'rocketry',
    producedBy: 'factory',
    strategic: true,
    description: 'Mísseis táticos, foguetes e munições guiadas de precisão.'
  }
};


/**
 * Resource -> physical extraction building mapping.
 * This is deliberately explicit: cotton is not mined just because it is a raw good.
 */
export const EXTRACTION_METHOD: Partial<Record<GoodId, ExtractionMethod>> = {
  food: 'farm',
  wood: 'forestry',
  stone: 'quarry',
  clay: 'quarry',
  copper: 'mine',
  tin: 'mine',
  iron: 'mine',
  coal: 'mine',
  salt: 'mine',
  gold: 'mine',
  gems: 'mine',
  horses: 'pasture',
  cotton: 'farm',
  spices: 'farm',
  furs: 'pasture',
  oil: 'well',
  saltpeter: 'mine',
  rubber: 'forestry',
  uranium: 'mine'
};

/**
 * Balanced recipes. `Goods.ts` is the single source of truth for industrial
 * conversion; buildings only provide capacity and jobs.
 */
export const PRODUCTION_RECIPES: Partial<Record<GoodId, ProductionRecipe[]>> = {
  bronze: [
    { inputs: { copper: 3, tin: 1 }, output: 2.4, requiresTech: 'bronze_working', label: 'bronze alloying' }
  ],
  steel: [
    { inputs: { iron: 3, coal: 2 }, output: 1.5, requiresTech: 'metallurgy', label: 'blast-furnace steel' }
  ],
  tools: [
    // Fired clay: pots, tiles and crucibles. The earliest workshop good there is,
    // and the reason a clay pit is worth digging at all.
    { inputs: { clay: 3, wood: 1 }, output: 1.1, requiresTech: 'pottery', label: 'cerâmica e telha' },
    { inputs: { bronze: 1, wood: 1 }, output: 1.8, requiresTech: 'bronze_working', label: 'bronze tools' },
    { inputs: { iron: 2, wood: 1 }, output: 1.25, requiresTech: 'iron_working', label: 'iron tools' },
    { inputs: { steel: 1, wood: 1 }, output: 2.3, requiresTech: 'metallurgy', label: 'steel tools' }
  ],
  cloth: [
    { inputs: { cotton: 2 }, output: 1.4, requiresTech: 'pottery', label: 'woven cloth' },
    // Tanning, which needs no loom and no cotton climate. This is the only thing
    // a fur was ever for: without it, a cold realm mined pelts into a warehouse
    // and had nothing to wear.
    { inputs: { furs: 2 }, output: 1.15, requiresTech: 'animal_husbandry', label: 'peleteria curtida' }
  ],
  fuel: [
    { inputs: { oil: 2 }, output: 1.8, requiresTech: 'industrialization', label: 'refined fuel' },
    // Fission. A tiny input for an enormous output, which is what makes the two
    // uranium basins on a map worth a war — and what finally gives the ore a use.
    { inputs: { uranium: 1 }, output: 7.5, requiresTech: 'electricity', label: 'combustível de fissão' }
  ],
  gunpowder: [
    { inputs: { saltpeter: 2, coal: 1 }, output: 1.8, requiresTech: 'gunpowder', label: 'black powder' }
  ],
  machinery: [
    { inputs: { steel: 3, rubber: 1, fuel: 1 }, output: 3.4, requiresTech: 'industrialization', label: 'industrial machinery' }
  ],
  missiles: [
    { inputs: { steel: 2, fuel: 2, machinery: 1, gunpowder: 1 }, output: 2, requiresTech: 'rocketry', label: 'mísseis convencionais' }
  ]
};

export function productionRecipesFor(good: GoodId): ProductionRecipe[] {
  const balanced = PRODUCTION_RECIPES[good];
  if (balanced?.length) return balanced;
  const legacy = GOODS[good]?.recipe;
  return legacy ? [{ inputs: legacy, output: 1, requiresTech: GOODS[good].requiresTech }] : [];
}

export function extractionMethodFor(good: GoodId): ExtractionMethod | null {
  return EXTRACTION_METHOD[good] ?? null;
}

export const ALL_GOODS: GoodId[] = Object.keys(GOODS) as GoodId[];

/**
 * Narrows an untrusted string to a real good. Navigation params and save files
 * carry plain strings, and looking up a bad one silently yields `undefined`
 * fields that read as zeroes further down.
 */
export function isGoodId(value: string | undefined | null): value is GoodId {
  return !!value && Object.prototype.hasOwnProperty.call(GOODS, value);
}

export const RAW_GOODS: GoodId[] = ALL_GOODS.filter(id => GOODS[id].kind === 'raw');
export const CRAFTED_GOODS: GoodId[] = ALL_GOODS.filter(id => GOODS[id].kind === 'crafted');
/** Materials that gate technology and therefore drive wars. */
export const STRATEGIC_GOODS: GoodId[] = ALL_GOODS.filter(id => GOODS[id].strategic);
export const GOODS_BY_TIER = (tier: GoodTier): GoodId[] => ALL_GOODS.filter(id => GOODS[id].tier === tier);

/**
 * What a miner digs for. Timber and food are gathered at the surface by other
 * professions, so they are excluded here.
 */
export const MINEABLE_GOODS: GoodId[] = ['copper', 'tin', 'iron', 'coal', 'salt', 'gold', 'gems', 'saltpeter', 'uranium'];
export const QUARRY_GOODS: GoodId[] = ['stone', 'clay'];
export const FORESTRY_GOODS: GoodId[] = ['wood', 'rubber'];
export const FARM_GOODS: GoodId[] = ['food', 'cotton', 'spices'];
export const PASTURE_GOODS: GoodId[] = ['horses', 'furs'];
export const WELL_GOODS: GoodId[] = ['oil'];
export const RENEWABLE_GOODS: GoodId[] = ['food', 'wood', 'horses', 'cotton', 'spices', 'furs', 'rubber'];

/**
 * Everything a good ultimately needs, walking the recipe chain to its roots.
 * Used to tell a realm that its machinery shortage is really an oil shortage.
 */
export function rawInputsOf(good: GoodId, seen: Set<GoodId> = new Set()): GoodId[] {
  if (seen.has(good)) return [];
  seen.add(good);

  const def = GOODS[good];
  if (!def?.recipe) return [good];

  const roots: GoodId[] = [];
  for (const input of Object.keys(def.recipe) as GoodId[]) {
    for (const root of rawInputsOf(input, seen)) {
      if (!roots.includes(root)) roots.push(root);
    }
  }
  return roots;
}

/** How many crafting stages deep a good sits. Deeper goods are worth more. */
export function productionDepth(good: GoodId, seen: Set<GoodId> = new Set()): number {
  if (seen.has(good)) return 0;
  seen.add(good);
  const def = GOODS[good];
  if (!def?.recipe) return 0;
  let deepest = 0;
  for (const input of Object.keys(def.recipe) as GoodId[]) {
    deepest = Math.max(deepest, productionDepth(input, seen));
  }
  return deepest + 1;
}

/**
 * A container of goods with a soft capacity.
 * Cities, kingdoms and caravans all use one.
 */
export class Stockpile {
  private amounts: Map<GoodId, number> = new Map();
  public capacity: number;

  constructor(capacity: number = 500, initial?: Partial<Record<GoodId, number>>) {
    this.capacity = capacity;
    if (initial) {
      for (const [good, amount] of Object.entries(initial)) {
        this.amounts.set(good as GoodId, amount as number);
      }
    }
  }

  public get(good: GoodId): number {
    return this.amounts.get(good) ?? 0;
  }

  public has(good: GoodId, amount: number): boolean {
    return this.get(good) >= amount;
  }

  public hasAll(cost: Partial<Record<GoodId, number>>): boolean {
    for (const [good, amount] of Object.entries(cost)) {
      if (this.get(good as GoodId) < (amount as number)) return false;
    }
    return true;
  }

  /** Adds goods, clamped to capacity. Returns how much actually fit. */
  public add(good: GoodId, amount: number): number {
    if (amount <= 0) return 0;
    const current = this.get(good);
    const room = Math.max(0, this.capacity - current);
    const stored = Math.min(amount, room);
    this.amounts.set(good, current + stored);
    return stored;
  }

  /** Removes goods. Returns how much was actually available and taken. */
  public take(good: GoodId, amount: number): number {
    if (amount <= 0) return 0;
    const current = this.get(good);
    const taken = Math.min(amount, current);
    this.amounts.set(good, current - taken);
    return taken;
  }

  /** Atomically spends a whole cost, or nothing at all. */
  public spend(cost: Partial<Record<GoodId, number>>): boolean {
    if (!this.hasAll(cost)) return false;
    for (const [good, amount] of Object.entries(cost)) {
      this.take(good as GoodId, amount as number);
    }
    return true;
  }

  public set(good: GoodId, amount: number): void {
    this.amounts.set(good, Math.max(0, Math.min(this.capacity, amount)));
  }

  public total(): number {
    let sum = 0;
    for (const amount of this.amounts.values()) sum += amount;
    return sum;
  }

  /** Fraction of capacity used, averaged across stored goods. */
  public fullness(): number {
    const stored = this.total();
    const maxTotal = this.capacity * ALL_GOODS.length;
    return maxTotal <= 0 ? 0 : stored / maxTotal;
  }

  /** Goods sorted by amount, largest first. Used by the trade AI to pick exports. */
  public entries(): { good: GoodId; amount: number }[] {
    return ALL_GOODS
      .map(good => ({ good, amount: this.get(good) }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }

  /** The good this stockpile has most of relative to capacity. */
  public largestSurplus(exclude: GoodId[] = []): { good: GoodId; amount: number } | null {
    const candidates = this.entries().filter(e => !exclude.includes(e.good));
    return candidates.length ? candidates[0] : null;
  }

  /** The good this stockpile most lacks, among the ones it should have. */
  public largestDeficit(wanted: GoodId[]): { good: GoodId; amount: number } | null {
    let worst: { good: GoodId; amount: number } | null = null;
    for (const good of wanted) {
      const amount = this.get(good);
      if (!worst || amount < worst.amount) worst = { good, amount };
    }
    return worst;
  }

  public serialize(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [good, amount] of this.amounts) {
      if (amount > 0) out[good] = Math.round(amount * 100) / 100;
    }
    return out;
  }

  public deserialize(data: Record<string, number> | undefined): void {
    this.amounts.clear();
    if (!data) return;
    for (const [good, amount] of Object.entries(data)) {
      this.amounts.set(good as GoodId, amount);
    }
  }

  public clone(): Stockpile {
    const copy = new Stockpile(this.capacity);
    for (const [good, amount] of this.amounts) copy.amounts.set(good, amount);
    return copy;
  }
}
