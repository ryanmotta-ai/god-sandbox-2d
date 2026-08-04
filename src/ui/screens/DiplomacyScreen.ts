import { el, clear, button, badge, emptyState, hexAlpha, formatNumber } from '../core/Dom';
import { DiplomaticStatus } from '../../civ/Diplomacy';
import { Kingdom } from '../../civ/Kingdom';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

const STATUS_STYLE: Record<DiplomaticStatus, { label: string; color: string; icon: string }> = {
  war: { label: 'War', color: '#ef4444', icon: '⚔️' },
  hostile: { label: 'Hostile', color: '#f97316', icon: '😠' },
  neutral: { label: 'Neutral', color: '#64748b', icon: '➖' },
  friendly: { label: 'Friendly', color: '#34d399', icon: '🙂' },
  alliance: { label: 'Alliance', color: '#38bdf8', icon: '🤝' }
};

/**
 * Relations matrix, active wars and alliances — plus divine intervention buttons
 * to force war or peace between any two realms.
 */
export class DiplomacyScreen implements Screen {
  public readonly id = 'diplomacy' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private ctx!: GameContext;
  private bodyEl!: HTMLElement;
  private focusKingdom: string | null = null;
  /** The other half of a pair, when a link named both sides of a relationship. */
  private withKingdom: string | null = null;

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;
    if (params) {
      this.focusKingdom = params.focusKingdom ?? null;
      this.withKingdom = params.withKingdom ?? null;
    }
    this.bodyEl = el('div', { class: 'diplo-body' });

