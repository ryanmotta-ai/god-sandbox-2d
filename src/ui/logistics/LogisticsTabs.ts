/**
 * The logistics command centre's tabs.
 *
 * The ordering rule for this phase is the brief's: **problem, network, flow,
 * cause, consequence.** So the overview opens on what is broken and what that
 * break costs downstream, and the network detail comes after.
 *
 * Nothing here touches the simulation. Every figure arrives already aggregated,
 * which is what keeps a full sweep of the tile grid off the render path.
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
  diagnoseLogistics, logisticsProblems, causalChain, criticalInfrastructure,
  LINK_STATUS, TERMS, statusOf, verdictLabel, utilizationStatus, pct,
  type LogisticsCondition, type CausalChain, type CriticalAsset
} from './LogisticsDiagnostics';
import {
  ROAD_LEVEL_LABEL,
  type LogisticsMetrics, type Bottleneck, type RouteView, type PortView,
  type CorridorView, type MoverView, type RailLine, type CityAccess
} from './LogisticsMetrics';
import type { LogisticsScreenHost } from '../screens/InfrastructureScreen';

// ============================ OVERVIEW ============================

export function buildOverview(m: LogisticsMetrics, host: LogisticsScreenHost): Child[] {
  const conditions = diagnoseLogistics(m);
  const urgent = logisticsProblems(conditions);
  const settled = conditions.filter(c => !urgent.includes(c));
  const top = m.bottlenecks.slice(0, 5);

  return [
    top.length ? buildBottleneckCards(top, m, host) : null,

    panel({ title: 'A rede', icon: 'trade-route' }, [
      statGrid([
        stat({
          label: 'Rede viária', value: m.roads.tiles > 0 ? `${m.roads.tiles}` : '—',
          unit: m.roads.tiles > 0 ? 'blocos' : undefined, icon: 'route',
          status: m.roads.damagedTiles > 0 ? 'warning' : undefined,
          tooltip: m.roads.tiles > 0
            ? {
                title: 'Rede viária',
                value: `${m.roads.tiles} blocos`,
                description: 'Blocos do mundo com alguma via aberta.',
                rows: [
                  { label: ROAD_LEVEL_LABEL[1], value: `${m.roads.byLevel[1]}` },
                  { label: ROAD_LEVEL_LABEL[2], value: `${m.roads.byLevel[2]}` },
                  { label: ROAD_LEVEL_LABEL[3], value: `${m.roads.byLevel[3]}` },
                  { label: 'Degradados', value: `${m.roads.damagedTiles}`, status: m.roads.damagedTiles ? 'warning' : 'positive' }
                ]
              }
            : { title: 'Rede viária', description: 'Nenhuma via aberta no mundo ainda.' }
        }),
        stat({
          label: 'Malha ferroviária', value: m.rail.tiles > 0 ? `${m.rail.tiles}` : '—',
          unit: m.rail.tiles > 0 ? 'trilhos' : undefined, icon: 'route',
          status: m.rail.severedTiles > 0 ? 'critical' : m.rail.degradedTiles > 0 ? 'warning' : undefined,
          tooltip: m.rail.tiles > 0
            ? {
                title: 'Malha ferroviária',
                rows: [
                  { label: 'Linhas em operação', value: `${m.rail.lines.filter(l => l.stations.length >= 2).length}` },
                  { label: 'Trechos rompidos', value: `${m.rail.severedTiles}`, status: m.rail.severedTiles ? 'critical' : 'positive' },
                  { label: 'Trechos danificados', value: `${m.rail.degradedTiles}` }
                ],
                footnote: TERMS.railSevered
              }
            : { title: 'Malha ferroviária', description: 'Nenhuma ferrovia foi construída ainda.' }
        }),
        m.rail.tiles > 0
          ? stat({
              label: 'Frete ferroviário', value: formatCompact(m.rail.worldFreight), icon: 'crate',
              tooltip: {
                title: 'Frete ferroviário',
                value: formatFull(Math.round(m.rail.worldFreight)),
                description: TERMS.freight,
                footnote: 'Figura mundial, não deste ou daquele reino'
              }
            })
          : null,
        stat({
          label: 'Comércio terrestre', value: formatCompact(m.landTradeVolume), icon: 'route',
          tooltip: { title: 'Volume terrestre', description: 'Soma do volume das rotas por terra.' }
        }),
        stat({
          label: 'Comércio marítimo', value: formatCompact(m.seaTradeVolume), icon: 'route',
          tooltip: { title: 'Volume marítimo', description: 'Soma do volume das rotas por mar.' }
        }),
        stat({
          label: 'Rotas ativas', value: `${m.activeRoutes}`, icon: 'trade-route',
          status: m.closedRoutes > 0 ? 'warning' : undefined,
          tooltip: {
            title: 'Rotas',
            rows: [
              { label: 'Ativas', value: `${m.activeRoutes}`, status: 'positive' },
              { label: 'Fechadas', value: `${m.closedRoutes}`, status: m.closedRoutes ? 'critical' : 'positive' }
            ]
          }
        }),
        stat({
          label: 'Em movimento', value: `${m.activeCaravans + m.activeShips + m.activeTrains}`, icon: 'route',
          tooltip: {
            title: 'Comboios no mundo',
            description: 'Caravanas, navios e trens físicos percorrendo suas rotas agora.',
            rows: [
              { label: 'Caravanas', value: `${m.activeCaravans}` },
              { label: 'Navios', value: `${m.activeShips}` },
              { label: 'Trens Ativos', value: `${m.activeTrains}` }
            ],
            footnote: 'A ferrovia opera com locomotivas e vagões físicos transportando carga e passageiros.'
          }
        }),
        stat({
          label: 'Infraestrutura danificada',
          value: `${m.roads.damagedTiles + m.rail.severedTiles + m.rail.degradedTiles}`,
          icon: 'warning',
          status: (m.rail.severedTiles > 0) ? 'critical' : (m.roads.damagedTiles > 0 ? 'warning' : 'positive'),
          tooltip: {
            title: 'Infraestrutura danificada',
            rows: [
              { label: 'Vias degradadas', value: `${m.roads.damagedTiles}` },
              { label: 'Trilhos rompidos', value: `${m.rail.severedTiles}` },
              { label: 'Trilhos danificados', value: `${m.rail.degradedTiles}` }
            ]
          }
        }),
        stat({
          label: 'Assentamentos isolados', value: `${m.cities.filter(c => c.isolated).length}`, icon: 'map',
          status: m.cities.some(c => c.isolated) ? 'critical' : 'positive',
          tooltip: { title: 'Isolados', description: TERMS.disconnected }
        })
      ].filter(Boolean) as HTMLElement[])
    ]),

    urgent.length
      ? panel({
          title: 'Condições logísticas',
          icon: 'alert',
          subtitle: `${urgent.length} fora do normal`,
          class: 'ae-log-urgent'
        }, urgent.map(c => buildConditionRow(c, host)))
      : null,

    settled.length
      ? panel({
          title: urgent.length ? 'Demais condições' : 'Condições logísticas',
          icon: 'statistics',
          subtitle: urgent.length ? undefined : 'Nada fora do normal'
        }, settled.map(c => buildConditionRow(c, host)))
      : null,

    buildCritical(m, host),

    !m.roads.tiles && !m.rail.tiles && !m.routes.length
      ? emptyState({
          icon: 'trade-route',
          title: 'Nenhuma rota logística ativa',
          hint: 'Nenhuma via, trilho ou rota existe ainda. A logística aparece quando os assentamentos começam a precisar uns dos outros.'
        })
      : null
  ];
}

function buildConditionRow(condition: LogisticsCondition, host: LogisticsScreenHost): HTMLElement {
  const status = statusOf(condition);
  const target = condition.at ? () => host.goToMap(condition.at!.x, condition.at!.y) : null;

  const node = el(target ? 'button' : 'div', {
    class: ['ae-log-condition', `ae-log-condition-${status}`, target ? 'ae-log-condition-live' : '']
      .filter(Boolean).join(' '),
    attrs: target ? { type: 'button' } : {},
    dataset: { conditionId: condition.id },
    on: target ? { click: target } : undefined
  }, [
    icon(condition.icon, { size: 16, class: 'ae-log-condition-icon' }),
    el('div', { class: 'ae-log-condition-text' }, [
      el('span', { class: 'ae-log-condition-label', text: condition.label }),
      el('span', { class: 'ae-log-condition-finding', text: condition.finding })
    ]),
    badge(verdictLabel(condition.status), { size: 'sm', status, variant: 'outline' })
  ]);

  return withTooltip(node, {
    title: condition.label,
    description: condition.finding,
    icon: condition.icon,
    rows: condition.terms,
    footnote: condition.status === 'unknown'
      ? 'Este sistema ainda não existe neste mundo'
      : target ? 'Clique para ir até lá no mapa' : undefined
  });
}

/**
 * The bottlenecks, each opened into its causal chain.
 *
 * This is the centre of UI-7: the point is not that a rail is damaged, it is that
 * coal stopped reaching the smithy. Each chain walks outward one provable step at
 * a time and says so when it runs out of evidence.
 */
