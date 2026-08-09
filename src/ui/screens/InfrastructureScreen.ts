/**
 * The infrastructure and logistics command centre.
 *
 * The question it answers is *how are goods moving, where are the bottlenecks,
 * and who suffers if this stops*. That last clause is the point of the phase: a
 * damaged rail is not a finding, it is the first line of a chain that ends in a
 * forge with no coal — so the overview opens on bottlenecks with their causal
 * chains attached, and the network detail comes after.
 *
 * One absence shapes the whole screen and is said out loud wherever it matters:
 * **there are no trains.** `RailwayNetwork.tickFreight` transfers stock directly
 * between stations on a connected line; nothing physical rides the rails. The
 * movers that do exist are caravans and ships, and both carry a real cargo, a
 * real amount and a real position — so those are what the player can follow.
 *
 * Everything runs behind `LogisticsMetricsCache`. The snapshot sweeps the whole
 * tile grid and walks every rail component; it must never run per frame.
 */
import { el } from '../core/Dom';
import {
  screenShell, tabs, button, searchInput, emptyState, tooltip,
  type TabStrip, type TabItem
} from '../kit';
import { LogisticsMetricsCache, type LogisticsMetrics, type RouteView, type CorridorView } from '../logistics/LogisticsMetrics';
import { diagnoseLogistics, logisticsProblems } from '../logistics/LogisticsDiagnostics';
import {
  buildOverview, buildNetworks, buildPorts, buildCorridors, buildCorridorDetail,
  buildMovers, buildCityAccessTab
} from '../logistics/LogisticsTabs';
import type { Child } from '../core/Dom';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';
import type { GoodId } from '../../civ/Goods';

/** What the tab builders are allowed to ask of the game. */
export interface LogisticsScreenHost {
  readonly ctx: GameContext;

  /** Opens a good in the UI-5 economy screen. */
  openGood(good: GoodId): void;
  /** Opens the UI-3 city dossier. */
  openCity(cityId: string): void;
  /** Opens the UI-4 realm dossier. */
  openRealm(kingdomId: string): void;
  /** Closes the screen and centres the camera. */
  goToMap(x: number, y: number, zoom?: number): void;
  /** Frames a route by centring between its two ends. */
  goToRoute(route: RouteView): void;
  goToCorridor(corridor: CorridorView): void;

  focusPort(cityId: string | null): void;
  focusCorridor(id: string | null): void;
  setNetworkFilter(id: string): void;
  setStatusFilter(id: string): void;

  /**
   * Asks for a map overlay. UI-10 owns the overlay experience; today this only
   * hands the map back, and says so rather than pretending to draw one.
   */
  requestOverlay(kind: 'roads' | 'rail' | 'routes' | 'ports'): void;
}

type TabId = 'overview' | 'networks' | 'ports' | 'corridors' | 'movers' | 'cities';

const ALL_TABS: TabId[] = ['overview', 'networks', 'ports', 'corridors', 'movers', 'cities'];

export class InfrastructureScreen implements Screen, LogisticsScreenHost {
  public readonly id = 'infrastructure' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  public ctx!: GameContext;

  private tab: TabId = 'overview';
  private focusedPort: string | null = null;
  private focusedCorridor: string | null = null;
  private networkFilter = 'all';
  private statusFilter = 'all';
  private query = '';

  private strip: TabStrip | null = null;
  private shell: { root: HTMLElement; body: HTMLElement; setContent(c: Child[]): void } | null = null;
  private metricsCache = new LogisticsMetricsCache();
  private renderedYear = -1;
  private highlight: string | null = null;

  // ============================ SCREEN ============================

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;

    if (params?.tab && this.isTab(params.tab)) {
      this.tab = params.tab;
      this.focusedPort = null;
      this.focusedCorridor = null;
    }
    // An alert about a route lands on the corridor that carries it.
    if (params?.routeId) {
      const metrics = this.metricsCache.get(ctx, performance.now());
      const corridor = metrics.corridors.find(c => c.routes.some(r => r.route.id === params.routeId));
      if (corridor) {
        this.tab = 'corridors';
        this.focusedCorridor = corridor.id;
      }
    }
    if (params?.cityId) {
      const metrics = this.metricsCache.get(ctx, performance.now());
      if (metrics.ports.some(p => p.cityId === params.cityId)) {
        this.tab = 'ports';
        this.focusedPort = params.cityId;
      }
    }
    this.highlight = params?.highlightCondition ?? null;

