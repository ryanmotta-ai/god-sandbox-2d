/**
 * Technology Command Center snapshot.
 *
 * This module deliberately owns no simulation state. It resolves the technology
 * graph once, then projects one realm's live knowledge onto the material facts
 * already produced by the economy, infrastructure and equipment systems.
 */
import {
  ALL_TECH_IDS, TECH_ERAS, TECHNOLOGIES, demandCreatedBy,
  type TechDefinition, type TechEra, type TechFeature, type TechTrack
} from '../../civ/TechTree';
import { BUILDINGS, type BuildingCategory, type BuildingType } from '../../civ/Building';
import {
  ALL_GOODS, GOODS, productionRecipesFor,
  type GoodId, type ProductionRecipe
} from '../../civ/Goods';
import { GOVERNMENTS } from '../../civ/Government';
import { chronicle, type HistoryEvent } from '../../civ/Chronicle';
import { EQUIPMENT_TECH, EQUIPMENT_TIERS_BY_RANK, WEAPON_TIERS, type EquipmentTier } from '../../entities/Equipment';
import type { Kingdom } from '../../civ/Kingdom';
import type { City } from '../../civ/City';
import type { GameContext } from '../core/GameContext';
import type { LogisticsMetrics } from '../logistics/LogisticsMetrics';

export type TechnologyStatus = 'discovered' | 'researching' | 'available' | 'locked';
export type CapabilityState = 'deployed' | 'available' | 'limited' | 'unavailable';
export type UnlockKind = 'buildings' | 'goods' | 'infrastructure' | 'military' | 'systems' | 'other';

/** Last measured UI-8 costs, kept out of simulation state and useful to perf probes. */
export const technologyUIPerformance: {
  screenOpenMs: number | null;
  treeLayoutMs: number | null;
  capabilitySnapshotMs: number | null;
  updateMs: number | null;
} = {
  screenOpenMs: null,
  treeLayoutMs: null,
  capabilitySnapshotMs: null,
  updateMs: null
};

export interface TechnologyUnlock {
  kind: UnlockKind;
  id: string;
  name: string;
  icon?: string;
  objectKind?: 'building' | 'good' | 'technology';
  description?: string;
}

export interface TechnologyView {
  definition: TechDefinition;
  status: TechnologyStatus;
  cost: number;
  progress: number;
  progressFraction: number;
  prerequisites: Array<{ id: string; name: string; known: boolean }>;
  excludedBy: Array<{ id: string; name: string }>;
  dependents: Array<{ id: string; name: string }>;
  unlocks: TechnologyUnlock[];
  demandedGoods: Array<{ good: GoodId; weight: number }>;
  searchText: string;
}

export interface RealmGoodCapability {
  good: GoodId;
  name: string;
  icon: string;
  stock: number;
  produced: number;
  consumed: number;
  imported: number;
  exported: number;
  /** Imported share of observed new supply (production + imports). */
  importDependency: number | null;
  producerBuilding: BuildingType | null;
  producerBuildings: number;
  producerCities: Array<{ id: string; name: string }>;
  recipes: ProductionRecipe[];
  required: boolean;
  unlocked: boolean;
  available: boolean;
  producing: boolean;
}

export interface BuildingDeployment {
  type: BuildingType;
  name: string;
  icon: string;
  category: BuildingCategory;
  count: number;
  operational: number;
  cities: Array<{ id: string; name: string }>;
  instances: Array<{ id: string; cityId: string; cityName: string }>;
  meanCondition: number | null;
  meanStaffing: number | null;
}

export interface InfrastructureDeployment {
  kind: 'road' | 'rail' | 'port' | 'shipping';
  label: string;
  deployed: number;
  total: number;
  damaged: number;
  detail: string;
  cityIds: string[];
}

export interface MilitaryDeployment {
  tier: EquipmentTier;
  label: string;
  adopted: number;
  total: number;
  requiredGoods: GoodId[];
  weapons: string[];
}

export interface CapabilityView {
  techId: string;
  name: string;
  state: CapabilityState;
  /** The engine's existing building/material capacity result, when material. */
  engineCapacity: number | null;
  missingBuildings: BuildingType[];
  missingGoods: GoodId[];
  buildings: BuildingDeployment[];
  goods: RealmGoodCapability[];
  infrastructure: InfrastructureDeployment[];
  military: MilitaryDeployment | null;
  deployedCities: Array<{ id: string; name: string }>;
  evidence: string[];
  hasPhysicalDeployment: boolean;
}

