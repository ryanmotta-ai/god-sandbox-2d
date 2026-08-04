import { el, badge, meter, statRow, hexAlpha, formatNumber } from '../core/Dom';
import { GOVERNMENTS } from '../../civ/Government';
import { activeLawDefinitions, lawSummary } from '../../civ/Laws';
import { SOCIAL_FACTIONS, SOCIAL_FACTION_ORDER, type FactionFactor } from '../../civ/Society';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

export class PoliticsScreen implements Screen {
  public readonly id = 'politics' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  private selectedKingdomId: string | null = null;
  private ctx: GameContext | null = null;

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;
    if (params?.focusKingdom) this.selectedKingdomId = params.focusKingdom;
    const kingdoms = Array.from(ctx.sim.kingdoms.values());
    if (!this.selectedKingdomId || !ctx.sim.kingdoms.has(this.selectedKingdomId)) {
      this.selectedKingdomId = kingdoms[0]?.id ?? null;
    }

    const kingdom = this.selectedKingdomId ? ctx.sim.kingdoms.get(this.selectedKingdomId) ?? null : null;
    const gov = kingdom ? GOVERNMENTS[kingdom.government] : null;
    const laws = kingdom ? activeLawDefinitions(kingdom.laws) : [];
    const restless = kingdom
      ? SOCIAL_FACTION_ORDER
          .map(id => kingdom.society.factions[id])
          .sort((a, b) => b.radicalization * b.influence - a.radicalization * a.influence)
          .slice(0, 3)
      : [];

