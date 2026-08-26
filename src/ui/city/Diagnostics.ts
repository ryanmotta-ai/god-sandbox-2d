/**
 * The dossier's answer to "why is this city doing well or badly?"
 *
 * A city screen full of numbers still makes the player do the diagnosis. This
 * module does it instead: it turns the metrics into a short list of named
 * conditions, each with a verdict, a one-line finding, and — where the arithmetic
 * supports it — the terms that produced the verdict.
 *
 * The discipline that matters here is knowing when to say nothing. Every
 * condition below is a comparison between figures a system actually recorded, and
 * a condition whose inputs are missing is reported as `unknown` rather than
 * guessed at. A city that has not completed a year has no flow history, and
 * "Food: Critical 0%" would be a lie about a settlement that is simply new.
 */
import { GOODS, type GoodId } from '../../civ/Goods';
import type { Status } from '../kit';
import type { CityMetrics } from './CityMetrics';

/** The verdict on one aspect of the city. */
export interface Condition {
  id: 'food' | 'employment' | 'housing' | 'industry' | 'trade' | 'security';
  label: string;
  icon: string;
  /** `neutral` is used for "nothing to report", never as a hedge. */
  status: Status | 'unknown';
  /** One line: the verdict and the figure behind it. */
  finding: string;
  /**
   * The arithmetic, when it can be shown. Rendered as a breakdown so the player
   * can see the verdict being derived rather than taking it on trust.
   */
  terms?: { label: string; value: string; status?: Status }[];
  /** The good most implicated, making the condition navigable. */
  good?: GoodId;
}

/**
 * Reads the conditions off the metrics.
 *
 * Ordered worst-first by the caller, not here — this returns them in a stable
 * order so the same city always lists the same conditions in the same places.
 */
export function diagnose(metrics: CityMetrics): Condition[] {
  return [
    diagnoseFood(metrics),
    diagnoseEmployment(metrics),
    diagnoseHousing(metrics),
    diagnoseIndustry(metrics),
    diagnoseSecurity(metrics)
  ];
}

/** Conditions worth acting on, worst first. Used for the "problems first" block. */
export function problems(conditions: Condition[]): Condition[] {
  const rank: Record<string, number> = { critical: 0, warning: 1 };
  return conditions
    .filter(c => c.status === 'critical' || c.status === 'warning')
    .sort((a, b) => (rank[a.status as string] ?? 2) - (rank[b.status as string] ?? 2));
}

// ============================ FOOD ============================

/**
 * Food, from the settlement's own books.
 *
 * `security` is supply over demand and is already `null` when the city recorded
 * no consumption. An active famine outranks the ratio: `famineYears` is the
 * engine's own verdict that people are going hungry, and it should not be
 * contradicted by a balance that has since recovered.
 */
function diagnoseFood(metrics: CityMetrics): Condition {
  const f = metrics.food;
  const terms = [
    { label: 'Produzido', value: f.produced.toFixed(1) },
    { label: 'Importado', value: f.imported.toFixed(1) },
    { label: 'Consumido', value: f.consumed.toFixed(1) },
    { label: 'Exportado', value: f.exported.toFixed(1) },
    {
      label: 'Saldo',
      value: `${f.net >= 0 ? '+' : '−'}${Math.abs(f.net).toFixed(1)}`,
      status: (f.net >= 0 ? 'positive' : 'critical') as Status
    },
    { label: 'Estoque', value: f.stock.toFixed(1) }
  ];

  if (metrics.famineYears > 0) {
    return {
      id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'critical',
      finding: `Fome declarada há ${metrics.famineYears} ${metrics.famineYears === 1 ? 'ano' : 'anos'}`,
      terms, good: 'food'
    };
  }

  if (f.security === null) {
    return {
      id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'unknown',
      // A settlement founded this year has no closed ledger yet. Saying so is
      // more honest than showing 0%.
      finding: 'Sem histórico — nenhum ano fechado ainda',
      good: 'food'
    };
  }

  const pct = Math.round(f.security * 100);
  if (f.security < 0.85) {
    const shortfall = Math.abs(Math.min(0, f.net));
    return {
      id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'critical',
      finding: `Déficit de ${shortfall.toFixed(1)} por ano — oferta cobre ${pct}% da demanda`,
      terms, good: 'food'
    };
  }
  if (f.security < 1.0 || (f.yearsOfStock !== null && f.yearsOfStock < 0.5)) {
    return {
      id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'warning',
      finding: f.yearsOfStock !== null && f.yearsOfStock < 0.5
        ? `Estoque baixo — ${(f.yearsOfStock * 12).toFixed(0)} meses ao ritmo atual`
        : `Oferta cobre ${pct}% da demanda`,
      terms, good: 'food'
    };
  }
  return {
    id: 'food', label: 'Alimentação', icon: 'agriculture', status: 'positive',
    finding: f.yearsOfStock !== null
      ? `Abastecida — ${f.yearsOfStock.toFixed(1)} ano(s) de estoque`
      : `Abastecida — oferta cobre ${pct}% da demanda`,
    terms, good: 'food'
  };
}

