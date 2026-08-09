/** Renderers for Technology Command Center tabs. All receive a cached snapshot. */
import { el, type Child } from '../core/Dom';
import {
  badge, badgeRow, button, divider, emptyState, formatCompact, formatPercent,
  objectLink, panel, progressBar, rowList, section, stat, statGrid, statRow, table,
  withTooltip, type Status
} from '../kit';
import { BUILDINGS, type BuildingType } from '../../civ/Building';
import { GOODS, type GoodId } from '../../civ/Goods';
import { TECH_ERAS, TECHNOLOGIES, type TechTrack } from '../../civ/TechTree';
import { buildProductionChainPreview } from '../economy/EconomyTabs';
import type { EconomyMetrics } from '../economy/EconomyMetrics';
import type { GameContext } from '../core/GameContext';
import {
  CAPABILITY_LABEL, capabilityStatus, technologicalBottlenecks,
  technologicalConditions, technologyImpacts, whyItMatters,
  type TechnologyCondition, type TechnologyImpact
} from './TechnologyDiagnostics';
import {
  technologiesByEraAndTrack, technologyUIPerformance,
  type CapabilityView, type TechnologyStatus, type TechnologyUISnapshot,
  type TechnologyView
} from './TechnologyMetrics';

export interface TechnologyScreenHost {
  readonly ctx: GameContext;
  inspectTechnology(techId: string, tab?: 'tree' | 'capabilities' | 'impact'): void;
  openGood(good: GoodId): void;
  openCity(cityId: string): void;
  openRealm(kingdomId: string): void;
  openInfrastructure(cityId?: string): void;
  openChronicle(): void;
  economyMetrics(): EconomyMetrics;
}

export type TechStatusFilter = 'all' | TechnologyStatus;
export type TechTrackFilter = 'all' | TechTrack;

const STATUS_LABEL: Record<TechnologyStatus, string> = {
  discovered: 'DESCOBERTO', researching: 'PESQUISANDO', available: 'DISPONÍVEL', locked: 'BLOQUEADO'
};

const STATUS_TONE: Record<TechnologyStatus, Status> = {
  discovered: 'positive', researching: 'neutral', available: 'neutral', locked: 'neutral'
};

function techLink(view: TechnologyView, host: TechnologyScreenHost): HTMLElement {
  return objectLink(
    {
      kind: 'technology', id: view.definition.id, name: view.definition.name,
      qualifier: TECH_ERAS[view.definition.era].name,
      status: STATUS_TONE[view.status]
    },
    { showIcon: false, onOpen: () => host.inspectTechnology(view.definition.id) }
  );
}

function goodLink(good: GoodId, host: TechnologyScreenHost, status?: Status): HTMLElement {
  return objectLink(
    { kind: 'good', id: good, name: GOODS[good]?.name ?? good, status },
    { showIcon: false, onOpen: () => host.openGood(good) }
  );
}

function conditionCard(condition: TechnologyCondition, host: TechnologyScreenHost): HTMLElement {
  const act = () => {
    if (condition.good) host.openGood(condition.good);
    else if (condition.destination === 'infrastructure') host.openInfrastructure();
    else if (condition.techId) host.inspectTechnology(condition.techId, 'capabilities');
  };
  const actionable = Boolean(condition.good || condition.destination === 'infrastructure' || condition.techId);
  return el(actionable ? 'button' : 'div', {
    class: `ae-tech-condition ae-tech-condition-${condition.status}`,
    attrs: actionable ? { type: 'button' } : {},
    on: actionable ? { click: act } : undefined
  }, [
    el('div', { class: 'ae-tech-condition-head' }, [
      el('span', { class: 'ae-tech-condition-kind', text: condition.kind.toUpperCase() }),
      badge(condition.status === 'critical' ? 'CRÍTICO' : condition.status === 'warning' ? 'ALERTA' : 'OPORTUNIDADE', {
        status: condition.status, size: 'sm', variant: 'outline'
      })
    ]),
    el('strong', { class: 'ae-tech-condition-title', text: condition.title }),
    el('span', { class: 'ae-tech-condition-summary', text: condition.summary }),
    el('span', { class: 'ae-tech-condition-evidence', text: condition.evidence }),
    actionable ? el('span', { class: 'ae-tech-condition-action', text: 'Abrir diagnóstico ›' }) : null
  ]);
}