function buildBottleneckCards(list: Bottleneck[], m: LogisticsMetrics, host: LogisticsScreenHost): HTMLElement {
  return panel({
    title: 'Gargalos logísticos',
    icon: 'alert',
    subtitle: `${list.length} de ${m.bottlenecks.length} · ranqueados por gravidade`,
    class: 'ae-log-critical'
  }, list.map(bottleneck => buildBottleneckCard(bottleneck, m, host)));
}

function buildBottleneckCard(bottleneck: Bottleneck, m: LogisticsMetrics, host: LogisticsScreenHost): HTMLElement {
  const chain = causalChain(bottleneck, m);

  return el('div', { class: `ae-log-bottleneck ae-log-bottleneck-${bottleneck.severity}` }, [
    el('div', { class: 'ae-log-bottleneck-head' }, [
      icon(networkIcon(bottleneck.network), { size: 16, class: 'ae-log-bottleneck-icon' }),
      el('div', { class: 'ae-log-bottleneck-text' }, [
        el('span', { class: 'ae-log-bottleneck-label', text: bottleneck.location }),
        el('span', { class: 'ae-log-bottleneck-problem', text: bottleneck.problem })
      ]),
      badgeRow([
        badge(networkLabel(bottleneck.network), { size: 'sm', variant: 'outline' }),
        badge(bottleneck.severity === 'critical' ? 'Crítico' : 'Atenção', { size: 'sm', status: bottleneck.severity })
      ]),
      el('div', { class: 'ae-log-bottleneck-actions' }, [
        bottleneck.at
          ? miniButton('map', 'Ir até lá', 'Fecha a tela e centraliza a câmera no ponto.', () => host.goToMap(bottleneck.at!.x, bottleneck.at!.y))
          : null,
        bottleneck.cityId
          ? miniButton('city', 'Dossiê da cidade', 'Abre o dossiê do assentamento.', () => host.openCity(bottleneck.cityId!))
          : null,
        bottleneck.kingdomId
          ? miniButton('kingdom', 'Dossiê do reino', 'Abre o dossiê do reino.', () => host.openRealm(bottleneck.kingdomId!))
          : null,
        bottleneck.affectedGoods[0]
          ? miniButton('crate', GOODS[bottleneck.affectedGoods[0]]?.name ?? '', 'Abre este bem na Economia.', () => host.openGood(bottleneck.affectedGoods[0]))
          : null
      ])
    ]),

    buildChain(chain, host),

    bottleneck.affectedCities.length > 1 || bottleneck.affectedGoods.length > 1
      ? el('div', { class: 'ae-log-affected' }, [
          bottleneck.affectedGoods.length
            ? el('div', { class: 'ae-log-affected-group' }, [
                el('span', { class: 'ae-log-affected-title', text: 'Bens atingidos' }),
                ...bottleneck.affectedGoods.slice(0, 6).map(good => objectLink(
                  { kind: 'good', id: good, name: GOODS[good]?.name ?? good },
                  { showIcon: false, onOpen: () => host.openGood(good) }
                ))
              ])
            : null,
          bottleneck.affectedCities.length
            ? el('div', { class: 'ae-log-affected-group' }, [
                el('span', { class: 'ae-log-affected-title', text: 'Assentamentos atingidos' }),
                ...bottleneck.affectedCities.slice(0, 6).map(city => objectLink(
                  { kind: 'city', id: city.id, name: city.name },
                  { showIcon: false, onOpen: () => host.openCity(city.id) }
                ))
              ])
            : null
        ])
      : null
  ]);
}

/** The chain, drawn as steps with the evidence under each one. */
function buildChain(chain: CausalChain, host: LogisticsScreenHost): HTMLElement {
  return el('div', { class: 'ae-log-chain' }, [
    ...chain.links.map((link, i) => el('div', { class: 'ae-log-chain-step' }, [
      el('span', { class: `ae-log-chain-marker ae-log-chain-${link.kind}`, text: `${i + 1}` }),
      el('div', { class: 'ae-log-chain-body' }, [
        el('span', { class: 'ae-log-chain-label' }, [
          el('span', { text: link.label }),
          link.good
            ? objectLink(
                { kind: 'good', id: link.good, name: GOODS[link.good]?.name ?? link.good },
                { showIcon: false, onOpen: () => host.openGood(link.good!) }
              )
            : null,
          link.cityId && !link.good
            ? miniButton('city', 'Abrir cidade', 'Abre o dossiê do assentamento.', () => host.openCity(link.cityId!))
            : null
        ]),
        el('span', { class: 'ae-log-chain-evidence', text: link.evidence })
      ])
    ])),
    // Saying where the evidence stopped is part of the answer.
    chain.truncated
      ? el('p', {
          class: 'ae-log-note',
          text: 'A cadeia para aqui: a simulação não registra o próximo passo com precisão suficiente para afirmá-lo.'
        })
      : null
  ]);
}

function networkIcon(network: Bottleneck['network']): string {
  return network === 'sea' ? 'route' : network === 'rail' ? 'route' : network === 'trade' ? 'trade-route' : 'route';
}

function networkLabel(network: Bottleneck['network']): string {
  return { road: 'Via', rail: 'Ferrovia', sea: 'Marítimo', trade: 'Rota' }[network];
}

