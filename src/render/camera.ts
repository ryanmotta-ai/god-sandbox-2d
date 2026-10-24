import { TILE } from '../core/config';

/** Integer-ish zoom steps keep pixel art crisp; the camera position snaps to whole screen pixels. */
export const ZOOMS = [0.25, 0.5, 1, 2, 3, 4, 6];

export class Camera {
  /** Centre of the view in world pixels. */
  x = 0; y = 0;
  zoomIdx = 3;
  vw = 1; vh = 1;
  constructor(public worldW: number, public worldH: number) { this.x = worldW * TILE / 2; this.y = worldH * TILE / 2; }
  get zoom(): number { return ZOOMS[this.zoomIdx]; }
  resize(w: number, h: number): void { this.vw = w; this.vh = h; }
  /** Top-left of the view in world pixels, snapped so one source pixel is a whole number of screen pixels. */
  get left(): number { return Math.round(this.x * this.zoom - this.vw / 2) / this.zoom; }
  get top(): number { return Math.round(this.y * this.zoom - this.vh / 2) / this.zoom; }
  clamp(): void {
    const margin = 6 * TILE;
    this.x = Math.min(this.worldW * TILE + margin, Math.max(-margin, this.x));
    this.y = Math.min(this.worldH * TILE + margin, Math.max(-margin, this.y));
  }
  /** Zoom one step around a screen point, keeping the world point under it fixed. */
  zoomAt(dir: number, sx: number, sy: number): void {
    const wx = this.left + sx / this.zoom, wy = this.top + sy / this.zoom;
    this.zoomIdx = Math.min(ZOOMS.length - 1, Math.max(0, this.zoomIdx + dir));
    this.x = wx - (sx - this.vw / 2) / this.zoom;
    this.y = wy - (sy - this.vh / 2) / this.zoom;
    this.clamp();
  }
  toWorld(sx: number, sy: number): { x: number; y: number } { return { x: this.left + sx / this.zoom, y: this.top + sy / this.zoom }; }
  toTile(sx: number, sy: number): { tx: number; ty: number } { const w = this.toWorld(sx, sy); return { tx: Math.floor(w.x / TILE), ty: Math.floor(w.y / TILE) }; }
}
