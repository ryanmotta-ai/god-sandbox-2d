/**
 * The realm dossier.
 *
 * UI-3 answered "why is this city doing well or badly?". This is the same question
 * one level up, where the answer is different in kind: a realm is not a big city,
 * it is a *structure* — a government with laws, a society with factions, a set of
 * settlements with roles, a foreign policy, an army, and a technological base that
 * may or may not be able to operate what it knows.
 *
 * So the screen is organised around three questions, in this order:
 *
 *  1. **What is wrong?** Critical issues, capped at five and ranked, then the
 *     named conditions with their arithmetic.
 *  2. **What kind of realm is this?** The cities and their economic roles, the
 *     government, the factions, the culture.
 *  3. **Why is it strong or weak?** The dependency panels, the idle technologies,
 *     the infrastructure gaps — each one navigable to the thing it is about.
 *
 * What this screen deliberately does *not* do is rebuild the global Economy,
 * Politics, Diplomacy, Infrastructure, Technology or Warfare screens. It consumes
 * the same simulation state they do and links to them; there is one copy of each
 * of those views and it is not here.
 *
 * The whole aggregation runs behind `RealmMetricsCache` on a slow cadence.
 * Counting an entire realm's population is the most expensive thing the interface
 * does and it never happens per frame.
 */
import { el } from '../core/Dom';
import {
  screenShell, tabs, badge, badgeRow, button, icon, withTooltip, objectLink,
  emptyState, formatCompact, formatPercent, tooltip, objectNav,
  type TabStrip, type TabItem
} from '../kit';
import { RealmMetricsCache, type RealmMetrics } from '../realm/RealmMetrics';
import { criticalIssues } from '../realm/RealmDiagnostics';
import {
  buildOverview, buildEconomy, buildSociety, buildPolitics, buildDiplomacy,
  buildMilitary, buildInfrastructure, buildTechnology, buildHistory
} from '../realm/RealmTabs';
import type { Child } from '../core/Dom';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import type { Kingdom } from '../../civ/Kingdom';
import type { GoodId } from '../../civ/Goods';

/** The species' own name from its definition, not its internal id. */
function speciesName(species: string): string {
  return SPECIES_DEFINITIONS[species as keyof typeof SPECIES_DEFINITIONS]?.name ?? species;
}

/** What the tab builders are allowed to ask of the game. */
export interface RealmScreenHost {
  readonly ctx: GameContext;
  /** Opens a good in the economy screen. */
  openGood(good: GoodId): void;
  /** Opens the UI-3 city dossier. */
  openCityDossier(cityId: string, highlightCondition?: string): void;
  /** Retargets this dossier at another realm. */
  openRealm(kingdomId: string): void;
  /** Closes the dossier, selects the citizen and opens the inspector on them. */
  openCitizen(entityId: string): void;
  /** Closes the dossier and centres the camera. */
  goToMap(x: number, y: number): void;
  openChronicle(): void;
  openTechTree(): void;
  openWarfare(): void;
  /** The dynasty screen already exists; this links to it rather than rebuilding it. */
  openDynasty(): void;
}

type TabId =
  | 'overview' | 'economy' | 'society' | 'politics' | 'diplomacy'
  | 'military' | 'infrastructure' | 'technology' | 'history';

const ALL_TABS: TabId[] = [
  'overview', 'economy', 'society', 'politics', 'diplomacy',
  'military', 'infrastructure', 'technology', 'history'
];

export class RealmScreen implements Screen, RealmScreenHost {
  public readonly id = 'realm' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  public ctx!: GameContext;

  private kingdomId: string | null = null;
  private active: TabId = 'overview';
  private strip: TabStrip | null = null;
  private shell: { root: HTMLElement; body: HTMLElement; setContent(c: Child[]): void } | null = null;
  private metricsCache = new RealmMetricsCache();
  private renderedYear = -1;
  /** Condition to draw the player's eye to, from a deep link. */
  private highlight: string | null = null;

  // ============================ SCREEN ============================

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;

    // A different realm resets the view; re-opening the same one keeps the tab the
    // player was on, which is what makes flicking between realms usable.
    const requested = params?.focusKingdom ?? this.kingdomId ?? this.firstSelectableRealm(ctx);
    if (requested !== this.kingdomId) {
      this.kingdomId = requested ?? null;
      this.active = 'overview';
      this.metricsCache.invalidate();
    }
    if (params?.tab && this.isTabId(params.tab)) this.active = params.tab;
    this.highlight = params?.highlightCondition ?? null;

