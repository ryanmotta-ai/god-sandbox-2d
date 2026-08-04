export class Camera {
  public x: number = 64 * 16; // Center of 128x128 map @ 16px tile size
  public y: number = 64 * 16;
  public zoom: number = 1.0;
  public targetZoom: number = 1.0;
  public minZoom: number = 0.3;
  public maxZoom: number = 3.5;
  public tileSize: number = 16;

  // Smooth Velocity & Inertia
  public vx: number = 0;
  public vy: number = 0;
  public moveSpeed: number = 1200; // Base speed in screen pixels per second
  public friction: number = 0.88;  // Smooth decay factor per frame

  public targetEntityId: string | null = null;
  public shakeTime: number = 0;
  public shakeIntensity: number = 0;
  /** Shake offset computed once per frame (in Camera.update) and reused by every worldToScreen call. */
  public frameShakeX: number = 0;
  public frameShakeY: number = 0;
  /** Toggled from the Settings screen. */
  public shakeEnabled: boolean = true;

  // Map dimensions for soft clamping
  public worldWidthTiles: number = 128;
  public worldHeightTiles: number = 128;

  public setWorldBounds(widthTiles: number, heightTiles: number): void {
    this.worldWidthTiles = widthTiles;
    this.worldHeightTiles = heightTiles;
  }

  public triggerShake(intensity: number = 8, duration: number = 0.3): void {
    if (!this.shakeEnabled) return;
    this.shakeIntensity = intensity;
    this.shakeTime = duration;
  }

  /** Center on a tile coordinate, optionally setting the zoom level. */
  public centerOn(tileX: number, tileY: number, zoom?: number): void {
    this.x = tileX * this.tileSize;
    this.y = tileY * this.tileSize;
    this.vx = 0;
    this.vy = 0;
    if (zoom !== undefined) {
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
      this.targetZoom = this.zoom;
    }
  }

  /** Add directional movement input (dx, dy in range [-1, 1]) */
  public addInputDirection(dirX: number, dirY: number, dt: number): void {
    if (dirX === 0 && dirY === 0) return;
    this.targetEntityId = null; // Break entity tracking on manual input

    // Normalize diagonal movement speed
    const len = Math.hypot(dirX, dirY);
    const nx = dirX / len;
    const ny = dirY / len;

    // Apply acceleration
    const accel = this.moveSpeed * dt;
    this.vx += nx * accel;
    this.vy += ny * accel;
  }

  public update(dt: number): void {
    // 1. Update Screen Shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeIntensity = 0;
      this.frameShakeX = (Math.random() - 0.5) * this.shakeIntensity;
      this.frameShakeY = (Math.random() - 0.5) * this.shakeIntensity;
    } else {
      this.frameShakeX = 0;
      this.frameShakeY = 0;
    }

    // 2. Smooth Lerp Zoom
    if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 14);
    } else {
      this.zoom = this.targetZoom;
    }

    // 3. Apply Velocity to Position (scaled by zoom so movement feels natural at all zoom levels)
    if (Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01) {
      this.x += (this.vx * dt) / this.zoom;
      this.y += (this.vy * dt) / this.zoom;

      // Apply Friction / Damping
      const damping = Math.pow(this.friction, dt * 60);
      this.vx *= damping;
      this.vy *= damping;
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    // 4. Soft Map Boundary Clamping
    const minWorldX = 0;
    const maxWorldX = this.worldWidthTiles * this.tileSize;
    const minWorldY = 0;
    const maxWorldY = this.worldHeightTiles * this.tileSize;

    this.x = Math.max(minWorldX - 100, Math.min(maxWorldX + 100, this.x));
    this.y = Math.max(minWorldY - 100, Math.min(maxWorldY + 100, this.y));
  }

  public worldToScreen(worldX: number, worldY: number, screenWidth: number, screenHeight: number): { x: number; y: number } {
    const sx = (worldX * this.tileSize - this.x) * this.zoom + screenWidth / 2 + this.frameShakeX;
    const sy = (worldY * this.tileSize - this.y) * this.zoom + screenHeight / 2 + this.frameShakeY;
    return { x: sx, y: sy };
  }

  public screenToWorld(screenX: number, screenY: number, screenWidth: number, screenHeight: number): { x: number; y: number } {
    const wx = ((screenX - screenWidth / 2) / this.zoom + this.x) / this.tileSize;
    const wy = ((screenY - screenHeight / 2) / this.zoom + this.y) / this.tileSize;
    return { x: wx, y: wy };
  }

  public zoomAt(deltaZoom: number, screenX: number, screenY: number, screenWidth: number, screenHeight: number): void {
    const newTargetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom + deltaZoom));
    if (newTargetZoom === this.targetZoom) return;

    const oldZoom = this.zoom;
    this.targetZoom = newTargetZoom;
    this.zoom = newTargetZoom; // Update anchor immediately for cursor stability

    // Zoom centered on cursor
    const wx = ((screenX - screenWidth / 2) / oldZoom + this.x);
    const wy = ((screenY - screenHeight / 2) / oldZoom + this.y);

    this.x = wx - (screenX - screenWidth / 2) / this.zoom;
    this.y = wy - (screenY - screenHeight / 2) / this.zoom;
  }

  public pan(dx: number, dy: number): void {
    this.targetEntityId = null; // Break tracking on manual pan
    this.vx += (dx * 15) / this.zoom;
    this.vy += (dy * 15) / this.zoom;
  }
}

