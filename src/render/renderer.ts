import { CHUNK } from '../world/world';
import { TILE } from '../core/config';
import { Camera } from './camera';
import { bakeChunk, CHUNK_PX, type BakedChunk } from '../gfx/terrain';
import { makeWaterFrames, WATER_FRAMES } from '../gfx/water';
import { plantSprite, PCX, PBASE, type Season } from '../gfx/flora';
import { mountainSprite, MCX, MBASE } from '../gfx/mountain';
import { buildingSprite, cropSprite, bSize } from '../gfx/buildings';
import { hash2 } from '../core/rng';
import { T, O, TERRAIN } from '../world/defs';
import type { Sim } from '../sim/sim';
import type { Unit } from '../sim/unit';
import type { Building } from '../sim/buildings';
import { Particles } from './fx';
import { frameFor, flashOf, shadowSprite } from './units';
import { ambient, Weather } from './atmosphere';
import type { Sound } from '../core/sound';

interface Slot { baked: BakedChunk | null; ver: number; zone: HTMLCanvasElement | null; zoneVer: number }
interface Item { y: number; k: 0 | 1 | 2 | 3 | 4; a: number; b: number; o?: Unit | Building }

/** Where each building's roof ridge sits (px above the footprint's bottom edge), for flags and chimney smoke. */
const RIDGE: Record<string, number> = { hut: 48, house: 70, hall: 82, barracks: 64, tower: 72, temple: 60, storehouse: 54, lumber: 40, smith: 60, windmill: 66, well: 34, campfire: 14, farm: 30 };
const CHIMNEY: Record<string, [number, number]> = { hut: [0.74, 54], house: [0.78, 84], hall: [0.78, 98], smith: [0.7, 62] };

/** One Canvas2D renderer. Terrain/water/foam/borders are baked or patterned; everything standing up is depth-sorted together. */
export class Renderer {
  ctx: CanvasRenderingContext2D;
  chunks = new Map<number, Slot>();
  water = makeWaterFrames();
  waterPat: CanvasPattern[];
  bakeBudget = 10;
  time = 0;
  fx = new Particles();
  weather = new Weather();
  selected: { kind: 'unit' | 'building' | 'city' | 'kingdom'; id: number } | null = null;
  showBorders = true;
  showNames = true;
  items: Item[] = [];
  /** Tile hover / brush preview in tile coords. */
  hover: { x: number; y: number; r: number; shape: 'circle' | 'square' } | null = null;
  lightCanvas: HTMLCanvasElement;
  sound: Sound | null = null;