export function buildOverview(snapshot: TechnologyUISnapshot, host: TechnologyScreenHost): Child[] {
  const conditions = technologicalConditions(snapshot);
  const current = snapshot.current;
  return [
    panel({ title: 'Estado tecnológico', icon: 'technology', accent: snapshot.kingdomColor }, [
      statGrid([
        stat({
          label: 'Era conhecida', value: snapshot.knownEraName, icon: 'era',
          tooltip: { title: 'Era conhecida', description: 'Maior era entre as tecnologias que o reino conhece.' }
        }),
        stat({
          label: 'Era operacional', value: snapshot.operatingEraName, icon: 'industry',
          status: snapshot.operatingEra === snapshot.knownEra ? 'positive' : 'warning',
          tooltip: { title: 'Era operacional', description: 'Maior era que a base material existente consegue colocar em prática.' }
        }),
        stat({ label: 'Descobertas', value: `${snapshot.knownCount} / ${snapshot.totalCount}`, icon: 'book' }),
        stat({
          label: 'Pesquisa anual', value: snapshot.researchOutput.toFixed(1), icon: 'flask',
          tooltip: { title: 'Taxa de pesquisa', description: 'Soma da produção de pesquisa registrada nas cidades do reino no último ciclo.' }
        })
      ]),
      divider(),
      current
        ? el('div', { class: 'ae-tech-current' }, [
            el('div', { class: 'ae-tech-current-copy' }, [
              el('span', { class: 'ae-tech-kicker', text: 'PESQUISA ATUAL' }),
              techLink(current, host),
              el('span', { class: 'ae-tech-note', text: current.definition.description })
            ]),
            progressBar({
              label: 'Progresso', value: current.progressFraction,
              valueText: `${current.progress.toFixed(0)} / ${current.cost.toFixed(0)}`,
              color: snapshot.kingdomColor,
              tooltip: {
                title: 'Progresso de pesquisa',
                description: 'Pontos acumulados contra o custo efetivo, incluindo escala de era e expansão do reino.',
                rows: snapshot.researchOutput > 0
                  ? [{ label: 'Ao ritmo atual', value: `${Math.ceil(Math.max(0, current.cost - current.progress) / snapshot.researchOutput)} ano(s)` }]
                  : undefined,
                footnote: 'A projeção muda se prosperidade, edifícios, governo, leis ou modificadores mudarem.'
              }
            })
          ])
        : emptyState({
            icon: 'flask', title: 'Nenhuma pesquisa em andamento',
            hint: snapshot.available.length
              ? 'Há tecnologias disponíveis; a seleção é controlada pela IA da simulação.'
              : 'Nenhuma tecnologia atende aos pré-requisitos neste momento.',
            compact: true
          })
    ]),

    panel({
      title: 'Condições tecnológicas', icon: 'alert',
      subtitle: conditions.length ? 'Problemas e oportunidades sustentados pelo estado material atual' : 'Nenhum gargalo material relevante foi detectado'
    }, conditions.length
      ? [el('div', { class: 'ae-tech-condition-grid' }, conditions.map(condition => conditionCard(condition, host)))]
      : [emptyState({ icon: 'technology', title: 'Conhecimento e capacidade estão alinhados', hint: 'Nenhuma condição derivada exige atenção.', compact: true })]
    ),

    el('div', { class: 'ae-tech-two-up' }, [
      panel({
        title: 'Descobertas recentes', icon: 'history',
        actions: [button('História', () => host.openChronicle(), { variant: 'ghost', size: 'sm', icon: 'history' })]
      }, snapshot.recentDiscoveries.length
        ? [rowList(snapshot.recentDiscoveries.map(entry => el('div', { class: 'ae-row' }, [
            el('span', { class: 'ae-row-label' }, [
              entry.techId && TECHNOLOGIES[entry.techId]
                ? techLink(snapshot.technologies.find(view => view.definition.id === entry.techId)!, host)
                : el('span', { text: entry.event.title ?? entry.event.text })
            ]),
            el('span', { class: 'ae-row-value', text: `Ano ${entry.event.year}` })
          ])))]
        : [emptyState({
            icon: 'history', title: 'Sem descobertas datadas',
            hint: 'O Chronicle não possui eventos tecnológicos com data para este reino.', compact: true
          })]),

      panel({ title: 'Pesquisa disponível', icon: 'book', subtitle: `${snapshot.available.length} opção(ões) com pré-requisitos completos` },
        snapshot.available.length
          ? [rowList(snapshot.available.slice(0, 6).map(view => statRow({
              label: view.definition.name,
              value: formatCompact(view.cost),
              unit: 'pts',
              icon: 'technology',
              onClick: () => host.inspectTechnology(view.definition.id),
              tooltip: { title: view.definition.name, description: view.definition.description, footnote: 'A IA decide a próxima pesquisa.' }
            })))]
          : [emptyState({ icon: 'book', title: 'Nenhuma tecnologia disponível', hint: 'Os pré-requisitos restantes ainda não foram descobertos.', compact: true })]
      )
    ])
  ];
}

function collectAncestors(techId: string, out: Set<string> = new Set()): Set<string> {
  for (const required of TECHNOLOGIES[techId]?.requires ?? []) {
    if (out.has(required)) continue;
    out.add(required);
    collectAncestors(required, out);
  }
  return out;
}

