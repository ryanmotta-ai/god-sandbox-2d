/**
 * Throwaway diagnostic: do the roads actually join the places they were built
 * to join, and what does the network look like?
 *
 * Flood-fills the road network and reports which settlements share a component,
 * then prints the whole map so the shape of the lines can be judged.
 */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType } from '../src/entities/Species';
import { TERRAINS } from '../src/world/Biomes';
import { rng } from '../src/core/Random';

const YEARS = Number(process.env.YEARS ?? 90);
const SIZE = Number(process.env.SIZE ?? 72);
const SEED = Number(process.env.SEED ?? 20260802);

rng.setSeed(SEED);
const tileMap = new TileMap(SIZE, SIZE, 'single_continent', SEED);
const sim = new SimulationEngine();
const particles = new ParticleManager();

for (const _ of [0, 1]) {
  let p = { x: SIZE / 2, y: SIZE / 2 };
  for (let i = 0; i < 400; i++) {
    const x = rng.rangeInt(2, SIZE - 3), y = rng.rangeInt(2, SIZE - 3);
    const t = tileMap.getTile(x, y);
    if (t && !t.type.includes('ocean') && t.type !== 'mountain' && t.type !== 'lava') { p = { x, y }; break; }
  }
  for (let i = 0; i < 8; i++) sim.spawnEntity(SpeciesType.HUMAN, p.x + rng.range(-2, 2), p.y + rng.range(-2, 2), tileMap, i % 2 === 0 ? 'male' : 'female');
}

for (let y = 1; y <= YEARS; y++) for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(tileMap, particles);

// ---- Flood fill the road network into components ----
const component = new Map<string, number>();
let components = 0;
const sizes: number[] = [];
for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) {
  const t = tileMap.getTile(x, y);
  if (!t || t.roadLevel <= 0 || component.has(`${x},${y}`)) continue;
  const id = components++;
  let size = 0;
  const stack = [{ x, y }];
  component.set(`${x},${y}`, id);
  while (stack.length) {
    const cur = stack.pop()!;
    size++;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nx = cur.x + dx, ny = cur.y + dy, key = `${nx},${ny}`;
      if (component.has(key)) continue;
      const nt = tileMap.getTile(nx, ny);
      if (!nt || nt.roadLevel <= 0) continue;
      component.set(key, id);
      stack.push({ x: nx, y: ny });
    }
  }
  sizes.push(size);
}

/** Which road component a settlement sits on (its centre, or any tile touching it). */
function componentOf(cx: number, cy: number): number | null {
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    const id = component.get(`${Math.round(cx) + dx},${Math.round(cy) + dy}`);
    if (id !== undefined) return id;
  }
  return null;
}

const cities = [...sim.cities.values()];
console.log(`ano ${sim.currentYear} — ${cities.length} cidades, ${sim.kingdoms.size} reinos`);
console.log(`\nrede viaria: ${components} componentes desconexos, tamanhos ${sizes.sort((a, b) => b - a).slice(0, 12).join(', ')}${sizes.length > 12 ? ' ...' : ''}`);

console.log('\ncidade            comp  rotas de comercio');
const byComponent = new Map<number | null, string[]>();
for (const c of cities) {
  const id = componentOf(c.x, c.y);
  byComponent.set(id, [...(byComponent.get(id) ?? []), c.name]);
  console.log(`${c.name.padEnd(18)} ${String(id ?? '--').padStart(4)}`);
}

// ---- Are the pairs that trade actually joined by road? ----
let linked = 0, broken = 0;
for (const route of sim.trade.routes.values()) {
  const a = sim.cities.get(route.fromCityId), b = sim.cities.get(route.toCityId);
  if (!a || !b) continue;
  const ca = componentOf(a.x, a.y), cb = componentOf(b.x, b.y);
  const ok = ca !== null && ca === cb;
  if (ok) linked++; else { broken++; console.log(`  ROTA SEM ESTRADA CONTINUA: ${a.name} -> ${b.name} (comp ${ca} vs ${cb})`); }
}
console.log(`\nrotas de comercio: ${linked} com estrada continua, ${broken} interrompidas`);

// ---- The map ----
console.log('\nmapa (# cidade, = imperial, - pedra, . terra, ^ montanha, ~ agua):');
for (let y = 0; y < SIZE; y++) {
  let line = '';
  for (let x = 0; x < SIZE; x++) {
    const t = tileMap.getTile(x, y)!;
    if (cities.some(c => Math.round(c.x) === x && Math.round(c.y) === y)) { line += '#'; continue; }
    if (TERRAINS[t.type].isWater) { line += '~'; continue; }
    if (t.roadLevel >= 3) line += '=';
    else if (t.roadLevel === 2) line += '-';
    else if (t.roadLevel === 1) line += '.';
    else if (t.type === 'mountain') line += '^';
    else line += ' ';
  }
  console.log(line);
}
