import { City } from './City';
import { Kingdom } from './Kingdom';
import { Entity } from '../entities/Entity';
import { SPECIES_DEFINITIONS } from '../entities/Species';
import { GOVERNMENTS } from './Government';
import { DiplomacyManager } from './Diplomacy';
import { TileMap } from '../world/TileMap';
import { chronicle } from './Chronicle';
import { events } from '../core/EventBus';
import { rng } from '../core/Random';
import { ALL_GOODS } from './Goods';
import { damageRoadsAround, damageRailAround, damagePrimaryRoads, damageStrategicBuildings } from './Infrastructure';

/**
 * How wars actually change the map.
 *
 * Declaring war is diplomacy; taking a city is warfare. Soldiers march on enemy
 * settlements, lay siege, and when the walls give way the settlement changes
 * hands along with its territory, buildings and surviving population.
 *
 * Everything here runs once per simulated year, alongside the civilization tick.
 */

/** How close an army must be to a settlement to besiege it. */
export const SIEGE_RADIUS = 7;
/** Attacker strength needed, relative to defence, before a siege makes progress. */
const SIEGE_THRESHOLD = 1.0;
/** Years of unbroken siege after which even a strong city starves out. */
const STARVATION_YEARS = 8;

export interface WarfareWorld {
  year: number;
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
  entities: Entity[];
  tileMap: TileMap;
  diplomacy: DiplomacyManager;
}

interface SiegeAssessment {
  besieger: Kingdom;
  attackStrength: number;
  defenceStrength: number;
}

export class WarfareSystem {
  /**
   * Resolves every siege in the world for this year.
   * Cities not under threat slowly recover; cities under pressure fall.
   */
  /** Wars already given a peace settlement, so a treaty is only imposed once. */
  private settledWars: Set<string> = new Set();

  public reset(): void {
    this.settledWars.clear();
  }

  public tickYear(world: WarfareWorld): void {
    this.settleConcludedWars(world);

    // Group soldiers by kingdom and position once, rather than scanning per city.
    const armies = this.gatherArmies(world);

    for (const city of [...world.cities.values()]) {
      const owner = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
      if (!owner) continue;

      const assessment = this.assessSiege(city, owner, armies, world);

      if (!assessment) {
        this.relieveSiege(city, world);
        continue;
      }

      this.pressSiege(city, owner, assessment, world);
    }
  }

  // ============================================================
  // ARMIES
  // ============================================================

  /** Every fighting entity in the world, indexed by the realm it serves. */
  private gatherArmies(world: WarfareWorld): Map<string, Entity[]> {
    const armies = new Map<string, Entity[]>();

    for (const entity of world.entities) {
      if (!entity.kingdomId || entity.hp <= 0) continue;
      if (!SPECIES_DEFINITIONS[entity.species].isHumanoid) continue;
      // Children and non-combatants don't besiege cities.
      if (entity.isChild) continue;
      if (entity.profession !== 'soldier' && entity.profession !== 'king') continue;

      let army = armies.get(entity.kingdomId);
      if (!army) {
        army = [];
        armies.set(entity.kingdomId, army);
      }
      army.push(entity);
    }

    return armies;
  }

  /** Combat value of a group of soldiers. */
  private armyStrength(soldiers: Entity[], kingdom: Kingdom): number {
    let raw = 0;
    for (const soldier of soldiers) {
      raw += soldier.damage + soldier.defense * 0.5 + soldier.level * 3;
    }
    const techMilitary = kingdom.research.modifiers().military;
    const govMilitary = GOVERNMENTS[kingdom.government].military;
    // An exhausted realm fights worse than its paper strength suggests.
    const morale = Math.max(0.5, 1 - kingdom.warWeariness / 220);
    return raw * techMilitary * govMilitary * morale;
  }

  // ============================================================
  // SIEGE
  // ============================================================

