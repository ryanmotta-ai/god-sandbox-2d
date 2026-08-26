/**
 * The economy screen's tabs.
 *
 * Each builder takes the precomputed world snapshot and returns DOM. None of them
 * touch the simulation, which is what keeps a pass over every settlement, every
 * route and every tile on the map out of the render path.
 *
 * The reading order throughout is: what is wrong, then the level, then the detail.
 * A world whose steel has stopped says so above its trade volume.
 */
import { el, Child } from '../core/Dom';
import {
  panel, section, divider, statRow, rowList, statGrid, stat, progressBar,
  badge, badgeRow, table, emptyState, objectLink, icon, withTooltip, button,
  formatCompact, formatFull, formatPercent, trendIndicator,
  type Status, type Column
} from '../kit';
import { GOODS, type GoodId } from '../../civ/Goods';
import {
  economicAlerts, explainPrice, signed, priceStatus, coverageStatus, ROUTE_STATUS,
  type EconomicAlert
} from './EconomyDiagnostics';
import {
  filterGoods, chainAround, flowFor,
  type EconomyMetrics, type WorldGoodPosition, type RouteView,
  type CityEconomy, type RealmEconomy, type SectorView, type BottleneckView,
  type GoodCategory
} from './EconomyMetrics';
import type { EconomyScreenHost } from '../screens/EconomyScreen';

// ============================ TOOLTIP VOCABULARY ============================

/**
 * The terms this screen uses, explained once.
 *
 * Every one of these is a word a player could reasonably read as meaning
 * something else, so the definition travels with the figure rather than living in
 * a manual.
 */
const TERMS: Record<string, string> = {
  supply: 'Tudo que o mundo produziu deste bem no último ano fechado. Importação não entra: mover um bem entre cidades não cria oferta nova.',
  demand: 'Tudo que o mundo consumiu deste bem no último ano fechado.',
  deficit: 'Quanto a demanda passa da oferta. Um déficit é coberto por estoque até o estoque acabar.',
  coverage: 'Oferta ÷ demanda. Abaixo de 100% o mundo consome mais do que faz.',
  balance: 'Exportado menos importado, em unidades movidas. Positivo significa que o reino vende mais do que compra.',
  dependency: 'Parcela do que o reino consome que veio de fora. Alto significa que um bloqueio dói.',
  utilization: 'Produção efetiva ÷ capacidade instalada. Mede quanto da indústria construída está de fato funcionando.',
  pricePressure: 'Média do preço atual dividido pelo preço de referência, entre os bens que o mundo movimenta. Acima de 100% o mundo inteiro está caro.',
  capacity: 'Produção que as construções alcançariam com todos os postos ocupados. É uma capacidade nominal, não produção efetiva.',
  transportCost: 'Custo de levar uma unidade pela rota, na mesma fórmula que a simulação cobra ao abrir a rota: distância × preço × fator da via.',
  margin: 'Preço no destino menos preço na origem, menos transporte, menos tarifa. É a razão pela qual a rota existe.'
};

function term(key: keyof typeof TERMS | string): string {
  return TERMS[key] ?? '';
}

const CATEGORY_FILTERS: { id: GoodCategory; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'raw', label: 'Brutos' },
  { id: 'crafted', label: 'Manufaturados' },
  { id: 'strategic', label: 'Estratégicos' },
  { id: 'food', label: 'Alimento' },
  { id: 'industrial', label: 'Industriais' }
];

// ============================ OVERVIEW ============================

export function buildOverview(m: EconomyMetrics, host: EconomyScreenHost): Child[] {
  const alerts = economicAlerts(m);

  return [
    alerts.length ? buildAlerts(alerts, host) : null,

    panel({ title: 'Indicadores mundiais', icon: 'economy' }, [
      statGrid([
        stat({
          label: 'Produção mundial', value: formatCompact(m.worldOutput), icon: 'economy',
          tooltip: {
            title: 'Produção mundial',
            value: formatFull(Math.round(m.worldOutput)),
            description: 'Soma da produção econômica de todos os assentamentos.'
          }
        }),
        stat({
          label: 'Bens manufaturados', value: formatCompact(m.industrialOutput), icon: 'industry',
          tooltip: { title: 'Produção industrial', description: 'Unidades de bens manufaturados produzidas no último ano fechado.' }
        }),
        stat({
          label: 'Volume de comércio', value: formatCompact(m.tradeVolume), icon: 'trade',
          tooltip: { title: 'Volume de comércio', description: 'Valor movido em rotas neste ano, contabilizado pela rede de comércio.' }
        }),
        stat({
          label: 'Rotas ativas', value: `${m.activeRoutes}`, icon: 'trade-route',
          status: m.suspendedRoutes > 0 ? 'warning' : undefined,
          tooltip: {
            title: 'Rotas',
            rows: [
              { label: 'Ativas', value: `${m.activeRoutes}`, status: 'positive' },
              { label: 'Fechadas', value: `${m.suspendedRoutes}`, status: m.suspendedRoutes ? 'critical' : 'positive' },
              { label: 'Marítimas', value: `${m.maritimeRoutes}` },
              { label: 'Terrestres', value: `${m.overlandRoutes}` }
            ]
          }
        }),
        stat({
          label: 'Comércio marítimo', value: `${m.ships}`, unit: 'navios', icon: 'route',
          tooltip: { title: 'Navios em trânsito', description: 'Embarcações mercantes navegando agora.' }
        }),
        // Rail appears only once track exists. A stone-age world has no freight
        // figure to show and a zero would read as a broken railway.
        m.railTiles > 0
          ? stat({
              label: 'Carga ferroviária', value: formatCompact(m.railFreight), icon: 'crate',
              tooltip: {
                title: 'Carga movida por trilho',
                value: formatFull(Math.round(m.railFreight)),
                description: 'Unidades entregues pela malha ferroviária neste ano.',
                rows: [{ label: 'Trilhos assentados', value: `${m.railTiles}` }]
              }
            })
          : null,
        // Same rule as rail: no runways, no figure. A zero here would read as a
        // grounded fleet rather than a world that has not invented flight.
        m.airServices > 0
          ? stat({
              label: 'Carga aérea', value: formatCompact(m.airFreight), icon: 'crate',
              tooltip: {
                title: 'Carga movida por via aérea',
                value: formatFull(Math.round(m.airFreight)),
                description: 'Unidades entregues por voo neste ano. O avião é rápido e de pouco volume: complementa a malha terrestre, não a substitui.',
                rows: [
                  { label: 'Linhas em operação', value: `${m.airServices}` },
                  { label: 'Voos no ano', value: `${m.airFlights}` },
                  { label: 'Passageiros', value: formatFull(Math.round(m.airPassengers)) }
                ]
              }
            })
          : null,
        m.foodCoverage !== null
          ? stat({
              label: 'Abastecimento alimentar', value: formatPercent(m.foodCoverage), icon: 'agriculture',
              status: m.foodCoverage >= 1 ? 'positive' : m.foodCoverage >= 0.85 ? 'warning' : 'critical',
              tooltip: { title: 'Cobertura alimentar', description: term('coverage'), footnote: 'Produção mundial de alimento contra consumo mundial' }
            })
          : null,
        m.pricePressure !== null
          ? stat({
              label: 'Pressão de preços', value: formatPercent(m.pricePressure), icon: 'coin',
              status: m.pricePressure >= 1.4 ? 'critical' : m.pricePressure >= 1.15 ? 'warning' : 'positive',
              tooltip: { title: 'Pressão de preços', value: formatPercent(m.pricePressure), description: term('pricePressure') }
            })
          : null,
        m.unemployment !== null
          ? stat({
              label: 'Desemprego', value: formatPercent(m.unemployment), icon: 'population',
              status: m.unemployment >= 0.25 ? 'critical' : m.unemployment > 0.08 ? 'warning' : 'positive',
              tooltip: {
                title: 'Desemprego agregado',
                value: formatPercent(m.unemployment),
                description: '(adultos urbanos − postos ocupados) ÷ adultos urbanos.',
                rows: [
                  { label: 'Adultos urbanos', value: `${m.workers}` },
                  { label: 'Postos', value: `${m.jobs}` },
                  { label: 'Ocupados', value: `${m.filled}` }
                ]
              }
            })
          : null
      ].filter(Boolean) as HTMLElement[])
    ]),

    (m.gainers.length || m.decliners.length) ? buildShocks(m, host) : null,
    m.shortages.length ? buildShortages(m, host) : null,
    m.surpluses.length ? buildSurpluses(m, host) : null,

    !m.goods.some(p => p.supply > 0 || p.demand > 0)
      ? emptyState({
          icon: 'economy',
          title: 'Nenhum ano econômico fechado',
          hint: 'Os livros contábeis só registram um ano quando ele termina. Avance o tempo para que produção, consumo e preços tenham o que relatar.'
        })
      : null
  ];
}

/** The short list of what is wrong, each row navigable to the thing that is wrong. */
function buildAlerts(alerts: EconomicAlert[], host: EconomyScreenHost): HTMLElement {
  return panel({
    title: 'Alertas econômicos',
    icon: 'alert',
    subtitle: `${alerts.length} ranqueado(s) por gravidade`,
    class: 'ae-econ-critical'
  }, alerts.map(alert => el('div', { class: `ae-econ-alert ae-econ-alert-${alert.severity}` }, [
    icon(alert.icon, { size: 16, class: 'ae-econ-alert-icon' }),
    el('div', { class: 'ae-econ-alert-text' }, [
      el('span', { class: 'ae-econ-alert-label', text: alert.label }),
      el('span', { class: 'ae-econ-alert-detail', text: alert.detail })
    ]),
    el('div', { class: 'ae-econ-alert-actions' }, [
      alert.good
        ? miniButton('crate', GOODS[alert.good]?.name ?? alert.good, 'Abrir a análise deste bem.', () => host.inspectGood(alert.good!))
        : null,
      alert.cityId
        ? miniButton('city', 'Dossiê da cidade', 'Abre o dossiê do assentamento.', () => host.openCity(alert.cityId!))
        : null,
      alert.kingdomId
        ? miniButton('kingdom', 'Dossiê do reino', 'Abre o dossiê do reino.', () => host.openRealm(alert.kingdomId!))
        : null,
      alert.at
        ? miniButton('map', 'Ir até lá', 'Fecha a tela e centraliza a câmera.', () => host.goToMap(alert.at!.x, alert.at!.y))
        : null
    ])
  ])));
}