    const layout = el('div', { class: 'screen-panel' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '🤝 Diplomacy' }),
          el('p', { class: 'screen-sub', text: 'Relations, wars and alliances between every realm.' })
        ]),
        button('Close', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
      ]),
      this.bodyEl
    ]);

    this.render();
    return layout;
  }

  private render(): void {
    clear(this.bodyEl);
    const kingdoms = Array.from(this.ctx.sim.kingdoms.values());

    if (kingdoms.length === 0) {
      this.bodyEl.appendChild(emptyState('🏳️', 'No realms exist', 'Diplomacy begins once at least one kingdom is proclaimed.'));
      return;
    }

    this.bodyEl.appendChild(this.summaryStrip(kingdoms));

    if (kingdoms.length < 2) {
      this.bodyEl.appendChild(
        emptyState('🕊️', 'Only one realm stands', 'There is no one left to negotiate with — yet.')
      );
    } else {
      this.bodyEl.appendChild(this.matrix(kingdoms));
      this.bodyEl.appendChild(this.interventionPanel(kingdoms));
    }

    this.bodyEl.appendChild(this.warsPanel());
    this.bodyEl.appendChild(this.alliancesPanel());
    this.bodyEl.appendChild(this.warHistoryPanel());
  }

  private summaryStrip(kingdoms: Kingdom[]): HTMLElement {
    const diplomacy = this.ctx.sim.diplomacy;
    let hostilePairs = 0;
    let friendlyPairs = 0;
    for (let i = 0; i < kingdoms.length; i++) {
      for (let j = i + 1; j < kingdoms.length; j++) {
        const status = diplomacy.getStatus(kingdoms[i].id, kingdoms[j].id);
        if (status === 'hostile' || status === 'war') hostilePairs++;
        if (status === 'friendly' || status === 'alliance') friendlyPairs++;
      }
    }

    return el('div', { class: 'stat-grid cols-4' }, [
      this.tile('👑', 'Realms', `${kingdoms.length}`),
      this.tile('⚔️', 'Active wars', `${diplomacy.activeWars.size}`),
      this.tile('🤝', 'Alliances', `${diplomacy.alliances.size}`),
      this.tile('📈', 'Tensions', `${hostilePairs} hostile / ${friendlyPairs} warm`)
    ]);
  }

  private matrix(kingdoms: Kingdom[]): HTMLElement {
    const diplomacy = this.ctx.sim.diplomacy;

    const header = el('div', { class: 'matrix-row matrix-header' }, [
      el('div', { class: 'matrix-corner', text: '' }),
      ...kingdoms.map(k =>
        el('div', { class: 'matrix-col-head', title: k.name, style: { color: k.color } }, [
          el('span', { class: 'matrix-emblem', text: k.emblem })
        ])
      )
    ]);

    const rows = kingdoms.map(rowKingdom => {
      const cells = kingdoms.map(colKingdom => {
        if (rowKingdom.id === colKingdom.id) {
          return el('div', { class: 'matrix-cell self', text: '—' });
        }
        const status = diplomacy.getStatus(rowKingdom.id, colKingdom.id);
        const relation = diplomacy.getRelation(rowKingdom.id, colKingdom.id);
        const style = STATUS_STYLE[status];

        return el('div', {
          class: 'matrix-cell',
          title: `${rowKingdom.name} → ${colKingdom.name}: ${style.label} (${Math.round(relation)})`,
          style: { background: hexAlpha(style.color, 0.18), borderColor: hexAlpha(style.color, 0.5), color: style.color },
          text: `${Math.round(relation)}`
        });
      });

      return el('div', {
        class: `matrix-row${this.focusKingdom === rowKingdom.id ? ' focused' : ''}`
      }, [
        el('div', { class: 'matrix-row-head', style: { color: rowKingdom.color } }, [
          el('span', { class: 'matrix-emblem', text: rowKingdom.emblem }),
          el('span', { class: 'matrix-name', text: rowKingdom.name })
        ]),
        ...cells
      ]);
    });

    return el('section', { class: 'panel' }, [
      el('header', { class: 'panel-head' }, [
        el('h3', { class: 'panel-title', text: 'Relations Matrix' }),
        el('p', { class: 'panel-sub', text: 'Values run from −100 (blood feud) to +100 (sworn allies).' })
      ]),
      el('div', { class: 'panel-body' }, [
        el('div', { class: 'matrix-scroll' }, [el('div', { class: 'matrix' }, [header, ...rows])]),
        el('div', { class: 'matrix-legend' },
          (Object.keys(STATUS_STYLE) as DiplomaticStatus[]).map(key =>
            el('span', { class: 'legend-item' }, [
              el('i', { class: 'legend-swatch', style: { background: STATUS_STYLE[key].color } }),
              el('span', { text: `${STATUS_STYLE[key].icon} ${STATUS_STYLE[key].label}` })
            ])
          )
        )
      ])
    ]);
  }

  private interventionPanel(kingdoms: Kingdom[]): HTMLElement {
    const options = (selected?: string) =>
      kingdoms.map(k => el('option', { attrs: { value: k.id, ...(selected === k.id ? { selected: 'true' } : {}) }, text: k.name }));

    // Both selects are preloaded when a link named a pair, so an embargo or a war
    // opens on exactly the two realms the player clicked.
    const selectA = el('select', { class: 'select-input' }, options(this.focusKingdom ?? kingdoms[0].id)) as HTMLSelectElement;
    const defaultB = this.withKingdom ?? kingdoms.find(k => k.id !== (this.focusKingdom ?? kingdoms[0].id))?.id;
    const selectB = el('select', { class: 'select-input' }, options(defaultB)) as HTMLSelectElement;

    const act = (fn: (a: string, b: string) => void) => () => {
      const a = selectA.value;
      const b = selectB.value;
      if (a === b) {
        this.ctx.toast('Pick two different realms', 'warning');
        return;
      }
      fn(a, b);
      this.render();
    };

    return el('section', { class: 'panel' }, [
      el('header', { class: 'panel-head' }, [
        el('h3', { class: 'panel-title', text: 'Divine Intervention' }),
        el('p', { class: 'panel-sub', text: 'Bend the will of nations directly.' })
      ]),
      el('div', { class: 'panel-body' }, [
        el('div', { class: 'intervention-row' }, [
          selectA,
          el('span', { class: 'intervention-arrow', text: '⇄' }),
          selectB
        ]),
        el('div', { class: 'action-row' }, [
          // The warStarted / warEnded / allianceFormed events already raise a toast,
          // so these handlers only report the cases where nothing happened.
          button('Declare war', act((a, b) => {
            if (!this.ctx.sim.diplomacy.declareWar(a, b, this.ctx.sim.currentYear, 'Divine Provocation')) {
              this.ctx.toast('They are already at war', 'warning');
            }
          }), { variant: 'danger', icon: '⚔️' }),
          button('Force peace', act((a, b) => {
            if (this.ctx.sim.diplomacy.isAtWar(a, b)) {
              this.ctx.sim.diplomacy.endWar(a, b, this.ctx.sim.currentYear);
            } else {
              this.ctx.toast('These realms are not at war', 'warning');
            }
          }), { icon: '🕊️' }),
          button('Forge alliance', act((a, b) => {
            const alliance = this.ctx.sim.diplomacy.createAlliance(a, b, `Divine Pact of ${this.ctx.sim.currentYear}`, this.ctx.sim.currentYear);
            if (!alliance) this.ctx.toast('Cannot ally realms that are at war', 'warning');
          }), { icon: '🤝' }),
          button('Sow discord', act((a, b) => {
            this.ctx.sim.diplomacy.changeRelation(a, b, -35);
            this.ctx.toast('Suspicion spreads between the realms', 'divine');
          }), { icon: '🐍' })
        ])
      ])
    ]);
  }

  private warsPanel(): HTMLElement {
    const wars = Array.from(this.ctx.sim.diplomacy.activeWars.values());

    return el('section', { class: 'panel' }, [
      el('header', { class: 'panel-head' }, [
        el('h3', { class: 'panel-title', text: `Active Wars (${wars.length})` })
      ]),
      el('div', { class: 'panel-body' }, [
        wars.length
          ? el('div', { class: 'war-cards' },
              wars.map(war => {
                const attacker = this.ctx.sim.kingdoms.get(war.attacker);
                const defender = this.ctx.sim.kingdoms.get(war.defender);
                const total = Math.max(1, war.attackerKills + war.defenderKills);
                return el('div', { class: 'war-card' }, [
                  el('div', { class: 'war-card-head' }, [
                    el('span', { class: 'war-side', style: { color: attacker?.color }, text: attacker?.name ?? 'Unknown' }),
                    el('span', { class: 'war-vs', text: '⚔️' }),
                    el('span', { class: 'war-side', style: { color: defender?.color }, text: defender?.name ?? 'Unknown' })
                  ]),
                  el('p', { class: 'war-meta', text: `${war.reason} · began year ${war.startYear} · ${this.ctx.sim.currentYear - war.startYear} yrs · ${war.battles} battles` }),
                  el('div', { class: 'war-bar' }, [
                    el('div', { class: 'war-bar-a', style: { width: `${(war.attackerKills / total) * 100}%`, background: attacker?.color ?? '#ef4444' } }),
                    el('div', { class: 'war-bar-b', style: { width: `${(war.defenderKills / total) * 100}%`, background: defender?.color ?? '#38bdf8' } })
                  ]),
                  el('div', { class: 'war-kills' }, [
                    el('span', { text: `${war.attackerKills} kills` }),
                    el('span', { text: `${war.defenderKills} kills` })
                  ])
                ]);
              })
            )
          : el('p', { class: 'muted small', text: 'The world is at peace. For now.' })
      ])
    ]);
  }

  private alliancesPanel(): HTMLElement {
    const alliances = Array.from(this.ctx.sim.diplomacy.alliances.values());

    return el('section', { class: 'panel' }, [
      el('header', { class: 'panel-head' }, [
        el('h3', { class: 'panel-title', text: `Alliances (${alliances.length})` })
      ]),
      el('div', { class: 'panel-body' }, [
        alliances.length
          ? el('div', { class: 'alliance-list' },
              alliances.map(alliance =>
                el('div', { class: 'alliance-row' }, [
                  el('span', { class: 'alliance-name', text: `🤝 ${alliance.name}` }),
                  el('span', { class: 'alliance-year', text: `formed year ${alliance.formedYear}` }),
                  el('div', { class: 'chip-row' },
                    Array.from(alliance.members).map(id => {
                      const k = this.ctx.sim.kingdoms.get(id);
                      return badge(k?.name ?? 'Unknown', k?.color ?? '#94a3b8');
                    })
                  )
                ])
              )
            )
          : el('p', { class: 'muted small', text: 'No realms have sworn oaths to one another.' })
      ])
    ]);
  }

  private warHistoryPanel(): HTMLElement {
    const history = [...this.ctx.sim.diplomacy.warHistory].reverse().slice(0, 12);

    return el('section', { class: 'panel' }, [
      el('header', { class: 'panel-head' }, [
        el('h3', { class: 'panel-title', text: 'Concluded Wars' }),
        el('p', { class: 'panel-sub', text: `${this.ctx.sim.diplomacy.warHistory.length} wars have ended in total.` })
      ]),
      el('div', { class: 'panel-body' }, [
        history.length
          ? el('div', { class: 'history-list' },
              history.map(war => {
                const attacker = this.ctx.sim.kingdoms.get(war.attacker);
                const defender = this.ctx.sim.kingdoms.get(war.defender);
                return el('div', { class: 'history-row' }, [
                  el('span', { class: 'history-years', text: `${war.startYear}–${war.endYear}` }),
                  el('span', { class: 'history-text', text: `${attacker?.name ?? 'A fallen realm'} vs ${defender?.name ?? 'a fallen realm'} — ${war.reason}` }),
                  el('span', { class: 'history-meta', text: `${formatNumber(war.attackerKills + war.defenderKills)} dead` })
                ]);
              })
            )
          : el('p', { class: 'muted small', text: 'No war has yet been concluded.' })
      ])
    ]);
  }

  private tile(icon: string, label: string, value: string): HTMLElement {
    return el('div', { class: 'stat-tile' }, [
      el('span', { class: 'tile-icon', text: icon }),
      el('span', { class: 'tile-value', text: value }),
      el('span', { class: 'tile-label', text: label })
    ]);
  }
}
