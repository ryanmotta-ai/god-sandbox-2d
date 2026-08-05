/**
 * The realm dossier's tabs.
 *
 * Each builder is handed metrics that are already computed and returns DOM. None
 * of them touch the simulation, which is what keeps counting an entire realm's
 * population off the render path — see `RealmMetricsCache`.
 *
 * Two rules run through all of it.
 *
 * **Problems first, then structure, then detail.** The overview opens on what is
 * wrong, capped at five items, because a realm with thirty warnings has told the
 * player nothing.
 *
 * **Nothing is invented.** Where the simulation records a figure it is shown with
 * its derivation on hover. Where it does not, the row is absent — there is no
 * "industry score", no fabricated casualty count, no imagined dynastic tree.
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
import { GOVERNMENTS } from '../../civ/Government';
import { LAW_CATEGORY_ORDER, type LawCategory, type LawDefinition, type LawEffects } from '../../civ/Laws';
import { SOCIAL_FACTIONS, type FactionState, type SocialFactionId } from '../../civ/Society';
import { TECH_ERAS } from '../../civ/TechTree';
import { chronicle } from '../../civ/Chronicle';
import {
  diagnoseRealm, realmProblems, criticalIssues, negativeFactors, positiveFactors,
  type RealmCondition, type CriticalIssue
} from './RealmDiagnostics';
import {
  MILITARY_GOODS,
  type RealmMetrics, type RealmGoodPosition, type CitySummary, type EconomicRole,
  type Relationship, type WarSummary, type InfraBottleneck, type IndustrySector
} from './RealmMetrics';
import type { RealmScreenHost } from '../screens/RealmScreen';

// ============================ VOCABULARY ============================

const ROLE_LABEL: Record<EconomicRole, string> = {
  capital: 'Capital',
  industrial: 'Industrial',
  mining: 'Mineradora',
  agricultural: 'Agrícola',
  port: 'Portuária',
  'trade-hub': 'Entreposto',
  knowledge: 'Erudita',
  settlement: 'Povoado'
};

const ROLE_EXPLAIN: Record<EconomicRole, string> = {
  capital: 'Sede do governo. A função administrativa se sobrepõe a qualquer outra que a cidade também exerça.',
  industrial: 'Duas ou mais oficinas de manufatura.',
  mining: 'Duas ou mais construções de extração.',
  agricultural: 'Duas ou mais construções de alimento.',
  port: 'Tem ancoradouro ou porto construído.',
  'trade-hub': 'Duas ou mais construções de comércio.',
  knowledge: 'Duas ou mais construções de conhecimento.',
  settlement: 'Nenhuma especialização determinável pelo conjunto de construções.'
};

const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  core: 'Cívico', food: 'Alimento', extraction: 'Extração', craft: 'Manufatura',
  knowledge: 'Conhecimento', commerce: 'Comércio', infrastructure: 'Infraestrutura', power: 'Energia'
};

const CATEGORY_ICON: Record<BuildingCategory, string> = {
  core: 'politics', food: 'agriculture', extraction: 'pickaxe', craft: 'industry',
  knowledge: 'technology', commerce: 'economy', infrastructure: 'trade-route', power: 'power'
};

const LAW_CATEGORY_LABEL: Record<LawCategory, string> = {
  taxation: 'Tributação', land: 'Terra', trade: 'Comércio', military: 'Militar',
  rights: 'Direitos', administration: 'Administração', labor: 'Trabalho',
  knowledge: 'Conhecimento', ecology: 'Ecologia'
};

const ECONOMIC_SYSTEM_LABEL: Record<string, string> = {
  subsistence: 'Subsistência', tributary: 'Tributária', mercantile: 'Mercantil',
  market: 'De mercado', planned: 'Planificada'
};

const SUCCESSION_LABEL: Record<string, { label: string; explain: string }> = {
  strongest: { label: 'O mais forte', explain: 'O trono passa a quem tiver força para tomá-lo.' },
  bloodline: { label: 'Hereditária', explain: 'O trono passa pela linhagem do governante.' },
  election: { label: 'Eleição', explain: 'O sucessor é escolhido entre os elegíveis.' }
};

const PROFESSION_LABEL: Record<string, string> = {
  farmer: 'Agricultores', woodcutter: 'Lenhadores', miner: 'Mineiros', builder: 'Construtores',
  soldier: 'Soldados', archer: 'Arqueiros', scout: 'Batedores', healer: 'Curandeiros',
  leader: 'Líderes', king: 'Monarcas', none: 'Sem ofício'
};

/**
 * The nine factions, in the interface's language.
 *
 * `SOCIAL_FACTIONS` names them in English because the simulation is written in
 * English; the interface is Portuguese. This is a closed set of nine known groups,
 * so translating the label here is localisation, not invention — the state, the
 * deltas and the arithmetic all still come from the faction itself. Any id not
 * covered falls back to the engine's own name rather than to a guess.
 */
const FACTION_LABEL: Record<SocialFactionId, { name: string; short: string; description: string }> = {
  peasants: {
    name: 'Camponeses', short: 'Camponeses',
    description: 'Agricultores, criadores e famílias de aldeia que carregam a produção de alimento e o peso dos tributos.'
  },
  nobles: {
    name: 'Nobreza', short: 'Nobreza',
    description: 'Antigos donos de terra, dinastas e famílias guerreiras que querem privilégio e continuidade.'
  },
  merchants: {
    name: 'Mercadores', short: 'Mercadores',
    description: 'Donos de caravana, agiotas, famílias portuárias e elites de mercado.'
  },
  military: {
    name: 'Militares', short: 'Militares',
    description: 'Soldados, oficiais, veteranos e comandantes de fronteira, atentos a segurança e prestígio.'
  },
  workers: {
    name: 'Trabalhadores', short: 'Trabalhadores',
    description: 'Artesãos, construtores, mineiros e operários criados pela produção urbana.'
  },
  clergy_scholars: {
    name: 'Clero e Eruditos', short: 'Eruditos',
    description: 'Autoridades rituais, professores, cronistas e pesquisadores que moldam a legitimidade.'
  },
  frontier: {
    name: 'Colonos de Fronteira', short: 'Fronteira',
    description: 'Colonos, aldeias de borda e vilas distantes que querem terra, proteção e autonomia.'
  },
  bureaucrats: {
    name: 'Burocracia', short: 'Burocracia',
    description: 'Coletores de imposto, juízes, escrivães e governadores que transformam lei em administração.'
  },
  reformists: {
    name: 'Reformistas', short: 'Reformistas',
    description: 'Dissidentes, panfletários, radicais e movimentos civis que querem mudança institucional.'
  }
};

/** The faction's display name, falling back to whatever the engine calls it. */
function factionName(id: SocialFactionId | string): string {
  return FACTION_LABEL[id as SocialFactionId]?.name
    ?? SOCIAL_FACTIONS[id as SocialFactionId]?.name
    ?? String(id);
}

function factionShort(id: SocialFactionId | string): string {
  return FACTION_LABEL[id as SocialFactionId]?.short
    ?? SOCIAL_FACTIONS[id as SocialFactionId]?.shortName
    ?? String(id);
}

function factionDescription(id: SocialFactionId | string): string | undefined {
  return FACTION_LABEL[id as SocialFactionId]?.description
    ?? SOCIAL_FACTIONS[id as SocialFactionId]?.description;
}

/** The culture axes, in Portuguese, with what each one actually drives. */
const CULTURE_AXES: { key: keyof RealmMetrics['culture']; label: string; explain: string }[] = [
  { key: 'militarism', label: 'Militarismo', explain: 'Orgulho em soldados e conquista. Aumenta o apoio à guerra.' },
  { key: 'expansionism', label: 'Expansionismo', explain: 'Vontade de colonizar e empurrar fronteiras.' },
  { key: 'tradition', label: 'Tradição', explain: 'Confiança em costumes antigos e ordem herdada. Sustenta a legitimidade.' },
  { key: 'authority', label: 'Autoridade', explain: 'Aceitação de hierarquia e comando central. Amplia o alcance administrativo.' },
  { key: 'openness', label: 'Abertura', explain: 'Receptividade a estrangeiros e sociedades mistas.' },
  { key: 'mercantilism', label: 'Mercantilismo', explain: 'Apreço por mercados, caravanas e portos.' },
  { key: 'stewardship', label: 'Zelo pela terra', explain: 'Respeito por florestas, rios e saúde do solo.' },
  { key: 'innovation', label: 'Inovação', explain: 'Conforto com ferramentas novas e reformas.' },
  { key: 'collectivism', label: 'Coletivismo', explain: 'Obrigação compartilhada acima do privilégio privado.' },
  { key: 'warTrauma', label: 'Trauma de guerra', explain: 'Medo acumulado por guerras longas e derrotas.' },
  { key: 'diplomaticTrust', label: 'Confiança diplomática', explain: 'Crença de que tratados serão honrados.' }
];

/** How the law effects read to a player. Only keys the law actually sets appear. */
const EFFECT_LABEL: Record<string, string> = {
  taxMultiplier: 'Arrecadação', stability: 'Estabilidade', legitimacy: 'Legitimidade',
  administrativeReach: 'Alcance administrativo', foodSecurity: 'Reserva alimentar',
  trade: 'Comércio', production: 'Produção', research: 'Pesquisa', military: 'Militar',
  expansion: 'Expansão', inequality: 'Desigualdade', reformPressure: 'Pressão por reforma',
  revoltRisk: 'Risco de revolta'
};

/** Effects where a rise is bad news, so the colour follows meaning, not sign. */
const INVERTED_EFFECTS = new Set(['inequality', 'reformPressure', 'revoltRisk']);

function statusOf(condition: RealmCondition): Status {
  return condition.status === 'unknown' ? 'neutral' : condition.status;
}

function verdictLabel(status: RealmCondition['status']): string {
  return { positive: 'Estável', neutral: 'Normal', warning: 'Atenção', critical: 'Crítico', unknown: 'Sem dados' }[status];
}

// ============================ OVERVIEW ============================

