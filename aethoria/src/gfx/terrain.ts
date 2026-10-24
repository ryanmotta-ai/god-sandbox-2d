import { World, CHUNK } from '../world/world';
import { T, TERRAIN } from '../world/defs';
import { TILE } from '../core/config';
import { hash2 } from '../core/rng';
import { NZ, nzA, nzB, nzC } from './noisefield';
import { packHex, pack, ramp, hex, mix, type RGB } from './color';

/**
 * Terrain art, baked per chunk at pixel level.
 *
 *  1. Every pixel picks its terrain from the four nearest tile centres (bilinear weights over a warped
 *     coordinate), so borders are rounded, organic and seamless across chunks — no tile-edge squares.
 *  2. Each terrain paints its own texture from tileable noise + hashed details (blades, ripples, pebbles).
 *  3. Rim light/shade at borders, 3/4 cliff faces under raised ground, wet sand and a seabed gradient at
 *     the shore. Deep water is left transparent: the animated water pass shows through.
 */
export const CHUNK_PX = CHUNK * TILE;
// PAD must exceed the longest distance the bake reads (shore gradient ≈ 22px) or chunk seams show.
const PAD = 26, PAD_TOP = 40, BW = CHUNK_PX + PAD * 2, BH = CHUNK_PX + PAD + PAD_TOP;

// ---- palettes ---------------------------------------------------------------------------------------
interface Pal { c: number[]; rgb: RGB[] }
const PAL: Pal[] = TERRAIN.map(d => {
  const rgb = d.ramp.map(hex) as RGB[];
  return { c: d.ramp.map(h => packHex(h)), rgb };
});
const C = (h: string) => packHex(h);
const SAND_BED = [C('#e9d9a0'), C('#b7e0d8'), C('#6cc6dc'), C('#3d9fcf')];

const RANK: number[] = [];
RANK[T.DEEP] = 0; RANK[T.SHALLOW] = 0; RANK[T.SAND] = 1; RANK[T.DESERT] = 1; RANK[T.ASH] = 2; RANK[T.DIRT] = 2; RANK[T.ROCK] = 3;
RANK[T.SWAMP] = 3; RANK[T.SAVANNA] = 3; RANK[T.TUNDRA] = 3; RANK[T.FIELD] = 4; RANK[T.SNOW] = 4; RANK[T.GRASS] = 5; RANK[T.JUNGLE] = 5;
RANK[T.HILL] = 5; RANK[T.ENCHANTED] = 6; RANK[T.CORRUPTED] = 6; RANK[T.ROAD] = 7; RANK[T.MOUNTAIN] = 5; RANK[T.PEAK] = 5; RANK[T.LAVA] = 8;

const LEVEL = TERRAIN.map(d => d.level);
const isWater = TERRAIN.map(d => d.water);

// ---- per-terrain pixel textures ---------------------------------------------------------------------
/** Grass-family: two-tone patchwork, stippled at the seams, with hand-placed blades. */
function grassTex(p: Pal, px: number, py: number, dry = 0, tall = 0): number {
  const a = nzA(px, py) / 255, b = nzB(px, py) / 255, c = nzC(px, py) / 255;
  let v = a * 0.5 + c * 0.35 + b * 0.15 + (hash2(px, py, 1) - 0.5) * 0.14 + dry;
  let col = v < 0.40 ? p.c[1] : v < 0.78 ? p.c[2] : p.c[3];
  if (v < 0.16) col = p.c[0];
  // blades: 7×7 cells, one blade each (60%), 3px tall, light tip, dark root
  const cx = Math.floor(px / 7), cy = Math.floor(py / 7);
  if (hash2(cx, cy, 11) < 0.62) {
    const bx = cx * 7 + 1 + Math.floor(hash2(cx, cy, 12) * 5), by = cy * 7 + 3 + Math.floor(hash2(cx, cy, 13) * 3), lean = hash2(cx, cy, 14) < 0.5 ? -1 : 1;
    const h = 3 + tall;
    if (px === bx && py === by) col = p.c[0];
    else if (px === bx && py === by - 1) col = p.c[2];
    else if (px === bx + lean * (h > 3 ? 0 : 1) && py === by - 2) col = p.c[3];
    else if (tall && px === bx && py === by - 3) col = p.c[3];
    else if (tall && px === bx + lean && py === by - 4) col = p.c[3];
  }
  // tiny clover/dew highlights
  if (hash2(px, py, 21) > 0.992) col = p.c[3];
  return col;
}

