/**
 * The inspector.
 *
 * Two structural decisions distinguish this from the panel it replaces.
 *
 * **It has no target of its own.** The pre-UI-2 inspector held its own `target`
 * field, set by whoever called `inspectEntity`. That meant the drawer and the map
 * could disagree about what was selected, and following a link inside the drawer
 * left the ring on the map pointing at the previous thing. Now the inspector
 * *renders the selection* — UI-1's `SelectionManager` is the single source of
 * truth, so navigating inside the panel moves the ring by construction. That is
 * what makes items 21 and 25 of the brief fall out for free rather than needing
 * to be maintained.
 *
 * **It rebuilds on a schedule, not per frame.** A citizen's hunger and a
 * building's staffing move on the scale of simulated days; rebuilding several
 * hundred DOM nodes sixty times a second to show that would be the single most
 * expensive thing in the interface. So content is rebuilt when the selection
 * changes and then at a slow interval, and the interval is skipped entirely while
 * the panel is closed.
 */
import { el, clear } from '../core/Dom';
import { icon, withTooltip, button, emptyState, tooltip, objectNav } from '../kit';
import { sound } from '../../core/SoundSynth';
import { buildCitizenPanel } from './CitizenPanel';
import { buildBuildingPanel } from './BuildingPanel';
import { buildCityPanel, buildKingdomPanel, buildTilePanel } from './PreviewPanels';
import type { Child } from '../core/Dom';
import type { GameContext } from '../core/GameContext';
import type { SelectionTarget } from '../hud/Selection';
import type { GoodId } from '../../civ/Goods';

/**
 * What the panels are allowed to ask of the game.
 *
 * A narrow surface on purpose: the panels are presentation, and everything that
 * changes state — the camera, the selection, screen navigation — goes through
 * here. It also keeps the panel modules from importing GameContext transitively
 * and quietly growing the ability to drive the simulation.
 */
export interface InspectorHost {
  readonly ctx: GameContext;
  focusOn(x: number, y: number): void;
  toggleFollow(entityId: string): void;
  stopFollow(): void;
  isFollowing(entityId: string): boolean;
  openChronicle(): void;
  openKingdoms(kingdomId?: string): void;
  /** Opens the full realm dossier. */
  openRealmDossier(kingdomId: string): void;
  /** Opens the full city dossier, optionally landing on one condition. */
  openCityDossier(cityId: string, highlightCondition?: string): void;
}

/** How often an open inspector re-reads the world. */
const REFRESH_MS = 700;

export class Inspector implements InspectorHost {
  public readonly root: HTMLElement;
  public readonly ctx: GameContext;

  private bodyEl: HTMLElement;
  private titleEl: HTMLElement;
  private lastRefresh = 0;
  /** Identity of what was last rendered, so a refresh can tell a re-render from a
   *  genuine change of subject and keep the scroll position on the former. */
  private renderedKey = '';

  constructor(ctx: GameContext) {
    this.ctx = ctx;

    this.titleEl = el('h3', { class: 'ae-insp-title', text: 'Inspeção' });
    this.bodyEl = el('div', { class: 'ae-insp-body ae-scroll' });

    this.root = el('aside', { class: 'ae-inspector hidden', attrs: { 'aria-label': 'Painel de inspeção' } }, [
      el('header', { class: 'ae-insp-bar' }, [
        icon('search', { size: 16, class: 'ae-insp-bar-icon' }),
        this.titleEl,
        withTooltip(
          el('button', {
            class: 'ae-insp-close',
            attrs: { type: 'button', 'aria-label': 'Fechar' },
            on: { click: () => this.hide() }
          }, [icon('close', { size: 16 })]),
          { title: 'Fechar', shortcut: 'Esc' }
        )
      ]),
      this.bodyEl
    ]);

    // The panel follows the selection. A selection cleared while the panel is
    // open leaves it showing an empty state rather than stale content.
    ctx.selection.onChange(() => {
      if (this.isOpen) this.render(true);
    });

    this.render(true);
  }

  // ============================ VISIBILITY ============================

