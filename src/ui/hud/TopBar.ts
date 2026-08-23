/**
 * The one bar that is always on screen.
 *
 * Everything here had to earn its place by answering "does the player need this
 * during 100% of play?". Four things did: when it is, how fast time is running,
 * how big the world has become, and whether anyone is at war. Everything the old
 * top bar and time cockpit carried besides — the brand block, nine speed steps,
 * three simulation-stepping buttons, the era chip's full name — moved into the
 * tool dock, a tooltip, or out entirely.
 *
 * It reads a snapshot, never the simulation. See `core/WorldSnapshot.ts`.
 */
import { el } from '../core/Dom';
import { icon, setIcon, withTooltip, formatCompact, formatFull } from '../kit';
import { WorldEra } from '../../world/WeatherEras';
import { sound } from '../../core/SoundSynth';
import type { WorldSnapshot } from '../core/WorldSnapshot';
import type { GameContext } from '../core/GameContext';

/**
 * The speed ladder, cut from nine steps to five.
 *
 * Nine was a settings screen pretending to be a control: nobody distinguishes
 * 0.25× from 0.5× at a glance, and every extra button made the active one harder
 * to find. These five are the ones with distinct intent — stopped, watching,
 * moving, skipping, and fast-forwarding through a quiet century.
 */
const SPEEDS: { value: number; label: string; icon?: string; shortcut: string; description: string }[] = [
  { value: 0,  label: 'Pausado', icon: 'pause', shortcut: 'Espaço', description: 'O mundo congela. A câmera continua livre.' },
  { value: 1,  label: '1×',  shortcut: '1', description: 'Velocidade calibrada — 1 segundo real vale 1 hora no mundo.' },
  { value: 2,  label: '2×',  shortcut: '2', description: 'Duas horas por segundo.' },
  { value: 5,  label: '5×',  shortcut: '3', description: 'Cinco horas por segundo.' },
  { value: 10, label: '10×', shortcut: '4', description: 'Dez horas por segundo.' },
  { value: 20, label: '20×', shortcut: '5', description: 'Vinte horas por segundo.' },
  { value: 30, label: '30×', shortcut: '6', description: 'Trinta horas por segundo. Velocidade hiper-acelerada!' },
  { value: 60, label: '60×', shortcut: '7', description: 'Sessenta horas por segundo (60×). Velocidade ultra-acelerada!' },
  { value: 80, label: '80×', shortcut: '8', description: 'Oitenta horas por segundo (80×). Velocidade hiper-sônica!' }
];

const ERA_STYLE: Record<string, { color: string; icon: string }> = {
  [WorldEra.GOLDEN_AGE]: { color: '#c9a153', icon: 'sun' },
  [WorldEra.ABUNDANCE]: { color: '#8fb069', icon: 'farm' },
  [WorldEra.AGE_OF_ASHES]: { color: '#d98324', icon: 'fire' },
  [WorldEra.DARK_AGE]: { color: '#9b7fa8', icon: 'moon' },
  [WorldEra.FROZEN_AGE]: { color: '#7fa8b8', icon: 'snow' }
};

/** A world-status reading. Four, and the fourth only when it is non-zero. */
interface StatSlot {
  key: 'population' | 'cities' | 'kingdoms' | 'activeWars';
  icon: string;
  label: string;
  description: string;
}

const STATS: StatSlot[] = [
  { key: 'population', icon: 'population', label: 'População', description: 'Todos os seres simulados, incluindo fauna selvagem.' },
  { key: 'cities', icon: 'city', label: 'Cidades', description: 'Assentamentos fundados e ainda habitados.' },
  { key: 'kingdoms', icon: 'kingdom', label: 'Reinos', description: 'Estados soberanos. Reinos conquistados deixam de contar.' },
  { key: 'activeWars', icon: 'war', label: 'Guerras', description: 'Conflitos em curso neste momento.' }
];

export class TopBar {
  public readonly root: HTMLElement;