function sandTex(p: Pal, px: number, py: number, dune = false): number {
  const a = nzA(px, py) / 255, c = nzC(px, py) / 255;
  const f = dune ? 0.09 : 0.32, amp = dune ? 7 : 4;
  const w = Math.sin(py * f + a * amp + px * (dune ? 0.03 : 0.12) + c * 5);
  let col = p.c[2];
  if (w > 0.9) col = p.c[3]; else if (w < -0.88) col = p.c[1];
  if (dune && w > 0.55 && w <= 0.9 && ((px + py) & 1) === 0) col = p.c[3];
  const g = hash2(px, py, 31);
  if (g < 0.02) col = p.c[0]; else if (g > 0.985) col = p.c[3];
  if (nzB(px, py) > 210 && c > 0.5) col = p.c[1];
  return col;
}

function dirtTex(p: Pal, px: number, py: number): number {
  const a = nzA(px, py) / 255, b = nzB(px, py) / 255;
  const v = a * 0.65 + b * 0.35 + (hash2(px, py, 41) - 0.5) * 0.2;
  let col = v < 0.38 ? p.c[1] : v < 0.7 ? p.c[2] : p.c[3];
  const cx = Math.floor(px / 9), cy = Math.floor(py / 9);
  if (hash2(cx, cy, 43) < 0.28) { // pebble: 2×2 light with a dark underside
    const bx = cx * 9 + 2 + Math.floor(hash2(cx, cy, 44) * 5), by = cy * 9 + 2 + Math.floor(hash2(cx, cy, 45) * 5);
    if (px >= bx && px <= bx + 1 && py >= by && py <= by + 1) col = p.c[3];
    else if (px >= bx && px <= bx + 2 && py === by + 2) col = p.c[0];
  }
  if (Math.abs(a - 0.5) < 0.012 && b > 0.4) col = p.c[0]; // hairline cracks
  return col;
}

function rockTex(p: Pal, px: number, py: number, snowy = false): number {
  const a = nzA(px, py) / 255, b = nzB(px, py) / 255, c = nzC(px, py) / 255;
  const v = a * 0.45 + c * 0.35 + b * 0.2 + (hash2(px, py, 51) - 0.5) * 0.12;
  let col = v < 0.36 ? p.c[0] : v < 0.52 ? p.c[1] : v < 0.74 ? p.c[2] : p.c[3];
  if (Math.abs(a - 0.55) < 0.016) col = p.c[0]; // fissures
  if (snowy && c > 0.55 && v > 0.4) col = hash2(px, py, 52) > 0.8 ? SNOW_C[2] : SNOW_C[3];
  return col;
}
const SNOW_C = PAL[T.SNOW].c;

function snowTex(p: Pal, px: number, py: number): number {
  const a = nzA(px, py) / 255, c = nzC(px, py) / 255;
  const v = a * 0.6 + c * 0.4 + (hash2(px, py, 61) - 0.5) * 0.12;
  let col = v < 0.3 ? p.c[0] : v < 0.52 ? p.c[1] : v < 0.82 ? p.c[2] : p.c[3];
  if (hash2(px, py, 62) > 0.994) col = pack(255, 255, 255);
  const dy = (py + Math.floor(a * 6)) % 11;
  if (dy === 0 && nzB(px, py) > 150) col = p.c[1]; // wind-blown drift lines
  return col;
}

