/**
 * The design system, rendered.
 *
 * This screen exists so the kit can be *looked at* — every component in one
 * place, at the sizes and densities the game actually uses, so a change to a
 * token can be judged before it reaches twenty screens. It is a development
 * tool, reached from the debug panel, not part of the game's navigation.
 *
 * One rule it holds to strictly: **no invented data.** Every figure below is
 * read from the running simulation. A design system validated against fabricated
 * numbers is validated against nothing — placeholder data is always tidier than
 * the real thing, and tidy data hides exactly the problems this screen is for
 * (a realm named beyond the width of its column, a table with one row, a
 * treasury that went negative).
 *
 * Where the world has nothing to show yet, the component's own empty state is
 * what appears. That is the correct output, and worth seeing too.
 */
import {
  panel, section, divider, tabs, screenShell,
  button, iconButton, searchInput, filterGroup,
  stat, statGrid, statRow, rowList, trendIndicator, progressBar,
  badge, badgeRow, table, emptyState, objectLink,
  icon, withTooltip,
  formatCompact, formatFull, formatPercent,
  statusForRatio, type Status, type ObjectRef, type TabStrip
} from '../kit';
import { el } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

type SectionId = 'foundation' | 'data' | 'objects' | 'controls';

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'foundation', label: 'Fundação', icon: 'culture' },
  { id: 'data', label: 'Dados', icon: 'statistics' },
  { id: 'objects', label: 'Objetos', icon: 'route' },
  { id: 'controls', label: 'Controles', icon: 'settings' }
];

const STATUSES: Status[] = ['positive', 'neutral', 'warning', 'critical'];

export class UIKitScreen implements Screen {
  public readonly id = 'ui-kit' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private active: SectionId = 'foundation';
  private strip: TabStrip | null = null;
  private search = '';

  public build(ctx: GameContext): HTMLElement {
    const shell = screenShell({
      title: 'Design System',
      subtitle: 'Todos os componentes da interface, renderizados com dados reais deste mundo.',
      icon: 'culture',
      onClose: () => ctx.screens.back(),
      width: 'wide'
    });

    this.strip = tabs(
      SECTIONS,
      this.active,
      id => {
        this.active = id as SectionId;
        shell.setContent(this.renderSection(ctx, shell));
      }
    );
    shell.root.insertBefore(this.strip.root, shell.body);
    shell.setContent(this.renderSection(ctx, shell));

    return shell.root;
  }

  private renderSection(ctx: GameContext, shell: { setContent(c: any[]): void }): HTMLElement[] {
    switch (this.active) {
      case 'foundation': return this.foundation();
      case 'data': return this.data(ctx);
      case 'objects': return this.objects(ctx);
      case 'controls': return this.controls(ctx, shell);
      default: return [];
    }
  }

  // ============================ FOUNDATION ============================

