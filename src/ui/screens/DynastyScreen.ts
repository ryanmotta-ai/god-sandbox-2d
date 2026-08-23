import { el } from '../core/Dom';
import type { Screen } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';
import type { BuildingType } from '../../civ/Building';

/** The four Great Wonders, as they actually stand in the world right now. */
const WONDERS: { type: BuildingType; icon: string; name: string }[] = [
  { type: 'monument' as BuildingType, icon: '🗿', name: 'Estátua do Fundador' },
  { type: 'great_library' as BuildingType, icon: '📚', name: 'Grande Biblioteca' },
  { type: 'grand_aqueduct' as BuildingType, icon: '🌊', name: 'Grande Aqueduto' },
  { type: 'colosseum' as BuildingType, icon: '🏛️', name: 'Grande Coliseu' }
];

function wonderStatuses(ctx: GameContext): { icon: string; name: string; status: string; built: boolean }[] {
  return WONDERS.map(wonder => {
    let standing = 0;
    let building = 0;
    let ruined = 0;
    for (const city of ctx.sim.cities.values()) {
      for (const b of city.buildings.values()) {
        if (b.type !== wonder.type) continue;
        if (b.lifecycleState === 'ruin') ruined++;
        else if (b.isOperational()) standing++;
        else building++;
      }
    }
    const status = standing > 0
      ? standing > 1 ? `${standing} construídas` : 'Construído'
      : building > 0 ? 'Em Obras'
      : ruined > 0 ? 'Em Ruínas'
      : 'Não construído';
    return { icon: wonder.icon, name: wonder.name, status, built: standing > 0 };
  });
}

