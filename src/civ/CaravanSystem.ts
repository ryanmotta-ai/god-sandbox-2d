import { GoodId, GOODS } from './Goods';
import { TradeRoute } from './Trade';
import { City } from './City';
import { Kingdom } from './Kingdom';
import { TileMap } from '../world/TileMap';
import { TERRAINS } from '../world/Biomes';
import { ParticleManager } from '../renderer/Particles';
import { SimplePathfinder, ROAD_SPEED_BONUS } from '../ai/Pathfinding';
import { hashString } from '../core/Random';
import { fundUpgrade, upgradeCost } from './RoadEngineering';
import { SpatialHash } from '../core/SpatialHash';

export type CaravanType = 'donkey' | 'camel' | 'cart' | 'wagon' | 'lorry' | 'truck';

export interface OverlandCaravan {
  id: string;
  routeId: string;
  fromKingdomId: string;
  toKingdomId: string;
  fromCityName: string;
  toCityName: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  x: number;
  y: number;
  progress: number; // 0..1
  direction: 1 | -1; // 1: towards end, -1: returning to start
  caravanType: CaravanType;
  cargo: GoodId;
  cargoAmount: number;
  kingdomColor: string;
  speed: number;
  path?: { x: number; y: number }[];
  /** Length of the surveyed route in tiles — what turns ground speed into progress. */
  routeTiles: number;
  /** Unit heading the caravan is actually facing, for picking its sprite. */
  headingX: number;
  headingY: number;
}

/** Road speed multiplier per road level — shared with every mover on the map. */

/**
 * Terrain affinity per pack animal. Camels are desert-bred: unmatched on sand
 * and savanna, sluggish in forest and swamp. Carts follow roads and hate mud.
 * Donkeys are the neutral generalist. Multipliers stack with the road bonus.
 */
const TERRAIN_AFFINITY: Record<CaravanType, Partial<Record<string, number>>> = {
  wagon: {
    grass: 1.1, soil: 1.05, savanna: 1.05, sand: 0.7,
    forest: 0.7, swamp: 0.45, tundra: 0.8, snow: 0.6, mountain: 0.25
  },
  // Anything with an engine lives on the surface under it. A lorry on a good
  // road is transformative; a lorry in a swamp is a very heavy sledge.
  lorry: {
    grass: 0.75, soil: 0.7, savanna: 0.8, sand: 0.5,
    forest: 0.45, swamp: 0.25, tundra: 0.6, snow: 0.4, mountain: 0.2
  },
  truck: {
    grass: 0.6, soil: 0.55, savanna: 0.65, sand: 0.4,
    forest: 0.35, swamp: 0.2, tundra: 0.5, snow: 0.35, mountain: 0.15
  },
  camel: {
    sand: 1.35, savanna: 1.25, soil: 1.05, grass: 0.95,
    forest: 0.75, swamp: 0.7, tundra: 0.65, snow: 0.5, mountain: 0.35
  },
  cart: {
    grass: 1.05, soil: 1.0, savanna: 1.0, sand: 0.8,
    forest: 0.8, swamp: 0.55, tundra: 0.8, snow: 0.6, mountain: 0.3
  },
  donkey: {
    grass: 1.1, soil: 1.05, savanna: 1.05, sand: 0.95, forest: 0.95,
    swamp: 0.75, tundra: 0.85, snow: 0.7, mountain: 0.35
  }
};

/**
 * Ground speed of each kind of traffic, in tiles per tick, before roads and
 * terrain have their say.
 *
 * These used to be a fraction of the *route* covered per tick, which meant a
 * caravan crossed a sixty-tile route and a six-tile route in the same number
 * of ticks — so the long-haul ones tore across the map at ten times the speed
 * of the short-haul ones. Worse, the long routes were the ones given camels,
 * which had the highest number of the three. Speed is now measured in ground
 * covered, so distance costs time, as it should.
 *
 * Scaled against a citizen on foot, who manages MOVE_PER_TICK (0.055) at
 * baseSpeed 1: a loaded pack train is slower than a man walking unburdened.
 * A camel out-walks a donkey and keeps it up all day, which is the entire
 * reason anyone used them for the long hauls.
 */
