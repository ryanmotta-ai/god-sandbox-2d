import { el } from '../core/Dom';
import { CRAFT_TECHS, POLITICAL_TECHS, TECH_ERAS, TECHNOLOGIES, TechEra, techCost, demandCreatedBy } from '../../civ/TechTree';
import { BUILDINGS } from '../../civ/Building';
import { GOODS } from '../../civ/Goods';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

export class TechTreeScreen implements Screen {
  public readonly id = 'techtree' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  private selectedTrack: 'craft' | 'politics' = 'craft';
  private selectedKingdomId: string | null = null;
  private ctx: GameContext | null = null;

  /**
   * What this technology does to the world, not just what it unlocks.
   *
   * The strategic demand shown here is the same table the economy actually
   * reports to the market, so a player reading "Coal ↑↑" is reading the reason
   * coal is about to get expensive.
   */
  private consequences(techId: string): HTMLElement | null {
    const tech = TECHNOLOGIES[techId];
    if (!tech) return null;

    const rows: HTMLElement[] = [];

    const buildings = tech.unlocks.buildings ?? [];
    if (buildings.length > 0) {
      rows.push(el('div', { class: 'tech-consequence', style: { fontSize: '11px', color: '#7dd3fc' },
        text: `🏗️ Constrói: ${buildings.map(b => BUILDINGS[b]?.name ?? b).join(', ')}` }));
    }

    const demand = demandCreatedBy(techId);
    if (demand.length > 0) {
      // Each material is a live question — is anyone actually producing it? —
      // so it links straight into the economic deep-dive on that good.
      rows.push(el('div', { class: 'tech-consequence', style: { fontSize: '11px', color: '#fbbf24' } }, [
        el('span', { text: '⛏️ Torna estratégico: ' }),
        ...demand.map(d => el('span', {
          class: 'cell-link',
          text: `${GOODS[d.good].icon} ${GOODS[d.good].name} ${d.weight >= 1.5 ? '↑↑' : '↑'}  `,
          title: `Ver ${GOODS[d.good].name} na economia`,
          on: { click: () => this.ctx?.screens.open('economy', { good: d.good }) }
        }))
      ]));
    }

    const features = tech.unlocks.features ?? [];
    if (features.length > 0) {
      rows.push(el('div', { class: 'tech-consequence', style: { fontSize: '11px', color: '#c4b5fd' },
        text: `✨ Habilita: ${features.join(', ')}` }));
    }

    const mods = tech.unlocks.modifiers;
    if (mods) {
      const parts: string[] = [];
      if (mods.production && mods.production !== 1) parts.push(`produção ×${mods.production}`);
      if (mods.research && mods.research !== 1) parts.push(`pesquisa ×${mods.research}`);
      if (mods.growth && mods.growth !== 1) parts.push(`crescimento ×${mods.growth}`);
      if (mods.trade && mods.trade !== 1) parts.push(`comércio ×${mods.trade}`);
      if (mods.military && mods.military !== 1) parts.push(`militar ×${mods.military}`);
      if (parts.length > 0) {
        rows.push(el('div', { class: 'tech-consequence', style: { fontSize: '11px', color: '#86efac' },
          text: `📈 ${parts.join(', ')}` }));
      }
    }

    if (rows.length === 0) return null;
    return el('div', { class: 'tech-consequences', style: { margin: '6px 0', lineHeight: '1.6' } }, rows);
  }

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;
    if (params?.focusKingdom) this.selectedKingdomId = params.focusKingdom;
    const kingdoms = Array.from(ctx.sim.kingdoms.values());
    if (!this.selectedKingdomId && kingdoms.length > 0) {
      this.selectedKingdomId = kingdoms[0].id;
    }
    const currentKingdom = kingdoms.find(k => k.id === this.selectedKingdomId) ?? kingdoms[0];
    const knownTechs = currentKingdom?.research.known ?? new Set(['tribalism', 'stone_tools']);
    const techs = this.selectedTrack === 'craft' ? CRAFT_TECHS : POLITICAL_TECHS;
    const knownCount = techs.filter(t => knownTechs.has(t.id)).length;