function drawTreeConnections(root: HTMLElement, selectedId: string | null): void {
  requestAnimationFrame(() => {
    const started = performance.now();
    if (!root.isConnected) return;
    const canvas = root.querySelector<HTMLElement>('.ae-tech-tree-canvas');
    const svg = root.querySelector<SVGSVGElement>('.ae-tech-tree-lines');
    if (!canvas || !svg) return;
    const rect = canvas.getBoundingClientRect();
    const width = canvas.scrollWidth;
    const height = canvas.scrollHeight;
    svg.setAttribute('width', `${width}`);
    svg.setAttribute('height', `${height}`);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();
    const ancestors = selectedId ? collectAncestors(selectedId) : new Set<string>();

    for (const view of Object.values(TECHNOLOGIES)) {
      const to = canvas.querySelector<HTMLElement>(`[data-tech-id="${view.id}"]`);
      if (!to) continue;
      for (const required of view.requires) {
        const from = canvas.querySelector<HTMLElement>(`[data-tech-id="${required}"]`);
        if (!from) continue;
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const x1 = a.right - rect.left;
        const y1 = a.top + a.height / 2 - rect.top;
        const x2 = b.left - rect.left;
        const y2 = b.top + b.height / 2 - rect.top;
        let d: string;
        if (x2 <= x1 + 8) {
          const bend = Math.max(x1, x2) + 24;
          d = `M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}`;
        } else {
          const middle = (x1 + x2) / 2;
          d = `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`;
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', [
          'ae-tech-tree-line',
          selectedId && view.id === selectedId && ancestors.has(required) ? 'is-path' : '',
          selectedId && required === selectedId ? 'is-downstream' : ''
        ].filter(Boolean).join(' '));
        svg.appendChild(path);
      }
    }
    technologyUIPerformance.treeLayoutMs = performance.now() - started;
  });
}

function treeNode(
  view: TechnologyView,
  host: TechnologyScreenHost,
  selectedId: string | null,
  query: string,
  statusFilter: TechStatusFilter,
  trackFilter: TechTrackFilter
): HTMLElement {
  const matchesQuery = !query || view.searchText.includes(query.toLocaleLowerCase('pt-BR'));
  const matchesStatus = statusFilter === 'all' || view.status === statusFilter;
  const matchesTrack = trackFilter === 'all' || view.definition.track === trackFilter;
  return withTooltip(el('button', {
    class: [
      'ae-tech-node', `ae-tech-node-${view.status}`,
      selectedId === view.definition.id ? 'is-selected' : '',
      !matchesQuery || !matchesStatus || !matchesTrack ? 'is-filtered' : ''
    ].filter(Boolean).join(' '),
    dataset: { techId: view.definition.id },
    attrs: { type: 'button', 'aria-pressed': selectedId === view.definition.id },
    on: { click: () => host.inspectTechnology(view.definition.id, 'tree') }
  }, [
    el('span', { class: 'ae-tech-node-icon', text: view.definition.icon }),
    el('span', { class: 'ae-tech-node-copy' }, [
      el('strong', { class: 'ae-tech-node-name', text: view.definition.name }),
      el('span', { class: 'ae-tech-node-status', text: STATUS_LABEL[view.status] })
    ]),
    view.status === 'researching'
      ? el('span', { class: 'ae-tech-node-progress', style: { width: `${view.progressFraction * 100}%` } })
      : null
  ]), {
    title: view.definition.name,
    value: STATUS_LABEL[view.status],
    description: view.definition.description,
    rows: view.prerequisites.length
      ? [{ label: 'Pré-requisitos', value: view.prerequisites.map(item => item.name).join(', ') }]
      : undefined,
    footnote: 'Clique para inspecionar'
  });
}

function enableTreePan(viewport: HTMLElement): void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let left = 0;
  let top = 0;
  viewport.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('button')) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    left = viewport.scrollLeft;
    top = viewport.scrollTop;
    viewport.classList.add('is-panning');
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', event => {
    if (!dragging) return;
    viewport.scrollLeft = left - (event.clientX - startX);
    viewport.scrollTop = top - (event.clientY - startY);
  });
  const stop = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-panning');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener('pointerup', stop);
  viewport.addEventListener('pointercancel', stop);
}

