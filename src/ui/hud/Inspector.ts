import { el, clear, statRow, meter, badge, button, titleCase, formatNumber, hexAlpha, emptyState } from '../core/Dom';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import { TRAIT_DEFINITIONS, TraitId } from '../../entities/Traits';
import { TERRAINS } from '../../world/Biomes';
import { Entity } from '../../entities/Entity';
import { SOCIAL_CLASSES, describeOrigin, isMigrant } from '../../entities/Identity';
import { GOODS } from '../../civ/Goods';
import { City } from '../../civ/City';
import { Kingdom } from '../../civ/Kingdom';
import { cultureSummary, dominantCultureTraits } from '../../civ/Culture';
import { SOCIAL_FACTIONS, societySummary, topSocialFactions } from '../../civ/Society';
import { activeLawDefinitions, lawSummary } from '../../civ/Laws';
import { Tile } from '../../world/Tile';
import { SpriteGenerator } from '../../renderer/SpriteGenerator';
import { getFamilyTreeData, isDeceasedRecord, FamilyMember } from '../../civ/Lineage';
import type { GameContext } from '../core/GameContext';

type Target =
  | { kind: 'entity'; id: string }
  | { kind: 'city'; id: string }
  | { kind: 'kingdom'; id: string }
  | { kind: 'tile'; x: number; y: number }
  | null;

const REFRESH_MS = 500;

/**
 * Right-hand inspection drawer. Unlike the old version it keeps a live target and
 * re-renders from the simulation, so HP/resources update while the world runs.
 */
export class Inspector {
  public readonly root: HTMLElement;
  private ctx: GameContext;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private target: Target = null;
  private lastRefresh = 0;

  constructor(ctx: GameContext) {
    this.ctx = ctx;

    this.titleEl = el('h3', { class: 'drawer-title', text: 'Inspector' });
    this.bodyEl = el('div', { class: 'drawer-body' });

    this.root = el('aside', { class: 'drawer hidden' }, [
      el('header', { class: 'drawer-head' }, [
        this.titleEl,
        el('button', { class: 'icon-close', text: '✕', title: 'Close (Esc)', on: { click: () => this.hide() } })
      ]),
      this.bodyEl
    ]);

    this.showPlaceholder();
  }

  public get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  public show(): void {
    this.root.classList.remove('hidden');
  }

  public hide(): void {
    this.root.classList.add('hidden');
    this.target = null;
  }

  public toggle(): void {
    this.isOpen ? this.hide() : this.show();
  }

  public inspectEntity(entity: Entity): void {
    this.target = { kind: 'entity', id: entity.id };
    this.show();
    this.render();
  }

  public inspectCity(city: City): void {
    this.target = { kind: 'city', id: city.id };
    this.show();
    this.render();
  }

  public inspectKingdom(kingdomId: string): void {
    this.target = { kind: 'kingdom', id: kingdomId };
    this.show();
    this.render();
  }

  public inspectTile(tile: Tile): void {
    this.target = { kind: 'tile', x: tile.x, y: tile.y };
    this.show();
    this.render();
  }

