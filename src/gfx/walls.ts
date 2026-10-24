import { Pix, toPacked, bayer } from './pix';
import { ramp, hex, pack } from './color';
import { hash2 } from '../core/rng';
import type { Race } from './humanoid';

/**
 * Wall segments. One sprite per tile, shaped by which neighbours it joins (N=1 E=2 S=4 W=8):
 * east/west runs show their front face, north/south runs show only a walkway seen from above, and a
 * pillar caps every tile so corners and junctions close up. Tile top-left sits at (8,40) in a 48×80 canvas.
 */
export const WALL_W = 48, WALL_H = 80;
const TX = 8, TY = 40;
const R = (c: string): number[] => toPacked(ramp(c, 5));
const col = (h: string): number => { const c = hex(h); return pack(c[0], c[1], c[2]); };

interface Style { stone: string; kind: 'stone' | 'palisade'; trim: string }
const STYLE: Record<Race, Style> = {
  human: { stone: '#8c8a84', kind: 'stone', trim: '#b5b0a4' },
  elf: { stone: '#d8d2c0', kind: 'stone', trim: '#6ab070' },
  dwarf: { stone: '#6c6a66', kind: 'stone', trim: '#8a8680' },
  orc: { stone: '#7a5a3c', kind: 'palisade', trim: '#d8cfb4' },
};

/** A vertical face (screen coords): brick courses with a lit left edge, or upright planks. */
function face(px: Pix, x0: number, x1: number, y0: number, y1: number, st: Style, rp: number[]): void {
  const w = x1 - x0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const f = (x - x0) / Math.max(1, w - 1);
    let k = 2.5 - f * 0.9 + (bayer(x, y) - 0.5) * 0.5 - ((y1 - y) < 3 ? 0.8 : 0) + ((y - y0) < 2 ? 0.5 : 0);
    if (st.kind === 'stone') { const row = Math.floor((y - y0) / 5), off = (row & 1) * 5; if ((y - y0) % 5 === 0 || (x + off) % 10 === 0) k -= 1.5; else k += (hash2(Math.floor((x + off) / 10), row, 3) - 0.5) * 0.9; }
    else { const lx = (x - x0) % 4; if (lx === 0) k -= 1.6; else if (lx === 1) k += 0.5; k += (hash2(Math.floor((x - x0) / 4), 5, 2) - 0.5) * 0.8; }
    px.set(x, y, rp[Math.max(0, Math.min(4, Math.round(k)))]);
  }
}
/** The walkway seen from above: light, flat, a little worn. */
function topface(px: Pix, x0: number, x1: number, y0: number, y1: number, rp: number[]): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.set(x, y, rp[Math.max(0, Math.min(4, Math.round(3.1 + (hash2(x >> 1, y >> 1, 9) - 0.5) * 1.2 - (x === x0 || x === x1 - 1 ? 0.8 : 0))))]);
}
function merlons(px: Pix, x0: number, x1: number, yEdge: number, st: Style, rp: number[]): void {
  for (let x = x0; x < x1; x += 8) {
    if (st.kind === 'stone') { px.rect(x, yEdge - 4, 5, 4, rp[2]); px.rect(x, yEdge - 4, 5, 1, rp[4]); px.rect(x + 4, yEdge - 4, 1, 4, rp[1]); }
    else { px.poly([[x, yEdge], [x + 2, yEdge - 6], [x + 4, yEdge]], rp[3]); px.set(x + 2, yEdge - 6, rp[4]); }
  }
}

