/**
 * The in-game interface, assembled.
 *
 * UI-1 turned this file from a builder into a composition root. It used to
 * construct a top bar, a time cockpit and a ten-button dock inline — some 250
 * lines of DOM plus its own update logic — which is why those three surfaces
 * drifted apart and why none of them could be changed without touching the
 * others. Each is now its own module, and this class does three things: owns
 * them, routes between them, and runs one update per frame.
 *
 * The permanent furniture is deliberately short: a top bar, a small tool dock,
 * and the minimap. Everything else — selection card, alerts, event feed, powers
 * palette, inspector — appears because something happened, and leaves when it is
 * done. That is the whole "map first, information on demand" principle, expressed
 * as a list of children.
 */
import { el, clear } from '../core/Dom';
import { settings } from '../core/Settings';
import { sound } from '../../core/SoundSynth';
import { DisasterSystem } from '../../powers/Disasters';
import { Toolbar } from './Toolbar';
import { Inspector } from '../inspector/Inspector';
import { Minimap } from './Minimap';
import { TopBar } from './TopBar';
import { ToolDock } from './ToolDock';
import { SelectionCard } from './SelectionCard';
import { AlertFeed, EventFeed } from './Feeds';
import { alerts } from '../core/Alerts';
import { TICKS_PER_DAY } from '../../ai/EntityAI';
import { describeCity } from '../../civ/UrbanPlanner';
import { icon } from '../kit';
import type { OverlayMode } from '../../renderer/Overlays';
import type { GameContext } from '../core/GameContext';

/** Overlay cycle order for the V shortcut. */
const OVERLAY_CYCLE: { id: OverlayMode; label: string }[] = [
  { id: 'none', label: 'Natural' },
  { id: 'political', label: 'Político' },
  { id: 'population', label: 'População' },
  { id: 'biome', label: 'Biomas' },
  { id: 'temperature', label: 'Clima' },
  { id: 'resources', label: 'Recursos' }
];

/** How often a live selection re-reads the world. Years, not frames. */
const SELECTION_REFRESH_MS = 600;

export class HUD {
  public readonly root: HTMLElement;
  public readonly toolbar: Toolbar;
  public readonly inspector: Inspector;
  public readonly minimap: Minimap;
  public readonly topBar: TopBar;
  public readonly toolDock: ToolDock;
  public readonly selectionCard: SelectionCard;

  private ctx: GameContext;
  private alertFeed: AlertFeed;
  private eventFeed: EventFeed;
  private debugPanel!: HTMLElement;
  private debugEls: Record<string, HTMLElement> = {};
  private hiddenByPlayer = false;
  private lastSelectionRefresh = 0;

  constructor(ctx: GameContext, root: HTMLElement) {
    this.ctx = ctx;
    this.root = root;

    this.toolbar = new Toolbar(ctx);
    this.inspector = new Inspector(ctx);
    this.minimap = new Minimap();
    this.minimap.attach(ctx);

    this.topBar = new TopBar(ctx, () => ctx.screens.open('pause'));
    this.toolDock = new ToolDock(ctx, () => this.toolbar.toggle());

    this.selectionCard = new SelectionCard({
      // The inspector renders whatever is selected, so "inspect this" is simply
      // "open the panel" — there is nothing to hand over.
      onInspect: () => this.inspector.show(),
      onFocus: view => ctx.focusOn(view.worldPos.x, view.worldPos.y),
      onClose: () => ctx.selection.clear()
    });

    const goTo = (target: Parameters<HUD['goTo']>[0]) => this.goTo(target);
    this.alertFeed = new AlertFeed(alerts, {
      onGoTo: goTo,
      onDismiss: id => alerts.dismiss(id),
      onDismissAll: () => alerts.dismissAll()
    });
    this.eventFeed = new EventFeed(alerts, goTo);

    clear(root);
    root.appendChild(this.topBar.root);
    root.appendChild(this.toolDock.root);
    root.appendChild(this.selectionCard.root);
    root.appendChild(this.alertFeed.root);
    root.appendChild(this.eventFeed.root);
    root.appendChild(this.buildDebugPanel());
    root.appendChild(this.minimap.root);
    root.appendChild(this.toolbar.root);
    root.appendChild(this.inspector.root);

    // The card follows the selection rather than polling it.
    ctx.selection.onChange(view => this.selectionCard.show(view));
    // Feeds redraw on change, not on a timer.
    alerts.onChange(() => { this.alertFeed.sync(); this.eventFeed.sync(); });

    this.applySettings();
    settings.onChange(() => this.applySettings());
  }

  // ============================ ROUTING ============================

