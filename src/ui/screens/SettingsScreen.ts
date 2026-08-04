import { el, clear, button } from '../core/Dom';
import { settings, GameSettings, DisasterFrequency } from '../core/Settings';
import { sound } from '../../core/SoundSynth';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

type Tab = 'audio' | 'graphics' | 'interface' | 'simulation';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'graphics', label: 'Graphics', icon: '🎨' },
  { id: 'interface', label: 'Interface', icon: '🖥️' },
  { id: 'audio', label: 'Audio', icon: '🔊' },
  { id: 'simulation', label: 'Simulation', icon: '⚙️' }
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
          el('h2', { class: 'screen-title', text: '⚙️ Settings' }),
          el('p', { class: 'screen-sub', text: 'Changes apply instantly and are remembered between sessions.' })
        ]),
        el('div', { class: 'head-actions' }, [
          button('Reset to defaults', () => {
            settings.reset();
            ctx.applySettings();
            this.renderTab();
            ctx.toast('Settings restored to defaults', 'info');
          }, { icon: '↩️' }),
          button('Close', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
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
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'World Rendering' })]),
        el('div', { class: 'panel-body' }, [
          this.toggle('showGrid', 'Tile grid', 'Draw a faint grid over the terrain.'),
          this.toggle('showCityNames', 'City name labels', 'Show settlement names floating above towns.'),
          this.toggle('showKingdomBadges', 'Kingdom banners', 'Floating name badges over each realm’s territory.'),
          this.toggle('showHealthBars', 'Health bars', 'Show HP bars above wounded creatures.'),
          this.toggle('showParticles', 'Particle effects', 'Smoke, sparks, damage numbers and magic.'),
          this.toggle('showBrushCursor', 'Brush cursor ring', 'The dashed circle that previews your brush size.'),
          this.toggle('screenShake', 'Screen shake', 'Camera shake on meteors, earthquakes and lightning.')
        ])
      ])
    );
  }

  private renderInterface(): void {
    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Heads-up Display' })]),
        el('div', { class: 'panel-body' }, [
          this.toggle('showMinimap', 'Minimap', 'The world map in the bottom-right corner.'),
          this.toggle('showTooltips', 'Detailed tooltips', 'Longer descriptions when hovering powers.'),
          this.toggle('compactToolbar', 'Compact power dock', 'Smaller power buttons — more world visible.'),
          this.slider('uiScale', 'Interface scale', 0.85, 1.2, 0.05, v => `${Math.round(v * 100)}%`)
        ])
      ])
    );

    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Shortcuts' })]),
        el('div', { class: 'panel-body' }, [
          el('p', { class: 'muted small', text: 'The full control reference lives in the How to Play screen.' }),
          button('Open How to Play', () => this.ctx.screens.open('help'), { icon: '❓' })
        ])
      ])
    );
  }

  private renderAudio(): void {
    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Sound' })]),
        el('div', { class: 'panel-body' }, [
          this.toggle('soundEnabled', 'Sound effects', 'Synthesized clicks, thunder and explosions.'),
          this.slider('masterVolume', 'Master volume', 0, 1, 0.05, v => `${Math.round(v * 100)}%`),
          el('div', { class: 'action-row' }, [
            button('Test sound', () => {
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
      { value: 'none', label: 'None', detail: 'Only disasters you cast yourself' },
      { value: 'rare', label: 'Rare', detail: 'The occasional catastrophe' },
      { value: 'normal', label: 'Normal', detail: 'Balanced natural chaos' },
      { value: 'chaos', label: 'Chaos', detail: 'The world is actively trying to die' }
    ];

    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'World Rules' })]),
        el('div', { class: 'panel-body' }, [
          this.choice('disasterFrequency', 'Natural disasters', 'How often the world spawns its own catastrophes.', freqOptions),
          this.slider('defaultSpeed', 'Default simulation speed', 0, 10, 1, v => (v === 0 ? 'Paused' : `${v}×`))
        ])
      ])
    );

    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Autosave' })]),
        el('div', { class: 'panel-body' }, [
          this.toggle('autosaveEnabled', 'Enable autosave', 'Automatically writes to the autosave slot.'),
          this.slider('autosaveIntervalYears', 'Autosave every', 5, 100, 5, v => `${v} years`)
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
