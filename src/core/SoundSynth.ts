/**
 * Web Audio API Sound Synthesizer.
 * Creates retro/modern sound effects dynamically.
 */
export class SoundSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean = false;
  private volume: number = 0.6;
  /**
   * Voice limiting, per effect.
   *
   * Nothing capped concurrency. A battle with fifty soldiers fires dozens of
   * `playHit()` calls inside a single frame, every one of them building its own
   * oscillator and gain node at the same amplitude, and the summed output clips
   * hard — the loudest moment in the game was also the only one that distorted.
   * A handful of voices already reads as "a lot of fighting"; the fortieth
   * simultaneous copy of the same 80ms triangle adds nothing but clipping.
   */
  private lastPlayed: Map<string, number> = new Map();
  private voices: Map<string, number> = new Map();
  /**
   * The thunder noise bed, built once.
   *
   * `playThunder` allocated a fresh `AudioBuffer` of `sampleRate * 0.8` samples —
   * around 38,400 floats at 48kHz — and filled it with `Math.random()` in a tight
   * loop on the main thread, every single strike. On a stormy night with the
   * disaster frequency up, that is a visible hitch in the frame time for a sound
   * whose whole character is that it is noise: the same noise works every time.
   */
  private thunderBed: AudioBuffer | null = null;

  private init(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Mutes, including whatever is already sounding.
   *
   * This used to set a flag that only *new* effects consulted, so the master gain
   * stayed where it was and every voice already scheduled played out in full. A
   * long tail — thunder is 0.8s, an explosion longer — kept going after the player
   * had asked for silence, and `toggleMute` bypassed this method entirely.
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  /** Master volume, 0..1. Applied to every effect. */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  public getVolume(): number {
    return this.volume;
  }

  /** Output node every effect connects to, so the master volume always applies. */
  private out(): AudioNode {
    return this.master ?? this.ctx!.destination;
  }

  /**
   * Whether this effect may sound right now.
   *
   * Two limits, because they solve different problems. `minGap` collapses a burst
   * of identical hits into a rhythm a listener can actually parse; `maxVoices`
   * caps how many can overlap inside one gap window so a single frame full of
   * simultaneous events cannot sum into clipping.
   */
  private allow(kind: string, minGap: number, maxVoices: number): boolean {
    if (this.muted) return false;
    const now = this.ctx?.currentTime ?? 0;
    const last = this.lastPlayed.get(kind) ?? -Infinity;
    if (now - last > minGap) {
      this.lastPlayed.set(kind, now);
      this.voices.set(kind, 1);
      return true;
    }
    const active = this.voices.get(kind) ?? 0;
    if (active >= maxVoices) return false;
    this.voices.set(kind, active + 1);
    return true;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playClick(): void {
    if (!this.allow('click', 0.02, 2)) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.out());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playThunder(): void {
    if (!this.allow('thunder', 0.6, 1)) return;
    this.init();
    if (!this.ctx) return;

    // The noise bed, built on the first strike and reused by every one after.
    if (!this.thunderBed) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.8);
      this.thunderBed = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.thunderBed.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.thunderBed;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.out());

    noise.start();
  }

  public playExplosion(): void {
    if (!this.allow('explosion', 0.09, 2)) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.out());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  public playHit(): void {
    if (!this.allow('hit', 0.045, 3)) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.out());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playMagic(): void {
    if (!this.allow('magic', 0.07, 2)) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.out());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  public playCannon(): void {
    if (!this.allow('cannon', 0.08, 3)) return;
    this.init();
    if (!this.ctx) return;

    // Dual-stage cannon sound: punchy lowpass noise + resonant deep boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.out());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  public playWaterSplash(): void {
    if (!this.allow('splash', 0.06, 3)) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.out());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }
}

export const sound = new SoundSynth();
