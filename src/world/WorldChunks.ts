import { GOODS, type GoodId } from '../civ/Goods';
import { TerrainType } from './Biomes';
import type { Tile, TileData, TileResource } from './Tile';

export const WORLD_CHUNK_SIZE = 32;
const CHUNK_AREA = WORLD_CHUNK_SIZE * WORLD_CHUNK_SIZE;
const TERRAIN_TYPES = Object.values(TerrainType);
const TERRAIN_TO_INDEX = new Map<TerrainType, number>(TERRAIN_TYPES.map((value, index) => [value, index]));
const RESOURCE_TYPES = Object.values(GOODS).map(good => good.id);
const RESOURCE_TO_INDEX = new Map<GoodId, number>(RESOURCE_TYPES.map((value, index) => [value, index + 1]));

export enum RegionState {
  ACTIVE = 'ACTIVE',
  WARM = 'WARM',
  SLEEPING = 'SLEEPING'
}

type SparseStringField = 'buildingId' | 'kingdomId' | 'cityId' | 'railOwnerId' | 'bridgeName';

export interface SerializedWorldChunk {
  cx: number;
  cy: number;
  terrain: string;
  height: string;
  temperature: string;
  moisture: string;
  fertility: string;
  resourceType: string;
  resourceAmount: string;
  resourceMax: string;
  fire: string;
  fireTimer: string;
  roadLevel: string;
  roadTraffic: string;
  roadDamage: string;
  railLevel: string;
  railDamage: string;
  sparse?: Partial<Record<SparseStringField, Array<[number, string]>>>;
}

function encodeBytes(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  }
  return btoa(binary);
}

function decodeInto(encoded: string | undefined, view: ArrayBufferView): void {
  if (!encoded) return;
  const binary = atob(encoded);
  const target = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const length = Math.min(binary.length, target.length);
  for (let i = 0; i < length; i++) target[i] = binary.charCodeAt(i);
}

function normalized16(value: number): number { return Math.max(0, Math.min(65535, Math.round(value * 65535))); }
function normalized8(value: number): number { return Math.max(0, Math.min(255, Math.round(value * 255))); }

/** Dense, serializable SoA storage for one logical 32x32 region. */
export class WorldChunk {
  public state = RegionState.SLEEPING;
  public terrainVersion = 1;
  public roadVersion = 1;
  public railVersion = 1;
  public readonly terrain = new Uint8Array(CHUNK_AREA);
  public readonly height = new Float32Array(CHUNK_AREA);
  public readonly temperature = new Int16Array(CHUNK_AREA);
  public readonly moisture = new Uint16Array(CHUNK_AREA);
  public readonly fertility = new Uint16Array(CHUNK_AREA);
  public readonly resourceType = new Uint8Array(CHUNK_AREA);
  public readonly resourceAmount = new Float32Array(CHUNK_AREA);
  public readonly resourceMax = new Float32Array(CHUNK_AREA);
  public readonly fire = new Uint8Array(CHUNK_AREA);
  public readonly fireTimer = new Uint16Array(CHUNK_AREA);
  public readonly roadLevel = new Uint8Array(CHUNK_AREA);
  public readonly roadTraffic = new Uint32Array(CHUNK_AREA);
  public readonly roadDamage = new Uint8Array(CHUNK_AREA);
  public readonly railLevel = new Uint8Array(CHUNK_AREA);
  public readonly railDamage = new Uint8Array(CHUNK_AREA);
  private readonly sparse: Record<SparseStringField, Map<number, string>> = {
    buildingId: new Map(), kingdomId: new Map(), cityId: new Map(), railOwnerId: new Map(), bridgeName: new Map()
  };
  private readonly activeViews = new Map<number, ChunkTileView>();
  private readonly renderSurface = new Map<number, string>();
  private readonly renderSurfaceType = new Uint8Array(CHUNK_AREA);
  private readonly renderSurfaceHeight = new Float32Array(CHUNK_AREA);
  private readonly renderSurfaceMoisture = new Float32Array(CHUNK_AREA);
  private readonly renderSurfaceTemp = new Float32Array(CHUNK_AREA);

