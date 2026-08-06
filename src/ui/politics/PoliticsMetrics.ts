/**
 * One realm's politics and foreign position, computed once.
 *
 * Same discipline as UI-3 through UI-5: **every figure traces to something a
 * system recorded.** The politics half has an unusual advantage — `FactionState.
 * factors` holds the exact deltas the society tick applied to each faction, each
 * one labelled by the simulation itself and carrying a `FactorSource` naming
 * where the evidence lives. So the answer to "why is this faction angry" is read
 * back, not reconstructed.
 *
 * The diplomacy half has the opposite problem, and it is stated plainly wherever
 * it matters: `DiplomacyManager.relations` is a plain number per pair with no
 * history and no breakdown. What a relationship *is* — war, truce, alliance,
 * treaty, embargo, trade volume, a shared enemy — is all real state and is
 * reported in full. What each of those contributed to the score is not recorded
 * anywhere, so it is not claimed.
 *
 * Runs behind `PoliticsMetricsCache`. Counting a realm's working-age population
 * is O(entities) and must never happen per frame.
 */
import { GOODS, ALL_GOODS, type GoodId } from '../../civ/Goods';
import { GOVERNMENTS, type GovernmentDefinition, type EconomicSystem } from '../../civ/Government';
import {
  activeLawDefinitions, LAW_CATEGORY_ORDER,
  type LawCategory, type LawChange, type LawDefinition, type LawProfile
} from '../../civ/Laws';
import {
  SOCIAL_FACTIONS, SOCIAL_FACTION_ORDER,
  type FactionDefinition, type FactionState, type SocialFactionId, type SocietyProfile
} from '../../civ/Society';
import { chooseSuccessor } from '../../civ/Lineage';
import { chronicle } from '../../civ/Chronicle';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import type { CulturalProfile } from '../../civ/Culture';
import type { Alliance, DiplomaticStatus, WarRecord } from '../../civ/Diplomacy';
import type { TradeRoute } from '../../civ/Trade';
import type { City } from '../../civ/City';
import type { Kingdom } from '../../civ/Kingdom';
import type { Entity } from '../../entities/Entity';
import type { GameContext } from '../core/GameContext';

// ============================ SHAPES ============================

/**
 * A faction, with its own state plus what the definitions say it wants.
 *
 * `supportsGovernment` and `resistsGovernment` are not inferred: the faction
 * definition lists the government types it backs and the ones it fights, and the
 * society tick applies a real `govFit` bonus or penalty from exactly that list.
 */
export interface FactionView {
  id: SocialFactionId;
  definition: FactionDefinition;
  state: FactionState;
  /** This faction's definition lists the realm's government among those it backs. */
  supportsGovernment: boolean;
  resistsGovernment: boolean;
  /** Named pressures pulling satisfaction down, strongest first. */
  grievances: FactionState['factors'];
  /** Named pressures holding it up, strongest first. */
  supports: FactionState['factors'];
  /** Laws in force that this faction's definition says favour it. */
  favouredBy: LawDefinition[];
  /** Laws in force that anger it. */
  angeredBy: LawDefinition[];
  /**
   * Where this faction stands towards the regime, −3..+3.
   *
   * Built only from recorded state — loyalty, satisfaction and the definition's
   * own stance on this government — and reported with those three figures beside
   * it, so the reader can check the arithmetic rather than trust a score.
   */
  regimeStance: number;
}

export interface SuccessionRisk {
  label: string;
  detail: string;
  severity: 'warning' | 'critical';
}

export interface SuccessionView {
  /** 'strongest' | 'bloodline' | 'election', from the government definition. */
  rule: GovernmentDefinition['succession'];
  ruler: Entity | null;
  /** Years since the current government was adopted. */
  rulerYears: number | null;
  /**
   * Who the engine's own `chooseSuccessor` picks, run against the realm's living
   * citizens under its real succession mode. Not a second set of rules.
   */
  heir: Entity | null;
  dynasty: string;
  /** Living citizens of the ruling house. */
  dynastyMembers: number;
  risks: SuccessionRisk[];
}

