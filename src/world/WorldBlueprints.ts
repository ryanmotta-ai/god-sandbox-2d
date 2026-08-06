/**
 * The three worlds of Aethoria, drawn by hand.
 *
 * These maps are not rolled — every player gets the same three, every time. That
 * only works if they are actually designed, so each one is described here as a
 * deliberate arrangement of landmasses, mountain spines, forests and wetlands
 * rather than as noise with a mask over it. Noise still runs on top, seeded from
 * a fixed number, purely to break up coastlines that would otherwise read as
 * geometry.
 *
 * Everything is in normalized coordinates (0..1 across the map) so the same
 * design holds its proportions at 64×64 and at 128×128.
 */

/** An elliptical region with a soft edge. `strength` may be negative to carve. */
export interface Blob {
  u: number;
  v: number;
  /** Horizontal radius, as a fraction of map width. */
  ru: number;
  /** Vertical radius, as a fraction of map height. */
  rv: number;
  /** How hard it pushes the height field. Negative digs a bay or a strait. */
  strength: number;
}

/** A mountain spine: a path the range follows, and how wide it is. */
export interface Ridge {
  path: { u: number; v: number }[];
  /** Half-width of the range, as a fraction of the smaller map dimension. */
  width: number;
  /** Peak contribution at the centreline. */
  height: number;
}

export interface WorldBlueprint {
  id: 'single_continent' | 'two_continents' | 'archipelago';
  name: string;
  /** One line the setup screen shows under the name. */
  tagline: string;
  /** What playing this map is actually like. */
  description: string;
  /** Short, concrete facts for the setup screen. No invented numbers. */
  highlights: string[];
  /** Fixed. Changing it changes the world, which is the whole point of fixing it. */
  seed: number;
  land: Blob[];
  ranges: Ridge[];
  forests: Blob[];
  wetlands: Blob[];
  /** Arid regions — pushed dry regardless of latitude. */
  drylands: Blob[];
}

