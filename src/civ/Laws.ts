import type { CulturalProfile } from './Culture';
import type { EconomicSystem, GovernmentType } from './Government';
import type { SocialFactionId, SocietyProfile } from './Society';

export type LawCategory =
  | 'taxation'
  | 'land'
  | 'trade'
  | 'military'
  | 'rights'
  | 'administration'
  | 'labor'
  | 'knowledge'
  | 'ecology';

export type LawId =
  | 'subsistence_levies'
  | 'royal_tithe'
  | 'war_taxes'
  | 'progressive_tax'
  | 'common_lands'
  | 'noble_estates'
  | 'land_redistribution'
  | 'frontier_homesteads'
  | 'closed_markets'
  | 'chartered_companies'
  | 'free_trade'
  | 'strategic_tariffs'
  | 'citizen_militia'
  | 'professional_army'
  | 'mass_conscription'
  | 'defensive_doctrine'
  | 'customary_rights'
  | 'noble_privileges'
  | 'civic_rights'
  | 'emergency_powers'
  | 'village_autonomy'
  | 'royal_bureaucracy'
  | 'imperial_governors'
  | 'federal_charters'
  | 'guild_customs'
  | 'free_labor'
  | 'labor_protections'
  | 'state_labor_duty'
  | 'temple_schools'
  | 'public_schools'
  | 'censorship_office'
  | 'academies_charter'
  | 'common_harvest'
  | 'conservation_edicts'
  | 'extraction_mandate';

export interface LawEffects {
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
  reformPressure?: number;
  revoltRisk?: number;
  factionSatisfaction?: Partial<Record<SocialFactionId, number>>;
  factionInfluence?: Partial<Record<SocialFactionId, number>>;
  factionLoyalty?: Partial<Record<SocialFactionId, number>>;
  factionWarSupport?: Partial<Record<SocialFactionId, number>>;
  factionReformSupport?: Partial<Record<SocialFactionId, number>>;
}

export interface LawDefinition {
  id: LawId;
  category: LawCategory;
  name: string;
  shortName: string;
  description: string;
  effects: LawEffects;
  favours: SocialFactionId[];
  angers: SocialFactionId[];
  governments?: GovernmentType[];
}

export interface LawChange {
  year: number;
  category: LawCategory;
  from: LawId;
  to: LawId;
  pressure: number;
}

export interface LawProfile {
  active: Record<LawCategory, LawId>;
  reformMomentum: number;
  lastReformYear: number;
  reformCooldownUntil: number;
  history: LawChange[];
}

export interface LawReformContext {
  year: number;
  government: GovernmentType;
  economy: EconomicSystem;
  atWar: boolean;
  stability: number;
  legitimacy: number;
  foodSecurity: number;
  tradeDependency: number;
  externalThreat: number;
  administrativeReach: number;
  inequality: number;
  industrialisation: number;
  cityCount: number;
  warWeariness: number;
  society: SocietyProfile;
  culture: CulturalProfile;
}

export interface LawReformDecision {
  law: LawDefinition;
  current: LawDefinition;
  score: number;
  pressure: number;
}

export const LAW_CATEGORY_ORDER: LawCategory[] = [
  'taxation',
  'land',
  'trade',
  'military',
  'rights',
  'administration',
  'labor',
  'knowledge',
  'ecology'
];

