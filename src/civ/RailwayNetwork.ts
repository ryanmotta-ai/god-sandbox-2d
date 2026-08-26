import { TileMap } from '../world/TileMap';
import { TERRAINS } from '../world/Biomes';
import { Tile } from '../world/Tile';
import { City } from './City';
import { Kingdom } from './Kingdom';
import { SimplePathfinder } from '../ai/Pathfinding';
import { chronicle } from './Chronicle';
import { GoodId, GOODS } from './Goods';
import { perfProfiler } from '../perf/PerformanceProfiler';
import { SpatialHash } from '../core/SpatialHash';
import { ParticleManager } from '../renderer/Particles';
import { rng } from '../core/Random';

/**
 * Supreme Railway & Train System (Aetherio).
 *
 * Physical rolling stock on the rails: steam locomotives with smoke puffs,
 * heavy diesel engines with cargo cars and high-speed electric bullet trains.
 * Supports 3 services:
 *  1. Heavy Freight (coal, iron, oil, steel, machinery, tools)
 *  2. Intercity Passenger Service (fares, population movement, research boost)
 *  3. Military Logistical Troop Transport (rapid redeployment in wartime)
 */

export type TrainType = 'steam' | 'diesel' | 'electric';
export type TrainService = 'freight' | 'passenger' | 'military';
export type TrainCarType =
  | 'coal_hopper'
  | 'ore_hopper'
  | 'oil_tanker'
  | 'boxcar'
  | 'passenger_car'
  | 'troop_car'
  | 'caboose';

export interface TrainCar {
  type: TrainCarType;
  cargo?: GoodId;
  amount?: number;
  x: number;
  y: number;
  headingX: number;
  headingY: number;
}

export interface ActiveTrain {
  id: string;
  name: string;
  kingdomId: string;
  kingdomColor: string;
  trainType: TrainType;
  service: TrainService;
  fromCityId: string;
  toCityId: string;
  fromCityName: string;
  toCityName: string;
  path: { x: number; y: number }[];
  routeTiles: number;
  progress: number; // 0..1
  direction: 1 | -1; // 1: to destination, -1: return trip
  speed: number;
  x: number;
  y: number;
  headingX: number;
  headingY: number;
  cargo?: GoodId;
  cargoAmount: number;
  passengers: number;
  ticketRevenue: number;
  regimentId?: string;
  troops: number;
  cars: TrainCar[];
  status: 'running' | 'halted' | 'arriving';
  stopCooldown: number; // ticks waiting at station
}

export interface RailwayWorld {
  year: number;
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
  tileMap: TileMap;
  diplomacy: { isAtWar(a: string, b: string): boolean };
  trade: { hasAgreement(a: string, b: string): boolean; isEmbargoed(a: string, b: string): boolean };
  market?: { reportDemand(good: GoodId, amount: number): void };
}

/** Goods the railway exists to haul — the industrial supply chain. */
const FREIGHT_GOODS: GoodId[] = ['coal', 'iron', 'oil', 'steel', 'machinery', 'tools'];

/** Building types that put each freight good into a recipe. */
const CONSUMERS: Record<string, string[]> = {
  coal: ['smithy', 'factory'],
  iron: ['smithy', 'factory'],
  oil: ['refinery'],
  steel: ['factory'],
  machinery: ['factory', 'refinery'],
  tools: ['mine', 'quarry', 'lumber_camp', 'workshop', 'factory']
};

/** Base speed in tiles per tick by train generation. */
const TRAIN_BASE_SPEED: Record<TrainType, number> = {
  steam: 0.085,
  diesel: 0.160,
  electric: 0.280
};

/** Capacity by train generation. */
const TRAIN_CAPACITY: Record<TrainType, { freight: number; passengers: number; cars: number }> = {
  steam: { freight: 35, passengers: 30, cars: 3 },
  diesel: { freight: 75, passengers: 65, cars: 4 },
  electric: { freight: 120, passengers: 130, cars: 5 }
};

/** Freight floor: a station only ships what it genuinely holds beyond this. */
const SURPLUS_FLOOR = 6;
/** Track segments the AI lays per year. */
const LAY_PER_YEAR = 16;
/** Steel + wood cost per segment laid. */
const SEGMENT_STEEL = 1.2;
const SEGMENT_WOOD = 3;
const SEGMENT_MACHINERY = 0.35;