  constructor(public readonly cx: number, public readonly cy: number) {
    this.temperature.fill(20);
    this.moisture.fill(normalized16(.5));
    this.fertility.fill(normalized16(.5));
  }

  public index(x: number, y: number): number { return (y & 31) * WORLD_CHUNK_SIZE + (x & 31); }

  public view(x: number, y: number): ChunkTileView {
    const index = this.index(x, y);
    if (this.state !== RegionState.ACTIVE) return new ChunkTileView(this, index, x, y);
    let view = this.activeViews.get(index);
    if (!view) { view = new ChunkTileView(this, index, x, y); this.activeViews.set(index, view); }
    return view;
  }

  public setState(state: RegionState): void {
    if (this.state === state) return;
    this.state = state;
    if (state !== RegionState.ACTIVE) this.activeViews.clear();
  }

  public sparseGet(field: SparseStringField, index: number): string | null { return this.sparse[field].get(index) ?? null; }
  public sparseSet(field: SparseStringField, index: number, value: string | null): void {
    if (value === null) this.sparse[field].delete(index); else this.sparse[field].set(index, value);
  }
  public renderGet(index: number): string | null { return this.renderSurface.get(index) ?? null; }
  public renderSet(index: number, value: string | null): void { if (value === null) this.renderSurface.delete(index); else this.renderSurface.set(index, value); }
  public renderMeta(index: number): [TerrainType, number, number, number] {
    return [TERRAIN_TYPES[this.renderSurfaceType[index]] ?? TerrainType.DEEP_OCEAN, this.renderSurfaceHeight[index], this.renderSurfaceMoisture[index], this.renderSurfaceTemp[index]];
  }
  public setRenderMeta(index: number, type: TerrainType, height: number, moisture: number, temperature: number): void {
    this.renderSurfaceType[index] = TERRAIN_TO_INDEX.get(type) ?? 0;
    this.renderSurfaceHeight[index] = height; this.renderSurfaceMoisture[index] = moisture; this.renderSurfaceTemp[index] = temperature;
  }

  public serialize(): SerializedWorldChunk {
    const sparse: SerializedWorldChunk['sparse'] = {};
    for (const field of Object.keys(this.sparse) as SparseStringField[]) {
      if (this.sparse[field].size) sparse[field] = [...this.sparse[field].entries()];
    }
    return {
      cx: this.cx, cy: this.cy,
      terrain: encodeBytes(this.terrain), height: encodeBytes(this.height), temperature: encodeBytes(this.temperature),
      moisture: encodeBytes(this.moisture), fertility: encodeBytes(this.fertility), resourceType: encodeBytes(this.resourceType),
      resourceAmount: encodeBytes(this.resourceAmount), resourceMax: encodeBytes(this.resourceMax), fire: encodeBytes(this.fire),
      fireTimer: encodeBytes(this.fireTimer), roadLevel: encodeBytes(this.roadLevel), roadTraffic: encodeBytes(this.roadTraffic),
      roadDamage: encodeBytes(this.roadDamage), railLevel: encodeBytes(this.railLevel), railDamage: encodeBytes(this.railDamage),
      ...(Object.keys(sparse).length ? { sparse } : {})
    };
  }

