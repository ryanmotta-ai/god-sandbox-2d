/**
 * The political and geopolitical verdicts.
 *
 * The screen's question is *who wants what, why, and what could it cause* — so
 * every diagnosis here is built to survive being asked "says who?". Two rules
 * make that possible.
 *
 * **Causes come from the simulation's own accounting.** `FactionState.factors`
 * records the exact delta the society tick applied to each faction and what it
 * was for. A pressure reported here names those deltas rather than a plausible
 * story about a resentful worker.
 *
 * **Where the causes are not recorded, the verdict says so.** Stability has no
 * stored decomposition, so its explanation lists the pressures the simulation
 * measures and feeds into the tick — labelled as inputs, not as a breakdown that
 * sums to the figure. `DiplomacyManager` keeps no history behind a relation
 * score at all, so relations get their standing facts and nothing more.
 */
import { GOODS, type GoodId } from '../../civ/Goods';
import type { Status } from '../kit';
import type {
  PoliticsMetrics, FactionView, RelationView, DependencyView
} from './PoliticsMetrics';

/** A named political condition with a verdict and the arithmetic behind it. */
export interface PoliticalCondition {
  id: string;
  label: string;
  icon: string;
  status: Status | 'unknown';
  finding: string;
  terms?: { label: string; value: string; status?: Status }[];
  /** Makes the row navigable when one good or faction is implicated. */
  good?: GoodId;
  factionId?: string;
}

/** One pressure on the regime, with the measured factors behind it. */
export interface PoliticalPressure {
  id: string;
  label: string;
  detail: string;
  severity: 'warning' | 'critical';
  icon: string;
  /** The recorded deltas or figures that produced it. */
  causes: { label: string; value: string; good?: GoodId }[];
  factionId?: string;
  good?: GoodId;
}

/** One thing about the realm's foreign position that could go wrong. */
export interface GeopoliticalPressure {
  id: string;
  label: string;
  detail: string;
  severity: 'warning' | 'critical';
  icon: string;
  kingdomId?: string;
  good?: GoodId;
}

// ============================ FACTION LABELS ============================

/**
 * The nine factions, in the interface's language.
 *
 * `SOCIAL_FACTIONS` names them in English because the simulation is written in
 * English; the interface is Portuguese. A closed set of nine known groups, so
 * translating the label at the boundary is localisation, not invention — the
 * state, the deltas and the arithmetic still come from the faction itself.
 * Anything not covered falls back to the engine's own name.
 */
const FACTION_LABEL: Record<string, { name: string; short: string; description: string }> = {
  peasants: { name: 'Camponeses', short: 'Camponeses', description: 'Agricultores, criadores e famílias de aldeia que carregam a produção de alimento e o peso dos tributos.' },
  nobles: { name: 'Nobreza', short: 'Nobreza', description: 'Antigos donos de terra, dinastas e famílias guerreiras que querem privilégio e continuidade.' },
  merchants: { name: 'Mercadores', short: 'Mercadores', description: 'Donos de caravana, agiotas, famílias portuárias e elites de mercado.' },
  military: { name: 'Militares', short: 'Militares', description: 'Soldados, oficiais, veteranos e comandantes de fronteira, atentos a segurança e prestígio.' },
  workers: { name: 'Trabalhadores', short: 'Trabalhadores', description: 'Artesãos, construtores, mineiros e operários criados pela produção urbana.' },
  clergy_scholars: { name: 'Clero e Eruditos', short: 'Eruditos', description: 'Autoridades rituais, professores, cronistas e pesquisadores que moldam a legitimidade.' },
  frontier: { name: 'Colonos de Fronteira', short: 'Fronteira', description: 'Colonos, aldeias de borda e vilas distantes que querem terra, proteção e autonomia.' },
  bureaucrats: { name: 'Burocracia', short: 'Burocracia', description: 'Coletores de imposto, juízes, escrivães e governadores que transformam lei em administração.' },
  reformists: { name: 'Reformistas', short: 'Reformistas', description: 'Dissidentes, panfletários, radicais e movimentos civis que querem mudança institucional.' }
};

export function factionLabel(id: string, fallback: string): string {
  return FACTION_LABEL[id]?.name ?? fallback;
}
export function factionShortLabel(id: string, fallback: string): string {
  return FACTION_LABEL[id]?.short ?? fallback;
}
export function factionDescriptionLabel(id: string, fallback: string): string {
  return FACTION_LABEL[id]?.description ?? fallback;
}