export class RailwayNetwork {
  /** Freight carried this year, world total. Reset each year. */
  public yearlyFreight: number = 0;
  /** Passengers carried this year, world total. Reset each year. */
  public yearlyPassengers: number = 0;
  /** Passenger ticket revenue generated worldwide this year. */
  public yearlyRevenue: number = 0;
  /** Segments laid by AI construction this year. */
  public yearlyConstructed: number = 0;
  /** Complete lines finished since the network object existed. */
  public linesBuilt: number = 0;

  /** Active physical trains operating across the world rail network. */
  public activeTrains: Map<string, ActiveTrain> = new Map();
  private readonly renderIndex = new SpatialHash<ActiveTrain>(16);

  private constructions: Map<string, { from: string; to: string; path: { x: number; y: number }[]; cursor: number }> = new Map();
  private cachedMap: TileMap | null = null;
  private cachedVersion = -1;
  private cachedRailTiles: Tile[] = [];
  private cachedComponents: Tile[][] = [];
  private stationComponents: Map<string, number> = new Map();
  private readonly railChunks = new Map<number, { version: number; coordinates: Array<[number, number]> }>();

  public [Symbol.iterator](): Iterator<ActiveTrain> {
    return this.activeTrains.values();
  }

  public queryRect(minX: number, minY: number, maxX: number, maxY: number, result: ActiveTrain[] = []): ActiveTrain[] {
    if (this.renderIndex.size !== this.activeTrains.size) {
      this.renderIndex.rebuild(this.activeTrains.values());
    }
    return this.renderIndex.queryRect(minX, minY, maxX, maxY, result);
  }

  public reset(): void {
    this.yearlyFreight = 0;
    this.yearlyPassengers = 0;
    this.yearlyRevenue = 0;
    this.yearlyConstructed = 0;
    this.linesBuilt = 0;
    this.activeTrains.clear();
    this.renderIndex.clear();
    this.constructions.clear();
    this.cachedMap = null;
    this.cachedVersion = -1;
    this.cachedRailTiles = [];
    this.cachedComponents = [];
    this.stationComponents.clear();
    this.railChunks.clear();
  }

  // ============================ SERIALIZATION ============================

  public serialize(): any {
    return {
      activeTrains: [...this.activeTrains.values()],
      linesBuilt: this.linesBuilt,
      yearlyFreight: this.yearlyFreight,
      yearlyPassengers: this.yearlyPassengers,
      yearlyRevenue: this.yearlyRevenue
    };
  }

  public deserialize(data: any): void {
    this.activeTrains.clear();
    this.renderIndex.clear();
    this.linesBuilt = data?.linesBuilt ?? 0;
    this.yearlyFreight = data?.yearlyFreight ?? 0;
    this.yearlyPassengers = data?.yearlyPassengers ?? 0;
    this.yearlyRevenue = data?.yearlyRevenue ?? 0;

    for (const raw of data?.activeTrains ?? []) {
      const train = raw as ActiveTrain;
      if (train && train.id) {
        this.activeTrains.set(train.id, train);
      }
    }
    this.renderIndex.rebuild(this.activeTrains.values());
  }

  // ============================ TRACK MANAGEMENT ============================

  /** Lays a single rail segment. Returns false over open water or existing track. */
  public layTrack(tileMap: TileMap, x: number, y: number, ownerId: string | null): boolean {
    const tile = tileMap.getTile(Math.floor(x), Math.floor(y));
    if (!tile || TERRAINS[tile.type].isWater) return false;
    if (tile.railLevel > 0) return false;
    tile.railLevel = 1;
    tile.railDamage = 0;
    tile.railOwnerId = ownerId;
    tileMap.markRenderDirty(tile.x, tile.y);
    tileMap.markRailNetworkChanged(tile.x, tile.y);
    return true;
  }

  /** Removes a rail segment (raze tool / line abandonment). */
  public removeTrack(tileMap: TileMap, x: number, y: number): void {
    const tile = tileMap.getTile(Math.floor(x), Math.floor(y));
    if (!tile || tile.railLevel <= 0) return;
    tile.railLevel = 0;
    tile.railDamage = 0;
    tile.railOwnerId = null;
    tileMap.markRenderDirty(tile.x, tile.y);
    tileMap.markRailNetworkChanged(tile.x, tile.y);
  }