/** Infrastructure the world hangs from, each with the share that proves it. */
function buildCritical(m: LogisticsMetrics, host: LogisticsScreenHost): HTMLElement | null {
  const assets = criticalInfrastructure(m);
  if (!assets.length) return null;

  return panel({
    title: 'Infraestrutura crítica',
    icon: 'shield',
    subtitle: 'Pontos por onde passa parcela dominante de um fluxo — a parcela é medida, não atribuída'
  }, assets.slice(0, 8).map(asset => el('div', {
    class: `ae-log-critical-row${asset.singlePointOfFailure ? ' is-spof' : ''}`
  }, [
    icon(asset.kind === 'port' ? 'route' : asset.kind === 'rail-line' ? 'route' : 'trade-route',
      { size: 16, class: 'ae-log-critical-icon' }),
    el('div', { class: 'ae-log-critical-text' }, [
      el('span', { class: 'ae-log-critical-label', text: asset.label }),
      el('span', { class: 'ae-log-critical-reason', text: asset.reason })
    ]),
    asset.singlePointOfFailure
      ? withTooltip(
          badge('Ponto único de falha', { size: 'sm', status: 'critical', icon: 'warning' }),
          {
            title: 'Ponto único de falha',
            description: 'Não existe outra ligação capaz de carregar o que esta carrega. Se ela parar, o fluxo para inteiro.'
          }
        )
      : null,
    el('div', { class: 'ae-log-bottleneck-actions' }, [
      asset.at ? miniButton('map', 'Ir até lá', 'Centraliza a câmera.', () => host.goToMap(asset.at!.x, asset.at!.y)) : null,
      asset.cityId ? miniButton('city', 'Dossiê da cidade', 'Abre o dossiê.', () => host.openCity(asset.cityId!)) : null,
      asset.good ? miniButton('crate', 'Abrir bem', 'Abre na Economia.', () => host.openGood(asset.good!)) : null
    ])
  ])));
}

// ============================ NETWORKS ============================

export function buildNetworks(m: LogisticsMetrics, host: LogisticsScreenHost): Child[] {
  return [
    buildRoadPanel(m, host),
    m.rail.tiles > 0
      ? buildRailPanel(m, host)
      : panel({ title: 'Ferrovia', icon: 'route' }, [
          emptyState({
            icon: 'route',
            title: 'Nenhuma malha ferroviária foi desenvolvida ainda',
            hint: 'Trilhos aparecem quando um reino domina a energia a vapor e tem uma mina longe da sua forja.',
            compact: true
          })
        ]),
    m.ports.length
      ? buildPortSummary(m, host)
      : panel({ title: 'Marítimo', icon: 'route' }, [
          emptyState({ icon: 'route', title: 'Nenhum porto ativo', hint: 'Nenhum assentamento ergueu ancoradouro ou porto.', compact: true })
        ])
  ];
}

function buildRoadPanel(m: LogisticsMetrics, host: LogisticsScreenHost): HTMLElement {
  const r = m.roads;
  if (r.tiles === 0) {
    return panel({ title: 'Vias', icon: 'route' }, [
      emptyState({ icon: 'route', title: 'Nenhuma via aberta', hint: 'Tudo se move na velocidade de quem caminha.', compact: true })
    ]);
  }

  return panel({
    title: 'Vias',
    icon: 'route',
    subtitle: `${r.tiles} blocos · nível médio ${r.meanLevel?.toFixed(2) ?? '—'}`,
    actions: [
      button('Ver no mapa', () => host.requestOverlay('roads'), {
        variant: 'ghost', size: 'sm', icon: 'map',
        tooltip: {
          title: 'Sobreposição de vias',
          description: 'A sobreposição dedicada de tráfego chega na UI-10. Por ora, fecha a tela e devolve o mapa.'
        }
      })
    ]
  }, [
    statGrid([
      stat({ label: ROAD_LEVEL_LABEL[1], value: `${r.byLevel[1]}`, unit: 'blocos', icon: 'route' }),
      stat({ label: ROAD_LEVEL_LABEL[2], value: `${r.byLevel[2]}`, unit: 'blocos', icon: 'route' }),
      stat({ label: ROAD_LEVEL_LABEL[3], value: `${r.byLevel[3]}`, unit: 'blocos', icon: 'route' }),
      stat({
        label: 'Degradados', value: `${r.damagedTiles}`, unit: 'blocos', icon: 'warning',
        status: r.damagedTiles > 0 ? 'warning' : 'positive',
        tooltip: {
          title: 'Vias degradadas',
          description: 'Blocos cujo nível efetivo caiu abaixo do que foi construído, por dano de guerra. Reduz a capacidade e encarece o transporte.'
        }
      }),
      stat({
        label: 'Tráfego acumulado', value: formatCompact(r.totalTraffic), icon: 'people',
        tooltip: { title: 'Tráfego', description: TERMS.traffic }
      })
    ]),

    r.busiest.length
      ? el('div', {}, [
          divider(),
          section('Trechos mais movimentados', [
            rowList(r.busiest.slice(0, 8).map((tile, i) => el('div', { class: 'ae-row' }, [
              el('span', { class: 'ae-log-rank', text: `${i + 1}` }),
              icon('route', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label' }, [
                el('span', { text: tile.cityName ?? `${tile.x}, ${tile.y}` }),
                el('span', { class: 'ae-row-unit', text: ROAD_LEVEL_LABEL[tile.level] ?? `Nível ${tile.level}` })
              ]),
              el('span', { class: 'ae-row-value' }, [
                el('span', { class: 'ae-row-figure', text: formatCompact(tile.traffic) }),
                miniButton('map', 'Ir até lá', 'Centraliza a câmera neste trecho.', () => host.goToMap(tile.x, tile.y))
              ])
            ])))
          ], {
            icon: 'route',
            hint: 'por passagens acumuladas'
          }),
          el('p', {
            class: 'ae-log-note',
            text: 'O uso da via alimenta a sua evolução: trechos percorridos com frequência ganham nível ao longo dos anos.'
          })
        ])
      : null
  ]);
}

