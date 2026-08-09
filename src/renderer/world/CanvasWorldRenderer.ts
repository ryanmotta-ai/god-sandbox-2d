import type { DiplomacyManager } from '../../civ/Diplomacy';
import { perfProfiler } from '../../perf/PerformanceProfiler';
import { PixelRenderer, type RenderOptions, type SelectionMark } from '../Renderer';
import type { WorldRenderer, WorldRendererTelemetry, WorldRenderArguments } from './WorldRenderer';

/** The existing renderer, preserved behind the migration contract unchanged. */
export class CanvasWorldRenderer implements WorldRenderer {
  public readonly kind = 'canvas' as const;
  public readonly telemetry: WorldRendererTelemetry = {
    kind: 'canvas',
    active: true,
    status: 'active',
    visibleInstances: 0,
    drawCalls: 0,
    bufferUploadBytes: 0,
    peakBufferUploadBytes: 0,
    renderPreparationMs: 0,
    peakRenderPreparationMs: 0,
    frameSubmissionMs: 0,
    frameIntervalMs: 0,
    staticBufferBytes: 0,
    dynamicBufferBytes: 0,
    atlasBytes: 0,
    benchmarkInstances: 0
  };

  private readonly renderer: PixelRenderer;
  private previousFrameStarted = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new PixelRenderer(canvas);
  }

  public setDiplomacy(diplomacy: DiplomacyManager): void { this.renderer.setDiplomacy(diplomacy); }
  public setOptions(options: Partial<RenderOptions>): void { this.renderer.setOptions(options); }
  public setSelection(selection: SelectionMark | null): void { this.renderer.setSelection(selection); }
  public resize(cssWidth: number, cssHeight: number): void { this.renderer.resize(cssWidth, cssHeight); }

  public render(...args: WorldRenderArguments): void {
    const started = performance.now();
    if (this.previousFrameStarted > 0) this.telemetry.frameIntervalMs = started - this.previousFrameStarted;
    this.previousFrameStarted = started;
    this.renderer.render(...args);
    const counters = perfProfiler.snapshot().counters;
    this.telemetry.visibleInstances = counters.visibleEntities;
    this.telemetry.drawCalls = counters.approximateDrawCalls;
    this.telemetry.frameSubmissionMs = performance.now() - started;
  }

  public toggleGrid(): boolean { return this.renderer.toggleGrid(); }

  public destroy(): void {
    this.telemetry.active = false;
    this.telemetry.status = 'destroyed';
  }
}
