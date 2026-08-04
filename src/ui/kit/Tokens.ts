/**
 * The TypeScript half of the design system.
 *
 * Components need to reason about status in code — pick a colour, decide
 * whether a delta is good news — and they must not do it by reaching for a hex
 * literal. Everything here resolves to a CSS custom property declared in
 * `design/tokens.css`, so the palette has exactly one definition.
 */

/**
 * The four states the whole interface is allowed to express.
 *
 * Kept deliberately short. A vocabulary of four is one the player can actually
 * learn; a vocabulary of twelve is decoration.
 */
export type Status = 'positive' | 'neutral' | 'warning' | 'critical';

/** Where a value sits relative to where it was. Direction, not judgement. */
export type Direction = 'up' | 'down' | 'flat';

/**
 * Who a number is good for.
 *
 * This is the reason TrendIndicator exists as a component rather than a colour
 * lookup. "Grain price −10%" is a fall, but for a city buying grain it is good
 * news, and painting it red would tell the player the opposite of the truth.
 * So direction and sentiment are separate inputs: the caller says which way the
 * figure moved, and — when it isn't obvious — what that means.
 *
 *  - `higher-better`  more is good (population, treasury, literacy)
 *  - `lower-better`   less is good (unrest, famine risk, a price you pay)
 *  - `neutral`        movement carries no verdict (population *share*, year)
 */
export type Sentiment = 'higher-better' | 'lower-better' | 'neutral';

export const STATUS_VAR: Record<Status, string> = {
  positive: 'var(--ae-positive)',
  neutral: 'var(--ae-neutral)',
  warning: 'var(--ae-warning)',
  critical: 'var(--ae-critical)'
};

export const STATUS_FILL_VAR: Record<Status, string> = {
  positive: 'var(--ae-positive-fill)',
  neutral: 'var(--ae-neutral-fill)',
  warning: 'var(--ae-warning-fill)',
  critical: 'var(--ae-critical-fill)'
};

export const STATUS_LINE_VAR: Record<Status, string> = {
  positive: 'var(--ae-positive-line)',
  neutral: 'var(--ae-neutral-line)',
  warning: 'var(--ae-warning-line)',
  critical: 'var(--ae-critical-line)'
};

/** The CSS colour for a status. Use this instead of a literal. */
export function statusColor(status: Status): string {
  return STATUS_VAR[status];
}

/**
 * Resolves a movement into a status, given who benefits from it.
 *
 * A flat reading is never news, so it is always neutral. Otherwise the answer
 * is simply whether the direction and the sentiment agree.
 */
export function statusForTrend(direction: Direction, sentiment: Sentiment = 'higher-better'): Status {
  if (direction === 'flat' || sentiment === 'neutral') return 'neutral';
  const good = sentiment === 'higher-better' ? direction === 'up' : direction === 'down';
  return good ? 'positive' : 'critical';
}

/** Which way a delta points, treating negligible movement as flat. */
export function directionOf(delta: number, epsilon = 1e-6): Direction {
  if (!Number.isFinite(delta) || Math.abs(delta) <= epsilon) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/**
 * Maps a 0..1 fraction onto a status band, for the many meters that mean
 * "how close to trouble is this".
 *
 * `invert` covers the meters where full is the problem rather than the goal
 * (unrest, corruption, plague load) — the bands flip so a full bar reads
 * critical instead of healthy.
 */
export function statusForRatio(ratio: number, invert = false): Status {
  const r = invert ? 1 - clamp01(ratio) : clamp01(ratio);
  if (r >= 0.6) return 'positive';
  if (r >= 0.35) return 'neutral';
  if (r >= 0.15) return 'warning';
  return 'critical';
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Scopes a realm's colour to a subtree.
 *
 * Realm colour is the one accent the simulation itself owns, so it arrives as a
 * runtime value rather than a token. Setting it as a custom property on a
 * container lets every descendant pick it up through `var(--ae-realm)` without
 * each one being handed the colour explicitly.
 */
export function applyRealmAccent(node: HTMLElement, color: string | null | undefined): void {
  if (!color) return;
  node.style.setProperty('--ae-realm', color);
  node.style.setProperty('--ae-realm-fill', withAlpha(color, 0.13));
  node.style.setProperty('--ae-realm-line', withAlpha(color, 0.38));
}

/** `#rgb`, `#rrggbb` or an `rgb()` string, re-expressed with an alpha channel. */
export function withAlpha(color: string, alpha: number): string {
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
