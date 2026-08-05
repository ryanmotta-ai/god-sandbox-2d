import { Entity } from '../entities/Entity';
import { SpeciesType, SPECIES_DEFINITIONS } from '../entities/Species';
import { TraitId } from '../entities/Traits';
import { AIState } from '../entities/Needs';
import { TileMap } from '../world/TileMap';
import { TerrainType, TERRAINS } from '../world/Biomes';
import { SpatialHash } from '../core/SpatialHash';
import { City } from '../civ/City';
import { Kingdom, generateKingdomName, getNextKingdomColor } from '../civ/Kingdom';
import { Building, BuildingType, BASE_BUILDINGS } from '../civ/Building';
import { DiplomacyManager } from '../civ/Diplomacy';
import { LEGENDARY_ITEMS, WEAPON_TIERS, ARMOR_TIERS, EQUIPMENT_COST, EQUIPMENT_TECH, EQUIPMENT_TIERS_BY_RANK } from '../entities/Equipment';
import { SimplePathfinder } from './Pathfinding';
import { ParticleManager } from '../renderer/Particles';
import { chronicle } from '../civ/Chronicle';
import { sound } from '../core/SoundSynth';
import { rng, nextId } from '../core/Random';
import { WorldMarket } from '../civ/Economy';
import { TradeNetwork } from '../civ/Trade';
import { GoodId, MINEABLE_GOODS } from '../civ/Goods';
import { tileResourceToGood } from '../world/Tile';
import { events } from '../core/EventBus';
import { CivilizationEngine } from '../civ/CivilizationEngine';
import { canPairWith, formPartnership, conceiveChild, chooseSuccessor, generateDynastyName, DeceasedEntityRecord } from '../civ/Lineage';
import { Household } from '../civ/Household';
import { startingWealthFor } from '../entities/Identity';
import { HUNGER_PER_DAY, HUNGER_SEEK_FOOD, HUNGER_STARVING, ENERGY_EXHAUSTED, MEAL_ADULT, MEAL_CHILD, MEAL_RELIEF } from '../entities/Needs';
import { GOVERNMENTS } from '../civ/Government';
import { WarfareSystem, SIEGE_RADIUS } from '../civ/Warfare';
import { NavalSystem } from '../civ/NavalSystem';
import { CaravanSystem } from '../civ/CaravanSystem';
import { RailwayNetwork } from '../civ/RailwayNetwork';

/**
 * World clock.
 *
 * These two constants set the entire real-time pace of history. Everything in the
 * civilisation layer is expressed per *year*, so changing them rescales how long a
 * year takes to watch without altering a single economic balance value.
 *
 * Two separate things are being balanced here, and they pull in opposite
 * directions. The YEAR has to be short, because civilisation only advances once
 * per year. The DAY has to be long enough that a citizen can actually walk to
 * their workplace, do a shift and get home before dusk — a day too short leaves
 * everyone permanently commuting or asleep, which is exactly what happens if you
 * shorten the year by shortening the day.
 *
 * So the year is made short by having FEW days, not by having fast days.
 *
 * At 60fps, one tick is one frame at speed 1x:
 *   TICKS_PER_DAY  600  -> an in-world day lasts 10s at 1x
 *   TICKS_PER_YEAR 7200 -> a year lasts 2min at 1x, and 12s at 10x
 */
export const TICKS_PER_DAY = 600;
/** In-world days per year — each one reads as a month on the calendar. */
export const DAYS_PER_YEAR = 12;
export const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_YEAR;

/**
 * Tiles moved per tick, per point of species baseSpeed.
 *
 * Sized against the working day: the 08:00-18:00 shift is ~250 ticks, so a
 * citizen must cover roughly 15 tiles in that window to reach a forest or a mine
 * and get back. Too low and nobody ever arrives anywhere before dusk sends them
 * home, and the whole settlement looks like it is sleepwalking.
 */
const MOVE_PER_TICK = 0.055;

const ATTACK_COOLDOWN = 8; // Ticks between attacks
const COMBAT_RANGE = 1.8;
const DETECTION_RANGE = 8;
const FLEE_THRESHOLD = 0.25; // Flee when HP below 25%

export class SimulationEngine {
  public entities: Entity[] = [];
  public deceasedAncestors: Map<string, DeceasedEntityRecord> = new Map();
  public cities: Map<string, City> = new Map();
  public kingdoms: Map<string, Kingdom> = new Map();
  public diplomacy: DiplomacyManager = new DiplomacyManager();
  public spatialHash: SpatialHash<Entity> = new SpatialHash<Entity>(8);

  /** Global price-setting market every realm trades against. */
  public market: WorldMarket = new WorldMarket();
  /** Trade agreements and caravan routes between realms. */
  public trade: TradeNetwork = new TradeNetwork();
  /** Active maritime ships and naval trade routes. */
  public naval: NavalSystem = new NavalSystem();
  /** Active overland caravans. */
  public caravans: CaravanSystem = new CaravanSystem();
  /** Railways: track, freight and AI line construction. Derived from tiles. */
  public railways: RailwayNetwork = new RailwayNetwork();
  /** Family economic units. Keyed by householdId. */
  public households: Map<string, Household> = new Map();
  /** Last map ticked. The daily pass needs terrain but is not handed one. */
  private lastTileMap: TileMap | null = null;
  /** Runs everything slow and structural, once per simulated year. */
  public civ: CivilizationEngine = new CivilizationEngine();
  /** Resolves sieges and transfers cities taken by force. */
  public warfare: WarfareSystem = new WarfareSystem();

  public currentYear: number = 1;
  private yearTickCounter: number = 0;
  public timeOfDay: 'dawn' | 'day' | 'dusk' | 'night' = 'day';

  /** Lifetime counters surfaced by the Statistics screen. */
  public totalBirths: number = 0;
  public totalDeaths: number = 0;

  constructor() {}

  public spawnEntity(species: SpeciesType, x: number, y: number, tileMap?: TileMap, forcedGender?: 'male' | 'female'): Entity {
    let spawnX = x;
    let spawnY = y;
    if (tileMap) {
      const safe = SimplePathfinder.findNearestLand(x, y, tileMap);
      if (safe) {
        spawnX = safe.x;
        spawnY = safe.y;
      }
    }
    const id = nextId('ent');
    const entity = new Entity(id, species, spawnX, spawnY);
    if (forcedGender) {
      entity.gender = forcedGender;
    }
    // Identity: a spawned adult already has a past, so their birth year is behind us.
    entity.birthYear = Math.max(1, this.currentYear - entity.age);

    this.entities.push(entity);
    this.spatialHash.insert(entity);
    this.totalBirths++;

    // Auto assign to existing nearby city of same species
    const nearby = this.spatialHash.queryRadius(spawnX, spawnY, 10);
    for (const other of nearby) {
      if (other.species === species && other.cityId && this.cities.has(other.cityId)) {
        entity.cityId = other.cityId;
        const city = this.cities.get(other.cityId)!;
        city.population++;
        entity.kingdomId = city.kingdomId;
        entity.birthCityId = city.id;
        entity.birthCityName = city.name;
        break;
      }
    }
    return entity;
  }

  // ===================== MAIN TICK =====================
  public tickAI(tileMap: TileMap, particles: ParticleManager): void {
    this.lastTileMap = tileMap;
    // 1. Rebuild spatial hash
    this.spatialHash.clear();
    for (const e of this.entities) this.spatialHash.insert(e);

    // 2. Process each entity
    const deadEntities: Entity[] = [];

    for (const e of this.entities) {
      // Save previous position for facing direction
      e.prevX = e.x;
      e.prevY = e.y;

      // Anti-water safety check: Units MUST NOT walk on water or be inside water
      const currentTile = tileMap.getTile(Math.floor(e.x), Math.floor(e.y));
      if (currentTile && TERRAINS[currentTile.type].isWater) {
        const safe = SimplePathfinder.findNearestLand(e.x, e.y, tileMap);
        if (safe) {
          e.x = safe.x;
          e.y = safe.y;
        }
      }

      // Cooldowns
      if (e.attackCooldown > 0) e.attackCooldown--;
      if (e.aiCooldown > 0) e.aiCooldown--;
      if (e.emoteTimer > 0) {
        e.emoteTimer--;
        if (e.emoteTimer <= 0) e.emote = null;
      }

      // Environmental damage
      if (currentTile) {
        if (currentTile.isOnFire || currentTile.type === TerrainType.LAVA) {
          {
            const dmg = e.traits.has(TraitId.FLAMMABLE) ? 30 : 15;
            e.hp -= dmg;
            particles.spawnDamageNumber(e.x, e.y, dmg);
            // AI: Flee from fire
            if (e.aiState !== 'flee') {
              e.aiState = 'flee';
              e.aiCooldown = 20;
            }
          }
        }
        // Regen trait. Only the living regenerate — otherwise a regenerator
        // heals off the killing blow before the death check ever sees it, and
        // becomes accidentally immortal.
        if (e.hp > 0 && e.traits.has(TraitId.REGENERATOR) && e.hp < e.maxHp) {
          e.hp = Math.min(e.maxHp, e.hp + 2);
        }
      }

      // Death check
      if (e.hp <= 0) { deadEntities.push(e); continue; }

      // Behavior by species type
      const isHumanoid = SPECIES_DEFINITIONS[e.species].isHumanoid;
      if (!isHumanoid) {
        this.tickFauna(e, tileMap, particles);
      } else {
        this.tickHumanoid(e, tileMap, particles);
      }

      // Update facing direction, facing angle & particle trail from movement
      const movedX = e.x - e.prevX;
      const movedY = e.y - e.prevY;
      const distMoved = Math.hypot(movedX, movedY);

      if (distMoved > 0.001) {
        e.facingAngle = Math.atan2(movedY, movedX);
        if (Math.abs(movedX) > 0.003) {
          e.facing = movedX > 0 ? 1 : -1;
        }

        // Particle feedback: footstep dust puffs on dry land
        if (Math.random() < 0.04 && currentTile && !TERRAINS[currentTile.type].isWater) {
          particles.spawnParticle(e.x, e.y + 0.3, 'rgba(180, 150, 110, 0.25)', (Math.random() - 0.5) * 0.04, -0.02, 0.3);
        }

        // Flocking Separation: gentle push so characters walk alongside each other instead of stacking
        if (isHumanoid) {
          const neighbors = this.spatialHash.queryRadius(e.x, e.y, 0.4);
          for (const other of neighbors) {
            if (other.id !== e.id && other.species === e.species && other.hp > 0) {
              const sepDx = e.x - other.x;
              const sepDy = e.y - other.y;
              const sepDist = Math.hypot(sepDx, sepDy);
              if (sepDist > 0.01 && sepDist < 0.38) {
                const push = (0.38 - sepDist) * 0.025;
                const nx = e.x + (sepDx / sepDist) * push;
                const ny = e.y + (sepDy / sepDist) * push;
                const nTile = tileMap.getTile(Math.floor(nx), Math.floor(ny));
                if (nTile && !TERRAINS[nTile.type].isWater && TERRAINS[nTile.type].isWalkable) {
                  e.x = nx;
                  e.y = ny;
                }
              }
            }
          }
        }
      }

      if (distMoved < 0.005 && e.aiState !== 'idle' && e.aiState !== 'heal') {
        e.stuckTicks = (e.stuckTicks || 0) + 1;
        if (e.stuckTicks >= 2) {
          e.stuckTicks = 0;
          const jittered = SimplePathfinder.jitterAround(e.x, e.y, tileMap, SPECIES_DEFINITIONS[e.species].baseSpeed * MOVE_PER_TICK);
          if (jittered) { e.x = jittered.x; e.y = jittered.y; e._jitterFailures++; }
          if ((jittered ? e._jitterFailures : 3) >= 3) {
            e._jitterFailures = 0;
            e.targetX = null;
            e.targetY = null;
            e.aiState = 'idle';
            e.aiCooldown = rng.rangeInt(20, 50);
            const safe = SimplePathfinder.findNearestLand(e.x, e.y, tileMap);
            if (safe) { e.x = safe.x; e.y = safe.y; }
          }
        }
      } else {
        e.stuckTicks = 0;
        e._jitterFailures = 0;
      }
    }

    // Update maritime ships and overland caravans
    this.naval.updateShips(this.trade.routes, this.cities, this.kingdoms, tileMap, particles, this.currentYear);
    this.caravans.updateCaravans(this.trade.routes, this.cities, this.kingdoms, tileMap, particles, this.currentYear);

    // Process deaths
    for (const dead of deadEntities) this.handleEntityDeath(dead, particles);

    // 3. Advance the world clock.
    this.yearTickCounter++;

    // 24-Hour Day Clock & Time of Day Phase
    const currentHour = Math.floor(((this.yearTickCounter % TICKS_PER_DAY) / TICKS_PER_DAY) * 24);

    if (currentHour >= 5 && currentHour < 8) this.timeOfDay = 'dawn';
    else if (currentHour >= 8 && currentHour < 18) this.timeOfDay = 'day';
    else if (currentHour >= 18 && currentHour < 21) this.timeOfDay = 'dusk';
    else this.timeOfDay = 'night';

    // A day turns over. Needs and the household economy run on this cadence — a
    // year is far too coarse for hunger to steer anybody's behaviour.
    if (this.yearTickCounter % TICKS_PER_DAY === 0) this.tickDay();

    if (this.yearTickCounter >= TICKS_PER_YEAR) {
      this.yearTickCounter = 0;
      this.currentYear++;
      this.tickAge();
      this.tickFamilies(tileMap);
      this.tickWildlife(tileMap);
      this.civ.tickYear({
        year: this.currentYear,
        cities: this.cities,
        kingdoms: this.kingdoms,
        entities: this.entities,
        tileMap,
        diplomacy: this.diplomacy,
        market: this.market,
        trade: this.trade,
        spawn: (species, x, y) => this.spawnEntity(species, x, y),
        sim: this
      });
      this.warfare.tickYear({
        year: this.currentYear,
        cities: this.cities,
        kingdoms: this.kingdoms,
        entities: this.entities,
        tileMap,
        diplomacy: this.diplomacy
      });
      this.tickGeopolitics();
      this.musterArmies();
    }
  }

