import { Pix, toPacked } from './pix';
import { ramp, hex, pack } from './color';
import { ik2 } from './rig';

export type AnimalKind = 'sheep' | 'cow' | 'chicken' | 'rabbit' | 'deer' | 'boar' | 'wolf' | 'bear' | 'snake' | 'crab' | 'bird' | 'dragon';
export type AAnim = 'idle' | 'walk' | 'run' | 'attack' | 'eat' | 'die' | 'fly' | 'breath';
export const A_FRAMES: Record<AAnim, number> = { idle: 4, walk: 6, run: 6, attack: 5, eat: 4, die: 5, fly: 6, breath: 5 };

/** Sprite canvas and ground anchor per kind. Everything is drawn facing left; east is the mirror. */
export const A_SIZE: Record<AnimalKind, { w: number; h: number; gx: number; gy: number }> = {
  sheep: { w: 44, h: 36, gx: 22, gy: 32 }, cow: { w: 52, h: 42, gx: 26, gy: 38 }, chicken: { w: 28, h: 28, gx: 14, gy: 25 }, rabbit: { w: 28, h: 28, gx: 14, gy: 25 },
  deer: { w: 52, h: 52, gx: 26, gy: 47 }, boar: { w: 48, h: 36, gx: 24, gy: 32 }, wolf: { w: 52, h: 40, gx: 26, gy: 36 }, bear: { w: 56, h: 46, gx: 28, gy: 42 },
  snake: { w: 40, h: 24, gx: 20, gy: 21 }, crab: { w: 28, h: 22, gx: 14, gy: 19 }, bird: { w: 36, h: 32, gx: 18, gy: 20 }, dragon: { w: 112, h: 96, gx: 56, gy: 84 },
};

const rc = new Map<string, number[]>();
const R = (c: string, n = 5): number[] => { const k = c + n; let v = rc.get(k); if (!v) { v = toPacked(ramp(c, n)); rc.set(k, v); } return v; };
const col = (h: string): number => { const c = hex(h); return pack(c[0], c[1], c[2]); };
const TAU = Math.PI * 2;

function foot(p: number, stride: number, lift: number): [number, number] {
  p = ((p % 1) + 1) % 1;
  if (p < 0.5) return [stride * (1 - p * 4), 0];
  const q = (p - 0.5) * 2, e = q * q * (3 - 2 * q);
  return [-stride + 2 * stride * e, Math.sin(Math.PI * q) * lift];
}

interface Quad {
  len: number; hgt: number; legLen: number; legW: number; neck: number; neckUp: number; headW: number; headH: number;
  body: string; belly: string; head: string; hoof: string; tail: number;
}
const QUADS: Partial<Record<AnimalKind, Quad>> = {
  sheep: { len: 17, hgt: 11, legLen: 7, legW: 2, neck: 3, neckUp: 2, headW: 6, headH: 6, body: '#eee8dc', belly: '#d8d0c0', head: '#3a3030', hoof: '#2a2020', tail: 2 },
  cow: { len: 24, hgt: 14, legLen: 10, legW: 3, neck: 4, neckUp: 1, headW: 8, headH: 7, body: '#f2f0ea', belly: '#e0d8cc', head: '#f2f0ea', hoof: '#3a3030', tail: 6 },
  deer: { len: 19, hgt: 9, legLen: 14, legW: 2, neck: 8, neckUp: 8, headW: 6, headH: 5, body: '#b8864e', belly: '#e8d0a0', head: '#b8864e', hoof: '#3a2a20', tail: 3 },
  boar: { len: 20, hgt: 12, legLen: 6, legW: 2.6, neck: 3, neckUp: -1, headW: 9, headH: 7, body: '#5a4034', belly: '#6e5242', head: '#4a342a', hoof: '#2a2020', tail: 2 },
  wolf: { len: 20, hgt: 9, legLen: 10, legW: 2.4, neck: 5, neckUp: 2, headW: 9, headH: 6, body: '#85858c', belly: '#c4c0b8', head: '#7a7a82', hoof: '#2a2a2e', tail: 8 },
  bear: { len: 26, hgt: 17, legLen: 8, legW: 4, neck: 4, neckUp: 0, headW: 10, headH: 9, body: '#5e3e2a', belly: '#6e4a34', head: '#5a3a28', hoof: '#2a1a14', tail: 2 },
};