function swampTex(p: Pal, px: number, py: number): number {
  const a = nzA(px, py) / 255, c = nzC(px, py) / 255, b = nzB(px, py) / 255;
  if (c * 0.7 + a * 0.3 > 0.56) { // murky pools
    const ripple = Math.sin(px * 0.5 + py * 0.9 + a * 5) > 0.93;
    return ripple ? C('#7fa6a0') : b > 0.55 ? C('#2f5a5a') : C('#264b4e');
  }
  return grassTex(p, px, py, -0.05);
}

function lavaTex(p: Pal, px: number, py: number): number {
  const a = nzA(px, py) / 255, c = nzC(px, py) / 255;
  const crack = Math.abs(a - 0.5) + Math.abs(c - 0.5) * 0.5;
  if (crack < 0.035) return p.c[3];
  if (crack < 0.09) return p.c[2];
  if (crack < 0.16) return p.c[1];
  return (nzB(px, py) > 200) ? C('#3a1a14') : C('#27120f');
}

function roadTex(p: Pal, px: number, py: number): number {
  const row = Math.floor(py / 8), off = (row & 1) * 6;
  const lx = (px + off) % 12, ly = py % 8;
  if (lx === 0 || ly === 0) return p.c[0];
  const v = hash2(Math.floor((px + off) / 12), row, 71);
  if (ly === 1 || lx === 1) return p.c[3];
  return v < 0.33 ? p.c[1] : v < 0.7 ? p.c[2] : p.c[3];
}

function fieldTex(p: Pal, px: number, py: number): number {
  const f = py % 6;
  const b = nzB(px, py) / 255;
  if (f === 0) return p.c[0];
  if (f === 1) return p.c[3];
  return b > 0.7 ? p.c[3] : b < 0.25 ? p.c[1] : p.c[2];
}

function enchantedTex(p: Pal, px: number, py: number): number {
  let col = grassTex(p, px, py);
  const g = hash2(px >> 1, py >> 1, 81);
  if (g > 0.985) col = C('#fff2ff'); else if (g > 0.97) col = C('#e6b8ff');
  return col;
}
function corruptTex(p: Pal, px: number, py: number): number {
  const a = nzA(px, py) / 255, c = nzC(px, py) / 255;
  if (Math.abs(a - 0.5) + Math.abs(c - 0.52) * 0.6 < 0.05) return C('#d14b9a');
  let col = rockTex(p, px, py);
  if (hash2(px, py, 91) > 0.994) col = C('#ff7ac8');
  return col;
}
function ashTex(p: Pal, px: number, py: number): number {
  const a = nzA(px, py) / 255, b = nzB(px, py) / 255;
  const v = a * 0.6 + b * 0.4 + (hash2(px, py, 101) - 0.5) * 0.2;
  let col = v < 0.4 ? p.c[0] : v < 0.7 ? p.c[1] : p.c[2];
  if (hash2(px, py, 102) > 0.995) col = C('#e8602a'); // dying embers
  return col;
}

function texture(t: number, px: number, py: number): number {
  const p = PAL[t];
  switch (t) {
    case T.GRASS: return grassTex(p, px, py);
    case T.JUNGLE: return grassTex(p, px, py, -0.06);
    case T.SAVANNA: return grassTex(p, px, py, 0.04, 1);
    case T.HILL: { const g = grassTex(p, px, py, 0.02); return nzC(px, py) > 168 && nzA(px, py) > 110 ? rockTex(PAL[T.MOUNTAIN], px, py) : g; }
    case T.SAND: return sandTex(p, px, py);
    case T.DESERT: return sandTex(p, px, py, true);
    case T.DIRT: return dirtTex(p, px, py);
    case T.TUNDRA: { const s = nzC(px, py) > 150 && nzA(px, py) > 120; return s ? snowTex(PAL[T.SNOW], px, py) : grassTex(p, px, py, -0.12); }
    case T.SNOW: return snowTex(p, px, py);
    case T.SWAMP: return swampTex(p, px, py);
    case T.MOUNTAIN: return rockTex(p, px, py);
    case T.PEAK: return rockTex(p, px, py, true);
    case T.ROCK: return rockTex(p, px, py);
    case T.LAVA: return lavaTex(p, px, py);
    case T.ROAD: return roadTex(p, px, py);
    case T.FIELD: return fieldTex(p, px, py);
    case T.ENCHANTED: return enchantedTex(p, px, py);
    case T.CORRUPTED: return corruptTex(p, px, py);
    case T.ASH: return ashTex(p, px, py);
    default: return p.c[2];
  }
}