const CARAVAN_SPEED: Record<CaravanType, number> = {
  donkey: 0.030,
  camel: 0.038,
  cart: 0.034,
  wagon: 0.045,
  lorry: 0.085,
  truck: 0.130
};

/**
 * What is on the road, given what the realm knows how to build.
 *
 * Traffic is the most legible clock a civilisation has: you can tell an age by
 * what is going past. A realm that has only just left the stone age moves
 * goods on the back of an animal; one with wheels and made roads runs carts
 * and then covered wagons; steam puts an engine in front of the load, and the
 * modern era puts the load in a box behind a tractor unit. Distance still
 * decides between the two options an era offers, because it always did — the
 * animal that can keep going is the one that goes far.
 */
export function caravanTypeFor(era: string, distance: number): CaravanType {
  if (era === 'modern') return 'truck';
  if (era === 'industrial') return 'lorry';
  if (era === 'classical') return distance > 14 ? 'wagon' : 'cart';
  if (era === 'iron') return distance > 10 ? 'cart' : 'donkey';
  return distance > 15 ? 'camel' : 'donkey';
}

/** Road traffic thresholds for road evolution */
const ROAD_UPGRADE_THRESHOLDS = {
  // Five footfalls used to be enough to turn grass into a dirt track, so the
  // ground visibly changed the moment anybody was placed on it and a new
  // settlement looked like it was paving the countryside by walking on it.
  dirt: 15,      // traffic >= 15 → Dirt Trail (Level 1)
  stone: 40,     // traffic >= 40 → Stone Road (Level 2)
  imperial: 110  // traffic >= 110 → Imperial Highway (Level 3)
};

/** Eras in order, so the more advanced of two realms can be picked out. */
const ERA_ORDER = ['stone', 'bronze', 'iron', 'classical', 'industrial', 'modern'];

/** Minimum traffic fraction to maintain a road level (below this, road degrades) */
const ROAD_DEGRADE_FRACTION = 0.12;

/** Yearly traffic decay factor */
const ROAD_TRAFFIC_DECAY = 0.92;

export class CaravanSystem {
  public activeCaravans: Map<string, OverlandCaravan> = new Map();
  private readonly renderIndex = new SpatialHash<OverlandCaravan>(16);

  public [Symbol.iterator](): Iterator<OverlandCaravan> { return this.activeCaravans.values(); }
  public queryRect(minX: number, minY: number, maxX: number, maxY: number, result: OverlandCaravan[] = []): OverlandCaravan[] {
    if (this.renderIndex.size !== this.activeCaravans.size) this.renderIndex.rebuild(this.activeCaravans.values());
    return this.renderIndex.queryRect(minX, minY, maxX, maxY, result);
  }

  /**
   * Called once per year to decay road traffic across the entire map.
   * Roads that are no longer used will gradually degrade.
   */
  /**
   * The caravans currently on the road, with their cargo and where they had got to.
   *
   * A convoy three quarters of the way to market is real freight in transit: it
   * has already left the seller's warehouse and has not yet reached the buyer's.
   * Saving without it made every load in the world vanish and every route restart
   * from its origin, so reloading a busy trading age quietly destroyed a year of
   * commerce and reset the traffic that had been wearing the roads in.
   */
  public serialize(): any {
    return { caravans: [...this.activeCaravans.values()] };
  }

  public deserialize(data: any): void {
    this.activeCaravans.clear();
    this.renderIndex.clear();
    for (const caravan of data?.caravans ?? []) {
      this.activeCaravans.set(caravan.id, caravan as OverlandCaravan);
    }
    this.renderIndex.rebuild(this.activeCaravans.values());
  }