  /** Every tile carrying rail, live or damaged. */
  public railTiles(tileMap: TileMap): Tile[] {
    this.ensureTopology(tileMap);
    return this.cachedRailTiles;
  }

  private cachedDamageSum: number = -1;

  private ensureTopology(tileMap: TileMap): void {
    let currentDamageSum = 0;
    for (const t of this.cachedRailTiles) currentDamageSum += t.railDamage;

    const chunksStable = this.cachedMap === tileMap && tileMap.chunkStore.chunks.every((chunk, key) => this.railChunks.get(key)?.version === chunk.railVersion);
    if (chunksStable && this.cachedVersion === tileMap.railNetworkVersion && this.cachedDamageSum === currentDamageSum) return;
    const tiles: Tile[] = [];
    for (let cx = 0; cx < tileMap.chunkStore.chunksX; cx++) for (let cy = 0; cy < tileMap.chunkStore.chunksY; cy++) {
      const key = cx * tileMap.chunkStore.chunksY + cy;
      const chunk = tileMap.chunkStore.chunks[key];
      let cached = this.railChunks.get(key);
      if (!cached || cached.version !== chunk.railVersion) {
        const coordinates: Array<[number, number]> = [];
        const minX = cx * tileMap.chunkSize, minY = cy * tileMap.chunkSize;
        const maxX = Math.min(tileMap.width, minX + tileMap.chunkSize), maxY = Math.min(tileMap.height, minY + tileMap.chunkSize);
        for (let x = minX; x < maxX; x++) for (let y = minY; y < maxY; y++) if (tileMap.getTile(x, y)!.railLevel > 0) coordinates.push([x, y]);
        cached = { version: chunk.railVersion, coordinates };
        this.railChunks.set(key, cached);
      }
      for (const [x, y] of cached.coordinates) tiles.push(tileMap.getTile(x, y)!);
    }
    const seen = new Set<number>();
    const components: Tile[][] = [];
    const stationComponents = new Map<string, number>();
    for (const start of tiles) {
      const key = start.x * tileMap.height + start.y;
      if (seen.has(key) || start.railLevelEffective <= 0) continue;
      const componentIndex = components.length;
      const comp: Tile[] = [];
      const queue = [start];
      seen.add(key);
      while (queue.length) {
        const tile = queue.pop()!;
        comp.push(tile);
        if (tile.cityId && !stationComponents.has(tile.cityId)) stationComponents.set(tile.cityId, componentIndex);
        for (const neighbor of tileMap.getNeighbors(tile.x, tile.y, false)) {
          const neighborKey = neighbor.x * tileMap.height + neighbor.y;
          if (neighbor.railLevelEffective <= 0 || seen.has(neighborKey)) continue;
          seen.add(neighborKey);
          queue.push(neighbor);
        }
      }
      components.push(comp);
    }
    this.cachedMap = tileMap;
    this.cachedVersion = tileMap.railNetworkVersion;
    this.cachedRailTiles = tiles;
    this.cachedComponents = components;
    this.stationComponents = stationComponents;
    let newDamageSum = 0;
    for (const t of tiles) newDamageSum += t.railDamage;
    this.cachedDamageSum = newDamageSum;
    perfProfiler.increment('networkRebuilds');
  }

  /** Connected components of the operative network. */
  public components(tileMap: TileMap): Tile[][] {
    this.ensureTopology(tileMap);
    return this.cachedComponents;
  }

  /** 0..1 average condition of a line. */
  public lineQuality(tiles: Tile[]): number {
    if (tiles.length === 0) return 0;
    let sum = 0;
    for (const t of tiles) sum += t.railHealth;
    return sum / tiles.length;
  }

  /** Whether two cities sit on the same operative rail component. */
  public connected(tileMap: TileMap, a: City, b: City): boolean {
    this.ensureTopology(tileMap);
    const component = this.stationComponents.get(a.id);
    return component !== undefined && component === this.stationComponents.get(b.id);
  }

  // ============================ TRAIN GENERATION & DISPATCH ============================

