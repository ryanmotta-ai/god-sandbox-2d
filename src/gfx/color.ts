/** Colour helpers. Pixels are packed little-endian ABGR so they can be written straight into a Uint32Array view of ImageData. */

export type RGB = [number, number, number];

export const pack = (r: number, g: number, b: number, a = 255): number =>
  ((a << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r)) >>> 0;
export const clamp8 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

export function hex(s: string): RGB {
  const v = parseInt(s.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const packHex = (s: string, a = 255): number => { const [r, g, b] = hex(s); return pack(r, g, b, a); };
export const css = (c: RGB, a = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const unpack = (c: number): RGB => [c & 255, (c >> 8) & 255, (c >> 16) & 255];

/**
 * Build a hue-shifted ramp from one base colour: shadows slide toward blue/purple and darken,
 * lights slide toward warm yellow. That shift — not just brightness — is what makes pixel art read as lit.
 * Returns `n` colours, dark → light, with `base` at index `baseIdx`.
 */
export function ramp(base: string | RGB, n = 5, baseIdx = Math.floor(n / 2)): RGB[] {
  const b = typeof base === 'string' ? hex(base) : base;
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i - baseIdx) / Math.max(baseIdx, n - 1 - baseIdx); // -1 .. 1
    if (t < 0) { const k = -t; out.push([b[0] * (1 - 0.62 * k) + 14 * k, b[1] * (1 - 0.56 * k) + 16 * k, b[2] * (1 - 0.40 * k) + 40 * k]); }
    else { const k = t; out.push([b[0] + (255 - b[0]) * 0.46 * k + 14 * k, b[1] + (255 - b[1]) * 0.44 * k + 8 * k, b[2] + (255 - b[2]) * 0.30 * k - 6 * k]); }
  }
  return out.map(c => [clamp8(c[0]), clamp8(c[1]), clamp8(c[2])] as RGB);
}