  private foundation(): HTMLElement[] {
    const swatch = (name: string, cssVar: string) =>
      withTooltip(
        el('div', { class: 'kit-swatch' }, [
          el('div', { class: 'kit-swatch-chip', style: { background: `var(${cssVar})` } }),
          el('span', { class: 'kit-swatch-name', text: name }),
          el('code', { class: 'kit-swatch-var', text: cssVar })
        ]),
        { title: name, description: `Token: ${cssVar}`, accent: `var(${cssVar})` }
      );

    return [
      panel({ title: 'Superfícies', subtitle: 'Carvão e pedra quente, em camadas a partir do mundo.', icon: 'building' }, [
        el('div', { class: 'kit-swatches' }, [
          swatch('Background', '--ae-bg'),
          swatch('Panel', '--ae-panel'),
          swatch('Panel Raised', '--ae-panel-raised'),
          swatch('Panel Sunken', '--ae-panel-sunken'),
          swatch('Parchment', '--ae-parchment')
        ])
      ]),

      panel({ title: 'Estado', subtitle: 'Quatro estados, e apenas quatro.', icon: 'warning' }, [
        el('div', { class: 'kit-swatches' }, [
          swatch('Positive', '--ae-positive'),
          swatch('Neutral', '--ae-neutral'),
          swatch('Warning', '--ae-warning'),
          swatch('Critical', '--ae-critical'),
          swatch('Accent', '--ae-accent')
        ])
      ]),

      panel({ title: 'Tipografia', subtitle: 'A hierarquia inteira, do título ao metadado.', icon: 'book' }, [
        el('div', { class: 'kit-type' }, [
          el('div', { class: 'ae-screen-title', text: 'Screen Title · Reino de Aldréth' }),
          el('div', { class: 'ae-section-title', text: 'Section Title' }),
          el('div', { style: { fontSize: 'var(--ae-text-object-name)', fontWeight: '700' }, text: 'Object Name · Porto Cinzento' }),
          el('div', { class: 'ae-stat-value', text: '18.402' }),
          el('div', { style: { fontSize: 'var(--ae-text-body)' }, text: 'Normal text — a linha em que a maior parte da interface é lida.' }),
          el('div', { style: { fontSize: 'var(--ae-text-secondary-size)', color: 'var(--ae-text-secondary)' }, text: 'Secondary text — contexto e qualificação.' }),
          el('div', { class: 'ae-stat-label', text: 'Tiny metadata' })
        ])
      ]),

      panel({
        title: 'Ícones',
        subtitle: 'A arte do próprio jogo. Nenhum emoji do sistema.',
        icon: 'search'
      }, [
        section('Domínios', [
          el('div', { class: 'kit-icons' }, [
            'citizen', 'population', 'city', 'kingdom', 'building', 'economy', 'good',
            'industry', 'trade-route', 'diplomacy', 'war', 'defence', 'politics',
            'technology', 'education', 'culture', 'history', 'year', 'ecosystem',
            'agriculture', 'map', 'climate', 'disaster', 'statistics', 'settings',
            'power', 'alert', 'save', 'menu', 'dismiss'
          ].map(name => withTooltip(
            el('div', { class: 'kit-icon-cell' }, [
              icon(name, { size: 32 }),
              el('span', { class: 'kit-icon-name', text: name })
            ]),
            { title: name, description: 'Nome conceitual resolvido pelo vocabulário de ícones.', icon: name }
          )))
        ]),
        divider('Fallback'),
        el('div', { class: 'kit-icons' }, [
          withTooltip(
            el('div', { class: 'kit-icon-cell' }, [
              icon('nao-existe-ainda', { size: 32 }),
              el('span', { class: 'kit-icon-name', text: 'sem arte' })
            ]),
            {
              title: 'Fallback consistente',
              description: 'Um losango de bronze, discreto e igual em toda a interface. Marcado no DOM com data-icon-missing para ser encontrado por seletor.'
            }
          )
        ])
      ]),

      panel({ title: 'Tooltip', subtitle: 'Passe o cursor sobre os exemplos abaixo.', icon: 'book' }, [
        badgeRow([
          withTooltip(badge('Título apenas', { variant: 'outline' }), { title: 'Apenas um título' }),
          withTooltip(badge('Com valor', { variant: 'outline' }), {
            title: 'Celeiro municipal', value: '2.140 t', icon: 'agriculture'
          }),
          withTooltip(badge('Completo', { variant: 'outline' }), {
            title: 'Descontentamento',
            value: '62%',
            valueStatus: 'critical',
            icon: 'alert',
            description: 'Acima de 60% as facções começam a conspirar abertamente contra a coroa.',
            rows: [
              { label: 'Fome', value: '+24', status: 'critical' },
              { label: 'Impostos', value: '+18', status: 'warning' },
              { label: 'Vitórias recentes', value: '−9', status: 'positive' }
            ],
            footnote: 'Média ponderada por população',
            shortcut: 'P'
          })
        ])
      ])
    ];
  }

  // ============================ DATA ============================

