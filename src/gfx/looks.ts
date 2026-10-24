import { Rng } from '../core/rng';
import type { Look, Race } from './humanoid';

export type Role = 'peasant' | 'farmer' | 'woodcutter' | 'miner' | 'builder' | 'soldier' | 'archer' | 'knight' | 'king' | 'mage' | 'child' | 'fisher' | 'sailor';

const SKIN: Record<Race, string[]> = {
  human: ['#f1c9a5', '#e0a97c', '#c68a5c', '#9a6440', '#6e4328'],
  elf: ['#f3dcc4', '#ecd0a8', '#dcc79a'],
  dwarf: ['#e8b392', '#d99a78', '#c5805e'],
  orc: ['#6f9a45', '#5f8a3c', '#7aa650'],
};
const HAIR: Record<Race, string[]> = {
  human: ['#3a2618', '#5a3a22', '#1c1a1e', '#c9a04a', '#a8481f', '#8a8a8e'],
  elf: ['#e8e4d0', '#d8c070', '#7ab070', '#b8c4e0'],
  dwarf: ['#a8481f', '#6a3a1c', '#d08a2a', '#4a3a30', '#c8c0b0'],
  orc: ['#1c1a1e', '#2a2018', '#3a2a1a'],
};
const TUNIC: Record<Race, string[]> = {
  human: ['#8a6a4a', '#7a8a5a', '#9a7a52', '#6a7a8a', '#a86a4a'],
  elf: ['#5a9a6a', '#d8d4c0', '#4a7a8a', '#8aa860'],
  dwarf: ['#8a4a2a', '#6a5a4a', '#7a3a2a', '#5a6a7a'],
  orc: ['#5a4a3a', '#4a3a30', '#6a3a2a'],
};

/** Build an appearance. `kingdom` tints soldiers' tabards, capes and shields. Pure function of (race, role, seed). */
export function makeLook(race: Race, role: Role, seed: number, kingdom = '#c0392b', female = false): Look {
  const r = new Rng(seed * 7919 + 13);
  const skin = r.pick(SKIN[race]), hair = r.pick(HAIR[race]);
  const style = (female ? r.pick([1, 1, 3, 4, 0]) : race === 'orc' ? r.pick([2, 0, 3]) : r.pick([0, 0, 3, 2, 1])) as Look['hairStyle'];
  const tunic = r.pick(TUNIC[race]);
  const base: Look = {
    race, age: role === 'child' ? 'child' : 'adult', female, skin, hair, hairStyle: style,
    beard: (race === 'dwarf' && !female ? 2 : !female && race !== 'elf' && r.chance(0.3) ? 1 : 0) as Look['beard'],
    cloth: tunic, cloth2: r.pick(['#4a3a2a', '#5a4a34', '#3a3a44', '#554638']), boots: '#3a2616',
    armor: 0, helm: 0, cape: null, shield: null, weapon: 'none', longSleeves: r.chance(0.5),
  };
  switch (role) {
    case 'farmer': return { ...base, helm: 5, weapon: 'hoe', longSleeves: false, beard: base.beard };
    case 'woodcutter': return { ...base, weapon: 'axe', cloth: '#a8483a', longSleeves: false, helm: r.chance(0.4) ? 1 : 0 };
    case 'miner': return { ...base, weapon: 'pickaxe', helm: 1, cloth: '#6a6a72', longSleeves: true };
    case 'builder': return { ...base, weapon: 'hammer', helm: r.chance(0.5) ? 1 : 0, cloth: '#9a8a62' };
    case 'soldier': return { ...base, armor: 2, helm: 2, shield: kingdom, weapon: r.chance(0.5) ? 'spear' : 'sword', cloth: kingdom, cloth2: '#3a3a44', longSleeves: true };
    case 'archer': return { ...base, armor: 1, helm: 4, weapon: 'bow', cloth: '#4a6a3a', cloth2: '#4a3a2a', cape: null, longSleeves: true, shield: null };
    case 'knight': return { ...base, armor: 3, helm: 2, shield: kingdom, weapon: 'sword', cape: kingdom, cloth: kingdom, cloth2: '#2a2a34', longSleeves: true };
    case 'king': return { ...base, armor: 1, helm: 3, cape: '#a01c2c', cloth: kingdom, cloth2: '#3a2a4a', weapon: 'sword', longSleeves: true, beard: (race === 'dwarf' || !female && r.chance(0.7) ? 2 : 0) as Look['beard'] };
    case 'fisher': return { ...base, helm: 5, weapon: 'none', cloth: '#4a7a9a', cloth2: '#5a4a34', longSleeves: false };
    case 'sailor': return { ...base, helm: 1, weapon: 'none', cloth: '#e4e8f0', cloth2: '#2a4a7a', longSleeves: true };
    case 'mage': return { ...base, helm: 4, weapon: 'staff', cloth: '#5a3a8a', cloth2: '#3a2a5a', cape: '#3a2a6a', longSleeves: true };
    case 'child': return { ...base, weapon: 'none', hairStyle: female ? 3 : 0, beard: 0, longSleeves: false };
    default: return base;
  }
}
