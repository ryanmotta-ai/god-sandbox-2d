/**
 * Aircraft pixel art, drawn from directly overhead.
 *
 * Everything else that moves on this map is drawn from a low angle, because
 * everything else is on the ground and you look *across* at it. An aeroplane
 * is the one thing you look *down* on, so it is drawn as a plan view — wings
 * out flat, nose forward — and simply rotated to its heading. That is also
 * why it needs no left-hand mirror and no set of views: from above there is
 * only one view, turned.
 *
 * Height is carried by the renderer instead, which slides the shadow out from
 * under the aircraft as it climbs and pulls it back in as it lands. That
 * separation is the only cue a top-down map has for altitude, and it is
 * enough: a shadow tucked under the wheels reads as on the ground, and a
 * shadow thrown well behind reads as high.
 */

export type AircraftKind = 'airliner' | 'freighter';

/** Canonical sprite size. Nose points up (−y) at rotation 0. */
export const AIRCRAFT_PX = 32;
/** Frames in the propeller/beacon cycle. */
export const AIRCRAFT_FRAMES = 4;

const cache = new Map<string, HTMLCanvasElement>();

export function aircraftSprite(kind: AircraftKind, frame: number): HTMLCanvasElement {
  const f = ((frame % AIRCRAFT_FRAMES) + AIRCRAFT_FRAMES) % AIRCRAFT_FRAMES;
  const key = `${kind}:${f}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = AIRCRAFT_PX;
  canvas.height = AIRCRAFT_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  DRAW[kind](ctx, f);
  cache.set(key, canvas);
  return canvas;
}

function r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

const HULL = { dark: '#7d848c', body: '#c8cfd6', lit: '#e9eef2', pale: '#ffffff', trim: '#2f4d6b' };
const CARGO = { dark: '#4a4033', body: '#8b7c63', lit: '#a9996e', pale: '#c4b79c', trim: '#5c6b3a' };
const GLASS = '#3d5b74';

type Draw = (ctx: CanvasRenderingContext2D, frame: number) => void;

/** The navigation lights every aircraft carries: red to port, green to starboard. */
function navLights(ctx: CanvasRenderingContext2D, span: number, y: number, f: number): void {
  const on = f % 2 === 0;
  r(ctx, 16 - span, y, 1, 1, on ? '#ff5252' : '#8c2222');
  r(ctx, 15 + span, y, 1, 1, on ? '#4ade80' : '#1f6b3a');
}

/**
 * An airliner: narrow tube, swept wings, engines slung under them, tail fin
 * at the back. Passengers, which is why the windows run the length of it.
 */
const drawAirliner: Draw = (ctx, f) => {
  // Wings, swept back from the shoulder.
  r(ctx, 3, 15, 26, 3, HULL.dark);
  r(ctx, 4, 14, 24, 3, HULL.body);
  r(ctx, 6, 14, 20, 1, HULL.lit);
  r(ctx, 3, 17, 5, 2, HULL.dark); // the trailing edge, raked
  r(ctx, 24, 17, 5, 2, HULL.dark);
  // Engines under each wing, ahead of the leading edge.
  for (const ex of [8, 21]) {
    r(ctx, ex, 12, 3, 6, HULL.dark);
    r(ctx, ex, 13, 3, 4, '#5b636b');
    r(ctx, ex, 12, 3, 1, HULL.pale);
  }
  // Tailplane.
  r(ctx, 10, 25, 12, 2, HULL.dark);
  r(ctx, 11, 24, 10, 2, HULL.body);
  // Fuselage over the top of everything.
  r(ctx, 14, 4, 4, 24, HULL.dark);
  r(ctx, 14, 5, 3, 22, HULL.body);
  r(ctx, 15, 6, 1, 20, HULL.lit);
  r(ctx, 14, 3, 4, 3, HULL.dark); // nose
  r(ctx, 15, 3, 2, 2, HULL.body);
  r(ctx, 15, 5, 2, 2, GLASS); // flight deck
  // Cabin windows and the stripe under them.
  for (let y = 9; y < 24; y += 2) r(ctx, 17, y, 1, 1, GLASS);
  r(ctx, 14, 20, 4, 1, HULL.trim);
  // Fin, standing up out of the tail.
  r(ctx, 15, 24, 2, 6, HULL.dark);
  r(ctx, 15, 25, 1, 4, HULL.trim);
  navLights(ctx, 13, 16, f);
  // The anti-collision beacon on the spine.
  if (f === 0) r(ctx, 15, 13, 2, 1, '#fff1a8');
};

/**
 * A freighter: fat high-winged hull with a raised flight deck and a ramp door
 * at the back, four engines because it is always heavy. Same plan view, an
 * entirely different silhouette.
 */
const drawFreighter: Draw = (ctx, f) => {
  // A broader, straighter wing than the airliner's — it lifts, it does not race.
  r(ctx, 1, 13, 30, 4, CARGO.dark);
  r(ctx, 2, 12, 28, 4, CARGO.body);
  r(ctx, 5, 12, 22, 1, CARGO.pale);
  // Four engines, paired on each wing.
  for (const ex of [5, 10, 20, 25]) {
    r(ctx, ex, 10, 3, 6, CARGO.dark);
    r(ctx, ex, 11, 3, 4, '#3f4a52');
    r(ctx, ex, 10, 3, 1, HULL.pale);
    // Propeller discs, blurred round as they turn.
    if (f % 2 === 0) r(ctx, ex - 1, 9, 5, 1, 'rgba(210, 214, 218, 0.5)');
    else r(ctx, ex, 8, 3, 2, 'rgba(210, 214, 218, 0.35)');
  }
  // Tailplane, with the twin fins this sort of aircraft carries.
  r(ctx, 8, 25, 16, 3, CARGO.dark);
  r(ctx, 9, 24, 14, 2, CARGO.body);
  r(ctx, 8, 23, 2, 5, CARGO.dark);
  r(ctx, 22, 23, 2, 5, CARGO.dark);
  // The hull: wide, slab-sided, blunt at both ends.
  r(ctx, 12, 3, 8, 26, CARGO.dark);
  r(ctx, 13, 4, 6, 24, CARGO.body);
  r(ctx, 14, 5, 2, 22, CARGO.pale);
  r(ctx, 13, 3, 6, 3, CARGO.dark); // nose
  r(ctx, 14, 4, 4, 2, GLASS); // flight deck, up on the shoulder
  r(ctx, 15, 4, 2, 1, '#7fa6c4');
  r(ctx, 13, 24, 6, 4, '#3a332a'); // ramp door at the back
  r(ctx, 14, 25, 4, 2, CARGO.trim);
  r(ctx, 12, 10, 8, 1, CARGO.trim); // hull band
  r(ctx, 12, 18, 8, 1, CARGO.trim);
  navLights(ctx, 15, 14, f);
  if (f === 2) r(ctx, 15, 8, 2, 1, '#fff1a8');
};

const DRAW: Record<AircraftKind, Draw> = {
  airliner: drawAirliner,
  freighter: drawFreighter
};
