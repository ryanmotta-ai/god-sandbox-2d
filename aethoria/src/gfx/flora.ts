import { Pix, toPacked, bayer } from './pix';
import { ramp, hex, pack } from './color';
import { Rng } from '../core/rng';
import { O } from '../world/defs';

/** Plant sprites are 48×64 with the root at (24,58). */
export const PW = 48, PH = 64, PCX = 24, PBASE = 58;
export type Season = 0 | 1 | 2 | 3; // spring, summer, autumn, winter

const rc = new Map<string, number[]>();
const R = (c: string, n = 5): number[] => { const k = c + n; let v = rc.get(k); if (!v) { v = toPacked(ramp(c, n)); rc.set(k, v); } return v; };
const col = (h: string): number => { const c = hex(h); return pack(c[0], c[1], c[2]); };

const BARK = '#6b4a30';
const LEAF: Record<number, string[]> = { // by season: spring, summer, autumn, winter(unused)
  [O.OAK]: ['#6cba48', '#4a9a38', '#cc7a26', '#4a9a38'],
  [O.BIRCH]: ['#86c85a', '#6ab048', '#e0b030', '#6ab048'],
};

/** Trunk: shaded column with bark grooves and a root flare. */
function trunk(px: Pix, cx: number, base: number, h: number, w: number, barkRamp: number[], flare = true): void {
  const x0 = Math.round(cx - w / 2);
  px.column(x0, Math.round(base - h), w, Math.round(h), barkRamp);
  for (let y = base - h + 2; y < base; y += 3) if (w >= 3) px.set(x0 + 1 + ((y * 7) % Math.max(1, w - 1)), y, barkRamp[0]);
  if (flare) {
    px.rect(x0 - 1, base - 2, w + 2, 2, barkRamp[1]); px.set(x0 - 1, base - 1, barkRamp[2]); px.set(x0 + w, base - 1, barkRamp[0]);
    px.rect(x0 - 2, base - 1, 1, 1, barkRamp[0]); px.rect(x0 + w + 1, base - 1, 1, 1, barkRamp[0]);
  }
}

/** Canopy as many lit spheres, bottom ones drawn last so the mass bulges toward the viewer, then leaf flecks. */
function canopy(px: Pix, rng: Rng, cx: number, cy: number, rx: number, ry: number, leaf: number[], n: number, rMin: number, rMax: number): void {
  const blobs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * 0.78;
    blobs.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: rng.range(rMin, rMax) });
  }
  blobs.sort((a, b) => a.y - b.y);
  for (const b of blobs) px.blob(b.x, b.y, b.r, b.r * 0.9, leaf, { dither: 1.0 });
  // flecks: light on the lit upper-left, dark pockets elsewhere
  for (let i = 0; i < n * 7; i++) {
    const x = Math.round(cx + rng.range(-rx, rx)), y = Math.round(cy + rng.range(-ry, ry));
    if (!px.has(x, y)) continue;
    const lit = (x - cx) / rx + (y - cy) / ry < 0.1;
    if (lit) { px.set(x, y, leaf[4]); px.set(x + 1, y, leaf[3]); } else { px.set(x, y, leaf[0]); px.set(x - 1, y + 1, leaf[1]); }
  }
}

function branches(px: Pix, rng: Rng, x: number, y: number, len: number, ang: number, w: number, barkRamp: number[], depth: number, snow: boolean): void {
  const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
  px.limb(x, y, x1, y1, w, Math.max(1, w * 0.7), barkRamp);
  if (snow) { px.set(Math.round((x + x1) / 2), Math.round((y + y1) / 2) - 1, col('#f2f8ff')); px.set(Math.round(x1), Math.round(y1) - 1, col('#e6f0fb')); }
  if (depth <= 0 || len < 4) return;
  const k = 2 + (depth > 2 ? 1 : 0);
  for (let i = 0; i < k; i++) branches(px, rng, x1, y1, len * rng.range(0.55, 0.75), ang + rng.range(-0.8, 0.8) + (i - (k - 1) / 2) * 0.3, Math.max(1, w * 0.7), barkRamp, depth - 1, snow);
}

/** Scale helper: sapling / young / mature. */
export const stageScale = (age: number): number => age < 70 ? 0.34 : age < 170 ? 0.7 : 1;

