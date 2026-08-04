/**
 * The tooltip layer.
 *
 * A simulation this dense cannot explain itself on the surface — there is not
 * enough room, and filling the room would bury the map. So the interface shows
 * the figure and keeps the explanation one hover away. That makes the tooltip
 * one of the most-used components in the game, and worth building properly
 * once.
 *
 * Design decisions worth knowing before using it:
 *
 *  - **Content is a callback.** `attach(el, () => ({...}))` is evaluated at hover
 *    time, so a tooltip on a live figure reports the current value without the
 *    element subscribing to anything. Building tooltip content eagerly for every
 *    row in a table is exactly the per-frame work UI-0 is meant to avoid.
 *
 *  - **One node, one set of listeners.** The panel is a single element reused for
 *    every tooltip, and hovers are caught by delegation on the document. A
 *    thousand table cells therefore cost a thousand WeakMap entries, not a
 *    thousand event listeners.
 *
 *  - **It never blocks the map.** The panel is `pointer-events: none` and offset
 *    from the cursor, so a tooltip can never swallow the click the player was
 *    about to make on the world underneath it.
 */
import { el, clear } from '../core/Dom';
import { iconOrNull } from './Icon';
import { STATUS_VAR, Status } from './Tokens';

export interface TooltipContent {
  /** What this is. Shown as the heading. */
  title: string;
  /** The headline figure, if the tooltip is about a number. Set apart and
   *  right-aligned against the title so it stays scannable. */
  value?: string;
  /** A sentence or two of explanation — what the figure means, or where it
   *  comes from. Not a place for a paragraph. */
  description?: string;
  /** Supporting lines: the breakdown behind the value, or related figures.
   *  Rendered as aligned label/value pairs. */
  rows?: { label: string; value: string; status?: Status }[];
  /** A closing note in small type — provenance, a caveat, a timestamp. */
  footnote?: string;
  /** Keyboard shortcut for the action this tooltip describes. */
  shortcut?: string;
  /** Tints the heading and the left edge — used to carry status or realm colour. */
  accent?: string;
  /** Status for the value, when the figure itself is good or bad news. */
  valueStatus?: Status;
  /** Optional icon name, resolved through the pixel-art icon vocabulary. */
  icon?: string;
}

/** A tooltip's content, or a function returning it, evaluated on hover. */
export type TooltipSource = TooltipContent | (() => TooltipContent | null);

/** How long the pointer must rest before the tooltip appears. Short enough to
 *  feel like an answer, long enough that sweeping across a table stays quiet. */
const SHOW_DELAY_MS = 110;
/** Gap between the cursor and the panel, so the panel never sits under the
 *  pointer's own hotspot. */
const CURSOR_OFFSET = 14;
/** Keep-out margin from the viewport edge. */
const EDGE_MARGIN = 8;

class TooltipController {
  private panel: HTMLElement | null = null;
  private sources = new WeakMap<Element, TooltipSource>();
  private activeTarget: Element | null = null;
  private pendingTarget: Element | null = null;
  private showTimer = 0;
  private frame = 0;
  private cursor = { x: 0, y: 0 };
  private listening = false;

  /**
   * Binds a tooltip to an element.
   *
   * Returns the element so it can be used inline inside an `el(...)` tree.
   */
  public attach<T extends HTMLElement>(node: T, source: TooltipSource): T {
    this.sources.set(node, source);
    node.dataset.aeTip = '';
    this.ensureListening();
    return node;
  }

  /** Removes a tooltip binding, hiding the panel if that element owns it. */
  public detach(node: HTMLElement): void {
    this.sources.delete(node);
    delete node.dataset.aeTip;
    if (this.activeTarget === node || this.pendingTarget === node) this.hide();
  }

  /** Hides the tooltip and cancels anything pending. Called on scroll, on
   *  mousedown, on ESC, and whenever a screen is torn down. */
  public hide(): void {
    window.clearTimeout(this.showTimer);
    this.showTimer = 0;
    this.pendingTarget = null;
    this.activeTarget = null;
    if (this.panel) this.panel.classList.add('hidden');
  }

  // ============================ INTERNALS ============================

  private ensureListening(): void {
    if (this.listening) return;
    this.listening = true;

    // Delegation on the document: one listener set for the entire interface,
    // however many tooltips are bound.
    document.addEventListener('pointerover', this.onPointerOver, true);
    document.addEventListener('pointermove', this.onPointerMove, true);
    document.addEventListener('pointerout', this.onPointerOut, true);
    // Any of these means the player's attention has moved on.
    document.addEventListener('pointerdown', this.onDismiss, true);
    document.addEventListener('wheel', this.onDismiss, true);
    window.addEventListener('scroll', this.onDismiss, true);
    window.addEventListener('blur', this.onDismiss);
    document.addEventListener('keydown', this.onKeyDown, true);
  }

