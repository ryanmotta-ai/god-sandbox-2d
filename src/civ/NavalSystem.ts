import { GoodId, GOODS } from './Goods';
import { TradeRoute } from './Trade';
import { City } from './City';
import { Kingdom } from './Kingdom';
import { TileMap } from '../world/TileMap';
import { TERRAINS, TerrainType } from '../world/Biomes';
import { ParticleManager } from '../renderer/Particles';
import { SimplePathfinder } from '../ai/Pathfinding';
import { hashString } from '../core/Random';
import { events } from '../core/EventBus';
import { chronicle } from './Chronicle';
import { SpatialHash } from '../core/SpatialHash';

export interface ShipTierConfig {
  tier: number;
  name: string;
  icon: string;
  /** Progress per tick (0..1 along the route). Realistic, slow. */
  speed: number;
  /** Cargo capacity. */
  capacity: number;
  /** Refined fuel consumed per tick. 0 = sail / human-powered vessel. */
  fuelPerTick: number;
  minEraOrder: number; // 0: Stone/Bronze, 1: Iron, 2: Classical/Industrial, 3: Modern
  color: string;
  description: string;
}

/**
 * Speeds reflect realistic knots scaled to the in-game tick rate:
 *  - Canoa a remo: ~3 nós -> viagem lenta, várias horas de simulação.
 *  - Caravela a vela: ~6 nós -> dobro da canoa, dependente do vento.
 *  - Galeão a vela/caldeira: ~10 nós -> três vezes a canoa, mais carga.
 *  - Cruzador a vapor: ~22 nós -> salto tecnológico brutal.
 * O progresso/tick é um valor pequeno porque rotas tipicamente têm dezenas de tiles.
 */
export const SHIP_TIERS: ShipTierConfig[] = [
  {
    tier: 1,
    name: 'Canoa de Madeira',
    icon: '🚣',
    speed: 0.0008,
    capacity: 30,
    fuelPerTick: 0,
    minEraOrder: 0,
    color: '#b45309',
    description: 'Embarcação costeira leve de madeira para pesca e trocas locais. Sem combustível.'
  },
  {
    tier: 2,
    name: 'Caravela Mercante',
    icon: '⛵',
    speed: 0.0018,
    capacity: 100,
    fuelPerTick: 0,
    minEraOrder: 1,
    color: '#38bdf8',
    description: 'Navio mercante a velas capaz de cruzar mares abertos entre reinos. Sem combustível.'
  },
  {
    tier: 3,
    name: 'Galeão Imperial',
    icon: '🚢',
    speed: 0.0035,
    capacity: 300,
    fuelPerTick: 0,
    minEraOrder: 2,
    color: '#fbbf24',
    description: 'Grande galeão oceânico de vela e engenharia avançada. Ainda não depende de combustível industrial.'
  },
  {
    tier: 4,
    name: 'Cruzador de Aço',
    icon: '🛳️',
    speed: 0.007,
    capacity: 750,
    fuelPerTick: 0.08,
    minEraOrder: 3,
    color: '#a855f7',
    description: 'Cruzador industrial movido a combustível refinado. Veloz, mas dependente de refinarias e logística.'
  }
];

export interface Ship {
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
  direction: 1 | -1; // 1: going to endX, -1: returning to startX
  tier: number; // 1..4
  cargo: GoodId;
  cargoAmount: number;
  kingdomColor: string;
  path?: { x: number; y: number }[];
}

export class NavalSystem {
  public activeShips: Map<string, Ship> = new Map();
  private readonly renderIndex = new SpatialHash<Ship>(16);

  public [Symbol.iterator](): Iterator<Ship> { return this.activeShips.values(); }
  public queryRect(minX: number, minY: number, maxX: number, maxY: number, result: Ship[] = []): Ship[] {
    if (this.renderIndex.size !== this.activeShips.size) this.renderIndex.rebuild(this.activeShips.values());
    return this.renderIndex.queryRect(minX, minY, maxX, maxY, result);
  }

