/**
 * How a realm is organised, and what that costs it.
 *
 * Government types are unlocked by political technologies, but adopting one is a
 * separate decision the kingdom AI makes based on its situation — a realm at war
 * clings to autocracy, a wealthy trading realm drifts liberal.
 */

export type GovernmentType =
  | 'tribe'
  | 'chiefdom'
  | 'feudal_kingdom'
  | 'monarchy'
  | 'empire'
  | 'constitutional_monarchy'
  | 'republic'
  | 'capitalist_state'
  | 'communist_state';

export type EconomicSystem = 'subsistence' | 'tributary' | 'mercantile' | 'market' | 'planned';

export interface GovernmentDefinition {
  id: GovernmentType;
  name: string;
  /** What the head of state is called. Used for chronicle lines and the inspector. */
  rulerTitle: string;
  icon: string;
  color: string;
  economy: EconomicSystem;
  /** Fraction of city production the crown collects each year. */
  taxRate: number;
  /** Multipliers applied on top of technology modifiers. */
  growth: number;
  production: number;
  research: number;
  trade: number;
  military: number;
  /** How readily this government declares war, 0..2. */
  aggression: number;
  /** Resistance to rebellion and civil war, 0..1. */
  stability: number;
  /** Territory tiles a single settlement may claim. */
  expansion: number;
  /** How the crown passes on when a ruler dies. */
  succession: 'strongest' | 'bloodline' | 'election';
  description: string;
}

export const GOVERNMENTS: Record<GovernmentType, GovernmentDefinition> = {
  tribe: {
    id: 'tribe',
    name: 'Tribo Primitiva',
    rulerTitle: 'Ancião',
    icon: 'feather',
    color: '#a8a29e',
    economy: 'subsistence',
    taxRate: 0.05,
    growth: 1.0,
    production: 1.0,
    research: 1.0,
    trade: 0.8,
    military: 1.0,
    aggression: 0.8,
    stability: 0.7,
    expansion: 8,
    succession: 'strongest',
    description: 'Bando de parentesco liderado pelos mais velhos respeitados. Tradição oral sem escrita.'
  },
  chiefdom: {
    id: 'chiefdom',
    name: 'Chefia Tribal',
    rulerTitle: 'Cacique',
    icon: 'statue',
    color: '#b45309',
    economy: 'tributary',
    taxRate: 0.12,
    growth: 1.1,
    production: 1.1,
    research: 1.05,
    trade: 0.95,
    military: 1.1,
    aggression: 1.0,
    stability: 0.65,
    expansion: 14,
    succession: 'strongest',
    description: 'Uma dinastia forte recolhe tributos do povo em troca de proteção militar.'
  },
  feudal_kingdom: {
    id: 'feudal_kingdom',
    name: 'Reino Feudal',
    rulerTitle: 'Rei',
    icon: 'shield',
    color: '#7c3aed',
    economy: 'tributary',
    taxRate: 0.18,
    growth: 1.12,
    production: 1.15,
    research: 1.1,
    trade: 1.05,
    military: 1.3,
    aggression: 1.2,
    stability: 0.6,
    expansion: 22,
    succession: 'bloodline',
    description: 'Vassalos possuem terras em troca de fornecer juramento e tropa de cavaleiros.'
  },
  monarchy: {
    id: 'monarchy',
    name: 'Monarquia Absoluta',
    rulerTitle: 'Rei Absoluto',
    icon: 'crown',
    color: '#fbbf24',
    economy: 'mercantile',
    taxRate: 0.24,
    growth: 1.2,
    production: 1.25,
    research: 1.2,
    trade: 1.25,
    military: 1.3,
    aggression: 1.1,
    stability: 0.8,
    expansion: 30,
    succession: 'bloodline',
    description: 'Poder supremo concentrado na coroa e na dinastia real legítima.'
  },
  empire: {
    id: 'empire',
    name: 'Império Celestial',
    rulerTitle: 'Imperador',
    icon: 'throne',
    color: '#f59e0b',
    economy: 'mercantile',
    taxRate: 0.28,
    growth: 1.25,
    production: 1.35,
    research: 1.25,
    trade: 1.3,
    military: 1.45,
    aggression: 1.35,
    stability: 0.75,
    expansion: 40,
    succession: 'bloodline',
    description: 'Vasta expansão territorial com legiões organizadas e burocracia centralizada.'
  },
  constitutional_monarchy: {
    id: 'constitutional_monarchy',
    name: 'Monarquia Constitucional',
    rulerTitle: 'Primeiro-Ministro',
    icon: 'scroll',
    color: '#2563eb',
    economy: 'market',
    taxRate: 0.2,
    growth: 1.3,
    production: 1.3,
    research: 1.35,
    trade: 1.4,
    military: 1.2,
    aggression: 0.7,
    stability: 0.85,
    expansion: 35,
    succession: 'election',
    description: 'O soberano reina sob leis escritas e um parlamento representativo eleito.'
  },
  republic: {
    id: 'republic',
    name: 'República Democrática',
    rulerTitle: 'Presidente',
    icon: 'columns',
    color: '#0284c7',
    economy: 'market',
    taxRate: 0.22,
    growth: 1.35,
    production: 1.3,
    research: 1.4,
    trade: 1.45,
    military: 1.15,
    aggression: 0.6,
    stability: 0.82,
    expansion: 36,
    succession: 'election',
    description: 'Governo do povo com magistrados e senado eleitos democraticamente.'
  },
  capitalist_state: {
    id: 'capitalist_state',
    name: 'Corporação Livre',
    rulerTitle: 'Chanceler',
    icon: 'coins',
    color: '#10b981',
    economy: 'market',
    taxRate: 0.15,
    growth: 1.4,
    production: 1.45,
    research: 1.45,
    trade: 1.6,
    military: 1.1,
    aggression: 0.8,
    stability: 0.78,
    expansion: 38,
    succession: 'election',
    description: 'Mercado livre e industrialização acelerada movida pelo capital acumulado.'
  },
  communist_state: {
    id: 'communist_state',
    name: 'Estado Socialista',
    rulerTitle: 'Camarada Supremo',
    icon: 'hammer',
    color: '#ef4444',
    economy: 'planned',
    taxRate: 0.35,
    growth: 1.25,
    production: 1.5,
    research: 1.3,
    trade: 1.1,
    military: 1.5,
    aggression: 1.1,
    stability: 0.9,
    expansion: 42,
    succession: 'strongest',
    description: 'Economia totalmente planejada pelo Estado para obras públicas e exército massivo.'
  }
};