export interface ResearchSource {
  id: string;
  label: string;
  amount: number;
  kind: 'population' | 'building';
}

export interface TechnologyHistoryEntry {
  event: HistoryEvent;
  techId: string | null;
  techName: string | null;
}

export interface WorldTechnologyRealm {
  kingdomId: string;
  name: string;
  color: string;
  era: TechEra;
  eraName: string;
  known: number;
  researchOutput: number;
}

export interface TechnologyUISnapshot {
  year: number;
  kingdomId: string;
  kingdomName: string;
  kingdomColor: string;
  cityCount: number;
  knownCount: number;
  totalCount: number;
  knownEra: TechEra;
  knownEraName: string;
  operatingEra: TechEra;
  operatingEraName: string;
  previousEra: TechEra | null;
  nextEra: TechEra | null;
  current: TechnologyView | null;
  researchOutput: number;
  researchSources: ResearchSource[];
  technologies: TechnologyView[];
  available: TechnologyView[];
  capabilities: CapabilityView[];
  recentDiscoveries: TechnologyHistoryEntry[];
  history: TechnologyHistoryEntry[];
  world: WorldTechnologyRealm[];
  createdAt: number;
  buildTimeMs: number;
}

const FEATURE_NAME: Record<TechFeature, string> = {
  currency: 'Sistema monetário',
  trade_routes: 'Rotas comerciais terrestres',
  maritime_trade: 'Comércio marítimo',
  banking: 'Sistema bancário',
  stock_market: 'Bolsa de valores',
  central_planning: 'Planejamento central',
  writing: 'Registros escritos',
  diplomacy_pacts: 'Pactos diplomáticos formais',
  colonisation: 'Colonização ultramarina',
  conscription: 'Conscrição',
  railways: 'Ferrovias e locomotivas',
  mass_production: 'Produção em massa',
  air_defense_grid: 'Rede de Defesa Antiaérea (SAM)',
  nuclear_weapons: 'Arsenal e Ogivas Nucleares',
  drone_swarms: 'Enxames de Drones Autônomos'
};

/**
 * System links whose gates live outside TechTree.ts. Each entry mirrors a real
 * engine check: roads in CivilizationEngine/CaravanSystem, rail in
 * RailwayNetwork and ship tiers in NavalSystem.
 */
const ENGINE_SYSTEM_UNLOCKS: Partial<Record<string, TechnologyUnlock[]>> = {
  masonry: [{ kind: 'infrastructure', id: 'stone-roads', name: 'Estradas de pedra', description: 'Permite estradas de nível 2.' }],
  roads: [{ kind: 'infrastructure', id: 'road-network', name: 'Rede de estradas pavimentadas', description: 'Permite estradas de nível 2 e melhora o movimento terrestre.' }],
  sailing: [{ kind: 'infrastructure', id: 'ship-tier-2', name: 'Caravela Mercante', description: 'O primeiro nível de navio de mar aberto.' }],
  engineering: [
    { kind: 'infrastructure', id: 'imperial-roads', name: 'Estradas imperiais', description: 'Permite estradas de nível 3.' },
    { kind: 'infrastructure', id: 'ship-tier-3', name: 'Galeão Imperial', description: 'Nível de navio de engenharia, ainda limitado pela infraestrutura portuária.' }
  ],
  steam_power: [{ kind: 'infrastructure', id: 'railway', name: 'Ferrovia', description: 'A construção de ferrovias consome Aço e Madeira.' }],
  industrialization: [{ kind: 'infrastructure', id: 'ship-tier-4', name: 'Cruzador de Aço', description: 'Nível de navio industrial; requer um porto profundo e consome Combustível.' }]
};

const EQUIPMENT_LABEL: Record<EquipmentTier, string> = {
  primitive: 'Equipamento primitivo',
  iron: 'Equipamento de ferro',
  steel: 'Equipamento de aço',
  gunpowder: 'Equipamento de pólvora',
  industrial: 'Equipamento industrial'
};

/** Materials the equipment system physically consumes for each gated tier. */
const EQUIPMENT_GOODS: Record<EquipmentTier, GoodId[]> = {
  primitive: ['wood'],
  iron: ['iron', 'wood'],
  steel: ['steel', 'tools'],
  gunpowder: ['steel', 'gunpowder', 'tools'],
  industrial: ['steel', 'gunpowder', 'machinery']
};