// ============================ CONDITIONS ============================

export function diagnosePolitics(m: PoliticsMetrics): PoliticalCondition[] {
  const out: PoliticalCondition[] = [
    diagnoseLegitimacy(m),
    diagnoseStability(m),
    diagnoseUnrest(m),
    diagnoseReform(m),
    diagnoseSuccession(m),
    diagnoseFoodPolitics(m)
  ];
  const coalition = diagnoseCoalition(m);
  if (coalition) out.push(coalition);
  return out;
}

export function politicalProblems(conditions: PoliticalCondition[]): PoliticalCondition[] {
  const rank: Record<string, number> = { critical: 0, warning: 1 };
  return conditions
    .filter(c => c.status === 'critical' || c.status === 'warning')
    .sort((a, b) => (rank[a.status as string] ?? 2) - (rank[b.status as string] ?? 2));
}

function diagnoseLegitimacy(m: PoliticsMetrics): PoliticalCondition {
  const terms = [
    { label: 'Legitimidade', value: pct(m.legitimacy), status: band(m.legitimacy) },
    { label: 'Governo adotado no ano', value: `${m.governmentSince}` },
    { label: 'Alcance administrativo', value: pct(m.administrativeReach), status: band(m.administrativeReach) },
    { label: 'Coesão social', value: pct(m.society.cohesion), status: band(m.society.cohesion) }
  ];

  if (m.legitimacy < 0.3) {
    return {
      id: 'legitimacy', label: 'Legitimidade', icon: 'crown', status: 'critical',
      finding: `${pct(m.legitimacy)} — o direito de governar é abertamente contestado`,
      terms
    };
  }
  if (m.legitimacy < 0.5) {
    return {
      id: 'legitimacy', label: 'Legitimidade', icon: 'crown', status: 'warning',
      finding: `${pct(m.legitimacy)} — a autoridade da coroa está desgastada`,
      terms
    };
  }
  return {
    id: 'legitimacy', label: 'Legitimidade', icon: 'crown', status: 'positive',
    finding: `${pct(m.legitimacy)} — a ordem atual é aceita`,
    terms
  };
}

function diagnoseStability(m: PoliticsMetrics): PoliticalCondition {
  const terms = [
    { label: 'Estabilidade', value: pct(m.stability), status: band(m.stability) },
    { label: 'Desigualdade', value: pct(m.economy.inequality), status: inverted(m.economy.inequality) },
    { label: 'Reserva alimentar', value: pct(m.economy.foodSecurity), status: band(m.economy.foodSecurity) },
    { label: 'Cansaço de guerra', value: pct(m.warWeariness), status: inverted(m.warWeariness) }
  ];
  if (m.economy.unemployment !== null) {
    terms.push({ label: 'Desemprego', value: pct(m.economy.unemployment), status: inverted(m.economy.unemployment) });
  }

  if (m.stability < 0.35) {
    return {
      id: 'stability', label: 'Estabilidade', icon: 'shield', status: 'critical',
      finding: `${pct(m.stability)} — o contentamento material está no chão`,
      terms
    };
  }
  if (m.stability < 0.55) {
    return {
      id: 'stability', label: 'Estabilidade', icon: 'shield', status: 'warning',
      finding: `${pct(m.stability)} e caindo sob pressão econômica`,
      terms
    };
  }
  return {
    id: 'stability', label: 'Estabilidade', icon: 'shield', status: 'positive',
    finding: `${pct(m.stability)} — as condições materiais sustentam a ordem`,
    terms
  };
}

