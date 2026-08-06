/**
 * The politics half of the command centre.
 *
 * Ordering throughout follows the brief's hierarchy: critical risk, then the
 * government and who rules it, then the factions pressing on it, then the laws,
 * then the detail. A realm about to be overthrown says so above its tax rate.
 *
 * The faction blocks are the heart of it. Each one shows where the faction
 * stands and *why*, and the why is `FactionState.factors` — the deltas the
 * society tick applied, read back with the labels the simulation wrote. A factor
 * sourced to a good is clickable, so a grievance about bread opens the bread.
 */
import { el, Child } from '../core/Dom';
import {
  panel, section, divider, statRow, rowList, statGrid, stat, progressBar,
  badge, badgeRow, table, emptyState, objectLink, icon, withTooltip, button,
  formatPercent, trendIndicator,
  type Status, type Column
} from '../kit';
import { GOODS } from '../../civ/Goods';
import { chronicle } from '../../civ/Chronicle';
import { type LawCategory, type LawDefinition, type LawEffects } from '../../civ/Laws';
import {
  diagnosePolitics, politicalProblems, politicalPressures,
  pct, signedPoints, band, inverted, statusOf, verdictLabel,
  successionLabel, successionExplain, stanceLabel, stanceStatus, stanceMarks,
  factionLabel, factionShortLabel, factionDescriptionLabel,
  type PoliticalCondition, type PoliticalPressure
} from './PoliticsDiagnostics';
import { lawsByCategory, type PoliticsMetrics, type FactionView } from './PoliticsMetrics';
import type { PoliticsScreenHost } from '../screens/PoliticsScreen';

// ============================ VOCABULARY ============================

