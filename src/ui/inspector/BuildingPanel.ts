/**
 * The building view.
 *
 * Buildings were not inspectable at all before UI-2 — UI-1 made them
 * *selectable* and the card had to hide its Inspect button because there was
 * nothing behind it. This is that missing half.
 *
 * The honesty problem here is production. The simulation does not record what an
 * individual building actually produced last year: `CityLedger` aggregates flows
 * per settlement, not per structure. So this panel reports **rated capacity** —
 * the definition's yearly figure scaled by the level and staffing that really
 * apply — and says so in as many words. Inventing a per-building output number
 * would be the easiest lie in this entire rework and the hardest for a player to
 * catch.
 *
 * What *is* determinable is scarcity: a recipe's inputs against the settlement's
 * stock tells you which ingredient is holding the line, so "limited by coal" is
 * shown only when the coal is genuinely short.
 */
import { el, Child } from '../core/Dom';
import {
  panel, section, statRow, rowList, progressBar, badge, badgeRow, objectLink,
  icon, withTooltip, button, formatFull,
  type Status
} from '../kit';
import { BUILDINGS } from '../../civ/Building';
import { GOODS, productionRecipesFor, type GoodId } from '../../civ/Goods';
import type { InspectorHost } from './Inspector';
import type { Building } from '../../civ/Building';
import type { City } from '../../civ/City';
import type { Tile } from '../../world/Tile';

export function buildBuildingPanel(
  building: Building,
  city: City,
  host: InspectorHost
): Child[] {
  const def = BUILDINGS[building.type];
  const sim = host.ctx.sim;
  const kingdom = city.kingdomId ? sim.kingdoms.get(city.kingdomId) ?? null : null;
  const jobs = def?.jobs ?? 0;
  const staffed = building.assignedWorkerIds.size;
  // The tile is resolved once and threaded through: it carries the natural
  // deposit, which both the status line and the extraction section need.
  const tile = host.ctx.tileMap.getTile(building.x, building.y);
  const status = operationalStatus(building, city, jobs, staffed, tile);

  return [
    buildHeader(building, city, kingdom, status, host),
    buildCondition(building, city, kingdom, jobs, staffed),
    buildExtraction(building, city, tile, host),
    buildProduction(building, city),
    buildResidents(building, host)
  ];
}

// ============================ STATUS ============================

interface OperationalStatus {
  label: string;
  detail?: string;
  status: Status;
  depleted: boolean;
}

/**
 * Whether the building is working, and if not, what is stopping it.
 *
 * Checked in the order that actually decides the outcome: a depleted deposit is
 * terminal, no workers means nothing happens at all, and a missing recipe input
 * is a bottleneck rather than a halt.
 */
function operationalStatus(
  building: Building,
  city: City,
  jobs: number,
  staffed: number,
  tile: Tile | null
): OperationalStatus {
  const def = BUILDINGS[building.type];

  // A worked-out deposit is the one condition that cannot be fixed by staffing.
  const deposit = depositAt(building, tile);
  if (deposit && deposit.max > 0 && deposit.remaining <= 0) {
    return { label: 'ESGOTADO', detail: `A jazida de ${deposit.goodName} acabou`, status: 'critical', depleted: true };
  }

  if (jobs > 0 && staffed === 0) {
    return { label: 'Parada', detail: 'Nenhum trabalhador designado', status: 'critical', depleted: false };
  }

  const shortage = limitingInput(building, city);
  if (shortage) {
    return {
      label: 'Limitada',
      detail: `Falta ${shortage.goodName} — ${shortage.available.toFixed(1)} em estoque, ${shortage.needed.toFixed(1)} por ciclo`,
      status: 'warning',
      depleted: false
    };
  }

  if (jobs > 0 && staffed < jobs) {
    return {
      label: 'Sem pessoal suficiente',
      detail: `${staffed} de ${jobs} postos preenchidos`,
      status: 'warning',
      depleted: false
    };
  }

  // Structures with no jobs (walls, storehouses) are simply standing.
  if (jobs === 0 && !def?.produces) {
    return { label: 'De pé', status: 'neutral', depleted: false };
  }

  return { label: 'Em funcionamento', status: 'positive', depleted: false };
}

