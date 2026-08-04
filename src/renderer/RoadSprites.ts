/**
 * Roadside pixel art.
 *
 * The things that stand *beside* a road rather than being part of its surface:
 * the stone that says how far it is to the next town, the post that says which
 * way, the shrine travellers leave something at, the marker where one realm
 * ends, and the lamp that only a city can afford to keep lit.
 *
 * These were crude filled rectangles before — a milestone was two boxes, a
 * frontier post a line with two dots. At close zoom a road is mostly the
 * things along it, so they are drawn properly here and placed sparsely by the
 * renderer, which is the only way small detail reads as detail rather than
 * clutter.
 */

export type RoadProp = 'milestone' | 'signpost' | 'shrine' | 'frontier' | 'lamp';

/** Canonical sprite sizes, in pixels. Width first. */
const SIZES: Record<RoadProp, [number, number]> = {
  milestone: [12, 16],
  signpost: [16, 16],
  shrine: [16, 18],
  frontier: [22, 16],
  lamp: [12, 20]
};

/** How tall the prop stands, as a fraction of a tile. */
export const PROP_SCALE: Record<RoadProp, number> = {
  milestone: 0.34,
  signpost: 0.40,
  shrine: 0.44,
  frontier: 0.46,
  lamp: 0.42
};

const cache = new Map<string, HTMLCanvasElement>();