function statusOf(kingdom: Kingdom, techId: string): TechnologyStatus {
  if (kingdom.research.known.has(techId)) return 'discovered';
  if (kingdom.research.current === techId) return 'researching';
  if (kingdom.research.isAvailable(techId)) return 'available';
  return 'locked';
}

function unlocksFor(tech: TechDefinition): TechnologyUnlock[] {
  const result: TechnologyUnlock[] = [];
  for (const type of tech.unlocks.buildings ?? []) {
    const def = BUILDINGS[type];
    result.push({ kind: 'buildings', id: type, name: def?.name ?? type, icon: def?.icon, objectKind: 'building' });
  }
  for (const good of tech.unlocks.goods ?? []) {
    const def = GOODS[good];
    result.push({ kind: 'goods', id: good, name: def?.name ?? good, icon: def?.icon, objectKind: 'good' });
  }
  for (const government of tech.unlocks.governments ?? []) {
    result.push({
      kind: 'systems', id: government, name: GOVERNMENTS[government]?.name ?? government,
      description: 'Governo adotável'
    });
  }
  for (const feature of tech.unlocks.features ?? []) {
    result.push({ kind: 'systems', id: feature, name: FEATURE_NAME[feature] ?? feature });
  }
  result.push(...(ENGINE_SYSTEM_UNLOCKS[tech.id] ?? []));

  const tier = EQUIPMENT_TIERS_BY_RANK.find(candidate => EQUIPMENT_TECH[candidate] === tech.id);
  if (tier) {
    result.push({
      kind: 'military', id: `equipment-${tier}`, name: EQUIPMENT_LABEL[tier],
      description: WEAPON_TIERS[tier].map(item => item.name).join(', ')
    });
  }
  return result;
}

function buildTechnologyViews(kingdom: Kingdom): TechnologyView[] {
  const cityCount = kingdom.cityIds.size;
  return ALL_TECH_IDS.map(id => {
    const definition = TECHNOLOGIES[id];
    // The realm's own price, discounted by what its neighbours already know, so
    // the screen agrees with what research is actually being charged.
    const cost = kingdom.research.costOf(definition, cityCount);
    const progress = kingdom.research.current === id ? kingdom.research.progress : 0;
    const unlocks = unlocksFor(definition);
    const prerequisites = definition.requires.map(req => ({
      id: req,
      name: TECHNOLOGIES[req]?.name ?? req,
      known: kingdom.research.known.has(req)
    }));
    const excludedBy = ALL_TECH_IDS
      .filter(other => kingdom.research.known.has(other) && TECHNOLOGIES[other]?.excludes?.includes(id))
      .map(other => ({ id: other, name: TECHNOLOGIES[other]?.name ?? other }));
    const dependents = ALL_TECH_IDS
      .filter(other => TECHNOLOGIES[other]?.requires.includes(id))
      .map(other => ({ id: other, name: TECHNOLOGIES[other].name }));
    const demandedGoods = demandCreatedBy(id);
    return {
      definition,
      status: statusOf(kingdom, id),
      cost,
      progress,
      progressFraction: cost > 0 ? Math.min(1, progress / cost) : 0,
      prerequisites,
      excludedBy,
      dependents,
      unlocks,
      demandedGoods,
      searchText: [
        definition.name,
        TECH_ERAS[definition.era].name,
        definition.track,
        ...unlocks.map(unlock => unlock.name),
        ...demandedGoods.map(entry => GOODS[entry.good]?.name ?? entry.good)
      ].join(' ').toLocaleLowerCase('pt-BR')
    };
  });
}

function citiesOf(kingdom: Kingdom, ctx: GameContext): City[] {
  return [...kingdom.cityIds]
    .map(id => ctx.sim.cities.get(id))
    .filter((city): city is City => Boolean(city));
}

