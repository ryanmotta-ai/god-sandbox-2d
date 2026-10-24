import type { Unit } from '../sim/unit';
import { humanoidFrame, SPR_W, SPR_H, CX, GROUND, type Look } from '../gfx/humanoid';
import { animalFrame, A_SIZE, A_FRAMES, type AnimalKind, type AAnim } from '../gfx/animals';
import { ANIM_FRAMES, type Anim } from '../gfx/rig';
import { TILE } from '../core/config';
import { SPECIES } from '../sim/species';

export interface Drawn { img: HTMLCanvasElement; dx: number; dy: number; lift: number; shadow: number; w: number; h: number; clip: number }

const HUM_MAP: Record<string, Anim> = { idle: 'idle', walk: 'walk', run: 'run', chop: 'chop', mine: 'mine', farm: 'farm', hammer: 'hammer', attack: 'attack', shoot: 'shoot', cast: 'cast', carry: 'carry', eat: 'idle', die: 'die', sleep: 'sleep', fly: 'idle', breath: 'idle' };
const HUM_FPS: Record<string, number> = { idle: 2.2, walk: 8, run: 11.5, chop: 5.2, mine: 5.2, farm: 4.5, hammer: 6, attack: 10, shoot: 7, cast: 5, carry: 8, die: 7, sleep: 1.5 };
const ONE_SHOT = new Set(['attack', 'shoot', 'die']);
const AN_MAP: Record<string, AAnim> = { idle: 'idle', walk: 'walk', run: 'run', attack: 'attack', eat: 'eat', die: 'die', fly: 'fly', breath: 'breath', chop: 'idle', mine: 'idle', farm: 'idle', hammer: 'idle', shoot: 'idle', cast: 'idle', carry: 'walk', sleep: 'idle' };
const AN_FPS: Record<string, number> = { idle: 2, walk: 7, run: 11, attack: 9, eat: 2.2, die: 6, fly: 9, breath: 8 };

export const sizeOf = (u: Unit): number => u.species === 'dragon' ? 18 : u.species === 'bear' || u.species === 'cow' ? 12 : u.species === 'chicken' || u.species === 'rabbit' || u.species === 'crab' || u.species === 'snake' || u.species === 'bird' ? 5 : u.def.civ ? 7 : 9;

/** Pick the frame to show for `u` at wall-clock `t`. Walk/work loop on global time; swings and deaths run from the moment they began. */
export function frameFor(u: Unit, t: number, wading: boolean): Drawn {
  const act = u.act;
  if (u.def.civ || u.species === 'zombie') {
    const anim = HUM_MAP[act] ?? 'idle', n = ANIM_FRAMES[anim];
    let f: number;
    if (ONE_SHOT.has(act)) f = Math.min(n - 1, Math.floor(u.actT * HUM_FPS[anim]));
    else f = Math.floor((t * HUM_FPS[anim] * (anim === 'walk' ? u.def.speed / 1.9 : 1) + u.id * 0.37) % n);
    const look = (u.look ?? ZOMBIE) as Look;
    const dir = u.dir;
    const img = humanoidFrame(u.species === 'zombie' ? ZOMBIE : look, anim, dir, f);
    return { img, dx: -CX, dy: -GROUND, lift: 0, shadow: sizeOf(u), w: SPR_W, h: SPR_H, clip: wading ? 7 : 0 };
  }
  const kind = u.species as AnimalKind, anim = AN_MAP[act] ?? 'idle', n = A_FRAMES[anim];
  const f = anim === 'die' ? Math.min(n - 1, Math.floor(u.actT * AN_FPS.die)) : anim === 'attack' ? Math.min(n - 1, Math.floor(u.actT * AN_FPS.attack)) : Math.floor((t * AN_FPS[anim] + u.id * 0.41) % n);
  const sz = A_SIZE[kind];
  const lift = u.species === 'bird' ? 26 : u.species === 'dragon' && (act === 'fly' || act === 'breath') ? 48 : 0;
  return { img: animalFrame(kind, anim, u.east, f), dx: -sz.gx, dy: -sz.gy, lift, shadow: sizeOf(u), w: sz.w, h: sz.h, clip: wading && !lift ? 4 : 0 };
}

const ZOMBIE: Look = { race: 'human', age: 'adult', female: false, skin: '#7a9a5a', hair: '#2a2a22', hairStyle: 2, beard: 0, cloth: '#5a5a4a', cloth2: '#3a3a30', boots: '#2a2018', armor: 0, helm: 0, cape: null, shield: null, weapon: 'none', longSleeves: false };

const flashCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/** A white copy of a sprite, drawn briefly over it when it is hit. */
export function flashOf(img: HTMLCanvasElement): HTMLCanvasElement {
  let f = flashCache.get(img);
  if (!f) {
    f = document.createElement('canvas'); f.width = img.width; f.height = img.height;
    const c = f.getContext('2d')!; c.drawImage(img, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, f.width, f.height);
    flashCache.set(img, f);
  }
  return f;
}

const shadowCache = new Map<number, HTMLCanvasElement>();
export function shadowSprite(r: number): HTMLCanvasElement {
  let s = shadowCache.get(r);
  if (!s) {
    s = document.createElement('canvas'); s.width = r * 2 + 2; s.height = r + 3;
    const c = s.getContext('2d')!; c.fillStyle = 'rgba(8,10,24,0.34)';
    for (let y = 0; y < s.height; y++) { const ny = (y + 0.5 - s.height / 2) / (s.height / 2), half = Math.sqrt(Math.max(0, 1 - ny * ny)) * r; c.fillRect(Math.round(r + 1 - half), y, Math.max(1, Math.round(half * 2)), 1); }
    shadowCache.set(r, s);
  }
  return s;
}
export { TILE, SPECIES };
