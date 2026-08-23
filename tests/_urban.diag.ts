/** Throwaway diagnostic: what does a grown city actually look like? */
import { TileMap } from '../src/world/TileMap';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SpeciesType } from '../src/entities/Species';
import { TERRAINS } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { rng } from '../src/core/Random';

const YEARS = Number(process.env.YEARS ?? 90);
const SIZE = Number(process.env.SIZE ?? 72);
const SEED = Number(process.env.SEED ?? 20260802);
const SHOW = Number(process.env.SHOW ?? 2);

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

const GLYPH: Record<string, string> = {
  town_center: '@', house: 'h', farm: 'f', pasture: 'p', lumber_camp: 'l',
  mine: 'm', quarry: 'q', oil_well: 'o', workshop: 'w', smithy: 's', factory: 'F',
  refinery: 'R', granary: 'g', market: 'k', harbor: 'H', port: 'P', warehouse: 'W',
  barracks: 'B', keep: 'K', wall: '#', temple: 't', library: 'i', great_library: 'I',
  monument: 'M', colosseum: 'C', aqueduct: 'a', grand_aqueduct: 'A', university: 'U'
};

function render(city: City): void {
  const bs = [...city.buildings.values()];
  if (bs.length === 0) return;
  const pad = 3;
  const minX = Math.min(...bs.map(b => b.x)) - pad, maxX = Math.max(...bs.map(b => b.x)) + pad;
  const minY = Math.min(...bs.map(b => b.y)) - pad, maxY = Math.max(...bs.map(b => b.y)) + pad;

  const at = new Map<string, string>();
  const counts: Record<string, number> = {};
  for (const b of bs) {
    at.set(`${Math.round(b.x)},${Math.round(b.y)}`, GLYPH[b.type] ?? '?');
    counts[b.type] = (counts[b.type] ?? 0) + 1;
  }

  // Walls are excluded: a perimeter is contiguous by design and would report a
  // solid city no matter how scattered the buildings are.
  const urban = bs.filter(b => b.type !== 'wall');
  const occupied = new Set(urban.map(b => `${Math.round(b.x)},${Math.round(b.y)}`));
  let touching = 0;
  for (const b of urban) {
    const bx = Math.round(b.x), by = Math.round(b.y);
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => occupied.has(`${bx + dx},${by + dy}`))) touching++;
  }

  let land = 0, dirt = 0, stone = 0, imperial = 0, free = 0;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      const t = tileMap.getTile(x, y);
      if (!t || TERRAINS[t.type].isWater || !TERRAINS[t.type].isWalkable) continue;
      land++;
      if (t.roadLevel >= 3) imperial++;
      else if (t.roadLevel === 2) stone++;
      else if (t.roadLevel === 1) dirt++;
      else if (!t.buildingId) free++;
    }
  }
  const roads = dirt + stone + imperial;

  console.log(`\n=== ${city.name} — pop ${city.population}, tier ${city.tier}, ${bs.length} predios ===`);
  console.log(`    ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}x${n}`).join(' ')}`);
  console.log(`    ADJACENCIA ${urban.length ? (touching / urban.length * 100).toFixed(0) : 0}% (${touching}/${urban.length} sem-muralha com vizinho)`);
  console.log(`    solo ${land}: RUAS ${roads} (terra ${dirt}, pedra ${stone}, imperial ${imperial}), vago ${free}, com predio ${land - roads - free}\n`);

  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    let line = '';
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      const glyph = at.get(`${x},${y}`);
      if (glyph) { line += glyph; continue; }
      const tile = tileMap.getTile(x, y);
      if (!tile) { line += ' '; continue; }
      if (TERRAINS[tile.type].isWater) { line += '~'; continue; }
      if (tile.roadLevel >= 3) line += '=';
      else if (tile.roadLevel === 2) line += '-';
      else if (tile.roadLevel === 1) line += '.';
      else if (tile.type === 'mountain') line += '^';
      else line += ' ';
    }
    console.log('    ' + line);
  }
}

const ranked = [...sim.cities.values()].sort((a, b) => b.population - a.population);
console.log(`ano ${sim.currentYear} — ${sim.cities.size} cidades, ${sim.kingdoms.size} reinos`);
for (const c of ranked.slice(0, SHOW)) render(c);