function researchSources(cities: City[]): ResearchSource[] {
  const totals = new Map<string, ResearchSource>();
  const add = (id: string, label: string, amount: number, kind: ResearchSource['kind']) => {
    if (amount <= 0) return;
    const current = totals.get(id);
    if (current) current.amount += amount;
    else totals.set(id, { id, label, amount, kind });
  };

  for (const city of cities) {
    const populationRaw = city.population * 0.75;
    const buildingRaw = new Map<BuildingType, number>();
    let buildingTotal = 0;
    for (const building of city.buildings.values()) {
      const base = (building.definition.research ?? 0) * building.outputMultiplier();
      if (base <= 0) continue;
      buildingTotal += base;
      buildingRaw.set(building.type, (buildingRaw.get(building.type) ?? 0) + base);
    }
    const rawTotal = populationRaw + buildingTotal;
    if (rawTotal <= 0 || city.researchOutput <= 0) continue;
    // All sources inside a city share the same prosperity/culture/government/law
    // multiplier, so this proportional allocation reconstructs the exact total.
    const scale = city.researchOutput / rawTotal;
    add('population', 'População', populationRaw * scale, 'population');
    for (const [type, raw] of buildingRaw) {
      add(`building:${type}`, BUILDINGS[type]?.name ?? type, raw * scale, 'building');
    }
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount);
}

function aggregateGood(good: GoodId, cities: City[], kingdom: Kingdom): RealmGoodCapability {
  let stock = kingdom.treasury.get(good);
  let produced = 0;
  let consumed = 0;
  let imported = 0;
  let exported = 0;
  const producerCities: Array<{ id: string; name: string }> = [];
  const producerType = (GOODS[good]?.producedBy ?? null) as BuildingType | null;
  let producerBuildings = 0;

  for (const city of cities) {
    stock += city.stock.get(good);
    const flow = city.ledger.flow(good);
    produced += flow.produced;
    consumed += flow.consumed;
    imported += flow.imported;
    exported += flow.exported;
    if (producerType) {
      const count = [...city.buildings.values()].filter(building => building.type === producerType).length;
      if (count > 0) {
        producerBuildings += count;
        producerCities.push({ id: city.id, name: city.name });
      }
    }
  }
  const newSupply = produced + imported;
  return {
    good,
    name: GOODS[good]?.name ?? good,
    icon: GOODS[good]?.icon ?? '',
    stock,
    produced,
    consumed,
    imported,
    exported,
    importDependency: newSupply > 0 ? imported / newSupply : null,
    producerBuilding: producerType,
    producerBuildings,
    producerCities,
    recipes: productionRecipesFor(good),
    required: false,
    unlocked: false,
    available: stock > 0 || produced > 0 || imported > 0,
    producing: produced > 0
  };
}

function buildingDeployment(type: BuildingType, cities: City[]): BuildingDeployment {
  const matches: Array<{ id: string; city: City; hp: number; staffing: number; operational: boolean }> = [];
  for (const city of cities) {
    for (const building of city.buildings.values()) {
      if (building.type !== type) continue;
      const condition = building.maxHp > 0 ? building.hp / building.maxHp : 0;
      matches.push({ id: building.id, city, hp: condition, staffing: building.staffing, operational: condition > 0.5 && building.staffing > 0 });
    }
  }
  const cityMap = new Map(matches.map(match => [match.city.id, { id: match.city.id, name: match.city.name }]));
  return {
    type,
    name: BUILDINGS[type]?.name ?? type,
    icon: BUILDINGS[type]?.icon ?? '',
    category: BUILDINGS[type]?.category ?? 'core',
    count: matches.length,
    operational: matches.filter(match => match.operational).length,
    cities: [...cityMap.values()],
    instances: matches.map(match => ({ id: match.id, cityId: match.city.id, cityName: match.city.name })),
    meanCondition: matches.length ? matches.reduce((sum, match) => sum + match.hp, 0) / matches.length : null,
    meanStaffing: matches.length ? matches.reduce((sum, match) => sum + match.staffing, 0) / matches.length : null
  };
}

