import { Pix, toPacked, bayer } from './pix';
import { ramp, hex, pack } from './color';
import { hash2 } from '../core/rng';
import type { Race } from './humanoid';
import type { ShipKind } from '../sim/species';

/**
 * Ships, painted procedurally in three views (east; west is its mirror; south = bow toward the viewer; north = stern toward the viewer).
 * Every hull is the same planked shell — strakes, a sheer line that rises at the ends, a dark waterline — then re-dressed per kind
 * (masts, castles, oars, ram, prow) and per race (palette and prow). The realm's colour goes on sails, pennants and shields.
 * `anim` frames (0..3) swing the oars, billow the sails and wave the flags; a moored ship furls its sails.
 */
export const SHIP_FRAMES = 4;
export interface ShipSpr { img: HTMLCanvasElement; gx: number; gy: number; w: number; h: number }

const rc = new Map<string, number[]>();
const R = (c: string, n = 5): number[] => { const k = c + n; let v = rc.get(k); if (!v) { v = toPacked(ramp(c, n)); rc.set(k, v); } return v; };
const col = (h: string, a = 255): number => { const c = hex(h); return pack(c[0], c[1], c[2], a); };
const clampI = (k: number, n: number): number => Math.max(0, Math.min(n - 1, Math.round(k)));

interface Pal { hull: string; trim: string; sail: string; dark: string; accent: string; prow: 'dragon' | 'swan' | 'iron' | 'plain' }
const PAL: Record<Race, Pal> = {
  human: { hull: '#8a5a34', trim: '#e8dcc0', sail: '#eee6cf', dark: '#3a2616', accent: '#b0503c', prow: 'plain' },
  elf: { hull: '#e6dec6', trim: '#d8b050', sail: '#c4f2d6', dark: '#7a6a48', accent: '#4a9c70', prow: 'swan' },
  dwarf: { hull: '#4e525c', trim: '#9aa4b4', sail: '#cfc8b8', dark: '#22262e', accent: '#c8742a', prow: 'iron' },
  orc: { hull: '#3c2c24', trim: '#d8cfb4', sail: '#8a2c24', dark: '#1c1410', accent: '#c8452a', prow: 'dragon' },
};

interface Spec { w: number; h: number; gx: number; gy: number; L: number; sheer: number; bow: number; stern: number; lift: number; beam: number }
const SPEC: Record<ShipKind, Spec> = {
  canoe: { w: 52, h: 34, gx: 26, gy: 26, L: 36, sheer: 5, bow: 4, stern: 3, lift: 3, beam: 11 },
  fishboat: { w: 76, h: 62, gx: 38, gy: 52, L: 58, sheer: 11, bow: 6, stern: 4, lift: 4, beam: 18 },
  cog: { w: 100, h: 112, gx: 50, gy: 100, L: 72, sheer: 15, bow: 9, stern: 8, lift: 5, beam: 26 },
  longship: { w: 112, h: 74, gx: 56, gy: 62, L: 90, sheer: 9, bow: 13, stern: 12, lift: 5, beam: 20 },
  galley: { w: 124, h: 84, gx: 62, gy: 72, L: 98, sheer: 10, bow: 4, stern: 9, lift: 4, beam: 18 },
  galleon: { w: 140, h: 164, gx: 70, gy: 150, L: 112, sheer: 19, bow: 12, stern: 24, lift: 6, beam: 34 },
};
export const shipSpec = (k: ShipKind): Spec => SPEC[k];

/* ---- shared pieces ---------------------------------------------------------------------------------------- */
const wave = (f: number, k = 0): number => Math.sin((f / SHIP_FRAMES) * 6.283 + k);

function figure(px: Pix, x: number, y: number, shirt: string, skin = '#e0a97c', hat?: string): void {
  px.rect(x, y - 4, 2, 2, col(skin)); px.rect(x - 1, y - 2, 4, 3, col(shirt)); px.rect(x - 1, y + 1, 1, 2, col('#3a2a20')); px.rect(x + 1, y + 1, 1, 2, col('#3a2a20'));
  if (hat) px.rect(x - 1, y - 5, 4, 1, col(hat));
}