  public decayRoadTraffic(tileMap: TileMap): void {
    let topologyChanged = false;
    for (let x = 0; x < tileMap.width; x++) {
      for (let y = 0; y < tileMap.height; y++) {
        const tile = tileMap.grid[x][y];
        if (tile.roadTraffic > 0) {
          tile.roadTraffic = Math.floor(tile.roadTraffic * ROAD_TRAFFIC_DECAY);

          // Degrade road level if traffic drops too low
          if (tile.roadLevel === 3 && tile.roadTraffic < ROAD_UPGRADE_THRESHOLDS.imperial * ROAD_DEGRADE_FRACTION) {
            tile.roadLevel = 2;
            tileMap.markRenderDirty(tile.x, tile.y); tileMap.markRoadNetworkChanged(tile.x, tile.y);
            topologyChanged = true;
          } else if (tile.roadLevel === 2 && tile.roadTraffic < ROAD_UPGRADE_THRESHOLDS.stone * ROAD_DEGRADE_FRACTION) {
            tile.roadLevel = 1;
            tileMap.markRenderDirty(tile.x, tile.y); tileMap.markRoadNetworkChanged(tile.x, tile.y);
            topologyChanged = true;
          } else if (tile.roadLevel === 1 && tile.roadTraffic < ROAD_UPGRADE_THRESHOLDS.dirt * ROAD_DEGRADE_FRACTION) {
            tile.roadLevel = 0;
            tileMap.markRenderDirty(tile.x, tile.y); tileMap.markRoadNetworkChanged(tile.x, tile.y);
            topologyChanged = true;
          }
        }
      }
    }
    void topologyChanged;
  }

