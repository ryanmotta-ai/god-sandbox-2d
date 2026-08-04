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

      default: {
        // Default generic pixel star icon fallback
        this.rect(ctx, 6, 2, 4, 12, '#fbbf24');
        this.rect(ctx, 2, 6, 12, 4, '#fbbf24');
        this.rect(ctx, 7, 3, 2, 10, '#fef08a');
        break;
      }
    }
  }
}
