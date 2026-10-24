import { pack, type RGB } from './color';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4×4 ordered-dither threshold in (0,1) for pixel (x,y). */
export const bayer = (x: number, y: number): number => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

/** Light comes from the upper-left, slightly toward the viewer — the same direction as the terrain rims. */
const LX = -0.5, LY = -0.62, LZ = 0.6;
const LN = Math.hypot(LX, LY, LZ);

/** A small RGBA pixel canvas with the drawing verbs sprite code needs. Colours are packed ABGR ints. */
export class Pix {
  data: Uint32Array;
  constructor(public w: number, public h: number) { this.data = new Uint32Array(w * h); }

  set(x: number, y: number, c: number): void { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c; }
  get(x: number, y: number): number { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : 0; }
  has(x: number, y: number): boolean { return (this.get(x, y) >>> 24) > 0; }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this.set(x, y, c);
    }
  }
  /** Filled ellipse lit like a sphere: `ramp` is dark→light; ordered dither softens band edges. */
  blob(cx: number, cy: number, rx: number, ry: number, ramp: number[], opt: { dither?: number; bias?: number; only?: (x: number, y: number) => boolean } = {}): void {
    const n = ramp.length, dith = opt.dither ?? 0.9, bias = opt.bias ?? 0;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      if (opt.only && !opt.only(x, y)) continue;
      const nz = Math.sqrt(1 - d2), l = (nx * LX + ny * LY + nz * LZ) / LN; // -1..1
      const t = (l * 0.5 + 0.5 + bias) * (n - 1) + (bayer(x, y) - 0.5) * dith;
      this.set(x, y, ramp[Math.min(n - 1, Math.max(0, Math.round(t)))]);
    }
  }
  /** Scanline polygon fill; `shade(x,y)` may return a colour per pixel. */
  poly(pts: [number, number][], c: number | ((x: number, y: number) => number)): void {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [], sy = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, typeof c === 'number' ? c : c(x, y));
    }
  }
  /**
   * A limb: a thick segment drawn as a capsule, shaded across its width so the lit (upper-left) edge is
   * bright and the far edge dark. `ramp` is dark→light.
   */
  limb(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, ramp: number[]): void {
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1, len = Math.sqrt(len2);
    const nxv = -dy / len, nyv = dx / len; // unit normal
    const side = nxv * LX + nyv * LY >= 0 ? 1 : -1; // which side of the limb faces the light
    const r = Math.max(w0, w1) / 2 + 1, n = ramp.length;
    for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++) for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0;
      const t = Math.min(1, Math.max(0, (px * dx + py * dy) / len2));
      const w = (w0 + (w1 - w0) * t) / 2;
      const off = px * nxv + py * nyv; // signed distance from the axis
      const cx = x0 + dx * t, cy = y0 + dy * t;
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > w) continue;
      const k = Math.max(-1, Math.min(1, (off / Math.max(w, 0.5)) * side)); // -1 shadow side … 1 lit side
      const idx = Math.round((k * 0.5 + 0.5) * (n - 1) + (bayer(x, y) - 0.5) * 0.5);
      this.set(x, y, ramp[Math.min(n - 1, Math.max(0, idx))]);
    }
  }
  /** Shaded box: lit top/left, mid front, dark right. Used for trunks, crates, walls. */
  column(x: number, y: number, w: number, h: number, ramp: number[]): void {
    const n = ramp.length;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const f = w <= 1 ? 0.5 : i / (w - 1);
      const idx = Math.round((1 - f) * (n - 1) * 0.9 + (bayer(x + i, y + j) - 0.5) * 0.7);
      this.set(x + i, y + j, ramp[Math.min(n - 1, Math.max(0, idx))]);
    }
  }
  /**
   * Selective outline: transparent pixels touching the sprite get a dark version of the neighbouring
   * colour (not flat black). Top/left outlines are lighter than bottom/right, as the light dictates.
   */
  outline(strength = 0.62, floor: RGB = [16, 14, 28]): void {
    const src = this.data.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if ((src[y * this.w + x] >>> 24) > 0) continue;
      let best = 0, pick = 0;
      const nb: [number, number, number][] = [[-1, 0, 0.9], [1, 0, 1.1], [0, -1, 0.85], [0, 1, 1.15]];
      for (const [dx, dy, wgt] of nb) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
        const c = src[yy * this.w + xx];
        if ((c >>> 24) > 0 && wgt > best) { best = wgt; pick = c; }
      }
      if (!best) continue;
      const k = Math.min(0.9, strength * best);
      this.data[y * this.w + x] = pack((pick & 255) * (1 - k) + floor[0] * k, ((pick >> 8) & 255) * (1 - k) + floor[1] * k, ((pick >> 16) & 255) * (1 - k) + floor[2] * k);
    }
  }
  /** Mirror left↔right into a new Pix. */
  flipH(): Pix {
    const o = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.data[y * this.w + x] = this.data[y * this.w + (this.w - 1 - x)];
    return o;
  }
  /** Copy `src` on top at (dx,dy), skipping transparent pixels. */
  blit(src: Pix, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.data[y * src.w + x]; if ((c >>> 24) > 0) this.set(x + dx, y + dy, c); }
  }
  /** Shear rows above `baseY` sideways by `amp·sin` — wind sway for plants. Returns a new Pix. */
  sway(baseY: number, amp: number, power = 1.6): Pix {
    const o = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const k = Math.max(0, (baseY - y) / baseY), shift = Math.round(amp * Math.pow(k, power));
      for (let x = 0; x < this.w; x++) { const c = this.data[y * this.w + x]; if ((c >>> 24) > 0) o.set(x + shift, y, c); }
    }
    return o;
  }
  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const ctx = c.getContext('2d')!, img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

export const toPacked = (r: RGB[]): number[] => r.map(c => pack(c[0], c[1], c[2]));
