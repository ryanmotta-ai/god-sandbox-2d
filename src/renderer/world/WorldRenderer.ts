import type { DiplomacyManager } from '../../civ/Diplomacy';
import type { PixelRenderer, RenderOptions, SelectionMark } from '../Renderer';

export type WorldRenderArguments = Parameters<PixelRenderer['render']>;
export type WorldRendererKind = 'canvas' | 'webgpu';
export type WorldRendererPreference = WorldRendererKind;

export interface WorldRendererTelemetry {
  kind: WorldRendererKind;
  active: boolean;
  status: 'initializing' | 'active' | 'fallback' | 'lost' | 'destroyed';
  visibleInstances: number;
  drawCalls: number;
  bufferUploadBytes: number;
  peakBufferUploadBytes: number;
  renderPreparationMs: number;
  peakRenderPreparationMs: number;
  frameSubmissionMs: number;
  frameIntervalMs: number;
  staticBufferBytes: number;
  dynamicBufferBytes: number;
  atlasBytes: number;
  benchmarkInstances: number;
  message?: string;
}

/**
 * The narrow contract shared by the migration-safe Canvas path and WebGPU.
 * Implementations receive gameplay objects only at the adapter boundary; the
 * WebGPU backend immediately converts them into a read-only render snapshot.
 */
export interface WorldRenderer {
  readonly kind: WorldRendererKind;
  readonly telemetry: WorldRendererTelemetry;
  setDiplomacy(diplomacy: DiplomacyManager): void;
  setOptions(options: Partial<RenderOptions>): void;
  setSelection(selection: SelectionMark | null): void;
  resize(cssWidth: number, cssHeight: number): void;
  render(...args: WorldRenderArguments): void;
  destroy(): void;
}

export interface RendererDevSelection {
  preference: WorldRendererPreference;
  benchmarkInstances: number;
}

const BENCHMARK_COUNTS = new Set([10_000, 50_000, 100_000, 250_000, 500_000]);

/**
 * Canvas is primary; `?renderer=webgpu` opts into the GPU path.
 *
 * The two renderers are not at parity and the gap is in the canvas path's favour:
 * it owns the organic coastlines, the layered building silhouettes, the terrain
 * feathering and the per-tile detail work that give the world its look. The
 * WebGPU path draws the same *content* from an instance buffer, which is faster
 * and flatter, and closing the visual gap would mean reimplementing all of that
 * as shader work.
 *
 * So the default follows the art rather than the benchmark. WebGPU stays
 * reachable behind the flag — it is the right foundation if that work is ever
 * done, and it is still the honest choice on a machine the canvas path cannot
 * carry — but nobody should have to pass a URL parameter to see the game look
 * the way it is meant to look.
 */
export function resolveRendererDevSelection(search: string = globalThis.location?.search ?? ''): RendererDevSelection {
  const params = new URLSearchParams(search);
  const requested = params.get('renderer')?.toLowerCase();
  const preference: WorldRendererPreference = requested === 'webgpu' ? 'webgpu' : 'canvas';
  const rawBenchmark = Number(params.get('renderBenchmark') ?? 0);
  const benchmarkInstances = BENCHMARK_COUNTS.has(rawBenchmark) ? rawBenchmark : 0;
  return { preference, benchmarkInstances };
}

declare global {
  interface Window {
    /** Current renderer telemetry; deliberately contains no simulation objects. */
    __AETHORIA_RENDER__?: WorldRendererTelemetry;
    /** Compatibility alias retained for V1A-C probes. */
    __AETHORIA_RENDER_V1A__?: WorldRendererTelemetry;
  }
}