export const LAWS: Record<LawId, LawDefinition> = {
  subsistence_levies: {
    id: 'subsistence_levies',
    category: 'taxation',
    name: 'Subsistence Levies',
    shortName: 'Low levies',
    description: 'The crown takes little and leaves most production in village hands.',
    favours: ['peasants', 'frontier'],
    angers: ['bureaucrats', 'military'],
    effects: {
      taxMultiplier: -0.28,
      stability: 0.02,
      factionSatisfaction: { peasants: 0.08, frontier: 0.04, bureaucrats: -0.04, military: -0.03 },
      factionInfluence: { peasants: 0.04 }
    }
  },
  royal_tithe: {
    id: 'royal_tithe',
    category: 'taxation',
    name: 'Royal Tithe',
    shortName: 'Tithe',
    description: 'A predictable levy funds the court without fully squeezing the countryside.',
    favours: ['bureaucrats', 'nobles'],
    angers: [],
    effects: {
      taxMultiplier: 0,
      legitimacy: 0.01,
      factionLoyalty: { bureaucrats: 0.03, nobles: 0.02 }
    }
  },
  war_taxes: {
    id: 'war_taxes',
    category: 'taxation',
    name: 'War Taxes',
    shortName: 'War taxes',
    description: 'Extraordinary taxation keeps armies supplied and civilians angry.',
    favours: ['military', 'bureaucrats'],
    angers: ['peasants', 'merchants', 'workers'],
    effects: {
      taxMultiplier: 0.34,
      military: 0.08,
      stability: -0.04,
      factionSatisfaction: { military: 0.08, peasants: -0.09, merchants: -0.08, workers: -0.06 },
      factionWarSupport: { military: 0.08 }
    }
  },
  progressive_tax: {
    id: 'progressive_tax',
    category: 'taxation',
    name: 'Progressive Taxation',
    shortName: 'Progressive tax',
    description: 'The wealthy pay more, reducing inequality while angering old privilege.',
    favours: ['peasants', 'workers', 'reformists'],
    angers: ['nobles', 'merchants'],
    effects: {
      taxMultiplier: 0.08,
      inequality: -0.08,
      reformPressure: -0.03,
      factionSatisfaction: { peasants: 0.06, workers: 0.07, reformists: 0.08, nobles: -0.08, merchants: -0.04 },
      factionReformSupport: { reformists: -0.04 }
    },
    governments: ['constitutional_monarchy', 'republic', 'capitalist_state', 'communist_state']
  },
  common_lands: {
    id: 'common_lands',
    category: 'land',
    name: 'Common Lands',
    shortName: 'Commons',
    description: 'Villages retain shared fields, forests and grazing rights.',
    favours: ['peasants', 'frontier'],
    angers: ['nobles'],
    effects: {
      foodSecurity: 0.04,
      expansion: -1,
      factionSatisfaction: { peasants: 0.07, frontier: 0.04, nobles: -0.04 },
      factionInfluence: { peasants: 0.04 }
    }
  },
  noble_estates: {
    id: 'noble_estates',
    category: 'land',
    name: 'Noble Estates',
    shortName: 'Estates',
    description: 'Land is held through noble privilege and inherited obligation.',
    favours: ['nobles', 'military'],
    angers: ['peasants', 'reformists'],
    effects: {
      military: 0.04,
      legitimacy: 0.03,
      inequality: 0.08,
      factionSatisfaction: { nobles: 0.09, military: 0.03, peasants: -0.05, reformists: -0.08 },
      factionInfluence: { nobles: 0.08 }
    }
  },
  land_redistribution: {
    id: 'land_redistribution',
    category: 'land',
    name: 'Land Redistribution',
    shortName: 'Land reform',
    description: 'Old estates are broken up and redistributed to households and communes.',
    favours: ['peasants', 'workers', 'reformists'],
    angers: ['nobles'],
    effects: {
      foodSecurity: 0.06,
      inequality: -0.12,
      legitimacy: -0.02,
      factionSatisfaction: { peasants: 0.1, workers: 0.05, reformists: 0.08, nobles: -0.18 },
      factionInfluence: { nobles: -0.08, peasants: 0.05 }
    },
    governments: ['republic', 'communist_state']
  },
  frontier_homesteads: {
    id: 'frontier_homesteads',
    category: 'land',
    name: 'Frontier Homesteads',
    shortName: 'Homesteads',
    description: 'Settlers receive legal title for claiming and defending new land.',
    favours: ['frontier', 'peasants'],
    angers: ['bureaucrats', 'nobles'],
    effects: {
      expansion: 6,
      administrativeReach: -0.02,
      factionSatisfaction: { frontier: 0.1, peasants: 0.03, bureaucrats: -0.04, nobles: -0.03 },
      factionInfluence: { frontier: 0.08 }
    }
  },
  closed_markets: {
    id: 'closed_markets',
    category: 'trade',
    name: 'Closed Markets',
    shortName: 'Closed markets',
    description: 'Foreign trade is restricted to protect custom and local supply.',
    favours: ['peasants', 'bureaucrats'],
    angers: ['merchants', 'reformists'],
    effects: {
      trade: -0.16,
      foodSecurity: 0.02,
      factionSatisfaction: { peasants: 0.02, bureaucrats: 0.03, merchants: -0.1, reformists: -0.03 },
      factionWarSupport: { merchants: -0.05 }
    }
  },
  chartered_companies: {
    id: 'chartered_companies',
    category: 'trade',
    name: 'Chartered Companies',
    shortName: 'Charters',
    description: 'Favoured merchant houses receive monopolies in exchange for crown revenue.',
    favours: ['merchants', 'bureaucrats'],
    angers: ['workers', 'peasants'],
    effects: {
      taxMultiplier: 0.08,
      trade: 0.12,
      inequality: 0.06,
      factionSatisfaction: { merchants: 0.1, bureaucrats: 0.04, workers: -0.03, peasants: -0.02 },
      factionInfluence: { merchants: 0.08 }
    }
  },
  free_trade: {
    id: 'free_trade',
    category: 'trade',
    name: 'Free Trade',
    shortName: 'Free trade',
    description: 'Borders open to caravans, ports and foreign goods.',
    favours: ['merchants', 'reformists'],
    angers: ['nobles'],
    effects: {
      trade: 0.18,
      research: 0.04,
      inequality: 0.04,
      factionSatisfaction: { merchants: 0.12, reformists: 0.04, peasants: 0.02, nobles: -0.04 },
      factionInfluence: { merchants: 0.08 },
      factionWarSupport: { merchants: -0.08 }
    },
    governments: ['monarchy', 'constitutional_monarchy', 'republic', 'capitalist_state']
  },
  strategic_tariffs: {
    id: 'strategic_tariffs',
    category: 'trade',
    name: 'Strategic Tariffs',
    shortName: 'Tariffs',
    description: 'The state protects key workshops and taxes cross-border trade.',
    favours: ['workers', 'bureaucrats'],
    angers: ['merchants'],
    effects: {
      taxMultiplier: 0.12,
      production: 0.05,
      trade: -0.06,
      factionSatisfaction: { workers: 0.05, bureaucrats: 0.04, merchants: -0.06 }
    }
  },
  citizen_militia: {
    id: 'citizen_militia',
    category: 'military',
    name: 'Citizen Militia',
    shortName: 'Militia',
    description: 'Villages defend themselves with irregular local forces.',
    favours: ['peasants', 'frontier'],
    angers: ['military'],
    effects: {
      military: -0.03,
      stability: 0.02,
      factionSatisfaction: { peasants: 0.03, frontier: 0.04, military: -0.05 },
      factionInfluence: { military: -0.04 }
    }
  },
  professional_army: {
    id: 'professional_army',
    category: 'military',
    name: 'Professional Army',
    shortName: 'Army',
    description: 'A trained standing army answers to the state.',
    favours: ['military', 'bureaucrats'],
    angers: ['peasants'],
    effects: {
      military: 0.1,
      taxMultiplier: 0.08,
      factionSatisfaction: { military: 0.1, bureaucrats: 0.03, peasants: -0.03 },
      factionInfluence: { military: 0.07 }
    }
  },
  mass_conscription: {
    id: 'mass_conscription',
    category: 'military',
    name: 'Mass Conscription',
    shortName: 'Conscription',
    description: 'Every household owes bodies to the army in wartime.',
    favours: ['military'],
    angers: ['peasants', 'workers', 'merchants'],
    effects: {
      military: 0.18,
      production: -0.06,
      stability: -0.05,
      factionSatisfaction: { military: 0.11, peasants: -0.12, workers: -0.08, merchants: -0.05 },
      factionWarSupport: { peasants: -0.08, workers: -0.06 }
    },
    governments: ['empire', 'communist_state', 'republic', 'monarchy']
  },
  defensive_doctrine: {
    id: 'defensive_doctrine',
    category: 'military',
    name: 'Defensive Doctrine',
    shortName: 'Defense',
    description: 'The army is built around fortification, deterrence and limited wars.',
    favours: ['peasants', 'merchants', 'frontier'],
    angers: ['military'],
    effects: {
      military: 0.04,
      stability: 0.03,
      factionSatisfaction: { peasants: 0.04, merchants: 0.04, frontier: 0.05, military: -0.03 },
      factionWarSupport: { military: -0.06, merchants: -0.04 }
    }
  },
  customary_rights: {
    id: 'customary_rights',
    category: 'rights',
    name: 'Customary Rights',
    shortName: 'Custom',
    description: 'Rights are local, unwritten and rooted in long memory.',
    favours: ['peasants', 'clergy_scholars'],
    angers: ['reformists', 'bureaucrats'],
    effects: {
      stability: 0.02,
      research: -0.02,
      factionSatisfaction: { peasants: 0.03, clergy_scholars: 0.03, reformists: -0.04, bureaucrats: -0.03 }
    }
  },
  noble_privileges: {
    id: 'noble_privileges',
    category: 'rights',
    name: 'Noble Privileges',
    shortName: 'Privileges',
    description: 'The law openly protects aristocratic status and hereditary exemptions.',
    favours: ['nobles', 'military'],
    angers: ['peasants', 'workers', 'reformists'],
    effects: {
      legitimacy: 0.04,
      inequality: 0.1,
      reformPressure: 0.05,
      factionSatisfaction: { nobles: 0.11, military: 0.03, peasants: -0.05, workers: -0.06, reformists: -0.1 },
      factionInfluence: { nobles: 0.09 }
    }
  },
  civic_rights: {
    id: 'civic_rights',
    category: 'rights',
    name: 'Civic Rights',
    shortName: 'Civic rights',
    description: 'Subjects gain predictable legal standing and protected civic voice.',
    favours: ['merchants', 'workers', 'reformists', 'clergy_scholars'],
    angers: ['nobles', 'military'],
    effects: {
      legitimacy: 0.04,
      research: 0.04,
      reformPressure: -0.06,
      factionSatisfaction: { merchants: 0.06, workers: 0.06, reformists: 0.08, clergy_scholars: 0.05, nobles: -0.06, military: -0.03 },
      factionLoyalty: { reformists: 0.08, workers: 0.04 }
    },
    governments: ['constitutional_monarchy', 'republic', 'capitalist_state']
  },
  emergency_powers: {
    id: 'emergency_powers',
    category: 'rights',
    name: 'Emergency Powers',
    shortName: 'Emergency',
    description: 'Civil life bends to security, censorship and rapid executive command.',
    favours: ['military', 'bureaucrats'],
    angers: ['reformists', 'merchants', 'clergy_scholars'],
    effects: {
      administrativeReach: 0.06,
      military: 0.07,
      stability: -0.03,
      reformPressure: 0.08,
      factionSatisfaction: { military: 0.08, bureaucrats: 0.05, reformists: -0.14, merchants: -0.05, clergy_scholars: -0.06 },
      factionInfluence: { military: 0.05, bureaucrats: 0.05 }
    }
  },
  village_autonomy: {
    id: 'village_autonomy',
    category: 'administration',
    name: 'Village Autonomy',
    shortName: 'Autonomy',
    description: 'Local elders and towns settle most affairs without the capital.',
    favours: ['peasants', 'frontier'],
    angers: ['bureaucrats'],
    effects: {
      administrativeReach: -0.08,
      stability: 0.04,
      revoltRisk: -0.03,
      factionSatisfaction: { peasants: 0.05, frontier: 0.08, bureaucrats: -0.08 },
      factionInfluence: { frontier: 0.04 }
    }
  },
  royal_bureaucracy: {
    id: 'royal_bureaucracy',
    category: 'administration',
    name: 'Royal Bureaucracy',
    shortName: 'Bureaucracy',
    description: 'Written offices, clerks and governors bind towns to the treasury.',
    favours: ['bureaucrats', 'merchants'],
    angers: ['frontier'],
    effects: {
      administrativeReach: 0.1,
      taxMultiplier: 0.08,
      factionSatisfaction: { bureaucrats: 0.08, merchants: 0.03, frontier: -0.05 },
      factionInfluence: { bureaucrats: 0.08 }
    }
  },
  imperial_governors: {
    id: 'imperial_governors',
    category: 'administration',
    name: 'Imperial Governors',
    shortName: 'Governors',
    description: 'Appointed governors extract tribute and obedience from far provinces.',
    favours: ['bureaucrats', 'military'],
    angers: ['frontier', 'peasants', 'reformists'],
    effects: {
      administrativeReach: 0.16,
      taxMultiplier: 0.12,
      stability: -0.03,
      factionSatisfaction: { bureaucrats: 0.09, military: 0.04, frontier: -0.12, peasants: -0.04, reformists: -0.05 },
      factionInfluence: { bureaucrats: 0.1, frontier: 0.04 }
    },
    governments: ['empire', 'monarchy', 'communist_state']
  },
  federal_charters: {
    id: 'federal_charters',
    category: 'administration',
    name: 'Federal Charters',
    shortName: 'Federalism',
    description: 'Provincial rights are written down to keep distant cities inside the realm.',
    favours: ['frontier', 'merchants', 'reformists'],
    angers: ['bureaucrats', 'nobles'],
    effects: {
      administrativeReach: 0.04,
      stability: 0.05,
      revoltRisk: -0.06,
      factionSatisfaction: { frontier: 0.12, merchants: 0.04, reformists: 0.05, bureaucrats: -0.04, nobles: -0.03 }
    },
    governments: ['constitutional_monarchy', 'republic', 'capitalist_state']
  },
  guild_customs: {
    id: 'guild_customs',
    category: 'labor',
    name: 'Guild Customs',
    shortName: 'Guilds',
    description: 'Craft labour is organised through guild rules and inherited mastery.',
    favours: ['workers', 'clergy_scholars'],
    angers: ['merchants'],
    effects: {
      production: 0.03,
      research: 0.01,
      factionSatisfaction: { workers: 0.05, clergy_scholars: 0.03, merchants: -0.03 },
      factionInfluence: { workers: 0.03 }
    }
  },
  free_labor: {
    id: 'free_labor',
    category: 'labor',
    name: 'Free Labour Markets',
    shortName: 'Free labour',
    description: 'Workers sell labour freely while employers set wages through markets.',
    favours: ['merchants'],
    angers: ['workers', 'reformists'],
    effects: {
      production: 0.08,
      trade: 0.05,
      inequality: 0.08,
      factionSatisfaction: { merchants: 0.07, workers: -0.07, reformists: -0.05 },
      factionInfluence: { merchants: 0.04, workers: 0.03 }
    },
    governments: ['constitutional_monarchy', 'republic', 'capitalist_state']
  },
  labor_protections: {
    id: 'labor_protections',
    category: 'labor',
    name: 'Labour Protections',
    shortName: 'Labour rights',
    description: 'Guilds and workers gain legal protection from exhaustion and hunger wages.',
    favours: ['workers', 'reformists', 'peasants'],
    angers: ['merchants'],
    effects: {
      production: -0.02,
      inequality: -0.08,
      stability: 0.04,
      factionSatisfaction: { workers: 0.12, reformists: 0.07, peasants: 0.03, merchants: -0.06 },
      factionLoyalty: { workers: 0.06 }
    },
    governments: ['constitutional_monarchy', 'republic', 'capitalist_state', 'communist_state']
  },
  state_labor_duty: {
    id: 'state_labor_duty',
    category: 'labor',
    name: 'State Labour Duty',
    shortName: 'Labour duty',
    description: 'The state assigns labour to strategic works, mines and foundries.',
    favours: ['bureaucrats', 'military'],
    angers: ['workers', 'peasants'],
    effects: {
      production: 0.12,
      military: 0.04,
      stability: -0.04,
      factionSatisfaction: { bureaucrats: 0.06, military: 0.04, workers: -0.12, peasants: -0.06 },
      factionInfluence: { bureaucrats: 0.05 }
    },
    governments: ['empire', 'communist_state']
  },
  temple_schools: {
    id: 'temple_schools',
    category: 'knowledge',
    name: 'Temple Schools',
    shortName: 'Temple schools',
    description: 'Knowledge is guarded by ritual specialists and old institutions.',
    favours: ['clergy_scholars', 'nobles'],
    angers: ['reformists'],
    effects: {
      research: 0.03,
      legitimacy: 0.04,
      factionSatisfaction: { clergy_scholars: 0.08, nobles: 0.03, reformists: -0.04 },
      factionInfluence: { clergy_scholars: 0.05 }
    }
  },
  public_schools: {
    id: 'public_schools',
    category: 'knowledge',
    name: 'Public Schools',
    shortName: 'Schools',
    description: 'Basic education spreads beyond temples, courts and guild families.',
    favours: ['workers', 'peasants', 'reformists', 'clergy_scholars'],
    angers: ['nobles'],
    effects: {
      research: 0.12,
      legitimacy: 0.02,
      reformPressure: -0.02,
      factionSatisfaction: { workers: 0.05, peasants: 0.04, reformists: 0.05, clergy_scholars: 0.05, nobles: -0.03 }
    },
    governments: ['constitutional_monarchy', 'republic', 'capitalist_state', 'communist_state']
  },
  censorship_office: {
    id: 'censorship_office',
    category: 'knowledge',
    name: 'Censorship Office',
    shortName: 'Censors',
    description: 'The state controls dangerous texts, news and public teaching.',
    favours: ['bureaucrats', 'military'],
    angers: ['clergy_scholars', 'reformists', 'merchants'],
    effects: {
      research: -0.06,
      stability: 0.03,
      reformPressure: 0.08,
      factionSatisfaction: { bureaucrats: 0.05, military: 0.03, clergy_scholars: -0.12, reformists: -0.12, merchants: -0.04 }
    }
  },
  academies_charter: {
    id: 'academies_charter',
    category: 'knowledge',
    name: 'Academies Charter',
    shortName: 'Academies',
    description: 'Learned institutions receive protection, grants and formal autonomy.',
    favours: ['clergy_scholars', 'merchants', 'reformists'],
    angers: ['military'],
    effects: {
      research: 0.14,
      trade: 0.03,
      factionSatisfaction: { clergy_scholars: 0.12, merchants: 0.04, reformists: 0.04, military: -0.03 },
      factionInfluence: { clergy_scholars: 0.06 }
    },
    governments: ['monarchy', 'constitutional_monarchy', 'republic', 'capitalist_state']
  },
  common_harvest: {
    id: 'common_harvest',
    category: 'ecology',
    name: 'Common Harvest',
    shortName: 'Harvest custom',
    description: 'Forests, animals and soil are used through inherited local norms.',
    favours: ['peasants', 'frontier'],
    angers: [],
    effects: {
      foodSecurity: 0.02,
      production: 0.01,
      factionSatisfaction: { peasants: 0.03, frontier: 0.03 }
    }
  },
  conservation_edicts: {
    id: 'conservation_edicts',
    category: 'ecology',
    name: 'Conservation Edicts',
    shortName: 'Conservation',
    description: 'The state limits extraction to preserve forests, animals and watersheds.',
    favours: ['peasants', 'clergy_scholars', 'reformists'],
    angers: ['merchants', 'workers'],
    effects: {
      foodSecurity: 0.06,
      production: -0.04,
      stability: 0.02,
      factionSatisfaction: { peasants: 0.04, clergy_scholars: 0.06, reformists: 0.04, merchants: -0.04, workers: -0.03 }
    },
    governments: ['tribe', 'constitutional_monarchy', 'republic', 'communist_state']
  },
  extraction_mandate: {
    id: 'extraction_mandate',
    category: 'ecology',
    name: 'Extraction Mandate',
    shortName: 'Extraction',
    description: 'Mines, timber camps and foundries receive legal priority over restraint.',
    favours: ['merchants', 'workers', 'military'],
    angers: ['peasants', 'clergy_scholars'],
    effects: {
      production: 0.1,
      military: 0.04,
      foodSecurity: -0.04,
      factionSatisfaction: { merchants: 0.05, workers: 0.04, military: 0.03, peasants: -0.06, clergy_scholars: -0.04 }
    }
  }
};

