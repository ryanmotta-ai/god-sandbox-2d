/**
 * The diplomacy half of the command centre.
 *
 * One honesty problem shapes the whole thing. `DiplomacyManager` stores a single
 * number per pair of realms and nothing about how it got there — no history, no
 * per-event contribution. So there is no way to write "the border conflict cost
 * you 12 points" without inventing it.
 *
 * What the simulation *does* store is the state of every relationship: war,
 * truce, alliance, trade agreement with its real tariff, embargo with its year
 * and reason, trade volume per partner, vassalage, shared enemies. All of that is
 * shown in full, and the screen says plainly that the score itself has no
 * recorded breakdown. That is a better answer than a plausible one.
 */
import { el, Child } from '../core/Dom';
import {
  panel, section, divider, statRow, rowList, statGrid, stat, progressBar,
  badge, badgeRow, table, emptyState, objectLink, icon, withTooltip, button,
  formatCompact, formatPercent, trendIndicator,
  type Status, type Column
} from '../kit';
import { GOODS } from '../../civ/Goods';
import {
  geopoliticalPressures, relationFacts, RELATION_STATUS,
  pct, relationStatus, dependencyStatus, inverted,
  type GeopoliticalPressure
} from './PoliticsDiagnostics';
import { TERMS, miniButton, buildPoliticalChronicle } from './PoliticsTabs';
import type { PoliticsMetrics, RelationView, WarView, DependencyView } from './PoliticsMetrics';
import type { PoliticsScreenHost } from '../screens/PoliticsScreen';

// ============================ RELATIONS ============================

export function buildRelations(m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  if (!m.relations.length) {
    return [emptyState({
      icon: 'handshake',
      title: 'Sem contato com outros reinos',
      hint: 'Este reino ainda não encontrou nenhum outro. Sem vizinhos conhecidos não há diplomacia.'
    })];
  }

  const bucket = (label: string, list: RelationView[], iconName: string, status?: Status) =>
    list.length
      ? stat({ label, value: `${list.length}`, icon: iconName, status,
          tooltip: { title: label, description: list.map(r => r.name).join(', ') } })
      : null;

  const allies = m.relations.filter(r => r.status === 'alliance');
  const friendly = m.relations.filter(r => r.status === 'friendly');
  const neutral = m.relations.filter(r => r.status === 'neutral');
  const hostile = m.relations.filter(r => r.status === 'hostile');
  const atWar = m.relations.filter(r => r.status === 'war');
  const pressures = geopoliticalPressures(m);

  return [
    pressures.length ? buildGeoPressures(pressures, host) : null,

    panel({ title: 'Posição diplomática', icon: 'diplomacy' }, [
      statGrid([
        stat({ label: 'Contatos', value: `${m.relations.length}`, icon: 'handshake' }),
        bucket('Aliados', allies, 'alliance', 'positive'),
        bucket('Amistosos', friendly, 'handshake', 'positive'),
        bucket('Neutros', neutral, 'handshake'),
        bucket('Hostis', hostile, 'warning', 'warning'),
        bucket('Em guerra', atWar, 'war', 'critical'),
        stat({
          label: 'Ameaça externa', value: pct(m.externalThreat), icon: 'shield',
          status: inverted(m.externalThreat),
          tooltip: {
            title: 'Ameaça externa',
            value: pct(m.externalThreat),
            description: 'A pior combinação de poder e proximidade entre os reinos conhecidos. Guerra declarada leva ao máximo.'
          }
        }),
        stat({
          label: 'Dependência comercial', value: pct(m.economy.tradeDependency), icon: 'trade-route',
          status: m.economy.tradeDependency >= 0.6 ? 'warning' : undefined,
          tooltip: { title: 'Dependência comercial', value: pct(m.economy.tradeDependency), description: TERMS.tradeDependency }
        })
      ].filter(Boolean) as HTMLElement[])
    ]),

    panel({
      title: 'Relações',
      icon: 'handshake',
      subtitle: `${m.relations.length}`,
      padded: false
    }, [buildRelationTable(m.relations, host)]),

    m.relations.some(r => r.tradeVolume > 0) ? buildTradeRelations(m, host) : null
  ];
}