function diagnoseUnrest(m: PoliticsMetrics): PoliticalCondition {
  const s = m.society;
  const worst = [...m.factions].sort((a, b) =>
    (b.state.radicalization * b.state.influence) - (a.state.radicalization * a.state.influence))[0];

  const terms: NonNullable<PoliticalCondition['terms']> = [
    { label: 'Risco de revolta', value: pct(s.revoltRisk), status: inverted(s.revoltRisk) },
    { label: 'Risco de golpe', value: pct(s.coupRisk), status: inverted(s.coupRisk) },
    { label: 'Coesão', value: pct(s.cohesion), status: band(s.cohesion) }
  ];
  if (s.lastUnrestYear > 0) {
    terms.push({ label: 'Última convulsão', value: `ano ${s.lastUnrestYear}` });
  }

  const risk = Math.max(s.revoltRisk, s.coupRisk);
  if (risk >= 0.5) {
    const kind = s.coupRisk >= s.revoltRisk ? 'golpe' : 'revolta';
    return {
      id: 'unrest', label: 'Convulsão social', icon: 'warning', status: 'critical',
      finding: worst
        ? `Risco de ${kind} em ${pct(risk)} · ${factionLabel(worst.id, worst.definition.name)} radicalizados em ${pct(worst.state.radicalization)}`
        : `Risco de ${kind} em ${pct(risk)}`,
      terms,
      factionId: worst?.id
    };
  }
  if (risk >= 0.3) {
    return {
      id: 'unrest', label: 'Convulsão social', icon: 'warning', status: 'warning',
      finding: `Risco de revolta em ${pct(s.revoltRisk)}, de golpe em ${pct(s.coupRisk)}`,
      terms,
      factionId: worst?.id
    };
  }
  return {
    id: 'unrest', label: 'Convulsão social', icon: 'warning', status: 'positive',
    finding: 'Nenhum risco de levante acima do normal',
    terms
  };
}

function diagnoseReform(m: PoliticsMetrics): PoliticalCondition {
  const s = m.society;
  const pushers = m.factions
    .filter(f => f.state.reformSupport >= 0.6)
    .sort((a, b) => b.state.influence - a.state.influence)
    .slice(0, 3);

  const terms = [
    { label: 'Pressão por reforma', value: pct(s.reformPressure), status: inverted(s.reformPressure) },
    { label: 'Impulso reformista', value: pct(m.lawProfile.reformMomentum) },
    { label: 'Última reforma', value: m.lawProfile.lastReformYear > 0 ? `ano ${m.lawProfile.lastReformYear}` : 'nenhuma' },
    { label: 'Reformas registradas', value: `${m.lawProfile.history.length}` }
  ];

  if (s.reformPressure >= 0.65) {
    return {
      id: 'reform', label: 'Reforma', icon: 'scroll', status: 'critical',
      finding: pushers.length
        ? `Pressão em ${pct(s.reformPressure)} · empurrada por ${pushers.map(f => factionLabel(f.id, f.definition.name)).join(', ')}`
        : `Pressão por reforma em ${pct(s.reformPressure)}`,
      terms,
      factionId: pushers[0]?.id
    };
  }
  if (s.reformPressure >= 0.45) {
    return {
      id: 'reform', label: 'Reforma', icon: 'scroll', status: 'warning',
      finding: `Pressão por reforma em ${pct(s.reformPressure)}`,
      terms,
      factionId: pushers[0]?.id
    };
  }
  return {
    id: 'reform', label: 'Reforma', icon: 'scroll', status: 'positive',
    finding: `A ordem legal atual não está sendo contestada (${pct(s.reformPressure)})`,
    terms
  };
}

function diagnoseSuccession(m: PoliticsMetrics): PoliticalCondition {
  const succession = m.succession;
  const terms = [
    { label: 'Regra', value: successionLabel(succession.rule) },
    { label: 'Governante', value: succession.ruler ? succession.ruler.title ?? succession.ruler.name : 'trono vago' },
    { label: 'Sucessor provável', value: succession.heir ? succession.heir.name : 'nenhum' },
    { label: 'Casa reinante', value: succession.dynasty || 'sem casa registrada' },
    { label: 'Membros vivos da casa', value: `${succession.dynastyMembers}` }
  ];

  const critical = succession.risks.filter(r => r.severity === 'critical');
  if (critical.length) {
    return {
      id: 'succession', label: 'Sucessão', icon: 'crown', status: 'critical',
      finding: critical.map(r => r.label).join(' · '),
      terms
    };
  }
  if (succession.risks.length) {
    return {
      id: 'succession', label: 'Sucessão', icon: 'crown', status: 'warning',
      finding: succession.risks.map(r => r.label).join(' · '),
      terms
    };
  }
  return {
    id: 'succession', label: 'Sucessão', icon: 'crown', status: 'positive',
    finding: succession.heir
      ? `Sucessão encaminhada — ${succession.heir.name} é quem a regra escolhe hoje`
      : 'Sem riscos registrados',
    terms
  };
}

/**
 * Food, which is where the economy reaches politics first.
 *
 * Both figures matter and they are different questions: the price index is what
 * townsfolk pay, the reserve is what the realm holds. A realm with a full granary
 * and doubled bread is a realm with a distribution problem, and only the pair
 * shows it.
 */
