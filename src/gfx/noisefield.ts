import { hash2 } from '../core/rng';

/**
 * Tileable noise textures, built once. Terrain art samples them with `& mask` so any world pixel gets
 * a stable value without evaluating noise per pixel (the old bake did, and it was the slow part).
 */
function periodic(period: number, cell: number, salt: number, octaves: number): Uint8Array {
  const out = new Uint8Array(period * period);
  for (let y = 0; y < period; y++) for (let x = 0; x < period; x++) {
    let sum = 0, amp = 1, norm = 0, c = cell;
    for (let o = 0; o < octaves; o++) {
      const cells = Math.max(1, Math.round(period / c));
      const fx = (x / period) * cells, fy = (y / period) * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const l = (a: number, b: number) => hash2(((a % cells) + cells) % cells, ((b % cells) + cells) % cells, salt + o * 31);
      const v = l(x0, y0) * (1 - sx) * (1 - sy) + l(x0 + 1, y0) * sx * (1 - sy) + l(x0, y0 + 1) * (1 - sx) * sy + l(x0 + 1, y0 + 1) * sx * sy;
      sum += v * amp; norm += amp; amp *= 0.5; c /= 2;
    }
    out[y * period + x] = Math.floor((sum / norm) * 255);
  }
  return out;
}

export const NZ = {
  /** Domain warp for terrain borders, ±~7px. Period 128. */
  wx: periodic(128, 32, 1, 3), wy: periodic(128, 32, 2, 3),
  /** Blob-scale (~10px) variation. Period 256. */
  a: periodic(256, 40, 3, 3),
  /** Fine grain (~3px). Period 224 (coprime-ish with 256 so repeats don't line up). */
  b: periodic(224, 8, 4, 2),
  /** Big patches (~48px). Period 192. */
  c: periodic(192, 96, 5, 2),
  /** Broad patches for the water pattern; period matches its 256px canvas so it tiles. */
  w: periodic(256, 128, 6, 2),
};
export const PERIOD = { w: 128, a: 256, b: 224, c: 192 };

/** 0..255 samples at world pixel (x,y). */
export const nzA = (x: number, y: number): number => NZ.a[(y & 255) * 256 + (x & 255)];
export const nzB = (x: number, y: number): number => NZ.b[(((y % 224) + 224) % 224) * 224 + (((x % 224) + 224) % 224)];
export const nzC = (x: number, y: number): number => NZ.c[(((y % 192) + 192) % 192) * 192 + (((x % 192) + 192) % 192)];
export const nzW = (x: number, y: number): number => NZ.w[(y & 255) * 256 + (x & 255)];