  public deserialize(data: SerializedWorldChunk): void {
    decodeInto(data.terrain, this.terrain); decodeInto(data.height, this.height); decodeInto(data.temperature, this.temperature);
    decodeInto(data.moisture, this.moisture); decodeInto(data.fertility, this.fertility); decodeInto(data.resourceType, this.resourceType);
    decodeInto(data.resourceAmount, this.resourceAmount); decodeInto(data.resourceMax, this.resourceMax); decodeInto(data.fire, this.fire);
    decodeInto(data.fireTimer, this.fireTimer); decodeInto(data.roadLevel, this.roadLevel); decodeInto(data.roadTraffic, this.roadTraffic);
    decodeInto(data.roadDamage, this.roadDamage); decodeInto(data.railLevel, this.railLevel); decodeInto(data.railDamage, this.railDamage);
    for (const field of Object.keys(this.sparse) as SparseStringField[]) {
      this.sparse[field].clear();
      for (const [index, value] of data.sparse?.[field] ?? []) this.sparse[field].set(index, value);
    }
  }

  public get approximateBytes(): number {
    const dense = this.terrain.byteLength + this.height.byteLength + this.temperature.byteLength + this.moisture.byteLength + this.fertility.byteLength +
      this.resourceType.byteLength + this.resourceAmount.byteLength + this.resourceMax.byteLength + this.fire.byteLength + this.fireTimer.byteLength +
      this.roadLevel.byteLength + this.roadTraffic.byteLength + this.roadDamage.byteLength + this.railLevel.byteLength + this.railDamage.byteLength;
    let sparse = 0; for (const field of Object.values(this.sparse)) for (const value of field.values()) sparse += 16 + value.length * 2;
    return dense + sparse;
  }
}