// ---- chunk bake -------------------------------------------------------------------------------------
const ter = new Uint8Array(BW * BH);
const dLand = new Uint8Array(BW * BH);
const dWater = new Uint8Array(BW * BH);
const dDeep = new Uint8Array(BW * BH);
const out = { rank: RANK, level: LEVEL };
void out;

/** Terrain id for one pixel from the four nearest (warped) tile centres. */
function pickTerrain(world: World, px: number, py: number): number {
  const wx = px + (NZ.wx[(py & 127) * 128 + (px & 127)] - 128) * 0.06 + (nzB(px, py) - 128) * 0.012;
  const wy = py + (NZ.wy[(py & 127) * 128 + (px & 127)] - 128) * 0.06 + (nzB(py, px + 17) - 128) * 0.012;
  const fx = wx / TILE - 0.5, fy = wy / TILE - 0.5;
  const i0 = Math.floor(fx), j0 = Math.floor(fy), u = fx - i0, v = fy - j0;
  const a = world.t(i0, j0), b = world.t(i0 + 1, j0), c = world.t(i0, j0 + 1), d = world.t(i0 + 1, j0 + 1);
  if (a === b && b === c && c === d) return a;
  let wa = (1 - u) * (1 - v), wb = u * (1 - v), wc = (1 - u) * v, wd = u * v;
  if (b === a) { wa += wb; wb = 0; }
  if (c === a) { wa += wc; wc = 0; } else if (c === b) { wb += wc; wc = 0; }
  if (d === a) { wa += wd; wd = 0; } else if (d === b) { wb += wd; wd = 0; } else if (d === c) { wc += wd; wd = 0; }
  // The higher-ranked terrain wins close calls so grass/ground overgrows sand and sand overgrows water.
  let best = a, bw = wa + RANK[a] * 0.004;
  if (wb > 0 && wb + RANK[b] * 0.004 > bw) { best = b; bw = wb + RANK[b] * 0.004; }
  if (wc > 0 && wc + RANK[c] * 0.004 > bw) { best = c; bw = wc + RANK[c] * 0.004; }
  if (wd > 0 && wd + RANK[d] * 0.004 > bw) best = d;
  return best;
}

/** Two-pass chamfer distance (pixels, capped) from every pixel to the nearest pixel where `target(id)` holds. */
function chamfer(dst: Uint8Array, pred: boolean[], invert: boolean): void {
  const CAP = 40;
  for (let i = 0; i < BW * BH; i++) dst[i] = (pred[ter[i]] !== invert) ? 0 : CAP;
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const i = y * BW + x; let d = dst[i];
    if (d === 0) continue;
    if (x > 0) d = Math.min(d, dst[i - 1] + 1);
    if (y > 0) { d = Math.min(d, dst[i - BW] + 1); if (x > 0) d = Math.min(d, dst[i - BW - 1] + 1); if (x < BW - 1) d = Math.min(d, dst[i - BW + 1] + 1); }
    dst[i] = d;
  }
  for (let y = BH - 1; y >= 0; y--) for (let x = BW - 1; x >= 0; x--) {
    const i = y * BW + x; let d = dst[i];
    if (d === 0) continue;
    if (x < BW - 1) d = Math.min(d, dst[i + 1] + 1);
    if (y < BH - 1) { d = Math.min(d, dst[i + BW] + 1); if (x < BW - 1) d = Math.min(d, dst[i + BW + 1] + 1); if (x > 0) d = Math.min(d, dst[i + BW - 1] + 1); }
    dst[i] = d;
  }
}
const WATER_PRED = isWater as boolean[];
const LAND_PRED = isWater.map(w => !w);
const DEEP_PRED = TERRAIN.map((_, i) => i === T.DEEP);

