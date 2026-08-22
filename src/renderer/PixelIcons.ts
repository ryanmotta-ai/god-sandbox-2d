/**
 * Pixel-Art Icon Generator for Aethoria 2D God Sandbox.
 * Renders 16x16 transparent pixel-art canvas textures to replace all raw Unicode emojis.
 */

export class PixelIcons {
  private static iconCache: Map<string, HTMLCanvasElement> = new Map();
  private static urlCache: Map<string, string> = new Map();

  /**
   * The same icon as a data URL, for use in the DOM.
   *
   * `getIcon` hands back the cached canvas itself, and a node can only live in
   * one place — appending it to a screen would tear it out of the cache and
   * blank it everywhere else it is drawn. A data URL can be used any number of
   * times, so DOM callers use this instead.
   */
  public static getIconUrl(id: string): string {
    const cached = this.urlCache.get(id);
    if (cached) return cached;
    const url = this.getIcon(id).toDataURL();
    this.urlCache.set(id, url);
    return url;
  }

  public static getIcon(id: string): HTMLCanvasElement {
    if (this.iconCache.has(id)) {
      return this.iconCache.get(id)!;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    this.drawIcon(ctx, id);

    this.iconCache.set(id, canvas);
    return canvas;
  }

  private static px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  private static rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  private static drawIcon(ctx: CanvasRenderingContext2D, id: string): void {
    ctx.clearRect(0, 0, 16, 16);

    switch (id) {
      // ===================== EMBLEMS & COMBAT =====================
      case 'swords':
      case '⚔':
      case '⚔️': {
        // Crossed Steel Swords
        this.rect(ctx, 3, 3, 10, 1, '#e2e8f0');
        this.rect(ctx, 4, 4, 8, 1, '#cbd5e1');
        this.rect(ctx, 3, 12, 10, 1, '#e2e8f0');
        this.rect(ctx, 4, 11, 8, 1, '#cbd5e1');
        this.px(ctx, 2, 2, '#94a3b8'); this.px(ctx, 13, 2, '#94a3b8');
        this.px(ctx, 2, 13, '#94a3b8'); this.px(ctx, 13, 13, '#94a3b8');
        this.rect(ctx, 7, 7, 2, 2, '#fbbf24'); // Hilt gem
        this.rect(ctx, 7, 1, 2, 3, '#78350f'); // Hilt 1
        this.rect(ctx, 7, 12, 2, 3, '#78350f'); // Hilt 2
        break;
      }
      case 'shield':
      case '🛡':
      case '🛡️': {
        // Iron Knight Shield
        this.rect(ctx, 4, 2, 8, 2, '#475569');
        this.rect(ctx, 3, 4, 10, 6, '#334155');
        this.rect(ctx, 4, 10, 8, 2, '#1e293b');
        this.rect(ctx, 5, 12, 6, 2, '#0f172a');
        this.rect(ctx, 7, 14, 2, 1, '#020617');
        this.rect(ctx, 7, 3, 2, 9, '#e2e8f0'); // Gold Cross
        this.rect(ctx, 4, 6, 8, 2, '#e2e8f0');
        this.rect(ctx, 7, 6, 2, 2, '#fbbf24');
        break;
      }
      case 'crown':
      case '👑': {
        // Gold Royal Crown
        this.rect(ctx, 3, 11, 10, 3, '#d97706');
        this.rect(ctx, 4, 12, 8, 1, '#fbbf24');
        this.rect(ctx, 3, 6, 2, 5, '#f59e0b');
        this.rect(ctx, 7, 4, 2, 7, '#fbbf24');
        this.rect(ctx, 11, 6, 2, 5, '#f59e0b');
        this.px(ctx, 4, 4, '#ef4444'); // Ruby
        this.px(ctx, 8, 2, '#3b82f6'); // Sapphire
        this.px(ctx, 12, 4, '#10b981'); // Emerald
        break;
      }
      case 'axe':
      case '🪓': {
        // Lumberjack Steel Axe
        this.rect(ctx, 2, 12, 3, 2, '#78350f');
        this.rect(ctx, 4, 10, 2, 3, '#78350f');
        this.rect(ctx, 6, 8, 2, 3, '#78350f');
        this.rect(ctx, 8, 6, 2, 3, '#78350f');
        this.rect(ctx, 10, 3, 2, 4, '#78350f');
        this.rect(ctx, 8, 2, 6, 4, '#94a3b8'); // Blade
        this.rect(ctx, 10, 1, 3, 2, '#e2e8f0');
        this.rect(ctx, 12, 3, 2, 3, '#cbd5e1');
        break;
      }
      case 'pickaxe':
      case '⛏️':
      case '⛏': {
        // Miner Pickaxe
        this.rect(ctx, 3, 12, 2, 2, '#78350f');
        this.rect(ctx, 5, 10, 2, 3, '#78350f');
        this.rect(ctx, 7, 8, 2, 3, '#78350f');
        this.rect(ctx, 9, 6, 2, 3, '#78350f');
        this.rect(ctx, 11, 4, 2, 3, '#78350f');
        this.rect(ctx, 6, 3, 8, 2, '#64748b'); // Pick head
        this.px(ctx, 4, 4, '#cbd5e1'); this.px(ctx, 13, 5, '#cbd5e1');
        break;
      }
      case 'bow':
      case '🏹': {
        // Elven Longbow
        this.rect(ctx, 4, 2, 2, 2, '#059669');
        this.rect(ctx, 3, 4, 2, 4, '#047857');
        this.rect(ctx, 3, 8, 2, 4, '#047857');
        this.rect(ctx, 4, 12, 2, 2, '#059669');
        this.rect(ctx, 12, 2, 1, 12, '#e2e8f0'); // Bowstring
        this.rect(ctx, 5, 7, 7, 2, '#fbbf24'); // Arrow
        this.rect(ctx, 11, 6, 3, 4, '#ef4444'); // Arrowhead
        break;
      }
      case 'farm':
      case '🌾': {
        // Wheat Stalk
        this.rect(ctx, 7, 8, 2, 7, '#059669');
        this.rect(ctx, 5, 3, 6, 2, '#f59e0b');
        this.rect(ctx, 4, 5, 8, 2, '#fbbf24');
        this.rect(ctx, 6, 7, 4, 2, '#f59e0b');
        this.px(ctx, 3, 3, '#fef08a'); this.px(ctx, 12, 3, '#fef08a');
        break;
      }

      // ===================== KINGDOM SYMBOLS =====================
      case 'lion':
      case '🦁': {
        this.rect(ctx, 4, 3, 8, 8, '#d97706'); // Mane
        this.rect(ctx, 6, 5, 4, 5, '#fbbf24'); // Face
        this.px(ctx, 7, 6, '#0f172a'); this.px(ctx, 9, 6, '#0f172a'); // Eyes
        this.rect(ctx, 7, 8, 2, 2, '#78350f'); // Nose
        this.rect(ctx, 5, 11, 6, 3, '#b45309');
        break;
      }
      case 'eagle':
      case '🦅': {
        this.rect(ctx, 6, 2, 4, 4, '#f8fafc'); // Head
        this.rect(ctx, 10, 4, 3, 2, '#fbbf24'); // Beak
        this.rect(ctx, 3, 6, 10, 6, '#78350f'); // Wings
        this.rect(ctx, 5, 12, 6, 3, '#451a03');
        this.px(ctx, 8, 3, '#0f172a');
        break;
      }
      case 'dragon':
      case '🐉': {
        this.rect(ctx, 5, 2, 6, 4, '#dc2626'); // Dragon Head
        this.rect(ctx, 3, 6, 10, 6, '#991b1b'); // Body
        this.px(ctx, 4, 1, '#f59e0b'); this.px(ctx, 11, 1, '#f59e0b'); // Horns
        this.px(ctx, 7, 3, '#fef08a'); // Eye
        this.rect(ctx, 4, 12, 8, 3, '#7f1d1d');
        break;
      }
      case 'fire':
      case '🔥': {
        this.rect(ctx, 5, 8, 6, 6, '#dc2626');
        this.rect(ctx, 6, 5, 4, 6, '#f59e0b');
        this.rect(ctx, 7, 3, 2, 5, '#fbbf24');
        this.rect(ctx, 7, 9, 2, 3, '#fef08a');
        break;
      }
      case 'lightning':
      case '⚡': {
        this.rect(ctx, 8, 1, 4, 4, '#fef08a');
        this.rect(ctx, 6, 4, 5, 4, '#fbbf24');
        this.rect(ctx, 4, 7, 5, 4, '#f59e0b');
        this.rect(ctx, 3, 10, 3, 5, '#d97706');
        break;
      }
      case 'moon':
      case '🌙': {
        this.rect(ctx, 6, 2, 6, 12, '#38bdf8');
        this.rect(ctx, 8, 4, 5, 8, '#0f172a');
        this.rect(ctx, 4, 5, 4, 6, '#7dd3fc');
        break;
      }
      case 'sun':
      case '☀':
      case '☀️': {
        this.rect(ctx, 5, 5, 6, 6, '#fbbf24');
        this.rect(ctx, 6, 6, 4, 4, '#fef08a');
        this.rect(ctx, 7, 1, 2, 3, '#f59e0b');
        this.rect(ctx, 7, 12, 2, 3, '#f59e0b');
        this.rect(ctx, 1, 7, 3, 2, '#f59e0b');
        this.rect(ctx, 12, 7, 3, 2, '#f59e0b');
        break;
      }
      case 'gem':
      case '💎': {
        this.rect(ctx, 4, 3, 8, 3, '#38bdf8');
        this.rect(ctx, 2, 6, 12, 3, '#0284c7');
        this.rect(ctx, 4, 9, 8, 3, '#0369a1');
        this.rect(ctx, 6, 12, 4, 2, '#075985');
        this.rect(ctx, 5, 4, 3, 2, '#e0f2fe');
        break;
      }
      case 'castle':
      case '🏰': {
        this.rect(ctx, 2, 6, 4, 8, '#64748b');
        this.rect(ctx, 10, 6, 4, 8, '#64748b');
        this.rect(ctx, 5, 8, 6, 6, '#475569');
        this.rect(ctx, 7, 10, 2, 4, '#0f172a'); // Gate
        this.rect(ctx, 2, 4, 1, 2, '#e2e8f0'); this.rect(ctx, 5, 4, 1, 2, '#e2e8f0');
        this.rect(ctx, 10, 4, 1, 2, '#e2e8f0'); this.rect(ctx, 13, 4, 1, 2, '#e2e8f0');
        break;
      }
      case 'leaf':
      case '🌿': {
        this.rect(ctx, 3, 11, 3, 3, '#047857');
        this.rect(ctx, 5, 8, 4, 4, '#059669');
        this.rect(ctx, 8, 5, 4, 4, '#10b981');
        this.rect(ctx, 11, 2, 3, 3, '#34d399');
        this.rect(ctx, 2, 13, 8, 1, '#064e3b');
        break;
      }

      // ===================== GOVERNMENTS =====================
      case 'feather':
      case '🪶': {
        this.rect(ctx, 10, 2, 4, 4, '#f8fafc');
        this.rect(ctx, 7, 5, 5, 4, '#e2e8f0');
        this.rect(ctx, 4, 8, 5, 4, '#cbd5e1');
        this.rect(ctx, 2, 11, 3, 3, '#78350f'); // Quill stem
        break;
      }
      case 'statue':
      case '🗿': {
        this.rect(ctx, 4, 2, 8, 4, '#64748b'); // Moai Head
        this.rect(ctx, 3, 6, 10, 6, '#475569');
        this.rect(ctx, 5, 12, 6, 3, '#334155');
        this.rect(ctx, 5, 5, 6, 2, '#0f172a'); // Eyes
        this.rect(ctx, 7, 7, 2, 4, '#1e293b'); // Nose
        break;
      }
      case 'book':
      case '📖': {
        this.rect(ctx, 2, 4, 12, 8, '#78350f'); // Cover
        this.rect(ctx, 3, 5, 10, 6, '#fef08a'); // Pages
        this.rect(ctx, 7, 5, 2, 6, '#dc2626'); // Bookmark
        break;
      }
      case 'temple':
      case '🏛️':
      case '🏛': {
        this.rect(ctx, 2, 3, 12, 2, '#e2e8f0'); // Pediment
        this.rect(ctx, 3, 5, 10, 1, '#cbd5e1');
        this.rect(ctx, 3, 6, 2, 6, '#f8fafc'); // Pillars
        this.rect(ctx, 7, 6, 2, 6, '#f8fafc');
        this.rect(ctx, 11, 6, 2, 6, '#f8fafc');
        this.rect(ctx, 2, 12, 12, 2, '#cbd5e1');
        break;
      }
      case 'chart':
      case '📈': {
        this.rect(ctx, 2, 12, 12, 2, '#475569');
        this.rect(ctx, 3, 9, 2, 3, '#3b82f6');
        this.rect(ctx, 6, 6, 2, 6, '#10b981');
        this.rect(ctx, 9, 3, 2, 9, '#f59e0b');
        this.rect(ctx, 12, 1, 2, 11, '#ef4444');
        break;
      }
      case 'hammer_sickle':
      case '☭': {
        this.rect(ctx, 3, 3, 10, 10, '#dc2626');
        this.rect(ctx, 4, 4, 8, 8, '#fbbf24');
        this.rect(ctx, 6, 6, 4, 4, '#dc2626');
        break;
      }
      case 'run':
      case '🏃': {
        this.rect(ctx, 7, 2, 3, 3, '#38bdf8'); // Head
        this.rect(ctx, 5, 5, 6, 4, '#0284c7'); // Torso
        this.rect(ctx, 3, 9, 4, 4, '#0369a1'); // Leg 1
        this.rect(ctx, 9, 8, 4, 4, '#0369a1'); // Leg 2
        break;
      }

      // ===================== MENU =====================
      case 'world':
      case '🌍': {
        // A world seen from orbit: ocean disc, land masses, a lit western edge.
        this.rect(ctx, 6, 1, 4, 1, '#1d4ed8');
        this.rect(ctx, 4, 2, 8, 1, '#1d4ed8');
        this.rect(ctx, 3, 3, 10, 1, '#2563eb');
        this.rect(ctx, 2, 4, 12, 2, '#2563eb');
        this.rect(ctx, 1, 6, 14, 4, '#2563eb');
        this.rect(ctx, 2, 10, 12, 2, '#1d4ed8');
        this.rect(ctx, 3, 12, 10, 1, '#1d4ed8');
        this.rect(ctx, 4, 13, 8, 1, '#1e3a8a');
        this.rect(ctx, 6, 14, 4, 1, '#1e3a8a');
        // Continents.
        this.rect(ctx, 4, 3, 3, 2, '#22c55e');
        this.rect(ctx, 3, 6, 4, 3, '#16a34a');
        this.rect(ctx, 5, 9, 2, 2, '#15803d');
        this.rect(ctx, 9, 4, 3, 3, '#22c55e');
        this.rect(ctx, 8, 9, 4, 3, '#16a34a');
        this.px(ctx, 12, 7, '#15803d');
        // Atmosphere highlight on the sunlit limb.
        this.rect(ctx, 2, 5, 2, 1, '#93c5fd');
        this.px(ctx, 1, 7, '#93c5fd');
        break;
      }
      case 'save':
      case '💾': {
        // A floppy disk: shutter on top, write-on label below.
        this.rect(ctx, 2, 2, 12, 12, '#334155');
        this.rect(ctx, 2, 2, 12, 1, '#64748b');
        this.rect(ctx, 2, 2, 1, 12, '#475569');
        this.rect(ctx, 5, 2, 6, 5, '#94a3b8');   // Metal shutter
        this.rect(ctx, 6, 3, 2, 3, '#1e293b');   // Shutter window
        this.rect(ctx, 10, 3, 1, 3, '#cbd5e1');
        this.rect(ctx, 4, 8, 8, 6, '#e2e8f0');   // Label
        this.rect(ctx, 5, 9, 6, 1, '#94a3b8');   // Written lines
        this.rect(ctx, 5, 11, 4, 1, '#94a3b8');
        this.px(ctx, 13, 2, '#0f172a');          // Clipped corner
        break;
      }
      case 'gear':
      case '⚙':
      case '⚙️': {
        // A cog. The teeth are kept clear of the body's corners so the silhouette
        // reads as a gear rather than an octagon.
        this.rect(ctx, 6, 0, 4, 3, '#64748b');   // Cardinal teeth
        this.rect(ctx, 6, 13, 4, 3, '#64748b');
        this.rect(ctx, 0, 6, 3, 4, '#64748b');
        this.rect(ctx, 13, 6, 3, 4, '#64748b');
        this.rect(ctx, 2, 2, 2, 2, '#64748b');   // Diagonal teeth
        this.rect(ctx, 12, 2, 2, 2, '#64748b');
        this.rect(ctx, 2, 12, 2, 2, '#64748b');
        this.rect(ctx, 12, 12, 2, 2, '#64748b');
        this.rect(ctx, 4, 3, 8, 10, '#94a3b8');  // Body
        this.rect(ctx, 3, 4, 10, 8, '#94a3b8');
        this.rect(ctx, 4, 4, 2, 2, '#e2e8f0');   // Lit edge
        this.rect(ctx, 6, 6, 4, 4, '#1e293b');   // Hub
        break;
      }

      // ===================== CIVIC & PEOPLE =====================
      case 'person':
      case '👤': {
        // A citizen, drawn as a bust: hooded head over shoulders.
        this.rect(ctx, 5, 1, 6, 2, '#4a3728');   // Hood
        this.rect(ctx, 5, 3, 1, 3, '#4a3728');
        this.rect(ctx, 10, 3, 1, 3, '#4a3728');
        this.rect(ctx, 6, 3, 4, 4, '#c99a6e');   // Face
        this.px(ctx, 7, 4, '#2b1d12');           // Eyes
        this.px(ctx, 9, 4, '#2b1d12');
        this.rect(ctx, 6, 7, 4, 1, '#a87d55');   // Neck in shadow
        this.rect(ctx, 3, 8, 10, 7, '#7a6a52');  // Shoulders
        this.rect(ctx, 3, 8, 10, 1, '#94836a');  // Lit collar
        this.rect(ctx, 7, 9, 2, 6, '#5e5140');   // Cloak seam
        break;
      }
      case 'people':
      case '👥': {
        // Population: two citizens, the near one overlapping the far one.
        this.rect(ctx, 8, 2, 5, 2, '#3d2e22');   // Far figure, set back
        this.rect(ctx, 9, 4, 3, 3, '#a87d55');
        this.rect(ctx, 7, 7, 7, 8, '#5e5140');
        this.rect(ctx, 3, 3, 5, 2, '#4a3728');   // Near figure
        this.rect(ctx, 3, 5, 1, 2, '#4a3728');
        this.rect(ctx, 7, 5, 1, 2, '#4a3728');
        this.rect(ctx, 4, 5, 3, 3, '#c99a6e');
        this.px(ctx, 4, 6, '#2b1d12');
        this.px(ctx, 6, 6, '#2b1d12');
        this.rect(ctx, 1, 9, 8, 6, '#7a6a52');
        this.rect(ctx, 1, 9, 8, 1, '#94836a');
        break;
      }
      case 'city':
      case '🏙': {
        // A settlement seen in profile: towers behind a curtain wall.
        this.rect(ctx, 2, 6, 3, 5, '#6b5c48');   // Left tower
        this.rect(ctx, 2, 5, 3, 1, '#8a7860');
        this.rect(ctx, 6, 3, 4, 8, '#7a6a52');   // Keep
        this.rect(ctx, 6, 2, 4, 1, '#94836a');
        this.rect(ctx, 7, 0, 2, 2, '#c9a153');   // Banner on the keep
        this.rect(ctx, 11, 7, 3, 4, '#6b5c48');  // Right tower
        this.rect(ctx, 11, 6, 3, 1, '#8a7860');
        this.rect(ctx, 1, 11, 14, 4, '#5a4d3c'); // Curtain wall
        this.rect(ctx, 1, 11, 14, 1, '#7a6a52');
        this.rect(ctx, 3, 8, 1, 2, '#2b2318');   // Windows, lit at dusk
        this.rect(ctx, 7, 5, 1, 2, '#d9a94e');
        this.rect(ctx, 12, 9, 1, 1, '#d9a94e');
        this.rect(ctx, 7, 12, 2, 3, '#2b2318');  // Gate
        break;
      }
      case 'building':
      case '🏠': {
        // A single structure: pitched roof over a timbered front.
        this.rect(ctx, 7, 1, 2, 1, '#8a4a35');   // Ridge
        this.rect(ctx, 5, 2, 6, 1, '#8a4a35');
        this.rect(ctx, 3, 3, 10, 2, '#a3583f');  // Roof
        this.rect(ctx, 2, 5, 12, 1, '#7a4230');  // Eaves
        this.rect(ctx, 3, 6, 10, 9, '#b8a184');  // Plaster
        this.rect(ctx, 3, 6, 1, 9, '#6b5c48');   // Corner posts
        this.rect(ctx, 12, 6, 1, 9, '#6b5c48');
        this.rect(ctx, 4, 7, 3, 3, '#3d2e22');   // Window
        this.rect(ctx, 5, 8, 1, 1, '#d9a94e');
        this.rect(ctx, 9, 10, 3, 5, '#5a3a26');  // Door
        break;
      }

      // ===================== TRADE & WEALTH =====================
      case 'coin':
      case '🪙':
      case '💰': {
        // A struck coin, seen face on.
        this.rect(ctx, 5, 2, 6, 1, '#8a6a2f');   // Rim
        this.rect(ctx, 3, 3, 10, 1, '#8a6a2f');
        this.rect(ctx, 2, 4, 12, 8, '#8a6a2f');
        this.rect(ctx, 3, 12, 10, 1, '#8a6a2f');
        this.rect(ctx, 5, 13, 6, 1, '#8a6a2f');
        this.rect(ctx, 4, 4, 8, 8, '#c9a153');   // Face
        this.rect(ctx, 3, 5, 10, 6, '#c9a153');
        this.rect(ctx, 4, 5, 2, 2, '#e2bd6d');   // Struck highlight
        this.rect(ctx, 7, 5, 2, 6, '#7a5a25');   // Sigil
        this.rect(ctx, 5, 7, 6, 2, '#7a5a25');
        break;
      }
      case 'crate':
      case '📦': {
        // A trade good: a banded shipping crate.
        this.rect(ctx, 2, 3, 12, 11, '#8a6a45');
        this.rect(ctx, 2, 3, 12, 1, '#a88558');  // Lit lid
        this.rect(ctx, 2, 13, 12, 1, '#5e4630');
        this.rect(ctx, 2, 3, 1, 11, '#a88558');
        this.rect(ctx, 13, 3, 1, 11, '#5e4630');
        this.rect(ctx, 2, 7, 12, 2, '#5e4630');  // Bands
        this.rect(ctx, 7, 3, 2, 11, '#5e4630');
        this.px(ctx, 4, 5, '#a88558');           // Grain of the timber
        this.px(ctx, 11, 11, '#a88558');
        break;
      }
      case 'route':
      case '🛣': {
        // A trade route: a road running to the horizon between two waypoints.
        this.rect(ctx, 6, 2, 4, 12, '#6b5c48');  // Roadbed, narrowing with distance
        this.rect(ctx, 5, 8, 6, 6, '#7a6a52');
        this.rect(ctx, 4, 12, 8, 3, '#7a6a52');
        this.rect(ctx, 7, 3, 2, 2, '#c9a153');   // Centre line, dashed
        this.rect(ctx, 7, 7, 2, 2, '#c9a153');
        this.rect(ctx, 7, 11, 2, 3, '#c9a153');
        this.rect(ctx, 2, 3, 3, 3, '#8a7860');   // Waypoint markers
        this.rect(ctx, 11, 3, 3, 3, '#8a7860');
        this.px(ctx, 3, 4, '#c9a153');
        this.px(ctx, 12, 4, '#c9a153');
        break;
      }
      case 'handshake':
      case '🤝': {
        // Diplomacy: two arms clasped across the middle.
        this.rect(ctx, 1, 6, 5, 2, '#7a6a52');   // Left sleeve
        this.rect(ctx, 10, 6, 5, 2, '#5e5140');  // Right sleeve
        this.rect(ctx, 1, 8, 4, 2, '#94836a');
        this.rect(ctx, 11, 8, 4, 2, '#6b5c48');
        this.rect(ctx, 5, 7, 6, 3, '#c99a6e');   // The clasp
        this.rect(ctx, 4, 8, 8, 3, '#c99a6e');
        this.rect(ctx, 5, 8, 6, 1, '#e0b98f');   // Lit knuckles
        this.px(ctx, 7, 10, '#a87d55');
        this.px(ctx, 9, 10, '#a87d55');
        break;
      }

      // ===================== RECORDS & KNOWLEDGE =====================
      case 'scroll':
      case '📜': {
        // A chronicle entry: parchment with rolled ends.
        this.rect(ctx, 3, 1, 10, 2, '#8a6a45');  // Upper roll
        this.rect(ctx, 3, 13, 10, 2, '#8a6a45'); // Lower roll
        this.rect(ctx, 3, 3, 10, 10, '#ddd0b2'); // Parchment
        this.rect(ctx, 3, 3, 10, 1, '#efe4c8');
        this.rect(ctx, 3, 12, 10, 1, '#c2b494');
        this.rect(ctx, 5, 5, 6, 1, '#5e4630');   // Writing
        this.rect(ctx, 5, 7, 7, 1, '#5e4630');
        this.rect(ctx, 5, 9, 5, 1, '#5e4630');
        this.px(ctx, 2, 1, '#5e4630');
        this.px(ctx, 13, 14, '#5e4630');
        break;
      }
      case 'calendar':
      case '📅': {
        // A dated page: binding rings above a month grid.
        this.px(ctx, 4, 0, '#8a7860');           // Rings
        this.px(ctx, 11, 0, '#8a7860');
        this.rect(ctx, 2, 1, 12, 3, '#8a4a35');  // Header band
        this.rect(ctx, 4, 1, 1, 2, '#c2b494');
        this.rect(ctx, 11, 1, 1, 2, '#c2b494');
        this.rect(ctx, 2, 4, 12, 11, '#ddd0b2'); // Page
        this.rect(ctx, 2, 14, 12, 1, '#c2b494');
        this.rect(ctx, 4, 6, 2, 2, '#5e4630');   // Day cells
        this.rect(ctx, 7, 6, 2, 2, '#5e4630');
        this.rect(ctx, 10, 6, 2, 2, '#5e4630');
        this.rect(ctx, 4, 10, 2, 2, '#5e4630');
        this.rect(ctx, 7, 10, 2, 2, '#c9a153');  // Today
        this.rect(ctx, 10, 10, 2, 2, '#5e4630');
        break;
      }
      case 'flask':
      case '🧪': {
        // Research: a stoppered flask, half full.
        this.rect(ctx, 6, 0, 4, 2, '#8a6a45');   // Stopper
        this.rect(ctx, 6, 2, 4, 3, '#b8c4c8');   // Neck
        this.rect(ctx, 4, 5, 8, 2, '#b8c4c8');   // Shoulder
        this.rect(ctx, 3, 7, 10, 8, '#b8c4c8');  // Body
        this.rect(ctx, 4, 9, 8, 5, '#6f8fa8');   // Solution
        this.rect(ctx, 4, 9, 8, 1, '#8fb0c4');   // Meniscus
        this.rect(ctx, 4, 7, 1, 7, '#dce6ea');   // Glass highlight
        this.px(ctx, 6, 11, '#8fb0c4');          // Bubbles
        this.px(ctx, 9, 12, '#8fb0c4');
        break;
      }

      case 'search':
      case '🔍': {
        // A brass magnifier. Search fields appear on every list screen, so this
        // one earns real artwork rather than borrowing the gem sprite.
        this.rect(ctx, 4, 1, 6, 1, '#8a6a2f');   // Rim
        this.rect(ctx, 2, 2, 1, 1, '#8a6a2f'); this.rect(ctx, 11, 2, 1, 1, '#8a6a2f');
        this.rect(ctx, 1, 3, 1, 5, '#8a6a2f'); this.rect(ctx, 12, 3, 1, 5, '#8a6a2f');
        this.rect(ctx, 2, 8, 1, 1, '#8a6a2f'); this.rect(ctx, 11, 8, 1, 1, '#8a6a2f');
        this.rect(ctx, 4, 9, 6, 1, '#8a6a2f');
        this.rect(ctx, 3, 3, 8, 6, '#6f8fa8');   // Glass
        this.rect(ctx, 4, 2, 6, 1, '#6f8fa8');
        this.rect(ctx, 4, 3, 2, 2, '#aac6d4');   // Reflection
        this.rect(ctx, 10, 10, 2, 2, '#8a6a2f'); // Handle
        this.rect(ctx, 11, 11, 3, 3, '#5e4630');
        this.rect(ctx, 13, 13, 2, 2, '#5e4630');
        break;
      }

      // ===================== TIME CONTROLS =====================
      case 'pause': {
        this.rect(ctx, 3, 2, 4, 12, '#a79c89');
        this.rect(ctx, 9, 2, 4, 12, '#a79c89');
        this.rect(ctx, 3, 2, 4, 1, '#c9c0ae');
        this.rect(ctx, 9, 2, 4, 1, '#c9c0ae');
        break;
      }
      case 'play':
      case '▶': {
        // A solid triangle, stepped so the hypotenuse stays clean at 16px.
        for (let i = 0; i < 6; i++) {
          this.rect(ctx, 4 + i * 2, 2 + i, 2, 12 - i * 2, '#a79c89');
        }
        this.rect(ctx, 4, 2, 2, 12, '#c9c0ae');
        break;
      }
      case 'forward':
      case '⏩': {
        for (let i = 0; i < 4; i++) {
          this.rect(ctx, 1 + i * 2, 3 + i, 2, 10 - i * 2, '#a79c89');
        }
        for (let i = 0; i < 4; i++) {
          this.rect(ctx, 9 + i * 2, 3 + i, 2, 10 - i * 2, '#c9a153');
        }
        break;
      }
      case 'step':
      case '⏭':
      case '⏭️': {
        for (let i = 0; i < 4; i++) {
          this.rect(ctx, 2 + i * 2, 3 + i, 2, 10 - i * 2, '#a79c89');
        }
        this.rect(ctx, 11, 2, 3, 12, '#c9a153');
        break;
      }
      case 'snow':
      case '❄':
      case '❄️': {
        // A six-point flake, kept axis-aligned so it survives the pixel grid.
        this.rect(ctx, 7, 1, 2, 14, '#aac6d4');
        this.rect(ctx, 1, 7, 14, 2, '#aac6d4');
        this.px(ctx, 4, 4, '#dce6ea'); this.px(ctx, 11, 4, '#dce6ea');
        this.px(ctx, 4, 11, '#dce6ea'); this.px(ctx, 11, 11, '#dce6ea');
        this.px(ctx, 5, 5, '#aac6d4'); this.px(ctx, 10, 5, '#aac6d4');
        this.px(ctx, 5, 10, '#aac6d4'); this.px(ctx, 10, 10, '#aac6d4');
        this.rect(ctx, 6, 6, 4, 4, '#dce6ea');
        break;
      }

      // ===================== POWERS & NATURE ICONS =====================
      case 'heart':
      case '💖': {
        // Red pixel heart with lit highlight
        this.rect(ctx, 3, 3, 4, 3, '#ef4444');
        this.rect(ctx, 9, 3, 4, 3, '#ef4444');
        this.rect(ctx, 2, 5, 12, 4, '#dc2626');
        this.rect(ctx, 3, 9, 10, 2, '#dc2626');
        this.rect(ctx, 5, 11, 6, 2, '#b91c1c');
        this.rect(ctx, 7, 13, 2, 2, '#991b1b');
        this.rect(ctx, 4, 4, 2, 2, '#fca5a5'); // Highlight
        break;
      }
      case 'water':
      case 'drop':
      case '💧': {
        // Water droplet
        this.rect(ctx, 7, 1, 2, 2, '#7dd3fc');
        this.rect(ctx, 6, 3, 4, 2, '#38bdf8');
        this.rect(ctx, 5, 5, 6, 3, '#0284c7');
        this.rect(ctx, 4, 8, 8, 4, '#0284c7');
        this.rect(ctx, 5, 12, 6, 2, '#0369a1');
        this.rect(ctx, 7, 14, 2, 1, '#075985');
        this.rect(ctx, 6, 7, 2, 3, '#e0f2fe'); // Drop glint
        break;
      }
      case 'mountain':
      case 'mountains':
      case '⛰':
      case '⛰️':
      case '🏔':
      case '🏔️': {
        // Twin mountain peaks with snow
        this.rect(ctx, 7, 2, 2, 2, '#f8fafc'); // Peak snow
        this.rect(ctx, 6, 4, 4, 2, '#e2e8f0');
        this.rect(ctx, 5, 6, 6, 3, '#94a3b8');
        this.rect(ctx, 3, 9, 10, 3, '#64748b');
        this.rect(ctx, 1, 12, 14, 3, '#475569');
        this.rect(ctx, 1, 15, 14, 1, '#334155');
        this.rect(ctx, 2, 7, 2, 2, '#f8fafc'); // Secondary peak
        this.rect(ctx, 2, 9, 3, 3, '#94a3b8');
        break;
      }
      case 'skull':
      case '💀': {
        // Pixel skull for corrupted/dark powers
        this.rect(ctx, 4, 2, 8, 6, '#e2e8f0');
        this.rect(ctx, 3, 5, 10, 4, '#cbd5e1');
        this.rect(ctx, 5, 9, 6, 4, '#94a3b8');
        this.rect(ctx, 5, 5, 2, 2, '#0f172a'); // Eye sockets
        this.rect(ctx, 9, 5, 2, 2, '#0f172a');
        this.px(ctx, 7, 8, '#0f172a');           // Nose cavity
        this.px(ctx, 6, 11, '#0f172a'); this.px(ctx, 9, 11, '#0f172a'); // Teeth
        break;
      }
      case 'sand':
      case '🏖':
      case '🏖️': {
        // Golden sand dune
        this.rect(ctx, 6, 4, 4, 2, '#fde047');
        this.rect(ctx, 4, 6, 8, 3, '#facc15');
        this.rect(ctx, 2, 9, 12, 4, '#eab308');
        this.rect(ctx, 1, 13, 14, 2, '#ca8a04');
        this.px(ctx, 7, 5, '#fef08a');
        break;
      }
      case 'wolf':
      case '🐺': {
        // Grey wolf head profile
        this.rect(ctx, 4, 2, 2, 3, '#475569'); // Left ear
        this.rect(ctx, 9, 2, 2, 3, '#475569'); // Right ear
        this.rect(ctx, 4, 5, 7, 5, '#64748b'); // Head
        this.rect(ctx, 3, 8, 9, 4, '#94a3b8'); // Muzzle & jaw
        this.rect(ctx, 11, 9, 3, 2, '#334155'); // Nose
        this.px(ctx, 6, 6, '#fef08a');          // Yellow eye
        this.px(ctx, 8, 6, '#fef08a');
        break;
      }
      case 'bear':
      case '🐻': {
        // Brown bear silhouette
        this.rect(ctx, 3, 2, 3, 3, '#78350f'); // Ears
        this.rect(ctx, 10, 2, 3, 3, '#78350f');
        this.rect(ctx, 4, 4, 8, 6, '#92400e'); // Head
        this.rect(ctx, 5, 8, 6, 5, '#b45309'); // Snout
        this.rect(ctx, 7, 9, 2, 2, '#451a03'); // Nose
        this.px(ctx, 5, 6, '#1e293b'); this.px(ctx, 10, 6, '#1e293b'); // Eyes
        break;
      }
      case 'deer':
      case '🦌': {
        // Stag with golden antlers
        this.rect(ctx, 3, 1, 1, 4, '#ca8a04'); // Antlers
        this.rect(ctx, 2, 2, 3, 1, '#ca8a04');
        this.rect(ctx, 12, 1, 1, 4, '#ca8a04');
        this.rect(ctx, 11, 2, 3, 1, '#ca8a04');
        this.rect(ctx, 5, 4, 6, 6, '#d97706'); // Head
        this.rect(ctx, 6, 8, 4, 5, '#b45309'); // Muzzle
        this.px(ctx, 7, 12, '#451a03');        // Nose
        this.px(ctx, 6, 6, '#0f172a'); this.px(ctx, 9, 6, '#0f172a'); // Eyes
        break;
      }

      // ===================== INTERFACE =====================
      case 'menu':
      case '☰': {
        // Three rules, weighted so the stack reads as a list rather than a grate.
        this.rect(ctx, 2, 3, 12, 2, '#a79c89');
        this.rect(ctx, 2, 7, 12, 2, '#a79c89');
        this.rect(ctx, 2, 11, 12, 2, '#a79c89');
        this.rect(ctx, 2, 3, 12, 1, '#c9c0ae');
        this.rect(ctx, 2, 7, 12, 1, '#c9c0ae');
        this.rect(ctx, 2, 11, 12, 1, '#c9c0ae');
        break;
      }
      case 'warning':
      case '⚠':
      case '⚠️': {
        // A cast-metal warning triangle.
        this.rect(ctx, 7, 1, 2, 1, '#d98324');
        this.rect(ctx, 6, 2, 4, 2, '#d98324');
        this.rect(ctx, 5, 4, 6, 2, '#d98324');
        this.rect(ctx, 4, 6, 8, 2, '#d98324');
        this.rect(ctx, 3, 8, 10, 2, '#d98324');
        this.rect(ctx, 2, 10, 12, 2, '#d98324');
        this.rect(ctx, 1, 12, 14, 2, '#b8651a');
        this.rect(ctx, 7, 4, 2, 6, '#2b2318');  // Bang
        this.rect(ctx, 7, 11, 2, 2, '#2b2318');
        break;
      }
      case 'close':
      case '✕': {
        // A cross, drawn on the diagonal so it stays crisp at 16px.
        for (let i = 0; i < 8; i++) {
          this.rect(ctx, 4 + i, 4 + i, 1, 1, '#a79c89');
          this.rect(ctx, 4 + i, 5 + i, 1, 1, '#a79c89');
          this.rect(ctx, 11 - i, 4 + i, 1, 1, '#a79c89');
          this.rect(ctx, 11 - i, 5 + i, 1, 1, '#a79c89');
        }
        break;
      }

      default: {
        /**
         * The consistent fallback.
         *
         * Deliberately quiet: a bronze lozenge that reads as "no icon yet"
         * rather than the old bright gold star, which drew more attention than
         * the icons it stood in for and made a missing asset look intentional.
         */
        this.rect(ctx, 7, 3, 2, 10, '#8a6a2f');
        this.rect(ctx, 6, 4, 4, 8, '#8a6a2f');
        this.rect(ctx, 5, 6, 6, 4, '#8a6a2f');
        this.rect(ctx, 4, 7, 8, 2, '#8a6a2f');
        this.rect(ctx, 7, 5, 2, 6, '#c9a153');
        this.rect(ctx, 6, 7, 4, 2, '#c9a153');
        break;
      }
    }
  }
}