function oak(rng: Rng, s: number, season: Season, kind: number): Pix {
  const px = new Pix(PW, PH), bark = R(kind === O.BIRCH ? '#d8d4c8' : BARK);
  const th = Math.round((kind === O.BIRCH ? 20 : 14) * s), w = Math.max(2, Math.round((kind === O.BIRCH ? 4 : 6) * s));
  const leaf = R(LEAF[kind][season]);
  const cy = PBASE - th - 12 * s, rx = (kind === O.BIRCH ? 12 : 17) * s, ry = (kind === O.BIRCH ? 15 : 13) * s;
  if (season === 3 && s > 0.5) { // bare winter tree
    trunk(px, PCX, PBASE, th + 4 * s, w, bark);
    const n = 4;
    for (let i = 0; i < n; i++) branches(px, rng, PCX + rng.range(-1, 1), PBASE - th - 2, 11 * s, -Math.PI / 2 + (i - (n - 1) / 2) * 0.62 + rng.range(-0.2, 0.2), Math.max(1.5, 3 * s), bark, 2, true);
    px.outline(0.55, [20, 16, 28]); return px;
  }
  trunk(px, PCX, PBASE, th, w, bark);
  if (kind === O.BIRCH) for (let y = PBASE - th + 1; y < PBASE - 1; y += 3) { px.set(PCX - 1 + (y % 2), y, col('#2a2622')); px.set(PCX, y + 1, col('#3a3630')); }
  if (s > 0.5) { // two visible limbs reaching into the canopy
    px.limb(PCX, PBASE - th + 2, PCX - 6 * s, PBASE - th - 5 * s, 2.2, 1.4, bark); px.limb(PCX, PBASE - th + 1, PCX + 6 * s, PBASE - th - 6 * s, 2.2, 1.4, bark);
  }
  canopy(px, rng, PCX, cy, rx, ry, leaf, Math.round(8 + 10 * s), 5 * s + 1, 8.5 * s + 1);
  if (season === 2 && s > 0.5) for (let i = 0; i < 18; i++) { const x = Math.round(PCX + rng.range(-rx, rx)), y = Math.round(cy + rng.range(-ry, ry)); if (px.has(x, y)) px.set(x, y, col(rng.chance(0.5) ? '#b83a22' : '#e8a030')); }
  px.outline(0.6, [14, 28, 18]);
  return px;
}

function pine(rng: Rng, s: number, snowy: boolean): Pix {
  const px = new Pix(PW, PH), bark = R('#5a3a24'), leaf = R(snowy ? '#3a7a58' : '#2a6a3a');
  const th = Math.max(3, Math.round(7 * s));
  trunk(px, PCX, PBASE, th, Math.max(2, Math.round(4 * s)), bark);
  const tiers = Math.max(2, Math.round(5 * s)), tierH = 11 * s;
  for (let i = 0; i < tiers; i++) {
    const t = i / Math.max(1, tiers - 1), yb = PBASE - th + 2 - i * tierH * 0.72, wHalf = (15 - t * 9) * s + 2, top = yb - tierH;
    px.poly([[PCX, top], [PCX + wHalf, yb], [PCX - wHalf, yb]], (x, y) => {
      const f = (x - (PCX - wHalf)) / (wHalf * 2), edge = (y - top) / tierH;
      const idx = Math.round((1 - f) * 3.2 + edge * -0.3 + (bayer(x, y) - 0.5) * 0.9 + (((x + y) & 3) === 0 ? -0.6 : 0));
      return leaf[Math.max(0, Math.min(4, idx))];
    });
    // ragged skirt
    for (let x = -wHalf; x <= wHalf; x += 3) { px.set(Math.round(PCX + x), Math.round(yb + 1), leaf[1]); px.set(Math.round(PCX + x + 1), Math.round(yb + 1), leaf[0]); }
    if (snowy) { const w = [col('#ffffff'), col('#dce8f6'), col('#b8cde6')]; px.poly([[PCX, top], [PCX + wHalf * 0.55, top + tierH * 0.55], [PCX - wHalf * 0.55, top + tierH * 0.55]], (x, y) => w[(x + y) & 1 ? 0 : 1]); for (let x = -wHalf; x <= wHalf; x += 4) px.set(Math.round(PCX + x), Math.round(yb), w[2]); }
  }
  px.outline(0.6, [10, 24, 20]);
  return px;
}