  /** Finds the strongest hostile army in range, if any is actually besieging. */
  private assessSiege(
    city: City,
    owner: Kingdom,
    armies: Map<string, Entity[]>,
    world: WarfareWorld
  ): SiegeAssessment | null {
    let best: SiegeAssessment | null = null;

    for (const [kingdomId, soldiers] of armies) {
      if (kingdomId === owner.id) continue;
      if (!world.diplomacy.isAtWar(kingdomId, owner.id)) continue;

      const attacker = world.kingdoms.get(kingdomId);
      if (!attacker) continue;

      const besiegers = soldiers.filter(
        s => Math.hypot(s.x - city.x, s.y - city.y) <= SIEGE_RADIUS
      );
      if (besiegers.length < 2) continue;

      const attackStrength = this.armyStrength(besiegers, attacker);
      if (!best || attackStrength > best.attackStrength) {
        best = { besieger: attacker, attackStrength, defenceStrength: 0 };
      }
    }

    if (!best) return null;

    best.defenceStrength = this.defenceStrength(city, owner, armies);
    return best;
  }

  /** Walls, garrison and the realm's military technology. */
  private defenceStrength(city: City, owner: Kingdom, armies: Map<string, Entity[]>): number {
    const garrison = (armies.get(owner.id) ?? []).filter(
      s => Math.hypot(s.x - city.x, s.y - city.y) <= SIEGE_RADIUS
    );

    // Even an ungarrisoned settlement resists a little — militia and walls.
    const militia = city.population * 1.6;
    const garrisonStrength = this.armyStrength(garrison, owner);

    return (garrisonStrength + militia) * city.defenseMultiplier();
  }

  private pressSiege(city: City, owner: Kingdom, assessment: SiegeAssessment, world: WarfareWorld): void {
    const { besieger, attackStrength, defenceStrength } = assessment;

    if (city.besiegerId !== besieger.id) {
      // A new besieger arrives; progress made by a previous army does not carry.
      city.besiegerId = besieger.id;
      city.siegeProgress = 0;
      city.siegeYears = 0;
      const war = world.diplomacy.getWarsFor(besieger.id).find(w => w.attacker === owner.id || w.defender === owner.id);
      chronicle.log(
        world.year,
        'siege',
        `${besieger.name} laid siege to ${city.name}.`,
        {
          title: `Siege of ${city.name}`,
          importance: city.id === owner.capitalCityId ? 'legendary' : 'major',
          scope: 'international',
          refs: [
            { kind: 'city', id: city.id, name: city.name },
            { kind: 'kingdom', id: besieger.id, name: besieger.name },
            { kind: 'kingdom', id: owner.id, name: owner.name },
            ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
          ],
          tags: ['siege', 'war', city.id === owner.capitalCityId ? 'capital' : 'city'],
          causes: [`${besieger.name} concentrated enough nearby military strength to invest the settlement.`],
          consequences: [`${city.name} was cut off and began accumulating siege pressure.`],
          threadId: war ? `war:${war.id}` : `siege:${city.id}:${world.year}`,
          threadTitle: war?.reason ?? `Siege of ${city.name}`,
          data: { attackStrength: Number(attackStrength.toFixed(2)), defenceStrength: Number(defenceStrength.toFixed(2)) }
        }
      );
      events.emit('siegeBegan', { city, besieger, defender: owner, year: world.year });
    }

    city.siegeYears++;

    // War grinds on everything outside the walls. Roads feeding the settlement
    // are cut and its economic buildings take shelling year after year, so a
    // long siege visibly collapses the defender's trade and production.
    damageRoadsAround(world.tileMap, city.x, city.y, 5);
    damagePrimaryRoads(world.tileMap, city.x, city.y, 5);
    damageRailAround(world.tileMap, city.x, city.y, 5);
    damageStrategicBuildings(city);

    // A city cut off from its fields starves regardless of how strong its walls are.
    const starving = city.siegeYears >= STARVATION_YEARS;
    const ratio = attackStrength / Math.max(1, defenceStrength);

    if (ratio < SIEGE_THRESHOLD && !starving) {
      // The walls hold. The besiegers grind themselves down instead.
      city.siegeProgress = Math.max(0, city.siegeProgress - 0.05);
      besieger.warWeariness = Math.min(100, besieger.warWeariness + 3);
      return;
    }

    // Progress scales with how badly the attacker outmatches the defence.
    const advance = starving
      ? 0.25
      : Math.min(0.5, 0.08 + (ratio - SIEGE_THRESHOLD) * 0.16);

    city.siegeProgress += advance;

    // A siege is miserable for everyone inside.
    city.prosperity = Math.max(0, city.prosperity - 0.08);
    city.ledger.recordConsumed('food', city.stock.take('food', city.population * 0.3));

    if (city.siegeProgress >= 1) {
      this.captureCity(city, owner, besieger, world);
    }
  }