    const kingdom = this.kingdomId ? ctx.sim.kingdoms.get(this.kingdomId) ?? null : null;
    if (!kingdom) {
      const shell = screenShell({
        title: 'Reino',
        icon: 'kingdom',
        onClose: () => ctx.screens.back(),
        width: 'narrow'
      });
      shell.setContent([emptyState({
        icon: 'kingdom',
        title: 'Nenhum reino',
        hint: 'Não há reino selecionado, ou ele deixou de existir.',
        action: button('Voltar', () => ctx.screens.back(), { variant: 'secondary', size: 'sm', icon: 'close' })
      })]);
      return shell.root;
    }

    const metrics = this.metricsCache.get(kingdom, ctx, performance.now());

    const shell = screenShell({
      title: kingdom.name,
      subtitle: this.subtitleFor(kingdom, metrics),
      icon: 'kingdom',
      onClose: () => ctx.screens.back(),
      width: 'wide',
      actions: this.headerActions(kingdom, metrics)
    });
    this.shell = shell;

    // The realm's colour, applied as a scoped custom property so the header edge
    // and the accents pick it up while the panels stay stone. Item 3 asks for the
    // realm's identity in moderation, and a screen painted in a realm's banner
    // colour is a screen you cannot read.
    shell.root.style.setProperty('--ae-realm', kingdom.color);
    shell.root.classList.add('ae-realm-screen');

    this.strip = tabs(this.tabItems(metrics), this.active, id => {
      this.active = id as TabId;
      this.renderTab();
    });
    shell.root.insertBefore(this.strip.root, shell.body);
    shell.root.insertBefore(this.buildIdentityBar(kingdom, metrics), this.strip.root);

