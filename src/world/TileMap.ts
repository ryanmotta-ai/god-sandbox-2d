import { Tile } from './Tile';
import { isRenewableGood } from './Deposits';
import { TerrainType, TERRAINS } from './Biomes';
import { WorldGenerator, GeneratorPreset } from './WorldGenerator';
import { events } from '../core/EventBus';
import { RandomService, rng } from '../core/Random';
import { GoodId } from '../civ/Goods';
import { ChunkedTileStore, RegionState, WORLD_CHUNK_SIZE, type SerializedWorldChunk } from './WorldChunks';

export interface PendingBuildingDamage {
  cityId: string;
  buildingId: string;
  fraction: number;
  cause: 'fire' | 'disaster';
  exposures: number;
}

export class TileMap {
  public width: number;
  public height: number;
  public grid: Tile[][];
  public chunkStore: ChunkedTileStore;
  public seed: number;
  /** Saved deterministic ecology step so resource regrowth is reproducible across reloads. */
  private ecologyStep: number = 0;
  /** Tiles whose static terrain bake must be redrawn, keyed by x*height+y. */
  public dirtyTiles: Set<number> = new Set();
  /** Avoids allocating one Set entry per tile for a full-world refresh. */
  public allTilesDirty = false;
  /** Logical 32x32 dirty regions: groundwork for future chunk surfaces/streaming. */
  public readonly chunkSize = WORLD_CHUNK_SIZE;
  public dirtyChunks: Set<number> = new Set();
  /** Monotonic topology generations used by bounded derived caches. */
  public terrainVersion = 1;
  public roadNetworkVersion = 1;
  public railNetworkVersion = 1;
  private activeFireTiles: Set<number> = new Set();
  private fireScratch: Set<number> = new Set();
  /** Event buffer drained by CITY-V6 once per simulation year. */
  private pendingBuildingDamage = new Map<string, PendingBuildingDamage>();
  private fluidDirty = true;
  private regionCounts = { active: 0, warm: 0, sleeping: 0 };
  private readonly chunkTraversalCache = new Map<string, { version: number; cost: number }>();

  constructor(width: number = 128, height: number = 128, preset: GeneratorPreset = 'single_continent', seed?: number) {
    this.width = width;
    this.height = height;
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    this.chunkStore = new ChunkedTileStore(width, height);
    this.grid = this.chunkStore.grid;
    WorldGenerator.generate(width, height, preset, this.seed, this.grid);
    this.regionCounts = this.chunkStore.updateRegionStates(width / 2, height / 2);
    this.markAllDirty();
  }

