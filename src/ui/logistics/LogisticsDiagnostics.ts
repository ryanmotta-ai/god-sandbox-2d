/**
 * The logistics verdicts, and the chains behind them.
 *
 * The brief's priority for this phase is causality: infrastructure should be
 * presented *through its consequences*. So the centrepiece here is `causalChain`,
 * which walks a bottleneck outward — the break, the flow it stops, the settlement
 * that was receiving it, the industry that needed it — and stops the moment the
 * next link cannot be proved.
 *
 * That stopping rule is the whole discipline. Every link carries the state that
 * justifies it: a `railDamage` above the severing threshold, a route the trade
 * network marked inactive, a ledger flow, a recipe in `GOODS`. A chain that runs
 * out of evidence ends there rather than continuing into a plausible story.
 */
import { GOODS, type GoodId } from '../../civ/Goods';
import type { Status } from '../kit';
import type {
  LogisticsMetrics, Bottleneck, LinkStatus, PortView, RouteView, CityAccess, RailLine
} from './LogisticsMetrics';

/** A named condition of the logistics system, with the arithmetic behind it. */
export interface LogisticsCondition {
  id: string;
  label: string;
  icon: string;
  status: Status | 'unknown';
  finding: string;
  terms?: { label: string; value: string; status?: Status }[];
  good?: GoodId;
  cityId?: string;
  at?: { x: number; y: number };
}

/** One step of a causal chain, with the state that proves it. */
export interface ChainLink {
  /** What this step is about, in words. */
  label: string;
  /** The figure or state behind it. */
  evidence: string;
  kind: 'infrastructure' | 'flow' | 'place' | 'industry' | 'market';
  good?: GoodId;
  cityId?: string;
  kingdomId?: string;
  at?: { x: number; y: number };
}

export interface CausalChain {
  /** Where the chain starts. */
  origin: string;
  links: ChainLink[];
  /** True when the chain ran out of provable state before reaching a consequence. */
  truncated: boolean;
}

/** Infrastructure the world hangs from, with the share that proves it. */
export interface CriticalAsset {
  id: string;
  label: string;
  kind: 'port' | 'rail-line' | 'route';
  /** Why it is critical, stated as a measured share. */
  reason: string;
  /** True when nothing else can carry what this carries. */
  singlePointOfFailure: boolean;
  share: number | null;
  cityId?: string;
  kingdomId?: string;
  good?: GoodId;
  at?: { x: number; y: number };
}

// ============================ STATUS VOCABULARY ============================

/**
 * The seven states, each mapped to something the simulation can prove.
 *
 * No state machine is duplicated here — these are readings of existing fields:
 * `route.active`, `isEmbargoed`, `roadLevelEffective`, `railLevelEffective`,
 * `portOperational`, and volume against the route's own ceiling.
 */
export const LINK_STATUS: Record<LinkStatus, { label: string; status: Status; explain: string }> = {
  healthy: { label: 'Saudável', status: 'positive', explain: 'Operando dentro da capacidade que a infraestrutura permite.' },
  busy: { label: 'Movimentado', status: 'neutral', explain: 'Perto do teto, mas ainda com folga.' },
  congested: {
    label: 'Congestionado', status: 'warning',
    explain: 'Movendo o máximo que a rota permite. Mais comércio aqui exige melhor infraestrutura, não mais demanda.'
  },
  damaged: {
    label: 'Danificado', status: 'warning',
    explain: 'A via, o trilho ou o porto perderam capacidade. O que passa é menos do que foi construído para passar.'
  },
  blocked: { label: 'Embargado', status: 'critical', explain: 'Um dos dois reinos embargou o outro. Nada atravessa.' },
  'war-closed': { label: 'Fechado pela guerra', status: 'critical', explain: 'Os dois reinos estão em guerra. A rota está suspensa.' },
  disconnected: { label: 'Desconectado', status: 'critical', explain: 'Não há ligação: nada chega nem sai por aqui.' }
};

