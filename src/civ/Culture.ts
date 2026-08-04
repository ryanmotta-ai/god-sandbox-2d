import { SpeciesType } from '../entities/Species';
import { rng } from '../core/Random';
import type { EconomicSystem, GovernmentType } from './Government';

/** The traits a founding temperament can push on. */
type TemperamentTraits = Partial<Record<
  'militarism' | 'expansionism' | 'tradition' | 'authority' | 'openness' |
  'mercantilism' | 'stewardship' | 'innovation' | 'collectivism' | 'diplomaticTrust',
  number
>>;

/**
 * What the first generation of a realm cared about.
 *
 * These replace the old per-race bonuses. They do the same job — making realms
 * behave unlike one another — but as a claim about history rather than biology,
 * and they feed the same downstream systems: laws, tariffs, research priorities
 * and faction satisfaction all read culture.
 */
const FOUNDING_TEMPERAMENTS: { name: string; traits: TemperamentTraits }[] = [
  { name: 'Cidade mercante', traits: { mercantilism: 0.25, openness: 0.18, diplomaticTrust: 0.12, militarism: -0.12 } },
  { name: 'Marca guerreira', traits: { militarism: 0.26, expansionism: 0.18, authority: 0.12, diplomaticTrust: -0.18 } },
  { name: 'Assembleia de anciãos', traits: { tradition: 0.26, authority: 0.16, collectivism: 0.14, innovation: -0.14 } },
  { name: 'Colônia pioneira', traits: { expansionism: 0.24, innovation: 0.16, openness: 0.12, tradition: -0.14 } },
  { name: 'Companhia de eruditos', traits: { innovation: 0.26, openness: 0.14, mercantilism: 0.10, militarism: -0.14 } },
  { name: 'Povo do rio', traits: { stewardship: 0.26, collectivism: 0.14, openness: 0.10, expansionism: -0.12 } }
];

export interface CulturalProfile {
  /** Pride in soldiers, conquest and martial honour. */
  militarism: number;
  /** Desire to settle new lands and push frontiers. */
  expansionism: number;
  /** Trust in old customs, dynasties and inherited order. */
  tradition: number;
  /** Acceptance of central command, hierarchy and state coercion. */
  authority: number;
  /** Openness to foreigners, trade partners and mixed societies. */
  openness: number;
  /** Love of merchants, markets, caravans and ports. */
  mercantilism: number;
  /** Respect for forests, rivers, wildlife and long-term land health. */
  stewardship: number;
  /** Comfort with new tools, reforms and strange ideas. */
  innovation: number;
  /** Shared obligation over private status and noble privilege. */
  collectivism: number;
  /** Historical fear created by long wars, defeats and massacres. */
  warTrauma: number;
  /** Confidence that treaties will be honoured. */
  diplomaticTrust: number;
  memories: CulturalMemory[];
}

export type CulturalMemoryKind =
  | 'golden_age'
  | 'famine'
  | 'war'
  | 'victory'
  | 'defeat'
  | 'revolution'
  | 'trade_boom'
  | 'secession';

export interface CulturalMemory {
  kind: CulturalMemoryKind;
  year: number;
  intensity: number;
  label: string;
}

export interface CultureTickContext {
  year: number;
  government: GovernmentType;
  economy: EconomicSystem;
  atWar: boolean;
  wars: number;
  stability: number;
  legitimacy: number;
  prosperity: number;
  foodSecurity: number;
  tradeDependency: number;
  externalThreat: number;
  administrativeReach: number;
  cityCount: number;
  famineYears: number;
  recentGovernmentChange: boolean;
}

export function createCulturalProfile(species: SpeciesType): CulturalProfile {
  const profile: CulturalProfile = {
    militarism: 0.38,
    expansionism: 0.42,
    tradition: 0.55,
    authority: 0.48,
    openness: 0.5,
    mercantilism: 0.38,
    stewardship: 0.45,
    innovation: 0.42,
    collectivism: 0.45,
    warTrauma: 0.05,
    diplomaticTrust: 0.55,
    memories: []
  };

  // Every realm is human, so what distinguishes them is what their founders
  // valued — not what they were born as. The temperament is drawn from the world
  // seed, so the same world always raises the same peoples, and it is only a
  // starting bias: everything after this is moved by history.
  const founding = rng.pick(FOUNDING_TEMPERAMENTS);
  for (const [trait, delta] of Object.entries(founding.traits)) {
    profile[trait as keyof typeof founding.traits] += delta;
  }

  return normalizeCulture(profile);
}

