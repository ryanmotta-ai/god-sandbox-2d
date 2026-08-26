import type { EconomicSystem, GovernmentType } from './Government';
import type { LawEffects } from './Laws';
import type { GoodId } from './Goods';

export type SocialFactionId =
  | 'peasants'
  | 'nobles'
  | 'merchants'
  | 'military'
  | 'workers'
  | 'clergy_scholars'
  | 'frontier'
  | 'bureaucrats'
  | 'reformists';

export interface FactionDefinition {
  id: SocialFactionId;
  name: string;
  shortName: string;
  color: string;
  description: string;
  supports: GovernmentType[];
  resists: GovernmentType[];
}

/**
 * One named reason a faction feels the way it does.
 *
 * The politics screen has to answer "why is this realm stable?" with real
 * arithmetic, so every factor here is the exact delta that was applied to the
 * faction's satisfaction — not a label invented for display.
 */
export interface FactionFactor {
  label: string;
  delta: number;
  /**
   * Where the evidence for this pressure lives, so the UI can offer to go show
   * it. Described in the simulation's own terms — which good, which system —
   * and left to the interface to decide what screen that means.
   */
  source?: FactorSource;
}

export type FactorSource =
  | { kind: 'good'; good: GoodId }
  | { kind: 'jobs' }
  | { kind: 'trade' };

export interface FactionState {
  id: SocialFactionId;
  influence: number;
  satisfaction: number;
  wealth: number;
  loyalty: number;
  radicalization: number;
  warSupport: number;
  reformSupport: number;
  /**
   * Why satisfaction sits where it does. Recomputed every year and never
   * serialized — it is an explanation of the current numbers, not state.
   */
  factors?: FactionFactor[];
}

export interface SocietyProfile {
  factions: Record<SocialFactionId, FactionState>;
  cohesion: number;
  reformPressure: number;
  coupRisk: number;
  revoltRisk: number;
  warPressure: number;
  peacePressure: number;
  dominantFaction: SocialFactionId;
  lastUnrestYear: number;
  /**
   * Year the capital last overturned its own government.
   *
   * Kept apart from `lastUnrestYear` so an ordinary strike or a merchants' capital
   * flight does not put a revolution's cooldown on the clock, and so a realm
   * cannot be overthrown twice in a decade.
   */
  lastRevolutionYear: number;
}

export interface SocietyTickContext {
  year: number;
  government: GovernmentType;
  economy: EconomicSystem;
  taxRate: number;
  atWar: boolean;
  wars: number;
  stability: number;
  legitimacy: number;
  prosperity: number;
  foodSecurity: number;
  tradeDependency: number;
  externalThreat: number;
  administrativeReach: number;
  /** How devout the realm is, 0..1. See `Kingdom.faith`. */
  faith: number;
  inequality: number;
  industrialisation: number;
  outputPerCapita: number;
  /**
   * What food actually costs here, as a multiple of its base price.
   *
   * This is the single number that carries a bad harvest into politics: 1.0 is
   * normal, 2.0 means bread has doubled. Townsfolk who buy food suffer; the
   * countryside that sells it does not.
   */
  /** How short of food the realm is. 1 is comfortable; it climbs as shelves empty. */
  foodScarcity: number;
  /** Share of working-age citizens with no job slot to fill, 0..1. */
  unemployment: number;
  /** Share of job slots nobody is available to fill, 0..1. */
  labourShortage: number;
  /** Embargoes standing against this realm right now. */
  embargoes: number;
  cityCount: number;
  famineYears: number;
  warWeariness: number;
  culture: {
    militarism: number;
    expansionism: number;
    tradition: number;
    authority: number;
    openness: number;
    mercantilism: number;
    innovation: number;
    collectivism: number;
    warTrauma: number;
    diplomaticTrust: number;
  };
  laws?: LawEffects;
}

