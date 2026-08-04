/**
 * Aethoria's persistent historical record.
 *
 * The legacy API is intentionally preserved:
 *   chronicle.log(year, type, text)
 *
 * Rich callers can attach structured context so the UI (and, later, an optional
 * historian/LLM layer) can reconstruct causes, participants and consequences
 * without scraping names back out of prose.
 */

export type HistoryEventType =
  | 'founding'
  | 'kingdom'
  | 'war'
  | 'peace'
  | 'king'
  | 'disaster'
  | 'conquest'
  | 'trade'
  | 'tech'
  | 'law'
  | 'revolution'
  | 'society'
  | 'economy'
  | 'diplomacy'
  | 'great_person'
  | 'wonder'
  | 'succession'
  | 'famine'
  | 'siege'
  | 'rebellion'
  | 'culture';

export type HistoryImportance = 'minor' | 'notable' | 'major' | 'legendary';
export type HistoryScope = 'person' | 'city' | 'kingdom' | 'international' | 'world';
export type HistoryReferenceKind = 'person' | 'city' | 'kingdom' | 'war' | 'building' | 'tech' | 'good';

export interface HistoryReference {
  kind: HistoryReferenceKind;
  id: string;
  /** Human-readable label captured at the moment of the event. */
  name?: string;
}

export interface HistoryEventDetails {
  title?: string;
  importance?: HistoryImportance;
  scope?: HistoryScope;
  refs?: HistoryReference[];
  tags?: string[];
  causes?: string[];
  consequences?: string[];
  relatedEventIds?: string[];
  /** Stable story arc id, e.g. a war id or revolution id. */
  threadId?: string;
  /** Human-readable chapter title for events sharing threadId. */
  threadTitle?: string;
  /** Small structured snapshot only; avoid dumping whole simulation objects. */
  data?: Record<string, string | number | boolean | null>;
}

export interface HistoryEvent extends HistoryEventDetails {
  id: string;
  year: number;
  type: HistoryEventType;
  text: string;
  importance: HistoryImportance;
  scope: HistoryScope;
  refs: HistoryReference[];
  tags: string[];
  causes: string[];
  consequences: string[];
  relatedEventIds: string[];
  data: Record<string, string | number | boolean | null>;
}

export interface HistoryThread {
  id: string;
  title: string;
  startYear: number;
  endYear: number;
  importance: HistoryImportance;
  events: HistoryEvent[];
  refs: HistoryReference[];
}

export interface ChronicleSummary {
  total: number;
  earliestYear: number | null;
  latestYear: number | null;
  major: number;
  legendary: number;
  threads: number;
}

const MAX_EVENTS = 2500;
const HISTORY_TYPES = new Set<HistoryEventType>([
  'founding', 'kingdom', 'war', 'peace', 'king', 'disaster', 'conquest', 'trade', 'tech',
  'law', 'revolution', 'society', 'economy', 'diplomacy', 'great_person', 'wonder',
  'succession', 'famine', 'siege', 'rebellion', 'culture'
]);

const IMPORTANCE_SCORE: Record<HistoryImportance, number> = {
  minor: 0,
  notable: 1,
  major: 2,
  legendary: 3
};

function uniqueStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).filter(Boolean)));
}

function normalizeRefs(refs: HistoryReference[] | undefined): HistoryReference[] {
  const seen = new Set<string>();
  const result: HistoryReference[] = [];
  for (const ref of refs ?? []) {
    if (!ref || !ref.id || !ref.kind) continue;
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ kind: ref.kind, id: String(ref.id), name: ref.name ? String(ref.name) : undefined });
  }
  return result;
}

export class Chronicle {
  private events: HistoryEvent[] = [];
  private sequence = 0;

  /**
   * Backward-compatible logger. Existing callers need no changes.
   * Rich callers can pass a fourth details argument.
   */
  public log(
    year: number,
    type: HistoryEventType,
    text: string,
    details: HistoryEventDetails = {}
  ): HistoryEvent {
    return this.record({ year, type, text, ...details });
  }

