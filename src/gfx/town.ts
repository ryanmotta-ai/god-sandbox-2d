import { Pix, bayer } from './pix';
import { hash2 } from '../core/rng';
import type { BType } from '../sim/buildings';
import type { Race } from './humanoid';
import { Canvas, wallFill, sideWall, roofShape, door, windowAt, chimney, barrel, crate, hay, stoneBase, R, col, styled, type Style } from './buildings';

/**
 * The civic buildings: market, tavern, bakery, stable, healer, fountain, keep, monument, orchard, townhouse.
 * Same painter verbs as buildings.ts (facade-first 3/4 view), same four race skins, and four looks per building (`variant`).
 */
const clampI = (k: number): number => Math.max(0, Math.min(4, Math.round(k)));
export type Season = 0 | 1 | 2 | 3;

/** Flat paving seen from above. */
function paved(c: Canvas, x: number, y: number, w: number, h: number, tone = '#9a9486'): void {
  const sp = R(tone);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const row = Math.floor(j / 6), off = (row & 1) * 5, mortar = j % 6 === 0 || (i + off) % 10 === 0;
    c.set(x + i, y + j, mortar ? sp[1] : sp[clampI(2.5 + (hash2(Math.floor((i + off) / 10), row, 11) - 0.5) * 1.2 + (bayer(x + i, y + j) - 0.5) * 0.3 - (j < 2 ? 0.5 : 0))]);
  }
}
function post(c: Canvas, x: number, y: number, h: number, w = 2): void { const p = R('#7a5a38'); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.set(x + i, y + j, p[i === 0 ? 3 : 1]); }
function awning(c: Canvas, x: number, y: number, w: number, d: number, a: string, b: string): void {
  const ap = R(a), bp = R(b);
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) { const stripe = Math.floor(i / 4) % 2 === 0, p = stripe ? ap : bp; c.set(x + i, y - j, p[clampI(2.6 - j * 0.12 + (bayer(x + i, y - j) - 0.5) * 0.4)]); }
  for (let i = 0; i < w; i++) { const stripe = Math.floor(i / 4) % 2 === 0, p = stripe ? ap : bp; c.set(x + i, y + 1, p[1]); if (i % 4 !== 3) c.set(x + i, y + 2, p[0]); }
}
function sack(c: Canvas, x: number, y: number, tone = '#e8e0cc'): void { c.px.blob(c.X(x + 4), c.Y(y + 4), 4, 5, R(tone), { dither: 0.3 }); c.set(x + 3, y + 8, col('#8a7a5a')); c.set(x + 4, y + 8, col('#8a7a5a')); }
function horseHead(px: Pix, x: number, y: number, coat: string, flip = 1): void {
  const hp = R(coat);
  px.limb(x, y, x + 6 * flip, y - 7, 5, 4, hp); px.blob(x + 9 * flip, y - 10, 4.4, 3.2, hp, { dither: 0.3 });
  px.rect(x + 11 * flip - 1, y - 10, 3, 2, R('#3a2a22')[2]); px.set(x + 8 * flip, y - 11, col('#14100e'));
  px.poly([[x + 6 * flip, y - 13], [x + 7 * flip, y - 16], [x + 8 * flip, y - 13]], hp[1]);
  px.limb(x - 1 * flip, y - 1, x + 5 * flip, y - 9, 2, 1.6, R('#2a1c14'));
}
function banner(c: Canvas, x: number, y: number, h: number, color: string): void { const bp = R(color); c.rect(x, y, 2, h, R('#5a4028')[2]); for (let j = 0; j < 10; j++) for (let i = 0; i < 7; i++) if (!(j > 7 && Math.abs(i - 3) < j - 7)) c.set(x + 2 + i, y + h - 1 - j, bp[clampI(2.4 - i * 0.2)]); }

