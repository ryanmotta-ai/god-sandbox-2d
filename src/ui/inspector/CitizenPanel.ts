/**
 * The citizen view.
 *
 * Ordered by the brief's hierarchy, which is also the order the questions
 * actually arrive in: who is this, what are they doing, is anything wrong with
 * them — then where they live and work, then who they are related to, and only
 * then the numbers. A farmer's inspector should not open on combat statistics.
 *
 * Every relationship is an `ObjectLink`, so following a citizen's father, their
 * workplace or their realm is one click and re-points the selection — which
 * re-points the ring on the map. That chain is the whole reason UI-0 built the
 * link concept and UI-1 built selection.
 */
import { el, Child } from '../core/Dom';
import {
  panel, section, statRow, rowList, progressBar, badge, badgeRow, objectLink,
  icon, withTooltip, button, emptyState, formatFull,
  type Status, type ObjectRef
} from '../kit';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import { TRAIT_DEFINITIONS } from '../../entities/Traits';
import { SOCIAL_CLASSES, describeOrigin } from '../../entities/Identity';
import { HUNGER_SEEK_FOOD } from '../../entities/Needs';
import { BUILDINGS } from '../../civ/Building';
import { GOODS } from '../../civ/Goods';
import { buildFamilySummary } from '../../civ/Lineage';
import { chronicle } from '../../civ/Chronicle';
import { describeActivity, findBuilding, ROUTINE_PHASES } from './Activity';
import type { InspectorHost } from './Inspector';
import type { Entity } from '../../entities/Entity';
import type { SimulationEngine } from '../../ai/EntityAI';

/** How many chronicle entries the compact history shows. */
const HISTORY_LIMIT = 4;

export function buildCitizenPanel(entity: Entity, host: InspectorHost): Child[] {
  const sim = host.ctx.sim;
  const species = SPECIES_DEFINITIONS[entity.species];
  const city = entity.cityId ? sim.cities.get(entity.cityId) ?? null : null;
  const kingdom = entity.kingdomId ? sim.kingdoms.get(entity.kingdomId) ?? null : null;
  const activity = describeActivity(entity, sim);

  return [
    buildHeader(entity, host, activity, kingdom?.color),
    buildNeeds(entity),
    buildLife(entity, host, city, kingdom),
    buildFamily(entity, host, sim),
    buildEquipment(entity),
    buildTraits(entity),
    buildStats(entity, species.maxAge),
    buildHistory(entity, host)
  ];
}

// ============================ HEADER ============================

/**
 * Name, what they are doing, and why — above everything else.
 *
 * The activity line is the answer to the inspector's central question, so it gets
 * the most prominent slot after the name and a status colour of its own. A Great
 * Person gets a marked header rather than a badge buried further down; being one
 * is the most important thing about them.
 */
