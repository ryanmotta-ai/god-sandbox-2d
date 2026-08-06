/**
 * The economy's verdicts.
 *
 * Two jobs. First, a short ranked list of what is actually wrong with the world
 * economy — capped at five, because a page of thirty warnings has told the player
 * nothing. Second, the answer to the question the whole screen exists for: *why
 * is this good expensive, short, or piling up?*
 *
 * The price explanation is the delicate one. `WorldMarket.settle` moves a price
 * toward `base × (demand+1 ÷ supply+1)^0.6`, so the *only* thing that can move a
 * price is the supply-demand ratio — and everything else in the world acts on the
 * price through that ratio. So the factors reported here are the things that moved
 * supply or demand, each one measured, and nothing is offered as a cause unless
 * the figures behind it exist. Where they do not, the answer is "insufficient
 * data" rather than a plausible story.
 */
import { GOODS, type GoodId } from '../../civ/Goods';
import type { Status } from '../kit';
import type { EconomyMetrics, WorldGoodPosition, RouteView, BottleneckView } from './EconomyMetrics';

/** One thing wrong with the world economy, ranked and navigable. */
export interface EconomicAlert {
  id: string;
  label: string;
  detail: string;
  severity: 'warning' | 'critical';
  icon: string;
  good?: GoodId;
  cityId?: string;
  kingdomId?: string;
  /** Where to look, for a route or rail problem. */
  at?: { x: number; y: number };
}

/** One measured contribution to a price move. */
export interface PriceFactor {
  label: string;
  /** Signed magnitude, as a fraction. Presentation decides the colour. */
  delta: number | null;
  /** Plain figures behind the claim. */
  detail: string;
  good?: GoodId;
}

export interface PriceExplanation {
  good: GoodId;
  change: number;
  /** Empty when nothing measurable moved. */
  factors: PriceFactor[];
  /** The mechanism, stated once so the factors read as evidence for it. */
  mechanism: string;
  /** True when there is not enough recorded state to say anything at all. */
  insufficient: boolean;
}

// ============================ ALERTS ============================

/**
 * What is wrong with the world economy, worst first, capped at five.
 *
 * Everything here is drawn from figures already computed, so this is a ranking
 * pass rather than a second round of analysis.
 */
export function economicAlerts(m: EconomyMetrics, limit = 5): EconomicAlert[] {
  const alerts: EconomicAlert[] = [];

  // ---- Strategic and outright shortages ----
  for (const position of m.shortages.slice(0, 3)) {
    if (position.coverage === null) continue;
    const deficit = 1 - position.coverage;
    // Below 15% short is ordinary market noise, not a crisis.
    if (deficit < 0.15) continue;
    alerts.push({
      id: `shortage:${position.good}`,
      label: `Escassez de ${position.name}`,
      detail: `A demanda excede a oferta em ${Math.round(deficit * 100)}% · ${position.supply.toFixed(0)} produzido contra ${position.demand.toFixed(0)} consumido`,
      severity: position.strategic || deficit >= 0.4 ? 'critical' : 'warning',
      icon: position.strategic ? 'pickaxe' : 'crate',
      good: position.good
    });
  }

  // ---- Food, which is its own kind of emergency ----
  const starving = m.cities.filter(c => c.problem && /Fome|Sem comida/.test(c.problem.label));
  if (starving.length) {
    alerts.push({
      id: 'food-crisis',
      label: 'Crise alimentar',
      detail: `${starving.length} cidade(s) sem comida: ${starving.slice(0, 3).map(c => c.name).join(', ')}`,
      severity: 'critical',
      icon: 'agriculture',
      good: 'food',
      cityId: starving[0].id
    });
  }

  // ---- Price shocks ----
  const shock = m.gainers[0];
  if (shock && shock.priceChange >= 0.25) {
    alerts.push({
      id: `shock:${shock.good}`,
      label: `Choque de preço: ${shock.name}`,
      detail: `${signed(shock.priceChange)} em um ano · ${shock.price.toFixed(1)} contra base de ${shock.basePrice.toFixed(1)}`,
      severity: shock.priceChange >= 0.5 ? 'critical' : 'warning',
      icon: 'coin',
      good: shock.good
    });
  }

  // ---- Blocked trade ----
  const blocked = m.routes.filter(r => r.status === 'war-closed' || r.status === 'embargoed');
  if (blocked.length) {
    const embargoed = blocked.filter(r => r.status === 'embargoed').length;
    alerts.push({
      id: 'routes-blocked',
      label: `${blocked.length} rota(s) fechada(s)`,
      detail: embargoed
        ? `${embargoed} por embargo, ${blocked.length - embargoed} por guerra`
        : 'Fechadas por guerra entre os reinos',
      severity: blocked.length >= 3 ? 'critical' : 'warning',
      icon: 'trade-route',
      good: blocked[0].route.good,
      at: blocked[0].fromCity ? { x: blocked[0].fromCity.x, y: blocked[0].fromCity.y } : undefined
    });
  }

  // ---- Corridors at their ceiling ----
  const saturated = m.routes.filter(r => r.status === 'capacity-limited');
  if (saturated.length >= 2) {
    alerts.push({
      id: 'routes-saturated',
      label: 'Corredores no limite',
      detail: `${saturated.length} rota(s) movendo o máximo que a infraestrutura permite`,
      severity: 'warning',
      icon: 'trade-route',
      good: saturated[0].route.good,
      at: saturated[0].fromCity ? { x: saturated[0].fromCity.x, y: saturated[0].fromCity.y } : undefined
    });
  }

  // ---- Damaged rail, where the network exists at all ----
  const damagedRail = m.routes.filter(r => r.status === 'damaged').length;
  if (m.railTiles > 0 && damagedRail > 0) {
    alerts.push({
      id: 'rail-damaged',
      label: 'Gargalo logístico',
      detail: `${damagedRail} rota(s) com a infraestrutura degradada abaixo da capacidade contratada`,
      severity: 'warning',
      icon: 'route'
    });
  }

  // ---- Industry stopped for want of an input ----
  const stopped = m.bottlenecks.filter(b => b.severity === 'critical');
  if (stopped.length) {
    const worst = stopped[0];
    alerts.push({
      id: `bottleneck:${worst.output}`,
      label: `Produção parada: ${GOODS[worst.output]?.name ?? worst.output}`,
      detail: `${stopped.length} linha(s) sem insumo · ${worst.cityName} não tem ${GOODS[worst.constraint]?.name ?? worst.constraint}`,
      severity: 'critical',
      icon: 'industry',
      good: worst.constraint,
      cityId: worst.cityId,
      at: { x: worst.x, y: worst.y }
    });
  }

  return alerts
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
    .slice(0, limit);
}