/** Terms a reader could reasonably misread, defined where they are shown. */
export const TERMS: Record<string, string> = {
  legitimacy: 'Crença pública de que a ordem atual tem direito de governar. Derrotas, fome e reformas impostas a derrubam; vitórias e tradição a sustentam.',
  stability: 'Contentamento material da população. Sobe com prosperidade e comida, cai com desigualdade, desemprego e guerra.',
  influence: 'Peso desta facção nas decisões do reino. Depende da forma de governo e do estágio econômico.',
  satisfaction: 'Quanto esta facção está obtendo o que quer. É o número que os fatores abaixo explicam.',
  loyalty: 'Disposição a aceitar a ordem atual mesmo estando insatisfeita. É o que separa reclamação de revolta.',
  radicalization: 'Disposição a agir fora da ordem — revolta, golpe, sabotagem.',
  reformPressure: 'Força somada das facções que querem mudar as leis. Alta o bastante, a coroa reforma ou é reformada.',
  warSupport: 'Quanto esta facção quer o conflito.',
  warWeariness: 'Exaustão acumulada por anos de guerra. Reduz a moral em batalha e alimenta a pressão por paz.',
  relationScore: 'Índice de −100 a +100 que a simulação mantém entre cada par de reinos. Ela guarda apenas o número: não há registro de quanto cada acontecimento contribuiu.',
  tradeDependency: 'Valor movido em rotas ativas contra o PIB. Alto significa que um bloqueio dói.',
  administrativeReach: 'Quanto do reino a coroa consegue de fato governar. Cai com a distância média das cidades à capital e com o número de assentamentos.',
  cohesion: 'O quanto as facções ainda convergem. Baixa coesão precede fratura.',
  regimeStance: 'Onde a facção se posiciona diante do regime, de −3 a +3. Construído de três números registrados: lealdade, satisfação, e se a definição da facção lista este governo entre os que ela apoia ou combate.'
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

export function factionName(faction: FactionView): string {
  return factionLabel(faction.id, faction.definition.name);
}
export function factionShort(id: string, fallback: string): string {
  return factionShortLabel(id, fallback);
}
function factionDescription(faction: FactionView): string {
  return factionDescriptionLabel(faction.id, faction.definition.description);
}

const EFFECT_LABEL: Record<string, string> = {
  taxMultiplier: 'Arrecadação', stability: 'Estabilidade', legitimacy: 'Legitimidade',
  administrativeReach: 'Alcance administrativo', foodSecurity: 'Reserva alimentar',
  trade: 'Comércio', production: 'Produção', research: 'Pesquisa', military: 'Militar',
  expansion: 'Expansão', inequality: 'Desigualdade', reformPressure: 'Pressão por reforma',
  revoltRisk: 'Risco de revolta'
};

/** Effects where a rise is bad news, so the colour follows meaning, not sign. */
const INVERTED_EFFECTS = new Set(['inequality', 'reformPressure', 'revoltRisk']);

/** Which slice of an effect belongs to which reading of a law. */
const ECONOMIC_EFFECTS = new Set(['taxMultiplier', 'trade', 'production', 'research', 'expansion']);
const POLITICAL_EFFECTS = new Set(['legitimacy', 'administrativeReach', 'military', 'reformPressure']);
const SOCIAL_EFFECTS = new Set(['stability', 'foodSecurity', 'inequality', 'revoltRisk']);

// ============================ OVERVIEW ============================

export function buildOverview(m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  const conditions = diagnosePolitics(m);
  const urgent = politicalProblems(conditions);
  const settled = conditions.filter(c => !urgent.includes(c));
  const pressures = politicalPressures(m);

  return [
    pressures.length ? buildPressures(pressures, m, host) : null,

    panel({ title: 'O regime', icon: 'politics' }, [
      statGrid([
        stat({
          label: 'Forma de governo', value: m.government.name, icon: 'politics',
          tooltip: {
            title: m.government.name,
            description: m.government.description,
            rows: [{ label: 'Adotado no ano', value: `${m.governmentSince}` }]
          }
        }),
        stat({
          label: 'Sistema econômico', value: ECONOMIC_SYSTEM_LABEL[m.economicSystem] ?? m.economicSystem, icon: 'economy',
          tooltip: { title: 'Sistema econômico', description: 'Determinado pela forma de governo. Define o patamar de desigualdade e como a produção é organizada.' }
        }),
        stat({
          label: 'Legitimidade', value: pct(m.legitimacy), icon: 'crown', status: band(m.legitimacy),
          tooltip: { title: 'Legitimidade', value: pct(m.legitimacy), description: TERMS.legitimacy }
        }),
        stat({
          label: 'Estabilidade', value: pct(m.stability), icon: 'shield', status: band(m.stability),
          tooltip: { title: 'Estabilidade', value: pct(m.stability), description: TERMS.stability }
        }),
        stat({
          label: 'Pressão por reforma', value: pct(m.society.reformPressure), icon: 'scroll',
          status: inverted(m.society.reformPressure),
          tooltip: { title: 'Pressão por reforma', value: pct(m.society.reformPressure), description: TERMS.reformPressure }
        }),
        stat({
          label: 'Risco de revolta', value: pct(m.society.revoltRisk), icon: 'warning',
          status: inverted(m.society.revoltRisk),
          tooltip: { title: 'Risco de revolta', description: 'Probabilidade de levante popular. Sobe com fome, desemprego e radicalização.' }
        }),
        stat({
          label: 'Risco de golpe', value: pct(m.society.coupRisk), icon: 'war',
          status: inverted(m.society.coupRisk),
          tooltip: { title: 'Risco de golpe', description: 'Probabilidade de que quem tem armas tome o poder. Sobe com militares insatisfeitos e legitimidade baixa.' }
        }),
        stat({
          label: 'Apoio à guerra', value: pct(m.society.warPressure), icon: 'war',
          tooltip: { title: 'Pressão por guerra', description: 'Quanto as facções empurram o reino ao conflito. Sem cor: querer guerra não é bom nem ruim em si.' }
        }),
        m.succession.ruler
          ? stat({
              label: m.government.rulerTitle,
              value: m.succession.ruler.title ?? m.succession.ruler.name,
              icon: 'crown',
              onClick: () => host.openCitizen(m.succession.ruler!.id),
              tooltip: { title: 'Governante', description: 'Clique para abrir a ficha completa no inspetor.' }
            })
          : stat({ label: m.government.rulerTitle, value: 'Trono vago', icon: 'crown', status: 'critical' })
      ].filter(Boolean) as HTMLElement[])
    ]),

    urgent.length
      ? panel({
          title: 'Condições políticas atuais',
          icon: 'alert',
          subtitle: `${urgent.length} fora do normal`,
          class: 'ae-pol-urgent'
        }, urgent.map(c => buildConditionRow(c, m, host)))
      : null,

    settled.length
      ? panel({
          title: urgent.length ? 'Demais condições' : 'Condições políticas',
          icon: 'statistics',
          subtitle: urgent.length ? undefined : 'Nada fora do normal'
        }, settled.map(c => buildConditionRow(c, m, host)))
      : null,

    buildCoalition(m, host)
  ];
}

/** One condition: verdict, finding, and the arithmetic behind it on hover. */
function buildConditionRow(condition: PoliticalCondition, m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement {
  const status = statusOf(condition);
  const target = condition.good
    ? () => host.openGood(condition.good!)
    : condition.factionId
      ? () => host.focusFaction(condition.factionId!)
      : null;

  const node = el(target ? 'button' : 'div', {
    class: ['ae-pol-condition', `ae-pol-condition-${status}`, target ? 'ae-pol-condition-live' : '']
      .filter(Boolean).join(' '),
    attrs: target ? { type: 'button' } : {},
    dataset: { conditionId: condition.id },
    on: target ? { click: target } : undefined
  }, [
    icon(condition.icon, { size: 16, class: 'ae-pol-condition-icon' }),
    el('div', { class: 'ae-pol-condition-text' }, [
      el('span', { class: 'ae-pol-condition-label', text: condition.label }),
      el('span', { class: 'ae-pol-condition-finding', text: condition.finding })
    ]),
    badge(verdictLabel(condition.status), { size: 'sm', status, variant: 'outline' })
  ]);

  return withTooltip(node, {
    title: condition.label,
    description: condition.finding,
    icon: condition.icon,
    rows: condition.terms,
    footnote: condition.good
      ? `Clique para abrir ${GOODS[condition.good]?.name ?? condition.good} na Economia`
      : condition.factionId ? 'Clique para ver a facção' : undefined
  });
}

/**
 * Political pressures, each one opened by the measured causes behind it.
 *
 * This is the join between politics and economy: the causes are the society
 * tick's own deltas and the economic figures it was handed, so following a
 * grievance about bread lands on the bread.
 */
function buildPressures(pressures: PoliticalPressure[], m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement {
  return panel({
    title: 'Pressões políticas',
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
        pressure.factionId
          ? miniButton('politics', 'Ver a facção', 'Abre a aba de facções neste grupo.', () => host.focusFaction(pressure.factionId!))
          : null
      ])
    ]),
    pressure.causes.length
      ? el('div', { class: 'ae-pol-causes' }, pressure.causes.map(cause => {
          const clickable = Boolean(cause.good);
          return withTooltip(
            el(clickable ? 'button' : 'div', {
              class: `ae-pol-cause${clickable ? ' ae-pol-cause-live' : ''}`,
              attrs: clickable ? { type: 'button' } : {},
              on: clickable ? { click: () => host.openGood(cause.good!) } : undefined
            }, [
              el('span', { class: 'ae-pol-cause-label', text: cause.label }),
              el('span', { class: 'ae-pol-cause-value', text: cause.value })
            ]),
            {
              title: cause.label,
              value: cause.value,
              description: 'Figura registrada pela simulação no último ciclo social.',
              footnote: clickable ? `Clique para abrir ${GOODS[cause.good!]?.name ?? cause.good}` : undefined
            }
          );
        }))
      : el('p', { class: 'ae-pol-note', text: 'Sem fatores registrados — a simulação recalcula esta explicação a cada ano.' })
  ])));
}

