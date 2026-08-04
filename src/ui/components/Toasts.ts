import { el } from '../core/Dom';

export type ToastType = 'info' | 'success' | 'warning' | 'war' | 'kingdom' | 'disaster' | 'divine';

const TOAST_STYLE: Record<ToastType, { icon: string; color: string }> = {
  info: { icon: 'ℹ️', color: '#38bdf8' },
  success: { icon: '✅', color: '#10b981' },
  warning: { icon: '⚠️', color: '#f59e0b' },
  war: { icon: '⚔️', color: '#ef4444' },
  kingdom: { icon: '👑', color: '#fbbf24' },
  disaster: { icon: '💥', color: '#f97316' },
  divine: { icon: '✨', color: '#a855f7' }
};

const MAX_VISIBLE = 5;
const LIFETIME_MS = 4200;

/** Stacked notification toasts in the bottom-left of the game view. */
export class ToastManager {
  private container: HTMLElement;
  private active: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public show(message: string, type: ToastType = 'info'): void {
    const style = TOAST_STYLE[type] ?? TOAST_STYLE.info;

    const node = el(
      'div',
      {
        class: `toast toast-${type}`,
        style: { borderLeftColor: style.color }
      },
      [
        el('span', { class: 'toast-icon', text: style.icon }),
        el('span', { class: 'toast-text', text: message })
      ]
    );

    this.container.appendChild(node);
    this.active.push(node);

    while (this.active.length > MAX_VISIBLE) {
      const oldest = this.active.shift();
      oldest?.remove();
    }

    window.setTimeout(() => {
      node.classList.add('toast-out');
      window.setTimeout(() => {
        node.remove();
        this.active = this.active.filter(n => n !== node);
      }, 280);
    }, LIFETIME_MS);
  }

  public clear(): void {
    for (const node of this.active) node.remove();
    this.active = [];
  }
}