export const SOCIAL_FACTION_ORDER: SocialFactionId[] = [
  'peasants',
  'nobles',
  'merchants',
  'military',
  'workers',
  'clergy_scholars',
  'frontier',
  'bureaucrats',
  'reformists'
];

export const SOCIAL_FACTIONS: Record<SocialFactionId, FactionDefinition> = {
  peasants: {
    id: 'peasants',
    name: 'Peasants',
    shortName: 'Peasants',
    color: '#84cc16',
    description: 'Farmers, herders and village households who carry food production and tax burden.',
    supports: ['tribe', 'chiefdom', 'republic', 'communist_state'],
    resists: ['empire', 'capitalist_state']
  },
  nobles: {
    id: 'nobles',
    name: 'Nobles',
    shortName: 'Nobles',
    color: '#c084fc',
    description: 'Old landholders, dynasts and warrior families who want privilege and continuity.',
    supports: ['feudal_kingdom', 'monarchy', 'empire', 'constitutional_monarchy'],
    resists: ['republic', 'communist_state']
  },
  merchants: {
    id: 'merchants',
    name: 'Merchants',
    shortName: 'Merchants',
    color: '#f59e0b',
    description: 'Caravan owners, moneylenders, port families and market elites.',
    supports: ['monarchy', 'constitutional_monarchy', 'republic', 'capitalist_state'],
    resists: ['tribe', 'communist_state']
  },
  military: {
    id: 'military',
    name: 'Military',
    shortName: 'Military',
    color: '#ef4444',
    description: 'Soldiers, officers, veterans and frontier commanders who care about security and prestige.',
    supports: ['chiefdom', 'feudal_kingdom', 'monarchy', 'empire', 'communist_state'],
    resists: ['republic']
  },
  workers: {
    id: 'workers',
    name: 'Workers',
    shortName: 'Workers',
    color: '#38bdf8',
    description: 'Craftspeople, builders, miners and industrial workers created by urban production.',
    supports: ['republic', 'capitalist_state', 'communist_state'],
    resists: ['feudal_kingdom', 'empire']
  },
  clergy_scholars: {
    id: 'clergy_scholars',
    name: 'Clergy and Scholars',
    shortName: 'Scholars',
    color: '#a78bfa',
    description: 'Ritual authorities, teachers, chroniclers and researchers who shape legitimacy.',
    supports: ['tribe', 'monarchy', 'constitutional_monarchy', 'republic'],
    resists: ['capitalist_state']
  },
  frontier: {
    id: 'frontier',
    name: 'Frontier Settlers',
    shortName: 'Frontier',
    color: '#14b8a6',
    description: 'Colonists, border villages and distant towns who want land, protection and autonomy.',
    supports: ['tribe', 'chiefdom', 'republic', 'empire'],
    resists: ['communist_state']
  },
  bureaucrats: {
    id: 'bureaucrats',
    name: 'Bureaucrats',
    shortName: 'Bureaucrats',
    color: '#64748b',
    description: 'Tax collectors, judges, clerks and governors who turn law into administration.',
    supports: ['monarchy', 'empire', 'constitutional_monarchy', 'communist_state'],
    resists: ['tribe']
  },
  reformists: {
    id: 'reformists',
    name: 'Reformists',
    shortName: 'Reformists',
    color: '#22c55e',
    description: 'Dissidents, pamphleteers, radicals and civic movements who want institutional change.',
    supports: ['constitutional_monarchy', 'republic', 'communist_state'],
    resists: ['feudal_kingdom', 'empire']
  }
};

