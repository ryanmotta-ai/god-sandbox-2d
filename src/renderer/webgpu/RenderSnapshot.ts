import type { City } from '../../civ/City';
import type { Entity } from '../../entities/Entity';
import type { Kingdom } from '../../civ/Kingdom';
import { SpatialHash } from '../../core/SpatialHash';
import type { Camera } from '../Camera';
import type { SelectionMark } from '../Renderer';
import { RESOURCE_COLORS, clamp, mixColor, parseColor } from '../TerrainPalette';
import type { OverlayMode } from '../Overlays';
import { TerrainType } from '../../world/Biomes';
import type { TileMap } from '../../world/TileMap';
import type { AtlasRegion } from './TextureAtlas';
import { resolveCityBuildingVisual, BUILDING_DRAW_SCALE } from '../CityVisualResolver';
import { GOODS } from '../../civ/Goods';
import { entityArtAtlasKey } from '../../assets/EntityAssetManifest';
import { resolveEntitySheetAnimation, resolveEntityVisualProfile } from '../EntityVisualResolver';

export const INSTANCE_BYTES = 48;
export const RENDER_CHUNK_SIZE = 32;

export interface RenderCameraSnapshot {
  viewportWidth: number;
  viewportHeight: number;
  /** Absolute camera pixel position. Chunk vertices stay stable in world space. */
  relativeCameraX: number;
  relativeCameraY: number;
  worldOriginX: number;
  worldOriginY: number;
  shakeX: number;
  shakeY: number;
  tileSize: number;
  zoom: number;
  interpolationAlpha: number;
  devicePixelRatio: number;
}

export interface RenderChunkSnapshot {
  key: string;
  chunkX: number;
  chunkY: number;
  /** One immutable upload range per atlas page. */
  pageData: ReadonlyMap<number, Uint8Array>;
  instances: number;
  revision: number;
}

export interface RenderSnapshot {
  camera: RenderCameraSnapshot;
  dynamicPageData: ReadonlyMap<number, Uint8Array>;
  staticInstances: number;
  dynamicInstances: number;
  staticRevision: number;
  renderPreparationMs: number;
  benchmarkInstances: number;
  chunks: readonly RenderChunkSnapshot[];
  residentChunks: number;
  updatedChunks: number;
}

interface RenderSpatialSource<T> extends Iterable<T> {
  queryRect?(minX: number, minY: number, maxX: number, maxY: number, result?: T[]): T[];
}

