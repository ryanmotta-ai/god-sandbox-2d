import { Pix, toPacked, bayer } from './pix';
import { ramp, hex, pack } from './color';
import { hash2, Rng } from '../core/rng';
import { BDEFS, type BType } from '../sim/buildings';
import type { Race } from './humanoid';

/**
 * Procedural buildings, painted facade-first in a 3/4 view: front wall, roof band above it, a sliver of
 * side wall to the right for depth. Every type is composed from the same few verbs (wall, roof, door,
 * window, props) and re-skinned per race — plaster-and-timber humans, ivory-and-leaf elves,
 * stone-and-iron dwarves, plank-and-bone orcs.
 */
const rc = new Map<string, number[]>();
const R = (c: string, n = 5): number[] => { const k = c + n; let v = rc.get(k); if (!v) { v = toPacked(ramp(c, n)); rc.set(k, v); } return v; };
const col = (h: string): number => { const c = hex(h); return pack(c[0], c[1], c[2]); };

interface Style {
  wall: string; wallKind: 'plaster' | 'stone' | 'planks' | 'ivory';
  beam: string; roof: string; roofKind: 'trap' | 'tri' | 'flat';
  trim: string; glow: string; door: string; deco: 'none' | 'vine' | 'iron' | 'bone';
}
const STYLES: Record<Race, Style> = {
  human: { wall: '#d6c6a0', wallKind: 'plaster', beam: '#5a3e28', roof: '#b0503c', roofKind: 'trap', trim: '#e8dcc0', glow: '#ffd36a', door: '#6a4428', deco: 'none' },
  elf: { wall: '#ece4d0', wallKind: 'ivory', beam: '#8a6a40', roof: '#4a9c70', roofKind: 'tri', trim: '#f4efdc', glow: '#b8ffd8', door: '#7a5a38', deco: 'vine' },
  dwarf: { wall: '#85837c', wallKind: 'stone', beam: '#3c404a', roof: '#4e5462', roofKind: 'flat', trim: '#a8a69c', glow: '#ff9a3a', door: '#4a3828', deco: 'iron' },
  orc: { wall: '#6e4e34', wallKind: 'planks', beam: '#3a2a1c', roof: '#7e3a2c', roofKind: 'tri', trim: '#d8cfb4', glow: '#ff6a2a', door: '#3a281c', deco: 'bone' },
};

const OX = 8; // left margin in the sprite
export const bSize = (type: BType): { w: number; h: number } => { const d = BDEFS[type]; return { w: d.w * 32 + 16, h: d.h * 32 + 72 }; };

/* ---- painter verbs (local coords: x from footprint left, y up from footprint bottom) -------------------- */
class Canvas {
  px: Pix;
  constructor(public type: BType) { const s = bSize(type); this.px = new Pix(s.w, s.h); }
  X(x: number): number { return OX + x; }
  Y(y: number): number { return this.px.h - 8 - y; }
  set(x: number, y: number, c: number): void { this.px.set(this.X(x), this.Y(y), c); }
}

