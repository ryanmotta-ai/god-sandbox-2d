/**
 * Warfare Command Center snapshot.
 *
 * There is deliberately no parallel warfare model here. Aethoria persists
 * bilateral WarRecords, individual combatants, city siege state and structured
 * Chronicle events. This module indexes those facts once and derives the UI's
 * readable groupings from them.
 */
import type { GameContext } from '../core/GameContext';
import type { WarRecord, PeaceSettlement } from '../../civ/Diplomacy';
import type { Kingdom, MilitaryDoctrine } from '../../civ/Kingdom';
import type { City, SiegePhase } from '../../civ/City';
import type { Army, Commander, MercenaryCompany } from '../../civ/Warfare';
import type { Entity } from '../../entities/Entity';
import type { AIState } from '../../entities/Needs';
import {
  EQUIPMENT_COST, EQUIPMENT_TECH, EQUIPMENT_TIERS_BY_RANK, WEAPON_TIERS,
  type EquipmentTier, type WeaponCategory
} from '../../entities/Equipment';
import { GOVERNMENTS } from '../../civ/Government';
import { GOODS, type GoodId } from '../../civ/Goods';
import { SOCIAL_FACTIONS, SOCIAL_FACTION_ORDER, type SocialFactionId } from '../../civ/Society';
import { chronicle, type HistoryEvent } from '../../civ/Chronicle';

export type ForceStatus = 'attacking' | 'moving' | 'sieging' | 'defending' | 'retreating' | 'patrolling' | 'recovering' | 'idle';
export type WarCityStatus = 'safe' | 'threatened' | 'besieged' | 'captured';

export const warfareUIPerformance: {
  screenOpenMs: number | null;
  snapshotMs: number | null;
  territoryAggregationMs: number | null;
  timelineMs: number | null;
  updateMs: number | null;
} = {
  screenOpenMs: null,
  snapshotMs: null,
  territoryAggregationMs: null,
  timelineMs: null,
  updateMs: null
};

export interface RealmRefView {
  id: string;
  name: string;
  color: string;
  surviving: boolean;
  /** How tired of fighting this realm is, 0..100. A war fact, kept on the ref. */
  warWeariness: number;
}

export interface EquipmentView {
  name: string;
  category: WeaponCategory | 'unarmed';
  tier: EquipmentTier | null;
  techId: string | null;
  count: number;
}

export interface ArmyForceView {
  /** UI aggregation id; no Army entity exists in the simulation. */
  id: string;
  kingdom: RealmRefView;
  combatantIds: string[];
  representativeId: string;
  soldiers: number;
  rulers: number;
  strength: number;
  meanHp: number;
  x: number;
  y: number;
  location: string;
  status: ForceStatus;
  objective: { cityId: string; cityName: string; x: number; y: number } | null;
  equipment: EquipmentView[];
  categories: { category: WeaponCategory | 'unarmed'; count: number }[];
  warIds: string[];
}

export interface EngagementView {
  /** Derived spatial cluster, not a persisted Battle id. */
  id: string;
  warId: string;
  x: number;
  y: number;
  location: string;
  attackerForces: number;
  defenderForces: number;
  participantIds: string[];
  entityIds: string[];
  major: boolean;
  capitalInvolved: boolean;
  cityId: string | null;
}

export interface SiegeView {
  warId: string;
  cityId: string;
  cityName: string;
  ownerId: string;
  besiegerId: string;
  progress: number;
  years: number;
  isCapital: boolean;
  x: number;
  y: number;
  phase?: SiegePhase;
  wallBreaches?: number;
  gatesForced?: number;
  towersCaptured?: number;
  surrenderWillingness?: number;
  siegeEngines?: number;
}

export interface WarCityView {
  id: string;
  name: string;
  status: WarCityStatus;
  owner: RealmRefView | null;
  formerOwner: RealmRefView | null;
  population: number;
  prosperity: number;
  territoryTiles: number;
  siegeProgress: number | null;
  siegeYears: number | null;
  isCapital: boolean;
  defenceMultiplier: number;
  x: number;
  y: number;
}