export interface SnapshotBuildInput {
  camera: Camera;
  tileMap: TileMap;
  entities: Entity[];
  cities: Map<string, City>;
  kingdoms?: Map<string, Kingdom>;
  showGrid?: boolean;
  overlayMode: OverlayMode;
  selection: SelectionMark | null;
  entityIndex?: SpatialHash<Entity>;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

interface PackedInstance {
  previousX: number; previousY: number; x: number; y: number;
  width: number; height: number; region: AtlasRegion; tint: number; layer: number;
}

interface IndexedBuilding {
  id: string;
  x: number;
  y: number;
  city: City;
  building: City['buildings'] extends Map<string, infer B> ? B : never;
}

interface BuildingIndexCache {
  index: SpatialHash<IndexedBuilding>;
  entries: Map<string, IndexedBuilding>;
  dirtyChunks: Set<string>;
  topologySignature: number;
  eraSignature: string;
}

/** Allocation-reusing writer for the documented 48-byte instance ABI. */
export class PackedInstanceWriter {
  private buffer = new ArrayBuffer(INSTANCE_BYTES * 256);
  private view = new DataView(this.buffer);
  private length = 0;
  public get count(): number { return this.length; }
  public reset(): void { this.length = 0; }
  public push(instance: PackedInstance): void {
    this.ensure(this.length + 1);
    const o = this.length++ * INSTANCE_BYTES;
    this.view.setFloat32(o, instance.previousX, true); this.view.setFloat32(o + 4, instance.previousY, true);
    this.view.setFloat32(o + 8, instance.x, true); this.view.setFloat32(o + 12, instance.y, true);
    this.view.setFloat32(o + 16, instance.width, true); this.view.setFloat32(o + 20, instance.height, true);
    this.view.setFloat32(o + 24, instance.region.u0, true); this.view.setFloat32(o + 28, instance.region.v0, true);
    this.view.setFloat32(o + 32, instance.region.u1, true); this.view.setFloat32(o + 36, instance.region.v1, true);
    this.view.setUint32(o + 40, instance.tint, true); this.view.setFloat32(o + 44, instance.layer, true);
  }
  public bytes(): Uint8Array { return new Uint8Array(this.buffer, 0, this.length * INSTANCE_BYTES); }
  private ensure(required: number): void {
    if (required * INSTANCE_BYTES <= this.buffer.byteLength) return;
    let bytes = this.buffer.byteLength; while (bytes < required * INSTANCE_BYTES) bytes *= 2;
    const next = new ArrayBuffer(bytes); new Uint8Array(next).set(new Uint8Array(this.buffer, 0, this.length * INSTANCE_BYTES));
    this.buffer = next; this.view = new DataView(next);
  }
}

const TERRAIN_TYPES = Object.values(TerrainType);
const TERRAIN_INDEX = new Map<TerrainType, number>(TERRAIN_TYPES.map((type, index) => [type, index]));
const PROP_KEYS = ['', 'tree_oak', 'tree_pine', 'tree_palm', 'swamp_reed', 'arcane_crystal', 'corrupted_skull'];
const ROAD_COLORS = ['#000000', '#6d5436', '#8a847b', '#4a4a4e'];

function buildingAtlasKey(type: string, era: string, level: number, hpRatio: number): string {
  const damage = hpRatio <= .32 ? 'ruined' : hpRatio <= .68 ? 'damaged' : hpRatio <= .9 ? 'worn' : 'healthy';
  return `building:${type}:${era}:${Math.max(1, Math.min(3, Math.round(level)))}:${damage}`;
}

function stable01(x: number, y: number, salt: number): number {
  let value = Math.imul(x + salt * 17, 0x45d9f3b) ^ Math.imul(y - salt * 31, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b); return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}
function propCode(type: TerrainType, x: number, y: number): number {
  if (type === TerrainType.FOREST && stable01(x, y, 800) < 0.33) return 1;
  if ((type === TerrainType.TUNDRA || type === TerrainType.SNOW) && stable01(x, y, 801) > 0.68) return 2;
  if (type === TerrainType.SAVANNA) return 3; if (type === TerrainType.SWAMP) return 4;
  if (type === TerrainType.ARCANE) return 5; if (type === TerrainType.CORRUPTED) return 6; return 0;
}
function packTint(color: string, alpha: number = 1): number {
  const { r, g, b } = parseColor(color); const a = clamp(Math.round(alpha * 255), 0, 255);
  return ((r & 255) | ((g & 255) << 8) | ((b & 255) << 16) | ((a & 255) << 24)) >>> 0;
}
function temperatureColor(temperature: number): string {
  const n = clamp((temperature + 20) / 70, 0, 1);
  return n < .5 ? mixColor('#1d4ed8', '#a7f3d0', n * 2) : mixColor('#f8e7a2', '#dc2626', (n - .5) * 2);
}

/** A resident static slice. It owns no GPU resource; WebGPU mirrors each page. */
export class RenderChunk {
  public readonly terrainKinds: Uint8Array;
  public readonly propKinds: Uint8Array;
  public revision = 0;
  public initialized = false;
  public lastVisibleFrame = -1;
  public contentHash = 0;
  public terrainVersion = -1;
  public roadVersion = -1;
  public railVersion = -1;
  public overlayMode = '';
  public detailed = false;
  public showGrid = false;
  public readonly pageData = new Map<number, Uint8Array>();
  private readonly writers = new Map<number, PackedInstanceWriter>();
  constructor(public readonly chunkX: number, public readonly chunkY: number, public readonly minX: number, public readonly minY: number, public readonly width: number, public readonly height: number) {
    this.terrainKinds = new Uint8Array(width * height); this.propKinds = new Uint8Array(width * height);
  }
  public indexOf(x: number, y: number): number { return (y - this.minY) * this.width + x - this.minX; }
  public resetPages(): void { for (const writer of this.writers.values()) writer.reset(); }
  public writer(page: number): PackedInstanceWriter {
    let writer = this.writers.get(page); if (!writer) { writer = new PackedInstanceWriter(); this.writers.set(page, writer); } return writer;
  }
  public commit(): number { let count = 0; this.pageData.clear(); for (const [page, writer] of this.writers) { const data = writer.bytes(); if (data.byteLength) { this.pageData.set(page, data); count += writer.count; } } this.revision++; this.initialized = true; return count; }
}

/**
 * Static world data is built once per 32x32 chunk and kept as page-addressable
 * byte ranges. Camera movement only changes the visible chunk list; it never
 * repacks terrain, infrastructure, ownership, or borders.
 */
export class RenderSnapshotBuilder {
  private readonly dynamicWriters = new Map<number, PackedInstanceWriter>();
  private readonly chunks = new WeakMap<TileMap, Map<string, RenderChunk>>();
  private readonly visibleEntityScratch: Entity[] = [];
  private readonly visibleInfantMotherIds = new Set<string>();
  private readonly visibleBuildingScratch: IndexedBuilding[] = [];
  private readonly buildingIndexes = new WeakMap<Map<string, City>, BuildingIndexCache>();
  private staticRevision = 0; private frameNumber = 0; private benchmarkCount = -1;
  private benchmarkData: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  constructor(private readonly regions: ReadonlyMap<string, AtlasRegion>, private readonly requestedBenchmarkInstances: number = 0) {}