function diagnoseFoodPolitics(m: PoliticsMetrics): PoliticalCondition {
  const index = m.economy.foodPriceIndex;
  const terms: NonNullable<PoliticalCondition['terms']> = [
    { label: 'Preço do pão', value: `${index.toFixed(2)}× o normal`, status: inverted(Math.min(1, (index - 1) / 1.2)) },
    { label: 'Reserva alimentar', value: pct(m.economy.foodSecurity), status: band(m.economy.foodSecurity) }
  ];

  // The factions the simulation itself recorded a food-price delta against.
  const hurt = m.factions.filter(f =>
    (f.grievances ?? []).some(g => g.source?.kind === 'good' && g.source.good === 'food'));
  if (hurt.length) {
    terms.push({ label: 'Facções penalizadas pela comida', value: hurt.map(f => factionShortLabel(f.id, f.definition.shortName)).join(', ') });
  }

  if (index >= 1.8 || m.economy.foodSecurity < 0.45) {
    return {
      id: 'food', label: 'Política do pão', icon: 'agriculture', status: 'critical',
      finding: index >= 1.8
        ? `Pão a ${index.toFixed(1)}× o preço normal — é assim que a fome vira política`
        : `Reserva alimentar em ${pct(m.economy.foodSecurity)}`,
      terms, good: 'food'
    };
  }
  if (index >= 1.3 || m.economy.foodSecurity < 0.7) {
    return {
      id: 'food', label: 'Política do pão', icon: 'agriculture', status: 'warning',
      finding: `Pão a ${index.toFixed(2)}× o normal, reserva em ${pct(m.economy.foodSecurity)}`,
      terms, good: 'food'
    };
  }
  return {
    id: 'food', label: 'Política do pão', icon: 'agriculture', status: 'positive',
    finding: `Comida acessível (${index.toFixed(2)}× o normal) e reserva em ${pct(m.economy.foodSecurity)}`,
    terms, good: 'food'
  };
}

/** Whether the regime has a base of support among the factions that matter. */
function diagnoseCoalition(m: PoliticsMetrics): PoliticalCondition | null {
  if (!m.factions.length) return null;

  const backers = m.factions.filter(f => f.regimeStance > 0.5);
  const opponents = m.factions.filter(f => f.regimeStance < -0.5);
  const backing = backers.reduce((s, f) => s + f.state.influence, 0);
  const opposing = opponents.reduce((s, f) => s + f.state.influence, 0);

  const terms = [
    { label: 'Influência que sustenta', value: pct(backing), status: 'positive' as Status },
    { label: 'Influência que se opõe', value: pct(opposing), status: 'critical' as Status },
    { label: 'Facção dominante', value: dominantName(m) }
  ];

  if (opposing > backing * 1.4) {
    return {
      id: 'coalition', label: 'Base de apoio', icon: 'politics', status: 'critical',
      finding: opponents.length
        ? `A oposição pesa mais que a base — ${opponents.slice(0, 3).map(f => factionLabel(f.id, f.definition.name)).join(', ')}`
        : 'A oposição pesa mais que a base do regime',
      terms,
      factionId: opponents[0]?.id
    };
  }
  if (backing < 0.2) {
    return {
      id: 'coalition', label: 'Base de apoio', icon: 'politics', status: 'warning',
      finding: `Só ${pct(backing)} da influência sustenta o regime`,
      terms,
      factionId: backers[0]?.id
    };
  }
  return {
    id: 'coalition', label: 'Base de apoio', icon: 'politics', status: 'positive',
    finding: backers.length
      ? `Sustentado por ${backers.slice(0, 3).map(f => factionLabel(f.id, f.definition.name)).join(', ')}`
      : 'Nenhuma facção se opõe ativamente',
    terms,
    factionId: backers[0]?.id
  };
}

// ============================ POLITICAL PRESSURES ============================

/**
 * What is pushing on the regime, worst first, capped at five.
 *
 * Every entry carries its causes, and the causes are the deltas the society tick
 * recorded plus the economic figures the tick was handed. This is the join
 * between politics and economy the brief asks for, and it holds because both
 * sides are reading the same numbers.
 */