  private onPointerOver = (ev: PointerEvent): void => {
    const target = (ev.target as Element | null)?.closest?.('[data-ae-tip]') ?? null;
    this.cursor = { x: ev.clientX, y: ev.clientY };

    if (!target) {
      if (this.activeTarget || this.pendingTarget) this.hide();
      return;
    }
    if (target === this.activeTarget) return;

    // Moving between tooltip targets re-arms the delay rather than swapping
    // instantly, so dragging the pointer across a dense table does not flicker
    // through twenty panels.
    this.pendingTarget = target;
    window.clearTimeout(this.showTimer);
    this.showTimer = window.setTimeout(() => this.show(target), SHOW_DELAY_MS);
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.activeTarget && !this.pendingTarget) return;
    this.cursor = { x: ev.clientX, y: ev.clientY };
    if (!this.activeTarget) return;
    // Repositioning is coalesced to one write per frame: pointermove fires far
    // more often than the screen refreshes, and each reposition reads layout.
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.activeTarget) this.position();
    });
  };

  private onPointerOut = (ev: PointerEvent): void => {
    const from = (ev.target as Element | null)?.closest?.('[data-ae-tip]') ?? null;
    if (!from) return;
    // `relatedTarget` is where the pointer went. Staying inside the same
    // tooltip target — crossing between a row's own children — is not an exit.
    const to = (ev.relatedTarget as Element | null)?.closest?.('[data-ae-tip]') ?? null;
    if (to === from) return;
    this.hide();
  };

  private onDismiss = (): void => {
    if (this.activeTarget || this.pendingTarget) this.hide();
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') this.hide();
  };

  private show(target: Element): void {
    this.showTimer = 0;
    this.pendingTarget = null;

    // The element may have been rebuilt out from under us during the delay —
    // screens rebuild wholesale on refresh — in which case there is nothing to
    // annotate any more.
    if (!target.isConnected) return;

    const source = this.sources.get(target);
    if (!source) return;
    const content = typeof source === 'function' ? source() : source;
    if (!content) return;

    this.activeTarget = target;
    this.render(content);
    this.position();
  }

  private render(content: TooltipContent): void {
    const panel = this.ensurePanel();
    clear(panel);
    panel.classList.remove('hidden');
    panel.style.setProperty('--ae-tip-accent', content.accent ?? 'var(--ae-accent)');

    const valueColor = content.valueStatus ? STATUS_VAR[content.valueStatus] : undefined;

    panel.appendChild(el('div', { class: 'ae-tip-head' }, [
      iconOrNull(content.icon, { size: 16, class: 'ae-tip-icon' }),
      el('span', { class: 'ae-tip-title', text: content.title }),
      content.value
        ? el('span', {
            class: 'ae-tip-value',
            text: content.value,
            style: valueColor ? { color: valueColor } : undefined
          })
        : null
    ]));

    if (content.description) {
      panel.appendChild(el('p', { class: 'ae-tip-desc', text: content.description }));
    }

    if (content.rows?.length) {
      panel.appendChild(el('div', { class: 'ae-tip-rows' }, content.rows.map(row =>
        el('div', { class: 'ae-tip-row' }, [
          el('span', { class: 'ae-tip-row-label', text: row.label }),
          el('span', {
            class: 'ae-tip-row-value',
            text: row.value,
            style: row.status ? { color: STATUS_VAR[row.status] } : undefined
          })
        ])
      )));
    }

    if (content.footnote || content.shortcut) {
      panel.appendChild(el('div', { class: 'ae-tip-foot' }, [
        content.footnote ? el('span', { class: 'ae-tip-note', text: content.footnote }) : null,
        content.shortcut ? el('kbd', { class: 'ae-tip-key', text: content.shortcut }) : null
      ]));
    }
  }

  private ensurePanel(): HTMLElement {
    if (this.panel) return this.panel;
    this.panel = el('div', { class: 'ae-tooltip hidden', attrs: { role: 'tooltip' } });
    document.body.appendChild(this.panel);
    return this.panel;
  }

  /**
   * Places the panel beside the cursor, flipping rather than clamping when it
   * would leave the viewport.
   *
   * Flipping keeps the constant gap between cursor and panel; clamping would
   * slide the panel under the pointer near a screen edge, which is where the
   * minimap and the inspector live.
   */
  private position(): void {
    const panel = this.panel;
    if (!panel) return;

    const { width, height } = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = this.cursor.x + CURSOR_OFFSET;
    if (x + width + EDGE_MARGIN > vw) x = this.cursor.x - CURSOR_OFFSET - width;
    x = Math.max(EDGE_MARGIN, Math.min(x, vw - width - EDGE_MARGIN));

    let y = this.cursor.y + CURSOR_OFFSET;
    if (y + height + EDGE_MARGIN > vh) y = this.cursor.y - CURSOR_OFFSET - height;
    y = Math.max(EDGE_MARGIN, Math.min(y, vh - height - EDGE_MARGIN));

    panel.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}

export const tooltip = new TooltipController();

/**
 * Binds a tooltip and returns the element, so it reads naturally inside a DOM
 * tree: `withTooltip(el('span', ...), { title: 'Unrest', ... })`.
 */
export function withTooltip<T extends HTMLElement>(node: T, source: TooltipSource): T {
  return tooltip.attach(node, source);
}