function quad(kind: AnimalKind, anim: AAnim, f: number): Pix {
  const q = QUADS[kind]!, { w, h, gx, gy } = A_SIZE[kind], px = new Pix(w, h);
  const n = A_FRAMES[anim], t = f / n;
  const body = R(q.body), belly = R(q.belly), head = R(q.head);
  const moving = anim === 'walk' || anim === 'run';
  const stride = (anim === 'run' ? 0.5 : 0.34) * q.legLen * (kind === 'bear' || kind === 'boar' ? 0.75 : 1), lift = anim === 'run' ? q.legLen * 0.42 : q.legLen * 0.3;
  const bob = moving ? -Math.abs(Math.sin(t * Math.PI * 2)) * (anim === 'run' ? 1.6 : 0.9) : anim === 'idle' ? (f === 2 ? 0.5 : 0) : 0;
  let dx = 0, dy = bob, headDrop = 0, fall = 0;
  if (anim === 'attack') { const k = f / (n - 1); dx = k < 0.5 ? -k * 6 : -(1 - k) * 6; headDrop = k < 0.5 ? -k * 4 : 0; }
  if (anim === 'eat') headDrop = (f === 1 || f === 2 ? 1 : 0) * (q.neckUp + q.neck * 0.8);
  if (anim === 'die') { fall = f / (n - 1); }
  const bx = gx + dx, by = gy - q.legLen - q.hgt / 2 + 1 + dy + fall * (q.legLen * 0.7);
  const shX = bx - q.len * 0.32, hipX = bx + q.len * 0.32, jy = by + q.hgt * 0.25;
  const legs = [
    { x: shX, p: t, far: false }, { x: shX - 1, p: t + 0.5, far: true }, { x: hipX, p: t + 0.5, far: false }, { x: hipX + 1, p: t, far: true },
  ];
  const drawLeg = (L: { x: number; p: number; far: boolean }): void => {
    const [fx, fl] = moving ? foot(L.p, stride, lift) : [0, 0];
    const tuck = fall * 3;
    const ax = L.x - fx, ay = gy - 1 - fl;
    const half = q.legLen / 2 + 0.3;
    const front = L.x < bx;
    const [kx, ky] = ik2(L.x, jy + fall * 2, ax + (fall ? (front ? -tuck : tuck) : 0), ay - tuck, half, half, front ? 1 : -1);
    const lr = L.far ? body.map((_, i) => body[Math.max(0, i - 1)]) : body;
    px.limb(L.x, jy + fall * 2, kx, ky, q.legW + 0.6, q.legW, lr);
    px.limb(kx, ky, ax, ay - tuck, q.legW, q.legW * 0.75, lr);
    px.rect(Math.round(ax - q.legW / 2 - 0.5), Math.round(ay - tuck), Math.round(q.legW + 1), 2, col(q.hoof));
  };
  for (const L of legs.filter(l => l.far)) drawLeg(L);
  // tail
  const wag = Math.sin(t * TAU * (anim === 'run' ? 2 : 1)) * (kind === 'wolf' ? 1.5 : 1);
  if (kind === 'wolf') px.limb(bx + q.len * 0.45, by - 1, bx + q.len * 0.45 + q.tail, by + 3 + wag + (anim === 'run' ? -3 : 0), 3.4, 2, body);
  else if (kind === 'deer') { px.blob(bx + q.len * 0.5, by - 1, 2.6, 2.8, R('#f4eee0')); }
  else if (q.tail > 1) px.limb(bx + q.len * 0.46, by - 1, bx + q.len * 0.46 + q.tail * 0.8, by + 2 + wag, 2, 1.4, kind === 'cow' ? R('#3a3030') : body);
  // torso: rump + chest blobs make a body with a waist instead of a sausage
  if (kind === 'sheep') {
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 0.62 : 0.8; px.blob(bx + Math.cos(a) * q.len * 0.38 * r, by + Math.sin(a) * q.hgt * 0.42 * r, 3.6, 3.4, body, { dither: 0.8 }); }
    px.blob(bx, by, q.len * 0.4, q.hgt * 0.4, body, { dither: 0.8 });
  } else {
    px.blob(bx, by + 0.5, q.len / 2, q.hgt / 2, body);
    px.blob(bx - q.len * 0.22, by - 0.5, q.hgt * 0.62, q.hgt * 0.56, body); // chest/shoulder
    px.blob(bx + q.len * 0.22, by, q.hgt * 0.56, q.hgt * 0.5, body);       // haunch
    px.blob(bx, by + q.hgt * 0.34, q.len * 0.36, q.hgt * 0.18, belly, { dither: 0.5 });
    if (kind === 'cow') for (const [ox, oy, rx, ry] of [[-3, -3, 4.4, 3.4], [5, 0, 3.8, 4.2], [-9, 2, 2.4, 2.8], [1, 4, 3, 2.2]]) for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) { const x = Math.round(bx + ox + xx), y = Math.round(by + oy + yy); if (px.has(x, y) && (xx / rx) ** 2 + (yy / ry) ** 2 <= 1) px.set(x, y, R('#2a2626')[(xx + yy) & 1 ? 1 : 2]); }
    if (kind === 'boar') for (let i = 0; i < 7; i++) { const x = Math.round(bx - q.len * 0.3 + i * 3.3), y = Math.round(by - q.hgt / 2 + 0.5 + (i % 2)); px.set(x, y - 1, body[0]); px.set(x, y, body[1]); }
    if (kind === 'wolf') { px.blob(bx - 2, by - 3, 8, 2.4, R('#6a6a72'), { dither: 0.5, only: (x, y) => px.has(x, y) }); }
    if (kind === 'deer') for (let i = 0; i < 6; i++) { const x = Math.round(bx - 5 + i * 2.6), y = Math.round(by - 1 + (i % 3) * 1.4); if (px.has(x, y)) px.set(x, y, col('#f4ebd8')); }
  }
  // neck + head
  const nx = bx - q.len * 0.42 - q.neck * 0.5, ny = by - q.hgt * 0.1 - q.neckUp * 0.5 + headDrop;
  const hx = bx - q.len * 0.5 - q.neck, hy = by - q.hgt * 0.1 - q.neckUp + headDrop + (anim === 'idle' && f === 1 ? -0.5 : 0);
  px.limb(bx - q.len * 0.36, by - q.hgt * 0.1, nx, ny, q.hgt * 0.55, q.hgt * 0.42, body);
  px.limb(nx, ny, hx, hy, q.hgt * 0.42, q.headH * 0.9, kind === 'sheep' ? head : body);
  px.blob(hx - 1, hy, q.headW / 2, q.headH / 2, head);
  const snout = col(kind === 'boar' ? '#3a2820' : kind === 'wolf' ? '#a8a4a0' : '#2a2424');
  if (kind === 'wolf') { px.limb(hx - 2, hy + 0.5, hx - q.headW * 0.75, hy + 1.2, 3.4, 2.2, R('#8a8a90')); px.set(Math.round(hx - q.headW * 0.78), Math.round(hy), snout); if (anim === 'attack' && f > 0) { px.rect(Math.round(hx - q.headW * 0.7), Math.round(hy + 2), 4, 1, col('#f6f0e8')); } }
  else if (kind === 'boar') { px.limb(hx - 2, hy + 1, hx - q.headW * 0.7, hy + 1.6, 4, 3.2, R('#6a4a3a')); px.set(Math.round(hx - q.headW * 0.72), Math.round(hy + 1), snout); px.line(hx - 3, hy + 3, hx - 5, hy + 1, col('#f2ead0')); px.line(hx - 4, hy + 3, hx - 6, hy + 1, col('#f2ead0')); }
  else if (kind === 'bear') { px.limb(hx - 2, hy + 1.4, hx - q.headW * 0.6, hy + 2, 4, 3.2, R('#7a5a40')); px.set(Math.round(hx - q.headW * 0.62), Math.round(hy + 1), snout); }
  else px.set(Math.round(hx - q.headW * 0.5), Math.round(hy + 1), snout);
  // ears, horns, antlers
  const ear = kind === 'wolf' ? R('#6a6a72') : body;
  px.blob(hx + 1.5, hy - q.headH * 0.55, 1.6, kind === 'wolf' ? 2.6 : 1.6, ear);
  if (kind === 'cow') { px.line(hx + 1, hy - 3, hx - 1, hy - 6, col('#e8dcc0')); px.set(Math.round(hx - 1), Math.round(hy - 7), col('#f4ecd8')); }
  if (kind === 'deer') { const a = col('#d8c8a0'), a2 = col('#b8a478'); px.line(hx + 1, hy - 3, hx + 2, hy - 9, a); px.line(hx + 2, hy - 7, hx - 1, hy - 9, a2); px.line(hx + 2, hy - 8, hx + 5, hy - 11, a); px.line(hx + 1, hy - 5, hx - 2, hy - 7, a2); px.line(hx + 2, hy - 5, hx + 5, hy - 6, a); }
  px.set(Math.round(hx - q.headW * 0.18), Math.round(hy - 0.8), col(anim === 'die' && f > 1 ? '#6a5a50' : '#120c10'));
  for (const L of legs.filter(l => !l.far)) drawLeg(L);
  px.outline(0.6, [18, 14, 24]);
  return px;
}

