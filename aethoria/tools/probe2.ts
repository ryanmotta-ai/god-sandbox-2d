import { generateWorld, DEFAULT_GEN } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { populate, DEFAULT_SETUP } from '../src/game';
/** `npx tsx tools/probe2.ts [seconds] [seed] [size]` — full 4-race world, one line per 100 s. */
const [secs = '1200', seed = '7', size = '192'] = process.argv.slice(2);
const s = { ...DEFAULT_SETUP, size: +size, seed: +seed };
const sim = new Sim(generateWorld({ ...DEFAULT_GEN, ...s }), +seed);
populate(sim, s);
const t0 = performance.now();
for (let t = 0; t < +secs; t += 100) {
  for (let i = 0; i < 2000; i++) sim.tick();
  const civ = sim.units.filter(u => u.def.civ);
  const per = [...sim.kingdoms.values()].map(k => `${k.name.split(' de ')[1]}(${k.race[0]}):c${k.cities.length}/p${k.cities.reduce((a, id) => a + (sim.cities.get(id)?.pop ?? 0), 0)}/s${civ.filter(u => u.kingdomId === k.id && (u.role === 'soldier' || u.role === 'archer' || u.role === 'knight')).length}${k.wars.size ? '⚔' + k.wars.size : ''}`).join(' ');
  console.log(`t=${t + 100} civ${civ.length} wild${sim.units.length - civ.length} ${per} | kills ${sim.stats.kills} deaths ${sim.stats.deaths} births ${sim.stats.births}`);
}
console.log(`wall ${((performance.now() - t0) / 1000).toFixed(1)}s`);
for (const l of sim.log.filter(l => l.kind === 'war' || l.kind === 'peace').slice(-22)) console.log(`  [${l.t.toFixed(0)}s] ${l.text}`);
