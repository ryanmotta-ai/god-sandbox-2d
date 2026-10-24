import assert from 'node:assert/strict';
import { makeArchipelago, settle } from './islands';
import { geo } from '../src/sim/navy';
import { declareWar } from '../src/sim/kingdom';
import { snapshot, restore } from '../src/core/save';

// Two island towns and an empty third: they build docks and a yard, fish, trade by barter, settle across the water,
// and an enemy across the sea is invaded by ship.
const sim = makeArchipelago([[50, 96], [140, 96], [95, 40]]);
const A = settle(sim, 'human', 50, 96, 34), B = settle(sim, 'human', 140, 96, 30);
A.c.stock.wood = 900; B.c.stock.wood = 900;
const all = (k: string): number => sim.units.filter(u => u.species === k && u.alive).length;
const run = (s: number): void => { for (let i = 0; i < s * 20; i++) sim.tick(); };

run(400);
const types = new Set([...sim.buildings.values()].map(b => b.type));
assert.ok(types.has('dock') && types.has('shipyard') && types.has('fishhut'), `port buildings missing: ${[...types]}`);
const docks = [...sim.buildings.values()].filter(b => b.type === 'dock');
for (const d of docks) assert.ok(d.bx >= 0 && geo(sim).sea[d.by * 192 + d.bx] > 0, 'dock without a berth');
assert.ok(all('fishboat') + all('canoe') >= 1, 'no fishing boat was launched');
assert.ok(sim.units.some(u => u.inShip && u.role === 'fisher'), 'fishing boats carry no crew');

// fish come home: the larder fills from the sea (nobody farms on this rock)
const food0 = A.c.stock.food; B.c.stock.food = 0; run(200);
assert.ok(A.c.stock.food > food0 - 120, 'fishing never fed the town');

// barter: a merchant carries the surplus to the poor island, and the two realms warm to each other
for (let k = 0; k < 9; k++) { B.c.stock.food = 0; B.c.stock.stone = 0; run(40); }
assert.ok(all('cog') >= 1, 'no merchant ship');
const rel = A.k.relations.get(B.k.id) ?? 0;
assert.ok(B.c.stock.food > 0 || rel > 12, 'no goods crossed the sea');

// settlers by sea: the empty island gets a town founded by people who arrived on a ship
const isleC = geo(sim).land[40 * 192 + 95];
for (let t = 0; t < 700 && ![...sim.cities.values()].some(c => geo(sim).land[Math.floor(c.y) * 192 + Math.floor(c.x)] === isleC); t += 20) run(20);
assert.ok([...sim.cities.values()].some(c => geo(sim).land[Math.floor(c.y) * 192 + Math.floor(c.x)] === isleC), 'no town was founded overseas');

// a round trip through a save keeps ships, cargo and crew
const copy = restore(JSON.parse(JSON.stringify(snapshot(sim))));
assert.equal(copy.units.filter(u => u.def.ship).length, sim.units.filter(u => u.def.ship && u.alive).length);
assert.equal(copy.units.filter(u => u.inShip).length, sim.units.filter(u => u.inShip && u.alive).length);
for (let i = 0; i < 20 * 20; i++) copy.tick();

// war across the water: troop ships carry the army, which lands and fights
declareWar(sim, A.k, B.k, 'teste');
let embarked = false, landed = false;
for (let t = 0; t < 400 && !landed; t += 10) {
  run(10);
  const ar = A.k.army;
  if (ar?.sea) embarked = true;
  if (ar?.sea && ar.phase === 'assault') landed = true;
  if (!A.k.wars.size) declareWar(sim, A.k, B.k, 'teste');
}
assert.ok(embarked, 'no army set sail');
assert.ok(landed, 'the army never landed');
console.log(`  navy: ${all('fishboat')} fishing, ${all('cog')} merchants, ${sim.cities.size} towns, relation ${rel.toFixed(0)}, army landed ${landed}`);
