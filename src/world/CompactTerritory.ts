const TERRITORY_CHUNK_SIZE = 32;

function parseCoordinate(key: string): [number, number] | null {
  const comma = key.indexOf(',');
  if (comma <= 0) return null;
  const x = Number(key.slice(0, comma));
  const y = Number(key.slice(comma + 1));
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 ? [x, y] : null;
}

/**
 * Set-compatible territory mask backed by one 32-bit row per chunk row.
 * Existing gameplay can keep using string coordinates while storage remains
 * allocation-free per claimed tile.
 */
export class CompactTerritory implements Iterable<string> {
  private readonly chunks = new Map<number, Uint32Array>();
  private count = 0;

  constructor(values?: Iterable<string>) {
    if (values) for (const value of values) this.add(value);
  }

  public get size(): number { return this.count; }

  public add(key: string): this {
    const coordinate = parseCoordinate(key);
    if (!coordinate) return this;
    const [x, y] = coordinate;
    const cx = Math.floor(x / TERRITORY_CHUNK_SIZE);
    const cy = Math.floor(y / TERRITORY_CHUNK_SIZE);
    const chunkKey = cx * 65536 + cy;
    let rows = this.chunks.get(chunkKey);
    if (!rows) {
      rows = new Uint32Array(TERRITORY_CHUNK_SIZE);
      this.chunks.set(chunkKey, rows);
    }
    const row = y & (TERRITORY_CHUNK_SIZE - 1);
    const bit = (1 << (x & (TERRITORY_CHUNK_SIZE - 1))) >>> 0;
    if ((rows[row] & bit) === 0) {
      rows[row] = (rows[row] | bit) >>> 0;
      this.count++;
    }
    return this;
  }

  public has(key: string): boolean {
    const coordinate = parseCoordinate(key);
    if (!coordinate) return false;
    const [x, y] = coordinate;
    const rows = this.chunks.get(Math.floor(x / TERRITORY_CHUNK_SIZE) * 65536 + Math.floor(y / TERRITORY_CHUNK_SIZE));
    if (!rows) return false;
    return (rows[y & 31] & ((1 << (x & 31)) >>> 0)) !== 0;
  }

  public delete(key: string): boolean {
    const coordinate = parseCoordinate(key);
    if (!coordinate) return false;
    const [x, y] = coordinate;
    const chunkKey = Math.floor(x / TERRITORY_CHUNK_SIZE) * 65536 + Math.floor(y / TERRITORY_CHUNK_SIZE);
    const rows = this.chunks.get(chunkKey);
    if (!rows) return false;
    const row = y & 31;
    const bit = (1 << (x & 31)) >>> 0;
    if ((rows[row] & bit) === 0) return false;
    rows[row] = (rows[row] & ~bit) >>> 0;
    this.count--;
    if (rows.every(value => value === 0)) this.chunks.delete(chunkKey);
    return true;
  }

  public clear(): void { this.chunks.clear(); this.count = 0; }

  public *[Symbol.iterator](): Iterator<string> {
    for (const [chunkKey, rows] of this.chunks) {
      const cx = Math.floor(chunkKey / 65536);
      const cy = chunkKey % 65536;
      for (let localY = 0; localY < TERRITORY_CHUNK_SIZE; localY++) {
        let bits = rows[localY] >>> 0;
        while (bits !== 0) {
          const isolated = (bits & -bits) >>> 0;
          const localX = 31 - Math.clz32(isolated);
          yield `${cx * TERRITORY_CHUNK_SIZE + localX},${cy * TERRITORY_CHUNK_SIZE + localY}`;
          bits = (bits & ~isolated) >>> 0;
        }
      }
    }
  }

  public forEach(callback: (value: string, key: string, set: CompactTerritory) => void, thisArg?: unknown): void {
    for (const value of this) callback.call(thisArg, value, value, this);
  }

  public get chunkCount(): number { return this.chunks.size; }
}