function wallFill(c: Canvas, x: number, y: number, w: number, h: number, st: Style): void {
  const wr = R(st.wall), bm = R(st.beam);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = x + i, py = y + j, shade = 2.3 - (i / w) * 1.1 - (j / h) * 0.2 - (j < 3 ? 0.7 : 0) - (j > h - 4 ? 0.5 : 0);
    let k = shade + (bayer(px, py) - 0.5) * 0.7, base = wr;
    switch (st.wallKind) {
      case 'stone': { const row = Math.floor(py / 7), off = (row & 1) * 6, lx = (px + off) % 12, ly = py % 7; if (lx === 0 || ly === 0) { k -= 1.7; } else if (ly === 1) k += 0.7; k += (hash2(Math.floor((px + off) / 12), row, 5) - 0.5) * 1.3; break; }
      case 'planks': { const lx = px % 5; if (lx === 0) k -= 1.5; else if (lx === 1) k += 0.5; k += (hash2(Math.floor(px / 5), 3, 7) - 0.5) * 1.1; if (hash2(px, Math.floor(py / 4), 2) > 0.93) k -= 1; break; }
      case 'ivory': { k += (hash2(px >> 1, py >> 1, 3) - 0.5) * 0.4; if (py % 10 === 0) k -= 0.5; break; }
      default: { k += (hash2(px, py, 4) - 0.5) * 0.5; }
    }
    c.set(px, py, base[Math.max(0, Math.min(4, Math.round(k)))]);
  }
  if (st.wallKind === 'plaster') { // half-timbering: frame, posts and diagonals
    for (let i = 0; i < w; i++) { c.set(x + i, y + h - 2, bm[2]); c.set(x + i, y + h - 3, bm[1]); c.set(x + i, y, bm[1]); c.set(x + i, y + 1, bm[2]); }
    for (let px = x; px < x + w; px += Math.max(12, Math.floor(w / 4))) for (let j = 0; j < h; j++) { c.set(px, y + j, bm[1]); c.set(px + 1, y + j, bm[2]); }
    for (let j = 0; j < h - 6; j++) c.set(x + 3 + Math.round(j * 0.55), y + 2 + j, bm[1]);
  }
  if (st.wallKind === 'stone' || st.wallKind === 'planks') for (let j = 0; j < h; j++) { c.set(x, y + j, R(st.beam)[2]); c.set(x + w - 1, y + j, R(st.beam)[0]); }
  // contact shadow
  for (let i = 0; i < w + 4; i++) { c.set(x - 2 + i, y - 1, col('#00000055')); }
}

function sideWall(c: Canvas, x: number, y: number, w: number, h: number, st: Style): void {
  const wr = R(st.wall);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = 0.9 - i / w * 0.5 + (bayer(x + i, y + j) - 0.5) * 0.6 + (st.wallKind === 'stone' && ((y + j) % 7 === 0) ? -1 : 0);
    c.set(x + i, y + j, wr[Math.max(0, Math.min(4, Math.round(k)))]);
  }
}

function roofShape(c: Canvas, x0: number, x1: number, baseY: number, h: number, st: Style, over = 5): void {
  const rr = R(st.roof), peak = (x0 + x1) / 2;
  const kind = st.roofKind;
  const inset = kind === 'tri' ? (x1 - x0) / 2 : kind === 'flat' ? 8 : Math.min(18, (x1 - x0) * 0.22);
  const pts: [number, number][] = [[c.X(x0 - over), c.Y(baseY)], [c.X(x0 + inset), c.Y(baseY + h)], [c.X(x1 - inset), c.Y(baseY + h)], [c.X(x1 + over), c.Y(baseY)]];
  c.px.poly(pts, (px, py) => {
    const ly = c.px.h - 8 - py - baseY, lx = px - OX;
    const row = Math.floor(ly / 4), off = (row & 1) * 3, cell = Math.floor((lx + off) / 6);
    let k = 2.2 - ((lx - x0) / (x1 - x0)) * 1.1 + (ly / h) * 0.9 + (hash2(cell, row, 6) - 0.5) * 0.7 + (bayer(px, py) - 0.5) * 0.4;
    const edge = (ly % 4 === 0) ? -1.1 : (ly % 4 === 3 ? 0.4 : 0);
    if (kind === 'tri' && st.deco === 'vine') k += Math.sin(lx * 0.9 + row) * 0.3;
    return rr[Math.max(0, Math.min(4, Math.round(k + edge)))];
  });
  // ridge highlight + eave shadow
  for (let i = x0 + inset; i <= x1 - inset; i++) c.set(i, baseY + h, rr[4]);
  for (let i = x0 - over; i <= x1 + over; i++) { c.set(i, baseY - 1, col('#1a121866')); c.set(i, baseY - 2, col('#1a121844')); }
  if (st.deco === 'bone') for (let i = x0 + inset; i <= x1 - inset; i += 6) { c.set(i, baseY + h + 1, col('#e8dfc4')); c.set(i, baseY + h + 2, col('#e8dfc4')); c.set(i, baseY + h + 3, col('#fff6dc')); }
  void peak;
}

