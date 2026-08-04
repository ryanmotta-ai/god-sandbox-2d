/**
 * Containers and screen structure.
 *
 * The two rules these encode:
 *
 *  1. **The map is the protagonist.** A panel is a small, bordered slab of stone
 *     laid over the world, not a card floating in a dashboard. Nothing here
 *     produces a large permanently-open surface.
 *
 *  2. **Behaviour is standardised, not reinvented.** Before UI-0 every screen
 *     built its own head, its own close button, its own tab strip and its own
 *     scroll region, which is why closing behaved differently depending on where
 *     you were. `screenShell` is the one answer: title, back/close, tabs and a
 *     single scrolling body, wired the same way every time.
 */
import { el, clear, Child } from '../core/Dom';
import { icon, iconOrNull } from './Icon';
import { withTooltip, TooltipSource, tooltip } from './Tooltip';
import { applyRealmAccent } from './Tokens';

export interface PanelOptions {
  title?: string;
  /** One line under the title. If it needs two lines, it is not a subtitle. */
  subtitle?: string;
  /** Icon name, resolved through the pixel-art icon vocabulary. */
  icon?: string;
  /** Controls placed at the right of the header — buttons, filters, a search. */
  actions?: Child[];
  /** Realm colour, applied to this panel and everything inside it. */
  accent?: string;
  /** `sunken` reads as a recess in the surrounding surface — for nested
   *  groupings that should not look like another slab stacked on top. */
  variant?: 'default' | 'sunken' | 'raised';
  /** Turn off interior padding when the body is a table or a list that should
   *  meet the panel's edges. */
  padded?: boolean;
  /** Makes the body the scrolling region. Prefer this over letting the whole
   *  screen scroll: the header stays put and the player keeps their place. */
  scroll?: boolean;
  class?: string;
}

/** A titled slab. The default container for anything with a heading. */
export function panel(opts: PanelOptions = {}, children: Child[] = []): HTMLElement {
  const hasHead = Boolean(opts.title || opts.subtitle || opts.actions?.length);

  const body = el('div', {
    class: `ae-panel-body${opts.padded === false ? ' ae-panel-body-flush' : ''}${opts.scroll ? ' ae-scroll' : ''}`
  }, children);

  const node = el('section', {
    class: [
      'ae-panel',
      opts.variant && opts.variant !== 'default' ? `ae-panel-${opts.variant}` : '',
      opts.class
    ].filter(Boolean).join(' ')
  }, [
    hasHead
      ? el('header', { class: 'ae-panel-head' }, [
          iconOrNull(opts.icon, { size: 16, class: 'ae-panel-icon' }),
          el('div', { class: 'ae-panel-heading' }, [
            opts.title ? el('h3', { class: 'ae-panel-title', text: opts.title }) : null,
            opts.subtitle ? el('p', { class: 'ae-panel-sub', text: opts.subtitle }) : null
          ]),
          opts.actions?.length ? el('div', { class: 'ae-panel-actions' }, opts.actions) : null
        ])
      : null,
    body
  ]);

  applyRealmAccent(node, opts.accent);
  return node;
}

/**
 * A labelled group *inside* a panel.
 *
 * Lighter than a panel on purpose — a rule and a small caps label rather than
 * another border. Nesting bordered boxes two and three deep is the fastest way
 * to make a dense screen unreadable.
 */
export function section(title: string, children: Child[], opts: { actions?: Child[]; hint?: string; icon?: string } = {}): HTMLElement {
  return el('div', { class: 'ae-section' }, [
    el('div', { class: 'ae-section-head' }, [
      iconOrNull(opts.icon, { size: 16, class: 'ae-section-icon' }),
      el('h4', { class: 'ae-section-title', text: title }),
      opts.hint ? el('span', { class: 'ae-section-hint', text: opts.hint }) : null,
      opts.actions?.length ? el('div', { class: 'ae-section-actions' }, opts.actions) : null
    ]),
    el('div', { class: 'ae-section-body' }, children)
  ]);
}

/** A horizontal rule, optionally carrying a label. */
export function divider(label?: string): HTMLElement {
  if (!label) return el('div', { class: 'ae-divider' });
  return el('div', { class: 'ae-divider ae-divider-labelled' }, [
    el('span', { class: 'ae-divider-label', text: label })
  ]);
}

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  /** A count or figure shown after the label — how many wars, how many alerts. */
  badge?: string | number;
  tooltip?: TooltipSource;
  disabled?: boolean;
}

export interface TabStrip {
  root: HTMLElement;
  /** Moves the highlight without rebuilding the strip. */
  setActive(id: string): void;
  readonly active: string;
}

/**
 * A tab strip.
 *
 * Returns a handle rather than a bare element so switching tabs does not rebuild
 * the strip. The caller swaps the body; the strip just moves its highlight. That
 * distinction matters here because screens rebuild wholesale on open, and
 * without it every tab click would re-run the whole screen build.
 */