const DEFAULT_LAWS: Record<GovernmentType, Record<LawCategory, LawId>> = {
  tribe: {
    taxation: 'subsistence_levies',
    land: 'common_lands',
    trade: 'closed_markets',
    military: 'citizen_militia',
    rights: 'customary_rights',
    administration: 'village_autonomy',
    labor: 'guild_customs',
    knowledge: 'temple_schools',
    ecology: 'common_harvest'
  },
  chiefdom: {
    taxation: 'royal_tithe',
    land: 'common_lands',
    trade: 'closed_markets',
    military: 'citizen_militia',
    rights: 'customary_rights',
    administration: 'village_autonomy',
    labor: 'guild_customs',
    knowledge: 'temple_schools',
    ecology: 'common_harvest'
  },
  feudal_kingdom: {
    taxation: 'royal_tithe',
    land: 'noble_estates',
    trade: 'strategic_tariffs',
    military: 'professional_army',
    rights: 'noble_privileges',
    administration: 'royal_bureaucracy',
    labor: 'guild_customs',
    knowledge: 'temple_schools',
    ecology: 'common_harvest'
  },
  monarchy: {
    taxation: 'royal_tithe',
    land: 'noble_estates',
    trade: 'chartered_companies',
    military: 'professional_army',
    rights: 'noble_privileges',
    administration: 'royal_bureaucracy',
    labor: 'guild_customs',
    knowledge: 'academies_charter',
    ecology: 'common_harvest'
  },
  empire: {
    taxation: 'war_taxes',
    land: 'noble_estates',
    trade: 'strategic_tariffs',
    military: 'professional_army',
    rights: 'emergency_powers',
    administration: 'imperial_governors',
    labor: 'state_labor_duty',
    knowledge: 'censorship_office',
    ecology: 'extraction_mandate'
  },
  constitutional_monarchy: {
    taxation: 'royal_tithe',
    land: 'common_lands',
    trade: 'free_trade',
    military: 'defensive_doctrine',
    rights: 'civic_rights',
    administration: 'federal_charters',
    labor: 'labor_protections',
    knowledge: 'public_schools',
    ecology: 'conservation_edicts'
  },
  republic: {
    taxation: 'progressive_tax',
    land: 'frontier_homesteads',
    trade: 'free_trade',
    military: 'defensive_doctrine',
    rights: 'civic_rights',
    administration: 'federal_charters',
    labor: 'labor_protections',
    knowledge: 'public_schools',
    ecology: 'conservation_edicts'
  },
  capitalist_state: {
    taxation: 'royal_tithe',
    land: 'frontier_homesteads',
    trade: 'free_trade',
    military: 'professional_army',
    rights: 'civic_rights',
    administration: 'royal_bureaucracy',
    labor: 'free_labor',
    knowledge: 'academies_charter',
    ecology: 'extraction_mandate'
  },
  communist_state: {
    taxation: 'progressive_tax',
    land: 'land_redistribution',
    trade: 'closed_markets',
    military: 'mass_conscription',
    rights: 'emergency_powers',
    administration: 'imperial_governors',
    labor: 'state_labor_duty',
    knowledge: 'public_schools',
    ecology: 'extraction_mandate'
  }
};

