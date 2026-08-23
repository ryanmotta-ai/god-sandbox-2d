/**
 * Compact previews for cities, realms and terrain.
 *
 * UI-2 owns citizens and buildings; the full settlement and realm dossiers are
 * UI-3 and UI-4. So these are previews by design — the figures that identify the
 * place, the conditions worth knowing about, and links onward. They are
 * deliberately *not* stubs: a preview that says nothing would make the inspector
 * feel broken for two of its four modes.
 *
 * Note what these replace. The pre-UI-2 inspector had long city and realm
 * sections covering culture, society, laws and stockpiles. That detail is
 * retired here rather than carried forward at half quality, because UI-3/UI-4
 * will build it properly against the same object-link plumbing. The screens that
 * already cover this ground — Kingdoms, Politics, Economy — are one click away
 * from every preview below, so nothing becomes unreachable in the meantime.
 */
import { el, Child } from '../core/Dom';
import {
  panel, section, statRow, rowList, statGrid, stat, progressBar, badge, badgeRow,
  objectLink, icon, button, emptyState, formatFull, formatCompact, withTooltip
} from '../kit';
import { BUILDINGS } from '../../civ/Building';
import { GOODS, type GoodId } from '../../civ/Goods';
import { TERRAINS } from '../../world/Biomes';
import { sound } from '../../core/SoundSynth';
import { getCityBlueprint, ALL_BLUEPRINT_IDS } from '../../civ/CityBlueprints';
import type { InspectorHost } from './Inspector';
import type { City } from '../../civ/City';
import type { Kingdom } from '../../civ/Kingdom';
import type { Tile } from '../../world/Tile';

// ============================ CITY ============================