export function tabs(
  items: TabItem[],
  activeId: string,
  onSelect: (id: string) => void
): TabStrip {
  let active = activeId;
  const buttons = new Map<string, HTMLButtonElement>();

  const root = el('div', { class: 'ae-tabs', attrs: { role: 'tablist' } }, items.map(item => {
    const btn = el('button', {
      class: `ae-tab${item.id === active ? ' ae-tab-active' : ''}`,
      attrs: {
        type: 'button',
        role: 'tab',
        'aria-selected': item.id === active,
        disabled: Boolean(item.disabled)
      },
      on: {
        click: () => {
          if (item.disabled || item.id === active) return;
          handle.setActive(item.id);
          onSelect(item.id);
        }
      }
    }, [
      iconOrNull(item.icon, { size: 16, class: 'ae-tab-icon' }),
      el('span', { class: 'ae-tab-label', text: item.label }),
      item.badge !== undefined && item.badge !== '' && item.badge !== 0
        ? el('span', { class: 'ae-tab-badge', text: `${item.badge}` })
        : null
    ]) as HTMLButtonElement;

    if (item.tooltip) withTooltip(btn, item.tooltip);
    buttons.set(item.id, btn);
    return btn;
  }));

  const handle: TabStrip = {
    root,
    setActive(id: string) {
      active = id;
      for (const [key, btn] of buttons) {
        const on = key === id;
        btn.classList.toggle('ae-tab-active', on);
        btn.setAttribute('aria-selected', `${on}`);
      }
    },
    get active() { return active; }
  };

  return handle;
}

export interface ScreenShellOptions {
  title: string;
  subtitle?: string;
  icon?: string;
  /** Header controls, placed left of the close button. */
  actions?: Child[];
  /** Tab strip mounted under the header. Its body is the shell's body. */
  tabs?: TabStrip;
  /**
   * What the close button and the shell's ESC affordance do.
   *
   * Always wire this to `ctx.screens.back()` unless the screen genuinely needs
   * different behaviour — ScreenManager already routes ESC through the same
   * path, so the button and the key agree by construction.
   */
  onClose?: () => void;
  /** Label for the close affordance. `back` where the player came from another
   *  screen, `close` where the screen sits over the map. */
  closeKind?: 'close' | 'back';
  /** `narrow` for screens that are a single column of prose or settings. */
  width?: 'default' | 'narrow' | 'wide';
  class?: string;
}

export interface ScreenShell {
  root: HTMLElement;
  /** The scrolling content region. Replace its contents to change tabs. */
  body: HTMLElement;
  /** Clears and refills the body in one step. */
  setContent(children: Child[]): void;
}

/**
 * The standard screen frame: header, optional tabs, one scrolling body.
 *
 * Every screen built from here scrolls in the same place, closes with the same
 * control, and puts its title in the same spot — which is the whole point.
 * Screens keep owning their content; they stop owning their chrome.
 */
export function screenShell(opts: ScreenShellOptions): ScreenShell {
  const body = el('div', { class: 'ae-screen-body ae-scroll' });

  const closeBtn = opts.onClose
    ? withTooltip(
        el('button', {
          class: 'ae-screen-close',
          attrs: { type: 'button', 'aria-label': opts.closeKind === 'back' ? 'Voltar' : 'Fechar' },
          on: { click: () => opts.onClose!() }
        }, [icon(opts.closeKind === 'back' ? 'menu' : 'close', { size: 16 })]),
        {
          title: opts.closeKind === 'back' ? 'Voltar' : 'Fechar',
          description: opts.closeKind === 'back'
            ? 'Retorna à tela anterior.'
            : 'Fecha esta tela e retorna ao mundo.',
          shortcut: 'Esc'
        }
      )
    : null;

  const root = el('div', {
    class: [
      'ae-screen',
      opts.width && opts.width !== 'default' ? `ae-screen-${opts.width}` : '',
      opts.class
    ].filter(Boolean).join(' ')
  }, [
    el('header', { class: 'ae-screen-head' }, [
      iconOrNull(opts.icon, { size: 32, class: 'ae-screen-icon' }),
      el('div', { class: 'ae-screen-heading' }, [
        el('h1', { class: 'ae-screen-title', text: opts.title }),
        opts.subtitle ? el('p', { class: 'ae-screen-sub', text: opts.subtitle }) : null
      ]),
      opts.actions?.length ? el('div', { class: 'ae-screen-actions' }, opts.actions) : null,
      closeBtn
    ]),
    opts.tabs ? opts.tabs.root : null,
    body
  ]);

  return {
    root,
    body,
    setContent(children: Child[]) {
      // Any tooltip anchored inside the outgoing content is about to lose its
      // element, so it is dismissed before the DOM goes away rather than being
      // left pointing at nothing.
      tooltip.hide();
      clear(body);
      for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        body.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
      }
      // A new tab starts at the top. Carrying the previous tab's scroll offset
      // across is disorienting when the two have different lengths.
      body.scrollTop = 0;
    }
  };
}