export function createLawProfile(government: GovernmentType = 'tribe'): LawProfile {
  return {
    active: { ...DEFAULT_LAWS[government] },
    reformMomentum: 0.12,
    lastReformYear: 0,
    reformCooldownUntil: 0,
    history: []
  };
}

export function deserializeLawProfile(data: any, government: GovernmentType = 'tribe'): LawProfile {
  const profile = createLawProfile(government);
  if (!data) return profile;

  for (const category of LAW_CATEGORY_ORDER) {
    const id = data.active?.[category] as LawId | undefined;
    if (id && LAWS[id]?.category === category) profile.active[category] = id;
  }

  profile.reformMomentum = clamp01(data.reformMomentum ?? profile.reformMomentum);
  profile.lastReformYear = data.lastReformYear ?? 0;
  profile.reformCooldownUntil = data.reformCooldownUntil ?? 0;
  profile.history = Array.isArray(data.history) ? data.history.slice(-12) : [];
  return profile;
}

export function resetLawDefaults(profile: LawProfile, government: GovernmentType): void {
  profile.active = { ...DEFAULT_LAWS[government] };
  profile.reformMomentum = Math.max(profile.reformMomentum, 0.24);
  profile.reformCooldownUntil = Math.max(profile.reformCooldownUntil, profile.lastReformYear + 2);
}