  /**
   * Determines ship tier based on ACTUAL kingdom technology, not global year.
   * - No sailing tech → Tier 0 (Canoa de Madeira)
   * - sailing researched → caravels
   * - engineering researched → ocean-going galleons
   * - industrialization researched → fuel-burning steel cruisers
   */
  public static getTierForKingdom(kingdom: Kingdom): ShipTierConfig {
    if (kingdom.research.knows('industrialization')) return SHIP_TIERS[3]; // Cruzador de Aço
    if (kingdom.research.knows('engineering')) return SHIP_TIERS[2]; // Galeão Imperial
    if (kingdom.research.knows('sailing')) return SHIP_TIERS[1]; // Caravela Mercante
    return SHIP_TIERS[0]; // Canoa de Madeira
  }


  /** Technology is capped by the physical dockyard available in the city. */
  public static getTierForInfrastructure(kingdom: Kingdom, city: City): ShipTierConfig | null {
    const hasHarbor = city.hasBuilding('harbor') || city.hasBuilding('port');
    if (!hasHarbor) return null;
    const hasDeepPort = city.hasBuilding('port');
    const techTier = NavalSystem.getTierForKingdom(kingdom);
    if (!hasDeepPort && techTier.tier > 2) return SHIP_TIERS[1];
    return techTier;
  }

  /** @deprecated Use getTierForKingdom instead. Kept for backwards compat. */
  public static getTierForEra(eraOrder: number): ShipTierConfig {
    if (eraOrder >= 4) return SHIP_TIERS[3];
    if (eraOrder >= 3) return SHIP_TIERS[2];
    if (eraOrder >= 1) return SHIP_TIERS[1];
    return SHIP_TIERS[0];
  }