// ============================ EMPLOYMENT ============================

/**
 * Employment, reporting whichever of the two opposite problems is real.
 *
 * Idle people and unstaffed posts are different failures with different fixes, so
 * the finding names the one that dominates and the terms show both. When both are
 * substantial the city has a mismatch, which is worth saying out loud.
 */
function diagnoseEmployment(metrics: CityMetrics): Condition {
  const e = metrics.employment;
  const terms = [
    { label: 'Trabalhadores', value: `${e.workers}` },
    { label: 'Postos', value: `${e.jobs}` },
    { label: 'Ocupados', value: `${e.filled}` },
    { label: 'Sem trabalho', value: `${e.unemployed}`, status: (e.unemployed > 0 ? 'warning' : 'positive') as Status },
    { label: 'Vagas abertas', value: `${e.vacancies}`, status: (e.vacancies > 0 ? 'warning' : 'positive') as Status }
  ];

  if (e.workers === 0) {
    return {
      id: 'employment', label: 'Emprego', icon: 'industry', status: 'unknown',
      finding: 'Nenhum habitante em idade produtiva'
    };
  }
  if (e.jobs === 0) {
    return {
      id: 'employment', label: 'Emprego', icon: 'industry', status: 'critical',
      finding: `Nenhum posto de trabalho para ${e.workers} adulto(s)`,
      terms
    };
  }

  const idleShare = e.unemployed / e.workers;
  const vacancyShare = e.vacancies / e.jobs;

  // Both sides bad at once is a mismatch, not a shortage of either.
  if (idleShare > 0.25 && vacancyShare > 0.25) {
    return {
      id: 'employment', label: 'Emprego', icon: 'industry', status: 'critical',
      finding: `Desencontro — ${e.unemployed} sem trabalho e ${e.vacancies} vagas abertas`,
      terms
    };
  }
  if (idleShare > 0.25) {
    return {
      id: 'employment', label: 'Emprego', icon: 'industry',
      status: idleShare > 0.4 ? 'critical' : 'warning',
      finding: `${e.unemployed} sem trabalho (${Math.round(idleShare * 100)}% dos adultos)`,
      terms
    };
  }
  if (vacancyShare > 0.25) {
    return {
      id: 'employment', label: 'Emprego', icon: 'industry',
      status: vacancyShare > 0.5 ? 'critical' : 'warning',
      // Named as a labour shortage, not unemployment: the city has work nobody is
      // doing, which is the opposite problem.
      finding: `Falta de mão de obra — ${e.vacancies} de ${e.jobs} postos vazios`,
      terms
    };
  }
  return {
    id: 'employment', label: 'Emprego', icon: 'industry', status: 'positive',
    finding: `Estável — ${Math.round((e.rate ?? 0) * 100)}% dos adultos empregados`,
    terms
  };
}

// ============================ HOUSING ============================