  public record(input: {
    year: number;
    type: HistoryEventType;
    text: string;
  } & HistoryEventDetails): HistoryEvent {
    const event = this.normalizeEvent({
      ...input,
      id: this.nextId(input.year)
    });
    this.events.unshift(event); // newest first, preserving the existing contract
    this.prune();
    return event;
  }

  public getEvents(): HistoryEvent[] {
    return this.events;
  }

  public getEvent(id: string): HistoryEvent | undefined {
    return this.events.find(event => event.id === id);
  }

  /** Every recorded event that mentions a specific person, city, realm, war, etc. */
  public getEventsForRef(kind: HistoryReferenceKind, id: string): HistoryEvent[] {
    return this.events.filter(event => event.refs.some(ref => ref.kind === kind && ref.id === id));
  }

  /**
   * Compact fact package for an optional historian/LLM layer. This method does
   * not narrate or invent anything; it exports only simulation-grounded facts.
   */
  public exportHistorianContext(limit: number = 160): {
    summary: ChronicleSummary;
    threads: Array<{ id: string; title: string; startYear: number; endYear: number; importance: HistoryImportance }>;
    events: HistoryEvent[];
  } {
    const safeLimit = Math.max(1, Math.min(500, Math.round(limit)));
    return {
      summary: this.getSummary(),
      threads: this.getThreads().slice(0, 40).map(thread => ({
        id: thread.id,
        title: thread.title,
        startYear: thread.startYear,
        endYear: thread.endYear,
        importance: thread.importance
      })),
      events: this.events.slice(0, safeLimit).map(event => ({
        ...event,
        refs: event.refs.map(ref => ({ ...ref })),
        tags: [...event.tags],
        causes: [...event.causes],
        consequences: [...event.consequences],
        relatedEventIds: [...event.relatedEventIds],
        data: { ...event.data }
      }))
    };
  }

  public getMajorEvents(): HistoryEvent[] {
    return this.events.filter(event => IMPORTANCE_SCORE[event.importance] >= IMPORTANCE_SCORE.major);
  }

