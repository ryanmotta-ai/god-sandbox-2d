import { Entity } from '../entities/Entity';
import { Psyche } from '../entities/Psyche';

/**
 * Who is in charge, and what kind of person they are.
 *
 * This replaces a parliament. The old model asked six invisible social factions
 * how satisfied they were and ran thirty-five laws through a support matrix to
 * decide what a realm did — none of which a player could see or point at. What
 * a player can see is a king, and what a king has is a temperament.
 *
 * A ruler's temperament is not stored anywhere. It is read off the psyche every
 * entity already carries, which means it costs nothing to save, and — because
 * psyche is inherited through the lineage — a tyrant's son is likely to be a
 * tyrant too, without a single line of code saying so. Kill the king with a
 * bolt of lightning and the next one may be a completely different animal.
 */

export type RulerTrait =
  | 'warlike'
  | 'bloodthirsty'
  | 'tyrant'
  | 'greedy'
  | 'diplomat'
  | 'peaceful'
  | 'lunatic';

export interface RulerTraitInfo {
  id: RulerTrait;
  name: string;
  icon: string;
  /** How much this ruler wants a war, -1..1. Read by the war decision. */
  belligerence: number;
}

export const RULER_TRAITS: Record<RulerTrait, RulerTraitInfo> = {
  warlike:      { id: 'warlike',      name: 'Belicista',   icon: '⚔️', belligerence: 0.7 },
  bloodthirsty: { id: 'bloodthirsty', name: 'Sanguinário', icon: '🩸', belligerence: 1 },
  tyrant:       { id: 'tyrant',       name: 'Tirano',      icon: '👑', belligerence: 0.35 },
  greedy:       { id: 'greedy',       name: 'Ganancioso',  icon: '🪙', belligerence: 0.3 },
  diplomat:     { id: 'diplomat',     name: 'Diplomata',   icon: '🤝', belligerence: -0.4 },
  peaceful:     { id: 'peaceful',     name: 'Pacífico',    icon: '🕊️', belligerence: -0.8 },
  lunatic:      { id: 'lunatic',      name: 'Lunático',    icon: '🌀', belligerence: 0.5 }
};

export type GovernorTrait = 'loyal' | 'ambitious' | 'corrupt' | 'protector';

export interface GovernorTraitInfo {
  id: GovernorTrait;
  name: string;
  icon: string;
  /** How much this governor's own province resents the crown, 0..1. */
  friction: number;
}

export const GOVERNOR_TRAITS: Record<GovernorTrait, GovernorTraitInfo> = {
  loyal:     { id: 'loyal',     name: 'Leal',      icon: '🛡️', friction: 0 },
  protector: { id: 'protector', name: 'Protetor',  icon: '🏰', friction: 0.1 },
  corrupt:   { id: 'corrupt',   name: 'Corrupto',  icon: '🕳️', friction: 0.5 },
  ambitious: { id: 'ambitious', name: 'Ambicioso', icon: '🗡️', friction: 0.8 }
};

/**
 * Spread between the highest and lowest of somebody's drives.
 *
 * A person pulled hard in several directions at once is not simply the sum of
 * them; that is what makes a ruler unpredictable rather than merely aggressive.
 */
function extremity(p: Psyche): number {
  const values = [p.courage, p.aggression, p.ambition, p.loyalty, p.riskTolerance];
  return Math.max(...values) - Math.min(...values);
}

/**
 * What kind of ruler this person is.
 *
 * Checked from the most defining temperament down, so the strongest reading
 * wins: somebody both bloodthirsty and greedy is remembered for the blood.
 */
export function rulerTraitOf(psyche: Psyche): RulerTrait {
  const p = psyche;
  /**
   * The thresholds are calibrated against how psyche is actually rolled.
   *
   * `createPsyche` averages two rolls, so every drive is a triangular
   * distribution centred on 0.5 — and inheritance pulls children back toward the
   * middle on top of that. Thresholds set as though the values were uniform
   * (aggression over 0.78 for a butcher) picked out two per cent of the
   * population, so a world of a dozen realms was ruled entirely by cautious men
   * and never fought anybody. These numbers are chosen to spread rulers across
   * every temperament instead.
   */
  if (p.aggression > 0.66 && p.courage > 0.52) return 'bloodthirsty';
  // Pulled hard in every direction at once, and reckless with it.
  if (extremity(p) > 0.5 && p.riskTolerance > 0.58) return 'lunatic';
  if (p.aggression > 0.55) return 'warlike';
  // Wants everything and is loyal to nobody, which is what a tyrant is.
  if (p.ambition > 0.58 && p.loyalty < 0.45) return 'tyrant';
  if (p.ambition > 0.55) return 'greedy';
  if (p.sociability > 0.5 && p.aggression < 0.48) return 'diplomat';
  // Nothing stands out. A cautious, ordinary ruler keeps the peace by default.
  return 'peaceful';
}

/** What kind of governor this person is. */
export function governorTraitOf(psyche: Psyche): GovernorTrait {
  const p = psyche;
  // Same calibration as above: triangular, centred on 0.5.
  if (p.ambition > 0.6 && p.loyalty < 0.45) return 'ambitious';
  if (p.ambition > 0.52 && p.loyalty < 0.55) return 'corrupt';
  if (p.courage > 0.56) return 'protector';
  return 'loyal';
}

