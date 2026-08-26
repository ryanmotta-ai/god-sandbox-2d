import { Entity } from '../entities/Entity';
import { SpeciesType, SPECIES_DEFINITIONS } from '../entities/Species';
import { TraitId } from '../entities/Traits';
import { AIState } from '../entities/Needs';
import { TileMap } from '../world/TileMap';
import { TerrainType, TERRAINS } from '../world/Biomes';
import { WorldEra } from '../world/WeatherEras';
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
import { rng, nextId, hashString, hashToUnit, stableSlot, MARCH_SLOTS } from '../core/Random';
import { TICKS_PER_DAY, DAYS_PER_YEAR, DAYS_PER_SEASON, SEASONS_PER_YEAR, TICKS_PER_SEASON, TICKS_PER_YEAR, type Season } from '../core/Clock';
import { GoodId, GOODS, MINEABLE_GOODS, QUARRY_GOODS } from '../civ/Goods';
import { tileResourceToGood } from '../world/Tile';
import { events } from '../core/EventBus';
import { CivilizationEngine, type CivWorld } from '../civ/CivilizationEngine';
import { canPairWith, formPartnership, conceiveChild, chooseSuccessor, generateDynastyName, DeceasedEntityRecord } from '../civ/Lineage';
import { Household } from '../civ/Household';
import {
  DemographicsAccumulator, emptyDemographics, familyAdvantage, inheritFamilyMarks,
  inheritOrigin, pruneAncestors, rootedness, settleEstate, uproot, type Demographics
} from '../civ/Generations';
import { assignCityBlueprint } from '../civ/CityBlueprints';
import type { Profession } from '../entities/Needs';
import {
  CultureRegistry, CultureCensus, assimilate, considerEmergence, inheritCulture
} from '../civ/CulturalIdentity';
import { startingWealthFor } from '../entities/Identity';
import { HUNGER_PER_DAY, HUNGER_SEEK_FOOD, HUNGER_STARVING, ENERGY_EXHAUSTED, MEAL_ADULT, MEAL_CHILD, MEAL_RELIEF, SOCIAL_DECAY_PER_DAY, SOCIAL_LONELY } from '../entities/Needs';
import {
  bondWith, decayBonds, decayMemories, huntWillingness, inheritPsyche, migrationUrge,
  remember, standGroundChance
} from '../entities/Psyche';
import { GOVERNMENTS } from '../civ/Government';
import { WarfareSystem, SIEGE_RADIUS, terrainCombatModifier, determineUnitRole } from '../civ/Warfare';
import { WarFrontSystem, SECTOR_RADIUS } from '../civ/WarFronts';
import { SIEGE_GATE_PUSH } from '../civ/WarFronts';
import { MilitaryLogistics } from '../civ/MilitaryLogistics';
import { AirSystem } from '../civ/AirSystem';
import { NavalInvasionSystem } from '../civ/NavalInvasion';
import { EntityRelevanceTracker, RELEVANCE_CADENCE, shouldTickEntity, type RelevanceContext } from '../perf/EntityRelevance';
import { perfProfiler } from '../perf/PerformanceProfiler';
import { RegionState } from '../world/WorldChunks';
import { EcologySystem } from '../ecology/EcologySystem';
import { buildingArchitecturalStamp, refreshArchitecturalProfile } from '../civ/ArchitecturalProfile';

// The world clock lives in core/Clock so both this layer and the civilisation
// layer can read it without importing each other. Re-exported because a great
// deal of the codebase already reaches for these through this module.
export { TICKS_PER_DAY, DAYS_PER_YEAR, DAYS_PER_SEASON, SEASONS_PER_YEAR, TICKS_PER_SEASON, TICKS_PER_YEAR } from '../core/Clock';
export type { Season } from '../core/Clock';

/** Where a rotation over the living has got to. See `SimulationEngine.rotate`. */
interface EntityRotation {
  /** The snapshot being walked this lap. */
  ring: Entity[];
  cursor: number;
  /** Fractional citizens owed this tick, carried between ticks. */
  credit: number;
}

/**
 * Tiles moved per tick, per point of species baseSpeed.
 *
 * Sized against the working day: the 08:00-18:00 shift is ~250 ticks, so a
 * citizen must cover roughly 15 tiles in that window to reach a forest or a mine
 * and get back. Too low and nobody ever arrives anywhere before dusk sends them
 * home, and the whole settlement looks like it is sleepwalking.
 */
const MOVE_PER_TICK = 0.055;

/**
 * Food per citizen a settlement keeps back from day-to-day meals.
 *
 * A citizen takes roughly three meals a year at `MEAL_ADULT`, so ~1.35 food a
 * head, and the yearly pass wants `FOOD_PER_CITIZEN` on top. This floor is the
 * only dial between "nobody ever goes hungry beside a full store" and "a town
 * eats its seed corn in a week" — turn it down if settlements hoard, up if they
 * strip themselves bare before winter.
 */
const FOOD_RESERVE_PER_HEAD = 1.5;

/** Cap on how fast a body's visual facing can turn, in rad/tick (12 rad/s at the fixed 60 ticks/s rate above). */
const MAX_TURN_PER_TICK = 12 / 60;
/** How long a "checking the way" pause holds a citizen still when it triggers, in ticks (~0.3s at 1x). */
const HESITATION_TICKS = 18;
/** States calm enough for a citizen to pause and look both ways — combat, flight and siege never hesitate. */
const CALM_STATES = new Set<AIState>([
  'idle', 'wander', 'patrol', 'gather_wood', 'gather_food', 'gather_ore',
  'craft', 'eat', 'deliver', 'explore', 'return_home', 'go_to_work'
]);

const ATTACK_COOLDOWN = 8; // Ticks between attacks
const COMBAT_RANGE = 1.8;
const HUNT_RANGE = 3.5; // thrown spear / bow range for a hunting citizen
const DETECTION_RANGE = 8;
const FLEE_THRESHOLD = 0.25; // Flee when HP below 25%

/**
 * What a person can win from the ground with their hands and a pick.
 *
 * Stone was missing from this. Food and wood could always be foraged, but stone
 * came only from a quarry building — so a settlement that spent its starting
 * thirty stone before it could afford one, or whose seam ran dry, could never
 * build anything of stone again. Barracks, walls and keeps all cost stone, so
 * that one omission quietly closed off the entire military tree.
 */
const HAND_GATHERABLE: GoodId[] = [...MINEABLE_GOODS, ...QUARRY_GOODS];

/** How far past its housing a settlement will still bear children at all. */
const OVERCROWDING_LIMIT = 1.85;
/** Grievance a distant realm needs before it will consider war. */
const WAR_GRIEVANCE_BASE = -14;
/**
 * How much of that grievance a shared border excuses.
 *
 * This number has to clear an equilibrium, not just look reasonable, and twelve
 * did not.
 *
 * `tickDiplomacy` only pushes a relation down while it is *above* +5 (-0.75 a
 * year) and only up while below -5 (+0.5 a year). So an ordinary pair of realms
 * whose other pressures net out below three quarters of a point settles at
 * exactly +5 and stays there for the life of the world — a measured run shows the
 * closest pair of realms reading 5 at year 10 and 5 again at year 30. At twelve,
 * two realms 21 tiles apart needed to reach 0 to consider war, and the restoring
 * force defends everything under +5. Zero wars in a hundred and ten years.
 *
 * Thirty is the smallest value that puts the gate above that pinned +5 at a
 * realistic border distance: neighbours sharing a fence open at +16, a pair 21
 * tiles apart at +7, and a realm across the map still needs the real blood feud
 * of -14 that the comment above always claimed. Crossing the gate is still only
 * the price of admission — the roll after it is a few percent a year, weighted by
 * government aggression, relative power and border ambition.
 */
const WAR_GRIEVANCE_PROXIMITY = 30;

/**
 * SOC-V2 migration limits.
 *
 * `MAX_RELOCATIONS_PER_YEAR` is the cost ceiling, not a balance value: each move
 * rewrites two settlements' resident and worker tables, so an unbounded exodus in
 * a famine year is a frame spike. Wanting to leave is unbounded and is what the
 * player sees; actually leaving is metered.
 */
const MAX_RELOCATIONS_PER_YEAR = 12;
/** How far a citizen will consider moving, in tiles. Beyond this is MIG-V1's job. */
const MIGRATION_RANGE = 60;
/** Urge above which a citizen starts looking for somewhere else to live. */
const RELOCATION_URGE = 0.5;

/**
 * The trade a workplace implies.
 *
 * Lifted out of `assignProfession` because SOC-V3 needs to ask the same question
 * in reverse — "which open job matches what this family has always done" — and
 * two copies of this mapping would drift apart the first time a building is added.
 */
function professionForBuilding(type: BuildingType): Profession {
  switch (type) {
    case 'farm': case 'pasture': return 'farmer';
    case 'lumber_camp': return 'woodcutter';
    case 'mine': case 'quarry': case 'oil_well': return 'miner';
    case 'barracks': return 'soldier';
    case 'library': case 'academy': return 'scout';
    default: return 'builder';
  }
}

/** A settlement's condition, read once a year and shared by all its residents. */
interface CityMood {
  /** 0..1 perceptible danger: besieged, at war, or at peace. */
  danger: number;
  foodPerHead: number;
  prosperity: number;
  /** Open job slots across every operational building. */
  vacancies: number;
  /** 0..1 how good a place this is to live right now. */
  opportunity: number;
}

export class SimulationEngine {
  public entities: Entity[] = [];
  public deceasedAncestors: Map<string, DeceasedEntityRecord> = new Map();
  public cities: Map<string, City> = new Map();
  public kingdoms: Map<string, Kingdom> = new Map();
  public diplomacy: DiplomacyManager = new DiplomacyManager();
  public spatialHash: SpatialHash<Entity> = new SpatialHash<Entity>(8);
  /** Coarse ownership index: every entity belongs to one logical world chunk. */
  public entityChunks: SpatialHash<Entity> = new SpatialHash<Entity>(32);
  public citySpatialHash: SpatialHash<City> = new SpatialHash<City>(16);
  private entitiesById: Map<string, Entity> = new Map();

  public air: AirSystem = new AirSystem();
  /** Armies at sea. Trade hulls carry goods; these carry people. */
  public invasions: NavalInvasionSystem = new NavalInvasionSystem();
  /** Families — who lives under one roof. Keyed by householdId. */
  public households: Map<string, Household> = new Map();
  /** Per-head family wealth, held for one year. See `familyWealthPerHead`. */
  private familyWealthCache: Map<string, number> = new Map();
  private familyWealthCacheYear: number = -1;
  /** Every cultural identity that exists (CULT-V1). Small, serialized whole. */
  public cultures: CultureRegistry = new CultureRegistry();
  /** Last map ticked. The daily pass needs terrain but is not handed one. */
  private lastTileMap: TileMap | null = null;
  /** Runs everything slow and structural, once per simulated year. */
  public civ: CivilizationEngine = new CivilizationEngine();
  /** Resolves sieges and transfers cities taken by force. */
  public warfare: WarfareSystem = new WarfareSystem();
  /** WAR-V2: where each war is actually being fought. */
  public fronts: WarFrontSystem = new WarFrontSystem();
  /** WAR-V3: what the armies on those fronts are being fed. */
  public logistics: MilitaryLogistics = new MilitaryLogistics();
  /** Habitat and population accounting; individual animal AI remains regional. */
  public ecology: EcologySystem = new EcologySystem();

  public currentYear: number = 1;
  public currentSeasonIndex: number = 0;
  public currentSeason: Season = 'spring';
  private yearTickCounter: number = 0;
  /**
   * Ticks since the world began, never reset.
   *
   * The civilisation layer needs a monotonic clock, not a calendar one: it
   * charges each settlement for the time since *that settlement* was last
   * looked at, and `yearTickCounter` rolls back to zero every new year.
   */
  public totalTicks: number = 0;
  public timeOfDay: 'dawn' | 'day' | 'dusk' | 'night' = 'day';

  /** Lifetime counters surfaced by the Statistics screen. */
  public totalBirths: number = 0;
  public totalDeaths: number = 0;
  /**
   * SOC-V3 population snapshot, rebuilt once a year by `tickLives` from the walk
   * it was already making. Derived — never saved, never trusted as state.
   */
  public demographics: Demographics = emptyDemographics();
  private birthsThisYear: number = 0;
  private deathsThisYear: number = 0;
  /** PERF-V1 kill switch used by reproducible before/after benchmarks. */
  public performanceFeatures = { entityLOD: true };
  private simulationTick: number = 0;
  private entityTickStride: number = 1;
  private relevanceTracker = new EntityRelevanceTracker();
  private readonly regionalEntityScratch: Entity[] = [];
  private readonly regionalQueryScratch: Entity[] = [];
  private readonly regionalEntityIds = new Set<string>();
  private readonly queryScratch: Entity[] = [];
  private readonly threatScratch: Entity[] = [];
  private readonly enemyScratch: Entity[] = [];
  private readonly flockScratch: Entity[] = [];
  private readonly stepResultScratch = { x: 0, y: 0, blocked: false };

  /**
   * The climatic era in force, mirrored from `EraManager`.
   *
   * The manager lives in `main.ts` and the simulation never had a way to see it,
   * which is exactly why five named climate epochs had no effect on any harvest.
   * `EraManager.setEra` emits on every change including on load, so subscribing
   * here keeps the two in step without threading the manager through the whole
   * yearly chain — and a headless harness that never touches main.ts still runs
   * under the neutral default.
   */
  public currentEra: WorldEra = WorldEra.GOLDEN_AGE;

  constructor() {
    events.on('eraChanged', (era: any) => {
      if (typeof era === 'string') this.currentEra = era as WorldEra;
    });
  }

  private rebuildEntityIndex(): void {
    this.entitiesById.clear();
    for (const entity of this.entities) this.entitiesById.set(entity.id, entity);
  }

  public getEntity(id: string | null | undefined): Entity | null {
    if (!id) return null;
    if (this.entitiesById.size !== this.entities.length) this.rebuildEntityIndex();
    return this.entitiesById.get(id) ?? null;
  }

  public entitiesNear(x: number, y: number, radius: number): Entity[] {
    return this.spatialHash.queryRadius(x, y, radius);
  }

  public entitiesInChunk(chunkX: number, chunkY: number): Entity[] {
    return this.entityChunks.queryRect(chunkX * 32, chunkY * 32, chunkX * 32 + 31.999, chunkY * 32 + 31.999);
  }

  private regionalTickCandidates(tileMap: TileMap, context?: RelevanceContext): readonly Entity[] {
    if (!this.performanceFeatures.entityLOD || !context || this.simulationTick % RELEVANCE_CADENCE.cold === 0) return this.entities;
    const result = this.regionalEntityScratch; result.length = 0; this.regionalEntityIds.clear();
    for (const chunk of tileMap.chunkStore.chunks) {
      if (chunk.state === RegionState.SLEEPING) continue;
      const minX = chunk.cx * tileMap.chunkSize, minY = chunk.cy * tileMap.chunkSize;
      const local = this.entityChunks.queryRect(minX, minY, minX + tileMap.chunkSize - .001, minY + tileMap.chunkSize - .001, this.regionalQueryScratch);
      for (const entity of local) if (!this.regionalEntityIds.has(entity.id)) { this.regionalEntityIds.add(entity.id); result.push(entity); }
    }
    const priorityIds = [...(context.selectedEntityIds ?? []), ...(context.trackedEntityId ? [context.trackedEntityId] : [])];
    for (const id of priorityIds) {
      const entity = this.getEntity(id); if (entity && !this.regionalEntityIds.has(id)) { this.regionalEntityIds.add(id); result.push(entity); }
    }
    return result;
  }