// ============================ HEADER ============================

function buildHeader(
  building: Building,
  city: City,
  kingdom: import('../../civ/Kingdom').Kingdom | null,
  status: OperationalStatus,
  host: InspectorHost
): HTMLElement {
  const def = BUILDINGS[building.type];

  const node = el('div', { class: 'ae-insp-header' }, [
    el('div', { class: 'ae-insp-identity' }, [
      icon('building', { size: 32 }),
      el('div', { class: 'ae-insp-identity-text' }, [
        el('h2', { class: 'ae-insp-name', text: def?.name ?? building.type }),
        el('span', { class: 'ae-insp-subtitle', text: `${city.name}${building.level > 1 ? ` · Nível ${building.level}` : ''}` })
      ])
    ]),

    el('div', { class: `ae-insp-activity ae-insp-activity-${status.status}` }, [
      icon(status.depleted ? 'alert' : 'industry', { size: 16, class: 'ae-insp-activity-icon' }),
      el('div', { class: 'ae-insp-activity-text' }, [
        el('span', { class: 'ae-insp-activity-label', text: status.label }),
        status.detail ? el('span', { class: 'ae-insp-activity-reason', text: status.detail }) : null
      ])
    ]),

    def?.description
      ? el('p', { class: 'ae-insp-blurb', text: def.description })
      : null,

    badgeRow([
      def ? badge(categoryLabel(def.category), { size: 'sm', variant: 'outline' }) : null,
      def?.unique ? badge('Única na cidade', { size: 'sm', status: 'neutral' }) : null
    ]),

    el('div', { class: 'ae-insp-actions' }, [
      button('Centralizar', () => host.focusOn(building.x, building.y), {
        variant: 'secondary', size: 'sm', icon: 'map',
        tooltip: { title: 'Centralizar', description: 'Move a câmera até esta construção.' }
      })
    ])
  ]);

  if (kingdom) node.style.setProperty('--ae-realm', kingdom.color);
  return node;
}

const CATEGORY_LABEL: Record<string, string> = {
  housing: 'Moradia', food: 'Alimento', extraction: 'Extração', craft: 'Manufatura',
  civic: 'Civil', military: 'Militar', religious: 'Religioso', commerce: 'Comércio',
  research: 'Pesquisa', infrastructure: 'Infraestrutura', wonder: 'Maravilha'
};

function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

// ============================ CONDITION ============================

function buildCondition(
  building: Building,
  city: City,
  kingdom: import('../../civ/Kingdom').Kingdom | null,
  jobs: number,
  staffed: number
): HTMLElement {
  const def = BUILDINGS[building.type];
  const rows: Child[] = [];

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
  rows.push(statRow({ label: 'Nível', value: `${building.level}`, icon: 'building' }));
  if (def?.storage) rows.push(statRow({ label: 'Armazenamento', value: `+${def.storage}`, icon: 'good' }));
  if (def?.research) rows.push(statRow({ label: 'Pesquisa', value: `+${def.research}`, unit: '/ ano', icon: 'technology' }));
  if (def?.defense) rows.push(statRow({ label: 'Defesa', value: `×${def.defense}`, icon: 'defence' }));

  const children: Child[] = [
    progressBar({
      label: 'Conservação',
      value: building.hp / building.maxHp,
      valueText: `${Math.round(building.hp)} / ${building.maxHp}`,
      status: building.hp / building.maxHp >= 0.6 ? 'positive' : building.hp / building.maxHp >= 0.3 ? 'warning' : 'critical'
    })
  ];

  // Staffing is only meaningful for a building that has posts to fill.
  if (jobs > 0) {
    children.push(progressBar({
      label: 'Ocupação dos postos',
      value: staffed / jobs,
      valueText: `${staffed} / ${jobs}`,
      status: staffed >= jobs ? 'positive' : staffed > 0 ? 'warning' : 'critical',
      tooltip: {
        title: 'Ocupação',
        description: 'Trabalhadores designados sobre os postos disponíveis. A produção escala com isso.',
        rows: [{ label: 'Fator de operação', value: `${Math.round(building.staffing * 100)}%` }]
      }
    }));
  }

  children.push(rowList(rows));
  return panel({ title: 'Estado', icon: 'building' }, children);
}