export function politicalPressures(m: PoliticsMetrics, limit = 5): PoliticalPressure[] {
  const out: PoliticalPressure[] = [];

  // ---- Radicalised factions, named with what the tick charged them ----
  for (const faction of m.factions) {
    if (faction.state.radicalization < 0.55) continue;
    const causes = (faction.grievances ?? []).slice(0, 4).map(g => ({
      label: g.label,
      value: signedPoints(g.delta),
      good: g.source?.kind === 'good' ? g.source.good : undefined
    }));

    out.push({
      id: `radical:${faction.id}`,
      label: `${factionLabel(faction.id, faction.definition.name)} radicalizados`,
      detail: `${pct(faction.state.radicalization)} de radicalização, ${pct(faction.state.influence)} de influência`,
      severity: faction.state.radicalization >= 0.7 ? 'critical' : 'warning',
      icon: 'politics',
      causes,
      factionId: faction.id
    });
  }

  // ---- Reform movement ----
  if (m.society.reformPressure >= 0.5) {
    const pushers = m.factions
      .filter(f => f.state.reformSupport >= 0.55)
      .sort((a, b) => b.state.influence * b.state.reformSupport - a.state.influence * a.state.reformSupport)
      .slice(0, 4);
    out.push({
      id: 'reform-movement',
      label: 'Movimento por reforma',
      detail: `Pressão em ${pct(m.society.reformPressure)}, impulso legislativo em ${pct(m.lawProfile.reformMomentum)}`,
      severity: m.society.reformPressure >= 0.7 ? 'critical' : 'warning',
      icon: 'scroll',
      causes: pushers.map(f => ({
        label: factionLabel(f.id, f.definition.name),
        value: `apoio ${pct(f.state.reformSupport)} · influência ${pct(f.state.influence)}`
      }))
    });
  }

  // ---- Anti-war sentiment, only while there is a war to be tired of ----
  if (m.wars.length && m.society.peacePressure >= 0.5) {
    const weary = m.factions
      .filter(f => f.state.warSupport < 0.4)
      .sort((a, b) => b.state.influence - a.state.influence)
      .slice(0, 3);
    out.push({
      id: 'anti-war',
      label: 'Sentimento contra a guerra',
      detail: `Pressão por paz em ${pct(m.society.peacePressure)} após ${m.wars[0].years} ano(s) de conflito`,
      severity: m.society.peacePressure >= 0.7 ? 'critical' : 'warning',
      icon: 'diplomacy',
      causes: [
        { label: 'Cansaço de guerra', value: pct(m.warWeariness) },
        ...weary.map(f => ({ label: `${factionLabel(f.id, f.definition.name)} contra`, value: `apoio à guerra ${pct(f.state.warSupport)}` }))
      ]
    });
  }

  // ---- Pressure the other way: factions wanting a war ----
  if (!m.wars.length && m.society.warPressure >= 0.6) {
    const hawks = m.factions
      .filter(f => f.state.warSupport >= 0.6)
      .sort((a, b) => b.state.influence - a.state.influence)
      .slice(0, 3);
    out.push({
      id: 'war-pressure',
      label: 'Pressão por guerra',
      detail: `Facções empurrando o reino ao conflito (${pct(m.society.warPressure)})`,
      severity: 'warning',
      icon: 'war',
      causes: hawks.map(f => ({ label: factionLabel(f.id, f.definition.name), value: `apoio à guerra ${pct(f.state.warSupport)}` }))
    });
  }

  // ---- Bread ----
  if (m.economy.foodPriceIndex >= 1.4) {
    const hurt = m.factions.filter(f =>
      (f.grievances ?? []).some(g => g.source?.kind === 'good' && g.source.good === 'food'));
    out.push({
      id: 'food-politics',
      label: 'Protesto pelo preço da comida',
      detail: `Pão a ${m.economy.foodPriceIndex.toFixed(2)}× o preço normal`,
      severity: m.economy.foodPriceIndex >= 1.8 ? 'critical' : 'warning',
      icon: 'agriculture',
      good: 'food',
      causes: [
        { label: 'Índice de preço do pão', value: `${m.economy.foodPriceIndex.toFixed(2)}×`, good: 'food' },
        { label: 'Reserva alimentar', value: pct(m.economy.foodSecurity) },
        ...hurt.slice(0, 3).map(f => ({ label: `${factionLabel(f.id, f.definition.name)} penalizados`, value: 'delta registrado pela simulação' }))
      ]
    });
  }

  // ---- Work ----
  if (m.economy.unemployment !== null && m.economy.unemployment >= 0.2) {
    const workers = m.factions.find(f => f.id === 'workers');
    out.push({
      id: 'unemployment',
      label: 'Desemprego',
      detail: `${pct(m.economy.unemployment)} da população em idade produtiva sem posto`,
      severity: m.economy.unemployment >= 0.35 ? 'critical' : 'warning',
      icon: 'industry',
      causes: [
        { label: 'Desemprego', value: pct(m.economy.unemployment) },
        ...(m.economy.labourShortage !== null
          ? [{ label: 'Vagas sem ninguém', value: pct(m.economy.labourShortage) }]
          : []),
        ...(workers ? [{ label: 'Satisfação dos trabalhadores', value: pct(workers.state.satisfaction) }] : [])
      ],
      factionId: 'workers'
    });
  }

  // ---- Reach: a realm the crown cannot actually govern ----
  if (m.administrativeReach < 0.55) {
    const frontier = m.factions.find(f => f.id === 'frontier');
    out.push({
      id: 'reach',
      label: 'Fronteira fora de alcance',
      detail: `A coroa governa efetivamente ${pct(m.administrativeReach)} do reino`,
      severity: m.administrativeReach < 0.4 ? 'critical' : 'warning',
      icon: 'map',
      causes: [
        { label: 'Alcance administrativo', value: pct(m.administrativeReach) },
        ...(frontier ? [{ label: 'Satisfação da fronteira', value: pct(frontier.state.satisfaction) }] : [])
      ],
      factionId: 'frontier'
    });
  }

  return out
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
    .slice(0, limit);
}