  /** Determines the best train generation for a kingdom and its rail line. */
  public trainTypeFor(kingdom: Kingdom | null, highestRailLevel: number): TrainType {
    if (!kingdom) return 'steam';
    if (highestRailLevel >= 3 && kingdom.research.knows('electrification')) return 'electric';
    if (highestRailLevel >= 2 && (kingdom.research.knows('combustion_engine') || kingdom.research.knows('industrialization'))) return 'diesel';
    return 'steam';
  }

  /** Determines appropriate car types for the cargo and train type. */
  private assembleTrainCars(service: TrainService, trainType: TrainType, cargo?: GoodId): TrainCar[] {
    const config = TRAIN_CAPACITY[trainType];
    const cars: TrainCar[] = [];
    const count = config.cars;

    for (let i = 0; i < count; i++) {
      let carType: TrainCarType = 'boxcar';
      if (service === 'passenger') {
        carType = 'passenger_car';
      } else if (service === 'military') {
        carType = 'troop_car';
      } else if (cargo === 'coal') {
        carType = 'coal_hopper';
      } else if (cargo === 'iron' || cargo === 'tools') {
        carType = 'ore_hopper';
      } else if (cargo === 'oil') {
        carType = 'oil_tanker';
      } else {
        carType = 'boxcar';
      }
      cars.push({
        type: carType,
        cargo,
        amount: 0,
        x: 0,
        y: 0,
        headingX: 1,
        headingY: 0
      });
    }

    // Caboose at the end for steam/diesel freight
    if (service === 'freight' && trainType !== 'electric' && cars.length > 2) {
      cars[cars.length - 1].type = 'caboose';
    }

    return cars;
  }

  private borderOpen(kf: string | null, kt: string | null, world: RailwayWorld): boolean {
    if (!kf || !kt) return false;
    if (kf === kt) return true;
    return (
      world.trade.hasAgreement(kf, kt) &&
      !world.trade.isEmbargoed(kf, kt) &&
      !world.diplomacy.isAtWar(kf, kt)
    );
  }

  private wantsGood(kingdom: Kingdom | null, city: City, good: GoodId): boolean {
    const knows = (t: string) => !!kingdom?.research.knows(t);
    switch (good) {
      case 'coal': return (city.hasBuilding('smithy') && knows('metallurgy')) || (city.hasBuilding('factory') && knows('industrialization'));
      case 'iron': return city.hasBuilding('smithy') || city.hasBuilding('factory');
      case 'oil': return city.hasBuilding('refinery') && knows('industrialization');
      case 'steel': return city.hasBuilding('factory') && knows('industrialization');
      case 'machinery': return city.hasBuilding('factory') || city.hasBuilding('refinery');
      case 'tools': return city.population >= 20;
      default: return false;
    }
  }

  /** Direct freight simulation pass across connected lines. */
  public tickFreight(world: RailwayWorld): void {
    const tileMap = world.tileMap;
    for (const comp of this.components(tileMap)) {
      const quality = this.lineQuality(comp);
      if (quality <= 0.01) continue;

      const stations: City[] = [];
      for (const t of comp) {
        if (t.cityId) {
          const c = world.cities.get(t.cityId);
          if (c && !stations.includes(c)) stations.push(c);
        }
      }
      if (stations.length < 2) continue;

      const throughput = Math.round(10 * quality);

      for (const from of stations) {
        for (const to of stations) {
          if (from.id === to.id) continue;
          if (!this.borderOpen(from.kingdomId, to.kingdomId, world)) continue;
          const toKingdom = to.kingdomId ? world.kingdoms.get(to.kingdomId) ?? null : null;
          for (const good of FREIGHT_GOODS) {
            if (!this.wantsGood(toKingdom, to, good)) continue;
            const surplus = from.stock.get(good) - SURPLUS_FLOOR;
            if (surplus <= 0) continue;
            const amount = Math.min(surplus, throughput);
            if (amount < 1) continue;

            const moved = from.stock.take(good, amount);
            const delivered = to.stock.add(good, moved);
            if (delivered < moved) from.stock.add(good, moved - delivered);

            from.ledger.recordExported(good, delivered);
            to.ledger.recordImported(good, delivered);
            world.market?.reportDemand(good, delivered);
            this.yearlyFreight += delivered;
          }
        }
      }
    }
  }

