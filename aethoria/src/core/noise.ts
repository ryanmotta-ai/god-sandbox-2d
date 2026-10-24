import { Rng } from './rng';

/** 2D simplex noise, output in [-1,1]. */
export class Noise {
  private perm = new Uint8Array(512);
  constructor(seed: number) {
    const r = new Rng(seed ^ 0x9e3779b9);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  private static G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  at(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255, P = this.perm, G = Noise.G;
    let n = 0, a = 0.5 - x0 * x0 - y0 * y0;
    if (a > 0) { a *= a; const g = G[P[ii + P[jj]] & 7]; n += a * a * (g[0] * x0 + g[1] * y0); }
    a = 0.5 - x1 * x1 - y1 * y1;
    if (a > 0) { a *= a; const g = G[P[ii + i1 + P[jj + j1]] & 7]; n += a * a * (g[0] * x1 + g[1] * y1); }
    a = 0.5 - x2 * x2 - y2 * y2;
    if (a > 0) { a *= a; const g = G[P[ii + 1 + P[jj + 1]] & 7]; n += a * a * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }
  /** Fractal sum, normalised to roughly [-1,1]. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) { sum += amp * this.at(x * freq, y * freq); norm += amp; amp *= gain; freq *= lacunarity; }
    return sum / norm;
  }
}