/** Mutable Tile-compatible facade over a compact chunk slot. */
export class ChunkTileView implements TileData {
  constructor(private readonly chunk: WorldChunk, private readonly index: number, public readonly x: number, public readonly y: number) {}
  public get type(): TerrainType { return TERRAIN_TYPES[this.chunk.terrain[this.index]] ?? TerrainType.DEEP_OCEAN; }
  public set type(value: TerrainType) { const next = TERRAIN_TO_INDEX.get(value) ?? 0; if (this.chunk.terrain[this.index] !== next) { this.chunk.terrain[this.index] = next; this.chunk.terrainVersion++; } }
  public get height(): number { return this.chunk.height[this.index]; } public set height(value: number) { if (this.chunk.height[this.index] !== value) { this.chunk.height[this.index] = value; this.chunk.terrainVersion++; } }
  public get temperature(): number { return this.chunk.temperature[this.index]; } public set temperature(value: number) { this.chunk.temperature[this.index] = Math.round(value); }
  public get moisture(): number { return this.chunk.moisture[this.index] / 65535; } public set moisture(value: number) { this.chunk.moisture[this.index] = normalized16(value); }
  public get fertility(): number { return this.chunk.fertility[this.index] / 65535; } public set fertility(value: number) { this.chunk.fertility[this.index] = normalized16(value); }
  public get resourceType(): TileResource { const value = this.chunk.resourceType[this.index]; return value === 0 ? null : RESOURCE_TYPES[value - 1] ?? null; }
  public set resourceType(value: TileResource) { this.chunk.resourceType[this.index] = value ? RESOURCE_TO_INDEX.get(value) ?? 0 : 0; }
  public get resourceAmount(): number { return this.chunk.resourceAmount[this.index]; } public set resourceAmount(value: number) { this.chunk.resourceAmount[this.index] = value; }
  public get resourceMax(): number { return this.chunk.resourceMax[this.index]; } public set resourceMax(value: number) { this.chunk.resourceMax[this.index] = value; }
  public get buildingId(): string | null { return this.chunk.sparseGet('buildingId', this.index); } public set buildingId(value: string | null) { this.chunk.sparseSet('buildingId', this.index, value); }
  public get kingdomId(): string | null { return this.chunk.sparseGet('kingdomId', this.index); } public set kingdomId(value: string | null) { this.chunk.sparseSet('kingdomId', this.index, value); }
  public get cityId(): string | null { return this.chunk.sparseGet('cityId', this.index); } public set cityId(value: string | null) { this.chunk.sparseSet('cityId', this.index, value); }
  public get isOnFire(): boolean { return this.chunk.fire[this.index] !== 0; } public set isOnFire(value: boolean) { this.chunk.fire[this.index] = value ? 1 : 0; }
  public get fireTimer(): number { return this.chunk.fireTimer[this.index]; } public set fireTimer(value: number) { this.chunk.fireTimer[this.index] = value; }
  public get roadLevel(): number { return this.chunk.roadLevel[this.index]; } public set roadLevel(value: number) { if (this.chunk.roadLevel[this.index] !== value) { this.chunk.roadLevel[this.index] = value; this.chunk.roadVersion++; } }
  public get roadTraffic(): number { return this.chunk.roadTraffic[this.index]; } public set roadTraffic(value: number) { this.chunk.roadTraffic[this.index] = value; }
  public get roadDamage(): number { return this.chunk.roadDamage[this.index] / 255; } public set roadDamage(value: number) { const next=normalized8(value); if(this.chunk.roadDamage[this.index]!==next){this.chunk.roadDamage[this.index]=next;this.chunk.roadVersion++;} }
  public get railLevel(): number { return this.chunk.railLevel[this.index]; } public set railLevel(value: number) { if(this.chunk.railLevel[this.index]!==value){this.chunk.railLevel[this.index]=value;this.chunk.railVersion++;} }
  public get railDamage(): number { return this.chunk.railDamage[this.index] / 255; } public set railDamage(value: number) { const next=normalized8(value); if(this.chunk.railDamage[this.index]!==next){this.chunk.railDamage[this.index]=next;this.chunk.railVersion++;} }
  public get railOwnerId(): string | null { return this.chunk.sparseGet('railOwnerId', this.index); } public set railOwnerId(value: string | null) { if(this.chunk.sparseGet('railOwnerId',this.index)!==value){this.chunk.sparseSet('railOwnerId',this.index,value);this.chunk.railVersion++;} }
  public get bridgeName(): string | null { return this.chunk.sparseGet('bridgeName', this.index); } public set bridgeName(value: string | null) { this.chunk.sparseSet('bridgeName', this.index, value); }
  public get roadLevelEffective(): number { return Math.max(0, Math.floor(this.roadLevel * (1 - this.roadDamage) + .01)); }
  public get railLevelEffective(): number { return this.chunk.railDamage[this.index] >= Math.round(.75 * 255) ? 0 : this.railLevel; }
  public get railHealth(): number { return Math.max(0, 1 - this.railDamage); }
  public get renderSurface(): string | null { return this.chunk.renderGet(this.index); } public set renderSurface(value: string | null) { this.chunk.renderSet(this.index, value); }
  public get renderSurfaceType(): TerrainType { return this.chunk.renderMeta(this.index)[0]; } public set renderSurfaceType(value: TerrainType) { const [,h,m,t] = this.chunk.renderMeta(this.index); this.chunk.setRenderMeta(this.index,value,h,m,t); }
  public get renderSurfaceHeight(): number { return this.chunk.renderMeta(this.index)[1]; } public set renderSurfaceHeight(value: number) { const [t,,m,temp] = this.chunk.renderMeta(this.index); this.chunk.setRenderMeta(this.index,t,value,m,temp); }
  public get renderSurfaceMoisture(): number { return this.chunk.renderMeta(this.index)[2]; } public set renderSurfaceMoisture(value: number) { const [t,h,,temp] = this.chunk.renderMeta(this.index); this.chunk.setRenderMeta(this.index,t,h,value,temp); }
  public get renderSurfaceTemp(): number { return this.chunk.renderMeta(this.index)[3]; } public set renderSurfaceTemp(value: number) { const [t,h,m] = this.chunk.renderMeta(this.index); this.chunk.setRenderMeta(this.index,t,h,m,value); }
}

/** Owns all world chunks and exposes the legacy grid shape without retaining a monolithic tile object graph. */
export class ChunkedTileStore {
  public readonly chunksX: number;
  public readonly chunksY: number;
  public readonly chunks: WorldChunk[];
  public readonly grid: Tile[][];

