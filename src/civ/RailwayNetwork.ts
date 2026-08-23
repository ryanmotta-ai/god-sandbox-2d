import { TileMap } from '../world/TileMap';
import { TERRAINS } from '../world/Biomes';
import { Tile } from '../world/Tile';
import { City } from './City';
import { Kingdom } from './Kingdom';
import { SimplePathfinder } from '../ai/Pathfinding';
import { chronicle } from './Chronicle';
import { GoodId } from './Goods';
import { perfProfiler } from '../perf/PerformanceProfiler';

/**
 * Railways (Phase I: logistics).
 *
 * Track lives on tiles (railLevel/railDamage/railOwnerId) and the whole network
 * is *derived* from tiles every year — there is no separate serialized graph, so
 * old saves load with empty railways and nothing to migrate. Rail moves the
 * industrial haulage chain (coal, iron, oil, steel) between stations on the same
 * connected line, with per-segment war damage that severs routes and a yearly
 * AI that lays corridors between a coal mine and a steel-forging city.
 */

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
const FREIGHT_GOODS: GoodId[] = ['coal', 'iron', 'oil', 'steel'];

/** Building types that put each freight good into a recipe. */
const CONSUMERS: Record<string, string[]> = {
  coal: ['smithy'],
  iron: ['smithy'],
  oil: ['refinery'],
  steel: ['factory']
};

/** Freight floor: a station only ships what it genuinely holds beyond this. */
const SURPLUS_FLOOR = 6;
/** Units one route can move per year, scaled by line condition. */
const BASE_THROUGHPUT = 10;
/** Track segments the AI lays per year. */
const LAY_PER_YEAR = 4;
/** Steel + wood cost per segment laid. */
const SEGMENT_STEEL = 1.2;
const SEGMENT_WOOD = 3;
/**
 * Machinery drawn per segment where the realm has any.
 *
 * A rail line is rolling stock, cranes and pumps, not only rail and sleeper.
 * Machinery was the one crafted good in the world with a factory, a recipe, a
 * three-input supply chain and no consumer at all — it was manufactured purely
 * to sit in a warehouse. It is optional rather than required so a realm that
 * reaches steam before industry can still lay track, just more slowly.
 */
const SEGMENT_MACHINERY = 0.35;
/** Track upgrades the AI raises per year (steam → industrialized → electric). */
const UPGRADE_PER_YEAR = 6;
/** Steel + wood to raise a segment one level; electrification drops the wood. */
const UPGRADE_STEEL = 2;
const UPGRADE_WOOD = 1;

export class RailwayNetwork {
  /** Freight carried this year, world total. Reset each year. */
  public yearlyFreight: number = 0;
  /** Segments laid by AI construction this year. */
  public yearlyConstructed: number = 0;
  /** Complete lines finished since the network object existed. */
  public linesBuilt: number = 0;

  private constructions: Map<string, { from: string; to: string; path: { x: number; y: number }[]; cursor: number }> = new Map();
  private cachedMap: TileMap | null = null;
  private cachedVersion = -1;
  private cachedRailTiles: Tile[] = [];
  private cachedComponents: Tile[][] = [];
  private stationComponents: Map<string, number> = new Map();
  private readonly railChunks = new Map<number, { version: number; coordinates: Array<[number, number]> }>();

  public reset(): void {
    this.yearlyFreight = 0;
    this.yearlyConstructed = 0;
    this.linesBuilt = 0;
    this.constructions.clear();
    this.cachedMap = null;
    this.cachedVersion = -1;
    this.cachedRailTiles = [];
    this.cachedComponents = [];
    this.stationComponents.clear();
    this.railChunks.clear();
  }

  // ============================ TRACK ============================

  /** Lays a single rail segment. Returns false over water or existing track. */
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

  /** Every tile carrying rail, live or damaged (capacity uses all of them). */
  public railTiles(tileMap: TileMap): Tile[] {
    this.ensureTopology(tileMap);
    return this.cachedRailTiles;
  }