  public search(query: string): HistoryEvent[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.events;
    return this.events.filter(event => {
      const haystack = [
        event.title ?? '',
        event.text,
        ...event.tags,
        ...event.causes,
        ...event.consequences,
        ...event.refs.map(ref => ref.name ?? ref.id)
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  /**
   * Story threads are real chains of events, not generated lore. A thread exists
   * only when events share a stable thread id supplied by the simulation.
   */
  public getThreads(): HistoryThread[] {
    const grouped = new Map<string, HistoryEvent[]>();
    for (const event of this.events) {
      if (!event.threadId) continue;
      const list = grouped.get(event.threadId) ?? [];
      list.push(event);
      grouped.set(event.threadId, list);
    }

    const threads: HistoryThread[] = [];
    for (const [id, list] of grouped) {
      const chronological = [...list].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
      const mostImportant = chronological.reduce(
        (best, event) => IMPORTANCE_SCORE[event.importance] > IMPORTANCE_SCORE[best.importance] ? event : best,
        chronological[0]
      );
      const refMap = new Map<string, HistoryReference>();
      for (const event of chronological) {
        for (const ref of event.refs) refMap.set(`${ref.kind}:${ref.id}`, ref);
      }
      threads.push({
        id,
        title: chronological.find(event => event.threadTitle)?.threadTitle
          ?? mostImportant.title
          ?? `Historical thread, ${chronological[0].year}`,
        startYear: chronological[0].year,
        endYear: chronological[chronological.length - 1].year,
        importance: mostImportant.importance,
        events: chronological,
        refs: Array.from(refMap.values())
      });
    }

    return threads.sort((a, b) => b.endYear - a.endYear || IMPORTANCE_SCORE[b.importance] - IMPORTANCE_SCORE[a.importance]);
  }

  public getSummary(): ChronicleSummary {
    if (this.events.length === 0) {
      return { total: 0, earliestYear: null, latestYear: null, major: 0, legendary: 0, threads: 0 };
    }
    let earliest = Infinity;
    let latest = -Infinity;
    let major = 0;
    let legendary = 0;
    for (const event of this.events) {
      earliest = Math.min(earliest, event.year);
      latest = Math.max(latest, event.year);
      if (IMPORTANCE_SCORE[event.importance] >= IMPORTANCE_SCORE.major) major++;
      if (event.importance === 'legendary') legendary++;
    }
    return {
      total: this.events.length,
      earliestYear: earliest,
      latestYear: latest,
      major,
      legendary,
      threads: this.getThreads().length
    };
  }

  /** Save-ready snapshot. */
  public serialize(): HistoryEvent[] {
    return this.events.map(event => ({
      ...event,
      refs: event.refs.map(ref => ({ ...ref })),
      tags: [...event.tags],
      causes: [...event.causes],
      consequences: [...event.consequences],
      relatedEventIds: [...event.relatedEventIds],
      data: { ...event.data }
    }));
  }

  /**
   * Restores both new structured saves and legacy {year,type,text} entries.
   * Original ids are preserved when present.
   */
  public deserialize(data: unknown): void {
    this.events = [];
    if (!Array.isArray(data)) return;

    for (const raw of data) {
      if (!raw || typeof raw !== 'object') continue;
      const candidate = raw as Partial<HistoryEvent> & { year?: unknown; type?: unknown; text?: unknown };
      if (typeof candidate.year !== 'number' || typeof candidate.text !== 'string') continue;
      const type = HISTORY_TYPES.has(candidate.type as HistoryEventType)
        ? candidate.type as HistoryEventType
        : 'kingdom';
      const id = typeof candidate.id === 'string' && candidate.id
        ? candidate.id
        : this.nextId(candidate.year);

      this.events.push(this.normalizeEvent({
        ...candidate,
        id,
        year: candidate.year,
        type,
        text: candidate.text
      } as HistoryEvent));
    }

    // Saves already store newest-first. Preserve exact historical ordering.
    this.prune();
  }

  public clear(): void {
    this.events = [];
    this.sequence = 0;
  }

  private nextId(year: number): string {
    this.sequence = (this.sequence + 1) % 1_000_000;
    return `ev_${year}_${Date.now().toString(36)}_${this.sequence.toString(36)}`;
  }

  private normalizeEvent(input: Partial<HistoryEvent> & {
    id: string;
    year: number;
    type: HistoryEventType;
    text: string;
  }): HistoryEvent {
    return {
      id: input.id,
      year: Math.max(0, Math.round(input.year)),
      type: HISTORY_TYPES.has(input.type) ? input.type : 'kingdom',
      text: String(input.text),
      title: input.title ? String(input.title) : undefined,
      importance: input.importance ?? 'notable',
      scope: input.scope ?? 'kingdom',
      refs: normalizeRefs(input.refs),
      tags: uniqueStrings(input.tags),
      causes: uniqueStrings(input.causes),
      consequences: uniqueStrings(input.consequences),
      relatedEventIds: uniqueStrings(input.relatedEventIds),
      threadId: input.threadId ? String(input.threadId) : undefined,
      threadTitle: input.threadTitle ? String(input.threadTitle) : undefined,
      data: input.data && typeof input.data === 'object' ? { ...input.data } : {}
    };
  }

  /**
   * Keep a deep history without letting routine entries dominate localStorage.
   * Legendary/major events are protected first; oldest low-importance entries
   * are the first to go when the cap is reached.
   */
  private prune(): void {
    if (this.events.length <= MAX_EVENTS) return;

    const protectedEvents = this.events.filter(event => IMPORTANCE_SCORE[event.importance] >= IMPORTANCE_SCORE.major);
    const routineEvents = this.events.filter(event => IMPORTANCE_SCORE[event.importance] < IMPORTANCE_SCORE.major);
    const remaining = Math.max(0, MAX_EVENTS - protectedEvents.length);
    this.events = [...protectedEvents, ...routineEvents.slice(0, remaining)]
      .sort((a, b) => b.year - a.year || b.id.localeCompare(a.id))
      .slice(0, MAX_EVENTS);
  }
}

export const chronicle = new Chronicle();
