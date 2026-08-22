import { Building, type FortificationRole } from './Building';
import type { City } from './City';
import type { Kingdom } from './Kingdom';
import type { DiplomacyManager } from './Diplomacy';
import type { TileMap } from '../world/TileMap';
import { TerrainType, TERRAINS } from '../world/Biomes';
import { buildingArchitecturalStamp } from './ArchitecturalProfile';
import { hashString, hashToUnit, nextId } from '../core/Random';

export type FortificationStatus = 'active' | 'historic';

export interface FortificationPoint { x: number; y: number; }

/** Durable CITY-V4 history. The renderer uses the referenced static Buildings. */
export interface FortificationLine {
  schema: 1;
  id: string;
  generation: number;
  builtYear: number;
  status: FortificationStatus;
  fortificationFamily: string;
  material: string;
  outline: FortificationPoint[];
  buildingIds: string[];
  gateIds: string[];
  towerIds: string[];
  perimeter: number;
  originalUrbanBuildings: number;
  strategicScore: number;
}

export interface FortificationWorld {
  year: number;
  tileMap: TileMap;
  diplomacy: DiplomacyManager;
}

const ERA_ORDER = ['stone', 'bronze', 'iron', 'classical', 'industrial', 'modern'] as const;
const NON_URBAN = new Set(['farm', 'pasture', 'lumber_camp', 'quarry', 'mine', 'oil_well', 'harbor', 'port']);

function key(x: number, y: number): string { return `${x},${y}`; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

/** ID-only check keeps pathfinding independent from city scans. Gates remain passable. */
export function isFortificationBarrierId(id: string | null): boolean {
  return !!id && (id.startsWith('fort_segment_') || id.startsWith('fort_corner_') || id.startsWith('fort_tower_'));
}

export function pointInsideFortification(line: FortificationLine, x: number, y: number): boolean {
  const points = line.outline;
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    const crosses = (a.y > y) !== (b.y > y)
      && x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1e-6) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function outerFortification(city: City): FortificationLine | null {
  for (let i = city.fortificationLines.length - 1; i >= 0; i--) {
    if (city.fortificationLines[i].status === 'active') return city.fortificationLines[i];
  }
  return city.fortificationLines[city.fortificationLines.length - 1] ?? null;
}

function cross(o: FortificationPoint, a: FortificationPoint, b: FortificationPoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(input: FortificationPoint[]): FortificationPoint[] {
  const unique = [...new Map(input.map(point => [key(point.x, point.y), point])).values()]
    .sort((a, b) => a.x - b.x || a.y - b.y);
  if (unique.length <= 2) return unique;
  const lower: FortificationPoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: FortificationPoint[] = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const point = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function fallbackOutline(city: City, generation: number, radius: number): FortificationPoint[] {
  const points: FortificationPoint[] = [];
  const seed = hashString(city.id);
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    const variation = 1 + (hashToUnit(seed, generation, i) - .5) * .22;
    points.push({ x: city.x + Math.cos(angle) * radius * variation, y: city.y + Math.sin(angle) * radius * variation });
  }
  return points;
}

function expandedOutline(city: City, generation: number, buildings: Building[], map: TileMap): FortificationPoint[] {
  const urban = buildings.filter(building => !building.fortificationRole && !NON_URBAN.has(building.type));
  let hull = convexHull(urban.map(building => ({ x: building.x + .5, y: building.y + .5 })));
  const maximum = urban.reduce((best, building) => Math.max(best, Math.hypot(building.x - city.x, building.y - city.y)), 2);
  if (hull.length < 3) return fallbackOutline(city, generation, maximum + 2.8 + generation * 1.2);
  const center = hull.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  center.x /= hull.length; center.y /= hull.length;
  const margin = 2.35 + generation * 1.25;
  const seed = hashString(city.id);
  const expanded: FortificationPoint[] = [];
  for (let i = 0; i < hull.length; i++) {
    const point = hull[i];
    const dx = point.x - center.x, dy = point.y - center.y;
    const length = Math.max(.01, Math.hypot(dx, dy));
    const amount = margin * (.86 + hashToUnit(seed, generation, i) * .28);
    expanded.push({
      x: clamp(point.x + dx / length * amount, 1, map.width - 2),
      y: clamp(point.y + dy / length * amount, 1, map.height - 2)
    });
    // A displaced midpoint prevents the convex hull from reading as a perfect polygon.
    const next = hull[(i + 1) % hull.length];
    const mx = (point.x + next.x) * .5, my = (point.y + next.y) * .5;
    const mdx = mx - center.x, mdy = my - center.y, mlen = Math.max(.01, Math.hypot(mdx, mdy));
    const bend = amount * (.72 + hashToUnit(seed, generation, i + 91) * .32);
    expanded.push({
      x: clamp(mx + mdx / mlen * bend, 1, map.width - 2),
      y: clamp(my + mdy / mlen * bend, 1, map.height - 2)
    });
  }
  hull = expanded;
  return hull;
}

function rasterLine(a: FortificationPoint, b: FortificationPoint): FortificationPoint[] {
  let x0 = Math.round(a.x), y0 = Math.round(a.y), x1 = Math.round(b.x), y1 = Math.round(b.y);
  const points: FortificationPoint[] = [];
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x0 += sx; }
    if (twice <= dx) { error += dx; y0 += sy; }
  }
  return points;
}