function rabbit(anim: AAnim, f: number): Pix {
  const { w, h, gx, gy } = A_SIZE.rabbit, px = new Pix(w, h), b = R('#b9a58c'), t = f / A_FRAMES[anim];
  const hop = anim === 'walk' || anim === 'run' ? Math.sin(t * Math.PI) : 0, y = gy - 5 - hop * 5, stretch = hop * 2;
  px.blob(gx + 1, y, 5 - stretch * 0.1, 4 + hop * 0.5, b);
  px.blob(gx + 5, y + 1, 3, 3, R('#e8e0d0'), { dither: 0.5 });  // tail
  px.blob(gx - 4 - stretch * 0.5, y - 2, 3.2, 3, b);
  px.limb(gx - 4, y - 4, gx - 5, y - 9, 1.8, 1.2, b); px.limb(gx - 3, y - 4, gx - 2, y - 9, 1.8, 1.2, R('#a89480'));
  px.set(gx - 5, y - 2, col('#120c10')); px.set(gx - 7, y - 1, col('#d89090'));
  px.limb(gx + 2, y + 2, gx + 4 + hop * 2, gy - (hop > 0.3 ? hop * 5 : 0), 2.4, 1.6, b); px.limb(gx - 2, y + 2, gx - 3 - hop * 2, gy - (hop > 0.3 ? hop * 4 : 0), 1.6, 1.2, b);
  px.outline(0.6, [24, 18, 22]); return px;
}