function realmInfrastructure(
  techId: string,
  kingdom: Kingdom,
  cities: City[],
  logistics: LogisticsMetrics
): InfrastructureDeployment[] {
  const result: InfrastructureDeployment[] = [];
  const ownAccess = logistics.cities.filter(city => city.kingdomId === kingdom.id);

  if (techId === 'masonry' || techId === 'roads' || techId === 'engineering') {
    const target = techId === 'engineering' ? 3 : 2;
    const reached = ownAccess.filter(city => city.roadLevel >= target);
    result.push({
      kind: 'road',
      label: target === 3 ? 'Cidades com acesso a estrada imperial' : 'Cidades com acesso a estrada pavimentada',
      deployed: reached.length,
      total: ownAccess.length,
      damaged: logistics.bottlenecks.filter(b => b.kind === 'road-damaged' && b.affectedKingdoms.some(k => k.id === kingdom.id)).length,
      detail: `${reached.length} de ${ownAccess.length} cidades atingem nível de estrada ${target}`,
      cityIds: reached.map(city => city.cityId)
    });
  }

  if (techId === 'steam_power') {
    const connected = ownAccess.filter(city => city.railConnected);
    const ownedLines = logistics.rail.lines.filter(line => line.owners.some(owner => owner.kingdomId === kingdom.id));
    result.push({
      kind: 'rail',
      label: 'Cidades conectadas por ferrovia',
      deployed: connected.length,
      total: ownAccess.length,
      damaged: ownedLines.reduce((sum, line) => sum + line.damagedTiles, 0),
      detail: `${connected.length} de ${ownAccess.length} cidades conectadas por ${ownedLines.length} linha(s) operativa(s)`,
      cityIds: connected.map(city => city.cityId)
    });
  }

  if (techId === 'sailing' || techId === 'engineering' || techId === 'industrialization') {
    const requiredTier = techId === 'sailing' ? 2 : techId === 'engineering' ? 3 : 4;
    const ports = logistics.ports.filter(port => port.kingdomId === kingdom.id);
    const operationalPorts = ports.filter(port => port.operational);
    const realmShips = [...kingdomShipEntries(kingdom, logistics)];
    const ships = realmShips.filter(ship => ship.tier >= requiredTier);
    result.push({
      kind: 'port',
      label: 'Portos operacionais',
      deployed: operationalPorts.length,
      total: ports.length,
      damaged: ports.filter(port => !port.operational).length,
      detail: `${operationalPorts.length} de ${ports.length} portos podem lidar com comércio`,
      cityIds: operationalPorts.map(port => port.cityId)
    });
    result.push({
      kind: 'shipping',
      label: `Nível de navio implantado ${requiredTier}+`,
      deployed: ships.length,
      total: realmShips.length,
      damaged: 0,
      detail: ships.length ? `${ships.length} navio(s) ativo(s) no nível desbloqueado ou acima` : 'Nenhum navio ativo usa este nível ainda',
      cityIds: []
    });
  }
  return result;
}

/** The logistics snapshot exposes ships as movers without realm ids; routes retain them. */
function kingdomShipEntries(kingdom: Kingdom, logistics: LogisticsMetrics): Array<{ tier: number }> {
  const entries: Array<{ tier: number }> = [];
  for (const route of logistics.routes) {
    if (route.fromKingdom?.id !== kingdom.id && route.toKingdom?.id !== kingdom.id) continue;
    for (const ship of route.ships) entries.push({ tier: ship.tier });
  }
  return entries;
}

function militaryDeployment(techId: string, kingdom: Kingdom, ctx: GameContext): MilitaryDeployment | null {
  const tier = EQUIPMENT_TIERS_BY_RANK.find(candidate => EQUIPMENT_TECH[candidate] === techId);
  if (!tier) return null;
  const weaponNames = new Set(WEAPON_TIERS[tier].map(item => item.name));
  let adopted = 0;
  let total = 0;
  for (const entity of ctx.sim.entities) {
    if (entity.kingdomId !== kingdom.id || entity.hp <= 0) continue;
    if (entity.profession !== 'soldier' && entity.profession !== 'king') continue;
    total++;
    if (weaponNames.has(entity.equipment.weapon?.name)) adopted++;
  }
  return {
    tier,
    label: EQUIPMENT_LABEL[tier],
    adopted,
    total,
    requiredGoods: EQUIPMENT_GOODS[tier],
    weapons: [...weaponNames]
  };
}