  public build(input: SnapshotBuildInput): RenderSnapshot {
    const started = performance.now(); this.frameNumber++;
    if (this.requestedBenchmarkInstances > 0) return this.buildBenchmark(input, started);
    const { camera, tileMap } = input;
    const a = camera.screenToWorld(0, 0, input.viewportWidth, input.viewportHeight);
    const b = camera.screenToWorld(input.viewportWidth, input.viewportHeight, input.viewportWidth, input.viewportHeight);
    const minX = Math.max(0, Math.floor(a.x) - 1), maxX = Math.min(tileMap.width - 1, Math.ceil(b.x) + 1);
    const minY = Math.max(0, Math.floor(a.y) - 1), maxY = Math.min(tileMap.height - 1, Math.ceil(b.y) + 1);
    const detailed = camera.tileSize * camera.zoom >= 5;
    const buildingCache = this.ensureBuildingIndex(input.cities, input.kingdoms);
    const map = this.chunkMap(tileMap), chunksY = Math.ceil(tileMap.height / RENDER_CHUNK_SIZE);
    // Small test maps and imported pre-V1B saves may not have the optional
    // dirty-set runtime field yet; first residency still initializes safely.
    const dirty = tileMap.dirtyChunks ?? new Set<number>();
    const visible: RenderChunkSnapshot[] = []; let updated = 0; let staticInstances = 0;
    const minCX = Math.floor(minX / RENDER_CHUNK_SIZE), maxCX = Math.floor(maxX / RENDER_CHUNK_SIZE);
    const minCY = Math.floor(minY / RENDER_CHUNK_SIZE), maxCY = Math.floor(maxY / RENDER_CHUNK_SIZE);
    for (let cy = minCY; cy <= maxCY; cy++) for (let cx = minCX; cx <= maxCX; cx++) {
      const chunk = this.getChunk(tileMap, map, cx, cy); chunk.lastVisibleFrame = this.frameNumber;
      const dirtyId = cx * chunksY + cy;
      const visualVariant = chunk.overlayMode !== input.overlayMode || chunk.detailed !== detailed || chunk.showGrid !== !!input.showGrid;
      const validate = chunk.terrainVersion !== tileMap.terrainVersion || chunk.roadVersion !== tileMap.roadNetworkVersion || chunk.railVersion !== tileMap.railNetworkVersion;
      const localDirty = dirty.has(dirtyId);
      const buildingDirty = buildingCache.dirtyChunks.has(`${cx}:${cy}`);
      if (!chunk.initialized || localDirty || buildingDirty || visualVariant || (validate && this.hashChunk(chunk, tileMap) !== chunk.contentHash)) { this.rebuildChunk(chunk, input, detailed); updated++; }
      chunk.terrainVersion = tileMap.terrainVersion; chunk.roadVersion = tileMap.roadNetworkVersion; chunk.railVersion = tileMap.railNetworkVersion; chunk.overlayMode = input.overlayMode; chunk.detailed = detailed; chunk.showGrid = !!input.showGrid;
      if (localDirty) dirty.delete(dirtyId);
      if (buildingDirty) buildingCache.dirtyChunks.delete(`${cx}:${cy}`);
      let instances = 0; for (const data of chunk.pageData.values()) instances += data.byteLength / INSTANCE_BYTES;
      staticInstances += instances;
      visible.push({ key: `${cx}:${cy}`, chunkX: cx, chunkY: cy, pageData: chunk.pageData, instances, revision: chunk.revision });
    }
    if (updated) this.staticRevision++;
    const dynamicPageData = this.rebuildDynamic(input, minX, maxX, minY, maxY, detailed);
    let dynamicInstances = 0; for (const data of dynamicPageData.values()) dynamicInstances += data.byteLength / INSTANCE_BYTES;
    return { camera: this.cameraSnapshot(input), dynamicPageData, staticInstances, dynamicInstances, staticRevision: this.staticRevision, renderPreparationMs: performance.now() - started, benchmarkInstances: 0, chunks: visible, residentChunks: map.size, updatedChunks: updated };
  }

