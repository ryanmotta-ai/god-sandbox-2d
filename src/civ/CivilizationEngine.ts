import { City, SETTLEMENT_TIERS } from './City';
import { Kingdom, getNextKingdomColor, type ColonialAccess } from './Kingdom';
import { Building, BuildingType, BUILDINGS, BASE_BUILDINGS } from './Building';
import {
  GoodId, GOODS, ALL_GOODS, RAW_GOODS, CRAFTED_GOODS, STRATEGIC_GOODS,
  productionRecipesFor
} from './Goods';
import { TECHNOLOGIES, TechDefinition, techCost, strategicGoodsFor, technologyCapacity, operatingEra } from './TechTree';
import { GOVERNMENTS, chooseGovernment, isRevolution, GovernmentType } from './Government';
import { WorldMarket, mintCurrency } from './Economy';
import { TradeNetwork, transportCostPerUnit } from './Trade';
import { DiplomacyManager, type PeaceSettlement } from './Diplomacy';
import { culturalAffinity, rememberCulture, updateCulture } from './Culture';
import { updateSociety } from './Society';
import { activeLawDefinitions, aggregateLawEffects, chooseLawReform, enactLaw, resetLawDefaults, updateLawMomentum } from './Laws';
import { GreatPersonManager } from './GreatPersons';
import { chronicle } from './Chronicle';
import { Entity } from '../entities/Entity';
import { SpeciesType, SPECIES_DEFINITIONS } from '../entities/Species';
import { TileMap } from '../world/TileMap';
import { TerrainType, TERRAINS } from '../world/Biomes';
import { tileResourceToGood } from '../world/Tile';
import { events } from '../core/EventBus';
import { rng, nextId } from '../core/Random';
import { SimplePathfinder } from '../ai/Pathfinding';
import {
  roadCapacityFactor, portCapacityFactor, portOperational,
  avgEffectiveRoadLevel, repairInfrastructure
} from './Infrastructure';
import { surveyRoad, layRoad, type RoadSurvey, type RoadWorks } from './RoadEngineering';
import { UrbanPlanner } from './UrbanPlanner';
import { perfProfiler } from '../perf/PerformanceProfiler';
import { buildingArchitecturalStamp, refreshArchitecturalProfile } from './ArchitecturalProfile';
import { FortificationPlanner } from './FortificationPlanner';
import { UrbanDistrictPlanner, urbanContextAt } from './UrbanDistricts';
import { UrbanLifecycleManager, type UrbanLifecycleResult } from './UrbanLifecycle';

/**
 * The yearly heartbeat of civilization.
 *
 * Everything slow and structural happens here, once per simulated year:
 * settlements produce and consume, people are born and starve, buildings go up,
 * knowledge accumulates, governments change, money is minted, caravans move and
 * realms make deals with one another.
 *
 * Per-tick behaviour (walking, fighting, gathering) stays in EntityAI.
 */

export interface CivWorld {
  year: number;
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
  entities: Entity[];
  tileMap: TileMap;
  diplomacy: DiplomacyManager;
  market: WorldMarket;
  trade: TradeNetwork;
  /** Creates an entity of the given species at a position. */
  spawn: (species: SpeciesType, x: number, y: number) => Entity;
  /** Simulation engine (for caravan road decay access). */
  sim?: import('../ai/EntityAI').SimulationEngine;
}

/** Food a single citizen eats per year. */
const FOOD_PER_CITIZEN = 1.1;
/**
 * Research a citizen contributes even with no buildings.
 *
 * This is the bootstrap of the whole tech tree, and it has to carry a settlement
 * all the way to `agriculture` before a single knowledge building can exist. At
 * 0.09 a starting band of ten produced ~1 point a year against a 30-point first
 * technology, so no realm ever left the stone age and every downstream system
 * (jobs, crafting, trade, naval) stayed unreachable.
 */
const RESEARCH_PER_CITIZEN = 0.75;
/**
 * Wild food one citizen can gather per year before agriculture.
 *
 * A citizen eats up to 1.375 a year, so gathering 1.5 left a band living hand to
 * mouth: stock never accumulated, and since childbirth requires food in store,
 * settlements sat at four or five people forever. A forager has to bring in a
 * real surplus. The Malthusian ceiling still holds — it is now set by how many
 * wild-food tiles the territory actually has, not by the per-person rate.
 */
const FORAGE_PER_CITIZEN = 2.8;
/** Yearly ceiling on how hard a single wild-food tile can be worked. */
const FORAGE_PER_TILE = 3;
/**
 * Timber one citizen can cut by hand per year, with no lumber camp.
 * Kept well below a camp's output so the camp is always worth building.
 */