const darken = (c: number, k: number): number => {
  const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255, a = c >>> 24;
  return pack(r * (1 - k) + 12 * k, g * (1 - k) + 14 * k, b * (1 - k) + 34 * k, a);
};
const lighten = (c: number, k: number): number => {
  const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255, a = c >>> 24;
  return pack(r + (255 - r) * k, g + (250 - g) * k, b + (225 - b) * k, a);
};

export interface BakedChunk { land: HTMLCanvasElement; foam: HTMLCanvasElement; hasWater: boolean }

export function bakeChunk(world: World, cx: number, cy: number, into?: BakedChunk): BakedChunk {
  const X0 = cx * CHUNK_PX, Y0 = cy * CHUNK_PX;
  // 1. terrain id per pixel (buffer origin is offset by PAD / PAD_TOP)
  let anyWater = false;
  for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) {
    const t = pickTerrain(world, X0 + bx - PAD, Y0 + by - PAD_TOP);
    ter[by * BW + bx] = t;
  }
  chamfer(dLand, WATER_PRED, true);   // distance to land (0 on land)
  chamfer(dWater, LAND_PRED, true);   // distance to water (0 on water)
  chamfer(dDeep, DEEP_PRED, false);    // distance to deep ocean

  const land = into?.land ?? document.createElement('canvas');
  const foam = into?.foam ?? document.createElement('canvas');
  land.width = land.height = foam.width = foam.height = CHUNK_PX;
  const lctx = land.getContext('2d')!, fctx = foam.getContext('2d')!;
  const img = lctx.createImageData(CHUNK_PX, CHUNK_PX), px32 = new Uint32Array(img.data.buffer);
  const fimg = fctx.createImageData(CHUNK_PX, CHUNK_PX), f32 = new Uint32Array(fimg.data.buffer);
  const FOAM = pack(244, 250, 255, 255), FOAM2 = pack(200, 232, 245, 255);

  // Cliff scan state per column.
  const hiY = new Int16Array(BW).fill(-1000), hiLv = new Uint8Array(BW);

  for (let by = 0; by < BH; by++) {
    for (let bx = 0; bx < BW; bx++) {
      const bi = by * BW + bx, t = ter[bi], lv = LEVEL[t];
      // update the column's most recent high pixel
      if (lv >= 2) { hiY[bx] = by; hiLv[bx] = lv; }
      const ox = bx - PAD, oy = by - PAD_TOP;
      if (ox < 0 || oy < 0 || ox >= CHUNK_PX || oy >= CHUNK_PX) continue;
      const wpx = X0 + ox, wpy = Y0 + oy, oi = oy * CHUNK_PX + ox;
      let col: number;

      if (isWater[t]) {
        const dl = dLand[bi];
        if (t === T.DEEP) {
          // deep water: transparent, except a seabed haze where it is near land
          col = 0;
        } else {
          // seabed gradient: sandy and nearly opaque at the beach, clear turquoise further out
          const near = Math.max(0, 1 - dl / 22) + (hash2(wpx, wpy, 7) - 0.5) * 0.16 + (nzB(wpx, wpy) / 255 - 0.5) * 0.1;
          const band = near > 0.72 ? 0 : near > 0.42 ? 1 : near > 0.15 ? 2 : 3;
          // fade out toward the deep ocean with a dither, so the shelf edge is a gradient, not a polygon
          const dd = dDeep[bi], fade = dd >= 14 ? 1 : (dd / 14) * 0.85 + 0.15 * (hash2(wpx, wpy, 19) > 0.5 ? 1 : 0);
          const alpha = Math.round([236, 205, 168, 120][band] * fade);
          col = (SAND_BED[band] & 0x00ffffff) | (alpha << 24);
          // sandy ripples visible through the shallows
          if (band <= 1 && Math.sin(wpy * 0.42 + nzA(wpx, wpy) / 255 * 5 + wpx * 0.11) > 0.93) col = (SAND_BED[0] & 0x00ffffff) | (alpha << 24);
        }
        anyWater = true;
        // foam: crisp line right at the shore + a dithered surf band; animated by alpha in the renderer
        const dl2 = dl;
        if (dl2 <= 1) f32[oi] = FOAM;
        else if (dl2 <= 3) f32[oi] = ((wpx + wpy) & 1) === 0 ? FOAM : 0;
        else if (dl2 <= 6 && hash2(wpx, wpy, 17) > 0.5 + (dl2 - 3) * 0.14) f32[oi] = FOAM2;
        else f32[oi] = 0;
      } else {
        col = texture(t, wpx, wpy);
        f32[oi] = 0;
        const myRank = RANK[t];
        // --- wet sand / shoreline darkening and a dry-edge highlight
        const dw = dWater[bi];
        if (dw <= 2) col = darken(col, dw === 0 ? 0.0 : dw === 1 ? 0.32 : 0.14);
        // --- border rims against lower-ranked neighbours at the same level (light from NW)
        const tN = ter[bi - BW], tW = ter[bi - 1], tS = ter[bi + BW], tE = ter[bi + 1];
        if (!isWater[tN] && LEVEL[tN] === lv && RANK[tN] < myRank) col = lighten(col, 0.18);
        else if (!isWater[tW] && LEVEL[tW] === lv && RANK[tW] < myRank) col = lighten(col, 0.1);
        if (!isWater[tS] && LEVEL[tS] === lv && RANK[tS] < myRank) col = darken(col, 0.3);
        else if (!isWater[tE] && LEVEL[tE] === lv && RANK[tE] < myRank) col = darken(col, 0.18);
        // --- elevation rims: raised ground catches light on its north/west lip
        if (lv >= 2) {
          if (LEVEL[tN] < lv) col = lighten(col, 0.34);
          else if (LEVEL[tW] < lv) col = lighten(col, 0.16);
          if (LEVEL[tE] < lv) col = darken(col, 0.18);
        }
        // --- cliff faces: pixels below a raised area, within face height, become rock wall
        if (lv < hiLv[bx] && hiY[bx] >= 0) {
          const d = by - hiY[bx], diff = hiLv[bx] - lv, face = diff === 1 ? 9 : 17;
          if (d <= face) {
            const f = d / face; // 0 at the lip → 1 at the foot
            const rock = PAL[T.MOUNTAIN].c;
            const strat = (hash2(wpx >> 1, d >> 2, 111) - 0.5) * 0.22 + (nzB(wpx * 2, d * 3) / 255 - 0.5) * 0.12;
            const k = f * 0.62 + strat;
            col = d <= 1 ? PAL[hiLv[bx] === 2 ? T.HILL : T.MOUNTAIN].c[3]
              : k < 0.18 ? rock[3] : k < 0.38 ? rock[2] : k < 0.6 ? rock[1] : rock[0];
            if (d === face) col = darken(col, 0.35);
            if (hash2(wpx, wpy, 113) > 0.985) col = darken(col, 0.4); // cracks
            if (d >= 2 && d < face - 1 && (wpx % 7) === 0 && hash2(wpx, d >> 2, 114) < 0.45) col = darken(col, 0.28); // vertical grooves
          } else if (d <= face + 7) {
            col = darken(col, 0.42 * (1 - (d - face) / 8)); // contact shadow on the ground
          }
        }
      }
      px32[oi] = col;
    }
    if (by >= BH) break;
  }
  lctx.putImageData(img, 0, 0);
  fctx.putImageData(fimg, 0, 0);
  void mix; void ramp;
  const res = into ?? { land, foam, hasWater: false };
  res.hasWater = anyWater;
  return res;
}