function palm(rng: Rng, s: number): Pix {
  const px = new Pix(PW, PH), bark = R('#9a7a4a'), leaf = R('#4aa64a');
  const th = Math.round(26 * s), bend = rng.range(-5, 5) * s;
  const pts: [number, number][] = [];
  for (let i = 0; i <= th; i++) { const t = i / th; pts.push([PCX + bend * t * t, PBASE - i]); }
  for (let i = 0; i < pts.length - 1; i++) { px.limb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], Math.max(2, 4 * s - i / th * 1.5), Math.max(2, 4 * s - i / th * 1.5), bark); if (i % 3 === 0) px.set(Math.round(pts[i][0]) - 1, pts[i][1], bark[0]); }
  const [tx, ty] = pts[pts.length - 1];
  const nF = 7;
  for (let i = 0; i < nF; i++) {
    const a = (i / nF) * Math.PI * 2 + rng.range(-0.2, 0.2), len = 15 * s + rng.range(-1, 2);
    let px0 = tx, py0 = ty;
    const segs = 6;
    for (let k = 1; k <= segs; k++) {
      const t = k / segs, nx = tx + Math.cos(a) * len * t, ny = ty + Math.sin(a) * len * t * 0.5 + (t * t) * 9 * s - 2 * s * (1 - t);
      px.limb(px0, py0, nx, ny, 2.2 - t, 1.3, leaf);
      if (k >= 2) { px.line(nx, ny, nx + Math.cos(a + 1.5) * 3, ny + 3, leaf[1]); px.line(nx, ny, nx + Math.cos(a - 1.5) * 3, ny + 3, leaf[2]); }
      px0 = nx; py0 = ny;
    }
  }
  if (s > 0.5) { px.ellipse(tx - 1, ty + 2, 1.6, 1.6, col('#7a5a30')); px.ellipse(tx + 2, ty + 2, 1.6, 1.6, col('#6a4a26')); }
  px.outline(0.6, [14, 28, 18]);
  return px;
}

function jungle(rng: Rng, s: number): Pix {
  const px = new Pix(PW, PH), bark = R('#5a4430'), leaf = R('#2a8038');
  const th = Math.round(20 * s);
  trunk(px, PCX, PBASE, th, Math.max(3, Math.round(6 * s)), bark);
  if (s > 0.5) { px.limb(PCX - 3, PBASE, PCX - 1, PBASE - 8, 2, 2, bark); px.limb(PCX + 3, PBASE, PCX + 1, PBASE - 8, 2, 2, bark); }
  const cy = PBASE - th - 8 * s;
  canopy(px, rng, PCX, cy + 3 * s, 21 * s, 9 * s, R('#1d6a2c'), Math.round(8 + 6 * s), 5 * s + 1, 8 * s + 1);
  canopy(px, rng, PCX, cy - 3 * s, 17 * s, 8 * s, leaf, Math.round(8 + 6 * s), 4.5 * s + 1, 7 * s + 1);
  if (s > 0.5) for (let i = 0; i < 6; i++) { const x = Math.round(PCX + rng.range(-17, 17)), y = Math.round(cy + 6); if (px.has(x, y)) px.limb(x, y, x + rng.range(-1, 1), y + rng.range(5, 12), 1, 1, R('#2a7a30', 3)); }
  for (let i = 0; i < 7 * s; i++) { const x = Math.round(PCX + rng.range(-14, 14) * s), y = Math.round(cy + rng.range(-6, 4)); if (px.has(x, y)) { px.set(x, y, col('#e8403a')); px.set(x + 1, y, col('#f89a8a')); } }
  px.outline(0.6, [8, 26, 16]);
  return px;
}

function acacia(rng: Rng, s: number): Pix {
  const px = new Pix(PW, PH), bark = R('#7a5a3c'), leaf = R('#7a9a3a');
  const th = Math.round(18 * s), fx = rng.range(-3, 3);
  px.limb(PCX, PBASE, PCX + fx * 0.3, PBASE - th * 0.6, Math.max(2, 4 * s), Math.max(2, 3.4 * s), bark);
  px.limb(PCX + fx * 0.3, PBASE - th * 0.6, PCX - 8 * s + fx, PBASE - th, Math.max(1.5, 2.6 * s), 1.6, bark);
  px.limb(PCX + fx * 0.3, PBASE - th * 0.6, PCX + 8 * s + fx, PBASE - th - 2 * s, Math.max(1.5, 2.6 * s), 1.6, bark);
  px.rect(PCX - 2, PBASE - 2, 4, 2, bark[1]);
  canopy(px, rng, PCX + fx, PBASE - th - 4 * s, 19 * s, 5 * s, leaf, Math.round(8 + 6 * s), 4 * s + 1, 6 * s + 1);
  px.outline(0.6, [20, 28, 14]);
  return px;
}

