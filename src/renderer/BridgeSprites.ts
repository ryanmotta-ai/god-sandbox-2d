/**
 * Bridge pixel art.
 *
 * A crossing is the most expensive thing a road ever buys, so it should not
 * look like road paint over a water tile. Every model here is a real bridge
 * type, drawn as three interchangeable slices — the landfall at each end, the
 * repeating span between them, and a one-tile version for a ford — so a
 * crossing of any length in any of eight directions is built from the same
 * pieces the way a real one is built from the same bays.
 *
 * Which model appears is never a decoration choice. It falls out of what the
 * settlement could afford and knew how to build: the grade of the road, the
 * era of the realm that laid it, how many tiles of water it has to carry, and
 * what the weather does to timber where it stands.
 */

export type BridgeModel =
  | 'stones' // stepping stones at a ford — barely a bridge at all
  | 'timber' // pile trestle, the cheapest thing that carries a cart
  | 'covered' // timber under a shingled roof, where rain and ice would rot it
  | 'arch' // a single masonry arch
  | 'viaduct' // piers and arch rings, repeated across a wide reach
  | 'imperial' // dressed ashlar with a balustrade and end pillars
  | 'grand' // the great bridge: towers, statues and banners, built once an age
  | 'truss' // riveted iron lattice
  | 'suspension'; // towers, main cable and hangers

/**
 * A crossing this wide is a public work rather than infrastructure, and gets
 * the architecture to match. Kept in step with GREAT_SPAN in RoadEngineering,
 * which is what decides whether the same crossing also gets a name and an
 * opening ceremony.
 */
const GREAT_SPAN = 5;

/** Where a slice sits in the crossing. */
export type BridgeSlice = 'single' | 'approach' | 'span';

/** Canonical pixels along the bridge per tile of span. */
export const BRIDGE_SLICE_PX = 32;

/** How much of a slice's left edge is landfall detail rather than span. */
const END_PX = 8;

/**
 * The bridge a settlement actually ends up with.
 *
 * A dirt road at a one-tile ford lays stepping stones, because that is what a
 * ford is. Give it more water and it needs a trestle, and where the timber
 * would rot or ice over it gets a roof — which is exactly why covered bridges
 * cluster in cold, wet country and nowhere else. Masonry arrives with the
 * stone road: one arch at a narrows, a line of piers across a wide reach. An
 * imperial way is dressed and balustraded until industry arrives, and then it
 * is iron — a truss over a short gap, towers and cable over a long one.
 */
export function bridgeModelFor(level: number, era: string, span: number, harshClimate: boolean): BridgeModel {
  const industrial = era === 'industrial' || era === 'modern';
  if (level >= 3) {
    // Before industry, the monumental crossing is a masonry one; after it, the
    // suspension bridge *is* the monument, so it needs no separate grand form.
    if (!industrial) return span >= GREAT_SPAN ? 'grand' : 'imperial';
    return span >= 3 ? 'suspension' : 'truss';
  }
  if (level === 2) {
    if (span >= GREAT_SPAN) return 'grand';
    return span >= 3 ? 'viaduct' : 'arch';
  }
  if (span <= 1) return 'stones';
  return harshClimate ? 'covered' : 'timber';
}

const cache = new Map<string, HTMLCanvasElement>();

