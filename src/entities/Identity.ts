/**
 * Who a citizen actually is.
 *
 * Layer 1 of the citizen simulation. Before a person can have a routine, a job
 * that is visible, or a household economy, they need an identity that persists:
 * where they were born, where they live now, what they own, and where that places
 * them in the social order of their settlement.
 *
 * Nothing here simulates behaviour. It is the record other layers read from and
 * write to — the daily routine reads `homeBuildingId`, the household economy reads
 * `wealth` and `householdId`, and the social/faction layer reads `socialClass`.
 */

import type { Entity } from './Entity';

/** Where a citizen sits in the social order of their settlement. */
export type SocialClass = 'destitute' | 'commoner' | 'artisan' | 'merchant' | 'notable' | 'ruler';

export interface SocialClassInfo {
  id: SocialClass;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const SOCIAL_CLASSES: Record<SocialClass, SocialClassInfo> = {
  destitute: {
    id: 'destitute',
    label: 'Miserável',
    icon: '🥀',
    color: '#78716c',
    description: 'Sem posses e sem trabalho fixo. Depende da caridade ou da sorte.'
  },
  commoner: {
    id: 'commoner',
    label: 'Plebeu',
    icon: '🌾',
    color: '#a3a3a3',
    description: 'Trabalha a terra ou a pedra. A base sobre a qual tudo se apoia.'
  },
  artisan: {
    id: 'artisan',
    label: 'Artesão',
    icon: '⚒️',
    color: '#fb923c',
    description: 'Domina um ofício. Vende trabalho qualificado, não apenas força.'
  },
  merchant: {
    id: 'merchant',
    label: 'Mercador',
    icon: '🪙',
    color: '#fbbf24',
    description: 'Vive da troca. Sua riqueza não vem do que produz, mas do que move.'
  },
  notable: {
    id: 'notable',
    label: 'Notável',
    icon: '📜',
    color: '#a855f7',
    description: 'Nome conhecido além da própria rua. Erudito, oficial ou herói.'
  },
  ruler: {
    id: 'ruler',
    label: 'Soberano',
    icon: '👑',
    color: '#f59e0b',
    description: 'Governa. Sua fortuna e a do reino são difíceis de separar.'
  }
};

/** Coin thresholds that separate the classes, before profession is considered. */
const WEALTH_ARTISAN = 60;
const WEALTH_MERCHANT = 220;
const WEALTH_DESTITUTE = 4;

/**
 * A citizen's standing, derived rather than stored, so it can never drift out of
 * sync with the wealth and job that produce it.
 */
export function deriveSocialClass(entity: Entity): SocialClass {
  if (entity.profession === 'king' || entity.profession === 'leader') return 'ruler';
  if (entity.isGreatPerson) return 'notable';

  const wealth = entity.wealth;
  if (wealth >= WEALTH_MERCHANT) return 'merchant';

  const skilled = entity.profession === 'builder' || entity.profession === 'healer' || entity.profession === 'scout';
  if (skilled && wealth >= WEALTH_ARTISAN) return 'artisan';
  if (wealth >= WEALTH_ARTISAN * 2) return 'artisan';

  // Children are sheltered by their household rather than being destitute in
  // their own right, so only working-age adults can fall to the bottom rung.
  if (wealth <= WEALTH_DESTITUTE && !entity.isChild && entity.profession === 'none') return 'destitute';

  return 'commoner';
}

/** Starting personal coin for a newly created adult of a given profession. */
export function startingWealthFor(profession: string, roll: (min: number, max: number) => number): number {
  switch (profession) {
    case 'king':
    case 'leader': return roll(180, 400);
    case 'builder':
    case 'healer': return roll(25, 70);
    case 'soldier':
    case 'archer': return roll(12, 45);
    case 'none': return roll(0, 8);
    default: return roll(6, 30);
  }
}

/** Human-readable origin line, e.g. "Nascido em Valdris no ano 42". */
export function describeOrigin(entity: Entity): string {
  const where = entity.birthCityName || 'terras sem nome';
  return `Nascido em ${where} no ano ${entity.birthYear}`;
}

/** True when this citizen no longer lives where they were born. */
export function isMigrant(entity: Entity): boolean {
  return !!entity.birthCityId && !!entity.cityId && entity.birthCityId !== entity.cityId;
}