  public updateShips(
    routes: Map<string, TradeRoute>,
    cities: Map<string, City>,
    kingdoms: Map<string, Kingdom>,
    tileMap: TileMap,
    particles: ParticleManager,
    currentYear: number
  ): void {
    // 1. Synchronize ships with active maritime trade routes
    const activeRouteIds = new Set<string>();

    for (const route of routes.values()) {
      if (!route.active || route.kind !== 'maritime') continue;
      activeRouteIds.add(route.id);

      const fromCity = cities.get(route.fromCityId);
      const toCity = cities.get(route.toCityId);
      const fromKingdom = kingdoms.get(route.fromKingdomId);
      const toKingdom = kingdoms.get(route.toKingdomId);

      if (!fromCity || !toCity || !fromKingdom || !toKingdom) continue;

      // Determine ship tier based on the exporting kingdom's ACTUAL tech level
      const tierConfig = NavalSystem.getTierForInfrastructure(fromKingdom, fromCity);
      const toTierConfig = NavalSystem.getTierForInfrastructure(toKingdom, toCity);
      if (!tierConfig || !toTierConfig) continue;

      // Ensure a ship exists for this active maritime route
      let ship = this.activeShips.get(route.id);

      if (!ship) {
        // Find coastal/port tiles near cities using BFS spiral
        const startPos = this.findPortWaterTile(fromCity, tileMap);
        const endPos = this.findPortWaterTile(toCity, tileMap);

        if (!startPos || !endPos) continue;

        const seaPath = SimplePathfinder.findPath(startPos.x, startPos.y, endPos.x, endPos.y, tileMap, 'sea', 3000, hashString(route.id));

        if (seaPath.length === 0) continue;
        ship = {
          id: route.id,
          routeId: route.id,
          fromKingdomId: fromKingdom.id,
          toKingdomId: toKingdom.id,
          fromCityName: fromCity.name,
          toCityName: toCity.name,
          startX: startPos.x,
          startY: startPos.y,
          endX: endPos.x,
          endY: endPos.y,
          x: startPos.x,
          y: startPos.y,
          progress: 0,
          direction: 1,
          tier: tierConfig.tier,
          cargo: route.good,
          cargoAmount: Math.min(tierConfig.capacity, route.volume * 5),
          kingdomColor: fromKingdom.color,
          path: seaPath
        };
        this.activeShips.set(route.id, ship);
        events.emit('shipLaunched', { ship, year: currentYear });
      } else {
        // Evolve ship tier as kingdom researches new tech
        if (ship.tier < tierConfig.tier) {
          const oldTier = ship.tier;
          ship.tier = tierConfig.tier;
          ship.cargoAmount = Math.min(tierConfig.capacity, route.volume * 8);

          // Recompute sea path for upgraded ship
          const startPos = this.findPortWaterTile(fromCity, tileMap);
          const endPos = this.findPortWaterTile(toCity, tileMap);
          if (startPos && endPos) {
            const newPath = SimplePathfinder.findPath(startPos.x, startPos.y, endPos.x, endPos.y, tileMap, 'sea', 3000, hashString(route.id));
            if (newPath.length > 0) ship.path = newPath;
          }

          chronicle.log(currentYear, 'kingdom', `O porto de ${fromCity.name} evoluiu sua frota para ${tierConfig.name}! ${tierConfig.icon}`);
        }
      }
    }

    // Remove ships whose maritime routes were closed
    for (const [id] of this.activeShips) {
      if (!activeRouteIds.has(id)) {
        this.activeShips.delete(id);
      }
    }

    // 2. Advance ship movements along water routes
    for (const ship of this.activeShips.values()) {
      const tierConfig = SHIP_TIERS.find(t => t.tier === ship.tier) ?? SHIP_TIERS[0];

      // Fuel check: advanced ships consume refined fuel, making refineries/logistics real.
      if (tierConfig.fuelPerTick > 0) {
        const operatingKingdom = kingdoms.get(ship.fromKingdomId);
        if (operatingKingdom) {
          const fuelOwned = operatingKingdom.treasury.get('fuel');
          if (fuelOwned < tierConfig.fuelPerTick) {
            // Out of fuel — ship is dead in the water this tick
            continue;
          }
          operatingKingdom.treasury.take('fuel', tierConfig.fuelPerTick);
          // Reflect fuel cost in economy.treasury so GDP/inflation account for naval ops.
          const fuelCost = tierConfig.fuelPerTick * (GOODS['fuel']?.basePrice ?? 8);
          operatingKingdom.economy.treasury -= fuelCost;
        }
      }

      // Advance progress and clamp immediately
      ship.progress += tierConfig.speed * ship.direction;
      ship.progress = Math.max(0, Math.min(1, ship.progress));

      // Calculate position along sea waypoints path
      if (ship.path && ship.path.length > 1) {
        const totalSegs = ship.path.length - 1;
        const rawIdx = Math.max(0, Math.min(totalSegs - 0.001, ship.progress * totalSegs));
        const pathIdx = Math.floor(rawIdx);
        const subFrac = rawIdx - pathIdx;
        const p1 = ship.path[pathIdx] ?? ship.path[0];
        const p2 = ship.path[Math.min(totalSegs, pathIdx + 1)] ?? p1;
        if (p1 && p2) {
          ship.x = p1.x + (p2.x - p1.x) * subFrac;
          ship.y = p1.y + (p2.y - p1.y) * subFrac;
        }
      } else {
        ship.x = ship.startX + (ship.endX - ship.startX) * ship.progress;
        ship.y = ship.startY + (ship.endY - ship.startY) * ship.progress;
      }

      // Spawn water wake particles
      if (Math.random() < 0.3) {
        particles.spawnParticle(ship.x, ship.y, '#38bdf8', (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, 0.4);
      }

      // Reached destination port
      if (ship.progress >= 1 && ship.direction === 1) {
        ship.direction = -1;
        // Forward leg: fromKingdom exports to toKingdom
        this.dockShip(ship, ship.toCityName, ship.toKingdomId, ship.fromKingdomId, ship.fromKingdomId, kingdoms, particles);
      } else if (ship.progress <= 0 && ship.direction === -1) {
        ship.direction = 1;
        // Return leg: toKingdom exports its goods back to fromKingdom
        this.dockShip(ship, ship.fromCityName, ship.fromKingdomId, ship.toKingdomId, ship.toKingdomId, kingdoms, particles);
      }
    }
    this.renderIndex.rebuild(this.activeShips.values());
  }

  private dockShip(
    ship: Ship,
    cityName: string,
    dockingKingdomId: string,
    counterpartyKingdomId: string,
    exporterKingdomId: string,
    kingdoms: Map<string, Kingdom>,
    particles: ParticleManager
  ): void {
    const dockingKingdom = kingdoms.get(dockingKingdomId);
    const exporterKingdom = kingdoms.get(exporterKingdomId);
    const counterparty = kingdoms.get(counterpartyKingdomId);
    if (!dockingKingdom) return;

    // Revenue was settled here on every ship arrival — dozens of round trips a
    // year per route — minting gold faster than any treasury could spend it.
    // Payment now lands once a year in runTradeRoutes, keyed to the goods that
    // actually moved. A docking ship is only worth watching.
    particles.spawnDamageNumber(ship.x, ship.y, Math.round(ship.cargoAmount));
  }

  /**
   * Water access is anchored to a real Harbor/Port building. Living near the sea
   * no longer creates ships out of an arbitrary beach tile.
   *
   * The tile is validated with a small flood fill so a pocket of two isolated
   * tiles behind a sandbar does not masquerade as an ocean. Local lakes are
   * skipped in favour of the deep body.
   */
  private findPortWaterTile(city: City, tileMap: TileMap): { x: number; y: number } | null {
    const facilities = [...city.buildings.values()]
      .filter(b => b.type === 'port' || b.type === 'harbor')
      .sort((a, b) => (a.type === 'port' ? -1 : 1));

    // Quick breadth count of reachable water tiles — just enough to tell a lake
    // (≤ 18 tiles) from an ocean or large sea. Ship pathfinding can fail on lakes.
    const waterBodySize = (sx: number, sy: number): number => {
      const visited = new Set<string>();
      const queue: [number, number][] = [[sx, sy]];
      visited.add(`${sx},${sy}`);
      let count = 0;
      while (queue.length > 0 && count < 5000) {
        const [cx, cy] = queue.shift()!;
        const t = tileMap.getTile(cx, cy);
        if (!t || !TERRAINS[t.type].isWater) continue;
        count++;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cx + dx, ny = cy + dy, k = `${nx},${ny}`;
          if (visited.has(k)) continue;
          const nt = tileMap.getTile(nx, ny);
          if (nt && TERRAINS[nt.type].isWater) {
            visited.add(k);
            queue.push([nx, ny]);
          }
        }
      }
      return count;
    };

    for (const facility of facilities) {
      const water = tileMap.getNeighbors(facility.x, facility.y, true)
        .filter(tile => TERRAINS[tile.type].isWater)
        .sort((a, b) => {
          const aDeep = a.type === TerrainType.DEEP_OCEAN ? 1 : 0;
          const bDeep = b.type === TerrainType.DEEP_OCEAN ? 1 : 0;
          return bDeep - aDeep;
        });

      for (const w of water) {
        // pond isolation: reject water pockets < 20 tiles
        if (waterBodySize(w.x, w.y) >= 20) {
          return { x: w.x + 0.5, y: w.y + 0.5 };
        }
      }
      // Fallback: smallest pocket still available — better than nothing.
      if (water.length > 0) {
        return { x: water[0].x + 0.5, y: water[0].y + 0.5 };
      }
    }
    return null;
  }

}
