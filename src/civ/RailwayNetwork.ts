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

  // ============================ AI CONSTRUCTION ============================

  /**
   * Immediately connects all cities belonging to the same kingdom with railways.
   */
  public connectKingdomNetwork(kingdom: Kingdom, world: RailwayWorld, instant: boolean = true): void {
    const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
    if (cities.length < 2) return;

    const capital = world.cities.get(kingdom.capitalCityId) ?? cities[0];
    const connectedCities = new Set<string>([capital.id]);
    let segmentsLaid = 0;

    // Minimum Spanning Tree across kingdom cities
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
        // Direct jump if path blocked
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

  /**
   * An industrial realm links all its cities with railways.
   */
  public tickConstruction(world: RailwayWorld): void {
    for (const kingdom of world.kingdoms.values()) {
      if (!kingdom.research.knows('steam_power')) continue;
      if (kingdom.overlordId) continue; // vassals do not run their own lines

      const cities = [...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c);
      if (cities.length < 2) continue;

      // Check if all cities in kingdom are already interconnected
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

      // Find the best pair to build next (unconnected city to closest connected city)
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
      const yard = (toCity && toCity.stock.get('wood') >= SEGMENT_WOOD) ? toCity : fromCity;

      let laid = 0;
      const batchSpeed = 16; // Accelerated construction for intercity networks
      while (plan.cursor < plan.path.length && laid < batchSpeed) {
        const step = plan.path[plan.cursor];
        plan.cursor++;

        if (!this.layTrack(world.tileMap, step.x, step.y, kingdom.id)) continue;
        if (yard) {
          yard.stock.take('wood', SEGMENT_WOOD * 0.5);
          yard.stock.take('steel', SEGMENT_STEEL * 0.5);
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
