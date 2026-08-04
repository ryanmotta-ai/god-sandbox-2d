import { el } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

export class WarfareScreen implements Screen {
  public readonly id = 'warfare' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  public build(ctx: GameContext): HTMLElement {
    const activeWars = ctx.sim.diplomacy ? Array.from(ctx.sim.diplomacy.activeWars.values()) : [];
    const kingdoms = Array.from(ctx.sim.kingdoms.values());
    const totalMilitaryPower = kingdoms.reduce((acc, k) => acc + k.computePower(), 0);

    return el('div', { class: 'screen-container glass-panel war-gameawards-container' }, [
      // Top Bar & Title Header
      el('div', { class: 'screen-header war-header-hero' }, [
        el('div', { class: 'header-hero-title' }, [
          el('span', { class: 'hero-icon', text: '⚔️' }),
          el('div', {}, [
            el('h2', { class: 'crimson-gradient-text', text: 'Alto Comando de Guerra, Exércitos & Logística' }),
            el('p', { class: 'hero-subtitle', text: 'Monitor de Conflitos Ativos, Nível de Armamentos, Cercos Urbanos e Auras de Comando' })
          ])
        ]),
        el('button', { class: 'close-btn-hero', text: '✕', on: { click: () => ctx.screens.back() } })
      ]),

      el('div', { class: 'screen-body war-hero-body' }, [
        // WARFARE METRICS BANNER (4 Hero Cards)
        el('div', { class: 'war-metrics-banner-hero' }, [
          el('div', { class: 'w-metric-card' }, [
            el('span', { class: 'w-metric-icon', text: '⚔️' }),
            el('div', {}, [
              el('span', { class: 'w-metric-lbl', text: 'Guerra Ativas' }),
              el('div', { class: `w-metric-val ${activeWars.length > 0 ? 'highlight-red' : 'highlight-green'}`, text: `${activeWars.length} Conflitos` })
            ])
          ]),
          el('div', { class: 'w-metric-card' }, [
            el('span', { class: 'w-metric-icon', text: '🛡️' }),
            el('div', {}, [
              el('span', { class: 'w-metric-lbl', text: 'Poder Militar Mundial' }),
              el('div', { class: 'w-metric-val highlight-gold', text: `${totalMilitaryPower.toFixed(0)} Pts` })
            ])
          ]),
          el('div', { class: 'w-metric-card' }, [
            el('span', { class: 'w-metric-icon', text: '🏰' }),
            el('div', {}, [
              el('span', { class: 'w-metric-lbl', text: 'Cercos Urbanos Ativos' }),
              el('div', { class: 'w-metric-val highlight-cyan', text: `${activeWars.length * 2} Cercos` })
            ])
          ]),
          el('div', { class: 'w-metric-card' }, [
            el('span', { class: 'w-metric-icon', text: '🩸' }),
            el('div', {}, [
              el('span', { class: 'w-metric-lbl', text: 'Baixas Estimadas da Era' }),
              el('div', { class: 'w-metric-val highlight-red', text: '48 Baixas' })
            ])
          ])
        ]),

        // GRID: ACTIVE CONFLICTS & KINGDOM LOGISTICS
        el('div', { class: 'war-grid-layout' }, [
          // COLUMN 1: ACTIVE CONFLICTS MONITOR
          el('div', { class: 'war-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: `⚔️ Conflitos Armados Ativos (${activeWars.length})` }),
              el('span', { class: 'badge-tag-red', text: 'TEATRO DE GUERRA' })
            ]),

            activeWars.length > 0 ? el('div', { class: 'wars-hero-list' },
              activeWars.map((w: any) => {
                const atk = ctx.sim.kingdoms.get(w.attackerId);
                const def = ctx.sim.kingdoms.get(w.defenderId);
                return el('div', { class: 'war-hero-card' }, [
                  el('div', { class: 'war-hero-parties' }, [
                    el('span', { class: 'party-pill', style: `background: ${atk?.color}22; border: 1px solid ${atk?.color}`, text: `⚔️ ${atk?.name ?? 'Atacante'}` }),
                    el('span', { class: 'vs-pill', text: 'VS' }),
                    el('span', { class: 'party-pill', style: `background: ${def?.color}22; border: 1px solid ${def?.color}`, text: `🛡️ ${def?.name ?? 'Defensor'}` })
                  ]),
                  el('div', { class: 'war-hero-details' }, [
                    el('div', { class: 'war-d-row' }, [el('span', { text: 'Motivo Geopolítico: ' }), el('strong', { class: 'highlight-gold', text: w.reason })]),
                    el('div', { class: 'war-d-row' }, [el('span', { text: 'Início do Conflito: ' }), el('strong', { text: `Ano ${w.startYear}` })]),
                    el('div', { class: 'war-d-row' }, [el('span', { text: 'Estimativa de Baixas: ' }), el('strong', { class: 'highlight-red', text: `${w.casualties ?? 14} mortos` })])
                  ]),
                  el('button', {
                    class: 'ceasefire-btn-hero',
                    text: '🕊️ Forçar Cessar-Fogo (Mediar Paz)',
                    on: { click: () => {
                      if (ctx.sim.diplomacy) {
                        ctx.sim.diplomacy.endWar(w.attackerId, w.defenderId, ctx.sim.currentYear);
                        ctx.screens.refresh();
                      }
                    }}
                  })
                ]);
              })
            ) : el('div', { class: 'peace-hero-box' }, [
              el('span', { class: 'peace-icon', text: '🕊️' }),
              el('h4', { text: 'O Mundo Encontra-se em Paz' }),
              el('p', { text: 'Nenhuma guerra foi declarada no momento. Os reinos estão focados no desenvolvimento interno e comércio.' })
            ])
          ]),

          // COLUMN 2: KINGDOM MILITARY POWER & COMMAND AURAS
          el('div', { class: 'war-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: '🛡️ Poder de Combate & Armamentos' })
            ]),

            el('div', { class: 'military-hero-list' },
              kingdoms.map(k => {
                const ruler = k.rulerId ? ctx.sim.entities.find(e => e.id === k.rulerId) : null;
                const hasIron = k.research.knows('iron_working');
                const hasBronze = k.research.knows('bronze_working');
                const armorTier = hasIron ? '⚔️ Aço & Ferro Temperado' : hasBronze ? '🏺 Bronze Reforçado' : '🪓 Armas Primitivas';

                return el('div', { class: 'military-hero-card', style: `border-left: 4px solid ${k.color}` }, [
                  el('div', { class: 'm-card-top' }, [
                    el('strong', { text: k.name }),
                    el('span', { class: 'm-power-badge', text: `${k.computePower().toFixed(0)} Pts` })
                  ]),
                  el('div', { class: 'm-card-body' }, [
                    el('div', { class: 'm-row' }, [el('span', { text: 'Nível de Armamento: ' }), el('strong', { text: armorTier })]),
                    el('div', { class: 'm-row' }, [
                      el('span', { text: 'Aura de Comando do Rei: ' }),
                      el('strong', { class: ruler ? 'highlight-green' : 'highlight-red', text: ruler ? `👑 ATIVA (+25% Moral - ${ruler.name})` : '⚠️ INATIVA (Sem Rei)' })
                    ]),
                    el('div', { class: 'm-row' }, [el('span', { text: 'Desgaste de Guerra: ' }), el('strong', { class: k.warWeariness > 50 ? 'highlight-red' : '', text: `${k.warWeariness}%` })])
                  ]),
                  el('div', { class: 'weariness-bar-bg' }, [
                    el('div', { class: 'weariness-bar-fill', style: `width: ${k.warWeariness}%; background: ${k.warWeariness > 50 ? '#ef4444' : '#fbbf24'};` })
                  ])
                ]);
              })
            )
          ])
        ])
      ])
    ]);
  }
}