export interface StrategicGoodView {
  good: GoodId;
  name: string;
  stock: number;
  produced: number;
  consumed: number;
  imported: number;
  exported: number;
  importDependency: number | null;
  net: number;
}

export interface PoliticalWarView {
  kingdom: RealmRefView;
  warWeariness: number;
  legitimacy: number;
  stability: number;
  warPressure: number;
  peacePressure: number;
  revoltRisk: number;
  coupRisk: number;
  reformPressure: number;
  factions: {
    id: SocialFactionId;
    name: string;
    color: string;
    influence: number;
    warSupport: number;
    satisfaction: number;
  }[];
}

export interface AlliedInterventionView {
  kingdom: RealmRefView;
  supporting: 'attacker' | 'defender';
  linkedWarId: string;
}

export interface TerritoryChangeView {
  attackerHeldCities: number;
  defenderHeldCities: number;
  attackerHeldTiles: number;
  defenderHeldTiles: number;
  netTilesForAttacker: number;
  changedCityIds: string[];
  /** True because there is no per-tile ownership snapshot at war start. */
  basedOnCapturedCities: true;
}

export interface WarView {
  record: WarRecord;
  attacker: RealmRefView;
  defender: RealmRefView;
  active: boolean;
  duration: number;
  conflictKind: 'international' | 'rebellion';
  attackerForce: ArmyForceView | null;
  defenderForce: ArmyForceView | null;
  attackerLosses: number;
  defenderLosses: number;
  battlefieldCasualties: number;
  civilianCasualties: number;
  territory: TerritoryChangeView;
  cities: WarCityView[];
  sieges: SiegeView[];
  engagements: EngagementView[];
  allies: AlliedInterventionView[];
  timeline: HistoryEvent[];
  mapFocus: { x: number; y: number };
}

export interface RealmMilitaryView {
  kingdom: RealmRefView;
  soldiers: number;
  strength: number;
  militaryPower: number;
  warWeariness: number;
  wars: number;
  highestEquipment: EquipmentView | null;
  doctrine?: MilitaryDoctrine;
}

export interface WarfareUISnapshot {
  year: number;
  activeWars: WarView[];
  history: WarView[];
  allWars: WarView[];
  forces: ArmyForceView[];
  armies: Army[];
  commanders: Commander[];
  mercenaries: MercenaryCompany[];
  engagements: EngagementView[];
  sieges: SiegeView[];
  realms: RealmMilitaryView[];
  totalSoldiers: number;
  createdAt: number;
  buildTimeMs: number;
}

const EQUIPMENT_NAMES = new Map<string, { tier: EquipmentTier; category: WeaponCategory; techId: string | null }>();
for (const tier of EQUIPMENT_TIERS_BY_RANK) {
  for (const item of WEAPON_TIERS[tier] ?? []) {
    EQUIPMENT_NAMES.set(item.name, { tier, category: item.category ?? 'melee', techId: EQUIPMENT_TECH[tier] });
  }
}

const STRATEGIC_GOODS: GoodId[] = (() => {
  const goods = new Set<GoodId>(['food']);
  for (const cost of Object.values(EQUIPMENT_COST)) {
    for (const good of Object.keys(cost)) goods.add(good as GoodId);
  }
  return [...goods];
})();

function realmRef(id: string, ctx: GameContext, fallback = 'Reino desconhecido'): RealmRefView {
  const kingdom = ctx.sim.kingdoms.get(id);
  return {
    id,
    name: kingdom?.name ?? fallback,
    color: kingdom?.color ?? '#64748b',
    surviving: Boolean(kingdom),
    warWeariness: kingdom?.warWeariness ?? 0
  };
}

