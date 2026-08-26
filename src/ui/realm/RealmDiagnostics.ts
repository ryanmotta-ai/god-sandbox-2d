/**
 * The realm dossier's verdicts.
 *
 * Same discipline as UI-3's city diagnostics, applied one level up: named
 * conditions with a status, a one-line finding, and the arithmetic that produced
 * it. A condition whose inputs are missing is `unknown`, not a guess.
 *
 * The realm has one advantage the city did not. `FactionState.factors` records
 * the *exact deltas* the society tick applied to each faction's satisfaction,
 * each with a `FactorSource` naming where the evidence lives. So the political
 * "why" here is not reconstructed from thresholds — it is the simulation's own
 * accounting, read back and grouped by sign. That is the difference between
 * explaining a realm and describing it.
 */
import { GOODS, type GoodId } from '../../civ/Goods';
import { SOCIAL_FACTIONS, type FactionState, type FactionFactor, type SocialFactionId } from '../../civ/Society';
import type { Status } from '../kit';
import type { RealmMetrics } from './RealmMetrics';

export interface RealmCondition {
  id: 'economy' | 'food' | 'politics' | 'society' | 'military' | 'trade' | 'technology';
  label: string;
  icon: string;
  status: Status | 'unknown';
  finding: string;
  /** The arithmetic behind the verdict, shown on hover. */
  terms?: { label: string; value: string; status?: Status }[];
  /** Makes the condition navigable when a single good is implicated. */
  good?: GoodId;
}

/** A short, ranked list of what is actually wrong. Item 35 caps this at five. */
export interface CriticalIssue {
  label: string;
  detail: string;
  severity: 'warning' | 'critical';
  icon: string;
  good?: GoodId;
  cityId?: string;
  kingdomId?: string;
}

/**
 * A faction's name in the interface's language.
 *
 * The simulation names its nine factions in English; the interface is Portuguese.
 * A closed set of nine known labels, translated at the boundary. Anything not
 * covered falls back to the engine's own name.
 */
const FACTION_NAME: Record<SocialFactionId, string> = {
  peasants: 'Camponeses',
  nobles: 'Nobreza',
  merchants: 'Mercadores',
  military: 'Militares',
  workers: 'Trabalhadores',
  clergy_scholars: 'Clero e Eruditos',
  frontier: 'Colonos de Fronteira',
  bureaucrats: 'Burocracia',
  reformists: 'Reformistas'
};

export function factionLabel(id: SocialFactionId | string): string {
  return FACTION_NAME[id as SocialFactionId]
    ?? SOCIAL_FACTIONS[id as SocialFactionId]?.name
    ?? String(id);
}

export function diagnoseRealm(metrics: RealmMetrics): RealmCondition[] {
  return [
    diagnoseEconomy(metrics),
    diagnoseFood(metrics),
    diagnosePolitics(metrics),
    diagnoseSociety(metrics),
    diagnoseMilitary(metrics),
    diagnoseTrade(metrics),
    diagnoseTechnology(metrics)
  ];
}

export function realmProblems(conditions: RealmCondition[]): RealmCondition[] {
  const rank: Record<string, number> = { critical: 0, warning: 1 };
  return conditions
    .filter(c => c.status === 'critical' || c.status === 'warning')
    .sort((a, b) => (rank[a.status as string] ?? 2) - (rank[b.status as string] ?? 2));
}

// ============================ ECONOMY ============================