  public getTile(x: number, y: number): Tile | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }
    return this.chunkStore.getTile(Math.floor(x), Math.floor(y));
  }

  public updateRegionStates(centerX: number, centerY: number): Readonly<{ active: number; warm: number; sleeping: number }> {
    this.regionCounts = this.chunkStore.updateRegionStates(centerX, centerY);
    return this.regionCounts;
  }

  public regionStateAt(x: number, y: number): RegionState { return this.chunkStore.getChunkAt(x, y)?.state ?? RegionState.SLEEPING; }
  public get approximateTileStorageBytes(): number { return this.chunkStore.approximateBytes; }

  public getNeighbors(x: number, y: number, includeDiagonal: boolean = false): Tile[] {
    const neighbors: Tile[] = [];
    const dirs = includeDiagonal
      ? [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
      : [[-1,0],[1,0],[0,-1],[0,1]];

    for (const [dx, dy] of dirs) {
      const t = this.getTile(x + dx, y + dy);
      if (t) neighbors.push(t);
    }
    return neighbors;
  }

  /** Mark a tile and its 4-neighbours as needing a static-bake redraw (relief/edges depend on neighbours). */
  public markRenderDirty(x: number, y: number): void {
    const h = this.height;
    this.dirtyTiles.add(x * h + y);
    if (x > 0) this.dirtyTiles.add((x - 1) * h + y);
    if (x < this.width - 1) this.dirtyTiles.add((x + 1) * h + y);
    if (y > 0) this.dirtyTiles.add(x * h + (y - 1));
    if (y < this.height - 1) this.dirtyTiles.add(x * h + (y + 1));
    const chunksPerColumn = Math.ceil(this.height / this.chunkSize);
    // Roads, rails and frontier strokes inspect cardinal neighbours. Only a
    // tile on a chunk seam can affect the adjacent resident buffer.
    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    const maxCX = Math.ceil(this.width / this.chunkSize) - 1;
    const maxCY = chunksPerColumn - 1;
    this.dirtyChunks.add(cx * chunksPerColumn + cy);
    const localX = x % this.chunkSize, localY = y % this.chunkSize;
    if (localX === 0 && cx > 0) this.dirtyChunks.add((cx - 1) * chunksPerColumn + cy);
    if (localX === this.chunkSize - 1 && cx < maxCX) this.dirtyChunks.add((cx + 1) * chunksPerColumn + cy);
    if (localY === 0 && cy > 0) this.dirtyChunks.add(cx * chunksPerColumn + cy - 1);
    if (localY === this.chunkSize - 1 && cy < maxCY) this.dirtyChunks.add(cx * chunksPerColumn + cy + 1);
  }

  /** Mark every tile dirty (used on world creation / load / resize). */
  public markAllDirty(): void {
    this.allTilesDirty = true;
    this.dirtyTiles.clear();
    this.dirtyChunks.clear();
    const chunksX = Math.ceil(this.width / this.chunkSize);
    const chunksY = Math.ceil(this.height / this.chunkSize);
    for (let x = 0; x < chunksX; x++) for (let y = 0; y < chunksY; y++) this.dirtyChunks.add(x * chunksY + y);
  }

  public markTerrainChanged(x?: number, y?: number): void {
    this.terrainVersion++;
    this.fluidDirty = true;
    if (x !== undefined && y !== undefined) {
      const chunk = this.chunkStore.getChunkAt(x, y); if (chunk) chunk.terrainVersion++;
      this.markRenderDirty(x, y);
    } else for (const dirty of this.dirtyChunks) this.chunkStore.chunks[dirty]!.terrainVersion++;
  }

  public markRoadNetworkChanged(x?: number, y?: number): void {
    this.roadNetworkVersion++;
    if (x !== undefined && y !== undefined) { const chunk = this.chunkStore.getChunkAt(x, y); if (chunk) chunk.roadVersion++; return; }
    for (const dirty of this.dirtyChunks) this.chunkStore.chunks[dirty]!.roadVersion++;
  }
  public markRailNetworkChanged(x?: number, y?: number): void {
    this.railNetworkVersion++;
    if (x !== undefined && y !== undefined) { const chunk = this.chunkStore.getChunkAt(x, y); if (chunk) chunk.railVersion++; return; }
    for (const dirty of this.dirtyChunks) this.chunkStore.chunks[dirty]!.railVersion++;
  }

  /** Bridges per-tick disasters/fire to the periodic urban lifecycle without a world scan. */
  public recordBuildingDamage(tile: Tile, fraction: number, cause: PendingBuildingDamage['cause']): void {
    if (!tile.buildingId || !tile.cityId || fraction <= 0) return;
    const key = `${tile.cityId}\u0000${tile.buildingId}`;
    const previous = this.pendingBuildingDamage.get(key);
    if (previous) {
      previous.fraction = Math.min(1.5, previous.fraction + fraction);
      previous.exposures++;
      if (cause === 'disaster') previous.cause = cause;
    } else {
      this.pendingBuildingDamage.set(key, {
        cityId: tile.cityId,
        buildingId: tile.buildingId,
        fraction: Math.min(1.5, fraction),
        cause,
        exposures: 1
      });
    }
  }

  public drainBuildingDamageEvents(): PendingBuildingDamage[] {
    if (this.pendingBuildingDamage.size === 0) return [];
    const events = [...this.pendingBuildingDamage.values()];
    this.pendingBuildingDamage.clear();
    return events;
  }

  public pathVersionFor(path: readonly { x: number; y: number }[], mode: 'land' | 'sea' | 'road'): string {
    const seen = new Set<number>(); const versions: string[] = [];
    for (const point of path) {
      const cx = Math.floor(point.x / this.chunkSize), cy = Math.floor(point.y / this.chunkSize), key = cx * this.chunkStore.chunksY + cy;
      if (seen.has(key)) continue; seen.add(key);
      const chunk = this.chunkStore.chunks[key]; if (!chunk) continue;
      versions.push(`${key}:${chunk.terrainVersion}:${mode === 'sea' ? 0 : chunk.roadVersion}`);
    }
    return versions.join('|');
  }

  /** Cached macro-node cost used by hierarchical pathfinding. */
  public chunkTraversalCost(cx: number, cy: number, mode: 'land' | 'sea' | 'road'): number {
    const chunk = this.chunkStore.getChunk(cx, cy); if (!chunk) return Infinity;
    const version = mode === 'sea' ? chunk.terrainVersion : chunk.terrainVersion * 65537 + chunk.roadVersion;
    const key = `${mode}:${cx}:${cy}`; const cached = this.chunkTraversalCache.get(key);
    if (cached?.version === version) return cached.cost;
    const minX = cx * this.chunkSize, minY = cy * this.chunkSize;
    const maxX = Math.min(this.width, minX + this.chunkSize), maxY = Math.min(this.height, minY + this.chunkSize);
    let passable = 0, totalCost = 0;
    for (let x = minX; x < maxX; x++) for (let y = minY; y < maxY; y++) {
      const tile = this.getTile(x, y)!; const terrain = TERRAINS[tile.type];
      const valid = mode === 'sea' ? terrain.isWater : mode === 'road'
        ? tile.type !== TerrainType.DEEP_OCEAN && tile.type !== TerrainType.MOUNTAIN && tile.type !== TerrainType.LAVA
        : !terrain.isWater && terrain.isWalkable;
      if (!valid) continue;
      passable++;
      totalCost += mode === 'sea' ? 1 : terrain.moveCost * (1 - tile.roadLevelEffective * .12);
    }
    const area = Math.max(1, (maxX - minX) * (maxY - minY));
    const cost = passable === 0 ? Infinity : totalCost / passable + (1 - passable / area) * 4;
    this.chunkTraversalCache.set(key, { version, cost });
    return cost;
  }

  public ignite(x: number, y: number): void {
    const tile = this.getTile(x, y);
    if (!tile) return;
    tile.isOnFire = true;
    tile.fireTimer = 0;
    this.activeFireTiles.add(tile.x * this.height + tile.y);
  }

  public rebuildDerivedIndexes(): void {
    this.activeFireTiles.clear();
    for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) {
      if (this.grid[x][y].isOnFire) this.activeFireTiles.add(x * this.height + y);
    }
    this.fluidDirty = true;
  }

  /** Exhaustive resource survey around a point, nearest/richest first. */
  public findResourceSites(
    centerX: number,
    centerY: number,
    radius: number,
    goods?: ReadonlySet<GoodId> | GoodId[],
    includeOccupied: boolean = false
  ): Tile[] {
    const filter = goods ? (goods instanceof Set ? goods : new Set(goods)) : null;
    const found: Tile[] = [];
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));
    const rSq = radius * radius;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy > rSq) continue;
        const tile = this.grid[x][y];
        if (!tile.resourceType || tile.resourceAmount <= 0) continue;
        if (filter && !filter.has(tile.resourceType)) continue;
        if (!includeOccupied && tile.buildingId) continue;
        found.push(tile);
      }
    }

    found.sort((a, b) => {
      const da = Math.hypot(a.x - centerX, a.y - centerY);
      const db = Math.hypot(b.x - centerX, b.y - centerY);
      return da - db || b.resourceAmount - a.resourceAmount;
    });
    return found;
  }

  /** Amount of each natural resource visible within a city's practical reach. */
  public resourceSummary(centerX: number, centerY: number, radius: number): Partial<Record<GoodId, number>> {
    const summary: Partial<Record<GoodId, number>> = {};
    for (const tile of this.findResourceSites(centerX, centerY, radius, undefined, true)) {
      if (!tile.resourceType) continue;
      summary[tile.resourceType] = (summary[tile.resourceType] ?? 0) + tile.resourceAmount;
    }
    return summary;
  }

  public isCoastalLand(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    if (!tile || TERRAINS[tile.type].isWater || !TERRAINS[tile.type].isWalkable) return false;
    return this.getNeighbors(x, y, true).some(n => TERRAINS[n.type].isWater);
  }

  /** Modify terrain within brush radius */
  public applyBrush(centerX: number, centerY: number, radius: number, action: (tile: Tile) => void): void {
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));

    const rSq = radius * radius;

    let terrainChanged = false;
    let roadChanged = false;
    let railChanged = false;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= rSq) {
          const t = this.grid[x][y];
          const oldType = t.type;
          const oldHeight = t.height;
          const oldRoad = `${t.roadLevel}:${t.roadDamage}`;
          const oldRail = `${t.railLevel}:${t.railDamage}:${t.railOwnerId}`;
          action(t);
          terrainChanged ||= t.type !== oldType || t.height !== oldHeight;
          roadChanged ||= `${t.roadLevel}:${t.roadDamage}` !== oldRoad;
          railChanged ||= `${t.railLevel}:${t.railDamage}:${t.railOwnerId}` !== oldRail;
          const fireKey = x * this.height + y;
          if (t.isOnFire) this.activeFireTiles.add(fireKey); else this.activeFireTiles.delete(fireKey);
          this.markRenderDirty(x, y);
        }
      }
    }
    if (terrainChanged) this.markTerrainChanged();
    if (roadChanged) this.markRoadNetworkChanged();
    if (railChanged) this.markRailNetworkChanged();
  }

  /** Tile-grid building lookup without walking every city's building map. */
  public findBuildingTilesNear(centerX: number, centerY: number, radius: number): Tile[] {
    const found: Tile[] = [];
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));
    const radiusSq = radius * radius;
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
      const tile = this.grid[x][y];
      const dx = x - centerX;
      const dy = y - centerY;
      if (tile.buildingId && dx * dx + dy * dy <= radiusSq) found.push(tile);
    }
    return found;
  }

  /** Fire & Fluid propagation logic tick with balanced burnouts and firebreaks */
  public updateFireTick(): number {
    if (this.activeFireTiles.size === 0) return 0;
    let activeFires = 0;
    const g = this.grid;
    const h = this.height;
    const fireQueue: Tile[] = [];
    const nextActive = this.fireScratch;
    nextActive.clear();

    for (const key of this.activeFireTiles) {
      const x = Math.floor(key / h);
      const y = key % h;
      const col = g[x];
      const tile = col?.[y];
      if (tile?.isOnFire) {
          activeFires++;
          tile.fireTimer++;
          if (tile.buildingId) this.recordBuildingDamage(tile, .095, 'fire');

          // Try spreading to orthogonal neighbors (4-dir, controlled rate).
          // Neighbour order mirrors getNeighbors(x, y, false): left, right, up, down.
          if (x > 0) {
            const n = g[x - 1][y];
            const config = TERRAINS[n.type];
            const moisturePenalty = 1 - Math.min(0.8, n.moisture * 0.5);
            if (!n.isOnFire && config.flammability > 0.05 && rng.chance(config.flammability * 0.035 * moisturePenalty)) {
              fireQueue.push(n);
            }
          }
          if (x < this.width - 1) {
            const n = g[x + 1][y];
            const config = TERRAINS[n.type];
            const moisturePenalty = 1 - Math.min(0.8, n.moisture * 0.5);
            if (!n.isOnFire && config.flammability > 0.05 && rng.chance(config.flammability * 0.035 * moisturePenalty)) {
              fireQueue.push(n);
            }
          }
          if (y > 0) {
            const n = col[y - 1];
            const config = TERRAINS[n.type];
            const moisturePenalty = 1 - Math.min(0.8, n.moisture * 0.5);
            if (!n.isOnFire && config.flammability > 0.05 && rng.chance(config.flammability * 0.035 * moisturePenalty)) {
              fireQueue.push(n);
            }
          }
          if (y < h - 1) {
            const n = col[y + 1];
            const config = TERRAINS[n.type];
            const moisturePenalty = 1 - Math.min(0.8, n.moisture * 0.5);
            if (!n.isOnFire && config.flammability > 0.05 && rng.chance(config.flammability * 0.035 * moisturePenalty)) {
              fireQueue.push(n);
            }
          }

          // Burn out tile after 10 ticks into non-flammable Soil (Firebreak)
          if (tile.fireTimer >= 10) {
            tile.isOnFire = false;
            tile.fireTimer = 0;

            // Flammable vegetation burns into Soil, acting as a natural firebreak
            if (
              tile.type === TerrainType.FOREST ||
              tile.type === TerrainType.GRASS ||
              tile.type === TerrainType.SAVANNA ||
              tile.type === TerrainType.SWAMP ||
              tile.type === TerrainType.CORRUPTED
            ) {
              tile.type = TerrainType.SOIL;
              tile.resourceType = null;
              tile.resourceAmount = 0;
              this.markTerrainChanged(x, y);
            }
          }
          if (tile.isOnFire) nextActive.add(key);
      }
    }

    for (const t of fireQueue) {
      t.isOnFire = true;
      t.fireTimer = 0;
      nextActive.add(t.x * h + t.y);
    }

    const previous = this.activeFireTiles;
    this.activeFireTiles = nextActive;
    this.fireScratch = previous;

    return activeFires;
  }

  /**
   * Renewable resources creep back toward their original abundance, wild food sprouts on fertile land,
   * and cleared forest reclaims grassland. Mineral and petroleum deposits remain finite.
   * Called once per simulated year.
   */
  public regrowResources(): void {
    // Deterministic sampling: saving/reloading no longer changes which ecology tiles tick.
    this.ecologyStep++;
    const rng = new RandomService((this.seed + this.ecologyStep * 104729) >>> 0);
    const sampleCount = Math.floor((this.width * this.height) / 5);

    for (let i = 0; i < sampleCount; i++) {
      const x = rng.rangeInt(0, this.width - 1);
      const y = rng.rangeInt(0, this.height - 1);
      const tile = this.grid[x][y];
      if (tile.isOnFire) continue;

      // Renewable natural goods recover. Minerals and petroleum are finite.
      if (isRenewableGood(tile.resourceType) && tile.resourceAmount < tile.resourceMax) {
        const good = tile.resourceType;
        const base = good === 'food' ? 3.5
          : good === 'wood' || good === 'rubber' ? 2.5
          : good === 'cotton' || good === 'spices' ? 2.0
          : 1.5;
        const moistureBonus = (good === 'food' || good === 'wood' || good === 'spices') ? tile.moisture * 2.5 : tile.moisture;
        tile.resourceAmount = Math.min(tile.resourceMax, tile.resourceAmount + base + moistureBonus);
        continue;
      }

      // Wild food can recolonise fertile unoccupied ground.
      const isFertileLand = tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL;
      if (isFertileLand && !tile.resourceType && !tile.buildingId && !tile.cityId && tile.moisture > 0.25) {
        if (rng.chance(0.065 * tile.moisture * (0.8 + tile.fertility))) {
          tile.resourceType = 'food';
          tile.resourceMax = 50 + rng.rangeInt(0, 60);
          tile.resourceAmount = Math.floor(tile.resourceMax * 0.6);
          continue;
        }
      }

      // Cleared land reforests slowly if nearby forest can seed it.
      const clearable = tile.type === TerrainType.GRASS || tile.type === TerrainType.SOIL;
      if (clearable && !tile.buildingId && !tile.cityId && tile.moisture > 0.4) {
        const neighbours = this.getNeighbors(x, y, true);
        const forestNeighbours = neighbours.filter(n => n.type === TerrainType.FOREST).length;
        const chance = forestNeighbours > 0
          ? 0.025 + forestNeighbours * 0.018
          : 0.003 * tile.moisture;

        if (rng.chance(chance)) {
          tile.type = TerrainType.FOREST;
          tile.resourceType = 'wood';
          tile.resourceMax = 65 + rng.rangeInt(0, 75);
          tile.resourceAmount = Math.floor(tile.resourceMax * 0.35);
          this.markTerrainChanged(x, y);
        }
      }
    }
  }

  /** Liquid flow propagation tick (water flows into low elevation tiles) */
  public updateFluidTick(): void {
    if (!this.fluidDirty) return;
    const g = this.grid;
    const w = this.width;
    const h = this.height;
    const convertQueue: Tile[] = [];

    for (let x = 0; x < w; x++) {
      const col = g[x];
      for (let y = 0; y < h; y++) {
        const type = col[y].type;
        if (type !== TerrainType.SHALLOW_WATER && type !== TerrainType.DEEP_OCEAN) continue;

        // Inline 4-directional neighbour checks: water spills onto any adjacent
        // low land tile. Matches the previous getNeighbors() semantics exactly.
        if (x > 0) {
          const n = g[x - 1][y];
          if (n.height < 0.25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN) convertQueue.push(n);
        }
        if (x < w - 1) {
          const n = g[x + 1][y];
          if (n.height < 0.25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN) convertQueue.push(n);
        }
        if (y > 0) {
          const n = col[y - 1];
          if (n.height < 0.25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN) convertQueue.push(n);
        }
        if (y < h - 1) {
          const n = col[y + 1];
          if (n.height < 0.25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN) convertQueue.push(n);
        }
      }
    }

    for (const tile of convertQueue) {
      tile.type = TerrainType.SHALLOW_WATER;
      this.markRenderDirty(tile.x, tile.y);
    }
    this.fluidDirty = convertQueue.length > 0;
    if (convertQueue.length > 0) this.terrainVersion++;
  }

  public serialize(): any {
    return {
      format: 'chunked-v1',
      width: this.width,
      height: this.height,
      seed: this.seed,
      ecologyStep: this.ecologyStep,
      chunkSize: this.chunkSize,
      chunks: this.chunkStore.serialize()
    };
  }

  public deserialize(data: any): void {
    this.width = data.width;
    this.height = data.height;
    this.seed = data.seed;
    this.ecologyStep = data.ecologyStep ?? 0;
    this.chunkStore = new ChunkedTileStore(this.width, this.height);
    this.grid = this.chunkStore.grid;
    if (data.format === 'chunked-v1' && Array.isArray(data.chunks)) {
      this.chunkStore.deserialize(data.chunks as SerializedWorldChunk[]);
    } else for (const item of data.tiles ?? []) {
      const tile = this.getTile(item.x, item.y)!;
      tile.type = item.t; tile.height = item.h; tile.temperature = item.temp; tile.moisture = item.m; tile.fertility = item.fertility ?? .5;
      tile.resourceType = item.r; tile.resourceAmount = item.ra; tile.resourceMax = item.rm ?? item.ra;
      tile.buildingId = item.b; tile.kingdomId = item.k; tile.cityId = item.c; tile.isOnFire = item.f; tile.fireTimer = item.ft ?? 0;
      tile.roadLevel = item.rl ?? 0; tile.roadTraffic = item.rt ?? 0; tile.roadDamage = item.rd ?? 0;
      tile.railLevel = item.rail ?? 0; tile.railDamage = item.raild ?? 0; tile.railOwnerId = item.railo ?? null; tile.bridgeName = item.bn ?? null;
    }
    this.regionCounts = this.chunkStore.updateRegionStates(this.width / 2, this.height / 2);
    this.dirtyTiles.clear();
    this.allTilesDirty = false;
    this.dirtyChunks.clear();
    this.terrainVersion++;
    this.roadNetworkVersion++;
    this.railNetworkVersion++;
    this.rebuildDerivedIndexes();
    this.markAllDirty();
  }
}