function buildRailPanel(m: LogisticsMetrics, host: LogisticsScreenHost): HTMLElement {
  const working = m.rail.lines.filter(l => l.stations.length >= 2);

  return panel({
    title: 'Ferrovia',
    icon: 'route',
    subtitle: `${m.rail.tiles} trilhos · ${working.length} linha(s) em operação`
  }, [
    statGrid([
      stat({ label: 'Trilhos', value: `${m.rail.tiles}`, icon: 'route' }),
      stat({ label: 'Linhas', value: `${working.length}`, icon: 'route' }),
      stat({
        label: 'Estações ligadas',
        value: `${new Set(working.flatMap(l => l.stations.map(s => s.cityId))).size}`,
        icon: 'city'
      }),
      stat({
        label: 'Trechos rompidos', value: `${m.rail.severedTiles}`, icon: 'warning',
        status: m.rail.severedTiles > 0 ? 'critical' : 'positive',
        tooltip: { title: 'Trechos rompidos', description: TERMS.railSevered }
      }),
      stat({
        label: 'Frete no mundo', value: formatCompact(m.rail.worldFreight), icon: 'crate',
        tooltip: { title: 'Frete ferroviário', description: TERMS.freight, footnote: 'Figura mundial' }
      }),
      stat({ label: 'Assentado no ano', value: `${m.rail.builtThisYear}`, unit: 'trechos', icon: 'building' })
    ]),

    el('p', {
      class: 'ae-log-note',
      text: 'Não há comboios na malha: o frete é transferido diretamente entre estações da mesma linha contínua, com vazão proporcional à condição dos trilhos. Os únicos veículos do mundo são caravanas e navios.'
    }),

    working.length
      ? el('div', {}, [
          divider(),
          section('Linhas', [
            table<RailLine>({
              columns: [
                {
                  key: 'route', header: 'Linha',
                  cell: l => el('span', { class: 'ae-log-line-cell' },
                    l.stations.map((s, i) => el('span', {}, [
                      i > 0 ? el('span', { class: 'ae-muted', text: ' → ' }) : null,
                      objectLink({ kind: 'city', id: s.cityId, name: s.cityName },
                        { showIcon: false, onOpen: () => host.openCity(s.cityId) })
                    ]))),
                  sortValue: l => l.stations.map(s => s.cityName).join(' ')
                },
                { key: 'blocos', header: 'Trilhos', align: 'right', width: '88px', cell: l => `${l.tiles}`, sortValue: l => l.tiles },
                {
                  key: 'quality', header: 'Condição', align: 'right', width: '104px',
                  cell: l => formatPercent(l.quality),
                  sortValue: l => l.quality,
                  tooltip: { title: 'Condição da linha', description: TERMS.lineQuality }
                },
                {
                  key: 'goods', header: 'Carga', width: '176px',
                  cell: l => (l.goods.length
                    ? badgeRow(l.goods.map(g => badge(GOODS[g]?.name ?? g, { size: 'sm', variant: 'outline' })))
                    : el('span', { class: 'ae-muted', text: 'nada em circulação' })),
                  sortValue: l => l.goods.length
                },
                {
                  key: 'owners', header: 'Dono', width: '148px',
                  cell: l => (l.owners.length
                    ? badgeRow(l.owners.map(o => objectLink(
                        { kind: 'kingdom', id: o.kingdomId, name: o.name, accent: o.color },
                        { showIcon: false, onOpen: () => host.openRealm(o.kingdomId) }
                      )))
                    : el('span', { class: 'ae-muted', text: 'abandonada' })),
                  sortValue: l => l.owners[0]?.name ?? ''
                },
                {
                  key: 'status', header: 'Situação', width: '124px',
                  cell: l => badge(LINK_STATUS[l.status].label, { size: 'sm', status: LINK_STATUS[l.status].status, variant: 'outline' }),
                  sortValue: l => l.status
                }
              ],
              rows: working,
              rowKey: l => l.id,
              sortBy: 'blocos',
              onRowClick: l => host.goToMap(l.at.x, l.at.y),
              status: l => (LINK_STATUS[l.status].status === 'positive' ? undefined : LINK_STATUS[l.status].status),
              rowTooltip: l => ({
                title: l.stations.map(s => s.cityName).join(' → '),
                description: LINK_STATUS[l.status].explain,
                rows: [
                  { label: 'Trilhos', value: `${l.tiles}` },
                  { label: 'Condição', value: formatPercent(l.quality) },
                  { label: 'Trechos danificados', value: `${l.damagedTiles}`, status: l.damagedTiles ? 'warning' : 'positive' }
                ],
                footnote: 'Clique para ir até a linha no mapa'
              })
            })
          ], { icon: 'route' })
        ])
      : null,

    m.rail.strandedStations.length
      ? el('div', {}, [
          divider(),
          section('Trilhos que não ligam nada', [
            rowList(m.rail.strandedStations.map(s => statRow({
              label: s.cityName,
              value: 'sem par',
              icon: 'warning',
              status: 'warning',
              onClick: () => host.openCity(s.cityId),
              tooltip: {
                title: s.cityName,
                description: 'Há trilhos aqui, mas nenhuma outra estação no mesmo trecho contínuo. A malha só move carga entre estações ligadas.'
              }
            })))
          ], { icon: 'warning' })
        ])
      : null
  ]);
}

// ============================ PORTS ============================

function buildPortSummary(m: LogisticsMetrics, host: LogisticsScreenHost): HTMLElement {
  return panel({
    title: 'Marítimo',
    icon: 'route',
    subtitle: `${m.ports.length} porto(s) · ${m.activeShips} navio(s) em trânsito`,
    padded: false
  }, [buildPortTable(m.ports, host)]);
}

export function buildPorts(m: LogisticsMetrics, host: LogisticsScreenHost, focused: string | null): Child[] {
  if (!m.ports.length) {
    return [emptyState({
      icon: 'route',
      title: 'Nenhum porto ativo',
      hint: 'Nenhum assentamento ergueu ancoradouro ou porto. Sem eles não há comércio marítimo.'
    })];
  }

  const port = focused ? m.ports.find(p => p.cityId === focused) ?? null : null;

  return [
    port ? buildPortDetail(port, m, host) : null,

    panel({
      title: 'Portos',
      icon: 'route',
      subtitle: `${m.ports.length}`,
      padded: false
    }, [buildPortTable(m.ports, host)]),

    buildMaritimeRoutes(m, host)
  ];
}

function buildPortTable(ports: PortView[], host: LogisticsScreenHost): HTMLElement {
  return table<PortView>({
    columns: [
      {
        key: 'city', header: 'Porto',
        cell: p => objectLink(
          { kind: 'city', id: p.cityId, name: p.cityName, accent: p.kingdomColor ?? undefined, status: p.operational ? undefined : 'critical' },
          { showIcon: false, onOpen: () => host.focusPort(p.cityId) }
        ),
        sortValue: p => p.cityName
      },
      {
        key: 'realm', header: 'Reino',
        cell: p => (p.kingdomId
          ? objectLink({ kind: 'kingdom', id: p.kingdomId, name: p.kingdomName ?? '', accent: p.kingdomColor ?? undefined },
              { showIcon: false, onOpen: () => host.openRealm(p.kingdomId!) })
          : el('span', { class: 'ae-muted', text: 'Independente' })),
        sortValue: p => p.kingdomName ?? ''
      },
      { key: 'berths', header: 'Ancoradouros', align: 'right', width: '116px', cell: p => `${p.berths}`, sortValue: p => p.berths },
      { key: 'routes', header: 'Rotas', align: 'right', width: '80px', cell: p => `${p.maritimeRoutes.length}`, sortValue: p => p.maritimeRoutes.length },
      {
        key: 'volume', header: 'Movimento', align: 'right', width: '112px',
        cell: p => (p.inboundVolume + p.outboundVolume).toFixed(1),
        sortValue: p => p.inboundVolume + p.outboundVolume
      },
      {
        key: 'share', header: 'Do reino', align: 'right', width: '96px',
        cell: p => (p.realmSeaShare > 0 ? formatPercent(p.realmSeaShare) : '—'),
        sortValue: p => p.realmSeaShare,
        tooltip: { title: 'Parcela do reino', description: 'Quanto do comércio marítimo do reino passa por este porto.' }
      },
      {
        key: 'condition', header: 'Condição', align: 'right', width: '104px',
        cell: p => formatPercent(p.condition),
        sortValue: p => p.condition
      },
      {
        key: 'status', header: 'Situação', width: '148px',
        cell: p => badge(LINK_STATUS[p.status].label, { size: 'sm', status: LINK_STATUS[p.status].status, variant: 'outline' }),
        sortValue: p => p.status
      }
    ],
    rows: ports,
    rowKey: p => p.cityId,
    sortBy: 'volume',
    onRowClick: p => host.focusPort(p.cityId),
    status: p => (LINK_STATUS[p.status].status === 'positive' ? undefined : LINK_STATUS[p.status].status),
    rowTooltip: p => ({
      title: p.cityName,
      description: LINK_STATUS[p.status].explain,
      rows: [
        { label: 'Entrando', value: p.inboundVolume.toFixed(1) },
        { label: 'Saindo', value: p.outboundVolume.toFixed(1) },
        ...(p.majorImports[0] ? [{ label: 'Maior importação', value: GOODS[p.majorImports[0].good]?.name ?? '' }] : [])
      ],
      footnote: 'Clique para abrir o porto'
    })
  });
}

