import { TileMap } from '../world/TileMap';
import { Tile } from '../world/Tile';
import { TerrainType } from '../world/Biomes';
import { crossingSpan, gradePenalty, groundworkFactor, roadGrade } from '../world/RoadTerrain';
import { SimplePathfinder } from '../ai/Pathfinding';
import { City } from './City';

/**
 * The works office: what a surveyed road actually costs to build.
 *
 * Nothing here is decorative. A road is paid for out of the settlement's
 * stockpile, tile by tile, in the order the surveyor pegged it out — so a city
 * that runs out of stone halfway ends up with a paved road that becomes a dirt
 * track, which is exactly what happens on the ground. And a river is the wall
 * it usually stops at: a single stone span costs more than most buildings, so
 * a poor settlement leaves its road at the bank and waits for a better year.
 */

/** Materials a stretch of roadworks consumes. */
export interface RoadBill {
  stone: number;
  wood: number;
}

/** Surfacing per tile, per grade, on level ground with a sound subsoil. */
const SURFACE_MATERIALS: Record<number, RoadBill> = {
  1: { stone: 0.0, wood: 0.35 }, // dirt trail: grubbing and a few corduroy logs
  2: { stone: 1.6, wood: 0.50 }, // stone road: rubble base, dressed setts
  3: { stone: 3.0, wood: 0.80 } // imperial way: deep bed, kerbs, drainage
};

/**
 * A span, per tile of water, per grade. These are the numbers that make a
 * bridge a political decision: a single stone arch runs to more stone than a
 * granary, and a three-tile crossing needs piers deep enough to stand in a
 * current, which is why the multiplier grows with the span.
 */
const SPAN_MATERIALS: Record<number, RoadBill> = {
  1: { stone: 2, wood: 14 }, // timber trestle
  2: { stone: 22, wood: 6 }, // stone arch
  3: { stone: 34, wood: 8 } // imperial viaduct
};

/**
 * A crossing this wide stops being infrastructure and becomes a public work.
 * At the stone grade it costs upward of two hundred stone — more than any
 * building in the game — so a realm builds at most a handful of them ever, and
 * the one it does build is worth a name and a ceremony.
 */
export const GREAT_SPAN = 5;

/** Deeper water and longer reaches need bigger piers, not just more of them. */
function spanDifficulty(span: number): number {
  return 1 + 0.25 * Math.max(0, span - 1);
}

const NO_COST: RoadBill = { stone: 0, wood: 0 };

/** Whether a tile on a road is carried on a bridge rather than laid on ground. */
export function isSpanTile(tile: Tile): boolean {
  return tile.type === TerrainType.SHALLOW_WATER || tile.type === TerrainType.DEEP_OCEAN;
}

/**
 * Materials one tile of road costs, given the tile the works arrive from.
 * Water is priced as a span; land is priced as earthwork, multiplied by the
 * gradient it has to be cut into and the subsoil it has to be founded on.
 */
export function tileRoadCost(
  tileMap: TileMap,
  tile: Tile,
  level: number,
  from: Tile | null
): RoadBill {
  const grade = Math.max(1, Math.min(3, Math.round(level)));
  if (isSpanTile(tile)) {
    const dx = from ? Math.sign(tile.x - from.x) : 0;
    const dy = from ? Math.sign(tile.y - from.y) : 0;
    const span = crossingSpan(tileMap, tile.x, tile.y, dx, dy);
    const difficulty = spanDifficulty(span);
    const base = SPAN_MATERIALS[grade];
    return { stone: base.stone * difficulty, wood: base.wood * difficulty };
  }
  const base = SURFACE_MATERIALS[grade];
  const run = from && from.x !== tile.x && from.y !== tile.y ? 1.414 : 1;
  const relief = from ? gradePenalty(roadGrade(from, tile, run)) : 1;
  // Earthwork scales with the cutting; the surface course does not.
  const earth = groundworkFactor(tile.type) * (1 + (relief - 1) * 0.45);
  return { stone: base.stone * earth, wood: base.wood * earth };
}