  private ensureTopology(tileMap: TileMap): void {
    const chunksStable = this.cachedMap === tileMap && tileMap.chunkStore.chunks.every((chunk, key) => this.railChunks.get(key)?.version === chunk.railVersion);
    if (chunksStable && this.cachedVersion === tileMap.railNetworkVersion) return;
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
        for (const neighbor of tileMap.getNeighbors(tile.x, tile.y, true)) {
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
    perfProfiler.increment('networkRebuilds');
  }

  /**
   * Connected components of the operative network. A segment damaged to its
   * floor (railLevelEffective = 0) severs the line, splitting one component in
   * two — cutting a single rail link stops every freight route across it.
   */
  public components(tileMap: TileMap): Tile[][] {
    this.ensureTopology(tileMap);
    return this.cachedComponents;
  }

  /** 0..1 average condition of a line — capacity scales with it. */
  public lineQuality(tiles: Tile[]): number {
    if (tiles.length === 0) return 0;
    let sum = 0;
    for (const t of tiles) sum += t.railHealth;
    return sum / tiles.length;
  }

  // ============================ FREIGHT ============================

  /** Whether two stations may exchange rail freight (border closure rules). */
  private borderOpen(kf: string | null, kt: string | null, world: RailwayWorld): boolean {
    if (!kf || !kt) return false;
    if (kf === kt) return true; // domestic haulage needs no treaty
    return (
      world.trade.hasAgreement(kf, kt) &&
      !world.trade.isEmbargoed(kf, kt) &&
      !world.diplomacy.isAtWar(kf, kt)
    );
  }

  /** Whether `city` can actually put `good` to work right now. */
  private wantsGood(kingdom: Kingdom | null, city: City, good: GoodId): boolean {
    const knows = (t: string) => !!kingdom?.research.knows(t);
    switch (good) {
      case 'coal': return city.hasBuilding('smithy') && knows('metallurgy');
      case 'iron': return city.hasBuilding('smithy');
      case 'oil': return city.hasBuilding('refinery') && knows('industrialization');
      case 'steel': return city.hasBuilding('factory') && knows('industrialization');
      default: return false;
    }
  }

  /** Runs freight across every connected line. Stations with a surplus ship to
   *  stations on the same component that consume the good. */
  public tickFreight(world: RailwayWorld): void {
    const tileMap = world.tileMap;
    for (const comp of this.components(tileMap)) {
      const quality = this.lineQuality(comp);
      if (quality <= 0.01) continue;

      const stations: City[] = [];
      for (const t of comp) {
        if (t.cityId) {
          const c = world.cities.get(t.cityId);
          if (c) stations.push(c);
        }
      }
      if (stations.length < 2) continue;

      const throughput = Math.round(BASE_THROUGHPUT * quality);

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

  // ============================ AI CONSTRUCTION ============================

  /**
   * An industrial realm links its coal to its steel. A kingdom with steam_power
   * that has a coal mine in one city and a smithy in another surveys a corridor
   * (reusing the trade pathfinder) and lays track along it over the years,
   * paying steel and wood out of the mining city's stockpile.
   */
  public tickConstruction(world: RailwayWorld): void {
    for (const kingdom of world.kingdoms.values()) {
      if (!kingdom.research.knows('steam_power')) continue;
      if (kingdom.overlordId) continue; // vassals do not run their own lines

      const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
      if (cities.length < 2) continue;

      const producer = cities.find(c =>
        c.stock.get('coal') >= SURPLUS_FLOOR &&
        [...c.buildings.values()].some(b => b.type === 'mine' && b.extractedGood === 'coal' && b.staffing > 0)
      );
      const consumer = cities.find(c => c.hasBuilding('smithy'));
      if (!producer || !consumer || producer.id === consumer.id) continue;

      const connected = this.connected(world.tileMap, producer, consumer);
      if (connected) {
        this.constructions.delete(kingdom.id);
        continue;
      }

      let plan = this.constructions.get(kingdom.id);
      if (!plan || plan.from !== producer.id || plan.to !== consumer.id) {
        const path = SimplePathfinder.findPath(producer.x, producer.y, consumer.x, consumer.y, world.tileMap, 'land');
        if (!path || path.length < 2) continue;
        plan = { from: producer.id, to: consumer.id, path, cursor: 0 };
        this.constructions.set(kingdom.id, plan);
      }

      let laid = 0;
      while (plan.cursor < plan.path.length && laid < LAY_PER_YEAR) {
        const step = plan.path[plan.cursor];
        plan.cursor++;
        // Whichever end of the line actually holds the steel pays for the track.
        // This used to bill the coal mine for both materials — and a mining town
        // does not forge steel, the city at the other end with the smithy does.
        // So the check failed on the first segment and no realm ever laid track.
        const yard = consumer.stock.get('steel') >= SEGMENT_STEEL ? consumer : producer;
        if (yard.stock.get('steel') < SEGMENT_STEEL || yard.stock.get('wood') < SEGMENT_WOOD) break;
        // Over water or an already-laid stretch the segment is skipped at no cost.
        if (!this.layTrack(world.tileMap, step.x, step.y, kingdom.id)) continue;
        yard.stock.take('steel', SEGMENT_STEEL);
        yard.stock.take('wood', SEGMENT_WOOD);
        const geared = yard.stock.take('machinery', SEGMENT_MACHINERY);
        if (geared > 0) yard.ledger.recordConsumed('machinery', geared);
        yard.ledger.recordConsumed('steel', SEGMENT_STEEL);
        yard.ledger.recordConsumed('wood', SEGMENT_WOOD);
        laid++;
      }
      this.yearlyConstructed += laid;

      if (plan.cursor >= plan.path.length) {
        this.constructions.delete(kingdom.id);
        this.linesBuilt++;
        chronicle.log(
          world.year,
          'economy',
          `${kingdom.name} opened a railway line between ${producer.name} and ${consumer.name}, carrying coal to its forges.`,
          {
            title: `Railway: ${producer.name}–${consumer.name}`,
            importance: 'major',
            scope: 'kingdom',
            refs: [
              { kind: 'city', id: producer.id, name: producer.name },
              { kind: 'city', id: consumer.id, name: consumer.name },
              { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
            ],
            tags: ['railway', 'industry'],
            consequences: [`Coal now travels by rail between ${producer.name} and ${consumer.name}.`]
          }
        );
      }
    }
  }

  /** Whether two cities sit on the same operative rail component. */
  public connected(tileMap: TileMap, a: City, b: City): boolean {
    this.ensureTopology(tileMap);
    const component = this.stationComponents.get(a.id);
    return component !== undefined && component === this.stationComponents.get(b.id);
  }

  /** The whole yearly railway pass: lay new lines, then move freight. */
  public tickRailways(world: RailwayWorld): void {
    this.yearlyFreight = 0;
    this.yearlyConstructed = 0;
    this.tickConstruction(world);
    this.tickFreight(world);
  }
}