// ============================ WHY IS THE PRICE MOVING ============================

/**
 * Why a good's price moved, from the things that actually moved it.
 *
 * The market's own rule is that price chases `base × (demand ÷ supply)^0.6`, so
 * the factors here are the measured components of that ratio plus the concrete
 * events that shifted them: routes closed, deposits exhausted, production lines
 * stopped for want of an input. Each factor carries the arithmetic. Nothing is
 * asserted as a cause without a figure behind it.
 */
export function explainPrice(
  position: WorldGoodPosition,
  m: EconomyMetrics
): PriceExplanation {
  const factors: PriceFactor[] = [];

  // ---- The ratio itself, which is the mechanism ----
  if (position.demand > 0 || position.supply > 0) {
    factors.push({
      label: position.coverage !== null && position.coverage < 1 ? 'Demanda acima da oferta' : 'Oferta acima da demanda',
      delta: position.coverage !== null ? position.coverage - 1 : null,
      detail: `${position.supply.toFixed(1)} produzido contra ${position.demand.toFixed(1)} consumido no mundo`
    });
  }

  // ---- Where the price sits against its own base ----
  factors.push({
    label: position.priceIndex >= 1 ? 'Acima do preço de referência' : 'Abaixo do preço de referência',
    delta: position.priceIndex - 1,
    detail: `${position.price.toFixed(1)} contra base de ${position.basePrice.toFixed(1)}`
  });

  // ---- Upstream: an input of this good that is itself short ----
  const recipe = GOODS[position.good]?.recipe;
  if (recipe) {
    for (const input of Object.keys(recipe) as GoodId[]) {
      const upstream = m.goods.find(p => p.good === input);
      if (!upstream || upstream.coverage === null || upstream.coverage >= 0.95) continue;
      factors.push({
        label: `Oferta de ${upstream.name} restringida`,
        delta: upstream.coverage - 1,
        detail: `${upstream.supply.toFixed(1)} produzido contra ${upstream.demand.toFixed(1)} consumido`,
        good: input
      });
    }
  }

  // ---- Trade this good lost ----
  const routes = m.routes.filter(r => r.route.good === position.good);
  const closed = routes.filter(r => r.status === 'war-closed' || r.status === 'embargoed');
  if (closed.length) {
    factors.push({
      label: `${closed.length} rota(s) interrompida(s)`,
      delta: null,
      detail: closed
        .slice(0, 3)
        .map(r => `${r.fromCity?.name ?? '?'} → ${r.toCity?.name ?? '?'} (${r.status === 'embargoed' ? 'embargo' : 'guerra'})`)
        .join(', ')
    });
  }

  // ---- Deposits running out, for anything that comes out of the ground ----
  const reserve = m.reserves.find(r => r.good === position.good);
  if (reserve && reserve.exhausted > 0) {
    factors.push({
      label: `${reserve.exhausted} depósito(s) esgotado(s)`,
      delta: reserve.max > 0 ? -(1 - reserve.remaining / reserve.max) : null,
      detail: `${reserve.remaining.toFixed(0)} de ${reserve.max.toFixed(0)} restantes em ${reserve.deposits} depósito(s)`
    });
  }

  // ---- Industry that cannot run for want of this good ----
  const blocking = m.bottlenecks.filter(b => b.constraint === position.good);
  if (blocking.length) {
    const outputs = [...new Set(blocking.map(b => GOODS[b.output]?.name ?? b.output))].slice(0, 3);
    factors.push({
      label: `${blocking.length} linha(s) de produção esperando por este bem`,
      delta: null,
      detail: `Bloqueia ${outputs.join(', ')} em ${new Set(blocking.map(b => b.cityId)).size} cidade(s)`,
      good: blocking[0].output
    });
  }

  // ---- Stock cover, which decides whether a deficit bites now or later ----
  if (position.yearsOfStock !== null) {
    factors.push({
      label: position.yearsOfStock < 1 ? 'Estoque abaixo de um ano de consumo' : 'Estoque cobre o consumo',
      delta: null,
      detail: `${position.stock.toFixed(0)} em estoque · ${position.yearsOfStock.toFixed(1)} ano(s) ao ritmo atual`
    });
  }

  // A good nobody produces, consumes or holds has nothing to explain. Two rows of
  // "the price is at its base" is not an explanation, so it is not offered as one.
  const insufficient =
    position.supply === 0 && position.demand === 0 && position.stock === 0 && routes.length === 0;

  return {
    good: position.good,
    change: position.priceChange,
    factors: insufficient ? [] : factors,
    mechanism: 'O mercado persegue o preço de equilíbrio: base × (demanda ÷ oferta) ^ 0,6, movendo 25% da distância por ano. Tudo abaixo age sobre o preço através dessa razão.',
    insufficient
  };
}

