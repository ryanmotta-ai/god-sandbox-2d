import { el, button, clear } from '../core/Dom';
import { MapPreview } from '../components/MapPreview';
import { WORLD_PRESET_INFO, WorldConfig } from '../core/GameContext';
import { SpeciesType, SPECIES_DEFINITIONS } from '../../entities/Species';
import { WorldEra } from '../../world/WeatherEras';
import { GeneratorPreset } from '../../world/WorldGenerator';
import { WORLD_BLUEPRINTS } from '../../world/WorldBlueprints';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

/**
 * World creation.
 *
 * The three worlds are fixed, so this screen is a choice between three known
 * places rather than a dice roll — which changes what it has to do. It leads
 * with a large preview of the actual map you are about to play, and states the
 * concrete facts about it, because those are now things a player can learn and
 * plan around.
 */

const SIZES = [
  {
    value: 128,
    label: 'Padrão',
    detail: '128 × 128',
    blurb: 'Equilíbrio entre proximidade, exploração e duração da partida.'
  },
  {
    value: 256,
    label: 'Grande',
    detail: '256 × 256',
    blurb: 'Regiões amplas e viagens longas com simulação regional.'
  },
  {
    value: 512,
    label: 'Vasto',
    detail: '512 × 512',
    blurb: 'Mundo continental chunked; recomendado para máquinas com mais memória.'
  }
];

const PREVIEW_SIZE = 360;
/** Previews render at reduced resolution — generation is O(n²). */
const PREVIEW_RESOLUTION = 112;

export class WorldSetupScreen implements Screen {
  public readonly id = 'world-setup' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private config!: WorldConfig;
  private preview!: MapPreview;
  private popValue!: HTMLElement;
  private detailPane!: HTMLElement;
  private optionRoots: Map<string, HTMLElement> = new Map();
  private previewTimer: number | null = null;

  public build(ctx: GameContext): HTMLElement {
    this.config = {
      size: 128,
      preset: 'single_continent',
      // Fixed worlds: the seed no longer shapes the terrain. It is kept because
      // it still drives everything else — where people are placed, who they are,
      // and every decision the simulation makes from year one.
      seed: 1,
      species: [SpeciesType.HUMAN],
      startingPopulation: 6,
      spawnWildlife: true,
      era: WorldEra.GOLDEN_AGE
    };

    this.preview = new MapPreview(PREVIEW_SIZE, PREVIEW_SIZE, 'setup-preview');
    this.detailPane = el('div', { class: 'world-detail' });
    this.optionRoots.clear();

    const layout = el('div', { class: 'setup-screen' }, [
      el('header', { class: 'setup-head' }, [
        el('div', {}, [
          el('h2', { class: 'setup-title', text: 'Criar Mundo' }),
          el('p', { class: 'setup-sub', text: 'Três mundos desenhados à mão. Cada um é sempre o mesmo — aprenda o mapa e ele vira vantagem.' })
        ]),
        button('Voltar', () => ctx.screens.back(), { hint: 'Esc' })
      ]),

      el('div', { class: 'setup-body' }, [
        // Left: the map you are choosing, big enough to actually read.
        el('section', { class: 'setup-stage' }, [
          el('div', { class: 'preview-frame' }, [this.preview.canvas]),
          this.detailPane
        ]),

        // Right: the choices, in the order they matter.
        el('section', { class: 'setup-options' }, [
          this.worldSection(),
          this.sizeSection(),
          this.foundersSection(),
          el('div', { class: 'setup-launch' }, [
            button('Criar Mundo', () => this.create(ctx), { variant: 'primary', class: 'wide' })
          ])
        ])
      ])
    ]);

    this.refreshPreview();
    this.renderDetail();
    return layout;
  }