  private ctx: GameContext;
  private dateEl!: HTMLElement;
  private clockEl!: HTMLElement;
  private eraIconEl!: HTMLImageElement;
  private eraNode!: HTMLElement;
  private speedButtons = new Map<number, HTMLButtonElement>();
  private statValues = new Map<StatSlot['key'], HTMLElement>();
  private statNodes = new Map<StatSlot['key'], HTMLElement>();
  /** Last values written, so a frame that changed nothing touches no DOM. */
  private lastWritten: Partial<Record<string, string>> = {};
  private lastSpeed = -1;
  private lastEra = '';

  constructor(ctx: GameContext, onOpenMenu: () => void) {
    this.ctx = ctx;
    this.root = el('header', { class: 'ae-topbar' }, [
      this.buildTime(),
      this.buildSpeed(),
      this.buildStatus(),
      this.buildTrailing(onOpenMenu)
    ]);
    this.sync(ctx.snapshot);
  }

  // ============================ BUILD ============================

  private buildTime(): HTMLElement {
    this.dateEl = el('span', { class: 'ae-topbar-date', text: 'Ano 1' });
    this.clockEl = el('span', { class: 'ae-topbar-clock', text: '00:00' });

    return withTooltip(
      el('div', {
        class: 'ae-topbar-time',
        style: 'cursor: pointer;',
        on: {
          click: () => {
            sound.playClick();
            this.ctx.screens.open('timeskip');
          }
        }
      }, [
        icon('year', { size: 16, class: 'ae-topbar-time-icon' }),
        el('div', { class: 'ae-topbar-time-text' }, [this.dateEl, this.clockEl])
      ]),
      () => {
        const s = this.ctx.snapshot;
        return {
          title: `Ano ${s.year}`,
          icon: 'year',
          description: 'Data e hora do mundo, segundo o calendário da simulação.',
          footnote: 'Clique para abrir o Salto Temporal Divino',
          shortcut: '0',
          rows: [
            { label: 'Mês', value: `${s.month}` },
            { label: 'Dia', value: `${s.day}` },
            { label: 'Hora', value: `${s.timeString} · ${s.periodLabel}` }
          ]
        };
      }
    );
  }

  private buildSpeed(): HTMLElement {
    const buttons = SPEEDS.map(speed => {
      const btn = withTooltip(
        el('button', {
          class: 'ae-speed-btn',
          attrs: { type: 'button', 'aria-label': speed.label },
          on: { click: () => { sound.playClick(); this.ctx.setSpeed(speed.value); } }
        }, [
          speed.icon
            ? icon(speed.icon, { size: 16 })
            : el('span', { class: 'ae-speed-label', text: speed.label })
        ]),
        { title: speed.label, description: speed.description, shortcut: speed.shortcut }
      ) as HTMLButtonElement;
      this.speedButtons.set(speed.value, btn);
      return btn;
    });

    const timeSkipBtn = withTooltip(
      el('button', {
        class: 'ae-speed-btn ae-speed-timeskip',
        attrs: { type: 'button', 'aria-label': 'Salto Temporal' },
        on: {
          click: () => {
            sound.playClick();
            this.ctx.screens.open('timeskip');
          }
        }
      }, [
        icon('calendar', { size: 16 })
      ]),
      {
        title: 'Salto Temporal Divino',
        description: 'Avança anos e séculos rapidamente no mundo com simulação contínua e fidelidade total.',
        shortcut: '0'
      }
    );

    return el('div', { class: 'ae-speed', attrs: { role: 'group', 'aria-label': 'Velocidade' } }, [...buttons, timeSkipBtn]);
  }