  private rebuildChunk(chunk: RenderChunk, input: SnapshotBuildInput, detailed: boolean): void {
    chunk.resetPages(); const white = this.requiredRegion('solid:white');
    const push = (region: AtlasRegion, tint: number, layer: number, x: number, y: number, width = 1, height = 1): void => {
      chunk.writer(region.page ?? 0).push({ previousX: x, previousY: y, x, y, width, height, region, tint, layer });
    };
    const terrain = (type: TerrainType): AtlasRegion => this.requiredRegion(`terrain:${type}`);
    for (let y = chunk.minY; y < chunk.minY + chunk.height; y++) for (let x = chunk.minX; x < chunk.minX + chunk.width; x++) {
      const tile = input.tileMap.grid[x][y], i = chunk.indexOf(x, y), type = tile.type;
      chunk.terrainKinds[i] = TERRAIN_INDEX.get(type) ?? 0; chunk.propKinds[i] = propCode(type, x, y);
      let region = terrain(type), tint = 0xffffffff;
      if (input.overlayMode === 'temperature') { region = white; tint = packTint(temperatureColor(tile.temperature)); }
      else if (input.overlayMode === 'resources' && tile.resourceType) { region = white; tint = packTint(RESOURCE_COLORS[tile.resourceType] ?? '#fbbf24'); }
      push(region, tint, .96, x, y);
      if (detailed) { const prop = PROP_KEYS[chunk.propKinds[i]], propRegion = prop ? this.regions.get(`prop:${prop}`) : undefined; if (propRegion) push(propRegion, 0xffffffff, .66, x, y - (prop === 'tree_oak' || prop === 'tree_pine' ? .2 : 0), 1, prop === 'tree_oak' || prop === 'tree_pine' ? 1.2 : 1); }
      if (detailed && tile.resourceType) {
        const density = GOODS[tile.resourceType]?.tier === 'common' ? .12 : 1;
        const resource = density >= 1 || stable01(x, y, 917) < density ? this.regions.get(`resource:${tile.resourceType}`) : undefined;
        if (resource) push(resource, 0xffffffff, .655, x, y);
      }

      // Chunk-local territory mask and its exposed edges. This is deliberately
      // a mask-like set of inexpensive quads so incremental occupation changes
      // never require a world-sized territory texture.
      if (tile.kingdomId) {
        const kingdom = input.kingdoms?.get(tile.kingdomId); const color = kingdom?.color ?? '#94a3b8';
        push(white, packTint(color, .16), .88, x, y);
        const edge = .075;
        for (const [dx, dy, ox, oy, w, h] of [[-1, 0, 0, 0, edge, 1], [1, 0, 1-edge, 0, edge, 1], [0, -1, 0, 0, 1, edge], [0, 1, 0, 1-edge, 1, edge]] as const) {
          if (input.tileMap.getTile(x + dx, y + dy)?.kingdomId !== tile.kingdomId) push(white, packTint(color, .82), .80, x + ox, y + oy, w, h);
        }
      }
      const road = tile.roadLevelEffective;
      if (road > 0) {
        const primary = tile.roadTraffic >= 70;
        const cityStreetWidth = tile.cityId ? input.cities.get(tile.cityId)?.architecturalProfile?.urbanForm.streetWidth ?? 1 : 1;
        const width = ((road === 1 ? .22 : road === 2 ? .30 : .38) + (primary ? .08 : 0)) * Math.max(.78, Math.min(1.22, cityStreetWidth));
        const half = width / 2;
        const color = packTint(primary && road === 1 ? '#806443' : ROAD_COLORS[road]);
        push(white, packTint('#241b14', .55), .74, x + .5 - half - .035, y + .5 - half - .035, width + .07, width + .07);
        push(white, color, .73, x + .5 - half, y + .5 - half, width, width);
        if (input.tileMap.getTile(x - 1, y)?.roadLevelEffective) push(white, color, .73, x, y + .5 - half, .5, width);
        if (input.tileMap.getTile(x + 1, y)?.roadLevelEffective) push(white, color, .73, x + .5, y + .5 - half, .5, width);
        if (input.tileMap.getTile(x, y - 1)?.roadLevelEffective) push(white, color, .73, x + .5 - half, y, width, .5);
        if (input.tileMap.getTile(x, y + 1)?.roadLevelEffective) push(white, color, .73, x + .5 - half, y + .5, width, .5);
      }
      if (tile.railLevelEffective > 0) {
        const east = !!input.tileMap.getTile(x + 1, y)?.railLevelEffective, west = !!input.tileMap.getTile(x - 1, y)?.railLevelEffective;
        const north = !!input.tileMap.getTile(x, y - 1)?.railLevelEffective, south = !!input.tileMap.getTile(x, y + 1)?.railLevelEffective;
        if (east || west || (!north && !south)) { push(white, packTint('#3a3330'), .70, x, y + .31, 1, .38); push(white, packTint('#cbd5e1'), .69, x, y + .38, 1, .055); push(white, packTint('#cbd5e1'), .69, x, y + .565, 1, .055); }
        if (north || south) { push(white, packTint('#3a3330'), .70, x + .31, y, .38, 1); push(white, packTint('#cbd5e1'), .69, x + .38, y, .055, 1); push(white, packTint('#cbd5e1'), .69, x + .565, y, .055, 1); }
        if (tile.cityId) push(white, packTint('#78716c'), .67, x + .18, y + .18, .64, .18);
      }
      if (input.showGrid && detailed) {
        push(white, packTint('#ffffff', .075), .79, x, y, 1, .018);
        push(white, packTint('#ffffff', .075), .79, x, y, .018, 1);
      }
    }
    // Buildings are logically static; TileMap dirty marking causes the owning
    // chunk alone to refresh after construction/raze operations.
    if (detailed) {
      const buildings = this.ensureBuildingIndex(input.cities, input.kingdoms).index.queryRect(chunk.minX, chunk.minY, chunk.minX + chunk.width - .001, chunk.minY + chunk.height - .001, this.visibleBuildingScratch);
      for (const entry of buildings) {
        const { building, city } = entry; const kingdom = city.kingdomId ? input.kingdoms?.get(city.kingdomId) : undefined;
        const era = kingdom?.research?.currentEra() ?? 'stone'; const hpRatio = building.maxHp > 0 ? building.hp / building.maxHp : 1;
        const fallbackKey = buildingAtlasKey(building.type, era, building.level, hpRatio);
        const visual = resolveCityBuildingVisual(city, building, fallbackKey);
        const region = this.regions.get(visual.atlasKey) ?? this.regions.get(fallbackKey);
        if (!region) continue;
        const levelScale = 1 + (building.level >= 3 ? .08 : building.level === 2 ? .04 : 0)
          + ((kingdom?.capitalCityId === city.id && ['town_center', 'palace', 'keep'].includes(building.type)) ? .07 : 0);
        const identityScale = Math.max(.82, Math.min(1.32, visual.scale));
        const footprint = levelScale * identityScale * BUILDING_DRAW_SCALE;
        const width = visual.width * footprint, height = visual.height * footprint;
        const x = building.x + .5 - visual.anchorX * width;
        const y = building.y + 1 - visual.anchorY * height;
        push(region, packTint(visual.tint), this.yLayer(building.y, input.tileMap.height, .64, .12), x, y, width, height);
        for (const decoration of visual.decorations) {
          const decorationRegion = this.regions.get(decoration.atlasKey);
          if (!decorationRegion) continue;
          const groundX = building.x + .5 + decoration.offsetX;
          const groundY = building.y + 1 + decoration.offsetY;
          const propX = groundX - decoration.anchorX * decoration.width;
          const propY = groundY - decoration.anchorY * decoration.height;
          push(decorationRegion, 0xffffffff, this.yLayer(groundY, input.tileMap.height, .625, .12), propX, propY, decoration.width, decoration.height);
        }
      }
    }
    chunk.commit();
    chunk.contentHash = this.hashChunk(chunk, input.tileMap);
  }

