import { el } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

const LORE_TIPS = [
  'As cidades crescem onde há comida em abundância. Pinte grama fértil para encorajar o assentamento.',
  'Incêndios florestais se espalham pelas florestas. A chuva é a única coisa que os detém com segurança.',
  'Reinos de espécies diferentes tendem à hostilidade por conta própria.',
  'Um reino cujo governante morre coroará seu súdito sobrevivente mais forte.',
  'Dragões deixam equipamentos lendários quando mortos por um humanoide próximo.',
  'Emberkin declaram guerra muito mais facilmente do que qualquer outra espécie.',
  'Stonekin colonizam as montanhas onde os outros não conseguem cultivar.',
  'A Crônica registra cada fundação, guerra e coroação automaticamente.',
  'Abençoe uma criatura para aumentar sua vida máxima; amaldiçoe-a para quebrá-la.',
  'Arrastar com o botão direito move a câmera, e a roda do mouse aproxima a visão na direção do cursor.'
];

export interface LoadingParams {
  title?: string;
  steps?: string[];
}

/** Shown while a world generates or a save restores. Not dismissable. */
export class LoadingScreen implements Screen {
  public readonly id = 'loading' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = false;

  private barEl: HTMLElement | null = null;
  private stepEl: HTMLElement | null = null;
  private progress = 0;

  public build(_ctx: GameContext, params: LoadingParams = {}): HTMLElement {
    const tip = LORE_TIPS[Math.floor(Math.random() * LORE_TIPS.length)];

    this.barEl = el('div', { class: 'loading-fill' });
    this.stepEl = el('p', { class: 'loading-step', text: params.steps?.[0] ?? 'Moldando o mundo…' });
    this.progress = 0;

    return el('div', { class: 'loading-screen' }, [
      el('div', { class: 'loading-inner' }, [
        el('div', { class: 'loading-mark', text: '✦' }),
        el('h2', { class: 'loading-title', text: params.title ?? 'Creating Aethoria' }),
        this.stepEl,
        el('div', { class: 'loading-track' }, [this.barEl]),
        el('div', { class: 'loading-tip' }, [
          el('span', { class: 'tip-label', text: 'VOCÊ SABIA' }),
          el('p', { class: 'tip-text', text: tip })
        ])
      ])
    ]);
  }

  /** Called by the engine as generation progresses. `value` is 0..1. */
  public setProgress(value: number, step?: string): void {
    this.progress = Math.max(0, Math.min(1, value));
    if (this.barEl) this.barEl.style.width = `${this.progress * 100}%`;
    if (step && this.stepEl) this.stepEl.textContent = step;
  }
}
