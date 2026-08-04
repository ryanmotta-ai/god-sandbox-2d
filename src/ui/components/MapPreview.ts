import { TileMap } from '../../world/TileMap';
import { TerrainType } from '../../world/Biomes';
import { WorldGenerator, GeneratorPreset } from '../../world/WorldGenerator';
import { Kingdom } from '../../civ/Kingdom';
import { City } from '../../civ/City';
import { Tile } from '../../world/Tile';
import { TERRAIN_VISUALS, terrainSurfaceColor, withAlpha } from '../../renderer/TerrainPalette';

export interface MapPreviewOptions {
  /** Paint kingdom territory tints on top of the terrain. */
  kingdoms?: Map<string, Kingdom> | null;
  /** Draw a dot per city. */
  cities?: Map<string, City> | null;
  /** Draw entity dots (used by the minimap). */
  entityDots?: { x: number; y: number; color: string }[];
  /** Highlight the visible camera rectangle: [x, y, w, h] in tile units. */
  viewport?: { x: number; y: number; w: number; h: number } | null;
}

/**
 * Renders a whole TileMap into a small canvas.
 * Shared by the world-setup preview, the in-game minimap and save-slot thumbnails,
 * so all three always look like the same world.
 */
export class MapPreview {
  public readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number, className = 'map-preview') {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.className = className;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  public resize(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = false;
  }

  public clear(): void {
    this.ctx.fillStyle = '#05070c';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Draws a "generating..." placeholder. */
  public drawPlaceholder(message: string): void {
    this.clear();
    this.ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    this.ctx.font = '11px "Outfit", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.textAlign = 'start';
  }

  public drawTileMap(map: TileMap, opts: MapPreviewOptions = {}): void {
    this.drawGrid(map.grid, map.width, map.height, opts);
  }

  /** Generates a world with the given parameters and previews it without touching game state. */
  public drawGenerated(size: number, preset: GeneratorPreset, seed: number): void {
    // Preview at a capped resolution: generation cost grows with size².
    const grid = WorldGenerator.generate(size, size, preset, seed);
    this.drawGrid(grid, size, size, {});
  }

  private drawGrid(grid: Tile[][], width: number, height: number, opts: MapPreviewOptions): void {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.clear();

    const scale = Math.min(cw / width, ch / height);
    const offsetX = (cw - width * scale) / 2;
    const offsetY = (ch - height * scale) / 2;
    const cell = Math.max(1, Math.ceil(scale));

    for (let x = 0; x < width; x++) {
      const col = grid[x];
      if (!col) continue;
      for (let y = 0; y < height; y++) {
        const tile = col[y];
        if (!tile) continue;

        let color = terrainSurfaceColor(tile, x, y);

        if (tile.isOnFire) color = '#f97316';

        this.ctx.fillStyle = color;
        this.ctx.fillRect(offsetX + x * scale, offsetY + y * scale, cell, cell);
        this.drawMiniTerrainEdges(grid, width, height, x, y, offsetX + x * scale, offsetY + y * scale, cell);

        if (opts.kingdoms && tile.kingdomId) {
          const k = opts.kingdoms.get(tile.kingdomId);
          if (k) {
            this.ctx.fillStyle = withAlpha(k.color, 0.5);
            this.ctx.fillRect(offsetX + x * scale, offsetY + y * scale, cell, cell);
          }
        }

        // Roads on top of everything: dirt trails brown, stone gray, imperial amber.
        if (tile.roadLevel > 0) {
          this.ctx.fillStyle = tile.roadLevel === 3 ? '#fbbf24' : tile.roadLevel === 2 ? '#a8a29e' : '#8b5a2b';
          this.ctx.fillRect(offsetX + x * scale, offsetY + y * scale, cell, cell);
        }
      }
    }

    if (opts.entityDots) {
      for (const dot of opts.entityDots) {
        this.ctx.fillStyle = dot.color;
        this.ctx.fillRect(offsetX + dot.x * scale - 0.5, offsetY + dot.y * scale - 0.5, Math.max(1, cell), Math.max(1, cell));
      }
    }

    if (opts.cities) {
      for (const city of opts.cities.values()) {
        const px = offsetX + city.x * scale;
        const py = offsetY + city.y * scale;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(px, py, Math.max(1.5, scale * 0.9), 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        this.ctx.lineWidth = 0.7;
        this.ctx.stroke();
      }
    }

    if (opts.viewport) {
      const { x, y, w, h } = opts.viewport;
      this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(offsetX + x * scale, offsetY + y * scale, w * scale, h * scale);
    }
  }

  /** Maps a click on the canvas back to tile coordinates. */
  public canvasToTile(clientX: number, clientY: number, mapWidth: number, mapHeight: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = Math.min(cw / mapWidth, ch / mapHeight);
    const offsetX = (cw - mapWidth * scale) / 2;
    const offsetY = (ch - mapHeight * scale) / 2;

    const localX = ((clientX - rect.left) / rect.width) * cw;
    const localY = ((clientY - rect.top) / rect.height) * ch;

    return {
      x: Math.max(0, Math.min(mapWidth - 1, (localX - offsetX) / scale)),
      y: Math.max(0, Math.min(mapHeight - 1, (localY - offsetY) / scale))
    };
  }

  public toDataUrl(): string {
    return this.canvas.toDataURL('image/png');
  }

  private isWater(type: TerrainType): boolean {
    return type === TerrainType.DEEP_OCEAN || type === TerrainType.SHALLOW_WATER;
  }

  private drawMiniTerrainEdges(
    grid: Tile[][],
    width: number,
    height: number,
    x: number,
    y: number,
    px: number,
    py: number,
    cell: number
  ): void {
    if (cell < 1) return;

    const tile = grid[x][y];
    const dirs = [
      { dx: -1, dy: 0, edge: 'left' as const },
      { dx: 1, dy: 0, edge: 'right' as const },
      { dx: 0, dy: -1, edge: 'top' as const },
      { dx: 0, dy: 1, edge: 'bottom' as const }
    ];
    const water = this.isWater(tile.type);
    const edgeSize = Math.max(1, Math.ceil(cell * 0.22));

    for (const dir of dirs) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const neighbor = grid[nx][ny];
      if (!neighbor || neighbor.type === tile.type) continue;

      const neighborWater = this.isWater(neighbor.type);
      if (water !== neighborWater) {
        this.ctx.fillStyle = water ? withAlpha('#f8fafc', 0.38) : withAlpha(TERRAIN_VISUALS[TerrainType.SAND].high, 0.34);
        this.paintMiniEdge(px, py, cell, dir.edge, edgeSize);
      } else if (!water && tile.height - neighbor.height > 0.08) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.18)';
        this.paintMiniEdge(px, py, cell, dir.edge, edgeSize);
      }
    }
  }

  private paintMiniEdge(
    px: number,
    py: number,
    cell: number,
    edge: 'left' | 'right' | 'top' | 'bottom',
    edgeSize: number
  ): void {
    if (edge === 'left') this.ctx.fillRect(px, py, edgeSize, cell);
    else if (edge === 'right') this.ctx.fillRect(px + cell - edgeSize, py, edgeSize, cell);
    else if (edge === 'top') this.ctx.fillRect(px, py, cell, edgeSize);
    else this.ctx.fillRect(px, py + cell - edgeSize, cell, edgeSize);
  }
}
