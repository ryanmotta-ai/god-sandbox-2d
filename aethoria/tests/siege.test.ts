import assert from 'node:assert/strict';
import { generateWorld, DEFAULT_GEN } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { newKingdom, declareWar } from '../src/sim/kingdom';
import { foundCity } from '../src/sim/city';

// A realm at war builds rams and catapults and uses them: walls fall, the town changes hands.
const sim = new Sim(generateWorld({ ...DEFAULT_GEN, size: 128, seed: 3 }), 3);
const land: { x: number; y: number }[] = [];
for (let y = 20; y < 108; y++) for (let x = 20; x < 108; x++) if (sim.world.t(x, y) === 4 && sim.world.obj[y * 128 + x] === 0) land.push({ x, y });
const a0 = land[Math.floor(land.length * 0.2)];
const b0 = land.filter(p => Math.hypot(p.x - a0.x, p.y - a0.y) > 22 && Math.hypot(p.x - a0.x, p.y - a0.y) < 38)[0] ?? land[Math.floor(land.length * 0.8)];
const ka = newKingdom(sim, 'human'), kb = newKingdom(sim, 'orc');
ka.trait = 'warlike'; kb.trait = 'peaceful';
const ca = foundCity(sim, 'human', a0.x, a0.y, [], ka), cb = foundCity(sim, 'orc', b0.x, b0.y, [], kb);
ca.stock.wood = 400;
for (let i = 0; i < 5; i++) { const sp = sim.freeSpot(cb.x + (i % 3) - 1, cb.y + 2 + Math.floor(i / 3), 4)!; sim.spawn('orc', sp.x, sp.y, { role: 'peasant', city: cb.id, kingdom: kb.id }); }
const hall = sim.addBuilding('hall', cb.id, cb.x - 1, cb.y - 1, 'orc', true); cb.hallId = hall.id;
for (const [dx, dy] of [[-6, 0], [6, 0], [0, 6]]) { const s = sim.freeSpot(cb.x + dx, cb.y + dy, 3); if (s) sim.addBuilding('hut', cb.id, Math.floor(s.x), Math.floor(s.y), 'orc', true); }
const roles = ['soldier', 'soldier', 'knight', 'archer'] as const;
for (let i = 0; i < 16; i++) { const sp = sim.freeSpot(ca.x + (i % 4) - 2, ca.y + 3 + Math.floor(i / 4), 4)!; sim.spawn('human', sp.x, sp.y, { role: roles[i % 4], city: ca.id, kingdom: ka.id }); }
declareWar(sim, ka, kb, 'teste');
let engines = 0, hallFell = false;
for (let i = 0; i < 20 * 420; i++) {
  sim.tick();
  if (i % 20 === 0) engines = Math.max(engines, sim.units.filter(u => (u.species === 'ram' || u.species === 'catapult') && u.alive).length);
  if (!sim.buildings.has(hall.id)) { hallFell = true; break; }
}
console.log(`  siege: engines built ${engines}, hall fell ${hallFell}, ${sim.stats.kills} kills, town owner now ${sim.kingdoms.get(cb.kingdomId)?.name}`);
assert.ok(engines >= 1, 'the realm never built a siege engine');
assert.ok(hallFell || sim.stats.kills >= 5, 'the war produced neither a fallen hall nor a battle');