function door(c: Canvas, x: number, y: number, w: number, h: number, st: Style, arch = false): void {
  const dr = R(st.door, 4), fr = R(st.beam);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (arch && j > h - 5 && (i < (h - j) * 0.9 || i >= w - (h - j) * 0.9)) continue;
    const k = 1.7 - (i / w) * 1.2 + ((i + x) % 3 === 0 ? -0.5 : 0) + (bayer(x + i, y + j) - 0.5) * 0.4;
    c.set(x + i, y + j, dr[Math.max(0, Math.min(3, Math.round(k)))]);
  }
  for (let j = 0; j < h; j++) { c.set(x - 1, y + j, fr[1]); c.set(x + w, y + j, fr[0]); }
  for (let i = -1; i <= w; i++) c.set(x + i, y + h, fr[3]);
  c.set(x + w - 3, y + Math.floor(h / 2), col('#e8c24a'));
  for (let i = -2; i < w + 2; i++) c.set(x + i, y - 1, R(st.trim)[1]); // step
}

function windowAt(c: Canvas, x: number, y: number, w: number, h: number, st: Style, lit: boolean, arch = false): void {
  const g = R(st.glow), fr = R(st.beam);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (arch && j > h - 3 && (i === 0 || i === w - 1)) continue;
    const k = lit ? 2.6 - (j / h) * 1.2 : 0.5 + (i / w) * 0.4;
    c.set(x + i, y + j, lit ? g[Math.max(0, Math.min(4, Math.round(k)))] : R('#4a6a8a')[Math.round(1 + (1 - j / h) * 1.4)]);
  }
  c.set(x + Math.floor(w / 2), y + Math.floor(h / 2), fr[2]);
  for (let j = 0; j < h; j++) { c.set(x + Math.floor(w / 2), y + j, fr[2]); }
  for (let i = -1; i <= w; i++) { c.set(x + i, y - 1, R(st.trim)[2]); c.set(x + i, y + h, fr[2]); }
  for (let j = 0; j < h; j++) { c.set(x - 1, y + j, fr[1]); c.set(x + w, y + j, fr[0]); }
  if (st.deco === 'vine') { c.set(x - 1, y - 2, col('#4a9a40')); c.set(x + w, y - 2, col('#4a9a40')); }
}

function chimney(c: Canvas, x: number, baseY: number, h: number, st: Style): void {
  const sr = R(st.wallKind === 'stone' ? '#6a6862' : '#8a6a5a');
  for (let j = 0; j < h; j++) for (let i = 0; i < 7; i++) c.set(x + i, baseY + j, sr[Math.max(0, Math.min(4, Math.round(2.4 - i * 0.3 + (j % 5 === 0 ? -0.8 : 0) + (bayer(x + i, j) - 0.5) * 0.4)))]);
  for (let i = -1; i < 8; i++) { c.set(x + i, baseY + h, sr[3]); c.set(x + i, baseY + h + 1, sr[1]); }
}

function crate(c: Canvas, x: number, y: number, s = 6): void {
  const w = R('#9a6a3a');
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) c.set(x + i, y + j, w[(i === 0 || j === 0 || i === s - 1 || j === s - 1) ? 1 : (i + j) % 3 === 0 ? 3 : 2]);
  for (let i = 0; i < s; i++) c.set(x + i, y + i, w[0]);
}
function barrel(c: Canvas, x: number, y: number): void { c.px.blob(c.X(x + 3), c.Y(y + 4), 3.4, 4.6, R('#8a5a30')); for (const dy of [2, 6]) for (let i = 0; i < 7; i++) c.set(x + i, y + dy, col('#3a3a40')); }
function logs(c: Canvas, x: number, y: number): void { for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { c.px.blob(c.X(x + 3 + i * 5 + r * 2.5), c.Y(y + 2.5 + r * 4.5), 2.8, 2.8, R('#9a6a3c')); c.set(x + 3 + i * 5 + r * 2.5 - 1, y + 2 + r * 4, col('#d8b078')); } }
function hay(c: Canvas, x: number, y: number): void { c.px.blob(c.X(x + 7), c.Y(y + 5), 7, 5.4, R('#d8b040')); for (let i = 0; i < 14; i++) c.set(x + 1 + i, y + 2 + (i * 7) % 6, col('#f4d874')); }
function flowers(c: Canvas, x: number, y: number, w: number): void { for (let i = 0; i < w; i += 3) { c.set(x + i, y, col(['#e0404a', '#f2c230', '#fff'][i % 3])); c.set(x + i, y - 1, col('#3a8a34')); } }