// ============================ EXTRACTION ============================

interface Deposit {
  good: GoodId;
  goodName: string;
  remaining: number;
  max: number;
}

/**
 * The natural deposit under an extraction building, if there is one.
 *
 * Read from the tile the building stands on, which is where the simulation keeps
 * it — so a mine reports the seam it is actually working rather than a nominal
 * figure from its own definition.
 */
function depositAt(building: Building, tile: Tile | null): Deposit | null {
  const def = BUILDINGS[building.type];
  if (!def?.extractionRate && !building.extractedGood) return null;

  const good: GoodId | null = building.extractedGood ?? tile?.resourceType ?? null;
  if (!good) return null;

  return {
    good,
    goodName: GOODS[good]?.name ?? good,
    remaining: tile?.resourceAmount ?? 0,
    max: tile?.resourceMax ?? 0
  };
}

function buildExtraction(
  building: Building,
  city: City,
  tile: Tile | null,
  host: InspectorHost
): HTMLElement | null {
  const def = BUILDINGS[building.type];
  const deposit = depositAt(building, tile);
  if (!deposit) return null;

  const good = deposit.good;
  const remaining = deposit.remaining;
  const max = deposit.max;
  const depleted = max > 0 && remaining <= 0;
  // Capacity, not output: rate × level × staffing is what the engine scales by,
  // but nothing records what was actually taken out last year.
  const capacity = (def?.extractionRate ?? 0) * building.level * building.staffing;

  return panel({
    title: 'Extração',
    icon: 'pickaxe',
    subtitle: depleted ? 'Depósito esgotado' : undefined
  }, [
    depleted
      ? el('div', { class: 'ae-insp-depleted' }, [
          icon('alert', { size: 16 }),
          el('span', { text: `A jazida de ${GOODS[good]?.name ?? good} está esgotada. Esta construção não produz mais nada.` })
        ])
      : null,
    max > 0
      ? progressBar({
          label: `Jazida de ${GOODS[good]?.name ?? good}`,
          value: remaining / max,
          valueText: `${formatFull(remaining)} / ${formatFull(max)}`,
          status: depleted ? 'critical' : remaining / max > 0.4 ? 'positive' : 'warning',
          tooltip: {
            title: 'Depósito restante',
            value: formatFull(remaining),
            description: 'Quantidade que ainda pode ser retirada deste tile.'
          }
        })
      : null,
    rowList([
      statRow({
        label: 'Recurso',
        value: GOODS[good]?.name ?? good,
        icon: 'good',
        onClick: () => host.openEconomy(good),
        tooltip: { title: GOODS[good]?.name ?? good, description: GOODS[good]?.description, footnote: 'Abrir na Economia' }
      }),
      statRow({ label: 'Restante', value: formatFull(remaining), icon: 'good', status: depleted ? 'critical' : undefined }),
      statRow({
        label: 'Capacidade de extração',
        value: capacity > 0 ? capacity.toFixed(1) : '0',
        unit: '/ ano',
        icon: 'industry',
        tooltip: {
          title: 'Capacidade de extração',
          description: 'Taxa nominal da construção, escalada pelo nível e pela ocupação atual. Não é o total realmente extraído — a simulação não registra produção por construção.',
          rows: [
            { label: 'Taxa base', value: `${def?.extractionRate ?? 0}` },
            { label: 'Nível', value: `×${building.level}` },
            { label: 'Ocupação', value: `×${building.staffing.toFixed(2)}` }
          ]
        }
      })
    ])
  ]);
}

