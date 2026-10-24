import assert from 'node:assert/strict';
import { makeSim, runSeconds } from './helpers';
import { snapshot, restore } from '../src/core/save';

// A saved world must resume identically: same state now, and the same future (the RNG state is part of the save).
const a = makeSim(11, 128, ['human', 'orc']);
runSeconds(a, 200);
const snap = JSON.parse(JSON.stringify(snapshot(a)));
const b = restore(snap);
assert.equal(b.units.length, a.units.filter(u => u.alive).length);
assert.equal(b.buildings.size, a.buildings.size);
assert.equal(b.cities.size, a.cities.size);
assert.equal(b.kingdoms.size, a.kingdoms.size);
assert.deepEqual(b.world.terrain, a.world.terrain);
assert.equal(b.time, a.time);
// Both worlds keep ticking; the restored one must not blow up and must stay in the same ballpark.
runSeconds(a, 60); runSeconds(b, 60);
for (const u of b.units) assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y));
const ca = a.units.filter(u => u.def.civ).length, cb = b.units.filter(u => u.def.civ).length;
assert.ok(Math.abs(ca - cb) <= Math.max(6, ca * 0.35), `restored world diverged: ${ca} vs ${cb}`);