  public updateCaravans(
    routes: Map<string, TradeRoute>,
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>,
    tileMap: TileMap,
    particles: ParticleManager,
    currentYear: number
  ): void {
    const activeRouteIds = new Set<string>();

    for (const route of routes.values()) {
      if (route.kind !== 'overland' || !route.active) continue;
      activeRouteIds.add(route.id);

      const fromCity = cities.get(route.fromCityId);
      const toCity = cities.get(route.toCityId);
      if (!fromCity || !toCity) continue;

      const fromKingdom = route.fromKingdomId ? kingdoms.get(route.fromKingdomId) : null;
      const toKingdom = route.toKingdomId ? kingdoms.get(route.toKingdomId) : null;

      // Spawn caravan if not present for this overland route
      if (!this.activeCaravans.has(route.id)) {
        const dist = Math.hypot(toCity.x - fromCity.x, toCity.y - fromCity.y);
        // The more advanced of the two ends sets what runs the route: a realm
        // with lorries does not send donkeys to meet its neighbour's carts.
        const eras = [fromKingdom, toKingdom]
          .map(k => (k ? k.research.currentEra() : 'stone'));
        const era = ERA_ORDER.indexOf(eras[0]) >= ERA_ORDER.indexOf(eras[1]) ? eras[0] : eras[1];
        const caravanType: CaravanType = caravanTypeFor(era, dist);
        const landPath = SimplePathfinder.findPath(fromCity.x, fromCity.y, toCity.x, toCity.y, tileMap, 'land', 3000, hashString(route.id));

        // Don't spawn caravan if no valid land path exists
        if (landPath.length === 0) continue;

        // Progress runs 0..1 over the route, so a ground speed has to be
        // divided by how much ground there is. This is the whole fix: the
        // route's real length, walked at the animal's real pace.
        let routeTiles = 0;
        for (let i = 1; i < landPath.length; i++) {
          routeTiles += Math.hypot(landPath[i].x - landPath[i - 1].x, landPath[i].y - landPath[i - 1].y);
        }
        routeTiles = Math.max(1, routeTiles);
        const baseSpeed = CARAVAN_SPEED[caravanType] / routeTiles;

        const caravan: OverlandCaravan = {
          id: route.id,
          routeId: route.id,
          fromKingdomId: route.fromKingdomId,
          toKingdomId: route.toKingdomId,
          fromCityName: fromCity.name,
          toCityName: toCity.name,
          startX: fromCity.x,
          startY: fromCity.y,
          endX: toCity.x,
          endY: toCity.y,
          x: fromCity.x,
          y: fromCity.y,
          progress: 0,
          direction: 1,
          caravanType,
          cargo: route.good,
          cargoAmount: Math.min(route.volume * 5, Math.floor(route.volume * (3 + (currentYear % 5) * 0.4))),
          kingdomColor: fromKingdom?.color ?? '#fbbf24',
          speed: baseSpeed,
          path: landPath,
          routeTiles,
          headingX: 1,
          headingY: 0
        };
        this.activeCaravans.set(route.id, caravan);
      }

      // Update position along route
      const caravan = this.activeCaravans.get(route.id)!;

      // Road speed bonus: check current tile's effective road level
      const tileX = Math.floor(caravan.x);
      const tileY = Math.floor(caravan.y);
      const currentTile = tileMap.getTile(tileX, tileY);
      const roadMultiplier = ROAD_SPEED_BONUS[currentTile?.roadLevelEffective ?? 0] ?? 1.0;
      // Terrain affinity: a camel eats sand miles but crawls through a swamp.
      const terrainMultiplier = currentTile
        ? (TERRAIN_AFFINITY[caravan.caravanType][currentTile.type] ?? 1.0)
        : 1.0;
      caravan.progress += caravan.speed * caravan.direction * roadMultiplier * terrainMultiplier;

      if (caravan.progress >= 1.0) {
        caravan.progress = 1.0;
        caravan.direction = -1; // Return trip

        // Docking at Destination Market — generate mercantile revenue & tariffs
        this.settleCaravanTrade(caravan, fromKingdom, toKingdom, fromCity, route, tileMap, particles);

      } else if (caravan.progress <= 0.0) {
        caravan.progress = 0.0;
        caravan.direction = 1; // Outward trip again

        // Return trip completion — generate return-trade revenue (bidirectional commerce)
        this.settleCaravanTrade(caravan, toKingdom, fromKingdom, toCity, route, tileMap, particles);
      }

      // Interpolate current world position along land waypoints path
      if (caravan.path && caravan.path.length > 1) {
        const totalSegs = caravan.path.length - 1;
        const rawIdx = Math.max(0, Math.min(totalSegs - 0.001, caravan.progress * totalSegs));
        const pathIdx = Math.floor(rawIdx);
        const subFrac = rawIdx - pathIdx;
        const p1 = caravan.path[pathIdx] ?? caravan.path[0];
        const p2 = caravan.path[Math.min(totalSegs, pathIdx + 1)] ?? p1;
        if (p1 && p2) {
          caravan.x = p1.x + (p2.x - p1.x) * subFrac;
          caravan.y = p1.y + (p2.y - p1.y) * subFrac;
          // Which way it is pointing: along the leg it is on, reversed when it
          // is walking home. Drawing this from the trip direction alone, as
          // the renderer used to, faced every caravan east or west whatever
          // the road was doing.
          const legX = (p2.x - p1.x) * caravan.direction;
          const legY = (p2.y - p1.y) * caravan.direction;
          const len = Math.hypot(legX, legY);
          if (len > 0.0001) {
            caravan.headingX = legX / len;
            caravan.headingY = legY / len;
          }
        }
      } else {
        caravan.x = caravan.startX + (caravan.endX - caravan.startX) * caravan.progress;
        caravan.y = caravan.startY + (caravan.endY - caravan.startY) * caravan.progress;
      }

      // NOTE: road traffic is incremented per completed leg (settleCaravanTrade),
      // not per tick — otherwise the yearly decay can never outpace paving and
      // the road-degradation system becomes inert.
    }

    // Clean up dead caravans
    for (const [id] of this.activeCaravans) {
      if (!activeRouteIds.has(id)) {
        this.activeCaravans.delete(id);
      }
    }
    this.renderIndex.rebuild(this.activeCaravans.values());
  }