// ============================ GEOPOLITICAL PRESSURES ============================

/** What is wrong with the realm's position in the world, worst first. */
export function geopoliticalPressures(m: PoliticsMetrics, limit = 5): GeopoliticalPressure[] {
  const out: GeopoliticalPressure[] = [];

  // ---- Buying something vital from someone who might stop selling ----
  for (const dependency of m.dependencies) {
    const hostile = dependency.suppliers.find(s => s.hostile);
    if (!hostile || dependency.share < 0.3) continue;
    out.push({
      id: `hostile-supplier:${dependency.good}`,
      label: `${dependency.name} vem de um reino hostil`,
      detail: `${pct(dependency.share)} importado · ${pct(hostile.share)} de ${hostile.name}`,
      severity: dependency.strategic || dependency.share >= 0.6 ? 'critical' : 'warning',
      icon: 'trade-route',
      good: dependency.good,
      kingdomId: hostile.kingdomId
    });
  }

  // ---- More than one war at once ----
  if (m.wars.length >= 2) {
    out.push({
      id: 'multi-front',
      label: `Guerra em ${m.wars.length} frentes`,
      detail: `Contra ${m.wars.map(w => w.enemyName).join(', ')}`,
      severity: 'critical',
      icon: 'war',
      kingdomId: m.wars[0].enemyId
    });
  }

  // ---- Trade shut by war ----
  const closed = m.wars.reduce((sum, w) => sum + w.routesClosed.length, 0);
  if (closed > 0) {
    const first = m.wars.find(w => w.routesClosed.length);
    out.push({
      id: 'war-trade',
      label: `${closed} rota(s) fechada(s) pela guerra`,
      detail: first
        ? `Comércio com ${first.enemyName} interrompido: ${[...new Set(first.routesClosed.map(r => GOODS[r.good]?.name ?? r.good))].join(', ')}`
        : 'Rotas fechadas pelo estado de guerra',
      severity: closed >= 3 ? 'critical' : 'warning',
      icon: 'trade-route',
      good: first?.routesClosed[0]?.good,
      kingdomId: first?.enemyId
    });
  }

  // ---- Embargoes standing against this realm ----
  const against = m.relations.filter(r => r.embargoedAgainstUs);
  if (against.length) {
    out.push({
      id: 'embargoed',
      label: `${against.length} embargo(s) contra este reino`,
      detail: against.slice(0, 3).map(r => `${r.name} (${r.embargoedAgainstUs!.reason})`).join(', '),
      severity: against.length >= 2 ? 'critical' : 'warning',
      icon: 'trade-route',
      kingdomId: against[0].kingdomId
    });
  }

  // ---- A neighbour strong enough and close enough to be a problem ----
  if (m.externalThreat >= 0.5) {
    const worst = m.relations
      .filter(r => r.status === 'hostile' || r.status === 'war')
      .sort((a, b) => a.score - b.score)[0];
    out.push({
      id: 'external-threat',
      label: 'Ameaça externa elevada',
      detail: worst
        ? `${pct(m.externalThreat)} · o pior caso é ${worst.name} (relação ${Math.round(worst.score)})`
        : `${pct(m.externalThreat)} de ameaça entre os reinos conhecidos`,
      severity: m.externalThreat >= 0.7 ? 'critical' : 'warning',
      icon: 'shield',
      kingdomId: worst?.kingdomId
    });
  }

  // ---- Alone in a world with rivals ----
  if (!m.alliances.length && m.relations.some(r => r.status === 'hostile' || r.status === 'war')) {
    out.push({
      id: 'isolated',
      label: 'Sem aliados',
      detail: `Nenhuma aliança formal, com ${m.relations.filter(r => r.status === 'hostile' || r.status === 'war').length} reino(s) hostil(is)`,
      severity: 'warning',
      icon: 'diplomacy'
    });
  }

  // ---- An alliance whose members are drifting away ----
  for (const alliance of m.alliances) {
    const drifting = m.relations.filter(r => alliance.members.has(r.kingdomId) && r.score < 20);
    if (!drifting.length) continue;
    out.push({
      id: `alliance-strain:${alliance.id}`,
      label: `Aliança "${alliance.name}" sob tensão`,
      detail: drifting.map(r => `${r.name} em ${Math.round(r.score)}`).join(', '),
      severity: drifting.some(r => r.score < 0) ? 'critical' : 'warning',
      icon: 'handshake',
      kingdomId: drifting[0].kingdomId
    });
  }

  return out
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
    .slice(0, limit);
}