// ============================ PRODUCTION ============================

interface Shortage {
  good: GoodId;
  goodName: string;
  needed: number;
  available: number;
}

/**
 * Which recipe input the settlement is short of.
 *
 * Only reports a shortage that can be established: the recipe is real, the stock
 * figure is real, and the comparison is between the two. Returns null when the
 * building has no recipe or nothing is actually short — never a guess at which
 * ingredient "feels" scarce.
 */
function limitingInput(building: Building, city: City): Shortage | null {
  const def = BUILDINGS[building.type];
  if (!def) return null;

  // Craft buildings work from the goods registry's recipes; everything else from
  // its own `consumes` upkeep.
  if (def.category === 'craft' && def.craftCapacity) {
    for (const goodId of Object.keys(GOODS) as GoodId[]) {
      if (GOODS[goodId].producedBy !== building.type) continue;
      for (const recipe of productionRecipesFor(goodId)) {
        for (const [input, amount] of Object.entries(recipe.inputs ?? {})) {
          const needed = amount as number;
          const available = city.stock.get(input as GoodId);
          if (available < needed) {
            return { good: input as GoodId, goodName: GOODS[input as GoodId]?.name ?? input, needed, available };
          }
        }
      }
    }
    return null;
  }

  for (const [input, amount] of Object.entries(def.consumes ?? {})) {
    const needed = amount as number;
    const available = city.stock.get(input as GoodId);
    if (available < needed) {
      return { good: input as GoodId, goodName: GOODS[input as GoodId]?.name ?? input, needed, available };
    }
  }
  return null;
}

/**
 * Inputs and outputs.
 *
 * For a craft building the real production chain comes from the goods registry —
 * the recipe that names this building as its producer — so a smithy shows
 * "iron 3 + coal 2 → steel 1" because that is literally what the engine runs.
 */
function buildProduction(building: Building, city: City): HTMLElement | null {
  const def = BUILDINGS[building.type];
  if (!def) return null;

  const hasFlow = Boolean(def.produces || def.consumes || (def.category === 'craft' && def.craftCapacity));
  if (!hasFlow) return null;

  const scale = building.level * building.staffing;
  const children: Child[] = [];

  // ---- Recipe chain, for craft buildings ----
  if (def.category === 'craft' && def.craftCapacity) {
    const recipes = (Object.keys(GOODS) as GoodId[])
      .filter(goodId => GOODS[goodId].producedBy === building.type)
      .flatMap(goodId => productionRecipesFor(goodId).map(recipe => ({ goodId, recipe })));

    if (recipes.length) {
      children.push(section('Cadeia produtiva', recipes.slice(0, 3).map(({ goodId, recipe }) =>
        el('div', { class: 'ae-insp-chain' }, [
          el('div', { class: 'ae-insp-chain-side' }, Object.entries(recipe.inputs ?? {}).map(([input, amount]) =>
            withTooltip(
              el('span', { class: 'ae-insp-chain-item' }, [
                icon('good', { size: 16 }),
                el('span', { text: `${GOODS[input as GoodId]?.name ?? input} ${amount}` })
              ]),
              {
                title: GOODS[input as GoodId]?.name ?? input,
                value: `${city.stock.get(input as GoodId).toFixed(1)} em estoque`,
                description: `${amount} por ciclo de produção.`,
                valueStatus: city.stock.get(input as GoodId) < (amount as number) ? 'critical' : 'positive'
              }
            )
          )),
          el('span', { class: 'ae-insp-chain-arrow', attrs: { 'aria-hidden': 'true' }, text: '→' }),
          el('div', { class: 'ae-insp-chain-side' }, [
            withTooltip(
              el('span', { class: 'ae-insp-chain-item ae-insp-chain-out' }, [
                icon('industry', { size: 16 }),
                el('span', { text: `${GOODS[goodId]?.name ?? goodId} ${recipe.output}` })
              ]),
              { title: GOODS[goodId]?.name ?? goodId, description: GOODS[goodId]?.description }
            )
          ])
        ])
      ), { hint: `${(def.craftCapacity * scale).toFixed(1)} ciclos/ano` }));
    }
  }

  // ---- Rated output ----
  if (def.produces) {
    children.push(section('Produção nominal', [
      rowList(Object.entries(def.produces).map(([good, base]) =>
        statRow({
          label: GOODS[good as GoodId]?.name ?? good,
          value: ((base as number) * scale).toFixed(1),
          unit: '/ ano',
          icon: 'good',
          tooltip: {
            title: GOODS[good as GoodId]?.name ?? good,
            description: 'Capacidade nominal: valor de base da construção escalado por nível e ocupação. A simulação não registra a produção efetiva por construção.',
            rows: [
              { label: 'Base', value: `${base}` },
              { label: 'Nível', value: `×${building.level}` },
              { label: 'Ocupação', value: `×${building.staffing.toFixed(2)}` }
            ]
          }
        })
      ))
    ], { hint: 'capacidade' }));
  }

  // ---- Upkeep ----
  if (def.consumes) {
    children.push(section('Consumo', [
      rowList(Object.entries(def.consumes).map(([good, amount]) => {
        const available = city.stock.get(good as GoodId);
        const short = available < (amount as number);
        return statRow({
          label: GOODS[good as GoodId]?.name ?? good,
          value: `${amount}`,
          unit: '/ ano',
          icon: 'good',
          status: short ? 'critical' : undefined,
          tooltip: {
            title: GOODS[good as GoodId]?.name ?? good,
            value: `${available.toFixed(1)} em estoque`,
            valueStatus: short ? 'critical' : 'positive',
            description: short
              ? `${city.name} não tem o suficiente para manter esta construção em operação.`
              : 'Estoque suficiente na cidade.'
          }
        });
      }))
    ]));
  }

  return children.length
    ? panel({ title: 'Economia da construção', icon: 'industry' }, children)
    : null;
}

