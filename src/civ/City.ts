import { Building, BuildingType, BUILDINGS, type UrbanHistoricalPhase } from './Building';
import { SpeciesType } from '../entities/Species';
import { Stockpile, GoodId } from './Goods';
import { CityLedger } from './Economy';
import { TerrainType, TERRAINS } from '../world/Biomes';
import { CompactTerritory } from '../world/CompactTerritory';
import { nextId } from '../core/Random';
import type { ArchitecturalProfile } from './ArchitecturalProfile';
import { architecturalProfileIsValid } from './ArchitecturalProfile';
import type { FortificationLine } from './FortificationPlanner';
import type { UrbanDistrictCell, UrbanSpecialization } from './UrbanDistricts';

/**
 * A settlement. Grows through tiers as its population rises, and each tier
 * unlocks more building slots, more territory and a larger stockpile.
 */

export type SettlementTier = 'camp' | 'hamlet' | 'village' | 'town' | 'city' | 'metropolis';

export interface UrbanPhaseRecord {
  phase: UrbanHistoricalPhase;
  startedYear: number;
  /** Survey radius when the phase first appeared; useful for historical rings. */
  radius: number;
}

export interface UrbanLifecycleChronicle {
  lastFireYear: number | null;
  lastDestructionYear: number | null;
  lastAbandonmentYear: number | null;
  lastReconstructionYear: number | null;
  lastRecoveryYear: number | null;
}

export type SiegePhase = 'encirclement' | 'bombardment' | 'assault' | 'starvation' | 'negotiation';

export interface SiegeState {
  phase: SiegePhase;
  wallBreaches: number;
  towersCaptured: number;
  gatesForced: number;
  siegeEnginesDeployed: number;
  defenderFood: number;
  defenderMorale: number;
  attackerMorale: number;
  surrenderWillingness: number; // 0..1
  assaultAttempts: number;
}

const URBAN_PHASE_ORDER: readonly UrbanHistoricalPhase[] = ['settlement', 'village', 'city', 'great_city', 'metropolis'];

export function historicalPhaseForTier(tier: SettlementTier): UrbanHistoricalPhase {
  if (tier === 'camp') return 'settlement';
  if (tier === 'hamlet' || tier === 'village') return 'village';
  if (tier === 'town') return 'city';
  if (tier === 'city') return 'great_city';
  return 'metropolis';
}

export interface TierInfo {
  id: SettlementTier;
  name: string;
  icon: string;
  minPopulation: number;
  /** How many buildings this tier supports. */
  buildingSlots: number;
  /** Territory tiles it may claim, before technology bonuses. */
  territoryLimit: number;
  storage: number;
  color: string;
}

export const SETTLEMENT_TIERS: TierInfo[] = [
  // Early slots have to cover a town centre, some housing AND the first
  // production buildings. Too few and a settlement fills up on houses before it
  // can ever raise a lumber camp or quarry, which stalls the whole tech economy.
  // Territory limits are what decide whether the map reads as a settled world or
  // as a few specks on an empty continent. A limit of 20 tiles is a blob three
  // tiles wide; realms could never grow into contact, so the map never developed
  // borders at all. These are sized so neighbouring realms actually meet and
  // partition the land between them.
  // Claimed land is cheap — it is one flag per tile. Population is expensive, since
  // every citizen is a simulated entity. Tying territory tightly to population meant
  // realms stayed as specks on an empty continent forever. Territory is therefore
  // allowed to run well ahead of headcount: a small realm still rules a real region,
  // and neighbouring realms grow into contact and partition the land between them.
  { id: 'camp', name: 'Camp', icon: '⛺', minPopulation: 0, buildingSlots: 8, territoryLimit: 60, storage: 250, color: '#a8a29e' },
  { id: 'hamlet', name: 'Hamlet', icon: '🛖', minPopulation: 8, buildingSlots: 16, territoryLimit: 175, storage: 400, color: '#b45309' },
  { id: 'village', name: 'Village', icon: '🏘️', minPopulation: 20, buildingSlots: 26, territoryLimit: 380, storage: 650, color: '#22c55e' },
  { id: 'town', name: 'Town', icon: '🏙️', minPopulation: 45, buildingSlots: 36, territoryLimit: 700, storage: 950, color: '#38bdf8' },
  { id: 'city', name: 'City', icon: '🏛️', minPopulation: 90, buildingSlots: 50, territoryLimit: 1200, storage: 1400, color: '#a855f7' },
  { id: 'metropolis', name: 'Metropolis', icon: '🌆', minPopulation: 180, buildingSlots: 70, territoryLimit: 2000, storage: 2200, color: '#fbbf24' }
];

