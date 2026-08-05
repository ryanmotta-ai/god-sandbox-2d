/**
 * The two notification surfaces, and the reason there are two.
 *
 * `AlertFeed` shows things that might need acting on. It is capped at a handful,
 * each line carries a severity edge, and every line is clickable: it takes the
 * camera to whatever the alert is about and selects it. That click is the point
 * of the whole alert system — an alert you cannot follow is just a sentence.
 *
 * `EventFeed` shows things that merely happened. No severity, no dismiss, no
 * click target beyond a courtesy jump; lines fade out on their own. It exists so
 * that the world feels alive without the Chronicle being pinned open, which is
 * what the brief means by keeping history out of the way but not out of reach.
 *
 * Both render from `AlertCenter` and neither reads the simulation.
 */
import { el, clear } from '../core/Dom';
import { icon, withTooltip } from '../kit';
import { sound } from '../../core/SoundSynth';
import type { Alert, AlertCenter, Severity, WorldEventEntry } from '../core/Alerts';

/** How many alerts are on screen at once. Beyond this they wait their turn. */
const VISIBLE_ALERTS = 4;

const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'Informação',
  warning: 'Atenção',
  critical: 'Crítico'
};

export interface FeedHandlers {
  /** Take the camera to a place and select what is there. */
  onGoTo: (target: { focus?: { x: number; y: number }; ref?: Alert['ref'] }) => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export class AlertFeed {
  public readonly root: HTMLElement;
  private listEl: HTMLElement;
  private overflowEl: HTMLElement;
  private center: AlertCenter;
  private handlers: FeedHandlers;
  /** Signature of what is currently rendered, so an unchanged list is not rebuilt. */
  private renderedKey = '';

  constructor(center: AlertCenter, handlers: FeedHandlers) {
    this.center = center;
    this.handlers = handlers;

    this.listEl = el('div', { class: 'ae-alert-list' });
    this.overflowEl = el('button', {
      class: 'ae-alert-overflow hidden',
      attrs: { type: 'button' },
      on: { click: () => { sound.playClick(); this.handlers.onDismissAll(); } }
    });

    this.root = el('div', { class: 'ae-alerts hidden', attrs: { 'aria-live': 'polite' } }, [
      this.listEl,
      this.overflowEl
    ]);
  }

  /**
   * Rebuilds the list when it has actually changed.
   *
   * The guard is a signature over id and count, which is what a re-render would
   * change. Without it this runs every frame, tearing down and rebuilding four
   * nodes — and destroying any tooltip the player is mid-read of.
   */
  public sync(): void {
    const all = this.center.active;
    const shown = all.slice(0, VISIBLE_ALERTS);
    const key = shown.map(a => `${a.id}:${a.count}`).join('|') + `#${all.length}`;
    if (key === this.renderedKey) return;
    this.renderedKey = key;

    this.root.classList.toggle('hidden', all.length === 0);
    clear(this.listEl);
    for (const alert of shown) this.listEl.appendChild(this.buildRow(alert));

    const hidden = all.length - shown.length;
    this.overflowEl.classList.toggle('hidden', hidden <= 0);
    if (hidden > 0) {
      this.overflowEl.textContent = `+${hidden} · limpar todos`;
    }
  }

  private buildRow(alert: Alert): HTMLElement {
    // Only clickable when there is somewhere to go. An alert about a realm with
    // no capital on the map has nothing to centre on, and a button that does
    // nothing is worse than plain text.
    const navigable = Boolean(alert.focus || alert.ref);

    const dismiss = withTooltip(
      el('button', {
        class: 'ae-alert-dismiss',
        attrs: { type: 'button', 'aria-label': 'Descartar' },
        on: {
          click: (ev: MouseEvent) => {
            ev.stopPropagation();
            this.handlers.onDismiss(alert.id);
          }
        }
      }, [icon('close', { size: 16 })]),
      { title: 'Descartar' }
    );

    const row = el(navigable ? 'button' : 'div', {
      class: `ae-alert ae-alert-${alert.severity}${navigable ? ' ae-alert-live' : ''}`,
      attrs: navigable ? { type: 'button' } : {},
      on: navigable
        ? {
            click: () => {
              sound.playClick();
              this.handlers.onGoTo({ focus: alert.focus, ref: alert.ref });
            }
          }
        : undefined
    }, [
      icon(this.center.iconFor(alert.kind), { size: 16, class: 'ae-alert-icon' }),
      el('div', { class: 'ae-alert-text' }, [
        el('span', { class: 'ae-alert-title', text: alert.title }),
        alert.description ? el('span', { class: 'ae-alert-desc', text: alert.description }) : null
      ]),
      alert.count > 1 ? el('span', { class: 'ae-alert-count', text: `${alert.count}` }) : null,
      dismiss
    ]);

    return withTooltip(row, {
      title: alert.title,
      description: alert.description,
      icon: this.center.iconFor(alert.kind),
      rows: [
        { label: 'Severidade', value: SEVERITY_LABEL[alert.severity], status: alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'neutral' },
        { label: 'Ano', value: `${alert.year}` },
        ...(alert.count > 1 ? [{ label: 'Ocorrências', value: `${alert.count}` }] : [])
      ],
      footnote: navigable ? 'Clique para ir até lá' : undefined
    });
  }
}

export class EventFeed {
  public readonly root: HTMLElement;
  private center: AlertCenter;
  private onGoTo: FeedHandlers['onGoTo'];
  private renderedKey = '';

  constructor(center: AlertCenter, onGoTo: FeedHandlers['onGoTo']) {
    this.center = center;
    this.onGoTo = onGoTo;
    this.root = el('div', { class: 'ae-events hidden' });
  }

  public sync(): void {
    const entries = this.center.recent;
    const key = entries.map(e => e.id).join('|');
    if (key === this.renderedKey) return;
    this.renderedKey = key;

    this.root.classList.toggle('hidden', entries.length === 0);
    clear(this.root);
    for (const entry of entries) this.root.appendChild(this.buildRow(entry));
  }

  private buildRow(entry: WorldEventEntry): HTMLElement {
    const navigable = Boolean(entry.focus || entry.ref);
    return el(navigable ? 'button' : 'div', {
      class: `ae-event${navigable ? ' ae-event-live' : ''}`,
      attrs: navigable ? { type: 'button' } : {},
      on: navigable ? { click: () => this.onGoTo({ focus: entry.focus, ref: entry.ref }) } : undefined
    }, [
      icon(entry.icon, { size: 16, class: 'ae-event-icon' }),
      el('span', { class: 'ae-event-text', text: entry.text }),
      el('span', { class: 'ae-event-year', text: `${entry.year}` })
    ]);
  }
}