/**
 * The sharpest price moves, in both directions.
 *
 * Deliberately *not* coloured by sign. A falling timber price is bad for the realm
 * that sells timber and good for the one that builds ships, and the world screen
 * has no side to be on — so the arrow shows direction and the colour stays
 * neutral. Whose news it is becomes clear on the realm and city tabs.
 */
function buildShocks(m: EconomyMetrics, host: EconomyScreenHost): HTMLElement {
  const column = (title: string, list: WorldGoodPosition[], empty: string) =>
    section(title, [
      list.length
        ? rowList(list.map(p => statRow({
            label: p.name,
            value: signed(p.priceChange),
            icon: 'coin',
            status: priceStatus(p.priceChange, 'neutral'),
            onClick: () => host.inspectGood(p.good),
            tooltip: {
              title: p.name,
              value: p.price.toFixed(1),
              description: `Preço de referência ${p.basePrice.toFixed(1)}. Clique para ver por que mudou.`,
              rows: [
                { label: 'Variação no ano', value: signed(p.priceChange) },
                { label: 'Contra a base', value: signed(p.priceIndex - 1) },
                { label: 'Oferta', value: p.supply.toFixed(1) },
                { label: 'Demanda', value: p.demand.toFixed(1) }
              ]
            }
          })))
        : el('p', { class: 'ae-econ-note', text: empty })
    ], { icon: 'statistics' });

  return panel({
    title: 'Choques de mercado',
    icon: 'statistics',
    subtitle: 'Variação contra o ano fechado anterior'
  }, [
    el('div', { class: 'ae-econ-two-up' }, [
      column('Maiores altas', m.gainers, 'Nenhuma alta relevante.'),
      column('Maiores quedas', m.decliners, 'Nenhuma queda relevante.')
    ])
  ]);
}

function buildShortages(m: EconomyMetrics, host: EconomyScreenHost): HTMLElement {
  return panel({
    title: 'Escassez mundial',
    icon: 'alert',
    subtitle: 'O mundo consome mais do que produz',
    padded: false
  }, [
    table<WorldGoodPosition>({
      columns: [
        goodColumn(host),
        numColumn('supply', 'Oferta', p => p.supply, term('supply')),
        numColumn('demand', 'Demanda', p => p.demand, term('demand')),
        {
          key: 'deficit', header: 'Déficit', align: 'right', width: '92px',
          cell: p => el('span', { class: 'ae-econ-deficit', text: p.balance.toFixed(1) }),
          sortValue: p => p.balance,
          tooltip: { title: 'Déficit', description: term('deficit') }
        },
        numColumn('stock', 'Estoque', p => p.stock),
        numColumn('price', 'Preço', p => p.price),
        priceChangeColumn(),
        {
          key: 'cover', header: 'Cobertura', align: 'right', width: '96px',
          cell: p => (p.coverage === null ? '—' : formatPercent(p.coverage)),
          sortValue: p => p.coverage ?? 99,
          tooltip: { title: 'Cobertura', description: term('coverage') }
        }
      ],
      rows: m.shortages,
      rowKey: p => p.good,
      sortBy: 'cover', sortDir: 'asc',
      onRowClick: p => host.inspectGood(p.good),
      status: p => coverageStatus(p.coverage),
      rowTooltip: p => goodTooltip(p)
    })
  ]);
}

function buildSurpluses(m: EconomyMetrics, host: EconomyScreenHost): HTMLElement {
  return panel({
    title: 'Excedente mundial',
    icon: 'crate',
    subtitle: 'Produção acima do consumo — onde há o que vender',
    padded: false
  }, [
    table<WorldGoodPosition>({
      columns: [
        goodColumn(host),
        numColumn('supply', 'Oferta', p => p.supply, term('supply')),
        numColumn('demand', 'Demanda', p => p.demand, term('demand')),
        {
          key: 'surplus', header: 'Excedente', align: 'right', width: '96px',
          cell: p => `+${p.balance.toFixed(1)}`,
          sortValue: p => p.balance
        },
        numColumn('stock', 'Estoque', p => p.stock),
        numColumn('price', 'Preço', p => p.price)
      ],
      rows: m.surpluses,
      rowKey: p => p.good,
      sortBy: 'surplus',
      onRowClick: p => host.inspectGood(p.good),
      rowTooltip: p => goodTooltip(p)
    })
  ]);
}

// ============================ GOODS ============================

export function buildGoods(
  m: EconomyMetrics,
  host: EconomyScreenHost,
  state: { category: GoodCategory; query: string }
): Child[] {
  const query = state.query.trim().toLowerCase();
  const rows = filterGoods(m.goods, state.category)
    .filter(p => !query || p.name.toLowerCase().includes(query) || p.good.includes(query));

  return [
    panel({
      title: 'Todos os bens',
      icon: 'crate',
      subtitle: `${rows.length} de ${m.goods.length}`,
      padded: false,
      actions: [
        el('div', { class: 'ae-econ-filters' }, CATEGORY_FILTERS.map(f =>
          el('button', {
            class: `ae-econ-filter ${state.category === f.id ? 'is-active' : ''}`,
            attrs: { type: 'button' },
            text: f.label,
            on: { click: () => host.setCategory(f.id) }
          })
        ))
      ]
    }, [
      rows.length
        ? table<WorldGoodPosition>({
            columns: [
              goodColumn(host),
              numColumn('price', 'Preço', p => p.price),
              priceChangeColumn(),
              numColumn('supply', 'Oferta', p => p.supply, term('supply')),
              numColumn('demand', 'Demanda', p => p.demand, term('demand')),
              numColumn('stock', 'Estoque', p => p.stock),
              numColumn('imported', 'Import.', p => p.imported),
              numColumn('exported', 'Export.', p => p.exported),
              {
                key: 'balance', header: 'Saldo', align: 'right', width: '92px',
                // Neutral sentiment: a world surplus is not good or bad in itself.
                cell: p => trendIndicator({
                  delta: p.balance, sentiment: 'neutral', compact: true,
                  text: `${p.balance >= 0 ? '+' : '−'}${Math.abs(p.balance).toFixed(1)}`
                }),
                sortValue: p => p.balance
              },
              {
                key: 'strategic', header: 'Estratégico', width: '104px',
                cell: p => (p.strategic
                  ? badge('Estratégico', { size: 'sm', status: 'warning', variant: 'outline', icon: 'pickaxe' })
                  : el('span', { class: 'ae-muted', text: '—' })),
                sortValue: p => (p.strategic ? 0 : 1)
              }
            ],
            rows,
            rowKey: p => p.good,
            sortBy: 'price',
            onRowClick: p => host.inspectGood(p.good),
            status: p => coverageStatus(p.coverage),
            rowTooltip: p => goodTooltip(p)
          })
        : emptyState({
            icon: 'search',
            title: 'Nenhum bem corresponde',
            hint: query ? `Nada encontrado para "${state.query}".` : 'Nenhum bem nesta categoria.',
            compact: true
          })
    ])
  ];
}

// ============================ GOOD INSPECTOR ============================

/**
 * One good, in full: price and why it moved, the chain around it, who makes and
 * burns it, and — for anything that comes out of the ground — what is left of it.
 */
export function buildGoodInspector(good: GoodId, m: EconomyMetrics, host: EconomyScreenHost): Child[] {
  const position = m.goods.find(p => p.good === good);
  const def = GOODS[good];
  if (!position || !def) {
    return [emptyState({ icon: 'crate', title: 'Bem desconhecido', hint: 'Este bem não existe no registro.' })];
  }

  const producers = topFlows(m, good, 'produced');
  const consumers = topFlows(m, good, 'consumed');
  const routes = m.routes.filter(r => r.route.good === good);
  const reserve = m.reserves.find(r => r.good === good) ?? null;

  return [
    el('div', { class: 'ae-econ-inspector-head' }, [
      button('Voltar aos bens', () => host.closeInspector(), { variant: 'ghost', size: 'sm', icon: 'close' }),
      button('Ver no mapa', () => host.showGoodOnMap(good), { variant: 'secondary', size: 'sm', icon: 'map' }),
      badgeRow([
        badge(def.kind === 'crafted' ? 'Manufaturado' : 'Bruto', { size: 'sm', variant: 'outline' }),
        badge(tierLabel(position.tier), { size: 'sm', variant: 'outline' }),
        position.strategic ? badge('Estratégico', { size: 'sm', status: 'warning', icon: 'pickaxe' }) : null,
        def.requiresTech ? badge(`Requer ${def.requiresTech}`, { size: 'sm', variant: 'outline', icon: 'technology' }) : null
      ])
    ]),

    panel({ title: def.name, icon: 'crate', subtitle: def.description }, [
      statGrid([
        stat({
          label: 'Preço atual', value: position.price.toFixed(1), icon: 'coin',
          tooltip: {
            title: 'Preço mundial',
            value: position.price.toFixed(2),
            description: 'Preço de referência do mercado mundial. Cada reino tem o seu próprio, ancorado neste.'
          }
        }),
        stat({
          label: 'Referência', value: position.basePrice.toFixed(1), icon: 'coin',
          tooltip: { title: 'Preço de referência', description: 'Preço base do bem, antes de qualquer efeito de oferta e demanda. O mercado orbita em torno dele.' }
        }),
        stat({
          label: 'Variação no ano', value: signed(position.priceChange), icon: 'statistics',
          tooltip: { title: 'Variação', description: 'Contra o preço do ano fechado anterior.' }
        }),
        stat({
          label: 'Oferta', value: position.supply.toFixed(1), icon: 'industry',
          tooltip: { title: 'Oferta', description: term('supply') }
        }),
        stat({
          label: 'Demanda', value: position.demand.toFixed(1), icon: 'population',
          tooltip: { title: 'Demanda', description: term('demand') }
        }),
        stat({
          label: 'Estoque mundial', value: formatCompact(position.stock), icon: 'crate',
          tooltip: position.yearsOfStock !== null
            ? {
                title: 'Estoque mundial',
                value: formatFull(Math.round(position.stock)),
                description: 'Somado em todos os assentamentos.',
                rows: [{ label: 'Cobre', value: `${position.yearsOfStock.toFixed(1)} ano(s) de consumo` }]
              }
            : { title: 'Estoque mundial', description: 'Somado em todos os assentamentos. Nada consome este bem, então não há ritmo de consumo para medir.' }
        }),
        stat({ label: 'Importado', value: position.imported.toFixed(1), icon: 'route' }),
        stat({ label: 'Exportado', value: position.exported.toFixed(1), icon: 'route' })
      ]),
      position.coverage !== null
        ? progressBar({
            label: 'Cobertura da demanda',
            value: Math.min(1, position.coverage),
            valueText: formatPercent(position.coverage),
            status: coverageStatus(position.coverage) ?? 'neutral',
            tooltip: { title: 'Cobertura', value: formatPercent(position.coverage), description: term('coverage') }
          })
        : null
    ]),

    buildPriceHistory(position, host),
    buildWhyPrice(position, m, host),
    buildProductionChainPreview(good, m, host),
    buildInputsOutputs(good, m, host),

    el('div', { class: 'ae-econ-two-up' }, [
      buildFlowList('Maiores produtores', producers, 'industry', host, 'Ninguém produz este bem.'),
      buildFlowList('Maiores consumidores', consumers, 'population', host, 'Ninguém consome este bem.')
    ]),

    buildImporterExporterPanel(good, m, host),
    reserve ? buildReservePanel(reserve, host) : null,
    buildRoutesPanel(routes, host, `Rotas de ${def.name}`, 'Nenhuma rota transporta este bem.'),
    buildLocalPricePanel(good, position, m, host)
  ];
}