    return el('div', { class: 'screen-container glass-panel politics-gameawards-container' }, [
      el('div', { class: 'screen-header politics-header-hero' }, [
        el('div', { class: 'header-hero-title' }, [
          el('div', {}, [
            el('h2', { class: 'gold-gradient-text', text: 'Politics & State Council' }),
            el('p', {
              class: 'hero-subtitle',
              text: 'Laws, reforms, factions and internal pressure shaping every realm.'
            })
          ])
        ]),
        el('button', { class: 'close-btn-hero', text: 'Close', on: { click: () => ctx.screens.back() } })
      ]),

      el('div', { class: 'screen-body politics-hero-body' }, [
        el('div', { class: 'kingdom-hero-tabs' },
          kingdoms.map(realm => el('button', {
            class: `kingdom-hero-tab ${realm.id === kingdom?.id ? 'active' : ''}`,
            style: { borderBottom: `3px solid ${realm.color}` },
            on: {
              click: () => {
                this.selectedKingdomId = realm.id;
                ctx.screens.refresh();
              }
            }
          }, [
            el('span', { class: 'tab-realm-name', text: realm.name }),
            el('span', { class: 'tab-realm-badge', text: `${formatNumber(realm.computePower())} power` })
          ]))
        ),

        kingdom && gov ? el('div', { class: 'politics-grid-layout' }, [
          el('div', { class: 'politics-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: `Regime: ${gov.name}` }),
              el('span', { class: 'gov-badge-gold', text: gov.economy.toUpperCase() })
            ]),
            el('p', { class: 'gov-desc-text', text: gov.description }),
            el('div', { class: 'regime-stats-grid' }, [
              this.statTile('Legitimacy', `${Math.round(kingdom.legitimacy * 100)}%`),
              this.statTile('Stability', `${Math.round(kingdom.economy.stability * 100)}%`),
              this.statTile('Authority Culture', `${Math.round(kingdom.culture.authority * 100)}%`),
              this.statTile('Military Power', formatNumber(kingdom.computePower()))
            ]),
            meter('Administrative reach', kingdom.administrativeReach, 1, '#38bdf8', `${Math.round(kingdom.administrativeReach * 100)}%`),
            meter('Food security', kingdom.foodSecurity, 1, '#22c55e', `${Math.round(kingdom.foodSecurity * 100)}%`),
            meter('War weariness', kingdom.warWeariness, 100, '#ef4444', `${Math.round(kingdom.warWeariness)}%`)
          ]),

          el('div', { class: 'politics-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: 'Social Factions' }),
              el('span', {
                class: `risk-badge ${kingdom.society.revoltRisk > 0.35 ? 'danger' : 'safe'}`,
                text: `Revolt risk ${Math.round(kingdom.society.revoltRisk * 100)}%`
              })
            ]),
            meter('Social cohesion', kingdom.society.cohesion, 1, '#22c55e', `${Math.round(kingdom.society.cohesion * 100)}%`),
            meter('Reform pressure', kingdom.society.reformPressure, 1, '#38bdf8', `${Math.round(kingdom.society.reformPressure * 100)}%`),
            el('div', { class: 'factions-hero-list' },
              SOCIAL_FACTION_ORDER.map(id => {
                const faction = kingdom.society.factions[id];
                const risk = faction.satisfaction < 0.28 || faction.radicalization > 0.55
                  ? 'critical'
                  : faction.satisfaction < 0.42 || faction.radicalization > 0.34
                    ? 'moderate'
                    : 'low';
                return el('div', { class: `faction-hero-card risk-${risk}` }, [
                  el('div', { class: 'f-card-top' }, [
                    el('span', { class: 'f-title', text: SOCIAL_FACTIONS[id].name }),
                    el('span', { class: `f-risk-tag ${risk}`, text: risk.toUpperCase() })
                  ]),
                  el('p', { class: 'f-desc', text: SOCIAL_FACTIONS[id].description }),
                  meter('Satisfaction', faction.satisfaction, 1, faction.satisfaction > 0.5 ? '#22c55e' : '#ef4444', `${Math.round(faction.satisfaction * 100)}%`),
                  meter('Influence', faction.influence, 1, SOCIAL_FACTIONS[id].color, `${Math.round(faction.influence * 100)}%`),
                  this.reasons(faction.factors)
                ]);
              })
            )
          ]),

          el('div', { class: 'politics-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: 'Laws & Reforms' }),
              el('span', { class: 'gov-badge-gold', text: lawSummary(kingdom.laws).toUpperCase() })
            ]),
            el('div', { class: 'stat-list' }, [
              statRow('Reform momentum', `${Math.round(kingdom.laws.reformMomentum * 100)}%`),
              statRow('Cooldown', kingdom.laws.reformCooldownUntil > ctx.sim.currentYear ? `until year ${kingdom.laws.reformCooldownUntil}` : 'ready'),
              statRow('Latest reform', kingdom.laws.history[0] ? `year ${kingdom.laws.history[0].year}` : 'none yet'),
              statRow('Restless blocs', restless.map(f => SOCIAL_FACTIONS[f.id].shortName).join(', ') || 'none')
            ]),
            meter('Reform readiness', kingdom.laws.reformMomentum, 1, '#22c55e', `${Math.round(kingdom.laws.reformMomentum * 100)}%`),
            el('div', { class: 'decrees-hero-grid' },
              laws.map(law => el('div', {
                class: 'decree-hero-card active',
                style: { borderColor: hexAlpha(kingdom.color, 0.4) }
              }, [
                el('div', { class: 'd-head' }, [
                  el('strong', { text: law.name }),
                  badge(law.category, kingdom.color)
                ]),
                el('p', { class: 'd-desc', text: law.description })
              ]))
            )
          ])
        ]) : el('p', { text: 'No active realm yet.' })
      ])
    ]);
  }

  /**
   * Why this faction feels the way it does.
   *
   * Each row is the exact delta that was applied to their satisfaction this
   * year — recorded in Society as the arithmetic ran, so the screen cannot
   * drift from the simulation it is describing.
   */
  private reasons(factors: FactionFactor[] | undefined): HTMLElement {
    if (!factors || factors.length === 0) {
      return el('div', { class: 'muted', style: { fontSize: '11px' }, text: 'Sem pressões notáveis.' });
    }
    const top = factors.slice(0, 5);
    return el('div', { class: 'faction-reasons', style: { marginTop: '6px' } },
      top.map(f => {
        const jump = this.evidenceFor(f);
        return el('div', {
          class: jump ? 'row-link' : '',
          title: jump ? 'Ver de onde vem esta pressão' : '',
          style: {
            display: 'flex', justifyContent: 'space-between',
            fontSize: '11px', lineHeight: '1.5',
            color: f.delta >= 0 ? '#4ade80' : '#f87171'
          },
          on: jump ? { click: jump } : undefined
        }, [
          el('span', { text: jump ? `${f.label} ›` : f.label, style: { color: '#94a3b8' } }),
          el('span', { text: `${f.delta >= 0 ? '+' : ''}${Math.round(f.delta * 100)}` })
        ]);
      })
    );
  }

  /**
   * Turns a pressure recorded by the simulation into the screen that shows the
   * evidence for it. Factors without a source are self-explanatory (taxes, war)
   * and stay plain text.
   */
  private evidenceFor(factor: FactionFactor): (() => void) | null {
    const source = factor.source;
    if (!source || !this.ctx) return null;
    const ctx = this.ctx;
    switch (source.kind) {
      case 'good': return () => ctx.screens.open('economy', { good: source.good });
      case 'jobs': return () => ctx.screens.open('economy', { tab: 'cities' });
      case 'trade': return () => ctx.screens.open('economy', { tab: 'trade' });
    }
  }

  private statTile(label: string, value: string): HTMLElement {
    return el('div', { class: 'r-stat' }, [
      el('span', { text: label }),
      el('strong', { class: 'highlight-gold', text: value })
    ]);
  }
}