export const WORLD_BLUEPRINTS: Record<WorldBlueprint['id'], WorldBlueprint> = {
  // ============================================================
  // ONE CONTINENT — a single crowded landmass. Neighbours from year one.
  // ============================================================
  single_continent: {
    id: 'single_continent',
    name: 'Continente Único',
    tagline: 'Um só continente. Ninguém tem para onde fugir.',
    description:
      'Uma massa continental contínua cortada por uma grande cordilheira e aberta ' +
      'por um golfo profundo a oeste. Todos os reinos nascem no mesmo corpo de ' +
      'terra, então as fronteiras se encostam cedo e a diplomacia começa a valer ' +
      'antes da primeira frota existir.',
    highlights: [
      'Golfo profundo a oeste, com pântanos de foz',
      'Cordilheira central separando o norte do sul',
      'Arquipélago pequeno a leste, alcançável por mar',
      'Fronteiras terrestres desde os primeiros séculos'
    ],
    seed: 104729,
    land: [
      // The continent proper, slightly taller than it is wide.
      { u: 0.50, v: 0.50, ru: 0.41, rv: 0.43, strength: 1.0 },
      // A shoulder to the north-east so the outline is not a plain oval.
      { u: 0.68, v: 0.26, ru: 0.16, rv: 0.14, strength: 0.55 },
      // The southern peninsula: good farmland, far from the capital.
      { u: 0.66, v: 0.80, ru: 0.15, rv: 0.13, strength: 0.6 },
      // Offshore islands to the east — a reason to build ports.
      { u: 0.90, v: 0.44, ru: 0.045, rv: 0.05, strength: 0.75 },
      { u: 0.94, v: 0.57, ru: 0.035, rv: 0.04, strength: 0.7 },
      { u: 0.86, v: 0.66, ru: 0.03, rv: 0.035, strength: 0.65 },
      // The western gulf, carved back out of the continent.
      { u: 0.19, v: 0.50, ru: 0.15, rv: 0.11, strength: -1.15 },
      // A narrower inlet feeding it, which is where the wetlands sit.
      { u: 0.30, v: 0.50, ru: 0.07, rv: 0.045, strength: -0.75 }
    ],
    ranges: [
      // The spine: runs from the northern coast down into the interior.
      {
        path: [{ u: 0.40, v: 0.16 }, { u: 0.47, v: 0.33 }, { u: 0.55, v: 0.48 }, { u: 0.58, v: 0.64 }],
        width: 0.055,
        height: 0.52
      },
      // A shorter southern range, isolating the peninsula.
      {
        path: [{ u: 0.46, v: 0.76 }, { u: 0.57, v: 0.83 }],
        width: 0.04,
        height: 0.4
      }
    ],
    forests: [
      { u: 0.70, v: 0.40, ru: 0.15, rv: 0.16, strength: 1.0 },
      { u: 0.38, v: 0.66, ru: 0.16, rv: 0.15, strength: 1.0 },
      { u: 0.44, v: 0.24, ru: 0.11, rv: 0.10, strength: 0.8 }
    ],
    wetlands: [
      { u: 0.33, v: 0.52, ru: 0.08, rv: 0.06, strength: 1.0 }
    ],
    drylands: [
      { u: 0.72, v: 0.60, ru: 0.11, rv: 0.10, strength: 1.0 }
    ]
  },

  // ============================================================
  // TWO CONTINENTS — a strait in the middle. The sea is the whole game.
  // ============================================================
  two_continents: {
    id: 'two_continents',
    name: 'Dois Continentes',
    tagline: 'Duas terras, um estreito, e ilhas no meio do caminho.',
    description:
      'Duas massas continentais de tamanho parecido, separadas por um estreito ' +
      'que uma cadeia de ilhas atravessa. Cada lado se desenvolve isolado até ' +
      'alguém dominar navegação — e a partir daí as ilhas do meio viram a coisa ' +
      'mais disputada do mundo.',
    highlights: [
      'Duas massas de terra equilibradas, oeste e leste',
      'Cadeia de ilhas atravessando o estreito central',
      'Cordilheira costeira em cada continente',
      'Sem contato terrestre: tudo depende de portos'
    ],
    seed: 224737,
    land: [
      // West continent: taller, with a bite taken out of its southern coast.
      { u: 0.23, v: 0.46, ru: 0.19, rv: 0.36, strength: 1.0 },
      { u: 0.30, v: 0.74, ru: 0.10, rv: 0.12, strength: 0.6 },
      { u: 0.18, v: 0.78, ru: 0.07, rv: 0.06, strength: -0.9 },
      // East continent: wider in the north, tapering south.
      { u: 0.78, v: 0.44, ru: 0.18, rv: 0.34, strength: 1.0 },
      { u: 0.72, v: 0.22, ru: 0.12, rv: 0.11, strength: 0.6 },
      { u: 0.84, v: 0.72, ru: 0.09, rv: 0.11, strength: 0.55 },
      // The stepping stones. Small enough to be worth fighting over, big
      // enough to hold a port.
      { u: 0.50, v: 0.30, ru: 0.05, rv: 0.055, strength: 0.8 },
      { u: 0.51, v: 0.50, ru: 0.062, rv: 0.06, strength: 0.85 },
      { u: 0.49, v: 0.70, ru: 0.048, rv: 0.05, strength: 0.78 }
    ],
    ranges: [
      {
        path: [{ u: 0.16, v: 0.20 }, { u: 0.21, v: 0.42 }, { u: 0.18, v: 0.66 }],
        width: 0.05,
        height: 0.48
      },
      {
        path: [{ u: 0.85, v: 0.22 }, { u: 0.80, v: 0.44 }, { u: 0.84, v: 0.66 }],
        width: 0.05,
        height: 0.48
      }
    ],
    forests: [
      { u: 0.29, v: 0.32, ru: 0.11, rv: 0.14, strength: 1.0 },
      { u: 0.26, v: 0.62, ru: 0.10, rv: 0.13, strength: 0.9 },
      { u: 0.73, v: 0.56, ru: 0.11, rv: 0.15, strength: 1.0 },
      { u: 0.51, v: 0.50, ru: 0.05, rv: 0.05, strength: 0.7 }
    ],
    wetlands: [
      { u: 0.31, v: 0.76, ru: 0.07, rv: 0.05, strength: 1.0 },
      { u: 0.83, v: 0.74, ru: 0.06, rv: 0.05, strength: 0.9 }
    ],
    drylands: [
      { u: 0.75, v: 0.36, ru: 0.09, rv: 0.10, strength: 1.0 }
    ]
  },

  // ============================================================
  // ARCHIPELAGO — many small homes. Everything is a crossing.
  // ============================================================
  archipelago: {
    id: 'archipelago',
    name: 'Arquipélago',
    tagline: 'Muitas ilhas, pouca terra, e o mar entre cada decisão.',
    description:
      'Uma ilha central maior cercada por um anel de ilhas menores. Terra é o ' +
      'recurso escasso: as cidades crescem apertadas, cada excedente precisa ' +
      'cruzar água, e uma frota vale mais que um exército.',
    highlights: [
      'Ilha central grande, com o único pico do mundo',
      'Anel de ilhas menores ao redor, todas habitáveis',
      'Territórios pequenos: expansão exige o mar',
      'Rotas marítimas desde o começo da partida'
    ],
    seed: 350377,
    land: [
      // The heart of the world.
      { u: 0.50, v: 0.50, ru: 0.155, rv: 0.145, strength: 1.0 },
      // The inner ring — close enough to reach early.
      { u: 0.28, v: 0.34, ru: 0.082, rv: 0.078, strength: 0.92 },
      { u: 0.72, v: 0.32, ru: 0.088, rv: 0.072, strength: 0.92 },
      { u: 0.75, v: 0.66, ru: 0.080, rv: 0.082, strength: 0.9 },
      { u: 0.27, v: 0.68, ru: 0.086, rv: 0.076, strength: 0.9 },
      // The outer ring — later, and worth the voyage.
      { u: 0.50, v: 0.16, ru: 0.062, rv: 0.055, strength: 0.82 },
      { u: 0.50, v: 0.85, ru: 0.058, rv: 0.055, strength: 0.8 },
      { u: 0.12, v: 0.50, ru: 0.055, rv: 0.065, strength: 0.8 },
      { u: 0.88, v: 0.50, ru: 0.058, rv: 0.068, strength: 0.82 },
      // Scattered islets: fishing grounds and stepping stones.
      { u: 0.37, v: 0.19, ru: 0.028, rv: 0.026, strength: 0.7 },
      { u: 0.63, v: 0.82, ru: 0.026, rv: 0.026, strength: 0.68 },
      { u: 0.16, v: 0.27, ru: 0.024, rv: 0.024, strength: 0.66 },
      { u: 0.86, v: 0.76, ru: 0.026, rv: 0.024, strength: 0.66 }
    ],
    ranges: [
      // A single volcanic ridge on the central island, and nowhere else. It is
      // the only source of stone and metal in the world, which is the point —
      // and therefore it has to be big enough to actually quarry.
      {
        path: [{ u: 0.44, v: 0.42 }, { u: 0.50, v: 0.49 }, { u: 0.56, v: 0.57 }],
        width: 0.058,
        height: 0.54
      }
    ],
    forests: [
      { u: 0.52, v: 0.56, ru: 0.10, rv: 0.09, strength: 1.0 },
      { u: 0.28, v: 0.34, ru: 0.06, rv: 0.055, strength: 0.9 },
      { u: 0.75, v: 0.66, ru: 0.06, rv: 0.06, strength: 0.9 }
    ],
    wetlands: [
      { u: 0.27, v: 0.68, ru: 0.05, rv: 0.045, strength: 1.0 }
    ],
    drylands: [
      { u: 0.72, v: 0.32, ru: 0.06, rv: 0.05, strength: 1.0 }
    ]
  }
};