function candidateValid(map: TileMap, x: number, y: number): boolean {
  const tile = map.getTile(x, y);
  if (!tile || tile.buildingId || tile.railLevelEffective > 0) return false;
  const terrain = TERRAINS[tile.type];
  return !terrain.isWater && terrain.isWalkable && tile.type !== TerrainType.LAVA && tile.type !== TerrainType.MOUNTAIN;
}

function adaptToTerrain(map: TileMap, intended: FortificationPoint, center: FortificationPoint): FortificationPoint | null {
  if (candidateValid(map, intended.x, intended.y)) return intended;
  let best: FortificationPoint | null = null, bestScore = Infinity;
  const originalRadius = Math.hypot(intended.x - center.x, intended.y - center.y);
  for (let radius = 1; radius <= 2; radius++) for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
    const x = intended.x + dx, y = intended.y + dy;
    if (!candidateValid(map, x, y)) continue;
    const tile = map.getTile(x, y)!;
    const radial = Math.abs(Math.hypot(x - center.x, y - center.y) - originalRadius);
    const score = Math.hypot(dx, dy) * 8 + radial * 2 - tile.roadLevelEffective * 3;
    if (score < bestScore) { bestScore = score; best = { x, y }; }
  }
  // Water, cliff and occupied lots can deliberately close a section: the
  // natural obstacle becomes part of the defensive circuit.
  return best;
}

function rasterOutline(outline: FortificationPoint[], map: TileMap, city: City): FortificationPoint[] {
  const result: FortificationPoint[] = [];
  const seen = new Set<string>();
  const center = { x: city.x, y: city.y };
  for (let i = 0; i < outline.length; i++) {
    for (const intended of rasterLine(outline[i], outline[(i + 1) % outline.length])) {
      const adapted = adaptToTerrain(map, intended, center);
      if (!adapted || seen.has(key(adapted.x, adapted.y))) continue;
      seen.add(key(adapted.x, adapted.y)); result.push(adapted);
    }
  }
  return result;
}

function roadImportance(map: TileMap, point: FortificationPoint): number {
  let score = 0;
  for (let radius = 0; radius <= 3; radius++) for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
    if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
    const tile = map.getTile(point.x + dx, point.y + dy);
    if (!tile || tile.roadLevelEffective <= 0) continue;
    score = Math.max(score, tile.roadLevelEffective * 28 + Math.min(30, tile.roadTraffic * .25) - radius * 12);
  }
  return score;
}

function circularDistance(a: number, b: number, length: number): number {
  const direct = Math.abs(a - b); return Math.min(direct, length - direct);
}

function selectGates(path: FortificationPoint[], map: TileMap, city: City): Set<number> {
  const wanted = clamp(Math.round(path.length / 24), 2, 4);
  const seed = hashString(city.id);
  const ranked = path.map((point, index) => ({
    index,
    // Existing traffic dominates. The historical high-street axes are the
    // deterministic fallback, so a gate is never just sprinkled at random.
    score: roadImportance(map, point)
      + Math.max(0, 18 - Math.min(Math.abs(point.x - city.x), Math.abs(point.y - city.y)) * 4)
      + hashToUnit(seed, index, path.length) * 2
  })).sort((a, b) => b.score - a.score);
  const selected = new Set<number>();
  for (const candidate of ranked) {
    if ([...selected].some(index => circularDistance(index, candidate.index, path.length) < Math.max(5, path.length / wanted * .42))) continue;
    selected.add(candidate.index);
    if (selected.size >= wanted) break;
  }
  return selected;
}

function isCorner(path: FortificationPoint[], index: number): boolean {
  const previous = path[(index - 1 + path.length) % path.length];
  const point = path[index];
  const next = path[(index + 1) % path.length];
  const ax = Math.sign(point.x - previous.x), ay = Math.sign(point.y - previous.y);
  const bx = Math.sign(next.x - point.x), by = Math.sign(next.y - point.y);
  return ax !== bx || ay !== by;
}