export function createSocietyProfile(government: GovernmentType = 'tribe'): SocietyProfile {
  const factions = {} as Record<SocialFactionId, FactionState>;
  for (const id of SOCIAL_FACTION_ORDER) {
    factions[id] = {
      id,
      influence: baseInfluence(id, government),
      satisfaction: 0.58,
      wealth: baseWealth(id, government),
      loyalty: 0.58,
      radicalization: 0.08,
      warSupport: id === 'military' ? 0.55 : 0.28,
      reformSupport: id === 'reformists' ? 0.62 : 0.24
    };
  }

  return recomputeSociety({
    factions,
    cohesion: 0.58,
    reformPressure: 0.12,
    coupRisk: 0.03,
    revoltRisk: 0.03,
    warPressure: 0.22,
    peacePressure: 0.28,
    dominantFaction: 'peasants',
    lastUnrestYear: 0,
    lastRevolutionYear: 0
  });
}

export function deserializeSocietyProfile(data: any, government: GovernmentType = 'tribe'): SocietyProfile {
  const base = createSocietyProfile(government);
  if (!data?.factions) return base;

  for (const id of SOCIAL_FACTION_ORDER) {
    base.factions[id] = normalizeFaction({
      ...base.factions[id],
      ...(data.factions[id] ?? {}),
      id
    });
  }

  base.lastUnrestYear = data.lastUnrestYear ?? 0;
  base.lastRevolutionYear = data.lastRevolutionYear ?? 0;
  return recomputeSociety(base);
}

export function updateSociety(profile: SocietyProfile, ctx: SocietyTickContext): SocietyProfile {
  const next: SocietyProfile = {
    ...profile,
    factions: { ...profile.factions }
  };

  for (const id of SOCIAL_FACTION_ORDER) {
    const current = normalizeFaction(profile.factions[id] ?? createSocietyProfile(ctx.government).factions[id]);
    const targets = factionTargets(id, current, ctx);
    next.factions[id] = normalizeFaction({
      id,
      influence: approach(current.influence, targets.influence, 0.08),
      satisfaction: approach(current.satisfaction, targets.satisfaction, 0.22),
      wealth: approach(current.wealth, targets.wealth, 0.16),
      loyalty: approach(current.loyalty, targets.loyalty, 0.2),
      radicalization: approach(current.radicalization, targets.radicalization, 0.18),
      warSupport: approach(current.warSupport, targets.warSupport, 0.18),
      reformSupport: approach(current.reformSupport, targets.reformSupport, 0.18),
      // The reasons belong to this year's targets, not to the smoothed value.
      factors: targets.factors
    });
  }

  next.lastUnrestYear = profile.lastUnrestYear ?? 0;
  next.lastRevolutionYear = profile.lastRevolutionYear ?? 0;
  return recomputeSociety(next);
}

export function faction(profile: SocietyProfile, id: SocialFactionId): FactionState {
  return profile.factions[id];
}

export function topSocialFactions(profile: SocietyProfile, limit: number = 3): FactionState[] {
  return SOCIAL_FACTION_ORDER
    .map(id => profile.factions[id])
    .sort((a, b) => b.influence - a.influence)
    .slice(0, limit);
}

export function restlessSocialFactions(profile: SocietyProfile, limit: number = 3): FactionState[] {
  return SOCIAL_FACTION_ORDER
    .map(id => profile.factions[id])
    .sort((a, b) => (b.radicalization * b.influence) - (a.radicalization * a.influence))
    .slice(0, limit);
}

export function societySummary(profile: SocietyProfile): string {
  const dominant = SOCIAL_FACTIONS[profile.dominantFaction].shortName.toLowerCase();
  if (profile.revoltRisk > 0.48) return `volatile, ${dominant}-led society`;
  if (profile.coupRisk > 0.35) return `military-shadowed, ${dominant}-led society`;
  if (profile.reformPressure > 0.45) return `reform-hungry, ${dominant}-led society`;
  if (profile.cohesion > 0.68) return `cohesive, ${dominant}-led society`;
  return `${dominant}-led society`;
}

