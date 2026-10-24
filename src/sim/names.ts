import type { Rng } from '../core/rng';
import type { Race } from '../gfx/humanoid';

const SYL: Record<Race, { a: string[]; b: string[]; c: string[] }> = {
  human: { a: ['Al', 'Bran', 'Cor', 'Dun', 'Ed', 'Fal', 'Gar', 'Hal', 'Ir', 'Kel', 'Lor', 'Mar', 'Nor', 'Os', 'Ran', 'Sel', 'Tor', 'Wil'], b: ['a', 'e', 'o', 'i', 'u', 'ar', 'en', 'or'], c: ['dric', 'win', 'mond', 'ton', 'ard', 'ren', 'wick', 'bert', 'ley', 'ham'] },
  elf: { a: ['Ael', 'Cael', 'Eli', 'Fae', 'Gal', 'Ith', 'Lae', 'Mir', 'Nae', 'Sil', 'Thal', 'Vae'], b: ['a', 'i', 'e', 'ae', 'ia', 'ei'], c: ['riel', 'thir', 'wen', 'lorn', 'dil', 'nor', 'las', 'ira', 'ion'] },
  dwarf: { a: ['Bar', 'Dur', 'Gim', 'Thor', 'Bor', 'Dor', 'Kaz', 'Mor', 'Nar', 'Rur', 'Tor', 'Vol'], b: ['a', 'i', 'o', 'u', 'in', 'ak'], c: ['din', 'grim', 'bur', 'rak', 'dun', 'gar', 'mar', 'kin', 'dal'] },
  orc: { a: ['Gor', 'Grak', 'Mog', 'Naz', 'Ug', 'Zug', 'Dro', 'Kar', 'Gul', 'Shak', 'Rok', 'Vuk'], b: ['a', 'o', 'u', 'ak', 'ug'], c: ['gash', 'rok', 'dak', 'mug', 'nak', 'zog', 'bur', 'thar', 'gul'] },
};
const REALM: Record<Race, string[]> = {
  human: ['Reino', 'Império', 'Domínio', 'Coroa'], elf: ['Bosque', 'Concílio', 'Reino', 'Corte'], dwarf: ['Clã', 'Cidadela', 'Salão', 'Reino'], orc: ['Horda', 'Clã', 'Bando', 'Legião'],
};

export const personName = (r: Rng, race: Race): string => { const s = SYL[race]; return r.pick(s.a) + r.pick(s.b) + r.pick(s.c); };
export const placeName = (r: Rng, race: Race): string => { const s = SYL[race]; return r.pick(s.a) + r.pick(s.c); };
export const realmName = (r: Rng, race: Race): string => `${r.pick(REALM[race])} de ${placeName(r, race)}`;