function buildHeader(
  entity: Entity,
  host: InspectorHost,
  activity: ReturnType<typeof describeActivity>,
  realmColor?: string
): HTMLElement {
  const species = SPECIES_DEFINITIONS[entity.species];
  const social = SOCIAL_CLASSES[entity.socialClass];
  const following = host.isFollowing(entity.id);

  const node = el('div', { class: `ae-insp-header${entity.isGreatPerson ? ' ae-insp-header-great' : ''}` }, [
    el('div', { class: 'ae-insp-identity' }, [
      icon(entity.isGreatPerson ? 'crown' : 'citizen', { size: 32 }),
      el('div', { class: 'ae-insp-identity-text' }, [
        el('h2', { class: 'ae-insp-name', text: entity.name }),
        el('span', {
          class: 'ae-insp-subtitle',
          // `lifeStageLabel` ends in an emoji the engine appends for its own
          // debug output. The words are the data; the glyph is not an icon and has
          // no place next to real pixel art.
          text: entity.title ?? `${species.name} · ${stripGlyphs(entity.lifeStageLabel)}`
        })
      ])
    ]),

    entity.isGreatPerson && entity.greatPersonType
      ? el('div', { class: 'ae-insp-great' }, [
          icon('education', { size: 16 }),
          el('span', { text: `Figura notável · ${greatPersonLabel(entity.greatPersonType)}` })
        ])
      : null,

    // The activity line: the answer to "what is this doing, and why".
    el('div', { class: `ae-insp-activity ae-insp-activity-${activity.status}` }, [
      icon(activity.icon, { size: 16, class: 'ae-insp-activity-icon' }),
      el('div', { class: 'ae-insp-activity-text' }, [
        el('span', { class: 'ae-insp-activity-label', text: activity.label }),
        activity.reason
          ? el('span', { class: 'ae-insp-activity-reason', text: activity.reason })
          : null
      ])
    ]),

    badgeRow([
      badge(entity.gender === 'male' ? 'Masculino' : 'Feminino', { size: 'sm', variant: 'outline' }),
      badge(social.label, { size: 'sm', color: social.color }),
      badge(entity.personality, { size: 'sm', variant: 'outline' }),
      entity.isPregnant ? badge('Gestante', { size: 'sm', status: 'positive' }) : null,
      entity.carrying
        ? badge(
            `Carrega ${Math.round(entity.carrying.amount)} ${GOODS[entity.carrying.good]?.name ?? entity.carrying.good}`,
            { size: 'sm', status: 'neutral', icon: 'good' }
          )
        : null
    ]),

    // Follow state, shown as its own strip when active so it can never be a mode
    // the player is stuck in without seeing it.
    following
      ? el('div', { class: 'ae-insp-following' }, [
          icon('map', { size: 16 }),
          el('span', { class: 'ae-insp-following-text', text: `Seguindo ${entity.name}` }),
          withTooltip(
            el('button', {
              class: 'ae-insp-following-stop',
              attrs: { type: 'button', 'aria-label': 'Parar de seguir' },
              on: { click: () => host.stopFollow() }
            }, [icon('close', { size: 16 })]),
            { title: 'Parar de seguir', shortcut: 'Esc' }
          )
        ])
      : null,

    el('div', { class: 'ae-insp-actions' }, [
      button(following ? 'Seguindo' : 'Seguir', () => host.toggleFollow(entity.id), {
        variant: following ? 'primary' : 'secondary',
        size: 'sm',
        icon: 'map',
        tooltip: {
          title: 'Seguir',
          description: 'A câmera acompanha este habitante até você movê-la manualmente.'
        }
      }),
      button('Centralizar', () => host.focusOn(entity.x, entity.y), {
        variant: 'ghost', size: 'sm', icon: 'search',
        tooltip: { title: 'Centralizar', description: 'Move a câmera até onde ele está agora.' }
      })
    ])
  ]);

  if (realmColor) node.style.setProperty('--ae-realm', realmColor);
  return node;
}

/** Drops trailing pictographs from an engine-authored label. */
function stripGlyphs(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
}

function greatPersonLabel(type: 'scholar' | 'builder' | 'hero' | 'diplomat'): string {
  return { scholar: 'Erudito', builder: 'Construtor', hero: 'Herói', diplomat: 'Diplomata' }[type];
}

// ============================ NEEDS ============================

/**
 * The five real readings, and only those.
 *
 * `hunger`, `comfort` and `safety` come from `EntityNeeds`; health and energy are
 * fields on the entity. Nothing else is invented — there is no happiness or
 * sanity in this simulation, so there is none here.
 *
 * Hunger is inverted for display. The field counts *up* toward starvation, and a
 * bar that fills as things get worse reads backwards next to four bars that fill
 * as things get better.
 */