function factionTargets(
  id: SocialFactionId,
  current: FactionState,
  ctx: SocietyTickContext
): Omit<FactionState, 'id'> {
  const supported = SOCIAL_FACTIONS[id].supports.includes(ctx.government);
  const resisted = SOCIAL_FACTIONS[id].resists.includes(ctx.government);
  const taxPain = clamp01((ctx.taxRate - 0.16) / 0.34);
  const faminePain = clamp01((1 - ctx.foodSecurity) + ctx.famineYears * 0.12);
  const warPain = clamp01(ctx.warWeariness / 100 + (ctx.atWar ? 0.22 : 0));
  const adminPain = clamp01(1 - ctx.administrativeReach);
  const inequalityPain = ctx.inequality;
  // Bread at double the base price is a full measure of pain.
  const foodPricePain = clamp01((ctx.foodScarcity - 1) / 1.2);
  const joblessPain = clamp01(ctx.unemployment / 0.3);

  // Recorded as each delta is applied, so the explanation cannot drift from the
  // arithmetic it is explaining.
  const factors: FactionFactor[] = [];
  const note = (label: string, delta: number, source?: FactorSource): number => {
    if (Math.abs(delta) >= 0.005) factors.push({ label, delta, source });
    return delta;
  };
  const govFit = supported ? 0.12 : resisted ? -0.16 : 0;

  let influence = baseInfluence(id, ctx.government);
  let satisfaction = 0.48
    + note('Afinidade com o regime', govFit)
    + note('Estabilidade', ctx.stability * 0.16)
    + note('Legitimidade', ctx.legitimacy * 0.12);
  let wealth = current.wealth;
  let loyalty = 0.44 + ctx.legitimacy * 0.24 + ctx.stability * 0.16 + govFit;
  let warSupport = 0.22 + ctx.externalThreat * 0.25 + ctx.culture.militarism * 0.18;
  let reformSupport = 0.2 + ctx.culture.innovation * 0.18 + Math.max(0, 0.52 - ctx.stability) * 0.3;

  switch (id) {
    case 'peasants':
      influence += 0.08 - ctx.industrialisation * 0.08;
      // The countryside sells grain, so dear bread enriches it — right up until
      // the shortage is bad enough that there is nothing left to sell.
      satisfaction += note('Segurança alimentar', ctx.foodSecurity * 0.28, { kind: 'good', good: 'food' })
        + note('Prosperidade', ctx.prosperity * 0.16)
        + note('Impostos', -taxPain * 0.22)
        + note('Guerra', -warPain * 0.12)
        + note('Preço do grão que vendem', foodPricePain * 0.08, { kind: 'good', good: 'food' });
      wealth = 0.28 + ctx.prosperity * 0.22 + ctx.foodSecurity * 0.16 - taxPain * 0.18 - inequalityPain * 0.08
        + foodPricePain * 0.12;
      warSupport -= 0.22 + faminePain * 0.18;
      reformSupport += faminePain * 0.2 + taxPain * 0.14;
      break;

    case 'nobles':
      influence += ctx.culture.tradition * 0.08 + (ctx.government === 'feudal_kingdom' || ctx.government === 'monarchy' ? 0.12 : 0);
      satisfaction += ctx.culture.tradition * 0.16 + inequalityPain * 0.12 + ctx.legitimacy * 0.08 - (ctx.government === 'communist_state' ? 0.32 : 0);
      wealth = 0.5 + inequalityPain * 0.28 + (ctx.economy === 'tributary' || ctx.economy === 'mercantile' ? 0.12 : 0);
      warSupport += ctx.culture.expansionism * 0.22;
      reformSupport -= 0.16;
      break;

    case 'merchants':
      influence += ctx.tradeDependency * 0.18 + (ctx.economy === 'market' || ctx.economy === 'mercantile' ? 0.12 : -0.05);
      // A merchant lives on market access. Every embargo is a door closed.
      satisfaction += note('Volume de comércio', ctx.tradeDependency * 0.3, { kind: 'trade' })
        + ctx.culture.openness * 0.14 + ctx.stability * 0.12
        + note('Guerra fecha rotas', -warPain * 0.22, { kind: 'trade' })
        + note('Impostos', -taxPain * 0.12)
        + note('Embargos', -clamp01(ctx.embargoes * 0.35) * 0.28, { kind: 'trade' });
      wealth = 0.35 + ctx.tradeDependency * 0.34 + (ctx.economy === 'market' ? 0.18 : 0) - warPain * 0.12
        - clamp01(ctx.embargoes * 0.35) * 0.2;
      warSupport -= 0.2 + ctx.tradeDependency * 0.18;
      reformSupport += ctx.culture.openness * 0.12;
      break;

    case 'military':
      influence += ctx.externalThreat * 0.18 + (ctx.atWar ? 0.16 : 0) + ctx.culture.militarism * 0.1;
      satisfaction += ctx.externalThreat * 0.12 + ctx.culture.militarism * 0.16 + (ctx.atWar ? 0.08 : -0.04) - ctx.warWeariness * 0.002;
      wealth = 0.32 + ctx.externalThreat * 0.2 + (ctx.atWar ? 0.12 : 0);
      warSupport += 0.32 + ctx.culture.militarism * 0.18 - ctx.culture.warTrauma * 0.16;
      reformSupport += Math.max(0, 0.42 - ctx.legitimacy) * 0.16;
      break;

    case 'workers':
      influence += ctx.industrialisation * 0.22 + Math.max(0, ctx.cityCount - 2) * 0.015;
      // Townsfolk buy their bread and live off a wage. Dear food and no work are
      // the two things that turn a workforce into a political problem.
      satisfaction += ctx.industrialisation * 0.08 + ctx.foodSecurity * 0.12
        + note('Desigualdade', -inequalityPain * 0.26)
        + note('Impostos', -taxPain * 0.08)
        + note('Preço da comida', -foodPricePain * 0.3, { kind: 'good', good: 'food' })
        + note('Desemprego', -joblessPain * 0.32, { kind: 'jobs' });
      wealth = 0.3 + ctx.industrialisation * 0.2 + (ctx.economy === 'planned' ? 0.12 : 0) - inequalityPain * 0.18
        - joblessPain * 0.24 - foodPricePain * 0.12;
      warSupport -= 0.12 + warPain * 0.14;
      reformSupport += inequalityPain * 0.28 + ctx.industrialisation * 0.12
        + foodPricePain * 0.26 + joblessPain * 0.3;
      break;

    case 'clergy_scholars':
      // A devout realm gives its clergy both standing and contentment; an
      // irreligious one leaves them a learned minority with nothing to lose.
      influence += (ctx.culture.tradition + ctx.culture.innovation) * 0.05 + ctx.legitimacy * 0.04 + ctx.faith * 0.14;
      satisfaction += ctx.legitimacy * 0.2 + ctx.culture.tradition * 0.1 + ctx.culture.innovation * 0.08
        + ctx.faith * 0.22 - warPain * 0.08;
      wealth = 0.34 + ctx.outputPerCapita / 80 + ctx.legitimacy * 0.08;
      warSupport -= ctx.culture.diplomaticTrust * 0.12;
      reformSupport += ctx.culture.innovation * 0.14;
      break;

    case 'frontier':
      influence += Math.max(0, ctx.cityCount - 1) * 0.025 + adminPain * 0.18 + ctx.culture.expansionism * 0.08;
      satisfaction += ctx.foodSecurity * 0.12 + ctx.culture.expansionism * 0.14 - adminPain * 0.18 - ctx.externalThreat * 0.12;
      wealth = 0.28 + ctx.prosperity * 0.16 + ctx.culture.expansionism * 0.08 - adminPain * 0.08;
      warSupport += ctx.externalThreat * 0.22 + ctx.culture.expansionism * 0.12;
      reformSupport += adminPain * 0.22;
      break;

    case 'bureaucrats':
      influence += ctx.culture.authority * 0.14 + (ctx.government === 'empire' || ctx.government === 'communist_state' ? 0.14 : 0);
      satisfaction += ctx.administrativeReach * 0.2 + ctx.culture.authority * 0.12 + ctx.legitimacy * 0.1 - (ctx.stability < 0.35 ? 0.12 : 0);
      wealth = 0.36 + ctx.taxRate * 0.35 + ctx.administrativeReach * 0.12;
      warSupport += ctx.culture.authority * 0.08;
      reformSupport -= 0.08;
      break;

    case 'reformists':
      influence += ctx.culture.innovation * 0.12 + ctx.culture.openness * 0.1 + Math.max(0, 0.55 - ctx.stability) * 0.16;
      satisfaction += ctx.culture.openness * 0.12 + ctx.culture.innovation * 0.1 - ctx.culture.authority * 0.12 - Math.max(0, 0.55 - ctx.legitimacy) * 0.18;
      wealth = 0.26 + ctx.outputPerCapita / 90 + ctx.culture.innovation * 0.08;
      warSupport -= 0.18 + ctx.culture.diplomaticTrust * 0.08;
      reformSupport += 0.38 + ctx.culture.innovation * 0.18 + Math.max(0, 0.58 - ctx.legitimacy) * 0.22;
      break;
  }

  satisfaction += note('Fome', -faminePain * 0.22, { kind: 'good', good: 'food' });
  satisfaction += note('Desgaste da guerra', -warPain * (id === 'military' ? 0.06 : 0.12));
  influence += ctx.laws?.factionInfluence?.[id] ?? 0;
  satisfaction += note('Leis vigentes', ctx.laws?.factionSatisfaction?.[id] ?? 0);
  loyalty += ctx.laws?.factionLoyalty?.[id] ?? 0;
  warSupport += ctx.laws?.factionWarSupport?.[id] ?? 0;
  reformSupport += ctx.laws?.factionReformSupport?.[id] ?? 0;
  reformSupport += ctx.laws?.reformPressure ?? 0;
  loyalty += satisfaction * 0.24 - Math.max(0, 0.45 - satisfaction) * 0.28;
  const radicalization = Math.max(
    0,
    0.08 +
      Math.max(0, 0.52 - satisfaction) * 0.75 +
      Math.max(0, 0.46 - loyalty) * 0.32 +
      faminePain * 0.18 +
      (ctx.laws?.revoltRisk ?? 0) +
      (resisted ? 0.06 : 0)
  );

  return {
    influence: clamp01(influence),
    satisfaction: clamp01(satisfaction),
    wealth: clamp01(wealth),
    loyalty: clamp01(loyalty),
    radicalization: clamp01(radicalization),
    warSupport: clamp01(warSupport),
    reformSupport: clamp01(reformSupport),
    // Strongest pull first, so the screen can show the reasons that matter.
    factors: factors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  };
}

