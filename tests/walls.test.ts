import assert from 'node:assert/strict';
import { generateWorld, DEFAULT_GEN } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { newKingdom } from '../src/sim/kingdom';
import { foundCity } from '../src/sim/city';
import { findPath } from '../src/sim/path';

// A big town with a barracks walls itself in — with gates, so the people can still get in and out.
const sim = new Sim(generateWorld({ ...DEFAULT_GEN, size: 128, seed: 3 }), 3);
// level a 29×29 meadow in the middle of the world so the fixture does not depend on the seed's geography
const spot = { x: 64, y: 64 };
for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) { sim.world.setTerrain(spot.x + i, spot.y + j, 4); sim.world.obj[(spot.y + j) * 128 + spot.x + i] = 0; }
const k = newKingdom(sim, 'human'), c = foundCity(sim, 'human', spot.x, spot.y, [], k);
c.stock.wood = 600; c.stock.stone = 600; c.stock.food = 400;
for (let i = 0; i < 26; i++) { const sp = sim.freeSpot(c.x + (i % 6) - 3, c.y + 2 + Math.floor(i / 6), 4)!; sim.spawn('human', sp.x, sp.y, { role: i < 4 ? 'builder' : 'peasant', city: c.id, kingdom: k.id }); }
const hall = sim.addBuilding('hall', c.id, c.x - 1, c.y - 1, 'human', true); c.hallId = hall.id;
sim.addBuilding('barracks', c.id, c.x + 5, c.y - 2, 'human', true);
for (const [dx, dy] of [[-7, -2], [-7, 4], [5, 4], [0, 7]]) sim.addBuilding('hut', c.id, c.x + dx, c.y + dy, 'human', true);
for (let i = 0; i < 20 * 600; i++) { sim.tick(); if (!c.wallQueue.length && c.wallsPlanned && [...sim.buildings.values()].every(b => b.done || b.cityId !== c.id)) break; }
const walls = [...sim.buildings.values()].filter(b => b.type === 'wall' && b.done).length, gates = [...sim.buildings.values()].filter(b => b.type === 'gate' && b.done).length;
console.log(`  walls: ${walls} segments, ${gates} gates, ${c.wallQueue.length} still queued`);
assert.ok(walls >= 20, `too few wall segments (${walls})`);
assert.ok(gates >= 3, `too few gates (${gates})`);
// someone standing well outside can still walk to the hall: through a gate
const out = sim.freeSpot(c.x + 20, c.y, 6)!;
const p = findPath(sim.world, Math.floor(out.x), Math.floor(out.y), hall.doorX, hall.doorY, 4000);
assert.ok(p && p.length > 5, 'the walled town is sealed: no path from outside to the hall');
const last = p![p!.length - 1];
assert.ok(Math.abs((last % sim.world.w) - hall.doorX) <= 2, 'the path does not end at the hall');
