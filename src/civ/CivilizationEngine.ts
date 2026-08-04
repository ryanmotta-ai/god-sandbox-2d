import { City, SETTLEMENT_TIERS } from './City';
import { Kingdom, getNextKingdomColor } from './Kingdom';
import { Building, BuildingType, BUILDINGS, BASE_BUILDINGS } from './Building';
import {
  GoodId, GOODS, ALL_GOODS, RAW_GOODS, CRAFTED_GOODS, STRATEGIC_GOODS,
  productionRecipesFor
} from './Goods';
import { TECHNOLOGIES, TechDefinition, techCost, strategicGoodsFor, technologyCapacity, operatingEra } from './TechTree';
import { GOVERNMENTS, chooseGovernment, isRevolution, GovernmentType } from './Government';
import { WorldMarket, mintCurrency } from './Economy';
import { TradeNetwork } from './Trade';
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
  /** Set once a realm first mints money, so the chronicle only says it once. */
  private announcedCurrencies: Set<string> = new Set();
  /** Maritime routes currently blocked by ruined ports, so a collapse is chronicled once. */
  private collapsedRoutes: Set<string> = new Set();

  public reset(): void {
    this.announcedCurrencies.clear();
  }

  // ============================================================
  // MAIN YEARLY TICK
  // ============================================================

  public tickYear(world: CivWorld): void {
    // Population is derived from the entities that actually exist, so births,
    // deaths and migration can never drift out of sync with the map.
    this.recountPopulations(world);

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
    this.tickTrade(world);
    // Rail freight runs after trade settles so imports land in the same ledger
    // year as the exports that paid for them; next year's smithy burns the coal.
    world.sim?.railways.tickRailways(world);
    this.tickVassalage(world);
    this.tickColonisation(world);
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

    this.produceGoods(city, world, productionMult);
    this.consumeGoods(city, world);
    this.runConstruction(city, world, kingdom);
    this.repairCityInfrastructure(city, world);
    this.expandTerritory(city, world, techMods.territory + (gov?.expansion ?? 8) + expansionCulture + (lawEffects?.expansion ?? 0));

    city.researchOutput = this.computeResearch(city) * researchMult;
    city.updateTier();
  }

  /** Buildings turn real labour, deposits and recipe inputs into goods. */
  private produceGoods(city: City, world: CivWorld, multiplier: number): void {
    const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) ?? null : null;

    // A city's economic workforce is made from real adult humanoid entities. Combat
    // specialists and rulers remain available to their own systems rather than being
    // silently counted as factory hands.
    const labourPool = world.entities.filter(e =>
      e.cityId === city.id &&
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

    const staffed = [...city.buildings.values()].sort((a, b) => priority(b) - priority(a));
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
      // Starvation kills. The population falls until it matches the food supply.
      const starved = Math.ceil(city.population * (1 - satisfaction) * 0.35);
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
    for (const entity of world.entities) {
      if (!entity.cityId) continue;
      if (!SPECIES_DEFINITIONS[entity.species].isHumanoid) continue;
      counts.set(entity.cityId, (counts.get(entity.cityId) ?? 0) + 1);
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
      if (tile && tile.cityId === city.id) tile.kingdomId = occupier.id;
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
      if (!city.hasFreeBuildingSlot()) break;
      const built = this.constructBuilding(city, world, kingdom);
      if (!built) {
        this.tryUpgradeBuilding(city);
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
    const tile = world.tileMap.getTile(pick.spot.x, pick.spot.y)!;
    tile.buildingId = building.id;
    tile.cityId = city.id;
    if (city.kingdomId) tile.kingdomId = city.kingdomId;
    city.territory.add(`${pick.spot.x},${pick.spot.y}`);

    // Auto-pave street connecting new building to city hall (dirt unless the
    // kingdom has road-building tech, matching paveTradeRoad below)
    this.paveRoadBetween(city, pick.spot.x, pick.spot.y, world);

    if (def.resourceTargets?.length && pick.spot.resourceGood && def.resourceTargets.includes(pick.spot.resourceGood)) {
      building.extractedGood = pick.spot.resourceGood;
    }

    if (['mine', 'quarry', 'oil_well', 'harbor', 'port', 'academy', 'bank', 'factory', 'refinery', 'palace', 'stock_exchange', 'collective'].includes(pick.type)) {
      const resourceLabel = building.extractedGood ? ` over a ${GOODS[building.extractedGood].name} deposit` : '';
      chronicle.log(world.year, 'founding', `${city.name} completed its ${def.name}${resourceLabel}.`);
    }
    return true;
  }

  /**
   * Paves a street from the city hall to a new building. Follows a surveyed
   * A* route that may bridge shallow water — no more random zigzagging, no
   * more streets dying at a riverbank. Stone paving requires the road/masonry
   * techs, exactly like paveTradeRoad; a pre-tech settlement surveys a dirt
   * trail (and a timber bridge over shallows) instead.
   */
  private paveRoadBetween(fromCity: City, toX: number, toY: number, world: CivWorld): void {
    const path = SimplePathfinder.findPath(fromCity.x, fromCity.y, toX, toY, world.tileMap, 'road', 800);
    if (path.length === 0) return;
    const kingdom = fromCity.kingdomId ? world.kingdoms.get(fromCity.kingdomId) : null;
    const hasStone = !!(kingdom?.research.knows('roads') || kingdom?.research.knows('masonry'));
    const level = hasStone ? 2 : 1;
    for (const step of path) {
      const tile = world.tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
      if (!tile) continue;
      if (tile.roadLevel < level) tile.roadLevel = level;
      tile.roadTraffic = Math.max(tile.roadTraffic, 35);
    }
  }

  /**
   * Paves the first route between two trading cities the moment a trade
   * agreement opens, so roads appear on the map as real, visible connections
   * instead of emerging only after decades of caravan wheels. Stone roads
   * require the road-building tech; otherwise a dirt trail is surveyed.
   * Returns the surveyed path so the route can remember what it crosses.
   */
  private paveTradeRoad(fromCity: City, toCity: City, world: CivWorld): { x: number; y: number }[] {
    const path = SimplePathfinder.findPath(fromCity.x, fromCity.y, toCity.x, toCity.y, world.tileMap, 'road');
    if (path.length === 0) return path;
    const fromKingdom = fromCity.kingdomId ? world.kingdoms.get(fromCity.kingdomId) : null;
    const hasStone = !!(fromKingdom?.research.knows('roads') || fromKingdom?.research.knows('masonry'));
    const level = hasStone ? 2 : 1;
    for (const step of path) {
      const tile = world.tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
      if (!tile) continue;
      if (tile.roadLevel < level) tile.roadLevel = level;
      tile.roadTraffic = Math.max(tile.roadTraffic, 60);
    }
    return path;
  }

  /** Repairs buildings and roads damaged in war, spending real materials. */
  private repairCityInfrastructure(city: City, world: CivWorld): void {
    repairInfrastructure(city, world.tileMap);
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

    if (type === 'harbor') {
      score += population >= 18 ? 70 : 20;
      if (kingdom?.culture.mercantilism && kingdom.culture.mercantilism > 0.58) score += 28;
    }
    if (type === 'port') {
      if (!city.hasBuilding('harbor')) return 0;
      score += population >= 45 ? 95 : 20;
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

  private tryUpgradeBuilding(city: City): void {
    const upgradable = [...city.buildings.values()].filter(b => b.level < 3 && city.stock.hasAll(b.upgradeCost()));
    if (upgradable.length === 0) return;
    const target = upgradable.sort((a, b) => (b.definition.jobs ?? 0) - (a.definition.jobs ?? 0))[0];
    const cost = target.upgradeCost();
    if (city.stock.spend(cost)) {
      for (const [good, amount] of Object.entries(cost)) {
        city.ledger.recordConsumed(good as GoodId, amount as number);
      }
      target.upgrade();
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

  private findBuildingSite(
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
      if (city.kingdomId) tile.kingdomId = city.kingdomId;
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
    const citizens = world.entities.filter(e => e.cityId === city.id);
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
    if (kingdom.research.progress < techCost(tech)) return;

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
      let score = 1000 / Math.max(1, techCost(tech));

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
    let workers = 0;
    for (const e of world.entities) {
      if (e.kingdomId !== kingdom.id || e.hp <= 0) continue;
      if (!SPECIES_DEFINITIONS[e.species].isHumanoid || e.isChild) continue;
      workers++;
    }

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
        `Bread riots shook ${kingdom.name} as hungry peasants forced open local granaries.`,
        {
          title: `Bread Riots in ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'peasants'],
          causes: ['Hunger, low peasant satisfaction and high radicalisation converged.'],
          consequences: ['Stability and legitimacy fell as peasants forced open granaries.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Unrest in ${kingdom.name}`
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
          title: `Noble Conspiracy in ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'nobles'],
          causes: ['Influential nobles became dissatisfied and radicalised.'],
          consequences: ["The ruler's legitimacy was weakened by elite opposition."],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Unrest in ${kingdom.name}`
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
        `Merchant houses in ${kingdom.name} moved capital out of reach of the treasury.`,
        {
          title: `Capital Flight in ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'merchants'],
          causes: ['Merchant dissatisfaction coincided with tax or trade pressure.'],
          consequences: ['Treasury reserves and stability declined.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Unrest in ${kingdom.name}`
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
        `Officers in ${kingdom.name} issued a public warning to the court over the state of the army.`,
        {
          title: `Military Warning in ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'military'],
          causes: ['Military dissatisfaction and coup risk reached a dangerous level.'],
          consequences: ['The court lost stability and legitimacy.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Unrest in ${kingdom.name}`
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
        `Guilds and workshops in ${kingdom.name} slowed production in protest.`,
        {
          title: `Industrial Protest in ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'workers'],
          causes: ['Worker dissatisfaction rose inside an industrialising economy.'],
          consequences: ['Production slowed and the treasury lost revenue.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Unrest in ${kingdom.name}`
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
        `Reformist circles in ${kingdom.name} circulated manifestos calling for a new political order.`,
        {
          title: `Reformist Manifestos in ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'reformists'],
          causes: ['Reform pressure and reformist influence became politically visible.'],
          consequences: ['Calls for a new political order weakened legitimacy.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Unrest in ${kingdom.name}`
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
        `Frontier towns in ${kingdom.name} demanded autonomy from the capital.`,
        {
          title: `Frontier Autonomy Crisis in ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['society', 'unrest', 'frontier'],
          causes: ['Weak administrative reach met dissatisfaction on the frontier.'],
          consequences: ['Autonomy demands increased instability in the realm.'],
          threadId: `unrest:${kingdom.id}:${world.year}`,
          threadTitle: `Unrest in ${kingdom.name}`
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
      `${kingdom.name} reformed ${decision.law.category.replace('_', ' ')} law: ${decision.current.name} gave way to ${decision.law.name}.`,
      {
        title: `${decision.law.name} Reform`,
        importance: decision.pressure >= 0.7 ? 'major' : 'notable',
        scope: 'kingdom',
        refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
        tags: ['law', decision.law.category, 'reform'],
        causes: [`Political reform pressure reached ${Math.round(decision.pressure * 100)}%.`],
        consequences: [
          `${decision.current.name} was replaced by ${decision.law.name}.`,
          ...(tense ? ['At least one influential social faction reacted with greater dissatisfaction and radicalisation.'] : [])
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
      rememberCulture(kingdom.culture, 'revolution', world.year, 0.85, 'A revolution changed the social order.');
      chronicle.log(
        world.year,
        'revolution',
        `Revolution in ${previousName}! The ${previousGovernment.toLowerCase()} is overthrown and a ${newGov.name.toLowerCase()} is proclaimed as ${kingdom.name}.`,
        {
          title: `The Revolution of ${world.year}`,
          importance: 'legendary',
          scope: 'kingdom',
          refs: [
            { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
            ...(ruler ? [{ kind: 'person' as const, id: ruler.id, name: ruler.title || ruler.name }] : [])
          ],
          tags: ['revolution', 'government', previousGovernment, newGov.name],
          causes: ['Accumulated political and social pressure made the old political order unsustainable.'],
          consequences: [
            `${previousGovernment} government ended and ${newGov.name} government began.`,
            'State stability and treasury reserves were sharply reduced.'
          ],
          threadId: `revolution:${kingdom.id}:${world.year}`,
          threadTitle: `The Revolution of ${kingdom.name}`,
          data: { from: previousGovernment, to: newGov.name }
        }
      );
      if (ruler && rng.chance(0.6)) {
        ruler.hp = 0;
        chronicle.log(
          world.year,
          'succession',
          `${ruler.name} did not survive the revolution.`,
          {
            title: `Death of ${ruler.title || ruler.name}`,
            importance: 'major',
            scope: 'person',
            refs: [
              { kind: 'person', id: ruler.id, name: ruler.title || ruler.name },
              { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
            ],
            tags: ['ruler', 'death', 'revolution'],
            causes: ['The ruler was killed during the revolution.'],
            threadId: `revolution:${kingdom.id}:${world.year}`,
            threadTitle: `The Revolution of ${kingdom.name}`
          }
        );
      }
    } else {
      kingdom.economy.stability = Math.min(1, kingdom.economy.stability + 0.1);
      kingdom.legitimacy = clamp(kingdom.legitimacy + 0.04, 0, 1);
      chronicle.log(
        world.year,
        'kingdom',
        `${previousName} reorganised itself as a ${newGov.name.toLowerCase()}, becoming ${kingdom.name}.`,
        {
          title: `Government Reorganisation`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['government', 'reorganisation', newGov.name],
          causes: ['Political institutions adapted to the realm’s current military, social and economic pressures.'],
          consequences: [`${newGov.name} became the governing order of ${kingdom.name}.`],
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
          `${a.name} and ${b.name} made first contact.`,
          {
            title: `First Contact: ${a.name} & ${b.name}`,
            importance: 'major',
            scope: 'international',
            refs: [
              { kind: 'kingdom', id: a.id, name: a.name },
              { kind: 'kingdom', id: b.id, name: b.name }
            ],
            tags: ['first contact', 'diplomacy'],
            consequences: ['Both realms entered one another’s known diplomatic world.']
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
            const name = sameSpecies ? `League of ${world.year}` : `Concord of ${world.year}`;
            world.diplomacy.createAlliance(a.id, b.id, name, world.year);
            chronicle.log(
              world.year,
              'diplomacy',
              `${a.name} and ${b.name} formed the ${name}.`,
              {
                title: name,
                importance: 'major',
                scope: 'international',
                refs: [
                  { kind: 'kingdom', id: a.id, name: a.name },
                  { kind: 'kingdom', id: b.id, name: b.name }
                ],
                tags: ['alliance', 'diplomacy', 'peace'],
                consequences: [`${a.name} and ${b.name} entered a formal alliance.`],
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
      rememberCulture(victor.culture, 'victory', world.year, 0.7, `Victory over ${loser.name} strengthened national pride.`);
      rememberCulture(loser.culture, 'defeat', world.year, 0.75, `Defeat by ${victor.name} scarred public memory.`);
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
      ? `${victor.name} forced ${loser!.name} to accept peace after ${duration} years of war.`
      : `${a.name} and ${b.name} accepted an exhausted peace after ${duration} years of war.`;
    chronicle.log(
      world.year,
      'peace',
      text,
      {
        title: victor ? `Peace after the ${war.reason}` : `The Exhausted Peace`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'kingdom', id: a.id, name: a.name },
          { kind: 'kingdom', id: b.id, name: b.name },
          { kind: 'war', id: war.id, name: war.reason }
        ],
        tags: ['war', 'peace', settlement],
        causes: [victor ? 'One side achieved a decisive advantage under mounting exhaustion.' : 'Both realms accumulated enough exhaustion to accept peace.'],
        consequences: [victor && loser ? `${victor.name} gained reparations and legitimacy while ${loser.name} lost both.` : 'Both realms ended the conflict with lingering war weariness.'],
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
    world.trade.pruneRoutes(id => world.cities.has(id));
    world.trade.updateRouteStatus((a, b) => world.diplomacy.isAtWar(a, b));

    this.negotiateTradeAgreements(world);
    this.openTradeRoutes(world);
    this.runTradeRoutes(world);
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
            `Trade between ${a.name} and ${b.name} collapsed with the outbreak of war.`,
            {
              title: `Trade Collapse between ${a.name} and ${b.name}`,
              importance: 'major',
              scope: 'international',
              refs: [
                { kind: 'kingdom', id: a.id, name: a.name },
                { kind: 'kingdom', id: b.id, name: b.name }
              ],
              tags: ['trade', 'war', 'commerce'],
              causes: ['War made the existing trade agreement impossible to maintain.'],
              consequences: ['Commercial exchange between the two realms was suspended.']
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
            `${a.name} and ${b.name} signed a trade agreement.`,
            {
              title: `Trade Agreement: ${a.name}–${b.name}`,
              importance: 'notable',
              scope: 'international',
              refs: [
                { kind: 'kingdom', id: a.id, name: a.name },
                { kind: 'kingdom', id: b.id, name: b.name }
              ],
              tags: ['trade agreement', 'commerce'],
              consequences: ['The two realms could begin opening formal trade routes.'],
              data: { tariff: Number(tariff.toFixed(3)) }
            }
          );
        } else if (relation <= -55 && rng.chance(0.12) && !world.trade.isEmbargoed(a.id, b.id)) {
          world.trade.declareEmbargo(a.id, b.id, world.year, 'diplomatic hostility');
          chronicle.log(
            world.year,
            'economy',
            `${a.name} placed an embargo on ${b.name}.`,
            {
              title: `Embargo of ${b.name}`,
              importance: 'major',
              scope: 'international',
              refs: [
                { kind: 'kingdom', id: a.id, name: a.name },
                { kind: 'kingdom', id: b.id, name: b.name }
              ],
              tags: ['embargo', 'trade', 'hostility'],
              causes: ['Diplomatic hostility crossed the threshold for economic coercion.'],
              consequences: ['Formal trade between the two realms was restricted.']
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
        `A ${kind} trade route opened: ${GOODS[good].name} from ${fromCity.name} to ${toCity.name}.`,
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
          tags: ['trade route', kind, good],
          consequences: [`${GOODS[good].name} began moving regularly between the two settlements.`],
          threadId: `trade:${fromCity.id}:${toCity.id}:${good}`,
          threadTitle: `${GOODS[good].name} Trade between ${fromCity.name} and ${toCity.name}`,
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

          for (const good of ALL_GOODS) {
            const surplus = from.stock.get(good);
            if (surplus < 15) continue;

            // 2a. Intelligent route-type selection via pathfinding
            const landPath = SimplePathfinder.findPath(from.x, from.y, to.x, to.y, world.tileMap, 'land');
            const kind = this.determineRouteKind(from, to, world.tileMap, landPath);
            if (!kind) continue; // Unreachable city pair

            // A route exists because someone profits, not because a stock is large.
            // The seller's realm is cheap in this good and the buyer's is dear; the
            // gap has to survive hauling it and the tariff at the border.
            const worldPrice = world.market.price(good);
            const sellPrice = seller.economy.market.price(good, worldPrice);
            const buyPrice = buyer.economy.market.price(good, worldPrice);

            // Infrastructure sets the economics of the haul: better roads cut the
            // cost per tile, and the route can only carry what the road or ports
            // physically move (0.7× on a dirt trail, 1.0× stone, 1.3× imperial).
            const capacity = kind === 'maritime'
              ? portCapacityFactor(from, to)
              : roadCapacityFactor(landPath, world.tileMap);
            const avgRoad = kind === 'maritime' ? 1.5 : avgEffectiveRoadLevel(landPath, world.tileMap);
            const transport = kind === 'maritime'
              ? worldPrice * distance * 0.003
              : worldPrice * distance * 0.004 * (1.5 - 0.3 * avgRoad);
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
      if (!route.active) continue;

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
              tags: ['trade collapse', 'infrastructure', 'port'],
              causes: ['A harbor or port was destroyed or fell below half strength.'],
              consequences: [`Imports and exports through ${from.name}–${to.name} stopped.`]
            }
          );
        }
        continue;
      }
      this.collapsedRoutes.delete(route.id);

      const shipped = from.stock.take(route.good, route.volume * capacity);
      if (shipped <= 0) continue;
      const delivered = to.stock.add(route.good, shipped);

      // Anything that couldn't be unloaded goes back on the cart.
      if (delivered < shipped) from.stock.add(route.good, shipped - delivered);

      from.ledger.recordExported(route.good, delivered);
      to.ledger.recordImported(route.good, delivered);

      const value = delivered * world.market.price(route.good);
      world.market.reportDemand(route.good, delivered);
      world.trade.recordTrade(route, value);

      // Revenue lands once a year, in the same currency the goods were valued
      // at, and only for goods that actually crossed the border. It used to be
      // paid on every caravan/ship arrival — tens of round trips a year per
      // route — multiplied by a solvency check that inflated revenue whenever
      // the buyer had any gold stock, so a few routes minted hundreds of
      // thousands of gold for a realm of twenty people.
      sellerKingdom.exportVolume += value;
      sellerKingdom.economy.treasury += value;
      sellerKingdom.treasury.add('gold', value);
      if (buyerKingdom.id !== sellerKingdom.id) {
        const tariff = value * buyerKingdom.tariffRate();
        buyerKingdom.tariffRevenue += tariff;
        buyerKingdom.economy.treasury += tariff;
        buyerKingdom.treasury.add('gold', tariff);
        buyerKingdom.importVolume += value;
      }

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
      if (!overlord.research.knowsFeature('diplomacy_pacts')) continue;
      if (overlord.overlordId) continue; // A vassal cannot hold vassals

      for (const candidateId of overlord.knownKingdoms) {
        const candidate = world.kingdoms.get(candidateId);
        if (!candidate || candidate.overlordId || candidate.vassalIds.size > 0) continue;
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
          `${candidate.name} swore fealty to ${overlord.name} and became its vassal.`
        );
        events.emit('vassalageSworn', { overlord, vassal: candidate, year: world.year });
        break;
      }
    }

    // Vassals send tribute to their overlord each year.
    for (const vassal of kingdoms) {
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
        rememberCulture(vassal.culture, 'secession', world.year, 0.75, `Independence from ${overlord.name} became a founding memory.`);
        rememberCulture(overlord.culture, 'secession', world.year, 0.65, `${vassal.name} broke from imperial control.`);
        const declared = world.diplomacy.declareWar(vassal.id, overlord.id, world.year, 'Independence Revolt');
        if (declared) {
          chronicle.log(
            world.year,
            'war',
            `${vassal.name} renounced fealty to ${overlord.name} and began an independence war.`
          );
        } else {
          chronicle.log(world.year, 'kingdom', `${vassal.name} slipped from ${overlord.name}'s control.`);
        }
        events.emit('vassalageBroken', { overlord, vassal, year: world.year });
      }
    }
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

      const tile = world.tileMap.getTile(site.x, site.y)!;
      tile.cityId = colony.id;
      tile.kingdomId = kingdom.id;
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
        `Settlers from ${city.name} founded ${colony.name} in the name of ${kingdom.name}.`,
        {
          title: `Founding of ${colony.name}`,
          importance: 'major',
          scope: 'city',
          refs: [
            { kind: 'city', id: colony.id, name: colony.name },
            { kind: 'city', id: city.id, name: city.name },
            { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
          ],
          tags: ['colonisation', 'founding', 'settlers'],
          causes: [`${city.name} had the population, food and housing pressure to send settlers outward.`],
          consequences: [`${kingdom.name} gained a new settlement.`],
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
  // REBELLIONS, CIVIL WARS & SECESSION
  // ============================================================

  /**
   * Distant, starved or unstable settlements under heavy war weariness secede
   * to form independent break-away realms, causing realistic imperial collapse.
   */
  private tickRebellions(world: CivWorld): void {
    if (world.year < 15) return;

    for (const kingdom of [...world.kingdoms.values()]) {
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
          const rebelName = `Free State of ${city.name}`;

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
          rememberCulture(rebelKingdom.culture, 'secession', world.year, 0.9, `Secession from ${kingdom.name} founded the new state.`);
          rememberCulture(kingdom.culture, 'secession', world.year, 0.7, `${city.name} seceded from the realm.`);
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
            if (tile) tile.kingdomId = rebelKingdomId;
          }

          world.kingdoms.set(rebelKingdomId, rebelKingdom);

          // The parent kingdom immediately declares war on the rebels!
          world.diplomacy.declareWar(kingdom.id, rebelKingdomId, world.year, 'Secession & Rebellion');

          chronicle.log(
            world.year,
            'rebellion',
            `Rebellion in ${kingdom.name}! ${city.name} seceded and proclaimed the ${rebelName}. Civil war erupts!`,
            {
              title: `The Secession of ${city.name}`,
              importance: 'legendary',
              scope: 'international',
              refs: [
                { kind: 'city', id: city.id, name: city.name },
                { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
                { kind: 'kingdom', id: rebelKingdom.id, name: rebelKingdom.name }
              ],
              tags: ['rebellion', 'secession', 'civil war'],
              causes: ['Local revolt pressure and political alienation crossed the threshold for secession.'],
              consequences: [`${rebelKingdom.name} emerged as an independent state and war began with ${kingdom.name}.`],
              threadId: `rebellion:${kingdom.id}:${city.id}:${world.year}`,
              threadTitle: `The Rebellion of ${city.name}`
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
            `Bandits raided the ${route.kind} trade route between ${fromCity.name} and ${toCity.name}.`
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
        `${kingdom.name} has fallen. Its last settlement is gone.`,
        {
          title: `Fall of ${kingdom.name}`,
          importance: 'legendary',
          scope: 'world',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['fall of a realm', 'extinction', 'conquest'],
          causes: ['The realm lost its final surviving settlement.'],
          consequences: ['The kingdom ceased to exist as an independent state.']
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
      for (const other of world.kingdoms.values()) other.knownKingdoms.delete(id);

      world.kingdoms.delete(id);
    }
  }
}
