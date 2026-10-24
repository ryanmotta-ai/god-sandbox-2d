import { World, CHUNK } from '../world/world';
import { TILE } from '../core/config';
import { Camera } from './camera';
import { bakeChunk, CHUNK_PX, type BakedChunk } from '../gfx/terrain';
import { makeWaterFrames, WATER_FRAMES } from '../gfx/water';
import { plantSprite, PCX, PBASE, type Season } from '../gfx/flora';
import { mountainSprite, MCX, MBASE } from '../gfx/mountain';
import { hash2 } from '../core/rng';
import { T, O } from '../world/defs';

interface Slot { baked: BakedChunk | null; ver: number }

/** One Canvas2D renderer. Passes: water → baked land → foam → (objects, entities, fx in later modules). */
export class Renderer {
  ctx: CanvasRenderingContext2D;
  chunks = new Map<number, Slot>();
  water = makeWaterFrames();
  waterPat: CanvasPattern[];
  /** Ms of bake work allowed per frame; first frames after a load are the only ones that hit it. */
  bakeBudget = 10;
  time = 0;
  season: Season = 1;

  constructor(public canvas: HTMLCanvasElement, public world: World, public cam: Camera) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.waterPat = this.water.map(c => this.ctx.createPattern(c, 'repeat')!);
  }

  setWorld(w: World): void { this.world = w; this.chunks.clear(); }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cam.resize(w, h);
  }

  draw(dt: number): void {
    this.time += dt;
    this.resize();
    const { ctx, cam, world } = this;
    const z = cam.zoom, left = cam.left, top = cam.top, vw = cam.vw / z, vh = cam.vh / z;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b2f5e';
    ctx.fillRect(0, 0, cam.vw, cam.vh);
    ctx.setTransform(z, 0, 0, z, -left * z, -top * z);

    // water: 6 fps loop, pattern anchored to the world
    ctx.fillStyle = this.waterPat[Math.floor(this.time * 5) % WATER_FRAMES];
    ctx.fillRect(left, top, vw, vh);

    // visible chunks
    const cx0 = Math.max(0, Math.floor(left / CHUNK_PX)), cx1 = Math.min(world.cw - 1, Math.floor((left + vw) / CHUNK_PX));
    const ch = Math.ceil(world.h / CHUNK);
    const cy0 = Math.max(0, Math.floor(top / CHUNK_PX)), cy1 = Math.min(ch - 1, Math.floor((top + vh) / CHUNK_PX));
    const t0 = performance.now();
    const foamA = 0.38 + 0.34 * Math.sin(this.time * 2.1);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * world.cw + cx;
      let slot = this.chunks.get(key);
      if (!slot) { slot = { baked: null, ver: -1 }; this.chunks.set(key, slot); }
      if (slot.ver !== world.chunkVer[key] && (performance.now() - t0 < this.bakeBudget || !slot.baked)) {
        if (performance.now() - t0 < this.bakeBudget || !slot.baked && this.chunks.size < 4) {
          slot.baked = bakeChunk(world, cx, cy, slot.baked ?? undefined);
          slot.ver = world.chunkVer[key];
        }
      }
      if (!slot.baked) continue;
      ctx.drawImage(slot.baked.land, cx * CHUNK_PX, cy * CHUNK_PX);
      if (slot.baked.hasWater) { ctx.globalAlpha = foamA; ctx.drawImage(slot.baked.foam, cx * CHUNK_PX, cy * CHUNK_PX); ctx.globalAlpha = 1; }
    }
    // drop chunks that are far away
    if (this.chunks.size > 80) for (const k of this.chunks.keys()) {
      const x = k % world.cw, y = Math.floor(k / world.cw);
      if (x < cx0 - 3 || x > cx1 + 3 || y < cy0 - 3 || y > cy1 + 3) this.chunks.delete(k);
    }
    this.drawObjects(left, top, vw, vh);
  }

  /** Mountains and plants, row by row so lower rows overlap higher ones (painter's order). */
  private drawObjects(left: number, top: number, vw: number, vh: number): void {
    const { ctx, world } = this;
    const tx0 = Math.max(0, Math.floor(left / TILE) - 2), tx1 = Math.min(world.w - 1, Math.floor((left + vw) / TILE) + 2);
    const ty0 = Math.max(0, Math.floor(top / TILE) - 1), ty1 = Math.min(world.h - 1, Math.floor((top + vh) / TILE) + 3);
    const t = this.time;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * world.w + tx, terr = world.terrain[i], o = world.obj[i];
      const jx = (hash2(tx, ty, 61) - 0.5) * 12, jy = (hash2(tx, ty, 62) - 0.5) * 8;
      if (terr === T.MOUNTAIN || terr === T.PEAK) {
        const spr = mountainSprite(Math.floor(hash2(tx, ty, 63) * 6), world.height[i], terr === T.PEAK || world.temp[i] < 90);
        ctx.drawImage(spr, Math.round(tx * TILE + TILE / 2 + jx * 0.5 - MCX), Math.round(ty * TILE + TILE - 2 - MBASE));
      }
      if (o !== O.NONE) {
        const spr = plantSprite(o, Math.floor(hash2(tx, ty, 64) * 4), world.objAge[i], this.season, t, hash2(tx, ty, 65));
        ctx.drawImage(spr, Math.round(tx * TILE + TILE / 2 + jx - PCX), Math.round(ty * TILE + TILE - 6 + jy - PBASE));
      }
    }
  }
}
