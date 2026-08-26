import { GovernmentType } from './Government';
import { RulerTrait, RULER_TRAITS } from './Rulers';

/**
 * How a realm feels about being a realm.
 *
 * This was six invisible social factions — peasants, nobles, merchants,
 * military, workers, reformists, frontier, clergy, bureaucrats — each with a
 * satisfaction, a loyalty, an influence, a radicalisation and a list of reasons,
 * all of it recomputed yearly through a support matrix and none of it visible
 * anywhere except a table. A player could not point at a single one of them.
 *
 * What a player can point at is a settlement's loyalty bar and the man on the
 * throne. So the realm's mood is derived from those: the average loyalty of its
 * towns, the worst of them, and the temperament of whoever is ruling. The
 * scalars below kept their old names because the political, warfare and
 * rebellion systems all read them and none of them ever cared where the number
 * came from — only that it meant "this realm is in trouble".
 */

export interface SocietyProfile {
  /** Mean loyalty across the realm's settlements, 0..1. */
  cohesion: number;
  /** Appetite for changing how things are run, 0..1. */
  reformPressure: number;
  /** Chance the army or the court takes the throne itself, 0..1. */
  coupRisk: number;
  /** Chance a province stops obeying, 0..1. Driven by the least loyal town. */
  revoltRisk: number;
  /** How much the realm wants the war it is in, 0..1. */
  warPressure: number;
  /** How much it wants out, 0..1. */
  peacePressure: number;
  lastUnrestYear: number;
  /**
   * Year the capital last overturned its own government.
   *
   * Kept apart from `lastUnrestYear` so ordinary discontent does not put a
   * revolution's cooldown on the clock, and so a realm cannot be overthrown
   * twice in a decade.
   */
  lastRevolutionYear: number;
}

export interface SocietyTickContext {
  year: number;
  /** Mean loyalty of the realm's settlements, 0..100. */
  meanLoyalty: number;
  /** Loyalty of its least contented settlement, 0..100. */
  worstLoyalty: number;
  ruler: RulerTrait;
  government: GovernmentType;
  atWar: boolean;
  warWeariness: number;
  legitimacy: number;
  stability: number;
}

export function createSocietyProfile(): SocietyProfile {
  return {
    cohesion: 1,
    reformPressure: 0,
    coupRisk: 0,
    revoltRisk: 0,
    warPressure: 0,
    peacePressure: 0,
    lastUnrestYear: -999,
    lastRevolutionYear: -999
  };
}

export function deserializeSocietyProfile(data: any): SocietyProfile {
  const profile = createSocietyProfile();
  if (!data) return profile;
  profile.cohesion = data.cohesion ?? 1;
  profile.reformPressure = data.reformPressure ?? 0;
  profile.coupRisk = data.coupRisk ?? 0;
  profile.revoltRisk = data.revoltRisk ?? 0;
  profile.warPressure = data.warPressure ?? 0;
  profile.peacePressure = data.peacePressure ?? 0;
  profile.lastUnrestYear = data.lastUnrestYear ?? -999;
  profile.lastRevolutionYear = data.lastRevolutionYear ?? -999;
  return profile;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Reads the realm's mood off its settlements and its king.
 *
 * Everything here is one line because every input is already a thing somebody
 * decided somewhere visible: a town's loyalty fell because its granary is empty,
 * the king is a tyrant because the psyche he inherited says so.
 */
export function updateSociety(profile: SocietyProfile, ctx: SocietyTickContext): SocietyProfile {
  const mean = clamp01(ctx.meanLoyalty / 100);
  const worst = clamp01(ctx.worstLoyalty / 100);
  const belligerence = RULER_TRAITS[ctx.ruler].belligerence;
  const weariness = clamp01(ctx.warWeariness / 100);

  const next: SocietyProfile = {
    ...profile,
    cohesion: mean,
    // The least loyal province is the one that goes, so it decides the risk.
    revoltRisk: clamp01(1 - worst),
    // A crown with no standing over an unhappy realm is a crown somebody takes.
    coupRisk: clamp01((1 - mean) * 0.5 + (1 - clamp01(ctx.legitimacy)) * 0.5 - clamp01(ctx.stability) * 0.3),
    // Discontent that has somewhere to go becomes a demand rather than a revolt.
    reformPressure: clamp01((1 - mean) * 0.8 - clamp01(ctx.stability) * 0.2),
    warPressure: ctx.atWar ? clamp01(belligerence * 0.6 + mean * 0.3 - weariness * 0.5) : 0,
    peacePressure: ctx.atWar ? clamp01(weariness * 0.7 + (1 - mean) * 0.4 - belligerence * 0.3) : 0
  };

  if (next.revoltRisk > 0.6 || next.coupRisk > 0.6) next.lastUnrestYear = ctx.year;
  return next;
}

/** One line for the chronicle and the inspector. */
export function societySummary(profile: SocietyProfile): string {
  if (profile.revoltRisk > 0.7) return 'Províncias à beira da revolta';
  if (profile.coupRisk > 0.6) return 'A corte conspira';
  if (profile.reformPressure > 0.6) return 'Pressão por reformas';
  if (profile.cohesion > 0.8) return 'Um reino unido';
  return 'Um reino inquieto';
}