export function activeLawDefinitions(profile: LawProfile): LawDefinition[] {
  return LAW_CATEGORY_ORDER.map(category => LAWS[profile.active[category]]);
}

export function aggregateLawEffects(profile: LawProfile): LawEffects {
  const total: LawEffects = {};
  for (const law of activeLawDefinitions(profile)) mergeEffects(total, law.effects);
  return total;
}

export function lawSummary(profile: LawProfile): string {
  const active = activeLawDefinitions(profile);
  const reformist = active.filter(law => law.favours.includes('reformists')).length;
  const militarised = active.filter(law => law.favours.includes('military')).length;
  const elite = active.filter(law => law.favours.includes('nobles')).length;
  const mercantile = active.filter(law => law.favours.includes('merchants')).length;
  if (reformist >= 4) return 'reformist legal order';
  if (militarised >= 4) return 'militarised legal order';
  if (elite >= 4) return 'aristocratic legal order';
  if (mercantile >= 4) return 'mercantile legal order';
  return 'mixed legal order';
}

export function updateLawMomentum(profile: LawProfile, ctx: LawReformContext): void {
  const pressure =
    ctx.society.reformPressure * 0.35 +
    ctx.society.revoltRisk * 0.25 +
    ctx.society.coupRisk * 0.12 +
    Math.max(0, 0.48 - ctx.stability) * 0.18 +
    Math.max(0, 0.5 - ctx.legitimacy) * 0.12 +
    Math.max(0, 0.45 - ctx.foodSecurity) * 0.1;
  profile.reformMomentum = clamp01(profile.reformMomentum + pressure * 0.18 - 0.035);
}