export function buildTree(
  snapshot: TechnologyUISnapshot,
  host: TechnologyScreenHost,
  selectedId: string | null,
  query: string,
  statusFilter: TechStatusFilter,
  trackFilter: TechTrackFilter
): Child[] {
  const eras = Object.values(TECH_ERAS).sort((a, b) => a.order - b.order);
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('class', 'ae-tech-tree-lines');
  lines.setAttribute('aria-hidden', 'true');
  const canvas = el('div', { class: 'ae-tech-tree-canvas' }, [
    lines,
    el('div', { class: 'ae-tech-tree-columns' }, eras.map(era => {
      const craft = snapshot.technologies.filter(view => view.definition.era === era.id && view.definition.track === 'craft');
      const politics = snapshot.technologies.filter(view => view.definition.era === era.id && view.definition.track === 'politics');
      return el('section', { class: 'ae-tech-era-column', style: { '--ae-era-color': era.color } }, [
        el('header', { class: 'ae-tech-era-head' }, [
          el('span', { class: 'ae-tech-era-icon', text: era.icon }),
          el('div', {}, [
            el('strong', { class: 'ae-tech-era-name', text: era.name }),
            el('span', { class: 'ae-tech-era-count', text: `${craft.length + politics.length} tecnologias` })
          ])
        ]),
        el('div', { class: 'ae-tech-era-track' }, [
          el('span', { class: 'ae-tech-era-track-label', text: 'OFICIO E CIÊNCIA' }),
          ...craft.map(view => treeNode(view, host, selectedId, query, statusFilter, trackFilter))
        ]),
        el('div', { class: 'ae-tech-era-track ae-tech-era-politics' }, [
          el('span', { class: 'ae-tech-era-track-label', text: 'POLÍTICA E SOCIEDADE' }),
          ...politics.map(view => treeNode(view, host, selectedId, query, statusFilter, trackFilter))
        ])
      ]);
    }))
  ]);
  const viewport = el('div', { class: 'ae-tech-tree-viewport' }, [canvas]);
  enableTreePan(viewport);
  const root = panel({
    title: 'Árvore de conhecimento', icon: 'technology', padded: false,
    subtitle: 'Eras em colunas · arraste o espaço vazio para navegar · linhas destacadas mostram o caminho selecionado'
  }, [viewport]);
  drawTreeConnections(root, selectedId);
  const selected = selectedId ? snapshot.technologies.find(view => view.definition.id === selectedId) ?? null : null;
  return [el('div', { class: 'ae-tech-tree-layout' }, [
    root,
    selected
      ? buildInspector(selected, snapshot, host)
      : panel({ title: 'Inspetor de Tecnologia', icon: 'search', class: 'ae-tech-inspector' }, [
          emptyState({ icon: 'technology', title: 'Selecione uma tecnologia', hint: 'O inspector mostrará requisitos, efeitos, unlocks e capacidade material.', compact: true })
        ])
  ])];
}

function unlockSection(view: TechnologyView, snapshot: TechnologyUISnapshot, host: TechnologyScreenHost): HTMLElement | null {
  if (!view.unlocks.length) return null;
  const capability = snapshot.capabilities.find(item => item.techId === view.definition.id);
  const order = ['buildings', 'goods', 'infrastructure', 'military', 'systems', 'other'] as const;
  return section('Desbloqueios', order.map(kind => {
    const entries = view.unlocks.filter(unlock => unlock.kind === kind);
    if (!entries.length) return null;
    return el('div', { class: 'ae-tech-unlock-group' }, [
      el('span', { class: 'ae-tech-unlock-label', text: kind.toUpperCase() }),
      badgeRow(entries.map(unlock => {
        if (unlock.kind === 'goods') return goodLink(unlock.id as GoodId, host);
        if (unlock.kind === 'buildings') {
          const deployment = capability?.buildings.find(item => item.type === unlock.id);
          const instance = deployment?.instances[0];
          return instance
            ? objectLink({
                kind: 'building', id: instance.id, name: unlock.name,
                qualifier: `${deployment!.count} em ${deployment!.cities.length} cidade(s)`
              }, { variant: 'chip' })
            : badge(unlock.name, { size: 'sm', variant: 'outline' });
        }
        return badge(unlock.name, {
          size: 'sm', variant: 'outline',
          tooltip: unlock.description ? { title: unlock.name, description: unlock.description } : undefined
        });
      }))
    ]);
  }).filter(Boolean) as Child[]);
}

function effectRows(view: TechnologyView): HTMLElement | null {
  const modifiers = view.definition.unlocks.modifiers;
  if (!modifiers) return null;
  const rows: HTMLElement[] = [];
  const add = (label: string, value: number | undefined, additive = false) => {
    if (value === undefined || (!additive && value === 1) || (additive && value === 0)) return;
    rows.push(statRow({ label, value: additive ? `+${value}` : `×${value}`, icon: 'trend', status: 'positive' }));
  };
  add('Produção', modifiers.production);
  add('Pesquisa', modifiers.research);
  add('Crescimento', modifiers.growth);
  add('Comércio', modifiers.trade);
  add('Militar', modifiers.military);
  add('Território', modifiers.territory, true);
  return rows.length ? section('Efeitos', [rowList(rows)]) : null;
}

