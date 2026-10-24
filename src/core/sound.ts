import type { FxEvent } from '../sim/sim';

/**
 * Synthesised sound: every effect is a few oscillators and filtered noise, so there are no assets to ship.
 * Volume falls off with distance from the camera, and each kind is rate-limited so a battle is a texture, not a wall.
 */
export class Sound {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noise: AudioBuffer | null = null;
  enabled = true;
  volume = 0.5;
  private last = new Map<string, number>();
  private live = 0;

  /** Browsers only allow audio after a user gesture; call this from one. */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
    } catch { this.ctx = null; }
  }
  setVolume(v: number): void { this.volume = v; if (this.master) this.master.gain.value = this.enabled ? v : 0; }
  setEnabled(on: boolean): void { this.enabled = on; if (this.master) this.master.gain.value = on ? this.volume : 0; }

  private tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0): void {
    const c = this.ctx!, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master!); o.start(t); o.stop(t + dur + 0.02);
  }
  private burst(dur: number, vol: number, freq: number, kind: BiquadFilterType = 'bandpass', q = 1, delay = 0): void {
    const c = this.ctx!, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = kind; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master!); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /** `gain` already includes distance falloff. */
  fx(e: FxEvent, gain: number): void {
    if (!this.ctx || !this.enabled || gain < 0.03 || this.live > 14) return;
    const now = performance.now(), k = e.t;
    const gap: Partial<Record<string, number>> = { hit: 70, blood: 140, spark: 90, boom: 120, splash: 120, arrow: 90, dust: 160, heal: 200, curse: 200, lightning: 200, coin: 160, rubble: 180, fire: 260, smoke: 1e9, leaf: 400, heart: 500, flash: 1e9, meteor: 400, zzz: 1e9 };
    if (now - (this.last.get(k) ?? 0) < (gap[k] ?? 100)) return;
    this.last.set(k, now);
    this.live++; setTimeout(() => this.live--, 250);
    const v = Math.min(1, gain);
    switch (k) {
      case 'hit': this.burst(0.06, 0.5 * v, 1800, 'bandpass', 1.2); this.tone(220, 90, 0.08, 0.35 * v, 'triangle'); break;
      case 'blood': this.tone(130, 60, 0.12, 0.3 * v, 'sine'); break;
      case 'spark': this.tone(2600, 3400, 0.05, 0.12 * v, 'square'); this.tone(1800, 2200, 0.06, 0.1 * v, 'square', 0.02); break;
      case 'arrow': this.burst(0.14, 0.25 * v, 3200, 'highpass', 0.7); this.tone(520, 180, 0.12, 0.12 * v, 'triangle'); break;
      case 'boom': this.burst(1.0, 0.9 * v, 420, 'lowpass', 0.7); this.tone(70, 28, 0.9, 0.7 * v, 'sine'); this.burst(0.25, 0.6 * v, 2200, 'bandpass', 0.8); break;
      case 'lightning': this.burst(1.5, 0.8 * v, 260, 'lowpass', 0.6); this.burst(0.08, 0.9 * v, 4000, 'highpass', 0.5); this.tone(55, 30, 1.2, 0.5 * v, 'sine', 0.05); break;
      case 'splash': this.burst(0.28, 0.35 * v, 900, 'bandpass', 0.8); break;
      case 'dust': this.tone(95, 55, 0.12, 0.35 * v, 'sine'); this.burst(0.1, 0.25 * v, 500, 'lowpass', 0.8); break;
      case 'rubble': this.burst(0.5, 0.5 * v, 700, 'lowpass', 0.8); this.tone(80, 40, 0.4, 0.4 * v, 'sine'); break;
      case 'heal': [660, 880, 1100].forEach((f, i) => this.tone(f, f * 1.01, 0.22, 0.14 * v, 'sine', i * 0.06)); break;
      case 'curse': this.tone(210, 90, 0.4, 0.2 * v, 'sawtooth'); break;
      case 'coin': this.tone(1400, 1500, 0.1, 0.09 * v, 'square'); this.tone(2100, 2200, 0.14, 0.08 * v, 'square', 0.07); break;
      case 'fire': this.burst(0.05, 0.18 * v, 1500 + Math.random() * 1500, 'bandpass', 2); break;
      case 'meteor': this.burst(0.6, 0.4 * v, 300, 'lowpass', 0.7); break;
      default: break;
    }
  }
}