/**
 * Who holds the regime up and who pulls it down.
 *
 * The marks are never shown bare: every row carries the three recorded figures
 * the stance was built from, and the tooltip states the rule.
 */
function buildCoalition(m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement | null {
  if (!m.factions.length) return null;

  const sorted = [...m.factions].sort((a, b) => b.regimeStance - a.regimeStance);

  return panel({
    title: 'Base de sustentação',
    icon: 'politics',
    subtitle: 'Quem sustenta e quem corrói o regime, por influência'
  }, [
    el('div', { class: 'ae-pol-coalition' }, sorted.map(faction => withTooltip(
      el('button', {
        class: 'ae-pol-coalition-row',
        attrs: { type: 'button' },
        on: { click: () => host.focusFaction(faction.id) }
      }, [
        el('span', { class: 'ae-pol-coalition-name', text: factionName(faction) }),
        el('span', {
          class: `ae-pol-marks ae-pol-marks-${stanceStatus(faction.regimeStance)}`,
          text: stanceMarks(faction.regimeStance)
        }),
        el('span', { class: 'ae-pol-coalition-figures' }, [
          el('span', { text: `infl. ${pct(faction.state.influence)}` }),
          el('span', { text: `leal. ${pct(faction.state.loyalty)}` }),
          el('span', { text: `sat. ${pct(faction.state.satisfaction)}` })
        ])
      ]),
      {
        title: factionName(faction),
        value: stanceLabel(faction.regimeStance),
        description: TERMS.regimeStance,
        rows: [
          { label: 'Influência', value: pct(faction.state.influence) },
          { label: 'Lealdade', value: pct(faction.state.loyalty) },
          { label: 'Satisfação', value: pct(faction.state.satisfaction) },
          { label: 'Radicalização', value: pct(faction.state.radicalization) },
          {
            label: 'Este governo',
            value: faction.supportsGovernment ? 'está entre os que apoia'
              : faction.resistsGovernment ? 'está entre os que combate'
              : 'não está em nenhuma das listas'
          }
        ],
        footnote: 'Clique para abrir esta facção'
      }
    )))
  ]);
}

// ============================ FACTIONS ============================

export function buildFactions(m: PoliticsMetrics, host: PoliticsScreenHost, focused: string | null): Child[] {
  if (!m.factions.length) {
    return [emptyState({
      icon: 'politics',
      title: 'Sem facções registradas',
      hint: 'A sociedade deste reino ainda não se organizou em grupos com interesses próprios.'
    })];
  }

  return [
    panel({
      title: 'Facções',
      icon: 'politics',
      subtitle: `${m.factions.length} · ordenadas por influência`,
      padded: false
    }, [
      table<FactionView>({
        columns: [
          {
            key: 'name', header: 'Facção',
            cell: f => el('span', { class: 'ae-pol-faction-cell' }, [
              el('strong', { text: factionName(f) }),
              f.supportsGovernment
                ? badge('apoia o governo', { size: 'sm', status: 'positive', variant: 'outline' })
                : f.resistsGovernment
                  ? badge('resiste ao governo', { size: 'sm', status: 'warning', variant: 'outline' })
                  : null
            ]),
            sortValue: f => factionName(f)
          },
          barColumn('influence', 'Influência', f => f.state.influence, TERMS.influence, 'neutral'),
          barColumn('satisfaction', 'Satisfação', f => f.state.satisfaction, TERMS.satisfaction, 'higher'),
          barColumn('loyalty', 'Lealdade', f => f.state.loyalty, TERMS.loyalty, 'higher'),
          barColumn('radicalization', 'Radicalização', f => f.state.radicalization, TERMS.radicalization, 'lower'),
          barColumn('warSupport', 'Guerra', f => f.state.warSupport, TERMS.warSupport, 'neutral'),
          barColumn('reformSupport', 'Reforma', f => f.state.reformSupport, TERMS.reformPressure, 'neutral'),
          {
            key: 'stance', header: 'Regime', align: 'right', width: '92px',
            cell: f => el('span', {
              class: `ae-pol-marks ae-pol-marks-${stanceStatus(f.regimeStance)}`,
              text: stanceMarks(f.regimeStance)
            }),
            sortValue: f => f.regimeStance,
            tooltip: { title: 'Posição diante do regime', description: TERMS.regimeStance }
          }
        ],
        rows: m.factions,
        rowKey: f => f.id,
        sortBy: 'influence',
        onRowClick: f => host.focusFaction(f.id),
        status: f => (f.state.radicalization >= 0.6 ? 'critical' : f.state.satisfaction < 0.4 ? 'warning' : undefined),
        rowTooltip: f => ({
          title: factionName(f),
          description: factionDescription(f),
          rows: [
            { label: 'Influência', value: pct(f.state.influence) },
            { label: 'Satisfação', value: pct(f.state.satisfaction) },
            { label: 'Radicalização', value: pct(f.state.radicalization) },
            { label: 'Posição', value: stanceLabel(f.regimeStance) }
          ],
          footnote: 'Clique para ver os motivos'
        })
      })
    ]),

    ...m.factions
      .filter(f => !focused || f.id === focused)
      .map(faction => buildFactionDetail(faction, m, host, Boolean(focused)))
  ];
}

function barColumn(
  key: string,
  header: string,
  pick: (f: FactionView) => number,
  explain: string,
  sense: 'higher' | 'lower' | 'neutral'
): Column<FactionView> {
  return {
    key, header, align: 'right', width: '108px',
    cell: f => {
      const value = pick(f);
      const status: Status = sense === 'neutral' ? 'neutral' : sense === 'higher' ? band(value) : inverted(value);
      return el('span', { class: 'ae-pol-cell-bar' }, [
        el('span', { class: 'ae-pol-cell-track' }, [
          el('span', {
            class: `ae-pol-cell-fill ae-pol-fill-${status}`,
            style: { width: `${Math.round(Math.min(1, value) * 100)}%` }
          })
        ]),
        el('span', { class: 'ae-pol-cell-value', text: pct(value) })
      ]);
    },
    sortValue: pick,
    tooltip: { title: header, description: explain }
  };
}

/**
 * One faction opened up: what it wants, what it is getting, and the exact deltas
 * the simulation applied for each.
 */
function buildFactionDetail(
  faction: FactionView,
  m: PoliticsMetrics,
  host: PoliticsScreenHost,
  isFocused: boolean
): HTMLElement {
  return panel({
    title: factionName(faction),
    icon: 'politics',
    subtitle: factionDescription(faction),
    class: isFocused ? 'ae-pol-faction-focus' : undefined,
    actions: isFocused
      ? [button('Ver todas', () => host.focusFaction(null), { variant: 'ghost', size: 'sm', icon: 'close' })]
      : undefined
  }, [
    badgeRow([
      badge(stanceLabel(faction.regimeStance), { size: 'sm', status: stanceStatus(faction.regimeStance) }),
      faction.state.radicalization >= 0.6 ? badge('Radicalizada', { size: 'sm', status: 'critical', icon: 'warning' }) : null,
      faction.supportsGovernment ? badge(`Apoia ${m.government.name}`, { size: 'sm', status: 'positive', variant: 'outline' }) : null,
      faction.resistsGovernment ? badge(`Combate ${m.government.name}`, { size: 'sm', status: 'warning', variant: 'outline' }) : null
    ]),

    el('div', { class: 'ae-pol-two-up' }, [
      // The grievances and the supports, from the tick's own accounting.
      faction.grievances && faction.grievances.length
        ? section('Pressões contra', [
            rowList(faction.grievances.slice(0, 6).map(f => factorRow(f, 'critical', host)))
          ], { icon: 'warning' })
        : null,
      faction.supports && faction.supports.length
        ? section('Pressões a favor', [
            rowList(faction.supports.slice(0, 6).map(f => factorRow(f, 'positive', host)))
          ], { icon: 'shield' })
        : null
    ]),

    !faction.grievances?.length && !faction.supports?.length
      ? el('p', { class: 'ae-pol-note', text: 'Sem fatores registrados — a simulação recalcula esta explicação a cada ciclo social.' })
      : null,

    // What the laws in force do to this faction. Read from the definitions'
    // `favours` and `angers` lists, which is where the tick reads them too.
    faction.favouredBy.length || faction.angeredBy.length
      ? el('div', {}, [
          divider(),
          section('Leis em vigor que a afetam', [
            el('div', { class: 'ae-pol-law-chips' }, [
              ...faction.favouredBy.map(law => lawChip(law, 'positive', 'Esta lei favorece a facção.', host)),
              ...faction.angeredBy.map(law => lawChip(law, 'critical', 'Esta lei contraria a facção.', host))
            ])
          ], { icon: 'law' })
        ])
      : null
  ]);
}

function factorRow(
  factor: { label: string; delta: number; source?: { kind: string; good?: import('../../civ/Goods').GoodId } },
  tone: Status,
  host: PoliticsScreenHost
): HTMLElement {
  const good = factor.source?.kind === 'good' ? factor.source.good : undefined;
  return statRow({
    label: factor.label,
    value: signedPoints(factor.delta),
    icon: good ? 'crate' : factor.source?.kind === 'jobs' ? 'industry' : factor.source?.kind === 'trade' ? 'trade-route' : 'politics',
    status: tone,
    onClick: good ? () => host.openGood(good) : undefined,
    tooltip: {
      title: factor.label,
      value: `${signedPoints(factor.delta)} pontos de satisfação`,
      description: 'Delta exato que a simulação aplicou a esta facção no último ciclo social.',
      footnote: good
        ? `Origem: ${GOODS[good]?.name ?? good} — clique para abrir na Economia`
        : factor.source?.kind === 'jobs' ? 'Origem: o mercado de trabalho'
        : factor.source?.kind === 'trade' ? 'Origem: o comércio externo'
        : undefined
    }
  });
}

function lawChip(law: LawDefinition, tone: Status, explain: string, host: PoliticsScreenHost): HTMLElement {
  return withTooltip(
    el('button', {
      class: `ae-pol-law-chip ae-pol-law-${tone}`,
      attrs: { type: 'button' },
      on: { click: () => host.openTab('laws') }
    }, [el('span', { text: law.name })]),
    { title: law.name, description: `${law.description} ${explain}`, footnote: 'Clique para abrir as leis' }
  );
}

// ============================ LAWS ============================

export function buildLaws(m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  const entries = lawsByCategory(m.laws);

  return [
    panel({ title: 'Ordem legal', icon: 'law' }, [
      statGrid([
        stat({ label: 'Leis em vigor', value: `${m.laws.length}`, icon: 'law' }),
        stat({
          label: 'Impulso reformista', value: pct(m.lawProfile.reformMomentum), icon: 'scroll',
          status: inverted(m.lawProfile.reformMomentum),
          tooltip: {
            title: 'Impulso reformista',
            value: pct(m.lawProfile.reformMomentum),
            description: 'Quanto a máquina legislativa está inclinada a mudar. Acumula com a pressão das facções e é gasto a cada reforma.'
          }
        }),
        stat({
          label: 'Última reforma',
          value: m.lawProfile.lastReformYear > 0 ? `ano ${m.lawProfile.lastReformYear}` : 'nenhuma',
          icon: 'calendar'
        }),
        stat({ label: 'Reformas registradas', value: `${m.lawProfile.history.length}`, icon: 'history' })
      ])
    ]),

    entries.length
      ? panel({
          title: 'Leis por categoria',
          icon: 'law',
          subtitle: 'Efeitos lidos da própria definição de cada lei'
        }, entries.map(({ category, law }) => buildLawRow(category, law, m, host)))
      : emptyState({ icon: 'law', title: 'Nenhuma lei em vigor', hint: 'Este reino ainda não codificou nada.' }),

    buildReformHistory(m, host)
  ];
}

/** One law with its effects split into the three readings the brief asks for. */
function buildLawRow(category: LawCategory, law: LawDefinition, m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement {
  const rows = effectRows(law.effects);
  const group = (title: string, keys: Set<string>) => {
    const subset = rows.filter(r => keys.has(r.key));
    if (!subset.length) return null;
    return el('div', { class: 'ae-pol-effect-group' }, [
      el('span', { class: 'ae-pol-effect-title', text: title }),
      el('div', { class: 'ae-pol-effect-chips' }, subset.map(r => withTooltip(
        badge(`${r.label} ${r.value}`, { size: 'sm', variant: 'outline', status: r.status }),
        { title: r.label, value: r.value, description: 'Modificador que esta lei aplica ao reino.' }
      )))
    ]);
  };

  return el('div', { class: 'ae-pol-law' }, [
    el('div', { class: 'ae-pol-law-head' }, [
      badge(LAW_CATEGORY_LABEL[category] ?? category, { size: 'sm', variant: 'outline' }),
      withTooltip(
        el('span', { class: 'ae-pol-law-name', text: law.name }),
        { title: law.name, description: law.description, rows: rows.map(r => ({ label: r.label, value: r.value, status: r.status })) }
      )
    ]),
    el('div', { class: 'ae-pol-effects' }, [
      group('Econômico', ECONOMIC_EFFECTS),
      group('Político', POLITICAL_EFFECTS),
      group('Social', SOCIAL_EFFECTS)
    ].filter(Boolean) as HTMLElement[]),
    el('div', { class: 'ae-pol-law-factions' }, [
      ...law.favours.slice(0, 4).map(id => withTooltip(
        badge(factionShort(id, id), { size: 'sm', status: 'positive', variant: 'outline' }),
        { title: factionShort(id, id), description: 'Esta facção é favorecida pela lei.', footnote: 'Clique na facção para ver seus motivos' }
      )),
      ...law.angers.slice(0, 4).map(id => withTooltip(
        badge(factionShort(id, id), { size: 'sm', status: 'critical', variant: 'outline' }),
        { title: factionShort(id, id), description: 'Esta facção é contrariada pela lei.' }
      ))
    ])
  ]);
}

function effectRows(effects: LawEffects): { key: string; label: string; value: string; status: Status }[] {
  const out: { key: string; label: string; value: string; status: Status }[] = [];
  for (const [key, raw] of Object.entries(effects)) {
    if (typeof raw !== 'number' || raw === 0) continue;
    const label = EFFECT_LABEL[key];
    if (!label) continue;
    // A rise in inequality is not good news just because the number is positive.
    const good = INVERTED_EFFECTS.has(key) ? raw < 0 : raw > 0;
    out.push({
      key,
      label,
      value: `${raw > 0 ? '+' : '−'}${Math.abs(raw) < 1 ? `${Math.abs(raw * 100).toFixed(0)}%` : Math.abs(raw).toFixed(2)}`,
      status: good ? 'positive' : 'warning'
    });
  }
  return out;
}

/**
 * Reform history, from the law profile's own record.
 *
 * `LawProfile.history` stores every change with the year and the pressure behind
 * it, so this is state rather than a chronicle text search.
 */
function buildReformHistory(m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement | null {
  if (!m.recentReforms.length) {
    return panel({ title: 'Histórico de reformas', icon: 'history' }, [
      emptyState({
        icon: 'history',
        title: 'Nenhuma reforma registrada',
        hint: 'A ordem legal deste reino nunca mudou desde a fundação.',
        compact: true
      })
    ]);
  }

  return panel({
    title: 'Histórico de reformas',
    icon: 'history',
    subtitle: `${m.lawProfile.history.length} registrada(s)`,
    actions: [button('Crônica', () => host.openChronicle(), { variant: 'ghost', size: 'sm', icon: 'history' })]
  }, [
    rowList(m.recentReforms.map(change => statRow({
      label: LAW_CATEGORY_LABEL[change.category] ?? change.category,
      value: `${change.from} → ${change.to}`,
      unit: `ano ${change.year}`,
      icon: 'scroll',
      tooltip: {
        title: `Reforma de ${LAW_CATEGORY_LABEL[change.category] ?? change.category}`,
        value: `ano ${change.year}`,
        description: 'Mudança registrada pelo próprio perfil legal do reino.',
        rows: [{ label: 'Pressão no momento', value: pct(change.pressure) }]
      }
    })))
  ]);
}

// ============================ RULER AND SUCCESSION ============================

export function buildRuler(m: PoliticsMetrics, host: PoliticsScreenHost): Child[] {
  const succession = m.succession;
  const ruler = succession.ruler;

  return [
    succession.risks.length
      ? panel({
          title: 'Riscos de sucessão',
          icon: 'alert',
          subtitle: `${succession.risks.length} identificado(s)`,
          class: 'ae-pol-critical'
        }, succession.risks.map(risk => el('div', { class: `ae-pol-pressure ae-pol-pressure-${risk.severity}` }, [
          el('div', { class: 'ae-pol-pressure-head' }, [
            icon('crown', { size: 16, class: 'ae-pol-pressure-icon' }),
            el('div', { class: 'ae-pol-pressure-text' }, [
              el('span', { class: 'ae-pol-pressure-label', text: risk.label }),
              el('span', { class: 'ae-pol-pressure-detail', text: risk.detail })
            ])
          ])
        ])))
      : null,

    ruler
      ? panel({
          title: ruler.title ?? ruler.name,
          icon: 'crown',
          subtitle: `${m.government.rulerTitle} de ${m.name}`,
          actions: [
            button('Abrir no inspetor', () => host.openCitizen(ruler.id), {
              variant: 'primary', size: 'sm', icon: 'citizen',
              tooltip: { title: 'Inspetor', description: 'Abre a ficha completa: necessidades, família, história e traços.' }
            })
          ]
        }, [
          statGrid([
            stat({ label: 'Nome', value: ruler.name, icon: 'citizen' }),
            stat({ label: 'Idade', value: `${ruler.age}`, unit: 'anos', icon: 'calendar' }),
            stat({ label: 'Casa', value: ruler.dynasty || succession.dynasty || '—', icon: 'dynasty' }),
            succession.rulerYears !== null
              ? stat({
                  label: 'Anos de governo', value: `${succession.rulerYears}`, icon: 'calendar',
                  tooltip: {
                    title: 'Anos de governo',
                    description: 'Contados desde o ano em que a forma de governo atual foi adotada — que numa monarquia é a ascensão do soberano.'
                  }
                })
              : null,
            stat({
              label: 'Legitimidade do regime', value: pct(m.legitimacy), icon: 'politics', status: band(m.legitimacy),
              tooltip: { title: 'Legitimidade', description: TERMS.legitimacy }
            }),
            ruler.isGreatPerson
              ? stat({
                  label: 'Grande figura', value: greatPersonLabel(ruler.greatPersonType), icon: 'crown', status: 'positive',
                  tooltip: { title: 'Grande figura', description: 'A simulação marcou este indivíduo como excepcional.' }
                })
              : null
          ].filter(Boolean) as HTMLElement[]),

          ruler.traits.size
            ? el('div', {}, [
                divider(),
                section('Traços', [
                  badgeRow([...ruler.traits].map(trait => badge(String(trait), { size: 'sm', variant: 'outline' })))
                ], { icon: 'citizen', hint: `${ruler.traits.size}` })
              ])
            : null
        ])
      : panel({ title: 'Governante', icon: 'crown' }, [
          emptyState({
            icon: 'crown',
            title: 'Trono vago',
            hint: 'Este reino não tem governante. A regra de sucessão decide quem assume no próximo ciclo.',
            compact: true
          })
        ]),

    panel({
      title: 'Sucessão',
      icon: 'crown',
      subtitle: successionExplain(succession.rule)
    }, [
      rowList([
        statRow({
          label: 'Regra', value: successionLabel(succession.rule), icon: 'scroll',
          tooltip: { title: 'Regra de sucessão', description: successionExplain(succession.rule) }
        }),
        statRow({
          label: 'Casa reinante', value: succession.dynasty || 'sem casa registrada', icon: 'dynasty',
          unit: succession.dynasty ? `${succession.dynastyMembers} vivo(s)` : undefined,
          onClick: succession.dynasty ? () => host.openDynasty() : undefined,
          tooltip: succession.dynasty
            ? { title: `Casa ${succession.dynasty}`, description: 'Abre a tela de dinastias, que cobre linhagens e grandes figuras.' }
            : undefined
        }),
        succession.heir
          ? el('div', { class: 'ae-row' }, [
              icon('heir', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label', text: 'Sucessor provável' }),
              el('span', { class: 'ae-row-value' }, [
                objectLink(
                  { kind: 'citizen', id: succession.heir.id, name: succession.heir.name },
                  { showIcon: false, onOpen: () => host.openCitizen(succession.heir!.id) }
                ),
                el('span', { class: 'ae-row-unit', text: `${succession.heir.age} anos` })
              ])
            ])
          : statRow({
              label: 'Sucessor provável', value: 'nenhum elegível', icon: 'heir', status: 'critical',
              tooltip: {
                title: 'Sem sucessor',
                description: 'Nenhum cidadão vivo satisfaz a regra de sucessão deste governo.'
              }
            })
      ]),
      el('p', {
        class: 'ae-pol-note',
        text: 'O sucessor acima é obtido rodando a própria função de sucessão da simulação sobre os cidadãos vivos deste reino, com a regra do governo atual. É quem assumiria se o trono vagasse agora — não uma previsão.'
      })
    ]),

    buildPoliticalChronicle(m, host)
  ];
}

function greatPersonLabel(type: string | null): string {
  return { scholar: 'Erudito', builder: 'Construtor', hero: 'Herói', diplomat: 'Diplomata' }[type ?? ''] ?? 'Sim';
}

// ============================ CHRONICLE ============================

/**
 * Political and diplomatic events on this realm's record.
 *
 * `getEventsForRef('kingdom', id)` is a reference lookup, filtered to the event
 * types that are actually political. No new events are created — this consumes
 * what the simulation already writes.
 */
const POLITICAL_EVENT_TYPES = new Set([
  'kingdom', 'king', 'succession', 'law', 'revolution', 'society',
  'rebellion', 'diplomacy', 'war', 'peace', 'conquest'
]);

export function buildPoliticalChronicle(m: PoliticsMetrics, host: PoliticsScreenHost): HTMLElement | null {
  const events = chronicle
    .getEventsForRef('kingdom', m.kingdomId)
    .filter(e => POLITICAL_EVENT_TYPES.has(e.type) && e.importance !== 'minor')
    .sort((a, b) => b.year - a.year)
    .slice(0, 12);

  if (!events.length) return null;

  return panel({
    title: 'Registro político',
    icon: 'history',
    subtitle: `${events.length} evento(s) recentes`,
    actions: [button('Crônica completa', () => host.openChronicle(), { variant: 'ghost', size: 'sm', icon: 'history' })]
  }, [
    el('div', { class: 'ae-pol-timeline' }, events.map(event => withTooltip(
      el('div', { class: `ae-pol-event ae-pol-event-${event.importance}` }, [
        el('span', { class: 'ae-pol-event-year', text: `${event.year}` }),
        el('div', { class: 'ae-pol-event-body' }, [
          el('span', { class: 'ae-pol-event-title', text: event.title ?? event.text }),
          event.title ? el('span', { class: 'ae-pol-event-text', text: event.text }) : null
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
    )))
  ]);
}

// ============================ SHARED ============================

export function miniButton(iconName: string, title: string, description: string, onClick: () => void): HTMLElement {
  return withTooltip(
    el('button', {
      class: 'ae-pol-mini-btn',
      attrs: { type: 'button', 'aria-label': title },
      on: { click: onClick }
    }, [icon(iconName, { size: 16 })]),
    { title, description }
  );
}

/** A neutral-sentiment trend, for figures where a rise is not good or bad in itself. */
export function neutralTrend(delta: number, text: string): HTMLElement {
  return trendIndicator({ delta, sentiment: 'neutral', compact: true, text });
}

export { formatPercent, progressBar };