export function tierForPopulation(population: number): TierInfo {
  let result = SETTLEMENT_TIERS[0];
  for (const tier of SETTLEMENT_TIERS) {
    if (population >= tier.minPopulation) result = tier;
  }
  return result;
}

export class City {
  public id: string;
  public name: string;
  public species: SpeciesType;
  public x: number;
  public y: number;
  public kingdomId: string | null = null;
  public founderName: string;
  public foundingYear: number;
  public population: number = 0;
  public mayorId: string | null = null;

  /** Everything this settlement physically holds. */
  public stock: Stockpile;
  public territory: CompactTerritory = new CompactTerritory();
  public buildings: Map<string, Building> = new Map();
  /** Renderer-facing topology generation; changes only when building membership changes. */
  public buildingVersion: number = 1;
  /** Durable, compact timeline; detailed lot/block state remains derived. */
  public urbanHistory: UrbanPhaseRecord[] = [];
  /** CITY-V3 event-derived identity. Renderer reads it; it is never recomputed per frame. */
  public architecturalProfile: ArchitecturalProfile | null = null;
  /** Runtime cache generation for the urban planner. */
  public architecturalVersion: number = 0;
  /** CITY-V4 durable defensive rings. Geometry is rebuilt only when a line is commissioned. */
  public fortificationLines: FortificationLine[] = [];
  /** CITY-V5 compact functional cells; boundaries emerge from activity, never zoning. */
  public urbanDistricts: UrbanDistrictCell[] = [];
  public urbanSpecialization: UrbanSpecialization | null = null;
  public districtVersion: number = 0;
  /** CITY-V6 city-wide memory; detailed physical state remains on each building. */
  public peakPopulation: number = 0;
  public urbanCrisisYears: number = 0;
  public lifecycleVersion: number = 0;
  public urbanLifecycleChronicle: UrbanLifecycleChronicle = {
    lastFireYear: null,
    lastDestructionYear: null,
    lastAbandonmentYear: null,
    lastReconstructionYear: null,
    lastRecoveryYear: null
  };

  public tier: SettlementTier = 'camp';
  /**
   * Highest building-slot budget this settlement has ever earned. A famine or
   * war can drop population (and therefore `tier`) below what it once was, but
   * buildings already standing don't get bulldozed — without this floor, a
   * settlement that dips even briefly would find its already-built count over
   * the new, lower cap and lose the ability to ever construct again (including
   * the farm it would need to recover), locking the decline in permanently.
   */
  private peakBuildingSlots: number = SETTLEMENT_TIERS[0].buildingSlots;
  /** Settlement this one was founded from, if any. */
  public parentCityId: string | null = null;
  /** 0..1 — how well fed and housed the population is. */
  public prosperity: number = 0.5;
  /** Years the settlement has gone hungry in a row. */
  public famineYears: number = 0;
  // ============ SIEGE ============
  /** Realm currently besieging this settlement, if any. */
  public besiegerId: string | null = null;
  /** Detailed phase and breach state for active sieges (WAR-V5). */
  public siegeState: SiegeState | null = null;