/** Terms this screen uses that a reader could reasonably misread. */
export const TERMS: Record<string, string> = {
  capacity: 'Teto com que a rota foi aberta. O que a via ou os portos das duas pontas conseguem fisicamente mover.',
  utilization: 'Volume movido dividido pelo teto da rota. Em 100% a infraestrutura é o limite, não a demanda.',
  freight: 'Unidades entregues pela malha ferroviária. A simulação contabiliza o frete globalmente, não por reino nem por linha.',
  traffic: 'Passagens acumuladas de mercadores e cidadãos por um tile. É o que faz uma trilha virar estrada com o tempo.',
  bottleneck: 'Um ponto onde a rede não consegue mover o que precisaria. Só aparece aqui quando o estado da simulação prova o problema.',
  corridor: 'Agregação de interface: todas as rotas entre o mesmo par de assentamentos, nos dois sentidos. Não é uma entidade da simulação.',
  transportCost: 'Custo de levar uma unidade pela rota, na mesma fórmula que a simulação cobra: distância × preço × fator da via.',
  disconnected: 'Sem via utilizável, sem trilho que alcance outra estação, e sem nenhuma rota de comércio.',
  critical: 'Infraestrutura por onde passa parcela dominante de um fluxo. A parcela é medida, não atribuída.',
  lineQuality: 'Condição média dos trilhos de uma linha. A vazão do frete escala diretamente com ela.',
  railSevered: 'Acima de 75% de dano o trecho deixa de existir para a rede: a linha se parte em duas e o frete para de atravessar.'
};

// ============================ CONDITIONS ============================

/**
 * The state of the logistics system, capped at what matters.
 *
 * Each condition is a verdict on one network plus the figures that produced it.
 * A network the world has not built yet is `unknown`, not a zero — an empty rail
 * network is a stage of development, not a failure.
 */
export function diagnoseLogistics(m: LogisticsMetrics): LogisticsCondition[] {
  return [
    diagnoseRoads(m),
    diagnoseRail(m),
    diagnoseSea(m),
    diagnoseTrade(m),
    diagnoseReach(m)
  ];
}

export function logisticsProblems(conditions: LogisticsCondition[]): LogisticsCondition[] {
  const rank: Record<string, number> = { critical: 0, warning: 1 };
  return conditions
    .filter(c => c.status === 'critical' || c.status === 'warning')
    .sort((a, b) => (rank[a.status as string] ?? 2) - (rank[b.status as string] ?? 2));
}

function diagnoseRoads(m: LogisticsMetrics): LogisticsCondition {
  const r = m.roads;
  if (r.tiles === 0) {
    return {
      id: 'roads', label: 'Vias', icon: 'route', status: 'unknown',
      finding: 'Nenhuma via aberta — tudo se move na velocidade de quem caminha'
    };
  }

  const terms = [
    { label: 'Tiles com via', value: `${r.tiles}` },
    { label: 'Trilha de terra', value: `${r.byLevel[1]}` },
    { label: 'Via de pedra', value: `${r.byLevel[2]}` },
    { label: 'Estrada imperial', value: `${r.byLevel[3]}` },
    { label: 'Nível médio', value: r.meanLevel !== null ? r.meanLevel.toFixed(2) : '—' },
    { label: 'Tiles degradados', value: `${r.damagedTiles}`, status: (r.damagedTiles > 0 ? 'warning' : 'positive') as Status }
  ];

  const damagedShare = r.tiles > 0 ? r.damagedTiles / r.tiles : 0;
  if (damagedShare >= 0.15) {
    return {
      id: 'roads', label: 'Vias', icon: 'route', status: 'critical',
      finding: `${r.damagedTiles} de ${r.tiles} tiles de via degradados por dano de guerra`,
      terms
    };
  }
  if (r.damagedTiles > 0) {
    return {
      id: 'roads', label: 'Vias', icon: 'route', status: 'warning',
      finding: `${r.damagedTiles} tile(s) de via degradados`,
      terms
    };
  }
  return {
    id: 'roads', label: 'Vias', icon: 'route', status: 'positive',
    finding: `${r.tiles} tiles de via, nível médio ${r.meanLevel?.toFixed(2) ?? '—'}`,
    terms
  };
}

