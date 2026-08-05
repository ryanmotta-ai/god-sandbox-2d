/**
 * The icon layer.
 *
 * Aethoria draws its own 16×16 pixel art, and the interface should be built from
 * that artwork rather than from system emoji: a Unicode glyph renders as a
 * different picture on every machine, sits on the text baseline instead of the
 * layout grid, and cannot be recoloured. Every icon in new UI goes through here.
 *
 * Two things this module is responsible for:
 *
 *  1. **A vocabulary.** Screens ask for what a thing *is* — `'kingdom'`,
 *     `'trade-route'`, `'treasury'` — not which sprite happens to depict it.
 *     The mapping from concept to artwork lives in one table, so re-drawing an
 *     icon is a one-line change rather than a search across twenty screens.
 *
 *  2. **One consistent fallback.** An icon that does not exist yet renders as
 *     the same quiet bronze lozenge everywhere, flagged in the DOM so it is
 *     findable, instead of each screen improvising a different stand-in.
 */
import { PixelIcons } from '../../renderer/PixelIcons';

/** Sizes are whole multiples of the 16px source grid — pixel art cannot be
 *  scaled to 14px or 20px without turning to mush. */
export type IconSize = 16 | 32 | 48;

/**
 * Every sprite `PixelIcons` can actually draw.
 *
 * Kept in sync by hand, which is the point: adding a name here without adding
 * the artwork is a visible mistake, and asking for a name that is not here is
 * reported rather than silently swallowed.
 */
const DRAWN_ICONS = new Set([
  // Emblems and combat
  'swords', 'shield', 'crown', 'axe', 'pickaxe', 'bow',
  // Creatures and nature
  'lion', 'eagle', 'dragon', 'leaf', 'farm', 'feather',
  // Forces and sky
  'fire', 'lightning', 'moon', 'sun',
  // Places and works
  'castle', 'temple', 'statue', 'city', 'building', 'gem',
  // Trade
  'coin', 'crate', 'route', 'handshake',
  // People
  'person', 'people', 'run',
  // Records and knowledge
  'book', 'scroll', 'calendar', 'chart', 'flask',
  // Time controls
  'pause', 'play', 'forward', 'step', 'snow',
  // Search
  'search',
  // Interface
  'gear', 'save', 'world', 'menu', 'warning', 'close', 'hammer_sickle'
]);

/**
 * Concept → artwork.
 *
 * The left-hand side is the language the game's systems already speak, so a
 * screen can hand over the domain word it has and get a picture back. Several
 * concepts intentionally share one sprite: distinct art for every noun in a
 * simulation this size is a later problem, and a well-chosen shared icon reads
 * better than a bad unique one.
 */
const ALIASES: Record<string, string> = {
  // Citizens
  citizen: 'person', entity: 'person', creature: 'person', ruler: 'crown', heir: 'crown',
  population: 'people', pop: 'people', migration: 'run', family: 'people', society: 'people',

  // Places
  settlement: 'city', town: 'city', capital: 'city',
  fortress: 'castle', wall: 'castle',
  structure: 'building', house: 'building', district: 'building',

  // Realms and rule
  kingdom: 'crown', realm: 'crown', dynasty: 'crown', monarch: 'crown',
  politics: 'temple', government: 'temple', law: 'temple', faction: 'temple', senate: 'temple',

  // Economy
  economy: 'coin', treasury: 'coin', money: 'coin', gold: 'coin', wealth: 'coin', tax: 'coin', price: 'coin',
  good: 'crate', goods: 'crate', resource: 'crate', stockpile: 'crate', supply: 'crate', trade: 'crate',
  industry: 'hammer_sickle', production: 'hammer_sickle', labour: 'hammer_sickle', labor: 'hammer_sickle',

  // Infrastructure
  infrastructure: 'route', road: 'route', railway: 'route', 'trade-route': 'route', route: 'route',
  caravan: 'route', logistics: 'route', port: 'route',

  // Diplomacy and war
  diplomacy: 'handshake', treaty: 'handshake', alliance: 'handshake', peace: 'handshake', relation: 'handshake',
  war: 'swords', warfare: 'swords', battle: 'swords', army: 'swords', military: 'swords', siege: 'swords',
  defence: 'shield', defense: 'shield', fortification: 'shield',

  // Knowledge
  technology: 'flask', tech: 'flask', research: 'flask', science: 'flask', discovery: 'flask',
  education: 'book', literacy: 'book', codex: 'book', bestiary: 'book',
  culture: 'feather', art: 'feather', religion: 'temple',

  // History
  history: 'scroll', chronicle: 'scroll', event: 'scroll', record: 'scroll', legend: 'scroll',
  year: 'calendar', date: 'calendar', time: 'calendar', era: 'sun',

  // World
  ecosystem: 'leaf', nature: 'leaf', biome: 'leaf', forest: 'leaf', wildlife: 'lion',
  agriculture: 'farm', food: 'farm', grain: 'farm', harvest: 'farm',
  map: 'world', terrain: 'world', climate: 'sun',
  disaster: 'fire', plague: 'warning', famine: 'warning', unrest: 'warning', alert: 'warning',

  // Data and interface
  statistics: 'chart', stats: 'chart', trend: 'chart', report: 'chart',
  settings: 'gear', options: 'gear', power: 'lightning', divine: 'lightning',
  find: 'search', inspect: 'search', filter: 'menu', list: 'menu', dismiss: 'close'
};