/** The planked shell, seen from the side. Returns the sheer line so decks can sit on it. */
function hullSide(px: Pix, s: Spec, pal: Pal, opts: { band?: boolean; tall?: number } = {}): (x: number) => number {
  const hp = R(pal.hull), x0 = Math.round(s.gx - s.L / 2), x1 = Math.round(s.gx + s.L / 2);
  const sheerAt = (x: number): number => { const u = (x - x0) / s.L; return s.gy - s.sheer - s.bow * Math.pow(Math.max(0, u), 3) - s.stern * Math.pow(Math.max(0, 1 - u), 2.4); };
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / s.L, top = Math.round(sheerAt(x)), bot = Math.round(s.gy - s.lift * Math.pow(Math.abs(2 * u - 1), 3));
    // the ends taper to a stem: cut a few rows off the top at the very tip
    const tip = Math.max(0, 1 - Math.min(u, 1 - u) * 14);
    for (let y = top + Math.round(tip * 3); y <= bot; y++) {
      const t = (y - top) / Math.max(1, bot - top), strake = (y - top) % 3 === 0;
      let k = 2.4 - t * 0.9 - u * 0.45 + (bayer(x, y) - 0.5) * 0.45 + (t < 0.12 ? 0.9 : 0);
      if (strake) k -= 0.85;
      if (y >= bot - 1) k -= 1.1;
      px.set(x, y, hp[clampI(k, 5)]);
    }
    if (opts.band) { const by = top + 3; px.set(x, by, R(pal.trim)[3]); px.set(x, by + 1, R(pal.trim)[1]); }
    // gunwale
    px.set(x, top, R(pal.trim)[3]); px.set(x, top - 1, R(pal.dark)[2]);
    // shadow on the water
    px.set(x, bot + 1, col('#0a2a50', 120)); if (Math.abs(2 * u - 1) < 0.85) px.set(x, bot + 2, col('#0a2a50', 70));
  }
  return sheerAt;
}

function mast(px: Pix, x: number, y0: number, y1: number, w = 2): void {
  const mp = R('#8a5a34');
  for (let y = y0; y < y1; y++) for (let i = 0; i < w; i++) px.set(x + i, y, mp[clampI(3 - i * 1.4 + (y % 7 === 0 ? -0.6 : 0), 5)]);
}

/** A square sail seen 3/4: cloth seams, a stripe in the realm's colour, belly that breathes with the frame. */
function sail(px: Pix, cx: number, yt: number, sw: number, sh: number, pal: Pal, color: string, f: number, furled: boolean, seed = 0, stripe = true): void {
  const sp = R(pal.sail), kp = R(color), spar = R('#7a5a34');
  if (furled) { px.rect(Math.round(cx - sw / 2), yt, sw, 3, spar[2]); px.rect(Math.round(cx - sw / 2) + 1, yt + 3, sw - 2, 3, sp[2]); px.rect(Math.round(cx - sw / 2) + 1, yt + 4, sw - 2, 1, sp[1]); return; }
  const bil = 2.2 + wave(f, seed) * 0.9;
  for (let y = 0; y < sh; y++) {
    const v = y / sh, off = Math.round(Math.sin(v * Math.PI) * bil * 0.8);
    for (let x = 0; x < sw; x++) {
      const u = x / sw, belly = Math.sin(u * Math.PI) * bil * (0.4 + v * 0.8);
      const py = yt + y, pxx = Math.round(cx - sw / 2 + x + off);
      let k = 3.2 - u * 1.5 - Math.abs(belly) * 0.12 + (hash2(x >> 2, y >> 2, seed + 4) - 0.5) * 0.5 + (bayer(pxx, py) - 0.5) * 0.35;
      if (x % 9 === 0) k -= 0.7;
      if (y === sh - 1 || x === 0 || x === sw - 1) k -= 0.9;
      let c = sp[clampI(k, 5)];
      if (stripe && y > sh * 0.34 && y < sh * 0.58) c = kp[clampI(2.4 - u * 1.2 + (bayer(pxx, py) - 0.5) * 0.4, 5)];
      px.set(pxx, py, c);
    }
  }
  px.rect(Math.round(cx - sw / 2) - 1, yt - 1, sw + 2, 2, spar[3]); // yard
}

function pennant(px: Pix, x: number, y: number, color: string, f: number, len = 12): void {
  const kp = R(color);
  px.rect(x, y, 1, 7, R('#5a4028')[2]);
  for (let i = 0; i < len; i++) { const wv = Math.round(Math.sin(f * 1.57 + i * 0.6) * (1 + i * 0.08)); px.set(x + 1 + i, y + wv, kp[3]); px.set(x + 1 + i, y + wv + 1, kp[2]); if (i < len - 4) px.set(x + 1 + i, y + wv + 2, kp[1]); }
}

