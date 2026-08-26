import { SpeciesType } from '../entities/Species';
import { stableSlot, MARCH_SLOTS } from '../core/Random';

export type SpriteDirection = 'down' | 'up' | 'left' | 'right';
export type EntitySpriteAnimation =
  | 'idle'
  | 'walk'
  | 'attack'
  | 'flee'
  | 'heal'
  | 'gather'
  | 'build'
  | 'carry'
  | 'shoot'
  | 'socialize'
  | 'rest';



/**
 * Visual state for settlement architecture. This deliberately mirrors only
 * information the renderer already owns; simulation rules remain in Building,
 * CivilizationEngine and TechTree.
 */
export interface BuildingSpriteVisualState {
  species?: SpeciesType;
  era?: string;
  level?: number;
  hpRatio?: number;
  staffing?: number;
  extractedGood?: string | null;
  /** 0..1 how prosperous / visually well-maintained the city is. */
  prosperity?: number;
  /** Settlement tier id from City, e.g. camp/hamlet/village/town/city/metropolis. */
  tier?: string;
  /** Raw population for subtle density / skyline differences. */
  population?: number;
  /** Seats of power can carry richer civic detail. */
  isCapital?: boolean;
}
/**
 * Optional appearance state supplied by the renderer. Keeping this interface
 * renderer-agnostic preserves the old getSpeciesSprite() API while allowing
 * Aethoria's real simulation state to become visible on the character.
 */
export interface EntitySpriteVisualState {
  /** Stable per-person text (the entity id) that picks skin, hair and clothes. */
  appearanceSeed?: string;
  profession?: string;
  weaponName?: string;
  weaponCategory?: string;
  armorName?: string;
  isGreatPerson?: boolean;
  greatPersonType?: string | null;
  /**
   * The realm's colour, worn on the helmet crest and flown from the standard.
   *
   * A crest was already drawn but hardcoded crimson, so two armies meeting in the
   * field wore the same plume and the only thing telling them apart was a
   * one-pixel outline. Kingdom colours are a small fixed set, so keying the sprite
   * cache on this costs a handful of extra entries.
   */
  plumeColor?: string;
}

interface HumanoidSpritePalette {
  skin: string;
  skinShade: string;
  hair: string;
  cloth: string;
  clothShade: string;
  trim: string;
  boot: string;
  metal: string;
  accent: string;
  eye: string;
}

/**
 * The people of Aethoria.
 *
 * One species means the crowd has to carry its own variety, so every citizen is
 * dealt a skin from this table by a hash of their id — stable for life, and the
 * same in every replay of a seed. Skin tone and clothing vary independently of
 * each other so the mix on screen never looks like a set of uniformed clones.
 */
const HUMAN_SKIN_TONES: { skin: string; skinShade: string }[] = [
  { skin: '#f1c9a5', skinShade: '#c99a76' },
  { skin: '#e0ac82', skinShade: '#b07f57' },
  { skin: '#c68642', skinShade: '#96602c' },
  { skin: '#8d5524', skinShade: '#6b3e18' },
  { skin: '#5c3a21', skinShade: '#412715' },
  { skin: '#ffdbb4', skinShade: '#d8ab86' },
  { skin: '#d2a679', skinShade: '#a47648' }, // Bronze mediterrâneo
  { skin: '#fff0db', skinShade: '#e0c2a6' }, // Porcelana nórdica
  { skin: '#b87d4b', skinShade: '#875326' }, // Moreno dourado
  { skin: '#3b2219', skinShade: '#24140e' }, // Ébano profundo
  { skin: '#9e5b32', skinShade: '#733e1f' }, // Cobre quente
  { skin: '#f4d0a3', skinShade: '#ca9e6e' }  // Bege trópico
];

const HUMAN_HAIR: string[] = [
  '#2b1a10', '#4a2c17', '#7a4a21', '#b5651d', '#d9c17a', '#8a8a8a', '#1c1c1c',
  '#f7e8aa', '#9e381b', '#8a5a2b', '#d1d5db', '#111827', '#5c3d24', '#3b4252'
];

const HUMAN_OUTFITS: { cloth: string; clothShade: string; trim: string; boot: string }[] = [
  { cloth: '#3b6fd4', clothShade: '#26478a', trim: '#7ba3e8', boot: '#4a3524' }, // Azul
  { cloth: '#b23b3b', clothShade: '#7c2626', trim: '#e07a5f', boot: '#3d2b1f' }, // Vermelho
  { cloth: '#3f7d4f', clothShade: '#285634', trim: '#7ec48c', boot: '#4a3524' }, // Verde
  { cloth: '#c9762b', clothShade: '#8f501a', trim: '#efa957', boot: '#3d2b1f' }, // Laranja
  { cloth: '#6b4b8a', clothShade: '#48305e', trim: '#a887c9', boot: '#3d2b1f' }, // Roxo
  { cloth: '#7a6a52', clothShade: '#544736', trim: '#a8967a', boot: '#4a3524' }, // Linho
  { cloth: '#2f4858', clothShade: '#1d2e39', trim: '#5b7f94', boot: '#2b2018' }, // Ardósia
  { cloth: '#991b1b', clothShade: '#6b1111', trim: '#fca5a5', boot: '#3d2b1f' }, // Carmesim Imperial
  { cloth: '#065f46', clothShade: '#043e2e', trim: '#6ee7b7', boot: '#2b2018' }, // Esmeralda Nobre
  { cloth: '#b45309', clothShade: '#78350f', trim: '#fde68a', boot: '#4a3524' }, // Ocre do Deserto
  { cloth: '#5b21b6', clothShade: '#3b147d', trim: '#ddd6fe', boot: '#2b2018' }, // Violeta Real
  { cloth: '#0e7490', clothShade: '#084b5e', trim: '#a5f3fc', boot: '#3d2b1f' }, // Turquesa Náutico
  { cloth: '#374151', clothShade: '#1f2937', trim: '#9ca3af', boot: '#111827' }, // Carvão Urbano
  { cloth: '#d97706', clothShade: '#92400e', trim: '#fef08a', boot: '#4a3524' }, // Açafrão Dourado
  { cloth: '#9a3412', clothShade: '#6c220a', trim: '#ffedd5', boot: '#3d2b1f' }, // Terracota Rústico
  { cloth: '#e2e8f0', clothShade: '#cbd5e1', trim: '#fbbf24', boot: '#4a3524' }  // Algodão Nobre
];

/**
 * The finished set of looks.
 *
 * Deliberately a fixed, small number. Every sprite is cached per look, per
 * direction, per animation and per frame, so letting each citizen mix their own
 * combination would multiply the cache into thousands of canvases for a variety
 * nobody can see at map zoom. Twelve is enough that a street looks populated.
 */
const HUMAN_SKINS: HumanoidSpritePalette[] = Array.from({ length: 12 }, (_, i) => ({
  ...HUMAN_SKIN_TONES[i % HUMAN_SKIN_TONES.length],
  hair: HUMAN_HAIR[(i * 3) % HUMAN_HAIR.length],
  ...HUMAN_OUTFITS[(i * 5) % HUMAN_OUTFITS.length],
  metal: '#cbd5e1',
  accent: '#fbbf24',
  eye: '#1b1b1b'
}));

/** Assigns a person their look — the same one for life, and on every replay. */
export function humanSkinIndex(seedText: string | undefined): number {
  if (!seedText) return 0;
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) hash = (hash * 31 + seedText.charCodeAt(i)) | 0;
  return Math.abs(hash) % HUMAN_SKINS.length;
}

export class SpriteGenerator {
  private static spriteCache: Map<string, HTMLCanvasElement> = new Map();

  /** True when artwork for this key has been generated. */
  public static has(key: string): boolean {
    return this.spriteCache.has(key);
  }

  public static getSprite(key: string, drawFn: (ctx: CanvasRenderingContext2D) => void, width: number = 16, height: number = 16): HTMLCanvasElement {
    if (this.spriteCache.has(key)) {
      return this.spriteCache.get(key)!;
    }
    if (typeof document === 'undefined') {
      const dummy = {} as HTMLCanvasElement;
      this.spriteCache.set(key, dummy);
      return dummy;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx);
    this.spriteCache.set(key, canvas);
    return canvas;
  }

  /** Helper: set individual pixel */
  private static px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  private static rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  /**
   * A darker or lighter cousin of a hex colour, for the shadow side of anything
   * painted in a realm's own colour. `factor` under 1 darkens, over 1 lightens.
   * Falls through unchanged on anything that is not a six-digit hex, so a palette
   * entry written as `rgba(...)` cannot crash a sprite.
   */
  private static shadeHex(color: string, factor: number): string {
    const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
    if (!hex) return color;
    const n = parseInt(hex[1], 16);
    const ch = (shift: number) =>
      Math.max(0, Math.min(255, Math.round(((n >> shift) & 0xff) * factor)))
        .toString(16).padStart(2, '0');
    return `#${ch(16)}${ch(8)}${ch(0)}`;
  }

  public static getSpeciesSprite(
    species: SpeciesType,
    direction: SpriteDirection = 'down',
    animation: EntitySpriteAnimation = 'idle',
    frame: number = 0
  ): HTMLCanvasElement {
    const normalizedFrame = Math.abs(frame) % 4;
    const key = `species_anim_${species}_${direction}_${animation}_${normalizedFrame}`;
    return this.getSprite(
      key,
      (ctx) => this.drawSpeciesFrame(ctx, species, direction, animation, normalizedFrame),
      24,
      24
    );
  }