function buildRelationTable(relations: RelationView[], host: PoliticsScreenHost): HTMLElement {
  const columns: Column<RelationView>[] = [
    {
      key: 'name', header: 'Reino',
      cell: r => objectLink(
        { kind: 'kingdom', id: r.kingdomId, name: r.name, accent: r.color, status: r.atWar ? 'critical' : undefined },
        { showIcon: false, onOpen: () => host.openRealm(r.kingdomId) }
      ),
      sortValue: r => r.name
    },
    {
      key: 'score', header: 'Relação', align: 'right', width: '104px',
      // Neutral sentiment: the score's sign already says which way it leans, and
      // the row status carries the verdict.
      cell: r => trendIndicator({
        delta: r.score, sentiment: 'neutral', compact: true,
        text: `${r.score > 0 ? '+' : ''}${Math.round(r.score)}`
      }),
      sortValue: r => r.score,
      tooltip: { title: 'Índice de relação', description: TERMS.relationScore }
    },
    {
      key: 'status', header: 'Situação', width: '108px',
      cell: r => badge(RELATION_STATUS[r.status].label, {
        size: 'sm', status: RELATION_STATUS[r.status].status, variant: 'outline'
      }),
      sortValue: r => r.status
    },
    {
      key: 'trade', header: 'Comércio', align: 'right', width: '116px',
      cell: r => (r.tradeVolume > 0
        ? el('span', { text: `${r.tradeVolume.toFixed(1)} · ${pct(r.tradeShare)}` })
        : el('span', { class: 'ae-muted', text: '—' })),
      sortValue: r => r.tradeVolume
    },
    {
      key: 'treaty', header: 'Tratados',
      // Only treaty kinds the simulation actually stores. There is no invented
      // "non-aggression pact" here because there is no such record to read.
      cell: r => badgeRow([
        r.alliance ? badge('Aliança', { size: 'sm', status: 'positive', variant: 'outline', icon: 'alliance' }) : null,
        r.tariff !== null ? badge(`Comércio ${pct(r.tariff)}`, { size: 'sm', status: 'positive', variant: 'outline', icon: 'trade' }) : null,
        r.truceUntil !== null ? badge(`Trégua até ${r.truceUntil}`, { size: 'sm', variant: 'outline' }) : null,
        r.isVassal ? badge('Vassalo', { size: 'sm', variant: 'outline', icon: 'crown' }) : null,
        r.isOverlord ? badge('Suserano', { size: 'sm', variant: 'outline', icon: 'crown' }) : null,
        r.embargoedAgainstUs ? badge('Embargo contra nós', { size: 'sm', status: 'critical', variant: 'outline' }) : null,
        r.embargoedByUs ? badge('Embargo nosso', { size: 'sm', status: 'warning', variant: 'outline' }) : null
      ]),
      sortValue: r => (r.alliance ? 0 : r.tariff !== null ? 1 : 2)
    },
    {
      key: 'war', header: 'Guerra', width: '92px',
      cell: r => (r.atWar
        ? badge('Em guerra', { size: 'sm', status: 'critical', icon: 'war' })
        : el('span', { class: 'ae-muted', text: '—' })),
      sortValue: r => (r.atWar ? 0 : 1)
    }
  ];

  return table({
    columns, rows: relations,
    rowKey: r => r.kingdomId,
    sortBy: 'score',
    onRowClick: r => host.focusRelation(r.kingdomId),
    status: r => (r.atWar ? 'critical' : r.status === 'hostile' ? 'warning' : undefined),
    rowTooltip: r => ({
      title: r.name,
      value: `${r.score > 0 ? '+' : ''}${Math.round(r.score)}`,
      description: RELATION_STATUS[r.status].explain,
      rows: relationFacts(r).map(f => ({ label: f.label, value: f.value, status: f.tone })),
      footnote: 'Clique para abrir o que está em jogo entre os dois'
    })
  });
}

/**
 * One relationship in full.
 *
 * The facts block is the honest version of "why is this relation what it is":
 * every item is recorded state with its own figure, and the note says the engine
 * keeps no weighting behind the score itself.
 */
