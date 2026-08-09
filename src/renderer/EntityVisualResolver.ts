import type { Entity } from '../entities/Entity';
import { SpeciesType } from '../entities/Species';
import type { EntitySheetAnimation } from '../assets/EntityAssetManifest';

const PROFESSIONS = new Set([
  'farmer', 'woodcutter', 'miner', 'builder', 'soldier', 'archer',
  'scout', 'healer', 'leader', 'king'
]);

const ADULT_VARIANTS = [
  'adult_light_v01', 'adult_tan_v01', 'adult_brown_v01', 'adult_dark_v01',
  'adult_light_v02', 'adult_tan_v02', 'adult_brown_v02', 'adult_dark_v02'
] as const;

function stableIndex(id: string, length: number): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (hash >>> 0) % length;
}

/** Resolves one stable visual family; it never mutates simulation state. */
export function resolveEntityVisualProfile(entity: Entity, visibleInfantMotherIds?: ReadonlySet<string>): string {
  if (entity.species !== SpeciesType.HUMAN) {
    const age = entity.lifeStage === 'infant' || entity.lifeStage === 'child' ? 'young' : 'adult';
    const variant = entity.species === SpeciesType.DEER ? (stableIndex(entity.id, 2) + 1) : 1;
    return `animal:${entity.species}_${age}_v${String(variant).padStart(2, '0')}`;
  }

  if (entity.lifeStage === 'infant') return 'human:infant_v01';
  if (entity.lifeStage === 'child') return 'human:child_v01';
  if (entity.lifeStage === 'adolescent') return 'human:adolescent_v01';
  if (entity.lifeStage === 'elder') return 'human:elder_v01';
  if (entity.isPregnant) return 'human:pregnant_v01';
  if (visibleInfantMotherIds?.has(entity.id)) {
    return stableIndex(entity.id, 2) === 0 ? 'human:mother_baby_light_v01' : 'human:mother_baby_dark_v01';
  }
  if (PROFESSIONS.has(entity.profession)) return `profession:${entity.profession}_v01`;
  return `human:${ADULT_VARIANTS[stableIndex(entity.id, ADULT_VARIANTS.length)]}`;
}

export function resolveEntitySheetAnimation(animation: string): EntitySheetAnimation {
  if (animation === 'attack' || animation === 'shoot') return 'attack';
  if (animation === 'gather' || animation === 'build') return 'work';
  if (animation === 'walk' || animation === 'flee' || animation === 'carry') return 'walk';
  return 'idle';
}