export function deserializeCulturalProfile(data: any, species: SpeciesType): CulturalProfile {
  const base = createCulturalProfile(species);
  if (!data) return base;
  return normalizeCulture({
    ...base,
    ...data,
    memories: Array.isArray(data.memories) ? data.memories.slice(-8) : []
  });
}

export function updateCulture(profile: CulturalProfile, ctx: CultureTickContext): CulturalProfile {
  const next = { ...profile, memories: [...profile.memories] };
  const drift = (key: keyof Omit<CulturalProfile, 'memories'>, target: number, rate: number) => {
    next[key] = approach(next[key], target, rate);
  };

  const pressure = Math.max(ctx.externalThreat, ctx.atWar ? 0.85 : 0);
  const scarcity = Math.max(0, 1 - ctx.foodSecurity);
  const imperialStrain = Math.max(0, (ctx.cityCount - 4) / 7) + Math.max(0, 1 - ctx.administrativeReach);

  drift('militarism', 0.28 + pressure * 0.48 + ctx.wars * 0.08, 0.045);
  drift('expansionism', ctx.government === 'empire' ? 0.76 : 0.36 + ctx.legitimacy * 0.18 - scarcity * 0.16, 0.028);
  drift('tradition', ctx.legitimacy > 0.62 ? 0.66 : 0.42 - Math.max(0, 0.45 - ctx.legitimacy) * 0.35, 0.025);
  drift('authority', authorityTarget(ctx), 0.035);
  drift('openness', opennessTarget(ctx, pressure), 0.03);
  drift('mercantilism', ctx.tradeDependency * 0.75 + (ctx.economy === 'market' || ctx.economy === 'mercantile' ? 0.22 : 0.08), 0.04);
  drift('stewardship', 0.34 + ctx.prosperity * 0.22 + scarcity * 0.18 - industrialPressure(ctx), 0.025);
  drift('innovation', innovationTarget(ctx), 0.032);
  drift('collectivism', collectivismTarget(ctx), 0.035);
  drift('warTrauma', ctx.atWar ? 0.35 + ctx.wars * 0.16 : 0.06, ctx.atWar ? 0.05 : 0.018);
  drift('diplomaticTrust', ctx.atWar ? 0.24 : 0.48 + ctx.tradeDependency * 0.24 + ctx.stability * 0.14, 0.03);

  if (ctx.famineYears > 0) {
    next.collectivism = clamp01(next.collectivism + 0.015 * ctx.famineYears);
    next.openness = clamp01(next.openness - 0.01 * ctx.famineYears);
    maybeRemember(next, 'famine', ctx.year, Math.min(1, ctx.famineYears / 4), 'Famine years hardened public memory.');
  }

  if (ctx.atWar && ctx.wars > 0) {
    maybeRemember(next, 'war', ctx.year, Math.min(1, ctx.wars / 3 + ctx.externalThreat * 0.35), 'A generation was shaped by war.');
  }

  if (!ctx.atWar && ctx.stability > 0.72 && ctx.foodSecurity > 0.7 && ctx.prosperity > 0.62) {
    maybeRemember(next, 'golden_age', ctx.year, Math.min(1, ctx.stability), 'Prosperity made this era feel legitimate.');
  }

  if (ctx.tradeDependency > 0.42 && !ctx.atWar) {
    maybeRemember(next, 'trade_boom', ctx.year, ctx.tradeDependency, 'Trade routes became part of public life.');
  }

  if (ctx.recentGovernmentChange) {
    maybeRemember(next, 'revolution', ctx.year, Math.max(0.3, 1 - ctx.legitimacy), 'The old order changed within living memory.');
  }

  next.memories = next.memories
    .filter(memory => ctx.year - memory.year <= 80)
    .sort((a, b) => b.year - a.year)
    .slice(0, 8);

  return normalizeCulture(next);
}

export function rememberCulture(
  profile: CulturalProfile,
  kind: CulturalMemoryKind,
  year: number,
  intensity: number,
  label: string
): void {
  maybeRemember(profile, kind, year, intensity, label, true);
}

