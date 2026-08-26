/**
 * The dossier's tabs.
 *
 * Each builder takes the precomputed metrics and returns DOM. None of them touch
 * the simulation — every figure arrives already aggregated, which is what keeps
 * the expensive work on a cadence and out of the render path.
 *
 * The ordering rule throughout is the brief's: **problems first, then summary,
 * then detail.** A city that is starving says so above its temple level.
 */
import { el, Child } from '../core/Dom';
import {
  panel, section, divider, statRow, rowList, statGrid, stat, progressBar,
  badge, badgeRow, table, emptyState, objectLink, icon, withTooltip, button,
  formatCompact, formatFull, formatPercent, trendIndicator,
  type Status, type Column
} from '../kit';
import { BUILDINGS, type BuildingCategory } from '../../civ/Building';
import { GOODS, type GoodId } from '../../civ/Goods';
import { chronicle } from '../../civ/Chronicle';
import { STRATEGIC_GOODS, type CityMetrics, type GoodPosition, type Bottleneck } from './CityMetrics';
import { diagnose, problems, importDependencies, type Condition } from './Diagnostics';
import type { CityScreenHost } from '../screens/CityScreen';
import type { City } from '../../civ/City';

const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  core: 'Cívico',
  food: 'Alimento',
  extraction: 'Extração',
  craft: 'Manufatura',
  knowledge: 'Conhecimento',
  commerce: 'Comércio',
  infrastructure: 'Infraestrutura',
  power: 'Energia'
};

const CATEGORY_ICON: Record<BuildingCategory, string> = {
  core: 'politics', food: 'agriculture', extraction: 'pickaxe', craft: 'industry',
  knowledge: 'technology', commerce: 'economy', infrastructure: 'trade-route', power: 'power'
};

const PROFESSION_LABEL: Record<string, string> = {
  farmer: 'Agricultores', woodcutter: 'Lenhadores', miner: 'Mineiros', builder: 'Construtores',
  soldier: 'Soldados', archer: 'Arqueiros', scout: 'Batedores', healer: 'Curandeiros',
  leader: 'Líderes', king: 'Monarcas', none: 'Sem ofício'
};

/** Maps a condition's verdict onto a kit status, treating unknown as neutral. */
function statusOf(condition: Condition): Status {
  return condition.status === 'unknown' ? 'neutral' : condition.status;
}

// ============================ OVERVIEW ============================

