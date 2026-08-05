export type BrushCategory = 'terrain' | 'nature' | 'biomes' | 'life' | 'divine' | 'destruction' | 'inspect';

export interface PowerDefinition {
  id: string;
  name: string;
  category: BrushCategory;
  icon: string;
  description: string;
}

export class BrushManager {
  /**
   * The world opens in inspection mode, not with a terraforming brush armed.
   *
   * Selecting things is the baseline way a player interacts with the map, so it
   * has to be what a click does by default. Starting on `add_land` meant the
   * first click on a new world raised terrain instead — a destructive default
   * for what most players intend as "what is that?". Powers stay one click away
   * in the dock, and ESC always returns here.
   */
  public static readonly DEFAULT_POWER_ID = 'inspect_select';
  public static readonly DEFAULT_CATEGORY: BrushCategory = 'inspect';

  public activeCategory: BrushCategory = BrushManager.DEFAULT_CATEGORY;
  public activePowerId: string = BrushManager.DEFAULT_POWER_ID;
  public brushSize: number = 3;

  /** True when no editing power is armed — i.e. a click selects rather than edits. */
  public get isInspecting(): boolean {
    return this.activePowerId === BrushManager.DEFAULT_POWER_ID;
  }

  /** Disarms whatever tool is held and returns to inspection. Routed from ESC. */
  public resetToInspect(): void {
    this.activePowerId = BrushManager.DEFAULT_POWER_ID;
    this.activeCategory = BrushManager.DEFAULT_CATEGORY;
  }

  public setCategory(cat: BrushCategory): void {
    this.activeCategory = cat;
  }

  public setPower(powerId: string): void {
    this.activePowerId = powerId;
  }

  public setSize(size: number): void {
    this.brushSize = size;
  }
}
