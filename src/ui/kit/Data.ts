/**
 * Data display: the components that put numbers in front of the player.
 *
 * The governing concern is **comparison**. Almost nothing in Aethoria is read as
 * an absolute — a treasury of 4,200 means nothing until you know it was 6,000
 * last decade and the neighbour holds 19,000. So everything here is built to be
 * scanned in a column: fixed row heights, tabular figures, values on a shared
 * right edge, and units set apart from the digits they follow.
 */
import { el, Child } from '../core/Dom';
import { icon, iconOrNull } from './Icon';
import { withTooltip, TooltipSource } from './Tooltip';
import {
  Status, Sentiment, Direction,
  STATUS_VAR, STATUS_FILL_VAR, STATUS_LINE_VAR,
  statusForTrend, directionOf, clamp01, withAlpha
} from './Tokens';

// ============================ NUMBERS ============================

/** Compact magnitude for figures shown in tight space. */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

/** Full figure with thousands separators, for tables where precision matters. */
export function formatFull(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('pt-BR');
}

/** A signed delta, always carrying its sign so a column of them stays readable. */
export function formatDelta(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(digits)}`;
}

export function formatPercent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

// ============================ STAT ============================

export interface StatOptions {
  label: string;
  value: string | number;
  /** Set apart from the digits so "1,204" and "t" never read as one token. */
  unit?: string;
  icon?: string;
  status?: Status;
  /** A movement shown beneath the value. */
  trend?: TrendOptions;
  /** Small print under the label — a period, a source, a qualifier. */
  meta?: string;
  tooltip?: TooltipSource;
  onClick?: () => void;
  class?: string;
}

/**
 * A single headline figure.
 *
 * Use sparingly — a screen of twelve stat tiles is a dashboard, and this is not
 * a dashboard. Reach for `statRow` for anything that belongs in a list.
 */
export function stat(opts: StatOptions): HTMLElement {
  const interactive = Boolean(opts.onClick);
  const node = el(interactive ? 'button' : 'div', {
    class: [
      'ae-stat',
      opts.status ? `ae-stat-${opts.status}` : '',
      interactive ? 'ae-stat-live' : '',
      opts.class
    ].filter(Boolean).join(' '),
    attrs: interactive ? { type: 'button' } : {},
    on: interactive ? { click: () => opts.onClick!() } : undefined
  }, [
    el('div', { class: 'ae-stat-top' }, [
      iconOrNull(opts.icon, { size: 16, class: 'ae-stat-icon' }),
      el('span', { class: 'ae-stat-label', text: opts.label })
    ]),
    el('div', { class: 'ae-stat-figure' }, [
      el('span', {
        class: 'ae-stat-value',
        text: typeof opts.value === 'number' ? formatCompact(opts.value) : opts.value,
        style: opts.status ? { color: STATUS_VAR[opts.status] } : undefined
      }),
      opts.unit ? el('span', { class: 'ae-stat-unit', text: opts.unit }) : null
    ]),
    opts.trend ? trendIndicator(opts.trend) : null,
    opts.meta ? el('span', { class: 'ae-stat-meta', text: opts.meta }) : null
  ]);

  if (opts.tooltip) withTooltip(node, opts.tooltip);
  return node;
}

/** A grid of stats that reflows by available width rather than a fixed column
 *  count, so the same block works in a drawer and across a full screen. */
export function statGrid(children: Child[]): HTMLElement {
  return el('div', { class: 'ae-stat-grid' }, children);
}

// ============================ STAT ROW ============================

export interface StatRowOptions {
  label: string;
  value: Child;
  icon?: string;
  status?: Status;
  unit?: string;
  trend?: TrendOptions;
  tooltip?: TooltipSource;
  /** Makes the row navigate. Rows that answer "which one?" should nearly always
   *  set this — it is how the player follows a figure to its cause. */
  onClick?: () => void;
  /** Marks the row a link dropped the player on, so the row they asked for is
   *  the one they see. */
  highlighted?: boolean;
  class?: string;
}

/**
 * A label/value line — the workhorse of inspectors and detail panels.
 *
 * Fixed height and a shared right edge for values, which is what lets the eye
 * run down a stack of thirty of them.
 */
export function statRow(opts: StatRowOptions): HTMLElement {
  const interactive = Boolean(opts.onClick);
  const node = el('div', {
    class: [
      'ae-row',
      interactive ? 'ae-row-live' : '',
      opts.highlighted ? 'ae-row-focused' : '',
      opts.class
    ].filter(Boolean).join(' '),
    attrs: interactive ? { role: 'button', tabindex: 0 } : {},
    on: interactive
      ? {
          click: () => opts.onClick!(),
          keydown: (ev: KeyboardEvent) => {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); opts.onClick!(); }
          }
        }
      : undefined
  }, [
    iconOrNull(opts.icon, { size: 16, class: 'ae-row-icon' }),
    el('span', { class: 'ae-row-label', text: opts.label }),
    el('span', { class: 'ae-row-value' }, [
      el('span', {
        class: 'ae-row-figure',
        style: opts.status ? { color: STATUS_VAR[opts.status] } : undefined
      }, [opts.value]),
      opts.unit ? el('span', { class: 'ae-row-unit', text: opts.unit }) : null
    ]),
    opts.trend ? trendIndicator({ ...opts.trend, compact: true }) : null,
    interactive ? el('span', { class: 'ae-row-arrow', attrs: { 'aria-hidden': 'true' }, text: '›' }) : null
  ]);

  if (opts.tooltip) withTooltip(node, opts.tooltip);
  return node;
}

/** A stack of rows, sharing one set of hairline separators. */
export function rowList(children: Child[]): HTMLElement {
  return el('div', { class: 'ae-row-list' }, children);
}

// ============================ TREND ============================

export interface TrendOptions {
  /** The change itself. Its sign gives the direction unless `direction` is set. */
  delta?: number;
  /** Overrides the direction derived from `delta` — for movements not expressed
   *  as a single number. */
  direction?: Direction;
  /**
   * Who the movement is good for. **The reason this component exists.**
   *
   * A falling grain price is a fall, and for a city that buys grain it is good
   * news. Painting every negative number red tells the player the opposite of
   * the truth, so the caller states the sentiment and the colour follows from
   * it. Default `higher-better`; pass `neutral` for figures that carry no
   * verdict at all, like a population share or a year.
   */
  sentiment?: Sentiment;
  /** Pre-formatted text. Defaults to a signed form of `delta`. */
  text?: string;
  /** What the change is measured against — "vs. década anterior". */
  period?: string;
  /** Drops the label and shrinks the arrow, for use inside a row. */
  compact?: boolean;
  tooltip?: TooltipSource;
}

const ARROW: Record<Direction, string> = { up: '▲', down: '▼', flat: '—' };

/**
 * A change, coloured by what it means rather than by its sign.
 *
 * The arrow always follows the arithmetic — up is up. Only the colour carries
 * the judgement, and only when the caller has said there is one.
 */
export function trendIndicator(opts: TrendOptions): HTMLElement {
  const direction = opts.direction ?? directionOf(opts.delta ?? 0);
  const status = statusForTrend(direction, opts.sentiment ?? 'higher-better');
  const text = opts.text ?? (opts.delta !== undefined ? formatDelta(opts.delta) : '');

  const node = el('span', {
    class: `ae-trend ae-trend-${direction} ae-trend-${status}${opts.compact ? ' ae-trend-compact' : ''}`,
    style: { color: STATUS_VAR[status] }
  }, [
    el('span', { class: 'ae-trend-arrow', attrs: { 'aria-hidden': 'true' }, text: ARROW[direction] }),
    text ? el('span', { class: 'ae-trend-value', text }) : null,
    opts.period && !opts.compact ? el('span', { class: 'ae-trend-period', text: opts.period }) : null
  ]);

  if (opts.tooltip) withTooltip(node, opts.tooltip);
  return node;
}

// ============================ PROGRESS ============================

export interface ProgressOptions {
  /** 0..1. Clamped, so a caller cannot overflow the track. */
  value: number;
  label?: string;
  /** Right-hand figure. Defaults to a percentage of `value`. */
  valueText?: string;
  status?: Status;
  /** An explicit colour — realm colour, or a good's own colour. Wins over
   *  `status`. */
  color?: string;
  /** A reference mark on the track: a target, a threshold, last year's level. */
  markerAt?: number;
  size?: 'sm' | 'md';
  tooltip?: TooltipSource;
}

/** A horizontal bar. Thin by default: it is a reading, not a feature. */
export function progressBar(opts: ProgressOptions): HTMLElement {
  const value = clamp01(opts.value);
  const fill = opts.color ?? (opts.status ? STATUS_VAR[opts.status] : 'var(--ae-realm)');

  const node = el('div', { class: `ae-progress${opts.size === 'sm' ? ' ae-progress-sm' : ''}` }, [
    opts.label || opts.valueText !== undefined
      ? el('div', { class: 'ae-progress-head' }, [
          el('span', { class: 'ae-progress-label', text: opts.label ?? '' }),
          el('span', { class: 'ae-progress-value', text: opts.valueText ?? formatPercent(value) })
        ])
      : null,
    el('div', { class: 'ae-progress-track' }, [
      el('div', { class: 'ae-progress-fill', style: { width: `${value * 100}%`, background: fill } }),
      opts.markerAt !== undefined
        ? el('div', { class: 'ae-progress-marker', style: { left: `${clamp01(opts.markerAt) * 100}%` } })
        : null
    ])
  ]);

  if (opts.tooltip) withTooltip(node, opts.tooltip);
  return node;
}

// ============================ BADGE ============================

export interface BadgeOptions {
  status?: Status;
  /** An explicit colour, for realm and good colours that are not statuses. */
  color?: string;
  icon?: string;
  /** `solid` for the one badge on screen that must not be missed. */
  variant?: 'soft' | 'solid' | 'outline';
  tooltip?: TooltipSource;
  size?: 'sm' | 'md';
}

/** A small state label. */
export function badge(text: string, opts: BadgeOptions = {}): HTMLElement {
  const variant = opts.variant ?? 'soft';
  const color = opts.color ?? (opts.status ? STATUS_VAR[opts.status] : 'var(--ae-text-secondary)');
  // A custom colour is derived into a translucent fill and a mid-alpha border,
  // the same way the status tokens are. Using the colour itself as the fill made
  // the text exactly the colour of what it sat on, so any badge given a `color`
  // rendered as a solid unreadable block.
  const fill = opts.color
    ? withAlpha(opts.color, 0.14)
    : opts.status ? STATUS_FILL_VAR[opts.status] : 'rgba(214, 197, 168, 0.08)';
  const line = opts.color
    ? withAlpha(opts.color, 0.42)
    : opts.status ? STATUS_LINE_VAR[opts.status] : 'var(--ae-border)';

  const solidFill = opts.color ?? color;
  const style: Partial<CSSStyleDeclaration> =
    variant === 'solid'
      ? { background: solidFill, borderColor: solidFill, color: 'var(--ae-text-on-accent)' }
      : variant === 'outline'
        ? { background: 'transparent', borderColor: line, color }
        : { background: fill, borderColor: line, color };

  const node = el('span', {
    class: `ae-badge ae-badge-${variant}${opts.size === 'sm' ? ' ae-badge-sm' : ''}`,
    style
  }, [
    iconOrNull(opts.icon, { size: 16, class: 'ae-badge-icon' }),
    el('span', { text })
  ]);

  if (opts.tooltip) withTooltip(node, opts.tooltip);
  return node;
}

/** A wrapping row of badges. */
export function badgeRow(children: Child[]): HTMLElement {
  return el('div', { class: 'ae-badge-row' }, children);
}

// ============================ TABLE ============================

export interface Column<T> {
  /** Stable key, used for sort state. */
  key: string;
  header: string;
  /** Builds the cell. Return a node for anything richer than text — an object
   *  link, a badge, a trend. */
  cell: (item: T) => Child;
  /** Numeric columns are right-aligned with tabular figures. That alignment is
   *  the entire reason a table beats a list of rows. */
  align?: 'left' | 'right';
  /** Fixed or preferred width. Omit to let the column share what is left. */
  width?: string;
  /** Returns the value to sort by. Providing it makes the header clickable. */
  sortValue?: (item: T) => number | string;
  tooltip?: TooltipSource;
}

export interface TableOptions<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable identity per row, so highlighting survives a re-sort. */
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  rowTooltip?: (item: T) => TooltipSource;
  /** Row to mark as the one a link jumped to. */
  highlightKey?: string;
  /** Initial sort. Clicking a sortable header re-sorts and re-renders the body
   *  only. */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Shown in place of the body when `rows` is empty. */
  empty?: HTMLElement;
  status?: (item: T) => Status | undefined;
  class?: string;
}

/**
 * A sortable table.
 *
 * Re-sorting rebuilds the body and leaves the header alone, so sorting a long
 * list does not re-run the screen that owns it.
 */
export function table<T>(opts: TableOptions<T>): HTMLElement {
  let sortBy = opts.sortBy ?? null;
  let sortDir = opts.sortDir ?? 'desc';

  const body = el('div', { class: 'ae-table-body' });
  const headerCells = new Map<string, HTMLElement>();

  const gridTemplate = opts.columns
    .map(c => c.width ?? 'minmax(0, 1fr)')
    .join(' ');

  const header = el('div', {
    class: 'ae-table-head',
    style: { gridTemplateColumns: gridTemplate }
  }, opts.columns.map(col => {
    const sortable = Boolean(col.sortValue);
    const cell = el(sortable ? 'button' : 'div', {
      class: [
        'ae-table-th',
        col.align === 'right' ? 'ae-align-right' : '',
        sortable ? 'ae-table-th-sortable' : ''
      ].filter(Boolean).join(' '),
      attrs: sortable ? { type: 'button' } : {},
      on: sortable
        ? {
            click: () => {
              // Clicking the active column flips direction; a new column starts
              // descending, because the first question about a ranked list is
              // almost always "who is at the top".
              if (sortBy === col.key) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
              else { sortBy = col.key; sortDir = 'desc'; }
              syncHeaders();
              renderBody();
            }
          }
        : undefined
    }, [
      el('span', { text: col.header }),
      sortable ? el('span', { class: 'ae-table-sort', attrs: { 'aria-hidden': 'true' } }) : null
    ]);

    if (col.tooltip) withTooltip(cell, col.tooltip);
    headerCells.set(col.key, cell);
    return cell;
  }));

  function syncHeaders(): void {
    for (const [key, cell] of headerCells) {
      const active = key === sortBy;
      cell.classList.toggle('ae-table-th-active', active);
      const marker = cell.querySelector('.ae-table-sort');
      if (marker) marker.textContent = active ? (sortDir === 'desc' ? '▼' : '▲') : '';
    }
  }

  function sortedRows(): T[] {
    const col = opts.columns.find(c => c.key === sortBy);
    if (!col?.sortValue) return opts.rows;
    const dir = sortDir === 'desc' ? -1 : 1;
    // Copied before sorting: the caller's array is very often a live projection
    // of simulation state, and reordering it in place would be a side effect on
    // the model from a render.
    return [...opts.rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'pt-BR') * dir;
    });
  }

  function renderBody(): void {
    body.replaceChildren();
    const rows = sortedRows();

    if (!rows.length) {
      body.appendChild(opts.empty ?? emptyState({
        icon: 'search',
        title: 'Nada a mostrar',
        hint: 'Nenhum registro corresponde aos filtros atuais.'
      }));
      return;
    }

    const frag = document.createDocumentFragment();
    for (const item of rows) {
      const key = opts.rowKey(item);
      const status = opts.status?.(item);
      const rowNode = el(opts.onRowClick ? 'button' : 'div', {
        class: [
          'ae-table-row',
          opts.onRowClick ? 'ae-table-row-live' : '',
          opts.highlightKey === key ? 'ae-row-focused' : '',
          status ? `ae-table-row-${status}` : ''
        ].filter(Boolean).join(' '),
        style: { gridTemplateColumns: gridTemplate },
        dataset: { rowKey: key },
        attrs: opts.onRowClick ? { type: 'button' } : {},
        on: opts.onRowClick ? { click: () => opts.onRowClick!(item) } : undefined
      }, opts.columns.map(col =>
        el('div', {
          class: `ae-table-td${col.align === 'right' ? ' ae-align-right' : ''}`
        }, [col.cell(item)])
      ));

      if (opts.rowTooltip) withTooltip(rowNode, opts.rowTooltip(item));
      frag.appendChild(rowNode);
    }
    body.appendChild(frag);
  }

  syncHeaders();
  renderBody();

  return el('div', { class: `ae-table${opts.class ? ' ' + opts.class : ''}` }, [header, body]);
}

// ============================ EMPTY STATE ============================

export interface EmptyStateOptions {
  /** Icon name from the vocabulary — never a raw glyph. */
  icon?: string;
  title: string;
  /** What the player can do about it. An empty state that only says "nothing
   *  here" wastes the one moment the player is looking for guidance. */
  hint?: string;
  action?: HTMLElement;
  compact?: boolean;
}

export function emptyState(opts: EmptyStateOptions): HTMLElement {
  return el('div', { class: `ae-empty${opts.compact ? ' ae-empty-compact' : ''}` }, [
    icon(opts.icon ?? 'scroll', { size: 32, class: 'ae-empty-icon' }),
    el('div', { class: 'ae-empty-title', text: opts.title }),
    opts.hint ? el('p', { class: 'ae-empty-hint', text: opts.hint }) : null,
    opts.action ?? null
  ]);
}
