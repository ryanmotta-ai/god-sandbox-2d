import { el, clear, button, statRow, meter, badge, emptyState, formatNumber, hexAlpha } from '../core/Dom';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import { City } from '../../civ/City';
import { cultureSummary, dominantCultureTraits } from '../../civ/Culture';
import { SOCIAL_FACTIONS, societySummary, topSocialFactions, restlessSocialFactions } from '../../civ/Society';
import { LAWS, activeLawDefinitions, lawSummary } from '../../civ/Laws';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';
import type { KingdomRanking } from '../core/StatsTracker';

type SortKey = 'power' | 'population' | 'cities' | 'territory' | 'age';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'power', label: 'Poder militar' },
  { key: 'population', label: 'População' },
  { key: 'cities', label: 'Cidades' },
  { key: 'territory', label: 'Território' },
  { key: 'age', label: 'Mais antigo' }
];

/** Realm browser: every kingdom on the left, full dossier on the right. */
export class KingdomsScreen implements Screen {
  public readonly id = 'kingdoms' as const;
  public readonly kind = 'fullscreen' as const;
  public readonly dismissable = true;

  private ctx!: GameContext;
  private listEl!: HTMLElement;
  private detailEl!: HTMLElement;
  private selectedId: string | null = null;
  private sortKey: SortKey = 'power';

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;
    // Only a fresh navigation retargets the selection. Coming back from a screen
    // this one linked to should land on the realm the player was reading.
    if (params?.focusKingdom) this.selectedId = params.focusKingdom;

    this.listEl = el('div', { class: 'realm-list' });
    this.detailEl = el('div', { class: 'realm-detail' });

    const sortSelect = el('select', {
      class: 'select-input',
      on: {
        change: (ev: Event) => {
          this.sortKey = (ev.target as HTMLSelectElement).value as SortKey;
          this.renderList();
        }
      }
    }, SORTS.map(s => el('option', { attrs: { value: s.key }, text: s.label }))) as HTMLSelectElement;

    const layout = el('div', { class: 'browser-screen' }, [
      el('header', { class: 'screen-head' }, [
        el('div', {}, [
          el('h2', { class: 'screen-title', text: '👑 Reinos de Aethoria' }),
          el('p', { class: 'screen-sub', text: `${ctx.sim.kingdoms.size} reinos · ${ctx.sim.cities.size} assentamentos · ano ${ctx.sim.currentYear}` })
        ]),
        el('div', { class: 'head-actions' }, [
          el('label', { class: 'inline-field' }, [el('span', { text: 'Ordenar por' }), sortSelect]),
          button('Fechar', () => ctx.screens.back(), { icon: '✕', hint: 'Esc' })
        ])
      ]),
      el('div', { class: 'browser-body' }, [this.listEl, this.detailEl])
    ]);

