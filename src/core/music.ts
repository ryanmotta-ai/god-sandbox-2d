import type { Sim } from '../sim/sim';
import type { Sound } from './sound';

type Mood = 'day' | 'night' | 'rain' | 'war';
interface Mode { root: number; scale: number[]; bar: number; notes: number; pad: OscillatorType }
const MODES: Record<Mood, Mode> = {
  day: { root: 220, scale: [0, 2, 4, 7, 9], bar: 8, notes: 3, pad: 'triangle' },
  night: { root: 146.83, scale: [0, 3, 5, 7, 10], bar: 11, notes: 1.5, pad: 'sine' },
  rain: { root: 174.61, scale: [0, 2, 3, 7, 9], bar: 10, notes: 1.2, pad: 'sine' },
  war: { root: 82.41, scale: [0, 1, 3, 5, 7, 8], bar: 6, notes: 2, pad: 'sawtooth' },
};
const hz = (m: Mode, deg: number): number => m.root * 2 ** ((m.scale[((deg % m.scale.length) + m.scale.length) % m.scale.length] + 12 * Math.floor(deg / m.scale.length)) / 12);

/**
 * Generative score: a slow pad on a random walk of scale degrees plus sparse plucks, re-keyed by the world's
 * mood (day, night, rain, war). Nothing is recorded; it is a few oscillators scheduled a bar at a time.
 */
export class Music {
  enabled = true;
  mood: Mood = 'day';
  private bus: GainNode | null = null;
  private next = 0;
  private deg = 0;
  private timer = 0;
  constructor(private sound: Sound) {}

  /** Call after `sound.unlock()`; idempotent. */
  start(): void {
    const c = this.sound.ctx;
    if (!c || this.bus || !this.sound.master) return;
    this.bus = c.createGain(); this.bus.gain.value = this.enabled ? 0.32 : 0; this.bus.connect(this.sound.master);
    const echo = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter();
    echo.delayTime.value = 0.42; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.bus.connect(echo); echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(this.sound.master);
    this.next = c.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 300);
  }
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.bus && this.sound.ctx) this.bus.gain.setTargetAtTime(on ? 0.32 : 0, this.sound.ctx.currentTime, 0.6);
  }
  update(sim: Sim): void {
    const p = sim.dayPhase;
    let war = false;
    for (const k of sim.kingdoms.values()) if (k.wars.size) { war = true; break; }
    this.mood = war ? 'war' : sim.weather === 'rain' || sim.weather === 'storm' ? 'rain' : p < 0.25 || p > 0.73 ? 'night' : 'day';
  }

  private schedule(): void {
    const c = this.sound.ctx;
    if (!c || !this.enabled || c.state !== 'running' || this.next > c.currentTime + 1) return;
    const m = MODES[this.mood], t = Math.max(this.next, c.currentTime + 0.05), L = m.bar;
    this.deg += [-2, -1, 0, 1, 2][Math.floor(Math.random() * 5)];
    this.deg = Math.max(-3, Math.min(5, this.deg));
    for (const off of [0, 2, 4]) this.voice(hz(m, this.deg + off - (this.mood === 'war' ? 5 : 0)), t, L * 1.15, 0.07, m.pad);
    const n = Math.floor(m.notes + Math.random() * 2);
    let d = this.deg + 5;
    for (let i = 0; i < n; i++) {
      d += [-2, -1, 0, 1, 2][Math.floor(Math.random() * 5)];
      if (this.mood !== 'war') this.voice(hz(m, d), t + 0.5 + Math.random() * (L - 1), 1.6, 0.09, 'triangle', 0.01);
    }
    if (this.mood === 'war') for (let b = 0; b < L * 2; b++) this.drum(t + b * 0.5, b % 4 === 0 ? 1 : 0.5);
    this.next = t + L;
  }
  /** One note: `attack` 0.01 is a pluck, the default is a swell. */
  private voice(f: number, t: number, dur: number, vol: number, type: OscillatorType, attack = dur * 0.35): void {
    const c = this.sound.ctx!, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = Math.min(2400, f * 4);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.bus!); o.start(t); o.stop(t + dur + 0.05);
  }
  private drum(t: number, v: number): void {
    const c = this.sound.ctx!, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(this.bus!); o.start(t); o.stop(t + 0.3);
  }
  stop(): void { window.clearInterval(this.timer); }
}
