import { TileMap } from '../world/TileMap';
import { Tile } from '../world/Tile';
import { City } from './City';
import { rng } from '../core/Random';

/**
 * Infrastructure carries real capacity (Phase H).
 *
 * Roads and ports are not decorative: a route moves only as much as the road
 * under its wheels or the harbor at its ends can carry. War damages them, and
 * repairs cost materials out of the city's stockpile. Every number here is
 * derived from tiles and building HP — nothing is invented for display.
 */

/** Building types a besieger specifically targets — the economic arteries. */
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

/**
 * Throughput factor of an overland route from its road condition.
 * A dirt trail carries 0.7×, a stone road 1.0×, an imperial highway 1.3×.
 * A ruined road collapses toward 0.4×. Routes without a surveyed path
 * (pre-infrastructure saves) run at their nominal capacity.
 */
export function roadCapacityFactor(path: { x: number; y: number }[] | undefined, tileMap: TileMap): number {
  if (!path || path.length === 0) return 1.0;
  const avg = avgEffectiveRoadLevel(path, tileMap);
  return Math.max(0.4, Math.min(1.3, 0.4 + 0.3 * avg));
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
 * Throughput factor of a maritime route from both ports' working capacity.
 * Two healthy harbors carry ~0.5×, harbor+port ~0.8×, two ports ~1.1×.
 * A destroyed port halves the route; both destroyed collapse it to 0.
 */
export function portCapacityFactor(fromCity: City, toCity: City): number {
  const t = portThroughput(fromCity) + portThroughput(toCity);
  if (t <= 0) return 0;
  return Math.max(0.2, Math.min(1.2, 0.2 + t * 0.025));
}

/** Whether a city still has a usable harbor/port (HP above half). Gates sea routes. */
export function portOperational(city: City): boolean {
  for (const b of city.buildings.values()) {
    if ((b.type === 'harbor' || b.type === 'port') && b.isOperational() && b.hp / b.maxHp > 0.5) return true;
  }
  return false;
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
 * War grinds the rails around a settlement, exactly like roads. A line under
 * sustained siege degrades and eventually severs, cutting its freight routes.
 */
export function damageRailAround(tileMap: TileMap, cx: number, cy: number, radius: number): void {
  let changed = false;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.hypot(dx, dy) > radius) continue;
      const tile = tileMap.getTile(Math.floor(cx) + dx, Math.floor(cy) + dy);
      if (!tile || tile.railLevel <= 0) continue;
      tile.railDamage = Math.min(1, tile.railDamage + rng.range(0.18, 0.42));
      tileMap.markRenderDirty(tile.x, tile.y);
      tileMap.markRailNetworkChanged(tile.x, tile.y);
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

/** Materials (stone+wood, tools weighted) a city has available for repair work. */
function repairBudget(city: City): number {
  return city.stock.get('stone') + city.stock.get('wood') * 0.5 + city.stock.get('tools') * 1.5;
}

/** Criticality of a building for repair priority — the heart of the settlement first. */
const REPAIR_PRIORITY: Record<string, number> = {
  town_center: 0,
  harbor: 1,
  port: 2,
  airport: 2.5,
  granary: 3,
  farm: 4,
  pasture: 5,
  mine: 6,
  quarry: 7,
  factory: 8,
  refinery: 9,
  market: 10,
  workshop: 11,
  smithy: 12,
  wall: 13
};

/**
 * Repairs buildings and roads, consuming real materials from the city stockpile.
 * Repairs are slow and never free: materials are spent, and only a fraction of
 * the damage closes per year.
 */
/**
 * How far past its own claimed tiles a settlement will keep the works in repair.
 *
 * Repair used to walk city.territory alone. A road or rail corridor between two
 * cities runs mostly over unclaimed ground, so a stretch wrecked by a siege
 * stayed wrecked for the rest of the world's life — and with it the supply line
 * it fed, which is precisely the thing WAR-V3 lets an enemy cut.
 */
const MAINTENANCE_RADIUS = 14;

function maintainedTiles(city: City, tileMap: TileMap): Tile[] {
  const seen = new Set<string>();
  const out: Tile[] = [];
  for (const key of city.territory) {
    const [tx, ty] = key.split(',').map(Number);
    const tile = tileMap.getTile(tx, ty);
    if (tile) { seen.add(key); out.push(tile); }
  }
  const cx = Math.round(city.x), cy = Math.round(city.y);
  for (let dx = -MAINTENANCE_RADIUS; dx <= MAINTENANCE_RADIUS; dx++) {
    for (let dy = -MAINTENANCE_RADIUS; dy <= MAINTENANCE_RADIUS; dy++) {
      if (dx * dx + dy * dy > MAINTENANCE_RADIUS * MAINTENANCE_RADIUS) continue;
      const key = `${cx + dx},${cy + dy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const tile = tileMap.getTile(cx + dx, cy + dy);
      if (tile) out.push(tile);
    }
  }
  return out;
}

export function repairInfrastructure(city: City, tileMap: TileMap): void {
  let roadsChanged = false;
  let railsChanged = false;
  // --- Buildings ---
  const damaged = [...city.buildings.values()]
    .filter(b => (b.lifecycleState === 'damaged' || b.lifecycleState === 'normal') && b.hp < b.maxHp)
    .sort((a, b) => (REPAIR_PRIORITY[a.type] ?? 50) - (REPAIR_PRIORITY[b.type] ?? 50));
  for (const b of damaged) {
    const missing = b.maxHp - b.hp;
    if (missing <= 1) continue;
    const budget = repairBudget(city);
    if (budget <= 0) break;
    // A year of labour closes a quarter of the damage, capped by materials.
    const want = missing * 0.25;
    const spend = Math.min(want, budget);
    if (spend <= 0) continue;
    const stone = Math.min(city.stock.get('stone'), spend * 0.55);
    const wood = Math.min(city.stock.get('wood'), spend * 0.35);
    const tools = Math.min(city.stock.get('tools'), spend * 0.1);
    city.stock.take('stone', stone);
    city.stock.take('wood', wood);
    city.stock.take('tools', tools);
    if (stone > 0) city.ledger.recordConsumed('stone', stone);
    if (wood > 0) city.ledger.recordConsumed('wood', wood);
    if (tools > 0) city.ledger.recordConsumed('tools', tools);
    b.hp = Math.min(b.maxHp, b.hp + (stone / 0.55 + wood / 0.35 + tools / 0.1) * 0.55);
    tileMap.markRenderDirty(b.x, b.y);
  }

  // --- Roads ---
  if (repairBudget(city) <= 0) return;
  const roadTiles = maintainedTiles(city, tileMap).filter(t => t.roadLevel > 0 && t.roadDamage > 0);
  // Most important roads (highest level) are rebuilt first.
  roadTiles.sort((a, b) => b.roadLevel - a.roadLevel);
  for (const tile of roadTiles) {
    const budget = repairBudget(city);
    if (budget <= 0) break;
    const fix = Math.min(tile.roadDamage, 0.45);
    const stone = Math.min(city.stock.get('stone'), fix * tile.roadLevel * 0.6);
    const wood = Math.min(city.stock.get('wood'), fix * tile.roadLevel * 0.4);
    if (stone + wood <= 0) break;
    city.stock.take('stone', stone);
    city.stock.take('wood', wood);
    if (stone > 0) city.ledger.recordConsumed('stone', stone);
    if (wood > 0) city.ledger.recordConsumed('wood', wood);
    tile.roadDamage = Math.max(0, tile.roadDamage - fix);
    tileMap.markRenderDirty(tile.x, tile.y);
    tileMap.markRoadNetworkChanged(tile.x, tile.y);
    roadsChanged = true;
  }

  // --- Railways ---
  const railTiles = maintainedTiles(city, tileMap).filter(t => t.railLevel > 0 && t.railDamage > 0);
  for (const tile of railTiles) {
    const budget = repairBudget(city);
    if (budget <= 0) break;
    const fix = Math.min(tile.railDamage, 0.45);
    const steel = Math.min(city.stock.get('steel'), fix * 0.8);
    const stone = Math.min(city.stock.get('stone'), fix * 0.5);
    if (steel + stone <= 0) break;
    city.stock.take('steel', steel);
    city.stock.take('stone', stone);
    if (steel > 0) city.ledger.recordConsumed('steel', steel);
    if (stone > 0) city.ledger.recordConsumed('stone', stone);
    tile.railDamage = Math.max(0, tile.railDamage - fix);
    tileMap.markRenderDirty(tile.x, tile.y);
    tileMap.markRailNetworkChanged(tile.x, tile.y);
    railsChanged = true;
  }
  void roadsChanged; void railsChanged;
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
