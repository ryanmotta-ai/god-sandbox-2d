import { el, clear, button, formatDate, formatNumber } from '../core/Dom';
import { SaveSystem, SLOT_COUNT, AUTOSAVE_SLOT } from '../../core/SaveSystem';
import { MapPreview } from '../components/MapPreview';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

/** Save slot browser with thumbnails, plus JSON export/import. */
export class SaveLoadScreen implements Screen {
  public readonly id = 'saveload' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private ctx!: GameContext;
  private slotsEl!: HTMLElement;
  private fromMenu = false;

  public build(ctx: GameContext, params?: { fromMenu?: boolean }): HTMLElement {
    this.ctx = ctx;
    this.fromMenu = params?.fromMenu ?? false;
    this.slotsEl = el('div', { class: 'slot-grid' });

    const layout = el('div', { class: 'screen-panel' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '💾 Save & Load' }),
          el('p', { class: 'screen-sub', text: this.fromMenu ? 'Choose a world to continue.' : 'Worlds are stored in your browser. Export to keep them permanently.' })
        ]),
        button('Close', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
      ]),

      this.slotsEl,

      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [
          el('h3', { class: 'panel-title', text: 'Transfer' }),
          el('p', { class: 'panel-sub', text: 'Move a world between devices as a .json file.' })
        ]),
        el('div', { class: 'panel-body' }, [
          el('div', { class: 'action-row' }, [
            button('Export current world', () => this.exportWorld(), { variant: 'primary', icon: '⬇️' }),
            this.importControl()
          ])
        ])
      ])
    ]);

    this.renderSlots();
    return layout;
  }

  private renderSlots(): void {
    clear(this.slotsEl);
    const slots = SaveSystem.listSlots();

    for (const info of slots) {
      const isAutosave = info.slot === AUTOSAVE_SLOT;
      const label = isAutosave ? 'Autosave' : `Slot ${info.slot}`;

      const thumb = el('div', { class: 'slot-thumb' });
      if (info.exists && info.thumbnail) {
        thumb.appendChild(el('img', { attrs: { src: info.thumbnail, alt: `${label} preview` } }));
      } else {
        thumb.appendChild(el('span', { class: 'slot-thumb-empty', text: isAutosave ? '⏱️' : '🗺️' }));
      }

      const meta = info.exists
        ? el('div', { class: 'slot-meta' }, [
            el('span', { class: 'slot-name', text: info.name }),
            el('span', { class: 'slot-detail', text: `Year ${info.year} · ${info.era}` }),
            el('span', { class: 'slot-detail', text: `👥 ${formatNumber(info.population)} · 👑 ${info.kingdoms} · ${info.size}²` }),
            el('span', { class: 'slot-date', text: formatDate(info.timestamp) })
          ])
        : el('div', { class: 'slot-meta' }, [
            el('span', { class: 'slot-name empty', text: 'Empty slot' }),
            el('span', { class: 'slot-detail', text: isAutosave ? 'Enable autosave in Settings' : 'Save a world here' })
          ]);

      const actions = el('div', { class: 'slot-actions' }, [
        info.exists
          ? button('Load', () => this.load(info.slot), { variant: 'primary', icon: '📂' })
          : null,
        this.ctx.inGame && !isAutosave
          ? button(info.exists ? 'Overwrite' : 'Save here', () => this.save(info.slot), { icon: '💾' })
          : null,
        info.exists
          ? button('Delete', () => this.remove(info.slot), { variant: 'danger', icon: '🗑️' })
          : null
      ].filter(Boolean) as HTMLElement[]);

      this.slotsEl.appendChild(
        el('article', { class: `slot-card${info.exists ? '' : ' empty'}${isAutosave ? ' autosave' : ''}` }, [
          el('div', { class: 'slot-head' }, [
            el('span', { class: 'slot-label', text: label }),
            isAutosave ? el('span', { class: 'slot-tag', text: 'AUTO' }) : null
          ].filter(Boolean) as HTMLElement[]),
          thumb,
          meta,
          actions
        ])
      );
    }
  }

  private save(slot: number): void {
    const data = this.ctx.buildSaveData();

    // Render a thumbnail of the current world for the slot card.
    const preview = new MapPreview(160, 160);
    preview.drawTileMap(this.ctx.tileMap, { kingdoms: this.ctx.sim.kingdoms, cities: this.ctx.sim.cities });

    SaveSystem.writeSlot(slot, data, {
      name: `${this.ctx.eras.getCurrentEra()} · Seed ${this.ctx.worldConfig.seed}`,
      thumbnail: preview.toDataUrl()
    });

    this.ctx.toast(`World saved to slot ${slot}`, 'success');
    this.renderSlots();
  }

  private load(slot: number): void {
    const data = SaveSystem.readSlot(slot);
    if (!data) {
      this.ctx.toast('That save could not be read', 'warning');
      return;
    }
    if (this.ctx.inGame && !confirm('Load this world? Unsaved progress in the current world will be lost.')) return;

    if (this.ctx.loadSaveData(data)) {
      this.ctx.toast(`World restored from slot ${slot}`, 'success');
    } else {
      this.ctx.toast('This save file is corrupted or from an older version', 'warning');
    }
  }

  private remove(slot: number): void {
    if (!confirm('Delete this save permanently?')) return;
    SaveSystem.deleteSlot(slot);
    this.ctx.toast('Save deleted', 'info');
    this.renderSlots();
  }

  private exportWorld(): void {
    if (!this.ctx.inGame) {
      this.ctx.toast('There is no world to export yet', 'warning');
      return;
    }
    const data = this.ctx.buildSaveData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aethoria_year${this.ctx.sim.currentYear}_seed${this.ctx.worldConfig.seed}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.ctx.toast('Save file exported', 'success');
  }

  private importControl(): HTMLElement {
    const input = el('input', {
      attrs: { type: 'file', accept: '.json', hidden: true },
      on: {
        change: (ev: Event) => {
          const file = (ev.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(String(reader.result));
              if (this.ctx.loadSaveData(data)) {
                this.ctx.toast('World imported successfully', 'success');
              } else {
                this.ctx.toast('That file is not a valid Aethoria save', 'warning');
              }
            } catch {
              this.ctx.toast('That file could not be parsed', 'warning');
            }
          };
          reader.readAsText(file);
        }
      }
    }) as HTMLInputElement;

    return el('label', { class: 'btn btn-ghost file-btn' }, [
      el('span', { class: 'btn-icon', text: '⬆️' }),
      el('span', { class: 'btn-label', text: 'Import save file' }),
      input
    ]);
  }
}

export { SLOT_COUNT };
