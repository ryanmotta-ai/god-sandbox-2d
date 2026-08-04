import { el, button } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

const SYSTEMS = [
  { icon: '🌍', name: 'World Generation', detail: 'Simplex noise heightmaps, radial continent masks, climate-driven biome assignment.' },
  { icon: '🧠', name: 'Entity AI', detail: 'A per-creature state machine covering foraging, building, pack hunting, combat and flight.' },
  { icon: '🏛️', name: 'Civilisation', detail: 'Autonomous city founding, territory growth, resource stockpiles and kingdom formation.' },
  { icon: '🤝', name: 'Diplomacy', detail: 'Relation scores, war declarations, peace treaties, alliances and war chronicles.' },
  { icon: '🎨', name: 'Pixel Renderer', detail: 'Procedurally drawn 16×16 sprites generated at runtime — no image assets ship with the game.' },
  { icon: '🔊', name: 'Sound Synthesis', detail: 'Every sound effect is generated live through the Web Audio API.' },
  { icon: '💾', name: 'Persistence', detail: 'Full world serialisation to localStorage slots or portable JSON files.' },
  { icon: '🖥️', name: 'Interface', detail: 'A screen-router UI layer with a live HUD, codex, analytics and world browser.' }
];

export class CreditsScreen implements Screen {
  public readonly id = 'credits' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  public build(ctx: GameContext): HTMLElement {
    return el('div', { class: 'screen-panel narrow' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '🏅 Credits' }),
          el('p', { class: 'screen-sub', text: 'Aethoria — Divine 2D Sandbox' })
        ]),
        button('Close', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
      ]),

      el('div', { class: 'credits-body' }, [
        el('div', { class: 'credits-hero' }, [
          el('div', { class: 'credits-mark', text: '✦' }),
          el('h1', { class: 'credits-title', text: 'AETHORIA' }),
          el('p', { class: 'credits-sub', text: 'A world that runs without you — and is more interesting when you interfere.' })
        ]),

        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Engine Systems' })]),
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
          el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Built With' })]),
          el('div', { class: 'panel-body' }, [
            el('div', { class: 'chip-row' }, [
              el('span', { class: 'chip', text: 'TypeScript' }),
              el('span', { class: 'chip', text: 'Vite' }),
              el('span', { class: 'chip', text: 'Canvas 2D' }),
              el('span', { class: 'chip', text: 'Web Audio API' }),
              el('span', { class: 'chip', text: 'Zero runtime dependencies' })
            ]),
            el('p', { class: 'muted small', text: 'Fonts: Outfit and Silkscreen, served by Google Fonts.' })
          ])
        ])
      ])
    ]);
  }
}
