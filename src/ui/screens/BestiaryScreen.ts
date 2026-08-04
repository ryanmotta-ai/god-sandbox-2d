import { el, clear, button, badge, meter, hexAlpha, titleCase } from '../core/Dom';
import { SPECIES_DEFINITIONS, SpeciesType } from '../../entities/Species';
import { TRAIT_DEFINITIONS, TraitId } from '../../entities/Traits';
import { TERRAINS, TerrainType } from '../../world/Biomes';
import { ALL_POWERS } from '../../powers/GodPowers';
import { CATEGORIES } from '../hud/Toolbar';
import { SpriteGenerator } from '../../renderer/SpriteGenerator';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

type Tab = 'species' | 'traits' | 'terrain' | 'powers';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'species', label: 'Species', icon: '🧬' },
  { id: 'traits', label: 'Traits', icon: '✨' },
  { id: 'terrain', label: 'Terrain', icon: '🗺️' },
  { id: 'powers', label: 'Divine Powers', icon: '⚡' }
];

const SPECIES_LORE: Record<SpeciesType, string> = {
  [SpeciesType.HUMAN]: 'A única espécie civilizada de Aethoria. Sem dom nenhum de nascença: tudo que constroem vem de trabalho, comércio e tecnologia — e é por isso que se espalham por qualquer terreno que dê para arar.',
  [SpeciesType.DEER]: 'Harmless grazers. Their only strategy is to run, and it usually works.',
  [SpeciesType.WOLF]: 'Pack hunters that coordinate attacks on stragglers. A lone wolf is a nuisance; a pack is a massacre.',
  [SpeciesType.BEAR]: 'Territorial and immensely strong. Bears do not chase — they simply refuse to lose ground.',
  [SpeciesType.DRAGON]: 'An apex disaster with wings. Slaying one showers the nearest hero with legendary equipment.',
  [SpeciesType.BOAR]: 'Javali selvagem das florestas. Territorial e agressivo quando ameaçado.',
  [SpeciesType.EAGLE]: 'Águia de rapina que sobrevoa cumes de montanha em busca de presas.',
  [SpeciesType.MAMMOTH]: 'Mamute gigante das tundras congeladas. Titã resistente caçado por tribos primitivas.'
};

/** In-game encyclopedia. Available from the title screen too, so it works without a world. */
export class BestiaryScreen implements Screen {
  public readonly id = 'bestiary' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private ctx!: GameContext;
  private bodyEl!: HTMLElement;
  private tabsEl!: HTMLElement;
  private activeTab: Tab = 'species';