export function buildCityPanel(city: City, host: InspectorHost): Child[] {
  const sim = host.ctx.sim;
  const kingdom = city.kingdomId ? sim.kingdoms.get(city.kingdomId) ?? null : null;
  const besieger = city.besiegerId ? sim.kingdoms.get(city.besiegerId) ?? null : null;

  // The condition line comes first because a siege or a famine changes what every
  // other figure on the panel means.
  const condition = besieger
    ? { label: 'Sitiada', detail: `Cercada por ${besieger.name}`, status: 'critical' as const, icon: 'defence' }
    : city.famineYears > 0
      ? { label: 'Passando fome', detail: `${city.famineYears} ${city.famineYears === 1 ? 'ano' : 'anos'} de escassez`, status: 'critical' as const, icon: 'agriculture' }
      : { label: 'Estável', detail: undefined, status: 'positive' as const, icon: 'city' };

  const header = el('div', { class: 'ae-insp-header' }, [
    el('div', { class: 'ae-insp-identity' }, [
      icon('city', { size: 32 }),
      el('div', { class: 'ae-insp-identity-text' }, [
        el('h2', { class: 'ae-insp-name', text: city.name }),
        el('span', { class: 'ae-insp-subtitle', text: `${city.tierInfo.name} · fundada no ano ${city.foundingYear}` })
      ])
    ]),
    el('div', { class: `ae-insp-activity ae-insp-activity-${condition.status}` }, [
      icon(condition.icon, { size: 16, class: 'ae-insp-activity-icon' }),
      el('div', { class: 'ae-insp-activity-text' }, [
        el('span', { class: 'ae-insp-activity-label', text: condition.label }),
        condition.detail ? el('span', { class: 'ae-insp-activity-reason', text: condition.detail }) : null
      ])
    ]),
    el('div', { class: 'ae-insp-actions' }, [
      // The dossier is the primary action now that UI-3 exists: the preview
      // answers "which city is this", the dossier answers "how is it doing".
      button('Dossiê', () => host.openCityDossier(city.id), {
        variant: 'primary', size: 'sm', icon: 'city',
        tooltip: {
          title: 'Dossiê da cidade',
          description: 'População, mercado, indústria, logística e história em uma tela.'
        }
      }),
      button('+300 Comida', () => {
        city.stock.add('food', 300);
        city.famineYears = 0;
        city.prosperity = Math.min(1, city.prosperity + 0.2);
        host.ctx.toast(`🌾 Fartura Divina: +300 Comida adicionada a ${city.name}!`, 'info');
        sound.playMagic();
      }, {
        variant: 'secondary', size: 'sm', icon: 'farm',
        tooltip: { title: 'Fartura Divina', description: 'Adiciona +300 Comida instantaneamente ao armazém desta cidade.' }
      }),
      button('Centralizar', () => host.focusOn(city.x, city.y), {
        variant: 'ghost', size: 'sm', icon: 'map'
      })
    ])
  ]);
  if (kingdom) header.style.setProperty('--ae-realm', kingdom.color);

  const jobs = city.jobCount();
  const filled = city.filledJobs();

  return [
    header,

    panel({ title: 'Assentamento', icon: 'city' }, [
      statGrid([
        stat({ label: 'População', value: city.population, icon: 'population' }),
        stat({ label: 'Construções', value: city.buildings.size, icon: 'building' }),
        stat({ label: 'Território', value: city.territory.size, unit: 'tiles', icon: 'map' })
      ]),
      progressBar({
        label: 'Prosperidade',
        value: city.prosperity,
        valueText: `${Math.round(city.prosperity * 100)}%`,
        status: city.prosperity >= 0.6 ? 'positive' : city.prosperity >= 0.35 ? 'neutral' : 'warning'
      }),
      jobs > 0
        ? progressBar({
            label: 'Empregos ocupados',
            value: filled / jobs,
            valueText: `${filled} / ${jobs}`,
            status: filled / jobs >= 0.8 ? 'positive' : filled / jobs >= 0.4 ? 'neutral' : 'warning'
          })
        : null,
      progressBar({
        label: 'Moradias ocupadas',
        value: city.housingCapacity() > 0 ? Math.min(1, city.population / city.housingCapacity()) : 1,
        valueText: `${city.population} / ${city.housingCapacity()}`,
        status: city.population <= city.housingCapacity() ? 'positive' : 'warning',
        tooltip: {
          title: 'Moradias',
          description: 'População contra capacidade habitacional. Acima da capacidade o conforto cai.'
        }
      }),
      rowList([
        kingdom
          ? el('div', { class: 'ae-row' }, [
              icon('kingdom', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label', text: 'Reino' }),
              el('span', { class: 'ae-row-value' }, [
                objectLink({ kind: 'kingdom', id: kingdom.id, name: kingdom.name, accent: kingdom.color })
              ])
            ])
          : statRow({ label: 'Reino', value: 'Independente', icon: 'kingdom' }),
        statRow({ label: 'Fundador', value: city.founderName, icon: 'citizen' }),
        statRow({ label: 'Espécie', value: city.species, icon: 'population' }),
        (() => {
          let bp = getCityBlueprint(city.blueprintId);
          const badgeEl = badge(bp.name, { color: bp.accentColor, size: 'sm', variant: 'outline' });
          return withTooltip(
            el('div', {
              class: 'ae-row',
              style: 'cursor: pointer;',
              on: {
                click: () => {
                  const allIds = ALL_BLUEPRINT_IDS;
                  const nextIndex = (allIds.indexOf(city.blueprintId) + 1) % allIds.length;
                  city.blueprintId = allIds[nextIndex];
                  bp = getCityBlueprint(city.blueprintId);
                  badgeEl.textContent = bp.name;
                  badgeEl.style.color = bp.accentColor;
                  host.ctx.toast(`Plano Diretor de ${city.name} alterado para [${bp.name}]!`, 'info');
                  sound.playClick();
                }
              }
            }, [
              icon('city', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label', text: 'Plano Diretor Urbano' }),
              badgeEl
            ]),
            {
              title: `Plano Diretor: ${bp.name}`,
              description: `${bp.subtitle}\n\n${bp.description}\n\n• Pavimentação: ${bp.pavingStyle}\n• Paisagismo: ${bp.foliagePattern}\n• Clique para alternar o estilo arquitetônico.`
            }
          );
        })()
      ])
    ]),

    buildCityStores(city),
    buildCityBuildings(city, host),

    // Says out loud that this is a preview, so its shallowness reads as a phase
    // boundary rather than as missing work.
    el('p', { class: 'ae-insp-note', text: 'Prévia da cidade. Abra o dossiê para diagnóstico, indústria, comércio e história.' })
  ];
}

/** The settlement's stock, limited to what it actually holds. */
function buildCityStores(city: City): HTMLElement | null {
  const held = (Object.keys(GOODS) as GoodId[])
    .map(good => ({ good, amount: city.stock.get(good) }))
    .filter(entry => entry.amount > 0.05)
    .sort((a, b) => b.amount - a.amount);

  if (!held.length) {
    return panel({ title: 'Armazém', icon: 'good' }, [
      emptyState({ icon: 'good', title: 'Armazém vazio', hint: 'Nada estocado nesta cidade no momento.', compact: true })
    ]);
  }

  const TOP = 8;
  return panel({
    title: 'Armazém',
    icon: 'good',
    subtitle: held.length > TOP ? `${TOP} de ${held.length} bens` : `${held.length} bens`
  }, [
    rowList(held.slice(0, TOP).map(({ good, amount }) =>
      statRow({
        label: GOODS[good]?.name ?? good,
        value: formatCompact(amount),
        icon: 'good',
        status: good === 'food' && amount < 5 ? 'critical' : undefined,
        tooltip: {
          title: GOODS[good]?.name ?? good,
          value: amount.toFixed(1),
          description: GOODS[good]?.description
        }
      })
    ))
  ]);
}

/** The buildings, grouped by type so a settlement of forty huts stays readable. */
function buildCityBuildings(city: City, host: InspectorHost): HTMLElement | null {
  if (city.buildings.size === 0) {
    return panel({ title: 'Construções', icon: 'building' }, [
      emptyState({ icon: 'building', title: 'Nada construído', hint: 'Este assentamento ainda não ergueu nada.', compact: true })
    ]);
  }

  // Grouped by type, keeping one representative so the row can still link to a
  // real building rather than to an abstraction.
  const groups = new Map<string, { count: number; sample: import('../../civ/Building').Building }>();
  for (const building of city.buildings.values()) {
    const existing = groups.get(building.type);
    if (existing) existing.count++;
    else groups.set(building.type, { count: 1, sample: building });
  }

  const sorted = Array.from(groups.entries()).sort((a, b) => b[1].count - a[1].count);

  return panel({ title: 'Construções', icon: 'building', subtitle: `${city.buildings.size} no total` }, [
    rowList(sorted.slice(0, 10).map(([type, { count, sample }]) => {
      const def = BUILDINGS[type as keyof typeof BUILDINGS];
      return el('div', { class: 'ae-row' }, [
        icon('building', { size: 16, class: 'ae-row-icon' }),
        el('span', { class: 'ae-row-label' }, [
          objectLink(
            { kind: 'building', id: sample.id, name: def?.name ?? type },
            { showIcon: false }
          )
        ]),
        el('span', { class: 'ae-row-value' }, [
          el('span', { class: 'ae-row-figure', text: `${count}` })
        ])
      ]);
    }))
  ]);
}

// ============================ KINGDOM ============================

export function buildKingdomPanel(kingdom: Kingdom, host: InspectorHost): Child[] {
  const sim = host.ctx.sim;

  // One pass over this realm's own settlements — bounded by `cityIds`, not by the
  // world — collecting everything the preview reports.
  let population = 0;
  let territory = 0;
  let atWar = 0;
  const cities: City[] = [];
  for (const cityId of kingdom.cityIds) {
    const city = sim.cities.get(cityId);
    if (!city) continue;
    cities.push(city);
    population += city.population;
    territory += city.territory.size;
  }
  for (const war of sim.diplomacy.activeWars.values()) {
    if (war.attacker === kingdom.id || war.defender === kingdom.id) atWar++;
  }

  const capital = sim.cities.get(kingdom.capitalCityId) ?? null;
  const ruler = kingdom.rulerId ? sim.entities.find(e => e.id === kingdom.rulerId) ?? null : null;

  const header = el('div', { class: 'ae-insp-header' }, [
    el('div', { class: 'ae-insp-identity' }, [
      icon('kingdom', { size: 32 }),
      el('div', { class: 'ae-insp-identity-text' }, [
        el('h2', { class: 'ae-insp-name', text: kingdom.name }),
        el('span', { class: 'ae-insp-subtitle', text: `Fundado no ano ${kingdom.foundingYear}` })
      ])
    ]),
    el('div', { class: `ae-insp-activity ae-insp-activity-${atWar > 0 ? 'critical' : 'positive'}` }, [
      icon(atWar > 0 ? 'war' : 'diplomacy', { size: 16, class: 'ae-insp-activity-icon' }),
      el('div', { class: 'ae-insp-activity-text' }, [
        el('span', { class: 'ae-insp-activity-label', text: atWar > 0 ? 'Em guerra' : 'Em paz' }),
        atWar > 0
          ? el('span', { class: 'ae-insp-activity-reason', text: `${atWar} conflito${atWar === 1 ? '' : 's'} em curso` })
          : null
      ])
    ]),
    el('div', { class: 'ae-insp-actions' }, [
      // The dossier is the primary action now that UI-4 exists: the preview says
      // which realm this is, the dossier says how it works and why it is strong.
      button('Dossiê', () => host.openRealmDossier(kingdom.id), {
        variant: 'primary', size: 'sm', icon: 'kingdom',
        tooltip: {
          title: 'Dossiê do reino',
          description: 'Economia, sociedade, política, diplomacia, exército, infraestrutura e tecnologia em uma tela.'
        }
      }),
      button('+1.000 Ouro', () => {
        kingdom.treasury.add('gold', 1000);
        kingdom.economy.treasury += 1000;
        host.ctx.toast(`💰 Chuva de Ouro: +1.000 Ouro adicionado ao tesouro de ${kingdom.name}!`, 'info');
        sound.playMagic();
      }, {
        variant: 'secondary', size: 'sm', icon: 'coin',
        tooltip: { title: 'Chuva de Ouro', description: 'Adiciona +1.000 Ouro instantaneamente ao tesouro deste reino.' }
      }),
      capital
        ? button('Capital', () => host.focusOn(capital.x, capital.y), {
            variant: 'secondary', size: 'sm', icon: 'map',
            tooltip: { title: 'Ir à capital', description: capital.name }
          })
        : null,
      button('Comparar', () => host.openKingdoms(kingdom.id), {
        variant: 'ghost', size: 'sm', icon: 'statistics',
        tooltip: { title: 'Comparar reinos', description: 'Abre a tela de reinos focada neste.', shortcut: 'K' }
      })
    ])
  ]);
  header.style.setProperty('--ae-realm', kingdom.color);

  return [
    header,

    panel({ title: 'Domínio', icon: 'kingdom' }, [
      statGrid([
        stat({ label: 'População', value: population, icon: 'population' }),
        stat({ label: 'Cidades', value: cities.length, icon: 'city' }),
        stat({ label: 'Território', value: territory, unit: 'tiles', icon: 'map' })
      ]),
      rowList([
        ruler
          ? el('div', { class: 'ae-row' }, [
              icon('crown', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label', text: 'Governante' }),
              el('span', { class: 'ae-row-value' }, [
                objectLink(
                  { kind: 'citizen', id: ruler.id, name: ruler.title ?? ruler.name, accent: kingdom.color },
                  { showIcon: false }
                )
              ])
            ])
          : statRow({ label: 'Governante', value: 'Trono vago', icon: 'crown', status: 'warning' }),
        capital
          ? el('div', { class: 'ae-row' }, [
              icon('city', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label', text: 'Capital' }),
              el('span', { class: 'ae-row-value' }, [
                objectLink({ kind: 'city', id: capital.id, name: capital.name, accent: kingdom.color })
              ])
            ])
          : statRow({ label: 'Capital', value: 'Sem capital', icon: 'city', status: 'warning' }),
        statRow({ label: 'Tesouro', value: formatFull(kingdom.wealth), icon: 'economy' }),
        statRow({ label: 'Nível cultural', value: `${kingdom.cultureLevel}`, icon: 'culture' })
      ])
    ]),

    cities.length
      ? panel({ title: 'Assentamentos', icon: 'city', subtitle: `${cities.length}` }, [
          rowList(
            [...cities]
              .sort((a, b) => b.population - a.population)
              .slice(0, 8)
              .map(city => el('div', { class: 'ae-row' }, [
                icon('city', { size: 16, class: 'ae-row-icon' }),
                el('span', { class: 'ae-row-label' }, [
                  objectLink(
                    { kind: 'city', id: city.id, name: city.name, accent: kingdom.color },
                    { showIcon: false }
                  )
                ]),
                el('span', { class: 'ae-row-value' }, [
                  el('span', { class: 'ae-row-figure', text: formatCompact(city.population) }),
                  el('span', { class: 'ae-row-unit', text: 'hab.' })
                ])
              ]))
          )
        ])
      : null,

    el('p', { class: 'ae-insp-note', text: 'Prévia do reino. Abra o dossiê para diagnóstico, economia, sociedade, política, diplomacia, exército, infraestrutura e tecnologia.' })
  ];
}

// ============================ TILE ============================

/**
 * Terrain. Kept because "what is this ground?" is a real question and the
 * selection system answers a click on empty land with a tile.
 */
export function buildTilePanel(tile: Tile, host: InspectorHost): Child[] {
  const terrain = TERRAINS[tile.type];
  const city = tile.cityId ? host.ctx.sim.cities.get(tile.cityId) ?? null : null;
  const kingdom = tile.kingdomId ? host.ctx.sim.kingdoms.get(tile.kingdomId) ?? null : null;
  const good = tile.resourceType;

  const header = el('div', { class: 'ae-insp-header' }, [
    el('div', { class: 'ae-insp-identity' }, [
      icon(good ? 'good' : 'map', { size: 32 }),
      el('div', { class: 'ae-insp-identity-text' }, [
        el('h2', { class: 'ae-insp-name', text: terrain?.name ?? tile.type }),
        el('span', { class: 'ae-insp-subtitle', text: `${Math.floor(tile.x)}, ${Math.floor(tile.y)}` })
      ])
    ]),
    badgeRow([
      tile.isOnFire ? badge('Em chamas', { size: 'sm', status: 'critical', icon: 'disaster' }) : null,
      tile.roadLevel > 0 ? badge(`Estrada nível ${tile.roadLevel}`, { size: 'sm', variant: 'outline', icon: 'route' }) : null
    ])
  ]);
  if (kingdom) header.style.setProperty('--ae-realm', kingdom.color);

  return [
    header,
    panel({ title: 'Terreno', icon: 'map' }, [
      good
        ? progressBar({
            label: `Depósito de ${GOODS[good]?.name ?? good}`,
            value: tile.resourceMax > 0 ? tile.resourceAmount / tile.resourceMax : 0,
            valueText: `${formatFull(tile.resourceAmount)} / ${formatFull(tile.resourceMax)}`,
            status: tile.resourceAmount <= 0 ? 'critical' : 'positive'
          })
        : null,
      rowList([
        statRow({ label: 'Altitude', value: tile.height.toFixed(2), icon: 'map' }),
        statRow({ label: 'Temperatura', value: tile.temperature.toFixed(2), icon: 'climate' }),
        statRow({ label: 'Umidade', value: tile.moisture.toFixed(2), icon: 'climate' }),
        statRow({ label: 'Fertilidade', value: tile.fertility.toFixed(2), icon: 'agriculture' }),
        city
          ? el('div', { class: 'ae-row' }, [
              icon('city', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label', text: 'Cidade' }),
              el('span', { class: 'ae-row-value' }, [
                objectLink({ kind: 'city', id: city.id, name: city.name, accent: kingdom?.color })
              ])
            ])
          : null,
        kingdom
          ? el('div', { class: 'ae-row' }, [
              icon('kingdom', { size: 16, class: 'ae-row-icon' }),
              el('span', { class: 'ae-row-label', text: 'Reino' }),
              el('span', { class: 'ae-row-value' }, [
                objectLink({ kind: 'kingdom', id: kingdom.id, name: kingdom.name, accent: kingdom.color })
              ])
            ])
          : null
      ])
    ])
  ];
}