    this.renderList();
    return layout;
  }

  public tick(): void {
    // Live data — the detail pane is cheap enough to leave static until reselected.
  }

  private rankings(): KingdomRanking[] {
    const list = this.ctx.stats.kingdomRankings(this.ctx.sim);
    if (this.sortKey === 'age') {
      return list.sort((a, b) => {
        const ka = this.ctx.sim.kingdoms.get(a.id)!;
        const kb = this.ctx.sim.kingdoms.get(b.id)!;
        return ka.foundingYear - kb.foundingYear;
      });
    }
    const key = this.sortKey as Exclude<SortKey, 'age'>;
    return list.sort((a, b) => b[key] - a[key]);
  }

  private renderList(): void {
    clear(this.listEl);
    const ranked = this.rankings();

    if (ranked.length === 0) {
      this.listEl.appendChild(emptyState('🏳️', 'Nenhum reino ainda', 'Assentamentos devem crescer antes que um reino seja proclamado.'));
      clear(this.detailEl);
      this.detailEl.appendChild(emptyState('👑', 'Nada a inspecionar', 'Gere alguns humanoides e deixe o mundo rodar.'));
      return;
    }

    if (!this.selectedId || !this.ctx.sim.kingdoms.has(this.selectedId)) {
      this.selectedId = ranked[0].id;
    }

    const maxPower = Math.max(1, ...ranked.map(r => r.power));

    ranked.forEach((rank, index) => {
      const kingdom = this.ctx.sim.kingdoms.get(rank.id)!;
      const atWar = this.ctx.sim.diplomacy.getWarsFor(rank.id).length > 0;

      const row = el('button', {
        class: `realm-row${this.selectedId === rank.id ? ' selected' : ''}`,
        style: { '--realm-color': kingdom.color } as any,
        on: {
          click: () => {
            this.selectedId = rank.id;
            this.renderList();
          }
        }
      }, [
        el('span', { class: 'realm-rank', text: `#${index + 1}` }),
        el('span', { class: 'realm-emblem', style: { background: hexAlpha(kingdom.color, 0.25), borderColor: kingdom.color }, text: kingdom.emblem }),
        el('div', { class: 'realm-row-main' }, [
          el('div', { class: 'realm-row-title' }, [
            el('span', { class: 'realm-name', text: kingdom.name }),
            atWar ? el('span', { class: 'war-flag', text: '⚔️', title: 'Em guerra' }) : null
          ].filter(Boolean) as HTMLElement[]),
          el('span', { class: 'realm-row-meta', text: `${SPECIES_DEFINITIONS[kingdom.species].name} · 👥 ${formatNumber(rank.population)} · 🏛️ ${rank.cities}` }),
          el('div', { class: 'realm-power' }, [
            el('div', { class: 'realm-power-fill', style: { width: `${(rank.power / maxPower) * 100}%`, background: kingdom.color } })
          ])
        ])
      ]);

      this.listEl.appendChild(row);
    });

    this.renderDetail();
  }

  private renderDetail(): void {
    clear(this.detailEl);
    if (!this.selectedId) return;

    const kingdom = this.ctx.sim.kingdoms.get(this.selectedId);
    if (!kingdom) return;

    const ranking = this.ctx.stats.kingdomRankings(this.ctx.sim).find(r => r.id === kingdom.id);
    const cities = Array.from(kingdom.cityIds)
      .map(id => this.ctx.sim.cities.get(id))
      .filter((c): c is City => !!c);
    const subjects = this.ctx.sim.entities.filter(e => e.kingdomId === kingdom.id);
    const ruler = kingdom.rulerId ? this.ctx.sim.entities.find(e => e.id === kingdom.rulerId) : null;
    const wars = this.ctx.sim.diplomacy.getWarsFor(kingdom.id);
    const config = SPECIES_DEFINITIONS[kingdom.species];

    // Profession composition of the population
    const professions = new Map<string, number>();
    for (const s of subjects) professions.set(s.profession, (professions.get(s.profession) ?? 0) + 1);

    const avgLevel = subjects.length
      ? subjects.reduce((sum, s) => sum + s.level, 0) / subjects.length
      : 0;

    this.detailEl.appendChild(
      el('div', { class: 'realm-hero', style: { background: `linear-gradient(135deg, ${hexAlpha(kingdom.color, 0.85)}, ${hexAlpha(kingdom.secondaryColor, 0.6)})` } }, [
        el('span', { class: 'hero-emblem', text: kingdom.emblem }),
        el('div', {}, [
          el('h3', { class: 'hero-name', text: kingdom.name }),
          el('p', { class: 'hero-sub', text: `Reino ${config.name} · fundado no ano ${kingdom.foundingYear} · ${this.ctx.sim.currentYear - kingdom.foundingYear} anos de idade` })
        ])
      ])
    );

    this.detailEl.appendChild(
      el('div', { class: 'stat-grid cols-4' }, [
        this.tile('⚔️', 'Poder', formatNumber(ranking?.power ?? 0)),
        this.tile('👥', 'Súditos', formatNumber(subjects.length)),
        this.tile('🏛️', 'Cidades', `${cities.length}`),
        this.tile('🗺️', 'Território', formatNumber(ranking?.territory ?? 0))
      ])
    );

    this.detailEl.appendChild(
      el('section', { class: 'detail-block' }, [
        el('h4', { class: 'block-title', text: 'Coroa' }),
        el('div', { class: 'stat-list' }, [
          statRow('Governante', ruler ? `👑 ${ruler.name} (Nvl ${ruler.level})` : 'Trono vago', ruler ? '#fbbf24' : undefined),
          statRow('Capital', this.ctx.sim.cities.get(kingdom.capitalCityId)?.name ?? 'Perdida'),
          statRow('Nível cultural', `${kingdom.cultureLevel}`),
          statRow('Tesouro', formatNumber(kingdom.wealth)),
          statRow('Nível médio dos súditos', avgLevel.toFixed(1))
        ])
      ])
    );

    this.detailEl.appendChild(
      el('section', { class: 'detail-block' }, [
        el('h4', { class: 'block-title', text: 'Cultura' }),
        el('div', { class: 'stat-list' }, [
          statRow('Identidade', cultureSummary(kingdom.culture)),
          statRow('Memória viva', kingdom.culture.memories[0]?.label ?? 'Nenhuma memória marcante')
        ]),
        el('div', { class: 'chip-row' },
          dominantCultureTraits(kingdom.culture, 5).map(trait => badge(trait, kingdom.color))
        ),
        meter('Militarismo', kingdom.culture.militarism, 1, '#ef4444', `${Math.round(kingdom.culture.militarism * 100)}%`),
        meter('Abertura', kingdom.culture.openness, 1, '#38bdf8', `${Math.round(kingdom.culture.openness * 100)}%`),
        meter('Mercantilismo', kingdom.culture.mercantilism, 1, '#f59e0b', `${Math.round(kingdom.culture.mercantilism * 100)}%`),
        meter('Trauma de guerra', kingdom.culture.warTrauma, 1, '#a855f7', `${Math.round(kingdom.culture.warTrauma * 100)}%`)
      ])
    );

    const topFactions = topSocialFactions(kingdom.society, 4);
    const restlessFactions = restlessSocialFactions(kingdom.society, 2)
      .filter(f => f.radicalization > 0.18)
      .map(f => SOCIAL_FACTIONS[f.id].shortName)
      .join(', ');

    this.detailEl.appendChild(
      el('section', { class: 'detail-block' }, [
        el('h4', { class: 'block-title', text: 'Facções Sociais' }),
        el('div', { class: 'stat-list' }, [
          statRow('Equilíbrio', societySummary(kingdom.society)),
          statRow('Facção dominante', SOCIAL_FACTIONS[kingdom.society.dominantFaction].name),
          statRow('Grupos inquietos', restlessFactions || 'Nenhum organizado')
        ]),
        meter('Coesão social', kingdom.society.cohesion, 1, '#22c55e', `${Math.round(kingdom.society.cohesion * 100)}%`),
        meter('Pressão reformista', kingdom.society.reformPressure, 1, '#38bdf8', `${Math.round(kingdom.society.reformPressure * 100)}%`),
        meter('Risco de revolta', kingdom.society.revoltRisk, 1, '#ef4444', `${Math.round(kingdom.society.revoltRisk * 100)}%`),
        ...topFactions.map(f =>
          meter(SOCIAL_FACTIONS[f.id].shortName, f.influence, 1, SOCIAL_FACTIONS[f.id].color, `${Math.round(f.influence * 100)}% influência`)
        )
      ])
    );

    const activeLaws = activeLawDefinitions(kingdom.laws);
    const latestLaw = kingdom.laws.history[0];
    this.detailEl.appendChild(
      el('section', { class: 'detail-block' }, [
        el('h4', { class: 'block-title', text: 'Leis e Reformas' }),
        el('div', { class: 'stat-list' }, [
          statRow('Ordem jurídica', lawSummary(kingdom.laws)),
          statRow('Impulso reformista', `${Math.round(kingdom.laws.reformMomentum * 100)}%`),
          statRow('Última reforma', latestLaw ? `Ano ${latestLaw.year}: ${LAWS[latestLaw.from].shortName} -> ${LAWS[latestLaw.to].shortName}` : 'Nenhuma reforma importante')
        ]),
        meter('Prontidão para reforma', kingdom.laws.reformMomentum, 1, '#22c55e', `${Math.round(kingdom.laws.reformMomentum * 100)}%`),
        el('div', { class: 'chip-row' },
          activeLaws.map(law => badge(`${law.shortName}`, kingdom.color))
        )
      ])
    );

    if (cities.length) {
      this.detailEl.appendChild(
        el('section', { class: 'detail-block' }, [
          el('h4', { class: 'block-title', text: `Assentamentos (${cities.length})` }),
          el('div', { class: 'city-cards' },
            cities
              .sort((a, b) => b.population - a.population)
              .map(city =>
                el('button', {
                  class: 'city-card',
                  on: {
                    click: () => {
                      this.ctx.focusOn(city.x, city.y, 1.6);
                      this.ctx.screens.closeAll();
                      this.ctx.toast(`Vendo ${city.name}`, 'info');
                    }
                  }
                }, [
                  el('span', { class: 'city-name', text: city.id === kingdom.capitalCityId ? `⭐ ${city.name}` : city.name }),
                  el('span', { class: 'city-meta', text: `👥 ${city.population} · 🏗️ ${city.buildings.size} · 🗺️ ${city.territory.size}` }),
                  el('div', { class: 'city-res' }, [
                    el('span', { text: `🌲${city.resources.wood}` }),
                    el('span', { text: `🪨${city.resources.stone}` }),
                    el('span', { text: `🌾${city.resources.food}` }),
                    el('span', { text: `🪙${city.resources.gold}` })
                  ])
                ])
              )
          )
        ])
      );
    }

    this.detailEl.appendChild(
      el('section', { class: 'detail-block' }, [
        el('h4', { class: 'block-title', text: 'População' }),
        el('div', { class: 'chip-row' },
          Array.from(professions.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([prof, count]) => badge(`${prof} ×${count}`, '#94a3b8'))
        )
      ])
    );

    this.detailEl.appendChild(
      el('section', { class: 'detail-block' }, [
        el('h4', { class: 'block-title', text: wars.length ? `Guerras (${wars.length})` : 'Guerras' }),
        wars.length
          ? el('div', { class: 'war-list' },
              wars.map(war => {
                const enemyId = war.attacker === kingdom.id ? war.defender : war.attacker;
                const enemy = this.ctx.sim.kingdoms.get(enemyId);
                const isAttacker = war.attacker === kingdom.id;
                const own = isAttacker ? war.attackerKills : war.defenderKills;
                const theirs = isAttacker ? war.defenderKills : war.attackerKills;
                return el('div', { class: 'war-row' }, [
                  el('div', { class: 'war-row-head' }, [
                    el('span', { class: 'war-title', text: `vs ${enemy?.name ?? 'Reino desconhecido'}` }),
                    badge(isAttacker ? 'Agressor' : 'Defensor', isAttacker ? '#ef4444' : '#38bdf8')
                  ]),
                  el('p', { class: 'war-meta', text: `${war.reason} · desde o ano ${war.startYear} · ${war.battles} batalhas` }),
                  meter('Proporção de baixas', own, Math.max(1, own + theirs), kingdom.color, `${own} : ${theirs}`)
                ]);
              })
            )
          : el('p', { class: 'muted small', text: 'Este reino está em paz.' })
      ])
    );

    this.detailEl.appendChild(
      el('div', { class: 'action-row' }, [
        button('Ver no mapa', () => {
          const capital = this.ctx.sim.cities.get(kingdom.capitalCityId) ?? cities[0];
          if (capital) {
            this.ctx.focusOn(capital.x, capital.y, 1.4);
            this.ctx.screens.closeAll();
          }
        }, { variant: 'primary', icon: '🎥' }),
        button('Diplomacia', () => this.ctx.screens.open('diplomacy', { focusKingdom: kingdom.id }), { icon: '🤝' }),
        button('Economia', () => this.ctx.screens.open('economy', { tab: 'realms', focusKingdom: kingdom.id }), { icon: '🪙' }),
        button('Infraestrutura', () => this.ctx.screens.open('infrastructure', { tab: 'overview' }), { icon: '🛤️' })
      ])
    );
  }

  private tile(icon: string, label: string, value: string): HTMLElement {
    return el('div', { class: 'stat-tile' }, [
      el('span', { class: 'tile-icon', text: icon }),
      el('span', { class: 'tile-value', text: value }),
      el('span', { class: 'tile-label', text: label })
    ]);
  }
}