function livingCombatants(ctx: GameContext): Entity[] {
  return ctx.sim.entities.filter(entity =>
    entity.hp > 0 && !entity.isChild && Boolean(entity.kingdomId) &&
    (entity.profession === 'soldier' || entity.profession === 'king')
  );
}

function nearestCity(x: number, y: number, cities: Iterable<City>, maxDistance = Infinity): City | null {
  let best: City | null = null;
  let distance = maxDistance;
  for (const city of cities) {
    const next = Math.hypot(city.x - x, city.y - y);
    if (next < distance) { distance = next; best = city; }
  }
  return best;
}

function objectiveCity(combatants: Entity[], ctx: GameContext): City | null {
  const counts = new Map<string, number>();
  for (const entity of combatants) {
    if (entity.targetX === null || entity.targetY === null) continue;
    const city = nearestCity(entity.targetX, entity.targetY, ctx.sim.cities.values(), 1.5);
    if (city) counts.set(city.id, (counts.get(city.id) ?? 0) + 1);
  }
  const id = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return id ? ctx.sim.cities.get(id) ?? null : null;
}

function forceStatus(combatants: Entity[], objective: City | null): ForceStatus {
  const count = (state: AIState) => combatants.filter(entity => entity.aiState === state).length;
  if (objective && combatants.some(entity => entity.aiState === 'raid' && Math.hypot(entity.x - objective.x, entity.y - objective.y) <= 7)) return 'sieging';
  if (count('attack') > 0) return 'attacking';
  if (count('raid') > 0) return 'moving';
  if (count('defend_city') > 0) return 'defending';
  if (count('flee') > 0) return 'retreating';
  if (count('patrol') > 0) return 'patrolling';
  if (count('heal') > 0) return 'recovering';
  return 'idle';
}

/** Exact group-strength formula used by WarfareSystem.armyStrength. */
export function combatStrength(combatants: Entity[], kingdom: Kingdom | null): number {
  const raw = combatants.reduce((sum, entity) => sum + entity.damage + entity.defense * 0.5 + entity.level * 3, 0);
  if (!kingdom) return raw;
  const tech = kingdom.research.modifiers().military;
  const government = GOVERNMENTS[kingdom.government].military;
  const exhaustion = Math.max(0.5, 1 - kingdom.warWeariness / 220);
  return raw * tech * government * exhaustion;
}

function equipmentFor(combatants: Entity[]): EquipmentView[] {
  const counts = new Map<string, EquipmentView>();
  for (const entity of combatants) {
    const weapon = entity.equipment.weapon;
    const name = weapon?.name ?? 'Unarmed';
    const known = weapon ? EQUIPMENT_NAMES.get(name) : null;
    const current = counts.get(name) ?? {
      name,
      category: known?.category ?? weapon?.category ?? 'unarmed',
      tier: known?.tier ?? null,
      techId: known?.techId ?? weapon?.techRequired ?? null,
      count: 0
    };
    current.count++;
    counts.set(name, current);
  }
  const rank = (item: EquipmentView) => item.tier ? EQUIPMENT_TIERS_BY_RANK.indexOf(item.tier) : 99;
  return [...counts.values()].sort((a, b) => rank(a) - rank(b) || b.count - a.count);
}

