/**
 * The tool dock.
 *
 * It replaces a row of ten always-visible navigation buttons plus a separate
 * God-Powers trigger with four grouped entries, each opening a menu on demand.
 * The point is not tidiness — it is map. Ten labelled buttons occupied a strip
 * across the bottom of the world; four icons occupy a corner.
 *
 * The grouping follows what the player is trying to *do*, not how the codebase is
 * organised:
 *
 *  - **Mundo** — how the map itself is drawn. Overlays, and nothing else.
 *  - **Civilização** — the systems realms run on.
 *  - **Informação** — the read-only lenses: history, statistics, codices.
 *  - **Poderes** — divine intervention. Opens the existing palette.
 *
 * Also home to the active-tool indicator, because a player holding a volcano
 * brush needs to know that before they click.
 */
import { el } from '../core/Dom';
import { icon, setIcon, withTooltip } from '../kit';
import { ALL_POWERS } from '../../powers/GodPowers';
import { sound } from '../../core/SoundSynth';
import type { OverlayMode } from '../../renderer/Overlays';
import type { GameContext } from '../core/GameContext';

interface MenuEntry {
  label: string;
  icon: string;
  description: string;
  shortcut?: string;
  /** Marked as the current choice — used by the overlay group. */
  isActive?: () => boolean;
  run: () => void;
}

interface DockGroup {
  id: string;
  label: string;
  icon: string;
  description: string;
  /** Built on open, so counts and active states are current. */
  entries: (ctx: GameContext) => MenuEntry[];
}

const OVERLAYS: { id: OverlayMode; label: string; icon: string; description: string }[] = [
  { id: 'none', label: 'Natural', icon: 'map', description: 'O mundo como ele é, sem sobreposição.' },
  { id: 'political', label: 'Político', icon: 'kingdom', description: 'Fronteiras e a extensão de cada reino.' },
  { id: 'population', label: 'População', icon: 'population', description: 'Onde as pessoas realmente vivem.' },
  { id: 'biome', label: 'Biomas', icon: 'biome', description: 'Classificação ecológica do terreno.' },
  { id: 'temperature', label: 'Clima', icon: 'climate', description: 'Temperatura e umidade.' },
  { id: 'resources', label: 'Recursos', icon: 'good', description: 'Depósitos de minério, madeira e ouro.' }
];

/**
 * The realm the player is most plausibly asking about.
 *
 * A selected realm wins; a selected city or citizen means the realm they belong
 * to; otherwise the biggest realm in the world, which is the one a player opening
 * a dossier cold almost always wants.
 */
function focusedRealm(ctx: GameContext): string | undefined {
  const selected = ctx.selection.current;
  if (selected?.kind === 'kingdom') return selected.id;
  if (selected?.kind === 'city') return ctx.sim.cities.get(selected.id)?.kingdomId ?? undefined;
  if (selected?.kind === 'building') return ctx.sim.cities.get(selected.cityId)?.kingdomId ?? undefined;
  if (selected?.kind === 'citizen') {
    return ctx.sim.entities.find(e => e.id === selected.id)?.kingdomId ?? undefined;
  }

  let best: { id: string; population: number } | null = null;
  for (const kingdom of ctx.sim.kingdoms.values()) {
    if (!best || kingdom.totalPopulation > best.population) {
      best = { id: kingdom.id, population: kingdom.totalPopulation };
    }
  }
  return best?.id;
}

