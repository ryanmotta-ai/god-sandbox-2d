import { Pix, toPacked } from './pix';
import { ramp } from './color';

export type EngineKind = 'ram' | 'catapult';
export const E_FRAMES = { walk: 6, attack: 5 } as const;
export const E_SIZE: Record<EngineKind, { w: number; h: number; gx: number; gy: number }> = { ram: { w: 72, h: 44, gx: 36, gy: 38 }, catapult: { w: 72, h: 76, gx: 36, gy: 70 } };
const R = (c: string): number[] => toPacked(ramp(c, 5));
const WOOD = R('#8a5a34'), DARK = R('#4a3220'), IRON = R('#8a94a4'), HIDE = R('#7a4a34');

function wheel(px: Pix, cx: number, cy: number, r: number, spin: number): void {
  px.blob(cx, cy, r, r, DARK, { dither: 0.3 });
  px.blob(cx, cy, r - 1.4, r - 1.4, WOOD, { dither: 0.5 });
  for (let k = 0; k < 4; k++) { const a = spin + (k * Math.PI) / 2; px.line(cx, cy, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), DARK[1]); }
  px.ellipse(cx, cy, 1.4, 1.4, IRON[3]);
}

function ram(anim: 'walk' | 'attack', f: number): Pix {
  const { w, h, gx, gy } = E_SIZE.ram, px = new Pix(w, h);
  const t = f / E_FRAMES[anim], bob = anim === 'walk' ? Math.abs(Math.sin(t * Math.PI * 2)) * 0.8 : 0;
  const base = gy - 7 - bob;
  // log, hung on chains; thrusts forward (left) on the strike frames
  const swing = anim === 'attack' ? [0, 4, 9, -6, -2][f] : 0;
  const lx0 = gx - 30 - swing, lx1 = gx + 8 - swing * 0.4, ly = base - 9;
  px.limb(lx0, ly, lx1, ly, 6.5, 6.5, R('#7a5230'));
  px.blob(lx0 - 1, ly, 4.2, 4.2, IRON, { dither: 0.4 }); px.line(lx0 + 3, ly - 3, lx0 + 3, ly + 3, DARK[0]); px.line(lx0 + 9, ly - 3, lx0 + 9, ly + 3, DARK[0]);
  // chassis and roof
  px.column(gx - 22, base - 5, 46, 7, WOOD);
  for (const x of [gx - 20, gx - 2, gx + 18]) px.rect(x, base - 17, 3, 13, DARK[2]);
  px.poly([[gx - 24, base - 16], [gx - 8, base - 28], [gx + 12, base - 28], [gx + 28, base - 16]], (x, y) => HIDE[Math.max(0, Math.min(4, 2 + (((x + y) & 3) === 0 ? -1 : 0) + (y < base - 25 ? 1 : 0) - (x > gx + 14 ? 1 : 0)))]);
  for (let k = -20; k <= 24; k += 6) px.line(gx + k, base - 17, gx + k * 0.7, base - 27, DARK[1]);
  const spin = anim === 'walk' ? t * Math.PI : 0;
  wheel(px, gx - 14, gy - 4, 5.5, spin); wheel(px, gx + 14, gy - 4, 5.5, spin);
  px.outline(0.6, [20, 14, 18]);
  return px;
}

function catapult(anim: 'walk' | 'attack', f: number): Pix {
  const { w, h, gx, gy } = E_SIZE.catapult, px = new Pix(w, h);
  const t = f / E_FRAMES[anim], bob = anim === 'walk' ? Math.abs(Math.sin(t * Math.PI * 2)) * 0.7 : 0;
  const base = gy - 8 - bob;
  px.column(gx - 22, base - 4, 44, 6, WOOD);
  px.limb(gx - 18, base - 3, gx - 8, base - 22, 4, 3.4, WOOD); px.limb(gx + 18, base - 3, gx + 8, base - 22, 4, 3.4, WOOD);
  px.rect(gx - 9, base - 24, 18, 4, DARK[2]);
  // throwing arm: cocked back (right) → released over the top to the front (left)
  const deg = anim === 'attack' ? [60, -24, 35, 125, 100][f] : 62;
  const a = (deg * Math.PI) / 180, px0 = gx, py0 = base - 22, len = 26;
  const ex = px0 + Math.cos(a) * len * (a < Math.PI / 2 ? 1 : 1), ey = py0 - Math.sin(a) * len;
  const bx = px0 - Math.cos(a) * 10, by = py0 + Math.sin(a) * 10; // counterweight side
  px.limb(bx, by, ex, ey, 4, 3.4, R('#9a6a3c'));
  px.blob(bx, by + 2, 5, 5, R('#6a6a72'), { dither: 0.4 });
  px.blob(ex, ey - 1, 4.5, 3, R('#6a4a2a'), { dither: 0.3 });
  if (!(anim === 'attack' && f >= 3)) px.blob(ex, ey - 4, 3.4, 3.4, R('#8a8890'), { dither: 0.4 }); // the stone, until it is thrown
  px.line(gx - 20, base - 8, gx + 20, base - 8, DARK[1]);
  const spin = anim === 'walk' ? t * Math.PI : 0;
  wheel(px, gx - 15, gy - 4, 5.5, spin); wheel(px, gx + 15, gy - 4, 5.5, spin);
  px.outline(0.6, [20, 14, 18]);
  return px;
}

const cache = new Map<string, HTMLCanvasElement>();
export function engineFrame(kind: EngineKind, anim: 'walk' | 'attack', east: boolean, frame: number): HTMLCanvasElement {
  const key = `${kind}${anim}${east ? 1 : 0}${frame}`;
  let c = cache.get(key);
  if (!c) { const p = kind === 'ram' ? ram(anim, frame) : catapult(anim, frame); c = (east ? p.flipH() : p).toCanvas(); cache.set(key, c); }
  return c;
}