  /**
   * Spawns physical active trains for industrial freight, passengers, and military logistics.
   */
  public dispatchTrains(world: RailwayWorld): void {
    const tileMap = world.tileMap;
    this.ensureTopology(tileMap);

    for (const comp of this.cachedComponents) {
      const quality = this.lineQuality(comp);
      if (quality <= 0.05) continue;

      const stations: City[] = [];
      for (const t of comp) {
        if (t.cityId) {
          const c = world.cities.get(t.cityId);
          if (c && !stations.includes(c)) stations.push(c);
        }
      }
      if (stations.length < 2) continue;

      // Find rail path using pathfinder over rail tiles
      for (let i = 0; i < stations.length; i++) {
        for (let j = i + 1; j < stations.length; j++) {
          const from = stations[i];
          const to = stations[j];
          if (!this.borderOpen(from.kingdomId, to.kingdomId, world)) continue;

          const trainId = `train_${from.id}_${to.id}`;
          if (this.activeTrains.has(trainId)) continue;

          // Limit total trains per city pairing
          const existingForLine = [...this.activeTrains.values()].filter(
            t => (t.fromCityId === from.id && t.toCityId === to.id) || (t.fromCityId === to.id && t.toCityId === from.id)
          );
          if (existingForLine.length >= 2) continue;

          const fromKingdom = from.kingdomId ? world.kingdoms.get(from.kingdomId) ?? null : null;
          const toKingdom = to.kingdomId ? world.kingdoms.get(to.kingdomId) ?? null : null;
          const kColor = fromKingdom?.color ?? toKingdom?.color ?? '#38bdf8';

          const path = SimplePathfinder.findPath(from.x, from.y, to.x, to.y, tileMap, 'land');
          if (path.length < 2) continue;

          let maxRailLevel = 1;
          for (const step of path) {
            const t = tileMap.getTile(step.x, step.y);
            if (t && t.railLevel > maxRailLevel) maxRailLevel = t.railLevel;
          }
          const trainType = this.trainTypeFor(fromKingdom, maxRailLevel);
          const config = TRAIN_CAPACITY[trainType];

          let routeTiles = 0;
          for (let s = 1; s < path.length; s++) {
            routeTiles += Math.hypot(path[s].x - path[s - 1].x, path[s].y - path[s - 1].y);
          }
          routeTiles = Math.max(1, routeTiles);
          const baseSpeed = (TRAIN_BASE_SPEED[trainType] / routeTiles) * quality;

          // 1. Check Heavy Freight need
          let freightDispatched = false;
          for (const good of FREIGHT_GOODS) {
            if (from.stock.get(good) > SURPLUS_FLOOR && this.wantsGood(toKingdom, to, good)) {
              const available = Math.min(config.freight, from.stock.get(good) - SURPLUS_FLOOR);
              if (available >= 4) {
                const loaded = from.stock.take(good, available);
                const cars = this.assembleTrainCars('freight', trainType, good);

                const train: ActiveTrain = {
                  id: trainId,
                  name: `Expresso de Carga ${from.name}–${to.name}`,
                  kingdomId: from.kingdomId ?? '',
                  kingdomColor: kColor,
                  trainType,
                  service: 'freight',
                  fromCityId: from.id,
                  toCityId: to.id,
                  fromCityName: from.name,
                  toCityName: to.name,
                  path,
                  routeTiles,
                  progress: 0,
                  direction: 1,
                  speed: baseSpeed,
                  x: from.x,
                  y: from.y,
                  headingX: 1,
                  headingY: 0,
                  cargo: good,
                  cargoAmount: loaded,
                  passengers: 0,
                  ticketRevenue: 0,
                  troops: 0,
                  cars,
                  status: 'running',
                  stopCooldown: 0
                };
                this.activeTrains.set(trainId, train);
                freightDispatched = true;
                break;
              }
            }
          }

          if (freightDispatched) continue;

          // 2. Intercity Passenger Service
          const popFactor = Math.min(from.population, to.population);
          const hasStations = from.hasBuilding('train_station') || to.hasBuilding('train_station');
          if ((popFactor >= 20 || hasStations) && rng.chance(0.65)) {
            const passCount = Math.min(config.passengers, Math.floor(popFactor * 0.45));
            const fare = Math.round(passCount * 0.85);
            const passTrainId = `train_pass_${from.id}_${to.id}`;
            if (!this.activeTrains.has(passTrainId)) {
              const cars = this.assembleTrainCars('passenger', trainType);
              const train: ActiveTrain = {
                id: passTrainId,
                name: `Linha de Passageiros ${from.name}–${to.name}`,
                kingdomId: from.kingdomId ?? '',
                kingdomColor: kColor,
                trainType,
                service: 'passenger',
                fromCityId: from.id,
                toCityId: to.id,
                fromCityName: from.name,
                toCityName: to.name,
                path,
                routeTiles,
                progress: 0,
                direction: 1,
                speed: baseSpeed * 1.15,
                x: from.x,
                y: from.y,
                headingX: 1,
                headingY: 0,
                cargoAmount: 0,
                passengers: passCount,
                ticketRevenue: fare,
                troops: 0,
                cars,
                status: 'running',
                stopCooldown: 0
              };
              this.activeTrains.set(passTrainId, train);
            }
          }
        }
      }
    }
    this.renderIndex.rebuild(this.activeTrains.values());
  }

