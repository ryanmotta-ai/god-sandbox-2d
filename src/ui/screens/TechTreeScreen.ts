/** Technology Command Center 2.0 (UI-8). */
import { el, type Child } from '../core/Dom';
import {
  emptyState, filterGroup, screenShell, searchInput, tabs, tooltip,
  type TabItem, type TabStrip
} from '../kit';
import { TECHNOLOGIES } from '../../civ/TechTree';
import { isGoodId, type GoodId } from '../../civ/Goods';
import { EconomyMetricsCache, type EconomyMetrics } from '../economy/EconomyMetrics';
import { LogisticsMetricsCache, type LogisticsMetrics } from '../logistics/LogisticsMetrics';
import {
  TechnologyUISnapshotCache, technologyUIPerformance, type TechnologyUISnapshot
} from '../technology/TechnologyMetrics';
import {
  buildCapabilities, buildHistory, buildImpact, buildOverview, buildResearch, buildTree,
  type TechStatusFilter, type TechTrackFilter, type TechnologyScreenHost
} from '../technology/TechnologyTabs';
import { technologicalBottlenecks } from '../technology/TechnologyDiagnostics';
import type { Kingdom } from '../../civ/Kingdom';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

type TechnologyTab = 'overview' | 'tree' | 'research' | 'capabilities' | 'impact' | 'history';
const ALL_TABS: TechnologyTab[] = ['overview', 'tree', 'research', 'capabilities', 'impact', 'history'];

export class TechTreeScreen implements Screen, TechnologyScreenHost {
  public readonly id = 'techtree' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  public ctx!: GameContext;

  private tab: TechnologyTab = 'overview';
  private selectedKingdomId: string | null = null;
  private selectedTechId: string | null = null;
  private query = '';
  private statusFilter: TechStatusFilter = 'all';
  private trackFilter: TechTrackFilter = 'all';
  private strip: TabStrip | null = null;
  private shell: ReturnType<typeof screenShell> | null = null;
  private snapshotCache = new TechnologyUISnapshotCache();
  private logisticsCache = new LogisticsMetricsCache();
  private economyCache = new EconomyMetricsCache();
  private renderedYear = -1;

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    const started = performance.now();
    this.ctx = ctx;
    if (params?.focusKingdom && ctx.sim.kingdoms.has(params.focusKingdom)) this.selectedKingdomId = params.focusKingdom;
    if (params?.techId && TECHNOLOGIES[params.techId]) {
      this.selectedTechId = params.techId;
      this.tab = params.tab && this.isTab(params.tab) ? params.tab : 'tree';
    } else if (params?.tab && this.isTab(params.tab)) {
      this.tab = params.tab;
    }

    const kingdom = this.resolveKingdom();
    const snapshot = kingdom ? this.snapshotFor(kingdom) : null;
    const shell = screenShell({
      title: 'Centro de Comando Tecnológico',
      subtitle: snapshot ? this.subtitle(snapshot) : 'Nenhum reino sobrevivente para analisar',
      icon: 'technology',
      onClose: () => ctx.screens.back(),
      width: 'wide',
      actions: [
        this.kingdomSelector(kingdom),
        searchInput({
          placeholder: this.searchPlaceholder(),
          value: this.query,
          onInput: value => { this.query = value; this.renderTab(); }
        })
      ]
    });
    this.shell = shell;
    shell.root.classList.add('ae-tech-screen');
    if (snapshot) shell.root.style.setProperty('--ae-realm', snapshot.kingdomColor);