function diagnoseRail(m: LogisticsMetrics): LogisticsCondition {
  const rail = m.rail;
  if (rail.tiles === 0) {
    return {
      id: 'rail', label: 'Ferrovia', icon: 'route', status: 'unknown',
      // Absence of rail is a stage of the world, not a fault in it.
      finding: 'Nenhuma malha ferroviária foi desenvolvida ainda'
    };
  }

  const working = rail.lines.filter(l => l.stations.length >= 2);
  const terms = [
    { label: 'Trilhos assentados', value: `${rail.tiles}` },
    { label: 'Linhas em operação', value: `${working.length}` },
    { label: 'Estações ligadas', value: `${new Set(working.flatMap(l => l.stations.map(s => s.cityId))).size}` },
    { label: 'Trechos rompidos', value: `${rail.severedTiles}`, status: (rail.severedTiles > 0 ? 'critical' : 'positive') as Status },
    { label: 'Trechos danificados', value: `${rail.degradedTiles}`, status: (rail.degradedTiles > 0 ? 'warning' : 'positive') as Status },
    { label: 'Frete no mundo', value: rail.worldFreight.toFixed(0) }
  ];

  if (rail.severedTiles > 0) {
    return {
      id: 'rail', label: 'Ferrovia', icon: 'route', status: 'critical',
      finding: `${rail.severedTiles} trecho(s) rompido(s) — a linha se partiu e o frete não atravessa`,
      terms,
      at: rail.lines.find(l => l.damagedTiles > 0)?.at
    };
  }
  if (!working.length) {
    return {
      id: 'rail', label: 'Ferrovia', icon: 'route', status: 'warning',
      finding: 'Há trilhos, mas nenhuma linha liga duas estações — a malha não move nada',
      terms,
      at: rail.lines[0]?.at
    };
  }
  if (rail.degradedTiles > 0) {
    return {
      id: 'rail', label: 'Ferrovia', icon: 'route', status: 'warning',
      finding: `${working.length} linha(s) em operação, ${rail.degradedTiles} trecho(s) com dano`,
      terms
    };
  }
  return {
    id: 'rail', label: 'Ferrovia', icon: 'route', status: 'positive',
    finding: `${working.length} linha(s) ligando ${new Set(working.flatMap(l => l.stations.map(s => s.cityId))).size} estações`,
    terms
  };
}

function diagnoseSea(m: LogisticsMetrics): LogisticsCondition {
  if (!m.ports.length) {
    return {
      id: 'sea', label: 'Marítimo', icon: 'route', status: 'unknown',
      finding: 'Nenhum porto construído'
    };
  }

  const down = m.ports.filter(p => !p.operational);
  const damaged = m.ports.filter(p => p.operational && p.condition < 0.75);
  const terms = [
    { label: 'Portos e ancoradouros', value: `${m.ports.length}` },
    { label: 'Rotas marítimas', value: `${m.routes.filter(r => r.kind === 'maritime').length}` },
    { label: 'Navios em trânsito', value: `${m.activeShips}` },
    { label: 'Volume marítimo', value: m.seaTradeVolume.toFixed(1) },
    { label: 'Inoperantes', value: `${down.length}`, status: (down.length ? 'critical' : 'positive') as Status }
  ];

  if (down.length) {
    return {
      id: 'sea', label: 'Marítimo', icon: 'route', status: 'critical',
      finding: `${down.length} porto(s) inoperante(s): ${down.slice(0, 3).map(p => p.cityName).join(', ')}`,
      terms,
      cityId: down[0].cityId,
      at: { x: down[0].x, y: down[0].y }
    };
  }
  if (damaged.length) {
    return {
      id: 'sea', label: 'Marítimo', icon: 'route', status: 'warning',
      finding: `${damaged.length} porto(s) com estrutura danificada`,
      terms,
      cityId: damaged[0].cityId
    };
  }
  return {
    id: 'sea', label: 'Marítimo', icon: 'route', status: 'positive',
    finding: `${m.ports.length} porto(s) operando · ${m.activeShips} navio(s) em trânsito`,
    terms
  };
}