function tierLabel(tier: WorldGoodPosition['tier']): string {
  return { common: 'Comum', regional: 'Regional', strategic: 'Raro' }[tier];
}

/**
 * The price series the market itself keeps.
 *
 * Drawn as inline SVG from `WorldMarket.priceHistory`, which persists across
 * saves. No interpolation and no synthetic points: a world two years old draws
 * two points, and the caption says how many years it is looking at.
 */
function buildPriceHistory(position: WorldGoodPosition, host: EconomyScreenHost): HTMLElement {
  const full = position.history;
  if (full.length < 2) {
    return panel({ title: 'Histórico de preço', icon: 'statistics' }, [
      emptyState({
        icon: 'statistics',
        title: 'Histórico insuficiente',
        hint: 'O mercado registra um ponto por ano fechado. Ainda não há dois para traçar uma linha.',
        compact: true
      })
    ]);
  }

  const range = host.priceRange;
  const window = range === 'recent' ? 12 : range === 'medium' ? 40 : full.length;
  const series = full.slice(Math.max(0, full.length - window));

  return panel({
    title: 'Histórico de preço',
    icon: 'statistics',
    subtitle: `${series.length} ano(s) registrado(s) de ${full.length}`,
    actions: [
      el('div', { class: 'ae-econ-filters' }, ([
        { id: 'recent', label: 'Recente' },
        { id: 'medium', label: 'Médio' },
        { id: 'long', label: 'Longo' }
      ] as const).map(r =>
        el('button', {
          class: `ae-econ-filter ${range === r.id ? 'is-active' : ''}`,
          attrs: { type: 'button' },
          text: r.label,
          // Only offer a range the history can actually fill.
          on: { click: () => host.setPriceRange(r.id) }
        })
      ))
    ]
  }, [sparkline(series, position.basePrice)]);
}

