/**
 * Things the player operates: buttons, filters, search.
 *
 * All of them route their icons through the pixel-art vocabulary and their hover
 * text through the tooltip layer, so a control never carries a system emoji and
 * never falls back to a native `title` box that appears a second too late.
 */
import { el } from '../core/Dom';
import { icon, iconOrNull } from './Icon';
import { withTooltip, TooltipSource } from './Tooltip';
import { Status, STATUS_VAR } from './Tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonOptions {
  variant?: ButtonVariant;
  /** Icon name from the icon vocabulary. */
  icon?: string;
  /** Keyboard shortcut, shown as a key cap and repeated in the tooltip. */
  shortcut?: string;
  tooltip?: TooltipSource;
  disabled?: boolean;
  /** `sm` for controls that sit inside a panel header or a table row. */
  size?: 'sm' | 'md';
  /** Fills the available width — for stacked menus. */
  block?: boolean;
  class?: string;
}

export function button(label: string, onClick: () => void, opts: ButtonOptions = {}): HTMLButtonElement {
  const variant = opts.variant ?? 'secondary';
  const node = el('button', {
    class: [
      'ae-btn',
      `ae-btn-${variant}`,
      opts.size === 'sm' ? 'ae-btn-sm' : '',
      opts.block ? 'ae-btn-block' : '',
      opts.class
    ].filter(Boolean).join(' '),
    attrs: { type: 'button', disabled: Boolean(opts.disabled) },
    on: { click: () => { if (!opts.disabled) onClick(); } }
  }, [
    iconOrNull(opts.icon, { size: 16, class: 'ae-btn-icon' }),
    el('span', { class: 'ae-btn-label', text: label }),
    opts.shortcut ? el('kbd', { class: 'ae-btn-key', text: opts.shortcut }) : null
  ]) as HTMLButtonElement;

  // A shortcut on its own is worth a tooltip: it is the only way the player
  // learns the key without opening the help screen.
  const tip = opts.tooltip ?? (opts.shortcut ? { title: label, shortcut: opts.shortcut } : null);
  if (tip) withTooltip(node, tip);

  return node;
}

export interface IconButtonOptions {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  shortcut?: string;
  tooltip?: TooltipSource;
  disabled?: boolean;
  active?: boolean;
  class?: string;
}

/**
 * A square icon-only control.
 *
 * `label` is mandatory even though it is not drawn: it becomes the accessible
 * name and the tooltip heading. An icon button with no label is a control the
 * player has to click to identify.
 */
export function iconButton(
  iconName: string,
  label: string,
  onClick: () => void,
  opts: IconButtonOptions = {}
): HTMLButtonElement {
  const node = el('button', {
    class: [
      'ae-icon-btn',
      `ae-icon-btn-${opts.variant ?? 'ghost'}`,
      opts.size === 'sm' ? 'ae-icon-btn-sm' : '',
      opts.active ? 'ae-icon-btn-active' : '',
      opts.class
    ].filter(Boolean).join(' '),
    attrs: {
      type: 'button',
      'aria-label': label,
      'aria-pressed': opts.active === undefined ? false : opts.active,
      disabled: Boolean(opts.disabled)
    },
    on: { click: () => { if (!opts.disabled) onClick(); } }
  }, [icon(iconName, { size: 16 })]) as HTMLButtonElement;

  withTooltip(node, opts.tooltip ?? { title: label, shortcut: opts.shortcut });
  return node;
}

export interface SearchInputOptions {
  placeholder?: string;
  value?: string;
  /** Fires on every keystroke, already debounced by a frame. */
  onInput: (value: string) => void;
  class?: string;
}

/**
 * A search field.
 *
 * Input is coalesced to one callback per frame. Filtering a list of ten thousand
 * citizens on every `keydown` is exactly the kind of unbidden work UI-0 is
 * meant to design out.
 */
export function searchInput(opts: SearchInputOptions): HTMLElement {
  let frame = 0;
  const field = el('input', {
    class: 'ae-search-field',
    attrs: {
      type: 'search',
      placeholder: opts.placeholder ?? 'Buscar…',
      value: opts.value ?? '',
      spellcheck: false
    },
    on: {
      input: (ev: Event) => {
        const value = (ev.target as HTMLInputElement).value;
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = 0;
          opts.onInput(value);
        });
      }
    }
  }) as HTMLInputElement;

  return el('div', { class: `ae-search${opts.class ? ' ' + opts.class : ''}` }, [
    icon('search', { size: 16, class: 'ae-search-icon' }),
    field
  ]);
}

export interface FilterOption<T extends string> {
  id: T;
  label: string;
  icon?: string;
  /** How many items match — shown so the player knows before clicking whether
   *  a filter is worth using. */
  count?: number;
  status?: Status;
  tooltip?: TooltipSource;
}

export interface FilterGroup<T extends string> {
  root: HTMLElement;
  setActive(id: T): void;
  readonly active: T;
}

/**
 * A row of mutually-exclusive filters.
 *
 * Same handle-returning shape as `tabs`, and for the same reason: changing the
 * filter re-renders the list, not the filter row.
 */
export function filterGroup<T extends string>(
  options: FilterOption<T>[],
  activeId: T,
  onSelect: (id: T) => void
): FilterGroup<T> {
  let active = activeId;
  const buttons = new Map<T, HTMLButtonElement>();

  const root = el('div', { class: 'ae-filters' }, options.map(opt => {
    const btn = el('button', {
      class: `ae-filter${opt.id === active ? ' ae-filter-active' : ''}`,
      attrs: { type: 'button', 'aria-pressed': opt.id === active },
      style: opt.status ? { '--ae-filter-accent': STATUS_VAR[opt.status] } : undefined,
      on: {
        click: () => {
          if (opt.id === active) return;
          handle.setActive(opt.id);
          onSelect(opt.id);
        }
      }
    }, [
      iconOrNull(opt.icon, { size: 16, class: 'ae-filter-icon' }),
      el('span', { class: 'ae-filter-label', text: opt.label }),
      opt.count !== undefined ? el('span', { class: 'ae-filter-count', text: `${opt.count}` }) : null
    ]) as HTMLButtonElement;

    if (opt.tooltip) withTooltip(btn, opt.tooltip);
    buttons.set(opt.id, btn);
    return btn;
  }));

  const handle: FilterGroup<T> = {
    root,
    setActive(id: T) {
      active = id;
      for (const [key, btn] of buttons) {
        const on = key === id;
        btn.classList.toggle('ae-filter-active', on);
        btn.setAttribute('aria-pressed', `${on}`);
      }
    },
    get active() { return active; }
  };

  return handle;
}