function selectTowers(path: FortificationPoint[], gates: Set<number>, city: City, kingdom: Kingdom): Set<number> {
  const martial = city.architecturalProfile?.primaryTradition === 'martial' || city.architecturalProfile?.secondaryTradition === 'martial';
  const spacing = martial || kingdom.culture.militarism > .65 ? 5 : 8;
  const towers = new Set<number>();
  let sinceTower = spacing;
  for (let i = 0; i < path.length; i++, sinceTower++) {
    if (gates.has(i) || [...gates].some(gate => circularDistance(gate, i, path.length) < 2)) continue;
    if ((isCorner(path, i) && sinceTower >= 3) || sinceTower >= spacing) { towers.add(i); sinceTower = 0; }
  }
  return towers;
}

function ensureGateApproach(map: TileMap, gate: FortificationPoint, city: City, occupied: Set<string>): void {
  const dx = Math.abs(gate.x - city.x) >= Math.abs(gate.y - city.y) ? Math.sign(gate.x - city.x) : 0;
  const dy = dx === 0 ? Math.sign(gate.y - city.y) : 0;
  for (let step = -8; step <= 2; step++) {
    const x = gate.x + dx * step, y = gate.y + dy * step;
    const tile = map.getTile(x, y);
    if (!tile || tile.railLevelEffective > 0 || (tile.buildingId && !occupied.has(key(x, y)))) continue;
    const terrain = TERRAINS[tile.type];
    if (terrain.isWater || !terrain.isWalkable || tile.type === TerrainType.LAVA || tile.type === TerrainType.MOUNTAIN) continue;
    if (tile.roadLevel < 1) tile.roadLevel = 1;
    tile.cityId = city.id;
    if (city.kingdomId) tile.kingdomId = city.kingdomId;
    map.markRenderDirty(x, y);
  }
}

function strategicScore(city: City, kingdom: Kingdom, world: FortificationWorld): number {
  const capital = kingdom.capitalCityId === city.id ? .42 : 0;
  const activeWars = world.diplomacy.getWarsFor(kingdom.id).length;
  const threat = Math.min(.85, kingdom.externalThreat * .75 + (activeWars > 0 ? .38 : 0));
  const population = Math.min(.72, city.population / 150);
  const wealth = Math.min(.42, city.stock.get('stone') / 260 + city.stock.get('wood') / 500);
  const political = Math.min(.28, kingdom.cityIds.size > 0 ? city.population / Math.max(1, kingdom.totalPopulation) : 0);
  let terrain = city.architecturalProfile?.coastal ? .12 : 0;
  if (world.tileMap.getNeighbors(city.x, city.y, true).some(tile => tile.type === TerrainType.MOUNTAIN)) terrain += .12;
  return population + city.prosperity * .32 + wealth + capital + political + threat + terrain;
}

function outsideShare(city: City, line: FortificationLine): number {
  let urban = 0, outside = 0;
  for (const building of city.buildings.values()) {
    if (building.fortificationRole || NON_URBAN.has(building.type)) continue;
    urban++;
    if (!pointInsideFortification(line, building.x + .5, building.y + .5)) outside++;
  }
  return urban > 0 ? outside / urban : 0;
}

function canAfford(city: City, pathLength: number): { stone: number; wood: number } | null {
  const material = city.architecturalProfile?.primaryMaterial;
  const timber = material === 'timber' || material === 'thatch';
  const stone = Math.ceil(pathLength * (timber ? .42 : 1.18));
  const wood = Math.ceil(pathLength * (timber ? 1.15 : .28));
  // A circuit must not spend the settlement's last stone. This used to commission
  // walls the moment the exact cost was on hand, which emptied the stores and left
  // nothing for the barracks, smithy or keep that also need stone — a city with
  // forty-five wall segments would sit on seven stone and never build anything of
  // stone again. Keep enough back for one ordinary stone building.
  const reserve = 40;
  return city.stock.get('stone') >= stone + reserve && city.stock.get('wood') >= wood ? { stone, wood } : null;
}

export interface FortificationTickResult {
  built: FortificationLine | null;
  retired: FortificationLine | null;
  reason: string;
}

