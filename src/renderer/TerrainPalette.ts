import { TerrainType } from '../world/Biomes';
import type { Tile, TileResource } from '../world/Tile';
import { ALL_GOODS, GOODS } from '../civ/Goods';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface TerrainVisual {
  base: string;
  low: string;
  high: string;
  shadow: string;
  accent: string;
}

export const TERRAIN_VISUALS: Record<TerrainType, TerrainVisual> = {
  // Palette philosophy: each biome owns a compact, readable material family.
  // The renderer should read the biome first and the texture second.
  [TerrainType.DEEP_OCEAN]: {
    base: '#103254',
    low: '#0a1d33',
    high: '#1c4975',
    shadow: '#061324',
    accent: '#64d2ff'
  },
  [TerrainType.SHALLOW_WATER]: {
    base: '#227f9e',
    low: '#175c75',
    high: '#3eb8cb',
    shadow: '#114457',
    accent: '#d8fcff'
  },
  [TerrainType.SAND]: {
    base: '#d5ba78',
    low: '#b08d52',
    high: '#ead59a',
    shadow: '#8c693c',
    accent: '#f5e8b8'
  },
  [TerrainType.SOIL]: {
    base: '#79563b',
    low: '#563a29',
    high: '#9a7351',
    shadow: '#3c281e',
    accent: '#b58a61'
  },
  [TerrainType.GRASS]: {
    base: '#4b984b',
    low: '#33713a',
    high: '#69b45c',
    shadow: '#285a32',
    accent: '#b9cf69'
  },
  [TerrainType.FOREST]: {
    base: '#2f7440',
    low: '#1d4d30',
    high: '#468c4d',
    shadow: '#163c27',
    accent: '#89b85d'
  },
  [TerrainType.SAVANNA]: {
    base: '#b39a58',
    low: '#876f3d',
    high: '#ceb86e',
    shadow: '#67532f',
    accent: '#e9d58a'
  },
  [TerrainType.SWAMP]: {
    base: '#456b4a',
    low: '#29473a',
    high: '#667e57',
    shadow: '#20382f',
    accent: '#92ad70'
  },
  [TerrainType.TUNDRA]: {
    base: '#789494',
    low: '#566f75',
    high: '#a0b5ad',
    shadow: '#40565f',
    accent: '#cddbd4'
  },
  [TerrainType.SNOW]: {
    base: '#dce8e9',
    low: '#b8c9cf',
    high: '#f6faf7',
    shadow: '#91aab6',
    accent: '#ffffff'
  },
  [TerrainType.MOUNTAIN]: {
    base: '#727a80',
    low: '#515b63',
    high: '#9ca2a6',
    shadow: '#39434b',
    accent: '#d8dde0'
  },
  [TerrainType.LAVA]: {
    base: '#b93827',
    low: '#611d18',
    high: '#f08a2c',
    shadow: '#2c1212',
    accent: '#ffd15e'
  },
  [TerrainType.ARCANE]: {
    base: '#7651aa',
    low: '#49346f',
    high: '#a47bd0',
    shadow: '#302346',
    accent: '#cfe6ef'
  },
  [TerrainType.CORRUPTED]: {
    base: '#51365d',
    low: '#30233a',
    high: '#745080',
    shadow: '#201728',
    accent: '#c24bd2'
  }
};

/**
 * Map colour for each deposit, taken straight from the goods table so a new
 * material never renders as an untinted blank tile.
 */