function deadTree(rng: Rng, s: number): Pix {
  const px = new Pix(PW, PH), bark = R('#6a6058');
  px.limb(PCX, PBASE, PCX + rng.range(-2, 2), PBASE - 14 * s, Math.max(2, 4.5 * s), Math.max(1.5, 3 * s), bark);
  px.rect(PCX - 3, PBASE - 2, 6, 2, bark[1]);
  for (let i = 0; i < 4; i++) branches(px, rng, PCX, PBASE - (8 + i * 3) * s, 9 * s, -Math.PI / 2 + (i % 2 ? 1 : -1) * rng.range(0.5, 1.2), Math.max(1, 2.4 * s), bark, 2, false);
  px.outline(0.55, [20, 18, 22]);
  return px;
}

function cactus(rng: Rng, s: number): Pix {
  const px = new Pix(PW, PH), g = R('#3a8a4a'), h = Math.round(22 * s);
  px.column(PCX - 3, PBASE - h, 6, h, g); px.ellipse(PCX, PBASE - h, 3, 2, g[3]);
  if (s > 0.5) {
    const ah = Math.round(8 * s);
    px.column(PCX - 9, PBASE - 12 * s - ah, 3, ah, g); px.rect(PCX - 9, PBASE - 12 * s, 7, 3, g[2]);
    px.column(PCX + 6, PBASE - 15 * s - ah, 3, ah, g); px.rect(PCX + 2, PBASE - 15 * s, 7, 3, g[2]);
    px.set(PCX - 8, PBASE - 12 * s - ah - 1, col('#f08ac0')); px.set(PCX + 7, PBASE - 15 * s - ah - 1, col('#f6c24a'));
  }
  for (let i = 0; i < 18 * s; i++) { const x = PCX - 3 + Math.floor(rng.range(0, 6)), y = PBASE - Math.floor(rng.range(2, h)); if (px.has(x, y)) px.set(x, y, col('#e8f0c8')); }
  for (let y = PBASE - h + 2; y < PBASE; y++) px.set(PCX, y, g[1]);
  px.outline(0.6, [10, 30, 20]);
  return px;
}

function bush(rng: Rng, berries: boolean): Pix {
  const px = new Pix(PW, PH), leaf = R(berries ? '#3a8a3a' : '#4a9040');
  canopy(px, rng, PCX, PBASE - 6, 9, 5, leaf, 6, 3.2, 5.2);
  if (berries) for (let i = 0; i < 9; i++) { const x = Math.round(PCX + rng.range(-8, 8)), y = Math.round(PBASE - 6 + rng.range(-4, 4)); if (px.has(x, y)) { px.set(x, y, col('#d02a3a')); px.set(x, y - 1, col('#f87a82')); } }
  px.outline(0.6, [10, 28, 16]);
  return px;
}

function flower(rng: Rng, color: string): Pix {
  const px = new Pix(PW, PH), c = R(color), st = col('#3a7a34');
  for (let i = 0; i < 4; i++) {
    const x = PCX + rng.range(-5, 5), h = rng.range(5, 9);
    px.line(x, PBASE, x + rng.range(-1, 1), PBASE - h, st);
    const tx = Math.round(x), ty = Math.round(PBASE - h);
    px.set(tx, ty - 1, c[3]); px.set(tx - 1, ty, c[2]); px.set(tx + 1, ty, c[2]); px.set(tx, ty + 1, c[2]); px.set(tx, ty, col('#ffe27a'));
  }
  px.set(PCX - 3, PBASE - 1, col('#4a9a3a')); px.set(PCX + 3, PBASE - 2, col('#4a9a3a'));
  return px;
}

function reed(rng: Rng): Pix {
  const px = new Pix(PW, PH), g = R('#5a8a3a', 4);
  for (let i = 0; i < 6; i++) {
    const x = PCX + rng.range(-6, 6), h = rng.range(14, 22), lean = rng.range(-2, 2);
    for (let k = 0; k < h; k++) px.set(Math.round(x + lean * (k / h) * (k / h)), PBASE - k, k > h - 4 ? col('#6a4a2a') : g[1 + (k % 3 === 0 ? 1 : 0)]);
    if (i % 2 === 0) { px.rect(Math.round(x + lean) - 1, Math.round(PBASE - h), 2, 4, col('#7a4a28')); px.set(Math.round(x + lean) - 1, Math.round(PBASE - h), col('#9a6a3a')); }
  }
  return px;
}