/**
 * Emoji → artwork.
 *
 * The pre-UI-0 interface uses roughly four hundred Unicode glyphs as icons, and
 * they are migrated screen by screen rather than all at once. This table is the
 * bridge: any component in the kit that is handed an emoji resolves it to real
 * pixel art, so a screen gains the artwork the moment it starts calling a kit
 * component — before anyone has gone through it renaming glyphs.
 *
 * It is a migration aid, not an endorsement. New UI names the concept.
 */
const EMOJI_ALIASES: Record<string, string> = {
  // People and realms
  '👤': 'person', '👥': 'people', '👑': 'crown', '👶': 'person', '🤰': 'person',
  '♂': 'person', '♀': 'person', '💀': 'person', '☠': 'warning', '👁': 'gem',
  '🏳': 'crown', '🎭': 'feather', '♔': 'crown', '♛': 'crown',

  // Settlements and works
  '🏛': 'temple', '🏛️': 'temple', '🏰': 'castle', '🏙': 'city', '🏠': 'building',
  '🏚': 'building', '🏗': 'building', '🏭': 'hammer_sickle', '🏜': 'sun',
  '🗿': 'statue', '🏺': 'crate', '🕯': 'fire', '🧬': 'flask', '🧪': 'flask',

  // War
  '⚔': 'swords', '⚔️': 'swords', '🛡': 'shield', '🛡️': 'shield', '🩸': 'swords',
  '🪓': 'axe', '🏹': 'bow', '⛏': 'pickaxe', '⛏️': 'pickaxe', '🔨': 'hammer_sickle',
  '⚒': 'hammer_sickle', '✊': 'swords', '🚩': 'crown', '⚖': 'temple',

  // Trade and wealth
  '🪙': 'coin', '💰': 'coin', '💎': 'gem', '📦': 'crate', '🍽': 'farm', '🍴': 'farm',
  '🍲': 'farm', '🌾': 'farm', '🐫': 'route', '🚚': 'route', '🚂': 'route',
  '🚢': 'route', '⚓': 'route', '🛣': 'route', '🛤': 'route', '🏁': 'route',
  '🔗': 'route', '🌐': 'world', '🏆': 'crown', '👷': 'hammer_sickle', '🏃': 'run',

  // Diplomacy
  '🤝': 'handshake', '🕊': 'handshake', '🐍': 'warning', '😠': 'swords',
  '🙂': 'handshake', '⇄': 'route', '↔': 'route',

  // Knowledge and record
  '📜': 'scroll', '📖': 'book', '📚': 'book', '🎓': 'flask', '💡': 'flask',
  '📅': 'calendar', '🕒': 'calendar', '📈': 'chart', '📉': 'chart', '📊': 'chart',
  '🪶': 'feather', '🌟': 'sun', '⭐': 'sun', '★': 'sun', '✦': 'sun', '✨': 'lightning',

  // World and nature
  '🌍': 'world', '🗺': 'world', '🌿': 'leaf', '🌱': 'leaf', '🌳': 'leaf',
  '🌲': 'leaf', '🍃': 'leaf', '🌊': 'world', '🌌': 'moon', '🌙': 'moon',
  '🌑': 'moon', '☀': 'sun', '☀️': 'sun', '🌡': 'sun', '🌡️': 'sun',
  '❄': 'snow', '❄️': 'snow', '⏸': 'pause', '▶': 'play', '⏩': 'forward',
  '⏭': 'step', '⏭️': 'step',
  '🔥': 'fire', '⚡': 'lightning', '💥': 'fire', '💧': 'world', '⛰': 'pickaxe',
  '🪨': 'pickaxe', '🏝': 'leaf', '🌴': 'leaf',

  // Creatures
  '🦁': 'lion', '🦅': 'eagle', '🐉': 'dragon', '🐺': 'lion', '🐻': 'lion',
  '🦌': 'lion', '🐾': 'lion', '🐛': 'leaf', '💖': 'gem', '👟': 'run',

  // Interface
  '⚙': 'gear', '⚙️': 'gear', '💾': 'save', '📂': 'save', '🗑': 'close',
  '✕': 'close', '✓': 'close', '❓': 'book', '☰': 'menu', '⚠': 'warning',
  '⚠️': 'warning', '⛔': 'warning', '🔍': 'search', '🖱': 'gear', '🖥': 'gear',
  '🎨': 'feather', '🎵': 'feather', '🔊': 'feather', '🔇': 'feather',
  '🔄': 'route', '🎥': 'gem', '📍': 'city', '🏅': 'crown', '🧠': 'book',

  // The divine-powers palette. These are the last glyph-authored icons in the
  // interface; sharing sprites here is deliberate — the power's own label
  // distinguishes "raise" from "lower", and a lozenge next to a label reads as a
  // missing asset in a way a reused pickaxe does not. Dedicated power artwork is
  // a later-phase job.
  '⛰️': 'pickaxe', '🏔️': 'pickaxe', '🕳️': 'pickaxe', '⚪': 'pickaxe',
  '🌋': 'fire', '☄️': 'fire', '🔴': 'fire', '🧊': 'snow', '🌧️': 'world',
  '🏜️': 'sun', '☘️': 'leaf', '🟢': 'leaf',
  '🐊': 'dragon', '🐗': 'lion', '🦣': 'lion',
  '☣️': 'warning', '💪': 'shield', '👁️': 'gem', '🔮': 'gem',
  '🛣️': 'route', '🧹': 'close',
  '↩': 'menu', '⬆': 'chart', '⬇': 'chart', '⬜': 'crate', '➖': 'menu',
  '🟡': 'coin', '🟤': 'crate', '🔺': 'chart', '🔻': 'chart', '🚧': 'warning',
  '☭': 'hammer_sickle'
};