export function buildOverview(city: City, metrics: CityMetrics, host: CityScreenHost): Child[] {
  const conditions = diagnose(metrics);
  const urgent = problems(conditions);
  // The problems block and the full list are complementary, not overlapping: what
  // is already called out at the top is not repeated below. Listing a starving
  // city's food line twice on one screen doubles the noise and halves the trust in
  // both copies.
  const settled = conditions.filter(c => !urgent.includes(c));

  return [
    // Problems first — literally. If nothing is wrong this block is absent, and
    // the screen opens on the summary instead.
    urgent.length
      ? panel({
          title: 'Precisa de atenção',
          icon: 'alert',
          subtitle: `${urgent.length} condição(ões) fora do normal`,
          class: 'ae-city-urgent'
        }, urgent.map(condition => buildConditionRow(condition, host)))
      : null,

    panel({ title: 'Resumo', icon: 'city' }, [
      statGrid([
        stat({
          label: 'População', value: metrics.demographics.population, icon: 'population',
          tooltip: {
            title: 'População',
            value: formatFull(metrics.demographics.population),
            description: 'Figura que o assentamento mantém e sobre a qual a economia opera.',
            rows: [{ label: 'Habitantes simulados', value: `${metrics.demographics.tracked}` }],
            footnote: metrics.demographics.tracked !== metrics.demographics.population
              ? 'A contagem de entidades pode divergir da população do assentamento'
              : undefined
          }
        }),
        stat({
          label: 'Prosperidade', value: formatPercent(metrics.prosperity), icon: 'economy',
          status: metrics.prosperity >= 0.6 ? 'positive' : metrics.prosperity >= 0.35 ? 'neutral' : 'warning',
          tooltip: {
            title: 'Prosperidade',
            value: formatPercent(metrics.prosperity),
            // No breakdown is offered because the engine exposes only the result.
            // Inventing contributing factors here would be the exact failure the
            // brief warns against.
            description: 'Índice de 0 a 100% mantido pela simulação. A engine expõe apenas o resultado, sem decomposição — por isso não há detalhamento de fatores aqui.',
            footnote: 'Sem decomposição disponível na simulação'
          }
        }),
        stat({
          label: 'Segurança alimentar',
          value: metrics.food.security === null ? '—' : formatPercent(metrics.food.security),
          icon: 'agriculture',
          // A declared famine outranks the ratio, exactly as the condition does.
          // A city can be importing its way back to 81% coverage and still have
          // people going hungry, and the summary must not contradict the verdict
          // three rows above it.
          status: metrics.famineYears > 0
            ? 'critical'
            : metrics.food.security === null
              ? undefined
              : metrics.food.security >= 1 ? 'positive' : metrics.food.security >= 0.85 ? 'warning' : 'critical',
          tooltip: {
            title: 'Segurança alimentar',
            value: metrics.food.security === null ? 'sem dados' : formatPercent(metrics.food.security),
            description: '(produzido + importado) ÷ (consumido + exportado), do último ano fechado. 100% significa que a cidade se sustenta exatamente.',
            rows: [
              { label: 'Produzido', value: metrics.food.produced.toFixed(1) },
              { label: 'Importado', value: metrics.food.imported.toFixed(1) },
              { label: 'Consumido', value: metrics.food.consumed.toFixed(1) },
              { label: 'Exportado', value: metrics.food.exported.toFixed(1) }
            ],
            footnote: metrics.famineYears > 0
              ? `Fome declarada há ${metrics.famineYears} ano(s) — a taxa cobre a demanda registrada, mas há gente passando fome`
              : metrics.food.security === null ? 'Nenhum ano fechado ainda' : undefined
          }
        }),
        stat({
          label: 'Emprego',
          value: metrics.employment.rate === null ? '—' : formatPercent(metrics.employment.rate),
          icon: 'industry',
          status: metrics.employment.rate === null
            ? undefined
            : metrics.employment.rate >= 0.8 ? 'positive' : metrics.employment.rate >= 0.5 ? 'neutral' : 'warning',
          tooltip: {
            title: 'Emprego',
            description: 'Postos ocupados ÷ adultos residentes.',
            rows: [
              { label: 'Adultos', value: `${metrics.employment.workers}` },
              { label: 'Postos', value: `${metrics.employment.jobs}` },
              { label: 'Ocupados', value: `${metrics.employment.filled}` }
            ]
          }
        }),
        stat({
          label: 'Produção econômica', value: formatCompact(metrics.economicOutput), icon: 'economy',
          tooltip: { title: 'Produção econômica', description: 'Valor econômico que a simulação atribui ao assentamento no último ciclo.' }
        }),
        stat({
          label: 'Moradia',
          value: metrics.housingPressure === null ? '—' : formatPercent(metrics.housingPressure),
          icon: 'building',
          status: metrics.housingPressure === null
            ? 'critical'
            : metrics.housingPressure <= 1 ? 'positive' : 'warning',
          tooltip: {
            title: 'Ocupação habitacional',
            description: 'População ÷ capacidade das moradias construídas.',
            rows: [
              { label: 'População', value: `${metrics.demographics.population}` },
              { label: 'Capacidade', value: `${metrics.housingCapacity}` }
            ]
          }
        })
      ])
    ]),

    // The rest, so the player can confirm what is fine rather than inferring it
    // from absence. Absent entirely when every condition was already urgent.
    settled.length
      ? panel({
          title: urgent.length ? 'Demais condições' : 'Condições da cidade',
          icon: 'statistics',
          subtitle: urgent.length ? 'Sem problemas registrados' : undefined
        }, settled.map(condition => buildConditionRow(condition, host)))
      : null,

    metrics.bottlenecks.length
      ? buildBottlenecks(metrics.bottlenecks, host)
      : null
  ];
}

