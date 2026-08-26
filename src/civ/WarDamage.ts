import { TileMap } from '../world/TileMap';
import { Tile } from '../world/Tile';
import { City } from './City';
import { rng } from '../core/Random';

/**
 * What a war does to the ground it is fought over.
 *
 * A siege wrecks the roads around a city, an assault wrecks what the city was
 * built out of, and an army moves at the speed of whatever surface it is on.
 * All of it is visible: a damaged road is drawn damaged and is slower to march
 * along, and a wrecked granary shows its condition when you click it.
 *
 * There is no repair accounting here and no upkeep ledger — this file only ever
 * breaks things, because breaking things is the part you watch.
 */

const STRATEGIC_BUILDINGS = ['airport', 'harbor', 'port', 'factory', 'refinery', 'granary', 'market', 'workshop'];

/** Continuous effective road grade along a surveyed path (0..3). */
export function avgEffectiveRoadLevel(path: { x: number; y: number }[] | undefined, tileMap: TileMap): number {
  if (!path || path.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const step of path) {
    const tile = tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
    if (!tile) continue;
    sum += tile.roadLevel * (1 - tile.roadDamage);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/** Whether a city still has a usable harbor/port (HP above half). Gates sea routes. */
export function portOperational(city: City): boolean {
  for (const b of city.buildings.values()) {
    if ((b.type === 'harbor' || b.type === 'port') && b.isOperational() && b.hp / b.maxHp > 0.5) return true;
  }
  return false;
}

/** Cargo a port can move per year: 6 per working harbor, 18 per working port, scaled by HP. */
function portThroughput(city: City): number {
  let throughput = 0;
  for (const b of city.buildings.values()) {
    if (b.type !== 'harbor' && b.type !== 'port') continue;
    if (!b.isOperational()) continue;
    const health = b.hp / b.maxHp;
    if (health <= 0.5) continue; // knocked out of action
    throughput += (b.type === 'harbor' ? 6 : 18) * health;
  }
  return throughput;
}

/**
 * War grinds the roads around a settlement. Called each year of a siege.
 * Roads inside the radius take damage that only a real repair pass can undo.
 */
export function damageRoadsAround(tileMap: TileMap, cx: number, cy: number, radius: number): void {
  let changed = false;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.hypot(dx, dy) > radius) continue;
      const tile = tileMap.getTile(Math.floor(cx) + dx, Math.floor(cy) + dy);
      if (!tile || tile.roadLevel <= 0) continue;
      tile.roadDamage = Math.min(1, tile.roadDamage + rng.range(0.18, 0.42));
      tileMap.markRenderDirty(tile.x, tile.y);
      tileMap.markRoadNetworkChanged(tile.x, tile.y);
      changed = true;
    }
  }
  void changed;
}

/**
 * A besieger breaks the settlement's economic arteries. Strategic commerce and
 * infrastructure buildings are hit before the rest.
 */
export function damageStrategicBuildings(city: City, tileMap?: TileMap, year: number = 0): void {
  const vital = [...city.buildings.values()]
    .filter(b => STRATEGIC_BUILDINGS.includes(b.type))
    .sort((a, b) => STRATEGIC_BUILDINGS.indexOf(a.type) - STRATEGIC_BUILDINGS.indexOf(b.type));
  const pool = vital.length > 0 ? vital : [...city.buildings.values()];
  const hits = rng.rangeInt(1, Math.min(3, pool.length));
  for (let i = 0; i < hits; i++) {
    const target = pool[rng.rangeInt(0, pool.length - 1)];
    const nextHp = Math.max(1, Math.round(target.hp * rng.range(0.72, 0.95)));
    target.applyDamage(target.hp - nextHp, year, 'war');
    tileMap?.markRenderDirty(target.x, target.y);
  }
}

/**
 * Roads a besieger works hardest to break: the main haulage routes into the
 * settlement. Heavily-trafficked high roads near the walls take extra damage.
 */
export function damagePrimaryRoads(tileMap: TileMap, cx: number, cy: number, radius: number): void {
  let best: Tile | null = null;
  let bestScore = -1;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const tile = tileMap.getTile(Math.floor(cx) + dx, Math.floor(cy) + dy);
      if (!tile || tile.roadLevel <= 0) continue;
      const score = tile.roadLevel * 10 + tile.roadTraffic;
      if (score > bestScore) { bestScore = score; best = tile; }
    }
  }
  if (best) {
    best.roadDamage = Math.min(1, best.roadDamage + 0.6);
    tileMap.markRenderDirty(best.x, best.y);
    tileMap.markRoadNetworkChanged(best.x, best.y);
  }
}
