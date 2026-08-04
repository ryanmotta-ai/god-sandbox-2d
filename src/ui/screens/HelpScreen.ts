import { el, button } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

interface KeyBinding {
  keys: string[];
  action: string;
}

const CAMERA_KEYS: KeyBinding[] = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Pan the camera' },
  { keys: ['↑', '←', '↓', '→'], action: 'Pan the camera' },
  { keys: ['Right drag'], action: 'Drag the world around' },
  { keys: ['Scroll'], action: 'Zoom toward the cursor' },
  { keys: ['Home'], action: 'Recenter on the world' }
];

const SIM_KEYS: KeyBinding[] = [
  { keys: ['Space'], action: 'Pause / resume the simulation' },
  { keys: ['1'], action: 'Speed 1×' },
  { keys: ['2'], action: 'Speed 2×' },
  { keys: ['3'], action: 'Speed 5×' },
  { keys: ['4'], action: 'Speed 10×' }
];

const TOOL_KEYS: KeyBinding[] = [
  { keys: ['1', '–', '7'], action: 'Switch power category (with Shift)' },
  { keys: ['['], action: 'Smaller brush' },
  { keys: [']'], action: 'Bigger brush' },
  { keys: ['F'], action: 'Focus the power search box' },
  { keys: ['V'], action: 'Cycle map view / overlay' }
];

const SCREEN_KEYS: KeyBinding[] = [
  { keys: ['Esc'], action: 'Pause menu / close current screen' },
  { keys: ['C'], action: 'Chronicle' },
  { keys: ['K'], action: 'Kingdoms' },
  { keys: ['D'], action: 'Diplomacy' },
  { keys: ['G'], action: 'Statistics' },
  { keys: ['B'], action: 'Bestiary' },
  { keys: ['M'], action: 'Toggle minimap' },
  { keys: ['I'], action: 'Toggle inspector drawer' },
  { keys: ['Tab'], action: 'Hide the entire interface' },
  { keys: ['F1'], action: 'This help screen' },
  { keys: ['F3'], action: 'Debug panel' },
  { keys: ['F5'], action: 'Save & Load' }
];

const BASICS = [
  { icon: '🖱️', title: 'Left click paints', text: 'The selected power applies wherever you click or drag on the world.' },
  { icon: '🔍', title: 'Inspect anything', text: 'Pick the Inspect tool (category 7) and click a creature, city or tile to open its dossier.' },
  { icon: '🌱', title: 'Civilisation is automatic', text: 'Spawn a few humanoids on fertile land — they will gather, build, found cities and eventually crown kings on their own.' },
  { icon: '⚔️', title: 'Wars start themselves', text: 'Kingdoms of different species drift toward hostility. You can accelerate or prevent that from the Diplomacy screen.' },
  { icon: '💥', title: 'Consequences persist', text: 'Fire spreads along forests, water floods low ground, and razed terrain stays razed. Undo does not exist here.' },
  { icon: '📜', title: 'History records itself', text: 'Every founding, coronation and war is written into the Chronicle as it happens.' }
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
          el('h2', { class: 'screen-title', text: '❓ How to Play' }),
          el('p', { class: 'screen-sub', text: 'Aethoria runs itself. You are a weather system with opinions.' })
        ]),
        button('Close', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
      ]),

      el('div', { class: 'help-body' }, [
        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'The Basics' })]),
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
          this.keyPanel('Camera', CAMERA_KEYS),
          this.keyPanel('Time', SIM_KEYS),
          this.keyPanel('Tools', TOOL_KEYS),
          this.keyPanel('Screens', SCREEN_KEYS)
        ]),

        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [
            el('h3', { class: 'panel-title', text: 'A Suggested First World' })
          ]),
          el('div', { class: 'panel-body' }, [
            el('ol', { class: 'steps' }, [
              el('li', { text: 'Create a Single Continent world with Lumini and Sylvanii.' }),
              el('li', { text: 'Set speed to 2× and let ten or twenty years pass — cities will appear.' }),
              el('li', { text: 'Open the Kingdoms screen once banners start showing on the map.' }),
              el('li', { text: 'Paint a Dense Forest between the two realms, then set it on fire and watch how they react.' }),
              el('li', { text: 'Open the Chronicle to read what your interference actually caused.' })
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