  private buildStatus(): HTMLElement {
    return el('div', { class: 'ae-world-status' }, STATS.map(slot => {
      const value = el('span', { class: 'ae-world-stat-value', text: '0' });
      this.statValues.set(slot.key, value);

      const node = withTooltip(
        el('div', { class: `ae-world-stat ae-world-stat-${slot.key}` }, [
          icon(slot.icon, { size: 16, class: 'ae-world-stat-icon' }),
          value
        ]),
        () => {
          const s = this.ctx.snapshot;
          const raw = s[slot.key];
          return {
            title: slot.label,
            value: formatFull(raw),
            icon: slot.icon,
            description: slot.description,
            valueStatus: slot.key === 'activeWars' ? (raw > 0 ? 'critical' : 'positive') : undefined,
            rows: slot.key === 'cities' && (s.citiesInFamine > 0 || s.citiesBesieged > 0)
              ? [
                  ...(s.citiesInFamine > 0 ? [{ label: 'Com fome', value: `${s.citiesInFamine}`, status: 'warning' as const }] : []),
                  ...(s.citiesBesieged > 0 ? [{ label: 'Sitiadas', value: `${s.citiesBesieged}`, status: 'critical' as const }] : [])
                ]
              : undefined
          };
        }
      );
      this.statNodes.set(slot.key, node);
      return node;
    }));
  }

  private buildTrailing(onOpenMenu: () => void): HTMLElement {
    this.eraIconEl = icon('sun', { size: 16 });
    this.eraNode = withTooltip(
      el('button', {
        class: 'ae-era-chip',
        attrs: { type: 'button', 'aria-label': 'Era climática' },
        on: { click: () => { sound.playClick(); this.ctx.eras.cycleNextEra(); } }
      }, [this.eraIconEl]),
      () => {
        const era = this.ctx.eras.getCurrentEra();
        return {
          title: era,
          icon: ERA_STYLE[era]?.icon ?? 'sun',
          accent: ERA_STYLE[era]?.color,
          description: 'A era climática vigente. Altera colheitas, doenças e a velocidade com que os reinos crescem.',
          footnote: 'Clique para avançar a era'
        };
      }
    );

    const menuBtn = withTooltip(
      el('button', {
        class: 'ae-topbar-menu',
        attrs: { type: 'button', 'aria-label': 'Menu' },
        on: { click: () => { sound.playClick(); onOpenMenu(); } }
      }, [icon('menu', { size: 16 })]),
      { title: 'Menu', description: 'Pausa, ajustes, salvar e sair.', shortcut: 'Esc' }
    );

    return el('div', { class: 'ae-topbar-trailing' }, [this.eraNode, menuBtn]);
  }

  // ============================ UPDATE ============================

  /**
   * Writes the snapshot into the bar.
   *
   * Every write is guarded by a comparison against what is already there. This
   * runs once a frame, and assigning `textContent` unconditionally would dirty
   * layout sixty times a second for a year counter that changes every few
   * seconds.
   */
  public sync(s: WorldSnapshot): void {
    this.write('date', `Ano ${s.year} · ${s.month}/${s.day}`, this.dateEl);
    this.write('clock', `${s.timeString}`, this.clockEl);

    for (const slot of STATS) {
      const raw = s[slot.key];
      this.write(slot.key, formatCompact(raw), this.statValues.get(slot.key)!);
      if (slot.key === 'activeWars') {
        // War is the one status that changes appearance, not just its number:
        // "0 wars" and "3 wars" should not look the same at a glance.
        this.statNodes.get(slot.key)!.classList.toggle('ae-world-stat-alarm', raw > 0);
      }
    }
    this.statNodes.get('cities')!.classList.toggle(
      'ae-world-stat-warn',
      s.citiesInFamine > 0 || s.citiesBesieged > 0
    );

    if (this.ctx.simSpeed !== this.lastSpeed) {
      this.lastSpeed = this.ctx.simSpeed;
      for (const [value, btn] of this.speedButtons) {
        btn.classList.toggle('ae-speed-active', value === this.lastSpeed);
      }
      this.root.classList.toggle('ae-topbar-paused', this.lastSpeed === 0);
    }

    const era = this.ctx.eras.getCurrentEra();
    if (era !== this.lastEra) {
      this.lastEra = era;
      const style = ERA_STYLE[era] ?? { color: 'var(--ae-accent)', icon: 'sun' };
      setIcon(this.eraIconEl, style.icon);
      this.eraNode.style.setProperty('--ae-realm', style.color);
    }
  }

  private write(key: string, value: string, node: HTMLElement): void {
    if (this.lastWritten[key] === value) return;
    this.lastWritten[key] = value;
    node.textContent = value;
  }
}