/**
 * One condition: verdict, finding, and the arithmetic behind it on hover.
 *
 * The terms are the "why". They are shown as tooltip rows rather than inline so
 * six conditions do not become forty lines — the finding carries the headline and
 * the derivation is one hover away.
 */
function buildConditionRow(condition: Condition, host: CityScreenHost): HTMLElement {
  const status = statusOf(condition);
  const clickable = Boolean(condition.good);

  const node = el(clickable ? 'button' : 'div', {
    class: [
      'ae-city-condition',
      `ae-city-condition-${status}`,
      clickable ? 'ae-city-condition-live' : ''
    ].filter(Boolean).join(' '),
    dataset: { conditionId: condition.id },
  }, [
    icon(condition.icon, { size: 16, class: 'ae-city-condition-icon' }),
    el('div', { class: 'ae-city-condition-text' }, [
      el('span', { class: 'ae-city-condition-label', text: condition.label }),
      el('span', { class: 'ae-city-condition-finding', text: condition.finding })
    ]),
    badge(verdictLabel(condition.status), { size: 'sm', status: status, variant: 'outline' })
  ]);

  return withTooltip(node, {
    title: condition.label,
    description: condition.finding,
    icon: condition.icon,
    rows: condition.terms,
    footnote: condition.status === 'unknown'
      ? 'Sem dados suficientes para um diagnóstico'
      : clickable ? 'Clique para abrir o bem na Economia' : undefined
  });
}

function verdictLabel(status: Condition['status']): string {
  return { positive: 'Estável', neutral: 'Normal', warning: 'Atenção', critical: 'Crítico', unknown: 'Sem dados' }[status];
}

/**
 * Bottlenecks — the most actionable block on the screen.
 *
 * Each row states what is blocked and what is blocking it, and offers the two
 * follow-ups that actually help: open the good that is short, or go look at the
 * building that is stuck.
 */
function buildBottlenecks(bottlenecks: Bottleneck[], host: CityScreenHost): HTMLElement {
  return panel({
    title: 'Gargalos econômicos',
    icon: 'alert',
    subtitle: `${bottlenecks.length} identificado(s) a partir de estoque, pessoal e depósitos reais`
  }, bottlenecks.slice(0, 8).map(bottleneck => el('div', {
    class: `ae-city-bottleneck ae-city-bottleneck-${bottleneck.severity}`
  }, [
    icon(bottleneckIcon(bottleneck.kind), { size: 16, class: 'ae-city-bottleneck-icon' }),
    el('div', { class: 'ae-city-bottleneck-text' }, [
      el('span', { class: 'ae-city-bottleneck-subject', text: bottleneck.subject }),
      el('span', { class: 'ae-city-bottleneck-cause', text: bottleneck.cause })
    ]),
    el('div', { class: 'ae-city-bottleneck-actions' }, [
      bottleneck.building
        ? withTooltip(
            el('button', {
              class: 'ae-city-mini-btn',
              attrs: { type: 'button', 'aria-label': 'Ir para a construção' },
              on: { click: () => host.goToBuilding(bottleneck.building!.id, bottleneck.building!.x, bottleneck.building!.y) }
            }, [icon('map', { size: 16 })]),
            { title: 'Ir até lá', description: 'Fecha a tela, centraliza a câmera e seleciona a construção.' }
          )
        : null
    ])
  ])));
}

function bottleneckIcon(kind: Bottleneck['kind']): string {
  return {
    'missing-input': 'good',
    'no-workers': 'population',
    'understaffed': 'population',
    'depleted-deposit': 'pickaxe'
  }[kind];
}

// ============================ POPULATION ============================