export function buildOverview(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const conditions = diagnoseRealm(m);
  const urgent = realmProblems(conditions);
  const settled = conditions.filter(c => !urgent.includes(c));
  const issues = criticalIssues(m);

  return [
    // Item 35: a short list, not thirty warnings. The cap is in `criticalIssues`,
    // which ranks before it truncates so what falls off is the least important.
    issues.length ? buildCriticalIssues(issues, host) : null,

    panel({ title: 'O reino', icon: 'kingdom' }, [
      statGrid([
        stat({
          label: 'População', value: formatCompact(m.population), icon: 'population',
          tooltip: {
            title: 'População',
            value: formatFull(m.population),
            description: 'Soma da população dos assentamentos do reino.',
            rows: [{ label: 'Assentamentos', value: `${m.cities.length}` }]
          }
        }),
        stat({ label: 'Cidades', value: m.cities.length, icon: 'city' }),
        stat({ label: 'Território', value: formatCompact(m.territory), unit: 'tiles', icon: 'map' }),
        stat({
          label: 'PIB', value: formatCompact(m.gdp), icon: 'economy',
          tooltip: {
            title: 'Produto interno',
            value: formatFull(Math.round(m.gdp)),
            description: 'Valor de tudo que o reino produziu no último ciclo, medido pela própria simulação.',
            rows: [{ label: 'Por habitante', value: m.gdpPerCapita.toFixed(2) }]
          }
        }),
        stat({
          label: 'Poder militar', value: formatCompact(m.militaryPower), icon: 'war',
          tooltip: {
            title: 'Poder militar',
            description: 'Índice que a simulação usa para decidir guerras e ameaças. Combina tropas, tecnologia e exaustão.',
            rows: [
              { label: 'Combatentes', value: `${m.army.total}` },
              { label: 'Cansaço de guerra', value: formatPercent(m.warWeariness) }
            ]
          }
        }),
        stat({
          label: 'Legitimidade', value: formatPercent(m.legitimacy), icon: 'politics',
          status: m.legitimacy >= 0.6 ? 'positive' : m.legitimacy >= 0.4 ? 'neutral' : 'warning',
          tooltip: {
            title: 'Legitimidade',
            value: formatPercent(m.legitimacy),
            description: 'Crença pública de que a ordem atual tem direito de governar. Cai com derrotas, fome e reformas impostas.'
          }
        })
      ])
    ]),

    urgent.length
      ? panel({
          title: 'Precisa de atenção',
          icon: 'alert',
          subtitle: `${urgent.length} condição(ões) fora do normal`,
          class: 'ae-realm-urgent'
        }, urgent.map(condition => buildConditionRow(condition, host)))
      : null,

    settled.length
      ? panel({
          title: urgent.length ? 'Demais condições' : 'Condições do reino',
          icon: 'statistics',
          subtitle: urgent.length ? undefined : 'Nada fora do normal'
        }, settled.map(condition => buildConditionRow(condition, host)))
      : null,

    // The cities are the realm's structure, so they belong on the page that
    // answers "what kind of realm is this".
    m.cities.length ? buildCitiesPanel(m, host) : null
  ];
}

/**
 * The short list of what is wrong, each row navigable to the thing that is wrong.
 *
 * Everything here was already computed for a condition or a city summary; this is
 * a ranking pass, not a second analysis. The buttons are the point: an issue you
 * cannot go look at is a complaint rather than a diagnosis.
 */
function buildCriticalIssues(issues: CriticalIssue[], host: RealmScreenHost): HTMLElement {
  return panel({
    title: 'Questões críticas',
    icon: 'alert',
    subtitle: `${issues.length} ranqueada(s) por gravidade`,
    class: 'ae-realm-critical'
  }, issues.map(issue => el('div', { class: `ae-realm-issue ae-realm-issue-${issue.severity}` }, [
    icon(issue.icon, { size: 16, class: 'ae-realm-issue-icon' }),
    el('div', { class: 'ae-realm-issue-text' }, [
      el('span', { class: 'ae-realm-issue-label', text: issue.label }),
      el('span', { class: 'ae-realm-issue-detail', text: issue.detail })
    ]),
    el('div', { class: 'ae-realm-issue-actions' }, [
      issue.good ? miniButton('good', GOODS[issue.good].name, 'Abrir este bem na Economia.', () => host.openGood(issue.good!)) : null,
      issue.cityId ? miniButton('city', 'Dossiê da cidade', 'Abre o dossiê do assentamento.', () => host.openCityDossier(issue.cityId!)) : null,
      issue.kingdomId ? miniButton('kingdom', 'Ver o reino', 'Abre o dossiê do outro reino.', () => host.openRealm(issue.kingdomId!)) : null
    ])
  ])));
}

