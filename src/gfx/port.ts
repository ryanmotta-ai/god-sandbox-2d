import { Pix, toPacked, bayer } from './pix';
import { ramp, hex, pack } from './color';
import { hash2 } from '../core/rng';
import { BDEFS, type BType } from '../sim/buildings';
import type { Race } from './humanoid';

/** Harbour buildings: pier, shipyard, fishing shack, lighthouse. Local coords like buildings.ts: x from footprint left, y up from its bottom edge. */
const OX = 8;
const rc = new Map<string, number[]>();
const R = (c: string): number[] => { let v = rc.get(c); if (!v) { v = toPacked(ramp(c, 5)); rc.set(c, v); } return v; };
const col = (h: string, a = 255): number => { const c = hex(h); return pack(c[0], c[1], c[2], a); };
const clampI = (k: number): number => Math.max(0, Math.min(4, Math.round(k)));

const WOOD: Record<Race, string> = { human: '#9a6e40', elf: '#d8cdaa', dwarf: '#5e5a56', orc: '#4a3426' };
const ROOF: Record<Race, string> = { human: '#b0503c', elf: '#4a9c70', dwarf: '#4e5462', orc: '#7e3a2c' };

class C {
  px: Pix;
  constructor(public w: number, public h: number) { this.px = new Pix(w, h); }
  X(x: number): number { return OX + x; }
  Y(y: number): number { return this.h - 8 - y; }
  set(x: number, y: number, c: number): void { this.px.set(this.X(x), this.Y(y), c); }
  rect(x: number, y: number, w: number, h: number, c: number): void { this.px.rect(this.X(x), this.Y(y + h - 1), w, h, c); }
}

/** Deck planking over a rectangle, boards running north–south, with nail rows and wear. */
function deck(c: C, x: number, y: number, w: number, h: number, wood: string, seed: number): void {
  const wp = R(wood);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const bx = Math.floor(i / 5), seam = i % 5 === 0;
    let k = 2.6 + (hash2(bx, 3 + seed, 5) - 0.5) * 1.1 + (bayer(x + i, y + j) - 0.5) * 0.4 - (seam ? 1.2 : 0) + (j > h - 3 ? 0.5 : 0) - (j < 2 ? 0.7 : 0);
    if (hash2(bx, Math.floor(j / 9), seed + 8) > 0.8 && j % 9 === 0) k -= 0.9; // butt joints
    c.set(x + i, y + j, wp[clampI(k)]);
  }
}
/** Piles under the front edge and a beam above them: what a pier stands on. */
function pilings(c: C, x: number, w: number, wood: string): void {
  const wp = R(wood);
  c.rect(x - 1, -3, w + 2, 3, wp[1]); for (let i = -1; i < w + 1; i++) { c.set(x + i, -1, wp[0]); c.set(x + i, 0, wp[3]); }
  for (let px = x + 2; px < x + w - 1; px += 12) { c.rect(px, -6, 3, 7, wp[2]); c.rect(px, -6, 1, 7, wp[4]); c.rect(px + 2, -6, 1, 7, wp[0]); c.rect(px - 1, -7, 5, 1, col('#0a2a50', 90)); }
}
function bollard(c: C, x: number, y: number): void { c.rect(x, y, 4, 4, R('#4a4e58')[2]); c.rect(x, y + 3, 4, 1, R('#8a94a4')[3]); c.rect(x - 1, y - 1, 6, 1, col('#00000044')); }
function rope(c: C, x: number, y: number): void { for (let a = 0; a < 18; a++) { const rx = x + Math.cos(a / 18 * 6.283) * 4, ry = y + Math.sin(a / 18 * 6.283) * 2.5; c.set(Math.round(rx), Math.round(ry), R('#c8b078')[(a % 3) + 1]); } }
function crate(c: C, x: number, y: number, s = 7): void { const w = R('#a07a48'); c.rect(x, y, s, s, w[2]); c.rect(x, y + s - 1, s, 1, w[4]); c.rect(x + s - 1, y, 1, s, w[0]); for (let i = 0; i < s; i++) c.set(x + i, y + i, w[1]); }
function barrel(c: C, x: number, y: number): void { c.px.blob(c.X(x + 3), c.Y(y + 4), 3.6, 4.8, R('#8a5a30'), { dither: 0.3 }); for (const dy of [2, 6]) for (let i = 0; i < 7; i++) c.set(x + i, y + dy, col('#33343a')); }
function lantern(c: C, x: number, y: number, h: number, wood: string): void {
  const wp = R(wood);
  c.rect(x, y, 2, h, wp[2]); c.rect(x, y, 1, h, wp[4]); c.rect(x - 2, y + h, 6, 1, wp[1]);
  c.rect(x - 1, y + h + 1, 4, 4, col('#ffd36a')); c.rect(x - 1, y + h + 1, 4, 1, col('#fff2b0')); c.rect(x - 2, y + h + 5, 6, 1, wp[0]);
}
const crane = (c: C, x: number, y: number, wood: string): void => {
  const wp = R(wood);
  c.rect(x, y, 4, 34, wp[2]); c.rect(x, y, 1, 34, wp[4]);
  c.px.limb(c.X(x + 2), c.Y(y + 33), c.X(x + 24), c.Y(y + 24), 3, 2.4, wp); c.px.line(c.X(x + 2), c.Y(y + 3), c.X(x + 14), c.Y(y + 27), wp[1]);
  c.px.line(c.X(x + 24), c.Y(y + 24), c.X(x + 24), c.Y(y + 10), R('#c8b078')[2]); c.rect(x + 22, y + 6, 5, 4, col('#5a5e68'));
};