/** A price line with the base price marked, in inline SVG. */
function sparkline(series: number[], basePrice: number): HTMLElement {
  const W = 600, H = 140, PAD = 10;
  const min = Math.min(...series, basePrice);
  const max = Math.max(...series, basePrice);
  const span = max - min;
  const xAt = (i: number) => PAD + (i / Math.max(1, series.length - 1)) * (W - PAD * 2);
  // A price that has never moved has no range to plot against. Drawing it against
  // a fabricated span would push a flat line to the floor of the chart and imply
  // a collapse; it belongs on the centre line instead.
  const yAt = (v: number) => (span <= 0 ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2));

  const line = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
  const area = `${line} L${xAt(series.length - 1).toFixed(1)},${H - PAD} L${xAt(0).toFixed(1)},${H - PAD} Z`;
  const baseY = yAt(basePrice).toFixed(1);

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="ae-econ-chart" role="img"
         aria-label="Histórico de preço, ${series.length} anos">
      <path d="${area}" class="ae-econ-chart-area" />
      <line x1="${PAD}" y1="${baseY}" x2="${W - PAD}" y2="${baseY}" class="ae-econ-chart-base" />
      <path d="${line}" class="ae-econ-chart-line" />
      <circle cx="${xAt(series.length - 1).toFixed(1)}" cy="${yAt(series[series.length - 1]).toFixed(1)}"
              r="3" class="ae-econ-chart-dot" vector-effect="non-scaling-stroke" />
    </svg>`;

  const wrap = el('div', { class: 'ae-econ-chart-wrap' });
  wrap.innerHTML = svg;
  wrap.appendChild(el('div', { class: 'ae-econ-chart-legend' }, [
    legendItem('ae-econ-legend-line', `Preço · agora ${series[series.length - 1].toFixed(1)}`),
    legendItem('ae-econ-legend-base', `Referência ${basePrice.toFixed(1)}`),
    el('span', {
      class: 'ae-econ-chart-range',
      text: span <= 0 ? 'sem variação registrada' : `mín ${min.toFixed(1)} · máx ${max.toFixed(1)}`
    })
  ]));
  return wrap;
}

function legendItem(swatch: string, label: string): HTMLElement {
  return el('span', { class: 'ae-econ-legend-item' }, [
    el('span', { class: `ae-econ-legend-swatch ${swatch}` }),
    el('span', { text: label })
  ]);
}

/**
 * Why the price is moving — the section this whole screen is for.
 *
 * Each factor is a measured figure, and the mechanism is stated once so the
 * factors read as evidence rather than as assertion. A good with nothing recorded
 * about it says "insufficient data" instead of inventing a cause.
 */
function buildWhyPrice(position: WorldGoodPosition, m: EconomyMetrics, host: EconomyScreenHost): HTMLElement {
  const explanation = explainPrice(position, m);

  if (explanation.insufficient) {
    return panel({ title: 'Por que o preço está mudando?', icon: 'search' }, [
      emptyState({
        icon: 'search',
        title: 'Dados insuficientes',
        hint: 'Nada produziu, consumiu, estocou nem transportou este bem. Sem fluxos registrados não há causa que se possa apontar.',
        compact: true
      })
    ]);
  }

  return panel({
    title: 'Por que o preço está mudando?',
    icon: 'search',
    subtitle: `${position.name} ${signed(position.priceChange)} no último ano`
  }, [
    el('p', { class: 'ae-econ-note', text: explanation.mechanism }),
    divider(),
    ...explanation.factors.map(factor => {
      const clickable = Boolean(factor.good);
      const node = el(clickable ? 'button' : 'div', {
        class: `ae-econ-factor${clickable ? ' ae-econ-factor-live' : ''}`,
        attrs: clickable ? { type: 'button' } : {},
        on: clickable ? { click: () => host.inspectGood(factor.good!) } : undefined
      }, [
        el('div', { class: 'ae-econ-factor-text' }, [
          el('span', { class: 'ae-econ-factor-label', text: factor.label }),
          el('span', { class: 'ae-econ-factor-detail', text: factor.detail })
        ]),
        factor.delta !== null
          ? trendIndicator({ delta: factor.delta, sentiment: 'neutral', compact: true, text: signed(factor.delta) })
          : el('span', { class: 'ae-muted', text: '—' })
      ]);

      return withTooltip(node, {
        title: factor.label,
        description: factor.detail,
        footnote: clickable ? `Clique para abrir ${GOODS[factor.good!]?.name ?? factor.good}` : undefined
      });
    })
  ]);
}

/**
 * The recipe graph around one good, drawn as columns.
 *
 * Node colour is the world position of that good — green in surplus, amber tight,
 * red short — so a chain shows *where* it is broken, not only what it contains.
 */
export function buildProductionChainPreview(
  good: GoodId,
  m: EconomyMetrics,
  host: Pick<EconomyScreenHost, 'inspectGood'>
): HTMLElement | null {
  const { upstream, node, downstream } = chainAround(good);
  if (!upstream.length && !downstream.length) return null;

  const chainNodeEl = (id: GoodId, caption?: string) => {
    const position = m.goods.find(p => p.good === id);
    const status = coverageStatus(position?.coverage ?? null);
    const box = el('button', {
      class: `ae-econ-node ae-econ-node-${status ?? 'unknown'}${id === good ? ' is-focus' : ''}`,
      attrs: { type: 'button' },
      on: { click: () => host.inspectGood(id) }
    }, [
      el('span', { class: 'ae-econ-node-name', text: GOODS[id]?.name ?? id }),
      caption ? el('span', { class: 'ae-econ-node-caption', text: caption }) : null,
      position
        ? el('span', { class: 'ae-econ-node-figure', text: position.coverage === null ? '—' : formatPercent(position.coverage) })
        : null
    ]);

    return withTooltip(box, {
      title: GOODS[id]?.name ?? id,
      value: position ? position.price.toFixed(1) : undefined,
      description: position
        ? position.coverage === null
          ? 'Nada consome este bem, então não há cobertura a medir.'
          : `Cobertura de ${formatPercent(position.coverage)}: ${position.supply.toFixed(1)} produzido contra ${position.demand.toFixed(1)} consumido.`
        : 'Sem posição registrada.',
      footnote: 'Clique para abrir este bem'
    });
  };

  return panel({
    title: 'Cadeia de produção',
    icon: 'industry',
    subtitle: 'Cor indica a posição mundial de cada elo: verde sobra, âmbar aperta, vermelho falta'
  }, [
    el('div', { class: 'ae-econ-chain' }, [
      upstream.length
        ? el('div', { class: 'ae-econ-chain-col' }, [
            el('span', { class: 'ae-econ-chain-title', text: 'Insumos' }),
            ...upstream.map(u => chainNodeEl(u.good, `${node.inputs.find(i => i.good === u.good)?.qty ?? ''} por ciclo`))
          ])
        : null,
      upstream.length ? el('span', { class: 'ae-econ-chain-arrow', text: '→' }) : null,
      el('div', { class: 'ae-econ-chain-col' }, [
        el('span', { class: 'ae-econ-chain-title', text: 'Este bem' }),
        chainNodeEl(good)
      ]),
      downstream.length ? el('span', { class: 'ae-econ-chain-arrow', text: '→' }) : null,
      downstream.length
        ? el('div', { class: 'ae-econ-chain-col' }, [
            el('span', { class: 'ae-econ-chain-title', text: 'Alimenta' }),
            ...downstream.map(d => chainNodeEl(d.good))
          ])
        : null
    ])
  ]);
}

/** Inputs with their availability and price; outputs with theirs. */
function buildInputsOutputs(good: GoodId, m: EconomyMetrics, host: EconomyScreenHost): HTMLElement | null {
  const { node, downstream } = chainAround(good);
  if (!node.inputs.length && !downstream.length) return null;

  const inputRow = (input: { good: GoodId; qty: number }) => {
    const position = m.goods.find(p => p.good === input.good);
    return statRow({
      label: GOODS[input.good]?.name ?? input.good,
      value: `${input.qty}`,
      unit: position ? `disp. ${formatCompact(position.stock)} · ${position.price.toFixed(1)}` : undefined,
      icon: 'crate',
      status: coverageStatus(position?.coverage ?? null),
      onClick: () => host.inspectGood(input.good),
      tooltip: {
        title: GOODS[input.good]?.name ?? input.good,
        value: `${input.qty} por ciclo`,
        description: 'Quantidade que a receita consome para produzir uma unidade.',
        rows: position
          ? [
              { label: 'Estoque mundial', value: formatCompact(position.stock) },
              { label: 'Preço', value: position.price.toFixed(1) },
              { label: 'Cobertura', value: position.coverage === null ? '—' : formatPercent(position.coverage) }
            ]
          : undefined
      }
    });
  };

  return panel({ title: 'Insumos e produtos', icon: 'crate' }, [
    node.inputs.length
      ? section('Insumos necessários', [rowList(node.inputs.map(inputRow))], { icon: 'crate', hint: 'por ciclo' })
      : null,
    downstream.length
      ? section('Entra na produção de', [
          rowList(downstream.map(d => {
            const position = m.goods.find(p => p.good === d.good);
            const qty = GOODS[d.good]?.recipe?.[good];
            return statRow({
              label: GOODS[d.good]?.name ?? d.good,
              value: qty !== undefined ? `${qty}` : '—',
              unit: position ? position.price.toFixed(1) : undefined,
              icon: 'industry',
              status: coverageStatus(position?.coverage ?? null),
              onClick: () => host.inspectGood(d.good),
              tooltip: {
                title: GOODS[d.good]?.name ?? d.good,
                description: qty !== undefined
                  ? `A receita consome ${qty} de ${GOODS[good]?.name ?? good} por unidade.`
                  : undefined
              }
            });
          }))
        ], { icon: 'industry' })
      : null
  ]);
}

/** Producers or consumers of one good, by share of the world total. */
function buildFlowList(
  title: string,
  entries: { city: CityEconomy; amount: number; share: number }[],
  iconName: string,
  host: EconomyScreenHost,
  empty: string
): HTMLElement {
  return panel({ title, icon: iconName, subtitle: entries.length ? `${entries.length} maiores` : undefined }, [
    entries.length
      ? rowList(entries.map((entry, i) => el('div', { class: 'ae-row' }, [
          el('span', { class: 'ae-econ-rank', text: `${i + 1}` }),
          el('span', { class: 'ae-row-label' }, [
            objectLink(
              { kind: 'city', id: entry.city.id, name: entry.city.name, accent: entry.city.kingdomColor ?? undefined },
              { showIcon: false, onOpen: () => host.openCity(entry.city.id) }
            ),
            entry.city.kingdomId
              ? el('span', { class: 'ae-row-unit' }, [
                  objectLink(
                    { kind: 'kingdom', id: entry.city.kingdomId, name: entry.city.kingdomName ?? '', accent: entry.city.kingdomColor ?? undefined },
                    { showIcon: false, onOpen: () => host.openRealm(entry.city.kingdomId!) }
                  )
                ])
              : null
          ]),
          el('span', { class: 'ae-row-value' }, [
            el('span', { class: 'ae-row-figure', text: entry.amount.toFixed(1) }),
            el('span', { class: 'ae-row-unit', text: formatPercent(entry.share) })
          ])
        ])))
      : emptyState({ icon: iconName, title: empty, hint: '', compact: true })
  ]);
}

/** Realms by net position in one good — who depends on whom. */
function buildImporterExporterPanel(good: GoodId, m: EconomyMetrics, host: EconomyScreenHost): HTMLElement | null {
  interface Row { realm: RealmEconomy; imported: number; exported: number; net: number; dependency: number | null }
  const rows: Row[] = [];

  for (const realm of m.realms) {
    let imported = 0, exported = 0, used = 0;
    for (const city of m.cities) {
      if (city.kingdomId !== realm.id) continue;
      // The city summaries carry totals across all goods, so the per-good split
      // comes from the realm's own dependency list plus the route book below.
      void city;
    }
    const dep = realm.dependencies.find(d => d.good === good);
    if (dep) { imported = dep.imported; used = dep.used; }
    for (const route of m.routes) {
      if (route.route.good !== good) continue;
      if (route.fromKingdom?.id === realm.id) exported += route.route.volume;
      if (route.toKingdom?.id === realm.id && !dep) imported += route.route.volume;
    }
    if (imported === 0 && exported === 0) continue;
    rows.push({
      realm, imported, exported,
      net: exported - imported,
      dependency: used > 0 ? Math.min(1, imported / used) : null
    });
  }

  if (!rows.length) return null;

  return panel({
    title: 'Importadores e exportadores',
    icon: 'trade-route',
    subtitle: 'Posição líquida de cada reino neste bem',
    padded: false
  }, [
    table<Row>({
      columns: [
        {
          key: 'realm', header: 'Reino',
          cell: r => objectLink(
            { kind: 'kingdom', id: r.realm.id, name: r.realm.name, accent: r.realm.color },
            { showIcon: false, onOpen: () => host.openRealm(r.realm.id) }
          ),
          sortValue: r => r.realm.name
        },
        { key: 'imported', header: 'Importa', align: 'right', width: '92px', cell: r => r.imported.toFixed(1), sortValue: r => r.imported },
        { key: 'exported', header: 'Exporta', align: 'right', width: '92px', cell: r => r.exported.toFixed(1), sortValue: r => r.exported },
        {
          key: 'net', header: 'Posição', align: 'right', width: '104px',
          // Sentiment stated: for a realm, exporting more than it imports is the
          // good side of this figure.
          cell: r => trendIndicator({
            delta: r.net, sentiment: 'higher-better', compact: true,
            text: `${r.net >= 0 ? '+' : '−'}${Math.abs(r.net).toFixed(1)}`
          }),
          sortValue: r => r.net
        },
        {
          key: 'dep', header: 'Dependência', align: 'right', width: '112px',
          cell: r => (r.dependency === null ? '—' : formatPercent(r.dependency)),
          sortValue: r => r.dependency ?? -1,
          tooltip: { title: 'Dependência', description: term('dependency') }
        }
      ],
      rows,
      rowKey: r => r.realm.id,
      sortBy: 'net',
      onRowClick: r => host.openRealm(r.realm.id),
      status: r => (r.dependency !== null && r.dependency >= 0.75 ? 'warning' : undefined)
    })
  ]);
}

/** What is left in the ground, and who is sitting on it. */
function buildReservePanel(
  reserve: NonNullable<EconomyMetrics['reserves'][number]>,
  host: EconomyScreenHost
): HTMLElement {
  return panel({
    title: 'Reservas conhecidas',
    icon: 'pickaxe',
    subtitle: `${reserve.deposits} depósito(s) no mapa`
  }, [
    statGrid([
      stat({
        label: 'Restante', value: formatCompact(reserve.remaining), icon: 'pickaxe',
        status: reserve.max > 0 && reserve.remaining / reserve.max < 0.25 ? 'critical' : undefined,
        tooltip: {
          title: 'Reserva restante',
          value: formatFull(Math.round(reserve.remaining)),
          description: 'Somada nos depósitos que o mapa contém. Conta apenas o que ainda está no solo.'
        }
      }),
      stat({ label: 'Capacidade original', value: formatCompact(reserve.max), icon: 'pickaxe' }),
      stat({
        label: 'Esgotados', value: `${reserve.exhausted} / ${reserve.deposits}`, icon: 'warning',
        status: reserve.exhausted > 0 ? 'warning' : 'positive'
      })
    ]),
    reserve.max > 0
      ? progressBar({
          label: 'Fração ainda no solo',
          value: reserve.remaining / reserve.max,
          valueText: formatPercent(reserve.remaining / reserve.max),
          status: reserve.remaining / reserve.max < 0.25 ? 'critical' : reserve.remaining / reserve.max < 0.5 ? 'warning' : 'positive'
        })
      : null,
    reserve.byRealm.length
      ? el('div', {}, [
          divider(),
          section('Sob controle de', [
            rowList(reserve.byRealm.slice(0, 6).map(entry => el('div', { class: 'ae-row' }, [
              icon('kingdom', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label' }, [
                objectLink(
                  { kind: 'kingdom', id: entry.kingdomId, name: entry.name, accent: entry.color },
                  { showIcon: false, onOpen: () => host.openRealm(entry.kingdomId) }
                )
              ]),
              el('span', { class: 'ae-row-value' }, [
                el('span', { class: 'ae-row-figure', text: formatCompact(entry.remaining) }),
                el('span', { class: 'ae-row-unit', text: formatPercent(entry.share) })
              ])
            ])))
          ], {
            icon: 'kingdom',
            hint: 'apenas território reivindicado'
          })
        ])
      : el('p', { class: 'ae-econ-note', text: 'Nenhum depósito está sob território reivindicado por um reino.' })
  ]);
}

/** Local prices per realm — the reason trade exists at all. */
function buildLocalPricePanel(
  good: GoodId,
  position: WorldGoodPosition,
  m: EconomyMetrics,
  host: EconomyScreenHost
): HTMLElement | null {
  if (m.realms.length < 2) return null;

  interface Row { realm: RealmEconomy; price: number; gap: number }
  const rows: Row[] = m.realms.map(realm => {
    // The realm's own market, anchored to the world price. Read live, since the
    // divergence is the whole point.
    const price = host.localPrice(realm.id, good, position.price);
    return { realm, price, gap: position.price > 0 ? (price - position.price) / position.price : 0 };
  });

  return panel({
    title: 'Preço por reino',
    icon: 'coin',
    subtitle: 'Cada reino tem o seu preço, ancorado no mundial e afastado pela escassez local',
    padded: false
  }, [
    table<Row>({
      columns: [
        {
          key: 'realm', header: 'Reino',
          cell: r => objectLink(
            { kind: 'kingdom', id: r.realm.id, name: r.realm.name, accent: r.realm.color },
            { showIcon: false, onOpen: () => host.openRealm(r.realm.id) }
          ),
          sortValue: r => r.realm.name
        },
        { key: 'price', header: 'Preço local', align: 'right', width: '104px', cell: r => r.price.toFixed(1), sortValue: r => r.price },
        {
          key: 'gap', header: 'vs. mundial', align: 'right', width: '112px',
          cell: r => trendIndicator({ delta: r.gap, sentiment: 'neutral', compact: true, text: signed(r.gap) }),
          sortValue: r => r.gap,
          tooltip: {
            title: 'Diferença contra o preço mundial',
            description: 'Abaixo do mundial: o reino tem o bem de sobra e é um vendedor natural. Acima: é um comprador.'
          }
        }
      ],
      rows,
      rowKey: r => r.realm.id,
      sortBy: 'price', sortDir: 'asc',
      onRowClick: r => host.openRealm(r.realm.id)
    })
  ]);
}

/** Producers or consumers of one good, ranked with their share of the world. */
function topFlows(
  m: EconomyMetrics,
  good: GoodId,
  which: 'produced' | 'consumed'
): { city: CityEconomy; amount: number; share: number }[] {
  const position = m.goods.find(p => p.good === good);
  const total = which === 'produced' ? position?.supply ?? 0 : position?.demand ?? 0;
  return m.cities
    .map(city => ({ city, amount: flowFor(m, city.id, good, which) }))
    .filter(entry => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)
    .map(entry => ({ ...entry, share: total > 0 ? entry.amount / total : 0 }));
}

// ============================ PRODUCTION ============================

export function buildProduction(m: EconomyMetrics, host: EconomyScreenHost): Child[] {
  if (!m.sectors.length) {
    return [emptyState({
      icon: 'industry',
      title: 'A produção industrial ainda não surgiu',
      hint: 'Nenhum assentamento ergueu construções produtivas. Setores aparecem quando existem oficinas, minas ou fazendas para compô-los.'
    })];
  }

  return [
    m.bottlenecks.length ? buildBottlenecks(m.bottlenecks, host) : null,

    panel({
      title: 'Setores',
      icon: 'industry',
      subtitle: `${m.sectors.length} setor(es) · capacidade é nominal, não produção efetiva`
    }, m.sectors.map(sector => buildSectorRow(sector, host))),

    buildNetwork(m, host)
  ];
}

function buildSectorRow(sector: SectorView, host: EconomyScreenHost): HTMLElement {
  return el('div', { class: 'ae-econ-sector' }, [
    el('div', { class: 'ae-econ-sector-head' }, [
      el('span', { class: 'ae-econ-sector-name', text: sector.label }),
      badgeRow([
        badge(`${sector.buildings} construção(ões)`, { size: 'sm', variant: 'outline', icon: 'building' }),
        sector.jobs > 0
          ? badge(`${sector.filled} / ${sector.jobs} postos`, {
              size: 'sm', variant: 'outline', icon: 'population',
              status: sector.filled >= sector.jobs * 0.8 ? 'positive' : sector.filled > 0 ? 'warning' : 'critical'
            })
          : null
      ])
    ]),
    statGrid([
      stat({
        label: 'Capacidade', value: sector.capacity.toFixed(1), icon: 'industry',
        tooltip: { title: 'Capacidade', description: term('capacity') }
      }),
      stat({ label: 'Produção', value: sector.actual.toFixed(1), icon: 'crate' }),
      sector.utilization !== null
        ? stat({
            label: 'Utilização', value: formatPercent(sector.utilization), icon: 'statistics',
            status: sector.utilization >= 0.8 ? 'positive' : sector.utilization >= 0.4 ? 'neutral' : 'warning',
            tooltip: { title: 'Utilização', value: formatPercent(sector.utilization), description: term('utilization') }
          })
        : null
    ].filter(Boolean) as HTMLElement[]),
    sector.utilization !== null
      ? progressBar({
          label: 'Uso da capacidade instalada',
          value: sector.utilization,
          valueText: `${sector.actual.toFixed(0)} de ${sector.capacity.toFixed(0)}`,
          status: sector.utilization >= 0.8 ? 'positive' : sector.utilization >= 0.4 ? 'neutral' : 'warning'
        })
      : null,
    sector.constraint
      ? el('div', { class: 'ae-econ-sector-constraint' }, [
          icon('warning', { size: 16 }),
          el('span', { text: 'Principal restrição: ' }),
          objectLink(
            { kind: 'good', id: sector.constraint.good, name: sector.constraint.label, status: 'warning' },
            { showIcon: false, onOpen: () => host.inspectGood(sector.constraint!.good) }
          )
        ])
      : null
  ]);
}

/** Blocked production, with the input that is blocking it and where. */
function buildBottlenecks(bottlenecks: BottleneckView[], host: EconomyScreenHost): HTMLElement {
  return panel({
    title: 'Gargalos de produção',
    icon: 'alert',
    subtitle: `${bottlenecks.length} identificado(s) a partir de receitas e estoques reais`,
    padded: false
  }, [
    table<BottleneckView>({
      columns: [
        {
          key: 'output', header: 'Indústria',
          cell: b => objectLink(
            { kind: 'good', id: b.output, name: GOODS[b.output]?.name ?? b.output },
            { showIcon: false, onOpen: () => host.inspectGood(b.output) }
          ),
          sortValue: b => GOODS[b.output]?.name ?? b.output
        },
        {
          key: 'where', header: 'Local',
          cell: b => objectLink(
            { kind: 'city', id: b.cityId, name: b.cityName },
            { showIcon: false, onOpen: () => host.openCity(b.cityId) }
          ),
          sortValue: b => b.cityName
        },
        {
          key: 'realm', header: 'Reino',
          cell: b => (b.kingdomId
            ? objectLink(
                { kind: 'kingdom', id: b.kingdomId, name: b.kingdomName ?? '' },
                { showIcon: false, onOpen: () => host.openRealm(b.kingdomId!) }
              )
            : el('span', { class: 'ae-muted', text: '—' })),
          sortValue: b => b.kingdomName ?? ''
        },
        {
          key: 'constraint', header: 'Restrição',
          cell: b => objectLink(
            { kind: 'good', id: b.constraint, name: GOODS[b.constraint]?.name ?? b.constraint, status: b.severity },
            { showIcon: false, onOpen: () => host.inspectGood(b.constraint) }
          ),
          sortValue: b => GOODS[b.constraint]?.name ?? b.constraint
        },
        {
          key: 'stock', header: 'Em estoque', align: 'right', width: '116px',
          cell: b => `${b.available.toFixed(1)} de ${b.required.toFixed(1)}`,
          sortValue: b => b.available / Math.max(0.01, b.required),
          tooltip: { title: 'Insumo disponível', description: 'Unidades em estoque contra o que a receita consome por ciclo.' }
        },
        {
          key: 'severity', header: 'Gravidade', width: '104px',
          cell: b => badge(b.severity === 'critical' ? 'Crítico' : 'Atenção', {
            size: 'sm', status: b.severity, variant: 'outline'
          }),
          sortValue: b => (b.severity === 'critical' ? 0 : 1)
        }
      ],
      rows: bottlenecks.slice(0, 25),
      rowKey: b => `${b.cityId}:${b.output}:${b.constraint}`,
      sortBy: 'severity',
      onRowClick: b => host.goToMap(b.x, b.y),
      status: b => b.severity,
      rowTooltip: b => ({
        title: `${GOODS[b.output]?.name ?? b.output} em ${b.cityName}`,
        description: `A receita precisa de ${b.required.toFixed(1)} de ${GOODS[b.constraint]?.name ?? b.constraint} por ciclo e a cidade tem ${b.available.toFixed(1)}.`,
        footnote: 'Clique para ir até a construção no mapa'
      })
    })
  ]);
}

/**
 * The production network, by depth.
 *
 * Raw materials on the left, each crafting step to its right, colour showing the
 * world position of every node. Not an editor — a map of where the economy is
 * tight, walkable by clicking.
 */
function buildNetwork(m: EconomyMetrics, host: EconomyScreenHost): HTMLElement {
  const tiers = new Map<number, WorldGoodPosition[]>();
  for (const position of m.goods) {
    if (position.supply === 0 && position.demand === 0 && position.stock === 0) continue;
    const depth = position.kind === 'raw' ? 0 : depthOf(position.good);
    const list = tiers.get(depth) ?? [];
    list.push(position);
    tiers.set(depth, list);
  }

  if (!tiers.size) {
    return panel({ title: 'Rede de produção', icon: 'industry' }, [
      emptyState({ icon: 'industry', title: 'Nada em circulação', hint: 'Nenhum bem foi produzido, consumido ou estocado.', compact: true })
    ]);
  }

  const label = (depth: number) => (depth === 0 ? 'Brutos' : depth === 1 ? 'Intermediários' : 'Avançados');

  return panel({
    title: 'Rede de produção',
    icon: 'industry',
    subtitle: 'Verde sobra · âmbar aperta · vermelho falta'
  }, [
    el('div', { class: 'ae-econ-network' }, [...tiers.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([depth, list]) => el('div', { class: 'ae-econ-network-tier' }, [
        el('span', { class: 'ae-econ-chain-title', text: label(depth) }),
        el('div', { class: 'ae-econ-network-nodes' }, list
          .sort((a, b) => (a.coverage ?? 9) - (b.coverage ?? 9))
          .map(position => withTooltip(
            el('button', {
              class: `ae-econ-node ae-econ-node-${coverageStatus(position.coverage) ?? 'unknown'}`,
              attrs: { type: 'button' },
              on: { click: () => host.inspectGood(position.good) }
            }, [
              el('span', { class: 'ae-econ-node-name', text: position.name }),
              el('span', {
                class: 'ae-econ-node-figure',
                text: position.coverage === null ? '—' : formatPercent(position.coverage)
              })
            ]),
            {
              title: position.name,
              value: position.price.toFixed(1),
              description: position.coverage === null
                ? 'Nada consome este bem, então não há cobertura a medir.'
                : `${position.supply.toFixed(1)} produzido contra ${position.demand.toFixed(1)} consumido.`,
              footnote: 'Clique para abrir'
            }
          )))
      ])))
  ]);
}

function depthOf(good: GoodId, seen: Set<GoodId> = new Set()): number {
  const recipe = GOODS[good]?.recipe;
  if (!recipe || seen.has(good)) return 0;
  seen.add(good);
  let deepest = 0;
  for (const input of Object.keys(recipe) as GoodId[]) deepest = Math.max(deepest, depthOf(input, seen));
  return deepest + 1;
}

// ============================ TRADE ============================

export function buildTrade(m: EconomyMetrics, host: EconomyScreenHost): Child[] {
  if (!m.routes.length) {
    return [
      panel({ title: 'Comércio', icon: 'trade-route' }, [
        emptyState({
          icon: 'trade-route',
          title: 'Nenhuma rota comercial ativa',
          hint: 'Uma rota nasce quando um reino tem excedente, outro tem escassez, e a margem cobre transporte e tarifa. Nenhuma dessas condições se juntou ainda.'
        })
      ])
    ];
  }

  const byKind = (kind: 'overland' | 'maritime') => m.routes.filter(r => r.kind === kind);
  const value = (list: RouteView[]) => list.reduce((sum, r) => sum + r.route.totalValue, 0);
  const railRoutes = m.routes.filter(r => r.railTiles > 0);

  return [
    panel({ title: 'Volume', icon: 'trade' }, [
      statGrid([
        stat({
          label: 'Volume no ano', value: formatCompact(m.tradeVolume), icon: 'trade',
          tooltip: { title: 'Volume de comércio', description: 'Valor movido em rotas neste ano.' }
        }),
        stat({ label: 'Terrestre', value: formatCompact(value(byKind('overland'))), unit: 'acumulado', icon: 'route' }),
        stat({ label: 'Marítimo', value: formatCompact(value(byKind('maritime'))), unit: 'acumulado', icon: 'route' }),
        stat({ label: 'Caravanas', value: `${m.caravans}`, icon: 'route' }),
        stat({ label: 'Navios', value: `${m.ships}`, icon: 'route' }),
        m.railTiles > 0
          ? stat({
              label: 'Carga ferroviária', value: formatCompact(m.railFreight), icon: 'crate',
              tooltip: {
                title: 'Carga ferroviária',
                description: 'Unidades entregues pela malha neste ano. A ferrovia move estoque entre cidades ligadas, em paralelo às rotas de comércio.',
                rows: [
                  { label: 'Trilhos', value: `${m.railTiles}` },
                  { label: 'Rotas com trilho no caminho', value: `${railRoutes.length}` }
                ]
              }
            })
          : null
      ].filter(Boolean) as HTMLElement[]),
      el('p', {
        class: 'ae-econ-note',
        text: 'Terrestre e marítimo somam o valor acumulado desde a abertura de cada rota. O volume do ano é o que a rede registrou neste ciclo.'
      })
    ]),

    buildRoutesPanel(m.routes, host, 'Rotas', 'Nenhuma rota.'),
    buildDependencyPanel(m, host)
  ];
}

/**
 * The route table, with the economics that make each route exist.
 *
 * Source price, transport, tariff and destination price are the four numbers that
 * decide whether a route is worth running, and transport comes from the same
 * function the simulation charges — not a second estimate.
 */
function buildRoutesPanel(
  routes: RouteView[],
  host: EconomyScreenHost,
  title: string,
  empty: string
): HTMLElement {
  return panel({
    title,
    icon: 'trade-route',
    subtitle: routes.length ? `${routes.length}` : undefined,
    padded: false
  }, [
    routes.length
      ? table<RouteView>({
          columns: [
            {
              key: 'good', header: 'Bem',
              cell: r => objectLink(
                { kind: 'good', id: r.route.good, name: GOODS[r.route.good]?.name ?? r.route.good },
                { showIcon: false, onOpen: () => host.inspectGood(r.route.good) }
              ),
              sortValue: r => GOODS[r.route.good]?.name ?? r.route.good
            },
            {
              key: 'from', header: 'Origem',
              cell: r => (r.fromCity
                ? objectLink({ kind: 'city', id: r.fromCity.id, name: r.fromCity.name }, { showIcon: false, onOpen: () => host.openCity(r.fromCity!.id) })
                : el('span', { class: 'ae-muted', text: '—' })),
              sortValue: r => r.fromCity?.name ?? ''
            },
            {
              key: 'to', header: 'Destino',
              cell: r => (r.toCity
                ? objectLink({ kind: 'city', id: r.toCity.id, name: r.toCity.name }, { showIcon: false, onOpen: () => host.openCity(r.toCity!.id) })
                : el('span', { class: 'ae-muted', text: '—' })),
              sortValue: r => r.toCity?.name ?? ''
            },
            {
              key: 'transport', header: 'Transporte', width: '108px',
              cell: r => badge(r.railTiles > 0 ? 'Ferrovia' : r.kind === 'maritime' ? 'Marítimo' : 'Terrestre', {
                size: 'sm', variant: 'outline', icon: 'route'
              }),
              sortValue: r => (r.railTiles > 0 ? 'a' : r.kind)
            },
            { key: 'volume', header: 'Volume', align: 'right', width: '92px', cell: r => r.route.volume.toFixed(1), sortValue: r => r.route.volume },
            {
              key: 'util', header: 'Utilização', align: 'right', width: '104px',
              cell: r => formatPercent(r.utilization),
              sortValue: r => r.utilization,
              tooltip: { title: 'Utilização', description: 'Volume movido contra o teto com que a rota foi aberta.' }
            },
            { key: 'value', header: 'Valor', align: 'right', width: '100px', cell: r => formatCompact(r.route.totalValue), sortValue: r => r.route.totalValue },
            {
              key: 'status', header: 'Situação', width: '148px',
              cell: r => badge(ROUTE_STATUS[r.status].label, { size: 'sm', status: ROUTE_STATUS[r.status].status, variant: 'outline' }),
              sortValue: r => r.status
            }
          ],
          rows: routes,
          rowKey: r => r.route.id,
          sortBy: 'value',
          onRowClick: r => host.selectRoute(r),
          status: r => (ROUTE_STATUS[r.status].status === 'positive' ? undefined : ROUTE_STATUS[r.status].status),
          rowTooltip: r => ({
            title: `${GOODS[r.route.good]?.name ?? r.route.good}: ${r.fromCity?.name ?? '?'} → ${r.toCity?.name ?? '?'}`,
            description: ROUTE_STATUS[r.status].explain,
            rows: [
              { label: 'Preço na origem', value: r.sourcePrice.toFixed(2) },
              { label: 'Custo de transporte', value: r.transportCost.toFixed(2) },
              { label: 'Tarifa', value: formatPercent(r.tariffRate) },
              { label: 'Preço no destino', value: r.destPrice.toFixed(2) },
              {
                label: 'Margem por unidade',
                value: r.marginPerUnit.toFixed(2),
                status: r.marginPerUnit > 0 ? 'positive' : 'warning'
              },
              { label: 'Distância', value: `${r.distance.toFixed(0)} blocos` },
              { label: 'Aberta no ano', value: `${r.route.establishedYear}` }
            ],
            footnote: 'Clique para abrir os detalhes desta rota'
          })
        })
      : emptyState({ icon: 'trade-route', title: empty, hint: '', compact: true })
  ]);
}

/**
 * One route in full, with its four prices and where to go next.
 *
 * This is where item 30 lives: the source price, the haul, the border, and what
 * the good is worth when it lands. If those four do not add up to a margin, the
 * route would not have been opened.
 */
export function buildRouteDetail(view: RouteView, host: EconomyScreenHost): Child[] {
  const good = GOODS[view.route.good];

  return [
    el('div', { class: 'ae-econ-inspector-head' }, [
      button('Voltar às rotas', () => host.closeRoute(), { variant: 'ghost', size: 'sm', icon: 'close' }),
      badgeRow([
        badge(ROUTE_STATUS[view.status].label, { size: 'sm', status: ROUTE_STATUS[view.status].status }),
        badge(view.kind === 'maritime' ? 'Marítima' : 'Terrestre', { size: 'sm', variant: 'outline', icon: 'route' }),
        view.railTiles > 0 ? badge(`${view.railTiles} blocos de trilho no caminho`, { size: 'sm', variant: 'outline', icon: 'route' }) : null
      ])
    ]),

    panel({
      title: `${good?.name ?? view.route.good}: ${view.fromCity?.name ?? '?'} → ${view.toCity?.name ?? '?'}`,
      icon: 'trade-route',
      subtitle: ROUTE_STATUS[view.status].explain,
      actions: [
        view.fromCity ? button('Ir à origem', () => host.goToMap(view.fromCity!.x, view.fromCity!.y), { variant: 'secondary', size: 'sm', icon: 'map' }) : null,
        view.toCity ? button('Ir ao destino', () => host.goToMap(view.toCity!.x, view.toCity!.y), { variant: 'secondary', size: 'sm', icon: 'map' }) : null,
        view.fromCity && view.toCity
          ? button('Centralizar rota', () => host.goToMap((view.fromCity!.x + view.toCity!.x) / 2, (view.fromCity!.y + view.toCity!.y) / 2, 0.9), {
              variant: 'ghost', size: 'sm', icon: 'route'
            })
          : null,
        button('Abrir o bem', () => host.inspectGood(view.route.good), { variant: 'ghost', size: 'sm', icon: 'crate' })
      ]
    }, [
      statGrid([
        stat({ label: 'Volume', value: view.route.volume.toFixed(1), unit: `de ${view.route.maxVolume.toFixed(0)}`, icon: 'crate' }),
        stat({
          label: 'Utilização', value: formatPercent(view.utilization), icon: 'statistics',
          status: view.utilization >= 0.99 ? 'warning' : 'positive'
        }),
        stat({ label: 'Valor acumulado', value: formatCompact(view.route.totalValue), icon: 'coin' }),
        stat({ label: 'Distância', value: `${view.distance.toFixed(0)}`, unit: 'blocos', icon: 'map' }),
        stat({
          label: 'Fator da via', value: formatPercent(view.capacityFactor), icon: 'route',
          status: view.capacityFactor < 0.75 ? 'warning' : 'positive',
          tooltip: {
            title: 'Capacidade da infraestrutura',
            value: formatPercent(view.capacityFactor),
            description: view.kind === 'maritime'
              ? 'Quanto os portos das duas pontas conseguem mover. Um porto destruído derruba isso.'
              : 'Quanto a via do caminho consegue mover. Uma trilha de terra move menos que uma estrada imperial, e o dano reduz ainda mais.'
          }
        }),
        stat({ label: 'Aberta no ano', value: `${view.route.establishedYear}`, icon: 'calendar' })
      ]),
      divider(),
      section('Economia da rota', [
        rowList([
          statRow({
            label: 'Preço na origem', value: view.sourcePrice.toFixed(2), icon: 'coin',
            tooltip: {
              title: 'Preço na origem',
              description: `Preço deste bem no mercado de ${view.fromKingdom?.name ?? 'origem'}. É o que o vendedor recebe.`
            }
          }),
          statRow({
            label: 'Custo de transporte', value: view.transportCost.toFixed(2), icon: 'route',
            status: 'warning',
            tooltip: { title: 'Custo de transporte', value: view.transportCost.toFixed(3), description: term('transportCost') }
          }),
          statRow({
            label: 'Tarifa', value: formatPercent(view.tariffRate), icon: 'tax',
            status: 'warning',
            tooltip: {
              title: 'Tarifa',
              value: formatPercent(view.tariffRate),
              description: 'Fração cobrada na fronteira. Um tratado de comércio a substitui pela alíquota negociada.'
            }
          }),
          statRow({
            label: 'Preço no destino', value: view.destPrice.toFixed(2), icon: 'coin',
            tooltip: {
              title: 'Preço no destino',
              description: `Preço deste bem no mercado de ${view.toKingdom?.name ?? 'destino'}. É o que o comprador paga.`
            }
          }),
          statRow({
            label: 'Margem por unidade', value: view.marginPerUnit.toFixed(2), icon: 'economy',
            status: view.marginPerUnit > 0 ? 'positive' : 'critical',
            tooltip: { title: 'Margem', value: view.marginPerUnit.toFixed(3), description: term('margin') }
          })
        ])
      ], { icon: 'coin' }),
      view.railTiles > 0
        ? el('p', {
            class: 'ae-econ-note',
            text: `${view.railTiles} tile(s) do caminho desta rota têm trilho. A malha ferroviária move estoque entre cidades ligadas por conta própria, com a sua própria vazão — a simulação não calcula um custo por unidade para o trilho, então não há comparação direta com o custo de transporte acima.`
          })
        : null
    ]),

    el('div', { class: 'ae-econ-two-up' }, [
      view.fromKingdom
        ? panel({ title: 'Reino de origem', icon: 'kingdom' }, [
            rowList([
              el('div', { class: 'ae-row' }, [
                icon('kingdom', { size: 16, class: 'ae-row-icon' }),
                el('span', { class: 'ae-row-label', text: 'Vendedor' }),
                el('span', { class: 'ae-row-value' }, [
                  objectLink(
                    { kind: 'kingdom', id: view.fromKingdom.id, name: view.fromKingdom.name, accent: view.fromKingdom.color },
                    { showIcon: false, onOpen: () => host.openRealm(view.fromKingdom!.id) }
                  )
                ])
              ])
            ])
          ])
        : null,
      view.toKingdom
        ? panel({ title: 'Reino de destino', icon: 'kingdom' }, [
            rowList([
              el('div', { class: 'ae-row' }, [
                icon('kingdom', { size: 16, class: 'ae-row-icon' }),
                el('span', { class: 'ae-row-label', text: 'Comprador' }),
                el('span', { class: 'ae-row-value' }, [
                  objectLink(
                    { kind: 'kingdom', id: view.toKingdom.id, name: view.toKingdom.name, accent: view.toKingdom.color },
                    { showIcon: false, onOpen: () => host.openRealm(view.toKingdom!.id) }
                  )
                ])
              ])
            ])
          ])
        : null
    ])
  ];
}

/** Which realms depend on imports, and for what. */
function buildDependencyPanel(m: EconomyMetrics, host: EconomyScreenHost): HTMLElement | null {
  const dependent = m.realms.filter(r => r.dependencies.length);
  if (!dependent.length) return null;

  return panel({
    title: 'Dependência comercial',
    icon: 'trade-route',
    subtitle: 'Parcela do consumo de cada reino que vem de fora'
  }, dependent.slice(0, 8).map(realm => el('div', { class: 'ae-econ-dependency' }, [
    el('div', { class: 'ae-econ-dependency-head' }, [
      objectLink(
        { kind: 'kingdom', id: realm.id, name: realm.name, accent: realm.color },
        { showIcon: true, onOpen: () => host.openRealm(realm.id) }
      ),
      withTooltip(
        badge(`Dependência geral ${formatPercent(realm.tradeDependency)}`, {
          size: 'sm', variant: 'outline',
          status: realm.tradeDependency >= 0.6 ? 'warning' : undefined
        }),
        {
          title: 'Dependência comercial do reino',
          value: formatPercent(realm.tradeDependency),
          description: 'Valor movido em rotas ativas contra o PIB, na conta da própria simulação.'
        }
      )
    ]),
    el('div', { class: 'ae-econ-dependency-goods' }, realm.dependencies.map(dep => withTooltip(
      el('button', {
        class: `ae-econ-dep-chip ae-econ-dep-${dep.share >= 0.75 ? 'critical' : dep.share >= 0.5 ? 'warning' : 'neutral'}`,
        attrs: { type: 'button' },
        on: { click: () => host.inspectGood(dep.good) }
      }, [
        el('span', { text: GOODS[dep.good]?.name ?? dep.good }),
        el('strong', { text: formatPercent(dep.share) })
      ]),
      {
        title: GOODS[dep.good]?.name ?? dep.good,
        value: formatPercent(dep.share),
        description: term('dependency'),
        rows: [
          { label: 'Importado', value: dep.imported.toFixed(1) },
          { label: 'Consumido + exportado', value: dep.used.toFixed(1) }
        ],
        footnote: 'Clique para abrir o bem'
      }
    )))
  ])));
}

// ============================ CITIES ============================

export function buildCities(m: EconomyMetrics, host: EconomyScreenHost, query: string): Child[] {
  const q = query.trim().toLowerCase();
  const rows = m.cities.filter(c => !q || c.name.toLowerCase().includes(q) || (c.kingdomName ?? '').toLowerCase().includes(q));

  if (!m.cities.length) {
    return [emptyState({
      icon: 'city',
      title: 'Nenhuma economia ainda',
      hint: 'Nenhum assentamento foi fundado. Não há produção, consumo nem comércio para relatar.'
    })];
  }

  return [
    panel({
      title: 'Cidades',
      icon: 'city',
      subtitle: `${rows.length} de ${m.cities.length}`,
      padded: false
    }, [
      rows.length
        ? table<CityEconomy>({
            columns: [
              {
                key: 'name', header: 'Cidade',
                cell: c => objectLink(
                  { kind: 'city', id: c.id, name: c.name, accent: c.kingdomColor ?? undefined, status: c.problem?.severity },
                  { showIcon: false, onOpen: () => host.openCity(c.id) }
                ),
                sortValue: c => c.name
              },
              {
                key: 'realm', header: 'Reino',
                cell: c => (c.kingdomId
                  ? objectLink(
                      { kind: 'kingdom', id: c.kingdomId, name: c.kingdomName ?? '', accent: c.kingdomColor ?? undefined },
                      { showIcon: false, onOpen: () => host.openRealm(c.kingdomId!) }
                    )
                  : el('span', { class: 'ae-muted', text: 'Independente' })),
                sortValue: c => c.kingdomName ?? ''
              },
              { key: 'output', header: 'Produção', align: 'right', width: '104px', cell: c => formatCompact(c.output), sortValue: c => c.output },
              {
                key: 'employment', header: 'Emprego', align: 'right', width: '100px',
                cell: c => (c.employment === null ? '—' : formatPercent(c.employment)),
                sortValue: c => c.employment ?? -1,
                tooltip: { title: 'Emprego', description: 'Postos ocupados ÷ postos existentes.' }
              },
              {
                key: 'food', header: 'Alimentação', align: 'right', width: '112px',
                cell: c => (c.foodSecurity === null ? '—' : formatPercent(c.foodSecurity)),
                sortValue: c => c.foodSecurity ?? -1,
                tooltip: { title: 'Segurança alimentar', description: '(produzido + importado) ÷ consumido no último ano fechado.' }
              },
              { key: 'imported', header: 'Import.', align: 'right', width: '92px', cell: c => c.imported.toFixed(1), sortValue: c => c.imported },
              { key: 'exported', header: 'Export.', align: 'right', width: '92px', cell: c => c.exported.toFixed(1), sortValue: c => c.exported },
              {
                key: 'industry', header: 'Setor principal', width: '132px',
                cell: c => c.topIndustry ?? el('span', { class: 'ae-muted', text: '—' }),
                sortValue: c => c.topIndustry ?? ''
              },
              {
                key: 'problem', header: 'Situação',
                cell: c => (c.problem
                  ? badge(c.problem.label, { size: 'sm', status: c.problem.severity, variant: 'outline' })
                  : el('span', { class: 'ae-muted', text: '—' })),
                sortValue: c => (c.problem ? (c.problem.severity === 'critical' ? 0 : 1) : 2)
              }
            ],
            rows,
            rowKey: c => c.id,
            sortBy: 'output',
            onRowClick: c => host.openCity(c.id),
            status: c => c.problem?.severity,
            rowTooltip: c => ({
              title: c.name,
              value: formatFull(Math.round(c.output)),
              description: c.kingdomName ? `Assentamento de ${c.kingdomName}.` : 'Assentamento independente.',
              rows: [
                { label: 'População', value: `${c.population}` },
                { label: 'Postos', value: `${c.filled} de ${c.jobs}` },
                ...(c.problem ? [{ label: 'Problema', value: c.problem.label, status: c.problem.severity as Status }] : [])
              ],
              footnote: 'Clique para abrir o dossiê da cidade'
            })
          })
        : emptyState({ icon: 'search', title: 'Nenhuma cidade corresponde', hint: `Nada encontrado para "${query}".`, compact: true })
    ])
  ];
}

// ============================ REALMS ============================

export function buildRealms(m: EconomyMetrics, host: EconomyScreenHost, query: string): Child[] {
  const q = query.trim().toLowerCase();
  const rows = m.realms.filter(r => !q || r.name.toLowerCase().includes(q));

  if (!m.realms.length) {
    return [emptyState({
      icon: 'kingdom',
      title: 'Nenhum reino',
      hint: 'Nenhuma sociedade se organizou em um estado ainda.'
    })];
  }

  return [
    panel({
      title: 'Reinos',
      icon: 'kingdom',
      subtitle: `${rows.length} de ${m.realms.length}`,
      padded: false
    }, [
      rows.length
        ? table<RealmEconomy>({
            columns: [
              {
                key: 'name', header: 'Reino',
                cell: r => objectLink(
                  { kind: 'kingdom', id: r.id, name: r.name, accent: r.color },
                  { showIcon: false, onOpen: () => host.openRealm(r.id) }
                ),
                sortValue: r => r.name
              },
              { key: 'output', header: 'Produção', align: 'right', width: '104px', cell: r => formatCompact(r.output), sortValue: r => r.output },
              { key: 'treasury', header: 'Tesouro', align: 'right', width: '104px', cell: r => formatCompact(r.treasury), sortValue: r => r.treasury },
              { key: 'imported', header: 'Import.', align: 'right', width: '92px', cell: r => r.imported.toFixed(1), sortValue: r => r.imported },
              { key: 'exported', header: 'Export.', align: 'right', width: '92px', cell: r => r.exported.toFixed(1), sortValue: r => r.exported },
              {
                key: 'balance', header: 'Balança', align: 'right', width: '104px',
                cell: r => trendIndicator({
                  delta: r.tradeBalance, sentiment: 'higher-better', compact: true,
                  text: `${r.tradeBalance >= 0 ? '+' : '−'}${Math.abs(r.tradeBalance).toFixed(1)}`
                }),
                sortValue: r => r.tradeBalance,
                tooltip: { title: 'Balança comercial', description: term('balance') }
              },
              {
                key: 'food', header: 'Reserva alimentar', align: 'right', width: '132px',
                cell: r => formatPercent(r.foodSecurity),
                sortValue: r => r.foodSecurity,
                tooltip: {
                  title: 'Reserva alimentar',
                  description: 'Estoque de comida por habitante contra a reserva de quatro anos que a simulação considera plena.'
                }
              },
              {
                key: 'dependency', header: 'Dependência', align: 'right', width: '112px',
                cell: r => formatPercent(r.tradeDependency),
                sortValue: r => r.tradeDependency,
                tooltip: { title: 'Dependência comercial', description: term('dependency') }
              },
            ],
            rows,
            rowKey: r => r.id,
            sortBy: 'output',
            onRowClick: r => host.openRealm(r.id),
            status: r => (r.foodSecurity < 0.7 ? 'warning' : undefined),
            rowTooltip: r => ({
              title: r.name,
              value: formatFull(Math.round(r.output)),
              rows: [
                { label: 'Cidades', value: `${r.cities}` },
                { label: 'Industrialização', value: formatPercent(r.industrialisation) },
                ...(r.dependencies.length
                  ? [{ label: 'Maior dependência', value: `${GOODS[r.dependencies[0].good]?.name} ${formatPercent(r.dependencies[0].share)}` }]
                  : [])
              ],
              footnote: 'Clique para abrir o dossiê do reino'
            })
          })
        : emptyState({ icon: 'search', title: 'Nenhum reino corresponde', hint: `Nada encontrado para "${query}".`, compact: true })
    ]),

    buildRankings(m, host)
  ];
}

/**
 * Rankings, each one a single real figure sorted.
 *
 * Deliberately no "economic power score": that would need a weighting nobody
 * could check, so the screen ranks by things the simulation actually measures and
 * names each one.
 */
function buildRankings(m: EconomyMetrics, host: EconomyScreenHost): HTMLElement | null {
  if (m.realms.length < 2) return null;

  const ranking = (title: string, iconName: string, pick: (r: RealmEconomy) => number, format: (v: number) => string) => {
    const list = [...m.realms].filter(r => pick(r) > 0).sort((a, b) => pick(b) - pick(a)).slice(0, 5);
    if (!list.length) return null;
    return section(title, [
      rowList(list.map((realm, i) => el('div', { class: 'ae-row' }, [
        el('span', { class: 'ae-econ-rank', text: `${i + 1}` }),
        el('span', { class: 'ae-row-label' }, [
          objectLink(
            { kind: 'kingdom', id: realm.id, name: realm.name, accent: realm.color },
            { showIcon: false, onOpen: () => host.openRealm(realm.id) }
          )
        ]),
        el('span', { class: 'ae-row-value' }, [
          el('span', { class: 'ae-row-figure', text: format(pick(realm)) })
        ])
      ])))
    ], { icon: iconName });
  };

  const blocks = [
    ranking('Maiores economias', 'economy', r => r.output, v => formatCompact(v)),
    ranking('Maiores exportadores', 'route', r => r.exported, v => v.toFixed(1)),
    ranking('Maiores importadores', 'route', r => r.imported, v => v.toFixed(1)),
    ranking('Mais industrializados', 'industry', r => r.industrialisation, v => formatPercent(v))
  ].filter(Boolean) as HTMLElement[];

  if (!blocks.length) return null;

  return panel({
    title: 'Rankings',
    icon: 'statistics',
    subtitle: 'Cada um ordena uma figura real — não há índice composto de poder econômico'
  }, [el('div', { class: 'ae-econ-rankings' }, blocks)]);
}

// ============================ SHARED ============================

function goodColumn(host: EconomyScreenHost): Column<WorldGoodPosition> {
  return {
    key: 'good', header: 'Bem',
    cell: p => objectLink(
      { kind: 'good', id: p.good, name: p.name },
      { showIcon: false, onOpen: () => host.inspectGood(p.good) }
    ),
    sortValue: p => p.name
  };
}

function numColumn(
  key: string,
  header: string,
  pick: (p: WorldGoodPosition) => number,
  explain?: string
): Column<WorldGoodPosition> {
  return {
    key, header, align: 'right', width: '92px',
    cell: p => pick(p).toFixed(1),
    sortValue: pick,
    tooltip: explain ? { title: header, description: explain } : undefined
  };
}

function priceChangeColumn(): Column<WorldGoodPosition> {
  return {
    key: 'change', header: 'Δ Preço', align: 'right', width: '100px',
    // Neutral: the world screen has no side. A rise is good for the seller.
    cell: p => trendIndicator({ delta: p.priceChange, sentiment: 'neutral', compact: true, text: signed(p.priceChange) }),
    sortValue: p => p.priceChange,
    tooltip: {
      title: 'Variação de preço',
      description: 'Contra o ano fechado anterior. Uma alta é boa notícia para quem vende e má para quem compra, então a cor aqui é neutra.'
    }
  };
}

function goodTooltip(p: WorldGoodPosition) {
  return {
    title: p.name,
    value: p.price.toFixed(1),
    description: GOODS[p.good]?.description,
    rows: [
      { label: 'Oferta', value: p.supply.toFixed(1) },
      { label: 'Demanda', value: p.demand.toFixed(1) },
      { label: 'Estoque', value: formatCompact(p.stock) },
      { label: 'Cobertura', value: p.coverage === null ? 'nada consome' : formatPercent(p.coverage) },
      ...(p.yearsOfStock !== null ? [{ label: 'Anos de estoque', value: p.yearsOfStock.toFixed(1) }] : [])
    ],
    footnote: 'Clique para abrir a análise deste bem'
  };
}

function miniButton(iconName: string, title: string, description: string, onClick: () => void): HTMLElement {
  return withTooltip(
    el('button', {
      class: 'ae-econ-mini-btn',
      attrs: { type: 'button', 'aria-label': title },
      on: { click: onClick }
    }, [icon(iconName, { size: 16 })]),
    { title, description }
  );
}