  private rebuildDynamic(input: SnapshotBuildInput, minX: number, maxX: number, minY: number, maxY: number, detailed: boolean): ReadonlyMap<number, Uint8Array> {
    for (const writer of this.dynamicWriters.values()) writer.reset();
    const push = (region: AtlasRegion, tint: number, layer: number, x: number, y: number, width = 1, height = 1, px = x, py = y): void => this.dynamicWriterFor(region.page ?? 0).push({ previousX: px, previousY: py, x, y, width, height, region, tint, layer });
    if (detailed) {
      const visible = input.entityIndex ? input.entityIndex.queryRect(minX - 2, minY - 2, maxX + 2, maxY + 2, this.visibleEntityScratch) : input.entities;
      this.visibleInfantMotherIds.clear();
      for (const entity of visible) {
        if (entity.species === 'human' && entity.lifeStage === 'infant' && entity.motherId) this.visibleInfantMotherIds.add(entity.motherId);
      }
      for (const entity of visible) {
        if (entity.x < minX || entity.x > maxX || entity.y < minY || entity.y > maxY) continue;
        const direction = this.entityDirection(entity); const animation = this.entityAnimation(entity); const frame = this.entityFrame(entity, animation);
        const profile = resolveEntityVisualProfile(entity, this.visibleInfantMotherIds);
        const artAnimation = resolveEntitySheetAnimation(animation);
        const region = this.regions.get(entityArtAtlasKey(profile, direction, artAnimation, frame))
          ?? this.regions.get(`entity:${entity.species}:${direction}:${animation}:${frame}`);
        if (region) push(region, 0xffffffff, this.yLayer(entity.y, input.tileMap.height, .635, .12), entity.x-.05, entity.y-.1, 1.1, 1.1, entity.prevX-.05, entity.prevY-.1);
      }
      const fire = this.regions.get('prop:fx_fire'); if (fire) for (let x=minX; x<=maxX; x++) for (let y=minY; y<=maxY; y++) if (input.tileMap.grid[x][y].isOnFire) push(fire, 0xffffffff, .59, x, y-.3, 1, 1.3);
    }
    if (input.selection) { const mark=input.selection, region=this.requiredRegion('overlay:selection'), d=Math.max(.75, mark.radius*2); push(region, packTint(mark.color), .02, mark.x-mark.radius, mark.y-mark.radius, d, d); }
    const pages = new Map<number, Uint8Array>(); for (const [page, writer] of this.dynamicWriters) if (writer.count) pages.set(page, writer.bytes()); return pages;
  }