function buildForces(ctx: GameContext, combatants: Entity[]): ArmyForceView[] {
  const byRealm = new Map<string, Entity[]>();
  for (const entity of combatants) {
    const list = byRealm.get(entity.kingdomId!) ?? [];
    list.push(entity);
    byRealm.set(entity.kingdomId!, list);
  }
  const forces: ArmyForceView[] = [];
  for (const [kingdomId, members] of byRealm) {
    const kingdom = ctx.sim.kingdoms.get(kingdomId) ?? null;
    const x = members.reduce((sum, entity) => sum + entity.x, 0) / members.length;
    const y = members.reduce((sum, entity) => sum + entity.y, 0) / members.length;
    const objective = objectiveCity(members, ctx);
    const equipment = equipmentFor(members);
    const categoryCounts = new Map<WeaponCategory | 'unarmed', number>();
    for (const item of equipment) categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + item.count);
    const location = nearestCity(x, y, ctx.sim.cities.values(), 18);
    forces.push({
      id: `force:${kingdomId}`,
      kingdom: realmRef(kingdomId, ctx),
      combatantIds: members.map(entity => entity.id),
      representativeId: members[0].id,
      soldiers: members.filter(entity => entity.profession === 'soldier').length,
      rulers: members.filter(entity => entity.profession === 'king').length,
      strength: combatStrength(members, kingdom),
      meanHp: members.reduce((sum, entity) => sum + entity.hp / Math.max(1, entity.maxHp), 0) / members.length,
      x, y,
      location: location ? `Próximo de ${location.name}` : `${Math.round(x)}, ${Math.round(y)}`,
      status: forceStatus(members, objective),
      objective: objective ? { cityId: objective.id, cityName: objective.name, x: objective.x, y: objective.y } : null,
      equipment,
      categories: [...categoryCounts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
      warIds: ctx.sim.diplomacy.getWarsFor(kingdomId).map(war => war.id)
    });
  }
  return forces.sort((a, b) => b.strength - a.strength);
}

function engagementClusters(war: WarRecord, combatantsByRealm: Map<string, Entity[]>, ctx: GameContext): EngagementView[] {
  const attackers = (combatantsByRealm.get(war.attacker) ?? []).filter(entity => entity.aiState === 'attack');
  const defenders = (combatantsByRealm.get(war.defender) ?? []).filter(entity => entity.aiState === 'attack');
  if (!attackers.length || !defenders.length) return [];

  const buckets = new Map<string, { attackers: Set<Entity>; defenders: Set<Entity>; x: number; y: number; pairs: number }>();
  const cell = 12;
  for (const attacker of attackers) {
    for (const defender of defenders) {
      if (Math.hypot(attacker.x - defender.x, attacker.y - defender.y) > 9) continue;
      const mx = (attacker.x + defender.x) / 2;
      const my = (attacker.y + defender.y) / 2;
      const key = `${Math.floor(mx / cell)}:${Math.floor(my / cell)}`;
      const bucket = buckets.get(key) ?? { attackers: new Set(), defenders: new Set(), x: 0, y: 0, pairs: 0 };
      bucket.attackers.add(attacker);
      bucket.defenders.add(defender);
      bucket.x += mx;
      bucket.y += my;
      bucket.pairs++;
      buckets.set(key, bucket);
    }
  }

  const out: EngagementView[] = [];
  for (const [key, bucket] of buckets) {
    const x = bucket.x / bucket.pairs;
    const y = bucket.y / bucket.pairs;
    const city = nearestCity(x, y, ctx.sim.cities.values(), 8);
    const capital = city ? [...ctx.sim.kingdoms.values()].some(kingdom => kingdom.capitalCityId === city.id) : false;
    const total = bucket.attackers.size + bucket.defenders.size;
    out.push({
      id: `engagement:${war.id}:${key}`,
      warId: war.id,
      x, y,
      location: city ? `Próximo de ${city.name}` : `${Math.round(x)}, ${Math.round(y)}`,
      attackerForces: bucket.attackers.size,
      defenderForces: bucket.defenders.size,
      participantIds: [war.attacker, war.defender],
      entityIds: [...bucket.attackers, ...bucket.defenders].map(entity => entity.id),
      // Documented criterion: 12+ combatants or any fighting within 8 tiles of a capital.
      major: total >= 12 || capital,
      capitalInvolved: capital,
      cityId: city?.id ?? null
    });
  }
  return out.sort((a, b) => Number(b.major) - Number(a.major) || (b.attackerForces + b.defenderForces) - (a.attackerForces + a.defenderForces));
}

