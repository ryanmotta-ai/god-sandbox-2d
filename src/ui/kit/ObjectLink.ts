/**
 * Object links: the interface's cross-reference mechanism.
 *
 * Every figure in a simulation this size raises a follow-up question. A city's
 * grain deficit is about a *good* and a *trade route*; a war is about two
 * *kingdoms*; a law was passed by a *faction* and resented by a named
 * *citizen*. If those nouns are plain text, the player has to go and find the
 * screen that explains them. If every one of them is a link, the whole world
 * becomes navigable from wherever you happen to be standing.
 *
 * That is what this module prepares. It is deliberately split in two:
 *
 *  - `ObjectRef` — a *reference* to something in the world: what kind of thing
 *    it is, its id, and how to label it. Cheap to build, holds no simulation
 *    objects, so a table can mint a thousand of them per rebuild.
 *
 *  - `objectNav` — the registry that gives references behaviour. Later phases
 *    register, per kind, how to open it and how to describe it on hover.
 *
 * UI-0 ships the vocabulary and the component, and registers no handlers. A
 * link whose kind has no handler renders as a labelled, styled, *non*-clickable
 * reference rather than a button that lies about being live — so screens can be
 * written against this API now and light up as each kind is wired in.
 */
import { el } from '../core/Dom';
import { iconOrNull } from './Icon';
import { withTooltip, TooltipContent } from './Tooltip';
import { STATUS_VAR, Status } from './Tokens';

/** The things the interface can point at. */
export type ObjectKind =
  | 'citizen'
  | 'city'
  | 'kingdom'
  | 'good'
  | 'building'
  | 'war'
  | 'technology'
  | 'trade-route';

/**
 * A pointer to something in the world.
 *
 * `id` is whatever the owning system uses as its key; this layer never
 * interprets it, it only hands it back to the registered handler.
 */
export interface ObjectRef {
  kind: ObjectKind;
  id: string;
  /** What to show. The caller supplies it because only the caller knows whether
   *  the player should see a formal name, a title, or a shortened form. */
  name: string;
  /** Icon name, resolved through the icon vocabulary. Defaults per kind. */
  icon?: string;
  /** Realm colour or similar, tinting the link. */
  accent?: string;
  /** A condition worth flagging at the reference — a city under siege, a
   *  technology stalled, a route blockaded. */
  status?: Status;
  /** Short qualifier shown after the name in muted type: a realm, a year, a
   *  category. Keeps a bare name from being ambiguous in a long list. */
  qualifier?: string;
}

/** Default artwork per kind, so a ref only names an icon when it wants to
 *  override the obvious choice. */
const KIND_ICON: Record<ObjectKind, string> = {
  citizen: 'citizen',
  city: 'city',
  kingdom: 'kingdom',
  good: 'good',
  building: 'building',
  war: 'war',
  technology: 'technology',
  'trade-route': 'trade-route'
};

/** How each kind is named in prose — used in tooltips and empty states. */
export const KIND_LABEL: Record<ObjectKind, string> = {
  citizen: 'Cidadão',
  city: 'Cidade',
  kingdom: 'Reino',
  good: 'Bem',
  building: 'Construção',
  war: 'Guerra',
  technology: 'Tecnologia',
  'trade-route': 'Rota de Comércio'
};

/** Opens the thing a reference points at. */
export type ObjectOpener = (ref: ObjectRef) => void;
/** Supplies hover detail for a reference. Returning `null` falls back to the
 *  generic tooltip, which is better than an empty panel. */
export type ObjectDescriber = (ref: ObjectRef) => TooltipContent | null;

/**
 * The per-kind behaviour registry.
 *
 * Kept as a registry rather than a switch so that the screen that *owns* a kind
 * declares how to open it, next to the code that knows how. Nothing here
 * depends on GameContext, which is what keeps this module importable from
 * anywhere without dragging the engine in behind it.
 */
class ObjectNavigator {
  private openers = new Map<ObjectKind, ObjectOpener>();
  private describers = new Map<ObjectKind, ObjectDescriber>();