function oars(px: Pix, sheerAt: (x: number) => number, x0: number, x1: number, n: number, gy: number, f: number, pal: Pal, rows = 1): void {
  const op = R('#9a7a4a');
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / n, sw = wave(f, i * 0.5 + r * 1.2) * 4, top = Math.round(sheerAt(x)) + 3 + r * 4;
    px.line(x, top, x + 2 + sw, gy + 5 + r * 0, op[3]); px.line(x + 1, top, x + 3 + sw, gy + 5, op[1]);
    px.rect(Math.round(x + 2 + sw) - 1, gy + 4, 3, 2, col(pal.dark)); px.set(Math.round(x + 2 + sw), gy + 5, col('#cfe8ff', 160));
  }
}

function prow(px: Pix, s: Spec, pal: Pal, sheerAt: (x: number) => number, x1: number): void {
  const y = Math.round(sheerAt(x1)), hp = R(pal.hull), tp = R(pal.trim);
  if (pal.prow === 'dragon') { px.limb(x1 - 2, y + 4, x1 + 3, y - 6, 3, 2, hp); px.blob(x1 + 6, y - 9, 4, 3, R('#6a8a3a'), { dither: 0.3 }); px.rect(x1 + 8, y - 8, 4, 2, R('#5a7a30')[2]); px.set(x1 + 6, y - 10, col('#ffe050')); px.set(x1 + 7, y - 13, tp[3]); px.set(x1 + 3, y - 12, tp[3]); }
  else if (pal.prow === 'swan') { px.limb(x1 - 2, y + 4, x1 + 5, y - 6, 3, 2, tp); px.limb(x1 + 5, y - 6, x1 + 4, y - 13, 2.2, 2, tp); px.blob(x1 + 7, y - 14, 2.4, 2, R('#fff6dc'), { dither: 0.2 }); px.rect(x1 + 9, y - 14, 2, 1, col('#e8a030')); }
  else if (pal.prow === 'iron') { px.poly([[x1 - 2, y + 3], [x1 + 6, y + 3], [x1 + 3, y - 5]], R('#8a94a4')[3]); px.line(x1, y + 3, x1 + 3, y - 5, R('#cfd8e4')[4]); }
  else { px.limb(x1 - 1, y + 4, x1 + 3, y - 4, 2.4, 2, hp); px.set(x1 + 3, y - 5, tp[3]); }
  void s;
}

function ramBeak(px: Pix, x1: number, gy: number): void {
  const ip = R('#9aa4b4');
  px.poly([[x1 - 3, gy - 4], [x1 + 11, gy + 1], [x1 - 3, gy + 1]], (x, y) => ip[clampI(2.6 - (y - gy + 4) * 0.4 - (x - x1) * 0.04, 5)]);
  px.line(x1 + 11, gy + 1, x1 + 4, gy - 3, ip[4]);
}

function barrels(px: Pix, x: number, y: number, n: number): void { for (let i = 0; i < n; i++) { px.blob(x + i * 5, y - 3, 2.4, 3.2, R('#8a5a30'), { dither: 0.3 }); px.rect(x + i * 5 - 2, y - 4, 5, 1, col('#33343a')); } }
function crates(px: Pix, x: number, y: number, n: number): void { const w = R('#a07a48'); for (let i = 0; i < n; i++) { px.rect(x + i * 6, y - 5, 5, 5, w[2]); px.rect(x + i * 6, y - 5, 5, 1, w[4]); px.rect(x + i * 6 + 4, y - 4, 1, 4, w[0]); } }
function netPile(px: Pix, x: number, y: number): void { const nn = R('#9a9684'); px.blob(x, y - 3, 5, 3.4, nn, { dither: 0.9 }); for (let i = -4; i <= 4; i += 2) px.set(x + i, y - 3 + (i & 2), col('#3a3a30')); }

