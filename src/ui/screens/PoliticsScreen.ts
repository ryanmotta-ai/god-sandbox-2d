/**
 * The politics and diplomacy command centre.
 *
 * One screen, two areas, registered under two ids so the existing entry points —
 * the dock, the P and L shortcuts, every `screens.open('politics')` in the game —
 * keep working. `PoliticsScreen` opens on politics, `DiplomacyScreen` opens on
 * diplomacy; both are the same class with the same state and the same tabs.
 *
 * The question it exists to answer is *who wants what, why, and what could it
 * cause*. So the ordering is the brief's: critical risk first, then the
 * government and who rules it, then the factions pressing on it, then the laws
 * and the foreign position.
 *
 * The politics half rests on something unusual: `FactionState.factors` records
 * the exact deltas the society tick applied to each faction, labelled by the
 * simulation itself. So "why are the workers angry" is read back, not guessed.
 * The diplomacy half is honest about the opposite: `DiplomacyManager` keeps one
 * number per pair of realms and nothing about how it got there, so relations get
 * their standing facts and the screen says the breakdown does not exist.
 *
 * Everything runs behind `PoliticsMetricsCache`. Counting a realm's working-age
 * population is O(entities) and never happens per frame.
 */
import { el } from '../core/Dom';
import {
  screenShell, tabs, panel, badge, badgeRow, button, icon, withTooltip, objectLink,
  emptyState, tooltip, objectNav,
  type TabStrip, type TabItem
} from '../kit';
import { PoliticsMetricsCache, type PoliticsMetrics } from '../politics/PoliticsMetrics';
import {
  diagnosePolitics, politicalProblems, politicalPressures, geopoliticalPressures, pct, band
} from '../politics/PoliticsDiagnostics';
import { buildOverview, buildFactions, buildLaws, buildRuler } from '../politics/PoliticsTabs';
import {
  buildRelations, buildRelationDetail, buildTreaties, buildWars, buildGeopolitics
} from '../politics/DiplomacyTabs';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import type { Child } from '../core/Dom';
import type { Screen, ScreenId, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';
import type { Kingdom } from '../../civ/Kingdom';
import type { GoodId } from '../../civ/Goods';

/** What the tab builders are allowed to ask of the game. */
export interface PoliticsScreenHost {
  readonly ctx: GameContext;
  /** Opens a good in the UI-5 economy screen. */
  openGood(good: GoodId): void;
  /** Opens the UI-4 realm dossier. */
  openRealm(kingdomId: string): void;
  /** Opens the UI-3 city dossier. */
  openCity(cityId: string): void;
  /** Closes this screen and opens the UI-2 inspector on a citizen. */
  openCitizen(entityId: string): void;
  openChronicle(): void;
  openWarfare(): void;
  openDynasty(): void;
  /** Narrows the factions tab to one group, or clears it with null. */
  focusFaction(id: string | null): void;
  /** Opens one relationship in full, or clears it with null. */
  focusRelation(kingdomId: string | null): void;
  openTab(tab: TabId): void;
}

export type TabId =
  | 'overview' | 'factions' | 'laws' | 'ruler'
  | 'relations' | 'treaties' | 'wars' | 'geopolitics';

const POLITICS_TABS: TabId[] = ['overview', 'factions', 'laws', 'ruler'];
const DIPLOMACY_TABS: TabId[] = ['relations', 'treaties', 'wars', 'geopolitics'];
const ALL_TABS: TabId[] = [...POLITICS_TABS, ...DIPLOMACY_TABS];

type Area = 'politics' | 'diplomacy';

/** The shared implementation. Two screen ids, one behaviour. */
export abstract class PoliticsCommandScreen implements Screen, PoliticsScreenHost {
  public abstract readonly id: ScreenId;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;
  /** Which half this entry point lands on. */
  protected abstract readonly defaultArea: Area;

  public ctx!: GameContext;

  private kingdomId: string | null = null;
  private area: Area = 'politics';
  private tab: TabId = 'overview';
  private focusedFaction: string | null = null;
  private focusedRelation: string | null = null;

  private strip: TabStrip | null = null;
  private shell: { root: HTMLElement; body: HTMLElement; setContent(c: Child[]): void } | null = null;
  private metricsCache = new PoliticsMetricsCache();
  private renderedYear = -1;
  /** Condition to draw the eye to, from an alert deep link. */
  private highlight: string | null = null;

  // ============================ SCREEN ============================

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;
    this.area = this.defaultArea;

    const requested = params?.focusKingdom ?? this.kingdomId ?? this.firstSelectableRealm(ctx);
    if (requested !== this.kingdomId) {
      this.kingdomId = requested ?? null;
      this.tab = this.defaultArea === 'politics' ? 'overview' : 'relations';
      this.focusedFaction = null;
      this.focusedRelation = null;
      this.metricsCache.invalidate();
    } else if (!this.isAreaTab(this.tab, this.defaultArea)) {
      // Re-entering through the other door lands on that door's first tab.
      this.tab = this.defaultArea === 'politics' ? 'overview' : 'relations';
    }

    if (params?.tab && this.isTab(params.tab)) {
      this.tab = params.tab;
      this.area = POLITICS_TABS.includes(params.tab) ? 'politics' : 'diplomacy';
    }
    // A deep link naming a second realm opens that relationship rather than
    // retargeting the screen — which is what "diplomacy between A and B" means
    // when an alert sends the player here.
    if (params?.withKingdom) {
      this.area = 'diplomacy';
      this.tab = 'relations';
      this.focusedRelation = params.withKingdom;
    }
    this.highlight = params?.highlightCondition ?? null;

    const kingdom = this.kingdomId ? ctx.sim.kingdoms.get(this.kingdomId) ?? null : null;
    if (!kingdom) {
      const shell = screenShell({
        title: 'Política',
        icon: 'politics',
        onClose: () => ctx.screens.back(),
        width: 'narrow'
      });
      shell.setContent([emptyState({
        icon: 'politics',
        title: 'Nenhum reino',
        hint: 'Nenhuma sociedade se organizou em um estado ainda.',
        action: button('Voltar', () => ctx.screens.back(), { variant: 'secondary', size: 'sm', icon: 'close' })
      })]);
      return shell.root;
    }

    const metrics = this.metricsCache.get(kingdom, ctx, performance.now());

    const shell = screenShell({
      title: kingdom.name,
      subtitle: this.subtitleFor(metrics),
      icon: this.area === 'politics' ? 'politics' : 'diplomacy',
      onClose: () => ctx.screens.back(),
      width: 'wide',
      actions: this.headerActions(kingdom, metrics)
    });
    this.shell = shell;
    // The realm's colour on the header edge and the accents only. A screen washed
    // in a saturated banner colour is a screen nobody can read.
    shell.root.style.setProperty('--ae-realm', kingdom.color);
    shell.root.classList.add('ae-pol-screen');

    this.strip = tabs(this.tabItems(metrics), this.tab, id => {
      this.tab = id as TabId;
      this.focusedFaction = null;
      this.focusedRelation = null;
      this.renderTab();
    });
    shell.root.insertBefore(this.strip.root, shell.body);
    shell.root.insertBefore(this.buildAreaSwitch(metrics), this.strip.root);
    shell.root.insertBefore(this.buildIdentityBar(kingdom, metrics), this.strip.root);

    this.renderTab();
    return shell.root;
  }

  public tick(ctx: GameContext): void {
    if (!this.kingdomId || !this.shell) return;
    const kingdom = ctx.sim.kingdoms.get(this.kingdomId);
    // A conquered realm has to repaint, not freeze on its last good frame — the
    // graceful "no longer exists" state is unreachable if this returns early.
    if (!kingdom) { this.renderTab(); return; }
    const metrics = this.metricsCache.get(kingdom, ctx, performance.now());
    if (metrics.year !== this.renderedYear) this.renderTab();
  }

  public dispose(): void {
    tooltip.hide();
    this.shell = null;
    this.strip = null;
  }

  // ============================ HEADER ============================

  private subtitleFor(m: PoliticsMetrics): string {
    const parts = [m.government.name, `ano ${m.year}`];
    const problems = politicalProblems(diagnosePolitics(m)).length;
    if (problems) parts.push(`${problems} condição(ões) fora do normal`);
    if (m.wars.length) parts.push(`${m.wars.length} guerra(s)`);
    return parts.join(' · ');
  }

  private headerActions(kingdom: Kingdom, m: PoliticsMetrics): Child[] {
    const realms = this.navigableRealms();
    const index = realms.findIndex(k => k.id === kingdom.id);

    return [
      realms.length > 1
        ? el('div', { class: 'ae-pol-nav' }, [
            withTooltip(
              el('button', {
                class: 'ae-pol-nav-btn',
                attrs: { type: 'button', 'aria-label': 'Reino anterior' },
                on: { click: () => this.switchTo(realms[(index - 1 + realms.length) % realms.length].id) }
              }, [el('span', { text: '‹' })]),
              { title: 'Reino anterior', description: realms[(index - 1 + realms.length) % realms.length].name }
            ),
            el('span', { class: 'ae-pol-nav-count', text: `${index + 1} / ${realms.length}` }),
            withTooltip(
              el('button', {
                class: 'ae-pol-nav-btn',
                attrs: { type: 'button', 'aria-label': 'Próximo reino' },
                on: { click: () => this.switchTo(realms[(index + 1) % realms.length].id) }
              }, [el('span', { text: '›' })]),
              { title: 'Próximo reino', description: realms[(index + 1) % realms.length].name }
            )
          ])
        : null,

      m.succession.ruler
        ? button('Governante', () => this.openCitizen(m.succession.ruler!.id), {
            variant: 'secondary', size: 'sm', icon: 'crown',
            tooltip: {
              title: m.succession.ruler.title ?? m.succession.ruler.name,
              description: 'Abre a ficha completa no inspetor.'
            }
          })
        : null,

      button('Dossiê do reino', () => this.openRealm(kingdom.id), {
        variant: 'ghost', size: 'sm', icon: 'kingdom',
        tooltip: { title: kingdom.name, description: 'Abre o dossiê completo deste reino.' }
      })
    ];
  }

  /** The two doors, always visible, so the halves read as one place. */
  private buildAreaSwitch(m: PoliticsMetrics): HTMLElement {
    const geoCount = geopoliticalPressures(m).length;
    const polCount = politicalPressures(m).length;

    const makeButton = (area: Area, label: string, iconName: string, count: number, description: string) =>
      withTooltip(
        el('button', {
          class: `ae-pol-area ${this.area === area ? 'is-active' : ''}`,
          attrs: { type: 'button' },
          on: {
            click: () => {
              this.area = area;
              this.tab = area === 'politics' ? 'overview' : 'relations';
              this.focusedFaction = null;
              this.focusedRelation = null;
              this.rebuildChrome();
            }
          }
        }, [
          icon(iconName, { size: 16 }),
          el('span', { text: label }),
          count ? el('span', { class: 'ae-pol-area-count', text: `${count}` }) : null
        ]),
        { title: label, description }
      );

    return el('div', { class: 'ae-pol-areas' }, [
      makeButton('politics', 'Política interna', 'politics', polCount,
        'Governo, facções, leis e sucessão — quem quer o quê dentro do reino.'),
      makeButton('diplomacy', 'Diplomacia', 'diplomacy', geoCount,
        'Relações, tratados, guerras e dependências — a posição do reino no mundo.')
    ]);
  }

  /** Identity strip: the figures that say what kind of regime this is. */
  private buildIdentityBar(kingdom: Kingdom, m: PoliticsMetrics): HTMLElement {
    const ruler = m.succession.ruler;

    return el('div', { class: 'ae-pol-identity' }, [
      badgeRow([
        badge(m.government.name, { size: 'sm', variant: 'outline', icon: 'politics' }),
        badge(speciesName(kingdom.species), { size: 'sm', variant: 'outline', icon: 'population' }),
        m.wars.length
          ? badge(`Em guerra · ${m.wars.length}`, { size: 'sm', status: 'critical', icon: 'war' })
          : badge('Em paz', { size: 'sm', status: 'positive', variant: 'outline', icon: 'diplomacy' }),
        m.alliances.length
          ? badge(`${m.alliances.length} aliança(s)`, { size: 'sm', status: 'positive', variant: 'outline', icon: 'alliance' })
          : null,
        m.succession.risks.some(r => r.severity === 'critical')
          ? badge('Sucessão em risco', { size: 'sm', status: 'critical', icon: 'crown' })
          : null
      ]),
      el('div', { class: 'ae-pol-headline' }, [
        this.headlineFigure('Legitimidade', pct(m.legitimacy), 'crown', band(m.legitimacy)),
        this.headlineFigure('Estabilidade', pct(m.stability), 'shield', band(m.stability)),
        this.headlineFigure('Coesão', pct(m.society.cohesion), 'population', band(m.society.cohesion)),
        this.headlineFigure('Risco de revolta', pct(m.society.revoltRisk), 'warning'),
        this.headlineFigure('Contatos', `${m.relations.length}`, 'handshake'),

        ruler
          ? el('div', { class: 'ae-pol-headline-ruler' }, [
              icon('crown', { size: 16 }),
              el('div', { class: 'ae-pol-headline-text' }, [
                objectLink(
                  { kind: 'citizen', id: ruler.id, name: ruler.title ?? ruler.name, accent: kingdom.color },
                  { showIcon: false, onOpen: () => this.openCitizen(ruler.id) }
                ),
                el('span', { class: 'ae-pol-headline-label', text: m.government.rulerTitle })
              ])
            ])
          : el('div', { class: 'ae-pol-headline-ruler' }, [
              icon('crown', { size: 16 }),
              el('div', { class: 'ae-pol-headline-text' }, [
                el('span', { class: 'ae-pol-headline-value', text: 'Trono vago' }),
                el('span', { class: 'ae-pol-headline-label', text: 'Governante' })
              ])
            ])
      ])
    ]);
  }

  private headlineFigure(label: string, value: string, iconName: string, status?: string): HTMLElement {
    return el('div', { class: 'ae-pol-headline-item' }, [
      icon(iconName, { size: 16, class: 'ae-pol-headline-icon' }),
      el('div', { class: 'ae-pol-headline-text' }, [
        el('span', {
          class: `ae-pol-headline-value${status ? ` ae-pol-value-${status}` : ''}`,
          text: value
        }),
        el('span', { class: 'ae-pol-headline-label', text: label })
      ])
    ]);
  }

  // ============================ TABS ============================

  /**
   * The tab list for the current area, with empty tabs dropped.
   *
   * A realm that has met nobody has no relations and no treaties — dead tabs are
   * worse than fewer live ones. The wars tab always stays: "em paz" is a true
   * statement about the realm, not an empty screen.
   */
  private tabItems(m: PoliticsMetrics): TabItem[] {
    if (this.area === 'politics') {
      const items: TabItem[] = [
        { id: 'overview', label: 'Visão geral', icon: 'politics', badge: politicalPressures(m).length || undefined }
      ];
      if (m.factions.length) {
        const radical = m.factions.filter(f => f.state.radicalization >= 0.6).length;
        items.push({
          id: 'factions', label: 'Facções', icon: 'population',
          badge: radical || undefined,
          tooltip: radical ? { title: 'Facções', description: `${radical} radicalizada(s)` } : undefined
        });
      }
      if (m.laws.length) items.push({ id: 'laws', label: 'Leis', icon: 'law', badge: m.laws.length });
      items.push({
        id: 'ruler', label: 'Governante', icon: 'crown',
        badge: m.succession.risks.length || undefined
      });
      return items;
    }

    const items: TabItem[] = [];
    if (m.relations.length) {
      items.push({ id: 'relations', label: 'Relações', icon: 'handshake', badge: m.relations.length });
    }
    const hasTreaty = m.alliances.length > 0 || m.relations.some(r =>
      r.tariff !== null || r.truceUntil !== null || r.embargoedByUs || r.embargoedAgainstUs || r.isVassal || r.isOverlord);
    if (hasTreaty) items.push({ id: 'treaties', label: 'Tratados', icon: 'scroll' });
    items.push({
      id: 'wars', label: 'Guerras', icon: 'war',
      badge: m.wars.length || undefined,
      tooltip: m.wars.length ? { title: 'Guerras', description: `${m.wars.length} em curso` } : undefined
    });
    if (m.relations.length || m.dependencies.length) {
      items.push({
        id: 'geopolitics', label: 'Pressões', icon: 'alert',
        badge: geopoliticalPressures(m).length || undefined
      });
    }
    return items;
  }

  private isTab(value: string): value is TabId {
    return (ALL_TABS as string[]).includes(value);
  }

  private isAreaTab(tab: TabId, area: Area): boolean {
    return area === 'politics' ? POLITICS_TABS.includes(tab) : DIPLOMACY_TABS.includes(tab);
  }

  /** Swaps the tab strip and the area switch after the area changes. */
  private rebuildChrome(): void {
    if (!this.shell || !this.strip || !this.kingdomId) return;
    const kingdom = this.ctx.sim.kingdoms.get(this.kingdomId);
    if (!kingdom) return;
    const metrics = this.metricsCache.get(kingdom, this.ctx, performance.now());

    const freshStrip = tabs(this.tabItems(metrics), this.tab, id => {
      this.tab = id as TabId;
      this.focusedFaction = null;
      this.focusedRelation = null;
      this.renderTab();
    });
    this.shell.root.replaceChild(freshStrip.root, this.strip.root);
    this.strip = freshStrip;

    const oldSwitch = this.shell.root.querySelector('.ae-pol-areas');
    if (oldSwitch) this.shell.root.replaceChild(this.buildAreaSwitch(metrics), oldSwitch);

    this.renderTab();
  }

  private renderTab(): void {
    if (!this.shell || !this.kingdomId) return;
    const kingdom = this.ctx.sim.kingdoms.get(this.kingdomId);
    if (!kingdom) {
      this.shell.setContent([emptyState({
        icon: 'politics',
        title: 'Este reino não existe mais',
        hint: 'Foi conquistado ou extinto enquanto a tela estava aberta.',
        action: button('Voltar', () => this.ctx.screens.back(), { variant: 'secondary', size: 'sm', icon: 'close' })
      })]);
      return;
    }

    const metrics = this.metricsCache.get(kingdom, this.ctx, performance.now());
    this.renderedYear = metrics.year;

    const available = this.tabItems(metrics).map(t => t.id);
    if (!available.includes(this.tab)) this.tab = (available[0] as TabId) ?? 'overview';
    this.strip?.setActive(this.tab);

    this.shell.setContent(this.contentFor(metrics));
    this.applyHighlight();
  }

  private contentFor(m: PoliticsMetrics): Child[] {
    // A focused relationship takes over the body wherever it was opened from.
    if (this.focusedRelation) {
      const relation = m.relations.find(r => r.kingdomId === this.focusedRelation);
      if (!relation) {
        return [emptyState({
          icon: 'handshake',
          title: 'Esta relação não existe mais',
          hint: 'O outro reino deixou de existir enquanto a tela estava aberta.',
          action: button('Voltar', () => this.focusRelation(null), { variant: 'secondary', size: 'sm', icon: 'close' })
        })];
      }
      return buildRelationDetail(relation, m, this);
    }

    switch (this.tab) {
      case 'overview': return buildOverview(m, this);
      case 'factions': return buildFactions(m, this, this.focusedFaction);
      case 'laws': return buildLaws(m, this);
      case 'ruler': return buildRuler(m, this);
      case 'relations': return [...buildRelations(m, this), this.buildDivinePowers(m)];
      case 'treaties': return buildTreaties(m, this);
      case 'wars': return buildWars(m, this);
      case 'geopolitics': return buildGeopolitics(m, this);
      default: return [];
    }
  }

  /**
   * The god powers, kept and quarantined.
   *
   * These four mutate the simulation, and they are real supported gameplay — this
   * is a god sandbox. But they are not analysis, so they sit in their own block at
   * the bottom of the relations tab rather than mixed into the figures, and the
   * panel says out loud that pressing them changes the world.
   */
  private buildDivinePowers(m: PoliticsMetrics): HTMLElement | null {
    const others = m.relations;
    if (!others.length) return null;

    const act = (label: string, run: (otherId: string) => void, variant: 'danger' | 'secondary' | 'ghost', iconName: string, description: string) =>
      button(label, () => {
        const target = this.divineTarget ?? others[0].kingdomId;
        run(target);
        this.metricsCache.invalidate();
        this.renderTab();
      }, { variant, size: 'sm', icon: iconName, tooltip: { title: label, description } });

    const select = el('select', {
      class: 'ae-pol-select',
      on: { change: (ev: Event) => { this.divineTarget = (ev.target as HTMLSelectElement).value; } }
    }, others.map(r => el('option', {
      attrs: { value: r.kingdomId, ...(r.kingdomId === (this.divineTarget ?? others[0].kingdomId) ? { selected: 'selected' } : {}) },
      text: r.name
    }))) as HTMLSelectElement;
    this.divineTarget = this.divineTarget ?? others[0].kingdomId;

    const sim = this.ctx.sim;
    const self = m.kingdomId;

    return panel({
      title: 'Intervenção divina',
      icon: 'power',
      subtitle: 'Estes botões alteram a simulação. Tudo acima é leitura; isto é ação.',
      class: 'ae-pol-divine'
    }, [
      el('div', { class: 'ae-pol-divine-row' }, [
        el('span', { class: 'ae-muted', text: `${m.name} ⇄` }),
        select
      ]),
      el('div', { class: 'ae-pol-divine-actions' }, [
        act('Declarar guerra', other => {
          if (!sim.diplomacy.declareWar(self, other, sim.currentYear, 'Provocação divina')) {
            this.ctx.toast('Estes reinos já estão em guerra', 'warning');
          }
        }, 'danger', 'war', 'Abre uma guerra entre os dois reinos, agora.'),
        act('Forçar paz', other => {
          if (sim.diplomacy.isAtWar(self, other)) sim.diplomacy.endWar(self, other, sim.currentYear);
          else this.ctx.toast('Estes reinos não estão em guerra', 'warning');
        }, 'secondary', 'diplomacy', 'Encerra a guerra em curso entre os dois.'),
        act('Forjar aliança', other => {
          const alliance = sim.diplomacy.createAlliance(self, other, `Pacto Divino de ${sim.currentYear}`, sim.currentYear);
          if (!alliance) this.ctx.toast('Não é possível aliar reinos em guerra', 'warning');
        }, 'secondary', 'alliance', 'Cria uma aliança formal. Falha se os dois estiverem em guerra.'),
        act('Semear discórdia', other => {
          sim.diplomacy.changeRelation(self, other, -35);
          this.ctx.toast('A desconfiança se espalha entre os reinos', 'divine');
        }, 'ghost', 'warning', 'Derruba o índice de relação em 35 pontos.')
      ])
    ]);
  }

  private divineTarget: string | null = null;

  /** Draws the eye to one condition, for an alert deep link. Self-expiring. */
  private applyHighlight(): void {
    if (!this.highlight || !this.shell) return;
    const target = this.shell.body.querySelector<HTMLElement>(`[data-condition-id="${this.highlight}"]`);
    this.highlight = null;
    if (!target) return;
    target.classList.add('ae-pol-condition-flash');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => target.classList.remove('ae-pol-condition-flash'), 2400);
  }

  // ============================ NAVIGATION ============================

  private navigableRealms(): Kingdom[] {
    return [...this.ctx.sim.kingdoms.values()].sort((a, b) => b.totalPopulation - a.totalPopulation);
  }

  private switchTo(kingdomId: string): void {
    this.ctx.screens.open(this.id, { focusKingdom: kingdomId, tab: this.tab });
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

  public openRealm(kingdomId: string): void {
    this.ctx.screens.open('realm', { focusKingdom: kingdomId });
  }

  public openCity(cityId: string): void {
    this.ctx.screens.open('city', { cityId });
  }

  /**
   * Hands a citizen to the UI-2 inspector.
   *
   * Delegated to `objectNav` rather than reimplemented: the inspector registered
   * the citizen opener itself and is the only thing that knows how to reveal its
   * own panel.
   */
  public openCitizen(entityId: string): void {
    const entity = this.ctx.sim.entities.find(e => e.id === entityId);
    if (!entity) return;
    this.ctx.screens.back();
    objectNav.open({ kind: 'citizen', id: entityId, name: entity.title ?? entity.name });
  }

  public openChronicle(): void {
    this.ctx.screens.open('chronicle');
  }

  public openWarfare(): void {
    this.ctx.screens.open('warfare');
  }

  public openDynasty(): void {
    this.ctx.screens.open('dynasty');
  }

  public focusFaction(id: string | null): void {
    this.focusedFaction = id;
    if (id && (this.tab !== 'factions' || this.area !== 'politics')) {
      this.area = 'politics';
      this.tab = 'factions';
      this.rebuildChrome();
      return;
    }
    this.renderTab();
  }

  public focusRelation(kingdomId: string | null): void {
    this.focusedRelation = kingdomId;
    if (kingdomId && (this.tab !== 'relations' || this.area !== 'diplomacy')) {
      this.area = 'diplomacy';
      this.tab = 'relations';
      this.rebuildChrome();
      return;
    }
    this.renderTab();
  }

  public openTab(tab: TabId): void {
    this.tab = tab;
    this.area = POLITICS_TABS.includes(tab) ? 'politics' : 'diplomacy';
    this.focusedFaction = null;
    this.focusedRelation = null;
    this.rebuildChrome();
  }
}

/** The species' own name from its definition, not its internal id. */
function speciesName(species: string): string {
  return SPECIES_DEFINITIONS[species as keyof typeof SPECIES_DEFINITIONS]?.name ?? species;
}

/** Entry point that lands on the internal-politics half. */
export class PoliticsScreen extends PoliticsCommandScreen {
  public readonly id = 'politics' as const;
  protected readonly defaultArea = 'politics' as const;
}