/** A pegged-out route with its full bill of materials. */
export interface RoadSurvey {
  path: { x: number; y: number }[];
  /** Everything the whole route would cost at the surveyed grade. */
  bill: RoadBill;
  /** Water tiles that have to be carried on a structure. */
  spanTiles: number;
  /** The part of `bill` that is bridgework alone. */
  spanBill: RoadBill;
  /** Steepest gradient on the route, in percent. */
  maxGrade: number;
}

const EMPTY_SURVEY: RoadSurvey = {
  path: [],
  bill: { ...NO_COST },
  spanTiles: 0,
  spanBill: { ...NO_COST },
  maxGrade: 0
};

/**
 * Pegs out a route and prices it. The pathfinder already refuses cliffs and
 * prefers contours and narrows, so what comes back here is a line an engineer
 * would recognise: valley floors, gentle saddles, rivers taken square at the
 * narrowest point.
 */
export function surveyRoad(
  tileMap: TileMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  level: number,
  maxNodes?: number
): RoadSurvey {
  // Contouring around relief means the search fans out sideways far more than
  // a straight-line survey would, so the node budget grows with the route.
  const reach = Math.hypot(toX - fromX, toY - fromY);
  const budget = maxNodes ?? Math.min(20000, Math.max(2000, Math.round(reach * reach * 6)));
  const path = SimplePathfinder.findPath(fromX, fromY, toX, toY, tileMap, 'road', budget);
  if (path.length === 0) return { ...EMPTY_SURVEY, path: [] };

  const survey: RoadSurvey = {
    path,
    bill: { stone: 0, wood: 0 },
    spanTiles: 0,
    spanBill: { stone: 0, wood: 0 },
    maxGrade: 0
  };
  let previous: Tile | null = null;
  for (const step of path) {
    const tile = tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
    if (!tile) continue;
    const cost = tileRoadCost(tileMap, tile, level, previous);
    survey.bill.stone += cost.stone;
    survey.bill.wood += cost.wood;
    if (isSpanTile(tile)) {
      survey.spanTiles++;
      survey.spanBill.stone += cost.stone;
      survey.spanBill.wood += cost.wood;
    } else if (previous && !isSpanTile(previous)) {
      const run = previous.x !== tile.x && previous.y !== tile.y ? 1.414 : 1;
      survey.maxGrade = Math.max(survey.maxGrade, roadGrade(previous, tile, run));
    }
    previous = tile;
  }
  return survey;
}

/** What the gangs managed to finish before the stockpile ran dry. */
export interface RoadWorks {
  /** Tiles that ended the year carrying a road at all. */
  tilesLaid: number;
  /** Tiles that reached the intended grade. */
  tilesAtGrade: number;
  /** Spans actually completed. */
  spansBuilt: number;
  /**
   * Crossings finished this year that are large enough to be public works.
   * The engine turns each of these into a named bridge and an inauguration.
   */
  greatCrossings: { tiles: Tile[]; span: number }[];
  /** Materials genuinely taken out of the stockpile. */
  spent: RoadBill;
  /** Why the works stopped where they did. */
  stoppedBy: 'complete' | 'materials' | 'span';
  /** Where the works halted, when a span was left unbuilt. */
  haltedAt: { x: number; y: number } | null;
}

/** Materials a city can actually put into roadworks this year. */
function canAfford(city: City, cost: RoadBill): boolean {
  return city.stock.get('stone') >= cost.stone && city.stock.get('wood') >= cost.wood;
}

function pay(city: City, cost: RoadBill): void {
  if (cost.stone > 0) {
    const taken = city.stock.take('stone', cost.stone);
    if (taken > 0) city.ledger.recordConsumed('stone', taken);
  }
  if (cost.wood > 0) {
    const taken = city.stock.take('wood', cost.wood);
    if (taken > 0) city.ledger.recordConsumed('wood', taken);
  }
}

/**
 * Builds a surveyed road outward from its origin, paying for every tile as the
 * works reach it.
 *
 * Three things can happen at a tile, and all three happen on real projects:
 * the city pays for the intended grade; the city cannot afford paving and the
 * gangs cut a dirt track instead; or the next tile is water and the treasury
 * will not carry the span, at which point the road simply stops at the bank.
 * A road that stops at a river is not a bug — it is the single most common
 * shape of unfinished infrastructure in history.
 */
