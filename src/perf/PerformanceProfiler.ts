export type PerformanceMetric =
  | 'frame'
  | 'simulation'
  | 'render'
  | 'entityAI'
  | 'pathfinding'
  | 'economy'
  /** SOC-V2's yearly per-citizen pass: memory, work, housing and migration. */
  | 'lives'
  | 'warfare'
  /** WAR-V2: deciding where the lines are and moving them. */
  | 'fronts'
  /** WAR-V3: costing supply routes and feeding the fronts. */
  | 'logistics'
  | 'trade'
  | 'ui';

export interface MetricSnapshot {
  samples: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
}

const WINDOW_SIZE = 300;

class RollingMetric {
  private values = new Float64Array(WINDOW_SIZE);
  private cursor = 0;
  private count = 0;

  public add(value: number): void {
    if (!Number.isFinite(value)) return;
    this.values[this.cursor] = Math.max(0, value);
    this.cursor = (this.cursor + 1) % WINDOW_SIZE;
    this.count = Math.min(WINDOW_SIZE, this.count + 1);
  }

  public snapshot(): MetricSnapshot {
    if (this.count === 0) return { samples: 0, averageMs: 0, p95Ms: 0, maxMs: 0 };
    const sample = Array.from(this.values.subarray(0, this.count)).sort((a, b) => a - b);
    let total = 0;
    for (const value of sample) total += value;
    return {
      samples: this.count,
      averageMs: total / this.count,
      p95Ms: sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.95))],
      maxMs: sample[sample.length - 1]
    };
  }
}

export interface PerformanceCounters {
  entities: number;
  hotEntities: number;
  warmEntities: number;
  coldEntities: number;
  visibleEntities: number;
  approximateDrawCalls: number;
  pathCalls: number;
  pathsPerSecond: number;
  pathCacheHits: number;
  pathCacheMisses: number;
  schedulerTicks: number;
  schedulerDebt: number;
  networkRebuilds: number;
  activeRegions: number;
  warmRegions: number;
  sleepingRegions: number;
}

const DEFAULT_COUNTERS: PerformanceCounters = {
  entities: 0,
  hotEntities: 0,
  warmEntities: 0,
  coldEntities: 0,
  visibleEntities: 0,
  approximateDrawCalls: 0,
  pathCalls: 0,
  pathsPerSecond: 0,
  pathCacheHits: 0,
  pathCacheMisses: 0,
  schedulerTicks: 0,
  schedulerDebt: 0,
  networkRebuilds: 0,
  activeRegions: 0,
  warmRegions: 0,
  sleepingRegions: 0
};

/** Bounded, allocation-light runtime telemetry. It is never serialized. */
export class PerformanceProfiler {
  private readonly metrics = new Map<PerformanceMetric, RollingMetric>();
  private readonly counters: PerformanceCounters = { ...DEFAULT_COUNTERS };
  private pathWindowStarted = performance.now();
  private pathWindowCalls = 0;

  public record(metric: PerformanceMetric, durationMs: number): void {
    let rolling = this.metrics.get(metric);
    if (!rolling) {
      rolling = new RollingMetric();
      this.metrics.set(metric, rolling);
    }
    rolling.add(durationMs);
  }

  public measure<T>(metric: PerformanceMetric, work: () => T): T {
    const started = performance.now();
    try { return work(); }
    finally { this.record(metric, performance.now() - started); }
  }

  public setCounter<K extends keyof PerformanceCounters>(key: K, value: PerformanceCounters[K]): void {
    this.counters[key] = value;
  }

  public increment<K extends keyof PerformanceCounters>(key: K, amount: number = 1): void {
    this.counters[key] += amount;
    if (key === 'pathCalls') {
      this.pathWindowCalls += amount;
      const now = performance.now();
      const elapsed = now - this.pathWindowStarted;
      if (elapsed >= 1000) {
        this.counters.pathsPerSecond = Math.round(this.pathWindowCalls * 1000 / elapsed);
        this.pathWindowCalls = 0;
        this.pathWindowStarted = now;
      }
    }
  }

  public metric(metric: PerformanceMetric): MetricSnapshot {
    return this.metrics.get(metric)?.snapshot() ?? { samples: 0, averageMs: 0, p95Ms: 0, maxMs: 0 };
  }

  public snapshot(): { metrics: Record<PerformanceMetric, MetricSnapshot>; counters: PerformanceCounters } {
    const names: PerformanceMetric[] = ['frame', 'simulation', 'render', 'entityAI', 'pathfinding', 'economy', 'warfare', 'trade', 'ui'];
    return {
      metrics: Object.fromEntries(names.map(name => [name, this.metric(name)])) as Record<PerformanceMetric, MetricSnapshot>,
      counters: { ...this.counters }
    };
  }
}

export const perfProfiler = new PerformanceProfiler();