  private data(ctx: GameContext): HTMLElement[] {
    const { sim } = ctx;
    const kingdoms = Array.from(sim.kingdoms.values());
    const cities = Array.from(sim.cities.values());
    const wars = sim.diplomacy.activeWars.size;

    return [
      panel({ title: 'Stat', subtitle: 'Valores de destaque, lidos deste mundo agora.', icon: 'statistics' }, [
        statGrid([
          stat({ label: 'Ano', value: sim.currentYear, icon: 'year' }),
          stat({ label: 'População', value: sim.entities.length, icon: 'population', unit: 'seres' }),
          stat({ label: 'Cidades', value: cities.length, icon: 'city' }),
          stat({ label: 'Reinos', value: kingdoms.length, icon: 'kingdom' }),
          stat({
            label: 'Guerras',
            value: wars,
            icon: 'war',
            status: wars > 0 ? 'critical' : 'positive'
          })
        ])
      ]),

      panel({ title: 'TrendIndicator', subtitle: 'A cor segue o significado, não o sinal.', icon: 'statistics' }, [
        section('O mesmo número, três leituras', [
          rowList([
            statRow({
              label: 'Preço do grão',
              value: '−10%',
              icon: 'agriculture',
              trend: { delta: -10, sentiment: 'lower-better' },
              tooltip: {
                title: 'Preço do grão',
                description: 'Queda de preço lida como boa notícia: é o que a cidade paga para alimentar sua população.',
                rows: [{ label: 'sentiment', value: 'lower-better' }]
              }
            }),
            statRow({
              label: 'Receita de exportação',
              value: '−10%',
              icon: 'economy',
              trend: { delta: -10, sentiment: 'higher-better' },
              tooltip: {
                title: 'Receita de exportação',
                description: 'A mesma queda de 10%, agora má notícia: é dinheiro que deixa de entrar.',
                rows: [{ label: 'sentiment', value: 'higher-better' }]
              }
            }),
            statRow({
              label: 'Participação na população',
              value: '−10%',
              icon: 'population',
              trend: { delta: -10, sentiment: 'neutral' },
              tooltip: {
                title: 'Participação na população',
                description: 'Movimento sem veredicto. Uma proporção que muda não é boa nem ruim por si.',
                rows: [{ label: 'sentiment', value: 'neutral' }]
              }
            })
          ])
        ]),
        divider(),
        el('div', { class: 'ae-badge-row' }, [
          trendIndicator({ delta: 12.4, period: 'vs. década anterior' }),
          trendIndicator({ delta: -3.1, period: 'vs. década anterior' }),
          trendIndicator({ direction: 'flat', text: 'estável', period: 'vs. década anterior' })
        ])
      ]),

      panel({ title: 'ProgressBar', subtitle: 'Barras com banda de estado e marca de referência.', icon: 'statistics' }, [
        ...[0.86, 0.48, 0.22, 0.07].map(v =>
          progressBar({
            label: `Preenchimento ${formatPercent(v)}`,
            value: v,
            status: statusForRatio(v),
            markerAt: 0.6,
            tooltip: {
              title: 'Banda de estado',
              value: formatPercent(v),
              description: 'A cor vem de statusForRatio; a marca branca é o limite de referência em 60%.'
            }
          })
        )
      ]),

      panel({ title: 'Badge', subtitle: 'Três variantes, quatro estados.', icon: 'good' }, [
        section('soft', [badgeRow(STATUSES.map(s => badge(s, { status: s })))]),
        section('outline', [badgeRow(STATUSES.map(s => badge(s, { status: s, variant: 'outline' })))]),
        section('solid', [badgeRow(STATUSES.map(s => badge(s, { status: s, variant: 'solid' })))])
      ]),

      panel({
        title: 'Table',
        subtitle: kingdoms.length
          ? 'Reinos deste mundo. Clique num cabeçalho para reordenar.'
          : 'Nenhum reino fundado ainda — o estado vazio é a saída correta.',
        icon: 'kingdom',
        padded: false
      }, [
        table({
          columns: [
            {
              key: 'name',
              header: 'Reino',
              cell: k => objectLink({ kind: 'kingdom', id: k.id, name: k.name, accent: k.color }),
              sortValue: k => k.name
            },
            {
              key: 'cities',
              header: 'Cidades',
              align: 'right',
              width: '90px',
              cell: k => formatFull(this.cityCount(ctx, k.id)),
              sortValue: k => this.cityCount(ctx, k.id)
            },
            {
              key: 'pop',
              header: 'População',
              align: 'right',
              width: '110px',
              cell: k => formatCompact(this.popOf(ctx, k.id)),
              sortValue: k => this.popOf(ctx, k.id),
              tooltip: { title: 'População', description: 'Soma da população de todas as cidades do reino.' }
            }
          ],
          rows: kingdoms,
          rowKey: k => k.id,
          sortBy: 'pop',
          empty: emptyState({
            icon: 'kingdom',
            title: 'Nenhum reino fundado',
            hint: 'Deixe o mundo simular até que os primeiros assentamentos se unam sob uma coroa.'
          })
        })
      ]),

      panel({ title: 'EmptyState', subtitle: 'O que aparece quando não há nada a mostrar.', icon: 'search' }, [
        emptyState({
          icon: 'history',
          title: 'Nada registrado neste período',
          hint: 'A crônica só guarda o que aconteceu. Avance o tempo e ela se preenche.',
          action: button('Avançar um ano', () => {
            for (let i = 0; i < 60; i++) ctx.sim.tickAI(ctx.tileMap, ctx.particles);
            ctx.toast('Simulação avançada em +1 Ano', 'info');
          }, { icon: 'forward', variant: 'secondary' }),
          compact: true
        })
      ])
    ];
  }

