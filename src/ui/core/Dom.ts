/**
 * Minimal DOM building helpers used across every screen.
 * Keeps screen code declarative instead of a soup of innerHTML strings.
 *
 * `el` / `append` / `clear` are the foundation the whole UI is built on and are
 * unchanged. The component helpers below (`button`, `emptyState`, …) are the
 * pre-UI-0 generation: they keep their signatures and their CSS classes so the
 * twenty existing screens continue to work untouched, but they now render their
 * icons through the pixel-art vocabulary and can carry a real tooltip.
 *
 * New UI should import from `../kit` instead. These stay until the last screen
 * has been migrated.
 */
import { icon as pixelIcon, hasIcon } from '../kit/Icon';
import { withTooltip, TooltipSource } from '../kit/Tooltip';

export type Child = Node | string | number | null | undefined | false;

export interface ElProps {
  class?: string;
  id?: string;
  text?: string;
  html?: string;
  title?: string;
  /** Inline styles. Keys beginning `--` are set as custom properties. */
  style?: (Partial<CSSStyleDeclaration> & Record<`--${string}`, string>) | string;
  dataset?: Record<string, string>;
  attrs?: Record<string, string | number | boolean>;
  on?: Record<string, (ev: any) => void>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: Child[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (props.class) node.className = props.class;
  if (props.id) node.id = props.id;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.title) node.title = props.title;

  if (typeof props.style === 'string') {
    node.setAttribute('style', props.style);
  } else if (props.style) {
    for (const [key, value] of Object.entries(props.style)) {
      if (value === undefined || value === null) continue;
      // Custom properties have to go through setProperty — assigning them onto
      // `style` is silently ignored, which made every `--ae-*` override handed
      // in via `style` disappear without an error.
      if (key.startsWith('--')) node.style.setProperty(key, String(value));
      else (node.style as any)[key] = value;
    }
  }

  if (props.dataset) {
    for (const [k, v] of Object.entries(props.dataset)) node.dataset[k] = v;
  }

  if (props.attrs) {
    for (const [k, v] of Object.entries(props.attrs)) {
      if (v === false) continue;
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }

  if (props.on) {
    for (const [evt, handler] of Object.entries(props.on)) {
      node.addEventListener(evt, handler as EventListener);
    }
  }

  append(node, children);
  return node;
}

export function append(parent: HTMLElement, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Standard app button. `variant` maps to the CSS button styles.
 *
 * `pixelIcon` names an icon from the game's own pixel-art generator. `icon`
 * used to be a plain glyph and is now resolved through the same vocabulary, so a
 * caller that still passes `'⚔️'` gets the game's crossed-swords sprite rather
 * than whatever the system font decides that emoji looks like today. A glyph
 * with no artwork behind it is still drawn as text, so nothing disappears.
 */
export function button(
  label: string,
  onClick: () => void,
  opts: {
    variant?: 'primary' | 'ghost' | 'danger' | 'menu';
    icon?: string;
    pixelIcon?: string;
    hint?: string;
    class?: string;
    title?: string;
    /** Rich hover panel. Prefer this over `title`, which the browser shows a
     *  second late and styles however it likes. */
    tooltip?: TooltipSource;
  } = {}
): HTMLButtonElement {
  const variant = opts.variant ?? 'ghost';
  const children: Child[] = [];
  const iconName = opts.pixelIcon ?? opts.icon;

  if (iconName) {
    children.push(
      hasIcon(iconName)
        ? pixelIcon(iconName, { size: 16, class: 'btn-icon btn-icon-pixel' })
        : el('span', { class: 'btn-icon', text: iconName })
    );
  }
  children.push(el('span', { class: 'btn-label', text: label }));
  if (opts.hint) children.push(el('kbd', { class: 'btn-hint', text: opts.hint }));

  const node = el(
    'button',
    {
      class: `btn btn-${variant}${opts.class ? ' ' + opts.class : ''}`,
      // Only kept when there is no real tooltip — two hover explanations for one
      // button is worse than either alone.
      title: opts.tooltip ? '' : (opts.title ?? ''),
      on: { click: onClick }
    },
    children
  );

  const tip = opts.tooltip ?? (opts.hint ? { title: label, description: opts.title, shortcut: opts.hint } : null);
  if (tip) withTooltip(node, tip);

  return node;
}

/** Titled section block used inside screens. */
export function section(title: string, children: Child[], subtitle?: string): HTMLElement {
  return el('section', { class: 'panel' }, [
    el('header', { class: 'panel-head' }, [
      el('h3', { class: 'panel-title', text: title }),
      subtitle ? el('p', { class: 'panel-sub', text: subtitle }) : null
    ]),
    el('div', { class: 'panel-body' }, children)
  ]);
}

/** Label + value line, the workhorse of the inspector and detail panels. */
export function statRow(label: string, value: Child, valueColor?: string): HTMLElement {
  return el('div', { class: 'stat-row' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', style: valueColor ? { color: valueColor } : undefined }, [value])
  ]);
}

/**
 * A stat row that takes you somewhere. Used wherever a figure raises the obvious
 * follow-up question — which realm, which city, which route — so the answer is
 * one click away instead of a screen the player has to go find.
 */
export function linkRow(
  label: string,
  value: Child,
  onClick: () => void,
  opts: { valueColor?: string; title?: string } = {}
): HTMLElement {
  return el('div', {
    class: 'stat-row stat-row-link',
    title: opts.title ?? '',
    attrs: { role: 'button', tabindex: 0 },
    on: {
      click: onClick,
      keydown: (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick(); }
      }
    }
  }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', style: opts.valueColor ? { color: opts.valueColor } : undefined }, [value]),
    el('span', { class: 'stat-link-arrow', text: '›' })
  ]);
}

/** Horizontal progress/stat bar with a 0..1 fill. */
export function meter(label: string, value: number, max: number, color: string, valueText?: string): HTMLElement {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return el('div', { class: 'meter' }, [
    el('div', { class: 'meter-head' }, [
      el('span', { class: 'meter-label', text: label }),
      el('span', { class: 'meter-value', text: valueText ?? `${Math.round(value)}` })
    ]),
    el('div', { class: 'meter-track' }, [
      el('div', { class: 'meter-fill', style: { width: `${pct * 100}%`, background: color } })
    ])
  ]);
}

export function badge(text: string, color?: string, extraClass = ''): HTMLElement {
  return el('span', {
    class: `chip ${extraClass}`.trim(),
    text,
    style: color ? { color, borderColor: hexAlpha(color, 0.45), background: hexAlpha(color, 0.14) } : undefined
  });
}

/**
 * Empty state. `icon` is resolved through the pixel-art vocabulary, so the
 * existing callers that pass a glyph now render real artwork at 32px.
 */
export function emptyState(icon: string, title: string, hint: string): HTMLElement {
  return el('div', { class: 'empty-state' }, [
    el('div', { class: 'empty-icon' }, [
      hasIcon(icon) ? pixelIcon(icon, { size: 32 }) : el('span', { text: icon })
    ]),
    el('div', { class: 'empty-title', text: title }),
    el('div', { class: 'empty-hint', text: hint })
  ]);
}

/** Converts `#rrggbb` (or an rgb() string) to an rgba() string with the given alpha. */
export function hexAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgb')) {
    const nums = color.match(/[\d.]+/g);
    if (nums && nums.length >= 3) return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${alpha})`;
    return color;
  }
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return color;
  return `rgba(${(num >> 16) & 0xff}, ${(num >> 8) & 0xff}, ${num & 0xff}, ${alpha})`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (v: number) => `${v}`.padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function titleCase(text: string): string {
  return text.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