/** Faceted rock: wedges around a centre, each shaded by the direction it faces. */
function facet(px: Pix, rng: Rng, cx: number, cy: number, rx: number, ry: number, rampc: number[], jag = 0.28, n = 8): void {
  const v: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rng.range(-0.18, 0.18), k = 1 + rng.range(-jag, jag * 0.5); v.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  const c: [number, number] = [cx - rx * 0.18, cy - ry * 0.28];
  for (let i = 0; i < n; i++) {
    const a = v[i], b = v[(i + 1) % n], mx = (a[0] + b[0]) / 2 - c[0], my = (a[1] + b[1]) / 2 - c[1], l = Math.hypot(mx, my) || 1;
    const lit = (mx / l) * -0.55 + (my / l) * -0.7; // facing the light?
    const idx = Math.max(0, Math.min(rampc.length - 1, Math.round((lit * 0.5 + 0.5) * (rampc.length - 1) + rng.range(-0.4, 0.4))));
    px.poly([c, a, b], (x, y) => rampc[Math.max(0, Math.min(rampc.length - 1, idx + (bayer(x, y) > 0.8 ? 1 : bayer(x, y) < 0.15 ? -1 : 0)))]);
  }
}

function rock(rng: Rng, big: boolean, ore = 0): Pix {
  const px = new Pix(PW, PH), g = R(ore === 0 ? '#8a8890' : '#6e6c76');
  if (!big) { facet(px, rng, PCX - 5, PBASE - 4, 5, 3.6, g); facet(px, rng, PCX + 4, PBASE - 3, 4, 3, g); facet(px, rng, PCX, PBASE - 2.2, 3, 2.2, g, 0.2, 6); }
  else {
    facet(px, rng, PCX, PBASE - 9, 12, 9, g, 0.22, 9);
    px.set(PCX - 6, PBASE - 12, col('#5a8a46')); px.rect(PCX - 7, PBASE - 11, 4, 1, col('#4a7a3a')); // moss
  }
  if (ore) {
    const flecks = ore === 1 ? ['#d8782a', '#a8501c', '#f0a050'] : ore === 2 ? ['#ffd84a', '#ffec9a', '#e0a820'] : ['#3ab89a', '#7adcc0', '#2a8a74'];
    const cy = PBASE - 9;
    for (let i = 0; i < 26; i++) { const x = Math.round(PCX + rng.range(-10, 10)), y = Math.round(cy + rng.range(-7, 6)); if (!px.has(x, y)) continue; px.set(x, y, col(flecks[0])); if (rng.chance(0.6)) px.set(x + 1, y, col(flecks[2])); if (rng.chance(0.4)) px.set(x, y + 1, col(flecks[1])); }
    if (ore === 2) { px.set(PCX - 4, PBASE - 14, col('#ffffff')); px.set(PCX + 5, PBASE - 8, col('#ffffff')); }
  }
  px.outline(0.62, [16, 14, 26]);
  return px;
}

function mushroom(rng: Rng): Pix {
  const px = new Pix(PW, PH);
  for (let i = 0; i < 3; i++) {
    const x = PCX + (i - 1) * 6 + rng.range(-1, 1), h = 4 + rng.range(0, 3), r = 3 + rng.range(0, 1.4);
    px.rect(Math.round(x) - 1, PBASE - h, 2, h, col('#e8e0d0'));
    px.blob(x, PBASE - h, r, r * 0.7, R('#c8382e'), { only: (_x, y) => y <= PBASE - h + 1 });
    px.set(Math.round(x) - 1, PBASE - h - 1, col('#fff')); px.set(Math.round(x) + 1, PBASE - h, col('#fff'));
  }
  px.outline(0.6, [30, 14, 20]);
  return px;
}

function stump(): Pix {
  const px = new Pix(PW, PH), b = R(BARK);
  px.column(PCX - 5, PBASE - 6, 10, 6, b); px.ellipse(PCX, PBASE - 6, 5, 2.2, col('#c8a070')); px.ellipse(PCX, PBASE - 6, 3, 1.2, col('#a8804e')); px.set(PCX, PBASE - 6, col('#8a6238'));
  px.outline(0.6, [24, 14, 14]);
  return px;
}