/** One port in full: what it handles, and what it would cost to lose it. */
function buildPortDetail(port: PortView, m: LogisticsMetrics, host: LogisticsScreenHost): HTMLElement {
  const sole = m.ports.filter(p => p.kingdomId === port.kingdomId).length === 1;

  return panel({
    title: port.cityName,
    icon: 'route',
    subtitle: port.kingdomName ? `Porto de ${port.kingdomName}` : 'Porto independente',
    class: 'ae-log-focus',
    actions: [
      button('Fechar', () => host.focusPort(null), { variant: 'ghost', size: 'sm', icon: 'close' }),
      button('Ir até lá', () => host.goToMap(port.x, port.y), { variant: 'secondary', size: 'sm', icon: 'map' }),
      button('Dossiê da cidade', () => host.openCity(port.cityId), { variant: 'primary', size: 'sm', icon: 'city' })
    ]
  }, [
    badgeRow([
      badge(LINK_STATUS[port.status].label, { size: 'sm', status: LINK_STATUS[port.status].status }),
      badge(`${port.berths} ancoradouro(s)`, { size: 'sm', variant: 'outline' }),
      sole && port.kingdomName ? badge('Único porto do reino', { size: 'sm', status: 'warning', icon: 'warning' }) : null
    ]),

    statGrid([
      stat({ label: 'Rotas marítimas', value: `${port.maritimeRoutes.length}`, icon: 'trade-route' }),
      stat({ label: 'Entrando', value: port.inboundVolume.toFixed(1), icon: 'route' }),
      stat({ label: 'Saindo', value: port.outboundVolume.toFixed(1), icon: 'route' }),
      stat({
        label: 'Condição', value: formatPercent(port.condition), icon: 'building',
        status: port.condition >= 0.75 ? 'positive' : 'warning'
      }),
      port.realmSeaShare > 0
        ? stat({
            label: 'Do comércio marítimo do reino', value: formatPercent(port.realmSeaShare), icon: 'kingdom',
            status: port.realmSeaShare >= 0.5 ? 'warning' : undefined,
            tooltip: {
              title: 'Importância',
              value: formatPercent(port.realmSeaShare),
              description: `Parcela de todo o volume marítimo de ${port.kingdomName} que passa por aqui.`
            }
          })
        : null
    ].filter(Boolean) as HTMLElement[]),

    (port.majorImports.length || port.majorExports.length)
      ? el('div', { class: 'ae-log-two-up' }, [
          port.majorImports.length
            ? section('Principais importações', [
                rowList(port.majorImports.map(entry => statRow({
                  label: GOODS[entry.good]?.name ?? entry.good,
                  value: entry.volume.toFixed(1),
                  icon: 'crate',
                  onClick: () => host.openGood(entry.good),
                  tooltip: { title: GOODS[entry.good]?.name ?? entry.good, description: 'Volume que entra por este porto.', footnote: 'Clique para abrir na Economia' }
                })))
              ], { icon: 'crate' })
            : null,
          port.majorExports.length
            ? section('Principais exportações', [
                rowList(port.majorExports.map(entry => statRow({
                  label: GOODS[entry.good]?.name ?? entry.good,
                  value: entry.volume.toFixed(1),
                  icon: 'crate',
                  onClick: () => host.openGood(entry.good),
                  tooltip: { title: GOODS[entry.good]?.name ?? entry.good, description: 'Volume que sai por este porto.' }
                })))
              ], { icon: 'crate' })
            : null
        ])
      : el('p', { class: 'ae-log-note', text: 'Nenhuma rota marítima passa por este porto no momento.' }),

    port.maritimeRoutes.length
      ? el('div', {}, [divider(), section('Rotas', [buildRouteTable(port.maritimeRoutes, host)], { icon: 'trade-route' })])
      : null
  ]);
}

function buildMaritimeRoutes(m: LogisticsMetrics, host: LogisticsScreenHost): HTMLElement | null {
  const sea = m.routes.filter(r => r.kind === 'maritime');
  if (!sea.length) return null;
  return panel({
    title: 'Rotas marítimas',
    icon: 'trade-route',
    subtitle: `${sea.length}`,
    padded: false
  }, [buildRouteTable(sea, host)]);
}

// ============================ CORRIDORS ============================

export function buildCorridors(
  m: LogisticsMetrics,
  host: LogisticsScreenHost,
  state: { network: string; status: string; query: string }
): Child[] {
  if (!m.corridors.length) {
    return [emptyState({
      icon: 'trade-route',
      title: 'Nenhuma rota logística ativa',
      hint: 'Uma rota nasce quando um reino tem excedente, outro tem escassez, e a margem cobre transporte e tarifa.'
    })];
  }

  const query = state.query.trim().toLowerCase();
  const rows = m.corridors.filter(c => {
    if (state.network === 'road' && !c.modes.includes('overland')) return false;
    if (state.network === 'sea' && !c.modes.includes('maritime')) return false;
    if (state.network === 'rail' && !c.railed) return false;
    if (state.status === 'healthy' && c.status !== 'healthy') return false;
    if (state.status === 'disrupted' && !['war-closed', 'blocked', 'congested'].includes(c.status)) return false;
    if (state.status === 'damaged' && c.status !== 'damaged') return false;
    if (query && !`${c.fromName} ${c.toName}`.toLowerCase().includes(query)) return false;
    return true;
  });

  return [
    panel({
      title: 'Corredores',
      icon: 'trade-route',
      subtitle: `${rows.length} de ${m.corridors.length} · agregação de interface, não uma entidade da simulação`,
      padded: false,
      actions: [buildFilters(state, host)]
    }, [
      rows.length
        ? table<CorridorView>({
            columns: [
              {
                key: 'pair', header: 'Corredor',
                cell: c => el('span', { class: 'ae-log-line-cell' }, [
                  objectLink({ kind: 'city', id: c.fromCityId, name: c.fromName },
                    { showIcon: false, onOpen: () => host.openCity(c.fromCityId) }),
                  el('span', { class: 'ae-muted', text: ' ⇄ ' }),
                  objectLink({ kind: 'city', id: c.toCityId, name: c.toName },
                    { showIcon: false, onOpen: () => host.openCity(c.toCityId) })
                ]),
                sortValue: c => c.fromName
              },
              {
                key: 'modes', header: 'Transporte', width: '148px',
                cell: c => badgeRow([
                  ...c.modes.map(mode => badge(mode === 'maritime' ? 'Marítimo' : 'Terrestre', { size: 'sm', variant: 'outline', icon: 'route' })),
                  c.railed ? badge('Trilho no caminho', { size: 'sm', variant: 'outline', icon: 'route' }) : null
                ]),
                sortValue: c => c.modes.join(',')
              },
              {
                key: 'goods', header: 'Carga', width: '196px',
                cell: c => badgeRow(c.goods.slice(0, 3).map(g => withTooltip(
                  badge(GOODS[g.good]?.name ?? g.good, { size: 'sm', variant: 'outline' }),
                  { title: GOODS[g.good]?.name ?? g.good, value: g.volume.toFixed(1), description: 'Volume neste corredor.' }
                ))),
                sortValue: c => c.goods.length
              },
              { key: 'volume', header: 'Volume', align: 'right', width: '96px', cell: c => c.totalVolume.toFixed(1), sortValue: c => c.totalVolume },
              { key: 'value', header: 'Valor', align: 'right', width: '104px', cell: c => formatCompact(c.totalValue), sortValue: c => c.totalValue },
              {
                key: 'util', header: 'Utilização', align: 'right', width: '110px',
                cell: c => formatPercent(c.utilization),
                sortValue: c => c.utilization,
                tooltip: { title: 'Utilização', description: TERMS.utilization }
              },
              {
                key: 'relation', header: 'Fronteira', width: '132px',
                cell: c => (c.relation
                  ? withTooltip(
                      badge(c.relation.status, {
                        size: 'sm', variant: 'outline',
                        status: c.relation.status === 'war' ? 'critical' : c.relation.status === 'hostile' ? 'warning' : undefined
                      }),
                      {
                        title: 'Relação entre os dois reinos',
                        value: `${Math.round(c.relation.score)}`,
                        description: 'Um corredor internacional depende da relação diplomática entre as duas pontas.'
                      }
                    )
                  : el('span', { class: 'ae-muted', text: 'doméstico' })),
                sortValue: c => c.relation?.score ?? 999
              },
              {
                key: 'status', header: 'Situação', width: '148px',
                cell: c => badge(LINK_STATUS[c.status].label, { size: 'sm', status: LINK_STATUS[c.status].status, variant: 'outline' }),
                sortValue: c => c.status
              }
            ],
            rows,
            rowKey: c => c.id,
            sortBy: 'value',
            onRowClick: c => host.focusCorridor(c.id),
            status: c => (LINK_STATUS[c.status].status === 'positive' ? undefined : LINK_STATUS[c.status].status),
            rowTooltip: c => ({
              title: `${c.fromName} ⇄ ${c.toName}`,
              description: LINK_STATUS[c.status].explain,
              rows: [
                { label: 'Rotas', value: `${c.routes.length}` },
                { label: 'Volume', value: c.totalVolume.toFixed(1) },
                { label: 'Utilização', value: formatPercent(c.utilization) }
              ],
              footnote: 'Clique para abrir o corredor'
            })
          })
        : emptyState({ icon: 'search', title: 'Nenhum corredor corresponde', hint: 'Ajuste os filtros.', compact: true })
    ])
  ];
}