function chicken(anim: AAnim, f: number): Pix {
  const { w, h, gx, gy } = A_SIZE.chicken, px = new Pix(w, h), b = R('#f4f0e6'), t = f / A_FRAMES[anim];
  const walk = anim === 'walk' || anim === 'run', peck = anim === 'eat' && (f === 1 || f === 2), bob = walk ? Math.abs(Math.sin(t * TAU)) : 0;
  const y = gy - 8 - bob, [f1] = foot(t, 2, 2), [f2] = foot(t + 0.5, 2, 2);
  px.line(gx + 1, y + 4, gx + 1 - f1, gy, col('#e0a030')); px.line(gx - 1, y + 4, gx - 1 - f2, gy, col('#d09020'));
  px.set(Math.round(gx - f1 - 1), gy, col('#e0a030')); px.set(Math.round(gx - f2 - 3), gy, col('#d09020'));
  px.blob(gx, y, 5, 4.2, b); px.blob(gx + 4, y - 1, 3.2, 3, R('#e8dfc8'), { dither: 0.5 });
  const hx = gx - 4 + (peck ? -2 : 0), hy = y - 5 + (peck ? 5 : 0);
  px.blob(hx, hy, 2.6, 2.6, b); px.set(hx - 3, hy, col('#e8a020')); px.set(hx - 3, hy + 1, col('#d89010')); px.set(hx - 1, hy - 1, col('#120c10'));
  px.set(hx, hy - 3, col('#d02828')); px.set(hx + 1, hy - 3, col('#e04040')); px.set(hx - 2, hy + 2, col('#d02828'));
  px.outline(0.6, [30, 24, 20]); return px;
}

function snake(anim: AAnim, f: number): Pix {
  const { w, h, gx, gy } = A_SIZE.snake, px = new Pix(w, h), g = R('#6a8a3a'), t = f / A_FRAMES[anim];
  const moving = anim === 'walk' || anim === 'run', segs = 16;
  for (let i = segs; i >= 0; i--) {
    const u = i / segs, x = gx - 12 + u * 24, y = gy - 4 + Math.sin(u * 8 - (moving ? t * TAU : 0)) * (moving ? 3 : 1.4) * (1 - u * 0.3);
    px.blob(x, y, 2.6 - u * 1.4, 2.4 - u * 1.2, g, { dither: 0.7 }); if (i % 3 === 0) px.set(Math.round(x), Math.round(y - 1), col('#c8d060'));
  }
  px.blob(gx - 13, gy - 4 + Math.sin(-1) * 0, 3, 2.6, g); px.set(gx - 15, gy - 5, col('#f0d020')); px.set(gx - 17, gy - 3, col('#d02828'));
  px.outline(0.6, [14, 24, 14]); return px;
}