export function buildPopulation(city: City, metrics: CityMetrics, host: CityScreenHost): Child[] {
  const d = metrics.demographics;
  const e = metrics.employment;
  const stages = [
    { label: 'Bebês', count: d.infants, icon: 'citizen' },
    { label: 'Crianças', count: d.children, icon: 'citizen' },
    { label: 'Adolescentes', count: d.adolescents, icon: 'citizen' },
    { label: 'Adultos', count: d.adults, icon: 'population' },
    { label: 'Idosos', count: d.elders, icon: 'population' }
  ].filter(s => s.count > 0);

  const maxProfession = d.byProfession[0]?.count ?? 1;

  return [
    panel({ title: 'Composição', icon: 'population', subtitle: `${d.tracked} habitante(s) simulado(s)` }, [
      stages.length
        ? rowList(stages.map(s => statRow({
            label: s.label, value: `${s.count}`, icon: s.icon,
            unit: d.tracked > 0 ? formatPercent(s.count / d.tracked) : undefined
          })))
        : emptyState({ icon: 'population', title: 'Nenhum habitante simulado', hint: 'A população do assentamento não tem entidades associadas.', compact: true })
    ]),

    /**
     * Employment, with unemployment and labour shortage kept visibly separate.
     * Both figures are always shown even when one is zero, because seeing the
     * zero is what makes the other one meaningful.
     */
    panel({ title: 'Emprego', icon: 'industry' }, [
      statGrid([
        stat({ label: 'Adultos', value: e.workers, icon: 'population' }),
        stat({ label: 'Postos', value: e.jobs, icon: 'industry' }),
        stat({ label: 'Ocupados', value: e.filled, icon: 'industry', status: 'positive' })
      ]),
      divider(),
      rowList([
        statRow({
          label: 'Sem trabalho', value: `${e.unemployed}`, icon: 'citizen',
          status: e.unemployed > 0 ? 'warning' : 'positive',
          tooltip: {
            title: 'Desemprego',
            value: `${e.unemployed}`,
            description: 'Adultos residentes que não ocupam nenhum posto. Adultos − postos ocupados.',
            rows: [
              { label: 'Adultos', value: `${e.workers}` },
              { label: 'Postos ocupados', value: `${e.filled}` }
            ]
          }
        }),
        statRow({
          label: 'Vagas abertas', value: `${e.vacancies}`, icon: 'industry',
          status: e.vacancies > 0 ? 'warning' : 'positive',
          tooltip: {
            title: 'Falta de mão de obra',
            value: `${e.vacancies}`,
            description: 'Postos que existem e ninguém preenche. Problema oposto ao desemprego: aqui falta gente, não falta trabalho.',
            rows: [
              { label: 'Postos', value: `${e.jobs}` },
              { label: 'Ocupados', value: `${e.filled}` }
            ]
          }
        })
      ]),
      e.rate !== null
        ? progressBar({
            label: 'Taxa de ocupação',
            value: e.rate,
            valueText: formatPercent(e.rate),
            status: e.rate >= 0.8 ? 'positive' : e.rate >= 0.5 ? 'neutral' : 'warning'
          })
        : null
    ]),

    d.byProfession.length
      ? panel({ title: 'Ofícios', icon: 'industry', subtitle: `${d.byProfession.length} ofício(s) exercido(s)` }, [
          el('div', { class: 'ae-city-bars' }, d.byProfession.map(entry => withTooltip(
            el('div', { class: 'ae-city-bar-row' }, [
              el('span', { class: 'ae-city-bar-label', text: PROFESSION_LABEL[entry.profession] ?? entry.profession }),
              el('div', { class: 'ae-city-bar-track' }, [
                el('div', { class: 'ae-city-bar-fill', style: { width: `${(entry.count / maxProfession) * 100}%` } })
              ]),
              el('span', { class: 'ae-city-bar-value', text: `${entry.count}` })
            ]),
            {
              title: PROFESSION_LABEL[entry.profession] ?? entry.profession,
              value: `${entry.count}`,
              description: d.tracked > 0
                ? `${formatPercent(entry.count / d.tracked)} dos habitantes simulados.`
                : undefined
            }
          )))
        ])
      : null
  ];
}

// ============================ ECONOMY ============================