function diagnoseEconomy(m: RealmMetrics): RealmCondition {
  const terms: NonNullable<RealmCondition['terms']> = [
    { label: 'Produção', value: m.output.toFixed(1) },
    { label: 'Tesouro', value: m.treasury.toFixed(1) },
    { label: 'Industrialização', value: `${Math.round(m.industrialisation * 100)}%` },
    { label: 'Desigualdade', value: `${Math.round(m.inequality * 100)}%` }
  ];

  if (m.lastLedger) {
    terms.push({
      label: 'Saldo do ano',
      value: `${m.lastLedger.net >= 0 ? '+' : '−'}${Math.abs(m.lastLedger.net).toFixed(1)}`,
      status: (m.lastLedger.net >= 0 ? 'positive' : 'critical') as Status
    });
  }

  if (!m.lastLedger) {
    return {
      id: 'economy', label: 'Economia', icon: 'economy', status: 'unknown',
      // No closed year means no books. Reporting a treasury movement of zero would
      // read as stagnation rather than as absence.
      finding: 'Sem ano fechado — nenhum livro contábil ainda',
      terms
    };
  }

  if (m.lastLedger.net < 0 && m.treasury < Math.abs(m.lastLedger.net) * 2) {
    return {
      id: 'economy', label: 'Economia', icon: 'economy', status: 'critical',
      finding: `Déficit de ${Math.abs(m.lastLedger.net).toFixed(1)} com tesouro de ${m.treasury.toFixed(0)} — menos de dois anos de reserva`,
      terms
    };
  }
  if (m.lastLedger.net < 0) {
    return {
      id: 'economy', label: 'Economia', icon: 'economy', status: 'warning',
      finding: `Gastando ${Math.abs(m.lastLedger.net).toFixed(1)} a mais do que arrecada`,
      terms
    };
  }
  return {
    id: 'economy', label: 'Economia', icon: 'economy', status: 'positive',
    finding: m.industrialisation > 0.3
      ? `Superávit de ${m.lastLedger.net.toFixed(1)} · ${Math.round(m.industrialisation * 100)}% industrializada`
      : `Superávit de ${m.lastLedger.net.toFixed(1)}`,
    terms
  };
}

// ============================ FOOD ============================

/**
 * Food, from the realm's own reserve plus its settlements' own troubles.
 *
 * `kingdom.foodSecurity` is a *reserve* measure — stock per head against the
 * four-year buffer the engine treats as full — not a production ratio. It is
 * reported alongside the count of starving settlements because the two answer
 * different questions: a realm can hold a full granary and still have a city
 * going hungry, and that is a distribution failure the reserve figure alone would
 * hide.
 */
function diagnoseFood(m: RealmMetrics): RealmCondition {
  const hungry = m.cities.filter(c => c.problem?.label.startsWith('Fome')).length;
  const foodPosition = m.goods.find(g => g.good === 'food');
  const terms = [
    { label: 'Reserva alimentar', value: `${Math.round(m.foodSecurity * 100)}%` },
    { label: 'Cidades com fome', value: `${hungry}`, status: (hungry > 0 ? 'critical' : 'positive') as Status }
  ];
  if (foodPosition) {
    terms.push(
      { label: 'Produzido', value: foodPosition.flow.produced.toFixed(1) },
      { label: 'Consumido', value: foodPosition.flow.consumed.toFixed(1) },
      { label: 'Importado', value: foodPosition.flow.imported.toFixed(1) }
    );
  }

  if (hungry > 0) {
    return {
      id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'critical',
      finding: m.foodSecurity >= 0.9
        ? `${hungry} cidade(s) passando fome, apesar da reserva do reino em ${Math.round(m.foodSecurity * 100)}% — é distribuição, não estoque`
        : `${hungry} cidade(s) passando fome`,
      terms, good: 'food'
    };
  }
  if (m.foodSecurity < 0.85) {
    return {
      id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'critical',
      finding: `Reserva alimentar em ${Math.round(m.foodSecurity * 100)}% da capacidade plena`,
      terms, good: 'food'
    };
  }
  if (m.foodSecurity < 1) {
    return {
      id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'warning',
      finding: `Reserva alimentar em ${Math.round(m.foodSecurity * 100)}% da capacidade plena`,
      terms, good: 'food'
    };
  }
  return {
    id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'positive',
    finding: `Abastecido — reserva em ${Math.round(m.foodSecurity * 100)}%`,
    terms, good: 'food'
  };
}

// ============================ POLITICS ============================