export function chooseLawReform(profile: LawProfile, ctx: LawReformContext): LawReformDecision | null {
  if (ctx.year < profile.reformCooldownUntil) return null;

  let best: LawReformDecision | null = null;
  for (const law of Object.values(LAWS)) {
    if (profile.active[law.category] === law.id) continue;
    if (law.governments && !law.governments.includes(ctx.government)) continue;

    const current = LAWS[profile.active[law.category]];
    const score = lawFit(law, ctx) - lawFit(current, ctx) - reformResistance(law, current, ctx);
    const pressure = clamp01(profile.reformMomentum + ctx.society.reformPressure * 0.35 + Math.max(0, score) * 0.45);
    if (score < 0.08) continue;
    if (!best || score > best.score) best = { law, current, score, pressure };
  }

  if (!best || best.pressure < 0.28) return null;
  return best;
}

export function enactLaw(profile: LawProfile, lawId: LawId, year: number, pressure: number): LawChange {
  const law = LAWS[lawId];
  const from = profile.active[law.category];
  profile.active[law.category] = lawId;
  profile.lastReformYear = year;
  profile.reformCooldownUntil = year + 4 + Math.floor((1 - pressure) * 4);
  profile.reformMomentum = Math.max(0.04, profile.reformMomentum * 0.38);
  const change: LawChange = {
    year,
    category: law.category,
    from,
    to: lawId,
    pressure: clamp01(pressure)
  };
  profile.history.unshift(change);
  profile.history = profile.history.slice(0, 12);
  return change;
}