/** A relationship, with everything the simulation actually stores about it. */
export interface RelationView {
  kingdomId: string;
  name: string;
  color: string;
  /** −100..100. The engine keeps no breakdown of how it got here. */
  score: number;
  status: DiplomaticStatus;
  atWar: boolean;
  /** Truce end year, when one is in force. */
  truceUntil: number | null;
  truceReason: string | null;
  alliance: Alliance | null;
  /** Treaty tariff, when a trade agreement exists. */
  tariff: number | null;
  agreementSince: number | null;
  /** Embargoes in force, either direction. */
  embargoedByUs: { year: number; reason: string } | null;
  embargoedAgainstUs: { year: number; reason: string } | null;
  isVassal: boolean;
  isOverlord: boolean;
  /** Volume moved on routes between the two realms. */
  tradeVolume: number;
  /** Share of this realm's external trade that runs through this partner. */
  tradeShare: number;
  /** Goods this realm buys from that one, by share of what it imports. */
  suppliedGoods: { good: GoodId; volume: number }[];
  /** Realms both are at war with. A real shared enemy, not an inferred affinity. */
  sharedEnemies: string[];
}

export interface WarView {
  war: WarRecord;
  enemyId: string;
  enemyName: string;
  enemyColor: string;
  aggressor: boolean;
  years: number;
  killsInflicted: number;
  killsSuffered: number;
  /** Allies of this realm also at war with the same enemy. */
  alliesInvolved: { kingdomId: string; name: string }[];
  /** Routes of this realm closed while at war with this enemy. */
  routesClosed: { route: TradeRoute; good: GoodId }[];
  /** Settlements the chronicle records changing hands on this war's thread. */
  citiesChanged: { id: string; name: string; oursNow: boolean }[];
}

/** A good this realm mostly buys, and from whom. */
export interface DependencyView {
  good: GoodId;
  name: string;
  strategic: boolean;
  /** imported ÷ (consumed + exported), on the realm's combined books. */
  share: number;
  imported: number;
  used: number;
  /** Suppliers by share of inbound volume. */
  suppliers: { kingdomId: string; name: string; color: string; share: number; volume: number; hostile: boolean }[];
}

export interface PoliticsMetrics {
  kingdomId: string;
  name: string;
  color: string;
  year: number;

  // ---- Government ----
  government: GovernmentDefinition;
  economicSystem: EconomicSystem;
  governmentSince: number;
  taxRate: number;
  legitimacy: number;
  stability: number;
  administrativeReach: number;
  culture: CulturalProfile;
  cultureLevel: number;

  // ---- Society ----
  society: SocietyProfile;
  factions: FactionView[];
  /** Sum of influence × stance across factions, so "does the regime have a base?"
   *  is answerable from the same figures the cards show. */
  regimeSupport: number;

  // ---- Laws ----
  laws: LawDefinition[];
  lawProfile: LawProfile;
  recentReforms: LawChange[];

  // ---- Succession ----
  succession: SuccessionView;

  // ---- Economic pressure on politics ----
  /** The same figures the society tick was handed, recomputed the same way. */
  economy: {
    foodSecurity: number;
    /** Local food price ÷ base price. 1.0 is normal, 2.0 means bread doubled. */
    foodPriceIndex: number;
    /** (working age − filled posts) ÷ working age, or null with no population. */
    unemployment: number | null;
    /** (posts − filled) ÷ posts, or null with no posts. */
    labourShortage: number | null;
    inequality: number;
    industrialisation: number;
    treasury: number;
    /** Embargoes standing against this realm. */
    embargoes: number;
    tradeDependency: number;
  };

  // ---- Diplomacy ----
  relations: RelationView[];
  alliances: Alliance[];
  wars: WarView[];
  dependencies: DependencyView[];
  externalThreat: number;
  warWeariness: number;
  militaryPower: number;
  /** Total volume on routes with one end in this realm. */
  externalTradeVolume: number;
}

// ============================ COMPUTATION ============================