function stoneBase(c: Canvas, x: number, y: number, w: number, h: number): void {
  const s = R('#8a8880');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const row = Math.floor((y + j) / 5), off = (row & 1) * 5; const mortar = (y + j) % 5 === 0 || (x + i + off) % 10 === 0; c.set(x + i, y + j, mortar ? s[0] : s[2 + ((x + i + j) % 5 === 0 ? 1 : 0) - (i > w * 0.8 ? 1 : 0)]); }
}

/* ---- the buildings --------------------------------------------------------------------------------------- */
function paint(type: BType, race: Race): Pix {
  const c = new Canvas(type), st = STYLES[race], d = BDEFS[type], W = d.w * 32, rng = new Rng(7 + type.length);
  const arch = race === 'elf';
  switch (type) {
    case 'campfire': {
      const s = R('#8a8880');
      for (let a = 0; a < 8; a++) { const x = 16 + Math.cos(a / 8 * 6.283) * 9, y = 6 + Math.sin(a / 8 * 6.283) * 4.5; c.px.blob(c.X(x), c.Y(y), 3.2, 2.6, s); }
      c.px.limb(c.X(10), c.Y(5), c.X(22), c.Y(7), 3.4, 3.4, R('#7a4a28')); c.px.limb(c.X(11), c.Y(8), c.X(21), c.Y(4), 3.4, 3.4, R('#8a5a30'));
      break;
    }
    case 'hut': {
      const wallH = 22, wx = 6, ww = W - 12;
      stoneBase(c, wx - 1, 0, ww + 2, 5);
      wallFill(c, wx, 5, ww, wallH - 5, st); sideWall(c, wx + ww, 5, 5, wallH - 5, st);
      roofShape(c, wx - 1, wx + ww + 5, wallH, 26, st, 5);
      door(c, wx + Math.floor(ww / 2) - 4, 5, 8, 14, st, arch); windowAt(c, wx + 5, 11, 6, 6, st, true, arch);
      if (race === 'human') chimney(c, wx + ww - 14, wallH + 8, 10, st);
      if (race === 'orc') { c.px.limb(c.X(wx + 4), c.Y(wallH + 6), c.X(wx + 1), c.Y(wallH + 14), 2, 1, R('#d8cfb4')); }
      flowers(c, wx + 3, 4, 10);
      break;
    }
    case 'house': {
      const wallH = 36, wx = 6, ww = W - 14;
      stoneBase(c, wx - 1, 0, ww + 2, 7);
      wallFill(c, wx, 7, ww, wallH - 7, st); sideWall(c, wx + ww, 7, 7, wallH - 7, st);
      roofShape(c, wx - 2, wx + ww + 7, wallH, 34, st, 6);
      door(c, wx + Math.floor(ww / 2) - 5, 7, 10, 18, st, arch);
      windowAt(c, wx + 8, 17, 8, 9, st, true, arch); windowAt(c, wx + ww - 16, 17, 8, 9, st, true, arch);
      windowAt(c, wx + Math.floor(ww / 2) - 4, wallH - 12, 8, 7, st, race !== 'dwarf', arch);
      chimney(c, wx + ww - 20, wallH + 14, 12, st);
      flowers(c, wx + 6, 6, 14); barrel(c, wx + ww - 6, 0);
      break;
    }
    case 'storehouse': {
      const wallH = 30, wx = 6, ww = W - 14;
      stoneBase(c, wx - 1, 0, ww + 2, 5);
      wallFill(c, wx, 5, ww, wallH - 5, st); sideWall(c, wx + ww, 5, 7, wallH - 5, st);
      roofShape(c, wx - 2, wx + ww + 7, wallH, 24, st, 5);
      door(c, wx + Math.floor(ww / 2) - 11, 5, 22, 20, st, arch);
      for (let j = 0; j < 20; j++) c.set(wx + Math.floor(ww / 2), 5 + j, R(st.beam)[1]);
      crate(c, wx + 3, 0); crate(c, wx + 11, 0, 5); hay(c, wx + ww - 18, 0); barrel(c, wx + ww - 4, 0);
      break;
    }
    case 'lumber': {
      const wx = 6, ww = W - 12, wallH = 22;
      wallFill(c, wx, 4, ww, wallH - 4, st); sideWall(c, wx + ww, 4, 5, wallH - 4, st);
      roofShape(c, wx - 3, wx + ww + 5, wallH, 18, { ...st, roofKind: 'trap' }, 5);
      for (let j = 0; j < 14; j++) c.set(wx + 10, 4 + j, col('#2a1a10'));
      c.px.rect(c.X(wx + 8), c.Y(14), 18, 12, col('#1e1410'));
      logs(c, wx + ww - 20, 0); logs(c, wx - 2, 0);
      c.px.limb(c.X(wx + 14), c.Y(18), c.X(wx + 24), c.Y(8), 2, 2, R('#a0a8b4')); // saw blade
      break;
    }
    case 'farm': {
      // fence posts + scarecrow; the crops themselves are an overlay (see cropOverlay)
      const fp = R('#8a6a40');
      for (let i = 0; i <= W; i += 12) for (let j = 0; j < 7; j++) { c.set(i, j + 2, fp[2]); c.set(i + 1, j + 2, fp[1]); }
      for (let i = 0; i < W; i++) { c.set(i, 6, fp[3]); c.set(i, 4, fp[1]); }
      const sx = W - 14;
      c.px.limb(c.X(sx), c.Y(2), c.X(sx), c.Y(22), 2, 2, R('#8a6a40')); c.px.limb(c.X(sx - 7), c.Y(17), c.X(sx + 7), c.Y(17), 2, 2, R('#8a6a40'));
      c.px.blob(c.X(sx), c.Y(25), 3.6, 3.6, R('#e0c890')); c.px.blob(c.X(sx), c.Y(29), 5.5, 2, R('#d8b25a')); c.px.blob(c.X(sx), c.Y(15), 3.4, 4.5, R('#7a5a8a'));
      break;
    }
    case 'barracks': {
      const wallH = 38, wx = 6, ww = W - 14;
      const sd: Style = { ...st, wallKind: race === 'orc' ? 'planks' : 'stone', wall: race === 'human' ? '#8e8c86' : st.wall };
      stoneBase(c, wx - 1, 0, ww + 2, 7);
      wallFill(c, wx, 7, ww, wallH - 7, sd); sideWall(c, wx + ww, 7, 7, wallH - 7, sd);
      roofShape(c, wx - 2, wx + ww + 7, wallH, 24, { ...sd, roofKind: 'trap', roof: race === 'orc' ? '#5a2a22' : race === 'elf' ? '#3a7a5a' : '#5a5e6c' }, 6);
      door(c, wx + Math.floor(ww / 2) - 7, 7, 14, 20, sd, arch);
      windowAt(c, wx + 8, 22, 6, 8, sd, false, arch); windowAt(c, wx + ww - 14, 22, 6, 8, sd, false, arch);
      // weapon rack and dummy
      for (let k = 0; k < 4; k++) c.px.line(c.X(wx + 6 + k * 3), c.Y(1), c.X(wx + 7 + k * 3), c.Y(15), col('#8a6a40'));
      for (let k = 0; k < 4; k++) c.set(wx + 7 + k * 3, 16, col('#c8d0dc'));
      c.px.limb(c.X(wx + ww - 8), c.Y(1), c.X(wx + ww - 8), c.Y(16), 2, 2, R('#8a6a40')); c.px.blob(c.X(wx + ww - 8), c.Y(17), 3, 3, R('#d8c890')); c.px.limb(c.X(wx + ww - 13), c.Y(12), c.X(wx + ww - 3), c.Y(12), 2, 2, R('#8a6a40'));
      break;
    }
    case 'tower': {
      const wx = 12, ww = W - 24, wallH = 64;
      const sd: Style = { ...st, wallKind: 'stone', wall: race === 'elf' ? '#e4dcc8' : race === 'orc' ? '#6a5a4a' : '#8c8a84' };
      stoneBase(c, wx - 3, 0, ww + 6, 8);
      wallFill(c, wx, 8, ww, wallH - 8, sd); sideWall(c, wx + ww, 8, 6, wallH - 8, sd);
      // battlements
      const sr = R(sd.wall);
      for (let i = -3; i < ww + 9; i += 6) for (let j = 0; j < 6; j++) for (let k = 0; k < 4; k++) c.set(wx + i + k, wallH + j, sr[j === 5 ? 4 : 2 - (k > 2 ? 1 : 0)]);
      for (let i = -3; i < ww + 9; i++) c.set(wx + i, wallH - 1, sr[0]);
      door(c, wx + Math.floor(ww / 2) - 4, 8, 8, 13, sd, true);
      windowAt(c, wx + Math.floor(ww / 2) - 2, 34, 5, 9, sd, false, true); windowAt(c, wx + Math.floor(ww / 2) - 2, 48, 5, 7, sd, false, true);
      break;
    }
    case 'temple': {
      const wallH = 34, wx = 8, ww = W - 18;
      const sd: Style = { ...st, wallKind: 'ivory', wall: race === 'orc' ? '#8a7a6a' : race === 'dwarf' ? '#a8a69c' : '#e8e2d0' };
      stoneBase(c, wx - 3, 0, ww + 6, 6);
      wallFill(c, wx, 6, ww, wallH - 6, sd); sideWall(c, wx + ww, 6, 7, wallH - 6, sd);
      roofShape(c, wx - 3, wx + ww + 8, wallH, 26, { ...sd, roofKind: 'tri', roof: race === 'orc' ? '#4a2a28' : race === 'dwarf' ? '#6a5a40' : '#7a9ac8' }, 6);
      for (const px of [wx + 4, wx + ww - 9]) { const pr = R('#f0ece0'); for (let j = 0; j < wallH - 6; j++) for (let i = 0; i < 6; i++) c.set(px + i, 6 + j, pr[Math.max(0, Math.min(4, Math.round(3.2 - i * 0.55 + (bayer(px + i, j) - 0.5) * 0.4)))]); }
      door(c, wx + Math.floor(ww / 2) - 5, 6, 10, 18, sd, true);
      c.px.blob(c.X(wx + ww / 2), c.Y(wallH + 24), 4, 4, R('#ffe08a'), { dither: 0.3 });
      break;
    }
    case 'hall': {
      const wallH = 44, wx = 8, ww = W - 18;
      stoneBase(c, wx - 2, 0, ww + 4, 9);
      wallFill(c, wx, 9, ww, wallH - 9, st); sideWall(c, wx + ww, 9, 8, wallH - 9, st);
      roofShape(c, wx - 3, wx + ww + 8, wallH, 36, st, 7);
      door(c, wx + Math.floor(ww / 2) - 8, 9, 16, 24, st, arch);
      for (let i = 0; i < 4; i++) for (let k = -2; k < 18; k++) c.set(wx + Math.floor(ww / 2) - 9 + k, 8 - i * 0, R(st.trim)[2]);
      windowAt(c, wx + 9, 24, 8, 10, st, true, arch); windowAt(c, wx + ww - 17, 24, 8, 10, st, true, arch);
      windowAt(c, wx + Math.floor(ww / 2) - 4, wallH - 14, 8, 8, st, true, arch);
      chimney(c, wx + 10, wallH + 18, 14, st); chimney(c, wx + ww - 18, wallH + 18, 14, st);
      barrel(c, wx + 4, 0); crate(c, wx + ww - 10, 0);
      break;
    }
    case 'well': {
      c.px.blob(c.X(16), c.Y(7), 10, 6, R('#8a8880')); c.px.blob(c.X(16), c.Y(9), 7, 3.6, R('#2a5a8a'), { dither: 0.3 });
      for (const x of [7, 25]) for (let j = 0; j < 20; j++) { c.set(x, 6 + j, R('#7a5a38')[2]); c.set(x + 1, 6 + j, R('#7a5a38')[1]); }
      c.px.poly([[c.X(4), c.Y(26)], [c.X(16), c.Y(34)], [c.X(28), c.Y(26)]], (x, y) => R(st.roof)[((x + y) & 1) ? 2 : 1]);
      c.px.line(c.X(16), c.Y(26), c.X(16), c.Y(14), col('#b8a888')); c.px.rect(c.X(14), c.Y(14), 4, 4, col('#7a5a38'));
      break;
    }
    case 'smith': {
      const wallH = 26, wx = 6, ww = W - 18;
      const sd: Style = { ...st, wallKind: 'stone', wall: '#7a7870' };
      stoneBase(c, wx - 1, 0, ww + 2, 5); wallFill(c, wx, 5, ww, wallH - 5, sd); sideWall(c, wx + ww, 5, 6, wallH - 5, sd);
      roofShape(c, wx - 2, wx + ww + 6, wallH, 16, { ...sd, roofKind: 'trap', roof: '#4a4e5a' }, 5);
      chimney(c, wx + ww - 16, wallH + 8, 18, sd);
      c.px.rect(c.X(wx + 8), c.Y(18), 14, 13, col('#1e1410')); c.px.blob(c.X(wx + 15), c.Y(8), 6, 3.6, R('#ff8a2a'), { dither: 0.4 });
      c.px.blob(c.X(W - 8), c.Y(5), 4.5, 3, R('#4a4e58')); c.px.rect(c.X(W - 13), c.Y(7), 10, 3, col('#5a5e68'));
      break;
    }
    case 'windmill': {
      const wx = 12, ww = W - 24, h0 = 46;
      for (let j = 0; j < h0; j++) { const inset = Math.floor(j * 0.12); for (let i = inset; i < ww - inset; i++) { const k = 2.6 - (i / ww) * 1.3 + (j % 6 === 0 ? -0.8 : 0) + (bayer(wx + i, j) - 0.5) * 0.4; c.set(wx + i, 6 + j, R('#d8cdb0')[Math.max(0, Math.min(4, Math.round(k)))]); } }
      c.px.poly([[c.X(wx - 2), c.Y(6 + h0)], [c.X(wx + ww / 2), c.Y(6 + h0 + 16)], [c.X(wx + ww + 2), c.Y(6 + h0)]], (x, y) => R('#8a5a3a')[((x + y) & 1) ? 2 : 1]);
      door(c, wx + Math.floor(ww / 2) - 4, 6, 8, 13, st, false); windowAt(c, wx + Math.floor(ww / 2) - 3, 28, 6, 7, st, true);
      stoneBase(c, wx - 2, 0, ww + 4, 6);
      break;
    }
  }
  void rng;
  // light 1-px outline: buildings read against the ground
  c.px.outline(0.55, [20, 16, 24]);
  return c.px;
}