  // ===================== DAILY LIFE (needs + household economy) =====================

  /**
   * One in-world day of ordinary life.
   *
   * Hunger rises, families shop, and anyone with nothing to eat starts to suffer.
   * This is the loop the rest of the citizen simulation hangs off: it is what makes
   * a bad harvest turn into a hungry family, an empty purse and, eventually, a
   * political problem — without any of that being scripted.
   */
  private tickDay(): void {
    for (const household of this.households.values()) {
      household.lastEarned = 0;
      household.lastSpent = 0;
      this.householdShop(household);
    }

    for (const e of this.entities) {
      if (!SPECIES_DEFINITIONS[e.species].isHumanoid || e.hp <= 0) continue;

      // Everyone settled belongs to a family. Without this, anyone who never
      // claimed a house had no pantry to eat from and quietly starved.
      const household = e.cityId ? this.householdFor(e) : null;
      this.mergeHouseholdWithPartner(e);

      const needs = e.needs;
      // Children eat less; the elderly tire faster.
      const appetite = e.isChild ? 0.65 : 1;
      needs.hunger = Math.min(100, needs.hunger + HUNGER_PER_DAY * appetite);

      // Dependants are fed at home rather than sent out to forage for themselves.
      // Adults still walk home to eat, because that is the part worth watching.
      if (household && (e.isChild || needs.hunger >= HUNGER_STARVING)) {
        const portion = e.isChild ? MEAL_CHILD : MEAL_ADULT;
        if (household.takeMeal(portion)) {
          needs.hunger = Math.max(0, needs.hunger - MEAL_RELIEF);
          e.starvingDays = 0;
        }
      } else if (!household && needs.hunger >= HUNGER_SEEK_FOOD) {
        // Nobody belongs to a settlement at first, and wanderers between towns
        // have no pantry at all. They live off the land where the land allows it.
        this.eatFromTheLand(e, needs);
      }

      // Comfort follows the roof over their head.
      const home = this.homeBuildingOf(e);
      const comfortTarget = home ? (home.type === 'house' ? 72 : 58) + (home.level - 1) * 8 : 22;
      needs.comfort += (comfortTarget - needs.comfort) * 0.3;

      // Safety follows what is nearby and whether the realm is at war.
      const threats = this.spatialHash.queryRadius(e.x, e.y, 7)
        .filter(o => this.isEnemy(e, o) || this.isFaunaThreat(o)).length;
      const safetyTarget = Math.max(5, 88 - threats * 22);
      needs.safety += (safetyTarget - needs.safety) * 0.35;

      // Starvation. Deliberately slow: hunger should be a crisis the player can
      // see building and respond to, not a silent culling every few days.
      if (needs.hunger >= HUNGER_STARVING) {
        e.starvingDays++;
        if (e.starvingDays > 2) e.hp -= 1.5 + e.starvingDays * 0.6;
        e.showEmote('💀', 60);
      } else {
        e.starvingDays = 0;
      }
    }
  }

