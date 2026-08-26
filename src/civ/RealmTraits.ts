import { GovernmentType, GOVERNMENTS } from './Government';
import { RulerTrait } from './Rulers';

/**
 * The character of a realm, as a handful of things that are true about it.
 *
 * This replaces thirty-five laws in twelve categories, each with a support
 * matrix over six social factions, reform momentum, a cooldown, a history of
 * amendments and an AI that chose which one to enact next. All of it was
 * legislation nobody could see being debated and nobody could read the effect
 * of, managed through a screen of tables.
 *
 * A realm's character is now read off two things a player already knows: how it
 * is governed, and who is on the throne. Nothing is stored, so nothing can drift
 * out of step with either — and because a ruler's temperament is inherited
 * through the psyche, a realm's whole disposition can change the day its king
 * dies. Kill a tyrant and the censors go with him.
 */

export type RealmTrait =
  | 'high_tax'
  | 'light_tax'
  | 'conscription'
  | 'professional_army'
  | 'free_trade'
  | 'closed_markets'
  | 'common_lands'
  | 'noble_privilege'
  | 'strong_bureaucracy'
  | 'censorship'
  | 'patronage_of_learning';

export interface RealmTraitInfo {
  id: RealmTrait;
  name: string;
  icon: string;
  effects: RealmEffects;
}

/** What a trait does to the realm. Every field is optional and additive. */
export interface RealmEffects {
  taxMultiplier?: number;
  stability?: number;
  legitimacy?: number;
  administrativeReach?: number;
  foodSecurity?: number;
  trade?: number;
  production?: number;
  research?: number;
  military?: number;
  expansion?: number;
  inequality?: number;
}

export const REALM_TRAITS: Record<RealmTrait, RealmTraitInfo> = {
  high_tax: {
    id: 'high_tax', name: 'Imposto Alto', icon: '🪙',
    effects: { taxMultiplier: 0.35, stability: -0.08, inequality: 0.06 }
  },
  light_tax: {
    id: 'light_tax', name: 'Imposto Leve', icon: '🍃',
    effects: { taxMultiplier: -0.2, stability: 0.06, administrativeReach: -0.04 }
  },
  conscription: {
    id: 'conscription', name: 'Recrutamento Obrigatório', icon: '🎯',
    effects: { military: 0.3, stability: -0.1, production: -0.06 }
  },
  professional_army: {
    id: 'professional_army', name: 'Exército Profissional', icon: '🛡️',
    effects: { military: 0.18, taxMultiplier: 0.1, stability: 0.04 }
  },
  free_trade: {
    id: 'free_trade', name: 'Comércio Livre', icon: '🤝',
    effects: { trade: 0.25, production: 0.06, inequality: 0.05 }
  },
  closed_markets: {
    id: 'closed_markets', name: 'Mercados Fechados', icon: '🚧',
    effects: { trade: -0.25, stability: 0.05, foodSecurity: 0.06 }
  },
  common_lands: {
    id: 'common_lands', name: 'Terras Comuns', icon: '🌾',
    effects: { foodSecurity: 0.12, inequality: -0.1, production: -0.04 }
  },
  noble_privilege: {
    id: 'noble_privilege', name: 'Privilégio Nobiliárquico', icon: '👑',
    effects: { legitimacy: 0.08, inequality: 0.12, stability: -0.04 }
  },
  strong_bureaucracy: {
    id: 'strong_bureaucracy', name: 'Burocracia Forte', icon: '📜',
    effects: { administrativeReach: 0.12, taxMultiplier: 0.08, expansion: 2 }
  },
  censorship: {
    id: 'censorship', name: 'Censura', icon: '🔇',
    effects: { stability: 0.08, research: -0.12, legitimacy: -0.05 }
  },
  patronage_of_learning: {
    id: 'patronage_of_learning', name: 'Mecenato', icon: '📚',
    effects: { research: 0.18, legitimacy: 0.04, taxMultiplier: 0.05 }
  }
};

/**
 * What is true about a realm governed this way, by a ruler like this.
 *
 * The government sets the frame — a despot taxes hard and censors, a republic
 * trades and reads — and the ruler bends it. The two can pull against each
 * other, and that is the point: a peaceful king inside a militarist state is a
 * different realm from a bloodthirsty one, without either of them legislating.
 */
export function realmTraitsOf(government: GovernmentType, ruler: RulerTrait): RealmTrait[] {
  const gov = GOVERNMENTS[government];
  const traits = new Set<RealmTrait>();

  // ---- What the form of government makes true. ----
  traits.add(gov.taxRate >= 0.24 ? 'high_tax' : gov.taxRate <= 0.12 ? 'light_tax' : 'professional_army');
  if (gov.economy === 'market' || gov.economy === 'mercantile') traits.add('free_trade');
  if (gov.economy === 'planned' || gov.economy === 'subsistence') traits.add('closed_markets');
  if (gov.economy === 'planned') traits.add('common_lands');
  if (gov.succession === 'bloodline') traits.add('noble_privilege');
  if (gov.research >= 1.1) traits.add('patronage_of_learning');
  if (gov.aggression >= 0.6) traits.add('conscription');
  // A state that can reach further than a rider can remember runs on clerks.
  if (gov.expansion >= 12) traits.add('strong_bureaucracy');

  // ---- What the person on the throne makes true. ----
  switch (ruler) {
    case 'tyrant':
      traits.add('censorship');
      traits.add('high_tax');
      traits.delete('light_tax');
      break;
    case 'greedy':
      traits.add('high_tax');
      traits.delete('light_tax');
      break;
    case 'warlike':
      traits.add('conscription');
      break;
    case 'bloodthirsty':
      traits.add('conscription');
      traits.add('censorship');
      break;
    case 'diplomat':
      traits.add('free_trade');
      traits.delete('closed_markets');
      break;
    case 'peaceful':
      traits.add('common_lands');
      traits.delete('conscription');
      break;
    default:
      // A lunatic's realm is whatever it already was, only less predictable.
      break;
  }

  return [...traits];
}

/** Everything the realm's traits add up to. */
export function realmEffects(traits: RealmTrait[]): RealmEffects {
  const total: RealmEffects = {};
  for (const id of traits) {
    for (const [key, value] of Object.entries(REALM_TRAITS[id].effects)) {
      const field = key as keyof RealmEffects;
      total[field] = (total[field] ?? 0) + (value as number);
    }
  }
  return total;
}

/** One line naming what this realm is like. */
export function realmTraitSummary(traits: RealmTrait[]): string {
  if (traits.length === 0) return 'Um reino sem caráter definido';
  return traits.map(id => REALM_TRAITS[id].name).join(' · ');
}
