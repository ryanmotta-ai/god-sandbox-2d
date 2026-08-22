import { City } from './City';
import { Kingdom } from './Kingdom';
import { Entity } from '../entities/Entity';
import { GoodId } from './Goods';
import { TileMap } from '../world/TileMap';
import { DiplomacyManager } from './Diplomacy';
import { SimplePathfinder } from '../ai/Pathfinding';
import { avgEffectiveRoadLevel, portOperational } from './Infrastructure';
import { RailwayNetwork } from './RailwayNetwork';
import { FrontSector, WarFrontSystem, SECTOR_RADIUS } from './WarFronts';
import { chronicle } from './Chronicle';
import { events } from '../core/EventBus';

/**
 * WAR-V3 — feeding a war.
 *
 * An army in this game used to fight on nothing at all. Strength was the sum of
 * the bodies present, so a force that had marched for a decade across a ruined
 * countryside hit exactly as hard as one standing outside its own granary, and a
 * railway was worth precisely as much in war as a footpath.
 *
 * Now a front is fed from a depot behind it, over whatever the realm has built:
 * rail carries far more than road, road far more than open ground, and a port
 * can supply a coast the land route cannot reach. Two things move — food, and
 * munitions, which are arrowheads and blades until a realm knows gunpowder and
 * powder afterwards. What arrives decides what the army at that sector is worth,
 * and an army that stops being fed stops being an army.
 *
 * The consequence the whole phase exists for: break the line behind a front and
 * the front weakens, without a single soldier being lost to it.
 */

/** Rations and munitions one soldier wants per year at the front. */
const FOOD_PER_SOLDIER = 2.2;
const MUNITIONS_PER_SOLDIER = 0.55;

/**
 * How much a convoy carries per year, by the best route it can use.
 *
 * Rail is the whole point of the phase: a military railway should be
 * transformative, not a rounding error. Foot supply exists so an army in a
 * roadless wilderness is weak rather than dead.
 */
const MODE_THROUGHPUT: Record<SupplyMode, number> = {
  rail: 240,
  sea: 130,
  road: 90,
  foot: 26
};

/** Tiles beyond which each mode stops being able to deliver anything. */
const MODE_RANGE: Record<SupplyMode, number> = {
  rail: 120,
  sea: 110,
  road: 55,
  foot: 26
};

/** A depot needs to hold at least this much of a good before it will ship any. */
const DEPOT_RESERVE = 24;
/** Supply below this and an army starts losing men to hunger and exposure. */
const ATTRITION_THRESHOLD = 0.45;

export type SupplyMode = 'rail' | 'sea' | 'road' | 'foot';

export interface SupplyLine {
  sectorId: string;
  kingdomId: string;
  depotCityId: string;
  depotName: string;
  mode: SupplyMode;
  /** Tiles from depot to sector. */
  distance: number;
  /**
   * 0..1 — how much of the route is actually usable. Damaged rail and ruined
   * road cut this directly, which is how a wrecked line starves a front.
   */
  integrity: number;
  /** Goods per year this line can actually move. */
  capacity: number;
  foodDelivered: number;
  munitionsDelivered: number;
  /** What the front asked for. */
  foodDemand: number;
  munitionsDemand: number;
}

export interface LogisticsWorld {
  year: number;
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
  entities: Entity[];
  tileMap: TileMap;
  diplomacy: DiplomacyManager;
  railways: RailwayNetwork;
  fronts: WarFrontSystem;
}

export class MilitaryLogistics {
  /** This year's lines, keyed `${sectorId}:${kingdomId}`. Rebuilt annually. */
  public lines: Map<string, SupplyLine> = new Map();
  /** Sectors already chronicled as starved, so it is reported once per break. */
  private starved: Set<string> = new Set();

  public reset(): void {
    this.lines.clear();
    this.starved.clear();
  }

  /**
   * Runs between the front measuring who is present and the front resolving
   * what that was worth. Supply has to be known before the fighting is scored.
   */
  public tickYear(world: LogisticsWorld): void {
    this.lines.clear();

    for (const sector of world.fronts.sectors.values()) {
      for (const kingdomId of [sector.aId, sector.bId]) {
        const soldiers = kingdomId === sector.aId ? sector.soldiersA : sector.soldiersB;
        const supply = soldiers > 0 ? this.supplySector(sector, kingdomId, soldiers, world) : 1;
        if (kingdomId === sector.aId) sector.supplyA = supply;
        else sector.supplyB = supply;
      }
    }

    this.applyAttrition(world);
    this.supplyIsolatedGarrisons(world);
  }

  // ============================================================
  // ONE SECTOR'S SUPPLY
  // ============================================================

