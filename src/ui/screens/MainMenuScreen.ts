import { el, button } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

const TAGLINES = [
  'Esculpa a terra. Semeie a vida. Testemunhe a evolução dos reinos.',
  'Todo império erguer-se-á e um dia cairá.',
  'Os deuses observam em silêncio. Exceto quando decidem intervir.',
  'O mundo simula sua história. Você apenas segura o pincel da criação.',
  'O fogo do conflito espalha-se mais rápido que a diplomacia.'
];

/** Title screen. The live world rendering behind it is driven by main.ts. */
export class MainMenuScreen implements Screen {
  public readonly id = 'main-menu' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = false;

  public build(ctx: GameContext): HTMLElement {
    const tagline = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];

    return el('div', { class: 'menu-screen' }, [
      el('div', { class: 'menu-vignette' }),

      el('div', { class: 'menu-inner' }, [
        el('div', { class: 'menu-hero' }, [
          el('div', { class: 'menu-mark', text: '✦' }),
          el('h1', { class: 'menu-title', text: 'AETHORIA' }),
          el('p', { class: 'menu-subtitle', text: 'SANDBOX DIVINO 2D' }),
          el('p', { class: 'menu-tagline', text: tagline })
        ]),

        // Three ways in, each marked with the game's own pixel art rather than a
        // system emoji. The screens dropped from here (bestiary, help, credits)
        // are still registered and still reachable in game.
        el('nav', { class: 'menu-nav' }, [
          button('Novo Mundo', () => ctx.screens.open('world-setup'), {
            variant: 'menu', pixelIcon: 'world', class: 'menu-primary', hint: 'N'
          }),
          button('Carregar Mundo', () => ctx.screens.open('saveload', { fromMenu: true }), {
            variant: 'menu', pixelIcon: 'save'
          }),
          button('Configurações', () => ctx.screens.open('settings'), {
            variant: 'menu', pixelIcon: 'gear'
          })
        ]),

        el('footer', { class: 'menu-footer' }, [
          el('span', { class: 'menu-version', text: 'v1.0.0 · Motor de Simulação 2D' })
        ])
      ])
    ]);
  }
}