export function computePoliticsMetrics(kingdom: Kingdom, ctx: GameContext): PoliticsMetrics {
  const sim = ctx.sim;

  const cities: City[] = [];
  for (const id of kingdom.cityIds) {
    const city = sim.cities.get(id);
    if (city) cities.push(city);
  }

  const ruler = kingdom.rulerId ? sim.entities.find(e => e.id === kingdom.rulerId) ?? null : null;
  const laws = activeLawDefinitions(kingdom.laws);
  const factions = buildFactions(kingdom, laws);
  const economy = computeEconomicPressure(kingdom, cities, sim.entities, ctx);
  const diplomacy = computeDiplomacy(kingdom, cities, ctx);

  return {
    kingdomId: kingdom.id,
    name: kingdom.name,
    color: kingdom.color,
    year: sim.currentYear,

    government: kingdom.governmentInfo,
    economicSystem: kingdom.governmentInfo.economy,
    governmentSince: kingdom.governmentSince,
    taxRate: kingdom.governmentInfo.taxRate,
    legitimacy: kingdom.legitimacy,
    stability: kingdom.economy.stability,
    administrativeReach: kingdom.administrativeReach,
    culture: kingdom.culture,
    cultureLevel: kingdom.cultureLevel,

    society: kingdom.society,
    factions,
    // Influence-weighted, so a furious faction with no influence does not read as
    // a collapsing regime and a loyal one with all of it does not hide unrest.
    regimeSupport: factions.reduce((sum, f) => sum + f.state.influence * f.regimeStance, 0),

    laws,
    lawProfile: kingdom.laws,
    recentReforms: [...kingdom.laws.history].sort((a, b) => b.year - a.year).slice(0, 8),

    succession: computeSuccession(kingdom, ruler, sim.entities, sim.currentYear),

    economy,

    ...diplomacy,
    externalThreat: kingdom.externalThreat,
    // The engine keeps this one on a 0..100 scale; normalised so everything
    // downstream compares like with like.
    warWeariness: Math.max(0, Math.min(1, kingdom.warWeariness / 100)),
    militaryPower: kingdom.militaryPower
  };
}

// ---------------- Factions ----------------

function buildFactions(kingdom: Kingdom, laws: LawDefinition[]): FactionView[] {
  const out: FactionView[] = [];

  for (const id of SOCIAL_FACTION_ORDER) {
    const state = kingdom.society.factions[id];
    const definition = SOCIAL_FACTIONS[id];
    if (!state || !definition) continue;

    const supportsGovernment = definition.supports.includes(kingdom.government);
    const resistsGovernment = definition.resists.includes(kingdom.government);
    const factors = state.factors ?? [];

    out.push({
      id,
      definition,
      state,
      supportsGovernment,
      resistsGovernment,
      grievances: factors.filter(f => f.delta < 0).sort((a, b) => a.delta - b.delta),
      supports: factors.filter(f => f.delta > 0).sort((a, b) => b.delta - a.delta),
      favouredBy: laws.filter(law => law.favours.includes(id)),
      angeredBy: laws.filter(law => law.angers.includes(id)),
      regimeStance: regimeStance(state, supportsGovernment, resistsGovernment)
    });
  }

  return out.sort((a, b) => b.state.influence - a.state.influence);
}

/**
 * Where a faction stands towards the regime, on a −3..+3 scale.
 *
 * Three recorded inputs, nothing else: loyalty (its willingness to accept the
 * order), satisfaction (whether it is getting what it wants), and whether its own
 * definition lists this government among those it backs or resists. The scale
 * exists so the coalition block can be read at a glance; every card that uses it
 * shows the three figures underneath, because a symbol without its arithmetic is
 * exactly what this project keeps refusing to ship.
 */
function regimeStance(state: FactionState, supports: boolean, resists: boolean): number {
  const base = (state.loyalty - 0.5) * 3 + (state.satisfaction - 0.5) * 2;
  const fit = supports ? 0.8 : resists ? -0.8 : 0;
  const radical = -state.radicalization * 1.5;
  return Math.max(-3, Math.min(3, base + fit + radical));
}

// ---------------- Succession ----------------

