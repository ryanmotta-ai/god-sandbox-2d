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

export type CaravanKind = 'donkey' | 'camel' | 'cart' | 'wagon' | 'lorry' | 'truck';
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
  cart: 1.05,
  wagon: 1.15,
  // For anything on rubber this is a wheel's circumference rather than a
  // stride, which is why it is short: a lorry wheel turns many times per tile.
  lorry: 0.55,
  truck: 0.70
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


const CANVAS = { shade: '#8d8271', cloth: '#c9bda6', lit: '#e3d9c4', rib: '#6f6555' };
const PAINT = { dark: '#2a3a44', body: '#3d5866', lit: '#587a8c', glass: '#9fc6d8', chrome: '#c3ccd2' };
const CAB = { dark: '#3a1d1d', body: '#7a2f2f', lit: '#a34747', glass: '#a9cede', chrome: '#cfd6db' };
const RUBBER = { tyre: '#181a1c', tread: '#2a2e31', hub: '#8b9299' };

/** A rubber wheel, whose tread turns with the distance covered. */
function tyre(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, f: number): void {
  // Corners knocked off, or a wheel reads as a crate — which is exactly what
  // a plain filled square of tread looked like beside the body.
  r(ctx, cx - radius, cy - radius + 1, radius * 2, radius * 2 - 2, RUBBER.tyre);
  r(ctx, cx - radius + 1, cy - radius, radius * 2 - 2, radius * 2, RUBBER.tyre);
  r(ctx, cx - radius + 1, cy - radius + 2, radius * 2 - 2, radius * 2 - 4, RUBBER.tread);
  r(ctx, cx - radius + 2, cy - radius + 1, radius * 2 - 4, radius * 2 - 2, RUBBER.tread);
  r(ctx, cx - 1, cy - 1, 2, 2, RUBBER.hub);
  // One bright lug, walked round the rim a quarter at a time.
  const lug: [number, number][] = [[0, -radius + 1], [radius - 2, 0], [0, radius - 2], [-radius + 1, 0]];
  r(ctx, cx + lug[f][0], cy + lug[f][1], 1, 1, RUBBER.hub);
}

// ============================================================
// Covered wagon — the classical and early-modern long hauler
// ============================================================

const wagonSide: Draw = (ctx, f) => {
  const swing = SWING[f];
  const bob = BOB[f];
  groundShadow(ctx, 1, 30);
  // The horse pair out in front, in traces.
  for (const [lx, dir] of [[21, 1], [23, -1], [26, -1], [28, 1]] as const) {
    r(ctx, lx + swing * dir, 18 + bob, 2, 9, OX.dark);
    r(ctx, lx + swing * dir, 25 + bob, 3, 2, '#241d16');
  }
  r(ctx, 20, 13 + bob, 11, 6, OX.dark);
  r(ctx, 21, 14 + bob, 9, 4, OX.hide);
  r(ctx, 22, 14 + bob, 6, 1, OX.lit);
  r(ctx, 28, 9 + bob, 4, 6, OX.dark); // head and neck
  r(ctx, 29, 10 + bob, 2, 4, OX.hide);
  r(ctx, 29, 7 + bob, 2, 3, OX.dark); // ears
  r(ctx, 19, 12 + bob, 12, 2, WOOD.dark); // the pole back to the wagon
  // The wagon: a plank bed under an arched canvas tilt on hoops.
  r(ctx, 2, 15 + bob, 18, 6, WOOD.dark);
  r(ctx, 3, 16 + bob, 16, 4, WOOD.face);
  r(ctx, 2, 5 + bob, 18, 11, CANVAS.shade);
  r(ctx, 3, 6 + bob, 16, 9, CANVAS.cloth);
  r(ctx, 4, 6 + bob, 13, 2, CANVAS.lit);
  for (let x = 5; x < 19; x += 4) r(ctx, x, 6 + bob, 1, 9, CANVAS.rib); // hoops through the cloth
  r(ctx, 2, 5 + bob, 18, 1, CANVAS.rib);
  r(ctx, 2, 9 + bob, 2, 6, '#3a3222'); // the open end, in shadow
  wheelSpoked(ctx, 5, 21 + bob, 4, f);
  wheelSpoked(ctx, 16, 20 + bob, 5, f);
};