const GROUPS: DockGroup[] = [
  {
    id: 'world',
    label: 'Mundo',
    icon: 'map',
    description: 'Como o mapa é desenhado.',
    entries: ctx => OVERLAYS.map(o => ({
      label: o.label,
      icon: o.icon,
      description: o.description,
      isActive: () => ctx.overlays.activeMode === o.id,
      run: () => ctx.overlays.setMode(o.id)
    }))
  },
  {
    id: 'civilization',
    label: 'Civilização',
    icon: 'politics',
    description: 'Os sistemas que movem os reinos.',
    entries: ctx => [
      {
        // Opens on whatever realm the player is looking at, falling back to the
        // largest — the dossier then handles switching between realms itself.
        label: 'Dossiê do reino', icon: 'kingdom',
        description: 'O reino selecionado por dentro: economia, sociedade, política, exército e técnica.',
        run: () => ctx.screens.open('realm', { focusKingdom: focusedRealm(ctx) })
      },
      { label: 'Política', icon: 'politics', description: 'Facções, leis e legitimidade.', shortcut: 'P', run: () => ctx.screens.open('politics') },
      { label: 'Economia', icon: 'economy', description: 'Preços, produção, escassez e tesouro.', shortcut: 'E', run: () => ctx.screens.open('economy') },
      { label: 'Diplomacia', icon: 'diplomacy', description: 'Tratados, rivalidades e a opinião das cortes.', shortcut: 'L', run: () => ctx.screens.open('diplomacy') },
      { label: 'Dinastias', icon: 'dynasty', description: 'Linhagens, sucessões e casas governantes.', run: () => ctx.screens.open('dynasty') },
      { label: 'Infraestrutura', icon: 'trade-route', description: 'Estradas, ferrovias e rotas de comércio.', shortcut: 'N', run: () => ctx.screens.open('infrastructure') },
      { label: 'Guerra', icon: 'war', description: 'Exércitos, cercos e o custo das campanhas.', shortcut: 'W', run: () => ctx.screens.open('warfare') }
    ]
  },
  {
    id: 'information',
    label: 'Informação',
    icon: 'history',
    description: 'Lentes de leitura sobre o mundo.',
    entries: ctx => [
      { label: 'Crônica', icon: 'history', description: 'A história do mundo, registrada conforme acontece.', shortcut: 'C', run: () => ctx.screens.open('chronicle') },
      { label: 'Estatísticas', icon: 'statistics', description: 'Séries históricas de população, reinos e guerras.', shortcut: 'G', run: () => ctx.screens.open('stats') },
      { label: 'Ciência', icon: 'technology', description: 'O que cada reino descobriu e o que persegue.', shortcut: 'T', run: () => ctx.screens.open('techtree') },
      { label: 'Ecossistema', icon: 'ecosystem', description: 'Biomas, fauna e a pressão sobre eles.', run: () => ctx.screens.open('ecosystem') },
      { label: 'Bestiário', icon: 'education', description: 'As espécies deste mundo.', shortcut: 'B', run: () => ctx.screens.open('bestiary') },
      { label: 'Reinos', icon: 'kingdom', description: 'Todos os reinos, comparados.', shortcut: 'K', run: () => ctx.screens.open('kingdoms') }
    ]
  }
];

export class ToolDock {
  public readonly root: HTMLElement;

  private ctx: GameContext;
  private openPopover: HTMLElement | null = null;
  private openGroupId: string | null = null;
  private groupButtons = new Map<string, HTMLButtonElement>();
  private powersBtn!: HTMLButtonElement;
  private activeToolNode!: HTMLElement;
  private activeToolIcon!: HTMLImageElement;
  private activeToolName!: HTMLElement;
  private lastToolId = '';