/* ---- individual buildings ------------------------------------------------------------------------------- */
function market(c: Canvas, race: Race, st: Style, v: number): void {
  const W = 128, D = 96, acc = ['#c8452a', '#2e86de', '#2f9a4a', '#d8a22a', '#8a4aa8'], pick = (i: number): string => acc[(i + v) % acc.length];
  paved(c, 0, 0, W, D, race === 'elf' ? '#c8c4b0' : race === 'dwarf' ? '#7e7c78' : '#9a9486');
  // three stalls along the back, each a counter under a striped awning on two posts
  for (let s = 0; s < 3; s++) {
    const x = 6 + s * 40, y = D - 34;
    post(c, x, y, 36); post(c, x + 30, y, 36);
    c.rect(x, y, 32, 9, R('#8a5a34')[2]); c.rect(x, y + 8, 32, 1, R('#b88a50')[3]); for (let i = 0; i < 32; i += 8) c.rect(x + i, y, 1, 8, R('#6a4224')[1]);
    awning(c, x - 3, y + 38, 38, 9, pick(s * 2), race === 'orc' ? '#d8cfb4' : '#f0ece0');
    if (s === 0) for (let i = 0; i < 9; i++) c.px.blob(c.X(x + 3 + i * 3), c.Y(y + 12 + (i % 2)), 2, 2, R(['#d8402a', '#7ac04a', '#e8b030'][i % 3]), { dither: 0.2 });
    if (s === 1) for (let i = 0; i < 4; i++) { c.px.limb(c.X(x + 5 + i * 7), c.Y(y + 11), c.X(x + 9 + i * 7), c.Y(y + 13), 3, 2, R('#b8c4d4')); c.set(x + 9 + i * 7, y + 13, col('#14100e')); }
    if (s === 2) for (let i = 0; i < 5; i++) c.rect(x + 3 + i * 5, y + 9, 4, 6, R(['#c8452a', '#2e86de', '#d8a22a', '#8a4aa8', '#2f9a4a'][(i + v) % 5])[2]);
    c.set(x + 16, y + 30, col('#ffd36a')); c.set(x + 16, y + 31, col('#fff2b0')); c.rect(x + 16, y + 32, 1, 6, R('#5a4028')[1]);
  }
  // clutter in front: barrels, crates, a handcart, sacks, a signpost
  barrel(c, 8, 8); barrel(c, 18, 12); crate(c, W - 24, 10, 8); crate(c, W - 14, 14, 7); crate(c, W - 20, 20, 7); sack(c, 44, 10); sack(c, 54, 6); sack(c, W / 2 + 8, 16, '#d8c8a0');
  const cx = 78, cy = 8; c.rect(cx, cy + 4, 22, 5, R('#8a5a34')[2]); c.px.blob(c.X(cx + 4), c.Y(cy + 3), 3.6, 3.6, R('#5a3a1c'), { dither: 0.2 }); c.px.blob(c.X(cx + 18), c.Y(cy + 3), 3.6, 3.6, R('#5a3a1c'), { dither: 0.2 }); c.px.line(c.X(cx), c.Y(cy + 8), c.X(cx - 10), c.Y(cy + 3), R('#7a5a38')[3]);
  for (let i = 0; i < 4; i++) c.px.blob(c.X(cx + 4 + i * 5), c.Y(cy + 11), 2.2, 2, R('#e8b030'), { dither: 0.2 });
  post(c, W - 8, 30, 22); c.rect(W - 16, 48, 14, 6, R('#c8a870')[3]); c.rect(W - 16, 48, 14, 1, R('#7a5a38')[2]);
  void st;
}

