import { City } from './City';
import { Kingdom } from './Kingdom';
import { Entity } from '../entities/Entity';
import { SPECIES_DEFINITIONS } from '../entities/Species';
import { DiplomacyManager } from './Diplomacy';
import { TileMap } from '../world/TileMap';
import { TERRAINS, TerrainType } from '../world/Biomes';
import { SimplePathfinder } from '../ai/Pathfinding';
import { chronicle } from './Chronicle';
import { events } from '../core/EventBus';
import { rng } from '../core/Random';

/**
 * WAR-V2 — where a war is actually fought.
 *
 * Wars used to be decided at city gates and nowhere else. Every soldier in a
 * realm walked to the nearest enemy settlement, and once two of them stood
 * within seven tiles of it a siege began; when the siege bar filled the city
 * changed hands whole, along with its territory. There was no countryside to
 * take, nothing between the two capitals, and no way for a war to be going
 * badly in the north and well in the south. A realm could be dismantled by one
 * warband that happened to walk past everything else.
 *
 * A front is the line where two realms actually touch, cut into sectors. Each
 * sector is contested by whoever brings soldiers to it, holds a position that
 * moves continuously rather than flipping, and hands over ground a few tiles at
 * a time as it moves. Cities fall because the land around them was taken and
 * the roads home were cut — not because somebody reached the town square.
 */

/** How far apart two enemy settlements can be and still form a shared front. */
const CONTACT_RANGE = 34;
/** Sectors closer together than this are the same stretch of line and get merged. */
const SECTOR_MERGE = 9;
/** How far from a sector's centre a soldier counts as fighting in it. */
export const SECTOR_RADIUS = 9;
/** Soldiers a side needs in a sector before it counts as holding the line at all. */
const SECTOR_MIN_PRESENCE = 2;
/**
 * How close an invading army has to get to an enemy settlement to open a front
 * on it, regardless of how far apart the two realms' own borders are.
 */
const EXPEDITION_RANGE = 14;
/** Ground handed over per year at full dominance, in tiles. */
const MAX_TILES_PER_YEAR = 9;
/**
 * How far `push` can move in a single year.
 *
 * A front should take years to walk across a realm, so a sector cannot swing
 * from one side's control to the other's inside a decade of pushing.
 */
const MAX_PUSH_PER_YEAR = 0.22;
/** Push at or beyond this and the sector's ground is considered overrun. */
const OVERRUN = 0.75;
/** Push a besieger needs behind it before a city's walls can even be worked on. */
export const SIEGE_GATE_PUSH = 0.45;

export type FrontSide = 'a' | 'b';

export interface FrontSector {
  id: string;
  /** Front this belongs to, `${aId}|${bId}` with ids sorted. */
  frontId: string;
  /** The two realms, always sorted so `push` has a stable sign. */
  aId: string;
  bId: string;
  x: number;
  y: number;
  /**
   * Who is winning this stretch, -1..+1. Positive means realm `a` is pushing
   * into `b`; negative the reverse. Zero is the line where they met.
   */
  push: number;
  strengthA: number;
  strengthB: number;
  soldiersA: number;
  soldiersB: number;
  /** 0..1 — how well each side is fed and armed here. Written by WAR-V3. */
  supplyA: number;
  supplyB: number;
  /** Tiles taken from the losing side since the front opened. */
  groundTakenByA: number;
  groundTakenByB: number;
  casualtiesA: number;
  casualtiesB: number;
  lastBattleYear: number | null;
  openedYear: number;
}

export interface FrontsWorld {
  year: number;
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
  entities: Entity[];
  tileMap: TileMap;
  diplomacy: DiplomacyManager;
}