export function buildEconomy(city: City, metrics: CityMetrics, host: CityScreenHost): Child[] {
  const critical = metrics.shortages;
  const strategic = metrics.goods.filter(p => STRATEGIC_GOODS.includes(p.good));
  const major = metrics.goods.filter(p => p.stock > 0.05).slice(0, 8);
  const dependencies = importDependencies(metrics);

  return [
    panel({ title: 'Balança da cidade', icon: 'economy' }, [
      statGrid([
        stat({ label: 'Produção econômica', value: formatCompact(metrics.economicOutput), icon: 'economy' }),
        stat({ label: 'Pesquisa', value: formatCompact(metrics.researchOutput), icon: 'technology' }),
        stat({ label: 'Bens movimentados', value: metrics.goods.length, icon: 'good' })
      ]),
      el('p', { class: 'ae-city-note', text: 'Fluxos são do último ano fechado. O ano em curso só entra nos livros quando termina.' })
    ]),

    critical.length
      ? panel({
          title: 'Em falta',
          icon: 'alert',
          subtitle: 'Consumo acima da chegada — o estoque está sendo drenado'
        }, [buildGoodsTable(critical, host)])
      : null,

    strategic.length
      ? panel({ title: 'Estratégicos', icon: 'industry' }, [buildGoodsTable(strategic, host)])
      : null,

    major.length
      ? panel({
          title: 'Maiores estoques',
          icon: 'good',
          subtitle: metrics.goods.length > major.length ? `${major.length} de ${metrics.goods.length}` : undefined,
          actions: metrics.goods.length > major.length
            ? [button('Ver todos os bens', () => host.showAllGoods(), { variant: 'ghost', size: 'sm', icon: 'good' })]
            : undefined
        }, [buildGoodsTable(major, host)])
      : emptyState({
          icon: 'good',
          title: 'Nada estocado nem movimentado',
          hint: 'Este assentamento ainda não produziu, consumiu nem comerciou nada registrável.'
        }),

    /**
     * Import dependency: the figure that decides whether a blockade is a
     * nuisance or a catastrophe. Read straight from the ledger.
     */
    dependencies.length
      ? panel({
          title: 'Dependência de importação',
          icon: 'trade-route',
          subtitle: 'Parcela do consumo que veio de fora'
        }, dependencies.slice(0, 6).map(dep => progressBar({
          label: dep.name,
          value: dep.share,
          valueText: formatPercent(dep.share),
          status: dep.share >= 0.75 ? 'critical' : dep.share >= 0.5 ? 'warning' : 'neutral',
          tooltip: {
            title: dep.name,
            value: formatPercent(dep.share),
            description: 'Importado ÷ (consumido + exportado), do último ano fechado.',
            rows: [
              { label: 'Consumido', value: dep.consumed.toFixed(1) },
              { label: 'Produzido aqui', value: dep.produced.toFixed(1) },
              { label: 'Importado', value: dep.imported.toFixed(1) }
            ]
          }
        })))
      : null
  ];
}

