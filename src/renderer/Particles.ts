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

export interface Projectile {
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  progress: number;
  type: 'arrow' | 'bullet' | 'cannonball' | 'sling_stone' | 'spear_thrust' | 'magic_bolt';
  color: string;
  damage: number;
  targetEntity?: any;
  arcHeight?: number;
  onImpact?: (x: number, y: number, damage: number, targetEntity?: any) => void;
}

export class ParticleManager {
  private static readonly MAX_PARTICLES = 250;
  private static readonly MAX_PROJECTILES = 160;
  private pool: ObjectPool<Particle>;
  public activeParticles: Particle[] = [];
  public activeProjectiles: Projectile[] = [];
  private relevanceCenter: { x: number; y: number; radius: number } | null = null;

  constructor() {
    this.pool = new ObjectPool<Particle>(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, color: '#fff', size: 2, alpha: 1, life: 0, maxLife: 1 }),
      (p) => { p.text = undefined; p.alpha = 1; },
      300
    );
  }

  public setRelevanceCenter(x: number, y: number, radius: number = 100): void {
    this.relevanceCenter = { x, y, radius };
  }

  private obtainParticle(x: number, y: number, important: boolean): Particle | null {
    if (!important && this.relevanceCenter) {
      const dx = x - this.relevanceCenter.x;
      const dy = y - this.relevanceCenter.y;
      if (dx * dx + dy * dy > this.relevanceCenter.radius * this.relevanceCenter.radius) return null;
    }
    if (this.activeParticles.length >= ParticleManager.MAX_PARTICLES) {
      if (!important) return null;
      const old = this.activeParticles.shift();
      if (old) this.pool.release(old);
    }
    return this.pool.obtain();
  }

  public spawnParticle(x: number, y: number, color: string, vx: number = 0, vy: number = 0, maxLife: number = 0.5, size: number = 3): void {
    const p = this.obtainParticle(x, y, false);
    if (!p) return;
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

  public spawnWaterSplash(x: number, y: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 1.0;
      const color = Math.random() > 0.4 ? '#e0fbff' : '#5fd0e8';
      this.spawnParticle(
        x,
        y,
        color,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.25 + Math.random() * 0.35,
        1.5 + Math.random() * 2
      );
    }
  }

  public spawnWaterWake(x: number, y: number, vx: number = 0, vy: number = 0): void {
    const foamColor = Math.random() > 0.3 ? '#f0ffff' : '#b2ebf2';
    const side = (Math.random() - 0.5) * 0.4;
    this.spawnParticle(
      x,
      y,
      foamColor,
      -vx * 0.3 + Math.cos(side) * 0.15,
      -vy * 0.3 + Math.sin(side) * 0.15,
      0.4 + Math.random() * 0.4,
      2 + Math.random() * 2.5
    );
  }

  public spawnWaterRipple(x: number, y: number): void {
    this.spawnParticle(x, y, '#a5f3fc', 0, 0, 0.4, 2);
  }

  public spawnDamageNumber(x: number, y: number, damage: number): void {
    const p = this.obtainParticle(x, y, true);
    if (!p) return;
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

  public spawnProjectile(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    type: Projectile['type'],
    damage: number,
    targetEntity?: any,
    onImpact?: (x: number, y: number, damage: number, targetEntity?: any) => void
  ): void {
    const speed = type === 'bullet' ? 32 : type === 'cannonball' ? 10 : type === 'arrow' ? 15 : type === 'spear_thrust' ? 18 : 11;
    const arcHeight = type === 'cannonball' ? 1.2 : type === 'arrow' ? 0.5 : type === 'sling_stone' ? 0.3 : 0;
    const color = type === 'bullet' ? '#fde047' : type === 'cannonball' ? '#1e293b' : type === 'magic_bolt' ? '#38bdf8' : '#78350f';

    // Muzzle smoke flash for firearms
    if (type === 'bullet') {
      this.spawnParticle(startX, startY, 'rgba(251,191,36,0.9)', 0, 0, 0.2, 4);
      this.spawnParticle(startX, startY, 'rgba(226,232,240,0.6)', (Math.random()-0.5)*0.3, -0.4, 0.35, 3);
    }

    // Projectiles carry gameplay impacts. Resolve the oldest one before making
    // room instead of silently dropping damage when battles become dense.
    if (this.activeProjectiles.length >= ParticleManager.MAX_PROJECTILES) {
      this.triggerProjectileImpact(this.activeProjectiles[0], 0);
    }
    this.activeProjectiles.push({
      x: startX,
      y: startY,
      startX,
      startY,
      targetX,
      targetY,
      speed,
      progress: 0,
      type,
      color,
      damage,
      targetEntity,
      arcHeight,
      onImpact
    });
  }

  private triggerProjectileImpact(proj: Projectile, index: number): void {
    if (proj.onImpact) {
      proj.onImpact(proj.targetX, proj.targetY, proj.damage, proj.targetEntity);
    } else {
      this.spawnDamageNumber(proj.targetX, proj.targetY, proj.damage);
      if (proj.targetEntity && proj.targetEntity.hp !== undefined) {
        proj.targetEntity.hp -= proj.damage;
      }
    }

    // Impact visual effects
    if (proj.type === 'cannonball') {
      this.spawnExplosion(proj.targetX, proj.targetY, '#ef4444', 25);
    } else if (proj.type === 'bullet') {
      this.spawnParticle(proj.targetX, proj.targetY, '#fde047', 0, -0.2, 0.2, 3);
    } else {
      this.spawnParticle(proj.targetX, proj.targetY, '#cbd5e1', 0, -0.2, 0.2, 2);
    }

    this.activeProjectiles.splice(index, 1);
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

    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const proj = this.activeProjectiles[i];
      const totalDist = Math.hypot(proj.targetX - proj.startX, proj.targetY - proj.startY);
      if (totalDist < 0.01) {
        this.triggerProjectileImpact(proj, i);
        continue;
      }

      proj.progress += (proj.speed * dt) / totalDist;
      if (proj.progress >= 1.0) {
        proj.progress = 1.0;
        proj.x = proj.targetX;
        proj.y = proj.targetY;
        this.triggerProjectileImpact(proj, i);
      } else {
        proj.x = proj.startX + (proj.targetX - proj.startX) * proj.progress;
        proj.y = proj.startY + (proj.targetY - proj.startY) * proj.progress;

        // Particle trail
        if (proj.type === 'bullet') {
          this.spawnParticle(proj.x, proj.y, 'rgba(253, 224, 71, 0.6)', 0, 0, 0.12, 2);
        } else if (proj.type === 'cannonball') {
          this.spawnParticle(proj.x, proj.y, 'rgba(71, 85, 105, 0.7)', (Math.random() - 0.5) * 0.1, -0.2, 0.3, 3);
        }
      }
    }
  }
}
