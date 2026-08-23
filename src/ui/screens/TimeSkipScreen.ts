/**
 * TimeSkipScreen — Salto Temporal Divino
 *
 * Permite avançar anos e séculos rapidamente no mundo, executando a simulação
 * completa em lotes assíncronos via requestAnimationFrame, garantindo que a
 * interface continue fluida, o progresso seja visualizado em tempo real e todas
 * as invariantes, economias, nascimentos e guerras sejam simuladas com perfeição.
 */
import { el } from '../core/Dom';
import { screenShell, panel, stat, statGrid, button, progressBar } from '../kit';
import { sound } from '../../core/SoundSynth';
import { TICKS_PER_YEAR } from '../../ai/EntityAI';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

const QUICK_PRESETS = [1, 5, 10, 25, 50];
const TICKS_PER_BATCH = 1440; // 1/5 de ano por lote para garantir feedback visual fluido a 60 FPS

export class TimeSkipScreen implements Screen {
  public readonly id = 'timeskip' as const;
  public readonly kind = 'overlay' as const;
  public dismissable = true;

  private ctx!: GameContext;
  private shell!: ReturnType<typeof screenShell>;
  private yearsToSkip = 5;
  private isRunning = false;
  private cancelRequested = false;
  private previousSimSpeed = 1;

  public build(ctx: GameContext): HTMLElement {
    this.ctx = ctx;
    this.isRunning = false;
    this.cancelRequested = false;
    this.dismissable = true;

    this.shell = screenShell({
      title: 'Salto Temporal Divino',
      subtitle: 'Acelere a passagem dos anos e séculos mantendo toda a fidelidade da simulação viva.',
      icon: 'calendar',
      onClose: () => {
        if (this.isRunning) {
          this.cancelRequested = true;
        } else {
          ctx.screens.back();
        }
      },
      width: 'narrow'
    });

    this.renderForm();
    return this.shell.root;
  }

  private renderForm(): void {
    const currentYear = this.ctx.sim.currentYear;
    const targetYear = currentYear + this.yearsToSkip;
    const totalTicks = this.yearsToSkip * TICKS_PER_YEAR;

    // Presets rápidos
    const presetButtons = el('div', {
      style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: var(--ae-space-2); margin-bottom: var(--ae-space-3);'
    }, QUICK_PRESETS.map(years => {
      const isSelected = this.yearsToSkip === years;
      return button(`+${years} Anos`, () => {
        sound.playClick();
        this.yearsToSkip = years;
        this.renderForm();
      }, {
        variant: isSelected ? 'primary' : 'secondary',
        size: 'sm'
      });
    }));

    // Slider customizado
    const sliderInput = el('input', {
      attrs: {
        type: 'range',
        min: '1',
        max: '100',
        value: String(this.yearsToSkip),
        style: 'flex: 1; cursor: pointer;'
      },
      on: {
        input: (e: Event) => {
          const val = parseInt((e.target as HTMLInputElement).value, 10);
          if (val > 0) {
            this.yearsToSkip = val;
            this.renderForm();
          }
        }
      }
    });

    const numberInput = el('input', {
      attrs: {
        type: 'number',
        min: '1',
        max: '500',
        value: String(this.yearsToSkip),
        style: 'width: 72px; padding: var(--ae-space-1) var(--ae-space-2); border: 1px solid var(--ae-border); border-radius: var(--ae-radius-1); background: var(--ae-panel-sunken); color: var(--ae-text); font-weight: 700; text-align: center;'
      },
      on: {
        change: (e: Event) => {
          let val = parseInt((e.target as HTMLInputElement).value, 10);
          if (isNaN(val) || val < 1) val = 1;
          if (val > 500) val = 500;
          this.yearsToSkip = val;
          this.renderForm();
        }
      }
    });

    const customRow = el('div', {
      style: 'display: flex; align-items: center; gap: var(--ae-space-3); margin-top: var(--ae-space-2);'
    }, [sliderInput, numberInput, el('span', { class: 'ae-text-meta', text: 'anos' })]);

    // Projeção do tempo
    const projectionGrid = statGrid([
      stat({ label: 'Ano Atual', value: `Ano ${currentYear}`, icon: 'calendar' }),
      stat({ label: 'Ano Destino', value: `Ano ${targetYear}`, icon: 'forward', status: 'positive' }),
      stat({ label: 'Ticks Totais', value: totalTicks.toLocaleString('pt-BR'), icon: 'gear' }),
      stat({ label: 'População Atual', value: this.ctx.sim.entities.length.toLocaleString('pt-BR'), icon: 'population' })
    ]);

    const content = [
      panel({
        title: 'Selecione a Duração do Salto',
        subtitle: 'Escolha quantos anos o mundo deve avançar.',
        icon: 'year'
      }, [
        presetButtons,
        customRow
      ]),

      panel({
        title: 'Projeção Temporal',
        icon: 'chart'
      }, [
        projectionGrid
      ]),

      el('div', {
        style: 'display: flex; gap: var(--ae-space-3); justify-content: flex-end; margin-top: var(--ae-space-2);'
      }, [
        button('Cancelar', () => {
          sound.playClick();
          this.ctx.screens.back();
        }, { variant: 'ghost' }),
        button(`Iniciar Salto (+${this.yearsToSkip} ${this.yearsToSkip === 1 ? 'Ano' : 'Anos'})`, () => {
          sound.playMagic();
          this.startSkip();
        }, { variant: 'primary', icon: 'forward' })
      ])
    ];

    this.shell.setContent(content);
  }