function buildInspector(view: TechnologyView, snapshot: TechnologyUISnapshot, host: TechnologyScreenHost): HTMLElement {
  const era = TECH_ERAS[view.definition.era];
  const capability = snapshot.capabilities.find(item => item.techId === view.definition.id) ?? null;
  const missing = view.prerequisites.filter(item => !item.known);
  const reasons = whyItMatters(view);
  const unlockedGood = view.definition.unlocks.goods?.find(good => GOODS[good]?.recipe || GOODS[good]?.recipes);
  let chain: HTMLElement | null = null;
  if (unlockedGood) {
    chain = buildProductionChainPreview(unlockedGood, host.economyMetrics(), { inspectGood: good => host.openGood(good) });
  }
  return panel({ title: 'Inspetor de Tecnologia', icon: 'search', class: 'ae-tech-inspector', scroll: true }, [
    el('div', { class: 'ae-tech-inspector-title' }, [
      el('span', { class: 'ae-tech-inspector-icon', text: view.definition.icon }),
      el('div', {}, [
        el('h3', { text: view.definition.name }),
        badgeRow([
          badge(STATUS_LABEL[view.status], { status: STATUS_TONE[view.status], size: 'sm' }),
          badge(era.name, { color: era.color, size: 'sm', variant: 'outline' })
        ])
      ])
    ]),
    el('p', { class: 'ae-tech-description', text: view.definition.description }),
    divider(),
    view.prerequisites.length
      ? section('Requer', [badgeRow(view.prerequisites.map(required => objectLink(
          {
            kind: 'technology', id: required.id, name: required.name,
            status: required.known ? 'positive' : 'critical'
          },
          { variant: 'chip', onOpen: () => host.inspectTechnology(required.id) }
        )))], { hint: missing.length ? `${missing.length} pendente(s)` : 'Completo' })
      : section('Requer', [el('span', { class: 'ae-tech-note', text: 'Nenhum pré-requisito tecnológico.' })]),
    view.excludedBy.length
      ? section('Indisponível porque', [badgeRow(view.excludedBy.map(excluded => objectLink(
          { kind: 'technology', id: excluded.id, name: excluded.name, status: 'critical' },
          { variant: 'chip', onOpen: () => host.inspectTechnology(excluded.id) }
        )))])
      : null,
    section('Pesquisa', [rowList([
      statRow({ label: 'Custo efetivo', value: formatCompact(view.cost), unit: 'pts', icon: 'flask' }),
      ...(view.status === 'researching' ? [statRow({ label: 'Progresso', value: view.progress.toFixed(0), unit: `/ ${view.cost.toFixed(0)}`, icon: 'trend' })] : [])
    ])]),
    unlockSection(view, snapshot, host),
    effectRows(view),
    capability
      ? section('Capacidade', [
          el('div', { class: 'ae-tech-capability-verdict' }, [
            badge(CAPABILITY_LABEL[capability.state], { status: capabilityStatus(capability.state), variant: 'solid' }),
            el('span', { text: capability.evidence[0] })
          ]),
          button('Abrir diagnóstico completo', () => host.inspectTechnology(view.definition.id, 'capabilities'), { variant: 'ghost', size: 'sm', icon: 'industry' })
        ])
      : null,
    reasons.length ? section('Por que importa', reasons.map(reason => el('p', { class: 'ae-tech-reason', text: reason }))) : null,
    chain
  ]);
}

export function buildResearch(snapshot: TechnologyUISnapshot, host: TechnologyScreenHost, query: string): Child[] {
  const current = snapshot.current;
  const filtered = snapshot.available.filter(view => !query || view.searchText.includes(query.toLocaleLowerCase('pt-BR')));
  return [
    current
      ? panel({ title: 'Pesquisa atual', icon: 'flask', accent: snapshot.kingdomColor }, [
          el('div', { class: 'ae-tech-research-head' }, [
            el('div', {}, [techLink(current, host), el('p', { class: 'ae-tech-note', text: current.definition.description })]),
            badge(TECH_ERAS[current.definition.era].name, { color: TECH_ERAS[current.definition.era].color, variant: 'outline' })
          ]),
          progressBar({
            label: 'Progresso', value: current.progressFraction,
            valueText: `${current.progress.toFixed(0)} / ${current.cost.toFixed(0)}`,
            color: snapshot.kingdomColor
          }),
          rowList([
            statRow({ label: 'Custo efetivo', value: formatCompact(current.cost), unit: 'pts', icon: 'flask' }),
            statRow({ label: 'Taxa atual', value: snapshot.researchOutput.toFixed(1), unit: 'pts/ano', icon: 'trend' }),
            statRow({
              label: 'Conclusão ao ritmo atual',
              value: snapshot.researchOutput > 0 ? Math.ceil(Math.max(0, current.cost - current.progress) / snapshot.researchOutput) : '—',
              unit: snapshot.researchOutput > 0 ? 'ano(s)' : undefined,
              icon: 'year',
              tooltip: {
                title: 'Estimativa condicional',
                description: 'Restante dividido pela taxa registrada agora.',
                footnote: 'Prosperidade, prédios, governo, leis e modificadores podem alterar a taxa.'
              }
            })
          ])
        ])
      : panel({ title: 'Pesquisa atual', icon: 'flask' }, [
          emptyState({ icon: 'flask', title: 'Nenhuma pesquisa em andamento', hint: 'A IA escolherá uma opção quando houver produção e tecnologia disponível.' })
        ]),

    panel({
      title: 'Fontes de pesquisa', icon: 'education',
      subtitle: 'Contribuições reconstruídas das saídas registradas em cada cidade'
    }, snapshot.researchSources.length
      ? [rowList([
          ...snapshot.researchSources.map(source => statRow({
            label: source.label, value: source.amount.toFixed(1), unit: '/ ano',
            icon: source.kind === 'population' ? 'citizen' : 'building'
          })),
          statRow({ label: 'Total registrado', value: snapshot.researchOutput.toFixed(1), unit: '/ ano', icon: 'flask', status: 'neutral' })
        ])]
      : [emptyState({ icon: 'education', title: 'Nenhuma fonte de pesquisa', hint: 'Não há produção de pesquisa registrada nas cidades do reino.', compact: true })]
    ),

    panel({
      title: 'Pesquisa disponível', icon: 'book', padded: false,
      subtitle: 'Informativo: a escolha é feita pela IA, não pelo jogador'
    }, [table<TechnologyView>({
      rows: filtered,
      rowKey: view => view.definition.id,
      onRowClick: view => host.inspectTechnology(view.definition.id),
      sortBy: 'cost', sortDir: 'asc',
      columns: [
        { key: 'name', header: 'Tecnologia', width: 'minmax(210px, 1.4fr)', cell: view => techLink(view, host), sortValue: view => view.definition.name },
        { key: 'track', header: 'Trilha', width: '120px', cell: view => view.definition.track === 'craft' ? 'Craft' : 'Politics', sortValue: view => view.definition.track },
        { key: 'era', header: 'Era', width: '150px', cell: view => TECH_ERAS[view.definition.era].name, sortValue: view => TECH_ERAS[view.definition.era].order },
        { key: 'cost', header: 'Custo', width: '100px', align: 'right', cell: view => formatCompact(view.cost), sortValue: view => view.cost },
        { key: 'unlocks', header: 'Unlocks', width: '100px', align: 'right', cell: view => `${view.unlocks.length}`, sortValue: view => view.unlocks.length }
      ],
      empty: emptyState({ icon: 'search', title: 'Nenhuma tecnologia disponível', hint: query ? 'A busca não encontrou uma opção pesquisável.' : 'Os pré-requisitos restantes ainda não foram atendidos.' })
    })])
  ];
}

