export interface SchedulerFrameResult {
  ticksRun: number;
  remainingDebt: number;
  elapsedMs: number;
}

export interface SchedulerOptions {
  frameBudgetMs?: number;
  maxTicksPerFrame?: number;
  maxDebtTicks?: number;
}

/**
 * Converts speed into deterministic fixed simulation ticks while bounding the
 * amount of work performed by one animation frame. Unprocessed work becomes a
 * small, bounded debt instead of a freeze-inducing burst.
 */
export class SimulationScheduler {
  private debt = 0;
  private absoluteTick = 0;
  private readonly frameBudgetMs: number;
  private readonly maxTicksPerFrame: number;
  private readonly maxDebtTicks: number;

  constructor(options: SchedulerOptions = {}) {
    this.frameBudgetMs = options.frameBudgetMs ?? 8;
    this.maxTicksPerFrame = options.maxTicksPerFrame ?? 96;
    this.maxDebtTicks = options.maxDebtTicks ?? 360;
  }

  public runFrame(speed: number, runTick: (absoluteTick: number) => void): SchedulerFrameResult {
    if (speed <= 0) return { ticksRun: 0, remainingDebt: this.debt, elapsedMs: 0 };
    this.debt = Math.min(this.maxDebtTicks, this.debt + speed);
    const started = performance.now();
    let ticksRun = 0;

    while (this.debt >= 1 && ticksRun < this.maxTicksPerFrame) {
      this.absoluteTick++;
      runTick(this.absoluteTick);
      this.debt -= 1;
      ticksRun++;
      if (ticksRun > 0 && performance.now() - started >= this.frameBudgetMs) break;
    }

    return { ticksRun, remainingDebt: this.debt, elapsedMs: performance.now() - started };
  }

  public isDue(cadence: number, phase: number = 0): boolean {
    return cadence <= 1 || this.absoluteTick % cadence === phase % cadence;
  }

  public get tick(): number { return this.absoluteTick; }
  public get pendingTicks(): number { return this.debt; }

  public reset(): void {
    this.debt = 0;
    this.absoluteTick = 0;
  }
}