function tavern(c: Canvas, race: Race, st: Style, v: number): void {
  const wallH = 46, wx = 6, ww = 80, arch = race === 'elf';
  stoneBase(c, wx - 1, 0, ww + 2, 7);
  wallFill(c, wx, 7, ww, wallH - 7, st); sideWall(c, wx + ww, 7, 7, wallH - 7, st);
  roofShape(c, wx - 3, wx + ww + 8, wallH, 36, st, 7);
  door(c, wx + ww / 2 - 8, 7, 16, 20, st, arch);
  for (const x of [10, ww - 18]) windowAt(c, wx + x, 15, 9, 10, st, true, arch);
  for (const x of [10, ww / 2 - 4, ww - 18]) windowAt(c, wx + x, 31, 8, 9, st, true, arch);
  chimney(c, wx + ww - 20, wallH + 22, 14, st);
  // porch roof on two posts, a hanging sign bracket, barrels, a bench with mugs
  const tr = R(st.beam);
  post(c, wx + ww / 2 - 22, 7, 24, 3); post(c, wx + ww / 2 + 19, 7, 24, 3);
  c.px.poly([[c.X(wx + ww / 2 - 26), c.Y(31)], [c.X(wx + ww / 2 + 26), c.Y(31)], [c.X(wx + ww / 2 + 22), c.Y(36)], [c.X(wx + ww / 2 - 22), c.Y(36)]], (x, y) => R(st.roof)[((x + y) & 1) ? 2 : 1]);
  c.rect(wx + ww + 6, 30, 14, 2, tr[3]); c.rect(wx + ww + 18, 14, 2, 18, tr[2]);  // the sign itself hangs from the bracket and swings: the renderer draws it
  barrel(c, wx - 2, 0); barrel(c, wx + 8, 0); barrel(c, wx + 3, 7);
  c.rect(wx + ww - 28, 0, 20, 4, R('#8a5a34')[2]); c.rect(wx + ww - 28, 4, 20, 1, R('#b88a50')[3]); for (let i = 0; i < 3; i++) { c.rect(wx + ww - 25 + i * 6, 5, 3, 3, R('#d8c8a0')[3]); c.set(wx + ww - 24 + i * 6, 8, col('#fff')); }
  if (race === 'dwarf') for (let i = 0; i < 5; i++) c.px.blob(c.X(wx + 6 + i * 14), c.Y(wallH + 8), 3.4, 4, R('#8a5a30'), { dither: 0.3 }); // kegs along the eaves
  if (race === 'orc') for (let i = 0; i < 3; i++) { c.set(wx + 12 + i * 22, wallH + 34, col('#fff6dc')); c.set(wx + 12 + i * 22, wallH + 35, col('#e8dfc4')); }
}

function bakery(c: Canvas, race: Race, st: Style, v: number): void {
  const wallH = 28, wx = 6, ww = 66;
  stoneBase(c, wx - 1, 0, ww + 2, 5);
  wallFill(c, wx, 5, ww, wallH - 5, st); sideWall(c, wx + ww, 5, 6, wallH - 5, st);
  roofShape(c, wx - 3, wx + ww + 5, wallH, 22, { ...st, roofKind: 'trap' }, 6);
  door(c, wx + 8, 5, 10, 16, st, race === 'elf');
  // serving hatch under a striped awning, loaves on the ledge
  windowAt(c, wx + 28, 11, 14, 9, st, true);
  awning(c, wx + 25, 25, 20, 8, ['#c8452a', '#2e86de', '#2f9a4a'][v % 3], '#f0ece0');
  c.rect(wx + 27, 8, 16, 3, R('#8a5a34')[3]); for (let i = 0; i < 4; i++) c.px.blob(c.X(wx + 30 + i * 4), c.Y(12), 2.2, 1.6, R('#d8a050'), { dither: 0.2 });
  // the oven stack: wide brick chimney with a glowing mouth
  const ox = wx + ww - 16, sr = R(race === 'dwarf' ? '#6a6862' : '#a0604a');
  for (let j = 0; j < 46; j++) for (let i = 0; i < 14; i++) c.set(ox + i, wallH - 10 + j, sr[clampI(2.5 - i * 0.12 + (j % 5 === 0 ? -0.9 : 0) + (bayer(ox + i, j) - 0.5) * 0.4)]);
  for (let i = -1; i < 15; i++) { c.set(ox + i, wallH + 36, sr[3]); c.set(ox + i, wallH + 37, sr[1]); }
  c.rect(ox + 3, wallH - 8, 8, 7, col('#1e1410')); c.rect(ox + 4, wallH - 7, 6, 4, col('#ff8a2a')); c.rect(ox + 5, wallH - 6, 4, 2, col('#ffd060'));
  sack(c, wx - 2, 0); sack(c, wx + 6, 0, '#d8d0b8'); c.rect(wx + 44, 0, 14, 5, R('#8a5a34')[2]); for (let i = 0; i < 3; i++) c.px.blob(c.X(wx + 47 + i * 4), c.Y(6), 2, 1.6, R('#d8a050'), { dither: 0.2 });
  void race;
}

