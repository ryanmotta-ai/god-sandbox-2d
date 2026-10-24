import assert from 'node:assert/strict';
import { generateWorld, DEFAULT_GEN } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { populate, Game, DEFAULT_SETUP } from '../src/game';
import { runSeconds } from './helpers';

// Two armies at war must actually fight: arrows fly, blows land, soldiers die — one combat model, no hidden dice.
const s = { ...DEFAULT_SETUP, size: 128, seed: 7, races: [], wildlife: 0 };
const sim = new Sim(generateWorld({ ...DEFAULT_GEN, ...s }), 7);
populate(sim, s);
const cx = 60, cy = 60;
const fake = { sim, cam: { x: cx * 32, y: cy * 32 } } as unknown as Game;
Game.prototype.debugBattle.call(fake, 16);
const before = sim.units.filter(u => u.def.civ && u.alive).length;
assert.ok(before >= 20, `battle did not spawn (${before})`);
let arrows = 0;
for (let i = 0; i < 20 * 40; i++) { sim.tick(); arrows = Math.max(arrows, sim.arrows.length); }
const dead = sim.stats.kills;
console.log(`  battle: ${before} fighters, ${dead} kills, peak ${arrows} arrows in flight`);
assert.ok(dead >= 6, 'armies at war did not kill each other');
assert.ok(arrows > 0, 'archers never loosed an arrow');
runSeconds(sim, 1);