export const RESOURCE_COLORS: Record<Exclude<TileResource, null>, string> =
  Object.fromEntries(ALL_GOODS.map(good => [good, GOODS[good].color])) as Record<Exclude<TileResource, null>, string>;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function hash2(x: number, y: number, salt: number = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

const parseColorCache = new Map<string, Rgb>();
export function parseColor(color: string): Rgb {
  const cached = parseColorCache.get(color);
  if (cached) return cached;

  let result: Rgb = { r: 0, g: 0, b: 0 };
  if (color.startsWith('#')) {
    const raw = color.slice(1);
    const hex = raw.length === 3
      ? raw.split('').map(ch => ch + ch).join('')
      : raw.padEnd(6, '0').slice(0, 6);
    const num = parseInt(hex, 16);
    if (!Number.isNaN(num)) {
      result = {
        r: (num >> 16) & 0xff,
        g: (num >> 8) & 0xff,
        b: num & 0xff
      };
    }
  } else {
    const nums = color.match(/[\d.]+/g);
    if (nums && nums.length >= 3) {
      result = {
        r: clamp(Math.round(Number(nums[0])), 0, 255),
        g: clamp(Math.round(Number(nums[1])), 0, 255),
        b: clamp(Math.round(Number(nums[2])), 0, 255)
      };
    }
  }

  parseColorCache.set(color, result);
  return result;
}

export function toRgbString(rgb: Rgb): string {
  return `rgb(${clamp(Math.round(rgb.r), 0, 255)}, ${clamp(Math.round(rgb.g), 0, 255)}, ${clamp(Math.round(rgb.b), 0, 255)})`;
}

const mixColorCache = new Map<string, string>();
export function mixColor(a: string, b: string, amount: number): string {
  const key = a + '|' + b + '|' + amount;
  const cached = mixColorCache.get(key);
  if (cached !== undefined) return cached;

  const ca = parseColor(a);
  const cb = parseColor(b);
  const t = clamp(amount, 0, 1);
  const result = toRgbString({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t
  });
  mixColorCache.set(key, result);
  return result;
}

export function shadeColor(color: string, factor: number): string {
  const c = parseColor(color);
  return toRgbString({
    r: c.r * factor,
    g: c.g * factor,
    b: c.b * factor
  });
}

const withAlphaCache = new Map<string, string>();
export function withAlpha(color: string, alpha: number): string {
  const key = color + '|' + alpha;
  const cached = withAlphaCache.get(key);
  if (cached !== undefined) return cached;

  const c = parseColor(color);
  const result = `rgba(${c.r}, ${c.g}, ${c.b}, ${clamp(alpha, 0, 1)})`;
  withAlphaCache.set(key, result);
  return result;
}

/**
 * Smooth deterministic value noise. Unlike hash-per-tile grain, this creates
 * broad patches that survive zooming out and keep the map visually calm.
 */
export function valueNoise2D(x: number, y: number, scale: number, salt: number = 0): number {
  const safeScale = Math.max(1, scale);
  const sx = x / safeScale;
  const sy = y / safeScale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = sx - x0;
  const ty = sy - y0;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);

  const a = hash2(x0, y0, salt);
  const b = hash2(x1, y0, salt);
  const c = hash2(x0, y1, salt);
  const d = hash2(x1, y1, salt);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uy;
}

/** Quantise tonal variation so the map reads as deliberate pixel art, not a gradient. */
export function quantize01(value: number, steps: number = 5): number {
  const count = Math.max(2, Math.round(steps));
  const t = clamp(value, 0, 1);
  return Math.round(t * (count - 1)) / (count - 1);
}

function materialColor(visual: TerrainVisual, amount: number, steps: number = 5): string {
  const t = quantize01(amount, steps);
  if (t <= 0.5) return mixColor(visual.low, visual.base, t * 2);
  return mixColor(visual.base, visual.high, (t - 0.5) * 2);
}

/**
 * Sparse highlight colour that a terrain renderer may use for tiny material
 * details (foam, grass tips, snow sparkle, mineral edge). Returning null means
 * no accent should be drawn on that tile.
 */
export function terrainAccentColor(tile: Tile, x: number, y: number, animTimer: number = 0): string | null {
  const visual = TERRAIN_VISUALS[tile.type];
  const sparse = hash2(x, y, 97);

  if (tile.type === TerrainType.SHALLOW_WATER) {
    const crest = Math.sin(x * 0.28 + y * 0.22 + animTimer * 0.85) * 0.5 + 0.5;
    const caustic = Math.cos(x * 0.15 - y * 0.25 + animTimer * 0.45) * 0.5 + 0.5;
    return sparse > 0.84 && (crest > 0.58 || caustic > 0.72) ? visual.accent : null;
  }
  if (tile.type === TerrainType.DEEP_OCEAN) {
    const deepWave = Math.sin((x + y * 0.6) * 0.2 + animTimer * 0.4) * 0.5 + 0.5;
    return sparse > 0.94 && deepWave > 0.7 ? visual.accent : null;
  }
  if (tile.type === TerrainType.GRASS) return sparse > 0.91 ? visual.accent : null;
  if (tile.type === TerrainType.FOREST) return sparse > 0.95 ? visual.accent : null;
  if (tile.type === TerrainType.SAND) return sparse > 0.94 ? visual.accent : null;
  if (tile.type === TerrainType.SNOW) return sparse > 0.93 ? visual.accent : null;
  if (tile.type === TerrainType.MOUNTAIN) return sparse > 0.95 ? visual.accent : null;
  if (tile.type === TerrainType.LAVA) return sparse > 0.86 ? visual.accent : null;
  if (tile.type === TerrainType.ARCANE || tile.type === TerrainType.CORRUPTED) return sparse > 0.9 ? visual.accent : null;
  return null;
}

/**
 * WorldBox-like terrain philosophy:
 *  - biome identity first;
 *  - large coherent patches instead of noisy tile-by-tile grain;
 *  - only a few discrete shade levels;
 *  - restrained animation for water/lava;
 *  - elevation/moisture support the material instead of overpowering it.
 */