function crab(anim: AAnim, f: number): Pix {
  const { w, h, gx, gy } = A_SIZE.crab, px = new Pix(w, h), r = R('#d8482e'), t = f / A_FRAMES[anim];
  const moving = anim === 'walk' || anim === 'run', sc = moving ? Math.sin(t * TAU * 2) : 0;
  for (let i = 0; i < 3; i++) { px.line(gx - 3 - i * 1.5, gy - 5, gx - 8 - i * 1.2 + (i % 2 ? sc : -sc), gy, r[1]); px.line(gx + 3 + i * 1.5, gy - 5, gx + 8 + i * 1.2 + (i % 2 ? -sc : sc), gy, r[1]); }
  px.blob(gx, gy - 7, 6, 4, r);
  const cl = anim === 'attack' ? -3 : 0;
  px.limb(gx - 5, gy - 9, gx - 8, gy - 13 + cl, 1.6, 1.6, r); px.limb(gx + 5, gy - 9, gx + 8, gy - 13 + cl, 1.6, 1.6, r);
  px.blob(gx - 8, gy - 14 + cl, 2.4, 2.2, R('#e86a48')); px.blob(gx + 8, gy - 14 + cl, 2.4, 2.2, R('#e86a48'));
  px.set(gx - 2, gy - 12, col('#fff')); px.set(gx + 2, gy - 12, col('#fff')); px.set(gx - 2, gy - 11, col('#120c10')); px.set(gx + 2, gy - 11, col('#120c10'));
  px.outline(0.6, [40, 14, 14]); return px;
}

function bird(anim: AAnim, f: number): Pix {
  const { w, h, gx, gy } = A_SIZE.bird, px = new Pix(w, h), b = R('#6a5a4a'), t = f / A_FRAMES[anim];
  const flap = Math.sin(t * TAU), y = gy - 6 + (anim === 'fly' ? -flap * 1 : 0);
  const wing = (dir: number, shade: number[]) => { const tipY = y - 2 - flap * 9; px.poly([[gx, y - 1], [gx + dir * 15, tipY], [gx + dir * 12, tipY + 4], [gx + dir * 4, y + 2]], (x, yy) => shade[Math.max(0, Math.min(4, 1 + Math.round((Math.abs(x - gx) / 15) * 1.5 + (bayer4(x, yy) ? 0.3 : 0))))]); };
  wing(-1, R('#5a4a3c')); px.blob(gx, y, 4, 2.8, b); px.blob(gx - 4, y - 1, 2.4, 2.2, R('#7a6a58')); px.set(gx - 6, y - 1, col('#e8b020')); px.set(gx - 5, y - 2, col('#120c10'));
  px.line(gx + 4, y, gx + 8, y + 1, b[1]); wing(1, R('#7a6a58'));
  px.outline(0.6, [24, 20, 24]); return px;
}
const bayer4 = (x: number, y: number): boolean => ((x + y) & 1) === 0;

