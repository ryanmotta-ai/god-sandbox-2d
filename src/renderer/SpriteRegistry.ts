/**
 * Comprehensive Pixel Art Sprite Registry.
 * Generates transparent-background pixel sprites for tiles, resources, nature, disasters, items, fauna, and kingdom badges. Nature/resource sprites may use larger canvases for stronger map silhouettes.
 */
export class SpriteRegistry {
  private static cache: Map<string, HTMLCanvasElement> = new Map();

  private static createTransparentCanvas(width: number = 16, height: number = 16): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    return { canvas, ctx };
  }

  /** Helper: set individual pixel */
  private static px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  public static get(key: string): HTMLCanvasElement | null {
    return this.cache.get(key) || null;
  }

  public static registerSprite(key: string, drawFn: (ctx: CanvasRenderingContext2D) => void, width: number = 16, height: number = 16): HTMLCanvasElement {
    if (this.cache.has(key)) return this.cache.get(key)!;
    const { canvas, ctx } = this.createTransparentCanvas(width, height);
    drawFn(ctx);
    this.cache.set(key, canvas);
    return canvas;
  }

  public static initializeAllTransparentSprites(): void {
    const px = this.px;

    // === TREES & VEGETATION ===
    // World-map philosophy: these are environmental objects, not UI icons.
    // They use larger transparent canvases and readable silhouettes so the renderer
    // can place them sparsely, at varied scales, while the terrain remains visible.

    const drawOak = (ctx: CanvasRenderingContext2D, variant: number): void => {
      const shift = variant === 1 ? -2 : variant === 2 ? 2 : 0;
      // roots / trunk
      ctx.fillStyle = '#4b2e16'; ctx.fillRect(14 + shift, 27, 5, 17);
      ctx.fillStyle = '#6b3f1d'; ctx.fillRect(16 + shift, 25, 3, 17);
      ctx.fillStyle = '#8a5728'; ctx.fillRect(17 + shift, 28, 1, 11);
      ctx.fillStyle = '#4b2e16';
      ctx.fillRect(10 + shift, 41, 6, 3); ctx.fillRect(18 + shift, 42, 7, 2);
      // branch forks visible beneath canopy
      ctx.fillRect(12 + shift, 23, 4, 8); ctx.fillRect(18 + shift, 21, 3, 9);

      // canopy shadow mass — irregular, with transparent cuts between clusters
      ctx.fillStyle = '#184b2d';
      ctx.fillRect(5 + shift, 12, 23, 14);
      ctx.fillRect(8 + shift, 7, 17, 20);
      ctx.fillRect(2 + shift, 16, 11, 9);
      ctx.fillRect(20 + shift, 13, 10, 10);
      // middle leaf clusters
      ctx.fillStyle = '#236b37';
      ctx.fillRect(7 + shift, 10, 17, 12);
      ctx.fillRect(4 + shift, 15, 10, 7);
      ctx.fillRect(18 + shift, 11, 9, 9);
      ctx.fillRect(10 + shift, 6, 11, 7);
      // sun-facing planes
      ctx.fillStyle = '#39884a';
      ctx.fillRect(9 + shift, 9, 8, 6);
      ctx.fillRect(6 + shift, 15, 6, 4);
      ctx.fillRect(18 + shift, 13, 6, 5);
      if (variant !== 2) ctx.fillRect(13 + shift, 6, 6, 3);
      // restrained highlights, not confetti
      ctx.fillStyle = '#63a955';
      ctx.fillRect(11 + shift, 9, 3, 2);
      ctx.fillRect(20 + shift, 14, 2, 2);
      if (variant === 1) ctx.fillRect(6 + shift, 17, 2, 2);
      // dark cutouts add crown depth
      ctx.fillStyle = '#123922';
      ctx.fillRect(5 + shift, 20, 4, 3);
      ctx.fillRect(23 + shift, 18, 4, 3);
      if (variant === 2) ctx.fillRect(13 + shift, 22, 4, 3);
    };

    for (let i = 0; i < 3; i++) {
      this.registerSprite(`tree_oak_${i}`, (ctx) => drawOak(ctx, i), 32, 48);
    }
    this.registerSprite('tree_oak', (ctx) => drawOak(ctx, 0), 32, 48);

    const drawPine = (ctx: CanvasRenderingContext2D, variant: number): void => {
      const lean = variant === 1 ? -1 : variant === 2 ? 1 : 0;
      ctx.fillStyle = '#4b2d16'; ctx.fillRect(15 + lean, 30, 4, 15);
      ctx.fillStyle = '#704422'; ctx.fillRect(17 + lean, 31, 2, 12);
      // layered triangular crown, kept blocky/pixel-readable
      ctx.fillStyle = '#103f31';
      ctx.fillRect(14 + lean, 3, 5, 5);
      ctx.fillRect(11 + lean, 7, 11, 7);
      ctx.fillRect(8 + lean, 13, 17, 8);
      ctx.fillRect(5 + lean, 20, 23, 9);
      ctx.fillRect(3 + lean, 27, 27, 8);
      ctx.fillStyle = '#176047';
      ctx.fillRect(14 + lean, 5, 4, 4);
      ctx.fillRect(12 + lean, 9, 8, 5);
      ctx.fillRect(9 + lean, 15, 13, 5);
      ctx.fillRect(7 + lean, 22, 18, 5);
      ctx.fillRect(6 + lean, 29, 20, 4);
      ctx.fillStyle = '#2b7a57';
      ctx.fillRect(14 + lean, 8, 4, 2);
      ctx.fillRect(11 + lean, 16, 6, 2);
      ctx.fillRect(9 + lean, 23, 8, 2);
      // snow is a material cap, not white noise
      if (variant !== 2) {
        ctx.fillStyle = '#e7f0f1';
        ctx.fillRect(14 + lean, 3, 4, 2);
        ctx.fillRect(11 + lean, 9, 6, 2);
        ctx.fillRect(8 + lean, 16, 8, 2);
        if (variant === 1) ctx.fillRect(6 + lean, 23, 8, 2);
      }
    };
    for (let i = 0; i < 3; i++) {
      this.registerSprite(`tree_pine_${i}`, (ctx) => drawPine(ctx, i), 32, 48);
    }
    this.registerSprite('tree_pine', (ctx) => drawPine(ctx, 0), 32, 48);

    const drawPalm = (ctx: CanvasRenderingContext2D, variant: number): void => {
      const bend = variant === 1 ? -2 : variant === 2 ? 2 : 0;
      // segmented curved trunk
      ctx.fillStyle = '#7a4b20';
      ctx.fillRect(15, 20, 5, 7); ctx.fillRect(14 + Math.sign(bend), 27, 5, 7);
      ctx.fillRect(13 + bend, 34, 5, 10);
      ctx.fillStyle = '#b17937';
      ctx.fillRect(17, 21, 2, 5); ctx.fillRect(16 + Math.sign(bend), 29, 2, 5); ctx.fillRect(15 + bend, 36, 2, 6);
      // crown center + coconuts
      ctx.fillStyle = '#5b3a1b'; ctx.fillRect(14, 16, 6, 5);
      ctx.fillStyle = '#72451e'; ctx.fillRect(13, 19, 3, 3); ctx.fillRect(19, 18, 3, 3);
      // broad fronds with distinct negative space
      ctx.fillStyle = '#386b2f';
      ctx.fillRect(2, 11, 14, 4); ctx.fillRect(19, 10, 12, 4);
      ctx.fillRect(5, 6, 12, 4); ctx.fillRect(18, 5, 10, 4);
      ctx.fillRect(10, 2, 7, 9); ctx.fillRect(17, 2, 5, 9);
      ctx.fillStyle = '#5b8d39';
      ctx.fillRect(4, 10, 10, 2); ctx.fillRect(21, 9, 8, 2);
      ctx.fillRect(7, 6, 8, 2); ctx.fillRect(19, 5, 7, 2);
      ctx.fillRect(12, 3, 3, 7);
      if (variant === 1) ctx.fillRect(1, 15, 11, 2);
      if (variant === 2) ctx.fillRect(22, 14, 10, 2);
    };
    for (let i = 0; i < 3; i++) {
      this.registerSprite(`tree_palm_${i}`, (ctx) => drawPalm(ctx, i), 32, 48);
    }
    this.registerSprite('tree_palm', (ctx) => drawPalm(ctx, 0), 32, 48);

    const drawReeds = (ctx: CanvasRenderingContext2D, variant: number): void => {
      const stems = variant === 1 ? [5, 9, 13, 17, 22, 26] : variant === 2 ? [4, 8, 14, 19, 24] : [6, 11, 16, 21, 25];
      ctx.fillStyle = '#31532f';
      for (let i = 0; i < stems.length; i++) {
        const x = stems[i];
        const top = 7 + ((i * 5 + variant * 3) % 9);
        ctx.fillRect(x, top, 2, 28 - top);
      }
      ctx.fillStyle = '#6a4626';
      for (let i = 0; i < stems.length; i += 2) {
        const x = stems[i] - 1;
        const top = 5 + ((i * 5 + variant * 3) % 9);
        ctx.fillRect(x, top, 4, 7);
      }
      ctx.fillStyle = '#527443';
      ctx.fillRect(3, 25, 10, 3); ctx.fillRect(15, 26, 13, 2);
    };
    for (let i = 0; i < 3; i++) this.registerSprite(`swamp_reed_${i}`, (ctx) => drawReeds(ctx, i), 32, 32);
    this.registerSprite('swamp_reed', (ctx) => drawReeds(ctx, 0), 32, 32);

    const drawArcaneCrystal = (ctx: CanvasRenderingContext2D, variant: number): void => {
      ctx.fillStyle = '#38245f'; ctx.fillRect(6, 30, 21, 5);
      ctx.fillStyle = '#6f42a6';
      ctx.fillRect(13, 7 - variant, 7, 25 + variant);
      ctx.fillRect(6, 17, 7, 15); ctx.fillRect(21, 14 + variant, 6, 18 - variant);
      ctx.fillStyle = '#9f72d1';
      ctx.fillRect(15, 9 - variant, 3, 18); ctx.fillRect(8, 19, 2, 10); ctx.fillRect(23, 16 + variant, 2, 11);
      ctx.fillStyle = '#d5c0ef';
      ctx.fillRect(15, 9 - variant, 2, 5); ctx.fillRect(8, 19, 2, 3); ctx.fillRect(23, 16 + variant, 2, 3);
    };
    for (let i = 0; i < 2; i++) this.registerSprite(`arcane_crystal_${i}`, (ctx) => drawArcaneCrystal(ctx, i), 32, 36);
    this.registerSprite('arcane_crystal', (ctx) => drawArcaneCrystal(ctx, 0), 32, 36);

    const drawCorruptedRelic = (ctx: CanvasRenderingContext2D, variant: number): void => {
      ctx.fillStyle = '#2c1c35'; ctx.fillRect(4, 20, 24, 7);
      ctx.fillStyle = '#b5adb8'; ctx.fillRect(10, 7, 13, 12);
      ctx.fillStyle = '#d2ccd5'; ctx.fillRect(12, 6, 9, 10);
      ctx.fillStyle = '#251c29'; ctx.fillRect(12, 10, 3, 3); ctx.fillRect(18, 10, 3, 3);
      ctx.fillStyle = '#8e4aa7'; ctx.fillRect(13, 11, 2, 2); ctx.fillRect(19, 11, 2, 2);
      ctx.fillStyle = '#6b6170'; ctx.fillRect(12, 17, 10, 4);
      if (variant === 1) { ctx.fillStyle = '#8e4aa7'; ctx.fillRect(5, 23, 8, 2); ctx.fillRect(22, 21, 6, 2); }
    };
    for (let i = 0; i < 2; i++) this.registerSprite(`corrupted_skull_${i}`, (ctx) => drawCorruptedRelic(ctx, i), 32, 28);
    this.registerSprite('corrupted_skull', (ctx) => drawCorruptedRelic(ctx, 0), 32, 28);

    // === RESOURCE NODES ===
    // Resource art is intentionally grounded: ore is rock-with-vein, oil is a seep,
    // cotton/food are plants. The renderer chooses only a few local deposit anchors,
    // so these read as natural landmarks rather than a resource-icon overlay.

    const rockNode = (
      key: string,
      matrixDark: string,
      matrixMid: string,
      vein: string,
      highlight: string,
      variant: number = 0
    ): void => {
      this.registerSprite(key, (ctx) => {
        const dx = variant === 1 ? 1 : 0;
        ctx.fillStyle = matrixDark;
        ctx.fillRect(3 + dx, 10, 18, 10); ctx.fillRect(6 + dx, 6, 12, 14); ctx.fillRect(9 + dx, 4, 8, 5);
        ctx.fillStyle = matrixMid;
        ctx.fillRect(6 + dx, 9, 12, 8); ctx.fillRect(9 + dx, 6, 7, 5);
        // two connected mineral veins, not a badge pasted on top
        ctx.fillStyle = vein;
        ctx.fillRect(8 + dx, 8, 5, 2); ctx.fillRect(12 + dx, 10, 3, 2);
        ctx.fillRect(13 + dx, 12, 5, 2); ctx.fillRect(7 + dx, 15, 5, 2);
        ctx.fillStyle = highlight;
        ctx.fillRect(9 + dx, 8, 2, 1); ctx.fillRect(15 + dx, 12, 2, 1);
        // base fragments
        ctx.fillStyle = matrixDark; ctx.fillRect(1 + dx, 17, 5, 3); ctx.fillRect(19 + dx, 16, 4, 4);
      }, 24, 24);
    };

    // Wood is represented by a fallen natural log pile, not a lumber icon.
    this.registerSprite('node_wood', (ctx) => {
      ctx.fillStyle = '#5b371b'; ctx.fillRect(3, 13, 18, 5); ctx.fillRect(7, 9, 13, 5);
      ctx.fillStyle = '#8a5728'; ctx.fillRect(4, 12, 16, 3); ctx.fillRect(8, 8, 11, 3);
      ctx.fillStyle = '#c49255'; ctx.fillRect(3, 13, 3, 4); ctx.fillRect(18, 9, 3, 4);
      ctx.fillStyle = '#6d8a42'; ctx.fillRect(6, 17, 7, 2); ctx.fillRect(14, 15, 5, 2);
    }, 24, 24);

    rockNode('node_stone', '#4b5560', '#737d84', '#9da5aa', '#d1d6d9');
    rockNode('node_iron', '#303943', '#4a5662', '#8793a0', '#c7d0d8');
    rockNode('node_gold', '#4a3b31', '#655044', '#c69224', '#f3d36b');
    rockNode('node_coal', '#26272a', '#3c3e42', '#111214', '#73767c');
    rockNode('node_copper', '#45433f', '#615d55', '#b9602f', '#6ea995');
    rockNode('node_tin', '#3d4248', '#596168', '#aeb8be', '#e0e6e8');
    rockNode('node_saltpeter', '#464541', '#66645e', '#a6c3c8', '#dceef0');
    rockNode('node_uranium', '#292c27', '#3e443a', '#6f8f35', '#b5d667');

    this.registerSprite('node_gems', (ctx) => {
      ctx.fillStyle = '#3f3948'; ctx.fillRect(3, 13, 19, 8); ctx.fillRect(7, 9, 13, 7);
      ctx.fillStyle = '#62596c'; ctx.fillRect(6, 12, 13, 6);
      // small crystal outcrops integrated into the stone
      ctx.fillStyle = '#8d65ad'; ctx.fillRect(8, 6, 4, 9); ctx.fillRect(14, 8, 4, 8); ctx.fillRect(18, 11, 3, 6);
      ctx.fillStyle = '#c4a5dc'; ctx.fillRect(9, 7, 1, 4); ctx.fillRect(15, 9, 1, 4);
      ctx.fillStyle = '#7db1b8'; ctx.fillRect(11, 14, 2, 3);
    }, 24, 24);

    this.registerSprite('node_berry', (ctx) => {
      ctx.fillStyle = '#215b32'; ctx.fillRect(3, 11, 18, 9); ctx.fillRect(6, 8, 12, 8);
      ctx.fillStyle = '#377946'; ctx.fillRect(6, 10, 11, 7); ctx.fillRect(10, 7, 6, 5);
      ctx.fillStyle = '#a74643'; ctx.fillRect(7, 12, 2, 2); ctx.fillRect(13, 10, 2, 2); ctx.fillRect(17, 14, 2, 2);
      ctx.fillStyle = '#d4776d'; ctx.fillRect(8, 12, 1, 1); ctx.fillRect(14, 10, 1, 1);
    }, 24, 24);

    this.registerSprite('node_food', (ctx) => {
      // a tiny wild grain patch — environmental, not a wheat UI badge
      ctx.fillStyle = '#6a7437'; ctx.fillRect(4, 16, 16, 4);
      ctx.fillStyle = '#a9863f';
      for (const x of [6, 10, 14, 18]) ctx.fillRect(x, 9 + (x % 3), 1, 8);
      ctx.fillStyle = '#d3b65e';
      ctx.fillRect(5, 7, 3, 5); ctx.fillRect(9, 6, 3, 5); ctx.fillRect(13, 8, 3, 5); ctx.fillRect(17, 7, 3, 5);
      ctx.fillStyle = '#ead484'; ctx.fillRect(6, 7, 1, 3); ctx.fillRect(10, 6, 1, 3); ctx.fillRect(18, 7, 1, 3);
    }, 24, 24);

    this.registerSprite('node_clay', (ctx) => {
      ctx.fillStyle = '#7a4631'; ctx.fillRect(3, 13, 18, 7); ctx.fillRect(6, 10, 12, 5);
      ctx.fillStyle = '#9e6042'; ctx.fillRect(6, 12, 12, 5);
      ctx.fillStyle = '#c18462'; ctx.fillRect(8, 12, 5, 2);
      ctx.fillStyle = '#604037'; ctx.fillRect(4, 19, 15, 2);
    }, 24, 24);

    this.registerSprite('node_salt', (ctx) => {
      ctx.fillStyle = '#aab9bd'; ctx.fillRect(2, 15, 20, 5);
      ctx.fillStyle = '#d6e0e1'; ctx.fillRect(4, 12, 16, 6);
      ctx.fillStyle = '#f1f4f2'; ctx.fillRect(6, 9, 5, 5); ctx.fillRect(13, 7, 6, 7);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(7, 9, 2, 2); ctx.fillRect(15, 8, 2, 2);
    }, 24, 24);

    this.registerSprite('node_horses', (ctx) => {
      // small grazing horse silhouette; the renderer keeps herds rare
      ctx.fillStyle = '#6d4527'; ctx.fillRect(5, 10, 12, 6); ctx.fillRect(15, 7, 5, 6);
      ctx.fillStyle = '#8d5d33'; ctx.fillRect(7, 11, 9, 4); ctx.fillRect(17, 8, 3, 3);
      ctx.fillStyle = '#3d312a'; ctx.fillRect(6, 16, 2, 6); ctx.fillRect(11, 16, 2, 6); ctx.fillRect(16, 15, 2, 6);
      ctx.fillRect(3, 10, 3, 2); ctx.fillRect(2, 11, 2, 4);
      ctx.fillStyle = '#d7d3c8'; ctx.fillRect(19, 8, 1, 1);
    }, 24, 24);

    this.registerSprite('node_cotton', (ctx) => {
      ctx.fillStyle = '#355e39'; ctx.fillRect(4, 13, 16, 7); ctx.fillRect(7, 10, 10, 6);
      ctx.fillStyle = '#597d48'; ctx.fillRect(6, 12, 12, 5);
      ctx.fillStyle = '#e5e7df'; ctx.fillRect(5, 8, 5, 5); ctx.fillRect(11, 6, 5, 5); ctx.fillRect(16, 10, 5, 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(7, 8, 2, 2); ctx.fillRect(13, 6, 2, 2);
    }, 24, 24);

    this.registerSprite('node_spices', (ctx) => {
      // flowering spice shrubs instead of a sack icon
      ctx.fillStyle = '#315c34'; ctx.fillRect(4, 13, 16, 7); ctx.fillRect(7, 9, 10, 7);
      ctx.fillStyle = '#557d43'; ctx.fillRect(6, 11, 12, 6);
      ctx.fillStyle = '#b95b38'; ctx.fillRect(7, 9, 2, 2); ctx.fillRect(13, 8, 2, 2); ctx.fillRect(17, 12, 2, 2);
      ctx.fillStyle = '#d8874d'; ctx.fillRect(8, 9, 1, 1); ctx.fillRect(14, 8, 1, 1);
    }, 24, 24);

    this.registerSprite('node_furs', (ctx) => {
      // subtle animal tracks / shed pelt cue, intentionally low-key
      ctx.fillStyle = '#665143'; ctx.fillRect(5, 12, 14, 7);
      ctx.fillStyle = '#8b7160'; ctx.fillRect(7, 11, 10, 6);
      ctx.fillStyle = '#b6a494'; ctx.fillRect(10, 13, 4, 3);
      ctx.fillStyle = '#4b3b32'; ctx.fillRect(4, 18, 4, 2); ctx.fillRect(17, 17, 4, 2);
    }, 24, 24);

    this.registerSprite('node_oil', (ctx) => {
      // natural seep: flat and terrain-integrated
      ctx.fillStyle = '#3a342e'; ctx.fillRect(2, 15, 20, 5); ctx.fillRect(5, 12, 14, 5);
      ctx.fillStyle = '#171615'; ctx.fillRect(5, 14, 14, 5); ctx.fillRect(8, 11, 8, 4);
      ctx.fillStyle = '#41364f'; ctx.fillRect(8, 14, 3, 1);
      ctx.fillStyle = '#35525a'; ctx.fillRect(14, 16, 3, 1);
      ctx.fillStyle = '#5d5a52'; ctx.fillRect(10, 11, 2, 1);
    }, 24, 24);

    this.registerSprite('node_rubber', (ctx) => {
      // a small rubber tree with a tap cup — landscape object, not symbol
      ctx.fillStyle = '#51443a'; ctx.fillRect(10, 7, 4, 14);
      ctx.fillStyle = '#706057'; ctx.fillRect(12, 8, 2, 12);
      ctx.fillStyle = '#28553a'; ctx.fillRect(4, 5, 16, 7); ctx.fillRect(7, 2, 10, 7);
      ctx.fillStyle = '#3f7448'; ctx.fillRect(7, 5, 10, 5);
      ctx.fillStyle = '#d9d4c8'; ctx.fillRect(14, 14, 1, 4);
      ctx.fillStyle = '#8c8981'; ctx.fillRect(14, 18, 5, 3);
    }, 24, 24);

    // A few mineral nodes get a second silhouette for natural repetition breaking.
    rockNode('node_iron_1', '#303943', '#4a5662', '#8793a0', '#c7d0d8', 1);
    rockNode('node_gold_1', '#4a3b31', '#655044', '#c69224', '#f3d36b', 1);
    rockNode('node_coal_1', '#26272a', '#3c3e42', '#111214', '#73767c', 1);
    rockNode('node_copper_1', '#45433f', '#615d55', '#b9602f', '#6ea995', 1);
    rockNode('node_stone_1', '#4b5560', '#737d84', '#9da5aa', '#d1d6d9', 1);

    // === DISASTER EFFECTS ===

    this.registerSprite('fx_lightning', (ctx) => {
      // Bright core bolt (zig-zag)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(9, 0, 2, 3);
      ctx.fillRect(7, 2, 3, 2);
      ctx.fillRect(8, 4, 3, 2);
      ctx.fillRect(5, 5, 4, 2);
      ctx.fillRect(6, 7, 3, 2);
      ctx.fillRect(3, 8, 4, 3);
      ctx.fillRect(4, 11, 3, 2);
      ctx.fillRect(2, 12, 3, 3);
      // White hot center
      ctx.fillStyle = '#ffffff';
      px(ctx, 9, 1, '#fff'); px(ctx, 8, 3, '#fff'); px(ctx, 6, 6, '#fff');
      px(ctx, 7, 8, '#fff'); px(ctx, 4, 10, '#fff'); px(ctx, 3, 13, '#fff');
      // Outer glow
      ctx.fillStyle = '#fde68a';
      px(ctx, 8, 0, '#fde68a'); px(ctx, 6, 2, '#fde68a'); px(ctx, 4, 5, '#fde68a');
      px(ctx, 5, 8, '#fde68a'); px(ctx, 1, 12, '#fde68a');
    });

    this.registerSprite('fx_fire', (ctx) => {
      // Flame base (red)
      ctx.fillStyle = '#dc2626'; ctx.fillRect(3, 10, 10, 6);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(4, 8, 8, 4);
      // Middle (orange)
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(5, 6, 6, 4);
      ctx.fillStyle = '#f97316'; ctx.fillRect(4, 7, 8, 3);
      // Tips (yellow)
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(6, 3, 4, 4);
      ctx.fillStyle = '#fde047'; ctx.fillRect(7, 1, 2, 3);
      // White hot core
      ctx.fillStyle = '#fef08a'; ctx.fillRect(7, 5, 2, 3);
      px(ctx, 7, 2, '#fef3c7');
      // Flame tongues
      px(ctx, 4, 6, '#ef4444'); px(ctx, 11, 7, '#f59e0b');
      px(ctx, 3, 9, '#dc2626'); px(ctx, 12, 10, '#dc2626');
      // Embers
      px(ctx, 2, 5, '#f59e0b'); px(ctx, 13, 4, '#fbbf24');
    });

    this.registerSprite('fx_tornado', (ctx) => {
      // Wide top
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(1, 1, 14, 3);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(2, 2, 12, 1);
      // Narrowing body
      ctx.fillStyle = '#64748b'; ctx.fillRect(3, 4, 10, 3);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(4, 5, 8, 1);
      ctx.fillStyle = '#475569'; ctx.fillRect(5, 7, 6, 3);
      ctx.fillStyle = '#64748b'; ctx.fillRect(6, 8, 4, 1);
      // Narrow bottom
      ctx.fillStyle = '#334155'; ctx.fillRect(6, 10, 4, 3);
      ctx.fillStyle = '#475569'; ctx.fillRect(7, 11, 2, 1);
      ctx.fillRect(7, 13, 2, 2);
      // Debris dots
      px(ctx, 2, 2, '#78350f'); px(ctx, 12, 3, '#15803d');
      px(ctx, 4, 6, '#92400e'); px(ctx, 10, 8, '#64748b');
      px(ctx, 7, 12, '#475569');
    });

    this.registerSprite('fx_meteor', (ctx) => {
      // Fire trail (top-left to center)
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(1, 1, 5, 3);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(2, 2, 4, 2);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(0, 0, 3, 2);
      // Rock core
      ctx.fillStyle = '#78350f'; ctx.fillRect(5, 4, 7, 7);
      ctx.fillStyle = '#92400e'; ctx.fillRect(6, 5, 5, 5);
      // Hot cracks in rock
      ctx.fillStyle = '#f59e0b';
      px(ctx, 7, 6, '#f59e0b'); px(ctx, 9, 8, '#fbbf24');
      // Dark rocky surface
      ctx.fillStyle = '#451a03'; ctx.fillRect(7, 7, 3, 3);
      // Trailing sparks
      px(ctx, 0, 3, '#fde047'); px(ctx, 3, 1, '#fef08a'); px(ctx, 1, 4, '#f59e0b');
      // Impact glow
      ctx.fillStyle = '#ef4444'; ctx.fillRect(8, 11, 4, 3);
    });

    this.registerSprite('fx_plague', (ctx) => {
      // Toxic cloud
      ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
      ctx.fillRect(2, 3, 12, 10);
      ctx.fillStyle = 'rgba(22, 163, 74, 0.5)';
      ctx.fillRect(3, 2, 10, 8);
      ctx.fillStyle = 'rgba(21, 128, 61, 0.4)';
      ctx.fillRect(4, 4, 8, 6);
      // Skull silhouette inside cloud
      ctx.fillStyle = 'rgba(5, 46, 22, 0.7)';
      ctx.fillRect(5, 5, 6, 5);
      // Eye sockets
      ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
      px(ctx, 6, 6, 'rgba(74, 222, 128, 0.8)'); px(ctx, 9, 6, 'rgba(74, 222, 128, 0.8)');
      // Dripping wisps
      px(ctx, 3, 12, 'rgba(34, 197, 94, 0.3)');
      px(ctx, 7, 13, 'rgba(34, 197, 94, 0.3)');
      px(ctx, 11, 12, 'rgba(34, 197, 94, 0.3)');
    });

    // === LEGENDARY ITEMS ===

    this.registerSprite('item_sunfire_blade', (ctx) => {
      // Blade
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(7, 1, 2, 8);
      ctx.fillStyle = '#fde047'; px(ctx, 7, 1, '#fde047'); px(ctx, 8, 2, '#fef08a');
      // Blade edge glow
      px(ctx, 6, 2, '#fef3c7'); px(ctx, 9, 3, '#fef3c7');
      // Cross-guard (sunburst)
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(4, 9, 8, 2);
      ctx.fillStyle = '#d97706'; px(ctx, 4, 9, '#d97706'); px(ctx, 11, 9, '#d97706');
      // Hilt
      ctx.fillStyle = '#78350f'; ctx.fillRect(7, 11, 2, 3);
      // Pommel
      ctx.fillStyle = '#ef4444'; ctx.fillRect(7, 14, 2, 1);
      // Sun glow
      px(ctx, 6, 0, '#fef3c7'); px(ctx, 9, 0, '#fef3c7');
    });

    this.registerSprite('item_dragon_armor', (ctx) => {
      // Chestplate
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(3, 3, 10, 9);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(4, 4, 8, 7);
      // Scale pattern
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(4, 5, 2, 1); ctx.fillRect(8, 5, 2, 1);
      ctx.fillRect(5, 7, 2, 1); ctx.fillRect(9, 7, 2, 1);
      ctx.fillRect(4, 9, 2, 1); ctx.fillRect(8, 9, 2, 1);
      // Golden trim
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(3, 3, 10, 1); ctx.fillRect(3, 11, 10, 1);
      ctx.fillRect(3, 3, 1, 9); ctx.fillRect(12, 3, 1, 9);
      // Central dragon emblem
      ctx.fillStyle = '#fde047'; ctx.fillRect(6, 6, 4, 3);
      px(ctx, 7, 6, '#fef08a'); px(ctx, 8, 7, '#fef08a');
      // Shoulder guards
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(2, 3, 2, 3); ctx.fillRect(12, 3, 2, 3);
    });

    this.registerSprite('item_aether_bow', (ctx) => {
      // Bow limb (curved via px)
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(3, 1, 1, 3); ctx.fillRect(2, 3, 1, 3);
      ctx.fillRect(2, 6, 1, 2); ctx.fillRect(3, 8, 1, 3);
      ctx.fillRect(3, 11, 1, 3); ctx.fillRect(4, 13, 1, 2);
      // Limb highlight
      ctx.fillStyle = '#a78bfa';
      px(ctx, 3, 2, '#a78bfa'); px(ctx, 2, 5, '#a78bfa'); px(ctx, 3, 9, '#a78bfa');
      px(ctx, 3, 12, '#a78bfa');
      // String (thin white line)
      ctx.fillStyle = '#e9d5ff';
      ctx.fillRect(9, 1, 1, 14);
      // Arrow nocked
      ctx.fillStyle = '#92400e'; ctx.fillRect(5, 7, 7, 1);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(11, 7, 2, 1); // Arrowhead
      // Magic glow particles
      px(ctx, 1, 0, '#c4b5fd'); px(ctx, 5, 14, '#c4b5fd'); px(ctx, 8, 3, '#e9d5ff');
    });

    this.registerSprite('item_iron_shield', (ctx) => {
      // Shield body
      ctx.fillStyle = '#475569'; ctx.fillRect(3, 2, 10, 12);
      ctx.fillStyle = '#64748b'; ctx.fillRect(4, 3, 8, 10);
      // Border rivets
      ctx.fillStyle = '#94a3b8';
      px(ctx, 3, 3, '#94a3b8'); px(ctx, 12, 3, '#94a3b8');
      px(ctx, 3, 13, '#94a3b8'); px(ctx, 12, 13, '#94a3b8');
      px(ctx, 7, 2, '#94a3b8'); px(ctx, 8, 2, '#94a3b8');
      // Blue gemstone center
      ctx.fillStyle = '#2563eb'; ctx.fillRect(6, 6, 4, 4);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(7, 7, 2, 2);
      // Gem sparkle
      px(ctx, 7, 6, '#93c5fd');
      // Cross pattern
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(7, 3, 2, 3); ctx.fillRect(7, 10, 2, 3);
      ctx.fillRect(4, 7, 3, 2); ctx.fillRect(10, 7, 3, 2);
    });

    // === EXTRA FAUNA ===

    this.registerSprite('species_rabbit', (ctx) => {
      // Ears (long)
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(5, 1, 2, 5); ctx.fillRect(9, 1, 2, 5);
      // Inner ear (pink)
      px(ctx, 5, 2, '#fda4af'); px(ctx, 9, 2, '#fda4af');
      px(ctx, 5, 3, '#fda4af'); px(ctx, 9, 3, '#fda4af');
      // Body
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(4, 6, 8, 6);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(5, 7, 6, 4);
      // Eyes
      px(ctx, 6, 7, '#18181b'); px(ctx, 9, 7, '#18181b');
      // Nose
      px(ctx, 7, 8, '#fda4af'); px(ctx, 8, 8, '#fda4af');
      // Cottontail
      ctx.fillStyle = '#ffffff'; ctx.fillRect(11, 9, 2, 2);
      // Paws
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(5, 12, 2, 2); ctx.fillRect(9, 12, 2, 2);
    });

    this.registerSprite('species_bird', (ctx) => {
      // Body
      ctx.fillStyle = '#2563eb'; ctx.fillRect(5, 6, 6, 5);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(6, 7, 4, 3);
      // Wings spread
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(1, 4, 5, 4); ctx.fillRect(10, 4, 5, 4);
      ctx.fillStyle = '#2563eb'; ctx.fillRect(2, 5, 4, 2); ctx.fillRect(10, 5, 4, 2);
      // Wing tips
      px(ctx, 1, 4, '#1e40af'); px(ctx, 14, 4, '#1e40af');
      // Head
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(6, 4, 4, 3);
      // Eye
      px(ctx, 7, 5, '#18181b');
      // Beak
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(5, 6, 2, 1);
      // Belly (lighter)
      ctx.fillStyle = '#93c5fd'; ctx.fillRect(6, 9, 4, 2);
      // Tail feathers
      ctx.fillStyle = '#1e40af'; ctx.fillRect(9, 10, 3, 2);
    });

    this.registerSprite('species_golem', (ctx) => {
      // Head (blocky)
      ctx.fillStyle = '#475569'; ctx.fillRect(4, 1, 8, 5);
      ctx.fillStyle = '#64748b'; ctx.fillRect(5, 2, 6, 3);
      // Rune eyes (purple glow)
      px(ctx, 6, 3, '#a855f7'); px(ctx, 9, 3, '#a855f7');
      px(ctx, 6, 2, '#c4b5fd'); px(ctx, 9, 2, '#c4b5fd');
      // Body (massive stone)
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 6, 12, 7);
      ctx.fillStyle = '#64748b'; ctx.fillRect(3, 6, 10, 6);
      // Rune on chest
      ctx.fillStyle = '#a855f7'; ctx.fillRect(6, 8, 4, 3);
      px(ctx, 7, 9, '#c4b5fd');
      // Rock cracks
      px(ctx, 4, 7, '#334155'); px(ctx, 10, 9, '#334155'); px(ctx, 6, 11, '#334155');
      // Arms (thick)
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 7, 3, 5); ctx.fillRect(13, 7, 3, 5);
      // Fists
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 11, 3, 2); ctx.fillRect(13, 11, 3, 2);
      // Legs
      ctx.fillStyle = '#334155'; ctx.fillRect(4, 13, 3, 3); ctx.fillRect(9, 13, 3, 3);
    });

    // === KINGDOM BADGES ===

    this.registerSprite('badge_shield', (ctx) => {
      // Shield shape (white, tinted by kingdom color at render time)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, 1, 10, 10);
      ctx.fillRect(4, 11, 8, 2);
      ctx.fillRect(5, 13, 6, 1);
      ctx.fillRect(6, 14, 4, 1);
      ctx.fillRect(7, 15, 2, 1);
      // Border
      ctx.fillStyle = '#d4d4d8';
      ctx.fillRect(3, 1, 10, 1); ctx.fillRect(3, 1, 1, 10);
      ctx.fillRect(12, 1, 1, 10);
    });

    this.registerSprite('badge_crown', (ctx) => {
      // Crown base
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(3, 8, 10, 4);
      // Crown peaks
      ctx.fillRect(3, 4, 2, 5); ctx.fillRect(7, 3, 2, 6); ctx.fillRect(11, 4, 2, 5);
      // Jewels
      px(ctx, 4, 5, '#ef4444'); px(ctx, 8, 4, '#3b82f6'); px(ctx, 12, 5, '#22c55e');
      // Gold shine
      ctx.fillStyle = '#fde047';
      ctx.fillRect(4, 8, 8, 1);
    });

    this.registerSprite('badge_war', (ctx) => {
      // Crossed swords
      ctx.fillStyle = '#ef4444';
      // Sword 1 (diagonal TL to BR)
      ctx.fillRect(2, 2, 2, 2); ctx.fillRect(4, 4, 2, 2); ctx.fillRect(6, 6, 2, 2);
      ctx.fillRect(8, 8, 2, 2); ctx.fillRect(10, 10, 2, 2); ctx.fillRect(12, 12, 2, 2);
      // Sword 2 (diagonal TR to BL)
      ctx.fillRect(12, 2, 2, 2); ctx.fillRect(10, 4, 2, 2); ctx.fillRect(8, 4, 2, 2);
      ctx.fillRect(4, 8, 2, 2); ctx.fillRect(2, 10, 2, 2);
      // Hilts
      ctx.fillStyle = '#92400e';
      ctx.fillRect(1, 1, 2, 1); ctx.fillRect(13, 1, 2, 1);
      ctx.fillRect(1, 12, 2, 2); ctx.fillRect(13, 12, 2, 2);
    });

    this.registerSprite('badge_peace', (ctx) => {
      // Olive branch
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(3, 4, 2, 1); ctx.fillRect(5, 5, 2, 1); ctx.fillRect(7, 6, 2, 1);
      ctx.fillRect(9, 7, 2, 1); ctx.fillRect(11, 8, 2, 1);
      // Leaves
      ctx.fillStyle = '#15803d';
      px(ctx, 3, 3, '#15803d'); px(ctx, 6, 4, '#15803d'); px(ctx, 9, 6, '#15803d');
      px(ctx, 12, 7, '#15803d');
      px(ctx, 4, 5, '#15803d'); px(ctx, 7, 7, '#15803d'); px(ctx, 10, 9, '#15803d');
      // Dove body
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(5, 8, 6, 4);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(6, 9, 4, 2);
      // Wing
      ctx.fillStyle = '#ffffff'; ctx.fillRect(3, 7, 4, 2);
      // Eye
      px(ctx, 6, 9, '#18181b');
      // Beak
      px(ctx, 5, 10, '#f59e0b');
    });

    this.registerSprite('badge_alliance', (ctx) => {
      // Two clasped hands
      // Left hand
      ctx.fillStyle = '#fcd34d'; ctx.fillRect(2, 6, 5, 5);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(3, 5, 4, 2);
      // Right hand
      ctx.fillStyle = '#a7f3d0'; ctx.fillRect(9, 6, 5, 5);
      ctx.fillStyle = '#86efac'; ctx.fillRect(9, 5, 4, 2);
      // Clasped center
      ctx.fillStyle = '#fde68a'; ctx.fillRect(6, 7, 4, 3);
      // Fingers interlock
      px(ctx, 6, 6, '#fbbf24'); px(ctx, 9, 6, '#86efac');
      px(ctx, 7, 10, '#fbbf24'); px(ctx, 8, 10, '#86efac');
    });
  }
}

// Pre-initialize sprite cache
SpriteRegistry.initializeAllTransparentSprites();