  private dynamicWriterFor(page: number): PackedInstanceWriter { let writer=this.dynamicWriters.get(page); if (!writer) { writer=new PackedInstanceWriter(); this.dynamicWriters.set(page, writer); } return writer; }
  /**
   * City headers provide a cheap topology generation. A full building walk is
   * performed only after construction/raze/load, then only affected chunks are
   * invalidated. Stable frames query the spatial hash directly.
   */
  private ensureBuildingIndex(cities: Map<string, City>, kingdoms?: Map<string, Kingdom>): BuildingIndexCache {
    let topologySignature = 2166136261;
    for (const city of cities.values()) {
      topologySignature = Math.imul(topologySignature ^ this.stringHash(city.id), 16777619);
      topologySignature = Math.imul(topologySignature ^ city.buildings.size, 16777619);
      topologySignature = Math.imul(topologySignature ^ (city.buildingVersion ?? 0), 16777619);
    }
    topologySignature >>>= 0;
    const eraSignature = kingdoms
      ? [...kingdoms.values()].map(kingdom => `${kingdom.id}:${kingdom.research?.currentEra() ?? 'stone'}`).sort().join('|')
      : '';
    let cache = this.buildingIndexes.get(cities);
    if (!cache) {
      cache = { index: new SpatialHash<IndexedBuilding>(RENDER_CHUNK_SIZE), entries: new Map(), dirtyChunks: new Set(), topologySignature: -1, eraSignature };
      this.buildingIndexes.set(cities, cache);
    }
    if (cache.topologySignature !== topologySignature) {
      const nextEntries = new Map<string, IndexedBuilding>();
      for (const city of cities.values()) for (const building of city.buildings.values()) {
        nextEntries.set(building.id, { id: building.id, x: building.x, y: building.y, city, building });
      }
      for (const [id, previous] of cache.entries) {
        const next = nextEntries.get(id);
        if (!next || next.x !== previous.x || next.y !== previous.y) cache.dirtyChunks.add(this.buildingChunkKey(previous.x, previous.y));
      }
      for (const [id, next] of nextEntries) {
        const previous = cache.entries.get(id);
        if (!previous || next.x !== previous.x || next.y !== previous.y) cache.dirtyChunks.add(this.buildingChunkKey(next.x, next.y));
      }
      cache.index.rebuild(nextEntries.values());
      cache.entries = nextEntries;
      cache.topologySignature = topologySignature;
    }
    if (cache.eraSignature !== eraSignature) {
      for (const entry of cache.entries.values()) cache.dirtyChunks.add(this.buildingChunkKey(entry.x, entry.y));
      cache.eraSignature = eraSignature;
    }
    return cache;
  }

