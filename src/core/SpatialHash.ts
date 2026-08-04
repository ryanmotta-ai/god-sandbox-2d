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
  private grid: Map<number, Set<T>> = new Map();

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
  }

  public insert(item: T): void {
    const key = this.getKey(item.x, item.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key)!.add(item);
  }

  public remove(item: T): void {
    const key = this.getKey(item.x, item.y);
    if (this.grid.has(key)) {
      this.grid.get(key)!.delete(item);
    }
  }

  public update(item: T, oldX: number, oldY: number): void {
    const oldKey = this.getKey(oldX, oldY);
    const newKey = this.getKey(item.x, item.y);
    if (oldKey !== newKey) {
      if (this.grid.has(oldKey)) {
        this.grid.get(oldKey)!.delete(item);
      }
      this.insert(item);
    }
  }

  public queryRadius(x: number, y: number, radius: number): T[] {
    const result: T[] = [];
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
          for (const item of items) {
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
}
