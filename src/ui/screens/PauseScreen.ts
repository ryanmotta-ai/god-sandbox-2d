import { el, button, formatNumber } from '../core/Dom';
import { WORLD_PRESET_INFO } from '../core/GameContext';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

/** ESC menu. Overlays the paused world rather than replacing it. */
export class PauseScreen implements Screen {
  public readonly id = 'pause' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  public build(ctx: GameContext): HTMLElement {
    const preset = WORLD_PRESET_INFO.find(p => p.id === ctx.worldConfig.preset);

    const summary = el('div', { class: 'pause-summary' }, [
      this.summaryItem('📅', 'Ano', `${ctx.sim.currentYear}`),
      this.summaryItem('👥', 'População', formatNumber(ctx.sim.entities.length)),
      this.summaryItem('🏛️', 'Cidades', `${ctx.sim.cities.size}`),
      this.summaryItem('👑', 'Reinos', `${ctx.sim.kingdoms.size}`),
      this.summaryItem('⚔️', 'Guerras Ativas', `${ctx.sim.diplomacy.activeWars.size}`),
      this.summaryItem('🗺️', 'Mundo', `${preset?.name ?? 'Desconhecido'} · ${ctx.worldConfig.size}²`)
    ]);

    return el('div', { class: 'pause-screen' }, [
      el('div', { class: 'pause-card' }, [
        el('header', { class: 'pause-head' }, [
          el('h2', { class: 'pause-title', text: 'Jogo Pausado' }),
          el('p', { class: 'pause-sub', text: `Semente ${ctx.worldConfig.seed} · ${ctx.eras.getCurrentEra()}` })
        ]),

        summary,

        el('div', { class: 'pause-actions' }, [
          button('Continuar Jogando', () => ctx.screens.closeAll(), { variant: 'primary', icon: '▶️', class: 'wide', hint: 'Esc' }),
          el('div', { class: 'pause-grid' }, [
            button('Crônica', () => ctx.screens.open('chronicle'), { icon: '📜' }),
            button('Reinos', () => ctx.screens.open('kingdoms'), { icon: '👑' }),
            button('Diplomacia', () => ctx.screens.open('diplomacy'), { icon: '🤝' }),
            button('Estatísticas', () => ctx.screens.open('stats'), { icon: '📊' }),
            button('Bestiário', () => ctx.screens.open('bestiary'), { icon: '📖' }),
            button('Salvar & Carregar', () => ctx.screens.open('saveload'), { icon: '💾' }),
            button('Configurações', () => ctx.screens.open('settings'), { icon: '⚙️' }),
            button('Como Jogar', () => ctx.screens.open('help'), { icon: '❓' })
          ]),
          button('Sair para o Menu Principal', () => {
            if (confirm('Deseja retornar ao menu principal? O progresso não salvo neste mundo será perdido.')) {
              ctx.quitToMenu();
            }
          }, { variant: 'danger', icon: '⏏️', class: 'wide' })
        ])
      ])
    ]);
  }

  private summaryItem(icon: string, label: string, value: string): HTMLElement {
    return el('div', { class: 'summary-item' }, [
      el('span', { class: 'summary-icon', text: icon }),
      el('span', { class: 'summary-value', text: value }),
      el('span', { class: 'summary-label', text: label })
    ]);
  }
}