  // ============================ REAL-TIME MICRO-TICK UPDATE ============================

  /**
   * Advances active trains along tracks, updates car trailers, handles deliveries & fares.
   * Called every tick in EntityAI.
   */
  public updateTrains(
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>,
    tileMap: TileMap,
    particles: ParticleManager,
    currentYear: number,
    market?: { reportDemand(good: GoodId, amount: number): void }
  ): void {
    const toRemove: string[] = [];

    for (const [id, train] of this.activeTrains) {
      const fromCity = cities.get(train.fromCityId);
      const toCity = cities.get(train.toCityId);

      if (!fromCity || !toCity || train.path.length < 2) {
        toRemove.push(id);
        continue;
      }

      // Station wait cooldown
      if (train.stopCooldown > 0) {
        train.stopCooldown--;
        continue;
      }

      // Check current tile rail health
      const curTile = tileMap.getTile(Math.floor(train.x), Math.floor(train.y));
      const trackMultiplier = curTile ? Math.max(0.2, curTile.railHealth) : 1.0;

      train.progress += train.speed * train.direction * trackMultiplier;

      // Arrival at Destination
      if (train.progress >= 1.0) {
        train.progress = 1.0;
        train.direction = -1;
        train.stopCooldown = 45;
        this.settleTrainArrival(train, fromCity, toCity, kingdoms, particles, currentYear, market);
      } else if (train.progress <= 0.0) {
        // Return trip completed at Origin
        train.progress = 0.0;
        train.direction = 1;
        train.stopCooldown = 45;
        this.settleTrainArrival(train, toCity, fromCity, kingdoms, particles, currentYear, market);
      }

      // Interpolate locomotive position along path
      const totalSegs = train.path.length - 1;
      const rawIdx = Math.max(0, Math.min(totalSegs - 0.001, train.progress * totalSegs));
      const pathIdx = Math.floor(rawIdx);
      const subFrac = rawIdx - pathIdx;
      const p1 = train.path[pathIdx] ?? train.path[0];
      const p2 = train.path[Math.min(totalSegs, pathIdx + 1)] ?? p1;

      if (p1 && p2) {
        train.x = p1.x + (p2.x - p1.x) * subFrac;
        train.y = p1.y + (p2.y - p1.y) * subFrac;

        const legX = (p2.x - p1.x) * train.direction;
        const legY = (p2.y - p1.y) * train.direction;
        const len = Math.hypot(legX, legY);
        if (len > 0.0001) {
          train.headingX = legX / len;
          train.headingY = legY / len;
        }
      }

      // Trailing cars along path behind locomotive
      const carSpacingFraction = 0.85 / Math.max(1, train.routeTiles);
      for (let c = 0; c < train.cars.length; c++) {
        const car = train.cars[c];
        const carOffset = (c + 1) * carSpacingFraction;
        let carProgress = train.progress - carOffset * train.direction;
        carProgress = Math.max(0, Math.min(1, carProgress));

        const carRawIdx = Math.max(0, Math.min(totalSegs - 0.001, carProgress * totalSegs));
        const carPathIdx = Math.floor(carRawIdx);
        const carSubFrac = carRawIdx - carPathIdx;
        const cp1 = train.path[carPathIdx] ?? train.path[0];
        const cp2 = train.path[Math.min(totalSegs, carPathIdx + 1)] ?? cp1;

        if (cp1 && cp2) {
          car.x = cp1.x + (cp2.x - cp1.x) * carSubFrac;
          car.y = cp1.y + (cp2.y - cp1.y) * carSubFrac;
          const cLegX = (cp2.x - cp1.x) * train.direction;
          const cLegY = (cp2.y - cp1.y) * train.direction;
          const cLen = Math.hypot(cLegX, cLegY);
          if (cLen > 0.0001) {
            car.headingX = cLegX / cLen;
            car.headingY = cLegY / cLen;
          }
        }
      }
    }

    for (const rid of toRemove) {
      this.activeTrains.delete(rid);
    }
    this.renderIndex.rebuild(this.activeTrains.values());
  }

