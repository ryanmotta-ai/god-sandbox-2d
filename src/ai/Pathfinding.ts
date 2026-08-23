import { rng, hashToUnit } from '../core/Random';
import { TileMap } from '../world/TileMap';
import { TERRAINS, TerrainType } from '../world/Biomes';
import { crossingSpan, gradePenalty, groundworkFactor, roadGrade } from '../world/RoadTerrain';
import { perfProfiler } from '../perf/PerformanceProfiler';
import { isFortificationBarrierId } from '../civ/FortificationPlanner';

/**
 * Binary Min-Heap priority queue for A* pathfinding.
 * O(log n) insert and extractMin instead of O(n log n) sorted array.
 */
class MinHeap<T> {
  private heap: T[] = [];
  private compareFn: (a: T, b: T) => number;

  constructor(compareFn: (a: T, b: T) => number) {
    this.compareFn = compareFn;
  }

  get size(): number { return this.heap.length; }
  get isEmpty(): boolean { return this.heap.length === 0; }

  public insert(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  public extractMin(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return min;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.compareFn(this.heap[idx], this.heap[parent]) < 0) {
        [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
        idx = parent;
      } else break;
    }
  }

  private sinkDown(idx: number): void {
    const len = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < len && this.compareFn(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < len && this.compareFn(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

/** Road-level moveCost multipliers — makes A* prefer existing roads */
const ROAD_COST_MULTIPLIER: Record<number, number> = {
  0: 1.0,
  1: 0.8,
  2: 0.6,
  3: 0.4
};

/**
 * What an existing road is worth to a survey, as opposed to a traveller.
 *
 * ROAD_COST_MULTIPLIER above prices how fast somebody moves along a road, and a
 * fifth off for a dirt track is right for that. It is badly wrong for laying a
 * new one: a stretch that is already built costs nothing to build again, so a
 * survey should be pulled onto it almost regardless of the detour. Sharing that
 * one table meant a new trade road saw only a fifth off for following the last
 * one and carved its own line instead, a few tiles to the side, over and over.
 * The map filled with parallel tracks that ran together for twenty tiles and
 * never touched, which is both the ugliness and the reason the network came out
 * in ten disconnected pieces. A road network is supposed to converge on trunks
 * and branch off them.
 */
const SURVEY_ROAD_MULTIPLIER: Record<number, number> = {
  0: 1.0,
  1: 0.22,
  2: 0.15,
  3: 0.10
};

/**
 * What one tile of water costs a road survey before the span is measured.
 * Set against a typical land tile of ~1–3, a single-tile ford is worth a
 * detour of about ten tiles and a five-tile crossing is worth nearly sixty —
 * so a surveyed road walks the bank looking for the narrows, and only gives up
 * and bridges when the detour would cost more than the piers.
 */
const WATER_CROSSING_BASE = 11;
const WATER_CROSSING_PER_SPAN = 8;

/**
 * How hard a traveller avoids climbing. Gentler than the surveyor's curve — a
 * caravan will take a slope a road never would — but enough that the trails
 * worn by wheels follow valley floors instead of going over every shoulder.
 */
const TRAVEL_GRADE_DIVISOR = 22;

/**
 * What a change of direction costs, as a fraction of the step it is part of.
 *
 * Without this, two routes of equal terrain cost are equally good, and A*
 * picks between them on heap order — so a road across flat ground, or one
 * looking for a crossing on a river of uniform width, comes out as a drunken
 * staircase. A surveyor does not change direction without a reason, and a
 * sharp bend genuinely costs more to build and slows what travels it, so the
 * penalty scales with how hard the turn is: nothing for straight on, a little
 * for a 45-degree bend, more for a right angle.
 *
 * It is deliberately small against terrain costs of 1 to 3, so it only ever
 * decides ties. It must never talk a road into climbing a hill to stay
 * straight.
 */
const TURN_PENALTY = 0.16;

/**
 * Road-level movement speed multiplier shared by every mover on the map —
 * citizens, fauna and caravans all travel faster on better roads.
 */
export const ROAD_SPEED_BONUS: Record<number, number> = {
  0: 1.0,
  1: 1.2,
  2: 1.45,
  3: 1.8
};

export class SimplePathfinder {
  private static readonly PATH_CACHE_LIMIT = 256;
  private static readonly pathCache = new Map<string, { path: { x: number; y: number }[]; version: string }>();
  private static readonly mapIds = new WeakMap<TileMap, number>();
  private static nextMapId = 1;
  private static cacheEnabled = true;
  private static cacheHits = 0;
  private static cacheMisses = 0;

  /** Benchmark/debug switch. Production keeps the bounded cache enabled. */
  public static configureCache(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) this.pathCache.clear();
  }

  public static clearPathCache(): void {
    this.pathCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  public static cacheStats(): { size: number; limit: number; hits: number; misses: number } {
    return { size: this.pathCache.size, limit: this.PATH_CACHE_LIMIT, hits: this.cacheHits, misses: this.cacheMisses };
  }

  /**
   * When stuck, try 8 lateral directions to escape congestion rather than
   * immediately aborting the current task. Returns null if completely boxed in.
   */
  public static jitterAround(
    x: number, y: number, tileMap: TileMap, speed: number
  ): { x: number; y: number } | null {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    const step = speed * 0.8;
    for (const [dx, dy] of dirs) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      const tile = tileMap.getTile(Math.floor(nx), Math.floor(ny));
      if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable && !isFortificationBarrierId(tile.buildingId)) {
        return { x: nx, y: ny };
      }
    }
    return null;
  }

  /**
   * Smooth sub-pixel movement toward target with arrival easing & road speed multipliers.
   * Returns fractional position allowing smooth walking animation.
   * Speed parameter controls how many pixels per tick the entity moves.
   */
  public static getStepTowards(
    startX: number, startY: number,
    targetX: number, targetY: number,
    tileMap: TileMap,
    speed: number = 0.15
  ): { x: number; y: number; blocked?: boolean } {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.05) return { x: targetX, y: targetY, blocked: false };

    // Check current tile for road speed bonus
    const currentTile = tileMap.getTile(Math.floor(startX), Math.floor(startY));
    const roadBonus = ROAD_SPEED_BONUS[currentTile?.roadLevelEffective ?? 0] ?? 1.0;

    // Arrival deceleration easing curve: smooth stop when approaching destination
    const arrivalEase = Math.min(1.0, dist / 0.6);
    const effectiveSpeed = Math.min(speed * roadBonus * arrivalEase, dist);

    // Normalize direction and apply speed
    const moveX = (dx / dist) * effectiveSpeed;
    const moveY = (dy / dist) * effectiveSpeed;

    const newX = startX + moveX;
    const newY = startY + moveY;

    // Check walkability of target tile (MUST NOT BE WATER & MUST BE WALKABLE)
    const tileAtNew = tileMap.getTile(Math.floor(newX), Math.floor(newY));
    if (tileAtNew && !TERRAINS[tileAtNew.type].isWater && TERRAINS[tileAtNew.type].isWalkable && !isFortificationBarrierId(tileAtNew.buildingId)) {
      const moveCost = TERRAINS[tileAtNew.type].moveCost;
      const costFactor = 1 / Math.max(0.5, moveCost);
      return {
        x: startX + moveX * costFactor,
        y: startY + moveY * costFactor,
        blocked: false
      };
    }

    // Obstacle avoidance: try sliding along one axis smoothly
    const slideX = startX + moveX * 0.7;
    const slideY = startY + moveY * 0.7;

    // Try horizontal slide
    const tileH = tileMap.getTile(Math.floor(slideX), Math.floor(startY));
    if (tileH && !TERRAINS[tileH.type].isWater && TERRAINS[tileH.type].isWalkable && !isFortificationBarrierId(tileH.buildingId)) {
      return { x: slideX, y: startY, blocked: false };
    }

    // Try vertical slide
    const tileV = tileMap.getTile(Math.floor(startX), Math.floor(slideY));
    if (tileV && !TERRAINS[tileV.type].isWater && TERRAINS[tileV.type].isWalkable && !isFortificationBarrierId(tileV.buildingId)) {
      return { x: startX, y: slideY, blocked: false };
    }

    // Try random jitter to escape stuck positions
    for (let attempt = 0; attempt < 4; attempt++) {
      const angle = (Math.PI / 2) * attempt;
      const jx = startX + Math.cos(angle) * speed;
      const jy = startY + Math.sin(angle) * speed;
      const jTile = tileMap.getTile(Math.floor(jx), Math.floor(jy));
      if (jTile && !TERRAINS[jTile.type].isWater && TERRAINS[jTile.type].isWalkable && !isFortificationBarrierId(jTile.buildingId)) {
        return { x: jx, y: jy, blocked: false };
      }
    }

    // Completely blocked by water/obstacle
    return { x: startX, y: startY, blocked: true };
  }

  /**
   * Find a random walkable land position near a center point.
   * Used for patrol targets, wander destinations, etc.
   */
  public static findRandomWalkable(
    centerX: number, centerY: number,
    radius: number,
    tileMap: TileMap
  ): { x: number; y: number } | null {
    for (let attempts = 0; attempts < 15; attempts++) {
      const angle = rng.next() * Math.PI * 2;
      const dist = rng.next() * radius;
      const tx = Math.floor(centerX + Math.cos(angle) * dist);
      const ty = Math.floor(centerY + Math.sin(angle) * dist);
      const tile = tileMap.getTile(tx, ty);
      if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable && !isFortificationBarrierId(tile.buildingId)) {
        return { x: tx + 0.5, y: ty + 0.5 };
      }
    }
    return null;
  }