function diagnosePolitics(m: RealmMetrics): RealmCondition {
  const s = m.society;
  const terms = [
    { label: 'Legitimidade', value: `${Math.round(m.legitimacy * 100)}%`, status: bandStatus(m.legitimacy) },
    { label: 'Estabilidade', value: `${Math.round(m.stability * 100)}%`, status: bandStatus(m.stability) },
    { label: 'Coesão', value: `${Math.round(s.cohesion * 100)}%`, status: bandStatus(s.cohesion) },
    { label: 'Pressão por reforma', value: `${Math.round(s.reformPressure * 100)}%`, status: invertedBand(s.reformPressure) },
    { label: 'Risco de golpe', value: `${Math.round(s.coupRisk * 100)}%`, status: invertedBand(s.coupRisk) },
    { label: 'Risco de revolta', value: `${Math.round(s.revoltRisk * 100)}%`, status: invertedBand(s.revoltRisk) },
    { label: 'Alcance administrativo', value: `${Math.round(m.administrativeReach * 100)}%` }
  ];

  if (s.coupRisk >= 0.5 || s.revoltRisk >= 0.5) {
    const worst = s.coupRisk >= s.revoltRisk ? 'golpe' : 'revolta';
    return {
      id: 'politics', label: 'Política', icon: 'politics', status: 'critical',
      finding: `Risco de ${worst} em ${Math.round(Math.max(s.coupRisk, s.revoltRisk) * 100)}%`,
      terms
    };
  }
  if (m.legitimacy < 0.4) {
    return {
      id: 'politics', label: 'Política', icon: 'politics', status: 'critical',
      finding: `Legitimidade em ${Math.round(m.legitimacy * 100)}% — o poder é contestado`,
      terms
    };
  }
  if (s.reformPressure >= 0.6) {
    return {
      id: 'politics', label: 'Política', icon: 'politics', status: 'warning',
      finding: `Pressão por reforma em ${Math.round(s.reformPressure * 100)}%`,
      terms
    };
  }
  if (m.legitimacy < 0.6 || s.cohesion < 0.5) {
    return {
      id: 'politics', label: 'Política', icon: 'politics', status: 'warning',
      finding: `Coesão em ${Math.round(s.cohesion * 100)}%, legitimidade em ${Math.round(m.legitimacy * 100)}%`,
      terms
    };
  }
  return {
    id: 'politics', label: 'Política', icon: 'politics', status: 'positive',
    finding: `Ordem estável — legitimidade em ${Math.round(m.legitimacy * 100)}%`,
    terms
  };
}

// ============================ SOCIETY ============================

/**
 * The faction most likely to cause trouble, named with the reason it is angry.
 *
 * The reason comes from that faction's own `factors` — the deltas the society tick
 * applied — so the finding is the simulation's accounting rather than a guess at
 * what a radicalised worker probably resents.
 */
function diagnoseSociety(m: RealmMetrics): RealmCondition {
  if (!m.factions.length) {
    return { id: 'society', label: 'Sociedade', icon: 'population', status: 'unknown', finding: 'Sem facções registradas' };
  }

  const worst = [...m.factions].sort((a, b) =>
    (b.radicalization - b.satisfaction) - (a.radicalization - a.satisfaction))[0];
  const name = factionLabel(worst.id);
  const grievances = negativeFactors(worst).slice(0, 3).map(f => f.label);

  const terms = m.factions.slice(0, 6).map(f => ({
    label: factionLabel(f.id),
    value: `sat. ${Math.round(f.satisfaction * 100)}% · rad. ${Math.round(f.radicalization * 100)}%`,
    status: (f.radicalization >= 0.6 ? 'critical' : f.satisfaction < 0.4 ? 'warning' : 'positive') as Status
  }));

  if (worst.radicalization >= 0.6) {
    return {
      id: 'society', label: 'Sociedade', icon: 'population', status: 'critical',
      finding: grievances.length
        ? `${name} radicalizados em ${Math.round(worst.radicalization * 100)}% — ${grievances.join(', ')}`
        : `${name} radicalizados em ${Math.round(worst.radicalization * 100)}%`,
      terms
    };
  }
  if (worst.satisfaction < 0.4) {
    return {
      id: 'society', label: 'Sociedade', icon: 'population', status: 'warning',
      finding: grievances.length
        ? `${name} insatisfeitos (${Math.round(worst.satisfaction * 100)}%) — ${grievances.join(', ')}`
        : `${name} insatisfeitos em ${Math.round(worst.satisfaction * 100)}%`,
      terms
    };
  }
  return {
    id: 'society', label: 'Sociedade', icon: 'population', status: 'positive',
    finding: `Nenhuma facção radicalizada — pior caso: ${name} em ${Math.round(worst.radicalization * 100)}%`,
    terms
  };
}