  /** Settles freight delivery, passenger fares, and updates ledgers/chronicle upon station arrival. */
  private settleTrainArrival(
    train: ActiveTrain,
    senderCity: City,
    receiverCity: City,
    kingdoms: Map<string, Kingdom>,
    particles: ParticleManager,
    currentYear: number,
    market?: { reportDemand(good: GoodId, amount: number): void }
  ): void {
    if (train.service === 'freight' && train.cargo && train.cargoAmount > 0) {
      const delivered = receiverCity.stock.add(train.cargo, train.cargoAmount);
      senderCity.ledger.recordExported(train.cargo, delivered);
      receiverCity.ledger.recordImported(train.cargo, delivered);
      market?.reportDemand(train.cargo, delivered);

      this.yearlyFreight += delivered;
      particles.spawnDamageNumber(train.x, train.y, Math.round(delivered));

      // Reload freight on return trip if receiver has surplus
      for (const good of FREIGHT_GOODS) {
        if (receiverCity.stock.get(good) > SURPLUS_FLOOR * 1.5) {
          const config = TRAIN_CAPACITY[train.trainType];
          const takeAmt = Math.min(config.freight, receiverCity.stock.get(good) - SURPLUS_FLOOR);
          if (takeAmt >= 4) {
            const loaded = receiverCity.stock.take(good, takeAmt);
            train.cargo = good;
            train.cargoAmount = loaded;
            break;
          }
        }
      }
    } else if (train.service === 'passenger' && train.passengers > 0) {
      this.yearlyPassengers += train.passengers;
      this.yearlyRevenue += train.ticketRevenue;

      // Transfer ticket revenue to receiver kingdom/city treasury
      const k = receiverCity.kingdomId ? kingdoms.get(receiverCity.kingdomId) : null;
      if (k) {
        k.treasury.add('gold', train.ticketRevenue * 0.4);
      }
      particles.spawnDamageNumber(train.x, train.y, train.passengers);

      // Exchange knowledge / research
      if (k && receiverCity.hasBuilding('train_station')) {
        k.research.progress += Math.round(train.passengers * 0.25);
      }
    }
  }

  // ============================ YEARLY AI CONSTRUCTION & EXPANSION ============================

  /** Connects kingdom cities with steel rails. */
  public connectKingdomNetwork(kingdom: Kingdom, world: RailwayWorld, instant: boolean = true): void {
    const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
    if (cities.length < 2) return;

    const capital = world.cities.get(kingdom.capitalCityId) ?? cities[0];
    const connectedCities = new Set<string>([capital.id]);
    let segmentsLaid = 0;

    while (connectedCities.size < cities.length) {
      let bestFrom: City | null = null;
      let bestTo: City | null = null;
      let bestDistance = Infinity;

      for (const fromId of connectedCities) {
        const fromCity = world.cities.get(fromId);
        if (!fromCity) continue;

        for (const candidate of cities) {
          if (connectedCities.has(candidate.id)) continue;
          const dist = Math.hypot(fromCity.x - candidate.x, fromCity.y - candidate.y);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestFrom = fromCity;
            bestTo = candidate;
          }
        }
      }

      if (!bestFrom || !bestTo) break;

      const path = SimplePathfinder.findPath(bestFrom.x, bestFrom.y, bestTo.x, bestTo.y, world.tileMap, 'land');
      if (path && path.length >= 2) {
        for (const step of path) {
          if (this.layTrack(world.tileMap, step.x, step.y, kingdom.id)) {
            segmentsLaid++;
          }
        }
        connectedCities.add(bestTo.id);
      } else {
        connectedCities.add(bestTo.id);
      }
    }