function recomputeSociety(profile: SocietyProfile): SocietyProfile {
  let influenceTotal = 0;
  let cohesion = 0;
  let reformPressure = 0;
  let revoltRisk = 0;
  let warPressure = 0;
  let peacePressure = 0;
  let dominant: SocialFactionId = 'peasants';

  for (const id of SOCIAL_FACTION_ORDER) {
    const f = normalizeFaction(profile.factions[id]);
    profile.factions[id] = f;
    influenceTotal += f.influence;
    if (f.influence > profile.factions[dominant].influence) dominant = id;
  }

  for (const id of SOCIAL_FACTION_ORDER) {
    const f = profile.factions[id];
    const weight = f.influence / Math.max(0.01, influenceTotal);
    cohesion += (f.satisfaction * 0.48 + f.loyalty * 0.42 + (1 - f.radicalization) * 0.1) * weight;
    reformPressure += f.reformSupport * f.radicalization * weight;
    revoltRisk += Math.max(0, 0.56 - f.satisfaction) * f.radicalization * weight;
    warPressure += f.warSupport * weight;
    peacePressure += (1 - f.warSupport) * Math.max(0.2, 1 - f.satisfaction * 0.45) * weight;
  }

  const military = profile.factions.military;
  const nobles = profile.factions.nobles;
  profile.cohesion = clamp01(cohesion);
  profile.reformPressure = clamp01(reformPressure * 1.45);
  profile.revoltRisk = clamp01(revoltRisk * 2.1);
  profile.warPressure = clamp01(warPressure);
  profile.peacePressure = clamp01(peacePressure);
  profile.coupRisk = clamp01(
    military.influence * military.radicalization * (1 - military.loyalty) * 1.4 +
      nobles.influence * nobles.radicalization * Math.max(0, 0.55 - nobles.loyalty) * 0.75
  );
  profile.dominantFaction = dominant;
  return profile;
}