/** Event/year-driven policy. It never runs from a render frame. */
export class FortificationPlanner {
  public static tickCity(city: City, kingdom: Kingdom | null, world: FortificationWorld): FortificationTickResult {
    if (!kingdom || city.population <= 0 || (world.year + Math.abs(hashString(city.id))) % 3 !== 0) {
      return { built: null, retired: null, reason: 'cadence' };
    }
    const era = city.architecturalProfile?.era ?? kingdom.operatingEra;
    const eraIndex = ERA_ORDER.indexOf(era);
    const wars = world.diplomacy.getWarsFor(kingdom.id).length;
    let retired: FortificationLine | null = null;
    if (era === 'modern' && wars === 0) {
      const active = city.fortificationLines.find(line => line.status === 'active');
      if (active && world.year - active.builtYear >= 24) { active.status = 'historic'; retired = active; }
      return { built: null, retired, reason: retired ? 'obsolete' : 'modern' };
    }
    const unlocked = kingdom.research.unlockedBuildings().has('wall') || kingdom.research.knows('masonry');
    if (!unlocked || eraIndex < 1) return { built: null, retired, reason: 'technology' };

    const active = [...city.fortificationLines].reverse().find(line => line.status === 'active') ?? null;
    const generation = city.fortificationLines.length;
    if (generation >= 3) return { built: null, retired, reason: 'maximum-lines' };
    const score = strategicScore(city, kingdom, world);
    if (!active) {
      const minimumPopulation = wars > 0 || kingdom.externalThreat > .5 ? 20 : 36;
      if (city.population < minimumPopulation || score < 1.48) return { built: null, retired, reason: 'not-important-enough' };
    } else {
      const share = outsideShare(city, active);
      const age = world.year - active.builtYear;
      if (share < .26 || age < 12 || city.population < 68 || score < 1.72) return { built: null, retired, reason: 'inside-capacity' };
      if (eraIndex >= 4 && wars === 0) return { built: null, retired, reason: 'obsolete-era' };
    }

    const outline = expandedOutline(city, generation, [...city.buildings.values()], world.tileMap);
    const path = rasterOutline(outline, world.tileMap, city);
    if (path.length < 12) return { built: null, retired, reason: 'terrain-blocked' };
    const cost = canAfford(city, path.length);
    if (!cost) return { built: null, retired, reason: 'materials' };

    city.stock.take('stone', cost.stone);
    city.stock.take('wood', cost.wood);
    const line: FortificationLine = {
      schema: 1,
      id: nextId('fort_line'),
      generation,
      builtYear: world.year,
      status: 'active',
      fortificationFamily: city.architecturalProfile?.fortificationFamily ?? 'vernacular:stone',
      material: city.architecturalProfile?.primaryMaterial ?? 'stone',
      outline,
      buildingIds: [], gateIds: [], towerIds: [],
      perimeter: path.length,
      originalUrbanBuildings: [...city.buildings.values()].filter(building => !building.fortificationRole && !NON_URBAN.has(building.type)).length,
      strategicScore: Number(score.toFixed(3))
    };
    for (const former of city.fortificationLines) if (former.status === 'active') former.status = 'historic';

    const gates = selectGates(path, world.tileMap, city);
    const towers = selectTowers(path, gates, city, kingdom);
    const occupied = new Set(path.map(point => key(point.x, point.y)));
    for (let index = 0; index < path.length; index++) {
      const point = path[index];
      const role: FortificationRole = gates.has(index) ? 'gate' : towers.has(index) ? 'tower' : isCorner(path, index) ? 'corner' : 'segment';
      if (role === 'gate') ensureGateApproach(world.tileMap, point, city, occupied);
      const building = new Building(nextId(`fort_${role}`), 'wall', point.x, point.y, city.id);
      building.fortificationRole = role;
      building.fortificationLineId = line.id;
      building.recordUrbanOrigin(world.year, city.urbanPhase, city.currentUrbanGeneration);
      if (city.architecturalProfile) building.recordArchitecture(buildingArchitecturalStamp(city.architecturalProfile, world.year));
      if (role === 'tower') { building.maxHp = Math.round(building.maxHp * 1.35); building.hp = building.maxHp; }
      if (role === 'gate') { building.maxHp = Math.round(building.maxHp * .82); building.hp = building.maxHp; }
      city.buildings.set(building.id, building);
      line.buildingIds.push(building.id);
      if (role === 'gate') line.gateIds.push(building.id);
      if (role === 'tower') line.towerIds.push(building.id);
      const tile = world.tileMap.getTile(point.x, point.y)!;
      tile.buildingId = building.id;
      tile.cityId = city.id;
      if (city.kingdomId) tile.kingdomId = city.kingdomId;
      city.territory.add(key(point.x, point.y));
      world.tileMap.markRenderDirty(point.x, point.y);
    }
    city.fortificationLines.push(line);
    city.markBuildingTopologyChanged();

    // Path caches are chunk-versioned. Touch each affected chunk once so old
    // routes are reconsidered without invalidating the whole world network.
    const touchedChunks = new Set<string>();
    for (const point of path) {
      const chunkKey = `${Math.floor(point.x / world.tileMap.chunkSize)}:${Math.floor(point.y / world.tileMap.chunkSize)}`;
      if (touchedChunks.has(chunkKey)) continue;
      touchedChunks.add(chunkKey);
      world.tileMap.markRoadNetworkChanged(point.x, point.y);
    }
    return { built: line, retired, reason: 'built' };
  }
}