function buildNeeds(entity: Entity): HTMLElement {
  const hungerSatisfied = 100 - entity.needs.hunger;

  return panel({ title: 'Necessidades', icon: 'citizen' }, [
    progressBar({
      label: 'Vida',
      value: entity.hp / entity.maxHp,
      valueText: `${Math.max(0, Math.round(entity.hp))} / ${entity.maxHp}`,
      status: bandFor(entity.hp / entity.maxHp),
      tooltip: { title: 'Vida', description: 'Dano acumulado. Abaixo de 60% o habitante para para se recuperar; abaixo de 25% foge de ameaças.' }
    }),
    progressBar({
      label: 'Alimentação',
      value: hungerSatisfied / 100,
      valueText: `${Math.round(hungerSatisfied)}%`,
      status: bandFor(hungerSatisfied / 100),
      // The AI's own threshold, drawn on the track so the number has a meaning.
      markerAt: (100 - HUNGER_SEEK_FOOD) / 100,
      tooltip: {
        title: 'Alimentação',
        value: `${Math.round(hungerSatisfied)}%`,
        description: `Fome bruta em ${Math.round(entity.needs.hunger)}/100. A marca é o limite de ${HUNGER_SEEK_FOOD} em que ele abandona o trabalho para comer.`,
        rows: entity.starvingDays > 0
          ? [{ label: 'Dias passando fome', value: `${entity.starvingDays}`, status: 'critical' }]
          : undefined
      }
    }),
    progressBar({
      label: 'Energia',
      value: entity.energy / entity.maxEnergy,
      valueText: `${Math.round(entity.energy)} / ${entity.maxEnergy}`,
      status: bandFor(entity.energy / entity.maxEnergy),
      tooltip: { title: 'Energia', description: 'Gasta trabalhando e recuperada em repouso. Esgotada, ele para onde estiver.' }
    }),
    progressBar({
      label: 'Conforto',
      value: entity.needs.comfort / 100,
      valueText: `${Math.round(entity.needs.comfort)}%`,
      status: bandFor(entity.needs.comfort / 100),
      tooltip: { title: 'Conforto', description: 'Determinado pela moradia.' }
    }),
    progressBar({
      label: 'Segurança',
      value: entity.needs.safety / 100,
      valueText: `${Math.round(entity.needs.safety)}%`,
      status: bandFor(entity.needs.safety / 100),
      tooltip: { title: 'Segurança', description: 'Determinada por ameaças próximas e pelas defesas da cidade.' }
    })
  ]);
}

function bandFor(ratio: number): Status {
  if (ratio >= 0.6) return 'positive';
  if (ratio >= 0.35) return 'neutral';
  if (ratio >= 0.15) return 'warning';
  return 'critical';
}

// ============================ LIFE & WORK ============================

/**
 * Where they live, where they work, and who they answer to — all navigable.
 *
 * The routine is shown as the four phases the AI genuinely implements, with the
 * hour ranges it actually compares against. No per-citizen timetable is invented,
 * because none exists; the current phase is marked so the strip reads as live
 * rather than as documentation.
 */