  // ============ CULTURE (CULT-V1) ============
  /**
   * Cultural composition of the residents, as shares summing to 1. A cache,
   * rebuilt once a year from a walk the simulation was already making — never
   * recomputed per frame and never trusted as durable state.
   */
  public cultureMix: Record<string, number> = {};
  /** Largest share in `cultureMix`. Null until the first census runs. */
  public dominantCultureId: string | null = null;
  /**
   * Year the dominant culture last changed here. A settlement has to be
   * culturally settled for a long time before it can produce a culture of its
   * own, and this is what "a long time" is measured against.
   */
  public culturallySettledSince: number = 0;
  /** 0..1 — how close the besieger is to taking the walls. */
  public siegeProgress: number = 0;
  /** Years this settlement has been under siege without relief. */
  public siegeYears: number = 0;
  /** Year the settlement last changed hands by force. */
  public capturedYear: number | null = null;
  /** Realm that held this settlement before it was taken. */
  public formerOwnerId: string | null = null;

  /** Research points this settlement contributed last year. */
  public researchOutput: number = 0;
  /** Value of goods produced last year, at market prices. */
  public economicOutput: number = 0;
  /** Where every good came from and went last year. Written by production, consumption and trade. */
  public ledger: CityLedger = new CityLedger();
  /**
   * Food households already bought out of the store this year.
   *
   * Families shop daily while the settlement settles its books yearly. Both draw
   * on the same stockpile, so the yearly pass must subtract what the families
   * already took or the population eats twice.
   */
  public householdFoodDrawn: number = 0;

  // ========== RESOURCE CACHE (rebuilt yearly) ==========
  private resourceCacheYear: number = 0;
  public resourcesByTileType: Map<TerrainType, { x: number; y: number }[]> = new Map();
  public resourcesByGood: Map<GoodId, { x: number; y: number }[]> = new Map();

  constructor(id: string, name: string, species: SpeciesType, x: number, y: number, founderName: string, foundingYear: number) {
    this.id = id;
    this.name = name;
    this.species = species;
    this.x = x;
    this.y = y;
    this.founderName = founderName;
    this.foundingYear = foundingYear;

    this.stock = new Stockpile(SETTLEMENT_TIERS[0].storage, { food: 100, wood: 50, stone: 30 });
    this.territory.add(`${x},${y}`);

    const tc = new Building(`b_tc_${id}`, 'town_center', x, y, id);
    tc.recordUrbanOrigin(foundingYear, 'settlement', 0);
    this.buildings.set(tc.id, tc);
    this.urbanHistory.push({ phase: 'settlement', startedYear: foundingYear, radius: 0 });
  }

  // ============================ TIERS ============================

  public get tierInfo(): TierInfo {
    return SETTLEMENT_TIERS.find(t => t.id === this.tier) ?? SETTLEMENT_TIERS[0];
  }

  /** Recomputes the tier from population. Returns the new tier if it changed. */
  public updateTier(): TierInfo | null {
    const next = tierForPopulation(this.population);
    this.peakBuildingSlots = Math.max(this.peakBuildingSlots, next.buildingSlots);
    if (next.id === this.tier) return null;

    const previous = this.tier;
    this.tier = next.id;
    this.stock.capacity = next.storage + this.storageBonus();

    // Only announce growth, not decline from plague or war.
    const grew = SETTLEMENT_TIERS.findIndex(t => t.id === next.id) >
      SETTLEMENT_TIERS.findIndex(t => t.id === previous);
    return grew ? next : null;
  }

  public storageBonus(): number {
    let bonus = 0;
    for (const b of this.buildings.values()) {
      bonus += (b.definition.storage ?? 0) * b.level * b.operationalFactor();
    }
    return bonus;
  }

  // ============================ CAPACITY ============================

  public get buildingSlots(): number {
    return Math.max(this.tierInfo.buildingSlots, this.peakBuildingSlots);
  }

