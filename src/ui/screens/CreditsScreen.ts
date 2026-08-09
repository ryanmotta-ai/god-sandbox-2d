import { el, button } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

const SYSTEMS = [
  { icon: '🌍', name: 'Geração de Mundo', detail: 'Mapas de altura com ruído Simplex, máscaras radiais de continente, atribuição de bioma orientada pelo clima.' },
  { icon: '🧠', name: 'IA de Entidades', detail: 'Uma máquina de estados por criatura cobrindo forrageamento, construção, caça em bando, combate e fuga.' },
  { icon: '🏛️', name: 'Civilização', detail: 'Fundação autônoma de cidades, crescimento de território, estoques de recursos e formação de reinos.' },
  { icon: '🤝', name: 'Diplomacy', detail: 'Pontuações de relacionamento, declarações de guerra, tratados de paz, alianças e crônicas de guerra.' },
  { icon: '🎨', name: 'Renderizador de Pixels', detail: 'Sprites de 16x16 desenhados proceduralmente e gerados em tempo de execução — nenhum recurso de imagem é fornecido com o jogo.' },
  { icon: '🔊', name: 'Síntese de Som', detail: 'Cada efeito sonoro é gerado ao vivo através da Web Audio API.' },
  { icon: '💾', name: 'Persistência', detail: 'Serialização completa do mundo para slots do localStorage ou arquivos JSON portáteis.' },
  { icon: '🖥️', name: 'Interface', detail: 'Uma camada de UI roteadora de telas com HUD ao vivo, códex, análises e navegador de mundo.' }
];

export class CreditsScreen implements Screen {
  public readonly id = 'credits' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  public build(ctx: GameContext): HTMLElement {
    return el('div', { class: 'screen-panel narrow' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '🏅 Créditos' }),
          el('p', { class: 'screen-sub', text: 'Aethoria — Sandbox Divino 2D' })
        ]),
        button('Fechar', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
      ]),

      el('div', { class: 'credits-body' }, [
        el('div', { class: 'credits-hero' }, [
          el('div', { class: 'credits-mark', text: '✦' }),
          el('h1', { class: 'credits-title', text: 'AETHORIA' }),
          el('p', { class: 'credits-sub', text: 'Um mundo que funciona sem você — e é mais interessante quando você interfere.' })
        ]),

        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Sistemas do Motor' })]),
          el('div', { class: 'panel-body' }, [
            el('div', { class: 'credits-grid' }, SYSTEMS.map(system =>
              el('div', { class: 'credit-card' }, [
                el('span', { class: 'credit-icon', text: system.icon }),
                el('div', {}, [
                  el('h4', { class: 'credit-name', text: system.name }),
                  el('p', { class: 'credit-detail', text: system.detail })
                ])
              ])
            ))
          ])
        ]),

        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Construído Com' })]),
          el('div', { class: 'panel-body' }, [
            el('div', { class: 'chip-row' }, [
              el('span', { class: 'chip', text: 'TypeScript' }),
              el('span', { class: 'chip', text: 'Vite' }),
              el('span', { class: 'chip', text: 'Canvas 2D' }),
              el('span', { class: 'chip', text: 'Web Audio API' }),
              el('span', { class: 'chip', text: 'Zero dependências em tempo de execução' })
            ]),
            el('p', { class: 'muted small', text: 'Fontes: Outfit e Silkscreen, servidas pelo Google Fonts.' })
          ])
        ])
      ])
    ]);
  }
}