/** A spoked wooden wheel, for anything drawn by an animal. */
function wheelSpoked(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, f: number): void {
  r(ctx, cx - radius, cy - radius, radius * 2, radius * 2, WOOD.dark);
  r(ctx, cx - radius + 1, cy - radius + 1, radius * 2 - 2, radius * 2 - 2, WOOD.mid);
  r(ctx, cx - radius + 2, cy - radius + 2, radius * 2 - 4, radius * 2 - 4, WOOD.dark);
  if (f % 2 === 0) {
    r(ctx, cx - radius, cy, radius * 2, 1, WOOD.face);
    r(ctx, cx, cy - radius, 1, radius * 2, WOOD.face);
  } else {
    for (let i = -radius + 1; i <= radius - 1; i++) {
      r(ctx, cx + i, cy + i, 1, 1, WOOD.face);
      r(ctx, cx + i, cy - i, 1, 1, WOOD.face);
    }
  }
  r(ctx, cx - 1, cy - 1, 2, 2, IRON.mid);
}

const wagonBack: Draw = (ctx, f) => {
  const bob = BOB[f];
  groundShadow(ctx, 5, 22);
  r(ctx, 12, 3 + bob, 9, 5, OX.dark); // the team, ahead and mostly hidden
  r(ctx, 13, 4 + bob, 7, 3, OX.hide);
  // The tilt seen square on: an arch of cloth over a dark opening.
  r(ctx, 6, 5 + bob, 21, 15, CANVAS.shade);
  r(ctx, 7, 6 + bob, 19, 13, CANVAS.cloth);
  r(ctx, 9, 6 + bob, 15, 2, CANVAS.lit);
  r(ctx, 11, 9 + bob, 11, 11, '#3a3222'); // the way in
  r(ctx, 12, 10 + bob, 9, 9, '#2a241a');
  r(ctx, 6, 5 + bob, 21, 1, CANVAS.rib);
  r(ctx, 6, 19 + bob, 21, 2, WOOD.dark); // tailgate
  r(ctx, 7, 19 + bob, 19, 1, WOOD.face);
  wheelSpoked(ctx, 5, 21 + bob, 5, f);
  wheelSpoked(ctx, 27, 21 + bob, 5, f);
};

const wagonFront: Draw = (ctx, f) => {
  const swing = SWING[f];
  const bob = BOB[f];
  groundShadow(ctx, 5, 22);
  r(ctx, 6, 6 + bob, 21, 14, CANVAS.shade); // the tilt behind the team
  r(ctx, 7, 7 + bob, 19, 12, CANVAS.cloth);
  wheelSpoked(ctx, 5, 21 + bob, 5, f);
  wheelSpoked(ctx, 27, 21 + bob, 5, f);
  for (const [lx, dir] of [[12, -1], [18, 1]] as const) {
    r(ctx, lx, 19 + bob + swing * dir, 3, 8 - swing * dir, OX.dark);
    r(ctx, lx, 25 + bob, 3, 2, '#241d16');
  }
  r(ctx, 10, 11 + bob, 13, 9, OX.dark); // the pair, chest on
  r(ctx, 11, 12 + bob, 11, 7, OX.hide);
  r(ctx, 16, 11 + bob, 1, 9, '#241d16'); // the gap between the two horses
  // Two heads, each with its ears rooted in the skull. Drawn as free-standing
  // bars above the heads they read as antlers, which is what they were doing.
  for (const hx of [10, 17]) {
    r(ctx, hx, 5 + bob, 5, 7, OX.dark);
    r(ctx, hx + 1, 6 + bob, 3, 5, OX.hide);
    r(ctx, hx + 1, 9 + bob, 3, 3, OX.pale); // muzzle
    r(ctx, hx, 3 + bob, 2, 3, OX.dark); // ears, close in on the skull
    r(ctx, hx + 3, 3 + bob, 2, 3, OX.dark);
    r(ctx, hx + 1, 7 + bob, 1, 1, '#141008');
    r(ctx, hx + 3, 7 + bob, 1, 1, '#141008');
  }
};

// ============================================================
// Motor lorry — the first thing on the road with an engine
// ============================================================