  constructor(public canvas: HTMLCanvasElement, public sim: Sim, public cam: Camera) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.waterPat = this.water.map(c => this.ctx.createPattern(c, 'repeat')!);
    this.lightCanvas = makeGlow();
  }

  setSim(s: Sim): void { this.sim = s; this.chunks.clear(); this.fx = new Particles(); }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cam.resize(w, h);
  }

  /** `alpha` ∈ [0,1): how far between the last two sim ticks we are, so motion is smooth at any frame rate. */
  draw(dt: number, alpha: number): void {
    this.time += dt;
    this.resize();
    const { ctx, cam, sim } = this, world = sim.world, t = this.time;
    // drain sim effects into particles
    const cam0 = this.cam, cxw = cam0.x / TILE, cyw = cam0.y / TILE, reach = Math.max(18, cam0.vw / cam0.zoom / TILE);
    for (const e of sim.fx) { this.fx.emit(e); if (this.sound) { const d = Math.hypot(e.x - cxw, e.y - cyw); this.sound.fx(e, Math.max(0, 1 - d / (reach * 1.2)) * Math.min(1, 0.45 + cam0.zoom * 0.2)); } }
    sim.fx.length = 0;
    this.fx.update(dt);
    const z = cam.zoom, shake = this.fx.shake;
    const left = cam.left + (shake ? (Math.random() - 0.5) * shake : 0), top = cam.top + (shake ? (Math.random() - 0.5) * shake : 0);
    const vw = cam.vw / z, vh = cam.vh / z;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b2f5e'; ctx.fillRect(0, 0, cam.vw, cam.vh);
    ctx.setTransform(z, 0, 0, z, -left * z, -top * z);
    ctx.fillStyle = this.waterPat[Math.floor(t * 5) % WATER_FRAMES];
    ctx.fillRect(left, top, vw, vh);

    const cx0 = Math.max(0, Math.floor(left / CHUNK_PX)), cx1 = Math.min(world.cw - 1, Math.floor((left + vw) / CHUNK_PX));
    const ch = Math.ceil(world.h / CHUNK);
    const cy0 = Math.max(0, Math.floor(top / CHUNK_PX)), cy1 = Math.min(ch - 1, Math.floor((top + vh) / CHUNK_PX));
    const t0 = performance.now();
    const foamA = 0.38 + 0.34 * Math.sin(t * 2.1);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * world.cw + cx;
      let slot = this.chunks.get(key);
      if (!slot) { slot = { baked: null, ver: -1, zone: null, zoneVer: -1 }; this.chunks.set(key, slot); }
      if (slot.ver !== world.chunkVer[key] && (performance.now() - t0 < this.bakeBudget || !slot.baked)) {
        slot.baked = bakeChunk(world, cx, cy, slot.baked ?? undefined); slot.ver = world.chunkVer[key];
      }
      if (!slot.baked) continue;
      ctx.drawImage(slot.baked.land, cx * CHUNK_PX, cy * CHUNK_PX);
      if (slot.baked.hasWater) { ctx.globalAlpha = foamA; ctx.drawImage(slot.baked.foam, cx * CHUNK_PX, cy * CHUNK_PX); ctx.globalAlpha = 1; }
      if (this.showBorders) {
        if (slot.zoneVer !== sim.zoneVer && performance.now() - t0 < this.bakeBudget + 6) { slot.zone = this.bakeZone(cx, cy, slot.zone); slot.zoneVer = sim.zoneVer; }
        if (slot.zone) ctx.drawImage(slot.zone, cx * CHUNK_PX, cy * CHUNK_PX);
      }
    }
    if (this.chunks.size > 90) for (const k of this.chunks.keys()) {
      const x = k % world.cw, y = Math.floor(k / world.cw);
      if (x < cx0 - 3 || x > cx1 + 3 || y < cy0 - 3 || y > cy1 + 3) this.chunks.delete(k);
    }

    this.drawWorldObjects(left, top, vw, vh, alpha);
    this.drawDisasters();
    this.fx.draw(ctx);
    this.drawArrows(alpha);
    this.drawLighting(left, top, vw, vh);
    this.weather.draw(ctx, sim, cam.vw, cam.vh, dt, z);
    this.drawOverlays(left, top, vw, vh);
    if (this.fx.flash > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, this.fx.flash)})`; ctx.fillRect(0, 0, cam.vw, cam.vh); }
  }

  /** Territory tint + border line for one chunk, in each realm's colour. */
  private bakeZone(cx: number, cy: number, into: HTMLCanvasElement | null): HTMLCanvasElement {
    const c = into ?? document.createElement('canvas');
    c.width = c.height = CHUNK_PX;
    const g = c.getContext('2d')!, w = this.sim.world;
    const colorOf = new Map<number, string>();
    const col = (z: number): string | null => {
      let v = colorOf.get(z);
      if (v === undefined) { const city = this.sim.cities.get(z); v = city ? (this.sim.kingdoms.get(city.kingdomId)?.color ?? '') : ''; colorOf.set(z, v); }
      return v || null;
    };
    for (let ty = cy * CHUNK; ty < Math.min(w.h, (cy + 1) * CHUNK); ty++) for (let tx = cx * CHUNK; tx < Math.min(w.w, (cx + 1) * CHUNK); tx++) {
      const z = w.zone[ty * w.w + tx];
      if (!z) continue;
      const color = col(z);
      if (!color) continue;
      const px = (tx - cx * CHUNK) * TILE, py = (ty - cy * CHUNK) * TILE;
      g.globalAlpha = 0.11; g.fillStyle = color; g.fillRect(px, py, TILE, TILE);
      g.globalAlpha = 0.85;
      const nz = (x: number, y: number): number => (w.inb(x, y) ? w.zone[y * w.w + x] : -1);
      const edge = (dx: number, dy: number): boolean => { const o = nz(tx + dx, ty + dy); return o !== z && (o !== 0 || true) && !(o > 0 && col(o) === color); };
      // dashed 2px inner line: dashes read as a border, not a wall
      if (edge(0, -1)) for (let i = 0; i < TILE; i += 6) g.fillRect(px + i, py, 4, 2);
      if (edge(0, 1)) for (let i = 0; i < TILE; i += 6) g.fillRect(px + i, py + TILE - 2, 4, 2);
      if (edge(-1, 0)) for (let i = 0; i < TILE; i += 6) g.fillRect(px, py + i, 2, 4);
      if (edge(1, 0)) for (let i = 0; i < TILE; i += 6) g.fillRect(px + TILE - 2, py + i, 2, 4);
    }
    return c;
  }

  private drawWorldObjects(left: number, top: number, vw: number, vh: number, alpha: number): void {
    const { ctx, sim } = this, world = sim.world, t = this.time, items = this.items;
    items.length = 0;
    const tx0 = Math.max(0, Math.floor(left / TILE) - 2), tx1 = Math.min(world.w - 1, Math.floor((left + vw) / TILE) + 2);
    const ty0 = Math.max(0, Math.floor(top / TILE) - 1), ty1 = Math.min(world.h - 1, Math.floor((top + vh) / TILE) + 4);
    const season = sim.season as Season;
    const lod = this.cam.zoom >= 1 ? 0 : this.cam.zoom >= 0.5 ? 1 : 2;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * world.w + tx, terr = world.terrain[i], o = world.obj[i];
      if ((terr === T.MOUNTAIN || terr === T.PEAK) && (lod < 2 || ((tx + ty) & 1) === 0)) items.push({ y: ty * TILE + TILE - 2, k: 1, a: tx, b: ty });
      if (o !== O.NONE && !(lod > 0 && MINOR.has(o)) && !(lod > 1 && world.objAge[i] < 170)) items.push({ y: ty * TILE + TILE - 6 + (hash2(tx, ty, 62) - 0.5) * 8 + 1, k: 0, a: tx, b: ty });
    }
    const pad = 3;
    for (const [, b] of sim.buildings) {
      const d = b.def;
      if (b.x + d.w < tx0 - pad || b.x > tx1 + pad || b.y + d.h < ty0 - 3 || b.y - 3 > ty1) continue;
      items.push({ y: (b.y + d.h) * TILE, k: 2, a: 0, b: 0, o: b });
    }
    const L = this.cam.zoom >= 1 ? 1 : 0;
    for (const u of sim.units) {
      if (lod === 2) { if (u.alive && u.x >= tx0 && u.x <= tx1 && u.y >= ty0 && u.y <= ty1 && (u.def.civ || u.species === 'dragon')) { ctx.fillStyle = sim.kingdoms.get(u.kingdomId)?.color ?? (u.species === 'dragon' ? '#e03030' : '#ddd'); ctx.fillRect(Math.round(u.x * TILE) - 2, Math.round(u.y * TILE) - 6, u.species === 'dragon' ? 12 : 5, u.species === 'dragon' ? 8 : 6); } continue; }
      if (u.x < tx0 - 2 || u.x > tx1 + 2 || u.y < ty0 - 3 || u.y > ty1 + 3) continue;
      const ix = u.px + (u.x - u.px) * alpha, iy = u.py + (u.y - u.py) * alpha;
      items.push({ y: iy * TILE + (u.def.fly && u.species !== 'dragon' ? 40 : 0) + u.id * 1e-6, k: 3, a: ix, b: iy, o: u });
    }
    items.sort((p, q) => p.y - q.y);
    // ground-level things first: crops and shadows (so nothing is shadowed by a neighbour's sprite)
    for (const it of items) {
      if (it.k === 2) { const b = it.o as Building; if (b.type === 'farm' && b.done) { ctx.drawImage(cropSprite(b.crop < 0.12 ? 0 : b.crop < 0.45 ? 1 : b.crop < 0.78 ? 2 : 3), b.x * TILE - 8, b.y * TILE - 30); } }
      else if (it.k === 3 && lod === 0) { const u = it.o as Unit; const s = shadowSprite(Math.round(frameSize(u))); if (u.state !== 'dead' || u.stateT < 1) ctx.drawImage(s, Math.round(it.a * TILE - s.width / 2), Math.round(it.b * TILE - s.height / 2 + 1)); }
      else if (it.k === 0 && lod === 0) { const i = it.b * world.w + it.a, o = world.obj[i]; if (o !== O.NONE && OBJ_SHADOW.has(o)) { const r = o === O.JUNGLE_TREE ? 12 : o === O.PINE || o === O.SNOW_PINE ? 8 : 9; const s = shadowSprite(r); ctx.drawImage(s, Math.round(it.a * TILE + TILE / 2 + (hash2(it.a, it.b, 61) - 0.5) * 12 - s.width / 2 + 3), Math.round(it.b * TILE + TILE - 6 + (hash2(it.a, it.b, 62) - 0.5) * 8 - 2)); } }
    }
    for (const it of items) {
      switch (it.k) {
        case 1: {
          const tx = it.a, ty = it.b, i = ty * world.w + tx;
          const spr = mountainSprite(Math.floor(hash2(tx, ty, 63) * 6), world.height[i], world.terrain[i] === T.PEAK || world.temp[i] < 90);
          ctx.drawImage(spr, Math.round(tx * TILE + TILE / 2 + (hash2(tx, ty, 61) - 0.5) * 6 - MCX), Math.round(ty * TILE + TILE - 2 - MBASE));
          break;
        }
        case 0: {
          const tx = it.a, ty = it.b, i = ty * world.w + tx, o = world.obj[i];
          const spr = plantSprite(o, Math.floor(hash2(tx, ty, 64) * 4), world.objAge[i], season, t, hash2(tx, ty, 65));
          ctx.drawImage(spr, Math.round(tx * TILE + TILE / 2 + (hash2(tx, ty, 61) - 0.5) * 12 - PCX), Math.round(ty * TILE + TILE - 6 + (hash2(tx, ty, 62) - 0.5) * 8 - PBASE));
          break;
        }
        case 2: this.drawBuilding(it.o as Building); break;
        case 3: this.drawUnit(it.o as Unit, it.a, it.b, L); break;
      }
    }
  }

  private drawUnit(u: Unit, ix: number, iy: number, detail: number): void {
    const { ctx, sim } = this, world = sim.world;
    const terr = world.terrain[Math.floor(iy) * world.w + Math.floor(ix)];
    const f = frameFor(u, this.time, terr === T.SHALLOW);
    const px = Math.round(ix * TILE), py = Math.round(iy * TILE);
    const bob = u.def.fly && u.species === 'bird' ? Math.sin(this.time * 6 + u.id) * 1.5 : u.species === 'dragon' && f.lift ? Math.sin(this.time * 3) * 2 : 0;
    const dx = px + f.dx, dy = py + f.dy - f.lift - bob;
    if (f.clip) {
      ctx.drawImage(f.img, 0, 0, f.w, f.h - f.clip, dx, dy, f.w, f.h - f.clip);
      ctx.fillStyle = 'rgba(140,200,235,0.35)'; ctx.fillRect(px - 7, py - 2, 14, 2);
      ctx.fillStyle = 'rgba(235,248,255,0.55)'; ctx.fillRect(px - 5, py - 1, 10, 1);
    } else ctx.drawImage(f.img, dx, dy);
    if (u.hurtT > 0) { ctx.globalAlpha = Math.min(0.7, u.hurtT * 4); ctx.drawImage(flashOf(f.img), dx, dy); ctx.globalAlpha = 1; }
    if (u.burning > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,120,30,0.35)'; ctx.fillRect(px - 6, py - 22, 12, 22); ctx.globalCompositeOperation = 'source-over'; }
    // small kingdom pip over soldiers' heads and a health bar for the wounded
    if (detail && u.state !== 'dead') {
      if (u.hp < u.maxHp * 0.98 && (u.def.civ || u.def.dmg > 0 || this.cam.zoom >= 2)) {
        const w = u.species === 'dragon' ? 40 : 14, y = py - f.h + (u.def.civ ? 12 : 8) - f.lift - 2 + (u.species === 'dragon' ? -4 : 0) + f.h * 0;
        const hy = (u.def.civ ? py - 38 : py + f.dy - 4 - f.lift) + (u.species === 'dragon' ? 0 : 0);
        void y;
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(px - w / 2 - 1, hy - 1, w + 2, 4);
        ctx.fillStyle = u.hp > u.maxHp * 0.5 ? '#5ad25a' : u.hp > u.maxHp * 0.25 ? '#e0c030' : '#d83a3a'; ctx.fillRect(px - w / 2, hy, Math.max(1, (w * u.hp) / u.maxHp), 2);
      }
      if (u.kingdomId && (u.role === 'soldier' || u.role === 'archer' || u.role === 'knight' || u.role === 'king')) {
        const k = sim.kingdoms.get(u.kingdomId);
        if (k && (u.mode === 'march' || u.mode === 'siege' || u.role === 'king')) { ctx.fillStyle = k.color; ctx.fillRect(px - 2, py - 44, 4, 3); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px - 2, py - 41, 4, 1); if (u.role === 'king') { ctx.fillStyle = '#ffd84a'; ctx.fillRect(px - 2, py - 46, 4, 2); } }
      }
    }
    if (this.selected && this.selected.kind === 'unit' && this.selected.id === u.id) {
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.time * 6); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(px, py, 11, 5, 0, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  private drawBuilding(b: Building): void {
    const { ctx, sim } = this;
    const d = b.def, size = bSize(b.type);
    const stage = b.progress >= 1 ? 3 : b.progress < 0.34 ? 0 : b.progress < 0.67 ? 1 : 2;
    const dmg = b.hp < b.maxHp * 0.3 ? 2 : b.hp < b.maxHp * 0.65 ? 1 : 0;
    const spr = buildingSprite(b.type, b.race, stage, dmg);
    const x = b.x * TILE - 8, y = (b.y + d.h) * TILE - size.h + 8;
    ctx.drawImage(spr, x, y);
    if (b.hurtT > 0) { b.hurtT -= 0.016; ctx.globalAlpha = 0.5; ctx.drawImage(flashOf(spr), x, y); ctx.globalAlpha = 1; }
    const city = sim.cities.get(b.cityId), k = city ? sim.kingdoms.get(city.kingdomId) : null;
    const base = (b.y + d.h) * TILE; // footprint bottom edge
    const midX = b.x * TILE + (d.w * TILE) / 2;
    if (b.done) {
      if (k && (b.type === 'hall' || b.type === 'barracks' || b.type === 'tower' || b.type === 'temple')) this.flag(midX + (b.type === 'tower' ? 0 : d.w * 6), base - RIDGE[b.type] - 2, k.color);
      const ch = CHIMNEY[b.type];
      if (ch && city && city.stock.food > 0 && this.cam.zoom >= 1 && Math.random() < 0.025) this.fx.emit({ t: 'smoke', x: (b.x * TILE + d.w * TILE * ch[0]) / TILE, y: (base - ch[1]) / TILE + 0.3 });
      if (b.type === 'smith') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${120 + Math.floor(Math.sin(this.time * 9) * 30)},40,0.5)`; ctx.fillRect(b.x * TILE + 18, base - 24, 14, 12); ctx.globalCompositeOperation = 'source-over'; if (Math.random() < 0.05) this.fx.emit({ t: 'spark', x: (b.x * TILE + 26) / TILE, y: (base - 14) / TILE }); }
      if (b.type === 'windmill') this.windmill(b.x * TILE + d.w * 16, base - 6 - 42);
      if (b.type === 'campfire') this.flame(b.x * TILE + 16, base - 8);
    }
    if (b.burning > 0 && Math.random() < 0.4) this.fx.emit({ t: 'fire', x: b.x + Math.random() * d.w, y: b.y + d.h * (0.4 + Math.random() * 0.6) });
    if (this.selected && this.selected.kind === 'building' && this.selected.id === b.id) { ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(this.time * 6); ctx.setLineDash([4, 3]); ctx.strokeRect(b.x * TILE - 2, b.y * TILE - 2, d.w * TILE + 4, d.h * TILE + 4); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    if (b.hp < b.maxHp * 0.98 && b.done && this.cam.zoom >= 2) { const w = d.w * TILE * 0.6; ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(midX - w / 2 - 1, base + 3, w + 2, 4); ctx.fillStyle = '#d8a030'; ctx.fillRect(midX - w / 2, base + 4, w * (b.hp / b.maxHp), 2); }
    if (!b.done && this.cam.zoom >= 2) { const w = d.w * TILE * 0.6; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(midX - w / 2 - 1, base + 3, w + 2, 4); ctx.fillStyle = '#e8d070'; ctx.fillRect(midX - w / 2, base + 4, w * b.progress, 2); }
  }

  private flag(x: number, y: number, color: string): void {
    const { ctx } = this, t = this.time;
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(Math.round(x), Math.round(y), 2, 22);
    ctx.fillStyle = '#e8c24a'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 4, 3);
    for (let i = 0; i < 12; i++) {
      const wave = Math.sin(t * 5 + i * 0.7) * (1 + i * 0.12);
      ctx.fillStyle = color; ctx.fillRect(Math.round(x) + 2 + i, Math.round(y + 1 + wave), 1, 8 - (i > 9 ? 2 : 0));
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(x) + 2 + i, Math.round(y + 8 + wave), 1, 1);
      if (i < 3) { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(Math.round(x) + 2 + i, Math.round(y + 1 + wave), 1, 2); }
    }
  }

  private flame(x: number, y: number): void {
    const { ctx } = this, t = this.time;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const fl = Math.sin(t * 11 + i * 1.7) * 2, h = 9 + Math.sin(t * 8 + i * 2.1) * 3 - Math.abs(i - 1.5) * 2;
      ctx.fillStyle = '#d8501a'; ctx.fillRect(Math.round(x - 5 + i * 3 + fl * 0.4), Math.round(y - h), 3, Math.round(h));
      ctx.fillStyle = '#ffb02a'; ctx.fillRect(Math.round(x - 4 + i * 3 + fl * 0.3), Math.round(y - h * 0.7), 2, Math.round(h * 0.7));
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(Math.round(x - 4 + i * 3), Math.round(y - h * 0.35), 1, Math.round(h * 0.3));
    }
    ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < 0.05) this.fx.emit({ t: 'smoke', x: x / TILE, y: (y - 8) / TILE });
  }

  private windmill(cx: number, cy: number): void {
    const { ctx } = this, a = this.time * 0.9;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-1, 0, 2, 30);
      ctx.fillStyle = '#e8e0cc'; ctx.fillRect(1, 6, 8, 22); ctx.fillStyle = '#c8bea4'; ctx.fillRect(1, 6, 8, 2);
    }
    ctx.restore(); ctx.fillStyle = '#4a3220'; ctx.fillRect(cx - 3, cy - 3, 6, 6);
  }

  /** Tornado funnels, falling meteors and acid clouds: the disasters that are bodies, not just particles. */
  private drawDisasters(): void {
    const { ctx, sim } = this, t = this.time;
    for (const d of sim.disasters) {
      const px = d.x * TILE, py = d.y * TILE;
      if (d.type === 'tornado') {
        ctx.fillStyle = 'rgba(10,12,24,0.3)'; ctx.beginPath(); ctx.ellipse(px, py + 2, 22, 7, 0, 0, 6.283); ctx.fill();
        for (let k = 0; k < 20; k++) {
          const y = py - k * 6, half = 5 + k * 1.9, off = Math.sin(t * 7 + k * 0.55) * (2 + k * 0.4);
          const shade = k % 3 === 0 ? '#6a6a76' : k % 3 === 1 ? '#8a8a96' : '#a8a8b4';
          ctx.fillStyle = shade; ctx.fillRect(Math.round(px + off - half), Math.round(y), Math.round(half * 2), 6);
          ctx.fillStyle = 'rgba(40,40,52,0.55)'; const sx = ((t * 40 + k * 17) % (half * 2));
          ctx.fillRect(Math.round(px + off - half + sx), Math.round(y + 1), 6, 2); ctx.fillRect(Math.round(px + off - half + ((sx + half) % (half * 2))), Math.round(y + 3), 4, 2);
        }
        ctx.fillStyle = '#4a4a58'; ctx.fillRect(Math.round(px - 48), Math.round(py - 122), 96, 8); ctx.fillStyle = '#5a5a68'; ctx.fillRect(Math.round(px - 38), Math.round(py - 130), 76, 8);
        if (Math.random() < 0.5) this.fx.emit({ t: Math.random() < 0.5 ? 'leaf' : 'dust', x: d.x + (Math.random() - 0.5) * 2.5, y: d.y - Math.random() * 2, a: 0.5 });
      } else if (d.type === 'meteor') {
        const p = d.t / d.life, ox = 7 * TILE * (1 - p), oy = -15 * TILE * (1 - p), mx = px + ox, my = py + oy;
        this.fx.emit({ t: 'fire', x: mx / TILE, y: my / TILE + 0.5 }); this.fx.emit({ t: 'smoke', x: mx / TILE, y: my / TILE });
        ctx.fillStyle = 'rgba(10,12,24,0.35)'; ctx.beginPath(); ctx.ellipse(px, py + 2, 8 + p * 22, 3 + p * 8, 0, 0, 6.283); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(mx, my, 1, mx, my, 26); g.addColorStop(0, 'rgba(255,230,160,0.95)'); g.addColorStop(0.4, 'rgba(255,120,30,0.55)'); g.addColorStop(1, 'rgba(255,60,10,0)'); ctx.fillStyle = g; ctx.fillRect(mx - 26, my - 26, 52, 52); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.arc(mx, my, 7, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ff8a2a'; ctx.fillRect(mx - 3, my - 3, 4, 4);
      } else if (d.type === 'acid') {
        const r = d.r * TILE;
        ctx.fillStyle = 'rgba(80,140,40,0.22)'; ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.6, 0, 0, 6.283); ctx.fill();
        for (let k = 0; k < 7; k++) { const cx = px + Math.sin(k * 2.1 + t * 0.4) * r * 0.6, cy = py - 70 + Math.cos(k * 1.7) * 14; ctx.fillStyle = k % 2 ? 'rgba(70,96,50,0.8)' : 'rgba(96,126,60,0.8)'; ctx.beginPath(); ctx.ellipse(cx, cy, 34, 16, 0, 0, 6.283); ctx.fill(); }
        ctx.strokeStyle = 'rgba(150,240,70,0.65)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let k = 0; k < 26; k++) { const x = px + (((k * 53 + t * 40) % 100) / 100 - 0.5) * r * 1.8, y0 = py - 56 + ((t * 120 + k * 29) % 70); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + 7); }
        ctx.stroke();
      }
    }
  }

  private drawArrows(alpha: number): void {
    const { ctx, sim } = this;
    for (const a of sim.arrows) {
      const p = Math.min(1, (a.t + alpha * 0.05) / a.dur), x = (a.x + (a.tx - a.x) * p) * TILE, y = (a.y + (a.ty - a.y) * p) * TILE;
      const lobbed = a.z === 1, maxArc = lobbed ? 70 : 26, arcK = lobbed ? 7 : 3.2;
      const arc = Math.sin(p * Math.PI) * Math.min(maxArc, Math.hypot(a.tx - a.x, a.ty - a.y) * arcK);
      const px = (a.x + (a.tx - a.x) * (p - 0.03)) * TILE, py = (a.y + (a.ty - a.y) * (p - 0.03)) * TILE - Math.sin(Math.max(0, p - 0.03) * Math.PI) * Math.min(maxArc, Math.hypot(a.tx - a.x, a.ty - a.y) * arcK);
      if (lobbed) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(x) - 3, Math.round(y), 6, 2); ctx.fillStyle = '#6a6870'; ctx.fillRect(Math.round(x) - 3, Math.round(y - arc) - 3, 6, 6); ctx.fillStyle = '#9a98a0'; ctx.fillRect(Math.round(x) - 3, Math.round(y - arc) - 3, 3, 3); continue; }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
      ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y - arc); ctx.stroke();
      ctx.fillStyle = '#c8d0dc'; ctx.fillRect(Math.round(x), Math.round(y - arc), 1, 1);
    }
  }

  private drawLighting(left: number, top: number, vw: number, vh: number): void {
    const { ctx, sim } = this, { c, night } = ambient(sim);
    if (c[0] < 254 || c[1] < 254 || c[2] < 254) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; ctx.fillRect(0, 0, this.cam.vw, this.cam.vh);
      ctx.restore();
    }
    if (night > 0.12 || sim.weather === 'storm') {
      ctx.globalCompositeOperation = 'lighter';
      const a = Math.min(1, night * 1.1);
      const glow = (x: number, y: number, r: number, k: number): void => { ctx.globalAlpha = a * k; ctx.drawImage(this.lightCanvas, x - r, y - r, r * 2, r * 2); };
      for (const [, b] of sim.buildings) {
        if (!b.done || b.x * TILE < left - 80 || b.x * TILE > left + vw + 80 || b.y * TILE < top - 80 || b.y * TILE > top + vh + 80) continue;
        const d = b.def, cx = (b.x + d.w / 2) * TILE, base = (b.y + d.h) * TILE;
        if (b.type === 'campfire') glow(cx, base - 10, 64 + Math.sin(this.time * 9) * 3, 0.95);
        else if (b.type === 'smith') glow(cx - 6, base - 18, 48, 0.9);
        else if (b.type === 'hall' || b.type === 'temple') { glow(cx, base - 22, 70, 0.55); glow(cx, base + 4, 40, 0.5); }
        else if (b.type === 'tower') glow(cx, base - 40, 38, 0.6);
        else if (b.type !== 'farm' && b.type !== 'well' && b.type !== 'lumber') glow(cx, base - 18, 44, 0.55);
      }
      for (const u of sim.units) { if (u.burning > 0 || (u.look?.weapon === 'torch')) glow(u.x * TILE, u.y * TILE - 12, 26, 0.9); }
      for (const i of sim.world.activeFires) { const x = i % sim.world.w, y = (i / sim.world.w) | 0; if (x * TILE > left - 40 && x * TILE < left + vw + 40 && y * TILE > top - 40 && y * TILE < top + vh + 40) glow(x * TILE + 16, y * TILE + 12, 34, 0.7); }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawOverlays(left: number, top: number, vw: number, vh: number): void {
    const { ctx, sim } = this;
    if (this.hover) {
      const h = this.hover; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (h.shape === 'circle') ctx.ellipse((h.x + 0.5) * TILE, (h.y + 0.5) * TILE, (h.r + 0.5) * TILE, (h.r + 0.5) * TILE, 0, 0, 6.283);
      else ctx.rect((h.x - h.r) * TILE, (h.y - h.r) * TILE, (h.r * 2 + 1) * TILE, (h.r * 2 + 1) * TILE);
      ctx.fill(); ctx.stroke();
    }
    // names of realms/cities when zoomed out enough to read the map, as WorldBox does
    if (this.showNames && this.cam.zoom <= 2) {
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      for (const [, c] of sim.cities) {
        if (c.x * TILE < left - 100 || c.x * TILE > left + vw + 100 || c.y * TILE < top - 100 || c.y * TILE > top + vh + 100) continue;
        const k = sim.kingdoms.get(c.kingdomId);
        const label = c.id === k?.capital ? `★ ${c.name}` : c.name, x = c.x * TILE + 16, y = c.y * TILE - 70;
        ctx.fillStyle = 'rgba(8,10,20,0.6)'; const wd = ctx.measureText(label).width; ctx.fillRect(x - wd / 2 - 4, y - 10, wd + 8, 14);
        ctx.fillStyle = k?.color ?? '#fff'; ctx.fillRect(x - wd / 2 - 4, y - 10, 2, 14);
        ctx.fillStyle = '#fff'; ctx.fillText(label, x, y); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '8px sans-serif'; ctx.fillText(String(c.pop), x, y + 9); ctx.font = 'bold 10px sans-serif';
      }
      ctx.textAlign = 'start';
    }
    void TERRAIN;
  }
}

const MINOR = new Set<number>([O.BUSH, O.BERRIES, O.FLOWER_RED, O.FLOWER_YELLOW, O.FLOWER_BLUE, O.REED, O.ROCK, O.MUSHROOM, O.STUMP, O.GRASS_TUFT, O.BONES]);
const OBJ_SHADOW = new Set<number>([O.OAK, O.PINE, O.BIRCH, O.PALM, O.JUNGLE_TREE, O.ACACIA, O.SNOW_PINE, O.BOULDER, O.ORE_IRON, O.ORE_GOLD, O.ORE_COPPER, O.CACTUS]);
const frameSize = (u: Unit): number => (u.species === 'dragon' ? 20 : u.species === 'bear' || u.species === 'cow' ? 13 : u.def.civ ? 8 : u.species === 'bird' ? 4 : u.species === 'chicken' || u.species === 'rabbit' || u.species === 'crab' || u.species === 'snake' ? 5 : 9);

function makeGlow(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,200,110,0.95)'); grad.addColorStop(0.35, 'rgba(255,150,60,0.4)'); grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return c;
}