    const metrics = this.metricsCache.get(ctx, performance.now());

    const shell = screenShell({
      title: 'Infraestrutura e logística',
      subtitle: this.subtitleFor(metrics),
      icon: 'trade-route',
      onClose: () => ctx.screens.back(),
      width: 'wide',
      actions: [
        searchInput({
          placeholder: this.searchPlaceholder(),
          value: this.query,
          onInput: value => { this.query = value; this.renderTab(); }
        })
      ]
    });
    this.shell = shell;
    shell.root.classList.add('ae-log-screen');

    this.strip = tabs(this.tabItems(metrics), this.tab, id => {
      this.tab = id as TabId;
      this.focusedPort = null;
      this.focusedCorridor = null;
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
   * The cache decides whether anything is recomputed; this only decides when to
   * redraw. Both are far slower than the frame rate on purpose — freight settles
   * once a year and the tile sweep is the most expensive read in the interface.
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

  private subtitleFor(m: LogisticsMetrics): string {
    const problems = logisticsProblems(diagnoseLogistics(m)).length;
    const parts = [`Ano ${m.year}`];
    if (m.routes.length) parts.push(`${m.activeRoutes} rota(s) ativa(s)`);
    if (m.bottlenecks.length) parts.push(`${m.bottlenecks.length} gargalo(s)`);
    else if (problems) parts.push(`${problems} condição(ões) fora do normal`);
    return parts.join(' · ');
  }

  private searchPlaceholder(): string {
    switch (this.tab) {
      case 'corridors': return 'Buscar corredor…';
      case 'cities': return 'Buscar assentamento ou reino…';
      default: return 'Buscar…';
    }
  }

  // ============================ TABS ============================

  /**
   * The tab list, with empty tabs dropped.
   *
   * A stone-age world has no rail, no ports and no routes. Four dead tabs is
   * worse than two live ones, and the badge counts say what is behind each one.
   */
  private tabItems(m: LogisticsMetrics): TabItem[] {
    const items: TabItem[] = [
      { id: 'overview', label: 'Visão geral', icon: 'trade-route', badge: m.bottlenecks.length || undefined }
    ];

    if (m.roads.tiles > 0 || m.rail.tiles > 0 || m.ports.length) {
      items.push({
        id: 'networks', label: 'Redes', icon: 'route',
        badge: (m.roads.damagedTiles + m.rail.severedTiles) || undefined,
        tooltip: m.rail.severedTiles
          ? { title: 'Redes', description: `${m.rail.severedTiles} trecho(s) ferroviário(s) rompido(s)` }
          : undefined
      });
    }
    if (m.ports.length) {
      items.push({
        id: 'ports', label: 'Portos', icon: 'route', badge: m.ports.length,
        tooltip: m.ports.some(p => !p.operational)
          ? { title: 'Portos', description: `${m.ports.filter(p => !p.operational).length} inoperante(s)` }
          : undefined
      });
    }
    if (m.corridors.length) {
      items.push({ id: 'corridors', label: 'Corredores', icon: 'trade-route', badge: m.corridors.length });
    }
    if (m.movers.length) {
      items.push({ id: 'movers', label: 'Comboios', icon: 'route', badge: m.movers.length });
    }
    if (m.cities.length) {
      items.push({
        id: 'cities', label: 'Acesso', icon: 'city',
        badge: m.cities.filter(c => c.isolated).length || undefined
      });
    }

    return items;
  }

  private isTab(value: string): value is TabId {
    return (ALL_TABS as string[]).includes(value);
  }

  private renderTab(): void {
    if (!this.shell) return;
    const metrics = this.metricsCache.get(this.ctx, performance.now());
    this.renderedYear = metrics.year;

    const available = this.tabItems(metrics).map(t => t.id);
    if (!available.includes(this.tab)) this.tab = 'overview';
    this.strip?.setActive(this.tab);

    this.shell.setContent(this.contentFor(metrics));
    this.applyHighlight();
  }

  private contentFor(m: LogisticsMetrics): Child[] {
    if (this.focusedCorridor) {
      const corridor = m.corridors.find(c => c.id === this.focusedCorridor);
      if (!corridor) {
        return [emptyState({
          icon: 'trade-route',
          title: 'Este corredor não existe mais',
          hint: 'As rotas que o formavam foram fechadas ou os assentamentos deixaram de existir.',
          action: button('Voltar', () => this.focusCorridor(null), { variant: 'secondary', size: 'sm', icon: 'close' })
        })];
      }
      return buildCorridorDetail(corridor, this);
    }

    const filters = { network: this.networkFilter, status: this.statusFilter, query: this.query };

    switch (this.tab) {
      case 'overview': return buildOverview(m, this);
      case 'networks': return buildNetworks(m, this);
      case 'ports': return buildPorts(m, this, this.focusedPort);
      case 'corridors': return buildCorridors(m, this, filters);
      case 'movers': return buildMovers(m, this);
      case 'cities': return buildCityAccessTab(m, this, this.query);
      default: return [];
    }
  }

  /** Draws the eye to one condition, for an alert deep link. Self-expiring. */
  private applyHighlight(): void {
    if (!this.highlight || !this.shell) return;
    const target = this.shell.body.querySelector<HTMLElement>(`[data-condition-id="${this.highlight}"]`);
    this.highlight = null;
    if (!target) return;
    target.classList.add('ae-log-condition-flash');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => target.classList.remove('ae-log-condition-flash'), 2400);
  }

  // ============================ HOST ============================

  public openGood(good: GoodId): void {
    this.ctx.screens.open('economy', { good });
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
   * Frames a route by centring between its two ends and pulling back.
   *
   * Uses the existing camera rather than a second one, and the zoom is derived
   * from the route's own length so a short haul is not framed like a continent.
   */
  public goToRoute(route: RouteView): void {
    if (!route.fromCity || !route.toCity) {
      const only = route.fromCity ?? route.toCity;
      if (only) this.goToMap(only.x, only.y);
      return;
    }
    const midX = (route.fromCity.x + route.toCity.x) / 2;
    const midY = (route.fromCity.y + route.toCity.y) / 2;
    this.goToMap(midX, midY, zoomForSpan(route.distance));
  }

  public goToCorridor(corridor: CorridorView): void {
    const from = this.ctx.sim.cities.get(corridor.fromCityId);
    const to = this.ctx.sim.cities.get(corridor.toCityId);
    if (!from || !to) {
      const only = from ?? to;
      if (only) this.goToMap(only.x, only.y);
      return;
    }
    const span = Math.hypot(from.x - to.x, from.y - to.y);
    this.goToMap((from.x + to.x) / 2, (from.y + to.y) / 2, zoomForSpan(span));
  }

  public focusPort(cityId: string | null): void {
    this.focusedPort = cityId;
    if (cityId && this.tab !== 'ports') {
      this.tab = 'ports';
      this.strip?.setActive(this.tab);
    }
    this.renderTab();
  }

  public focusCorridor(id: string | null): void {
    this.focusedCorridor = id;
    if (id && this.tab !== 'corridors') {
      this.tab = 'corridors';
      this.strip?.setActive(this.tab);
    }
    this.renderTab();
  }

  public setNetworkFilter(id: string): void {
    this.networkFilter = id;
    this.renderTab();
  }

  public setStatusFilter(id: string): void {
    this.statusFilter = id;
    this.renderTab();
  }

  /**
   * The overlay hook.
   *
   * UI-10 owns the overlay experience. Today the renderer has no road-traffic or
   * route overlay to switch to, so this hands the map back rather than pretending
   * to draw one — and the button that calls it says exactly that in its tooltip.
   */
  public requestOverlay(kind: 'roads' | 'rail' | 'routes' | 'ports'): void {
    const layers = kind === 'routes' ? ['trade'] as const : [kind] as const;
    this.ctx.overlays.open({ mode: 'none', layers: [...layers] });
    this.ctx.screens.closeAll();
  }
}

/** A zoom that frames a span of tiles without guessing at the camera's limits. */
function zoomForSpan(span: number): number {
  if (span <= 12) return 2;
  if (span <= 30) return 1.2;
  if (span <= 60) return 0.8;
  return 0.6;
}