  /**
   * Follows an alert or event to its subject.
   *
   * Uses the camera and the selection the game already has — the brief is
   * explicit that alerts must not grow a navigation system of their own. Focus
   * and selection are independent: an alert may know where to look without
   * knowing what to select, and vice versa.
   */
  private goTo(target: {
    focus?: { x: number; y: number };
    ref?: any;
    dossier?: { cityId: string; condition: string };
  }): void {
    // An alert that names a city condition opens the dossier on that line. This is
    // strictly better than a ring on the map for a problem like a famine, where
    // the answer is a set of figures rather than a place.
    if (target.dossier) {
      this.ctx.selection.select({ kind: 'city', id: target.dossier.cityId });
      this.ctx.screens.open('city', {
        cityId: target.dossier.cityId,
        highlightCondition: target.dossier.condition
      });
      return;
    }
    if (target.focus) {
      this.ctx.focusOn(target.focus.x, target.focus.y);
    }
    if (target.ref) {
      switch (target.ref.kind) {
        case 'city': this.ctx.selection.select({ kind: 'city', id: target.ref.id }); return;
        case 'kingdom': this.ctx.selection.select({ kind: 'kingdom', id: target.ref.id }); return;
        case 'citizen': this.ctx.selection.select({ kind: 'citizen', id: target.ref.id }); return;
        default: break;
      }
    }
    // No selectable subject, but a place to look: select the ground, so the ring
    // still shows the player where they were sent.
    if (target.focus && !target.ref) {
      this.ctx.selection.select({
        kind: 'tile',
        x: Math.floor(target.focus.x),
        y: Math.floor(target.focus.y)
      });
    }
  }

  /**
   * Opens the inspector for whatever is selected. Bound to `I`.
   *
   * With nothing selected this still opens the panel, which shows its own empty
   * state explaining what to click — more useful than a key that does nothing.
   */
  public openInspectorForSelection(): void {
    this.inspector.toggle();
  }

  // ============================ UPDATE ============================

  /**
   * One update per frame, and as little work as possible inside it.
   *
   * The snapshot is rebuilt on its own cadence, the top bar diffs every value
   * before writing it, the feeds only rebuild when their contents change, and the
   * selection re-reads the world twice a second. Nothing here walks the world.
   */
  public update(now: number): void {
    const snapshot = this.ctx.refreshSnapshot(now);
    this.topBar.sync(snapshot);

    // Condition-based alerts, evaluated once per simulated year inside `evaluate`.
    alerts.evaluate(snapshot);
    if (alerts.expire(now)) {
      this.alertFeed.sync();
      this.eventFeed.sync();
    }

    this.toolDock.syncActiveTool();
    this.toolbar.syncActiveTool();
    this.minimap.tick(now);
    this.inspector.tick(now);

    if (now - this.lastSelectionRefresh >= SELECTION_REFRESH_MS) {
      this.lastSelectionRefresh = now;
      this.ctx.selection.refresh();
    }

    if (!this.debugPanel.classList.contains('hidden')) this.syncDebug();
  }

  // ============================ INPUT HOOKS ============================

  /**
   * The HUD's share of the ESC chain, most transient thing first.
   *
   * Returns true once it has consumed the key. The ordering is the point: ESC
   * should undo the smallest thing outstanding, so a player with a menu open, a
   * tool armed and a city selected presses it three times and gets three
   * different, predictable results.
   */
  public handleEscape(): boolean {
    if (this.toolDock.closeMenu()) return true;
    if (this.toolbar.isOpen) { this.toolbar.setVisible(false); return true; }
    if (!this.ctx.brush.isInspecting) {
      this.ctx.brush.resetToInspect();
      this.toolDock.syncActiveTool();
      this.toolbar.syncActiveTool();
      return true;
    }
    if (this.inspector.isOpen) { this.inspector.hide(); return true; }
    // Follow is a camera lock the player may not realise is on, so ESC releases it
    // before it clears the selection.
    if (this.ctx.camera.targetEntityId) { this.ctx.trackEntity(null); return true; }
    if (this.ctx.selection.isActive) { this.ctx.selection.clear(); return true; }
    return false;
  }

  public cycleOverlay(): void {
    const idx = OVERLAY_CYCLE.findIndex(o => o.id === this.ctx.overlays.activeMode);
    const next = OVERLAY_CYCLE[(idx + 1) % OVERLAY_CYCLE.length];
    this.ctx.overlays.setMode(next.id);
    this.ctx.toast(`Visão: ${next.label}`, 'info');
  }

  public applySettings(): void {
    this.minimap.setVisible(settings.get('showMinimap'));
    document.documentElement.style.setProperty('--ui-scale', `${settings.get('uiScale')}`);
  }

  public toggleDebug(): void {
    this.debugPanel.classList.toggle('hidden');
  }

  public toggleVisibility(): void {
    this.hiddenByPlayer = !this.hiddenByPlayer;
    this.root.classList.toggle('ui-hidden', this.hiddenByPlayer);
  }

  // ============================ DEBUG ============================