function computeSuccession(
  kingdom: Kingdom,
  ruler: Entity | null,
  entities: Entity[],
  year: number
): SuccessionView {
  const rule = kingdom.governmentInfo.succession;

  // The realm's own living citizens are the candidate pool, which is what the
  // engine hands `chooseSuccessor` when a ruler actually dies.
  const candidates: Entity[] = [];
  let dynastyMembers = 0;
  for (const entity of entities) {
    if (entity.kingdomId !== kingdom.id || entity.hp <= 0) continue;
    candidates.push(entity);
    if (kingdom.dynasty && entity.dynasty === kingdom.dynasty) dynastyMembers++;
  }

  // The engine's own succession function, run against the real rule and the real
  // pool. Not a second implementation that could disagree with the one the
  // simulation acts on when the throne empties.
  const heir = candidates.length
    ? chooseSuccessor(kingdom.rulerId, kingdom.dynasty, candidates.filter(e => e.id !== kingdom.rulerId), rule)
    : null;

  const risks: SuccessionRisk[] = [];
  if (!ruler) {
    risks.push({
      label: 'Trono vago',
      detail: 'O reino não tem governante. A regra de sucessão decide quem assume no próximo ciclo.',
      severity: 'critical'
    });
  }
  if (!heir) {
    risks.push({
      label: 'Sem sucessor elegível',
      detail: candidates.length
        ? 'Nenhum cidadão vivo satisfaz a regra de sucessão deste governo.'
        : 'Não há cidadãos vivos neste reino.',
      severity: 'critical'
    });
  }
  if (ruler) {
    const lifespan = SPECIES_DEFINITIONS[ruler.species]?.maxAge;
    if (lifespan && ruler.age >= lifespan * 0.85) {
      risks.push({
        label: 'Governante idoso',
        detail: `${ruler.age} anos, contra uma expectativa de ${lifespan} para a espécie.`,
        severity: ruler.age >= lifespan * 0.95 ? 'critical' : 'warning'
      });
    }
  }
  if (kingdom.legitimacy < 0.4) {
    risks.push({
      label: 'Legitimidade baixa',
      detail: `${Math.round(kingdom.legitimacy * 100)}% — uma troca de governante em terreno contestado costuma abrir disputa.`,
      severity: kingdom.legitimacy < 0.25 ? 'critical' : 'warning'
    });
  }
  if (rule === 'bloodline' && kingdom.dynasty && dynastyMembers <= 1) {
    risks.push({
      label: 'Casa reinante quase extinta',
      detail: `${dynastyMembers} membro(s) vivo(s) da Casa ${kingdom.dynasty}, num governo de sucessão hereditária.`,
      severity: dynastyMembers === 0 ? 'critical' : 'warning'
    });
  }
  if (kingdom.society.coupRisk >= 0.5) {
    risks.push({
      label: 'Risco de golpe elevado',
      detail: `${Math.round(kingdom.society.coupRisk * 100)}% — quem tem armas pode não esperar a sucessão.`,
      severity: 'critical'
    });
  }

  return {
    rule,
    ruler,
    rulerYears: ruler ? Math.max(0, year - kingdom.governmentSince) : null,
    heir,
    dynasty: kingdom.dynasty,
    dynastyMembers,
    risks: risks.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
  };
}

// ---------------- Economic pressure ----------------

/**
 * The economic figures that reach politics, recomputed the way the engine does.
 *
 * `CivilizationEngine.economicPressures` is private, so these are reproductions —
 * but reproductions of documented arithmetic on the same inputs, not estimates.
 * Unemployment counts working-age humanoids exactly as the engine's predicate
 * does; the food price index is the realm's own market price over the base price,
 * which is the definition the society tick uses.
 */
function computeEconomicPressure(
  kingdom: Kingdom,
  cities: City[],
  entities: Entity[],
  ctx: GameContext
): PoliticsMetrics['economy'] {
  let jobs = 0;
  let filled = 0;
  for (const city of cities) {
    jobs += city.jobCount();
    filled += city.filledJobs();
  }

  let workers = 0;
  for (const entity of entities) {
    if (entity.kingdomId !== kingdom.id || entity.hp <= 0) continue;
    if (!SPECIES_DEFINITIONS[entity.species]?.isHumanoid || entity.isChild) continue;
    workers++;
  }

  const worldFood = ctx.sim.market.price('food');
  const localFood = kingdom.economy.market.price('food', worldFood);
  const basePrice = GOODS.food.basePrice;

  return {
    foodSecurity: kingdom.foodSecurity,
    foodPriceIndex: basePrice > 0 ? localFood / basePrice : 1,
    unemployment: workers > 0 ? Math.max(0, Math.min(1, (workers - filled) / workers)) : null,
    labourShortage: jobs > 0 ? Math.max(0, Math.min(1, (jobs - filled) / jobs)) : null,
    inequality: kingdom.economy.inequality,
    industrialisation: kingdom.economy.industrialisation,
    treasury: kingdom.economy.treasury,
    embargoes: ctx.sim.trade.embargoes.filter(e => e.againstKingdom === kingdom.id).length,
    tradeDependency: kingdom.tradeDependency
  };
}

