import { BUILDINGS } from '../../civ/Building';
import { GOODS } from '../../civ/Goods';
import { SpeciesType } from '../../entities/Species';
import { TerrainType } from '../../world/Biomes';
import { SpriteGenerator, type EntitySpriteAnimation, type SpriteDirection } from '../SpriteGenerator';
import { SpriteRegistry } from '../SpriteRegistry';
import { caravanSprite, CARAVAN_FRAMES, type CaravanView } from '../CaravanSprites';
import { TERRAIN_VISUALS } from '../TerrainPalette';
import { CITY_ASSET_MANIFEST, resolveCityAssetUrl, type CityAssetEntry } from '../../assets/CityAssetManifest';
import { MASTER_ASSET_MANIFEST, masterBuildingAtlasKey, resolveMasterAssetUrl, type MasterAssetEntry } from '../../assets/MasterAssetManifest';
import {
  ENTITY_ASSET_MANIFEST, ENTITY_SHEET_ANIMATIONS, ENTITY_SHEET_CELL,
  ENTITY_SHEET_DIRECTIONS, ENTITY_SHEET_FRAMES, entityArtAtlasKey,
  resolveEntityAssetUrl
} from '../../assets/EntityAssetManifest';

export interface AtlasRegion {
  /** Atlas page: retained in the instance ABI indirectly by page-batched draws. */
  readonly page?: number;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
  /** Optional ART-V1 metadata consumed by CITY-V1 layout later. */
  readonly spriteWidth?: number;
  readonly spriteHeight?: number;
  readonly footprintWidth?: number;
  readonly footprintHeight?: number;
  readonly anchorX?: number;
  readonly anchorY?: number;
}

export interface TextureAtlasResource {
  /** Compatibility alias for page zero. */
  readonly texture: GPUTexture;
  readonly pages: readonly TextureAtlasPage[];
  readonly sampler: GPUSampler;
  readonly regions: ReadonlyMap<string, AtlasRegion>;
  readonly width: number;
  readonly height: number;
  readonly estimatedBytes: number;
  destroy(): void;
}

export interface TextureAtlasPage {
  readonly texture: GPUTexture;
  readonly width: number;
  readonly height: number;
  readonly estimatedBytes: number;
}

interface AtlasSource {
  key: string;
  canvas: HTMLCanvasElement;
  asset?: CityAssetEntry | MasterAssetEntry;
}

/** A page is bounded so CITY-V1 can add sprite families without reallocating a giant atlas. */
const MAX_PAGE_SIZE = 512;
const SOURCE_PADDING = 1;
const TEXTURE_USAGE_TEXTURE_BINDING = 0x04;
const TEXTURE_USAGE_COPY_DST = 0x02;
const TEXTURE_USAGE_RENDER_ATTACHMENT = 0x10;

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function makeCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true })!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return canvas;
}

function terrainSprite(type: TerrainType): HTMLCanvasElement {
  const visual = TERRAIN_VISUALS[type];
  return makeCanvas(16, 16, ctx => {
    ctx.fillStyle = visual.base;
    ctx.fillRect(0, 0, 16, 16);

    // Fixed one-pixel material marks retain the quantised pixel art look
    ctx.fillStyle = visual.low;
    ctx.fillRect(1, 2, 2, 1);
    ctx.fillRect(10, 11, 3, 1);
    ctx.fillRect(5, 7, 1, 1);
    ctx.fillStyle = visual.high;
    ctx.fillRect(12, 3, 2, 1);
    ctx.fillRect(3, 13, 2, 1);
    ctx.fillRect(8, 5, 1, 1);

    if (type === TerrainType.SHALLOW_WATER) {
      // Wave crest lines & caustics highlights for WebGPU atlas
      ctx.fillStyle = visual.high;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(1, 4, 6, 1);
      ctx.fillRect(8, 10, 7, 1);
      ctx.fillRect(4, 14, 5, 1);

      // Caustics glint pixels
      ctx.fillStyle = visual.accent;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(3, 4, 2, 1);
      ctx.fillRect(11, 10, 2, 1);
      ctx.fillRect(13, 2, 1, 1);
      ctx.fillRect(2, 11, 1, 1);
      ctx.globalAlpha = 1.0;
    } else if (type === TerrainType.DEEP_OCEAN) {
      // Abyssal swells & specular sparkles for WebGPU atlas
      ctx.fillStyle = visual.high;
      ctx.globalAlpha = 0.40;
      ctx.fillRect(2, 5, 5, 1);
      ctx.fillRect(9, 12, 4, 1);

      ctx.fillStyle = visual.accent;
      ctx.globalAlpha = 0.70;
      ctx.fillRect(4, 5, 1, 1);
      ctx.fillRect(10, 12, 1, 1);
      ctx.fillRect(14, 7, 1, 1);
      ctx.globalAlpha = 1.0;
    } else if (type === TerrainType.LAVA) {
      ctx.fillStyle = visual.accent;
      ctx.fillRect(2, 9, 6, 1);
      ctx.fillRect(8, 8, 4, 1);
    }
  });
}