/** The trait of whoever is on the throne, or a plain temperament if nobody is. */
export function traitOfRuler(ruler: Entity | null | undefined): RulerTrait {
  return ruler ? rulerTraitOf(ruler.psyche) : 'peaceful';
}

/** The trait of whoever runs this settlement, or loyal if nobody does. */
export function traitOfGovernor(governor: Entity | null | undefined): GovernorTrait {
  return governor ? governorTraitOf(governor.psyche) : 'loyal';
}


// ============================================================
// WHAT THE KING DOES ABOUT IT
// ============================================================

/** What a court needs to know about a neighbour to have an opinion of it. */
export interface Neighbour {
  id: string;
  name: string;
  /** Bilateral opinion, -100 (mortal hatred) to +100 (blood brothers). */
  relation: number;
  /** Their fighting strength against ours. 1 is even. */
  powerRatio: number;
  atWar: boolean;
  /** Already bound to us by a pact. */
  allied: boolean;
  /** Too far to march on, so an opinion is all it can ever be. */
  reachable: boolean;
}

/** How the court is doing at home, which decides whether it wants a war at all. */
export interface CourtState {
  trait: RulerTrait;
  /** 0..100. A tired realm sues for peace whatever the king wants. */
  warWeariness: number;
  /** True when an enemy is at the walls of the capital. */
  capitalBesieged: boolean;
  /**
   * How mobilised the realm is, against what a realm its size should field, 0..1.
   *
   * This is a muster ratio, NOT attrition — a realm that has not raised its levy
   * yet reads exactly like one that has been annihilated. `warYears` is what
   * tells the two apart.
   */
  armyRemaining: number;
  /**
   * Years the realm has been in its longest-running war. 0 at peace, and 0 for
   * a war declared this year.
   */
  warYears: number;
}

export type RoyalDecision =
  | { kind: 'war'; target: string; reason: string }
  | { kind: 'peace'; target: string; reason: string }
  | { kind: 'alliance'; target: string };

/**
 * Relations below this and the king has a grievance rather than a neighbour.
 * Above the alliance line and the two courts are close enough to sign.
 */
const HATRED = -50;
const FRIENDSHIP = 70;

/**
 * One turn of a king's thinking, on the strength of his temper and his position.
 *
 * Peace comes first, and deliberately so: a king whose capital is under siege or
 * whose army is gone sues for terms however warlike he is, because a decision
 * that ignores the state of the war is not statecraft, it is a formula. Only
 * once he is not losing does temperament get a say.
 *
 * Returns at most one decision. A court does one thing at a time, and the caller
 * comes back in ten or fifteen seconds.
 */
export function decideRoyalAction(court: CourtState, neighbours: Neighbour[]): RoyalDecision | null {
  const belligerence = RULER_TRAITS[court.trait].belligerence;

  // ---- Losing? Then sue for peace, whatever kind of man he is. ----
  const enemies = neighbours.filter(n => n.atWar);
  if (enemies.length > 0) {
    /**
     * A war cannot be lost before it is fought.
     *
     * `tickGeopolitics` declares wars and `tickRoyalCourts` reviews them in the
     * SAME statecraft slot, while `musterArmies` runs in the next one. So a king
     * used to look at an unraised levy the instant war was declared, read the
     * muster ratio as annihilation, and sue for peace before a single battle —
     * which is why an 80-year world produced one war that lasted zero years and
     * never formed a front. A besieged capital is still immediate surrender:
     * that is real information, not a missing muster.
     */
    const beaten = court.capitalBesieged || (court.warYears >= 1 && court.armyRemaining < 0.3);
    // Even a bloodthirsty king tires eventually; a peaceful one tires at once.
    const tired = court.warWeariness > 55 + belligerence * 30;
    if (beaten || tired) {
      // Sue to whoever is hurting most — the strongest enemy in the field.
      const worst = enemies.reduce((a, b) => (b.powerRatio > a.powerRatio ? b : a));
      return {
        kind: 'peace',
        target: worst.id,
        reason: court.capitalBesieged ? 'capital sitiada' : beaten ? 'exército dizimado' : 'exaustão de guerra'
      };
    }
    // Already fighting somebody and not losing: no new wars this turn.
    return null;
  }

  // ---- A grievance, a temper, and somebody he can actually reach. ----
  const candidates = neighbours.filter(n => n.reachable && !n.allied);
  const grudge = candidates
    .filter(n => n.relation < HATRED)
    // The weakest enemy first: a king picks the war he can win.
    .sort((a, b) => a.powerRatio - b.powerRatio)[0];
  if (grudge) {
    // A warlike king needs only a grievance. A peaceful one needs to be certain,
    // and a lunatic needs neither: he attacks whoever he happens to dislike.
    const overwhelming = grudge.powerRatio < 0.7;
    const willing = court.trait === 'lunatic'
      ? true
      : belligerence > 0 || overwhelming;
    if (willing && court.warWeariness < 60) {
      return { kind: 'war', target: grudge.id, reason: `ódio entre as cortes` };
    }
  }

  // ---- Or a friend worth binding. ----
  const friend = candidates
    .filter(n => n.relation > FRIENDSHIP)
    .sort((a, b) => b.relation - a.relation)[0];
  if (friend && belligerence < 0.8) return { kind: 'alliance', target: friend.id };

  return null;
}