/** Hide the part of a finished sprite above `reveal`, draw scaffolding and mud around it. */
function underConstruction(base: Pix, type: BType, stage: number): Pix {
  const out = new Pix(base.w, base.h), d = BDEFS[type], H = d.h * 32 + 72;
  const bodyTop = (() => { for (let y = 0; y < base.h; y++) for (let x = 0; x < base.w; x++) if (base.data[y * base.w + x] >>> 24) return y; return 0; })();
  const full = base.h - 8 - bodyTop;
  const reveal = stage === 0 ? 0 : stage === 1 ? full * 0.45 : full * 0.82;
  const cut = base.h - 8 - reveal;
  for (let y = 0; y < base.h; y++) for (let x = 0; x < base.w; x++) if (y >= cut) { const c = base.data[y * base.w + x]; if (c >>> 24) out.data[y * base.w + x] = stage === 0 ? c : c; }
  // mud and stakes
  const mud = R('#6a4a30');
  for (let i = 0; i < d.w * 32 + 4; i++) for (let j = 0; j < 7; j++) if (hash2(i, j, 3 + stage) > 0.25 - j * 0.02) out.set(OX - 2 + i, H - 8 - j, mud[1 + ((i + j) % 3 === 0 ? 1 : 0)]);
  const top = Math.min(cut, H - 8 - 30), poleX = [OX + 2, OX + d.w * 32 - 3];
  const wood = R('#a07a48');
  if (stage > 0) {
    for (const x of poleX) for (let y = top; y < H - 8; y++) { out.set(x, y, wood[2]); out.set(x + 1, y, wood[1]); }
    for (let y = top + 4; y < H - 8; y += 12) for (let x = poleX[0]; x < poleX[1]; x++) { out.set(x, y, wood[3]); out.set(x, y + 1, wood[1]); }
    for (let k = 0; k < (poleX[1] - poleX[0]); k++) { const y = top + 4 + Math.round(k * 0.25); out.set(poleX[0] + k, y, wood[1]); }
  } else {
    for (let i = 0; i < d.w * 32; i += 10) for (let j = 0; j < 9; j++) { out.set(OX + 2 + i, H - 10 - j, wood[2]); }
  }
  out.outline(0.55, [20, 16, 24]);
  return out;
}