export function paintPort(type: BType, race: Race, h: number): Pix | null {
  const d = BDEFS[type], W = d.w * 32, c = new C(W + 16, h), wood = WOOD[race], wp = R(wood), roof = R(ROOF[race]);
  switch (type) {
    case 'dock': {
      deck(c, 0, 0, W, d.h * 32, wood, 1); pilings(c, 0, W, wood);
      // rails along the back, mooring gear on the planks
      for (let i = 0; i < W; i += 16) { c.rect(i, d.h * 32 - 2, 3, 9, wp[2]); c.rect(i, d.h * 32 - 2, 1, 9, wp[4]); }
      c.rect(0, d.h * 32 + 5, W, 2, wp[3]); c.rect(0, d.h * 32 + 4, W, 1, wp[1]);
      bollard(c, 8, 4); bollard(c, W - 14, 4); bollard(c, W / 2, 4); rope(c, 22, 14);
      crate(c, W - 24, 24, 8); crate(c, W - 14, 26, 7); crate(c, W - 22, 33, 7); barrel(c, 12, 28); barrel(c, 22, 34);
      lantern(c, W - 6, 8, 26, wood); crane(c, 38, d.h * 32 - 6, wood);
      // hanging fish
      for (let i = 0; i < 5; i++) { c.set(30 + i * 2, 48, col('#d8dce8')); c.set(30 + i * 2, 47, col('#8a94a4')); }
      break;
    }
    case 'shipyard': {
      const D = d.h * 32;
      deck(c, 0, 0, W, D, wood, 2); pilings(c, 0, W, wood);
      // a hull on the stocks: ribs, strakes laid from the keel up
      const hx = 12, hy = 16, hl = W - 34, hh = 18;
      for (let i = 0; i < hl; i++) { const u = i / hl, top = Math.round(hh * (0.55 + 0.45 * Math.sin(u * Math.PI)) + Math.pow(u, 3) * 8); const done = i < hl * 0.62; for (let j = 0; j < top; j++) { const strake = j % 3 === 0; if (done) c.set(hx + i, hy + j, wp[clampI(2.4 - j * 0.04 + (strake ? -0.9 : 0) + (bayer(i, j) - 0.5) * 0.4)]); else if (i % 8 === 0) c.set(hx + i, hy + j, wp[4]); } c.set(hx + i, hy - 1, R('#3a2616')[2]); }
      for (let i = 0; i < hl; i += 8) c.px.line(c.X(hx + i), c.Y(hy), c.X(hx + i), c.Y(hy + 18), wp[4]);
      // cradle, scaffold, and a roofed work shed at the back
      for (let i = 4; i < hl; i += 20) { c.rect(hx + i, hy - 4, 3, 5, R('#6a4a28')[2]); }
      for (const sx of [hx - 4, hx + hl + 1]) { c.rect(sx, hy, 3, 34, wp[2]); for (let y = hy + 6; y < hy + 34; y += 9) c.rect(sx, y, 14, 2, wp[3]); }
      const shx = W - 30, shy = D - 8; c.rect(shx, shy, 26, 18, wp[2]); for (let y = 0; y < 18; y += 3) c.rect(shx, shy + y, 26, 1, wp[1]); c.px.poly([[c.X(shx - 3), c.Y(shy + 18)], [c.X(shx + 13), c.Y(shy + 30)], [c.X(shx + 29), c.Y(shy + 18)]], (x, y) => roof[(x + y) & 1 ? 2 : 1]); c.rect(shx + 8, shy, 10, 11, col('#1e1410'));
      crane(c, 4, D - 6, wood); lantern(c, W - 5, 4, 24, wood); barrel(c, 4, 6); crate(c, W - 16, 6);
      for (let i = 0; i < 4; i++) c.rect(hx + 8 + i * 9, hy - 8, 5, 3, wp[3]); // stacked planks
      break;
    }
    case 'fishhut': {
      const wx = 6, ww = W - 14, wallH = 22;
      // stone footing and plank walls
      c.rect(wx - 1, 0, ww + 2, 4, R('#8a8880')[2]);
      for (let j = 4; j < wallH; j++) for (let i = 0; i < ww; i++) { const lx = i % 5; let k = 2.2 - (i / ww) * 0.9 + (bayer(wx + i, j) - 0.5) * 0.4 + (lx === 0 ? -1.2 : lx === 1 ? 0.4 : 0) + (hash2(Math.floor(i / 5), 2, 7) - 0.5) * 0.9; if (j < 7) k -= 0.6; c.set(wx + i, j, wp[clampI(k)]); }
      for (let j = 4; j < wallH; j++) { for (let i = 0; i < 6; i++) c.set(wx + ww + i, j, wp[clampI(1.1 - i * 0.12 + (bayer(i, j) - 0.5) * 0.4)]); }
      c.px.poly([[c.X(wx - 4), c.Y(wallH)], [c.X(wx + ww / 2 + 2), c.Y(wallH + 24)], [c.X(wx + ww + 10), c.Y(wallH)]], (x, y) => { const ly = c.h - 8 - y - wallH; return roof[clampI(2.4 - (x - OX) * 0.012 + ly * 0.03 + (hash2(Math.floor((x - OX) / 4), Math.floor(ly / 3), 9) - 0.5) * 0.9 + (bayer(x, y) - 0.5) * 0.4)]; });
      c.rect(wx + ww / 2 - 5, 4, 10, 14, R('#4a3220')[2]); c.rect(wx + 6, 10, 7, 7, col('#ffd36a')); c.rect(wx + 9, 10, 1, 7, wp[1]);
      // drying rack with fish, net on a pole, an upturned boat, floats on the wall
      for (const rx of [wx + ww + 8, wx + ww + 26]) c.rect(rx, 2, 2, 20, wp[2]); c.rect(wx + ww + 8, 20, 20, 2, wp[3]);
      for (let i = 0; i < 6; i++) { const fx = wx + ww + 10 + i * 3; c.rect(fx, 13, 2, 7, R('#9aa4b4')[3]); c.set(fx, 19, R('#cfd8e4')[4]); c.set(fx, 13, col('#c8452a')); }
      c.px.poly([[c.X(wx - 2), c.Y(6)], [c.X(wx + 16), c.Y(6)], [c.X(wx + 8), c.Y(15)]], (x, y) => wp[clampI(2 + (bayer(x, y) - 0.5) * 0.6 - (y - 20) * 0.05)]);
      for (let i = 0; i < 4; i++) c.px.blob(c.X(wx + 14 + i * 3), c.Y(21), 1.4, 1.4, R('#e8dcc0'), { dither: 0.2 });
      barrel(c, wx + ww - 10, 0);
      c.rect(wx - 3, 0, 1, 1, 0);
      break;
    }
    case 'lighthouse': {
      const bx = 14, bw = 36, topW = 22, H0 = 96;
      for (let j = 0; j < H0; j++) {
        const t = j / H0, w = Math.round(bw + (topW - bw) * t), x0 = bx + Math.round((bw - w) / 2);
        for (let i = 0; i < w; i++) { const u = i / w, band = Math.floor(j / 16) % 2 === 0; const base = band ? R('#d8423a') : R('#f0ece0'); let k = 2.6 - u * 1.5 + (bayer(x0 + i, j) - 0.5) * 0.45 + (j % 5 === 0 ? -0.4 : 0); c.set(x0 + i, 8 + j, base[clampI(k)]); }
      }
      // rocks at the foot
      for (let a = 0; a < 9; a++) c.px.blob(c.X(8 + a * 6), c.Y(4 + (a % 2) * 3), 5, 4, R('#7a7870'), { dither: 0.5 });
      // gallery, lantern room, cap
      const gy = 8 + H0, gx = bx + (bw - topW) / 2;
      c.rect(gx - 5, gy, topW + 10, 3, R('#3c3e46')[2]); for (let i = -5; i < topW + 5; i += 4) c.rect(gx + i, gy + 3, 1, 6, R('#3c3e46')[3]); c.rect(gx - 5, gy + 9, topW + 10, 1, R('#3c3e46')[3]);
      c.rect(gx + 2, gy + 3, topW - 4, 14, col('#ffe9a0')); c.rect(gx + 2, gy + 3, topW - 4, 2, col('#fff6cc')); for (let i = 2; i < topW - 2; i += 6) c.rect(gx + i, gy + 3, 1, 14, R('#3c3e46')[2]);
      c.px.poly([[c.X(gx), c.Y(gy + 17)], [c.X(gx + topW / 2), c.Y(gy + 28)], [c.X(gx + topW), c.Y(gy + 17)]], (x, y) => R('#b02a28')[((x + y) & 1) ? 2 : 1]); c.set(gx + topW / 2, gy + 29, col('#e8c24a'));
      c.rect(bx + bw / 2 - 4, 8, 8, 14, R('#4a3220')[2]);
      break;
    }
    default: return null;
  }
  c.px.outline(0.55, [20, 16, 24]);
  return c.px;
}