function paintWall(race: Race, mask: number, gate: boolean, Hh: number): Pix {
  const px = new Pix(WALL_W, WALL_H), st = STYLE[race], rp = R(st.stone), H = Hh;
  const X = (x: number): number => TX + x, Y = (y: number): number => TY + y;
  const N = !!(mask & 1), E = !!(mask & 2), S = !!(mask & 4), W = !!(mask & 8);
  // 1. northern walkway (behind the pillar)
  if (N) topface(px, X(10), X(22), Y(-H), Y(8 - H), rp);
  // 2. east / west runs: top, then front face
  const run = (x0: number, x1: number): void => {
    topface(px, X(x0), X(x1), Y(10 - H), Y(22 - H), rp);
    face(px, X(x0), X(x1), Y(22 - H), Y(22), st, rp);
    merlons(px, X(x0), X(x1) - 3, Y(10 - H), st, rp);
  };
  if (E) run(23, 32);
  if (W) run(0, 9);
  // 3. the pillar (or the gatehouse)
  const Hp = H + 3;
  if (gate) {
    for (const [a, b] of [[2, 11], [21, 30]] as [number, number][]) { topface(px, X(a), X(b), Y(8 - Hp), Y(22 - Hp), rp); face(px, X(a), X(b), Y(22 - Hp), Y(22), st, rp); merlons(px, X(a), X(b) - 2, Y(8 - Hp), st, rp); }
    topface(px, X(11), X(21), Y(8 - Hp), Y(22 - Hp), rp); // lintel walkway
    const lintelY = Math.round(22 - Math.min(Hp, 17));
    face(px, X(11), X(21), Y(22 - Hp), Y(lintelY), st, rp);
    // opening: dark passage and two open doors
    const dark = R('#1c1a20');
    for (let y = lintelY; y < 22; y++) for (let x = 11; x < 21; x++) { const arch = y < lintelY + 3 && (x < 12 + (lintelY + 3 - y) || x > 19 - (lintelY + 3 - y)); if (!arch) px.set(X(x), Y(y), dark[y > 19 ? 2 : 1]); }
    const wood = R('#7a5230');
    if (Hp > 12) { for (let y = lintelY + 1; y < 22; y++) { px.set(X(11), Y(y), wood[2]); px.set(X(20), Y(y), wood[1]); } }
  } else {
    topface(px, X(9), X(23), Y(8 - Hp), Y(22 - Hp), rp);
    face(px, X(9), X(23), Y(22 - Hp), Y(22), st, rp);
    merlons(px, X(9), X(23) - 3, Y(8 - Hp), st, rp);
    if (st.trim && Hp > 14) { px.rect(X(9), Y(22 - Hp), 14, 1, col(st.trim)); if (race === 'elf') for (let x = 10; x < 23; x += 4) px.set(X(x), Y(23 - Hp), col('#4a9a40')); }
  }
  // 4. southern walkway (in front of the pillar)
  if (S) topface(px, X(10), X(22), Y(22 - H), Y(32 - H), rp);
  px.outline(0.58, [18, 16, 24]);
  return px;
}

function damaged(p: Pix, level: number): Pix {
  const o = new Pix(p.w, p.h); o.data.set(p.data);
  for (let i = 0; i < (level === 1 ? 18 : 44); i++) {
    const x = Math.floor(hash2(i, 1, p.w) * (p.w - 8)) + 4, y = Math.floor(hash2(i, 2, p.w) * 40) + 28;
    if (!o.has(x, y)) continue;
    const r = level === 1 ? 1 : 1 + (i % 3);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && o.has(x + dx, y + dy)) o.set(x + dx, y + dy, level === 1 ? col('#2a2424') : (i % 2 ? col('#1a1616') : 0));
  }
  o.outline(0.58, [18, 16, 24]);
  return o;
}

const cache = new Map<string, HTMLCanvasElement>();
/** stage 0–2: building up (stubs → half → nearly), 3: finished. dmg 0–2. */
export function wallSprite(race: Race, mask: number, gate: boolean, stage: number, dmg: number): HTMLCanvasElement {
  const key = `${race}|${mask}|${gate ? 1 : 0}|${stage}|${dmg}`;
  let c = cache.get(key);
  if (!c) {
    let p = paintWall(race, mask, gate, [5, 12, 18, 22][stage]);
    if (stage === 3 && dmg) p = damaged(p, dmg);
    c = p.toCanvas(); cache.set(key, c);
  }
  return c;
}
