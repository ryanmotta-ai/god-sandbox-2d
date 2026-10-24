import type { FxEvent } from '../sim/sim';
import { TILE } from '../core/config';

/**
 * Particles, in world pixels. The sim emits FxEvents (it knows nothing about drawing);
 * this turns each into a handful of pixels that fly, fall and fade.
 */
interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; kind: number; c: string; g: number; add: boolean }
const KIND = { px: 0, smoke: 1, fire: 2, ring: 3, bolt: 4, text: 5 };
const MAX = 2400;

export class Particles {
  list: P[] = [];
  /** Lightning bolts are polylines, kept apart. */
  bolts: { pts: [number, number][]; life: number; max: number }[] = [];
  flash = 0;
  shake = 0;

  private add(p: Partial<P> & { x: number; y: number }): void {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ z: 0, vx: 0, vy: 0, vz: 0, life: 1, max: 1, size: 1, kind: KIND.px, c: '#fff', g: 0, add: false, ...p });
  }
  private rnd(a: number, b: number): number { return a + Math.random() * (b - a); }

  emit(e: FxEvent): void {
    const x = e.x * TILE, y = e.y * TILE, r = this.rnd.bind(this);
    switch (e.t) {
      case 'blood': for (let i = 0; i < 6; i++) this.add({ x, y, z: 10, vx: r(-30, 30), vy: r(-20, 14), vz: r(30, 70), g: 260, life: r(0.35, 0.7), max: 0.7, size: Math.random() < 0.3 ? 2 : 1, c: Math.random() < 0.5 ? '#a01820' : '#c42a30' }); break;
      case 'hit': for (let i = 0; i < 4; i++) this.add({ x, y, z: 8, vx: r(-40, 40), vy: r(-30, 10), vz: r(20, 60), g: 200, life: r(0.15, 0.3), max: 0.3, c: Math.random() < 0.5 ? '#fff6c8' : '#ffd060', add: true }); break;
      case 'spark': for (let i = 0; i < 7; i++) this.add({ x, y, z: 6, vx: r(-50, 50), vy: r(-40, 20), vz: r(20, 80), g: 220, life: r(0.2, 0.5), max: 0.5, c: Math.random() < 0.5 ? '#ffe08a' : '#e8e8f0', add: true }); break;
      case 'smoke': this.add({ x: x + r(-3, 3), y, z: 10, vx: r(-4, 4), vy: 0, vz: r(14, 24), life: r(1.6, 2.6), max: 2.6, size: r(5, 8), kind: KIND.smoke, c: '#c8c4c0' }); break;
      case 'fire': this.add({ x: x + r(-5, 5), y: y + r(-3, 3), z: r(2, 8), vx: r(-3, 3), vz: r(18, 36), life: r(0.4, 0.8), max: 0.8, size: r(3, 6), kind: KIND.fire, c: '#ff8a2a', add: true }); if (Math.random() < 0.3) this.add({ x, y, z: 10, vz: r(20, 30), vx: r(-6, 6), life: r(1, 1.8), max: 1.8, size: r(3, 5), kind: KIND.smoke, c: '#6a6460' }); break;
      case 'dust': { const n = Math.round(3 + (e.a ?? 1) * 3); for (let i = 0; i < n; i++) this.add({ x: x + r(-14, 14) * (e.a ?? 1), y: y + r(-6, 6), z: 2, vx: r(-14, 14), vz: r(8, 20), life: r(0.5, 1), max: 1, size: r(3, 6), kind: KIND.smoke, c: '#b0966c' }); break; }
      case 'rubble': for (let i = 0; i < 14; i++) this.add({ x: x + r(-14, 14), y, z: 14, vx: r(-40, 40), vy: r(-10, 10), vz: r(40, 110), g: 280, life: r(0.6, 1.2), max: 1.2, size: 2, c: Math.random() < 0.5 ? '#7a746c' : '#5a3e28' }); break;
      case 'boom': this.flash = Math.max(this.flash, 0.5); this.shake = Math.max(this.shake, 6); for (let i = 0; i < 26; i++) this.add({ x, y, z: 8, vx: r(-70, 70), vy: r(-40, 20), vz: r(30, 120), g: 160, life: r(0.4, 1), max: 1, size: r(2, 4), kind: i % 3 ? KIND.fire : KIND.px, c: i % 2 ? '#ffb02a' : '#ff5a1a', add: true });
        for (let i = 0; i < 10; i++) this.add({ x, y, z: 12, vx: r(-20, 20), vz: r(20, 50), life: r(1, 2), max: 2, size: r(6, 10), kind: KIND.smoke, c: '#4a4642' }); break;
      case 'splash': for (let i = 0; i < 8; i++) this.add({ x, y, z: 4, vx: r(-26, 26), vy: r(-12, 12), vz: r(30, 70), g: 200, life: r(0.3, 0.6), max: 0.6, c: '#bfe6ff' }); this.add({ x, y, kind: KIND.ring, life: 0.6, max: 0.6, size: 3, c: '#e8f6ff' }); break;
      case 'heal': for (let i = 0; i < 8; i++) this.add({ x: x + r(-8, 8), y: y + r(-4, 4), z: r(0, 6), vz: r(20, 40), life: r(0.6, 1.1), max: 1.1, c: i % 2 ? '#7aff9a' : '#d8ffe0', add: true }); break;
      case 'curse': for (let i = 0; i < 8; i++) this.add({ x: x + r(-8, 8), y: y + r(-4, 4), z: r(0, 6), vz: r(16, 34), life: r(0.6, 1.1), max: 1.1, c: i % 2 ? '#b04aff' : '#e8a0ff', add: true }); break;
      case 'leaf': for (let i = 0; i < 5; i++) this.add({ x: x + r(-6, 6), y, z: r(18, 30), vx: r(-12, 12), vz: r(-10, 8), g: 30, life: r(0.8, 1.4), max: 1.4, size: 2, c: Math.random() < 0.5 ? '#4a9a38' : '#7ab84a' }); break;
      case 'coin': this.add({ x, y, z: 14, vz: 26, g: 60, life: 0.5, max: 0.5, size: 2, c: '#ffd84a', add: true }); break;
      case 'heart': this.add({ x, y, z: 10, vz: 22, life: 1.1, max: 1.1, kind: KIND.text, c: '♥' }); break;
      case 'note': this.add({ x: x + r(-4, 4), y, z: 16, vx: r(-6, 6), vz: r(16, 26), life: 1.5, max: 1.5, kind: KIND.text, c: Math.random() < 0.5 ? '♪' : '♫' }); break;
      case 'confetti': for (let i = 0; i < 10; i++) this.add({ x: x + r(-14, 14), y: y + r(-6, 6), z: r(34, 54), vx: r(-12, 12), vy: r(-6, 6), vz: r(-6, 4), g: 26, life: r(1.2, 2), max: 2, size: 2, c: ['#ff5a7a', '#ffd84a', '#5ad0ff', '#7aff9a', '#ff9a3a', '#c88aff'][i % 6] }); break;
      case 'zzz': this.add({ x, y, z: 14, vz: 14, life: 1.6, max: 1.6, kind: KIND.text, c: 'z' }); break;
      case 'flash': this.flash = Math.max(this.flash, e.a ?? 0.6); break;
      case 'lightning': {
        const pts: [number, number][] = []; let bx = x + r(-20, 20), by = y - 620;
        for (let i = 0; i < 12; i++) { pts.push([bx, by]); by += (y - (y - 620)) / 12; bx += r(-26, 26) + (x - bx) * 0.1; }
        pts.push([x, y]); this.bolts.push({ pts, life: 0.35, max: 0.35 }); this.flash = Math.max(this.flash, 0.8); this.shake = Math.max(this.shake, 8);
        for (let i = 0; i < 16; i++) this.add({ x, y, z: 6, vx: r(-60, 60), vy: r(-30, 20), vz: r(30, 110), g: 200, life: r(0.2, 0.6), max: 0.6, c: '#fff6a0', add: true }); break;
      }
      case 'meteor': this.shake = Math.max(this.shake, 10); break;
      case 'arrow': break;
    }
  }

  update(dt: number): void {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt;
      if (p.kind === KIND.px && p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.6; p.vy *= 0.6; }
      if (p.kind === KIND.smoke) p.size += dt * 3;
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1); }
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.shake = Math.max(0, this.shake - dt * 20);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const t = p.life / p.max, sx = Math.round(p.x), sy = Math.round(p.y - p.z);
      switch (p.kind) {
        case KIND.px:
          ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; ctx.globalAlpha = Math.min(1, t * 2.4); ctx.fillStyle = p.c; ctx.fillRect(sx, sy, p.size, p.size); break;
        case KIND.smoke: ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(0.55, t * 0.7); ctx.fillStyle = p.c; { const s = Math.round(p.size); ctx.fillRect(sx - (s >> 1), sy - (s >> 1), s, s); } break;
        case KIND.fire: { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, t * 1.6); const s = Math.max(1, Math.round(p.size * t)); ctx.fillStyle = t > 0.6 ? '#ffe28a' : t > 0.3 ? '#ff8a2a' : '#c4301a'; ctx.fillRect(sx - (s >> 1), sy - s, s, s); break; }
        case KIND.ring: ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = t * 0.7; ctx.strokeStyle = p.c; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, p.size + (1 - t) * 14, (p.size + (1 - t) * 14) * 0.5, 0, 0, 6.283); ctx.stroke(); break;
        case KIND.text: ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, t * 2); ctx.fillStyle = p.c === '♥' ? '#ff5a7a' : p.c === '♪' || p.c === '♫' ? '#ffe27a' : '#dde8ff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(p.c, sx, sy); break;
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const b of this.bolts) {
      const a = b.life / b.max;
      for (const [w, c] of [[5, '#8ab4ff'], [2, '#ffffff']] as [number, string][]) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (w > 3 ? 0.5 : 1); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
        b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
}