export function buildRelationDetail(relation: RelationView, m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  const facts = relationFacts(relation);

  return [
    el('div', { class: 'ae-pol-detail-head' }, [
      button('Voltar às relações', () => host.focusRelation(null), { variant: 'ghost', size: 'sm', icon: 'close' }),
      badgeRow([
        badge(RELATION_STATUS[relation.status].label, { size: 'sm', status: RELATION_STATUS[relation.status].status }),
        relation.alliance ? badge(relation.alliance.name, { size: 'sm', status: 'positive', icon: 'alliance' }) : null
      ])
    ]),

    panel({
      title: `${m.name} · ${relation.name}`,
      icon: 'handshake',
      subtitle: RELATION_STATUS[relation.status].explain,
      actions: [
        button('Dossiê do reino', () => host.openRealm(relation.kingdomId), {
          variant: 'primary', size: 'sm', icon: 'kingdom',
          tooltip: { title: relation.name, description: 'Abre o dossiê completo deste reino.' }
        })
      ]
    }, [
      statGrid([
        stat({
          label: 'Índice de relação', value: `${relation.score > 0 ? '+' : ''}${Math.round(relation.score)}`,
          icon: 'handshake', status: relationStatus(relation.score),
          tooltip: { title: 'Índice de relação', description: TERMS.relationScore }
        }),
        stat({
          label: 'Comércio', value: relation.tradeVolume > 0 ? relation.tradeVolume.toFixed(1) : '—',
          unit: relation.tradeVolume > 0 ? pct(relation.tradeShare) : undefined,
          icon: 'trade-route'
        }),
        relation.tariff !== null
          ? stat({
              label: 'Tarifa do tratado', value: pct(relation.tariff), icon: 'tax',
              tooltip: { title: 'Tarifa negociada', description: 'Fração que cada lado recolhe sobre o comércio bilateral. Substitui a alíquota de fronteira.' }
            })
          : null,
        relation.truceUntil !== null
          ? stat({ label: 'Trégua até', value: `${relation.truceUntil}`, icon: 'calendar' })
          : null
      ].filter(Boolean) as HTMLElement[]),

      divider(),

      section('O que está em jogo', [
        facts.length
          ? rowList(facts.map(fact => statRow({
              label: fact.label,
              value: fact.value,
              icon: 'scroll',
              status: fact.tone
            })))
          : el('p', { class: 'ae-pol-note', text: 'Nenhum tratado, guerra, embargo ou rota liga os dois reinos hoje.' })
      ], { icon: 'handshake' }),

      // The limit, stated where the reader would otherwise assume a breakdown.
      el('p', {
        class: 'ae-pol-note',
        text: 'A simulação guarda apenas o número da relação — não há registro de quanto cada acontecimento contribuiu para ele. Acima está o que de fato existe entre os dois reinos hoje, cada item com o seu próprio valor.'
      })
    ]),

    relation.suppliedGoods.length
      ? panel({
          title: `O que ${relation.name} fornece`,
          icon: 'crate',
          subtitle: 'Volume das rotas de entrada'
        }, [
          rowList(relation.suppliedGoods.slice(0, 8).map(entry => statRow({
            label: GOODS[entry.good]?.name ?? entry.good,
            value: entry.volume.toFixed(1),
            icon: 'crate',
            onClick: () => host.openGood(entry.good),
            tooltip: {
              title: GOODS[entry.good]?.name ?? entry.good,
              value: entry.volume.toFixed(1),
              description: 'Volume que chega deste reino por rota.',
              footnote: 'Clique para abrir o bem na Economia'
            }
          })))
        ])
      : null
  ];
}

// ============================ TREATIES ============================