/** One corridor in full, with the economics of each route in it. */
export function buildCorridorDetail(corridor: CorridorView, host: LogisticsScreenHost): Child[] {
  return [
    el('div', { class: 'ae-log-detail-head' }, [
      button('Voltar aos corredores', () => host.focusCorridor(null), { variant: 'ghost', size: 'sm', icon: 'close' }),
      badgeRow([
        badge(LINK_STATUS[corridor.status].label, { size: 'sm', status: LINK_STATUS[corridor.status].status }),
        ...corridor.modes.map(mode => badge(mode === 'maritime' ? 'Marítimo' : 'Terrestre', { size: 'sm', variant: 'outline' })),
        corridor.railed ? badge('Trilho no caminho', { size: 'sm', variant: 'outline' }) : null
      ])
    ]),

    panel({
      title: `${corridor.fromName} ⇄ ${corridor.toName}`,
      icon: 'trade-route',
      subtitle: corridor.international ? 'Corredor internacional' : 'Corredor doméstico',
      actions: [
        button('Centralizar', () => host.goToCorridor(corridor), {
          variant: 'secondary', size: 'sm', icon: 'map',
          tooltip: { title: 'Centralizar corredor', description: 'Fecha a tela e enquadra o ponto médio entre as duas pontas.' }
        }),
        button('Abrir origem', () => host.openCity(corridor.fromCityId), { variant: 'ghost', size: 'sm', icon: 'city' }),
        button('Abrir destino', () => host.openCity(corridor.toCityId), { variant: 'ghost', size: 'sm', icon: 'city' })
      ]
    }, [
      statGrid([
        stat({ label: 'Rotas', value: `${corridor.routes.length}`, icon: 'trade-route' }),
        stat({ label: 'Volume', value: corridor.totalVolume.toFixed(1), icon: 'crate' }),
        stat({ label: 'Valor acumulado', value: formatCompact(corridor.totalValue), icon: 'coin' }),
        stat({
          label: 'Utilização', value: formatPercent(corridor.utilization), icon: 'statistics',
          status: utilizationStatus(corridor.utilization),
          tooltip: { title: 'Utilização', description: TERMS.utilization }
        })
      ]),
      corridor.goods.length
        ? el('div', {}, [
            divider(),
            section('Carga', [
              rowList(corridor.goods.map(entry => statRow({
                label: GOODS[entry.good]?.name ?? entry.good,
                value: entry.volume.toFixed(1),
                icon: 'crate',
                onClick: () => host.openGood(entry.good),
                tooltip: { title: GOODS[entry.good]?.name ?? entry.good, description: 'Volume que atravessa este corredor.', footnote: 'Clique para abrir na Economia' }
              })))
            ], { icon: 'crate' })
          ])
        : null
    ]),

    panel({ title: 'Rotas do corredor', icon: 'trade-route', padded: false }, [
      buildRouteTable(corridor.routes, host)
    ]),

    ...corridor.routes.slice(0, 3).map(route => buildRouteEconomics(route, host))
  ];
}

// ============================ ROUTES ============================

