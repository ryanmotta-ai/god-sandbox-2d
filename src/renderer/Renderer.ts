import { Camera } from './Camera';
import { TileMap } from '../world/TileMap';
import { TerrainType } from '../world/Biomes';
import { roadSurfaceFamily } from '../world/RoadTerrain';
import type { Tile } from '../world/Tile';
import { Entity } from '../entities/Entity';
import { SpeciesType, SPECIES_DEFINITIONS } from '../entities/Species';
import { Kingdom } from '../civ/Kingdom';
import { City } from '../civ/City';
import { ParticleManager } from './Particles';
import { OverlayMode, type OverlayManager, type WarOverlayFocus } from './Overlays';
import type { MapIntelligenceSnapshot, MapCityDatum } from '../ui/map/MapIntelligence';
import { WorldEra } from '../world/WeatherEras';
import { SpriteGenerator, type EntitySpriteAnimation, type SpriteDirection } from './SpriteGenerator';
import { SpriteRegistry } from './SpriteRegistry';
import { PixelIcons } from './PixelIcons';
import { DiplomacyManager } from '../civ/Diplomacy';
import { Ship, SHIP_TIERS } from '../civ/NavalSystem';
import { OverlandCaravan } from '../civ/CaravanSystem';
import { GOODS, type GoodTier } from '../civ/Goods';
import {
  BRIDGE_HALF_WIDTH, BRIDGE_SLICE_PX, bridgeModelFor, bridgeSprite, needsCable, throwsShadow
} from './BridgeSprites';
import { PROP_SCALE, propAspect, roadProp, type RoadProp } from './RoadSprites';
import { CARAVAN_FRAMES, CARAVAN_PX, STRIDE_TILES, caravanSprite, type CaravanView } from './CaravanSprites';
import type { SpatialHash } from '../core/SpatialHash';
import { perfProfiler } from '../perf/PerformanceProfiler';
import { BUILDING_DRAW_SCALE } from './CityVisualResolver';

/**
 * What per-frame work a water tile actually needs, one byte per tile.
 *
 * Two independent questions, both answerable from the tile's position and its
 * neighbours' types and therefore both static:
 *
 *  - `WATER_EDGED`: does this tile have a neighbour of a different type? Only
 *    then does the edge pass paint anything — the shallow/deep rim, the coastal
 *    underlay, the foam crest.
 *  - `WATER_ANIMATES`: can its surface ever show movement? The wave crest is
 *    gated on `h(220)` and the specular glint on `hash2(x, y, 97)`, neither of
 *    which involves the clock, so for open ocean this is knowable in advance —
 *    and false for well over half of it.
 *
 * A tile with neither bit is already drawn completely in the bake underneath and
 * is skipped outright. That is the whole optimisation: before, every visible
 * water tile on the map was set up, noise-sampled, neighbour-scanned and
 * edge-painted every single frame, and most of them had nothing to draw.
 */
/**
 * Frames between refreshes of the animated terrain layer.
 *
 * The water animation is slow by construction: `animTimer` advances 0.04 per
 * frame and the fastest term in the surface (`animTimer * 2.2`, the specular
 * glint) turns over in about 70 frames. Redrawing the layer every fourth frame
 * gives roughly 18 samples per glint cycle and far more for the waves and the
 * foam — continuous to the eye, at a quarter of the cost.
 */
const ANIM_REFRESH_FRAMES = 4;

/**
 * Largest world the animated layer is baked for.
 *
 * The layer mirrors the terrain bake's geometry, so it also mirrors its memory:
 * width x height x 16px x 4 bytes. At 256 squared that is 67 MB on top of the
 * terrain bake's own, which is a fair trade for taking the sea off the per-frame
 * path. At 512 squared it would be 268 MB, so that size keeps drawing directly —
 * and at the zoom a 512 map is actually played at, the animated detail is
 * sub-pixel anyway.
 */
const ANIM_BAKE_MAX_TILES = 256 * 256;

/**
 * Zoom ceiling for using the layer, as a multiple of the bake resolution.
 *
 * Past this the blit would upscale the layer noticeably, and there is no reason
 * to: at high zoom only a few hundred tiles are on screen, so drawing them
 * directly is both cheap and sharper.
 */
const ANIM_MAX_ZOOM_FACTOR = 1.5;

const WATER_EDGED = 1;
const WATER_ANIMATES = 2;

/** Deposit tiers so plentiful that drawing every one clutters the whole map. */
const COMMON_NODE_TIERS = new Set<GoodTier>(['common']);
import {
  RESOURCE_COLORS,
  TERRAIN_VISUALS,
  clamp,
  mixColor,
  parseColor,
  hash2,
  terrainAccentColor,
  terrainSurfaceColor,
  valueNoise2D,
  withAlpha
} from './TerrainPalette';

/** Player-controlled visual toggles, driven by the Settings screen. */
export interface RenderOptions {
  showGrid: boolean;
  showCityNames: boolean;
  showKingdomBadges: boolean;
  showHealthBars: boolean;
  showParticles: boolean;
  showBrushCursor: boolean;
}

/**
 * The map-side half of selection: where the ring goes and what it says.
 *
 * Deliberately dumb — a position, a size, a colour and a caption. The renderer
 * does not know what a city is; the HUD resolves the selection and hands over
 * only what has to be drawn.
 */
export interface SelectionMark {
  /** World tile coordinates of the centre. */
  x: number;
  y: number;
  /** Ring radius in tiles. */
  radius: number;
  /** Realm colour when the thing belongs to a realm; bronze otherwise. */
  color: string;
  /** Short caption drawn under the ring. Omit for no label. */
  label?: string;
}

const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  showGrid: false,
  showCityNames: true,
  showKingdomBadges: true,
  showHealthBars: true,
  showParticles: true,
  showBrushCursor: true
};

/**
 * Fast position-based hash for the renderer. hash2() computes
 * frac(sin(x*127.1 + y*311.7 + salt*74.7) * 43758.5453123). Using the identity
 * sin(A + B) = sin(A)*cos(B) + cos(A)*sin(B), per-tile we compute sin(A)/cos(A)
 * once and look up cos(salt*74.7)/sin(salt*74.7) from these tables. The result
 * is numerically ~1e-6 of Math.sin at worst — invisible in per-pixel noise.
 */
const MAX_SALT = 1024;
const COS_SALT_TABLE = new Float64Array(MAX_SALT);
const SIN_SALT_TABLE = new Float64Array(MAX_SALT);
for (let s = 0; s < MAX_SALT; s++) {
  const b = s * 74.7;
  COS_SALT_TABLE[s] = Math.cos(b);
  SIN_SALT_TABLE[s] = Math.sin(b);
}
const HASH_SCALE = 43758.5453123;

/** One tile of road, as the road pass sees it after building the network graph. */
interface RoadNode {
  x: number; y: number;
  tile: Tile;
  level: number;
  key: string;
  width: number;
  /** Connected directions, as indices into ROAD_DIRS. */
  links: number[];
  /** Unit vector along the road through this tile. */
  ax: number; ay: number;
  /** True only for a through-run: two links, exactly opposite. */
  straight: boolean;
  water: boolean;
}

/** Clockwise from east; diagonals sit at odd indices between their cardinals. */
const ROAD_DIRS: readonly [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]
];