export function buildTreaties(m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  const agreements = m.relations.filter(r => r.tariff !== null);
  const truces = m.relations.filter(r => r.truceUntil !== null);
  const embargoes = m.relations.filter(r => r.embargoedByUs || r.embargoedAgainstUs);
  const vassals = m.relations.filter(r => r.isVassal);
  const overlord = m.relations.find(r => r.isOverlord) ?? null;

  const anything = m.alliances.length || agreements.length || truces.length ||
    embargoes.length || vassals.length || overlord;

  if (!anything) {
    return [emptyState({
      icon: 'handshake',
      title: 'Nenhum tratado formal',
      hint: 'Este reino não firmou alianças, acordos de comércio, tréguas nem vassalagens, e ninguém o embargou.'
    })];
  }

  return [
    m.alliances.length
      ? panel({
          title: 'Alianças',
          icon: 'alliance',
          subtitle: `${m.alliances.length}`
        }, m.alliances.map(alliance => {
          const members = [...alliance.members].filter(id => id !== m.kingdomId);
          const fighting = m.wars.filter(w => w.alliesInvolved.length);
          return el('div', { class: 'ae-pol-treaty' }, [
            el('div', { class: 'ae-pol-treaty-head' }, [
              icon('alliance', { size: 16 }),
              el('span', { class: 'ae-pol-treaty-name', text: alliance.name }),
              badge(`desde o ano ${alliance.formedYear}`, { size: 'sm', variant: 'outline', icon: 'calendar' })
            ]),
            el('div', { class: 'ae-pol-treaty-members' }, members.map(id => {
              const relation = m.relations.find(r => r.kingdomId === id);
              return objectLink(
                {
                  kind: 'kingdom', id,
                  name: relation?.name ?? id,
                  accent: relation?.color,
                  status: relation && relation.score < 20 ? 'warning' : undefined
                },
                { showIcon: true, onOpen: () => host.openRealm(id) }
              );
            })),
            // Stated as a fact, never as a promise: nothing in the simulation
            // obliges an ally to enter a war.
            fighting.length
              ? el('p', {
                  class: 'ae-pol-note',
                  text: `Aliados atualmente em guerra contra os mesmos inimigos: ${
                    [...new Set(fighting.flatMap(w => w.alliesInvolved.map(a => a.name)))].join(', ')
                  }. A aliança não obriga ninguém a entrar numa guerra — isto é o que está acontecendo, não o que está garantido.`
                })
              : el('p', {
                  class: 'ae-pol-note',
                  text: 'Nenhum aliado está lutando as guerras deste reino. A aliança não obriga intervenção.'
                })
          ]);
        }))
      : null,

    agreements.length
      ? panel({
          title: 'Acordos de comércio',
          icon: 'trade',
          subtitle: `${agreements.length} · tarifa negociada substitui a de fronteira`,
          padded: false
        }, [
          table<RelationView>({
            columns: [
              {
                key: 'name', header: 'Reino',
                cell: r => objectLink({ kind: 'kingdom', id: r.kingdomId, name: r.name, accent: r.color },
                  { showIcon: false, onOpen: () => host.openRealm(r.kingdomId) }),
                sortValue: r => r.name
              },
              { key: 'since', header: 'Assinado', align: 'right', width: '104px', cell: r => `${r.agreementSince ?? '—'}`, sortValue: r => r.agreementSince ?? 0 },
              { key: 'tariff', header: 'Tarifa', align: 'right', width: '96px', cell: r => pct(r.tariff ?? 0), sortValue: r => r.tariff ?? 0 },
              { key: 'volume', header: 'Volume', align: 'right', width: '104px', cell: r => r.tradeVolume.toFixed(1), sortValue: r => r.tradeVolume }
            ],
            rows: agreements,
            rowKey: r => r.kingdomId,
            sortBy: 'volume',
            onRowClick: r => host.focusRelation(r.kingdomId)
          })
        ])
      : null,

    truces.length
      ? panel({ title: 'Tréguas', icon: 'calendar', subtitle: `${truces.length}` }, [
          rowList(truces.map(r => statRow({
            label: r.name,
            value: `até o ano ${r.truceUntil}`,
            unit: r.truceReason ?? undefined,
            icon: 'handshake',
            onClick: () => host.focusRelation(r.kingdomId),
            tooltip: { title: `Trégua com ${r.name}`, description: r.truceReason ?? 'Sem motivo registrado.' }
          })))
        ])
      : null,

    embargoes.length
      ? panel({
          title: 'Embargos',
          icon: 'trade-route',
          subtitle: 'Quem bloqueou quem, e por quê'
        }, embargoes.map(r => el('div', { class: 'ae-pol-treaty' }, [
          el('div', { class: 'ae-pol-treaty-head' }, [
            icon('warning', { size: 16 }),
            el('span', { class: 'ae-pol-treaty-name' }, [
              objectLink({ kind: 'kingdom', id: r.kingdomId, name: r.name, accent: r.color },
                { showIcon: false, onOpen: () => host.openRealm(r.kingdomId) })
            ]),
            r.embargoedAgainstUs
              ? badge('embarga este reino', { size: 'sm', status: 'critical' })
              : badge('embargado por este reino', { size: 'sm', status: 'warning' })
          ]),
          el('p', {
            class: 'ae-pol-note',
            text: r.embargoedAgainstUs
              ? `Desde o ano ${r.embargoedAgainstUs.year} — ${r.embargoedAgainstUs.reason}`
              : `Desde o ano ${r.embargoedByUs!.year} — ${r.embargoedByUs!.reason}`
          })
        ])))
      : null,

    (vassals.length || overlord)
      ? panel({ title: 'Vassalagem', icon: 'crown' }, [
          rowList([
            ...(overlord
              ? [statRow({
                  label: 'Suserano', value: overlord.name, icon: 'crown', status: 'warning',
                  onClick: () => host.openRealm(overlord.kingdomId),
                  tooltip: { title: 'Suserano', description: 'Este reino paga tributo àquele.' }
                })]
              : []),
            ...vassals.map(r => statRow({
              label: 'Vassalo', value: r.name, icon: 'crown',
              onClick: () => host.openRealm(r.kingdomId),
              tooltip: { title: 'Vassalo', description: 'Aquele reino paga tributo a este.' }
            }))
          ])
        ])
      : null
  ];
}