  public citiesNear(x: number, y: number, radius: number): City[] {
    if (this.citySpatialHash.size !== this.cities.size) this.citySpatialHash.rebuild(this.cities.values());
    return this.citySpatialHash.queryRadius(x, y, radius);
  }

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
    this.entityChunks.insert(entity);
    this.entitiesById.set(entity.id, entity);
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
  public tickAI(tileMap: TileMap, particles: ParticleManager, relevanceContext?: RelevanceContext): void {
    this.lastTileMap = tileMap;
    this.simulationTick++;
    const entityAIStarted = performance.now();
    // The index is maintained incrementally. Rebuild only after load/import or
    // another bulk replacement that bypassed spawn/death hooks.
    if (this.spatialHash.size !== this.entities.length) this.spatialHash.rebuild(this.entities);
    if (this.entityChunks.size !== this.entities.length) this.entityChunks.rebuild(this.entities);
    if (this.citySpatialHash.size !== this.cities.size) this.citySpatialHash.rebuild(this.cities.values());
    if (this.entitiesById.size !== this.entities.length) this.rebuildEntityIndex();
    if (import.meta.env?.DEV && this.simulationTick % 600 === 0 && !this.spatialHash.validate(this.entities)) {
      console.warn('[PERF-V1] spatial index drift detected; rebuilding derived index');
      this.spatialHash.rebuild(this.entities);
    }

    // 2. Process each entity
    const deadEntities: Entity[] = [];
    const tickCandidates = this.regionalTickCandidates(tileMap, relevanceContext);
    let hotEntities = 0;
    let warmEntities = 0;
    let coldEntities = Math.max(0, this.entities.length - tickCandidates.length);

    for (const e of tickCandidates) {
      if (e.hp <= 0) { deadEntities.push(e); continue; }
      /**
       * Anyone at sea is the fleet's business until they are put ashore.
       *
       * This has to come before everything below, and in particular before the
       * anti-water rule a few lines down, which teleports any entity standing on
       * water back to the nearest land — it would pluck an entire invasion off
       * its own hulls the tick after it sailed. `NavalInvasionSystem` moves them
       * with the fleet and hands them back when they land or drown.
       */
      if (e.aboardFleetId) continue;
      const currentTile = tileMap.getTile(Math.floor(e.x), Math.floor(e.y));
      let relevance = this.performanceFeatures.entityLOD ? this.relevanceTracker.classify(e, relevanceContext, this.simulationTick) : 'hot';
      // Environmental hazards and active combat can never be abstracted.
      if (currentTile?.isOnFire || currentTile?.type === TerrainType.LAVA) relevance = 'hot';
      if (relevance === 'hot') hotEntities++;
      else if (relevance === 'warm') warmEntities++;
      else coldEntities++;
      if (!shouldTickEntity(e, relevance, this.simulationTick)) continue;

      const stride = RELEVANCE_CADENCE[relevance];
      this.entityTickStride = stride;
      // Save previous position for facing direction
      e.prevX = e.x;
      e.prevY = e.y;

      // Ease-out: an entity that doesn't actively step this tick (idle, fighting,
      // resting) settles back toward a standstill instead of holding whatever
      // cruising speed it last had. `moveEntityToward` eases it back up again
      // the moment it actually walks somewhere.
      if (e.currentSpeed > 0.0001) e.currentSpeed *= 0.86; else e.currentSpeed = 0;

      // Anti-water safety check: Units MUST NOT walk on water or be inside water
      if (currentTile && TERRAINS[currentTile.type].isWater) {
        const safe = SimplePathfinder.findNearestLand(e.x, e.y, tileMap);
        if (safe) {
          e.x = safe.x;
          e.y = safe.y;
        }
      }

      // Cooldowns
      if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - stride);
      if (e.aiCooldown > 0) e.aiCooldown = Math.max(0, e.aiCooldown - stride);
      if (e.emoteTimer > 0) {
        e.emoteTimer -= stride;
        if (e.emoteTimer <= 0) e.emote = null;
      }

      // Environmental damage
      if (currentTile) {
        if (currentTile.isOnFire || currentTile.type === TerrainType.LAVA) {
          {
            const dmg = e.traits.has(TraitId.FLAMMABLE) ? 30 : 15;
            e.hp -= dmg * stride;
            particles.spawnDamageNumber(e.x, e.y, dmg * stride, 'critical');
            // AI: Flee from fire
            if (e.aiState !== 'flee') {
              e.aiState = 'flee';
              e.aiCooldown = 20;
              // Burning is not something anyone puts behind them.
              if (SPECIES_DEFINITIONS[e.species].isHumanoid) remember(e.memories, 'fire', this.currentYear, 0.5);
            }
          }
        }
        // Regen trait. Only the living regenerate — otherwise a regenerator
        // heals off the killing blow before the death check ever sees it, and
        // becomes accidentally immortal.
        if (e.hp > 0 && e.traits.has(TraitId.REGENERATOR) && e.hp < e.maxHp) {
          e.hp = Math.min(e.maxHp, e.hp + 2 * stride);
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
        // Angular inertia: turn toward the new heading at a bounded rate instead
        // of snapping to face it, so a step backward doesn't spin the body 180°
        // in a single frame.
        const desiredAngle = Math.atan2(movedY, movedX);
        const angleDiff = Math.atan2(Math.sin(desiredAngle - e.facingAngle), Math.cos(desiredAngle - e.facingAngle));
        e.facingAngle += Math.max(-MAX_TURN_PER_TICK, Math.min(MAX_TURN_PER_TICK, angleDiff));
        if (Math.abs(movedX) > 0.003) {
          e.facing = movedX > 0 ? 1 : -1;
        }

        // Particle feedback: footstep dust puffs on dry land
        if (relevance === 'hot' && Math.random() < 0.04 && currentTile && !TERRAINS[currentTile.type].isWater) {
          particles.spawnParticle(e.x, e.y + 0.3, 'rgba(180, 150, 110, 0.25)', (Math.random() - 0.5) * 0.04, -0.02, 0.3);
        }

        // Flocking Separation: gentle push so characters walk alongside each other instead of stacking
        if (isHumanoid && relevance === 'hot') {
          const neighbors = this.spatialHash.queryRadius(e.x, e.y, 0.4, this.flockScratch);
          const myFx = Math.cos(e.facingAngle);
          const myFy = Math.sin(e.facingAngle);
          for (let ni = 0; ni < neighbors.length; ni++) {
            const other = neighbors[ni];
            if (other.id !== e.id && other.species === e.species && other.hp > 0) {
              const sepDx = e.x - other.x;
              const sepDy = e.y - other.y;
              const sepDist = Math.hypot(sepDx, sepDy);
              if (sepDist > 0.01 && sepDist < 0.38) {
                let pushX = sepDx / sepDist;
                let pushY = sepDy / sepDist;

                // Meeting someone face-to-face: rather than flinch straight
                // backward, step toward our own right, same as real foot
                // traffic resolves a head-on encounter without either side
                // stopping.
                const otherFx = Math.cos(other.facingAngle);
                const otherFy = Math.sin(other.facingAngle);
                const headOn = myFx * otherFx + myFy * otherFy < -0.3;
                if (headOn) {
                  const rightX = -myFy;
                  const rightY = myFx;
                  pushX = pushX * 0.35 + rightX * 0.65;
                  pushY = pushY * 0.35 + rightY * 0.65;
                  const norm = Math.hypot(pushX, pushY) || 1;
                  pushX /= norm;
                  pushY /= norm;
                }

                const push = (0.38 - sepDist) * 0.025;
                const nx = e.x + pushX * push;
                const ny = e.y + pushY * push;
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
        e.stuckTicks = (e.stuckTicks || 0) + stride;
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

      this.spatialHash.update(e, e.prevX, e.prevY);
      this.entityChunks.update(e, e.prevX, e.prevY);
    }

    this.entityTickStride = 1;
    perfProfiler.record('entityAI', performance.now() - entityAIStarted);
    perfProfiler.setCounter('entities', this.entities.length);
    perfProfiler.setCounter('hotEntities', hotEntities);
    perfProfiler.setCounter('warmEntities', warmEntities);
    perfProfiler.setCounter('coldEntities', coldEntities);

    // Update maritime ships, overland caravans and air services
    this.invasions.update(this.cities, this.entitiesById, this.diplomacy, tileMap, particles, this.currentYear);
    // Overland freight moves under the hood.
    //
    // Nothing economic is lost: the goods are taken from one stockpile and put
    // in the other by the trade tick itself, and a caravan never carried them —
    // it was the picture of the haul, not the haul. What a convoy did carry was
    // the wear. It incremented `roadTraffic` on every tile it crossed, and
    // enough passes turned wilderness into a dirt track and then into a road.
    // That is where the web of lines over the map came from, so standing the
    // convoys down is also what stops the world being drawn on.
    //
    // CaravanSystem is left whole rather than deleted: it is the right code for
    // The world's climate era is the flying weather; an ash-choked sky loses
    // aircraft that a golden age would have brought home.
    this.air.weather = this.currentEra;
    this.air.updateSorties(this.cities, this.currentYear);

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

    // Needs run on a daily cadence — a year is far too coarse for hunger to
    // steer anybody's behaviour. Called every tick because the pass now deals
    // its citizens out a few at a time rather than all on the stroke of midnight.
    this.tickDay();

    this.totalTicks++;

    // The calendar still turns — the year is what ages a citizen and dates the
    // chronicle — but nothing waits for it any more.
    if (this.yearTickCounter >= TICKS_PER_YEAR) {
      this.yearTickCounter = 0;
      this.currentYear++;
      this.tickAge();
      this.civ.tickYearBoundary(this.civWorld(tileMap));
      this.air.resetYear();
      this.reportAirService();
    }
    this.currentSeasonIndex = Math.floor(this.yearTickCounter / TICKS_PER_SEASON) % SEASONS_PER_YEAR;
    this.currentSeason = (['spring', 'summer', 'autumn', 'winter'] as const)[this.currentSeasonIndex] ?? 'spring';

    // Civilisation, dealt out a few settlements at a time. See `tickRealtime`.
    perfProfiler.measure('economy', () => this.civ.tickRealtime(this.civWorld(tileMap), this.totalTicks));

    perfProfiler.measure('lives', () => this.tickLives());
    this.tickLifeSlices(tileMap);
    this.tickStatecraftSlices(tileMap);
  }

  /**
   * The view of the world the civilisation layer works against.
   *
   * Built once and updated in place. This is read every single tick now rather
   * than four times a year, and handing it a fresh object and a fresh closure
   * sixty times a second is exactly the garbage the continuous pass exists to
   * avoid. `entities` is reassigned because the array itself can be replaced.
   */
  private civWorldCache: CivWorld | null = null;
  private civWorld(tileMap: TileMap): CivWorld {
    if (!this.civWorldCache) {
      this.civWorldCache = {
        year: this.currentYear,
        season: this.currentSeason,
        cities: this.cities,
        kingdoms: this.kingdoms,
        entities: this.entities,
        tileMap,
        diplomacy: this.diplomacy,
        era: this.currentEra,
        spawn: (species, x, y) => this.spawnEntity(species, x, y),
        sim: this
      };
      return this.civWorldCache;
    }
    const w = this.civWorldCache;
    w.year = this.currentYear;
    w.season = this.currentSeason;
    w.entities = this.entities;
    w.tileMap = tileMap;
    w.era = this.currentEra;
    return w;
  }

  /**
   * The passes that are about living things rather than institutions.
   *
   * Each one still comes up once per season's worth of ticks, so pregnancies
   * still take as long and a herd still breeds as often. They just no longer
   * all land on the same frame as each other or as the civilisation pass.
   */
  private tickLifeSlices(tileMap: TileMap): void {
    const slots = 3;
    const stride = Math.max(1, Math.floor(TICKS_PER_SEASON / slots));
    if (this.totalTicks % stride !== 0) return;

    switch (Math.floor(this.totalTicks / stride) % slots) {
      case 0: this.tickPregnancies(); break;
      case 1: this.tickFamilies(tileMap); break;
      default: this.tickWildlife(tileMap); break;
    }
  }

  /**
   * Statecraft and war, on their own rotation.
   *
   * War is NOT thinned out here — every pass it always ran still runs, in the
   * same order and with the same logic. The three war passes stay welded
   * together in one slot because that order is load-bearing: the front decides
   * where the lines are and who is standing on them, logistics decides what
   * those armies are being fed, and only then is the fighting resolved and the
   * sieges pressed. Splitting them across ticks would resolve a battle against
   * last tick's supply.
   */
  private tickStatecraftSlices(tileMap: TileMap): void {
    const slots = 4;
    const stride = Math.max(1, Math.floor(TICKS_PER_SEASON / slots));
    if (this.totalTicks % stride !== 0) return;

    switch (Math.floor(this.totalTicks / stride) % slots) {
      case 0:
        this.tickSuccession();
        this.diplomacy.tickDiplomacy([...this.kingdoms.keys()], this.currentYear);
        break;
      case 1:
        this.tickGeopolitics();
        break;
      case 2:
        this.musterArmies();
        // After the levy, so a realm decides who sails with the army it has now
        // rather than the one it had last season.
        this.invasions.tickYear(this.kingdoms, this.cities, this.entities, this.diplomacy, tileMap, this.currentYear);
        this.air.planSorties(this.cities, this.kingdoms, this.diplomacy);
        break;
      default: {
        const warWorld = {
          year: this.currentYear,
          cities: this.cities,
          kingdoms: this.kingdoms,
          entities: this.entities,
          tileMap,
          diplomacy: this.diplomacy
        };
        perfProfiler.measure('fronts', () => this.fronts.tickYear(warWorld));
        perfProfiler.measure('logistics', () => this.logistics.tickYear({ ...warWorld, fronts: this.fronts }));
        perfProfiler.measure('fronts', () => this.fronts.resolveYear(warWorld));
        perfProfiler.measure('warfare', () => this.warfare.tickYear({ ...warWorld, fronts: this.fronts }));
        break;
      }
    }
  }

  /** Whether the world has ever seen a scheduled flight, so the first is news. */
  private airServiceOpened: boolean = false;

  /** What the year cost and did in the air. */
  private reportAirService(): void {
    this.reportAirWar();
    this.reportAirLosses();
  }

  /**
   * Records what the year cost in aircraft.
   *
   * Its own pass, ahead of the service and war reports, because both of those
   * return early on a quiet year and a realm can lose a bomber in a year it
   * flew no scheduled service at all.
   */
  private reportAirLosses(): void {
    const loss = this.air.lastLoss;
    if (this.air.yearlyLosses === 0 || !loss) return;
    chronicle.log(
      this.currentYear,
      'trade',
      this.air.yearlyLosses === 1
        ? `An aircraft was lost this year on the ${loss.from}–${loss.to} run.`
        : `${this.air.yearlyLosses} aircraft were lost this year, the last of them on the ${loss.from}–${loss.to} run.`
    );
  }

  /** Whether anywhere has yet been bombed from the air, so the first time is news. */
  private airWarOpened: boolean = false;

  /**
   * Records the year's bombing.
   *
   * Kept apart from the service report rather than folded into it, because a
   * realm can be fighting an air war without running a single scheduled flight
   * — and that report returns early when nothing is scheduled, which would have
   * left the whole campaign invisible.
   */
  private reportAirWar(): void {
    if (this.air.yearlySorties === 0) return;
    const raid = this.air.sorties.values().next().value;
    if (!this.airWarOpened) {
      this.airWarOpened = true;
      chronicle.log(
        this.currentYear,
        'war',
        raid
          ? `${raid.toCityName} was bombed from the air, by aircraft flying out of ${raid.fromCityName}. A city can no longer be defended only at its walls.`
          : 'A city was bombed from the air for the first time.',
        {
          title: 'The First Raid',
          importance: 'legendary',
          scope: 'world',
          tags: ['aviation', 'war']
        }
      );
      return;
    }
    if (this.air.yearlySorties < 6) return;
    chronicle.log(
      this.currentYear,
      'war',
      `Bombers flew ${this.air.yearlySorties} sorties this year, leaving ${Math.round(this.air.yearlyBombDamage)} points of damage behind them.`
    );
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
  /**
   * A rotation over the living.
   *
   * The passes that used to walk every citizen at once — the daily needs round,
   * the yearly life round, the wildlife round — each cost a hundred-odd
   * milliseconds on a modest world, which is a visible freeze however rarely it
   * lands. So they take turns instead: each citizen is still visited once per
   * `period` ticks, so a day's hunger and a year's ageing arrive exactly as
   * often as before, but the visits are dealt out a handful per tick.
   *
   * The ring is a snapshot taken at the top of each lap. Someone born mid-lap
   * therefore waits until the next one, and someone who dies mid-lap is skipped
   * by the `hp` check — both of which are already true of anything that walks a
   * list while the world changes underneath it.
   */
  private rotate(state: EntityRotation, period: number, work: (e: Entity) => void, closeLap?: () => void): void {
    // Credit accrues against the ring being walked, NOT against the live entity
    // count. They are the same at the top of a lap and drift apart as the world
    // breeds: charging the growing count made every lap close early, so a
    // citizen collected two days of hunger per day in a growing world. The lap
    // is a lap of the list it started with; the newcomers join the next one.
    state.credit += (state.ring.length || this.entities.length) / period;
    while (state.credit >= 1) {
      state.credit -= 1;
      if (state.cursor >= state.ring.length) {
        closeLap?.();
        state.ring = this.entities.slice();
        state.cursor = 0;
        if (state.ring.length === 0) return;
      }
      const e = state.ring[state.cursor++];
      if (e.hp > 0) work(e);
    }
  }

  private dayRotation: EntityRotation = { ring: [], cursor: 0, credit: 0 };
  private livesRotation: EntityRotation = { ring: [], cursor: 0, credit: 0 };
  private wildlifeRotation: EntityRotation = { ring: [], cursor: 0, credit: 0 };

  private tickDay(): void {
    this.rotate(this.dayRotation, TICKS_PER_DAY, e => this.liveADay(e));
  }

  /** One citizen's day: hunger, comfort, safety, and a meal if they need one. */
  private liveADay(e: Entity): void {
    if (!SPECIES_DEFINITIONS[e.species].isHumanoid) return;
    {

      // Everyone settled belongs to a family. Without this, anyone who never
      // claimed a house had no pantry to eat from and quietly starved.
      const household = e.cityId ? this.householdFor(e) : null;
      this.mergeHouseholdWithPartner(e);

      const needs = e.needs;
      // Children eat less; the elderly tire faster.
      const appetite = e.isChild ? 0.65 : 1;
      needs.hunger = Math.min(100, needs.hunger + HUNGER_PER_DAY * appetite);

      // Dependants are fed from the town store rather than sent out to forage for
      // themselves. Adults still walk there to eat, because that is the part
      // worth watching.
      if (household && (e.isChild || needs.hunger >= HUNGER_STARVING)) {
        const portion = e.isChild ? MEAL_CHILD : MEAL_ADULT;
        if (this.eatFromCityStore(e, portion, needs.hunger >= HUNGER_STARVING)) {
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
      const nearbyDay = this.spatialHash.queryRadius(e.x, e.y, 7, this.queryScratch);
      let threats = 0;
      let neighbours = 0;
      for (let ni = 0; ni < nearbyDay.length; ni++) {
        const o = nearbyDay[ni];
        if (this.isEnemy(e, o) || this.isFaunaThreat(o)) threats++;
        if (o.id !== e.id && o.hp > 0 && SPECIES_DEFINITIONS[o.species].isHumanoid) neighbours++;
      }
      const safetyTarget = Math.max(5, 88 - threats * 22);
      needs.safety += (safetyTarget - needs.safety) * 0.35;

      // Company. Loneliness accrues on its own and is only paid off by other
      // people being nearby, which is what makes an isolated frontier settler
      // measurably worse off than a townsman without needing a second system.
      const company = Math.min(4, neighbours) * 9;
      needs.social = Math.max(0, Math.min(100, needs.social - SOCIAL_DECAY_PER_DAY + company));

      // Starvation. Deliberately slow: hunger should be a crisis the player can
      // see building and respond to, not a silent culling every few days.
      if (needs.hunger >= HUNGER_STARVING) {
        e.starvingDays++;
        if (e.starvingDays > 2) e.hp -= 1.5 + e.starvingDays * 0.6;
        e.showEmote('💀', 60);
        // Real hunger is remembered. This is the link between one bad harvest and
        // a citizen who leaves at the first sign of the next one.
        if (e.starvingDays === 3) remember(e.memories, 'famine', this.currentYear, 0.5);
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
    const partner = this.getEntity(e.partnerId);
    if (!partner?.householdId || partner.householdId === e.householdId) return;

    const mine = this.households.get(e.householdId);
    const theirs = this.households.get(partner.householdId);
    if (!mine || !theirs) return;

    // The older household absorbs the newer one, so family history survives.
    const [keep, absorb] = mine.foundedYear <= theirs.foundedYear ? [mine, theirs] : [theirs, mine];
    for (const memberId of absorb.memberIds) {
      keep.memberIds.add(memberId);
      const member = this.getEntity(memberId);
      if (member) member.householdId = keep.id;
    }
    this.households.delete(absorb.id);
  }

  /**
   * A hungry citizen eats off the settlement's own shelves.
   *
   * This is the entire food economy. No purse, no pantry, no price: a meal is
   * lifted straight out of `city.stock`, so the pile of grain a player can see
   * in a town is the pile its people are living on. A shortage therefore bites
   * everybody at once instead of reaching the dinner table through a family's
   * bank balance.
   *
   * `FOOD_RESERVE_PER_HEAD` is what the store holds back — seed, and the ration
   * the yearly pass still has to cover. Someone actually starving eats into it
   * anyway, because a town watching its own people die beside a full granary is
   * the one outcome worse than an empty one. Returns whether they ate.
   */
  private eatFromCityStore(e: Entity, portion: number, starving: boolean): boolean {
    const city = e.cityId ? this.cities.get(e.cityId) : null;
    if (!city) return false;

    const stored = city.stock.get('food');
    const floor = starving ? 0 : city.population * FOOD_RESERVE_PER_HEAD;
    if (stored - floor < portion) return false;

    const taken = city.stock.take('food', portion);
    if (taken <= 0) return false;

    // Booked against the settlement's yearly ration so the same mouths are not
    // fed twice — once here and once in the annual consumption pass.
    city.householdFoodDrawn += taken;
    city.ledger.recordConsumed('food', taken);
    return true;
  }


  /**
   * Pays a worker out of the settlement's own gold, and reports what they got.
   *
   * A wage used to be drawn from an abstract crown treasury that was allowed to
   * go negative — a realm could always make payroll because the number simply
   * went down. Gold is a physical good now, so a town pays out of the gold on
   * its shelves and a town with none pays nothing. That is a harder world, and
   * it is the honest one: a settlement with no gold and no mine has no coin to
   * hand anybody, and the citizen still eats, because eating comes off the
   * granary and not out of a purse.
   */
  private payWageFromStore(city: City | null | undefined, wage: number): number {
    if (wage <= 0 || !city) return 0;
    return city.stock.take('gold', wage);
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

  public getCalendarDate(): { month: number; day: number; year: number; season: string; seasonIcon: string } {
    // Each in-world day is one month of the year. The day-of-month is read off
    // the progress through that day, so the displayed date advances smoothly
    // instead of jumping once per month.
    const dayInYear = Math.floor((this.yearTickCounter % TICKS_PER_YEAR) / TICKS_PER_DAY);
    const month = Math.min(12, Math.floor((dayInYear / DAYS_PER_YEAR) * 12) + 1);
    const dayProgress = (this.yearTickCounter % TICKS_PER_DAY) / TICKS_PER_DAY;
    const day = Math.min(30, Math.floor(dayProgress * 30) + 1);
    const seasonNames = ['Primavera', 'Verão', 'Outono', 'Inverno'];
    const seasonIcons = ['🌱', '☀️', '🍂', '❄️'];
    const season = seasonNames[this.currentSeasonIndex] ?? 'Primavera';
    const seasonIcon = seasonIcons[this.currentSeasonIndex] ?? '🌱';
    return { month, day, year: this.currentYear, season, seasonIcon };
  }

  // ===================== FAUNA AI (ANIMALS) =====================
  private tickFauna(e: Entity, tileMap: TileMap, particles: ParticleManager): void {
    const speed = SPECIES_DEFINITIONS[e.species].baseSpeed * MOVE_PER_TICK * Math.min(6, this.entityTickStride);

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
    const target = this.spatialHash.findClosest(e.x, e.y, 3, other => SPECIES_DEFINITIONS[other.species].isHumanoid && other.hp > 0 && other.age >= 3);
    if (target) {
      const dist = Math.hypot(target.x - e.x, target.y - e.y);
      if (dist <= COMBAT_RANGE) {
        if (e.attackCooldown <= 0) {
          const dmg = Math.max(1, e.damage - target.defense);
          target.hp -= dmg;
          e.attackCooldown = ATTACK_COOLDOWN;
          particles.spawnDamageNumber(target.x, target.y, dmg);
        }
      } else {
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, speed * 1.3, this.stepResultScratch);
        e.x = pos.x; e.y = pos.y;
      }
    } else {
      this.tickGenericFauna(e, tileMap, speed);
    }
  }

  private tickEagleAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const prey = this.spatialHash.findClosest(e.x, e.y, 8, other => (other.species === SpeciesType.DEER || other.species === SpeciesType.BOAR) && other.hp > 0);
    if (prey) {
      const dist = Math.hypot(prey.x - e.x, prey.y - e.y);
      if (dist <= COMBAT_RANGE) {
        if (e.attackCooldown <= 0) {
          const dmg = Math.max(1, e.damage - prey.defense);
          prey.hp -= dmg;
          e.attackCooldown = ATTACK_COOLDOWN;
          particles.spawnDamageNumber(prey.x, prey.y, dmg);
        }
      } else {
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, prey.x, prey.y, tileMap, speed * 1.4, this.stepResultScratch);
        e.x = pos.x; e.y = pos.y;
      }
    } else {
      this.tickGenericFauna(e, tileMap, speed * 1.2);
    }
  }

  private tickMammothAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const target = e.hp < e.maxHp
      ? this.spatialHash.findClosest(e.x, e.y, 4, other => SPECIES_DEFINITIONS[other.species].isHumanoid && other.hp > 0 && other.age >= 3)
      : null;
    if (target) {
      const dist = Math.hypot(target.x - e.x, target.y - e.y);
      if (dist <= COMBAT_RANGE) {
        if (e.attackCooldown <= 0) {
          const dmg = Math.max(1, e.damage - target.defense);
          target.hp -= dmg;
          e.attackCooldown = ATTACK_COOLDOWN;
          particles.spawnDamageNumber(target.x, target.y, dmg);
        }
      } else {
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, speed, this.stepResultScratch);
        e.x = pos.x; e.y = pos.y;
      }
    } else {
      this.tickGenericFauna(e, tileMap, speed * 0.8);
    }
  }

  /** DEER: Peaceful herbivore. Flees from predators and humanoids. Grazes near forests. */
  private tickDeerAI(e: Entity, tileMap: TileMap, speed: number): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 7, this.queryScratch);
    
    // Check for threats — flee from predators, wolves, bears, humanoids
    for (let i = 0; i < nearby.length; i++) {
      const other = nearby[i];
      if (other.id === e.id || other.hp <= 0) continue;
      const isThreat = other.species === SpeciesType.WOLF || other.species === SpeciesType.BEAR ||
                       other.species === SpeciesType.DRAGON || SPECIES_DEFINITIONS[other.species].isHumanoid;
      if (isThreat) {
        const dx = e.x - other.x;
        const dy = e.y - other.y;
        if (dx * dx + dy * dy < 36) {
          e.aiState = 'flee';
          const pos = SimplePathfinder.fleeFrom(e.x, e.y, other.x, other.y, tileMap, speed * 1.5, this.stepResultScratch);
          e.x = pos.x; e.y = pos.y;
          e.targetX = null; e.targetY = null;
          return;
        }
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
  /**
   * The company a predator has to weigh before picking a target: the grown people
   * in sight, which is the only part of `nearby` that risk depends on.
   *
   * Hoisted out because `preyRisk` is asked about every candidate in turn and
   * re-filtered the whole neighbourhood each time — the same scan, once per
   * candidate, for an answer that never varied between them.
   */
  private adultsAmong(nearby: Entity[]): Entity[] {
    return nearby.filter(o => o.hp > 0 && !o.isChild && SPECIES_DEFINITIONS[o.species].isHumanoid);
  }

  private preyRisk(target: Entity, crowd: Entity[], tileMap: TileMap): number {
    if (!SPECIES_DEFINITIONS[target.species].isHumanoid) return 0;

    let risk = 0;
    for (const other of crowd) {
      if (other.id === target.id) continue;
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
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 10, this.queryScratch);
    
    // Flee if badly hurt
    if (e.hp < e.maxHp * 0.2) {
      let threat: Entity | null = null;
      for (let i = 0; i < nearby.length; i++) {
        const o = nearby[i];
        if (SPECIES_DEFINITIONS[o.species].isHumanoid && (e.x - o.x) * (e.x - o.x) + (e.y - o.y) * (e.y - o.y) < 25) {
          threat = o;
          break;
        }
      }
      if (threat) {
        e.aiState = 'flee';
        const pos = SimplePathfinder.fleeFrom(e.x, e.y, threat.x, threat.y, tileMap, speed * 1.3, this.stepResultScratch);
        e.x = pos.x; e.y = pos.y;
        return;
      }
    }

    // Find prey — prefer lone targets, avoid large groups.
    const crowd = this.adultsAmong(nearby);
    let bestPrey: Entity | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < nearby.length; i++) {
      const other = nearby[i];
      if (other.id === e.id || other.species === SpeciesType.WOLF || other.hp <= 0) continue;
      const isDeer = other.species === SpeciesType.DEER;
      const isHumanoid = SPECIES_DEFINITIONS[other.species].isHumanoid && other.age >= 3;
      if (!isDeer && !isHumanoid) continue;

      const dist = SimplePathfinder.distance(e.x, e.y, other.x, other.y);
      // Score: prefer close, weak, lone targets
      let score = -dist;
      if (isDeer) score += 5; // Prefer deer
      if (other.hp < other.maxHp * 0.5) score += 3; // Prefer wounded
      score -= this.preyRisk(other, crowd, tileMap);
      // Count nearby pack members for pack hunting bonus
      let packCount = 0;
      for (let j = 0; j < nearby.length; j++) {
        const p = nearby[j];
        if (p.species === SpeciesType.WOLF && p.id !== e.id && (p.x - other.x) * (p.x - other.x) + (p.y - other.y) * (p.y - other.y) < 64) packCount++;
      }
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
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, bestPrey.x, bestPrey.y, tileMap, speed * 1.2, this.stepResultScratch);
        e.x = pos.x; e.y = pos.y;
      }
      return;
    }

    // No prey: wander
    this.doWander(e, tileMap, speed, 8);
  }

  /** BEAR: Territorial apex predator. Guards area, attacks intruders. Slow but powerful. */
  private tickBearAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 8, this.queryScratch);

    // Attack anything that comes too close (territorial). Same story as the wolf:
    // judging the crowd is one scan, taken once instead of once per candidate.
    const crowd = this.adultsAmong(nearby);
    let closestIntruder: Entity | null = null;
    let closestDistSq = 36; // 6 tiles max
    for (let i = 0; i < nearby.length; i++) {
      const other = nearby[i];
      if (other.id === e.id || other.species === SpeciesType.BEAR || other.hp <= 0) continue;
      // Bears ignore infants — too small to be worth the swipe
      if (SPECIES_DEFINITIONS[other.species]?.isHumanoid && other.age < 3) continue;
      // A bear is territorial, not suicidal: it does not charge a crowd or walk
      // into a settlement to pick a fight.
      if (this.preyRisk(other, crowd, tileMap) > 12) continue;
      const dSq = (e.x - other.x) * (e.x - other.x) + (e.y - other.y) * (e.y - other.y);
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestIntruder = other;
      }
    }

    if (closestIntruder) {
      e.aiState = 'attack';
      e.targetX = closestIntruder.x;
      e.targetY = closestIntruder.y;

      const closestDist = Math.sqrt(closestDistSq);
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
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, closestIntruder.x, closestIntruder.y, tileMap, speed, this.stepResultScratch);
        e.x = pos.x; e.y = pos.y;
      }
      return;
    }

