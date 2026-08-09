import type { SpeciesType } from '../entities/Species';

export const ENTITY_SHEET_DIRECTIONS = ['down', 'up', 'left', 'right'] as const;
export const ENTITY_SHEET_ANIMATIONS = ['idle', 'walk', 'work', 'attack'] as const;
export const ENTITY_SHEET_FRAMES = 4;
export const ENTITY_SHEET_CELL = 48;

export type EntitySheetDirection = typeof ENTITY_SHEET_DIRECTIONS[number];
export type EntitySheetAnimation = typeof ENTITY_SHEET_ANIMATIONS[number];
export type EntityAssetCategory = 'human' | 'profession' | 'animal';

export interface EntityAssetEntry {
  readonly id: string;
  /** Stable key used by the renderer, without direction/animation/frame. */
  readonly profile: string;
  readonly category: EntityAssetCategory;
  readonly source: string;
  readonly species?: SpeciesType;
  readonly lifeStage?: 'infant' | 'child' | 'adolescent' | 'adult' | 'elder';
  readonly profession?: string;
  readonly variant: number;
  readonly canvas: readonly [192, 768];
  readonly cell: readonly [48, 48];
}

const HUMAN_NAMES = [
  'adult_light_v01', 'adult_tan_v01', 'adult_brown_v01', 'adult_dark_v01',
  'infant_v01', 'child_v01', 'adolescent_v01', 'elder_v01',
  'mother_baby_dark_v01', 'mother_baby_light_v01', 'father_toddler_v01', 'pregnant_v01',
  'adult_light_v02', 'adult_tan_v02', 'adult_brown_v02', 'adult_dark_v02'
] as const;

const PROFESSION_NAMES = [
  'farmer_v01', 'woodcutter_v01', 'miner_v01', 'builder_v01',
  'soldier_v01', 'archer_v01', 'scout_v01', 'healer_v01',
  'leader_v01', 'king_v01', 'crafter_v01', 'merchant_v01',
  'sailor_v01', 'rail_worker_v01', 'factory_worker_v01', 'scholar_v01'
] as const;

const ANIMAL_NAMES = [
  'deer_adult_v01', 'wolf_adult_v01', 'bear_adult_v01', 'dragon_adult_v01',
  'boar_adult_v01', 'eagle_adult_v01', 'mammoth_adult_v01', 'deer_adult_v02',
  'deer_young_v01', 'wolf_young_v01', 'bear_young_v01', 'dragon_young_v01',
  'boar_young_v01', 'eagle_young_v01', 'mammoth_young_v01', 'deer_young_v02'
] as const;

function entry(category: EntityAssetCategory, name: string): EntityAssetEntry {
  const folder = category === 'human' ? 'humans' : category === 'profession' ? 'professions' : 'animals';
  const profile = `${category}:${name}`;
  const stage = name.includes('_young_') ? 'child'
    : name.startsWith('infant_') ? 'infant'
    : name.startsWith('child_') ? 'child'
    : name.startsWith('adolescent_') ? 'adolescent'
    : name.startsWith('elder_') ? 'elder'
    : 'adult';
  const species = category === 'animal' ? name.split('_')[0] as SpeciesType : undefined;
  return {
    id: `entity.${category}.${name.replaceAll('_', '.')}`,
    profile,
    category,
    source: `./entities/${folder}/${name}.png`,
    species,
    lifeStage: stage,
    profession: category === 'profession' ? name.replace(/_v\d+$/, '') : undefined,
    variant: Number(name.match(/v(\d+)$/)?.[1] ?? 1),
    canvas: [192, 768],
    cell: [48, 48]
  };
}

export const ENTITY_ASSET_MANIFEST = {
  schema: 1,
  cellPixels: ENTITY_SHEET_CELL,
  framesPerAnimation: ENTITY_SHEET_FRAMES,
  directions: ENTITY_SHEET_DIRECTIONS,
  animations: ENTITY_SHEET_ANIMATIONS,
  assets: [
    ...HUMAN_NAMES.map(name => entry('human', name)),
    ...PROFESSION_NAMES.map(name => entry('profession', name)),
    ...ANIMAL_NAMES.map(name => entry('animal', name))
  ] as readonly EntityAssetEntry[]
} as const;

const ENTITY_ASSET_URLS = import.meta.glob('./entities/{humans,professions,animals}/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

export function resolveEntityAssetUrl(entry: EntityAssetEntry): string | undefined {
  return ENTITY_ASSET_URLS[entry.source];
}

export function entityArtAtlasKey(
  profile: string,
  direction: EntitySheetDirection,
  animation: EntitySheetAnimation,
  frame: number
): string {
  return `entity-art:${profile}:${direction}:${animation}:${Math.max(0, Math.min(ENTITY_SHEET_FRAMES - 1, frame | 0))}`;
}
