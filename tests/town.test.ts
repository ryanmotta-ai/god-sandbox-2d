import assert from 'node:assert/strict';
import { generateWorld, DEFAULT_GEN } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { newKingdom } from '../src/sim/kingdom';
import { foundCity } from '../src/sim/city';
import { propAt } from '../src/gfx/props';

// A rich, big town grows the civic buildings, and they work: healers mend, bread feeds better, the street gets furniture.
const sim = new Sim(generateWorld({ ...DEFAULT_GEN, size: 128, seed: 3 }), 3);
const spot = { x: 64, y: 64 };
for (let j = -22; j <= 22; j++) for (let i = -22; i <= 22; i++) { sim.world.setTerrain(spot.x + i, spot.y + j, 4); sim.world.obj[(spot.y + j) * 128 + spot.x + i] = 0; }
const k = newKingdom(sim, 'human'), c = foundCity(sim, 'human', spot.x, spot.y, [], k);
c.stock.wood = 3000; c.stock.stone = 2000; c.stock.food = 2000;
for (let i = 0; i < 90; i++) { const sp = sim.freeSpot(c.x + (i % 8) - 4, c.y + 3 + Math.floor(i / 8), 6)!; sim.spawn('human', sp.x, sp.y, { role: 'peasant', city: c.id, kingdom: k.id, age: 24 }); }
for (let t = 0; t < 900; t += 30) { for (let i = 0; i < 600; i++) { sim.tick(); c.stock.wood = Math.max(c.stock.wood, 800); c.stock.stone = Math.max(c.stock.stone, 600); } }
const have = new Set(c.buildings.map(id => sim.buildings.get(id)?.type));
const civic = ['market', 'tavern', 'bakery', 'healer', 'fountain', 'monument', 'orchard', 'townhouse', 'stable', 'keep', 'hall', 'barracks'].filter(t => have.has(t as never));
assert.ok(civic.length >= 7, `too few civic buildings: ${civic}`);
assert.ok(have.has('hall'), 'no hall');

// healers heal
const healer = c.buildings.map(id => sim.buildings.get(id)!).find(b => b.type === 'healer' && b.done);
assert.ok(healer, 'no healer built');
const patient = sim.units.find(u => u.def.civ && u.cityId === c.id && u.alive && !u.inShip && Math.hypot(u.x - healer!.cx, u.y - healer!.cy) < 40)!;
patient.hp = 5; patient.x = healer!.doorX + 0.5; patient.y = healer!.doorY + 0.5; patient.mode = 'wander'; patient.path = null;
for (let i = 0; i < 20 * 6; i++) { patient.x = healer!.doorX + 0.5; patient.y = healer!.doorY + 0.5; sim.tick(); }
assert.ok(patient.hp > 20, `the healer did not mend (hp ${patient.hp})`);

// street furniture appears along paved roads and never on a building
let props = 0;
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const p = propAt(sim.world, x, y); if (p) { props++; assert.equal(sim.world.bld[y * 128 + x], 0); } }
assert.ok(props >= 3, `no street props (${props})`);
console.log(`  town: ${civic.length} civic types (${[...have].length} kinds in all), ${props} props, pop ${c.pop}`);
