import { el, clear, button, emptyState, formatNumber } from '../core/Dom';
import { lineChart, barList, donutChart } from '../components/Charts';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import { TRAIT_DEFINITIONS, TraitId } from '../../entities/Traits';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

/** World analytics dashboard driven by the StatsTracker time series. */
export class StatsScreen implements Screen {
  public readonly id = 'stats' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private ctx!: GameContext;
  private bodyEl!: HTMLElement;

  public build(ctx: GameContext): HTMLElement {
    this.ctx = ctx;
    this.bodyEl = el('div', { class: 'stats-body' });

    const layout = el('div', { class: 'screen-panel' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '📊 World Statistics' }),
          el('p', { class: 'screen-sub', text: `${ctx.stats.samples.length} years recorded · currently year ${ctx.sim.currentYear}` })
        ]),
        el('div', { class: 'head-actions' }, [
          button('Refresh', () => this.render(), { icon: '🔄' }),
          button('Close', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
        ])
      ]),
      this.bodyEl
    ]);

    this.render();
    return layout;
  }

  private render(): void {
    clear(this.bodyEl);
    const { sim, stats } = this.ctx;
    const samples = stats.samples;

    this.bodyEl.appendChild(
      el('div', { class: 'stat-grid cols-4' }, [
        this.tile('👥', 'Population', formatNumber(sim.entities.length), `peak ${formatNumber(stats.peakPopulation)}`),
        this.tile('🏛️', 'Cities', `${sim.cities.size}`),
        this.tile('👑', 'Kingdoms', `${sim.kingdoms.size}`, `peak ${stats.peakKingdoms}`),
        this.tile('⚔️', 'Wars fought', `${sim.diplomacy.activeWars.size + sim.diplomacy.warHistory.length}`, `${sim.diplomacy.activeWars.size} ongoing`),
        this.tile('👶', 'Total births', formatNumber(sim.totalBirths)),
        this.tile('💀', 'Total deaths', formatNumber(sim.totalDeaths)),
        this.tile('🔥', 'Burning tiles', `${this.ctx.activeFires}`),
        this.tile('📅', 'Current year', `${sim.currentYear}`)
      ])
    );

    if (samples.length < 2) {
      this.bodyEl.appendChild(
        emptyState('⏳', 'Not enough history yet', 'Let the simulation run for a few years and the charts will fill in.')
      );
    } else {
      const years = samples.map(s => s.year);

      this.bodyEl.appendChild(
        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [
            el('h3', { class: 'panel-title', text: 'Population Over Time' }),
            el('p', { class: 'panel-sub', text: 'Civilised folk versus wildlife across recorded history.' })
          ]),
          el('div', { class: 'panel-body' }, [
            lineChart(
              [
                { label: 'Humanoids', color: '#fbbf24', values: samples.map(s => s.humanoids) },
                { label: 'Wildlife', color: '#34d399', values: samples.map(s => s.wildlife) }
              ],
              years,
              { height: 220 }
            )
          ])
        ])
      );

      this.bodyEl.appendChild(
        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [
            el('h3', { class: 'panel-title', text: 'Civilisation & Conflict' })
          ]),
          el('div', { class: 'panel-body' }, [
            lineChart(
              [
                { label: 'Cities', color: '#38bdf8', values: samples.map(s => s.cities) },
                { label: 'Kingdoms', color: '#a855f7', values: samples.map(s => s.kingdoms) },
                { label: 'Active wars', color: '#ef4444', values: samples.map(s => s.activeWars) }
              ],
              years,
              { height: 200 }
            )
          ])
        ])
      );

      this.bodyEl.appendChild(
        el('section', { class: 'panel' }, [
          el('header', { class: 'panel-head' }, [
            el('h3', { class: 'panel-title', text: 'Births & Deaths per Year' })
          ]),
          el('div', { class: 'panel-body' }, [
            lineChart(
              [
                { label: 'Births', color: '#10b981', values: samples.map(s => s.births) },
                { label: 'Deaths', color: '#ef4444', values: samples.map(s => s.deaths) }
              ],
              years,
              { height: 180 }
            )
          ])
        ])
      );
    }

    // Species split
    const breakdown = stats.speciesBreakdown(sim);
    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Species Distribution' })]),
        el('div', { class: 'panel-body' }, [
          breakdown.length
            ? donutChart(breakdown.map(b => ({ label: b.name, value: b.count, color: b.color })), 'creatures')
            : el('p', { class: 'muted small', text: 'No creatures are alive in this world.' })
        ])
      ])
    );

    // Kingdom power ranking
    const rankings = stats.kingdomRankings(sim);
    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [
          el('h3', { class: 'panel-title', text: 'Kingdom Power Ranking' }),
          el('p', { class: 'panel-sub', text: 'Derived from military strength, levels and territory held.' })
        ]),
        el('div', { class: 'panel-body' }, [
          rankings.length
            ? barList(rankings.map(r => ({
                label: `${r.emblem} ${r.name}`,
                value: r.power,
                color: r.color,
                sublabel: `👥 ${formatNumber(r.population)} · 🏛️ ${r.cities} · 🗺️ ${formatNumber(r.territory)}`
              })))
            : el('p', { class: 'muted small', text: 'No kingdoms have been founded yet.' })
        ])
      ])
    );

    // Trait prevalence — how divine intervention shaped the gene pool
    const traitCounts = new Map<TraitId, number>();
    for (const entity of sim.entities) {
      for (const trait of entity.traits) traitCounts.set(trait, (traitCounts.get(trait) ?? 0) + 1);
    }
    const traitData = Array.from(traitCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([trait, count]) => ({
        label: TRAIT_DEFINITIONS[trait]?.name ?? trait,
        value: count,
        color: TRAIT_DEFINITIONS[trait]?.color ?? '#94a3b8'
      }));

    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [
          el('h3', { class: 'panel-title', text: 'Trait Prevalence' }),
          el('p', { class: 'panel-sub', text: 'How many living creatures carry each trait.' })
        ]),
        el('div', { class: 'panel-body' }, [
          traitData.length
            ? barList(traitData)
            : el('p', { class: 'muted small', text: 'No creature carries a notable trait.' })
        ])
      ])
    );

    // Notable individuals
    const legends = [...sim.entities]
      .sort((a, b) => (b.level * 1000 + b.kills) - (a.level * 1000 + a.kills))
      .slice(0, 8);

    this.bodyEl.appendChild(
      el('section', { class: 'panel' }, [
        el('header', { class: 'panel-head' }, [el('h3', { class: 'panel-title', text: 'Living Legends' })]),
        el('div', { class: 'panel-body' }, [
          legends.length
            ? el('div', { class: 'legend-table' }, legends.map((e, i) => {
                const kingdom = e.kingdomId ? sim.kingdoms.get(e.kingdomId) : null;
                return el('button', {
                  class: 'legend-row',
                  on: {
                    click: () => {
                      this.ctx.focusOn(e.x, e.y, 2);
                      this.ctx.screens.closeAll();
                    }
                  }
                }, [
                  el('span', { class: 'legend-rank', text: `#${i + 1}` }),
                  el('span', { class: 'legend-name', text: e.name, style: { color: SPECIES_DEFINITIONS[e.species].primaryColor } }),
                  el('span', { class: 'legend-meta', text: `Lvl ${e.level} · ${e.kills} kills · ${e.profession}` }),
                  el('span', { class: 'legend-realm', text: kingdom?.name ?? 'Independent', style: { color: kingdom?.color ?? '#64748b' } })
                ]);
              }))
            : el('p', { class: 'muted small', text: 'No one lives to tell a tale.' })
        ])
      ])
    );
  }

  private tile(icon: string, label: string, value: string, sub?: string): HTMLElement {
    return el('div', { class: 'stat-tile' }, [
      el('span', { class: 'tile-icon', text: icon }),
      el('span', { class: 'tile-value', text: value }),
      el('span', { class: 'tile-label', text: label }),
      sub ? el('span', { class: 'tile-sub', text: sub }) : null
    ].filter(Boolean) as HTMLElement[]);
  }
}
