/**
 * The city dossier.
 *
 * A settlement is the point where every system in Aethoria meets — people,
 * market, industry, logistics, war — and until UI-3 the only view of one was the
 * inspector's compact preview. This screen is the full account, organised around
 * the question the brief puts at its centre: *why is this city doing well or
 * badly?*
 *
 * Three things keep it from becoming a spreadsheet.
 *
 * **Problems come first.** `Diagnostics` turns the metrics into named conditions
 * with verdicts, and the overview opens on the ones that are wrong. A starving
 * city says so above its temple level.
 *
 * **Every figure is traceable.** All arithmetic lives in `CityMetrics`, sourced
 * from `CityLedger` — the books the simulation already keeps. Anything that
 * cannot be computed is `null` and its row is omitted rather than filled with a
 * plausible number.
 *
 * **The aggregation is cached.** Counting citizens by trade is O(population) and
 * rail connectivity is O(map); neither runs per frame. See `CityMetricsCache`.
 */
import { el, clear } from '../core/Dom';
import {
  screenShell, tabs, badge, badgeRow, button, icon, withTooltip, objectLink,
  emptyState, formatCompact, formatPercent, tooltip,
  type TabStrip, type TabItem
} from '../kit';
import { CityMetricsCache, type CityMetrics } from '../city/CityMetrics';
import { buildGoodsTable } from '../city/CityTabs';
import {
  buildOverview, buildPopulation, buildEconomy, buildIndustry,
  buildTrade, buildBuildings, buildHistory
} from '../city/CityTabs';
import { panel } from '../kit';
import type { Child } from '../core/Dom';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';
import type { City } from '../../civ/City';
import type { GoodId } from '../../civ/Goods';

/** What the tab builders are allowed to ask of the game. */
export interface CityScreenHost {
  readonly ctx: GameContext;
  /** Opens a good in the economy screen. */
  openGood(good: GoodId): void;
  /** Closes the dossier, centres the camera on a building and selects it. */
  goToBuilding(buildingId: string, x: number, y: number): void;
  openChronicle(): void;
  /** Expands the economy tab's goods list to every good the city touched. */
  showAllGoods(): void;
}

type TabId = 'overview' | 'population' | 'economy' | 'industry' | 'trade' | 'buildings' | 'history';

export class CityScreen implements Screen, CityScreenHost {
  public readonly id = 'city' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  public ctx!: GameContext;

  private cityId: string | null = null;
  private active: TabId = 'overview';
  private strip: TabStrip | null = null;
  private shell: { root: HTMLElement; body: HTMLElement; setContent(c: Child[]): void } | null = null;
  private metricsCache = new CityMetricsCache();
  private allGoods = false;
  /** Condition to draw the player's eye to, from a deep link. */
  private highlight: string | null = null;

  // ============================ SCREEN ============================

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;

    // A different city resets the view; re-opening the same one keeps the tab the
    // player was on, which is what makes flicking between cities usable.
    const requested = params?.cityId ?? this.cityId ?? this.firstSelectableCity(ctx);
    if (requested !== this.cityId) {
      this.cityId = requested ?? null;
      this.active = 'overview';
      this.allGoods = false;
      this.metricsCache.invalidate();
    }
    if (params?.tab && this.isTabId(params.tab)) this.active = params.tab;
    this.highlight = params?.highlightCondition ?? null;

    const city = this.cityId ? ctx.sim.cities.get(this.cityId) ?? null : null;
    if (!city) {
      return screenShell({
        title: 'Cidade',
        icon: 'city',
        onClose: () => ctx.screens.back(),
        width: 'narrow'
      }).root;
    }

    const metrics = this.metricsCache.get(city, ctx, performance.now());

    const shell = screenShell({
      title: city.name,
      subtitle: this.subtitleFor(city, metrics),
      icon: 'city',
      onClose: () => ctx.screens.back(),
      width: 'wide',
      actions: this.headerActions(city, metrics)
    });
    this.shell = shell;

