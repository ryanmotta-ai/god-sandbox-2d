import type { DiplomacyManager } from '../../civ/Diplomacy';
import type { RenderOptions, SelectionMark } from '../Renderer';
import { WebGPUWorldRenderer } from '../webgpu/WebGPUWorldRenderer';
import { CanvasWorldRenderer } from './CanvasWorldRenderer';
import {
  resolveRendererDevSelection,
  type WorldRenderer,
  type WorldRendererKind,
  type WorldRendererTelemetry,
  type WorldRenderArguments
} from './WorldRenderer';

function describeRendererError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

/**
 * Incremental renderer switch. Canvas owns the original input surface; WebGPU
 * uses a separate pointer-transparent surface so a lost device can fall back
 * without replacing DOM nodes or simulation state.
 */
export class RendererHost implements WorldRenderer {
  private readonly canvasRenderer: CanvasWorldRenderer;
  private activeRenderer: WorldRenderer;
  private gpuRenderer: WebGPUWorldRenderer | null = null;
  private gpuCanvas: HTMLCanvasElement | null = null;
  private cssWidth = 1;
  private cssHeight = 1;
  private diplomacy: DiplomacyManager | null = null;
  private options: Partial<RenderOptions> = {};
  private selection: SelectionMark | null = null;
  private destroyed = false;
  private lastTelemetryPublish = -Infinity;

  public get kind(): WorldRendererKind { return this.activeRenderer.kind; }
  public get telemetry(): WorldRendererTelemetry { return this.activeRenderer.telemetry; }

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.canvasRenderer = new CanvasWorldRenderer(canvas);
    this.activeRenderer = this.canvasRenderer;
    const selection = resolveRendererDevSelection();
    document.documentElement.dataset.worldRenderer = 'canvas';
    if (selection.preference === 'webgpu') {
      void this.startWebGPU(selection.benchmarkInstances);
    } else {
      this.publishTelemetry();
    }
  }

  public setDiplomacy(diplomacy: DiplomacyManager): void {
    this.diplomacy = diplomacy;
    this.canvasRenderer.setDiplomacy(diplomacy);
    this.gpuRenderer?.setDiplomacy(diplomacy);
  }

  public setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
    this.canvasRenderer.setOptions(options);
    this.gpuRenderer?.setOptions(options);
  }

  public setSelection(selection: SelectionMark | null): void {
    this.selection = selection;
    this.canvasRenderer.setSelection(selection);
    this.gpuRenderer?.setSelection(selection);
  }

  public resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    // Canvas remains correctly sized and ready even while WebGPU is active.
    this.canvasRenderer.resize(this.cssWidth, this.cssHeight);
    this.gpuRenderer?.resize(this.cssWidth, this.cssHeight);
  }

  public render(...args: WorldRenderArguments): void {
    if (this.destroyed) return;
    try {
      this.activeRenderer.render(...args);
    } catch (error) {
      if (this.activeRenderer.kind === 'webgpu') this.activateCanvasFallback(error);
      else throw error;
    }
    this.publishTelemetry();
  }

  public toggleGrid(): boolean {
    const visible = this.canvasRenderer.toggleGrid();
    this.options = { ...this.options, showGrid: visible };
    this.gpuRenderer?.setOptions({ showGrid: visible });
    return visible;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.gpuRenderer?.destroy();
    this.canvasRenderer.destroy();
    this.gpuCanvas?.remove();
    this.gpuRenderer = null;
    this.gpuCanvas = null;
  }

  private async startWebGPU(benchmarkInstances: number): Promise<void> {
    const gpuCanvas = document.createElement('canvas');
    gpuCanvas.className = 'webgpu-world-canvas';
    gpuCanvas.setAttribute('aria-hidden', 'true');
    Object.assign(gpuCanvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      imageRendering: 'pixelated',
      pointerEvents: 'none',
      zIndex: '1',
      visibility: 'hidden'
    });
    this.canvas.parentElement?.insertBefore(gpuCanvas, this.canvas.nextSibling);
    this.gpuCanvas = gpuCanvas;

    try {
      const renderer = await WebGPUWorldRenderer.create(gpuCanvas, {
        cssWidth: this.cssWidth,
        cssHeight: this.cssHeight,
        benchmarkInstances,
        onFatalError: error => this.activateCanvasFallback(error)
      });
      if (!renderer.telemetry.active) {
        renderer.destroy();
        throw new Error(renderer.telemetry.message ?? 'WebGPU stopped during initialization');
      }
      if (this.destroyed) {
        renderer.destroy();
        gpuCanvas.remove();
        return;
      }
      this.gpuRenderer = renderer;
      if (this.diplomacy) renderer.setDiplomacy(this.diplomacy);
      renderer.setOptions(this.options);
      renderer.setSelection(this.selection);
      renderer.resize(this.cssWidth, this.cssHeight);
      this.activeRenderer = renderer;
      gpuCanvas.style.visibility = 'visible';
      document.documentElement.dataset.worldRenderer = 'webgpu';
      console.info('[RENDER-V1D] WebGPU primary renderer active');
      this.publishTelemetry();
    } catch (error) {
      console.warn('[RENDER-V1D] WebGPU initialization failed; Canvas remains active.', error);
      this.activateCanvasFallback(error);
    }
  }

  private activateCanvasFallback(error: unknown): void {
    if (this.destroyed) return;
    const message = describeRendererError(error);
    if (this.activeRenderer.kind === 'webgpu') this.gpuRenderer?.destroy();
    this.gpuCanvas?.remove();
    this.gpuCanvas = null;
    this.gpuRenderer = null;
    this.activeRenderer = this.canvasRenderer;
    this.canvasRenderer.telemetry.active = true;
    this.canvasRenderer.telemetry.status = 'fallback';
    this.canvasRenderer.telemetry.message = message;
    document.documentElement.dataset.worldRenderer = 'canvas-fallback';
    console.warn('[RENDER-V1D] Canvas fallback active:', message);
    this.publishTelemetry();
  }

  private publishTelemetry(): void {
    const snapshot = { ...this.activeRenderer.telemetry };
    window.__AETHORIA_RENDER__ = snapshot;
    window.__AETHORIA_RENDER_V1A__ = snapshot;
    const now = performance.now();
    if (now - this.lastTelemetryPublish < 250) return;
    this.lastTelemetryPublish = now;
    const data = document.documentElement.dataset;
    data.renderStatus = snapshot.status;
    data.renderInstances = String(snapshot.visibleInstances);
    data.renderDrawCalls = String(snapshot.drawCalls);
    data.renderUploadBytes = String(snapshot.bufferUploadBytes);
    data.renderPeakUploadBytes = String(snapshot.peakBufferUploadBytes);
    data.renderPrepMs = snapshot.renderPreparationMs.toFixed(3);
    data.renderPeakPrepMs = snapshot.peakRenderPreparationMs.toFixed(3);
    data.renderFrameMs = snapshot.frameSubmissionMs.toFixed(3);
    data.renderFrameIntervalMs = snapshot.frameIntervalMs.toFixed(3);
    data.renderAtlasBytes = String(snapshot.atlasBytes);
    data.renderStaticBufferBytes = String(snapshot.staticBufferBytes);
    data.renderDynamicBufferBytes = String(snapshot.dynamicBufferBytes);
    data.renderBenchmark = String(snapshot.benchmarkInstances);
  }
}