function selectionSprite(): HTMLCanvasElement {
  return makeCanvas(16, 16, ctx => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1, 1, 6, 1);
    ctx.fillRect(9, 1, 6, 1);
    ctx.fillRect(1, 14, 6, 1);
    ctx.fillRect(9, 14, 6, 1);
    ctx.fillRect(1, 2, 1, 5);
    ctx.fillRect(14, 2, 1, 5);
    ctx.fillRect(1, 9, 1, 5);
    ctx.fillRect(14, 9, 1, 5);
  });
}

export const BUILDING_RENDER_ERAS = ['stone', 'bronze', 'iron', 'classical', 'industrial', 'modern'] as const;
export const ENTITY_RENDER_DIRECTIONS: readonly SpriteDirection[] = ['down', 'up', 'left', 'right'];
export const ENTITY_RENDER_ANIMATIONS: readonly EntitySpriteAnimation[] = ['idle', 'walk', 'attack', 'flee', 'heal', 'gather', 'build', 'carry', 'shoot', 'socialize', 'rest'];
const CARAVAN_VIEWS: readonly CaravanView[] = ['side', 'back', 'front'];

/** Stable key shared by the static chunk builder and the paged atlas. */
export function buildingAtlasKey(type: string, era: string, level: number, hpRatio: number): string {
  const damage = hpRatio <= .32 ? 'ruined' : hpRatio <= .68 ? 'damaged' : hpRatio <= .9 ? 'worn' : 'healthy';
  return `building:${type}:${era}:${Math.max(1, Math.min(3, Math.round(level)))}:${damage}`;
}

function trainSprite(): HTMLCanvasElement {
  return makeCanvas(24, 24, ctx => {
    ctx.fillStyle = '#0c0a09'; ctx.fillRect(3, 10, 16, 7);
    ctx.fillStyle = '#dc2626'; ctx.fillRect(4, 10, 5, 7);
    ctx.fillStyle = '#7dd3fc'; ctx.fillRect(6, 11, 2, 2);
    ctx.fillStyle = '#292524'; ctx.fillRect(15, 6, 3, 6);
    ctx.fillStyle = '#44403c'; ctx.fillRect(18, 11, 4, 6);
    ctx.fillStyle = '#000000'; ctx.fillRect(6, 17, 3, 2); ctx.fillRect(15, 17, 3, 2);
  });
}

