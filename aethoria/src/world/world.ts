import { T, TERRAIN, O, OBJECTS } from './defs';

/** Terrain art is baked per chunk; chunks are 16×16 tiles. */
export const CHUNK = 16;

/**
 * The tile grid. Flat typed arrays indexed by `y*w+x` — no per-tile objects.
 * Anything that changes what a tile *looks* like must go through the setters so
 * the right chunks are re-baked.
 */
export class World {
  readonly size: number;
  readonly cw: number;
  terrain: Uint8Array;
  /** Elevation field 0..255 from generation; kept for rivers/relief. */
  height: Uint8Array;
  moist: Uint8Array;
  /** 0 = freezing, 255 = scorching. */
  temp: Uint8Array;
  obj: Uint8Array;
  /** Growth stage of trees / amount left of ore, 0..255. */
  objAge: Uint8Array;
  /** Burn timer; 0 = not burning. */
  fire: Uint8Array;
  /** Owning city id + 1; 0 = unclaimed. */
  zone: Uint16Array;
  /** Occupying building id + 1; 0 = none. */
  bld: Uint16Array;
  /** Per-chunk version; renderer re-bakes when it changes. */
  chunkVer: Uint32Array;
  activeFires = new Set<number>();

  constructor(public readonly w: number, public readonly h: number, public seed = 1) {
    this.size = w;
    const n = w * h;
    this.cw = Math.ceil(w / CHUNK);
    this.terrain = new Uint8Array(n);
    this.height = new Uint8Array(n);
    this.moist = new Uint8Array(n);
    this.temp = new Uint8Array(n);
    this.obj = new Uint8Array(n);
    this.objAge = new Uint8Array(n);
    this.fire = new Uint8Array(n);
    this.zone = new Uint16Array(n);
    this.bld = new Uint16Array(n);
    this.chunkVer = new Uint32Array(this.cw * Math.ceil(h / CHUNK)).fill(1);
  }

  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  idx(x: number, y: number): number { return y * this.w + x; }
  /** Terrain with out-of-bounds read as deep ocean (keeps art code branch-free). */
  t(x: number, y: number): number { return this.inb(x, y) ? this.terrain[y * this.w + x] : T.DEEP; }

  /** Mark the chunk of (x,y) — and neighbours if within `pad` tiles of an edge — for re-bake. */
  touch(x: number, y: number, pad = 2): void {
    const cx0 = Math.max(0, Math.floor((x - pad) / CHUNK)), cx1 = Math.min(this.cw - 1, Math.floor((x + pad) / CHUNK));
    const ch = Math.ceil(this.h / CHUNK);
    const cy0 = Math.max(0, Math.floor((y - pad) / CHUNK)), cy1 = Math.min(ch - 1, Math.floor((y + pad) / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.chunkVer[cy * this.cw + cx]++;
  }

  setTerrain(x: number, y: number, t: number): void {
    if (!this.inb(x, y)) return;
    const i = y * this.w + x;
    if (this.terrain[i] === t) return;
    this.terrain[i] = t;
    // Nothing grows underwater, in lava or on a mountain face.
    const d = TERRAIN[t];
    if (d.water || t === T.LAVA || t === T.MOUNTAIN || t === T.PEAK) this.obj[i] = O.NONE;
    if (d.water) this.fire[i] = 0;
    this.touch(x, y);
  }

  setObject(x: number, y: number, o: number, age = 255): void {
    if (!this.inb(x, y)) return;
    const i = y * this.w + x;
    this.obj[i] = o;
    this.objAge[i] = age;
  }

  isWalkable(x: number, y: number): boolean {
    if (!this.inb(x, y)) return false;
    const i = y * this.w + x;
    return TERRAIN[this.terrain[i]].walk && !OBJECTS[this.obj[i]].solid && this.bld[i] === 0;
  }

  /** Walkable ignoring buildings (units may path through their own gates). */
  isDeepWater(x: number, y: number): boolean { return this.t(x, y) === T.DEEP; }

  /** BFS distance (in tiles, capped) to the nearest water tile. */
  waterDistance(cap = 24): Uint8Array {
    const { w, h } = this, d = new Uint8Array(w * h).fill(cap);
    const q: number[] = [];
    for (let i = 0; i < w * h; i++) if (TERRAIN[this.terrain[i]].water) { d[i] = 0; q.push(i); }
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % w, y = (i / w) | 0, nd = d[i] + 1;
      if (nd >= cap) continue;
      if (x > 0 && d[i - 1] > nd) { d[i - 1] = nd; q.push(i - 1); }
      if (x < w - 1 && d[i + 1] > nd) { d[i + 1] = nd; q.push(i + 1); }
      if (y > 0 && d[i - w] > nd) { d[i - w] = nd; q.push(i - w); }
      if (y < h - 1 && d[i + w] > nd) { d[i + w] = nd; q.push(i + w); }
    }
    return d;
  }
}