  /** A person with no household forages where they stand. Needs the tileMap cached. */
  private eatFromTheLand(e: Entity, needs: { hunger: number }): void {
    const map = this.lastTileMap;
    if (!map) return;

    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const tile = map.getTile(cx + dx, cy + dy);
        if (tile?.resourceType !== 'food' || tile.resourceAmount < 1) continue;
        tile.resourceAmount -= 1.2;
        needs.hunger = Math.max(0, needs.hunger - MEAL_RELIEF * 0.9);
        e.starvingDays = 0;
        e.showEmote('🍇', 30);
        return;
      }
    }
  }

  /**
   * Couples keep one household, not two.
   *
   * People are often housed before they ever pair off, so without a merge step a
   * married couple ends up running two separate purses and two half-empty
   * pantries, and the family economy never behaves like a family.
   */
  private mergeHouseholdWithPartner(e: Entity): void {
    if (!e.partnerId || !e.householdId) return;
    const partner = this.entities.find(o => o.id === e.partnerId);
    if (!partner?.householdId || partner.householdId === e.householdId) return;

    const mine = this.households.get(e.householdId);
    const theirs = this.households.get(partner.householdId);
    if (!mine || !theirs) return;

    // The older household absorbs the newer one, so family history survives.
    const [keep, absorb] = mine.foundedYear <= theirs.foundedYear ? [mine, theirs] : [theirs, mine];
    keep.coin += absorb.coin;
    keep.pantry.add('food', absorb.pantry.get('food'));
    for (const memberId of absorb.memberIds) {
      keep.memberIds.add(memberId);
      const member = this.entities.find(o => o.id === memberId);
      if (member) member.householdId = keep.id;
    }
    this.households.delete(absorb.id);
  }

  /** A family spends its purse keeping the pantry stocked from the city store. */
  private householdShop(household: Household): void {
    const city = household.cityId ? this.cities.get(household.cityId) : null;
    if (!city) return;

    const shortfall = household.pantryTarget() - household.pantry.get('food');
    if (shortfall <= 0) return;

    const available = city.stock.get('food');
    if (available <= 0) return;

    // Price rises as the settlement's own store empties. This is the link between
    // a bad harvest and a family going hungry: scarcity reaches the dinner table
    // through the purse, not through a scripted event. The realm's own food price
    // is what a family pays — not the world reference it never trades at.
    const kingdomForPrice = city.kingdomId ? this.kingdoms.get(city.kingdomId) : null;
    const foodPrice = kingdomForPrice
      ? kingdomForPrice.economy.market.price('food', this.market.price('food'))
      : this.market.price('food');
    const scarcity = Math.max(0.25, Math.min(3, (city.population * 6) / Math.max(1, available)));
    const unitPrice = Math.max(0.4, foodPrice * 0.35 * scarcity);

    const wanted = Math.min(shortfall, available);
    const cost = wanted * unitPrice;
    const paid = household.spend(cost, true);

    let bought = paid > 0 ? Math.min(wanted, paid / unitPrice) : 0;

    // The commons. A settlement sitting on a surplus does not watch its own people
    // starve because they are broke — it feeds them. This is what keeps poverty a
    // hardship rather than an automatic death sentence, and it is also why a real
    // shortage (an empty store) bites everyone at once.
    // Triggered on "cannot cover today's meals", not on an exactly empty pantry:
    // a few crumbs left over must not disqualify a family from the dole.
    const daysFood = household.size * MEAL_ADULT;
    if (bought <= 0 && household.pantry.get('food') < daysFood) {
      const surplus = available - city.population * 1.5;
      if (surplus > 0) bought = Math.min(daysFood, surplus);
    }
    if (bought <= 0) return;

    const taken = city.stock.take('food', bought);
    household.pantry.add('food', taken);
    // Booked against the settlement's yearly ration so the same mouths are not
    // fed twice — once here and once in the annual consumption pass.
    city.householdFoodDrawn += taken;
    city.ledger.recordConsumed('food', taken);

    // The settlement earns what the family spent.
    const kingdom = city.kingdomId ? this.kingdoms.get(city.kingdomId) : null;
    if (kingdom && paid > 0) kingdom.treasury.add('gold', paid * 0.25);
  }

  /**
   * Takes a real load off a deposit and puts it in the worker's hands.
   *
   * The tile is physically depleted, so hand-gathering draws on the same finite,
   * slowly regrowing pool the settlement's yearly output does — a worker cannot
   * conjure timber out of a field that has none.
   */
  private pickUpLoad(e: Entity, tileMap: TileMap, tx: number, ty: number, expected: GoodId): boolean {
    const tile = tileMap.getTile(Math.floor(tx), Math.floor(ty));
    if (!tile || !tile.resourceType || tile.resourceAmount <= 0) return false;
    if (tile.resourceType !== expected) return false;

    const wanted = rng.range(2.5, 5);
    const taken = Math.min(wanted, tile.resourceAmount);
    if (taken <= 0.2) return false;

    tile.resourceAmount -= taken;
    e.carrying = { good: tile.resourceType, amount: taken };
    return true;
  }

  /** The household this citizen belongs to, creating one if they have none. */
  public householdFor(e: Entity): Household | null {
    if (e.householdId) {
      const existing = this.households.get(e.householdId);
      if (existing) return existing;
    }
    if (!e.cityId) return null;

    const id = e.householdId ?? `hh_${e.id}`;
    const household = new Household(id, e.cityId, e.homeBuildingId, this.currentYear);
    household.memberIds.add(e.id);
    // A new family starts with what its founder personally owns.
    household.coin = e.wealth;
    household.pantry.add('food', 6);
    this.households.set(id, household);
    e.householdId = id;
    return household;
  }

  private homeBuildingOf(e: Entity): Building | null {
    if (!e.cityId || !e.homeBuildingId) return null;
    return this.cities.get(e.cityId)?.buildings.get(e.homeBuildingId) ?? null;
  }

  public get24HourTime(): { hour: number; minute: number; timeString: string; periodLabel: string; icon: string } {
    // The clock is derived from how far through the day we are, so the displayed
    // time stays a real 24-hour clock no matter how many ticks a day is worth.
    const dayFraction = (this.yearTickCounter % TICKS_PER_DAY) / TICKS_PER_DAY;
    const hour = Math.floor(dayFraction * 24);
    const minute = Math.floor(((dayFraction * 24) % 1) * 60);
    const hh = hour.toString().padStart(2, '0');
    const mm = minute.toString().padStart(2, '0');
    const timeString = `${hh}:${mm}`;

    let periodLabel = 'Dia';
    let icon = '☀️';

    if (hour >= 5 && hour < 8) {
      periodLabel = 'Alvorada'; icon = '🌅';
    } else if (hour >= 8 && hour < 18) {
      periodLabel = 'Dia'; icon = '☀️';
    } else if (hour >= 18 && hour < 21) {
      periodLabel = 'Crepúsculo'; icon = '🌇';
    } else {
      periodLabel = 'Noite'; icon = '🌙';
    }

    return { hour, minute, timeString, periodLabel, icon };
  }

  public getCalendarDate(): { month: number; day: number; year: number } {
    // Each in-world day is one month of the year. The day-of-month is read off
    // the progress through that day, so the displayed date advances smoothly
    // instead of jumping once per month.
    const dayInYear = Math.floor((this.yearTickCounter % TICKS_PER_YEAR) / TICKS_PER_DAY);
    const month = Math.min(12, Math.floor((dayInYear / DAYS_PER_YEAR) * 12) + 1);
    const dayProgress = (this.yearTickCounter % TICKS_PER_DAY) / TICKS_PER_DAY;
    const day = Math.min(30, Math.floor(dayProgress * 30) + 1);
    return { month, day, year: this.currentYear };
  }

  // ===================== FAUNA AI (ANIMALS) =====================
  private tickFauna(e: Entity, tileMap: TileMap, particles: ParticleManager): void {
    const speed = SPECIES_DEFINITIONS[e.species].baseSpeed * MOVE_PER_TICK;

    switch (e.species) {
      case SpeciesType.DEER:
        this.tickDeerAI(e, tileMap, speed);
        break;
      case SpeciesType.WOLF:
        this.tickWolfAI(e, tileMap, particles, speed);
        break;
      case SpeciesType.BEAR:
        this.tickBearAI(e, tileMap, particles, speed);
        break;
      case SpeciesType.DRAGON:
        this.tickDragonAI(e, tileMap, particles, speed);
        break;
      case SpeciesType.BOAR:
        this.tickBoarAI(e, tileMap, particles, speed);
        break;
      case SpeciesType.EAGLE:
        this.tickEagleAI(e, tileMap, particles, speed);
        break;
      case SpeciesType.MAMMOTH:
        this.tickMammothAI(e, tileMap, particles, speed);
        break;
      default:
        this.tickGenericFauna(e, tileMap, speed);
    }
  }

  // ===================== NEW SPECIES FAUNA AI =====================

  private tickBoarAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const nearbyHumanoids = this.spatialHash.queryRadius(e.x, e.y, 3).filter(other => SPECIES_DEFINITIONS[other.species].isHumanoid && other.hp > 0 && other.age >= 3);
    if (nearbyHumanoids.length > 0) {
      const target = nearbyHumanoids[0];
      const dist = Math.hypot(target.x - e.x, target.y - e.y);
      if (dist <= COMBAT_RANGE) {
        if (e.attackCooldown <= 0) {
          const dmg = Math.max(1, e.damage - target.defense);
          target.hp -= dmg;
          e.attackCooldown = ATTACK_COOLDOWN;
          particles.spawnDamageNumber(target.x, target.y, dmg);
        }
      } else {
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, speed * 1.3);
        e.x = pos.x; e.y = pos.y;
      }
    } else {
      this.tickGenericFauna(e, tileMap, speed);
    }
  }

  private tickEagleAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const preyList = this.spatialHash.queryRadius(e.x, e.y, 8).filter(other => (other.species === SpeciesType.DEER || other.species === SpeciesType.BOAR) && other.hp > 0);
    if (preyList.length > 0) {
      const prey = preyList[0];
      const dist = Math.hypot(prey.x - e.x, prey.y - e.y);
      if (dist <= COMBAT_RANGE) {
        if (e.attackCooldown <= 0) {
          const dmg = Math.max(1, e.damage - prey.defense);
          prey.hp -= dmg;
          e.attackCooldown = ATTACK_COOLDOWN;
          particles.spawnDamageNumber(prey.x, prey.y, dmg);
        }
      } else {
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, prey.x, prey.y, tileMap, speed * 1.4);
        e.x = pos.x; e.y = pos.y;
      }
    } else {
      this.tickGenericFauna(e, tileMap, speed * 1.2);
    }
  }

  private tickMammothAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const threats = this.spatialHash.queryRadius(e.x, e.y, 4).filter(other => SPECIES_DEFINITIONS[other.species].isHumanoid && other.hp > 0 && other.age >= 3);
    if (e.hp < e.maxHp && threats.length > 0) {
      const target = threats[0];
      const dist = Math.hypot(target.x - e.x, target.y - e.y);
      if (dist <= COMBAT_RANGE) {
        if (e.attackCooldown <= 0) {
          const dmg = Math.max(1, e.damage - target.defense);
          target.hp -= dmg;
          e.attackCooldown = ATTACK_COOLDOWN;
          particles.spawnDamageNumber(target.x, target.y, dmg);
        }
      } else {
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, speed);
        e.x = pos.x; e.y = pos.y;
      }
    } else {
      this.tickGenericFauna(e, tileMap, speed * 0.8);
    }
  }

  /** DEER: Peaceful herbivore. Flees from predators and humanoids. Grazes near forests. */
  private tickDeerAI(e: Entity, tileMap: TileMap, speed: number): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 7);
    
    // Check for threats — flee from predators, wolves, bears, humanoids
    for (const other of nearby) {
      if (other.id === e.id) continue;
      const dist = SimplePathfinder.distance(e.x, e.y, other.x, other.y);
      const isThreat = other.species === SpeciesType.WOLF || other.species === SpeciesType.BEAR ||
                       other.species === SpeciesType.DRAGON || SPECIES_DEFINITIONS[other.species].isHumanoid;
      if (isThreat && dist < 6) {
        e.aiState = 'flee';
        const pos = SimplePathfinder.fleeFrom(e.x, e.y, other.x, other.y, tileMap, speed * 1.5);
        e.x = pos.x; e.y = pos.y;
        e.targetX = null; e.targetY = null;
        return;
      }
    }

    // Graze near forests
    if (e.aiState !== 'forage' || e.aiCooldown <= 0) {
      e.aiState = 'forage';
      e.aiCooldown = rng.rangeInt(30, 80);
      const target = SimplePathfinder.findRandomWalkable(e.x, e.y, 6, tileMap);
      if (target) { e.targetX = target.x; e.targetY = target.y; }
    }

    if (e.targetX !== null && e.targetY !== null) {
      const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX, e.targetY, tileMap, speed);
      e.x = pos.x; e.y = pos.y;
      if (SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < 0.3) {
        // Arrived — idle briefly
        e.targetX = null; e.targetY = null;
        e.aiState = 'idle';
        e.aiCooldown = rng.rangeInt(15, 40);
      }
    }
  }

  /** WOLF: Pack hunter. Coordinates with nearby wolves to chase humanoids. Fast and aggressive. */
  /**
   * How dangerous a target is to attack.
   *
   * A lone traveller is prey; six people standing together on their own claimed
   * ground are not. The hunting code always claimed to "avoid large groups" but
   * never scored for it, so predators walked into founding bands and ate them —
   * whole species went extinct in their first two years, before they had built
   * anything at all.
   */
  private preyRisk(target: Entity, nearby: Entity[], tileMap: TileMap): number {
    if (!SPECIES_DEFINITIONS[target.species].isHumanoid) return 0;

    let risk = 0;
    for (const other of nearby) {
      if (other.id === target.id || other.hp <= 0) continue;
      if (!SPECIES_DEFINITIONS[other.species].isHumanoid || other.isChild) continue;
      if (SimplePathfinder.distance(other.x, other.y, target.x, target.y) > 6) continue;
      risk += 7;
      if (other.profession === 'soldier') risk += 12;
    }

    // Settled ground is defended ground.
    const tile = tileMap.getTile(Math.floor(target.x), Math.floor(target.y));
    if (tile?.kingdomId) risk += 14;
    return risk;
  }

  private tickWolfAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 10);
    
    // Flee if badly hurt
    if (e.hp < e.maxHp * 0.2) {
      const threats = nearby.filter(o => SPECIES_DEFINITIONS[o.species].isHumanoid && SimplePathfinder.distance(e.x, e.y, o.x, o.y) < 5);
      if (threats.length > 0) {
        e.aiState = 'flee';
        const pos = SimplePathfinder.fleeFrom(e.x, e.y, threats[0].x, threats[0].y, tileMap, speed * 1.3);
        e.x = pos.x; e.y = pos.y;
        return;
      }
    }

    // Find prey — prefer lone targets, avoid large groups
    let bestPrey: Entity | null = null;
    let bestScore = -Infinity;
    for (const other of nearby) {
      if (other.id === e.id || other.species === SpeciesType.WOLF) continue;
      const isDeer = other.species === SpeciesType.DEER;
      const isHumanoid = SPECIES_DEFINITIONS[other.species].isHumanoid && other.age >= 3;
      if (!isDeer && !isHumanoid) continue;

      const dist = SimplePathfinder.distance(e.x, e.y, other.x, other.y);
      // Score: prefer close, weak, lone targets
      let score = -dist;
      if (isDeer) score += 5; // Prefer deer
      if (other.hp < other.maxHp * 0.5) score += 3; // Prefer wounded
      score -= this.preyRisk(other, nearby, tileMap);
      // Count nearby pack members for pack hunting bonus
      const packCount = nearby.filter(p => p.species === SpeciesType.WOLF && p.id !== e.id && SimplePathfinder.distance(p.x, p.y, other.x, other.y) < 8).length;
      score += packCount * 2;

      if (score > bestScore) { bestScore = score; bestPrey = other; }
    }

    if (bestPrey) {
      e.aiState = 'hunt';
      e.targetX = bestPrey.x;
      e.targetY = bestPrey.y;

      const dist = SimplePathfinder.distance(e.x, e.y, bestPrey.x, bestPrey.y);
      if (dist <= COMBAT_RANGE && e.attackCooldown <= 0) {
        const dmg = Math.max(3, e.damage - bestPrey.defense);
        bestPrey.hp -= dmg;
        e.attackCooldown = ATTACK_COOLDOWN;
        particles.spawnDamageNumber(bestPrey.x, bestPrey.y, dmg);
        sound.playHit();
        if (bestPrey.hp <= 0) e.kills++;
      } else {
        // Chase at higher speed
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, bestPrey.x, bestPrey.y, tileMap, speed * 1.2);
        e.x = pos.x; e.y = pos.y;
      }
      return;
    }

    // No prey: wander
    this.doWander(e, tileMap, speed, 8);
  }

  /** BEAR: Territorial apex predator. Guards area, attacks intruders. Slow but powerful. */
  private tickBearAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 8);

    // Attack anything that comes too close (territorial)
    let closestIntruder: Entity | null = null;
    let closestDist = DETECTION_RANGE;
    for (const other of nearby) {
      if (other.id === e.id || other.species === SpeciesType.BEAR) continue;
      // Bears ignore infants — too small to be worth the swipe
      if (SPECIES_DEFINITIONS[other.species]?.isHumanoid && other.age < 3) continue;
      // A bear is territorial, not suicidal: it does not charge a crowd or walk
      // into a settlement to pick a fight.
      if (this.preyRisk(other, nearby, tileMap) > 12) continue;
      const dist = SimplePathfinder.distance(e.x, e.y, other.x, other.y);
      if (dist < closestDist && dist < 6) {
        closestDist = dist;
        closestIntruder = other;
      }
    }

    if (closestIntruder) {
      e.aiState = 'attack';
      e.targetX = closestIntruder.x;
      e.targetY = closestIntruder.y;

      if (closestDist <= COMBAT_RANGE && e.attackCooldown <= 0) {
        // Bear swipe — heavy damage
        const dmg = Math.max(5, e.damage - closestIntruder.defense);
        closestIntruder.hp -= dmg;
        e.attackCooldown = ATTACK_COOLDOWN + 2; // Slower swings
        particles.spawnDamageNumber(closestIntruder.x, closestIntruder.y, dmg);
        // Knockback particle
        particles.spawnExplosion(closestIntruder.x, closestIntruder.y, '#78350f', 5);
        sound.playHit();
        if (closestIntruder.hp <= 0) e.kills++;
      } else {
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, closestIntruder.x, closestIntruder.y, tileMap, speed);
        e.x = pos.x; e.y = pos.y;
      }
      return;
    }

    // Patrol territory slowly
    this.doWander(e, tileMap, speed * 0.6, 5);
  }

  /** DRAGON: Boss entity. Breathes fire, flies over terrain, hunts everything. */
  private tickDragonAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 16);

    // Hunt the strongest nearby target
    let bestTarget: Entity | null = null;
    let bestHp = 0;
    for (const other of nearby) {
      if (other.id === e.id || other.species === SpeciesType.DRAGON) continue;
      // Dragons ignore infants — too small to bother with
      if (SPECIES_DEFINITIONS[other.species]?.isHumanoid && other.age < 3) continue;
      if (other.hp > bestHp) {
        bestHp = other.hp;
        bestTarget = other;
      }
    }

    if (bestTarget) {
      e.aiState = 'hunt';
      e.targetX = bestTarget.x;
      e.targetY = bestTarget.y;
      const dist = SimplePathfinder.distance(e.x, e.y, bestTarget.x, bestTarget.y);

      if (dist <= COMBAT_RANGE * 1.5 && e.attackCooldown <= 0) {
        // Dragon fire breath — area damage
        const hitRange = this.spatialHash.queryRadius(bestTarget.x, bestTarget.y, 2);
        for (const victim of hitRange) {
          if (victim.id === e.id) continue;
          const dmg = Math.max(10, e.damage - victim.defense);
          victim.hp -= dmg;
          particles.spawnDamageNumber(victim.x, victim.y, dmg);
        }
        // Set tiles on fire
        tileMap.applyBrush(Math.floor(bestTarget.x), Math.floor(bestTarget.y), 2, t => {
          if (t.type !== TerrainType.DEEP_OCEAN && t.type !== TerrainType.SHALLOW_WATER) {
            t.isOnFire = true;
          }
        });
        particles.spawnExplosion(bestTarget.x, bestTarget.y, '#f59e0b', 30);
        e.attackCooldown = ATTACK_COOLDOWN + 5;
        sound.playExplosion();
      } else {
        // Fly toward target (faster, ignores some terrain)
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, bestTarget.x, bestTarget.y, tileMap, speed * 1.5);
        e.x = pos.x; e.y = pos.y;
      }
      return;
    }

    // Roam the world
    this.doWander(e, tileMap, speed, 20);
  }

  private tickGenericFauna(e: Entity, tileMap: TileMap, speed: number): void {
    this.doWander(e, tileMap, speed, 6);
  }

  // ===================== HUMANOID AI =====================
  private tickHumanoid(e: Entity, tileMap: TileMap, particles: ParticleManager): void {
    const speed = SPECIES_DEFINITIONS[e.species].baseSpeed * MOVE_PER_TICK;

    // 1. Try to join or found a city if homeless
    if (!e.cityId) {
      this.tryJoinOrFoundCity(e, tileMap);
    }

    // 2. Decide AI state if cooldown expired
    if (e.aiCooldown <= 0) {
      this.decideHumanoidState(e, tileMap, particles);
    }

    // 3. Execute current AI state
    this.executeHumanoidState(e, tileMap, particles, speed);
  }

  /** Decide what the humanoid should be doing based on needs, threats, and personality. */
  private decideHumanoidState(e: Entity, tileMap: TileMap, particles: ParticleManager): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, DETECTION_RANGE);

    // ===== PRIORITY 1: Flee if critically low HP =====
    if (e.hp < e.maxHp * FLEE_THRESHOLD && e.profession !== 'king') {
      const threats = nearby.filter(o => this.isEnemy(e, o) && SimplePathfinder.distance(e.x, e.y, o.x, o.y) < 6);
      if (threats.length > 0) {
        e.aiState = 'flee';
        e.aiCooldown = 15;
        return;
      }
    }

    // ===== PRIORITY 2: Combat if enemies nearby =====
