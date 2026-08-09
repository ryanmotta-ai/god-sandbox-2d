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

/** WebGPU is primary; `?renderer=canvas` remains an explicit diagnostic/fallback override. */
export function resolveRendererDevSelection(search: string = globalThis.location?.search ?? ''): RendererDevSelection {
  const params = new URLSearchParams(search);
  const requested = params.get('renderer')?.toLowerCase();
  const preference: WorldRendererPreference = requested === 'canvas' ? 'canvas' : 'webgpu';
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
