import { makeSim, runSeconds } from '../tests/helpers';
import type { Race } from '../src/gfx/humanoid';
/** `npx tsx tools/probe.ts [seconds] [seed] [races,comma]` — prints a time series so balance can be judged by numbers. */
const [secs = '600', seed = '4', races = 'human'] = process.argv.slice(2);
const sim = makeSim(+seed, 128, races.split(',') as Race[]);
for (let t = 0; t < +secs; t += 60) {
  runSeconds(sim, 60);
  const civ = sim.units.filter(u => u.def.civ);
  const roles: Record<string, number> = {};
  for (const u of civ) roles[u.role] = (roles[u.role] ?? 0) + 1;
  const cities = [...sim.cities.values()].map(c => `${c.name}[pop${c.pop} f${c.stock.food | 0} w${c.stock.wood | 0} s${c.stock.stone | 0} b${c.buildings.length} loy${c.loyalty | 0}]`).join(' ');
  const wild: Record<string, number> = {};
  for (const u of sim.units) if (!u.def.civ) wild[u.species] = (wild[u.species] ?? 0) + 1;
  console.log(`t=${t + 60}s yr${sim.year.toFixed(0)} civ${civ.length} ${JSON.stringify(roles)} | ${cities} | wild ${JSON.stringify(wild)} | wars ${[...sim.kingdoms.values()].reduce((a, k) => a + k.wars.size, 0) / 2} k${sim.kingdoms.size} starving ${civ.filter(u => u.hunger > 90).length}`);
}
for (const l of sim.log.slice(-14)) console.log(`  [${l.t.toFixed(0)}s] ${l.text}`);