function collectSources(): AtlasSource[] {
  const sources: AtlasSource[] = [
    { key: 'solid:white', canvas: makeCanvas(16, 16, ctx => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 16, 16); }) },
    { key: 'overlay:selection', canvas: selectionSprite() }
  ];

  for (const type of Object.values(TerrainType)) {
    sources.push({ key: `terrain:${type}`, canvas: terrainSprite(type) });
  }

  // Existing generated artwork is copied into the proof atlas; no replacement
  // art or world-sized source texture is introduced.
  for (const species of Object.values(SpeciesType)) for (const direction of ENTITY_RENDER_DIRECTIONS) for (const animation of ENTITY_RENDER_ANIMATIONS) for (let frame = 0; frame < 4; frame++) {
    sources.push({ key: `entity:${species}:${direction}:${animation}:${frame}`, canvas: SpriteGenerator.getSpeciesSprite(species, direction, animation, frame) });
  }
  sources.push({ key: 'vehicle:train', canvas: trainSprite() });
  for (const type of ['donkey', 'camel', 'cart'] as const) for (const view of CARAVAN_VIEWS) for (let frame = 0; frame < CARAVAN_FRAMES; frame++) {
    sources.push({ key: `vehicle:caravan:${type}:${view}:${frame}`, canvas: caravanSprite(type, view, frame) });
  }
  for (let tier = 1; tier <= 4; tier++) {
    const key = `ship_tier_${tier}`;
    sources.push({ key: `vehicle:ship:${tier}`, canvas: SpriteGenerator.getSprite(key, () => {}, 64, 64) });
  }

  for (const key of ['tree_oak', 'tree_pine', 'tree_palm', 'swamp_reed', 'arcane_crystal', 'corrupted_skull', 'fx_fire']) {
    const sprite = SpriteRegistry.get(key);
    if (sprite) sources.push({ key: `prop:${key}`, canvas: sprite });
  }
  for (const good of Object.values(GOODS)) {
    if (good.kind !== 'raw') continue;
    const sprite = SpriteRegistry.get(`node_${good.id}`);
    if (sprite) sources.push({ key: `resource:${good.id}`, canvas: sprite });
  }
  // Dynamic families occupy page zero. Buildings can grow into later pages
  // without making entities, selection, or effects change bind groups per frame.
  for (const type of Object.keys(BUILDINGS)) for (const era of BUILDING_RENDER_ERAS) for (const level of [1, 2, 3]) for (const hpRatio of [1, .78, .45, .15]) {
    sources.push({ key: buildingAtlasKey(type, era, level, hpRatio), canvas: SpriteGenerator.getBuildingSprite(type, { era, level, hpRatio }) });
  }

  return sources;
}

async function collectExternalCitySources(): Promise<AtlasSource[]> {
  const loaded = await Promise.all(CITY_ASSET_MANIFEST.assets.map(async asset => {
    const url = resolveCityAssetUrl(asset);
    if (!url) return undefined;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'premultiply' });
      if (bitmap.width !== asset.canvas[0] || bitmap.height !== asset.canvas[1]) {
        bitmap.close();
        console.warn(`[ART-V1] Ignoring ${asset.id}: expected ${asset.canvas[0]}x${asset.canvas[1]}, got ${bitmap.width}x${bitmap.height}`);
        return undefined;
      }
      const canvas = makeCanvas(bitmap.width, bitmap.height, ctx => ctx.drawImage(bitmap, 0, 0));
      bitmap.close();
      return { key: asset.atlasKey ?? `asset:${asset.id}`, canvas, asset } satisfies AtlasSource;
    } catch (error) {
      console.warn(`[ART-V1] Could not load ${asset.id}; keeping current fallback.`, error);
      return undefined;
    }
  }));
  const sources: AtlasSource[] = [];
  for (const source of loaded) if (source) sources.push(source);
  return sources;
}