  private buildingChunkKey(x: number, y: number): string { return `${Math.floor(x / RENDER_CHUNK_SIZE)}:${Math.floor(y / RENDER_CHUNK_SIZE)}`; }
  private yLayer(y: number, worldHeight: number, base: number, range: number): number { return base - clamp(y / Math.max(1, worldHeight), 0, 1) * range; }
  private entityDirection(entity: Entity): 'down' | 'up' | 'left' | 'right' {
    const dx=entity.x-entity.prevX, dy=entity.y-entity.prevY;
    if (Math.abs(dx)+Math.abs(dy) > .002) return Math.abs(dx)>=Math.abs(dy) ? dx>=0 ? 'right' : 'left' : dy>=0 ? 'down' : 'up';
    return entity.facing < 0 ? 'left' : 'right';
  }
  private entityAnimation(entity: Entity): string {
    if ((entity.aiState === 'attack' || entity.aiState === 'hunt') && entity.attackCooldown > 0) return entity.equipment.weapon?.category === 'ranged' ? 'shoot' : 'attack';
    if (entity.aiState === 'flee') return 'flee'; if (entity.aiState === 'heal') return 'heal';
    if (entity.aiState === 'gather_wood' || entity.aiState === 'gather_food' || entity.aiState === 'gather_ore' || entity.aiState === 'forage') return 'gather';
    if (entity.aiState === 'build' || entity.aiState === 'craft') return 'build';
    if (entity.aiState === 'deliver' || entity.aiState === 'return_city' || entity.carrying) return 'carry';
    if (entity.aiState === 'socialize' || entity.aiState === 'eat') return 'socialize';
    if (entity.aiState === 'idle' && entity.energy < 18) return 'rest';
    return Math.abs(entity.x-entity.prevX)+Math.abs(entity.y-entity.prevY) > .002 ? 'walk' : 'idle';
  }
  private entityFrame(entity: Entity, animation: string): number { return (animation === 'walk' || animation === 'carry' || animation === 'flee') ? Math.floor(entity.renderWalked / .225) % 4 : Math.floor(this.frameNumber / (animation === 'idle' ? 16 : 5) + this.stringHash(entity.id)) % 4; }
  /** Cheap validation path for legacy mutations that have not yet supplied a dirty chunk coordinate. */
  private hashChunk(chunk: RenderChunk, tileMap: TileMap): number {
    let hash = 2166136261;
    for (let y=chunk.minY; y<chunk.minY+chunk.height; y++) for (let x=chunk.minX; x<chunk.minX+chunk.width; x++) {
      const t=tileMap.grid[x][y];
      hash = Math.imul(hash ^ (TERRAIN_INDEX.get(t.type) ?? 0), 16777619);
      hash = Math.imul(hash ^ (t.roadLevelEffective | (Math.round(t.roadDamage * 31) << 3)), 16777619);
      hash = Math.imul(hash ^ (t.railLevelEffective | (Math.round(t.railDamage * 31) << 3)), 16777619);
      hash = Math.imul(hash ^ this.stringHash(t.kingdomId ?? ''), 16777619);
      if (t.resourceType) hash = Math.imul(hash ^ this.stringHash(t.resourceType), 16777619);
    }
    return hash >>> 0;
  }
  private stringHash(value: string): number { let hash=0; for (let i=0;i<value.length;i++) hash=Math.imul(hash ^ value.charCodeAt(i), 16777619); return hash; }
  private buildBenchmark(input: SnapshotBuildInput, started: number): RenderSnapshot {
    const count=this.requestedBenchmarkInstances, columns=Math.ceil(Math.sqrt(count)), rows=Math.ceil(count/columns), writer=new PackedInstanceWriter(), region=this.requiredRegion(`terrain:${TERRAIN_TYPES[0]}`);
    if (this.benchmarkCount !== count) { for (let i=0;i<count;i++) writer.push({ previousX:i%columns, previousY:Math.floor(i/columns), x:i%columns, y:Math.floor(i/columns), width:.9,height:.9,region,tint:0xffffffff,layer:.5 }); this.benchmarkData=writer.bytes().slice(); this.benchmarkCount=count; this.staticRevision++; }
    const page=new Map<number,Uint8Array>([[region.page ?? 0,this.benchmarkData]]); const zoom=Math.max(.001,Math.min(input.viewportWidth/(columns*input.camera.tileSize),input.viewportHeight/(rows*input.camera.tileSize))*.96);
    return { camera:{ viewportWidth:input.viewportWidth, viewportHeight:input.viewportHeight, relativeCameraX:columns*input.camera.tileSize*.5, relativeCameraY:rows*input.camera.tileSize*.5, worldOriginX:0,worldOriginY:0,shakeX:0,shakeY:0,tileSize:input.camera.tileSize,zoom,interpolationAlpha:1,devicePixelRatio:input.devicePixelRatio }, dynamicPageData:new Map(),staticInstances:count,dynamicInstances:0,staticRevision:this.staticRevision,renderPreparationMs:performance.now()-started,benchmarkInstances:count,chunks:[{key:'benchmark',chunkX:0,chunkY:0,pageData:page,instances:count,revision:this.staticRevision}],residentChunks:1,updatedChunks:0 };
  }
  private cameraSnapshot(input: SnapshotBuildInput): RenderCameraSnapshot { const ox=Math.floor(input.camera.x / input.camera.tileSize / RENDER_CHUNK_SIZE) * RENDER_CHUNK_SIZE, oy=Math.floor(input.camera.y / input.camera.tileSize / RENDER_CHUNK_SIZE) * RENDER_CHUNK_SIZE; return { viewportWidth:input.viewportWidth, viewportHeight:input.viewportHeight, relativeCameraX:input.camera.x-ox*input.camera.tileSize, relativeCameraY:input.camera.y-oy*input.camera.tileSize, worldOriginX:ox,worldOriginY:oy,shakeX:input.camera.frameShakeX,shakeY:input.camera.frameShakeY,tileSize:input.camera.tileSize,zoom:input.camera.zoom,interpolationAlpha:1,devicePixelRatio:input.devicePixelRatio }; }
  private chunkMap(tileMap: TileMap): Map<string, RenderChunk> { let map=this.chunks.get(tileMap); if (!map) { map=new Map(); this.chunks.set(tileMap,map); } return map; }
  private getChunk(tileMap: TileMap,map:Map<string,RenderChunk>,chunkX:number,chunkY:number): RenderChunk { const key=`${chunkX}:${chunkY}`; let chunk=map.get(key); if (!chunk) { const minX=chunkX*RENDER_CHUNK_SIZE,minY=chunkY*RENDER_CHUNK_SIZE; chunk=new RenderChunk(chunkX,chunkY,minX,minY,Math.min(RENDER_CHUNK_SIZE,tileMap.width-minX),Math.min(RENDER_CHUNK_SIZE,tileMap.height-minY)); map.set(key,chunk); } return chunk; }
  private requiredRegion(key:string):AtlasRegion { const region=this.regions.get(key); if (!region) throw new Error(`Missing atlas region: ${key}`); return region; }
}
