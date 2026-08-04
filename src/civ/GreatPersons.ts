import { Entity } from '../entities/Entity';
import { Kingdom } from './Kingdom';
import { City } from './City';
import { Building, BuildingType } from './Building';
import { chronicle } from './Chronicle';
import { events } from '../core/EventBus';
import { rng, nextId } from '../core/Random';
import { LEGENDARY_ITEMS } from '../entities/Equipment';
import { TileMap } from '../world/TileMap';

export type GreatPersonType = 'scholar' | 'builder' | 'hero' | 'diplomat';

export interface GreatPersonData {
  id: string;
  name: string;
  type: GreatPersonType;
  title: string;
  birthYear: number;
  magnumOpus?: string;
  kingdomId: string;
}

export const GREAT_PERSON_TITLES: Record<GreatPersonType, string[]> = {
  scholar: ['the Wise', 'the Enlightened', 'Master of Stars', 'the Arch-Scholar'],
  builder: ['the Architect', 'Master Builder', 'shaper of Stones', 'the Grand Mason'],
  hero: ['the Undefeated', 'Iron Heart', 'Dragonslayer', 'Champion of the Realm'],
  diplomat: ['the Peacemaker', 'Silver-Tongue', 'the Envoy', 'Architect of Pacts']
};

export const MONUMENT_TYPES: { type: BuildingType; name: string; desc: string }[] = [
  { type: 'monument' as BuildingType, name: 'Statue of the Founder', desc: '+30% Kingdom Stability & Cultural Prestige' },
  { type: 'great_library' as BuildingType, name: 'Great Library of Wisdom', desc: '+50% National Research Output & Ancient Records' },
  { type: 'grand_aqueduct' as BuildingType, name: 'Grand Aqueduct of Nations', desc: '+50% City Population Capacity & Harvest' },
  { type: 'colosseum' as BuildingType, name: 'Grand Colosseum of Legends', desc: '+30% Military Morale & Lowers War Weariness' }
];

export class GreatPersonManager {
  private static registry: Map<string, GreatPersonData> = new Map();

  /** Check for entity ascension to Great Person status */
  public static checkAscension(
    entities: Entity[],
    kingdoms: Map<string, Kingdom>,
    cities: Map<string, City>,
    tileMap: TileMap,
    year: number
  ): void {
    if (year < 5) return;

    for (const e of entities) {
      if (e.isGreatPerson || !e.kingdomId) continue;
      const kingdom = kingdoms.get(e.kingdomId);
      if (!kingdom) continue;

      let type: GreatPersonType | null = null;

      // Scholar: Level 4+ and kingdom has active research
      if (e.level >= 4 && e.profession === 'scout' && rng.chance(0.12)) {
        type = 'scholar';
      }
      // Hero: 3+ kills or King in war
      else if (e.kills >= 3 || (e.profession === 'king' && kingdom.militaryPower > 150 && rng.chance(0.1))) {
        type = 'hero';
      }
      // Builder: High level woodcutter/miner in capital
      else if (e.level >= 3 && (e.profession === 'woodcutter' || e.profession === 'miner') && rng.chance(0.1)) {
        type = 'builder';
      }
      // Diplomat: High level in kingdom with multiple contact realms
      else if (e.level >= 4 && kingdom.knownKingdoms.size >= 2 && rng.chance(0.08)) {
        type = 'diplomat';
      }

      if (type) {
        this.ascend(e, type, kingdom, cities, tileMap, year);
        break; // Max 1 ascension per tick
      }
    }
  }