function lawFit(law: LawDefinition, ctx: LawReformContext): number {
  const e = law.effects;
  let score = 0.25;
  score += (e.stability ?? 0) * (ctx.stability < 0.55 ? 2.2 : 0.7);
  score += (e.legitimacy ?? 0) * (ctx.legitimacy < 0.56 ? 1.9 : 0.8);
  score += (e.foodSecurity ?? 0) * (ctx.foodSecurity < 0.55 ? 2.3 : 0.7);
  score += (e.administrativeReach ?? 0) * (ctx.administrativeReach < 0.58 || ctx.cityCount >= 4 ? 1.7 : 0.6);
  score += (e.trade ?? 0) * (ctx.tradeDependency > 0.2 || ctx.economy === 'market' || ctx.economy === 'mercantile' ? 1.4 : 0.4);
  score += (e.production ?? 0) * (ctx.industrialisation > 0.25 ? 1.3 : 0.7);
  score += (e.research ?? 0) * (ctx.culture.innovation > 0.45 ? 1.1 : 0.55);
  score += (e.military ?? 0) * (ctx.atWar || ctx.externalThreat > 0.46 ? 1.7 : 0.5);
  score += (e.expansion ?? 0) * (ctx.culture.expansionism > 0.52 ? 0.02 : 0.005);
  score -= (e.inequality ?? 0) * (ctx.inequality > 0.48 || ctx.society.reformPressure > 0.35 ? 1.4 : 0.45);
  score -= (e.revoltRisk ?? 0) * 1.5;
  score -= (e.reformPressure ?? 0) * (ctx.society.reformPressure > 0.35 ? 1.4 : 0.7);
  score += factionFit(e.factionSatisfaction, ctx, 0.9);
  score += factionFit(e.factionLoyalty, ctx, 0.45);
  score += factionFit(e.factionInfluence, ctx, 0.25);
  score += factionFit(e.factionWarSupport, ctx, ctx.atWar || ctx.externalThreat > 0.5 ? 0.28 : -0.08);
  score += factionFit(e.factionReformSupport, ctx, ctx.society.reformPressure > 0.38 ? -0.22 : 0.08);

  if (law.favours.includes(ctx.society.dominantFaction)) score += 0.08;
  if (law.angers.includes(ctx.society.dominantFaction)) score -= 0.12;
  if (ctx.atWar && law.category === 'military') score += 0.08;
  if (ctx.foodSecurity < 0.45 && law.favours.includes('peasants')) score += 0.08;
  if (ctx.tradeDependency > 0.35 && law.favours.includes('merchants')) score += 0.08;
  return score;
}

