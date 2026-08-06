/**
 * The economic intelligence terminal.
 *
 * Not a trading desk. There is no wallet, no portfolio and no speculative order
 * book here, because the player is not a merchant in this world — they are the
 * thing that made it. What they need is the ability to *read* an economy: to look
 * at a price and find out what moved it, follow the shortage upstream to the mine
 * that ran dry, and land on the realm that owns the last deposit.
 *
 * So the screen is built around one question, asked on every tab:
 *
 *   **Why is this good expensive, short, or piling up?**
 *
 * Everything else is in service of answering it. The overview says what is wrong
 * across the world; GOODS is the searchable index; the good inspector is the
 * answer itself — price history, the measured factors behind the move, the recipe
 * chain, who makes it, who burns it, and what is left in the ground. PRODUCTION
 * shows where industry is stopped and by what. TRADE shows the four prices that
 * decide whether a route is worth running. CITIES and REALMS are the same figures
 * arranged by who holds them.
 *
 * The aggregation runs behind `EconomyMetricsCache` on a slow cadence. It walks
 * every settlement's books, every route and every tile on the map, and it must
 * never run per frame.
 */
import { el } from '../core/Dom';
import {
  screenShell, tabs, button, searchInput, emptyState, tooltip, objectNav,
  type TabStrip, type TabItem
} from '../kit';
import {
  EconomyMetricsCache,
  type EconomyMetrics, type GoodCategory, type RouteView
} from '../economy/EconomyMetrics';
import { economicAlerts } from '../economy/EconomyDiagnostics';
import {
  buildOverview, buildGoods, buildGoodInspector, buildProduction,
  buildTrade, buildRouteDetail, buildCities, buildRealms
} from '../economy/EconomyTabs';
import { GOODS, isGoodId, type GoodId } from '../../civ/Goods';
import type { Child } from '../core/Dom';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

/** What the tab builders are allowed to ask of the game. */
export interface EconomyScreenHost {
  readonly ctx: GameContext;
  /** The range the price chart is showing. */
  readonly priceRange: PriceRange;

  /** Opens the deep-dive on one good, from anywhere. */
  inspectGood(good: GoodId): void;
  closeInspector(): void;
  /** Opens one route's economics. */
  selectRoute(route: RouteView): void;
  closeRoute(): void;

  setCategory(category: GoodCategory): void;
  setPriceRange(range: PriceRange): void;

  /** Opens the UI-3 city dossier. */
  openCity(cityId: string): void;
  /** Opens the UI-4 realm dossier. */
  openRealm(kingdomId: string): void;
  /** Closes the screen and centres the camera. */
  goToMap(x: number, y: number, zoom?: number): void;

  /** One realm's own price for a good, anchored to the world price. */
  localPrice(kingdomId: string, good: GoodId, worldPrice: number): number;
}

export type PriceRange = 'recent' | 'medium' | 'long';

type EconomyTab = 'overview' | 'goods' | 'production' | 'trade' | 'cities' | 'realms';

const ALL_TABS: EconomyTab[] = ['overview', 'goods', 'production', 'trade', 'cities', 'realms'];

export class EconomyScreen implements Screen, EconomyScreenHost {
  public readonly id = 'economy' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  public ctx!: GameContext;
  public priceRange: PriceRange = 'recent';

  private tab: EconomyTab = 'overview';
  private selectedGood: GoodId | null = null;
  private selectedRoute: RouteView | null = null;
  private category: GoodCategory = 'all';
  private query = '';

  private strip: TabStrip | null = null;
  private shell: { root: HTMLElement; body: HTMLElement; setContent(c: Child[]): void } | null = null;
  private metricsCache = new EconomyMetricsCache();
  private renderedYear = -1;

  // ============================ SCREEN ============================

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;

    // Arriving from a link. Absent params mean the player came back on their own,
    // so whatever they were looking at last is left alone.
    if (params?.tab && this.isTab(params.tab)) {
      this.tab = params.tab;
      this.selectedGood = null;
      this.selectedRoute = null;
    }
    if (params?.good) {
      if (isGoodId(params.good)) {
        this.tab = 'goods';
        this.selectedGood = params.good;
        this.selectedRoute = null;
      } else {
        console.warn(`Economy screen asked to inspect unknown good "${params.good}"`);
      }
    }

