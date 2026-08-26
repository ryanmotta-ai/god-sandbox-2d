import { City } from './City';
import { Kingdom } from './Kingdom';
import { TileMap } from '../world/TileMap';
import { TERRAINS } from '../world/Biomes';
import { Entity } from '../entities/Entity';
import { ParticleManager, type Projectile } from '../renderer/Particles';
import { SimplePathfinder } from '../ai/Pathfinding';
import { SpatialHash } from '../core/SpatialHash';
import { rng, nextId, hashString } from '../core/Random';
import { events } from '../core/EventBus';
import { chronicle } from './Chronicle';
import { sound } from '../core/SoundSynth';
import type { DiplomacyManager } from './Diplomacy';
import {
  assembleFleet, fleetStats, flagshipOf, describeFleet,
  type FleetComposition
} from './Warships';

/**
 * Amphibious war.
 *
 * Water was an absolute wall. `SimplePathfinder.getStepTowards` refuses every
 * water tile, so a soldier ordered to march on a city across a strait walked to
 * the beach and stood there for the rest of their life; `assessSiege` needs
 * enemy soldiers inside the ring around a city, and none could ever arrive. An
 * island realm could not be invaded and could not invade. On any map generated
 * with real coastlines that quietly deleted a large part of the world from the
 * war.
 *
 * `NavalSystem` already moves hulls over water, but it only ever carries goods:
 * a `Ship` is bound to a `TradeRoute` and its cargo is a `GoodId`. Rather than
 * overload it, an invasion is its own thing — a fleet that carries people, can
 * be fought at sea, and dies with everyone aboard when it loses.
 *
 * The crossing is deliberately slow and visible. An invasion that teleported an
 * army across a sea would be a rule; one the player can watch leave, be
 * intercepted, burn and sink halfway is an event.
 */

/** Soldiers below which a landing is not worth the hulls. */
const MIN_INVASION_FORCE = 5;
/** Soldiers above which a realm is stripping its own walls bare. */
const MAX_INVASION_FORCE = 26;
/** Timber per soldier carried — a fleet is a real charge on a real stockpile. */
const WOOD_PER_BERTH = 3;
/** Tiles at which two hostile fleets sight each other and turn to fight. */
const ENGAGE_RANGE = 5.5;
/** Ticks between broadsides, so a sea battle reads as an exchange, not a number. */
const VOLLEY_COOLDOWN = 26;
/** What a torpedo does that a broadside does not: it arrives unannounced. */
const TORPEDO_SURPRISE = 2.2;
/** How far from open water a town can be and still launch a fleet. */
const PORT_RADIUS = 6;
/** How far inland a target can be and still be reachable by a landing. */
const SHORE_RADIUS = 14;
/** How close to the landing point counts as arrived. */
const LANDING_REACH = 1.1;

export type FleetState = 'crossing' | 'engaged' | 'landing' | 'sinking' | 'lost';

export interface InvasionFleet {
  id: string;
  kingdomId: string;
  kingdomColor: string;
  kingdomName: string;
  originCityId: string;
  targetCityId: string;
  targetCityName: string;
  /** Entity ids of everyone aboard. They exist, but not on land. */
  soldierIds: string[];
  x: number;
  y: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  /** What the fleet is actually made of, by warship class. */
  composition: FleetComposition;
  speed: number;
  hp: number;
  maxHp: number;
  /**
   * Whether the enemy has a bearing on this fleet.
   *
   * Only ever false for an all-submarine force. A submerged boat cannot be fired
   * on until something with hydrophones finds it, which is the entire reason a
   * destroyer exists — and the moment it is found it is the most fragile thing
   * in the water.
   */
  detected: boolean;
  state: FleetState;
  launchedYear: number;
  /** Fleet currently exchanging fire with this one. */
  engagedWith: string | null;
  volleyCooldown: number;
  /** Heading angle in radians for smooth visual rotation. */
  heading: number;
  /** Gun recoil shudder kickback (0..1). */
  recoil: number;
  /** Timestamp / tick of last broadside fire for muzzle flash animations. */
  lastFiredTick: number;
  /** Ticks remaining in cinematic sinking sequence before fleet is purged. */
  sinkTimer: number;
  /** Total duration of sinking sequence. */
  maxSinkTimer: number;
  /** Realm that sunk this fleet if any. */
  sunkBy: string | null;
}