function damageOverlay(p: Pix, level: number): Pix {
  const out = new Pix(p.w, p.h);
  out.data.set(p.data);
  const rng = new Rng(p.w * 31 + level);
  const n = level === 1 ? 14 : 34;
  for (let i = 0; i < n; i++) {
    const x = rng.int(4, p.w - 5), y = rng.int(4, p.h - 12);
    if (!out.has(x, y)) continue;
    const r = level === 1 ? 1 : rng.int(1, 3);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && out.has(x + dx, y + dy)) out.set(x + dx, y + dy, level === 1 ? col('#2a2020') : (rng.chance(0.5) ? col('#1a1414') : 0));
  }
  out.outline(0.55, [20, 16, 24]);
  return out;
}

const cache = new Map<string, HTMLCanvasElement>();
/** stage: 0..2 construction, 3 finished. damage: 0 none, 1 worn, 2 wrecked. */
export function buildingSprite(type: BType, race: Race, stage: number, damage: number): HTMLCanvasElement {
  const key = `${type}|${race}|${stage}|${damage}`;
  let c = cache.get(key);
  if (!c) {
    let p = paint(type, race);
    if (stage < 3) p = underConstruction(p, type, stage);
    else if (damage) p = damageOverlay(p, damage);
    c = p.toCanvas(); cache.set(key, c);
  }
  return c;
}