  public tick(now: number): void {
    if (!this.isOpen || !this.target) return;
    if (now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;
    this.render();
  }

  private showPlaceholder(): void {
    clear(this.bodyEl);
    this.bodyEl.appendChild(
      emptyState('🔍', 'Nenhum alvo selecionado', 'Selecione a ferramenta Inspecionar (7) e clique em uma criatura, cidade ou terreno.')
    );
  }

  private render(): void {
    if (!this.target) {
      this.titleEl.textContent = 'Painel de Inspeção';
      this.showPlaceholder();
      return;
    }

    clear(this.bodyEl);

    switch (this.target.kind) {
      case 'entity': return this.renderEntity(this.target.id);
      case 'city': return this.renderCity(this.target.id);
      case 'kingdom': return this.renderKingdom(this.target.id);
      case 'tile': return this.renderTile(this.target.x, this.target.y);
    }
  }

  // ============================ ENTITY ============================

  private renderEntity(id: string): void {
    const entity = this.ctx.sim.entities.find(e => e.id === id);
    if (!entity) {
      this.titleEl.textContent = 'Perdido na História';
      this.bodyEl.appendChild(emptyState('💀', 'Esta criatura faleceu', 'Sua história chegou ao fim. Selecione outro alvo.'));
      return;
    }

    const config = SPECIES_DEFINITIONS[entity.species];
    const city = entity.cityId ? this.ctx.sim.cities.get(entity.cityId) ?? null : null;
    const kingdom = entity.kingdomId ? this.ctx.sim.kingdoms.get(entity.kingdomId) ?? null : null;

    this.titleEl.textContent = `${entity.isFavorite ? '⭐ ' : ''}${entity.name}`;

    this.bodyEl.appendChild(
      el('div', { class: 'inspect-hero', style: { borderColor: hexAlpha(config.primaryColor, 0.4) } }, [
        this.spriteBox(`species_${entity.species}`, config.primaryColor),
        el('div', { class: 'inspect-hero-info' }, [
          el('div', { class: 'inspect-hero-name', text: config.name, style: { color: config.primaryColor } }),
          el('div', { class: 'inspect-hero-sub', text: `${titleCase(entity.profession)} · Nível ${entity.level}` }),
          el('div', { class: 'chip-row' }, [
            badge(entity.gender === 'male' ? '♂ Macho' : '♀ Fêmea', '#94a3b8'),
            badge(entity.lifeStageLabel, '#38bdf8'),
            badge(titleCase(entity.personality), '#a855f7'),
            badge(
              `${SOCIAL_CLASSES[entity.socialClass].icon} ${SOCIAL_CLASSES[entity.socialClass].label}`,
              SOCIAL_CLASSES[entity.socialClass].color
            )
          ])
        ])
      ])
    );

    if (config.advantage || config.disadvantage) {
      this.bodyEl.appendChild(
        el('div', { class: 'species-traits-box', style: { padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', margin: '8px 0', fontSize: '11px', lineHeight: '1.4' } }, [
          config.advantage ? el('div', { style: { color: '#4ade80', marginBottom: '3px' }, text: config.advantage }) : null,
          config.disadvantage ? el('div', { style: { color: '#f87171' }, text: config.disadvantage }) : null
        ].filter(Boolean) as HTMLElement[])
      );
    }

    this.bodyEl.appendChild(
      el('div', { class: 'meter-stack' }, [
        meter('Vida', entity.hp, entity.maxHp, hpColor(entity.hp / entity.maxHp), `${Math.max(0, Math.round(entity.hp))} / ${entity.maxHp}`),
        meter('Experiência', entity.xp, entity.level * 50, '#a855f7', `${entity.xp} / ${entity.level * 50}`),
        meter('Idade', entity.age, config.maxAge, '#38bdf8', `${entity.age} / ${config.maxAge} anos (${entity.lifeStageLabel})`)
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'stat-grid' }, [
        this.statTile('⚔️', 'Ataque', `${entity.damage}`),
        this.statTile('🛡️', 'Defesa', `${entity.defense}`),
        this.statTile('👟', 'Velocidade', entity.speed.toFixed(2)),
        this.statTile('💀', 'Abates', `${entity.kills}`),
        this.statTile('🪙', 'Riqueza', `${Math.round(entity.wealth)}`),
        this.statTile('⚡', 'Energia', `${Math.round(entity.energy)}`)
      ])
    );

    // ---- Needs: what this person actually feels right now ----
    this.bodyEl.appendChild(
      el('div', { class: 'meter-stack' }, [
        meter('Fome', 100 - entity.needs.hunger, 100, entity.needs.hunger > 70 ? '#ef4444' : entity.needs.hunger > 45 ? '#f59e0b' : '#4ade80',
          entity.needs.hunger > 85 ? 'Faminto' : entity.needs.hunger > 55 ? 'Com fome' : 'Alimentado'),
        meter('Energia', entity.energy, entity.maxEnergy, '#38bdf8', `${Math.round(entity.energy)} / ${entity.maxEnergy}`),
        meter('Conforto', entity.needs.comfort, 100, '#a855f7', `${Math.round(entity.needs.comfort)}`),
        meter('Segurança', entity.needs.safety, 100, '#22c55e', `${Math.round(entity.needs.safety)}`)
      ])
    );

    // ---- Household: the family purse and pantry ----
    const household = entity.householdId ? this.ctx.sim.households.get(entity.householdId) ?? null : null;
    if (household) {
      this.bodyEl.appendChild(
        el('div', { class: 'stat-list' }, [
          statRow('Domicílio', `${household.size} pessoa(s) sob o mesmo teto`),
          statRow('Bolsa da família', `🪙 ${Math.round(household.coin)}`),
          statRow('Despensa', `🍲 ${Math.round(household.pantry.get('food'))} / ${household.pantryTarget()}`,
            household.pantry.get('food') <= 0 ? '#ef4444' : undefined),
          statRow('Balanço do dia', `+${Math.round(household.lastEarned)} / -${Math.round(household.lastSpent)}`)
        ])
      );
    }

    if (entity.carrying) {
      this.bodyEl.appendChild(
        el('div', { class: 'stat-list' }, [
          statRow('Carregando', `📦 ${Math.round(entity.carrying.amount)} de ${GOODS[entity.carrying.good].name}`, '#fbbf24')
        ])
      );
    }

    // ---- Identity: origin, home and work ----
    const homeBuilding = city && entity.homeBuildingId ? city.buildings.get(entity.homeBuildingId) ?? null : null;
    const workBuilding = city && entity.workplaceId ? city.buildings.get(entity.workplaceId) ?? null : null;

    this.bodyEl.appendChild(
      el('div', { class: 'stat-list' }, [
        statRow('Origem', describeOrigin(entity)),
        isMigrant(entity)
          ? statRow('Migrou para', city?.name ?? 'outro lugar', '#38bdf8')
          : null,
        statRow(
          'Moradia',
          homeBuilding
            ? `${homeBuilding.definition.icon} ${homeBuilding.definition.name} (${homeBuilding.residentIds.size} moradores)`
            : 'Sem teto próprio'
        ),
        statRow(
          'Trabalho',
          workBuilding
            ? `${workBuilding.definition.icon} ${workBuilding.definition.name}`
            : 'Sem ocupação fixa'
        ),
        statRow('Classe', SOCIAL_CLASSES[entity.socialClass].description)
      ].filter(Boolean) as HTMLElement[])
    );

    const tree = getFamilyTreeData(entity.id, this.ctx.sim.entities, this.ctx.sim.deceasedAncestors);

    const renderMemberLink = (member: FamilyMember | null, defaultText: string) => {
      if (!member) return el('span', { class: 'muted', text: defaultText });
      if (isDeceasedRecord(member)) {
        return el('span', { class: 'muted', text: `💀 ${member.fullName} (Falecido aos ${member.ageAtDeath}a)` });
      }
      return this.link(`${member.fullName} (${member.age}a)`, () => this.inspectEntity(member));
    };

    const details = el('div', { class: 'stat-list' }, [
      statRow('Fase de Vida', entity.lifeStageLabel),
      entity.isPregnant ? statRow('Gestação', '🤰 Gestante (Em breve nascimento)', '#f472b6') : null,
      statRow('Geração', `Geração ${entity.generation}`),
      statRow('Dinastia', entity.dynasty ? `Dinastia ${entity.dynasty}` : 'Linhagem Comum'),
      statRow('Pai', renderMemberLink(tree?.father ?? null, 'Ancestral Fundador')),
      statRow('Mãe', renderMemberLink(tree?.mother ?? null, 'Ancestral Fundadora')),
      statRow('Cônjuge', renderMemberLink(tree?.partner ?? null, 'Solteiro(a)')),
      statRow('Posição', `${Math.floor(entity.x)}, ${Math.floor(entity.y)}`),
      statRow(
        'Cidade',
        city
          ? this.link(city.name, () => this.inspectCity(city))
          : el('span', { class: 'muted', text: 'Sem teto' })
      ),
      statRow(
        'Reino',
        kingdom
          ? this.link(`${kingdom.emblem} ${kingdom.name}`, () => this.inspectKingdom(kingdom.id), kingdom.color)
          : el('span', { class: 'muted', text: 'Independente' })
      )
    ]);
    this.bodyEl.appendChild(details);

    // Family Tree Tree-View Block
    if (tree) {
      const familyNodes: HTMLElement[] = [];

      if (tree.grandparents.length > 0) {
        familyNodes.push(
          el('div', { class: 'fam-row' }, [
            el('strong', { text: 'Avós: ' }),
            ...tree.grandparents.map(g => renderMemberLink(g, ''))
          ])
        );
      }

      if (tree.siblings.length > 0) {
        familyNodes.push(
          el('div', { class: 'fam-row' }, [
            el('strong', { text: `Irmãos (${tree.siblings.length}): ` }),
            ...tree.siblings.map(s => renderMemberLink(s, ''))
          ])
        );
      }

      if (tree.children.length > 0) {
        familyNodes.push(
          el('div', { class: 'fam-row' }, [
            el('strong', { text: `Filhos (${tree.children.length}): ` }),
            ...tree.children.map(c => renderMemberLink(c, ''))
          ])
        );
      }

      this.bodyEl.appendChild(
        el('div', { class: 'inspect-block family-tree-card', style: { background: 'rgba(168,85,247,0.08)', borderRadius: '8px', padding: '10px 12px', margin: '10px 0', border: '1px solid rgba(168,85,247,0.2)' } }, [
          el('h4', { class: 'block-title', text: `🌳 Árvore Genealógica (Dinastia ${tree.dynasty || 'Comum'})` }),
          familyNodes.length > 0 ? el('div', { class: 'family-list-stack', style: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' } }, familyNodes) : el('p', { class: 'muted small', text: 'Sem parentes adicionais registrados nesta geração.' })
        ])
      );
    }

    // Traits
    const traits = Array.from(entity.traits);
    this.bodyEl.appendChild(
      el('div', { class: 'inspect-block' }, [
        el('h4', { class: 'block-title', text: `Traits (${traits.length})` }),
        traits.length
          ? el(
              'div',
              { class: 'chip-row' },
              traits.map(t => {
                const def = TRAIT_DEFINITIONS[t as TraitId];
                return badge(def?.name ?? t, def?.color ?? '#94a3b8', 'chip-trait');
              })
            )
          : el('p', { class: 'muted small', text: 'No notable traits.' })
      ])
    );

    // Equipment
    const weapon = entity.equipment.weapon;
    const armor = entity.equipment.armor;
    if (weapon || armor) {
      this.bodyEl.appendChild(
        el('div', { class: 'inspect-block' }, [
          el('h4', { class: 'block-title', text: 'Legendary Equipment' }),
          el('div', { class: 'stat-list' }, [
            weapon ? statRow('Weapon', weapon.name, '#fbbf24') : null,
            armor ? statRow('Armor', armor.name, '#38bdf8') : null
          ].filter(Boolean) as HTMLElement[])
        ])
      );
    }

    // Divine actions
    this.bodyEl.appendChild(
      el('div', { class: 'action-row' }, [
        button('Follow', () => {
          this.ctx.trackEntity(entity.id);
          this.ctx.toast(`Camera now follows ${entity.name}`, 'info');
        }, { variant: 'primary', icon: '🎥' }),
        button(entity.isFavorite ? 'Unfavorite' : 'Favorite', () => {
          entity.isFavorite = !entity.isFavorite;
          this.render();
        }, { icon: '⭐' }),
        button('Heal', () => {
          entity.hp = entity.maxHp;
          this.ctx.particles.spawnParticle(entity.x, entity.y, '#34d399', 0, -0.5, 0.6);
          this.ctx.toast(`${entity.name} was fully restored`, 'divine');
          this.render();
        }, { icon: '💖' }),
        button('Bless', () => {
          entity.addTrait(TraitId.BLESSED);
          this.ctx.toast(`${entity.name} has been blessed`, 'divine');
          this.render();
        }, { icon: '✨' }),
        button('Smite', () => {
          entity.hp = 0;
          this.ctx.toast(`${entity.name} was struck down`, 'disaster');
        }, { variant: 'danger', icon: '⚡' })
      ])
    );
  }

  // ============================ CITY ============================

  private renderCity(id: string): void {
    const city = this.ctx.sim.cities.get(id);
    if (!city) {
      this.titleEl.textContent = 'Ruins';
      this.bodyEl.appendChild(emptyState('🏚️', 'This city no longer exists', 'It was razed or abandoned.'));
      return;
    }

    const kingdom = city.kingdomId ? this.ctx.sim.kingdoms.get(city.kingdomId) ?? null : null;
    const config = SPECIES_DEFINITIONS[city.species];
    const citizens = this.ctx.sim.entities.filter(e => e.cityId === city.id);
    const age = this.ctx.sim.currentYear - city.foundingYear;

    const housing = city.housingCapacity();
    const housingRatio = city.population > 0 ? housing / city.population : 1;
    const housingCritical = housingRatio < 1.1 && city.population > 10;

    this.titleEl.textContent = `🏛️ ${city.name}`;
    if (housingCritical) {
      this.titleEl.appendChild(
        el('span', { class: 'housing-alert', text: ' ⚠️ MORADIA CRÍTICA', style: { color: '#f87171', marginLeft: '8px', fontSize: '12px' } })
      );
    }

    this.bodyEl.appendChild(
      el('div', { class: 'inspect-hero', style: { borderColor: hexAlpha(kingdom?.color ?? config.primaryColor, 0.4) } }, [
        this.spriteBox('b_town_center', kingdom?.color ?? config.primaryColor),
        el('div', { class: 'inspect-hero-info' }, [
          el('div', { class: 'inspect-hero-name', text: config.name, style: { color: config.primaryColor } }),
          el('div', { class: 'inspect-hero-sub', text: `Founded year ${city.foundingYear} · ${age} yrs old` }),
          el('div', { class: 'chip-row' }, [
            badge(`${city.buildings.size} buildings`, '#94a3b8'),
            badge(`${city.territory.size} tiles`, '#38bdf8')
          ])
        ])
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'stat-grid' }, [
        this.statTile('👥', 'Population', formatNumber(city.population)),
        this.statTile('🏠', 'Housing', `${city.housingCapacity()}`),
        this.statTile('🏗️', 'Buildings', `${city.buildings.size}`),
        this.statTile('🗺️', 'Territory', `${city.territory.size}`),
        this.statTile('📍', 'Location', `${city.x}, ${city.y}`)
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'inspect-block' }, [
        el('h4', { class: 'block-title', text: 'Stockpile' }),
        el('div', { class: 'meter-stack' }, [
          meter('🌲 Wood', city.resources.wood, 200, '#22c55e'),
          meter('🪨 Stone', city.resources.stone, 200, '#94a3b8'),
          meter('⛏️ Iron', city.resources.iron, 200, '#cbd5e1'),
          meter('🌾 Food', city.resources.food, 200, '#fbbf24'),
          meter('🪙 Gold', city.resources.gold, 200, '#f59e0b')
        ])
      ])
    );

    // Housing alert
    if (housingCritical) {
      this.bodyEl.appendChild(
        el('div', { class: 'housing-warning', style: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 12px', margin: '8px 0', display:'flex', alignItems:'center', gap:'8px' } }, [
          el('span', { text: '🏠', style: { fontSize:'20px' } }),
          el('div', {}, [
            el('div', { style: { color:'#f87171', fontWeight:'600', fontSize:'12px' }, text: 'Moradia insuficiente' }),
            el('div', { style: { color:'#fca5a5', fontSize:'11px' }, text: `Capacidade: ${housing} moradias · População: ${city.population}. Cidadãos precisam de mais casas para prosperar.` })
          ])
        ])
      );
    }

    // Building composition
    const buildingCounts = new Map<string, number>();
    for (const b of city.buildings.values()) {
      buildingCounts.set(b.type, (buildingCounts.get(b.type) ?? 0) + 1);
    }
    this.bodyEl.appendChild(
      el('div', { class: 'inspect-block' }, [
        el('h4', { class: 'block-title', text: 'Structures' }),
        el(
          'div',
          { class: 'chip-row' },
          Array.from(buildingCounts.entries()).map(([type, count]) => badge(`${titleCase(type)} ×${count}`, '#94a3b8'))
        )
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'stat-list' }, [
        statRow('Founder', city.founderName),
        statRow(
          'Realm',
          kingdom
            ? this.link(`${kingdom.emblem} ${kingdom.name}`, () => this.inspectKingdom(kingdom.id), kingdom.color)
            : el('span', { class: 'muted', text: 'Independent' })
        ),
        statRow('Citizens tracked', `${citizens.length}`)
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'action-row' }, [
        button('Go to city', () => this.ctx.focusOn(city.x, city.y, 1.6), { variant: 'primary', icon: '🎥' }),
        citizens.length
          ? button('Inspect a citizen', () => this.inspectEntity(citizens[0]), { icon: '👤' })
          : null
      ].filter(Boolean) as HTMLElement[])
    );
  }

  // ============================ KINGDOM ============================

  private renderKingdom(id: string): void {
    const kingdom = this.ctx.sim.kingdoms.get(id);
    if (!kingdom) {
      this.titleEl.textContent = 'Fallen realm';
      this.bodyEl.appendChild(emptyState('🏳️', 'This kingdom has collapsed', 'Its banner no longer flies.'));
      return;
    }

    const cities = Array.from(kingdom.cityIds)
      .map(cid => this.ctx.sim.cities.get(cid))
      .filter((c): c is City => !!c);
    const subjects = this.ctx.sim.entities.filter(e => e.kingdomId === kingdom.id);
    const ruler = kingdom.rulerId ? this.ctx.sim.entities.find(e => e.id === kingdom.rulerId) : null;
    const wars = this.ctx.sim.diplomacy.getWarsFor(kingdom.id);
    const territory = cities.reduce((sum, c) => sum + c.territory.size, 0);

    this.titleEl.textContent = `${kingdom.emblem} ${kingdom.name}`;

    this.bodyEl.appendChild(
      el('div', { class: 'kingdom-banner', style: { background: `linear-gradient(135deg, ${kingdom.color}, ${kingdom.secondaryColor})` } }, [
        el('span', { class: 'banner-emblem', text: kingdom.emblem }),
        el('div', {}, [
          el('div', { class: 'banner-name', text: kingdom.name }),
          el('div', { class: 'banner-sub', text: `${SPECIES_DEFINITIONS[kingdom.species].name} · since year ${kingdom.foundingYear}` })
        ])
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'stat-grid' }, [
        this.statTile('🏛️', 'Cities', `${cities.length}`),
        this.statTile('👥', 'Subjects', formatNumber(subjects.length)),
        this.statTile('🗺️', 'Territory', formatNumber(territory)),
        this.statTile('⚔️', 'Active wars', `${wars.length}`)
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'stat-list' }, [
        statRow('Ruler', ruler ? this.link(`👑 ${ruler.name}`, () => this.inspectEntity(ruler)) : el('span', { class: 'muted', text: 'Throne vacant' })),
        statRow('Capital', (() => {
          const cap = this.ctx.sim.cities.get(kingdom.capitalCityId);
          return cap ? this.link(cap.name, () => this.inspectCity(cap)) : el('span', { class: 'muted', text: 'Lost' });
        })()),
        statRow('Culture level', `${kingdom.cultureLevel}`),
        statRow('Wealth', formatNumber(kingdom.wealth))
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'inspect-block' }, [
        el('h4', { class: 'block-title', text: 'Culture' }),
        statRow('Identity', cultureSummary(kingdom.culture)),
        el('div', { class: 'chip-row' },
          dominantCultureTraits(kingdom.culture, 4).map(trait => badge(trait, kingdom.color))
        ),
        meter('Militarism', kingdom.culture.militarism, 1, '#ef4444', `${Math.round(kingdom.culture.militarism * 100)}%`),
        meter('Openness', kingdom.culture.openness, 1, '#38bdf8', `${Math.round(kingdom.culture.openness * 100)}%`),
        meter('War trauma', kingdom.culture.warTrauma, 1, '#a855f7', `${Math.round(kingdom.culture.warTrauma * 100)}%`)
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'inspect-block' }, [
        el('h4', { class: 'block-title', text: 'Social Factions' }),
        statRow('Balance', societySummary(kingdom.society)),
        meter('Cohesion', kingdom.society.cohesion, 1, '#22c55e', `${Math.round(kingdom.society.cohesion * 100)}%`),
        meter('Revolt risk', kingdom.society.revoltRisk, 1, '#ef4444', `${Math.round(kingdom.society.revoltRisk * 100)}%`),
        ...topSocialFactions(kingdom.society, 3).map(f =>
          meter(SOCIAL_FACTIONS[f.id].shortName, f.influence, 1, SOCIAL_FACTIONS[f.id].color, `${Math.round(f.influence * 100)}%`)
        )
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'inspect-block' }, [
        el('h4', { class: 'block-title', text: 'Laws' }),
        statRow('Order', lawSummary(kingdom.laws)),
        meter('Reform momentum', kingdom.laws.reformMomentum, 1, '#22c55e', `${Math.round(kingdom.laws.reformMomentum * 100)}%`),
        el('div', { class: 'chip-row' },
          activeLawDefinitions(kingdom.laws).slice(0, 6).map(law => badge(law.shortName, kingdom.color))
        )
      ])
    );

    if (cities.length) {
      this.bodyEl.appendChild(
        el('div', { class: 'inspect-block' }, [
          el('h4', { class: 'block-title', text: 'Settlements' }),
          el(
            'div',
            { class: 'mini-list' },
            cities.map(c =>
              el('button', { class: 'mini-row', on: { click: () => this.inspectCity(c) } }, [
                el('span', { class: 'mini-name', text: c.name }),
                el('span', { class: 'mini-meta', text: `👥 ${c.population}` })
              ])
            )
          )
        ])
      );
    }

    if (wars.length) {
      this.bodyEl.appendChild(
        el('div', { class: 'inspect-block' }, [
          el('h4', { class: 'block-title', text: 'At war with' }),
          el(
            'div',
            { class: 'chip-row' },
            wars.map(w => {
              const enemyId = w.attacker === kingdom.id ? w.defender : w.attacker;
              const enemy = this.ctx.sim.kingdoms.get(enemyId);
              return badge(enemy?.name ?? 'Unknown realm', '#ef4444');
            })
          )
        ])
      );
    }

    this.bodyEl.appendChild(
      el('div', { class: 'action-row' }, [
        button('Go to capital', () => {
          const cap = this.ctx.sim.cities.get(kingdom.capitalCityId);
          if (cap) this.ctx.focusOn(cap.x, cap.y, 1.4);
        }, { variant: 'primary', icon: '🎥' }),
        button('Diplomacy', () => this.ctx.screens.open('diplomacy', { focusKingdom: kingdom.id }), { icon: '🤝' })
      ])
    );
  }

  // ============================ TILE ============================

  private renderTile(x: number, y: number): void {
    const tile = this.ctx.tileMap.getTile(x, y);
    if (!tile) {
      this.titleEl.textContent = 'Void';
      this.bodyEl.appendChild(emptyState('🌌', 'Outside the world', 'That location is beyond the map edge.'));
      return;
    }

    const terrain = TERRAINS[tile.type];
    const kingdom = tile.kingdomId ? this.ctx.sim.kingdoms.get(tile.kingdomId) ?? null : null;
    const city = tile.cityId ? this.ctx.sim.cities.get(tile.cityId) ?? null : null;

    this.titleEl.textContent = `🗺️ Tile ${x}, ${y}`;

    this.bodyEl.appendChild(
      el('div', { class: 'inspect-hero', style: { borderColor: hexAlpha(terrain.color, 0.5) } }, [
        el('div', { class: 'terrain-swatch', style: { background: terrain.color } }),
        el('div', { class: 'inspect-hero-info' }, [
          el('div', { class: 'inspect-hero-name', text: terrain.name }),
          el('div', { class: 'inspect-hero-sub', text: tile.isOnFire ? '🔥 Currently burning' : terrain.isWalkable ? 'Passable terrain' : 'Impassable terrain' })
        ])
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'stat-grid' }, [
        this.statTile('⛰️', 'Elevation', tile.height.toFixed(2)),
        this.statTile('🌡️', 'Temperature', `${tile.temperature}°C`),
        this.statTile('💧', 'Moisture', `${Math.round(tile.moisture * 100)}%`),
        this.statTile('🌱', 'Fertility', `${Math.round(terrain.fertility * 100)}%`)
      ])
    );

    this.bodyEl.appendChild(
      el('div', { class: 'stat-list' }, [
        statRow('Resource', tile.resourceType ? `${titleCase(tile.resourceType)} (${tile.resourceAmount})` : el('span', { class: 'muted', text: 'None' })),
        statRow('Flammability', `${Math.round(terrain.flammability * 100)}%`),
        statRow('Move cost', terrain.moveCost >= 99 ? 'Blocked' : terrain.moveCost.toFixed(1)),
        statRow('Owner', kingdom ? this.link(kingdom.name, () => this.inspectKingdom(kingdom.id), kingdom.color) : el('span', { class: 'muted', text: 'Unclaimed' })),
        statRow('City', city ? this.link(city.name, () => this.inspectCity(city)) : el('span', { class: 'muted', text: '—' }))
      ])
    );
  }

  // ============================ HELPERS ============================

  private statTile(icon: string, label: string, value: string): HTMLElement {
    return el('div', { class: 'stat-tile' }, [
      el('span', { class: 'tile-icon', text: icon }),
      el('span', { class: 'tile-value', text: value }),
      el('span', { class: 'tile-label', text: label })
    ]);
  }

  private link(text: string, onClick: () => void, color?: string): HTMLElement {
    return el('button', {
      class: 'inline-link',
      text,
      style: color ? { color } : undefined,
      on: { click: onClick }
    });
  }

  /** Draws a cached game sprite scaled up into a framed box. */
  private spriteBox(spriteKey: string, accent: string): HTMLElement {
    const box = el('div', { class: 'sprite-box', style: { borderColor: hexAlpha(accent, 0.5) } });
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const c2d = canvas.getContext('2d')!;
    c2d.imageSmoothingEnabled = false;
    const sprite = SpriteGenerator.getSprite(spriteKey, () => {});
    if (sprite) c2d.drawImage(sprite, 0, 0, 48, 48);
    box.appendChild(canvas);
    return box;
  }
}

function hpColor(ratio: number): string {
  if (ratio > 0.6) return '#10b981';
  if (ratio > 0.3) return '#f59e0b';
  return '#ef4444';
}