    this.renderTab();
    return shell.root;
  }

  /**
   * Rebuilt on a slow cadence while open.
   *
   * The metrics cache decides whether anything is recomputed; this only decides
   * when to redraw. Both are far slower than the frame rate on purpose — these
   * figures move on the scale of a simulated year.
   */
  public tick(ctx: GameContext): void {
    if (!this.kingdomId || !this.shell) return;
    const kingdom = ctx.sim.kingdoms.get(this.kingdomId);
    if (!kingdom) return;
    const metrics = this.metricsCache.get(kingdom, ctx, performance.now());
    if (metrics.year !== this.renderedYear) this.renderTab();
  }

  public dispose(): void {
    tooltip.hide();
    this.shell = null;
    this.strip = null;
  }

  // ============================ HEADER ============================

  private subtitleFor(kingdom: Kingdom, metrics: RealmMetrics): string {
    return [
      kingdom.governmentInfo.name,
      speciesName(kingdom.species),
      `fundado no ano ${kingdom.foundingYear}`,
      `${metrics.age} ano(s) de história`
    ].join(' · ');
  }

  private headerActions(kingdom: Kingdom, metrics: RealmMetrics): Child[] {
    const realms = this.navigableRealms();
    const index = realms.findIndex(k => k.id === kingdom.id);
    const capital = metrics.capital;

    return [
      realms.length > 1
        ? el('div', { class: 'ae-realm-nav' }, [
            withTooltip(
              el('button', {
                class: 'ae-realm-nav-btn',
                attrs: { type: 'button', 'aria-label': 'Reino anterior' },
                on: { click: () => this.switchTo(realms[(index - 1 + realms.length) % realms.length].id) }
              }, [el('span', { text: '‹' })]),
              { title: 'Reino anterior', description: realms[(index - 1 + realms.length) % realms.length].name }
            ),
            el('span', { class: 'ae-realm-nav-count', text: `${index + 1} / ${realms.length}` }),
            withTooltip(
              el('button', {
                class: 'ae-realm-nav-btn',
                attrs: { type: 'button', 'aria-label': 'Próximo reino' },
                on: { click: () => this.switchTo(realms[(index + 1) % realms.length].id) }
              }, [el('span', { text: '›' })]),
              { title: 'Próximo reino', description: realms[(index + 1) % realms.length].name }
            )
          ])
        : null,

      capital
        ? button('Abrir capital', () => this.openCityDossier(capital.id), {
            variant: 'primary', size: 'sm', icon: 'city',
            tooltip: { title: `Dossiê de ${capital.name}`, description: 'Abre o dossiê completo da capital.' }
          })
        : null,

      capital
        ? button('Centralizar capital', () => this.goToMap(capital.x, capital.y), {
            variant: 'secondary', size: 'sm', icon: 'map',
            tooltip: { title: 'Ir à capital', description: `Fecha o dossiê e centraliza a câmera em ${capital.name}.` }
          })
        : null,

      button('Comparar reinos', () => this.ctx.screens.open('kingdoms', { focusKingdom: kingdom.id }), {
        variant: 'ghost', size: 'sm', icon: 'kingdom',
        tooltip: { title: 'Reinos', description: 'Abre a tela de comparação entre reinos.', shortcut: 'K' }
      })
    ];
  }

  /**
   * Identity strip: banner, species, government, ruler, and the five figures that
   * say what this realm *is* before any tab is opened.
   */
  private buildIdentityBar(kingdom: Kingdom, metrics: RealmMetrics): HTMLElement {
    const issues = criticalIssues(metrics, 5);
    const critical = issues.filter(i => i.severity === 'critical').length;

    return el('div', { class: 'ae-realm-identity' }, [
      el('div', { class: 'ae-realm-banner' }, [
        // `emblem` is an icon id from `KINGDOM_EMBLEMS`, not a glyph. Rendering it
        // as text prints the word "lightning" where the sigil should be.
        icon(kingdom.emblem, { size: 16, class: 'ae-realm-banner-emblem' }),
        el('div', { class: 'ae-realm-banner-bars' }, [
          el('span', { class: 'ae-realm-banner-bar', style: { background: kingdom.color } }),
          el('span', { class: 'ae-realm-banner-bar', style: { background: kingdom.secondaryColor } })
        ])
      ]),

      el('div', { class: 'ae-realm-identity-main' }, [
        badgeRow([
          badge(kingdom.governmentInfo.name, { size: 'sm', variant: 'outline', icon: 'politics' }),
          badge(speciesName(kingdom.species), { size: 'sm', variant: 'outline', icon: 'population' }),
          metrics.wars.length
            ? badge(`Em guerra · ${metrics.wars.length}`, { size: 'sm', status: 'critical', icon: 'war' })
            : badge('Em paz', { size: 'sm', status: 'positive', variant: 'outline', icon: 'diplomacy' }),
          critical ? badge(`${critical} crítico(s)`, { size: 'sm', status: 'critical', icon: 'warning' }) : null,
          metrics.dynasty ? badge(`Casa ${metrics.dynasty}`, { size: 'sm', variant: 'outline', icon: 'dynasty' }) : null
        ]),

        el('div', { class: 'ae-realm-headline' }, [
          this.headlineFigure('População', formatCompact(metrics.population), 'population'),
          this.headlineFigure('Cidades', `${metrics.cities.length}`, 'city'),
          this.headlineFigure('Território', formatCompact(metrics.territory), 'map'),
          this.headlineFigure('Legitimidade', formatPercent(metrics.legitimacy), 'crown'),
          this.headlineFigure('Idade', `${metrics.age}`, 'calendar'),

          metrics.ruler
            ? el('div', { class: 'ae-realm-headline-ruler' }, [
                icon('crown', { size: 16 }),
                el('div', { class: 'ae-realm-headline-text' }, [
                  objectLink(
                    { kind: 'citizen', id: metrics.ruler.id, name: metrics.ruler.title ?? metrics.ruler.name, accent: kingdom.color },
                    { showIcon: false, onOpen: () => this.openCitizen(metrics.ruler!.id) }
                  ),
                  el('span', { class: 'ae-realm-headline-label', text: kingdom.governmentInfo.rulerTitle })
                ])
              ])
            : el('div', { class: 'ae-realm-headline-ruler' }, [
                icon('crown', { size: 16 }),
                el('div', { class: 'ae-realm-headline-text' }, [
                  el('span', { class: 'ae-realm-headline-value', text: 'Trono vago' }),
                  el('span', { class: 'ae-realm-headline-label', text: 'Governante' })
                ])
              ]),

          metrics.capital
            ? el('div', { class: 'ae-realm-headline-ruler' }, [
                icon('city', { size: 16 }),
                el('div', { class: 'ae-realm-headline-text' }, [
                  objectLink(
                    { kind: 'city', id: metrics.capital.id, name: metrics.capital.name, accent: kingdom.color },
                    { showIcon: false, onOpen: () => this.openCityDossier(metrics.capital!.id) }
                  ),
                  el('span', { class: 'ae-realm-headline-label', text: 'Capital' })
                ])
              ])
            : null
        ])
      ])
    ]);
  }

  private headlineFigure(label: string, value: string, iconName: string): HTMLElement {
    return el('div', { class: 'ae-realm-headline-item' }, [
      icon(iconName, { size: 16, class: 'ae-realm-headline-icon' }),
      el('div', { class: 'ae-realm-headline-text' }, [
        el('span', { class: 'ae-realm-headline-value', text: value }),
        el('span', { class: 'ae-realm-headline-label', text: label })
      ])
    ]);
  }

  // ============================ TABS ============================

  /**
   * The tab list, with empty tabs dropped.
   *
   * The brief forbids empty tabs, and a freshly founded tribe genuinely has no
   * diplomacy, no rail and no history. Rather than nine tabs of which four are
   * dead, they appear as the realm acquires the thing they are about — and their
   * badge counts say what is behind each one before it is clicked.
   */
  private tabItems(m: RealmMetrics): TabItem[] {
    const items: TabItem[] = [
      { id: 'overview', label: 'Visão geral', icon: 'kingdom' }
    ];

    if (m.goods.length || m.lastLedger) {
      items.push({
        id: 'economy', label: 'Economia', icon: 'economy',
        badge: m.dependencies.length || undefined,
        tooltip: m.dependencies.length
          ? { title: 'Economia', description: `${m.dependencies.length} bem(ns) com dependência de importação` }
          : undefined
      });
    }
    if (m.factions.length) {
      const radical = m.factions.filter(f => f.radicalization >= 0.6).length;
      items.push({
        id: 'society', label: 'Sociedade', icon: 'population',
        badge: radical || undefined,
        tooltip: radical
          ? { title: 'Sociedade', description: `${radical} facção(ões) radicalizada(s)` }
          : undefined
      });
    }
    items.push({ id: 'politics', label: 'Política', icon: 'politics', badge: m.laws.length || undefined });

    if (m.relations.length) {
      items.push({
        id: 'diplomacy', label: 'Diplomacia', icon: 'diplomacy',
        badge: m.relations.length
      });
    }
    if (m.army.total > 0 || m.wars.length || m.militaryPower > 0) {
      items.push({
        id: 'military', label: 'Militar', icon: 'war',
        badge: m.wars.length || undefined,
        tooltip: m.wars.length
          ? { title: 'Militar', description: `${m.wars.length} guerra(s) em curso` }
          : undefined
      });
    }
    if (m.infrastructure.roadLevel > 0 || m.infrastructure.railTiles > 0 || m.infrastructure.ports > 0 || m.infrastructure.harbours > 0) {
      items.push({
        id: 'infrastructure', label: 'Infraestrutura', icon: 'trade-route',
        badge: m.infrastructure.bottlenecks.length || undefined
      });
    }
    if (m.technology.known > 0) {
      items.push({
        id: 'technology', label: 'Tecnologia', icon: 'technology',
        badge: m.technology.idleCapabilities.length || undefined,
        tooltip: m.technology.idleCapabilities.length
          ? { title: 'Tecnologia', description: `${m.technology.idleCapabilities.length} tecnologia(s) conhecida(s) sem base para operar` }
          : undefined
      });
    }
    items.push({ id: 'history', label: 'História', icon: 'history' });

    return items;
  }

  private isTabId(value: string): value is TabId {
    return (ALL_TABS as string[]).includes(value);
  }

  private renderTab(): void {
    if (!this.shell || !this.kingdomId) return;
    const kingdom = this.ctx.sim.kingdoms.get(this.kingdomId);
    if (!kingdom) {
      this.shell.setContent([emptyState({
        icon: 'kingdom',
        title: 'Este reino não existe mais',
        hint: 'Foi conquistado ou extinto enquanto o dossiê estava aberto.',
        action: button('Voltar', () => this.ctx.screens.back(), { variant: 'secondary', size: 'sm', icon: 'close' })
      })]);
      return;
    }

    const metrics = this.metricsCache.get(kingdom, this.ctx, performance.now());
    this.renderedYear = metrics.year;

    // A tab that was valid a year ago may have emptied out — a realm can lose its
    // last route. Fall back rather than rendering a tab no longer offered.
    const available = this.tabItems(metrics).map(t => t.id);
    if (!available.includes(this.active)) this.active = 'overview';
    this.strip?.setActive(this.active);

    this.shell.setContent(this.contentFor(metrics));
    this.applyHighlight();
  }

  private contentFor(m: RealmMetrics): Child[] {
    switch (this.active) {
      case 'overview': return buildOverview(m, this);
      case 'economy': return buildEconomy(m, this);
      case 'society': return buildSociety(m, this);
      case 'politics': return buildPolitics(m, this);
      case 'diplomacy': return buildDiplomacy(m, this);
      case 'military': return buildMilitary(m, this);
      case 'infrastructure': return buildInfrastructure(m, this);
      case 'technology': return buildTechnology(m, this);
      case 'history': return buildHistory(m, this);
      default: return [];
    }
  }

  /**
   * Draws the eye to one condition, for a deep link.
   *
   * Temporary and non-modal: the row is marked, scrolled into view, and the mark
   * expires. It must not leave the screen in a special state afterwards.
   */
  private applyHighlight(): void {
    if (!this.highlight || !this.shell) return;
    const target = this.shell.body.querySelector<HTMLElement>(`[data-condition-id="${this.highlight}"]`);
    this.highlight = null;
    if (!target) return;

    target.classList.add('ae-realm-condition-flash');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => target.classList.remove('ae-realm-condition-flash'), 2400);
  }

  // ============================ NAVIGATION ============================

  /** Realms the prev/next control walks, biggest first. */
  private navigableRealms(): Kingdom[] {
    return [...this.ctx.sim.kingdoms.values()].sort((a, b) => b.totalPopulation - a.totalPopulation);
  }

  private switchTo(kingdomId: string): void {
    // Re-opening with new params retargets in place; ScreenManager handles that
    // without pushing a duplicate onto the stack.
    this.ctx.screens.open('realm', { focusKingdom: kingdomId });
  }

  private firstSelectableRealm(ctx: GameContext): string | undefined {
    const selected = ctx.selection.current;
    if (selected?.kind === 'kingdom') return selected.id;
    if (selected?.kind === 'city') return ctx.sim.cities.get(selected.id)?.kingdomId ?? undefined;
    return [...ctx.sim.kingdoms.keys()][0];
  }

  // ============================ HOST ============================

  public openGood(good: GoodId): void {
    this.ctx.screens.open('economy', { good });
  }

  public openCityDossier(cityId: string, highlightCondition?: string): void {
    this.ctx.screens.open('city', { cityId, highlightCondition });
  }

  public openRealm(kingdomId: string): void {
    this.switchTo(kingdomId);
  }

  /**
   * Hands a citizen to the UI-2 inspector.
   *
   * Delegated to `objectNav` rather than reimplemented: the inspector registered
   * the citizen opener itself, and it is the only thing that knows how to reveal
   * its own panel. Selecting and centring here would move the camera to the ruler
   * and leave the player looking at a walking figure with no inspector open.
   */
  public openCitizen(entityId: string): void {
    const entity = this.ctx.sim.entities.find(e => e.id === entityId);
    if (!entity) return;
    this.ctx.screens.back();
    objectNav.open({ kind: 'citizen', id: entityId, name: entity.title ?? entity.name });
  }

  public goToMap(x: number, y: number): void {
    this.ctx.screens.back();
    this.ctx.focusOn(x, y);
  }

  public openChronicle(): void {
    this.ctx.screens.open('chronicle');
  }

  public openTechTree(): void {
    this.ctx.screens.open('techtree', { focusKingdom: this.kingdomId ?? undefined });
  }

  public openWarfare(): void {
    this.ctx.screens.open('warfare');
  }

  public openDynasty(): void {
    this.ctx.screens.open('dynasty');
  }
}