  private supplySector(
    sector: FrontSector,
    kingdomId: string,
    soldiers: number,
    world: LogisticsWorld
  ): number {
    const kingdom = world.kingdoms.get(kingdomId);
    if (!kingdom) return 0;

    const foodDemand = soldiers * FOOD_PER_SOLDIER;
    const munitionsDemand = soldiers * MUNITIONS_PER_SOLDIER;
    const munition = this.munitionFor(kingdom);

    const line = this.bestLine(sector, kingdom, world, foodDemand, munitionsDemand, munition);
    if (!line) {
      this.reportStarvation(sector, kingdom, world);
      // An army with no line at all lives off the country, badly.
      return 0.12;
    }

    this.lines.set(`${sector.id}:${kingdomId}`, line);

    const depot = world.cities.get(line.depotCityId);
    if (!depot) return 0.12;

    const shippable = line.capacity * line.integrity;

    // Food first: an unfed army stops being one faster than an unarmed one.
    const foodWanted = Math.min(foodDemand, shippable);
    const foodTaken = depot.stock.take('food', Math.max(0, Math.min(foodWanted, depot.stock.get('food') - DEPOT_RESERVE)));
    depot.ledger.recordConsumed('food', foodTaken);

    const munitionsRoom = Math.max(0, shippable - foodTaken);
    const munitionsWanted = Math.min(munitionsDemand, munitionsRoom);
    const munitionsTaken = depot.stock.take(munition, Math.max(0, Math.min(munitionsWanted, depot.stock.get(munition) - DEPOT_RESERVE)));
    depot.ledger.recordConsumed(munition, munitionsTaken);

    line.foodDelivered = foodTaken;
    line.munitionsDelivered = munitionsTaken;

    // Fed matters roughly twice what armed does: a hungry army melts, a
    // short-of-powder one still fights, worse.
    const fed = foodDemand > 0 ? Math.min(1, foodTaken / foodDemand) : 1;
    const armed = munitionsDemand > 0 ? Math.min(1, munitionsTaken / munitionsDemand) : 1;
    const supply = fed * 0.68 + armed * 0.32;

    if (supply < ATTRITION_THRESHOLD) this.reportStarvation(sector, kingdom, world);
    else this.starved.delete(`${sector.id}:${kingdomId}`);

    return supply;
  }

  /** Arrowheads and blades, until a realm knows powder. */
  private munitionFor(kingdom: Kingdom): GoodId {
    return kingdom.research.knows('gunpowder') ? 'gunpowder' : 'tools';
  }

  /**
   * The best route from any of the realm's depots to this sector.
   *
   * Every settlement that still holds stores is a candidate depot, and every
   * candidate is costed by the best carriage it can reach the front with. A
   * railhead beats a good road beats a track beats marching it up by hand, and a
   * settlement that has been cut off cannot be a depot at all — its stores are
   * needed where they are.
   */
  private bestLine(
    sector: FrontSector,
    kingdom: Kingdom,
    world: LogisticsWorld,
    foodDemand: number,
    munitionsDemand: number,
    munition: GoodId
  ): SupplyLine | null {
    let best: SupplyLine | null = null;

    for (const cityId of kingdom.cityIds) {
      const depot = world.cities.get(cityId);
      if (!depot) continue;
      if (world.fronts.isIsolated(depot.id)) continue;
      if (depot.besiegerId) continue;

      const stores = depot.stock.get('food') + depot.stock.get(munition);
      if (stores <= DEPOT_RESERVE) continue;

      const distance = Math.hypot(depot.x - sector.x, depot.y - sector.y);
      const candidate = this.costRoute(sector, depot, distance, world);
      if (!candidate) continue;

      const line: SupplyLine = {
        sectorId: sector.id,
        kingdomId: kingdom.id,
        depotCityId: depot.id,
        depotName: depot.name,
        mode: candidate.mode,
        distance,
        integrity: candidate.integrity,
        capacity: candidate.capacity,
        foodDelivered: 0,
        munitionsDelivered: 0,
        foodDemand,
        munitionsDemand
      };

      // Chosen on what it could actually put in front of the army, not on the
      // size of the road. A depot two tiles away with an empty armoury supplies
      // a worse war than a full one across the province, and picking purely by
      // carrying capacity had the front eating well and fighting with nothing.
      if (!best || this.projectedValue(line, depot, munition) > this.projectedValue(best, world.cities.get(best.depotCityId)!, munition)) {
        best = line;
      }
    }

    return best;
  }

  /** What a line would be worth if it ran this year, on the same scale as supply. */
  private projectedValue(line: SupplyLine, depot: City, munition: GoodId): number {
    const shippable = line.capacity * line.integrity;
    const food = Math.min(
      line.foodDemand,
      shippable,
      Math.max(0, depot.stock.get('food') - DEPOT_RESERVE)
    );
    const munitions = Math.min(
      line.munitionsDemand,
      Math.max(0, shippable - food),
      Math.max(0, depot.stock.get(munition) - DEPOT_RESERVE)
    );
    const fed = line.foodDemand > 0 ? food / line.foodDemand : 1;
    const armed = line.munitionsDemand > 0 ? munitions / line.munitionsDemand : 1;
    return fed * 0.68 + armed * 0.32;
  }