const lorrySide: Draw = (ctx, f) => {
  const bob = f % 2 === 0 ? 0 : -1; // the ride of a cart-sprung lorry
  groundShadow(ctx, 2, 28);
  r(ctx, 2, 10 + bob, 15, 9, WOOD.dark); // flatbed with sides
  r(ctx, 3, 11 + bob, 13, 7, WOOD.face);
  for (let x = 4; x < 16; x += 3) r(ctx, x, 11 + bob, 1, 7, WOOD.mid);
  r(ctx, 4, 6 + bob, 11, 5, LOAD.sack); // the load roped on
  r(ctx, 5, 6 + bob, 9, 2, LOAD.lit);
  r(ctx, 8, 6 + bob, 1, 5, LOAD.strap);
  r(ctx, 17, 8 + bob, 8, 11, PAINT.dark); // cab
  r(ctx, 18, 9 + bob, 6, 9, PAINT.body);
  r(ctx, 18, 9 + bob, 6, 4, PAINT.glass); // side glass
  r(ctx, 18, 9 + bob, 4, 1, '#d8ecf5');
  r(ctx, 25, 12 + bob, 6, 7, PAINT.dark); // bonnet out in front
  r(ctx, 25, 13 + bob, 5, 5, PAINT.body);
  r(ctx, 25, 13 + bob, 4, 1, PAINT.lit);
  r(ctx, 30, 14 + bob, 1, 3, PAINT.chrome); // radiator
  r(ctx, 22, 3 + bob, 2, 6, IRON.dark); // exhaust stack
  r(ctx, 21, 1 + f % 3, 4, 3, 'rgba(190, 190, 190, 0.35)'); // and its smoke
  tyre(ctx, 6, 21 + bob, 4, f);
  tyre(ctx, 14, 21 + bob, 4, f);
  tyre(ctx, 26, 21 + bob, 4, f);
};

const lorryBack: Draw = (ctx, f) => {
  const bob = f % 2 === 0 ? 0 : -1;
  groundShadow(ctx, 6, 20);
  tyre(ctx, 8, 20 + bob, 3, f); // wheels first: the body sits over them
  tyre(ctx, 23, 20 + bob, 3, f);
  r(ctx, 8, 4 + bob, 15, 8, PAINT.dark); // cab roof, seen over the load
  r(ctx, 9, 5 + bob, 13, 6, PAINT.body);
  r(ctx, 9, 6 + bob, 13, 5, LOAD.sack); // load on the bed
  r(ctx, 10, 6 + bob, 11, 2, LOAD.lit);
  r(ctx, 6, 11 + bob, 19, 10, WOOD.dark); // tailgate
  r(ctx, 7, 12 + bob, 17, 8, WOOD.face);
  for (let x = 8; x < 24; x += 3) r(ctx, x, 12 + bob, 1, 8, WOOD.mid);
  r(ctx, 6, 11 + bob, 19, 2, WOOD.lit);
  r(ctx, 7, 18 + bob, 2, 2, '#8c2f2f'); // lamps
  r(ctx, 22, 18 + bob, 2, 2, '#8c2f2f');
};

const lorryFront: Draw = (ctx, f) => {
  const bob = f % 2 === 0 ? 0 : -1;
  groundShadow(ctx, 6, 20);
  tyre(ctx, 8, 20 + bob, 3, f);
  tyre(ctx, 23, 20 + bob, 3, f);
  r(ctx, 8, 5 + bob, 15, 6, LOAD.sack); // the load showing behind the cab
  r(ctx, 7, 7 + bob, 17, 12, PAINT.dark); // cab
  r(ctx, 8, 8 + bob, 15, 10, PAINT.body);
  r(ctx, 9, 8 + bob, 13, 5, PAINT.glass); // windscreen
  r(ctx, 10, 9 + bob, 8, 2, '#d8ecf5');
  r(ctx, 12, 13 + bob, 7, 6, PAINT.dark); // radiator
  r(ctx, 13, 14 + bob, 5, 4, PAINT.chrome);
  for (let y = 14; y < 18; y += 2) r(ctx, 13, y + bob, 5, 1, PAINT.dark);
  r(ctx, 7, 13 + bob, 4, 4, '#f2e2a0'); // headlamps
  r(ctx, 20, 13 + bob, 4, 4, '#f2e2a0');
  r(ctx, 8, 14 + bob, 2, 2, '#fffbe8');
  r(ctx, 21, 14 + bob, 2, 2, '#fffbe8');
  r(ctx, 14, 2 + bob, 2, 6, IRON.dark); // exhaust
};

// ============================================================
// Articulated truck — the modern era on the highway
// ============================================================