  /**
   * Unique civic buildings (granary, market, harbor, palace...) are already
   * capped at one apiece by definition. Counting them against the same slot
   * budget as houses, farms and mines means every tech unlock permanently
   * shrinks the room left to actually scale with population — the more a
   * kingdom researches, the fewer houses/farms it can ever add. Only
   * repeatable buildings compete for the numeric slot cap.
   */
  public hasFreeBuildingSlot(): boolean {
    let repeatable = 0;
    for (const b of this.buildings.values()) {
      // Curtain walls are infrastructure pieces, not urban lots. Counting a
      // 40-segment perimeter here would freeze normal city growth forever.
      if (!b.definition.unique && !b.fortificationRole && b.countsTowardBuildingSlots()) repeatable++;
    }
    return repeatable < this.buildingSlots;
  }

  /** Job slots this settlement offers, counting building levels. */
  public jobCount(): number {
    let jobs = 0;
    for (const b of this.buildings.values()) jobs += (b.definition.jobs ?? 0) * b.level * b.operationalFactor();
    return jobs;
  }

  /** Job slots currently filled by a real, living worker. */
  public filledJobs(): number {
    let filled = 0;
    for (const b of this.buildings.values()) if (b.isOperational()) filled += b.assignedWorkerIds.size;
    return filled;
  }

  /**
   * Claims the land a new settlement plainly controls the moment it is founded.
   *
   * Starting from a single tile made every new settlement invisible on the map
   * until decades of yearly expansion had accumulated, so a freshly founded world
   * looked like empty wilderness. A founding claim gives each settlement a region
   * from day one and gets neighbours into contact far sooner.
   */
  public seedFoundingClaim(
    tileMap: import('../world/TileMap').TileMap,
    radius: number = 4
  ): void {
    const cx = Math.floor(this.x);
    const cy = Math.floor(this.y);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.hypot(dx, dy) > radius + 0.3) continue;
        const tile = tileMap.getTile(cx + dx, cy + dy);
        if (!tile) continue;
        if (TERRAINS[tile.type].isWater || tile.type === TerrainType.LAVA) continue;
        // Never annex land another realm already holds.
        if (tile.kingdomId && tile.kingdomId !== this.kingdomId) continue;