    const metrics = this.metricsCache.get(ctx, performance.now());

    const shell = screenShell({
      title: 'Inteligência econômica',
      subtitle: this.subtitleFor(metrics),
      icon: 'economy',
      onClose: () => ctx.screens.back(),
      width: 'wide',
      actions: [
        // One search box for the whole screen: it filters goods, cities or realms
        // depending on which tab is open, which is what "search" means here.
        searchInput({
          placeholder: this.searchPlaceholder(),
          value: this.query,
          onInput: value => {
            this.query = value;
            this.renderTab();
          }
        })
      ]
    });
    this.shell = shell;
    shell.root.classList.add('ae-econ-screen');

    this.strip = tabs(this.tabItems(metrics), this.tab, id => {
      this.tab = id as EconomyTab;
      this.selectedGood = null;
      this.selectedRoute = null;
      this.query = '';
      this.renderTab();
    });
    shell.root.insertBefore(this.strip.root, shell.body);

    this.renderTab();
    return shell.root;
  }

  /**
   * Rebuilt on a slow cadence while open.
   *
   * The metrics cache decides whether anything is recomputed; this only decides
   * when to redraw. Both are far slower than the frame rate on purpose — prices
   * settle once a year and the ledgers roll over with them.
   */
  public tick(ctx: GameContext): void {
    if (!this.shell) return;
    const metrics = this.metricsCache.get(ctx, performance.now());
    if (metrics.year !== this.renderedYear) this.renderTab();
  }

  public dispose(): void {
    tooltip.hide();
    this.shell = null;
    this.strip = null;
  }

  // ============================ HEADER ============================

  private subtitleFor(m: EconomyMetrics): string {
    const alerts = economicAlerts(m, 5).length;
    const parts = [`Ano ${m.year}`, `${m.cities.length} assentamento(s)`, `${m.realms.length} reino(s)`];
    if (alerts) parts.push(`${alerts} alerta(s)`);
    return parts.join(' · ');
  }

  private searchPlaceholder(): string {
    switch (this.tab) {
      case 'goods': return 'Buscar bem…';
      case 'cities': return 'Buscar cidade ou reino…';
      case 'realms': return 'Buscar reino…';
      default: return 'Buscar…';
    }
  }

  // ============================ TABS ============================

  /**
   * The tab list, with empty tabs dropped.
   *
   * A stone-age world has no industry and no routes; showing two dead tabs is
   * worse than showing four live ones. The badge counts say what is behind each
   * one before it is clicked.
   */
  private tabItems(m: EconomyMetrics): TabItem[] {
    const alerts = economicAlerts(m, 5).length;
    const items: TabItem[] = [
      { id: 'overview', label: 'Visão geral', icon: 'economy', badge: alerts || undefined },
      { id: 'goods', label: 'Bens', icon: 'crate', badge: m.shortages.length || undefined }
    ];

    if (m.sectors.length) {
      items.push({
        id: 'production', label: 'Produção', icon: 'industry',
        badge: m.bottlenecks.length || undefined,
        tooltip: m.bottlenecks.length
          ? { title: 'Produção', description: `${m.bottlenecks.length} gargalo(s) de insumo` }
          : undefined
      });
    }
    if (m.routes.length) {
      items.push({
        id: 'trade', label: 'Comércio', icon: 'trade-route',
        badge: m.routes.length,
        tooltip: m.suspendedRoutes
          ? { title: 'Comércio', description: `${m.suspendedRoutes} rota(s) fechada(s)` }
          : undefined
      });
    }
    if (m.cities.length) items.push({ id: 'cities', label: 'Cidades', icon: 'city', badge: m.cities.length });
    if (m.realms.length) items.push({ id: 'realms', label: 'Reinos', icon: 'kingdom', badge: m.realms.length });

    return items;
  }

  private isTab(value: string): value is EconomyTab {
    return (ALL_TABS as string[]).includes(value);
  }

  private renderTab(): void {
    if (!this.shell) return;
    const metrics = this.metricsCache.get(this.ctx, performance.now());
    this.renderedYear = metrics.year;

    // A tab that was valid a year ago may have emptied out — a world can lose its
    // last route. Fall back rather than rendering a tab no longer offered.
    const available = this.tabItems(metrics).map(t => t.id);
    if (!available.includes(this.tab)) this.tab = 'overview';
    this.strip?.setActive(this.tab);

    if (!metrics.cities.length) {
      this.shell.setContent([emptyState({
        icon: 'economy',
        title: 'Nenhuma economia ainda',
        hint: 'Nenhum assentamento foi fundado. Não há produção, consumo nem comércio para relatar.'
      })]);
      return;
    }

    this.shell.setContent(this.contentFor(metrics));
    this.shell.body.scrollTop = 0;
  }

  private contentFor(m: EconomyMetrics): Child[] {
    // The two detail views take over the body wherever they were opened from, so
    // a good followed from a trade route lands on the good, not on the goods tab.
    if (this.selectedRoute) {
      // The route object is a snapshot; re-resolve it so a rebuilt cache does not
      // leave the panel showing a stale volume.
      const live = m.routes.find(r => r.route.id === this.selectedRoute!.route.id);
      if (!live) {
        return [emptyState({
          icon: 'trade-route',
          title: 'Esta rota não existe mais',
          hint: 'Foi fechada enquanto a tela estava aberta.',
          action: button('Voltar', () => this.closeRoute(), { variant: 'secondary', size: 'sm', icon: 'close' })
        })];
      }
      return buildRouteDetail(live, this);
    }

    if (this.selectedGood) return buildGoodInspector(this.selectedGood, m, this);

    switch (this.tab) {
      case 'overview': return buildOverview(m, this);
      case 'goods': return buildGoods(m, this, { category: this.category, query: this.query });
      case 'production': return buildProduction(m, this);
      case 'trade': return buildTrade(m, this);
      case 'cities': return buildCities(m, this, this.query);
      case 'realms': return buildRealms(m, this, this.query);
      default: return [];
    }
  }

  // ============================ HOST ============================

  public inspectGood(good: GoodId): void {
    this.selectedGood = good;
    this.selectedRoute = null;
    this.renderTab();
  }

  public closeInspector(): void {
    this.selectedGood = null;
    this.renderTab();
  }

  public selectRoute(route: RouteView): void {
    this.selectedRoute = route;
    this.selectedGood = null;
    this.renderTab();
  }

  public closeRoute(): void {
    this.selectedRoute = null;
    this.renderTab();
  }

  public setCategory(category: GoodCategory): void {
    this.category = category;
    this.renderTab();
  }

  public setPriceRange(range: PriceRange): void {
    this.priceRange = range;
    this.renderTab();
  }

  public openCity(cityId: string): void {
    this.ctx.screens.open('city', { cityId });
  }

  public openRealm(kingdomId: string): void {
    this.ctx.screens.open('realm', { focusKingdom: kingdomId });
  }

  public goToMap(x: number, y: number, zoom = 1.6): void {
    this.ctx.screens.closeAll();
    this.ctx.focusOn(x, y, zoom);
  }

  /**
   * A realm's own price for a good.
   *
   * Read live from its `LocalMarket` rather than cached with the rest: the
   * divergence between local and world price is the whole reason trade exists,
   * and it is cheap to ask.
   */
  public localPrice(kingdomId: string, good: GoodId, worldPrice: number): number {
    const kingdom = this.ctx.sim.kingdoms.get(kingdomId);
    return kingdom ? kingdom.economy.market.price(good, worldPrice) : worldPrice;
  }

  // ============================ NAVIGATION REGISTRY ============================

  /**
   * Teaches good references how to open.
   *
   * UI-0 built the registry and UI-2/UI-4 filled in citizens, cities, buildings
   * and realms. `good` was the one kind with no opener, so every goods link in
   * the game rendered inert. Registered from `main.ts` at startup.
   */
  public registerLinkNavigation(): void {
    objectNav.registerOpener('good', ref => {
      if (!isGoodId(ref.id)) return;
      this.ctx.screens.open('economy', { good: ref.id });
    });

    objectNav.registerDescriber('good', ref => {
      const def = isGoodId(ref.id) ? GOODS[ref.id] : null;
      return def ? { title: def.name, description: def.description } : null;
    });
  }
}