  public build(ctx: GameContext): HTMLElement {
    this.ctx = ctx;
    this.bodyEl = el('div', { class: 'codex-body' });
    this.tabsEl = el('div', { class: 'tab-strip' });

    const layout = el('div', { class: 'screen-panel' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '📖 Codex of Aethoria' }),
          el('p', { class: 'screen-sub', text: 'Everything that lives, grows, burns and can be summoned.' })
        ]),
        button('Close', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
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
        }, [
          el('span', { text: tab.icon }),
          el('span', { text: tab.label })
        ])
      );
    }
  }

  private renderTab(): void {
    clear(this.bodyEl);
    switch (this.activeTab) {
      case 'species': return this.renderSpecies();
      case 'traits': return this.renderTraits();
      case 'terrain': return this.renderTerrain();
      case 'powers': return this.renderPowers();
    }
  }

  // ============================ SPECIES ============================

  private renderSpecies(): void {
    const liveCounts = new Map<SpeciesType, number>();
    for (const e of this.ctx.sim.entities) {
      liveCounts.set(e.species, (liveCounts.get(e.species) ?? 0) + 1);
    }

    const humanoids = Object.values(SPECIES_DEFINITIONS).filter(s => s.isHumanoid);
    const fauna = Object.values(SPECIES_DEFINITIONS).filter(s => !s.isHumanoid);

    const grid = (list: typeof humanoids) =>
      el('div', { class: 'codex-grid' }, list.map(config => {
        const alive = liveCounts.get(config.id) ?? 0;
        return el('article', {
          class: 'codex-card',
          style: { '--card-accent': config.primaryColor } as any
        }, [
          el('div', { class: 'codex-card-head' }, [
            this.spriteBox(`species_${config.id}`, config.primaryColor, 64),
            el('div', {}, [
              el('h3', { class: 'codex-name', style: { color: config.primaryColor }, text: config.name }),
              el('div', { class: 'chip-row' }, [
                badge(config.isHumanoid ? 'Civilisation' : 'Wildlife', config.primaryColor),
                alive > 0 ? badge(`${alive} alive`, '#34d399') : badge('None alive', '#64748b')
              ])
            ])
          ]),
          el('p', { class: 'codex-lore', text: SPECIES_LORE[config.id] }),
          el('div', { class: 'meter-stack' }, [
            meter('Health', config.baseHp, 1200, '#ef4444', `${config.baseHp}`),
            meter('Damage', config.baseDamage, 65, '#f97316', `${config.baseDamage}`),
            meter('Defense', config.baseDefense, 25, '#38bdf8', `${config.baseDefense}`),
            meter('Speed', config.baseSpeed, 1.5, '#34d399', config.baseSpeed.toFixed(2)),
            meter('Lifespan', config.maxAge, 1000, '#a855f7', `${config.maxAge} yrs`)
          ]),
          el('div', { class: 'stat-list' }, [
            el('div', { class: 'stat-row' }, [
              el('span', { class: 'stat-label', text: 'Architecture' }),
              el('span', { class: 'stat-value', text: config.buildingStyle })
            ]),
            el('div', { class: 'stat-row' }, [
              el('span', { class: 'stat-label', text: 'Prefers' }),
              el('span', { class: 'stat-value', text: config.preferredBiomes.map(titleCase).join(', ') })
            ])
          ])
        ]);
      }));

    this.bodyEl.appendChild(el('h3', { class: 'codex-section-title', text: 'Civilised Species' }));
    this.bodyEl.appendChild(grid(humanoids));
    this.bodyEl.appendChild(el('h3', { class: 'codex-section-title', text: 'Wildlife & Beasts' }));
    this.bodyEl.appendChild(grid(fauna));
  }

  // ============================ TRAITS ============================

  private renderTraits(): void {
    const counts = new Map<TraitId, number>();
    for (const e of this.ctx.sim.entities) {
      for (const t of e.traits) counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    this.bodyEl.appendChild(
      el('p', { class: 'codex-intro', text: 'Traits stack multiplicatively and are partially inherited by offspring. Divine powers can grant them directly.' })
    );

    this.bodyEl.appendChild(
      el('div', { class: 'codex-grid cols-3' },
        Object.values(TRAIT_DEFINITIONS).map(trait => {
          const mods: string[] = [];
          if (trait.hpMod) mods.push(`${formatMod(trait.hpMod)} max HP`);
          if (trait.damageMod) mods.push(`${formatMod(trait.damageMod)} damage`);
          if (trait.defenseMod) mods.push(`${formatMod(trait.defenseMod)} defense`);
          if (trait.speedMod) mods.push(`${formatMod(trait.speedMod)} speed`);

          return el('article', {
            class: 'codex-card compact',
            style: { '--card-accent': trait.color, borderColor: hexAlpha(trait.color, 0.35) } as any
          }, [
            el('h3', { class: 'codex-name', style: { color: trait.color }, text: trait.name }),
            el('p', { class: 'codex-lore', text: trait.description }),
            mods.length ? el('div', { class: 'chip-row' }, mods.map(m => badge(m, trait.color))) : null,
            el('div', { class: 'stat-list' }, [
              el('div', { class: 'stat-row' }, [
                el('span', { class: 'stat-label', text: 'Inherit chance' }),
                el('span', { class: 'stat-value', text: `${Math.round(trait.inheritChance * 100)}%` })
              ]),
              el('div', { class: 'stat-row' }, [
                el('span', { class: 'stat-label', text: 'Carriers alive' }),
                el('span', { class: 'stat-value', text: `${counts.get(trait.id) ?? 0}` })
              ])
            ])
          ].filter(Boolean) as HTMLElement[]);
        })
      )
    );
  }

  // ============================ TERRAIN ============================

  private renderTerrain(): void {
    const tileCounts = new Map<TerrainType, number>();
    const map = this.ctx.tileMap;
    for (let x = 0; x < map.width; x++) {
      for (let y = 0; y < map.height; y++) {
        const t = map.grid[x][y];
        if (t) tileCounts.set(t.type, (tileCounts.get(t.type) ?? 0) + 1);
      }
    }
    const totalTiles = map.width * map.height;

    this.bodyEl.appendChild(
      el('p', { class: 'codex-intro', text: `Composition of the current world (${map.width} × ${map.height} tiles).` })
    );

    this.bodyEl.appendChild(
      el('div', { class: 'terrain-grid' },
        Object.values(TERRAINS).map(terrain => {
          const count = tileCounts.get(terrain.id) ?? 0;
          const share = totalTiles ? (count / totalTiles) * 100 : 0;
          return el('article', { class: 'terrain-card', style: { borderColor: hexAlpha(terrain.color, 0.5) } }, [
            el('div', { class: 'terrain-card-head' }, [
              el('span', { class: 'terrain-swatch', style: { background: terrain.color } }),
              el('div', {}, [
                el('h3', { class: 'terrain-name', text: terrain.name }),
                el('span', { class: 'terrain-share', text: `${share.toFixed(1)}% of the world` })
              ])
            ]),
            el('div', { class: 'chip-row' }, [
              terrain.isWalkable ? badge('Passable', '#34d399') : badge('Impassable', '#ef4444'),
              terrain.isWater ? badge('Water', '#38bdf8') : null,
              terrain.flammability > 0.5 ? badge('Highly flammable', '#f97316') : null,
              terrain.fertility >= 0.9 ? badge('Fertile', '#22c55e') : null
            ].filter(Boolean) as HTMLElement[]),
            el('div', { class: 'meter-stack' }, [
              meter('Fertility', terrain.fertility, 1.2, '#22c55e', `${Math.round(terrain.fertility * 100)}%`),
              meter('Flammability', terrain.flammability, 1, '#f97316', `${Math.round(terrain.flammability * 100)}%`),
              meter('Move cost', Math.min(terrain.moveCost, 3), 3, '#94a3b8', terrain.moveCost >= 99 ? 'Blocked' : terrain.moveCost.toFixed(1))
            ])
          ]);
        })
      )
    );
  }

  // ============================ POWERS ============================

  private renderPowers(): void {
    this.bodyEl.appendChild(
      el('p', { class: 'codex-intro', text: 'Every divine power available from the dock, grouped by category. Click one to equip it.' })
    );

    for (const category of CATEGORIES) {
      const powers = ALL_POWERS.filter(p => p.category === category.id);
      if (!powers.length) continue;

      this.bodyEl.appendChild(
        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [
            el('h3', { class: 'panel-title', text: `${category.icon} ${category.label}` }),
            el('p', { class: 'panel-sub', text: `Shift + ${category.hotkey} · ${powers.length} powers` })
          ]),
          el('div', { class: 'panel-body' }, [
            el('div', { class: 'power-codex' }, powers.map(power =>
              el('button', {
                class: 'power-codex-item',
                style: { '--power-accent': category.accent } as any,
                title: this.ctx.inGame ? 'Select this power' : 'Start a world to use this power',
                on: {
                  click: () => {
                    if (!this.ctx.inGame) {
                      this.ctx.toast('Create a world first', 'warning');
                      return;
                    }
                    this.ctx.brush.setCategory(category.id);
                    this.ctx.brush.setPower(power.id);
                    this.ctx.screens.closeAll();
                    this.ctx.toast(`${power.icon} ${power.name} equipped`, 'divine');
                  }
                }
              }, [
                el('span', { class: 'power-codex-icon', text: power.icon }),
                el('div', {}, [
                  el('span', { class: 'power-codex-name', text: power.name }),
                  el('span', { class: 'power-codex-desc', text: power.description })
                ])
              ])
            ))
          ])
        ])
      );
    }
  }

  // ============================ HELPERS ============================

  private spriteBox(spriteKey: string, accent: string, size: number): HTMLElement {
    const box = el('div', { class: 'sprite-box large', style: { borderColor: hexAlpha(accent, 0.5) } });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c2d = canvas.getContext('2d')!;
    c2d.imageSmoothingEnabled = false;
    const sprite = SpriteGenerator.getSprite(spriteKey, () => {});
    if (sprite) c2d.drawImage(sprite, 0, 0, size, size);
    box.appendChild(canvas);
    return box;
  }
}

function formatMod(mod: number): string {
  const pct = Math.round((mod - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}