function diagnoseTrade(m: LogisticsMetrics): LogisticsCondition {
  if (!m.routes.length) {
    return {
      id: 'trade', label: 'Rotas', icon: 'trade-route', status: 'unknown',
      finding: 'Nenhuma rota logística ativa'
    };
  }

  const congested = m.routes.filter(r => r.status === 'congested');
  const terms = [
    { label: 'Rotas ativas', value: `${m.activeRoutes}`, status: 'positive' as Status },
    { label: 'Rotas fechadas', value: `${m.closedRoutes}`, status: (m.closedRoutes ? 'critical' : 'positive') as Status },
    { label: 'No limite da capacidade', value: `${congested.length}`, status: (congested.length ? 'warning' : 'positive') as Status },
    { label: 'Caravanas na estrada', value: `${m.activeCaravans}` },
    { label: 'Navios no mar', value: `${m.activeShips}` }
  ];

  if (m.closedRoutes > 0) {
    return {
      id: 'trade', label: 'Rotas', icon: 'trade-route', status: 'critical',
      finding: `${m.closedRoutes} de ${m.routes.length} rota(s) fechadas por guerra ou embargo`,
      terms
    };
  }
  if (congested.length >= 2) {
    return {
      id: 'trade', label: 'Rotas', icon: 'trade-route', status: 'warning',
      finding: `${congested.length} rota(s) movendo o máximo que a infraestrutura permite`,
      terms
    };
  }
  return {
    id: 'trade', label: 'Rotas', icon: 'trade-route', status: 'positive',
    finding: `${m.activeRoutes} rota(s) ativa(s), nenhuma fechada`,
    terms
  };
}

function diagnoseReach(m: LogisticsMetrics): LogisticsCondition {
  const isolated = m.cities.filter(c => c.isolated);
  const roadless = m.cities.filter(c => !c.isolated && c.roadLevel === 0 && c.population >= 20);
  const terms = [
    { label: 'Assentamentos', value: `${m.cities.length}` },
    { label: 'Isolados', value: `${isolated.length}`, status: (isolated.length ? 'critical' : 'positive') as Status },
    { label: 'Sem via própria', value: `${roadless.length}`, status: (roadless.length ? 'warning' : 'positive') as Status },
    { label: 'Com porto', value: `${m.cities.filter(c => c.hasPort).length}` },
    { label: 'Ligados por trilho', value: `${m.cities.filter(c => c.railConnected).length}` }
  ];

  if (isolated.length) {
    return {
      id: 'reach', label: 'Alcance', icon: 'map', status: 'critical',
      finding: `${isolated.length} assentamento(s) sem nenhuma ligação: ${isolated.slice(0, 3).map(c => c.cityName).join(', ')}`,
      terms,
      cityId: isolated[0].cityId,
      at: { x: isolated[0].x, y: isolated[0].y }
    };
  }
  if (roadless.length) {
    return {
      id: 'reach', label: 'Alcance', icon: 'map', status: 'warning',
      finding: `${roadless.length} assentamento(s) de porte sem via no território`,
      terms,
      cityId: roadless[0].cityId
    };
  }
  return {
    id: 'reach', label: 'Alcance', icon: 'map', status: 'positive',
    finding: 'Todos os assentamentos têm alguma ligação com o resto do mundo',
    terms
  };
}

// ============================ CAUSAL CHAINS ============================

/**
 * The chain from a break to its consequence.
 *
 * Walks outward one provable step at a time and stops when the next link has no
 * evidence: the break, the flow it carried, the settlement receiving it, the
 * industry whose recipe needed it, and the market position of what that industry
 * makes. `truncated` says whether the walk ended because the chain was complete
 * or because the state ran out.
 */
