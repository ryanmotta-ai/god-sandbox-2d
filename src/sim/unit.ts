import type { Species } from './species';
import { SPECIES } from './species';
import type { Look } from '../gfx/humanoid';
import type { Role } from '../gfx/looks';

export type UState = 'idle' | 'walk' | 'work' | 'fight' | 'flee' | 'eat' | 'sleep' | 'dead' | 'wade';
export type Dir = 'N' | 'E' | 'S' | 'W';

export interface Carry { good: 'wood' | 'food' | 'stone' | 'ore' | 'gold'; n: number }

/** One living thing. Positions are in tile units; (px,py) is the previous tick for render interpolation. */
export class Unit {
  x: number; y: number; px: number; py: number;
  dir: Dir = 'S';
  hp: number; maxHp: number;
  /** World years. */
  age: number;
  female = false;
  name = '';
  state: UState = 'idle';
  /** Seconds in the current state (drives animation phase for one-shot animations). */
  stateT = 0;
  /** Which animation the renderer should play: chosen by AI so the visuals match what is happening. */
  act: 'idle' | 'walk' | 'run' | 'chop' | 'mine' | 'farm' | 'hammer' | 'attack' | 'shoot' | 'cast' | 'carry' | 'eat' | 'die' | 'sleep' | 'fly' | 'breath' | 'sail' = 'idle';
  actT = 0;
  thinkT = 0;
  path: Int32Array | null = null;
  pathI = 0;
  tx = -1; ty = -1;
  hunger = 0;
  attackCd = 0;
  target = 0; // unit id being fought/hunted, 0 none
  cityId = 0; // 0 none (ids start at 1)
  kingdomId = 0;
  role: Role = 'peasant';
  look: Look | null = null;
  variant = 0;
  carry: Carry | null = null;
  /** Building the unit is heading to / working at. */
  job = 0;
  jobT = 0;
  traits: string[] = [];
  /** What the AI is doing right now (finer than `state`): wander, goto, chop, haul, farm, mine, build, hunt, eat, flee, attack, march, patrol, graze, rest, settle. */
  mode = 'wander';
  goalX = 0; goalY = 0;
  /** Countdown to a swing connecting. */
  hitT = 0;
  /** Countdown to an arrow leaving the bow; <0 = not drawing. */
  shootT = -1;
  /** Dragon breath accumulator. */
  breathT = 0;
  pathFail = 0;
  /** Seconds until a moving goal may be re-searched; and a cool-down after a search found nothing. */
  repathT = 0; failT = 0;
  fleeT = 0;
  /** Seconds since last births / breeding for animals. */
  breedT = 0;
  /** Cached sprite facing for animals (east/west only). */
  east = false;
  /** Siege engines: seconds-ish without a war to fight (they fall apart). */
  idleT = 0;
  kills = 0;
  /** Seconds a fire/curse/etc. effect remains. */
  burning = 0;
  /** Seconds the sprite flashes after a hit. */
  hurtT = 0;
  /** Id of the ship this unit is aboard (0 = ashore). Aboard, it rides hidden and does not think. */
  inShip = 0;
  /** Ships: what they are doing (fish, trade, settle, invade, patrol, moor), the step of it, home dock, destination, hold [food,wood,stone,ore], a timer. */
  mission = 'moor'; phase = 0; dock = 0; dest = 0; hold: number[] | null = null; legT = 0;
  home = 0; // building id
  /** Leisure: chat partner, the building the unit sleeps inside (hidden like a rider), seconds left in a pastime. */
  partner = 0; inside = 0; socialT = 0;
  born = 0;

  constructor(public id: number, public species: Species, x: number, y: number) {
    this.x = this.px = x; this.y = this.py = y;
    const d = SPECIES[species];
    this.maxHp = this.hp = d.hp;
    this.age = 0;
  }
  get def() { return SPECIES[this.species]; }
  get alive(): boolean { return this.state !== 'dead'; }
  get isAdult(): boolean { return !this.def.civ || this.age >= 16; }
}