export function layRoad(
  city: City,
  tileMap: TileMap,
  survey: RoadSurvey,
  level: number
): RoadWorks {
  const works: RoadWorks = {
    tilesLaid: 0,
    tilesAtGrade: 0,
    spansBuilt: 0,
    greatCrossings: [],
    spent: { stone: 0, wood: 0 },
    stoppedBy: 'complete',
    haltedAt: null
  };
  if (survey.path.length === 0) return works;

  let previous: Tile | null = null;
  for (let i = 0; i < survey.path.length; i++) {
    const step = survey.path[i];
    const tile = tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
    if (!tile) continue;

    if (isSpanTile(tile)) {
      // A crossing is priced and built as one structure. Half a bridge is not
      // half a road — it is a pier standing in a river carrying nothing — so
      // the whole run of water on the route is funded together or not at all.
      const crossing: Tile[] = [];
      const cost: RoadBill = { stone: 0, wood: 0 };
      let ahead = previous;
      let j = i;
      while (j < survey.path.length) {
        const next = tileMap.getTile(Math.floor(survey.path[j].x), Math.floor(survey.path[j].y));
        if (!next || !isSpanTile(next)) break;
        if (next.roadLevel < level) {
          const c = tileRoadCost(tileMap, next, level, ahead);
          cost.stone += c.stone;
          cost.wood += c.wood;
        }
        crossing.push(next);
        ahead = next;
        j++;
      }
      if (!canAfford(city, cost)) {
        works.stoppedBy = 'span';
        works.haltedAt = { x: tile.x, y: tile.y };
        return works;
      }
      pay(city, cost);
      works.spent.stone += cost.stone;
      works.spent.wood += cost.wood;
      let raised = 0;
      for (const deck of crossing) {
        if (deck.roadLevel < level) {
          deck.roadLevel = level;
          tileMap.markRenderDirty(deck.x, deck.y);
          tileMap.markRoadNetworkChanged(deck.x, deck.y);
          works.spansBuilt++;
          raised++;
        }
        works.tilesLaid++;
        works.tilesAtGrade++;
      }
      // A long crossing at a hard grade is the largest thing a settlement ever
      // builds. Only report it when this year's works actually raised it —
      // walking over a bridge somebody else already built is not an opening.
      if (raised > 0 && level >= 2 && crossing.length >= GREAT_SPAN) {
        works.greatCrossings.push({ tiles: crossing, span: crossing.length });
      }
      previous = crossing[crossing.length - 1] ?? previous;
      i = j - 1;
      continue;
    }

    // Already at or above the intended grade: the works walk over it for free.
    if (tile.roadLevel >= level) {
      previous = tile;
      works.tilesLaid++;
      works.tilesAtGrade++;
      continue;
    }

    const full = tileRoadCost(tileMap, tile, level, previous);
    if (canAfford(city, full)) {
      pay(city, full);
      works.spent.stone += full.stone;
      works.spent.wood += full.wood;
      tile.roadLevel = level;
      tileMap.markRenderDirty(tile.x, tile.y);
      tileMap.markRoadNetworkChanged(tile.x, tile.y);
      works.tilesLaid++;
      works.tilesAtGrade++;
      previous = tile;
      continue;
    }

    // Cannot afford the surface course — cut a dirt track and carry on.
    const trail = tileRoadCost(tileMap, tile, 1, previous);
    if (!canAfford(city, trail)) {
      works.stoppedBy = 'materials';
      works.haltedAt = { x: tile.x, y: tile.y };
      return works;
    }
    pay(city, trail);
    works.spent.stone += trail.stone;
    works.spent.wood += trail.wood;
    if (tile.roadLevel < 1) {
      tile.roadLevel = 1;
      tileMap.markRenderDirty(tile.x, tile.y);
      tileMap.markRoadNetworkChanged(tile.x, tile.y);
    }
    works.tilesLaid++;
    previous = tile;
  }
  return works;
}