// ============================ RELATION FACTS ============================

/**
 * What stands between two realms — as facts, never as a decomposition.
 *
 * `DiplomacyManager` stores one number per pair and no history behind it, so
 * there is no honest way to say "the border conflict cost you 12 points". What
 * *is* recorded is the state of the relationship, and that is what this returns:
 * each item true, each with its own figure, and the interface says plainly that
 * the engine keeps no weighting.
 */
export function relationFacts(relation: RelationView): { label: string; value: string; tone: Status }[] {
  const facts: { label: string; value: string; tone: Status }[] = [];

  if (relation.atWar) facts.push({ label: 'Em guerra', value: 'conflito aberto', tone: 'critical' });
  if (relation.embargoedAgainstUs) {
    facts.push({
      label: 'Embargo contra este reino',
      value: `desde o ano ${relation.embargoedAgainstUs.year} — ${relation.embargoedAgainstUs.reason}`,
      tone: 'critical'
    });
  }
  if (relation.embargoedByUs) {
    facts.push({
      label: 'Embargo imposto por este reino',
      value: `desde o ano ${relation.embargoedByUs.year} — ${relation.embargoedByUs.reason}`,
      tone: 'warning'
    });
  }
  if (relation.alliance) {
    facts.push({
      label: 'Aliança',
      value: `${relation.alliance.name}, desde o ano ${relation.alliance.formedYear}`,
      tone: 'positive'
    });
  }
  if (relation.truceUntil !== null) {
    facts.push({
      label: 'Trégua',
      value: `até o ano ${relation.truceUntil}${relation.truceReason ? ` — ${relation.truceReason}` : ''}`,
      tone: 'neutral'
    });
  }
  if (relation.tariff !== null) {
    facts.push({
      label: 'Acordo de comércio',
      value: `tarifa de ${pct(relation.tariff)}${relation.agreementSince !== null ? `, desde o ano ${relation.agreementSince}` : ''}`,
      tone: 'positive'
    });
  }
  if (relation.tradeVolume > 0) {
    facts.push({
      label: 'Comércio',
      value: `${relation.tradeVolume.toFixed(1)} de volume · ${pct(relation.tradeShare)} do comércio externo`,
      tone: 'positive'
    });
  }
  if (relation.sharedEnemies.length) {
    facts.push({
      label: 'Inimigo em comum',
      value: `${relation.sharedEnemies.length} reino(s) em guerra com ambos`,
      tone: 'positive'
    });
  }
  if (relation.isVassal) facts.push({ label: 'Vassalo deste reino', value: 'paga tributo', tone: 'neutral' });
  if (relation.isOverlord) facts.push({ label: 'Suserano deste reino', value: 'recebe tributo', tone: 'neutral' });

  return facts;
}

