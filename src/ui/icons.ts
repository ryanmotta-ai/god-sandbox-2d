import { Pix, toPacked } from '../gfx/pix';
import { ramp, hex, pack } from '../gfx/color';
import { terrainSwatch } from '../gfx/terrain';
import { plantSprite } from '../gfx/flora';
import { humanoidFrame } from '../gfx/humanoid';
import { makeLook } from '../gfx/looks';
import { animalFrame, type AnimalKind } from '../gfx/animals';
import { SPECIES, type Species } from '../sim/species';
import type { Race } from '../gfx/humanoid';

const R = (c: string): number[] => toPacked(ramp(c, 5));
const col = (h: string): number => { const c = hex(h); return pack(c[0], c[1], c[2]); };
const cache = new Map<string, HTMLCanvasElement>();
export const ICON = 28;

function fit(src: HTMLCanvasElement): HTMLCanvasElement {
  // crop to the opaque box, then scale to fit the icon
  const g = src.getContext('2d')!, d = g.getImageData(0, 0, src.width, src.height).data;
  let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = document.createElement('canvas'); out.width = out.height = ICON;
  if (x1 < x0) return out;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, s = Math.min(1, (ICON - 2) / Math.max(w, h)), dw = Math.max(1, Math.round(w * s)), dh = Math.max(1, Math.round(h * s));
  const o = out.getContext('2d')!; o.imageSmoothingEnabled = false;
  o.drawImage(src, x0, y0, w, h, Math.floor((ICON - dw) / 2), ICON - dh - 1, dw, dh);
  return out;
}