if (e.kingdomId) {
      const enemies = nearby.filter(o => this.isEnemy(e, o) && o.age >= 3); // Skip infants
      if (enemies.length > 0) {
        // Who stands and who runs is decided by role and by whether the odds are
        // survivable — the things a person can actually see — rather than by any
        // innate disposition.
        const isFighter = e.profession === 'soldier' || e.profession === 'king';
        const armed = !!e.equipment.weapon;
        if (isFighter) {
          e.aiState = 'attack';
          e.aiCooldown = 5;
          return;
        }
        // A civilian with a tool in hand will face one attacker. Facing a group,
        // or facing anyone empty-handed, they run.
        if (armed && enemies.length <= 1) {
          e.aiState = 'attack';
          e.aiCooldown = 6;
          return;
        }
        e.aiState = 'flee';
        e.aiCooldown = 12;
        return;
      }
    }

    // Check for dangerous fauna threats
    const faunaThreats = nearby.filter(o =>
      (o.species === SpeciesType.WOLF || o.species === SpeciesType.BEAR || o.species === SpeciesType.DRAGON) &&
      SimplePathfinder.distance(e.x, e.y, o.x, o.y) < 5
    );
    if (faunaThreats.length > 0 && e.profession !== 'soldier') {
      e.aiState = 'flee';
      e.aiCooldown = 12;
      return;
    }
    if (faunaThreats.length > 0 && e.profession === 'soldier') {
      e.aiState = 'attack';
      e.aiCooldown = 5;
      return;
    }

    // ===== PRIORITY 3: Heal if wounded =====
    if (e.hp < e.maxHp * 0.6 && e.aiState !== 'heal') {
      e.aiState = 'heal';
      e.aiCooldown = rng.rangeInt(20, 50);
      return;
    }

    // ===== PRIORITY 4: Eat =====
    // Above work and above the clock: a hungry citizen goes home for a meal.
    // This is what turns an empty pantry into visible behaviour instead of a
    // number nobody can see.
    if (e.cityId && !e.isChild && e.needs.hunger >= HUNGER_SEEK_FOOD && e.aiState !== 'eat') {
      const household = this.households.get(e.householdId ?? '');
      if (household && household.pantry.get('food') > 0) {
        e.aiState = 'eat';
        e.aiCooldown = rng.rangeInt(15, 30);
        return;
      }
    }

    // ===== PRIORITY 5: Rest when spent — recover passively instead of sleeping =====
    if (e.energy <= ENERGY_EXHAUSTED) {
      e.energy = Math.min(e.maxEnergy, e.energy + 4);
      e.aiState = 'idle';
      e.aiCooldown = rng.rangeInt(15, 30);
      return;
    }

    // ===== PRIORITY 6: Deliver a load already in hand =====
    if (e.carrying && e.cityId) {
      e.aiState = 'deliver';
      e.aiCooldown = rng.rangeInt(10, 20);
      return;
    }

    // ===== PRIORITY 7: Time-of-day routine (dawn/dusk/night overrides profession) =====
    // Night: sleep. Dawn: go to work. Dusk: return home.
    if (e.cityId) {
      switch (this.timeOfDay) {
        case 'night':
          e.aiState = 'idle';
          e.energy = Math.min(e.maxEnergy, e.energy + 2);
          e.aiCooldown = rng.rangeInt(15, 30);
          return;
        case 'dawn':
          if (e.workplaceId) {
            e.aiState = 'go_to_work';
            e.aiCooldown = rng.rangeInt(20, 40);
            return;
          }
          break;
        case 'dusk':
          if (e.workplaceId || e.homeX != null) {
            e.aiState = 'return_home';
            e.aiCooldown = rng.rangeInt(20, 40);
            return;
          }
          break;
      }
    }

    // ===== PRIORITY 5: Work / Profession-specific tasks (day only) =====
    if (e.cityId && this.cities.has(e.cityId)) {
      const city = this.cities.get(e.cityId)!;

      // Assign profession if none (now job-slot based)
      if (e.profession === 'none') {
        this.assignProfession(e, city);
      }

      // Choose task based on profession
      switch (e.profession) {
        case 'woodcutter':
          e.aiState = 'gather_wood';
          e.aiCooldown = rng.rangeInt(30, 60);
          return;
        case 'farmer':
          e.aiState = 'gather_food';
          e.aiCooldown = rng.rangeInt(20, 50);
          return;
        case 'miner':
          e.aiState = 'gather_ore';
          e.aiCooldown = rng.rangeInt(30, 60);
          return;
        case 'soldier': {
          // In wartime soldiers march on the enemy instead of circling home.
          const target = this.pickRaidTarget(e);
          if (target) {
            e.aiState = 'raid';
            e.targetX = target.x;
            e.targetY = target.y;
            e.aiCooldown = rng.rangeInt(60, 140);
          } else {
            e.aiState = 'patrol';
            e.aiCooldown = rng.rangeInt(30, 80);
          }
          return;
        }
        case 'scout':
          e.aiState = 'explore';
          e.aiCooldown = rng.rangeInt(50, 120);
          return;
        case 'builder': {
          // Artisans stand at their bench and work it. `builder` is also the
          // catch-all profession for clerks and staff, so only real craft
          // workplaces get the crafting animation.
          const bench = e.workplaceId ? city.buildings.get(e.workplaceId) : null;
          if (bench && bench.definition.category === 'craft') {
            e.aiState = 'craft';
            e.aiCooldown = rng.rangeInt(30, 60);
            return;
          }
          e.aiState = 'wander';
          e.aiCooldown = rng.rangeInt(20, 60);
          return;
        }
        case 'king':
          e.aiState = 'patrol'; // King walks around city
          e.aiCooldown = rng.rangeInt(20, 60);
          return;
        default:
          break;
      }

      // No job slot in town — which is the normal condition of a stone-age band,
      // since farms and camps do not exist until `agriculture` and `stone_tools`.
      // These people are not idle: they forage and cut wood by hand. Without this
      // the whole settlement visibly stands around doing nothing for decades.
      if (!e.isChild) {
        const needsFood = city.stock.get('food') < city.population * 3;
        e.aiState = needsFood || rng.chance(0.6) ? 'gather_food' : 'gather_wood';
        e.aiCooldown = rng.rangeInt(30, 60);
        return;
      }

      e.aiState = 'wander';
      e.aiCooldown = rng.rangeInt(20, 60);
      return;
    }

    // Homeless: explore
    e.aiState = 'explore';
    e.aiCooldown = rng.rangeInt(30, 80);
  }

  /**
   * Closest wild-food patch the settlement knows about. The city rebuilds this
   * cache once a year, so foragers spread out over the land the city actually
   * surveyed instead of all converging on one tile.
   */
  private nearestWildFood(e: Entity, city: City): { x: number; y: number } | null {
    return this.nearestDepositOf(e, city, 'food');
  }

  /** As above, for any good the settlement has surveyed. */
  private nearestDepositOf(e: Entity, city: City, good: GoodId): { x: number; y: number } | null {
    const patches = city.resourcesByGood.get(good);
    if (!patches || patches.length === 0) return null;

    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    // A short scan of the nearest candidates keeps this cheap at tick rate.
    for (const p of patches.slice(0, 24)) {
      const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
      // Jitter so a whole crowd does not lock onto the single closest bush.
      const score = d * rng.range(0.85, 1.45);
      if (score < bestDist) { bestDist = score; best = p; }
    }
    return best;
  }

  /** Assign profession and workplace based on real job slots in city buildings. */
  private assignProfession(e: Entity, city: City): void {
    const kingdom = e.kingdomId ? this.kingdoms.get(e.kingdomId) : null;
    const unlocked = new Set<import('../civ/Building').BuildingType>(BASE_BUILDINGS);
    for (const b of kingdom?.research.unlockedBuildings() ?? []) unlocked.add(b);

    // A standing army targets roughly one soldier per twenty citizens. The realm
    // can only afford it while it has a food surplus, so while that holds, new
    // adults enlist in the barracks before taking marginal farm jobs. A starving
    // settlement gets no recruits — everyone goes to the fields.
    let barracksFilled = 0;
    for (const b of city.buildings.values()) {
      if (b.type === 'barracks') barracksFilled += b.assignedWorkerIds.size;
    }
    const fed = city.stock.get('food') >= city.population * 2;
    const soldierTarget = Math.max(2, city.population * 0.05);
    const soldierBoost = fed ? Math.max(0, soldierTarget - barracksFilled) * 300 : 0;

    let best: { building: import('../civ/Building').Building; score: number } | null = null;
    for (const building of city.buildings.values()) {
      const def = building.definition;
      const jobs = def.jobs ?? 0;
      if (jobs <= 0 || building.assignedWorkerIds.size >= jobs * building.level) continue;
      if (!unlocked.has(building.type)) continue;
      const score = jobs * building.level
        + (def.category === 'food' ? 1000 : def.category === 'extraction' ? 800 : def.category === 'craft' ? 600 : 400)
        + (building.type === 'barracks' ? soldierBoost : 0);
      if (!best || score > best.score) best = { building, score };
    }

    if (best) {
      const b = best.building;
      const type = b.type;
      if (type === 'farm' || type === 'pasture') e.profession = 'farmer';
      else if (type === 'lumber_camp') e.profession = 'woodcutter';
      else if (type === 'mine' || type === 'quarry' || type === 'oil_well') e.profession = 'miner';
      else if (type === 'workshop' || type === 'smithy' || type === 'factory' || type === 'refinery') e.profession = 'builder';
      else if (type === 'barracks') e.profession = 'soldier';
      else if (type === 'library' || type === 'academy') e.profession = 'scout';
      else e.profession = 'builder';

      e.workplaceId = b.id;
      b.assignedWorkerIds.add(e.id);

      // Personal wealth is seeded from the profession, and the profession is only
      // known here — the Entity constructor always ran before anyone had a job, so
      // every citizen alive was starting on a pauper's purse.
      const seeded = startingWealthFor(e.profession, (min, max) => rng.rangeInt(min, max));
      if (seeded > e.wealth) {
        const household = this.householdFor(e);
        if (household) household.earn(seeded - e.wealth);
        e.wealth = seeded;
      }

      this.claimHome(e, city);
    }
  }

  /**
   * Moves a citizen into a real house with room to spare, so "home" is a building
   * on the map rather than a random patch of ground near the town centre. Falls
   * back to the old drifting offset only when the settlement has no housing left,
   * which is itself a meaningful signal that the city needs to build.
   */
  private claimHome(e: Entity, city: City): void {
    if (e.homeBuildingId && city.buildings.has(e.homeBuildingId)) return;

    // Prefer moving in with family already housed, then any house with room.
    const familyIds = new Set([e.partnerId, e.fatherId, e.motherId, ...e.childrenIds].filter(Boolean) as string[]);
    let familyHome: Building | null = null;
    let houseWithRoom: Building | null = null;
    let anyWithRoom: Building | null = null;

    for (const building of city.buildings.values()) {
      if ((building.definition.housing ?? 0) <= 0) continue;
      if (building.freeHousing() <= 0) continue;
      if (!familyHome && [...building.residentIds].some(id => familyIds.has(id))) familyHome = building;
      if (!houseWithRoom && building.type === 'house') houseWithRoom = building;
      if (!anyWithRoom) anyWithRoom = building;
    }

    // Live with family first, then in proper housing, then wherever there is room.
    const home = familyHome ?? houseWithRoom ?? anyWithRoom;
    if (!home) {
      if (e.homeX == null) {
        e.homeX = city.x + rng.range(-3, 3) * 0.8 + 0.5;
        e.homeY = city.y + rng.range(-3, 3) * 0.8 + 0.5;
      }
      return;
    }

    home.residentIds.add(e.id);
    e.homeBuildingId = home.id;
    e.homeX = home.x + 0.5;
    e.homeY = home.y + 0.5;

    // A household is the set of people under one roof. Partners share one.
    if (!e.householdId) {
      const partner = e.partnerId ? this.entities.find(o => o.id === e.partnerId) : null;
      if (partner?.householdId && this.households.has(partner.householdId)) {
        e.householdId = partner.householdId;
        this.households.get(partner.householdId)!.memberIds.add(e.id);
      } else {
        e.householdId = `hh_${home.id}_${e.id}`;
      }
    }

    const household = this.householdFor(e);
    if (household) {
      household.memberIds.add(e.id);
      household.homeBuildingId = home.id;
      household.cityId = city.id;
    }
  }

  /** Execute the current AI state. */
  private executeHumanoidState(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    switch (e.aiState) {
      case 'idle':
        // Do nothing, just breathe animation
        break;

      case 'flee': {
        e.showEmote('run', 20);
        // Find nearest threat and run away
        const threats = this.spatialHash.queryRadius(e.x, e.y, 8)
          .filter(o => this.isEnemy(e, o) || this.isFaunaThreat(o));
        if (threats.length > 0) {
          let closest = threats[0];
          let closestDist = SimplePathfinder.distance(e.x, e.y, closest.x, closest.y);
          for (const t of threats) {
            const d = SimplePathfinder.distance(e.x, e.y, t.x, t.y);
            if (d < closestDist) { closest = t; closestDist = d; }
          }
          // Terror outruns a walking pace.
          const fleeSpeed = speed * 1.35;
          const pos = SimplePathfinder.fleeFrom(e.x, e.y, closest.x, closest.y, tileMap, fleeSpeed);
          e.x = pos.x; e.y = pos.y;
        } else {
          e.aiState = 'idle';
          e.aiCooldown = 0;
        }
        break;
      }

      case 'attack': {
        const nearby = this.spatialHash.queryRadius(e.x, e.y, DETECTION_RANGE);
        let target: Entity | null = null;
        let targetDist = Infinity;

        // Auto-arm soldier with tech-tiered equipment if unequipped
        this.autoArmSoldier(e);

        for (const other of nearby) {
          // Skip infant targets — combatants ignore babies
          if (other.lifeStage === 'infant') continue;
          if (this.isEnemy(e, other) || this.isFaunaThreat(other)) {
            const dist = SimplePathfinder.distance(e.x, e.y, other.x, other.y);
            // An archer picks off the weakest from a distance; anyone swinging
            // steel takes whoever is closest.
            if (e.equipment.weapon?.category === 'ranged') {
              if (other.hp < (target?.hp ?? Infinity)) { target = other; targetDist = dist; }
            } else if (dist < targetDist) {
              target = other; targetDist = dist;
            }
          }
        }

        if (target) {
          // Emote based on species role & morale
          if (e.profession === 'king') e.showEmote('crown', 25);
          else if (e.equipment.weapon?.category === 'ranged') e.showEmote('bow', 20);
          else e.showEmote('swords', 20);

          // General / Commander Morale Bonus
          const hasCommanderNearby = nearby.some(o => o.kingdomId === e.kingdomId && o.profession === 'king');
          const moraleMult = hasCommanderNearby ? 1.25 : 1.0;

          // Reach based on weapon item properties / category
          const weapon = e.equipment.weapon;
          const category = weapon?.category;
          const weaponName = (weapon?.name || '').toLowerCase();

          let maxReach = weapon?.attackRange || (category === 'ranged' ? 6.0 : category === 'siege' ? 9.0 : COMBAT_RANGE);
          if (weaponName.includes('spear') || weaponName.includes('halberd')) maxReach = 2.4;

          if (targetDist <= maxReach && e.attackCooldown <= 0) {
            let dmg = Math.max(1, Math.floor((e.damage - target.defense) * moraleMult));
            if (category === 'heavy') dmg = Math.max(dmg, Math.floor(e.damage * 0.75 * moraleMult));

            const isRanged = category === 'ranged' || category === 'siege' || weaponName.includes('bow') || weaponName.includes('musket') || weaponName.includes('rifle') || weaponName.includes('blunderbuss') || weaponName.includes('sling');

            if (isRanged) {
              let projType: 'arrow' | 'bullet' | 'cannonball' | 'sling_stone' | 'magic_bolt' = 'arrow';
              if (weaponName.includes('musket') || weaponName.includes('rifle') || weaponName.includes('blunderbuss')) {
                projType = 'bullet';
              } else if (category === 'siege' || weaponName.includes('cannon')) {
                projType = 'cannonball';
              } else if (weaponName.includes('sling')) {
                projType = 'sling_stone';
              } else if (category === 'magic') {
                projType = 'magic_bolt';
              }

              e.attackCooldown = projType === 'bullet' ? ATTACK_COOLDOWN + 2 : ATTACK_COOLDOWN;

              particles.spawnProjectile(
                e.x,
                e.y,
                target.x,
                target.y,
                projType,
                dmg,
                target,
                (tx, ty, d, targetEnt) => {
                  if (targetEnt && targetEnt.hp > 0) {
                    targetEnt.hp -= d;
                    particles.spawnDamageNumber(tx, ty, d);
                    sound.playHit();
                    if (targetEnt.hp <= 0 && e.kingdomId && targetEnt.kingdomId) {
                      e.kills++;
                      e.gainXp(30 + targetEnt.level * 5);
                      this.diplomacy.recordBattle(e.kingdomId, targetEnt.kingdomId, 1, 0);
                    }
                  }
                }
              );
            } else if (weaponName.includes('spear') || weaponName.includes('halberd')) {
              // SPEAR THRUST & KNOCKBACK
              const dx = (target.x - e.x) / (targetDist || 1);
              const dy = (target.y - e.y) / (targetDist || 1);

              target.x += dx * 0.22;
              target.y += dy * 0.22;
              target.hp -= dmg;
              e.attackCooldown = ATTACK_COOLDOWN;

              particles.spawnProjectile(e.x, e.y, target.x, target.y, 'spear_thrust', dmg);
              particles.spawnDamageNumber(target.x, target.y, dmg);
              sound.playHit();

              if (target.hp <= 0 && e.kingdomId && target.kingdomId) {
                e.kills++;
                e.gainXp(30 + target.level * 5);
                this.diplomacy.recordBattle(e.kingdomId, target.kingdomId, 1, 0);
              }
            } else {
              // Standard Melee Blow
              target.hp -= dmg;
              e.attackCooldown = ATTACK_COOLDOWN;
              particles.spawnDamageNumber(target.x, target.y, dmg);
              sound.playHit();

              if (target.hp <= 0 && e.kingdomId && target.kingdomId) {
                e.kills++;
                e.gainXp(30 + target.level * 5);
                this.diplomacy.recordBattle(e.kingdomId, target.kingdomId, 1, 0);
              }
            }
          } else {
            // An archer or rifleman already in range holds position and keeps shooting.
            const isRangedUnit = (category === 'ranged' || category === 'siege') && targetDist < maxReach * 0.85;
            if (!isRangedUnit) {
              const attackSpeed = category === 'heavy' ? speed * 0.85 : speed;
              const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, attackSpeed);
              e.x = pos.x; e.y = pos.y;
            }
          }
        } else {
          // SIEGE WARFARE: If no enemy soldier nearby, attack enemy city buildings & conquer Town Center!
          this.executeSiegeWarfare(e, tileMap, particles, speed);
        }
        break;
      }

      case 'gather_wood': {
        // Purely visual — yearly produceGoods handles actual economy
        e.showEmote('🪓', 20);
        if (!e.cityId || !this.cities.has(e.cityId)) { e.aiState = 'wander'; break; }
        const gCity = this.cities.get(e.cityId)!;
        if (e.targetX === null || e.targetY === null) {
          // Head for a real timber deposit first. Arid maps carry their wood in
          // scrub and palm stands rather than dense forest, so keying only off
          // FOREST tiles left woodcutters with nowhere to go.
          const deposit = this.nearestDepositOf(e, gCity, 'wood');
          const cached = deposit ?? gCity.nearestCached(TerrainType.FOREST, e.x, e.y);
          const target = cached ?? this.findNearestTileType(e.x, e.y, TerrainType.FOREST, tileMap, 12);
          if (target) { e.targetX = target.x + 0.5; e.targetY = target.y + 0.5; }
          else { e.aiState = 'wander'; e.aiCooldown = 0; break; }
        }
        const gDist = SimplePathfinder.distance(e.x, e.y, e.targetX!, e.targetY!);
        if (gDist < 1.0) {
          e.energy = Math.max(0, e.energy - 0.3);
          e.gainXp(1);
          // Cut a real load and carry it home.
          if (this.pickUpLoad(e, tileMap, e.targetX!, e.targetY!, 'wood')) e.aiState = 'deliver';
          e.targetX = null; e.targetY = null;
        } else {
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX!, e.targetY!, tileMap, speed);
          e.x = pos.x; e.y = pos.y;
          if (pos.blocked) { e.targetX = null; e.targetY = null; }
        }
        break;
      }

      case 'gather_food': {
        // Purely visual — yearly produceGoods handles farm output
        e.showEmote('🌾', 20);
        if (!e.cityId || !this.cities.has(e.cityId)) { e.aiState = 'wander'; break; }
        const gCity = this.cities.get(e.cityId)!;
        const bld = e.workplaceId ? gCity.buildings.get(e.workplaceId) : null;

        let fx: number;
        let fy: number;
        if (bld) {
          fx = bld.x + 0.5;
          fy = bld.y + 0.5;
        } else {
          // Foraging without a farm: walk to real wild food on the ground rather
          // than milling around the town centre pretending to harvest nothing.
          if (e.targetX === null || e.targetY === null) {
            const patch = this.nearestWildFood(e, gCity);
            if (!patch) { e.aiState = 'wander'; e.aiCooldown = 0; break; }
            e.targetX = patch.x + 0.5;
            e.targetY = patch.y + 0.5;
          }
          fx = e.targetX!;
          fy = e.targetY!;
        }

        const fDist = Math.hypot(fx - e.x, fy - e.y);
        if (fDist < 0.8) {
          e.energy = Math.max(0, e.energy - 0.2);
          e.gainXp(1);
          // Foragers bring the harvest back themselves; farm hands feed the
          // building's own yearly output instead of carrying baskets.
          if (!bld) {
            if (this.pickUpLoad(e, tileMap, fx, fy, 'food')) e.aiState = 'deliver';
            e.targetX = null; e.targetY = null;
          }
        } else {
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, fx, fy, tileMap, speed);
          e.x = pos.x; e.y = pos.y;
          if (pos.blocked) { e.targetX = null; e.targetY = null; }
        }
        break;
      }

      case 'eat': {
        // Walk home, then take a real meal out of the family pantry.
        e.showEmote('🍲', 25);
        const hx = e.homeX ?? e.x;
        const hy = e.homeY ?? e.y;
        if (Math.hypot(hx - e.x, hy - e.y) >= 0.9) {
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, hx, hy, tileMap, speed);
          e.x = pos.x; e.y = pos.y;
          break;
        }

        const household = this.households.get(e.householdId ?? '');
        const portion = e.isChild ? MEAL_CHILD : MEAL_ADULT;
        if (household && household.takeMeal(portion)) {
          e.needs.hunger = Math.max(0, e.needs.hunger - MEAL_RELIEF);
          e.energy = Math.min(e.maxEnergy, e.energy + 12);
          e.starvingDays = 0;
        }
        e.aiState = 'idle';
        e.aiCooldown = rng.rangeInt(10, 20);
        break;
      }

      case 'deliver': {
        // Carry the load back to the settlement store and get paid for it. This is
        // the moment abstract yearly production becomes a person doing a job.
        e.showEmote('📦', 25);
        if (!e.cityId || !this.cities.has(e.cityId) || !e.carrying) {
          e.carrying = null;
          e.aiState = 'idle';
          e.aiCooldown = 0;
          break;
        }
        const dCity = this.cities.get(e.cityId)!;
        if (Math.hypot(dCity.x - e.x, dCity.y - e.y) >= 1.2) {
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, dCity.x, dCity.y, tileMap, speed);
          e.x = pos.x; e.y = pos.y;
          if (pos.blocked) { e.targetX = null; e.targetY = null; }
          break;
        }

        const load = e.carrying;
        const stored = dCity.stock.add(load.good, load.amount);
        this.market.reportSupply(load.good, stored);
        // Hand-carried output is production too — it must show in the books or the
        // settlement's stock rises out of nowhere.
        dCity.ledger.recordProduced(load.good, stored);

        // Wages. The worker is paid for what they actually brought in, and the
        // money lands in the family purse that buys the family's food.
        const wage = stored * this.market.price(load.good) * 0.35;
        e.wealth += wage;
        const household = this.householdFor(e);
        if (household) household.earn(wage);

        e.carrying = null;
        e.gainXp(2);
        e.aiState = 'idle';
        e.aiCooldown = rng.rangeInt(8, 16);
        break;
      }

      case 'craft': {
        // Purely visual — the yearly recipe pass in CivilizationEngine owns the
        // actual conversion. This only walks the artisan to their workshop and
        // keeps them there so the crafting animation has somewhere to play.
        e.showEmote('⚒️', 20);
        if (!e.cityId || !this.cities.has(e.cityId)) { e.aiState = 'wander'; break; }
        const cCity = this.cities.get(e.cityId)!;
        const bench = e.workplaceId ? cCity.buildings.get(e.workplaceId) : null;
        if (!bench) { e.aiState = 'wander'; e.aiCooldown = 0; break; }
        const bx = bench.x + 0.5;
        const by = bench.y + 0.5;
        if (Math.hypot(bx - e.x, by - e.y) < 0.8) {
          e.energy = Math.max(0, e.energy - 0.25);
          e.gainXp(1);
        } else {
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, bx, by, tileMap, speed);
          e.x = pos.x; e.y = pos.y;
        }
        break;
      }

      case 'gather_ore': {
        // Purely visual — yearlyApiGoods handles extraction
        e.showEmote('⛏️', 20);
        if (!e.cityId || !this.cities.has(e.cityId)) { e.aiState = 'wander'; break; }
        const gCity = this.cities.get(e.cityId)!;
        if (e.targetX === null || e.targetY === null) {
          const deposit = this.findNearestResourceTile(e.x, e.y, tileMap, 10);
          if (deposit) { e.targetX = deposit.x + 0.5; e.targetY = deposit.y + 0.5; }
          else { e.aiState = 'idle'; e.aiCooldown = 0; break; }
        }
        const oDist = SimplePathfinder.distance(e.x, e.y, e.targetX!, e.targetY!);
        if (oDist < 1.0) {
          e.energy = Math.max(0, e.energy - 0.3);
          e.gainXp(1);
          // Whatever vein is actually under the pick comes back on their shoulder.
          const oreTile = tileMap.getTile(Math.floor(e.targetX!), Math.floor(e.targetY!));
          if (oreTile?.resourceType && this.pickUpLoad(e, tileMap, e.targetX!, e.targetY!, oreTile.resourceType)) {
            e.aiState = 'deliver';
          }
          e.targetX = null; e.targetY = null;
        } else {
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX!, e.targetY!, tileMap, speed);
          e.x = pos.x; e.y = pos.y;
          if (pos.blocked) { e.targetX = null; e.targetY = null; }
        }
        break;
      }

      case 'raid': {
        // March on the assigned enemy settlement. Once in siege range the army
        // holds position — the warfare layer resolves the siege each year, and
        // the combat priority handles anyone who comes out to meet them.
        if (e.targetX === null || e.targetY === null) {
          e.aiState = 'patrol';
          e.aiCooldown = 0;
          break;
        }

        const distance = SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY);
        if (distance > SIEGE_RADIUS - 1.5) {
          // An army on campaign moves far faster than a soldier walking his beat.
          // At patrol pace a war would end long before anyone reached the border.
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX, e.targetY, tileMap, speed * 2.5);
          e.x = pos.x; e.y = pos.y;
          if (pos.blocked) { e.targetX = null; e.targetY = null; e.aiState = 'patrol'; }
        } else {
          // Encamped outside the walls. The camp is anchored to the city, not to
          // wherever the soldier happens to stand — otherwise the army drifts off
          // and the siege never musters enough men to count.
          this.doEncampAround(e, e.targetX, e.targetY, tileMap, speed * 0.6, 4.5);
        }
        break;
      }

      case 'patrol': {
        e.showEmote(e.profession === 'king' ? 'crown' : 'shield', 25);
        if (!e.cityId || !this.cities.has(e.cityId)) { e.aiState = 'wander'; break; }
        const city = this.cities.get(e.cityId)!;
        // A king keeps close to the seat of power; a soldier walks a wider beat.
        const patrolRadius = e.profession === 'king' ? 6 : 9;
        this.doWanderNearCity(e, city, tileMap, speed * 0.9, patrolRadius);
        break;
      }

      case 'explore': {
        // Scout/explore far from home
        // Scouts are trained to range further than anyone else.
        const exploreRadius = e.profession === 'scout' ? 25 : 18;
        this.doWander(e, tileMap, speed * 1.1, exploreRadius);
        break;
      }

      case 'heal': {
        // Stay still and regenerate
        e.hp = Math.min(e.maxHp, e.hp + 3);
        if (e.hp >= e.maxHp * 0.9) {
          e.aiState = 'idle';
          e.aiCooldown = 0;
        }
        break;
      }

      case 'wander':
      default:
        if (e.cityId && this.cities.has(e.cityId)) {
          this.doWanderNearCity(e, this.cities.get(e.cityId)!, tileMap, speed, 8);
        } else {
          this.doWander(e, tileMap, speed, 10);
        }
        break;


      case 'go_to_work': {
        e.showEmote('🚶', 15);
        const bid = e.workplaceId;
        if (!bid || !e.cityId) { e.aiState = 'idle'; break; }
        const wCity = this.cities.get(e.cityId);
        if (!wCity) { e.aiState = 'idle'; break; }
        const bld = wCity.buildings.get(bid);
        if (!bld) { e.aiState = 'idle'; break; }
        const wx = bld.x + 0.5, wy = bld.y + 0.5;
        const dist = Math.hypot(wx - e.x, wy - e.y);
        if (dist < 0.8) {
          e.aiState = 'idle';
          e.targetX = wx;
          e.targetY = wy;
        } else {
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, wx, wy, tileMap, speed);
          e.x = pos.x; e.y = pos.y;
        }
        break;
      }

      case 'return_home': {
        e.showEmote('🏠', 15);
        const hx = e.homeX ?? (e.cityId ? this.cities.get(e.cityId)?.x : null) ?? e.x;
        const hy = e.homeY ?? (e.cityId ? this.cities.get(e.cityId)?.y : null) ?? e.y;
        const dist = Math.hypot(hx - e.x, hy - e.y);
        if (dist < 0.8) {
          e.aiState = 'idle';
          e.targetX = null; e.targetY = null;
        } else {
          const pos = SimplePathfinder.getStepTowards(e.x, e.y, hx, hy, tileMap, speed);
          e.x = pos.x; e.y = pos.y;
          if (pos.blocked) { e.x = hx; e.y = hy; } // snap home if stuck
        }
        break;
      }
    }
  }

  // ===================== MOVEMENT HELPERS =====================

  private doWander(e: Entity, tileMap: TileMap, speed: number, radius: number): void {
    if (e.targetX === null || e.targetY === null ||
        SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < 0.3) {
      const target = SimplePathfinder.findRandomWalkable(e.x, e.y, radius, tileMap);
      if (target) { e.targetX = target.x; e.targetY = target.y; }
      else { e.targetX = null; e.targetY = null; return; }
    }
    const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX!, e.targetY!, tileMap, speed);
    e.x = pos.x; e.y = pos.y;
    if (pos.blocked) { e.targetX = null; e.targetY = null; }
  }

  private doWanderNearCity(e: Entity, city: City, tileMap: TileMap, speed: number, radius: number): void {
    if (e.targetX === null || e.targetY === null ||
        SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < 0.3) {
      const target = SimplePathfinder.findRandomWalkable(city.x, city.y, radius, tileMap);
      if (target) { e.targetX = target.x; e.targetY = target.y; }
      else { e.targetX = null; e.targetY = null; return; }
    }
    const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX!, e.targetY!, tileMap, speed);
    e.x = pos.x; e.y = pos.y;
    if (pos.blocked) { e.targetX = null; e.targetY = null; }
  }

  /**
   * Holds a besieging soldier on a ring around the city he is investing.
   *
   * Each soldier takes his own arc of the encirclement, derived from his id, so
   * an army spreads around the walls instead of piling on one spot. Crucially it
   * does not touch `targetX/targetY`, which stay pointed at the city — the army
   * must not forget what it came to besiege.
   */
  private doEncampAround(e: Entity, cx: number, cy: number, tileMap: TileMap, speed: number, radius: number): void {
    // Stable per-soldier angle so the camp holds its shape year to year.
    let hash = 0;
    for (let i = e.id.length - 6; i < e.id.length; i++) {
      hash = (hash * 31 + e.id.charCodeAt(Math.max(0, i))) | 0;
    }
    const angle = (Math.abs(hash) % 360) * (Math.PI / 180);

    const postX = cx + Math.cos(angle) * radius;
    const postY = cy + Math.sin(angle) * radius;

    if (SimplePathfinder.distance(e.x, e.y, postX, postY) < 0.4) return;
    const pos = SimplePathfinder.getStepTowards(e.x, e.y, postX, postY, tileMap, speed);
    e.x = pos.x;
    e.y = pos.y;
  }

  /**
   * Arms a soldier with the best equipment their settlement can actually build.
   *
   * Knowing about rifles does not put one in anybody's hands: the tier also
   * needs a workshop that can make it and the materials in the city store,
   * which are physically consumed. A realm that has researched gunpowder but
   * cannot manufacture any still fields swordsmen — technology is a licence to
   * produce, not the product.
   */
  private autoArmSoldier(e: Entity): void {
    if (e.profession !== 'soldier' && e.profession !== 'king') return;
    if (e.equipment.weapon) return; // Already armed

    const kingdom = e.kingdomId ? this.kingdoms.get(e.kingdomId) : null;
    const city = e.cityId ? this.cities.get(e.cityId) : null;

    for (const tier of EQUIPMENT_TIERS_BY_RANK) {
      const requiredTech = EQUIPMENT_TECH[tier];
      if (requiredTech && !kingdom?.research.knows(requiredTech)) continue;

      const cost = EQUIPMENT_COST[tier] ?? {};
      // The primitive tier is whittled in the field and needs no settlement.
      if (tier !== 'primitive') {
        if (!city) continue;
        const affordable = Object.entries(cost).every(
          ([good, amount]) => city.stock.get(good as GoodId) >= (amount as number)
        );
        if (!affordable) continue;
        for (const [good, amount] of Object.entries(cost)) {
          const used = city.stock.take(good as GoodId, amount as number);
          city.ledger.recordConsumed(good as GoodId, used);
        }
      }

      const weapons = WEAPON_TIERS[tier] ?? WEAPON_TIERS.primitive;
      const armors = ARMOR_TIERS[tier] ?? ARMOR_TIERS.primitive;
      e.equipment.weapon = { ...rng.pick(weapons), id: nextId('w') };
      e.equipment.armor = { ...rng.pick(armors), id: nextId('a') };
      e.recalculateStats();
      return;
    }
  }

  /**
   * With no enemy soldier in reach, a warband presses on toward the nearest
   * enemy settlement and invests it.
   *
   * Taking the city is *not* decided here. A single soldier touching a town
   * centre must not annex it — the yearly warfare tick weighs the besieging army
   * against the city's walls and garrison, and only then does it fall.
   */
  private executeSiegeWarfare(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    if (!e.kingdomId) return;

    // Find nearest enemy city
    let enemyCity: City | null = null;
    let closestDist = Infinity;

    for (const city of this.cities.values()) {
      if (city.kingdomId && this.diplomacy.isAtWar(e.kingdomId, city.kingdomId)) {
        const dist = Math.hypot(city.x - e.x, city.y - e.y);
        if (dist < closestDist) {
          closestDist = dist;
          enemyCity = city;
        }
      }
    }

    if (!enemyCity) {
      e.aiState = 'idle';
      e.aiCooldown = 0;
      return;
    }

    e.showEmote('⚔️', 25);

    if (closestDist > SIEGE_RADIUS - 1.5) {
      // Still marching. Campaign pace, not patrol pace.
      const pos = SimplePathfinder.getStepTowards(e.x, e.y, enemyCity.x, enemyCity.y, tileMap, speed * 2.5);
      e.x = pos.x; e.y = pos.y;
      return;
    }

    // Investing the city: hold the ring and let the siege resolve over years.
    this.doEncampAround(e, enemyCity.x, enemyCity.y, tileMap, speed * 0.6, 4.5);

    // Siege engines and fires wear the defences down while the army sits there.
    if (rng.chance(0.02)) {
      particles.spawnExplosion(enemyCity.x, enemyCity.y, '#ef4444', 6);
      const buildings = [...enemyCity.buildings.values()].filter(b => b.type !== 'town_center');
      if (buildings.length > 0) {
        const hit = rng.pick(buildings);
        hit.hp -= e.damage;
        if (hit.hp <= 0) {
          enemyCity.removeBuilding(hit.id);
          const tile = tileMap.getTile(hit.x, hit.y);
          if (tile && tile.buildingId === hit.id) tile.buildingId = null;
        }
      }
    }
  }

  // ===================== HELPER CHECKS =====================

  private isEnemy(self: Entity, other: Entity): boolean {
    if (self.id === other.id) return false;
    if (!self.kingdomId || !other.kingdomId) return false;
    if (self.kingdomId === other.kingdomId) return false;
    return this.diplomacy.isAtWar(self.kingdomId, other.kingdomId);
  }

  private isFaunaThreat(entity: Entity): boolean {
    return entity.species === SpeciesType.WOLF ||
           entity.species === SpeciesType.BEAR ||
           entity.species === SpeciesType.DRAGON;
  }

  private findNearestTileType(x: number, y: number, type: TerrainType, tileMap: TileMap, radius: number): { x: number; y: number } | null {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tile = tileMap.getTile(cx + dx, cy + dy);
        if (tile && tile.type === type) {
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = { x: cx + dx, y: cy + dy };
          }
        }
      }
    }
    return best;
  }

  // ===================== CITY / KINGDOM FOUNDING =====================

  private tryJoinOrFoundCity(e: Entity, tileMap: TileMap): void {
    // Try join existing same-species city
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 8);
    for (const other of nearby) {
      if (other.species === e.species && other.cityId && this.cities.has(other.cityId)) {
        e.cityId = other.cityId;
        const city = this.cities.get(other.cityId)!;
        city.population++;
        e.kingdomId = city.kingdomId;
        // Founders predate every settlement, so the first city they join is the
        // one history will record them as coming from.
        if (!e.birthCityId) {
          e.birthCityId = city.id;
          e.birthCityName = city.name;
        }
        this.claimHome(e, city);
        return;
      }
    }

    // Found new city
    const tile = tileMap.getTile(Math.floor(e.x), Math.floor(e.y));
    if (tile && !tile.type.includes('ocean') && tile.type !== TerrainType.MOUNTAIN && !tile.cityId) {
      const cityId = nextId('city');
      const cityName = `${e.name}ton`;
      const city = new City(cityId, cityName, e.species, tile.x, tile.y, e.name, this.currentYear);
      city.population = 1;
      this.cities.set(cityId, city);
      e.cityId = cityId;
      tile.cityId = cityId;
      if (!e.birthCityId) {
        e.birthCityId = cityId;
        e.birthCityName = cityName;
      }
      chronicle.log(this.currentYear, 'founding', `The settlement of ${cityName} was founded by ${e.name}.`);
      this.checkKingdomFounding(city, e);
      // Founded last so the claim is stamped with the kingdom that now owns it.
      city.seedFoundingClaim(tileMap, 4);
    }
  }

  private checkKingdomFounding(city: City, rulerCandidate: Entity): void {
    if (!city.kingdomId) {
      const kingdomId = nextId('king');
      const color = getNextKingdomColor();
      const kingdomName = generateKingdomName();

      const kingdom = new Kingdom(kingdomId, kingdomName, city.species, color, city.id, this.currentYear);
      kingdom.rulerId = rulerCandidate.id;
      rulerCandidate.profession = 'king';

      // Found the ruling house. Every later succession is measured against it.
      if (!rulerCandidate.dynasty) rulerCandidate.dynasty = generateDynastyName(rulerCandidate.species);
      kingdom.dynasty = rulerCandidate.dynasty;
      // The realm starts as a tribe and evolves from there through the political
      // tree. adoptGovernment retitles it to match, so a brand new realm is never
      // called a Republic before anyone has invented one.
      kingdom.adoptGovernment('tribe', this.currentYear);

      this.kingdoms.set(kingdomId, kingdom);
      city.kingdomId = kingdomId;
      rulerCandidate.kingdomId = kingdomId;

      chronicle.log(this.currentYear, 'kingdom', `The ${kingdom.name} was established. ${rulerCandidate.fullName} leads its people.`);
    }
  }

  // ===================== GEOPOLITICS (YEARLY) =====================

  /**
   * War, peace and rivalry between realms. Runs once a year alongside the
   * civilization engine, which handles everything economic and political.
   */
  private tickGeopolitics(): void {
    if (this.kingdoms.size < 2) return;
    const kingdoms = Array.from(this.kingdoms.values());

    // Realms only quarrel with realms they have actually met.
    for (let i = 0; i < kingdoms.length; i++) {
      for (let j = i + 1; j < kingdoms.length; j++) {
        const k1 = kingdoms[i];
        const k2 = kingdoms[j];
        if (!k1.knownKingdoms.has(k2.id)) continue;

        // Vassals do not fight their overlord, nor their overlord's other vassals.
        if (k1.overlordId === k2.id || k2.overlordId === k1.id) continue;
        if (k1.overlordId && k1.overlordId === k2.overlordId) continue;

        // Different peoples drift apart; kin drift together.
        if (rng.chance(0.35)) {
          const drift = k1.species !== k2.species ? -2 : 1;
          this.diplomacy.changeRelation(k1.id, k2.id, drift);
        }

        // Ideology matters once realms have one.
        const gov1 = GOVERNMENTS[k1.government];
        const gov2 = GOVERNMENTS[k2.government];
        if (gov1.economy !== gov2.economy && (gov1.economy === 'planned' || gov2.economy === 'planned')) {
          if (rng.chance(0.3)) this.diplomacy.changeRelation(k1.id, k2.id, -3);
        }

        if (this.diplomacy.isAtWar(k1.id, k2.id)) continue;

        const relation = this.diplomacy.getRelation(k1.id, k2.id);
        const cap1 = this.cities.get(k1.capitalCityId);
        const cap2 = this.cities.get(k2.capitalCityId);
        const dist = cap1 && cap2 ? Math.hypot(cap1.x - cap2.x, cap1.y - cap2.y) : 70;
        const proximity = Math.min(1, Math.max(0, 1 - dist / 70));
        // War is a real danger once relations sour; proximity sharpens it.
        if (proximity <= 0) continue;
        if (relation > -12 && !(proximity > 0.82 && relation <= -4)) continue;

        // Aggression comes from the government and the ruler's temperament.
        const aggressor = gov1.aggression >= gov2.aggression ? k1 : k2;
        const defender = aggressor === k1 ? k2 : k1;
        const aggression =
          GOVERNMENTS[aggressor.government].aggression *
          (0.72 +
            aggressor.culture.militarism * 0.28 +
            aggressor.culture.expansionism * 0.2 -
            aggressor.culture.warTrauma * 0.18 -
            aggressor.culture.diplomaticTrust * 0.08) *
          (0.78 + aggressor.society.warPressure * 0.34 - aggressor.society.peacePressure * 0.18);

        const borderAmbition =
          aggressor.culture.militarism * 0.3 + aggressor.culture.expansionism * 0.28 +
          defender.culture.militarism * 0.2 + defender.culture.expansionism * 0.18;

        // A realm only starts a war it believes it can win.
        const powerRatio = aggressor.computePower() / Math.max(1, defender.computePower());
        const confidence = Math.min(2, powerRatio);
        const hostility = Math.max(0.01, -relation / 120);
        if (rng.chance(0.10 * aggression * confidence * (1 + hostility + proximity * borderAmbition * 0.8))) {
          const reason = aggressor.isEmpire ? 'Imperial Expansion'
            : powerRatio > 1.8 ? 'Conquest'
            : relation <= -80 ? 'Blood Feud'
            : 'Border Dispute';
          if (this.diplomacy.declareWar(aggressor.id, defender.id, this.currentYear, reason)) {
            chronicle.log(this.currentYear, 'war', `${aggressor.name} declared war upon ${defender.name}. Reason: ${reason}`);
          }
        }
      }
    }

    // Long wars exhaust the realms fighting them.
    for (const kingdom of kingdoms) {
      const wars = this.diplomacy.getWarsFor(kingdom.id);
      kingdom.warWeariness = wars.length > 0
        ? Math.min(100, kingdom.warWeariness + wars.length * 4)
        : Math.max(0, kingdom.warWeariness - 6);
    }
  }

  /**
   * Wartime conscription. A realm at war pulls able-bodied workers into any
   * empty barracks post, up to a wartime levy of about one soldier per eight
   * citizens. Food stays protected: while the city is short on food nobody is
   * taken from the fields, and artisans/miners go before farmers.
   */
  private musterArmies(): void {
    for (const kingdom of this.kingdoms.values()) {
      if (this.diplomacy.getWarsFor(kingdom.id).length === 0) continue;
      for (const cityId of kingdom.cityIds) {
        const city = this.cities.get(cityId);
        if (!city) continue;

        const barracksList = [...city.buildings.values()].filter(b => b.type === 'barracks');
        let openSlots = 0;
        for (const b of barracksList) {
          const cap = (b.definition.jobs ?? 0) * b.level;
          openSlots += Math.max(0, cap - b.assignedWorkerIds.size);
        }
        if (openSlots <= 0) continue;

        let soldiersNow = 0;
        for (const e of this.entities) {
          if (e.cityId === cityId && e.hp > 0 && e.profession === 'soldier') soldiersNow++;
        }
        const levy = Math.max(2, Math.round(city.population * 0.12));
        const need = Math.max(0, levy - soldiersNow);
        if (need <= 0) continue;

        const food = city.stock.get('food');
        const civilians = this.entities.filter(e =>
          e.cityId === cityId && e.hp > 0 && !e.isChild &&
          e.profession !== 'soldier' && e.profession !== 'king' && e.profession !== 'none'
        );
        // Workers that can be spared without cutting food production.
        const nonFood = civilians.filter(e => e.profession !== 'farmer' && e.profession !== 'woodcutter');
        const pool = nonFood.length > 0 && food >= city.population * 1.2
          ? nonFood
          : food >= city.population * 3 ? civilians : [];
        if (pool.length === 0) continue;

        const priority: Record<string, number> = { builder: 0, scout: 1, miner: 2, woodcutter: 3, farmer: 4 };
        const ordered = pool.sort((a, b) => (priority[a.profession] ?? 9) - (priority[b.profession] ?? 9));

        for (let i = 0; i < Math.min(openSlots, need, 4, ordered.length); i++) {
          const e = ordered[i];
          const b = barracksList.find(bb => bb.assignedWorkerIds.size < (bb.definition.jobs ?? 0) * bb.level);
          if (!b) break;
          if (e.workplaceId) city.buildings.get(e.workplaceId)?.assignedWorkerIds.delete(e.id);
          e.profession = 'soldier';
          e.workplaceId = b.id;
          b.assignedWorkerIds.add(e.id);
          e.aiState = 'idle';
          e.aiCooldown = 5;
          chronicle.log(this.currentYear, 'society', `🪖 ${e.fullName} foi convocado em ${city.name} para a guerra.`);
        }
      }
    }
  }

  // ===================== FAMILIES & REPRODUCTION (YEARLY) =====================

  /**
   * Couples form, children are born, and bloodlines carry traits forward.
   * This is the only source of new citizens — settlements grow because people
   * actually have families in them.
   */
  private tickFamilies(tileMap: TileMap): void {
    const byCity = new Map<string, Entity[]>();
    for (const e of this.entities) {
      if (!e.cityId || !SPECIES_DEFINITIONS[e.species].isHumanoid) continue;
      if (!byCity.has(e.cityId)) byCity.set(e.cityId, []);
      byCity.get(e.cityId)!.push(e);
    }

    for (const [cityId, residents] of byCity) {
      const city = this.cities.get(cityId);
      if (!city) continue;

      const housing = Math.max(4, city.housingCapacity());
      const crowded = residents.length >= housing;
      const foodPerHead = city.stock.get('food') / Math.max(1, residents.length);

      // Courtship: pair off unattached adults.
      const single = residents.filter(e => !e.partnerId && e.isFertile(SPECIES_DEFINITIONS[e.species].maxAge));
      for (let i = 0; i < single.length; i++) {
        if (single[i].partnerId) continue;
        for (let j = i + 1; j < single.length; j++) {
          if (single[j].partnerId) continue;
          if (!canPairWith(single[i], single[j])) continue;
          if (!rng.chance(0.45)) continue;
          formPartnership(single[i], single[j]);
          break;
        }
      }

      // Childbirth: only when there is food and room.
      if (crowded || foodPerHead < 1.6) continue;

      const couples = new Set<string>();
      for (const parent of residents) {
        if (parent.gender !== 'female' || parent.isPregnant) continue;
        if (!parent.partnerId || couples.has(parent.id)) continue;
        const partner = this.entities.find(e => e.id === parent.partnerId);
        if (!partner || partner.cityId !== cityId) continue;

        couples.add(parent.id);
        couples.add(partner.id);

        const maxAge = SPECIES_DEFINITIONS[parent.species].maxAge;
        if (!parent.isFertile(maxAge) || !partner.isFertile(maxAge)) continue;

        // Settlements have to actually grow: population drives the tier, the tier
        // drives building slots and territory, and those drive everything else.
        // At the old rate a couple produced a child roughly every seven years and
        // no settlement ever reached town size within a playable span.
        let chance = 0.7 * city.prosperity + Math.min(0.32, foodPerHead / 20);

        if (!rng.chance(chance)) continue;

        const father = partner.gender === 'male' ? partner : parent;
        const mother = parent.gender === 'female' ? parent : partner;

        // Start Gestation / Pregnancy Phase!
        const gestation = SPECIES_DEFINITIONS[mother.species].gestationYears ?? 1;
        mother.isPregnant = true;
        mother.pregnancyTimer = gestation;
        mother.pregnantFatherId = father.id;
        mother.showEmote('🤰', 60);

        chronicle.log(
          this.currentYear,
          'society',
          `🤰 ${mother.fullName} está gestando um novo herdeiro(a) com ${father.fullName} em ${city.name}.`
        );

        city.ledger.recordConsumed('food', city.stock.take('food', 4));
      }
    }
  }

  private findWalkableNear(x: number, y: number, radius: number, tileMap: TileMap): { x: number; y: number } {
    for (let i = 0; i < 10; i++) {
      const nx = x + rng.rangeInt(-radius, radius);
      const ny = y + rng.rangeInt(-radius, radius);
      const tile = tileMap.getTile(nx, ny);
      if (tile && !tile.type.includes('ocean') && tile.type !== TerrainType.MOUNTAIN) return { x: nx, y: ny };
    }
    return { x, y };
  }

  /**
   * The enemy settlement this soldier should march on, or null in peacetime.
   *
   * Realms concentrate on the nearest enemy city, so armies converge into a real
   * siege rather than scattering across the whole front.
   */
  private pickRaidTarget(soldier: Entity): City | null {
    if (!soldier.kingdomId) return null;
    const enemies = this.diplomacy.getEnemies(soldier.kingdomId);
    if (enemies.length === 0) return null;

    // A realm being invaded defends itself before it goes raiding.
    const homeUnderSiege = [...this.cities.values()].find(
      c => c.kingdomId === soldier.kingdomId && c.besiegerId
    );
    if (homeUnderSiege) {
      return homeUnderSiege;
    }

    let best: City | null = null;
    let bestScore = Infinity;

    for (const city of this.cities.values()) {
      if (!city.kingdomId || !enemies.includes(city.kingdomId)) continue;
      const distance = Math.hypot(city.x - soldier.x, city.y - soldier.y);
      // Prefer close, weakly held settlements.
      const score = distance + city.defenseMultiplier() * 12;
      if (score < bestScore) {
        bestScore = score;
        best = city;
      }
    }

    // Don't send armies on a march they cannot finish before the war is over.
    return best && Math.hypot(best.x - soldier.x, best.y - soldier.y) < 55 ? best : null;
  }

  /** Nearest tile carrying any harvestable deposit. Used by miners. */
  private findNearestResourceTile(x: number, y: number, tileMap: TileMap, radius: number) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let best = null;
    let bestDist = Infinity;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tile = tileMap.getTile(cx + dx, cy + dy);
        if (!tile || !tile.resourceType || !MINEABLE_GOODS.includes(tile.resourceType)) continue;
        if (tile.resourceAmount <= 0) continue;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; best = tile; }
      }
    }
    return best;
  }

  private tickAge(): void {
    const toKill: Entity[] = [];

    for (const e of [...this.entities]) {
      if (e.fertilityCooldown > 0) e.fertilityCooldown--;

      // Anyone living in a city gets a roof if the city has one going spare —
      // not just the citizens who happened to be handed a job this year.
      if (e.cityId && !e.homeBuildingId && SPECIES_DEFINITIONS[e.species].isHumanoid) {
        const home = this.cities.get(e.cityId);
        if (home) this.claimHome(e, home);
      }

      // Soldiers are armed in the armoury, not on the battlefield. Equipping only
      // at the moment of combat left every garrison standing around empty-handed
      // and made the whole military-production chain invisible.
      this.autoArmSoldier(e);

      // Process Gestation & Birth Event
      if (e.isPregnant) {
        e.pregnancyTimer--;
        e.showEmote('🤰', 40);
        if (e.pregnancyTimer <= 0) {
          this.processBirthEvent(e);
        }
      }

      if (e.traits.has(TraitId.IMMORTAL)) continue;

      const oldAge = e.age;
      e.age++;
      const maxAge = SPECIES_DEFINITIONS[e.species].maxAge;
      const isHumanoid = SPECIES_DEFINITIONS[e.species].isHumanoid;

      // --- INFANT MORTALITY (age 0→1) ---
      // Infants have a baseline risk of dying from disease. City prosperity
      // mitigates this heavily — well-fed, safe settlements keep them alive.
      if (oldAge <= 2 && e.lifeStage === 'infant') {
        const city = e.cityId ? this.cities.get(e.cityId) : null;
        const prosperity = city?.prosperity ?? 0;
        let risk = isHumanoid ? 0.03 : 0.06;
        // Prosperity ≥ 0.6 cuts risk by 80%
        if (prosperity >= 0.6) risk *= 0.2;
        if (rng.chance(risk)) {
          toKill.push(e);
          chronicle.log(this.currentYear, 'society',
            isHumanoid
              ? `🕊️ Bebê ${e.fullName} (${Math.floor(e.age)} anos) faleceu por doença infantil em ${city?.name ?? 'terras ermas'}.`
              : `🕊️ Filhote ${e.name} (${e.species}) não sobreviveu à infância.`);
          continue;
        }
      }

      // --- First birthday milestone ---
      if (oldAge === 0 && e.age === 1 && isHumanoid) {
        const city = e.cityId ? this.cities.get(e.cityId) : null;
        if (city) {
          chronicle.log(this.currentYear, 'society',
            `🍼 ${e.fullName} sobreviveu ao primeiro ano de vida em ${city.name}!`);
        }
      }

      // --- Adolescent milestone (age 13) ---
      if (oldAge === 12 && e.age === 13 && isHumanoid) {
        e.showEmote('📖', 50);
        if (e.cityId && this.cities.has(e.cityId)) {
          const city = this.cities.get(e.cityId)!;
          chronicle.log(this.currentYear, 'society',
            `📖 ${e.fullName} tornou-se adolescente em ${city.name}.`);
        }
      }

      // Coming of age at 18: Gains full adult status!
      if (oldAge < 18 && e.age >= 18) {
        e.showEmote('✨', 60);
        e.recalculateStats();
        e.hp = e.maxHp; // Full heal — physical maturation complete
        if (e.cityId && this.cities.has(e.cityId)) {
          const city = this.cities.get(e.cityId)!;
          if (e.profession === 'none') {
            this.assignProfession(e, city);
          }
          chronicle.log(
            this.currentYear,
            'society',
            `✨ ${e.fullName} alcançou a idade adulta (18 anos) e ganhou cidadania plena em ${city.name}!`
          );
        }
      }

      // Mortality climbs steeply once past the species' natural span.
      if (e.age > maxAge * 0.85) {
        const frailty = (e.age - maxAge * 0.85) / (maxAge * 0.3);
        if (rng.chance(0.05 + frailty * 0.25)) e.hp = 0;
      }
    }

    // Kill entities that didn't survive infancy
    for (const dead of toKill) {
      dead.hp = 0;
      this.handleEntityDeath(dead, null!);
    }
  }

  /**
   * Wildlife breeds.
   *
   * `tickFamilies` only ever handled humanoids, so fauna could die but never
   * replace itself: predators ate the herds, then starved, and every world ended
   * up empty of animals within a decade. Herds recover where there is room.
   */
  private tickWildlife(tileMap: TileMap): void {
    const counts = new Map<SpeciesType, Entity[]>();
    for (const e of this.entities) {
      if (SPECIES_DEFINITIONS[e.species].isHumanoid || e.hp <= 0) continue;
      let list = counts.get(e.species);
      if (!list) { list = []; counts.set(e.species, list); }
      list.push(e);
    }

    // Carrying capacity scales with the land, so a big map holds a big ecosystem.
    const area = tileMap.width * tileMap.height;
    const isPredator = (s: SpeciesType) =>
      s === SpeciesType.WOLF || s === SpeciesType.BEAR || s === SpeciesType.DRAGON || s === SpeciesType.EAGLE;

    for (const [species, members] of counts) {
      // Predators sit at the top of the chain, so there are far fewer of them.
      const cap = isPredator(species)
        ? Math.max(2, Math.round((area / 900) * 0.22))
        : Math.max(6, Math.round((area / 900) * 1.8));
      if (members.length >= cap) continue;

      // A lone survivor cannot repopulate; a pair can.
      const breeding = members.filter(m => m.age >= 1 && m.hp > m.maxHp * 0.5);
      if (breeding.length < 2) continue;

      // Prey breed fast — that is the whole reason a herd survives being hunted.
      const litters = Math.max(1, Math.floor(breeding.length / (isPredator(species) ? 4 : 2)));
      for (let i = 0; i < litters; i++) {
        if (this.entities.filter(e => e.species === species).length >= cap) break;
        if (!rng.chance(isPredator(species) ? 0.35 : 0.6)) continue;
        const parent = rng.pick(breeding);
        const calf = this.spawnEntity(species, parent.x + rng.range(-1, 1), parent.y + rng.range(-1, 1), tileMap);
        calf.age = 0;
      }
    }
  }

  private processBirthEvent(mother: Entity): void {
    mother.isPregnant = false;
    mother.pregnancyTimer = 0;
    mother.fertilityCooldown = rng.rangeInt(2, 4);

    const city = mother.cityId ? this.cities.get(mother.cityId) : null;
    const kingdom = mother.kingdomId ? this.kingdoms.get(mother.kingdomId) : null;

    let fatherEntity: Entity;
    const fatherMember = mother.pregnantFatherId ? (this.entities.find(e => e.id === mother.pregnantFatherId) || this.deceasedAncestors.get(mother.pregnantFatherId)) : null;

    if (fatherMember && !('isDeceased' in fatherMember)) {
      fatherEntity = fatherMember as Entity;
    } else {
      fatherEntity = new Entity(`f_${Date.now()}`, mother.species, mother.x, mother.y, fatherMember?.name ?? 'Pai Ancestral');
      fatherEntity.dynasty = fatherMember?.dynasty ?? mother.dynasty;
    }

    const birthX = mother.homeX ?? mother.x;
    const birthY = mother.homeY ?? mother.y;

    // Check for Twin Birth (5% chance)
    const isTwins = rng.chance(0.05);
    const birthCount = isTwins ? 2 : 1;

    for (let b = 0; b < birthCount; b++) {
      const { child } = conceiveChild(fatherEntity, mother, birthX + (b * 0.3), birthY, () => nextId('ent'));
      child.showEmote('👶', 60);

      // Identity: this child has a real birthplace and birth year, and inherits
      // the mother's household rather than starting life as an isolated adult.
      child.birthYear = this.currentYear;
      child.birthCityId = city?.id ?? mother.birthCityId;
      child.birthCityName = city?.name ?? mother.birthCityName;
      child.householdId = mother.householdId ?? fatherEntity.householdId;
      if (child.householdId) this.households.get(child.householdId)?.memberIds.add(child.id);
      child.homeBuildingId = mother.homeBuildingId;
      child.homeX = mother.homeX;
      child.homeY = mother.homeY;
      child.wealth = 0;

      // Check for Royal Birth
      const isRoyal = (fatherEntity.profession === 'king' || mother.profession === 'king') || (kingdom && kingdom.rulerId === mother.id);

      if (isRoyal && kingdom) {
        chronicle.log(
          this.currentYear,
          'king',
          `👑 Nascimentos Imperiais! Nasceu o herdeiro(a) real ${child.fullName} da Dinastia ${kingdom.dynasty ?? child.dynasty} em ${city?.name ?? 'Capital'}!`
        );
      } else {
        chronicle.log(
          this.currentYear,
          'society',
          isTwins
            ? `👶👶 Gêmeos! Nasceu ${child.fullName}, filho(a) de ${fatherEntity.name} e ${mother.name} em ${city?.name ?? 'Vila'}!`
            : `👶 Nasceu ${child.fullName}, filho(a) de ${fatherEntity.name} e ${mother.name} em ${city?.name ?? 'Vila'}!`
        );
      }

      this.entities.push(child);
      this.spatialHash.insert(child);
      this.totalBirths++;
    }

    if (city) city.ledger.recordConsumed('food', city.stock.take('food', 4));
    sound.playMagic();
  }

  private handleEntityDeath(dead: Entity, particles: ParticleManager): void {
    // Release the house and the job slot. Without this the dead keep occupying
    // beds and workplaces forever and the settlement silently stops hiring.
    const homeCity = dead.cityId ? this.cities.get(dead.cityId) : null;
    if (homeCity) {
      if (dead.homeBuildingId) homeCity.buildings.get(dead.homeBuildingId)?.residentIds.delete(dead.id);
      if (dead.workplaceId) homeCity.buildings.get(dead.workplaceId)?.assignedWorkerIds.delete(dead.id);
    }

    // Leave the household. What they were carrying is simply lost with them.
    if (dead.householdId) {
      const household = this.households.get(dead.householdId);
      if (household) {
        household.memberIds.delete(dead.id);
        if (household.memberIds.size === 0) this.households.delete(dead.householdId);
      }
    }
    dead.carrying = null;

    // Record ancestor in genealogy history map before removal
    this.deceasedAncestors.set(dead.id, {
      id: dead.id,
      name: dead.name,
      dynasty: dead.dynasty,
      fullName: dead.fullName,
      species: dead.species,
      gender: dead.gender,
      birthYear: Math.max(1, this.currentYear - dead.age),
      deathYear: this.currentYear,
      ageAtDeath: dead.age,
      profession: dead.profession,
      title: dead.title,
      isGreatPerson: dead.isGreatPerson,
      fatherId: dead.fatherId,
      motherId: dead.motherId,
      partnerId: dead.partnerId,
      childrenIds: [...dead.childrenIds],
      generation: dead.generation,
      isDeceased: true
    });

    const idx = this.entities.indexOf(dead);
    if (idx !== -1) this.entities.splice(idx, 1);
    this.spatialHash.remove(dead);
    this.totalDeaths++;

    // Death particles (skip if called from infant mortality with no particle manager)
    if (particles) particles.spawnExplosion(dead.x, dead.y, '#ef4444', 8);

    // Boss / Hero loot drop
    if (dead.species === SpeciesType.DRAGON || dead.species === SpeciesType.BEAR || dead.profession === 'king' || dead.level >= 5) {
      const nearbyHumanoids = this.spatialHash.queryRadius(dead.x, dead.y, 4)
        .filter(e => SPECIES_DEFINITIONS[e.species].isHumanoid);
      if (nearbyHumanoids.length > 0) {
        const hero = rng.pick(nearbyHumanoids);
        const itemTemplate = rng.pick(LEGENDARY_ITEMS);
        const item = { ...itemTemplate, id: `item_${Date.now()}` };
        if (item.type === 'weapon') hero.equipment.weapon = item;
        else hero.equipment.armor = item;
        hero.recalculateStats();
        chronicle.log(this.currentYear, 'disaster', `${hero.name} looted the legendary ${item.name} from the slain ${dead.name}!`);
      }
    }

    if (dead.cityId && this.cities.has(dead.cityId)) {
      const city = this.cities.get(dead.cityId)!;
      city.population = Math.max(0, city.population - 1);
      city.unassignWorker(dead.id);
    }

    if (dead.partnerId) {
      const partner = this.entities.find(e => e.id === dead.partnerId);
      if (partner) partner.partnerId = null;
    }

    if (dead.profession === 'king' && dead.kingdomId && this.kingdoms.has(dead.kingdomId)) {
      const kingdom = this.kingdoms.get(dead.kingdomId)!;
      const title = kingdom.rulerTitle;
      chronicle.log(this.currentYear, 'king', `${title} ${dead.fullName} of ${kingdom.name} has passed away.`);

      const candidates = this.entities.filter(e => e.kingdomId === kingdom.id && e.id !== dead.id);
      const successionMode = GOVERNMENTS[kingdom.government].succession;
      const heir = chooseSuccessor(dead.id, kingdom.dynasty, candidates, successionMode);

      if (heir) {
        heir.profession = 'king';
        kingdom.rulerId = heir.id;

        if (successionMode === 'bloodline' && heir.dynasty) {
          kingdom.dynasty = heir.dynasty;
        } else if (!heir.dynasty) {
          heir.dynasty = generateDynastyName(heir.species);
          kingdom.dynasty = heir.dynasty;
        } else {
          kingdom.dynasty = heir.dynasty;
        }

        const how = successionMode === 'election' ? 'was elected'
          : (heir.fatherId === dead.id || heir.motherId === dead.id) ? 'inherited the throne as heir'
          : 'seized the throne';
        chronicle.log(this.currentYear, 'king', `${heir.fullName} ${how} of ${kingdom.name}.`);
        events.emit('rulerCrowned', { kingdom, ruler: heir, previous: dead, year: this.currentYear });
      } else {
        kingdom.rulerId = null;
        chronicle.log(this.currentYear, 'king', `${kingdom.name} is left without a ruler.`);
      }
    }
  }
}