/* ---- east view ----------------------------------------------------------------------------------------------- */
function paintEast(kind: ShipKind, race: Race, f: number, color: string, furled: boolean, net: boolean): Pix {
  const s = SPEC[kind], pal = PAL[race], px = new Pix(s.w, s.h);
  const x0 = Math.round(s.gx - s.L / 2), x1 = Math.round(s.gx + s.L / 2), gy = s.gy;
  const kp = R(color);
  const bob = 0;
  void bob;
  switch (kind) {
    case 'canoe': {
      const sh = hullSide(px, s, pal);
      const dp = R(pal.dark); px.rect(x0 + 6, Math.round(sh(x0 + 6)) + 1, s.L - 12, 2, dp[1]); // hollow
      figure(px, s.gx - 2, Math.round(sh(s.gx)) + 3, '#4a7a9a', '#e0a97c', '#d8b25a');
      const st = wave(f, 0) * 5; px.line(s.gx + 1, Math.round(sh(s.gx)) - 2, s.gx + 8 + st, gy + 3, R('#9a7a4a')[3]); px.rect(Math.round(s.gx + 8 + st) - 1, gy + 2, 3, 2, R('#9a7a4a')[2]);
      if (net) netPile(px, s.gx - 11, Math.round(sh(s.gx - 11)) + 3);
      break;
    }
    case 'fishboat': {
      const sh = hullSide(px, s, pal, { band: true });
      const my = Math.round(sh(s.gx + 4)); mast(px, s.gx + 3, my - 36, my);
      if (furled) { px.rect(s.gx - 6, my - 34, 14, 2, R('#7a5a34')[2]); px.rect(s.gx - 5, my - 32, 12, 3, R(pal.sail)[2]); }
      else { const sp = R(pal.sail); px.poly([[s.gx + 4, my - 34], [s.gx + 4, my - 4], [s.gx - 18 + Math.round(wave(f, 1) * 1.2), my - 5]], (x, y) => sp[clampI(3.2 - (s.gx + 4 - x) * 0.09 + (hash2(x >> 2, y >> 2, 3) - 0.5) * 0.4 + (bayer(x, y) - 0.5) * 0.3 - ((y - my + 34) % 8 === 0 ? 0.7 : 0), 5)]); px.line(s.gx + 4, my - 34, s.gx - 18, my - 5, R('#7a5a34')[3]); }
      pennant(px, s.gx + 3, my - 43, color, f, 9);
      // little wheelhouse at the stern
      const hx = x0 + 6, hy = Math.round(sh(hx)); const wp = R(pal.hull); px.rect(hx, hy - 9, 12, 9, wp[2]); px.rect(hx, hy - 9, 12, 1, wp[4]); px.rect(hx + 3, hy - 6, 4, 4, col('#ffd36a')); px.poly([[hx - 1, hy - 9], [hx + 6, hy - 15], [hx + 13, hy - 9]], R(pal.accent)[2]);
      if (net) { netPile(px, s.gx + 17, Math.round(sh(s.gx + 17)) + 2); } else { crates(px, s.gx + 14, Math.round(sh(s.gx + 14)) + 1, 2); }
      barrels(px, s.gx - 12, Math.round(sh(s.gx - 12)) + 2, 2);
      figure(px, s.gx + 9, Math.round(sh(s.gx + 9)) + 3, '#4a7a9a', '#e0a97c', '#d8b25a');
      // bow lantern
      const lx = x1 - 3, ly = Math.round(sh(lx)) - 7; px.rect(lx, ly, 1, 7, R('#5a4028')[2]); px.rect(lx - 1, ly - 3, 3, 3, col('#ffd36a'));
      prow(px, s, { ...pal, prow: 'plain' }, sh, x1);
      break;
    }
    case 'cog': {
      const sh = hullSide(px, s, pal, { band: true });
      const my = Math.round(sh(s.gx - 2));
      // aft castle
      const ax = x0 + 2, ay = Math.round(sh(ax + 8)); const cp = R(pal.hull);
      px.rect(ax, ay - 13, 22, 13, cp[2]); for (let i = 0; i < 22; i++) { px.set(ax + i, ay - 13, R(pal.trim)[3]); px.set(ax + i, ay - 14, R(pal.dark)[2]); } for (let y = ay - 13; y < ay; y += 3) px.rect(ax, y, 22, 1, cp[1]);
      px.rect(ax + 4, ay - 9, 4, 4, col('#ffd36a')); px.rect(ax + 12, ay - 9, 4, 4, col('#ffd36a'));
      for (let i = 0; i < 22; i += 3) px.rect(ax + i, ay - 18, 2, 4, R(pal.dark)[3]); px.rect(ax, ay - 18, 22, 1, R(pal.dark)[3]);
      // fore castle
      const fx = x1 - 17, fy = Math.round(sh(fx + 6)); px.rect(fx, fy - 9, 15, 9, cp[2]); for (let i = 0; i < 15; i++) { px.set(fx + i, fy - 9, R(pal.trim)[3]); } for (let y = fy - 9; y < fy; y += 3) px.rect(fx, y, 15, 1, cp[1]);
      // mast and sails
      mast(px, s.gx - 3, my - 62, my, 3);
      sail(px, s.gx + 3, my - 58, 34, 34, pal, color, f, furled, 2);
      if (!furled) sail(px, s.gx + 2, my - 82 + 22, 24, 12, pal, color, f + 1, furled, 6, false);
      px.rect(s.gx - 5, my - 66, 5, 4, R('#6a4a28')[2]); // crow's nest
      pennant(px, s.gx - 3, my - 76, color, f, 13);
      barrels(px, s.gx - 12, Math.round(sh(s.gx - 12)) + 1, 3); crates(px, s.gx + 8, Math.round(sh(s.gx + 8)) + 1, 3);
      prow(px, s, { ...pal, prow: pal.prow === 'dragon' ? 'dragon' : 'plain' }, sh, x1);
      figure(px, s.gx + 20, Math.round(sh(s.gx + 20)) + 3, '#e4e8f0', '#e0a97c', '#2a4a7a');
      break;
    }
    case 'longship': {
      const sh = hullSide(px, s, pal, { band: true });
      // shields along the rail
      const sc = [color, pal.trim];
      for (let i = 0; i < 11; i++) { const x = x0 + 12 + i * 6.2, y = Math.round(sh(x)) + 3; px.blob(x, y, 2.7, 2.7, R(sc[i % 2]), { dither: 0.2 }); px.set(Math.round(x), y, R('#cfd8e4')[4]); }
      oars(px, sh, x0 + 10, x1 - 12, 9, gy, f, pal);
      const my = Math.round(sh(s.gx));
      mast(px, s.gx, my - 46, my, 2);
      if (furled) { px.rect(s.gx - 14, my - 44, 28, 3, R('#7a5a34')[2]); px.rect(s.gx - 13, my - 41, 26, 3, R(pal.sail)[1]); }
      else {
        const sw = 34, shh = 28, cx = s.gx + 2; // alternating stripes
        for (let y = 0; y < shh; y++) { const belly = Math.round(Math.sin((y / shh) * Math.PI) * (1.5 + wave(f, 2) * 0.8)); for (let x = 0; x < sw; x++) { const stripe = Math.floor(x / 6) % 2 === 0; const cc = stripe ? R(color) : R(pal.sail); px.set(cx - sw / 2 + x + belly, my - 44 + y, cc[clampI(3 - (x / sw) * 1.3 + (bayer(x, y) - 0.5) * 0.4 + (y === shh - 1 ? -1 : 0), 5)]); } }
        px.rect(cx - sw / 2 - 1, my - 45, sw + 2, 2, R('#7a5a34')[3]);
      }
      pennant(px, s.gx, my - 54, color, f, 12);
      prow(px, s, pal, sh, x1);
      // stern post with a small standard
      px.limb(x0 + 1, Math.round(sh(x0 + 2)) + 3, x0 - 1, Math.round(sh(x0 + 2)) - 8, 2.4, 2, R(pal.hull)); px.set(x0 - 1, Math.round(sh(x0 + 2)) - 9, R(pal.trim)[4]);
      figure(px, s.gx - 14, Math.round(sh(s.gx - 14)) + 3, '#a8483a', '#e0a97c'); figure(px, s.gx + 14, Math.round(sh(s.gx + 14)) + 3, '#6a7a8a', '#e0a97c');
      break;
    }
    case 'galley': {
      const sh = hullSide(px, s, pal, { band: true });
      oars(px, sh, x0 + 14, x1 - 16, 11, gy, f, pal, 2);
      ramBeak(px, x1, gy);
      // raised fighting deck with awnings and archers
      const dy = Math.round(sh(s.gx)) - 7; px.rect(x0 + 22, dy, s.L - 44, 7, R(pal.hull)[2]); for (let i = 0; i < s.L - 44; i++) px.set(x0 + 22 + i, dy, R(pal.trim)[3]); for (let x = x0 + 22; x < x0 + s.L - 22; x += 5) px.rect(x, dy - 3, 3, 3, R(pal.hull)[3]);
      for (let i = 0; i < 4; i++) { figure(px, x0 + 30 + i * 11, dy + 2, '#4a6a3a', '#e0a97c', '#8a8a92'); px.line(x0 + 33 + i * 11, dy - 2, x0 + 35 + i * 11, dy + 3, R('#8a5a30')[3]); }
      const my = Math.round(sh(s.gx + 6));
      mast(px, s.gx + 4, my - 44, my, 2);
      if (furled) { px.line(s.gx + 4, my - 43, s.gx - 24, my - 10, R('#7a5a34')[3]); px.line(s.gx + 4, my - 42, s.gx - 24, my - 9, R(pal.sail)[2]); }
      else { const sp = R(pal.sail); px.poly([[s.gx + 4, my - 44], [s.gx + 4, my - 8], [s.gx - 30, my - 9], [s.gx - 30 + Math.round(wave(f, 2)), my - 10]], (x, y) => sp[clampI(3.1 - (s.gx + 4 - x) * 0.05 + (bayer(x, y) - 0.5) * 0.4 + ((x + y) % 11 === 0 ? -0.7 : 0), 5)]); px.line(s.gx + 4, my - 44, s.gx - 30, my - 9, R('#7a5a34')[3]); for (let y = my - 36; y < my - 12; y += 7) px.rect(s.gx - 20 + (my - y) * 0.05, y, 14, 2, kp[2]); }
      pennant(px, s.gx + 4, my - 53, color, f, 13);
      prow(px, s, { ...pal, prow: pal.prow === 'swan' || pal.prow === 'dragon' ? pal.prow : 'plain' }, sh, x1 - 2);
      // stern awning
      px.poly([[x0 + 2, Math.round(sh(x0 + 4)) - 14], [x0 + 20, Math.round(sh(x0 + 4)) - 14], [x0 + 22, Math.round(sh(x0 + 4)) - 6], [x0, Math.round(sh(x0 + 4)) - 6]], (x, y) => kp[clampI(2.4 + ((x >> 2) % 2) * 0.8 - (y - Math.round(sh(x0 + 4)) + 14) * 0.08, 5)]);
      break;
    }
    case 'galleon': {
      const sh = hullSide(px, s, pal, { band: true });
      const cp = R(pal.hull), tp = R(pal.trim);
      // stern castle: two decks of windows
      const ax = x0 - 1, ay = Math.round(sh(ax + 12));
      px.rect(ax, ay - 26, 34, 26, cp[2]); for (let y = ay - 26; y < ay; y += 3) px.rect(ax, y, 34, 1, cp[1]); for (let i = 0; i < 34; i++) { px.set(ax + i, ay - 26, tp[3]); px.set(ax + i, ay - 13, tp[2]); }
      for (let i = 0; i < 4; i++) { px.rect(ax + 4 + i * 8, ay - 22, 4, 5, col('#ffd36a')); px.rect(ax + 4 + i * 8, ay - 9, 4, 4, col('#ffd36a')); px.rect(ax + 4 + i * 8, ay - 22, 4, 1, R('#7a5a34')[2]); }
      for (let i = 0; i < 34; i += 3) px.rect(ax + i, ay - 30, 2, 4, R(pal.dark)[3]);
      px.rect(ax, ay - 30, 34, 1, R(pal.dark)[3]);
      // fore castle
      const fx = x1 - 20, fy = Math.round(sh(fx + 8)); px.rect(fx, fy - 13, 18, 13, cp[2]); for (let y = fy - 13; y < fy; y += 3) px.rect(fx, y, 18, 1, cp[1]); for (let i = 0; i < 18; i++) px.set(fx + i, fy - 13, tp[3]);
      // gun ports with iron barrels along the side
      for (let i = 0; i < 6; i++) { const x = x0 + 38 + i * 9, y = Math.round(sh(x)) + 6; px.rect(x, y, 5, 4, R(pal.dark)[0]); px.rect(x + 3, y + 1, 4, 2, R('#8a94a4')[2]); }
      // three masts
      const m1 = s.gx - 14, m2 = s.gx + 8, m3 = s.gx + 32;
      const base = (x: number): number => Math.round(sh(x));
      mast(px, m1, base(m1) - 76, base(m1), 3); mast(px, m2, base(m2) - 100, base(m2), 3); mast(px, m3, base(m3) - 58, base(m3), 2);
      if (furled) { for (const [mx, yy, w] of [[m2, 86, 40], [m1, 62, 30]] as [number, number, number][]) sail(px, mx + 1, base(mx) - yy, w, 0, pal, color, f, true); }
      else {
        sail(px, m2 + 1, base(m2) - 98, 26, 14, pal, color, f + 1, false, 5, false); sail(px, m2 + 1, base(m2) - 82, 38, 22, pal, color, f, false, 1); sail(px, m2 + 1, base(m2) - 58, 50, 28, pal, color, f + 2, false, 8);
        sail(px, m1 + 1, base(m1) - 70, 28, 18, pal, color, f + 3, false, 9, false); sail(px, m1 + 1, base(m1) - 50, 38, 24, pal, color, f + 1, false, 3);
      }
      if (!furled) { const sp = R(pal.sail); px.poly([[m3, base(m3) - 56], [m3, base(m3) - 22], [m3 - 24, base(m3) - 22]], (x, y) => sp[clampI(3 - (m3 - x) * 0.05 + (bayer(x, y) - 0.5) * 0.4, 5)]); }
      pennant(px, m2, base(m2) - 108, color, f, 15); pennant(px, m1, base(m1) - 84, color, f + 1, 11);
      // stone-thrower on the foredeck
      const cx = x1 - 36, cy = fy - 13; px.rect(cx, cy - 3, 14, 3, R('#7a5a34')[2]); px.limb(cx + 2, cy - 3, cx + 11, cy - 14, 2.4, 2, R('#9a6a3c')); px.blob(cx + 11, cy - 15, 2.4, 2, R('#8a8890'), { dither: 0.3 });
      prow(px, s, { ...pal, prow: pal.prow === 'plain' ? 'plain' : pal.prow }, sh, x1);
      px.limb(x1 - 1, Math.round(sh(x1)) - 2, x1 + 12, Math.round(sh(x1)) - 8, 2.6, 2, R('#6a4a28')); // bowsprit
      figure(px, s.gx + 20, base(s.gx + 20) + 3, '#e4e8f0', '#e0a97c', '#2a4a7a'); figure(px, s.gx - 26, base(s.gx - 26) + 3, '#a8483a');
      break;
    }
  }
  px.outline(0.55, [14, 12, 22]);
  return px;
}

