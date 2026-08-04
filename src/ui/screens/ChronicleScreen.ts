import { el, clear, button, emptyState } from '../core/Dom';
import { chronicle, HistoryEvent, HistoryEventType, HistoryImportance, HistoryThread } from '../../civ/Chronicle';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

type FilterKey = 'all' | 'warfare' | 'politics' | 'people' | 'economy' | 'culture' | 'world';
type ViewMode = 'timeline' | 'stories';
type ImportanceMode = 'all' | 'major';

const FILTERS: { key: FilterKey; label: string; icon: string; color: string; types?: HistoryEventType[] }[] = [
  { key: 'all', label: 'Everything', icon: '📜', color: '#fbbf24' },
  { key: 'warfare', label: 'War & Conquest', icon: '⚔️', color: '#ef4444', types: ['war', 'peace', 'conquest', 'siege', 'rebellion'] },
  { key: 'politics', label: 'States & Laws', icon: '👑', color: '#a855f7', types: ['kingdom', 'king', 'law', 'revolution', 'succession', 'diplomacy'] },
  { key: 'people', label: 'People', icon: '🌟', color: '#f59e0b', types: ['great_person', 'king', 'succession'] },
  { key: 'economy', label: 'Economy', icon: '⚖️', color: '#22c55e', types: ['trade', 'economy'] },
  { key: 'culture', label: 'Culture & Knowledge', icon: '📚', color: '#22d3ee', types: ['tech', 'culture', 'wonder'] },
  { key: 'world', label: 'Cities & Calamity', icon: '🌍', color: '#f97316', types: ['founding', 'disaster', 'famine'] }
];

const TYPE_STYLE: Record<HistoryEventType, { icon: string; color: string; label: string }> = {
  founding: { icon: '🏛️', color: '#34d399', label: 'Founding' },
  kingdom: { icon: '👑', color: '#a855f7', label: 'Kingdom' },
  war: { icon: '⚔️', color: '#ef4444', label: 'War' },
  peace: { icon: '🕊️', color: '#38bdf8', label: 'Peace' },
  king: { icon: '♛', color: '#fbbf24', label: 'Ruler' },
  disaster: { icon: '💥', color: '#f43f5e', label: 'Disaster' },
  conquest: { icon: '🚩', color: '#f97316', label: 'Conquest' },
  trade: { icon: '⚖️', color: '#22c55e', label: 'Trade' },
  tech: { icon: '💡', color: '#22d3ee', label: 'Discovery' },
  law: { icon: '⚖', color: '#c084fc', label: 'Law' },
  revolution: { icon: '🔥', color: '#fb7185', label: 'Revolution' },
  society: { icon: '👥', color: '#f59e0b', label: 'Society' },
  economy: { icon: '📈', color: '#10b981', label: 'Economy' },
  diplomacy: { icon: '🤝', color: '#60a5fa', label: 'Diplomacy' },
  great_person: { icon: '🌟', color: '#fbbf24', label: 'Great Person' },
  wonder: { icon: '🏆', color: '#f59e0b', label: 'Wonder' },
  succession: { icon: '♔', color: '#e879f9', label: 'Succession' },
  famine: { icon: '🌾', color: '#d97706', label: 'Famine' },
  siege: { icon: '🏰', color: '#dc2626', label: 'Siege' },
  rebellion: { icon: '✊', color: '#f43f5e', label: 'Rebellion' },
  culture: { icon: '🎭', color: '#2dd4bf', label: 'Culture' }
};

const IMPORTANCE_RANK: Record<HistoryImportance, number> = {
  minor: 0,
  notable: 1,
  major: 2,
  legendary: 3
};

/**
 * Aethoria's history book. The screen never invents facts: it only reorganises
 * structured events already recorded by the simulation into timeline and story
 * threads.
 */
export class ChronicleScreen implements Screen {
  public readonly id = 'chronicle' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private ctx!: GameContext;
  private bodyEl!: HTMLElement;
  private filtersEl!: HTMLElement;
  private viewTabsEl!: HTMLElement;
  private filter: FilterKey = 'all';
  private view: ViewMode = 'timeline';
  private importance: ImportanceMode = 'all';
  private query = '';