export function causalChain(bottleneck: Bottleneck, m: LogisticsMetrics): CausalChain {
  const links: ChainLink[] = [];

  // 1. The break itself.
  links.push({
    label: bottleneck.location,
    evidence: bottleneck.problem,
    kind: 'infrastructure',
    at: bottleneck.at ?? undefined
  });

  // 2. What stopped flowing. Nothing to say when no good is implicated.
  const good = bottleneck.affectedGoods[0];
  if (!good) {
    return { origin: bottleneck.location, links, truncated: bottleneck.affectedGoods.length === 0 };
  }

  const position = m.routes.filter(r => r.good === good);
  const closed = position.filter(r => r.status === 'war-closed' || r.status === 'blocked');
  links.push({
    label: `${GOODS[good]?.name ?? good} deixa de circular`,
    evidence: closed.length
      ? `${closed.length} rota(s) deste bem fechada(s), somando ${closed.reduce((s, r) => s + r.route.volume, 0).toFixed(0)} de volume`
      : `${position.length} rota(s) transportam este bem`,
    kind: 'flow',
    good
  });

  // 3. Who was receiving it. Only settlements whose own books show the import.
  const receivers = bottleneck.affectedCities.filter(entry => {
    const access = m.cities.find(c => c.cityId === entry.id);
    return access?.importedGoods.some(g => g.good === good);
  });
  const target = receivers[0] ?? bottleneck.affectedCities[0];
  if (!target) return { origin: bottleneck.location, links, truncated: true };

  const access = m.cities.find(c => c.cityId === target.id);
  const imported = access?.importedGoods.find(g => g.good === good);
  // A step that repeats the previous one has not advanced the chain. The origin
  // of a break is often the same settlement that was receiving the flow, and
  // printing its name twice reads as two findings where there is one.
  if (!links.some(l => l.cityId === target.id) && bottleneck.location !== target.name) {
    links.push({
      label: `${target.name} para de receber`,
      evidence: imported
        ? `Recebia ${imported.volume.toFixed(0)} por rota`
        : 'Assentamento na ponta afetada da ligação',
      kind: 'place',
      cityId: target.id,
      at: access ? { x: access.x, y: access.y } : undefined
    });
  }

  // 4. What that settlement made with it. This is the last link the recipes and
  //    the ledgers can prove; without one, the chain honestly stops here.
  const blocked = downstreamAt(good, target.id, m);
  if (!blocked.length) {
    return { origin: bottleneck.location, links, truncated: true };
  }

  links.push({
    label: `${blocked.map(g => GOODS[g]?.name ?? g).join(' e ')} fica sem insumo`,
    evidence: `A receita de ${GOODS[blocked[0]]?.name ?? blocked[0]} consome ${GOODS[good]?.name ?? good}, e ${target.name} produz este bem`,
    kind: 'industry',
    good: blocked[0],
    cityId: target.id
  });

  return { origin: bottleneck.location, links, truncated: false };
}

/** Goods a settlement produces whose recipe consumes the given input. */
function downstreamAt(input: GoodId, cityId: string, m: LogisticsMetrics): GoodId[] {
  const access = m.cities.find(c => c.cityId === cityId);
  if (!access) return [];
  const out: GoodId[] = [];
  for (const [good, def] of Object.entries(GOODS)) {
    if (!def.recipe || !(input in def.recipe)) continue;
    // Only claimed where the route book shows this place moving the output too.
    const moves = m.routes.some(r =>
      r.good === (good as GoodId) && (r.route.fromCityId === cityId || r.route.toCityId === cityId));
    if (moves) out.push(good as GoodId);
  }
  return out;
}

// ============================ CRITICAL INFRASTRUCTURE ============================

/**
 * Infrastructure the world hangs from.
 *
 * "Critical" is not a score. It is a measured share of a real flow: a port
 * handling most of a realm's sea trade, a rail line that is the only one joining
 * a settlement, a route that is the only source of a good a city consumes. Where
 * the share cannot be measured, the asset does not appear.
 */