export class PixelRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animTimer: number = 0;
  private diplomacy: DiplomacyManager | null = null;
  public options: RenderOptions = { ...DEFAULT_RENDER_OPTIONS };

  public toggleGrid(): boolean {
    this.options.showGrid = !this.options.showGrid;
    return this.options.showGrid;
  }
  /** Current selection ring, or null when nothing is selected. */
  private selection: SelectionMark | null = null;
  /** Last ambient FX emission per building; avoids particle spam at high FPS. */
  private buildingFxTime: Map<string, number> = new Map();
  /** sin/cos of (x*127.1 + y*311.7) for the tile currently being drawn. */
  private hSin: number = 0;
  private hCos: number = 0;
  /** Offscreen canvas baking the static terrain layer (base+texture+relief+edges+details per tile, 16px). Animated surfaces (water/lava) are left transparent and drawn per-frame. */
  private terrainCanvas: HTMLCanvasElement | null = null;
  private terrainCtx: CanvasRenderingContext2D | null = null;
  private terrainW: number = 0;
  private terrainH: number = 0;
  /**
   * Which edges of each water tile carry coastal foam, one byte per tile.
   *
   * Bits 0-3 are left/right/top/bottom; bit 4 marks shallow water, which foams
   * brighter and wider than open ocean. Static — it is a function of a tile's
   * type and its four neighbours' — so it is computed once when the tile is
   * baked and read every frame after.
   *
   * Without it the per-frame foam pass had to rediscover the coastline from
   * scratch on every visible water tile: four `getTile` lookups and four
   * `isWater` tests each, over three thousand tiles a frame at 1080p, to find
   * that roughly one in six of them actually touches land. Five sixths of that
   * work produced nothing at all.
   */
  private waterMask: Uint8Array | null = null;
  /**
   * Offscreen layer holding the animated water and lava surfaces.
   *
   * Same geometry as the terrain bake, so the blit maths is identical and panning
   * costs nothing — the camera just reads a different region. What it buys is the
   * per-frame path: composing the sea used to mean five thousand `fillRect` calls
   * and twenty-seven hundred `fillStyle` changes every frame, and it is now two
   * `drawImage` calls, with the drawing itself amortised over ANIM_REFRESH_FRAMES.
   */
  private animCanvas: HTMLCanvasElement | null = null;
  private animCtx: CanvasRenderingContext2D | null = null;
  private animW: number = 0;
  private animH: number = 0;
  /** Frame counter driving the refresh cadence. */
  private animFrame: number = 0;
  /** Terrain revision the layer was drawn against, so terraforming invalidates it. */
  private animTerrainVersion: number = -1;
  /** Tile range currently drawn into the layer. */
  private animMinX: number = 0;
  private animMinY: number = 0;
  private animMaxX: number = -1;
  private animMaxY: number = -1;
  private readonly bakeTileSize: number = 16;
  private readonly visibleEntityScratch: Entity[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  public setDiplomacy(diplomacy: DiplomacyManager): void {
    this.diplomacy = diplomacy;
  }

  public setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * What the player currently has selected, so the map can mark it.
   *
   * Set through its own method rather than added to `render`'s already long
   * parameter list — same reasoning as `setDiplomacy`. Pass null to clear.
   */
  public setSelection(selection: SelectionMark | null): void {
    this.selection = selection;
  }

  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Parse hex color to RGB */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    return parseColor(hex);
  }

  private getEntityDirection(e: Entity, moving: boolean): SpriteDirection {
    const movedX = e.x - e.prevX;
    const movedY = e.y - e.prevY;

    if (moving && Math.abs(movedX) + Math.abs(movedY) > 0.002) {
      if (Math.abs(movedX) >= Math.abs(movedY)) return movedX >= 0 ? 'right' : 'left';
      return movedY >= 0 ? 'down' : 'up';
    }

    if ((e.aiState === 'attack' || e.aiState === 'hunt' || e.aiState === 'flee') && e.targetX !== null && e.targetY !== null) {
      const targetDx = e.targetX - e.x;
      const targetDy = e.targetY - e.y;
      if (Math.abs(targetDx) >= Math.abs(targetDy)) return targetDx >= 0 ? 'right' : 'left';
      return targetDy >= 0 ? 'down' : 'up';
    }

    return e.facing < 0 ? 'left' : 'right';
  }

  private getEntityAnimation(e: Entity, moving: boolean): EntitySpriteAnimation {
    if ((e.aiState === 'attack' || e.aiState === 'hunt') && e.attackCooldown > 0) {
      return e.equipment.weapon?.category === 'ranged' ? 'shoot' : 'attack';
    }
    if (e.aiState === 'flee') return 'flee';
    if (e.aiState === 'heal') return 'heal';

    // Slow simulation states now have their own readable animation instead of
    // being rendered as generic walking/idle characters.
    if (e.aiState === 'gather_wood' || e.aiState === 'gather_food' || e.aiState === 'gather_ore' || (e.aiState === 'forage' && SPECIES_DEFINITIONS[e.species].isHumanoid)) return 'gather';
    if (e.aiState === 'build' || e.aiState === 'craft') return 'build';
    // A citizen physically hauling a load reads as carrying, not as walking.
    if (e.aiState === 'deliver' || e.aiState === 'return_city' || e.carrying) return 'carry';
    if (e.aiState === 'eat') return 'socialize';
    if (e.aiState === 'socialize') return 'socialize';
    if (e.aiState === 'idle' && e.energy < 18) return 'rest';
    if (moving) return 'walk';
    return 'idle';
  }

  /**
   * How far a citizen walks per complete four-frame stride, in tiles. Roughly
   * one tile per cycle keeps a footfall on the ground rather than skating over
   * it, whatever the road bonus and the terrain cost are doing to their speed.
   */
  private static readonly STRIDE_TILES = 0.9;

  /**
   * The frame to draw.
   *
   * Anything driven by the body — walking, fleeing, hauling a load — is
   * clocked off the ground covered, not off wall time. Running the legs at a
   * fixed cadence while the body moved at whatever speed the road allowed is
   * what made citizens look like they were gliding: the faster they went, the
   * less their feet had to do with it. Work that happens on the spot keeps a
   * wall-clock rate, because there is no ground going past to key it to.
   */
  private getAnimationFrame(e: Entity, animation: EntitySpriteAnimation, idHash: number): number {
    if (animation === 'walk' || animation === 'carry' || animation === 'flee') {
      const stride = PixelRenderer.STRIDE_TILES * (animation === 'flee' ? 0.72 : 1);
      return Math.floor(e.renderWalked / (stride / 4) + idHash) % 4;
    }
    const rate = animation === 'attack' || animation === 'shoot' ? 11
      : animation === 'gather' || animation === 'build' ? 6
      : animation === 'heal' || animation === 'socialize' ? 4
      : animation === 'rest' ? 1.5
      : 2;
    return Math.floor(this.animTimer * rate + idHash) % 4;
  }

  private getDirectionVector(direction: SpriteDirection): { x: number; y: number } {
    switch (direction) {
      case 'left': return { x: -1, y: 0 };
      case 'right': return { x: 1, y: 0 };
      case 'up': return { x: 0, y: -1 };
      case 'down':
      default:
        return { x: 0, y: 1 };
    }
  }

  private getSpeciesFxColor(e: Entity): string {
    switch (e.species) {
      case SpeciesType.HUMAN: return '#e2e8f0';
      case SpeciesType.DRAGON: return '#f97316';
      case SpeciesType.WOLF: return '#e2e8f0';
      case SpeciesType.BEAR: return '#d97706';
      case SpeciesType.DEER:
      default:
        return '#fde68a';
    }
  }



  private buildingCategory(type: string): 'civic' | 'residential' | 'market' | 'industrial' | 'military' | 'faith' | 'utility' | 'rural' {
    if (['town_center', 'palace', 'academy', 'great_library', 'bank', 'stock_exchange', 'monument', 'colosseum'].includes(type)) return 'civic';
    if (['house', 'manor', 'apartment'].includes(type)) return 'residential';
    if (['market', 'harbor', 'port', 'caravanserai'].includes(type)) return 'market';
    if (['factory', 'refinery', 'oil_well', 'workshop', 'smithy', 'mine', 'quarry', 'lumberyard'].includes(type)) return 'industrial';
    if (['barracks', 'keep', 'wall'].includes(type)) return 'military';
    if (['temple', 'hospital'].includes(type)) return 'faith';
    if (['granary', 'warehouse', 'aqueduct', 'grand_aqueduct', 'well', 'bridge'].includes(type)) return 'utility';
    return 'rural';
  }

  private cityTierScore(city: City): number {
    return ({
      camp: 0, hamlet: 1, village: 2, town: 3, city: 4, metropolis: 5
    } as Record<string, number>)[city.tier] ?? 0;
  }

  private getCityAnchor(city: City): { x: number; y: number } {
    const civic = Array.from(city.buildings.values()).find(b => b.type === 'town_center')
      ?? Array.from(city.buildings.values()).find(b => b.type === 'palace')
      ?? Array.from(city.buildings.values()).find(b => b.type === 'keep');
    return civic ? { x: civic.x, y: civic.y } : { x: city.x, y: city.y };
  }

  private drawCityUrbanPattern(
    city: City,
    k: Kingdom | null,
    camera: Camera,
    width: number,
    height: number,
    tileSize: number
  ): void {
    if (tileSize < 8 || city.buildings.size === 0) return;

    const anchor = this.getCityAnchor(city);
    const center = camera.worldToScreen(anchor.x, anchor.y, width, height);
    const score = this.cityTierScore(city);
    const style = SPECIES_DEFINITIONS[city.species].urbanGridStyle ?? 'concentric_rings';
    const pathColor = city.prosperity >= 0.66 ? 'rgba(203, 186, 129, 0.22)'
      : city.prosperity <= 0.35 ? 'rgba(99, 74, 45, 0.18)'
      : 'rgba(154, 132, 92, 0.18)';
    const plazaColor = k ? `${k.color}22` : 'rgba(255,255,255,0.06)';
    const radius = tileSize * (1.2 + score * 0.55 + Math.min(1.4, city.buildings.size * 0.035));

    // Urban core / district tint.
    this.ctx.save();
    this.ctx.fillStyle = plazaColor;
    this.ctx.beginPath();
    this.ctx.ellipse(center.x + tileSize * 0.5, center.y + tileSize * 0.55, radius * 1.05, radius * 0.72, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Species-specific street grammar.
    this.ctx.strokeStyle = pathColor;
    this.ctx.lineWidth = Math.max(1, tileSize * 0.08);
    if (style === 'concentric_rings') {
      for (let r = 1; r <= Math.min(3, score); r++) {
        this.ctx.beginPath();
        this.ctx.ellipse(center.x + tileSize * 0.5, center.y + tileSize * 0.55, radius * (0.32 * r), radius * (0.22 * r), 0, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    } else if (style === 'organic_canopy') {
      this.ctx.beginPath();
      this.ctx.moveTo(center.x - radius * 0.55, center.y + radius * 0.1);
      this.ctx.quadraticCurveTo(center.x - radius * 0.1, center.y - radius * 0.65, center.x + radius * 0.5, center.y - radius * 0.1);
      this.ctx.quadraticCurveTo(center.x + radius * 0.75, center.y + radius * 0.15, center.x + radius * 0.2, center.y + radius * 0.5);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(center.x - radius * 0.4, center.y + radius * 0.35);
      this.ctx.quadraticCurveTo(center.x + radius * 0.05, center.y, center.x + radius * 0.65, center.y + radius * 0.25);
      this.ctx.stroke();
    } else if (style === 'orthogonal_citadel') {
      for (let i = -1; i <= 1; i++) {
        this.ctx.strokeRect(center.x - radius * 0.5 + i * tileSize * 1.1, center.y - radius * 0.32 + i * tileSize * 0.35, radius, radius * 0.48);
      }
    } else if (style === 'diagonal_chevron') {
      for (let i = -1; i <= 1; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(center.x - radius * 0.75, center.y + i * tileSize * 0.9);
        this.ctx.lineTo(center.x, center.y - radius * 0.36 + i * tileSize * 0.9);
        this.ctx.lineTo(center.x + radius * 0.75, center.y + i * tileSize * 0.9);
        this.ctx.stroke();
      }
    }

    // Connect up to a handful of visible buildings to the core.
    const visibleBuildings = Array.from(city.buildings.values()).slice(0, 10);
    for (const b of visibleBuildings) {
      const pos = camera.worldToScreen(b.x, b.y, width, height);
      this.ctx.beginPath();
      this.ctx.moveTo(center.x + tileSize * 0.5, center.y + tileSize * 0.6);
      if (style === 'organic_canopy') {
        this.ctx.quadraticCurveTo(
          (center.x + pos.x) * 0.5 + Math.sin(b.x * 0.9 + b.y * 1.1) * tileSize * 0.8,
          (center.y + pos.y) * 0.5 - tileSize * 0.5,
          pos.x + tileSize * 0.5, pos.y + tileSize * 0.75
        );
      } else if (style === 'orthogonal_citadel') {
        this.ctx.lineTo(pos.x + tileSize * 0.5, center.y + tileSize * 0.6);
        this.ctx.lineTo(pos.x + tileSize * 0.5, pos.y + tileSize * 0.75);
      } else if (style === 'diagonal_chevron') {
        const midX = (center.x + pos.x) * 0.5;
        const midY = (center.y + pos.y) * 0.5 - tileSize * 0.25;
        this.ctx.lineTo(midX, midY);
        this.ctx.lineTo(pos.x + tileSize * 0.5, pos.y + tileSize * 0.75);
      } else {
        this.ctx.lineTo(pos.x + tileSize * 0.5, pos.y + tileSize * 0.75);
      }
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawBuildingLotBackdrop(
    city: City,
    b: { type: string; x: number; y: number },
    k: Kingdom | null,
    screenPos: { x: number; y: number },
    tileSize: number
  ): void {
    if (tileSize < 7) return;
    const category = this.buildingCategory(b.type);
    const prosperity = city.prosperity ?? 0.5;
    const lotY = screenPos.y + tileSize * 0.66;
    let base = prosperity > 0.7 ? 'rgba(175, 156, 117, 0.24)' : 'rgba(122, 98, 64, 0.16)';
    if (category === 'industrial') base = 'rgba(82, 78, 74, 0.24)';
    if (category === 'market') base = 'rgba(201, 164, 88, 0.18)';
    if (category === 'military') base = 'rgba(92, 88, 102, 0.2)';
    if (category === 'faith') base = 'rgba(116, 153, 198, 0.14)';
    if (category === 'residential') base = prosperity > 0.7 ? 'rgba(88, 148, 103, 0.14)' : 'rgba(88, 107, 78, 0.1)';
    if (category === 'utility') base = 'rgba(119, 123, 134, 0.16)';

    this.ctx.fillStyle = base;
    const lotW = category === 'industrial' || category === 'civic' ? tileSize * 1.15 : tileSize * 0.94;
    const offset = (tileSize - lotW) * 0.5;
    this.ctx.fillRect(screenPos.x + offset, lotY, lotW, Math.max(2, tileSize * 0.22));

    // A couple of tiny lot props so whole districts read differently.
    if (category === 'market') {
      this.ctx.fillStyle = '#d6b15f';
      this.ctx.fillRect(screenPos.x + tileSize * 0.12, lotY - 1, 2, 2);
      this.ctx.fillRect(screenPos.x + tileSize * 0.72, lotY - 1, 2, 2);
    } else if (category === 'industrial') {
      this.ctx.fillStyle = '#475569';
      this.ctx.fillRect(screenPos.x + tileSize * 0.12, lotY - 1, 2, 2);
      this.ctx.fillRect(screenPos.x + tileSize * 0.72, lotY - 1, 2, 2);
    } else if (category === 'residential' && prosperity > 0.55) {
      this.ctx.fillStyle = '#16a34a';
      this.ctx.fillRect(screenPos.x + tileSize * 0.1, lotY + 1, 1, 1);
      this.ctx.fillRect(screenPos.x + tileSize * 0.84, lotY + 1, 1, 1);
    } else if (category === 'civic' && k) {
      this.ctx.fillStyle = k.secondaryColor;
      this.ctx.fillRect(screenPos.x + tileSize * 0.47, lotY - 1, 2, 2);
    }
  }



  private isLandmark(type: string): boolean {
    return SpriteGenerator.isLandmarkBuilding(type);
  }

  private drawCityMacroPresence(
    city: City,
    k: Kingdom | null,
    camera: Camera,
    width: number,
    height: number,
    tileSize: number
  ): void {
    if (city.buildings.size === 0 || tileSize < 3) return;
    const anchor = this.getCityAnchor(city);
    const center = camera.worldToScreen(anchor.x, anchor.y, width, height);
    const score = this.cityTierScore(city);
    const economicPerCapita = city.economicOutput / Math.max(1, city.population);
    const activity = Math.max(0, Math.min(1, economicPerCapita / 6));
    const isCapital = !!k && k.capitalCityId === city.id;

    // At zoomed-out scales, preserve a readable city silhouette instead of a pile of pixels.
    if (tileSize <= 9 && score >= 2) {
      const baseW = tileSize * (1.3 + score * 0.32);
      const baseH = Math.max(3, tileSize * (0.35 + score * 0.05));
      this.ctx.fillStyle = k ? `${k.color}55` : 'rgba(148,163,184,0.32)';
      this.ctx.fillRect(center.x - baseW * 0.5 + tileSize * 0.5, center.y + tileSize * 0.58, baseW, baseH);

      const bars = Math.min(5, 2 + Math.floor(score / 1.3));
      for (let i = 0; i < bars; i++) {
        const h = tileSize * (0.25 + score * 0.09 + ((i * 7 + city.population) % 3) * 0.08);
        const w = Math.max(2, tileSize * 0.26);
        const x = center.x + tileSize * 0.5 - (bars * w * 0.55) + i * w * 1.1;
        this.ctx.fillStyle = isCapital && i === Math.floor(bars / 2)
          ? (k?.secondaryColor ?? '#fbbf24')
          : 'rgba(30,41,59,0.72)';
        this.ctx.fillRect(x, center.y + tileSize * 0.58 - h, w, h);
      }
    }

    // Economic activity is a soft ambient pulse, not a fake trade route.
    if (activity > 0.15 && tileSize >= 5) {
      const pulse = 0.72 + Math.sin(this.animTimer * 1.8 + city.x * 0.31) * 0.18;
      const radius = tileSize * (0.65 + score * 0.22 + activity * 0.55);
      this.ctx.strokeStyle = `rgba(245, 158, 11, ${0.08 + activity * 0.12 * pulse})`;
      this.ctx.lineWidth = Math.max(1, tileSize * 0.05);
      this.ctx.beginPath();
      this.ctx.ellipse(center.x + tileSize * 0.5, center.y + tileSize * 0.55, radius, radius * 0.58, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Capital halo stays subtle but makes the realm seat legible at medium zoom.
    if (isCapital && tileSize >= 6) {
      const radius = tileSize * (1.15 + score * 0.18);
      this.ctx.strokeStyle = k ? `${k.secondaryColor}66` : 'rgba(251,191,36,0.35)';
      this.ctx.lineWidth = Math.max(1, tileSize * 0.07);
      this.ctx.beginPath();
      this.ctx.ellipse(center.x + tileSize * 0.5, center.y + tileSize * 0.56, radius, radius * 0.56, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private drawCityInfrastructureLinks(
    city: City,
    camera: Camera,
    width: number,
    height: number,
    tileSize: number
  ): void {
    if (tileSize < 6) return;

    const all = Array.from(city.buildings.values());
    const walls = all.filter(b => b.type === 'wall');
    const aqueducts = all.filter(b => b.type === 'aqueduct' || b.type === 'grand_aqueduct');

    const connectNearest = (
      items: typeof all,
      maxDistance: number,
      outer: string,
      inner: string,
      outerW: number,
      innerW: number
    ) => {
      for (const a of items) {
        let nearest: (typeof items)[number] | null = null;
        let nearestD = Infinity;
        for (const b of items) {
          if (a.id === b.id) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < nearestD && d <= maxDistance) {
            nearestD = d;
            nearest = b;
          }
        }
        if (!nearest || a.id > nearest.id) continue;
        const pa = camera.worldToScreen(a.x, a.y, width, height);
        const pb = camera.worldToScreen(nearest.x, nearest.y, width, height);
        this.ctx.lineCap = 'square';
        this.ctx.strokeStyle = outer;
        this.ctx.lineWidth = Math.max(2, tileSize * outerW);
        this.ctx.beginPath();
        this.ctx.moveTo(pa.x + tileSize * 0.5, pa.y + tileSize * 0.72);
        this.ctx.lineTo(pb.x + tileSize * 0.5, pb.y + tileSize * 0.72);
        this.ctx.stroke();
        this.ctx.strokeStyle = inner;
        this.ctx.lineWidth = Math.max(1, tileSize * innerW);
        this.ctx.stroke();
      }
    };

    connectNearest(walls, 4.5, 'rgba(30,41,59,0.8)', 'rgba(100,116,139,0.92)', 0.25, 0.13);
    connectNearest(aqueducts, 7, 'rgba(71,85,105,0.75)', 'rgba(125,211,252,0.72)', 0.18, 0.07);
  }

  private drawSpecialBuildingGroundworks(
    city: City,
    b: { type: string; x: number; y: number },
    k: Kingdom | null,
    screenPos: { x: number; y: number },
    tileSize: number,
    era: string
  ): void {
    if (tileSize < 7) return;

    if (b.type === 'harbor' || b.type === 'port') {
      // Timber/stone waterfront apron, crane mast and water glints.
      const advanced = era === 'industrial' || era === 'modern';
      this.ctx.fillStyle = advanced ? 'rgba(71,85,105,0.8)' : 'rgba(120,72,38,0.82)';
      this.ctx.fillRect(screenPos.x - tileSize * 0.12, screenPos.y + tileSize * 0.68, tileSize * 1.25, tileSize * 0.26);
      this.ctx.fillStyle = advanced ? 'rgba(148,163,184,0.72)' : 'rgba(180,120,62,0.62)';
      for (let i = 0; i < 3; i++) {
        this.ctx.fillRect(screenPos.x + i * tileSize * 0.35, screenPos.y + tileSize * 0.72, tileSize * 0.26, Math.max(1, tileSize * 0.05));
      }

      if (city.tier === 'city' || city.tier === 'metropolis') {
        this.ctx.fillStyle = '#475569';
        this.ctx.fillRect(screenPos.x + tileSize * 0.84, screenPos.y + tileSize * 0.16, Math.max(1, tileSize * 0.06), tileSize * 0.55);
        this.ctx.fillRect(screenPos.x + tileSize * 0.62, screenPos.y + tileSize * 0.18, tileSize * 0.28, Math.max(1, tileSize * 0.05));
      }

      const wave = 0.35 + (Math.sin(this.animTimer * 3.2 + b.x + b.y) + 1) * 0.12;
      this.ctx.fillStyle = `rgba(125,211,252,${wave})`;
      this.ctx.fillRect(screenPos.x - tileSize * 0.16, screenPos.y + tileSize * 0.98, tileSize * 0.34, Math.max(1, tileSize * 0.05));
      this.ctx.fillRect(screenPos.x + tileSize * 0.48, screenPos.y + tileSize * 1.02, tileSize * 0.42, Math.max(1, tileSize * 0.05));
      return;
    }

    if (b.type === 'palace' || b.type === 'monument' || b.type === 'great_library' || b.type === 'colosseum') {
      const civicColor = k?.secondaryColor ?? '#fbbf24';
      this.ctx.fillStyle = `${civicColor}22`;
      this.ctx.beginPath();
      this.ctx.ellipse(screenPos.x + tileSize * 0.5, screenPos.y + tileSize * 0.74, tileSize * 0.78, tileSize * 0.28, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = `${civicColor}55`;
      this.ctx.lineWidth = Math.max(1, tileSize * 0.05);
      this.ctx.stroke();
    }
  }

  private drawLandmarkPresence(
    city: City,
    b: { type: string; x: number; y: number },
    k: Kingdom | null,
    screenPos: { x: number; y: number },
    tileSize: number
  ): void {
    if (!this.isLandmark(b.type) || tileSize < 7) return;
    const capital = !!k && k.capitalCityId === city.id;
    const glowColor = b.type === 'great_library' || b.type === 'academy'
      ? '56,189,248'
      : b.type === 'colosseum'
        ? '249,115,22'
        : capital
          ? '251,191,36'
          : '226,232,240';
    const pulse = 0.8 + Math.sin(this.animTimer * 1.5 + b.x * 0.4) * 0.2;
    const grad = this.ctx.createRadialGradient(
      screenPos.x + tileSize * 0.5, screenPos.y + tileSize * 0.45, 1,
      screenPos.x + tileSize * 0.5, screenPos.y + tileSize * 0.45, tileSize * 1.25
    );
    grad.addColorStop(0, `rgba(${glowColor},${0.12 * pulse})`);
    grad.addColorStop(1, `rgba(${glowColor},0)`);
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x + tileSize * 0.5, screenPos.y + tileSize * 0.45, tileSize * 1.25, 0, Math.PI * 2);
    this.ctx.fill();
  }


  private drawBuildingAmbientEffects(b: { id: string; type: string; x: number; y: number }, particles: ParticleManager): void {
    const last = this.buildingFxTime.get(b.id) ?? -999;
    const interval = b.type === 'factory' || b.type === 'refinery' ? 0.45
      : b.type === 'smithy' || b.type === 'workshop' || b.type === 'oil_well' ? 0.75
      : b.type === 'harbor' || b.type === 'port' ? 1.15
      : 999;
    if (this.animTimer - last < interval) return;
    this.buildingFxTime.set(b.id, this.animTimer);

    if (b.type === 'factory' || b.type === 'refinery' || b.type === 'smithy' || b.type === 'workshop' || b.type === 'oil_well') {
      const dark = b.type === 'oil_well' || b.type === 'refinery';
      particles.spawnParticle(
        b.x + 0.58,
        b.y - 0.42,
        dark ? 'rgba(71, 85, 105, 0.48)' : 'rgba(180, 180, 180, 0.38)',
        Math.sin(b.x * 1.7 + b.y) * 0.05,
        -0.28,
        1.1,
        b.type === 'factory' || b.type === 'refinery' ? 3 : 2
      );
      return;
    }

    if (b.type === 'harbor' || b.type === 'port') {
      particles.spawnParticle(b.x + 0.45, b.y + 0.55, 'rgba(125, 211, 252, 0.38)', 0.06, -0.04, 0.55, 2);
    }
  }

  private drawEntityActionEffects(
    e: Entity,
    centerX: number,
    centerY: number,
    tileSize: number,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number
  ): void {
    const fxColor = this.getSpeciesFxColor(e);

    if (animation === 'attack') {
      const dir = this.getDirectionVector(direction);
      const sideX = -dir.y;
      const sideY = dir.x;
      const reach = tileSize * (0.48 + frame * 0.04);
      const fxX = centerX + dir.x * reach;
      const fxY = centerY + dir.y * reach - tileSize * 0.08;
      const slash = Math.max(1, tileSize * 0.11);

      this.ctx.fillStyle = withAlpha(fxColor, frame === 0 ? 0.88 : 0.58);
      this.ctx.fillRect(fxX - slash / 2, fxY - slash / 2, slash, slash);
      this.ctx.fillRect(fxX + sideX * slash, fxY + sideY * slash, slash, slash);
      this.ctx.fillRect(fxX - sideX * slash, fxY - sideY * slash, slash, slash);

      // The flourish now follows the weapon, not the wielder's blood.
      if (e.species === SpeciesType.DRAGON) {
        this.ctx.fillStyle = 'rgba(250, 204, 21, 0.5)';
        this.ctx.fillRect(fxX + dir.x * slash, fxY + dir.y * slash, slash, slash * 1.4);
      } else if (e.equipment.weapon?.category === 'ranged') {
        this.ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
        this.ctx.fillRect(fxX - dir.x * tileSize * 0.25, fxY - dir.y * tileSize * 0.25, slash * 2.4, Math.max(1, slash * 0.55));
      } else if (e.equipment.weapon?.category === 'heavy' || e.species === SpeciesType.BEAR) {
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        this.ctx.fillRect(fxX - sideX * slash * 2, fxY - sideY * slash * 2, slash * 3, slash);
      }
      return;
    }

    if (animation === 'heal') {
      const pulse = 0.24 + Math.sin(this.animTimer * 5) * 0.1;
      this.ctx.strokeStyle = withAlpha(fxColor, pulse);
      this.ctx.lineWidth = Math.max(1, tileSize * 0.06);
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, tileSize * (0.48 + frame * 0.05), 0, Math.PI * 2);
      this.ctx.stroke();
      return;
    }

    if ((animation === 'gather' || animation === 'build') && tileSize > 7) {
      const dir = this.getDirectionVector(direction);
      const sparkX = centerX + dir.x * tileSize * 0.42;
      const sparkY = centerY + dir.y * tileSize * 0.28 + tileSize * 0.18;
      const dust = animation === 'build' ? '#d6b783' : (e.profession === 'miner' ? '#cbd5e1' : '#86efac');
      this.ctx.fillStyle = withAlpha(dust, 0.38 + (frame % 2) * 0.18);
      this.ctx.fillRect(sparkX, sparkY, Math.max(1, tileSize * 0.12), Math.max(1, tileSize * 0.08));
      this.ctx.fillRect(sparkX - tileSize * 0.16, sparkY + tileSize * 0.10, Math.max(1, tileSize * 0.08), Math.max(1, tileSize * 0.06));
      return;
    }

    if (animation === 'shoot' && tileSize > 7) {
      const dir = this.getDirectionVector(direction);
      const flight = tileSize * (0.46 + frame * 0.08);
      const ax = centerX + dir.x * flight;
      const ay = centerY + dir.y * flight - tileSize * 0.08;
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.fillRect(ax, ay, Math.max(2, tileSize * 0.24), Math.max(1, tileSize * 0.055));
      this.ctx.fillStyle = fxColor;
      this.ctx.fillRect(ax + dir.x * tileSize * 0.14, ay, Math.max(1, tileSize * 0.08), Math.max(1, tileSize * 0.08));
      return;
    }

    if (animation === 'socialize' && tileSize > 7) {
      const pulse = 0.34 + Math.sin(this.animTimer * 4 + frame) * 0.12;
      this.ctx.fillStyle = withAlpha('#f8fafc', pulse);
      this.ctx.fillRect(centerX + tileSize * 0.26, centerY - tileSize * 0.50, Math.max(1, tileSize * 0.10), Math.max(1, tileSize * 0.10));
      this.ctx.fillStyle = withAlpha(fxColor, pulse);
      this.ctx.fillRect(centerX + tileSize * 0.34, centerY - tileSize * 0.60, Math.max(1, tileSize * 0.08), Math.max(1, tileSize * 0.08));
      return;
    }

    if (animation === 'flee' && tileSize > 7) {
      const dir = this.getDirectionVector(direction);
      this.ctx.fillStyle = 'rgba(214, 188, 135, 0.28)';
      this.ctx.fillRect(centerX - dir.x * tileSize * 0.38, centerY - dir.y * tileSize * 0.38, Math.max(1, tileSize * 0.14), Math.max(1, tileSize * 0.08));
      this.ctx.fillRect(centerX - dir.x * tileSize * 0.55, centerY - dir.y * tileSize * 0.22, Math.max(1, tileSize * 0.1), Math.max(1, tileSize * 0.06));
    }
  }

  private drawPixelCrown(x: number, y: number, size: number): void {
    const s = Math.max(1, size / 8);
    this.ctx.fillStyle = '#92400e';
    this.ctx.fillRect(x + s, y + s * 5, s * 6, s * 2);
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.fillRect(x + s, y + s * 2, s * 2, s * 4);
    this.ctx.fillRect(x + s * 3, y + s, s * 2, s * 5);
    this.ctx.fillRect(x + s * 5, y + s * 2, s * 2, s * 4);
    this.ctx.fillStyle = '#fef08a';
    this.ctx.fillRect(x + s * 3, y + s * 5, s * 2, s);
    this.ctx.fillStyle = '#ef4444';
    this.ctx.fillRect(x + s * 2, y + s * 3, s, s);
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.fillRect(x + s * 4, y + s * 2, s, s);
  }

  private drawPixelStar(x: number, y: number, size: number): void {
    const s = Math.max(1, size / 7);
    this.ctx.fillStyle = '#fef08a';
    this.ctx.fillRect(x + s * 3, y, s, s * 2);
    this.ctx.fillRect(x + s, y + s * 2, s * 5, s);
    this.ctx.fillRect(x + s * 2, y + s * 3, s * 3, s);
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.fillRect(x, y + s * 3, s * 2, s);
    this.ctx.fillRect(x + s * 5, y + s * 3, s * 2, s);
    this.ctx.fillRect(x + s * 2, y + s * 4, s, s * 2);
    this.ctx.fillRect(x + s * 4, y + s * 4, s, s * 2);
  }

  private isWater(type: TerrainType): boolean {
    return type === TerrainType.DEEP_OCEAN || type === TerrainType.SHALLOW_WATER;
  }

  /** Fast per-tile hash; equivalent to hash2(x, y, salt) for the current tile. */
  private h(salt: number): number {
    const n = (this.hSin * COS_SALT_TABLE[salt] + this.hCos * SIN_SALT_TABLE[salt]) * HASH_SCALE;
    const f = n % 1;
    return f < 0 ? f + 1 : f;
  }

  private setHashBase(x: number, y: number): void {
    const a = x * 127.1 + y * 311.7;
    this.hSin = Math.sin(a);
    this.hCos = Math.cos(a);
  }

  /** Ensure the offscreen terrain bake canvas exists and matches the map size; mark everything dirty on create/resize. */
  private ensureTerrainBake(tileMap: TileMap): void {
    if (this.terrainCanvas && this.terrainW === tileMap.width && this.terrainH === tileMap.height) return;
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = tileMap.width * this.bakeTileSize;
    this.terrainCanvas.height = tileMap.height * this.bakeTileSize;
    this.terrainCtx = this.terrainCanvas.getContext('2d', { alpha: true })!;
    this.terrainCtx.imageSmoothingEnabled = false;
    this.terrainW = tileMap.width;
    this.terrainH = tileMap.height;
    this.waterMask = new Uint8Array(tileMap.width * tileMap.height);
    tileMap.markAllDirty();
  }

  /**
   * Brings the animated terrain layer up to date, and reports whether the frame
   * may blit it instead of drawing the sea tile by tile.
   *
   * Returns false when the layer is not the right tool — a world too large to bake,
   * or a zoom close enough that upscaling the layer would be visible — and the
   * caller falls back to the direct path.
   */
  private ensureAnimatedLayer(
    tileMap: TileMap,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    tileSize: number
  ): boolean {
    if (tileMap.width * tileMap.height > ANIM_BAKE_MAX_TILES) return false;
    if (tileSize > this.bakeTileSize * ANIM_MAX_ZOOM_FACTOR) return false;

    if (!this.animCanvas || this.animW !== tileMap.width || this.animH !== tileMap.height) {
      this.animCanvas = document.createElement('canvas');
      this.animCanvas.width = tileMap.width * this.bakeTileSize;
      this.animCanvas.height = tileMap.height * this.bakeTileSize;
      this.animCtx = this.animCanvas.getContext('2d', { alpha: true })!;
      this.animCtx.imageSmoothingEnabled = false;
      this.animW = tileMap.width;
      this.animH = tileMap.height;
      this.animMaxX = -1;
      this.animTerrainVersion = -1;
    }

    this.animFrame++;
    const rangeMoved =
      minX !== this.animMinX || minY !== this.animMinY ||
      maxX !== this.animMaxX || maxY !== this.animMaxY;
    const terraformed = this.animTerrainVersion !== tileMap.terrainVersion;
    const phaseDue = this.animFrame % ANIM_REFRESH_FRAMES === 0;

    // A moved camera or reshaped ground must be answered at once; the animation
    // phase can wait for its turn.
    if (rangeMoved || terraformed || phaseDue) {
      this.redrawAnimatedLayer(tileMap, minX, minY, maxX, maxY);
      this.animMinX = minX; this.animMinY = minY;
      this.animMaxX = maxX; this.animMaxY = maxY;
      this.animTerrainVersion = tileMap.terrainVersion;
    }
    return true;
  }

  /**
   * Draws the visible sea into the layer, at bake resolution.
   *
   * Deliberately the same art code the direct path uses, called with the layer's
   * coordinates instead of the screen's — so what lands here is exactly what the
   * frame would have drawn, and there is no second implementation to keep in step.
   */
  private redrawAnimatedLayer(tileMap: TileMap, minX: number, minY: number, maxX: number, maxY: number): void {
    const ctx = this.animCtx;
    if (!ctx) return;
    const ts = this.bakeTileSize;

    // One tile of margin: a canopy is drawn taller than its own tile, so a sprite
    // on the boundary row would otherwise be sliced by the cleared region.
    const x0 = Math.max(0, minX - 1);
    const y0 = Math.max(0, minY - 1);
    const x1 = Math.min(tileMap.width - 1, maxX + 1);
    const y1 = Math.min(tileMap.height - 1, maxY + 1);

    ctx.clearRect(x0 * ts, y0 * ts, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts);

    const saved = this.ctx;
    this.ctx = ctx;
    // Accent then decoration, per tile, in the order the direct path uses.
    for (let x = x0; x <= x1; x++) {
      const column = tileMap.grid[x];
      for (let y = y0; y <= y1; y++) {
        const tile = column[y];
        if (tile.type === TerrainType.LAVA) {
          this.drawAnimatedTerrainAccent(tileMap, tile, x, y, x * ts, y * ts, ts);
        } else if (this.isWater(tile.type)) {
          const mask = this.waterMask ? this.waterMask[x * this.terrainH + y] : (WATER_EDGED | WATER_ANIMATES);
          if (mask !== 0) this.drawAnimatedTerrainAccent(tileMap, tile, x, y, x * ts, y * ts, ts, mask);
        }
        this.drawTileDecoration(tile, x, y, x * ts, y * ts, ts);
      }
    }
    this.ctx = saved;
  }

  /**
   * Vegetation, terrain ornaments and deposit markers for one tile.
   *
   * Lifted out of the per-frame loop so the animated layer can carry it. These
   * were the last per-tile blits on the frame path and by far the most numerous —
   * around 1.600 `drawImage` calls a frame at 1080p, the great majority of them
   * trees and resource nodes on ground that had not changed in centuries.
   *
   * Everything here is either static or sways slowly, so the animated layer's
   * quarter refresh rate carries it with no visible cost. Fire is deliberately
   * *not* here: it flickers fast, there are only ever a handful of burning tiles,
   * and it should react the instant it starts.
   *
   * A note for anyone measuring this. Moving these blits into the layer looked at
   * first like a 7,5% pixel regression, and was reverted on that basis. The
   * regression was the measurement: assigning `canvas.width` directly resets the
   * 2D context to its defaults, and `imageSmoothingEnabled` defaults to *true* —
   * so the harness had the per-frame path drawing every sprite through a bilinear
   * filter while the layer drew them nearest-neighbour. Resize through
   * `PixelRenderer.resize`, which restores the renderer's own context state, and
   * the two paths agree to within alpha rounding.
   */
  private drawTileDecoration(tile: Tile, x: number, y: number, sx: number, sy: number, tileSize: number): void {
    /**
     * Seeded from this tile, which it never was.
     *
     * The scatter below reads `h(800)` / `h(801)` without setting the hash
     * base, so it used whatever base the last caller happened to leave —
     * in practice the previous water or lava tile, since those are the only
     * things in this loop that seed it. Every land tile between two water
     * tiles therefore shared a single hash value, and "one tree every ~3
     * tiles" came out as all-or-nothing: whole runs of forest either fully
     * wooded or completely bare, which is why forest masses read as bands.
     *
     * It also made vegetation depend on draw order, so any change to what
     * seeds the hash silently moved every tree on the map.
     */
    this.setHashBase(x, y);
    const sway = Math.sin(this.animTimer * 2 + x * 0.5 + y * 0.3) * 1.5;

    if (tile.type === TerrainType.FOREST) {
      // One tree every ~3 tiles — forest masses read as canopy, not a carpet.
      if (this.h(800) < 0.33) {
        const s = SpriteRegistry.get('tree_oak');
        if (s) this.ctx.drawImage(s, sx + sway, sy - tileSize * 0.2, tileSize, tileSize * 1.2);
      }
    } else if (tile.type === TerrainType.TUNDRA || tile.type === TerrainType.SNOW) {
      if (this.h(801) > 0.68) {
        const s = SpriteRegistry.get('tree_pine');
        if (s) this.ctx.drawImage(s, sx + sway, sy - tileSize * 0.2, tileSize, tileSize * 1.2);
      }
    } else if (tile.type === TerrainType.SAVANNA) {
      const s = SpriteRegistry.get('tree_palm');
      if (s) this.ctx.drawImage(s, sx + sway, sy - tileSize * 0.15, tileSize, tileSize * 1.15);
    } else if (tile.type === TerrainType.SWAMP) {
      const s = SpriteRegistry.get('swamp_reed');
      if (s) this.ctx.drawImage(s, sx + sway * 0.5, sy, tileSize, tileSize);
    } else if (tile.type === TerrainType.ARCANE) {
      const s = SpriteRegistry.get('arcane_crystal');
      if (s) {
        // Pulsing glow for crystals
        this.ctx.globalAlpha = 0.7 + Math.sin(this.animTimer * 3) * 0.3;
        this.ctx.drawImage(s, sx, sy, tileSize, tileSize);
        this.ctx.globalAlpha = 1.0;
      }
    } else if (tile.type === TerrainType.CORRUPTED) {
      const s = SpriteRegistry.get('corrupted_skull');
      if (s) this.ctx.drawImage(s, sx, sy, tileSize, tileSize);
    }

    // Resource Node Sprites.
    //
    // Common deposits — wild food above all — blanket thousands of tiles. Drawing
    // an icon on every one buries the terrain, the roads and the kingdom borders
    // under a carpet of sprites. Abundant goods are therefore thinned to a stable
    // scatter (same tiles every frame, so nothing flickers), while scarce and
    // strategic deposits always draw: those are the ones worth going to war over.
    if (tile.resourceType) {
      // Sparse common deposits to a wider scatter; skip all of them at far zoom
      // where they read as noise instead of information.
      if (tileSize >= 5) {
        const density = COMMON_NODE_TIERS.has(GOODS[tile.resourceType]?.tier) ? 0.12 : 1;
        if (density >= 1 || this.h(917) < density) {
          const nodeSprite = SpriteRegistry.get(`node_${tile.resourceType}`);
          if (nodeSprite) this.ctx.drawImage(nodeSprite, sx, sy, tileSize, tileSize);
        }
      }
    }
  }

  /** Redraw dirty static tiles, including a stable base frame for animated surfaces. */
  private bakeDirtyTiles(tileMap: TileMap): void {
    if (!this.terrainCtx || (!tileMap.allTilesDirty && tileMap.dirtyTiles.size === 0)) return;
    const savedCtx = this.ctx;
    this.ctx = this.terrainCtx;
    const W = tileMap.width;
    const H = tileMap.height;
    if (tileMap.allTilesDirty) {
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) this.bakeStaticTile(tileMap, x, y);
    } else for (const idx of tileMap.dirtyTiles) {
        const x = Math.floor(idx / H);
        const y = idx - x * H;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        this.bakeStaticTile(tileMap, x, y);
      }
    this.ctx = savedCtx;
    tileMap.dirtyTiles.clear();
    tileMap.allTilesDirty = false;
    tileMap.dirtyChunks.clear();
  }

  private bakeStaticTile(tileMap: TileMap, x: number, y: number): void {
    const tile = tileMap.grid[x][y];
    const ts = this.bakeTileSize;
    const bx = x * ts;
    const by = y * ts;
    this.ctx.clearRect(bx, by, ts, ts);
    this.setHashBase(x, y);
    const color =
      tile.renderSurface !== null &&
      tile.renderSurfaceType === tile.type &&
      tile.renderSurfaceHeight === tile.height &&
      tile.renderSurfaceMoisture === tile.moisture &&
      tile.renderSurfaceTemp === tile.temperature
        ? tile.renderSurface
        : (() => {
            const c = terrainSurfaceColor(tile, x, y, this.animTimer);
            tile.renderSurface = c;
            tile.renderSurfaceType = tile.type;
            tile.renderSurfaceHeight = tile.height;
            tile.renderSurfaceMoisture = tile.moisture;
            tile.renderSurfaceTemp = tile.temperature;
            return c;
          })();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(bx, by, ts + 0.75, ts + 0.75);
    this.drawTerrainTexture(tile, x, y, bx, by, ts);
    this.drawHeightRelief(tileMap, tile, x, y, bx, by, ts);
    this.drawTerrainEdges(tileMap, tile, x, y, bx, by, ts);
    this.drawTerrainDetails(tile, x, y, bx, by, ts);
    this.cacheWaterMask(tileMap, tile, x, y);
  }

  /** Records what per-frame work this water tile will need. See `WATER_EDGED`. */
  private cacheWaterMask(tileMap: TileMap, tile: Tile, x: number, y: number): void {
    if (!this.waterMask) return;
    const index = x * this.terrainH + y;
    if (!this.isWater(tile.type)) { this.waterMask[index] = 0; return; }

    let mask = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const neighbour = tileMap.getTile(x + dx, y + dy);
      if (neighbour && neighbour.type !== tile.type) { mask |= WATER_EDGED; break; }
    }

    // Both gates below are position-only, so a tile that fails them can never
    // show movement and never needs touching again.
    const shallow = tile.type === TerrainType.SHALLOW_WATER;
    this.setHashBase(x, y);
    const crest = this.h(220) > (shallow ? 0.45 : 0.72);
    const glint = hash2(x, y, 97) > (shallow ? 0.84 : 0.94);
    // Shallow water always qualifies: its caustic web is gated purely on time.
    if (shallow || crest || glint) mask |= WATER_ANIMATES;

    this.waterMask[index] = mask;
  }


  private getOverlayTerrainColor(tile: Tile, overlayMode: OverlayMode): string | null {
    if (overlayMode === 'temperature') {
      const tNorm = clamp((tile.temperature + 20) / 70, 0, 1);
      if (tNorm < 0.5) return mixColor('#1d4ed8', '#a7f3d0', tNorm * 2);
      return mixColor('#f8e7a2', '#dc2626', (tNorm - 0.5) * 2);
    }

    if (overlayMode === 'resources' && tile.resourceType) {
      return RESOURCE_COLORS[tile.resourceType] ?? '#fbbf24';
    }

    return null;
  }

  private drawTerrainTile(
    tileMap: TileMap,
    tile: Tile,
    x: number,
    y: number,
    screenX: number,
    screenY: number,
    tileSize: number,
    overlayMode: OverlayMode
  ): void {
    this.setHashBase(x, y);

    const overlayColor = this.getOverlayTerrainColor(tile, overlayMode);

    let color: string;
    if (overlayColor) {
      color = overlayColor;
    } else if (this.isWater(tile.type) || tile.type === TerrainType.LAVA) {
      // Animated surfaces are recomputed every frame.
      color = terrainSurfaceColor(tile, x, y, this.animTimer);
    } else if (
      tile.renderSurface !== null &&
      tile.renderSurfaceType === tile.type &&
      tile.renderSurfaceHeight === tile.height &&
      tile.renderSurfaceMoisture === tile.moisture &&
      tile.renderSurfaceTemp === tile.temperature
    ) {
      color = tile.renderSurface;
    } else {
      color = terrainSurfaceColor(tile, x, y, this.animTimer);
      tile.renderSurface = color;
      tile.renderSurfaceType = tile.type;
      tile.renderSurfaceHeight = tile.height;
      tile.renderSurfaceMoisture = tile.moisture;
      tile.renderSurfaceTemp = tile.temperature;
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(screenX, screenY, tileSize + 0.75, tileSize + 0.75);

    if (overlayColor) {
      this.drawDataTileTexture(tile, x, y, screenX, screenY, tileSize);
      return;
    }

    this.drawTerrainTexture(tile, x, y, screenX, screenY, tileSize);
    this.drawHeightRelief(tileMap, tile, x, y, screenX, screenY, tileSize);
    this.drawTerrainEdges(tileMap, tile, x, y, screenX, screenY, tileSize);

    if (tileSize >= 8) {
      this.drawTerrainDetails(tile, x, y, screenX, screenY, tileSize);
    }
  }

  /** Animated surface pass over the cached water/lava base. */
  /**
   * The per-frame layer over a baked water or lava tile.
   *
   * Identical in output to what this used to do — the edge pass still runs at
   * screen resolution over the bake, exactly as before, which is what gives a
   * coastline its depth. The only change is that it runs on the tiles that have
   * an edge or a moving surface instead of on every tile of open sea.
   */
  private drawAnimatedTerrainAccent(
    tileMap: TileMap,
    tile: Tile,
    x: number,
    y: number,
    screenX: number,
    screenY: number,
    tileSize: number,
    mask: number = WATER_EDGED | WATER_ANIMATES
  ): void {
    this.setHashBase(x, y);
    if ((mask & WATER_ANIMATES) !== 0) this.drawTerrainTexture(tile, x, y, screenX, screenY, tileSize);
    if ((mask & WATER_EDGED) !== 0) this.drawTerrainEdges(tileMap, tile, x, y, screenX, screenY, tileSize);
    if (tile.type === TerrainType.LAVA && tileSize >= 8) this.drawTerrainDetails(tile, x, y, screenX, screenY, tileSize);
  }

  private drawDataTileTexture(tile: Tile, x: number, y: number, screenX: number, screenY: number, tileSize: number): void {
    if (tileSize < 6) return;

    const grain = this.h(201);
    this.ctx.fillStyle = grain > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    this.ctx.fillRect(
      screenX + tileSize * (0.2 + this.h(202) * 0.45),
      screenY + tileSize * (0.2 + this.h(203) * 0.45),
      Math.max(1, tileSize * 0.12),
      Math.max(1, tileSize * 0.12)
    );
  }

  /**
   * Terrain material pass.
   *
   * V2 rule: the biome must read before its texture. Most tiles intentionally
   * receive no local fleck at all; detail appears in broad deterministic
   * clusters so zoomed-out terrain stays calm and buildings remain dominant.
   */
  private drawTerrainTexture(tile: Tile, x: number, y: number, screenX: number, screenY: number, tileSize: number): void {
    const visual = TERRAIN_VISUALS[tile.type];
    if (tileSize < 4) return;

    if (this.isWater(tile.type)) {
      const shallow = tile.type === TerrainType.SHALLOW_WATER;
      const macro = valueNoise2D(x, y, 8, 601);
      const roll = this.h(220);

      // Primary wave crests
      if (roll > (shallow ? 0.45 : 0.72)) {
        const wavePhase = Math.sin((x + y * 0.72) * 0.33 + this.animTimer * (shallow ? 0.78 : 0.45));
        const lineY = screenY + tileSize * (0.22 + ((wavePhase + 1) * 0.5) * 0.48);
        const lineX = screenX + tileSize * (0.10 + this.h(222) * 0.30);
        const lineW = tileSize * (0.28 + macro * 0.36);
        this.ctx.fillStyle = withAlpha(visual.accent, shallow ? 0.22 : 0.12);
        this.ctx.fillRect(
          Math.floor(lineX),
          Math.floor(lineY),
          Math.max(1, Math.floor(lineW)),
          Math.max(1, Math.floor(tileSize * 0.05))
        );
      }

      // Shallow water caustics light webs
      if (shallow && tileSize >= 6) {
        const causticA = Math.sin(x * 0.4 - y * 0.3 + this.animTimer * 0.65);
        const causticB = Math.cos(x * 0.35 + y * 0.45 + this.animTimer * 0.5);
        if (causticA * causticB > 0.38) {
          const cx = screenX + tileSize * (0.15 + this.h(223) * 0.55);
          const cy = screenY + tileSize * (0.18 + this.h(226) * 0.52);
          this.ctx.fillStyle = withAlpha(visual.accent, 0.18);
          this.ctx.fillRect(Math.floor(cx), Math.floor(cy), Math.max(1, tileSize * 0.15), Math.max(1, tileSize * 0.04));
        }
      }

      // Specular sparkles on wave crests
      const accent = terrainAccentColor(tile, x, y, this.animTimer);
      if (accent && tileSize >= 8) {
        const glintPulse = 0.35 + (Math.sin(this.animTimer * 2.2 + x * 1.4 + y * 0.9) + 1) * 0.32;
        this.ctx.fillStyle = withAlpha(accent, shallow ? glintPulse : glintPulse * 0.7);
        const px = screenX + tileSize * (0.22 + this.h(224) * 0.56);
        const py = screenY + tileSize * (0.18 + this.h(225) * 0.58);
        this.ctx.fillRect(Math.floor(px), Math.floor(py), Math.max(1, tileSize * 0.065), Math.max(1, tileSize * 0.045));
      }
      return;
    }

    // Lava is animated in its detail pass. Keep the crust itself almost clean.
    if (tile.type === TerrainType.LAVA) {
      if (this.h(238) > 0.72) {
        this.ctx.fillStyle = withAlpha(visual.shadow, 0.2);
        this.ctx.fillRect(
          Math.floor(screenX + tileSize * (0.12 + this.h(239) * 0.52)),
          Math.floor(screenY + tileSize * (0.16 + this.h(240) * 0.58)),
          Math.max(1, tileSize * 0.14),
          Math.max(1, tileSize * 0.05)
        );
      }
      return;
    }

    const macro = valueNoise2D(x, y, 6, 603);
    const density = tile.type === TerrainType.FOREST ? 0.30
      : tile.type === TerrainType.GRASS ? 0.22
      : tile.type === TerrainType.SWAMP ? 0.24
      : tile.type === TerrainType.MOUNTAIN ? 0.24
      : tile.type === TerrainType.ARCANE || tile.type === TerrainType.CORRUPTED ? 0.19
      : 0.13;

    // Cluster gate: large regions get texture, neighbouring large regions stay quiet.
    const clusterBoost = macro > 0.58 ? 0.10 : macro < 0.34 ? -0.07 : 0;
    if (this.h(241) > density + clusterBoost) return;

    const strong = this.h(242) > 0.58;
    const horizontal = this.h(243) > 0.5;
    const rx = 0.16 + this.h(244) * 0.62;
    const ry = 0.16 + this.h(245) * 0.62;
    const long = 0.08 + this.h(246) * 0.09;
    const short = 0.035 + this.h(247) * 0.025;
    this.tileRect(
      screenX, screenY, tileSize,
      rx, ry,
      horizontal ? long : short,
      horizontal ? short : long,
      withAlpha(strong ? visual.high : visual.low, strong ? 0.16 : 0.12)
    );
  }

  /**
   * Directional relief with restrained contrast. Instead of outlining every
   * elevation change, only meaningful steps cast a small east/south shadow or
   * west/north highlight. Mountains get a stronger treatment.
   */
  private drawHeightRelief(
    tileMap: TileMap,
    tile: Tile,
    x: number,
    y: number,
    screenX: number,
    screenY: number,
    tileSize: number
  ): void {
    if (this.isWater(tile.type) || tileSize < 5) return;

    const mountain = tile.type === TerrainType.MOUNTAIN;
    const threshold = mountain ? 0.032 : 0.07;
    const baseWidth = mountain ? 0.12 : 0.055;
    const baseShadow = mountain ? 0.24 : 0.085;
    const baseHighlight = mountain ? 0.18 : 0.055;

    const test = (
      neighbor: Tile | null,
      edge: 'left' | 'right' | 'top' | 'bottom',
      shadow: boolean
    ) => {
      if (!neighbor || this.isWater(neighbor.type)) return;
      const delta = tile.height - neighbor.height;
      if (delta <= threshold) return;
      const strength = clamp((delta - threshold) * (mountain ? 5.5 : 4.0), 0, 1);
      const width = Math.max(1, tileSize * (baseWidth + strength * (mountain ? 0.055 : 0.025)));
      const alpha = (shadow ? baseShadow : baseHighlight) * (0.55 + strength * 0.45);
      this.paintEdge(
        screenX, screenY, tileSize, edge,
        shadow ? `rgba(20,24,29,${alpha})` : `rgba(255,255,255,${alpha})`,
        width
      );
    };

    test(tileMap.getTile(x + 1, y), 'right', true);
    test(tileMap.getTile(x, y + 1), 'bottom', true);
    test(tileMap.getTile(x - 1, y), 'left', false);
    test(tileMap.getTile(x, y - 1), 'top', false);
  }

  /**
   * Organic shoreline / biome transition pass.
   * Edges are broken into short deterministic segments instead of drawing a
   * perfectly straight line across every tile. This removes the checkerboard
   * feel while preserving strict tile gameplay underneath.
   */
  private drawTerrainEdges(
    tileMap: TileMap,
    tile: Tile,
    x: number,
    y: number,
    screenX: number,
    screenY: number,
    tileSize: number
  ): void {
    if (tileSize < 5) return;

    const dirs = [
      { dx: -1, dy: 0, edge: 'left' as const, salt: 500 },
      { dx: 1, dy: 0, edge: 'right' as const, salt: 520 },
      { dx: 0, dy: -1, edge: 'top' as const, salt: 540 },
      { dx: 0, dy: 1, edge: 'bottom' as const, salt: 560 }
    ];
    const water = this.isWater(tile.type);

    for (const dir of dirs) {
      const neighbor = tileMap.getTile(x + dir.dx, y + dir.dy);
      if (!neighbor || neighbor.type === tile.type) continue;
      const neighborWater = this.isWater(neighbor.type);

      // Water-to-water transition: shallow rim against the deep ocean.
      if (water && neighborWater) {
        if (tile.type === TerrainType.SHALLOW_WATER && neighbor.type === TerrainType.DEEP_OCEAN) {
          this.paintOrganicEdge(
            screenX, screenY, tileSize, dir.edge,
            withAlpha(TERRAIN_VISUALS[TerrainType.DEEP_OCEAN].high, 0.16),
            Math.max(1, tileSize * 0.07), dir.salt, 2, 0.025
          );
        }
        continue;
      }

      if (water && !neighborWater) {
        // Coastal water: broad translucent turquoise/sand underlay, then broken foam.
        const shallow = tile.type === TerrainType.SHALLOW_WATER;
        const underlay = shallow
          ? mixColor(TERRAIN_VISUALS[TerrainType.SHALLOW_WATER].high, TERRAIN_VISUALS[TerrainType.SAND].high, 0.22)
          : TERRAIN_VISUALS[TerrainType.SHALLOW_WATER].base;
        this.paintOrganicEdge(
          screenX, screenY, tileSize, dir.edge,
          withAlpha(underlay, shallow ? 0.22 : 0.10),
          Math.max(1, tileSize * (shallow ? 0.16 : 0.08)), dir.salt + 1, 3, 0.055
        );

        const foamPulse = 0.30 + (Math.sin(this.animTimer * 1.15 + x * 0.55 + y * 0.37 + dir.salt) + 1) * 0.08;
        this.paintOrganicEdge(
          screenX, screenY, tileSize, dir.edge,
          withAlpha('#f8ffff', shallow ? foamPulse : foamPulse * 0.48),
          Math.max(1, tileSize * 0.055), dir.salt + 5, shallow ? 3 : 2, 0.075
        );
        continue;
      }

      if (!water && neighborWater) {
        // Land shoreline: a sandy fringe plus a thin wet line toward the water.
        const sand = TERRAIN_VISUALS[TerrainType.SAND];
        const beach = tile.type === TerrainType.SAND ? sand.high : sand.base;
        this.paintOrganicEdge(
          screenX, screenY, tileSize, dir.edge,
          withAlpha(beach, tile.type === TerrainType.SAND ? 0.42 : 0.30),
          Math.max(1, tileSize * (tile.type === TerrainType.SAND ? 0.18 : 0.13)), dir.salt + 9, 3, 0.05
        );
        this.paintOrganicEdge(
          screenX, screenY, tileSize, dir.edge,
          withAlpha(sand.shadow, 0.14),
          Math.max(1, tileSize * 0.045), dir.salt + 13, 2, 0.025
        );
        continue;
      }

      // Land biome boundaries: feather only a few fragments. Related biomes are
      // intentionally subtle; dramatic materials (snow/mountain/corruption) read more strongly.
      const dramatic = tile.type === TerrainType.SNOW || neighbor.type === TerrainType.SNOW
        || tile.type === TerrainType.MOUNTAIN || neighbor.type === TerrainType.MOUNTAIN
        || tile.type === TerrainType.CORRUPTED || neighbor.type === TerrainType.CORRUPTED
        || tile.type === TerrainType.ARCANE || neighbor.type === TerrainType.ARCANE;
      const blended = mixColor(TERRAIN_VISUALS[tile.type].base, TERRAIN_VISUALS[neighbor.type].base, 0.48);
      this.paintOrganicEdge(
        screenX, screenY, tileSize, dir.edge,
        withAlpha(blended, dramatic ? 0.18 : 0.10),
        Math.max(1, tileSize * (dramatic ? 0.085 : 0.055)), dir.salt + 17, dramatic ? 3 : 2, 0.04
      );
    }
  }

  private paintOrganicEdge(
    screenX: number,
    screenY: number,
    tileSize: number,
    edge: 'left' | 'right' | 'top' | 'bottom',
    color: string,
    width: number,
    salt: number,
    segments: number = 3,
    jitter: number = 0.05
  ): void {
    this.ctx.fillStyle = color;
    const baseW = Math.max(1, Math.round(width));
    const vertical = edge === 'left' || edge === 'right';

    for (let i = 0; i < segments; i++) {
      const s = salt + i * 3;
      const along = 0.04 + this.h(s) * 0.76;
      const length = 0.16 + this.h(s + 1) * 0.28;
      const inset = this.h(s + 2) * jitter;
      const pxWidth = Math.max(1, baseW + Math.round((this.h(s + 2) - 0.5) * 2));

      if (vertical) {
        const y0 = Math.floor(screenY + along * tileSize);
        const h = Math.max(1, Math.floor(Math.min(length, 0.96 - along) * tileSize));
        const x0 = edge === 'left'
          ? Math.floor(screenX + inset * tileSize)
          : Math.floor(screenX + tileSize - pxWidth - inset * tileSize);
        this.ctx.fillRect(x0, y0, pxWidth, h);
      } else {
        const x0 = Math.floor(screenX + along * tileSize);
        const w = Math.max(1, Math.floor(Math.min(length, 0.96 - along) * tileSize));
        const y0 = edge === 'top'
          ? Math.floor(screenY + inset * tileSize)
          : Math.floor(screenY + tileSize - pxWidth - inset * tileSize);
        this.ctx.fillRect(x0, y0, w, pxWidth);
      }
    }
  }

  private paintEdge(
    screenX: number,
    screenY: number,
    tileSize: number,
    edge: 'left' | 'right' | 'top' | 'bottom',
    color: string,
    width: number
  ): void {
    const w = Math.max(1, width);
    this.ctx.fillStyle = color;

    if (edge === 'left') {
      this.ctx.fillRect(screenX, screenY, w, tileSize + 0.75);
    } else if (edge === 'right') {
      this.ctx.fillRect(screenX + tileSize - w, screenY, w + 0.75, tileSize + 0.75);
    } else if (edge === 'top') {
      this.ctx.fillRect(screenX, screenY, tileSize + 0.75, w);
    } else {
      this.ctx.fillRect(screenX, screenY + tileSize - w, tileSize + 0.75, w + 0.75);
    }
  }

  private tileRect(
    screenX: number,
    screenY: number,
    tileSize: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    color: string
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      Math.floor(screenX + rx * tileSize),
      Math.floor(screenY + ry * tileSize),
      Math.max(1, Math.round(rw * tileSize)),
      Math.max(1, Math.round(rh * tileSize))
    );
  }

  /**
   * Sparse material details. Detail probability is cluster-driven so empty space
   * is part of the art direction instead of every tile competing for attention.
   */
  private drawTerrainDetails(tile: Tile, x: number, y: number, screenX: number, screenY: number, tileSize: number): void {
    const visual = TERRAIN_VISUALS[tile.type];
    const h = (salt: number) => this.h(salt);
    const cluster = valueNoise2D(x, y, 5, 707);

    // Built lots read better on calm ground. Keep extraordinary materials visible,
    // but suppress decorative vegetation directly beneath normal buildings.
    const occupied = !!tile.buildingId;

    switch (tile.type) {
      case TerrainType.GRASS: {
        if (!occupied && cluster > 0.46 && h(300) > 0.58) {
          const rx = 0.16 + h(301) * 0.66;
          const ry = 0.34 + h(302) * 0.42;
          this.tileRect(screenX, screenY, tileSize, rx, ry, 0.035, 0.13, withAlpha(visual.accent, 0.30));
          this.tileRect(screenX, screenY, tileSize, rx + 0.04, ry + 0.035, 0.03, 0.09, withAlpha(visual.high, 0.24));
        }
        if (!occupied && cluster > 0.62 && h(303) > 0.91) {
          const flower = h(304) > 0.5 ? '#fef08a' : '#f8c4d8';
          this.tileRect(screenX, screenY, tileSize, 0.2 + h(305) * 0.58, 0.22 + h(306) * 0.56, 0.05, 0.05, flower);
        }
        break;
      }

      case TerrainType.FOREST: {
        if (!occupied && cluster > 0.38 && h(310) > 0.44) {
          const rx = 0.16 + h(311) * 0.58;
          const ry = 0.22 + h(312) * 0.48;
          // Tiny canopy cluster + trunk, not several random grass blades.
          this.tileRect(screenX, screenY, tileSize, rx, ry, 0.12, 0.09, withAlpha(visual.low, 0.30));
          this.tileRect(screenX, screenY, tileSize, rx + 0.025, ry - 0.035, 0.08, 0.07, withAlpha(visual.high, 0.25));
          this.tileRect(screenX, screenY, tileSize, rx + 0.052, ry + 0.085, 0.025, 0.075, 'rgba(82,54,38,0.30)');
        }
        break;
      }

      case TerrainType.SAND: {
        if (cluster > 0.58 && h(320) > 0.57) {
          const y0 = 0.30 + h(321) * 0.36;
          this.tileRect(screenX, screenY, tileSize, 0.14 + h(322) * 0.12, y0, 0.42 + h(323) * 0.18, 0.04, withAlpha(visual.high, 0.22));
          if (h(324) > 0.76) {
            this.tileRect(screenX, screenY, tileSize, 0.34 + h(325) * 0.25, y0 + 0.09, 0.24, 0.035, withAlpha(visual.low, 0.16));
          }
        }
        break;
      }

      case TerrainType.SOIL: {
        if (!occupied && cluster > 0.60 && h(330) > 0.66) {
          const y0 = 0.30 + h(331) * 0.34;
          this.tileRect(screenX, screenY, tileSize, 0.18, y0, 0.55, 0.035, withAlpha(visual.low, 0.20));
          if (h(332) > 0.80) this.tileRect(screenX, screenY, tileSize, 0.26, y0 + 0.16, 0.38, 0.03, withAlpha(visual.low, 0.15));
        }
        break;
      }

      case TerrainType.SAVANNA: {
        if (!occupied && cluster > 0.47 && h(340) > 0.59) {
          const rx = 0.16 + h(341) * 0.66;
          const ry = 0.28 + h(342) * 0.48;
          this.tileRect(screenX, screenY, tileSize, rx, ry, 0.10, 0.03, withAlpha(visual.accent, 0.27));
          this.tileRect(screenX, screenY, tileSize, rx + 0.035, ry + 0.035, 0.035, 0.12, withAlpha(visual.low, 0.22));
        }
        break;
      }

      case TerrainType.SWAMP: {
        if (cluster > 0.42 && h(350) > 0.50) {
          const rx = 0.12 + h(351) * 0.48;
          const ry = 0.45 + h(352) * 0.28;
          this.tileRect(screenX, screenY, tileSize, rx, ry, 0.28, 0.11, withAlpha('#173f46', 0.26));
          if (h(353) > 0.66) {
            this.tileRect(screenX, screenY, tileSize, rx + 0.31, ry - 0.14, 0.035, 0.18, withAlpha(visual.accent, 0.28));
          }
        }
        break;
      }

      case TerrainType.TUNDRA: {
        if (cluster > 0.55 && h(360) > 0.67) {
          this.tileRect(screenX, screenY, tileSize, 0.16 + h(361) * 0.52, 0.28 + h(362) * 0.44, 0.18, 0.055, withAlpha(visual.high, 0.22));
        }
        break;
      }

      case TerrainType.SNOW: {
        // Snow is intentionally one of the quietest surfaces.
        if (cluster > 0.70 && h(370) > 0.72) {
          this.tileRect(screenX, screenY, tileSize, 0.12 + h(371) * 0.25, 0.60 + h(372) * 0.16, 0.48, 0.035, withAlpha(visual.shadow, 0.13));
        }
        break;
      }

      case TerrainType.MOUNTAIN: {
        // Mountains need form, but not a full identical triangle in every tile.
        const peak = h(380) > 0.34;
        if (peak) {
          const peakX = screenX + tileSize * (0.42 + (h(381) - 0.5) * 0.08);
          const peakY = screenY + tileSize * (0.12 + h(382) * 0.08);
          this.ctx.fillStyle = withAlpha(visual.high, 0.19);
          this.ctx.beginPath();
          this.ctx.moveTo(peakX, peakY);
          this.ctx.lineTo(screenX + tileSize * 0.18, screenY + tileSize * 0.82);
          this.ctx.lineTo(screenX + tileSize * 0.50, screenY + tileSize * 0.64);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.fillStyle = withAlpha(visual.shadow, 0.28);
          this.ctx.beginPath();
          this.ctx.moveTo(peakX, peakY);
          this.ctx.lineTo(screenX + tileSize * 0.85, screenY + tileSize * 0.86);
          this.ctx.lineTo(screenX + tileSize * 0.50, screenY + tileSize * 0.64);
          this.ctx.closePath();
          this.ctx.fill();
        } else if (h(383) > 0.58) {
          this.tileRect(screenX, screenY, tileSize, 0.23, 0.55, 0.46, 0.05, withAlpha(visual.low, 0.28));
        }
        break;
      }

      case TerrainType.LAVA: {
        const pulse = 0.26 + (Math.sin(this.animTimer * 1.25 + x * 0.31 + y * 0.27) + 1) * 0.08;
        // One broad molten fissure, occasionally branched.
        this.tileRect(screenX, screenY, tileSize, 0.14, 0.45 + (h(390) - 0.5) * 0.12, 0.70, 0.055, withAlpha(visual.high, pulse));
        if (h(391) > 0.56) {
          this.tileRect(screenX, screenY, tileSize, 0.46, 0.30, 0.055, 0.38, withAlpha(visual.accent, pulse * 0.78));
        }
        break;
      }

      case TerrainType.ARCANE: {
        if (cluster > 0.52 && h(400) > 0.63) {
          const glow = 0.24 + h(401) * 0.12;
          this.tileRect(screenX, screenY, tileSize, 0.20 + h(402) * 0.52, 0.22 + h(403) * 0.48, 0.06, 0.06, withAlpha(visual.accent, glow));
        }
        break;
      }

      case TerrainType.CORRUPTED: {
        if (cluster > 0.44 && h(410) > 0.55) {
          this.tileRect(screenX, screenY, tileSize, 0.18 + h(411) * 0.16, 0.34 + h(412) * 0.30, 0.38, 0.045, withAlpha(visual.shadow, 0.31));
          if (h(413) > 0.76) {
            this.tileRect(screenX, screenY, tileSize, 0.60, 0.30 + h(414) * 0.34, 0.045, 0.26, withAlpha(visual.accent, 0.24));
          }
        }
        break;
      }
    }

    const accent = terrainAccentColor(tile, x, y, this.animTimer);
    if (accent && tileSize >= 9 && tile.type !== TerrainType.LAVA) {
      this.tileRect(
        screenX, screenY, tileSize,
        0.18 + h(450) * 0.60,
        0.18 + h(451) * 0.60,
        0.045, 0.045,
        withAlpha(accent, 0.46)
      );
    }
  }

  private renderOceanHorizon(
    tileMap: TileMap,
    camera: Camera,
    width: number,
    height: number,
    baseSX: number,
    baseSY: number,
    tileSize: number
  ): void {
    // Fill background with deep ocean base color
    this.ctx.fillStyle = '#0a2138';
    this.ctx.fillRect(0, 0, width, height);

    const topLeft = camera.screenToWorld(0, 0, width, height);
    const bottomRight = camera.screenToWorld(width, height, width, height);

    const screenMinX = Math.floor(topLeft.x);
    const screenMaxX = Math.ceil(bottomRight.x);
    const screenMinY = Math.floor(topLeft.y);
    const screenMaxY = Math.ceil(bottomRight.y);

    const oceanPadding = 40;
    const renderMinX = Math.max(-oceanPadding, screenMinX);
    const renderMaxX = Math.min(tileMap.width + oceanPadding - 1, screenMaxX);
    const renderMinY = Math.max(-oceanPadding, screenMinY);
    const renderMaxY = Math.min(tileMap.height + oceanPadding - 1, screenMaxY);

    for (let x = renderMinX; x <= renderMaxX; x++) {
      for (let y = renderMinY; y <= renderMaxY; y++) {
        if (x >= 0 && x < tileMap.width && y >= 0 && y < tileMap.height) continue;

        const sx = x * tileSize + baseSX;
        const sy = y * tileSize + baseSY;

        // Animated ocean horizon surface wave effect
        const wave = Math.sin((x * 0.35 + y * 0.35) + this.animTimer * 1.1);
        const color = wave > 0.45 ? '#18456c' : wave < -0.45 ? '#081a2d' : '#0e2b47';

        this.ctx.fillStyle = color;
        this.ctx.fillRect(sx, sy, tileSize + 0.5, tileSize + 0.5);
      }
    }
  }

  public render(
    camera: Camera,
    tileMap: TileMap,
    entities: Entity[],
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>,
    particles: ParticleManager,
    overlayMode: OverlayMode,
    currentEra: WorldEra,
    brushX: number | null,
    brushY: number | null,
    brushSize: number,
    ships?: Iterable<Ship>,
    caravans?: Iterable<OverlandCaravan>,
    railways?: { yearlyFreight: number },
    warFocus?: WarOverlayFocus | null,
    overlays?: OverlayManager,
    mapIntel?: MapIntelligenceSnapshot | null,
    entityIndex?: SpatialHash<Entity>
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.animTimer = (this.animTimer + 0.04) % 628.318;

    const tileSize = camera.tileSize * camera.zoom;
    const baseSX = width / 2 + camera.frameShakeX - camera.x * camera.zoom;
    const baseSY = height / 2 + camera.frameShakeY - camera.y * camera.zoom;

    // Render Infinite Deep Ocean Horizon background (eliminates black bars like WorldBox)
    this.renderOceanHorizon(tileMap, camera, width, height, baseSX, baseSY, tileSize);

    // Determine visible tile bounds
    const topLeft = camera.screenToWorld(0, 0, width, height);
    const bottomRight = camera.screenToWorld(width, height, width, height);

    const minX = Math.max(0, Math.floor(topLeft.x));
    const maxX = Math.min(tileMap.width - 1, Math.ceil(bottomRight.x));
    const minY = Math.max(0, Math.floor(topLeft.y));
    const maxY = Math.min(tileMap.height - 1, Math.ceil(bottomRight.y));
    const visibleEntities = entityIndex
      ? entityIndex.queryRect(minX - 2, minY - 2, maxX + 2, maxY + 2, this.visibleEntityScratch)
      : entities;
    perfProfiler.setCounter('visibleEntities', visibleEntities.length);
    perfProfiler.setCounter('approximateDrawCalls', (maxX - minX + 1) * (maxY - minY + 1) + visibleEntities.length + cities.size);

    // ========== 1. RENDER TERRAIN TILES ==========
    // Static (non-animated) terrain is baked into an offscreen canvas once and only
    // redrawn per dirty tile; the bake covers base+texture+relief+edges+details.
    // Animated water/lava and overlay modes fall back to per-tile drawing.
    // Analytical modes tint the baked terrain in later passes. Only the two
    // legacy terrain-replacement views need the slower per-tile path.
    const useBake = overlayMode !== 'biome' && overlayMode !== 'temperature';
    let animatedLayerBlitted = false;
    if (useBake) {
      this.ensureTerrainBake(tileMap);
      this.bakeDirtyTiles(tileMap);
      const tc = this.terrainCanvas!;
      const tsb = this.bakeTileSize;
      const srcX = minX * tsb;
      const srcY = minY * tsb;
      const srcW = (maxX - minX + 1) * tsb;
      const srcH = (maxY - minY + 1) * tsb;
      this.ctx.drawImage(
        tc,
        srcX, srcY, srcW, srcH,
        minX * tileSize + baseSX, minY * tileSize + baseSY,
        srcW * camera.zoom, srcH * camera.zoom
      );

      // The moving sea, on top of the static ground, in one more blit. When the
      // layer is not usable — world too big, or zoomed in past its resolution —
      // this stays false and the per-tile loop below does the work as before.
      animatedLayerBlitted = this.ensureAnimatedLayer(tileMap, minX, minY, maxX, maxY, tileSize);
      if (animatedLayerBlitted) {
        this.ctx.drawImage(
          this.animCanvas!,
          srcX, srcY, srcW, srcH,
          minX * tileSize + baseSX, minY * tileSize + baseSY,
          srcW * camera.zoom, srcH * camera.zoom
        );
      }
    }

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const tile = tileMap.grid[x][y];
        const sx = x * tileSize + baseSX;
        const sy = y * tileSize + baseSY;
        // Replacement overlays use the full path. Animated surfaces reuse the
        // cached base and receive only a cheap moving accent.
        if (!useBake) {
          this.drawTerrainTile(tileMap, tile, x, y, sx, sy, tileSize, overlayMode);
        } else if (animatedLayerBlitted) {
          // Already on screen, drawn into the layer and blitted above.
        } else if (tile.type === TerrainType.LAVA) {
          this.drawAnimatedTerrainAccent(tileMap, tile, x, y, sx, sy, tileSize);
        } else if (this.isWater(tile.type)) {
          // Open water with no edge and no possible movement is already drawn in
          // full by the bake underneath. Skipping it is the difference between
          // touching every tile of the sea each frame and touching only those
          // that have something to add.
          const mask = this.waterMask ? this.waterMask[x * this.terrainH + y] : (WATER_EDGED | WATER_ANIMATES);
          if (mask !== 0) this.drawAnimatedTerrainAccent(tileMap, tile, x, y, sx, sy, tileSize, mask);
        }

        // Roads are drawn afterwards as a connected network (drawRoadsPass),
        // never as a per-tile lattice — a lattice cannot express a curve.

        // Territory is painted afterwards, as a pass over the whole window:
        // how strongly a tile is tinted depends on how far it is from the
        // frontier, which no single tile can know about itself.

        // ===== SPECIES URBAN GRID CULTURE OVERLAY =====
        if (tile.cityId && cities.has(tile.cityId) && tileSize > 5) {
          const city = cities.get(tile.cityId)!;
          const speciesDef = SPECIES_DEFINITIONS[city.species];
          const gridStyle = speciesDef?.urbanGridStyle;
          const dx = x - city.x;
          const dy = y - city.y;

          if (gridStyle === 'concentric_rings') {
            // Lumini: Radial Golden Rings & Sunbeam Avenues
            const dist = Math.hypot(dx, dy);
            if (Math.abs(dist - Math.round(dist)) < 0.2 || dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
              this.ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
              this.ctx.fillRect(sx, sy, tileSize, tileSize);
            }
          } else if (gridStyle === 'orthogonal_citadel') {
            // Stonekin: Square Citadel Blocks
            if (dx % 2 === 0 || dy % 2 === 0) {
              this.ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
              this.ctx.fillRect(sx, sy, tileSize, tileSize);
            }
          } else if (gridStyle === 'diagonal_chevron') {
            // Emberkin: Diagonal Chevron Diamonds
            if (Math.abs(dx) === Math.abs(dy) || (dx + dy) % 3 === 0) {
              this.ctx.fillStyle = 'rgba(249, 115, 22, 0.22)';
              this.ctx.fillRect(sx, sy, tileSize, tileSize);
            }
          } else if (gridStyle === 'organic_canopy') {
            // Sylvanii: Organic Emerald Boardwalks
            if ((dx * dx + dy * dy) % 3 === 0) {
              this.ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
              this.ctx.fillRect(sx, sy, tileSize, tileSize);
            }
          }
        }

        if (!animatedLayerBlitted) this.drawTileDecoration(tile, x, y, sx, sy, tileSize);

        // Fire overlay
        if (tile.isOnFire) {
          const fireSprite = SpriteRegistry.get('fx_fire');
          if (fireSprite) {
            // Flickering animation
            const flicker = Math.sin(this.animTimer * 8 + x * 2 + y * 3) > 0;
            this.ctx.globalAlpha = flicker ? 1.0 : 0.75;
            this.ctx.drawImage(fireSprite, sx, sy - tileSize * 0.3, tileSize, tileSize * 1.3);
            this.ctx.globalAlpha = 1.0;
          } else {
            this.ctx.fillStyle = Math.random() < 0.5 ? '#ef4444' : '#f59e0b';
            this.ctx.fillRect(sx, sy, tileSize, tileSize);
          }

          // Glow gradient
          if (tileSize > 8) {
            const grad = this.ctx.createRadialGradient(
              sx + tileSize / 2, sy + tileSize / 2, 2,
              sx + tileSize / 2, sy + tileSize / 2, tileSize * 1.5
            );
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
            grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(sx + tileSize / 2, sy + tileSize / 2, tileSize * 1.5, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }
    }

    // ========== 1a. KINGDOM TERRITORY ==========
    this.drawTerritoryPass(tileMap, minX, maxX, minY, maxY, tileSize, baseSX, baseSY, kingdoms, overlayMode, warFocus, overlays, mapIntel);

    // ========== 1aa. PRIMARY ANALYTICAL MODE ==========
    if (mapIntel && (overlayMode === 'population' || overlayMode === 'economy')) {
      this.drawCityHeatOverlay(camera, width, height, tileSize, mapIntel.cities, overlayMode, overlays);
    }
    if (overlayMode === 'resources') {
      this.drawResourceOverlay(tileMap, minX, maxX, minY, maxY, tileSize, baseSX, baseSY, overlays?.resourceGood ?? 'all');
    }

    // ========== 1b. ROAD NETWORK POLYLINES (A+C+E) ==========
    this.drawRoadsPass(tileMap, minX, maxX, minY, maxY, tileSize, baseSX, baseSY, cities, kingdoms);

    // ========== 1c. RAILWAYS ==========
    this.drawRailwaysPass(tileMap, minX, maxX, minY, maxY, tileSize, baseSX, baseSY, !!railways && railways.yearlyFreight > 0);

    // ========== 1d. COMBINABLE WORLD-INTELLIGENCE LAYERS ==========
    if (overlays) {
      this.drawInfrastructureIntelligence(tileMap, minX, maxX, minY, maxY, tileSize, baseSX, baseSY, overlays, mapIntel);
      if (overlays.layers.has('trade') && mapIntel) this.drawTradeOverlay(camera, width, height, tileSize, mapIntel);
      if (overlays.layers.has('armies')) this.drawArmyOverlay(camera, width, height, tileSize, tileSize < 4 ? entities : visibleEntities, kingdoms);
    }

    // ========== 2. RENDER BUILDINGS (LOD medium+) ==========
    for (const city of cities.values()) {
      const k = city.kingdomId && kingdoms.has(city.kingdomId) ? kingdoms.get(city.kingdomId)! : null;
      this.drawCityMacroPresence(city, k, camera, width, height, tileSize);
      if (tileSize >= 5) {
        this.drawCityUrbanPattern(city, k, camera, width, height, tileSize);
        this.drawCityInfrastructureLinks(city, camera, width, height, tileSize);
      }
      if (tileSize < 5) continue; // far zoom: only macro silhouette
      for (const b of city.buildings.values()) {
        if (b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY) {
          const screenPos = camera.worldToScreen(b.x, b.y, width, height);
          const era = k ? k.research.currentEra() : 'stone';
          this.drawBuildingLotBackdrop(city, b, k, screenPos, tileSize);
          this.drawSpecialBuildingGroundworks(city, b, k, screenPos, tileSize, era);
          this.drawLandmarkPresence(city, b, k, screenPos, tileSize);

          // Building Drop Shadow
          // Sized against the sprite, not the tile: a shadow wider than the
          // building it belongs to is what made small buildings look smudged.
          const shadowW = tileSize * 0.9 * BUILDING_DRAW_SCALE;
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          this.ctx.fillRect(
            screenPos.x + (tileSize - shadowW) * 0.5,
            screenPos.y + tileSize * 0.72,
            shadowW,
            tileSize * 0.26
          );

          // V4 architecture composer: the sprite now reflects the real building
          // level, damage, staffing, extracted resource, era and city species.
          const hpRatio = b.maxHp > 0 ? b.hp / b.maxHp : 1;
          const sprite = SpriteGenerator.getBuildingSprite(b.type, {
            species: city.species,
            era,
            level: b.level,
            hpRatio,
            staffing: b.staffing,
            extractedGood: b.extractedGood,
            prosperity: city.prosperity,
            tier: city.tier,
            population: city.population,
            isCapital: !!k && k.capitalCityId === city.id
          });

          const baseScale = b.level >= 3 ? 1.12 : b.level === 2 ? 1.06 : 1;
          const landmarkBoost = this.isLandmark(b.type) ? 0.10 : 0;
          const capitalBoost = !!k && k.capitalCityId === city.id && ['town_center', 'palace', 'keep'].includes(b.type) ? 0.07 : 0;
          // Shared with the WebGPU path so the two renderers cannot disagree
          // about how much of a plot a building covers. See BUILDING_DRAW_SCALE.
          const levelScale = (baseScale + landmarkBoost + capitalBoost) * BUILDING_DRAW_SCALE;
          const drawW = tileSize * levelScale;
          const drawH = tileSize * 1.15 * levelScale;
          const drawX = screenPos.x - (drawW - tileSize) * 0.5;
          const drawY = screenPos.y - tileSize * 0.15 - (drawH - tileSize * 1.15);
          this.ctx.drawImage(sprite, drawX, drawY, drawW, drawH);

          this.drawBuildingAmbientEffects(b, particles);

          // Realm standards mark seats of government and major fortifications.
          if (k && (b.type === 'town_center' || b.type === 'palace' || b.type === 'keep')) {
            const bannerHeight = b.type === 'palace' ? tileSize * 0.72 : tileSize * 0.6;
            this.ctx.fillStyle = '#78350f';
            this.ctx.fillRect(screenPos.x + tileSize - 3, screenPos.y - tileSize * 0.52, 2, bannerHeight);
            const flagWave = Math.sin(this.animTimer * 4 + b.x * 0.7 + b.y) * 1;
            this.ctx.fillStyle = k.color;
            this.ctx.fillRect(screenPos.x + tileSize - 12 + flagWave, screenPos.y - tileSize * 0.52, 9, 6);
            this.ctx.fillStyle = k.secondaryColor;
            this.ctx.fillRect(screenPos.x + tileSize - 12 + flagWave, screenPos.y - tileSize * 0.52 + 2, 9, 2);
          }

          // Damaged buildings expose their actual condition instead of looking
          // pristine until they disappear. Health bars only appear when useful.
          if (hpRatio < 0.9 && tileSize > 8) {
            const barW = tileSize * 0.82;
            const barX = screenPos.x + (tileSize - barW) * 0.5;
            const barY = screenPos.y - tileSize * 0.28;
            this.ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            this.ctx.fillRect(barX, barY, barW, 3);
            this.ctx.fillStyle = hpRatio > 0.55 ? '#f59e0b' : '#ef4444';
            this.ctx.fillRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * hpRatio), 1);
          }
        }
      }
    }

    // ========== 3. RENDER ENTITIES (LOD medium+) ==========
    if (tileSize < 6) { 
      // far zoom: no individual entities
    } else for (const e of visibleEntities) {
      if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) {
        const screenPos = camera.worldToScreen(e.x, e.y, width, height);

        const idHash = parseInt(e.id.slice(-4) || '0', 16);
        const safeHash = Number.isNaN(idHash) ? 0 : idHash;
        const movement = Math.hypot(e.x - e.prevX, e.y - e.prevY);
        // Teleports — a respawn, a load, a camera jump — must not be counted
        // as ground walked, or the legs spin up for a step that never happened.
        if (movement < 0.5) e.renderWalked += movement;
        const isMoving = movement > 0.0005 || (e.targetX !== null && e.targetY !== null && e.aiState !== 'idle');
        const direction = this.getEntityDirection(e, isMoving);
        const animation = this.getEntityAnimation(e, isMoving);
        const frame = this.getAnimationFrame(e, animation, safeHash);
        // The body's bob rides the same stride as the feet, so a citizen
        // bounces once per step instead of at a rate of its own. Amplitude
        // scales with how fast they're actually covering ground this frame —
        // easing to a stop at the doorway shouldn't still bounce at a full
        // sprint's height.
        const bobScale = Math.max(0.4, Math.min(1.6, movement / 0.05));
        const bob = (animation === 'walk' || animation === 'flee' || animation === 'carry')
          ? Math.sin((e.renderWalked / PixelRenderer.STRIDE_TILES) * Math.PI * 2 + safeHash) * 1.2 * bobScale
          : 0;
        const breathe = animation === 'idle' ? Math.sin(this.animTimer * 2.2 + safeHash * 0.01) * 0.45 : 0;
        const entitySize = tileSize;
        const ageScale = e.lifeStage === 'infant' ? 0.52
          : e.lifeStage === 'child' ? 0.70
          : e.lifeStage === 'adolescent' ? 0.86
          : 1.0;
        const speciesScale = e.species === SpeciesType.DRAGON ? 1.45
          : e.species === SpeciesType.BEAR ? 1.22
          : e.species === SpeciesType.DEER || e.species === SpeciesType.WOLF ? 1.05
          : 1.12;
        const spriteSize = entitySize * speciesScale * ageScale;
        const centerX = screenPos.x + entitySize / 2;
        const centerY = screenPos.y + entitySize * 0.55;
        const spriteX = centerX - spriteSize / 2;
        const spriteY = screenPos.y + entitySize * 0.98 - spriteSize + bob + breathe;

        // Great-person aura sits behind the body instead of washing over the sprite.
        if (e.isGreatPerson) {
          const goldGlow = 0.16 + Math.sin(this.animTimer * 4 + safeHash * 0.01) * 0.06;
          this.ctx.fillStyle = `rgba(251, 191, 36, ${goldGlow})`;
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, tileSize * 0.78, 0, Math.PI * 2);
          this.ctx.fill();
        }

        this.ctx.fillStyle = e.species === SpeciesType.DRAGON ? 'rgba(0, 0, 0, 0.36)' : 'rgba(0, 0, 0, 0.28)';
        this.ctx.beginPath();
        this.ctx.ellipse(
          centerX,
          screenPos.y + entitySize * 0.88,
          entitySize * (e.species === SpeciesType.DRAGON ? 0.58 : 0.35),
          entitySize * (e.species === SpeciesType.BEAR ? 0.16 : 0.12),
          0, 0, Math.PI * 2
        );
        this.ctx.fill();

        if (animation === 'heal' || animation === 'flee' || animation === 'socialize') {
          this.drawEntityActionEffects(e, centerX, centerY, entitySize, direction, animation, frame);
        }

        const sprite = SpriteGenerator.getEntitySprite(e.species, direction, animation, frame, {
          // The id never changes, so a person keeps the same face and clothes
          // for their whole life — and across every replay of the same seed.
          appearanceSeed: e.id,
          profession: e.profession,
          weaponName: e.equipment.weapon?.name,
          weaponCategory: e.equipment.weapon?.category,
          armorName: e.equipment.armor?.name,
          isGreatPerson: e.isGreatPerson,
          greatPersonType: e.greatPersonType
        });
        this.ctx.drawImage(sprite, spriteX, spriteY, spriteSize, spriteSize);

        if (animation === 'attack' || animation === 'shoot' || animation === 'gather' || animation === 'build') {
          this.drawEntityActionEffects(e, centerX, centerY, entitySize, direction, animation, frame);
        }

        // Kingdom-colored outline for humanoid species
        if (e.kingdomId && kingdoms.has(e.kingdomId) && tileSize > 8) {
          const k = kingdoms.get(e.kingdomId)!;
          const rgb = this.hexToRgb(k.color);
          this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(spriteX + spriteSize * 0.18, spriteY + spriteSize * 0.18, spriteSize * 0.64, spriteSize * 0.72);
        }

        if (e.profession === 'king') {
          const crownSize = Math.max(7, Math.floor(tileSize * 0.45));
          this.drawPixelCrown(centerX - crownSize / 2, spriteY - crownSize * 0.35, crownSize);
        }


        // Equipment is now rendered inside the cached entity sprite, so it follows
        // direction, animation and the actual item category instead of floating beside it.

        // Health Bar if Damaged
        if (this.options.showHealthBars && e.hp < e.maxHp) {
          const barW = tileSize;
          const barH = Math.max(2, tileSize * 0.12);
          const hpRatio = Math.max(0, e.hp / e.maxHp);
          const barX = screenPos.x;
          const barY = spriteY - 4;

          // Background
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          this.ctx.fillRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);
          // HP fill
          const hpColor = hpRatio > 0.5 ? '#10b981' : (hpRatio > 0.2 ? '#f59e0b' : '#ef4444');
          this.ctx.fillStyle = hpColor;
          this.ctx.fillRect(barX, barY, barW * hpRatio, barH);
        }

        // Floating Emote Pixel-Art Icon Bubble
        if (e.emote && e.emoteTimer > 0 && tileSize > 6) {
          const emoteSize = Math.max(12, Math.floor(tileSize * 0.65));
          const icon = PixelIcons.getIcon(e.emote);
          this.ctx.drawImage(icon, centerX - emoteSize / 2, spriteY - emoteSize, emoteSize, emoteSize);
        }

        if (e.isGreatPerson) {
          const starSize = Math.max(8, tileSize * 0.4);
          this.drawPixelStar(centerX - starSize / 2, spriteY - starSize * 0.8, starSize);
        }

        if (e.isFavorite) {
          const starSize = Math.max(7, tileSize * 0.34);
          this.drawPixelStar(centerX - starSize / 2, screenPos.y + entitySize + 2, starSize);
        }
      }
    }

    // ========== 3c. NAVAL SHIPS & CARAVANS ==========
    if (ships && tileSize >= 5) {
      for (const ship of ships) {
        if (ship.x < minX || ship.x > maxX || ship.y < minY || ship.y > maxY) continue;
        const screenPos = camera.worldToScreen(ship.x, ship.y, width, height);
        const shipSize = Math.max(16, tileSize * 1.3);

        // Animated water wake behind ship
        const wakeRadius = Math.max(4, tileSize * 0.45);
        const wakeX = screenPos.x + (ship.direction > 0 ? -4 : shipSize + 4);
        const wakeY = screenPos.y + shipSize * 0.65;
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
        this.ctx.beginPath();
        this.ctx.arc(wakeX, wakeY, wakeRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Pixel-Art Ship Sprite
        const spriteKey = `ship_tier_${ship.tier}`;
        const sprite = SpriteGenerator.has(spriteKey)
          ? SpriteGenerator.getSprite(spriteKey, () => {}, 24, 24)
          : SpriteGenerator.getSprite('ship_tier_1', () => {}, 64, 64);

        this.ctx.save();
        if (ship.direction < 0) {
          this.ctx.translate(screenPos.x + shipSize, screenPos.y);
          this.ctx.scale(-1, 1);
          this.ctx.drawImage(sprite, 0, 0, shipSize, shipSize);
        } else {
          this.ctx.drawImage(sprite, screenPos.x, screenPos.y, shipSize, shipSize);
        }
        this.ctx.restore();

        // Kingdom Flag Banner on Mast
        if (tileSize > 6) {
          const flagX = screenPos.x + shipSize * 0.45;
          const flagY = screenPos.y - 4;
          const flagWave = Math.sin(this.animTimer * 5 + ship.x) * 1.2;
          this.ctx.fillStyle = ship.kingdomColor ?? '#fbbf24';
          this.ctx.fillRect(flagX + flagWave, flagY, 9, 6);
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(flagX + flagWave, flagY, 9, 6);
        }
      }
    }

    // ========== 3d. OVERLAND CARAVANS ==========
    if (caravans && tileSize >= 4) {
      for (const caravan of caravans) {
        if (caravan.x < minX || caravan.x > maxX || caravan.y < minY || caravan.y > maxY) continue;
        const screenPos = camera.worldToScreen(caravan.x, caravan.y, width, height);
        const caravanSize = Math.max(14, tileSize * 1.15);
        // The animal stands *on* the point it occupies. Anchoring the sprite's
        // corner there, as this used to, left it standing half a tile off the
        // road it was supposed to be walking down.
        const footX = screenPos.x + tileSize * 0.5;
        const footY = screenPos.y + tileSize * 0.5;
        const drawX = footX - caravanSize * 0.5;
        const drawY = footY - caravanSize * 0.94;

        // Which side of the animal is toward the camera, from where it is
        // actually pointing: away up the road, toward the camera coming down
        // it, and side-on across it — with the left side being the right side
        // mirrored, exactly as the animal itself is.
        const hx = caravan.headingX;
        const hy = caravan.headingY;
        const view: CaravanView = Math.abs(hx) > Math.abs(hy) ? 'side' : hy < 0 ? 'back' : 'front';
        // The gait is measured in ground covered, never in wall-clock time, so
        // the legs cannot outrun the movement however the road and the terrain
        // are scaling it.
        const walked = caravan.progress * caravan.routeTiles;
        const frame = Math.floor(walked / (STRIDE_TILES[caravan.caravanType] / CARAVAN_FRAMES));
        const sprite = caravanSprite(caravan.caravanType, view, frame);

        this.ctx.save();
        this.ctx.imageSmoothingEnabled = caravanSize < CARAVAN_PX * 0.75;
        if (view === 'side' && hx < 0) {
          this.ctx.translate(drawX + caravanSize, drawY);
          this.ctx.scale(-1, 1);
          this.ctx.drawImage(sprite, 0, 0, caravanSize, caravanSize);
        } else {
          this.ctx.drawImage(sprite, drawX, drawY, caravanSize, caravanSize);
        }
        this.ctx.restore();

        // Dust kicked up behind it, on the side it came from — only on a dirt
        // road, because that is the only surface that gives any up.
        const dustTile = tileMap.getTile(Math.floor(caravan.x), Math.floor(caravan.y));
        if (tileSize > 6 && dustTile && dustTile.roadLevelEffective <= 1) {
          const puff = 0.6 + Math.sin(walked * 7) * 0.2;
          this.ctx.fillStyle = 'rgba(180, 150, 105, 0.24)';
          this.ctx.beginPath();
          this.ctx.arc(footX - hx * caravanSize * 0.4, footY - hy * caravanSize * 0.18,
            caravanSize * 0.16 * puff, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // Kingdom Banner on Pack Saddle
        if (tileSize > 6) {
          this.ctx.fillStyle = caravan.kingdomColor ?? '#fbbf24';
          this.ctx.fillRect(footX - 3, drawY + caravanSize * 0.06, 7, 4);
        }
      }
    }

    // ========== 3a. SIEGE RINGS ==========
    // A besieged settlement gets a pulsing red ring so the player can see where
    // a war is actually being decided, not just that one was declared.
    if (tileSize >= 5) {
      for (const city of cities.values()) {
        if (!city.besiegerId) continue;
        if (city.x < minX - 8 || city.x > maxX + 8 || city.y < minY - 8 || city.y > maxY + 8) continue;

        const screenPos = camera.worldToScreen(city.x, city.y, width, height);
        const centerX = screenPos.x + tileSize / 2;
        const centerY = screenPos.y + tileSize / 2;
        const radius = 7 * tileSize;
        const pulse = 0.45 + Math.sin(this.animTimer * 4) * 0.2;

        this.ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
        this.ctx.lineWidth = Math.max(1.5, tileSize * 0.12);
        this.ctx.setLineDash([tileSize * 0.5, tileSize * 0.4]);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Progress arc: how close the walls are to falling.
        if (city.siegeProgress > 0) {
          this.ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
          this.ctx.lineWidth = Math.max(2, tileSize * 0.2);
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, city.siegeProgress));
          this.ctx.stroke();
        }
      }
    }

    // ========== 3b. CITY NAME LABELS ==========
    if (this.options.showCityNames && (overlays?.layers.has('city-labels') ?? true) && tileSize > 2.4) {
      const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
      this.ctx.textAlign = 'center';
      for (const city of cities.values()) {
        if (city.x < minX || city.x > maxX || city.y < minY || city.y > maxY) continue;
        const realm = city.kingdomId ? kingdoms.get(city.kingdomId) : null;
        const capital = realm?.capitalCityId === city.id;
        if (tileSize < 4 && !capital && city.population < 35) continue;
        if (tileSize < 6 && !capital && city.population < 12) continue;
        const screenPos = camera.worldToScreen(city.x, city.y, width, height);
        const k = realm;
        const fontSize = Math.max(9, Math.min(13, tileSize * 0.6));

        const labelX = screenPos.x + tileSize / 2;
        const labelY = screenPos.y + tileSize * 1.6;

        this.ctx.font = `600 ${fontSize}px 'Outfit', sans-serif`;
        const labelW = this.ctx.measureText(city.name).width + 8;
        const box = { x: labelX - labelW / 2, y: labelY - fontSize, w: labelW, h: fontSize * 2.1 };
        if (occupied.some(other => box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y)) continue;
        occupied.push(box);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillText(city.name, labelX + 1, labelY + 1);
        this.ctx.fillStyle = k ? k.secondaryColor : '#e2e8f0';
        this.ctx.fillText(city.name, labelX, labelY);

        // Population count under the name
        this.ctx.font = `${Math.max(8, fontSize * 0.75)}px 'Outfit', sans-serif`;
        this.ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
        this.ctx.fillText(`${city.population}`, labelX, labelY + fontSize);
      }
      this.ctx.textAlign = 'start';
    }

    // ========== 4. RENDER PARTICLES & DAMAGE NUMBERS ==========
    if (this.options.showParticles) for (const p of particles.activeParticles) {
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
        const screenPos = camera.worldToScreen(p.x, p.y, width, height);
        this.ctx.globalAlpha = p.alpha;

        if (p.text) {
          this.ctx.font = 'bold 12px var(--font-mono)';
          this.ctx.fillStyle = p.color;
          // Text shadow
          this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
          this.ctx.fillText(p.text, screenPos.x + 1, screenPos.y + 1);
          this.ctx.fillStyle = p.color;
          this.ctx.fillText(p.text, screenPos.x, screenPos.y);
        } else {
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(screenPos.x, screenPos.y, p.size, p.size);
        }

        this.ctx.globalAlpha = 1.0;
      }
    }

    // ========== 4.1 RENDER FLYING PROJECTILES (Arrows, Bullets, Cannonballs, Spears) ==========
    if (this.options.showParticles && particles.activeProjectiles) {
      for (const proj of particles.activeProjectiles) {
        if (proj.x >= minX - 2 && proj.x <= maxX + 2 && proj.y >= minY - 2 && proj.y <= maxY + 2) {
          const arcOffset = proj.arcHeight ? Math.sin(proj.progress * Math.PI) * proj.arcHeight : 0;
          const screenPos = camera.worldToScreen(proj.x, proj.y - arcOffset, width, height);

          this.ctx.save();
          const angle = Math.atan2(proj.targetY - proj.startY, proj.targetX - proj.startX);

          if (proj.type === 'arrow') {
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(angle);
            this.ctx.strokeStyle = '#78350f';
            this.ctx.lineWidth = Math.max(1.5, tileSize * 0.12);
            this.ctx.beginPath();
            this.ctx.moveTo(-6, 0);
            this.ctx.lineTo(6, 0);
            this.ctx.stroke();
            this.ctx.fillStyle = '#e2e8f0';
            this.ctx.fillRect(4, -1.5, 3, 3);
          } else if (proj.type === 'bullet') {
            this.ctx.strokeStyle = '#fde047';
            this.ctx.lineWidth = Math.max(2, tileSize * 0.15);
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x - Math.cos(angle) * 8, screenPos.y - Math.sin(angle) * 8);
            this.ctx.lineTo(screenPos.x, screenPos.y);
            this.ctx.stroke();
          } else if (proj.type === 'cannonball') {
            const r = Math.max(3, tileSize * 0.25);
            this.ctx.fillStyle = '#1e293b';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#475569';
            this.ctx.stroke();
          } else if (proj.type === 'spear_thrust') {
            this.ctx.translate(screenPos.x, screenPos.y);
            this.ctx.rotate(angle);
            this.ctx.fillStyle = '#cbd5e1';
            this.ctx.fillRect(-2, -1.5, 8, 3);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(4, -1, 3, 2);
          } else {
            this.ctx.fillStyle = proj.color;
            this.ctx.fillRect(screenPos.x - 2, screenPos.y - 2, 4, 4);
          }

          this.ctx.restore();
        }
      }
    }

    // ========== 5. FLOATING KINGDOM BADGES (WorldBox-style) ==========
    if (this.options.showKingdomBadges && tileSize > 3) {
      for (const kingdom of kingdoms.values()) {
        if (kingdom.cityIds.size === 0) continue;

        // Use cached kingdom center
        const center = kingdom.cachedCenter;
        if (center.x < minX || center.x > maxX || center.y < minY || center.y > maxY) continue;

        const screenCenter = camera.worldToScreen(center.x, center.y, width, height);

        // Floating bounce animation
        const floatY = Math.sin(this.animTimer * 1.5 + center.x * 0.1) * 3;
        const badgeX = screenCenter.x;
        const badgeY = screenCenter.y - tileSize * 2 + floatY;

        // Measure text
        const fontSize = Math.max(10, Math.min(14, tileSize * 0.7));
        this.ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
        const textWidth = this.ctx.measureText(kingdom.name).width;
        const badgeW = textWidth + 32;
        const badgeH = fontSize + 12;

        // Badge background (glassmorphic pill)
        const rgb = this.hexToRgb(kingdom.color);
        this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.75)`;
        const bx = badgeX - badgeW / 2;
        const by = badgeY - badgeH / 2;
        this.ctx.beginPath();
        this.ctx.roundRect(bx, by, badgeW, badgeH, badgeH / 2);
        this.ctx.fill();

        // Badge border glow
        this.ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 60)}, ${Math.min(255, rgb.g + 60)}, ${Math.min(255, rgb.b + 60)}, 0.6)`;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Pixel-Art Emblem icon
        const emblemIcon = PixelIcons.getIcon(kingdom.emblem);
        const iconSize = Math.max(12, fontSize);
        this.ctx.drawImage(emblemIcon, bx + 5, badgeY - iconSize / 2, iconSize, iconSize);

        // Kingdom name text
        this.ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(kingdom.name, bx + iconSize + 10, badgeY + fontSize * 0.35);
        this.ctx.textAlign = 'start';

        // War indicator: crossed swords pixel icon if at war
        if (this.diplomacy) {
          const wars = this.diplomacy.getWarsFor(kingdom.id);
          if (wars.length > 0) {
            // Red pulsing war indicator
            const warPulse = Math.sin(this.animTimer * 5) * 0.3 + 0.7;
            this.ctx.globalAlpha = warPulse;
            const warIcon = PixelIcons.getIcon('swords');
            this.ctx.drawImage(warIcon, bx + badgeW - iconSize - 4, badgeY - iconSize / 2, iconSize, iconSize);
            this.ctx.globalAlpha = 1.0;
          }
        }

        // Connection line from badge to territory center
        this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(badgeX, by + badgeH);
        this.ctx.lineTo(screenCenter.x, screenCenter.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    }

    // ========== 6. ERA VIGNETTE ==========
    if (currentEra === WorldEra.AGE_OF_ASHES) {
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
      this.ctx.fillRect(0, 0, width, height);
    } else if (currentEra === WorldEra.FROZEN_AGE) {
      this.ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      this.ctx.fillRect(0, 0, width, height);
    } else if (currentEra === WorldEra.DARK_AGE) {
      this.ctx.fillStyle = 'rgba(88, 28, 135, 0.1)';
      this.ctx.fillRect(0, 0, width, height);
    }

    // ========== 6b. TILE GRID ==========
    if (this.options.showGrid && tileSize >= 6) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      for (let x = minX; x <= maxX + 1; x++) {
        const sx = Math.round(camera.worldToScreen(x, minY, width, height).x) + 0.5;
        this.ctx.moveTo(sx, camera.worldToScreen(x, minY, width, height).y);
        this.ctx.lineTo(sx, camera.worldToScreen(x, maxY + 1, width, height).y);
      }
      for (let y = minY; y <= maxY + 1; y++) {
        const sy = Math.round(camera.worldToScreen(minX, y, width, height).y) + 0.5;
        this.ctx.moveTo(camera.worldToScreen(minX, y, width, height).x, sy);
        this.ctx.lineTo(camera.worldToScreen(maxX + 1, y, width, height).x, sy);
      }
      this.ctx.stroke();
    }

    // ========== 6c. WAR FOCUS ==========
    if (overlayMode === 'war' && warFocus) this.drawWarFocus(camera, width, height, tileSize, entities, cities, kingdoms, warFocus);

    // ========== 7. SELECTION ==========
    if (this.selection) this.drawSelectionMark(camera, width, height, tileSize);

    // ========== 8. BRUSH CURSOR ==========
    if (this.options.showBrushCursor && brushX !== null && brushY !== null) {
      const screenPos = camera.worldToScreen(brushX, brushY, width, height);
      const brushRadiusPx = brushSize * tileSize;

      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, brushRadiusPx, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 4]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  /** Focus marks for UI-9. Purely visual: all subjects come from the dossier. */
  private drawWarFocus(
    camera: Camera,
    width: number,
    height: number,
    tileSize: number,
    entities: Entity[],
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>,
    focus: WarOverlayFocus
  ): void {
    const ctx = this.ctx;
    const entityIds = new Set(focus.entityIds);
    const cityIds = new Set(focus.cityIds);
    const participantIds = new Set(focus.participantIds);
    const pulse = 0.72 + Math.sin(this.animTimer * 3.2) * 0.2;
    ctx.save();

    // Combatants remain individually legible at close zoom, while far zoom
    // collapses them into a sparse constellation instead of a solid wash.
    if (tileSize >= 4) {
      for (const entity of entities) {
        if (!entityIds.has(entity.id)) continue;
        const pos = camera.worldToScreen(entity.x, entity.y, width, height);
        const color = entity.kingdomId ? kingdoms.get(entity.kingdomId)?.color ?? '#f8fafc' : '#f8fafc';
        ctx.globalAlpha = pulse;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(pos.x + tileSize * 0.38), Math.round(pos.y - Math.max(3, tileSize * 0.35)), Math.max(2, tileSize * 0.18), Math.max(2, tileSize * 0.18));
      }
    }

    for (const city of cities.values()) {
      if (!cityIds.has(city.id)) continue;
      const pos = camera.worldToScreen(city.x, city.y, width, height);
      const color = city.besiegerId ? '#ef4444' : city.kingdomId && participantIds.has(city.kingdomId) ? kingdoms.get(city.kingdomId)?.color ?? '#fbbf24' : '#fbbf24';
      const radius = Math.max(10, tileSize * 1.35);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, tileSize * 0.12);
      ctx.setLineDash([Math.max(3, tileSize * 0.35), Math.max(3, tileSize * 0.25)]);
      ctx.beginPath();
      ctx.arc(pos.x + tileSize / 2, pos.y + tileSize / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    for (const point of focus.points) {
      const pos = camera.worldToScreen(point.x, point.y, width, height);
      const color = point.kind === 'siege' ? '#ef4444' : point.kind === 'engagement' ? '#f59e0b' : point.kind === 'infrastructure' ? '#c084fc' : '#38bdf8';
      const radius = Math.max(12, tileSize * (point.kind === 'engagement' ? 1.8 : 1.45));
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, tileSize * 0.14);
      ctx.beginPath();
      ctx.arc(pos.x + tileSize / 2, pos.y + tileSize / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x + tileSize / 2 - radius * 0.5, pos.y + tileSize / 2);
      ctx.lineTo(pos.x + tileSize / 2 + radius * 0.5, pos.y + tileSize / 2);
      ctx.moveTo(pos.x + tileSize / 2, pos.y + tileSize / 2 - radius * 0.5);
      ctx.lineTo(pos.x + tileSize / 2, pos.y + tileSize / 2 + radius * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * The selection ring.
   *
   * Answers one question — "what did I just click?" — and then gets out of the
   * way. Which is why it is a thin bracketed ring rather than a filled overlay:
   * the thing being marked is pixel art, and covering it in a tinted wash is how
   * you make the player unable to see what they selected.
   *
   * Four corner brackets rather than a full circle. A closed ring reads as a
   * radius of effect — the brush cursor already uses one, and the two must not
   * be confusable.
   */
  private drawSelectionMark(camera: Camera, width: number, height: number, tileSize: number): void {
    const mark = this.selection!;
    const ctx = this.ctx;
    const pos = camera.worldToScreen(mark.x, mark.y, width, height);
    const r = Math.max(9, mark.radius * tileSize);

    // A slow pulse, so the ring is findable on a busy map without flashing.
    const pulse = 0.72 + 0.28 * Math.sin(this.animTimer * 2.2);
    // Bracket arms scale with the ring but stay a usable length when zoomed out.
    const arm = Math.max(4, r * 0.34);

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = mark.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt';

    // Snapped to whole pixels: a 2px stroke on a half-pixel boundary renders as
    // two grey lines, which looks like a bug next to crisp pixel art.
    const cx = Math.round(pos.x);
    const cy = Math.round(pos.y);
    const d = Math.round(r);

    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = cx + sx * d;
      const y = cy + sy * d;
      ctx.moveTo(x, y);
      ctx.lineTo(x - sx * arm, y);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - sy * arm);
    }
    ctx.stroke();

    // A caption, only when there is room for it to be legible.
    if (mark.label && tileSize >= 6) {
      ctx.globalAlpha = 1;
      ctx.font = '600 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const ty = cy + d + 5;
      const textWidth = ctx.measureText(mark.label).width;

      // Drawn on its own plate: light text over bright terrain is unreadable, and
      // a stroke outline on pixel art looks like a sticker.
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = '#100e0c';
      ctx.fillRect(cx - textWidth / 2 - 4, ty - 2, textWidth + 8, 15);
      ctx.globalAlpha = 1;
      ctx.fillStyle = mark.color;
      ctx.fillText(mark.label, cx, ty);
    }

    ctx.restore();
  }

  /**
   * Railways drawn as real track: a ballast bed, perpendicular wooden ties, and
   * two parallel steel rails riding on top — the classic top-down look, not a
   * single blurred stripe. City-owned rail tiles get a small station marker so
   * a line visibly plugs into the settlement instead of stopping in a field.
   * The locomotive only runs when `hasActiveFreight` is true — tied to real
   * freight moved this year (see RailwayNetwork.yearlyFreight), so a train is
   * never decoration for a network that is not actually carrying anything.
   */
  private drawRailwaysPass(
    tileMap: TileMap,
    minX: number, maxX: number, minY: number, maxY: number,
    tileSize: number, baseSX: number, baseSY: number,
    hasActiveFreight: boolean
  ): void {
    if (tileSize < 3) return;
    const ctx = this.ctx;

    const railTiles: { x: number; y: number }[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const t = tileMap.grid[x][y];
        if (t.railLevelEffective > 0) railTiles.push({ x, y });
      }
    }
    if (railTiles.length === 0) return;

    const cxx = (x: number): number => x * tileSize + baseSX + tileSize / 2;
    const cyy = (y: number): number => y * tileSize + baseSY + tileSize / 2;

    interface RailSeg { x1: number; y1: number; x2: number; y2: number; nx: number; ny: number; len: number }
    const segs: RailSeg[] = [];
    for (const r of railTiles) {
      const e = tileMap.getTile(r.x + 1, r.y);
      if (e && e.railLevelEffective > 0) {
        segs.push({ x1: cxx(r.x), y1: cyy(r.y), x2: cxx(r.x + 1), y2: cyy(r.y), nx: 0, ny: -1, len: tileSize });
      }
      const s = tileMap.getTile(r.x, r.y + 1);
      if (s && s.railLevelEffective > 0) {
        segs.push({ x1: cxx(r.x), y1: cyy(r.y), x2: cxx(r.x), y2: cyy(r.y + 1), nx: 1, ny: 0, len: tileSize });
      }
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Ballast bed: a soft dark strip the rails and ties sit on.
    ctx.strokeStyle = '#3a3330';
    ctx.lineWidth = Math.max(3, tileSize * 0.5);
    for (const g of segs) {
      ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke();
    }

    // Wooden ties: short perpendicular strokes crossing both rails, evenly
    // spaced along each segment — this is what actually reads as "track"
    // rather than "road", since roads never have crossing ties.
    const tieGap = Math.max(1, tileSize * 0.34);
    const tieHalf = tileSize * 0.24;
    ctx.strokeStyle = '#4b4038';
    ctx.lineWidth = Math.max(1, tileSize * 0.1);
    for (const g of segs) {
      const steps = Math.max(1, Math.round(g.len / tieGap));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const tx = g.x1 + (g.x2 - g.x1) * t;
        const ty = g.y1 + (g.y2 - g.y1) * t;
        ctx.beginPath();
        ctx.moveTo(tx - g.nx * tieHalf, ty - g.ny * tieHalf);
        ctx.lineTo(tx + g.nx * tieHalf, ty + g.ny * tieHalf);
        ctx.stroke();
      }
    }

    // Two parallel steel rails, offset off the centerline — the detail that
    // actually reads as "railway" rather than a single stripe.
    const railGap = Math.max(1.5, tileSize * 0.16);
    const railColor = tileSize >= 8 ? '#cbd5e1' : '#94a3b8';
    ctx.lineWidth = Math.max(1, tileSize * 0.055);
    for (const sign of [-1, 1]) {
      ctx.strokeStyle = railColor;
      for (const g of segs) {
        const ox = g.nx * railGap * sign;
        const oy = g.ny * railGap * sign;
        ctx.beginPath();
        ctx.moveTo(g.x1 + ox, g.y1 + oy);
        ctx.lineTo(g.x2 + ox, g.y2 + oy);
        ctx.stroke();
      }
    }

    // Station marker: a small platform + signal where the line meets a
    // settlement, so the track visibly plugs into the city rather than
    // appearing to stop in open country.
    if (tileSize >= 5) {
      for (const r of railTiles) {
        const tile = tileMap.grid[r.x][r.y];
        if (!tile.cityId) continue;
        const px = cxx(r.x);
        const py = cyy(r.y);
        ctx.fillStyle = 'rgba(87, 83, 78, 0.55)';
        ctx.fillRect(px - tileSize * 0.55, py - tileSize * 0.42, tileSize * 1.1, tileSize * 0.3);
        ctx.fillStyle = '#78716c';
        ctx.fillRect(px - tileSize * 0.04, py - tileSize * 0.6, tileSize * 0.08, tileSize * 0.22);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(px, py - tileSize * 0.6, Math.max(1.5, tileSize * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Locomotive: a real pixel-art engine, oriented along its segment, only
    // drawn while freight is actually moving this year.
    // ponytail: one engine walks the concatenation of all visible segments in
    // raster order, not a per-component ordered path — fine for the common
    // case of one simple point-to-point line; revisit if multiple simultaneous
    // lines on screen make the single cursor jump visibly between them.
    if (hasActiveFreight && tileSize >= 6 && segs.length > 0) {
      const speed = 0.6;
      const totalLen = segs.reduce((s, g) => s + g.len, 0);
      const cycle = totalLen / speed;
      const along = ((this.animTimer * 10) % cycle + cycle) % cycle;
      let remaining = along * speed;
      let seg = segs[0];
      for (const g of segs) {
        if (remaining <= g.len) { seg = g; break; }
        remaining -= g.len;
      }
      const frac = seg.len > 0 ? remaining / seg.len : 0;
      const ex = seg.x1 + (seg.x2 - seg.x1) * frac;
      const ey = seg.y1 + (seg.y2 - seg.y1) * frac;
      const dirX = seg.x2 - seg.x1;
      const dirY = seg.y2 - seg.y1;
      const angle = Math.atan2(dirY, dirX);

      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(angle);
      const L = tileSize * 0.62;
      const H = tileSize * 0.34;
      // Wagon trailing behind the engine.
      ctx.fillStyle = '#44403c';
      ctx.fillRect(-L * 1.55, -H * 0.4, L * 0.7, H * 0.8);
      // Locomotive body.
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(-L * 0.5, -H * 0.5, L, H);
      // Cab stripe.
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-L * 0.5, -H * 0.5, L * 0.28, H);
      // Cab window.
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(-L * 0.38, -H * 0.28, L * 0.14, H * 0.3);
      // Chimney + smoke puff.
      ctx.fillStyle = '#292524';
      ctx.fillRect(L * 0.28, -H * 0.85, L * 0.14, H * 0.5);
      ctx.fillStyle = 'rgba(214, 211, 209, 0.55)';
      const puff = 0.5 + Math.sin(this.animTimer * 6) * 0.15;
      ctx.beginPath();
      ctx.arc(L * 0.35, -H * 1.0, H * 0.32 * puff, 0, Math.PI * 2);
      ctx.fill();
      // Wheels.
      ctx.fillStyle = '#0c0a09';
      ctx.beginPath(); ctx.arc(-L * 0.22, H * 0.5, H * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(L * 0.18, H * 0.5, H * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }



  /**
   * Kingdom territory.
   *
   * The old pass washed every owned tile with a flat 18% of the realm's colour
   * and then drew a border as four inset rectangles per tile. That is the
   * worst of both worlds: the wash is heavy enough to grey out the terrain
   * across the whole interior and still too weak to read as ownership, and the
   * border comes out as a staircase of blocks with holes at every diagonal
   * corner.
   *
   * What actually carries the information is the frontier, so that is what
   * gets the contrast. Tint strength now falls off with distance from the
   * border: firm along the edge, fading to a whisper a few tiles in, which
   * leaves the middle of a realm looking like the land it is rather than like
   * coloured glass. The border itself is stroked along the real edges between
   * tiles — one continuous line with round joins, dark underneath so it reads
   * against snow and sand alike, the realm's colour on top.
   *
   * Land newly taken flares briefly in the new owner's colour. Expansion is
   * the most interesting thing a realm does and it used to happen silently.
   */
  /** Owner of every tile as of the last frame, for spotting land changing hands. */
  private claimOwner: Int32Array = new Int32Array(0);
  /** When each tile last changed hands, on the renderer's own clock. */
  private claimAt: Float32Array = new Float32Array(0);
  /** Stable per-realm ids, since the per-window numbering is rebuilt each frame. */
  private claimIds: Map<string, number> = new Map();
  /** False until one full frame has been recorded, so a load does not flare. */
  private claimSeen: boolean = false;
  /** Frontier contours for the frame, indexed by the window's realm numbering. */
  private frontierPaths: (Path2D | undefined)[] = [];
  /** Shoreline contours for the frame, drawn faintly — a coast is not contested. */
  private shorePaths: (Path2D | undefined)[] = [];

  private intelligenceRealmColor(
    kingdom: Kingdom,
    mode: OverlayMode,
    overlays?: OverlayManager,
    intel?: MapIntelligenceSnapshot | null
  ): { r: number; g: number; b: number } {
    if (mode === 'diplomacy' && this.diplomacy) {
      const reference = overlays?.selectedRealmId ?? kingdom.id;
      const status = this.diplomacy.getStatus(reference, kingdom.id);
      const color = status === 'war' ? '#ef4444'
        : status === 'hostile' ? '#f59e0b'
        : status === 'alliance' || status === 'friendly' ? '#38bdf8'
        : '#94a3b8';
      return this.hexToRgb(color);
    }
    if (mode === 'politics') {
      const facts = intel?.politics.find(item => item.kingdomId === kingdom.id);
      if (facts) {
        const pressure = Math.max(facts.revoltRisk, facts.coupRisk, facts.reformPressure, 1 - facts.stability, 1 - facts.legitimacy);
        return this.hexToRgb(pressure >= 0.62 ? '#ef4444' : pressure >= 0.34 ? '#f59e0b' : '#22c55e');
      }
    }
    return kingdom.rgbColor;
  }

  private drawCityHeatOverlay(
    camera: Camera, width: number, height: number, tileSize: number,
    cities: MapCityDatum[], mode: 'population' | 'economy', overlays?: OverlayManager
  ): void {
    const metric = overlays?.economyMetric ?? 'prosperity';
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    for (const city of cities) {
      const pos = camera.worldToScreen(city.x + 0.5, city.y + 0.5, width, height);
      if (pos.x < -80 || pos.y < -80 || pos.x > width + 80 || pos.y > height + 80) continue;
      const value = mode === 'population' ? city.populationLevel
        : metric === 'output' ? city.outputLevel
        : metric === 'employment' ? city.employment
        : metric === 'food' ? city.foodSecurity === null ? null : Math.min(1, city.foodSecurity / 1.2)
        : city.prosperity;
      if (value === null) continue;
      const v = Math.max(0, Math.min(1, value));
      const color = mode === 'population'
        ? v > 0.82 ? '#ef4444' : v > 0.58 ? '#f59e0b' : v > 0.32 ? '#a3e635' : '#38bdf8'
        : v > 0.68 ? '#22c55e' : v > 0.38 ? '#f59e0b' : '#ef4444';
      const radius = Math.max(10, Math.min(72, tileSize * (2.2 + Math.sqrt(Math.max(1, city.territoryTiles)) * 0.34)));
      const grad = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
      grad.addColorStop(0, `${color}b8`);
      grad.addColorStop(0.45, `${color}64`);
      grad.addColorStop(1, `${color}00`);
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawResourceOverlay(
    tileMap: TileMap, minX: number, maxX: number, minY: number, maxY: number,
    tileSize: number, baseSX: number, baseSY: number, selected: string | 'all'
  ): void {
    const step = tileSize < 2.5 ? 4 : tileSize < 5 ? 2 : 1;
    this.ctx.save();
    for (let x = minX; x <= maxX; x += step) for (let y = minY; y <= maxY; y += step) {
      let best: Tile | null = null;
      for (let dx = 0; dx < step && x + dx <= maxX; dx++) for (let dy = 0; dy < step && y + dy <= maxY; dy++) {
        const tile = tileMap.grid[x + dx][y + dy];
        if (!tile.resourceType || (selected !== 'all' && tile.resourceType !== selected)) continue;
        if (!best || tile.resourceAmount > best.resourceAmount) best = tile;
      }
      if (!best?.resourceType) continue;
      const amount = best.resourceMax > 0 ? best.resourceAmount / best.resourceMax : best.resourceAmount > 0 ? 1 : 0;
      const color = GOODS[best.resourceType]?.color ?? '#fbbf24';
      const sx = x * tileSize + baseSX;
      const sy = y * tileSize + baseSY;
      const size = Math.max(2, tileSize * step * 0.72);
      this.ctx.globalAlpha = amount > 0 ? 0.32 + Math.min(1, amount) * 0.48 : 0.32;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(sx + (tileSize * step - size) / 2, sy + (tileSize * step - size) / 2, size, size);
      if (amount <= 0) {
        this.ctx.strokeStyle = '#64748b';
        this.ctx.setLineDash([2, 2]);
        this.ctx.strokeRect(sx, sy, Math.max(2, tileSize * step), Math.max(2, tileSize * step));
        this.ctx.setLineDash([]);
      }
    }
    this.ctx.restore();
  }

  private drawTradeOverlay(camera: Camera, width: number, height: number, tileSize: number, intel: MapIntelligenceSnapshot): void {
    const routes = intel.routes.slice(0, tileSize < 3 ? 24 : tileSize < 6 ? 70 : 140);
    const maxVolume = Math.max(1, ...routes.map(item => item.route.volume));
    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    for (const item of routes) {
      const path = item.route.path?.length ? item.route.path
        : item.fromCity && item.toCity ? [{ x: item.fromCity.x, y: item.fromCity.y }, { x: item.toCity.x, y: item.toCity.y }]
        : [];
      if (path.length < 2) continue;
      const color = GOODS[item.good]?.color ?? '#22d3ee';
      this.ctx.strokeStyle = color;
      this.ctx.globalAlpha = item.route.active ? 0.72 : 0.42;
      this.ctx.lineWidth = Math.max(1.2, Math.min(4.5, 1 + 3.2 * Math.sqrt(item.route.volume / maxVolume)));
      this.ctx.setLineDash(item.route.active ? [] : [5, 5]);
      this.ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const p = camera.worldToScreen(path[i].x + 0.5, path[i].y + 0.5, width, height);
        if (i === 0) this.ctx.moveTo(p.x, p.y); else this.ctx.lineTo(p.x, p.y);
      }
      this.ctx.stroke();
      const mid = Math.max(1, Math.floor(path.length / 2));
      const a = camera.worldToScreen(path[mid - 1].x + 0.5, path[mid - 1].y + 0.5, width, height);
      const b = camera.worldToScreen(path[mid].x + 0.5, path[mid].y + 0.5, width, height);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      this.ctx.setLineDash([]);
      this.ctx.fillStyle = color;
      this.ctx.translate(b.x, b.y);
      this.ctx.rotate(angle);
      this.ctx.beginPath();
      this.ctx.moveTo(5, 0); this.ctx.lineTo(-4, -3.2); this.ctx.lineTo(-4, 3.2); this.ctx.closePath(); this.ctx.fill();
      this.ctx.rotate(-angle);
      this.ctx.translate(-b.x, -b.y);
    }
    this.ctx.restore();
  }

  private drawInfrastructureIntelligence(
    tileMap: TileMap, minX: number, maxX: number, minY: number, maxY: number,
    tileSize: number, baseSX: number, baseSY: number,
    overlays: OverlayManager, intel?: MapIntelligenceSnapshot | null
  ): void {
    const roads = overlays.layers.has('roads');
    const traffic = overlays.layers.has('road-traffic');
    const rail = overlays.layers.has('rail');
    const ports = overlays.layers.has('ports');
    const issues = overlays.layers.has('logistics');
    if (!roads && !traffic && !rail && !ports && !issues) return;
    this.ctx.save();
    const step = tileSize < 2.5 ? 2 : 1;
    for (let x = minX; x <= maxX; x += step) for (let y = minY; y <= maxY; y += step) {
      const tile = tileMap.grid[x][y];
      const sx = x * tileSize + baseSX;
      const sy = y * tileSize + baseSY;
      if (roads && tile.roadLevel > 0) {
        this.ctx.fillStyle = tile.roadDamage > 0.45 ? 'rgba(239,68,68,.7)' : `rgba(251,191,36,${0.28 + tile.roadLevel * 0.16})`;
        this.ctx.fillRect(sx, sy + tileSize * 0.34, Math.max(2, tileSize * step), Math.max(1.5, tileSize * 0.3));
      }
      if (traffic && tile.roadTraffic > 0) {
        this.ctx.fillStyle = `rgba(251,113,133,${Math.min(0.82, 0.18 + Math.log1p(tile.roadTraffic) / 8)})`;
        this.ctx.beginPath(); this.ctx.arc(sx + tileSize / 2, sy + tileSize / 2, Math.max(2, tileSize * 0.42), 0, Math.PI * 2); this.ctx.fill();
      }
      if (rail && tile.railLevel > 0) {
        this.ctx.strokeStyle = tile.railDamage >= 0.75 ? '#ef4444' : '#67e8f9';
        this.ctx.globalAlpha = 0.82;
        this.ctx.lineWidth = Math.max(1.5, tileSize * 0.22);
        this.ctx.beginPath(); this.ctx.moveTo(sx, sy + tileSize / 2); this.ctx.lineTo(sx + tileSize * step, sy + tileSize / 2); this.ctx.stroke();
      }
    }
    if (ports && intel) for (const port of intel.ports) {
      const x = port.x * tileSize + baseSX + tileSize / 2;
      const y = port.y * tileSize + baseSY + tileSize / 2;
      this.ctx.globalAlpha = 0.9;
      this.ctx.fillStyle = port.operational ? '#38bdf8' : '#ef4444';
      this.ctx.beginPath(); this.ctx.arc(x, y, Math.max(4, tileSize * 0.7), 0, Math.PI * 2); this.ctx.fill();
      this.ctx.fillStyle = '#082f49'; this.ctx.fillRect(x - 1, y - Math.max(3, tileSize * 0.42), 2, Math.max(6, tileSize * 0.84));
    }
    if (issues && intel) for (const issue of intel.issues) {
      if (!issue.at) continue;
      const x = issue.at.x * tileSize + baseSX + tileSize / 2;
      const y = issue.at.y * tileSize + baseSY + tileSize / 2;
      const r = Math.max(5, tileSize * 0.62);
      this.ctx.globalAlpha = 0.92;
      this.ctx.fillStyle = issue.severity === 'critical' ? '#ef4444' : '#f59e0b';
      this.ctx.beginPath(); this.ctx.moveTo(x, y - r); this.ctx.lineTo(x + r, y); this.ctx.lineTo(x, y + r); this.ctx.lineTo(x - r, y); this.ctx.closePath(); this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawArmyOverlay(camera: Camera, width: number, height: number, tileSize: number, entities: Entity[], kingdoms: Map<string, Kingdom>): void {
    const military = entities.filter(entity => ['soldier', 'archer', 'leader', 'king'].includes(entity.profession));
    this.ctx.save();
    if (tileSize < 4) {
      const counts = new Map<string, number>();
      for (const entity of military) if (entity.kingdomId) counts.set(entity.kingdomId, (counts.get(entity.kingdomId) ?? 0) + 1);
      for (const [id, count] of counts) {
        const kingdom = kingdoms.get(id); if (!kingdom) continue;
        const p = camera.worldToScreen(kingdom.cachedCenter.x, kingdom.cachedCenter.y, width, height);
        this.ctx.fillStyle = kingdom.color; this.ctx.globalAlpha = 0.82;
        this.ctx.beginPath(); this.ctx.arc(p.x, p.y, Math.max(4, Math.min(13, 3 + Math.sqrt(count))), 0, Math.PI * 2); this.ctx.fill();
      }
    } else for (const entity of military) {
      const p = camera.worldToScreen(entity.x + 0.5, entity.y + 0.5, width, height);
      this.ctx.fillStyle = entity.kingdomId ? kingdoms.get(entity.kingdomId)?.color ?? '#f8fafc' : '#f8fafc';
      this.ctx.globalAlpha = 0.78;
      const r = Math.max(2, tileSize * 0.24);
      this.ctx.beginPath(); this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2); this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawTerritoryPass(
    tileMap: TileMap,
    minX: number, maxX: number, minY: number, maxY: number,
    tileSize: number, baseSX: number, baseSY: number,
    kingdoms: Map<string, Kingdom>,
    overlayMode: OverlayMode,
    warFocus?: WarOverlayFocus | null,
    overlays?: OverlayManager,
    mapIntel?: MapIntelligenceSnapshot | null
  ): void {
    if (tileSize < 1 || kingdoms.size === 0) return;
    const ctx = this.ctx;
    const political = overlayMode === 'political' || overlayMode === 'diplomacy' || overlayMode === 'politics' || overlayMode === 'war';
    const warParticipants = overlayMode === 'war' ? new Set(warFocus?.participantIds ?? []) : null;

    const x0 = Math.max(0, minX - 1);
    const x1 = Math.min(tileMap.width - 1, maxX + 1);
    const y0 = Math.max(0, minY - 1);
    const y1 = Math.min(tileMap.height - 1, maxY + 1);
    const gw = x1 - x0 + 1;
    const gh = y1 - y0 + 1;
    if (gw <= 0 || gh <= 0) return;

    // Owner of every tile in the window as a small integer: 0 for unclaimed,
    // and a per-realm index otherwise. Comparing integers rather than string
    // ids matters here because the distance field touches every tile several
    // times.
    const owners = new Int32Array(gw * gh);
    // Water is tracked separately: a lake inside a realm is not a frontier,
    // and outlining every pond turned the map into a net of coloured rings.
    const wet = new Uint8Array(gw * gh);
    const realms: (Kingdom | null)[] = [null];
    const index = new Map<string, number>();
    for (let x = x0; x <= x1; x++) {
      const column = tileMap.grid[x];
      const base = (x - x0) * gh - y0;
      for (let y = y0; y <= y1; y++) {
        if (this.isWater(column[y].type)) wet[base + y] = 1;
        const id = column[y].kingdomId;
        if (!id) continue;
        let n = index.get(id);
        if (n === undefined) {
          const kingdom = kingdoms.get(id);
          if (!kingdom) continue;
          n = realms.length;
          realms.push(kingdom);
          index.set(id, n);
        }
        owners[base + y] = n;
      }
    }
    if (realms.length === 1) return; // nothing claimed in view

    // Distance from the frontier, in tiles, saturating at DEPTH. Chebyshev,
    // computed with the usual two sweeps: a tile beside a different owner is
    // 0, and every step inward adds one.
    const DEPTH = 4;
    const depth = new Uint8Array(gw * gh);
    for (let gx = 0; gx < gw; gx++) {
      for (let gy = 0; gy < gh; gy++) {
        const i = gx * gh + gy;
        const own = owners[i];
        if (own === 0) { depth[i] = 0; continue; }
        let edge = false;
        for (let dx = -1; dx <= 1 && !edge; dx++) {
          for (let dy = -1; dy <= 1 && !edge; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = gx + dx;
            const ny = gy + dy;
            // The window edge is not a frontier — the realm carries on past it.
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
            if (owners[nx * gh + ny] !== own) edge = true;
          }
        }
        depth[i] = edge ? 0 : DEPTH;
      }
    }
    for (let gx = 0; gx < gw; gx++) {
      for (let gy = 0; gy < gh; gy++) {
        const i = gx * gh + gy;
        if (depth[i] === 0) continue;
        let best = DEPTH;
        if (gx > 0) best = Math.min(best, depth[(gx - 1) * gh + gy] + 1);
        if (gy > 0) best = Math.min(best, depth[i - 1] + 1);
        if (gx > 0 && gy > 0) best = Math.min(best, depth[(gx - 1) * gh + gy - 1] + 1);
        if (gx > 0 && gy < gh - 1) best = Math.min(best, depth[(gx - 1) * gh + gy + 1] + 1);
        depth[i] = Math.min(DEPTH, best);
      }
    }
    for (let gx = gw - 1; gx >= 0; gx--) {
      for (let gy = gh - 1; gy >= 0; gy--) {
        const i = gx * gh + gy;
        if (depth[i] === 0) continue;
        let best = depth[i];
        if (gx < gw - 1) best = Math.min(best, depth[(gx + 1) * gh + gy] + 1);
        if (gy < gh - 1) best = Math.min(best, depth[i + 1] + 1);
        if (gx < gw - 1 && gy < gh - 1) best = Math.min(best, depth[(gx + 1) * gh + gy + 1] + 1);
        if (gx < gw - 1 && gy > 0) best = Math.min(best, depth[(gx + 1) * gh + gy - 1] + 1);
        depth[i] = Math.min(DEPTH, best);
      }
    }

    // How much colour a tile takes, by how deep inside the realm it sits.
    // The interior keeps just enough to say "someone owns this" without
    // pretending to be a paint swatch.
    const TINT = political
      ? [0.62, 0.52, 0.44, 0.38, 0.34]
      : [0.30, 0.22, 0.16, 0.13, 0.12];

    // One fill path per realm per depth band, so the whole window is painted
    // in a handful of fills instead of one per tile.
    const bands: Path2D[][] = realms.map(() => []);
    for (let gx = 0; gx < gw; gx++) {
      for (let gy = 0; gy < gh; gy++) {
        const i = gx * gh + gy;
        const own = owners[i];
        if (own === 0) continue;
        const band = depth[i];
        let path = bands[own][band];
        if (!path) { path = new Path2D(); bands[own][band] = path; }
        const sx = (gx + x0) * tileSize + baseSX;
        const sy = (gy + y0) * tileSize + baseSY;
        path.rect(sx, sy, tileSize + 0.5, tileSize + 0.5);
      }
    }
    for (let own = 1; own < realms.length; own++) {
      const kingdom = realms[own]!;
      const { r, g, b } = this.intelligenceRealmColor(kingdom, overlayMode, overlays, mapIntel);
      // Deepest first, so the firmer edge bands land on top of the wash.
      for (let band = DEPTH; band >= 0; band--) {
        const path = bands[own][band];
        if (!path) continue;
        const alpha = warParticipants ? (warParticipants.has(kingdom.id) ? Math.min(0.76, TINT[band] + 0.10) : TINT[band] * 0.20) : TINT[band];
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill(path);
      }
    }

    // The frontier itself.
    //
    // Stroking each tile edge on its own gives a staircase, because a
    // staircase is exactly what a grid boundary is. The edges are chained into
    // continuous contours first and then drawn through their own corners, so
    // the line cuts each step instead of climbing it — the difference between
    // a border that looks drawn and one that looks like pixels.
    //
    // Water never makes a frontier. A realm's coast is already obvious from
    // the sea, and ringing every inland lake in the realm's colour was pure
    // noise; the coast is carried by the tint band instead.
    if (tileSize >= 3) {
      const pt = (x: number, y: number): number => x * 4096 + y;
      for (let own = 1; own < realms.length; own++) {
        // Two kinds of edge, because they mean different things. Where a realm
        // meets another realm or open land, that is a frontier — somebody
        // could move it. Where it meets water, that is just the shape of the
        // world, so it gets a hairline: enough to give the realm a silhouette
        // at map zoom, not enough to ring every pond in colour.
        const land: [number, number][] = [];
        const shore: [number, number][] = [];
        for (let gx = 0; gx < gw; gx++) {
          for (let gy = 0; gy < gh; gy++) {
            const i = gx * gh + gy;
            if (owners[i] !== own) continue;
            const side = (nx: number, ny: number): [number, number][] | null => {
              if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) return null; // window edge, not a frontier
              const j = nx * gh + ny;
              if (owners[j] === own) return null;
              return wet[j] === 1 ? shore : land;
            };
            let into = side(gx - 1, gy);
            if (into) into.push([pt(gx, gy), pt(gx, gy + 1)]);
            into = side(gx + 1, gy);
            if (into) into.push([pt(gx + 1, gy), pt(gx + 1, gy + 1)]);
            into = side(gx, gy - 1);
            if (into) into.push([pt(gx, gy), pt(gx + 1, gy)]);
            into = side(gx, gy + 1);
            if (into) into.push([pt(gx, gy + 1), pt(gx + 1, gy + 1)]);
          }
        }
        if (land.length > 0) this.frontierPaths[own] = this.traceContours(land, x0, y0, tileSize, baseSX, baseSY);
        if (shore.length > 0) this.shorePaths[own] = this.traceContours(shore, x0, y0, tileSize, baseSX, baseSY);
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const width = Math.max(1.2, Math.min(2.8, tileSize * 0.1));

      // Shorelines first and faintly, so a contested frontier always wins
      // where the two happen to run together.
      ctx.lineWidth = Math.max(1, width * 0.62);
      for (let own = 1; own < realms.length; own++) {
        const path = this.shorePaths[own];
        if (!path) continue;
        const { r, g, b } = this.intelligenceRealmColor(realms[own]!, overlayMode, overlays, mapIntel);
        const alpha = warParticipants ? (warParticipants.has(realms[own]!.id) ? 0.62 : 0.14) : 0.5;
        ctx.strokeStyle = `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, ${alpha})`;
        ctx.stroke(path);
      }

      // A dark line under the coloured one: a pale realm on snow and a dark
      // realm on ocean both need something to sit against.
      ctx.strokeStyle = 'rgba(10, 12, 16, 0.55)';
      ctx.lineWidth = width + Math.max(1, tileSize * 0.055);
      for (let own = 1; own < realms.length; own++) {
        const path = this.frontierPaths[own];
        if (path) ctx.stroke(path);
      }
      ctx.lineWidth = width;
      for (let own = 1; own < realms.length; own++) {
        const path = this.frontierPaths[own];
        if (!path) continue;
        const { r, g, b } = this.intelligenceRealmColor(realms[own]!, overlayMode, overlays, mapIntel);
        const alpha = warParticipants ? (warParticipants.has(realms[own]!.id) ? 1 : 0.18) : 0.95;
        ctx.strokeStyle = `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, ${alpha})`;
        ctx.stroke(path);
      }
      this.frontierPaths.length = 0;
      this.shorePaths.length = 0;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }

    this.flareNewlyClaimed(tileMap, x0, x1, y0, y1, gh, owners, realms, tileSize, baseSX, baseSY);
  }

  /**
   * Chains boundary edges into continuous contours and draws them through
   * their own corners.
   *
   * Each edge arrives as a pair of lattice points — corners of the tile grid —
   * so chaining is exact: two edges meet when they share a point, with no
   * tolerance to tune. Chains that close on themselves are rings around a
   * whole realm; chains that do not are runs that leave the window.
   *
   * Drawing then goes moveTo the first midpoint and curves through each
   * corner to the next midpoint, which is the standard way to round a
   * polyline. Every right angle in the staircase becomes an arc, and a long
   * diagonal frontier comes out as a diagonal rather than as steps.
   */
  private traceContours(
    segments: [number, number][],
    x0: number, y0: number,
    tileSize: number, baseSX: number, baseSY: number
  ): Path2D {
    const links = new Map<number, number[]>();
    const push = (a: number, b: number): void => {
      const list = links.get(a);
      if (list) list.push(b);
      else links.set(a, [b]);
    };
    for (const [a, b] of segments) { push(a, b); push(b, a); }

    // Edge keys are numbers, not strings. `walk` asks "have I used this edge?"
    // once per candidate per step, and building a string each time was the
    // single most expensive thing in the territory pass. Lattice points fit in
    // about 2^19, so a pair packs into a float64 exactly.
    const used = new Set<number>();
    const edgeKey = (a: number, b: number): number => (a < b ? a * 1048576 + b : b * 1048576 + a);
    const path = new Path2D();
    const sx = (p: number): number => Math.floor(p / 4096) * tileSize + x0 * tileSize + baseSX;
    const sy = (p: number): number => (p % 4096) * tileSize + y0 * tileSize + baseSY;

    const walk = (start: number): number[] => {
      const chain = [start];
      let current = start;
      for (;;) {
        const next = (links.get(current) ?? []).find(n => !used.has(edgeKey(current, n)));
        if (next === undefined) break;
        used.add(edgeKey(current, next));
        chain.push(next);
        current = next;
        if (current === start) break; // closed ring
      }
      return chain;
    };

    const emit = (chain: number[]): void => {
      if (chain.length < 2) return;
      if (chain.length === 2) {
        path.moveTo(sx(chain[0]), sy(chain[0]));
        path.lineTo(sx(chain[1]), sy(chain[1]));
        return;
      }
      const mx = (i: number): number => (sx(chain[i]) + sx(chain[i + 1])) / 2;
      const my = (i: number): number => (sy(chain[i]) + sy(chain[i + 1])) / 2;
      path.moveTo(mx(0), my(0));
      for (let i = 1; i < chain.length - 1; i++) {
        path.quadraticCurveTo(sx(chain[i]), sy(chain[i]), mx(i), my(i));
      }
      path.lineTo(sx(chain[chain.length - 1]), sy(chain[chain.length - 1]));
    };

    // Open runs first, started from their loose ends, so a run is never
    // entered in the middle and split into two half-drawn pieces.
    for (const [point, list] of links) {
      if (list.length % 2 === 0) continue;
      let chain = walk(point);
      while (chain.length >= 2) { emit(chain); chain = walk(point); }
    }
    for (const point of links.keys()) {
      let chain = walk(point);
      while (chain.length >= 2) { emit(chain); chain = walk(point); }
    }
    return path;
  }

  /**
   * Marks land that has just changed hands.
   *
   * Ownership is compared against what was on screen last frame, so this needs
   * nothing from the simulation and nothing in the save file. A tile that
   * changes flares in its new owner's colour and settles over about a second
   * and a half — long enough to catch the eye at speed, short enough that a
   * war does not leave the map strobing.
   */
  private flareNewlyClaimed(
    tileMap: TileMap,
    x0: number, x1: number, y0: number, y1: number,
    gh: number,
    owners: Int32Array,
    realms: (Kingdom | null)[],
    tileSize: number, baseSX: number, baseSY: number
  ): void {
    const cells = tileMap.width * tileMap.height;
    if (this.claimOwner.length !== cells) {
      this.claimOwner = new Int32Array(cells);
      this.claimAt = new Float32Array(cells);
      this.claimSeen = false;
    }
    // Stable ids across frames: the per-window index is rebuilt every frame
    // and would otherwise renumber realms as the camera moves.
    const stableId = (kingdom: Kingdom | null): number => {
      if (!kingdom) return 0;
      let id = this.claimIds.get(kingdom.id);
      if (id === undefined) {
        id = this.claimIds.size + 1;
        this.claimIds.set(kingdom.id, id);
      }
      return id;
    };
    const stable = realms.map(stableId);

    const ctx = this.ctx;
    // animTimer advances 0.04 per frame, so this is about a second and a half
    // at 60fps: long enough to catch the eye while the world runs fast, short
    // enough that a war does not leave the map strobing.
    const FLARE = 3.6;
    const now = this.animTimer;
    const glow: { x: number; y: number; cell: number; fade: number }[] = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const cell = x * tileMap.height + y;
        const own = stable[owners[(x - x0) * gh + (y - y0)]];
        if (this.claimOwner[cell] !== own) {
          this.claimOwner[cell] = own;
          this.claimAt[cell] = now;
          // The first frame after a load is not a conquest: record the world
          // as it is and flare nothing, or the whole map lights up at once.
          if (!this.claimSeen) this.claimAt[cell] = -FLARE * 2;
        }
        if (own === 0) continue;
        // A negative age means the clock wrapped since the claim; that tile
        // simply misses its flare rather than holding a stale one for an hour.
        const age = now - this.claimAt[cell];
        if (age < 0 || age > FLARE) continue;
        const kingdom = realms[owners[(x - x0) * gh + (y - y0)]];
        if (!kingdom) continue;
        const fade = 1 - age / FLARE;
        const sx = x * tileSize + baseSX;
        const sy = y * tileSize + baseSY;
        const { r, g, b } = kingdom.rgbColor;
        // A wash of the new colour over the ground just taken.
        ctx.fillStyle = `rgba(${Math.min(255, r + 70)}, ${Math.min(255, g + 70)}, ${Math.min(255, b + 70)}, ${0.32 * fade * fade})`;
        ctx.fillRect(sx, sy, tileSize + 0.5, tileSize + 0.5);
        if (tileSize >= 5) glow.push({ x, y, cell, fade });
      }
    }

    // The bright edge belongs to the annexation, not to each of its tiles:
    // outlining every tile separately made a gain look like a handful of
    // boxes rather than like one piece of ground changing hands. Only sides
    // that face land which is *not* part of the same gain are drawn.
    if (glow.length > 0) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const fresh = (x: number, y: number, own: number, bucket: number): boolean => {
        if (x < x0 || x > x1 || y < y0 || y > y1) return false;
        const cell = x * tileMap.height + y;
        if (this.claimOwner[cell] !== own) return false;
        const age = now - this.claimAt[cell];
        if (age < 0 || age > FLARE) return false;
        return Math.round((1 - age / FLARE) * 10) === bucket;
      };
      // Grouped by how far along the fade each tile is, so two gains taken a
      // moment apart stay two outlines rather than merging into one blob, and
      // traced as contours for the same reason the frontier is: a bright
      // staircase is still a staircase.
      const byFade = new Map<number, [number, number][]>();
      const pt = (x: number, y: number): number => x * 4096 + y;
      for (const g of glow) {
        const own = this.claimOwner[g.cell];
        const bucket = Math.round(g.fade * 10);
        let segments = byFade.get(bucket);
        if (!segments) { segments = []; byFade.set(bucket, segments); }
        if (!fresh(g.x - 1, g.y, own, bucket)) segments.push([pt(g.x, g.y), pt(g.x, g.y + 1)]);
        if (!fresh(g.x + 1, g.y, own, bucket)) segments.push([pt(g.x + 1, g.y), pt(g.x + 1, g.y + 1)]);
        if (!fresh(g.x, g.y - 1, own, bucket)) segments.push([pt(g.x, g.y), pt(g.x + 1, g.y)]);
        if (!fresh(g.x, g.y + 1, own, bucket)) segments.push([pt(g.x, g.y + 1), pt(g.x + 1, g.y + 1)]);
      }
      for (const [bucket, segments] of byFade) {
        if (segments.length === 0) continue;
        const fade = bucket / 10;
        ctx.strokeStyle = `rgba(255, 250, 235, ${0.8 * fade})`;
        ctx.lineWidth = Math.max(1, tileSize * 0.09 * (0.4 + 0.6 * fade));
        ctx.stroke(this.traceContours(segments, 0, 0, tileSize, baseSX, baseSY));
      }
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }
    this.claimSeen = true;
  }

  /**
   * The road network, drawn as a network.
   *
   * The old pass emitted one axis-aligned bar per tile toward its +x/+y
   * neighbour. That has two consequences the eye reads immediately: a road
   * surveyed diagonally becomes a row of disconnected blobs, because diagonal
   * neighbours were never joined at all, and no road can ever curve, because a
   * lattice of bars has no curves in it.
   *
   * This pass builds the real graph — eight directions, with a diagonal
   * dropped whenever the two tiles are already joined the long way round, so a
   * bend is a bend and never a filled triangle — and each tile draws its own
   * crossing as a quadratic through its centre. Straight runs come out
   * straight; every change of direction comes out as an arc, which is what a
   * road does on the ground because carts cannot turn on a corner.
   *
   * Everything above that is the ground showing through. A road takes its
   * colour from what it was cut into, is crowned in the middle and shadowed on
   * its downhill shoulder, carries wheel ruts while it is dirt and paving
   * courses once it is stone, and breaks up into potholes where it has been
   * fought over. Water is not a road tile with a plank texture: it is a
   * structure, with piers standing in the current and a deck carried over
   * them, drawn along the true bearing of the crossing.
   */
  private drawRoadsPass(
    tileMap: TileMap,
    minX: number, maxX: number, minY: number, maxY: number,
    tileSize: number, baseSX: number, baseSY: number,
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>
  ): void {
    if (tileSize < 1) return;
    const ctx = this.ctx;

    // 0: a line on a world map. 1: a built road. 2: close enough to read the
    // shape of the ground under it.
    const detail = tileSize >= 12 ? 2 : tileSize >= 5 ? 1 : 0;
    // Close enough to resolve an individual paving stone. Below this the
    // micro-texture stops being texture and starts being noise — which is
    // precisely how a paved road ends up looking like railway track — and it
    // is also where the per-tile detail loop stops being worth its frame cost,
    // since a whole map of roads can be on screen at mid zoom.
    const fine = tileSize >= 22;

    /**
     * Road surfaces, keyed by grade and by the ground the road was cut into.
     * The bed of a road is whatever was to hand: dune sand stays pale, marsh
     * causeways stay dark and wet, frost-heaved gravel goes grey. `s` is the
     * running surface, `k` the kerb and cut edge.
     */
    const SURFACES: Record<string, { s: string; k: string }> = {
      '1|temperate': { s: '#6d5436', k: '#3d2e1b' },
      '1|arid': { s: '#9a8156', k: '#6a5636' },
      '1|cold': { s: '#79706a', k: '#484239' },
      '1|wet': { s: '#4e4330', k: '#2a2417' },
      '2|temperate': { s: '#8a847b', k: '#4b463f' },
      '2|arid': { s: '#a89b83', k: '#665d4b' },
      '2|cold': { s: '#969b9f', k: '#54595d' },
      '2|wet': { s: '#6c6860', k: '#3a3732' },
      '3|temperate': { s: '#b0a798', k: '#5f594e' },
      '3|arid': { s: '#c0b193', k: '#6d6350' },
      '3|cold': { s: '#b3b8bb', k: '#5d6265' },
      '3|wet': { s: '#8e8a80', k: '#474439' },
      asphalt: { s: '#4a4a4e', k: '#26262a' }
    };

    /** Style keys by grade and terrain family, so no key is built per tile. */
    const SURFACE_KEYS: Record<number, Record<string, string>> = {
      1: { temperate: '1|temperate', arid: '1|arid', cold: '1|cold', wet: '1|wet' },
      2: { temperate: '2|temperate', arid: '2|arid', cold: '2|cold', wet: '2|wet' },
      3: { temperate: '3|temperate', arid: '3|arid', cold: '3|cold', wet: '3|wet' }
    };

    const widthFor = (level: number): number =>
      Math.max(1, Math.min(tileSize * (level >= 3 ? 0.38 : level === 2 ? 0.30 : 0.22), tileSize - 1.5));

    const cxx = (x: number): number => x * tileSize + baseSX + tileSize / 2;
    const cyy = (y: number): number => y * tileSize + baseSY + tileSize / 2;

    const DIRS = ROAD_DIRS;

    // One tile of margin so a road leaving the viewport still joins up to the
    // half its neighbour draws.
    const x0 = Math.max(0, minX - 1);
    const x1 = Math.min(tileMap.width - 1, maxX + 1);
    const y0 = Math.max(0, minY - 1);
    const y1 = Math.min(tileMap.height - 1, maxY + 1);

    // The graph build asks about each tile's neighbours from up to eight
    // directions, and each of those asks again to prune the diagonals — two
    // dozen lookups per road tile, every frame, on a map that can hold
    // thousands of them. Read the window once into a flat grid instead.
    const gw = x1 - x0 + 3;
    const gh = y1 - y0 + 3;
    const levels = new Uint8Array(gw * gh);
    for (let x = Math.max(0, x0 - 1); x <= Math.min(tileMap.width - 1, x1 + 1); x++) {
      const column = tileMap.grid[x];
      const base = (x - x0 + 1) * gh - y0 + 1;
      for (let y = Math.max(0, y0 - 1); y <= Math.min(tileMap.height - 1, y1 + 1); y++) {
        levels[base + y] = column[y].roadLevelEffective;
      }
    }
    /** Road grade at a tile, for coordinates inside the cached window. */
    const gradeAt = (x: number, y: number): number =>
      (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) ? 0 : levels[(x - x0 + 1) * gh + (y - y0 + 1)];

    const nodes: RoadNode[] = [];
    const paths = new Map<string, Path2D>();
    const pathFor = (key: string): Path2D => {
      let p = paths.get(key);
      if (!p) { p = new Path2D(); paths.set(key, p); }
      return p;
    };

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const level = gradeAt(x, y);
        if (level <= 0) continue;
        const tile = tileMap.grid[x][y];

        const links: number[] = [];
        for (let d = 0; d < 8; d++) {
          const [dx, dy] = DIRS[d];
          if (gradeAt(x + dx, y + dy) <= 0) continue;
          if (dx !== 0 && dy !== 0) {
            // The corner is already turned the long way round: drawing the
            // shortcut as well would fill the bend in as a triangle.
            if (gradeAt(x + dx, y) > 0 || gradeAt(x, y + dy) > 0) continue;
          }
          links.push(d);
        }

        const kingdom = tile.kingdomId ? kingdoms.get(tile.kingdomId) : undefined;
        const era = kingdom ? kingdom.research.currentEra() : 'stone';
        const modern = era === 'industrial' || era === 'modern';
        const water = this.isWater(tile.type);
        const family = roadSurfaceFamily(water ? TerrainType.SOIL : tile.type);
        const key = level >= 3 && modern ? 'asphalt' : SURFACE_KEYS[level][family];

        // The bearing of the road through the tile: the line between its two
        // ends where it has two, otherwise whichever end it has.
        const head = DIRS[links[0] ?? 0];
        const tail = DIRS[links[links.length - 1] ?? 0];
        const ax = links.length >= 2 ? head[0] - tail[0] : head[0];
        const ay = links.length >= 2 ? head[1] - tail[1] : head[1];
        const alen = Math.hypot(ax, ay) || 1;

        const node: RoadNode = {
          x, y, tile, level, key,
          width: widthFor(level),
          links,
          ax: ax / alen, ay: ay / alen,
          straight: links.length === 2 && head[0] === -tail[0] && head[1] === -tail[1],
          water
        };
        nodes.push(node);

        // Water is carried on a structure, not surfaced — it is drawn later,
        // along its own bearing, and must not be part of the road body.
        if (water) continue;

        const px = cxx(x);
        const py = cyy(y);
        const half = tileSize / 2;
        const path = pathFor(key);
        if (links.length === 0) {
          path.moveTo(px, py);
          path.lineTo(px + 0.01, py);
        } else if (links.length === 2) {
          const a = DIRS[links[0]];
          const b = DIRS[links[1]];
          path.moveTo(px + a[0] * half, py + a[1] * half);
          path.quadraticCurveTo(px, py, px + b[0] * half, py + b[1] * half);
        } else {
          // A terminus or a junction: spokes from the centre. Round caps and
          // joins fuse them into one knuckle without a separate pad.
          for (const d of links) {
            const [dx, dy] = DIRS[d];
            path.moveTo(px, py);
            path.lineTo(px + dx * half, py + dy * half);
          }
        }
      }
    }

    if (nodes.length === 0) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Lowest grade first, so where a track meets a highway the highway carries
    // through the junction and the track ends against it — the way a minor
    // road joins a major one, rather than laying its kerb across it.
    const levelOf = (key: string): number => (key === 'asphalt' ? 3 : Number(key[0]));
    const layers = [...paths.entries()].sort((a, b) => levelOf(a[0]) - levelOf(b[0]));

    // The verge: a road on open ground is a raised bed, and what reads as the
    // bed is the ground losing its light either side of it.
    if (detail >= 1) {
      ctx.strokeStyle = 'rgba(24, 20, 16, 0.18)';
      for (const [key, path] of layers) {
        ctx.lineWidth = widthFor(levelOf(key)) + tileSize * 0.16;
        ctx.stroke(path);
      }
    }

    // Kerb and cut edge, then the running surface — each grade laid complete
    // before the next, so a junction reads as one road crossing another.
    for (const [key, path] of layers) {
      if (detail >= 1) {
        ctx.strokeStyle = SURFACES[key].k;
        ctx.lineWidth = widthFor(levelOf(key)) + Math.max(1.5, tileSize * 0.10);
        ctx.stroke(path);
      }
      ctx.strokeStyle = SURFACES[key].s;
      ctx.lineWidth = detail >= 1 ? widthFor(levelOf(key)) : Math.max(1, widthFor(levelOf(key)) * 0.9);
      ctx.stroke(path);
    }

    if (detail === 0) {
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      return;
    }

    // ---- Bridges. A crossing is one structure, not a row of water tiles that
    //      happen to carry road paint, so the water nodes are first chained
    //      into whole crossings and each is then built out of the slices of a
    //      model chosen from what the settlement could afford and knew how.
    this.drawCrossings(nodes, tileMap, kingdoms, cxx, cyy, tileSize, fine);

    if (detail < 2) {
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      return;
    }

    // ---- Close-range surface: everything below here is what the road is made
    //      of and what the ground has done to it.
    //
    // Every mark is accumulated into a Path2D shared by everything of its
    // kind and drawn once at the end. A road tile carries a dozen small marks,
    // and a screen can hold hundreds of road tiles; issuing each as its own
    // stroke costs more than all the road geometry put together.
    interface Mark { path: Path2D; colour: string; width: number; dash?: [number, number]; fill: boolean }
    const marks = new Map<string, Mark>();
    const strokeMark = (id: string, colour: string, width: number, dash?: [number, number]): Path2D => {
      let m = marks.get(id);
      if (!m) { m = { path: new Path2D(), colour, width, dash, fill: false }; marks.set(id, m); }
      return m.path;
    };
    const fillMark = (id: string, colour: string): Path2D => {
      let m = marks.get(id);
      if (!m) { m = { path: new Path2D(), colour, width: 0, fill: true }; marks.set(id, m); }
      return m.path;
    };
    /** Relief and wear are continuous; three steps is all the eye resolves. */
    const step = (v: number): number => (v < 0.45 ? 0 : v < 0.75 ? 1 : 2);
    const STEP_AT = [0.3, 0.6, 0.95];

    const townSquares = new Set<string>();
    for (const city of cities.values()) townSquares.add(`${Math.floor(city.x)},${Math.floor(city.y)}`);

    for (const node of nodes) {
      if (node.water) continue;
      const { x, y, tile, level, width: w } = node;
      const px = cxx(x);
      const py = cyy(y);
      const ax = node.ax;
      const ay = node.ay;
      const nx = -ay;
      const ny = ax;
      const surface = SURFACES[node.key];

      // Everything below runs *along* the road, so it is only drawn where the
      // road actually runs straight through the tile. On a bend the chord is
      // not the road, and at a dead end the line would carry on into open
      // ground — which is exactly how markings sprout whiskers off the end of
      // a cul-de-sac. Junctions and bends stay plain, as they do in life.
      if (!node.straight) {
        if (tile.cityId && townSquares.has(`${x},${y}`)) this.drawTownSquare(px, py, level, tileSize, surface.k);
        // A fingerpost belongs where the road divides and nowhere else.
        if (fine && node.links.length >= 3 && !tile.cityId) {
          this.drawRoadProp('signpost', px + nx * tileSize * 0.42, py + ny * tileSize * 0.42, tileSize, x + y);
        }
        continue;
      }
      // Half-length of the road within the tile: to the edge on a cardinal
      // run, to the corner on a diagonal one.
      const reach = tileSize * 0.5 / Math.max(Math.abs(ax), Math.abs(ay));
      const along = (path: Path2D, offset: number): void => {
        path.moveTo(px + nx * offset - ax * reach, py + ny * offset - ay * reach);
        path.lineTo(px + nx * offset + ax * reach, py + ny * offset + ay * reach);
      };

      // Cut and fill. A road across a slope is a bench: the uphill side is a
      // cut face catching the light, the downhill side an embankment throwing
      // a shadow. This is the single detail that makes a road read as sitting
      // *in* the terrain rather than painted on top of it.
      const hE = tileMap.getTile(x + 1, y)?.height ?? tile.height;
      const hW = tileMap.getTile(x - 1, y)?.height ?? tile.height;
      const hS = tileMap.getTile(x, y + 1)?.height ?? tile.height;
      const hN = tileMap.getTile(x, y - 1)?.height ?? tile.height;
      const across = (hE - hW) * 0.5 * nx + (hS - hN) * 0.5 * ny; // +ve: uphill on the +n side
      // Scaled against the median tile-to-tile step of the height field, so
      // ordinary rolling country shows a bench and only flat ground shows none.
      const relief = Math.min(1, Math.abs(across) / 0.012);
      if (relief > 0.18) {
        const b = step(relief);
        const uphill = across >= 0 ? 1 : -1;
        const edge = w / 2 + Math.max(0.6, tileSize * 0.04);
        along(strokeMark(`cutL${level}${b}`, `rgba(255, 248, 235, ${0.10 + 0.18 * STEP_AT[b]})`, Math.max(1, tileSize * 0.05)), edge * uphill);
        along(strokeMark(`cutD${level}${b}`, `rgba(12, 10, 8, ${0.16 + 0.26 * STEP_AT[b]})`, Math.max(1, tileSize * 0.07)), -edge * uphill);
      }

      // Camber: made ground is crowned so it sheds water.
      if (level >= 2) {
        along(strokeMark(`camber${level}`, 'rgba(255, 252, 245, 0.10)', Math.max(1, w * 0.28)), 0);
      }

      if (level === 1 && fine) {
        // Wheel ruts, worn where the axles put them.
        const rut = strokeMark('rut', 'rgba(30, 22, 14, 0.35)', Math.max(1, tileSize * 0.035));
        along(rut, w * 0.28);
        along(rut, -w * 0.28);
      } else if (level === 2 && fine) {
        // Setts. Scattered stones catching the light, not courses at a fixed
        // pitch: anything laid to a regular pitch across the road reads as
        // sleepers from three tiles away, and a road is not a railway.
        this.setHashBase(x, y);
        const sett = Math.max(1, tileSize * 0.075);
        const light = fillMark('settLight', 'rgba(255, 251, 242, 0.11)');
        const dark = fillMark('settDark', 'rgba(28, 25, 21, 0.14)');
        for (let i = 0; i < 5; i++) {
          const t = (this.h(i * 2) - 0.5) * reach * 1.85;
          const o = (this.h(i * 2 + 1) - 0.5) * w * 0.78;
          (i % 2 === 0 ? light : dark)
            .rect(px + ax * t + nx * o - sett / 2, py + ay * t + ny * o - sett / 2, sett, sett);
        }
        along(strokeMark('settJoint', 'rgba(30, 28, 24, 0.10)', Math.max(1, tileSize * 0.02)), 0);
      } else if (level >= 3) {
        if (node.key === 'asphalt') {
          along(strokeMark('lane', 'rgba(232, 200, 90, 0.55)', Math.max(1, tileSize * 0.035),
            [Math.max(2, tileSize * 0.16), Math.max(2, tileSize * 0.14)]), 0);
          const edge = strokeMark('laneEdge', 'rgba(238, 236, 230, 0.30)', Math.max(1, tileSize * 0.025));
          along(edge, w * 0.40);
          along(edge, -w * 0.40);
        } else if (fine) {
          // A dressed imperial way: kerbstones down both edges, and slabs
          // broad enough that only a few show per tile.
          const kerb = strokeMark('imperialKerb', 'rgba(245, 240, 230, 0.22)', Math.max(1, tileSize * 0.03));
          along(kerb, w * 0.42);
          along(kerb, -w * 0.42);
          this.setHashBase(x, y);
          const slab = Math.max(1, tileSize * 0.12);
          const light = fillMark('slabLight', 'rgba(255, 251, 242, 0.10)');
          const dark = fillMark('slabDark', 'rgba(38, 34, 28, 0.10)');
          for (let i = 0; i < 4; i++) {
            const t = (this.h(i * 2 + 16) - 0.5) * reach * 1.7;
            const o = (this.h(i * 2 + 17) - 0.5) * w * 0.6;
            (i % 2 === 0 ? light : dark)
              .rect(px + ax * t + nx * o - slab / 2, py + ay * t + ny * o - slab / 2, slab, slab);
          }
        }
      }

      // Wear. War-damaged surfaces break up before they drop a whole grade.
      if (fine && tile.roadDamage > 0.15) {
        this.setHashBase(x, y);
        const b = step(tile.roadDamage);
        const holes = Math.min(5, 1 + Math.floor(tile.roadDamage * 5));
        const pit = fillMark(`pothole${b}`, `rgba(26, 20, 14, ${0.30 + 0.35 * STEP_AT[b]})`);
        const angle = Math.atan2(ay, ax);
        for (let i = 0; i < holes; i++) {
          const t = (this.h(i * 2) - 0.5) * reach * 1.6;
          const o = (this.h(i * 2 + 1) - 0.5) * w * 0.8;
          pit.ellipse(
            px + ax * t + nx * o, py + ay * t + ny * o,
            Math.max(0.8, tileSize * 0.05), Math.max(0.6, tileSize * 0.035),
            angle, 0, Math.PI * 2
          );
        }
      }

      // A grade change is a joint in the pavement, not a fade.
      for (const d of node.links) {
        const [dx, dy] = DIRS[d];
        if (gradeAt(x + dx, y + dy) === level) continue;
        const ex = px + dx * tileSize * 0.5;
        const ey = py + dy * tileSize * 0.5;
        const jn = Math.hypot(dx, dy);
        const joint = strokeMark('gradeJoint', 'rgba(20, 17, 14, 0.55)', Math.max(1, tileSize * 0.04));
        joint.moveTo(ex + (-dy / jn) * w * 0.55, ey + (dx / jn) * w * 0.55);
        joint.lineTo(ex - (-dy / jn) * w * 0.55, ey - (dx / jn) * w * 0.55);
      }

      // What stands beside the road out in open country. A measured road
      // carries its milestones; a shrine turns up at long intervals where
      // travellers were glad to arrive. Both are deterministic in the tile
      // position, so they never crawl about between frames.
      if (fine && !tile.cityId) {
        const hash = (x * 7 + y * 3) % 23;
        const prop = level >= 2 && hash === 0 ? 'milestone' : hash === 11 && level >= 1 ? 'shrine' : null;
        if (prop) {
          const side = (x + y) % 2 === 0 ? 1 : -1;
          const off = side * (w / 2 + tileSize * 0.2);
          this.drawRoadProp(prop, px + nx * off, py + ny * off, tileSize, x + y);
        }
      }

      // Street lighting: only on a modern paved road, and only where there is
      // a settlement to pay the lamplighter.
      if (fine && node.key === 'asphalt' && tile.cityId && (x + y) % 3 === 0) {
        const side = (x + y) % 6 === 0 ? 1 : -1; // staggered, as they are laid out
        const off = side * (w / 2 + tileSize * 0.16);
        this.drawRoadProp('lamp', px + nx * off, py + ny * off, tileSize, x);
        // The pool of light the lantern throws, which the sprite cannot cast.
        ctx.fillStyle = 'rgba(255, 224, 150, 0.13)';
        ctx.beginPath();
        ctx.arc(px + nx * off, py + ny * off, tileSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // A town square where the road reaches the heart of the settlement —
      // once per city, not once per paved tile inside it.
      if (tile.cityId && townSquares.has(`${x},${y}`)) this.drawTownSquare(px, py, level, tileSize, surface.k);
    }

    for (const mark of marks.values()) {
      if (mark.fill) {
        ctx.fillStyle = mark.colour;
        ctx.fill(mark.path);
        continue;
      }
      ctx.strokeStyle = mark.colour;
      ctx.lineWidth = mark.width;
      if (mark.dash) ctx.setLineDash(mark.dash);
      ctx.stroke(mark.path);
      if (mark.dash) ctx.setLineDash([]);
    }

    // Frontier posts, where a road of substance crosses between two realms.
    for (const node of nodes) {
      if (node.water || node.level < 2) continue;
      for (const d of node.links) {
        if (d > 3) continue; // each pair considered once
        const [dx, dy] = DIRS[d];
        const near = node.tile;
        const far = tileMap.getTile(node.x + dx, node.y + dy);
        if (!far || !near.kingdomId || !far.kingdomId || near.kingdomId === far.kingdomId) continue;
        if (!kingdoms.has(near.kingdomId) || !kingdoms.has(far.kingdomId)) continue;
        this.drawRoadProp(
          'frontier',
          cxx(node.x) + dx * tileSize * 0.5, cyy(node.y) + dy * tileSize * 0.5,
          tileSize, node.x + node.y, Math.atan2(dy, dx) + Math.PI / 2
        );
      }
    }

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }

  /**
   * Builds every bridge on screen.
   *
   * Water road tiles are first chained into whole crossings, because a bridge
   * is one structure and not a run of independent tiles: the model, the span
   * it is priced for, and the abutments at either end are all properties of
   * the crossing, not of any tile in it. Each crossing is then laid out from
   * the model's slices — an approach at each landfall, spans between — placed
   * at each tile's own centre and turned to that tile's own bearing, so a
   * crossing taken diagonally, or one that bends, still reads as one bridge.
   */
  private drawCrossings(
    nodes: RoadNode[],
    tileMap: TileMap,
    kingdoms: Map<string, Kingdom>,
    cxx: (x: number) => number,
    cyy: (y: number) => number,
    tileSize: number,
    fine: boolean
  ): void {
    const water = nodes.filter(n => n.water && n.links.length > 0);
    if (water.length === 0) return;

    const byKey = new Map<string, RoadNode>();
    for (const n of water) byKey.set(`${n.x},${n.y}`, n);
    /** The neighbours of a water node that are themselves out over the water. */
    const wetLinks = (n: RoadNode): RoadNode[] => {
      const out: RoadNode[] = [];
      for (const d of n.links) {
        const next = byKey.get(`${n.x + ROAD_DIRS[d][0]},${n.y + ROAD_DIRS[d][1]}`);
        if (next) out.push(next);
      }
      return out;
    };

    // Chain the water tiles, starting from the banks so a crossing is walked
    // landfall to landfall. Anything left over is a loop and can start anywhere.
    const seen = new Set<RoadNode>();
    const crossings: RoadNode[][] = [];
    const walk = (start: RoadNode): void => {
      const chain: RoadNode[] = [];
      let current: RoadNode | undefined = start;
      let previous: RoadNode | undefined;
      while (current && !seen.has(current)) {
        seen.add(current);
        chain.push(current);
        const next: RoadNode | undefined = wetLinks(current).find(n => n !== previous && !seen.has(n));
        previous = current;
        current = next;
      }
      if (chain.length > 0) crossings.push(chain);
    };
    for (const n of water) if (!seen.has(n) && wetLinks(n).length <= 1) walk(n);
    for (const n of water) if (!seen.has(n)) walk(n);

    const ctx = this.ctx;
    for (const chain of crossings) {
      const head = chain[0];
      const kingdom = head.tile.kingdomId ? kingdoms.get(head.tile.kingdomId) : undefined;
      const era = kingdom ? kingdom.research.currentEra() : 'stone';
      // Timber rots in the wet and splits in the frost, which is the whole
      // reason a covered bridge exists — so the climate at the crossing, not
      // a random roll, decides whether this one has a roof.
      const bank = tileMap.getTile(head.x, head.y);
      const harsh = !!bank && (bank.temperature < 4 || bank.moisture > 0.72);
      const model = bridgeModelFor(head.level, era, chain.length, harsh);
      const half = BRIDGE_HALF_WIDTH[model] * tileSize;

      // The shadow the deck throws on the water, laid down under the whole
      // crossing first so consecutive bays do not stripe each other.
      if (throwsShadow(model)) {
        ctx.fillStyle = 'rgba(6, 16, 28, 0.4)';
        for (const n of chain) {
          ctx.save();
          ctx.translate(cxx(n.x) + tileSize * 0.07, cyy(n.y) + tileSize * 0.11);
          ctx.rotate(Math.atan2(n.ay, n.ax));
          ctx.fillRect(-tileSize * 0.52, -half, tileSize * 1.04, half * 2);
          ctx.restore();
        }
      }

      const smoothing = ctx.imageSmoothingEnabled;
      // Pixel art stays pixel art on the way up; only a heavy downscale, where
      // nearest-neighbour would drop whole rows of the lattice, is smoothed.
      ctx.imageSmoothingEnabled = tileSize < BRIDGE_SLICE_PX * 0.75;
      for (let i = 0; i < chain.length; i++) {
        const n = chain[i];
        const end = chain.length === 1 ? 'single' : i === 0 || i === chain.length - 1 ? 'approach' : 'span';
        const sprite = bridgeSprite(model, end);
        // An abutment is founded on the bank, not on the water — so a landfall
        // slice runs a quarter-tile past the last wet tile and sits on dry
        // ground. Without that the bridge appears to start in mid-river.
        const bite = end === 'span' ? 0 : tileSize * 0.26;
        const left = -tileSize * 0.52 - bite;
        const length = tileSize * 1.04 + bite * (end === 'single' ? 2 : 1);
        ctx.save();
        ctx.translate(cxx(n.x), cyy(n.y));
        ctx.rotate(Math.atan2(n.ay, n.ax));
        // Approaches are drawn with the landfall on the left, so the far end
        // is the same slice turned round.
        if (end === 'approach' && i > 0) ctx.scale(-1, 1);
        ctx.drawImage(sprite, left, -half * 1.14, length, half * 2.28);
        ctx.restore();
      }
      ctx.imageSmoothingEnabled = smoothing;

      // A named bridge carries its name. Nothing else on the map outside a
      // settlement is labelled, which is the point: a great bridge is the only
      // piece of infrastructure a realm ever bothers to name.
      if (fine && head.tile.bridgeName) {
        const a = chain[0];
        const b = chain[chain.length - 1];
        const lx = (cxx(a.x) + cxx(b.x)) / 2;
        const ly = (cyy(a.y) + cyy(b.y)) / 2 - half - tileSize * 0.34;
        const size = Math.max(9, Math.min(15, tileSize * 0.34));
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `600 ${size}px 'Outfit', sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(head.tile.bridgeName, lx + 1, ly + 1);
        ctx.fillStyle = '#f2e2b8';
        ctx.fillText(head.tile.bridgeName, lx, ly);
        ctx.restore();
      }

      // The main cable: the one part of a bridge that a repeating slice cannot
      // express, because its whole character is that it sags between towers.
      if (fine && needsCable(model) && chain.length >= 2) {
        const a = chain[0];
        const b = chain[chain.length - 1];
        const ax = cxx(a.x);
        const ay = cyy(a.y);
        const bx = cxx(b.x);
        const by = cyy(b.y);
        const nx = -(by - ay);
        const ny = bx - ax;
        const len = Math.hypot(nx, ny) || 1;
        const top = tileSize * 0.34;
        for (const side of [-1, 1]) {
          const ox = (nx / len) * half * 0.86 * side;
          const oy = (ny / len) * half * 0.86 * side;
          // The sag: the cable is pulled toward the deck at midspan and rises
          // to the tower tops at the ends.
          const sagX = (ax + bx) / 2 + ox - (nx / len) * top * side;
          const sagY = (ay + by) / 2 + oy - (ny / len) * top * side;
          ctx.strokeStyle = '#0f1215';
          ctx.lineWidth = Math.max(1.5, tileSize * 0.055);
          ctx.beginPath();
          ctx.moveTo(ax + ox, ay + oy);
          ctx.quadraticCurveTo(sagX, sagY, bx + ox, by + oy);
          ctx.stroke();
          ctx.strokeStyle = '#98a1aa';
          ctx.lineWidth = Math.max(1, tileSize * 0.03);
          ctx.stroke();
        }
      }
    }
  }

  /**
   * Places a roadside prop. Props stand upright regardless of which way the
   * road runs — a milestone does not lie down because the road turned — so
   * only the frontier marker, which straddles the carriageway, takes a
   * bearing. The sprite is anchored at its foot so it appears to stand on the
   * verge rather than hover over it.
   */
  private drawRoadProp(
    prop: RoadProp,
    px: number, py: number,
    tileSize: number,
    seed: number,
    bearing?: number
  ): void {
    const ctx = this.ctx;
    const sprite = roadProp(prop, seed);
    const h = tileSize * PROP_SCALE[prop];
    const w = h * propAspect(prop);
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = h < sprite.height * 0.75;
    if (bearing === undefined) {
      ctx.drawImage(sprite, px - w / 2, py - h * 0.82, w, h);
    } else {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(bearing);
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = smoothing;
  }

  /**
   * The square at the heart of a settlement: an apron of cobbles the roads run
   * out of, with a fountain where the town could afford masonry and a well
   * where it could not.
   */
  private drawTownSquare(px: number, py: number, level: number, tileSize: number, kerb: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(96, 91, 84, 0.55)';
    ctx.beginPath();
    ctx.arc(px, py, tileSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = kerb;
    ctx.lineWidth = Math.max(1, tileSize * 0.045);
    ctx.stroke();
    // Cobbles set in rings, the way a square is actually paved.
    ctx.strokeStyle = 'rgba(140, 132, 122, 0.3)';
    ctx.lineWidth = Math.max(1, tileSize * 0.028);
    for (const r of [0.36, 0.24]) {
      ctx.beginPath();
      ctx.arc(px, py, tileSize * r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (level >= 2) {
      ctx.fillStyle = kerb;
      ctx.beginPath();
      ctx.arc(px, py, tileSize * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(96, 165, 200, 0.6)';
      ctx.beginPath();
      ctx.arc(px, py, tileSize * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#241f1a';
      ctx.beginPath();
      ctx.arc(px, py, tileSize * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6f665c';
      ctx.lineWidth = Math.max(1, tileSize * 0.03);
      ctx.stroke();
    }
  }
}