  private relieveSiege(city: City, world: WarfareWorld): void {
    if (!city.besiegerId) {
      if (city.siegeProgress > 0) city.siegeProgress = Math.max(0, city.siegeProgress - 0.2);
      return;
    }

    const besieger = world.kingdoms.get(city.besiegerId);
    const defenderId = city.kingdomId;
    const war = defenderId && besieger
      ? world.diplomacy.getWarsFor(defenderId).find(w => w.attacker === besieger.id || w.defender === besieger.id)
      : undefined;
    chronicle.log(
      world.year,
      'siege',
      `The siege of ${city.name} was broken${besieger ? ` and ${besieger.name} withdrew` : ''}.`,
      {
        title: `Relief of ${city.name}`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'city', id: city.id, name: city.name },
          ...(besieger ? [{ kind: 'kingdom' as const, id: besieger.id, name: besieger.name }] : []),
          ...(defenderId ? [{ kind: 'kingdom' as const, id: defenderId }] : []),
          ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
        ],
        tags: ['siege', 'relief', 'war'],
        consequences: [`${city.name} escaped immediate capture and siege progress was cleared.`],
        threadId: war ? `war:${war.id}` : undefined,
        threadTitle: war?.reason
      }
    );
    events.emit('siegeLifted', { city, year: world.year });

    city.besiegerId = null;
    city.siegeProgress = 0;
    city.siegeYears = 0;
  }

  // ============================================================
  // CAPTURE
  // ============================================================

  /**
   * The settlement changes hands: territory, buildings, stockpile and the
   * surviving population all pass to the conqueror.
   */
  public captureCity(city: City, from: Kingdom, to: Kingdom, world: WarfareWorld): void {
    const wasCapital = from.capitalCityId === city.id;
    // Read the siege length before the state is cleared, so the chronicle can
    // report how long the walls actually held.
    const heldFor = Math.max(1, city.siegeYears);
    const war = world.diplomacy.getWarsFor(from.id).find(w => w.attacker === to.id || w.defender === to.id);

    // Sacking. Some of the population dies, some of the stockpile is carried off.
    const casualties = Math.floor(city.population * rng.range(0.12, 0.3));
    const residents = world.entities.filter(e => e.cityId === city.id);
    for (let i = 0; i < Math.min(casualties, residents.length); i++) {
      residents[i].hp = 0;
    }

    for (const good of ALL_GOODS) {
      const looted = city.stock.take(good, city.stock.get(good) * 0.4);
      // Plunder leaves the city's books as an outflow, not as nothing.
      city.ledger.recordExported(good, looted);
      to.treasury.add(good, looted);
    }

    // Buildings are damaged in the assault.
    for (const building of city.buildings.values()) {
      building.hp = Math.max(1, Math.round(building.hp * rng.range(0.4, 0.8)));
    }

    // The storming breaks the roads of the whole region, cutting the conqueror's
    // supply lines and the surrounding towns' trade alike.
    damageRoadsAround(world.tileMap, city.x, city.y, 7);
    damageRailAround(world.tileMap, city.x, city.y, 7);

    // Transfer ownership.
    from.removeCity(city.id);
    to.addCity(city.id);
    city.formerOwnerId = from.id;
    city.kingdomId = to.id;
    city.capturedYear = world.year;
    city.besiegerId = null;
    city.siegeProgress = 0;
    city.siegeYears = 0;
    // A newly conquered city is resentful and unproductive for a while.
    city.prosperity = Math.min(city.prosperity, 0.3);

    for (const key of city.territory) {
      const [tx, ty] = key.split(',').map(Number);
      const tile = world.tileMap.getTile(tx, ty);
      if (tile && tile.cityId === city.id) tile.kingdomId = to.id;
    }

    // Surviving inhabitants become subjects of the conqueror.
    for (const resident of world.entities) {
      if (resident.cityId !== city.id || resident.hp <= 0) continue;
      resident.kingdomId = to.id;
      // The old ruler does not simply keep his crown in a captured city.
      if (resident.profession === 'king' && from.rulerId === resident.id) {
        resident.profession = 'none';
      }
    }

    // The loser needs a new seat of power if this was it.
    if (wasCapital) {
      const remaining = [...from.cityIds]
        .map(id => world.cities.get(id))
        .filter((c): c is City => !!c)
        .sort((a, b) => b.population - a.population)[0];

      if (remaining) {
        from.capitalCityId = remaining.id;
        chronicle.log(
          world.year,
          'conquest',
          `${to.name} stormed the capital of ${from.name}! The court flees to ${remaining.name}.`,
          {
            title: `Fall of ${city.name}`,
            importance: 'legendary',
            scope: 'international',
            refs: [
              { kind: 'city', id: city.id, name: city.name },
              { kind: 'city', id: remaining.id, name: remaining.name },
              { kind: 'kingdom', id: from.id, name: from.name },
              { kind: 'kingdom', id: to.id, name: to.name },
              ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
            ],
            tags: ['capital', 'conquest', 'siege', 'war'],
            causes: [`${city.name} fell after ${heldFor} ${heldFor === 1 ? 'year' : 'years'} under siege.`],
            consequences: [`${from.name} moved its court to ${remaining.name}.`, `${city.name} passed to ${to.name}.`],
            threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
            threadTitle: war?.reason ?? `Fall of ${city.name}`,
            data: { siegeYears: heldFor, civilianCasualties: casualties }
          }
        );
      } else {
        chronicle.log(
          world.year,
          'conquest',
          `${to.name} took the last city of ${from.name}. The realm is extinguished.`,
          {
            title: `Extinction of ${from.name}`,
            importance: 'legendary',
            scope: 'world',
            refs: [
              { kind: 'city', id: city.id, name: city.name },
              { kind: 'kingdom', id: from.id, name: from.name },
              { kind: 'kingdom', id: to.id, name: to.name },
              ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
            ],
            tags: ['last city', 'realm extinction', 'conquest'],
            causes: [`${city.name}, the final settlement of ${from.name}, was captured.`],
            consequences: [`${from.name} no longer possessed a surviving settlement.`],
            threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
            threadTitle: war?.reason ?? `Fall of ${from.name}`,
            data: { siegeYears: heldFor, civilianCasualties: casualties }
          }
        );
      }
    } else {
      chronicle.log(
        world.year,
        'conquest',
        `${to.name} captured ${city.name} from ${from.name} after a siege of ${heldFor} ${heldFor === 1 ? 'year' : 'years'}.`,
        {
          title: `Capture of ${city.name}`,
          importance: 'major',
          scope: 'international',
          refs: [
            { kind: 'city', id: city.id, name: city.name },
            { kind: 'kingdom', id: from.id, name: from.name },
            { kind: 'kingdom', id: to.id, name: to.name },
            ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
          ],
          tags: ['conquest', 'siege', 'war'],
          causes: [`${city.name} fell after ${heldFor} ${heldFor === 1 ? 'year' : 'years'} under siege.`],
          consequences: [`The settlement changed allegiance from ${from.name} to ${to.name}.`],
          threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
          threadTitle: war?.reason ?? `Capture of ${city.name}`,
          data: { siegeYears: heldFor, civilianCasualties: casualties }
        }
      );
    }

    // Conquest is exhausting and it hardens the loser.
    to.warWeariness = Math.min(100, to.warWeariness + 8);
    world.diplomacy.changeRelation(from.id, to.id, -25);

    events.emit('cityCaptured', { city, from, to, year: world.year, wasCapital });
  }

  // ============================================================
  // PEACE SETTLEMENTS
  // ============================================================

  /** Applies a treaty to every war that concluded since the last tick. */
  private settleConcludedWars(world: WarfareWorld): void {
    for (const war of world.diplomacy.warHistory) {
      if (war.endYear === null || this.settledWars.has(war.id)) continue;
      this.settledWars.add(war.id);

      const attacker = world.kingdoms.get(war.attacker);
      const defender = world.kingdoms.get(war.defender);
      if (!attacker || !defender) continue;

      this.settlePeace(attacker, defender, world);
    }
  }

  /**
   * When a war ends, the side that took ground keeps some of it.
   * Called by the diplomacy layer as a war concludes.
   */
  public settlePeace(a: Kingdom, b: Kingdom, world: WarfareWorld): void {
    // Cities captured during this war have already changed hands; a peace treaty
    // simply confirms them. What it adds is the option of a further cession when
    // one side is overwhelmingly dominant and still besieging.
    const aPower = a.computePower();
    const bPower = b.computePower();
    const ratio = aPower / Math.max(1, bPower);

    const dominant = ratio > 2 ? a : ratio < 0.5 ? b : null;
    if (!dominant) return;

    const loser = dominant === a ? b : a;
    if (loser.cityIds.size <= 1) return; // Never annihilate a realm at the table

    // The dominant realm takes the loser's settlement nearest its own territory.
    const candidates = [...loser.cityIds]
      .map(id => world.cities.get(id))
      .filter((c): c is City => !!c && c.id !== loser.capitalCityId);
    if (candidates.length === 0) return;

    const dominantCities = [...dominant.cityIds]
      .map(id => world.cities.get(id))
      .filter((c): c is City => !!c);
    if (dominantCities.length === 0) return;

    let closest = candidates[0];
    let closestDistance = Infinity;
    for (const candidate of candidates) {
      for (const own of dominantCities) {
        const distance = Math.hypot(candidate.x - own.x, candidate.y - own.y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = candidate;
        }
      }
    }

    // Only land the winner can actually reach and hold.
    if (closestDistance > 60) return;

    this.cedeCity(closest, loser, dominant, world);
  }

  /** A settlement handed over by treaty rather than taken by storm. */
  private cedeCity(city: City, from: Kingdom, to: Kingdom, world: WarfareWorld): void {
    from.removeCity(city.id);
    to.addCity(city.id);
    city.formerOwnerId = from.id;
    city.kingdomId = to.id;
    city.capturedYear = world.year;
    city.prosperity = Math.min(city.prosperity, 0.45);

    for (const key of city.territory) {
      const [tx, ty] = key.split(',').map(Number);
      const tile = world.tileMap.getTile(tx, ty);
      if (tile && tile.cityId === city.id) tile.kingdomId = to.id;
    }

    for (const resident of world.entities) {
      if (resident.cityId === city.id && resident.hp > 0) resident.kingdomId = to.id;
    }

    const recentWar = [...world.diplomacy.warHistory]
      .reverse()
      .find(w => w.endYear === world.year && ((w.attacker === from.id && w.defender === to.id) || (w.attacker === to.id && w.defender === from.id)));
    chronicle.log(
      world.year,
      'conquest',
      `In the peace treaty, ${from.name} ceded ${city.name} to ${to.name}.`,
      {
        title: `Cession of ${city.name}`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'city', id: city.id, name: city.name },
          { kind: 'kingdom', id: from.id, name: from.name },
          { kind: 'kingdom', id: to.id, name: to.name },
          ...(recentWar ? [{ kind: 'war' as const, id: recentWar.id, name: recentWar.reason }] : [])
        ],
        tags: ['peace treaty', 'cession', 'territory'],
        causes: ['A peace settlement required territorial concessions.'],
        consequences: [`${city.name} changed sovereignty without being taken by storm.`],
        threadId: recentWar ? `war:${recentWar.id}` : undefined,
        threadTitle: recentWar?.reason
      }
    );
    events.emit('cityCeded', { city, from, to, year: world.year });
  }
}