    // Patrol territory slowly
    this.doWander(e, tileMap, speed * 0.6, 5);
  }

  /** DRAGON: Boss entity. Breathes fire, flies over terrain, hunts everything. */
  private tickDragonAI(e: Entity, tileMap: TileMap, particles: ParticleManager, speed: number): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, 16, this.queryScratch);

    // Hunt the strongest nearby target
    let bestTarget: Entity | null = null;
    let bestHp = 0;
    for (let i = 0; i < nearby.length; i++) {
      const other = nearby[i];
      if (other.id === e.id || other.species === SpeciesType.DRAGON || other.hp <= 0) continue;
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
        const hitRange = this.spatialHash.queryRadius(bestTarget.x, bestTarget.y, 2, this.threatScratch);
        for (let i = 0; i < hitRange.length; i++) {
          const victim = hitRange[i];
          if (victim.id === e.id || victim.hp <= 0) continue;
          const dmg = Math.max(10, e.damage - victim.defense);
          victim.hp -= dmg;
          particles.spawnDamageNumber(victim.x, victim.y, dmg);
        }
        // Set tiles on fire
        tileMap.applyBrush(Math.floor(bestTarget.x), Math.floor(bestTarget.y), 2, t => {
          tileMap.igniteTile(t);
        });
        particles.spawnExplosion(bestTarget.x, bestTarget.y, '#f59e0b', 30);
        e.attackCooldown = ATTACK_COOLDOWN + 5;
        sound.playExplosion();
      } else {
        // Fly toward target (faster, ignores some terrain)
        const pos = SimplePathfinder.getStepTowards(e.x, e.y, bestTarget.x, bestTarget.y, tileMap, speed * 1.5, this.stepResultScratch);
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
    const speed = SPECIES_DEFINITIONS[e.species].baseSpeed * MOVE_PER_TICK * Math.min(6, this.entityTickStride);

    // 1. Try to join or found a city if homeless
    if (!e.cityId) {
      this.tryJoinOrFoundCity(e, tileMap);
    }

    // 2. Decide AI state if cooldown expired
    if (e.aiCooldown <= 0) {
      const prevState = e.aiState;
      this.decideHumanoidState(e, tileMap, particles);
      // Micro-hesitation: a citizen who just picked a new errand sometimes
      // pauses half a beat first, as if checking the way, rather than
      // launching into a perfectly instant departure every single time.
      if (e.aiState !== prevState && CALM_STATES.has(e.aiState) && rng.chance(0.05)) {
        e.hesitationTicks = HESITATION_TICKS;
      }
    }

    // 3. Execute current AI state
    this.executeHumanoidState(e, tileMap, particles, speed);
  }

  /** Decide what the humanoid should be doing based on needs, threats, and personality. */
  private decideHumanoidState(e: Entity, tileMap: TileMap, particles: ParticleManager): void {
    const nearby = this.spatialHash.queryRadius(e.x, e.y, DETECTION_RANGE, this.queryScratch);

    // ===== PRIORITY 1: Flee if critically low HP =====
    if (e.hp < e.maxHp * FLEE_THRESHOLD && e.profession !== 'king') {
      let threatFound = false;
      for (let i = 0; i < nearby.length; i++) {
        const o = nearby[i];
        if (o.id === e.id || o.hp <= 0) continue;
        if (this.isEnemy(e, o)) {
          const dSq = (e.x - o.x) * (e.x - o.x) + (e.y - o.y) * (e.y - o.y);
          if (dSq < 36) { threatFound = true; break; }
        }
      }
      if (threatFound) {
        e.aiState = 'flee';
        e.aiCooldown = 15;
        return;
      }
    }

    // ===== PRIORITY 2: Combat if enemies nearby =====
    if (e.kingdomId) {
      let enemyCount = 0;
      for (let i = 0; i < nearby.length; i++) {
        const o = nearby[i];
        if (o.id === e.id || o.hp <= 0) continue;
        if (this.isEnemy(e, o) && o.age >= 3) enemyCount++;
      }
      if (enemyCount > 0) {
        // Who stands and who runs. The observable facts still dominate — being
        // outnumbered and being empty-handed are what anyone can see — but between
        // two people reading the same odds it is disposition and history that
        // decide, so a war does not produce one uniform reaction on a whole street.
        const stand = this.willStandGround(e, enemyCount);
        if (stand) {
          e.aiState = 'attack';
          e.aiCooldown = e.profession === 'soldier' || e.profession === 'king' ? 5 : 6;
          remember(e.memories, 'battle', this.currentYear, 0.35);
          return;
        }
        // Fleeing an enemy at close quarters is the kind of thing that stays with
        // someone, and is why the same person leaves earlier next time.
        remember(e.memories, 'war_survived', this.currentYear, 0.3);
        e.aiState = 'flee';
        e.aiCooldown = 12;
        return;
      }
    }

    // Check for dangerous fauna threats
    let faunaCount = 0;
    for (let i = 0; i < nearby.length; i++) {
      const o = nearby[i];
      if (o.id === e.id || o.hp <= 0) continue;
      if (o.species === SpeciesType.WOLF || o.species === SpeciesType.BEAR || o.species === SpeciesType.DRAGON) {
        const dSq = (e.x - o.x) * (e.x - o.x) + (e.y - o.y) * (e.y - o.y);
        if (dSq < 25) faunaCount++;
      }
    }
    if (faunaCount > 0) {
      // A soldier always turns and fights a beast; a civilian usually runs, but a
      // brave and armed one will not, and that is a decision worth watching.
      const stand = e.profession === 'soldier' || this.willStandGround(e, faunaCount);
      e.aiState = stand ? 'attack' : 'flee';
      e.aiCooldown = stand ? 5 : 12;
      return;
    }

    // ===== PRIORITY 3: Heal if wounded =====
    if (e.hp < e.maxHp * 0.6 && e.aiState !== 'heal') {
      e.aiState = 'heal';
      e.aiCooldown = rng.rangeInt(20, 50);
      return;
    }

    // ===== PRIORITY 4: Eat =====
    // Above work and above the clock: a hungry citizen heads for the store.
    // This is what turns an empty granary into visible behaviour instead of a
    // number nobody can see.
    if (e.cityId && !e.isChild && e.needs.hunger >= HUNGER_SEEK_FOOD && e.aiState !== 'eat') {
      const city = this.cities.get(e.cityId);
      if (city && city.stock.get('food') > 0) {
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

    // ===== PRIORITY 7: Local energy recovery (no map-wide commute) =====
    if (e.cityId) {
      if (this.timeOfDay === 'night' && e.energy < e.maxEnergy * 0.4) {
        e.energy = Math.min(e.maxEnergy, e.energy + 6);
        e.aiState = 'idle';
        e.aiCooldown = rng.rangeInt(10, 20);
        return;
      }
    }

    // ===== PRIORITY 5: Work / Profession-specific tasks (day only) =====
    if (e.cityId && this.cities.has(e.cityId)) {
      const city = this.cities.get(e.cityId)!;

      // Hunting is a fallback food source: it is selected only under shortage
      // and only if a real prey animal is close enough to pursue. Who actually
      // goes after a boar rather than waiting for the granary is a matter of
      // nerve and of how hungry they personally are — ECO decides what there is
      // to hunt, this decides who is willing to try.
      if (!e.isChild && city.stock.get('food') < city.population * 1.25 &&
          rng.chance(huntWillingness(e.psyche, e.needs.hunger)) &&
          this.ecology.findNearbyPrey(e, this.spatialHash.queryRadius(e.x, e.y, 15))) {
        e.aiState = 'hunt';
        e.aiCooldown = rng.rangeInt(18, 35);
        return;
      }

      // Company, when nothing more pressing is owed. Sociable people break off
      // for it sooner, and it is the only way friendships and rivalries form.
      if (!e.isChild && e.needs.social < SOCIAL_LONELY && rng.chance(0.25 + e.psyche.sociability * 0.5)) {
        e.aiState = 'socialize';
        e.aiCooldown = rng.rangeInt(20, 45);
        return;
      }

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
        // A band short of stone sends people to break rock by hand, the same way
        // it sends them to forage. Without this branch nobody ever gathered
        // stone outside a quarry.
        const quarryByHand = !needsFood
          && city.stock.get('stone') < 20
          && !!this.findNearestResourceTile(e.x, e.y, tileMap, 10);
        e.aiState = quarryByHand && rng.chance(0.5) ? 'gather_ore'
          : needsFood || rng.chance(0.6) ? 'gather_food'
          : 'gather_wood';
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

  /** Generates a discrete interaction slot in a ring around a target for an entity to prevent 1-pixel stacking. */
  private getBuildingInteractionSlot(bx: number, by: number, entityId: string): { x: number; y: number } {
    let hash = 0;
    for (let i = 0; i < entityId.length; i++) {
      hash = (hash * 31 + entityId.charCodeAt(i)) & 0xffffffff;
    }
    const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
    const dist = 0.8 + ((Math.abs(hash >> 5) % 100) / 100) * 0.7;
    return {
      x: bx + 0.5 + Math.cos(angle) * dist,
      y: by + 0.5 + Math.sin(angle) * dist
    };
  }
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

    // What the family does, when the family does anything. A leaning worth about
    // as much as one category of preference — enough that farming households
    // visibly stay farming households across generations, nowhere near enough to
    // stop a farmer's son taking the smithy job that is actually open.
    const familyPull = e.familyTrade !== 'none' && rng.chance(0.55 + e.psyche.loyalty * 0.25) ? e.familyTrade : null;

    let best: { building: import('../civ/Building').Building; score: number } | null = null;
    for (const building of city.buildings.values()) {
      const def = building.definition;
      const jobs = def.jobs ?? 0;
      if (!building.isOperational()) continue;
      if (jobs <= 0 || building.assignedWorkerIds.size >= jobs * building.level) continue;
      if (!unlocked.has(building.type)) continue;
      const score = jobs * building.level
        + (def.category === 'food' ? 1000 : def.category === 'extraction' ? 800 : def.category === 'craft' ? 600 : 400)
        + (building.type === 'barracks' ? soldierBoost : 0)
        + (familyPull && professionForBuilding(building.type) === familyPull ? 450 : 0);
      if (!best || score > best.score) best = { building, score };
    }

    if (best) {
      const b = best.building;
      e.profession = professionForBuilding(b.type);

      e.workplaceId = b.id;
      b.assignedWorkerIds.add(e.id);

      // Personal wealth is seeded from the profession, and the profession is only
      // known here — the Entity constructor always ran before anyone had a job, so
      // every citizen alive was starting on a pauper's purse.
      const household = this.householdFor(e);
      // SOC-V3. A young adult from a household with something behind it starts
      // ahead — better tools, a stake, a name that opens a door. Capped well
      // below certainty, because the point is advantage, not inheritance of rank.
      const advantage = 1 + familyAdvantage(e, household ? this.familyWealthPerHead(household) : 0);
      const seeded = startingWealthFor(e.profession, (min, max) => rng.rangeInt(min, max)) * advantage;
      if (seeded > e.wealth) e.wealth = seeded;

      this.claimHome(e, city);
    }
  }

  /**
   * Moves a citizen into a real house with room to spare, so "home" is a building
   * on the map rather than a random patch of ground near the town centre. Falls
   * back to the old drifting offset only when the settlement has no housing left,
   * which is itself a meaningful signal that the city needs to build.
   */
  private claimHome(e: Entity, city: City, seekBetter: boolean = false): void {
    const existing = e.homeBuildingId ? city.buildings.get(e.homeBuildingId) ?? null : null;
    const housed = !!existing?.isOperational();
    if (housed && !seekBetter) return;
    if (e.homeBuildingId && !housed) {
      // The roof is gone — burned, ruined or taken. That is a thing a person
      // carries, and it is why some citizens leave at the first hint of the next
      // war while their neighbours stay.
      remember(e.memories, 'lost_home', this.currentYear, 0.55);
    }

    // Prefer moving in with family already housed, then any house with room.
    const familyIds = new Set([e.partnerId, e.fatherId, e.motherId, ...e.childrenIds].filter(Boolean) as string[]);
    let familyHome: Building | null = null;
    let houseWithRoom: Building | null = null;
    let anyWithRoom: Building | null = null;

    for (const building of city.buildings.values()) {
      if (!building.isOperational()) continue;
      if ((building.definition.housing ?? 0) <= 0) continue;
      if (building.freeHousing() <= 0) continue;
      if (building.id === e.homeBuildingId) continue;
      if (!familyHome && [...building.residentIds].some(id => familyIds.has(id))) familyHome = building;
      // Coin buys a better address: a household that can afford it holds out for
      // the best house going rather than the first one with a spare bed.
      if (building.type === 'house' && (!houseWithRoom || building.level > houseWithRoom.level)) houseWithRoom = building;
      if (!anyWithRoom) anyWithRoom = building;
    }

    // Live with family first, then in proper housing, then wherever there is room.
    let home = familyHome ?? houseWithRoom ?? anyWithRoom;
    // Someone trading up only moves for a genuinely better address. Nothing
    // better on offer means they stay exactly where they are — the old home is
    // never given up before a replacement is found.
    if (housed && home && home !== familyHome && home.level <= existing!.level) home = null;
    if (!home) {
      if (housed) return;
      if (e.homeX == null) {
        e.homeX = city.x + rng.range(-3, 3) * 0.8 + 0.5;
        e.homeY = city.y + rng.range(-3, 3) * 0.8 + 0.5;
      }
      return;
    }

    // Only now is the old bed released, so a failed search can never leave
    // someone homeless in a settlement that had a roof for them.
    existing?.residentIds.delete(e.id);
    home.residentIds.add(e.id);
    e.homeBuildingId = home.id;
    e.homeX = home.x + 0.5;
    e.homeY = home.y + 0.5;

    // A household is the set of people under one roof. Partners share one.
    if (!e.householdId) {
      const partner = this.getEntity(e.partnerId);
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
        const threats = this.spatialHash.queryRadius(e.x, e.y, 8, this.threatScratch);
        let closest: Entity | null = null;
        let closestDistSq = Infinity;
        for (let i = 0; i < threats.length; i++) {
          const o = threats[i];
          if (o.id === e.id || o.hp <= 0) continue;
          if (this.isEnemy(e, o) || this.isFaunaThreat(o)) {
            const dSq = (e.x - o.x) * (e.x - o.x) + (e.y - o.y) * (e.y - o.y);
            if (dSq < closestDistSq) { closest = o; closestDistSq = dSq; }
          }
        }
        if (closest) {
          // Terror outruns a walking pace.
          const fleeSpeed = speed * 1.35;
          const pos = SimplePathfinder.fleeFrom(e.x, e.y, closest.x, closest.y, tileMap, fleeSpeed, this.stepResultScratch);
          e.x = pos.x; e.y = pos.y;
        } else {
          e.aiState = 'idle';
          e.aiCooldown = 0;
        }
        break;
      }

      case 'attack': {
        const nearby = this.spatialHash.queryRadius(e.x, e.y, DETECTION_RANGE, this.queryScratch);
        let target: Entity | null = null;
        let targetDist = Infinity;

        // Auto-arm soldier with tech-tiered equipment if unequipped
        this.autoArmSoldier(e);

        for (let i = 0; i < nearby.length; i++) {
          const other = nearby[i];
          // Skip infant targets — combatants ignore babies
          if (other.lifeStage === 'infant' || other.hp <= 0) continue;
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
          let hasCommanderNearby = false;
          for (let ni = 0; ni < nearby.length; ni++) {
            const o = nearby[ni];
            if (o.kingdomId === e.kingdomId && o.profession === 'king') {
              hasCommanderNearby = true;
              break;
            }
          }
          const moraleMult = hasCommanderNearby ? 1.25 : 1.0;

          // Fatigue modifier (WAR-V4)
          const fatigueMult = e.energy < 20 ? 0.75 : 1.0;

          // Terrain combat modifier (WAR-V4)
          const tile = tileMap.getTile(Math.round(e.x), Math.round(e.y));
          const role = determineUnitRole(e);
          const terrainMult = tile ? terrainCombatModifier(tile.type, role) : 1.0;

          // Reach based on weapon item properties / category
          const weapon = e.equipment.weapon;
          const category = weapon?.category;
          const weaponName = (weapon?.name || '').toLowerCase();

          let maxReach = weapon?.attackRange || (category === 'ranged' ? 6.0 : category === 'siege' ? 9.0 : COMBAT_RANGE);
          if (weaponName.includes('spear') || weaponName.includes('halberd')) maxReach = 2.4;

          if (targetDist <= maxReach && e.attackCooldown <= 0) {
            let dmg = Math.max(1, Math.floor((e.damage - target.defense) * moraleMult * fatigueMult * terrainMult));
            if (category === 'heavy') dmg = Math.max(dmg, Math.floor(e.damage * 0.75 * moraleMult * fatigueMult * terrainMult));

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
                    particles.spawnDamageNumber(tx, ty, d, d >= targetEnt.maxHp * 0.25 ? 'critical' : 'normal');
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
              particles.spawnDamageNumber(target.x, target.y, dmg, dmg >= target.maxHp * 0.25 ? 'critical' : 'normal');
              particles.spawnParticle(target.x, target.y, '#e2e8f0', dx * 0.05, dy * 0.05, 0.4);
              sound.playHit();

              if (target.hp <= 0 && e.kingdomId && target.kingdomId) {
                e.kills++;
                e.gainXp(30 + target.level * 5);
                this.diplomacy.recordBattle(e.kingdomId, target.kingdomId, 1, 0);
              }
            } else {
              // MELEE SLASH / BLUDGEON
              target.hp -= dmg;
              e.attackCooldown = ATTACK_COOLDOWN;

              const isCrit = dmg >= target.maxHp * 0.25;
              particles.spawnDamageNumber(target.x, target.y, dmg, isCrit ? 'critical' : 'normal');
              particles.spawnParticle(target.x, target.y, isCrit ? '#f59e0b' : '#ffffff', 0, 0, 0.25, isCrit ? 4 : 3);
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
              const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, attackSpeed, this.stepResultScratch);
              e.x = pos.x; e.y = pos.y;
            }
          }
        } else {
          // SIEGE WARFARE: If no enemy soldier nearby, attack enemy city buildings & conquer Town Center!
          this.executeSiegeWarfare(e, tileMap, particles, speed);
        }
        break;
      }

      case 'hunt': {
        if (!e.cityId || !this.cities.has(e.cityId) || e.carrying) {
          e.aiState = e.carrying ? 'deliver' : 'idle';
          break;
        }
        const prey = this.ecology.findNearbyPrey(e, this.spatialHash.queryRadius(e.x, e.y, 15));
        if (!prey) { e.aiState = 'gather_food'; e.aiCooldown = 0; break; }
        const distance = SimplePathfinder.distance(e.x, e.y, prey.x, prey.y);
        e.targetX = prey.x; e.targetY = prey.y;
        e.showEmote('🏹', 20);
        if (distance > HUNT_RANGE) {
          // A hunter commits to a short pursuit rather than walking at the
          // civilian pace; otherwise every healthy deer can outrun a human
          // forever and hunting never resolves into an ecological cost.
          // A hunter used to run down prey at four times walking pace, which no
          // deer can outrun, so the herds were emptied before the first farms
          // were finished. Fast enough to catch a straggler, not the whole herd.
          const pos = this.moveEntityToward(e, prey.x, prey.y, tileMap, speed * 1.6);
          if (pos.blocked) { e.targetX = null; e.targetY = null; e.aiCooldown = 0; }
          break;
        }
        if (e.attackCooldown <= 0) {
          const damage = Math.max(5, e.damage + (e.equipment.weapon?.damageBonus ?? 0) - prey.defense);
          prey.hp -= damage;
          prey.huntedById = e.id;
          e.attackCooldown = ATTACK_COOLDOWN + 2;
          particles.spawnDamageNumber(prey.x, prey.y, damage);
          if (prey.hp <= 0) { e.kills++; e.gainXp(4); }
        }
        // Keep closing while a fleeing animal remains in throw range. This
        // prevents the hunter from stopping after each throw and letting prey
        // reset the whole pursuit.
        if (prey.hp > 0 && distance > COMBAT_RANGE) this.moveEntityToward(e, prey.x, prey.y, tileMap, speed * 4);
        break;
      }

      case 'gather_wood': {
        // Not merely visual: this cuts a real load off the tile and carries it
        // into the city store. The yearly pass in CivilizationEngine covers only
        // the citizens who are *not* doing this, so the two do not harvest the
        // same people twice.
        e.showEmote('🪓', 20);
        if (!e.cityId || !this.cities.has(e.cityId)) { e.aiState = 'wander'; break; }
        const gCity = this.cities.get(e.cityId)!;
        if (e.targetX === null || e.targetY === null) {
          // Head for a real timber deposit first. Arid maps carry their wood in
          // scrub and palm stands rather than dense forest, so keying only off
          // FOREST tiles left woodcutters with nowhere to go.
          const deposit = this.nearestDepositOf(e, gCity, 'wood');
          const cached = deposit ?? gCity.nearestCached(TerrainType.FOREST, e.x, e.y);
          let target = cached ?? this.findNearestTileType(e.x, e.y, TerrainType.FOREST, tileMap, 12);
          if (!target) {
            for (let dx = -14; dx <= 14; dx++) {
              for (let dy = -14; dy <= 14; dy++) {
                const tile = tileMap.getTile(Math.floor(e.x + dx), Math.floor(e.y + dy));
                if (tile && tile.resourceType === 'wood' && tile.resourceAmount > 0) {
                  target = { x: tile.x, y: tile.y };
                  break;
                }
              }
              if (target) break;
            }
          }
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
          const pos = this.moveEntityToward(e, e.targetX!, e.targetY!, tileMap, speed);
          if (pos.blocked) { e.targetX = null; e.targetY = null; }
        }
        break;
      }

      case 'gather_food': {
        // Not merely visual: a real load is picked and delivered. The yearly
        // pass covers only the citizens who are not out foraging.
        e.showEmote('🌾', 20);
        if (!e.cityId || !this.cities.has(e.cityId)) { e.aiState = 'wander'; break; }
        const gCity = this.cities.get(e.cityId)!;
        const bld = e.workplaceId ? gCity.buildings.get(e.workplaceId) : null;

        let fx: number;
        let fy: number;
        let slotX: number;
        let slotY: number;
        if (bld) {
          fx = bld.x + 0.5;
          fy = bld.y + 0.5;
          const slot = this.buildingSlot(e.id, bld.id, fx, fy);
          slotX = slot.x; slotY = slot.y;
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
          slotX = fx; slotY = fy;
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
          const pos = this.moveEntityToward(e, slotX, slotY, tileMap, speed);
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
          const pos = this.moveEntityToward(e, hx, hy, tileMap, speed);
          // A hungry citizen used to walk into whatever stood between them and
          // their pantry — a wall, a row of new houses — and keep walking into
          // it until they starved, because this result was never read. If the
          // way home is shut, eat in the field rather than die in front of it.
          if (pos.blocked) {
            e.aiState = 'gather_food';
            e.aiCooldown = rng.rangeInt(10, 20);
          }
          break;
        }

        const portion = e.isChild ? MEAL_CHILD : MEAL_ADULT;
        if (this.eatFromCityStore(e, portion, e.needs.hunger >= HUNGER_STARVING)) {
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
          const slot = this.buildingSlot(e.id, `cityhall_${dCity.id}`, dCity.x, dCity.y);
          const pos = this.moveEntityToward(e, slot.x, slot.y, tileMap, speed);
          if (pos.blocked) { e.targetX = null; e.targetY = null; }
          break;
        }

        const load = e.carrying;
        const stored = dCity.stock.add(load.good, load.amount);
        // Hand-carried output is production too — it must show in the books or the
        // settlement's stock rises out of nowhere.
        dCity.ledger.recordProduced(load.good, stored);

        // Wages. The worker is paid for what they actually brought in, and the
        // money lands in the family purse that buys the family's food.
        //
        // The pay comes out of a real till at the realm's own price. Before, it
        // was minted from nothing at the *world* reference price — a settlement
        const wage = this.payWageFromStore(dCity, stored * GOODS[load.good].basePrice * 0.35);
        e.wealth += wage;

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
          const slot = this.buildingSlot(e.id, bench.id, bx, by);
          this.moveEntityToward(e, slot.x, slot.y, tileMap, speed);
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
          const pos = this.moveEntityToward(e, e.targetX!, e.targetY!, tileMap, speed);
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
          const slot = this.buildingSlot(e.id, bld.id, wx, wy);
          this.moveEntityToward(e, slot.x, slot.y, tileMap, speed);
        }
        break;
      }

      case 'socialize': {
        // Walk to the nearest neighbour and stand with them. Arriving is what
        // pays off loneliness and what opens a tie — a friendship if they get on,
        // a rivalry if two abrasive people end up in the same yard.
        const company = this.spatialHash.findClosest(
          e.x, e.y, DETECTION_RANGE,
          o => o.id !== e.id && o.hp > 0 && SPECIES_DEFINITIONS[o.species].isHumanoid && o.kingdomId === e.kingdomId
        );
        if (!company) { e.aiState = 'wander'; e.aiCooldown = 0; break; }

        if (SimplePathfinder.distance(e.x, e.y, company.x, company.y) < 1.4) {
          e.showEmote('💬', 25);
          e.needs.social = Math.min(100, e.needs.social + 22);
          company.needs.social = Math.min(100, company.needs.social + 14);
          // Two aggressive people rub each other the wrong way; anyone else gets
          // on well enough. One code path, both outcomes, no compatibility matrix.
          const friction = (e.psyche.aggression + company.psyche.aggression) / 2;
          const kind = friction > 0.68 ? 'rival' : 'friend';
          bondWith(e.bonds, company.id, kind, 0.18);
          bondWith(company.bonds, e.id, kind, 0.18);
          e.aiState = 'idle';
          e.aiCooldown = rng.rangeInt(20, 50);
        } else {
          this.moveEntityToward(e, company.x, company.y, tileMap, speed);
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
          this.moveEntityToward(e, hx, hy, tileMap, speed);
        }
        break;
      }
    }
  }

  // ===================== MOVEMENT HELPERS =====================

  /**
   * The one place ordinary citizens (as opposed to combatants and fauna) step
   * toward a destination. Layers three cosmetic behaviours onto the raw
   * `getStepTowards` primitive, all of which fall away to nothing as an
   * entity actually arrives, so none of it changes whether or when a citizen
   * reaches their real target:
   *
   * - A brief hold if a "checking the way" pause just triggered.
   * - Ease-in: eased ground speed ramps toward the requested pace instead of
   *   snapping to it from a standstill.
   * - Lane offset: aims a little to the citizen's own fixed side of the direct
   *   line, so a crowd walking the same errand doesn't share one pixel-exact
   *   path. Shrinks to zero on final approach so everyone still lands on the
   *   actual destination.
   */
  private moveEntityToward(e: Entity, targetX: number, targetY: number, tileMap: TileMap, speed: number): { x: number; y: number; blocked?: boolean } {
    if (e.hesitationTicks > 0) {
      e.hesitationTicks--;
      this.stepResultScratch.x = e.x;
      this.stepResultScratch.y = e.y;
      this.stepResultScratch.blocked = false;
      return this.stepResultScratch;
    }

    e.currentSpeed += (speed - e.currentSpeed) * 0.22;
    const eased = Math.max(0, e.currentSpeed);

    let aimX = targetX;
    let aimY = targetY;
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.2 && SPECIES_DEFINITIONS[e.species].isHumanoid) {
      const laneShrink = Math.min(1, dist / 1.4);
      aimX += (-dy / dist) * e.laneOffset * laneShrink;
      aimY += (dx / dist) * e.laneOffset * laneShrink;
    }

    const pos = SimplePathfinder.getStepTowards(e.x, e.y, aimX, aimY, tileMap, eased, this.stepResultScratch);
    e.x = pos.x; e.y = pos.y;
    return pos;
  }

  /**
   * A stable point on a ring around a building, keyed to one specific
   * visitor. Several citizens converging on the same workbench or town
   * square used to walk to its exact center and stack on one tile; this
   * spreads them around it instead, without any reservation table to keep in
   * sync as citizens arrive, leave or die.
   */
  private buildingSlot(entityId: string, anchorId: string, bx: number, by: number): { x: number; y: number } {
    const seed = hashString(entityId) ^ hashString(anchorId);
    const angle = hashToUnit(seed, 1) * Math.PI * 2;
    const radius = 0.8 + hashToUnit(seed, 2) * 0.7;
    return { x: bx + Math.cos(angle) * radius, y: by + Math.sin(angle) * radius };
  }

  private doWander(e: Entity, tileMap: TileMap, speed: number, radius: number): void {
    if (e.targetX === null || e.targetY === null ||
        SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < 0.3) {
      const target = SimplePathfinder.findRandomWalkable(e.x, e.y, radius, tileMap);
      if (target) { e.targetX = target.x; e.targetY = target.y; }
      else { e.targetX = null; e.targetY = null; return; }
    }
    const pos = this.moveEntityToward(e, e.targetX!, e.targetY!, tileMap, speed);
    if (pos.blocked) { e.targetX = null; e.targetY = null; }
  }

  private doWanderNearCity(e: Entity, city: City, tileMap: TileMap, speed: number, radius: number): void {
    if (e.targetX === null || e.targetY === null ||
        SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < 0.3) {
      const target = SimplePathfinder.findRandomWalkable(city.x, city.y, radius, tileMap);
      if (target) { e.targetX = target.x; e.targetY = target.y; }
      else { e.targetX = null; e.targetY = null; return; }
    }
    const pos = this.moveEntityToward(e, e.targetX!, e.targetY!, tileMap, speed);
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

    /**
     * WAR-V2: a soldier's war is the stretch of line nearest them, not whichever
     * enemy town happens to be closest.
     *
     * Every soldier used to walk to the nearest hostile settlement, which meant
     * an entire realm's army converged on one place and the rest of the border
     * was empty. Holding a sector is now the default; marching on a city is what
     * a soldier does once the ground around that city is theirs.
     */
    const sector = this.fronts.sectorFor(e.kingdomId, e.x, e.y);
    if (sector) {
      const ourPush = this.fronts.pushFor(sector, e.kingdomId);
      const distanceToLine = Math.hypot(sector.x - e.x, sector.y - e.y);

      if (ourPush < SIEGE_GATE_PUSH) {
        e.showEmote('⚔️', 25);
        if (distanceToLine > SECTOR_RADIUS * 0.6) {
          this.marchStepToward(e, sector.x, sector.y, tileMap, speed * 2.5);
          return;
        }
        // On the line. Hold it, spread along it — a front is a line of men, not
        // a ring around a point.
        this.doEncampAround(e, sector.x, sector.y, tileMap, speed * 0.7, SECTOR_RADIUS * 0.75);
        return;
      }
    }

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
      this.marchStepToward(e, enemyCity.x, enemyCity.y, tileMap, speed * 2.5);
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
          if (tile && tile.buildingId === hit.id) {
            tile.buildingId = null;
            tileMap.markRenderDirty(hit.x, hit.y);
            if (hit.fortificationRole) tileMap.markRoadNetworkChanged(hit.x, hit.y);
          }
        }
      }
    }
  }

  /**
   * A soldier's place in the column.
   *
   * Every marching soldier used to be sent at the same single point — the sector
   * centre or the enemy town centre — so an army crossing the map read as a crowd
   * of individuals who happened to be walking the same way. Giving each of them a
   * standing file and rank, measured off the axis they are advancing along, is
   * what turns that crowd into something that looks like it was ordered to be
   * there. The slot comes from the entity id, so a soldier keeps the same place in
   * the line for their whole service and across a replay of the same seed.
   *
   * The offset fades out over the last dozen tiles, and the arrival test upstream
   * still measures the true distance to the objective, so shaping the approach
   * cannot stop an army from reaching it. Once it arrives, `doEncampAround` owns
   * the spacing.
   */
  private marchStepToward(e: Entity, tx: number, ty: number, tileMap: TileMap, speed: number): void {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;

    // Shared with the renderer, which puts the standard in slot 0 — the centre of
    // the front rank, which is where a colour party actually walks.
    const slot = stableSlot(e.id, MARCH_SLOTS);
    const file = (slot % 5) - 2;          // five abreast, centred on the axis
    const rank = Math.floor(slot / 5);    // and up to four ranks deep

    // Close order: a file is a stride and a half apart, a rank a stride behind.
    const spread = Math.min(1, dist / 12);
    const ux = dx / dist;
    const uy = dy / dist;
    const aimX = tx + (-uy * file * 1.5 - ux * rank * 1.1) * spread;
    const aimY = ty + (ux * file * 1.5 - uy * rank * 1.1) * spread;

    const pos = SimplePathfinder.getStepTowards(e.x, e.y, aimX, aimY, tileMap, speed);
    e.x = pos.x; e.y = pos.y;
  }

  // ===================== HELPER CHECKS =====================

  /**
   * Whether this citizen faces a threat instead of running from it.
   *
   * The single place that question is answered, so a wolf at the treeline and an
   * enemy soldier in the street are weighed the same way: by the odds, by what
   * is in their hands, by who is behind them, and by who they are.
   */
  private willStandGround(e: Entity, threats: number): boolean {
    // A pacifist does not pick up the spear. The "Toque de Paz" god power grants
    // this trait and promises an "índole pacifista que evita combates", and it is
    // inherited down the generations — but nothing in the simulation had ever
    // read it, so the power did precisely nothing.
    if (e.traits.has(TraitId.PACIFIST)) return false;
    const family = this.spatialHash.queryRadius(e.x, e.y, 5)
      .some(o => o.id !== e.id && o.hp > 0 && (o.id === e.partnerId || e.childrenIds.includes(o.id)));
    return rng.chance(standGroundChance(e.psyche, {
      outnumbered: threats,
      armed: !!e.equipment.weapon,
      protectingFamily: family,
      trauma: e.trauma,
      isFighter: e.profession === 'soldier' || e.profession === 'king'
    }));
  }

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
        this.rootFounder(e, city.id, city.name);
        if (!e.cultureId) e.cultureId = this.foundCultureFor(city);
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
      assignCityBlueprint(city, tileMap);
      city.population = 1;
      this.cities.set(cityId, city);
      this.citySpatialHash.insert(city);
      e.cityId = cityId;
      tile.cityId = cityId;
      if (!e.birthCityId) {
        e.birthCityId = cityId;
        e.birthCityName = cityName;
      }
      this.rootFounder(e, cityId, cityName);
      // The first population to hold a place defines the culture of that place;
      // a founder who already belongs to one carries it in instead.
      if (e.cultureId) { city.dominantCultureId = e.cultureId; city.cultureMix = { [e.cultureId]: 1 }; city.culturallySettledSince = this.currentYear; }
      else e.cultureId = this.foundCultureFor(city);
      // Whoever puts the first stone down is worth keeping in the record for good.
      e.historic = true;
      chronicle.log(this.currentYear, 'founding', `O assentamento de ${cityName} foi fundado por ${e.name}.`);
      this.checkKingdomFounding(city, e, tileMap);
      // Founded last so the claim is stamped with the kingdom that now owns it.
      city.seedFoundingClaim(tileMap, 4);
    }
  }

  private checkKingdomFounding(city: City, rulerCandidate: Entity, tileMap: TileMap): void {
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
      refreshArchitecturalProfile(city, kingdom, tileMap, this.currentYear);
      if (city.architecturalProfile) {
        for (const building of city.buildings.values()) building.recordArchitecture(buildingArchitecturalStamp(city.architecturalProfile, city.foundingYear));
        city.markBuildingTopologyChanged();
      }

      chronicle.log(this.currentYear, 'kingdom', `O ${kingdom.name} foi estabelecido. ${rulerCandidate.fullName} lidera seu povo.`);
    }
  }

  /**
   * A throne left empty used to stay empty.
   *
   * Succession was only ever attempted at the instant a ruler died. If the realm
   * had no adult to crown right then — a young dynasty, a plague, a lost war —
   * `rulerId` was set to null and never looked at again, so the children who
   * came of age five years later inherited nothing and the realm stayed
   * leaderless for the rest of the world's life.
   */
  private tickSuccession(): void {
    for (const kingdom of this.kingdoms.values()) {
      const ruler = kingdom.rulerId ? this.getEntity(kingdom.rulerId) : null;
      if (ruler && ruler.hp > 0) continue;

      const candidates = this.entities.filter(e => e.kingdomId === kingdom.id && e.hp > 0);
      const heir = chooseSuccessor(null, kingdom.dynasty, candidates, GOVERNMENTS[kingdom.government].succession);
      if (!heir) { kingdom.rulerId = null; continue; }

      heir.profession = 'king';
      kingdom.rulerId = heir.id;
      if (!heir.dynasty) heir.dynasty = generateDynastyName(heir.species);
      kingdom.dynasty = heir.dynasty;

      chronicle.log(this.currentYear, 'king', `${heir.fullName} pôs fim ao interregno e assumiu o trono de ${kingdom.name}.`);
      events.emit('rulerCrowned', { kingdom, ruler: heir, previous: null, year: this.currentYear });
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
        // How close two realms are is a question about their frontiers, not
        // their capitals. Border towns can sit twelve tiles apart while the two
        // capitals are at opposite ends of the map, and measuring capitals made
        // the clause below unreachable for every realm that actually had a
        // neighbour. Same helper the economy uses, so both agree on "close".
        const dist = this.civ.closestRealmDistance(k1, k2, this.cities);
        const proximity = Math.min(1, Math.max(0, 1 - dist / 70));
        // War is a real danger once relations sour; proximity sharpens it.
        if (proximity <= 0) continue;

        // Peace during the first 40 years for foundation and development
        if (this.currentYear < 40) {
          if (relation > -95 || !rng.chance(0.015)) continue;
        }

        const grievanceThreshold = this.currentYear >= 40 ? 6 : WAR_GRIEVANCE_BASE;
        if (relation > grievanceThreshold + proximity * WAR_GRIEVANCE_PROXIMITY) continue;

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
        const hostility = Math.max(0.01, -relation / 100);
        const baseWarRate = this.currentYear >= 40 ? 0.24 : 0.04;
        if (rng.chance(baseWarRate * aggression * confidence * (1 + hostility + proximity * borderAmbition * 1.2))) {
          const reason = aggressor.isEmpire ? 'Expansão Imperial'
            : powerRatio > 1.8 ? 'Conquista Territorial'
            : relation <= -80 ? 'Vingança de Sangue'
            : 'Disputa de Fronteira';
          if (this.diplomacy.declareWar(aggressor.id, defender.id, this.currentYear, reason)) {
            chronicle.log(this.currentYear, 'war', `${aggressor.name} declarou guerra contra ${defender.name}. Motivo: ${reason}`);
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
   * How many of a settlement's people are under arms, and who they are.
   *
   * One number per city, moved toward every year: the watch it keeps in peace,
   * the levy it raises at war — about one citizen in eight, one in five once it
   * has the institution to do it. Food stays protected in both directions: while
   * the city is short on food nobody is taken from the fields, and
   * artisans/miners go before farmers.
   *
   * This used to be a levy alone, and bounded by empty barracks posts — it
   * returned immediately when there were none. That made the rule unreachable in
   * both directions at once: a settlement with no barracks, which is every
   * settlement for the seventy-odd years before a realm researches bronze
   * working, raised nobody at all, and a settlement that had one could never
   * exceed four soldiers per building however large it grew or however badly the
   * war went. Arming somebody needs a spare pair of hands, not a building.
   *
   * The barracks still matters, and matters more than it did. A recruit who fits
   * into a real post is a professional: fed there all year, counted as the city's
   * standing garrison, and never stood down. Everyone above that number carries a
   * spear on the settlement's word and goes back to work when the number falls.
   */
  private musterArmies(): void {
    const atWar = new Set<string>();
    for (const kingdom of this.kingdoms.values()) {
      if (this.diplomacy.getWarsFor(kingdom.id).length > 0) atWar.add(kingdom.id);
    }

    // One pass over the entities, bucketed by settlement, instead of a filter of
    // the whole world inside the per-city loop below.
    const residents = new Map<string, Entity[]>();
    for (const e of this.entities) {
      if (e.hp <= 0 || !e.cityId || !SPECIES_DEFINITIONS[e.species].isHumanoid) continue;
      const list = residents.get(e.cityId);
      if (list) list.push(e);
      else residents.set(e.cityId, [e]);
    }

    for (const kingdom of this.kingdoms.values()) {
      const warring = atWar.has(kingdom.id);
      /**
       * Conscription.
       *
       * `conscription` is unlocked by gunpowder, described to the player, and
       * was never read by anything — one of six technology features the tree
       * granted and no rule consulted. The levée en masse is precisely what it
       * should mean: a realm that has the institution can call up half again as
       * many of its people, and can call up more of them at once.
       */
      const conscripted = kingdom.research.knowsFeature('conscription');

      for (const cityId of kingdom.cityIds) {
        const city = this.cities.get(cityId);
        if (!city) continue;

        const here = residents.get(cityId) ?? [];
        const barracksList = [...city.buildings.values()].filter(b => b.type === 'barracks' && b.isOperational());

        // Professionals hold a real barracks post; the rest carry a spear because
        // the settlement asked them to, and can be asked to stop.
        const professionals: Entity[] = [];
        const militia: Entity[] = [];
        for (const e of here) {
          if (e.profession !== 'soldier') continue;
          (e.workplaceId ? professionals : militia).push(e);
        }

        /**
         * The watch every settlement keeps, barracks or no barracks.
         *
         * A village in the stone age had no way to arm anybody at all: the
         * barracks is the only building that produces the soldier profession and
         * it arrives with bronze working, seventy-odd years in on a measured run.
         * Until then a hundred percent of every population was peasants and
         * woodcutters, wolves included. One or two spearmen is the smallest number
         * that fixes that, and it is deliberately small: a soldier grows no food,
         * and a founding party of eight that posts two guards starves. Hence the
         * floor of twelve residents before the first one is spared.
         */
        const watch = city.population >= 16 ? Math.max(2, Math.floor(city.population * 0.14)) : city.population >= 8 ? 1 : 0;
        const levy = Math.max(4, Math.round(city.population * (conscripted ? 0.35 : 0.24)));
        // War raises the number; peace lets it fall back to the watch, or to the
        // garrison the city actually built, whichever is larger.
        const target = warring ? levy : Math.max(watch, professionals.length);

        const strength = professionals.length + militia.length;

        if (strength > target) {
          // Stand the militia down, greenest first, so a settlement keeps the ones
          // who have actually been in a fight. A professional is never let go.
          militia.sort((a, b) => a.level - b.level || a.xp - b.xp);
          for (const e of militia.slice(0, strength - target)) {
            e.profession = 'none';
            e.aiState = 'idle';
            e.aiCooldown = 5;
            this.assignProfession(e, city);
          }
          continue;
        }

        const need = target - strength;
        if (need <= 0) continue;

        const food = city.stock.get('food');
        const civilians = here.filter(e =>
          !e.isChild && e.profession !== 'soldier' && e.profession !== 'king'
        );
        // Anyone without a job goes first — they were the one group the levy
        // used to skip, by excluding 'none' along with kings and serving
        // soldiers.
        // Workers that can be spared without cutting food production.
        const nonFood = civilians.filter(e => e.profession !== 'farmer' && e.profession !== 'woodcutter');
        const pool = nonFood.length > 0 && food >= city.population * 0.8
          ? nonFood
          : food >= city.population * 1.5 ? civilians : [];
        if (pool.length === 0) continue;

        const priority: Record<string, number> = { none: -1, builder: 0, scout: 1, miner: 2, woodcutter: 3, farmer: 4 };
        const ordered = pool.sort((a, b) => (priority[a.profession] ?? 9) - (priority[b.profession] ?? 9));

        const perYear = conscripted ? 14 : 8;
        for (let i = 0; i < Math.min(need, perYear, ordered.length); i++) {
          const e = ordered[i];
          // A real post if one is free, the watch otherwise.
          const post = barracksList.find(bb => bb.assignedWorkerIds.size < (bb.definition.jobs ?? 0) * bb.level) ?? null;
          if (e.workplaceId) city.buildings.get(e.workplaceId)?.assignedWorkerIds.delete(e.id);
          e.profession = 'soldier';
          e.workplaceId = post?.id ?? null;
          post?.assignedWorkerIds.add(e.id);
          e.aiState = 'idle';
          e.aiCooldown = 5;
          chronicle.log(this.currentYear, 'society', post
            ? `${e.fullName} foi convocado em ${city.name} para o serviço militar.`
            : warring
              ? `${e.fullName} pegou em armas na milícia de ${city.name}.`
              : `${e.fullName} assumiu a guarda de ${city.name}.`);
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
      const crowding = residents.length / housing;
      const foodPerHead = city.stock.get('food') / Math.max(1, residents.length);

      // Courtship: pair off unattached adults.
      const single = residents.filter(e => !e.partnerId && e.isFertile(SPECIES_DEFINITIONS[e.species].maxAge));
      for (let i = 0; i < single.length; i++) {
        if (single[i].partnerId) continue;
        for (let j = i + 1; j < single.length; j++) {
          if (single[j].partnerId) continue;
          if (!canPairWith(single[i], single[j])) continue;
          if (!rng.chance(0.75)) continue;
          formPartnership(single[i], single[j]);
          break;
        }
      }

      /**
       * Childbirth needs food and room — but "room" used to be a cliff. The
       * moment residents reached housing capacity the birth rate became exactly
       * zero, so a settlement filled up, stopped having children entirely, and
       * then died of old age in a single wave: everyone had been born within a
       * few years of each other, so everyone grew old within a few years of each
       * other. Crowding now suppresses births steeply instead of forbidding
       * them, which keeps the pressure to build housing without the die-off.
       */
      if (foodPerHead < 1.0 || crowding >= OVERCROWDING_LIMIT) continue;
      const roomForChildren = crowding < 1 ? 1 : 0.40;

      const couples = new Set<string>();
      for (const parent of residents) {
        if (parent.gender !== 'female' || parent.isPregnant) continue;
        if (!parent.partnerId || couples.has(parent.id)) continue;
        const partner = this.getEntity(parent.partnerId);
        if (!partner || partner.cityId !== cityId) continue;

        couples.add(parent.id);
        couples.add(partner.id);

        const maxAge = SPECIES_DEFINITIONS[parent.species].maxAge;
        if (!parent.isFertile(maxAge) || !partner.isFertile(maxAge)) continue;

        // Settlements have to actually grow: population drives the tier, the tier
        // drives building slots and territory, and those drive everything else.
        let chance = (0.88 * city.prosperity + Math.min(0.50, foodPerHead / 12)) * roomForChildren;

        if (!rng.chance(chance)) continue;

        const father = partner.gender === 'male' ? partner : parent;
        const mother = parent.gender === 'female' ? parent : partner;

        // Start Gestation / Pregnancy Phase! (3 seasons = 9 months)
        const gestation = (SPECIES_DEFINITIONS[mother.species].gestationYears ?? 1) * 3;
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

  // ===================== LIVES (SOC-V2, YEARLY) =====================

  /**
   * A year in the life of every citizen: what they remember, what they do about
   * work and housing, and whether they still want to live where they live.
   *
   * One pass a year, not one a tick. Everything charged to every person here is
   * O(memories) or O(bonds) — both hard-capped — plus a handful of comparisons.
   * The expensive parts (searching for a job, searching for somewhere to live,
   * choosing a destination) are behind cheap triggers and behind a global budget,
   * so a world of ten thousand people does not pay ten thousand searches.
   *
   * The settlement's own condition is read once per settlement and shared by
   * everyone in it. That is what produces a *tendency* — a besieged town empties,
   * a prosperous one fills — while the disposition each person brings to the same
   * reading is what keeps the tendency from being a hundred identical answers.
   */
  /**
   * The slower half of a life, dealt out over a lap rather than all at once.
   *
   * Memory, culture, work, housing and the decision to leave — this used to walk
   * every citizen in the world in one frame, which cost the better part of two
   * hundred milliseconds on a middling world. Each citizen is still visited once
   * per season's worth of ticks, so nothing about the pace of a life changed;
   * they are simply visited a few at a time.
   *
   * The census is the reason a lap matters. It has to describe a whole
   * population, not part of one, so it accumulates across the lap and is
   * published when the lap closes — which is exactly what a census always was.
   */
  private tickLives(): void {
    if (this.livesRotation.ring.length === 0 && this.livesRotation.cursor === 0) this.openLivesLap();
    this.rotate(this.livesRotation, TICKS_PER_SEASON, e => this.liveAYear(e), () => this.closeLivesLap());
  }

  private livesMood: Map<string, CityMood> = new Map();
  private livesCensus: DemographicsAccumulator = new DemographicsAccumulator();
  private livesCultures: CultureCensus = new CultureCensus();
  private livesRelocations: number = 0;
  private livesMovesLeft: number = MAX_RELOCATIONS_PER_YEAR;

  /** Fresh tallies, and this lap's read of how each settlement is doing. */
  private openLivesLap(): void {
    this.livesMood.clear();
    for (const city of this.cities.values()) this.livesMood.set(city.id, this.readCityMood(city));
    this.livesCensus = new DemographicsAccumulator();
    this.livesCultures = new CultureCensus();
    this.livesRelocations = 0;
    // Hard ceiling on relocations per lap. Migration is the one decision here
    // that costs real work (destination search, two building tables rewritten),
    // and an uncapped exodus in a bad year is exactly the frame spike PERF-V1
    // exists to prevent. MIG-V1 can lift this when it owns the movement.
    this.livesMovesLeft = MAX_RELOCATIONS_PER_YEAR;
  }

  /** The lap is over, so the tallies now describe a whole population. */
  private closeLivesLap(): void {
    if (this.livesCensus.counted === 0) { this.openLivesLap(); return; }
    this.demographics = this.livesCensus.finish(
      this.currentYear, this.households.size, this.birthsThisYear, this.deathsThisYear, this.livesRelocations
    );
    this.birthsThisYear = 0;
    this.deathsThisYear = 0;
    this.publishCultures(this.livesCultures);
    this.openLivesLap();
  }

  /** One citizen's slower year. */
  private liveAYear(e: Entity): void {
    if (!SPECIES_DEFINITIONS[e.species].isHumanoid) return;

    // Everyone forgets, including children and wanderers.
    decayMemories(e.memories);
    decayBonds(e.bonds);
    this.livesCensus.count(e);

    if (!e.cityId) return;
    const city = this.cities.get(e.cityId);
    const here = city ? this.livesMood.get(city.id) : undefined;
    if (!city || !here) return;

    // CULT-V1. Children count toward the composition and absorb the place they
    // are growing up in — they are the generation assimilation actually runs
    // through, so excluding them would remove the mechanism entirely.
    if (!e.cultureId) e.cultureId = city.dominantCultureId ?? this.foundCultureFor(city);
    e.cultureId = assimilate(e, city.cultureMix, city.dominantCultureId, this.cultures, here.prosperity);
    this.livesCultures.count(city.id, e.cultureId, e.localGenerations >= 3);

    if (e.isChild) return;

    // What this year did to this person. The cause is shared by the whole
    // settlement; what each of them takes from it is not.
    if (here.danger > 0.5) remember(e.memories, 'war_survived', this.currentYear, here.danger * 0.6);
    if (here.foodPerHead < 1) remember(e.memories, 'famine', this.currentYear, 0.4);
    if (e.profession === 'none') remember(e.memories, 'jobless', this.currentYear, 0.35);
    if (here.prosperity > 0.65 && e.wealth > 40) remember(e.memories, 'prospered', this.currentYear, 0.3);

    this.settleFortune(e);
    this.seekWork(e, city, here);
    this.reconsiderHousing(e, city);

    // How badly they want out of here, before they know whether anywhere else
    // is better. Kept on the entity so colonisation, the inspector and any
    // future migration system all read one agreed number.
    const situation = {
      wellbeing: e.wellbeing,
      jobless: e.profession === 'none' ? 1 : 0,
      hunger: e.needs.hunger,
      danger: here.danger,
      familyTies: this.familyTiesIn(e, city.id),
      rootedness: rootedness(e),
      opportunityElsewhere: 0,
      trauma: e.trauma,
      age: e.age
    };
    e.migrationUrge = migrationUrge(e.psyche, situation);

    // Wanting to leave is not leaving. Looking for somewhere better is the
    // expensive step, so it is gated twice: at half the relocation bar, because
    // a merely dissatisfied person will still glance at a boom town next door
    // and a settled one will not, and then again on the year's move budget.
    if (this.livesMovesLeft <= 0 || e.migrationUrge < RELOCATION_URGE * 0.5) return;
    if (!rng.chance(0.25 + e.migrationUrge * 0.5)) return;

    const destination = this.findBetterSettlement(e, city, this.livesMood);
    if (!destination) return;

    // Asked again, now that somewhere real is on offer. This is where a
    // prosperous neighbour actually pulls people in — and where ambition and
    // curiosity finally weigh against loyalty over the same open door.
    situation.opportunityElsewhere = Math.max(0, this.livesMood.get(destination.id)!.opportunity - here.opportunity);
    e.migrationUrge = migrationUrge(e.psyche, situation);
    if (e.migrationUrge > RELOCATION_URGE) {
      this.relocateCitizen(e, city, destination);
      this.livesMovesLeft--;
      this.livesRelocations++;
    }
  }


  /**
   * Writes the year's cultural composition onto the settlements and asks each of
   * them whether it has earned an identity of its own.
   *
   * Only the settlements that actually had residents counted are touched, and
   * emergence is checked once per settlement per year against thresholds that
   * take decades to satisfy — so in an ordinary year this does nothing but copy
   * a small table.
   */
  private publishCultures(census: CultureCensus): void {
    for (const cityId of census.cityIds()) {
      const city = this.cities.get(cityId);
      if (!city) continue;
      const { mix, dominant, counted, rootedShare } = census.mixFor(cityId);
      // A change of dominant culture restarts the clock a new identity is
      // measured against — a town that just flipped is not a settled one.
      if (dominant !== city.dominantCultureId) city.culturallySettledSince = this.currentYear;
      city.cultureMix = mix;
      city.dominantCultureId = dominant;

      // A settlement is isolated from a culture's homeland when it no longer
      // shares a realm with it. Distance alone is not isolation; a shared state,
      // roads and trade are what keep a population attached to the old country.
      const home = this.cultures.get(dominant)?.homeCityId ?? null;
      const homeCity = home ? this.cities.get(home) : null;
      const isolated = !!home && home !== cityId && (!homeCity || homeCity.kingdomId !== city.kingdomId);

      const emergence = considerEmergence({
        cityId, cityName: city.name, year: this.currentYear, population: counted,
        mix, dominant, rootedShare,
        yearsStable: this.currentYear - city.culturallySettledSince,
        isolated
      }, this.cultures);
      if (!emergence) continue;

      // The people who actually produced it adopt it. Only residents of the
      // parent culture(s) convert, and only here — a culture is born in a place.
      let converted = 0;
      for (const resident of this.entities) {
        if (resident.cityId !== cityId || resident.hp <= 0) continue;
        if (!emergence.fromIds.includes(resident.cultureId)) continue;
        // A hybrid takes the people who had already blended; a divergence takes
        // the ones whose line is deep enough here to have become something else.
        const eligible = emergence.kind === 'hybrid'
          ? resident.localAffinity > 0.35 || rng.chance(0.4)
          : resident.localGenerations >= 2;
        if (!eligible) continue;
        resident.cultureId = emergence.identity.id;
        resident.localAffinity = 0.5;
        converted++;
      }
      if (converted === 0) continue;

      city.dominantCultureId = emergence.identity.id;
      city.culturallySettledSince = this.currentYear;
      chronicle.log(
        this.currentYear,
        'society',
        emergence.kind === 'hybrid'
          ? `🎭 Gerações de convivência em ${city.name} deram origem a uma identidade própria: ${emergence.identity.name} (${converted} pessoas).`
          : `🎭 Isolada da terra de origem, a população de ${city.name} tornou-se um povo distinto: ${emergence.identity.name} (${converted} pessoas).`,
        {
          title: `Nasce ${emergence.identity.name}`,
          importance: 'major',
          scope: 'city',
          refs: [{ kind: 'city', id: city.id, name: city.name }],
          tags: ['culture', emergence.kind]
        }
      );
    }
  }

  /**
   * The culture of a settlement that has none.
   *
   * The first population to hold a place defines the culture of that place. Named
   * for the settlement, because that is how peoples are usually named — after
   * where they are from.
   */
  private foundCultureFor(city: City): string {
    if (city.dominantCultureId) return city.dominantCultureId;
    const identity = this.cultures.create(`Povo de ${city.name}`, this.currentYear, city.id);
    city.dominantCultureId = identity.id;
    city.cultureMix = { [identity.id]: 1 };
    city.culturallySettledSince = this.currentYear;
    return identity.id;
  }

  /**
   * Personal fortune follows the family's, both ways.
   *
   * Wages only ever added to a citizen's purse, so wealth — and with it the
   * social class derived from it — could rise and never fall. A house could not
   * decline, which meant it could not really rise either: there was nothing for
   * a rise to be measured against. Personal coin is pulled toward what the
   * people under this roof hold between them, so a member who falls behind is
   * carried up by prospering kin and a whole house can slide together.
   */
  private settleFortune(e: Entity): void {
    const household = e.householdId ? this.households.get(e.householdId) : null;
    if (!household || household.size === 0) return;
    e.wealth += (this.familyWealthPerHead(household) - e.wealth) * 0.25;
    if (e.wealth < 0) e.wealth = 0;
  }

  /**
   * What the people under one roof hold between them, per head.
   *
   * Memoised for the year, which is not just a speed fix. `settleFortune` walks
   * members one at a time and writes to `wealth` as it goes, so recomputing the
   * mean per member would have each one pulled toward a figure the previous one
   * already moved — the household's total would drift every pass. Freezing the
   * mean for the year makes the pull simultaneous, and a simultaneous pull
   * toward the mean conserves what the family holds. It also stops one large
   * household turning the pass into an O(n^2) walk.
   */
  private familyWealthPerHead(household: Household): number {
    if (this.familyWealthCacheYear !== this.currentYear) {
      this.familyWealthCache.clear();
      this.familyWealthCacheYear = this.currentYear;
    }
    const cached = this.familyWealthCache.get(household.id);
    if (cached !== undefined) return cached;

    let total = 0;
    for (const memberId of household.memberIds) total += this.getEntity(memberId)?.wealth ?? 0;
    const perHead = household.size === 0 ? 0 : total / household.size;
    this.familyWealthCache.set(household.id, perHead);
    return perHead;
  }

  /**
   * Stamps the family origin of someone who predates every settlement.
   *
   * The first generation has no parents to inherit an origin from, so the place
   * they settle becomes the origin their descendants carry — including the
   * descendants who will eventually leave it.
   */
  private rootFounder(e: Entity, cityId: string, cityName: string): void {
    if (e.originCityId) return;
    e.originCityId = cityId;
    e.originCityName = cityName;
    e.localGenerations = 1;
  }

  /** Records a death in the family on whoever is still alive to feel it. */
  private bereave(survivorId: string | null, severity: number): void {
    const survivor = this.getEntity(survivorId);
    if (survivor && survivor.hp > 0) remember(survivor.memories, 'bereavement', this.currentYear, severity);
  }

  /** The settlement's condition, read once a year and shared by everyone in it. */
  private readCityMood(city: City): CityMood {
    let vacancies = 0;
    for (const building of city.buildings.values()) {
      if (!building.isOperational()) continue;
      const jobs = (building.definition.jobs ?? 0) * building.level;
      if (jobs > 0) vacancies += Math.max(0, jobs - building.assignedWorkerIds.size);
    }

    // Danger is what a resident could actually perceive: an army at the wall, or
    // a realm that is at war somewhere.
    const atWar = city.kingdomId ? this.diplomacy.getEnemies(city.kingdomId).length > 0 : false;
    const danger = city.besiegerId ? 1 : atWar ? 0.45 : 0;

    const foodPerHead = city.stock.get('food') / Math.max(1, city.population);
    const opportunity = Math.max(0, Math.min(1,
      city.prosperity * 0.45 +
      Math.min(1, vacancies / Math.max(4, city.population * 0.25)) * 0.35 +
      Math.min(1, foodPerHead / 3) * 0.2 -
      danger * 0.6
    ));
    return { danger, foodPerHead, prosperity: city.prosperity, vacancies, opportunity };
  }

  /** How much of this citizen's family is anchored to the settlement, 0..1. */
  private familyTiesIn(e: Entity, cityId: string): number {
    let ties = 0;
    const partner = this.getEntity(e.partnerId);
    if (partner?.cityId === cityId) ties += 0.5;
    for (const childId of e.childrenIds) {
      if (this.getEntity(childId)?.cityId === cityId) { ties += 0.2; if (ties >= 1) break; }
    }
    if (this.getEntity(e.motherId)?.cityId === cityId) ties += 0.15;
    if (this.getEntity(e.fatherId)?.cityId === cityId) ties += 0.15;
    return Math.min(1, ties);
  }

  /**
   * Looking for work, or for better work.
   *
   * The unemployed always look. Someone already employed only looks when they
   * are ambitious enough to be dissatisfied with a job they have and there is
   * somewhere open to go — otherwise the whole workforce would reshuffle itself
   * every year for nothing.
   */
  private seekWork(e: Entity, city: City, here: CityMood): void {
    if (e.profession === 'none') {
      // The old do not start over. An elder with no work has retired, and a
      // settlement that hands its last farm slot to an eighty-year-old is one
      // that has quietly stopped ageing.
      if (e.lifeStage !== 'elder') this.assignProfession(e, city);
      return;
    }
    if (here.vacancies <= 0 || e.lifeStage === 'elder') return;
    // Ambition is the whole trigger, damped by loyalty to the place they are.
    const restless = e.psyche.ambition * 0.5 - e.psyche.loyalty * 0.2 - Math.min(0.3, e.wealth / 400);
    if (restless <= 0 || !rng.chance(restless * 0.35)) return;

    const previous = e.profession;
    if (e.workplaceId) city.buildings.get(e.workplaceId)?.assignedWorkerIds.delete(e.id);
    e.workplaceId = null;
    e.profession = 'none';
    this.assignProfession(e, city);
    // A search that found nothing leaves them out of work, which is a real
    // outcome of quitting and is recorded as such next year.
    if (e.profession === 'none') remember(e.memories, 'jobless', this.currentYear, 0.3);
    else if (e.profession !== previous) e.showEmote('🧰', 40);
  }

  /**
   * Moving house within the settlement.
   *
   * Wealth buys comfort: a family that has done well and is living badly looks
   * for a better roof, and CITY's own housing stock decides whether one exists.
   */
  private reconsiderHousing(e: Entity, city: City): void {
    if (e.needs.comfort > 55 || e.wealth < 45) return;
    if (!rng.chance(0.2 + e.psyche.ambition * 0.3)) return;
    this.claimHome(e, city, true);
  }

  /**
   * The best settlement within walking reach that is plainly better than this one.
   *
   * Bounded by a spatial query rather than a scan of every city in the world, and
   * only run for citizens who already want to leave.
   */
  private findBetterSettlement(e: Entity, from: City, mood: Map<string, CityMood>): City | null {
    const here = mood.get(from.id)!;
    let best: City | null = null;
    let bestScore = here.opportunity + 0.1; // must be clearly better, not marginally

    for (const candidate of this.citiesNear(e.x, e.y, MIGRATION_RANGE)) {
      if (candidate.id === from.id || candidate.population <= 0) continue;
      // Nobody walks into a realm that is at war with their own.
      if (candidate.kingdomId && e.kingdomId && this.diplomacy.isAtWar(candidate.kingdomId, e.kingdomId)) continue;
      if (candidate.population >= candidate.housingCapacity()) continue;
      const there = mood.get(candidate.id);
      if (!there) continue;

      // Distance is a real cost, and the incurious feel it more.
      const distance = Math.hypot(candidate.x - e.x, candidate.y - e.y) / MIGRATION_RANGE;
      const score = there.opportunity - distance * (0.35 - e.psyche.curiosity * 0.2);
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    return best;
  }

  /** Moves a citizen and their dependants to another settlement, for good. */
  private relocateCitizen(e: Entity, from: City, to: City): void {
    // A parent does not walk out on their household. Partner and children move
    // with them, which is the single most visible consequence of family mattering
    // to the decision at all.
    const party = [e];
    const partner = this.getEntity(e.partnerId);
    if (partner && partner.cityId === from.id) party.push(partner);
    for (const childId of e.childrenIds) {
      const child = this.getEntity(childId);
      if (child && child.cityId === from.id && child.isChild) party.push(child);
    }

    for (const mover of party) {
      if (mover.homeBuildingId) from.buildings.get(mover.homeBuildingId)?.residentIds.delete(mover.id);
      if (mover.workplaceId) from.buildings.get(mover.workplaceId)?.assignedWorkerIds.delete(mover.id);
      mover.homeBuildingId = null;
      mover.workplaceId = null;
      mover.profession = 'none';
      mover.cityId = to.id;
      mover.kingdomId = to.kingdomId;
      mover.x = to.x + rng.range(-1.5, 1.5);
      mover.y = to.y + rng.range(-1.5, 1.5);
      mover.homeX = to.x;
      mover.homeY = to.y;
      mover.targetX = null;
      mover.targetY = null;
      mover.migrationUrge = 0;
      // However long the family had been in the old town, it is not from here.
      uproot(mover);
      remember(mover.memories, 'moved', this.currentYear, 0.45);
      this.spatialHash.update(mover, mover.prevX, mover.prevY);
      this.entityChunks.update(mover, mover.prevX, mover.prevY);
    }

    // The household follows the family — the roof moves, the people with it.
    const household = e.householdId ? this.households.get(e.householdId) : null;
    if (household) { household.cityId = to.id; household.homeBuildingId = null; }

    from.population = Math.max(0, from.population - party.length);
    to.population += party.length;
    chronicle.log(
      this.currentYear,
      'society',
      party.length > 1
        ? `🧳 ${e.fullName} deixou ${from.name} com a família e recomeçou em ${to.name}.`
        : `🧳 ${e.fullName} deixou ${from.name} em busca de vida melhor em ${to.name}.`
    );
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

    // Follow Army regiment campaign orders if assigned
    const army = this.warfare.getArmyForSoldier(soldier.id);
    if (army) {
      if (army.state === 'retreating' || army.state === 'mustering' || army.state === 'garrisoned') {
        const home = this.cities.get(army.homeCityId);
        if (home) return home;
      }
      if (army.targetCityId) {
        const target = this.cities.get(army.targetCityId);
        if (target) return target;
      }
    }

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
    return best && Math.hypot(best.x - soldier.x, best.y - soldier.y) < 70 ? best : null;
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
        if (!tile || !tile.resourceType || !HAND_GATHERABLE.includes(tile.resourceType)) continue;
        if (tile.resourceAmount <= 0) continue;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; best = tile; }
      }
    }
    return best;
  }

  /** Process quarterly gestation progress and birth events. */
  private tickPregnancies(): void {
    for (const e of [...this.entities]) {
      if (e.hp <= 0 || !e.isPregnant) continue;
      e.pregnancyTimer--;
      e.showEmote('🤰', 40);
      if (e.pregnancyTimer <= 0) {
        this.processBirthEvent(e);
      }
    }
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
    const ecology = this.ecology.advanceYear(tileMap, this.entities);
    for (const dead of ecology.deaths) this.handleEntityDeath(dead, null!);
    if (ecology.migrated) {
      // ECO-V3 may relocate animals between chunks in its coarse sleeping-world
      // pass, so the frame-level local queries resume from a correct index.
      this.spatialHash.rebuild(this.entities);
      this.entityChunks.rebuild(this.entities);
    }
    const counts = new Map<SpeciesType, Entity[]>();
    for (const e of this.entities) {
      if (SPECIES_DEFINITIONS[e.species].isHumanoid || e.hp <= 0) continue;
      let list = counts.get(e.species);
      if (!list) { list = []; counts.set(e.species, list); }
      list.push(e);
    }

    // Carrying capacity scales with the land, so a big map holds a big ecosystem.
    for (const [species, members] of counts) {
      // Predators sit at the top of the chain, so there are far fewer of them.
      const cap = this.ecology.getCapacity(species);
      if (members.length >= cap) continue;

      // A lone survivor cannot repopulate; a pair can.
      const breeding = members.filter(m => m.age >= 1 && m.hp > m.maxHp * 0.5 && this.ecology.canReproduce(m, tileMap));
      if (breeding.length < 2) continue;

      // Prey breed fast — that is the whole reason a herd survives being hunted.
      const litters = Math.max(1, Math.floor(breeding.length / (this.ecology.isPredator(species) ? 4 : 2)));
      for (let i = 0; i < litters; i++) {
        if (this.entities.filter(e => e.species === species).length >= cap) break;
        if (!rng.chance(this.ecology.birthChance(species))) continue;
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
    const fatherMember = mother.pregnantFatherId ? (this.getEntity(mother.pregnantFatherId) || this.deceasedAncestors.get(mother.pregnantFatherId)) : null;

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
      // Disposition is inherited like anything else in the bloodline, so a line
      // of cautious people tends to stay cautious — but only tends to, because
      // `inheritPsyche` pulls every generation back toward the middle.
      child.psyche = inheritPsyche(fatherEntity.psyche, mother.psyche, () => rng.next());

      // SOC-V3. Where the family is from, how deep it now is in this place, what
      // the house does, and the handful of things it has been through. None of it
      // decides the child's life — all of it weighs on it.
      inheritOrigin(child, fatherEntity, mother);
      inheritFamilyMarks(child, fatherEntity, mother);
      child.familyTrade = mother.familyTrade !== 'none' ? mother.familyTrade
        : fatherEntity.familyTrade !== 'none' ? fatherEntity.familyTrade
        : rng.chance(0.5) ? mother.profession : fatherEntity.profession;

      // CULT-V1. Mostly the family's culture, partly the street's. A child of a
      // small minority is genuinely likely to grow up belonging to the majority
      // instead — one probability, and it is the whole of assimilation.
      const cultural = inheritCulture(
        fatherEntity, mother, city?.cultureMix ?? {}, city?.dominantCultureId ?? null
      );
      child.cultureId = cultural.cultureId || mother.cultureId || fatherEntity.cultureId;
      child.localAffinity = cultural.localAffinity;

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
      this.entityChunks.insert(child);
      this.entitiesById.set(child.id, child);
      this.totalBirths++;
      this.birthsThisYear++;
    }

    if (city) city.ledger.recordConsumed('food', city.stock.take('food', 4));
    sound.playMagic();
  }

  private handleEntityDeath(dead: Entity, particles: ParticleManager): void {
    // Only a human hunt yields food. Predation and ordinary combat cannot turn
    // into a free city supply source.
    if (!SPECIES_DEFINITIONS[dead.species].isHumanoid && dead.huntedById) {
      const hunter = this.getEntity(dead.huntedById);
      const food = this.ecology.foodYield(dead.species);
      if (hunter && hunter.hp > 0 && food > 0) {
        if (hunter.carrying) {
          const city = hunter.cityId ? this.cities.get(hunter.cityId) : null;
          const stored = city?.stock.add('food', food) ?? 0;
          if (city && stored > 0) city.ledger.recordProduced('food', stored);
        } else {
          hunter.carrying = { good: 'food', amount: food };
          hunter.aiState = 'deliver';
        }
      }
    }
    // Release the house and the job slot. Without this the dead keep occupying
    // beds and workplaces forever and the settlement silently stops hiring.
    const homeCity = dead.cityId ? this.cities.get(dead.cityId) : null;
    const vacatedJob = homeCity && dead.workplaceId ? homeCity.buildings.get(dead.workplaceId) ?? null : null;
    if (homeCity) {
      if (dead.homeBuildingId) homeCity.buildings.get(dead.homeBuildingId)?.residentIds.delete(dead.id);
      vacatedJob?.assignedWorkerIds.delete(dead.id);
    }

    const household = dead.householdId ? this.households.get(dead.householdId) ?? null : null;

    // SOC-V3. Coin, a roof and a trade pass to whoever is actually there to take
    // them. This is the single mechanism behind a family line rising or falling:
    // a fortune divided between six children is not a fortune, and a fortune
    // with one heir is a dynasty.
    if (SPECIES_DEFINITIONS[dead.species].isHumanoid) {
      const estate = settleEstate(dead, id => this.getEntity(id), household, !!vacatedJob?.isOperational());
      if (estate.home && estate.heirs.length > 0) {
        const roofed = estate.heirs.find(heir => heir.homeBuildingId === dead.homeBuildingId);
        if (roofed) homeCity?.buildings.get(roofed.homeBuildingId!)?.residentIds.add(roofed.id);
      }
      if (estate.trade) {
        const successor = estate.heirs.find(heir => heir.workplaceId === dead.workplaceId);
        if (successor) {
          vacatedJob?.assignedWorkerIds.add(successor.id);
          chronicle.log(this.currentYear, 'society',
            `⚒️ ${successor.fullName} assumiu o ofício de ${dead.fullName} em ${homeCity?.name ?? 'sua terra'}.`);
        }
      }
    }

    // Leave the household. What they were carrying is simply lost with them.
    if (household) {
      household.memberIds.delete(dead.id);
      if (household.memberIds.size === 0) {
        this.households.delete(household.id);
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
      historic: dead.historic,
      isDeceased: true
    });
    // The genealogy is the one structure that can only ever grow, so it is the
    // one that has to be pruned. Rulers, great persons and anyone explicitly
    // marked are kept forever; the ordinary dead are forgotten oldest first.
    pruneAncestors(this.deceasedAncestors);
    this.deathsThisYear++;

    const idx = this.entities.indexOf(dead);
    if (idx !== -1) this.entities.splice(idx, 1);
    this.spatialHash.remove(dead);
    this.entityChunks.remove(dead);
    this.entitiesById.delete(dead.id);
    this.relevanceTracker.forget(dead.id);
    this.totalDeaths++;

    // Death particles (skip if called from infant mortality with no particle manager)
    if (particles) particles.spawnExplosion(dead.x, dead.y, '#ef4444', 8);

    // Boss / Hero loot drop
    if (dead.species === SpeciesType.DRAGON || dead.species === SpeciesType.BEAR || dead.profession === 'king' || dead.level >= 5) {
      const nearbyHumanoids = this.spatialHash.queryRadius(dead.x, dead.y, 4, this.queryScratch)
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
      const partner = this.getEntity(dead.partnerId);
      if (partner) partner.partnerId = null;
    }

    // Grief. The people who were close to this person carry it, and it is read
    // later by every decision that weighs risk — which is how one death in a war
    // still changes behaviour a decade after the war ended.
    this.bereave(dead.partnerId, 0.75);
    this.bereave(dead.motherId, 0.4);
    this.bereave(dead.fatherId, 0.4);
    for (const childId of dead.childrenIds) this.bereave(childId, 0.6);

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
