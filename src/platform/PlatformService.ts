import { invoke, isTauri } from '@tauri-apps/api/core';

export type PlatformRuntime = 'web' | 'tauri';

export interface PlatformSnapshot {
  runtime: PlatformRuntime;
  desktop: boolean;
  webGpuAvailable: boolean;
}

/**
 * The single frontend boundary for runtime detection and native IPC.
 * Gameplay code must depend on a platform-facing service such as SaveStorage,
 * never on Tauri globals or commands directly.
 */
export class PlatformService {
  private readonly detectedRuntime: PlatformRuntime;

  public constructor(runtimeOverride?: PlatformRuntime) {
    this.detectedRuntime = runtimeOverride ?? (isTauri() ? 'tauri' : 'web');
  }

  public get runtime(): PlatformRuntime {
    return this.detectedRuntime;
  }

  public get isDesktop(): boolean {
    return this.detectedRuntime === 'tauri';
  }

  public get webGpuAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  public snapshot(): PlatformSnapshot {
    return {
      runtime: this.runtime,
      desktop: this.isDesktop,
      webGpuAvailable: this.webGpuAvailable
    };
  }

  /** Native invocation stays here so Tauri does not leak into storage/gameplay code. */
  public async invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!this.isDesktop) {
      throw new Error(`Native command '${command}' is unavailable in the web runtime`);
    }

    return invoke<T>(command, args);
  }
}

export const platform = new PlatformService();
