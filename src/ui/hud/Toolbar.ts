import { el, clear } from '../core/Dom';
import { icon, withTooltip } from '../kit';
import { ALL_POWERS } from '../../powers/GodPowers';
import { BrushCategory, PowerDefinition } from '../../powers/BrushManager';
import { settings } from '../core/Settings';
import { sound } from '../../core/SoundSynth';
import type { GameContext } from '../core/GameContext';

interface CategoryInfo {
  id: BrushCategory;
  label: string;
  icon: string;
  hotkey: string;
  accent: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'terrain', label: 'Terreno', icon: 'pickaxe', hotkey: '1', accent: '#8a7860' },
  { id: 'nature', label: 'Natureza', icon: 'ecosystem', hotkey: '2', accent: '#7ba05b' },
  { id: 'biomes', label: 'Biomas', icon: 'climate', hotkey: '3', accent: '#7fa8b8' },
  { id: 'life', label: 'Vida & Espécies', icon: 'population', hotkey: '4', accent: '#c9a153' },
  { id: 'divine', label: 'Milagres', icon: 'power', hotkey: '5', accent: '#9b7fa8' },
  { id: 'destruction', label: 'Desastres', icon: 'disaster', hotkey: '6', accent: '#b8453c' },
  { id: 'inspect', label: 'Inspecionar', icon: 'search', hotkey: '7', accent: '#6f8fa8' }
];

const BRUSH_SIZES = [1, 2, 3, 5, 9, 14];

export class Toolbar {
  public readonly root: HTMLElement;
  private ctx: GameContext;
  private tabsEl: HTMLElement;
  private gridEl: HTMLElement;
  private activeNameEl: HTMLElement;
  private activeDescEl: HTMLElement;
  private sizeEl: HTMLElement;
  private searchInput: HTMLInputElement;
  private searchQuery = '';
  private isVisible = false;
  /** Guards the per-frame active-tool sync. */
  private lastSyncedPowerId = '';

  constructor(ctx: GameContext) {
    this.ctx = ctx;

    this.tabsEl = el('div', { class: 'dock-tabs' });
    this.gridEl = el('div', { class: 'dock-grid' });
    this.activeNameEl = el('span', { class: 'active-tool-name', text: 'Add Land' });
    this.activeDescEl = el('span', { class: 'active-tool-desc', text: 'Create soil land' });
    this.sizeEl = el('div', { class: 'brush-sizes' });

    this.searchInput = el('input', {
      class: 'dock-search',
      attrs: { type: 'search', placeholder: 'Buscar poder…', spellcheck: false },
      on: {
        input: (ev: Event) => {
          this.searchQuery = (ev.target as HTMLInputElement).value.trim().toLowerCase();
          this.renderGrid();
        },
        keydown: (ev: KeyboardEvent) => {
          ev.stopPropagation();
          if (ev.key === 'Escape') {
            this.searchInput.value = '';
            this.searchQuery = '';
            this.searchInput.blur();
            this.renderGrid();
          }
        }
      }
    }) as HTMLInputElement;

    const closeBtn = withTooltip(
      el('button', {
        class: 'god-panel-close-btn',
        attrs: { 'aria-label': 'Fechar paleta' },
        on: { click: () => this.toggle() }
      }, [icon('close', { size: 16 })]),
      { title: 'Fechar', description: 'Fecha a paleta. A ferramenta ativa continua armada.', shortcut: 'Tab' }
    );

    const header = el('div', { class: 'god-panel-header' }, [
      el('div', { class: 'god-panel-title' }, [
        icon('power', { size: 16 }),
        el('span', { text: 'Poderes Divinos & Edição' })
      ]),
      closeBtn
    ]);

    this.root = el('div', { class: 'dock god-powers-popover hidden' }, [
      header,
      el('div', { class: 'dock-top' }, [
        this.tabsEl,
        el('div', { class: 'dock-top-right' }, [this.searchInput])
      ]),
      this.gridEl,
      el('div', { class: 'dock-bottom' }, [
        el('div', { class: 'active-tool' }, [
          el('span', { class: 'active-tool-badge', text: 'ATIVO' }),
          el('div', { class: 'active-tool-info' }, [this.activeNameEl, this.activeDescEl])
        ]),
        el('div', { class: 'brush-control' }, [
          el('span', { class: 'brush-label', text: 'RAIO' }),
          this.sizeEl
        ])
      ])
    ]);

    this.renderTabs();
    this.renderSizes();
    this.renderGrid();
    this.syncActiveTool();
    this.applyCompact();

    settings.onChange(() => this.applyCompact());
  }