function buildLife(
  entity: Entity,
  host: InspectorHost,
  city: import('../../civ/City').City | null,
  kingdom: import('../../civ/Kingdom').Kingdom | null
): HTMLElement {
  const sim = host.ctx.sim;
  const home = findBuilding(entity.homeBuildingId, entity.cityId, sim);
  const work = findBuilding(entity.workplaceId, entity.cityId, sim);
  const household = entity.householdId ? sim.households.get(entity.householdId) : undefined;

  const rows: Child[] = [];

  // ---- Home ----
  if (home) {
    const def = BUILDINGS[home.building.type];
    rows.push(linkRowWithGoTo(
      'Moradia',
      { kind: 'building', id: home.building.id, name: def?.name ?? home.building.type, qualifier: home.city.name },
      host,
      { x: home.building.x, y: home.building.y }
    ));
  } else if (entity.homeX != null && entity.homeY != null) {
    // A home position without a claimed building: real, but not an object.
    rows.push(statRow({
      label: 'Moradia',
      value: 'Abrigo improvisado',
      icon: 'building',
      onClick: () => host.focusOn(entity.homeX!, entity.homeY!),
      tooltip: { title: 'Abrigo improvisado', description: 'Tem um lugar para voltar, mas nenhuma casa reivindicada.' }
    }));
  } else {
    rows.push(statRow({ label: 'Moradia', value: 'Sem-teto', icon: 'building', status: 'warning' }));
  }

  // ---- Workplace ----
  if (work) {
    const def = BUILDINGS[work.building.type];
    const jobs = def?.jobs ?? 0;
    const staffed = work.building.assignedWorkerIds.size;
    rows.push(linkRowWithGoTo(
      'Trabalho',
      { kind: 'building', id: work.building.id, name: def?.name ?? work.building.type, qualifier: work.city.name },
      host,
      { x: work.building.x, y: work.building.y },
      jobs > 0 ? `${staffed}/${jobs}` : undefined
    ));
  } else {
    rows.push(statRow({
      label: 'Trabalho',
      value: 'Sem posto',
      icon: 'industry',
      status: 'warning',
      tooltip: {
        title: 'Sem posto de trabalho',
        description: 'Não está designado a nenhuma construção. Sem posto, não produz nada e não recebe salário.'
      }
    }));
  }

  // ---- Profession, city, realm ----
  rows.push(statRow({ label: 'Ofício', value: professionLabel(entity.profession), icon: 'industry' }));

  if (city) {
    rows.push(el('div', { class: 'ae-row' }, [
      icon('city', { size: 16, class: 'ae-row-icon' }),
      el('span', { class: 'ae-row-label', text: 'Cidade' }),
      el('span', { class: 'ae-row-value' }, [
        objectLink({ kind: 'city', id: city.id, name: city.name, accent: kingdom?.color })
      ])
    ]));
  }
  if (kingdom) {
    rows.push(el('div', { class: 'ae-row' }, [
      icon('kingdom', { size: 16, class: 'ae-row-icon' }),
      el('span', { class: 'ae-row-label', text: 'Reino' }),
      el('span', { class: 'ae-row-value' }, [
        objectLink({ kind: 'kingdom', id: kingdom.id, name: kingdom.name, accent: kingdom.color })
      ])
    ]));
  }
  rows.push(statRow({ label: 'Origem', value: describeOrigin(entity), icon: 'history' }));

  const children: Child[] = [rowList(rows)];

  // ---- Household ----
  if (household) {
    children.push(section('Domicílio', [
      rowList([
        statRow({ label: 'Sob o mesmo teto', value: `${household.size}`, unit: 'pessoas', icon: 'population' }),
        statRow({
          label: 'Despensa',
          value: household.pantry.get('food').toFixed(1),
          unit: `/ ${household.pantryTarget()}`,
          icon: 'agriculture',
          status: household.pantry.get('food') <= 0 ? 'critical' : undefined
        }),
        statRow({ label: 'Bolsa da família', value: formatFull(household.coin), icon: 'economy' }),
        statRow({
          label: 'Balanço do dia',
          value: `+${Math.round(household.lastEarned)} / −${Math.round(household.lastSpent)}`,
          icon: 'economy',
          tooltip: { title: 'Balanço do dia', description: 'Ganho e gasto do domicílio no último dia simulado.' }
        })
      ])
    ]));
  }

  // ---- Routine ----
  children.push(section('Rotina diária', [
    el('div', { class: 'ae-insp-routine' }, ROUTINE_PHASES.map(phase => withTooltip(
      el('div', {
        class: `ae-insp-phase${sim.timeOfDay === phase.phase ? ' ae-insp-phase-now' : ''}`
      }, [
        icon(phase.icon, { size: 16 }),
        el('span', { class: 'ae-insp-phase-label', text: phase.label }),
        el('span', { class: 'ae-insp-phase-hours', text: phase.hours })
      ]),
      {
        title: `${phase.label} · ${phase.hours}`,
        description: phase.doing,
        icon: phase.icon,
        footnote: sim.timeOfDay === phase.phase ? 'Fase atual' : undefined
      }
    )))
  ], {
    hint: 'ciclo do mundo'
  }));

  return panel({ title: 'Vida e trabalho', icon: 'building' }, children);
}

/** A relationship row with a link and a jump-to-map button beside it. */
function linkRowWithGoTo(
  label: string,
  ref: ObjectRef,
  host: InspectorHost,
  at: { x: number; y: number },
  trailing?: string
): HTMLElement {
  return el('div', { class: 'ae-row' }, [
    icon(ref.kind === 'building' ? 'building' : ref.kind, { size: 16, class: 'ae-row-icon' }),
    el('span', { class: 'ae-row-label', text: label }),
    el('span', { class: 'ae-row-value' }, [
      objectLink(ref, { showIcon: false }),
      trailing ? el('span', { class: 'ae-row-unit', text: trailing }) : null,
      withTooltip(
        el('button', {
          class: 'ae-insp-goto',
          attrs: { type: 'button', 'aria-label': `Ir para ${ref.name}` },
          on: { click: () => host.focusOn(at.x, at.y) }
        }, [icon('map', { size: 16 })]),
        { title: 'Ir até lá', description: 'Centraliza a câmera nesta construção.' }
      )
    ])
  ]);
}

const PROFESSION_LABEL: Record<string, string> = {
  farmer: 'Agricultor', woodcutter: 'Lenhador', miner: 'Mineiro', builder: 'Construtor',
  soldier: 'Soldado', archer: 'Arqueiro', scout: 'Batedor', healer: 'Curandeiro',
  leader: 'Líder', king: 'Monarca', none: 'Sem ofício'
};

