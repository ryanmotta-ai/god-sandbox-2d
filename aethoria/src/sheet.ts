import { humanoidFrame, type Race } from './gfx/humanoid';
import { makeLook, type Role } from './gfx/looks';
import { plantSprite, type Season } from './gfx/flora';
import { O } from './world/defs';
import { animalFrame, A_FRAMES, type AnimalKind, type AAnim } from './gfx/animals';
import { ANIM_FRAMES, type Anim } from './gfx/rig';

/** Dev page: ?mode=roster | ?mode=anim&race=human&role=soldier&anim=walk */
const q = new URLSearchParams(location.search);
const root = document.getElementById('root')!;
const Z = +(q.get('z') ?? 5);
function add(c: HTMLCanvasElement, parent: HTMLElement): void { c.style.width = c.width * Z + 'px'; c.style.height = c.height * Z + 'px'; parent.appendChild(c); }
function row(title: string): HTMLElement { const h = document.createElement('h4'); h.textContent = title; root.appendChild(h); const d = document.createElement('div'); d.className = 'row'; root.appendChild(d); return d; }

const mode = q.get('mode') ?? 'roster';
if (mode === 'animals') {
  const kinds: AnimalKind[] = ['sheep', 'cow', 'chicken', 'rabbit', 'deer', 'boar', 'wolf', 'bear', 'snake', 'crab', 'bird'];
  const anims = (q.get('anims') ?? 'walk,run,attack').split(',') as AAnim[];
  for (const k of kinds) for (const a of anims) { const d = row(`${k} ${a}`); for (let f = 0; f < A_FRAMES[a]; f++) add(animalFrame(k, a, false, f), d); }
} else if (mode === 'dragon') {
  for (const a of ['walk', 'fly', 'breath', 'idle'] as AAnim[]) { const d = row('dragon ' + a); for (let f = 0; f < A_FRAMES[a]; f++) add(animalFrame('dragon', a, false, f), d); }
} else if (mode === 'flora') {
  const ids = Object.values(O).filter(v => v > 0);
  for (const season of [1, 2, 3, 0] as Season[]) {
    const d = row('season ' + season);
    for (const id of ids) for (const age of season === 1 ? [30, 120, 255] : [255]) add(plantSprite(id, id % 4, age, season, 0, 0), d);
  }
} else if (mode === 'roster') {
  const races: Race[] = ['human', 'elf', 'dwarf', 'orc'];
  const roles: Role[] = ['peasant', 'farmer', 'woodcutter', 'miner', 'builder', 'soldier', 'archer', 'knight', 'king', 'mage', 'child'];
  for (const race of races) {
    const d = row(race);
    roles.forEach((role, i) => { for (const dir of ['S', 'W', 'N'] as const) add(humanoidFrame(makeLook(race, role, i + 3, '#c0392b', i % 3 === 1), 'idle', dir, 0), d); });
  }
} else {
  const race = (q.get('race') ?? 'human') as Race, role = (q.get('role') ?? 'soldier') as Role, anim = (q.get('anim') ?? 'walk') as Anim;
  const look = makeLook(race, role, +(q.get('seed') ?? 5));
  for (const dir of ['S', 'W', 'E', 'N'] as const) {
    const d = row(`${race} ${role} ${anim} ${dir}`);
    for (let f = 0; f < ANIM_FRAMES[anim]; f++) add(humanoidFrame(look, anim, dir, f), d);
  }
}
