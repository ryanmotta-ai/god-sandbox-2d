import { ObjectPool } from '../core/ObjectPool';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  text?: string;
}

export class ParticleManager {
  private pool: ObjectPool<Particle>;
  public activeParticles: Particle[] = [];

  constructor() {
    this.pool = new ObjectPool<Particle>(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, color: '#fff', size: 2, alpha: 1, life: 0, maxLife: 1 }),
      (p) => { p.text = undefined; p.alpha = 1; },
      300
    );
  }

  public spawnParticle(x: number, y: number, color: string, vx: number = 0, vy: number = 0, maxLife: number = 0.5, size: number = 3): void {
    if (this.activeParticles.length >= 250) {
      const old = this.activeParticles.shift();
      if (old) this.pool.release(old);
    }
    const p = this.pool.obtain();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.color = color;
    p.size = size;
    p.alpha = 1;
    p.life = 0;
    p.maxLife = maxLife;
    this.activeParticles.push(p);
  }

  public spawnExplosion(x: number, y: number, color: string = '#ef4444', count: number = 20): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.5;
      this.spawnParticle(
        x,
        y,
        color,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.3 + Math.random() * 0.5,
        2 + Math.random() * 3
      );
    }
  }

  public spawnDamageNumber(x: number, y: number, damage: number): void {
    const p = this.pool.obtain();
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 0.2;
    p.vy = -0.8;
    p.color = '#ef4444';
    p.size = 12;
    p.alpha = 1;
    p.life = 0;
    p.maxLife = 0.8;
    p.text = `-${damage}`;
    this.activeParticles.push(p);
  }

  public update(dt: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife) {
        this.activeParticles.splice(i, 1);
        this.pool.release(p);
      }
    }
  }
}