/** A goods table. Every row links the good onward. */
export function buildGoodsTable(positions: GoodPosition[], host: CityScreenHost): HTMLElement {
  const columns: Column<GoodPosition>[] = [
    {
      key: 'good', header: 'Bem',
      cell: p => objectLink({ kind: 'good', id: p.good, name: GOODS[p.good]?.name ?? p.good }, { showIcon: false }),
      sortValue: p => GOODS[p.good]?.name ?? p.good
    },
    { key: 'stock', header: 'Estoque', align: 'right', width: '84px', cell: p => formatCompact(p.stock), sortValue: p => p.stock },
    { key: 'prod', header: 'Produz', align: 'right', width: '76px', cell: p => p.flow.produced.toFixed(1), sortValue: p => p.flow.produced },
    { key: 'cons', header: 'Consome', align: 'right', width: '80px', cell: p => p.flow.consumed.toFixed(1), sortValue: p => p.flow.consumed },
    {
      key: 'net', header: 'Saldo', align: 'right', width: '80px',
      cell: p => trendIndicator({
        delta: p.net,
        text: `${p.net >= 0 ? '+' : '−'}${Math.abs(p.net).toFixed(1)}`,
        compact: true
      }),
      sortValue: p => p.net
    }
  ];

  return table({
    columns,
    rows: positions,
    rowKey: p => p.good,
    sortBy: 'stock',
    status: p => (p.net < -0.01 ? 'critical' : p.net > 0.01 ? 'positive' : undefined),
    rowTooltip: p => ({
      title: GOODS[p.good]?.name ?? p.good,
      value: formatCompact(p.stock),
      description: GOODS[p.good]?.description,
      rows: [
        { label: 'Produzido', value: p.flow.produced.toFixed(1) },
        { label: 'Importado', value: p.flow.imported.toFixed(1) },
        { label: 'Consumido', value: p.flow.consumed.toFixed(1) },
        { label: 'Exportado', value: p.flow.exported.toFixed(1) },
        { label: 'Saldo', value: `${p.net >= 0 ? '+' : '−'}${Math.abs(p.net).toFixed(1)}`, status: p.net >= 0 ? 'positive' : 'critical' }
      ],
      footnote: 'Fluxos do último ano fechado'
    }),
    empty: emptyState({ icon: 'good', title: 'Nenhum bem', hint: 'Nada a mostrar aqui.', compact: true })
  });
}

// ============================ INDUSTRY ============================

export function buildIndustry(city: City, metrics: CityMetrics, host: CityScreenHost): Child[] {
  const productive = metrics.sectors.filter(s => s.ratedOutput.length > 0 || s.jobs > 0);

  if (!productive.length) {
    return [emptyState({
      icon: 'industry',
      title: 'Sem indústria',
      hint: 'Este assentamento não tem construções produtivas nem postos de trabalho.'
    })];
  }

  return [
    metrics.bottlenecks.length ? buildBottlenecks(metrics.bottlenecks, host) : null,

    panel({ title: 'Setores', icon: 'industry', subtitle: `${productive.length} setor(es)` },
      productive.map(sector => section(CATEGORY_LABEL[sector.category] ?? sector.category, [
        el('div', { class: 'ae-city-sector-figures' }, [
          statRow({ label: 'Construções', value: `${sector.buildings}`, icon: CATEGORY_ICON[sector.category] }),
          sector.jobs > 0
            ? statRow({
                label: 'Pessoal', value: `${sector.workers} / ${sector.jobs}`, icon: 'population',
                status: sector.workers >= sector.jobs ? 'positive' : sector.workers > 0 ? 'warning' : 'critical'
              })
            : null,
          sector.utilization !== null
            ? progressBar({
                label: 'Utilização da capacidade',
                value: sector.utilization,
                valueText: formatPercent(sector.utilization),
                status: sector.utilization >= 0.8 ? 'positive' : sector.utilization >= 0.4 ? 'neutral' : 'warning',
                tooltip: {
                  title: 'Utilização',
                  description: 'Postos ocupados ÷ postos existentes no setor. A produção escala com isso.'
                }
              })
            : null
        ].filter(Boolean) as HTMLElement[]),
        sector.ratedOutput.length
          ? rowList(sector.ratedOutput.slice(0, 4).map(output => statRow({
              label: GOODS[output.good]?.name ?? output.good,
              value: output.amount.toFixed(1),
              unit: '/ ano',
              icon: 'good',
              tooltip: {
                title: GOODS[output.good]?.name ?? output.good,
                value: `${output.amount.toFixed(1)} / ano`,
                description: 'Capacidade nominal: valor de base das construções escalado por nível e ocupação. A simulação registra produção por assentamento, não por construção.',
                footnote: 'Capacidade, não produção efetiva'
              }
            })))
          : null
      ], { icon: CATEGORY_ICON[sector.category], hint: sector.ratedOutput.length ? 'capacidade nominal' : undefined }))
    ),

    buildUtilizationTable(city, metrics, host)
  ];
}