export function buildRouteTable(routes: RouteView[], host: LogisticsScreenHost): HTMLElement {
  return table<RouteView>({
    columns: [
      {
        key: 'good', header: 'Bem',
        cell: r => objectLink({ kind: 'good', id: r.good, name: r.goodName },
          { showIcon: false, onOpen: () => host.openGood(r.good) }),
        sortValue: r => r.goodName
      },
      {
        key: 'from', header: 'Origem',
        cell: r => (r.fromCity
          ? objectLink({ kind: 'city', id: r.fromCity.id, name: r.fromCity.name },
              { showIcon: false, onOpen: () => host.openCity(r.fromCity!.id) })
          : el('span', { class: 'ae-muted', text: '—' })),
        sortValue: r => r.fromCity?.name ?? ''
      },
      {
        key: 'to', header: 'Destino',
        cell: r => (r.toCity
          ? objectLink({ kind: 'city', id: r.toCity.id, name: r.toCity.name },
              { showIcon: false, onOpen: () => host.openCity(r.toCity!.id) })
          : el('span', { class: 'ae-muted', text: '—' })),
        sortValue: r => r.toCity?.name ?? ''
      },
      {
        key: 'transport', header: 'Transporte', width: '120px',
        cell: r => badge(r.railTiles > 0 ? 'Com trilho' : r.kind === 'maritime' ? 'Marítimo' : 'Terrestre',
          { size: 'sm', variant: 'outline', icon: 'route' }),
        sortValue: r => (r.railTiles > 0 ? 'a' : r.kind)
      },
      { key: 'volume', header: 'Volume', align: 'right', width: '92px', cell: r => r.route.volume.toFixed(1), sortValue: r => r.route.volume },
      {
        key: 'capacity', header: 'Teto', align: 'right', width: '84px',
        cell: r => r.route.maxVolume.toFixed(0),
        sortValue: r => r.route.maxVolume,
        tooltip: { title: 'Capacidade', description: TERMS.capacity }
      },
      {
        key: 'util', header: 'Utilização', align: 'right', width: '106px',
        cell: r => formatPercent(r.utilization),
        sortValue: r => r.utilization,
        tooltip: { title: 'Utilização', description: TERMS.utilization }
      },
      { key: 'value', header: 'Valor', align: 'right', width: '100px', cell: r => formatCompact(r.route.totalValue), sortValue: r => r.route.totalValue },
      {
        key: 'movers', header: 'Comboios', align: 'right', width: '104px',
        cell: r => {
          const n = r.caravans.length + r.ships.length;
          return n > 0 ? `${n}` : el('span', { class: 'ae-muted', text: '—' });
        },
        sortValue: r => r.caravans.length + r.ships.length
      },
      {
        key: 'status', header: 'Situação', width: '150px',
        cell: r => badge(LINK_STATUS[r.status].label, { size: 'sm', status: LINK_STATUS[r.status].status, variant: 'outline' }),
        sortValue: r => r.status
      }
    ],
    rows: routes,
    rowKey: r => r.route.id,
    sortBy: 'value',
    onRowClick: r => host.goToRoute(r),
    status: r => (LINK_STATUS[r.status].status === 'positive' ? undefined : LINK_STATUS[r.status].status),
    rowTooltip: r => ({
      title: `${r.goodName}: ${r.fromCity?.name ?? '?'} → ${r.toCity?.name ?? '?'}`,
      description: LINK_STATUS[r.status].explain,
      rows: [
        { label: 'Preço na origem', value: r.sourcePrice.toFixed(2) },
        { label: 'Transporte', value: r.transportCost.toFixed(2) },
        { label: 'Tarifa', value: formatPercent(r.tariffRate) },
        { label: 'Preço no destino', value: r.destPrice.toFixed(2) },
        { label: 'Margem por unidade', value: r.marginPerUnit.toFixed(2), status: r.marginPerUnit > 0 ? 'positive' : 'warning' },
        { label: 'Distância', value: `${r.distance.toFixed(0)} blocos` },
        ...(r.avgRoadLevel !== null
          ? [{ label: 'Via média no caminho', value: ROAD_LEVEL_LABEL[Math.round(r.avgRoadLevel)] ?? r.avgRoadLevel.toFixed(2) }]
          : [])
      ],
      footnote: 'Clique para enquadrar a rota no mapa'
    })
  });
}

/**
 * The four prices that decide whether a route is worth running.
 *
 * Transport comes from the simulation's own `transportCostPerUnit`, so the figure
 * shown is the figure charged — the same one UI-5 reports for the same route.
 */
function buildRouteEconomics(route: RouteView, host: LogisticsScreenHost): HTMLElement {
  return panel({
    title: `Custo: ${route.goodName} · ${route.fromCity?.name ?? '?'} → ${route.toCity?.name ?? '?'}`,
    icon: 'coin',
    subtitle: 'Mesma fórmula que a simulação cobrou ao abrir a rota'
  }, [
    rowList([
      statRow({ label: 'Preço na origem', value: route.sourcePrice.toFixed(2), icon: 'coin' }),
      statRow({
        label: 'Custo de transporte', value: route.transportCost.toFixed(2), icon: 'route', status: 'warning',
        tooltip: { title: 'Transporte', value: route.transportCost.toFixed(3), description: TERMS.transportCost }
      }),
      statRow({ label: 'Tarifa', value: formatPercent(route.tariffRate), icon: 'tax', status: 'warning' }),
      statRow({ label: 'Preço no destino', value: route.destPrice.toFixed(2), icon: 'coin' }),
      statRow({
        label: 'Margem por unidade', value: route.marginPerUnit.toFixed(2), icon: 'economy',
        status: route.marginPerUnit > 0 ? 'positive' : 'critical',
        tooltip: { title: 'Margem', description: 'Destino menos origem, menos transporte, menos tarifa. É a razão pela qual a rota existe.' }
      })
    ]),
    route.avgRoadLevel !== null
      ? el('p', {
          class: 'ae-log-note',
          text: `A via média deste caminho é ${(ROAD_LEVEL_LABEL[Math.round(route.avgRoadLevel)] ?? 'indefinida').toLowerCase()}. Melhorá-la reduz o custo por unidade e eleva a capacidade da rota.`
        })
      : null
  ]);
}

// ============================ MOVERS ============================

export function buildMovers(m: LogisticsMetrics, host: LogisticsScreenHost): Child[] {
  if (!m.movers.length) {
    return [emptyState({
      icon: 'route',
      title: 'Nenhum comboio em trânsito',
      hint: 'Caravanas e navios aparecem quando há rotas ativas com margem para percorrer.'
    })];
  }

  return [
    panel({
      title: 'Comboios em trânsito',
      icon: 'route',
      subtitle: `${m.activeCaravans} caravana(s), ${m.activeShips} navio(s) e ${m.activeTrains} trem(ns)`,
      padded: false
    }, [
      table<MoverView>({
        columns: [
          {
            key: 'kind', header: 'Comboio', width: '176px',
            cell: v => el('span', { class: 'ae-log-mover-cell' }, [
              icon(v.kind === 'train' ? 'trade-route' : v.kind === 'ship' ? 'port' : 'route', { size: 16 }),
              el('span', { text: v.variant })
            ]),
            sortValue: v => v.variant
          },
          {
            key: 'from', header: 'Origem',
            cell: v => (v.outbound ? v.fromName : v.toName),
            sortValue: v => (v.outbound ? v.fromName : v.toName)
          },
          {
            key: 'to', header: 'Destino',
            cell: v => (v.outbound ? v.toName : v.fromName),
            sortValue: v => (v.outbound ? v.toName : v.fromName)
          },
          {
            key: 'cargo', header: 'Carga',
            cell: v => objectLink({ kind: 'good', id: v.good, name: v.goodName },
              { showIcon: false, onOpen: () => host.openGood(v.good) }),
            sortValue: v => v.goodName
          },
          { key: 'amount', header: 'Quantidade', align: 'right', width: '112px', cell: v => v.amount.toFixed(0), sortValue: v => v.amount },
          {
            key: 'progress', header: 'Percurso', align: 'right', width: '132px',
            cell: v => el('span', { class: 'ae-log-progress' }, [
              el('span', { class: 'ae-log-progress-track' }, [
                el('span', { class: 'ae-log-progress-fill', style: { width: `${Math.round(v.progress * 100)}%` } })
              ]),
              el('span', { class: 'ae-log-progress-value', text: formatPercent(v.progress) })
            ]),
            sortValue: v => v.progress
          },
          {
            key: 'status', header: 'Situação', width: '150px',
            // Only the two states the movers actually have: which way they are
            // going, and whether the route under them has been shut.
            cell: v => badge(v.routeClosed ? 'Rota fechada' : v.outbound ? 'A caminho' : 'Retornando', {
              size: 'sm', status: v.routeClosed ? 'critical' : undefined, variant: 'outline'
            }),
            sortValue: v => (v.routeClosed ? 0 : v.outbound ? 1 : 2)
          }
        ],
        rows: m.movers,
        rowKey: v => v.id,
        sortBy: 'amount',
        onRowClick: v => host.goToMap(v.x, v.y, 2.2),
        status: v => (v.routeClosed ? 'critical' : undefined),
        rowTooltip: v => ({
          title: `${v.variant} · ${v.goodName}`,
          value: `${v.amount.toFixed(0)} unidades`,
          description: `${v.fromName} → ${v.toName}, ${formatPercent(v.progress)} do caminho.`,
          footnote: 'Clique para centralizar a câmera neste comboio'
        })
      })
    ]),

    el('p', {
      class: 'ae-log-note',
      text: 'Caravanas e navios são os únicos veículos do mundo. A ferrovia não tem comboios: entrega o frete diretamente entre estações da mesma linha.'
    })
  ];
}