function baseInfluence(id: SocialFactionId, government: GovernmentType): number {
  const base: Record<SocialFactionId, number> = {
    peasants: 0.26,
    nobles: 0.12,
    merchants: 0.08,
    military: 0.12,
    workers: 0.06,
    clergy_scholars: 0.1,
    frontier: 0.1,
    bureaucrats: 0.08,
    reformists: 0.08
  };
  let value = base[id];

  if (government === 'tribe') {
    if (id === 'peasants' || id === 'frontier') value += 0.08;
    if (id === 'bureaucrats' || id === 'merchants' || id === 'workers') value -= 0.04;
  }
  if (government === 'feudal_kingdom' || government === 'monarchy') {
    if (id === 'nobles') value += 0.12;
    if (id === 'clergy_scholars') value += 0.04;
  }
  if (government === 'empire') {
    if (id === 'military' || id === 'bureaucrats') value += 0.1;
    if (id === 'frontier') value += 0.04;
  }
  if (government === 'republic' || government === 'constitutional_monarchy') {
    if (id === 'merchants' || id === 'reformists') value += 0.08;
    if (id === 'nobles') value -= 0.04;
  }
  if (government === 'capitalist_state') {
    if (id === 'merchants') value += 0.16;
    if (id === 'workers') value += 0.08;
  }
  if (government === 'communist_state') {
    if (id === 'workers' || id === 'bureaucrats' || id === 'military') value += 0.1;
    if (id === 'nobles' || id === 'merchants') value -= 0.08;
  }

  return clamp01(value);
}

