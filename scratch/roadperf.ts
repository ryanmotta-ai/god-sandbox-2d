/**
 * Frame cost of the road pass on a deliberately over-roaded world.
 *
 * The pass rebuilds its graph every frame, so the number that matters is the
 * cost at full map extent with far more road than any real game produces.
 * Served by vite from scratch/roadperf.html.
 */
import { TileMap } from '../src/world/TileMap';
import { TERRAINS } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom, getNextKingdomColor } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { Camera } from '../src/renderer/Camera';
import { PixelRenderer } from '../src/renderer/Renderer';
import { ParticleManager } from '../src/renderer/Particles';
import { WorldEra } from '../src/world/WeatherEras';
import { rng } from '../src/core/Random';

rng.setSeed(4242);
const SIZE = 128;
const map = new TileMap(SIZE, SIZE, 'single_continent', 4242);

// `?dense=1` puts a road on a third of all land — many times what any real
// world carries, and enough that the screen is mostly road, so the pass goes
// fill-rate bound. The default is a mature network: long routes on a coarse
// lattice, which is the density that actually decides the frame budget.
const DENSE = new URLSearchParams(location.search).has('dense');
const PITCH = DENSE ? 3 : 11;
let roadTiles = 0;
for (let x = 0; x < SIZE; x++) {
  for (let y = 0; y < SIZE; y++) {
    const t = map.grid[x][y];
    if (TERRAINS[t.type].isWater) continue;
    if ((x % PITCH === 0) || (y % PITCH === 0)) {
      t.roadLevel = 1 + ((x + y) % 3);
      t.roadDamage = (x + y) % 17 === 0 ? 0.3 : 0;
      roadTiles++;
    }
  }
}

const cities = new Map<string, City>();
const kingdoms = new Map<string, Kingdom>();
const city = new City('c', 'Hub', SpeciesType.HUMAN, 64, 64, 'Founder', 1);
const kingdom = new Kingdom('k', 'Realm', SpeciesType.HUMAN, getNextKingdomColor(), city.id, 0);
city.kingdomId = kingdom.id;
cities.set(city.id, city);
kingdoms.set(kingdom.id, kingdom);

const canvas = document.createElement('canvas');
canvas.width = 1600;
canvas.height = 900;
document.body.append(canvas);
const renderer = new PixelRenderer(canvas);
const particles = new ParticleManager();

/** Frame cost with the roads erased, so the pass can be measured on its own. */
function timeAt(zoom: number, withRoads: boolean): number {
  const saved: number[] = [];
  if (!withRoads) {
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) { saved.push(map.grid[x][y].roadLevel); map.grid[x][y].roadLevel = 0; }
    }
  }
  const camera = new Camera();
  camera.setWorldBounds(SIZE, SIZE);
  camera.centerOn(64, 64, zoom);
  camera.zoom = zoom;
  camera.targetZoom = zoom;
  for (let i = 0; i < 5; i++) renderer.render(camera, map, [], cities, kingdoms, particles, 'none', WorldEra.GOLDEN_AGE, null, null, 1);
  const runs = 20;
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) renderer.render(camera, map, [], cities, kingdoms, particles, 'none', WorldEra.GOLDEN_AGE, null, null, 1);
  const ms = (performance.now() - t0) / runs;
  if (!withRoads) {
    let k = 0;
    for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) map.grid[x][y].roadLevel = saved[k++];
  }
  return ms;
}

const lines: string[] = [`road tiles: ${roadTiles}`];
for (const zoom of [0.5, 1, 2, 4]) {
  const withRoads = timeAt(zoom, true);
  const without = timeAt(zoom, false);
  lines.push(`zoom ${zoom} (tileSize ${(16 * zoom).toFixed(0)}): total ${withRoads.toFixed(1)} ms, no roads ${without.toFixed(1)} ms, road pass ${(withRoads - without).toFixed(1)} ms`);
}

document.getElementById('out')!.textContent = lines.join('\n');
(window as unknown as { perfResult: string; perfDone: boolean }).perfResult = lines.join('\n');
(window as unknown as { perfDone: boolean }).perfDone = true;
