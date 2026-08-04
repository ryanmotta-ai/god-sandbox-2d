/**
 * The Aethoria UI kit.
 *
 * Import from here — `import { panel, statRow, objectLink } from '../kit'` — so
 * that a component can be moved between files without touching the screens that
 * use it.
 *
 * What belongs in this kit: anything a future screen will need more than once.
 * What does not: anything specific to one screen, and anything that reads the
 * simulation. Nothing here imports GameContext, and that is deliberate — the
 * kit renders values it is handed, which is what keeps it cheap to reason about
 * and impossible to accidentally couple to the tick loop.
 */

// Tokens and semantics
export {
  type Status, type Direction, type Sentiment,
  STATUS_VAR, STATUS_FILL_VAR, STATUS_LINE_VAR,
  statusColor, statusForTrend, statusForRatio, directionOf,
  applyRealmAccent, withAlpha, clamp01
} from './Tokens';

// Icons
export { icon, iconOrNull, setIcon, hasIcon, resolveIconId, type IconSize, type IconOptions } from './Icon';

// Tooltip
export { tooltip, withTooltip, type TooltipContent, type TooltipSource } from './Tooltip';

// Containers and screen structure
export {
  panel, section, divider, tabs, screenShell,
  type PanelOptions, type TabItem, type TabStrip,
  type ScreenShell, type ScreenShellOptions
} from './Panel';

// Controls
export {
  button, iconButton, searchInput, filterGroup,
  type ButtonVariant, type ButtonOptions, type IconButtonOptions,
  type SearchInputOptions, type FilterOption, type FilterGroup
} from './Controls';

// Data display
export {
  stat, statGrid, statRow, rowList,
  trendIndicator, progressBar, badge, badgeRow,
  table, emptyState,
  formatCompact, formatFull, formatDelta, formatPercent,
  type StatOptions, type StatRowOptions, type TrendOptions,
  type ProgressOptions, type BadgeOptions,
  type Column, type TableOptions, type EmptyStateOptions
} from './Data';

// Object references
export {
  objectLink, objectNav, KIND_LABEL,
  type ObjectKind, type ObjectRef, type ObjectLinkOptions,
  type ObjectOpener, type ObjectDescriber
} from './ObjectLink';