  /**
   * What a given depot can move to a given sector, and how intact the way is.
   *
   * Rail is claimed only when the depot's rail network actually reaches a
   * settlement near the front — a railhead in the wrong province is not a
   * military railway. Sea supply needs a working port at both ends. Otherwise it
   * is the road, at whatever condition the road is in, and failing that it is
   * carried.
   */
  private costRoute(
    sector: FrontSector,
    depot: City,
    distance: number,
    world: LogisticsWorld
  ): { mode: SupplyMode; capacity: number; integrity: number } | null {
    const railhead = this.railheadNear(sector, depot, world);
    if (railhead && distance <= MODE_RANGE.rail) {
      return {
        mode: 'rail',
        capacity: MODE_THROUGHPUT.rail * this.reach(distance, MODE_RANGE.rail),
        integrity: this.railIntegrity(depot, railhead, world)
      };
    }

    const port = this.militaryPortNear(sector, depot, world);
    if (port && distance <= MODE_RANGE.sea) {
      return {
        mode: 'sea',
        capacity: MODE_THROUGHPUT.sea * this.reach(distance, MODE_RANGE.sea),
        integrity: portOperational(depot) && portOperational(port) ? 1 : 0.35
      };
    }

    const road = SimplePathfinder.findPath(depot.x, depot.y, sector.x, sector.y, world.tileMap, 'land');
    if (road && road.length > 0 && distance <= MODE_RANGE.road) {
      const level = avgEffectiveRoadLevel(road, world.tileMap);
      // A dirt track is level 0 and still carries something; an imperial road
      // carries far more. `avgEffectiveRoadLevel` already nets out damage.
      const quality = 0.45 + Math.min(1, level / 3) * 0.55;
      return {
        mode: 'road',
        capacity: MODE_THROUGHPUT.road * quality * this.reach(distance, MODE_RANGE.road),
        integrity: this.roadIntegrity(road, world.tileMap)
      };
    }

    if (distance <= MODE_RANGE.foot) {
      return {
        mode: 'foot',
        capacity: MODE_THROUGHPUT.foot * this.reach(distance, MODE_RANGE.foot),
        integrity: 1
      };
    }

    return null;
  }

  /** Carrying capacity falls off with the length of the haul. */
  private reach(distance: number, range: number): number {
    return Math.max(0.1, 1 - (distance / range) * 0.6);
  }

  /**
   * A friendly settlement near the front that shares a rail network with the
   * depot. That pair is what makes the railway militarily useful.
   */
  private railheadNear(sector: FrontSector, depot: City, world: LogisticsWorld): City | null {
    for (const cityId of world.kingdoms.get(depot.kingdomId ?? '')?.cityIds ?? []) {
      const near = world.cities.get(cityId);
      if (!near || near.id === depot.id) continue;
      if (Math.hypot(near.x - sector.x, near.y - sector.y) > SECTOR_RADIUS * 2.2) continue;
      if (world.railways.connected(world.tileMap, depot, near)) return near;
    }
    return null;
  }

  /** Same idea by sea: a port at the depot and a port near the front. */
  private militaryPortNear(sector: FrontSector, depot: City, world: LogisticsWorld): City | null {
    if (!depot.hasBuilding('port') && !depot.hasBuilding('harbor')) return null;
    for (const cityId of world.kingdoms.get(depot.kingdomId ?? '')?.cityIds ?? []) {
      const near = world.cities.get(cityId);
      if (!near || near.id === depot.id) continue;
      if (!near.hasBuilding('port') && !near.hasBuilding('harbor')) continue;
      if (Math.hypot(near.x - sector.x, near.y - sector.y) > SECTOR_RADIUS * 2.2) continue;
      return near;
    }
    return null;
  }

  /**
   * How much of the rail between two settlements still carries.
   *
   * This is the line in the example that matters: wreck the track and the
   * integrity of every supply line running over it drops, so the front it fed
   * loses strength the following year without anyone fighting for it.
   */
  private railIntegrity(depot: City, railhead: City, world: LogisticsWorld): number {
    const path = SimplePathfinder.findPath(depot.x, depot.y, railhead.x, railhead.y, world.tileMap, 'land');
    if (!path || path.length === 0) return 0.5;

    let railed = 0;
    let damage = 0;
    for (const step of path) {
      const tile = world.tileMap.getTile(step.x, step.y);
      if (!tile || tile.railLevel <= 0) continue;
      railed++;
      damage += Math.min(1, tile.railDamage);
    }
    if (railed === 0) return 0.5;

    const coverage = railed / path.length;
    const health = 1 - damage / railed;
    // A line that is broken in the middle is worth much less than its average
    // condition suggests, so coverage and health multiply rather than average.
    return Math.max(0.1, Math.min(1, coverage * health + 0.12));
  }

