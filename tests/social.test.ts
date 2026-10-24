import assert from 'node:assert/strict';
import { generateWorld, DEFAULT_GEN } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { newKingdom } from '../src/sim/kingdom';
import { foundCity } from '../src/sim/city';

// Life between chores: people sleep indoors at night and are back on the street at dawn; they chat, drink at the tavern,
// the children play, and a festival gathers the town around the fountain.
const sim = new Sim(generateWorld({ ...DEFAULT_GEN, size: 128, seed: 3 }), 3);
const spot = { x: 64, y: 64 };
for (let j = -16; j <= 16; j++) for (let i = -16; i <= 16; i++) { sim.world.setTerrain(spot.x + i, spot.y + j, 4); sim.world.obj[(spot.y + j) * 128 + spot.x + i] = 0; }
const k = newKingdom(sim, 'human'), c = foundCity(sim, 'human', spot.x, spot.y, [], k);
c.stock.wood = 800; c.stock.stone = 400; c.stock.food = 2000;
for (let i = 0; i < 40; i++) { const sp = sim.freeSpot(c.x + (i % 6) - 3, c.y + 3 + Math.floor(i / 6), 5)!; sim.spawn('human', sp.x, sp.y, { role: 'peasant', city: c.id, kingdom: k.id, age: i % 5 === 0 ? 8 : 25 }); }
const hall = sim.addBuilding('hall', c.id, c.x - 1, c.y - 1, 'human', true); c.hallId = hall.id;
for (const [dx, dy] of [[-8, -2], [-8, 3], [6, 4], [6, -3], [0, 8], [-3, -8], [-9, 8], [9, 8]]) sim.addBuilding('house', c.id, c.x + dx, c.y + dy, 'human', true);
sim.addBuilding('tavern', c.id, c.x - 3, c.y + 5, 'human', true); sim.addBuilding('market', c.id, c.x + 3, c.y - 8, 'human', true); sim.addBuilding('fountain', c.id, c.x - 1, c.y + 3, 'human', true);
const seen = { inside: 0, chat: 0, tavern: 0, play: 0, dance: 0, market: 0 };
const day0 = Math.floor(sim.time / 120);
let nightInside = 0, dayInside = 0;
for (let i = 0; i < 20 * 260; i++) {
  c.stock.food = Math.max(c.stock.food, 800);
  sim.tick();
  if (i % 10) continue;
  const p = sim.dayPhase;
  for (const u of sim.units) {
    if (u.inside) { seen.inside++; if (p > 0.3 && p < 0.7) dayInside++; else nightInside++; }
    if (u.mode in seen) seen[u.mode as keyof typeof seen]++;
  }
  if (i === 20 * 120) { c.festT = 40; c.festLast = sim.time; }
}
void day0;
console.log(`  social: ${JSON.stringify(seen)}`);
assert.ok(nightInside > 20, `nobody slept indoors (${nightInside})`);
assert.equal(dayInside, 0, 'people were still shut indoors at midday');
assert.ok(seen.chat > 3, 'nobody chatted');
assert.ok(seen.play > 3, 'the children never played');
assert.ok(seen.dance > 5, 'the festival never gathered anyone');
assert.ok(seen.tavern + seen.market > 3, 'nobody went to the tavern or the market');
assert.ok(sim.units.filter(u => u.alive).length >= 38, 'the town lost people to its own leisure');
