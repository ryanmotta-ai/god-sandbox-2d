import { TerrainType } from './Biomes';
import { GoodId } from '../civ/Goods';

/**
 * What a tile can be harvested for.
 *
 * A deposit *is* the good it yields — there is no separate translation layer, so
 * adding a material to the economy automatically makes it minable.
 */
export type TileResource = GoodId | null;

/** Maps a tile resource onto the good it yields when harvested. */
export function tileResourceToGood(resource: TileResource): GoodId | null {
  return resource;
}

export interface TileData {
  x: number;
  y: number;
  height: number;
  type: TerrainType;
  temperature: number;
  moisture: number;
  fertility: number;
  resourceType: TileResource;
  resourceAmount: number;
  /** What resourceAmount regrows back toward (renewables only). */
  resourceMax: number;
  buildingId: string | null;
  kingdomId: string | null;
  cityId: string | null;
  isOnFire: boolean;
  fireTimer: number;
  /** 0: None, 1: Dirt Trail, 2: Stone Road, 3: Paved Imperial Highway */
  roadLevel: number;
  /** Accumulated merchant and citizen traffic count. */
  roadTraffic: number;
  /** 0..1 — war damage on the road. Reduces the effective road level until repaired. */
  roadDamage: number;
  /** 0: none, 1: railway. Laid by rail construction and freight logistics. */
  railLevel: number;
  /** 0..1 — war damage on the rail. Heavy damage severs the line (like roads). */
  railDamage: number;
  /** Realm that laid the track. Null on abandoned rails. */
  railOwnerId: string | null;
}

export class Tile implements TileData {
  public x: number;
  public y: number;
  public height: number;
  public type: TerrainType;
  public temperature: number;
  public moisture: number;
  public fertility: number;
  public resourceType: TileResource;
  public resourceAmount: number;
  public resourceMax: number;
  public buildingId: string | null;
  public kingdomId: string | null;
  public cityId: string | null;
  public isOnFire: boolean;
  public fireTimer: number;
  public roadLevel: number = 0;
  public roadTraffic: number = 0;
  public roadDamage: number = 0;
  public railLevel: number = 0;
  public railDamage: number = 0;
  public railOwnerId: string | null = null;
  /** Renderer cache: static terrain surface color, validated against the fields that produce it. */
  public renderSurface: string | null = null;
  public renderSurfaceType: TerrainType = TerrainType.DEEP_OCEAN;
  public renderSurfaceHeight: number = 0;
  public renderSurfaceMoisture: number = 0;
  public renderSurfaceTemp: number = 0;

  constructor(x: number, y: number, type: TerrainType = TerrainType.DEEP_OCEAN, height: number = 0) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.height = height;
    this.temperature = 20;
    this.moisture = 0.5;
    this.fertility = 0.5;
    this.resourceType = null;
    this.resourceAmount = 0;
    this.resourceMax = 0;
    this.buildingId = null;
    this.kingdomId = null;
    this.cityId = null;
    this.isOnFire = false;
    this.fireTimer = 0;
  }

  /**
   * Road level after war damage is applied. A damaged road travels and renders
   * as one step rougher; heavy damage ruins it entirely.
   */
  public get roadLevelEffective(): number {
    return Math.max(0, Math.floor(this.roadLevel * (1 - this.roadDamage)));
  }

  /**
   * Railway level after war damage. A rail takes scratches without breaking;
   * only heavy damage (past 75%) severs the line entirely. Below that the
   * segment stays usable but drags down the line's capacity via `railHealth`.
   */
  public get railLevelEffective(): number {
    return this.railDamage >= 0.75 ? 0 : this.railLevel;
  }

  /** 0..1 — live condition of a rail segment, used for line capacity. */
  public get railHealth(): number {
    return Math.max(0, 1 - this.railDamage);
  }
}
