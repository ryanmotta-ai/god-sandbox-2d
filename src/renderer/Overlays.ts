export type OverlayMode = 'none' | 'political' | 'population' | 'biome' | 'temperature' | 'resources';

export class OverlayManager {
  public activeMode: OverlayMode = 'none';

  public setMode(mode: OverlayMode): void {
    this.activeMode = mode;
  }
}