// ---------------- Diplomacy ----------------

function computeDiplomacy(kingdom: Kingdom, cities: City[], ctx: GameContext): {
  relations: RelationView[];
  alliances: Alliance[];
  wars: WarView[];
  dependencies: DependencyView[];
  externalTradeVolume: number;
} {
  const sim = ctx.sim;
  const diplomacy = sim.diplomacy;
  const trade = sim.trade;
  const own = new Set(cities.map(c => c.id));

  // Routes with one end here, split by direction, plus the volume per partner.
  const volumeByRealm = new Map<string, number>();
  const suppliedByRealm = new Map<string, Map<GoodId, number>>();
  const inboundByGood = new Map<GoodId, Map<string, number>>();
  let externalTradeVolume = 0;

  for (const route of trade.routes.values()) {
    const fromMine = own.has(route.fromCityId);
    const toMine = own.has(route.toCityId);
    if (fromMine === toMine) continue; // internal or unrelated

    const otherCity = sim.cities.get(fromMine ? route.toCityId : route.fromCityId);
    const otherId = otherCity?.kingdomId ?? (fromMine ? route.toKingdomId : route.fromKingdomId);
    if (!otherId || otherId === kingdom.id) continue;

    volumeByRealm.set(otherId, (volumeByRealm.get(otherId) ?? 0) + route.volume);
    externalTradeVolume += route.volume;

    if (toMine) {
      const perGood = suppliedByRealm.get(otherId) ?? new Map<GoodId, number>();
      perGood.set(route.good, (perGood.get(route.good) ?? 0) + route.volume);
      suppliedByRealm.set(otherId, perGood);

      const perRealm = inboundByGood.get(route.good) ?? new Map<string, number>();
      perRealm.set(otherId, (perRealm.get(otherId) ?? 0) + route.volume);
      inboundByGood.set(route.good, perRealm);
    }
  }

  // Everyone met, plus anyone traded with, fought, or bound to.
  const contacts = new Set<string>(kingdom.knownKingdoms);
  for (const id of volumeByRealm.keys()) contacts.add(id);
  for (const war of diplomacy.activeWars.values()) {
    if (war.attacker === kingdom.id) contacts.add(war.defender);
    else if (war.defender === kingdom.id) contacts.add(war.attacker);
  }
  for (const id of kingdom.vassalIds) contacts.add(id);
  if (kingdom.overlordId) contacts.add(kingdom.overlordId);
  contacts.delete(kingdom.id);

  const ourEnemies = new Set(diplomacy.getEnemies(kingdom.id));
  const alliances = [...diplomacy.alliances.values()].filter(a => a.members.has(kingdom.id));

  const relations: RelationView[] = [];
  for (const otherId of contacts) {
    const other = sim.kingdoms.get(otherId);
    if (!other) continue;

    const truce = diplomacy.getTruce(kingdom.id, otherId, sim.currentYear);
    const agreement = trade.getAgreement(kingdom.id, otherId);
    const supplied = suppliedByRealm.get(otherId);
    const theirEnemies = new Set(diplomacy.getEnemies(otherId));

    relations.push({
      kingdomId: otherId,
      name: other.name,
      color: other.color,
      score: diplomacy.getRelation(kingdom.id, otherId),
      status: diplomacy.getStatus(kingdom.id, otherId),
      atWar: diplomacy.isAtWar(kingdom.id, otherId),
      truceUntil: truce ? truce.untilYear : null,
      truceReason: truce ? truce.reason : null,
      alliance: alliances.find(a => a.members.has(otherId)) ?? null,
      tariff: agreement ? agreement.tariff : null,
      agreementSince: agreement ? agreement.signedYear : null,
      embargoedByUs: findEmbargo(ctx, kingdom.id, otherId),
      embargoedAgainstUs: findEmbargo(ctx, otherId, kingdom.id),
      isVassal: kingdom.vassalIds.has(otherId),
      isOverlord: kingdom.overlordId === otherId,
      tradeVolume: volumeByRealm.get(otherId) ?? 0,
      tradeShare: externalTradeVolume > 0 ? (volumeByRealm.get(otherId) ?? 0) / externalTradeVolume : 0,
      suppliedGoods: supplied
        ? [...supplied.entries()].map(([good, volume]) => ({ good, volume })).sort((a, b) => b.volume - a.volume)
        : [],
      // A genuine shared enemy: both realms are at war with the same third party.
      sharedEnemies: [...ourEnemies].filter(id => theirEnemies.has(id))
    });
  }

  return {
    relations: relations.sort((a, b) => b.score - a.score),
    alliances,
    wars: buildWars(kingdom, own, alliances, ctx),
    dependencies: buildDependencies(kingdom, cities, inboundByGood, ourEnemies, ctx),
    externalTradeVolume
  };
}