  public get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  public show(): void {
    if (this.isOpen) return;
    this.root.classList.remove('hidden');
    this.render(true);
  }

  public hide(): void {
    if (!this.isOpen) return;
    this.root.classList.add('hidden');
    // Any tooltip anchored inside the panel is about to be unreachable.
    tooltip.hide();
    // Closing the inspector is not a reason to stop following — the player may be
    // watching someone walk. But it *is* a reason to stop paying for refreshes.
  }

  public toggle(): void {
    this.isOpen ? this.hide() : this.show();
  }

  /** Opens the panel on whatever is selected. Called by the selection card. */
  public open(): void {
    this.show();
  }

  // ============================ TICK ============================

  /**
   * Called every frame; does work at most every `REFRESH_MS`, and none at all
   * while closed.
   */
  public tick(now: number): void {
    if (!this.isOpen) return;
    if (now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;
    this.render(false);
  }

  // ============================ RENDER ============================

  /**
   * Rebuilds the panel from the current selection.
   *
   * `subjectChanged` distinguishes a new selection from a periodic refresh. On a
   * refresh the scroll position is preserved, because silently jumping a reader
   * back to the top twice a second would make the lower sections unreadable.
   */
  private render(subjectChanged: boolean): void {
    const target = this.ctx.selection.current;
    const key = target ? JSON.stringify(target) : '';
    const sameSubject = key === this.renderedKey;
    const scroll = sameSubject ? this.bodyEl.scrollTop : 0;

    // A tooltip open over content that is about to be discarded would be left
    // describing a node that no longer exists.
    if (!sameSubject) tooltip.hide();

    this.renderedKey = key;
    clear(this.bodyEl);

    const content = this.resolveContent(target);
    this.titleEl.textContent = content.title;
    this.appendAll(content.children);

    this.bodyEl.scrollTop = scroll;
    if (subjectChanged && !sameSubject) this.bodyEl.scrollTop = 0;
  }

  /**
   * Turns the selection into a panel.
   *
   * Every branch re-resolves the id against the live world, so an object that
   * died, was razed or was captured between refreshes lands in the "no longer
   * exists" state instead of throwing. That is item 26 of the brief, and it is
   * handled here once rather than in five panels.
   */
  private resolveContent(target: SelectionTarget | null): {
    title: string;
    children: Child[];
  } {
    if (!target) {
      return {
        title: 'Inspeção',
        children: [emptyState({
          icon: 'search',
          title: 'Nada selecionado',
          hint: 'Clique em um habitante, construção, cidade ou terreno no mapa para investigá-lo.'
        })]
      };
    }

    const sim = this.ctx.sim;

    switch (target.kind) {
      case 'citizen': {
        const entity = sim.entities.find(e => e.id === target.id);
        if (!entity) return this.gone('Este habitante morreu', 'Sua história chegou ao fim.');
        return { title: entity.name, children: buildCitizenPanel(entity, this) };
      }

      case 'building': {
        const city = sim.cities.get(target.cityId);
        const building = city?.buildings.get(target.buildingId);
        if (!city || !building) {
          return this.gone('Esta construção não existe mais', 'Foi destruída, demolida ou a cidade caiu.');
        }
        return { title: 'Construção', children: buildBuildingPanel(building, city, this) };
      }

      case 'city': {
        const city = sim.cities.get(target.id);
        if (!city) return this.gone('Este assentamento não existe mais', 'Foi abandonado ou destruído.');
        return { title: city.name, children: buildCityPanel(city, this) };
      }

      case 'kingdom': {
        const kingdom = sim.kingdoms.get(target.id);
        if (!kingdom) return this.gone('Este reino não existe mais', 'Foi conquistado ou dissolvido.');
        return { title: kingdom.name, children: buildKingdomPanel(kingdom, this) };
      }

      case 'tile': {
        const tile = this.ctx.tileMap.getTile(target.x, target.y);
        if (!tile) return this.gone('Terreno fora do mundo', 'Esta coordenada não existe mais.');
        return { title: 'Terreno', children: buildTilePanel(tile, this) };
      }

      default:
        return this.gone('Alvo desconhecido', 'Nada a mostrar sobre esta seleção.');
    }
  }

  /**
   * The gone-away state.
   *
   * Offers a way out rather than a dead end: clearing the selection closes the
   * ring on the map too, which is the only thing left to tidy.
   */
  private gone(title: string, hint: string): { title: string; children: Child[] } {
    return {
      title: 'Perdido',
      children: [emptyState({
        icon: 'history',
        title,
        hint,
        action: button('Limpar seleção', () => {
          this.ctx.selection.clear();
          this.hide();
        }, { variant: 'secondary', size: 'sm', icon: 'close' })
      })]
    };
  }

  private appendAll(children: Child[]): void {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      this.bodyEl.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
    }
  }