  constructor(public readonly width: number, public readonly height: number) {
    this.chunksX = Math.ceil(width / WORLD_CHUNK_SIZE);
    this.chunksY = Math.ceil(height / WORLD_CHUNK_SIZE);
    this.chunks = [];
    for (let cx = 0; cx < this.chunksX; cx++) for (let cy = 0; cy < this.chunksY; cy++) this.chunks[cx * this.chunksY + cy] = new WorldChunk(cx, cy);
    this.grid = Array.from({ length: width }, (_, x) => {
      const target = new Array<Tile>(height);
      return new Proxy(target, {
        get: (array, property, receiver) => {
          if (typeof property === 'string' && /^\d+$/.test(property)) return this.getTile(x, Number(property));
          return Reflect.get(array, property, receiver);
        },
        set: (array, property, value, receiver) => {
          if (typeof property === 'string' && /^\d+$/.test(property)) { this.copyTile(x, Number(property), value as TileData); return true; }
          return Reflect.set(array, property, value, receiver);
        }
      });
    });
  }

  public getChunk(cx: number, cy: number): WorldChunk | null {
    return cx < 0 || cy < 0 || cx >= this.chunksX || cy >= this.chunksY ? null : this.chunks[cx * this.chunksY + cy];
  }
  public getChunkAt(x: number, y: number): WorldChunk | null { return this.getChunk(Math.floor(x / WORLD_CHUNK_SIZE), Math.floor(y / WORLD_CHUNK_SIZE)); }
  public getTile(x: number, y: number): Tile {
    const chunk = this.getChunkAt(x, y);
    if (!chunk) throw new RangeError(`Tile outside world: ${x},${y}`);
    return chunk.view(x, y) as unknown as Tile;
  }

  public copyTile(x: number, y: number, source: TileData): void {
    const target = this.getTile(x, y) as unknown as ChunkTileView;
    target.type = source.type; target.height = source.height; target.temperature = source.temperature; target.moisture = source.moisture; target.fertility = source.fertility;
    target.resourceType = source.resourceType; target.resourceAmount = source.resourceAmount; target.resourceMax = source.resourceMax;
    target.buildingId = source.buildingId; target.kingdomId = source.kingdomId; target.cityId = source.cityId; target.isOnFire = source.isOnFire; target.fireTimer = source.fireTimer;
    target.roadLevel = source.roadLevel; target.roadTraffic = source.roadTraffic; target.roadDamage = source.roadDamage;
    target.railLevel = source.railLevel; target.railDamage = source.railDamage; target.railOwnerId = source.railOwnerId; target.bridgeName = source.bridgeName;
  }

  public updateRegionStates(centerX: number, centerY: number, activeRadius = 1, warmRadius = 3): { active: number; warm: number; sleeping: number } {
    const centerCX = Math.floor(centerX / WORLD_CHUNK_SIZE), centerCY = Math.floor(centerY / WORLD_CHUNK_SIZE);
    let active = 0, warm = 0, sleeping = 0;
    for (const chunk of this.chunks) {
      const distance = Math.max(Math.abs(chunk.cx - centerCX), Math.abs(chunk.cy - centerCY));
      const state = distance <= activeRadius ? RegionState.ACTIVE : distance <= warmRadius ? RegionState.WARM : RegionState.SLEEPING;
      chunk.setState(state);
      if (state === RegionState.ACTIVE) active++; else if (state === RegionState.WARM) warm++; else sleeping++;
    }
    return { active, warm, sleeping };
  }

  public get approximateBytes(): number { return this.chunks.reduce((sum, chunk) => sum + chunk.approximateBytes, 0); }
  public serialize(): SerializedWorldChunk[] { return this.chunks.map(chunk => chunk.serialize()); }
  public deserialize(chunks: SerializedWorldChunk[]): void { for (const data of chunks) this.getChunk(data.cx, data.cy)?.deserialize(data); }
}
