import { el } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

const LORE_TIPS = [
  'Cities grow where food is plentiful. Paint fertile grass to encourage settlement.',
  'Wildfires spread along forests. Rain is the only thing that reliably stops them.',
  'Kingdoms of different species drift toward hostility on their own.',
  'A kingdom whose ruler dies will crown its strongest surviving subject.',
  'Dragons drop legendary equipment when slain by a nearby humanoid.',
  'Emberkin declare war far more readily than any other species.',
  'Stonekin settle the mountains where others cannot farm.',
  'The Chronicle records every founding, war and coronation automatically.',
  'Bless a creature to raise its maximum health; curse one to break it.',
  'Right-drag pans the camera, and the mouse wheel zooms toward the cursor.'
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
    this.stepEl = el('p', { class: 'loading-step', text: params.steps?.[0] ?? 'Shaping the world…' });
    this.progress = 0;

    return el('div', { class: 'loading-screen' }, [
      el('div', { class: 'loading-inner' }, [
        el('div', { class: 'loading-mark', text: '✦' }),
        el('h2', { class: 'loading-title', text: params.title ?? 'Creating Aethoria' }),
        this.stepEl,
        el('div', { class: 'loading-track' }, [this.barEl]),
        el('div', { class: 'loading-tip' }, [
          el('span', { class: 'tip-label', text: 'DID YOU KNOW' }),
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
