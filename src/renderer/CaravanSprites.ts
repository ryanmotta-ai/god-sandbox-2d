/**
 * Caravan pixel art: three kinds of traffic, seen from three sides, walking.
 *
 * A caravan used to be one static side-on sprite, flipped by which leg of the
 * trip it was on rather than by which way it was actually pointing. So a
 * caravan heading north up a road was drawn walking east, and it never moved
 * its legs — which, combined with a ground speed that was far too high, is
 * what made them look like they were flying rather than walking.
 *
 * Each type is drawn from behind, from the front, and from the side; the other
 * side is the same art mirrored, exactly as the animals themselves are. Every
 * view has a four-frame gait, and the renderer picks the frame from distance
 * covered rather than from the clock, so the stride always matches the ground
 * going past underneath.
 */

export type CaravanKind = 'donkey' | 'camel' | 'cart';
/** Left is 'side' mirrored, which is why it is not a view of its own. */
export type CaravanView = 'side' | 'back' | 'front';

/** Canonical sprite size. */
export const CARAVAN_PX = 32;
/** Frames in one full gait cycle. */
export const CARAVAN_FRAMES = 4;

/**
 * How far the animal travels, in tiles, per complete gait cycle.
 *
 * This is what locks the legs to the ground: divide distance covered by this
 * and the stride can never outrun the movement, whatever the speed modifiers
 * on the road are doing. A donkey takes short steps; a camel's are long.
 */
export const STRIDE_TILES: Record<CaravanKind, number> = {
  donkey: 0.85,
  camel: 1.30,
  cart: 1.05
};

const cache = new Map<string, HTMLCanvasElement>();