    // Realm identity, applied as a scoped custom property: the header edge and the
    // accents pick it up, the panels stay stone. A settlement should feel like it
    // belongs to its realm, not be painted in its colour.
    if (metrics.kingdom) shell.root.style.setProperty('--ae-realm', metrics.kingdom.color);
    shell.root.classList.add('ae-city-screen');

    this.strip = tabs(this.tabItems(metrics), this.active, id => {
      this.active = id as TabId;
      this.renderTab();
    });
    shell.root.insertBefore(this.strip.root, shell.body);
    shell.root.insertBefore(this.buildIdentityBar(city, metrics), this.strip.root);

    this.renderTab();
    return shell.root;
  }

  /**
   * Rebuilt on a slow cadence while open.
   *
   * The metrics cache decides whether anything is actually recomputed; this only
   * decides when to redraw. Both are far slower than the frame rate on purpose —
   * these figures move on the scale of a simulated year.
   */
  public tick(ctx: GameContext): void {
    if (!this.cityId || !this.shell) return;
    const city = ctx.sim.cities.get(this.cityId);
    if (!city) return;
    const before = this.metricsCache.get(city, ctx, performance.now());
    // Only redraw when the metrics snapshot is genuinely a new one.
    if (before.year !== this.renderedYear) this.renderTab();
  }

  private renderedYear = -1;

  public dispose(): void {
    tooltip.hide();
    this.shell = null;
    this.strip = null;
  }

  // ============================ HEADER ============================

  private subtitleFor(city: City, metrics: CityMetrics): string {
    const parts = [
      metrics.kingdom ? metrics.kingdom.name : 'Independente',
      city.tierInfo.name,
      `fundada no ano ${city.foundingYear}`
    ];
    return parts.join(' · ');
  }

  private headerActions(city: City, metrics: CityMetrics): Child[] {
    const cities = this.navigableCities();
    const index = cities.findIndex(c => c.id === city.id);

    return [
      // Flick between settlements without going back to the map. Only shown when
      // there is more than one, so a one-city world has no dead controls.
      cities.length > 1
        ? el('div', { class: 'ae-city-nav' }, [
            withTooltip(
              el('button', {
                class: 'ae-city-nav-btn',
                attrs: { type: 'button', 'aria-label': 'Cidade anterior' },
                on: { click: () => this.switchTo(cities[(index - 1 + cities.length) % cities.length].id) }
              }, [el('span', { text: '‹' })]),
              { title: 'Cidade anterior', description: cities[(index - 1 + cities.length) % cities.length].name }
            ),
            el('span', { class: 'ae-city-nav-count', text: `${index + 1} / ${cities.length}` }),
            withTooltip(
              el('button', {
                class: 'ae-city-nav-btn',
                attrs: { type: 'button', 'aria-label': 'Próxima cidade' },
                on: { click: () => this.switchTo(cities[(index + 1) % cities.length].id) }
              }, [el('span', { text: '›' })]),
              { title: 'Próxima cidade', description: cities[(index + 1) % cities.length].name }
            )
          ])
        : null,

      button('Ver no mapa', () => {
        this.ctx.screens.back();
        this.ctx.selection.select({ kind: 'city', id: city.id });
        this.ctx.focusOn(city.x, city.y);
      }, {
        variant: 'secondary', size: 'sm', icon: 'map',
        tooltip: { title: 'Ver no mapa', description: 'Fecha o dossiê, centraliza a câmera e seleciona a cidade.' }
      }),

      metrics.kingdom
        ? button('Reino', () => this.ctx.screens.open('realm', { focusKingdom: metrics.kingdom!.id }), {
            variant: 'ghost', size: 'sm', icon: 'kingdom',
            tooltip: {
              title: metrics.kingdom.name,
              description: 'Abre o dossiê do reino a que esta cidade pertence.'
            }
          })
        : null
    ];
  }

  /** Identity strip: the figures that name the place, plus the realm's colour. */
  private buildIdentityBar(city: City, metrics: CityMetrics): HTMLElement {
    return el('div', { class: 'ae-city-identity' }, [
      badgeRow([
        metrics.isCapital ? badge('Capital', { size: 'sm', status: 'positive', icon: 'crown' }) : null,
        badge(city.tierInfo.name, { size: 'sm', variant: 'outline', icon: 'city' }),
        badge(city.species, { size: 'sm', variant: 'outline', icon: 'population' }),
        metrics.siege ? badge(`Sitiada por ${metrics.siege.besiegerName}`, { size: 'sm', status: 'critical', icon: 'defence' }) : null,
        metrics.famineYears > 0 ? badge(`Fome · ${metrics.famineYears} ano(s)`, { size: 'sm', status: 'critical', icon: 'agriculture' }) : null
      ]),
      el('div', { class: 'ae-city-headline' }, [
        this.headlineFigure('População', formatCompact(metrics.demographics.population), 'population'),
        this.headlineFigure('Prosperidade', formatPercent(metrics.prosperity), 'economy'),
        this.headlineFigure(
          'Alimentação',
          metrics.food.security === null ? '—' : formatPercent(metrics.food.security),
          'agriculture'
        ),
        this.headlineFigure(
          'Emprego',
          metrics.employment.rate === null ? '—' : formatPercent(metrics.employment.rate),
          'industry'
        ),
        metrics.kingdom
          ? el('div', { class: 'ae-city-headline-realm' }, [
              icon('kingdom', { size: 16 }),
              objectLink({
                kind: 'kingdom', id: metrics.kingdom.id, name: metrics.kingdom.name, accent: metrics.kingdom.color
              }, { showIcon: false })
            ])
          : null
      ])
    ]);
  }

  private headlineFigure(label: string, value: string, iconName: string): HTMLElement {
    return el('div', { class: 'ae-city-headline-item' }, [
      icon(iconName, { size: 16, class: 'ae-city-headline-icon' }),
      el('div', { class: 'ae-city-headline-text' }, [
        el('span', { class: 'ae-city-headline-value', text: value }),
        el('span', { class: 'ae-city-headline-label', text: label })
      ])
    ]);
  }

  // ============================ TABS ============================

  /**
   * The tab list, with empty tabs dropped.
   *
   * The brief forbids empty tabs, and a freshly founded settlement genuinely has
   * no industry, no trade and no history. Rather than showing three dead tabs,
   * they are absent until there is something in them, and their badge counts tell
   * the player what is behind each one before clicking.
   */
  private tabItems(metrics: CityMetrics): TabItem[] {
    const items: TabItem[] = [
      { id: 'overview', label: 'Visão geral', icon: 'city' },
      { id: 'population', label: 'População', icon: 'population', badge: metrics.demographics.tracked || undefined }
    ];

    if (metrics.goods.length) {
      items.push({
        id: 'economy', label: 'Economia', icon: 'economy',
        badge: metrics.shortages.length || undefined,
        tooltip: metrics.shortages.length
          ? { title: 'Economia', description: `${metrics.shortages.length} bem(ns) em falta` }
          : undefined
      });
    }
    if (metrics.sectors.some(s => s.ratedOutput.length || s.jobs > 0)) {
      items.push({
        id: 'industry', label: 'Indústria', icon: 'industry',
        badge: metrics.bottlenecks.length || undefined
      });
    }
    if (metrics.routes.length || metrics.logistics.railTiles > 0 || metrics.logistics.hasPort) {
      items.push({ id: 'trade', label: 'Comércio', icon: 'trade-route', badge: metrics.routes.length || undefined });
    }
    if (metrics.buildingsByCategory.length) {
      items.push({ id: 'buildings', label: 'Construções', icon: 'building', badge: metrics.buildingsByCategory.reduce((n, g) => n + g.buildings.length, 0) });
    }
    items.push({ id: 'history', label: 'História', icon: 'history' });

    return items;
  }

  private isTabId(value: string): value is TabId {
    return ['overview', 'population', 'economy', 'industry', 'trade', 'buildings', 'history'].includes(value);
  }

  private renderTab(): void {
    if (!this.shell || !this.cityId) return;
    const city = this.ctx.sim.cities.get(this.cityId);
    if (!city) {
      this.shell.setContent([emptyState({
        icon: 'city',
        title: 'Este assentamento não existe mais',
        hint: 'Foi abandonado ou destruído enquanto o dossiê estava aberto.',
        action: button('Voltar', () => this.ctx.screens.back(), { variant: 'secondary', size: 'sm', icon: 'close' })
      })]);
      return;
    }

    const metrics = this.metricsCache.get(city, this.ctx, performance.now());
    this.renderedYear = metrics.year;

    // A tab that was valid a year ago may have emptied out; fall back rather than
    // rendering a tab that is no longer offered.
    const available = this.tabItems(metrics).map(t => t.id);
    if (!available.includes(this.active)) this.active = 'overview';
    this.strip?.setActive(this.active);

    this.shell.setContent(this.contentFor(city, metrics));
    this.applyHighlight();
  }

  private contentFor(city: City, metrics: CityMetrics): Child[] {
    switch (this.active) {
      case 'overview': return buildOverview(city, metrics, this);
      case 'population': return buildPopulation(city, metrics, this);
      case 'economy': return this.allGoods
        ? [
            panel({
              title: 'Todos os bens',
              icon: 'good',
              subtitle: `${metrics.goods.length} bem(ns) em estoque ou movimentados`,
              padded: false,
              actions: [button('Voltar ao resumo', () => { this.allGoods = false; this.renderTab(); }, { variant: 'ghost', size: 'sm' })]
            }, [buildGoodsTable(metrics.goods, this)])
          ]
        : buildEconomy(city, metrics, this);
      case 'industry': return buildIndustry(city, metrics, this);
      case 'trade': return buildTrade(city, metrics, this);
      case 'buildings': return buildBuildings(city, metrics, this);
      case 'history': return buildHistory(city, metrics, this);
      default: return [];
    }
  }

  /**
   * Draws the eye to one condition, for a deep link from an alert.
   *
   * Temporary and non-modal: the row is marked, scrolled into view, and the mark
   * expires. An alert that says a city is starving should land the player on the
   * food line, not make them hunt for it — but it must not leave the screen in a
   * special state afterwards.
   */
  private applyHighlight(): void {
    if (!this.highlight || !this.shell) return;
    const target = this.shell.body.querySelector<HTMLElement>(`[data-condition-id="${this.highlight}"]`);
    this.highlight = null;
    if (!target) return;

    target.classList.add('ae-city-condition-flash');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => target.classList.remove('ae-city-condition-flash'), 2400);
  }

  // ============================ NAVIGATION ============================

  /** Settlements the prev/next control walks, realm-mates first. */
  private navigableCities(): City[] {
    const all = [...this.ctx.sim.cities.values()];
    const current = this.cityId ? this.ctx.sim.cities.get(this.cityId) : null;
    if (!current?.kingdomId) return all.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    // Within a realm the ordering is by population, which is the order a player
    // thinks about their own cities in.
    const mates = all.filter(c => c.kingdomId === current.kingdomId);
    return mates.length > 1
      ? mates.sort((a, b) => b.population - a.population)
      : all.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  private switchTo(cityId: string): void {
    // Re-opening with new params retargets in place; ScreenManager handles that
    // without pushing a duplicate onto the stack.
    this.ctx.screens.open('city', { cityId });
  }

  private firstSelectableCity(ctx: GameContext): string | undefined {
    const selected = ctx.selection.current;
    if (selected?.kind === 'city') return selected.id;
    if (selected?.kind === 'building') return selected.cityId;
    return [...ctx.sim.cities.keys()][0];
  }

  // ============================ HOST ============================

  public openGood(good: GoodId): void {
    this.ctx.screens.open('economy', { good });
  }

  public goToBuilding(buildingId: string, x: number, y: number): void {
    if (!this.cityId) return;
    this.ctx.screens.back();
    this.ctx.selection.select({ kind: 'building', cityId: this.cityId, buildingId });
    this.ctx.focusOn(x, y);
  }

  public openChronicle(): void {
    this.ctx.screens.open('chronicle');
  }

  public showAllGoods(): void {
    this.allGoods = true;
    this.renderTab();
  }
}