function warEvents(warId: string, eventIndex: Map<string, HistoryEvent[]>): HistoryEvent[] {
  return (eventIndex.get(warId) ?? []).slice().sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}

function buildEventIndex(): Map<string, HistoryEvent[]> {
  const started = performance.now();
  const index = new Map<string, HistoryEvent[]>();
  for (const event of chronicle.getEvents()) {
    for (const ref of event.refs) {
      if (ref.kind !== 'war') continue;
      const list = index.get(ref.id) ?? [];
      list.push(event);
      index.set(ref.id, list);
    }
  }
  warfareUIPerformance.timelineMs = performance.now() - started;
  return index;
}

function buildSieges(ctx: GameContext): SiegeView[] {
  const out: SiegeView[] = [];
  for (const city of ctx.sim.cities.values()) {
    if (!city.kingdomId || !city.besiegerId) continue;
    const war = ctx.sim.diplomacy.getWarsFor(city.kingdomId)
      .find(candidate => candidate.attacker === city.besiegerId || candidate.defender === city.besiegerId);
    if (!war) continue;
    const owner = ctx.sim.kingdoms.get(city.kingdomId);
    out.push({
      warId: war.id, cityId: city.id, cityName: city.name,
      ownerId: city.kingdomId, besiegerId: city.besiegerId,
      progress: city.siegeProgress, years: city.siegeYears,
      isCapital: owner?.capitalCityId === city.id,
      x: city.x, y: city.y,
      phase: city.siegeState?.phase,
      wallBreaches: city.siegeState?.wallBreaches ?? 0,
      gatesForced: city.siegeState?.gatesForced ?? 0,
      towersCaptured: city.siegeState?.towersCaptured ?? 0,
      surrenderWillingness: city.siegeState?.surrenderWillingness ?? 0,
      siegeEngines: city.siegeState?.siegeEnginesDeployed ?? 0
    });
  }
  return out.sort((a, b) => Number(b.isCapital) - Number(a.isCapital) || b.progress - a.progress);
}

function capturedCityIds(events: HistoryEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.type !== 'conquest') continue;
    for (const ref of event.refs) if (ref.kind === 'city') ids.add(ref.id);
  }
  return ids;
}

function territoryChange(war: WarRecord, events: HistoryEvent[], ctx: GameContext): TerritoryChangeView {
  const started = performance.now();
  const ids = capturedCityIds(events);
  let attackerHeldCities = 0;
  let defenderHeldCities = 0;
  let attackerHeldTiles = 0;
  let defenderHeldTiles = 0;
  for (const id of ids) {
    const city = ctx.sim.cities.get(id);
    if (!city) continue;
    if (city.kingdomId === war.attacker && city.formerOwnerId === war.defender) {
      attackerHeldCities++;
      attackerHeldTiles += city.territory.size;
    } else if (city.kingdomId === war.defender && city.formerOwnerId === war.attacker) {
      defenderHeldCities++;
      defenderHeldTiles += city.territory.size;
    }
  }
  warfareUIPerformance.territoryAggregationMs = performance.now() - started;
  return {
    attackerHeldCities, defenderHeldCities, attackerHeldTiles, defenderHeldTiles,
    netTilesForAttacker: attackerHeldTiles - defenderHeldTiles,
    changedCityIds: [...ids], basedOnCapturedCities: true
  };
}