  private roadIntegrity(path: { x: number; y: number }[], tileMap: TileMap): number {
    let damage = 0;
    let counted = 0;
    for (const step of path) {
      const tile = tileMap.getTile(step.x, step.y);
      if (!tile) continue;
      counted++;
      if (tile.roadLevel > 0) damage += Math.min(1, tile.roadDamage);
    }
    if (counted === 0) return 1;
    return Math.max(0.15, 1 - damage / counted);
  }

  // ============================================================
  // WHAT BEING UNSUPPLIED DOES
  // ============================================================

  /**
   * An army that is not being fed loses men without a battle.
   *
   * This is the difference between a supply system and a supply display. A
   * force sitting at the end of a cut line should shrink, and the realm should
   * feel it as war weariness rather than as a number in a panel.
   */
  private applyAttrition(world: LogisticsWorld): void {
    for (const sector of world.fronts.sectors.values()) {
      for (const kingdomId of [sector.aId, sector.bId]) {
        const supply = kingdomId === sector.aId ? sector.supplyA : sector.supplyB;
        const soldiers = kingdomId === sector.aId ? sector.soldiersA : sector.soldiersB;
        if (soldiers <= 0 || supply >= ATTRITION_THRESHOLD) continue;

        const severity = (ATTRITION_THRESHOLD - supply) / ATTRITION_THRESHOLD;
        let lost = 0;

        for (const e of world.entities) {
          if (e.kingdomId !== kingdomId || e.hp <= 0) continue;
          if (e.profession !== 'soldier' && e.profession !== 'king') continue;
          if (Math.hypot(e.x - sector.x, e.y - sector.y) > SECTOR_RADIUS) continue;

          // Hunger wears a body down before it kills it.
          e.hp -= Math.max(4, e.maxHp * 0.18 * severity);
          e.needs.hunger = Math.min(100, e.needs.hunger + 22 * severity);
          if (e.hp <= 0) lost++;
        }

        const kingdom = world.kingdoms.get(kingdomId);
        if (kingdom) kingdom.warWeariness = Math.min(100, kingdom.warWeariness + 3 * severity + lost);
      }
    }
  }

  /**
   * A cut-off settlement's garrison eats the settlement's own stores.
   *
   * Isolation has to bite on the defenders too, or being surrounded would be a
   * label rather than a condition. This is what starves a pocket out.
   */
  private supplyIsolatedGarrisons(world: LogisticsWorld): void {
    for (const cityId of world.fronts.isolated) {
      const city = world.cities.get(cityId);
      if (!city) continue;

      const garrison = world.entities.filter(
        e => e.cityId === cityId && e.hp > 0 && (e.profession === 'soldier' || e.profession === 'king')
      );
      if (garrison.length === 0) continue;

      const want = garrison.length * FOOD_PER_SOLDIER;
      const got = city.stock.take('food', Math.min(want, city.stock.get('food')));
      city.ledger.recordConsumed('food', got);

      if (got >= want * 0.7) continue;
      const shortfall = 1 - got / Math.max(1, want);
      for (const soldier of garrison) {
        soldier.hp -= Math.max(3, soldier.maxHp * 0.12 * shortfall);
        soldier.needs.hunger = Math.min(100, soldier.needs.hunger + 18 * shortfall);
      }
    }
  }

  private reportStarvation(sector: FrontSector, kingdom: Kingdom, world: LogisticsWorld): void {
    const key = `${sector.id}:${kingdom.id}`;
    if (this.starved.has(key)) return;
    this.starved.add(key);

    chronicle.log(
      world.year,
      'war',
      `As forças de ${kingdom.name} na frente ficaram sem linha de abastecimento.`,
      {
        title: `Abastecimento cortado`,
        importance: 'major',
        scope: 'international',
        refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
        tags: ['war', 'logistics', 'supply'],
        causes: ['Nenhum depósito do reino consegue mais alcançar este setor da frente.'],
        consequences: ['O exército no setor perde força e começa a sofrer baixas por privação.']
      }
    );
    events.emit('supplyLineCut', { kingdomId: kingdom.id, sectorId: sector.id, year: world.year });
  }

  // ============================================================
  // WHAT THE UI ASKS
  // ============================================================

  public lineFor(sectorId: string, kingdomId: string): SupplyLine | null {
    return this.lines.get(`${sectorId}:${kingdomId}`) ?? null;
  }

  public linesFor(kingdomId: string): SupplyLine[] {
    return [...this.lines.values()].filter(l => l.kingdomId === kingdomId);
  }
}