    if (segmentsLaid > 0) {
      this.ensureTopology(world.tileMap);
      chronicle.log(
        world.year,
        'economy',
        `A Grande Malha Ferroviária de ${kingdom.name} conectou todas as suas províncias sobre trilhos de aço!`,
        {
          title: `Rede Ferroviária Imperial de ${kingdom.name}`,
          importance: 'major',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
          tags: ['railway', 'industry', 'infrastructure'],
          consequences: [`Todas as ${cities.length} cidades de ${kingdom.name} agora estão unidas por ferrovias.`]
        }
      );
    }
  }

  public tickConstruction(world: RailwayWorld): void {
    for (const kingdom of world.kingdoms.values()) {
      if (!kingdom.research.knows('steam_power')) continue;
      if (kingdom.overlordId) continue;

      const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
      if (cities.length < 2) continue;

      let allConnected = true;
      const capital = world.cities.get(kingdom.capitalCityId) ?? cities[0];
      for (const c of cities) {
        if (c.id !== capital.id && !this.connected(world.tileMap, capital, c)) {
          allConnected = false;
          break;
        }
      }

      if (allConnected) {
        this.constructions.delete(kingdom.id);
        continue;
      }

      let plan = this.constructions.get(kingdom.id);
      if (!plan) {
        let bestFrom: City | null = null;
        let bestTo: City | null = null;
        let bestDistance = Infinity;

        for (const from of cities) {
          for (const to of cities) {
            if (from.id === to.id) continue;
            if (this.connected(world.tileMap, from, to)) continue;
            const dist = Math.hypot(from.x - to.x, from.y - to.y);
            if (dist < bestDistance) {
              bestDistance = dist;
              bestFrom = from;
              bestTo = to;
            }
          }
        }

        if (bestFrom && bestTo) {
          const path = SimplePathfinder.findPath(bestFrom.x, bestFrom.y, bestTo.x, bestTo.y, world.tileMap, 'land');
          if (path && path.length >= 2) {
            plan = { from: bestFrom.id, to: bestTo.id, path, cursor: 0 };
            this.constructions.set(kingdom.id, plan);
          }
        }
      }

      if (!plan) continue;

      const fromCity = world.cities.get(plan.from);
      const toCity = world.cities.get(plan.to);
      const yard = (fromCity && fromCity.stock.get('wood') >= SEGMENT_WOOD)
        ? fromCity
        : (toCity && toCity.stock.get('wood') >= SEGMENT_WOOD ? toCity : (fromCity ?? toCity));

      let laid = 0;
      while (plan.cursor < plan.path.length && laid < LAY_PER_YEAR) {
        const step = plan.path[plan.cursor];
        plan.cursor++;

        if (!this.layTrack(world.tileMap, step.x, step.y, kingdom.id)) continue;
        if (yard) {
          yard.stock.take('wood', SEGMENT_WOOD);
          yard.stock.take('steel', SEGMENT_STEEL);
        }
        laid++;
      }
      this.yearlyConstructed += laid;

      if (plan.cursor >= plan.path.length) {
        this.constructions.delete(kingdom.id);
        this.linesBuilt++;
        if (fromCity && toCity) {
          chronicle.log(
            world.year,
            'economy',
            `${kingdom.name} inaugurou a linha férrea ligando ${fromCity.name} a ${toCity.name}!`,
            {
              title: `Ferrovia: ${fromCity.name}–${toCity.name}`,
              importance: 'major',
              scope: 'kingdom',
              refs: [
                { kind: 'city', id: fromCity.id, name: fromCity.name },
                { kind: 'city', id: toCity.id, name: toCity.name },
                { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
              ],
              tags: ['railway', 'infrastructure'],
              consequences: [`Transporte rápido e comércio por ferrovia estabelecido entre ${fromCity.name} e ${toCity.name}.`]
            }
          );
        }
      }
    }
  }

  /** The whole yearly railway pass: lay new lines, dispatch active trains. */
  public tickRailways(world: RailwayWorld): void {
    this.yearlyFreight = 0;
    this.yearlyPassengers = 0;
    this.yearlyRevenue = 0;
    this.yearlyConstructed = 0;
    this.tickConstruction(world);
    this.tickFreight(world);
    this.dispatchTrains(world);
  }
}

