import { clear, el } from './Dom';
import { sound } from '../../core/SoundSynth';
import type { GameContext } from './GameContext';

export type ScreenId =
  | 'main-menu'
  | 'world-setup'
  | 'loading'
  | 'pause'
  | 'kingdoms'
  | 'diplomacy'
  | 'stats'
  | 'bestiary'
  | 'chronicle'
  | 'settings'
  | 'help'
  | 'saveload'
  | 'credits'
  | 'gameover'
  | 'politics'
  | 'economy'
  | 'warfare'
  | 'dynasty'
  | 'ecosystem'
  | 'techtree'
  | 'infrastructure';

/**
 * The vocabulary of cross-screen navigation.
 *
 * A screen is a lens on the same world, so a question asked in one ("who else
 * burns oil?") usually has to be answered in another. These are the handles a
 * screen can pass when it sends the player somewhere; each receiving screen
 * validates the ones it understands and ignores the rest.
 */
export interface NavParams {
  /** Tab to open on. Each screen checks it against its own tab list. */
  tab?: string;
  /** Good to inspect (Economy). */
  good?: string;
  /** Realm to select or highlight (Kingdoms, Diplomacy, Politics, Tech). */
  focusKingdom?: string;
  /** The other side of a pair, for the treaty view (Diplomacy). */
  withKingdom?: string;
  /** Trade route to highlight (Infrastructure). */
  routeId?: string;
  /** Settlement to highlight (Infrastructure, Economy). */
  cityId?: string;

  // Non-navigational params the older screens already take.
  /** Loading screen caption. */
  title?: string;
  /** Why the run ended (Game Over). */
  reason?: string;
  /** Save/load opened from the title screen rather than from a running world. */
  fromMenu?: boolean;
}

export interface Screen {
  readonly id: ScreenId;
  /** `fullscreen` hides the HUD entirely; `overlay` floats above a still-visible world. */
  readonly kind: 'fullscreen' | 'overlay';
  /** Whether ESC / backdrop click closes this screen. */
  readonly dismissable: boolean;
  /** Builds the screen DOM. Called on every open so screens always show fresh data. */
  build(ctx: GameContext, params?: any): HTMLElement;
  /** Optional per-frame update while visible (used by the live-updating screens). */
  tick?(ctx: GameContext): void;
  /** Cleanup when the screen closes. */
  dispose?(): void;
}

/**
 * Owns the screen stack. Exactly one screen is visible at a time; opening a new
 * one pushes onto a stack so `back()` returns where the player came from.
 */
export class ScreenManager {
  private root: HTMLElement;
  private registry: Map<ScreenId, Screen> = new Map();
  private stack: { screen: Screen; params?: NavParams }[] = [];
  private ctx: GameContext | null = null;
  private currentNode: HTMLElement | null = null;
  private hudRoot: HTMLElement;

  constructor(root: HTMLElement, hudRoot: HTMLElement) {
    this.root = root;
    this.hudRoot = hudRoot;
  }

  public attachContext(ctx: GameContext): void {
    this.ctx = ctx;
  }

  public register(screen: Screen): void {
    this.registry.set(screen.id, screen);
  }

  public get current(): Screen | null {
    return this.stack.length ? this.stack[this.stack.length - 1].screen : null;
  }

  public isOpen(id?: ScreenId): boolean {
    if (!this.current) return false;
    return id ? this.current.id === id : true;
  }

  /** Opens a screen on top of whatever is showing. */
  public open(id: ScreenId, params?: NavParams): void {
    const screen = this.registry.get(id);
    if (!screen) {
      console.warn(`Screen "${id}" is not registered`);
      return;
    }
    if (this.current?.id === id) {
      // Already here. Re-opening the same screen with new params is a real
      // navigation — a link that jumps to another good or realm on the screen
      // you are standing on must still take you there — so retarget in place
      // rather than pushing a duplicate onto the stack.
      if (params === undefined) return;
      this.stack[this.stack.length - 1].params = params;
      sound.playClick();
      this.render();
      return;
    }
    sound.playClick();
    this.stack.push({ screen, params });
    this.render();
  }

  /** Replaces the whole stack with a single screen (used for menu <-> game transitions). */
  public replace(id: ScreenId, params?: NavParams): void {
    this.disposeAll();
    this.stack = [];
    this.open(id, params);
  }

  /** Closes the top screen, revealing whatever was underneath. */
  public back(): void {
    const top = this.stack.pop();
    top?.screen.dispose?.();
    sound.playClick();
    this.render();
  }

  /** Closes every screen and returns to the bare game view. */
  public closeAll(): void {
    this.disposeAll();
    this.stack = [];
    this.render();
  }

  /** Routed from the global ESC handler. Returns true when it consumed the key. */
  public handleEscape(): boolean {
    const top = this.current;
    if (!top) return false;
    if (!top.dismissable) return true; // Consumed but ignored (e.g. loading screen)
    this.back();
    return true;
  }

  public tick(): void {
    if (!this.ctx) return;
    this.current?.tick?.(this.ctx);
  }

  /** Rebuilds the currently visible screen in place (after a data change). */
  public refresh(): void {
    if (this.stack.length) this.render();
  }

  private disposeAll(): void {
    for (const entry of this.stack) entry.screen.dispose?.();
  }

  private render(): void {
    if (!this.ctx) return;
    clear(this.root);
    this.currentNode = null;

    const top = this.stack[this.stack.length - 1];
    if (!top) {
      this.root.classList.add('hidden');
      this.hudRoot.classList.toggle('hidden', !this.ctx.inGame);
      return;
    }

    const { screen, params } = top;
    this.root.classList.remove('hidden');
    // Fullscreen screens take over completely; overlays keep the HUD dimmed behind.
    this.hudRoot.classList.toggle('hidden', screen.kind === 'fullscreen' || !this.ctx.inGame);

    const body = screen.build(this.ctx, params);
    // Params describe a navigation, not a permanent state. Once the screen has
    // read them they are spent, so a later refresh — or coming back from the
    // screen you jumped to — shows where the player actually left off instead of
    // yanking them back to the original link target.
    top.params = undefined;
    // Only overlays dismiss on a backdrop click. A full-screen screen fills the
    // viewport, so treating its empty space as a backdrop would close it whenever
    // the player clicked beside the content.
    const dismissOnBackdrop = screen.dismissable && screen.kind === 'overlay';
    const wrapper = el('div', {
      class: `screen screen-${screen.kind} screen-${screen.id}`,
      on: dismissOnBackdrop
        ? {
            mousedown: (ev: MouseEvent) => {
              if (ev.target === wrapper) this.back();
            }
          }
        : undefined
    }, [body]);

    this.currentNode = wrapper;
    this.root.appendChild(wrapper);
  }
}