  // ============================ OBJECTS ============================

  private objects(ctx: GameContext): HTMLElement[] {
    const kingdoms = Array.from(ctx.sim.kingdoms.values());
    const cities = Array.from(ctx.sim.cities.values());

    // References to whatever this world actually contains. Kinds the world has
    // no instance of are simply absent — there is nothing to invent.
    const refs: ObjectRef[] = [
      ...kingdoms.slice(0, 3).map((k): ObjectRef => ({
        kind: 'kingdom', id: k.id, name: k.name, accent: k.color
      })),
      ...cities.slice(0, 3).map((c): ObjectRef => ({
        kind: 'city', id: c.id, name: c.name,
        qualifier: `pop. ${formatFull(c.population)}`
      })),
      ...ctx.sim.entities.slice(0, 2).map((e): ObjectRef => ({
        kind: 'citizen', id: e.id, name: e.name, qualifier: e.species
      }))
    ];

    return [
      panel({
        title: 'ObjectLink',
        subtitle: 'Uma referência a algo no mundo. Passe o cursor; o clique chega nas próximas fases.',
        icon: 'route'
      }, [
        el('p', { class: 'kit-note', text:
          'Um link sem destino registrado é renderizado como referência inerte — com ícone, nome e estado — em vez de um botão que mente sobre estar ativo. É assim que as telas podem ser escritas contra esta API agora e ganhar navegação conforme cada tipo é ligado.'
        }),
        refs.length
          ? section('Neste mundo', [badgeRow(refs.map(r => objectLink(r, { variant: 'chip' })))])
          : emptyState({
              icon: 'route',
              title: 'Mundo sem objetos ainda',
              hint: 'Sem reinos, cidades ou habitantes não há nada para referenciar. Avance a simulação.',
              compact: true
            }),
        divider('Estado na referência'),
        badgeRow([
          objectLink({ kind: 'city', id: 'demo-a', name: 'Exemplo com aviso', status: 'warning' }, { variant: 'chip' }),
          objectLink({ kind: 'war', id: 'demo-b', name: 'Exemplo crítico', status: 'critical' }, { variant: 'chip' }),
          objectLink({ kind: 'technology', id: 'demo-c', name: 'Exemplo positivo', status: 'positive' }, { variant: 'chip' })
        ]),
        divider('Inline'),
        el('p', { class: 'kit-note' }, [
          'Referências também vivem no meio de uma frase — ',
          refs[0] ? objectLink(refs[0]) : el('em', { text: 'nenhum reino' }),
          ' declarou guerra, e ',
          refs.find(r => r.kind === 'city') ? objectLink(refs.find(r => r.kind === 'city')!) : el('em', { text: 'nenhuma cidade' }),
          ' está no caminho do exército.'
        ])
      ]),

      panel({ title: 'Painéis', subtitle: 'As três variantes de superfície.', icon: 'building' }, [
        panel({ title: 'default', variant: 'default' }, [el('p', { class: 'kit-note', text: 'A superfície padrão.' })]),
        panel({ title: 'raised', variant: 'raised' }, [el('p', { class: 'kit-note', text: 'Acima da superfície ao redor.' })]),
        panel({ title: 'sunken', variant: 'sunken' }, [el('p', { class: 'kit-note', text: 'Um recesso, para agrupamentos internos.' })])
      ])
    ];
  }

  // ============================ CONTROLS ============================

