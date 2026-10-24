import assert from 'node:assert/strict';
import { makeSim, runSeconds } from './helpers';

// A starting party must become a town that builds, eats, and grows — and nothing may go NaN or into deep water.
const sim = makeSim(4, 128, ['human']);
const t0 = performance.now();
runSeconds(sim, 240);
const ms = performance.now() - t0;
const civ = sim.units.filter(u => u.def.civ);
console.log(`  240s sim: ${Math.round(ms)}ms, ${sim.units.length} units, ${civ.length} civ, ${sim.cities.size} cities, ${[...sim.buildings.values()].filter(b => b.done).length} built, year ${sim.year.toFixed(1)}`);
assert.ok(sim.cities.size >= 1, 'no city was founded');
assert.ok([...sim.buildings.values()].some(b => b.type !== 'campfire' && b.done), 'nothing was ever built');
for (const u of sim.units) { assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y), `unit ${u.id} went NaN`); assert.ok(u.hp <= u.maxHp + 1e-6); }
assert.ok(civ.length >= 5, 'the town died out');
