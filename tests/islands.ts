import { generateWorld, DEFAULT_GEN } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { newKingdom, type Kingdom } from '../src/sim/kingdom';
import { foundCity, type City } from '../src/sim/city';
import { T } from '../src/world/defs';
import type { Race } from '../src/gfx/humanoid';

/** An ocean world with square islands (flat grass, shallow shelf all round) so naval tests do not depend on the seed's geography. */
export function makeArchipelago(islands: [number, number][], size = 192, half = 20): Sim {
  const sim = new Sim(generateWorld({ ...DEFAULT_GEN, size, seed: 3 }), 3);
  const w = sim.world;
  for (let i = 0; i < size * size; i++) { w.terrain[i] = T.DEEP; w.obj[i] = 0; }
  for (const [cx, cy] of islands) for (let y = cy - half - 3; y <= cy + half + 3; y++) for (let x = cx - half - 3; x <= cx + half + 3; x++) {
    const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
    w.terrain[y * size + x] = d <= half ? T.GRASS : T.SHALLOW;
  }
  w.chunkVer.fill(1);
  return sim;
}

/** A town of `pop` adults on an island, with hall, a few huts and a stocked larder. */
export function settle(sim: Sim, race: Race, x: number, y: number, pop = 28, kingdom?: Kingdom): { k: Kingdom; c: City } {
  const k = kingdom ?? newKingdom(sim, race), c = foundCity(sim, race, x, y, [], k);
  c.stock.wood = 500; c.stock.stone = 300; c.stock.food = 300;
  for (let i = 0; i < pop; i++) { const sp = sim.freeSpot(c.x + (i % 6) - 3, c.y + 2 + Math.floor(i / 6), 5)!; sim.spawn(race, sp.x, sp.y, { role: 'peasant', city: c.id, kingdom: k.id, age: 24 }); }
  const hall = sim.addBuilding('hall', c.id, c.x - 1, c.y - 1, race, true); c.hallId = hall.id;
  for (const [dx, dy] of [[-7, -2], [-7, 4], [5, 4], [5, -3], [0, 7], [-3, -7]]) sim.addBuilding('hut', c.id, c.x + dx, c.y + dy, race, true);
  return { k, c };
}