  private controls(ctx: GameContext, shell: { setContent(c: any[]): void }): HTMLElement[] {
    const kingdoms = Array.from(ctx.sim.kingdoms.values());
    const matches = this.search
      ? kingdoms.filter(k => k.name.toLowerCase().includes(this.search.toLowerCase()))
      : kingdoms;

    return [
      panel({ title: 'Button', subtitle: 'Quatro variantes, dois tamanhos.', icon: 'settings' }, [
        el('div', { class: 'ae-badge-row' }, [
          button('Primary', () => ctx.toast('Primary', 'info'), { variant: 'primary', icon: 'crown' }),
          button('Secondary', () => ctx.toast('Secondary', 'info'), { variant: 'secondary', icon: 'save' }),
          button('Ghost', () => ctx.toast('Ghost', 'info'), { variant: 'ghost' }),
          button('Danger', () => ctx.toast('Danger', 'warning'), { variant: 'danger', icon: 'alert' }),
          button('Desabilitado', () => {}, { disabled: true })
        ]),
        divider('sm + atalho'),
        el('div', { class: 'ae-badge-row' }, [
          button('Com atalho', () => {}, { size: 'sm', shortcut: 'F5', icon: 'save' }),
          button('Compacto', () => {}, { size: 'sm', variant: 'ghost' })
        ])
      ]),

      panel({ title: 'IconButton', subtitle: 'Sempre com nome acessível e tooltip.', icon: 'settings' }, [
        el('div', { class: 'ae-badge-row' }, [
          iconButton('map', 'Centralizar mapa', () => ctx.toast('Mapa', 'info')),
          iconButton('statistics', 'Estatísticas', () => ctx.screens.open('stats')),
          iconButton('settings', 'Ajustes', () => ctx.screens.open('settings'), { variant: 'secondary' }),
          iconButton('alert', 'Ativo', () => {}, { active: true }),
          iconButton('dismiss', 'Desabilitado', () => {}, { disabled: true })
        ])
      ]),

      panel({
        title: 'SearchInput + FilterButton',
        subtitle: 'Filtragem real sobre os reinos deste mundo.',
        icon: 'search',
        actions: [
          searchInput({
            placeholder: 'Buscar reino…',
            value: this.search,
            onInput: value => {
              this.search = value;
              shell.setContent(this.controls(ctx, shell));
            }
          })
        ]
      }, [
        filterGroup(
          [
            { id: 'all', label: 'Todos', count: kingdoms.length, icon: 'kingdom' },
            { id: 'large', label: 'Populosos', count: kingdoms.filter(k => this.popOf(ctx, k.id) > 100).length, icon: 'population', status: 'positive' },
            { id: 'atwar', label: 'Em guerra', count: ctx.sim.diplomacy.activeWars.size, icon: 'war', status: 'critical' }
          ],
          'all',
          id => ctx.toast(`Filtro: ${id}`, 'info')
        ).root,
        divider(),
        matches.length
          ? rowList(matches.map(k => statRow({
              label: k.name,
              value: formatCompact(this.popOf(ctx, k.id)),
              unit: 'hab.',
              icon: 'kingdom',
              onClick: () => ctx.screens.open('kingdoms', { focusKingdom: k.id })
            })))
          : emptyState({
              icon: 'search',
              title: this.search ? 'Nenhum reino corresponde' : 'Nenhum reino fundado',
              hint: this.search ? `Nada encontrado para "${this.search}".` : 'Avance a simulação até que surjam coroas.',
              compact: true
            })
      ]),

      panel({ title: 'Comportamento de painel', icon: 'book' }, [
        el('p', { class: 'kit-note', text:
          'Esta tela usa screenShell: o cabeçalho fica fixo, o corpo é a única região com scroll, ESC e o botão de fechar seguem o mesmo caminho, e trocar de aba substitui apenas o corpo — a faixa de abas não é reconstruída.'
        })
      ])
    ];
  }

  // ============================ HELPERS ============================

  /** Cities belonging to a realm. Read live; nothing is cached across a build. */
  private cityCount(ctx: GameContext, kingdomId: string): number {
    let n = 0;
    for (const city of ctx.sim.cities.values()) if (city.kingdomId === kingdomId) n++;
    return n;
  }

  private popOf(ctx: GameContext, kingdomId: string): number {
    let n = 0;
    for (const city of ctx.sim.cities.values()) {
      if (city.kingdomId === kingdomId) n += city.population;
    }
    return n;
  }
}
