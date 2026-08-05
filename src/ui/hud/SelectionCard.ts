/**
 * The selection card.
 *
 * A small answer to a small question: "what did I just click?" Name, kind, two
 * or three facts, and a way in. It is explicitly **not** the inspector — the
 * full dossier is UI-2's problem, and the card's job is to be enough that most
 * clicks never need to open one.
 *
 * That distinction is why it is capped at three facts. Given four it would grow
 * to five, then eight, and become a second inspector docked to the corner of the
 * map — which is the permanent-panel habit UI-1 exists to break.
 */
import { el, clear } from '../core/Dom';
import { icon, setIcon, button, withTooltip } from '../kit';
import { sound } from '../../core/SoundSynth';
import type { SelectionView } from './Selection';

export class SelectionCard {
  public readonly root: HTMLElement;

  private iconEl: HTMLImageElement;
  private nameEl: HTMLElement;
  private kindEl: HTMLElement;
  private factsEl: HTMLElement;
  private actionsEl: HTMLElement;
  /** Held so `inspectable: false` targets can hide it without a rebuild. */
  private inspectBtn: HTMLElement;
  private current: SelectionView | null = null;

  constructor(handlers: {
    onInspect: (view: SelectionView) => void;
    onFocus: (view: SelectionView) => void;
    onClose: () => void;
  }) {
    this.iconEl = icon('city', { size: 32, class: 'ae-selcard-icon' });
    this.nameEl = el('h2', { class: 'ae-selcard-name' });
    this.kindEl = el('span', { class: 'ae-selcard-kind' });
    this.factsEl = el('div', { class: 'ae-selcard-facts' });

    const inspectBtn = button('Inspecionar', () => {
      if (this.current) handlers.onInspect(this.current);
    }, {
      variant: 'primary',
      size: 'sm',
      icon: 'search',
      tooltip: {
        title: 'Inspecionar',
        description: 'Abre o painel completo com tudo o que se sabe sobre este alvo.',
        shortcut: 'I'
      }
    });

    const focusBtn = withTooltip(
      el('button', {
        class: 'ae-selcard-icon-btn',
        attrs: { type: 'button', 'aria-label': 'Centralizar' },
        on: { click: () => { if (this.current) { sound.playClick(); handlers.onFocus(this.current); } } }
      }, [icon('map', { size: 16 })]),
      { title: 'Centralizar', description: 'Move a câmera até este alvo.' }
    );

    const closeBtn = withTooltip(
      el('button', {
        class: 'ae-selcard-icon-btn',
        attrs: { type: 'button', 'aria-label': 'Limpar seleção' },
        on: { click: () => { sound.playClick(); handlers.onClose(); } }
      }, [icon('close', { size: 16 })]),
      { title: 'Limpar seleção', shortcut: 'Esc' }
    );

    this.actionsEl = el('div', { class: 'ae-selcard-actions' }, [inspectBtn, focusBtn, closeBtn]);
    this.inspectBtn = inspectBtn;

    this.root = el('aside', { class: 'ae-selcard hidden', attrs: { 'aria-live': 'polite' } }, [
      el('div', { class: 'ae-selcard-head' }, [
        this.iconEl,
        el('div', { class: 'ae-selcard-heading' }, [this.nameEl, this.kindEl])
      ]),
      this.factsEl,
      this.actionsEl
    ]);
  }

  /**
   * Shows a selection, or hides the card when passed null.
   *
   * Called both on a new selection and on the slow refresh that keeps a selected
   * city's population current, so it updates in place rather than rebuilding —
   * a rebuild would restart the entry animation twice a second and drop any
   * tooltip the player was reading.
   */
  public show(view: SelectionView | null): void {
    if (!view) {
      this.current = null;
      this.root.classList.add('hidden');
      return;
    }

    const isNewTarget = this.current?.name !== view.name || this.current?.kindLabel !== view.kindLabel;
    this.current = view;

    setIcon(this.iconEl, view.icon);
    this.nameEl.textContent = view.name;
    this.kindEl.textContent = view.kindLabel;
    this.root.style.setProperty('--ae-realm', view.accent ?? 'var(--ae-accent)');

    clear(this.factsEl);
    // Three is the cap, enforced here rather than trusted to callers.
    for (const fact of view.facts.slice(0, 3)) {
      this.factsEl.appendChild(el('div', { class: 'ae-selcard-fact' }, [
        el('span', { class: 'ae-selcard-fact-label', text: fact.label }),
        el('span', { class: 'ae-selcard-fact-value', text: fact.value })
      ]));
    }

    this.inspectBtn.classList.toggle('hidden', !view.inspectable);
    this.root.classList.remove('hidden');

    // The entry animation replays only for a genuinely different target.
    if (isNewTarget) {
      this.root.classList.remove('ae-selcard-in');
      // Reading offsetWidth forces the removal to take effect before the class is
      // re-added; without it the browser coalesces both into no change at all.
      void this.root.offsetWidth;
      this.root.classList.add('ae-selcard-in');
    }
  }

  public get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }
}