function warCities(
  war: WarRecord,
  events: HistoryEvent[],
  sieges: SiegeView[],
  combatantsByRealm: Map<string, Entity[]>,
  ctx: GameContext
): WarCityView[] {
  const ids = capturedCityIds(events);
  for (const siege of sieges) ids.add(siege.cityId);
  const hostileByOwner = new Map<string, Entity[]>();
  hostileByOwner.set(war.attacker, combatantsByRealm.get(war.defender) ?? []);
  hostileByOwner.set(war.defender, combatantsByRealm.get(war.attacker) ?? []);
  for (const city of ctx.sim.cities.values()) {
    if (city.kingdomId !== war.attacker && city.kingdomId !== war.defender) continue;
    const hostile = hostileByOwner.get(city.kingdomId!) ?? [];
    if (hostile.some(entity => Math.hypot(entity.x - city.x, entity.y - city.y) <= 14)) ids.add(city.id);
  }

  const out: WarCityView[] = [];
  for (const id of ids) {
    const city = ctx.sim.cities.get(id);
    if (!city) continue;
    const siege = sieges.find(item => item.cityId === id);
    const currentOwner = city.kingdomId;
    const hostile = currentOwner ? hostileByOwner.get(currentOwner) ?? [] : [];
    let status: WarCityStatus = 'safe';
    if (siege) status = 'besieged';
    else if (city.capturedYear !== null && capturedCityIds(events).has(id)) status = 'captured';
    else if (hostile.some(entity => Math.hypot(entity.x - city.x, entity.y - city.y) <= 14)) status = 'threatened';
    const ownerKingdom = currentOwner ? ctx.sim.kingdoms.get(currentOwner) : null;
    out.push({
      id: city.id, name: city.name, status,
      owner: currentOwner ? realmRef(currentOwner, ctx) : null,
      formerOwner: city.formerOwnerId ? realmRef(city.formerOwnerId, ctx) : null,
      population: city.population, prosperity: city.prosperity,
      territoryTiles: city.territory.size,
      siegeProgress: siege?.progress ?? null,
      siegeYears: siege?.years ?? null,
      isCapital: ownerKingdom?.capitalCityId === city.id,
      defenceMultiplier: city.defenseMultiplier(),
      x: city.x, y: city.y
    });
  }
  const order: Record<WarCityStatus, number> = { besieged: 0, threatened: 1, captured: 2, safe: 3 };
  return out.sort((a, b) => order[a.status] - order[b.status] || Number(b.isCapital) - Number(a.isCapital));
}

function strategicGoods(kingdomId: string, ctx: GameContext): StrategicGoodView[] {
  const cities = [...ctx.sim.cities.values()].filter(city => city.kingdomId === kingdomId);
  return STRATEGIC_GOODS.map(good => {
    let stock = 0, produced = 0, consumed = 0, imported = 0, exported = 0;
    for (const city of cities) {
      const flow = city.ledger.flow(good);
      stock += city.stock.get(good);
      produced += flow.produced;
      consumed += flow.consumed;
      imported += flow.imported;
      exported += flow.exported;
    }
    const supply = produced + imported;
    return {
      good, name: GOODS[good]?.name ?? good, stock, produced, consumed, imported, exported,
      importDependency: supply > 0 ? Math.min(1, imported / supply) : null,
      net: produced + imported - consumed - exported
    };
  }).filter(item => item.stock > 0 || item.produced > 0 || item.consumed > 0 || item.imported > 0 || item.exported > 0);
}




function alliedInterventions(war: WarRecord, ctx: GameContext): AlliedInterventionView[] {
  const result: AlliedInterventionView[] = [];
  const addFor = (participantId: string, enemyId: string, supporting: 'attacker' | 'defender') => {
    for (const alliance of ctx.sim.diplomacy.alliances.values()) {
      if (!alliance.members.has(participantId)) continue;
      for (const memberId of alliance.members) {
        if (memberId === participantId || memberId === enemyId) continue;
        const linked = ctx.sim.diplomacy.getWarsFor(memberId)
          .find(candidate => candidate.attacker === enemyId || candidate.defender === enemyId);
        if (!linked || result.some(item => item.kingdom.id === memberId && item.supporting === supporting)) continue;
        result.push({ kingdom: realmRef(memberId, ctx), supporting, linkedWarId: linked.id });
      }
    }
  };
  addFor(war.attacker, war.defender, 'attacker');
  addFor(war.defender, war.attacker, 'defender');
  return result;
}

