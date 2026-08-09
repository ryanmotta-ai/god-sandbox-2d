import { el, button } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

interface KeyBinding {
  keys: string[];
  action: string;
}

const CAMERA_KEYS: KeyBinding[] = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Mover a câmera pelo mundo' },
  { keys: ['↑', '←', '↓', '→'], action: 'Mover a câmera (setas)' },
  { keys: ['Shift', '+', 'WASD'], action: 'Mover câmera com velocidade Turbo (2.5×)' },
  { keys: ['+', '/', '-'], action: 'Aproximar / Afastar Zoom' },
  { keys: ['PgUp', '/', 'PgDn'], action: 'Zoom rápido via teclado' },
  { keys: ['Scroll'], action: 'Zoom na direção do cursor' },
  { keys: ['Botão Direito'], action: 'Arrastar o mundo' },
  { keys: ['Home', '/', 'R', '/', '0'], action: 'Recentrar câmera no meio do mapa' }
];

const SIM_KEYS: KeyBinding[] = [
  { keys: ['Espaço'], action: 'Pausar / retomar a simulação' },
  { keys: ['1', '–', '6'], action: 'Definir velocidade (1×, 2×, 5×, 10×, 20×, 30×)' },
  { keys: [','], action: 'Diminuir velocidade da simulação' },
  { keys: ['.'], action: 'Aumentar velocidade da simulação' }
];

const TOOL_KEYS: KeyBinding[] = [
  { keys: ['Shift', '+', '1..7'], action: 'Trocar categoria de poder' },
  { keys: ['['], action: 'Reduzir tamanho do pincel' },
  { keys: [']'], action: 'Aumentar tamanho do pincel' },
  { keys: ['F'], action: 'Focar busca de poderes' },
  { keys: ['X', '/', 'Del'], action: 'Limpar ferramenta ou seleção' },
  { keys: ['V'], action: 'Alternar sobreposição do mapa' },
  { keys: ['Alt', '+', '1..6'], action: 'Sobreposição direta (Guerra, Recursos...)' },
  { keys: ['Shift+G', '/', 'O'], action: 'Alternar grade de terrenos' }
];

const SCREEN_KEYS: KeyBinding[] = [
  { keys: ['Esc'], action: 'Menu de pausa / fechar tela' },
  { keys: ['C'], action: 'Crônica (História)' },
  { keys: ['K'], action: 'Reinos' },
  { keys: ['L', '/', 'Y'], action: 'Diplomacia' },
  { keys: ['G'], action: 'Estatísticas' },
  { keys: ['B'], action: 'Bestiário' },
  { keys: ['N'], action: 'Infraestrutura' },
  { keys: ['P'], action: 'Política' },
  { keys: ['E'], action: 'Economia' },
  { keys: ['U'], action: 'Guerra' },
  { keys: ['T'], action: 'Ciência / Tecnologias' },
  { keys: ['M'], action: 'Alternar minimapa' },
  { keys: ['I'], action: 'Dossiê do alvo selecionado' },
  { keys: ['Tab'], action: 'Modo Cinematográfico (Ocultar UI)' },
  { keys: ['F1'], action: 'Tela de ajuda e atalhos' },
  { keys: ['F3'], action: 'Painel de depuração' },
  { keys: ['F5'], action: 'Salvar e carregar jogo' }
];

const BASICS = [
  { icon: '🖱️', title: 'Clique esquerdo pinta', text: 'O poder selecionado é aplicado onde você clicar ou arrastar no mundo.' },
  { icon: '🔍', title: 'Inspecione qualquer coisa', text: 'Escolha a ferramenta Inspecionar (categoria 7) e clique em uma criatura, cidade ou bloco para abrir seu dossiê.' },
  { icon: '🌱', title: 'Civilização é automática', text: 'Gere alguns humanoides em terras férteis — eles irão coletar, construir, fundar cidades e eventualmente coroar reis por conta própria.' },
  { icon: '⚔️', title: 'Guerras começam sozinhas', text: 'Reinos de espécies diferentes tendem à hostilidade. Você pode acelerar ou prevenir isso na tela de Diplomacia.' },
  { icon: '💥', title: 'Consequências persistem', text: 'O fogo se espalha por florestas, a água inunda terrenos baixos e terrenos arrasados permanecem arrasados. Não existe desfazer aqui.' },
  { icon: '📜', title: 'A história se registra sozinha', text: 'Cada fundação, coroação e guerra é escrita na Crônica assim que acontece.' }
];

/** Controls reference and getting-started guide. */
export class HelpScreen implements Screen {
  public readonly id = 'help' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  public build(ctx: GameContext): HTMLElement {
    return el('div', { class: 'screen-panel' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '❓ Como Jogar' }),
          el('p', { class: 'screen-sub', text: 'Aethoria funciona sozinha. Você é um sistema climático com opiniões.' })
        ]),
        button('Fechar', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
      ]),

      el('div', { class: 'help-body' }, [
        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'O Básico' })]),
          el('div', { class: 'panel-body' }, [
            el('div', { class: 'basics-grid' }, BASICS.map(b =>
              el('div', { class: 'basic-card' }, [
                el('span', { class: 'basic-icon', text: b.icon }),
                el('h4', { class: 'basic-title', text: b.title }),
                el('p', { class: 'basic-text', text: b.text })
              ])
            ))
          ])
        ]),

        el('div', { class: 'keys-columns' }, [
          this.keyPanel('Câmera', CAMERA_KEYS),
          this.keyPanel('Tempo', SIM_KEYS),
          this.keyPanel('Ferramentas', TOOL_KEYS),
          this.keyPanel('Telas', SCREEN_KEYS)
        ]),

        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [
            el('h3', { class: 'panel-title', text: 'Um Primeiro Mundo Sugerido' })
          ]),
          el('div', { class: 'panel-body' }, [
            el('ol', { class: 'steps' }, [
              el('li', { text: 'Crie um mundo com Continente Único com Lumini e Sylvanii.' }),
              el('li', { text: 'Coloque a velocidade em 2× e deixe dez ou vinte anos passarem — cidades aparecerão.' }),
              el('li', { text: 'Abra a tela de Reinos quando as bandeiras começarem a aparecer no mapa.' }),
              el('li', { text: 'Pinte uma Floresta Densa entre os dois reinos, então coloque fogo nela e veja como eles reagem.' }),
              el('li', { text: 'Abra a Crônica para ler o que a sua interferência realmente causou.' })
            ])
          ])
        ])
      ])
    ]);
  }

  private keyPanel(title: string, bindings: KeyBinding[]): HTMLElement {
    return el('section', { class: 'panel' }, [
      el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: title })]),
      el('div', { class: 'panel-body' }, [
        el('div', { class: 'key-list' }, bindings.map(b =>
          el('div', { class: 'key-row' }, [
            el('span', { class: 'key-combo' }, b.keys.map(k => el('kbd', { text: k }))),
            el('span', { class: 'key-action', text: b.action })
          ])
        ))
      ])
    ]);
  }
}