export const BLUEPRINT_LIST: WorldBlueprint[] = [
  WORLD_BLUEPRINTS.single_continent,
  WORLD_BLUEPRINTS.two_continents,
  WORLD_BLUEPRINTS.archipelago
];

/** Soft-edged elliptical falloff, 1 at the centre and 0 at the rim. */
export function blobField(blob: Blob, u: number, v: number): number {
  const du = (u - blob.u) / blob.ru;
  const dv = (v - blob.v) / blob.rv;
  const d = Math.sqrt(du * du + dv * dv);
  if (d >= 1) return 0;
  // Smoothstep so coastlines curve instead of coming to a point.
  const t = 1 - d;
  return t * t * (3 - 2 * t) * blob.strength;
}

/** How strongly a point sits inside a mountain range, 0..1. */
export function ridgeField(ridge: Ridge, u: number, v: number): number {
  let best = Infinity;
  for (let i = 0; i < ridge.path.length - 1; i++) {
    best = Math.min(best, distanceToSegment(u, v, ridge.path[i], ridge.path[i + 1]));
  }
  if (best >= ridge.width) return 0;
  const t = 1 - best / ridge.width;
  return t * t * (3 - 2 * t);
}

function distanceToSegment(u: number, v: number, a: { u: number; v: number }, b: { u: number; v: number }): number {
  const abu = b.u - a.u;
  const abv = b.v - a.v;
  const lengthSq = abu * abu + abv * abv;
  if (lengthSq === 0) return Math.hypot(u - a.u, v - a.v);
  let t = ((u - a.u) * abu + (v - a.v) * abv) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(u - (a.u + abu * t), v - (a.v + abv * t));
}

/** Sums every blob in a group at a point. */
export function fieldOf(blobs: Blob[], u: number, v: number): number {
  let total = 0;
  for (const blob of blobs) total += blobField(blob, u, v);
  return total;
}