const truckSide: Draw = (ctx, f) => {
  const bob = 0; // air suspension: a modern truck does not bounce
  groundShadow(ctx, 0, 32);
  r(ctx, 0, 7, 20, 13, '#cfd6db'); // trailer box
  r(ctx, 1, 8, 18, 11, '#e7ecef');
  r(ctx, 1, 8, 18, 2, '#ffffff');
  r(ctx, 1, 17, 18, 2, '#aab3ba');
  for (let x = 3; x < 19; x += 5) r(ctx, x, 8, 1, 11, '#c2cad0'); // panel ribs
  r(ctx, 5, 11, 9, 4, CAB.body); // the haulier's livery down the side
  r(ctx, 6, 12, 7, 1, CAB.lit);
  r(ctx, 19, 12, 2, 8, IRON.dark); // the fifth wheel and its coupling
  r(ctx, 20, 6, 10, 14, CAB.dark); // the cab, taller than the box
  r(ctx, 21, 7, 8, 12, CAB.body);
  r(ctx, 21, 7, 8, 2, CAB.lit);
  r(ctx, 24, 9, 5, 5, CAB.glass); // side window
  r(ctx, 25, 10, 3, 2, '#d8ecf5');
  r(ctx, 29, 10, 2, 8, CAB.dark); // nose
  r(ctx, 30, 12, 1, 4, CAB.chrome);
  r(ctx, 22, 3, 2, 4, CAB.chrome); // stack
  r(ctx, 27, 10, 1, 3, CAB.chrome); // mirror arm
  tyre(ctx, 4, 21 + bob, 4, f);
  tyre(ctx, 12, 21 + bob, 4, f);
  tyre(ctx, 24, 21 + bob, 4, f);
  tyre(ctx, 29, 21 + bob, 3, f);
};

const truckBack: Draw = (ctx, f) => {
  groundShadow(ctx, 6, 20);
  tyre(ctx, 9, 21, 3, f);
  tyre(ctx, 22, 21, 3, f);
  r(ctx, 6, 3, 20, 18, '#aab3ba'); // trailer, square on
  r(ctx, 7, 4, 18, 16, '#e7ecef');
  r(ctx, 15, 4, 2, 16, '#aab3ba'); // the split between the doors
  for (const dx of [8, 18]) {
    r(ctx, dx, 6, 6, 12, '#dbe2e6');
    r(ctx, dx + 1, 7, 4, 1, '#ffffff');
  }
  r(ctx, 13, 10, 2, 3, CAB.chrome); // door furniture
  r(ctx, 17, 10, 2, 3, CAB.chrome);
  r(ctx, 6, 19, 20, 2, IRON.dark); // rear bar
  r(ctx, 7, 17, 3, 2, '#c22c2c'); // tail lamps
  r(ctx, 22, 17, 3, 2, '#c22c2c');
  r(ctx, 12, 21, 3, 4, '#1c1f22'); // mudflaps, inboard of the wheels
  r(ctx, 17, 21, 3, 4, '#1c1f22');
};

const truckFront: Draw = (ctx, f) => {
  groundShadow(ctx, 6, 20);
  tyre(ctx, 9, 21, 3, f);
  tyre(ctx, 22, 21, 3, f);
  r(ctx, 7, 2, 18, 8, '#cfd6db'); // the box behind, showing over the cab
  r(ctx, 8, 3, 16, 6, '#e7ecef');
  r(ctx, 5, 6, 22, 15, CAB.dark); // cab
  r(ctx, 6, 7, 20, 13, CAB.body);
  r(ctx, 7, 7, 18, 6, CAB.glass); // windscreen
  r(ctx, 8, 8, 11, 3, '#d8ecf5');
  r(ctx, 6, 7, 20, 1, CAB.lit);
  r(ctx, 9, 14, 14, 6, CAB.dark); // grille
  r(ctx, 10, 15, 12, 4, CAB.chrome);
  for (let y = 15; y < 19; y += 2) r(ctx, 10, y, 12, 1, CAB.dark);
  r(ctx, 5, 15, 4, 4, '#f4ecc4'); // headlights
  r(ctx, 23, 15, 4, 4, '#f4ecc4');
  r(ctx, 6, 16, 2, 2, '#ffffff');
  r(ctx, 24, 16, 2, 2, '#ffffff');
  r(ctx, 2, 8, 3, 5, CAB.chrome); // mirrors on their arms
  r(ctx, 27, 8, 3, 5, CAB.chrome);
};

const DRAW: Record<CaravanKind, Record<CaravanView, Draw>> = {
  donkey: { side: donkeySide, back: donkeyBack, front: donkeyFront },
  camel: { side: camelSide, back: camelBack, front: camelFront },
  cart: { side: cartSide, back: cartBack, front: cartFront },
  wagon: { side: wagonSide, back: wagonBack, front: wagonFront },
  lorry: { side: lorrySide, back: lorryBack, front: lorryFront },
  truck: { side: truckSide, back: truckBack, front: truckFront }
};