export function culturalAffinity(a: CulturalProfile, b: CulturalProfile): number {
  const distance =
    Math.abs(a.militarism - b.militarism) * 0.8 +
    Math.abs(a.expansionism - b.expansionism) * 0.7 +
    Math.abs(a.tradition - b.tradition) * 0.55 +
    Math.abs(a.authority - b.authority) * 0.55 +
    Math.abs(a.openness - b.openness) * 0.9 +
    Math.abs(a.mercantilism - b.mercantilism) * 0.5 +
    Math.abs(a.stewardship - b.stewardship) * 0.35 +
    Math.abs(a.innovation - b.innovation) * 0.45 +
    Math.abs(a.collectivism - b.collectivism) * 0.45;
  return clamp01(1 - distance / 4.7);
}

export function dominantCultureTraits(profile: CulturalProfile, limit: number = 3): string[] {
  const traits: Array<{ label: string; value: number }> = [
    { label: 'martial', value: profile.militarism },
    { label: 'expansionist', value: profile.expansionism },
    { label: 'traditional', value: profile.tradition },
    { label: 'authoritarian', value: profile.authority },
    { label: 'cosmopolitan', value: profile.openness },
    { label: 'mercantile', value: profile.mercantilism },
    { label: 'stewardship-minded', value: profile.stewardship },
    { label: 'innovative', value: profile.innovation },
    { label: 'collectivist', value: profile.collectivism },
    { label: 'war-haunted', value: profile.warTrauma },
    { label: 'treaty-minded', value: profile.diplomaticTrust }
  ];
  return traits
    .filter(trait => trait.value >= 0.58)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map(trait => trait.label);
}

export function cultureSummary(profile: CulturalProfile): string {
  const traits = dominantCultureTraits(profile, 3);
  if (traits.length === 0) return 'balanced society';
  return traits.join(', ');
}

function normalizeCulture(profile: CulturalProfile): CulturalProfile {
  const numericKeys: Array<keyof Omit<CulturalProfile, 'memories'>> = [
    'militarism',
    'expansionism',
    'tradition',
    'authority',
    'openness',
    'mercantilism',
    'stewardship',
    'innovation',
    'collectivism',
    'warTrauma',
    'diplomaticTrust'
  ];
  for (const key of numericKeys) profile[key] = clamp01(profile[key] ?? 0.5);
  profile.memories = profile.memories ?? [];
  return profile;
}

function maybeRemember(
  profile: CulturalProfile,
  kind: CulturalMemoryKind,
  year: number,
  intensity: number,
  label: string,
  force: boolean = false
): void {
  if (!force) {
    const last = profile.memories.find(memory => memory.kind === kind);
    if (last && year - last.year < 12) return;
    if (intensity < 0.35) return;
  }
  profile.memories.unshift({ kind, year, intensity: clamp01(intensity), label });
}

function authorityTarget(ctx: CultureTickContext): number {
  if (ctx.government === 'empire' || ctx.government === 'monarchy' || ctx.government === 'communist_state') {
    return 0.68 + ctx.externalThreat * 0.16;
  }
  if (ctx.government === 'republic' || ctx.government === 'capitalist_state') {
    return 0.34 + Math.max(0, 0.45 - ctx.stability) * 0.35;
  }
  return 0.5 + ctx.externalThreat * 0.16;
}

function opennessTarget(ctx: CultureTickContext, pressure: number): number {
  const tradePull = ctx.tradeDependency * 0.5 + (ctx.economy === 'market' || ctx.economy === 'mercantile' ? 0.2 : 0);
  return 0.42 + tradePull - pressure * 0.28 - Math.max(0, 0.45 - ctx.foodSecurity) * 0.2;
}

function innovationTarget(ctx: CultureTickContext): number {
  const marketPull = ctx.economy === 'market' ? 0.28 : ctx.economy === 'planned' ? 0.18 : 0.08;
  const crisisPull = Math.max(0, 0.5 - ctx.stability) * 0.28;
  const traditionDrag = ctx.government === 'feudal_kingdom' || ctx.government === 'monarchy' ? 0.08 : 0;
  return 0.38 + marketPull + crisisPull - traditionDrag;
}

function collectivismTarget(ctx: CultureTickContext): number {
  if (ctx.economy === 'planned') return 0.72 + Math.max(0, 0.55 - ctx.foodSecurity) * 0.12;
  if (ctx.economy === 'market') return 0.36 + Math.max(0, 0.45 - ctx.stability) * 0.24;
  return 0.48 + Math.max(0, 0.5 - ctx.foodSecurity) * 0.26;
}

function industrialPressure(ctx: CultureTickContext): number {
  return ctx.economy === 'market' || ctx.economy === 'planned' ? 0.12 : 0;
}

function approach(current: number, target: number, rate: number): number {
  return clamp01(current + (clamp01(target) - current) * rate);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