// ============================ MILITARY ============================

function diagnoseMilitary(m: RealmMetrics): RealmCondition {
  const terms = [
    { label: 'Poder militar', value: m.militaryPower.toFixed(0) },
    { label: 'Combatentes', value: `${m.army.total}` },
    { label: 'Armados', value: `${m.army.armed} de ${m.army.total}`, status: (m.army.total > 0 && m.army.armed < m.army.total / 2 ? 'warning' : 'positive') as Status },
    { label: 'Cansaço de guerra', value: `${Math.round(m.warWeariness * 100)}%`, status: invertedBand(m.warWeariness) },
    { label: 'Ameaça externa', value: `${Math.round(m.externalThreat * 100)}%`, status: invertedBand(m.externalThreat) }
  ];

  if (m.wars.length >= 2) {
    return {
      id: 'military', label: 'Militar', icon: 'war', status: 'critical',
      finding: `Em guerra em ${m.wars.length} frentes: ${m.wars.map(w => w.enemyName).join(', ')}`,
      terms
    };
  }
  if (m.wars.length === 1) {
    const war = m.wars[0];
    return {
      id: 'military', label: 'Militar', icon: 'war',
      status: m.warWeariness >= 0.6 ? 'critical' : 'warning',
      finding: m.warWeariness >= 0.6
        ? `Em guerra com ${war.enemyName} há ${war.years} ano(s) — cansaço em ${Math.round(m.warWeariness * 100)}%`
        : `Em guerra com ${war.enemyName} há ${war.years} ano(s)`,
      terms
    };
  }
  if (m.army.total === 0) {
    return {
      id: 'military', label: 'Militar', icon: 'war', status: 'warning',
      finding: 'Nenhum combatente — o reino está indefeso',
      terms
    };
  }
  if (m.externalThreat >= 0.5) {
    return {
      id: 'military', label: 'Militar', icon: 'war', status: 'warning',
      finding: `Em paz, mas com ameaça externa em ${Math.round(m.externalThreat * 100)}%`,
      terms
    };
  }
  return {
    id: 'military', label: 'Militar', icon: 'war', status: 'positive',
    finding: `Em paz · ${m.army.total} combatente(s), ${m.army.armed} armado(s)`,
    terms
  };
}

// ============================ TRADE ============================

function diagnoseTrade(m: RealmMetrics): RealmCondition {
  const worstDependency = m.dependencies[0] ?? null;
  const embargoes = m.relations.filter(r => r.embargoed).length;
  const terms = [
    { label: 'Dependência comercial', value: `${Math.round(m.tradeDependency * 100)}%` },
    { label: 'Parceiros', value: `${m.tradePartners.length}` },
    { label: 'Exportado', value: m.exportVolume.toFixed(1) },
    { label: 'Importado', value: m.importVolume.toFixed(1) },
    { label: 'Embargos', value: `${embargoes}`, status: (embargoes ? 'critical' : 'positive') as Status }
  ];

  if (worstDependency && worstDependency.importDependency >= 0.75) {
    const supplier = worstDependency.suppliers[0];
    return {
      id: 'trade', label: 'Comércio', icon: 'trade-route', status: 'critical',
      finding: supplier
        ? `${Math.round(worstDependency.importDependency * 100)}% do ${GOODS[worstDependency.good]?.name ?? worstDependency.good} vem de fora — ${Math.round(supplier.share * 100)}% de ${supplier.name}`
        : `${Math.round(worstDependency.importDependency * 100)}% do ${GOODS[worstDependency.good]?.name ?? worstDependency.good} vem de fora`,
      terms, good: worstDependency.good
    };
  }
  if (embargoes > 0) {
    return {
      id: 'trade', label: 'Comércio', icon: 'trade-route', status: 'warning',
      finding: `${embargoes} embargo(s) em vigor`,
      terms
    };
  }
  if (m.tradePartners.length === 0) {
    return {
      id: 'trade', label: 'Comércio', icon: 'trade-route', status: 'unknown',
      // Isolation is a fact, not a failure — an inland self-sufficient realm may
      // never open a route.
      finding: 'Sem parceiros comerciais',
      terms
    };
  }
  return {
    id: 'trade', label: 'Comércio', icon: 'trade-route', status: 'positive',
    finding: `${m.tradePartners.length} parceiro(s) · dependência em ${Math.round(m.tradeDependency * 100)}%`,
    terms
  };
}