function civilianCasualties(events: HistoryEvent[]): number {
  return events.reduce((sum, event) => {
    const value = event.data.civilianCasualties;
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
}

function settlementLabel(settlement: PeaceSettlement | null): string {
  if (!settlement) return 'Ativo';
  return settlement.replace('_', ' ');
}

function buildWar(
  record: WarRecord,
  eventIndex: Map<string, HistoryEvent[]>,
  forcesByRealm: Map<string, ArmyForceView>,
  engagements: EngagementView[],
  sieges: SiegeView[],
  combatantsByRealm: Map<string, Entity[]>,
  ctx: GameContext
): WarView {
  const events = warEvents(record.id, eventIndex);
  const territory = territoryChange(record, events, ctx);
  const ownSieges = sieges.filter(item => item.warId === record.id);
  const cities = warCities(record, events, ownSieges, combatantsByRealm, ctx);
  const ownEngagements = engagements.filter(item => item.warId === record.id);
  const points = [
    ...cities.map(city => ({ x: city.x, y: city.y })),
    ...ownEngagements.map(item => ({ x: item.x, y: item.y })),
    ...ownSieges.map(item => ({ x: item.x, y: item.y }))
  ];
  const fallbackA = ctx.sim.kingdoms.get(record.attacker)?.cachedCenter ?? { x: ctx.tileMap.width / 2, y: ctx.tileMap.height / 2 };
  const fallbackB = ctx.sim.kingdoms.get(record.defender)?.cachedCenter ?? fallbackA;
  const mapFocus = points.length
    ? { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length }
    : { x: (fallbackA.x + fallbackB.x) / 2, y: (fallbackA.y + fallbackB.y) / 2 };
  return {
    record,
    attacker: realmRef(record.attacker, ctx, 'Ex-atacante'),
    defender: realmRef(record.defender, ctx, 'Ex-defensor'),
    active: record.endYear === null,
    duration: Math.max(0, (record.endYear ?? ctx.sim.currentYear) - record.startYear),
    conflictKind: /rebellion|secession|independence/i.test(record.reason) ? 'rebellion' : 'international',
    attackerForce: forcesByRealm.get(record.attacker) ?? null,
    defenderForce: forcesByRealm.get(record.defender) ?? null,
    attackerLosses: record.defenderKills,
    defenderLosses: record.attackerKills,
    battlefieldCasualties: record.attackerKills + record.defenderKills,
    civilianCasualties: civilianCasualties(events),
    territory,
    cities,
    sieges: ownSieges,
    engagements: ownEngagements,
    allies: alliedInterventions(record, ctx),
    timeline: events,
    mapFocus
  };
}

export function describeWar(record: WarRecord, ctx: GameContext): string {
  const attacker = ctx.sim.kingdoms.get(record.attacker)?.name ?? record.attacker;
  const defender = ctx.sim.kingdoms.get(record.defender)?.name ?? record.defender;
  return `${attacker} vs ${defender}`;
}

export function computeWarfareUISnapshot(
  ctx: GameContext,
  now: number = performance.now()
): WarfareUISnapshot {
  const started = performance.now();
  const combatants = livingCombatants(ctx);
  const combatantsByRealm = new Map<string, Entity[]>();
  for (const entity of combatants) {
    const list = combatantsByRealm.get(entity.kingdomId!) ?? [];
    list.push(entity);
    combatantsByRealm.set(entity.kingdomId!, list);
  }
  const forces = buildForces(ctx, combatants);
  const forcesByRealm = new Map(forces.map(force => [force.kingdom.id, force]));
  const activeRecords = [...ctx.sim.diplomacy.activeWars.values()];
  const historyRecords = [...ctx.sim.diplomacy.warHistory];
  const engagements = activeRecords.flatMap(war => engagementClusters(war, combatantsByRealm, ctx));
  const sieges = buildSieges(ctx);
  const eventIndex = buildEventIndex();
  const activeWars = activeRecords.map(war => buildWar(war, eventIndex, forcesByRealm, engagements, sieges, combatantsByRealm, ctx));
  const history = historyRecords.map(war => buildWar(war, eventIndex, forcesByRealm, engagements, sieges, combatantsByRealm, ctx))
    .sort((a, b) => (b.record.endYear ?? 0) - (a.record.endYear ?? 0));
  const realms = [...ctx.sim.kingdoms.values()].map(kingdom => {
    const force = forcesByRealm.get(kingdom.id) ?? null;
    return {
      kingdom: realmRef(kingdom.id, ctx),
      soldiers: force?.soldiers ?? 0,
      strength: force?.strength ?? 0,
      militaryPower: kingdom.computePower(),
      warWeariness: kingdom.warWeariness,
      wars: ctx.sim.diplomacy.getWarsFor(kingdom.id).length,
      highestEquipment: force?.equipment.find(item => item.tier !== null) ?? null,
      doctrine: kingdom.doctrine
    };
  }).sort((a, b) => b.strength - a.strength || b.militaryPower - a.militaryPower);
  const buildTimeMs = performance.now() - started;
  warfareUIPerformance.snapshotMs = buildTimeMs;
  const armies = ctx.sim.warfare?.armies ? Array.from(ctx.sim.warfare.armies.values()) : [];
  const commanders = ctx.sim.warfare?.commanders ? Array.from(ctx.sim.warfare.commanders.values()) : [];
  const mercenaries = ctx.sim.warfare?.mercenaryCompanies ? Array.from(ctx.sim.warfare.mercenaryCompanies.values()) : [];
  return {
    year: ctx.sim.currentYear,
    activeWars,
    history,
    allWars: [...activeWars, ...history],
    forces,
    armies,
    commanders,
    mercenaries,
    engagements,
    sieges,
    realms,
    totalSoldiers: forces.reduce((sum, force) => sum + force.soldiers, 0),
    createdAt: now,
    buildTimeMs
  };
}

/** Cached by year and a short real-time cadence for moving engagements. */
export class WarfareUISnapshotCache {
  private snapshot: WarfareUISnapshot | null = null;
  private builtAt = -Infinity;
  private builtYear = -1;
  private warSignature = '';
  private static readonly MAX_AGE_MS = 1200;

  public get(ctx: GameContext, now: number): WarfareUISnapshot {
    const signature = [...ctx.sim.diplomacy.activeWars.values()]
      .map(war => `${war.id}:${war.battles}:${war.attackerKills}:${war.defenderKills}`)
      .sort().join('|');
    const stale = now - this.builtAt >= WarfareUISnapshotCache.MAX_AGE_MS;
    if (this.snapshot && this.builtYear === ctx.sim.currentYear && this.warSignature === signature && !stale) return this.snapshot;
    this.snapshot = computeWarfareUISnapshot(ctx, now);
    this.builtAt = now;
    this.builtYear = ctx.sim.currentYear;
    this.warSignature = signature;
    return this.snapshot;
  }

  public invalidate(): void {
    this.builtAt = -Infinity;
  }
}

export const FORCE_STATUS_LABEL: Record<ForceStatus, string> = {
  attacking: 'ATACANDO', moving: 'MOVENDO', sieging: 'CERCANDO', defending: 'DEFENDENDO',
  retreating: 'RECUANDO', patrolling: 'PATRULHANDO', recovering: 'RECUPERANDO', idle: 'OCIOSO'
};

export const SETTLEMENT_LABEL: Record<PeaceSettlement, string> = {
  white_peace: 'Paz branca', victory: 'Vitória', exhaustion: 'Exaustão', independence: 'Independência'
};

export function warStateLabel(war: WarView): string {
  return war.active ? (war.sieges.length ? 'Cerco ativo' : war.engagements.length ? 'Combate ativo' : 'Ativo') : settlementLabel(war.record.settlement);
}