function capabilityCard(capability: CapabilityView, host: TechnologyScreenHost, focused: boolean): HTMLElement {
  const status = capabilityStatus(capability.state);
  return panel({
    title: capability.name, icon: 'technology',
    class: `ae-tech-capability-card${focused ? ' is-focused' : ''}`,
    actions: [badge(CAPABILITY_LABEL[capability.state], { status, variant: capability.state === 'unavailable' ? 'solid' : 'outline', size: 'sm' })]
  }, [
    el('div', { class: 'ae-tech-knowledge-row' }, [
      el('span', { text: 'Conhecimento' }), badge('DESCOBERTO', { status: 'positive', size: 'sm' })
    ]),
    capability.engineCapacity !== null
      ? progressBar({
          label: 'Base material disponível', value: capability.engineCapacity,
          valueText: formatPercent(capability.engineCapacity), status,
          tooltip: {
            title: 'Capacidade material',
            description: 'Fração dos edifícios desbloqueados e insumos estratégicos que o reino possui ou consegue obter.'
          }
        })
      : null,
    capability.goods.length
      ? section('Recursos e produção', capability.goods.map(good => statRow({
          label: good.name,
          value: good.producing ? `${good.produced.toFixed(1)}` : good.available ? formatCompact(good.stock) : '0',
          unit: good.producing ? 'produzido' : good.imported > 0 ? `${good.imported.toFixed(1)} importado` : 'em estoque',
          icon: 'crate',
          status: good.required && !good.available ? 'critical' : good.producing ? 'positive' : good.available ? 'neutral' : 'warning',
          onClick: () => host.openGood(good.good),
          tooltip: {
            title: good.name,
            rows: [
              { label: 'Estoque', value: good.stock.toFixed(1) },
              { label: 'Produção', value: good.produced.toFixed(1) },
              { label: 'Importações', value: good.imported.toFixed(1) },
              { label: 'Dependência da oferta', value: good.importDependency === null ? 'N/A' : formatPercent(good.importDependency) }
            ],
            footnote: 'Clique para abrir na Economia'
          }
        })))
      : null,
    capability.buildings.length
      ? section('Indústria e edifícios', capability.buildings.map(building => statRow({
          label: building.name,
          value: building.operational,
          unit: `/ ${building.count} operacionais · ${building.cities.length} cidade(s)`,
          icon: 'building',
          status: building.count === 0 ? 'critical' : building.operational < building.count ? 'warning' : 'positive',
          onClick: building.instances[0] ? () => host.openCity(building.instances[0].cityId) : undefined,
          tooltip: {
            title: building.name,
            rows: [
              { label: 'Construídos', value: `${building.count}` },
              { label: 'Operacionais', value: `${building.operational}` },
              { label: 'Condição média', value: building.meanCondition === null ? 'N/A' : formatPercent(building.meanCondition) },
              { label: 'Staffing médio', value: building.meanStaffing === null ? 'N/A' : formatPercent(building.meanStaffing) }
            ]
          }
        })))
      : null,
    capability.infrastructure.length
      ? section('Implantação de infraestrutura', capability.infrastructure.map(deployment => statRow({
          label: deployment.label,
          value: deployment.deployed,
          unit: deployment.total > 0 ? `/ ${deployment.total}` : undefined,
          icon: deployment.kind === 'rail' ? 'trade-route' : deployment.kind === 'port' ? 'port' : 'route',
          status: deployment.damaged > 0 ? 'warning' : deployment.deployed > 0 ? 'positive' : 'neutral',
          onClick: () => host.openInfrastructure(deployment.cityIds[0]),
          tooltip: { title: deployment.label, description: deployment.detail, rows: deployment.damaged ? [{ label: 'Danificados', value: `${deployment.damaged}`, status: 'warning' }] : undefined }
        })))
      : null,
    capability.military
      ? section('Implantação militar', [statRow({
          label: capability.military.label,
          value: capability.military.adopted,
          unit: `/ ${capability.military.total} soldados`,
          icon: 'military',
          status: capability.military.total === 0 ? 'neutral' : capability.military.adopted === capability.military.total ? 'positive' : 'warning',
          tooltip: {
            title: capability.military.label,
            description: capability.military.weapons.join(', '),
            rows: [{ label: 'Materiais por equipamento', value: capability.military.requiredGoods.map(good => GOODS[good]?.name ?? good).join(', ') }]
          }
        })])
      : null,
    capability.deployedCities.length
      ? section('Cidades usando', [badgeRow(capability.deployedCities.slice(0, 8).map(city => objectLink(
          { kind: 'city', id: city.id, name: city.name },
          { variant: 'chip', onOpen: () => host.openCity(city.id) }
        )))])
      : el('p', { class: 'ae-tech-note', text: 'Esta tecnologia não tem implantação física registrada.' }),
    el('div', { class: 'ae-tech-capability-actions' }, [
      button('Abrir tecnologia', () => host.inspectTechnology(capability.techId), { variant: 'ghost', size: 'sm', icon: 'technology' }),
      capability.infrastructure.length
        ? button('Ver implantação', () => host.openInfrastructure(capability.infrastructure[0].cityIds[0]), { variant: 'ghost', size: 'sm', icon: 'route' })
        : null
    ])
  ]);
}

