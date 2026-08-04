import { el } from '../core/Dom';
import { MapPreview } from '../components/MapPreview';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import type { GameContext } from '../core/GameContext';

const SIZE = 168;
const REDRAW_INTERVAL_MS = 400;

/**
 * Bottom-right world minimap. Shows terrain, kingdom territory, cities and the
 * camera viewport; click or drag to jump the camera anywhere in the world.
 */
export class Minimap {
  public readonly root: HTMLElement;
  private preview: MapPreview;
  private ctx: GameContext | null = null;
  private lastDraw = 0;
  private collapsed = false;
  private dragging = false;

  constructor() {
    this.preview = new MapPreview(SIZE, SIZE, 'minimap-canvas');

    const toggle = el('button', {
      class: 'minimap-toggle',
      title: 'Collapse minimap (M)',
      text: '▾',
      on: { click: () => this.toggle() }
    });

    this.root = el('div', { class: 'minimap' }, [
      el('div', { class: 'minimap-head' }, [
        el('span', { class: 'minimap-title', text: 'WORLD MAP' }),
        toggle
      ]),
      el('div', { class: 'minimap-body' }, [this.preview.canvas])
    ]);

    this.preview.canvas.addEventListener('mousedown', ev => {
      this.dragging = true;
      this.jumpTo(ev);
    });
    this.preview.canvas.addEventListener('mousemove', ev => {
      if (this.dragging) this.jumpTo(ev);
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    this.preview.canvas.addEventListener('contextmenu', ev => ev.preventDefault());
  }

  public attach(ctx: GameContext): void {
    this.ctx = ctx;
  }

  public toggle(): void {
    this.collapsed = !this.collapsed;
    this.root.classList.toggle('collapsed', this.collapsed);
  }

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  private jumpTo(ev: MouseEvent): void {
    if (!this.ctx) return;
    const map = this.ctx.tileMap;
    const tile = this.preview.canvasToTile(ev.clientX, ev.clientY, map.width, map.height);
    this.ctx.focusOn(tile.x, tile.y);
  }

  public tick(now: number): void {
    if (!this.ctx || this.collapsed || this.root.classList.contains('hidden')) return;
    if (now - this.lastDraw < REDRAW_INTERVAL_MS) return;
    this.lastDraw = now;

    const { tileMap, sim, camera } = this.ctx;

    // Only plot a capped sample of entities — 2000 dots on a 168px canvas is noise anyway.
    const dots: { x: number; y: number; color: string }[] = [];
    const step = Math.max(1, Math.ceil(sim.entities.length / 600));
    for (let i = 0; i < sim.entities.length; i += step) {
      const e = sim.entities[i];
      dots.push({ x: e.x, y: e.y, color: SPECIES_DEFINITIONS[e.species].primaryColor });
    }

    const viewW = window.innerWidth / (camera.tileSize * camera.zoom);
    const viewH = window.innerHeight / (camera.tileSize * camera.zoom);

    this.preview.drawTileMap(tileMap, {
      kingdoms: sim.kingdoms,
      cities: sim.cities,
      entityDots: dots,
      viewport: {
        x: camera.x / camera.tileSize - viewW / 2,
        y: camera.y / camera.tileSize - viewH / 2,
        w: viewW,
        h: viewH
      }
    });
  }
}