// ============================ TRADE RELATIONS ============================

/** Trade seen as foreign policy: who this realm needs, and how badly. */
function buildTradeRelations(m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement {
  const partners = [...m.relations].filter(r => r.tradeVolume > 0).sort((a, b) => b.tradeVolume - a.tradeVolume);

  return panel({
    title: 'Comércio como política',
    icon: 'trade-route',
    subtitle: `${partners.length} parceiro(s) · ${formatCompact(m.externalTradeVolume)} de volume externo`
  }, partners.slice(0, 8).map(partner => el('div', { class: 'ae-pol-partner' }, [
    progressBar({
      label: partner.name,
      value: partner.tradeShare,
      valueText: `${pct(partner.tradeShare)} do comércio externo`,
      status: partner.atWar ? 'critical' : partner.status === 'hostile' ? 'warning' : 'neutral',
      tooltip: {
        title: partner.name,
        value: partner.tradeVolume.toFixed(1),
        description: 'Volume somado das rotas entre os dois reinos.',
        rows: [
          { label: 'Situação', value: RELATION_STATUS[partner.status].label, status: RELATION_STATUS[partner.status].status },
          { label: 'Relação', value: `${Math.round(partner.score)}` }
        ]
      }
    }),
    partner.suppliedGoods.length
      ? el('div', { class: 'ae-pol-partner-goods' }, [
          el('span', { class: 'ae-muted', text: 'fornece:' }),
          ...partner.suppliedGoods.slice(0, 5).map(entry => withTooltip(
            el('button', {
              class: 'ae-pol-good-chip',
              attrs: { type: 'button' },
              on: { click: () => host.openGood(entry.good) }
            }, [
              el('span', { text: GOODS[entry.good]?.name ?? entry.good }),
              el('strong', { text: entry.volume.toFixed(0) })
            ]),
            {
              title: GOODS[entry.good]?.name ?? entry.good,
              value: entry.volume.toFixed(1),
              description: `Volume que chega de ${partner.name} por rota.`,
              footnote: 'Clique para abrir o bem na Economia'
            }
          ))
        ])
      : null
  ])));
}

// ============================ DEPENDENCIES ============================

export function buildDependencies(m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  if (!m.dependencies.length) {
    return [emptyState({
      icon: 'trade-route',
      title: 'Sem dependências externas',
      hint: 'Este reino produz o que consome. Nenhum bem chega majoritariamente de fora.'
    })];
  }

  return [
    panel({
      title: 'Dependências diplomáticas',
      icon: 'trade-route',
      subtitle: 'Parcela do consumo que vem de fora, e de quem — é aqui que comércio vira política'
    }, m.dependencies.map(dependency => buildDependencyRow(dependency, host)))
  ];
}

function buildDependencyRow(dependency: DependencyView, host: PoliticsScreenHost): HTMLElement {
  const status = dependencyStatus(dependency);
  const hostile = dependency.suppliers.find(s => s.hostile);

  return el('div', { class: `ae-pol-dependency ae-pol-dependency-${status}` }, [
    progressBar({
      label: dependency.name,
      value: dependency.share,
      valueText: pct(dependency.share),
      status,
      tooltip: {
        title: dependency.name,
        value: pct(dependency.share),
        description: 'Importado ÷ (consumido + exportado), somado em todos os assentamentos do reino.',
        rows: [
          { label: 'Importado', value: dependency.imported.toFixed(1) },
          { label: 'Consumido + exportado', value: dependency.used.toFixed(1) }
        ],
        footnote: 'Fluxos do último ano fechado'
      }
    }),
    el('div', { class: 'ae-pol-suppliers' }, [
      dependency.strategic ? badge('Estratégico', { size: 'sm', status: 'warning', variant: 'outline', icon: 'pickaxe' }) : null,
      objectLink(
        { kind: 'good', id: dependency.good, name: dependency.name, status: status === 'neutral' ? undefined : status },
        { showIcon: true, onOpen: () => host.openGood(dependency.good) }
      ),
      ...dependency.suppliers.slice(0, 3).map(supplier => withTooltip(
        el('button', {
          class: `ae-pol-supplier${supplier.hostile ? ' ae-pol-supplier-hostile' : ''}`,
          attrs: { type: 'button' },
          on: { click: () => host.openRealm(supplier.kingdomId) }
        }, [
          el('span', { text: supplier.name }),
          el('strong', { text: pct(supplier.share) })
        ]),
        {
          title: supplier.name,
          value: `${pct(supplier.share)} do que entra`,
          description: supplier.hostile
            ? 'Este fornecedor está em guerra ou hostil a este reino. Um bloqueio custa o abastecimento.'
            : 'Fornecedor deste bem, por parcela do volume de entrada.',
          footnote: 'Clique para abrir o dossiê do reino'
        }
      ))
    ].filter(Boolean) as HTMLElement[]),
    hostile
      ? el('p', {
          class: 'ae-pol-warning-note',
          text: `${pct(hostile.share)} deste bem vem de ${hostile.name}, que está hostil a este reino.`
        })
      : null
  ]);
}

// ============================ WARS ============================

export function buildWars(m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  if (!m.wars.length) {
    return [
      panel({ title: 'Guerras', icon: 'diplomacy' }, [
        emptyState({
          icon: 'diplomacy',
          title: 'Nenhuma guerra em curso',
          hint: 'Este reino está em paz com todos os reinos que conhece.',
          compact: true
        })
      ]),
      buildWarPolitics(m, host)
    ];
  }

  return [
    panel({
      title: 'Guerras em curso',
      icon: 'war',
      subtitle: `${m.wars.length}`
    }, m.wars.map(war => buildWarCard(war, m, host))),

    buildWarPolitics(m, host),
    buildPoliticalChronicle(m, host)
  ];
}

function buildWarCard(war: WarView, m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement {
  const ours = war.citiesChanged.filter(c => c.oursNow);
  const theirs = war.citiesChanged.filter(c => !c.oursNow);

  return el('div', { class: 'ae-pol-war' }, [
    el('div', { class: 'ae-pol-war-head' }, [
      icon('war', { size: 16, class: 'ae-pol-war-icon' }),
      el('div', { class: 'ae-pol-war-title' }, [
        el('span', { class: 'ae-pol-war-name' }, [
          el('span', { text: 'Contra ' }),
          objectLink(
            { kind: 'kingdom', id: war.enemyId, name: war.enemyName, accent: war.enemyColor, status: 'critical' },
            { showIcon: false, onOpen: () => host.openRealm(war.enemyId) }
          )
        ]),
        // `reason` is the only goal the record stores; it is shown as what it is.
        el('span', { class: 'ae-pol-war-goal', text: `Motivo declarado: ${war.war.reason}` })
      ]),
      badgeRow([
        badge(war.aggressor ? 'Agressor' : 'Defensor', { size: 'sm', variant: 'outline' }),
        badge(`${war.years} ano(s)`, { size: 'sm', variant: 'outline', icon: 'calendar' })
      ])
    ]),

    statGrid([
      stat({ label: 'Início', value: `${war.war.startYear}`, icon: 'calendar' }),
      stat({ label: 'Batalhas', value: `${war.war.battles}`, icon: 'swords' }),
      stat({
        label: 'Baixas infligidas', value: formatCompact(war.killsInflicted), icon: 'swords',
        tooltip: { title: 'Baixas infligidas', description: 'Mortes registradas pelo próprio registro de guerra.' }
      }),
      stat({
        label: 'Baixas sofridas', value: formatCompact(war.killsSuffered), icon: 'warning',
        status: war.killsSuffered > war.killsInflicted ? 'critical' : undefined,
        tooltip: { title: 'Baixas sofridas', description: 'Mortes registradas pelo próprio registro de guerra.' }
      }),
      stat({
        label: 'Cansaço de guerra', value: pct(m.warWeariness), icon: 'warning',
        status: inverted(m.warWeariness),
        tooltip: { title: 'Cansaço de guerra', value: pct(m.warWeariness), description: TERMS.warWeariness }
      })
    ]),

    // Economic impact, only what the state proves: the routes this war shut.
    war.routesClosed.length
      ? section('Impacto econômico', [
          rowList(war.routesClosed.slice(0, 6).map(entry => statRow({
            label: GOODS[entry.good]?.name ?? entry.good,
            value: entry.route.volume.toFixed(1),
            unit: 'rota fechada',
            icon: 'trade-route',
            status: 'critical',
            onClick: () => host.openGood(entry.good),
            tooltip: {
              title: `Rota de ${GOODS[entry.good]?.name ?? entry.good}`,
              description: 'Fechada enquanto os dois reinos estiverem em guerra.',
              footnote: 'Clique para abrir o bem na Economia'
            }
          })))
        ], { icon: 'economy', hint: `${war.routesClosed.length} rota(s)` })
      : null,

    war.alliesInvolved.length
      ? section('Aliados também em guerra com este inimigo', [
          el('div', { class: 'ae-pol-treaty-members' }, war.alliesInvolved.map(ally =>
            objectLink({ kind: 'kingdom', id: ally.kingdomId, name: ally.name },
              { showIcon: true, onOpen: () => host.openRealm(ally.kingdomId) })
          ))
        ], { icon: 'alliance' })
      : null,

    war.citiesChanged.length
      ? section('Assentamentos que mudaram de mão', [
          rowList([
            statRow({
              label: 'Sob controle deste reino agora', value: `${ours.length}`, icon: 'city',
              status: ours.length ? 'positive' : undefined,
              tooltip: { title: 'Sob nosso controle', description: ours.length ? ours.map(c => c.name).join(', ') : 'Nenhum.' }
            }),
            statRow({
              label: 'Fora do controle deste reino', value: `${theirs.length}`, icon: 'warning',
              status: theirs.length ? 'critical' : undefined,
              tooltip: { title: 'Fora do nosso controle', description: theirs.length ? theirs.map(c => c.name).join(', ') : 'Nenhum.' }
            }),
            ...war.citiesChanged.slice(0, 6).map(city => el('div', { class: 'ae-row' }, [
              icon('city', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label' }, [
                objectLink(
                  { kind: 'city', id: city.id, name: city.name, status: city.oursNow ? undefined : 'critical' },
                  { showIcon: false, onOpen: () => host.openCity(city.id) }
                )
              ]),
              el('span', { class: 'ae-row-value' }, [
                el('span', { class: 'ae-row-unit', text: city.oursNow ? 'deste reino' : 'de outro' })
              ])
            ]))
          ])
        ], {
          icon: 'city',
          hint: `${war.citiesChanged.length} registrado(s) na crônica`
        })
      : null,

    el('div', { class: 'ae-pol-war-actions' }, [
      button('Dossiê do inimigo', () => host.openRealm(war.enemyId), { variant: 'secondary', size: 'sm', icon: 'kingdom' }),
      button('Tela de guerra', () => host.openWarfare(), {
        variant: 'ghost', size: 'sm', icon: 'war',
        tooltip: { title: 'Guerra', description: 'Abre a tela de exércitos, cercos e campanhas.' }
      })
    ])
  ]);
}

/**
 * What the war is doing to the regime.
 *
 * All four figures are recorded state: the society tick's war and peace pressure,
 * the realm's weariness, and each faction's own war support.
 */
function buildWarPolitics(m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement {
  const military = m.factions.find(f => f.id === 'military');
  const workers = m.factions.find(f => f.id === 'workers');

  return panel({
    title: 'A guerra na política interna',
    icon: 'politics',
    subtitle: m.wars.length ? 'Como o conflito pesa sobre o regime' : 'Como a paz pesa sobre o regime'
  }, [
    statGrid([
      stat({
        label: 'Cansaço de guerra', value: pct(m.warWeariness), icon: 'warning',
        status: inverted(m.warWeariness),
        tooltip: { title: 'Cansaço de guerra', description: TERMS.warWeariness }
      }),
      stat({
        label: 'Pressão por guerra', value: pct(m.society.warPressure), icon: 'war',
        tooltip: { title: 'Pressão por guerra', description: 'Facções empurrando o reino ao conflito. Sem cor: não é bom nem ruim em si.' }
      }),
      stat({
        label: 'Pressão por paz', value: pct(m.society.peacePressure), icon: 'diplomacy',
        tooltip: { title: 'Pressão por paz', description: 'Facções empurrando o reino a encerrar a guerra.' }
      }),
      military
        ? stat({
            label: 'Apoio dos militares', value: pct(military.state.satisfaction), icon: 'swords',
            status: military.state.satisfaction < 0.4 ? 'warning' : undefined,
            onClick: () => host.focusFaction('military'),
            tooltip: { title: 'Satisfação dos militares', description: 'Quando cai com o exército mobilizado, o risco de golpe sobe.' }
          })
        : null,
      workers
        ? stat({
            label: 'Satisfação dos trabalhadores', value: pct(workers.state.satisfaction), icon: 'industry',
            status: workers.state.satisfaction < 0.4 ? 'warning' : undefined,
            onClick: () => host.focusFaction('workers')
          })
        : null,
      stat({
        label: 'Risco de golpe', value: pct(m.society.coupRisk), icon: 'war',
        status: inverted(m.society.coupRisk)
      })
    ].filter(Boolean) as HTMLElement[])
  ]);
}

// ============================ GEOPOLITICAL PRESSURES ============================

export function buildGeopolitics(m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  const pressures = geopoliticalPressures(m, 8);

  return [
    pressures.length
      ? buildGeoPressures(pressures, host)
      : panel({ title: 'Pressões geopolíticas', icon: 'diplomacy' }, [
          emptyState({
            icon: 'diplomacy',
            title: 'Nenhuma pressão geopolítica',
            hint: 'Nenhuma dependência hostil, guerra em duas frentes, embargo ou aliança sob tensão.',
            compact: true
          })
        ]),

    ...buildDependencies(m, host)
  ];
}

function buildGeoPressures(pressures: GeopoliticalPressure[], host: PoliticsScreenHost): HTMLElement {
  return panel({
    title: 'Pressões geopolíticas',
    icon: 'alert',
    subtitle: `${pressures.length} ranqueada(s) por gravidade`,
    class: 'ae-pol-critical'
  }, pressures.map(pressure => el('div', { class: `ae-pol-pressure ae-pol-pressure-${pressure.severity}` }, [
    el('div', { class: 'ae-pol-pressure-head' }, [
      icon(pressure.icon, { size: 16, class: 'ae-pol-pressure-icon' }),
      el('div', { class: 'ae-pol-pressure-text' }, [
        el('span', { class: 'ae-pol-pressure-label', text: pressure.label }),
        el('span', { class: 'ae-pol-pressure-detail', text: pressure.detail })
      ]),
      el('div', { class: 'ae-pol-pressure-actions' }, [
        pressure.good
          ? miniButton('crate', GOODS[pressure.good]?.name ?? pressure.good, 'Abrir este bem na Economia.', () => host.openGood(pressure.good!))
          : null,
        pressure.kingdomId
          ? miniButton('kingdom', 'Dossiê do reino', 'Abre o dossiê deste reino.', () => host.openRealm(pressure.kingdomId!))
          : null
      ])
    ])
  ])));
}
