/** Warfare Command Center + War Dossier 2.0 (UI-9). */
import { el, type Child } from '../core/Dom';
import { emptyState, screenShell, searchInput, tabs, tooltip, type TabItem, type TabStrip } from '../kit';
import { LogisticsMetricsCache } from '../logistics/LogisticsMetrics';
import {
  WarfareUISnapshotCache, warfareUIPerformance,
  type ArmyForceView, type WarfareUISnapshot, type WarView
} from '../warfare/WarfareMetrics';
import {
  buildActiveWars, buildArmies, buildBattles, buildHistory, buildMilitaryPower,
  buildOverview, buildWarDossier, type WarfareScreenHost
} from '../warfare/WarfareTabs';
import type { GoodId } from '../../civ/Goods';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

type WarfareTab = 'overview' | 'active-wars' | 'armies' | 'battles' | 'military-power' | 'history';
const ALL_TABS: WarfareTab[] = ['overview', 'active-wars', 'armies', 'battles', 'military-power', 'history'];

export class WarfareScreen implements Screen, WarfareScreenHost {
  public readonly id = 'warfare' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;
  public ctx!: GameContext;

  private tab: WarfareTab = 'overview';
  private selectedRealmId: string | null = null;
  private selectedWarId: string | null = null;
  private query = '';
  private shell: ReturnType<typeof screenShell> | null = null;
  private strip: TabStrip | null = null;
  private snapshotCache = new WarfareUISnapshotCache();
  private logisticsCache = new LogisticsMetricsCache();
  private renderedSignature = '';

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    const started = performance.now();
    this.ctx = ctx;
    if (params?.focusKingdom && ctx.sim.kingdoms.has(params.focusKingdom)) this.selectedRealmId = params.focusKingdom;
    if (params?.warId) this.selectedWarId = params.warId;
    if (params?.tab && this.isTab(params.tab)) this.tab = params.tab;

    const snapshot = this.snapshotFor();
    const selectedWar = this.resolveWar(snapshot);
    const items = this.tabItems(snapshot);
    if (!items.some(item => item.id === this.tab)) this.tab = 'overview';

    const shell = screenShell({
      title: selectedWar ? 'Dossiê de Guerra' : 'Centro de Comando Bélico',
      subtitle: selectedWar ? this.warSubtitle(selectedWar) : this.subtitle(snapshot),
      icon: 'war', width: 'wide', closeKind: selectedWar ? 'back' : 'close',
      onClose: () => selectedWar ? this.openWar('') : ctx.screens.back(),
      actions: selectedWar ? [] : [
        this.realmSelector(),
        searchInput({ placeholder: this.searchPlaceholder(), value: this.query, onInput: value => { this.query = value; this.renderContent(); } })
      ]
    });
    this.shell = shell;
    shell.root.classList.add('ae-warfare-screen');

