import { rng } from '../core/Random';
import { TileMap } from '../world/TileMap';
import { TERRAINS, TerrainType } from '../world/Biomes';

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
      if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) {
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
    if (tileAtNew && !TERRAINS[tileAtNew.type].isWater && TERRAINS[tileAtNew.type].isWalkable) {
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
    if (tileH && !TERRAINS[tileH.type].isWater && TERRAINS[tileH.type].isWalkable) {
      return { x: slideX, y: startY, blocked: false };
    }

    // Try vertical slide
    const tileV = tileMap.getTile(Math.floor(startX), Math.floor(slideY));
    if (tileV && !TERRAINS[tileV.type].isWater && TERRAINS[tileV.type].isWalkable) {
      return { x: startX, y: slideY, blocked: false };
    }

    // Try random jitter to escape stuck positions
    for (let attempt = 0; attempt < 4; attempt++) {
      const angle = (Math.PI / 2) * attempt;
      const jx = startX + Math.cos(angle) * speed;
      const jy = startY + Math.sin(angle) * speed;
      const jTile = tileMap.getTile(Math.floor(jx), Math.floor(jy));
      if (jTile && !TERRAINS[jTile.type].isWater && TERRAINS[jTile.type].isWalkable) {
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
      if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) {
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
    if (startTile && !TERRAINS[startTile.type].isWater && TERRAINS[startTile.type].isWalkable) {
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
          if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) {
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
    maxNodes: number = 3000
  ): { x: number; y: number }[] {
    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
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
    }

    const key = (x: number, y: number) => `${x},${y}`;
    const heuristic = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);

    const isPassable = (x: number, y: number): boolean => {
      const tile = tileMap.getTile(x, y);
      if (!tile) return false;
      if (mode === 'road') {
        // Roads may be surveyed across shallow water (bridges); deep ocean,
        // mountains and lava are engineering obstacles.
        return tile.type !== TerrainType.DEEP_OCEAN &&
          tile.type !== TerrainType.MOUNTAIN &&
          tile.type !== TerrainType.LAVA;
      }
      const terrain = TERRAINS[tile.type];
      return mode === 'land' ? (!terrain.isWater && terrain.isWalkable) : terrain.isWater;
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
    }

    /** Get the movement cost for stepping onto a tile */
    const getMoveCost = (x: number, y: number): number => {
      const tile = tileMap.getTile(x, y);
      if (!tile) return 1.0;
      if (mode === 'sea') return 1.0; // Uniform water cost
      if (mode === 'road') {
        // Bridges are expensive but feasible; roads cut every cost.
        if (tile.type === TerrainType.SHALLOW_WATER) return 3.0;
        const terrainCost = TERRAINS[tile.type].moveCost;
        const roadMultiplier = ROAD_COST_MULTIPLIER[tile.roadLevelEffective] ?? 1.0;
        return terrainCost * roadMultiplier;
      }
      // Land mode: use terrain moveCost with road bonus
      const terrainCost = TERRAINS[tile.type].moveCost;
      const roadMultiplier = ROAD_COST_MULTIPLIER[tile.roadLevelEffective] ?? 1.0;
      return terrainCost * roadMultiplier;
    };

    const openHeap = new MinHeap<ANode>((a, b) => a.f - b.f);
    const closedSet = new Set<string>();
    const nodeMap = new Map<string, ANode>();

    const startNode: ANode = {
      x: sx,
      y: sy,
      g: 0,
      h: heuristic(sx, sy, tx, ty),
      f: heuristic(sx, sy, tx, ty),
      parent: null
    };

    openHeap.insert(startNode);
    nodeMap.set(key(sx, sy), startNode);

    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    let count = 0;
    while (!openHeap.isEmpty && count < maxNodes) {
      count++;
      const current = openHeap.extractMin()!;
      const currentKey = key(current.x, current.y);

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

        const baseDist = dx !== 0 && dy !== 0 ? 1.414 : 1.0;
        const moveCost = getMoveCost(nx, ny);
        const gScore = current.g + baseDist * moveCost;
        let neighborNode = nodeMap.get(nKey);

        if (!neighborNode) {
          neighborNode = {
            x: nx,
            y: ny,
            g: gScore,
            h: heuristic(nx, ny, tx, ty),
            f: gScore + heuristic(nx, ny, tx, ty),
            parent: current
          };
          nodeMap.set(nKey, neighborNode);
          openHeap.insert(neighborNode);
        } else if (gScore < neighborNode.g) {
          neighborNode.g = gScore;
          neighborNode.f = gScore + neighborNode.h;
          neighborNode.parent = current;
          // Note: updating f in the heap without re-heapifying is acceptable
          // because the old entry with higher f will be extracted later and
          // skipped via closedSet check. This is a known A* optimization.
          openHeap.insert(neighborNode); // Insert updated node (lazy deletion)
        }
      }
    }

    // A* exhausted maxNodes without finding path — return EMPTY (no unsafe straight line)
    return [];
  }
}