/** One condition: verdict, finding, and the arithmetic behind it on hover. */
function buildConditionRow(condition: RealmCondition, host: RealmScreenHost): HTMLElement {
  const status = statusOf(condition);
  const clickable = Boolean(condition.good);

  const node = el(clickable ? 'button' : 'div', {
    class: ['ae-realm-condition', `ae-realm-condition-${status}`, clickable ? 'ae-realm-condition-live' : '']
      .filter(Boolean).join(' '),
    attrs: clickable ? { type: 'button' } : {},
    dataset: { conditionId: condition.id },
    on: clickable ? { click: () => host.openGood(condition.good!) } : undefined
  }, [
    icon(condition.icon, { size: 16, class: 'ae-realm-condition-icon' }),
    el('div', { class: 'ae-realm-condition-text' }, [
      el('span', { class: 'ae-realm-condition-label', text: condition.label }),
      el('span', { class: 'ae-realm-condition-finding', text: condition.finding })
    ]),
    badge(verdictLabel(condition.status), { size: 'sm', status, variant: 'outline' })
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

/**
 * The realm's settlements, with what each one is for.
 *
 * The role comes from the building mix, never from the name — a city called
 * "Ferro Velho" with no mine is not a mining town, and a renamed capital is still
 * the capital.
 */
function buildCitiesPanel(m: RealmMetrics, host: RealmScreenHost): HTMLElement {
  const columns: Column<CitySummary>[] = [
    {
      key: 'name', header: 'Cidade',
      cell: c => objectLink(
        { kind: 'city', id: c.id, name: c.name, status: c.problem?.severity },
        { showIcon: false, onOpen: () => host.openCityDossier(c.id) }
      ),
      sortValue: c => c.name
    },
    {
      key: 'pop', header: 'População', align: 'right', width: '96px',
      cell: c => formatCompact(c.population), sortValue: c => c.population
    },
    { key: 'tier', header: 'Porte', width: '104px', cell: c => c.tier, sortValue: c => c.population },
    {
      key: 'prosperity', header: 'Prosperidade', align: 'right', width: '104px',
      cell: c => formatPercent(c.prosperity), sortValue: c => c.prosperity
    },
    {
      key: 'role', header: 'Papel econômico', width: '124px',
      cell: c => badge(ROLE_LABEL[c.role], {
        size: 'sm', variant: 'outline',
        icon: c.role === 'capital' ? 'crown' : c.role === 'mining' ? 'pickaxe' : c.role === 'industrial' ? 'industry' : 'city'
      }),
      sortValue: c => ROLE_LABEL[c.role]
    },
    {
      key: 'problem', header: 'Situação',
      cell: c => (c.problem
        ? badge(c.problem.label, { size: 'sm', status: c.problem.severity, variant: 'outline' })
        : el('span', { class: 'ae-muted', text: '—' })),
      sortValue: c => (c.problem ? (c.problem.severity === 'critical' ? 0 : 1) : 2)
    }
  ];

  const troubled = m.cities.filter(c => c.problem).length;

  return panel({
    title: 'Assentamentos',
    icon: 'city',
    subtitle: troubled ? `${m.cities.length} · ${troubled} com problema` : `${m.cities.length}`,
    padded: false
  }, [
    table({
      columns, rows: m.cities,
      rowKey: c => c.id,
      sortBy: 'pop',
      onRowClick: c => host.openCityDossier(c.id),
      status: c => c.problem?.severity,
      rowTooltip: c => ({
        title: c.name,
        value: formatFull(c.population),
        description: ROLE_EXPLAIN[c.role],
        rows: [
          { label: 'Porte', value: c.tier },
          { label: 'Prosperidade', value: formatPercent(c.prosperity) },
          ...c.outputs.map(o => ({
            label: `Produz ${GOODS[o.good]?.name ?? o.good}`,
            value: `${o.amount.toFixed(1)} / ano`
          })),
          ...(c.problem ? [{ label: 'Problema', value: c.problem.label, status: c.problem.severity as Status }] : [])
        ],
        footnote: 'Clique para abrir o dossiê da cidade'
      })
    })
  ]);
}

// ============================ ECONOMY ============================

export function buildEconomy(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const e = m.employment;

  return [
    panel({ title: 'Contas do reino', icon: 'economy' }, [
      statGrid([
        stat({
          label: 'Produto interno', value: formatCompact(m.gdp), icon: 'economy',
          tooltip: { title: 'PIB', value: formatFull(Math.round(m.gdp)), description: 'Valor de tudo produzido no último ciclo.' }
        }),
        stat({ label: 'Por habitante', value: m.gdpPerCapita.toFixed(2), icon: 'citizen' }),
        stat({
          label: 'Tesouro', value: formatCompact(m.treasury), icon: 'treasury',
          status: m.lastLedger && m.lastLedger.net < 0 && m.treasury < Math.abs(m.lastLedger.net) * 2 ? 'critical' : undefined
        }),
        stat({
          label: 'Alíquota', value: formatPercent(m.taxRate), icon: 'tax',
          tooltip: {
            title: 'Tributação',
            value: formatPercent(m.taxRate),
            description: `Fração da produção que a coroa recolhe sob ${m.government.name}. Definida pela forma de governo, ajustada pelas leis.`
          }
        }),
        stat({
          label: 'Industrialização', value: formatPercent(m.industrialisation), icon: 'industry',
          tooltip: {
            title: 'Industrialização',
            value: formatPercent(m.industrialisation),
            description: 'Parcela da produção que vem de oficinas e fábricas, não de campos e minas.'
          }
        }),
        stat({
          label: 'Desigualdade', value: formatPercent(m.inequality), icon: 'population',
          status: m.inequality >= 0.6 ? 'warning' : undefined,
          tooltip: {
            title: 'Desigualdade',
            value: formatPercent(m.inequality),
            description: `Quão desigualmente a riqueza se espalha. Tende ao patamar do sistema ${(ECONOMIC_SYSTEM_LABEL[m.economicSystem] ?? m.economicSystem).toLowerCase()}.`
          }
        })
      ]),

      m.lastLedger
        ? el('div', {}, [
            divider(),
            section(`Livro do ano ${m.lastLedger.year}`, [
              rowList([
                statRow({ label: 'Impostos', value: m.lastLedger.taxIncome.toFixed(1), icon: 'tax', status: 'positive' }),
                statRow({ label: 'Comércio', value: m.lastLedger.tradeIncome.toFixed(1), icon: 'trade', status: 'positive' }),
                statRow({ label: 'Manutenção', value: m.lastLedger.upkeep.toFixed(1), icon: 'building', status: 'warning' }),
                el('div', { class: 'ae-row' }, [
                  icon('economy', { size: 16, class: 'ae-row-icon' }),
                  el('span', { class: 'ae-row-label', text: 'Saldo' }),
                  el('span', { class: 'ae-row-value' }, [
                    trendIndicator({
                      delta: m.lastLedger.net,
                      text: `${m.lastLedger.net >= 0 ? '+' : '−'}${Math.abs(m.lastLedger.net).toFixed(1)}`,
                      compact: true
                    })
                  ])
                ])
              ])
            ], { icon: 'scroll', hint: 'último ano fechado' })
          ])
        : el('p', {
            class: 'ae-realm-note',
            text: 'Nenhum ano fechado ainda — o reino não tem livro contábil. Os fluxos aparecem quando o primeiro ano termina.'
          })
    ]),

    /**
     * Work. Unemployment and labour shortage are kept apart on purpose: one says
     * there are people without workshops, the other that there are workshops
     * without people, and a single rate would describe both identically.
     */
    panel({ title: 'Trabalho', icon: 'industry' }, [
      statGrid([
        stat({ label: 'Idade produtiva', value: formatCompact(e.workers), icon: 'population' }),
        stat({ label: 'Postos', value: formatCompact(e.jobs), icon: 'industry' }),
        stat({
          label: 'Ocupados', value: formatCompact(e.filled), icon: 'industry',
          // Zero filled posts is not good news. The colour has to follow the
          // meaning of the figure, not the fact that it is a count.
          status: e.jobs === 0
            ? undefined
            : e.filled === 0 ? 'critical' : e.filled >= e.jobs * 0.6 ? 'positive' : 'warning'
        })
      ]),
      divider(),
      rowList([
        statRow({
          label: 'Sem trabalho', value: `${e.unemployed}`, icon: 'citizen',
          unit: e.unemployment !== null ? formatPercent(e.unemployment) : undefined,
          status: e.unemployment === null ? undefined : e.unemployment >= 0.25 ? 'critical' : e.unemployment > 0.05 ? 'warning' : 'positive',
          tooltip: {
            title: 'Desemprego',
            value: e.unemployment !== null ? formatPercent(e.unemployment) : 'sem dados',
            description: '(idade produtiva − postos ocupados) ÷ idade produtiva. Mesma conta que a simulação usa para calcular a insatisfação das facções.',
            rows: [
              { label: 'Idade produtiva', value: `${e.workers}` },
              { label: 'Postos ocupados', value: `${e.filled}` }
            ]
          }
        }),
        statRow({
          label: 'Vagas abertas', value: `${e.vacancies}`, icon: 'industry',
          unit: e.labourShortage !== null ? formatPercent(e.labourShortage) : undefined,
          status: e.labourShortage === null ? undefined : e.labourShortage >= 0.4 ? 'warning' : 'positive',
          tooltip: {
            title: 'Falta de mão de obra',
            value: e.labourShortage !== null ? formatPercent(e.labourShortage) : 'sem dados',
            description: 'Postos que existem e ninguém preenche. Problema oposto ao desemprego: aqui falta gente, não falta trabalho.',
            rows: [
              { label: 'Postos', value: `${e.jobs}` },
              { label: 'Ocupados', value: `${e.filled}` }
            ]
          }
        })
      ])
    ]),

    panel({ title: 'Balança externa', icon: 'trade-route' }, [
      statGrid([
        stat({ label: 'Exportado', value: formatCompact(m.exportVolume), icon: 'crate' }),
        stat({ label: 'Importado', value: formatCompact(m.importVolume), icon: 'crate' }),
        stat({
          label: 'Tarifas', value: formatCompact(m.tariffRevenue), icon: 'coin',
          tooltip: { title: 'Receita tarifária', description: 'Valor que a coroa recolhe sobre o comércio que atravessa suas fronteiras.' }
        }),
        stat({
          label: 'Dependência comercial', value: formatPercent(m.tradeDependency), icon: 'trade-route',
          status: m.tradeDependency >= 0.6 ? 'warning' : undefined,
          tooltip: {
            title: 'Dependência comercial',
            value: formatPercent(m.tradeDependency),
            description: 'Valor movido em rotas ativas contra o PIB. Alto significa que um bloqueio dói.'
          }
        }),
        stat({
          label: 'Reserva alimentar', value: formatPercent(m.foodSecurity), icon: 'agriculture',
          status: m.foodSecurity >= 1 ? 'positive' : m.foodSecurity >= 0.85 ? 'warning' : 'critical',
          tooltip: {
            title: 'Reserva alimentar',
            value: formatPercent(m.foodSecurity),
            description: 'Estoque de comida por habitante contra a reserva de quatro anos que a simulação considera plena. É uma medida de estoque, não de produção.'
          }
        })
      ])
    ]),

    m.topExports.length || m.topImports.length
      ? panel({ title: 'Maiores fluxos', icon: 'crate' }, [
          m.topExports.length
            ? section('Exportações', [buildGoodsTable(m.topExports, host, 'exported')], { icon: 'route' })
            : null,
          m.topImports.length
            ? section('Importações', [buildGoodsTable(m.topImports, host, 'imported')], { icon: 'route' })
            : null
        ])
      : null,

    m.strategic.length ? buildStrategicPanel(m, host) : null,
    m.dependencies.length ? buildDependencyPanel(m, host) : null,
    m.industries.length ? buildIndustriesPanel(m.industries, host) : null
  ];
}

/**
 * Strategic resources — item 9.
 *
 * The list is named rather than derived, because "strategic" is a judgement about
 * consequence: iron and oil decide whether a realm can arm itself, and no
 * property of the good says so.
 */
function buildStrategicPanel(m: RealmMetrics, host: RealmScreenHost): HTMLElement {
  return panel({
    title: 'Recursos estratégicos',
    icon: 'pickaxe',
    subtitle: `${m.strategic.length} dos ${STRATEGIC_COUNT} acompanhados existem neste reino`,
    padded: false
  }, [buildGoodsTable(m.strategic, host, 'stock')]);
}

const STRATEGIC_COUNT = 10;

/**
 * Who supplies what, and how badly it is needed — items 8 and 10.
 *
 * The supplier column is the reason this panel exists. A dependency without a
 * name attached is a statistic; with the realm named and linked it is a foreign
 * policy problem the player can act on.
 */
function buildDependencyPanel(m: RealmMetrics, host: RealmScreenHost): HTMLElement {
  return panel({
    title: 'Dependência econômica',
    icon: 'trade-route',
    subtitle: 'Parcela do consumo que vem de fora, e de quem'
  }, m.dependencies.slice(0, 8).map(position => {
    const supplier = position.suppliers[0];
    return el('div', { class: 'ae-realm-dependency' }, [
      progressBar({
        label: GOODS[position.good]?.name ?? position.good,
        value: position.importDependency,
        valueText: formatPercent(position.importDependency),
        status: position.importDependency >= 0.75 ? 'critical' : position.importDependency >= 0.5 ? 'warning' : 'neutral',
        tooltip: {
          title: GOODS[position.good]?.name ?? position.good,
          value: formatPercent(position.importDependency),
          description: 'Importado ÷ (consumido + exportado), somado em todos os assentamentos do reino.',
          rows: [
            { label: 'Produzido aqui', value: position.flow.produced.toFixed(1) },
            { label: 'Importado', value: position.flow.imported.toFixed(1) },
            { label: 'Consumido', value: position.flow.consumed.toFixed(1) },
            { label: 'Estoque', value: formatCompact(position.stock) }
          ],
          footnote: 'Fluxos do último ano fechado'
        }
      }),
      el('div', { class: 'ae-realm-suppliers' }, [
        objectLink(
          { kind: 'good', id: position.good, name: GOODS[position.good]?.name ?? position.good },
          { showIcon: true, onOpen: () => host.openGood(position.good) }
        ),
        supplier
          ? el('span', { class: 'ae-realm-supplier-line' }, [
              el('span', { class: 'ae-muted', text: 'principal fornecedor:' }),
              objectLink(
                { kind: 'kingdom', id: supplier.kingdomId, name: supplier.name },
                { showIcon: false, onOpen: () => host.openRealm(supplier.kingdomId) }
              ),
              el('span', { class: 'ae-muted', text: `${formatPercent(supplier.share)} do que entra` })
            ])
          : el('span', { class: 'ae-muted', text: 'nenhuma rota visível trazendo este bem' }),
        ...position.suppliers.slice(1, 3).map(other => el('span', { class: 'ae-realm-supplier-extra' }, [
          objectLink(
            { kind: 'kingdom', id: other.kingdomId, name: other.name },
            { showIcon: false, onOpen: () => host.openRealm(other.kingdomId) }
          ),
          el('span', { class: 'ae-muted', text: formatPercent(other.share) })
        ]))
      ])
    ]);
  }));
}

/** Sectors, from the buildings that make them up. No composite score. */
function buildIndustriesPanel(industries: IndustrySector[], host: RealmScreenHost): HTMLElement {
  return panel({
    title: 'Setores produtivos',
    icon: 'industry',
    subtitle: `${industries.length} setor(es) · capacidade nominal, não produção efetiva`
  }, industries.map(sector => section(CATEGORY_LABEL[sector.category] ?? sector.category, [
    el('div', { class: 'ae-realm-sector-figures' }, [
      statRow({ label: 'Construções', value: `${sector.buildings}`, icon: CATEGORY_ICON[sector.category] }),
      sector.jobs > 0
        ? statRow({
            label: 'Pessoal', value: `${sector.filled} / ${sector.jobs}`, icon: 'population',
            status: sector.filled >= sector.jobs ? 'positive' : sector.filled > 0 ? 'warning' : 'critical'
          })
        : null
    ].filter(Boolean) as HTMLElement[]),
    sector.utilization !== null
      ? progressBar({
          label: 'Utilização',
          value: sector.utilization,
          valueText: formatPercent(sector.utilization),
          status: sector.utilization >= 0.8 ? 'positive' : sector.utilization >= 0.4 ? 'neutral' : 'warning',
          tooltip: { title: 'Utilização do setor', description: 'Postos ocupados ÷ postos existentes. A produção escala com isso.' }
        })
      : null,
    sector.ratedOutput.length
      ? rowList(sector.ratedOutput.slice(0, 4).map(output => statRow({
          label: GOODS[output.good]?.name ?? output.good,
          value: output.amount.toFixed(1),
          unit: '/ ano',
          icon: 'good',
          onClick: () => host.openGood(output.good),
          tooltip: {
            title: GOODS[output.good]?.name ?? output.good,
            value: `${output.amount.toFixed(1)} / ano`,
            description: 'Capacidade nominal: valor de base das construções escalado por nível e ocupação. A simulação registra produção por assentamento, não por construção.',
            footnote: 'Capacidade, não produção efetiva'
          }
        })))
      : null
  ], { icon: CATEGORY_ICON[sector.category] })));
}

/** A goods table over realm-wide positions. Every row links the good onward. */
export function buildGoodsTable(
  positions: RealmGoodPosition[],
  host: RealmScreenHost,
  sortBy: 'stock' | 'exported' | 'imported' = 'stock'
): HTMLElement {
  const columns: Column<RealmGoodPosition>[] = [
    {
      key: 'good', header: 'Bem',
      cell: p => objectLink(
        { kind: 'good', id: p.good, name: GOODS[p.good]?.name ?? p.good },
        { showIcon: false, onOpen: () => host.openGood(p.good) }
      ),
      sortValue: p => GOODS[p.good]?.name ?? p.good
    },
    { key: 'stock', header: 'Estoque', align: 'right', width: '84px', cell: p => formatCompact(p.stock), sortValue: p => p.stock },
    { key: 'prod', header: 'Produz', align: 'right', width: '76px', cell: p => p.flow.produced.toFixed(1), sortValue: p => p.flow.produced },
    { key: 'cons', header: 'Consome', align: 'right', width: '80px', cell: p => p.flow.consumed.toFixed(1), sortValue: p => p.flow.consumed },
    { key: 'imported', header: 'Importa', align: 'right', width: '76px', cell: p => p.flow.imported.toFixed(1), sortValue: p => p.flow.imported },
    { key: 'exported', header: 'Exporta', align: 'right', width: '76px', cell: p => p.flow.exported.toFixed(1), sortValue: p => p.flow.exported },
    {
      key: 'dep', header: 'De fora', align: 'right', width: '80px',
      cell: p => (p.flow.consumed + p.flow.exported > 0 ? formatPercent(p.importDependency) : '—'),
      sortValue: p => p.importDependency,
      tooltip: { title: 'Dependência de importação', description: 'Importado ÷ (consumido + exportado) no reino inteiro.' }
    },
    {
      key: 'net', header: 'Saldo', align: 'right', width: '84px',
      cell: p => trendIndicator({
        delta: p.net,
        text: `${p.net >= 0 ? '+' : '−'}${Math.abs(p.net).toFixed(1)}`,
        compact: true
      }),
      sortValue: p => p.net
    }
  ];

  return table({
    columns, rows: positions,
    rowKey: p => p.good,
    sortBy,
    status: p => (p.importDependency >= 0.75 ? 'warning' : p.net < -0.01 ? 'critical' : undefined),
    rowTooltip: p => ({
      title: GOODS[p.good]?.name ?? p.good,
      value: formatCompact(p.stock),
      description: GOODS[p.good]?.description,
      rows: [
        { label: 'Produzido', value: p.flow.produced.toFixed(1) },
        { label: 'Importado', value: p.flow.imported.toFixed(1) },
        { label: 'Consumido', value: p.flow.consumed.toFixed(1) },
        { label: 'Exportado', value: p.flow.exported.toFixed(1) },
        { label: 'Saldo', value: `${p.net >= 0 ? '+' : '−'}${Math.abs(p.net).toFixed(1)}`, status: p.net >= 0 ? 'positive' : 'critical' },
        ...(p.suppliers[0]
          ? [{ label: 'Principal fornecedor', value: `${p.suppliers[0].name} (${formatPercent(p.suppliers[0].share)})` }]
          : [])
      ],
      footnote: 'Somado em todos os assentamentos · fluxos do último ano fechado'
    }),
    empty: emptyState({ icon: 'good', title: 'Nenhum bem', hint: 'Nada a mostrar aqui.', compact: true })
  });
}

// ============================ SOCIETY ============================

/**
 * The factions, with the simulation's own reasons attached.
 *
 * `FactionState.factors` holds the exact deltas the society tick applied to each
 * faction's satisfaction, each with a label the simulation wrote. So the "why"
 * here is read back rather than reconstructed — no narrative is invented about
 * what a radicalised worker probably resents.
 */
export function buildSociety(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const s = m.society;

  return [
    panel({ title: 'Risco social', icon: 'population' }, [
      statGrid([
        riskStat('Coesão', s.cohesion, 'higher', 'population',
          'Quanto a sociedade se mantém junta. Cai quando facções divergem e quando a legitimidade se esvai.'),
        riskStat('Pressão por reforma', s.reformPressure, 'lower', 'politics',
          'Força acumulada pedindo mudança nas leis. Alta o bastante, a coroa reforma ou é reformada.'),
        riskStat('Risco de golpe', s.coupRisk, 'lower', 'war',
          'Probabilidade de que quem tem armas tome o poder. Sobe com militares insatisfeitos e legitimidade baixa.'),
        riskStat('Risco de revolta', s.revoltRisk, 'lower', 'warning',
          'Probabilidade de levante popular. Sobe com fome, desemprego e radicalização.'),
        riskStat('Pressão por guerra', s.warPressure, 'neutral', 'war',
          'Quanto as facções empurram o reino para o conflito.'),
        riskStat('Pressão por paz', s.peacePressure, 'neutral', 'diplomacy',
          'Quanto as facções empurram o reino para encerrar a guerra.')
      ]),
      el('p', { class: 'ae-realm-note' }, [
        el('span', { text: 'Facção dominante: ' }),
        el('strong', { text: factionName(s.dominantFaction) }),
        s.lastUnrestYear > 0
          ? el('span', { text: ` · última convulsão no ano ${s.lastUnrestYear}` })
          : null
      ])
    ]),

    m.factions.length
      ? panel({
          title: 'Facções',
          icon: 'politics',
          subtitle: `${m.factions.length} · ordenadas por influência`
        }, m.factions.map(faction => buildFactionCard(faction, host)))
      : emptyState({
          icon: 'politics',
          title: 'Sem facções registradas',
          hint: 'A sociedade deste reino ainda não se organizou em grupos com interesses próprios.'
        }),

    buildCulturePanel(m)
  ];
}

function riskStat(
  label: string,
  value: number,
  sense: 'higher' | 'lower' | 'neutral',
  iconName: string,
  explain: string
): HTMLElement {
  const status: Status | undefined =
    sense === 'neutral' ? undefined
    : sense === 'higher'
      ? value >= 0.6 ? 'positive' : value >= 0.4 ? 'neutral' : value >= 0.25 ? 'warning' : 'critical'
      : value >= 0.6 ? 'critical' : value >= 0.4 ? 'warning' : value >= 0.2 ? 'neutral' : 'positive';

  return stat({
    label, value: formatPercent(value), icon: iconName, status,
    tooltip: { title: label, value: formatPercent(value), description: explain }
  });
}

/**
 * One faction: where it stands, and the named pressures moving it.
 *
 * The pressures are the simulation's `factors`, split by sign. A factor with a
 * `source` becomes clickable, because the engine already recorded which good or
 * which system the grievance is about.
 */
function buildFactionCard(faction: FactionState, host: RealmScreenHost): HTMLElement {
  const def = SOCIAL_FACTIONS[faction.id];
  const description = factionDescription(faction.id);
  const grievances = negativeFactors(faction);
  const supports = positiveFactors(faction);

  const card = el('div', { class: 'ae-realm-faction' }, [
    el('div', { class: 'ae-realm-faction-head' }, [
      icon('politics', { size: 16, class: 'ae-realm-faction-icon' }),
      el('div', { class: 'ae-realm-faction-title' }, [
        el('span', { class: 'ae-realm-faction-name', text: factionName(faction.id) }),
        description ? el('span', { class: 'ae-realm-faction-desc', text: description }) : null
      ]),
      badgeRow([
        faction.radicalization >= 0.6
          ? badge('Radicalizada', { size: 'sm', status: 'critical', icon: 'warning' })
          : faction.satisfaction < 0.4
            ? badge('Insatisfeita', { size: 'sm', status: 'warning' })
            : badge('Acomodada', { size: 'sm', status: 'positive', variant: 'outline' })
      ])
    ]),

    el('div', { class: 'ae-realm-faction-bars' }, [
      progressBar({
        label: 'Influência', value: faction.influence, valueText: formatPercent(faction.influence),
        status: 'neutral',
        tooltip: { title: 'Influência', description: 'Peso desta facção nas decisões do reino.' }
      }),
      progressBar({
        label: 'Satisfação', value: faction.satisfaction, valueText: formatPercent(faction.satisfaction),
        status: faction.satisfaction >= 0.6 ? 'positive' : faction.satisfaction >= 0.4 ? 'neutral' : 'warning'
      }),
      progressBar({
        label: 'Lealdade', value: faction.loyalty, valueText: formatPercent(faction.loyalty),
        status: faction.loyalty >= 0.6 ? 'positive' : faction.loyalty >= 0.35 ? 'neutral' : 'warning',
        tooltip: { title: 'Lealdade', description: 'Disposição a aceitar a ordem atual mesmo estando insatisfeita.' }
      }),
      progressBar({
        label: 'Radicalização', value: faction.radicalization, valueText: formatPercent(faction.radicalization),
        status: faction.radicalization >= 0.6 ? 'critical' : faction.radicalization >= 0.4 ? 'warning' : 'positive',
        tooltip: { title: 'Radicalização', description: 'Disposição a agir fora da ordem — revolta, golpe, sabotagem.' }
      })
    ]),

    el('div', { class: 'ae-realm-faction-stance' }, [
      withTooltip(
        badge(`Guerra ${formatPercent(faction.warSupport)}`, {
          size: 'sm', variant: 'outline',
          status: faction.warSupport >= 0.6 ? 'warning' : undefined
        }),
        { title: 'Apoio à guerra', value: formatPercent(faction.warSupport), description: 'Quanto esta facção quer o conflito.' }
      ),
      withTooltip(
        badge(`Reforma ${formatPercent(faction.reformSupport)}`, {
          size: 'sm', variant: 'outline',
          status: faction.reformSupport >= 0.6 ? 'warning' : undefined
        }),
        { title: 'Apoio à reforma', value: formatPercent(faction.reformSupport), description: 'Quanto esta facção quer mudar as leis.' }
      ),
      withTooltip(
        badge(`Riqueza ${formatPercent(faction.wealth)}`, { size: 'sm', variant: 'outline' }),
        { title: 'Riqueza', value: formatPercent(faction.wealth), description: 'Posição material desta facção dentro do reino.' }
      )
    ]),

    // The factors. Absent entirely before the first society tick has run, which is
    // honest: there is nothing to explain yet.
    grievances.length || supports.length
      ? el('div', { class: 'ae-realm-factors' }, [
          grievances.length
            ? buildFactorList('Pressões contra', grievances.slice(0, 4), 'critical', host)
            : null,
          supports.length
            ? buildFactorList('Pressões a favor', supports.slice(0, 4), 'positive', host)
            : null
        ])
      : el('p', { class: 'ae-realm-note', text: 'Sem fatores registrados — a simulação recalcula esta explicação a cada ano.' })
  ]);

  if (def?.color) card.style.setProperty('--ae-faction', def.color);
  return card;
}

function buildFactorList(
  title: string,
  factors: { label: string; delta: number; source?: { kind: string; good?: GoodId } }[],
  tone: Status,
  host: RealmScreenHost
): HTMLElement {
  return el('div', { class: 'ae-realm-factor-group' }, [
    el('span', { class: 'ae-realm-factor-title', text: title }),
    ...factors.map(factor => {
      const good = factor.source?.kind === 'good' ? factor.source.good : undefined;
      const node = el(good ? 'button' : 'div', {
        class: `ae-realm-factor ae-realm-factor-${tone}`,
        attrs: good ? { type: 'button' } : {},
        on: good ? { click: () => host.openGood(good) } : undefined
      }, [
        el('span', { class: 'ae-realm-factor-label', text: factor.label }),
        el('span', { class: 'ae-realm-factor-delta', text: `${factor.delta >= 0 ? '+' : '−'}${Math.abs(factor.delta * 100).toFixed(1)}` })
      ]);

      return withTooltip(node, {
        title: factor.label,
        value: `${factor.delta >= 0 ? '+' : '−'}${Math.abs(factor.delta * 100).toFixed(1)} pontos de satisfação`,
        description: 'Delta que a simulação aplicou a esta facção no último ciclo social.',
        footnote: good
          ? `Clique para abrir ${GOODS[good]?.name ?? good} na Economia`
          : factor.source?.kind === 'jobs' ? 'Origem: o mercado de trabalho'
          : factor.source?.kind === 'trade' ? 'Origem: o comércio externo'
          : undefined
      });
    })
  ]);
}

/** Culture as traits with meaning, not eleven bare decimals. */
function buildCulturePanel(m: RealmMetrics): HTMLElement {
  const axes = CULTURE_AXES
    .map(axis => ({ ...axis, value: m.culture[axis.key] as number }))
    .filter(axis => typeof axis.value === 'number');
  const dominant = [...axes].sort((a, b) => b.value - a.value).slice(0, 3);
  const memories = [...(m.culture.memories ?? [])].sort((a, b) => b.year - a.year).slice(0, 6);

  return panel({
    title: 'Cultura',
    icon: 'culture',
    subtitle: dominant.length ? dominant.map(a => a.label.toLowerCase()).join(' · ') : undefined
  }, [
    badgeRow([
      badge(`Nível cultural ${m.cultureLevel}`, { size: 'sm', variant: 'outline', icon: 'culture' }),
      ...dominant.map(axis => badge(axis.label, { size: 'sm', status: 'neutral', variant: 'outline' }))
    ]),
    el('div', { class: 'ae-realm-culture-axes' }, axes.map(axis => withTooltip(
      el('div', { class: 'ae-realm-culture-axis' }, [
        el('span', { class: 'ae-realm-culture-label', text: axis.label }),
        el('div', { class: 'ae-realm-culture-track' }, [
          el('div', { class: 'ae-realm-culture-fill', style: { width: `${Math.round(axis.value * 100)}%` } })
        ]),
        el('span', { class: 'ae-realm-culture-value', text: formatPercent(axis.value) })
      ]),
      { title: axis.label, value: formatPercent(axis.value), description: axis.explain }
    ))),

    // Memories are events the culture actually recorded, with the year and the
    // label the simulation wrote.
    memories.length
      ? el('div', {}, [
          divider(),
          section('Memória coletiva', [
            rowList(memories.map(memory => statRow({
              label: memory.label,
              value: `${memory.year}`,
              icon: 'history',
              unit: formatPercent(memory.intensity),
              tooltip: {
                title: memory.label,
                value: `Ano ${memory.year}`,
                description: 'Marca que este acontecimento deixou na cultura do reino.',
                rows: [{ label: 'Intensidade', value: formatPercent(memory.intensity) }]
              }
            })))
          ], { icon: 'scroll', hint: `${memories.length}` })
        ])
      : null
  ]);
}

// ============================ POLITICS ============================

export function buildPolitics(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const gov = m.government;
  const succession = SUCCESSION_LABEL[gov.succession];

  return [
    panel({ title: 'Governo', icon: 'politics' }, [
      statGrid([
        stat({
          label: 'Forma de governo', value: gov.name, icon: 'politics',
          tooltip: { title: gov.name, description: gov.description, rows: [{ label: 'Adotado no ano', value: `${m.governmentSince}` }] }
        }),
        stat({
          label: 'Sistema econômico', value: ECONOMIC_SYSTEM_LABEL[m.economicSystem] ?? m.economicSystem, icon: 'economy',
          tooltip: { title: 'Sistema econômico', description: 'Determinado pela forma de governo. Define o patamar de desigualdade e como a produção é organizada.' }
        }),
        stat({
          label: 'Legitimidade', value: formatPercent(m.legitimacy), icon: 'crown',
          status: m.legitimacy >= 0.6 ? 'positive' : m.legitimacy >= 0.4 ? 'neutral' : 'critical',
          tooltip: {
            title: 'Legitimidade',
            value: formatPercent(m.legitimacy),
            description: 'Crença pública de que a ordem atual tem direito de governar. Derrotas, fome e reformas impostas a derrubam.'
          }
        }),
        stat({
          label: 'Estabilidade', value: formatPercent(m.stability), icon: 'shield',
          status: m.stability >= 0.6 ? 'positive' : m.stability >= 0.4 ? 'neutral' : 'warning',
          tooltip: { title: 'Estabilidade', description: 'Contentamento material da população, mantido pela economia do reino.' }
        }),
        stat({
          label: 'Alcance administrativo', value: formatPercent(m.administrativeReach), icon: 'scroll',
          status: m.administrativeReach >= 0.75 ? 'positive' : m.administrativeReach >= 0.5 ? 'neutral' : 'warning',
          tooltip: {
            title: 'Alcance administrativo',
            value: formatPercent(m.administrativeReach),
            description: 'Quanto do reino a coroa consegue de fato governar. Cai com a distância média das cidades à capital e com o número de assentamentos.'
          }
        }),
        stat({
          label: 'Sucessão', value: succession?.label ?? gov.succession, icon: 'crown',
          tooltip: { title: 'Regra de sucessão', description: succession?.explain ?? 'Definida pela forma de governo.' }
        })
      ])
    ]),

    buildCourtPanel(m, host),

    m.laws.length ? buildLawsPanel(m.laws, host) : null,

    // Political pressure, read from the same society state the factions act on.
    panel({ title: 'Pressões políticas', icon: 'statistics' }, [
      rowList([
        pressureRow('Pressão por reforma', m.society.reformPressure, 'lower',
          'Força somada das facções que querem mudar as leis. A coroa reforma quando isso vence a inércia.'),
        pressureRow('Risco de golpe', m.society.coupRisk, 'lower',
          'Calculado da insatisfação de quem tem armas contra a legitimidade da coroa.'),
        pressureRow('Risco de revolta', m.society.revoltRisk, 'lower',
          'Calculado da radicalização popular contra a capacidade de repressão.'),
        pressureRow('Coesão', m.society.cohesion, 'higher',
          'O quanto as facções ainda convergem. Baixa coesão precede fratura.'),
        pressureRow('Pressão por guerra', m.society.warPressure, 'neutral',
          'Facções empurrando o reino ao conflito.'),
        pressureRow('Pressão por paz', m.society.peacePressure, 'neutral',
          'Facções empurrando o reino a encerrar a guerra.')
      ])
    ])
  ];
}

function pressureRow(label: string, value: number, sense: 'higher' | 'lower' | 'neutral', explain: string): HTMLElement {
  const status: Status | undefined =
    sense === 'neutral' ? undefined
    : sense === 'higher'
      ? value >= 0.6 ? 'positive' : value >= 0.4 ? 'neutral' : 'warning'
      : value >= 0.6 ? 'critical' : value >= 0.4 ? 'warning' : 'positive';

  return progressBar({
    label, value, valueText: formatPercent(value), status,
    tooltip: { title: label, value: formatPercent(value), description: explain }
  });
}

/**
 * The court: who rules, since when, and who stands next in line.
 *
 * The heir is labelled "eldest heir" rather than "the heir" because the engine
 * has its own succession rules; naming this one *the* successor would be a second
 * answer that can disagree with the one the simulation acts on.
 */
function buildCourtPanel(m: RealmMetrics, host: RealmScreenHost): HTMLElement {
  const ruler = m.ruler;

  return panel({ title: 'Corte', icon: 'crown' }, [
    rowList([
      ruler
        ? el('div', { class: 'ae-row' }, [
            icon('crown', { size: 16, class: 'ae-row-icon' }),
            el('span', { class: 'ae-row-label', text: m.government.rulerTitle }),
            el('span', { class: 'ae-row-value' }, [
              objectLink(
                { kind: 'citizen', id: ruler.id, name: ruler.title ?? ruler.name },
                { showIcon: false, onOpen: () => host.openCitizen(ruler.id) }
              ),
              el('span', { class: 'ae-row-unit', text: `${ruler.age} anos` })
            ])
          ])
        : statRow({ label: m.government.rulerTitle, value: 'Trono vago', icon: 'crown', status: 'critical' }),

      m.rulerYears !== null
        ? statRow({
            label: 'Governo atual', value: `${m.rulerYears}`, unit: 'anos', icon: 'calendar',
            tooltip: {
              title: 'Anos de governo',
              description: 'Contados desde o ano em que a forma de governo atual foi adotada — que para uma monarquia é a ascensão do soberano.'
            }
          })
        : null,

      m.heir
        ? el('div', { class: 'ae-row' }, [
            icon('heir', { size: 16, class: 'ae-row-icon' }),
            el('span', { class: 'ae-row-label', text: 'Herdeiro mais velho' }),
            el('span', { class: 'ae-row-value' }, [
              objectLink(
                { kind: 'citizen', id: m.heir.id, name: m.heir.name },
                { showIcon: false, onOpen: () => host.openCitizen(m.heir!.id) }
              ),
              el('span', { class: 'ae-row-unit', text: `${m.heir.age} anos` })
            ])
          ])
        : ruler
          ? statRow({
              label: 'Herdeiro', value: 'Nenhum filho vivo', icon: 'heir', status: 'warning',
              tooltip: {
                title: 'Sucessão',
                description: 'O governante não tem filhos vivos. A regra de sucessão da forma de governo decide o que acontece — a simulação escolhe na hora.'
              }
            })
          : null,

      m.dynasty
        ? statRow({
            label: 'Dinastia', value: m.dynasty, icon: 'dynasty',
            onClick: () => host.openDynasty(),
            tooltip: { title: m.dynasty, description: 'Casa reinante. Abre a tela de dinastias, que cobre linhagens e grandes figuras.' }
          })
        : null,

      m.capital
        ? el('div', { class: 'ae-row' }, [
            icon('city', { size: 16, class: 'ae-row-icon' }),
            el('span', { class: 'ae-row-label', text: 'Capital' }),
            el('span', { class: 'ae-row-value' }, [
              objectLink(
                { kind: 'city', id: m.capital.id, name: m.capital.name },
                { showIcon: false, onOpen: () => host.openCityDossier(m.capital!.id) }
              )
            ])
          ])
        : statRow({ label: 'Capital', value: 'Sem capital', icon: 'city', status: 'critical' })
    ])
  ]);
}

/**
 * The laws in force, by category, with the effects the definitions declare.
 *
 * The effects are read from `LawDefinition.effects` — the same numbers the
 * simulation applies. Nothing here reimplements a law's consequence, which is the
 * only way the screen and the engine can agree.
 */
function buildLawsPanel(laws: LawDefinition[], host: RealmScreenHost): HTMLElement {
  const byCategory = new Map<LawCategory, LawDefinition>();
  for (const law of laws) byCategory.set(law.category, law);

  return panel({
    title: 'Leis em vigor',
    icon: 'law',
    subtitle: `${laws.length} de ${LAW_CATEGORY_ORDER.length} categorias`
  }, LAW_CATEGORY_ORDER.map(category => {
    const law = byCategory.get(category);
    if (!law) return null;

    const effects = effectRows(law.effects);
    return el('div', { class: 'ae-realm-law' }, [
      withTooltip(
        el('div', { class: 'ae-realm-law-head' }, [
          badge(LAW_CATEGORY_LABEL[category] ?? category, { size: 'sm', variant: 'outline' }),
          el('span', { class: 'ae-realm-law-name', text: law.name })
        ]),
        {
          title: law.name,
          description: law.description,
          rows: effects,
          footnote: 'Efeitos declarados na própria definição da lei'
        }
      ),
      effects.length
        ? el('div', { class: 'ae-realm-law-effects' }, effects.slice(0, 4).map(row => withTooltip(
            badge(`${row.label} ${row.value}`, { size: 'sm', variant: 'outline', status: row.status }),
            { title: row.label, value: row.value, description: 'Modificador que esta lei aplica ao reino.' }
          )))
        : null,
      el('div', { class: 'ae-realm-law-factions' }, [
        ...law.favours.slice(0, 3).map(id => withTooltip(
          badge(factionShort(id), { size: 'sm', status: 'positive', variant: 'outline' }),
          { title: factionName(id), description: 'Esta facção é favorecida pela lei.' }
        )),
        ...law.angers.slice(0, 3).map(id => withTooltip(
          badge(factionShort(id), { size: 'sm', status: 'critical', variant: 'outline' }),
          { title: factionName(id), description: 'Esta facção é contrariada pela lei.' }
        ))
      ])
    ]);
  }).filter(Boolean) as HTMLElement[]);
}

/** Turns a law's declared effects into rows, with the colour following meaning. */
function effectRows(effects: LawEffects): { label: string; value: string; status?: Status }[] {
  const rows: { label: string; value: string; status?: Status }[] = [];
  for (const [key, raw] of Object.entries(effects)) {
    if (typeof raw !== 'number' || raw === 0) continue;
    const label = EFFECT_LABEL[key];
    if (!label) continue;
    // A rise in inequality is not good news just because the number is positive.
    const good = INVERTED_EFFECTS.has(key) ? raw < 0 : raw > 0;
    rows.push({
      label,
      value: `${raw > 0 ? '+' : '−'}${Math.abs(raw) < 1 ? `${Math.abs(raw * 100).toFixed(0)}%` : Math.abs(raw).toFixed(2)}`,
      status: good ? 'positive' : 'warning'
    });
  }
  return rows;
}

// ============================ DIPLOMACY ============================

export function buildDiplomacy(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const allies = m.relations.filter(r => r.status === 'alliance');
  const enemies = m.relations.filter(r => r.status === 'war');
  const rivals = m.relations.filter(r => r.status === 'hostile');
  const vassals = m.relations.filter(r => r.isVassal);
  const overlord = m.relations.find(r => r.isOverlord) ?? null;
  const truces = m.relations.filter(r => r.truceUntil !== null);
  const partners = m.relations.filter(r => r.hasAgreement);

  return [
    panel({ title: 'Posição diplomática', icon: 'diplomacy' }, [
      statGrid([
        stat({ label: 'Contatos', value: m.relations.length, icon: 'handshake' }),
        stat({ label: 'Aliados', value: allies.length, icon: 'alliance', status: allies.length ? 'positive' : undefined }),
        stat({ label: 'Em guerra', value: enemies.length, icon: 'war', status: enemies.length ? 'critical' : 'positive' }),
        stat({ label: 'Rivais', value: rivals.length, icon: 'warning', status: rivals.length ? 'warning' : undefined }),
        stat({
          label: 'Acordos de comércio', value: partners.length, icon: 'trade',
          tooltip: { title: 'Acordos de comércio', description: 'Tratados assinados que rebaixam tarifas entre os dois reinos.' }
        }),
        stat({
          label: 'Vassalos', value: vassals.length, icon: 'crown',
          tooltip: overlord
            ? { title: 'Vassalagem', description: `Este reino é vassalo de ${overlord.name}.` }
            : { title: 'Vassalos', description: 'Reinos que pagam tributo a este.' }
        })
      ]),
      overlord
        ? el('p', { class: 'ae-realm-note' }, [
            icon('crown', { size: 16 }),
            el('span', { text: 'Vassalo de ' }),
            objectLink(
              { kind: 'kingdom', id: overlord.kingdomId, name: overlord.name, accent: overlord.color },
              { showIcon: false, onOpen: () => host.openRealm(overlord.kingdomId) }
            )
          ])
        : null,
      truces.length
        ? el('p', {
            class: 'ae-realm-note',
            text: `Trégua em vigor com ${truces.map(t => `${t.name} até ${t.truceUntil}`).join(', ')}.`
          })
        : null
    ]),

    m.relations.length
      ? panel({ title: 'Relações', icon: 'handshake', subtitle: `${m.relations.length}`, padded: false }, [
          buildRelationsTable(m.relations, host)
        ])
      : emptyState({
          icon: 'handshake',
          title: 'Nenhum contato',
          hint: 'Este reino ainda não encontrou nenhum outro. Sem vizinhos conhecidos não há diplomacia.'
        }),

    m.tradePartners.length
      ? panel({
          title: 'Parceiros comerciais',
          icon: 'trade-route',
          subtitle: 'Por volume real movido em rotas com uma ponta neste reino'
        }, m.tradePartners.slice(0, 8).map(partner => el('div', { class: 'ae-realm-partner' }, [
          progressBar({
            label: partner.name,
            value: partner.share,
            valueText: `${formatPercent(partner.share)} · ${partner.volume.toFixed(1)}`,
            status: 'neutral',
            tooltip: {
              title: partner.name,
              value: partner.volume.toFixed(1),
              description: 'Volume somado das rotas entre os dois reinos.',
              rows: [{ label: 'Parcela do comércio externo', value: formatPercent(partner.share) }]
            }
          }),
          objectLink(
            { kind: 'kingdom', id: partner.kingdomId, name: partner.name, accent: partner.color },
            { showIcon: false, onOpen: () => host.openRealm(partner.kingdomId) }
          )
        ])))
      : null
  ];
}

const RELATION_STATUS: Record<Relationship['status'], { label: string; status: Status; explain: string }> = {
  alliance: { label: 'Aliança', status: 'positive', explain: 'Tratado de aliança em vigor.' },
  friendly: { label: 'Amistoso', status: 'positive', explain: 'Relação positiva, sem tratado formal.' },
  neutral: { label: 'Neutro', status: 'neutral', explain: 'Nenhuma inclinação registrada.' },
  hostile: { label: 'Hostil', status: 'warning', explain: 'Relação deteriorada. Precede guerra.' },
  war: { label: 'Guerra', status: 'critical', explain: 'Conflito aberto em curso.' }
};

function buildRelationsTable(relations: Relationship[], host: RealmScreenHost): HTMLElement {
  const columns: Column<Relationship>[] = [
    {
      key: 'name', header: 'Reino',
      cell: r => objectLink(
        { kind: 'kingdom', id: r.kingdomId, name: r.name, accent: r.color, status: r.status === 'war' ? 'critical' : undefined },
        { showIcon: false, onOpen: () => host.openRealm(r.kingdomId) }
      ),
      sortValue: r => r.name
    },
    {
      key: 'status', header: 'Situação', width: '104px',
      cell: r => badge(RELATION_STATUS[r.status].label, { size: 'sm', status: RELATION_STATUS[r.status].status, variant: 'outline' }),
      sortValue: r => r.status
    },
    {
      key: 'relation', header: 'Relação', align: 'right', width: '88px',
      cell: r => trendIndicator({ delta: r.relation, text: `${r.relation > 0 ? '+' : ''}${Math.round(r.relation)}`, compact: true }),
      sortValue: r => r.relation,
      tooltip: { title: 'Relação', description: 'Índice de −100 a +100 que a simulação mantém entre cada par de reinos.' }
    },
    {
      key: 'volume', header: 'Comércio', align: 'right', width: '92px',
      cell: r => (r.tradeVolume > 0 ? r.tradeVolume.toFixed(1) : '—'),
      sortValue: r => r.tradeVolume
    },
    {
      key: 'treaties', header: 'Tratados',
      // Only treaty kinds the simulation actually stores. There is no invented
      // "non-aggression pact" here because there is no such record to read.
      cell: r => badgeRow([
        r.hasAgreement ? badge('Comércio', { size: 'sm', status: 'positive', variant: 'outline', icon: 'trade' }) : null,
        r.truceUntil !== null ? badge(`Trégua até ${r.truceUntil}`, { size: 'sm', status: 'neutral', variant: 'outline' }) : null,
        r.isVassal ? badge('Vassalo', { size: 'sm', variant: 'outline', icon: 'crown' }) : null,
        r.isOverlord ? badge('Suserano', { size: 'sm', variant: 'outline', icon: 'crown' }) : null,
        r.embargoed ? badge('Embargo', { size: 'sm', status: 'critical', variant: 'outline' }) : null
      ]),
      sortValue: r => (r.hasAgreement ? 1 : 0) + (r.truceUntil !== null ? 1 : 0)
    }
  ];

  return table({
    columns, rows: relations,
    rowKey: r => r.kingdomId,
    sortBy: 'relation', sortDir: 'desc',
    onRowClick: r => host.openRealm(r.kingdomId),
    status: r => (r.status === 'war' ? 'critical' : r.status === 'hostile' ? 'warning' : undefined),
    rowTooltip: r => ({
      title: r.name,
      description: RELATION_STATUS[r.status].explain,
      rows: [
        { label: 'Relação', value: `${Math.round(r.relation)}` },
        { label: 'Comércio', value: r.tradeVolume > 0 ? r.tradeVolume.toFixed(1) : 'nenhum' },
        ...(r.embargoed ? [{ label: 'Embargo', value: 'em vigor', status: 'critical' as Status }] : [])
      ],
      footnote: 'Clique para abrir o dossiê deste reino'
    })
  });
}

// ============================ MILITARY ============================

export function buildMilitary(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const a = m.army;

  return [
    panel({ title: 'Força', icon: 'war' }, [
      statGrid([
        stat({
          label: 'Poder militar', value: formatCompact(m.militaryPower), icon: 'war',
          tooltip: {
            title: 'Poder militar',
            description: 'Índice que a simulação usa em decisões de guerra. Combina tropas, tecnologia e exaustão.'
          }
        }),
        stat({ label: 'Combatentes', value: a.total, icon: 'people' }),
        stat({ label: 'Soldados', value: a.soldiers, icon: 'swords' }),
        stat({ label: 'Arqueiros', value: a.archers, icon: 'bow' }),
        stat({
          label: 'Armados', value: `${a.armed} / ${a.total}`, icon: 'axe',
          status: a.total === 0 ? undefined : a.armed >= a.total * 0.8 ? 'positive' : a.armed >= a.total / 2 ? 'warning' : 'critical',
          tooltip: {
            title: 'Combatentes armados',
            description: 'Contagem de combatentes portando uma arma de verdade no inventário. Um exército desarmado é uma multidão.'
          }
        }),
        stat({
          label: 'Blindados', value: `${a.armoured} / ${a.total}`, icon: 'shield',
          tooltip: { title: 'Combatentes com armadura', description: 'Contados do equipamento que cada um efetivamente carrega.' }
        })
      ]),
      progressBar({
        label: 'Cansaço de guerra',
        value: m.warWeariness,
        valueText: formatPercent(m.warWeariness),
        status: m.warWeariness >= 0.6 ? 'critical' : m.warWeariness >= 0.4 ? 'warning' : 'positive',
        tooltip: {
          title: 'Cansaço de guerra',
          value: formatPercent(m.warWeariness),
          description: 'Exaustão acumulada por anos de conflito. Reduz a moral em batalha e alimenta a pressão por paz.'
        }
      }),
      progressBar({
        label: 'Ameaça externa',
        value: m.externalThreat,
        valueText: formatPercent(m.externalThreat),
        status: m.externalThreat >= 0.6 ? 'critical' : m.externalThreat >= 0.35 ? 'warning' : 'positive',
        tooltip: {
          title: 'Ameaça externa',
          value: formatPercent(m.externalThreat),
          description: 'A pior combinação de poder e proximidade entre os reinos conhecidos. Guerra declarada leva ao máximo.'
        }
      })
    ]),

    a.equipment.length
      ? panel({
          title: 'Equipamento em serviço',
          icon: 'axe',
          subtitle: 'Armas que os combatentes deste reino realmente carregam'
        }, [
          rowList(a.equipment.slice(0, 8).map(item => statRow({
            label: item.name,
            value: `${item.count}`,
            icon: 'swords',
            unit: a.armed > 0 ? formatPercent(item.count / a.armed) : undefined
          })))
        ])
      : a.total > 0
        ? panel({ title: 'Equipamento em serviço', icon: 'axe' }, [
            emptyState({
              icon: 'axe',
              title: 'Nenhum combatente armado',
              hint: `${a.total} combatente(s) sem arma no inventário.`,
              compact: true
            })
          ])
        : null,

    m.wars.length
      ? panel({ title: 'Guerras em curso', icon: 'war', subtitle: `${m.wars.length}` },
          m.wars.map(war => buildWarCard(war, m, host)))
      : panel({ title: 'Guerras', icon: 'diplomacy' }, [
          emptyState({ icon: 'diplomacy', title: 'Em paz', hint: 'Nenhum conflito em curso.', compact: true })
        ]),

    m.military.length ? buildMilitaryEconomyPanel(m, host) : null
  ];
}

/**
 * One war, with real figures only.
 *
 * Casualties come from the war record's own kill counters. Settlements are counted
 * from the Chronicle's conquest entries on this war's thread — which is why the
 * heading says who holds them *now* rather than claiming a tally the simulation
 * never kept.
 */
function buildWarCard(war: WarSummary, m: RealmMetrics, host: RealmScreenHost): HTMLElement {
  const changed = citiesChangedHands(war, m, host);

  return el('div', { class: 'ae-realm-war' }, [
    el('div', { class: 'ae-realm-war-head' }, [
      icon('war', { size: 16, class: 'ae-realm-war-icon' }),
      el('div', { class: 'ae-realm-war-title' }, [
        el('span', { class: 'ae-realm-war-name' }, [
          el('span', { text: 'Contra ' }),
          objectLink(
            { kind: 'kingdom', id: war.enemyId, name: war.enemyName, status: 'critical' },
            { showIcon: false, onOpen: () => host.openRealm(war.enemyId) }
          )
        ]),
        el('span', { class: 'ae-realm-war-goal', text: war.war.reason })
      ]),
      badgeRow([
        badge(war.aggressor ? 'Agressor' : 'Defensor', { size: 'sm', variant: 'outline' }),
        badge(`${war.years} ano(s)`, { size: 'sm', variant: 'outline', icon: 'calendar' })
      ])
    ]),
    statGrid([
      stat({ label: 'Início', value: `${war.war.startYear}`, icon: 'calendar' }),
      stat({ label: 'Batalhas', value: war.war.battles, icon: 'swords' }),
      stat({
        label: 'Baixas infligidas', value: formatCompact(war.killsInflicted), icon: 'swords',
        tooltip: { title: 'Baixas infligidas', value: formatFull(war.killsInflicted), description: 'Mortes registradas pelo próprio registro de guerra.' }
      }),
      stat({
        label: 'Baixas sofridas', value: formatCompact(war.killsSuffered), icon: 'warning',
        status: war.killsSuffered > war.killsInflicted ? 'critical' : undefined,
        tooltip: { title: 'Baixas sofridas', value: formatFull(war.killsSuffered), description: 'Mortes registradas pelo próprio registro de guerra.' }
      })
    ]),
    changed
  ]);
}

/**
 * Settlements that changed hands in this war, resolved against who holds them now.
 *
 * The Chronicle records every capture on the war's own thread with a structured
 * city reference, so this is a lookup rather than a text search. What it cannot
 * tell us is a running tally per side — a city can change hands three times — so
 * the split reported is by current owner, and the wording says exactly that.
 */
function citiesChangedHands(war: WarSummary, m: RealmMetrics, host: RealmScreenHost): HTMLElement | null {
  const events = chronicle.getEventsForRef('war', war.war.id).filter(e => e.type === 'conquest');
  if (!events.length) return null;

  const seen = new Map<string, string>();
  for (const event of events) {
    for (const ref of event.refs) {
      if (ref.kind === 'city') seen.set(ref.id, ref.name ?? ref.id);
    }
  }
  if (!seen.size) return null;

  const own = new Set(m.cities.map(c => c.id));
  const mine: { id: string; name: string }[] = [];
  const theirs: { id: string; name: string }[] = [];
  for (const [id, name] of seen) {
    (own.has(id) ? mine : theirs).push({ id, name });
  }

  return section('Assentamentos que mudaram de mão', [
    rowList([
      statRow({
        label: 'Sob controle deste reino agora', value: `${mine.length}`, icon: 'city',
        status: mine.length ? 'positive' : undefined,
        tooltip: mine.length
          ? { title: 'Sob controle deste reino', description: mine.map(c => c.name).join(', ') }
          : { title: 'Sob controle deste reino', description: 'Nenhum.' }
      }),
      statRow({
        label: 'Fora do controle deste reino', value: `${theirs.length}`, icon: 'warning',
        status: theirs.length ? 'critical' : undefined,
        tooltip: theirs.length
          ? { title: 'Fora do controle deste reino', description: theirs.map(c => c.name).join(', ') }
          : { title: 'Fora do controle deste reino', description: 'Nenhum.' }
      }),
      ...[...mine, ...theirs].slice(0, 6).map(city => el('div', { class: 'ae-row' }, [
        icon('city', { size: 16, class: 'ae-row-icon' }),
        el('span', { class: 'ae-row-label' }, [
          objectLink(
            { kind: 'city', id: city.id, name: city.name, status: own.has(city.id) ? undefined : 'critical' },
            { showIcon: false, onOpen: () => host.openCityDossier(city.id) }
          )
        ]),
        el('span', { class: 'ae-row-value' }, [
          el('span', { class: 'ae-row-unit', text: own.has(city.id) ? 'deste reino' : 'de outro' })
        ])
      ]))
    ])
  ], {
    icon: 'city',
    hint: `${seen.size} registrado(s) na crônica`
  });
}

/**
 * What the war effort consumes — item 27.
 *
 * These are the goods a campaign actually runs on. Reported as positions rather
 * than as a "readiness score", because the simulation does not compute one and
 * inventing a weighting would be a number nobody could check.
 */
function buildMilitaryEconomyPanel(m: RealmMetrics, host: RealmScreenHost): HTMLElement {
  return panel({
    title: 'Economia de guerra',
    icon: 'industry',
    subtitle: `${m.military.length} de ${MILITARY_GOODS.length} insumos militares presentes no reino`,
    padded: false
  }, [buildGoodsTable(m.military, host, 'stock')]);
}

// ============================ INFRASTRUCTURE ============================

export function buildInfrastructure(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const i = m.infrastructure;

  return [
    i.bottlenecks.length ? buildInfraBottlenecks(i.bottlenecks, host) : null,

    panel({ title: 'Rede', icon: 'trade-route' }, [
      statGrid([
        stat({
          label: 'Melhor via', value: i.roadLevel > 0 ? ROAD_LEVEL_LABEL[i.roadLevel] ?? `Nível ${i.roadLevel}` : 'Nenhuma',
          icon: 'route',
          status: i.roadLevel > 0 ? 'positive' : 'warning',
          tooltip: { title: 'Estrada', description: 'Melhor nível de via em qualquer tile do território do reino.' }
        }),
        stat({
          label: 'Ferrovia', value: i.railTiles > 0 ? `${i.railTiles}` : '—', unit: i.railTiles > 0 ? 'tiles' : undefined,
          icon: 'route',
          status: i.railTiles === 0 ? undefined : i.railDamagedTiles > 0 ? 'critical' : 'positive',
          tooltip: i.railTiles > 0
            ? {
                title: 'Ferrovia',
                value: `${i.railTiles} tiles`,
                description: 'Trilhos assentados no território do reino.',
                rows: [{
                  label: 'Trechos rompidos', value: `${i.railDamagedTiles}`,
                  status: i.railDamagedTiles > 0 ? 'critical' : 'positive'
                }]
              }
            : { title: 'Ferrovia', description: 'Este reino ainda não assentou trilhos.' }
        }),
        i.railTiles > 0
          ? stat({
              label: 'Cidades ligadas por trilho', value: i.railConnectedCities, icon: 'city',
              tooltip: {
                title: 'Conectividade ferroviária',
                description: 'Assentamentos que compartilham um trecho contínuo de trilho com outro do mesmo reino.'
              }
            })
          : null,
        stat({ label: 'Portos', value: i.ports, icon: 'route' }),
        stat({ label: 'Ancoradouros', value: i.harbours, icon: 'route' }),
        stat({
          label: 'Rotas ativas', value: `${i.routesActive}`, icon: 'trade-route',
          status: i.routesSuspended > 0 ? 'warning' : undefined,
          tooltip: {
            title: 'Rotas',
            description: 'Rotas com uma ponta neste reino.',
            rows: [
              { label: 'Ativas', value: `${i.routesActive}`, status: 'positive' },
              { label: 'Suspensas', value: `${i.routesSuspended}`, status: i.routesSuspended ? 'critical' : 'positive' },
              { label: 'Marítimas', value: `${i.maritimeRoutes}` },
              { label: 'Terrestres', value: `${i.overlandRoutes}` }
            ]
          }
        })
      ].filter(Boolean) as HTMLElement[]),

      // Freight is a world figure, and saying so is the difference between a
      // measurement and a misattribution.
      i.railTiles > 0
        ? statRow({
            label: 'Carga ferroviária', value: formatCompact(i.worldFreight), icon: 'crate',
            unit: 'no mundo',
            tooltip: {
              title: 'Carga movida por trilho',
              value: formatFull(Math.round(i.worldFreight)),
              description: 'A simulação contabiliza o frete ferroviário globalmente, não por reino. Por isso este número é do mundo inteiro, não deste reino.',
              footnote: 'Figura mundial, não do reino'
            }
          })
        : null
    ]),

    i.railTiles === 0 && i.roadLevel === 0
      ? emptyState({
          icon: 'trade-route',
          title: 'Nenhuma infraestrutura de transporte',
          hint: 'Sem vias nem trilhos no território. Tudo se move na velocidade de quem caminha.'
        })
      : null
  ];
}

const ROAD_LEVEL_LABEL: Record<number, string> = {
  1: 'Trilha de terra', 2: 'Via de pedra', 3: 'Estrada imperial'
};

/** Item 29: what the network cannot do, with somewhere to go about it. */
function buildInfraBottlenecks(bottlenecks: InfraBottleneck[], host: RealmScreenHost): HTMLElement {
  return panel({
    title: 'Gargalos de infraestrutura',
    icon: 'alert',
    subtitle: `${bottlenecks.length} identificado(s) pelo estado real da rede`
  }, bottlenecks.slice(0, 8).map(bottleneck => el('div', {
    class: `ae-realm-bottleneck ae-realm-bottleneck-${bottleneck.severity}`
  }, [
    icon(bottleneck.kind === 'route-suspended' ? 'trade-route' : 'route', { size: 16, class: 'ae-realm-bottleneck-icon' }),
    el('div', { class: 'ae-realm-bottleneck-text' }, [
      el('span', { class: 'ae-realm-bottleneck-subject', text: bottleneck.subject }),
      el('span', { class: 'ae-realm-bottleneck-cause', text: bottleneck.cause })
    ]),
    el('div', { class: 'ae-realm-bottleneck-actions' }, [
      bottleneck.good
        ? miniButton('good', GOODS[bottleneck.good].name, 'Abrir este bem na Economia.', () => host.openGood(bottleneck.good!))
        : null,
      bottleneck.cityId
        ? miniButton('city', 'Dossiê da cidade', 'Abre o dossiê do assentamento.', () => host.openCityDossier(bottleneck.cityId!))
        : null,
      bottleneck.kingdomId
        ? miniButton('kingdom', 'Ver o reino', 'Abre o dossiê do outro reino.', () => host.openRealm(bottleneck.kingdomId!))
        : null,
      bottleneck.at
        ? miniButton('map', 'Ir até lá', 'Fecha o dossiê e centraliza a câmera no ponto.', () => host.goToMap(bottleneck.at!.x, bottleneck.at!.y))
        : null
    ])
  ])));
}

// ============================ TECHNOLOGY ============================

/**
 * What the realm knows, and what it can actually do with it — item 31.
 *
 * The distinction is the point of this tab. `TechCapability` already carries a
 * per-technology capacity plus the buildings and goods that are missing, so a
 * realm that has researched combustion with no oil and no refinery is shown as
 * exactly that rather than as an industrial power.
 */
export function buildTechnology(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const t = m.technology;

  return [
    panel({ title: 'Estado da técnica', icon: 'technology' }, [
      statGrid([
        stat({
          label: 'Era operacional', value: t.eraName, icon: 'era',
          tooltip: {
            title: 'Era operacional',
            description: 'A era que o reino consegue de fato operar — não a mais avançada que já pesquisou.'
          }
        }),
        stat({ label: 'Tecnologias conhecidas', value: t.known, icon: 'book' }),
        stat({
          label: 'Capacidade de uso', value: formatPercent(t.capacity), icon: 'industry',
          status: t.capacity >= 0.75 ? 'positive' : t.capacity >= 0.5 ? 'neutral' : 'warning',
          tooltip: {
            title: 'Capacidade tecnológica',
            value: formatPercent(t.capacity),
            description: 'Quanto do que o reino sabe ele consegue operar, dadas as construções e os insumos que tem. Descobrir não é o mesmo que conseguir usar.'
          }
        }),
        stat({ label: 'Pesquisa por ano', value: t.output.toFixed(1), icon: 'flask' })
      ]),

      t.current
        ? progressBar({
            label: `Pesquisando: ${t.current.name}`,
            value: t.current.cost > 0 ? Math.min(1, t.current.progress / t.current.cost) : 0,
            valueText: `${t.current.progress.toFixed(0)} / ${t.current.cost.toFixed(0)}`,
            status: 'neutral',
            tooltip: {
              title: t.current.name,
              description: 'Progresso acumulado contra o custo da tecnologia.',
              rows: t.output > 0
                ? [{ label: 'Ao ritmo atual', value: `${Math.ceil(Math.max(0, t.current.cost - t.current.progress) / t.output)} ano(s)` }]
                : undefined,
              footnote: t.output > 0 ? undefined : 'Sem produção de pesquisa — o progresso está parado'
            }
          })
        : el('p', { class: 'ae-realm-note', text: 'Nenhuma pesquisa em andamento.' })
    ]),

    /**
     * The gap between knowing and doing, named per technology with what is
     * missing. This is the most useful block on the tab and it is entirely the
     * engine's own accounting.
     */
    t.idleCapabilities.length
      ? panel({
          title: 'Conhecida mas não aproveitada',
          icon: 'alert',
          subtitle: `${t.idleCapabilities.length} tecnologia(s) sem a base para operar`
        }, t.idleCapabilities.slice(0, 8).map(capability => el('div', {
          class: `ae-realm-capability ae-realm-capability-${capability.capacity < 0.35 ? 'critical' : 'warning'}`
        }, [
          el('div', { class: 'ae-realm-capability-head' }, [
            el('span', { class: 'ae-realm-capability-name', text: capability.name }),
            badge(formatPercent(capability.capacity), {
              size: 'sm', variant: 'outline',
              status: capability.capacity < 0.35 ? 'critical' : 'warning'
            })
          ]),
          progressBar({
            label: 'Aproveitamento',
            value: capability.capacity,
            valueText: formatPercent(capability.capacity),
            status: capability.capacity < 0.35 ? 'critical' : 'warning',
            tooltip: {
              title: capability.name,
              value: formatPercent(capability.capacity),
              description: 'Quanto desta tecnologia o reino consegue operar. A simulação calcula por construções e insumos disponíveis.'
            }
          }),
          capability.missingGoods.length
            ? el('div', { class: 'ae-realm-capability-missing' }, [
                el('span', { class: 'ae-muted', text: 'faltam insumos:' }),
                ...capability.missingGoods.slice(0, 4).map(good => objectLink(
                  { kind: 'good', id: good, name: GOODS[good]?.name ?? good, status: 'critical' },
                  { showIcon: false, onOpen: () => host.openGood(good) }
                ))
              ])
            : null,
          capability.missingBuildings.length
            ? el('div', { class: 'ae-realm-capability-missing' }, [
                el('span', { class: 'ae-muted', text: 'faltam construções:' }),
                el('span', {
                  text: capability.missingBuildings
                    .slice(0, 4)
                    .map(type => BUILDINGS[type]?.name ?? String(type))
                    .join(', ')
                })
              ])
            : null
        ])))
      : panel({ title: 'Aproveitamento', icon: 'technology' }, [
          emptyState({
            icon: 'technology',
            title: 'Tudo que sabe, sabe usar',
            hint: 'Nenhuma tecnologia conhecida está sem as construções e os insumos para operar.',
            compact: true
          })
        ]),

    t.recent.length
      ? panel({
          title: 'Tecnologias em mãos',
          icon: 'book',
          subtitle: 'Das eras mais avançadas que o reino alcançou',
          actions: [button('Árvore completa', () => host.openTechTree(), { variant: 'ghost', size: 'sm', icon: 'technology' })]
        }, [
          rowList(t.recent.map(tech => el('div', { class: 'ae-row' }, [
            icon('flask', { size: 16, class: 'ae-row-icon' }),
            el('span', { class: 'ae-row-label' }, [
              objectLink({ kind: 'technology', id: tech.id, name: tech.name }, { showIcon: false })
            ]),
            el('span', { class: 'ae-row-value' }, [
              el('span', { class: 'ae-row-unit', text: TECH_ERAS[tech.era]?.name ?? tech.era }),
              tech.demands.length
                ? withTooltip(
                    badge(`${tech.demands.length} insumo(s)`, { size: 'sm', variant: 'outline', icon: 'crate' }),
                    {
                      title: 'Consequência econômica',
                      description: `Esta tecnologia cria demanda por ${tech.demands.map(g => GOODS[g]?.name ?? g).join(', ')}.`,
                      footnote: 'Demanda declarada pela própria tecnologia'
                    }
                  )
                : null,
              tech.unlockedBuildings.length
                ? withTooltip(
                    badge(`${tech.unlockedBuildings.length} construção(ões)`, { size: 'sm', variant: 'outline', icon: 'building' }),
                    { title: 'Destrava', description: tech.unlockedBuildings.join(', ') }
                  )
                : null
            ])
          ])))
        ])
      : null,

    // Economic consequences of what the realm knows, from the technologies' own
    // declared demands rather than from a guess about what an era needs.
    buildTechDemandPanel(m, host)
  ];
}

/** Which goods the realm's own technologies created demand for, and its position. */
function buildTechDemandPanel(m: RealmMetrics, host: RealmScreenHost): HTMLElement | null {
  const demanded = new Set<GoodId>();
  for (const tech of m.technology.recent) {
    for (const good of tech.demands) demanded.add(good);
  }
  if (!demanded.size) return null;

  const positions = m.goods.filter(p => demanded.has(p.good));
  const absent = [...demanded].filter(good => !positions.some(p => p.good === good));

  return panel({
    title: 'Consequências econômicas',
    icon: 'crate',
    subtitle: 'Insumos que as tecnologias deste reino passaram a exigir',
    padded: false
  }, [
    positions.length ? buildGoodsTable(positions, host, 'stock') : null,
    absent.length
      ? el('p', { class: 'ae-realm-note' }, [
          el('span', { text: 'Exigidos e ausentes do reino: ' }),
          ...absent.map(good => objectLink(
            { kind: 'good', id: good, name: GOODS[good]?.name ?? good, status: 'critical' },
            { showIcon: false, onOpen: () => host.openGood(good) }
          ))
        ])
      : null
  ]);
}

// ============================ HISTORY ============================

/**
 * The realm's history, from the Chronicle's structured references.
 *
 * `getEventsForRef('kingdom', id)` is a reference lookup, not a text search for
 * the realm's name — which would match every namesake and miss every event that
 * referred to it obliquely. Chapters come from the Chronicle's own threads, so a
 * war reads as one arc rather than as nine scattered lines.
 */
export function buildHistory(m: RealmMetrics, host: RealmScreenHost): Child[] {
  const all = chronicle.getEventsForRef('kingdom', m.kingdomId);
  if (!all.length) {
    return [emptyState({
      icon: 'history',
      title: 'Nenhum registro',
      hint: 'Nada foi registrado sobre este reino ainda. A crônica guarda o que acontece — avance o tempo.'
    })];
  }

  const notable = all.filter(e => e.importance !== 'minor').sort((a, b) => b.year - a.year);

  // Threads with two or more events on this realm's record are real arcs. A
  // single-event thread is just an event, and dressing it as a chapter would
  // invent structure the Chronicle did not record.
  const threads = new Map<string, { title: string; events: typeof all }>();
  for (const event of all) {
    if (!event.threadId) continue;
    const entry = threads.get(event.threadId) ?? { title: event.threadTitle ?? event.title ?? 'Capítulo', events: [] };
    entry.events.push(event);
    threads.set(event.threadId, entry);
  }
  const chapters = [...threads.values()]
    .filter(chapter => chapter.events.length >= 2)
    .map(chapter => ({ ...chapter, events: [...chapter.events].sort((a, b) => a.year - b.year) }))
    .sort((a, b) => b.events[b.events.length - 1].year - a.events[a.events.length - 1].year);

  return [
    chapters.length
      ? panel({
          title: 'Capítulos',
          icon: 'scroll',
          subtitle: `${chapters.length} arco(s) que a crônica agrupou`
        }, chapters.slice(0, 6).map(chapter => section(chapter.title, [
          el('div', { class: 'ae-realm-timeline' }, chapter.events.slice(0, 8).map(event => buildEventRow(event)))
        ], {
          icon: 'history',
          hint: `${chapter.events[0].year}–${chapter.events[chapter.events.length - 1].year}`
        })))
      : null,

    panel({
      title: 'História',
      icon: 'history',
      subtitle: `${notable.length} evento(s) relevante(s) de ${all.length} registro(s)`,
      actions: [button('Crônica completa', () => host.openChronicle(), { variant: 'ghost', size: 'sm', icon: 'history' })]
    }, [
      notable.length
        ? el('div', { class: 'ae-realm-timeline' }, notable.slice(0, 24).map(event => buildEventRow(event)))
        : emptyState({
            icon: 'history',
            title: 'Só registros menores',
            hint: `${all.length} registro(s) de baixa relevância. A crônica completa tem tudo.`,
            compact: true
          })
    ])
  ];
}

function buildEventRow(event: ReturnType<typeof chronicle.getEvents>[number]): HTMLElement {
  return withTooltip(
    el('div', { class: `ae-realm-event ae-realm-event-${event.importance}` }, [
      el('span', { class: 'ae-realm-event-year', text: `${event.year}` }),
      el('div', { class: 'ae-realm-event-body' }, [
        el('span', { class: 'ae-realm-event-title', text: event.title ?? event.text }),
        event.title ? el('span', { class: 'ae-realm-event-text', text: event.text }) : null
      ]),
      badge(event.type, { size: 'sm', variant: 'outline' })
    ]),
    {
      title: event.title ?? `Ano ${event.year}`,
      description: event.text,
      icon: 'history',
      rows: [
        { label: 'Ano', value: `${event.year}` },
        { label: 'Importância', value: event.importance },
        { label: 'Tipo', value: event.type }
      ],
      footnote: event.causes.length ? `Causa: ${event.causes[0]}` : undefined
    }
  );
}

// ============================ SHARED ============================

/** A 24px icon button with a tooltip. Used for every "go look at it" action. */
function miniButton(iconName: string, title: string, description: string, onClick: () => void): HTMLElement {
  return withTooltip(
    el('button', {
      class: 'ae-realm-mini-btn',
      attrs: { type: 'button', 'aria-label': title },
      on: { click: onClick }
    }, [icon(iconName, { size: 16 })]),
    { title, description }
  );
}

/** Kept for the header: the realm's government name, from the definitions. */
export function governmentName(id: string): string {
  return GOVERNMENTS[id as keyof typeof GOVERNMENTS]?.name ?? id;
}