  public build(ctx: GameContext): HTMLElement {
    this.ctx = ctx;
    this.bodyEl = el('div', { class: 'chronicle-body' });
    this.filtersEl = el('div', { class: 'filter-strip' });
    this.viewTabsEl = el('div', { class: 'tab-strip' });

    const search = el('input', {
      class: 'text-input search',
      attrs: { type: 'search', placeholder: 'Search names, cities, causes, wars…', spellcheck: false },
      on: {
        input: (ev: Event) => {
          this.query = (ev.target as HTMLInputElement).value.trim().toLowerCase();
          this.render();
        },
        keydown: (ev: KeyboardEvent) => ev.stopPropagation()
      }
    });

    const layout = el('div', { class: 'screen-panel' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '📜 Chronicle of Aethoria' }),
          el('p', { class: 'screen-sub', text: 'A living historical record — events, causes, consequences and connected stories.' })
        ]),
        el('div', { class: 'head-actions' }, [
          search,
          button('Clear', () => {
            if (confirm('Erase the entire chronicle? The history of this world will be forgotten.')) {
              chronicle.clear();
              this.render();
              ctx.toast('The chronicle has been erased', 'warning');
            }
          }, { icon: '🗑️' }),
          button('Close', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
        ])
      ]),
      this.viewTabsEl,
      this.filtersEl,
      this.bodyEl
    ]);

    this.render();
    return layout;
  }

  private render(): void {
    this.renderViewTabs();
    this.renderFilters();
    clear(this.bodyEl);
    this.bodyEl.appendChild(this.summaryStrip());
    if (this.view === 'timeline') this.renderTimeline();
    else this.renderStories();
  }

  private renderViewTabs(): void {
    clear(this.viewTabsEl);
    const modes: { id: ViewMode; label: string; icon: string }[] = [
      { id: 'timeline', label: 'Timeline', icon: '📜' },
      { id: 'stories', label: 'Historical Stories', icon: '📖' }
    ];
    for (const mode of modes) {
      this.viewTabsEl.appendChild(el('button', {
        class: `tab${this.view === mode.id ? ' active' : ''}`,
        on: { click: () => { this.view = mode.id; this.render(); } }
      }, [el('span', { text: mode.icon }), el('span', { text: mode.label })]));
    }
    this.viewTabsEl.appendChild(el('button', {
      class: `tab${this.importance === 'major' ? ' active' : ''}`,
      on: {
        click: () => {
          this.importance = this.importance === 'all' ? 'major' : 'all';
          this.render();
        }
      }
    }, [el('span', { text: '★' }), el('span', { text: this.importance === 'major' ? 'Major events only' : 'All importance' })]));
  }

  private renderFilters(): void {
    clear(this.filtersEl);
    const allEvents = chronicle.getEvents();
    for (const f of FILTERS) {
      const count = allEvents.filter(event => this.matchesFilter(event, f.key)).length;
      this.filtersEl.appendChild(el('button', {
        class: `filter-chip${this.filter === f.key ? ' active' : ''}`,
        style: { '--chip-color': f.color } as any,
        on: {
          click: () => {
            this.filter = f.key;
            this.render();
          }
        }
      }, [
        el('span', { text: f.icon }),
        el('span', { text: f.label }),
        el('span', { class: 'filter-count', text: `${count}` })
      ]));
    }
  }

  private summaryStrip(): HTMLElement {
    const summary = chronicle.getSummary();
    const span = summary.earliestYear === null || summary.latestYear === null
      ? '—'
      : `${summary.earliestYear}–${summary.latestYear}`;
    return el('div', { class: 'stat-grid cols-4' }, [
      this.tile('📜', 'Recorded events', `${summary.total}`),
      this.tile('★', 'Major events', `${summary.major}`, `${summary.legendary} legendary`),
      this.tile('📖', 'Story threads', `${summary.threads}`),
      this.tile('📅', 'Recorded years', span, `current year ${this.ctx.sim.currentYear}`)
    ]);
  }

  private filteredEvents(): HistoryEvent[] {
    let events = this.query ? chronicle.search(this.query) : chronicle.getEvents();
    events = events.filter(event => this.matchesFilter(event, this.filter));
    if (this.importance === 'major') {
      events = events.filter(event => IMPORTANCE_RANK[event.importance] >= IMPORTANCE_RANK.major);
    }
    return events;
  }

  private renderTimeline(): void {
    const events = this.filteredEvents();
    if (events.length === 0) {
      this.bodyEl.appendChild(emptyState(
        '🕯️',
        chronicle.getEvents().length === 0 ? 'History has yet to unfold' : 'Nothing matches this view',
        chronicle.getEvents().length === 0
          ? 'Let the simulation run. Foundings, crises, discoveries and wars will write this world’s history.'
          : 'Try another category, show all importance levels, or clear the search.'
      ));
      return;
    }

    const timeline = el('div', { class: 'timeline' });
    let lastYear: number | null = null;
    for (const event of events) {
      if (event.year !== lastYear) {
        lastYear = event.year;
        timeline.appendChild(el('div', { class: 'timeline-year' }, [
          el('span', { class: 'year-dot' }),
          el('span', { class: 'year-label', text: `Year ${event.year}` })
        ]));
      }
      timeline.appendChild(this.eventCard(event));
    }
    this.bodyEl.appendChild(timeline);
  }

  private renderStories(): void {
    const threads = chronicle.getThreads().filter(thread => this.threadVisible(thread));
    if (threads.length === 0) {
      this.bodyEl.appendChild(emptyState(
        '📖',
        'No connected historical stories yet',
        'Story chapters appear when structured events share a real thread — for example a siege, war, revolution or major legacy.'
      ));
      return;
    }

    for (const thread of threads) {
      const participants = thread.refs.map(ref => ref.name).filter((name): name is string => !!name);
      const years = thread.startYear === thread.endYear ? `Year ${thread.startYear}` : `Years ${thread.startYear}–${thread.endYear}`;
      const visibleEvents = thread.events.filter(event => this.eventVisible(event));
      if (visibleEvents.length === 0) continue;

      this.bodyEl.appendChild(el('section', { class: 'panel history-thread' }, [
        el('header', { class: 'panel-head' }, [
          el('div', {}, [
            el('h3', { class: 'panel-title', text: thread.title }),
            el('p', { class: 'panel-sub', text: `${years} · ${thread.events.length} events${participants.length ? ` · ${participants.slice(0, 4).join(', ')}` : ''}` })
          ]),
          this.importanceBadge(thread.importance)
        ]),
        el('div', { class: 'panel-body history-list' }, visibleEvents.map(event => this.storyRow(event)))
      ]));
    }
  }

  private eventCard(event: HistoryEvent): HTMLElement {
    const style = TYPE_STYLE[event.type] ?? TYPE_STYLE.kingdom;
    const meta: HTMLElement[] = [
      el('span', { class: 'badge', text: style.label }),
      this.importanceBadge(event.importance)
    ];
    for (const ref of event.refs.slice(0, 4)) {
      if (ref.name) meta.push(el('span', { class: 'badge', text: ref.name }));
    }

    const details: HTMLElement[] = [];
    if (event.causes.length) {
      details.push(el('p', { class: 'muted small', text: `Cause: ${event.causes.join(' • ')}` }));
    }
    if (event.consequences.length) {
      details.push(el('p', { class: 'muted small', text: `Consequence: ${event.consequences.join(' • ')}` }));
    }

    return el('article', {
      class: `timeline-entry entry-${event.type} importance-${event.importance}`,
      style: { '--entry-color': style.color } as any
    }, [
      el('span', { class: 'entry-icon', text: style.icon }),
      el('div', { class: 'entry-copy' }, [
        event.title ? el('h4', { class: 'entry-title', text: event.title }) : null,
        el('p', { class: 'entry-text', text: event.text }),
        el('div', { class: 'chip-row', }, meta),
        ...details
      ].filter(Boolean) as HTMLElement[])
    ]);
  }

  private storyRow(event: HistoryEvent): HTMLElement {
    const style = TYPE_STYLE[event.type] ?? TYPE_STYLE.kingdom;
    return el('div', { class: 'history-row' }, [
      el('span', { class: 'history-years', text: `${event.year}` }),
      el('span', { class: 'entry-icon', text: style.icon }),
      el('div', {}, [
        event.title ? el('strong', { text: event.title }) : null,
        el('p', { class: 'history-text', text: event.text })
      ].filter(Boolean) as HTMLElement[])
    ]);
  }

  private matchesFilter(event: HistoryEvent, filter: FilterKey): boolean {
    if (filter === 'all') return true;
    const config = FILTERS.find(item => item.key === filter);
    return !!config?.types?.includes(event.type);
  }

  private eventVisible(event: HistoryEvent): boolean {
    if (!this.matchesFilter(event, this.filter)) return false;
    if (this.importance === 'major' && IMPORTANCE_RANK[event.importance] < IMPORTANCE_RANK.major) return false;
    if (!this.query) return true;
    return chronicle.search(this.query).some(match => match.id === event.id);
  }

  private threadVisible(thread: HistoryThread): boolean {
    return thread.events.some(event => this.eventVisible(event));
  }

  private importanceBadge(importance: HistoryImportance): HTMLElement {
    const labels: Record<HistoryImportance, string> = {
      minor: 'Minor',
      notable: 'Notable',
      major: 'Major',
      legendary: 'Legendary'
    };
    return el('span', { class: `badge importance-${importance}`, text: labels[importance] });
  }

  private tile(icon: string, label: string, value: string, sub?: string): HTMLElement {
    return el('div', { class: 'stat-tile' }, [
      el('span', { class: 'tile-icon', text: icon }),
      el('span', { class: 'tile-value', text: value }),
      el('span', { class: 'tile-label', text: label }),
      sub ? el('span', { class: 'tile-sub', text: sub }) : null
    ].filter(Boolean) as HTMLElement[]);
  }
}