/** Governments a realm may move to next, ordered by how attractive they are. */
export const GOVERNMENT_PROGRESSION: GovernmentType[] = [
  'tribe',
  'chiefdom',
  'feudal_kingdom',
  'monarchy',
  'empire',
  'constitutional_monarchy',
  'republic',
  'capitalist_state',
  'communist_state'
];

export function governmentRank(type: GovernmentType): number {
  return GOVERNMENT_PROGRESSION.indexOf(type);
}

/**
 * Picks which unlocked government a realm actually adopts.
 *
 * The choice is driven by the realm's circumstances, not just its tech level:
 * militarised realms centralise, wealthy traders liberalise, and an unequal
 * industrial realm with an unhappy population turns to central planning.
 */
export interface GovernmentContext {
  currentGovernment: GovernmentType;
  available: GovernmentType[];
  atWar: boolean;
  /** 0..1 — how content the population is. */
  stability: number;
  /** Cities held. Sprawling realms lean imperial. */
  cityCount: number;
  /** Treasury relative to what the realm needs. Above 1 is comfortable. */
  wealthRatio: number;
  /** 0..1 — share of production coming from factories rather than farms. */
  industrialisation: number;
  /** Ruler's disposition, from the crowned entity's personality. */
  rulerPersonality: string;
  culturalMilitarism?: number;
  culturalExpansionism?: number;
  culturalAuthority?: number;
  culturalOpenness?: number;
  culturalMercantilism?: number;
  culturalInnovation?: number;
  culturalCollectivism?: number;
  culturalTradition?: number;
  socialReformPressure?: number;
  socialMilitaryPressure?: number;
  socialElitePressure?: number;
  socialMerchantPressure?: number;
  socialWorkerPressure?: number;
}

