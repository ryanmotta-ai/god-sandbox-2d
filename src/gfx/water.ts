import { hash2 } from '../core/rng';
import { nzW } from './noisefield';
import { packHex } from './color';

export const WATER_FRAMES = 8;
const SZ = 256;
const DEEP = ['#0b2f5e', '#0e3d73', '#124b86', '#175a99'].map(h => packHex(h));
const CREST = packHex('#5aa7de'), CREST_HI = packHex('#a9d8f5'), TROUGH = packHex('#092650');

/**
 * Seamless animated water. A calm two-tone base, plus short wave dashes scattered on a 32×16 cell grid.
 * Each dash has its own phase: it swells in, drifts a couple of pixels, brightens, then fades — so the
 * loop is exactly WATER_FRAMES long yet nothing on screen moves in lockstep.
 */
export function makeWaterFrames(): HTMLCanvasElement[] {
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < WATER_FRAMES; f++) {
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(SZ, SZ), p = new Uint32Array(img.data.buffer);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const cc = nzW(x, y) / 255;
      const g = hash2(x, y, 3);
      // low-contrast base: broad patches with a little stipple at the seams
      const v = cc + (g - 0.5) * 0.12;
      p[y * SZ + x] = v < 0.4 ? DEEP[0] : v < 0.7 ? DEEP[1] : DEEP[2];
    }
    // wave dashes
    for (let cy = 0; cy < SZ / 16; cy++) for (let cx = 0; cx < SZ / 32; cx++) {
      if (hash2(cx, cy, 21) > 0.62) continue;
      const len = 6 + Math.floor(hash2(cx, cy, 22) * 9), x0 = cx * 32 + 2 + Math.floor(hash2(cx, cy, 23) * (26 - len)), y0 = cy * 16 + 2 + Math.floor(hash2(cx, cy, 24) * 11);
      const life = (f / WATER_FRAMES + hash2(cx, cy, 25)) % 1; // 0..1 along this dash's own loop
      if (life > 0.8) continue;
      const bright = life > 0.15 && life < 0.55;
      const shift = Math.floor(life * 3);
      const w = life < 0.15 || life > 0.6 ? Math.max(3, len - 4) : len;
      for (let k = 0; k < w; k++) {
        const x = x0 + shift + k + ((len - w) >> 1), arc = k === 0 || k === w - 1 ? 1 : 0;
        p[(y0 + arc) * SZ + x] = bright ? (k > 1 && k < w - 2 && life > 0.25 && life < 0.45 ? CREST_HI : CREST) : DEEP[3];
        if (k > 0 && k < w - 1) p[(y0 + 1 + arc) * SZ + x + 1 - 0] = TROUGH;
      }
    }
    // twinkles
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(hash2(i, 1, 31) * SZ), y = Math.floor(hash2(i, 2, 31) * SZ), ph = hash2(i, 3, 31);
      if (Math.floor(((f / WATER_FRAMES + ph) % 1) * 8) === 0) p[y * SZ + x] = CREST_HI;
    }
    ctx.putImageData(img, 0, 0);
    frames.push(c);
  }
  return frames;
}