function stable(c: Canvas, race: Race, st: Style, v: number): void {
  const wallH = 26, wx = 6, ww = 116;
  const sd: Style = { ...st, wallKind: race === 'dwarf' ? 'stone' : 'planks' };
  stoneBase(c, wx - 1, 0, ww + 2, 4);
  wallFill(c, wx, 4, ww, wallH - 4, sd); sideWall(c, wx + ww, 4, 6, wallH - 4, sd);
  roofShape(c, wx - 3, wx + ww + 5, wallH, 20, { ...sd, roofKind: 'trap' }, 6);
  // two open stalls with a horse each
  for (let s = 0; s < 2; s++) {
    const sx = wx + 10 + s * 54;
    c.rect(sx, 4, 40, 17, col('#1c1410')); post(c, sx - 2, 3, 20, 3); post(c, sx + 39, 3, 20, 3); c.rect(sx - 2, 20, 44, 3, R('#7a5a38')[3]);
    horseHead(c.px, c.X(sx + 15), c.Y(14), ['#7a4a2a', '#e8e0d0', '#3a2a22', '#a07040'][(v + s * 2) % 4], 1);
    c.rect(sx + 3, 4, 14, 3, R('#d8b040')[3]);
  }
  hay(c, wx + 100, 0); for (let i = 0; i < 6; i++) c.rect(wx + 4 + i * 3, 0, 1, 14, R('#8a6a40')[3]); // fence rails
  c.rect(wx + 20, 0, 22, 4, R('#6a4a28')[2]); c.rect(wx + 21, 3, 20, 1, col('#3a7ac8')); // trough
  c.px.poly([[c.X(wx + ww / 2 - 3), c.Y(wallH + 20)], [c.X(wx + ww / 2 + 3), c.Y(wallH + 20)], [c.X(wx + ww / 2), c.Y(wallH + 30)]], R('#3c3e46')[2]);
  c.rect(wx + ww / 2 - 1, wallH + 20, 2, 8, R('#3c3e46')[2]);
}