// ============================ TECHNOLOGY ============================

/**
 * Knowing versus being able to use it — item 31 of the brief.
 *
 * The engine already computes this per technology, so the verdict is simply the
 * worst idle capability, named with what it is missing. A realm that has
 * researched combustion and cannot refine a barrel of oil is not an industrial
 * power, and this is the line that says so.
 */
function diagnoseTechnology(m: RealmMetrics): RealmCondition {
  const t = m.technology;
  const terms = [
    { label: 'Era operacional', value: t.eraName },
    { label: 'Tecnologias conhecidas', value: `${t.known}` },
    { label: 'Capacidade de uso', value: `${Math.round(t.capacity * 100)}%`, status: bandStatus(t.capacity) },
    { label: 'Pesquisa por ano', value: t.output.toFixed(1) }
  ];

  if (t.idleCapabilities.length) {
    const worst = t.idleCapabilities[0];
    const missing = [
      ...worst.missingGoods.map(g => GOODS[g]?.name ?? g),
      ...worst.missingBuildings.map(b => String(b))
    ].slice(0, 3);
    return {
      id: 'technology', label: 'Tecnologia', icon: 'technology',
      status: worst.capacity < 0.35 ? 'critical' : 'warning',
      finding: `${worst.name} conhecida mas ${Math.round(worst.capacity * 100)}% aproveitada — falta ${missing.join(', ')}`,
      terms,
      good: worst.missingGoods[0]
    };
  }
  return {
    id: 'technology', label: 'Tecnologia', icon: 'technology', status: 'positive',
    finding: `${t.eraName} · ${t.known} tecnologia(s), ${Math.round(t.capacity * 100)}% aproveitadas`,
    terms
  };
}

// ============================ CRITICAL ISSUES ============================

/**
 * The short list. Capped at five by the brief, and ranked so the cap cuts the
 * least important rather than an arbitrary tail.
 *
 * Everything here is drawn from figures already computed, so this is a ranking
 * pass rather than a second round of analysis.
 */
