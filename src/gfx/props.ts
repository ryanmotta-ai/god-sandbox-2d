import { Pix, toPacked, bayer } from './pix';
import { ramp, hex, pack } from './color';
import { hash2 } from '../core/rng';
import type { World } from '../world/world';
import { T } from '../world/defs';

/**
 * Street furniture: lamp posts, barrels, crates, benches, carts, signposts, planters, hay. Purely visual — a pure function of the
 * tile and its neighbours, so nothing is stored, saved or simulated; people simply walk past them.
 */
export type PropKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const LAMP: PropKind = 1;
const rc = new Map<string, number[]>();
const R = (c: string): number[] => { let v = rc.get(c); if (!v) { v = toPacked(ramp(c, 5)); rc.set(c, v); } return v; };
const col = (h: string, a = 255): number => { const c = hex(h); return pack(c[0], c[1], c[2], a); };
const clampI = (k: number): number => Math.max(0, Math.min(4, Math.round(k)));

export const PROP_W = 32, PROP_H = 48, PROP_GX = 16, PROP_GY = 40;

const isRoad = (w: World, x: number, y: number): boolean => w.inb(x, y) && w.terrain[y * w.w + x] === T.ROAD;
const isBld = (w: World, x: number, y: number): boolean => w.inb(x, y) && w.bld[y * w.w + x] !== 0;

/** Which prop (if any) stands on this tile. The fraction of road tiles that get one is deliberately small. */
export function propAt(w: World, x: number, y: number): { kind: PropKind; v: number } | null {
  const i = y * w.w + x;
  if (w.terrain[i] !== T.ROAD || w.bld[i] !== 0 || w.obj[i] !== 0 || w.zone[i] === 0) return null;
  const h = hash2(x, y, 401), v = Math.floor(hash2(x, y, 402) * 4);
  const rN = isRoad(w, x, y - 1), rS = isRoad(w, x, y + 1), rE = isRoad(w, x + 1, y), rW = isRoad(w, x - 1, y);
  const roads = +rN + +rS + +rE + +rW;
  const bAdj = isBld(w, x, y - 1) || isBld(w, x, y + 1) || isBld(w, x + 1, y) || isBld(w, x - 1, y);
  const edge = roads < 4;
  if (edge && ((x + (y >> 1) * 3) % 6 === 0) && h < 0.5) return { kind: 1, v };               // lamp posts, spaced along the roadside
  if (h > 0.16) return null;
  if (bAdj && isBld(w, x, y - 1)) return { kind: h < 0.06 ? 2 : h < 0.11 ? 3 : 8, v };         // barrels, crates, hay against a back wall
  if (bAdj) return { kind: h < 0.08 ? 3 : 7, v };                                              // crates, planters at a door
  if (rE && rW && !rN && !rS && h < 0.04) return { kind: 5, v };                                // a cart parked on a straight street
  if (edge && roads <= 2 && h < 0.08) return { kind: 4, v };                                    // benches at the road's edge
  if (roads === 1 && h < 0.12) return { kind: 6, v };                                          // a signpost where a lane ends
  return null;
}