function healer(c: Canvas, race: Race, st: Style, v: number): void {
  const wallH = 36, wx = 6, ww = 70;
  const sd: Style = { ...st, wallKind: race === 'orc' ? 'planks' : 'plaster', wall: race === 'orc' ? '#8a7a62' : '#ece6d6', roof: race === 'dwarf' ? '#3a6a58' : race === 'orc' ? '#4a6a3a' : '#3a8a78' };
  stoneBase(c, wx - 1, 0, ww + 2, 6);
  wallFill(c, wx, 6, ww, wallH - 6, sd); sideWall(c, wx + ww, 6, 7, wallH - 6, sd);
  roofShape(c, wx - 3, wx + ww + 7, wallH, 30, sd, 6);
  door(c, wx + ww / 2 - 5, 6, 10, 18, sd, race === 'elf');
  windowAt(c, wx + 8, 15, 8, 9, sd, true); windowAt(c, wx + ww - 16, 15, 8, 9, sd, true);
  // green cross above the door
  const gx = wx + ww / 2, gy = wallH - 12; c.rect(gx - 2, gy - 6, 5, 13, col('#2fb04a')); c.rect(gx - 6, gy - 2, 13, 5, col('#2fb04a')); c.rect(gx - 1, gy - 5, 3, 11, col('#7ae08a')); c.rect(gx - 5, gy - 1, 11, 3, col('#7ae08a'));
  chimney(c, wx + ww - 18, wallH + 14, 10, sd);
  // herb garden: low fence, rows of plants, bundles drying under the eave, a bubbling cauldron
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { const px = wx + 2 + i * 8 + (r & 1) * 3, py = 0 + r * 3; c.px.blob(c.X(px), c.Y(py + 4), 2.8, 3, R(['#4aa83a', '#6ac04a', '#3a8a34'][(i + r + v) % 3]), { dither: 0.3 }); if ((i + r) % 4 === 0) c.set(px, py + 7, col(['#e8d040', '#f08ac0', '#fff'][(i + v) % 3])); }
  for (let i = 0; i < 4; i++) { c.rect(wx + 16 + i * 10, wallH - 14, 1, 5, R('#8a6a40')[2]); c.px.blob(c.X(wx + 16 + i * 10), c.Y(wallH - 16), 1.8, 2.6, R(['#6ab04a', '#c8a840', '#a860b8', '#6ab04a'][i]), { dither: 0.2 }); }
  c.px.blob(c.X(wx + ww + 14), c.Y(5), 5, 4, R('#3a3c44')); c.px.blob(c.X(wx + ww + 14), c.Y(8), 3.6, 1.6, R('#5aff7a'), { dither: 0.2 });
}

function fountain(c: Canvas, race: Race): void {
  paved(c, 0, 0, 64, 64, race === 'elf' ? '#c8c4b0' : race === 'dwarf' ? '#7e7c78' : '#9a9486');
  const sp = R(race === 'elf' ? '#e8e4d8' : race === 'dwarf' ? '#7a7a82' : '#a8a49a');
  c.px.blob(c.X(32), c.Y(24), 26, 15, sp, { dither: 0.5 });
  c.px.blob(c.X(32), c.Y(27), 22, 11, R('#2a78c8'), { dither: 0.4 });
  for (let a = 0; a < 20; a++) { const t = a / 20 * 6.283; c.set(Math.round(32 + Math.cos(t) * 24), Math.round(25 + Math.sin(t) * 13), sp[4]); }
  c.rect(30, 24, 5, 26, sp[2]); c.rect(30, 24, 1, 26, sp[4]); c.rect(34, 24, 1, 26, sp[0]);
  c.px.blob(c.X(32), c.Y(36), 11, 4.5, sp, { dither: 0.4 }); c.px.blob(c.X(32), c.Y(37), 8, 2.8, R('#2a78c8'), { dither: 0.3 });
  c.px.blob(c.X(32), c.Y(50), 3.4, 3.4, race === 'elf' ? R('#e8c24a') : sp, { dither: 0.3 });
}