export class NavalInvasionSystem {
  public fleets: Map<string, InvasionFleet> = new Map();
  private readonly renderIndex = new SpatialHash<InvasionFleet>(16);
  /**
   * Whether a pair of settlements can be walked between, remembered so the
   * yearly decision does not re-run a long land search for every enemy city on
   * the map every year. Cleared when the world's land routes change.
   */
  private landReachable: Map<string, boolean> = new Map();

  public [Symbol.iterator](): Iterator<InvasionFleet> { return this.fleets.values(); }

  public queryRect(minX: number, minY: number, maxX: number, maxY: number, result: InvasionFleet[] = []): InvasionFleet[] {
    result.length = 0;
    this.renderIndex.queryRect(minX, minY, maxX, maxY, result);
    return result;
  }

  public serialize(): any {
    return { fleets: [...this.fleets.values()] };
  }

  public deserialize(data: any): void {
    this.fleets.clear();
    this.renderIndex.clear();
    this.landReachable.clear();
    for (const fleet of data?.fleets ?? []) {
      const restored = fleet as InvasionFleet;
      restored.heading = restored.heading ?? 0;
      restored.recoil = restored.recoil ?? 0;
      restored.lastFiredTick = restored.lastFiredTick ?? 0;
      restored.sinkTimer = restored.sinkTimer ?? 0;
      restored.maxSinkTimer = restored.maxSinkTimer ?? 0;
      restored.sunkBy = restored.sunkBy ?? null;
      this.fleets.set(restored.id, restored);
      this.renderIndex.insert(restored);
    }
  }

  // ===================== THE YEARLY DECISION =====================

  /**
   * Who sails this year.
   *
   * A realm mounts a landing when it is at war with somewhere it cannot walk to.
   * That is the whole trigger, and it is the right one: an army that can march
   * should march, because marching is free and hulls are not. What makes this
   * reachable at all is that the land test is allowed to fail — an enemy capital
   * on another island returns no land path, and that failure *is* the reason to
   * build a fleet.
   */
  public tickYear(
    kingdoms: Map<string, Kingdom>,
    cities: Map<string, City>,
    entities: Entity[],
    diplomacy: DiplomacyManager,
    tileMap: TileMap,
    year: number
  ): void {
    const soldiersByKingdom = new Map<string, Entity[]>();
    for (const e of entities) {
      if (e.hp <= 0 || !e.kingdomId || e.aboardFleetId) continue;
      if (e.profession !== 'soldier') continue;
      const list = soldiersByKingdom.get(e.kingdomId);
      if (list) list.push(e);
      else soldiersByKingdom.set(e.kingdomId, [e]);
    }

    /** Targets already being sailed at, so three fleets do not chase one city. */
    const committed = new Set<string>();
    for (const fleet of this.fleets.values()) {
      if (fleet.state !== 'lost') committed.add(`${fleet.kingdomId}:${fleet.targetCityId}`);
    }

    for (const kingdom of kingdoms.values()) {
      const enemies = diplomacy.getEnemies(kingdom.id);
      if (enemies.length === 0) continue;

      const troops = soldiersByKingdom.get(kingdom.id) ?? [];
      // Half the standing army stays home. A realm that empties its garrisons
      // onto boats loses its own cities to the counter-landing, and over two
      // hundred simulated years that is a spiral, not a strategy.
      const spare = Math.floor(troops.length / 2);
      if (spare < MIN_INVASION_FORCE) continue;

      const launch = this.planLanding(kingdom, cities, enemies, committed, tileMap);
      if (!launch) continue;

      this.launchInvasion(launch.origin, launch.target, launch.path, kingdom, troops, spare, year);
      committed.add(`${kingdom.id}:${launch.target.id}`);
    }
  }