// ============================ RESIDENTS ============================

/**
 * Who lives and works here, as links.
 *
 * Resolved from the id sets the building already holds, capped so a large housing
 * block does not turn the inspector into a directory. The cap is stated rather
 * than silently truncating.
 */
function buildResidents(building: Building, host: InspectorHost): HTMLElement | null {
  const def = BUILDINGS[building.type];
  const workerIds = Array.from(building.assignedWorkerIds);
  const residentIds = Array.from(building.residentIds);
  if (!workerIds.length && !residentIds.length) return null;

  const sim = host.ctx.sim;
  const LIMIT = 6;
  // One pass over the population, building a lookup for just the ids in question —
  // rather than a `find` per id, which would be a scan each.
  const wanted = new Set([...workerIds, ...residentIds]);
  const byId = new Map<string, import('../../entities/Entity').Entity>();
  for (const entity of sim.entities) {
    if (wanted.has(entity.id)) byId.set(entity.id, entity);
    if (byId.size === wanted.size) break;
  }

  const linkList = (ids: string[]) => badgeRow(ids.slice(0, LIMIT).map(id => {
    const entity = byId.get(id);
    if (!entity) return null;
    return objectLink(
      { kind: 'citizen', id: entity.id, name: entity.name, qualifier: `${Math.floor(entity.age)}a` },
      { variant: 'chip' }
    );
  }).filter(Boolean) as HTMLElement[]);

  const children: Child[] = [];
  if (workerIds.length) {
    children.push(section('Trabalhadores', [linkList(workerIds)], {
      hint: workerIds.length > LIMIT ? `${LIMIT} de ${workerIds.length}` : `${workerIds.length}`
    }));
  }
  if (residentIds.length && def?.housing) {
    children.push(section('Moradores', [linkList(residentIds)], {
      hint: residentIds.length > LIMIT ? `${LIMIT} de ${residentIds.length}` : `${residentIds.length}`
    }));
  }

  return children.length ? panel({ title: 'Pessoas', icon: 'population' }, children) : null;
}