function keep(c: Canvas, race: Race, st: Style, v: number): void {
  const W = 160, D = 128;
  const sd: Style = { ...st, wallKind: race === 'orc' ? 'planks' : 'stone', wall: race === 'human' ? '#8e8c86' : race === 'elf' ? '#ece8da' : race === 'dwarf' ? '#6c6a68' : '#6a4a32' };
  const sr = R(sd.wall), roof = R(race === 'human' ? ['#b0503c', '#4a6a9a'][v & 1] : race === 'elf' ? '#3a9a78' : race === 'dwarf' ? '#4a4e5a' : '#7e3a2c');
  const crenel = (x: number, y: number, w: number): void => { for (let i = 0; i < w; i += 6) for (let j = 0; j < 6; j++) for (let k = 0; k < 4; k++) c.set(x + i + k, y + j, sr[j === 5 ? 4 : 2 - (k > 2 ? 1 : 0)]); };
  const tower = (x: number, y: number, w: number, h: number): void => {
    wallFill(c, x, y, w, h, sd); sideWall(c, x + w, y, 7, h, sd); crenel(x - 2, y + h, w + 8);
    c.px.poly([[c.X(x - 3), c.Y(y + h + 5)], [c.X(x + w / 2 + 3), c.Y(y + h + 28)], [c.X(x + w + 10), c.Y(y + h + 5)]], (px, py) => roof[((px + py) & 1) ? 2 : 1]);
    windowAt(c, x + w / 2 - 2, y + h - 22, 5, 9, sd, false, true);
  };
  paved(c, 26, 40, 108, 70, race === 'orc' ? '#6a5a48' : '#7e7c78'); // the courtyard
  // back to front: tall keep, back turrets, curtain walls and gate, front turrets
  stoneBase(c, 28, D - 36, 104, 8); wallFill(c, 30, D - 28, 100, 76, sd); sideWall(c, 130, D - 28, 8, 76, sd); crenel(28, D + 48, 112);
  for (const x of [46, 84, 110]) windowAt(c, x, D + 16, 8, 14, sd, true, true);
  c.px.poly([[c.X(40), c.Y(D + 54)], [c.X(80), c.Y(D + 76)], [c.X(130), c.Y(D + 54)]], (x, y) => roof[((x + y) & 1) ? 2 : 1]);
  tower(0, D - 40, 26, 78); tower(W - 28, D - 40, 26, 78);
  stoneBase(c, 24, 0, 112, 6); wallFill(c, 26, 6, 108, 42, sd); sideWall(c, 134, 6, 7, 42, sd); crenel(24, 48, 118);
  for (let i = 0; i < 6; i++) c.rect(34 + i * 17, 28, 2, 8, R('#14100e')[1]);
  // gatehouse: arch, portcullis, banners
  c.rect(60, 6, 40, 52, sr[3]); wallFill(c, 62, 6, 36, 52, sd); crenel(58, 58, 44);
  c.px.ellipse(c.X(80), c.Y(30), 12, 14, R('#3a2616')[1]); c.rect(68, 6, 24, 24, R('#3a2616')[1]);
  for (let i = 0; i < 24; i += 4) c.rect(68 + i, 6, 1, 26, R('#8a94a4')[2]); for (let j = 8; j < 30; j += 6) c.rect(68, j, 24, 1, R('#8a94a4')[1]);
  banner(c, 54, 30, 24, ['#c8452a', '#2e86de', '#2f9a4a'][v % 3]); banner(c, 96, 30, 24, ['#c8452a', '#2e86de', '#2f9a4a'][v % 3]);
  tower(2, 0, 26, 64); tower(W - 30, 0, 26, 64);
  if (race === 'orc') for (let i = 0; i < 8; i++) { c.rect(30 + i * 14, 52, 2, 8, R('#d8cfb4')[2]); c.set(30 + i * 14, 61, col('#fff6dc')); }
}

function monument(c: Canvas, race: Race, st: Style, v: number): void {
  paved(c, 0, 0, 64, 64, race === 'elf' ? '#c8c4b0' : '#9a9486');
  const sp = R(race === 'elf' ? '#ece8da' : race === 'dwarf' ? '#8a8a92' : '#b0aca0');
  for (let k = 0; k < 3; k++) c.px.blob(c.X(32), c.Y(8 + k * 5), 24 - k * 5, 8 - k * 1.4, sp, { dither: 0.5 });
  c.rect(24, 22, 16, 14, sp[2]); c.rect(24, 22, 2, 14, sp[4]); c.rect(38, 22, 2, 14, sp[0]); c.rect(28, 26, 8, 4, R('#d8a830')[3]);
  const robe = R(race === 'orc' ? '#7a2a22' : race === 'elf' ? '#3a8a6a' : race === 'dwarf' ? '#5a5a70' : '#8a2a30');
  c.px.limb(c.X(32), c.Y(37), c.X(32), c.Y(52), 9, 7, robe); c.px.blob(c.X(32), c.Y(56), 4, 4.4, R(race === 'orc' ? '#6f9a45' : '#e0a97c'), { dither: 0.3 });
  c.px.limb(c.X(36), c.Y(48), c.X(41), c.Y(62), 2.4, 1.6, R('#c8d0dc')); c.px.limb(c.X(28), c.Y(48), c.X(24), c.Y(44), 3, 2, robe);
  c.px.poly([[c.X(28), c.Y(59)], [c.X(30), c.Y(64)], [c.X(32), c.Y(60)], [c.X(34), c.Y(64)], [c.X(36), c.Y(59)]], R('#e8c24a')[3]);
  for (const [x, y] of [[6, 4], [52, 4], [6, 50], [54, 50]]) for (let i = 0; i < 4; i++) { c.set(x + i * 2, y, col(['#e0404a', '#f2c230', '#f08ac0', '#fff'][(i + v) % 4])); c.set(x + i * 2, y - 1, col('#3a8a34')); }
  void st;
}