  /** The best origin port, enemy shore and sea road between them, or nothing. */
  private planLanding(
    kingdom: Kingdom,
    cities: Map<string, City>,
    enemies: string[],
    committed: Set<string>,
    tileMap: TileMap
  ): { origin: City; target: City; path: { x: number; y: number }[] } | null {
    const ours = [...kingdom.cityIds]
      .map(id => cities.get(id))
      .filter((c): c is City => !!c && this.coastalWater(c, tileMap) !== null);
    if (ours.length === 0) return null;

    const enemySet = new Set(enemies);
    const targets = [...cities.values()]
      .filter(c => c.kingdomId && enemySet.has(c.kingdomId))
      .filter(c => !committed.has(`${kingdom.id}:${c.id}`))
      .filter(c => this.coastalWater(c, tileMap, SHORE_RADIUS) !== null);
    if (targets.length === 0) return null;

    // Nearest first: the yearly budget only stretches to a couple of real
    // pathfinding attempts, and the nearest shore is the one worth trying.
    targets.sort((a, b) => this.nearestOwnDistance(a, ours) - this.nearestOwnDistance(b, ours));

    for (const target of targets.slice(0, 2)) {
      const origin = ours.reduce((best, c) =>
        Math.hypot(c.x - target.x, c.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y) ? c : best);

      // Walkable? Then this is a march, not a landing.
      if (this.canWalkBetween(origin, target, tileMap)) continue;

      const from = this.coastalWater(origin, tileMap)!;
      const to = this.coastalWater(target, tileMap, SHORE_RADIUS)!;
      const path = SimplePathfinder.findPath(from.x, from.y, to.x, to.y, tileMap, 'sea', 4000, hashString(origin.id));
      if (path.length < 2) continue;

      return { origin, target, path };
    }
    return null;
  }

  private nearestOwnDistance(target: City, ours: City[]): number {
    let best = Infinity;
    for (const c of ours) best = Math.min(best, Math.hypot(c.x - target.x, c.y - target.y));
    return best;
  }

  /** Cached, because a failed land search is the expensive half of the decision. */
  private canWalkBetween(a: City, b: City, tileMap: TileMap): boolean {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    const known = this.landReachable.get(key);
    if (known !== undefined) return known;

    const path = SimplePathfinder.findPath(a.x, a.y, b.x, b.y, tileMap, 'land', 6000, hashString(key));
    // A path that stops short of the destination is a search that ran out of
    // budget, not a coastline — treat it as walkable so a merely long march is
    // never mistaken for a sea crossing.
    const last = path[path.length - 1];
    const reachable = path.length > 1 && !!last && Math.hypot(last.x - b.x, last.y - b.y) < 3;
    this.landReachable.set(key, reachable);
    return reachable;
  }

  /**
   * A water tile a fleet can sit on near this settlement, if there is one.
   *
   * The radius differs by role, and deliberately. An origin has to be a real
   * port — six tiles is already generous for "this town can launch a fleet".
   * A target only has to be *reachable from the sea*, which is a much weaker
   * claim: troops land on the nearest beach and march the rest, exactly as they
   * would if they had walked there. Holding the target to the port radius meant
   * only cities sitting on the waterline could ever be invaded, and every
   * capital a few tiles inland was as untouchable as it had been before any of
   * this existed.
   */
  private coastalWater(city: City, tileMap: TileMap, maxRadius: number = PORT_RADIUS): { x: number; y: number } | null {
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = Math.floor(city.x) + dx;
          const y = Math.floor(city.y) + dy;
          const tile = tileMap.getTile(x, y);
          if (tile && TERRAINS[tile.type]?.isWater) return { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
    return null;
  }

  // ===================== LAUNCH =====================

  private launchInvasion(
    origin: City,
    target: City,
    path: { x: number; y: number }[],
    kingdom: Kingdom,
    troops: Entity[],
    spare: number,
    year: number
  ): void {
    // The soldiers who sail are the ones standing nearest the port.
    const wanted = troops
      .slice()
      .sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y))
      .slice(0, Math.min(spare, MAX_INVASION_FORCE));
    if (wanted.length < MIN_INVASION_FORCE) return;

