import type { Sim } from '../sim/sim';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
type RGB = [number, number, number];
const mixc = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Colour the whole picture multiplies by, from the time of day and season. White = full daylight. */
export function ambient(sim: Sim): { c: RGB; night: number } {
  const p = sim.dayPhase; // 0 midnight … 0.5 noon
  const DAWN: RGB = [255, 205, 170], DAY: RGB = [255, 255, 255], DUSK: RGB = [255, 178, 140], NIGHT: RGB = [78, 92, 170];
  let c: RGB, night: number;
  if (p < 0.2) { c = NIGHT; night = 1; }
  else if (p < 0.3) { const t = (p - 0.2) / 0.1; c = t < 0.5 ? mixc(NIGHT, DAWN, t * 2) : mixc(DAWN, DAY, (t - 0.5) * 2); night = 1 - t; }
  else if (p < 0.68) { c = DAY; night = 0; }
  else if (p < 0.78) { const t = (p - 0.68) / 0.1; c = t < 0.5 ? mixc(DAY, DUSK, t * 2) : mixc(DUSK, NIGHT, (t - 0.5) * 2); night = t; }
  else { c = NIGHT; night = 1; }
  const s = sim.season;
  if (s === 3) c = mixc(c, [210, 226, 255], 0.35); else if (s === 2) c = mixc(c, [255, 224, 190], 0.18);
  if (sim.weather === 'rain' || sim.weather === 'storm') c = mixc(c, [150, 160, 180], sim.weather === 'storm' ? 0.45 : 0.28);
  if (sim.weather === 'fog') c = mixc(c, [190, 196, 205], 0.3);
  return { c, night };
}

interface Drop { x: number; y: number; v: number; l: number }
/** Screen-space rain / snow / fog. */
export class Weather {
  drops: Drop[] = [];
  draw(ctx: CanvasRenderingContext2D, sim: Sim, w: number, h: number, dt: number, zoom: number): void {
    const wt = sim.weather;
    if (wt === 'clear') { this.drops.length = 0; return; }
    const target = wt === 'storm' ? 420 : wt === 'rain' ? 240 : wt === 'snow' ? 190 : 0;
    while (this.drops.length < target) this.drops.push({ x: Math.random() * w, y: Math.random() * h, v: 0.7 + Math.random() * 0.6, l: 0.6 + Math.random() * 0.7 });
    if (this.drops.length > target) this.drops.length = target;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const s = Math.max(1, zoom);
    if (wt === 'rain' || wt === 'storm') {
      ctx.strokeStyle = 'rgba(190,210,255,0.5)'; ctx.lineWidth = Math.max(1, s * 0.6); ctx.beginPath();
      for (const d of this.drops) { d.y += d.v * 900 * dt * s * 0.6; d.x -= d.v * 160 * dt * s * 0.6; if (d.y > h) { d.y = -20; d.x = Math.random() * w + 80; } if (d.x < -20) d.x = w; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 3 * s * d.l, d.y - 12 * s * d.l); }
      ctx.stroke();
    } else if (wt === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const d of this.drops) { d.y += d.v * 70 * dt * s; d.x += Math.sin(d.y * 0.02 + d.l * 6) * 20 * dt * s; if (d.y > h) { d.y = -6; d.x = Math.random() * w; } const z = Math.max(1, Math.round(s * d.l * 1.3)); ctx.fillRect(Math.round(d.x), Math.round(d.y), z, z); }
    } else if (wt === 'fog') {
      ctx.fillStyle = 'rgba(210,216,224,0.22)'; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