/** Per-building utilisation, for the productive buildings only. */
function buildUtilizationTable(city: City, metrics: CityMetrics, host: CityScreenHost): HTMLElement | null {
  interface Row {
    id: string; name: string; level: number; workers: number; jobs: number;
    utilization: number | null; constraint: string; x: number; y: number;
  }

  const rows: Row[] = [];
  for (const building of city.buildings.values()) {
    const def = BUILDINGS[building.type];
    if (!def) continue;
    const jobs = (def.jobs ?? 0) * building.level;
    // Only buildings that produce or employ; a wall has no utilisation.
    if (jobs === 0 && !def.produces && !def.craftCapacity) continue;

    const blocker = metrics.bottlenecks.find(b => b.building?.id === building.id);
    rows.push({
      id: building.id,
      name: def.name ?? building.type,
      level: building.level,
      workers: building.assignedWorkerIds.size,
      jobs,
      utilization: jobs > 0 ? Math.min(1, building.assignedWorkerIds.size / jobs) : null,
      constraint: blocker ? blocker.cause : '—',
      x: building.x, y: building.y
    });
  }
  if (!rows.length) return null;

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Construção', cell: r => r.name, sortValue: r => r.name },
    { key: 'level', header: 'Nv.', align: 'right', width: '48px', cell: r => `${r.level}`, sortValue: r => r.level },
    {
      key: 'staff', header: 'Pessoal', align: 'right', width: '84px',
      cell: r => (r.jobs > 0 ? `${r.workers} / ${r.jobs}` : '—'),
      sortValue: r => (r.jobs > 0 ? r.workers / r.jobs : -1)
    },
    {
      key: 'util', header: 'Uso', align: 'right', width: '68px',
      cell: r => (r.utilization === null ? '—' : formatPercent(r.utilization)),
      sortValue: r => r.utilization ?? -1
    },
    { key: 'constraint', header: 'Impedimento', cell: r => r.constraint, sortValue: r => r.constraint }
  ];

  return panel({
    title: 'Uso das construções',
    icon: 'building',
    subtitle: `${rows.length} construção(ões) produtiva(s)`,
    padded: false
  }, [
    table({
      columns, rows,
      rowKey: r => r.id,
      sortBy: 'util', sortDir: 'asc',
      onRowClick: r => host.goToBuilding(r.id, r.x, r.y),
      status: r => (r.constraint !== '—' ? 'warning' : undefined),
      rowTooltip: r => ({
        title: r.name,
        description: r.constraint !== '—' ? r.constraint : 'Sem impedimentos registrados.',
        rows: [
          { label: 'Nível', value: `${r.level}` },
          ...(r.jobs > 0 ? [{ label: 'Pessoal', value: `${r.workers} / ${r.jobs}` }] : [])
        ],
        footnote: 'Clique para ir até a construção'
      })
    })
  ]);
}

// ============================ TRADE ============================

const ROAD_LEVEL_LABEL: Record<number, string> = {
  1: 'Trilha de terra', 2: 'Via de pedra', 3: 'Estrada imperial'
};


// ============================ BUILDINGS ============================