async function collectExternalMasterSources(): Promise<AtlasSource[]> {
  const loaded = await Promise.all(MASTER_ASSET_MANIFEST.assets.map(async asset => {
    const url = resolveMasterAssetUrl(asset);
    if (!url) return undefined;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'premultiply' });
      if (bitmap.width !== asset.canvas[0] || bitmap.height !== asset.canvas[1]) {
        bitmap.close();
        console.warn(`[ART-V2] Ignoring ${asset.id}: expected ${asset.canvas[0]}x${asset.canvas[1]}, got ${bitmap.width}x${bitmap.height}`);
        return undefined;
      }
      const canvas = makeCanvas(bitmap.width, bitmap.height, ctx => ctx.drawImage(bitmap, 0, 0));
      bitmap.close();
      return { key: `asset:${asset.id}`, canvas, asset } satisfies AtlasSource;
    } catch (error) {
      console.warn(`[ART-V2] Could not load ${asset.id}; asset remains available to future packs.`, error);
      return undefined;
    }
  }));
  const sources: AtlasSource[] = [];
  for (const source of loaded) {
    if (!source) continue;
    sources.push(source);
    // Also register under the key the world renderer actually asks for. Without
    // this the entire library is decoded, packed into the atlas and uploaded to
    // the GPU without ever being drawn, because nothing in the game requests an
    // `asset:<id>` region from this pack.
    const gameplayKey = source.asset ? masterBuildingAtlasKey(source.asset as MasterAssetEntry) : null;
    if (gameplayKey) sources.push({ ...source, key: gameplayKey });
  }
  return sources;
}

async function collectExternalEntitySources(): Promise<AtlasSource[]> {
  const sheets = await Promise.all(ENTITY_ASSET_MANIFEST.assets.map(async asset => {
    const url = resolveEntityAssetUrl(asset);
    if (!url) return undefined;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'premultiply' });
      if (bitmap.width !== asset.canvas[0] || bitmap.height !== asset.canvas[1]) {
        bitmap.close();
        console.warn(`[ENTITY-ART] Ignoring ${asset.id}: expected ${asset.canvas[0]}x${asset.canvas[1]}, got ${bitmap.width}x${bitmap.height}`);
        return undefined;
      }
      return { asset, bitmap };
    } catch (error) {
      console.warn(`[ENTITY-ART] Could not load ${asset.id}; keeping procedural fallback.`, error);
      return undefined;
    }
  }));

  const sources: AtlasSource[] = [];
  for (const sheet of sheets) {
    if (!sheet) continue;
    const { asset, bitmap } = sheet;
    for (let directionIndex = 0; directionIndex < ENTITY_SHEET_DIRECTIONS.length; directionIndex++) {
      const direction = ENTITY_SHEET_DIRECTIONS[directionIndex];
      for (let animationIndex = 0; animationIndex < ENTITY_SHEET_ANIMATIONS.length; animationIndex++) {
        const animation = ENTITY_SHEET_ANIMATIONS[animationIndex];
        const row = directionIndex * ENTITY_SHEET_ANIMATIONS.length + animationIndex;
        for (let frame = 0; frame < ENTITY_SHEET_FRAMES; frame++) {
          const canvas = makeCanvas(ENTITY_SHEET_CELL, ENTITY_SHEET_CELL, ctx => {
            ctx.drawImage(bitmap, frame * ENTITY_SHEET_CELL, row * ENTITY_SHEET_CELL, ENTITY_SHEET_CELL, ENTITY_SHEET_CELL, 0, 0, ENTITY_SHEET_CELL, ENTITY_SHEET_CELL);
          });
          sources.push({ key: entityArtAtlasKey(asset.profile, direction, animation, frame), canvas });
        }
      }
    }
    bitmap.close();
  }
  return sources;
}

interface AtlasPlacement {
  source: AtlasSource;
  x: number;
  y: number;
}

interface AtlasPagePlan {
  placements: AtlasPlacement[];
  width: number;
  height: number;
}