  /**
   * Find the nearest valid dry land tile from a given coordinate.
   * Applies safety padding so units near water edges are pulled inward.
   * Returns null if no land is found within search radius.
   */
  public static findNearestLand(
    x: number, y: number,
    tileMap: TileMap,
    maxSearchRadius: number = 30
  ): { x: number; y: number } | null {
    const startTx = Math.floor(x);
    const startTy = Math.floor(y);
    const startTile = tileMap.getTile(startTx, startTy);
    if (startTile && !TERRAINS[startTile.type].isWater && TERRAINS[startTile.type].isWalkable && !isFortificationBarrierId(startTile.buildingId)) {
      let safeX = x;
      let safeY = y;
      const fracX = x - startTx;
      const fracY = y - startTy;

      if (fracX < 0.25) {
        const leftTile = tileMap.getTile(startTx - 1, startTy);
        if (leftTile && TERRAINS[leftTile.type].isWater) safeX = startTx + 0.35;
      } else if (fracX > 0.75) {
        const rightTile = tileMap.getTile(startTx + 1, startTy);
        if (rightTile && TERRAINS[rightTile.type].isWater) safeX = startTx + 0.65;
      }
      if (fracY < 0.25) {
        const topTile = tileMap.getTile(startTx, startTy - 1);
        if (topTile && TERRAINS[topTile.type].isWater) safeY = startTy + 0.35;
      } else if (fracY > 0.75) {
        const bottomTile = tileMap.getTile(startTx, startTy + 1);
        if (bottomTile && TERRAINS[bottomTile.type].isWater) safeY = startTy + 0.65;
      }
      return { x: safeX, y: safeY };
    }

    for (let r = 1; r <= maxSearchRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = startTx + dx;
          const ty = startTy + dy;
          const tile = tileMap.getTile(tx, ty);
          if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable && !isFortificationBarrierId(tile.buildingId)) {
            return { x: tx + 0.5, y: ty + 0.5 };
          }
        }
      }
    }
    return null; // No land found within search radius
  }

  /**
   * Calculate distance between two points.
   */
  public static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Find the direction away from a threat (for fleeing).
   */
  public static fleeFrom(
    myX: number, myY: number,
    threatX: number, threatY: number,
    tileMap: TileMap,
    speed: number = 0.2
  ): { x: number; y: number } {
    const dx = myX - threatX;
    const dy = myY - threatY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.01) {
      return this.getStepTowards(myX, myY, myX + rng.range(-2.5, 2.5), myY + rng.range(-2.5, 2.5), tileMap, speed);
    }
    const fleeX = myX + (dx / dist) * 8;
    const fleeY = myY + (dy / dist) * 8;
    return this.getStepTowards(myX, myY, fleeX, fleeY, tileMap, speed);
  }

  /**
   * A* Pathfinding for Land Caravans and Sea Ships.
   * Uses a binary min-heap for O(log n) priority queue operations.
   * Incorporates terrain moveCost and road bonus for intelligent routing.
   *
   * mode = 'land': navigates land tiles, avoiding water. Prefers roads.
   * mode = 'sea': navigates water tiles, avoiding land.
   *
   * Returns empty array [] if no path exists (instead of unsafe straight line).
   */
  public static findPath(
    startX: number, startY: number,
    targetX: number, targetY: number,
    tileMap: TileMap,
    mode: 'land' | 'sea' | 'road',
    maxNodes: number = 3000,
    agentSeed: number = 0
  ): { x: number; y: number }[] {
    let mapId = this.mapIds.get(tileMap);
    if (mapId === undefined) {
      mapId = this.nextMapId++;
      this.mapIds.set(tileMap, mapId);
    }
    const cacheKey = `${mapId}:${mode}:${Math.floor(startX)},${Math.floor(startY)}:${Math.floor(targetX)},${Math.floor(targetY)}:${maxNodes}:${agentSeed}`;
    const started = performance.now();

    if (this.cacheEnabled) {
      const cached = this.pathCache.get(cacheKey);
      if (cached !== undefined && tileMap.pathVersionFor(cached.path, mode) === cached.version) {
        this.pathCache.delete(cacheKey);
        this.pathCache.set(cacheKey, cached);
        this.cacheHits++;
        perfProfiler.increment('pathCalls');
        perfProfiler.increment('pathCacheHits');
        perfProfiler.record('pathfinding', performance.now() - started);
        return cached.path.map(point => ({ ...point }));
      }
      if (cached !== undefined) this.pathCache.delete(cacheKey);
    }

    this.cacheMisses++;
    const distance = Math.hypot(targetX - startX, targetY - startY);
    const path = distance > tileMap.chunkSize * 2
      ? this.findHierarchicalPath(startX, startY, targetX, targetY, tileMap, mode, maxNodes, agentSeed)
      : this.findPathUncached(startX, startY, targetX, targetY, tileMap, mode, maxNodes, agentSeed);
    if (this.cacheEnabled) {
      const stored = path.map(point => ({ ...point }));
      this.pathCache.set(cacheKey, { path: stored, version: tileMap.pathVersionFor(stored, mode) });
      while (this.pathCache.size > this.PATH_CACHE_LIMIT) {
        const oldest = this.pathCache.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        this.pathCache.delete(oldest);
      }
    }
    perfProfiler.increment('pathCalls');
    perfProfiler.increment('pathCacheMisses');
    perfProfiler.record('pathfinding', performance.now() - started);
    return path;
  }

  /** Chunk-level A* followed by bounded local A* legs through seam portals. */
  private static findHierarchicalPath(
    startX: number, startY: number, targetX: number, targetY: number,
    tileMap: TileMap, mode: 'land' | 'sea' | 'road', maxNodes: number, agentSeed: number
  ): { x: number; y: number }[] {
    interface MacroNode { cx: number; cy: number; g: number; f: number; parent: MacroNode | null; }
    const sx = Math.floor(startX / tileMap.chunkSize), sy = Math.floor(startY / tileMap.chunkSize);
    const tx = Math.floor(targetX / tileMap.chunkSize), ty = Math.floor(targetY / tileMap.chunkSize);
    if (sx === tx && sy === ty) return this.findPathUncached(startX, startY, targetX, targetY, tileMap, mode, maxNodes, agentSeed);
    const key = (cx: number, cy: number) => cx * tileMap.chunkStore.chunksY + cy;
    const open = new MinHeap<MacroNode>((a, b) => a.f - b.f);
    const best = new Map<number, number>();
    open.insert({ cx: sx, cy: sy, g: 0, f: Math.abs(tx - sx) + Math.abs(ty - sy), parent: null }); best.set(key(sx, sy), 0);
    let goal: MacroNode | null = null;
    while (!open.isEmpty) {
      const current = open.extractMin()!; const currentKey = key(current.cx, current.cy);
      if (current.g > (best.get(currentKey) ?? Infinity)) continue;
      if (current.cx === tx && current.cy === ty) { goal = current; break; }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const cx = current.cx + dx, cy = current.cy + dy;
        const cost = tileMap.chunkTraversalCost(cx, cy, mode); if (!Number.isFinite(cost)) continue;
        const nextG = current.g + cost; const nextKey = key(cx, cy);
        if (nextG >= (best.get(nextKey) ?? Infinity)) continue;
        best.set(nextKey, nextG);
        open.insert({ cx, cy, g: nextG, f: nextG + Math.abs(tx - cx) + Math.abs(ty - cy), parent: current });
      }
    }
    if (!goal) return [];
    const macro: Array<{ cx: number; cy: number }> = [];
    for (let node: MacroNode | null = goal; node; node = node.parent) macro.unshift({ cx: node.cx, cy: node.cy });
    const passable = (x: number, y: number): boolean => {
      const tile = tileMap.getTile(x, y); if (!tile) return false; const terrain = TERRAINS[tile.type];
      return mode === 'sea' ? terrain.isWater : mode === 'road'
        ? tile.type !== TerrainType.DEEP_OCEAN && tile.type !== TerrainType.MOUNTAIN && tile.type !== TerrainType.LAVA && !isFortificationBarrierId(tile.buildingId)
        : !terrain.isWater && terrain.isWalkable && !isFortificationBarrierId(tile.buildingId);
    };
    /**
     * Where the straight line from start to target crosses a given coordinate.
     * The seam is taken as near that point as the ground allows, rather than at
     * whichever tile a scan happened to reach first: scanning from the top of
     * the seam and taking the first opening dragged every long route to the
     * edge of each chunk it crossed and back again, which is where the zigzag
     * in long roads came from. Chunks are 32 tiles, so a route only has to run
     * past 64 to start collecting those detours.
     */
    const crossingAt = (along: number, fromA: number, toA: number, fromB: number, toB: number): number => {
      const span = toA - fromA;
      if (Math.abs(span) < 1e-6) return (fromB + toB) / 2;
      const t = Math.max(0, Math.min(1, (along - fromA) / span));
      return fromB + t * (toB - fromB);
    };

    const portals: Array<{ x: number; y: number }> = [];
    for (let i = 1; i < macro.length; i++) {
      const from = macro[i - 1], to = macro[i]; let portal: { x: number; y: number } | null = null;
      if (to.cx !== from.cx) {
        const x = to.cx > from.cx ? to.cx * tileMap.chunkSize : from.cx * tileMap.chunkSize;
        const minY = Math.max(from.cy, to.cy) * tileMap.chunkSize, maxY = Math.min(tileMap.height, minY + tileMap.chunkSize);
        const idealY = crossingAt(x, startX, targetX, startY, targetY);
        let bestGap = Infinity;
        for (let y = minY; y < maxY; y++) {
          if (!passable(x - 1, y) || !passable(x, y)) continue;
          const gap = Math.abs(y + .5 - idealY);
          if (gap >= bestGap) continue;
          bestGap = gap; portal = { x: x + (to.cx > from.cx ? .25 : -.25), y: y + .5 };
        }
      } else {
        const y = to.cy > from.cy ? to.cy * tileMap.chunkSize : from.cy * tileMap.chunkSize;
        const minX = Math.max(from.cx, to.cx) * tileMap.chunkSize, maxX = Math.min(tileMap.width, minX + tileMap.chunkSize);
        const idealX = crossingAt(y, startY, targetY, startX, targetX);
        let bestGap = Infinity;
        for (let x = minX; x < maxX; x++) {
          if (!passable(x, y - 1) || !passable(x, y)) continue;
          const gap = Math.abs(x + .5 - idealX);
          if (gap >= bestGap) continue;
          bestGap = gap; portal = { x: x + .5, y: y + (to.cy > from.cy ? .25 : -.25) };
        }
      }
      if (!portal) return [];
      portals.push(portal);
    }
    const waypoints = [...portals, { x: targetX, y: targetY }];
    const result: Array<{ x: number; y: number }> = []; let fromX = startX, fromY = startY;
    const localBudget = Math.max(4096, Math.min(maxNodes, tileMap.chunkSize * tileMap.chunkSize * 6));
    for (const waypoint of waypoints) {
      const leg = this.findPathUncached(fromX, fromY, waypoint.x, waypoint.y, tileMap, mode, localBudget, agentSeed);
      if (leg.length === 0) return [];
      if (result.length) leg.shift(); result.push(...leg); fromX = waypoint.x; fromY = waypoint.y;
    }
    return result;
  }

  private static findPathUncached(
    startX: number, startY: number,
    targetX: number, targetY: number,
    tileMap: TileMap,
    mode: 'land' | 'sea' | 'road',
    maxNodes: number = 3000,
    /**
     * Stable per-traveller seed (e.g. a hashed route id). Nudges the cost of
     * each tile by up to 15%, deterministically, so two routes of otherwise
     * identical cost — parallel roads, either bank of a river — don't all
     * converge on the exact same tiles every time. 0 (the default) reproduces
     * the old, unjittered behaviour exactly, so callers with no traveller
     * identity (road surveys, economic what-ifs) are unaffected.
     */
    agentSeed: number = 0
  ): { x: number; y: number }[] {
    let sx = Math.floor(startX);
    let sy = Math.floor(startY);
    let tx = Math.floor(targetX);
    let ty = Math.floor(targetY);

    if (sx === tx && sy === ty) return [{ x: targetX, y: targetY }];

    interface ANode {
      x: number;
      y: number;
      g: number;
      h: number;
      f: number;
      parent: ANode | null;
      /** Unit step that arrived here, so a change of direction can be priced. */
      dx: number;
      dy: number;
    }

    const key = (x: number, y: number) => x * tileMap.height + y;
    const heuristic = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);

    const isPassable = (x: number, y: number): boolean => {
      const tile = tileMap.getTile(x, y);
      if (!tile) return false;
      if (mode === 'road') {
        // Roads may be surveyed across shallow water (bridges); deep ocean,
        // mountains and lava are engineering obstacles.
        return tile.type !== TerrainType.DEEP_OCEAN &&
          tile.type !== TerrainType.MOUNTAIN &&
          tile.type !== TerrainType.LAVA &&
          !isFortificationBarrierId(tile.buildingId);
      }
      const terrain = TERRAINS[tile.type];
      return mode === 'land' ? (!terrain.isWater && terrain.isWalkable && !isFortificationBarrierId(tile.buildingId)) : terrain.isWater;
    };

    // If destination is impassable, snap to nearest passable tile
    if (!isPassable(tx, ty)) {
      let found = false;
      for (let r = 1; r <= 10 && !found; r++) {
        for (let ddx = -r; ddx <= r && !found; ddx++) {
          for (let ddy = -r; ddy <= r && !found; ddy++) {
            if (Math.abs(ddx) !== r && Math.abs(ddy) !== r) continue;
            if (isPassable(tx + ddx, ty + ddy)) {
              tx = tx + ddx;
              ty = ty + ddy;
              found = true;
            }
          }
        }
      }
      if (!found) return []; // No passable destination nearby
    }

    // Also validate start is passable
    if (!isPassable(sx, sy)) {
      let found = false;
      let nsx = sx, nsy = sy;
      for (let r = 1; r <= 10 && !found; r++) {
        for (let ddx = -r; ddx <= r && !found; ddx++) {
          for (let ddy = -r; ddy <= r && !found; ddy++) {
            if (Math.abs(ddx) !== r && Math.abs(ddy) !== r) continue;
            if (isPassable(sx + ddx, sy + ddy)) {
              nsx = sx + ddx;
              nsy = sy + ddy;
              found = true;
            }
          }
        }
      }
      if (!found) return []; // No passable start nearby
      sx = nsx;
      sy = nsy;
    }

    /**
     * Cost of stepping onto a tile *from a specific neighbour*. The step, not
     * the tile, is what carries the gradient — which is the whole reason roads
     * contour around hills instead of climbing them.
     */
    const getMoveCost = (x: number, y: number, fromX: number, fromY: number): number => {
      const tile = tileMap.getTile(x, y);
      if (!tile) return 1.0;
      if (mode === 'sea') return 1.0; // Uniform water cost
      const from = tileMap.getTile(fromX, fromY);
      const run = x !== fromX && y !== fromY ? 1.414 : 1;
      const roadMultiplier = ROAD_COST_MULTIPLIER[tile.roadLevelEffective] ?? 1.0;

      if (mode === 'road') {
        if (tile.type === TerrainType.SHALLOW_WATER) {
          // Priced by the width of the crossing this tile sits in, so the
          // survey is drawn toward fords and narrows rather than the nearest
          // point of the bank.
          const span = crossingSpan(tileMap, x, y, x - fromX, y - fromY);
          return WATER_CROSSING_BASE + WATER_CROSSING_PER_SPAN * span;
        }
        const relief = from ? gradePenalty(roadGrade(from, tile, run)) : 1;
        const surveyMultiplier = SURVEY_ROAD_MULTIPLIER[tile.roadLevelEffective] ?? 1.0;
        return TERRAINS[tile.type].moveCost * surveyMultiplier * relief * groundworkFactor(tile.type);
      }
      // Land mode: terrain, roads, and a traveller's reluctance to climb.
      const climb = from ? 1 + roadGrade(from, tile, run) / TRAVEL_GRADE_DIVISOR : 1;
      return TERRAINS[tile.type].moveCost * roadMultiplier * climb;
    };

    const openHeap = new MinHeap<ANode>((a, b) => a.f - b.f);
    const closedSet = new Set<number>();
    /**
     * Best cost known to reach each tile. This used to be a map of node
     * objects that were mutated in place and re-inserted when a cheaper route
     * turned up — but mutating an entry already inside the heap changes its
     * key without re-heapifying, which breaks the heap invariant, and a heap
     * that no longer returns its minimum is not A* any more. It surfaced as
     * routes that wandered twenty tiles off a straight line across flat
     * ground. Entries are now immutable once queued: a better route inserts a
     * fresh one, and the stale entry is skipped when it pops.
     */
    const bestCost = new Map<number, number>();

    const startNode: ANode = {
      x: sx,
      y: sy,
      g: 0,
      h: heuristic(sx, sy, tx, ty),
      f: heuristic(sx, sy, tx, ty),
      parent: null,
      dx: 0,
      dy: 0
    };

    openHeap.insert(startNode);
    bestCost.set(key(sx, sy), 0);

    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    let count = 0;
    while (!openHeap.isEmpty && count < maxNodes) {
      count++;
      const current = openHeap.extractMin()!;
      const currentKey = key(current.x, current.y);
      // A stale entry: a cheaper route to this tile was queued after it.
      if (current.g > (bestCost.get(currentKey) ?? Infinity)) continue;

      if (current.x === tx && current.y === ty) {
        const path: { x: number; y: number }[] = [];
        let curr: ANode | null = current;
        while (curr) {
          path.unshift({ x: curr.x + 0.5, y: curr.y + 0.5 });
          curr = curr.parent;
        }
        return path;
      }

      closedSet.add(currentKey);

      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nKey = key(nx, ny);

        if (closedSet.has(nKey)) continue;
        if (!isPassable(nx, ny)) continue; // Strict passability — no destination bypass

        if (mode !== 'sea' && dx !== 0 && dy !== 0) {
          // A diagonal step must not squeeze through the seam between curtain
          // pieces. Gates are deliberately not barriers and stay traversable.
          const sideA = tileMap.getTile(current.x + dx, current.y);
          const sideB = tileMap.getTile(current.x, current.y + dy);
          if (isFortificationBarrierId(sideA?.buildingId ?? null) || isFortificationBarrierId(sideB?.buildingId ?? null)) continue;
        }

        const baseDist = dx !== 0 && dy !== 0 ? 1.414 : 1.0;
        const moveCost = getMoveCost(nx, ny, current.x, current.y);
        // How far this step turns off the one that arrived: 0 straight on,
        // rising to 1 at a right angle and beyond it for a reversal.
        const turn = current.dx === 0 && current.dy === 0
          ? 0
          : 1 - (current.dx * dx + current.dy * dy) / (Math.hypot(current.dx, current.dy) * baseDist);
        // Personal variance: a traveller with a seed leans away from tiles
        // other travellers with different seeds would prefer, so routes of
        // equal real cost still diversify instead of all locking onto the
        // one path A* happened to visit first.
        const personality = agentSeed !== 0 ? 1 + hashToUnit(agentSeed, nx, ny) * 0.15 : 1;
        const gScore = current.g + baseDist * moveCost * (1 + TURN_PENALTY * turn) * personality;
        const known = bestCost.get(nKey);
        if (known !== undefined && gScore >= known) continue;
        bestCost.set(nKey, gScore);
        const h = heuristic(nx, ny, tx, ty);
        openHeap.insert({ x: nx, y: ny, g: gScore, h, f: gScore + h, parent: current, dx, dy });
      }
    }

    // A* exhausted maxNodes without finding path — return EMPTY (no unsafe straight line)
    return [];
  }
}