export class DynastyScreen implements Screen {
  public readonly id = 'dynasty' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  public build(ctx: GameContext): HTMLElement {
    const kingdoms = Array.from(ctx.sim.kingdoms.values());
    const greatPersons = ctx.sim.entities.filter(e => e.isGreatPerson);
    // Wonders standing, counted from the world. This used to be
    // `max(1, greatPersons.length)` — the number of Great People, floored at one,
    // reported to the player as a count of structures. A realm with six great
    // citizens and no wonders was told it had six.
    const wonders = wonderStatuses(ctx);
    const totalWonders = wonders.filter(w => w.built).length;

    return el('div', { class: 'screen-container glass-panel dynasty-gameawards-container' }, [
      // Top Bar & Title Header
      el('div', { class: 'screen-header dynasty-header-hero' }, [
        el('div', { class: 'header-hero-title' }, [
          el('span', { class: 'hero-icon', text: '👑' }),
          el('div', {}, [
            el('h2', { class: 'purple-gold-gradient-text', text: 'Dinastias Reais, Nobreza & Panteão de Grandes Figuras' }),
            el('p', { class: 'hero-subtitle', text: 'Linhagens Monárquicas, Legado de Eruditos, Construtores, Heróis e Grandes Maravilhas' })
          ])
        ]),
        el('button', { class: 'close-btn-hero', text: '✕', on: { click: () => ctx.screens.back() } })
      ]),

      el('div', { class: 'screen-body dynasty-hero-body' }, [
        // METRICS BANNER (4 Hero Cards)
        el('div', { class: 'dynasty-metrics-banner-hero' }, [
          el('div', { class: 'dy-metric-card' }, [
            el('span', { class: 'dy-metric-icon', text: '👑' }),
            el('div', {}, [
              el('span', { class: 'dy-metric-lbl', text: 'Dinastias Reais Ativas' }),
              el('div', { class: 'dy-metric-val highlight-gold', text: `${kingdoms.length} Dinastias` })
            ])
          ]),
          el('div', { class: 'dy-metric-card' }, [
            el('span', { class: 'dy-metric-icon', text: '🌟' }),
            el('div', {}, [
              el('span', { class: 'dy-metric-lbl', text: 'Grandes Figuras no Mundo' }),
              el('div', { class: 'dy-metric-val highlight-purple', text: `${greatPersons.length} Ilustres` })
            ])
          ]),
          el('div', { class: 'dy-metric-card' }, [
            el('span', { class: 'dy-metric-icon', text: '🏛️' }),
            el('div', {}, [
              el('span', { class: 'dy-metric-lbl', text: 'Maravilhas & Monumentos' }),
              el('div', { class: 'dy-metric-val highlight-cyan', text: `${totalWonders} Estruturas` })
            ])
          ]),
          el('div', { class: 'dy-metric-card' }, [
            el('span', { class: 'dy-metric-icon', text: '📜' }),
            el('div', {}, [
              el('span', { class: 'dy-metric-lbl', text: 'Status das Linhagens' }),
              el('div', { class: 'dy-metric-val highlight-green', text: 'Nobreza Consolidada' })
            ])
          ])
        ]),

        // GRID: ROYAL SOVEREIGNS & GREAT PERSONS PANTHEON
        el('div', { class: 'dynasty-grid-layout' }, [
          // COLUMN 1: REIGNING SOVEREIGNS & DYNASTIES
          el('div', { class: 'dynasty-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: '👑 Tronos & Soberanos Vigentes' }),
              el('span', { class: 'badge-tag-purple', text: 'COROA IMPERIAL' })
            ]),

            el('div', { class: 'sovereigns-hero-list' },
              kingdoms.map(k => {
                const ruler = k.rulerId ? ctx.sim.entities.find(e => e.id === k.rulerId) : null;
                return el('div', { class: 'sovereign-hero-card', style: `border-left: 4px solid ${k.color}` }, [
                  el('div', { class: 'sov-head' }, [
                    el('div', { class: 'sov-title-group' }, [
                      el('span', { class: 'sov-crown', text: '👑' }),
                      el('div', {}, [
                        el('h4', { class: 'sov-name', text: ruler ? `${ruler.fullName}` : 'Trono Vago' }),
                        el('span', { class: 'sov-dynasty-name', text: `Dinastia ${k.dynasty ?? 'Ancestral'}` })
                      ])
                    ]),
                    el('span', { class: 'sov-realm-badge', style: `background: ${k.color}22; border: 1px solid ${k.color}`, text: k.name })
                  ]),
                  ruler ? el('div', { class: 'sov-stats-grid' }, [
                    el('div', { class: 's-stat' }, [el('span', { text: 'Idade' }), el('strong', { text: `${ruler.age} anos` })]),
                    el('div', { class: 's-stat' }, [el('span', { text: 'Nível / XP' }), el('strong', { class: 'highlight-gold', text: `Nível ${ruler.level}` })]),
                    el('div', { class: 's-stat' }, [el('span', { text: 'Legitimidade' }), el('strong', { class: 'highlight-green', text: `${(k.legitimacy * 100).toFixed(0)}%` })]),
                    el('button', {
                      class: 'btn-inspect-dynasty-tree',
                      style: 'grid-column: span 3; margin-top: 6px; padding: 4px 8px; background: rgba(168,85,247,0.2); border: 1px solid #a855f7; color: #e9d5ff; border-radius: 6px; cursor: pointer; font-size: 11px;',
                      text: '🌳 Ver Árvore Genealógica Imperial',
                      on: {
                        click: () => {
                          // `inspector.inspectEntity` does not exist and never
                          // did — `?.` guards a nullish inspector, not a missing
                          // method, so every click on this button threw
                          // "inspectEntity is not a function" and the family tree
                          // was unreachable from the dynasty screen. Selecting the
                          // sovereign and focusing the camera is what the rest of
                          // the UI does, and what the inspector actually reacts to.
                          ctx.screens.closeAll();
                          ctx.selection.select({ kind: 'citizen', id: ruler.id });
                          ctx.focusOn(ruler.x, ruler.y);
                        }
                      }
                    })
                  ]) : el('p', { class: 'desc-text-sm', text: 'O conselho de nobres está em busca de um herdeiro legítimo.' })
                ]);
              })
            )
          ]),

          // COLUMN 2: PANTHEON OF GREAT PERSONS
          el('div', { class: 'dynasty-col glass-card-hero' }, [
            el('div', { class: 'card-hero-header' }, [
              el('h3', { text: `🌟 Panteão de Grandes Figuras (${greatPersons.length})` }),
              el('span', { class: 'badge-tag-gold', text: 'NOTÁVEIS DO MUNDO' })
            ]),

            greatPersons.length > 0 ? el('div', { class: 'great-persons-hero-grid' },
              greatPersons.map(gp => {
                const icon = gp.greatPersonType === 'scholar' ? '🎓' : gp.greatPersonType === 'builder' ? '🔨' : gp.greatPersonType === 'hero' ? '⚔️' : '📜';
                const roleName = gp.greatPersonType === 'scholar' ? 'Erudito Ilustre' : gp.greatPersonType === 'builder' ? 'Mestre Construtor' : gp.greatPersonType === 'hero' ? 'Herói de Guerra' : 'Grão-Diplomata';
                return el('div', { class: 'gp-hero-card' }, [
                  el('div', { class: 'gp-head' }, [
                    el('span', { class: 'gp-icon', text: icon }),
                    el('div', {}, [
                      el('h4', { class: 'gp-title', text: gp.title ?? gp.name }),
                      el('span', { class: 'gp-role', text: roleName })
                    ])
                  ]),
                  el('div', { class: 'gp-info-row' }, [
                    el('span', { text: `Idade: ${gp.age}a` }),
                    el('span', { text: `Nível: ${gp.level}` }),
                    el('span', { class: 'highlight-gold', text: '🌟 Aurea Real' })
                  ])
                ]);
              })
            ) : el('div', { class: 'empty-pantheon-box' }, [
              el('span', { class: 'empty-icon', text: '📜' }),
              el('h4', { text: 'Nenhuma Grande Figura Emergiu Ainda' }),
              el('p', { text: 'À medida que as academias, batalhas e grandes obras progredirem, cidadãos notáveis ascenderão ao Panteão.' })
            ]),

            el('hr', { class: 'hero-divider' }),

            // WONDERS & MONUMENTS GALLERY
            //
            // Read from the world. These four chips used to be static DOM with
            // hardcoded statuses — "Construído", "Em Obras", "Planejado" — so the
            // screen reported the same four wonders in the same three states in
            // every game ever played, whether or not a single one existed. A
            // player who had just finished the Great Library was told it was
            // still under construction.
            el('div', { class: 'wonders-gallery-box' }, [
              el('h4', { text: '🗿 Maravilhas & Monumentos Históricos' }),
              el('div', { class: 'wonders-chips-grid' }, wonders.map(w =>
                el('div', { class: 'wonder-chip' }, [
                  el('span', { text: `${w.icon} ${w.name}` }),
                  el('strong', { class: w.built ? 'highlight-green' : undefined, text: w.status })
                ])
              ))
            ])
          ])
        ])
      ])
    ]);
  }
}