        this.territory.add(`${tile.x},${tile.y}`);
        if (this.kingdomId && tile.kingdomId !== this.kingdomId) {
          tile.kingdomId = this.kingdomId;
          tileMap.markRenderDirty(tile.x, tile.y);
        }
      }
    }
  }

  public territoryLimit(techBonus: number = 0, governmentBonus: number = 0): number {
    return this.tierInfo.territoryLimit + techBonus + governmentBonus;
  }

  /** Total citizens the settlement can house. Growth stalls beyond this. */
  public housingCapacity(): number {
    let capacity = 0;
    for (const b of this.buildings.values()) {
      capacity += (b.definition.housing ?? 0) * b.level * b.operationalFactor();
    }
    return capacity;
  }

  /** Workers needed to fully staff every building. */
  public jobsAvailable(): number {
    let jobs = 0;
    for (const b of this.buildings.values()) {
      jobs += (b.definition.jobs ?? 0) * b.level * b.operationalFactor();
    }
    return jobs;
  }

  /** Combined defensive multiplier from walls, barracks and keeps. */
  public defenseMultiplier(): number {
    let multiplier = 1;
    let legacyWalls = 0;
    for (const b of this.buildings.values()) {
      if (b.type === 'wall') {
        if (!b.fortificationRole) legacyWalls++;
        continue;
      }
      if (!b.isOperational()) continue;
      const def = b.definition.defense;
      if (def) multiplier *= 1 + (def - 1) * (1 + (b.level - 1) * 0.4);
    }
    // Old saves may contain free-standing wall buildings. Keep their value but
    // bound it instead of multiplying 1.25 once per physical segment.
    let fortification = Math.min(.6, legacyWalls * .12);
    for (const line of this.fortificationLines) {
      let intact = 0;
      let towers = 0;
      let gates = 0;
      for (const id of line.buildingIds) {
        const piece = this.buildings.get(id);
        if (!piece || piece.hp <= 0) continue;
        intact += Math.max(0, Math.min(1, piece.hp / Math.max(1, piece.maxHp)));
        if (piece.fortificationRole === 'tower') towers++;
        if (piece.fortificationRole === 'gate') gates++;
      }
      const completeness = line.buildingIds.length > 0 ? intact / line.buildingIds.length : 0;
      const lineValue = Math.min(1.15, .22 + completeness * .42 + towers * .018 - gates * .012);
      fortification += line.status === 'active' ? lineValue : lineValue * .22;
    }
    return multiplier * (1 + Math.min(2.2, fortification));
  }

  /** Current integrity (0..1) of all wall and fortification segments combined. */
  public wallIntegrity(): number {
    let totalHp = 0;
    let totalMaxHp = 0;
    for (const b of this.buildings.values()) {
      if (b.type === 'wall' || b.fortificationRole) {
        totalHp += Math.max(0, b.hp);
        totalMaxHp += b.maxHp;
      }
    }
    if (totalMaxHp === 0) return 1.0;
    return totalHp / totalMaxHp;
  }

  /** Estimated months of food remaining under current population demand. */
  public foodMonthsRemaining(): number {
    const annualDemand = Math.max(1, this.population * 0.3);
    const storedFood = this.stock.get('food');
    return (storedFood / annualDemand) * 12;
  }

  // ============================ BUILDINGS ============================

  public countOfType(type: BuildingType): number {
    let count = 0;
    for (const b of this.buildings.values()) if (b.type === type) count++;
    return count;
  }

  public hasBuilding(type: BuildingType): boolean {
    return this.countOfType(type) > 0;
  }

  public addBuilding(type: BuildingType, bx: number, by: number): Building {
    const b = new Building(nextId('b'), type, bx, by, this.id);
    this.buildings.set(b.id, b);
    this.buildingVersion++;
    this.stock.capacity = this.tierInfo.storage + this.storageBonus();
    return b;
  }

  public removeBuilding(id: string): void {
    if (this.buildings.delete(id)) this.buildingVersion++;
    this.stock.capacity = this.tierInfo.storage + this.storageBonus();
  }

  public get urbanPhase(): UrbanHistoricalPhase { return historicalPhaseForTier(this.tier); }

  public get currentUrbanGeneration(): number {
    let generation = 0;
    for (const record of this.urbanHistory) generation = Math.max(generation, URBAN_PHASE_ORDER.indexOf(record.phase));
    return Math.max(0, generation);
  }

  /** Records only forward historical transitions; temporary population loss never rewrites the city. */
  public recordUrbanPhase(year: number, radius: number): boolean {
    const phase = this.urbanPhase;
    const nextGeneration = URBAN_PHASE_ORDER.indexOf(phase);
    if (nextGeneration <= this.currentUrbanGeneration) return false;
    this.urbanHistory.push({ phase, startedYear: year, radius: Math.max(0, radius) });
    return true;
  }

  /** For rare systems that install a prebuilt landmark directly. */
  public markBuildingTopologyChanged(): void { this.buildingVersion++; }

  /** Buildings of a category, used by the construction AI to balance a settlement. */
  public buildingsOfCategory(category: string): Building[] {
    return [...this.buildings.values()].filter(b => b.definition.category === category);
  }

  /** Unassign worker from all buildings in this city (on death or migration). */
  public unassignWorker(workerId: string): void {
    for (const building of this.buildings.values()) {
      building.assignedWorkerIds.delete(workerId);
    }
  }

  /** Total job slots vs filled slots for a building type. */
  public jobSlotInfo(type: BuildingType): { total: number; filled: number } {
    let total = 0, filled = 0;
    for (const b of this.buildings.values()) {
      if (b.type === type && b.isOperational()) {
        total += (b.definition.jobs ?? 0);
        filled += b.assignedWorkerIds.size;
      }
    }
    return { total, filled };
  }

  /** Rebuild cached lists of nearby resource tiles.  Called once per year. */
  public rebuildResourceCache(tileMap: import('../world/TileMap').TileMap, year: number, surveyRadius: number): void {
    if (this.resourceCacheYear === year) return;
    this.resourceCacheYear = year;
    this.resourcesByTileType.clear();
    this.resourcesByGood.clear();

    const cx = Math.floor(this.x), cy = Math.floor(this.y);
    for (let dx = -surveyRadius; dx <= surveyRadius; dx++) {
      for (let dy = -surveyRadius; dy <= surveyRadius; dy++) {
        const tile = tileMap.getTile(cx + dx, cy + dy);
        if (!tile || TERRAINS[tile.type].isWater || tile.type === TerrainType.LAVA) continue;
        if (tile.resourceAmount > 0) {
          const pos = { x: tile.x, y: tile.y };
          // Index by terrain type
          if (tile.type === TerrainType.FOREST) {
            let arr = this.resourcesByTileType.get(TerrainType.FOREST);
            if (!arr) { arr = []; this.resourcesByTileType.set(TerrainType.FOREST, arr); }
            arr.push(pos);
          }
          // Index by resource good
          if (tile.resourceType) {
            let arr = this.resourcesByGood.get(tile.resourceType);
            if (!arr) { arr = []; this.resourcesByGood.set(tile.resourceType, arr); }
            arr.push(pos);
          }
        }
      }
    }
    // Sort each array by distance to city center
    const sortFn = (a: {x:number;y:number}, b: {x:number;y:number}) =>
      ((a.x - cx) ** 2 + (a.y - cy) ** 2) - ((b.x - cx) ** 2 + (b.y - cy) ** 2);
    for (const [, arr] of this.resourcesByTileType) arr.sort(sortFn);
    for (const [, arr] of this.resourcesByGood) arr.sort(sortFn);
  }

  public nearestCached(type: TerrainType, fromX: number, fromY: number): { x: number; y: number } | null {
    const sites = this.resourcesByTileType.get(type);
    if (!sites || sites.length === 0) return null;
    let best: { x: number; y: number } | null = null, bestDist = Infinity;
    for (const s of sites) {
      const d = (s.x - fromX) ** 2 + (s.y - fromY) ** 2;
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return best;
  }

  // ============================ CONVENIENCE ============================

  /** Legacy accessor kept so older UI paths keep reading sensible numbers. */
  public get resources(): Record<'wood' | 'stone' | 'iron' | 'food' | 'gold', number> {
    return {
      wood: Math.round(this.stock.get('wood')),
      stone: Math.round(this.stock.get('stone')),
      iron: Math.round(this.stock.get('iron')),
      food: Math.round(this.stock.get('food')),
      gold: Math.round(this.stock.get('gold'))
    };
  }

  public give(good: GoodId, amount: number): number {
    return this.stock.add(good, amount);
  }

  public take(good: GoodId, amount: number): number {
    return this.stock.take(good, amount);
  }

  public serialize(): any {
    return {
      id: this.id,
      name: this.name,
      species: this.species,
      x: this.x,
      y: this.y,
      kingdomId: this.kingdomId,
      founderName: this.founderName,
      foundingYear: this.foundingYear,
      population: this.population,
      mayorId: this.mayorId,
      tier: this.tier,
      peakBuildingSlots: this.peakBuildingSlots,
      parentCityId: this.parentCityId,
      prosperity: this.prosperity,
      famineYears: this.famineYears,
      besiegerId: this.besiegerId,
      // CULT-V1: dominant identity and how long it has held. The share table
      // itself is a cache and rebuilds on the first census after load.
      dominantCultureId: this.dominantCultureId,
      culturallySettledSince: this.culturallySettledSince,
      siegeProgress: this.siegeProgress,
      siegeYears: this.siegeYears,
      siegeState: this.siegeState,
      capturedYear: this.capturedYear,
      formerOwnerId: this.formerOwnerId,
      stock: this.stock.serialize(),
      ledger: this.ledger.serialize(),
      territory: Array.from(this.territory),
      buildings: [...this.buildings.values()].map(b => ({
        id: b.id,
        type: b.type,
        x: b.x,
        y: b.y,
        level: b.level,
        hp: b.hp,
        maxHp: b.maxHp,
        extractedGood: b.extractedGood,
        assignedWorkerIds: [...b.assignedWorkerIds],
        builtYear: b.builtYear,
        originPhase: b.originPhase,
        originGeneration: b.originGeneration,
        renovatedYear: b.renovatedYear,
        visualPhase: b.visualPhase,
        architecture: b.architecture,
        fortificationRole: b.fortificationRole,
        fortificationLineId: b.fortificationLineId,
        urbanContext: b.urbanContext,
        lifecycleState: b.lifecycleState,
        lifecycleProgress: b.lifecycleProgress,
        stateSinceYear: b.stateSinceYear,
        lastLifecycleYear: b.lastLifecycleYear,
        abandonmentYears: b.abandonmentYears,
        natureReclaim: b.natureReclaim,
        lastDamageYear: b.lastDamageYear,
        lastDamageCause: b.lastDamageCause,
        lifecycleHistory: b.lifecycleHistory
      })),
      urbanHistory: this.urbanHistory,
      architecturalProfile: this.architecturalProfile,
      fortificationLines: this.fortificationLines,
      urbanDistricts: this.urbanDistricts,
      urbanSpecialization: this.urbanSpecialization,
      peakPopulation: this.peakPopulation,
      urbanCrisisYears: this.urbanCrisisYears,
      urbanLifecycleChronicle: this.urbanLifecycleChronicle
    };
  }

  public static deserialize(data: any): City {
    const city = new City(data.id, data.name, data.species, data.x, data.y, data.founderName, data.foundingYear);
    city.kingdomId = data.kingdomId ?? null;
    city.population = data.population ?? 0;
    city.mayorId = data.mayorId ?? null;
    city.tier = data.tier ?? 'camp';
    // Older saves predate this field: fall back to the current tier's slots so
    // an old save doesn't retroactively invent a lower cap than it was playing
    // with (see `peakBuildingSlots` field comment for why this must never drop).
    city.peakBuildingSlots = Math.max(data.peakBuildingSlots ?? 0, city.tierInfo.buildingSlots);
    city.parentCityId = data.parentCityId ?? null;
    city.prosperity = data.prosperity ?? 0.5;
    city.famineYears = data.famineYears ?? 0;
    city.besiegerId = data.besiegerId ?? null;
    city.dominantCultureId = data.dominantCultureId ?? null;
    city.culturallySettledSince = data.culturallySettledSince ?? 0;
    city.siegeProgress = data.siegeProgress ?? 0;
    city.siegeYears = data.siegeYears ?? 0;
    city.siegeState = data.siegeState ?? null;
    city.capturedYear = data.capturedYear ?? null;
    city.formerOwnerId = data.formerOwnerId ?? null;
    city.urbanHistory = Array.isArray(data.urbanHistory) && data.urbanHistory.length > 0
      ? data.urbanHistory.map((record: any) => ({ phase: record.phase, startedYear: record.startedYear, radius: record.radius ?? 0 }))
      : [{ phase: 'settlement', startedYear: city.foundingYear, radius: 0 }];
    city.architecturalProfile = architecturalProfileIsValid(data.architecturalProfile) ? data.architecturalProfile : null;
    city.architecturalVersion = city.architecturalProfile?.revision ?? 0;
    city.fortificationLines = Array.isArray(data.fortificationLines)
      ? data.fortificationLines.map((line: FortificationLine) => ({
          ...line,
          outline: Array.isArray(line.outline) ? line.outline : [],
          buildingIds: Array.isArray(line.buildingIds) ? line.buildingIds : [],
          gateIds: Array.isArray(line.gateIds) ? line.gateIds : [],
          towerIds: Array.isArray(line.towerIds) ? line.towerIds : []
        }))
      : [];
    city.urbanDistricts = Array.isArray(data.urbanDistricts) ? data.urbanDistricts : [];
    city.urbanSpecialization = data.urbanSpecialization ?? null;
    city.districtVersion = city.urbanDistricts.length > 0 ? 1 : 0;
    city.peakPopulation = Math.max(data.peakPopulation ?? 0, city.population);
    city.urbanCrisisYears = data.urbanCrisisYears ?? 0;
    city.urbanLifecycleChronicle = {
      ...city.urbanLifecycleChronicle,
      ...(data.urbanLifecycleChronicle ?? {})
    };
    city.territory = new CompactTerritory(data.territory ?? [`${data.x},${data.y}`]);

    if (Array.isArray(data.buildings) && data.buildings.length > 0) {
      city.buildings.clear();
      for (const bd of data.buildings) {
        const b = new Building(bd.id, bd.type, bd.x, bd.y, city.id);
        b.level = bd.level ?? 1;
        b.maxHp = bd.maxHp ?? (BUILDINGS[bd.type as BuildingType]?.maxHp ?? 150) * (1 + (b.level - 1) * 0.5);
        b.hp = bd.hp ?? b.maxHp;
        b.extractedGood = bd.extractedGood ?? null;
        b.assignedWorkerIds = new Set(bd.assignedWorkerIds ?? []);
        const fallbackPhase = historicalPhaseForTier(city.tier);
        b.builtYear = bd.builtYear ?? city.foundingYear;
        b.originPhase = bd.originPhase ?? fallbackPhase;
        b.originGeneration = bd.originGeneration ?? Math.max(0, URBAN_PHASE_ORDER.indexOf(b.originPhase));
        b.renovatedYear = bd.renovatedYear ?? null;
        b.visualPhase = bd.visualPhase ?? b.originPhase;
        b.architecture = bd.architecture ?? null;
        b.fortificationRole = bd.fortificationRole ?? null;
        b.fortificationLineId = bd.fortificationLineId ?? null;
        b.urbanContext = bd.urbanContext ?? null;
        const inferredState = b.hp / Math.max(1, b.maxHp) <= .12
          ? 'ruin'
          : b.hp / Math.max(1, b.maxHp) <= .9 ? 'damaged' : 'normal';
        b.lifecycleState = bd.lifecycleState ?? inferredState;
        b.lifecycleProgress = bd.lifecycleProgress ?? (b.lifecycleState === 'normal' || b.lifecycleState === 'damaged' ? 1 : 0);
        b.stateSinceYear = bd.stateSinceYear ?? b.builtYear;
        b.lastLifecycleYear = bd.lastLifecycleYear ?? b.stateSinceYear;
        b.abandonmentYears = bd.abandonmentYears ?? 0;
        b.natureReclaim = bd.natureReclaim ?? 0;
        b.lastDamageYear = bd.lastDamageYear ?? null;
        b.lastDamageCause = bd.lastDamageCause ?? null;
        b.lifecycleHistory = Array.isArray(bd.lifecycleHistory) ? bd.lifecycleHistory.slice(-8) : [];
        city.buildings.set(b.id, b);
      }
    }

    city.stock.capacity = city.tierInfo.storage + city.storageBonus();
    city.stock.deserialize(data.stock);
    city.ledger.deserialize(data.ledger);
    return city;
  }
}