const HAND_WOOD_PER_CITIZEN = 0.4;
const HAND_WOOD_PER_TILE = 1.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class CivilizationEngine {
  /**
   * CITY-V1 urban planner. Off only for A/B measurement against the legacy
   * placement rule — see `findBuildingSiteLegacy`.
   */
  public static useUrbanPlanner: boolean = true;

  /** Set once a realm first mints money, so the chronicle only says it once. */
  private announcedCurrencies: Set<string> = new Set();
  /** Maritime routes currently blocked by ruined ports, so a collapse is chronicled once. */
  private collapsedRoutes: Set<string> = new Set();
  /** Colonial routes whose interruption has already been recorded in the Chronicle. */
  private disruptedColonialRoutes: Set<string> = new Set();
  /** Rebuilt once per simulated year; replaces city×world and realm×world scans. */
  private entitiesByCity: Map<string, Entity[]> = new Map();
  private workersByKingdom: Map<string, number> = new Map();

  public reset(): void {
    this.announcedCurrencies.clear();
    this.disruptedColonialRoutes.clear();
    this.entitiesByCity.clear();
    this.workersByKingdom.clear();
  }

  // ============================================================
  // MAIN YEARLY TICK
  // ============================================================

  public tickYear(world: CivWorld): void {
    // Population is derived from the entities that actually exist, so births,
    // deaths and migration can never drift out of sync with the map.
    this.recountPopulations(world);
    // Fire/disaster ticks name the exact affected buildings. Fold that compact
    // event buffer once here instead of scanning every urban lot in the world.
    UrbanLifecycleManager.applyDamageEvents(
      world.cities,
      world.tileMap,
      world.tileMap.drainBuildingDamageEvents(),
      world.year
    );

    // Settlements first: they generate everything the higher layers spend.
    for (const city of world.cities.values()) {
      this.tickSettlement(city, world);
    }

    this.refreshKingdomTotals(world);

    for (const kingdom of world.kingdoms.values()) {
      this.collectTaxes(kingdom, world);
      this.tickResearch(kingdom, world);
      this.tickEconomy(kingdom, world);
      this.tickCulture(kingdom, world);
      this.tickSociety(kingdom, world);
      this.tickLaws(kingdom, world);
      this.tickGovernment(kingdom, world);
    }

    this.tickDiplomaticContact(world);
    this.tickStrategicDiplomacy(world);
    // Rail freight runs before trade settles so imports land in the current ledger year
    world.sim?.railways.tickRailways(world);
    perfProfiler.measure('trade', () => this.tickTrade(world));
    this.tickVassalage(world);
    this.tickColonisation(world);
    this.tickColonialFoundations(world);
    this.tickColonialMigration(world);
    this.tickColonialPolitics(world);
    this.tickRebellions(world);
    this.tickTradeBanditry(world);
    GreatPersonManager.checkAscension(world.entities, world.kingdoms, world.cities, world.tileMap, world.year);

    world.market.settle(world.year);
    // Books close after trade has run, so a year's imports and exports land in
    // the same record as the production and consumption they paid for.
    for (const city of world.cities.values()) city.ledger.rollOver();
    world.tileMap.regrowResources();

    // Road decay: unused roads lose traffic and degrade yearly
    world.sim?.caravans.decayRoadTraffic(world.tileMap);

    // Rebuild per-city resource caches (used by worker AI)
    for (const city of world.cities.values()) {
      city.rebuildResourceCache(world.tileMap, world.year, this.citySurveyRadius(city));
    }

    this.cleanupDeadRealms(world);
  }

  // ============================================================
  // SETTLEMENTS
  // ============================================================

  private tickSettlement(city: City, world: CivWorld): void {
    const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) ?? null : null;
    this.refreshCityArchitecture(city, kingdom, world);
    const techMods = kingdom?.research.modifiers() ?? { production: 1, research: 1, growth: 1, trade: 1, military: 1, territory: 0 };
    const gov = kingdom ? GOVERNMENTS[kingdom.government] : null;
    const lawEffects = kingdom ? aggregateLawEffects(kingdom.laws) : null;

    const culture = kingdom?.culture;
    const productionCulture = culture
      ? 0.94 + culture.innovation * 0.08 + culture.collectivism * 0.05 + culture.stewardship * 0.03 - culture.warTrauma * 0.04
      : 1;
    const researchCulture = culture
      ? 0.9 + culture.innovation * 0.16 + culture.openness * 0.06 - culture.tradition * 0.03
      : 1;
    const expansionCulture = culture
      ? (culture.expansionism - 0.5) * 12 - Math.max(0, culture.stewardship - 0.62) * 5
      : 0;
    const productionSociety = kingdom
      ? 0.88 +
        kingdom.society.factions.workers.satisfaction * 0.08 +
        kingdom.society.factions.peasants.satisfaction * 0.05 +
        kingdom.society.cohesion * 0.06 -
        kingdom.society.factions.workers.radicalization * kingdom.society.factions.workers.influence * 0.18
      : 1;

    const productionMult = techMods.production * (gov?.production ?? 1) * productionCulture * productionSociety * (1 + (lawEffects?.production ?? 0));
    const researchMult = techMods.research * (gov?.research ?? 1) * researchCulture * (1 + (lawEffects?.research ?? 0));

    // The phase timeline is tiny and durable; detailed lots/blocks remain the
    // incremental runtime cache owned by UrbanPlanner.
    const urbanRadius = this.citySurveyRadius(city);
    city.recordUrbanPhase(world.year, urbanRadius);
    UrbanDistrictPlanner.tickCity(city, kingdom, world.tileMap, world.year, urbanRadius);
    // Old saves acquire CITY-V5 context gradually. Existing architecture does
    // not all switch class in one year, and ordinary renovation remains the
    // long-term mechanism that refreshes a building's socioeconomic stamp.
    let districtBackfill = 0;
    for (const building of city.buildings.values()) {
      if (building.urbanContext || building.fortificationRole) continue;
      building.urbanContext = urbanContextAt(city, building.x, building.y, world.year);
      world.tileMap.markRenderDirty(building.x, building.y);
      if (++districtBackfill >= 5) break;
    }
    const lifecycle = UrbanLifecycleManager.tickCity(city, kingdom, world.tileMap, world.year);
    if (lifecycle.vacatedBuildingIds.length > 0) this.releaseInactiveBuildingAssignments(city, lifecycle);
    this.produceGoods(city, world, productionMult);
    this.consumeGoods(city, world);
    this.runConstruction(city, world, kingdom);
    this.repairCityInfrastructure(city, world);
    this.expandTerritory(city, world, techMods.territory + (gov?.expansion ?? 8) + expansionCulture + (lawEffects?.expansion ?? 0));

    const fortification = FortificationPlanner.tickCity(city, kingdom, world);
    if (fortification.built) {
      chronicle.log(
        world.year,
        'founding',
        `${city.name} concluiu uma nova linha de muralhas com ${fortification.built.gateIds.length} portões e ${fortification.built.towerIds.length} torres.`,
        {
          title: `As muralhas de ${city.name}`,
          importance: fortification.built.generation > 0 ? 'major' : 'notable',
          scope: 'city',
          refs: [{ kind: 'city', id: city.id, name: city.name }],
          tags: ['city', 'fortification', 'walls'],
          causes: ['A importância, os recursos e a pressão estratégica do assentamento justificaram uma linha defensiva permanente.'],
          consequences: [fortification.built.generation > 0
            ? 'A muralha anterior permaneceu como vestígio histórico dentro da expansão urbana.'
            : 'Estradas principais passaram a cruzar a defesa por portões controlados.'],
          data: { generation: fortification.built.generation, perimeter: fortification.built.perimeter }
        }
      );
    }

    city.researchOutput = this.computeResearch(city) * researchMult;
    city.updateTier();
    city.recordUrbanPhase(world.year, this.citySurveyRadius(city));
  }

  /** Buildings turn real labour, deposits and recipe inputs into goods. */
  private produceGoods(city: City, world: CivWorld, multiplier: number): void {
    const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) ?? null : null;

    // A city's economic workforce is made from real adult humanoid entities. Combat
    // specialists and rulers remain available to their own systems rather than being
    // silently counted as factory hands.
    const labourPool = (this.entitiesByCity.get(city.id) ?? []).filter(e =>
      e.hp > 0 &&
      SPECIES_DEFINITIONS[e.species].isHumanoid &&
      !e.isChild &&
      !['soldier', 'archer', 'leader', 'king'].includes(e.profession)
    );

    const priority = (building: Building): number => {
      const def = building.definition;
      if (def.category === 'food') return 100;
      if (def.category === 'extraction') return 92;
      if (def.category === 'craft') return 78;
      if (def.category === 'knowledge') return 58;
      if (def.category === 'commerce') return 52;
      if (def.category === 'power') return 42;
      return 48;
    };

    const allBuildings = [...city.buildings.values()];
    for (const building of allBuildings) if (!building.isOperational()) building.staffing = 0;
    const staffed = allBuildings.filter(building => building.isOperational()).sort((a, b) => priority(b) - priority(a));
    let labourRemaining = labourPool.length;
    let workerCursor = 0;

    // Assign labour to buildings instead of applying one blanket staffing ratio to
    // every workplace. Famine hits luxuries before farms; a small town can operate
    // one mine properly instead of operating ten buildings at 25% forever.
    for (const building of staffed) {
      const jobs = building.definition.jobs ?? 0;
      if (jobs <= 0) {
        building.staffing = 1;
        continue;
      }
      const assigned = Math.min(jobs, labourRemaining);
      building.staffing = jobs <= 0 ? 1 : assigned / jobs;
      labourRemaining -= assigned;

      // Bridge the annual economy to the visible entity layer. EntityAI still owns
      // per-tick movement, but idle workers now receive a real workplace/profession
      // and an existing gather state that the renderer already understands.
      const workers = labourPool.slice(workerCursor, workerCursor + assigned);
      workerCursor += assigned;
      for (const worker of workers) this.assignVisibleWorker(worker, building);
    }

    let output = 0;

    for (const building of staffed) {
      const def = building.definition;
      if ((def.jobs ?? 0) > 0 && building.staffing <= 0) continue;

      // Non-recipe upkeep (academies, barracks, palaces...) remains definition-driven.
      if (def.category !== 'craft' && def.consumes) {
        let affordable = true;
        for (const [goodKey, amountValue] of Object.entries(def.consumes)) {
          const good = goodKey as GoodId;
          const amount = (amountValue as number) * Math.max(0.25, building.outputMultiplier());
          world.market.reportDemand(good, amount);
          if (city.stock.get(good) < amount) affordable = false;
        }
        if (!affordable) continue;
        for (const [goodKey, amountValue] of Object.entries(def.consumes)) {
          const used = city.stock.take(goodKey as GoodId, (amountValue as number) * Math.max(0.25, building.outputMultiplier()));
          city.ledger.recordConsumed(goodKey as GoodId, used);
        }
      }

      let scale = building.outputMultiplier() * multiplier;
      if (kingdom) {
        // A realm that prizes making things over trading for them works its
        // extraction sites harder. Culture, not blood, is what varies now.
        const craftFocus = kingdom.culture.innovation * 0.2 + (1 - kingdom.culture.mercantilism) * 0.15;
        if (def.type === 'lumber_camp' || def.type === 'mine' || def.type === 'quarry') {
          scale *= 1 + craftFocus;
        }
      }

      // Real extraction: the building can only extract a good its definition supports,
      // and finite deposits physically deplete from the world tile.
      if (def.resourceTargets?.length) {
        const tile = world.tileMap.getTile(building.x, building.y);
        const naturalGood = tileResourceToGood(tile?.resourceType ?? null);
        const matches = !!naturalGood && def.resourceTargets.includes(naturalGood);

        if (def.resourceMode === 'required') {
          if (!tile || !matches || tile.resourceAmount <= 0) {
            building.staffing = Math.min(building.staffing, 0.15);
            continue;
          }
          building.extractedGood = naturalGood!;
          const wanted = (def.extractionRate ?? 5) * scale;
          const extracted = Math.min(wanted, tile.resourceAmount);
          tile.resourceAmount = Math.max(0, tile.resourceAmount - extracted);
          const stored = city.stock.add(naturalGood!, extracted);
          output += stored * world.market.price(naturalGood!);
          world.market.reportSupply(naturalGood!, stored);
          city.ledger.recordProduced(naturalGood!, stored);
          continue;
        }

        // Farms/pastures always provide their staple output, but regional deposits
        // let them specialise in cotton, spices, horses or furs.
        if (matches && tile && naturalGood && tile.resourceAmount > 0) {
          building.extractedGood = naturalGood;
          const bonusRate = naturalGood === 'food' ? (def.extractionRate ?? 2) * 0.45 : (def.extractionRate ?? 2);
          const harvested = Math.min(bonusRate * scale, tile.resourceAmount);
          tile.resourceAmount = Math.max(0, tile.resourceAmount - harvested);
          const stored = city.stock.add(naturalGood, harvested);
          output += stored * world.market.price(naturalGood);
          world.market.reportSupply(naturalGood, stored);
          city.ledger.recordProduced(naturalGood, stored);
        } else {
          building.extractedGood = null;
        }
      }

      // Craft buildings no longer run a parallel economy from Building.ts. Their
      // actual conversions come from Goods.ts recipes and their building only sets
      // capacity, labour and infrastructure.
      if (def.category === 'craft' && def.craftCapacity) {
        output += this.runCraftProduction(city, world, kingdom, building, def.craftCapacity * scale);
        continue;
      }

      if (!def.produces) continue;
      for (const [goodKey, amountValue] of Object.entries(def.produces)) {
        const good = goodKey as GoodId;
        const stored = city.stock.add(good, (amountValue as number) * scale);
        output += stored * world.market.price(good);
        world.market.reportSupply(good, stored);
        city.ledger.recordProduced(good, stored);
      }
    }

    // Hunter-gathering. This is not a population-scaled food fountain: the band
    // eats what its own territory physically holds, depleting real wild-food tiles
    // that regrow slowly. That gives a pre-agricultural settlement a genuine but
    // hard Malthusian ceiling — enough to survive and eventually discover
    // agriculture, never enough to become a city without farmland.
    const foraged = this.forageWildFood(city, world);
    output += foraged * world.market.price('food');

    // Timber cut by hand. A settlement with no lumber camp still needs wood for
    // its first houses — and for the lumber camp itself, which costs wood. Without
    // this the stone age is a dead end: no wood income means no camp, ever.
    const cutWood = this.gatherWildWood(city, world);
    output += cutWood * world.market.price('wood');

    city.economicOutput = output;
  }

  /** Hand-cut timber from the settlement's territory. Deliberately inefficient. */
  private gatherWildWood(city: City, world: CivWorld): number {
    let effort = city.population * HAND_WOOD_PER_CITIZEN;
    if (effort <= 0) return 0;

    let gathered = 0;
    for (const pos of city.resourcesByGood.get('wood') ?? []) {
      if (effort <= 0) break;
      const tile = world.tileMap.getTile(pos.x, pos.y);
      if (!tile || tile.resourceType !== 'wood' || tile.resourceAmount <= 0) continue;
      const taken = Math.min(effort, tile.resourceAmount, HAND_WOOD_PER_TILE);
      tile.resourceAmount -= taken;
      gathered += taken;
      effort -= taken;
    }

    const stored = city.stock.add('wood', gathered);
    world.market.reportSupply('wood', stored);
    city.ledger.recordProduced('wood', stored);
    return stored;
  }

  /** Draws wild food from the settlement's own territory. Returns units stored. */
  private forageWildFood(city: City, world: CivWorld): number {
    let effort = city.population * FORAGE_PER_CITIZEN;
    if (effort <= 0) return 0;

    let gathered = 0;
    for (const pos of city.resourcesByGood.get('food') ?? []) {
      if (effort <= 0) break;
      const tile = world.tileMap.getTile(pos.x, pos.y);
      if (!tile || tile.resourceType !== 'food' || tile.resourceAmount <= 0) continue;
      const taken = Math.min(effort, tile.resourceAmount, FORAGE_PER_TILE);
      tile.resourceAmount -= taken;
      gathered += taken;
      effort -= taken;
    }

    // The last scraps of gathering that need no standing deposit at all.
    gathered += Math.min(effort, city.population * 0.12);

    // Report what actually reached the granary, not what was picked: a full
    // stockpile must not look like extra supply to the price model.
    const stored = city.stock.add('food', gathered);
    world.market.reportSupply('food', stored);
    city.ledger.recordProduced('food', stored);
    return stored;
  }

  private assignVisibleWorker(worker: Entity, building: Building): void {
    // Do not override urgent states. EntityAI remains the authority on combat,
    // fleeing, healing and active construction.
    const interruptible = ['idle', 'wander', 'socialize', 'explore', 'return_city', 'craft'];
    if (!interruptible.includes(worker.aiState)) return;

    const type = building.type;
    if (type === 'farm' || type === 'pasture') {
      worker.profession = 'farmer';
      worker.aiState = 'gather_food';
    } else if (type === 'lumber_camp') {
      worker.profession = 'woodcutter';
      worker.aiState = 'gather_wood';
    } else if (type === 'mine' || type === 'quarry' || type === 'oil_well') {
      worker.profession = 'miner';
      worker.aiState = 'gather_ore';
    } else if (type === 'workshop' || type === 'smithy' || type === 'factory' || type === 'refinery') {
      worker.profession = 'builder';
      // `craft` is a purely visual workplace state, so it can be set safely here.
      // `build` is deliberately avoided: that one reads as erecting a structure.
      worker.workplaceId = building.id;
      worker.aiState = 'craft';
    }
    worker.targetX = building.x + 0.5;
    worker.targetY = building.y + 0.5;
  }

  private runCraftProduction(
    city: City,
    world: CivWorld,
    kingdom: Kingdom | null,
    building: Building,
    capacity: number
  ): number {
    const outputs = CRAFTED_GOODS.filter(good => GOODS[good].producedBy === building.type);
    if (outputs.length === 0 || capacity <= 0) return 0;

    let remaining = capacity;
    let value = 0;
    let safety = 0;

    while (remaining > 0.05 && safety++ < 8) {
      let best: { good: GoodId; recipe: ReturnType<typeof productionRecipesFor>[number]; score: number; maxCycles: number } | null = null;

      for (const good of outputs) {
        const recipes = productionRecipesFor(good).filter(recipe => !recipe.requiresTech || !!kingdom?.research.knows(recipe.requiresTech));
        for (const recipe of recipes) {
          let maxCycles = remaining;
          let missingValue = 0;
          for (const [inputKey, qtyValue] of Object.entries(recipe.inputs)) {
            const input = inputKey as GoodId;
            const qty = qtyValue as number;
            maxCycles = Math.min(maxCycles, city.stock.get(input) / Math.max(0.001, qty));
            const desired = qty * remaining;
            if (city.stock.get(input) < desired) {
              const missing = desired - city.stock.get(input);
              world.market.reportDemand(input, missing);
              missingValue += missing * world.market.price(input);
            }
          }

          const held = city.stock.get(good);
          const target = good === 'machinery' ? Math.max(12, city.population * 0.12)
            : good === 'fuel' || good === 'gunpowder' ? Math.max(18, city.population * 0.18)
            : Math.max(28, city.population * 0.45);
          const shortage = clamp((target - held) / Math.max(1, target), 0, 1.5);
          const strategic = GOODS[good].strategic ? 1.35 : 1;
          const score = GOODS[good].basePrice * strategic * (0.55 + shortage * 1.8) - missingValue * 0.02;
          if (maxCycles > 0.03 && (!best || score > best.score)) best = { good, recipe, score, maxCycles };
        }
      }

      if (!best) break;
      const cycles = Math.min(remaining, best.maxCycles);
      for (const [inputKey, qtyValue] of Object.entries(best.recipe.inputs)) {
        const used = city.stock.take(inputKey as GoodId, (qtyValue as number) * cycles);
        city.ledger.recordConsumed(inputKey as GoodId, used);
      }
      const produced = best.recipe.output * cycles;
      const stored = city.stock.add(best.good, produced);
      world.market.reportSupply(best.good, stored);
      city.ledger.recordProduced(best.good, stored);
      value += stored * world.market.price(best.good);
      remaining -= cycles;
    }

    return value;
  }

  /** People eat. Buildings and armies cost upkeep. Shortfall causes famine. */
  private consumeGoods(city: City, world: CivWorld): void {
    const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) ?? null : null;
    const needed = city.population * FOOD_PER_CITIZEN;
    world.market.reportDemand('food', needed);

    // Beyond bare survival, people want goods. This is what gives cloth, tools
    // and gems a market at all, and why a rich city bids their prices up.
    this.reportLivingStandards(city, world);

    // Families already bought part of this ration over the course of the year.
    const alreadyFed = Math.min(needed, city.householdFoodDrawn);
    city.householdFoodDrawn = 0;

    const eaten = alreadyFed + city.stock.take('food', needed - alreadyFed);
    city.ledger.recordConsumed('food', Math.max(0, eaten - alreadyFed));
    const satisfaction = needed <= 0 ? 1 : eaten / needed;

    if (satisfaction < 0.85) {
      city.famineYears++;
      // Starvation kills. Gradual mortality rate (15% in year 1, 25% in subsequent years) gives cities time to recover.
      const mortalityRate = city.famineYears <= 1 ? 0.15 : 0.25;
      const starved = Math.ceil(city.population * (1 - satisfaction) * mortalityRate);
      if (starved > 0) {
        this.killCitizens(city, world, starved, 'starvation');
      }
      if (city.famineYears === 3) {
        chronicle.log(
          world.year,
          'famine',
          `Famine grips ${city.name}. The granaries are empty.`,
          {
            title: `The Famine of ${city.name}`,
            importance: 'major',
            scope: 'city',
            refs: [
              { kind: 'city', id: city.id, name: city.name },
              ...(kingdom ? [{ kind: 'kingdom' as const, id: kingdom.id, name: kingdom.name }] : [])
            ],
            tags: ['famine', 'food', 'starvation'],
            causes: ['Food supply remained below survival needs for three consecutive years.'],
            consequences: ['Population loss and declining prosperity followed the shortage.'],
            threadId: `famine:${city.id}:${world.year - 2}`,
            threadTitle: `The Famine of ${city.name}`,
            data: { foodSatisfaction: Number(satisfaction.toFixed(3)), famineYears: city.famineYears, deathsThisYear: starved }
          }
        );
      }
    } else {
      city.famineYears = 0;
    }

    // Prosperity blends food security with housing and goods on hand.
    const housing = city.housingCapacity();
    const housingRatio = city.population <= 0 ? 1 : Math.min(1, housing / city.population);
    const goodsRatio = Math.min(1, city.stock.fullness() * 3);
    const target = satisfaction * 0.5 + housingRatio * 0.3 + goodsRatio * 0.2;
    city.prosperity += (target - city.prosperity) * 0.3;
  }

  /**
   * Consumer demand from the population itself.
   *
   * Households consume cloth and tools as a matter of living standard, and
   * wealthier settlements start wanting luxuries. Goods actually on hand are
   * slowly consumed, which both feeds the market and rewards a settlement for
   * producing more than it strictly needs.
   */
  private reportLivingStandards(city: City, world: CivWorld): void {
    const population = city.population;
    if (population <= 0) return;

    const wants: Partial<Record<GoodId, number>> = {
      cloth: population * 0.12,
      tools: population * 0.08,
      // Building and repairing homes is a constant background draw.
      wood: population * 0.15,
      stone: population * 0.06
    };

    // Prosperous settlements develop a taste for luxury.
    if (city.prosperity > 0.6 && city.population > 20) {
      wants.gems = population * 0.02;
    }

    for (const [goodKey, amount] of Object.entries(wants)) {
      const good = goodKey as GoodId;
      const want = amount as number;
      world.market.reportDemand(good, want);

      // Consume what is available, so surplus is drawn down rather than hoarded.
      const consumed = city.stock.take(good, Math.min(want, city.stock.get(good) * 0.25));
      city.ledger.recordConsumed(good, consumed);
      if (consumed > 0 && (good === 'cloth' || good === 'tools' || good === 'gems')) {
        // Met wants lift the standard of living.
        city.prosperity = Math.min(1, city.prosperity + consumed / Math.max(1, population * 40));
      }
    }
  }

  /** Population is whatever actually lives there — no separate abstract counter. */
  private recountPopulations(world: CivWorld): void {
    const counts = new Map<string, number>();
    this.entitiesByCity.clear();
    this.workersByKingdom.clear();
    for (const entity of world.entities) {
      const humanoid = SPECIES_DEFINITIONS[entity.species].isHumanoid;
      if (entity.cityId) {
        let residents = this.entitiesByCity.get(entity.cityId);
        if (!residents) {
          residents = [];
          this.entitiesByCity.set(entity.cityId, residents);
        }
        residents.push(entity);
        if (humanoid) counts.set(entity.cityId, (counts.get(entity.cityId) ?? 0) + 1);
      }
      if (entity.kingdomId && entity.hp > 0 && humanoid && !entity.isChild) {
        this.workersByKingdom.set(entity.kingdomId, (this.workersByKingdom.get(entity.kingdomId) ?? 0) + 1);
      }
    }

    for (const [id, city] of [...world.cities]) {
      city.population = counts.get(id) ?? 0;

      // A settlement whose last inhabitant is gone becomes ruins.
      if (city.population <= 0 && world.year > city.foundingYear + 2) {
        this.abandonSettlement(city, world);
      }
    }
  }

  private abandonSettlement(city: City, world: CivWorld): void {
    // A settlement emptied while an enemy army holds its walls is occupied, not
    // erased. Otherwise conquest destroys the very prize it was fighting for.
    if (city.besiegerId) {
      const occupier = world.kingdoms.get(city.besiegerId);
      if (occupier) {
        this.occupyEmptiedSettlement(city, occupier, world);
        return;
      }
    }

    for (const key of city.territory) {
      const [x, y] = key.split(',').map(Number);
      const tile = world.tileMap.getTile(x, y);
      if (tile && tile.cityId === city.id) {
        tile.cityId = null;
        tile.kingdomId = null;
        world.tileMap.markRenderDirty(tile.x, tile.y);
        tile.buildingId = null;
      }
    }
    if (city.kingdomId) world.kingdoms.get(city.kingdomId)?.removeCity(city.id);
    world.cities.delete(city.id);
    chronicle.log(
      world.year,
      'disaster',
      `${city.name} was abandoned. Only ruins remain.`,
      {
        title: `The Abandonment of ${city.name}`,
        importance: 'major',
        scope: 'city',
        refs: [
          { kind: 'city', id: city.id, name: city.name },
          ...(city.kingdomId ? [{ kind: 'kingdom' as const, id: city.kingdomId }] : [])
        ],
        tags: ['abandonment', 'ruins', 'population'],
        causes: ['The settlement lost its last surviving inhabitants.'],
        consequences: ['Its territory and buildings passed into ruin.']
      }
    );
    events.emit('settlementAbandoned', { city, year: world.year });
  }

  /**
   * The besieging army marches into an emptied settlement and garrisons it.
   * The town survives under a new flag rather than vanishing from the map.
   */
  private occupyEmptiedSettlement(city: City, occupier: Kingdom, world: CivWorld): void {
    const previousOwner = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
    previousOwner?.removeCity(city.id);

    occupier.addCity(city.id);
    city.formerOwnerId = previousOwner?.id ?? null;
    city.kingdomId = occupier.id;
    city.capturedYear = world.year;
    city.besiegerId = null;
    city.siegeProgress = 0;
    city.siegeYears = 0;
    city.prosperity = 0.25;
    city.species = occupier.species;

    for (const key of city.territory) {
      const [x, y] = key.split(',').map(Number);
      const tile = world.tileMap.getTile(x, y);
      if (tile && tile.cityId === city.id) { tile.kingdomId = occupier.id; world.tileMap.markRenderDirty(tile.x, tile.y); }
    }

    // The nearest besiegers stay behind as the new inhabitants.
    const garrison = world.entities
      .filter(e => e.kingdomId === occupier.id && e.hp > 0 && SPECIES_DEFINITIONS[e.species].isHumanoid)
      .sort((a, b) => Math.hypot(a.x - city.x, a.y - city.y) - Math.hypot(b.x - city.x, b.y - city.y))
      .slice(0, 5);

    for (const soldier of garrison) {
      soldier.cityId = city.id;
      soldier.aiState = 'idle';
      soldier.aiCooldown = 0;
      soldier.targetX = null;
      soldier.targetY = null;
    }
    city.population = garrison.length;
    this.refreshCityArchitecture(city, occupier, world);

    chronicle.log(
      world.year,
      'conquest',
      `${occupier.name} occupied the emptied ${city.name}${previousOwner ? `, taking it from ${previousOwner.name}` : ''}.`,
      {
        title: `Occupation of ${city.name}`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'city', id: city.id, name: city.name },
          { kind: 'kingdom', id: occupier.id, name: occupier.name },
          ...(previousOwner ? [{ kind: 'kingdom' as const, id: previousOwner.id, name: previousOwner.name }] : [])
        ],
        tags: ['occupation', 'conquest', 'siege'],
        causes: ['The settlement was emptied while an enemy army controlled its approaches.'],
        consequences: [`${occupier.name} installed a new garrison and claimed the settlement.`]
      }
    );
    events.emit('cityOccupied', { city, occupier, previousOwner, year: world.year });
  }

  /**
   * Picks and erects one building per year.
   * The choice is driven by what the settlement is short of, filtered by what
   * its kingdom actually knows how to build.
   */
  /**
   * A settlement's whole building programme for the year.
   * Projects that cannot be sited no longer block the whole city for that year.
   */
  private runConstruction(city: City, world: CivWorld, kingdom: Kingdom | null): void {
    const projects = Math.max(1, Math.min(4, Math.floor(city.population / 15) + 1));
    for (let i = 0; i < projects; i++) {
      if (!city.hasFreeBuildingSlot()) {
        if (i === 0) this.tryUpgradeBuilding(city, world.tileMap, world.year);
        break;
      }
      const built = this.constructBuilding(city, world, kingdom);
      if (!built) {
        this.tryUpgradeBuilding(city, world.tileMap, world.year);
        break;
      }
    }
  }

  /** Erects one feasible building, considering its physical site before selecting it. */
  private constructBuilding(city: City, world: CivWorld, kingdom: Kingdom | null): boolean {
    if (!city.hasFreeBuildingSlot()) return false;

    const unlocked = new Set<BuildingType>(BASE_BUILDINGS);
    for (const b of kingdom?.research.unlockedBuildings() ?? []) unlocked.add(b);

    const candidates: Array<{
      type: BuildingType;
      score: number;
      spot: { x: number; y: number; resourceGood: GoodId | null; siteScore: number };
    }> = [];

    for (const type of unlocked) {
      // CITY-V4 commissions a coherent defensive circuit. Individual wall
      // pieces must no longer be selected as random ordinary construction.
      if (type === 'wall') continue;
      const def = BUILDINGS[type];
      if (!def) continue;
      if (def.unique && city.hasBuilding(type)) continue;
      if (type === 'port' && !city.hasBuilding('harbor')) continue;

      // Resource/coastal feasibility is checked before economic desire. A city can
      // no longer choose an impossible oil well and then stop construction entirely.
      const spot = this.findBuildingSite(city, world.tileMap, def);
      if (!spot) continue;

      const score = this.scoreBuilding(type, city, kingdom, world, spot.resourceGood, spot.siteScore);
      if (score <= 0) continue;

      if (!city.stock.hasAll(def.cost)) {
        for (const [goodKey, amountValue] of Object.entries(def.cost)) {
          const good = goodKey as GoodId;
          const missing = (amountValue as number) - city.stock.get(good);
          if (missing > 0) world.market.reportDemand(good, missing);
        }
        continue;
      }
      candidates.push({ type, score, spot });
    }

    if (candidates.length === 0) return false;
    candidates.sort((a, b) => b.score - a.score);

    // Preserve a little history-divergence without ever selecting an impossible site.
    const pick = candidates[rng.chance(0.82) ? 0 : Math.min(1, candidates.length - 1)];
    const def = BUILDINGS[pick.type];
    if (!city.stock.spend(def.cost)) return false;
    // Materials that went into the walls are consumed, not vanished.
    for (const [good, amount] of Object.entries(def.cost)) {
      city.ledger.recordConsumed(good as GoodId, amount as number);
    }

    const building = city.addBuilding(pick.type, pick.spot.x, pick.spot.y);
    building.recordUrbanOrigin(world.year, city.urbanPhase, city.currentUrbanGeneration);
    building.beginConstruction(world.year);
    if (city.architecturalProfile) building.recordArchitecture(buildingArchitecturalStamp(city.architecturalProfile, world.year));
    const tile = world.tileMap.getTile(pick.spot.x, pick.spot.y)!;
    tile.buildingId = building.id;
    tile.cityId = city.id;
    if (city.kingdomId) tile.kingdomId = city.kingdomId;
    city.territory.add(`${pick.spot.x},${pick.spot.y}`);
    world.tileMap.markRenderDirty(tile.x, tile.y);
    UrbanPlanner.recordConstruction(city, world.tileMap, building.id);

    // Auto-pave street connecting new building to city hall (dirt unless the
    // kingdom has road-building tech, matching paveTradeRoad below)
    this.paveRoadBetween(city, pick.spot.x, pick.spot.y, world);
    UrbanDistrictPlanner.recordConstruction(city, kingdom, world.tileMap, building, world.year);

    if (def.resourceTargets?.length && pick.spot.resourceGood && def.resourceTargets.includes(pick.spot.resourceGood)) {
      building.extractedGood = pick.spot.resourceGood;
    }

    if (['mine', 'quarry', 'oil_well', 'harbor', 'port', 'academy', 'bank', 'factory', 'refinery', 'palace', 'stock_exchange', 'collective'].includes(pick.type)) {
      const resourceLabel = building.extractedGood ? ` over a ${GOODS[building.extractedGood].name} deposit` : '';
      chronicle.log(world.year, 'founding', `${city.name} iniciou a construção de ${def.name}${resourceLabel}.`);
    }
    return true;
  }

  /** The grade a settlement's engineers know how to build. */
  private roadGradeFor(city: City, world: CivWorld): number {
    const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
    if (kingdom?.research.knows('engineering')) return 3;
    if (kingdom?.research.knows('roads') || kingdom?.research.knows('masonry')) return 2;
    return 1;
  }

  /**
   * Records what the roadworks actually achieved. A completed span is a public
   * event — a stone arch costs more than a granary — and a road that stops at
   * a riverbank because the treasury would not carry the piers is worth saying
   * out loud, because it explains the map the player is looking at.
   */
  private reportRoadWorks(city: City, works: RoadWorks, world: CivWorld, route: string): void {
    for (const crossing of works.greatCrossings) {
      this.openGreatBridge(city, crossing.tiles, crossing.span, works, world, route);
    }
    if (works.greatCrossings.length > 0) return; // the opening is the story
    if (works.spansBuilt > 0) {
      const stone = Math.round(works.spent.stone);
      const wood = Math.round(works.spent.wood);
      chronicle.log(
        world.year,
        'founding',
        `${city.name} threw ${works.spansBuilt === 1 ? 'a bridge' : `${works.spansBuilt} bridges`} across the water on ${route}, at a cost of ${stone} stone and ${wood} timber.`
      );
    } else if (works.stoppedBy === 'span' && works.haltedAt) {
      chronicle.log(
        world.year,
        'founding',
        `${city.name} surveyed ${route} as far as the water's edge and stopped there: the crossing costs more than the city can quarry.`
      );
    }
  }

  /**
   * Names and opens a great bridge.
   *
   * A crossing of five tiles or more at a hard grade is the largest single
   * thing a settlement will ever build — more stone than a granary, a market
   * and a smithy together — and history does not record works on that scale
   * as line items. It records them as occasions: the bridge takes the name of
   * the city or the ruler that paid for it, the name is carved onto the map,
   * and the realm gets the standing that comes of having done something no
   * neighbour has managed.
   */
  private openGreatBridge(
    city: City,
    tiles: { x: number; y: number; bridgeName: string | null }[],
    span: number,
    works: RoadWorks,
    world: CivWorld,
    route: string
  ): void {
    const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
    const name = rng.pick([
      `the Great Bridge of ${city.name}`,
      `the ${city.name} Span`,
      `${city.founderName}'s Crossing`,
      kingdom ? `the ${kingdom.name} Bridge` : `the Long Bridge of ${city.name}`
    ]);
    for (const tile of tiles) tile.bridgeName = name;

    const mid = tiles[Math.floor(tiles.length / 2)];
    const stone = Math.round(works.spent.stone);
    const wood = Math.round(works.spent.wood);

    // A work like this is worth standing on. The realm's authority is visibly
    // competent, and the city that paid for it is visibly rich.
    city.prosperity = Math.min(1, city.prosperity + 0.07);
    if (kingdom) {
      kingdom.legitimacy = Math.min(1, kingdom.legitimacy + 0.04);
      kingdom.economy.stability = Math.min(1, kingdom.economy.stability + 0.09);
    }

    chronicle.log(
      world.year,
      'wonder',
      `${city.name} opened ${name}, carrying ${route} across ${span} spans of open water. ` +
        `It consumed ${stone} stone and ${wood} timber, and the whole city came out to walk it.`,
      {
        title: name,
        importance: 'legendary',
        scope: kingdom ? 'kingdom' : 'city',
        refs: [
          { kind: 'city', id: city.id, name: city.name },
          ...(kingdom ? [{ kind: 'kingdom' as const, id: kingdom.id, name: kingdom.name }] : [])
        ],
        tags: ['wonder', 'bridge', 'infrastructure'],
        causes: [`${city.name} não conseguia alcançar a margem oposta sem abranger ${span} blocos de água.`],
        consequences: [
          'A travessia carrega toda carroça que antes dava uma longa volta.',
          `${city.name} está visivelmente mais rica por isso, e ${kingdom?.name ?? 'o reino'} visivelmente mais capaz.`
        ],
        data: { span, stone, wood, x: mid.x, y: mid.y }
      }
    );
    events.emit('greatBridgeOpened', {
      name, city, kingdom, span, stone, wood, x: mid.x, y: mid.y, year: world.year
    });
  }

  /**
   * Paves a street from the city hall to a new building along a surveyed route,
   * and pays for it. The survey contours around relief and looks for a narrows
   * to cross; the works then walk the pegs outward from the city, buying each
   * tile out of the stockpile until the materials run out — at which point the
   * paving degrades to a dirt track, or halts entirely at an unaffordable span.
   */
  private paveRoadBetween(fromCity: City, toX: number, toY: number, world: CivWorld): void {
    const plan = UrbanPlanner.planStreetConnection(fromCity, world.tileMap, toX, toY, this.citySurveyRadius(fromCity));
    if (!plan || plan.alreadyConnected) return;
    const level = this.roadGradeFor(fromCity, world);
    const survey = surveyRoad(world.tileMap, plan.fromX, plan.fromY, plan.toX, plan.toY, level, 1200);
    if (survey.path.length === 0) return;
    const works = layRoad(fromCity, world.tileMap, survey, level);
    for (const step of survey.path) {
      const tile = world.tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
      if (tile && tile.roadLevel > 0) {
        const traffic = Math.max(tile.roadTraffic, plan.streetClass === 'primary' ? 90 : 35);
        const changed = tile.roadTraffic !== traffic || tile.cityId !== fromCity.id;
        tile.roadTraffic = traffic;
        tile.cityId = fromCity.id;
        if (changed) world.tileMap.markRenderDirty(tile.x, tile.y);
      }
    }
    UrbanPlanner.recordStreetPath(fromCity, world.tileMap, survey.path, plan.streetClass);
    this.reportRoadWorks(fromCity, works, world, plan.streetClass === 'primary' ? 'the high street to its new quarter' : 'the side street to its new block');
  }

  /**
   * Builds the first road between two trading cities when a trade agreement
   * opens. Both ends contribute: the works start from each city and meet in
   * the middle, so a rich city can carry a road most of the way to a poor one.
   * Returns the surveyed line so the route remembers what it crosses — the
   * capacity of that route is read straight back off these tiles.
   */
  private paveTradeRoad(fromCity: City, toCity: City, world: CivWorld): { x: number; y: number }[] {
    const level = Math.max(this.roadGradeFor(fromCity, world), this.roadGradeFor(toCity, world));
    const survey = surveyRoad(world.tileMap, fromCity.x, fromCity.y, toCity.x, toCity.y, level);
    if (survey.path.length === 0) return [];

    const fromWorks = layRoad(fromCity, world.tileMap, survey, level);
    this.reportRoadWorks(fromCity, fromWorks, world, `the road to ${toCity.name}`);
    // The far end builds back toward the near one, so an unfinished road is a
    // gap in the middle rather than a stub hanging off one city.
    const reverse: RoadSurvey = { ...survey, path: [...survey.path].reverse() };
    const toWorks = layRoad(toCity, world.tileMap, reverse, level);
    this.reportRoadWorks(toCity, toWorks, world, `the road to ${fromCity.name}`);

    for (const step of survey.path) {
      const tile = world.tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
      if (tile && tile.roadLevel > 0) tile.roadTraffic = Math.max(tile.roadTraffic, 60);
    }
    return survey.path;
  }

  /** Repairs buildings and roads damaged in war, spending real materials. */
  private repairCityInfrastructure(city: City, world: CivWorld): void {
    repairInfrastructure(city, world.tileMap);
  }

  /** Rare state transition cleanup, bounded to the affected city's indexed citizens. */
  private releaseInactiveBuildingAssignments(city: City, lifecycle: UrbanLifecycleResult): void {
    const inactive = new Set(lifecycle.vacatedBuildingIds);
    for (const entity of this.entitiesByCity.get(city.id) ?? []) {
      if (entity.homeBuildingId && inactive.has(entity.homeBuildingId)) {
        entity.homeBuildingId = null;
        entity.homeX = city.x;
        entity.homeY = city.y;
      }
      if (entity.workplaceId && inactive.has(entity.workplaceId)) {
        entity.workplaceId = null;
        if (entity.profession !== 'king' && entity.profession !== 'leader') entity.profession = 'none';
      }
    }
  }

  /** How badly this settlement needs a given feasible building right now. */
  private scoreBuilding(
    type: BuildingType,
    city: City,
    kingdom: Kingdom | null,
    world: CivWorld,
    resourceGood: GoodId | null,
    siteScore: number
  ): number {
    const def = BUILDINGS[type];
    const population = Math.max(1, city.population);
    const housingRatio = city.housingCapacity() / population;
    const foodPerHead = city.stock.get('food') / population;
    let score = siteScore * 0.15;

    if (def.produces?.food && foodPerHead < 3) score += 90 - foodPerHead * 12;

    if (def.housing) {
      if (housingRatio < 1.6) score += 70 * (1.6 - housingRatio);
      const nextTier = SETTLEMENT_TIERS.find(t => t.minPopulation > city.population);
      if (nextTier && city.housingCapacity() < nextTier.minPopulation) score += 55;
    }

    if (resourceGood && def.resourceTargets?.includes(resourceGood)) {
      const held = city.stock.get(resourceGood);
      const price = world.market.price(resourceGood);
      score += 38 + Math.min(80, price * 1.2) + (held < 30 ? 35 : held < 80 ? 16 : 0);
      if (GOODS[resourceGood].strategic) score += 70;
      if (resourceGood === 'oil' && kingdom?.research.knows('industrialization')) score += 95;
    }

    if (def.produces) {
      for (const [goodKey, amountValue] of Object.entries(def.produces)) {
        const good = goodKey as GoodId;
        const held = city.stock.get(good);
        score += (amountValue as number) * (held < 40 ? 2.2 : 0.7) * (GOODS[good].basePrice / 9);
      }
    }

    if (def.category === 'craft' && def.craftCapacity) {
      const possible = CRAFTED_GOODS.filter(g => GOODS[g].producedBy === type && productionRecipesFor(g).some(r => !r.requiresTech || !!kingdom?.research.knows(r.requiresTech)));
      if (possible.length === 0) return 0;
      let craftPull = 0;
      for (const good of possible) {
        const held = city.stock.get(good);
        const target = Math.max(16, population * (GOODS[good].strategic ? 0.15 : 0.35));
        craftPull += GOODS[good].basePrice * clamp((target - held) / target, 0.05, 1.2);
      }
      score += Math.min(120, craftPull * 0.65);

      // Do not spam expensive heavy industry if no upstream material has ever arrived.
      if (type === 'refinery' && city.stock.get('oil') < 4) score *= 0.28;
      if (type === 'factory' && city.stock.get('steel') < 5) score *= 0.4;
    }

    // Harbor/Port are unique milestones — each can only ever be built once per
    // city — so they should reliably win the yearly build slot once feasible
    // instead of losing to another repeatable quarry/mine for decades. Their
    // old base scores (20-95) were routinely beaten by extraction's 90-150+.
    if (type === 'harbor') {
      score += population >= 18 ? 150 : 110;
      if (kingdom?.culture.mercantilism && kingdom.culture.mercantilism > 0.58) score += 28;
    }
    if (type === 'port') {
      if (!city.hasBuilding('harbor')) return 0;
      score += population >= 45 ? 160 : 90;
      if (kingdom?.research.knows('engineering')) score += 35;
    }

    if (def.research) score += def.research * 4;

    // Military buildings get priority when there is something to fight for:
    // an active war, a looming external threat, or a martial culture. Without
    // this, no realm ever raised an army and warfare never engaged.
    if (def.defense) {
      let atWar = false;
      if (kingdom) {
        for (const other of world.kingdoms.values()) {
          if (other.id === kingdom.id) continue;
          if (world.diplomacy.isAtWar(other.id, kingdom.id)) { atWar = true; break; }
        }
      }
      const threat = kingdom?.externalThreat ?? 0;
      const militarism = kingdom?.culture.militarism ?? 0.3;
      score += (def.defense - 1) * (atWar ? 180 : 20 + threat * 160 + militarism * 60);
    }
    // A standing army scales with the population that needs defending: roughly
    // one soldier per twenty citizens, more under war or militarism.
    if (type === 'barracks') {
      const soldierJobs = city.countOfType('barracks') * 4;
      const target = Math.max(2, city.population * 0.05);
      if (target > soldierJobs) score += (target - soldierJobs) * 35;
    }

    if (def.storage) score += city.stock.fullness() > 0.6 ? 35 : 8;

    const existing = city.countOfType(type);
    const repeatPenalty = def.housing || def.produces?.food || def.category === 'extraction' ? 0.16 : 0.7;
    score /= 1 + existing * repeatPenalty;

    const costTotal = Object.values(def.cost).reduce((sum, v) => sum + (v as number), 0);
    if (costTotal > 100 && city.population < 25) score *= 0.3;
    return score;
  }

  private tryUpgradeBuilding(city: City, tileMap: TileMap, year: number): void {
    const upgradable = [...city.buildings.values()].filter(b => b.lifecycleState === 'normal' && b.level < 3 && city.stock.hasAll(b.upgradeCost()));
    if (upgradable.length === 0) return;
    const target = upgradable.sort((a, b) =>
      (b.definition.jobs ?? 0) - (a.definition.jobs ?? 0) ||
      a.builtYear - b.builtYear ||
      a.id.localeCompare(b.id)
    )[0];
    const cost = target.upgradeCost();
    if (city.stock.spend(cost)) {
      for (const [good, amount] of Object.entries(cost)) {
        city.ledger.recordConsumed(good as GoodId, amount as number);
      }
      target.upgrade();
      target.recordRenovation(year, city.urbanPhase);
      if (city.architecturalProfile) target.recordArchitecture(buildingArchitecturalStamp(city.architecturalProfile, year));
      target.urbanContext = urbanContextAt(city, target.x, target.y, year);
      tileMap.markRenderDirty(target.x, target.y);
    }
  }

  private citySurveyRadius(city: City): number {
    const tierBonus = ({ camp: 0, hamlet: 1, village: 2, town: 4, city: 6, metropolis: 8 } as Record<string, number>)[city.tier] ?? 0;
    return Math.min(22, 7 + tierBonus + Math.floor(Math.sqrt(Math.max(0, city.population)) / 2));
  }

  private urbanSiteScore(city: City, tileMap: TileMap, x: number, y: number): number {
    const gridStyle = SPECIES_DEFINITIONS[city.species]?.urbanGridStyle ?? 'concentric_rings';
    const tile = tileMap.getTile(x, y)!;
    const dx = x - city.x;
    const dy = y - city.y;
    const dist = Math.hypot(dx, dy);
    let score = 10 - dist * 0.35;
    if (gridStyle === 'concentric_rings') {
      if (Math.abs(dist - Math.round(dist)) < 0.25) score += 12;
      if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) score += 8;
    } else if (gridStyle === 'orthogonal_citadel') {
      if (dx % 2 === 0 && dy % 2 === 0) score += 18;
      else if (dx % 3 === 0 || dy % 3 === 0) score += 8;
    } else if (gridStyle === 'diagonal_chevron') {
      if (Math.abs(dx) === Math.abs(dy)) score += 20;
      else if ((dx + dy) % 2 === 0) score += 9;
    } else if (gridStyle === 'organic_canopy') {
      if (tile.type === TerrainType.FOREST) score += 12;
      if (tileMap.getNeighbors(x, y, false).some(n => n.type === TerrainType.FOREST)) score += 8;
    }
    if (city.territory.has(`${x},${y}`)) score += 8;
    return score;
  }

  /**
   * Where a building goes.
   *
   * The urban planner owns this decision now (CITY-V1): it weighs street
   * frontage, the quarter a building belongs to, spacing and open ground,
   * rather than taking the first unbuilt tile that scored well on geometry
   * alone. The signature is unchanged so every existing caller — and the
   * legacy path below, kept for A/B measurement — still works.
   */
  private findBuildingSite(
    city: City,
    tileMap: TileMap,
    def: typeof BUILDINGS[BuildingType]
  ): { x: number; y: number; resourceGood: GoodId | null; siteScore: number } | null {
    if (!CivilizationEngine.useUrbanPlanner) {
      return this.findBuildingSiteLegacy(city, tileMap, def);
    }
    const radius = this.citySurveyRadius(city);
    const sites = UrbanPlanner.findBuildingSites(city, def, tileMap, radius, 4);
    if (sites.length === 0) return null;

    // Road-first growth: the planner has already scored street frontage into
    // its choice and rejected sites needing more new road than a settlement
    // this size would undertake, so whatever comes back is either on the
    // network or worth extending to. `constructBuilding` runs the street out
    // via `paveRoadBetween` immediately after placing.
    const best = sites[0];
    return { x: best.x, y: best.y, resourceGood: best.resourceGood, siteScore: best.totalScore };
  }

  /**
   * The pre-CITY-V1 placement rule, kept so the urban planner can be measured
   * against it on identical seeds. Not reachable in normal play.
   */
  private findBuildingSiteLegacy(
    city: City,
    tileMap: TileMap,
    def: typeof BUILDINGS[BuildingType]
  ): { x: number; y: number; resourceGood: GoodId | null; siteScore: number } | null {
    const radius = this.citySurveyRadius(city);
    const candidates: Array<{ x: number; y: number; resourceGood: GoodId | null; siteScore: number }> = [];

    // Required extraction uses a real survey of every matching deposit, not 50 dice rolls.
    if (def.resourceMode === 'required' && def.resourceTargets?.length) {
      for (const tile of tileMap.findResourceSites(city.x, city.y, radius, def.resourceTargets, false)) {
        if (tile.cityId && tile.cityId !== city.id) continue;
        if (tile.kingdomId && city.kingdomId && tile.kingdomId !== city.kingdomId) continue;
        if (TERRAINS[tile.type].isWater || tile.type === TerrainType.LAVA) continue;
        const good = tileResourceToGood(tile.resourceType);
        if (!good) continue;
        let siteScore = this.urbanSiteScore(city, tileMap, tile.x, tile.y);
        siteScore += Math.min(45, tile.resourceAmount / 8);
        if (GOODS[good].strategic) siteScore += 30;
        candidates.push({ x: tile.x, y: tile.y, resourceGood: good, siteScore });
      }
      candidates.sort((a, b) => b.siteScore - a.siteScore);
      return candidates[0] ?? null;
    }

    const minX = Math.max(0, Math.floor(city.x - radius));
    const maxX = Math.min(tileMap.width - 1, Math.ceil(city.x + radius));
    const minY = Math.max(0, Math.floor(city.y - radius));
    const maxY = Math.min(tileMap.height - 1, Math.ceil(city.y + radius));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const dist = Math.hypot(x - city.x, y - city.y);
        if (dist > radius) continue;
        const tile = tileMap.getTile(x, y);
        if (!tile || tile.buildingId) continue;
        if (TERRAINS[tile.type].isWater || tile.type === TerrainType.LAVA) continue;
        if (tile.cityId && tile.cityId !== city.id) continue;
        if (tile.kingdomId && city.kingdomId && tile.kingdomId !== city.kingdomId) continue;

        const resourceGood = tileResourceToGood(tile.resourceType);
        const matchesPreferred = !!resourceGood && !!def.resourceTargets?.includes(resourceGood);

        // Preserve economically important geology instead of paving an apartment
        // over the only oil or uranium basin in the region.
        if (resourceGood && !matchesPreferred && GOODS[resourceGood].kind === 'raw') {
          if (GOODS[resourceGood].strategic || ['copper', 'iron', 'coal', 'gold', 'gems'].includes(resourceGood)) continue;
        }

        if (tile.type === TerrainType.MOUNTAIN && !matchesPreferred) continue;
        if (def.requiresCoast && !tileMap.isCoastalLand(x, y)) continue;

        let siteScore = this.urbanSiteScore(city, tileMap, x, y);
        if (matchesPreferred) siteScore += 35 + Math.min(20, tile.resourceAmount / 10);
        if (def.requiresCoast) siteScore += 25;
        candidates.push({ x, y, resourceGood: matchesPreferred ? resourceGood : null, siteScore });
      }
    }

    candidates.sort((a, b) => b.siteScore - a.siteScore);
    return candidates[0] ?? null;
  }

  private expandTerritory(city: City, world: CivWorld, bonus: number): void {
    const limit = city.territoryLimit(bonus);
    if (city.territory.size >= limit) return;

    // Claiming one tile a year meant a realm took a human lifetime to widen its
    // border by a single step. Settlement of the land has to be something you can
    // actually watch happen.
    const claimsPerYear = 6 + Math.floor(city.population / 4);

    for (let i = 0; i < claimsPerYear && city.territory.size < limit; i++) {
      const frontier = new Map<string, { x: number; y: number; score: number }>();
      for (const key of city.territory) {
        const [x, y] = key.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const tile = world.tileMap.getTile(x + dx, y + dy);
          if (!tile) continue;
          const tKey = `${tile.x},${tile.y}`;
          if (city.territory.has(tKey)) continue;
          if (TERRAINS[tile.type].isWater) continue;
          if (tile.kingdomId && tile.kingdomId !== city.kingdomId) continue;

          // Compactness first. A realm that chases every distant ore vein grows a
          // tangle of tendrils; weighting nearness and already-owned neighbours
          // makes borders fill their own concavities and read as clean regions.
          let owned = 0;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
            if (city.territory.has(`${tile.x + ox},${tile.y + oy}`)) owned++;
          }

          const good = tileResourceToGood(tile.resourceType);
          let score = 30 - Math.hypot(tile.x - city.x, tile.y - city.y) * 1.15;
          score += owned * 5.5;
          if (good) {
            score += Math.min(8, tile.resourceAmount / 22);
            score += GOODS[good].tier === 'strategic' ? 16 : GOODS[good].tier === 'regional' ? 8 : 3;
          }
          if (world.tileMap.isCoastalLand(tile.x, tile.y)) score += 2.5;
          if (tile.type === TerrainType.MOUNTAIN && !good) score -= 10;
          frontier.set(tKey, { x: tile.x, y: tile.y, score });
        }
      }

      if (frontier.size === 0) break;
      const choices = [...frontier.values()].sort((a, b) => b.score - a.score);
      // Mostly deterministic: too much randomness here is what makes a border
      // look ragged rather than lived-in.
      const chosen = choices[rng.chance(0.92) ? 0 : Math.min(choices.length - 1, 1)];
      const tile = world.tileMap.getTile(chosen.x, chosen.y)!;
      city.territory.add(`${tile.x},${tile.y}`);
      if (city.kingdomId) { tile.kingdomId = city.kingdomId; world.tileMap.markRenderDirty(tile.x, tile.y); }
    }
  }

  private computeResearch(city: City): number {
    let research = city.population * RESEARCH_PER_CITIZEN;
    for (const b of city.buildings.values()) {
      research += (b.definition.research ?? 0) * b.outputMultiplier();
    }
    // Hungry, unhappy settlements think about other things.
    return research * (0.4 + city.prosperity * 0.6);
  }

  private killCitizens(city: City, world: CivWorld, count: number, cause: string): void {
    const citizens = [...(this.entitiesByCity.get(city.id) ?? [])];
    // The very young and very old die first.
    citizens.sort((a, b) => {
      const maxAge = SPECIES_DEFINITIONS[a.species].maxAge;
      const vulnerabilityA = a.isChild ? 2 : a.age / maxAge;
      const vulnerabilityB = b.isChild ? 2 : b.age / maxAge;
      return vulnerabilityB - vulnerabilityA;
    });

    for (let i = 0; i < Math.min(count, citizens.length); i++) {
      citizens[i].hp = 0; // The entity layer handles the actual removal
    }
    city.population = Math.max(0, city.population - count);
  }

  // ============================================================
  // KINGDOM TOTALS & TAXATION
  // ============================================================

  private refreshKingdomTotals(world: CivWorld): void {
    for (const kingdom of world.kingdoms.values()) {
      let population = 0;
      let territory = 0;
      for (const cityId of kingdom.cityIds) {
        const city = world.cities.get(cityId);
        if (!city) continue;
        population += city.population;
        territory += city.territory.size;
      }
      kingdom.totalPopulation = population;
      kingdom.territorySize = territory;
      kingdom.militaryPower = kingdom.computePower();
      kingdom.cultureLevel = 1 + Math.floor(kingdom.research.known.size / 4);
      kingdom.computeCenter(world.cities as any);
    }
  }

  /** The crown takes its share of what its settlements produced. */
  private collectTaxes(kingdom: Kingdom, world: CivWorld): void {
    const gov = GOVERNMENTS[kingdom.government];
    const lawEffects = aggregateLawEffects(kingdom.laws);
    const effectiveTaxRate = clamp(gov.taxRate * (1 + (lawEffects.taxMultiplier ?? 0)), 0.01, 0.62);
    let taxValue = 0;

    // Bug #2: Reset yearly trade counters so they reflect the current year only.
    const yearlyTradeGold = kingdom.exportVolume + kingdom.tariffRevenue;
    kingdom.exportVolume = 0;
    kingdom.importVolume = 0;
    kingdom.tariffRevenue = 0;

    for (const cityId of kingdom.cityIds) {
      const city = world.cities.get(cityId);
      if (!city) continue;

      // Tax is taken in kind: a slice of whatever the settlement holds.
      for (const good of ALL_GOODS) {
        const held = city.stock.get(good);
        if (held <= 0) continue;
        const levy = held * effectiveTaxRate * 0.35;
        const taken = city.stock.take(good, levy);
        // Tax in kind leaves the settlement for the crown's stores.
        city.ledger.recordExported(good, taken);
        const stored = kingdom.treasury.add(good, taken);
        taxValue += stored * world.market.price(good);
      }

      const taxPain = Math.max(0, effectiveTaxRate - 0.22);
      if (taxPain > 0) {
        city.prosperity = clamp(city.prosperity - taxPain * 0.035, 0, 1);
      }
    }

    // Convert the value of the levy into coin in the treasury.
    const income = kingdom.economy.hasCurrency
      ? kingdom.economy.fromWorldValue(taxValue)
      : taxValue;
    kingdom.economy.treasury += income;

    // Upkeep: armies, courts and buildings all cost.
    const upkeep = kingdom.cityIds.size * 8 + kingdom.totalPopulation * 0.4 + (kingdom.isEmpire ? 40 : 0);
    const upkeepCost = kingdom.economy.hasCurrency ? kingdom.economy.fromWorldValue(upkeep) : upkeep;
    kingdom.economy.treasury -= upkeepCost;

    // Process War Reparations payments
    if (kingdom.warReparations) {
      if (world.year <= kingdom.warReparations.endYear) {
        const creditor = world.kingdoms.get(kingdom.warReparations.creditorId);
        if (creditor) {
          const payment = Math.min(Math.max(0, kingdom.economy.treasury * 0.25), kingdom.warReparations.annualAmount);
          if (payment > 0) {
            kingdom.economy.treasury -= payment;
            creditor.economy.treasury += payment;
          }
        }
      } else {
        kingdom.warReparations = null;
      }
    }

    // A bankrupt realm prints money, which its citizens will notice next year.
    if (kingdom.economy.treasury < 0) {
      if (kingdom.economy.hasCurrency) {
        kingdom.economy.printMoney(-kingdom.economy.treasury + 50);
      } else {
        kingdom.economy.treasury = 0;
      }
    }

    // wealth is derived from economy.treasury — single source of truth.
    // CaravanSystem and NavalSystem update economy.treasury directly (Bug #1 fix),
    // so this sync always reflects the full picture including trade revenue.
    kingdom.wealth = Math.round(kingdom.economy.treasury);

    const gdp = taxValue / Math.max(0.01, gov.taxRate * 0.35);
    kingdom.economy.gdp = gdp;
    kingdom.economy.gdpPerCapita = gdp / Math.max(1, kingdom.totalPopulation);
    // Bug #3: Record actual trade income (gold from caravans/ships this year).
    const tradeIncome = kingdom.economy.hasCurrency
      ? kingdom.economy.fromWorldValue(yearlyTradeGold)
      : yearlyTradeGold;
    kingdom.economy.recordYear({
      year: world.year,
      taxIncome: income,
      tradeIncome,
      upkeep: upkeepCost,
      net: income + tradeIncome - upkeepCost,
      gdp,
      treasury: kingdom.economy.treasury
    });
  }

  // ============================================================
  // RESEARCH
  // ============================================================

  private tickResearch(kingdom: Kingdom, world: CivWorld): void {
    let output = 0;
    for (const cityId of kingdom.cityIds) {
      output += world.cities.get(cityId)?.researchOutput ?? 0;
    }
    kingdom.research.output = output;
    if (output <= 0) return;

    // Pick something to work on if idle.
    if (!kingdom.research.current) {
      const choice = this.chooseTech(kingdom, world);
      if (!choice) return;
      kingdom.research.current = choice.id;
      kingdom.research.progress = 0;
    }

    const tech = TECHNOLOGIES[kingdom.research.current];
    if (!tech) {
      kingdom.research.current = null;
      return;
    }

    kingdom.research.progress += output;
    if (kingdom.research.progress < techCost(tech, kingdom.cityIds.size)) return;

    // Discovery.
    kingdom.research.complete(tech.id);
    events.emit('techDiscovered', { kingdom, tech, year: world.year });
    chronicle.log(
      world.year,
      tech.track === 'politics' ? 'kingdom' : 'tech',
      `${kingdom.name} ${tech.discovery}.`,
      {
        title: `Discovery: ${tech.name}`,
        importance: 'major',
        scope: 'kingdom',
        refs: [
          { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
          { kind: 'tech', id: tech.id, name: tech.name }
        ],
        tags: ['technology', tech.track, kingdom.research.currentEra()],
        consequences: [`${tech.name} entered the known body of knowledge of ${kingdom.name}.`],
        data: { researchOutput: Number(output.toFixed(2)), track: tech.track }
      }
    );

    // Currency is the moment a realm gets its own money.
    if (tech.unlocks.features?.includes('currency') && !kingdom.economy.hasCurrency) {
      kingdom.economy.currency = mintCurrency(kingdom.species, kingdom.name, world.year);
      if (!this.announcedCurrencies.has(kingdom.id)) {
        this.announcedCurrencies.add(kingdom.id);
        chronicle.log(
          world.year,
          'economy',
          `${kingdom.name} minted the ${kingdom.economy.currency.name} (${kingdom.economy.currency.symbol}).`,
          {
            title: `The ${kingdom.economy.currency.name} is Minted`,
            importance: 'major',
            scope: 'kingdom',
            refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
            tags: ['currency', 'money', 'economy'],
            consequences: [`${kingdom.name} gained a sovereign currency for taxation and trade.`]
          }
        );
        events.emit('currencyMinted', { kingdom, currency: kingdom.economy.currency });
      }
    }
  }

  /**
   * Which technology a realm pursues next.
   * Cheap techs are preferred, but pressure — war, hunger, poverty — reweights
   * everything toward whatever would relieve it.
   */
  private chooseTech(kingdom: Kingdom, world: CivWorld): TechDefinition | null {
    const available = kingdom.research.availableTechs();
    if (available.length === 0) return null;

    const atWar = world.diplomacy.getWarsFor(kingdom.id).length > 0;
    const poor = kingdom.economy.gdpPerCapita < 8;
    const hungry = [...kingdom.cityIds].some(id => (world.cities.get(id)?.famineYears ?? 0) > 0);
    const warlike = kingdom.culture.militarism > 0.6;

    // A realm that has burned through its founding stone deposit needs mining to
    // unlock the quarry — without it, half the build tree is permanently barred
    // and settlements fill up on wood-only houses. Treat stone scarcity like
    // hunger or war: an economic emergency worth reweighting techs toward.
    let stoneHeld = 0;
    for (const id of kingdom.cityIds) {
      const c = world.cities.get(id);
      if (!c) continue;
      stoneHeld += c.stock.get('stone');
    }
    // A founding settlement holds 30 stone and a quarry is the only real source
    // of more. A realm living on its founding deposits (under ~40 a city) is
    // running on fumes and should dig before it polishes pottery.
    const stoneStarved = kingdom.cityIds.size > 0 && stoneHeld < kingdom.cityIds.size * 40;

    // Coastal kingdom knows the sea is at its doorstep — sailing becomes strategic
    // rather than an obscure distant option.
    const hasCoastalCity = [...kingdom.cityIds].some(id => {
      const c = world.cities.get(id);
      if (!c) return false;
      for (const b of c.buildings.values()) {
        if (b.type === 'port' || b.type === 'harbor') return true;
      }
      return c.buildingsOfCategory('commerce').some(b => {
        const nb = world.tileMap.getNeighbors(b.x, b.y, true);
        return nb.some(n => TERRAINS[n.type].isWater);
      });
    });

    // How much of what this realm already knows is sitting idle for want of
    // buildings or materials. Measured last year by assessTechnologicalCapacity.
    const idleTechnology = 1 - kingdom.technologicalCapacity();

    let best: TechDefinition | null = null;
    let bestScore = -Infinity;

    for (const tech of available) {
      // Cheaper is better, all else being equal.
      let score = 1000 / Math.max(1, techCost(tech, kingdom.cityIds.size));

      const mods = tech.unlocks.modifiers;
      if (mods) {
        if (atWar && mods.military) score += (mods.military - 1) * (warlike ? 22 : 14);
        if (hungry && mods.growth) score += (mods.growth - 1) * 25;
        if (poor && mods.trade) score += (mods.trade - 1) * 16;
        if (mods.research) score += (mods.research - 1) * 12;
        if (mods.production) score += (mods.production - 1) * 10;
      }

      // Political advancement is attractive but never urgent.
      if (tech.track === 'politics') score += 3;

      // Culture nudges the tree: what a realm values, it researches first.
      if (warlike && tech.track === 'craft' && tech.unlocks.modifiers?.military) score += 6;
      if (kingdom.culture.diplomaticTrust > 0.6 && tech.unlocks.features?.includes('diplomacy_pacts')) score += 8;
      if (kingdom.culture.innovation > 0.6 && tech.id === 'mining') score += 10;
      if (kingdom.culture.collectivism > 0.6 && tech.unlocks.modifiers?.growth) score += 5;

      // Stone is the gate to masonry, quarry, workshops and walls. A realm that
      // has none should dig for it instead of polishing pottery.
      if (stoneStarved) {
        if (tech.id === 'mining') score += 28;
        if (tech.id === 'masonry') score += 14;
      }

      // Coastal realms chase the sea.
      if (hasCoastalCity && tech.unlocks.features?.includes('maritime_trade')) score += 12;
      if (hasCoastalCity && tech.id === 'sailing') score += 10;

      // A realm already sitting on technology it cannot operate should consolidate
      // rather than read further ahead. Chasing the next era while your factories
      // stand idle for want of coal is how a paper empire happens.
      if (idleTechnology > 0.35 && tech.track === 'craft') {
        score -= idleTechnology * 18;
      }

      // The capitalism/communism fork is decided by material conditions.
      if (tech.id === 'capitalism') {
        score += kingdom.economy.gdpPerCapita > 18 ? 25 : -15;
        score += kingdom.economy.stability > 0.55 ? 12 : -20;
      }
      if (tech.id === 'communism') {
        score += kingdom.economy.stability < 0.5 ? 30 : -18;
        score += kingdom.economy.inequality > 0.55 ? 22 : -10;
        score += kingdom.economy.gdpPerCapita < 12 ? 14 : -8;
      }

      if (score > bestScore) {
        bestScore = score;
        best = tech;
      }
    }

    return best;
  }

  // ============================================================
  // ECONOMY
  // ============================================================

  /**
   * A realm wants what its technology gives it a use for.
   *
   * This is what turns oil from a black puddle into a casus belli: the demand is
   * not a flag on the good, it is the sum of what this realm has learned to
   * build with — scaled by how large its industry actually is, because knowing
   * about engines does not consume oil, *running* them does.
   */
  private reportTechnologicalDemand(kingdom: Kingdom, world: CivWorld): void {
    const industrialBase = Math.max(
      1,
      kingdom.totalPopulation * 0.05 + kingdom.economy.industrialisation * kingdom.totalPopulation * 0.15
    );

    for (const { good, weight } of strategicGoodsFor(kingdom.research)) {
      const wanted = weight * industrialBase * 0.1;
      if (wanted <= 0) continue;
      world.market.reportDemand(good, wanted);
      kingdom.strategicDemand.set(good, wanted);
    }
  }

  /**
   * What this realm can actually do with what it knows, recomputed yearly.
   * A tech is only "operational" once the buildings exist and the materials can
   * be had, so a realm can hold a modern tree and still run an iron-age economy.
   */
  private assessTechnologicalCapacity(kingdom: Kingdom, world: CivWorld): void {
    const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);

    const hasBuilding = (type: BuildingType): boolean => cities.some(c => c.hasBuilding(type));
    // A material counts as obtainable if the realm holds it, produced it, or
    // imported it — bought counts exactly as much as dug up.
    const canObtain = (good: GoodId): boolean => {
      if (kingdom.treasury.get(good) > 0) return true;
      for (const c of cities) {
        if (c.stock.get(good) > 0) return true;
        const flow = c.ledger.flow(good);
        if (flow.produced > 0 || flow.imported > 0) return true;
      }
      return false;
    };

    kingdom.techCapabilities = technologyCapacity(kingdom.research, hasBuilding, canObtain);
    kingdom.operatingEra = operatingEra(kingdom.research, kingdom.techCapabilities);
  }

  /**
   * Re-prices every good inside one realm against what that realm actually holds.
   *
   * This is what makes iron cost 8 in a realm sitting on ore and 21 in one with
   * none — and therefore what gives a trade route a reason to exist at all.
   */
  private repriceLocalMarket(kingdom: Kingdom, world: CivWorld): void {
    const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
    if (cities.length === 0) return;

    for (const good of ALL_GOODS) {
      let available = kingdom.treasury.get(good);
      let wanted = 0;

      for (const city of cities) {
        const flow = city.ledger.flow(good);
        available += city.stock.get(good) + flow.produced + flow.imported;
        wanted += flow.consumed + flow.exported;
      }

      kingdom.economy.market.settle(good, world.market.price(good), available, wanted);
    }
  }

  private tickEconomy(kingdom: Kingdom, world: CivWorld): void {
    const economy = kingdom.economy;
    const gov = GOVERNMENTS[kingdom.government];
    const lawEffects = aggregateLawEffects(kingdom.laws);

    // How industrial the realm is, from what its buildings actually are.
    let industrialBuildings = 0;
    let totalBuildings = 0;
    for (const cityId of kingdom.cityIds) {
      const city = world.cities.get(cityId);
      if (!city) continue;
      for (const b of city.buildings.values()) {
        totalBuildings++;
        if (b.definition.category === 'craft' || b.type === 'factory') industrialBuildings++;
      }
    }
    economy.industrialisation = totalBuildings > 0 ? industrialBuildings / totalBuildings : 0;

    this.reportTechnologicalDemand(kingdom, world);
    this.assessTechnologicalCapacity(kingdom, world);
    this.repriceLocalMarket(kingdom, world);

    const capital = world.cities.get(kingdom.capitalCityId) ?? null;
    let prosperity = 0;
    let cityCount = 0;
    let totalFood = 0;
    let distanceFromCapital = 0;

    for (const cityId of kingdom.cityIds) {
      const city = world.cities.get(cityId);
      if (!city) continue;
      prosperity += city.prosperity;
      totalFood += city.stock.get('food');
      if (capital) distanceFromCapital += Math.hypot(city.x - capital.x, city.y - capital.y);
      cityCount++;
    }
    prosperity = cityCount > 0 ? prosperity / cityCount : 0.5;

    const foodPerHead = totalFood / Math.max(1, kingdom.totalPopulation);
    const foodSecurityTarget = clamp(foodPerHead / (FOOD_PER_CITIZEN * 4) + (lawEffects.foodSecurity ?? 0), 0, 1);
    kingdom.foodSecurity += (foodSecurityTarget - kingdom.foodSecurity) * 0.3;

    const avgDistance = cityCount > 0 ? distanceFromCapital / cityCount : 0;
    const adminCapacity =
      42 +
      kingdom.research.known.size * 2.6 +
      (gov.stability - 0.55) * 36 +
      kingdom.culture.authority * 10 +
      kingdom.culture.tradition * 6 +
      (lawEffects.administrativeReach ?? 0) * 80;
    const cityBurden = Math.max(0, cityCount - 3) * 0.035;
    const adminTarget = clamp(1 - avgDistance / Math.max(20, adminCapacity) - cityBurden, 0.18, 1);
    kingdom.administrativeReach += (adminTarget - kingdom.administrativeReach) * 0.25;

    const tradeRouteValue = world.trade.routesFor(kingdom.id)
      .filter(route => route.active)
      .reduce((sum, route) => sum + route.volume * world.market.price(route.good), 0);
    const tradeDependencyTarget = clamp(tradeRouteValue / Math.max(1, economy.gdp) * 1.15, 0, 1);
    kingdom.tradeDependency += (tradeDependencyTarget - kingdom.tradeDependency) * 0.2;

    let threatTarget = 0;
    for (const otherId of kingdom.knownKingdoms) {
      const other = world.kingdoms.get(otherId);
      if (!other) continue;
      const distance = this.closestRealmDistance(kingdom, other, world);
      const proximity = clamp(1 - distance / 90, 0, 1);
      const relation = world.diplomacy.getRelation(kingdom.id, other.id);
      const powerRatio = other.computePower() / Math.max(1, kingdom.computePower());
      const hostile = world.diplomacy.isAtWar(kingdom.id, other.id) ? 1 : relation < -35 ? 0.55 : 0;
      threatTarget = Math.max(threatTarget, clamp((powerRatio - 0.75) * 0.42 * proximity + hostile * proximity, 0, 1));
    }
    kingdom.externalThreat += (threatTarget - kingdom.externalThreat) * 0.25;

    const inequalityTarget =
      gov.economy === 'planned' ? 0.12 :
      gov.economy === 'market' ? 0.45 + economy.industrialisation * 0.35 :
      0.3 + economy.industrialisation * 0.2;
    economy.inequality += (clamp(inequalityTarget + (lawEffects.inequality ?? 0), 0.04, 0.9) - economy.inequality) * 0.15;

    const atWar = world.diplomacy.getWarsFor(kingdom.id).length > 0;
    const inflationPain = Math.max(0, economy.currency?.inflation ?? 0) * 1.5;
    const effectiveTaxRate = clamp(gov.taxRate * (1 + (lawEffects.taxMultiplier ?? 0)), 0.01, 0.62);
    const taxPain = Math.max(0, effectiveTaxRate - 0.2) * 0.8;
    const adminPain = (1 - kingdom.administrativeReach) * 0.2;
    const foodPain = (1 - kingdom.foodSecurity) * 0.32;
    const warPain = kingdom.warWeariness * 0.003 + (atWar ? 0.08 : 0);
    const culturalCohesion =
      kingdom.culture.collectivism * 0.06 +
      kingdom.culture.tradition * 0.04 +
      kingdom.culture.diplomaticTrust * 0.03 +
      (atWar ? kingdom.culture.militarism * 0.05 - kingdom.culture.warTrauma * 0.08 : -kingdom.culture.warTrauma * 0.025);
    const socialCohesion =
      (kingdom.society.cohesion - 0.5) * 0.22 -
      kingdom.society.revoltRisk * 0.18 -
      kingdom.society.coupRisk * 0.12 -
      kingdom.society.reformPressure * 0.06;
    const stabilityTarget = Math.max(
      0,
      Math.min(
        1,
        gov.stability * 0.34 +
          prosperity * 0.28 +
          kingdom.legitimacy * 0.22 +
          kingdom.foodSecurity * 0.18 +
          kingdom.administrativeReach * 0.12 +
          culturalCohesion +
          socialCohesion +
          (lawEffects.stability ?? 0) -
          economy.inequality * 0.24 -
          inflationPain -
          taxPain -
          adminPain -
          foodPain -
          warPain
      )
    );
    economy.stability += (stabilityTarget - economy.stability) * 0.25;

    const bankruptcyPain = economy.treasury <= 0 ? 0.12 : 0;
    const cultureLegitimacy =
      (gov.succession === 'bloodline' ? kingdom.culture.tradition * 0.09 : 0) +
      (gov.succession === 'election' ? kingdom.culture.openness * 0.05 + kingdom.culture.innovation * 0.04 : 0) +
      (gov.economy === 'planned' ? kingdom.culture.collectivism * 0.06 : 0) +
      kingdom.culture.diplomaticTrust * 0.03;
    const socialLegitimacy =
      kingdom.society.factions.nobles.loyalty * kingdom.society.factions.nobles.influence * 0.08 +
      kingdom.society.factions.bureaucrats.loyalty * kingdom.society.factions.bureaucrats.influence * 0.07 +
      kingdom.society.factions.clergy_scholars.loyalty * kingdom.society.factions.clergy_scholars.influence * 0.07 -
      kingdom.society.reformPressure * 0.13 -
      kingdom.society.revoltRisk * 0.1;
    const legitimacyTarget = clamp(
      gov.stability * 0.28 +
        economy.stability * 0.28 +
        prosperity * 0.2 +
        kingdom.foodSecurity * 0.16 +
        kingdom.administrativeReach * 0.14 +
        cultureLegitimacy +
        socialLegitimacy +
        (lawEffects.legitimacy ?? 0) -
        economy.inequality * 0.14 -
        bankruptcyPain -
        kingdom.warWeariness * 0.002,
      0,
      1
    );
    kingdom.legitimacy += (legitimacyTarget - kingdom.legitimacy) * 0.18;

    // Revalue the currency against gold reserves and real output.
    economy.revalue(kingdom.treasury.get('gold'), economy.gdp);

    // Under a market economy, banks and exchanges turn treasury into more treasury.
    // Returns are capped against real output: a state cannot compound its way to
    // infinite wealth on an economy that only produces so much.
    if (kingdom.research.knowsFeature('banking')) {
      const rate = gov.economy === 'market' ? 0.035 : 0.015;
      const interest = Math.min(economy.treasury * rate, Math.max(0, economy.gdp * 0.5));
      economy.treasury += interest;
    }

    // A treasury far beyond what the realm could ever spend is not hoarded: the
    // state pours it into its cities as public works, which shows up as prosperity.
    const sustainable = Math.max(500, economy.gdp * 12 + kingdom.totalPopulation * 60);
    if (economy.treasury > sustainable) {
      const surplus = economy.treasury - sustainable;
      economy.treasury -= surplus * 0.35;

      const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
      for (const city of cities) {
        city.prosperity = Math.min(1, city.prosperity + 0.02);
      }
    }
  }

  // ============================================================
  // CULTURE
  // ============================================================

  private tickCulture(kingdom: Kingdom, world: CivWorld): void {
    const gov = GOVERNMENTS[kingdom.government];
    const wars = world.diplomacy.getWarsFor(kingdom.id);
    let prosperity = 0;
    let famineYears = 0;
    let cityCount = 0;

    for (const cityId of kingdom.cityIds) {
      const city = world.cities.get(cityId);
      if (!city) continue;
      prosperity += city.prosperity;
      famineYears += city.famineYears;
      cityCount++;
    }

    prosperity = cityCount > 0 ? prosperity / cityCount : 0.5;
    const recentGovernmentChange = world.year === kingdom.governmentSince;

    kingdom.culture = updateCulture(kingdom.culture, {
      year: world.year,
      government: kingdom.government,
      economy: gov.economy,
      atWar: wars.length > 0,
      wars: wars.length,
      stability: kingdom.economy.stability,
      legitimacy: kingdom.legitimacy,
      prosperity,
      foodSecurity: kingdom.foodSecurity,
      tradeDependency: kingdom.tradeDependency,
      externalThreat: kingdom.externalThreat,
      administrativeReach: kingdom.administrativeReach,
      cityCount,
      famineYears,
      recentGovernmentChange
    });
  }

  // ============================================================
  // SOCIETY
  // ============================================================

  private tickSociety(kingdom: Kingdom, world: CivWorld): void {
    const gov = GOVERNMENTS[kingdom.government];
    const wars = world.diplomacy.getWarsFor(kingdom.id);
    let prosperity = 0;
    let famineYears = 0;
    let cityCount = 0;

    for (const cityId of kingdom.cityIds) {
      const city = world.cities.get(cityId);
      if (!city) continue;
      prosperity += city.prosperity;
      famineYears += city.famineYears;
      cityCount++;
    }

    prosperity = cityCount > 0 ? prosperity / cityCount : 0.5;
    kingdom.society = updateSociety(kingdom.society, {
      year: world.year,
      government: kingdom.government,
      economy: gov.economy,
      taxRate: gov.taxRate,
      atWar: wars.length > 0,
      wars: wars.length,
      stability: kingdom.economy.stability,
      legitimacy: kingdom.legitimacy,
      prosperity,
      foodSecurity: kingdom.foodSecurity,
      tradeDependency: kingdom.tradeDependency,
      externalThreat: kingdom.externalThreat,
      administrativeReach: kingdom.administrativeReach,
      inequality: kingdom.economy.inequality,
      industrialisation: kingdom.economy.industrialisation,
      gdpPerCapita: kingdom.economy.gdpPerCapita,
      cityCount,
      famineYears,
      warWeariness: kingdom.warWeariness,
      culture: kingdom.culture,
      laws: aggregateLawEffects(kingdom.laws),
      ...this.economicPressures(kingdom, world)
    });

    if (wars.length > 0 && kingdom.society.peacePressure > 0.58) {
      kingdom.warWeariness = clamp(kingdom.warWeariness + kingdom.society.peacePressure * 2.5, 0, 100);
    }

    this.tickSocietyFlashpoints(kingdom, world);
  }

  /**
   * The economy, expressed as things people feel.
   *
   * This is the bridge from the ledgers to politics: what bread costs, how many
   * people have no work, how many doors have been shut in the merchants' faces.
   * Every figure is measured, never assumed.
   */
  private economicPressures(kingdom: Kingdom, world: CivWorld): {
    foodPriceIndex: number;
    unemployment: number;
    labourShortage: number;
    embargoes: number;
  } {
    const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);

    const foodPrice = kingdom.economy.market.price('food', world.market.price('food'));
    const foodPriceIndex = foodPrice / Math.max(0.01, GOODS.food.basePrice);

    let jobs = 0;
    let filled = 0;
    for (const city of cities) {
      jobs += city.jobCount();
      filled += city.filledJobs();
    }

    // Working-age citizens of this realm, counted from the people who exist.
    const workers = this.workersByKingdom.get(kingdom.id) ?? 0;

    const unemployment = workers > 0 ? clamp((workers - filled) / workers, 0, 1) : 0;
    const labourShortage = jobs > 0 ? clamp((jobs - filled) / jobs, 0, 1) : 0;
    const embargoes = world.trade.embargoes.filter(e => e.againstKingdom === kingdom.id).length;

    return { foodPriceIndex, unemployment, labourShortage, embargoes };
  }

  private tickSocietyFlashpoints(kingdom: Kingdom, world: CivWorld): void {
    if (world.year - kingdom.society.lastUnrestYear < 5) return;

    const peasants = kingdom.society.factions.peasants;
    const nobles = kingdom.society.factions.nobles;
    const merchants = kingdom.society.factions.merchants;
    const military = kingdom.society.factions.military;
    const workers = kingdom.society.factions.workers;
    const reformists = kingdom.society.factions.reformists;
    const frontier = kingdom.society.factions.frontier;
    const gov = GOVERNMENTS[kingdom.government];

    if (peasants.satisfaction < 0.25 && peasants.radicalization > 0.48 && kingdom.foodSecurity < 0.42 && rng.chance(0.18)) {
      kingdom.economy.stability = clamp(kingdom.economy.stability - 0.12, 0, 1);
      kingdom.legitimacy = clamp(kingdom.legitimacy - 0.06, 0, 1);
      kingdom.society.lastUnrestYear = world.year;
      chronicle.log(
        world.year,
        'society',
        `Tumultos por pão abalaram ${kingdom.name} quando camponeses famintos arrombaram celeiros locais.`,
        {
          title: `Tumultos por Pão em ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'peasants'],
          causes: ['Fome, baixa satisfação dos camponeses e alta radicalização convergiram.'],
          consequences: ['A estabilidade e a legitimidade caíram à medida que os camponeses arrombavam celeiros.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Inquietação em ${kingdom.name}`
        }
      );
      events.emit('societyUnrest', { kingdom, faction: 'peasants', year: world.year });
      return;
    }

    if (nobles.satisfaction < 0.3 && nobles.influence > 0.22 && nobles.radicalization > 0.45 && rng.chance(0.1)) {
      kingdom.legitimacy = clamp(kingdom.legitimacy - 0.12, 0, 1);
      kingdom.society.lastUnrestYear = world.year;
      chronicle.log(
        world.year,
        'society',
        `Powerful nobles in ${kingdom.name} gathered in secret to challenge the ruler's legitimacy.`,
        {
          title: `Conspiração da Nobreza em ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'nobles'],
          causes: ['Nobres influentes tornaram-se insatisfeitos e radicalizados.'],
          consequences: ["The ruler's legitimacy was weakened by elite opposition."],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Inquietação em ${kingdom.name}`
        }
      );
      events.emit('societyUnrest', { kingdom, faction: 'nobles', year: world.year });
      return;
    }

    if (merchants.satisfaction < 0.3 && merchants.influence > 0.18 && (gov.taxRate > 0.24 || kingdom.tradeDependency > 0.25) && rng.chance(0.12)) {
      kingdom.economy.treasury *= 0.92;
      kingdom.economy.stability = clamp(kingdom.economy.stability - 0.05, 0, 1);
      kingdom.society.lastUnrestYear = world.year;
      chronicle.log(
        world.year,
        'society',
        `Casas mercantis em ${kingdom.name} moveram capital para fora do alcance do tesouro.`,
        {
          title: `Fuga de Capital em ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'merchants'],
          causes: ['A insatisfação dos mercadores coincidiu com pressão fiscal ou comercial.'],
          consequences: ['As reservas do tesouro e a estabilidade diminuíram.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Inquietação em ${kingdom.name}`
        }
      );
      events.emit('societyUnrest', { kingdom, faction: 'merchants', year: world.year });
      return;
    }

    if (military.satisfaction < 0.28 && military.influence > 0.24 && kingdom.society.coupRisk > 0.28 && rng.chance(0.08)) {
      kingdom.economy.stability = clamp(kingdom.economy.stability - 0.1, 0, 1);
      kingdom.legitimacy = clamp(kingdom.legitimacy - 0.08, 0, 1);
      kingdom.society.lastUnrestYear = world.year;
      chronicle.log(
        world.year,
        'society',
        `Oficiais em ${kingdom.name} emitiram um aviso público à corte sobre o estado do exército.`,
        {
          title: `Aviso Militar em ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'military'],
          causes: ['A insatisfação militar e o risco de golpe atingiram um nível perigoso.'],
          consequences: ['A corte perdeu estabilidade e legitimidade.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Inquietação em ${kingdom.name}`
        }
      );
      events.emit('societyUnrest', { kingdom, faction: 'military', year: world.year });
      return;
    }

    if (workers.satisfaction < 0.28 && workers.influence > 0.16 && kingdom.economy.industrialisation > 0.28 && rng.chance(0.12)) {
      kingdom.economy.stability = clamp(kingdom.economy.stability - 0.08, 0, 1);
      kingdom.economy.treasury *= 0.96;
      kingdom.society.lastUnrestYear = world.year;
      chronicle.log(
        world.year,
        'society',
        `Guildas e oficinas em ${kingdom.name} desaceleraram a produção em protesto.`,
        {
          title: `Protesto Industrial em ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'workers'],
          causes: ['A insatisfação dos trabalhadores aumentou dentro de uma economia em industrialização.'],
          consequences: ['A produção desacelerou e o tesouro perdeu receita.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Inquietação em ${kingdom.name}`
        }
      );
      events.emit('societyUnrest', { kingdom, faction: 'workers', year: world.year });
      return;
    }

    if (reformists.influence > 0.18 && kingdom.society.reformPressure > 0.42 && rng.chance(0.1)) {
      kingdom.legitimacy = clamp(kingdom.legitimacy - 0.05, 0, 1);
      kingdom.society.lastUnrestYear = world.year;
      chronicle.log(
        world.year,
        'society',
        `Círculos reformistas em ${kingdom.name} circularam manifestos clamando por uma nova ordem política.`,
        {
          title: `Manifestos Reformistas em ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'reformists'],
          causes: ['A pressão por reformas e a influência reformista tornaram-se politicamente visíveis.'],
          consequences: ['Apelos por uma nova ordem política enfraqueceram a legitimidade.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Inquietação em ${kingdom.name}`
        }
      );
      events.emit('societyUnrest', { kingdom, faction: 'reformists', year: world.year });
      return;
    }

    if (frontier.satisfaction < 0.3 && frontier.influence > 0.18 && kingdom.administrativeReach < 0.45 && rng.chance(0.1)) {
      kingdom.economy.stability = clamp(kingdom.economy.stability - 0.06, 0, 1);
      kingdom.society.lastUnrestYear = world.year;
      chronicle.log(
        world.year,
        'society',
        `Cidades de fronteira em ${kingdom.name} exigiram autonomia da capital.`,
        {
          title: `Crise de Autonomia na Fronteira em ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'frontier'],
          causes: ['A fraqueza administrativa encontrou insatisfação na fronteira.'],
          consequences: ['Exigências de autonomia aumentaram a instabilidade no reino.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Inquietação em ${kingdom.name}`
        }
      );
      events.emit('societyUnrest', { kingdom, faction: 'frontier', year: world.year });
    }
  }

  // ============================================================
  // LAWS & REFORMS
  // ============================================================

  private tickLaws(kingdom: Kingdom, world: CivWorld): void {
    const gov = GOVERNMENTS[kingdom.government];
    const wars = world.diplomacy.getWarsFor(kingdom.id);
    const context = {
      year: world.year,
      government: kingdom.government,
      economy: gov.economy,
      atWar: wars.length > 0,
      stability: kingdom.economy.stability,
      legitimacy: kingdom.legitimacy,
      foodSecurity: kingdom.foodSecurity,
      tradeDependency: kingdom.tradeDependency,
      externalThreat: kingdom.externalThreat,
      administrativeReach: kingdom.administrativeReach,
      inequality: kingdom.economy.inequality,
      industrialisation: kingdom.economy.industrialisation,
      cityCount: kingdom.cityIds.size,
      warWeariness: kingdom.warWeariness,
      society: kingdom.society,
      culture: kingdom.culture
    };

    updateLawMomentum(kingdom.laws, context);
    const decision = chooseLawReform(kingdom.laws, context);
    if (!decision) return;

    const chance =
      decision.pressure * 0.38 +
      kingdom.society.reformPressure * 0.22 +
      Math.max(0, 0.42 - kingdom.economy.stability) * 0.18;
    if (!rng.chance(chance)) return;

    enactLaw(kingdom.laws, decision.law.id, world.year, decision.pressure);
    kingdom.economy.stability = clamp(kingdom.economy.stability - 0.02 + decision.pressure * 0.035, 0, 1);
    kingdom.legitimacy = clamp(kingdom.legitimacy + (decision.law.effects.legitimacy ?? 0) * 0.35, 0, 1);

    const tense = decision.law.angers
      .filter(id => kingdom.society.factions[id].influence > 0.12)
      .map(id => kingdom.society.factions[id])
      .sort((a, b) => b.influence - a.influence)[0];
    if (tense) {
      tense.satisfaction = clamp(tense.satisfaction - 0.04, 0, 1);
      tense.radicalization = clamp(tense.radicalization + 0.03, 0, 1);
    }

    chronicle.log(
      world.year,
      'law',
      `${kingdom.name} reformou a lei de ${decision.law.category.replace('_', ' ')}: ${decision.current.name} deu lugar a ${decision.law.name}.`,
      {
        title: `Reforma de ${decision.law.name}`,
        importance: decision.pressure >= 0.7 ? 'major' : 'notable',
        scope: 'kingdom',
        refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
        tags: ['law', decision.law.category, 'reform'],
        causes: [`A pressão por reforma política atingiu ${Math.round(decision.pressure * 100)}%.`],
        consequences: [
          `${decision.current.name} foi substituída por ${decision.law.name}.`,
          ...(tense ? ['Pelo menos uma facção social influente reagiu com maior insatisfação e radicalização.'] : [])
        ],
        data: { pressure: Number(decision.pressure.toFixed(3)), category: decision.law.category }
      }
    );
    events.emit('lawReformed', { kingdom, law: decision.law, previous: decision.current, year: world.year });
  }

  // ============================================================
  // GOVERNMENT
  // ============================================================

  private tickGovernment(kingdom: Kingdom, world: CivWorld): void {
    // Realms don't reorganise themselves every year.
    if (world.year - kingdom.governmentSince < 12) return;

    const available = kingdom.research.unlockedGovernments();
    if (available.length === 0) return;

    const ruler = kingdom.rulerId ? world.entities.find(e => e.id === kingdom.rulerId) : null;
    const needed = kingdom.cityIds.size * 40 + kingdom.totalPopulation * 2;

    const next = chooseGovernment({
      currentGovernment: kingdom.government,
      available,
      atWar: world.diplomacy.getWarsFor(kingdom.id).length > 0,
      stability: kingdom.economy.stability,
      cityCount: kingdom.cityIds.size,
      wealthRatio: kingdom.economy.treasury / Math.max(1, needed),
      industrialisation: kingdom.economy.industrialisation,
      rulerPersonality: ruler?.personality ?? 'peaceful',
      culturalMilitarism: kingdom.culture.militarism,
      culturalExpansionism: kingdom.culture.expansionism,
      culturalAuthority: kingdom.culture.authority,
      culturalOpenness: kingdom.culture.openness,
      culturalMercantilism: kingdom.culture.mercantilism,
      culturalInnovation: kingdom.culture.innovation,
      culturalCollectivism: kingdom.culture.collectivism,
      culturalTradition: kingdom.culture.tradition,
      socialReformPressure: kingdom.society.reformPressure,
      socialMilitaryPressure: kingdom.society.factions.military.influence * kingdom.society.factions.military.warSupport,
      socialElitePressure: kingdom.society.factions.nobles.influence * kingdom.society.factions.nobles.loyalty,
      socialMerchantPressure: kingdom.society.factions.merchants.influence * kingdom.society.factions.merchants.loyalty,
      socialWorkerPressure: kingdom.society.factions.workers.influence * kingdom.society.factions.workers.reformSupport
    });

    if (next === kingdom.government) return;

    const revolution = isRevolution(kingdom.government, next);
    const previousGovernment = GOVERNMENTS[kingdom.government].name;
    const previousName = kingdom.adoptGovernment(next, world.year);
    const newGov = GOVERNMENTS[next];
    resetLawDefaults(kingdom.laws, next);

    if (revolution) {
      // A revolution costs the realm dearly and usually costs the ruler more.
      kingdom.economy.stability = 0.35;
      kingdom.economy.treasury *= 0.6;
      kingdom.legitimacy = clamp(kingdom.legitimacy - 0.1, 0, 1);
      rememberCulture(kingdom.culture, 'revolution', world.year, 0.85, 'Uma revolução mudou a ordem social.');
      chronicle.log(
        world.year,
        'revolution',
        `Revolução em ${previousName}! O governo ${previousGovernment.toLowerCase()} foi deposto e um ${newGov.name.toLowerCase()} foi proclamado como ${kingdom.name}.`,
        {
          title: `A Revolução do ano ${world.year}`,
          importance: 'legendary',
          scope: 'kingdom',
          refs: [
            { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
            ...(ruler ? [{ kind: 'person' as const, id: ruler.id, name: ruler.title || ruler.name }] : [])
          ],
          tags: ['revolution', 'government', previousGovernment, newGov.name],
          causes: ['A pressão política e social acumulada tornou a antiga ordem política insustentável.'],
          consequences: [
            `O governo ${previousGovernment} terminou e o governo ${newGov.name} começou.`,
            'A estabilidade do estado e as reservas do tesouro foram drasticamente reduzidas.'
          ],
          threadId: `revolution:${kingdom.id}:${world.year}`,
          threadTitle: `A Revolução de ${kingdom.name}`,
          data: { from: previousGovernment, to: newGov.name }
        }
      );
      if (ruler && rng.chance(0.6)) {
        ruler.hp = 0;
        chronicle.log(
          world.year,
          'succession',
          `${ruler.name} não sobreviveu à revolução.`,
          {
            title: `Morte de ${ruler.title || ruler.name}`,
            importance: 'major',
            scope: 'person',
            refs: [
              { kind: 'person', id: ruler.id, name: ruler.title || ruler.name },
              { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
            ],
            tags: ['ruler', 'death', 'revolution'],
            causes: ['O governante foi morto durante a revolução.'],
            threadId: `revolution:${kingdom.id}:${world.year}`,
            threadTitle: `A Revolução de ${kingdom.name}`
          }
        );
      }
    } else {
      kingdom.economy.stability = Math.min(1, kingdom.economy.stability + 0.1);
      kingdom.legitimacy = clamp(kingdom.legitimacy + 0.04, 0, 1);
      chronicle.log(
        world.year,
        'kingdom',
        `${previousName} reorganizou-se como um ${newGov.name.toLowerCase()}, tornando-se ${kingdom.name}.`,
        {
          title: `Reorganização do Governo`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['government', 'reorganisation', newGov.name],
          causes: ['Instituições políticas se adaptaram às atuais pressões militares, sociais e econômicas do reino.'],
          consequences: [`${newGov.name} tornou-se a ordem de governo de ${kingdom.name}.`],
          data: { from: previousGovernment, to: newGov.name }
        }
      );
    }

    // The ruler's title changes with the state.
    if (ruler) ruler.profession = 'king';
    events.emit('governmentChanged', { kingdom, from: previousGovernment, to: newGov.name, revolution, year: world.year });
  }

  // ============================================================
  // DIPLOMATIC CONTACT
  // ============================================================

  /** Realms whose territory is close enough to meet learn of one another. */
  private tickDiplomaticContact(world: CivWorld): void {
    const kingdoms = [...world.kingdoms.values()];

    for (let i = 0; i < kingdoms.length; i++) {
      for (let j = i + 1; j < kingdoms.length; j++) {
        const a = kingdoms[i];
        const b = kingdoms[j];
        if (a.knownKingdoms.has(b.id)) continue;

        if (!this.realmsAreNeighbours(a, b, world)) continue;

        a.knownKingdoms.add(b.id);
        b.knownKingdoms.add(a.id);
        // First contact starts neutral-positive; suspicion comes later.
        world.diplomacy.changeRelation(a.id, b.id, 4);
        chronicle.log(
          world.year,
          'diplomacy',
          `${a.name} e ${b.name} fizeram primeiro contato.`,
          {
            title: `Primeiro Contato: ${a.name} & ${b.name}`,
            importance: 'major',
            scope: 'international',
            refs: [
              { kind: 'kingdom', id: a.id, name: a.name },
              { kind: 'kingdom', id: b.id, name: b.name }
            ],
            tags: ['primeiro contato', 'diplomacy'],
            consequences: ['Ambos os reinos entraram no mundo diplomático um do outro.']
          }
        );
        events.emit('firstContact', { a, b, year: world.year });
      }
    }
  }

  private realmsAreNeighbours(a: Kingdom, b: Kingdom, world: CivWorld): boolean {
    // How far a realm's scouts, traders and envoys reach. Knowledge shrinks the
    // world: a stone-age clan barely knows the next valley, while an industrial
    // power has mapped the continent.
    const knowledge = (a.research.known.size + b.research.known.size) * 1.2;
    const range = 120 + knowledge +
      (a.research.knowsFeature('maritime_trade') || b.research.knowsFeature('maritime_trade') ? 45 : 0) +
      (a.research.knows('roads') || b.research.knows('roads') ? 25 : 0);

    // Territory counts, not just city centres — sprawling realms meet at their borders.
    for (const cityIdA of a.cityIds) {
      const cityA = world.cities.get(cityIdA);
      if (!cityA) continue;
      const reachA = Math.sqrt(cityA.territory.size);
      for (const cityIdB of b.cityIds) {
        const cityB = world.cities.get(cityIdB);
        if (!cityB) continue;
        const reachB = Math.sqrt(cityB.territory.size);
        const gap = Math.hypot(cityA.x - cityB.x, cityA.y - cityB.y) - reachA - reachB;
        if (gap <= range) return true;
      }
    }
    return false;
  }

  /** Annual realpolitik layer: interests, trade, threats and exhaustion shape diplomacy. */
  private tickStrategicDiplomacy(world: CivWorld): void {
    const kingdoms = [...world.kingdoms.values()];

    for (let i = 0; i < kingdoms.length; i++) {
      for (let j = i + 1; j < kingdoms.length; j++) {
        const a = kingdoms[i];
        const b = kingdoms[j];
        if (a.metropoleId === b.id || b.metropoleId === a.id) continue;
        if (!a.knownKingdoms.has(b.id) || !b.knownKingdoms.has(a.id)) continue;

        if (world.diplomacy.isAtWar(a.id, b.id)) {
          this.negotiatePeace(a, b, world);
          continue;
        }

        const truce = world.diplomacy.getTruce(a.id, b.id, world.year);
        const relation = world.diplomacy.getRelation(a.id, b.id);
        const distance = this.closestRealmDistance(a, b, world);
        const proximity = clamp(1 - distance / 75, 0, 1);
        const govA = GOVERNMENTS[a.government];
        const govB = GOVERNMENTS[b.government];
        const sameSpecies = a.species === b.species;
        const sameEconomy = govA.economy === govB.economy;
        const ideologicalConflict =
          (govA.economy === 'planned' && govB.economy === 'market') ||
          (govA.economy === 'market' && govB.economy === 'planned');
        const tradeAgreement = world.trade.hasAgreement(a.id, b.id);
        const commonEnemy = this.haveCommonEnemy(a.id, b.id, world);
        const affinity = culturalAffinity(a.culture, b.culture);
        const avgOpenness = (a.culture.openness + b.culture.openness) / 2;
        const avgTrust = (a.culture.diplomaticTrust + b.culture.diplomaticTrust) / 2;
        const avgMercantilism = (a.culture.mercantilism + b.culture.mercantilism) / 2;
        const avgSocialWar = (a.society.warPressure + b.society.warPressure) / 2;
        const avgSocialPeace = (a.society.peacePressure + b.society.peacePressure) / 2;
        const borderAmbition =
          a.culture.militarism * 0.35 +
          b.culture.militarism * 0.35 +
          a.culture.expansionism * 0.3 +
          b.culture.expansionism * 0.3;

        let drift = 0;
        const alreadyAllied = world.diplomacy.getStatus(a.id, b.id) === 'alliance';
        drift += sameSpecies ? 0.45 : -0.45 + avgOpenness * 0.2;
        drift += sameEconomy ? 0.18 : 0;
        drift += ideologicalConflict ? -0.9 : 0;
        drift += (affinity - 0.5) * 1.0;
        drift += avgTrust > 0.58 ? 0.15 : -Math.max(0, 0.45 - avgTrust) * 0.5;
        drift += tradeAgreement ? 0.4 + avgMercantilism * 0.2 : 0;
        drift += commonEnemy ? 0.65 : 0;
        drift += Math.max(0, avgSocialPeace - 0.52) * 0.42;
        drift -= proximity * (govA.aggression + govB.aggression) * 0.34;
        drift -= proximity * borderAmbition * 0.26;
        drift -= proximity * Math.max(0, avgSocialWar - 0.46) * 0.30;
        drift -= Math.max(0, a.externalThreat - 0.55) * proximity * 0.25;
        drift -= Math.max(0, b.externalThreat - 0.55) * proximity * 0.25;
        // Allies don't drift further into infatuation; their pact is stable
        // unless the negatives above pull it down (then it can dissolve).
        let finalDrift = alreadyAllied ? Math.min(0, drift) : drift;
        if (world.trade.isEmbargoed(a.id, b.id)) finalDrift -= 1.0;

        if (Math.abs(finalDrift) >= 0.15) world.diplomacy.changeRelation(a.id, b.id, finalDrift);

        const newRelation = world.diplomacy.getRelation(a.id, b.id);
        const canPact = a.research.knowsFeature('diplomacy_pacts') && b.research.knowsFeature('diplomacy_pacts');
        if (canPact && !alreadyAllied && !truce && newRelation >= 62) {
          const pactPressure =
            (commonEnemy ? 0.08 : 0) +
            (tradeAgreement ? 0.035 : 0) +
            Math.max(0, affinity - 0.55) * 0.08 +
            Math.max(0, avgTrust - 0.55) * 0.06 +
            Math.max(0, avgSocialPeace - 0.52) * 0.04 +
            Math.min(0.06, (a.externalThreat + b.externalThreat) * 0.035);
          if (rng.chance(0.015 + pactPressure)) {
            const name = sameSpecies ? `Liga do ano ${world.year}` : `Concórdia do ano ${world.year}`;
            world.diplomacy.createAlliance(a.id, b.id, name, world.year);
            chronicle.log(
              world.year,
              'diplomacy',
              `${a.name} e ${b.name} formaram a ${name}.`,
              {
                title: name,
                importance: 'major',
                scope: 'international',
                refs: [
                  { kind: 'kingdom', id: a.id, name: a.name },
                  { kind: 'kingdom', id: b.id, name: b.name }
                ],
                tags: ['alliance', 'diplomacy', 'peace'],
                consequences: [`${a.name} e ${b.name} entraram numa aliança formal.`],
                threadId: `alliance:${[a.id, b.id].sort().join(':')}:${world.year}`,
                threadTitle: name
              }
            );
          }
        }
      }
    }
  }

  /** Wars end through victory, exhaustion or negotiated white peace. */
  private negotiatePeace(a: Kingdom, b: Kingdom, world: CivWorld): void {
    const war = world.diplomacy.getWarsFor(a.id).find(w => w.attacker === b.id || w.defender === b.id);
    if (!war) return;
    const duration = world.year - war.startYear;
    if (duration < 2) return;

    const aKills = war.attacker === a.id ? war.attackerKills : war.defenderKills;
    const bKills = war.attacker === b.id ? war.attackerKills : war.defenderKills;
    const aLosses = bKills;
    const bLosses = aKills;
    const aExhaustion = this.warExhaustionScore(a, aLosses, duration);
    const bExhaustion = this.warExhaustionScore(b, bLosses, duration);
    const powerScore = (a.computePower() - b.computePower()) * 0.025;
    const casualtyScore = (aKills - bKills) * 2.5;
    const score = powerScore + casualtyScore;
    const peacePressure = Math.max(a.society.peacePressure, b.society.peacePressure);

    // An army with a city half-taken does not sign a peace treaty, and the realm
    // whose walls are about to fall is in no position to demand one. Sieges must
    // be allowed to resolve, or conquest could never happen on the battlefield.
    const activeSiege = [...world.cities.values()].some(city => {
      if (!city.besiegerId || city.siegeProgress < 0.2) return false;
      const besieged = city.kingdomId;
      return (
        (city.besiegerId === a.id && besieged === b.id) ||
        (city.besiegerId === b.id && besieged === a.id)
      );
    });

    const decisive = Math.abs(score) > 28 && Math.max(aExhaustion, bExhaustion) > 38;
    const exhausted = (aExhaustion + bExhaustion) / 2 > 58 || aExhaustion > 78 || bExhaustion > 78 || peacePressure > 0.68;

    // Only utter exhaustion breaks off an ongoing siege.
    if (activeSiege && !(aExhaustion > 85 || bExhaustion > 85)) return;

    if (!decisive && !exhausted && !rng.chance(Math.min(0.24, duration * 0.012 + Math.max(0, peacePressure - 0.52) * 0.18))) return;

    const victor = decisive ? (score > 0 ? a : b) : null;
    const loser = victor ? (victor.id === a.id ? b : a) : null;
    const settlement: PeaceSettlement = victor ? 'victory' : exhausted ? 'exhaustion' : 'white_peace';

    if (victor && loser) {
      const reparations = Math.max(0, loser.economy.treasury * 0.12);
      loser.economy.treasury -= reparations;
      victor.economy.treasury += reparations;
      victor.legitimacy = clamp(victor.legitimacy + 0.06, 0, 1);
      loser.legitimacy = clamp(loser.legitimacy - 0.08, 0, 1);
      rememberCulture(victor.culture, 'victory', world.year, 0.7, `A vitória sobre ${loser.name} fortaleceu o orgulho nacional.`);
      rememberCulture(loser.culture, 'defeat', world.year, 0.75, `A derrota para ${victor.name} marcou a memória pública.`);
    } else {
      a.legitimacy = clamp(a.legitimacy - 0.02, 0, 1);
      b.legitimacy = clamp(b.legitimacy - 0.02, 0, 1);
      rememberCulture(a.culture, 'war', world.year, 0.55, `The war with ${b.name} ended in exhaustion.`);
      rememberCulture(b.culture, 'war', world.year, 0.55, `The war with ${a.name} ended in exhaustion.`);
    }

    a.warWeariness = Math.max(8, a.warWeariness * 0.45);
    b.warWeariness = Math.max(8, b.warWeariness * 0.45);

    world.diplomacy.settleWar(
      a.id,
      b.id,
      world.year,
      settlement,
      victor?.id ?? null,
      victor ? -42 : -22,
      victor ? 8 : 5
    );

    const text = victor
      ? `${victor.name} forçou ${loser!.name} a aceitar a paz após ${duration} anos de guerra.`
      : `${a.name} e ${b.name} aceitaram uma paz exausta após ${duration} anos de guerra.`;
    chronicle.log(
      world.year,
      'peace',
      text,
      {
        title: victor ? `Paz após a ${war.reason}` : `A Paz Exausta`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'kingdom', id: a.id, name: a.name },
          { kind: 'kingdom', id: b.id, name: b.name },
          { kind: 'war', id: war.id, name: war.reason }
        ],
        tags: ['war', 'peace', settlement],
        causes: [victor ? 'Um lado alcançou uma vantagem decisiva sob exaustão crescente.' : 'Ambos os reinos acumularam exaustão suficiente para aceitar a paz.'],
        consequences: [victor && loser ? `${victor.name} ganhou reparações e legitimidade, enquanto ${loser.name} perdeu ambos.` : 'Ambos os reinos terminaram o conflito com um cansaço de guerra persistente.'],
        threadId: `war:${war.id}`,
        threadTitle: war.reason,
        data: { duration, settlement, battles: war.battles, casualties: war.attackerKills + war.defenderKills }
      }
    );
  }

  private warExhaustionScore(kingdom: Kingdom, losses: number, duration: number): number {
    const lossPressure = losses / Math.max(1, kingdom.totalPopulation) * 140;
    return kingdom.warWeariness +
      duration * 4 +
      lossPressure +
      (1 - kingdom.foodSecurity) * 28 +
      (1 - kingdom.economy.stability) * 24;
  }

  private haveCommonEnemy(aId: string, bId: string, world: CivWorld): boolean {
    const aEnemies = new Set(world.diplomacy.getEnemies(aId));
    return world.diplomacy.getEnemies(bId).some(enemy => aEnemies.has(enemy));
  }

  // ============================================================
  // TRADE
  // ============================================================

  private tickTrade(world: CivWorld): void {
    world.trade.resetYearlyVolume();
    for (const route of world.trade.routes.values()) route.deliveredThisYear = 0;
    world.trade.pruneRoutes(id => world.cities.has(id));
    world.trade.updateRouteStatus((a, b) => world.diplomacy.isAtWar(a, b));

    this.ensureColonialTradeAgreements(world);
    this.openColonialTradeRoutes(world);
    this.negotiateTradeAgreements(world);
    this.openTradeRoutes(world);
    this.runTradeRoutes(world);
  }

  /** CITY-V3 profile changes are event/year driven; existing buildings retain their stamps. */
  private refreshCityArchitecture(city: City, kingdom: Kingdom | null, world: CivWorld): void {
    const metropole = kingdom?.metropoleId ? world.kingdoms.get(kingdom.metropoleId) ?? null : null;
    refreshArchitecturalProfile(city, kingdom, world.tileMap, world.year, metropole);
    if (!city.architecturalProfile) return;
    let backfilled = false;
    for (const building of city.buildings.values()) {
      if (building.architecture) continue;
      building.recordArchitecture(buildingArchitecturalStamp(city.architecturalProfile, building.builtYear || city.foundingYear));
      world.tileMap.markRenderDirty(building.x, building.y);
      backfilled = true;
    }
    if (backfilled) city.markBuildingTopologyChanged();
  }

  /** Colonial commerce is a preferential use of the normal treaty and route network. */
  private ensureColonialTradeAgreements(world: CivWorld): void {
    for (const metropole of world.kingdoms.values()) {
      for (const colonyId of metropole.colonyIds) {
        const colony = world.kingdoms.get(colonyId);
        if (!colony || !colony.isColony || colony.metropoleId !== metropole.id) continue;
        if (world.trade.isEmbargoed(metropole.id, colony.id)) continue;
        // Internal commerce is preferential, not costless: the 1% treaty rate
        // still gives the ordinary trade accounting a real price to settle.
        if (!world.trade.hasAgreement(metropole.id, colony.id)) {
          world.trade.signAgreement(metropole.id, colony.id, world.year, 0.01);
        }
      }
    }
  }

  /** Opens at most one raw export and one manufactured import per colonial relation. */
  private openColonialTradeRoutes(world: CivWorld): void {
    for (const metropole of world.kingdoms.values()) {
      for (const colonyId of metropole.colonyIds) {
        const colony = world.kingdoms.get(colonyId);
        if (!colony || !colony.isColony || colony.metropoleId !== metropole.id) continue;
        if (world.trade.isEmbargoed(metropole.id, colony.id)) continue;
        if (world.diplomacy.isAtWar(metropole.id, colony.id)) continue;
        this.openColonialTradeRoute(colony, metropole, 'colony_to_metropole', world);
        this.openColonialTradeRoute(metropole, colony, 'metropole_to_colony', world);
      }
    }
  }

  private openColonialTradeRoute(
    seller: Kingdom, buyer: Kingdom,
    direction: 'colony_to_metropole' | 'metropole_to_colony',
    world: CivWorld
  ): void {
    const goods = direction === 'colony_to_metropole' ? RAW_GOODS : CRAFTED_GOODS;
    const sourceCities = [...seller.cityIds].map(id => world.cities.get(id)).filter((city): city is City => !!city);
    const targetCities = [...buyer.cityIds].map(id => world.cities.get(id)).filter((city): city is City => !!city);
    if (!sourceCities.length || !targetCities.length) return;

    let best: { from: City; to: City; good: GoodId; volume: number; kind: 'overland' | 'maritime'; path?: { x: number; y: number }[]; score: number } | null = null;
    for (const from of sourceCities) for (const to of targetCities) {
      const distance = Math.hypot(from.x - to.x, from.y - to.y);
      const landPath = SimplePathfinder.findPath(from.x, from.y, to.x, to.y, world.tileMap, 'land');
      const kind = this.determineRouteKind(from, to, world.tileMap, landPath);
      if (!kind) continue;
      if (kind === 'maritime' && (!portOperational(from) || !portOperational(to))) continue;
      const capacity = kind === 'maritime' ? portCapacityFactor(from, to) : roadCapacityFactor(landPath, world.tileMap);
      const avgRoad = kind === 'maritime' ? 1.5 : avgEffectiveRoadLevel(landPath, world.tileMap);
      for (const good of goods) {
        if (world.trade.hasRouteBetween(from.id, to.id, good)) continue;
        const reserve = Math.max(8, from.population * (GOODS[good].kind === 'raw' ? 0.22 : 0.12));
        const available = from.stock.get(good) - reserve;
        if (available < 4) continue;
        const destinationNeed = this.colonialDestinationNeed(to, good, direction);
        if (destinationNeed <= 0) continue;
        const transport = transportCostPerUnit(kind, distance, world.market.price(good), avgRoad);
        const volume = Math.min(24, Math.max(3, Math.floor(Math.min(available, destinationNeed) * capacity)));
        if (volume <= 0) continue;
        const strategicWeight = GOODS[good].strategic ? 3 : GOODS[good].tier === 'regional' ? 1.55 : 1;
        const industrialWeight = direction === 'colony_to_metropole' && this.realmUsesAsIndustrialInput(buyer, good, world) ? 2.25 : 1;
        const score = volume * world.market.price(good) * strategicWeight * industrialWeight - transport * volume;
        if (!best || score > best.score) best = { from, to, good, volume, kind, path: kind === 'overland' ? landPath : undefined, score };
      }
    }
    if (!best) return;
    const path = best.kind === 'overland' ? this.paveTradeRoad(best.from, best.to, world) : undefined;
    const route = world.trade.openRoute({
      fromCityId: best.from.id, toCityId: best.to.id,
      fromKingdomId: seller.id, toKingdomId: buyer.id,
      kind: best.kind, good: best.good, volume: best.volume, year: world.year,
      path: path ?? best.path, colonialRoute: true, colonialDirection: direction
    });
    chronicle.log(world.year, 'trade', `${GOODS[best.good].name} passou a ligar ${seller.name} e ${buyer.name} pela rota colonial ${best.kind}.`, {
      title: `Rota Colonial de ${GOODS[best.good].name}`,
      importance: GOODS[best.good].strategic ? 'major' : 'notable', scope: 'international',
      refs: [{ kind: 'kingdom', id: seller.id, name: seller.name }, { kind: 'kingdom', id: buyer.id, name: buyer.name }, { kind: 'good', id: best.good, name: GOODS[best.good].name }],
      tags: ['colonisation', 'colonial-trade', best.kind, best.good],
      consequences: [`A rota ${route.id} move excedente real de ${best.from.name} para ${best.to.name}.`],
      data: { direction, volume: best.volume, kind: best.kind }
    });
  }

  /** Demand is inferred from real stocks and recipes, never assigned as a colonial quota. */
  private colonialDestinationNeed(city: City, good: GoodId, direction: 'colony_to_metropole' | 'metropole_to_colony'): number {
    const baseTarget = direction === 'colony_to_metropole'
      ? Math.max(18, city.population * 0.5)
      : Math.max(10, city.population * 0.28);
    const shortfall = Math.max(0, baseTarget - city.stock.get(good));
    if (direction === 'colony_to_metropole') {
      const industrialUse = [...city.buildings.values()].some(building =>
        CRAFTED_GOODS.some(output => GOODS[output].producedBy === building.type && productionRecipesFor(output).some(recipe => Object.prototype.hasOwnProperty.call(recipe.inputs, good)))
      );
      return industrialUse ? Math.max(shortfall, baseTarget * 0.75) : shortfall;
    }
    return shortfall;
  }

  private realmUsesAsIndustrialInput(realm: Kingdom, good: GoodId, world: CivWorld): boolean {
    for (const cityId of realm.cityIds) {
      const city = world.cities.get(cityId);
      if (!city) continue;
      if (this.colonialDestinationNeed(city, good, 'colony_to_metropole') > 0 && [...city.buildings.values()].some(building =>
        CRAFTED_GOODS.some(output => GOODS[output].producedBy === building.type && productionRecipesFor(output).some(recipe => Object.prototype.hasOwnProperty.call(recipe.inputs, good)))
      )) return true;
    }
    return false;
  }

  private negotiateTradeAgreements(world: CivWorld): void {
    const kingdoms = [...world.kingdoms.values()];

    for (let i = 0; i < kingdoms.length; i++) {
      for (let j = i + 1; j < kingdoms.length; j++) {
        const a = kingdoms[i];
        const b = kingdoms[j];

        if (!a.knownKingdoms.has(b.id)) continue;

        const atWar = world.diplomacy.isAtWar(a.id, b.id);
        const relation = world.diplomacy.getRelation(a.id, b.id);
        const hasAgreement = world.trade.hasAgreement(a.id, b.id);

        // War ends commerce.
        if (atWar && hasAgreement) {
          world.trade.cancelAgreement(a.id, b.id, world.year, 'war');
          chronicle.log(
            world.year,
            'economy',
            `O comércio entre ${a.name} e ${b.name} entrou em colapso com o início da guerra.`,
            {
              title: `Colapso Comercial entre ${a.name} e ${b.name}`,
              importance: 'major',
              scope: 'international',
              refs: [
                { kind: 'kingdom', id: a.id, name: a.name },
                { kind: 'kingdom', id: b.id, name: b.name }
              ],
              tags: ['trade', 'war', 'commerce'],
              causes: ['A guerra tornou o acordo comercial existente impossível de ser mantido.'],
              consequences: ['A troca comercial entre os dois reinos foi suspensa.']
            }
          );
          continue;
        }
        if (atWar || hasAgreement) continue;

        // Friendly realms sign barter/trade agreements
        if (relation >= 0 && rng.chance(0.35)) {
          // A treaty splits the difference between the two realms' own border
          // rates, then friendship shaves it further.
          const tariff = Math.max(0.01, (a.tariffRate() + b.tariffRate()) / 2 - Math.min(0.09, relation / 1200));
          world.trade.signAgreement(a.id, b.id, world.year, tariff);
          world.diplomacy.changeRelation(a.id, b.id, 6);
          chronicle.log(
            world.year,
            'trade',
            `${a.name} e ${b.name} assinaram um acordo comercial.`,
            {
              title: `Trade Agreement: ${a.name}–${b.name}`,
              importance: 'notable',
              scope: 'international',
              refs: [
                { kind: 'kingdom', id: a.id, name: a.name },
                { kind: 'kingdom', id: b.id, name: b.name }
              ],
              tags: ['acordo comercial', 'commerce'],
              consequences: ['Os dois reinos puderam começar a abrir rotas de comércio formais.'],
              data: { tariff: Number(tariff.toFixed(3)) }
            }
          );
        } else if (relation <= -55 && rng.chance(0.12) && !world.trade.isEmbargoed(a.id, b.id)) {
          world.trade.declareEmbargo(a.id, b.id, world.year, 'hostilidade diplomática');
          chronicle.log(
            world.year,
            'economy',
            `${a.name} impôs um embargo a ${b.name}.`,
            {
              title: `Embargo a ${b.name}`,
              importance: 'major',
              scope: 'international',
              refs: [
                { kind: 'kingdom', id: a.id, name: a.name },
                { kind: 'kingdom', id: b.id, name: b.name }
              ],
              tags: ['embargo', 'trade', 'hostility'],
              causes: ['A hostilidade diplomática cruzou o limite para coerção econômica.'],
              consequences: ['O comércio formal entre os dois reinos foi restrito.']
            }
          );
        }
      }
    }
  }

  private openTradeRoutes(world: CivWorld): void {
    for (const agreement of world.trade.agreements.values()) {
      const a = world.kingdoms.get(agreement.kingdomA);
      const b = world.kingdoms.get(agreement.kingdomB);
      if (!a || !b) continue;
      if (!world.trade.canOpenRoute(a.id) || !world.trade.canOpenRoute(b.id)) continue;
      if (!rng.chance(0.4)) continue;

      // Match a surplus in one realm against a shortage in the other.
      const pairing = this.findTradePairing(a, b, world);
      if (!pairing) continue;

      const { fromCity, toCity, good, volume, kind } = pairing;
      if (world.trade.hasRouteBetween(fromCity.id, toCity.id, good)) continue;

      // Survey what the route physically crosses so its capacity can be
      // re-evaluated every year against the live condition of the road.
      // Maritime routes are capped by port capacity instead of a land path.
      const routePath = kind === 'overland'
        ? this.paveTradeRoad(fromCity, toCity, world)
        : undefined;

      const route = world.trade.openRoute({
        fromCityId: fromCity.id,
        toCityId: toCity.id,
        fromKingdomId: fromCity.kingdomId!,
        toKingdomId: toCity.kingdomId!,
        kind,
        good,
        volume,
        year: world.year,
        path: routePath
      });

      chronicle.log(
        world.year,
        'trade',
        `Uma rota de comércio ${kind} foi aberta: ${GOODS[good].name} de ${fromCity.name} para ${toCity.name}.`,
        {
          title: `${GOODS[good].name} Route: ${fromCity.name}–${toCity.name}`,
          importance: volume >= 20 ? 'major' : 'notable',
          scope: 'international',
          refs: [
            { kind: 'city', id: fromCity.id, name: fromCity.name },
            { kind: 'city', id: toCity.id, name: toCity.name },
            { kind: 'kingdom', id: fromCity.kingdomId!, name: a.name },
            { kind: 'kingdom', id: toCity.kingdomId!, name: b.name },
            { kind: 'good', id: good, name: GOODS[good].name }
          ],
          tags: ['rota de comércio', kind, good],
          consequences: [`${GOODS[good].name} começou a transitar regularmente entre os dois assentamentos.`],
          threadId: `trade:${fromCity.id}:${toCity.id}:${good}`,
          threadTitle: `Comércio de ${GOODS[good].name} entre ${fromCity.name} e ${toCity.name}`,
          data: { volume, kind }
        }
      );
    }
  }

  private findTradePairing(a: Kingdom, b: Kingdom, world: CivWorld): {
    fromCity: City;
    toCity: City;
    good: GoodId;
    volume: number;
    kind: 'overland' | 'maritime';
  } | null {
    const citiesA = [...a.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
    const citiesB = [...b.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
    if (citiesA.length === 0 || citiesB.length === 0) return null;

    const maxDistance = 90;

    let bestPairing: { fromCity: City; toCity: City; good: GoodId; volume: number; kind: 'overland' | 'maritime' } | null = null;
    let bestGain = 0;

    // A treaty tariff overrides the border rate; otherwise each buyer charges
    // whatever its own trade law says, so protectionism really does close routes.
    const treaty = world.trade.getAgreement(a.id, b.id)?.tariff;

    for (const [source, destination, seller, buyer] of [
      [citiesA, citiesB, a, b],
      [citiesB, citiesA, b, a]
    ] as [City[], City[], Kingdom, Kingdom][]) {
      for (const from of source) {
        for (const to of destination) {
          const distance = Math.hypot(from.x - to.x, from.y - to.y);
          if (distance > maxDistance) continue;

          // Reachability and infrastructure capacity belong to the city pair,
          // not to an individual good. Compute A* once, then price every good.
          const landPath = SimplePathfinder.findPath(from.x, from.y, to.x, to.y, world.tileMap, 'land');
          const kind = this.determineRouteKind(from, to, world.tileMap, landPath);
          if (!kind) continue;
          const capacity = kind === 'maritime'
            ? portCapacityFactor(from, to)
            : roadCapacityFactor(landPath, world.tileMap);
          const avgRoad = kind === 'maritime' ? 1.5 : avgEffectiveRoadLevel(landPath, world.tileMap);

          for (const good of ALL_GOODS) {
            const surplus = from.stock.get(good);
            if (surplus < 15) continue;

            // A route exists because someone profits, not because a stock is large.
            // The seller's realm is cheap in this good and the buyer's is dear; the
            // gap has to survive hauling it and the tariff at the border.
            const worldPrice = world.market.price(good);
            const sellPrice = seller.economy.market.price(good, worldPrice);
            const buyPrice = buyer.economy.market.price(good, worldPrice);

            // Infrastructure sets the economics of the haul: better roads cut the
            // cost per tile, and the route can only carry what the road or ports
            // physically move (0.7× on a dirt trail, 1.0× stone, 1.3× imperial).
            const transport = transportCostPerUnit(kind, distance, worldPrice, avgRoad);
            const tariff = treaty ?? buyer.tariffRate();
            const marginPerUnit = buyPrice - sellPrice - transport - buyPrice * tariff;
            if (marginPerUnit <= 0) continue;

            const volume = Math.min(20, Math.max(3, Math.floor((surplus / 4) * capacity)));
            const gain = volume * marginPerUnit;

            if (gain > bestGain) {
              bestGain = gain;
              bestPairing = {
                fromCity: from,
                toCity: to,
                good,
                volume,
                kind
              };
            }
          }
        }
      }
    }

    return bestPairing;
  }

  private runTradeRoutes(world: CivWorld): void {
    for (const route of world.trade.routes.values()) {
      if (!route.active) {
        this.recordColonialRouteInterruption(route, world, 'guerra, embargo ou bloqueio diplomático');
        continue;
      }

      const from = world.cities.get(route.fromCityId);
      const to = world.cities.get(route.toCityId);
      const sellerKingdom = world.kingdoms.get(route.fromKingdomId);
      const buyerKingdom = world.kingdoms.get(route.toKingdomId);
      if (!from || !to || !sellerKingdom || !buyerKingdom) continue;

      // Infrastructure carries capacity: the route moves only as much as its
      // road or its ports can physically handle this year. A destroyed port
      // collapses maritime trade to zero immediately.
      const capacity = route.kind === 'maritime'
        ? portCapacityFactor(from, to)
        : roadCapacityFactor(route.path, world.tileMap);

      if (capacity <= 0.01) {
        this.recordColonialRouteInterruption(route, world, 'a infraestrutura logística ficou inoperante');
        if (!this.collapsedRoutes.has(route.id)) {
          this.collapsedRoutes.add(route.id);
          chronicle.log(
            world.year,
            'disaster',
            `Maritime trade through ${GOODS[route.good].name} route ${from.name}–${to.name} collapsed: the harbor at ${portOperational(from) ? to.name : from.name} lies in ruins.`,
            {
              title: `Trade Collapse: ${from.name}–${to.name}`,
              importance: 'major',
              scope: 'international',
              refs: [
                { kind: 'city', id: from.id, name: from.name },
                { kind: 'city', id: to.id, name: to.name },
                { kind: 'good', id: route.good, name: GOODS[route.good].name }
              ],
              tags: ['colapso comercial', 'infrastructure', 'port'],
              causes: ['Um porto foi destruído ou caiu para menos da metade de sua integridade.'],
              consequences: [`Imports and exports through ${from.name}–${to.name} stopped.`]
            }
          );
        }
        continue;
      }
      this.collapsedRoutes.delete(route.id);
      this.disruptedColonialRoutes.delete(route.id);

      const shipped = from.stock.take(route.good, route.volume * capacity);
      if (shipped <= 0) continue;
      const delivered = to.stock.add(route.good, shipped);

      // Anything that couldn't be unloaded goes back on the cart.
      if (delivered < shipped) from.stock.add(route.good, shipped - delivered);
      route.deliveredThisYear += delivered;

      from.ledger.recordExported(route.good, delivered);
      to.ledger.recordImported(route.good, delivered);

      const value = delivered * world.market.price(route.good);
      world.market.reportDemand(route.good, delivered);
      world.trade.recordTrade(route, value);

      // Colonial freight pays the distance cost that selected its route. This
      // is deducted from the export revenue, so a far colony is useful only
      // when its real surplus and resource value justify moving it.
      const averageRoad = route.kind === 'maritime' ? 1.5 : avgEffectiveRoadLevel(route.path, world.tileMap);
      const logisticsCost = route.colonialRoute
        ? delivered * transportCostPerUnit(route.kind, Math.hypot(from.x - to.x, from.y - to.y), world.market.price(route.good), averageRoad)
        : 0;
      const sellerRevenue = Math.max(0, value - logisticsCost);

      // Revenue lands once a year, in the same currency the goods were valued
      // at, and only for goods that actually crossed the border. It used to be
      // paid on every caravan/ship arrival — tens of round trips a year per
      // route — multiplied by a solvency check that inflated revenue whenever
      // the buyer had any gold stock, so a few routes minted hundreds of
      // thousands of gold for a realm of twenty people.
      sellerKingdom.exportVolume += sellerRevenue;
      sellerKingdom.economy.treasury += sellerRevenue;
      sellerKingdom.treasury.add('gold', sellerRevenue);
      if (buyerKingdom.id !== sellerKingdom.id) {
        const tariffRate = world.trade.getAgreement(sellerKingdom.id, buyerKingdom.id)?.tariff ?? buyerKingdom.tariffRate();
        const tariff = value * tariffRate;
        buyerKingdom.tariffRevenue += tariff;
        buyerKingdom.economy.treasury += tariff;
        buyerKingdom.treasury.add('gold', tariff);
        buyerKingdom.importVolume += value;
      }
      this.settleColonialTribute(route, sellerKingdom, buyerKingdom, value);

      // Commerce quietly improves relations.
      if (rng.chance(0.25)) {
        world.diplomacy.changeRelation(route.fromKingdomId, route.toKingdomId, 1);
      }
    }
  }

  // ============================================================
  // VASSALAGE & EMPIRE
  // ============================================================

  /** Overwhelming power turns neighbours into subjects without a shot being fired. */
  private tickVassalage(world: CivWorld): void {
    const kingdoms = [...world.kingdoms.values()];

    for (const overlord of kingdoms) {
      if (overlord.isColony) continue;
      if (!overlord.research.knowsFeature('diplomacy_pacts')) continue;
      if (overlord.overlordId) continue; // A vassal cannot hold vassals

      for (const candidateId of overlord.knownKingdoms) {
        const candidate = world.kingdoms.get(candidateId);
        if (!candidate || candidate.isColony || candidate.overlordId || candidate.vassalIds.size > 0) continue;
        if (world.diplomacy.isAtWar(overlord.id, candidate.id)) continue;

        const ratio = overlord.computePower() / Math.max(1, candidate.computePower());
        const relation = world.diplomacy.getRelation(overlord.id, candidate.id);
        const culturalSubmission =
          candidate.culture.authority * 0.03 +
          candidate.culture.tradition * 0.02 +
          overlord.culture.militarism * 0.015 -
          candidate.culture.diplomaticTrust * 0.015;
        const eliteSubmission =
          candidate.society.factions.nobles.loyalty * candidate.society.factions.nobles.influence * 0.04 +
          candidate.society.factions.bureaucrats.loyalty * candidate.society.factions.bureaucrats.influence * 0.035 -
          candidate.society.factions.frontier.radicalization * candidate.society.factions.frontier.influence * 0.04;

        // Fealty is bought with either overwhelming strength or genuine friendship.
        const submits = ratio > 3 && relation > -40 && rng.chance(0.035 + culturalSubmission + eliteSubmission);
        if (!submits) continue;

        candidate.overlordId = overlord.id;
        overlord.vassalIds.add(candidate.id);
        world.diplomacy.setRelation(overlord.id, candidate.id, 60);

        chronicle.log(
          world.year,
          'conquest',
          `${candidate.name} jurou fidelidade a ${overlord.name} e tornou-se seu vassalo.`
        );
        events.emit('vassalageSworn', { overlord, vassal: candidate, year: world.year });
        break;
      }
    }

    // Vassals send tribute to their overlord each year.
    for (const vassal of kingdoms) {
      if (vassal.isColony) continue;
      if (!vassal.overlordId) continue;
      const overlord = world.kingdoms.get(vassal.overlordId);
      if (!overlord) {
        vassal.overlordId = null;
        continue;
      }
      const relation = world.diplomacy.getRelation(vassal.id, overlord.id);
      const tributeRate = clamp(
        0.08 + (overlord.isEmpire ? 0.04 : 0) - Math.max(0, relation) / 1800,
        0.04,
        0.18
      );
      const tribute = Math.max(0, vassal.economy.treasury * tributeRate);
      vassal.economy.treasury -= tribute;
      overlord.economy.treasury += tribute;

      vassal.economy.stability = clamp(vassal.economy.stability - tributeRate * 0.08, 0, 1);
      vassal.legitimacy = clamp(vassal.legitimacy - tributeRate * 0.04, 0, 1);
      world.diplomacy.changeRelation(vassal.id, overlord.id, relation > 45 ? 0.4 : -tributeRate * 8);

      const wantsIndependence =
        relation < -55 &&
        vassal.economy.stability < 0.42 &&
        vassal.culture.authority < 0.68 &&
        vassal.society.revoltRisk > 0.18 &&
        vassal.computePower() > overlord.computePower() * 0.45;
      const independencePressure =
        vassal.society.factions.frontier.radicalization * 0.08 +
        vassal.society.factions.reformists.radicalization * 0.05 +
        Math.max(0, vassal.society.revoltRisk - 0.2) * 0.12;
      if (wantsIndependence && rng.chance(0.05 + independencePressure)) {
        vassal.overlordId = null;
        overlord.vassalIds.delete(vassal.id);
        rememberCulture(vassal.culture, 'secession', world.year, 0.75, `A independência de ${overlord.name} tornou-se uma memória fundacional.`);
        rememberCulture(overlord.culture, 'secession', world.year, 0.65, `${vassal.name} se libertou do controle imperial.`);
        const declared = world.diplomacy.declareWar(vassal.id, overlord.id, world.year, 'Revolta de Independência');
        if (declared) {
          chronicle.log(
            world.year,
            'war',
            `${vassal.name} renunciou à sua lealdade a ${overlord.name} e iniciou uma guerra de independência.`
          );
        } else {
          chronicle.log(world.year, 'kingdom', `${vassal.name} escapou do controle de ${overlord.name}.`);
        }
        events.emit('vassalageBroken', { overlord, vassal, year: world.year });
      }
    }
  }

  // ============================================================
  // COLONIAL ADMINISTRATION — DISTINCT SUBORDINATE REALMS
  // ============================================================

  /**
   * Creates a colonial realm, not another distant city of the metropole. The
   * city, territory and population are assigned to the new Realm/Kingdom so
   * the existing growth, economy, diplomacy and warfare loops keep operating
   * without a parallel colonial simulation.
   */
  private tickColonialFoundations(world: CivWorld): void {
    for (const metropole of world.kingdoms.values()) {
      if (metropole.isColony || !metropole.research.knowsFeature('colonisation')) continue;
      if (metropole.totalPopulation < 18 || metropole.economy.treasury < 120) continue;
      if (!rng.chance(0.055 + Math.min(0.04, metropole.economy.treasury / 12000))) continue;

      const parent = [...metropole.cityIds]
        .map(id => world.cities.get(id))
        .filter((city): city is City => !!city)
        .filter(city => city.population >= 12 && city.prosperity >= 0.5 && city.stock.get('food') >= 110)
        .sort((a, b) => (b.prosperity * b.population) - (a.prosperity * a.population))[0];
      if (!parent) continue;
      const site = this.findColonialFoundationSite(parent, world, metropole);
      if (site) this.foundColonialRealm(parent, site, metropole, world);
    }
  }

  /** Colonial tribute is paid from actual export revenue after the goods arrive. */
  private settleColonialTribute(route: { colonialRoute?: boolean; colonialDirection?: string }, seller: Kingdom, buyer: Kingdom, value: number): void {
    if (!route.colonialRoute || route.colonialDirection !== 'colony_to_metropole') return;
    if (seller.metropoleId !== buyer.id || !seller.isColony) return;
    const tribute = Math.min(value * 0.08, seller.economy.treasury);
    if (tribute <= 0) return;
    seller.economy.treasury -= tribute;
    seller.treasury.take('gold', tribute);
    buyer.economy.treasury += tribute;
    buyer.treasury.add('gold', tribute);
  }

  private recordColonialRouteInterruption(route: { id: string; colonialRoute?: boolean; good: GoodId; fromCityId: string; toCityId: string }, world: CivWorld, reason: string): void {
    if (!route.colonialRoute || this.disruptedColonialRoutes.has(route.id)) return;
    this.disruptedColonialRoutes.add(route.id);
    const from = world.cities.get(route.fromCityId);
    const to = world.cities.get(route.toCityId);
    chronicle.log(world.year, 'economy', `A rota colonial de ${GOODS[route.good].name} foi interrompida: ${reason}.`, {
      title: `Interrupção Colonial de ${GOODS[route.good].name}`,
      importance: 'major', scope: 'international',
      refs: [
        ...(from ? [{ kind: 'city' as const, id: from.id, name: from.name }] : []),
        ...(to ? [{ kind: 'city' as const, id: to.id, name: to.name }] : []),
        { kind: 'good' as const, id: route.good, name: GOODS[route.good].name }
      ],
      tags: ['colonisation', 'colonial-trade', 'interruption', route.good],
      consequences: [`A disponibilidade de ${GOODS[route.good].name} nas cidades dependentes cairá até que a rota volte.`],
      data: { routeId: route.id, reason }
    });
  }

  private foundColonialRealm(parent: City, site: { x: number; y: number; access: Exclude<ColonialAccess, null>; distance: number }, metropole: Kingdom, world: CivWorld): void {
    const settlers = Math.max(5, Math.min(12, Math.floor(parent.population * 0.2)));
    const provisions = parent.stock.take('food', 80);
    const timber = parent.stock.take('wood', 45);
    const expeditionCost = Math.min(80, metropole.economy.treasury * 0.16);
    metropole.economy.treasury -= expeditionCost;
    const capital = new City(nextId('city'), this.generateSettlementName(parent, world), parent.species, site.x, site.y, parent.founderName, world.year);
    const colony = new Kingdom(nextId('king'), this.generateColonialName(metropole, capital.name, world), parent.species, metropole.color, capital.id, world.year);
    colony.establishColony(metropole.id, site.access);
    colony.government = metropole.government;
    colony.governmentSince = world.year;
    colony.research.deserialize(metropole.research.serialize());
    colony.research.current = null;
    colony.research.progress = 0;
    colony.economy.treasury = expeditionCost;
    colony.knownKingdoms.add(metropole.id);
    metropole.knownKingdoms.add(colony.id);
    metropole.addColony(colony.id);
    world.diplomacy.setRelation(metropole.id, colony.id, 100);

    capital.kingdomId = colony.id;
    capital.parentCityId = parent.id;
    capital.population = settlers;
    parent.population -= settlers;
    parent.ledger.recordExported('food', provisions);
    parent.ledger.recordExported('wood', timber);
    capital.ledger.recordImported('food', capital.stock.add('food', provisions));
    capital.ledger.recordImported('wood', capital.stock.add('wood', timber));
    capital.updateTier();
    world.cities.set(capital.id, capital);
    world.kingdoms.set(colony.id, colony);
    this.refreshCityArchitecture(capital, colony, world);
    const tile = world.tileMap.getTile(site.x, site.y)!;
    tile.cityId = capital.id;
    tile.kingdomId = colony.id;
    world.tileMap.markRenderDirty(tile.x, tile.y);
    capital.seedFoundingClaim(world.tileMap, 5);
    this.relocateColonists(parent, capital, colony.id, settlers, world);

    chronicle.log(world.year, 'founding', `${metropole.name} fundou ${colony.name}, com capital em ${capital.name}.`, {
      title: `Fundação de ${colony.name}`,
      importance: 'major', scope: 'kingdom',
      refs: [{ kind: 'kingdom', id: metropole.id, name: metropole.name }, { kind: 'kingdom', id: colony.id, name: colony.name }, { kind: 'city', id: capital.id, name: capital.name }],
      tags: ['colonisation', 'colony', site.access],
      causes: [`A expedição cobriu ${Math.round(site.distance)} unidades por acesso ${site.access === 'maritime' ? 'marítimo' : 'terrestre'}.`],
      consequences: [`${colony.name} iniciou sua administração subordinada a ${metropole.name}.`],
      data: { settlers, access: site.access, metropoleId: metropole.id, colonyId: colony.id }
    });
    events.emit('colonialRealmFounded', { metropole, colony, capital, parent, access: site.access, year: world.year });
  }

  /** Sites are distant, unclaimed and either connected over land or by a viable sea passage. */
  private findColonialFoundationSite(parent: City, world: CivWorld, metropole: Kingdom): { x: number; y: number; access: Exclude<ColonialAccess, null>; distance: number } | null {
    const minDistance = Math.max(24, Math.floor(Math.min(world.tileMap.width, world.tileMap.height) * 0.28));
    let best: { x: number; y: number; access: Exclude<ColonialAccess, null>; distance: number; score: number } | null = null;
    for (let attempt = 0; attempt < 42; attempt++) {
      const x = rng.rangeInt(2, Math.max(2, world.tileMap.width - 3));
      const y = rng.rangeInt(2, Math.max(2, world.tileMap.height - 3));
      const tile = world.tileMap.getTile(x, y);
      if (!tile || TERRAINS[tile.type].isWater || !TERRAINS[tile.type].isWalkable || tile.cityId || tile.buildingId || tile.kingdomId) continue;
      const distance = Math.hypot(parent.x - x, parent.y - y);
      if (distance < minDistance || [...world.cities.values()].some(city => Math.hypot(city.x - x, city.y - y) < 14)) continue;
      const landPath = SimplePathfinder.findPath(parent.x, parent.y, x, y, world.tileMap, 'land', 2600);
      let access: Exclude<ColonialAccess, null> | null = landPath.length > 0 ? 'overland' : null;
      if (!access && metropole.research.knowsFeature('maritime_trade')) {
        const departureCoast = this.findCoastAccess(parent.x, parent.y, world.tileMap);
        const arrivalCoast = this.findCoastAccess(x, y, world.tileMap);
        if (departureCoast && arrivalCoast && SimplePathfinder.findPath(departureCoast.x, departureCoast.y, arrivalCoast.x, arrivalCoast.y, world.tileMap, 'sea', 2600).length > 0) access = 'maritime';
      }
      if (!access) continue;
      let score = TERRAINS[tile.type].fertility * 35 + Math.min(30, distance * 0.12);
      for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
        const nearby = world.tileMap.getTile(x + dx, y + dy);
        const good = nearby?.resourceType ? tileResourceToGood(nearby.resourceType) : null;
        if (good) score += GOODS[good].basePrice * 0.35;
      }
      if (SPECIES_DEFINITIONS[parent.species].preferredBiomes.includes(tile.type)) score += 18;
      if (access === 'maritime') score += 8;
      if (!best || score > best.score) best = { x, y, access, distance, score };
    }
    return best ? { x: best.x, y: best.y, access: best.access, distance: best.distance } : null;
  }

  private findCoastAccess(x: number, y: number, tileMap: TileMap): { x: number; y: number } | null {
    for (let radius = 1; radius <= 7; radius++) for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const tile = tileMap.getTile(x + dx, y + dy);
      if (tile && TERRAINS[tile.type].isWater) return { x: tile.x, y: tile.y };
    }
    return null;
  }

  /** A small annual movement keeps a young colony supplied through existing city/entity ownership. */
  private tickColonialMigration(world: CivWorld): void {
    for (const metropole of world.kingdoms.values()) for (const colonyId of metropole.colonyIds) {
      const colony = world.kingdoms.get(colonyId);
      const destination = colony ? world.cities.get(colony.capitalCityId) : null;
      if (!colony || !destination || !colony.isColony || colony.metropoleId !== metropole.id || destination.population >= 20) continue;
      if (world.diplomacy.isAtWar(metropole.id, colony.id)) continue;
      const source = [...metropole.cityIds].map(id => world.cities.get(id)).filter((city): city is City => !!city)
        .filter(city => city.population >= 20 && city.stock.get('food') >= 65).sort((a, b) => b.population - a.population)[0];
      if (!source) continue;
      const migrants = Math.min(3, Math.max(1, Math.floor((source.population - 16) / 8)));
      const food = source.stock.take('food', migrants * 8);
      source.ledger.recordExported('food', food);
      destination.ledger.recordImported('food', destination.stock.add('food', food));
      source.population -= migrants;
      destination.population += migrants;
      this.relocateColonists(source, destination, colony.id, migrants, world);
      events.emit('colonialMigration', { metropole, colony, source, destination, migrants, year: world.year });
    }
  }

  private relocateColonists(source: City, destination: City, kingdomId: string, count: number, world: CivWorld): void {
    const movers = world.entities.filter(entity => entity.cityId === source.id && !entity.isChild).slice(0, count);
    for (const mover of movers) {
      if (mover.homeBuildingId) source.buildings.get(mover.homeBuildingId)?.residentIds.delete(mover.id);
      if (mover.workplaceId) source.buildings.get(mover.workplaceId)?.assignedWorkerIds.delete(mover.id);
      mover.homeBuildingId = null; mover.workplaceId = null; mover.profession = 'none';
      mover.cityId = destination.id; mover.kingdomId = kingdomId;
      mover.x = destination.x + rng.range(-1.5, 1.5); mover.y = destination.y + rng.range(-1.5, 1.5);
      mover.homeX = destination.x; mover.homeY = destination.y; mover.targetX = null; mover.targetY = null;
    }
  }

  private generateColonialName(metropole: Kingdom, capitalName: string, world: CivWorld): string {
    const root = capitalName.replace(/(Reach|Hollow|Crossing|Landing|Watch|Rest|Ford|Haven|Gate|Rise)$/i, '') || capitalName;
    for (let suffix = 0; suffix < 12; suffix++) {
      const candidate = suffix === 0 ? `Colônia ${root}` : `Colônia ${root} ${suffix + 1}`;
      if (![...world.kingdoms.values()].some(realm => realm.name === candidate)) return candidate;
    }
    return `Colônia ${metropole.name.split(' ').pop() ?? world.year}`;
  }

  // ============================================================
  // COLONISATION — SETTLERS FOUND NEW VILLAGES
  // ============================================================

  /**
   * A crowded, well-fed settlement sends people out to found a new one.
   * This is how a single starting village becomes a sprawling realm.
   */
  private tickColonisation(world: CivWorld): void {
    for (const city of [...world.cities.values()]) {
      const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
      if (!kingdom) continue;

      // Only established, prosperous settlements colonise — but the old gate of 22
      // citizens sat above the size most settlements ever reached, so daughter
      // towns were effectively never founded and the continent stayed empty.
      if (city.population < 12) continue;
      if (city.prosperity < 0.45) continue;
      if (city.stock.get('food') < 90) continue;
      if (city.population < city.housingCapacity() * 0.7) continue;

      const gov = GOVERNMENTS[kingdom.government];
      const chance = 0.4 * (gov.expansion / 20);
      if (!rng.chance(chance)) continue;

      const site = this.findColonySite(city, world, kingdom);
      if (!site) continue;

      // The settlers and their supplies leave the parent settlement.
      const settlers = Math.max(4, Math.floor(city.population * 0.18));
      city.population -= settlers;
      const provisions = city.stock.take('food', 60);
      const timber = city.stock.take('wood', 40);

      const colony = new City(
        nextId('city'),
        this.generateSettlementName(city, world),
        city.species,
        site.x,
        site.y,
        city.founderName,
        world.year
      );
      colony.kingdomId = kingdom.id;
      colony.parentCityId = city.id;
      colony.population = settlers;
      // Provisions leave the parent's books and arrive on the colony's.
      city.ledger.recordExported('food', provisions);
      city.ledger.recordExported('wood', timber);
      colony.ledger.recordImported('food', colony.stock.add('food', provisions));
      colony.ledger.recordImported('wood', colony.stock.add('wood', timber));
      colony.updateTier();

      world.cities.set(colony.id, colony);
      kingdom.addCity(colony.id);
      this.refreshCityArchitecture(colony, kingdom, world);

      const tile = world.tileMap.getTile(site.x, site.y)!;
      tile.cityId = colony.id;
      tile.kingdomId = kingdom.id;
      world.tileMap.markRenderDirty(tile.x, tile.y);
      colony.seedFoundingClaim(world.tileMap, 4);

      // Move some real citizens to the new settlement so the map shows it living.
      const movers = world.entities.filter(e => e.cityId === city.id && !e.isChild).slice(0, settlers);
      for (const mover of movers) {
        // Leave the old house and job behind, or the settler keeps a bed and a
        // workplace in a settlement they no longer live in.
        if (mover.homeBuildingId) city.buildings.get(mover.homeBuildingId)?.residentIds.delete(mover.id);
        if (mover.workplaceId) city.buildings.get(mover.workplaceId)?.assignedWorkerIds.delete(mover.id);
        mover.homeBuildingId = null;
        mover.workplaceId = null;
        mover.profession = 'none';

        mover.cityId = colony.id;
        mover.x = site.x + rng.range(-1.5, 1.5);
        mover.y = site.y + rng.range(-1.5, 1.5);
        mover.homeX = site.x;
        mover.homeY = site.y;
        mover.targetX = null;
        mover.targetY = null;
      }

      chronicle.log(
        world.year,
        'founding',
        `Colonos de ${city.name} fundaram ${colony.name} em nome de ${kingdom.name}.`,
        {
          title: `Fundação de ${colony.name}`,
          importance: 'major',
          scope: 'city',
          refs: [
            { kind: 'city', id: colony.id, name: colony.name },
            { kind: 'city', id: city.id, name: city.name },
            { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
          ],
          tags: ['colonisation', 'founding', 'settlers'],
          causes: [`${city.name} teve pressão populacional, de alimentos e moradia para enviar colonos.`],
          consequences: [`${kingdom.name} ganhou um novo assentamento.`],
          data: { settlers }
        }
      );
      events.emit('colonyFounded', { colony, parent: city, kingdom, year: world.year });
    }
  }

  private findColonySite(city: City, world: CivWorld, kingdom: Kingdom): { x: number; y: number } | null {
    const canCrossWater = kingdom.research.knowsFeature('colonisation');
    const minDistance = 12;
    const maxDistance = canCrossWater ? 40 : 24;

    let best: { x: number; y: number; score: number } | null = null;

    for (let attempt = 0; attempt < 60; attempt++) {
      const angle = rng.next() * Math.PI * 2;
      const distance = rng.range(minDistance, maxDistance);
      const x = Math.round(city.x + Math.cos(angle) * distance);
      const y = Math.round(city.y + Math.sin(angle) * distance);

      const tile = world.tileMap.getTile(x, y);
      if (!tile) continue;
      if (TERRAINS[tile.type].isWater || !TERRAINS[tile.type].isWalkable) continue;
      if (tile.cityId || tile.buildingId) continue;
      if (tile.kingdomId && tile.kingdomId !== kingdom.id) continue;

      // Don't crowd an existing settlement.
      let tooClose = false;
      for (const other of world.cities.values()) {
        if (Math.hypot(other.x - x, other.y - y) < minDistance) { tooClose = true; break; }
      }
      if (tooClose) continue;

      // Score the surroundings: food, timber and ore all matter.
      let score = TERRAINS[tile.type].fertility * 30;
      for (let dx = -4; dx <= 4; dx++) {
        for (let dy = -4; dy <= 4; dy++) {
          const neighbour = world.tileMap.getTile(x + dx, y + dy);
          if (!neighbour?.resourceType) continue;
          const good = tileResourceToGood(neighbour.resourceType);
          if (good) score += GOODS[good].basePrice * 0.4;
        }
      }
      // Species prefer their own kind of land.
      if (SPECIES_DEFINITIONS[city.species].preferredBiomes.includes(tile.type)) score += 25;

      if (!best || score > best.score) best = { x, y, score };
    }

    return best && best.score > 15 ? { x: best.x, y: best.y } : null;
  }

  private generateSettlementName(parent: City, world: CivWorld): string {
    const suffixes = ['Reach', 'Hollow', 'Crossing', 'Landing', 'Watch', 'Rest', 'Ford', 'Haven', 'Gate', 'Rise'];
    const root = parent.name.replace(/(ton|burg|Reach|Hollow|Crossing|Landing|Watch|Rest|Ford|Haven|Gate|Rise)$/i, '');
    for (let i = 0; i < 12; i++) {
      const name = `${root}${rng.pick(suffixes)}`;
      const taken = [...world.cities.values()].some(c => c.name === name);
      if (!taken) return name;
    }
    return `${root}${world.year}`;
  }

  private findSpotNear(x: number, y: number, radius: number, tileMap: TileMap): { x: number; y: number } {
    for (let i = 0; i < 12; i++) {
      const nx = x + rng.rangeInt(-radius, radius);
      const ny = y + rng.rangeInt(-radius, radius);
      const tile = tileMap.getTile(nx, ny);
      if (tile && TERRAINS[tile.type].isWalkable) return { x: nx, y: ny };
    }
    return { x, y };
  }

  // ============================================================
  // COLONIAL AUTONOMY, REVOLT & INDEPENDENCE
  // ============================================================

  /** Political pressure is derived from distance, real extraction and lived conditions. */
  private tickColonialPolitics(world: CivWorld): void {
    for (const colony of world.kingdoms.values()) {
      if (!colony.isColony || !colony.metropoleId) continue;
      const metropole = world.kingdoms.get(colony.metropoleId);
      if (!metropole) continue;

      if (colony.separatistMovement === 'revolt') {
        this.resolveColonialRevolt(colony, metropole, world);
        continue;
      }

      const distance = this.closestRealmDistance(colony, metropole, world);
      const distancePressure = clamp(distance / 100, 0, 1);
      const prosperity = this.colonialProsperity(colony, world);
      const famine = [...colony.cityIds].reduce((sum, id) => sum + (world.cities.get(id)?.famineYears ?? 0), 0);
      const crisis = clamp(
        (1 - colony.economy.stability) * 0.38 +
        (1 - colony.foodSecurity) * 0.28 +
        Math.min(1, famine / Math.max(1, colony.cityIds.size * 3)) * 0.24 +
        (colony.warWeariness / 100) * 0.22,
        0, 1
      );
      const extraction = this.colonialExtractionPressure(colony, metropole, world);
      const relation = world.diplomacy.getRelation(colony.id, metropole.id);
      const relationSupport = clamp((relation + 100) / 200, 0, 1);

      colony.colonialIdentity = clamp(
        colony.colonialIdentity + 0.006 + distancePressure * 0.012 + colony.colonialAutonomy * 0.008 + crisis * 0.012 - prosperity * 0.003,
        0, 1
      );
      const autonomyTarget = clamp(0.1 + distancePressure * 0.3 + colony.colonialIdentity * 0.3 + colony.colonialTension * 0.2 + (1 - metropole.administrativeReach) * 0.16, 0, 0.92);
      colony.colonialAutonomy += (autonomyTarget - colony.colonialAutonomy) * 0.16;
      const tensionTarget = clamp(
        distancePressure * 0.18 + colony.colonialIdentity * 0.14 + extraction * 0.48 + crisis * 0.5 + (1 - colony.colonialLoyalty) * 0.14 - prosperity * 0.24 - relationSupport * 0.22,
        0, 1
      );
      colony.colonialTension += (tensionTarget - colony.colonialTension) * 0.22;
      const loyaltyTarget = clamp(0.96 - colony.colonialTension * 0.62 - colony.colonialIdentity * 0.18 - colony.colonialAutonomy * 0.1 + prosperity * 0.14 + relationSupport * 0.16, 0, 1);
      colony.colonialLoyalty += (loyaltyTarget - colony.colonialLoyalty) * 0.2;

      const movementPressure = clamp(
        colony.colonialIdentity * 0.35 + colony.colonialAutonomy * 0.2 + colony.colonialTension * 0.3 + crisis * 0.2 + extraction * 0.12 + colony.foreignSupport * 0.18,
        0, 1
      );
      const colonialAge = world.year - colony.foundingYear;
      if (colony.separatistMovement === 'none' && colonialAge >= 8 && movementPressure >= 0.62 && colony.colonialIdentity >= 0.35) {
        colony.separatistMovement = 'organizing';
        colony.separatistSince = world.year;
        this.selectColonialLeader(colony, world);
        chronicle.log(world.year, 'rebellion', `Um movimento separatista começou a se organizar em ${colony.name}.`, {
          title: `Movimento Separatista em ${colony.name}`,
          importance: 'major', scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: colony.id, name: colony.name }, { kind: 'kingdom', id: metropole.id, name: metropole.name }],
          tags: ['colonisation', 'autonomy', 'separatism'],
          causes: ['Distância, identidade colonial, exploração econômica e condições locais elevaram a pressão política.'],
          consequences: ['Elites locais passaram a organizar uma plataforma de autogoverno.'],
          data: { identity: Number(colony.colonialIdentity.toFixed(2)), tension: Number(colony.colonialTension.toFixed(2)), autonomy: Number(colony.colonialAutonomy.toFixed(2)) }
        });
      }

      if (colony.separatistMovement !== 'organizing') continue;
      const movementAge = world.year - (colony.separatistSince ?? world.year);
      const peaceful = movementAge >= 4 && colony.colonialAutonomy >= 0.76 && colony.colonialIdentity >= 0.66 && colony.colonialTension <= 0.5 && relation >= 25 && crisis < 0.3;
      if (peaceful) {
        this.grantColonialIndependence(colony, metropole, world, true);
        continue;
      }
      if (movementAge >= 2 && movementPressure >= 0.74 && colony.colonialTension >= 0.66 && colony.colonialLoyalty <= 0.38) {
        this.startColonialRevolt(colony, metropole, world);
      }
    }
  }

  private colonialProsperity(colony: Kingdom, world: CivWorld): number {
    let total = 0;
    let count = 0;
    for (const cityId of colony.cityIds) {
      const city = world.cities.get(cityId);
      if (!city) continue;
      total += city.prosperity;
      count++;
    }
    return count ? total / count : 0;
  }

  /** Only deliveries actually completed on colonial routes count as exploitation pressure. */
  private colonialExtractionPressure(colony: Kingdom, metropole: Kingdom, world: CivWorld): number {
    let value = 0;
    for (const route of world.trade.routesFor(colony.id)) {
      if (!route.active || !route.colonialRoute || route.colonialDirection !== 'colony_to_metropole') continue;
      if (route.fromKingdomId !== colony.id || route.toKingdomId !== metropole.id) continue;
      value += route.deliveredThisYear * world.market.price(route.good);
    }
    const output = [...colony.cityIds].reduce((sum, id) => sum + (world.cities.get(id)?.economicOutput ?? 0), 0);
    return clamp(value / Math.max(30, output + 20), 0, 1);
  }

  private startColonialRevolt(colony: Kingdom, metropole: Kingdom, world: CivWorld): void {
    colony.colonialStatus = 'AUTONOMOUS_COLONY';
    colony.separatistMovement = 'revolt';
    colony.revoltYear = world.year;
    this.selectColonialLeader(colony, world);
    const declared = world.diplomacy.declareWar(colony.id, metropole.id, world.year, 'Colonial Independence Revolt');
    this.seekColonialSupport(colony, metropole, world);
    chronicle.log(world.year, 'rebellion', `${colony.name} levantou-se contra ${metropole.name} pela independência.`, {
      title: `Revolta de Independência de ${colony.name}`,
      importance: 'legendary', scope: 'international',
      refs: [{ kind: 'kingdom', id: colony.id, name: colony.name }, { kind: 'kingdom', id: metropole.id, name: metropole.name }],
      tags: ['colonisation', 'rebellion', 'independence', 'war'],
      causes: ['O movimento separatista ultrapassou o limiar de confronto aberto.'],
      consequences: [declared ? 'A metrópole iniciou a repressão militar.' : 'A crise entrou em conflito aberto.'],
      threadId: `colonial-independence:${colony.id}`,
      threadTitle: `Independência de ${colony.name}`
    });
    events.emit('colonialRevolt', { colony, metropole, year: world.year });
  }

  /** Allies answer with real treasury aid and the existing alliance mechanism. */
  private seekColonialSupport(colony: Kingdom, metropole: Kingdom, world: CivWorld): void {
    const colonialBackers = new Set<string>(colony.knownKingdoms);
    for (const alliance of world.diplomacy.alliances.values()) {
      if (alliance.members.has(colony.id)) for (const id of alliance.members) colonialBackers.add(id);
      if (alliance.members.has(metropole.id)) for (const id of alliance.members) colonialBackers.add(id);
    }
    for (const id of colonialBackers) {
      if (id === colony.id || id === metropole.id) continue;
      const power = world.kingdoms.get(id);
      if (!power) continue;
      const supportsColony = world.diplomacy.getRelation(power.id, colony.id) >= 25 && world.diplomacy.getRelation(power.id, metropole.id) < 25;
      const recipient = supportsColony ? colony : metropole;
      const aid = Math.min(30, Math.max(0, power.economy.treasury * 0.035));
      if (aid <= 0) continue;
      power.economy.treasury -= aid;
      recipient.economy.treasury += aid;
      if (supportsColony) {
        colony.foreignSupport = clamp(colony.foreignSupport + aid / 180, 0, 1);
        world.diplomacy.createAlliance(colony.id, power.id, `Liga de ${colony.name}`, world.year);
      }
      chronicle.log(world.year, 'diplomacy', `${power.name} enviou apoio a ${recipient.name} durante a crise colonial.`, {
        title: `Apoio Externo a ${recipient.name}`,
        importance: 'notable', scope: 'international',
        refs: [{ kind: 'kingdom', id: power.id, name: power.name }, { kind: 'kingdom', id: recipient.id, name: recipient.name }],
        tags: ['colonisation', 'independence', 'foreign-support'], data: { aid: Math.round(aid) }
      });
    }
  }

  private resolveColonialRevolt(colony: Kingdom, metropole: Kingdom, world: CivWorld): void {
    const years = world.year - (colony.revoltYear ?? world.year);
    const colonialPower = colony.computePower() * (1 + colony.foreignSupport * 0.45);
    const metropolePower = metropole.computePower();
    const independenceCase = clamp(
      colony.colonialIdentity * 0.28 + colony.colonialAutonomy * 0.2 + colony.colonialTension * 0.2 +
      Math.min(1, colonialPower / Math.max(1, metropolePower)) * 0.18 + colony.foreignSupport * 0.18,
      0, 1
    );
    if (years >= 2 && independenceCase >= 0.7) {
      this.grantColonialIndependence(colony, metropole, world, false);
      return;
    }
    if (years >= 3 && metropolePower > colonialPower * 2.25 && colony.foreignSupport < 0.2) {
      world.diplomacy.settleWar(colony.id, metropole.id, world.year, 'victory', metropole.id, -45, 8);
      colony.colonialStatus = 'COLONY';
      colony.separatistMovement = 'none';
      colony.separatistSince = null;
      colony.revoltYear = null;
      colony.foreignSupport = 0;
      colony.colonialAutonomy = Math.min(colony.colonialAutonomy, 0.38);
      colony.colonialTension = Math.min(colony.colonialTension, 0.45);
      colony.colonialLoyalty = Math.max(colony.colonialLoyalty, 0.48);
      chronicle.log(world.year, 'war', `${metropole.name} reprimiu a revolta em ${colony.name}.`, {
        title: `Repressão da Revolta de ${colony.name}`,
        importance: 'major', scope: 'international',
        refs: [{ kind: 'kingdom', id: metropole.id, name: metropole.name }, { kind: 'kingdom', id: colony.id, name: colony.name }],
        tags: ['colonisation', 'rebellion', 'repression'],
        consequences: ['A administração colonial foi restaurada com autonomia reduzida.']
      });
      events.emit('colonialRevoltSuppressed', { colony, metropole, year: world.year });
    }
  }

  private grantColonialIndependence(colony: Kingdom, metropole: Kingdom, world: CivWorld, peaceful: boolean): void {
    const oldName = colony.name;
    colony.name = this.generateIndependentColonyName(colony, world);
    colony.colonialStatus = 'INDEPENDENT';
    colony.metropoleId = null;
    colony.colonialAccess = null;
    colony.colonialAutonomy = 1;
    colony.colonialLoyalty = 0;
    colony.colonialTension = peaceful ? 0.28 : 0.72;
    colony.colonialIdentity = 1;
    colony.separatistMovement = 'none';
    colony.separatistSince = null;
    colony.revoltYear = null;
    metropole.removeColony(colony.id);
    for (const cityId of colony.cityIds) {
      const city = world.cities.get(cityId);
      if (city) this.refreshCityArchitecture(city, colony, world);
    }
    this.selectColonialLeader(colony, world);

    const governments = colony.research.unlockedGovernments();
    if (governments.includes('republic')) colony.adoptGovernment('republic', world.year);
    const agreement = world.trade.getAgreement(colony.id, metropole.id);
    if (peaceful && agreement) {
      agreement.tariff = Math.max(0.02, (colony.tariffRate() + metropole.tariffRate()) / 2);
      for (const route of world.trade.routesFor(colony.id)) {
        if ((route.fromKingdomId === colony.id && route.toKingdomId === metropole.id) || (route.fromKingdomId === metropole.id && route.toKingdomId === colony.id)) {
          route.colonialRoute = false;
          route.colonialDirection = undefined;
        }
      }
      world.diplomacy.setRelation(colony.id, metropole.id, 25);
    } else {
      world.trade.cancelAgreement(colony.id, metropole.id, world.year, 'independence war');
      world.diplomacy.settleWar(colony.id, metropole.id, world.year, 'independence', colony.id, -65, 10);
    }
    chronicle.log(world.year, 'kingdom', `${oldName} tornou-se ${colony.name}, um reino independente.`, {
      title: `Independência de ${colony.name}`,
      importance: 'legendary', scope: 'international',
      refs: [{ kind: 'kingdom', id: colony.id, name: colony.name }, { kind: 'kingdom', id: metropole.id, name: metropole.name }],
      tags: ['colonisation', 'independence', peaceful ? 'peaceful' : 'war'],
      consequences: ['Cidades, população, território, economia e diplomacia da antiga colônia continuam no novo reino.'],
      threadId: `colonial-independence:${colony.id}`,
      threadTitle: `Independência de ${colony.name}`,
      data: { peaceful }
    });
    events.emit('colonyIndependent', { colony, metropole, peaceful, year: world.year });
  }

  private generateIndependentColonyName(colony: Kingdom, world: CivWorld): string {
    const root = colony.name.replace(/^Colônia\s+/i, '').replace(/^Colony\s+of\s+/i, '') || colony.name;
    const title = colony.research.unlockedGovernments().includes('republic') ? 'República de' : 'Estado Livre de';
    for (let suffix = 0; suffix < 12; suffix++) {
      const candidate = suffix === 0 ? `${title} ${root}` : `${title} ${root} ${suffix + 1}`;
      if (![...world.kingdoms.values()].some(realm => realm.id !== colony.id && realm.name === candidate)) return candidate;
    }
    return `${title} ${root} ${world.year}`;
  }

  private selectColonialLeader(colony: Kingdom, world: CivWorld): void {
    const preferred = world.entities.find(entity => entity.cityId === colony.capitalCityId && (entity.profession === 'leader' || entity.profession === 'king'))
      ?? world.entities.find(entity => entity.cityId === colony.capitalCityId && !entity.isChild);
    if (!preferred) return;
    preferred.profession = 'king';
    preferred.kingdomId = colony.id;
    colony.rulerId = preferred.id;
  }

  // ============================================================
  // REBELLIONS, CIVIL WARS & SECESSION
  // ============================================================

  /**
   * Distant, starved or unstable settlements under heavy war weariness secede
   * to form independent break-away realms, causing realistic imperial collapse.
   */
  private tickRebellions(world: CivWorld): void {
    if (world.year < 15) return;

    for (const kingdom of [...world.kingdoms.values()]) {
      if (kingdom.isColony) continue;
      if (kingdom.cityIds.size <= 1) continue; // Single-city realms cannot split
      if (
        kingdom.economy.stability > 0.42 &&
        kingdom.warWeariness < 60 &&
        kingdom.legitimacy > 0.38 &&
        kingdom.administrativeReach > 0.42
      ) continue;

      const capital = world.cities.get(kingdom.capitalCityId);
      if (!capital) continue;

      // Check non-capital cities for secession
      for (const cityId of [...kingdom.cityIds]) {
        if (cityId === kingdom.capitalCityId) continue;
        const city = world.cities.get(cityId);
        if (!city) continue;

        // Distance from capital increases rebellion risk
        const distance = Math.hypot(city.x - capital.x, city.y - capital.y);
        const distanceFactor = Math.min(2.5, distance / 25);

        // Famine, low legitimacy and poor administration amplify rebellion risk.
        const famineRisk = city.famineYears * 0.25;
        const frontierPressure =
          kingdom.society.factions.frontier.radicalization * kingdom.society.factions.frontier.influence * 0.42 +
          kingdom.society.factions.reformists.radicalization * kingdom.society.factions.reformists.influence * 0.24;
        const discontent =
          (1 - kingdom.economy.stability) * 0.35 +
          (1 - kingdom.legitimacy) * 0.25 +
          (1 - kingdom.administrativeReach) * 0.2 +
          kingdom.society.revoltRisk * 0.25 +
          frontierPressure +
          (1 - kingdom.culture.authority) * 0.08 +
          kingdom.culture.warTrauma * 0.1 +
          famineRisk +
          (kingdom.warWeariness / 100) * (0.18 + kingdom.culture.militarism * 0.08);

        const rebellionChance = 0.04 * distanceFactor * discontent;

        if (rng.chance(rebellionChance)) {
          // Secession! The city breaks away and forms a new independent realm
          const rebelKingdomId = nextId('king');
          const rebelColor = getNextKingdomColor();
          const rebelName = `Estado Livre de ${city.name}`;

          const rebelKingdom = new Kingdom(
            rebelKingdomId,
            rebelName,
            city.species,
            rebelColor,
            city.id,
            world.year
          );
          // A seceding city keeps everything it already knows. Breaking away from
          // an industrial empire must not send a city back to the Stone Age.
          rebelKingdom.research.deserialize(kingdom.research.serialize());
          rebelKingdom.research.current = null;
          rebelKingdom.research.progress = 0;

          // It also inherits the money it was already using, freshly renamed.
          if (kingdom.economy.currency) {
            rebelKingdom.economy.currency = {
              ...kingdom.economy.currency,
              name: `${city.name} ${kingdom.economy.currency.name.split(' ').pop()}`,
              foundedYear: world.year,
              supply: Math.max(100, kingdom.economy.currency.supply * 0.15)
            };
          }
          rebelKingdom.economy.treasury = Math.max(50, kingdom.economy.treasury * 0.12);
          kingdom.economy.treasury -= rebelKingdom.economy.treasury;

          // Government follows what the rebels can actually sustain: a republic if
          // they have the political theory for it, otherwise their old order.
          const rebelGovernments = rebelKingdom.research.unlockedGovernments();
          rebelKingdom.adoptGovernment(
            rebelGovernments.includes('republic') ? 'republic' : kingdom.government,
            world.year
          );
          rebelKingdom.name = rebelName;
          rebelKingdom.dynasty = '';
          rebelKingdom.culture = {
            ...kingdom.culture,
            memories: [...kingdom.culture.memories]
          };
          rebelKingdom.culture.authority = clamp(rebelKingdom.culture.authority - 0.16, 0, 1);
          rebelKingdom.culture.openness = clamp(rebelKingdom.culture.openness + 0.08, 0, 1);
          rebelKingdom.culture.tradition = clamp(rebelKingdom.culture.tradition - 0.08, 0, 1);
          rebelKingdom.culture.diplomaticTrust = clamp(rebelKingdom.culture.diplomaticTrust - 0.1, 0, 1);
          rememberCulture(rebelKingdom.culture, 'secession', world.year, 0.9, `A secessão de ${kingdom.name} fundou o novo estado.`);
          rememberCulture(kingdom.culture, 'secession', world.year, 0.7, `${city.name} se separou do reino.`);
          rebelKingdom.society = {
            ...kingdom.society,
            factions: Object.fromEntries(
              Object.entries(kingdom.society.factions).map(([id, faction]) => [id, { ...faction }])
            ) as any
          };
          rebelKingdom.society.factions.frontier.influence = clamp(rebelKingdom.society.factions.frontier.influence + 0.12, 0, 1);
          rebelKingdom.society.factions.frontier.loyalty = 0.78;
          rebelKingdom.society.factions.frontier.satisfaction = 0.62;
          rebelKingdom.society.factions.reformists.influence = clamp(rebelKingdom.society.factions.reformists.influence + 0.08, 0, 1);
          rebelKingdom.society.factions.reformists.loyalty = 0.66;
          rebelKingdom.society.revoltRisk = Math.max(0.06, rebelKingdom.society.revoltRisk * 0.45);
          rebelKingdom.society.cohesion = Math.max(0.48, rebelKingdom.society.cohesion);
          rebelKingdom.legitimacy = 0.55;
          rebelKingdom.foodSecurity = Math.max(0.4, city.prosperity);
          rebelKingdom.administrativeReach = 1;
          kingdom.legitimacy = clamp(kingdom.legitimacy - 0.12, 0, 1);

          // Find leader candidate for rebel state
          const localEntities = world.entities.filter(e => e.cityId === city.id);
          if (localEntities.length > 0) {
            const rebelLeader = rng.pick(localEntities);
            rebelLeader.profession = 'king';
            rebelLeader.kingdomId = rebelKingdomId;
            rebelKingdom.rulerId = rebelLeader.id;
          }

          // Transfer city to new rebel kingdom
          kingdom.removeCity(city.id);
          rebelKingdom.addCity(city.id);
          city.kingdomId = rebelKingdomId;

          // Transfer tile kingdom IDs
          for (const key of city.territory) {
            const [tx, ty] = key.split(',').map(Number);
            const tile = world.tileMap.getTile(tx, ty);
            if (tile) {
              tile.kingdomId = rebelKingdomId;
              world.tileMap.markRenderDirty(tile.x, tile.y);
            }
          }

          world.kingdoms.set(rebelKingdomId, rebelKingdom);

          // The parent kingdom immediately declares war on the rebels!
          world.diplomacy.declareWar(kingdom.id, rebelKingdomId, world.year, 'Secessão e Rebelião');

          chronicle.log(
            world.year,
            'rebellion',
            `Rebelião em ${kingdom.name}! ${city.name} se separou e proclamou o ${rebelName}. Irrompe a guerra civil!`,
            {
              title: `A Secessão de ${city.name}`,
              importance: 'legendary',
              scope: 'international',
              refs: [
                { kind: 'city', id: city.id, name: city.name },
                { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
                { kind: 'kingdom', id: rebelKingdom.id, name: rebelKingdom.name }
              ],
              tags: ['rebellion', 'secession', 'guerra civil'],
              causes: ['A pressão da revolta local e alienação política cruzaram o limite para secessão.'],
              consequences: [`${rebelKingdom.name} surgiu como um estado independente e começou uma guerra com ${kingdom.name}.`],
              threadId: `rebellion:${kingdom.id}:${city.id}:${world.year}`,
              threadTitle: `A Rebelião de ${city.name}`
            }
          );
          events.emit('rebellionOccurred', { kingdom, rebelKingdom, city, year: world.year });
          break; // One rebellion per kingdom per year
        }
      }
    }
  }

  // ============================================================
  // CARAVAN BANDITRY & TRADE RAIDS
  // ============================================================

  /**
   * Active trade routes traversing unpoliced territory can be raided by bandits,
   * reducing route efficiency and creating economic tension.
   */
  private tickTradeBanditry(world: CivWorld): void {
    if (world.trade.routes.size === 0) return;

    for (const route of world.trade.routes.values()) {
      if (!route.active) continue;

      const fromCity = world.cities.get(route.fromCityId);
      const toCity = world.cities.get(route.toCityId);
      if (!fromCity || !toCity) continue;

      const distance = Math.hypot(fromCity.x - toCity.x, fromCity.y - toCity.y);
      const raidChance = Math.min(0.2, (distance / 60) * 0.1);

      if (rng.chance(raidChance)) {
        route.volume = Math.max(2, Math.floor(route.volume * 0.6));
        if (rng.chance(0.3)) {
          chronicle.log(
            world.year,
            'disaster',
            `Bandidos atacaram a rota comercial ${route.kind} entre ${fromCity.name} e ${toCity.name}.`
          );
        }
      } else if (route.volume < route.maxVolume) {
        // A year of peace lets commerce rebuild toward its original capacity.
        route.volume = Math.min(route.maxVolume, route.volume + 2);
      }
    }
  }

  private closestRealmDistance(k1: Kingdom, k2: Kingdom, world: CivWorld): number {
    let minDist = Infinity;
    for (const c1Id of k1.cityIds) {
      const c1 = world.cities.get(c1Id);
      if (!c1) continue;
      for (const c2Id of k2.cityIds) {
        const c2 = world.cities.get(c2Id);
        if (!c2) continue;
        const d = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        if (d < minDist) minDist = d;
      }
    }
    return minDist === Infinity ? 100 : minDist;
  }

  // ============================================================
  // ROUTE TYPE DETERMINATION (connectivity, not distance)
  // ============================================================

  /**
   * Decide whether a trade route between two cities should be overland or maritime.
   *
   * Uses real pathfinding:
   *  - If a land path exists between the city centres → 'overland'
   *  - If no land path, but the cities each have a coastal port tile and a sea
   *    path exists between those ports, pick the first coastal tile from each city
   *    and route 'maritime'
   *  - 2b: If both exist and the sea path is >40% shorter, prefer 'maritime'
   *  - Returns null if no path exists at all (cities are unreachable).
   */
  private determineRouteKind(
    from: City, to: City, tileMap: TileMap, landPath?: { x: number; y: number }[]
  ): 'overland' | 'maritime' | null {
    const landPathComputed = landPath ?? SimplePathfinder.findPath(from.x, from.y, to.x, to.y, tileMap, 'land');
    const landDist = landPathComputed.length > 1
      ? landPathComputed.reduce((sum, _, i, arr) => i > 0 ? sum + Math.hypot(arr[i].x - arr[i - 1].x, arr[i].y - arr[i - 1].y) : 0, 0)
      : Infinity;

    // Sea trade is infrastructure, not a free property of living near water.
    const fromPort = this.findCityPortWaterTile(from, tileMap);
    const toPort = this.findCityPortWaterTile(to, tileMap);
    let seaDist = Infinity;
    if (fromPort && toPort) {
      const seaPath = SimplePathfinder.findPath(fromPort.x, fromPort.y, toPort.x, toPort.y, tileMap, 'sea');
      if (seaPath.length > 1) {
        seaDist = seaPath.reduce((sum, _, i, arr) => i > 0 ? sum + Math.hypot(arr[i].x - arr[i - 1].x, arr[i].y - arr[i - 1].y) : 0, 0);
      }
    }

    if (landPathComputed.length > 1 && seaDist === Infinity) return 'overland';
    if (landPathComputed.length <= 1 && seaDist < Infinity) return 'maritime';
    if (landPathComputed.length <= 1 && seaDist === Infinity) return null;
    return seaDist < landDist * 0.72 ? 'maritime' : 'overland';
  }

  private findCityPortWaterTile(city: City, tileMap: TileMap): { x: number; y: number } | null {
    const facilities = [...city.buildings.values()]
      .filter(b => (b.type === 'port' || b.type === 'harbor') && b.hp / b.maxHp > 0.5)
      .sort((a, b) => (a.type === 'port' ? -1 : 1));
    for (const facility of facilities) {
      const water = tileMap.getNeighbors(facility.x, facility.y, true)
        .filter(tile => TERRAINS[tile.type].isWater)
        .sort((a, b) => (a.type === TerrainType.DEEP_OCEAN ? -1 : 0) - (b.type === TerrainType.DEEP_OCEAN ? -1 : 0));
      if (water.length) return { x: water[0].x + 0.5, y: water[0].y + 0.5 };
    }
    return null;
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  /** Realms that lost every settlement cease to exist. */
  private cleanupDeadRealms(world: CivWorld): void {
    for (const [id, kingdom] of [...world.kingdoms]) {
      // Drop references to settlements that are gone.
      for (const cityId of [...kingdom.cityIds]) {
        if (!world.cities.has(cityId)) kingdom.removeCity(cityId);
      }
      if (kingdom.cityIds.size > 0) continue;

      chronicle.log(
        world.year,
        'conquest',
        `${kingdom.name} caiu. Seu último assentamento não existe mais.`,
        {
          title: `Queda de ${kingdom.name}`,
          importance: 'legendary',
          scope: 'world',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['queda de um reino', 'extinction', 'conquest'],
          causes: ['O reino perdeu seu último assentamento sobrevivente.'],
          consequences: ['O reino deixou de existir como um estado independente.']
        }
      );
      events.emit('kingdomFell', { kingdom, year: world.year });

      // Release vassals and detach from any overlord.
      for (const vassalId of kingdom.vassalIds) {
        const vassal = world.kingdoms.get(vassalId);
        if (vassal) vassal.overlordId = null;
      }
      if (kingdom.overlordId) {
        world.kingdoms.get(kingdom.overlordId)?.vassalIds.delete(id);
      }
      if (kingdom.metropoleId) world.kingdoms.get(kingdom.metropoleId)?.removeColony(id);
      for (const colonyId of kingdom.colonyIds) {
        const colony = world.kingdoms.get(colonyId);
        if (colony?.metropoleId === id) {
          colony.metropoleId = null;
          colony.colonialStatus = 'INDEPENDENT';
          colony.colonialAccess = null;
        }
      }
      for (const other of world.kingdoms.values()) other.knownKingdoms.delete(id);

      world.kingdoms.delete(id);
    }
  }
}
