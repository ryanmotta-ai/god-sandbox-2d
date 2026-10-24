import { generateWorld, DEFAULT_GEN, type GenConfig } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { SPECIES, type Species } from '../src/sim/species';
import { TERRAIN } from '../src/world/defs';
import type { Race } from '../src/gfx/humanoid';

/** A world with `groups` founding parties and some wildlife, ready to tick. Shared by the headless tests. */
export function makeSim(seed = 4, size = 128, groups: Race[] = ['human'], extra: Partial<GenConfig> = {}): Sim {
  const world = generateWorld({ ...DEFAULT_GEN, size, seed, ...extra });
  const sim = new Sim(world, seed);
  let placed = 0;
  for (const race of groups) {
    for (let tries = 0; tries < 4000 && placed < groups.length * 1000; tries++) {
      const x = sim.rng.int(12, size - 12), y = sim.rng.int(12, size - 12);
      const t = world.t(x, y);
      if (t !== 4 || world.obj[y * size + x] !== 0) continue;
      let ok = true;
      for (const c of sim.units) if (Math.hypot(c.x - x, c.y - y) < size / 3) ok = false;
      if (!ok) continue;
      for (let i = 0; i < 5; i++) { const s = sim.freeSpot(x + sim.rng.range(-2, 2), y + sim.rng.range(-2, 2), 3); if (s) sim.spawn(race, s.x, s.y, { role: 'peasant' }); }
      placed += 1000;
      break;
    }
    placed = 0;
  }
  const wild: Species[] = ['sheep', 'cow', 'deer', 'rabbit', 'chicken', 'wolf', 'boar', 'bear', 'bird'];
  for (let n = 0; n < size * size / 220; n++) {
    const x = sim.rng.int(2, size - 3), y = sim.rng.int(2, size - 3);
    if (!sim.walkable(x, y) || TERRAIN[world.t(x, y)].water) continue;
    sim.spawn(sim.rng.pick(wild), x + 0.5, y + 0.5);
  }
  return sim;
}
export const runSeconds = (sim: Sim, s: number): void => { for (let i = 0; i < s * 20; i++) sim.tick(); };
export { SPECIES };