  private startSkip(): void {
    this.isRunning = true;
    this.cancelRequested = false;
    this.dismissable = false;
    this.previousSimSpeed = this.ctx.simSpeed;
    this.ctx.setSpeed(0); // Pausa a simulação normal enquanto roda em batch

    const startYear = this.ctx.sim.currentYear;
    const targetYear = startYear + this.yearsToSkip;
    const totalTicks = this.yearsToSkip * TICKS_PER_YEAR;
    let ticksExecuted = 0;
    let lastYearSeen = startYear;

    const renderProgress = () => {
      const currentYear = this.ctx.sim.currentYear;
      const progressRatio = Math.min(1, ticksExecuted / totalTicks);
      const percent = Math.floor(progressRatio * 100);

      const progressSection = panel({
        title: 'Salto Temporal em Andamento...',
        subtitle: `Avançando eras do mundo · Ano ${currentYear} de ${targetYear}`,
        icon: 'calendar',
        variant: 'raised'
      }, [
        progressBar({
          value: progressRatio,
          status: 'positive',
          label: `Progresso: ${percent}% (${ticksExecuted.toLocaleString('pt-BR')} / ${totalTicks.toLocaleString('pt-BR')} ticks)`
        }),
        statGrid([
          stat({ label: 'Ano Atual', value: `Ano ${currentYear}`, icon: 'calendar', status: 'positive' }),
          stat({ label: 'Alvo', value: `Ano ${targetYear}`, icon: 'forward' }),
          stat({ label: 'População', value: this.ctx.sim.entities.length.toLocaleString('pt-BR'), icon: 'population' }),
          stat({ label: 'Cidades', value: `${this.ctx.sim.cities.size}`, icon: 'city' }),
          stat({ label: 'Reinos', value: `${this.ctx.sim.kingdoms.size}`, icon: 'kingdom' }),
          stat({
            label: 'Guerras',
            value: `${this.ctx.sim.diplomacy.activeWars.size}`,
            icon: 'war',
            status: this.ctx.sim.diplomacy.activeWars.size > 0 ? 'warning' : 'neutral'
          })
        ]),
        el('div', {
          style: 'display: flex; justify-content: center; margin-top: var(--ae-space-4);'
        }, [
          button('Interromper Salto', () => {
            sound.playClick();
            this.cancelRequested = true;
          }, { variant: 'danger', icon: 'pause' })
        ])
      ]);

      this.shell.setContent([progressSection]);
    };

    const runBatch = () => {
      if (this.cancelRequested || ticksExecuted >= totalTicks) {
        this.finishSkip(startYear, this.ctx.sim.currentYear);
        return;
      }

      const batchLimit = Math.min(TICKS_PER_BATCH, totalTicks - ticksExecuted);
      const relevanceContext = {
        centerX: this.ctx.camera.x / this.ctx.camera.tileSize,
        centerY: this.ctx.camera.y / this.ctx.camera.tileSize,
        hotRadius: 48,
        warmRadius: 96,
        selectedEntityIds: new Set<string>(),
        trackedEntityId: null
      };

      for (let i = 0; i < batchLimit; i++) {
        ticksExecuted++;
        this.ctx.sim.tickAI(this.ctx.tileMap, this.ctx.particles, relevanceContext);

        if (ticksExecuted % 2 === 0) {
          this.ctx.tileMap.updateFireTick();
          this.ctx.tileMap.updateFluidTick();
        }

        if (this.ctx.sim.currentYear !== lastYearSeen) {
          lastYearSeen = this.ctx.sim.currentYear;
          this.ctx.eras.tickYear(this.ctx.sim.currentYear);
        }
      }

      renderProgress();
      requestAnimationFrame(runBatch);
    };

    renderProgress();
    requestAnimationFrame(runBatch);
  }

  private finishSkip(startYear: number, endYear: number): void {
    this.isRunning = false;
    this.dismissable = true;
    const skipped = endYear - startYear;

    sound.playMagic();
    this.ctx.refreshSnapshot(performance.now());
    this.ctx.setSpeed(this.previousSimSpeed > 0 ? this.previousSimSpeed : 1);
    this.ctx.toast(
      this.cancelRequested
        ? `Salto temporal interrompido no Ano ${endYear} (+${skipped} anos).`
        : `Salto temporal de +${skipped} anos concluído com sucesso! (Ano ${endYear})`,
      'info'
    );

    this.ctx.screens.back();
  }
}