    /**
     * The fleet is built before it sails, out of the warehouse, hull by hull.
     *
     * A yard is what separates a war fleet from armed merchantmen: without one a
     * realm can still put to sea in cogs, caravels and war canoes, but every
     * rated class in the catalogue — trireme upward, submarine included — needs
     * the slipways. `assembleFleet` charges the stockpile for each hull as it
     * lays it down and simply stops when the timber, steel or fuel runs out, so
     * a poor realm sails naked rather than not at all.
     */
    const hasYard = origin.hasBuilding('naval_yard');
    const composition = assembleFleet(kingdom, origin, hasYard, wanted.length);
    const stats = fleetStats(composition);
    if (stats.hulls === 0) return;

    // Berths, not wishes. What could not be given a bunk stays on the quay.
    const embarking = wanted.slice(0, Math.max(0, stats.berths));
    if (embarking.length < MIN_INVASION_FORCE) return;

    const start = path[0];
    const nextPoint = path[1] ?? start;
    const initialHeading = Math.atan2(nextPoint.y - start.y, nextPoint.x - start.x) || 0;

    const fleet: InvasionFleet = {
      id: nextId('fleet'),
      kingdomId: kingdom.id,
      kingdomColor: kingdom.color,
      kingdomName: kingdom.name,
      originCityId: origin.id,
      targetCityId: target.id,
      targetCityName: target.name,
      soldierIds: embarking.map(e => e.id),
      x: start.x,
      y: start.y,
      path,
      pathIndex: 0,
      composition,
      // A fleet keeps station on its slowest hull. A ship of the line dragging a
      // squadron of destroyers down to its own pace is the correct answer.
      speed: stats.speed,
      hp: stats.hull,
      maxHp: stats.hull,
      detected: !stats.submerged,
      state: 'crossing',
      launchedYear: year,
      engagedWith: null,
      volleyCooldown: 0,
      heading: initialHeading,
      recoil: 0,
      lastFiredTick: 0,
      sinkTimer: 0,
      maxSinkTimer: 0,
      sunkBy: null
    };

    for (const soldier of embarking) {
      soldier.aboardFleetId = fleet.id;
      soldier.x = fleet.x;
      soldier.y = fleet.y;
      soldier.targetX = null;
      soldier.targetY = null;
      soldier.aiState = 'idle';
    }