  private buildDebugPanel(): HTMLElement {
    const row = (key: string, label: string) => {
      const value = el('span', { class: 'debug-value', text: '0' });
      this.debugEls[key] = value;
      return el('div', { class: 'debug-row' }, [el('span', { text: label }), value]);
    };

    this.debugPanel = el('div', { class: 'debug-panel hidden' }, [
      el('div', { class: 'debug-head' }, [
        el('span', { text: 'DEBUG' }),
        el('button', {
          class: 'icon-close',
          attrs: { 'aria-label': 'Fechar' },
          on: { click: () => this.toggleDebug() }
        }, [icon('close', { size: 16 })])
      ]),
      row('fps', 'FPS'),
      row('entities', 'Entities'),
      row('particles', 'Particles'),
      row('cities', 'Cities'),
      row('kingdoms', 'Kingdoms'),
      row('fires', 'Active fires'),
      row('speed', 'Sim speed'),
      row('alerts', 'Alerts'),
      el('div', { class: 'debug-actions' }, [
        el('button', { text: 'Spawn 50', on: { click: () => this.debugSpawn() } }),
        el('button', { text: 'Force war', on: { click: () => this.debugWar() } }),
        el('button', { text: 'Meteor', on: { click: () => this.debugMeteor() } }),
        el('button', { text: 'Next era', on: { click: () => { this.ctx.eras.cycleNextEra(); } } }),
        el('button', { text: '+1 day', on: { click: () => this.debugAdvanceDay() } }),
        el('button', { text: 'Urban report', on: { click: () => this.debugUrbanReport() } }),
        el('button', { text: 'UI kit', on: { click: () => this.ctx.screens.open('ui-kit') } })
      ])
    ]);
    return this.debugPanel;
  }

  private syncDebug(): void {
    const { sim } = this.ctx;
    this.debugEls.fps.textContent = `${this.ctx.fps}`;
    this.debugEls.entities.textContent = `${sim.entities.length}`;
    this.debugEls.particles.textContent = `${this.ctx.particles.activeParticles.length}`;
    this.debugEls.cities.textContent = `${sim.cities.size}`;
    this.debugEls.kingdoms.textContent = `${sim.kingdoms.size}`;
    this.debugEls.fires.textContent = `${this.ctx.activeFires}`;
    this.debugEls.speed.textContent = `${this.ctx.simSpeed}×`;
    this.debugEls.alerts.textContent = `${alerts.active.length}`;
  }

  private debugSpawn(): void {
    const { tileMap, sim } = this.ctx;
    const cx = Math.floor(tileMap.width / 2);
    const cy = Math.floor(tileMap.height / 2);
    const species = this.ctx.worldConfig.species;
    for (let i = 0; i < 50; i++) {
      const s = species[Math.floor(Math.random() * species.length)];
      sim.spawnEntity(s, cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 20);
    }
    this.ctx.toast('Spawned 50 creatures', 'success');
  }

  private debugWar(): void {
    const kingdoms = Array.from(this.ctx.sim.kingdoms.values());
    if (kingdoms.length < 2) {
      this.ctx.toast('Need at least two kingdoms to start a war', 'warning');
      return;
    }
    this.ctx.sim.diplomacy.declareWar(kingdoms[0].id, kingdoms[1].id, this.ctx.sim.currentYear, 'Divine Provocation');
  }

  private debugMeteor(): void {
    const { tileMap, camera } = this.ctx;
    const wx = camera.x / camera.tileSize;
    const wy = camera.y / camera.tileSize;
    const tile = tileMap.getTile(Math.floor(wx), Math.floor(wy));
    if (!tile) return;
    DisasterSystem.triggerMeteorite(Math.floor(wx), Math.floor(wy), tileMap, this.ctx.sim.spatialHash, this.ctx.particles, camera);
    this.ctx.toast('A meteor falls from the heavens', 'disaster');
  }

  /**
   * Steps the simulation forward by one day.
   *
   * The old time cockpit offered this as "+1 Ano" while running 60 ticks — and a
   * year is `TICKS_PER_YEAR` = 7200 ticks, so the button advanced about two hours
   * and reported a year. A day (`TICKS_PER_DAY`) is the largest step that stays
   * responsive, and it is now labelled as what it does.
   */
  private debugAdvanceDay(): void {
    for (let i = 0; i < TICKS_PER_DAY; i++) {
      this.ctx.sim.tickAI(this.ctx.tileMap, this.ctx.particles);
    }
    this.ctx.toast(`Dia avançado · Ano ${this.ctx.sim.currentYear}`, 'info');
  }

  /**
   * CITY-V1 urban diagnostics for every settlement, to the console.
   *
   * Deliberately a console dump rather than a panel: these are numbers for
   * balancing the planner, not information a player needs, and printing them
   * costs nothing until somebody asks for it.
   */
  private debugUrbanReport(): void {
    const cities = [...this.ctx.sim.cities.values()].sort((a, b) => b.population - a.population);
    if (cities.length === 0) {
      this.ctx.toast('Nenhuma cidade para analisar', 'info');
      return;
    }
    console.groupCollapsed(`🏙️ Urban report · ano ${this.ctx.sim.currentYear} · ${cities.length} cidade(s)`);
    for (const city of cities) console.log(describeCity(city, this.ctx.tileMap));
    console.groupEnd();
    this.ctx.toast(`Relatório urbano de ${cities.length} cidade(s) no console`, 'success');
  }
}