// ============================ SMALL HELPERS ============================

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** A satisfaction delta the society tick applied, in readable points. */
export function signedPoints(delta: number): string {
  return `${delta >= 0 ? '+' : '−'}${Math.abs(delta * 100).toFixed(1)}`;
}

/** Higher is better. */
export function band(value: number): Status {
  if (value >= 0.6) return 'positive';
  if (value >= 0.4) return 'neutral';
  if (value >= 0.25) return 'warning';
  return 'critical';
}

/** Higher is worse — risk, pressure, weariness. */
export function inverted(value: number): Status {
  if (value >= 0.6) return 'critical';
  if (value >= 0.4) return 'warning';
  if (value >= 0.2) return 'neutral';
  return 'positive';
}

export function successionLabel(rule: 'strongest' | 'bloodline' | 'election'): string {
  return { strongest: 'O mais forte', bloodline: 'Hereditária', election: 'Eleição' }[rule];
}

export function successionExplain(rule: 'strongest' | 'bloodline' | 'election'): string {
  return {
    strongest: 'O trono passa a quem tiver mérito e força para tomá-lo — nível, feitos em combate e idade.',
    bloodline: 'O trono passa primeiro aos filhos do governante, depois à casa reinante.',
    election: 'O sucessor é escolhido entre os adultos, favorecendo experiência e reputação.'
  }[rule];
}

export function statusOf(condition: PoliticalCondition): Status {
  return condition.status === 'unknown' ? 'neutral' : condition.status;
}

export function verdictLabel(status: PoliticalCondition['status']): string {
  return { positive: 'Estável', neutral: 'Normal', warning: 'Atenção', critical: 'Crítico', unknown: 'Sem dados' }[status];
}

function dominantName(m: PoliticsMetrics): string {
  const dominant = m.factions.find(f => f.id === m.society.dominantFaction);
  return dominant ? factionLabel(dominant.id, dominant.definition.name) : m.society.dominantFaction;
}

/** The colour a relation score deserves, on the realm's own terms. */
export function relationStatus(score: number): Status {
  if (score >= 50) return 'positive';
  if (score >= 15) return 'neutral';
  if (score >= -25) return 'warning';
  return 'critical';
}

export const RELATION_STATUS: Record<RelationView['status'], { label: string; status: Status; explain: string }> = {
  alliance: { label: 'Aliança', status: 'positive', explain: 'Tratado de aliança formal em vigor.' },
  friendly: { label: 'Amistoso', status: 'positive', explain: 'Relação positiva, sem tratado formal.' },
  neutral: { label: 'Neutro', status: 'neutral', explain: 'Nenhuma inclinação registrada entre os dois.' },
  hostile: { label: 'Hostil', status: 'warning', explain: 'Relação deteriorada. É o estado que precede a guerra.' },
  war: { label: 'Guerra', status: 'critical', explain: 'Conflito aberto em curso.' }
};

/** Whether a dependency deserves a warning on its own. */
export function dependencyStatus(dependency: DependencyView): Status {
  if (dependency.suppliers.some(s => s.hostile) && dependency.share >= 0.3) return 'critical';
  if (dependency.share >= 0.75) return 'critical';
  if (dependency.share >= 0.5) return 'warning';
  return 'neutral';
}

/** The stance scale, explained wherever it is drawn. */
export function stanceLabel(stance: number): string {
  if (stance >= 1.5) return 'Sustenta firmemente';
  if (stance >= 0.5) return 'Apoia';
  if (stance > -0.5) return 'Indiferente';
  if (stance > -1.5) return 'Resiste';
  return 'Opõe-se abertamente';
}

export function stanceStatus(stance: number): Status {
  if (stance >= 0.5) return 'positive';
  if (stance > -0.5) return 'neutral';
  if (stance > -1.5) return 'warning';
  return 'critical';
}

/** The faction stance as a symbol row, never shown without its tooltip. */
export function stanceMarks(stance: number): string {
  const steps = Math.min(3, Math.max(1, Math.round(Math.abs(stance))));
  if (Math.abs(stance) < 0.5) return '·';
  return (stance > 0 ? '+' : '−').repeat(steps);
}

export function factionOf(m: PoliticsMetrics, id: string | undefined): FactionView | null {
  if (!id) return null;
  return m.factions.find(f => f.id === id) ?? null;
}
