import { el, clear, button } from '../core/Dom';
import { settings, GameSettings, DisasterFrequency } from '../core/Settings';
import { sound } from '../../core/SoundSynth';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

type Tab = 'audio' | 'graphics' | 'interface' | 'simulation';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'graphics', label: 'Gráficos', icon: '🎨' },
  { id: 'interface', label: 'Interface', icon: '🖥️' },
  { id: 'audio', label: 'Áudio', icon: '🔊' },
  { id: 'simulation', label: 'Simulação', icon: '⚙️' }
];

/** Settings screen. Every change applies immediately and persists to localStorage. */
export class SettingsScreen implements Screen {
  public readonly id = 'settings' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private ctx!: GameContext;
  private bodyEl!: HTMLElement;
  private tabsEl!: HTMLElement;
  private activeTab: Tab = 'graphics';

  public build(ctx: GameContext): HTMLElement {
    this.ctx = ctx;
    this.bodyEl = el('div', { class: 'settings-body' });
    this.tabsEl = el('div', { class: 'tab-strip' });

    const layout = el('div', { class: 'screen-panel narrow' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '⚙️ Configurações' }),
          el('p', { class: 'screen-sub', text: 'Alterações aplicam-se instantaneamente e são lembradas entre sessões.' })
        ]),
        el('div', { class: 'head-actions' }, [
          button('Restaurar padrões', () => {
            settings.reset();
            ctx.applySettings();
            this.renderTab();
            ctx.toast('Configurações restauradas', 'info');
          }, { icon: '↩️' }),
          button('Fechar', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
        ])
      ]),
      this.tabsEl,
      this.bodyEl
    ]);

    this.renderTabs();
    this.renderTab();
    return layout;
  }

  private renderTabs(): void {
    clear(this.tabsEl);
    for (const tab of TABS) {
      this.tabsEl.appendChild(
        el('button', {
          class: `tab${this.activeTab === tab.id ? ' active' : ''}`,
          on: {
            click: () => {
              this.activeTab = tab.id;
              this.renderTabs();
              this.renderTab();
            }
          }
        }, [el('span', { text: tab.icon }), el('span', { text: tab.label })])
      );
    }
  }

  private renderTab(): void {
    clear(this.bodyEl);
    switch (this.activeTab) {
      case 'graphics': return this.renderGraphics();
      case 'interface': return this.renderInterface();
      case 'audio': return this.renderAudio();
      case 'simulation': return this.renderSimulation();
    }
  }

  private renderGraphics(): void {
    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Renderização do Mundo' })]),
        el('div', { class: 'panel-body' }, [
          this.toggle('showGrid', 'Grade de blocos', 'Desenhar uma grade suave sobre o terreno.'),
          this.toggle('showCityNames', 'Rótulos de nomes de cidades', 'Mostrar nomes de assentamentos flutuando sobre as cidades.'),
          this.toggle('showKingdomBadges', 'Bandeiras dos reinos', 'Emblemas de nomes flutuantes sobre o território de cada reino.'),
          this.toggle('showHealthBars', 'Barras de vida', 'Mostrar barras de HP acima das criaturas feridas.'),
          this.toggle('showParticles', 'Efeitos de partículas', 'Fumaça, faíscas, números de dano e magia.'),
          this.toggle('showBrushCursor', 'Anel de cursor do pincel', 'O círculo tracejado que prevê o tamanho do seu pincel.'),
          this.toggle('screenShake', 'Tremor de tela', 'Tremor de câmera em meteoros, terremotos e raios.')
        ])
      ])
    );
  }

  private renderInterface(): void {
    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Heads-up Display' })]),
        el('div', { class: 'panel-body' }, [
          this.toggle('showMinimap', 'Minimapa', 'O mapa do mundo no canto inferior direito.'),
          this.toggle('showTooltips', 'Dicas detalhadas', 'Descrições mais longas ao passar o mouse sobre os poderes.'),
          this.toggle('compactToolbar', 'Doca de poderes compacta', 'Botões de poder menores — mais do mundo visível.'),
          this.slider('uiScale', 'Escala da interface', 0.85, 1.2, 0.05, v => `${Math.round(v * 100)}%`)
        ])
      ])
    );

    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Atalhos' })]),
        el('div', { class: 'panel-body' }, [
          el('p', { class: 'muted small', text: 'A referência completa de controles está na tela Como Jogar.' }),
          button('Abrir Como Jogar', () => this.ctx.screens.open('help'), { icon: '❓' })
        ])
      ])
    );
  }

  private renderAudio(): void {
    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Som' })]),
        el('div', { class: 'panel-body' }, [
          this.toggle('soundEnabled', 'Efeitos sonoros', 'Cliques, trovões e explosões sintetizados.'),
          this.slider('masterVolume', 'Volume principal', 0, 1, 0.05, v => `${Math.round(v * 100)}%`),
          el('div', { class: 'action-row' }, [
            button('Testar som', () => {
              this.ctx.applySettings();
              sound.playMagic();
            }, { icon: '🎵' })
          ])
        ])
      ])
    );
  }

  private renderSimulation(): void {
    const freqOptions: { value: DisasterFrequency; label: string; detail: string }[] = [
      { value: 'none', label: 'Nenhum', detail: 'Apenas desastres que você mesmo conjura' },
      { value: 'rare', label: 'Raro', detail: 'A catástrofe ocasional' },
      { value: 'normal', label: 'Normal', detail: 'Caos natural equilibrado' },
      { value: 'chaos', label: 'Caos', detail: 'O mundo está ativamente tentando morrer' }
    ];

    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Regras do Mundo' })]),
        el('div', { class: 'panel-body' }, [
          this.choice('disasterFrequency', 'Desastres naturais', 'Com que frequência o mundo gera seus próprios cataclismos.', freqOptions),
          this.slider('defaultSpeed', 'Velocidade de simulação padrão', 0, 10, 1, v => (v === 0 ? 'Pausado' : `${v}×`))
        ])
      ])
    );

    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Autosave' })]),
        el('div', { class: 'panel-body' }, [
          this.toggle('autosaveEnabled', 'Ativar autosave', 'Salva automaticamente no slot de autosave.'),
          this.slider('autosaveIntervalYears', 'Autosave a cada', 5, 100, 5, v => `${v} anos`)
        ])
      ])
    );
  }

  // ============================ CONTROLS ============================

  private toggle(key: keyof GameSettings, label: string, hint: string): HTMLElement {
    const input = el('input', {
      attrs: { type: 'checkbox', checked: settings.get(key) as boolean },
      on: {
        change: (ev: Event) => {
          settings.set(key, (ev.target as HTMLInputElement).checked as never);
          this.ctx.applySettings();
        }
      }
    });

    return el('label', { class: 'setting-row' }, [
      el('div', { class: 'setting-text' }, [
        el('span', { class: 'setting-label', text: label }),
        el('span', { class: 'setting-hint', text: hint })
      ]),
      el('span', { class: 'switch' }, [input, el('span', { class: 'switch-track' }, [el('span', { class: 'switch-knob' })])])
    ]);
  }

  private slider(
    key: keyof GameSettings,
    label: string,
    min: number,
    max: number,
    step: number,
    format: (v: number) => string
  ): HTMLElement {
    const current = settings.get(key) as number;
    const valueEl = el('span', { class: 'range-value', text: format(current) });

    const input = el('input', {
      class: 'range',
      attrs: { type: 'range', min: `${min}`, max: `${max}`, step: `${step}`, value: `${current}` },
      on: {
        input: (ev: Event) => {
          const value = parseFloat((ev.target as HTMLInputElement).value);
          valueEl.textContent = format(value);
          settings.set(key, value as never);
          this.ctx.applySettings();
        }
      }
    });

    return el('div', { class: 'setting-row column' }, [
      el('div', { class: 'setting-text' }, [el('span', { class: 'setting-label', text: label })]),
      el('div', { class: 'range-row' }, [input, valueEl])
    ]);
  }

  private choice<T extends string>(
    key: keyof GameSettings,
    label: string,
    hint: string,
    options: { value: T; label: string; detail: string }[]
  ): HTMLElement {
    const group = el('div', { class: 'chip-select' });

    const sync = () => {
      for (const child of Array.from(group.children)) {
        child.classList.toggle('selected', (child as HTMLElement).dataset.value === String(settings.get(key)));
      }
    };

    for (const option of options) {
      group.appendChild(
        el('button', {
          class: 'chip-option',
          dataset: { value: option.value },
          title: option.detail,
          text: option.label,
          on: {
            click: () => {
              settings.set(key, option.value as never);
              this.ctx.applySettings();
              sync();
            }
          }
        })
      );
    }
    sync();

    return el('div', { class: 'setting-row column' }, [
      el('div', { class: 'setting-text' }, [
        el('span', { class: 'setting-label', text: label }),
        el('span', { class: 'setting-hint', text: hint })
      ]),
      group
    ]);
  }
}