export function buildCapabilities(
  snapshot: TechnologyUISnapshot,
  host: TechnologyScreenHost,
  query: string,
  focusedTechId: string | null
): Child[] {
  const bottlenecks = technologicalBottlenecks(snapshot);
  const filtered = snapshot.capabilities.filter(capability =>
    !query || capability.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) ||
    capability.goods.some(good => good.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))) ||
    capability.buildings.some(building => building.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
  );
  const counts = (state: CapabilityView['state']) => snapshot.capabilities.filter(item => item.state === state).length;
  return [
    panel({ title: 'Lacuna tecnologia–capacidade', icon: 'industry', accent: snapshot.kingdomColor }, [
      statGrid([
        stat({ label: 'Conhecimento', value: snapshot.knownEraName, icon: 'book' }),
        stat({ label: 'Operação material', value: snapshot.operatingEraName, icon: 'industry', status: snapshot.knownEra === snapshot.operatingEra ? 'positive' : 'warning' }),
        stat({ label: 'Implantadas', value: counts('deployed'), icon: 'shield', status: 'positive' }),
        stat({ label: 'Limitadas/indisponíveis', value: counts('limited') + counts('unavailable'), icon: 'alert', status: counts('unavailable') ? 'critical' : counts('limited') ? 'warning' : 'positive' })
      ]),
      el('p', { class: 'ae-tech-note', text: 'Conhecimento não desaparece quando fábricas, recursos ou redes são perdidos; o diagnóstico material muda, a descoberta permanece.' })
    ]),
    bottlenecks.length
      ? panel({ title: 'Gargalos tecnológicos', icon: 'alert', subtitle: 'No máximo cinco, ordenados pela menor capacidade material' }, [
          el('div', { class: 'ae-tech-condition-grid' }, bottlenecks.map(condition => conditionCard(condition, host)))
        ])
      : null,
    filtered.length
      ? el('div', { class: 'ae-tech-capability-grid' }, filtered.map(capability => capabilityCard(capability, host, capability.techId === focusedTechId)))
      : panel({ title: 'Capabilities', icon: 'industry' }, [
          emptyState({ icon: 'search', title: 'Nenhuma capability encontrada', hint: query ? 'A busca não corresponde a uma tecnologia, bem ou edifício.' : 'Este reino ainda não possui tecnologia material diagnosticável.' })
        ])
  ];
}

