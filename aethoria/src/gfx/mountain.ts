import { Pix, toPacked, bayer } from './pix';
import { ramp, pack } from './color';
import { Rng, hash2 } from '../core/rng';

export const MW = 72, MH = 76, MCX = 36, MBASE = 66;
const rc = new Map<string, number[]>();
/** Hand-set ramp: warm grey, only a whisper of blue in the shadows (the generic ramp turned rock purple). */
const WARM_ROCK = ['#3c3a3e', '#5a5750', '#7a766c', '#9a958a', '#c2bcad'].map(h => { const v = parseInt(h.slice(1), 16); return pack((v >> 16) & 255, (v >> 8) & 255, v & 255); });
const R = (c: string): number[] => { let v = rc.get(c); if (!v) { v = toPacked(ramp(c, 5)); rc.set(c, v); } return v; };

/**
 * One mountain: a jagged silhouette from summed peaks, shaded by the slope each column faces
 * (up-left = lit), broken into facets, banded with strata, and capped with a ragged snowline.
 */
function drawMountain(variant: number, snowy: boolean, scale: number, rockHex: string): Pix {
  const px = new Pix(MW, MH), rng = new Rng(variant * 99991 + 17);
  const rock = rockHex === '#7a7882' ? WARM_ROCK : R(rockHex), snow = R('#e6eefa'), moss = R('#5a7a4a');
  const H = 46 * scale, half = 27 * scale;
  const peaks: { x: number; h: number; w: number }[] = [{ x: MCX + rng.range(-5, 5), h: H, w: half }];
  if (variant % 3 === 1) peaks.push({ x: MCX + rng.range(-17, -10), h: H * rng.range(0.55, 0.75), w: half * 0.62 }, { x: MCX + rng.range(10, 17), h: H * rng.range(0.5, 0.7), w: half * 0.6 });
  if (variant % 3 === 2) peaks.push({ x: MCX + rng.range(-14, 14), h: H * rng.range(0.6, 0.8), w: half * 0.7 });
  const top = new Float32Array(MW).fill(MBASE);
  for (let x = 0; x < MW; x++) {
    let h = 0;
    for (const p of peaks) { const t = Math.abs(x - p.x) / p.w; if (t < 1) h = Math.max(h, p.h * Math.pow(1 - t, 0.82) * (1 + (hash2(x >> 1, variant, 5) - 0.5) * 0.16)); }
    top[x] = MBASE - h;
  }
  // facet id per column group so adjacent slopes break into planes
  const facetShade = new Int8Array(MW);
  for (let x = 0, k = 0; x < MW; x += 3 + (k++ % 4)) { const s = Math.round((hash2(x, variant, 9) - 0.5) * 2.2); for (let i = 0; i < 8 && x + i < MW; i++) facetShade[x + i] = s; }
  const snowLine = (x: number): number => top[x] + (snowy ? 16 * scale * (0.55 + hash2(x >> 1, variant, 3) * 0.7) : -99);
  for (let x = 1; x < MW - 1; x++) {
    if (top[x] >= MBASE - 0.5) continue;
    const slope = top[x + 1] - top[x - 1]; // <0: surface rising to the right = faces up-left = lit
    const face = slope < -1.1 ? 1 : slope > 1.1 ? -1 : 0;
    for (let y = Math.round(top[x]); y <= MBASE + 3; y++) {
      const depth = (y - top[x]) / Math.max(8, MBASE - top[x]);
      const strata = Math.sin(y * 0.55 + x * 0.12 * (face || 1) + hash2(x >> 2, y >> 2, 4) * 3) > 0.84 ? -1 : 0;
      let idx = 2 + face * 1.4 + facetShade[x] * 0.7 - depth * 1.4 + strata + (bayer(x, y) - 0.5) * 0.9;
      if (y < top[x] + 2) idx += 1.3; // sunlit crest
      let c = rock[Math.max(0, Math.min(4, Math.round(idx)))];
      if (y >= MBASE) c = rock[Math.max(0, Math.round(idx) - 1)];
      if (y < snowLine(x) + (hash2(x, y, 6) - 0.5) * 3) { const si = Math.round(2.6 + face * 1.1 + facetShade[x] * 0.5 - depth * 1.2 + (bayer(x, y) - 0.5) * 0.9); c = snow[Math.max(0, Math.min(4, si))]; }
      else if (!snowy && depth > 0.55 && hash2(x >> 1, y >> 1, 8) > 0.82 && face >= 0) c = moss[Math.max(0, Math.min(4, Math.round(idx)))];
      px.set(x, y, c);
    }
  }
  // cracks
  for (let i = 0; i < 9; i++) { const x = Math.round(rng.range(10, MW - 10)), y = Math.round(MBASE - rng.range(4, 24 * scale)); if (px.has(x, y)) { px.line(x, y, x + rng.range(-3, 3), y + rng.range(3, 7), rock[0]); } }
  // scree at the foot
  for (let i = 0; i < 26; i++) { const x = Math.round(MCX + rng.range(-30, 30)), y = MBASE + Math.round(rng.range(0, 3)); px.set(x, y, rock[1 + (i & 1)]); if (rng.chance(0.4)) px.set(x + 1, y, rock[3]); }
  px.outline(0.6, [18, 16, 30]);
  return px;
}

const cache = new Map<number, HTMLCanvasElement>();
/** `h` 0..255 is the tile's relief; taller → bigger peak. */
export function mountainSprite(variant: number, h: number, snowy: boolean, rockHex = '#7a7882'): HTMLCanvasElement {
  const sc = h > 215 ? 1.18 : h > 170 ? 1 : 0.78;
  const key = (variant % 6) * 8 + (sc > 1 ? 2 : sc < 1 ? 0 : 1) * 2 + (snowy ? 1 : 0) + (rockHex === '#7a7882' ? 0 : 100);
  let c = cache.get(key);
  if (!c) { c = drawMountain(variant % 6, snowy, sc, rockHex).toCanvas(); cache.set(key, c); }
  return c;
}