function tuft(rng: Rng, dry: boolean): Pix {
  const px = new Pix(PW, PH), g = R(dry ? '#a8a040' : '#4a9a3a', 4);
  for (let i = 0; i < 7; i++) { const x = PCX + (i - 3) * 1.6 + rng.range(-1, 1), h = rng.range(5, 10), lean = rng.range(-3, 3); for (let k = 0; k < h; k++) px.set(Math.round(x + lean * (k / h) ** 2), PBASE - k, g[Math.min(3, 1 + Math.floor(k / 3))]); }
  return px;
}

function bones(rng: Rng): Pix {
  const px = new Pix(PW, PH), b = R('#e8e2d0', 4);
  px.ellipse(PCX - 3, PBASE - 4, 3.4, 2.8, b[2]); px.set(PCX - 4, PBASE - 4, b[0]); px.set(PCX - 2, PBASE - 4, b[0]); px.rect(PCX - 4, PBASE - 2, 3, 1, b[1]);
  px.line(PCX + 2, PBASE - 6, PCX + 9, PBASE - 3, b[3]); px.line(PCX + 3, PBASE - 3, PCX + 10, PBASE - 1, b[2]); void rng;
  px.outline(0.6, [30, 24, 20]);
  return px;
}

/** Build the base sprite for an object id. Variants differ by seed; stage by growth; season only affects deciduous trees. */
export function drawPlant(obj: number, variant: number, age: number, season: Season): Pix {
  const rng = new Rng(obj * 1315423911 + variant * 2654435761 + 7), s = stageScale(age);
  switch (obj) {
    case O.OAK: case O.BIRCH: return oak(rng, s, season, obj);
    case O.PINE: return pine(rng, s, season === 3);
    case O.SNOW_PINE: return pine(rng, s, true);
    case O.PALM: return palm(rng, s);
    case O.JUNGLE_TREE: return jungle(rng, s);
    case O.ACACIA: return acacia(rng, s);
    case O.DEAD_TREE: return deadTree(rng, Math.max(0.6, s));
    case O.CACTUS: return cactus(rng, Math.max(0.5, s));
    case O.BUSH: return bush(rng, false);
    case O.BERRIES: return bush(rng, true);
    case O.FLOWER_RED: return flower(rng, '#e0404a');
    case O.FLOWER_YELLOW: return flower(rng, '#f2c230');
    case O.FLOWER_BLUE: return flower(rng, '#5a7ae8');
    case O.REED: return reed(rng);
    case O.ROCK: return rock(rng, false);
    case O.BOULDER: return rock(rng, true);
    case O.ORE_IRON: return rock(rng, true, 1);
    case O.ORE_GOLD: return rock(rng, true, 2);
    case O.ORE_COPPER: return rock(rng, true, 3);
    case O.MUSHROOM: return mushroom(rng);
    case O.STUMP: return stump();
    case O.GRASS_TUFT: return tuft(rng, false);
    case O.BONES: return bones(rng);
    default: return new Pix(PW, PH);
  }
}

const SWAYS = new Set<number>([O.OAK, O.BIRCH, O.PINE, O.SNOW_PINE, O.PALM, O.JUNGLE_TREE, O.ACACIA, O.REED, O.GRASS_TUFT, O.FLOWER_RED, O.FLOWER_YELLOW, O.FLOWER_BLUE, O.BUSH, O.BERRIES]);
const SWAY_FRAMES = 4, SWAY_AMP = [0, 1.1, 0, -1.1];
const pcache = new Map<number, HTMLCanvasElement>();

/** Cached canvas for a plant; `t` is wall-clock seconds, `phase` desynchronises neighbours. */
export function plantSprite(obj: number, variant: number, age: number, season: Season, t: number, phase: number): HTMLCanvasElement {
  const stage = age < 70 ? 0 : age < 170 ? 1 : 2;
  const sway = SWAYS.has(obj) ? Math.floor(((t * 1.6 + phase) % 1) * SWAY_FRAMES) : 0;
  const key = (((obj * 8 + (variant & 3)) * 4 + stage) * 4 + season) * 4 + sway;
  let c = pcache.get(key);
  if (!c) {
    let p = drawPlant(obj, variant & 3, stage === 0 ? 30 : stage === 1 ? 120 : 255, season);
    if (SWAYS.has(obj) && SWAY_AMP[sway] !== 0) p = p.sway(PBASE, SWAY_AMP[sway] * (obj === O.REED || obj === O.GRASS_TUFT ? 1.6 : 1));
    c = p.toCanvas(); pcache.set(key, c);
  }
  return c;
}