function professionLabel(profession: string): string {
  return PROFESSION_LABEL[profession] ?? profession;
}

// ============================ FAMILY ============================

/**
 * The family, navigable.
 *
 * `buildFamilySummary` resolves only the ids this citizen already holds, so this
 * costs a handful of lookups rather than a pass over the population — and it is
 * built on selection, not per frame. Children are included because a lineage you
 * can only walk upward is half a lineage.
 */
function buildFamily(entity: Entity, host: InspectorHost, sim: SimulationEngine): HTMLElement {
  const lookup = (id: string) => sim.entities.find(e => e.id === id);
  const family = buildFamilySummary(entity, lookup);
  const rows: Child[] = [];

  const memberRow = (label: string, member: Entity | null) => {
    if (!member) return null;
    return el('div', { class: 'ae-row' }, [
      icon(member.isGreatPerson ? 'crown' : 'citizen', { size: 16, class: 'ae-row-icon' }),
      el('span', { class: 'ae-row-label', text: label }),
      el('span', { class: 'ae-row-value' }, [
        objectLink(
          {
            kind: 'citizen',
            id: member.id,
            name: member.name,
            qualifier: `${Math.floor(member.age)} anos`
          },
          { showIcon: false }
        )
      ])
    ]);
  };

  rows.push(memberRow('Pai', family.father));
  rows.push(memberRow('Mãe', family.mother));
  rows.push(memberRow('Cônjuge', family.partner));
  for (const child of family.children) rows.push(memberRow('Filho(a)', child));
  for (const sibling of family.siblings.slice(0, 4)) rows.push(memberRow('Irmão(ã)', sibling));

  const known = rows.filter(Boolean);

  return panel({ title: 'Família', icon: 'population' }, [
    rowList([
      statRow({ label: 'Linhagem', value: entity.dynasty ? `Casa ${entity.dynasty}` : 'Linhagem comum', icon: 'history' }),
      statRow({ label: 'Geração', value: `${entity.generation}`, icon: 'population' })
    ]),
    known.length
      ? rowList(known)
      // Not an error state: plenty of citizens are the first of their line.
      : emptyState({
          icon: 'population',
          title: 'Sem parentes conhecidos',
          hint: 'Primeiro de sua linhagem, ou seus parentes já morreram e não deixaram registro.',
          compact: true
        })
  ]);
}

// ============================ EQUIPMENT ============================

/**
 * Weapon and armour, read off `entity.equipment`.
 *
 * Only soldiers are ever armed by the AI, so this section is rendered as an
 * explicit "unarmed" for everyone else rather than being hidden — a farmer with
 * no sword is information, and a missing section reads as a bug.
 */
function buildEquipment(entity: Entity): HTMLElement {
  const weapon = entity.equipment.weapon;
  const armor = entity.equipment.armor;

  const itemRow = (label: string, item: any, iconName: string) => {
    if (!item) {
      return statRow({ label, value: 'Nenhum', icon: iconName, status: undefined });
    }
    const bonuses: { label: string; value: string }[] = [];
    if (item.damageBonus) bonuses.push({ label: 'Dano', value: `+${item.damageBonus}` });
    if (item.defenseBonus) bonuses.push({ label: 'Defesa', value: `+${item.defenseBonus}` });
    if (item.hpBonus) bonuses.push({ label: 'Vida', value: `+${item.hpBonus}` });
    if (item.attackRange) bonuses.push({ label: 'Alcance', value: `${item.attackRange}` });

    return statRow({
      label,
      value: item.name,
      icon: iconName,
      tooltip: {
        title: item.name,
        icon: iconName,
        description: [item.rarity, item.category].filter(Boolean).join(' · ') || undefined,
        rows: bonuses.length ? bonuses : undefined
      }
    });
  };

  return panel({ title: 'Equipamento', icon: 'defence' }, [
    rowList([
      itemRow('Arma', weapon, 'war'),
      itemRow('Armadura', armor, 'defence')
    ])
  ]);
}

// ============================ TRAITS ============================

/**
 * Traits as badges, each carrying its definition on hover.
 *
 * The description and the stat modifiers are read straight from
 * `TRAIT_DEFINITIONS` — the inspector states what a trait does, it does not
 * recompute it.
 */