export function caravanSprite(kind: CaravanKind, view: CaravanView, frame: number): HTMLCanvasElement {
  const f = ((frame % CARAVAN_FRAMES) + CARAVAN_FRAMES) % CARAVAN_FRAMES;
  const key = `${kind}:${view}:${f}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = CARAVAN_PX;
  canvas.height = CARAVAN_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  DRAW[kind][view](ctx, f);
  cache.set(key, canvas);
  return canvas;
}

function r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

/** Fore and hind swing, in pixels, over the four frames of a walk. */
const SWING = [0, 1, 0, -1];
/** The body rises on the middle of each step. */
const BOB = [0, -1, 0, -1];

const DONKEY = { dark: '#2f3238', hide: '#5b6068', lit: '#868d97', pale: '#b3b9c2', muzzle: '#cfd4da' };
const CAMEL = { dark: '#5a4222', hide: '#8a6a3f', lit: '#b08d55', pale: '#d3b183', muzzle: '#e6cfa8' };
const OX = { dark: '#3a3128', hide: '#6b5b48', lit: '#8d7a62', pale: '#b3a189' };
const LOAD = { strap: '#3d2c16', sack: '#8b6b3a', lit: '#ab8850', tie: '#5e4523' };
const WOOD = { dark: '#33210f', mid: '#5a3d1e', face: '#7a552c', lit: '#9b7040' };
const IRON = { dark: '#1c1f22', mid: '#3a4148' };

type Draw = (ctx: CanvasRenderingContext2D, frame: number) => void;

/** Shadow under the animal, so nothing appears to hover. */
function groundShadow(ctx: CanvasRenderingContext2D, x: number, w: number): void {
  r(ctx, x, 28, w, 3, 'rgba(12, 16, 12, 0.3)');
  r(ctx, x + 1, 27, w - 2, 1, 'rgba(12, 16, 12, 0.18)');
}

// ============================================================
// Pack donkey — the short-haul beast, plodding under panniers
// ============================================================

const donkeySide: Draw = (ctx, f) => {
  const swing = SWING[f];
  const bob = BOB[f];
  groundShadow(ctx, 6, 21);
  // Hind legs, then the body over them, then the fore legs in front.
  for (const [lx, dir] of [[9, 1], [11, -1]] as const) {
    r(ctx, lx + swing * dir, 18 + bob, 3, 9, DONKEY.dark);
    r(ctx, lx + swing * dir, 25 + bob, 3, 2, '#1b1d21'); // hoof
  }
  r(ctx, 6, 12 + bob, 18, 8, DONKEY.dark); // barrel
  r(ctx, 7, 13 + bob, 16, 6, DONKEY.hide);
  r(ctx, 8, 13 + bob, 13, 2, DONKEY.lit);
  r(ctx, 4, 14 + bob, 3, 5, DONKEY.dark); // rump and tail
  r(ctx, 3, 15 + bob, 2, 6, DONKEY.dark);
  r(ctx, 3, 20 + bob, 2, 2, '#1b1d21');
  // Panniers slung either side of the spine, with the strap over the top.
  r(ctx, 9, 9 + bob, 11, 5, LOAD.sack);
  r(ctx, 10, 9 + bob, 9, 2, LOAD.lit);
  r(ctx, 12, 8 + bob, 5, 2, LOAD.tie);
  r(ctx, 13, 9 + bob, 1, 5, LOAD.strap);
  r(ctx, 17, 9 + bob, 1, 5, LOAD.strap);
  for (const [lx, dir] of [[19, -1], [21, 1]] as const) {
    r(ctx, lx + swing * dir, 18 + bob, 3, 9, DONKEY.dark);
    r(ctx, lx + swing * dir, 25 + bob, 3, 2, '#1b1d21');
  }
  // Neck and head, carried low the way a working donkey carries it. The ears
  // grow out of the skull rather than hovering above it, which is what they
  // were doing when they were pegged to the neck instead.
  r(ctx, 22, 11 + bob, 4, 5, DONKEY.dark);
  r(ctx, 23, 11 + bob, 3, 4, DONKEY.hide);
  r(ctx, 24, 13 + bob, 6, 5, DONKEY.dark); // skull
  r(ctx, 25, 14 + bob, 4, 3, DONKEY.lit);
  r(ctx, 24, 9 + bob, 2, 5, DONKEY.dark); // ears, rooted in the skull
  r(ctx, 27, 9 + bob, 2, 5, DONKEY.dark);
  r(ctx, 24, 10 + bob, 1, 3, DONKEY.lit);
  r(ctx, 27, 10 + bob, 1, 3, DONKEY.lit);
  r(ctx, 29, 15 + bob, 2, 3, DONKEY.dark); // muzzle reaching forward
  r(ctx, 29, 16 + bob, 2, 2, DONKEY.muzzle);
  r(ctx, 26, 14 + bob, 1, 1, '#14161a'); // eye
};

const donkeyBack: Draw = (ctx, f) => {
  const swing = SWING[f];
  const bob = BOB[f];
  groundShadow(ctx, 10, 13);
  for (const [lx, dir] of [[12, 1], [17, -1]] as const) {
    r(ctx, lx, 19 + bob + swing * dir, 3, 8 - swing * dir, DONKEY.dark);
    r(ctx, lx, 25 + bob, 3, 2, '#1b1d21');
  }
  r(ctx, 11, 12 + bob, 11, 9, DONKEY.dark); // rump, seen square on
  r(ctx, 12, 13 + bob, 9, 7, DONKEY.hide);
  r(ctx, 13, 13 + bob, 7, 2, DONKEY.lit);
  r(ctx, 16, 10 + bob, 2, 7, DONKEY.dark); // tail down the middle
  r(ctx, 16, 16 + bob, 2, 3, '#1b1d21');
  // Panniers stand out on both flanks, which is what says "loaded" from here.
  r(ctx, 7, 12 + bob, 5, 6, LOAD.sack);
  r(ctx, 21, 12 + bob, 5, 6, LOAD.sack);
  r(ctx, 8, 12 + bob, 3, 2, LOAD.lit);
  r(ctx, 22, 12 + bob, 3, 2, LOAD.lit);
  r(ctx, 11, 10 + bob, 11, 2, LOAD.strap);
  r(ctx, 14, 8 + bob, 5, 3, LOAD.tie); // the load riding on top
  r(ctx, 12, 8 + bob, 2, 3, DONKEY.dark); // ear tips over the shoulders
  r(ctx, 19, 8 + bob, 2, 3, DONKEY.dark);
};

const donkeyFront: Draw = (ctx, f) => {
  const swing = SWING[f];
  const bob = BOB[f];
  groundShadow(ctx, 10, 13);
  for (const [lx, dir] of [[12, -1], [17, 1]] as const) {
    r(ctx, lx, 19 + bob + swing * dir, 3, 8 - swing * dir, DONKEY.dark);
    r(ctx, lx, 25 + bob, 3, 2, '#1b1d21');
  }
  r(ctx, 11, 13 + bob, 11, 8, DONKEY.dark); // chest
  r(ctx, 12, 14 + bob, 9, 6, DONKEY.hide);
  r(ctx, 7, 12 + bob, 5, 6, LOAD.sack);
  r(ctx, 21, 12 + bob, 5, 6, LOAD.sack);
  r(ctx, 13, 7 + bob, 7, 7, DONKEY.dark); // head on
  r(ctx, 14, 8 + bob, 5, 5, DONKEY.hide);
  r(ctx, 15, 11 + bob, 3, 3, DONKEY.muzzle);
  r(ctx, 11, 4 + bob, 3, 5, DONKEY.dark); // the long ears, the giveaway
  r(ctx, 19, 4 + bob, 3, 5, DONKEY.dark);
  r(ctx, 12, 5 + bob, 1, 3, DONKEY.lit);
  r(ctx, 20, 5 + bob, 1, 3, DONKEY.lit);
  r(ctx, 14, 9 + bob, 1, 1, '#14161a');
  r(ctx, 18, 9 + bob, 1, 1, '#14161a');
};

// ============================================================
// Camel — the long-haul animal, high and slow-striding
// ============================================================

const camelSide: Draw = (ctx, f) => {
  const swing = SWING[f] * 2; // long legs, long swing
  const bob = BOB[f];
  groundShadow(ctx, 6, 21);
  for (const [lx, dir] of [[9, 1], [11, -1]] as const) {
    r(ctx, lx + swing * dir, 16 + bob, 3, 11, CAMEL.dark);
    r(ctx, lx + swing * dir, 25 + bob, 4, 2, '#3a2a12');
  }
  r(ctx, 7, 12 + bob, 17, 6, CAMEL.dark);
  r(ctx, 8, 13 + bob, 15, 4, CAMEL.hide);
  r(ctx, 9, 13 + bob, 11, 1, CAMEL.lit);
  r(ctx, 11, 7 + bob, 9, 6, CAMEL.dark); // the hump
  r(ctx, 12, 8 + bob, 7, 4, CAMEL.hide);
  r(ctx, 13, 8 + bob, 4, 1, CAMEL.lit);
  r(ctx, 5, 13 + bob, 3, 4, CAMEL.dark); // rump and tail
  r(ctx, 4, 14 + bob, 2, 6, CAMEL.dark);
  // Panniers hung low on both sides of the hump.
  r(ctx, 9, 11 + bob, 5, 5, LOAD.sack);
  r(ctx, 17, 11 + bob, 5, 5, LOAD.sack);
  r(ctx, 10, 11 + bob, 3, 1, LOAD.lit);
  r(ctx, 11, 6 + bob, 9, 2, LOAD.strap);
  for (const [lx, dir] of [[19, -1], [21, 1]] as const) {
    r(ctx, lx + swing * dir, 16 + bob, 3, 11, CAMEL.dark);
    r(ctx, lx + swing * dir, 25 + bob, 4, 2, '#3a2a12');
  }
  r(ctx, 22, 6 + bob, 4, 9, CAMEL.dark); // the long neck, rising
  r(ctx, 23, 7 + bob, 2, 8, CAMEL.hide);
  r(ctx, 24, 3 + bob, 6, 5, CAMEL.dark); // head held high
  r(ctx, 25, 4 + bob, 4, 3, CAMEL.hide);
  r(ctx, 28, 5 + bob, 2, 2, CAMEL.muzzle);
  r(ctx, 26, 4 + bob, 1, 1, '#241a08');
  r(ctx, 24, 1 + bob, 2, 3, CAMEL.dark); // ear
};

const camelBack: Draw = (ctx, f) => {
  const swing = SWING[f] * 2;
  const bob = BOB[f];
  groundShadow(ctx, 10, 13);
  for (const [lx, dir] of [[12, 1], [17, -1]] as const) {
    r(ctx, lx, 17 + bob + swing * dir, 3, 10 - swing * dir, CAMEL.dark);
    r(ctx, lx, 25 + bob, 4, 2, '#3a2a12');
  }
  r(ctx, 11, 11 + bob, 11, 9, CAMEL.dark);
  r(ctx, 12, 12 + bob, 9, 7, CAMEL.hide);
  r(ctx, 13, 12 + bob, 7, 1, CAMEL.lit);
  // The haunches, so the rear is a shape and not a slab: a shadow down the
  // centre line and the two thighs picked out either side of it.
  r(ctx, 16, 13 + bob, 2, 7, CAMEL.dark);
  r(ctx, 12, 15 + bob, 4, 5, CAMEL.lit);
  r(ctx, 18, 15 + bob, 4, 5, CAMEL.lit);
  r(ctx, 12, 19 + bob, 4, 1, CAMEL.dark);
  r(ctx, 18, 19 + bob, 4, 1, CAMEL.dark);
  r(ctx, 16, 9 + bob, 2, 7, CAMEL.dark); // tail
  r(ctx, 12, 4 + bob, 9, 7, CAMEL.dark); // hump above the shoulders
  r(ctx, 13, 5 + bob, 7, 5, CAMEL.hide);
  r(ctx, 14, 5 + bob, 4, 1, CAMEL.lit);
  r(ctx, 16, 5 + bob, 1, 5, CAMEL.dark); // the hump's own crease
  r(ctx, 7, 11 + bob, 5, 6, LOAD.sack);
  r(ctx, 21, 11 + bob, 5, 6, LOAD.sack);
  r(ctx, 8, 11 + bob, 3, 1, LOAD.lit);
  r(ctx, 11, 9 + bob, 11, 2, LOAD.strap);
};

const camelFront: Draw = (ctx, f) => {
  const swing = SWING[f] * 2;
  const bob = BOB[f];
  groundShadow(ctx, 10, 13);
  for (const [lx, dir] of [[12, -1], [17, 1]] as const) {
    r(ctx, lx, 17 + bob + swing * dir, 3, 10 - swing * dir, CAMEL.dark);
    r(ctx, lx, 25 + bob, 4, 2, '#3a2a12');
  }
  r(ctx, 11, 12 + bob, 11, 8, CAMEL.dark); // chest
  r(ctx, 12, 13 + bob, 9, 6, CAMEL.hide);
  r(ctx, 7, 11 + bob, 5, 6, LOAD.sack);
  r(ctx, 21, 11 + bob, 5, 6, LOAD.sack);
  r(ctx, 12, 5 + bob, 9, 7, CAMEL.dark); // hump behind the head
  r(ctx, 13, 6 + bob, 7, 5, CAMEL.hide);
  r(ctx, 14, 6 + bob, 5, 8, CAMEL.dark); // neck coming forward
  r(ctx, 15, 7 + bob, 3, 7, CAMEL.hide);
  r(ctx, 13, 2 + bob, 7, 6, CAMEL.dark); // head on
  r(ctx, 14, 3 + bob, 5, 4, CAMEL.hide);
  r(ctx, 15, 5 + bob, 3, 3, CAMEL.muzzle);
  r(ctx, 14, 4 + bob, 1, 1, '#241a08');
  r(ctx, 18, 4 + bob, 1, 1, '#241a08');
};

// ============================================================
// Ox cart — the road-bound one, fast on stone and hopeless in mud
// ============================================================

/** The wheel, with spokes that turn with the gait. */
function wheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, f: number): void {
  r(ctx, cx - 4, cy - 4, 8, 8, WOOD.dark);
  r(ctx, cx - 3, cy - 3, 6, 6, WOOD.mid);
  r(ctx, cx - 2, cy - 2, 4, 4, WOOD.dark);
  // Two spokes, quartered a step at a time — enough to read as rolling.
  if (f % 2 === 0) {
    r(ctx, cx - 4, cy, 8, 1, WOOD.face);
    r(ctx, cx, cy - 4, 1, 8, WOOD.face);
  } else {
    for (let i = -3; i <= 3; i++) {
      r(ctx, cx + i, cy + i, 1, 1, WOOD.face);
      r(ctx, cx + i, cy - i, 1, 1, WOOD.face);
    }
  }
  r(ctx, cx - 1, cy - 1, 2, 2, IRON.mid); // hub
}

const cartSide: Draw = (ctx, f) => {
  const swing = SWING[f];
  const bob = BOB[f];
  groundShadow(ctx, 2, 27);
  // The ox in the traces, ahead of the cart.
  for (const [lx, dir] of [[19, 1], [21, -1], [25, -1], [27, 1]] as const) {
    r(ctx, lx + swing * dir, 18 + bob, 3, 9, OX.dark);
    r(ctx, lx + swing * dir, 25 + bob, 3, 2, '#241d16');
  }
  r(ctx, 18, 12 + bob, 12, 7, OX.dark);
  r(ctx, 19, 13 + bob, 10, 5, OX.hide);
  r(ctx, 20, 13 + bob, 7, 1, OX.lit);
  r(ctx, 27, 9 + bob, 4, 6, OX.dark); // head, lowered into the yoke
  r(ctx, 28, 10 + bob, 3, 4, OX.hide);
  r(ctx, 26, 8 + bob, 6, 2, OX.pale); // horns
  r(ctx, 29, 12 + bob, 1, 1, '#141008');
  r(ctx, 17, 11 + bob, 13, 2, WOOD.dark); // yoke and shaft back to the cart
  r(ctx, 8, 15 + bob, 11, 2, WOOD.mid);
  // The cart: a plank bed, a load roped down, and two wheels.
  r(ctx, 2, 11 + bob, 15, 8, WOOD.dark);
  r(ctx, 3, 12 + bob, 13, 6, WOOD.face);
  for (let x = 4; x < 16; x += 3) r(ctx, x, 12 + bob, 1, 6, WOOD.mid);
  r(ctx, 4, 7 + bob, 11, 5, LOAD.sack); // the load, standing above the sides
  r(ctx, 5, 7 + bob, 9, 2, LOAD.lit);
  r(ctx, 7, 6 + bob, 5, 2, LOAD.tie);
  r(ctx, 6, 7 + bob, 1, 5, LOAD.strap);
  r(ctx, 12, 7 + bob, 1, 5, LOAD.strap);
  wheel(ctx, 6, 20 + bob, f);
  wheel(ctx, 14, 20 + bob, f);
};

const cartBack: Draw = (ctx, f) => {
  const bob = BOB[f];
  groundShadow(ctx, 6, 20);
  r(ctx, 11, 4 + bob, 11, 6, OX.dark); // the ox, mostly hidden ahead of the cart
  r(ctx, 12, 5 + bob, 9, 4, OX.hide);
  r(ctx, 8, 10 + bob, 17, 10, WOOD.dark); // tailgate, square on
  r(ctx, 9, 11 + bob, 15, 8, WOOD.face);
  for (let x = 10; x < 24; x += 3) r(ctx, x, 11 + bob, 1, 8, WOOD.mid);
  r(ctx, 8, 10 + bob, 17, 2, WOOD.lit); // top rail
  r(ctx, 11, 6 + bob, 11, 5, LOAD.sack); // the load showing over the rail
  r(ctx, 12, 6 + bob, 9, 2, LOAD.lit);
  r(ctx, 15, 10 + bob, 3, 9, LOAD.strap); // rope down the middle
  wheel(ctx, 7, 18 + bob, f);
  wheel(ctx, 25, 18 + bob, f);
};

const cartFront: Draw = (ctx, f) => {
  const swing = SWING[f];
  const bob = BOB[f];
  groundShadow(ctx, 6, 20);
  r(ctx, 9, 12 + bob, 15, 8, WOOD.dark); // the cart behind, wider than the ox
  r(ctx, 10, 13 + bob, 13, 6, WOOD.face);
  wheel(ctx, 8, 19 + bob, f);
  wheel(ctx, 24, 19 + bob, f);
  for (const [lx, dir] of [[12, -1], [17, 1]] as const) {
    r(ctx, lx, 19 + bob + swing * dir, 3, 8 - swing * dir, OX.dark);
    r(ctx, lx, 25 + bob, 3, 2, '#241d16');
  }
  r(ctx, 11, 11 + bob, 11, 9, OX.dark); // chest and shoulders
  r(ctx, 12, 12 + bob, 9, 7, OX.hide);
  r(ctx, 13, 12 + bob, 7, 1, OX.lit);
  r(ctx, 10, 9 + bob, 13, 2, WOOD.dark); // the yoke across them
  r(ctx, 13, 4 + bob, 7, 7, OX.dark); // head on
  r(ctx, 14, 5 + bob, 5, 5, OX.hide);
  r(ctx, 15, 8 + bob, 3, 3, OX.pale);
  r(ctx, 9, 2 + bob, 5, 2, OX.pale); // horns sweeping out
  r(ctx, 19, 2 + bob, 5, 2, OX.pale);
  r(ctx, 9, 3 + bob, 2, 2, OX.pale);
  r(ctx, 22, 3 + bob, 2, 2, OX.pale);
  r(ctx, 14, 6 + bob, 1, 1, '#141008');
  r(ctx, 18, 6 + bob, 1, 1, '#141008');
};

const DRAW: Record<CaravanKind, Record<CaravanView, Draw>> = {
  donkey: { side: donkeySide, back: donkeyBack, front: donkeyFront },
  camel: { side: camelSide, back: camelBack, front: camelFront },
  cart: { side: cartSide, back: cartBack, front: cartFront }
};