function capabilityFor(
  view: TechnologyView,
  kingdom: Kingdom,
  cities: City[],
  ctx: GameContext,
  logistics: LogisticsMetrics,
  allGoods: Map<GoodId, RealmGoodCapability>
): CapabilityView | null {
  if (view.status !== 'discovered') return null;
  const tech = view.definition;
  const engine = kingdom.techCapabilities.find(capability => capability.techId === tech.id) ?? null;
  const buildings = (tech.unlocks.buildings ?? []).map(type => buildingDeployment(type, cities));
  const relevantGoods = new Set<GoodId>([
    ...(tech.unlocks.goods ?? []),
    ...view.demandedGoods.map(entry => entry.good)
  ]);
  // Inputs to a newly unlocked recipe are consequences of the technology too.
  for (const good of tech.unlocks.goods ?? []) {
    for (const recipe of productionRecipesFor(good)) {
      for (const input of Object.keys(recipe.inputs) as GoodId[]) relevantGoods.add(input);
    }
  }
  const requiredSet = new Set(view.demandedGoods.map(entry => entry.good));
  const unlockedSet = new Set(tech.unlocks.goods ?? []);
  const goods = [...relevantGoods].map(good => ({
    ...allGoods.get(good)!,
    required: requiredSet.has(good),
    unlocked: unlockedSet.has(good)
  }));
  const infrastructure = realmInfrastructure(tech.id, kingdom, cities, logistics);
  const military = militaryDeployment(tech.id, kingdom, ctx);
  const deployedCities = new Map<string, { id: string; name: string }>();
  for (const building of buildings) for (const city of building.cities) deployedCities.set(city.id, city);
  for (const good of goods) for (const city of good.producerCities) deployedCities.set(city.id, city);
  for (const deployment of infrastructure) {
    for (const cityId of deployment.cityIds) {
      const city = ctx.sim.cities.get(cityId);
      if (city) deployedCities.set(city.id, { id: city.id, name: city.name });
    }
  }

  const physicalUnlocks = buildings.length + (tech.unlocks.goods?.length ?? 0) + infrastructure.length + (military ? 1 : 0);
  const deployedSignals =
    buildings.reduce((sum, building) => sum + building.operational, 0) +
    goods.filter(good => good.unlocked && good.producing).length +
    infrastructure.reduce((sum, deployment) => sum + Math.min(1, deployment.deployed), 0) +
    (military && military.adopted > 0 ? 1 : 0);
  const missingBuildings = engine?.missingBuildings ?? buildings.filter(building => building.count === 0).map(building => building.type);
  const missingGoods = engine?.missingGoods ?? goods.filter(good => good.required && !good.available).map(good => good.good);
  const requirementsMissing = missingBuildings.length + missingGoods.length;

  let state: CapabilityState;
  if (physicalUnlocks === 0 && view.demandedGoods.length === 0) state = 'deployed';
  else if (requirementsMissing > 0 && deployedSignals === 0) state = 'unavailable';
  else if (requirementsMissing > 0) state = 'limited';
  else if (deployedSignals === 0) state = 'available';
  else {
    const incompleteInfrastructure = infrastructure.some(item => item.total > 0 && item.deployed < item.total);
    const damaged = infrastructure.some(item => item.damaged > 0) || buildings.some(item => item.count > item.operational);
    state = incompleteInfrastructure || damaged || (engine !== null && engine.capacity < 0.95) ? 'limited' : 'deployed';
  }

  const evidence: string[] = [];
  if (missingBuildings.length) evidence.push(`${missingBuildings.length} tipo(s) de edifício(s) desbloqueado(s) não foram construídos`);
  if (missingGoods.length) evidence.push(`${missingGoods.length} material(is) estratégico(s) não podem ser obtidos`);
  if (buildings.some(item => item.count > item.operational)) evidence.push('Alguns edifícios implantados estão danificados ou sem equipe');
  if (infrastructure.some(item => item.damaged > 0)) evidence.push('Danos de guerra estão reduzindo a implantação de infraestrutura');
  if (military && military.total > 0) evidence.push(`${military.adopted} de ${military.total} soldados usam este nível de equipamento`);
  if (!evidence.length && deployedSignals === 0 && physicalUnlocks > 0) evidence.push('Requisitos existem, mas nenhuma implantação física foi registrada ainda');
  if (!evidence.length) evidence.push('Os efeitos conhecidos estão ativos e nenhum gargalo material foi registrado');

  return {
    techId: tech.id,
    name: tech.name,
    state,
    engineCapacity: engine?.capacity ?? null,
    missingBuildings,
    missingGoods,
    buildings,
    goods,
    infrastructure,
    military,
    deployedCities: [...deployedCities.values()],
    evidence,
    hasPhysicalDeployment: deployedSignals > 0
  };
}

function technologyHistory(kingdom: Kingdom): TechnologyHistoryEntry[] {
  const events = chronicle.getEventsForRef('kingdom', kingdom.id)
    .filter(event =>
      event.refs.some(ref => ref.kind === 'tech') ||
      event.type === 'tech' ||
      event.tags.includes('technology') ||
      event.tags.includes('railway')
    )
    .sort((a, b) => b.year - a.year || b.id.localeCompare(a.id));
  return events.map(event => {
    const ref = event.refs.find(item => item.kind === 'tech');
    return { event, techId: ref?.id ?? null, techName: ref?.name ?? (ref ? TECHNOLOGIES[ref.id]?.name ?? ref.id : null) };
  });
}