  /** Declares how to open one kind of object. Later phases call this once, at
   *  wiring time, for each kind they take responsibility for. */
  public registerOpener(kind: ObjectKind, opener: ObjectOpener): void {
    this.openers.set(kind, opener);
  }

  /** Declares how to describe one kind on hover. */
  public registerDescriber(kind: ObjectKind, describer: ObjectDescriber): void {
    this.describers.set(kind, describer);
  }

  /** Whether this kind has somewhere to go yet. Components use it to decide
   *  between an interactive link and a plain reference. */
  public canOpen(kind: ObjectKind): boolean {
    return this.openers.has(kind);
  }

  public open(ref: ObjectRef): void {
    const opener = this.openers.get(ref.kind);
    if (!opener) {
      console.warn(`[ui] No opener registered for object kind "${ref.kind}" (${ref.id}).`);
      return;
    }
    opener(ref);
  }

  /**
   * Hover content for a reference.
   *
   * Falls back to naming the kind, which is genuinely useful on its own: in a
   * dense list "Aldréth" is ambiguous and "Reino — Aldréth" is not.
   */
  public describe(ref: ObjectRef): TooltipContent {
    const custom = this.describers.get(ref.kind)?.(ref);
    if (custom) return custom;
    return {
      title: ref.name,
      description: ref.qualifier ? `${KIND_LABEL[ref.kind]} · ${ref.qualifier}` : KIND_LABEL[ref.kind],
      icon: ref.icon ?? KIND_ICON[ref.kind],
      accent: ref.accent,
      footnote: this.canOpen(ref.kind) ? 'Clique para abrir' : undefined
    };
  }

  /** Drops every registration. Used when a world is torn down, so handlers
   *  cannot outlive the simulation they close over. */
  public reset(): void {
    this.openers.clear();
    this.describers.clear();
  }
}

export const objectNav = new ObjectNavigator();

export interface ObjectLinkOptions {
  /**
   * `inline` sits inside a sentence or a table cell; `chip` is a bordered
   * standalone token for lists and headers.
   */
  variant?: 'inline' | 'chip';
  /** Hide the icon where a column of them would be noise. */
  showIcon?: boolean;
  /** Overrides the registry's hover content for this one link. */
  tooltip?: TooltipContent | (() => TooltipContent | null);
  /** Overrides the registered opener — for a link that navigates somewhere
   *  specific rather than to the object's own view. */
  onOpen?: (ref: ObjectRef) => void;
  class?: string;
}

/**
 * A reference to a world object, rendered as a link.
 *
 * Interactive only when there is somewhere to go: with no opener registered and
 * no `onOpen` override, this produces a styled but inert reference — it carries
 * the icon, the name and the status, and it does not pretend to be a button.
 */
export function objectLink(ref: ObjectRef, opts: ObjectLinkOptions = {}): HTMLElement {
  const variant = opts.variant ?? 'inline';
  const open = opts.onOpen ?? (objectNav.canOpen(ref.kind) ? (r: ObjectRef) => objectNav.open(r) : null);
  const iconName = ref.icon ?? KIND_ICON[ref.kind];

  const classes = [
    'ae-object',
    `ae-object-${variant}`,
    `ae-object-kind-${ref.kind}`,
    open ? 'ae-object-live' : 'ae-object-static',
    opts.class
  ].filter(Boolean).join(' ');

  const node = el(open ? 'button' : 'span', {
    class: classes,
    dataset: { objectKind: ref.kind, objectId: ref.id },
    attrs: open ? { type: 'button' } : {},
    on: open ? { click: (ev: MouseEvent) => { ev.stopPropagation(); open(ref); } } : undefined
  }, [
    opts.showIcon === false ? null : iconOrNull(iconName, { size: 16, class: 'ae-object-icon' }),
    el('span', { class: 'ae-object-name', text: ref.name }),
    ref.qualifier ? el('span', { class: 'ae-object-qualifier', text: ref.qualifier }) : null,
    ref.status
      ? el('span', { class: 'ae-object-status', style: { background: STATUS_VAR[ref.status] } })
      : null
  ]);

  if (ref.accent) node.style.setProperty('--ae-realm', ref.accent);

  return withTooltip(node, opts.tooltip ?? (() => objectNav.describe(ref)));
}