  public dispose(): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
  }

  // ============================ SECTIONS ============================

  private worldSection(): HTMLElement {
    const group = el('div', { class: 'world-choices' });
    this.optionRoots.set('preset', group);

    for (const preset of WORLD_PRESET_INFO) {
      group.appendChild(
        el('button', {
          class: `world-card${this.config.preset === preset.id ? ' selected' : ''}`,
          dataset: { value: preset.id },
          on: {
            click: () => {
              this.config.preset = preset.id as GeneratorPreset;
              this.syncSelection('preset', preset.id);
              this.refreshPreview();
              this.renderDetail();
            }
          }
        }, [
          // A miniature of the real landmass, so the choice is visual before it
          // is textual.
          this.shapeGlyph(preset.id as GeneratorPreset),
          el('span', { class: 'world-card-text' }, [
            el('span', { class: 'world-card-name', text: preset.name }),
            el('span', { class: 'world-card-tag', text: preset.tagline })
          ])
        ])
      );
    }

    return this.field('MUNDO', group);
  }

  /**
   * A tiny top-down sketch of the world's landmasses, drawn from the same
   * blueprint the generator uses — so the icon cannot show a shape the map
   * does not have.
   */
  private shapeGlyph(preset: GeneratorPreset): HTMLElement {
    const blueprint = WORLD_BLUEPRINTS[preset as keyof typeof WORLD_BLUEPRINTS];
    const canvas = el('canvas', { class: 'world-card-glyph' }) as HTMLCanvasElement;
    canvas.width = 34;
    canvas.height = 34;
    const c = canvas.getContext('2d');
    if (!c || !blueprint) return canvas;

    c.fillStyle = '#12263f';
    c.fillRect(0, 0, 34, 34);
    for (const blob of blueprint.land) {
      if (blob.strength <= 0) continue;
      c.fillStyle = '#4b8b5b';
      c.beginPath();
      c.ellipse(blob.u * 34, blob.v * 34, Math.max(1.2, blob.ru * 34), Math.max(1.2, blob.rv * 34), 0, 0, Math.PI * 2);
      c.fill();
    }
    // Carved bays and straits are painted back as water.
    for (const blob of blueprint.land) {
      if (blob.strength >= 0) continue;
      c.fillStyle = '#12263f';
      c.beginPath();
      c.ellipse(blob.u * 34, blob.v * 34, blob.ru * 30, blob.rv * 30, 0, 0, Math.PI * 2);
      c.fill();
    }
    return canvas;
  }

  private sizeSection(): HTMLElement {
    const group = el('div', { class: 'option-grid cols-3' });
    this.optionRoots.set('size', group);

    for (const size of SIZES) {
      group.appendChild(
        el('button', {
          class: `option-card${this.config.size === size.value ? ' selected' : ''}`,
          dataset: { value: `${size.value}` },
          on: {
            click: () => {
              this.config.size = size.value;
              this.syncSelection('size', `${size.value}`);
              this.renderDetail();
            }
          }
        }, [
          el('span', { class: 'option-name', text: size.label }),
          el('span', { class: 'option-dim', text: size.detail }),
          el('span', { class: 'option-detail', text: size.blurb })
        ])
      );
    }

    return this.field('TAMANHO', group);
  }

  private foundersSection(): HTMLElement {
    const human = SPECIES_DEFINITIONS[SpeciesType.HUMAN];

    this.popValue = el('span', { class: 'range-value', text: this.foundersLabel() });

    const slider = el('input', {
      class: 'range',
      attrs: { type: 'range', min: '2', max: '40', step: '2', value: `${this.config.startingPopulation}` },
      on: {
        input: (ev: Event) => {
          this.config.startingPopulation = parseInt((ev.target as HTMLInputElement).value, 10);
          this.popValue.textContent = this.foundersLabel();
        }
      }
    });

    const wildlife = el('label', { class: 'switch-row' }, [
      el('input', {
        attrs: { type: 'checkbox', checked: this.config.spawnWildlife },
        on: { change: (ev: Event) => { this.config.spawnWildlife = (ev.target as HTMLInputElement).checked; } }
      }),
      el('span', { class: 'switch-track' }, [el('span', { class: 'switch-knob' })]),
      el('span', { class: 'switch-text', text: 'Povoar a natureza com veados, javalis, lobos e ursos' })
    ]);

    return this.field('FUNDADORES', el('div', { class: 'founders-block' }, [
      el('p', { class: 'founders-note', text: `${human.name} — ${human.advantage}` }),
      el('div', { class: 'range-row' }, [slider, this.popValue]),
      wildlife
    ]));
  }

  private foundersLabel(): string {
    const n = this.config.startingPopulation;
    return `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;
  }

  /** The facts about the selected world, restated from its blueprint. */
  private renderDetail(): void {
    clear(this.detailPane);
    const preset = WORLD_PRESET_INFO.find(p => p.id === this.config.preset);
    if (!preset) return;

    const tiles = this.config.size * this.config.size;

    this.detailPane.appendChild(el('h3', { class: 'world-detail-name', text: preset.name }));
    this.detailPane.appendChild(el('p', { class: 'world-detail-desc', text: preset.description }));
    this.detailPane.appendChild(
      el('ul', { class: 'world-detail-list' },
        preset.highlights.map(h => el('li', { text: h })))
    );
    this.detailPane.appendChild(
      el('p', { class: 'world-detail-foot', text: `${this.config.size} × ${this.config.size} — ${tiles.toLocaleString('pt-BR')} tiles` })
    );
  }

  // ============================ HELPERS ============================

  private field(label: string, control: HTMLElement): HTMLElement {
    return el('div', { class: 'setup-field' }, [
      el('span', { class: 'field-label', text: label }),
      control
    ]);
  }

  private syncSelection(groupKey: string, value: string): void {
    const group = this.optionRoots.get(groupKey);
    if (!group) return;
    for (const child of Array.from(group.children)) {
      child.classList.toggle('selected', (child as HTMLElement).dataset.value === value);
    }
  }

  private refreshPreview(): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    this.preview.drawPlaceholder('Desenhando o mundo…');
    this.previewTimer = window.setTimeout(() => {
      this.preview.drawGenerated(PREVIEW_RESOLUTION, this.config.preset, this.config.seed);
    }, 60);
  }

  private create(ctx: GameContext): void {
    ctx.startNewWorld({ ...this.config, species: [SpeciesType.HUMAN] });
  }
}