/** A slice, drawn once and reused. Left is the land side on an approach. */
export function bridgeSprite(model: BridgeModel, slice: BridgeSlice): HTMLCanvasElement {
  const key = `${model}:${slice}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = BRIDGE_SLICE_PX;
  canvas.height = BRIDGE_SLICE_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (slice === 'single') {
    // A one-tile crossing lands on a bank at both ends. Rather than every
    // model repeating its abutment mirrored, take the approach and fold its
    // landfall onto the far end — the two ends of a bridge are the same
    // detail facing opposite ways.
    const approach = bridgeSprite(model, 'approach');
    ctx.drawImage(approach, 0, 0);
    ctx.save();
    ctx.translate(BRIDGE_SLICE_PX, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(approach, 0, 0, END_PX, BRIDGE_SLICE_PX, 0, 0, END_PX, BRIDGE_SLICE_PX);
    ctx.restore();
  } else {
    DRAW[model](ctx, slice);
  }
  cache.set(key, canvas);
  return canvas;
}

/** Filled rect in sprite pixels — the whole vocabulary of this file. */
function r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

const TIMBER = { dark: '#2e1d0e', beam: '#4a3018', plank: '#6b4a2a', lit: '#8a6438', pale: '#a67c48' };
const STONE = { dark: '#3f3a33', joint: '#575146', face: '#7d7568', lit: '#9c9385', pale: '#bdb3a3' };
const IRON = { dark: '#1c1f22', web: '#33383d', chord: '#4d545b', lit: '#6d757e', pale: '#98a1aa' };

type Draw = (ctx: CanvasRenderingContext2D, slice: BridgeSlice) => void;

/**
 * Stepping stones. Not a structure — a line of boulders dropped in a shallow,
 * with the water still running between them, which is what a road gets when
 * nobody has paid for anything better.
 */
const drawStones: Draw = (ctx) => {
  // Boulders dropped in a shallow: no two the same size, none of them square,
  // and the current still running between them. A ford is what a road gets
  // when nobody has paid for anything better, and it should look like it.
  const stones: [number, number, number, number][] = [
    [0, 13, 6, 7], [6, 11, 5, 8], [12, 14, 6, 6], [17, 10, 5, 9], [23, 13, 6, 7], [28, 12, 4, 7]
  ];
  for (const [x, y, w, h] of stones) {
    r(ctx, x + 1, y + 2, w, h, 'rgba(8, 20, 32, 0.5)'); // the stone's shadow in the water
    r(ctx, x + 1, y, w - 2, h, STONE.dark); // wet rim, dark where it meets the water
    r(ctx, x, y + 1, w, h - 2, STONE.dark);
    r(ctx, x + 1, y + 1, w - 2, h - 2, STONE.joint);
    r(ctx, x + 1, y + 1, w - 3, h - 4, STONE.face);
    r(ctx, x + 2, y + 2, w - 5, 2, STONE.lit); // crown, worn flat by feet
  }
  r(ctx, 3, 15, 2, 1, STONE.pale);
  r(ctx, 19, 12, 2, 1, STONE.pale);
  r(ctx, 25, 15, 1, 1, STONE.pale);
};

/** Bents and decking common to both timber bridges. */
function timberSubstructure(ctx: CanvasRenderingContext2D, slice: BridgeSlice): void {
  // Pile bents first, so the deck covers their middles and only the ends
  // project past it — which is what makes the deck read as carried rather
  // than as a fence lying on the water.
  for (const bx of slice === 'span' ? [4, 20] : [2, 13, 24]) {
    r(ctx, bx, 4, 4, 24, TIMBER.dark);
    r(ctx, bx + 1, 5, 2, 22, '#3a2410');
    r(ctx, bx - 2, 5, 8, 2, TIMBER.dark); // cross-brace over the pile heads
    r(ctx, bx - 2, 25, 8, 2, TIMBER.dark);
  }
  r(ctx, 0, 8, 32, 16, TIMBER.dark); // deck bed
  r(ctx, 0, 9, 32, 14, TIMBER.beam);
  // Planks laid across the run: alternating tones, and a seam only every
  // fourth board. A dark line between every plank reads as rungs, not decking.
  for (let x = 0; x < 32; x += 2) {
    r(ctx, x, 9, 2, 14, (x >> 1) % 2 === 0 ? TIMBER.plank : '#5f4224');
  }
  for (let x = 3; x < 32; x += 8) r(ctx, x, 9, 1, 14, '#3a2410');
  r(ctx, 6, 11, 3, 9, TIMBER.lit); // boards worn pale by wheels
  r(ctx, 22, 12, 3, 8, TIMBER.lit);
  r(ctx, 15, 10, 2, 11, TIMBER.lit);
}

/** Timber pile trestle: the cheapest thing that will carry a loaded cart. */
const drawTimber: Draw = (ctx, slice) => {
  timberSubstructure(ctx, slice);
  // Log handrails, with the posts that carry them.
  for (const ry of [6, 24]) {
    r(ctx, 0, ry, 32, 2, TIMBER.dark);
    r(ctx, 0, ry, 32, 1, TIMBER.plank);
  }
  for (let x = 2; x < 32; x += 7) {
    r(ctx, x, 6, 2, 3, TIMBER.dark);
    r(ctx, x, 23, 2, 3, TIMBER.dark);
  }
  if (slice !== 'span') {
    // Landfall: a stone footing the timber sits on, and a heavier end post.
    r(ctx, 0, 6, 5, 20, STONE.joint);
    r(ctx, 0, 8, 4, 16, STONE.face);
    r(ctx, 1, 10, 2, 5, STONE.lit);
    r(ctx, 4, 4, 3, 24, TIMBER.dark);
  }
};

/**
 * A covered bridge: the same trestle with a shingled roof over it. Seen from
 * above it is almost all roof — the ridge running the length of the crossing,
 * the courses of shingles falling away either side, and a dark portal at each
 * end where the road goes in.
 */
const drawCovered: Draw = (ctx, slice) => {
  timberSubstructure(ctx, slice);
  // The roof stops short of the slice edge on both sides, so the trestle it
  // sits on stays visible underneath and the eaves read as eaves. A roof that
  // fills the tile just merges into a long brown slab.
  r(ctx, 0, 5, 32, 23, 'rgba(10, 6, 2, 0.55)'); // shadow the overhang throws
  r(ctx, 0, 4, 32, 23, '#2a1a0a');
  r(ctx, 0, 5, 32, 21, '#5a3a1c');
  // Shingle courses, stepping up to the ridge from both eaves.
  for (let x = 0; x < 32; x += 4) {
    r(ctx, x, 6, 3, 8, TIMBER.beam);
    r(ctx, x + 2, 17, 3, 8, TIMBER.beam);
    r(ctx, x, 9, 3, 1, '#3a2410');
    r(ctx, x + 2, 21, 3, 1, '#3a2410');
  }
  r(ctx, 0, 14, 32, 3, TIMBER.lit); // the ridge, catching the sky
  r(ctx, 0, 15, 32, 1, TIMBER.pale);
  r(ctx, 0, 5, 32, 1, '#8a6438'); // lit edge of each eaves board
  r(ctx, 0, 25, 32, 1, '#4a3018');
  r(ctx, 0, 26, 32, 1, '#2a1a0a');
  if (slice !== 'span') {
    // The portal: a dark opening under a headed beam.
    r(ctx, 0, 4, 6, 23, TIMBER.beam); // gable end
    r(ctx, 0, 10, 5, 12, '#160d05'); // the way in, in shadow
    r(ctx, 0, 5, 6, 2, TIMBER.lit); // barge board over the portal
    r(ctx, 0, 24, 6, 2, '#3a2410');
    r(ctx, 0, 14, 6, 3, TIMBER.pale); // the ridge, ending at the gable peak
  }
};

/** Ashlar deck with parapet walls — the body of any masonry bridge. */
function masonryDeck(ctx: CanvasRenderingContext2D): void {
  r(ctx, 0, 7, 32, 18, STONE.joint);
  r(ctx, 0, 9, 32, 14, STONE.face);
  // Coursed ashlar: staggered blocks, so the joints never line up into a grid.
  for (let x = 0; x < 32; x += 6) {
    r(ctx, x, 9, 1, 14, STONE.joint);
    r(ctx, x + 3, 9, 1, 7, STONE.joint);
  }
  r(ctx, 0, 15, 32, 1, STONE.joint);
  r(ctx, 4, 10, 4, 3, STONE.lit);
  r(ctx, 20, 18, 5, 3, STONE.lit);
  // Parapets, with coping stones along the top.
  for (const py of [4, 25]) {
    r(ctx, 0, py, 32, 3, STONE.joint);
    r(ctx, 0, py, 32, 2, STONE.lit);
    for (let x = 1; x < 32; x += 5) r(ctx, x, py, 1, 2, STONE.pale);
  }
}

/** A single masonry arch: one ring, two abutments, a cutwater upstream. */
const drawArch: Draw = (ctx, slice) => {
  // The arch ring, springing off the water just outside the parapet. It has
  // to touch the parapet: held clear of it, it reads as a separate bar
  // floating in the river rather than as the structure carrying the deck.
  r(ctx, 3, 1, 26, 4, STONE.dark);
  r(ctx, 5, 2, 22, 3, STONE.joint);
  r(ctx, 7, 2, 18, 1, STONE.face);
  r(ctx, 3, 27, 26, 4, STONE.dark);
  r(ctx, 5, 27, 22, 3, STONE.joint);
  r(ctx, 7, 29, 18, 1, STONE.face);
  masonryDeck(ctx);
  // Keystone: a voussoir a little proud of its neighbours, not a bright hole.
  r(ctx, 14, 7, 4, 18, STONE.joint);
  r(ctx, 15, 8, 2, 16, STONE.lit);
  if (slice !== 'span') {
    r(ctx, 0, 3, 6, 26, STONE.dark); // abutment sunk into the bank
    r(ctx, 0, 5, 5, 22, STONE.face);
    r(ctx, 1, 8, 2, 6, STONE.lit);
    r(ctx, 0, 0, 4, 3, STONE.joint); // cutwater nosing into the current
    r(ctx, 1, 0, 2, 2, STONE.face);
  }
};

/**
 * A viaduct: piers marching across a wide reach with arch rings between them.
 * Every slice carries its own pier, so a five-tile crossing reads as five
 * bays of one structure rather than five separate bridges.
 */
const drawViaduct: Draw = (ctx, slice) => {
  // Arch rings between the piers.
  r(ctx, 5, 2, 22, 3, STONE.dark);
  r(ctx, 8, 3, 16, 2, STONE.face);
  r(ctx, 5, 27, 22, 3, STONE.dark);
  r(ctx, 8, 27, 16, 2, STONE.face);
  // The pier, standing well proud of the deck, with a cutwater on the
  // upstream nose to split the current.
  r(ctx, 0, 1, 5, 30, STONE.dark);
  r(ctx, 0, 3, 4, 26, STONE.joint);
  r(ctx, 1, 6, 2, 8, STONE.face);
  r(ctx, 1, 18, 2, 7, STONE.face);
  r(ctx, 0, 0, 3, 2, STONE.joint);
  r(ctx, 3, 1, 2, 1, STONE.dark);
  masonryDeck(ctx);
  r(ctx, 0, 15, 32, 1, STONE.joint); // string course running the length
  if (slice !== 'span') {
    r(ctx, 0, 2, 7, 28, STONE.dark); // heavier abutment at landfall
    r(ctx, 0, 4, 6, 24, STONE.face);
    r(ctx, 1, 7, 3, 7, STONE.lit);
  }
};

/**
 * An imperial way's crossing: broad dressed slabs, a turned balustrade down
 * both sides, and a pillar at each end. Nothing structural that an arch does
 * not already do — this is a bridge built to be walked across by a procession.
 */
const drawImperial: Draw = (ctx, slice) => {
  r(ctx, 3, 2, 26, 3, STONE.dark);
  r(ctx, 3, 27, 26, 3, STONE.dark);
  r(ctx, 0, 6, 32, 20, STONE.joint);
  r(ctx, 0, 8, 32, 16, STONE.lit);
  // Broad paving slabs, joints only where the slabs meet.
  for (let x = 0; x < 32; x += 8) r(ctx, x, 8, 1, 16, STONE.joint);
  r(ctx, 0, 16, 32, 1, STONE.joint);
  r(ctx, 9, 9, 6, 3, STONE.pale);
  // Balustrade: individual balusters under a continuous rail.
  for (const by of [4, 24]) {
    for (let x = 1; x < 32; x += 3) r(ctx, x, by, 2, 4, STONE.face);
    r(ctx, 0, by === 4 ? 3 : 27, 32, 2, STONE.pale);
  }
  if (slice === 'span') {
    r(ctx, 14, 14, 5, 5, STONE.face); // medallion at the crown of the span
    r(ctx, 15, 15, 3, 3, STONE.pale);
    r(ctx, 16, 16, 1, 1, STONE.dark);
  } else {
    // End pillars, one either side of the road.
    for (const py of [1, 24]) {
      r(ctx, 0, py, 7, 7, STONE.dark);
      r(ctx, 0, py + 1, 6, 5, STONE.face);
      r(ctx, 1, py + 2, 3, 2, STONE.pale);
    }
    r(ctx, 0, 8, 4, 16, STONE.face);
  }
};

/**
 * The great bridge. Everything a viaduct has, built heavier and then decorated:
 * paired piers with deep cutwaters, a statue on a plinth over every pier, a
 * pierced balustrade between them, and a gatehouse tower with a banner where
 * the road comes ashore. This is the one a realm builds once and names.
 */
const drawGrand: Draw = (ctx, slice) => {
  // Arch rings, springing wide off the water either side of the deck.
  r(ctx, 4, 0, 24, 5, STONE.dark);
  r(ctx, 6, 1, 20, 3, STONE.joint);
  r(ctx, 9, 1, 14, 1, STONE.face);
  r(ctx, 4, 27, 24, 5, STONE.dark);
  r(ctx, 6, 28, 20, 3, STONE.joint);
  r(ctx, 9, 30, 14, 1, STONE.face);

  // Paired piers, with a cutwater driven into the current on both noses.
  for (const px of [0, 26]) {
    r(ctx, px, 0, 6, 32, STONE.dark);
    r(ctx, px, 2, 5, 28, STONE.joint);
    r(ctx, px + 1, 5, 3, 9, STONE.face);
    r(ctx, px + 1, 18, 3, 9, STONE.face);
    r(ctx, px + 1, 6, 1, 6, STONE.lit);
  }

  r(ctx, 0, 6, 32, 20, STONE.joint); // the deck, broader than any other model
  r(ctx, 0, 8, 32, 16, STONE.lit);
  for (let x = 0; x < 32; x += 8) r(ctx, x, 8, 1, 16, STONE.joint);
  r(ctx, 0, 16, 32, 1, STONE.joint);
  r(ctx, 3, 9, 5, 3, STONE.pale);
  r(ctx, 19, 19, 6, 3, STONE.pale);

  // A pierced balustrade down both sides, under a heavy coping rail.
  for (const by of [4, 24]) {
    for (let x = 1; x < 32; x += 3) r(ctx, x, by, 2, 4, STONE.face);
    r(ctx, 0, by === 4 ? 3 : 27, 32, 2, STONE.pale);
    r(ctx, 0, by === 4 ? 2 : 29, 32, 1, STONE.dark);
  }

  if (slice === 'span') {
    // Statues on plinths, one over each pier, facing the water.
    for (const sy of [1, 27]) {
      r(ctx, 13, sy, 6, 4, STONE.dark);
      r(ctx, 14, sy, 4, 3, STONE.face);
      r(ctx, 15, sy === 1 ? sy : sy + 1, 2, 2, STONE.pale);
    }
    r(ctx, 14, 14, 4, 4, STONE.face); // roundel at the crown of the bay
    r(ctx, 15, 15, 2, 2, STONE.pale);
  } else {
    // The gatehouse: a tower each side of the road, with a banner flying.
    for (const ty of [0, 22]) {
      r(ctx, 0, ty, 10, 10, STONE.dark);
      r(ctx, 0, ty + 1, 9, 8, STONE.face);
      r(ctx, 1, ty + 2, 3, 5, STONE.lit);
      for (let x = 0; x < 9; x += 3) r(ctx, x, ty, 2, 2, STONE.pale); // merlons
    }
    r(ctx, 2, 10, 3, 3, '#8c2f2f'); // banner
    r(ctx, 2, 20, 3, 3, '#8c2f2f');
    r(ctx, 4, 10, 1, 3, '#5e1c1c');
    r(ctx, 4, 20, 1, 3, '#5e1c1c');
    r(ctx, 0, 12, 4, 9, STONE.joint); // the abutment the towers stand on
  }
};

/**
 * A riveted iron truss. The lattice down both sides is what carries the load
 * and what the eye reads: a road on a plate girder looks like a road, a road
 * inside a truss looks like industry.
 */
const drawTruss: Draw = (ctx, slice) => {
  r(ctx, 0, 8, 32, 16, IRON.dark); // deck bed
  r(ctx, 0, 9, 32, 14, IRON.chord);
  for (let x = 0; x < 32; x += 4) r(ctx, x, 9, 1, 14, IRON.dark); // deck plates
  r(ctx, 0, 15, 32, 2, IRON.lit);
  // The X-bracing, one bay every eight pixels, top and bottom.
  for (let bay = 0; bay < 32; bay += 8) {
    for (let i = 0; i < 5; i++) {
      r(ctx, bay + i, 7 - i, 1, 1, IRON.web);
      r(ctx, bay + 4 - i, 7 - i, 1, 1, IRON.web);
      r(ctx, bay + i, 24 + i, 1, 1, IRON.web);
      r(ctx, bay + 4 - i, 24 + i, 1, 1, IRON.web);
    }
    r(ctx, bay, 3, 1, 5, IRON.chord); // verticals at the panel points
    r(ctx, bay, 24, 1, 5, IRON.chord);
  }
  // Top and bottom chords, riveted.
  for (const cy of [2, 28]) {
    r(ctx, 0, cy, 32, 3, IRON.chord);
    r(ctx, 0, cy, 32, 1, IRON.lit);
    for (let x = 1; x < 32; x += 4) r(ctx, x, cy + 1, 1, 1, IRON.pale);
  }
  if (slice !== 'span') {
    // Portal frame over the entry.
    r(ctx, 0, 1, 4, 30, IRON.chord);
    r(ctx, 1, 3, 2, 26, IRON.dark);
    r(ctx, 0, 9, 5, 14, IRON.lit);
    r(ctx, 1, 14, 2, 2, IRON.pale);
  }
};

/**
 * A suspension bridge. The towers and the deck are here; the main cable is
 * drawn by the renderer as one sagging curve across the whole crossing,
 * because a cable that sags is the one part of a bridge a repeating tile
 * cannot express.
 */
const drawSuspension: Draw = (ctx, slice) => {
  r(ctx, 0, 8, 32, 16, IRON.dark);
  r(ctx, 0, 9, 32, 14, '#3a3a3f'); // asphalt deck
  r(ctx, 0, 9, 32, 2, IRON.chord); // edge girders
  r(ctx, 0, 21, 32, 2, IRON.chord);
  for (let x = 2; x < 32; x += 10) r(ctx, x, 15, 5, 2, 'rgba(226, 200, 96, 0.85)'); // centre line
  // Hangers running out to where the cable will pass.
  for (let x = 3; x < 32; x += 5) {
    r(ctx, x, 4, 1, 5, IRON.pale);
    r(ctx, x, 23, 1, 5, IRON.pale);
  }
  if (slice !== 'span') {
    // The tower: two legs and the cross-beam that ties them.
    r(ctx, 2, 0, 5, 32, IRON.dark);
    r(ctx, 3, 1, 3, 30, IRON.chord);
    r(ctx, 3, 3, 1, 26, IRON.lit);
    r(ctx, 0, 6, 9, 3, IRON.chord);
    r(ctx, 0, 23, 9, 3, IRON.chord);
    r(ctx, 3, 6, 3, 1, IRON.pale);
    r(ctx, 0, 12, 3, 8, IRON.chord); // anchorage block on the bank
  }
};

const DRAW: Record<BridgeModel, Draw> = {
  stones: drawStones,
  timber: drawTimber,
  covered: drawCovered,
  arch: drawArch,
  viaduct: drawViaduct,
  imperial: drawImperial,
  grand: drawGrand,
  truss: drawTruss,
  suspension: drawSuspension
};

/** Half-width of the structure, as a fraction of a tile, for the deck shadow. */
export const BRIDGE_HALF_WIDTH: Record<BridgeModel, number> = {
  stones: 0.32,
  timber: 0.42,
  covered: 0.50,
  arch: 0.44,
  viaduct: 0.47,
  imperial: 0.47,
  grand: 0.54,
  truss: 0.46,
  suspension: 0.42
};

/** Models whose main cable the renderer has to draw across the whole crossing. */
export function needsCable(model: BridgeModel): boolean {
  return model === 'suspension';
}

/** Whether the structure floats above the water and should throw a shadow. */
export function throwsShadow(model: BridgeModel): boolean {
  return model !== 'stones';
}