export function chooseGovernment(ctx: GovernmentContext): GovernmentType {
  const currentRank = governmentRank(ctx.currentGovernment);

  // Only ever consider governments the realm has unlocked and not already adopted.
  const candidates = ctx.available.filter(g => g !== ctx.currentGovernment);
  if (candidates.length === 0) return ctx.currentGovernment;

  let best = ctx.currentGovernment;
  let bestScore = 0.35; // A realm needs a real reason to overturn its own order.

  for (const candidate of candidates) {
    const def = GOVERNMENTS[candidate];
    let score = 0;

    // Advancing along the progression is the baseline pull.
    const rankGain = governmentRank(candidate) - currentRank;
    score += rankGain > 0 ? 0.4 : -0.5;

    switch (candidate) {
      case 'empire':
        // Empires need something to rule over.
        score += ctx.cityCount >= 4 ? 0.5 : -0.6;
        score += ctx.atWar ? 0.25 : 0;
        score += ctx.rulerPersonality === 'ambitious' ? 0.3 : 0;
        score += (ctx.culturalExpansionism ?? 0.5) > 0.6 ? 0.22 : -0.08;
        score += (ctx.culturalMilitarism ?? 0.5) > 0.58 ? 0.18 : 0;
        score += (ctx.culturalAuthority ?? 0.5) > 0.6 ? 0.14 : 0;
        score += (ctx.socialMilitaryPressure ?? 0) * 0.28;
        score -= (ctx.socialReformPressure ?? 0) * 0.16;
        break;

      case 'constitutional_monarchy':
        // Liberalisation happens in peace and prosperity.
        score += ctx.atWar ? -0.5 : 0.3;
        score += ctx.wealthRatio > 1.2 ? 0.3 : 0;
        score += ctx.stability > 0.6 ? 0.2 : -0.2;
        score += ctx.rulerPersonality === 'diplomatic' ? 0.25 : 0;
        score += (ctx.culturalOpenness ?? 0.5) > 0.58 ? 0.16 : -0.05;
        score += (ctx.culturalTradition ?? 0.5) > 0.54 ? 0.12 : 0;
        score += (ctx.socialMerchantPressure ?? 0) * 0.14;
        score += (ctx.socialReformPressure ?? 0) * 0.16;
        score += (ctx.socialElitePressure ?? 0) * 0.12;
        break;

      case 'republic':
        score += ctx.atWar ? -0.4 : 0.25;
        score += ctx.stability < 0.45 ? 0.35 : 0; // Unrest can topple a crown outright
        score += ctx.rulerPersonality === 'peaceful' ? 0.2 : 0;
        score += (ctx.culturalOpenness ?? 0.5) > 0.56 ? 0.2 : -0.08;
        score += (ctx.culturalAuthority ?? 0.5) < 0.45 ? 0.18 : -0.12;
        score += (ctx.culturalInnovation ?? 0.5) > 0.55 ? 0.12 : 0;
        score += (ctx.socialReformPressure ?? 0) * 0.32;
        score += (ctx.socialMerchantPressure ?? 0) * 0.1;
        score -= (ctx.socialElitePressure ?? 0) * 0.18;
        break;

      case 'capitalist_state':
        score += ctx.wealthRatio > 1.0 ? 0.45 : -0.2;
        score += ctx.industrialisation > 0.4 ? 0.35 : -0.3;
        score += ctx.rulerPersonality === 'greedy' ? 0.35 : 0;
        score += ctx.stability > 0.5 ? 0.15 : -0.15;
        score += (ctx.culturalMercantilism ?? 0.5) > 0.58 ? 0.28 : -0.1;
        score += (ctx.culturalInnovation ?? 0.5) > 0.55 ? 0.14 : 0;
        score += (ctx.culturalCollectivism ?? 0.5) > 0.62 ? -0.18 : 0;
        score += (ctx.socialMerchantPressure ?? 0) * 0.35;
        score -= (ctx.socialWorkerPressure ?? 0) * 0.12;
        break;

      case 'communist_state':
        // Revolution comes from industry plus discontent, not from prosperity.
        score += ctx.industrialisation > 0.35 ? 0.4 : -0.3;
        score += ctx.stability < 0.5 ? 0.55 : -0.35;
        score += ctx.wealthRatio < 0.8 ? 0.3 : -0.2;
        score += ctx.rulerPersonality === 'ambitious' ? 0.15 : 0;
        score += (ctx.culturalCollectivism ?? 0.5) > 0.6 ? 0.26 : -0.1;
        score += (ctx.culturalAuthority ?? 0.5) > 0.52 ? 0.12 : 0;
        score += (ctx.culturalMercantilism ?? 0.5) > 0.62 ? -0.16 : 0;
        score += (ctx.socialWorkerPressure ?? 0) * 0.32;
        score += (ctx.socialReformPressure ?? 0) * 0.18;
        score -= (ctx.socialElitePressure ?? 0) * 0.18;
        break;

      default:
        // Early governments are adopted as soon as they become available.
        score += 0.35;
        break;
    }

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

/** True when the transition is a revolution rather than an orderly reform. */
export function isRevolution(from: GovernmentType, to: GovernmentType): boolean {
  if (to === 'communist_state') return true;
  if (to === 'republic' && (from === 'monarchy' || from === 'empire' || from === 'feudal_kingdom')) return true;
  return false;
}