  /** Whether the palette is showing. Read by the HUD's ESC chain. */
  public get isOpen(): boolean {
    return this.isVisible;
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.root.classList.toggle('hidden', !this.isVisible);
    if (this.isVisible) {
      sound.playClick();
      // Inspection is now the resting category, and it contains exactly one
      // entry — which is not what a player opening a powers palette came to see.
      // Land them on terrain instead, where the powers actually are.
      if (this.ctx.brush.activeCategory === 'inspect') {
        this.ctx.brush.setCategory('terrain');
        this.renderTabs();
        this.renderGrid();
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.root.classList.toggle('hidden', !this.isVisible);
  }

  private applyCompact(): void {
    this.root.classList.toggle('compact', settings.get('compactToolbar'));
  }

  public focusSearch(): void {
    if (!this.isVisible) this.setVisible(true);
    this.searchInput.focus();
    this.searchInput.select();
  }

  public selectCategory(cat: BrushCategory): void {
    this.ctx.brush.setCategory(cat);
    this.searchQuery = '';
    this.searchInput.value = '';
    this.renderTabs();
    this.renderGrid();
  }

  public selectCategoryByIndex(index: number): void {
    const cat = CATEGORIES[index];
    if (cat) this.selectCategory(cat.id);
  }

  public cycleBrushSize(delta: number): void {
    const current = BRUSH_SIZES.indexOf(this.ctx.brush.brushSize);
    const next = Math.max(0, Math.min(BRUSH_SIZES.length - 1, (current === -1 ? 2 : current) + delta));
    this.ctx.brush.setSize(BRUSH_SIZES[next]);
    this.renderSizes();
  }

  private renderTabs(): void {
    clear(this.tabsEl);
    for (const cat of CATEGORIES) {
      const isActive = this.ctx.brush.activeCategory === cat.id;
      this.tabsEl.appendChild(
        withTooltip(
          el(
            'button',
            {
              class: `dock-tab${isActive ? ' active' : ''}`,
              style: { '--tab-accent': cat.accent },
              on: { click: () => { sound.playClick(); this.selectCategory(cat.id); } }
            },
            [
              icon(cat.icon, { size: 16, class: 'tab-icon' }),
              el('span', { class: 'tab-label', text: cat.label }),
              el('kbd', { class: 'tab-key', text: cat.hotkey })
            ]
          ),
          { title: cat.label, icon: cat.icon, accent: cat.accent, shortcut: `Shift+${cat.hotkey}` }
        )
      );
    }
  }

  private renderSizes(): void {
    clear(this.sizeEl);
    for (const size of BRUSH_SIZES) {
      const isActive = this.ctx.brush.brushSize === size;
      this.sizeEl.appendChild(
        el('button', {
          class: `brush-size${isActive ? ' active' : ''}`,
          text: `${size}`,
          title: `Raio do pincel: ${size} blocos`,
          on: {
            click: () => {
              this.ctx.brush.setSize(size);
              this.renderSizes();
            }
          }
        })
      );
    }
  }

  private visiblePowers(): PowerDefinition[] {
    if (this.searchQuery) {
      return ALL_POWERS.filter(
        p =>
          p.name.toLowerCase().includes(this.searchQuery) ||
          p.description.toLowerCase().includes(this.searchQuery)
      );
    }
    return ALL_POWERS.filter(p => p.category === this.ctx.brush.activeCategory);
  }

  private renderGrid(): void {
    clear(this.gridEl);
    const powers = this.visiblePowers();

    if (powers.length === 0) {
      this.gridEl.appendChild(el('div', { class: 'dock-empty', text: 'Nenhum poder encontrado.' }));
      return;
    }

    for (const power of powers) {
      const isActive = power.id === this.ctx.brush.activePowerId;
      const accent = CATEGORIES.find(c => c.id === power.category)?.accent ?? 'var(--ae-accent)';

      const node = el(
        'button',
        {
          class: `power${isActive ? ' active' : ''}`,
          style: { '--power-accent': accent },
          on: { click: () => this.selectPower(power) }
        },
        [
          icon(power.icon, { size: 16, class: 'power-icon' }),
          el('span', { class: 'power-name', text: power.name })
        ]
      );
      // The palette is the one place the player is reading descriptions, so the
      // tooltip is worth having even when the setting suppresses them elsewhere.
      if (settings.get('showTooltips')) {
        withTooltip(node, { title: power.name, description: power.description, icon: power.icon, accent });
      }
      this.gridEl.appendChild(node);
    }
  }

  private selectPower(power: PowerDefinition): void {
    sound.playClick();
    this.ctx.brush.setPower(power.id);
    if (this.ctx.brush.activeCategory !== power.category) {
      this.ctx.brush.setCategory(power.category);
      this.renderTabs();
    }
    this.syncActiveTool();
    this.renderGrid();
  }

  /**
   * Updates the active-tool line. Called every frame, so it returns immediately
   * when the tool has not changed rather than re-scanning the power list and
   * rewriting text that is already correct.
   */
  public syncActiveTool(): void {
    if (this.ctx.brush.activePowerId === this.lastSyncedPowerId) return;
    this.lastSyncedPowerId = this.ctx.brush.activePowerId;
    const power = ALL_POWERS.find(p => p.id === this.ctx.brush.activePowerId);
    if (!power) return;
    this.activeNameEl.textContent = power.name;
    this.activeDescEl.textContent = power.description;
  }
}