function frontKey(k1: string, k2: string): string {
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

export class WarFrontSystem {
  /** Live sectors, keyed by id. Rebuilt each year but `push` carries over. */
  public sectors: Map<string, FrontSector> = new Map();
  /** Settlements currently cut off from their realm's seat of power. */
  /** Per-realm morale multiplier from wonders, refreshed once a year. */
  private wonderMorale: Map<string, number> = new Map();

  public isolated: Set<string> = new Set();
  /** Sectors a chronicle entry has already been written for. */
  private announced: Set<string> = new Set();

  public reset(): void {
    this.sectors.clear();
    this.isolated.clear();
    this.announced.clear();
  }

  // ============================================================
  // YEARLY TICK
  // ============================================================

  public tickYear(world: FrontsWorld): void {
    this.rebuildSectors(world);
    this.measurePresence(world);
    this.refreshWonderMorale(world);
    // Supply is filled in between measuring and resolving: WAR-V3 runs here.
  }

  /**
   * The Great Colosseum's advertised "+30% military morale, reduces war
   * exhaustion" — which existed as prose in `MONUMENT_TYPES` and nowhere else.
   *
   * Read once a year rather than per sector, because it walks every settlement's
   * buildings and `morale()` is called twice for every stretch of line.
   */
  private refreshWonderMorale(world: FrontsWorld): void {
    this.wonderMorale.clear();
    for (const kingdom of world.kingdoms.values()) {
      const morale = kingdom.wonderEffects(world.cities).morale;
      this.wonderMorale.set(kingdom.id, morale);
      // And the exhaustion side of the promise: games and bread make a long war
      // easier to bear, so weariness bleeds off faster where the arena stands.
      if (morale > 1) kingdom.warWeariness = Math.max(0, kingdom.warWeariness - (morale - 1) * 12);
    }
  }

  /** Second half of the year, after logistics has filled in supply. */
  public resolveYear(world: FrontsWorld): void {
    for (const sector of this.sectors.values()) {
      this.resolveSector(sector, world);
    }
    this.markIsolatedSettlements(world);
  }

  // ============================================================
  // WHERE THE LINE IS
  // ============================================================

  /**
   * A front exists between two realms at war wherever their settlements face
   * each other. Sectors are placed on the midpoints of facing pairs, which puts
   * them on the ground both sides actually care about and spreads them along the
   * whole border instead of stacking them all on one capital.
   *
   * Placing sectors from settlements rather than from a boundary trace is
   * deliberate: territory here is a set of tile keys per city, so walking the
   * true frontier would mean sweeping thousands of tiles a year to find a line
   * that the settlements already imply.
   */
  private rebuildSectors(world: FrontsWorld): void {
    const live = new Set<string>();
    const cities = [...world.cities.values()].filter(c => c.kingdomId);

    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const one = cities[i];
        const other = cities[j];
        const k1 = one.kingdomId!;
        const k2 = other.kingdomId!;
        if (k1 === k2) continue;
        if (!world.diplomacy.isAtWar(k1, k2)) continue;

        const distance = Math.hypot(one.x - other.x, one.y - other.y);
        if (distance > CONTACT_RANGE) continue;

        const mx = (one.x + other.x) / 2;
        const my = (one.y + other.y) / 2;
        const fid = frontKey(k1, k2);

        // One stretch of line, not one per facing pair: a crowded border would
        // otherwise raise a dozen sectors within a few tiles of each other.
        const existing = [...this.sectors.values()].find(
          s => s.frontId === fid && Math.hypot(s.x - mx, s.y - my) <= SECTOR_MERGE
        );
        if (existing) {
          live.add(existing.id);
          continue;
        }

        const [aId, bId] = k1 < k2 ? [k1, k2] : [k2, k1];
        const id = `${fid}@${Math.round(mx)},${Math.round(my)}`;
        if (this.sectors.has(id)) { live.add(id); continue; }

        this.sectors.set(id, {
          id, frontId: fid, aId, bId,
          x: mx, y: my,
          push: 0,
          strengthA: 0, strengthB: 0,
          soldiersA: 0, soldiersB: 0,
          supplyA: 1, supplyB: 1,
          groundTakenByA: 0, groundTakenByB: 0,
          casualtiesA: 0, casualtiesB: 0,
          lastBattleYear: null,
          openedYear: world.year
        });
        live.add(id);
      }
    }

    this.openExpeditionSectors(world, live);

    // A sector whose war ended, or whose facing settlements are gone, closes.
    for (const [id, sector] of [...this.sectors]) {
      if (live.has(id)) continue;
      if (world.diplomacy.isAtWar(sector.aId, sector.bId)) continue;
      this.sectors.delete(id);
      this.announced.delete(id);
    }
  }

  /**
   * Opens a front wherever an invading army is actually standing.
   *
   * Sectors were derived purely from pairs of *settlements* within
   * `CONTACT_RANGE` of each other. Two realms further apart than that formed no
   * front anywhere on the map, no matter what happened between them: an
   * expeditionary force could cross the world, camp outside an enemy capital and
   * still be fighting a war with no line, no supply sectors and nothing for
   * logistics to feed. Overseas and long-range wars were structurally
   * unfightable — the whole front, supply and attrition layer simply did not
   * apply to them.
   *
   * A war is not fought where two capitals happen to be near each other. It is
   * fought where the soldiers are, so a sector opens on any settlement an enemy
   * army has reached — but only for wars that have no line anywhere else.
   *
   * That last restriction is the important one. Where the two realms already face
   * each other, the settlement-derived front is the whole point of this system: a
   * besieger has to win the countryside before the walls are worth attacking, and
   * dropping an extra sector on top of the town he is standing next to would hand
   * him the ground for free and let a lone warband annex a realm by loitering.
   * Expedition sectors exist to give a front to wars that have none at all, not to
   * add a second one to wars that do.
   */
  private openExpeditionSectors(world: FrontsWorld, live: Set<string>): void {
    // Fronts that the facing-settlement pass already gave a line to.
    const established = new Set<string>();
    for (const sector of this.sectors.values()) {
      if (live.has(sector.id)) established.add(sector.frontId);
    }
    // Soldiers bucketed by coarse cell, so this stays one pass over entities plus
    // a small constant lookup per settlement rather than a full cross product.
    const cell = EXPEDITION_RANGE;
    const buckets = new Map<string, Map<string, number>>();
    for (const e of world.entities) {
      if (!e.kingdomId || e.hp <= 0 || e.isChild) continue;
      if (e.profession !== 'soldier' && e.profession !== 'king') continue;
      const key = `${Math.floor(e.x / cell)},${Math.floor(e.y / cell)}`;
      let byRealm = buckets.get(key);
      if (!byRealm) { byRealm = new Map(); buckets.set(key, byRealm); }
      byRealm.set(e.kingdomId, (byRealm.get(e.kingdomId) ?? 0) + 1);
    }
    if (buckets.size === 0) return;

    for (const city of world.cities.values()) {
      const defenderId = city.kingdomId;
      if (!defenderId) continue;

      const cx = Math.floor(city.x / cell);
      const cy = Math.floor(city.y / cell);
      const invaders = new Map<string, number>();
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const byRealm = buckets.get(`${cx + dx},${cy + dy}`);
          if (!byRealm) continue;
          for (const [realmId, count] of byRealm) {
            if (realmId === defenderId) continue;
            if (!world.diplomacy.isAtWar(realmId, defenderId)) continue;
            invaders.set(realmId, (invaders.get(realmId) ?? 0) + count);
          }
        }
      }

      for (const [invaderId, count] of invaders) {
        if (count < SECTOR_MIN_PRESENCE) continue;

        const fid = frontKey(invaderId, defenderId);
        if (established.has(fid)) continue;
        const existing = [...this.sectors.values()].find(
          sector => sector.frontId === fid && Math.hypot(sector.x - city.x, sector.y - city.y) <= SECTOR_MERGE
        );
        if (existing) { live.add(existing.id); continue; }

        const [aId, bId] = invaderId < defenderId ? [invaderId, defenderId] : [defenderId, invaderId];
        const id = `${fid}@${Math.round(city.x)},${Math.round(city.y)}`;
        if (this.sectors.has(id)) { live.add(id); continue; }

        this.sectors.set(id, {
          id, frontId: fid, aId, bId,
          x: city.x, y: city.y,
          push: 0,
          strengthA: 0, strengthB: 0,
          soldiersA: 0, soldiersB: 0,
          supplyA: 1, supplyB: 1,
          groundTakenByA: 0, groundTakenByB: 0,
          casualtiesA: 0, casualtiesB: 0,
          lastBattleYear: null,
          openedYear: world.year
        });
        live.add(id);
      }
    }
  }

  /** Who is standing on each stretch of line this year. */
  private measurePresence(world: FrontsWorld): void {
    for (const sector of this.sectors.values()) {
      sector.strengthA = 0;
      sector.strengthB = 0;
      sector.soldiersA = 0;
      sector.soldiersB = 0;
    }
    if (this.sectors.size === 0) return;

    for (const e of world.entities) {
      if (!e.kingdomId || e.hp <= 0 || e.isChild) continue;
      if (e.profession !== 'soldier' && e.profession !== 'king') continue;
      if (!SPECIES_DEFINITIONS[e.species].isHumanoid) continue;

      for (const sector of this.sectors.values()) {
        const side: FrontSide | null =
          e.kingdomId === sector.aId ? 'a' : e.kingdomId === sector.bId ? 'b' : null;
        if (!side) continue;
        if (Math.hypot(e.x - sector.x, e.y - sector.y) > SECTOR_RADIUS) continue;

        const value = e.damage + e.defense * 0.5 + e.level * 3;
        if (side === 'a') { sector.strengthA += value; sector.soldiersA++; }
        else { sector.strengthB += value; sector.soldiersB++; }
      }
    }
  }

  // ============================================================
  // FIGHTING FOR A STRETCH OF LINE
  // ============================================================

  private resolveSector(sector: FrontSector, world: FrontsWorld): void {
    const a = world.kingdoms.get(sector.aId);
    const b = world.kingdoms.get(sector.bId);
    if (!a || !b) return;

    // Supply is what a paper army is worth in the field. An unsupplied force
    // still holds ground, badly; it does not fight like a fed one.
    const effectiveA = sector.strengthA * (0.35 + 0.65 * sector.supplyA) * this.morale(a);
    const effectiveB = sector.strengthB * (0.35 + 0.65 * sector.supplyB) * this.morale(b);

    const presentA = sector.soldiersA >= SECTOR_MIN_PRESENCE;
    const presentB = sector.soldiersB >= SECTOR_MIN_PRESENCE;

    if (!presentA && !presentB) {
      // Nobody is holding this stretch. A line nobody mans settles back toward
      // where the two realms actually meet.
      sector.push *= 0.88;
      return;
    }

    if (presentA && presentB) this.fightBattle(sector, world, effectiveA, effectiveB);

    // An unopposed advance is faster than a contested one, but it is not free:
    // ground still has to be walked and held.
    const total = effectiveA + effectiveB;
    const bias = total > 0 ? (effectiveA - effectiveB) / total : 0;
    const move = bias * MAX_PUSH_PER_YEAR * (presentA && presentB ? 0.7 : 1);
    sector.push = Math.max(-1, Math.min(1, sector.push + move));

    this.occupyGround(sector, world);
    this.announceOverrun(sector, world);
  }

  private morale(kingdom: Kingdom): number {
    return Math.max(0.5, 1 - kingdom.warWeariness / 220) * (this.wonderMorale.get(kingdom.id) ?? 1);
  }

  /**
   * A battle on the line, rather than at a gate.
   *
   * Both sides lose people, the weaker side proportionally more. This is where
   * a war's casualties should come from — an army that marches across a border
   * and meets another army should be ground down on the way, not arrive intact
   * at a capital.
   */
  private fightBattle(sector: FrontSector, world: FrontsWorld, effectiveA: number, effectiveB: number): void {
    sector.lastBattleYear = world.year;

    const ratio = effectiveA / Math.max(1, effectiveB);
    // The losing side takes the heavier share; nobody walks away clean.
    const lossA = 0.06 + Math.max(0, 1 - ratio) * 0.1;
    const lossB = 0.06 + Math.max(0, ratio - 1) * 0.1;

    const fell = { a: 0, b: 0 };
    for (const e of world.entities) {
      if (e.hp <= 0 || !e.kingdomId) continue;
      if (e.profession !== 'soldier' && e.profession !== 'king') continue;
      const side: FrontSide | null =
        e.kingdomId === sector.aId ? 'a' : e.kingdomId === sector.bId ? 'b' : null;
      if (!side) continue;
      if (Math.hypot(e.x - sector.x, e.y - sector.y) > SECTOR_RADIUS) continue;

      const share = side === 'a' ? lossA : lossB;
      // A king is not casually killed off in a border skirmish.
      const exposure = e.profession === 'king' ? share * 0.3 : share;
      if (!rng.chance(exposure)) continue;

      e.hp -= Math.max(12, e.maxHp * rng.range(0.35, 0.9));
      if (e.hp <= 0) {
        fell[side]++;
        e.kills = e.kills;
      }
    }

    sector.casualtiesA += fell.a;
    sector.casualtiesB += fell.b;

    const war = world.diplomacy.activeWars.get(
      sector.aId < sector.bId ? `${sector.aId}:${sector.bId}` : `${sector.bId}:${sector.aId}`
    );
    if (war) {
      war.battles++;
      war.attackerKills += war.attacker === sector.aId ? fell.b : fell.a;
      war.defenderKills += war.defender === sector.aId ? fell.b : fell.a;
    }

    const a = world.kingdoms.get(sector.aId);
    const b = world.kingdoms.get(sector.bId);
    if (a) a.warWeariness = Math.min(100, a.warWeariness + 2 + fell.a);
    if (b) b.warWeariness = Math.min(100, b.warWeariness + 2 + fell.b);

    if (fell.a + fell.b > 0) {
      events.emit('frontBattle', {
        sectorId: sector.id, x: sector.x, y: sector.y,
        year: world.year, fellA: fell.a, fellB: fell.b
      });
    }
  }

  // ============================================================
  // TAKING GROUND
  // ============================================================

  /**
   * The advancing side takes a few tiles of the loser's land, nearest the
   * sector first.
   *
   * This is the whole point of a front: occupation is gradual and reversible,
   * and a realm loses its countryside before it loses its towns. Tiles pass to
   * the winner's closest settlement so the new border stays coherent, and the
   * losing city keeps its buildings — this is ground changing hands, not a
   * settlement falling.
   */
  private occupyGround(sector: FrontSector, world: FrontsWorld): void {
    const magnitude = Math.abs(sector.push);
    if (magnitude < 0.12) return;

    const winnerId = sector.push > 0 ? sector.aId : sector.bId;
    const loserId = sector.push > 0 ? sector.bId : sector.aId;
    const budget = Math.max(1, Math.round(MAX_TILES_PER_YEAR * magnitude));

    const claimant = this.nearestCityOf(winnerId, sector.x, sector.y, world);
    if (!claimant) return;

    let taken = 0;
    // Sweep outward from the sector so the border moves as a line rather than
    // appearing in patches behind it.
    for (let radius = 1; radius <= SECTOR_RADIUS && taken < budget; radius++) {
      for (let dx = -radius; dx <= radius && taken < budget; dx++) {
        for (let dy = -radius; dy <= radius && taken < budget; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = Math.round(sector.x + dx);
          const y = Math.round(sector.y + dy);
          const tile = world.tileMap.getTile(x, y);
          if (!tile || tile.kingdomId !== loserId) continue;

          const terrain = TERRAINS[tile.type];
          if (terrain.isWater || !terrain.isWalkable || tile.type === TerrainType.MOUNTAIN) continue;
          // A settlement's own ground is taken by taking the settlement.
          if (tile.buildingId) continue;

          const previousOwner = tile.cityId ? world.cities.get(tile.cityId) : null;
          previousOwner?.territory.delete(`${x},${y}`);

          tile.kingdomId = winnerId;
          tile.cityId = claimant.id;
          claimant.territory.add(`${x},${y}`);
          world.tileMap.markRenderDirty(x, y);
          taken++;
        }
      }
    }

    if (taken > 0) {
      if (winnerId === sector.aId) sector.groundTakenByA += taken;
      else sector.groundTakenByB += taken;
    }
  }

  private nearestCityOf(kingdomId: string, x: number, y: number, world: FrontsWorld): City | null {
    let best: City | null = null;
    let bestDistance = Infinity;
    for (const city of world.cities.values()) {
      if (city.kingdomId !== kingdomId) continue;
      const d = Math.hypot(city.x - x, city.y - y);
      if (d < bestDistance) { bestDistance = d; best = city; }
    }
    return best;
  }

  private announceOverrun(sector: FrontSector, world: FrontsWorld): void {
    if (Math.abs(sector.push) < OVERRUN || this.announced.has(sector.id)) return;
    this.announced.add(sector.id);

    const winner = world.kingdoms.get(sector.push > 0 ? sector.aId : sector.bId);
    const loser = world.kingdoms.get(sector.push > 0 ? sector.bId : sector.aId);
    if (!winner || !loser) return;

    chronicle.log(
      world.year,
      'war',
      `${winner.name} rompeu as linhas de ${loser.name} e domina a frente.`,
      {
        title: `Frente rompida`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'kingdom', id: winner.id, name: winner.name },
          { kind: 'kingdom', id: loser.id, name: loser.name }
        ],
        tags: ['war', 'front', 'breakthrough'],
        causes: ['Um setor da frente foi dominado após anos de pressão militar.'],
        consequences: [`O território de ${loser.name} passou a ser ocupado gradualmente neste setor.`],
        data: {
          push: Number(sector.push.toFixed(2)),
          groundTaken: sector.push > 0 ? sector.groundTakenByA : sector.groundTakenByB
        }
      }
    );
  }

  // ============================================================
  // BEING CUT OFF
  // ============================================================

  /**
   * A settlement is isolated when it can no longer reach its own seat of power
   * over friendly ground.
   *
   * This is what makes an advance matter before a single wall has fallen. A city
   * whose corridor home has been overrun stops receiving what the realm sends
   * it, and its garrison fights on what it already has.
   */
  private markIsolatedSettlements(world: FrontsWorld): void {
    const before = new Set(this.isolated);
    this.isolated.clear();

    for (const kingdom of world.kingdoms.values()) {
      const seat = kingdom.capitalCityId ? world.cities.get(kingdom.capitalCityId) : null;
      if (!seat) continue;
      const atWar = world.diplomacy.getWarsFor(kingdom.id).length > 0;
      if (!atWar) continue;

      for (const cityId of kingdom.cityIds) {
        const city = world.cities.get(cityId);
        if (!city || city.id === seat.id) continue;

        if (this.corridorHome(city, seat, kingdom, world)) continue;
        this.isolated.add(city.id);

        if (!before.has(city.id)) {
          chronicle.log(
            world.year,
            'war',
            `${city.name} ficou isolada do resto de ${kingdom.name}.`,
            {
              title: `${city.name} isolada`,
              importance: 'major',
              scope: 'international',
              refs: [
                { kind: 'city', id: city.id, name: city.name },
                { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
              ],
              tags: ['war', 'isolation', 'supply'],
              causes: ['O corredor terrestre até a capital foi ocupado pelo inimigo.'],
              consequences: [`${city.name} não recebe mais suprimentos do reino.`]
            }
          );
          events.emit('citySupplyCut', { city, kingdom, year: world.year });
        }
      }
    }
  }

  /**
   * Whether a land corridor home still runs over ground this realm holds.
   *
   * The path itself is the ordinary land route; what matters is who owns the
   * tiles it crosses. Neutral ground is passable — an army has to actually be
   * astride the corridor to cut it, not merely exist somewhere nearby.
   */
  private corridorHome(city: City, seat: City, kingdom: Kingdom, world: FrontsWorld): boolean {
    const path = SimplePathfinder.findPath(city.x, city.y, seat.x, seat.y, world.tileMap, 'land');
    if (!path || path.length === 0) return false;

    for (const step of path) {
      const tile = world.tileMap.getTile(step.x, step.y);
      if (!tile?.kingdomId || tile.kingdomId === kingdom.id) continue;
      if (world.diplomacy.isAtWar(tile.kingdomId, kingdom.id)) return false;
    }
    return true;
  }

  // ============================================================
  // WHAT THE REST OF THE GAME ASKS
  // ============================================================

  /** The stretch of line nearest a point, for a realm that is fighting on it. */
  public sectorFor(kingdomId: string, x: number, y: number): FrontSector | null {
    let best: FrontSector | null = null;
    let bestDistance = Infinity;
    for (const sector of this.sectors.values()) {
      if (sector.aId !== kingdomId && sector.bId !== kingdomId) continue;
      const d = Math.hypot(sector.x - x, sector.y - y);
      if (d < bestDistance) { bestDistance = d; best = sector; }
    }
    return best;
  }

  /** Which side of a sector a realm is, or null if it is not in this war. */
  public sideOf(sector: FrontSector, kingdomId: string): FrontSide | null {
    if (sector.aId === kingdomId) return 'a';
    if (sector.bId === kingdomId) return 'b';
    return null;
  }

  /** How far a realm has pushed on a sector, from its own point of view. */
  public pushFor(sector: FrontSector, kingdomId: string): number {
    const side = this.sideOf(sector, kingdomId);
    if (!side) return 0;
    return side === 'a' ? sector.push : -sector.push;
  }

  /**
   * How much the ground around a settlement has been taken by a given realm.
   *
   * This is the gate on siege progress: a besieger has to hold the countryside
   * before the walls are worth attacking, which is exactly what stops a lone
   * warband from annexing a realm it walked into.
   */
  public siegePressure(city: City, besiegerId: string): number {
    let best = 0;
    for (const sector of this.sectors.values()) {
      if (this.sideOf(sector, besiegerId) === null) continue;
      if (Math.hypot(sector.x - city.x, sector.y - city.y) > SECTOR_RADIUS * 1.6) continue;
      best = Math.max(best, this.pushFor(sector, besiegerId));
    }
    return best;
  }

  /**
   * Whether a front exists around this settlement at all for the given realm.
   *
   * `siegePressure` returns zero both when a sector is there and holds no
   * ground and when there is no sector within reach, and the siege gate could
   * not tell those apart. Two realms further apart than CONTACT_RANGE form no
   * front anywhere, so a besieger that marched across the map met a gate that
   * could never open and sat outside the walls for ever at 35% progress. The
   * front should govern sieges where it has something to say and stand aside
   * where it does not.
   */
  public coversCity(city: City, kingdomId: string): boolean {
    for (const sector of this.sectors.values()) {
      if (this.sideOf(sector, kingdomId) === null) continue;
      if (Math.hypot(sector.x - city.x, sector.y - city.y) > SECTOR_RADIUS * 1.6) continue;
      return true;
    }
    return false;
  }

  public isIsolated(cityId: string): boolean {
    return this.isolated.has(cityId);
  }

  /**
   * How well fed a realm's troops are around a given settlement, 0..1.
   *
   * Logistics computes `supplyA`/`supplyB` for every sector and the field battle
   * already scales strength by it — but siege resolution never read it at all, so
   * a besieging army at the end of a severed line pressed the walls exactly as
   * hard as one with a working railhead behind it. Starving out a besieger by
   * cutting his supply was impossible; the only thing supply could do was thin
   * the men standing in a sector.
   *
   * Returns 1 where no front has an opinion, so a siege beyond the reach of any
   * sector is judged on its own merits rather than penalised for the silence.
   */
  public supplyNear(city: City, kingdomId: string): number {
    let best: number | null = null;
    for (const sector of this.sectors.values()) {
      const side = this.sideOf(sector, kingdomId);
      if (side === null) continue;
      if (Math.hypot(sector.x - city.x, sector.y - city.y) > SECTOR_RADIUS * 1.6) continue;
      const supply = side === 'a' ? sector.supplyA : sector.supplyB;
      best = best === null ? supply : Math.max(best, supply);
    }
    return best ?? 1;
  }

  // ============================================================
  // PERSISTENCE
  // ============================================================

  public serialize(): any {
    return {
      schema: 1,
      sectors: [...this.sectors.values()],
      isolated: [...this.isolated],
      announced: [...this.announced]
    };
  }

  public deserialize(data: any): void {
    this.reset();
    if (!data) return;
    for (const s of data.sectors ?? []) {
      if (!s?.id) continue;
      this.sectors.set(s.id, {
        supplyA: 1, supplyB: 1,
        groundTakenByA: 0, groundTakenByB: 0,
        casualtiesA: 0, casualtiesB: 0,
        lastBattleYear: null,
        ...s
      });
    }
    for (const id of data.isolated ?? []) this.isolated.add(id);
    for (const id of data.announced ?? []) this.announced.add(id);
  }
}