/** The dragon: wings drawn first, long body with a belly plate, horned head and a tail that follows the wingbeat. */
function dragon(anim: AAnim, f: number): Pix {
  const { w, h, gx, gy } = A_SIZE.dragon, px = new Pix(w, h), s = R('#8a2e2a'), sb = R('#d8a050'), wg = R('#a8403a'), t = f / A_FRAMES[anim];
  const flying = anim === 'fly' || anim === 'breath', flap = flying ? Math.sin(t * TAU) : Math.sin(t * TAU) * 0.15;
  const by = (flying ? gy - 40 : gy - 22) - (flying ? flap * 3 : 0), bx = gx + 4;
  const wingY = by - 8;
  const wing = (dir: number, far: boolean) => {
    const sh = far ? wg.map((_, i) => wg[Math.max(0, i - 1)]) : wg, tip = wingY - 4 - flap * 22 * (flying ? 1 : 0.25) - 12, span = 40;
    const fx = bx + dir * span * 0.55 - 4;
    const pts: [number, number][] = [[bx - 2, wingY + 2], [bx + dir * 8 - 2, wingY - 8 - flap * 6], [fx, tip], [bx + dir * span - 4, tip + 12 + flap * 8], [bx + dir * span * 0.7 - 4, wingY + 6 + flap * 3], [bx + dir * 18 - 2, wingY + 12], [bx + dir * 8 - 2, wingY + 8]];
    px.poly(pts, (x, y) => sh[Math.max(0, Math.min(4, 1 + Math.round(((y - tip) / 28) * 2 + (((x + y) & 1) ? 0.3 : -0.2))))]);
    px.line(bx - 2, wingY + 2, fx, tip, col('#4a1a18')); px.line(bx - 2, wingY + 3, bx + dir * span - 4, tip + 12 + flap * 8, col('#4a1a18')); px.line(bx - 2, wingY + 3, bx + dir * span * 0.7 - 4, wingY + 6 + flap * 3, col('#4a1a18'));
  };
  wing(1, true);
  // tail: chain of shrinking blobs
  for (let i = 12; i >= 0; i--) { const u = i / 12, x = bx + 10 + u * 34, y = by + 4 + Math.sin(u * 3 - t * TAU) * 4 + u * (flying ? 6 : 12); px.blob(x, y, 5.5 - u * 4.2, 4.8 - u * 3.8, s, { dither: 0.8 }); }
  px.blob(bx, by, 16, 9, s); px.blob(bx, by + 5, 13, 4, sb, { dither: 0.6 });
  for (let i = 0; i < 9; i++) { const x = bx - 12 + i * 3.4; px.poly([[x, by - 8], [x + 1.6, by - 12], [x + 3, by - 8]], R('#5a1a1a')[2 + (i & 1)]); }
  // legs
  const lg = (x: number, d: number) => { px.limb(x, by + 6, x + d, by + 13 + (flying ? -2 : 6), 4, 3, s); if (!flying) px.rect(Math.round(x + d - 2), by + 19, 6, 2, col('#2a1010')); else px.line(x + d, by + 11, x + d + 2, by + 14, col('#2a1010')); };
  lg(bx - 6, -1); lg(bx + 8, 1);
  // neck + head
  const nk: [number, number][] = [[bx - 12, by - 2], [bx - 20, by - 8 - (flying ? 0 : 3)], [bx - 27, by - 14 - (flying ? 0 : 2)]];
  px.limb(nk[0][0], nk[0][1], nk[1][0], nk[1][1], 8, 6, s); px.limb(nk[1][0], nk[1][1], nk[2][0], nk[2][1], 6, 5.5, s);
  const hx = nk[2][0] - 3, hy = nk[2][1] - 1, jaw = anim === 'breath' || anim === 'attack' ? (f > 0 && f < 4 ? 3 : 0) : 0;
  px.blob(hx, hy, 6, 4.2, s); px.limb(hx - 2, hy + 0.5, hx - 10, hy + 1 - jaw * 0.2, 5, 3.4, R('#9a3a32')); px.limb(hx - 2, hy + 3, hx - 9, hy + 3 + jaw, 4, 2, R('#7a2a26'));
  px.set(Math.round(hx - 1), Math.round(hy - 2), col('#ffd23a')); px.set(Math.round(hx - 2), Math.round(hy - 2), col('#ffb020'));
  px.line(hx + 2, hy - 3, hx + 8, hy - 8, col('#e8dcc0')); px.line(hx + 1, hy - 3, hx + 5, hy - 9, col('#c8bc9c'));
  if (jaw) for (let i = 0; i < 3; i++) px.set(Math.round(hx - 9 + i * 2), Math.round(hy + 2), col('#f4efe0'));
  wing(-1, false);
  px.outline(0.6, [24, 8, 12]); return px;
}

export function drawAnimal(kind: AnimalKind, anim: AAnim, frame: number): Pix {
  switch (kind) {
    case 'rabbit': return rabbit(anim, frame); case 'chicken': return chicken(anim, frame); case 'snake': return snake(anim, frame);
    case 'crab': return crab(anim, frame); case 'bird': return bird(anim, frame); case 'dragon': return dragon(anim, frame);
    default: return quad(kind, anim, frame);
  }
}
const ac = new Map<string, HTMLCanvasElement>();
export function animalFrame(kind: AnimalKind, anim: AAnim, east: boolean, frame: number): HTMLCanvasElement {
  const k = `${kind}${anim}${east ? 1 : 0}${frame}`;
  let c = ac.get(k);
  if (!c) { const p = drawAnimal(kind, anim, frame % A_FRAMES[anim]); c = (east ? p.flipH() : p).toCanvas(); ac.set(k, c); }
  return c;
}