// ============================ CITIES ============================

export function buildCityAccessTab(m: LogisticsMetrics, host: LogisticsScreenHost, query: string): Child[] {
  const q = query.trim().toLowerCase();
  const rows = m.cities.filter(c => !q || c.cityName.toLowerCase().includes(q) || (c.kingdomName ?? '').toLowerCase().includes(q));

  if (!m.cities.length) {
    return [emptyState({ icon: 'city', title: 'Nenhum assentamento', hint: 'Nada foi fundado ainda.' })];
  }

  return [
    panel({
      title: 'Acesso dos assentamentos',
      icon: 'city',
      subtitle: `${rows.length} de ${m.cities.length}`,
      padded: false
    }, [
      rows.length
        ? table<CityAccess>({
            columns: [
              {
                key: 'city', header: 'Assentamento',
                cell: c => objectLink(
                  { kind: 'city', id: c.cityId, name: c.cityName, status: c.isolated ? 'critical' : undefined },
                  { showIcon: false, onOpen: () => host.openCity(c.cityId) }
                ),
                sortValue: c => c.cityName
              },
              {
                key: 'realm', header: 'Reino',
                cell: c => (c.kingdomId
                  ? objectLink({ kind: 'kingdom', id: c.kingdomId, name: c.kingdomName ?? '' },
                      { showIcon: false, onOpen: () => host.openRealm(c.kingdomId!) })
                  : el('span', { class: 'ae-muted', text: 'Independente' })),
                sortValue: c => c.kingdomName ?? ''
              },
              { key: 'pop', header: 'População', align: 'right', width: '104px', cell: c => formatCompact(c.population), sortValue: c => c.population },
              {
                key: 'road', header: 'Via', width: '140px',
                cell: c => (c.roadLevel > 0
                  ? badge(ROAD_LEVEL_LABEL[c.roadLevel] ?? `Nível ${c.roadLevel}`, { size: 'sm', variant: 'outline', icon: 'route' })
                  : badge('Sem via', { size: 'sm', status: 'warning', variant: 'outline' })),
                sortValue: c => c.roadLevel
              },
              {
                key: 'rail', header: 'Trilho', width: '128px',
                cell: c => (c.railConnected
                  ? badge('Ligado', { size: 'sm', status: 'positive', variant: 'outline', icon: 'route' })
                  : c.railTiles > 0
                    ? badge('Sem par', { size: 'sm', status: 'warning', variant: 'outline' })
                    : el('span', { class: 'ae-muted', text: '—' })),
                sortValue: c => (c.railConnected ? 0 : c.railTiles > 0 ? 1 : 2)
              },
              {
                key: 'port', header: 'Porto', width: '112px',
                cell: c => (!c.hasPort
                  ? el('span', { class: 'ae-muted', text: '—' })
                  : badge(c.portOperational ? 'Operando' : 'Inoperante', {
                      size: 'sm', status: c.portOperational ? 'positive' : 'critical', variant: 'outline'
                    })),
                sortValue: c => (c.hasPort ? (c.portOperational ? 0 : 1) : 2)
              },
              {
                key: 'routes', header: 'Rotas', align: 'right', width: '120px',
                cell: c => el('span', {}, [
                  el('span', { text: `${c.routesIn + c.routesOut}` }),
                  c.routesClosed > 0 ? el('span', { class: 'ae-log-closed', text: ` (${c.routesClosed} fechadas)` }) : null
                ]),
                sortValue: c => c.routesIn + c.routesOut
              },
              {
                key: 'status', header: 'Situação', width: '132px',
                cell: c => (c.isolated
                  ? badge('Isolado', { size: 'sm', status: 'critical', icon: 'warning' })
                  : c.routesClosed > 0
                    ? badge('Rotas cortadas', { size: 'sm', status: 'warning', variant: 'outline' })
                    : badge('Conectado', { size: 'sm', status: 'positive', variant: 'outline' })),
                sortValue: c => (c.isolated ? 0 : c.routesClosed > 0 ? 1 : 2)
              }
            ],
            rows,
            rowKey: c => c.cityId,
            sortBy: 'pop',
            onRowClick: c => host.openCity(c.cityId),
            status: c => (c.isolated ? 'critical' : c.routesClosed > 0 ? 'warning' : undefined),
            rowTooltip: c => ({
              title: c.cityName,
              description: c.isolated ? TERMS.disconnected : 'Acesso deste assentamento às redes do mundo.',
              rows: [
                { label: 'Via', value: ROAD_LEVEL_LABEL[c.roadLevel] ?? 'nenhuma' },
                { label: 'Trilhos no território', value: `${c.railTiles}` },
                { label: 'Rotas entrando', value: `${c.routesIn}` },
                { label: 'Rotas saindo', value: `${c.routesOut}` },
                ...(c.importedGoods[0]
                  ? [{ label: 'Maior importação', value: `${GOODS[c.importedGoods[0].good]?.name} ${c.importedGoods[0].volume.toFixed(0)}` }]
                  : [])
              ],
              footnote: 'Clique para abrir o dossiê da cidade'
            })
          })
        : emptyState({ icon: 'search', title: 'Nenhum assentamento corresponde', hint: `Nada para "${query}".`, compact: true })
    ])
  ];
}

// ============================ SHARED ============================

const NETWORK_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'road', label: 'Terrestre' },
  { id: 'rail', label: 'Ferrovia' },
  { id: 'sea', label: 'Marítimo' }
];

const STATUS_FILTERS = [
  { id: 'all', label: 'Qualquer' },
  { id: 'healthy', label: 'Saudável' },
  { id: 'disrupted', label: 'Interrompido' },
  { id: 'damaged', label: 'Danificado' }
];

function buildFilters(state: { network: string; status: string }, host: LogisticsScreenHost): HTMLElement {
  return el('div', { class: 'ae-log-filters' }, [
    ...NETWORK_FILTERS.map(f => el('button', {
      class: `ae-log-filter ${state.network === f.id ? 'is-active' : ''}`,
      attrs: { type: 'button' },
      text: f.label,
      on: { click: () => host.setNetworkFilter(f.id) }
    })),
    el('span', { class: 'ae-log-filter-sep' }),
    ...STATUS_FILTERS.map(f => el('button', {
      class: `ae-log-filter ${state.status === f.id ? 'is-active' : ''}`,
      attrs: { type: 'button' },
      text: f.label,
      on: { click: () => host.setStatusFilter(f.id) }
    }))
  ]);
}

export function miniButton(iconName: string, title: string, description: string, onClick: () => void): HTMLElement {
  return withTooltip(
    el('button', {
      class: 'ae-log-mini-btn',
      attrs: { type: 'button', 'aria-label': title },
      on: { click: onClick }
    }, [icon(iconName, { size: 16 })]),
    { title, description }
  );
}

export { trendIndicator, progressBar };