    return el('div', { class: 'screen-container glass-panel tech-gameawards-container' }, [
      // Top Bar & Title Header
      el('div', { class: 'screen-header tech-header-hero' }, [
        el('div', { class: 'header-hero-title' }, [
          el('span', { class: 'hero-icon', text: '🎓' }),
          el('div', {}, [
            el('h2', { class: 'sapphire-gradient-text', text: 'Árvore de Tecnologias, Tradições & Ciência' }),
            el('p', { class: 'hero-subtitle', text: 'Desenvolvimento Científico, Manufatura, Regimes Políticos e Filosofia ao Longo das 6 Eras' })
          ])
        ]),
        el('button', { class: 'close-btn-hero', text: '✕', on: { click: () => ctx.screens.back() } })
      ]),

      el('div', { class: 'screen-body tech-hero-body' }, [
        // METRICS BANNER (4 Hero Cards)
        el('div', { class: 'tech-metrics-banner-hero' }, [
          el('div', { class: 'tc-metric-card' }, [
            el('span', { class: 'tc-metric-icon', text: '🏛️' }),
            el('div', {}, [
              el('span', { class: 'tc-metric-lbl', text: 'Reino em Análise' }),
              el('div', { class: 'tc-metric-val highlight-gold', text: currentKingdom?.name ?? 'Tribo' })
            ])
          ]),
          el('div', { class: 'tc-metric-card' }, [
            el('span', { class: 'tc-metric-icon', text: '💡' }),
            el('div', {}, [
              el('span', { class: 'tc-metric-lbl', text: 'Tecnologias Desbloqueadas' }),
              el('div', { class: 'tc-metric-val highlight-cyan', text: `${knownCount} / ${techs.length}` })
            ])
          ]),
          el('div', { class: 'tc-metric-card' }, [
            el('span', { class: 'tc-metric-icon', text: '⚡' }),
            el('div', {}, [
              el('span', { class: 'tc-metric-lbl', text: 'Geração Anual de Pesquisa' }),
              el('div', { class: 'tc-metric-val highlight-green', text: `+${currentKingdom?.research.output ?? 15} Pts / Ano` })
            ])
          ]),
          el('div', { class: 'tc-metric-card' }, [
            el('span', { class: 'tc-metric-icon', text: '📜' }),
            el('div', {}, [
              el('span', { class: 'tc-metric-lbl', text: 'Trilha Selecionada' }),
              el('div', { class: 'tc-metric-val highlight-blue', text: this.selectedTrack === 'craft' ? 'Manufatura & Ciência' : 'Política & Sociedade' })
            ])
          ])
        ]),

        // KINGDOM & TRACK SELECTOR TABS
        el('div', { class: 'tech-controls-bar' }, [
          el('div', { class: 'track-hero-tabs' }, [
            el('button', {
              class: `track-hero-tab ${this.selectedTrack === 'craft' ? 'active' : ''}`,
              on: { click: () => { this.selectedTrack = 'craft'; ctx.screens.refresh(); } }
            }, [el('span', { text: '⚒️ Manufatura, Ferramentas & Ciência' })]),
            el('button', {
              class: `track-hero-tab ${this.selectedTrack === 'politics' ? 'active' : ''}`,
              on: { click: () => { this.selectedTrack = 'politics'; ctx.screens.refresh(); } }
            }, [el('span', { text: '🏛️ Política, Leis & Filosofia Social' })])
          ]),
          el('div', { class: 'kingdom-select-dropdown' },
            kingdoms.map(realm => el('button', {
              class: `k-select-btn ${realm.id === currentKingdom?.id ? 'active' : ''}`,
              style: `border-bottom: 2px solid ${realm.color}`,
              on: { click: () => { this.selectedKingdomId = realm.id; ctx.screens.refresh(); } }
            }, [el('span', { text: realm.name })]))
          )
        ]),

        // TECH NODES GRID BY ERAS
        el('div', { class: 'techtree-nodes-hero-container glass-card-hero' }, [
          el('div', { class: 'card-hero-header' }, [
            el('h3', { text: '📜 Grafo de Conhecimento Civilizacional' }),
            el('span', { class: 'badge-tag-blue', text: '6 ERAS HISTÓRICAS' })
          ]),

          el('div', { class: 'techtree-hero-grid' },
            techs.map(t => {
              const isKnown = knownTechs.has(t.id);
              const eraInfo = TECH_ERAS[t.era as TechEra];
              return el('div', { class: `tech-node-hero-card ${isKnown ? 'unlocked' : 'locked'}` }, [
                el('div', { class: 'tech-node-top' }, [
                  el('div', { class: 'tech-icon-name' }, [
                    el('span', { class: 'tech-icon-emoji', text: t.icon }),
                    el('strong', { class: 'tech-title-text', text: t.name })
                  ]),
                  el('span', { class: 'tech-era-tag', style: `background: ${eraInfo?.color ?? '#3b82f6'}22; border: 1px solid ${eraInfo?.color ?? '#3b82f6'}; color: ${eraInfo?.color ?? '#3b82f6'}`, text: eraInfo?.name ?? 'Era' })
                ]),
                el('p', { class: 'tech-desc-hero', text: t.description }),
                this.consequences(t.id),
                el('div', { class: 'tech-node-footer' }, [
                  el('span', { class: `tech-status-badge ${isKnown ? 'known' : 'need'}`, text: isKnown ? '✓ DESBLOQUEADO' : `Custo: ${techCost(t)} Pts` }),
                  !isKnown ? el('button', {
                    class: 'unlock-tech-btn',
                    text: '⚡ Desbloquear',
                    on: { click: () => {
                      if (currentKingdom) {
                        currentKingdom.research.known.add(t.id);
                        ctx.screens.refresh();
                      }
                    }}
                  }) : null
                ])
              ]);
            })
          )
        ])
      ])
    ]);
  }
}
