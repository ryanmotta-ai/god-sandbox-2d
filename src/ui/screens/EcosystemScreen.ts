import { el } from '../core/Dom';
import { SpeciesType } from '../../entities/Species';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

export class EcosystemScreen implements Screen {
  public readonly id = 'ecosystem' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  public build(ctx: GameContext): HTMLElement {
    const deers = ctx.sim.entities.filter(e => e.species === SpeciesType.DEER).length;
    const wolves = ctx.sim.entities.filter(e => e.species === SpeciesType.WOLF).length;
    const bears = ctx.sim.entities.filter(e => e.species === SpeciesType.BEAR).length;
    const dragons = ctx.sim.entities.filter(e => e.species === SpeciesType.DRAGON).length;
    const totalFauna = deers + wolves + bears + dragons;
    const currentEra = ctx.eras ? ctx.eras.getCurrentEra() : 'Era da Harmonia Natural';

    return el('div', { class: 'screen-container glass-panel eco-gameawards-container' }, [
      // Top Bar & Title Header
      el('div', { class: 'screen-header eco-header-hero' }, [
        el('div', { class: 'header-hero-title' }, [
          el('span', { class: 'hero-icon', text: '🌿' }),
          el('div', {}, [
            el('h2', { class: 'emerald-gradient-text', text: 'Ecossistema, Clima & Censo da Fauna Selvagem' }),
            el('p', { class: 'hero-subtitle', text: 'Monitoramento de Eras Climáticas, Censo de Predadores, Herbívoros e Dragões Anciões' })
          ])
        ]),
        el('button', { class: 'close-btn-hero', text: '✕', on: { click: () => ctx.screens.back() } })
      ]),

      el('div', { class: 'screen-body eco-hero-body' }, [
        // METRICS BANNER (4 Hero Cards)
        el('div', { class: 'eco-metrics-banner-hero' }, [
          el('div', { class: 'ec-metric-card' }, [
            el('span', { class: 'ec-metric-icon', text: '🌍' }),
            el('div', {}, [
              el('span', { class: 'ec-metric-lbl', text: 'Era Climática Vigente' }),
              el('div', { class: 'ec-metric-val highlight-green', text: currentEra })
            ])
          ]),
          el('div', { class: 'ec-metric-card' }, [
            el('span', { class: 'ec-metric-icon', text: '🐾' }),
            el('div', {}, [
              el('span', { class: 'ec-metric-lbl', text: 'Fauna Selvagem Viva' }),
              el('div', { class: 'ec-metric-val highlight-gold', text: `${totalFauna} Animais` })
            ])
          ]),
          el('div', { class: 'ec-metric-card' }, [
            el('span', { class: 'ec-metric-icon', text: '🌲' }),
            el('div', {}, [
              el('span', { class: 'ec-metric-lbl', text: 'Renovação Florestal' }),
              el('div', { class: 'ec-metric-val highlight-cyan', text: '+24% / Ano' })
            ])
          ]),
          el('div', { class: 'ec-metric-card' }, [
            el('span', { class: 'ec-metric-icon', text: '🐉' }),
            el('div', {}, [
              el('span', { class: 'ec-metric-lbl', text: 'Dragões em Atividade' }),
              el('div', { class: `ec-metric-val ${dragons > 0 ? 'highlight-red' : 'highlight-green'}`, text: dragons > 0 ? `${dragons} Anciões ⚠️` : 'Nenhum' })
            ])
          ])
        ]),

        // GRID: CLIMATE ERA & WILDLIFE CENSUS
        el('div', { class: 'eco-grid-layout' }, [
          // COLUMN 1: CLIMATE ERA & BIOMES
          el('div', { class: 'eco-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: `🌍 Era Climática: ${currentEra}` }),
              el('span', { class: 'badge-tag-green', text: 'CLIMA GLOBAL' })
            ]),
            el('p', { class: 'gov-desc-text', text: 'As eras climáticas regem os ciclos de chuva, crescimento florestal, taxa de pesca e agressividade dos animais selvagens.' }),

            el('div', { class: 'climate-modifiers-grid' }, [
              el('div', { class: 'c-mod-card' }, [el('span', { text: '🌾 Colheitas Agrícolas' }), el('strong', { class: 'highlight-green', text: '+30% Produtividade' })]),
              el('div', { class: 'c-mod-card' }, [el('span', { text: '🌲 Regeneração de Florestas' }), el('strong', { class: 'highlight-cyan', text: '+20% Crescimento' })]),
              el('div', { class: 'c-mod-card' }, [el('span', { text: '🦌 Reprodução da Fauna' }), el('strong', { class: 'highlight-gold', text: '+15% Taxa de Nascimentos' })]),
              el('div', { class: 'c-mod-card' }, [el('span', { text: '⚡ Riscos de Intempérie' }), el('strong', { text: 'Baixo (Tempo Firme)' })])
            ]),

            el('hr', { class: 'hero-divider' }),

            el('h4', { class: 'section-subheading', text: '🗺️ Cobertura Global de Biomas' }),
            el('div', { class: 'biomes-progress-list' }, [
              this.biomeBar('🌲 Floresta Temperada', '45%', '#10b981'),
              this.biomeBar('🌾 Planícies & Cultivos', '30%', '#fbbf24'),
              this.biomeBar('⛰️ Montanhas & Rocha', '15%', '#94a3b8'),
              this.biomeBar('🏜️ Deserto & Areia', '10%', '#f59e0b')
            ])
          ]),

          // COLUMN 2: REAL-TIME WILDLIFE CENSUS
          el('div', { class: 'eco-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: '🐺 Censo da Fauna Selvagem' }),
              el('span', { class: 'badge-tag-gold', text: '4 ESPÉCIES MONITORTADAS' })
            ]),

            el('div', { class: 'wildlife-hero-grid' }, [
              this.faunaCard('🦌 Cervos & Veados', deers, 'Herbívoros Pacíficos', 'Fonte primária de carne e couros nas caçadas das aldeias.', '#10b981'),
              this.faunaCard('🐺 Lobos Selvagens', wolves, 'Predadores de Matilha', 'Caçam em grupo nos bosques; atacam aldeões isolados.', '#fbbf24'),
              this.faunaCard('🐻 Ursos das Cavernas', bears, 'Super-Predadores Solitários', 'Guerreiros de alta vitalidade que protegem seus territórios.', '#f59e0b'),
              this.faunaCard('🐉 Dragões Anciões', dragons, 'Ameaça Lendária / Boss', 'Cuspidores de fogo capazes de incinerar cidades inteiras!', '#ef4444')
            ])
          ])
        ])
      ])
    ]);
  }

  private biomeBar(label: string, pct: string, color: string): HTMLElement {
    return el('div', { class: 'biome-bar-row' }, [
      el('div', { class: 'b-bar-lbl' }, [el('span', { text: label }), el('strong', { style: `color: ${color}`, text: pct })]),
      el('div', { class: 'b-bar-bg' }, [
        el('div', { class: 'b-bar-fill', style: `width: ${pct}; background: ${color};` })
      ])
    ]);
  }

  private faunaCard(title: string, count: number, role: string, desc: string, accentColor: string): HTMLElement {
    return el('div', { class: 'fauna-hero-card', style: `border-left: 4px solid ${accentColor}` }, [
      el('div', { class: 'f-head' }, [
        el('strong', { text: title }),
        el('span', { class: 'f-count-badge', style: `background: ${accentColor}22; color: ${accentColor}; border: 1px solid ${accentColor}`, text: `${count} Vivos` })
      ]),
      el('span', { class: 'f-role-tag', text: role }),
      el('p', { class: 'f-desc-text', text: desc })
    ]);
  }
}