  /** Fast, non-allocating string sanitizer replacing slow regex replace in hot render path. */
  private static fastSanitize(value?: string | null): string {
    if (!value) return 'none';
    let res = '';
    const len = Math.min(value.length, 42);
    for (let i = 0; i < len; i++) {
      const code = value.charCodeAt(i);
      if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95) {
        res += value[i];
      } else if (code >= 65 && code <= 90) {
        res += String.fromCharCode(code + 32);
      } else {
        res += '_';
      }
    }
    return res || 'none';
  }

  /**
   * Simulation-aware sprite. The legacy getSpeciesSprite() remains untouched,
   * while this variant layers profession, armor and the entity's real weapon
   * over the same species artwork.
   */
  public static getEntitySprite(
    species: SpeciesType,
    direction: SpriteDirection = 'down',
    animation: EntitySpriteAnimation = 'idle',
    frame: number = 0,
    visual: EntitySpriteVisualState = {}
  ): HTMLCanvasElement {
    const normalizedFrame = Math.abs(frame) % 4;
    const look = humanSkinIndex(visual.appearanceSeed);
    /**
     * Who carries the colours: the soldier standing in the centre of the front
     * rank, which is the same slot `EntityAI.marchStepToward` walks them to. One
     * in twenty, so a warband of any size has about one standard.
     */
    const bearer = visual.profession === 'soldier'
      && !!visual.appearanceSeed
      && stableSlot(visual.appearanceSeed, MARCH_SLOTS) === 0;
    const key = `entity_anim_${species}_${direction}_${animation}_${normalizedFrame}_look${look}_${this.fastSanitize(visual.profession)}_${this.fastSanitize(visual.weaponName)}_${this.fastSanitize(visual.weaponCategory)}_${this.fastSanitize(visual.armorName)}_${this.fastSanitize(visual.plumeColor)}_${bearer ? 'colours' : 'ranker'}_${visual.isGreatPerson ? this.fastSanitize(visual.greatPersonType || 'great') : 'ordinary'}`;

    return this.getSprite(key, (ctx) => {
      this.drawSpeciesFrame(ctx, species, direction, animation, normalizedFrame, Boolean(visual.weaponName), look);
      if (this.isHumanoid(species)) {
        this.drawHumanoidVisualState(ctx, species, direction, animation, normalizedFrame, visual, bearer);
      }
    }, 24, 24);
  }

  private static isHumanoid(species: SpeciesType): boolean {
    return species === SpeciesType.HUMAN;
  }

  private static installDetailedSpeciesSprites(): void {
    for (const species of Object.values(SpeciesType)) {
      this.spriteCache.set(`species_${species}`, this.getSpeciesSprite(species, 'down', 'idle', 1));
    }
  }

  private static drawSpeciesFrame(
    ctx: CanvasRenderingContext2D,
    species: SpeciesType,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number,
    suppressFallbackWeapon: boolean = false,
    look: number = 0
  ): void {
    ctx.clearRect(0, 0, 24, 24);
    ctx.imageSmoothingEnabled = false;
    this.pendingLook = look;

    switch (species) {
      case SpeciesType.HUMAN:
        this.drawHumanoid(ctx, species, direction, animation, frame, suppressFallbackWeapon);
        break;
      case SpeciesType.DEER:
        this.drawDeer(ctx, direction, animation, frame);
        break;
      case SpeciesType.WOLF:
        this.drawWolf(ctx, direction, animation, frame);
        break;
      case SpeciesType.BEAR:
        this.drawBear(ctx, direction, animation, frame);
        break;
      case SpeciesType.DRAGON:
        this.drawDragon(ctx, direction, animation, frame);
        break;
    }
  }

  /** Set for the duration of one frame draw, so the palette knows whose body it is. */
  private static pendingLook = 0;

  private static humanoidPalette(_species: SpeciesType): HumanoidSpritePalette {
    return HUMAN_SKINS[this.pendingLook] ?? HUMAN_SKINS[0];
  }

  private static drawHumanoid(
    ctx: CanvasRenderingContext2D,
    species: SpeciesType,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number,
    suppressFallbackWeapon: boolean = false
  ): void {
    const p = this.humanoidPalette(species);
    const moving = animation === 'walk' || animation === 'flee' || animation === 'carry';
    const attack = animation === 'attack';
    const step = moving ? [-1, 0, 1, 0][frame] : 0;
    const bob = moving ? [0, -1, 0, -1][frame] : 0;

    if (animation === 'heal') {
      this.drawSoftAura(ctx, species, frame, animation);
    }

    if (direction === 'left' || direction === 'right') {
      ctx.save();
      if (direction === 'left') {
        ctx.translate(24, 0);
        ctx.scale(-1, 1);
      }
      this.drawHumanoidSide(ctx, species, p, animation, frame, step, bob, attack, suppressFallbackWeapon);
      ctx.restore();
      return;
    }

    this.drawHumanoidFrontBack(ctx, species, p, direction, animation, frame, step, bob, attack, suppressFallbackWeapon);
  }

  private static drawSoftAura(
    ctx: CanvasRenderingContext2D,
    species: SpeciesType,
    frame: number,
    animation: EntitySpriteAnimation
  ): void {
    const pulse = frame % 2 === 0 ? 0.32 : 0.2;
    const color = `rgba(125, 211, 252, ${pulse})`;

    if (animation === 'heal') {
      this.rect(ctx, 5, 3, 14, 1, color);
      this.rect(ctx, 4, 8, 16, 1, color);
      this.rect(ctx, 5, 18, 14, 1, color);
      this.rect(ctx, 3, 11, 1, 5, color);
      this.rect(ctx, 20, 11, 1, 5, color);
    }
  }

  private static drawHumanoidFrontBack(
    ctx: CanvasRenderingContext2D,
    species: SpeciesType,
    p: HumanoidSpritePalette,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number,
    _step: number,
    bob: number,
    attack: boolean,
    suppressFallbackWeapon: boolean = false
  ): void {
    const back = direction === 'up';
    const isMoving = animation === 'walk' || animation === 'flee' || animation === 'carry';
    const isFleeing = animation === 'flee';
    const isResting = animation === 'rest';
    const isSocializing = animation === 'socialize';
    const isHealing = animation === 'heal';

    // 4-Phase Stride Gait for Front/Back View
    // F0: Left Contact, F1: Left Passing (Up), F2: Right Contact, F3: Right Passing (Up)
    let leftLegX = 9;
    let rightLegX = 13;
    let leftLegY = 17;
    let rightLegY = 17;
    let leftArmY = 0;
    let rightArmY = 0;

    if (isMoving) {
      if (frame === 0) {
        leftLegX = 8;
        rightLegX = 14;
        leftArmY = 1;
        rightArmY = -1;
      } else if (frame === 1) {
        leftLegX = 9;
        rightLegX = 13;
        rightLegY = 16; // Lifted passing foot
        leftArmY = 0;
        rightArmY = 0;
      } else if (frame === 2) {
        leftLegX = 14;
        rightLegX = 8;
        leftArmY = -1;
        rightArmY = 1;
      } else {
        leftLegX = 13;
        leftLegY = 16; // Lifted passing foot
        rightLegX = 9;
        leftArmY = 0;
        rightArmY = 0;
      }
    }

    if (isFleeing) {
      // Frantic sprint arm pump
      leftArmY *= 2;
      rightArmY *= 2;
    }

    // Seated posture for resting
    const top = isResting ? 10 : (7 + bob);

    // Legs rendering
    if (isResting) {
      // Cross-legged seated on ground
      this.rect(ctx, 7, 19, 10, 2, p.clothShade);
      this.rect(ctx, 6, 20, 3, 2, p.boot);
      this.rect(ctx, 15, 20, 3, 2, p.boot);
      this.px(ctx, 6, 21, '#1c1917');
      this.px(ctx, 17, 21, '#1c1917');
    } else {
      // Articulated legs with knee definition & boot soles
      this.rect(ctx, leftLegX, leftLegY, 2, 20 - leftLegY, p.clothShade);
      this.rect(ctx, rightLegX, rightLegY, 2, 20 - rightLegY, p.clothShade);
      this.rect(ctx, leftLegX, 19, 2, 1, p.boot);
      this.rect(ctx, rightLegX, 19, 2, 1, p.boot);
      this.px(ctx, leftLegX, 20, '#1c1917');
      this.px(ctx, rightLegX, 20, '#1c1917');
    }

    // Torso: Tunic with collar shading, belt buckle and trim
    this.rect(ctx, 9, top + 5, 6, 5, p.cloth);
    this.rect(ctx, 9, top + 8, 6, 1, p.clothShade); // Belt line
    this.px(ctx, 11, top + 8, p.accent);            // Belt buckle
    this.rect(ctx, 9, top + 9, 6, 1, p.trim);       // Tunic hem

    // Arms & Hands based on State
    const activeHands = attack || animation === 'gather' || animation === 'build' || animation === 'shoot';
    if (activeHands) {
      // Attack / Action Hand Posture
      this.rect(ctx, 7, top + 5, 2, 2, p.skin);
      this.rect(ctx, 15, top + 4 + (frame < 2 ? -1 : 1), 3, 2, p.skin);
      if (attack && !suppressFallbackWeapon) this.drawHumanoidWeapon(ctx, species, 17, top + 3, 'right', frame);
    } else if (animation === 'carry') {
      // Carrying crate in front of chest
      this.rect(ctx, 8, top + 5, 2, 2, p.skin);
      this.rect(ctx, 14, top + 5, 2, 2, p.skin);
    } else if (isHealing) {
      // Divine healing: arms raised outward with open palms
      this.rect(ctx, 6, top + 3, 2, 2, p.skin);
      this.rect(ctx, 16, top + 3, 2, 2, p.skin);
      this.rect(ctx, 7, top + 4, 2, 1, p.trim);
      this.rect(ctx, 15, top + 4, 2, 1, p.trim);
    } else if (isSocializing) {
      // Raising drink/bread or chatting
      const mugLift = frame % 2 === 0 ? 0 : -2;
      this.rect(ctx, 7, top + 6, 2, 2, p.skin);
      this.rect(ctx, 15, top + 5 + mugLift, 2, 2, p.skin);
      if (!back) {
        // Wooden tankard in hand
        this.rect(ctx, 16, top + 4 + mugLift, 3, 3, '#78350f');
        this.px(ctx, 17, top + 3 + mugLift, '#fef08a'); // Froth
      }
    } else if (isResting) {
      // Hands resting gently in lap
      this.rect(ctx, 9, top + 7, 2, 2, p.skin);
      this.rect(ctx, 13, top + 7, 2, 2, p.skin);
    } else {
      // Natural walking / idle arm swing
      this.rect(ctx, 7, top + 6 + leftArmY, 2, 3, p.skin);
      this.rect(ctx, 15, top + 6 + rightArmY, 2, 3, p.skin);
      // Sleeve cuffs
      this.rect(ctx, 7, top + 5 + leftArmY, 2, 1, p.trim);
      this.rect(ctx, 15, top + 5 + rightArmY, 2, 1, p.trim);
    }

    if (back) {
      // Hair volume from rear with nape shading
      this.rect(ctx, 9, top, 6, 5, p.hair);
      this.rect(ctx, 9, top + 4, 6, 1, p.skinShade);
      return;
    }

    // Head: skin block, hair cap, sideburns, eyes, nose bridge
    this.rect(ctx, 9, top + 1, 6, 4, p.skin);
    this.rect(ctx, 9, top, 6, 2, p.hair);
    this.px(ctx, 9, top + 2, p.hair);
    this.px(ctx, 14, top + 2, p.hair);
    this.px(ctx, 10, top + 3, p.eye);
    this.px(ctx, 13, top + 3, p.eye);
    this.px(ctx, 11, top + 4, p.skinShade); // Nose bridge
  }

  private static drawHumanoidSide(
    ctx: CanvasRenderingContext2D,
    species: SpeciesType,
    p: HumanoidSpritePalette,
    animation: EntitySpriteAnimation,
    frame: number,
    _step: number,
    bob: number,
    attack: boolean,
    suppressFallbackWeapon: boolean = false
  ): void {
    const isMoving = animation === 'walk' || animation === 'flee' || animation === 'carry';
    const isFleeing = animation === 'flee';
    const isResting = animation === 'rest';
    const isSocializing = animation === 'socialize';
    const isHealing = animation === 'heal';

    // Combat Lunge & Flee Lean Mechanics
    const attackLunge = attack ? (frame === 1 || frame === 2 ? 3 : 1) : 0;
    const fleeLean = isFleeing ? 2 : 0;
    const carryLean = animation === 'carry' ? -1 : 0;
    const top = isResting ? 10 : (7 + bob);
    const x = 9 + attackLunge + fleeLean + carryLean;

    // 4-Phase Profile Leg Stride & Foot Plant
    let leadLegX = 10;
    let trailLegX = 10;
    let leadLegY = 17;
    let trailLegY = 17;
    let armSwingX = 0;
    let armSwingY = 0;

    if (isMoving) {
      if (frame === 0) {
        leadLegX = 13;
        trailLegX = 7;
        armSwingX = -1;
        armSwingY = 1;
      } else if (frame === 1) {
        leadLegX = 10;
        trailLegX = 9;
        trailLegY = 16; // Knee bent / passing phase
        armSwingX = 0;
        armSwingY = 0;
      } else if (frame === 2) {
        leadLegX = 7;
        trailLegX = 13;
        armSwingX = 1;
        armSwingY = -1;
      } else {
        leadLegX = 9;
        leadLegY = 16; // Knee bent / passing phase
        trailLegX = 10;
        armSwingX = 0;
        armSwingY = 0;
      }
    }

    if (isFleeing) {
      leadLegX += 1;
      trailLegX -= 1;
      armSwingX *= 2;
    }

    // Legs Profile Rendering
    if (isResting) {
      // Sitting with legs stretched forward
      this.rect(ctx, x, 19, 6, 2, p.clothShade);
      this.rect(ctx, x + 4, 19, 3, 2, p.boot);
      this.px(ctx, x + 6, 20, '#1c1917');
    } else {
      this.rect(ctx, leadLegX, leadLegY, 2, 20 - leadLegY, p.clothShade);
      this.rect(ctx, trailLegX, trailLegY, 2, 20 - trailLegY, p.clothShade);
      this.rect(ctx, leadLegX, 19, 2, 1, p.boot);
      this.rect(ctx, trailLegX, 19, 2, 1, p.boot);
      this.px(ctx, leadLegX + 1, 20, '#1c1917');
      this.px(ctx, trailLegX + 1, 20, '#1c1917');
    }

    // Torso Profile
    this.rect(ctx, x, top + 5, 5, 5, p.cloth);
    this.rect(ctx, x, top + 8, 5, 1, p.clothShade); // Belt
    this.px(ctx, x + 3, top + 8, p.accent);         // Belt buckle
    this.rect(ctx, x, top + 9, 5, 1, p.trim);

    // Head Profile
    this.rect(ctx, x, top + 1, 5, 4, p.skin);
    this.rect(ctx, x, top, 5, 2, p.hair);
    this.px(ctx, x, top + 2, p.hair);
    this.px(ctx, x + 3, top + 3, p.eye);
    this.px(ctx, x + 4, top + 3, p.skinShade); // Nose contour

    // Profile Hands & Action Poses
    const activeHands = attack || animation === 'gather' || animation === 'build' || animation === 'shoot';
    if (activeHands) {
      const reachX = attack ? (frame === 1 || frame === 2 ? 7 : 5) : 5;
      const reachY = attack ? (frame === 0 ? 3 : frame === 1 ? 5 : 6) : 5;
      this.rect(ctx, x + reachX, top + reachY, 3, 2, p.skin);
      if (attack && !suppressFallbackWeapon) this.drawHumanoidWeapon(ctx, species, x + reachX + 2, top + reachY - 2, 'right', frame);
    } else if (animation === 'carry') {
      this.rect(ctx, x + 5, top + 5, 2, 2, p.skin);
    } else if (isHealing) {
      this.rect(ctx, x + 5, top + 3, 2, 2, p.skin);
      this.rect(ctx, x + 4, top + 4, 2, 1, p.trim);
    } else if (isSocializing) {
      const mugLift = frame % 2 === 0 ? 0 : -2;
      this.rect(ctx, x + 5, top + 5 + mugLift, 2, 2, p.skin);
      this.rect(ctx, x + 6, top + 4 + mugLift, 3, 3, '#78350f'); // Wooden tankard
      this.px(ctx, x + 7, top + 3 + mugLift, '#fef08a');
    } else if (isResting) {
      this.rect(ctx, x + 3, top + 7, 2, 2, p.skin);
    } else {
      // Natural walking arm pump in profile
      this.rect(ctx, x + 3 + armSwingX, top + 6 + armSwingY, 2, 3, p.skin);
      this.rect(ctx, x + 2 + armSwingX, top + 5 + armSwingY, 2, 1, p.trim);
    }
  }

  private static drawHumanoidVisualState(
    ctx: CanvasRenderingContext2D,
    species: SpeciesType,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number,
    visual: EntitySpriteVisualState,
    bearer: boolean = false
  ): void {
    const p = this.humanoidPalette(species);
    const profession = visual.profession || 'none';
    const armor = (visual.armorName || '').toLowerCase();
    const hasCustomWeapon = Boolean(visual.weaponName);
    // Crimson is the fallback, not the rule: a soldier with no realm behind them
    // still gets a crest.
    const plume = visual.plumeColor || '#ef4444';

    ctx.save();
    if (direction === 'left') {
      ctx.translate(24, 0);
      ctx.scale(-1, 1);
      direction = 'right';
    }

    const side = direction === 'right';
    const back = direction === 'up';
    const bob = (animation === 'walk' || animation === 'flee' || animation === 'carry') ? [0, -1, 0, -1][frame] : 0;
    const top = 7 + bob;

    // ================= 1. MILITARY SPECIALIZATION: SOLDIERS & GUARDS =================
    if (profession === 'soldier') {
      // 1.1 Distinct Military Helmet with Plume/Crest, in the realm's colour
      this.drawSoldierHelmet(ctx, side, back, top, bob, frame, plume);

      // 1.2 Steel Breastplate & Spiked Pauldrons
      this.drawSoldierCuirass(ctx, side, back, top, bob, p);

      // 1.3 Off-hand Heater Shield with Heraldic Boss
      if (animation !== 'carry') {
        this.drawSoldierShield(ctx, side, back, top, bob, p, frame, animation);
      }

      // 1.4 Standard-Issue Garrison Spear or Shortsword (if no custom weapon)
      if (!hasCustomWeapon) {
        this.drawSoldierDefaultWeapon(ctx, side, back, top, bob, frame, animation);
      }

      // 1.5 The colour party. Drawn last so the pole crosses the body rather than
      // the body hiding the pole.
      if (bearer) {
        this.drawRegimentStandard(ctx, side, back, top, bob, frame, plume);
      }
    } else if (profession === 'archer') {
      // Ranger cowl & quiver
      this.drawArcherGear(ctx, side, back, top, bob, p, frame, animation, hasCustomWeapon);
    } else if (profession === 'king' || profession === 'leader') {
      // Royal Crown & Ermine Robes
      this.drawKingRegalia(ctx, side, back, top, bob, p, frame, animation, hasCustomWeapon);
    } else {
      // ================= 2. CIVILIAN PROFESSIONS =================
      this.drawCivilianProfessionVisualState(ctx, profession, side, back, top, bob, p, animation);

      // Custom Equipped Armor Overlay
      if (armor) {
        this.drawCustomArmorOverlay(ctx, armor, side, back, top, bob, p);
      }
    }

    // ================= 3. ACTIVITY PROPS & WEAPONS =================
    if (animation === 'carry') {
      const lift = frame % 2 === 0 ? 0 : -1;
      this.rect(ctx, side ? 16 : 9, 12 + bob + lift, side ? 6 : 7, 6, '#78350f');
      this.rect(ctx, side ? 17 : 10, 13 + bob + lift, side ? 4 : 5, 4, '#a16207');
      this.rect(ctx, side ? 18 : 11, 14 + bob + lift, side ? 2 : 3, 1, '#d97706');
    }

    if (animation === 'gather') {
      this.drawProfessionTool(ctx, profession, side, frame, bob);
    } else if (animation === 'build') {
      this.drawHammer(ctx, side ? 17 : 16, 8 + bob + (frame < 2 ? -1 : 1), side);
    } else if (animation === 'shoot') {
      this.drawVisualWeapon(ctx, side, frame, visual.weaponCategory || 'ranged', visual.weaponName || 'Bow', species, bob);
    } else if (animation === 'attack' && hasCustomWeapon) {
      this.drawVisualWeapon(ctx, side, frame, visual.weaponCategory || 'melee', visual.weaponName!, species, bob);
    } else if ((animation === 'idle' || animation === 'walk' || animation === 'flee') && hasCustomWeapon) {
      this.drawSheathedWeapon(ctx, side, visual.weaponCategory || 'melee', visual.weaponName!, bob);
    }

    if (animation === 'socialize') {
      this.px(ctx, side ? 20 : 18, 5 + (frame % 2), p.accent);
      this.px(ctx, side ? 21 : 19, 4 + (frame % 2), '#ffffff');
    }

    if (animation === 'rest') {
      this.px(ctx, side ? 19 : 17, 5, '#93c5fd');
      this.rect(ctx, side ? 20 : 18, 3, 2, 1, '#bfdbfe');
      this.rect(ctx, side ? 21 : 19, 1, 2, 1, '#dbeafe');
    }

    // Great-person standing gets a radiant insignia
    if (visual.isGreatPerson) {
      const insignia = visual.greatPersonType === 'hero' ? '#ef4444'
        : visual.greatPersonType === 'scholar' ? '#38bdf8'
        : visual.greatPersonType === 'builder' ? '#f59e0b'
        : '#a78bfa';
      this.px(ctx, side ? 8 : 7, 9 + bob, insignia);
      this.px(ctx, side ? 9 : 8, 8 + bob, '#fef08a');
    }

    ctx.restore();
  }

  /** Soldier Military Helmet with Nasal Guard & High-Contrast Crest Plume */
  private static drawSoldierHelmet(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    frame: number,
    plumeColor: string = '#ef4444'
  ): void {
    const plumeShade = this.shadeHex(plumeColor, 0.62);
    const goldSocket = '#fbbf24';
    const steel = '#94a3b8';
    const steelHighlight = '#f1f5f9';
    const steelShadow = '#475569';

    if (side) {
      // Profile Nasal Helmet
      this.rect(ctx, 8, top, 7, 4, steel);
      this.rect(ctx, 10, top, 4, 1, steelHighlight);
      this.rect(ctx, 13, top + 3, 2, 3, steelShadow); // Cheek guard & nasal
      // Plume mount & arching crest
      this.rect(ctx, 10, top - 1, 3, 1, goldSocket);
      this.rect(ctx, 7, top - 3, 6, 2, plumeColor);
      this.px(ctx, 6 + (frame % 2), top - 2, plumeShade);
    } else if (back) {
      // Rear Closed Helm
      this.rect(ctx, 9, top, 6, 5, steelShadow);
      this.rect(ctx, 10, top, 4, 1, steel);
      this.rect(ctx, 11, top - 1, 2, 1, goldSocket);
      this.rect(ctx, 11, top - 3, 2, 6, plumeColor);
      this.px(ctx, 11 + (frame % 2), top + 3, plumeShade);
    } else {
      // Frontal Conical Helm with T-visor / Nasal Bar
      this.rect(ctx, 9, top, 6, 4, steel);
      this.rect(ctx, 10, top + 1, 4, 1, steelHighlight);
      this.rect(ctx, 11, top + 2, 2, 3, steelShadow); // Nasal bar
      this.rect(ctx, 11, top - 1, 2, 1, goldSocket);
      this.rect(ctx, 11, top - 3, 2, 2, plumeColor);
      this.rect(ctx, 10, top - 4, 4, 1, plumeColor);
    }
  }

  /** Soldier Steel Cuirass & Pauldrons */
  private static drawSoldierCuirass(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    p: HumanoidSpritePalette
  ): void {
    const steel = '#94a3b8';
    const steelLight = '#e2e8f0';
    const steelShadow = '#334155';
    const goldRivet = '#fbbf24';

    if (side) {
      this.rect(ctx, 8, top + 5, 6, 5, steel);
      this.rect(ctx, 10, top + 5, 2, 4, steelLight);
      this.rect(ctx, 8, top + 8, 6, 2, steelShadow);
      this.rect(ctx, 7, top + 4, 3, 3, steelLight); // Pauldron
      this.px(ctx, 7, top + 4, goldRivet);
    } else if (back) {
      this.rect(ctx, 9, top + 5, 6, 5, steelShadow);
      this.rect(ctx, 10, top + 6, 4, 1, '#451a03'); // Leather harness
      this.rect(ctx, 6, top + 4, 3, 3, steel);
      this.rect(ctx, 15, top + 4, 3, 3, steel);
    } else {
      this.rect(ctx, 9, top + 5, 6, 5, steel);
      this.rect(ctx, 11, top + 5, 2, 4, '#f8fafc'); // Specular center ridge
      this.rect(ctx, 9, top + 9, 6, 1, steelShadow);
      this.rect(ctx, 6, top + 4, 3, 3, steelLight);  // Left Pauldron
      this.rect(ctx, 15, top + 4, 3, 3, steelLight); // Right Pauldron
      this.px(ctx, 7, top + 4, goldRivet);
      this.px(ctx, 16, top + 4, goldRivet);
    }
  }

  /** Soldier Off-hand Heater Shield with Combat Guard Postures */
  private static drawSoldierShield(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    p: HumanoidSpritePalette,
    frame: number,
    animation: EntitySpriteAnimation
  ): void {
    const rim = '#e2e8f0';
    const field = '#1e3a8a'; // Royal Navy Shield Field
    const boss = '#fbbf24';  // Gold central boss
    const isAttacking = animation === 'attack' || animation === 'shoot';

    if (side) {
      // Dynamic combat guard: pushes forward during strike frames (F1 & F2)
      const shieldAdvance = isAttacking ? (frame === 1 || frame === 2 ? 2 : 0) : 0;
      const shieldYShift = isAttacking ? (frame === 1 ? -1 : 0) : 0;
      const shieldX = 4 + shieldAdvance;
      const shieldY = top + 3 + shieldYShift;

      this.rect(ctx, shieldX, shieldY, 5, 7, rim);
      this.rect(ctx, shieldX + 1, shieldY + 1, 3, 5, field);
      this.px(ctx, shieldX + 2, shieldY + 3, boss);
      this.px(ctx, shieldX + 2, shieldY + 2, boss);
      this.px(ctx, shieldX + 2, shieldY + 4, boss);
      // Shield edge bevel highlight
      this.rect(ctx, shieldX, shieldY, 1, 7, '#ffffff');
    } else if (back) {
      this.rect(ctx, 4, top + 4, 3, 6, '#64748b');
      this.rect(ctx, 5, top + 5, 2, 4, '#475569');
    } else {
      const shieldYShift = isAttacking ? -1 : 0;
      const shieldX = 4;
      const shieldY = top + 4 + shieldYShift;
      this.rect(ctx, shieldX, shieldY, 4, 7, rim);
      this.rect(ctx, shieldX + 1, shieldY + 1, 2, 5, field);
      this.px(ctx, shieldX + 1, shieldY + 3, boss);
      this.rect(ctx, shieldX, shieldY, 1, 7, '#ffffff');
    }
  }

  /** Standard-Issue Garrison Spear or Shortsword with 4-Phase Thrusting/Lunge Mechanics */
  private static drawSoldierDefaultWeapon(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    frame: number,
    animation: EntitySpriteAnimation
  ): void {
    const woodShaft = '#78350f';
    const steelHead = '#e2e8f0';
    const spearTip = '#ffffff';
    const pennant = '#ef4444';

    if (animation === 'attack') {
      // 4-Phase Expressive Spear Thrust:
      // F0: Coiled back, F1: Explosive Lunge, F2: Maximum Extension & Impact, F3: Snap Recovery
      let reachX = side ? 11 : 10;
      let reachY = top + 5;
      let shaftLen = 8;
      let thrustStreak = false;

      if (frame === 0) {
        reachX = side ? 10 : 9;
        reachY = top + 5;
        shaftLen = 7;
      } else if (frame === 1) {
        reachX = side ? 15 : 13;
        reachY = top + 4;
        shaftLen = 9;
        thrustStreak = true;
      } else if (frame === 2) {
        reachX = side ? 16 : 14;
        reachY = top + 4;
        shaftLen = 10;
      } else {
        reachX = side ? 12 : 11;
        reachY = top + 5;
        shaftLen = 8;
      }

      // Spear shaft
      this.rect(ctx, reachX, reachY, shaftLen, 1, woodShaft);
      // Steel Spearhead
      this.rect(ctx, reachX + shaftLen, reachY - 1, 2, 3, steelHead);
      this.px(ctx, reachX + shaftLen + 2, reachY, spearTip);
      // Crimson Pennant trailing behind spearhead
      this.rect(ctx, reachX + shaftLen - 2, reachY + 1, 2, 1, pennant);

      if (thrustStreak) {
        // Motion puncture smear
        this.rect(ctx, reachX + 2, reachY, 6, 1, 'rgba(255, 255, 255, 0.6)');
      }
      if (frame === 2) {
        // Impact clash spark
        this.px(ctx, reachX + shaftLen + 3, reachY - 1, '#fde047');
        this.px(ctx, reachX + shaftLen + 3, reachY + 1, '#ffffff');
      }
    } else {
      // Tall Upright Garrison Spear swaying with walking bob
      const spearX = side ? 17 : 16;
      this.rect(ctx, spearX, top - 6, 1, 16, woodShaft);
      this.rect(ctx, spearX - 1, top - 7, 3, 2, steelHead);
      this.px(ctx, spearX, top - 8, spearTip);
      this.rect(ctx, spearX + 1, top - 6, 2, 2, pennant);
      this.px(ctx, spearX + 3, top - 5, '#b91c1c');
    }
  }

  /** Regiment Standard / Banner Bearer */
  private static drawRegimentStandard(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    frame: number,
    plumeColor: string = '#ef4444'
  ): void {
    const poleX = side ? 16 : 15;
    const poleY = top - 10 + bob;
    // Wood shaft
    this.rect(ctx, poleX, poleY, 1, 20, '#78350f');
    // Gold finial / spear point
    this.rect(ctx, poleX - 1, poleY - 2, 3, 2, '#fbbf24');
    this.px(ctx, poleX, poleY - 3, '#fef08a');
    // Flowing Banner / Standard
    const wave = (frame % 2 === 0) ? 0 : 1;
    const bannerColor = plumeColor || '#dc2626';
    const bannerShadow = this.shadeHex(bannerColor, 0.7);
    this.rect(ctx, poleX + 1, poleY, 5 + wave, 6, bannerColor);
    this.rect(ctx, poleX + 2, poleY + 1, 3, 4, '#fbbf24'); // Gold heraldic motif
    this.rect(ctx, poleX + 1, poleY + 6, 4 + wave, 2, bannerShadow);
  }

  /** Archer Cowl, Quiver & 4-Phase Archery Mechanics */
  private static drawArcherGear(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    p: HumanoidSpritePalette,
    frame: number,
    animation: EntitySpriteAnimation,
    hasCustomWeapon: boolean
  ): void {
    // Forest Green Ranger Hood with Robin Feather
    this.rect(ctx, side ? 8 : 8, top, side ? 7 : 8, 3, '#14532d');
    this.px(ctx, side ? 7 : 8, top - 1, '#f59e0b'); // Feather
    this.px(ctx, side ? 6 : 7, top - 2, '#ef4444');

    // Quiver across torso
    this.rect(ctx, side ? 7 : 7, top + 4, 2, 6, '#451a03');
    this.px(ctx, side ? 7 : 7, top + 3, '#ef4444'); // Fletching
    this.px(ctx, side ? 8 : 8, top + 2, '#ffffff');

    if (!hasCustomWeapon) {
      const bowX = side ? 17 : 16;
      if (animation === 'shoot') {
        // 4-Phase Archery: F0: Nock, F1: Full Draw Tension, F2: Arrow Snap Release, F3: Draw Next
        if (frame === 0) {
          // Nock arrow
          this.rect(ctx, bowX, top + 1, 1, 10, '#78350f');
          this.rect(ctx, bowX - 1, top + 2, 1, 8, 'rgba(255,255,255,0.7)');
          this.rect(ctx, bowX - 2, top + 5, 5, 1, '#d97706'); // Arrow on rest
        } else if (frame === 1) {
          // Full draw — bow limbs flex, string pulled taut to ear
          this.rect(ctx, bowX + 1, top, 1, 3, '#78350f');
          this.rect(ctx, bowX, top + 3, 1, 5, '#78350f');
          this.rect(ctx, bowX + 1, top + 8, 1, 3, '#78350f');
          // Taut drawn string
          this.rect(ctx, bowX - 3, top + 5, 1, 1, '#ffffff');
          this.rect(ctx, bowX - 4, top + 5, 6, 1, '#d97706'); // Arrow shaft
          this.px(ctx, bowX + 2, top + 5, '#f8fafc');         // Steel arrowhead
        } else if (frame === 2) {
          // Arrow released! Motion blur streak & string snaps forward
          this.rect(ctx, bowX, top + 1, 1, 10, '#78350f');
          this.rect(ctx, bowX + 1, top + 3, 1, 6, 'rgba(255,255,255,0.9)');
          this.rect(ctx, bowX + 3, top + 5, 6, 1, '#ffffff'); // Released Arrow Streak
          this.px(ctx, bowX + 9, top + 5, '#fbbf24');         // Arrow Flash
        } else {
          // Recovery / Hand reaches to quiver
          this.rect(ctx, bowX, top + 2, 1, 9, '#78350f');
          this.rect(ctx, bowX - 1, top + 3, 1, 7, 'rgba(255,255,255,0.5)');
        }
      } else {
        // Longbow held idle / walking
        this.rect(ctx, bowX, top + 1, 1, 10, '#78350f');
        this.px(ctx, bowX - 1, top + 2, '#a16207');
        this.px(ctx, bowX - 1, top + 9, '#a16207');
        this.rect(ctx, bowX - 1, top + 3, 1, 6, 'rgba(255,255,255,0.6)');
      }
    }
  }

  /** King / Supreme Leader Imperial Regalia */
  private static drawKingRegalia(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    p: HumanoidSpritePalette,
    frame: number,
    animation: EntitySpriteAnimation,
    hasCustomWeapon: boolean
  ): void {
    // 3-Point Gold Crown with Ruby & Sapphire
    this.rect(ctx, side ? 8 : 8, top - 2, side ? 6 : 8, 3, '#fbbf24');
    this.px(ctx, side ? 8 : 8, top - 3, '#fbbf24');
    this.px(ctx, side ? 11 : 12, top - 4, '#fbbf24');
    this.px(ctx, side ? 13 : 15, top - 3, '#fbbf24');
    this.px(ctx, side ? 11 : 12, top - 2, '#ef4444'); // Ruby
    this.px(ctx, side ? 9 : 10, top - 2, '#3b82f6');  // Sapphire

    // Royal Purple Mantle with Ermine Fur Collar
    this.rect(ctx, side ? 7 : 8, top + 5, side ? 3 : 8, 7, '#581c87');
    this.rect(ctx, side ? 8 : 8, top + 4, side ? 5 : 8, 2, '#f8fafc');
    this.px(ctx, side ? 9 : 10, top + 5, '#0f172a');
    this.px(ctx, side ? 12 : 14, top + 5, '#0f172a');

    if (!hasCustomWeapon) {
      // Golden Scepter
      this.rect(ctx, side ? 17 : 16, top + 2, 1, 8, '#fbbf24');
      this.px(ctx, side ? 17 : 16, top + 1, '#ef4444');
    }
  }

  /** Civilian Profession Visual Overlays */
  private static drawCivilianProfessionVisualState(
    ctx: CanvasRenderingContext2D,
    profession: string,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    p: HumanoidSpritePalette,
    animation: EntitySpriteAnimation
  ): void {
    if (profession === 'farmer') {
      // Wide Straw Hat & Leather Apron
      this.rect(ctx, side ? 8 : 6, top, side ? 9 : 12, 2, '#fef08a');
      this.rect(ctx, side ? 10 : 8, top - 2, side ? 5 : 8, 2, '#fef08a');
      this.rect(ctx, side ? 10 : 8, top, side ? 5 : 8, 1, '#b45309');
      this.rect(ctx, side ? 9 : 7, top + 2, side ? 7 : 10, 1, 'rgba(0,0,0,0.2)');
      this.rect(ctx, 9, top + 6, 6, 4, '#78350f');
    } else if (profession === 'woodcutter') {
      // Rugged Fur & Leather Vest
      this.rect(ctx, side ? 8 : 8, top + 1, side ? 7 : 8, 1, '#78350f');
      this.rect(ctx, 8, top + 5, 8, 5, '#451a03');
      this.rect(ctx, 8, top + 4, 8, 1, '#d97706');
    } else if (profession === 'miner') {
      // Miner's Helmet with Carbide Lantern
      this.rect(ctx, side ? 8 : 8, top, side ? 7 : 8, 3, '#475569');
      this.rect(ctx, side ? 8 : 7, top + 2, side ? 8 : 10, 1, '#334155');
      this.px(ctx, side ? 14 : 12, top + 1, '#fbbf24');
      this.px(ctx, side ? 15 : 12, top + 2, '#f97316');
      this.px(ctx, side ? 11 : 10, top + 4, '#1e293b');
    } else if (profession === 'builder') {
      // Artisan Leather Apron with Tools
      this.rect(ctx, 8, top + 5, 8, 5, '#92400e');
      this.rect(ctx, side ? 13 : 13, top + 7, 2, 3, '#f59e0b');
      this.rect(ctx, side ? 8 : 9, top + 8, 3, 2, '#78350f');
    } else if (profession === 'scout') {
      // Traveler Hood & Knapsack
      this.rect(ctx, side ? 8 : 7, top, side ? 8 : 10, 4, '#1e293b');
      this.rect(ctx, side ? 7 : 7, top + 4, side ? 9 : 10, 2, '#0f172a');
      this.px(ctx, side ? 11 : 11, top + 4, '#fbbf24');
      this.rect(ctx, side ? 6 : 6, top + 4, 2, 5, '#78350f');
      this.rect(ctx, side ? 5 : 5, top + 3, 3, 2, '#b45309');
    } else if (profession === 'healer') {
      // Sacred White Robes & Golden Sun
      this.rect(ctx, 8, top + 3, 8, 8, '#f8fafc');
      this.rect(ctx, 10, top + 4, 4, 7, '#059669');
      this.px(ctx, 11, top + 6, '#fbbf24');
    }
  }

  /** Custom Equipped Armor Overlay */
  private static drawCustomArmorOverlay(
    ctx: CanvasRenderingContext2D,
    armor: string,
    side: boolean,
    back: boolean,
    top: number,
    bob: number,
    p: HumanoidSpritePalette
  ): void {
    const plate = armor.includes('plate') || armor.includes('shield');
    const iron = armor.includes('iron');
    const steel = armor.includes('steel') || armor.includes('dragon scale');
    const metal = steel ? '#e2e8f0' : iron ? '#94a3b8' : '#64748b';
    const shadow = steel ? '#64748b' : '#475569';

    if (side) {
      this.rect(ctx, 8, 10 + bob, 8, plate ? 6 : 4, shadow);
      this.rect(ctx, 10, 10 + bob, 6, plate ? 5 : 3, metal);
      if (plate) this.rect(ctx, 7, 10 + bob, 3, 3, metal);
    } else {
      this.rect(ctx, 8, 10 + bob, 8, plate ? 6 : 4, shadow);
      this.rect(ctx, 9, 10 + bob, 6, plate ? 5 : 3, metal);
      if (plate) {
        this.rect(ctx, 6, 10 + bob, 3, 3, metal);
        this.rect(ctx, 15, 10 + bob, 3, 3, metal);
      }
    }
    this.px(ctx, side ? 14 : 12, 12 + bob, p.accent);
  }

  private static drawProfessionTool(
    ctx: CanvasRenderingContext2D,
    profession: string,
    side: boolean,
    frame: number,
    bob: number
  ): void {
    const x = side ? 17 : 16;
    const top = 8 + bob;

    if (profession === 'miner') {
      // 4-Phase Miner Choreography:
      // F0: High overhead, F1: Peak tension, F2: Downward strike, F3: Rock penetration & sparks
      let toolX = x;
      let toolY = top;
      if (frame === 0) {
        toolX = side ? x - 1 : x - 1;
        toolY = top - 3;
      } else if (frame === 1) {
        toolX = side ? x - 2 : x - 2;
        toolY = top - 4;
      } else if (frame === 2) {
        toolX = side ? x + 2 : x + 1;
        toolY = top + 4;
      } else {
        toolX = side ? x + 3 : x + 2;
        toolY = top + 5;
      }

      // Pickaxe shaft
      this.rect(ctx, toolX, toolY, 1, 9, '#78350f');
      // Double steel pick head
      this.rect(ctx, toolX - 3, toolY - 1, 7, 2, '#cbd5e1');
      this.px(ctx, toolX - 4, toolY, '#64748b');
      this.px(ctx, toolX + 4, toolY, '#64748b');

      if (frame === 2 || frame === 3) {
        // Rock dust and impact sparks flying from stone face
        this.px(ctx, toolX + 5, toolY + 2, '#fde047');
        this.px(ctx, toolX + 4, toolY + 4, '#cbd5e1');
        this.px(ctx, toolX + 6, toolY + 1, '#ffffff');
      }
      return;
    }

    if (profession === 'woodcutter') {
      // 4-Phase Woodcutter Choreography:
      // F0: Sideways windup, F1: Powerful chop swing, F2: Tree trunk bite, F3: Axe recoil
      let toolX = x;
      let toolY = top;
      if (frame === 0) {
        toolX = side ? x - 2 : x - 2;
        toolY = top - 2;
      } else if (frame === 1) {
        toolX = side ? x + 1 : x;
        toolY = top + 1;
      } else if (frame === 2) {
        toolX = side ? x + 3 : x + 2;
        toolY = top + 3;
      } else {
        toolX = side ? x + 1 : x + 1;
        toolY = top + 2;
      }

      // Double-bitted axe handle & blade
      this.rect(ctx, toolX, toolY + 1, 1, 9, '#78350f');
      this.rect(ctx, toolX - 2, toolY - 1, 6, 4, '#94a3b8');
      this.rect(ctx, toolX - 2, toolY, 2, 2, '#e2e8f0');
      this.rect(ctx, toolX + 2, toolY, 2, 2, '#e2e8f0');

      if (frame === 2) {
        // Woodchips flying
        this.px(ctx, toolX + 5, toolY - 1, '#d97706');
        this.px(ctx, toolX + 6, toolY + 1, '#b45309');
      }
      return;
    }

    if (profession === 'farmer') {
      // 4-Phase Farmer Choreography:
      // F0: Arm back, F1: Crescent sweep, F2: Full crop slice, F3: Grain bundle gather
      let toolX = x;
      let toolY = top;
      if (frame === 0) {
        toolX = side ? x - 2 : x - 2;
        toolY = top - 1;
      } else if (frame === 1) {
        toolX = side ? x + 1 : x;
        toolY = top + 2;
      } else if (frame === 2) {
        toolX = side ? x + 3 : x + 2;
        toolY = top + 4;
      } else {
        toolX = side ? x + 1 : x;
        toolY = top + 2;
      }

      // Curved Reaping Scythe
      this.rect(ctx, toolX, toolY + 1, 1, 9, '#92400e');
      this.rect(ctx, toolX + 1, toolY - 1, 5, 2, '#e2e8f0');
      this.px(ctx, toolX + 6, toolY, '#94a3b8');
      this.px(ctx, toolX + 5, toolY + 1, '#cbd5e1');

      if (frame === 2) {
        // Wheat stalks cutting
        this.px(ctx, toolX + 6, toolY + 2, '#86efac');
        this.px(ctx, toolX + 7, toolY + 1, '#fef08a');
      }
      return;
    }

    if (profession === 'scout' || profession === 'none') {
      // Forager / Scout: Reaching to ground and plucking herbs
      if (frame === 0) {
        this.rect(ctx, x, top + 3, 2, 4, '#78350f');
      } else if (frame === 1 || frame === 2) {
        this.rect(ctx, x + 1, top + 6, 2, 3, '#78350f');
        this.px(ctx, x + 2, top + 7, '#ef4444'); // Herb / Berry
        this.px(ctx, x + 3, top + 6, '#86efac');
      } else {
        this.rect(ctx, x, top + 2, 2, 4, '#78350f');
      }
      return;
    }

    // Builder / Crafter Hammer
    this.drawHammer(ctx, x, top, side, frame);
  }

  /** 4-Phase Artisan Hammering (Tap-tap rhythm) */
  private static drawHammer(ctx: CanvasRenderingContext2D, x: number, top: number, _side: boolean, frame: number = 0): void {
    let hammerY = top;
    if (frame === 0) hammerY = top - 2;      // Lifted high
    else if (frame === 1) hammerY = top + 4; // Hard strike
    else if (frame === 2) hammerY = top + 1; // Rebound tap
    else hammerY = top;                      // Inspect

    this.rect(ctx, x, hammerY + 2, 1, 8, '#78350f');
    this.rect(ctx, x - 2, hammerY, 6, 3, '#94a3b8');
    this.rect(ctx, x + 2, hammerY + 1, 2, 2, '#cbd5e1');

    if (frame === 1) {
      // Construction dust / spark
      this.px(ctx, x + 4, hammerY + 2, '#fbbf24');
      this.px(ctx, x - 3, hammerY + 2, '#e2e8f0');
    }
  }

  private static drawVisualWeapon(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    frame: number,
    category: string,
    name: string,
    species: SpeciesType,
    bob: number
  ): void {
    const lower = name.toLowerCase();
    const steel = lower.includes('steel') || lower.includes('sunfire') || lower.includes('aether');
    const iron = lower.includes('iron') || lower.includes('crossbow') || lower.includes('halberd');
    const blade = steel ? '#f8fafc' : iron ? '#cbd5e1' : '#d6d3d1';
    const accent = lower.includes('sunfire') ? '#facc15'
      : lower.includes('aether') ? '#38bdf8'
      : '#fbbf24';
    const x = side ? 17 : 16;
    const y = 8 + bob;

    // 1. FIREARMS (Musket, Blunderbuss, Rifle, Cannon) with Realistic Recoil Kick
    if (lower.includes('musket') || lower.includes('rifle')) {
      const recoilX = frame === 1 ? -1 : 0;
      const recoilY = frame === 1 ? -1 : 0;
      const wx = x + recoilX;
      const wy = y + recoilY;

      // Stock
      this.rect(ctx, wx - 2, wy + 4, 5, 2, '#5c2306');
      // Barrel
      this.rect(ctx, wx + 3, wy + 3, 7, 1, '#94a3b8');
      // Muzzle & Trigger
      this.px(ctx, wx + 1, wy + 5, '#cbd5e1');

      if (frame === 1) {
        // Explosive Muzzle Flash & White Gunsmoke Burst
        this.rect(ctx, wx + 10, wy + 2, 4, 3, '#fbbf24');
        this.rect(ctx, wx + 12, wy + 1, 3, 4, '#f97316');
        this.rect(ctx, wx + 14, wy + 1, 4, 3, 'rgba(226,232,240,0.85)');
      } else if (frame === 2) {
        // Lingering barrel smoke
        this.px(ctx, wx + 10, wy + 1, '#cbd5e1');
        this.px(ctx, wx + 11, wy, '#94a3b8');
      }
      return;
    }
    if (lower.includes('blunderbuss')) {
      const recoilX = frame === 1 ? -2 : 0;
      const wx = x + recoilX;
      // Stock & Flared Brass Barrel
      this.rect(ctx, wx - 1, y + 4, 4, 2, '#78350f');
      this.rect(ctx, wx + 3, y + 3, 4, 2, '#d97706');
      this.rect(ctx, wx + 7, y + 2, 3, 4, '#fbbf24');
      if (frame === 1) {
        this.rect(ctx, wx + 10, y, 6, 6, 'rgba(249,115,22,0.85)');
        this.rect(ctx, wx + 12, y + 1, 4, 4, '#fde047');
      }
      return;
    }
    if (lower.includes('cannon') || lower.includes('field gun')) {
      const recoilX = frame === 1 ? -3 : 0;
      const wx = x + recoilX;
      // Heavy Carriage Wheels & Barrel
      this.rect(ctx, wx - 2, y + 5, 5, 5, '#451a03');
      this.px(ctx, wx, y + 7, '#d97706');
      const barrelColor = lower.includes('bronze') ? '#b45309' : '#334155';
      this.rect(ctx, wx - 1, y + 2, 9, 3, barrelColor);
      this.rect(ctx, wx + 8, y + 1, 2, 5, '#1e293b');
      if (frame === 1) {
        this.rect(ctx, wx + 10, y - 1, 6, 8, '#ef4444');
        this.rect(ctx, wx + 13, y, 5, 6, '#f59e0b');
      }
      return;
    }

    // 2. PRIMITIVE WEAPONS (Stone Club, Sling)
    if (lower.includes('club')) {
      let clubY = y;
      if (frame === 0) clubY = y - 3;
      else if (frame === 1) clubY = y + 3;
      else if (frame === 2) clubY = y + 4;
      this.rect(ctx, x, clubY + 3, 2, 7, '#78350f');
      this.rect(ctx, x - 2, clubY - 1, 5, 5, '#64748b');
      this.rect(ctx, x - 1, clubY, 3, 3, '#94a3b8');
      this.px(ctx, x - 2, clubY - 1, '#475569');
      return;
    }
    if (lower.includes('sling')) {
      const slingSpin = frame % 2 === 0 ? 0 : 2;
      this.rect(ctx, x, y + 2, 1, 6, '#78350f');
      this.rect(ctx, x + 1, y + 5 + slingSpin, 3, 3, '#b45309');
      this.px(ctx, x + 2, y + 6 + slingSpin, '#94a3b8');
      return;
    }

    // 3. LEGENDARY WEAPONS SPECIAL VISUAL EFFECTS
    if (lower.includes('sunfire')) {
      let slashX = x;
      let slashY = y;
      if (frame === 0) { slashX = x - 1; slashY = y - 2; }
      else if (frame === 1) { slashX = x + 3; slashY = y + 1; }
      else if (frame === 2) { slashX = x + 2; slashY = y + 3; }

      this.rect(ctx, slashX, slashY + 3, 2, 8, '#f59e0b');
      this.rect(ctx, slashX + 1, slashY - 1, 2, 9, '#fef08a');
      this.rect(ctx, slashX, slashY + 7, 4, 1, '#d97706');
      // Fire aura particles
      this.px(ctx, slashX + 2, slashY + 1 + (frame % 2), '#ef4444');
      this.px(ctx, slashX + 3, slashY + 3, '#f97316');
      this.px(ctx, slashX + 1, slashY - 2, '#ffffff');

      if (frame === 1) {
        // Blazing slash trail
        this.rect(ctx, slashX + 3, slashY, 6, 2, 'rgba(251, 191, 36, 0.7)');
      }
      return;
    }
    if (lower.includes('aether')) {
      this.rect(ctx, x, y - 1, 2, 11, '#0284c7');
      this.rect(ctx, x + 1, y, 1, 9, '#38bdf8');
      if (frame === 1 || frame === 2) {
        // Energy arrow release
        this.rect(ctx, x + 2, y + 4, 8, 1, '#e0f2fe');
        this.px(ctx, x + 10, y + 4, '#ffffff');
      }
      this.px(ctx, x, y - 2, '#7dd3fc');
      this.px(ctx, x, y + 10, '#7dd3fc');
      return;
    }

    // 4. BOWS & CROSSBOWS
    if (category === 'ranged' || lower.includes('bow') || lower.includes('crossbow')) {
      if (frame === 0) {
        // Nocking arrow
        this.rect(ctx, x, y, 1, 10, '#78350f');
        this.rect(ctx, x + 1, y + 1, 1, 2, '#d9f99d');
        this.rect(ctx, x + 1, y + 7, 1, 2, '#d9f99d');
        this.rect(ctx, x - 1, y + 4, 6, 1, blade);
      } else if (frame === 1) {
        // Full draw
        this.rect(ctx, x + 1, y - 1, 1, 3, '#78350f');
        this.rect(ctx, x, y + 2, 1, 6, '#78350f');
        this.rect(ctx, x + 1, y + 8, 1, 3, '#78350f');
        this.rect(ctx, x - 3, y + 4, 7, 1, blade);
      } else if (frame === 2) {
        // Snap release with arrow streak
        this.rect(ctx, x, y, 1, 10, '#78350f');
        this.rect(ctx, x + 3, y + 4, 7, 1, '#ffffff');
        this.px(ctx, x + 9, y + 4, accent);
      } else {
        this.rect(ctx, x, y, 1, 10, '#78350f');
      }
      return;
    }

    // 5. POLEARMS, HALBERDS & SPEARS
    if (lower.includes('halberd') || lower.includes('spear')) {
      let reachX = x;
      let reachY = y;
      if (frame === 0) { reachX = x - 1; reachY = y + 1; }
      else if (frame === 1) { reachX = x + 3; reachY = y; }
      else if (frame === 2) { reachX = x + 4; reachY = y; }
      else { reachX = x + 1; reachY = y + 1; }

      this.rect(ctx, reachX, reachY, 1, 13, '#78350f');
      this.rect(ctx, reachX + 1, reachY, 5, 2, blade);
      this.px(ctx, reachX + 6, reachY - 1, '#ffffff');
      if (frame === 1 || frame === 2) {
        this.rect(ctx, reachX + 2, reachY, 4, 1, 'rgba(255,255,255,0.6)');
      }
      return;
    }

    // 6. SWORDS & BLADES (4-Phase Diagonal Slash with Motion Blur Trail)
    let slashX = x;
    let slashY = y;
    if (frame === 0) {
      // Windup high
      slashX = x - 1;
      slashY = y - 3;
    } else if (frame === 1) {
      // Explosive downward slice
      slashX = x + 3;
      slashY = y + 1;
    } else if (frame === 2) {
      // Follow-through low
      slashX = x + 2;
      slashY = y + 4;
    } else {
      // Guard stance
      slashX = x;
      slashY = y;
    }

    // Hilt & Blade
    this.rect(ctx, slashX, slashY + 3, 1, 8, '#78350f');
    this.rect(ctx, slashX + 1, slashY + 1, 2, 7, blade);
    this.rect(ctx, slashX, slashY + 6, 4, 1, accent);
    this.px(ctx, slashX + 2, slashY, '#ffffff');

    if (frame === 1) {
      // Luminous blade slash trail
      this.rect(ctx, slashX + 2, slashY - 1, 4, 2, 'rgba(255, 255, 255, 0.65)');
    }
  }


  private static drawSheathedWeapon(
    ctx: CanvasRenderingContext2D,
    side: boolean,
    category: string,
    name: string,
    bob: number
  ): void {
    const lower = name.toLowerCase();
    const x = side ? 7 : 6;
    const y = 11 + bob;
    if (category === 'ranged' || lower.includes('bow') || lower.includes('crossbow')) {
      this.rect(ctx, x, y - 3, 1, 10, '#78350f');
      this.px(ctx, x + 1, y - 2, '#bef264');
      this.px(ctx, x + 1, y + 5, '#bef264');
      return;
    }
    this.rect(ctx, x, y, 2, 9, '#451a03');
    this.rect(ctx, x, y, 1, 6, '#cbd5e1');
    this.px(ctx, x + 1, y + 6, '#fbbf24');
  }

  private static drawHumanoidWeapon(
    ctx: CanvasRenderingContext2D,
    species: SpeciesType,
    x: number,
    y: number,
    direction: 'right',
    frame: number
  ): void {
    const reach = frame < 2 ? 1 : 0;
    this.rect(ctx, x, y + 4, 6 + reach, 1, '#fef3c7');
    this.rect(ctx, x + 4 + reach, y + 2, 2, 5, '#fde047');
    this.rect(ctx, x + 5 + reach, y + 1, 1, 2, '#ffffff');
  }

  private static drawDeer(
    ctx: CanvasRenderingContext2D,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number
  ): void {
    // Fleeing deer bound: body goes up and down
    const bound = animation === 'flee' ? (frame % 2 === 0 ? -2 : 0) : 0;
    // Walk step
    const step = animation === 'walk' || animation === 'flee' ? [-1, 0, 1, 0][frame] : 0;
    // Idle grazing: head goes down on frames 2/3
    const graze = animation === 'idle' && frame > 1 ? 3 : 0;
    
    if (direction === 'left' || direction === 'right') {
      ctx.save();
      if (direction === 'left') { ctx.translate(24, 0); ctx.scale(-1, 1); }
      // Body
      this.rect(ctx, 5, 10 + bound, 12, 6, '#d97706');
      this.rect(ctx, 6, 11 + bound, 10, 3, '#f59e0b');
      // Head and neck (lowers when grazing)
      this.rect(ctx, 14, 6 + graze + bound, 6, 5, '#d97706');
      this.rect(ctx, 15, 7 + graze + bound, 4, 2, '#fbbf24');
      this.px(ctx, 18, 8 + graze + bound, '#18181b');
      // Antlers
      this.rect(ctx, 15, 3 + graze + bound, 1, 4, '#92400e');
      this.rect(ctx, 18, 3 + graze + bound, 1, 4, '#92400e');
      this.px(ctx, 14, 3 + graze + bound, '#92400e'); this.px(ctx, 19, 3 + graze + bound, '#92400e');
      // Spots
      this.px(ctx, 6, 11 + bound, '#fde68a'); this.px(ctx, 9, 12 + bound, '#fde68a'); this.px(ctx, 12, 11 + bound, '#fde68a');
      // Legs
      this.rect(ctx, 6 + Math.min(0, step), 16 + bound, 2, 6 - bound, '#92400e');
      this.rect(ctx, 13 + Math.max(0, step), 16 + bound, 2, 6 - bound, '#92400e');
      // Tail
      this.rect(ctx, 4, 9 + bound, 2, 2, '#fef3c7');
      ctx.restore();
      return;
    }

    this.rect(ctx, 7, 9 + bound, 10, 7, '#d97706');
    this.rect(ctx, 8, 10 + bound, 8, 3, '#f59e0b');
    this.rect(ctx, 8, 5 + graze + bound, 8, 6, '#d97706');
    this.rect(ctx, 7, 2 + graze + bound, 1, 5, '#92400e');
    this.rect(ctx, 16, 2 + graze + bound, 1, 5, '#92400e');
    this.px(ctx, 9, 7 + graze + bound, '#18181b'); this.px(ctx, 14, 7 + graze + bound, '#18181b');
    this.px(ctx, 12, 9 + graze + bound, '#78350f');
    this.rect(ctx, 8 + Math.min(0, step), 16 + bound, 2, 6 - bound, '#92400e');
    this.rect(ctx, 14 + Math.max(0, step), 16 + bound, 2, 6 - bound, '#92400e');
  }

  private static drawWolf(
    ctx: CanvasRenderingContext2D,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number
  ): void {
    // Wolf stalks: lowers body when attacking or walking
    const stalk = (animation === 'walk' || animation === 'attack') ? 2 : 0;
    const lunge = animation === 'attack' ? (frame < 2 ? 3 : -1) : 0;
    const step = animation === 'walk' || animation === 'flee' ? [-2, 0, 2, 0][frame] : 0;

    if (direction === 'left' || direction === 'right') {
      ctx.save();
      if (direction === 'left') { ctx.translate(24, 0); ctx.scale(-1, 1); }
      this.rect(ctx, 4, 11 + stalk, 14, 5, '#52525b');
      this.rect(ctx, 5, 12 + stalk, 12, 3, '#71717a');
      this.rect(ctx, 15 + lunge, 8 + stalk, 6, 5, '#52525b');
      this.px(ctx, 19 + lunge, 9 + stalk, '#ef4444'); // glowing red eye
      this.rect(ctx, 19 + lunge, 10 + stalk, 3, 2, '#3f3f46');
      this.rect(ctx, 16 + lunge, 6 + stalk, 2, 2, '#52525b');
      this.rect(ctx, 6 + Math.min(0, step), 16 + stalk, 2, 6 - stalk, '#27272a');
      this.rect(ctx, 14 + Math.max(0, step) + lunge, 16 + stalk, 2, 6 - stalk, '#27272a');
      this.rect(ctx, 2, 10 + stalk, 4, 2, '#3f3f46'); // tail
      ctx.restore();
      return;
    }

    this.rect(ctx, 6, 10 + stalk, 12, 6, '#52525b');
    this.rect(ctx, 8, 6 + stalk, 8, 6, '#52525b');
    this.rect(ctx, 7, 4 + stalk, 2, 2, '#52525b');
    this.rect(ctx, 15, 4 + stalk, 2, 2, '#52525b');
    this.px(ctx, 10, 8 + stalk, '#ef4444'); this.px(ctx, 13, 8 + stalk, '#ef4444');
    this.rect(ctx, 8 + Math.min(0, step), 16 + stalk, 2, 6 - stalk, '#27272a');
    this.rect(ctx, 14 + Math.max(0, step), 16 + stalk, 2, 6 - stalk, '#27272a');
  }

  private static drawBear(
    ctx: CanvasRenderingContext2D,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number
  ): void {
    const lumber = animation === 'walk' ? (frame % 2 === 0 ? 1 : -1) : 0;
    // Rearing up on attack
    const rear = animation === 'attack' ? -4 : 0;
    
    if (direction === 'left' || direction === 'right') {
      ctx.save();
      if (direction === 'left') { ctx.translate(24, 0); ctx.scale(-1, 1); }
      // Rearing rotates the whole body up
      this.rect(ctx, 3, 8 + rear, 15, 10 - rear/2, '#451a03');
      this.rect(ctx, 16, 6 + rear * 1.5, 7, 6, '#451a03');
      this.px(ctx, 20, 7 + rear * 1.5, '#18181b');
      this.rect(ctx, 17, 4 + rear * 1.5, 2, 2, '#78350f');
      this.rect(ctx, 4 + lumber, 18, 3, 5, '#1c1917');
      this.rect(ctx, 14 - lumber, 18, 3, 5, '#1c1917');
      if (animation === 'attack') {
        // Claws out
        this.rect(ctx, 18, 12 + rear, 4, 1, '#cbd5e1');
        this.rect(ctx, 18, 14 + rear, 4, 1, '#cbd5e1');
      }
      ctx.restore();
      return;
    }

    this.rect(ctx, 4, 8 + rear, 16, 12 - rear/2, '#451a03');
    this.rect(ctx, 7, 5 + rear * 1.5, 10, 8, '#451a03');
    this.rect(ctx, 6, 3 + rear * 1.5, 3, 3, '#78350f');
    this.rect(ctx, 15, 3 + rear * 1.5, 3, 3, '#78350f');
    this.px(ctx, 9, 8 + rear * 1.5, '#18181b'); this.px(ctx, 14, 8 + rear * 1.5, '#18181b');
    this.rect(ctx, 6 + lumber, 20, 3, 4, '#1c1917');
    this.rect(ctx, 15 - lumber, 20, 3, 4, '#1c1917');
    
    if (animation === 'attack') {
      this.rect(ctx, 4, 12 + rear, 4, 2, '#cbd5e1');
      this.rect(ctx, 16, 12 + rear, 4, 2, '#cbd5e1');
    }
  }

  private static drawDragon(
    ctx: CanvasRenderingContext2D,
    direction: SpriteDirection,
    animation: EntitySpriteAnimation,
    frame: number
  ): void {
    // Sine wave wing flapping: majestic deep flaps when walking/fleeing/attacking
    const flap = Math.sin(frame * Math.PI) * 5;
    
    if (direction === 'left' || direction === 'right') {
      ctx.save();
      if (direction === 'left') { ctx.translate(24, 0); ctx.scale(-1, 1); }
      // Body & Tail
      this.rect(ctx, 2, 10, 16, 6, '#b91c1c');
      this.rect(ctx, 1, 11, 6, 2, '#ef4444');
      // Neck & Head
      this.rect(ctx, 15, 4, 4, 8, '#b91c1c');
      this.rect(ctx, 17, 3, 6, 4, '#dc2626');
      this.px(ctx, 20, 4, '#fef08a');
      // Horns
      this.rect(ctx, 16, 0, 2, 4, '#fef3c7');
      // Wing
      this.rect(ctx, 6, 2 + flap, 10, 8 - flap, '#991b1b');
      this.rect(ctx, 8, 4 + flap, 6, 4, '#fca5a5');
      // Legs
      this.rect(ctx, 4, 16, 3, 6, '#7f1d1d');
      this.rect(ctx, 13, 16, 3, 6, '#7f1d1d');
      
      // Fire breath
      if (animation === 'attack') {
        const fireReach = frame * 4;
        this.rect(ctx, 23, 4, 4 + fireReach, 3, '#f97316');
        this.rect(ctx, 24 + fireReach, 5, 3, 1, '#fde047');
      }
      ctx.restore();
      return;
    }

    this.rect(ctx, 6, 10, 12, 8, '#b91c1c');
    this.rect(ctx, 9, 3, 6, 8, '#b91c1c');
    this.rect(ctx, 10, 5, 4, 2, '#dc2626');
    this.px(ctx, 11, 4, '#fef08a'); this.px(ctx, 12, 4, '#fef08a');
    this.rect(ctx, 8, 0, 2, 4, '#fef3c7');
    this.rect(ctx, 14, 0, 2, 4, '#fef3c7');
    // Wings
    this.rect(ctx, 0, 2 + flap, 8, 10 - flap/2, '#991b1b');
    this.rect(ctx, 16, 2 + flap, 8, 10 - flap/2, '#991b1b');
    // Legs
    this.rect(ctx, 6, 18, 3, 4, '#7f1d1d');
    this.rect(ctx, 15, 18, 3, 4, '#7f1d1d');
    
    // Fire breath
    if (animation === 'attack') {
      const fireSpread = frame * 3;
      this.rect(ctx, 10 - fireSpread, 7, 4 + fireSpread * 2, 6, '#f97316');
      this.rect(ctx, 11 - fireSpread, 13, 2 + fireSpread * 2, 2, '#fde047');
    }
  }



  /**
   * Builds a culture-aware settlement sprite without changing any building rule.
   * Existing `b_*` and `b_*_{era}` keys remain the source artwork, while this
   * method composes readable visual state on top of them.
   */
  public static getBuildingSprite(type: string, visual: BuildingSpriteVisualState = {}): HTMLCanvasElement {
    const safe = (value?: string | null) => (value || 'none').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    const era = safe(visual.era || 'stone');
    const level = Math.max(1, Math.min(3, Math.round(visual.level || 1)));
    const hp = Math.max(0, Math.min(1, visual.hpRatio ?? 1));
    const staffing = Math.max(0, Math.min(1, visual.staffing ?? 1));
    const prosperity = Math.max(0, Math.min(1, visual.prosperity ?? 0.5));
    const tier = safe(visual.tier || 'camp');
    const populationBand = (visual.population ?? 0) >= 120 ? 'metro'
      : (visual.population ?? 0) >= 65 ? 'city'
      : (visual.population ?? 0) >= 24 ? 'town'
      : 'small';
    const prosperityBand = prosperity >= 0.74 ? 'prosperous' : prosperity <= 0.34 ? 'strained' : 'stable';
    const damageBand = hp <= 0.32 ? 'ruined' : hp <= 0.68 ? 'damaged' : hp <= 0.9 ? 'worn' : 'healthy';
    const staffingBand = staffing < 0.34 ? 'idle' : staffing < 0.7 ? 'thin' : 'full';
    const species = visual.species ?? SpeciesType.HUMAN;
    const key = `building_visual_${safe(type)}_${era}_${species}_${level}_${tier}_${populationBand}_${prosperityBand}_${visual.isCapital ? 'capital' : 'normal'}_${damageBand}_${staffingBand}_${safe(visual.extractedGood)}`;

    return this.getSprite(key, (ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.imageSmoothingEnabled = false;

      const eraKey = `b_${type}_${era}`;
      const baseKey = this.spriteCache.has(eraKey) ? eraKey
        : this.spriteCache.has(`b_${type}`) ? `b_${type}`
        : 'b_house';
      const source = this.spriteCache.get(baseKey);
      if (source) ctx.drawImage(source, 0, 0, 16, 16);

      const hasEraArtwork = baseKey === eraKey;
      this.drawBuildingEraAccent(ctx, type, era, hasEraArtwork);
      this.drawBuildingCultureAccent(ctx, type, species, era);
      this.drawBuildingTierAccent(ctx, type, tier, level, species, visual.population ?? 0);
      this.drawBuildingProsperityState(ctx, type, prosperity, tier);
      this.drawBuildingCapitalAccent(ctx, type, species, !!visual.isCapital, tier);
      this.drawBuildingLevelAccent(ctx, type, level, species);
      this.drawBuildingLandmarkAccent(ctx, type, species, era, tier, prosperity, !!visual.isCapital);
      this.drawBuildingIndustryMarker(ctx, type, visual.extractedGood || null);
      this.drawBuildingStaffingState(ctx, type, staffing);
      this.drawBuildingDamageState(ctx, type, hp);
    }, 16, 16);
  }

  private static drawBuildingEraAccent(ctx: CanvasRenderingContext2D, type: string, era: string, hasEraArtwork: boolean): void {
    // Bespoke era sprites are already richer than a generic overlay. Only add
    // generic material language to buildings that do not yet have one.
    if (hasEraArtwork) return;
    const industrial = new Set(['factory', 'refinery', 'oil_well', 'stock_exchange', 'bank', 'workshop', 'smithy', 'mine', 'port', 'harbor']);
    const civic = new Set(['town_center', 'palace', 'keep', 'academy', 'library', 'temple', 'bank', 'stock_exchange', 'great_library', 'colosseum', 'monument']);

    if (era === 'bronze') {
      this.px(ctx, 2, 13, '#d97706'); this.px(ctx, 13, 13, '#f59e0b');
      if (civic.has(type)) this.rect(ctx, 5, 2, 6, 1, '#b45309');
      return;
    }
    if (era === 'iron') {
      this.rect(ctx, 1, 14, 14, 1, '#475569');
      this.px(ctx, 2, 5, '#cbd5e1'); this.px(ctx, 13, 5, '#94a3b8');
      return;
    }
    if (era === 'classical') {
      if (civic.has(type)) {
        this.rect(ctx, 2, 13, 12, 1, '#e7e5e4');
        this.px(ctx, 4, 5, '#fbbf24'); this.px(ctx, 11, 5, '#fbbf24');
      }
      return;
    }
    if (era === 'industrial') {
      this.rect(ctx, 1, 14, 14, 1, '#57534e');
      if (industrial.has(type)) {
        this.rect(ctx, 12, 2, 2, 5, '#44403c');
        this.px(ctx, 13, 1, '#94a3b8');
      } else {
        this.px(ctx, 2, 4, '#b45309'); this.px(ctx, 13, 4, '#b45309');
      }
      return;
    }
    if (era === 'modern') {
      this.rect(ctx, 1, 14, 14, 1, '#334155');
      if (civic.has(type) || industrial.has(type)) {
        this.px(ctx, 3, 5, '#38bdf8'); this.px(ctx, 6, 5, '#7dd3fc');
        this.px(ctx, 10, 5, '#38bdf8'); this.px(ctx, 13, 5, '#7dd3fc');
      }
    }
  }

  private static drawBuildingCultureAccent(ctx: CanvasRenderingContext2D, type: string, species: SpeciesType, era: string): void {
    const civic = new Set(['town_center', 'palace', 'keep', 'temple', 'academy', 'library', 'bank', 'stock_exchange', 'monument', 'great_library', 'colosseum']);
    const residential = type === 'house' || type === 'granary' || type === 'market' || type === 'farm';

    // Buildings are ornamented by what the settlement does, not by who lives
    // there. Civic halls get a carved lintel; homes and workplaces get shutters.
    void species;
    if (civic.has(type)) {
      this.rect(ctx, 6, 2, 4, 1, '#d6cbb4');
      this.px(ctx, 7, 1, '#c2b280');
    } else if (residential) {
      this.px(ctx, 4, 4, '#9a8c6a');
      this.px(ctx, 11, 4, '#9a8c6a');
    }
  }

  private static drawBuildingLevelAccent(ctx: CanvasRenderingContext2D, type: string, level: number, species: SpeciesType): void {
    if (level <= 1) return;
    void species;
    const accent = '#cbd5e1';

    // Level two reads as reinforcement/expansion without making a new building type.
    this.px(ctx, 2, 14, accent); this.px(ctx, 13, 14, accent);
    this.px(ctx, 3, 6, accent); this.px(ctx, 12, 6, accent);

    if (level >= 3) {
      // Level three gets a recognisable crown/roofline and extra lit windows.
      this.rect(ctx, 5, 1, 6, 1, accent);
      this.px(ctx, 4, 2, accent); this.px(ctx, 11, 2, accent);
      if (!['farm', 'pasture', 'wall', 'aqueduct', 'grand_aqueduct'].includes(type)) {
        this.px(ctx, 5, 9, '#fef3c7'); this.px(ctx, 10, 9, '#fef3c7');
      }
    }
  }

  private static drawBuildingIndustryMarker(ctx: CanvasRenderingContext2D, type: string, extractedGood: string | null): void {
    if (!extractedGood) return;
    const colors: Record<string, string> = {
      wood: '#22c55e', stone: '#94a3b8', iron: '#64748b', coal: '#27272a', gold: '#fbbf24',
      gems: '#c084fc', oil: '#111827', copper: '#d97706', tin: '#cbd5e1', salt: '#f8fafc',
      uranium: '#a3e635', rubber: '#292524', saltpeter: '#e2e8f0'
    };
    const c = colors[extractedGood] || '#38bdf8';
    if (['mine', 'quarry', 'lumber_camp', 'oil_well'].includes(type)) {
      this.rect(ctx, 12, 11, 3, 3, '#0f172a');
      this.rect(ctx, 13, 12, 2, 2, c);
      this.px(ctx, 13, 12, extractedGood === 'oil' ? '#475569' : '#ffffff');
    }
  }


  private static buildingCategory(type: string): 'civic' | 'residential' | 'market' | 'industrial' | 'military' | 'faith' | 'utility' | 'rural' {
    if (['town_center', 'palace', 'academy', 'great_library', 'bank', 'stock_exchange', 'monument', 'colosseum'].includes(type)) return 'civic';
    if (['house', 'manor', 'apartment'].includes(type)) return 'residential';
    if (['market', 'harbor', 'port', 'caravanserai'].includes(type)) return 'market';
    if (['factory', 'refinery', 'oil_well', 'workshop', 'smithy', 'mine', 'quarry', 'lumberyard', 'enrichment_facility'].includes(type)) return 'industrial';
    if (['barracks', 'keep', 'wall', 'naval_yard', 'radar_station', 'sam_site', 'missile_silo', 'drone_command'].includes(type)) return 'military';
    if (['temple', 'hospital'].includes(type)) return 'faith';
    if (['granary', 'warehouse', 'aqueduct', 'grand_aqueduct', 'well', 'bridge', 'bomb_shelter'].includes(type)) return 'utility';
    return 'rural';
  }

  private static tierScore(tier: string): number {
    return ({
      camp: 0,
      hamlet: 1,
      village: 2,
      town: 3,
      city: 4,
      metropolis: 5
    } as Record<string, number>)[tier] ?? 0;
  }

  private static drawBuildingTierAccent(
    ctx: CanvasRenderingContext2D,
    type: string,
    tier: string,
    level: number,
    species: SpeciesType,
    population: number
  ): void {
    const score = this.tierScore(tier);
    if (score <= 0) return;
    const category = this.buildingCategory(type);

    // Shared urban foundation: larger settlements look less improvised.
    if (score >= 2 && !['farm', 'pasture', 'wall', 'bridge'].includes(type)) {
      this.rect(ctx, 1, 14, 14, 1, score >= 4 ? '#64748b' : '#7c6f57');
    }
    if (score >= 3 && ['residential', 'market', 'civic', 'industrial'].includes(category)) {
      this.px(ctx, 1, 13, '#475569');
      this.px(ctx, 14, 13, '#475569');
    }

    // Category-specific skyline language.
    if (score >= 3) {
      if (category === 'market') {
        this.rect(ctx, 3, 5, 10, 1, '#d6b15f');
      } else if (category === 'industrial') {
        this.rect(ctx, 11, 2, 1, 3, '#44403c');
        if (score >= 4) this.rect(ctx, 12, 3, 1, 2, '#57534e');
      } else if (category === 'civic') {
        this.rect(ctx, 6, 1, 4, 1, '#e7c36b');
      } else if (category === 'residential') {
        this.px(ctx, 3, 9, '#f5deb3');
        this.px(ctx, 12, 9, '#f5deb3');
      }
    }

    if (score >= 4) {
      if (category === 'civic' || category === 'military') {
        this.rect(ctx, 7, 0, 2, 2, '#fbbf24');
      } else if (category === 'market') {
        this.px(ctx, 2, 4, '#fde68a'); this.px(ctx, 13, 4, '#fde68a');
      } else if (category === 'residential') {
        this.rect(ctx, 6, 3, 4, 1, '#8b5cf6');
      }
    }

    // Metropolises get a little extra density/silhouette.
    if (score >= 5 || population >= 120) {
      if (!['wall', 'bridge', 'aqueduct', 'grand_aqueduct', 'farm', 'pasture'].includes(type)) {
        this.rect(ctx, 0, 12, 2, 2, '#7c5a35');
        this.rect(ctx, 14, 12, 2, 2, '#7c5a35');
      }
      if (category === 'civic') this.px(ctx, 8, 0, '#fff7d0');
    }
  }

  private static drawBuildingProsperityState(ctx: CanvasRenderingContext2D, type: string, prosperity: number, tier: string): void {
    if (prosperity >= 0.74) {
      // Prosperous settlements feel maintained and inhabited.
      const warm = ['#fde68a', '#fcd34d'];
      if (!['wall', 'bridge', 'farm', 'pasture', 'aqueduct', 'grand_aqueduct'].includes(type)) {
        this.px(ctx, 5, 8, warm[0]); this.px(ctx, 10, 8, warm[1]);
      }
      if (this.tierScore(tier) >= 2) {
        this.px(ctx, 2, 12, '#16a34a');
        this.px(ctx, 13, 12, '#16a34a');
      }
      if (['market', 'harbor', 'port', 'bank', 'stock_exchange'].includes(type)) {
        this.rect(ctx, 6, 4, 4, 1, '#f59e0b');
      }
      return;
    }

    if (prosperity <= 0.34) {
      // Strained places show patchwork / soot instead of color.
      const patch = '#6b7280';
      this.px(ctx, 3, 4, patch); this.px(ctx, 4, 4, patch);
      this.px(ctx, 10, 5, patch); this.px(ctx, 11, 5, patch);
      if (!['wall', 'aqueduct', 'grand_aqueduct'].includes(type)) {
        this.px(ctx, 5, 12, '#3f3f46');
        this.px(ctx, 10, 12, '#3f3f46');
      }
    }
  }

  private static drawBuildingCapitalAccent(
    ctx: CanvasRenderingContext2D,
    type: string,
    species: SpeciesType,
    isCapital: boolean,
    tier: string
  ): void {
    if (!isCapital) return;
    const civic = ['town_center', 'palace', 'keep', 'academy', 'great_library', 'monument', 'bank'];
    if (!civic.includes(type)) return;

    void species;
    const hue = '#fbbf24';

    this.rect(ctx, 1, 2, 2, 1, hue);
    this.rect(ctx, 13, 2, 2, 1, hue);
    if (this.tierScore(tier) >= 3) {
      this.px(ctx, 7, 2, '#fff7d6');
      this.px(ctx, 8, 2, '#fff7d6');
    }
  }


  public static isLandmarkBuilding(type: string): boolean {
    return ['palace', 'monument', 'great_library', 'grand_aqueduct', 'colosseum', 'stock_exchange', 'academy', 'keep'].includes(type);
  }

  private static drawBuildingLandmarkAccent(
    ctx: CanvasRenderingContext2D,
    type: string,
    species: SpeciesType,
    era: string,
    tier: string,
    prosperity: number,
    isCapital: boolean
  ): void {
    const score = this.tierScore(tier);
    void species;
    const speciesAccent = '#fbbf24';

    if (type === 'palace') {
      // Crown-like skyline and ceremonial entry.
      this.px(ctx, 5, 1, speciesAccent); this.px(ctx, 8, 0, '#fff7d6'); this.px(ctx, 10, 1, speciesAccent);
      this.rect(ctx, 6, 12, 4, 1, prosperity >= 0.6 ? '#fef3c7' : '#a8a29e');
      if (isCapital) {
        this.px(ctx, 3, 4, '#fde68a'); this.px(ctx, 12, 4, '#fde68a');
      }
      return;
    }

    if (type === 'monument') {
      // Tall beacon / civic memorial.
      this.rect(ctx, 7, 1, 2, 4, '#e7e5e4');
      this.px(ctx, 7, 0, speciesAccent); this.px(ctx, 8, 0, '#fff7d6');
      if (score >= 4) {
        this.px(ctx, 5, 12, speciesAccent); this.px(ctx, 10, 12, speciesAccent);
      }
      return;
    }

    if (type === 'great_library') {
      // Scholarly light and recognisable pediment.
      this.rect(ctx, 4, 2, 8, 1, '#e2e8f0');
      this.px(ctx, 6, 3, '#38bdf8'); this.px(ctx, 9, 3, '#38bdf8');
      this.rect(ctx, 7, 11, 2, 2, prosperity >= 0.45 ? '#fde68a' : '#64748b');
      return;
    }

    if (type === 'grand_aqueduct') {
      // Water glints distinguish the great infrastructure from a generic wall.
      this.px(ctx, 2, 5, '#7dd3fc'); this.px(ctx, 5, 5, '#38bdf8');
      this.px(ctx, 9, 5, '#7dd3fc'); this.px(ctx, 13, 5, '#38bdf8');
      this.rect(ctx, 3, 13, 10, 1, '#94a3b8');
      return;
    }

    if (type === 'colosseum') {
      // Arena lamps / banners along the upper ring.
      this.px(ctx, 3, 4, speciesAccent); this.px(ctx, 7, 3, '#fde68a');
      this.px(ctx, 11, 4, speciesAccent); this.px(ctx, 13, 5, '#fde68a');
      return;
    }

    if (type === 'stock_exchange') {
      // Financial district beacon — stronger only in industrial/modern eras.
      if (era === 'industrial' || era === 'modern') {
        this.rect(ctx, 5, 2, 6, 1, '#fbbf24');
        this.px(ctx, 4, 3, '#fde68a'); this.px(ctx, 11, 3, '#fde68a');
        if (prosperity >= 0.7) this.px(ctx, 8, 1, '#fff7d6');
      }
      return;
    }

    if (type === 'academy') {
      this.px(ctx, 5, 4, '#60a5fa'); this.px(ctx, 10, 4, '#60a5fa');
      if (score >= 4) this.rect(ctx, 7, 2, 2, 1, speciesAccent);
      return;
    }

    if (type === 'keep') {
      this.px(ctx, 2, 2, speciesAccent); this.px(ctx, 13, 2, speciesAccent);
      if (isCapital) this.rect(ctx, 7, 1, 2, 2, '#fef3c7');
    }
  }

  private static drawBuildingStaffingState(ctx: CanvasRenderingContext2D, type: string, staffing: number): void {
    if (staffing >= 0.7) return;
    // Understaffed buildings look quiet: extinguished/darkened openings and a
    // small shutter mark. The building still reads clearly at 16x16.
    ctx.fillStyle = staffing < 0.34 ? 'rgba(15, 23, 42, 0.18)' : 'rgba(15, 23, 42, 0.09)';
    ctx.fillRect(1, 1, 14, 14);
    if (!['farm', 'pasture', 'wall', 'aqueduct', 'grand_aqueduct'].includes(type)) {
      this.rect(ctx, 5, 8, 2, 2, '#0f172a');
      if (staffing < 0.34) this.rect(ctx, 9, 8, 2, 2, '#0f172a');
    }
  }

  private static drawBuildingDamageState(ctx: CanvasRenderingContext2D, type: string, hpRatio: number): void {
    if (hpRatio > 0.9) return;
    const crack = hpRatio <= 0.32 ? '#0f172a' : '#44403c';
    this.px(ctx, 4, 5, crack); this.px(ctx, 5, 6, crack); this.px(ctx, 5, 7, crack);
    if (hpRatio <= 0.68) {
      this.px(ctx, 11, 9, crack); this.px(ctx, 10, 10, crack); this.px(ctx, 10, 11, crack);
      this.px(ctx, 3, 13, '#292524');
    }
    if (hpRatio <= 0.32) {
      // Broken silhouette, soot and exposed interior. Avoid clearing defensive
      // walls/aqueducts so their gameplay footprint remains readable.
      if (!['wall', 'aqueduct', 'grand_aqueduct'].includes(type)) {
        ctx.clearRect(13, 1, 2, 3);
        ctx.clearRect(1, 2, 1, 2);
      }
      this.rect(ctx, 2, 12, 3, 2, 'rgba(41, 37, 36, 0.85)');
      this.px(ctx, 12, 4, '#57534e'); this.px(ctx, 13, 3, '#78716c');
    }
  }

  public static generateAllSprites(): void {
    const px = this.px.bind(this);

    // ============ NAVAL SHIPS (TIERS 1 TO 4) ============
    // Side-view, facing RIGHT. Renderer flips via ctx.scale(-1,1) when direction < 0.

    // Tier 1: Wooden Canoe — narrow V-hull, pointed bow, flat stern, paddle and cargo
    this.getSprite('ship_tier_1', (ctx) => {
      // Dark 1px silhouette / gunwale
      this.rect(ctx, 7, 35, 42, 1, '#451a03');
      this.rect(ctx, 5, 36, 47, 1, '#451a03');
      this.rect(ctx, 6, 37, 46, 1, '#451a03');
      this.rect(ctx, 8, 38, 43, 1, '#451a03');
      this.rect(ctx, 10, 39, 39, 1, '#451a03');
      this.rect(ctx, 12, 40, 35, 1, '#451a03');
      this.rect(ctx, 15, 41, 28, 1, '#451a03');
      this.rect(ctx, 19, 42, 20, 1, '#451a03');

      // Hull planks — V-shaped hull, flat stern on left, pointed bow on right
      this.rect(ctx, 7, 36, 42, 1, '#92400e');
      this.rect(ctx, 7, 37, 43, 1, '#a16207');
      this.rect(ctx, 9, 38, 40, 1, '#b45309');
      this.rect(ctx, 11, 39, 36, 1, '#92400e');
      this.rect(ctx, 13, 40, 32, 1, '#78350f');
      this.rect(ctx, 16, 41, 25, 1, '#5c3310');
      this.rect(ctx, 20, 42, 18, 1, '#451a03');
      // Pointed bow
      this.rect(ctx, 49, 36, 4, 1, '#92400e');
      this.rect(ctx, 50, 37, 3, 1, '#78350f');
      this.rect(ctx, 49, 38, 2, 1, '#5c3310');
      this.px(ctx, 53, 36, '#451a03');
      // Flat stern cap
      this.rect(ctx, 5, 35, 2, 4, '#451a03');
      this.rect(ctx, 6, 36, 1, 2, '#b45309');

      // Interior and gunwale highlights
      this.rect(ctx, 9, 34, 39, 1, '#451a03');
      this.rect(ctx, 10, 34, 37, 1, '#d97706');
      this.rect(ctx, 11, 35, 35, 1, '#f59e0b');
      this.rect(ctx, 14, 36, 29, 1, '#c47a17');
      // Wood seams / texture
      this.px(ctx, 13, 37, '#f59e0b'); this.px(ctx, 21, 37, '#78350f');
      this.px(ctx, 29, 38, '#f59e0b'); this.px(ctx, 37, 38, '#78350f');
      this.px(ctx, 18, 40, '#b45309'); this.px(ctx, 34, 40, '#b45309');

      // Cargo bundles
      this.rect(ctx, 14, 30, 9, 4, '#451a03');
      this.rect(ctx, 15, 29, 7, 5, '#92400e');
      this.rect(ctx, 16, 30, 5, 2, '#b45309');
      this.rect(ctx, 18, 29, 1, 5, '#f59e0b');
      this.rect(ctx, 26, 31, 8, 3, '#451a03');
      this.rect(ctx, 27, 30, 6, 4, '#78350f');
      this.rect(ctx, 28, 31, 4, 2, '#a16207');
      this.rect(ctx, 29, 30, 1, 4, '#d97706');

      // Paddle crossing the hull
      this.rect(ctx, 31, 24, 1, 15, '#451a03');
      this.rect(ctx, 32, 24, 1, 14, '#78350f');
      this.rect(ctx, 30, 22, 4, 5, '#451a03');
      this.rect(ctx, 31, 22, 3, 4, '#b45309');
      this.px(ctx, 32, 23, '#d97706');
    }, 64, 64);

    // Tier 2: Merchant Caravel — curved hull, stern castle, single mast, billowed square sail, bowsprit
    this.getSprite('ship_tier_2', (ctx) => {
      // Curved hull outline
      this.rect(ctx, 5, 43, 47, 1, '#451a03');
      this.rect(ctx, 6, 44, 48, 1, '#451a03');
      this.rect(ctx, 8, 45, 45, 1, '#451a03');
      this.rect(ctx, 10, 46, 41, 1, '#451a03');
      this.rect(ctx, 13, 47, 35, 1, '#451a03');
      this.rect(ctx, 17, 48, 27, 1, '#451a03');
      this.rect(ctx, 22, 49, 17, 1, '#451a03');

      // Hull planking / curvature
      this.rect(ctx, 6, 43, 45, 1, '#78350f');
      this.rect(ctx, 7, 44, 46, 1, '#92400e');
      this.rect(ctx, 9, 45, 43, 1, '#b45309');
      this.rect(ctx, 11, 46, 39, 1, '#92400e');
      this.rect(ctx, 14, 47, 33, 1, '#78350f');
      this.rect(ctx, 18, 48, 25, 1, '#5c3310');
      this.rect(ctx, 23, 49, 15, 1, '#451a03');
      // Bow rises to right
      this.rect(ctx, 50, 40, 3, 4, '#451a03');
      this.rect(ctx, 51, 39, 3, 4, '#78350f');
      this.rect(ctx, 52, 38, 2, 3, '#92400e');
      this.px(ctx, 54, 39, '#451a03');

      // Stern castle
      this.rect(ctx, 5, 34, 10, 9, '#451a03');
      this.rect(ctx, 6, 33, 9, 10, '#78350f');
      this.rect(ctx, 7, 32, 8, 2, '#92400e');
      this.rect(ctx, 8, 34, 6, 8, '#a16207');
      this.rect(ctx, 9, 35, 2, 2, '#fbbf24');
      this.rect(ctx, 12, 35, 1, 2, '#fde68a');
      this.rect(ctx, 6, 39, 9, 1, '#d97706');

      // Deck / rail
      this.rect(ctx, 14, 40, 38, 1, '#451a03');
      this.rect(ctx, 15, 39, 36, 1, '#d97706');
      this.rect(ctx, 17, 38, 32, 1, '#f59e0b');
      // plank seams
      this.px(ctx, 18, 44, '#f59e0b'); this.px(ctx, 25, 45, '#78350f');
      this.px(ctx, 33, 44, '#f59e0b'); this.px(ctx, 41, 46, '#b45309');

      // Mast
      this.rect(ctx, 30, 11, 2, 29, '#451a03');
      this.rect(ctx, 31, 11, 1, 29, '#78350f');
      this.rect(ctx, 27, 10, 8, 1, '#451a03');
      // Yard
      this.rect(ctx, 19, 17, 26, 1, '#451a03');
      this.rect(ctx, 20, 18, 24, 1, '#78350f');

      // Square sail with billowed stepped silhouette + dark edge
      this.rect(ctx, 21, 19, 22, 1, '#475569');
      this.rect(ctx, 20, 20, 24, 5, '#475569');
      this.rect(ctx, 21, 25, 22, 5, '#475569');
      this.rect(ctx, 22, 30, 20, 4, '#475569');
      this.rect(ctx, 23, 34, 18, 2, '#475569');
      this.rect(ctx, 21, 20, 22, 5, '#f8fafc');
      this.rect(ctx, 22, 25, 20, 5, '#f1f5f9');
      this.rect(ctx, 23, 30, 18, 4, '#e2e8f0');
      this.rect(ctx, 24, 34, 16, 1, '#cbd5e1');
      // Sail highlight and shadow stripes
      this.rect(ctx, 23, 21, 3, 12, '#ffffff');
      this.rect(ctx, 39, 21, 3, 12, '#cbd5e1');
      this.rect(ctx, 31, 20, 1, 15, '#94a3b8');

      // Rigging
      this.rect(ctx, 16, 20, 1, 19, '#78350f');
      this.rect(ctx, 44, 20, 1, 19, '#78350f');
      this.px(ctx, 17, 22, '#a16207'); this.px(ctx, 43, 22, '#a16207');
      this.px(ctx, 18, 25, '#a16207'); this.px(ctx, 42, 25, '#a16207');
      this.px(ctx, 19, 28, '#a16207'); this.px(ctx, 41, 28, '#a16207');
      this.px(ctx, 20, 31, '#a16207'); this.px(ctx, 40, 31, '#a16207');
      this.px(ctx, 21, 34, '#a16207'); this.px(ctx, 39, 34, '#a16207');

      // Bowsprit and rope
      this.rect(ctx, 52, 37, 8, 1, '#451a03');
      this.rect(ctx, 54, 36, 8, 1, '#78350f');
      this.px(ctx, 61, 35, '#78350f');
      this.px(ctx, 57, 38, '#a16207'); this.px(ctx, 56, 39, '#a16207');
      this.px(ctx, 55, 40, '#a16207');
    }, 64, 64);

    // Tier 3: Imperial Galleon — high hull, two masts, stern castle, windows and cannon ports
    this.getSprite('ship_tier_3', (ctx) => {
      // Tall hull outline
      this.rect(ctx, 4, 43, 50, 1, '#451a03');
      this.rect(ctx, 5, 44, 51, 2, '#451a03');
      this.rect(ctx, 7, 46, 48, 2, '#451a03');
      this.rect(ctx, 10, 48, 43, 2, '#451a03');
      this.rect(ctx, 14, 50, 36, 2, '#451a03');
      this.rect(ctx, 19, 52, 26, 1, '#451a03');

      // Hull planks / high freeboard
      this.rect(ctx, 5, 43, 48, 2, '#78350f');
      this.rect(ctx, 6, 45, 49, 1, '#92400e');
      this.rect(ctx, 8, 46, 46, 2, '#a16207');
      this.rect(ctx, 11, 48, 41, 2, '#78350f');
      this.rect(ctx, 15, 50, 34, 2, '#5c3310');
      this.rect(ctx, 20, 52, 24, 1, '#451a03');
      // Decorative gold rail stripe
      this.rect(ctx, 10, 42, 43, 1, '#fbbf24');
      this.rect(ctx, 16, 41, 34, 1, '#d97706');
      // Bow / forecastle
      this.rect(ctx, 51, 38, 5, 5, '#451a03');
      this.rect(ctx, 52, 37, 4, 5, '#78350f');
      this.rect(ctx, 53, 36, 3, 3, '#92400e');
      this.px(ctx, 57, 37, '#451a03');
      this.rect(ctx, 55, 40, 5, 1, '#78350f');

      // Stern castle high silhouette
      this.rect(ctx, 3, 29, 14, 14, '#451a03');
      this.rect(ctx, 4, 28, 13, 15, '#5c3310');
      this.rect(ctx, 5, 27, 12, 2, '#78350f');
      this.rect(ctx, 6, 30, 10, 12, '#92400e');
      this.rect(ctx, 7, 31, 8, 10, '#a16207');
      this.rect(ctx, 4, 34, 13, 1, '#fbbf24');
      // Stern windows with dark frames
      this.rect(ctx, 7, 31, 3, 4, '#451a03');
      this.rect(ctx, 8, 32, 1, 2, '#fde68a');
      this.rect(ctx, 12, 31, 3, 4, '#451a03');
      this.rect(ctx, 13, 32, 1, 2, '#fde68a');
      this.rect(ctx, 7, 36, 3, 4, '#451a03');
      this.rect(ctx, 8, 37, 1, 2, '#fbbf24');
      this.rect(ctx, 12, 36, 3, 4, '#451a03');
      this.rect(ctx, 13, 37, 1, 2, '#fbbf24');

      // Cannon deck and ports
      this.rect(ctx, 16, 43, 34, 1, '#451a03');
      this.rect(ctx, 17, 44, 33, 1, '#b45309');
      for (const x of [19, 25, 31, 37, 43, 49]) {
        this.rect(ctx, x, 45, 3, 3, '#451a03');
        this.px(ctx, x + 1, 46, '#0f172a');
        this.px(ctx, x + 2, 45, '#d97706');
      }
      // Plank seams
      this.px(ctx, 18, 49, '#b45309'); this.px(ctx, 27, 50, '#92400e');
      this.px(ctx, 36, 48, '#d97706'); this.px(ctx, 45, 49, '#92400e');

      // Main mast
      this.rect(ctx, 30, 7, 2, 35, '#451a03');
      this.rect(ctx, 31, 7, 1, 35, '#78350f');
      this.rect(ctx, 20, 14, 23, 1, '#451a03');
      this.rect(ctx, 21, 15, 21, 1, '#78350f');
      // Main sail, billowed
      this.rect(ctx, 22, 16, 19, 1, '#475569');
      this.rect(ctx, 21, 17, 21, 6, '#475569');
      this.rect(ctx, 22, 23, 19, 7, '#475569');
      this.rect(ctx, 23, 30, 17, 5, '#475569');
      this.rect(ctx, 22, 17, 19, 6, '#fffbeb');
      this.rect(ctx, 23, 23, 17, 7, '#fef3c7');
      this.rect(ctx, 24, 30, 15, 4, '#fde68a');
      this.rect(ctx, 25, 18, 2, 15, '#ffffff');
      this.rect(ctx, 38, 18, 2, 15, '#e7e5e4');
      this.rect(ctx, 31, 17, 1, 17, '#a8a29e');

      // Foremast
      this.rect(ctx, 46, 12, 2, 30, '#451a03');
      this.rect(ctx, 47, 12, 1, 30, '#78350f');
      this.rect(ctx, 40, 19, 16, 1, '#451a03');
      this.rect(ctx, 41, 20, 14, 1, '#78350f');
      this.rect(ctx, 42, 21, 12, 1, '#475569');
      this.rect(ctx, 41, 22, 14, 5, '#475569');
      this.rect(ctx, 42, 27, 12, 6, '#475569');
      this.rect(ctx, 42, 22, 12, 5, '#fffbeb');
      this.rect(ctx, 43, 27, 10, 5, '#fef3c7');
      this.rect(ctx, 45, 23, 1, 8, '#ffffff');
      this.rect(ctx, 52, 23, 1, 8, '#e7e5e4');
      // Rigging pixels / ropes
      this.rect(ctx, 17, 16, 1, 25, '#78350f');
      this.rect(ctx, 55, 21, 1, 17, '#78350f');
      this.px(ctx, 18, 18, '#a16207'); this.px(ctx, 19, 21, '#a16207');
      this.px(ctx, 20, 24, '#a16207'); this.px(ctx, 21, 27, '#a16207');
      this.px(ctx, 54, 23, '#a16207'); this.px(ctx, 53, 26, '#a16207');
      this.px(ctx, 52, 29, '#a16207');

      // Bowsprit
      this.rect(ctx, 55, 35, 7, 1, '#451a03');
      this.rect(ctx, 57, 34, 6, 1, '#78350f');
      this.px(ctx, 63, 33, '#78350f');
    }, 64, 64);

    // Tier 4: Ironclad — low armored hull, bridge, smokestacks, smoke and ram bow
    this.getSprite('ship_tier_4', (ctx) => {
      // Armored flat hull outline
      this.rect(ctx, 4, 39, 52, 1, '#0f172a');
      this.rect(ctx, 3, 40, 55, 2, '#0f172a');
      this.rect(ctx, 5, 42, 52, 5, '#0f172a');
      this.rect(ctx, 8, 47, 47, 4, '#0f172a');
      this.rect(ctx, 12, 51, 39, 2, '#0f172a');
      // Hull metal planes
      this.rect(ctx, 5, 40, 50, 2, '#475569');
      this.rect(ctx, 6, 42, 50, 4, '#334155');
      this.rect(ctx, 9, 46, 46, 4, '#1e293b');
      this.rect(ctx, 13, 50, 37, 2, '#334155');
      // Metal highlights / armor seam bands
      this.rect(ctx, 7, 40, 45, 1, '#94a3b8');
      this.rect(ctx, 9, 43, 42, 1, '#64748b');
      this.rect(ctx, 12, 47, 37, 1, '#475569');
      this.rect(ctx, 16, 50, 29, 1, '#64748b');
      for (const x of [10, 18, 26, 34, 42, 50]) {
        this.px(ctx, x, 43, '#94a3b8');
        this.px(ctx, x + 1, 48, '#64748b');
      }

      // Armored bow and ram, facing right
      this.rect(ctx, 54, 36, 5, 6, '#0f172a');
      this.rect(ctx, 55, 35, 4, 6, '#334155');
      this.rect(ctx, 57, 34, 3, 4, '#475569');
      this.rect(ctx, 58, 40, 5, 2, '#0f172a');
      this.rect(ctx, 60, 39, 4, 1, '#475569');
      this.px(ctx, 63, 38, '#94a3b8');
      // Stern plate
      this.rect(ctx, 2, 38, 4, 7, '#0f172a');
      this.rect(ctx, 3, 39, 3, 5, '#334155');

      // Deck armor
      this.rect(ctx, 10, 36, 42, 1, '#0f172a');
      this.rect(ctx, 11, 35, 40, 1, '#64748b');
      this.rect(ctx, 15, 34, 32, 1, '#94a3b8');

      // Bridge / conning tower
      this.rect(ctx, 22, 26, 20, 9, '#0f172a');
      this.rect(ctx, 23, 25, 18, 9, '#475569');
      this.rect(ctx, 25, 23, 14, 2, '#64748b');
      this.rect(ctx, 27, 22, 10, 1, '#94a3b8');
      // Windows with frames
      for (const x of [25, 29, 33, 37]) {
        this.rect(ctx, x, 27, 3, 3, '#0f172a');
        this.rect(ctx, x + 1, 28, 2, 1, '#38bdf8');
        this.px(ctx, x + 1, 27, '#7dd3fc');
      }
      this.rect(ctx, 24, 32, 16, 1, '#94a3b8');

      // Smokestacks
      this.rect(ctx, 17, 16, 6, 11, '#0f172a');
      this.rect(ctx, 18, 15, 5, 11, '#334155');
      this.rect(ctx, 17, 14, 7, 2, '#475569');
      this.rect(ctx, 34, 17, 6, 9, '#0f172a');
      this.rect(ctx, 35, 16, 5, 9, '#334155');
      this.rect(ctx, 34, 15, 7, 2, '#475569');
      // Opaque pixel smoke
      this.rect(ctx, 15, 10, 8, 3, '#64748b');
      this.rect(ctx, 13, 8, 6, 2, '#94a3b8');
      this.rect(ctx, 10, 6, 6, 2, '#cbd5e1');
      this.rect(ctx, 7, 5, 5, 1, '#e2e8f0');
      this.rect(ctx, 35, 11, 7, 3, '#64748b');
      this.rect(ctx, 39, 9, 6, 2, '#94a3b8');
      this.rect(ctx, 43, 7, 5, 2, '#cbd5e1');
      this.rect(ctx, 47, 6, 4, 1, '#e2e8f0');

      // Riveted gun/port line
      for (const x of [12, 18, 24, 30, 36, 42, 48]) {
        this.rect(ctx, x, 44, 3, 2, '#0f172a');
        this.px(ctx, x + 1, 44, '#38bdf8');
        this.px(ctx, x + 2, 45, '#94a3b8');
      }
      // Forward armored gun housing
      this.rect(ctx, 44, 30, 10, 5, '#0f172a');
      this.rect(ctx, 45, 29, 8, 5, '#475569');
      this.rect(ctx, 52, 30, 8, 2, '#0f172a');
      this.rect(ctx, 53, 30, 7, 1, '#94a3b8');
    }, 64, 64);

    // ============ OVERLAND CARAVANS (DONKEY, CAMEL, CART) ============
    // Side-view, facing RIGHT. Renderer flips via ctx.scale(-1,1) when direction < 0.

    // Pack Donkey — four legs, pointed ears, face details, tail and loaded packs
    this.getSprite('caravan_donkey', (ctx) => {
      // Legs behind body
      this.rect(ctx, 19, 39, 4, 14, '#374151');
      this.rect(ctx, 20, 39, 2, 13, '#6b7280');
      this.rect(ctx, 31, 39, 4, 14, '#374151');
      this.rect(ctx, 32, 39, 2, 13, '#6b7280');
      // Hooves
      this.rect(ctx, 18, 52, 6, 3, '#1e293b');
      this.rect(ctx, 30, 52, 6, 3, '#1e293b');

      // Tail at left/back
      this.rect(ctx, 9, 30, 6, 2, '#374151');
      this.rect(ctx, 7, 31, 3, 7, '#4b5563');
      this.rect(ctx, 6, 37, 3, 4, '#1e293b');
      this.px(ctx, 8, 29, '#6b7280');

      // Body outline and barrel shape
      this.rect(ctx, 13, 28, 31, 2, '#374151');
      this.rect(ctx, 11, 30, 36, 9, '#374151');
      this.rect(ctx, 14, 39, 30, 5, '#374151');
      this.rect(ctx, 16, 44, 25, 2, '#374151');
      this.rect(ctx, 14, 29, 29, 2, '#9ca3af');
      this.rect(ctx, 12, 31, 34, 7, '#6b7280');
      this.rect(ctx, 15, 38, 28, 5, '#4b5563');
      this.rect(ctx, 17, 43, 23, 2, '#374151');
      // Fur highlights / texture
      this.rect(ctx, 16, 31, 16, 1, '#d1d5db');
      this.px(ctx, 17, 34, '#9ca3af'); this.px(ctx, 23, 36, '#4b5563');
      this.px(ctx, 29, 33, '#d1d5db'); this.px(ctx, 37, 37, '#9ca3af');
      this.px(ctx, 41, 32, '#d1d5db');

      // Front legs
      this.rect(ctx, 39, 40, 4, 13, '#374151');
      this.rect(ctx, 40, 40, 2, 12, '#6b7280');
      this.rect(ctx, 47, 39, 4, 14, '#374151');
      this.rect(ctx, 48, 39, 2, 13, '#6b7280');
      this.rect(ctx, 38, 52, 6, 3, '#1e293b');
      this.rect(ctx, 46, 52, 6, 3, '#1e293b');

      // Neck rising toward right
      this.rect(ctx, 43, 23, 8, 18, '#374151');
      this.rect(ctx, 44, 24, 7, 16, '#6b7280');
      this.rect(ctx, 46, 23, 5, 9, '#9ca3af');
      // Head / muzzle facing right
      this.rect(ctx, 48, 20, 10, 9, '#374151');
      this.rect(ctx, 49, 19, 9, 9, '#9ca3af');
      this.rect(ctx, 54, 22, 7, 6, '#4b5563');
      this.rect(ctx, 56, 23, 5, 4, '#6b7280');
      this.px(ctx, 60, 25, '#1e293b');
      // Ears, pointed
      this.rect(ctx, 49, 12, 3, 8, '#374151');
      this.rect(ctx, 50, 11, 2, 8, '#9ca3af');
      this.px(ctx, 51, 10, '#374151');
      this.rect(ctx, 54, 13, 3, 7, '#374151');
      this.rect(ctx, 55, 12, 2, 7, '#9ca3af');
      this.px(ctx, 56, 11, '#374151');
      // Eye and brow
      this.rect(ctx, 54, 21, 2, 1, '#1e293b');
      this.px(ctx, 55, 20, '#d1d5db');
      // Bridle
      this.rect(ctx, 51, 25, 9, 1, '#78350f');
      this.rect(ctx, 52, 20, 1, 7, '#78350f');

      // Cargo packs and blanket
      this.rect(ctx, 17, 24, 24, 5, '#451a03');
      this.rect(ctx, 18, 23, 22, 6, '#92400e');
      this.rect(ctx, 20, 21, 8, 7, '#b45309');
      this.rect(ctx, 21, 20, 6, 1, '#d97706');
      this.rect(ctx, 31, 20, 8, 8, '#a16207');
      this.rect(ctx, 32, 19, 6, 1, '#f59e0b');
      this.rect(ctx, 18, 28, 22, 2, '#b91c1c');
      // Rope ties / stitches
      this.rect(ctx, 24, 20, 1, 10, '#fbbf24');
      this.rect(ctx, 35, 19, 1, 11, '#fbbf24');
      this.px(ctx, 21, 24, '#fde68a'); this.px(ctx, 27, 24, '#fde68a');
      this.px(ctx, 33, 24, '#fde68a'); this.px(ctx, 38, 24, '#fde68a');
    }, 64, 64);

    // Desert Camel — curved neck, hump, small head, red blanket, gold cargo and tail
    this.getSprite('caravan_camel', (ctx) => {
      // Rear legs
      this.rect(ctx, 17, 39, 5, 15, '#78350f');
      this.rect(ctx, 18, 39, 3, 14, '#b45309');
      this.rect(ctx, 28, 39, 5, 15, '#78350f');
      this.rect(ctx, 29, 39, 3, 14, '#d97706');
      this.rect(ctx, 16, 53, 7, 3, '#451a03');
      this.rect(ctx, 27, 53, 7, 3, '#451a03');

      // Tail on left/back
      this.rect(ctx, 8, 31, 8, 2, '#92400e');
      this.rect(ctx, 7, 32, 3, 9, '#b45309');
      this.rect(ctx, 5, 40, 5, 4, '#78350f');
      this.px(ctx, 7, 30, '#d97706');

      // Body silhouette
      this.rect(ctx, 12, 29, 35, 2, '#78350f');
      this.rect(ctx, 10, 31, 39, 9, '#92400e');
      this.rect(ctx, 13, 40, 34, 5, '#78350f');
      this.rect(ctx, 16, 45, 28, 2, '#451a03');
      this.rect(ctx, 13, 30, 33, 2, '#f59e0b');
      this.rect(ctx, 11, 32, 37, 7, '#d97706');
      this.rect(ctx, 14, 39, 32, 5, '#b45309');
      // Hump — rounded stepped silhouette
      this.rect(ctx, 20, 22, 20, 2, '#78350f');
      this.rect(ctx, 18, 24, 24, 5, '#78350f');
      this.rect(ctx, 20, 23, 20, 2, '#f59e0b');
      this.rect(ctx, 19, 25, 22, 4, '#d97706');
      this.rect(ctx, 23, 21, 14, 2, '#f59e0b');
      this.rect(ctx, 26, 20, 8, 1, '#fbbf24');
      // Coat texture
      this.px(ctx, 15, 33, '#f59e0b'); this.px(ctx, 22, 36, '#b45309');
      this.px(ctx, 31, 33, '#fbbf24'); this.px(ctx, 40, 36, '#92400e');
      this.px(ctx, 18, 41, '#d97706'); this.px(ctx, 37, 42, '#f59e0b');

      // Front legs
      this.rect(ctx, 41, 39, 5, 15, '#78350f');
      this.rect(ctx, 42, 39, 3, 14, '#d97706');
      this.rect(ctx, 48, 38, 5, 16, '#78350f');
      this.rect(ctx, 49, 38, 3, 15, '#d97706');
      this.rect(ctx, 40, 53, 7, 3, '#451a03');
      this.rect(ctx, 47, 53, 7, 3, '#451a03');

      // Curved neck towards right
      this.rect(ctx, 45, 22, 7, 19, '#78350f');
      this.rect(ctx, 47, 17, 7, 20, '#78350f');
      this.rect(ctx, 49, 13, 7, 16, '#78350f');
      this.rect(ctx, 46, 23, 5, 17, '#d97706');
      this.rect(ctx, 48, 18, 5, 17, '#d97706');
      this.rect(ctx, 50, 14, 5, 14, '#f59e0b');
      this.rect(ctx, 50, 15, 2, 13, '#fbbf24');

      // Small head facing right
      this.rect(ctx, 52, 11, 9, 8, '#78350f');
      this.rect(ctx, 53, 10, 8, 8, '#f59e0b');
      this.rect(ctx, 58, 13, 6, 5, '#b45309');
      this.rect(ctx, 60, 14, 4, 3, '#d97706');
      this.px(ctx, 63, 16, '#78350f');
      // Ear and eye
      this.rect(ctx, 53, 7, 3, 4, '#78350f');
      this.rect(ctx, 54, 7, 2, 3, '#d97706');
      this.px(ctx, 55, 6, '#78350f');
      this.rect(ctx, 57, 12, 2, 1, '#1e293b');
      this.px(ctx, 58, 11, '#fde68a');

      // Red saddle blanket with trim
      this.rect(ctx, 17, 29, 27, 11, '#7f1d1d');
      this.rect(ctx, 18, 28, 25, 11, '#dc2626');
      this.rect(ctx, 19, 29, 23, 8, '#ef4444');
      this.rect(ctx, 18, 37, 25, 2, '#fbbf24');
      this.px(ctx, 21, 38, '#fde68a'); this.px(ctx, 25, 38, '#fde68a');
      this.px(ctx, 29, 38, '#fde68a'); this.px(ctx, 33, 38, '#fde68a');
      this.px(ctx, 37, 38, '#fde68a'); this.px(ctx, 41, 38, '#fde68a');

      // Golden cargo strapped over hump
      this.rect(ctx, 21, 17, 9, 7, '#92400e');
      this.rect(ctx, 22, 16, 8, 7, '#f59e0b');
      this.rect(ctx, 23, 17, 6, 4, '#fbbf24');
      this.rect(ctx, 33, 17, 9, 7, '#92400e');
      this.rect(ctx, 34, 16, 8, 7, '#d97706');
      this.rect(ctx, 35, 17, 6, 4, '#fbbf24');
      this.rect(ctx, 27, 15, 1, 14, '#78350f');
      this.rect(ctx, 38, 15, 1, 14, '#78350f');
      this.px(ctx, 25, 18, '#fde68a'); this.px(ctx, 37, 18, '#fde68a');
    }, 64, 64);

    // Wooden Horse Cart — horse at front/right pulling a two-wheel wooden cargo cart
    this.getSprite('caravan_cart', (ctx) => {
      // === CART on the left/rear ===
      // Wheels behind cart body
      for (const cx of [13, 29]) {
        this.rect(ctx, cx, 40, 11, 11, '#451a03');
        this.rect(ctx, cx + 1, 39, 9, 13, '#451a03');
        this.rect(ctx, cx - 1, 42, 13, 7, '#451a03');
        this.rect(ctx, cx + 2, 41, 7, 9, '#78350f');
        this.rect(ctx, cx + 1, 43, 9, 5, '#78350f');
        this.rect(ctx, cx + 4, 42, 3, 7, '#d97706');
        this.rect(ctx, cx + 2, 44, 7, 3, '#d97706');
        this.rect(ctx, cx + 5, 44, 1, 3, '#451a03');
        this.px(ctx, cx + 5, 45, '#f59e0b');
      }
      // Axle
      this.rect(ctx, 13, 45, 27, 3, '#451a03');
      this.rect(ctx, 15, 45, 23, 1, '#92400e');

      // Cart box outline / boards
      this.rect(ctx, 8, 27, 34, 2, '#451a03');
      this.rect(ctx, 7, 29, 36, 13, '#451a03');
      this.rect(ctx, 9, 42, 32, 3, '#451a03');
      this.rect(ctx, 9, 28, 32, 2, '#b45309');
      this.rect(ctx, 8, 30, 34, 11, '#78350f');
      this.rect(ctx, 10, 31, 30, 3, '#b45309');
      this.rect(ctx, 10, 35, 30, 2, '#92400e');
      this.rect(ctx, 10, 38, 30, 2, '#a16207');
      this.rect(ctx, 10, 41, 30, 2, '#5c3310');
      // Vertical board seams and nail heads
      for (const x of [14, 20, 26, 32, 38]) {
        this.rect(ctx, x, 30, 1, 11, '#451a03');
        this.px(ctx, x, 32, '#d97706');
        this.px(ctx, x, 39, '#d97706');
      }
      this.rect(ctx, 7, 26, 36, 2, '#d97706');
      this.rect(ctx, 8, 26, 34, 1, '#f59e0b');

      // Cargo visible above cart walls
      this.rect(ctx, 11, 20, 11, 7, '#451a03');
      this.rect(ctx, 12, 19, 9, 8, '#92400e');
      this.rect(ctx, 13, 20, 7, 5, '#b45309');
      this.rect(ctx, 16, 19, 1, 8, '#f59e0b');
      this.rect(ctx, 24, 22, 8, 5, '#451a03');
      this.rect(ctx, 25, 21, 7, 6, '#a16207');
      this.rect(ctx, 26, 22, 5, 3, '#d97706');
      this.rect(ctx, 34, 19, 7, 8, '#451a03');
      this.rect(ctx, 35, 18, 6, 9, '#b45309');
      this.rect(ctx, 36, 20, 4, 5, '#f59e0b');
      this.px(ctx, 14, 21, '#fbbf24'); this.px(ctx, 28, 23, '#fbbf24'); this.px(ctx, 38, 20, '#fde68a');

      // Shafts from cart to horse
      this.rect(ctx, 40, 34, 13, 2, '#451a03');
      this.rect(ctx, 41, 33, 12, 1, '#92400e');
      this.rect(ctx, 40, 39, 13, 2, '#451a03');
      this.rect(ctx, 41, 39, 12, 1, '#92400e');

      // === DRAFT OX / BULLOCK at the front/right ===
      // Rear legs
      this.rect(ctx, 45, 39, 4, 14, '#3f2314');
      this.rect(ctx, 46, 39, 3, 13, '#6e3c1d');
      this.rect(ctx, 52, 40, 4, 13, '#3f2314');
      this.rect(ctx, 53, 40, 2, 12, '#8d4e25');
      this.rect(ctx, 44, 52, 6, 3, '#1e293b');
      this.rect(ctx, 51, 52, 6, 3, '#1e293b');

      // Heavy Ox Barrel Body
      this.rect(ctx, 40, 28, 20, 12, '#3f2314');
      this.rect(ctx, 41, 29, 18, 10, '#6e3c1d');
      this.rect(ctx, 43, 31, 14, 6, '#f8fafc'); // White/cream hide patch
      this.rect(ctx, 44, 32, 12, 4, '#e2e8f0');

      // Front legs
      this.rect(ctx, 56, 38, 4, 15, '#3f2314');
      this.rect(ctx, 57, 38, 2, 14, '#8d4e25');
      this.rect(ctx, 60, 37, 3, 16, '#3f2314');
      this.rect(ctx, 61, 38, 2, 14, '#6e3c1d');
      this.rect(ctx, 55, 52, 6, 3, '#1e293b');
      this.rect(ctx, 59, 52, 5, 3, '#1e293b');

      // Muscular neck and broad Ox head
      this.rect(ctx, 52, 21, 9, 13, '#3f2314');
      this.rect(ctx, 53, 20, 8, 12, '#6e3c1d');
      this.rect(ctx, 57, 18, 7, 9, '#6e3c1d');
      this.rect(ctx, 60, 20, 4, 6, '#3f2314');
      // Horns
      this.rect(ctx, 56, 13, 2, 6, '#fef08a');
      this.rect(ctx, 55, 12, 2, 2, '#e2e8f0');
      this.rect(ctx, 60, 14, 2, 5, '#fef08a');
      this.rect(ctx, 61, 13, 2, 2, '#e2e8f0');
      // Eye & Snort Ring
      this.px(ctx, 61, 21, '#1e293b');
      this.rect(ctx, 62, 24, 2, 2, '#fbbf24');

      // Wooden Yoke / Harness
      this.rect(ctx, 51, 22, 3, 10, '#451a03');
      this.rect(ctx, 42, 35, 14, 1, '#451a03');
    }, 64, 64);

    // ============ LUMINI - Golden sun-blessed humanoid ============
    this.getSprite('species_lumini', (ctx) => {
      // Halo glow
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(5, 0, 6, 2);
      ctx.fillStyle = '#fde68a'; ctx.fillRect(4, 1, 8, 1);
      // Head
      ctx.fillStyle = '#fcd34d'; ctx.fillRect(5, 2, 6, 4);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(6, 2, 4, 4);
      // Eyes
      px(ctx, 7, 4, '#1e293b'); px(ctx, 9, 4, '#1e293b');
      // Mouth
      px(ctx, 8, 5, '#d97706');
      // Flowing golden robes
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(4, 6, 8, 3);
      ctx.fillStyle = '#d97706'; ctx.fillRect(5, 9, 6, 4);
      ctx.fillStyle = '#b45309'; ctx.fillRect(6, 9, 4, 4);
      // Robe trim
      ctx.fillStyle = '#fef08a'; ctx.fillRect(4, 6, 1, 3); ctx.fillRect(11, 6, 1, 3);
      // Arms
      ctx.fillStyle = '#fcd34d'; ctx.fillRect(3, 7, 1, 3); ctx.fillRect(12, 7, 1, 3);
      // Legs/feet
      ctx.fillStyle = '#92400e'; ctx.fillRect(6, 13, 2, 2); ctx.fillRect(9, 13, 2, 2);
      // Sun emblem on chest
      px(ctx, 8, 7, '#fef08a');
    });

    // ============ SYLVANII - Forest elf with leaf crown ============
    this.getSprite('species_sylvanii', (ctx) => {
      // Leaf crown
      ctx.fillStyle = '#15803d'; ctx.fillRect(4, 0, 8, 2);
      px(ctx, 3, 1, '#22c55e'); px(ctx, 12, 1, '#22c55e');
      ctx.fillStyle = '#16a34a'; ctx.fillRect(5, 0, 6, 1);
      // Head (pale green skin)
      ctx.fillStyle = '#a7f3d0'; ctx.fillRect(5, 2, 6, 4);
      // Pointed ears
      px(ctx, 4, 2, '#a7f3d0'); px(ctx, 11, 2, '#a7f3d0');
      px(ctx, 3, 1, '#86efac'); px(ctx, 12, 1, '#86efac');
      // Eyes
      px(ctx, 7, 3, '#065f46'); px(ctx, 9, 3, '#065f46');
      // Hair strands
      ctx.fillStyle = '#065f46'; ctx.fillRect(5, 2, 1, 1); ctx.fillRect(10, 2, 1, 1);
      // Nature cloak
      ctx.fillStyle = '#16a34a'; ctx.fillRect(4, 6, 8, 4);
      ctx.fillStyle = '#15803d'; ctx.fillRect(5, 10, 6, 3);
      // Cloak leaf pattern
      px(ctx, 6, 7, '#22c55e'); px(ctx, 9, 8, '#22c55e'); px(ctx, 7, 9, '#22c55e');
      // Belt
      ctx.fillStyle = '#854d0e'; ctx.fillRect(5, 9, 6, 1);
      // Legs
      ctx.fillStyle = '#064e3b'; ctx.fillRect(6, 13, 2, 2); ctx.fillRect(9, 13, 2, 2);
      // Bow on back
      px(ctx, 3, 6, '#92400e'); px(ctx, 3, 7, '#92400e'); px(ctx, 3, 8, '#92400e');
    });

    // ============ STONEKIN - Armored dwarf-like warrior ============
    this.getSprite('species_stonekin', (ctx) => {
      // Helmet
      ctx.fillStyle = '#64748b'; ctx.fillRect(4, 1, 8, 3);
      ctx.fillStyle = '#475569'; ctx.fillRect(3, 2, 10, 2);
      // Helmet visor slit
      ctx.fillStyle = '#1e293b'; ctx.fillRect(5, 3, 6, 1);
      // Glowing eyes through visor
      px(ctx, 6, 3, '#f59e0b'); px(ctx, 9, 3, '#f59e0b');
      // Helmet crest
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(7, 0, 2, 2);
      // Plate armor body
      ctx.fillStyle = '#475569'; ctx.fillRect(3, 4, 10, 6);
      ctx.fillStyle = '#64748b'; ctx.fillRect(4, 4, 8, 5);
      // Armor plate highlights
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(5, 5, 2, 1); ctx.fillRect(9, 5, 2, 1);
      // Belt buckle
      px(ctx, 7, 8, '#fbbf24'); px(ctx, 8, 8, '#fbbf24');
      // Shield on left arm
      ctx.fillStyle = '#334155'; ctx.fillRect(1, 5, 3, 5);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 6, 3, 3);
      px(ctx, 2, 7, '#38bdf8'); // Shield gem
      // Axe on right
      ctx.fillStyle = '#78350f'; ctx.fillRect(12, 4, 1, 5);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(12, 3, 2, 2);
      // Legs (armored greaves)
      ctx.fillStyle = '#334155'; ctx.fillRect(5, 10, 3, 4); ctx.fillRect(8, 10, 3, 4);
      // Boots
      ctx.fillStyle = '#1e293b'; ctx.fillRect(5, 13, 3, 2); ctx.fillRect(8, 13, 3, 2);
    });

    // ============ EMBERKIN - Flame demon ============
    this.getSprite('species_emberkin', (ctx) => {
      // Horns (obsidian curved)
      ctx.fillStyle = '#18181b';
      px(ctx, 3, 0, '#18181b'); px(ctx, 4, 1, '#18181b');
      px(ctx, 12, 0, '#18181b'); px(ctx, 11, 1, '#18181b');
      px(ctx, 2, 0, '#27272a'); px(ctx, 13, 0, '#27272a');
      // Head (dark red skin)
      ctx.fillStyle = '#991b1b'; ctx.fillRect(5, 2, 6, 4);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(6, 2, 4, 4);
      // Glowing ember eyes
      px(ctx, 7, 3, '#fbbf24'); px(ctx, 9, 3, '#fbbf24');
      px(ctx, 7, 4, '#f59e0b'); px(ctx, 9, 4, '#f59e0b');
      // Fangs
      px(ctx, 7, 5, '#e2e8f0'); px(ctx, 9, 5, '#e2e8f0');
      // Body with lava veins
      ctx.fillStyle = '#dc2626'; ctx.fillRect(4, 6, 8, 4);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(5, 6, 6, 4);
      // Lava vein glow on torso
      px(ctx, 6, 7, '#f59e0b'); px(ctx, 8, 8, '#fbbf24'); px(ctx, 10, 7, '#f59e0b');
      // Dark lower robes
      ctx.fillStyle = '#1e1b4b'; ctx.fillRect(5, 10, 6, 3);
      // Clawed hands
      px(ctx, 3, 8, '#ef4444'); px(ctx, 12, 8, '#ef4444');
      // Feet with glow
      ctx.fillStyle = '#991b1b'; ctx.fillRect(6, 13, 2, 2); ctx.fillRect(9, 13, 2, 2);
      px(ctx, 7, 14, '#f59e0b'); px(ctx, 10, 14, '#f59e0b');
    });

    // ============ DRAGON - Elder Dragon boss ============
    this.getSprite('species_dragon', (ctx) => {
      // Wings
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(0, 4, 4, 6); ctx.fillRect(12, 4, 4, 6);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(1, 5, 3, 4); ctx.fillRect(12, 5, 3, 4);
      // Wing membrane detail
      px(ctx, 1, 6, '#b91c1c'); px(ctx, 14, 6, '#b91c1c');
      // Horns
      ctx.fillStyle = '#18181b';
      px(ctx, 4, 1, '#18181b'); px(ctx, 5, 2, '#18181b');
      px(ctx, 11, 1, '#18181b'); px(ctx, 10, 2, '#18181b');
      // Head
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(5, 3, 6, 4);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(6, 3, 4, 3);
      // Eyes (fierce yellow)
      px(ctx, 6, 4, '#fbbf24'); px(ctx, 9, 4, '#fbbf24');
      // Nostrils
      px(ctx, 7, 5, '#f59e0b'); px(ctx, 8, 5, '#f59e0b');
      // Body (scaled)
      ctx.fillStyle = '#dc2626'; ctx.fillRect(4, 7, 8, 5);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(5, 7, 6, 5);
      // Chest scales (lighter)
      ctx.fillStyle = '#fca5a5'; ctx.fillRect(6, 8, 4, 3);
      // Scale pattern
      px(ctx, 5, 8, '#b91c1c'); px(ctx, 10, 9, '#b91c1c'); px(ctx, 7, 10, '#b91c1c');
      // Tail
      ctx.fillStyle = '#991b1b'; ctx.fillRect(6, 12, 4, 2);
      px(ctx, 5, 13, '#7f1d1d'); px(ctx, 10, 13, '#7f1d1d');
      // Claws
      px(ctx, 4, 11, '#fbbf24'); px(ctx, 11, 11, '#fbbf24');
      // Fire breath particles
      px(ctx, 3, 5, '#f59e0b'); px(ctx, 2, 4, '#fbbf24');
    });

    // ============ BOAR (Javali Selvagem) ============
    this.getSprite('species_boar', (ctx) => {
      ctx.fillStyle = '#78350f'; ctx.fillRect(3, 6, 10, 6);
      ctx.fillStyle = '#451a03'; ctx.fillRect(4, 7, 8, 4);
      ctx.fillStyle = '#92400e'; ctx.fillRect(1, 7, 4, 4);
      px(ctx, 1, 8, '#fca5a5');
      px(ctx, 2, 10, '#f8fafc'); px(ctx, 4, 10, '#f8fafc');
      px(ctx, 3, 7, '#ef4444');
      ctx.fillStyle = '#451a03';
      ctx.fillRect(4, 12, 2, 3); ctx.fillRect(10, 12, 2, 3);
    });

    // ============ EAGLE (Águia Imperial) ============
    this.getSprite('species_eagle', (ctx) => {
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 5, 14, 3);
      ctx.fillStyle = '#92400e'; ctx.fillRect(3, 4, 10, 2);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(6, 2, 4, 4);
      px(ctx, 9, 4, '#fbbf24'); px(ctx, 10, 5, '#d97706');
      px(ctx, 7, 3, '#1e293b');
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(6, 10, 4, 3);
    });

    // ============ MAMMOTH (Mamute Ancião) ============
    this.getSprite('species_mammoth', (ctx) => {
      ctx.fillStyle = '#451a03'; ctx.fillRect(2, 4, 12, 9);
      ctx.fillStyle = '#78350f'; ctx.fillRect(4, 2, 8, 5);
      ctx.fillStyle = '#451a03'; ctx.fillRect(1, 5, 4, 6);
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 9, 2, 5);
      ctx.fillStyle = '#fef08a';
      px(ctx, 0, 11, '#fef08a'); px(ctx, 1, 12, '#fef08a'); px(ctx, 2, 11, '#fef08a');
      ctx.fillStyle = '#291305';
      ctx.fillRect(3, 13, 3, 3); ctx.fillRect(10, 13, 3, 3);
    });

    // ============ DEER ============
    this.getSprite('species_deer', (ctx) => {
      // Antlers
      ctx.fillStyle = '#92400e';
      px(ctx, 4, 0, '#92400e'); px(ctx, 3, 1, '#92400e'); px(ctx, 5, 1, '#92400e');
      px(ctx, 11, 0, '#92400e'); px(ctx, 10, 1, '#92400e'); px(ctx, 12, 1, '#92400e');
      // Head
      ctx.fillStyle = '#d97706'; ctx.fillRect(5, 2, 6, 4);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(6, 3, 4, 2);
      // Eyes
      px(ctx, 7, 3, '#18181b'); px(ctx, 9, 3, '#18181b');
      // Nose
      px(ctx, 8, 5, '#78350f');
      // Body
      ctx.fillStyle = '#d97706'; ctx.fillRect(3, 6, 10, 5);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(4, 7, 8, 3);
      // Spots
      px(ctx, 5, 7, '#fde68a'); px(ctx, 9, 8, '#fde68a'); px(ctx, 7, 9, '#fde68a');
      // White belly
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(5, 9, 6, 2);
      // Legs
      ctx.fillStyle = '#92400e';
      ctx.fillRect(4, 11, 2, 4); ctx.fillRect(10, 11, 2, 4);
      // Hooves
      ctx.fillStyle = '#451a03';
      ctx.fillRect(4, 14, 2, 1); ctx.fillRect(10, 14, 2, 1);
      // Tail
      px(ctx, 13, 7, '#fef3c7');
    });

    // ============ WOLF ============
    this.getSprite('species_wolf', (ctx) => {
      // Ears
      px(ctx, 4, 1, '#475569'); px(ctx, 5, 2, '#475569');
      px(ctx, 10, 1, '#475569'); px(ctx, 11, 2, '#475569');
      // Head
      ctx.fillStyle = '#64748b'; ctx.fillRect(4, 3, 8, 4);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(5, 4, 6, 2);
      // Fierce red eyes
      px(ctx, 6, 4, '#ef4444'); px(ctx, 9, 4, '#ef4444');
      // Snout
      ctx.fillStyle = '#475569'; ctx.fillRect(3, 5, 3, 2);
      px(ctx, 3, 5, '#1e293b'); // Nose
      // Fangs
      px(ctx, 4, 6, '#e2e8f0'); px(ctx, 5, 6, '#e2e8f0');
      // Body
      ctx.fillStyle = '#64748b'; ctx.fillRect(3, 7, 10, 4);
      ctx.fillStyle = '#475569'; ctx.fillRect(4, 8, 8, 2);
      // Fur highlights
      px(ctx, 5, 7, '#94a3b8'); px(ctx, 9, 7, '#94a3b8');
      // Belly
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(5, 10, 6, 1);
      // Legs
      ctx.fillStyle = '#334155';
      ctx.fillRect(4, 11, 2, 4); ctx.fillRect(10, 11, 2, 4);
      // Paws
      px(ctx, 4, 14, '#1e293b'); px(ctx, 5, 14, '#1e293b');
      px(ctx, 10, 14, '#1e293b'); px(ctx, 11, 14, '#1e293b');
      // Bushy tail
      ctx.fillStyle = '#475569'; ctx.fillRect(12, 7, 2, 2);
      px(ctx, 13, 9, '#64748b');
    });

    // ============ BEAR ============
    this.getSprite('species_bear', (ctx) => {
      // Ears
      ctx.fillStyle = '#78350f'; ctx.fillRect(3, 1, 3, 2); ctx.fillRect(10, 1, 3, 2);
      px(ctx, 4, 1, '#92400e'); px(ctx, 11, 1, '#92400e');
      // Head
      ctx.fillStyle = '#78350f'; ctx.fillRect(3, 3, 10, 4);
      ctx.fillStyle = '#92400e'; ctx.fillRect(4, 3, 8, 3);
      // Eyes
      px(ctx, 5, 4, '#fbbf24'); px(ctx, 10, 4, '#fbbf24');
      // Nose/snout
      ctx.fillStyle = '#451a03'; ctx.fillRect(6, 5, 4, 2);
      px(ctx, 7, 5, '#18181b'); px(ctx, 8, 5, '#18181b');
      // Massive body
      ctx.fillStyle = '#78350f'; ctx.fillRect(2, 7, 12, 5);
      ctx.fillStyle = '#92400e'; ctx.fillRect(3, 7, 10, 4);
      // Chest patch
      ctx.fillStyle = '#d97706'; ctx.fillRect(6, 8, 4, 3);
      // Arms with claws
      ctx.fillStyle = '#5a3207'; ctx.fillRect(1, 8, 2, 4); ctx.fillRect(13, 8, 2, 4);
      px(ctx, 1, 11, '#e2e8f0'); px(ctx, 14, 11, '#e2e8f0'); // Claws
      // Legs
      ctx.fillStyle = '#451a03'; ctx.fillRect(4, 12, 3, 3); ctx.fillRect(9, 12, 3, 3);
      // Paws
      px(ctx, 4, 14, '#e2e8f0'); px(ctx, 9, 14, '#e2e8f0');
    });

    // ============ BUILDINGS ============
    // Pixel-art 16×16 with depth, shadow, texture, structural realism.
    // Each building tells a mini-story of its era and purpose.

    // Town Center — grand medieval seat of local rule
    this.getSprite('b_town_center', (ctx) => {
      // Stepped stone foundation
      ctx.fillStyle = '#78716c'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(1, 14, 14, 2);
      // Deep terracotta tile roof, gabled with ridge
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 1, 14, 5);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 0, 12, 3);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(3, 2, 10, 1);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(5, 3, 6, 1);
      // Stone chimney left side
      ctx.fillStyle = '#57534e'; ctx.fillRect(12, 0, 2, 4);
      ctx.fillStyle = '#44403c'; ctx.fillRect(13, 0, 1, 4);
      // Smoke puff
      px(ctx, 12, 0, '#a8a29e'); px(ctx, 13, 0, '#d6d3d1');
      // Main hall — dressed ashlar stone, two-tone
      ctx.fillStyle = '#64748b'; ctx.fillRect(2, 6, 12, 8);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(3, 6, 10, 7);
      ctx.fillStyle = '#7e8fa6'; ctx.fillRect(4, 6, 8, 6);
      // Mortar lines, horizontal coursing
      ctx.fillStyle = '#475569';
      ctx.fillRect(2, 8, 12, 1); ctx.fillRect(2, 10, 12, 1);
      ctx.fillRect(2, 12, 12, 1);
      // Grand double-door with iron hinges
      ctx.fillStyle = '#451a03'; ctx.fillRect(6, 9, 5, 5);
      ctx.fillStyle = '#78350f'; ctx.fillRect(7, 9, 3, 4);
      ctx.fillStyle = '#1c1917'; ctx.fillRect(7, 10, 3, 1);
      ctx.fillStyle = '#92400e'; ctx.fillRect(6, 8, 5, 1);
      px(ctx, 7, 12, '#fbbf24'); px(ctx, 9, 12, '#d97706');
      // High windows with warm candle-glow
      ctx.fillStyle = '#0f172a'; ctx.fillRect(3, 7, 2, 3); ctx.fillRect(11, 7, 2, 3);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(4, 8, 1, 1); ctx.fillRect(12, 8, 1, 1);
      px(ctx, 4, 7, '#fde68a'); px(ctx, 12, 7, '#fde68a');
      // Gable vent
      ctx.fillStyle = '#1e293b'; ctx.fillRect(7, 4, 2, 2);
    });

    // ===== TOWN CENTER ERA VARIANTS =====
    // Bronze — mead-hall of a chieftain
    this.getSprite('b_town_center_bronze', (ctx) => {
      ctx.fillStyle = '#451a03'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 14, 14, 1);
      // Longhouse — deep thatch roof dipping low
      ctx.fillStyle = '#3f2410'; ctx.fillRect(0, 1, 16, 6);
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(1, 2, 14, 4);
      ctx.fillStyle = '#7c3a0e'; ctx.fillRect(2, 3, 12, 2);
      // Thatch streaks
      ctx.fillStyle = '#451a03'; ctx.fillRect(2, 1, 1, 5); ctx.fillRect(8, 2, 1, 4); ctx.fillRect(13, 1, 1, 5);
      // Ridge log pole
      ctx.fillStyle = '#292524'; ctx.fillRect(3, 0, 10, 1);
      // Turf/timber walls
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 7, 14, 6);
      ctx.fillStyle = '#92400e'; ctx.fillRect(2, 8, 12, 4);
      // Horizontal log coursing
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(1, 9, 14, 1); ctx.fillRect(1, 11, 14, 1);
      // Vertical post ends
      ctx.fillStyle = '#451a03'; ctx.fillRect(2, 7, 1, 6); ctx.fillRect(13, 7, 1, 6);
      // Grand door (huge logs)
      ctx.fillStyle = '#292524'; ctx.fillRect(6, 8, 4, 5);
      ctx.fillStyle = '#451a03'; ctx.fillRect(7, 9, 2, 3);
      // Carved doorway beam
      ctx.fillStyle = '#92400e'; ctx.fillRect(5, 7, 6, 1);
      px(ctx, 7, 11, '#d97706');
      // Side fire-glow openings
      ctx.fillStyle = '#ea580c'; px(ctx, 3, 10, '#ea580c'); px(ctx, 12, 10, '#ea580c');
      // Banner pole
      ctx.fillStyle = '#78350f'; ctx.fillRect(14, 1, 1, 6);
      ctx.fillStyle = '#b45309'; ctx.fillRect(13, 1, 2, 3);
    });

    // Iron — stone-nobility walled court (castle keep)
    this.getSprite('b_town_center_iron', (ctx) => {
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 13, 14, 2);
      // Stone hall with battlements
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 4, 14, 10);
      ctx.fillStyle = '#64748b'; ctx.fillRect(2, 5, 12, 8);
      ctx.fillStyle = '#7e8fa6'; ctx.fillRect(3, 6, 10, 6);
      // Crenellations
      ctx.fillStyle = '#334155';
      ctx.fillRect(1, 0, 3, 5); ctx.fillRect(6, 0, 3, 5); ctx.fillRect(11, 0, 3, 5);
      ctx.fillStyle = '#475569';
      ctx.fillRect(1, 0, 2, 4); ctx.fillRect(6, 0, 2, 4); ctx.fillRect(11, 0, 2, 4);
      // Stone courses
      ctx.fillStyle = '#334155';
      ctx.fillRect(1, 7, 14, 1); ctx.fillRect(1, 10, 14, 1);
      // Banner pole
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(14, 0, 1, 5);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(13, 0, 2, 3);
      // Gatehouse with iron-banded door
      ctx.fillStyle = '#0f172a'; ctx.fillRect(6, 7, 4, 7);
      ctx.fillStyle = '#1c1917'; ctx.fillRect(7, 8, 2, 5);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(6, 7, 4, 1);
      // Iron rivets
      px(ctx, 6, 9, '#475569'); px(ctx, 9, 9, '#475569'); px(ctx, 7, 12, '#475569');
      // Slit windows with torch-glow
      px(ctx, 3, 6, '#fef08a'); px(ctx, 12, 6, '#fef08a');
      px(ctx, 3, 9, '#fef08a'); px(ctx, 12, 9, '#fef08a');
    });

    // Classical — temple precinct / classical basilica
    this.getSprite('b_town_center_classical', (ctx) => {
      // Marble stylobate
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 14, 14, 1);
      // Marble hall
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(1, 6, 14, 8);
      ctx.fillStyle = '#f5f5f4'; ctx.fillRect(2, 7, 12, 6);
      // Grand pediment
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(1, 3, 14, 3);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(2, 4, 12, 2);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(3, 5, 10, 1);
      // Gilded cornice
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(1, 5, 14, 1);
      // Six grand columns
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(1, 6, 2, 8); ctx.fillRect(4, 6, 2, 8); ctx.fillRect(7, 6, 2, 8);
      ctx.fillRect(10, 6, 2, 8); ctx.fillRect(13, 6, 2, 8);
      ctx.fillStyle = '#e2e8f0'; px(ctx, 1, 6, '#cbd5e1'); px(ctx, 4, 6, '#cbd5e1');
      px(ctx, 7, 6, '#cbd5e1'); px(ctx, 10, 6, '#cbd5e1'); px(ctx, 13, 6, '#cbd5e1');
      ctx.fillStyle = '#fbbf24'; px(ctx, 2, 6, '#fbbf24'); px(ctx, 5, 6, '#fbbf24'); px(ctx, 8, 6, '#fbbf24');
      px(ctx, 11, 6, '#fbbf24'); px(ctx, 14, 6, '#fbbf24');
      // Pediment sculpture / wreath
      ctx.fillStyle = '#d97706'; ctx.fillRect(7, 2, 2, 2);
      ctx.fillStyle = '#fbbf24'; px(ctx, 7, 2, '#fde047'); px(ctx, 8, 2, '#fde047');
      // Bronze civic doors
      ctx.fillStyle = '#451a03'; ctx.fillRect(6, 8, 4, 5);
      ctx.fillStyle = '#92400e'; ctx.fillRect(7, 9, 2, 4);
      ctx.fillStyle = '#fbbf24'; px(ctx, 7, 10, '#fbbf24');
      // Architrave inscription band
      ctx.fillStyle = '#1c1917'; ctx.fillRect(2, 6, 12, 1);
    });

    // Industrial — town hall with clocktower
    this.getSprite('b_town_center_industrial', (ctx) => {
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 13, 14, 2);
      // Red-brick body
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 5, 14, 8);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 6, 12, 6);
      // Mortar coursing
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 8, 14, 1); ctx.fillRect(1, 11, 14, 1);
      px(ctx, 3, 6, '#991b1b'); px(ctx, 7, 6, '#991b1b'); px(ctx, 12, 9, '#991b1b');
      // Slate roof
      ctx.fillStyle = '#1c1917'; ctx.fillRect(1, 4, 14, 1);
      ctx.fillStyle = '#292524'; ctx.fillRect(2, 3, 12, 2);
      // Central clocktower rising taller
      ctx.fillStyle = '#78716c'; ctx.fillRect(6, 0, 4, 8);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(6, 0, 1, 7);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(7, 0, 2, 7);
      // Clock face
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(7, 2, 2, 2);
      ctx.fillStyle = '#1c1917'; px(ctx, 7, 2, '#1c1917'); px(ctx, 8, 3, '#1c1917');
      // Tower slate roof
      ctx.fillStyle = '#292524'; ctx.fillRect(5, 0, 6, 1);
      ctx.fillStyle = '#1c1917'; px(ctx, 7, 0, '#1c1917'); px(ctx, 8, 0, '#1c1917');
      // Round-arch windows
      ctx.fillStyle = '#1c1917'; ctx.fillRect(3, 6, 2, 3); ctx.fillRect(11, 6, 2, 3);
      ctx.fillStyle = '#fbbf24'; px(ctx, 4, 6, '#fbbf24'); px(ctx, 9, 6, '#fbbf24');
      ctx.fillStyle = '#facc15'; ctx.fillRect(3, 7, 2, 1); ctx.fillRect(11, 7, 2, 1);
      // Grand entrance arch
      ctx.fillStyle = '#0f172a'; ctx.fillRect(6, 9, 4, 3);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(6, 9, 4, 1);
      ctx.fillStyle = '#3f3f46'; px(ctx, 8, 9, '#94a3b8');
    });

    // Modern — civic city hall, glass and concrete
    this.getSprite('b_town_center_modern', (ctx) => {
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 14, 14, 1);
      // Concrete-and-glass tower
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 3, 12, 10);
      ctx.fillStyle = '#64748b'; ctx.fillRect(3, 4, 10, 8);
      // Glass curtain facade — blue tinted
      ctx.fillStyle = '#0ea5e9'; ctx.fillRect(3, 4, 10, 8);
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(4, 4, 8, 1); ctx.fillRect(4, 8, 8, 1);
      // Floor divisions
      ctx.fillStyle = '#1e293b'; ctx.fillRect(3, 6, 10, 1); ctx.fillRect(3, 10, 10, 1);
      // Lit offices
      px(ctx, 4, 5, '#fde68a'); px(ctx, 7, 5, '#fde68a'); px(ctx, 10, 5, '#fde68a');
      px(ctx, 5, 7, '#fde68a'); px(ctx, 9, 9, '#fde68a');
      // Flat concrete roof / slab
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(1, 2, 14, 2);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(2, 3, 12, 1);
      // Civic flag pole
      ctx.fillStyle = '#475569'; ctx.fillRect(7, 0, 1, 2);
      ctx.fillStyle = '#ef4444'; px(ctx, 6, 0, '#ef4444'); px(ctx, 7, 0, '#ef4444');
      // Plinth + grand stairs
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 12, 16, 1);
      // Glass entrance lobby
      ctx.fillStyle = '#7dd3fc'; ctx.fillRect(5, 11, 6, 2);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(7, 11, 2, 2);
    });

    // House — humble timber-frame cottage with thatch
    this.getSprite('b_house', (ctx) => {
      // Earth plinth
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 14, 14, 2);
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 14, 12, 1);
      // Thatch roof, thick and slightly uneven
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 2, 14, 5);
      ctx.fillStyle = '#92400e'; ctx.fillRect(2, 1, 12, 2);
      ctx.fillStyle = '#a16207'; ctx.fillRect(3, 3, 10, 2);
      ctx.fillStyle = '#ca8a04'; ctx.fillRect(4, 4, 8, 1);
      // Thatch streak texture
      ctx.fillStyle = '#854d0e'; ctx.fillRect(3, 2, 1, 3); ctx.fillRect(8, 3, 1, 3);
      ctx.fillRect(11, 2, 1, 3);
      // Ridge beam
      ctx.fillStyle = '#451a03'; ctx.fillRect(4, 1, 8, 1);
      // Timber-framed wattle walls
      ctx.fillStyle = '#92400e'; ctx.fillRect(2, 7, 12, 7);
      ctx.fillStyle = '#b45309'; ctx.fillRect(3, 8, 10, 5);
      // Timber post exposes
      ctx.fillStyle = '#78350f';
      ctx.fillRect(3, 7, 1, 6); ctx.fillRect(12, 7, 1, 6);
      ctx.fillRect(6, 7, 1, 6); ctx.fillRect(9, 7, 1, 6);
      // Horizontal wattle infill line
      ctx.fillStyle = '#a16207'; ctx.fillRect(4, 10, 10, 1);
      // Shuttered window left
      ctx.fillStyle = '#451a03'; ctx.fillRect(4, 8, 3, 3);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(5, 9, 1, 1);
      // Door
      ctx.fillStyle = '#451a03'; ctx.fillRect(10, 9, 4, 5);
      ctx.fillStyle = '#78350f'; ctx.fillRect(11, 10, 2, 3);
      px(ctx, 12, 12, '#d97706');
      // Flower box under window
      px(ctx, 4, 11, '#22c55e'); px(ctx, 6, 11, '#ef4444');
    });

    // ===== HOUSE ERA VARIANTS (WorldBox-style progression) =====
    // Era do Bronze — wattle-and-daub hut now sturdier, larger
    this.getSprite('b_house_bronze', (ctx) => {
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 14, 14, 2);
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 14, 12, 1);
      // Steeper conical thatch
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 0, 12, 6);
      ctx.fillStyle = '#78350f'; ctx.fillRect(3, 1, 10, 5);
      ctx.fillStyle = '#92400e'; ctx.fillRect(3, 4, 10, 2);
      ctx.fillStyle = '#a16207'; ctx.fillRect(4, 5, 8, 1);
      // Thatch layers
      ctx.fillStyle = '#7c3a0e'; ctx.fillRect(3, 2, 1, 4); ctx.fillRect(8, 3, 1, 3); ctx.fillRect(11, 2, 1, 4);
      // Mud-brick walls (earthen tone)
      ctx.fillStyle = '#a16207'; ctx.fillRect(2, 7, 12, 7);
      ctx.fillStyle = '#b45309'; ctx.fillRect(3, 8, 10, 5);
      // Mud-brick coursing
      ctx.fillStyle = '#78350f'; ctx.fillRect(2, 7, 12, 1); ctx.fillRect(2, 10, 12, 1);
      // Timber corner posts
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 7, 1, 7); ctx.fillRect(13, 7, 1, 7);
      // Window bronze-edged
      ctx.fillStyle = '#451a03'; ctx.fillRect(4, 8, 3, 3);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(5, 9, 1, 1);
      // Door dark wood
      ctx.fillStyle = '#451a03'; ctx.fillRect(9, 9, 4, 5);
      ctx.fillStyle = '#78350f'; ctx.fillRect(10, 10, 2, 3);
      px(ctx, 12, 12, '#d97706');
    });

    // Era do Ferro — true medieval timber cottage, no longer a hut
    this.getSprite('b_house_iron', (ctx) => {
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 14, 12, 1);
      // Red-tile roof (genuine medieval)
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 2, 14, 4);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 1, 12, 3);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(3, 3, 10, 1);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(4, 4, 8, 1);
      // Tile streaks
      ctx.fillStyle = '#991b1b'; ctx.fillRect(3, 2, 1, 3); ctx.fillRect(7, 2, 1, 3); ctx.fillRect(11, 2, 1, 3);
      // Timber frame half-timbered walls (Tudor)
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(1, 6, 14, 9);
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(2, 7, 12, 7);
      ctx.fillStyle = '#f5f5f4'; ctx.fillRect(3, 8, 10, 5);
      // Brown timber cross-frame
      ctx.fillStyle = '#451a03';
      ctx.fillRect(2, 6, 1, 9); ctx.fillRect(13, 6, 1, 9);
      ctx.fillRect(7, 6, 1, 9); ctx.fillRect(1, 9, 14, 1);
      // Decorative diagonal brace
      ctx.fillStyle = '#78350f'; px(ctx, 5, 7, '#78350f'); px(ctx, 6, 8, '#78350f'); px(ctx, 9, 11, '#78350f');
      // Lattice window cross
      ctx.fillStyle = '#fef08a'; ctx.fillRect(3, 7, 2, 2); ctx.fillRect(9, 7, 2, 2);
      ctx.fillStyle = '#5c2d0e'; px(ctx, 4, 7, '#5c2d0e'); px(ctx, 10, 7, '#5c2d0e');
      // Heavy door
      ctx.fillStyle = '#451a03'; ctx.fillRect(5, 8, 4, 6);
      ctx.fillStyle = '#78350f'; ctx.fillRect(6, 9, 2, 4);
      px(ctx, 7, 11, '#d97706');
    });

    // Era Clássica — refined stone-and-stucco townhouse
    this.getSprite('b_house_classical', (ctx) => {
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 14, 14, 1);
      // Red clay-tile roof, tidy
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 2, 14, 5);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 1, 12, 4);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(3, 3, 10, 1);
      // Roof eaves shadow
      ctx.fillStyle = '#1c1917'; ctx.fillRect(1, 6, 14, 1);
      // Stucco walls (cream)
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(1, 7, 14, 7);
      ctx.fillStyle = '#f5f5f4'; ctx.fillRect(2, 8, 12, 5);
      // Stone quoined corners
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(1, 7, 1, 7); ctx.fillRect(14, 7, 1, 7);
      ctx.fillStyle = '#d6d3d1'; px(ctx, 1, 9, '#a8a29e'); px(ctx, 1, 12, '#a8a29e');
      px(ctx, 14, 9, '#a8a29e'); px(ctx, 14, 12, '#a8a29e');
      // Two pane windows with shutters
      ctx.fillStyle = '#0f172a'; ctx.fillRect(3, 8, 4, 3); ctx.fillRect(9, 8, 4, 3);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(4, 9, 2, 2); ctx.fillRect(10, 9, 2, 2);
      px(ctx, 4, 9, '#fef08a'); px(ctx, 10, 9, '#fef08a');
      // Shutters
      ctx.fillStyle = '#b45309'; ctx.fillRect(2, 8, 1, 3); ctx.fillRect(7, 8, 1, 3);
      ctx.fillRect(8, 8, 1, 3); ctx.fillRect(13, 8, 1, 3);
      // Central wood door
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(6, 7, 4, 7);
      ctx.fillStyle = '#451a03'; ctx.fillRect(7, 8, 2, 5);
      px(ctx, 8, 11, '#d97706');
      // Window flower box
      px(ctx, 5, 11, '#ef4444'); px(ctx, 11, 11, '#22c55e');
      // Chimney
      ctx.fillStyle = '#475569'; ctx.fillRect(12, 0, 2, 3);
      px(ctx, 12, 0, '#94a3b8'); px(ctx, 13, 0, '#64748b');
    });

    // Era Industrial — Victorian brick terrace house
    this.getSprite('b_house_industrial', (ctx) => {
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 14, 14, 1);
      // Slate roof, dark and flat
      ctx.fillStyle = '#1c1917'; ctx.fillRect(1, 2, 14, 4);
      ctx.fillStyle = '#292524'; ctx.fillRect(2, 2, 12, 3);
      ctx.fillStyle = '#44403c'; ctx.fillRect(3, 3, 10, 1);
      // Slate tile lines
      ctx.fillStyle = '#1c1917'; ctx.fillRect(3, 2, 1, 4); ctx.fillRect(8, 2, 1, 4); ctx.fillRect(12, 2, 1, 4);
      // Chimney (two flues)
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 0, 2, 3); ctx.fillRect(11, 0, 2, 3);
      ctx.fillStyle = '#57534e'; px(ctx, 2, 0, '#1c1917'); px(ctx, 12, 0, '#1c1917');
      // Red-brick terrace walls
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 6, 14, 9);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 7, 12, 7);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(2, 9, 12, 4);
      // Brick mortar coursing
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 9, 14, 1); ctx.fillRect(1, 12, 14, 1);
      ctx.fillStyle = '#57534e'; px(ctx, 4, 7, '#57534e'); px(ctx, 8, 7, '#57534e');
      px(ctx, 11, 10, '#57534e'); px(ctx, 4, 11, '#57534e');
      // Sash windows (grid panes)
      ctx.fillStyle = '#1c1917'; ctx.fillRect(3, 7, 4, 4); ctx.fillRect(9, 7, 4, 4);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(3, 7, 4, 1); ctx.fillRect(9, 7, 4, 1);
      ctx.fillRect(3, 9, 4, 1); ctx.fillRect(9, 9, 4, 1);
      // Lit glass
      px(ctx, 4, 8, '#fde68a'); px(ctx, 10, 8, '#fde68a');
      // Panel door (Victorian) with transom window
      ctx.fillStyle = '#0f172a'; ctx.fillRect(7, 9, 4, 5);
      ctx.fillStyle = '#451a03'; ctx.fillRect(8, 10, 2, 4);
      ctx.fillStyle = '#78350f'; px(ctx, 8, 10, '#fde68a');
      px(ctx, 8, 14, '#fbbf24');
    });

    // Era Moderna — suburban home with clean lines
    this.getSprite('b_house_modern', (ctx) => {
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#64748b'; ctx.fillRect(1, 14, 14, 1);
      // Flat modern roof
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 4, 16, 2);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 4, 14, 1);
      // White rendered walls
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(1, 6, 14, 8);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(2, 7, 12, 6);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(2, 7, 12, 5);
      // Horizontal banded accents (mid-century)
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(1, 10, 14, 1);
      // Large picture window — glass curtain
      ctx.fillStyle = '#0ea5e9'; ctx.fillRect(2, 8, 7, 4);
      ctx.fillStyle = '#7dd3fc'; ctx.fillRect(2, 8, 7, 1);
      ctx.fillStyle = '#bae6fd'; px(ctx, 3, 9, '#bae6fd'); px(ctx, 5, 10, '#bae6fd');
      // Window mullions
      ctx.fillStyle = '#475569'; ctx.fillRect(5, 8, 1, 4); ctx.fillRect(8, 8, 1, 4);
      // Stone garage door right
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(9, 8, 6, 6);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(10, 9, 4, 4);
      // Garage panel sections
      ctx.fillStyle = '#64748b'; ctx.fillRect(10, 10, 4, 1); ctx.fillRect(10, 11, 4, 1);
      // Modern front door (orange accent)
      ctx.fillStyle = '#f97316'; ctx.fillRect(4, 10, 3, 4);
      ctx.fillStyle = '#fb923c'; px(ctx, 5, 12, '#fde68a');
      // Minimal landscaping
      px(ctx, 1, 13, '#22c55e'); px(ctx, 14, 13, '#22c55e');
    });

    this.getSprite('b_farm', (ctx) => {
      // Tilled soil, rich farm earth
      ctx.fillStyle = '#5c3d2e'; ctx.fillRect(0, 2, 16, 14);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(1, 3, 14, 12);
      // Plow furrows
      ctx.fillStyle = '#4a2f1a';
      ctx.fillRect(1, 4, 14, 1); ctx.fillRect(1, 7, 14, 1);
      ctx.fillRect(1, 10, 14, 1); ctx.fillRect(1, 13, 14, 1);
      // Crop rows — alternating wheat green and gold
      ctx.fillStyle = '#166534';
      ctx.fillRect(2, 4, 12, 1); ctx.fillRect(2, 10, 12, 1);
      ctx.fillStyle = '#15803d'; ctx.fillRect(3, 3, 10, 1); ctx.fillRect(3, 9, 10, 1);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(2, 6, 12, 1); ctx.fillRect(2, 12, 12, 1);
      ctx.fillStyle = '#fde047'; ctx.fillRect(3, 5, 10, 1); ctx.fillRect(3, 11, 10, 1);
      // Grain spikes
      px(ctx, 2, 2, '#fef08a'); px(ctx, 5, 2, '#fef08a'); px(ctx, 10, 2, '#fef08a');
      px(ctx, 3, 8, '#fde047'); px(ctx, 8, 8, '#fde047'); px(ctx, 12, 8, '#fde047');
      // Scarecrow post center top
      ctx.fillStyle = '#78350f'; ctx.fillRect(7, 0, 2, 4);
      ctx.fillStyle = '#451a03'; ctx.fillRect(6, 0, 4, 1);
      px(ctx, 7, 1, '#fef3c7'); px(ctx, 8, 1, '#fef3c7');
      // Water trough
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(11, 13, 4, 2);
      ctx.fillStyle = '#7dd3fc'; ctx.fillRect(11, 13, 4, 1);
    });

    // ===== FARM ERA VARIANTS =====
    // Bronze — irrigated plots with simple wooden plow
    this.getSprite('b_farm_bronze', (ctx) => {
      ctx.fillStyle = '#5c3d2e'; ctx.fillRect(0, 1, 16, 15);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(1, 2, 14, 13);
      // Irrigation channel (blue)
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0, 7, 16, 1);
      ctx.fillStyle = '#3b82f6'; px(ctx, 3, 7, '#7dd3fc'); px(ctx, 11, 7, '#7dd3fc');
      // Furrows deeper
      ctx.fillStyle = '#4a2f1a'; ctx.fillRect(1, 3, 14, 1); ctx.fillRect(1, 5, 14, 1);
      ctx.fillRect(1, 9, 14, 1); ctx.fillRect(1, 11, 14, 1); ctx.fillRect(1, 13, 14, 1);
      // Rows of barley (bronze-age grain)
      ctx.fillStyle = '#ca8a04'; ctx.fillRect(2, 4, 12, 1); ctx.fillRect(2, 10, 12, 1);
      ctx.fillStyle = '#eab308'; ctx.fillRect(3, 4, 10, 1); ctx.fillRect(3, 12, 10, 1);
      ctx.fillStyle = '#fde047'; px(ctx, 2, 2, '#fde047'); px(ctx, 6, 2, '#fde047'); px(ctx, 12, 2, '#fde047');
      px(ctx, 3, 8, '#fde047'); px(ctx, 9, 8, '#fde047'); px(ctx, 12, 8, '#fde047');
      // Wooden plow center
      ctx.fillStyle = '#78350f'; ctx.fillRect(6, 1, 4, 1); ctx.fillRect(7, 0, 2, 3);
      ctx.fillStyle = '#5c2d0e'; px(ctx, 7, 1, '#5c2d0e'); px(ctx, 8, 1, '#5c2d0e');
      // Grain store basket
      ctx.fillStyle = '#92400e'; ctx.fillRect(1, 14, 3, 1); ctx.fillRect(12, 14, 3, 1);
    });

    // Iron — fenced wheat field with better furrows
    this.getSprite('b_farm_iron', (ctx) => {
      ctx.fillStyle = '#5c3d2e'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(1, 1, 14, 14);
      // Wide band of wheat (dominant)
      ctx.fillStyle = '#166534'; ctx.fillRect(1, 2, 14, 12);
      ctx.fillStyle = '#15803d'; ctx.fillRect(2, 3, 12, 10);
      // Wheat rows tighter
      ctx.fillStyle = '#eab308';
      ctx.fillRect(2, 4, 12, 1); ctx.fillRect(2, 7, 12, 1);
      ctx.fillRect(2, 10, 12, 1); ctx.fillRect(2, 13, 12, 1);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(3, 5, 10, 1); ctx.fillRect(3, 8, 10, 1);
      ctx.fillRect(3, 11, 10, 1);
      // Dense wheat heads
      px(ctx, 2, 2, '#fef08a'); px(ctx, 5, 2, '#fef08a'); px(ctx, 8, 2, '#fef08a'); px(ctx, 11, 2, '#fef08a'); px(ctx, 13, 2, '#fef08a');
      px(ctx, 1, 8, '#fde047'); px(ctx, 6, 8, '#fde047'); px(ctx, 13, 8, '#fde047');
      // Split-rail fence
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, 1, 16, 1); ctx.fillRect(0, 14, 16, 1);
      ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
      // Stone boundary marker
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(2, 0, 2, 2);
      // Cattle gate
      ctx.fillStyle = '#92400e'; ctx.fillRect(7, 0, 3, 1); ctx.fillRect(7, 15, 3, 1);
    });

    // Classical — Roman villa field with rows and irrigation
    this.getSprite('b_farm_classical', (ctx) => {
      ctx.fillStyle = '#5c3d2e'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(1, 1, 14, 14);
      // VineyardGrid rows (classical order)
      ctx.fillStyle = '#166534'; ctx.fillRect(2, 2, 12, 1); ctx.fillRect(2, 5, 12, 1);
      ctx.fillRect(2, 8, 12, 1); ctx.fillRect(2, 11, 12, 1);
      ctx.fillStyle = '#15803d'; ctx.fillRect(3, 3, 10, 1); ctx.fillRect(3, 6, 10, 1);
      ctx.fillRect(3, 9, 10, 1); ctx.fillRect(3, 12, 10, 1);
      // Grapes clusters
      ctx.fillStyle = '#7c3aed';
      px(ctx, 3, 4, '#7c3aed'); px(ctx, 6, 4, '#7c3aed'); px(ctx, 9, 4, '#7c3aed'); px(ctx, 12, 4, '#7c3aed');
      px(ctx, 3, 7, '#7c3aed'); px(ctx, 6, 7, '#7c3aed'); px(ctx, 10, 7, '#7c3aed');
      px(ctx, 4, 10, '#7c3aed'); px(ctx, 8, 10, '#7c3aed'); px(ctx, 11, 10, '#7c3aed');
      // Wheat rows still
      ctx.fillStyle = '#eab308'; ctx.fillRect(3, 13, 10, 1);
      ctx.fillStyle = '#fde047'; px(ctx, 3, 13, '#fde047'); px(ctx, 8, 13, '#fde047'); px(ctx, 11, 13, '#fde047');
      // End posts (stake)
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 2, 1, 11); ctx.fillRect(14, 2, 1, 11);
      // Olive tree corner
      ctx.fillStyle = '#22c55e'; px(ctx, 1, 14, '#16a34a'); ctx.fillStyle = '#15803d'; px(ctx, 2, 13, '#15803d');
    });

    // Industrial — mechanized field, tractor furrows
    this.getSprite('b_farm_industrial', (ctx) => {
      ctx.fillStyle = '#5c3d2e'; ctx.fillRect(0, 1, 16, 15);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(1, 2, 14, 13);
      // Mechanical straight furrows
      ctx.fillStyle = '#3f2410';
      ctx.fillRect(1, 3, 14, 2); ctx.fillRect(1, 7, 14, 2); ctx.fillRect(1, 11, 14, 2);
      ctx.fillStyle = '#4a2f1a';
      ctx.fillRect(1, 6, 14, 1); ctx.fillRect(1, 10, 14, 1); ctx.fillRect(1, 14, 14, 1);
      // Tall amber wheat
      ctx.fillStyle = '#ca8a04'; ctx.fillRect(2, 4, 12, 1); ctx.fillRect(2, 8, 12, 1); ctx.fillRect(2, 12, 12, 1);
      ctx.fillStyle = '#fde047'; px(ctx, 3, 4, '#fde047'); px(ctx, 8, 4, '#fde047'); px(ctx, 12, 4, '#fde047');
      px(ctx, 3, 12, '#fde047'); px(ctx, 8, 12, '#fde047'); px(ctx, 12, 12, '#fde047');
      // Iron fence top, barbed style
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 1, 16, 1);
      ctx.fillStyle = '#1c1917'; px(ctx, 2, 0, '#1c1917'); px(ctx, 6, 0, '#1c1917'); px(ctx, 11, 0, '#1c1917'); px(ctx, 14, 0, '#1c1917');
      // Rust tractor peek
      ctx.fillStyle = '#dc2626'; ctx.fillRect(11, 3, 3, 2);
      ctx.fillStyle = '#451a03'; px(ctx, 11, 4, '#451a03'); px(ctx, 13, 4, '#451a03');
      // Windmill pole
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(2, 0, 1, 3);
    });

    // Modern — intensive agribusiness, irrigation grid
    this.getSprite('b_farm_modern', (ctx) => {
      ctx.fillStyle = '#3f2410'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#4a2f1a'; ctx.fillRect(1, 1, 14, 14);
      // Center-pivot circular green plot
      ctx.fillStyle = '#166534'; ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#15803d'; ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(5, 4, 6, 1); ctx.fillRect(4, 6, 8, 1); ctx.fillRect(5, 9, 6, 1);
      // Irrigation pivot arm
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(8, 3, 1, 11);
      ctx.fillStyle = '#78716c'; px(ctx, 8, 3, '#78716c'); px(ctx, 8, 14, '#78716c');
      // Sprinkler droplets
      ctx.fillStyle = '#38bdf8'; px(ctx, 6, 5, '#38bdf8'); px(ctx, 10, 7, '#38bdf8');
      px(ctx, 5, 10, '#38bdf8'); px(ctx, 11, 11, '#38bdf8');
      // Concrete strips
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1);
      ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
      // Crop color banding (mono-cultural)
      ctx.fillStyle = '#eab308'; ctx.fillRect(3, 12, 10, 1);
      ctx.fillStyle = '#fde047'; px(ctx, 4, 12, '#fde047'); px(ctx, 8, 12, '#fde047'); px(ctx, 11, 12, '#fde047');
      // Storage silo corner
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(13, 1, 2, 3);
      ctx.fillStyle = '#94a3b8'; px(ctx, 13, 1, '#475569');
    });

    // Mine — mountainside shaft with timber gallows frame
    this.getSprite('b_mine', (ctx) => {
      // Mountain rock face
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 2, 16, 14);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 3, 14, 12);
      ctx.fillStyle = '#64748b'; ctx.fillRect(2, 3, 12, 10);
      // Rock strata bands
      ctx.fillStyle = '#3b4f6b'; ctx.fillRect(2, 6, 12, 1);
      ctx.fillStyle = '#334155'; ctx.fillRect(2, 9, 12, 1); ctx.fillRect(2, 13, 12, 1);
      // Rock chip highlights
      ctx.fillStyle = '#94a3b8';
      px(ctx, 3, 4, '#94a3b8'); px(ctx, 10, 5, '#94a3b8'); px(ctx, 5, 8, '#94a3b8');
      px(ctx, 13, 7, '#94a3b8'); px(ctx, 4, 12, '#94a3b8');
      // Dark cave entrance
      ctx.fillStyle = '#0f172a'; ctx.fillRect(5, 8, 6, 7);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(6, 7, 4, 2);
      // Timber gallows frame over entrance
      ctx.fillStyle = '#78350f'; ctx.fillRect(4, 6, 1, 9); ctx.fillRect(11, 6, 1, 9);
      ctx.fillStyle = '#92400e'; ctx.fillRect(4, 6, 8, 1);
      ctx.fillStyle = '#a16207'; ctx.fillRect(5, 5, 6, 1);
      // Cross-beam
      ctx.fillStyle = '#451a03'; ctx.fillRect(3, 9, 10, 1);
      // Lantern glowing inside
      px(ctx, 7, 10, '#fbbf24'); px(ctx, 8, 11, '#f59e0b');
      // Ore cart rails at bottom
      ctx.fillStyle = '#1c1917'; ctx.fillRect(6, 14, 5, 1);
      // Gold/iron ore sparkle
      px(ctx, 3, 4, '#fbbf24'); px(ctx, 13, 7, '#a8a29e');
    });

    // Barracks — military quarters, squat stone with parapet
    this.getSprite('b_barracks', (ctx) => {
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 14, 16, 2);
      // Main block — cut stone
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 5, 14, 10);
      ctx.fillStyle = '#64748b'; ctx.fillRect(2, 5, 12, 9);
      ctx.fillStyle = '#7e8fa6'; ctx.fillRect(3, 6, 10, 7);
      // Battlements crenellations
      ctx.fillStyle = '#475569';
      ctx.fillRect(2, 0, 2, 5); ctx.fillRect(6, 0, 2, 5);
      ctx.fillRect(10, 0, 2, 5); ctx.fillRect(12, 0, 2, 5);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(2, 1, 2, 4); ctx.fillRect(6, 1, 2, 4);
      ctx.fillRect(10, 1, 2, 4); ctx.fillRect(12, 1, 2, 4);
      // Parapet top line
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(1, 6, 14, 1);
      // Stone courses
      ctx.fillStyle = '#334155';
      ctx.fillRect(2, 9, 12, 1); ctx.fillRect(2, 12, 12, 1);
      // Iron-bound door
      ctx.fillStyle = '#1c1917'; ctx.fillRect(6, 9, 4, 5);
      ctx.fillStyle = '#292524'; ctx.fillRect(7, 10, 2, 3);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(6, 10, 4, 1);
      // Arrow slit left
      ctx.fillStyle = '#0f172a'; ctx.fillRect(3, 7, 1, 3);
      // Red banner on pole right
      ctx.fillStyle = '#78350f'; ctx.fillRect(14, 1, 1, 5);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(13, 1, 2, 3);
      px(ctx, 13, 2, '#fca5a5');
    });

    // ===== BARRACKS ERA VARIANTS =====
    // Bronze — longhouse warriors' lodge
    this.getSprite('b_barracks_bronze', (ctx) => {
      ctx.fillStyle = '#451a03'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(1, 14, 14, 1);
      // Thatch roof low and long
      ctx.fillStyle = '#3f2410'; ctx.fillRect(1, 1, 14, 5);
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 2, 12, 3);
      // Heavy timber walls (log stockade style)
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 6, 14, 8);
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 7, 12, 6);
      // Log vertical lines
      ctx.fillStyle = '#451a03';
      ctx.fillRect(3, 6, 1, 8); ctx.fillRect(6, 6, 1, 8); ctx.fillRect(9, 6, 1, 8); ctx.fillRect(12, 6, 1, 8);
      // Bronze axe rack
      ctx.fillStyle = '#ea580c'; px(ctx, 2, 6, '#ea580c'); px(ctx, 2, 8, '#ea580c');
      ctx.fillStyle = '#cbd5e1'; px(ctx, 3, 6, '#cbd5e1'); px(ctx, 3, 8, '#cbd5e1');
      // Door dark
      ctx.fillStyle = '#1c1917'; ctx.fillRect(6, 8, 4, 5);
      // Shield hung outside
      ctx.fillStyle = '#a16207'; ctx.fillRect(12, 9, 2, 3);
      ctx.fillStyle = '#451a03'; px(ctx, 13, 10, '#cbd5e1');
      // Fire glow
      px(ctx, 5, 9, '#ea580c');
    });

    // Iron: tempered castrum barracks
    this.getSprite('b_barracks_iron', (ctx) => {
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 14, 14, 1);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 4, 14, 10);
      ctx.fillStyle = '#64748b'; ctx.fillRect(2, 5, 12, 8);
      ctx.fillStyle = '#475569'; ctx.fillRect(3, 6, 10, 6);
      // Block lines
      ctx.fillStyle = '#334155'; ctx.fillRect(1, 7, 14, 1); ctx.fillRect(1, 10, 14, 1);
      // Red slate roof
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 2, 14, 3);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(1, 1, 14, 1);
      // Crenellation x3 broad
      ctx.fillStyle = '#64748b';
      ctx.fillRect(1, 0, 3, 3); ctx.fillRect(6, 0, 3, 3); ctx.fillRect(11, 0, 3, 3);
      // Heavy iron door
      ctx.fillStyle = '#0f172a'; ctx.fillRect(7, 8, 3, 4);
      ctx.fillStyle = '#1c1917'; ctx.fillRect(8, 9, 1, 2);
      // Arrow slit left
      ctx.fillStyle = '#0f172a'; ctx.fillRect(3, 6, 1, 2);
      // Shield on wall
      ctx.fillStyle = '#475569'; ctx.fillRect(13, 7, 2, 3);
      px(ctx, 13, 8, '#cbd5e1'); px(ctx, 14, 8, '#94a3b8');
      // Red banner
      ctx.fillStyle = '#dc2626'; ctx.fillRect(11, 1, 2, 2);
    });

    // Classical: Roman castra / principia
    this.getSprite('b_barracks_classical', (ctx) => {
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 15, 14, 1);
      // Marble front
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(1, 6, 14, 8);
      ctx.fillStyle = '#f5f5f4'; ctx.fillRect(2, 7, 12, 6);
      // Red tile classic roof
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 2, 14, 4);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 1, 12, 2);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(3, 3, 10, 1);
      // Eagle/statuette on ridge
      ctx.fillStyle = '#fbbf24'; px(ctx, 7, 1, '#fbbf24'); px(ctx, 8, 1, '#fde047');
      // Marble columns fluted
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(2, 7, 1, 7); ctx.fillRect(5, 7, 1, 7); ctx.fillRect(9, 7, 1, 7); ctx.fillRect(12, 7, 1, 7);
      // Pilum and shield fading
      ctx.fillStyle = '#ef4444'; px(ctx, 3, 6, '#ef4444'); px(ctx, 4, 6, '#b91c1c');
      ctx.fillStyle = '#e2e8f0'; px(ctx, 10, 8, '#e2e800'); px(ctx, 13, 8, '#e2e8f0');
      // SPQR banner
      ctx.fillStyle = '#dc2626'; ctx.fillRect(13, 1, 2, 4);
    });

    // Industrial: garrison stronghold brick
    this.getSprite('b_barracks_industrial', (ctx) => {
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 13, 14, 2);
      // Stock red brick
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 3, 14, 9);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 4, 12, 7);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 6, 14, 1); ctx.fillRect(1, 9, 14, 1);
      // Flat cap
      ctx.fillStyle = '#292524'; ctx.fillRect(1, 2, 14, 1);
      // Crenellations
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(1, 0, 3, 3); ctx.fillRect(7, 0, 3, 3); ctx.fillRect(12, 0, 3, 3);
      // Rifles / guns rack
      ctx.fillStyle = '#1c1917'; ctx.fillRect(2, 7, 3, 1);
      ctx.fillStyle = '#475569'; px(ctx, 3, 8, '#475569'); px(ctx, 4, 8, '#9ca3af');
      // Barred door
      ctx.fillStyle = '#0f172a'; ctx.fillRect(8, 8, 3, 4);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(9, 9, 1, 2);
      // Flagpole left
      ctx.fillStyle = '#475569'; ctx.fillRect(11, 0, 1, 5);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(12, 1, 2, 2);
    });

    // Modern: concrete military compound
    this.getSprite('b_barracks_modern', (ctx) => {
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 13, 14, 2);
      // White reinforced concrete block
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 4, 14, 8);
      ctx.fillStyle = '#64748b'; ctx.fillRect(2, 5, 12, 6);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(2, 5, 12, 1);
      // Flat roof with antenna
      ctx.fillStyle = '#334155'; ctx.fillRect(1, 3, 14, 1);
      ctx.fillStyle = '#1c1917'; ctx.fillRect(7, 0, 1, 3);
      ctx.fillStyle = '#475569'; px(ctx, 7, 0, '#475569');
      // Slit window with blue tint
      ctx.fillStyle = '#0ea5e9'; ctx.fillRect(3, 6, 2, 1); ctx.fillRect(10, 6, 2, 1);
      // Cargo door
      ctx.fillStyle = '#0f172a'; ctx.fillRect(7, 9, 3, 3);
      // Armor plate rivet
      px(ctx, 9, 7, '#64748b');
      // Flag pole
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 0, 1, 3);
      ctx.fillStyle = '#dc2626'; px(ctx, 2, 0, '#ef4444'); px(ctx, 2, 1, '#22c55e');
    });

    // Temple — marble sanctuary with golden dome and portico
    this.getSprite('b_temple', (ctx) => {
      // Wide stone steps
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(2, 14, 12, 2);
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(3, 14, 10, 1);
      // Marble portico — four fluted columns
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(3, 6, 2, 8); ctx.fillRect(7, 6, 2, 8); ctx.fillRect(11, 6, 2, 8);
      // Column bases
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(3, 13, 2, 1); ctx.fillRect(7, 13, 2, 1); ctx.fillRect(11, 13, 2, 1);
      // Column capitals
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(3, 6, 2, 1); ctx.fillRect(7, 6, 2, 1); ctx.fillRect(11, 6, 2, 1);
      // Inner sanctum — warm holy glow
      ctx.fillStyle = '#fef08a'; ctx.fillRect(5, 7, 6, 5);
      ctx.fillStyle = '#fde68a'; ctx.fillRect(6, 8, 4, 3);
      // Marble pediment
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(2, 4, 12, 2);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(3, 3, 10, 1);
      // Golden dome crowning
      ctx.fillStyle = '#b45309'; ctx.fillRect(5, 0, 6, 3);
      ctx.fillStyle = '#d97706'; ctx.fillRect(6, 1, 4, 2);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(7, 1, 2, 1);
      px(ctx, 7, 0, '#fef3c7'); px(ctx, 8, 0, '#fef3c7');
      // Stained glass visible between columns
      px(ctx, 6, 9, '#a855f7'); px(ctx, 9, 9, '#3b82f6'); px(ctx, 10, 9, '#ef4444');
      // Altar flame
      px(ctx, 8, 11, '#f97316');
    });

    // ===== MARKET ERA VARIANTS =====
    // Bronze — open-air barter log
    this.getSprite('b_market_bronze', (ctx) => {
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 13, 16, 3);
      // Two simple log counters
      ctx.fillStyle = '#78350f'; ctx.fillRect(2, 10, 5, 2); ctx.fillRect(9, 10, 5, 2);
      ctx.fillStyle = '#92400e'; ctx.fillRect(3, 10, 3, 1); ctx.fillRect(10, 10, 3, 1);
      // Raw goods: copper ingot, salt, food
      px(ctx, 3, 9, '#ea580c'); px(ctx, 4, 9, '#f1f5f9'); px(ctx, 5, 9, '#fbbf24');
      px(ctx, 10, 9, '#22c55e'); px(ctx, 11, 9, '#b45309'); px(ctx, 12, 9, '#f59e0b');
      // Hides hanging from pole
      ctx.fillStyle = '#78350f'; ctx.fillRect(6, 3, 1, 8);
      ctx.fillStyle = '#451a03'; ctx.fillRect(4, 0, 5, 3);
      ctx.fillStyle = '#a16207'; ctx.fillRect(1, 0, 5, 3);
      // Rough poles sides
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(1, 5, 1, 8); ctx.fillRect(14, 5, 1, 8);
      // Goods pile on ground
      px(ctx, 2, 14, '#ca8a04'); px(ctx, 3, 14, '#eab308');
    });

    // Iron — covered stall with proper thatch awning
    this.getSprite('b_market_iron', (ctx) => {
      ctx.fillStyle = '#78716c'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 4, 1, 10); ctx.fillRect(14, 4, 1, 10);
      // Slate-thatch awning
      ctx.fillStyle = '#3f2410'; ctx.fillRect(1, 1, 14, 3);
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 2, 12, 1);
      ctx.fillStyle = '#7c3a0e'; px(ctx, 3, 2, '#7c3a0e'); px(ctx, 8, 2, '#7c3a0e'); px(ctx, 12, 2, '#7c3a0e');
      // Wooden counter
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 9, 12, 3);
      ctx.fillStyle = '#78350f'; ctx.fillRect(3, 9, 10, 2);
      // Iron goods: tools, weapons, cloth
      px(ctx, 4, 8, '#64748b'); px(ctx, 5, 8, '#cbd5e1'); px(ctx, 6, 8, '#38bdf8');
      px(ctx, 10, 8, '#ef4444'); px(ctx, 11, 8, '#fbbf24'); px(ctx, 13, 8, '#a855f7');
      // Hanging scale
      px(ctx, 7, 6, '#cbd5e1'); px(ctx, 8, 5, '#94a3b8');
      // Iron tools leaning
      px(ctx, 8, 7, '#475569'); px(ctx, 9, 8, '#64748b');
    });

    // Classical — permanent agora / forum stall
    this.getSprite('b_market_classical', (ctx) => {
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 14, 14, 1);
      // Marble colonnade
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(1, 6, 1, 8); ctx.fillRect(14, 6, 1, 8);
      ctx.fillStyle = '#f5f5f4'; px(ctx, 1, 7, '#f5f5f4'); px(ctx, 14, 7, '#f5f5f4');
      // Tiled awning
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 2, 14, 3);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 2, 12, 2);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(3, 3, 10, 1);
      // Awning frieze
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(1, 5, 14, 1);
      // Counter
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 10, 12, 2);
      ctx.fillStyle = '#78350f'; ctx.fillRect(4, 10, 8, 1);
      // Wares: amphorae, olives, gold coin
      ctx.fillStyle = '#b45309'; ctx.fillRect(3, 7, 1, 3); ctx.fillRect(5, 7, 1, 3); ctx.fillRect(7, 7, 1, 3);
      px(ctx, 9, 8, '#22c55e'); px(ctx, 10, 8, '#22c55e');
      px(ctx, 12, 9, '#fbbf24'); px(ctx, 13, 9, '#fde047');
      // Marble statue-pillar
      ctx.fillStyle = '#d6d3d1'; px(ctx, 11, 6, '#d6d3d1');
    });

    // Industrial — full arcade market hall with lanterns
    this.getSprite('b_market_industrial', (ctx) => {
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 14, 14, 1);
      // Glass-and-iron roof
      ctx.fillStyle = '#1e293b'; ctx.fillRect(1, 2, 14, 4);
      ctx.fillStyle = '#0ea5e9'; ctx.fillRect(2, 2, 12, 1);
      ctx.fillStyle = '#7dd3fc'; px(ctx, 3, 2, '#7dd3fc'); px(ctx, 8, 2, '#7dd3fc'); px(ctx, 12, 2, '#7dd3fc');
      // Light green iron columns
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 6, 1, 8); ctx.fillRect(13, 6, 1, 8);
      ctx.fillStyle = '#94a3b8'; px(ctx, 2, 7, '#94a3b8'); px(ctx, 13, 7, '#94a3b8');
      // Hanging gas lanterns
      ctx.fillStyle = '#fbbf24'; px(ctx, 3, 4, '#fbbf24'); px(ctx, 12, 4, '#fbbf24');
      // Stall tables
      ctx.fillStyle = '#78350f'; ctx.fillRect(2, 9, 12, 3);
      ctx.fillStyle = '#92400e'; ctx.fillRect(3, 10, 10, 1);
      // Ironwares / factory goods
      px(ctx, 3, 8, '#fbbf24'); px(ctx, 5, 8, '#475569'); px(ctx, 7, 8, '#ef4444');
      px(ctx, 9, 8, '#22c55e'); px(ctx, 11, 8, '#3b82f6');
      // Canopy sign
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(6, 3, 4, 1);
    });

    // Modern — glass supermarket front
    this.getSprite('b_market_modern', (ctx) => {
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#64748b'; ctx.fillRect(1, 14, 14, 1);
      // Steel and glass facade
      ctx.fillStyle = '#0ea5e9'; ctx.fillRect(1, 5, 14, 8);
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(2, 6, 12, 6);
      ctx.fillStyle = '#bae6fd'; px(ctx, 2, 6, '#bae6fd'); px(ctx, 13, 6, '#bae6fd');
      // Flat roof slab
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 4, 16, 2);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 4, 14, 1);
      // Glass shelves
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(2, 8, 12, 1); ctx.fillRect(2, 10, 12, 1);
      // Colorful goods on shelves
      ctx.fillStyle = '#ef4444'; px(ctx, 3, 9, '#ef4444'); px(ctx, 5, 9, '#ef4444');
      ctx.fillStyle = '#22c55e'; px(ctx, 7, 9, '#22c55e'); px(ctx, 8, 9, '#22c55e');
      ctx.fillStyle = '#fbbf24'; px(ctx, 10, 9, '#fbbf24'); px(ctx, 12, 9, '#fbbf24');
      ctx.fillStyle = '#f59e0b'; px(ctx, 3, 11, '#f59e0b'); px(ctx, 8, 11, '#f59e0b'); px(ctx, 12, 11, '#f59e0b');
      // Checkout counter
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(4, 12, 8, 1);
      // Neon sign
      ctx.fillStyle = '#facc15'; ctx.fillRect(6, 2, 4, 1);
      ctx.fillStyle = '#f97316'; px(ctx, 7, 2, '#f97316');
    });

    // Market — covered bazaar stall under striped awning
    this.getSprite('b_market', (ctx) => {
      // Packed dirt ground
      ctx.fillStyle = '#78716c'; ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(1, 13, 14, 2);
      // Timber support poles
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 4, 1, 10); ctx.fillRect(14, 4, 1, 10);
      ctx.fillStyle = '#44403c'; px(ctx, 2, 4, '#44403c'); px(ctx, 15, 4, '#44403c');
      // Canvas awning, bold stripes
      ctx.fillStyle = '#dc2626'; ctx.fillRect(1, 1, 14, 3);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(2, 2, 13, 1);
      // Tan stripes
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(3, 1, 2, 3); ctx.fillRect(7, 1, 2, 3); ctx.fillRect(11, 1, 2, 3);
      // Awning scallop edge
      ctx.fillStyle = '#ef4444'; ctx.fillRect(1, 4, 14, 1);
      // Heavy wooden counter
      ctx.fillStyle = '#78350f'; ctx.fillRect(2, 9, 12, 3);
      ctx.fillStyle = '#92400e'; ctx.fillRect(3, 9, 10, 2);
      ctx.fillStyle = '#a16207'; ctx.fillRect(3, 10, 10, 1);
      // Goods laid out — colorful wares
      ctx.fillStyle = '#ef4444'; ctx.fillRect(4, 8, 2, 1);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(7, 8, 2, 1);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(10, 8, 2, 1);
      // Amber jar
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(13, 6, 1, 3);
      // Roll of cloth
      ctx.fillStyle = '#8b5cf6'; ctx.fillRect(5, 7, 2, 2);
      // Crate
      ctx.fillStyle = '#b45309'; ctx.fillRect(9, 7, 2, 2);
      // Scale / weight
      px(ctx, 12, 7, '#cbd5e1'); px(ctx, 12, 6, '#94a3b8');
      // Loose coins on counter
      px(ctx, 6, 11, '#fbbf24'); px(ctx, 13, 10, '#fee2e2');
    });

    // Wall — defensive curtain wall with battlements and archer slits
    this.getSprite('b_wall', (ctx) => {
      // Stone base/trench
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 14, 16, 2);
      // Crenellations: merlons spaced with arrow slits
      ctx.fillStyle = '#475569';
      ctx.fillRect(1, 0, 3, 5); ctx.fillRect(6, 0, 3, 5);
      ctx.fillRect(11, 0, 3, 5); ctx.fillRect(13, 0, 3, 5);
      // Merlon faces (front highlight)
      ctx.fillStyle = '#64748b';
      ctx.fillRect(1, 0, 3, 4); ctx.fillRect(6, 0, 3, 4);
      ctx.fillRect(11, 0, 3, 4); ctx.fillRect(13, 0, 3, 4);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(1, 0, 3, 1);
      // Arrow slits between merlons
      ctx.fillStyle = '#0f172a';
      px(ctx, 5, 4, '#0f172a'); px(ctx, 5, 5, '#0f172a');
      px(ctx, 10, 4, '#0f172a'); px(ctx, 10, 5, '#0f172a');
      // Main wall body — large stone blocks
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 5, 16, 8);
      ctx.fillStyle = '#64748b'; ctx.fillRect(0, 5, 16, 7);
      ctx.fillStyle = '#7e8fa6'; ctx.fillRect(1, 6, 14, 5);
      // Masonry joints
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 8, 16, 1);
      ctx.fillRect(0, 11, 16, 1);
      // Vertical block divisions
      px(ctx, 4, 5, '#334155'); px(ctx, 8, 5, '#334155');
      px(ctx, 12, 6, '#334155');
      // Wall walk / parapet line
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 6, 16, 1);
      // Gate pass-through arch
      ctx.fillStyle = '#1c1917'; ctx.fillRect(7, 9, 3, 4);
      ctx.fillStyle = '#292524'; ctx.fillRect(8, 10, 1, 2);
    });

    // ===== WALL ERA VARIANTS =====
    // Bronze — earthwork palisade
    this.getSprite('b_wall_bronze', (ctx) => {
      ctx.fillStyle = '#5c3d2e'; ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(1, 13, 14, 2);
      // Log palisade stakes
      ctx.fillStyle = '#78350f';
      for (let i = 0; i < 8; i++) ctx.fillRect(i * 2 + (i % 2), 3, 1, 11);
      ctx.fillStyle = '#5c2d0e';
      for (let i = 0; i < 8; i++) px(ctx, i * 2 + (i % 2), 3, '#5c2d0e');
      // Sharpened tops
      px(ctx, 1, 2, '#a16207'); px(ctx, 5, 2, '#a16207'); px(ctx, 9, 2, '#a16207'); px(ctx, 13, 2, '#a16207');
      // Cross-beam binding
      ctx.fillStyle = '#451a03'; ctx.fillRect(0, 6, 16, 1); ctx.fillRect(0, 9, 16, 1);
      // Earth rampart base
      ctx.fillStyle = '#4a2f1a'; ctx.fillRect(0, 14, 16, 2);
    });

    // Iron — mortared stone curtain wall
    this.getSprite('b_wall_iron', (ctx) => {
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 14, 14, 1);
      // Large stone blocks
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 3, 16, 11);
      ctx.fillStyle = '#64748b'; ctx.fillRect(1, 4, 14, 9);
      ctx.fillStyle = '#7e8fa6'; ctx.fillRect(2, 5, 12, 7);
      // Block joints
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 6, 16, 1); ctx.fillRect(0, 9, 16, 1); ctx.fillRect(0, 12, 16, 1);
      px(ctx, 4, 3, '#334155'); px(ctx, 8, 3, '#334155'); px(ctx, 12, 3, '#334155');
      // Merlons simple
      ctx.fillStyle = '#475569';
      ctx.fillRect(1, 0, 2, 4); ctx.fillRect(4, 0, 2, 4); ctx.fillRect(7, 0, 2, 4);
      ctx.fillRect(10, 0, 2, 4); ctx.fillRect(13, 0, 2, 4);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(1, 0, 2, 3); ctx.fillRect(4, 0, 2, 3); ctx.fillRect(7, 0, 2, 3);
      ctx.fillRect(10, 0, 2, 3); ctx.fillRect(13, 0, 2, 3);
      // Wall walk
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 4, 16, 1);
    });

    // Classical — elegant Roman-style marble wall
    this.getSprite('b_wall_classical', (ctx) => {
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 14, 14, 1);
      // Dressed ashlar marble face
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(0, 4, 16, 10);
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(1, 5, 14, 8);
      ctx.fillStyle = '#f5f5f4'; ctx.fillRect(2, 6, 12, 6);
      // Joint lines
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, 8, 16, 1); ctx.fillRect(0, 12, 16, 1);
      px(ctx, 4, 4, '#a8a29e'); px(ctx, 8, 4, '#a8a29e'); px(ctx, 12, 4, '#a8a29e');
      px(ctx, 4, 9, '#a8a29e'); px(ctx, 11, 9, '#a8a29e');
      // Decorative leaf frieze strip
      ctx.fillStyle = '#22c55e'; ctx.fillRect(1, 5, 14, 1);
      ctx.fillStyle = '#fbbf24'; px(ctx, 3, 5, '#fbbf24'); px(ctx, 7, 5, '#fbbf24'); px(ctx, 11, 5, '#fbbf24');
      // Flat merlons
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(1, 0, 3, 5); ctx.fillRect(6, 0, 3, 5); ctx.fillRect(11, 0, 3, 5);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 0, 3, 1); ctx.fillRect(6, 0, 3, 1); ctx.fillRect(11, 0, 3, 1);
    });

    // Industrial — red-brick fortified wall
    this.getSprite('b_wall_industrial', (ctx) => {
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 14, 14, 1);
      // Deep red brick
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(0, 2, 16, 12);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(1, 3, 14, 10);
      // Brick mortar
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 5, 16, 1); ctx.fillRect(0, 8, 16, 1); ctx.fillRect(0, 11, 16, 1);
      // Crenellations — classic but modern(ish)
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(1, 0, 3, 4); ctx.fillRect(7, 0, 3, 4); ctx.fillRect(13, 0, 3, 4);
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(1, 0, 2, 4); ctx.fillRect(7, 0, 2, 4); ctx.fillRect(13, 0, 2, 4);
      // Row of cast-iron fence spikes atop merlons
      ctx.fillStyle = '#1c1917';
      px(ctx, 2, 0, '#1c1917'); px(ctx, 14, 0, '#1c1917');
    });

    // Modern — concrete retaining wall (siege-proof)
    this.getSprite('b_wall_modern', (ctx) => {
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 14, 14, 1);
      // Smooth grey concrete
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 2, 16, 12);
      ctx.fillStyle = '#64748b'; ctx.fillRect(1, 3, 14, 10);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(2, 4, 12, 8);
      // Concrete formwork lines (modern)
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 5, 16, 1); ctx.fillRect(0, 9, 16, 1); ctx.fillRect(0, 13, 16, 1);
      // Tie-hole pattern
      px(ctx, 3, 6, '#1e293b'); px(ctx, 8, 6, '#1e293b'); px(ctx, 12, 6, '#1e293b');
      px(ctx, 3, 10, '#1e293b'); px(ctx, 8, 10, '#1e293b'); px(ctx, 12, 10, '#1e293b');
      // Flat parapet
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 1, 16, 1);
      px(ctx, 7, 0, '#1c1917'); px(ctx, 8, 0, '#1c1917');
    });

    // ===== TECHNOLOGY-UNLOCKED BUILDINGS =====

    // Granary — stilted storehouse raised against vermin
    this.getSprite('b_granary', (ctx) => {
      // Raised floor on stone mushroom stilts
      ctx.fillStyle = '#57534e'; ctx.fillRect(2, 11, 3, 3); ctx.fillRect(11, 11, 3, 3);
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 11, 1, 2); ctx.fillRect(4, 11, 1, 2);
      ctx.fillRect(11, 11, 1, 2); ctx.fillRect(13, 11, 1, 2);
      // Stilt caps
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(2, 10, 3, 1); ctx.fillRect(11, 10, 3, 1);
      // Timber grain body
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, 3, 16, 8);
      ctx.fillStyle = '#92400e'; ctx.fillRect(1, 4, 14, 6);
      ctx.fillStyle = '#a16207'; ctx.fillRect(2, 4, 12, 5);
      // Vertical plank joints
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 4, 1, 6); ctx.fillRect(7, 4, 1, 6); ctx.fillRect(10, 4, 1, 6);
      // Pitched roof
      ctx.fillStyle = '#991b1b'; ctx.fillRect(0, 1, 16, 3);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(1, 2, 14, 2);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(5, 3, 6, 1);
      // Ridge cap
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(3, 0, 10, 2);
      // Grain spilling from a vent
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(6, 8, 4, 3);
      px(ctx, 7, 9, '#fde68a'); px(ctx, 8, 10, '#fde047');
      // Wooden ladder
      ctx.fillStyle = '#451a03'; ctx.fillRect(12, 6, 1, 4); ctx.fillRect(14, 6, 1, 4);
      ctx.fillRect(12, 7, 4, 1); ctx.fillRect(12, 9, 4, 1);
    });

    // Pasture — grazing field penned by split-rail fence
    this.getSprite('b_pasture', (ctx) => {
      // Rich pasture grass with varied green patches
      ctx.fillStyle = '#15803d'; ctx.fillRect(0, 6, 16, 10);
      ctx.fillStyle = '#16a34a'; ctx.fillRect(1, 5, 14, 10);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(2, 6, 5, 3); ctx.fillRect(9, 8, 5, 3);
      // Daisy clusters
      px(ctx, 4, 7, '#fde047'); px(ctx, 11, 7, '#fde047');
      px(ctx, 6, 9, '#fef3c7'); px(ctx, 13, 12, '#fde047');
      // Split-rail fence — three vertical posts across
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 6, 16, 1); ctx.fillRect(0, 12, 16, 1);
      ctx.fillRect(1, 5, 1, 8); ctx.fillRect(8, 5, 1, 8); ctx.fillRect(14, 5, 1, 8);
      // Sheep — fluffy white body
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(4, 10, 4, 3);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(4, 11, 4, 1);
      // Sheep head dark
      ctx.fillStyle = '#1c1917'; ctx.fillRect(4, 10, 2, 1);
      // Sheep legs
      ctx.fillRect(5, 13, 1, 2); ctx.fillRect(7, 13, 1, 2);
      // Brown cow, bigger
      ctx.fillStyle = '#78350f'; ctx.fillRect(10, 11, 3, 3);
      ctx.fillStyle = '#451a03'; ctx.fillRect(10, 11, 1, 1);
      ctx.fillRect(10, 14, 1, 1); ctx.fillRect(12, 14, 1, 1);
    });

    // Lumber camp — a clearing with sawn timber and axe stump
    this.getSprite('b_lumber_camp', (ctx) => {
      // Stump ground
      ctx.fillStyle = '#451a03'; ctx.fillRect(0, 11, 16, 5);
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 12, 14, 3);
      // Fresh cut tree stump center
      ctx.fillStyle = '#ca8a04'; ctx.fillRect(5, 9, 6, 2);
      ctx.fillStyle = '#a16207'; ctx.fillRect(6, 10, 4, 1);
      ctx.fillStyle = '#78350f'; ctx.fillRect(5, 8, 6, 1);
      // Annual rings
      px(ctx, 7, 9, '#eab308'); px(ctx, 8, 9, '#ca8a04');
      // Stacked logs right — end grain
      ctx.fillStyle = '#92400e'; ctx.fillRect(12, 5, 3, 3);
      ctx.fillStyle = '#b45309'; ctx.fillRect(13, 5, 1, 3);
      // Log pile left
      ctx.fillStyle = '#a16207'; ctx.fillRect(1, 6, 5, 3);
      ctx.fillStyle = '#ca8a04'; ctx.fillRect(1, 7, 5, 1);
      // Axe in stump
      ctx.fillStyle = '#57534e'; ctx.fillRect(4, 4, 1, 5);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(4, 3, 4, 2);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(4, 4, 3, 1);
      // Standing pine right bg
      ctx.fillStyle = '#166534'; ctx.fillRect(11, 2, 2, 5);
      ctx.fillStyle = '#14532d'; ctx.fillRect(11, 6, 2, 2);
      // Sapling
      ctx.fillStyle = '#22c55e'; px(ctx, 11, 4, '#22c55e');
    });

    // Quarry — open-pit terraced excavation
    this.getSprite('b_quarry', (ctx) => {
      // Deep pit walls descending, darkest at bottom
      ctx.fillStyle = '#0f172a'; ctx.fillRect(2, 12, 12, 4);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(2, 10, 12, 2);
      ctx.fillStyle = '#334155'; ctx.fillRect(1, 7, 14, 3);
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 4, 16, 3);
      // Terrace levels — horizontal steps carved in
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 6, 16, 1); ctx.fillRect(1, 9, 14, 1);
      ctx.fillRect(2, 11, 12, 1);
      // Cut stone block highlights in face
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(3, 5, 3, 1); ctx.fillRect(7, 8, 3, 1); ctx.fillRect(10, 12, 3, 1);
      // Loose cut blocks at quarry floor
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(6, 12, 3, 2);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(6, 12, 3, 1);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(10, 13, 4, 2);
      // Crane gantry pole left
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 1, 1, 5);
      ctx.fillStyle = '#92400e'; ctx.fillRect(0, 0, 3, 2);
      // Rope hanging
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 3, 1, 4);
      // Iron block hanging
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 8, 2, 2);
      // Block tracks
      ctx.fillStyle = '#292524'; ctx.fillRect(4, 15, 8, 1);
    });

    // Smithy — a scorched workshop with forge-fire and anvil
    this.getSprite('b_smithy', (ctx) => {
      // Stone base
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 14, 14, 1);
      // Stone walls blackened by soot
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 3, 16, 11);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 4, 14, 9);
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(2, 4, 12, 8);
      // Roof — pitch black underside
      ctx.fillStyle = '#1c1917'; ctx.fillRect(1, 0, 14, 3);
      ctx.fillStyle = '#292524'; ctx.fillRect(0, 1, 3, 2); ctx.fillRect(12, 1, 4, 2);
      // Chimney stack right
      ctx.fillStyle = '#1c1917'; ctx.fillRect(11, 0, 3, 5);
      ctx.fillStyle = '#475569'; ctx.fillRect(12, 0, 1, 3);
      // Forge fire — center bottom
      ctx.fillStyle = '#7c2d12'; ctx.fillRect(3, 10, 6, 4);
      ctx.fillStyle = '#c2410c'; ctx.fillRect(4, 10, 4, 3);
      ctx.fillStyle = '#ea580c'; ctx.fillRect(5, 10, 2, 2);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(5, 10, 2, 1);
      px(ctx, 6, 10, '#fef3c7'); // white-hot core
      // Anvil top left
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 9, 3, 2);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(2, 9, 3, 1);
      // Bellows pump
      ctx.fillStyle = '#78350f'; ctx.fillRect(9, 7, 3, 4);
      ctx.fillStyle = '#92400e'; ctx.fillRect(10, 8, 1, 2);
      // Quenching barrel
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(13, 10, 2, 4);
      ctx.fillStyle = '#7dd3fc'; ctx.fillRect(13, 10, 2, 1);
      // Sparks
      px(ctx, 5, 9, '#fbbf24'); px(ctx, 6, 9, '#ea580c');
    });

    // Workshop — artisan crafts: loom, pottery wheel, goods
    this.getSprite('b_workshop', (ctx) => {
      // Timber building
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 5, 14, 11);
      ctx.fillStyle = '#92400e'; ctx.fillRect(2, 6, 12, 9);
      // Shingled roof
      ctx.fillStyle = '#451a03'; ctx.fillRect(0, 2, 16, 4);
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(1, 3, 14, 2);
      ctx.fillStyle = '#78350f'; ctx.fillRect(2, 4, 12, 1);
      // Gable trim
      ctx.fillStyle = '#a16207'; ctx.fillRect(4, 1, 8, 2);
      // Loom frame left
      ctx.fillStyle = '#451a03'; ctx.fillRect(3, 7, 5, 6);
      ctx.fillStyle = '#78350f'; ctx.fillRect(3, 7, 4, 1); ctx.fillRect(4, 12, 3, 1);
      // Woven cloth pattern
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(4, 8, 3, 4);
      ctx.fillStyle = '#93c5fd'; ctx.fillRect(4, 9, 3, 2);
      // Warp threads
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(5, 8, 1, 4); ctx.fillRect(6, 8, 1, 4);
      // Pottery wheel right
      ctx.fillStyle = '#b45309'; ctx.fillRect(10, 10, 5, 2);
      ctx.fillStyle = '#d97706'; ctx.fillRect(11, 9, 3, 1);
      ctx.fillStyle = '#a16207'; ctx.fillRect(10, 12, 5, 2);
      // Wet clay pot being shaped
      ctx.fillStyle = '#78350f'; px(ctx, 11, 8, '#78350f');
      ctx.fillStyle = '#a16207'; px(ctx, 12, 8, '#a16207');
      // Finished pot shelf
      ctx.fillStyle = '#92400e'; ctx.fillRect(11, 6, 2, 2);
      ctx.fillStyle = '#b45309'; ctx.fillRect(13, 6, 2, 2);
      // Window light
      ctx.fillStyle = '#fef08a'; ctx.fillRect(8, 8, 1, 2);
    });

    // Library — hushed hall of scrolls and codices
    this.getSprite('b_library', (ctx) => {
      // Stone foundation
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 13, 14, 2);
      // Dark timber interior walls
      ctx.fillStyle = '#451a03'; ctx.fillRect(1, 4, 14, 10);
      ctx.fillStyle = '#5c2d0e'; ctx.fillRect(2, 5, 12, 8);
      // Arched roof
      ctx.fillStyle = '#3f2410'; ctx.fillRect(0, 1, 16, 3);
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 2, 14, 2);
      ctx.fillStyle = '#92400e'; ctx.fillRect(4, 0, 8, 2);
      // Light streaming from roof lantern
      ctx.fillStyle = '#fef08a'; px(ctx, 7, 0, '#fef08a'); px(ctx, 8, 0, '#fde68a');
      // Scroll cubbyholes — tiered shelving
      ctx.fillStyle = '#2d1a0a'; ctx.fillRect(3, 5, 10, 8);
      ctx.fillStyle = '#3f2410'; ctx.fillRect(3, 5, 10, 1); ctx.fillRect(3, 8, 10, 1);
      // Colorful scroll rolls — red, blue, green, gold, purple
      ctx.fillStyle = '#ef4444'; ctx.fillRect(4, 6, 1, 4);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(6, 6, 1, 4);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(8, 6, 1, 4);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(10, 6, 1, 4);
      ctx.fillStyle = '#a855f7'; ctx.fillRect(11, 6, 1, 4);
      // Stack on lower shelf
      ctx.fillStyle = '#dc2626'; ctx.fillRect(5, 10, 2, 2);
      ctx.fillStyle = '#2563eb'; ctx.fillRect(8, 10, 2, 2);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(10, 10, 2, 2);
      // Reading desk left
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 9, 2, 2);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(2, 9, 1, 1);
    });

    // Academy — classical hall of higher learning with observatory dome
    this.getSprite('b_academy', (ctx) => {
      // Marble platform
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(1, 14, 14, 1);
      // Main hall — pure white marble
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(1, 6, 14, 8);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(2, 7, 12, 6);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(3, 8, 10, 4);
      // Ionic columns carved
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(2, 7, 2, 5); ctx.fillRect(12, 7, 2, 5);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(2, 7, 1, 5); ctx.fillRect(13, 7, 1, 5);
      // Column capitals
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(2, 6, 2, 1); ctx.fillRect(12, 6, 2, 1);
      // Stern pediment
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(1, 3, 14, 3);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(2, 4, 12, 2);
      // Observatory dome — purple copper patina
      ctx.fillStyle = '#a855f7'; ctx.fillRect(5, 0, 6, 4);
      ctx.fillStyle = '#c084fc'; ctx.fillRect(6, 1, 4, 2);
      ctx.fillStyle = '#7c3aed'; ctx.fillRect(5, 2, 6, 1);
      // Dome finial
      px(ctx, 7, 0, '#fbbf24'); px(ctx, 8, 0, '#fbbf24');
      // Arched windows
      ctx.fillStyle = '#1e293b'; ctx.fillRect(5, 8, 2, 3); ctx.fillRect(9, 8, 2, 3);
      ctx.fillStyle = '#fef08a'; px(ctx, 6, 9, '#fef08a'); px(ctx, 10, 9, '#fef08a');
      // Armillary sphere glimpsed
      px(ctx, 7, 10, '#fbbf24');
    });

    // Bank — neoclassical stone vault, gold-framed portico
    this.getSprite('b_bank', (ctx) => {
      // Wide stone base
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 15, 14, 1);
      // Heavy stone body
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 5, 16, 10);
      ctx.fillStyle = '#64748b'; ctx.fillRect(1, 6, 14, 8);
      // Grand pediment
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 2, 16, 3);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 3, 14, 2);
      // Gold frieze line
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(2, 5, 12, 1);
      ctx.fillStyle = '#fde047'; ctx.fillRect(2, 5, 12, 1);
      // Fluted columns
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(2, 7, 2, 5); ctx.fillRect(6, 7, 2, 5);
      ctx.fillRect(10, 7, 2, 5); ctx.fillRect(14, 7, 2, 5);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(2, 7, 1, 5); ctx.fillRect(6, 7, 1, 5);
      ctx.fillRect(10, 7, 1, 5); ctx.fillRect(14, 7, 1, 5);
      // Column bases
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(2, 11, 2, 1); ctx.fillRect(6, 11, 2, 1);
      ctx.fillRect(10, 11, 2, 1); ctx.fillRect(14, 11, 2, 1);
      // Vault door center — iron ring
      ctx.fillStyle = '#1c1917'; ctx.fillRect(8, 10, 4, 4);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(9, 11, 2, 2);
      px(ctx, 9, 11, '#fef3c7');
      // Gold coins spilled at threshold
      px(ctx, 5, 14, '#fbbf24'); px(ctx, 11, 14, '#fde047');
      px(ctx, 7, 15, '#d97706');
    });

    // Stock Exchange — sleek glass-and-steel tower with ticker-line
    this.getSprite('b_stock_exchange', (ctx) => {
      // Foundation
      ctx.fillStyle = '#334155'; ctx.fillRect(1, 14, 14, 2);
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 15, 16, 1);
      // Dark glass tower
      ctx.fillStyle = '#0f172a'; ctx.fillRect(2, 1, 13, 14);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(3, 2, 11, 12);
      // Glass curtain wall grid
      ctx.fillStyle = '#0ea5e9';
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 5; col++) {
          px(ctx, 4 + col * 2, 3 + row * 2, '#0ea5e9');
        }
      }
      // Lit windows (warm office)
      px(ctx, 5, 4, '#fde68a'); px(ctx, 9, 6, '#fde68a'); px(ctx, 11, 4, '#fde68a');
      px(ctx, 7, 8, '#fde68a');
      // Structural columns
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 1, 1, 14); ctx.fillRect(14, 1, 1, 14);
      // Entrance canopy
      ctx.fillStyle = '#10b981'; ctx.fillRect(5, 13, 6, 1);
      // Ticker arrow climbing (price going up)
      ctx.fillStyle = '#34d399';
      px(ctx, 4, 10, '#34d399'); px(ctx, 6, 9, '#34d399');
      px(ctx, 8, 7, '#10b981'); px(ctx, 10, 5, '#10b981');
      px(ctx, 11, 3, '#059669');
      // Falling red arrow
      ctx.fillStyle = '#ef4444';
      px(ctx, 12, 10, '#ef4444'); px(ctx, 11, 12, '#ef4444');
    });

    // Collective — communal workers' hall in deep socialist red
    this.getSprite('b_collective', (ctx) => {
      // Packed earth floor
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 14, 16, 2);
      // Red brick walls
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(0, 5, 16, 10);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(1, 6, 14, 8);
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(2, 6, 12, 7);
      // Brick mortar lines
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(1, 9, 14, 1); ctx.fillRect(1, 12, 14, 1);
      // Roof with deep red tile
      ctx.fillStyle = '#450a0a'; ctx.fillRect(0, 1, 16, 4);
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(1, 2, 14, 3);
      ctx.fillStyle = '#991b1b'; ctx.fillRect(2, 3, 12, 1);
      // Banner pole center
      ctx.fillStyle = '#78350f'; ctx.fillRect(7, 0, 1, 6);
      // Red banner with gold star symbol
      ctx.fillStyle = '#dc2626'; ctx.fillRect(8, 0, 6, 5);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(8, 0, 4, 1);
      // Gold star on banner
      ctx.fillStyle = '#fbbf24';
      px(ctx, 10, 1, '#fbbf24'); px(ctx, 11, 1, '#fbbf24');
      px(ctx, 9, 2, '#fbbf24'); px(ctx, 10, 2, '#fde047'); px(ctx, 11, 2, '#fbbf24');
      px(ctx, 10, 3, '#fbbf24');
      // Workers' figures inside (pink garments)
      ctx.fillStyle = '#fca5a5'; ctx.fillRect(4, 9, 2, 5); ctx.fillRect(10, 9, 2, 5);
      ctx.fillStyle = '#fef3c7'; px(ctx, 5, 9, '#fef3c7'); px(ctx, 11, 9, '#fef3c7');
      // Windows with warm light
      ctx.fillStyle = '#fef08a'; ctx.fillRect(3, 7, 2, 1); ctx.fillRect(12, 7, 2, 1);
    });

    // Factory — industrial mill with twin smokestacks belching smog
    this.getSprite('b_factory', (ctx) => {
      // Concrete floor
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 14, 14, 1);
      // Brick building
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 6, 16, 8);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 7, 14, 6);
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(2, 7, 12, 5);
      // Sawtooth roof profile
      ctx.fillStyle = '#292524'; ctx.fillRect(0, 4, 16, 2);
      ctx.fillStyle = '#1c1917'; ctx.fillRect(1, 3, 4, 1); ctx.fillRect(6, 3, 4, 1); ctx.fillRect(11, 3, 4, 1);
      // Twin smokestacks
      ctx.fillStyle = '#1c1917'; ctx.fillRect(2, 0, 3, 6); ctx.fillRect(7, 0, 3, 6);
      ctx.fillStyle = '#44403c'; ctx.fillRect(2, 0, 1, 4); ctx.fillRect(7, 0, 1, 4);
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 4, 3, 1); ctx.fillRect(7, 4, 3, 1);
      // Smoke plumes
      px(ctx, 3, 0, '#a8a29e'); px(ctx, 4, 0, '#d6d3d1');
      px(ctx, 8, 0, '#a8a29e'); px(ctx, 9, 0, '#d6d3d1');
      // Rows of yellow glowing windows
      ctx.fillStyle = '#facc15';
      ctx.fillRect(3, 9, 2, 2); ctx.fillRect(7, 9, 2, 2); ctx.fillRect(11, 9, 2, 2);
      ctx.fillStyle = '#fde68a'; ctx.fillRect(3, 9, 2, 1); ctx.fillRect(7, 9, 2, 1); ctx.fillRect(11, 9, 2, 1);
      // Loading dock door
      ctx.fillStyle = '#1c1917'; ctx.fillRect(13, 10, 2, 4);
      // Conveyor shadow
      ctx.fillStyle = '#0f172a'; ctx.fillRect(8, 15, 6, 1);
    });

    // Train Station — Grand Victorian / Industrial passenger terminal with clock tower and rail platforms
    this.getSprite('b_train_station', (ctx) => {
      // Platform foundation & rails at bottom
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 14, 16, 1); // steel rail track
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 13, 2, 3); ctx.fillRect(7, 13, 2, 3); ctx.fillRect(12, 13, 2, 3); // wooden ties
      // Main brick / stone station building
      ctx.fillStyle = '#78350f'; ctx.fillRect(1, 5, 14, 8);
      ctx.fillStyle = '#92400e'; ctx.fillRect(2, 6, 12, 7);
      ctx.fillStyle = '#b45309'; ctx.fillRect(2, 6, 12, 1); // cornice
      // Arched station shed glass & iron roof
      ctx.fillStyle = '#1e293b'; ctx.fillRect(1, 3, 14, 3);
      ctx.fillStyle = '#334155'; ctx.fillRect(2, 2, 12, 2);
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(4, 3, 8, 2); // glass skylight arch
      // Central Clock Tower
      ctx.fillStyle = '#78350f'; ctx.fillRect(6, 0, 4, 4);
      ctx.fillStyle = '#451a03'; ctx.fillRect(5, 0, 1, 4); ctx.fillRect(10, 0, 1, 4);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(7, 1, 2, 2); // clock face
      px(ctx, 7, 1, '#0f172a'); px(ctx, 8, 2, '#0f172a'); // clock hands
      // Station entrance arches
      ctx.fillStyle = '#0f172a'; ctx.fillRect(3, 9, 3, 4); ctx.fillRect(7, 8, 2, 5); ctx.fillRect(10, 9, 3, 4);
      // Warm interior glowing lamps / departure board
      ctx.fillStyle = '#fef08a'; px(ctx, 4, 10, '#fde047'); px(ctx, 11, 10, '#fde047');
      ctx.fillStyle = '#38bdf8'; px(ctx, 7, 9, '#38bdf8'); px(ctx, 8, 9, '#38bdf8');
    });

    // Aqueduct — Roman-style arched water channel on stone piers
    this.getSprite('b_aqueduct', (ctx) => {
      // Water channel, stone-lined
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, 1, 16, 3);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(0, 1, 16, 1);
      // Flowing water in channel — blue ribbon
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(1, 1, 14, 1);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(3, 1, 5, 1); ctx.fillRect(10, 1, 4, 1);
      px(ctx, 3, 1, '#7dd3fc'); px(ctx, 9, 1, '#7dd3fc');
      // Channel walls
      ctx.fillStyle = '#78716c'; ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 2, 16, 2);
      // Upper arcade — small arches
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(1, 4, 3, 2); ctx.fillRect(7, 4, 3, 2); ctx.fillRect(13, 4, 3, 2);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(1, 5, 3, 1); ctx.fillRect(7, 5, 3, 1); ctx.fillRect(13, 5, 3, 1);
      // Upper cornice
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(0, 6, 16, 1);
      // Lower arcade — taller, heavier piers
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(1, 7, 3, 9); ctx.fillRect(7, 7, 3, 9); ctx.fillRect(13, 7, 3, 9);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 7, 3, 1); ctx.fillRect(7, 7, 3, 1); ctx.fillRect(13, 7, 3, 1);
      // Arch voids — shadowed
      ctx.fillStyle = '#44403c'; ctx.fillRect(4, 8, 3, 5); ctx.fillRect(10, 8, 3, 5);
      ctx.fillStyle = '#57534e'; ctx.fillRect(4, 8, 3, 1); ctx.fillRect(10, 8, 3, 1);
      // Water dripping through a crack
      ctx.fillStyle = '#38bdf8'; px(ctx, 4, 13, '#38bdf8'); px(ctx, 4, 14, '#7dd3fc');
      // Base
      ctx.fillStyle = '#78716c'; ctx.fillRect(0, 14, 16, 2);
    });

    // Harbor — seaside dock with a moored fishing boat
    this.getSprite('b_harbor', (ctx) => {
      // Deep sea water
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0, 9, 16, 7);
      ctx.fillStyle = '#2563eb'; ctx.fillRect(1, 10, 14, 5);
      // Wave lines
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(0, 10, 16, 1); ctx.fillRect(0, 13, 16, 1); ctx.fillRect(0, 15, 16, 1);
      // Wooden dock planking
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, 6, 10, 3);
      ctx.fillStyle = '#92400e'; ctx.fillRect(0, 7, 10, 1);
      // Timber grain
      ctx.fillStyle = '#a16207'; ctx.fillRect(1, 7, 8, 1);
      // Dock pilings in the water
      ctx.fillStyle = '#451a03'; ctx.fillRect(1, 9, 1, 4); ctx.fillRect(4, 9, 1, 4); ctx.fillRect(7, 9, 1, 4);
      // Fishing boat (hull with mast)
      ctx.fillStyle = '#78350f'; ctx.fillRect(9, 7, 4, 2);
      ctx.fillStyle = '#451a03'; ctx.fillRect(10, 8, 2, 2);
      // Mast
      ctx.fillStyle = '#78350f'; ctx.fillRect(11, 2, 1, 6);
      // Sail
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(12, 3, 3, 5);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(12, 4, 2, 3);
      // Moored rope from dock to bow
      ctx.fillStyle = '#78716c'; ctx.fillRect(10, 6, 3, 1);
      // Barrels on dock
      ctx.fillStyle = '#b45309'; ctx.fillRect(1, 6, 2, 1); ctx.fillRect(5, 6, 2, 1);
      // Fish crate
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(3, 5, 2, 2);
      px(ctx, 4, 5, '#ef4444');
    });

    // Keep — fortified stone tower with a sloped base glacis
    this.getSprite('b_keep', (ctx) => {
      // Glacis: sloped stone base to deflect siege
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 10, 16, 6);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 11, 14, 5);
      ctx.fillStyle = '#64748b'; ctx.fillRect(2, 12, 12, 3);
      // Main tower body
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 4, 12, 7);
      ctx.fillStyle = '#64748b'; ctx.fillRect(3, 5, 10, 5);
      ctx.fillStyle = '#7e8fa6'; ctx.fillRect(4, 5, 8, 4);
      // Crenellated battlements rim
      ctx.fillStyle = '#475569';
      ctx.fillRect(2, 0, 2, 5); ctx.fillRect(6, 0, 2, 5);
      ctx.fillRect(10, 0, 2, 5); ctx.fillRect(13, 0, 3, 5);
      ctx.fillStyle = '#64748b'; ctx.fillRect(3, 0, 1, 4); ctx.fillRect(7, 0, 1, 4);
      ctx.fillRect(11, 0, 1, 4); ctx.fillRect(14, 0, 1, 4);
      // Stone courses
      ctx.fillStyle = '#334155';
      ctx.fillRect(2, 7, 12, 1); ctx.fillRect(2, 10, 12, 1);
      // Arrow loops
      ctx.fillStyle = '#0f172a';
      px(ctx, 5, 7, '#0f172a'); px(ctx, 9, 7, '#0f172a');
      px(ctx, 5, 10, '#0f172a'); px(ctx, 9, 10, '#0f172a');
      // Iron portcullis gate
      ctx.fillStyle = '#1c1917'; ctx.fillRect(7, 9, 3, 3);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(8, 9, 1, 2);
    });

    // Palace — ornate seat of sovereign power with gold crown finial
    this.getSprite('b_palace', (ctx) => {
      // Wide marble stair
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(2, 13, 12, 3);
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(3, 14, 10, 1);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(4, 15, 8, 1);
      // Main marble block
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 5, 16, 9);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(1, 6, 14, 7);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(2, 7, 12, 5);
      // Grand portico with fluted columns
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(3, 7, 2, 7); ctx.fillRect(7, 7, 2, 7); ctx.fillRect(11, 7, 2, 7);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(3, 7, 1, 7); ctx.fillRect(7, 7, 1, 7); ctx.fillRect(11, 7, 1, 7);
      ctx.fillStyle = '#cbd5e1'; px(ctx, 4, 7, '#cbd5e1'); px(ctx, 8, 7, '#cbd5e1'); px(ctx, 12, 7, '#cbd5e1');
      // Column capitals gilded
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(3, 6, 2, 1); ctx.fillRect(7, 6, 2, 1); ctx.fillRect(11, 6, 2, 1);
      // Grand pediment with golden frieze
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 3, 16, 3);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(1, 5, 14, 1); ctx.fillRect(1, 5, 14, 1);
      // Central gold dome/crown
      ctx.fillStyle = '#d97706'; ctx.fillRect(5, 0, 6, 3);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(6, 1, 4, 2);
      ctx.fillStyle = '#fde047'; ctx.fillRect(7, 2, 2, 1);
      // Crown finial jewel
      px(ctx, 7, 0, '#fef3c7'); px(ctx, 8, 0, '#fef3c7');
      // Royal banner pole right
      ctx.fillStyle = '#78350f'; ctx.fillRect(14, 1, 1, 5);
      ctx.fillStyle = '#a855f7'; ctx.fillRect(13, 1, 2, 3);
    });

    // Port — busy deepwater dock with crane and warehouse
    this.getSprite('b_port', (ctx) => {
      // Deep dock water
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0, 10, 16, 6);
      ctx.fillStyle = '#2563eb'; ctx.fillRect(1, 11, 14, 4);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(0, 12, 16, 1); ctx.fillRect(0, 14, 16, 1);
      // Heavy timber dock
      ctx.fillStyle = '#451a03'; ctx.fillRect(0, 7, 13, 3);
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, 7, 12, 2);
      ctx.fillStyle = '#92400e'; ctx.fillRect(1, 8, 10, 1);
      // Dock bollards
      ctx.fillStyle = '#94a3b8'; px(ctx, 2, 7, '#94a3b8'); px(ctx, 8, 7, '#94a3b8');
      // Warehouse building left
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, 0, 9, 8);
      ctx.fillStyle = '#92400e'; ctx.fillRect(1, 1, 7, 6);
      // Warehouse roof
      ctx.fillStyle = '#1c1917'; ctx.fillRect(0, 0, 2, 1); ctx.fillRect(3, 0, 2, 1); ctx.fillRect(6, 0, 2, 1);
      // Warehouse door
      ctx.fillStyle = '#0f172a'; ctx.fillRect(2, 3, 3, 4);
      // Crane structure on dock right
      ctx.fillStyle = '#475569'; ctx.fillRect(14, 0, 1, 8);
      ctx.fillStyle = '#64748b'; ctx.fillRect(13, 0, 2, 1);
      // Crane boom arm
      ctx.fillStyle = '#334155'; ctx.fillRect(11, 2, 4, 1);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(11, 3, 1, 3);
      // Cargo net hanging
      ctx.fillStyle = '#b45309'; ctx.fillRect(13, 4, 2, 3);
      ctx.fillStyle = '#d97706'; ctx.fillRect(14, 5, 1, 1);
      // Stacked crates beside warehouse
      ctx.fillStyle = '#b45309'; ctx.fillRect(10, 5, 3, 2);
      ctx.fillStyle = '#92400e'; ctx.fillRect(11, 4, 2, 1);
    });

    // Oil Well — steel lattice derrick over black crude lake with pumpjack
    this.getSprite('b_oil_well', (ctx) => {
      // Tainted ground — blackened earth, oil-stained soil
      ctx.fillStyle = '#1c1917'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#292524'; ctx.fillRect(1, 13, 14, 2);
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(1, 13, 12, 1);
      // Black crude pool seeping
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(4, 12, 8, 2);
      ctx.fillStyle = '#1c1917'; ctx.fillRect(5, 11, 6, 1);
      // Shimmering oil sheen
      px(ctx, 4, 12, '#3f3f46'); px(ctx, 7, 11, '#44403c'); px(ctx, 10, 12, '#3f3f46');
      // Steel derrick — X-braced lattice in 2D
      ctx.fillStyle = '#64748b';
      ctx.fillRect(3, 5, 1, 7); ctx.fillRect(12, 5, 1, 7); // outer legs
      ctx.fillRect(6, 5, 1, 7); ctx.fillRect(9, 5, 1, 7); // inner legs
      // Lower cross-braces
      ctx.fillStyle = '#475569'; ctx.fillRect(4, 9, 2, 1); ctx.fillRect(10, 9, 2, 1);
      ctx.fillRect(7, 9, 2, 1);
      // Upper cross-braces
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(5, 6, 1, 1); ctx.fillRect(10, 6, 1, 1);
      ctx.fillRect(6, 7, 4, 1);
      // Crown block platform — rig apex
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(4, 4, 8, 1);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(5, 3, 6, 1);
      ctx.fillStyle = '#94a3b8'; px(ctx, 6, 2, '#94a3b8'); px(ctx, 9, 2, '#94a3b8');
      // Hoisting cable (drill string) descending
      ctx.fillStyle = '#334155'; ctx.fillRect(7, 5, 2, 5);
      px(ctx, 7, 9, '#fbbf24'); // friction heat at bit
      // Pumpjack (nodding donkey) on left side
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 11, 3, 2);
      ctx.fillStyle = '#78716c'; ctx.fillRect(0, 11, 3, 1);
      // Walking beam arm
      ctx.fillStyle = '#1c1917'; ctx.fillRect(1, 9, 8, 1);
      px(ctx, 2, 9, '#a8a29e'); // polished rod weight
      // Sucker rod pumping down
      ctx.fillStyle = '#475569'; ctx.fillRect(3, 10, 1, 3);
      // Oil pipe to storage (ground, right)
      ctx.fillStyle = '#78716c'; ctx.fillRect(11, 14, 2, 1); ctx.fillRect(13, 13, 2, 1);
      ctx.fillStyle = '#57534e'; ctx.fillRect(12, 13, 1, 1);
    });

    // Refinery — petroleum distillation complex with cracking column and flare
    this.getSprite('b_refinery', (ctx) => {
      // Massive concrete foundation
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 12, 14, 3);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 13, 14, 2);
      // Main distillation column — tall central cylinder
      ctx.fillStyle = '#64748b'; ctx.fillRect(5, 3, 4, 11);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(5, 3, 1, 11); // left highlight
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(6, 3, 2, 10);
      ctx.fillStyle = '#475569'; ctx.fillRect(8, 3, 1, 11);  // right shadow
      // Column dome cap
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(5, 1, 4, 2);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(6, 0, 2, 1);
      ctx.fillStyle = '#fbbf24'; px(ctx, 6, 0, '#fef3c7'); px(ctx, 7, 0, '#fde68a');
      // Tray decks — rings around the column body
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(5, 5, 4, 1); ctx.fillRect(5, 8, 4, 1); ctx.fillRect(5, 11, 4, 1);
      // Secondary cracking column (left, shorter)
      ctx.fillStyle = '#64748b'; ctx.fillRect(1, 5, 3, 8);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(1, 5, 1, 8);
      ctx.fillStyle = '#475569'; ctx.fillRect(3, 5, 1, 8);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(1, 4, 3, 1);
      ctx.fillStyle = '#1c1917'; ctx.fillRect(1, 8, 3, 1); ctx.fillRect(1, 11, 3, 1);
      // Spherical bullet tank (right)
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(11, 4, 5, 8);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(12, 5, 3, 6);
      ctx.fillStyle = '#78716c'; ctx.fillRect(11, 4, 5, 1); ctx.fillRect(11, 11, 5, 1);
      ctx.fillStyle = '#57534e'; ctx.fillRect(11, 8, 5, 1);
      // Pipework — orange/copper connecting pipes
      ctx.fillStyle = '#92400e';
      ctx.fillRect(4, 6, 2, 1); ctx.fillRect(9, 6, 2, 1);
      ctx.fillRect(4, 10, 6, 1); ctx.fillRect(9, 10, 2, 1);
      ctx.fillStyle = '#b45309'; ctx.fillRect(5, 7, 4, 1); ctx.fillRect(9, 9, 2, 1);
      // Flare stack far right — thin tall pipe
      ctx.fillStyle = '#1c1917'; ctx.fillRect(14, 0, 1, 8);
      ctx.fillStyle = '#334155'; ctx.fillRect(15, 0, 1, 8);
      ctx.fillStyle = '#475569'; ctx.fillRect(14, 0, 2, 1);
      // Flare flame blazing
      ctx.fillStyle = '#7f1d1d'; ctx.fillRect(14, 0, 2, 2);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(14, 0, 2, 1);
      ctx.fillStyle = '#f97316'; px(ctx, 14, 0, '#f97316'); px(ctx, 15, 0, '#fbbf24');
      px(ctx, 13, 1, '#f59e0b'); px(ctx, 14, 1, '#fef08a');
      // Valve indicator lights at base
      px(ctx, 2, 13, '#f59e0b'); px(ctx, 10, 13, '#f59e0b'); px(ctx, 5, 13, '#22c55e');
    });

    // ===== HISTORIC WONDERS =====
    // Raised once per world by a Great Builder. Drawn taller and more ornate than
    // ordinary buildings so they read as landmarks at a glance.

    // Statue of the Founder — heroic gilded colossus on a grand stepped plinth
    this.getSprite('b_monument', (ctx) => {
      // Three-tier wide plinth
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#57534e'; ctx.fillRect(1, 12, 14, 2);
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 13, 12, 1);
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 10, 12, 3);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(3, 11, 10, 1);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(4, 9, 8, 2);
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(5, 10, 6, 1);
      // Inscription plaque
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(5, 13, 6, 1);
      // Robed figure in gold — tunic/drape
      ctx.fillStyle = '#b45309'; ctx.fillRect(6, 4, 4, 6);
      ctx.fillStyle = '#d97706'; ctx.fillRect(7, 5, 2, 5);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(8, 6, 1, 4);
      // Head — gilded face
      ctx.fillStyle = '#d97706'; ctx.fillRect(6, 1, 4, 3);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(7, 2, 2, 2);
      px(ctx, 7, 1, '#fef3c7'); px(ctx, 8, 1, '#fef3c7');
      // Laurel wreath glint
      px(ctx, 5, 2, '#22c55e'); px(ctx, 10, 2, '#22c55e');
      // Raised right arm holding eternal torch
      ctx.fillStyle = '#d97706'; ctx.fillRect(10, 2, 1, 4);
      ctx.fillStyle = '#f97316'; ctx.fillRect(10, 0, 2, 3);
      ctx.fillStyle = '#fbbf24'; px(ctx, 10, 0, '#fef3c7');
      ctx.fillStyle = '#fde047'; px(ctx, 11, 1, '#fde047');
      // Left arm holding book/tablet
      ctx.fillStyle = '#d97706'; ctx.fillRect(5, 5, 1, 3);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(3, 4, 3, 2);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(3, 4, 3, 1);
    });

    // Great Library of Wisdom — epic colonnaded repository of all knowledge
    this.getSprite('b_great_library', (ctx) => {
      // Broad marble stylobate
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 14, 14, 1);
      // Main hall
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 6, 14, 8);
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(2, 7, 12, 6);
      // Grand portico roof with gold trim
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, 4, 16, 2);
      ctx.fillStyle = '#92400e'; ctx.fillRect(1, 4, 14, 1);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, 5, 16, 1);
      // Corinthian columns, tall
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(2, 7, 2, 7); ctx.fillRect(7, 7, 2, 7); ctx.fillRect(12, 7, 2, 7);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(2, 7, 1, 7); ctx.fillRect(7, 7, 1, 7); ctx.fillRect(12, 7, 1, 7);
      // Column capitals with gold
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(2, 6, 2, 1); ctx.fillRect(7, 6, 2, 1); ctx.fillRect(12, 6, 2, 1);
      // Scroll shelving walls visible between columns, richer
      ctx.fillStyle = '#ef4444'; ctx.fillRect(5, 9, 1, 4);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(5, 9, 1, 2);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(6, 9, 1, 4);
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(6, 10, 1, 2);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(10, 9, 1, 4);
      ctx.fillStyle = '#15803d'; ctx.fillRect(10, 10, 1, 2);
      ctx.fillStyle = '#a855f7'; ctx.fillRect(11, 9, 1, 4);
      ctx.fillStyle = '#7c3aed'; ctx.fillRect(11, 9, 1, 2);
      // Grandest dome — gold-clad scroll crown
      ctx.fillStyle = '#d97706'; ctx.fillRect(5, 0, 6, 4);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(6, 1, 4, 2);
      ctx.fillStyle = '#fde047'; ctx.fillRect(7, 1, 2, 1);
      px(ctx, 6, 0, '#fef3c7'); px(ctx, 9, 0, '#fef3c7');
      // Sagrada knowledge radiance
      px(ctx, 7, 0, '#fbbf24'); px(ctx, 8, 0, '#fde68a');
      // Urn left of entrance
      ctx.fillStyle = '#b45309'; ctx.fillRect(1, 11, 2, 2);
    });

    // Grand Aqueduct of Nations — monumental tiered arcade channeling fresh water
    this.getSprite('b_grand_aqueduct', (ctx) => {
      // Aqueduct shadow sides
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, 0, 16, 1);
      // Upper water channel — glowing freshest water
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0, 1, 16, 1);
      ctx.fillStyle = '#7dd3fc'; ctx.fillRect(2, 1, 3, 1); ctx.fillRect(8, 1, 3, 1); ctx.fillRect(12, 1, 3, 1);
      px(ctx, 4, 1, '#fef3c7'); px(ctx, 10, 1, '#fef3c7');
      // Channel casing
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, 2, 16, 2);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, 4, 16, 1);
      // Upper arcade — small arches
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(1, 5, 3, 3); ctx.fillRect(7, 5, 3, 3); ctx.fillRect(13, 5, 3, 3);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(1, 5, 3, 1); ctx.fillRect(7, 5, 3, 1); ctx.fillRect(13, 5, 3, 1);
      ctx.fillStyle = '#57534e'; px(ctx, 2, 7, '#57534e'); px(ctx, 8, 7, '#57534e'); px(ctx, 14, 7, '#57534e');
      // Entablature with gilded band
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(0, 8, 16, 1);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, 8, 16, 1);
      // Lower arcade — towering piers
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(0, 9, 3, 7); ctx.fillRect(6, 9, 3, 7); ctx.fillRect(12, 9, 3, 7);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(0, 9, 3, 1); ctx.fillRect(6, 9, 3, 1); ctx.fillRect(12, 9, 3, 1);
      ctx.fillStyle = '#a8a29e';
      ctx.fillRect(0, 9, 1, 7); ctx.fillRect(6, 9, 1, 7); ctx.fillRect(12, 9, 1, 7);
      // Deep shadowed arched voids
      ctx.fillStyle = '#292524'; ctx.fillRect(3, 10, 3, 6); ctx.fillRect(9, 10, 3, 6);
      ctx.fillStyle = '#44403c';
      ctx.fillRect(3, 12, 3, 4); ctx.fillRect(9, 12, 3, 4);
      // Pipe of water cascading down through face
      ctx.fillStyle = '#7dd3fc'; px(ctx, 4, 12, '#7dd3fc'); px(ctx, 4, 13, '#7dd3fc');
      px(ctx, 10, 11, '#7dd3fc'); px(ctx, 10, 12, '#7dd3fc');
      // Wave novelties at base
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0, 15, 16, 1);
      px(ctx, 1, 15, '#7dd3fc'); px(ctx, 5, 15, '#7dd3fc'); px(ctx, 9, 15, '#7dd3fc'); px(ctx, 13, 15, '#7dd3fc');
    });

    // Grand Colosseum of Legends — towering arena of heroes
    this.getSprite('b_colosseum', (ctx) => {
      // Foundation
      ctx.fillStyle = '#44403c'; ctx.fillRect(0, 14, 16, 2);
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 15, 16, 1);
      // Roundish outer rampart of travertine
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, 3, 16, 12);
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 4, 14, 10);
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(2, 4, 12, 9);
      // Two tiers of arcade openings (true Roman bays)
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(2, 5, 2, 3); ctx.fillRect(7, 5, 2, 3); ctx.fillRect(12, 5, 2, 3);
      ctx.fillRect(2, 9, 2, 3); ctx.fillRect(7, 9, 2, 3); ctx.fillRect(12, 9, 2, 3);
      // Engaged columns flanking the bays
      ctx.fillStyle = '#f1f5f9';
      px(ctx, 4, 5, '#f1f5f9'); px(ctx, 6, 5, '#f1f5f9');
      px(ctx, 9, 5, '#f1f5f9'); px(ctx, 11, 5, '#f1f5f9');
      px(ctx, 4, 9, '#f1f5f9'); px(ctx, 6, 9, '#f1f5f9');
      // Entablature cornice between tiers
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(1, 8, 14, 1);
      // Upper cornice under rampart top
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(1, 4, 14, 1);
      // Arena sand visível through main gate
      ctx.fillStyle = '#92400e'; ctx.fillRect(6, 12, 4, 2);
      ctx.fillStyle = '#ca8a04'; ctx.fillRect(6, 12, 4, 1);
      ctx.fillStyle = '#fbbf24'; px(ctx, 7, 13, '#fde047'); px(ctx, 8, 13, '#eab308');
      // Victory banners on tall poles flanking
      ctx.fillStyle = '#78350f'; ctx.fillRect(2, 0, 1, 5); ctx.fillRect(13, 0, 1, 5);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(2, 1, 2, 3); ctx.fillRect(12, 1, 2, 3);
      ctx.fillStyle = '#fbbf24'; px(ctx, 2, 1, '#fbbf24'); px(ctx, 13, 1, '#fbbf24');
      px(ctx, 3, 2, '#fde047'); px(ctx, 12, 2, '#fde047');
      // Imperial eagle banners above
      ctx.fillStyle = '#fbbf24'; px(ctx, 7, 0, '#fbbf24'); px(ctx, 8, 0, '#fbbf24');
    });

    // Radar Station — Early-warning radar installation with parabolic dish & control center
    this.getSprite('b_radar_station', (ctx) => {
      // Concrete foundation
      ctx.fillStyle = '#334155'; ctx.fillRect(1, 12, 14, 4);
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 13, 12, 2);
      // Technical bunker building
      ctx.fillStyle = '#1e293b'; ctx.fillRect(3, 8, 10, 5);
      ctx.fillStyle = '#334155'; ctx.fillRect(4, 9, 8, 3);
      // Glowing electronics / monitors
      px(ctx, 5, 10, '#38bdf8'); px(ctx, 6, 10, '#38bdf8');
      px(ctx, 9, 10, '#22c55e'); px(ctx, 10, 10, '#22c55e');
      // Steel lattice pylon
      ctx.fillStyle = '#475569'; ctx.fillRect(7, 3, 2, 6);
      ctx.fillStyle = '#64748b'; px(ctx, 6, 5, '#64748b'); px(ctx, 9, 5, '#64748b');
      // Large parabolic radar dish (concave angled dish)
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(4, 1, 8, 3);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(5, 2, 6, 1);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(6, 0, 4, 1);
      // Feed horn receiver
      ctx.fillStyle = '#ef4444'; px(ctx, 8, 0, '#ef4444');
      // Transceiver signal pulse
      ctx.fillStyle = '#38bdf8'; px(ctx, 4, 0, '#38bdf8'); px(ctx, 11, 0, '#38bdf8');
    });

    // SAM Site — Surface-to-Air Missile battery with twin angled launcher canisters
    this.getSprite('b_sam_site', (ctx) => {
      // Reinforced launcher pad with blast apron
      ctx.fillStyle = '#334155'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#475569'; ctx.fillRect(1, 14, 14, 1);
      // Rotating turret pedestal
      ctx.fillStyle = '#1e293b'; ctx.fillRect(4, 9, 8, 5);
      ctx.fillStyle = '#475569'; ctx.fillRect(5, 10, 6, 3);
      // Left angled missile launch canister (slanted upward)
      ctx.fillStyle = '#334155'; ctx.fillRect(2, 4, 3, 6);
      ctx.fillStyle = '#64748b'; ctx.fillRect(3, 3, 2, 7);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(3, 2, 2, 2); // Missile nosecone
      px(ctx, 3, 1, '#f87171');
      // Right angled missile launch canister
      ctx.fillStyle = '#334155'; ctx.fillRect(9, 4, 3, 6);
      ctx.fillStyle = '#64748b'; ctx.fillRect(10, 3, 2, 7);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(10, 2, 2, 2); // Missile nosecone
      px(ctx, 10, 1, '#f87171');
      // Central fire-control radar pod
      ctx.fillStyle = '#0f172a'; ctx.fillRect(6, 6, 4, 4);
      ctx.fillStyle = '#38bdf8'; px(ctx, 7, 7, '#38bdf8'); px(ctx, 8, 7, '#38bdf8');
    });

    // Missile Silo — Subterranean blast-hardened ICBM silo with heavy hatch and hazard stripes
    this.getSprite('b_missile_silo', (ctx) => {
      // Deep ground foundation / blast slab
      ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#334155'; ctx.fillRect(1, 13, 14, 2);
      // Circular reinforced silo collar
      ctx.fillStyle = '#475569'; ctx.fillRect(2, 6, 12, 7);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(3, 7, 10, 5);
      // Heavy hydraulic blast door hatch (slid half-open or textured)
      ctx.fillStyle = '#64748b'; ctx.fillRect(4, 5, 8, 4);
      // Hazard warning stripes (yellow / black diagonal look)
      ctx.fillStyle = '#eab308'; px(ctx, 4, 5, '#eab308'); px(ctx, 6, 5, '#eab308'); px(ctx, 8, 5, '#eab308'); px(ctx, 10, 5, '#eab308');
      ctx.fillStyle = '#1c1917'; px(ctx, 5, 5, '#1c1917'); px(ctx, 7, 5, '#1c1917'); px(ctx, 9, 5, '#1c1917'); px(ctx, 11, 5, '#1c1917');
      // Silo exhaust vents on sides
      ctx.fillStyle = '#0f172a'; ctx.fillRect(1, 8, 2, 3); ctx.fillRect(13, 8, 2, 3);
      // Central missile tip visible inside silo bore
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(7, 3, 2, 4);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(7, 1, 2, 2); // Warhead
      px(ctx, 7, 0, '#ef4444');
      // Red hazard beacon
      ctx.fillStyle = '#ef4444'; px(ctx, 2, 6, '#ef4444'); px(ctx, 13, 6, '#ef4444');
    });

    // Drone Command — UCAV & UAV control hub with satellite antenna and launch catapult
    this.getSprite('b_drone_command', (ctx) => {
      // Concrete tarmac pad
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#64748b'; ctx.fillRect(1, 14, 14, 1);
      // Command Operations Building
      ctx.fillStyle = '#1e293b'; ctx.fillRect(1, 7, 10, 7);
      ctx.fillStyle = '#334155'; ctx.fillRect(2, 8, 8, 5);
      // Glowing control screens & comms
      ctx.fillStyle = '#38bdf8'; px(ctx, 3, 9, '#38bdf8'); px(ctx, 4, 9, '#38bdf8');
      ctx.fillStyle = '#22c55e'; px(ctx, 6, 9, '#22c55e'); px(ctx, 7, 9, '#22c55e');
      // White Radome (Satellite dome on roof)
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(3, 2, 5, 5);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(4, 1, 3, 6);
      px(ctx, 4, 1, '#ffffff'); px(ctx, 5, 2, '#ffffff');
      // Telemetry whip antennas
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(9, 1, 1, 6); ctx.fillRect(11, 3, 1, 4);
      // Mini UAV Drone on roof launch rail
      ctx.fillStyle = '#0f172a'; ctx.fillRect(11, 7, 4, 2);
      ctx.fillStyle = '#38bdf8'; px(ctx, 14, 7, '#38bdf8');
      ctx.fillStyle = '#94a3b8'; px(ctx, 12, 6, '#94a3b8'); px(ctx, 12, 8, '#94a3b8'); // Wings
    });

    // Enrichment Facility — Nuclear isotope centrifuge halls & reactor containment dome
    this.getSprite('b_enrichment_facility', (ctx) => {
      // Heavy industrial foundation
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(0, 13, 16, 3);
      ctx.fillStyle = '#52525b'; ctx.fillRect(1, 14, 14, 1);
      // Main centrifuge processing plant
      ctx.fillStyle = '#27272a'; ctx.fillRect(0, 7, 10, 7);
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(1, 8, 8, 5);
      // Containment Dome (hemispherical reactor structure)
      ctx.fillStyle = '#71717a'; ctx.fillRect(9, 4, 6, 10);
      ctx.fillStyle = '#a1a1aa'; ctx.fillRect(10, 2, 4, 12);
      ctx.fillStyle = '#d4d4d8'; ctx.fillRect(11, 1, 2, 13);
      // Uranium / Fission radioactive glow
      ctx.fillStyle = '#84cc16'; px(ctx, 3, 10, '#84cc16'); px(ctx, 4, 10, '#a3e635');
      ctx.fillStyle = '#facc15'; px(ctx, 7, 10, '#facc15');
      // Exhaust filter vents with clean steam
      ctx.fillStyle = '#e4e4e7'; px(ctx, 2, 5, '#e4e4e7'); px(ctx, 3, 4, '#e4e4e7');
      px(ctx, 12, 0, '#ffffff'); px(ctx, 13, 0, '#ffffff');
      // Hazard trefoil accent
      ctx.fillStyle = '#eab308'; px(ctx, 4, 7, '#eab308'); px(ctx, 6, 7, '#eab308');
    });

    // Bomb Shelter — Reinforced underground civil defense bunker with air filtration
    this.getSprite('b_bomb_shelter', (ctx) => {
      // Earthen berm mound over bunker
      ctx.fillStyle = '#57534e'; ctx.fillRect(0, 10, 16, 6);
      ctx.fillStyle = '#78716c'; ctx.fillRect(1, 7, 14, 7);
      ctx.fillStyle = '#a8a29e'; ctx.fillRect(3, 5, 10, 4);
      // Concrete reinforced entrance bulkhead
      ctx.fillStyle = '#1c1917'; ctx.fillRect(4, 8, 8, 7);
      ctx.fillStyle = '#44403c'; ctx.fillRect(5, 9, 6, 6);
      // Heavy blast-door portal (dual steel doors)
      ctx.fillStyle = '#0f172a'; ctx.fillRect(6, 10, 4, 5);
      ctx.fillStyle = '#334155'; ctx.fillRect(6, 10, 1, 5); ctx.fillRect(9, 10, 1, 5);
      // Steel door handles / lock wheel
      ctx.fillStyle = '#fbbf24'; px(ctx, 7, 12, '#fbbf24'); px(ctx, 8, 12, '#fbbf24');
      // Overhead bunker floodlight
      ctx.fillStyle = '#fde047'; px(ctx, 7, 9, '#fde047'); px(ctx, 8, 9, '#fde047');
      // Air filtration exhaust pipes on berm top
      ctx.fillStyle = '#78716c'; ctx.fillRect(2, 3, 2, 4); ctx.fillRect(12, 3, 2, 4);
      ctx.fillStyle = '#44403c'; px(ctx, 2, 2, '#44403c'); px(ctx, 13, 2, '#44403c');
    });

    this.installDetailedSpeciesSprites();
  }
}

// Pre-generate all sprite canvases
SpriteGenerator.generateAllSprites();