function adjacentEra(current: TechEra, delta: -1 | 1): TechEra | null {
  const eras = Object.values(TECH_ERAS).sort((a, b) => a.order - b.order);
  const index = eras.findIndex(era => era.id === current);
  return eras[index + delta]?.id ?? null;
}

export function computeTechnologyUISnapshot(
  kingdom: Kingdom,
  ctx: GameContext,
  logistics: LogisticsMetrics,
  now: number = performance.now()
): TechnologyUISnapshot {
  const started = performance.now();
  const cities = citiesOf(kingdom, ctx);
  const technologies = buildTechnologyViews(kingdom);
  const allGoods = new Map<GoodId, RealmGoodCapability>();
  for (const good of ALL_GOODS) allGoods.set(good, aggregateGood(good, cities, kingdom));
  const capabilities = technologies
    .map(view => capabilityFor(view, kingdom, cities, ctx, logistics, allGoods))
    .filter((view): view is CapabilityView => Boolean(view));
  const history = technologyHistory(kingdom);
  const knownEra = kingdom.research.currentEra();
  const operatingEra = kingdom.operatingEra;
  const buildTimeMs = performance.now() - started;
  technologyUIPerformance.capabilitySnapshotMs = buildTimeMs;
  return {
    year: ctx.sim.currentYear,
    kingdomId: kingdom.id,
    kingdomName: kingdom.name,
    kingdomColor: kingdom.color,
    cityCount: cities.length,
    knownCount: kingdom.research.known.size,
    totalCount: ALL_TECH_IDS.length,
    knownEra,
    knownEraName: TECH_ERAS[knownEra].name,
    operatingEra,
    operatingEraName: TECH_ERAS[operatingEra].name,
    previousEra: adjacentEra(knownEra, -1),
    nextEra: adjacentEra(knownEra, 1),
    current: technologies.find(view => view.status === 'researching') ?? null,
    researchOutput: kingdom.research.output,
    researchSources: researchSources(cities),
    technologies,
    available: technologies.filter(view => view.status === 'available'),
    capabilities,
    recentDiscoveries: history.filter(entry => entry.techId !== null).slice(0, 6),
    history,
    world: [...ctx.sim.kingdoms.values()]
      .map(other => ({
        kingdomId: other.id,
        name: other.name,
        color: other.color,
        era: other.research.currentEra(),
        eraName: TECH_ERAS[other.research.currentEra()].name,
        known: other.research.known.size,
        researchOutput: other.research.output
      }))
      .sort((a, b) => b.known - a.known || b.researchOutput - a.researchOutput),
    createdAt: now,
    buildTimeMs
  };
}

/** Snapshot cache keyed by realm and invalidated on a simulated year boundary. */
export class TechnologyUISnapshotCache {
  private snapshot: TechnologyUISnapshot | null = null;
  private builtAt = -Infinity;
  private builtYear = -1;
  private builtFor = '';
  private static readonly MAX_AGE_MS = 2500;

  public get(kingdom: Kingdom, ctx: GameContext, logistics: LogisticsMetrics, now: number): TechnologyUISnapshot {
    const changedRealm = this.builtFor !== kingdom.id;
    const changedYear = this.builtYear !== ctx.sim.currentYear;
    const stale = now - this.builtAt >= TechnologyUISnapshotCache.MAX_AGE_MS;
    if (this.snapshot && !changedRealm && !changedYear && !stale) return this.snapshot;
    this.snapshot = computeTechnologyUISnapshot(kingdom, ctx, logistics, now);
    this.builtAt = now;
    this.builtYear = ctx.sim.currentYear;
    this.builtFor = kingdom.id;
    return this.snapshot;
  }

  public invalidate(): void {
    this.builtAt = -Infinity;
  }
}

export function technologiesByEraAndTrack(
  snapshot: TechnologyUISnapshot,
  track: TechTrack
): Array<{ era: TechEra; technologies: TechnologyView[] }> {
  return Object.values(TECH_ERAS)
    .sort((a, b) => a.order - b.order)
    .map(era => ({
      era: era.id,
      technologies: snapshot.technologies.filter(view => view.definition.track === track && view.definition.era === era.id)
    }));
}