    this.fleets.set(fleet.id, fleet);
    events.emit('invasionLaunched', { fleet, kingdom, target });
    chronicle.log(year, 'war',
      `${kingdom.name} lançou ao mar uma frota de invasão com ${embarking.length} soldados rumo a ${target.name}.`, {
        title: `A frota parte de ${origin.name}`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
          { kind: 'city', id: target.id, name: target.name }
        ],
        tags: ['war', 'naval', 'invasion'],
        causes: ['O alvo não podia ser alcançado por terra.'],
        consequences: [`A esquadra: ${describeFleet(composition)}.`]
      });
  }

  // ===================== THE CROSSING =====================

  public update(
    cities: Map<string, City>,
    entitiesById: Map<string, Entity>,
    diplomacy: DiplomacyManager,
    tileMap: TileMap,
    particles: ParticleManager,
    year: number
  ): void {
    if (this.fleets.size === 0) return;
    this.renderIndex.clear();

    const afloat = (f: InvasionFleet): boolean => f.state !== 'lost';
    const live = [...this.fleets.values()].filter(f => f.state !== 'lost');

    for (const fleet of live) {
      if (fleet.state !== 'sinking') {
        this.seekBattle(fleet, live, diplomacy);
      }
    }

    for (const fleet of live) {
      if (!afloat(fleet)) continue;

      // Sinking sequence animation progression
      if (fleet.state === 'sinking') {
        fleet.sinkTimer--;
        fleet.recoil = Math.max(0, fleet.recoil - 0.05);

        // Dynamic burning, black smoke & boiling water whirlpool bubbles
        if (rng.chance(0.6)) {
          particles.spawnParticle(
            fleet.x + rng.range(-0.4, 0.4),
            fleet.y - 0.2,
            '#ef4444',
            rng.range(-0.1, 0.1),
            -0.3,
            0.4,
            3.5
          );
          particles.spawnParticle(
            fleet.x + rng.range(-0.3, 0.3),
            fleet.y - 0.4,
            '#0f172a',
            rng.range(-0.1, 0.1),
            -0.45,
            0.8,
            4.5
          );
        }
        if (rng.chance(0.4)) {
          particles.spawnWaterSplash(fleet.x + rng.range(-0.8, 0.8), fleet.y + rng.range(-0.3, 0.3), 3);
        }
        if (rng.chance(0.08)) {
          particles.spawnExplosion(fleet.x + rng.range(-0.3, 0.3), fleet.y + rng.range(-0.2, 0.2), '#f97316', 10);
        }

        // Final plunge: hull goes under, spawning debris flotsam & oil slick
        if (fleet.sinkTimer <= 0) {
          fleet.state = 'lost';
          particles.spawnExplosion(fleet.x, fleet.y, '#f97316', 18);
          particles.spawnWaterGeyser(fleet.x, fleet.y, 14);
          particles.spawnFlotsam(fleet.x, fleet.y, 7);

          const flagship = flagshipOf(fleet.composition);
          if (flagship && (
            flagship.role === 'line' ||
            flagship.id === 'ironclad' ||
            flagship.id === 'cruiser' ||
            flagship.id === 'battleship' ||
            flagship.id === 'destroyer' ||
            flagship.id === 'submarine' ||
            flagship.id === 'carrier'
          )) {
            particles.spawnOilSlick(fleet.x, fleet.y);
          }
        }
      } else {
        // Everyone aboard rides with the hull
        for (const id of fleet.soldierIds) {
          const soldier = entitiesById.get(id);
          if (soldier && soldier.hp > 0) { soldier.x = fleet.x; soldier.y = fleet.y; }
        }

        if (fleet.state === 'engaged') {
          this.fightAtSea(fleet, entitiesById, particles, year);
        } else {
          this.sail(fleet, cities, entitiesById, tileMap, particles, year);
        }
      }

      if (afloat(fleet)) this.renderIndex.insert(fleet);
    }

    for (const [id, fleet] of [...this.fleets]) {
      if (fleet.state === 'lost') this.fleets.delete(id);
    }
  }

  /** Two fleets of realms at war that come within sight of each other stop and fight. */
  private seekBattle(fleet: InvasionFleet, live: InvasionFleet[], diplomacy: DiplomacyManager): void {
    if (fleet.state === 'lost' || fleet.state === 'sinking') return;
    if (fleet.engagedWith) {
      const foe = this.fleets.get(fleet.engagedWith);
      if (foe && foe.state !== 'lost' && foe.state !== 'sinking' && Math.hypot(foe.x - fleet.x, foe.y - fleet.y) <= ENGAGE_RANGE * 1.6) return;
      fleet.engagedWith = null;
      if (fleet.state === 'engaged') fleet.state = 'crossing';
    }

    for (const other of live) {
      if (other.id === fleet.id || other.state === 'lost' || other.state === 'sinking') continue;
      if (other.kingdomId === fleet.kingdomId) continue;
      if (!diplomacy.isAtWar(fleet.kingdomId, other.kingdomId)) continue;
      if (Math.hypot(other.x - fleet.x, other.y - fleet.y) > ENGAGE_RANGE) continue;

      fleet.engagedWith = other.id;
      fleet.state = 'engaged';
      other.engagedWith = fleet.id;
      other.state = 'engaged';
      return;
    }
  }

  /**
   * A sea battle, fought in broadsides rather than settled in one number.
   *
   * The exchange is slow on purpose. A fleet that sank the instant it met
   * another would be a dice roll the player never saw; twenty-odd ticks between
   * volleys gives smoke, splashes and burning hulls somewhere to happen, and
   * gives a losing fleet time to be visibly losing.
   */
  private fightAtSea(fleet: InvasionFleet, entitiesById: Map<string, Entity>, particles: ParticleManager, year: number): void {
    const foe = fleet.engagedWith ? this.fleets.get(fleet.engagedWith) : null;
    if (!foe || foe.state === 'lost' || foe.state === 'sinking') {
      fleet.engagedWith = null;
      fleet.state = 'crossing';
      return;
    }

    // Close to broadside range and hold there.
    const dx = foe.x - fleet.x;
    const dy = foe.y - fleet.y;
    const gap = Math.hypot(dx, dy);

    // Aim heading towards opponent
    const targetHeading = Math.atan2(dy, dx);
    fleet.heading = targetHeading;
    fleet.recoil = Math.max(0, fleet.recoil - 0.04);

    if (gap > 2.2) {
      fleet.x += (dx / gap) * fleet.speed * 0.6;
      fleet.y += (dy / gap) * fleet.speed * 0.6;
    }

    if (fleet.volleyCooldown > 0) { fleet.volleyCooldown--; return; }
    fleet.volleyCooldown = VOLLEY_COOLDOWN + rng.rangeInt(0, 8);

    const mine = fleetStats(fleet.composition);
    const flagship = flagshipOf(fleet.composition);

    /**
     * The submarine rule, which is what makes the whole catalogue answer itself.
     */
    if (!foe.detected && rng.chance(mine.detection)) {
      foe.detected = true;
      particles.spawnUnderwaterShockwave(foe.x, foe.y);
      particles.spawnWaterGeyser(foe.x, foe.y, 10);
      events.emit('submarineDetected', { hunter: fleet.id, prey: foe.id, year });
    }
    if (!foe.detected) {
      // Nothing to aim at. The escorts sweep, and that is the whole turn.
      particles.spawnWaterRipple(foe.x + rng.range(-1, 1), foe.y + rng.range(-1, 1));
      return;
    }

    // Determine projectile type and salvo dynamics based on ship classes
    let salvo: Projectile['type'] = 'cannonball';
    if (mine.submerged) {
      salvo = 'torpedo';
    } else if (flagship?.role === 'carrier') {
      salvo = 'carrier_plane';
    } else if (flagship?.id === 'destroyer' && foe.composition.submarine) {
      salvo = 'depth_charge';
    } else if (flagship?.id === 'war_canoe' || flagship?.id === 'bireme' || flagship?.id === 'trireme') {
      salvo = 'fire_arrow';
    } else if (flagship?.id === 'battleship' || flagship?.id === 'cruiser' || flagship?.id === 'ironclad') {
      salvo = 'naval_shell';
    }

    // Trigger visual firing recoil & muzzle flash
    fleet.recoil = 1.0;
    fleet.lastFiredTick = Date.now();

    // Play appropriate sound effect
    if (salvo === 'torpedo') {
      sound.playWaterSplash();
    } else if (salvo === 'fire_arrow') {
      sound.playHit();
    } else {
      sound.playCannon();
    }

    const shots = Math.max(1, Math.min(6, Math.round(mine.hulls)));
    for (let i = 0; i < shots; i++) {
      const spreadX = rng.range(-0.55, 0.55);
      const spreadY = rng.range(-0.55, 0.55);
      particles.spawnProjectile(
        fleet.x, fleet.y,
        foe.x + spreadX, foe.y + spreadY,
        salvo, 0
      );
    }

    // Weight of shot, with torpedo surprise bonus
    const surprise = mine.submerged && !fleet.detected ? TORPEDO_SURPRISE : 1;
    const damage = mine.guns * rng.range(0.06, 0.13) * surprise + rng.range(1, 4);
    foe.hp -= damage;

    // Near-miss water geysers
    if (rng.chance(0.4) && salvo !== 'torpedo') {
      particles.spawnWaterGeyser(foe.x + rng.range(-1.2, 1.2), foe.y + rng.range(-1.2, 1.2), 6);
    }

    particles.spawnDamageNumber(foe.x, foe.y, Math.round(damage));

    if (foe.hp <= 0) this.sinkFleet(foe, entitiesById, particles, year, fleet.kingdomName);
  }

  /**
   * The fleet goes down and takes the army with it.
   *
   * Nobody swims home. Initiates a dramatic sinking sequence where the hull lists,
   * explodes internally and slides beneath the waves before leaving flotsam.
   */
  private sinkFleet(
    fleet: InvasionFleet,
    entitiesById: Map<string, Entity>,
    particles: ParticleManager,
    year: number,
    sunkBy: string | null
  ): void {
    fleet.state = 'sinking';
    fleet.sinkTimer = 50; // ~50 ticks of dramatic destruction (~1.5s)
    fleet.maxSinkTimer = 50;
    fleet.sunkBy = sunkBy;
    fleet.engagedWith = null;

    let drowned = 0;
    for (const id of fleet.soldierIds) {
      const soldier = entitiesById.get(id);
      if (!soldier || soldier.hp <= 0) continue;
      soldier.hp = 0;
      soldier.aboardFleetId = null;
      drowned++;
    }

    // Initial catastrophic internal explosion
    particles.spawnExplosion(fleet.x, fleet.y, '#f97316', 24);
    particles.spawnWaterGeyser(fleet.x, fleet.y, 16);
    sound.playExplosion();

    for (let i = 0; i < 6; i++) {
      particles.spawnWaterSplash(fleet.x + rng.range(-2, 2), fleet.y + rng.range(-2, 2), 4);
    }

    for (const f of this.fleets.values()) {
      if (f.engagedWith === fleet.id) {
        f.engagedWith = null;
        if (f.state === 'engaged') f.state = 'crossing';
      }
    }

    events.emit('invasionSunk', { fleet, drowned, year });
    chronicle.log(year, 'war',
      `A frota de ${fleet.kingdomName} foi ao fundo${sunkBy ? ` diante de ${sunkBy}` : ''}. ${drowned} soldados afogaram-se antes de ver a costa.`, {
        title: 'A frota afundada',
        importance: 'major',
        scope: 'international',
        refs: [{ kind: 'kingdom', id: fleet.kingdomId, name: fleet.kingdomName }],
        tags: ['war', 'naval', 'disaster'],
        consequences: [`${drowned} soldados perdidos no mar, sem combate em terra.`]
      });
  }

  /** Ordinary progress along the sea road, and the wake it leaves. */
  private sail(
    fleet: InvasionFleet,
    cities: Map<string, City>,
    entitiesById: Map<string, Entity>,
    tileMap: TileMap,
    particles: ParticleManager,
    year: number
  ): void {
    const waypoint = fleet.path[fleet.pathIndex];
    if (!waypoint) {
      this.land(fleet, cities, entitiesById, tileMap, particles, year);
      return;
    }

    const dx = waypoint.x - fleet.x;
    const dy = waypoint.y - fleet.y;
    const dist = Math.hypot(dx, dy);

    // Smooth heading rotation towards waypoint
    const targetHeading = Math.atan2(dy, dx);
    fleet.heading = targetHeading;
    fleet.recoil = Math.max(0, fleet.recoil - 0.04);

    if (dist < LANDING_REACH) {
      fleet.pathIndex++;
      if (fleet.pathIndex >= fleet.path.length) {
        this.land(fleet, cities, entitiesById, tileMap, particles, year);
      }
      return;
    }

    fleet.x += (dx / dist) * fleet.speed;
    fleet.y += (dy / dist) * fleet.speed;

    // A damaged fleet trails smoke the whole way in.
    if (fleet.hp < fleet.maxHp * 0.5 && rng.chance(0.04)) {
      particles.spawnParticle(fleet.x, fleet.y - 0.3, '#475569', rng.range(-0.2, 0.2), -0.4, 1.4, 3);
    }
    if (rng.chance(0.10)) particles.spawnWaterWake(fleet.x, fleet.y, -dx / dist, -dy / dist);
  }

  // ===================== THE LANDING =====================

  /**
   * Troops go over the side and the land war takes it from here.
   *
   * Everything downstream — sieges, fronts, supply — already works once there
   * are soldiers standing on the right continent, so this deliberately does
   * nothing clever. It puts bodies on a beach and hands them back to the rules
   * that were always waiting for them.
   */
  private land(
    fleet: InvasionFleet,
    cities: Map<string, City>,
    entitiesById: Map<string, Entity>,
    tileMap: TileMap,
    particles: ParticleManager,
    year: number
  ): void {
    const target = cities.get(fleet.targetCityId);
    const beach = this.findBeachhead(fleet, target, tileMap);

    if (!beach) {
      // No dry ground to put them on. Rather than leave an army circling a
      // shoreline for ever, the landing fails and the fleet turns for home —
      // which is at least a story, and cannot deadlock.
      this.sinkFleet(fleet, entitiesById, particles, year, null);
      return;
    }

    let landed = 0;
    for (const id of fleet.soldierIds) {
      const soldier = entitiesById.get(id);
      if (!soldier || soldier.hp <= 0) continue;

      // Spread the wave along the shore instead of stacking a whole army on one
      // tile, using the same slot idea the marching column uses.
      const spread = landed % 5;
      soldier.x = beach.x + rng.range(-1.2, 1.2) + (spread - 2) * 0.5;
      soldier.y = beach.y + rng.range(-1.2, 1.2);
      soldier.aboardFleetId = null;
      soldier.aiState = 'attack';
      soldier.aiCooldown = rng.rangeInt(2, 10);
      soldier.targetX = null;
      soldier.targetY = null;
      particles.spawnWaterSplash(soldier.x, soldier.y, 4);
      landed++;
    }

    fleet.state = 'lost';
    events.emit('invasionLanded', { fleet, landed, year, cityId: fleet.targetCityId });

    if (landed > 0) {
      chronicle.log(year, 'war',
        `${fleet.kingdomName} desembarcou ${landed} soldados na costa de ${fleet.targetCityName}.`, {
          title: `Desembarque em ${fleet.targetCityName}`,
          importance: 'legendary',
          scope: 'international',
          refs: [
            { kind: 'kingdom', id: fleet.kingdomId, name: fleet.kingdomName },
            ...(target ? [{ kind: 'city' as const, id: target.id, name: target.name }] : [])
          ],
          tags: ['war', 'naval', 'invasion', 'landing'],
          causes: ['A travessia foi concluída sem que a frota fosse afundada.'],
          consequences: ['O cerco por terra começa a partir da praia.']
        });
    }
  }

  /** Dry, walkable ground near the fleet, as close to the objective as possible. */
  private findBeachhead(fleet: InvasionFleet, target: City | undefined, tileMap: TileMap): { x: number; y: number } | null {
    const aimX = target ? target.x : fleet.x;
    const aimY = target ? target.y : fleet.y;
    let best: { x: number; y: number } | null = null;
    let bestScore = Infinity;

    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const x = Math.floor(fleet.x) + dx;
        const y = Math.floor(fleet.y) + dy;
        const tile = tileMap.getTile(x, y);
        if (!tile) continue;
        const terrain = TERRAINS[tile.type];
        if (!terrain || terrain.isWater || !terrain.isWalkable) continue;
        // Close to the fleet, but scored by how much nearer the objective it is.
        const score = Math.hypot(x - aimX, y - aimY) + Math.hypot(x - fleet.x, y - fleet.y) * 0.35;
        if (score < bestScore) { bestScore = score; best = { x: x + 0.5, y: y + 0.5 }; }
      }
    }
    return best;
  }

  /** The heaviest hull in the fleet, which is what the renderer draws. */
  public static flagshipOf(fleet: InvasionFleet) {
    return flagshipOf(fleet.composition);
  }
}