    if (!selectedWar) {
      this.strip = tabs(items, this.tab, id => {
        this.tab = id as WarfareTab;
        this.query = '';
        this.renderContent();
      });
      shell.root.insertBefore(this.strip.root, shell.body);
    } else {
      this.strip = null;
      shell.root.style.setProperty('--ae-realm', selectedWar.attacker.color);
    }
    this.renderContent(snapshot);
    warfareUIPerformance.screenOpenMs = performance.now() - started;
    return shell.root;
  }

  public tick(): void {
    if (!this.shell) return;
    const started = performance.now();
    const snapshot = this.snapshotFor();
    if (this.snapshotSignature(snapshot) !== this.renderedSignature) this.renderContent(snapshot);
    warfareUIPerformance.updateMs = performance.now() - started;
  }

  public dispose(): void {
    tooltip.hide();
    this.shell = null;
    this.strip = null;
  }

  private snapshotFor(): WarfareUISnapshot {
    const now = performance.now();
    const logistics = this.logisticsCache.get(this.ctx, now);
    return this.snapshotCache.get(this.ctx, logistics, now);
  }

  private resolveWar(snapshot: WarfareUISnapshot): WarView | null {
    if (!this.selectedWarId) return null;
    const war = snapshot.allWars.find(item => item.record.id === this.selectedWarId) ?? null;
    if (!war) this.selectedWarId = null;
    return war;
  }

  private subtitle(snapshot: WarfareUISnapshot): string {
    const scope = this.selectedRealmId ? ctxName(this.ctx, this.selectedRealmId) : 'Todos os reinos';
    return `${scope} · Ano ${snapshot.year} · ${snapshot.activeWars.length} guerra(s) ativa(s) · ${snapshot.totalSoldiers} soldado(s) vivo(s)`;
  }

  private warSubtitle(war: WarView): string {
    return `${war.attacker.name} vs ${war.defender.name} · ${war.active ? 'ativo' : `encerrado em ${war.record.endYear}`} · início em ${war.record.startYear}`;
  }

  private tabItems(snapshot: WarfareUISnapshot): TabItem[] {
    const scopedWars = this.selectedRealmId
      ? snapshot.activeWars.filter(war => war.attacker.id === this.selectedRealmId || war.defender.id === this.selectedRealmId)
      : snapshot.activeWars;
    const scopedForces = this.selectedRealmId ? snapshot.forces.filter(force => force.kingdom.id === this.selectedRealmId) : snapshot.forces;
    const scopedEngagements = this.selectedRealmId ? snapshot.engagements.filter(item => item.participantIds.includes(this.selectedRealmId!)) : snapshot.engagements;
    const scopedHistory = this.selectedRealmId
      ? snapshot.history.filter(war => war.attacker.id === this.selectedRealmId || war.defender.id === this.selectedRealmId)
      : snapshot.history;
    const items: TabItem[] = [{ id: 'overview', label: 'Visão Geral', icon: 'statistics' }];
    if (scopedWars.length) items.push({ id: 'active-wars', label: 'Guerras Ativas', icon: 'war', badge: scopedWars.length });
    if (scopedForces.length) items.push({ id: 'armies', label: 'Exércitos', icon: 'army', badge: scopedForces.length });
    if (scopedEngagements.length) items.push({ id: 'battles', label: 'Batalhas', icon: 'battle', badge: scopedEngagements.length });
    if (snapshot.realms.length) items.push({ id: 'military-power', label: 'Poder Militar', icon: 'statistics' });
    if (scopedHistory.length) items.push({ id: 'history', label: 'Histórico', icon: 'history', badge: scopedHistory.length });
    return items;
  }

  private isTab(value: string): value is WarfareTab {
    return ALL_TABS.includes(value as WarfareTab);
  }

  private realmSelector(): HTMLElement {
    return el('select', {
      class: 'ae-war-realm-select', attrs: { 'aria-label': 'Filtro de reino militar' },
      on: { change: (event: Event) => {
        const id = (event.target as HTMLSelectElement).value;
        this.selectedRealmId = id && this.ctx.sim.kingdoms.has(id) ? id : null;
        this.tab = 'overview';
        this.query = '';
        this.snapshotCache.invalidate();
        this.ctx.screens.refresh();
      } }
    }, [
      el('option', { text: 'Todos os reinos', attrs: { value: '', selected: this.selectedRealmId === null } }),
      ...[...this.ctx.sim.kingdoms.values()].map(kingdom => el('option', {
        text: kingdom.name, attrs: { value: kingdom.id, selected: kingdom.id === this.selectedRealmId }
      }))
    ]) as HTMLSelectElement;
  }

  private searchPlaceholder(): string {
    if (this.tab === 'armies') return 'Reino, posição ou estado…';
    if (this.tab === 'military-power') return 'Buscar reino…';
    if (this.tab === 'history') return 'Reino ou motivo de guerra…';
    return 'Reino ou conflito ativo…';
  }

  /** Prevents the live cache cadence from resetting scroll when only positions drift. */
  private snapshotSignature(snapshot: WarfareUISnapshot): string {
    return [
      snapshot.year,
      ...snapshot.activeWars.map(war => `${war.record.id}:${war.record.battles}:${war.battlefieldCasualties}:${war.sieges.length}:${war.engagements.length}:${war.cities.map(city => `${city.id}:${city.status}`).join(',')}`),
      ...snapshot.forces.map(force => `${force.id}:${force.soldiers}:${force.status}:${Math.round(force.meanHp * 100)}`),
      `history:${snapshot.history.length}`
    ].join('|');
  }

  private renderContent(existing?: WarfareUISnapshot): void {
    if (!this.shell) return;
    const started = performance.now();
    const snapshot = existing ?? this.snapshotFor();
    this.renderedSignature = this.snapshotSignature(snapshot);
    const war = this.resolveWar(snapshot);
    let content: Child[];
    if (war) content = buildWarDossier(war, this);
    else {
      this.strip?.setActive(this.tab);
      switch (this.tab) {
        case 'overview': content = buildOverview(snapshot, this, this.selectedRealmId); break;
        case 'active-wars': content = buildActiveWars(snapshot, this, this.selectedRealmId, this.query); break;
        case 'armies': content = buildArmies(snapshot, this, this.selectedRealmId, this.query); break;
        case 'battles': content = buildBattles(snapshot, this, this.selectedRealmId); break;
        case 'military-power': content = buildMilitaryPower(snapshot, this, this.selectedRealmId, this.query); break;
        case 'history': content = buildHistory(snapshot, this, this.selectedRealmId, this.query); break;
      }
    }
    if (!content.length) content = [emptyState({ icon: 'war', title: 'Nada para mostrar nesta visão' })];
    this.shell.setContent(content);
    warfareUIPerformance.updateMs = performance.now() - started;
  }

  // ============================ HOST NAVIGATION ============================

  public openWar(warId: string): void {
    this.selectedWarId = warId || null;
    this.query = '';
    this.ctx.screens.refresh();
  }

  public openRealm(kingdomId: string): void {
    if (this.ctx.sim.kingdoms.has(kingdomId)) this.ctx.screens.open('realm', { focusKingdom: kingdomId });
  }

  public openCity(cityId: string): void {
    if (this.ctx.sim.cities.has(cityId)) this.ctx.screens.open('city', { cityId });
  }

  public openGood(good: GoodId): void {
    this.ctx.screens.open('economy', { good });
  }

  public openInfrastructure(params: { routeId?: string; cityId?: string; tab?: string } = {}): void {
    this.ctx.screens.open('infrastructure', params);
  }

  public openPolitics(kingdomId: string): void {
    if (this.ctx.sim.kingdoms.has(kingdomId)) this.ctx.screens.open('politics', { focusKingdom: kingdomId });
  }

  public openTechnology(kingdomId: string, techId?: string | null): void {
    if (this.ctx.sim.kingdoms.has(kingdomId)) this.ctx.screens.open('techtree', { focusKingdom: kingdomId, techId: techId ?? undefined });
  }

  public openChronicle(): void {
    this.ctx.screens.open('chronicle');
  }

  public viewWarOnMap(war: WarView): void {
    this.ctx.overlays.setWarFocus({
      warId: war.record.id,
      participantIds: [war.attacker.id, war.defender.id, ...war.allies.map(ally => ally.kingdom.id)],
      entityIds: [...(war.attackerForce?.combatantIds ?? []), ...(war.defenderForce?.combatantIds ?? [])],
      cityIds: war.cities.map(city => city.id),
      points: [
        ...war.engagements.map(item => ({ x: item.x, y: item.y, kind: 'engagement' as const })),
        ...war.sieges.map(item => ({ x: item.x, y: item.y, kind: 'siege' as const })),
        ...war.infrastructure.damagedRailLines.map(item => ({ x: item.at.x, y: item.at.y, kind: 'infrastructure' as const })),
        ...war.infrastructure.disruptedPorts.map(item => ({ x: item.x, y: item.y, kind: 'infrastructure' as const }))
      ]
    });
    this.ctx.focusOn(war.mapFocus.x, war.mapFocus.y, 1.25);
    this.ctx.screens.closeAll();
  }

  public viewPointOnMap(x: number, y: number): void {
    this.ctx.focusOn(x, y, 1.6);
    this.ctx.screens.closeAll();
  }

  public followForce(force: ArmyForceView): void {
    this.ctx.overlays.setWarFocus({
      warId: force.warIds[0] ?? null,
      participantIds: [force.kingdom.id],
      entityIds: force.combatantIds,
      cityIds: force.objective ? [force.objective.cityId] : [],
      points: [{ x: force.x, y: force.y, kind: 'force' }]
    });
    this.ctx.trackEntity(force.representativeId);
    this.ctx.focusOn(force.x, force.y, 1.8);
    this.ctx.screens.closeAll();
  }
}

function ctxName(ctx: GameContext, kingdomId: string): string {
  return ctx.sim.kingdoms.get(kingdomId)?.name ?? kingdomId;
}