function glyph(name: string): HTMLCanvasElement {
  const p = new Pix(ICON, ICON);
  const o = (c = 0.6) => p.outline(c, [16, 12, 24]);
  switch (name) {
    case 'raise': case 'lower': { p.poly([[2, 22], [14, 7], [26, 22]], (x, y) => R('#8a8a90')[((x + y) & 1) ? 2 : 3]); p.poly([[8, 14], [14, 7], [20, 14]], col('#f4f6ff')); const up = name === 'raise'; p.poly(up ? [[14, 1], [19, 7], [9, 7]] : [[14, 27], [19, 21], [9, 21]], col(up ? '#7aff9a' : '#ff8a6a')); break; }
    case 'fert': p.blob(14, 18, 9, 4, R('#6a4a30')); for (let i = 0; i < 4; i++) { p.line(7 + i * 4, 17, 7 + i * 4, 10 - (i % 2) * 2, col('#4aaa3a')); p.set(6 + i * 4, 10 - (i % 2) * 2, col('#7ada5a')); p.set(8 + i * 4, 10 - (i % 2) * 2, col('#7ada5a')); } break;
    case 'fire': for (const [x, h, c] of [[10, 12, '#d8501a'], [14, 17, '#f08a1c'], [18, 11, '#d8501a']] as [number, number, string][]) p.blob(x, 22 - h / 2, 4, h / 2 + 1, R(c)); p.blob(14, 20, 2.4, 5, R('#fff0a0')); break;
    case 'rain': p.blob(11, 9, 7, 4.5, R('#8a98b4')); p.blob(18, 10, 6, 4, R('#98a6c0')); for (let i = 0; i < 4; i++) p.line(8 + i * 4, 17 + (i % 2) * 2, 6 + i * 4, 22 + (i % 2) * 2, col('#6aa8f0')); break;
    case 'snowfall': p.blob(11, 9, 7, 4.5, R('#b8c4d8')); p.blob(18, 10, 6, 4, R('#c8d2e4')); for (let i = 0; i < 5; i++) { p.set(7 + i * 4, 17 + (i % 2) * 3, col('#ffffff')); p.set(8 + i * 4, 18 + (i % 2) * 3, col('#d8e8ff')); } break;
    case 'sun': p.blob(14, 14, 6, 6, R('#ffd84a')); for (let a = 0; a < 8; a++) { const x = 14 + Math.cos(a * 0.785) * 10, y = 14 + Math.sin(a * 0.785) * 10; p.line(14 + Math.cos(a * 0.785) * 8, 14 + Math.sin(a * 0.785) * 8, x, y, col('#ffe27a')); } break;
    case 'bolt': p.poly([[16, 1], [7, 15], [13, 15], [10, 27], [21, 11], [15, 11], [19, 1]], (x, y) => ((x + y) & 1 ? col('#fff6a0') : col('#ffe040'))); break;
    case 'meteor': p.line(24, 2, 12, 14, col('#ff8a2a')); p.line(22, 2, 11, 12, col('#ffd060')); p.blob(10, 17, 6, 6, R('#8a6a50')); p.blob(10, 17, 3, 3, R('#ff8a2a'), { dither: 0.2 }); break;
    case 'quake': p.poly([[2, 14], [26, 14], [26, 24], [2, 24]], col('#6a4a30')); p.line(4, 14, 10, 18, col('#1a0e08')); p.line(10, 18, 8, 22, col('#1a0e08')); p.line(14, 14, 20, 20, col('#1a0e08')); p.line(20, 20, 24, 17, col('#1a0e08')); p.line(2, 10, 8, 8, col('#cdbd9a')); p.line(18, 9, 25, 11, col('#cdbd9a')); break;
    case 'tornado': for (let k = 0; k < 7; k++) p.blob(14 + Math.sin(k) * 2, 5 + k * 3, 3 + (6 - k) * 1.35, 1.9, R('#8a8a90'), { dither: 0.5 }); break;
    case 'volcano': p.poly([[2, 26], [11, 10], [17, 10], [26, 26]], (x, y) => R('#6a5a52')[((x + y) & 1) ? 1 : 2]); p.poly([[11, 10], [17, 10], [15, 13], [13, 13]], col('#ff6a1a')); p.blob(14, 6, 4, 4, R('#ffa02a')); p.set(10, 3, col('#ff6a1a')); p.set(19, 4, col('#ffd060')); break;
    case 'acid': p.blob(11, 9, 7, 4.5, R('#6a9a4a')); p.blob(18, 10, 6, 4, R('#7ab05a')); for (let i = 0; i < 4; i++) p.line(8 + i * 4, 17 + (i % 2) * 2, 8 + i * 4, 22 + (i % 2) * 3, col('#9aff4a')); break;
    case 'flood': for (let k = 0; k < 3; k++) for (let x = 2; x < 26; x++) p.set(x, 12 + k * 5 + Math.round(Math.sin(x * 0.7 + k) * 1.6), col(['#6ab8f0', '#3a90d8', '#1c64b0'][k])); p.rect(2, 17, 24, 8, col('#2a78c8')); break;
    case 'nuke': p.blob(14, 10, 9, 6, R('#e8d8c0')); p.blob(14, 6, 6, 5, R('#fff0c0')); p.rect(12, 14, 5, 10, col('#c8b090')); p.rect(7, 23, 15, 3, col('#a89070')); break;
    case 'plague': p.blob(14, 14, 7, 7, R('#8ac04a')); for (const [x, y] of [[5, 6], [23, 8], [24, 20], [4, 21], [14, 2], [14, 26]]) { p.line(14, 14, x, y, col('#6aa03a')); p.blob(x, y, 1.8, 1.8, R('#a8e060')); } p.set(12, 12, col('#222')); p.set(16, 12, col('#222')); break;
    case 'heal': p.rect(10, 4, 8, 20, col('#e8f4ea')); p.rect(4, 10, 20, 8, col('#e8f4ea')); p.rect(11, 5, 6, 18, col('#3ac85a')); p.rect(5, 11, 18, 6, col('#3ac85a')); break;
    case 'bless': p.blob(14, 14, 6, 6, R('#ffe27a')); for (let a = 0; a < 5; a++) p.line(14, 14, 14 + Math.cos(a * 1.257 - 1.57) * 12, 14 + Math.sin(a * 1.257 - 1.57) * 12, col('#fff6c0')); p.ellipse(14, 4, 5, 1.6, col('#ffe27a')); break;
    case 'curse': p.blob(14, 14, 8, 8, R('#7a3aa8')); p.rect(9, 11, 3, 3, col('#fff')); p.rect(16, 11, 3, 3, col('#fff')); p.rect(11, 18, 6, 2, col('#e8d0ff')); break;
    case 'smite': p.poly([[16, 1], [7, 15], [13, 15], [10, 27], [21, 11], [15, 11], [19, 1]], col('#ff4a4a')); p.ellipse(14, 26, 8, 2, col('#6a1a1a')); break;
    case 'erase': p.poly([[4, 20], [16, 6], [26, 14], [14, 26]], (x, y) => ((x + y) & 1 ? col('#f48a9a') : col('#e8708a'))); p.poly([[4, 20], [10, 13], [20, 21], [14, 26]], col('#ffffff')); break;
    case 'war': p.line(4, 24, 22, 6, col('#c8d0dc')); p.line(5, 24, 23, 6, col('#9aa4b4')); p.line(24, 24, 6, 6, col('#c8d0dc')); p.line(23, 24, 5, 6, col('#9aa4b4')); p.rect(3, 22, 6, 3, col('#c8a040')); p.rect(19, 22, 6, 3, col('#c8a040')); break;
    case 'peace': p.blob(14, 15, 8, 6, R('#f4f4f4')); p.blob(8, 12, 5, 4, R('#f4f4f4')); p.set(6, 10, col('#222')); p.line(20, 6, 20, 14, col('#7ad04a')); p.blob(20, 5, 3, 2, R('#7ad04a')); break;
    default: p.rect(6, 6, 16, 16, col('#555'));
  }
  o();
  return p.toCanvas();
}

export function iconFor(key: string): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  if (/^t\d+$/.test(key)) c = terrainSwatch(+key.slice(1), ICON);
  else if (/^o\d+$/.test(key)) c = fit(plantSprite(+key.slice(1), 1, 255, 1, 0, 0));
  else if (key.startsWith('u_')) {
    const sp = key.slice(2) as Species;
    if (SPECIES[sp].civ) c = fit(humanoidFrame(makeLook(sp as Race, 'soldier', 3, '#c0392b'), 'idle', 'S', 0));
    else if (sp === 'zombie') c = fit(humanoidFrame({ ...makeLook('human', 'peasant', 3), skin: '#7a9a5a', hairStyle: 2 }, 'idle', 'S', 0));
    else c = fit(animalFrame(sp as AnimalKind, sp === 'dragon' ? 'fly' : 'idle', false, 0));
  } else c = glyph(key);
  cache.set(key, c);
  return c;
}