/** Ids already reported as missing, so a bad name warns once instead of per frame. */
const warned = new Set<string>();

/**
 * Resolves a requested name to a sprite id that can actually be drawn.
 * Returns `null` when nothing matches, which is what triggers the fallback.
 */
export function resolveIconId(name: string): string | null {
  const raw = name.trim();
  // Emoji are matched before lower-casing: the table is keyed by the glyph, and
  // some glyphs carry a variation selector that must survive the lookup.
  const viaEmoji = EMOJI_ALIASES[raw] ?? EMOJI_ALIASES[raw.replace(/️/g, '')];
  if (viaEmoji && DRAWN_ICONS.has(viaEmoji)) return viaEmoji;

  const key = raw.toLowerCase();
  if (DRAWN_ICONS.has(key)) return key;
  const alias = ALIASES[key];
  if (alias && DRAWN_ICONS.has(alias)) return alias;
  return null;
}

/** Whether real artwork exists for a name — for callers that would rather omit
 *  an icon than show a placeholder. */
export function hasIcon(name: string): boolean {
  return resolveIconId(name) !== null;
}

export interface IconOptions {
  size?: IconSize;
  /** Extra class names, for positioning within a parent component. */
  class?: string;
  /**
   * Accessible label. Icons are decorative by default — they nearly always sit
   * beside the text they illustrate, and announcing both just doubles it up.
   * Pass this only when the icon is the sole carrier of meaning.
   */
  label?: string;
}

/**
 * An icon element.
 *
 * An `<img>` around a cached data URL rather than a canvas: `PixelIcons` hands
 * out one canvas per id, and a DOM node can only live in one place, so
 * appending the canvas would tear the icon out of every other place it is
 * drawn.
 */
export function icon(name: string, opts: IconOptions = {}): HTMLImageElement {
  const size = opts.size ?? 16;
  const resolved = resolveIconId(name);

  if (!resolved && !warned.has(name)) {
    warned.add(name);
    console.warn(`[ui] No pixel icon for "${name}" — using the fallback. Add it to PixelIcons and DRAWN_ICONS, or map it in Icon.ts ALIASES.`);
  }

  const node = document.createElement('img');
  // An unresolved name is still passed through: PixelIcons answers any unknown
  // id with the fallback lozenge, so the layout keeps its slot either way.
  node.src = PixelIcons.getIconUrl(resolved ?? `__missing_${name}`);
  node.className = `ae-icon ae-icon-${size}${opts.class ? ' ' + opts.class : ''}`;
  node.width = size;
  node.height = size;
  node.draggable = false;

  if (opts.label) {
    node.alt = opts.label;
  } else {
    node.alt = '';
    node.setAttribute('aria-hidden', 'true');
  }

  // Marks the gap in the artwork so missing icons can be found with a selector
  // instead of by eye.
  if (!resolved) node.dataset.iconMissing = name;

  return node;
}

/** An icon, or nothing — for the many optional-icon slots in the kit. */
export function iconOrNull(name: string | undefined | null, opts: IconOptions = {}): HTMLImageElement | null {
  return name ? icon(name, opts) : null;
}

/**
 * Re-points an existing icon element at different artwork.
 *
 * For the handful of icons that genuinely change while the game runs — the
 * current era, a tool's state — so a live HUD swaps one attribute instead of
 * rebuilding the element. Returns early when nothing changed, because this sits
 * on paths that run every frame.
 */
export function setIcon(node: HTMLImageElement, name: string): void {
  const resolved = resolveIconId(name);
  const url = PixelIcons.getIconUrl(resolved ?? `__missing_${name}`);
  if (node.src === url) return;
  node.src = url;
}