export function buildBuildings(city: City, metrics: CityMetrics, host: CityScreenHost): Child[] {
  if (!metrics.buildingsByCategory.length) {
    return [emptyState({
      icon: 'building',
      title: 'Nada construído',
      hint: 'Este assentamento ainda não ergueu nenhuma construção.'
    })];
  }

  return [
    panel({ title: 'Construções', icon: 'building', subtitle: `${city.buildings.size} no total` }, [
      badgeRow(metrics.buildingsByCategory.map(group =>
        badge(`${CATEGORY_LABEL[group.category] ?? group.category} ${group.buildings.length}`, {
          size: 'sm', variant: 'outline', icon: CATEGORY_ICON[group.category]
        })
      ))
    ]),

    ...metrics.buildingsByCategory.map(group => panel({
      title: CATEGORY_LABEL[group.category] ?? group.category,
      icon: CATEGORY_ICON[group.category],
      subtitle: `${group.buildings.length}`
    }, [
      rowList(group.buildings.map(building => {
        const def = BUILDINGS[building.type];
        const jobs = (def?.jobs ?? 0) * building.level;
        const blocker = metrics.bottlenecks.find(b => b.building?.id === building.id);

        return el('div', { class: 'ae-row' }, [
          icon('building', { size: 16, class: 'ae-row-icon' }),
          el('span', { class: 'ae-row-label' }, [
            objectLink(
              { kind: 'building', id: building.id, name: def?.name ?? building.type, status: blocker ? blocker.severity : undefined },
              { showIcon: false }
            )
          ]),
          el('span', { class: 'ae-row-value' }, [
            building.level > 1 ? el('span', { class: 'ae-row-unit', text: `Nv. ${building.level}` }) : null,
            jobs > 0
              ? el('span', { class: 'ae-row-figure', text: `${building.assignedWorkerIds.size}/${jobs}` })
              : null,
            withTooltip(
              el('button', {
                class: 'ae-city-mini-btn',
                attrs: { type: 'button', 'aria-label': 'Ir para a construção' },
                on: { click: () => host.goToBuilding(building.id, building.x, building.y) }
              }, [icon('map', { size: 16 })]),
              { title: 'Ir até lá', description: 'Fecha a tela e centraliza a câmera nesta construção.' }
            )
          ])
        ]);
      }))
    ]))
  ];
}

// ============================ HISTORY ============================

/**
 * The city's history, from the Chronicle's structured references.
 *
 * `getEventsForRef('city', id)` is a reference lookup — not a text search for the
 * city's name, which would match every namesake and miss every event that
 * referred to it obliquely. Minor entries are filtered out: a settlement's own
 * page should carry the events that mattered to it.
 */
export function buildHistory(city: City, metrics: CityMetrics, host: CityScreenHost): Child[] {
  const all = chronicle.getEventsForRef('city', city.id);
  const notable = all
    .filter(e => e.importance !== 'minor')
    .sort((a, b) => b.year - a.year);

  const IMPORTANCE_PT: Record<string, string> = { minor: 'menor', normal: 'normal', major: 'maior', legendary: 'lendária' };

  if (!all.length) {
    return [emptyState({
      icon: 'history',
      title: 'Nenhum registro',
      hint: `Nada foi registrado sobre ${city.name} ainda. A crônica guarda o que acontece — avance o tempo.`
    })];
  }

  return [
    panel({
      title: 'História',
      icon: 'history',
      subtitle: `${notable.length} evento(s) relevante(s) de ${all.length} registro(s)`,
      actions: [button('Crônica completa', () => host.openChronicle(), { variant: 'ghost', size: 'sm', icon: 'history' })]
    }, [
      notable.length
        ? el('div', { class: 'ae-city-timeline' }, notable.slice(0, 20).map(event => withTooltip(
            el('div', { class: `ae-city-event ae-city-event-${event.importance}` }, [
              el('span', { class: 'ae-city-event-year', text: `${event.year}` }),
              el('div', { class: 'ae-city-event-body' }, [
                el('span', { class: 'ae-city-event-title', text: event.title ?? event.text }),
                event.title ? el('span', { class: 'ae-city-event-text', text: event.text }) : null
              ]),
              badge(event.type, { size: 'sm', variant: 'outline' })
            ]),
            {
              title: event.title ?? `Ano ${event.year}`,
              description: event.text,
              icon: 'history',
              rows: [
                { label: 'Ano', value: `${event.year}` },
                { label: 'Importância', value: IMPORTANCE_PT[event.importance] ?? event.importance },
                { label: 'Tipo', value: event.type }
              ],
              footnote: event.causes.length ? `Causa: ${event.causes[0]}` : undefined
            }
          )))
        : emptyState({
            icon: 'history',
            title: 'Só registros menores',
            hint: `${all.length} registro(s) de baixa relevância. A crônica completa tem tudo.`,
            compact: true
          })
    ])
  ];
}