function impactCard(impact: TechnologyImpact, host: TechnologyScreenHost): HTMLElement {
  return el('div', { class: 'ae-tech-impact' }, [
    el('div', { class: 'ae-tech-impact-head' }, [
      objectLink({ kind: 'technology', id: impact.techId, name: impact.techName }, { showIcon: false, onOpen: () => host.inspectTechnology(impact.techId, 'impact') }),
      badge(impact.category.toUpperCase(), { size: 'sm', variant: 'outline' })
    ]),
    el('p', { class: 'ae-tech-impact-detail', text: impact.detail }),
    impact.goods.length ? badgeRow(impact.goods.map(good => goodLink(good, host))) : null,
    impact.buildings.length ? badgeRow(impact.buildings.map(type => badge(BUILDINGS[type]?.name ?? type, { size: 'sm', variant: 'outline' }))) : null
  ]);
}

export function buildImpact(snapshot: TechnologyUISnapshot, host: TechnologyScreenHost, query: string): Child[] {
  const impacts = technologyImpacts(snapshot).filter(impact =>
    !query || `${impact.techName} ${impact.detail}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  );
  const categories: Array<{ id: TechnologyImpact['category']; title: string; icon: string }> = [
    { id: 'economy', title: 'Economia', icon: 'economy' },
    { id: 'infrastructure', title: 'Infraestrutura', icon: 'trade-route' },
    { id: 'military', title: 'Militar', icon: 'military' },
    { id: 'society', title: 'Sociedade', icon: 'society' }
  ];
  const panels = categories.map(category => {
    const entries = impacts.filter(impact => impact.category === category.id);
    return entries.length
      ? panel({ title: category.title, icon: category.icon, subtitle: 'Somente unlocks, modificadores e demandas declarados no sistema' }, [
          el('div', { class: 'ae-tech-impact-grid' }, entries.map(impact => impactCard(impact, host)))
        ])
      : null;
  }).filter(Boolean) as HTMLElement[];
  return panels.length ? panels : [panel({ title: 'Impacto tech', icon: 'technology' }, [
    emptyState({ icon: 'search', title: 'Nenhum impacto encontrado', hint: query ? 'A busca não corresponde aos impactos conhecidos.' : 'O reino ainda não possui impactos tecnológicos registrados.' })
  ])];
}

export function buildHistory(snapshot: TechnologyUISnapshot, host: TechnologyScreenHost): Child[] {
  return [
    panel({
      title: 'História tecnológica', icon: 'history',
      subtitle: 'Descobertas e implantações com registros reais no Chronicle',
      actions: [button('Chronicle completo', () => host.openChronicle(), { variant: 'ghost', size: 'sm', icon: 'history' })]
    }, snapshot.history.length
      ? [el('div', { class: 'ae-tech-timeline' }, snapshot.history.map(entry => el('div', { class: 'ae-tech-timeline-entry' }, [
          el('span', { class: 'ae-tech-timeline-year', text: `${entry.event.year}` }),
          el('span', { class: 'ae-tech-timeline-marker' }),
          el('div', { class: 'ae-tech-timeline-copy' }, [
            entry.techId && TECHNOLOGIES[entry.techId]
              ? objectLink({ kind: 'technology', id: entry.techId, name: entry.techName ?? TECHNOLOGIES[entry.techId].name }, { showIcon: false, onOpen: () => host.inspectTechnology(entry.techId!) })
              : el('strong', { text: entry.event.title ?? 'Implantação de infraestrutura' }),
            el('p', { text: entry.event.text }),
            entry.event.consequences.length ? el('span', { class: 'ae-tech-timeline-consequence', text: entry.event.consequences.join(' · ') }) : null
          ])
        ])))]
      : [emptyState({ icon: 'history', title: 'Nenhum histórico tecnológico registrado', hint: 'O Chronicle não tem eventos datados de descobertas ou ferrovias para este reino.' })]
    ),
    panel({ title: 'Tecnologia mundial', icon: 'kingdom', padded: false, subtitle: 'Comparação compacta; não é um technology power score' }, [
      table({
        rows: snapshot.world,
        rowKey: realm => realm.kingdomId,
        highlightKey: snapshot.kingdomId,
        onRowClick: realm => host.openRealm(realm.kingdomId),
        sortBy: 'known',
        columns: [
          { key: 'realm', header: 'Reino', width: 'minmax(220px, 1.5fr)', cell: realm => objectLink({ kind: 'kingdom', id: realm.kingdomId, name: realm.name, accent: realm.color }, { showIcon: false, onOpen: () => host.openRealm(realm.kingdomId) }), sortValue: realm => realm.name },
          { key: 'era', header: 'Era', width: '180px', cell: realm => realm.eraName, sortValue: realm => TECH_ERAS[realm.era].order },
          { key: 'known', header: 'Conhecidas', width: '100px', align: 'right', cell: realm => `${realm.known}`, sortValue: realm => realm.known },
          { key: 'rate', header: 'Pesquisa/ano', width: '130px', align: 'right', cell: realm => realm.researchOutput.toFixed(1), sortValue: realm => realm.researchOutput }
        ]
      })
    ])
  ];
}