  /**
   * Settle trade at either end of a caravan trip.
   * Called both when arriving at destination AND when returning to origin (bidirectional trade).
   * One completed leg also wears the whole surveyed route a little more, evolving roads
   * under the wheels (dirt → stone → imperial) gated by the travelling kingdom's techs.
   */
  private settleCaravanTrade(
    caravan: OverlandCaravan,
    sellerKingdom: Kingdom | null | undefined,
    buyerKingdom: Kingdom | null | undefined,
    sellerCity: City,
    route: TradeRoute,
    tileMap: TileMap,
    particles: ParticleManager
  ): void {
    // Money was settled here once per caravan arrival — hundreds of times a
    // year per route. Revenue now lands once a year in runTradeRoutes, keyed
    // to the goods that actually moved. Arrivals only wear the road and look
    // alive for the player.
    this.paveRouteLeg(caravan, sellerKingdom, sellerCity, tileMap);

    if (route.good) {
      particles.spawnDamageNumber(caravan.x, caravan.y, Math.round(caravan.cargoAmount));
    }
  }

  /**
   * Increment traffic along the caravan's surveyed route and evolve the road
   * level under each tile, gated by the travelling kingdom's techs. Called
   * once per leg (arrival + return), not per tick.
   *
   * Wheels wear a dirt track into existence on their own — that much really is
   * free. Nobody ever wore a stone road into a hillside, though, so every grade
   * above a trail is quarried and paid for out of the settlement that benefits
   * from it, one tile per leg. A busy route through a poor city therefore stays
   * a mud track no matter how much traffic it carries.
   */
  private paveRouteLeg(
    caravan: OverlandCaravan,
    kingdom: Kingdom | null | undefined,
    city: City,
    tileMap: TileMap
  ): void {
    if (!caravan.path || caravan.path.length === 0) return;
    const hasRoadsTech = !!(kingdom?.research.knows('roads') || kingdom?.research.knows('masonry'));
    const hasEngineering = !!kingdom?.research.knows('engineering');
    let upgradesLeft = 1; // one gang, one tile of hard surfacing per leg
    for (const step of caravan.path) {
      const tile = tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
      if (!tile) continue;
      if (!TERRAINS[tile.type].isWalkable || TERRAINS[tile.type].isWater) continue;
      tile.roadTraffic++;
      // War-damaged roads cannot be re-paved by wheels alone — they need a
      // proper repair pass that spends materials out of the city stockpile.
      if (tile.roadDamage > 0) continue;
      if (tile.roadLevel === 0 && tile.roadTraffic >= ROAD_UPGRADE_THRESHOLDS.dirt) {
        tile.roadLevel = 1; // Dirt Trail — worn by wheels alone
        tileMap.markRenderDirty(tile.x, tile.y);
        tileMap.markRoadNetworkChanged(tile.x, tile.y);
      } else if (upgradesLeft > 0 && tile.roadLevel === 1 && tile.roadTraffic >= ROAD_UPGRADE_THRESHOLDS.stone && hasRoadsTech) {
        if (fundUpgrade(city, upgradeCost(tileMap, tile, 2))) {
          tile.roadLevel = 2; // Stone Road — quarried and laid
          tileMap.markRenderDirty(tile.x, tile.y);
          tileMap.markRoadNetworkChanged(tile.x, tile.y);
          upgradesLeft--;
        }
      } else if (upgradesLeft > 0 && tile.roadLevel === 2 && tile.roadTraffic >= ROAD_UPGRADE_THRESHOLDS.imperial && hasEngineering) {
        if (fundUpgrade(city, upgradeCost(tileMap, tile, 3))) {
          tile.roadLevel = 3; // Paved Imperial Highway
          tileMap.markRenderDirty(tile.x, tile.y);
          tileMap.markRoadNetworkChanged(tile.x, tile.y);
          upgradesLeft--;
        }
      }
    }
  }
}
