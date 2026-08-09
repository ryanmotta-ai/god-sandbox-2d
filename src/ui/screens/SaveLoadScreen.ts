import { el, clear, button, formatDate, formatNumber } from '../core/Dom';
import { SaveSystem, SLOT_COUNT, AUTOSAVE_SLOT } from '../../core/SaveSystem';
import { MapPreview } from '../components/MapPreview';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

/** Save slot browser with thumbnails, plus portable .aethoria/legacy JSON transfer. */
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
          el('h2', { class: 'screen-title', text: '💾 Salvar e Carregar' }),
          el('p', { class: 'screen-sub', text: this.fromMenu ? 'Escolha um mundo para continuar.' : 'Os mundos usam o armazenamento seguro disponível nesta plataforma.' })
        ]),
        button('Fechar', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
      ]),

      this.slotsEl,

      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [
          el('h3', { class: 'panel-title', text: 'Transferência' }),
          el('p', { class: 'panel-sub', text: 'Mova um mundo entre dispositivos como arquivo .aethoria.' })
        ]),
        el('div', { class: 'panel-body' }, [
          el('div', { class: 'action-row' }, [
            button('Exportar mundo atual', () => this.exportWorld(), { variant: 'primary', icon: '⬇️' }),
            this.importControl()
          ])
        ])
      ])
    ]);

    void this.renderSlots();
    return layout;
  }

  private async renderSlots(): Promise<void> {
    clear(this.slotsEl);
    let slots;
    try {
      slots = await SaveSystem.listSlots();
    } catch (error) {
      this.reportStorageError('Não foi possível listar os saves', error);
      return;
    }

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
            el('span', { class: 'slot-name empty', text: 'Slot vazio' }),
            el('span', { class: 'slot-detail', text: isAutosave ? 'Ative o autosave nas Configurações' : 'Salve um mundo aqui' })
          ]);

      const actions = el('div', { class: 'slot-actions' }, [
        info.exists
          ? button('Carregar', () => void this.load(info.slot), { variant: 'primary', icon: '📂' })
          : null,
        this.ctx.inGame && !isAutosave
          ? button(info.exists ? 'Sobrescrever' : 'Salvar aqui', () => void this.save(info.slot), { icon: '💾' })
          : null,
        info.exists
          ? button('Excluir', () => void this.remove(info.slot), { variant: 'danger', icon: '🗑️' })
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

  private async save(slot: number): Promise<void> {
    const data = this.ctx.buildSaveData();

    // Render a thumbnail of the current world for the slot card.
    const preview = new MapPreview(160, 160);
    preview.drawTileMap(this.ctx.tileMap, { kingdoms: this.ctx.sim.kingdoms, cities: this.ctx.sim.cities });

    try {
      await SaveSystem.writeSlot(slot, data, {
        name: `${this.ctx.eras.getCurrentEra()} · Seed ${this.ctx.worldConfig.seed}`,
        seed: this.ctx.worldConfig.seed,
        thumbnail: preview.toDataUrl()
      });
    } catch (error) {
      this.reportStorageError(`Não foi possível salvar no slot ${slot}`, error);
      return;
    }

    this.ctx.toast(`Mundo salvo no slot ${slot}`, 'success');
    await this.renderSlots();
  }

  private async load(slot: number): Promise<void> {
    let data;
    try {
      data = await SaveSystem.readSlot(slot);
    } catch (error) {
      this.reportStorageError('Este save não pôde ser lido', error);
      return;
    }
    if (!data) {
      this.ctx.toast('Este save não pôde ser lido', 'warning');
      return;
    }
    if (this.ctx.inGame && !confirm('Carregar este mundo? O progresso não salvo no mundo atual será perdido.')) return;

    if (this.ctx.loadSaveData(data)) {
      this.ctx.toast(`Mundo restaurado do slot ${slot}`, 'success');
    } else {
      this.ctx.toast('Este arquivo de save está corrompido ou é de uma versão mais antiga', 'warning');
    }
  }

  private async remove(slot: number): Promise<void> {
    if (!confirm('Excluir este save permanentemente?')) return;
    try {
      await SaveSystem.deleteSlot(slot);
    } catch (error) {
      this.reportStorageError('Não foi possível excluir o save', error);
      return;
    }
    this.ctx.toast('Save excluído', 'info');
    await this.renderSlots();
  }

  private exportWorld(): void {
    if (!this.ctx.inGame) {
      this.ctx.toast('Não há mundo para exportar ainda', 'warning');
      return;
    }
    const data = this.ctx.buildSaveData();
    const serialized = SaveSystem.serializePortableSave(data, {
      name: `${this.ctx.eras.getCurrentEra()} · Seed ${this.ctx.worldConfig.seed}`,
      seed: this.ctx.worldConfig.seed
    });
    const blob = new Blob([serialized], { type: 'application/vnd.aethoria.save+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aethoria_ano${this.ctx.sim.currentYear}_semente${this.ctx.worldConfig.seed}.aethoria`;
    link.click();
    URL.revokeObjectURL(url);
    this.ctx.toast('Arquivo de save exportado', 'success');
  }

  private importControl(): HTMLElement {
    const input = el('input', {
      attrs: { type: 'file', accept: '.aethoria,.json,application/json', hidden: true },
      on: {
        change: (ev: Event) => {
          const file = (ev.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = SaveSystem.parsePortableSave(String(reader.result));
              if (this.ctx.loadSaveData(data)) {
                this.ctx.toast('Mundo importado com sucesso', 'success');
              } else {
                this.ctx.toast('Esse arquivo não é um save válido de Aethoria', 'warning');
              }
            } catch {
              this.ctx.toast('Esse arquivo não pôde ser analisado', 'warning');
            }
          };
          reader.readAsText(file);
        }
      }
    }) as HTMLInputElement;

    return el('label', { class: 'btn btn-ghost file-btn' }, [
      el('span', { class: 'btn-icon', text: '⬆️' }),
      el('span', { class: 'btn-label', text: 'Importar arquivo de save' }),
      input
    ]);
  }

  private reportStorageError(prefix: string, error: unknown): void {
    console.error(prefix, error);
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : 'unknown';
    const detail: Record<string, string> = {
      permission_denied: 'Permissão de acesso negada.',
      disk_full: 'Não há espaço suficiente no disco.',
      corrupted_file: 'O arquivo está corrompido.',
      invalid_format: 'O arquivo não é um save válido de Aethoria.',
      unsupported_version: 'O save foi criado por uma versão mais nova de Aethoria.',
      missing_file: 'O arquivo não existe mais.',
      write_failure: 'A gravação do arquivo falhou.',
      rollback_failure: 'A gravação falhou e o backup anterior precisa ser verificado.'
    };
    this.ctx.toast(`${prefix}. ${detail[code] ?? 'Verifique o armazenamento e tente novamente.'}`, 'warning');
  }
}

export { SLOT_COUNT };