// ============================ SMALL HELPERS ============================

export function signed(fraction: number): string {
  return `${fraction >= 0 ? '+' : '−'}${Math.abs(fraction * 100).toFixed(0)}%`;
}

/**
 * The colour a price move deserves.
 *
 * **A rising price is not automatically bad news.** For whoever sells the good it
 * is the best news there is. So the caller says whose side it is on and the
 * status follows from that — this is the same rule UI-0's `trendIndicator`
 * enforces, applied to prices.
 */
export function priceStatus(change: number, side: 'buyer' | 'seller' | 'neutral' = 'neutral'): Status {
  if (Math.abs(change) < 0.02) return 'neutral';
  if (side === 'neutral') return 'neutral';
  const goodNews = side === 'seller' ? change > 0 : change < 0;
  return goodNews ? 'positive' : 'warning';
}

/** How short or long the world is on a good, as a status. */
export function coverageStatus(coverage: number | null): Status | undefined {
  if (coverage === null) return undefined;
  if (coverage < 0.7) return 'critical';
  if (coverage < 0.95) return 'warning';
  if (coverage > 1.5) return 'neutral';
  return 'positive';
}

/** The severity of one production bottleneck, for a table row. */
export function bottleneckStatus(bottleneck: BottleneckView): Status {
  return bottleneck.severity === 'critical' ? 'critical' : 'warning';
}

export const ROUTE_STATUS: Record<RouteView['status'], { label: string; status: Status; explain: string }> = {
  active: { label: 'Ativa', status: 'positive', explain: 'Operando dentro da capacidade contratada.' },
  'capacity-limited': {
    label: 'No limite', status: 'warning',
    explain: 'Movendo o volume máximo que a rota permite. Mais comércio exige melhor infraestrutura.'
  },
  damaged: {
    label: 'Degradada', status: 'warning',
    explain: 'A via ou o porto perderam capacidade. O que passa é menos do que a rota foi aberta para mover.'
  },
  'war-closed': { label: 'Fechada por guerra', status: 'critical', explain: 'Os dois reinos estão em guerra.' },
  embargoed: { label: 'Embargada', status: 'critical', explain: 'Um dos dois reinos embargou o outro.' }
};
