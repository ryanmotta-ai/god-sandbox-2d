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
  { id: 'species', label: 'Espécies', icon: '🧬' },
  { id: 'traits', label: 'Características', icon: '✨' },
  { id: 'terrain', label: 'Terreno', icon: '🗺️' },
  { id: 'powers', label: 'Poderes Divinos', icon: '⚡' }
];

const SPECIES_LORE: Record<SpeciesType, string> = {
  [SpeciesType.HUMAN]: 'A única espécie civilizada de Aethoria. Sem dom nenhum de nascença: tudo que constroem vem de trabalho, comércio e tecnologia — e é por isso que se espalham por qualquer terreno que dê para arar.',
  [SpeciesType.DEER]: 'Herbívoros inofensivos. Sua única estratégia é fugir, e geralmente funciona.',
  [SpeciesType.WOLF]: 'Caçadores em bando que coordenam ataques aos retardatários. Um lobo solitário é um incômodo; um bando é um massacre.',
  [SpeciesType.BEAR]: 'Territoriais e imensamente fortes. Ursos não perseguem — eles simplesmente se recusam a ceder terreno.',
  [SpeciesType.DRAGON]: 'Um desastre alado no topo da cadeia alimentar. Matar um inunda o herói mais próximo com equipamento lendário.',
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
          el('h2', { class: 'screen-title', text: '📖 Códice de Aethoria' }),
          el('p', { class: 'screen-sub', text: 'Tudo que vive, cresce, queima e pode ser invocado.' })
        ]),
        button('Fechar', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
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
                badge(config.isHumanoid ? 'Civilização' : 'Vida Selvagem', config.primaryColor),
                alive > 0 ? badge(`${alive} vivos`, '#34d399') : badge('Nenhum vivo', '#64748b')
              ])
            ])
          ]),
          el('p', { class: 'codex-lore', text: SPECIES_LORE[config.id] }),
          el('div', { class: 'meter-stack' }, [
            meter('Vida', config.baseHp, 1200, '#ef4444', `${config.baseHp}`),
            meter('Dano', config.baseDamage, 65, '#f97316', `${config.baseDamage}`),
            meter('Defesa', config.baseDefense, 25, '#38bdf8', `${config.baseDefense}`),
            meter('Velocidade', config.baseSpeed, 1.5, '#34d399', config.baseSpeed.toFixed(2)),
            meter('Expectativa de vida', config.maxAge, 1000, '#a855f7', `${config.maxAge} anos`)
          ]),
          el('div', { class: 'stat-list' }, [
            el('div', { class: 'stat-row' }, [
              el('span', { class: 'stat-label', text: 'Arquitetura' }),
              el('span', { class: 'stat-value', text: config.buildingStyle })
            ]),
            el('div', { class: 'stat-row' }, [
              el('span', { class: 'stat-label', text: 'Prefere' }),
              el('span', { class: 'stat-value', text: config.preferredBiomes.map(titleCase).join(', ') })
            ])
          ])
        ]);
      }));

    this.bodyEl.appendChild(el('h3', { class: 'codex-section-title', text: 'Espécies Civilizadas' }));
    this.bodyEl.appendChild(grid(humanoids));
    this.bodyEl.appendChild(el('h3', { class: 'codex-section-title', text: 'Vida Selvagem e Feras' }));
    this.bodyEl.appendChild(grid(fauna));
  }

  // ============================ TRAITS ============================

  private renderTraits(): void {
    const counts = new Map<TraitId, number>();
    for (const e of this.ctx.sim.entities) {
      for (const t of e.traits) counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    this.bodyEl.appendChild(
      el('p', { class: 'codex-intro', text: 'Características se acumulam multiplicativamente e são parcialmente herdadas pelos filhotes. Poderes divinos podem concedê-las diretamente.' })
    );

    this.bodyEl.appendChild(
      el('div', { class: 'codex-grid cols-3' },
        Object.values(TRAIT_DEFINITIONS).map(trait => {
          const mods: string[] = [];
          if (trait.hpMod) mods.push(`${formatMod(trait.hpMod)} HP máx.`);
          if (trait.damageMod) mods.push(`${formatMod(trait.damageMod)} dano`);
          if (trait.defenseMod) mods.push(`${formatMod(trait.defenseMod)} defesa`);
          if (trait.speedMod) mods.push(`${formatMod(trait.speedMod)} velocidade`);

          return el('article', {
            class: 'codex-card compact',
            style: { '--card-accent': trait.color, borderColor: hexAlpha(trait.color, 0.35) } as any
          }, [
            el('h3', { class: 'codex-name', style: { color: trait.color }, text: trait.name }),
            el('p', { class: 'codex-lore', text: trait.description }),
            mods.length ? el('div', { class: 'chip-row' }, mods.map(m => badge(m, trait.color))) : null,
            el('div', { class: 'stat-list' }, [
              el('div', { class: 'stat-row' }, [
                el('span', { class: 'stat-label', text: 'Chance de herança' }),
                el('span', { class: 'stat-value', text: `${Math.round(trait.inheritChance * 100)}%` })
              ]),
              el('div', { class: 'stat-row' }, [
                el('span', { class: 'stat-label', text: 'Portadores vivos' }),
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
      el('p', { class: 'codex-intro', text: `Composição do mundo atual (${map.width} × ${map.height} blocos).` })
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
                el('span', { class: 'terrain-share', text: `${share.toFixed(1)}% do mundo` })
              ])
            ]),
            el('div', { class: 'chip-row' }, [
              terrain.isWalkable ? badge('Transitável', '#34d399') : badge('Intransitável', '#ef4444'),
              terrain.isWater ? badge('Água', '#38bdf8') : null,
              terrain.flammability > 0.5 ? badge('Altamente inflamável', '#f97316') : null,
              terrain.fertility >= 0.9 ? badge('Fértil', '#22c55e') : null
            ].filter(Boolean) as HTMLElement[]),
            el('div', { class: 'meter-stack' }, [
              meter('Fertilidade', terrain.fertility, 1.2, '#22c55e', `${Math.round(terrain.fertility * 100)}%`),
              meter('Inflamabilidade', terrain.flammability, 1, '#f97316', `${Math.round(terrain.flammability * 100)}%`),
              meter('Custo de movimento', Math.min(terrain.moveCost, 3), 3, '#94a3b8', terrain.moveCost >= 99 ? 'Bloqueado' : terrain.moveCost.toFixed(1))
            ])
          ]);
        })
      )
    );
  }

  // ============================ POWERS ============================

  private renderPowers(): void {
    this.bodyEl.appendChild(
      el('p', { class: 'codex-intro', text: 'Todo poder divino disponível no painel, agrupado por categoria. Clique em um para equipar.' })
    );

    for (const category of CATEGORIES) {
      const powers = ALL_POWERS.filter(p => p.category === category.id);
      if (!powers.length) continue;

      this.bodyEl.appendChild(
        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [
            el('h3', { class: 'panel-title', text: `${category.icon} ${category.label}` }),
            el('p', { class: 'panel-sub', text: `Shift + ${category.hotkey} · ${powers.length} poderes` })
          ]),
          el('div', { class: 'panel-body' }, [
            el('div', { class: 'power-codex' }, powers.map(power =>
              el('button', {
                class: 'power-codex-item',
                style: { '--power-accent': category.accent } as any,
                title: this.ctx.inGame ? 'Selecionar este poder' : 'Crie um mundo para usar este poder',
                on: {
                  click: () => {
                    if (!this.ctx.inGame) {
                      this.ctx.toast('Crie um mundo primeiro', 'warning');
                      return;
                    }
                    this.ctx.brush.setCategory(category.id);
                    this.ctx.brush.setPower(power.id);
                    this.ctx.screens.closeAll();
                    this.ctx.toast(`${power.icon} ${power.name} equipado`, 'divine');
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
