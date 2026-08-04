import { el, clear } from '../core/Dom';
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
  { id: 'terrain', label: 'Terreno', icon: '⛰️', hotkey: '1', accent: '#a3a3a3' },
  { id: 'nature', label: 'Natureza', icon: '🌿', hotkey: '2', accent: '#34d399' },
  { id: 'biomes', label: 'Biomas', icon: '🏝️', hotkey: '3', accent: '#22d3ee' },
  { id: 'life', label: 'Vida & Espécies', icon: '👥', hotkey: '4', accent: '#fbbf24' },
  { id: 'divine', label: 'Milagres', icon: '⚡', hotkey: '5', accent: '#a855f7' },
  { id: 'destruction', label: 'Desastres', icon: '💥', hotkey: '6', accent: '#ef4444' },
  { id: 'inspect', label: 'Inspecionar', icon: '🔍', hotkey: '7', accent: '#38bdf8' }
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

    const closeBtn = el('button', {
      class: 'god-panel-close-btn',
      text: '✕',
      on: { click: () => this.toggle() }
    });

    const header = el('div', { class: 'god-panel-header' }, [
      el('div', { class: 'god-panel-title' }, [
        el('span', { text: '⚡ Paleta de Poderes Divinos & Edição' })
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

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.root.classList.toggle('hidden', !this.isVisible);
    if (this.isVisible) sound.playClick();
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
        el(
          'button',
          {
            class: `dock-tab${isActive ? ' active' : ''}`,
            title: `${cat.label}  (${cat.hotkey})`,
            style: isActive ? { '--tab-accent': cat.accent } as any : undefined,
            on: { click: () => { sound.playClick(); this.selectCategory(cat.id); } }
          },
          [
            el('span', { class: 'tab-icon', text: cat.icon }),
            el('span', { class: 'tab-label', text: cat.label }),
            el('kbd', { class: 'tab-key', text: cat.hotkey })
          ]
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
      const accent = CATEGORIES.find(c => c.id === power.category)?.accent ?? '#94a3b8';

      this.gridEl.appendChild(
        el(
          'button',
          {
            class: `power${isActive ? ' active' : ''}`,
            title: settings.get('showTooltips') ? `${power.name} — ${power.description}` : power.name,
            style: { '--power-accent': accent } as any,
            on: { click: () => this.selectPower(power) }
          },
          [
            el('span', { class: 'power-icon', text: power.icon }),
            el('span', { class: 'power-name', text: power.name })
          ]
        )
      );
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

  public syncActiveTool(): void {
    const power = ALL_POWERS.find(p => p.id === this.ctx.brush.activePowerId);
    if (!power) return;
    this.activeNameEl.textContent = `${power.icon} ${power.name}`;
    this.activeDescEl.textContent = power.description;
  }
}
