/**
 * Spatial Partitioning Grid for O(1) entity and region queries.
 */
export interface HasPosition {
  id: string;
  x: number;
  y: number;
}

export class SpatialHash<T extends HasPosition> {
  private cellSize: number;
  private grid: Map<number, T[]> = new Map();
  private itemCells: Map<string, number> = new Map();

  constructor(cellSize: number = 8) {
    this.cellSize = cellSize;
  }

  /** Pack cell coordinates into a single numeric key (no string allocation). */
  private getKey(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return cx * 100000 + cy;
  }

  public clear(): void {
    this.grid.clear();
    this.itemCells.clear();
  }

  public insert(item: T): void {
    const key = this.getKey(item.x, item.y);
    const previousKey = this.itemCells.get(item.id);
    if (previousKey === key) return;
    if (previousKey !== undefined) this.removeFromCell(item, previousKey);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(item);
    this.itemCells.set(item.id, key);
  }

  public remove(item: T): void {
    const key = this.itemCells.get(item.id);
    if (key === undefined) return;
    this.removeFromCell(item, key);
    this.itemCells.delete(item.id);
  }

  public update(item: T, _oldX?: number, _oldY?: number): void {
    const oldKey = this.itemCells.get(item.id);
    const newKey = this.getKey(item.x, item.y);
    if (oldKey !== newKey) {
      this.insert(item);
    }
  }

  private removeFromCell(item: T, key: number): void {
    const cell = this.grid.get(key);
    if (!cell) return;
    const idx = cell.indexOf(item);
    if (idx !== -1) {
      const last = cell.pop()!;
      if (idx < cell.length) cell[idx] = last;
    }
    if (cell.length === 0) this.grid.delete(key);
  }

  public rebuild(items: Iterable<T>): void {
    this.clear();
    for (const item of items) this.insert(item);
  }

  public get size(): number { return this.itemCells.size; }
  public has(id: string): boolean { return this.itemCells.has(id); }

  public validate(items: Iterable<T>): boolean {
    let count = 0;
    for (const item of items) {
      count++;
      if (!this.itemCells.has(item.id)) return false;
    }
    return count === this.itemCells.size;
  }

  public queryRadius(x: number, y: number, radius: number, result: T[] = []): T[] {
    result.length = 0;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = cx * 100000 + cy;
        const items = this.grid.get(key);
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const dx = item.x - x;
            const dy = item.y - y;
            if (dx * dx + dy * dy <= rSq) {
              result.push(item);
            }
          }
        }
      }
    }

    return result;
  }

  /** Zero-allocation search for the closest item matching an optional predicate. */
  public findClosest(x: number, y: number, radius: number, predicate?: (item: T) => boolean): T | null {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    let closest: T | null = null;
    let closestDistSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const items = this.grid.get(cx * 100000 + cy);
        if (!items) continue;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const dx = item.x - x;
          const dy = item.y - y;
          const dSq = dx * dx + dy * dy;
          if (dSq <= closestDistSq && (!predicate || predicate(item))) {
            closestDistSq = dSq;
            closest = item;
          }
        }
      }
    }

    return closest;
  }

  /** Zero-allocation check if any item matching an optional predicate exists within radius. */
  public someNear(x: number, y: number, radius: number, predicate?: (item: T) => boolean): boolean {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const items = this.grid.get(cx * 100000 + cy);
        if (!items) continue;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= rSq && (!predicate || predicate(item))) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /** Zero-allocation count of items matching an optional predicate within radius. */
  public countNear(x: number, y: number, radius: number, predicate?: (item: T) => boolean): number {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const rSq = radius * radius;
    let count = 0;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const items = this.grid.get(cx * 100000 + cy);
        if (!items) continue;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= rSq && (!predicate || predicate(item))) {
            count++;
          }
        }
      }
    }

    return count;
  }

  /** Zero-allocation visitor over items within radius. Return false from callback to break early. */
  public forEachNear(x: number, y: number, radius: number, callback: (item: T, distSq: number) => boolean | void): void {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const rSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const items = this.grid.get(cx * 100000 + cy);
        if (!items) continue;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const dx = item.x - x;
          const dy = item.y - y;
          const dSq = dx * dx + dy * dy;
          if (dSq <= rSq) {
            if (callback(item, dSq) === false) return;
          }
        }
      }
    }
  }

  /** Viewport/region query used by rendering and future regional simulation. */
  public queryRect(minX: number, minY: number, maxX: number, maxY: number, result: T[] = []): T[] {
    result.length = 0;
    const minCx = Math.floor(minX / this.cellSize);
    const maxCx = Math.floor(maxX / this.cellSize);
    const minCy = Math.floor(minY / this.cellSize);
    const maxCy = Math.floor(maxY / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const items = this.grid.get(cx * 100000 + cy);
        if (!items) continue;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY) result.push(item);
        }
      }
    }
    return result;
  }
}