  // ============================ HOST ============================

  public focusOn(x: number, y: number): void {
    sound.playClick();
    this.ctx.focusOn(x, y);
  }

  /**
   * Follow is the camera's existing entity tracking, surfaced.
   *
   * `Camera.addInputDirection` already clears `targetEntityId` on manual input,
   * so the player can always break out by panning — which is why this can be a
   * toggle without becoming a mode they get stuck in.
   */
  public toggleFollow(entityId: string): void {
    sound.playClick();
    this.ctx.trackEntity(this.isFollowing(entityId) ? null : entityId);
    this.render(false);
  }

  public stopFollow(): void {
    sound.playClick();
    this.ctx.trackEntity(null);
    this.render(false);
  }

  public isFollowing(entityId: string): boolean {
    return this.ctx.camera.targetEntityId === entityId;
  }

  public openChronicle(): void {
    this.ctx.screens.open('chronicle');
  }

  public openKingdoms(kingdomId?: string): void {
    this.ctx.screens.open('kingdoms', { focusKingdom: kingdomId });
  }

  /** A realm is on the map, so following its link goes and looks at it. */
  public openRealmDossier(kingdomId: string): void {
    const capital = this.ctx.sim.cities.get(this.ctx.sim.kingdoms.get(kingdomId)?.capitalCityId ?? '');
    if (!capital) return;
    this.ctx.focusOn(capital.x, capital.y, 1.4);
  }

  public openCityDossier(cityId: string, highlightCondition?: string): void {
    this.ctx.screens.open('city', { cityId, highlightCondition });
  }

  /**
   * Wires object links to open the inspector.
   *
   * UI-1 registered openers that select and centre; this layers the panel on top,
   * so a link inside the inspector navigates *within* the inspector. Registered
   * after UI-1's so these win — `registerOpener` replaces by kind.
   */
  public registerLinkNavigation(): void {
    const goTo = (kind: 'citizen' | 'city') => (ref: { id: string }) => {
      switch (kind) {
        case 'citizen': {
          const entity = this.ctx.sim.entities.find(e => e.id === ref.id);
          if (!entity) return;
          this.ctx.selection.select({ kind: 'citizen', id: ref.id });
          this.ctx.focusOn(entity.x, entity.y);
          break;
        }
        case 'city': {
          const city = this.ctx.sim.cities.get(ref.id);
          if (!city) return;
          this.ctx.selection.select({ kind: 'city', id: ref.id });
          this.ctx.focusOn(city.x, city.y);
          break;
        }
      }
      this.show();
    };

    objectNav.registerOpener('citizen', goTo('citizen'));
    objectNav.registerOpener('city', goTo('city'));
    // `kingdom` is deliberately *not* re-registered here. UI-4 owns it: a realm
    // reference opens the realm dossier, which is a better answer to "who are
    // they?" than the compact preview this panel can offer. The opener registered
    // in `main.ts` stands.

    // Buildings become navigable for the first time here: UI-1 could select them
    // from the map but had nothing to open, so no opener was registered.
    objectNav.registerOpener('building', ref => {
      for (const city of this.ctx.sim.cities.values()) {
        const building = city.buildings.get(ref.id);
        if (!building) continue;
        this.ctx.selection.select({ kind: 'building', cityId: city.id, buildingId: building.id });
        this.ctx.focusOn(building.x, building.y);
        this.show();
        return;
      }
    });
  }
}