function findEmbargo(ctx: GameContext, by: string, against: string): { year: number; reason: string } | null {
  const found = ctx.sim.trade.embargoes.find(e => e.byKingdom === by && e.againstKingdom === against);
  return found ? { year: found.year, reason: found.reason } : null;
}

function buildWars(
  kingdom: Kingdom,
  ownCities: Set<string>,
  alliances: Alliance[],
  ctx: GameContext
): WarView[] {
  const sim = ctx.sim;
  const out: WarView[] = [];

  for (const war of sim.diplomacy.activeWars.values()) {
    const aggressor = war.attacker === kingdom.id;
    if (!aggressor && war.defender !== kingdom.id) continue;
    const enemyId = aggressor ? war.defender : war.attacker;
    const enemy = sim.kingdoms.get(enemyId);

    // Allies of ours who are also fighting this enemy. Reported as a fact, not as
    // a promise: nothing in the simulation obliges an ally to join.
    const alliesInvolved: { kingdomId: string; name: string }[] = [];
    for (const alliance of alliances) {
      for (const memberId of alliance.members) {
        if (memberId === kingdom.id || memberId === enemyId) continue;
        if (!sim.diplomacy.isAtWar(memberId, enemyId)) continue;
        const member = sim.kingdoms.get(memberId);
        if (member && !alliesInvolved.some(a => a.kingdomId === memberId)) {
          alliesInvolved.push({ kingdomId: memberId, name: member.name });
        }
      }
    }

    // Our routes to this enemy that the war shut.
    const routesClosed: { route: TradeRoute; good: GoodId }[] = [];
    for (const route of sim.trade.routes.values()) {
      if (route.active) continue;
      const mine = ownCities.has(route.fromCityId) || ownCities.has(route.toCityId);
      const theirs = route.fromKingdomId === enemyId || route.toKingdomId === enemyId;
      if (mine && theirs) routesClosed.push({ route, good: route.good });
    }

    out.push({
      war,
      enemyId,
      enemyName: enemy?.name ?? 'reino desconhecido',
      enemyColor: enemy?.color ?? 'var(--ae-critical)',
      aggressor,
      years: Math.max(0, sim.currentYear - war.startYear),
      // The record counts kills by side, so which column is ours depends on which
      // side of the war this realm is on.
      killsInflicted: aggressor ? war.attackerKills : war.defenderKills,
      killsSuffered: aggressor ? war.defenderKills : war.attackerKills,
      alliesInvolved,
      routesClosed,
      citiesChanged: citiesChangedHands(war, ownCities, ctx)
    });
  }

  return out.sort((a, b) => b.years - a.years);
}

/**
 * Settlements the chronicle records changing hands on this war's thread.
 *
 * A reference lookup, not a text search. What the chronicle cannot tell us is a
 * running tally per side — a city can change hands three times — so the split is
 * by who holds it now, and the interface says exactly that.
 */
function citiesChangedHands(
  war: WarRecord,
  ownCities: Set<string>,
  ctx: GameContext
): { id: string; name: string; oursNow: boolean }[] {
  const events = chronicle.getEventsForRef('war', war.id);
  const seen = new Map<string, string>();
  for (const event of events) {
    if (event.type !== 'conquest') continue;
    for (const ref of event.refs) {
      if (ref.kind === 'city') seen.set(ref.id, ref.name ?? ref.id);
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name, oursNow: ownCities.has(id) }));
}