export function criticalInfrastructure(m: LogisticsMetrics): CriticalAsset[] {
  const out: CriticalAsset[] = [];

  // ---- Ports carrying most of a realm's sea trade ----
  for (const port of m.ports) {
    if (port.realmSeaShare < 0.5 || !port.kingdomName) continue;
    const sole = m.ports.filter(p => p.kingdomId === port.kingdomId).length === 1;
    out.push({
      id: `port:${port.cityId}`,
      label: `${port.cityName} · porto`,
      kind: 'port',
      reason: `Responde por ${Math.round(port.realmSeaShare * 100)}% de todo o comércio marítimo de ${port.kingdomName}`,
      singlePointOfFailure: sole,
      share: port.realmSeaShare,
      cityId: port.cityId,
      kingdomId: port.kingdomId ?? undefined,
      at: { x: port.x, y: port.y }
    });
  }

  // ---- Settlements joined by exactly one rail line ----
  const linesPerCity = new Map<string, RailLine[]>();
  for (const line of m.rail.lines) {
    if (line.stations.length < 2) continue;
    for (const station of line.stations) {
      const list = linesPerCity.get(station.cityId) ?? [];
      list.push(line);
      linesPerCity.set(station.cityId, list);
    }
  }
  for (const [cityId, lines] of linesPerCity) {
    if (lines.length !== 1) continue;
    const access = m.cities.find(c => c.cityId === cityId);
    if (!access || !access.railConnected) continue;
    const line = lines[0];
    out.push({
      id: `rail:${cityId}`,
      label: `${access.cityName} · ligação ferroviária`,
      kind: 'rail-line',
      reason: `É a única linha que liga ${access.cityName} à malha, servindo ${line.stations.length} estações`,
      singlePointOfFailure: true,
      share: null,
      cityId,
      kingdomId: access.kingdomId ?? undefined,
      at: line.at
    });
  }

  // ---- Routes that are a settlement's only source of a good it consumes ----
  const bySource = new Map<string, RouteView[]>();
  for (const route of m.routes) {
    if (!route.toCity) continue;
    const key = `${route.toCity.id}|${route.good}`;
    const list = bySource.get(key) ?? [];
    list.push(route);
    bySource.set(key, list);
  }
  for (const [key, list] of bySource) {
    if (list.length !== 1) continue;
    const route = list[0];
    const [cityId, good] = key.split('|');
    const access = m.cities.find(c => c.cityId === cityId);
    const imported = access?.importedGoods.find(g => g.good === (good as GoodId));
    // Only interesting where the volume is meaningful to that settlement.
    if (!imported || imported.volume < 10) continue;
    out.push({
      id: `route:${route.route.id}`,
      label: `${route.fromCity?.name ?? '?'} → ${route.toCity?.name ?? '?'} · ${route.goodName}`,
      kind: 'route',
      reason: `É a única rota que traz ${route.goodName} para ${route.toCity?.name}, movendo ${imported.volume.toFixed(0)} por ano`,
      singlePointOfFailure: true,
      share: null,
      good: route.good,
      cityId,
      kingdomId: route.toKingdom?.id,
      at: route.fromCity ? { x: route.fromCity.x, y: route.fromCity.y } : undefined
    });
  }

  return out.sort((a, b) => {
    if (a.singlePointOfFailure !== b.singlePointOfFailure) return a.singlePointOfFailure ? -1 : 1;
    return (b.share ?? 0) - (a.share ?? 0);
  });
}

// ============================ HELPERS ============================

export function statusOf(condition: LogisticsCondition): Status {
  return condition.status === 'unknown' ? 'neutral' : condition.status;
}

export function verdictLabel(status: LogisticsCondition['status']): string {
  return { positive: 'Saudável', neutral: 'Normal', warning: 'Atenção', critical: 'Crítico', unknown: 'Sem dados' }[status];
}

export function utilizationStatus(value: number): Status {
  if (value >= 0.99) return 'warning';
  if (value >= 0.8) return 'neutral';
  return 'positive';
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