function lamp(p: Pix, v: number): void {
  const ip = R('#3c3e46'), wp = R('#8a5a34');
  for (let j = 0; j < 30; j++) { p.set(PROP_GX, PROP_GY - j, ip[3]); p.set(PROP_GX + 1, PROP_GY - j, ip[1]); }
  p.rect(PROP_GX - 2, PROP_GY - 2, 6, 2, ip[2]); p.rect(PROP_GX - 1, PROP_GY - 4, 4, 2, ip[3]);
  p.line(PROP_GX, PROP_GY - 28, PROP_GX + 5, PROP_GY - 30, ip[3]);                   // bracket
  p.rect(PROP_GX + 3, PROP_GY - 29, 5, 6, col('#ffd36a')); p.rect(PROP_GX + 3, PROP_GY - 29, 5, 1, col('#fff2b0'));
  p.rect(PROP_GX + 2, PROP_GY - 30, 7, 1, ip[3]); p.rect(PROP_GX + 2, PROP_GY - 23, 7, 1, ip[2]); p.set(PROP_GX + 5, PROP_GY - 31, ip[4]);
  if (v & 1) { p.rect(PROP_GX - 3, PROP_GY - 20, 4, 3, R('#7a5a38')[2]); p.set(PROP_GX - 2, PROP_GY - 18, col(['#e0404a', '#f2c230', '#f08ac0'][v % 3])); }
  void wp;
}
function barrels(p: Pix, v: number): void {
  const bp = R('#8a5a30');
  const one = (x: number, y: number): void => { p.blob(PROP_GX + x, PROP_GY - y - 5, 4.2, 5.4, bp, { dither: 0.3 }); for (const dy of [-1, 3]) p.rect(PROP_GX + x - 4, PROP_GY - y - 5 + dy, 9, 1, col('#33343a')); };
  one(-5, 0); one(5, 0); if (v & 1) one(0, 7); p.rect(PROP_GX - 9, PROP_GY, 19, 1, col('#00000033'));
}
function crates(p: Pix, v: number): void {
  const w = R('#a07a48');
  const one = (x: number, y: number, s: number): void => { p.rect(PROP_GX + x, PROP_GY - y - s, s, s, w[2]); p.rect(PROP_GX + x, PROP_GY - y - s, s, 1, w[4]); p.rect(PROP_GX + x + s - 1, PROP_GY - y - s, 1, s, w[0]); for (let i = 0; i < s; i++) p.set(PROP_GX + x + i, PROP_GY - y - s + i, w[1]); };
  one(-8, 0, 9); one(2, 0, 8); if (v & 1) one(-4, 9, 7);
  p.rect(PROP_GX - 9, PROP_GY, 21, 1, col('#00000033'));
}
function bench(p: Pix, v: number): void {
  const wp = R(v & 1 ? '#8a5a34' : '#a07a48');
  p.rect(PROP_GX - 11, PROP_GY - 8, 23, 3, wp[3]); p.rect(PROP_GX - 11, PROP_GY - 8, 23, 1, wp[4]); p.rect(PROP_GX - 11, PROP_GY - 14, 23, 3, wp[2]);
  for (const x of [-10, 9]) { p.rect(PROP_GX + x, PROP_GY - 5, 2, 5, wp[1]); p.rect(PROP_GX + x, PROP_GY - 14, 2, 6, wp[1]); }
  p.rect(PROP_GX - 12, PROP_GY, 25, 1, col('#00000033'));
}
function cart(p: Pix, v: number): void {
  const wp = R('#8a5a34');
  p.rect(PROP_GX - 12, PROP_GY - 11, 24, 6, wp[2]); p.rect(PROP_GX - 12, PROP_GY - 11, 24, 1, wp[4]); p.rect(PROP_GX - 12, PROP_GY - 6, 24, 1, wp[0]);
  for (let i = 0; i < 6; i++) p.blob(PROP_GX - 9 + i * 4, PROP_GY - 13, 2.6, 2.2, R(v & 1 ? '#d8b040' : '#7ac04a'), { dither: 0.3 });
  for (const x of [-7, 7]) { p.blob(PROP_GX + x, PROP_GY - 4, 4, 4, R('#5a3a1c'), { dither: 0.2 }); p.set(PROP_GX + x, PROP_GY - 4, R('#c8b078')[3]); }
  p.line(PROP_GX - 12, PROP_GY - 8, PROP_GX - 20, PROP_GY - 3, wp[3]); p.rect(PROP_GX - 14, PROP_GY, 29, 1, col('#00000033'));
}
function sign(p: Pix, v: number): void {
  const wp = R('#7a5a38');
  p.rect(PROP_GX, PROP_GY - 22, 2, 22, wp[2]); p.rect(PROP_GX, PROP_GY - 22, 1, 22, wp[4]);
  p.rect(PROP_GX - 8, PROP_GY - 24, 10, 5, R('#c8a870')[3]); p.rect(PROP_GX - 8, PROP_GY - 24, 10, 1, wp[4]); p.rect(PROP_GX - 8, PROP_GY - 20, 10, 1, wp[1]);
  p.rect(PROP_GX + 2, PROP_GY - 18, 9, 5, R('#c8a870')[2]); p.rect(PROP_GX + 2, PROP_GY - 14, 9, 1, wp[1]);
  p.set(PROP_GX - 6, PROP_GY - 22, wp[0]); p.set(PROP_GX - 3, PROP_GY - 22, wp[0]); p.set(PROP_GX + 4, PROP_GY - 16, wp[0]); p.set(PROP_GX + 7, PROP_GY - 16, wp[0]);
  void v;
}
function planter(p: Pix, v: number): void {
  const wp = R('#8a5a30');
  p.rect(PROP_GX - 6, PROP_GY - 6, 12, 6, wp[2]); p.rect(PROP_GX - 6, PROP_GY - 6, 12, 1, wp[4]); p.rect(PROP_GX - 6, PROP_GY - 1, 12, 1, wp[0]);
  for (let i = 0; i < 6; i++) { p.set(PROP_GX - 5 + i * 2, PROP_GY - 7, col('#3a8a34')); p.set(PROP_GX - 5 + i * 2, PROP_GY - 8, col(['#e0404a', '#f2c230', '#f08ac0', '#ffffff', '#8a6ae0'][(i + v) % 5])); if (i % 2) p.set(PROP_GX - 5 + i * 2, PROP_GY - 9, col('#3a8a34')); }
}
function haybale(p: Pix, v: number): void {
  const hp = R('#d8b040');
  p.blob(PROP_GX - 4, PROP_GY - 6, 7, 5.4, hp, { dither: 0.5 }); if (v & 1) p.blob(PROP_GX + 6, PROP_GY - 5, 6, 4.6, hp, { dither: 0.5 });
  for (let i = 0; i < 12; i++) p.set(PROP_GX - 9 + i, PROP_GY - 8 + ((i * 5) % 6), col('#f4d874')); p.rect(PROP_GX - 11, PROP_GY, 25, 1, col('#00000033'));
}

const cache = new Map<string, HTMLCanvasElement>();
export function propSprite(kind: PropKind, v: number): HTMLCanvasElement {
  const key = `${kind}|${v & 3}`;
  let c = cache.get(key);
  if (!c) {
    const p = new Pix(PROP_W, PROP_H);
    switch (kind) { case 1: lamp(p, v); break; case 2: barrels(p, v); break; case 3: crates(p, v); break; case 4: bench(p, v); break; case 5: cart(p, v); break; case 6: sign(p, v); break; case 7: planter(p, v); break; default: haybale(p, v); }
    p.outline(0.5, [20, 16, 24]);
    void bayer;
    c = p.toCanvas(); cache.set(key, c);
  }
  return c;
}
void clampI;