  constructor(ctx: GameContext, onTogglePowers: () => void) {
    this.ctx = ctx;

    const groupButtons = GROUPS.map(group => {
      const btn = withTooltip(
        el('button', {
          class: 'ae-dock-btn',
          attrs: { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
          on: { click: (ev: MouseEvent) => { ev.stopPropagation(); this.toggleGroup(group); } }
        }, [
          icon(group.icon, { size: 16 }),
          el('span', { class: 'ae-dock-btn-label', text: group.label })
        ]),
        { title: group.label, description: group.description, icon: group.icon }
      ) as HTMLButtonElement;
      this.groupButtons.set(group.id, btn);
      return btn;
    });

    this.powersBtn = withTooltip(
      el('button', {
        class: 'ae-dock-btn ae-dock-btn-powers',
        attrs: { type: 'button' },
        on: { click: (ev: MouseEvent) => { ev.stopPropagation(); this.closeMenu(); sound.playClick(); onTogglePowers(); } }
      }, [
        icon('power', { size: 16 }),
        el('span', { class: 'ae-dock-btn-label', text: 'Poderes' })
      ]),
      { title: 'Poderes Divinos', description: 'Terraformar, semear vida, atear fogo, intervir.', shortcut: 'Tab' }
    ) as HTMLButtonElement;

    this.activeToolIcon = icon('search', { size: 16 });
    this.activeToolName = el('span', { class: 'ae-active-tool-name', text: '' });
    this.activeToolNode = withTooltip(
      el('button', {
        class: 'ae-active-tool',
        attrs: { type: 'button' },
        on: { click: () => { sound.playClick(); this.ctx.brush.resetToInspect(); this.syncActiveTool(); } }
      }, [
        this.activeToolIcon,
        el('div', { class: 'ae-active-tool-text' }, [
          el('span', { class: 'ae-active-tool-kicker', text: 'FERRAMENTA' }),
          this.activeToolName
        ])
      ]),
      {
        title: 'Ferramenta ativa',
        description: 'Um clique no mapa aplica esta ferramenta em vez de selecionar.',
        footnote: 'Clique aqui, ou pressione Esc, para voltar à inspeção',
        shortcut: 'Esc'
      }
    );

    this.root = el('div', { class: 'ae-tool-dock' }, [
      this.activeToolNode,
      el('div', { class: 'ae-dock-row' }, [...groupButtons, this.powersBtn])
    ]);

    // One document listener closes the menu on any outside click. Registered once
    // for the dock rather than per popover.
    document.addEventListener('mousedown', this.onDocumentDown, true);
    this.syncActiveTool();
  }

  // ============================ MENU ============================

  private toggleGroup(group: DockGroup): void {
    if (this.openGroupId === group.id) {
      this.closeMenu();
      return;
    }
    this.closeMenu();
    sound.playClick();

    const entries = group.entries(this.ctx);
    const popover = el('div', { class: 'ae-dock-menu', attrs: { role: 'menu' } }, [
      el('div', { class: 'ae-dock-menu-head', text: group.label }),
      ...entries.map(entry => withTooltip(
        el('button', {
          class: `ae-dock-menu-item${entry.isActive?.() ? ' ae-dock-menu-item-active' : ''}`,
          attrs: { type: 'button', role: 'menuitem' },
          on: {
            click: () => {
              sound.playClick();
              entry.run();
              this.closeMenu();
            }
          }
        }, [
          icon(entry.icon, { size: 16 }),
          el('span', { class: 'ae-dock-menu-label', text: entry.label }),
          entry.shortcut ? el('kbd', { class: 'ae-dock-menu-key', text: entry.shortcut }) : null
        ]),
        { title: entry.label, description: entry.description, icon: entry.icon, shortcut: entry.shortcut }
      ))
    ]);

    this.openPopover = popover;
    this.openGroupId = group.id;
    this.root.appendChild(popover);
    this.groupButtons.get(group.id)?.classList.add('ae-dock-btn-open');
    this.groupButtons.get(group.id)?.setAttribute('aria-expanded', 'true');
  }

  /** Closes any open menu. Returns true when something was actually closed. */
  public closeMenu(): boolean {
    if (!this.openPopover) return false;
    this.openPopover.remove();
    this.openPopover = null;
    if (this.openGroupId) {
      this.groupButtons.get(this.openGroupId)?.classList.remove('ae-dock-btn-open');
      this.groupButtons.get(this.openGroupId)?.setAttribute('aria-expanded', 'false');
    }
    this.openGroupId = null;
    return true;
  }

  public get isMenuOpen(): boolean {
    return this.openPopover !== null;
  }

  private onDocumentDown = (ev: MouseEvent): void => {
    if (!this.openPopover) return;
    if (this.root.contains(ev.target as Node)) return;
    this.closeMenu();
  };

  // ============================ ACTIVE TOOL ============================

  /**
   * Shows what the player is holding.
   *
   * Hidden entirely while in inspection mode — that is the resting state, and a
   * permanent "you are not holding anything" badge is exactly the kind of
   * always-on chrome UI-1 is removing.
   */
  public syncActiveTool(): void {
    const id = this.ctx.brush.activePowerId;
    if (id === this.lastToolId) return;
    this.lastToolId = id;

    const inspecting = this.ctx.brush.isInspecting;
    this.root.classList.toggle('ae-tool-dock-armed', !inspecting);
    this.powersBtn.classList.toggle('ae-dock-btn-active', !inspecting);
    if (inspecting) return;

    const power = ALL_POWERS.find(p => p.id === id);
    this.activeToolName.textContent = power?.name ?? id;
    // Power icons are still authored as glyphs; the icon vocabulary maps the
    // common ones onto real artwork and falls back to the bronze lozenge.
    setIcon(this.activeToolIcon, power?.icon ?? 'power');
  }

  public dispose(): void {
    document.removeEventListener('mousedown', this.onDocumentDown, true);
  }
}