/** Crops over a farm's field: bare furrows → sprouts → green → golden. Drawn on top of the FIELD terrain. */
export function cropSprite(stage: number): HTMLCanvasElement {
  const key = `crop|${stage}`;
  let c = cache.get(key);
  if (!c) {
    const p = new Pix(96 + 16, 96 + 32);
    for (let row = 0; row < 8; row++) for (let i = 0; i < 12; i++) {
      const x = 12 + i * 7.6 + (row & 1) * 2, y = 24 + row * 11 + 8;
      if (stage === 0) { p.set(x, y, col('#5a3a1c')); continue; }
      const h = [0, 3, 7, 9][stage], g = stage === 3 ? ['#d8b040', '#f0d060', '#b08a28'] : ['#4a9a38', '#6ab84a', '#2f7a2c'];
      for (let k = 0; k < h; k++) { p.set(x, y - k, col(g[k > h - 3 ? 1 : 0])); if (k > 2) p.set(x + (k % 2 ? 1 : -1), y - k, col(g[2])); }
      if (stage === 3) { p.set(x, y - h - 1, col(g[1])); p.set(x - 1, y - h, col(g[1])); p.set(x + 1, y - h, col(g[0])); }
    }
    c = p.toCanvas(); cache.set(key, c);
  }
  return c;
}