function buildTraits(entity: Entity): HTMLElement | null {
  if (entity.traits.size === 0) return null;

  return panel({ title: 'Traços', icon: 'culture' }, [
    badgeRow(Array.from(entity.traits).map(traitId => {
      const def = TRAIT_DEFINITIONS[traitId];
      if (!def) return null;

      const mods: { label: string; value: string; status?: Status }[] = [];
      const mod = (label: string, value: number | undefined) => {
        if (value === undefined || value === 1) return;
        const pct = Math.round((value - 1) * 100);
        mods.push({
          label,
          value: `${pct > 0 ? '+' : ''}${pct}%`,
          status: pct > 0 ? 'positive' : 'critical'
        });
      };
      mod('Vida', def.hpMod);
      mod('Velocidade', def.speedMod);
      mod('Dano', def.damageMod);
      mod('Defesa', def.defenseMod);

      return badge(def.name, {
        color: def.color,
        size: 'sm',
        tooltip: {
          title: def.name,
          description: def.description,
          accent: def.color,
          rows: mods.length ? mods : undefined,
          footnote: `Chance de herança: ${Math.round(def.inheritChance * 100)}%`
        }
      });
    }).filter(Boolean) as HTMLElement[])
  ]);
}

// ============================ STATS ============================

/**
 * The numbers, last.
 *
 * Combat figures are deliberately at the bottom and only expanded for someone who
 * has actually fought — a farmer's inspector should not be dominated by a kill
 * count of zero.
 */
function buildStats(entity: Entity, maxAge: number): HTMLElement {
  const hasFought = entity.kills > 0 || entity.level > 1;

  return panel({ title: 'Atributos', icon: 'statistics' }, [
    rowList([
      statRow({ label: 'Idade', value: `${Math.floor(entity.age)}`, unit: `/ ${maxAge} anos`, icon: 'year' }),
      statRow({ label: 'Nascido em', value: `Ano ${entity.birthYear}`, icon: 'year' }),
      statRow({ label: 'Patrimônio', value: formatFull(entity.wealth), icon: 'economy' }),
      statRow({ label: 'Dano', value: `${entity.damage}`, icon: 'war' }),
      statRow({ label: 'Defesa', value: `${entity.defense}`, icon: 'defence' })
    ]),
    hasFought
      ? section('Experiência de combate', [
          progressBar({
            label: `Nível ${entity.level}`,
            value: entity.xp / (entity.level * 50),
            valueText: `${entity.xp} / ${entity.level * 50} XP`,
            status: 'neutral'
          }),
          rowList([
            statRow({ label: 'Abates', value: `${entity.kills}`, icon: 'war' })
          ])
        ])
      : null
  ]);
}

// ============================ HISTORY ============================

/**
 * What history records about this person.
 *
 * Read through `chronicle.getEventsForRef('person', id)` — a structured lookup on
 * the reference the Chronicle already stores. Deliberately *not* a text search
 * for the citizen's name, which would match every namesake in the world and miss
 * every event that referred to them by title.
 */
function buildHistory(entity: Entity, host: InspectorHost): HTMLElement | null {
  const events = chronicle.getEventsForRef('person', entity.id);
  if (events.length === 0) return null;

  // Newest first, and only a handful — this is a footnote, not the Chronicle.
  const recent = [...events].sort((a, b) => b.year - a.year).slice(0, HISTORY_LIMIT);

  return panel({
    title: 'História',
    icon: 'history',
    subtitle: `${events.length} registro${events.length === 1 ? '' : 's'}`,
    actions: events.length > HISTORY_LIMIT
      ? [button('Ver tudo', () => host.openChronicle(), { variant: 'ghost', size: 'sm', icon: 'history' })]
      : undefined
  }, [
    el('div', { class: 'ae-insp-history' }, recent.map(event => withTooltip(
      el('div', { class: `ae-insp-event ae-insp-event-${event.importance}` }, [
        el('span', { class: 'ae-insp-event-year', text: `Ano ${event.year}` }),
        el('span', { class: 'ae-insp-event-text', text: event.title ?? event.text })
      ]),
      {
        title: event.title ?? `Ano ${event.year}`,
        description: event.text,
        icon: 'history',
        rows: [
          { label: 'Ano', value: `${event.year}` },
          { label: 'Importância', value: event.importance }
        ],
        footnote: event.causes.length ? `Causa: ${event.causes[0]}` : undefined
      }
    )))
  ]);
}