function townhouse(c: Canvas, race: Race, st: Style, v: number): void {
  const wallH = 58, wx = 8, ww = 74, arch = race === 'elf';
  stoneBase(c, wx - 1, 0, ww + 2, 8);
  wallFill(c, wx, 8, ww, wallH - 8, st); sideWall(c, wx + ww, 8, 8, wallH - 8, st);
  roofShape(c, wx - 3, wx + ww + 8, wallH, 34, st, 7);
  door(c, wx + ww / 2 - 6, 8, 12, 20, st, arch);
  for (const x of [8, ww - 17]) windowAt(c, wx + x, 15, 9, 11, st, true, arch);
  for (const x of [8, ww / 2 - 5, ww - 17]) windowAt(c, wx + x, 38, 9, 12, st, true, arch);
  // balcony across the first floor, railing and brackets
  const bp = R(st.beam); c.rect(wx + ww / 2 - 16, 32, 32, 3, bp[3]); for (let i = 0; i < 32; i += 4) c.rect(wx + ww / 2 - 16 + i, 35, 1, 6, bp[2]); c.rect(wx + ww / 2 - 16, 41, 32, 1, bp[3]);
  for (const x of [wx + ww / 2 - 14, wx + ww / 2 + 12]) c.px.line(c.X(x), c.Y(32), c.X(x + (x < wx + ww / 2 ? -2 : 2)), c.Y(26), bp[2]);
  for (let i = 0; i < 6; i++) { c.set(wx + ww / 2 - 14 + i * 5, 42, col(['#e0404a', '#f2c230', '#f08ac0'][(i + v) % 3])); c.set(wx + ww / 2 - 14 + i * 5, 43, col('#3a8a34')); }
  chimney(c, wx + 10, wallH + 20, 14, st); chimney(c, wx + ww - 22, wallH + 22, 12, st);
  barrel(c, wx + ww - 6, 0); crate(c, wx - 3, 0, 6);
}