export function roadProp(prop: RoadProp, variant: number = 0): HTMLCanvasElement {
  const key = `${prop}:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [w, h] = SIZES[prop];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  DRAW[prop](ctx, variant);
  cache.set(key, canvas);
  return canvas;
}

/** Aspect ratio, so the renderer can size a prop without knowing its pixels. */
export function propAspect(prop: RoadProp): number {
  return SIZES[prop][0] / SIZES[prop][1];
}

function r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

const STONE = { shadow: 'rgba(10, 14, 10, 0.35)', dark: '#4a453c', mid: '#6f685c', face: '#8d8577', lit: '#aaa093', pale: '#c9c0af' };
const WOOD = { dark: '#33210f', mid: '#5a3d1e', face: '#7a552c', lit: '#9b7040' };
const IRON = { dark: '#191c1f', mid: '#333940', lit: '#5a636c' };

type Draw = (ctx: CanvasRenderingContext2D, variant: number) => void;

/**
 * A milestone: a dressed column on a square plinth, with the distance cut into
 * it. Roman roads were measured every mile and the stones outlived the empire.
 */
const drawMilestone: Draw = (ctx, variant) => {
  r(ctx, 1, 14, 11, 2, STONE.shadow);
  r(ctx, 1, 12, 10, 3, STONE.dark); // plinth
  r(ctx, 2, 12, 8, 2, STONE.mid);
  r(ctx, 3, 3, 6, 10, STONE.dark); // column
  r(ctx, 3, 3, 5, 9, STONE.face);
  r(ctx, 4, 4, 2, 8, STONE.lit);
  r(ctx, 3, 1, 6, 3, STONE.dark); // rounded cap
  r(ctx, 4, 1, 4, 2, STONE.lit);
  r(ctx, 5, 1, 2, 1, STONE.pale);
  // The inscription, cut in courses. Two variants so a road is not one stone
  // repeated all the way to the horizon.
  r(ctx, 4, 6, 4, 1, STONE.dark);
  r(ctx, 4, 8, variant % 2 === 0 ? 3 : 4, 1, STONE.dark);
  if (variant % 2 === 0) r(ctx, 4, 10, 2, 1, STONE.dark);
};

/** A fingerpost: two arms on a post, pointing the two ways the road goes. */
const drawSignpost: Draw = (ctx, variant) => {
  r(ctx, 6, 14, 6, 2, STONE.shadow);
  r(ctx, 7, 4, 3, 12, WOOD.dark); // post
  r(ctx, 7, 4, 2, 12, WOOD.mid);
  r(ctx, 7, 5, 1, 10, WOOD.face);
  r(ctx, 5, 13, 7, 2, STONE.mid); // packed stone at the foot
  // Arms, one each way, the far one a little lower.
  r(ctx, 1, 5, 7, 3, WOOD.dark);
  r(ctx, 1, 5, 6, 2, WOOD.face);
  r(ctx, 1, 5, 1, 2, WOOD.lit);
  r(ctx, 9, variant % 2 === 0 ? 8 : 9, 6, 3, WOOD.dark);
  r(ctx, 10, variant % 2 === 0 ? 8 : 9, 5, 2, WOOD.face);
  r(ctx, 14, variant % 2 === 0 ? 8 : 9, 1, 2, WOOD.lit);
  // Lettering, as marks rather than glyphs — a legible word at this size is
  // a lie, but the rhythm of cut letters is not.
  r(ctx, 2, 6, 4, 1, WOOD.dark);
  r(ctx, 11, variant % 2 === 0 ? 9 : 10, 3, 1, WOOD.dark);
};

/**
 * A wayside shrine: a niche on a plinth with something left in it. Every long
 * road in the world has these, put up by people who were glad to arrive.
 */
const drawShrine: Draw = (ctx, variant) => {
  r(ctx, 2, 16, 12, 2, STONE.shadow);
  r(ctx, 1, 13, 13, 4, STONE.dark); // steps
  r(ctx, 2, 13, 11, 2, STONE.mid);
  r(ctx, 3, 5, 10, 9, STONE.dark); // body
  r(ctx, 3, 5, 9, 8, STONE.face);
  r(ctx, 4, 6, 2, 7, STONE.lit);
  r(ctx, 5, 7, 5, 6, '#241f1a'); // the niche, in shadow
  r(ctx, 6, 9, 3, 3, variant % 2 === 0 ? '#c9a227' : '#8fb8d8'); // the offering
  r(ctx, 7, 10, 1, 1, STONE.pale);
  r(ctx, 2, 2, 12, 4, STONE.dark); // gabled roof
  r(ctx, 3, 2, 10, 3, STONE.mid);
  r(ctx, 5, 2, 6, 1, STONE.lit);
  r(ctx, 7, 0, 2, 2, STONE.face); // finial
  // Moss, because nobody has scrubbed a wayside shrine in a century.
  r(ctx, 3, 12, 2, 1, '#4a5c32');
  r(ctx, 11, 13, 2, 1, '#4a5c32');
};

/**
 * A frontier marker: a pillar each side of the road carrying a barred beam,
 * each cut with the arms of the realm behind it. Small on purpose — the old
 * twin-tower gate buried the road it was supposed to stand beside.
 */
const drawFrontier: Draw = (ctx) => {
  r(ctx, 1, 14, 20, 2, STONE.shadow);
  for (const x of [1, 16]) {
    r(ctx, x, 3, 5, 12, STONE.dark);
    r(ctx, x, 3, 4, 11, STONE.face);
    r(ctx, x + 1, 5, 2, 8, STONE.lit);
    r(ctx, x, 1, 5, 3, STONE.dark); // capstone
    r(ctx, x + 1, 1, 3, 2, STONE.pale);
    r(ctx, x + 1, 7, 3, 3, STONE.dark); // the shield cut into the pillar
    r(ctx, x + 2, 8, 1, 1, STONE.pale);
  }
  // The beam between them, and its shadow on the road.
  r(ctx, 5, 6, 12, 3, IRON.dark);
  r(ctx, 5, 6, 12, 2, IRON.mid);
  r(ctx, 6, 6, 10, 1, IRON.lit);
  for (let x = 6; x < 16; x += 3) r(ctx, x, 7, 1, 2, IRON.dark);
};

/** A lamp standard: iron post, scrolled bracket, and a lit lantern. */
const drawLamp: Draw = (ctx) => {
  r(ctx, 3, 18, 7, 2, STONE.shadow);
  r(ctx, 4, 16, 5, 3, IRON.dark); // base
  r(ctx, 5, 16, 3, 2, IRON.mid);
  r(ctx, 5, 6, 3, 11, IRON.dark); // post
  r(ctx, 5, 6, 2, 11, IRON.mid);
  r(ctx, 5, 8, 1, 8, IRON.lit);
  r(ctx, 4, 5, 5, 2, IRON.dark); // bracket
  r(ctx, 3, 1, 7, 5, IRON.dark); // lantern housing
  r(ctx, 4, 2, 5, 4, '#f2d089'); // the glass, lit
  r(ctx, 5, 2, 3, 2, '#fff3c4');
  r(ctx, 4, 0, 5, 2, IRON.mid); // cowl
  r(ctx, 5, 0, 3, 1, IRON.lit);
};

const DRAW: Record<RoadProp, Draw> = {
  milestone: drawMilestone,
  signpost: drawSignpost,
  shrine: drawShrine,
  frontier: drawFrontier,
  lamp: drawLamp
};