    if (snapshot) {
      this.strip = tabs(this.tabItems(snapshot), this.tab, id => {
        this.tab = id as TechnologyTab;
        this.query = '';
        if (this.tab !== 'tree') {
          this.statusFilter = 'all';
          this.trackFilter = 'all';
        }
        this.renderTab();
      });
      shell.root.insertBefore(this.strip.root, shell.body);
    } else {
      this.strip = null;
    }
    this.renderTab();
    technologyUIPerformance.screenOpenMs = performance.now() - started;
    return shell.root;
  }

  public tick(ctx: GameContext): void {
    if (!this.shell) return;
    const started = performance.now();
    const kingdom = this.resolveKingdom();
    if (!kingdom) {
      if (this.renderedYear !== -2) {
        this.renderedYear = -2;
        this.shell.setContent([emptyState({
          icon: 'kingdom', title: 'O reino analisado deixou de existir',
          hint: 'Feche a tela ou selecione outro reino quando um estiver disponível.'
        })]);
      }
      technologyUIPerformance.updateMs = performance.now() - started;
      return;
    }
    const snapshot = this.snapshotFor(kingdom);
    if (snapshot.year !== this.renderedYear) this.renderTab();
    technologyUIPerformance.updateMs = performance.now() - started;
  }

  public dispose(): void {
    tooltip.hide();
    this.shell = null;
    this.strip = null;
  }

  private resolveKingdom(): Kingdom | null {
    if (this.selectedKingdomId) {
      const selected = this.ctx.sim.kingdoms.get(this.selectedKingdomId);
      if (selected) return selected;
    }
    const first = this.ctx.sim.kingdoms.values().next().value as Kingdom | undefined;
    this.selectedKingdomId = first?.id ?? null;
    return first ?? null;
  }

  private snapshotFor(kingdom: Kingdom): TechnologyUISnapshot {
    const now = performance.now();
    const logistics = this.logisticsCache.get(this.ctx, now);
    return this.snapshotCache.get(kingdom, this.ctx, logistics, now);
  }

  private subtitle(snapshot: TechnologyUISnapshot): string {
    const parts = [
      snapshot.kingdomName,
      `Ano ${snapshot.year}`,
      `${snapshot.knownCount}/${snapshot.totalCount} descobertas`,
      `${snapshot.available.length} disponíveis`
    ];
    if (snapshot.current) parts.push(`pesquisando ${snapshot.current.definition.name}`);
    return parts.join(' · ');
  }

  private searchPlaceholder(): string {
    switch (this.tab) {
      case 'tree': return 'Tecnologia, edifício ou bem…';
      case 'research': return 'Pesquisar opções disponíveis…';
      case 'capabilities': return 'Tecnologia, recurso ou indústria…';
      case 'impact': return 'Pesquisar impactos…';
      default: return 'Pesquisar tecnologia…';
    }
  }

  private isTab(value: string): value is TechnologyTab {
    return ALL_TABS.includes(value as TechnologyTab);
  }

  private kingdomSelector(current: Kingdom | null): HTMLElement {
    const select = el('select', {
      class: 'ae-tech-kingdom-select',
      attrs: { 'aria-label': 'Reino analisado' },
      on: {
        change: (event: Event) => {
          const id = (event.target as HTMLSelectElement).value;
          if (!this.ctx.sim.kingdoms.has(id)) return;
          this.selectedKingdomId = id;
          this.selectedTechId = null;
          this.snapshotCache.invalidate();
          this.ctx.screens.refresh();
        }
      }
    }, [...this.ctx.sim.kingdoms.values()].map(kingdom => el('option', {
      text: kingdom.name,
      attrs: { value: kingdom.id, selected: kingdom.id === current?.id }
    }))) as HTMLSelectElement;
    return select;
  }

  private tabItems(snapshot: TechnologyUISnapshot): TabItem[] {
    const bottlenecks = technologicalBottlenecks(snapshot).length;
    return [
      { id: 'overview', label: 'Visão Geral', icon: 'statistics', badge: bottlenecks || undefined },
      { id: 'tree', label: 'Árvore Tech', icon: 'technology' },
      { id: 'research', label: 'Pesquisa', icon: 'flask', badge: snapshot.available.length || undefined },
      { id: 'capabilities', label: 'Capacidades', icon: 'industry', badge: bottlenecks || undefined },
      { id: 'impact', label: 'Impacto Tech', icon: 'trend' },
      { id: 'history', label: 'Histórico', icon: 'history', badge: snapshot.history.length || undefined }
    ];
  }

  private renderTab(): void {
    const kingdom = this.resolveKingdom();
    if (!this.shell || !kingdom) {
      this.shell?.setContent([emptyState({
        icon: 'kingdom', title: 'Nenhum reino disponível',
        hint: 'A tecnologia só pode ser analisada para uma civilização existente.'
      })]);
      return;
    }
    const snapshot = this.snapshotFor(kingdom);
    this.renderedYear = snapshot.year;
    this.strip?.setActive(this.tab);
    let content: Child[];
    switch (this.tab) {
      case 'overview': content = buildOverview(snapshot, this); break;
      case 'tree': content = [this.treeFilters(snapshot), ...buildTree(
        snapshot, this, this.selectedTechId, this.query, this.statusFilter, this.trackFilter
      )]; break;
      case 'research': content = buildResearch(snapshot, this, this.query); break;
      case 'capabilities': content = buildCapabilities(snapshot, this, this.query, this.selectedTechId); break;
      case 'impact': content = buildImpact(snapshot, this, this.query); break;
      case 'history': content = buildHistory(snapshot, this); break;
    }
    this.shell.setContent(content);
  }

  private treeFilters(snapshot: TechnologyUISnapshot): HTMLElement {
    const status = filterGroup<TechStatusFilter>([
      { id: 'all', label: 'Todos', count: snapshot.technologies.length },
      { id: 'discovered', label: 'Descobertas', count: snapshot.technologies.filter(view => view.status === 'discovered').length, status: 'positive' },
      { id: 'researching', label: 'Pesquisando', count: snapshot.current ? 1 : 0, status: 'neutral' },
      { id: 'available', label: 'Disponíveis', count: snapshot.available.length, status: 'neutral' },
      { id: 'locked', label: 'Bloqueadas', count: snapshot.technologies.filter(view => view.status === 'locked').length, status: 'neutral' }
    ], this.statusFilter, id => { this.statusFilter = id; this.renderTab(); });
    const track = filterGroup<TechTrackFilter>([
      { id: 'all', label: 'Ambas trilhas' },
      { id: 'craft', label: 'Ofício e Ciência' },
      { id: 'politics', label: 'Política e Sociedade' }
    ], this.trackFilter, id => { this.trackFilter = id; this.renderTab(); });
    return el('div', { class: 'ae-tech-tree-filters' }, [status.root, track.root]);
  }

  // ============================ HOST NAVIGATION ============================

  public inspectTechnology(techId: string, tab: 'tree' | 'capabilities' | 'impact' = 'tree'): void {
    if (!TECHNOLOGIES[techId]) return;
    this.selectedTechId = techId;
    this.tab = tab;
    this.query = '';
    this.renderTab();
  }

  public openGood(good: GoodId): void {
    if (!isGoodId(good)) return;
    this.ctx.screens.open('economy', { good });
  }

  public openCity(cityId: string): void {
    if (!this.ctx.sim.cities.has(cityId)) return;
    this.ctx.screens.open('city', { cityId });
  }

  public openRealm(kingdomId: string): void {
    if (!this.ctx.sim.kingdoms.has(kingdomId)) return;
    this.ctx.screens.open('realm', { focusKingdom: kingdomId });
  }

  public openInfrastructure(cityId?: string): void {
    this.ctx.screens.open('infrastructure', { tab: cityId ? 'cities' : 'networks', cityId });
  }

  public openChronicle(): void {
    this.ctx.screens.open('chronicle');
  }

  public economyMetrics(): EconomyMetrics {
    return this.economyCache.get(this.ctx, performance.now());
  }
}
