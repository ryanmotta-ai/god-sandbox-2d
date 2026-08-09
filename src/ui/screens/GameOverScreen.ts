import { el, button, formatNumber } from '../core/Dom';
import { chronicle } from '../../civ/Chronicle';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

export interface GameOverParams {
  reason: 'extinction' | 'silence';
}

/**
 * Shown when every civilised species has died out. The world keeps running
 * behind the overlay — the player can dismiss it and keep playing god.
 */
export class GameOverScreen implements Screen {
  public readonly id = 'gameover' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  public build(ctx: GameContext, params: GameOverParams = { reason: 'extinction' }): HTMLElement {
    const finalYear = ctx.sim.currentYear;
    const notableEvents = chronicle.getEvents().slice(0, 5);

    const title = params.reason === 'extinction' ? 'A Última Civilização Cai' : 'Silêncio';
    const subtitle =
      params.reason === 'extinction'
        ? `Após ${finalYear} anos, nenhum ser civilizado permanece em Aethoria.`
        : `Não resta nada vivo em Aethoria após ${finalYear} anos.`;

    return el('div', { class: 'gameover-screen' }, [
      el('div', { class: 'gameover-card' }, [
        el('div', { class: 'gameover-mark', text: '☠️' }),
        el('h2', { class: 'gameover-title', text: title }),
        el('p', { class: 'gameover-sub', text: subtitle }),

        el('div', { class: 'stat-grid cols-4' }, [
          this.tile('📅', 'Anos passados', `${finalYear}`),
          this.tile('👑', 'Pico de reinos', `${ctx.stats.peakKingdoms}`),
          this.tile('👥', 'Pico de população', formatNumber(ctx.stats.peakPopulation)),
          this.tile('⚔️', 'Guerras travadas', `${ctx.sim.diplomacy.warHistory.length + ctx.sim.diplomacy.activeWars.size}`),
          this.tile('👶', 'Total de nascimentos', formatNumber(ctx.sim.totalBirths)),
          this.tile('💀', 'Total de mortes', formatNumber(ctx.sim.totalDeaths)),
          this.tile('🏛️', 'Cidades fundadas', `${ctx.sim.cities.size}`),
          this.tile('🌍', 'Semente do mundo', `${ctx.worldConfig.seed}`)
        ]),

        notableEvents.length
          ? el('section', { class: 'panel' }, [
              el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Últimos registros da crônica' })]),
              el('div', { class: 'panel-body' }, [
                el('div', { class: 'history-list' }, notableEvents.map(event =>
                  el('div', { class: 'history-row' }, [
                    el('span', { class: 'history-years', text: `Ano ${event.year}` }),
                    el('span', { class: 'history-text', text: event.text })
                  ])
                ))
              ])
            ])
          : null,

        el('div', { class: 'gameover-actions' }, [
          button('Continuar jogando', () => ctx.screens.closeAll(), { icon: '👁️', title: 'Permanecer neste mundo morto' }),
          button('Ver estatísticas', () => ctx.screens.open('stats'), { icon: '📊' }),
          button('Recriar este mundo', () => {
            ctx.startNewWorld({ ...ctx.worldConfig, seed: Math.floor(Math.random() * 2147483647) });
          }, { variant: 'primary', icon: '🌱' }),
          button('Menu principal', () => ctx.quitToMenu(), { variant: 'danger', icon: '⏏️' })
        ])
      ].filter(Boolean) as HTMLElement[])
    ]);
  }

  private tile(icon: string, label: string, value: string): HTMLElement {
    return el('div', { class: 'stat-tile' }, [
      el('span', { class: 'tile-icon', text: icon }),
      el('span', { class: 'tile-value', text: value }),
      el('span', { class: 'tile-label', text: label })
    ]);
  }
}