function factionFit(
  effects: Partial<Record<SocialFactionId, number>> | undefined,
  ctx: LawReformContext,
  scale: number
): number {
  if (!effects) return 0;
  let score = 0;
  for (const [id, value] of Object.entries(effects) as [SocialFactionId, number][]) {
    const faction = ctx.society.factions[id];
    const unrest = Math.max(0.15, 1 - faction.satisfaction + faction.radicalization * 0.8);
    score += value * faction.influence * unrest * scale;
  }
  return score;
}

function reformResistance(law: LawDefinition, current: LawDefinition, ctx: LawReformContext): number {
  let resistance = 0.03;
  for (const id of current.favours) {
    const faction = ctx.society.factions[id];
    resistance += faction.influence * faction.loyalty * 0.08;
  }
  for (const id of law.angers) {
    const faction = ctx.society.factions[id];
    resistance += faction.influence * Math.max(0.2, faction.radicalization) * 0.1;
  }
  if (law.category === 'rights' || law.category === 'land') resistance += ctx.culture.tradition * 0.04;
  if (ctx.atWar && law.category !== 'military' && law.category !== 'taxation') resistance += 0.05;
  return resistance;
}

function mergeEffects(total: LawEffects, add: LawEffects): void {
  total.taxMultiplier = (total.taxMultiplier ?? 0) + (add.taxMultiplier ?? 0);
  total.stability = (total.stability ?? 0) + (add.stability ?? 0);
  total.legitimacy = (total.legitimacy ?? 0) + (add.legitimacy ?? 0);
  total.administrativeReach = (total.administrativeReach ?? 0) + (add.administrativeReach ?? 0);
  total.foodSecurity = (total.foodSecurity ?? 0) + (add.foodSecurity ?? 0);
  total.trade = (total.trade ?? 0) + (add.trade ?? 0);
  total.production = (total.production ?? 0) + (add.production ?? 0);
  total.research = (total.research ?? 0) + (add.research ?? 0);
  total.military = (total.military ?? 0) + (add.military ?? 0);
  total.expansion = (total.expansion ?? 0) + (add.expansion ?? 0);
  total.inequality = (total.inequality ?? 0) + (add.inequality ?? 0);
  total.reformPressure = (total.reformPressure ?? 0) + (add.reformPressure ?? 0);
  total.revoltRisk = (total.revoltRisk ?? 0) + (add.revoltRisk ?? 0);
  mergeFactionMap(total, add, 'factionSatisfaction');
  mergeFactionMap(total, add, 'factionInfluence');
  mergeFactionMap(total, add, 'factionLoyalty');
  mergeFactionMap(total, add, 'factionWarSupport');
  mergeFactionMap(total, add, 'factionReformSupport');
}

function mergeFactionMap(total: LawEffects, add: LawEffects, key: keyof LawEffects): void {
  const values = add[key] as Partial<Record<SocialFactionId, number>> | undefined;
  if (!values) return;
  const target = ((total[key] as Partial<Record<SocialFactionId, number>> | undefined) ?? {}) as Partial<Record<SocialFactionId, number>>;
  for (const [id, value] of Object.entries(values) as [SocialFactionId, number][]) {
    target[id] = (target[id] ?? 0) + value;
  }
  (total as any)[key] = target;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