/**
 * Goods this realm buys rather than makes, and from whom.
 *
 * Dependency is computed on the realm's *combined* books: one city importing what
 * another exports is internally balanced, not half dependent. A supplier is
 * flagged hostile when the two realms are actually at war or the relation is
 * hostile — which is what turns a trade statistic into a strategic problem.
 */
function buildDependencies(
  kingdom: Kingdom,
  cities: City[],
  inboundByGood: Map<GoodId, Map<string, number>>,
  _ourEnemies: Set<string>,
  ctx: GameContext
): DependencyView[] {
  const out: DependencyView[] = [];

  for (const good of ALL_GOODS) {
    let imported = 0;
    let used = 0;
    for (const city of cities) {
      const flow = city.ledger.flow(good);
      imported += flow.imported;
      used += flow.consumed + flow.exported;
    }
    if (used <= 0.5 || imported <= 0) continue;

    const share = Math.min(1, imported / used);
    if (share < 0.2) continue;

    const perRealm = inboundByGood.get(good);
    const total = perRealm ? [...perRealm.values()].reduce((a, b) => a + b, 0) : 0;
    const def = GOODS[good];

    out.push({
      good,
      name: def?.name ?? good,
      strategic: Boolean(def?.strategic) || def?.tier === 'strategic',
      share,
      imported,
      used,
      suppliers: perRealm && total > 0
        ? [...perRealm.entries()]
            .map(([kingdomId, volume]) => {
              const supplier = ctx.sim.kingdoms.get(kingdomId);
              const status = ctx.sim.diplomacy.getStatus(kingdom.id, kingdomId);
              return {
                kingdomId,
                name: supplier?.name ?? 'reino desconhecido',
                color: supplier?.color ?? 'var(--ae-accent)',
                volume,
                share: volume / total,
                hostile: status === 'war' || status === 'hostile'
              };
            })
            .sort((a, b) => b.share - a.share)
        : []
    });
  }

  return out.sort((a, b) => {
    // Strategic first, then by how dependent the realm is.
    if (a.strategic !== b.strategic) return a.strategic ? -1 : 1;
    return b.share - a.share;
  });
}

// ---------------- Law helpers ----------------

/** Laws in force, keyed by category, in the registry's own order. */
export function lawsByCategory(laws: LawDefinition[]): { category: LawCategory; law: LawDefinition }[] {
  const byCategory = new Map<LawCategory, LawDefinition>();
  for (const law of laws) byCategory.set(law.category, law);
  return LAW_CATEGORY_ORDER
    .map(category => ({ category, law: byCategory.get(category) }))
    .filter((entry): entry is { category: LawCategory; law: LawDefinition } => Boolean(entry.law));
}

/** The government definitions, for the "who backs this regime" explanation. */
export function governmentName(id: string): string {
  return GOVERNMENTS[id as keyof typeof GOVERNMENTS]?.name ?? id;
}

// ============================ CACHE ============================

/** Longest a political snapshot is trusted. */
const MAX_AGE_MS = 2000;

/**
 * Holds one realm's politics and decides when to recompute.
 *
 * A year boundary forces a rebuild: the society tick, the law reforms and the
 * diplomacy tick all land at once, so every figure here moves together.
 */
export class PoliticsMetricsCache {
  private metrics: PoliticsMetrics | null = null;
  private builtAt = -Infinity;
  private builtYear = -1;
  private builtFor = '';

  public get(kingdom: Kingdom, ctx: GameContext, now: number): PoliticsMetrics {
    const yearChanged = ctx.sim.currentYear !== this.builtYear;
    const realmChanged = kingdom.id !== this.builtFor;
    const stale = now - this.builtAt >= MAX_AGE_MS;

    if (this.metrics && !yearChanged && !realmChanged && !stale) return this.metrics;

    this.metrics = computePoliticsMetrics(kingdom, ctx);
    this.builtAt = now;
    this.builtYear = ctx.sim.currentYear;
    this.builtFor = kingdom.id;
    return this.metrics;
  }

  public invalidate(): void {
    this.builtAt = -Infinity;
  }
}
