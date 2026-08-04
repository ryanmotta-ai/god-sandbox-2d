import { Tile } from './Tile';
import { isRenewableGood } from './Deposits';
import { TerrainType, TERRAINS } from './Biomes';
import { WorldGenerator, GeneratorPreset } from './WorldGenerator';
import { events } from '../core/EventBus';
import { RandomService, rng } from '../core/Random';
import { GoodId } from '../civ/Goods';

export class TileMap {
  public width: number;
  public height: number;
  public grid: Tile[][];
  public seed: number;
  /** Saved deterministic ecology step so resource regrowth is reproducible across reloads. */
  private ecologyStep: number = 0;
  /** Tiles whose static terrain bake must be redrawn, keyed by x*height+y. */
  public dirtyTiles: Set<number> = new Set();

  constructor(width: number = 128, height: number = 128, preset: GeneratorPreset = 'single_continent', seed?: number) {
    this.width = width;
    this.height = height;
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    this.grid = WorldGenerator.generate(width, height, preset, this.seed);
    this.markAllDirty();
  }

  public getTile(x: number, y: number): Tile | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }
    return this.grid[Math.floor(x)][Math.floor(y)];
  }

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
  }

  /** Mark every tile dirty (used on world creation / load / resize). */
  public markAllDirty(): void {
    const h = this.height;
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < h; y++) this.dirtyTiles.add(x * h + y);
    }
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

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= rSq) {
          const t = this.grid[x][y];
          action(t);
          this.markRenderDirty(x, y);
        }
      }
    }
  }

  /** Fire & Fluid propagation logic tick with balanced burnouts and firebreaks */
  public updateFireTick(): number {
    let activeFires = 0;
    const g = this.grid;
    const w = this.width;
    const h = this.height;
    const fireQueue: Tile[] = [];

    for (let x = 0; x < w; x++) {
      const col = g[x];
      for (let y = 0; y < h; y++) {
        const tile = col[y];
        if (tile.isOnFire) {
          activeFires++;
          tile.fireTimer++;

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
          if (x < w - 1) {
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
              this.markRenderDirty(x, y);
            }
          }
        }
      }
    }

    for (const t of fireQueue) {
      t.isOnFire = true;
      t.fireTimer = 0;
    }

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
          this.markRenderDirty(x, y);
        }
      }
    }
  }

  /** Liquid flow propagation tick (water flows into low elevation tiles) */
  public updateFluidTick(): void {
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
  }

  public serialize(): any {
    const tilesData: any[] = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const t = this.grid[x][y];
        tilesData.push({
          x: t.x,
          y: t.y,
          t: t.type,
          h: t.height,
          temp: t.temperature,
          m: t.moisture,
          r: t.resourceType,
          ra: t.resourceAmount,
          rm: t.resourceMax,
          b: t.buildingId,
          k: t.kingdomId,
          c: t.cityId,
          f: t.isOnFire,
          rl: t.roadLevel,
          rt: t.roadTraffic,
          rd: t.roadDamage,
          rail: t.railLevel,
          raild: t.railDamage,
          railo: t.railOwnerId
        });
      }
    }
    return {
      width: this.width,
      height: this.height,
      seed: this.seed,
      ecologyStep: this.ecologyStep,
      tiles: tilesData
    };
  }

  public deserialize(data: any): void {
    this.width = data.width;
    this.height = data.height;
    this.seed = data.seed;
    this.ecologyStep = data.ecologyStep ?? 0;
    this.grid = [];
    for (let x = 0; x < this.width; x++) {
      this.grid[x] = [];
    }
    for (const item of data.tiles) {
      const tile = new Tile(item.x, item.y, item.t, item.h);
      tile.temperature = item.temp;
      tile.moisture = item.m;
      tile.resourceType = item.r;
      tile.resourceAmount = item.ra;
      tile.resourceMax = item.rm ?? item.ra;
      tile.buildingId = item.b;
      tile.kingdomId = item.k;
      tile.cityId = item.c;
      tile.isOnFire = item.f;
      tile.roadLevel = item.rl ?? 0;
      tile.roadTraffic = item.rt ?? 0;
      tile.roadDamage = item.rd ?? 0;
      // Old saves predate rail; they simply have no track.
      tile.railLevel = item.rail ?? 0;
      tile.railDamage = item.raild ?? 0;
      tile.railOwnerId = item.railo ?? null;
      this.grid[item.x][item.y] = tile;
    }
    this.dirtyTiles.clear();
    this.markAllDirty();
  }
}
