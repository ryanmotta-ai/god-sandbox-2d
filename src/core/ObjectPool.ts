/**
 * Generic Object Pool to prevent Garbage Collection allocations during simulation.
 */
export class ObjectPool<T> {
  private freeList: T[] = [];
  private factory: () => T;
  private resetFn: (obj: T) => void;

  constructor(factory: () => T, resetFn: (obj: T) => void, initialCapacity: number = 100) {
    this.factory = factory;
    this.resetFn = resetFn;

    for (let i = 0; i < initialCapacity; i++) {
      this.freeList.push(this.factory());
    }
  }

  public obtain(): T {
    if (this.freeList.length > 0) {
      return this.freeList.pop()!;
    }
    return this.factory();
  }

  public release(obj: T): void {
    this.resetFn(obj);
    this.freeList.push(obj);
  }

  public releaseAll(objs: T[]): void {
    for (const obj of objs) {
      this.release(obj);
    }
  }
}