/* ---- orchard: tree rows that change with the season -------------------------------------------------------- */
function orchard(c: Canvas, race: Race, v: number, season: Season, frame: number): void {
  const W = 128, D = 128;
  const lawn = R(season === 3 ? '#9aa88a' : '#5a9a3a');
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) { const edge = Math.min(i, W - 1 - i, j, D - 1 - j); if (edge < 3 && hash2(i, j, 4) > edge * 0.35 + 0.2) continue; c.set(i, j, lawn[clampI(1.8 + (hash2(i >> 1, j >> 1, 8) - 0.5) * 0.9 + (bayer(i, j) - 0.5) * 0.4)]); }
  const canopy = season === 0 ? '#7ac060' : season === 1 ? '#3f9a3c' : season === 2 ? ['#d8802a', '#c8452a', '#e0a82a'][v % 3] : '#6a5a4a', fruitC = season === 0 ? '#f8d8e8' : season === 1 ? '#7ac04a' : season === 2 ? '#d8302a' : '';
  const trees: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) trees.push([16 + k * 32 + (r & 1) * 8, 8 + r * 28]);
  trees.sort((a, b) => b[1] - a[1]);
  for (const [tx, ty] of trees) {
    const sway = Math.round(Math.sin(frame * 1.57 + tx * 0.2) * (season === 3 ? 0 : 1));
    c.rect(tx - 1, ty, 3, 14, R('#6a4a2a')[2]); c.rect(tx - 1, ty, 1, 14, R('#9a7a50')[3]);
    if (season === 3) { for (let k = 0; k < 6; k++) c.px.line(c.X(tx), c.Y(ty + 12), c.X(tx + (k - 3) * 3), c.Y(ty + 26 + (k % 2) * 3), R('#5a4636')[2]); continue; }
    const cp = R(canopy);
    c.px.blob(c.X(tx + sway), c.Y(ty + 22), 13, 10.5, cp, { dither: 0.7 });
    c.px.blob(c.X(tx - 5 + sway), c.Y(ty + 19), 7, 6, cp, { dither: 0.6 }); c.px.blob(c.X(tx + 6 + sway), c.Y(ty + 20), 7, 6, cp, { dither: 0.6 });
    if (fruitC) for (let f = 0; f < 7; f++) { const fx = tx + sway + Math.round((hash2(tx, ty, f) - 0.5) * 20), fy = ty + 17 + Math.round(hash2(ty, tx, f + 9) * 11); c.set(fx, fy, col(fruitC)); c.set(fx + 1, fy, col(fruitC)); if (season === 2) c.set(fx, fy - 1, col('#f08a7a')); }
  }
  // fence posts along the front, a beehive or two
  for (let i = 0; i <= W; i += 12) { c.rect(i, 0, 2, 7, R('#8a6a40')[2]); c.set(i, 7, R('#c8a870')[3]); }
  for (let i = 0; i < W; i++) { c.set(i, 5, R('#8a6a40')[3]); c.set(i, 3, R('#8a6a40')[1]); }
  for (const hx of [W - 16, W - 26]) { c.rect(hx, 8, 8, 8, R('#d8b040')[2]); c.rect(hx, 14, 8, 2, R('#a07a28')[2]); c.set(hx + 3, 10, col('#14100e')); }
  void race;
}

const ORCH = new Map<string, Pix>();
export function orchardPix(race: Race, variant: number, season: Season, frame: number): Pix {
  const key = `${race}|${variant & 3}|${season}|${frame & 1}`;
  let p = ORCH.get(key);
  if (!p) { const c = new Canvas('orchard'); orchard(c, race, variant & 3, season, frame & 1); c.px.outline(0.5, [20, 16, 24]); p = c.px; ORCH.set(key, p); }
  return p;
}

const ORCH_C = new Map<string, HTMLCanvasElement>();
export function orchardSprite(race: Race, variant: number, season: Season, frame: number): HTMLCanvasElement {
  const key = `${race}|${variant & 3}|${season}|${frame & 1}`;
  let c = ORCH_C.get(key);
  if (!c) { c = orchardPix(race, variant, season, frame).toCanvas(); ORCH_C.set(key, c); }
  return c;
}

export function paintTown(type: BType, race: Race, variant: number, h: number): Pix | null {
  void h;
  const st = styled(race, variant);
  switch (type) {
    case 'market': case 'tavern': case 'bakery': case 'stable': case 'healer': case 'fountain': case 'keep': case 'monument': case 'townhouse': break;
    case 'orchard': return orchardPix(race, variant, 1, 0);
    default: return null;
  }
  const c = new Canvas(type);
  switch (type) {
    case 'market': market(c, race, st, variant); break;
    case 'tavern': tavern(c, race, st, variant); break;
    case 'bakery': bakery(c, race, st, variant); break;
    case 'stable': stable(c, race, st, variant); break;
    case 'healer': healer(c, race, st, variant); break;
    case 'fountain': fountain(c, race); break;
    case 'keep': keep(c, race, st, variant); break;
    case 'monument': monument(c, race, st, variant); break;
    case 'townhouse': townhouse(c, race, st, variant); break;
    default: break;
  }
  c.px.outline(0.55, [20, 16, 24]);
  return c.px;
}
