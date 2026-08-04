import { Camera } from './Camera';
import { TileMap } from '../world/TileMap';
import { TerrainType } from '../world/Biomes';
import type { Tile } from '../world/Tile';
import { Entity } from '../entities/Entity';
import { SpeciesType, SPECIES_DEFINITIONS } from '../entities/Species';
import { Kingdom } from '../civ/Kingdom';
import { City } from '../civ/City';
import { ParticleManager } from './Particles';
import { OverlayMode } from './Overlays';
import { WorldEra } from '../world/WeatherEras';
import { SpriteGenerator, type EntitySpriteAnimation, type SpriteDirection } from './SpriteGenerator';
import { SpriteRegistry } from './SpriteRegistry';
import { PixelIcons } from './PixelIcons';
import { DiplomacyManager } from '../civ/Diplomacy';
import { Ship, SHIP_TIERS } from '../civ/NavalSystem';
import { OverlandCaravan } from '../civ/CaravanSystem';
import { GOODS, type GoodTier } from '../civ/Goods';

/** Deposit tiers so plentiful that drawing every one clutters the whole map. */
const COMMON_NODE_TIERS = new Set<GoodTier>(['common']);
import {
  RESOURCE_COLORS,
  TERRAIN_VISUALS,
  clamp,
  mixColor,
  parseColor,
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

export class PixelRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animTimer: number = 0;
  private diplomacy: DiplomacyManager | null = null;
  private options: RenderOptions = { ...DEFAULT_RENDER_OPTIONS };
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
  private readonly bakeTileSize: number = 16;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  public setDiplomacy(diplomacy: DiplomacyManager): void {
    this.diplomacy = diplomacy;
  }

  public setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
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

  private getAnimationFrame(e: Entity, animation: EntitySpriteAnimation, idHash: number): number {
    const rate = animation === 'attack' || animation === 'shoot' ? 11
      : animation === 'flee' ? 13
      : animation === 'walk' || animation === 'carry' ? 8
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
    tileMap.markAllDirty();
  }

  /** Redraw dirty static tiles into the bake canvas. Animated water/lava tiles are cleared to transparent (drawn per frame). */
  private bakeDirtyTiles(tileMap: TileMap): void {
    if (!this.terrainCtx || tileMap.dirtyTiles.size === 0) return;
    const savedCtx = this.ctx;
    this.ctx = this.terrainCtx;
    const W = tileMap.width;
    const H = tileMap.height;
    for (const idx of tileMap.dirtyTiles) {
      const x = Math.floor(idx / H);
      const y = idx - x * H;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      this.bakeStaticTile(tileMap, x, y);
    }
    this.ctx = savedCtx;
    tileMap.dirtyTiles.clear();
  }

  private bakeStaticTile(tileMap: TileMap, x: number, y: number): void {
    const tile = tileMap.grid[x][y];
    const ts = this.bakeTileSize;
    const bx = x * ts;
    const by = y * ts;
    this.ctx.clearRect(bx, by, ts, ts);
    // Animated surfaces stay transparent in the bake (drawn per frame).
    if (this.isWater(tile.type) || tile.type === TerrainType.LAVA) return;

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
      // Deep ocean is deliberately quiet; shallow water carries a little more life.
      if (roll > (shallow ? 0.56 : 0.78)) {
        const wavePhase = Math.sin((x + y * 0.72) * 0.33 + this.animTimer * (shallow ? 0.72 : 0.42));
        const lineY = screenY + tileSize * (0.28 + ((wavePhase + 1) * 0.5) * 0.42);
        const lineX = screenX + tileSize * (0.12 + this.h(222) * 0.28);
        const lineW = tileSize * (0.24 + macro * 0.32);
        this.ctx.fillStyle = withAlpha(visual.accent, shallow ? 0.17 : 0.09);
        this.ctx.fillRect(
          Math.floor(lineX),
          Math.floor(lineY),
          Math.max(1, Math.floor(lineW)),
          Math.max(1, Math.floor(tileSize * 0.045))
        );
      }

      // Very rare specular pixel. This is intentionally much rarer than the old
      // per-tile wave lines and keeps ships readable over the ocean.
      const accent = terrainAccentColor(tile, x, y, this.animTimer);
      if (accent && tileSize >= 9) {
        this.ctx.fillStyle = withAlpha(accent, shallow ? 0.42 : 0.28);
        const px = screenX + tileSize * (0.24 + this.h(224) * 0.52);
        const py = screenY + tileSize * (0.2 + this.h(225) * 0.54);
        this.ctx.fillRect(Math.floor(px), Math.floor(py), Math.max(1, tileSize * 0.055), Math.max(1, tileSize * 0.035));
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
    railways?: { yearlyFreight: number }
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.fillStyle = '#090d16';
    this.ctx.fillRect(0, 0, width, height);
    this.animTimer = (this.animTimer + 0.04) % 628.318;

    // Determine visible tile bounds
    const topLeft = camera.screenToWorld(0, 0, width, height);
    const bottomRight = camera.screenToWorld(width, height, width, height);

    const minX = Math.max(0, Math.floor(topLeft.x));
    const maxX = Math.min(tileMap.width - 1, Math.ceil(bottomRight.x));
    const minY = Math.max(0, Math.floor(topLeft.y));
    const maxY = Math.min(tileMap.height - 1, Math.ceil(bottomRight.y));

    const tileSize = camera.tileSize * camera.zoom;
    const baseSX = width / 2 + camera.frameShakeX - camera.x * camera.zoom;
    const baseSY = height / 2 + camera.frameShakeY - camera.y * camera.zoom;

    // ========== 1. RENDER TERRAIN TILES ==========
    // Static (non-animated) terrain is baked into an offscreen canvas once and only
    // redrawn per dirty tile; the bake covers base+texture+relief+edges+details.
    // Animated water/lava and overlay modes fall back to per-tile drawing.
    const useBake = overlayMode === 'none';
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
    }

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const tile = tileMap.grid[x][y];
        const sx = x * tileSize + baseSX;
        const sy = y * tileSize + baseSY;
        // Per-frame: animated surfaces (water/lava) or full path when overlay is active.
        if (!useBake || this.isWater(tile.type) || tile.type === TerrainType.LAVA) {
          this.drawTerrainTile(tileMap, tile, x, y, sx, sy, tileSize, overlayMode);
        }

        // ===== ROAD OVERLAY (LOD: far zoom keeps the cheap tile lattice) =====
        if (tile.roadLevelEffective > 0 && tileSize < 4) {
          const roadW = Math.max(2, Math.min(tileSize * 0.35, tileSize - 2));
          const halfT = tileSize / 2;
          const halfR = roadW / 2;

          // Check 8 neighbors
          const nN = tileMap.getTile(x, y - 1);
          const nS = tileMap.getTile(x, y + 1);
          const nE = tileMap.getTile(x + 1, y);
          const nW = tileMap.getTile(x - 1, y);
          const nNE = tileMap.getTile(x + 1, y - 1);
          const nNW = tileMap.getTile(x - 1, y - 1);
          const nSE = tileMap.getTile(x + 1, y + 1);
          const nSW = tileMap.getTile(x - 1, y + 1);

          const hasN = !!(nN && nN.roadLevelEffective > 0);
          const hasS = !!(nS && nS.roadLevelEffective > 0);
          const hasE = !!(nE && nE.roadLevelEffective > 0);
          const hasW = !!(nW && nW.roadLevelEffective > 0);
          const hasNE = !!(nNE && nNE.roadLevelEffective > 0);
          const hasNW = !!(nNW && nNW.roadLevelEffective > 0);
          const hasSE = !!(nSE && nSE.roadLevelEffective > 0);
          const hasSW = !!(nSW && nSW.roadLevelEffective > 0);

          const roadCity = tile.cityId && cities.has(tile.cityId) ? cities.get(tile.cityId)! : null;
          const roadKingdom = tile.kingdomId && kingdoms.has(tile.kingdomId) ? kingdoms.get(tile.kingdomId)! : null;
          const roadSpecies = roadCity?.species ?? roadKingdom?.species;
          const roadEra = roadKingdom ? roadKingdom.research.currentEra() : 'stone';

          let mainColor = tile.roadLevelEffective === 1 ? '#8b5a2b' : tile.roadLevelEffective === 2 ? '#6b7280' : '#374151';
          let borderColor = tile.roadLevelEffective === 1 ? '#4a2d18' : tile.roadLevelEffective === 2 ? '#374151' : '#9ca3af';

          // Paved roads read as dressed stone; imperial ways get a lighter kerb.
          if (tile.roadLevelEffective >= 2) {
            mainColor = tile.roadLevelEffective === 2 ? '#6b7280' : '#4b5563';
            borderColor = tile.roadLevelEffective === 2 ? '#374151' : '#cbd5e1';
          }

          // Organic edge offset for dirt trails
          const edgeOff = tile.roadLevelEffective === 1 ? Math.sin(x * 3.7 + y * 2.1) * 1 : 0;

          // Render Bridge Deck when road crosses water!
          if (this.isWater(tile.type)) {
            const bridgeColor = tile.roadLevelEffective === 1 ? '#78350f' : tile.roadLevelEffective === 2 ? '#475569' : '#1e293b';
            const railColor = tile.roadLevelEffective === 1 ? '#451a03' : tile.roadLevelEffective === 2 ? '#334155' : '#fbbf24';

            // Bridge base platform
            this.ctx.fillStyle = railColor;
            this.ctx.fillRect(sx, sy, tileSize, tileSize);
            this.ctx.fillStyle = bridgeColor;
            this.ctx.fillRect(sx + 1, sy + 1, tileSize - 2, tileSize - 2);

            // Plank lines for wooden bridge or stone seams
            this.ctx.fillStyle = railColor;
            const step = Math.max(3, Math.floor(tileSize * 0.25));
            for (let p = 2; p < tileSize - 2; p += step) {
              this.ctx.fillRect(sx + 1, sy + p, tileSize - 2, 1);
            }
          }

          // Center node
          this.ctx.fillStyle = borderColor;
          this.ctx.fillRect(sx + halfT - halfR - 1 + edgeOff, sy + halfT - halfR - 1, roadW + 2, roadW + 2);
          this.ctx.fillStyle = mainColor;
          this.ctx.fillRect(sx + halfT - halfR + edgeOff, sy + halfT - halfR, roadW, roadW);

          // Cardinal arms
          if (hasN) {
            this.ctx.fillStyle = borderColor;
            this.ctx.fillRect(sx + halfT - halfR - 1 + edgeOff, sy, roadW + 2, halfT);
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(sx + halfT - halfR + edgeOff, sy, roadW, halfT);
          }
          if (hasS) {
            this.ctx.fillStyle = borderColor;
            this.ctx.fillRect(sx + halfT - halfR - 1 + edgeOff, sy + halfT, roadW + 2, halfT);
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(sx + halfT - halfR + edgeOff, sy + halfT, roadW, halfT);
          }
          if (hasW) {
            this.ctx.fillStyle = borderColor;
            this.ctx.fillRect(sx, sy + halfT - halfR - 1, halfT + edgeOff, roadW + 2);
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(sx, sy + halfT - halfR, halfT + edgeOff, roadW);
          }
          if (hasE) {
            this.ctx.fillStyle = borderColor;
            this.ctx.fillRect(sx + halfT + edgeOff, sy + halfT - halfR - 1, halfT - edgeOff, roadW + 2);
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(sx + halfT + edgeOff, sy + halfT - halfR, halfT - edgeOff, roadW);
          }

          // Diagonal corners: fill the corner quadrant when a diagonal neighbor has a road
          const cSize = Math.max(2, roadW * 0.6);
          if (hasNE) {
            this.ctx.fillStyle = borderColor;
            this.ctx.fillRect(sx + halfT + halfR - 1 + edgeOff, sy + halfT - halfR - cSize, cSize + 1, cSize + 1);
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(sx + halfT + halfR + edgeOff, sy + halfT - halfR - cSize + 1, cSize, cSize);
          }
          if (hasNW) {
            this.ctx.fillStyle = borderColor;
            this.ctx.fillRect(sx + halfT - halfR - cSize + edgeOff, sy + halfT - halfR - cSize, cSize + 1, cSize + 1);
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(sx + halfT - halfR - cSize + edgeOff, sy + halfT - halfR - cSize + 1, cSize, cSize);
          }
          if (hasSE) {
            this.ctx.fillStyle = borderColor;
            this.ctx.fillRect(sx + halfT + halfR - 1 + edgeOff, sy + halfT + halfR - 1, cSize + 1, cSize + 1);
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(sx + halfT + halfR + edgeOff, sy + halfT + halfR, cSize, cSize);
          }
          if (hasSW) {
            this.ctx.fillStyle = borderColor;
            this.ctx.fillRect(sx + halfT - halfR - cSize + edgeOff, sy + halfT + halfR - 1, cSize + 1, cSize + 1);
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(sx + halfT - halfR - cSize + edgeOff, sy + halfT + halfR, cSize, cSize);
          }

          // V4 road furniture: paved roads gain stones, advanced roads gain lane/street accents.
          if (tileSize >= 8 && tile.roadLevelEffective === 2) {
            this.ctx.fillStyle = 'rgba(226,232,240,0.22)';
            this.ctx.fillRect(sx + halfT - 1, sy + halfT - 1, 2, 1);
            if ((x + y) % 2 === 0) this.ctx.fillRect(sx + halfT - halfR + 1, sy + halfT + 2, 1, 1);
          } else if (tileSize >= 8 && tile.roadLevelEffective >= 3) {
            const modernRoad = roadEra === 'industrial' || roadEra === 'modern';
            this.ctx.fillStyle = modernRoad ? 'rgba(250,204,21,0.62)' : 'rgba(226,232,240,0.36)';
            if ((hasN || hasS) && !(hasE || hasW)) {
              this.ctx.fillRect(sx + halfT, sy + tileSize * 0.16, Math.max(1, tileSize * 0.05), tileSize * 0.18);
              this.ctx.fillRect(sx + halfT, sy + tileSize * 0.63, Math.max(1, tileSize * 0.05), tileSize * 0.18);
            } else if ((hasE || hasW) && !(hasN || hasS)) {
              this.ctx.fillRect(sx + tileSize * 0.16, sy + halfT, tileSize * 0.18, Math.max(1, tileSize * 0.05));
              this.ctx.fillRect(sx + tileSize * 0.63, sy + halfT, tileSize * 0.18, Math.max(1, tileSize * 0.05));
            }
            if (roadCity && (roadCity.tier === 'city' || roadCity.tier === 'metropolis') && (x + y) % 4 === 0) {
              this.ctx.fillStyle = '#fde68a'; // Lamp post along a grand street
              this.ctx.fillRect(sx + 1, sy + 1, Math.max(1, tileSize * 0.06), Math.max(1, tileSize * 0.10));
            }
          }
        }

        // ===== KINGDOM TERRITORY PAINT (WorldBox style) =====
        if (tile.kingdomId && kingdoms.has(tile.kingdomId)) {
          const k = kingdoms.get(tile.kingdomId)!;
          this.ctx.fillStyle = overlayMode === 'political' ? k.cachedRgba45 : k.cachedRgba18;
          this.ctx.fillRect(sx, sy, tileSize + 0.5, tileSize + 0.5);

          // Territory border
          if (tileSize > 4) {
            const borderWidth = Math.max(1, tileSize * 0.12);
            this.ctx.fillStyle = k.cachedRgbaBorder;
            if (x > 0 && tileMap.grid[x - 1][y].kingdomId !== tile.kingdomId) {
              this.ctx.fillRect(sx, sy, borderWidth, tileSize);
            }
            if (x < tileMap.width - 1 && tileMap.grid[x + 1][y].kingdomId !== tile.kingdomId) {
              this.ctx.fillRect(sx + tileSize - borderWidth, sy, borderWidth, tileSize);
            }
            if (y > 0 && tileMap.grid[x][y - 1].kingdomId !== tile.kingdomId) {
              this.ctx.fillRect(sx, sy, tileSize, borderWidth);
            }
            if (y < tileMap.height - 1 && tileMap.grid[x][y + 1].kingdomId !== tile.kingdomId) {
              this.ctx.fillRect(sx, sy + tileSize - borderWidth, tileSize, borderWidth);
            }
          }
        }

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

        // ===== TREE & VEGETATION SPRITES with Sway =====
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

    // ========== 1b. ROAD NETWORK POLYLINES (A+C+E) ==========
    this.drawRoadsPass(tileMap, minX, maxX, minY, maxY, tileSize, baseSX, baseSY, cities, kingdoms);

    // ========== 1c. RAILWAYS ==========
    this.drawRailwaysPass(tileMap, minX, maxX, minY, maxY, tileSize, baseSX, baseSY, !!railways && railways.yearlyFreight > 0);

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
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          this.ctx.fillRect(screenPos.x + 3, screenPos.y + tileSize * 0.7, tileSize * 0.9, tileSize * 0.3);

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
          const levelScale = baseScale + landmarkBoost + capitalBoost;
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
    } else for (const e of entities) {
      if (e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY) {
        const screenPos = camera.worldToScreen(e.x, e.y, width, height);

        const idHash = parseInt(e.id.slice(-4) || '0', 16);
        const safeHash = Number.isNaN(idHash) ? 0 : idHash;
        const movement = Math.hypot(e.x - e.prevX, e.y - e.prevY);
        const isMoving = movement > 0.0005 || (e.targetX !== null && e.targetY !== null && e.aiState !== 'idle');
        const direction = this.getEntityDirection(e, isMoving);
        const animation = this.getEntityAnimation(e, isMoving);
        const frame = this.getAnimationFrame(e, animation, safeHash);
        const strideSpeed = Math.min(18, Math.max(8, movement * 350));
        const bob = (animation === 'walk' || animation === 'flee' || animation === 'carry') ? Math.sin(this.animTimer * strideSpeed + safeHash) * 1.2 : 0;
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

        // Ground dust trail effect
        this.ctx.fillStyle = 'rgba(217, 119, 6, 0.25)';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x + caravanSize * 0.5, screenPos.y + caravanSize * 0.8, caravanSize * 0.35, 0, Math.PI * 2);
        this.ctx.fill();

        // Pixel-Art Caravan Sprite
        const spriteKey = `caravan_${caravan.caravanType}`;
        const sprite = SpriteGenerator.has(spriteKey)
          ? SpriteGenerator.getSprite(spriteKey, () => {}, 24, 24)
          : SpriteGenerator.getSprite('caravan_donkey', () => {}, 64, 64);

        this.ctx.save();
        if (caravan.direction < 0) {
          this.ctx.translate(screenPos.x + caravanSize, screenPos.y);
          this.ctx.scale(-1, 1);
          this.ctx.drawImage(sprite, 0, 0, caravanSize, caravanSize);
        } else {
          this.ctx.drawImage(sprite, screenPos.x, screenPos.y, caravanSize, caravanSize);
        }
        this.ctx.restore();

        // Kingdom Banner on Pack Saddle
        if (tileSize > 6) {
          this.ctx.fillStyle = caravan.kingdomColor ?? '#fbbf24';
          this.ctx.fillRect(screenPos.x + caravanSize * 0.4, screenPos.y - 2, 7, 4);
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
    if (this.options.showCityNames && tileSize > 5) {
      this.ctx.textAlign = 'center';
      for (const city of cities.values()) {
        if (city.x < minX || city.x > maxX || city.y < minY || city.y > maxY) continue;
        const screenPos = camera.worldToScreen(city.x, city.y, width, height);
        const k = city.kingdomId ? kingdoms.get(city.kingdomId) : null;
        const fontSize = Math.max(9, Math.min(13, tileSize * 0.6));

        const labelX = screenPos.x + tileSize / 2;
        const labelY = screenPos.y + tileSize * 1.6;

        this.ctx.font = `600 ${fontSize}px 'Outfit', sans-serif`;
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

    // ========== 7. BRUSH CURSOR ==========
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
   * Connected road network drawn as smooth polylines (package A+C+E, refined round 2):
   * - A: continuous center-to-center segments with round caps/joins; dead ends get
   *       Cities:Skylines-style turnaround plazas (paved) or reinforced caps (dirt)
   * - C: level-aware transitions with a dark pavement joint at the grade step; imperial
   *       straight runs gain dashed center lines, edge lines and lamp posts
   * - E: civic accessories — plazas with fountain/well at city entrances, roundabouts
   *       with planted hub and zebra arms, border gates with twin towers, and full
   *       bridges (deck, railings, plank seams, abutments, piers, under-deck shadow)
   */
  private drawRoadsPass(
    tileMap: TileMap,
    minX: number, maxX: number, minY: number, maxY: number,
    tileSize: number, baseSX: number, baseSY: number,
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>
  ): void {
    const ctx = this.ctx;
    const levelColor = (l: number): string => (l >= 3 ? '#fbbf24' : l === 2 ? '#a8a29e' : '#8b5a2b');
    const levelBorder = (l: number): string => (l >= 3 ? '#b45309' : l === 2 ? '#6b7280' : '#4a2d18');
    const roadWidth = (l: number): number =>
      Math.max(2, Math.min(tileSize * (l >= 3 ? 0.42 : l === 2 ? 0.34 : 0.26), tileSize - 2));
    const dashLine = (x1: number, y1: number, x2: number, y2: number, color: string, width: number, dash?: [number, number]): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (dash) ctx.setLineDash([]);
    };
    const lampAt = (lx: number, ly: number): void => {
      const post = Math.max(1, tileSize * 0.04);
      ctx.fillStyle = '#374151';
      ctx.fillRect(lx - post / 2, ly - tileSize * 0.16, post, tileSize * 0.16);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(1.5, tileSize * 0.05), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(3, tileSize * 0.12), 0, Math.PI * 2);
      ctx.fill();
    };

    const roadTiles: { x: number; y: number; l: number }[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const t = tileMap.grid[x][y];
        if (t.roadLevelEffective > 0) roadTiles.push({ x, y, l: t.roadLevelEffective });
      }
    }
    if (roadTiles.length === 0) return;

    const cxx = (x: number): number => x * tileSize + baseSX + tileSize / 2;
    const cyy = (y: number): number => y * tileSize + baseSY + tileSize / 2;

    // Undirected segments emitted toward +x/+y only, so each line is stroked once.
    // lMin/lMax drive the level transition; hx/hy is the higher-level endpoint center.
    const segs: { x1: number; y1: number; x2: number; y2: number; lMin: number; lMax: number; hx: number; hy: number }[] = [];
    for (const r of roadTiles) {
      const e = tileMap.getTile(r.x + 1, r.y);
      if (e && e.roadLevelEffective > 0) {
        const hi = e.roadLevelEffective > r.l;
        segs.push({
          x1: cxx(r.x), y1: cyy(r.y), x2: cxx(r.x + 1), y2: cyy(r.y),
          lMin: Math.min(r.l, e.roadLevelEffective), lMax: Math.max(r.l, e.roadLevelEffective),
          hx: cxx(hi ? r.x + 1 : r.x), hy: cyy(r.y)
        });
      }
      const s = tileMap.getTile(r.x, r.y + 1);
      if (s && s.roadLevelEffective > 0) {
        const hi = s.roadLevelEffective > r.l;
        segs.push({
          x1: cxx(r.x), y1: cyy(r.y), x2: cxx(r.x), y2: cyy(r.y + 1),
          lMin: Math.min(r.l, s.roadLevelEffective), lMax: Math.max(r.l, s.roadLevelEffective),
          hx: cxx(r.x), hy: cyy(hi ? r.y + 1 : r.y)
        });
      }
    }

    // E — stone plaza apron under the road at city entrances, with a cobble paving
    //     ring and a central fountain (paved roads) or well (dirt roads)
    if (tileSize >= 6) {
      for (const r of roadTiles) {
        const t = tileMap.grid[r.x][r.y];
        if (!t.cityId || !cities.has(t.cityId)) continue;
        const pxx = cxx(r.x);
        const pyy = cyy(r.y);
        ctx.fillStyle = 'rgba(87, 83, 78, 0.6)';
        ctx.beginPath();
        ctx.arc(pxx, pyy, tileSize * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(52, 48, 44, 0.85)';
        ctx.lineWidth = Math.max(1, tileSize * 0.05);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120, 113, 108, 0.35)';
        ctx.lineWidth = Math.max(1, tileSize * 0.035);
        ctx.setLineDash([Math.max(2, tileSize * 0.06), Math.max(2, tileSize * 0.05)]);
        ctx.beginPath();
        ctx.arc(pxx, pyy, tileSize * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (r.l >= 2) {
          // fountain: stone ring + water basin + jet
          ctx.fillStyle = levelBorder(r.l);
          ctx.beginPath();
          ctx.arc(pxx, pyy, tileSize * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.beginPath();
          ctx.arc(pxx, pyy, tileSize * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(186, 230, 253, 0.9)';
          ctx.beginPath();
          ctx.arc(pxx, pyy, tileSize * 0.05, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // well: dark shaft + rope ring
          ctx.fillStyle = '#292524';
          ctx.beginPath();
          ctx.arc(pxx, pyy, tileSize * 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#78716c';
          ctx.lineWidth = Math.max(1, tileSize * 0.03);
          ctx.beginPath();
          ctx.arc(pxx, pyy, tileSize * 0.09, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    const outline = tileSize >= 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // A — body strokes. Dirt roads get a soft feathered edge (worn dirt), then a
    //     darker outline when zoomed in, then the surface fill.
    for (const g of segs) {
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1);
      ctx.lineTo(g.x2, g.y2);
      if (g.lMin === 1 && tileSize >= 7) {
        ctx.strokeStyle = 'rgba(139, 90, 43, 0.2)';
        ctx.lineWidth = roadWidth(1) + tileSize * 0.12;
        ctx.stroke();
      }
      if (outline) {
        ctx.strokeStyle = levelBorder(g.lMin);
        ctx.lineWidth = roadWidth(g.lMin) + Math.max(2, tileSize * 0.07);
        ctx.stroke();
      }
      ctx.strokeStyle = levelColor(g.lMin);
      ctx.lineWidth = roadWidth(g.lMin);
      ctx.stroke();
    }

    // A — junction pads at L-bends and 3-way crossings: a single joined pad
    //     unifies the knuckle where two round-capped segments meet
    if (tileSize >= 6) {
      for (const r of roadTiles) {
        const t = tileMap.grid[r.x][r.y];
        if (this.isWater(t.type)) continue;
        const dUp = !!(tileMap.getTile(r.x, r.y - 1)?.roadLevelEffective);
        const dDown = !!(tileMap.getTile(r.x, r.y + 1)?.roadLevelEffective);
        const dLeft = !!(tileMap.getTile(r.x - 1, r.y)?.roadLevelEffective);
        const dRight = !!(tileMap.getTile(r.x + 1, r.y)?.roadLevelEffective);
        const deg = (dUp ? 1 : 0) + (dDown ? 1 : 0) + (dLeft ? 1 : 0) + (dRight ? 1 : 0);
        if (deg === 4 || deg < 2) continue;
        if ((dUp && dDown && !dLeft && !dRight) || (!dUp && !dDown && dLeft && dRight)) continue;
        const pxx = cxx(r.x);
        const pyy = cyy(r.y);
        const padR = roadWidth(r.l) / 2 + Math.max(1, tileSize * 0.04);
        if (outline) {
          ctx.fillStyle = levelBorder(r.l);
          ctx.beginPath();
          ctx.arc(pxx, pyy, padR + 1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = levelColor(r.l);
        ctx.beginPath();
        ctx.arc(pxx, pyy, padR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // A — isolated single-tile roads get a round cap blob with outline
    for (const r of roadTiles) {
      const linked = !!(
        tileMap.getTile(r.x, r.y - 1)?.roadLevelEffective ||
        tileMap.getTile(r.x, r.y + 1)?.roadLevelEffective ||
        tileMap.getTile(r.x - 1, r.y)?.roadLevelEffective ||
        tileMap.getTile(r.x + 1, r.y)?.roadLevelEffective
      );
      if (linked) continue;
      ctx.beginPath();
      ctx.arc(cxx(r.x), cyy(r.y), roadWidth(r.l) / 2 + 1, 0, Math.PI * 2);
      if (outline) {
        ctx.fillStyle = levelBorder(r.l);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cxx(r.x), cyy(r.y), roadWidth(r.l) / 2 - 0.5, 0, Math.PI * 2);
      }
      ctx.fillStyle = levelColor(r.l);
      ctx.fill();
    }

    // C — level transitions: higher grade steps up from its own center to the midpoint,
    //     with a dark pavement joint where the two grades meet
    for (const g of segs) {
      if (g.lMax <= g.lMin) continue;
      ctx.beginPath();
      ctx.moveTo(g.hx, g.hy);
      ctx.lineTo((g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2);
      ctx.strokeStyle = levelColor(g.lMax);
      ctx.lineWidth = roadWidth(g.lMax);
      ctx.stroke();
      // joint seam across the road at the grade step
      if (tileSize >= 7) {
        const jx = (g.x1 + g.x2) / 2;
        const jy = (g.y1 + g.y2) / 2;
        const dx = g.x2 - g.x1;
        const dy = g.y2 - g.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const sw = roadWidth(g.lMax) / 2 + 1;
        ctx.strokeStyle = 'rgba(41, 37, 36, 0.7)';
        ctx.lineWidth = Math.max(1.5, tileSize * 0.04);
        ctx.beginPath();
        ctx.moveTo(jx + nx * sw, jy + ny * sw);
        ctx.lineTo(jx - nx * sw, jy - ny * sw);
        ctx.stroke();
      }
    }

    // A — dead-end terminals: paved roads get a rounded turnaround plaza, dirt roads
    //     a reinforced round cap (Cities:Skylines-style)
    if (tileSize >= 7) {
      for (const r of roadTiles) {
        const dirs: [number, number][] = [];
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          if ((tileMap.getTile(r.x + dx, r.y + dy)?.roadLevelEffective || 0) > 0) dirs.push([dx, dy]);
        }
        if (dirs.length !== 1) continue;
        const [ddx, ddy] = dirs[0];
        const pxx = cxx(r.x);
        const pyy = cyy(r.y);
        const rw = roadWidth(r.l);
        const rt = r.l >= 3 ? tileSize * 0.6 : r.l === 2 ? tileSize * 0.48 : tileSize * 0.3;
        const inset = Math.max(1.5, tileSize * 0.04);
        // turnaround sits beyond the dead end, away from the incoming road (-ddx, -ddy)
        if (ddy === -1) {
          ctx.fillStyle = levelBorder(r.l); ctx.beginPath(); ctx.arc(pxx, pyy, rt, 0, Math.PI); ctx.fill();
          ctx.fillStyle = levelColor(r.l); ctx.beginPath(); ctx.arc(pxx, pyy, rt - inset, 0, Math.PI); ctx.fill();
          ctx.fillRect(pxx - rw / 2, pyy, rw, rt);
        } else if (ddy === 1) {
          ctx.fillStyle = levelBorder(r.l); ctx.beginPath(); ctx.arc(pxx, pyy, rt, Math.PI, Math.PI * 2); ctx.fill();
          ctx.fillStyle = levelColor(r.l); ctx.beginPath(); ctx.arc(pxx, pyy, rt - inset, Math.PI, Math.PI * 2); ctx.fill();
          ctx.fillRect(pxx - rw / 2, pyy - rt, rw, rt);
        } else if (ddx === -1) {
          ctx.fillStyle = levelBorder(r.l); ctx.beginPath(); ctx.arc(pxx, pyy, rt, -Math.PI / 2, Math.PI / 2); ctx.fill();
          ctx.fillStyle = levelColor(r.l); ctx.beginPath(); ctx.arc(pxx, pyy, rt - inset, -Math.PI / 2, Math.PI / 2); ctx.fill();
          ctx.fillRect(pxx, pyy - rw / 2, rt, rw);
        } else {
          ctx.fillStyle = levelBorder(r.l); ctx.beginPath(); ctx.arc(pxx, pyy, rt, Math.PI / 2, (Math.PI * 3) / 2); ctx.fill();
          ctx.fillStyle = levelColor(r.l); ctx.beginPath(); ctx.arc(pxx, pyy, rt - inset, Math.PI / 2, (Math.PI * 3) / 2); ctx.fill();
          ctx.fillRect(pxx - rt, pyy - rw / 2, rt, rw);
        }
      }
    }

    // C+ — imperial (level 3) straight runs get lane markings and lamp posts
    if (tileSize >= 8) {
      for (const r of roadTiles) {
        if (r.l < 3) continue;
        const t = tileMap.grid[r.x][r.y];
        if (this.isWater(t.type)) continue;
        const up = tileMap.getTile(r.x, r.y - 1)?.roadLevelEffective || 0;
        const down = tileMap.getTile(r.x, r.y + 1)?.roadLevelEffective || 0;
        const left = tileMap.getTile(r.x - 1, r.y)?.roadLevelEffective || 0;
        const right = tileMap.getTile(r.x + 1, r.y)?.roadLevelEffective || 0;
        const straightN = up >= 3 && down >= 3 && left === 0 && right === 0;
        const straightE = left >= 3 && right >= 3 && up === 0 && down === 0;
        if (!straightN && !straightE) continue;
        const pxx = r.x * tileSize + baseSX;
        const pyy = r.y * tileSize + baseSY;
        const w = roadWidth(3);
        if (straightN) {
          dashLine(pxx + tileSize / 2, pyy, pxx + tileSize / 2, pyy + tileSize,
            'rgba(120, 53, 15, 0.85)', Math.max(1.5, tileSize * 0.045),
            [Math.max(3, tileSize * 0.14), Math.max(3, tileSize * 0.12)]);
          for (const off of [w * 0.32, -w * 0.32]) {
            dashLine(pxx + tileSize / 2 + off, pyy, pxx + tileSize / 2 + off, pyy + tileSize,
              'rgba(254, 243, 199, 0.35)', Math.max(1, tileSize * 0.03));
          }
          if ((r.x + r.y) % 2 === 0) lampAt(pxx + tileSize / 2 + w * 0.55, pyy + tileSize * 0.5);
          else lampAt(pxx + tileSize / 2 - w * 0.55, pyy + tileSize * 0.5);
        } else {
          dashLine(pxx, pyy + tileSize / 2, pxx + tileSize, pyy + tileSize / 2,
            'rgba(120, 53, 15, 0.85)', Math.max(1.5, tileSize * 0.045),
            [Math.max(3, tileSize * 0.14), Math.max(3, tileSize * 0.12)]);
          for (const off of [w * 0.32, -w * 0.32]) {
            dashLine(pxx, pyy + tileSize / 2 + off, pxx + tileSize, pyy + tileSize / 2 + off,
              'rgba(254, 243, 199, 0.35)', Math.max(1, tileSize * 0.03));
          }
          if ((r.x + r.y) % 2 === 0) lampAt(pxx + tileSize * 0.5, pyy + tileSize / 2 + w * 0.55);
          else lampAt(pxx + tileSize * 0.5, pyy + tileSize / 2 - w * 0.55);
        }
      }
    }

    // E — bridges: deck, railings, plank seams, abutments, piers, under-deck shadow
    for (const r of roadTiles) {
      const t = tileMap.grid[r.x][r.y];
      if (!this.isWater(t.type)) continue;
      const pxx = r.x * tileSize + baseSX;
      const pyy = r.y * tileSize + baseSY;
      const w = roadWidth(r.l);
      const up = tileMap.getTile(r.x, r.y - 1)?.roadLevelEffective || 0;
      const down = tileMap.getTile(r.x, r.y + 1)?.roadLevelEffective || 0;
      const left = tileMap.getTile(r.x - 1, r.y)?.roadLevelEffective || 0;
      const right = tileMap.getTile(r.x + 1, r.y)?.roadLevelEffective || 0;
      const vertical = up > 0 || down > 0;
      const horizontal = left > 0 || right > 0;
      const isV = vertical || (!horizontal && (r.x + r.y) % 2 === 0);
      const deckW = w + 4;

      // under-deck shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      if (isV) ctx.fillRect(pxx + 2 - deckW / 2, pyy + 2, deckW, tileSize);
      else ctx.fillRect(pxx + 2, pyy + 2 - deckW / 2, tileSize, deckW);

      // deck outline + fill
      ctx.fillStyle = levelBorder(r.l);
      if (isV) ctx.fillRect(pxx - deckW / 2 - 1, pyy, deckW + 2, tileSize);
      else ctx.fillRect(pxx, pyy - deckW / 2 - 1, tileSize, deckW + 2);
      ctx.fillStyle = r.l === 1 ? '#78350f' : r.l === 2 ? '#64748b' : '#92400e';
      if (isV) ctx.fillRect(pxx - deckW / 2, pyy + 1, deckW, tileSize - 2);
      else ctx.fillRect(pxx + 1, pyy - deckW / 2, tileSize - 2, deckW);

      // plank seams / pavement joints + railing posts along both sides
      ctx.fillStyle = levelBorder(r.l);
      const step = Math.max(3, Math.floor(tileSize * 0.3));
      const rail = Math.max(1, tileSize * 0.05);
      if (isV) {
        for (let p = step; p < tileSize; p += step) ctx.fillRect(pxx - deckW / 2, pyy + p - 1, deckW, 1);
        ctx.fillRect(pxx - deckW / 2 - 1, pyy, rail, tileSize);
        ctx.fillRect(pxx + deckW / 2, pyy, rail, tileSize);
      } else {
        for (let p = step; p < tileSize; p += step) ctx.fillRect(pxx + p - 1, pyy - deckW / 2, 1, deckW);
        ctx.fillRect(pxx, pyy - deckW / 2 - 1, tileSize, rail);
        ctx.fillRect(pxx, pyy + deckW / 2, tileSize, rail);
      }

      // abutments at landfall
      if (isV) {
        if (up > 0 && !this.isWater(tileMap.grid[r.x][r.y - 1].type)) {
          ctx.fillRect(pxx - deckW / 2 - 2, pyy - 1, deckW + 4, 3);
        }
        if (down > 0 && !this.isWater(tileMap.grid[r.x][r.y + 1].type)) {
          ctx.fillRect(pxx - deckW / 2 - 2, pyy + tileSize - 2, deckW + 4, 3);
        }
      } else {
        if (left > 0 && !this.isWater(tileMap.grid[r.x - 1][r.y].type)) {
          ctx.fillRect(pxx - 1, pyy - deckW / 2 - 2, 3, deckW + 4);
        }
        if (right > 0 && !this.isWater(tileMap.grid[r.x + 1][r.y].type)) {
          ctx.fillRect(pxx + tileSize - 2, pyy - deckW / 2 - 2, 3, deckW + 4);
        }
      }

      // piers under long spans: one at every joint between consecutive water tiles
      ctx.fillStyle = 'rgba(30, 27, 24, 0.85)';
      if (isV) {
        if (down > 0 && this.isWater(tileMap.grid[r.x][r.y + 1].type)) {
          ctx.fillRect(pxx - deckW / 2 - 2, pyy + tileSize - 2, deckW + 4, 3);
        }
        if (up > 0 && this.isWater(tileMap.grid[r.x][r.y - 1].type)) {
          ctx.fillRect(pxx - deckW / 2 - 2, pyy - 1, deckW + 4, 3);
        }
      } else {
        if (right > 0 && this.isWater(tileMap.grid[r.x + 1][r.y].type)) {
          ctx.fillRect(pxx + tileSize - 2, pyy - deckW / 2 - 2, 3, deckW + 4);
        }
        if (left > 0 && this.isWater(tileMap.grid[r.x - 1][r.y].type)) {
          ctx.fillRect(pxx - 1, pyy - deckW / 2 - 2, 3, deckW + 4);
        }
      }
    }

    // E — roundabouts at imperial (level 3) 4-way crossings: kerb ring, amber ring,
    //     planted hub and zebra stripes on the arms
    if (tileSize >= 8) {
      for (const r of roadTiles) {
        if (r.l < 3) continue;
        const t = tileMap.grid[r.x][r.y];
        if (this.isWater(t.type)) continue;
        const up = tileMap.getTile(r.x, r.y - 1)?.roadLevelEffective || 0;
        const down = tileMap.getTile(r.x, r.y + 1)?.roadLevelEffective || 0;
        const left = tileMap.getTile(r.x - 1, r.y)?.roadLevelEffective || 0;
        const right = tileMap.getTile(r.x + 1, r.y)?.roadLevelEffective || 0;
        if (!(up > 0 && down > 0 && left > 0 && right > 0)) continue;
        const pxx = cxx(r.x);
        const pyy = cyy(r.y);
        ctx.fillStyle = levelBorder(3);
        ctx.beginPath();
        ctx.arc(pxx, pyy, tileSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = levelColor(3);
        ctx.beginPath();
        ctx.arc(pxx, pyy, tileSize * 0.23, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(22, 101, 52, 0.85)';
        ctx.beginPath();
        ctx.arc(pxx, pyy, tileSize * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(pxx, pyy, tileSize * 0.045, 0, Math.PI * 2);
        ctx.fill();
        // zebra stripes on each arm
        ctx.fillStyle = 'rgba(41, 37, 36, 0.8)';
        const zw = Math.max(1.5, tileSize * 0.035);
        const zl = tileSize * 0.08;
        for (const [zx, zy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          const sx = zx === 0 ? pxx - zw / 2 : zx > 0 ? pxx + tileSize * 0.27 : pxx - tileSize * 0.27 - zw;
          const sy = zy === 0 ? pyy - zw / 2 : zy > 0 ? pyy + tileSize * 0.27 : pyy - tileSize * 0.27 - zw;
          ctx.fillRect(sx, sy, zx === 0 ? zw : zl, zy === 0 ? zw : zl);
        }
      }

      // E — border gates at kingdom frontiers: twin towers with splayed bases and a
      //     lintel crowned with a light capstone
      for (const r of roadTiles) {
        const t = tileMap.grid[r.x][r.y];
        if (this.isWater(t.type)) continue;
        const pxx = r.x * tileSize + baseSX;
        const pyy = r.y * tileSize + baseSY;
        const w = roadWidth(r.l);
        const upT = tileMap.getTile(r.x, r.y - 1);
        const downT = tileMap.getTile(r.x, r.y + 1);
        const leftT = tileMap.getTile(r.x - 1, r.y);
        const rightT = tileMap.getTile(r.x + 1, r.y);
        const g = Math.max(2, tileSize * 0.06);
        const gh = w + 7;
        const gb = Math.max(2, tileSize * 0.05);
        if (
          rightT && leftT && rightT.roadLevelEffective > 0 && leftT.roadLevelEffective > 0 &&
          rightT.kingdomId && leftT.kingdomId && rightT.kingdomId !== leftT.kingdomId &&
          kingdoms.has(rightT.kingdomId) && kingdoms.has(leftT.kingdomId)
        ) {
          // horizontal road: gate spans vertically (towers flanking + lintel across)
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(pxx + tileSize / 2 - w / 2 - g - 1, pyy + tileSize / 2 - gh / 2 - 1, g + 2, gh + 2);
          ctx.fillRect(pxx + tileSize / 2 + w / 2 - 1, pyy + tileSize / 2 - gh / 2 - 1, g + 2, gh + 2);
          ctx.fillStyle = '#292524';
          ctx.fillRect(pxx + tileSize / 2 - w / 2 - g / 2, pyy + tileSize / 2 - gh / 2 + gb, g, gh - gb * 2);
          ctx.fillRect(pxx + tileSize / 2 + w / 2 - g / 2, pyy + tileSize / 2 - gh / 2 + gb, g, gh - gb * 2);
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(pxx + tileSize / 2 - w / 2 - g, pyy + tileSize / 2 - gh / 2, w + g * 2, g);
          ctx.fillStyle = '#57534e';
          ctx.fillRect(pxx + tileSize / 2 - w / 2 - g - 1, pyy + tileSize / 2 - gh / 2 - 1, w + g * 2 + 2, Math.max(1.5, tileSize * 0.03));
          ctx.fillStyle = 'rgba(28, 25, 23, 0.9)';
          ctx.fillRect(pxx + tileSize / 2 - w / 2 + 1, pyy + tileSize / 2 - g / 2, w / 2 - 1.5, g);
          ctx.fillRect(pxx + tileSize / 2 + 1, pyy + tileSize / 2 - g / 2, w / 2 - 1.5, g);
        }
        if (
          upT && downT && upT.roadLevelEffective > 0 && downT.roadLevelEffective > 0 &&
          upT.kingdomId && downT.kingdomId && upT.kingdomId !== downT.kingdomId &&
          kingdoms.has(upT.kingdomId) && kingdoms.has(downT.kingdomId)
        ) {
          // vertical road: gate spans horizontally
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(pxx + tileSize / 2 - gh / 2 - 1, pyy + tileSize / 2 - w / 2 - g - 1, gh + 2, g + 2);
          ctx.fillRect(pxx + tileSize / 2 - gh / 2 - 1, pyy + tileSize / 2 + w / 2 - 1, gh + 2, g + 2);
          ctx.fillStyle = '#292524';
          ctx.fillRect(pxx + tileSize / 2 - gh / 2 + gb, pyy + tileSize / 2 - w / 2 - g / 2, gh - gb * 2, g);
          ctx.fillRect(pxx + tileSize / 2 - gh / 2 + gb, pyy + tileSize / 2 + w / 2 - g / 2, gh - gb * 2, g);
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(pxx + tileSize / 2 - gh / 2, pyy + tileSize / 2 - w / 2 - g, g, w + g * 2);
          ctx.fillStyle = '#57534e';
          ctx.fillRect(pxx + tileSize / 2 - gh / 2 - 1, pyy + tileSize / 2 - w / 2 - g - 1, Math.max(1.5, tileSize * 0.03), w + g * 2 + 2);
          ctx.fillStyle = 'rgba(28, 25, 23, 0.9)';
          ctx.fillRect(pxx + tileSize / 2 - g / 2, pyy + tileSize / 2 - w / 2 + 1, g, w / 2 - 1.5);
          ctx.fillRect(pxx + tileSize / 2 - g / 2, pyy + tileSize / 2 + 1, g, w / 2 - 1.5);
        }
      }
    }

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }
}