  private static ascend(
    e: Entity,
    type: GreatPersonType,
    kingdom: Kingdom,
    cities: Map<string, City>,
    tileMap: TileMap,
    year: number
  ): void {
    e.isGreatPerson = true;
    e.greatPersonType = type;
    const titleSuffix = rng.pick(GREAT_PERSON_TITLES[type]);
    e.title = `${e.name} ${titleSuffix}`;

    const data: GreatPersonData = {
      id: e.id,
      name: e.name,
      type,
      title: e.title,
      birthYear: year,
      kingdomId: kingdom.id
    };
    this.registry.set(e.id, data);

    e.showEmote('crown', 60);

    chronicle.log(
      year,
      'great_person',
      `${e.title} emerged in ${kingdom.name} as a Great ${type}.`,
      {
        title: e.title,
        importance: 'legendary',
        scope: 'person',
        refs: [
          { kind: 'person', id: e.id, name: e.title || e.name },
          { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
          ...(e.cityId && cities.get(e.cityId) ? [{ kind: 'city' as const, id: e.cityId, name: cities.get(e.cityId)!.name }] : [])
        ],
        tags: ['great person', type, 'legacy'],
        consequences: [`${e.title} became a remembered figure of ${kingdom.name}.`],
        threadId: `person:${e.id}`,
        threadTitle: `Life and Legacy of ${e.title}`,
        data: { greatPersonType: type, level: e.level, kills: e.kills }
      }
    );
    events.emit('greatPersonBorn', { entity: e, type, kingdom, year });

    // Perform their Great Legacy Action!
    this.executeGreatAction(e, type, kingdom, cities, tileMap, year);
  }

  /** Execute unique legacy action for the Great Person */
  public static executeGreatAction(
    e: Entity,
    type: GreatPersonType,
    kingdom: Kingdom,
    cities: Map<string, City>,
    tileMap: TileMap,
    year: number
  ): void {
    const city = e.cityId ? cities.get(e.cityId) : Array.from(cities.values())[0];
    if (!city) return;

    switch (type) {
      case 'scholar': {
        // Scientific Breakthrough: Grants +400 Research Points!
        const techKeys = kingdom.research.availableTechs();
        if (techKeys.length > 0) {
          const tech = rng.pick(techKeys);
          kingdom.research.complete(tech.id);
          const opus = `The Codex of ${tech.name}`;
          chronicle.log(
            year,
            'great_person',
            `${e.title} authored "${opus}", completing the discovery of ${tech.name} for ${kingdom.name}.`,
            {
              title: opus,
              importance: 'legendary',
              scope: 'person',
              refs: [
                { kind: 'person', id: e.id, name: e.title || e.name },
                { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
                { kind: 'tech', id: tech.id, name: tech.name }
              ],
              tags: ['magnum opus', 'scholar', 'technology'],
              causes: [`${e.title}'s scholarship produced a major breakthrough.`],
              consequences: [`${kingdom.name} completed ${tech.name}.`],
              threadId: `person:${e.id}`,
              threadTitle: `Life and Legacy of ${e.title}`
            }
          );
        } else {
          kingdom.treasury.add('gold', 100);
        }
        break;
      }

      case 'builder': {
        // Construct a Historic Monument. A wonder is unique in the world — once
        // someone has raised it, nobody builds a second one.
        const alreadyBuilt = new Set<string>();
        for (const existing of cities.values()) {
          for (const b of existing.buildings.values()) alreadyBuilt.add(b.type);
        }
        const remaining = MONUMENT_TYPES.filter(m => !alreadyBuilt.has(m.type));
        if (remaining.length === 0) {
          // Every wonder already stands. Endow the treasury instead.
          kingdom.treasury.add('gold', 250);
          chronicle.log(
            year,
            'great_person',
            `${e.title} found every great wonder already built, and endowed the treasury of ${kingdom.name} instead.`,
            {
              title: `${e.title}'s Endowment`,
              importance: 'major',
              scope: 'person',
              refs: [
                { kind: 'person', id: e.id, name: e.title || e.name },
                { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
              ],
              tags: ['builder', 'endowment', 'treasury'],
              consequences: [`${kingdom.name} received a major treasury endowment.`],
              threadId: `person:${e.id}`,
              threadTitle: `Life and Legacy of ${e.title}`
            }
          );
          break;
        }

        // A wonder occupies a permanent building slot. Dropping one into a camp or
        // hamlet consumes capacity the settlement needs for its first farms, camps
        // and quarries, and quietly stalls its whole economy. Wonders belong in a
        // settlement large enough to carry them.
        const wonderReady = city.tier !== 'camp' && city.tier !== 'hamlet' && city.hasFreeBuildingSlot();
        if (!wonderReady) {
          kingdom.treasury.add('gold', 250);
          chronicle.log(
            year,
            'great_person',
            `${e.title} judged ${city.name} too small for a monument, and endowed the treasury of ${kingdom.name} instead.`
          );
          break;
        }

        const monument = rng.pick(remaining);
        const bId = nextId('wonder');
        const building = new Building(bId, monument.type, city.x + 1, city.y + 1, city.id);
        city.buildings.set(bId, building);

        // Mark tile
        const tile = tileMap.getTile(city.x + 1, city.y + 1);
        if (tile) tile.buildingId = bId;

        kingdom.economy.stability = Math.min(1.0, kingdom.economy.stability + 0.25);

        chronicle.log(
          year,
          'wonder',
          `${e.title} financed and constructed the ${monument.name} in ${city.name}.`,
          {
            title: monument.name,
            importance: 'legendary',
            scope: 'city',
            refs: [
              { kind: 'person', id: e.id, name: e.title || e.name },
              { kind: 'city', id: city.id, name: city.name },
              { kind: 'kingdom', id: kingdom.id, name: kingdom.name },
              { kind: 'building', id: building.id, name: monument.name }
            ],
            tags: ['wonder', 'builder', monument.type],
            causes: [`${e.title} used their great legacy to undertake a monumental work.`],
            consequences: [monument.desc],
            threadId: `person:${e.id}`,
            threadTitle: `Life and Legacy of ${e.title}`
          }
        );
        break;
      }

      case 'hero': {
        // Heroic Military Legacy: Arm with legendary weapon & boost kingdom military
        const itemTemplate = rng.pick(LEGENDARY_ITEMS);
        e.equipment.weapon = { ...itemTemplate, id: `hero_w_${Date.now()}` };
        e.recalculateStats();
        kingdom.warWeariness = Math.max(0, kingdom.warWeariness - 30);

        chronicle.log(
          year,
          'great_person',
          `${e.title} rallied the armies of ${kingdom.name} and became a symbol of military resolve.`,
          {
            title: `Heroic Legacy of ${e.title}`,
            importance: 'legendary',
            scope: 'person',
            refs: [
              { kind: 'person', id: e.id, name: e.title || e.name },
              { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
            ],
            tags: ['hero', 'war', 'morale'],
            consequences: [`War weariness in ${kingdom.name} fell sharply and ${e.title} received legendary arms.`],
            threadId: `person:${e.id}`,
            threadTitle: `Life and Legacy of ${e.title}`
          }
        );
        break;
      }

      case 'diplomat': {
        // Great Diplomat: High relation boost & Non-Aggression Pact
        for (const targetId of kingdom.knownKingdoms) {
          events.emit('diplomaticPact', { from: kingdom.id, to: targetId, pact: 'Non-Aggression' });
        }
        kingdom.economy.stability = Math.min(1.0, kingdom.economy.stability + 0.2);

        chronicle.log(
          year,
          'great_person',
          `${e.title} brokered grand non-aggression treaties for ${kingdom.name}.`,
          {
            title: `Diplomatic Legacy of ${e.title}`,
            importance: 'legendary',
            scope: 'person',
            refs: [
              { kind: 'person', id: e.id, name: e.title || e.name },
              { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
            ],
            tags: ['diplomat', 'treaty', 'peace'],
            consequences: [`${kingdom.name} gained stability and new non-aggression commitments.`],
            threadId: `person:${e.id}`,
            threadTitle: `Life and Legacy of ${e.title}`
          }
        );
        break;
      }
    }
  }
}