export function terrainSurfaceColor(tile: Tile, x: number, y: number, animTimer: number = 0): string {
  const visual = TERRAIN_VISUALS[tile.type];
  const macro = valueNoise2D(x, y, 9, 41);
  const medium = valueNoise2D(x, y, 4, 53);
  const micro = hash2(x, y, 11);
  const elevation = clamp(tile.height, 0, 1);
  const moisture = clamp(tile.moisture, 0, 1);

  // Water uses broad slow bands; avoid flickering every tile independently.
  if (tile.type === TerrainType.DEEP_OCEAN || tile.type === TerrainType.SHALLOW_WATER) {
    const broadWave = Math.sin(x * 0.16 + y * 0.13 + animTimer * 0.52) * 0.5 + 0.5;
    const crossWave = Math.sin(x * 0.07 - y * 0.09 + animTimer * 0.24) * 0.5 + 0.5;
    const shallow = tile.type === TerrainType.SHALLOW_WATER;
    const base = shallow ? 0.52 : 0.3;
    const amount = base
      + (broadWave - 0.5) * (shallow ? 0.18 : 0.12)
      + (crossWave - 0.5) * 0.08
      + (macro - 0.5) * 0.1;
    return materialColor(visual, amount, 6);
  }

  // Lava keeps motion, but as broad molten lanes instead of high-frequency noise.
  if (tile.type === TerrainType.LAVA) {
    const flow = Math.sin(x * 0.24 + y * 0.19 + animTimer * 0.9) * 0.5 + 0.5;
    const fissure = Math.sin(x * 0.43 - y * 0.31 + macro * 3.2) * 0.5 + 0.5;
    const amount = 0.35 + flow * 0.28 + Math.max(0, fissure - 0.62) * 0.55;
    return materialColor(visual, amount, 6);
  }

  let amount = 0.5;

  switch (tile.type) {
    case TerrainType.SAND: {
      const dune = Math.sin(x * 0.11 + y * 0.075 + macro * 2.1) * 0.5 + 0.5;
      amount = 0.52 + (macro - 0.5) * 0.18 + (dune - 0.5) * 0.12 + (micro - 0.5) * 0.025;
      break;
    }
    case TerrainType.SOIL:
      amount = 0.46 + (macro - 0.5) * 0.2 + (medium - 0.5) * 0.08 + (micro - 0.5) * 0.025;
      break;
    case TerrainType.GRASS:
      amount = 0.5 + (macro - 0.5) * 0.2 + (medium - 0.5) * 0.07 + (moisture - 0.5) * 0.08;
      break;
    case TerrainType.FOREST:
      amount = 0.38 + (macro - 0.5) * 0.16 + (medium - 0.5) * 0.06 + (moisture - 0.5) * 0.07;
      break;
    case TerrainType.SAVANNA:
      amount = 0.49 + (macro - 0.5) * 0.18 + (medium - 0.5) * 0.06 + (micro - 0.5) * 0.02;
      break;
    case TerrainType.SWAMP:
      amount = 0.37 + (macro - 0.5) * 0.14 + (medium - 0.5) * 0.06 + moisture * 0.06;
      break;
    case TerrainType.TUNDRA:
      amount = 0.48 + (macro - 0.5) * 0.14 + (medium - 0.5) * 0.05 + (tile.temperature < -5 ? 0.05 : 0);
      break;
    case TerrainType.SNOW:
      // Snow should be one of the quietest materials on the map.
      amount = 0.66 + (macro - 0.5) * 0.09 + (elevation - 0.5) * 0.08;
      break;
    case TerrainType.MOUNTAIN:
      // Mountains can carry stronger elevation contrast because it communicates form.
      amount = 0.34 + elevation * 0.3 + (macro - 0.5) * 0.16 + (medium - 0.5) * 0.05;
      break;
    case TerrainType.ARCANE: {
      const shimmer = Math.sin(x * 0.09 + y * 0.12 + animTimer * 0.16) * 0.5 + 0.5;
      amount = 0.48 + (macro - 0.5) * 0.14 + (shimmer - 0.5) * 0.08;
      break;
    }
    case TerrainType.CORRUPTED:
      amount = 0.4 + (macro - 0.5) * 0.17 + (medium - 0.5) * 0.06;
      break;
    default:
      amount = 0.5 + (macro - 0.5) * 0.16;
      break;
  }

  // Height remains present but intentionally subtle outside mountains/snow.
  if (tile.type !== TerrainType.MOUNTAIN && tile.type !== TerrainType.SNOW) {
    amount += (elevation - 0.5) * 0.08;
  }

  return materialColor(visual, amount, 5);
}