/* ---- bow-on and stern-on views --------------------------------------------------------------------------------- */
function paintEnd(kind: ShipKind, race: Race, f: number, color: string, furled: boolean, bowOn: boolean): Pix {
  const s = SPEC[kind], pal = PAL[race], px = new Pix(s.w, s.h), hp = R(pal.hull), tp = R(pal.trim);
  const B = Math.round(s.beam * (kind === 'galleon' ? 1.1 : 1)), H = s.sheer + (bowOn ? s.bow * 0.5 : s.stern * 0.6), gy = s.gy, gx = s.gx;
  const top = gy - H;
  for (let y = top; y <= gy; y++) {
    const t = (y - top) / H, half = (B / 2) * (bowOn ? 1 - 0.5 * t * t : 1 - 0.22 * t);
    for (let x = Math.round(gx - half); x <= Math.round(gx + half); x++) {
      const u = (x - (gx - half)) / Math.max(1, half * 2), strake = (y - top) % 3 === 0;
      let k = 2.5 - t * 0.8 - u * 0.5 + (bayer(x, y) - 0.5) * 0.45 + (t < 0.1 ? 0.8 : 0) - (strake ? 0.8 : 0) - (y >= gy - 1 ? 1.1 : 0);
      if (bowOn) k -= Math.abs(x - gx) < 1 ? -0.7 : 0; // keel highlight
      px.set(x, y, hp[clampI(k, 5)]);
    }
    px.set(Math.round(gx - half), y, R(pal.dark)[2]); px.set(Math.round(gx + half), y, R(pal.dark)[1]);
  }
  for (let x = Math.round(gx - B / 2); x <= Math.round(gx + B / 2); x++) { px.set(x, top, tp[3]); px.set(x, gy + 1, col('#0a2a50', 120)); }
  px.rect(gx - 1, gy - 4, 2, 6, R(pal.dark)[2]);
  const cx = gx;
  if (!bowOn) { // transom windows and rudder
    const nW = kind === 'galleon' ? 4 : kind === 'cog' ? 2 : 0;
    for (let i = 0; i < nW; i++) px.rect(cx - nW * 3 + i * 6 + 1, top + 3, 4, 4, col('#ffd36a'));
    px.rect(cx - 1, top + H * 0.5, 3, H * 0.5 + 3, R(pal.dark)[2]);
  } else if (pal.prow !== 'plain') { // figurehead
    if (pal.prow === 'dragon') { px.blob(cx, top - 4, 3.6, 3, R('#6a8a3a'), { dither: 0.3 }); px.set(cx - 1, top - 5, col('#ffe050')); px.set(cx + 1, top - 5, col('#ffe050')); }
    else if (pal.prow === 'swan') { px.blob(cx, top - 6, 2.4, 3.4, R('#fff6dc'), { dither: 0.3 }); px.set(cx, top - 3, col('#e8a030')); }
    else px.poly([[cx - 3, top], [cx + 3, top], [cx, top - 7]], R('#8a94a4')[3]);
  }
  // mast and a sail facing us
  const mh = kind === 'canoe' ? 0 : kind === 'fishboat' ? 34 : kind === 'cog' ? 58 : kind === 'longship' ? 44 : kind === 'galley' ? 40 : 90;
  if (mh) {
    mast(px, cx - 1, top - mh, top, 2);
    const sw = Math.round(B * (kind === 'galleon' ? 1.5 : 1.5)), sh = Math.round(mh * (kind === 'galleon' ? 0.24 : 0.55));
    if (furled) { px.rect(cx - sw / 2, top - mh + 2, sw, 3, R('#7a5a34')[2]); px.rect(cx - sw / 2 + 1, top - mh + 5, sw - 2, 3, R(pal.sail)[1]); }
    else {
      const levels = kind === 'galleon' ? 3 : 1;
      for (let l = 0; l < levels; l++) { const w2 = Math.round(sw * (1 - l * 0.22)), yt = top - mh + 4 + l * (sh + 3); const bil = 1 + wave(f, l) * 0.6; for (let y = 0; y < sh; y++) for (let x = 0; x < w2; x++) { const u = x / w2, belly = Math.sin(u * Math.PI) * 1.4 * bil; let k = 3.2 - Math.abs(u - 0.5) * 1.3 + belly * 0.3 + (bayer(x, y) - 0.5) * 0.4 - (x % 9 === 0 ? 0.6 : 0) - (y === sh - 1 ? 1 : 0); let c = R(pal.sail)[clampI(k, 5)]; if (y > sh * 0.34 && y < sh * 0.58) c = R(color)[clampI(2.6 - Math.abs(u - 0.5) * 1.2 + (bayer(x, y) - 0.5) * 0.4, 5)]; px.set(Math.round(cx - w2 / 2 + x), Math.round(yt + y + belly), c); } px.rect(Math.round(cx - w2 / 2) - 1, yt - 1, w2 + 2, 2, R('#7a5a34')[3]); }
    }
    pennant(px, cx - 1, top - mh - 9, color, f, 11);
  }
  if (kind === 'canoe') figure(px, cx - 1, top + 4, '#4a7a9a', '#e0a97c', '#d8b25a');
  // oars splay to both sides on rowed ships
  if (kind === 'longship' || kind === 'galley') { const op = R('#9a7a4a'); for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { const y = top + 4 + i * 4, sw = wave(f, i * 0.7) * 3; px.line(cx + sd * (B / 2), y, cx + sd * (B / 2 + 9 + sw), gy + 5, op[3]); px.set(Math.round(cx + sd * (B / 2 + 9 + sw)), gy + 5, col('#cfe8ff', 170)); } }
  px.outline(0.55, [14, 12, 22]);
  return px;
}

/* ---- public ------------------------------------------------------------------------------------------------------- */
const cache = new Map<string, ShipSpr>();
export function shipFrame(kind: ShipKind, race: Race, dir: 'N' | 'E' | 'S' | 'W', frame: number, color: string, furled: boolean, net = false): ShipSpr {
  const f = frame % SHIP_FRAMES, key = `${kind}|${race}|${dir}|${f}|${color}|${furled ? 1 : 0}|${net ? 1 : 0}`;
  let c = cache.get(key);
  if (!c) {
    const s = SPEC[kind];
    let p = dir === 'E' || dir === 'W' ? paintEast(kind, race, f, color, furled, net) : paintEnd(kind, race, f, color, furled, dir === 'S');
    if (dir === 'W') p = p.flipH();
    c = { img: p.toCanvas(), gx: s.gx, gy: s.gy, w: s.w, h: s.h };
    cache.set(key, c);
  }
  return c;
}