export function criticalIssues(m: RealmMetrics, limit = 5): CriticalIssue[] {
  const issues: CriticalIssue[] = [];

  // ---- Strategic dependency ----
  for (const position of m.dependencies.slice(0, 2)) {
    if (position.importDependency < 0.6) continue;
    const supplier = position.suppliers[0];
    issues.push({
      label: `Dependência de ${GOODS[position.good]?.name ?? position.good}`,
      detail: supplier
        ? `${Math.round(position.importDependency * 100)}% importado · ${Math.round(supplier.share * 100)}% de ${supplier.name}`
        : `${Math.round(position.importDependency * 100)}% importado`,
      severity: position.importDependency >= 0.8 ? 'critical' : 'warning',
      icon: 'trade-route',
      good: position.good,
      kingdomId: supplier?.kingdomId
    });
  }

  // ---- Starving settlements ----
  const hungry = m.cities.filter(c => c.problem?.label.startsWith('Fome'));
  if (hungry.length) {
    issues.push({
      label: `Fome em ${hungry.length} cidade(s)`,
      detail: hungry.slice(0, 3).map(c => c.name).join(', '),
      severity: 'critical',
      icon: 'agriculture',
      good: 'food',
      cityId: hungry[0].id
    });
  }

  // ---- Besieged settlements ----
  const besieged = m.cities.filter(c => c.problem?.label.startsWith('Sitiada'));
  if (besieged.length) {
    issues.push({
      label: `${besieged.length} cidade(s) sitiada(s)`,
      detail: besieged.slice(0, 3).map(c => c.name).join(', '),
      severity: 'critical',
      icon: 'defence',
      cityId: besieged[0].id
    });
  }

  // ---- War exhaustion ----
  if (m.warWeariness >= 0.5 && m.wars.length) {
    issues.push({
      label: 'Cansaço de guerra',
      detail: `${Math.round(m.warWeariness * 100)}% após ${m.wars[0].years} ano(s) contra ${m.wars[0].enemyName}`,
      severity: m.warWeariness >= 0.7 ? 'critical' : 'warning',
      icon: 'war',
      kingdomId: m.wars[0].enemyId
    });
  }

  // ---- Unrest ----
  const radical = m.factions.filter(f => f.radicalization >= 0.6);
  if (radical.length) {
    const worst = radical.sort((a, b) => b.radicalization - a.radicalization)[0];
    issues.push({
      label: `${factionLabel(worst.id)} radicalizados`,
      detail: `${Math.round(worst.radicalization * 100)}% · risco de revolta em ${Math.round(m.society.revoltRisk * 100)}%`,
      severity: worst.radicalization >= 0.75 ? 'critical' : 'warning',
      icon: 'politics'
    });
  }

  // ---- Damaged rail ----
  if (m.infrastructure.railDamagedTiles > 0) {
    issues.push({
      label: 'Ferrovia danificada',
      detail: `${m.infrastructure.railDamagedTiles} trecho(s) além do limite que rompe a linha`,
      severity: m.infrastructure.railDamagedTiles > 2 ? 'critical' : 'warning',
      icon: 'trade-route'
    });
  }

  // ---- Treasury ----
  if (m.lastLedger && m.lastLedger.net < 0 && m.treasury < Math.abs(m.lastLedger.net) * 2) {
    issues.push({
      label: 'Tesouro em queda',
      detail: `Déficit de ${Math.abs(m.lastLedger.net).toFixed(1)} contra reserva de ${m.treasury.toFixed(0)}`,
      severity: 'critical',
      icon: 'economy'
    });
  }

  // ---- Idle technology ----
  const idle = m.technology.idleCapabilities[0];
  if (idle && idle.capacity < 0.35) {
    issues.push({
      label: `${idle.name} inutilizada`,
      detail: `${Math.round(idle.capacity * 100)}% de aproveitamento · falta ${[
        ...idle.missingGoods.map(g => GOODS[g]?.name ?? g),
        ...idle.missingBuildings.map(b => String(b))
      ].slice(0, 2).join(', ')}`,
      severity: 'warning',
      icon: 'technology',
      good: idle.missingGoods[0]
    });
  }

  return issues
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
    .slice(0, limit);
}

// ============================ FACTORS ============================

/** Pressures pushing a faction's satisfaction down, strongest first. */
export function negativeFactors(faction: FactionState): FactionFactor[] {
  return (faction.factors ?? []).filter(f => f.delta < 0).sort((a, b) => a.delta - b.delta);
}

/** Pressures holding it up, strongest first. */
export function positiveFactors(faction: FactionState): FactionFactor[] {
  return (faction.factors ?? []).filter(f => f.delta > 0).sort((a, b) => b.delta - a.delta);
}

// ============================ BANDS ============================

/** Higher is better. */
function bandStatus(value: number): Status {
  if (value >= 0.6) return 'positive';
  if (value >= 0.4) return 'neutral';
  if (value >= 0.25) return 'warning';
  return 'critical';
}

/** Higher is worse — risk, pressure, weariness. */
function invertedBand(value: number): Status {
  if (value >= 0.6) return 'critical';
  if (value >= 0.4) return 'warning';
  if (value >= 0.2) return 'neutral';
  return 'positive';
}
