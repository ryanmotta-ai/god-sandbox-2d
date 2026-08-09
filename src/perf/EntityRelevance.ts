import type { Entity } from '../entities/Entity';

export type EntityRelevance = 'hot' | 'warm' | 'cold';

export interface RelevanceContext {
  centerX: number;
  centerY: number;
  hotRadius?: number;
  warmRadius?: number;
  selectedEntityIds?: ReadonlySet<string>;
  trackedEntityId?: string | null;
}

export const RELEVANCE_CADENCE: Readonly<Record<EntityRelevance, number>> = {
  hot: 1,
  warm: 6,
  cold: 30
};

const ALWAYS_HOT_STATES = new Set(['attack', 'combat', 'flee', 'siege', 'raid']);

/** Selected, tracked, endangered and combat actors always remain responsive. */
export function classifyEntity(entity: Entity, context?: RelevanceContext): EntityRelevance {
  if (!context) return 'hot';
  if (entity.id === context.trackedEntityId || context.selectedEntityIds?.has(entity.id)) return 'hot';
  if (entity.hp <= entity.maxHp * 0.35 || ALWAYS_HOT_STATES.has(entity.aiState)) return 'hot';

  const dx = entity.x - context.centerX;
  const dy = entity.y - context.centerY;
  const distanceSq = dx * dx + dy * dy;
  const hotRadius = context.hotRadius ?? 36;
  const warmRadius = Math.max(hotRadius, context.warmRadius ?? 96);
  if (distanceSq <= hotRadius * hotRadius) return 'hot';
  if (distanceSq <= warmRadius * warmRadius) return 'warm';
  if (entity.isGreatPerson || entity.profession === 'king' || entity.profession === 'leader' || entity.starvingDays > 0) return 'warm';
  return 'cold';
}

const RELEVANCE_RANK: Record<EntityRelevance, number> = { cold: 0, warm: 1, hot: 2 };

/** Central transition memory prevents edge-of-camera HOT/WARM thrashing. */
export class EntityRelevanceTracker {
  private readonly states = new Map<string, { relevance: EntityRelevance; changedAt: number }>();

  public classify(entity: Entity, context: RelevanceContext | undefined, tick: number): EntityRelevance {
    const desired = classifyEntity(entity, context);
    const previous = this.states.get(entity.id);
    if (!previous) {
      this.states.set(entity.id, { relevance: desired, changedAt: tick });
      return desired;
    }
    if (RELEVANCE_RANK[desired] >= RELEVANCE_RANK[previous.relevance]) {
      if (desired !== previous.relevance) this.states.set(entity.id, { relevance: desired, changedAt: tick });
      return desired;
    }

    const holdTicks = previous.relevance === 'hot' ? 60 : 180;
    if (tick - previous.changedAt < holdTicks) return previous.relevance;
    this.states.set(entity.id, { relevance: desired, changedAt: tick });
    return desired;
  }

  public forget(entityId: string): void { this.states.delete(entityId); }
  public clear(): void { this.states.clear(); }
  public get size(): number { return this.states.size; }
}

/** Stable id-based phasing avoids synchronized WARM/COLD spikes. */
export function shouldTickEntity(entity: Entity, relevance: EntityRelevance, tick: number): boolean {
  const cadence = RELEVANCE_CADENCE[relevance];
  if (cadence === 1) return true;
  let hash = 2166136261;
  for (let i = 0; i < entity.id.length; i++) hash = Math.imul(hash ^ entity.id.charCodeAt(i), 16777619);
  return (tick + (hash >>> 0)) % cadence === 0;
}
