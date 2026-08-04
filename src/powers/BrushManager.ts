export type BrushCategory = 'terrain' | 'nature' | 'biomes' | 'life' | 'divine' | 'destruction' | 'inspect';

export interface PowerDefinition {
  id: string;
  name: string;
  category: BrushCategory;
  icon: string;
  description: string;
}

export class BrushManager {
  public activeCategory: BrushCategory = 'terrain';
  public activePowerId: string = 'add_land';
  public brushSize: number = 3;

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
