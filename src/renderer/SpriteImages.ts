import { cityAssetEntry, resolveCityAssetUrl } from '../assets/CityAssetManifest';
import {
  ENTITY_ASSET_MANIFEST, ENTITY_SHEET_ANIMATIONS, ENTITY_SHEET_CELL,
  ENTITY_SHEET_DIRECTIONS, ENTITY_SHEET_FRAMES, resolveEntityAssetUrl,
  type EntityAssetEntry, type EntitySheetAnimation, type EntitySheetDirection
} from '../assets/EntityAssetManifest';
import {
  MASTER_ASSET_MANIFEST, masterBuildingAtlasKey, resolveMasterAssetUrl,
  type MasterAssetEntry
} from '../assets/MasterAssetManifest';

/**
 * The PNG art packs, reachable from the canvas renderer.
 *
 * The three manifests were already wired into the WebGPU texture atlas, but the
 * canvas path is the default renderer and had no way to reach them — so every
 * PNG in the repository shipped in the bundle and never appeared on screen.
 *
 * `drawImage` accepts an HTMLImageElement directly, so a lazily-decoded <img>
 * per file is the entire mechanism needed; no atlas, no packing, no preload
 * phase. Every accessor returns null until the file has decoded, and null
 * forever for a manifest entry whose PNG is absent, which is exactly the signal
 * the call sites need in order to keep drawing the procedural sprite instead.
 */
const images = new Map<string, HTMLImageElement>();

function load(url: string | undefined): HTMLImageElement | null {
  if (!url || typeof Image === 'undefined') return null;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    images.set(url, img);
  }
  // `complete` also turns true when a decode fails, so the real test is whether
  // any pixels arrived. A failed file then stays null and keeps its fallback.
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Artwork for a CityAssetManifest id, e.g. `city.residential.house.small.v01`. */
export function cityAssetImage(assetId: string): HTMLImageElement | null {
  const entry = cityAssetEntry(assetId);
  return entry ? load(resolveCityAssetUrl(entry)) : null;
}

/**
 * The master library indexed the way the renderer asks for a building. Several
 * pieces can answer one key (two stone cottages, two industrial tenements), so
 * the value is a list and the caller picks a stable member per building.
 */
const MASTER_BUILDINGS = new Map<string, MasterAssetEntry[]>();
for (const entry of MASTER_ASSET_MANIFEST.assets) {
  const key = masterBuildingAtlasKey(entry);
  if (!key) continue;
  const bucket = MASTER_BUILDINGS.get(key);
  if (bucket) bucket.push(entry);
  else MASTER_BUILDINGS.set(key, [entry]);
}

export interface MasterBuildingArt {
  image: HTMLImageElement;
  entry: MasterAssetEntry;
}

/**
 * Era-tagged library artwork for a building, or null when the pack has nothing
 * for this type, era and condition. `variant` is a stable 0..1 per building so
 * a house does not change identity between frames.
 */
export function masterBuildingImage(
  type: string, era: string, level: number, hpRatio: number, variant: number
): MasterBuildingArt | null {
  const damage = hpRatio <= .32 ? 'ruined' : hpRatio <= .68 ? 'damaged' : hpRatio <= .9 ? 'worn' : 'healthy';
  const bucket = MASTER_BUILDINGS.get(`building:${type}:${era}:${Math.max(1, Math.min(3, Math.round(level)))}:${damage}`);
  if (!bucket?.length) return null;
  const entry = bucket[Math.min(bucket.length - 1, Math.floor(variant * bucket.length))];
  const image = load(resolveMasterAssetUrl(entry));
  return image ? { image, entry } : null;
}

const ENTITY_SHEETS = new Map<string, EntityAssetEntry>(
  ENTITY_ASSET_MANIFEST.assets.map(entry => [entry.profile, entry])
);

export interface EntitySheetCell {
  image: HTMLImageElement;
  sourceX: number;
  sourceY: number;
  size: number;
}

/**
 * One animation cell out of a 4x16 entity sheet. Row order matches the atlas
 * builder — direction major, animation minor — so both renderers slice the same
 * frame out of the same file.
 */
export function entitySheetCell(
  profile: string, direction: EntitySheetDirection, animation: EntitySheetAnimation, frame: number
): EntitySheetCell | null {
  const entry = ENTITY_SHEETS.get(profile);
  if (!entry) return null;
  const image = load(resolveEntityAssetUrl(entry));
  if (!image) return null;
  const row = ENTITY_SHEET_DIRECTIONS.indexOf(direction) * ENTITY_SHEET_ANIMATIONS.length
    + ENTITY_SHEET_ANIMATIONS.indexOf(animation);
  const column = Math.max(0, Math.min(ENTITY_SHEET_FRAMES - 1, frame | 0));
  return {
    image,
    sourceX: column * ENTITY_SHEET_CELL,
    sourceY: row * ENTITY_SHEET_CELL,
    size: ENTITY_SHEET_CELL
  };
}