function baseWealth(id: SocialFactionId, government: GovernmentType): number {
  const base: Record<SocialFactionId, number> = {
    peasants: 0.32,
    nobles: 0.6,
    merchants: 0.45,
    military: 0.34,
    workers: 0.3,
    clergy_scholars: 0.36,
    frontier: 0.28,
    bureaucrats: 0.38,
    reformists: 0.26
  };
  let value = base[id];
  if (government === 'capitalist_state' && id === 'merchants') value += 0.18;
  if (government === 'communist_state' && (id === 'peasants' || id === 'workers')) value += 0.08;
  if (government === 'feudal_kingdom' && id === 'nobles') value += 0.12;
  return clamp01(value);
}

function normalizeFaction(faction: FactionState): FactionState {
  return {
    id: faction.id,
    influence: clamp01(faction.influence ?? 0.1),
    satisfaction: clamp01(faction.satisfaction ?? 0.55),
    wealth: clamp01(faction.wealth ?? 0.35),
    loyalty: clamp01(faction.loyalty ?? 0.55),
    radicalization: clamp01(faction.radicalization ?? 0.08),
    warSupport: clamp01(faction.warSupport ?? 0.3),
    reformSupport: clamp01(faction.reformSupport ?? 0.25),
    factors: faction.factors
  };
}

function approach(current: number, target: number, rate: number): number {
  return clamp01(current + (clamp01(target) - current) * rate);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