function diagnoseHousing(metrics: CityMetrics): Condition {
  if (metrics.housingPressure === null) {
    return {
      id: 'housing', label: 'Moradia', icon: 'building', status: 'critical',
      finding: `Nenhuma moradia construída para ${metrics.demographics.population} habitante(s)`
    };
  }
  const pct = Math.round(metrics.housingPressure * 100);
  const terms = [
    { label: 'População', value: `${metrics.demographics.population}` },
    { label: 'Capacidade', value: `${metrics.housingCapacity}` }
  ];

  if (metrics.housingPressure > 1.15) {
    return {
      id: 'housing', label: 'Moradia', icon: 'building', status: 'critical',
      finding: `Superlotada — ${pct}% da capacidade`, terms
    };
  }
  if (metrics.housingPressure > 1.0) {
    return {
      id: 'housing', label: 'Moradia', icon: 'building', status: 'warning',
      finding: `Acima da capacidade — ${pct}%`, terms
    };
  }
  return {
    id: 'housing', label: 'Moradia', icon: 'building', status: 'positive',
    finding: `Suficiente — ${pct}% da capacidade`, terms
  };
}

// ============================ INDUSTRY ============================

/**
 * Industry, reported through its bottlenecks.
 *
 * There is no output target to compare against, so a verdict on industry as a
 * whole would be arbitrary. What *is* provable is whether something is stopping
 * a specific building, and `CityMetrics` has already established that against
 * real stock and staffing figures. So the condition is simply the worst
 * bottleneck, named.
 */
function diagnoseIndustry(metrics: CityMetrics): Condition {
  const productive = metrics.sectors.filter(s => s.ratedOutput.length > 0);
  if (productive.length === 0) {
    return {
      id: 'industry', label: 'Indústria', icon: 'industry', status: 'unknown',
      finding: 'Nenhuma construção produtiva'
    };
  }

  const blocking = metrics.bottlenecks.filter(b =>
    b.kind === 'missing-input' || b.kind === 'depleted-deposit' || b.kind === 'no-workers');

  if (blocking.length) {
    const worst = blocking[0];
    return {
      id: 'industry', label: 'Indústria', icon: 'industry',
      status: worst.severity,
      finding: blocking.length > 1
        ? `${worst.subject}: ${worst.cause} · e ${blocking.length - 1} outro(s) impedimento(s)`
        : `${worst.subject}: ${worst.cause}`,
      good: worst.good
    };
  }

  const understaffed = metrics.bottlenecks.filter(b => b.kind === 'understaffed');
  if (understaffed.length) {
    return {
      id: 'industry', label: 'Indústria', icon: 'industry', status: 'warning',
      finding: `${understaffed.length} construção(ões) sem pessoal completo`
    };
  }

  return {
    id: 'industry', label: 'Indústria', icon: 'industry', status: 'positive',
    finding: `${productive.length} setor(es) produtivo(s) sem impedimentos`
  };
}


// ============================ SECURITY ============================

function diagnoseSecurity(metrics: CityMetrics): Condition {
  if (metrics.siege) {
    return {
      id: 'security', label: 'Segurança', icon: 'defence', status: 'critical',
      finding: `Sitiada por ${metrics.siege.besiegerName} há ${metrics.siege.years} ano(s)`,
      terms: [
        { label: 'Progresso do cerco', value: `${Math.round(metrics.siege.progress * 100)}%`, status: 'critical' },
        { label: 'Anos sob cerco', value: `${metrics.siege.years}` }
      ]
    };
  }
  return {
    id: 'security', label: 'Segurança', icon: 'defence', status: 'positive',
    finding: 'Sem cerco nem dano de guerra'
  };
}

// ============================ IMPORT DEPENDENCY ============================

/**
 * Goods the city cannot supply itself.
 *
 * Restricted to positions with real consumption and a meaningful import share —
 * a dependency computed from a rounding error is noise. `importDependency` comes
 * from the ledger, so this is a filter over recorded flows, not a new formula.
 */
export function importDependencies(
  metrics: CityMetrics,
  minimumShare = 0.25
): { good: GoodId; name: string; share: number; consumed: number; produced: number; imported: number }[] {
  return metrics.goods
    .filter(p => p.flow.consumed > 0.5 && p.importDependency >= minimumShare)
    .map(p => ({
      good: p.good,
      name: GOODS[p.good]?.name ?? p.good,
      share: p.importDependency,
      consumed: p.flow.consumed,
      produced: p.flow.produced,
      imported: p.flow.imported
    }))
    .sort((a, b) => b.share - a.share);
}