/** Compact shelf packing avoids paying a 64x64 cell for every 16x16 sprite. */
function planAtlasPages(sources: AtlasSource[]): AtlasPagePlan[] {
  const pages: AtlasPagePlan[] = [];
  let placements: AtlasPlacement[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let usedWidth = 1;
  let usedHeight = 1;

  const finishPage = (): void => {
    if (placements.length === 0) return;
    pages.push({
      placements,
      width: Math.min(MAX_PAGE_SIZE, nextPowerOfTwo(usedWidth)),
      height: Math.min(MAX_PAGE_SIZE, nextPowerOfTwo(usedHeight))
    });
    placements = [];
    cursorX = 0;
    cursorY = 0;
    rowHeight = 0;
    usedWidth = 1;
    usedHeight = 1;
  };

  for (const source of sources) {
    const packedWidth = source.canvas.width + SOURCE_PADDING * 2;
    const packedHeight = source.canvas.height + SOURCE_PADDING * 2;
    if (packedWidth > MAX_PAGE_SIZE || packedHeight > MAX_PAGE_SIZE) {
      throw new Error(`Atlas source ${source.key} exceeds the ${MAX_PAGE_SIZE}px page`);
    }
    if (cursorX + packedWidth > MAX_PAGE_SIZE) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    if (cursorY + packedHeight > MAX_PAGE_SIZE) finishPage();
    placements.push({ source, x: cursorX + SOURCE_PADDING, y: cursorY + SOURCE_PADDING });
    cursorX += packedWidth;
    rowHeight = Math.max(rowHeight, packedHeight);
    usedWidth = Math.max(usedWidth, cursorX);
    usedHeight = Math.max(usedHeight, cursorY + rowHeight);
  }
  finishPage();
  return pages;
}

export async function createInitialTextureAtlas(device: GPUDevice): Promise<TextureAtlasResource> {
  // External art wins by stable atlas key. Missing files remain harmless and
  // preserve the existing generated assets during the incremental art rollout.
  const sourceMap = new Map(collectSources().map(source => [source.key, source]));
  for (const source of await collectExternalCitySources()) sourceMap.set(source.key, source);
  for (const source of await collectExternalMasterSources()) sourceMap.set(source.key, source);
  for (const source of await collectExternalEntitySources()) sourceMap.set(source.key, source);
  const sources = [...sourceMap.values()];
  const regions = new Map<string, AtlasRegion>();
  const pages: TextureAtlasPage[] = [];
  const plans = planAtlasPages(sources);
  for (let pageIndex = 0; pageIndex < plans.length; pageIndex++) {
    const { placements, width, height } = plans[pageIndex];
    const atlasCanvas = document.createElement('canvas'); atlasCanvas.width = width; atlasCanvas.height = height;
    const ctx = atlasCanvas.getContext('2d', { alpha: true })!; ctx.imageSmoothingEnabled = false;
    for (const { source, x, y } of placements) {
      ctx.drawImage(source.canvas, x, y);
      regions.set(source.key, {
        page: pageIndex,
        u0: x / width, v0: y / height,
        u1: (x + source.canvas.width) / width, v1: (y + source.canvas.height) / height,
        spriteWidth: source.canvas.width, spriteHeight: source.canvas.height,
        footprintWidth: source.asset?.footprint[0], footprintHeight: source.asset?.footprint[1],
        anchorX: source.asset?.anchor[0], anchorY: source.asset?.anchor[1]
      });
    }
    const texture = device.createTexture({ label: `Aethoria sprite atlas page ${pageIndex}`, size: { width, height, depthOrArrayLayers: 1 }, format: 'rgba8unorm', mipLevelCount: 1, sampleCount: 1, usage: TEXTURE_USAGE_TEXTURE_BINDING | TEXTURE_USAGE_COPY_DST | TEXTURE_USAGE_RENDER_ATTACHMENT });
    device.queue.copyExternalImageToTexture({ source: atlasCanvas }, { texture }, { width, height, depthOrArrayLayers: 1 });
    pages.push({ texture, width, height, estimatedBytes: width * height * 4 });
  }

  const sampler = device.createSampler({
    label: 'Aethoria nearest-neighbour sampler',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    magFilter: 'nearest',
    minFilter: 'nearest',
    mipmapFilter: 'nearest'
  });

  return {
    texture: pages[0].texture,
    pages,
    sampler,
    regions,
    width: pages[0].width,
    height: pages[0].height,
    estimatedBytes: pages.reduce((total, page) => total + page.estimatedBytes, 0),
    destroy: () => pages.forEach(page => page.texture.destroy())
  };
}
