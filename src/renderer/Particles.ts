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
  type: 'arrow' | 'bullet' | 'cannonball' | 'sling_stone' | 'spear_thrust' | 'magic_bolt' | 'torpedo' | 'depth_charge' | 'fire_arrow' | 'carrier_plane' | 'naval_shell';
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
  private projectilePool: ObjectPool<Projectile>;
  public activeParticles: Particle[] = [];
  public activeProjectiles: Projectile[] = [];
  private relevanceCenter: { x: number; y: number; radius: number } | null = null;

  constructor() {
    this.pool = new ObjectPool<Particle>(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, color: '#fff', size: 2, alpha: 1, life: 0, maxLife: 1 }),
      (p) => { p.text = undefined; p.alpha = 1; },
      300
    );
    this.projectilePool = new ObjectPool<Projectile>(
      () => ({
        x: 0,
        y: 0,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        speed: 10,
        progress: 0,
        type: 'arrow',
        color: '#fff',
        damage: 0
      }),
      (proj) => {
        proj.targetEntity = undefined;
        proj.onImpact = undefined;
        proj.arcHeight = undefined;
        proj.progress = 0;
      },
      200
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
      const old = this.activeParticles[0];
      const last = this.activeParticles.pop()!;
      if (this.activeParticles.length > 0) this.activeParticles[0] = last;
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

  /**
   * Towering vertical water geyser for heavy naval impacts, near-misses, and torpedo detonations.
   */
  public spawnWaterGeyser(x: number, y: number, count: number = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const speed = 1.2 + Math.random() * 2.6;
      const color = Math.random() > 0.3 ? '#ffffff' : '#bae6fd';
      this.spawnParticle(
        x + (Math.random() - 0.5) * 0.4,
        y + (Math.random() - 0.5) * 0.2,
        color,
        Math.cos(angle) * speed * 0.5,
        Math.sin(angle) * speed,
        0.45 + Math.random() * 0.45,
        2.5 + Math.random() * 3.5
      );
    }
    // Base foaming ring
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.spawnParticle(
        x,
        y,
        'rgba(224, 242, 254, 0.75)',
        Math.cos(angle) * 0.6,
        Math.sin(angle) * 0.3,
        0.5 + Math.random() * 0.3,
        3 + Math.random() * 2
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

  /**
   * Tight bubbling cavitation wake trail trailing directly behind a racing torpedo.
   */
  public spawnTorpedoWake(x: number, y: number, dirX: number, dirY: number): void {
    const jitterX = (Math.random() - 0.5) * 0.15;
    const jitterY = (Math.random() - 0.5) * 0.15;
    this.spawnParticle(
      x + jitterX,
      y + jitterY,
      'rgba(240, 253, 250, 0.85)',
      -dirX * 0.2 + (Math.random() - 0.5) * 0.1,
      -dirY * 0.2 + (Math.random() - 0.5) * 0.1,
      0.35 + Math.random() * 0.3,
      2 + Math.random() * 1.5
    );
  }

  /**
   * Expanding underwater shockwave ring for depth charges and torpedo concussions.
   */
  public spawnUnderwaterShockwave(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.spawnParticle(
        x,
        y,
        'rgba(56, 189, 248, 0.85)',
        Math.cos(angle) * 1.4,
        Math.sin(angle) * 0.7,
        0.35,
        2.5
      );
    }
  }

  /**
   * Muzzle flash and burst on firing guns / broadsides.
   */
  public spawnMuzzleFlash(x: number, y: number, dirX: number, dirY: number, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 0.8;
      const speed = 0.8 + Math.random() * 1.5;
      const color = Math.random() > 0.4 ? '#fbbf24' : '#f97316';
      this.spawnParticle(
        x,
        y,
        color,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.12 + Math.random() * 0.1,
        2.5 + Math.random() * 2
      );
    }
  }

  /**
   * Wooden splinter debris flying outward when a wooden ship is hit.
   */
  public spawnShipSplinters(x: number, y: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.8;
      const color = Math.random() > 0.5 ? '#92400e' : '#b45309';
      this.spawnParticle(
        x,
        y,
        color,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 0.4,
        0.4 + Math.random() * 0.3,
        1.5 + Math.random() * 2
      );
    }
  }

  /**
   * Floating wooden flotsam debris and crates bobbing on the water after a shipwreck.
   */
  public spawnFlotsam(x: number, y: number, count: number = 4): void {
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 1.5;
      const offsetY = (Math.random() - 0.5) * 1.5;
      const color = Math.random() > 0.5 ? '#78350f' : '#92400e';
      this.spawnParticle(
        x + offsetX,
        y + offsetY,
        color,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        2.5 + Math.random() * 2.0,
        3 + Math.random() * 2.5
      );
    }
  }

  /**
   * Iridescent dark oil slick floating on water from modern steel shipwrecks.
   */
  public spawnOilSlick(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const offsetX = (Math.random() - 0.5) * 1.8;
      const offsetY = (Math.random() - 0.5) * 1.0;
      const color = Math.random() > 0.5 ? 'rgba(30, 41, 59, 0.65)' : 'rgba(51, 65, 85, 0.55)';
      this.spawnParticle(
        x + offsetX,
        y + offsetY,
        color,
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03,
        3.0 + Math.random() * 2.5,
        5 + Math.random() * 4
      );
    }
  }

  public spawnWaterRipple(x: number, y: number): void {
    this.spawnParticle(x, y, '#a5f3fc', 0, 0, 0.4, 2);
  }

  public spawnDamageNumber(x: number, y: number, damage: number, style: 'normal' | 'critical' | 'heal' = 'normal'): void {
    const p = this.obtainParticle(x, y, true);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = -1;
    p.color = style === 'heal' ? '#10b981' : style === 'critical' ? '#ef4444' : '#fbbf24';
    p.size = style === 'critical' ? 14 : 12;
    p.alpha = 1;
    p.life = 0;
    p.maxLife = 0.8;
    p.text = style === 'heal' ? `+${damage}` : `-${damage}`;
    this.activeParticles.push(p);
  }

  public spawnHealNumber(x: number, y: number, amount: number): void {
    const p = this.obtainParticle(x, y, true);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = -1;
    p.color = '#22c55e';
    p.size = 12;
    p.alpha = 1;
    p.life = 0;
    p.maxLife = 0.8;
    p.text = `+${amount}`;
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
    const speed =
      type === 'bullet' ? 32 :
      type === 'naval_shell' ? 14 :
      type === 'cannonball' ? 10 :
      type === 'carrier_plane' ? 11 :
      type === 'torpedo' ? 8.5 :
      type === 'arrow' || type === 'fire_arrow' ? 15 :
      type === 'spear_thrust' ? 18 :
      type === 'depth_charge' ? 7.5 : 11;

    const arcHeight =
      type === 'cannonball' || type === 'naval_shell' ? 1.2 :
      type === 'depth_charge' ? 1.5 :
      type === 'arrow' || type === 'fire_arrow' ? 0.5 :
      type === 'carrier_plane' ? 0.8 :
      type === 'sling_stone' ? 0.3 : 0;

    const color =
      type === 'bullet' ? '#fde047' :
      type === 'cannonball' || type === 'naval_shell' ? '#1e293b' :
      type === 'magic_bolt' ? '#38bdf8' :
      type === 'torpedo' ? '#94a3b8' :
      type === 'depth_charge' ? '#334155' :
      type === 'fire_arrow' ? '#f97316' :
      type === 'carrier_plane' ? '#475569' : '#78350f';

    // Muzzle smoke flash for firearms
    if (type === 'bullet') {
      this.spawnParticle(startX, startY, 'rgba(251,191,36,0.9)', 0, 0, 0.2, 4);
      this.spawnParticle(startX, startY, 'rgba(226,232,240,0.6)', (Math.random() - 0.5) * 0.3, -0.4, 0.35, 3);
    } else if (type === 'cannonball' || type === 'naval_shell') {
      const dx = targetX - startX;
      const dy = targetY - startY;
      const len = Math.hypot(dx, dy) || 1;
      this.spawnMuzzleFlash(startX, startY, dx / len, dy / len, 6);
      this.spawnGunSmoke(startX, startY, dx / len, dy / len, 8);
    } else if (type === 'torpedo') {
      this.spawnWaterSplash(startX, startY, 4);
    }

    // Projectiles carry gameplay impacts. Resolve the oldest one before making
    // room instead of silently dropping damage when battles become dense.
    if (this.activeProjectiles.length >= ParticleManager.MAX_PROJECTILES) {
      this.triggerProjectileImpact(this.activeProjectiles[0], 0);
    }
    const proj = this.projectilePool.obtain();
    proj.x = startX;
    proj.y = startY;
    proj.startX = startX;
    proj.startY = startY;
    proj.targetX = targetX;
    proj.targetY = targetY;
    proj.speed = speed;
    proj.progress = 0;
    proj.type = type;
    proj.color = color;
    proj.damage = damage;
    proj.targetEntity = targetEntity;
    proj.arcHeight = arcHeight;
    proj.onImpact = onImpact;
    this.activeProjectiles.push(proj);
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
    if (proj.type === 'cannonball' || proj.type === 'naval_shell') {
      this.spawnExplosion(proj.targetX, proj.targetY, '#ef4444', 22);
      this.spawnShipSplinters(proj.targetX, proj.targetY, 7);
      this.spawnImpactSparks(proj.targetX, proj.targetY, 6);
    } else if (proj.type === 'torpedo') {
      this.spawnUnderwaterShockwave(proj.targetX, proj.targetY);
      this.spawnWaterGeyser(proj.targetX, proj.targetY, 14);
      this.spawnExplosion(proj.targetX, proj.targetY, '#f97316', 16);
    } else if (proj.type === 'depth_charge') {
      this.spawnUnderwaterShockwave(proj.targetX, proj.targetY);
      this.spawnWaterGeyser(proj.targetX, proj.targetY, 12);
      this.spawnExplosion(proj.targetX, proj.targetY, '#ef4444', 12);
    } else if (proj.type === 'carrier_plane') {
      this.spawnExplosion(proj.targetX, proj.targetY, '#f97316', 18);
      this.spawnWaterSplash(proj.targetX, proj.targetY, 8);
      this.spawnShipSplinters(proj.targetX, proj.targetY, 4);
    } else if (proj.type === 'fire_arrow') {
      this.spawnExplosion(proj.targetX, proj.targetY, '#f97316', 8);
      this.spawnImpactSparks(proj.targetX, proj.targetY, 4);
    } else if (proj.type === 'bullet') {
      this.spawnParticle(proj.targetX, proj.targetY, '#fde047', 0, -0.2, 0.2, 3);
    } else {
      this.spawnParticle(proj.targetX, proj.targetY, '#cbd5e1', 0, -0.2, 0.2, 2);
    }

    const last = this.activeProjectiles.pop()!;
    if (index < this.activeProjectiles.length) {
      this.activeProjectiles[index] = last;
    }
    this.projectilePool.release(proj);
  }

  public update(dt: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife) {
        const last = this.activeParticles.pop()!;
        if (i < this.activeParticles.length) {
          this.activeParticles[i] = last;
        }
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
        // Ground position: linear interpolation along the start→target line
        proj.x = proj.startX + (proj.targetX - proj.startX) * proj.progress;
        proj.y = proj.startY + (proj.targetY - proj.startY) * proj.progress;

        // Particle trail
        if (proj.type === 'bullet') {
          this.spawnParticle(proj.x, proj.y, 'rgba(253, 224, 71, 0.6)', 0, 0, 0.12, 2);
        } else if (proj.type === 'cannonball' || proj.type === 'naval_shell') {
          this.spawnParticle(proj.x, proj.y, 'rgba(71, 85, 105, 0.7)', (Math.random() - 0.5) * 0.1, -0.2, 0.3, 3);
        } else if (proj.type === 'torpedo') {
          this.spawnTorpedoWake(
            proj.x,
            proj.y,
            (proj.targetX - proj.startX) / (totalDist || 1),
            (proj.targetY - proj.startY) / (totalDist || 1)
          );
        } else if (proj.type === 'fire_arrow') {
          this.spawnParticle(proj.x, proj.y, 'rgba(249, 115, 22, 0.85)', 0, 0, 0.15, 2.5);
          if (Math.random() > 0.6) this.spawnParticle(proj.x, proj.y, '#fbbf24', (Math.random() - 0.5) * 0.2, 0.1, 0.15, 1.5);
        } else if (proj.type === 'carrier_plane') {
          if (Math.random() > 0.5) {
            this.spawnParticle(proj.x, proj.y, 'rgba(226, 232, 240, 0.45)', 0, -0.1, 0.2, 1.5);
          }
        }
      }
    }
  }

  /**
   * Spawn bright yellow-white sparks at a combat impact point.
   * High initial velocity + short lifetime = sharp, snappy hit feedback.
   */
  public spawnImpactSparks(x: number, y: number, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.0;
      const color = Math.random() > 0.4 ? '#fde047' : '#ffffff';
      this.spawnParticle(
        x,
        y,
        color,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.15 + Math.random() * 0.2,
        1.5 + Math.random() * 2
      );
    }
  }

  /**
   * Spawn drifting grey smoke particles in a given direction.
   * Used for gunpowder discharge — particles spread in the firing direction
   * with lateral jitter and slow upward drift for a natural dissipation feel.
   */
  public spawnGunSmoke(x: number, y: number, dirX: number, dirY: number, count: number = 8): void {
    for (let i = 0; i < count; i++) {
      // Interpolate between dark (#94a3b8) and light (#e2e8f0) grey
      const color = Math.random() > 0.5 ? '#94a3b8' : '#e2e8f0';
      // Base drift in the firing direction + lateral jitter + upward float
      const speed = 0.3 + Math.random() * 0.8;
      const jitter = (Math.random() - 0.5) * 0.6;
      this.spawnParticle(
        x,
        y,
        color,
        dirX * speed + jitter,
        dirY * speed - 0.3 - Math.random() * 0.3,
        0.4 + Math.random() * 0.5,
        2.5 + Math.random() * 2
      );
    }
  }
}
