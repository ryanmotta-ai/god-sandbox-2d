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
  scholar: ['o Sábio', 'o Iluminado', 'Mestre das Estrelas', 'o Arqui-Erudito'],
  builder: ['o Arquiteto', 'Mestre Construtor', 'Moldador de Pedras', 'o Grão-Pedreiro'],
  hero: ['o Invicto', 'Coração de Ferro', 'Matador de Dragões', 'Campeão do Reino'],
  diplomat: ['o Pacificador', 'Língua de Prata', 'o Emissário', 'Arquiteto de Pactos']
};

export const MONUMENT_TYPES: { type: BuildingType; name: string; desc: string }[] = [
  { type: 'monument' as BuildingType, name: 'Estátua do Fundador', desc: '+30% de Estabilidade do Reino e Prestígio Cultural' },
  { type: 'great_library' as BuildingType, name: 'Grande Biblioteca da Sabedoria', desc: '+50% de Produção de Pesquisa Nacional e Registros Antigos' },
  { type: 'grand_aqueduct' as BuildingType, name: 'Grande Aqueduto das Nações', desc: '+50% de Capacidade Populacional da Cidade e Colheita' },
  { type: 'colosseum' as BuildingType, name: 'Grande Coliseu das Lendas', desc: '+30% de Moral Militar e Reduz a Exaustão de Guerra' }
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
      // Every other kind of great person is drawn against a chance. This branch
      // was not, so any soldier who reached three kills was promoted the very
      // next year — and in a war that is most of them, every year.
      else if ((e.kills >= 3 && rng.chance(0.08)) || (e.profession === 'king' && kingdom.militaryPower > 150 && rng.chance(0.1))) {
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
      `${e.title} emergiu em ${kingdom.name} como um Grande ${type}.`,
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
        consequences: [`${e.title} tornou-se uma figura lembrada de ${kingdom.name}.`],
        threadId: `person:${e.id}`,
        threadTitle: `Vida e Legado de ${e.title}`,
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
          const opus = `O Códice de ${tech.name}`;
          chronicle.log(
            year,
            'great_person',
            `${e.title} escreveu "${opus}", completando a descoberta de ${tech.name} para ${kingdom.name}.`,
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
              causes: [`A erudição de ${e.title} produziu um grande avanço.`],
              consequences: [`${kingdom.name} concluiu ${tech.name}.`],
              threadId: `person:${e.id}`,
              threadTitle: `Vida e Legado de ${e.title}`
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
            `${e.title} descobriu que todas as grandes maravilhas já haviam sido construídas, e então encheu o tesouro de ${kingdom.name}.`,
            {
              title: `A Doação de ${e.title}`,
              importance: 'major',
              scope: 'person',
              refs: [
                { kind: 'person', id: e.id, name: e.title || e.name },
                { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
              ],
              tags: ['builder', 'endowment', 'treasury'],
              consequences: [`${kingdom.name} recebeu uma grande doação para o tesouro.`],
              threadId: `person:${e.id}`,
              threadTitle: `Vida e Legado de ${e.title}`
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
            `${e.title} considerou ${city.name} pequena demais para um monumento, e em vez disso doou para o tesouro de ${kingdom.name}.`
          );
          break;
        }

        const monument = rng.pick(remaining);
        const bId = nextId('wonder');
        const building = new Building(bId, monument.type, city.x + 1, city.y + 1, city.id);
        city.buildings.set(bId, building);
        city.markBuildingTopologyChanged();

        // Mark tile
        const tile = tileMap.getTile(city.x + 1, city.y + 1);
        if (tile) { tile.buildingId = bId; tileMap.markRenderDirty(tile.x, tile.y); }

        kingdom.economy.stability = Math.min(1.0, kingdom.economy.stability + 0.25);

        chronicle.log(
          year,
          'wonder',
          `${e.title} financiou e construiu o ${monument.name} em ${city.name}.`,
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
            causes: [`${e.title} usou seu grande legado para realizar uma obra monumental.`],
            consequences: [monument.desc],
            threadId: `person:${e.id}`,
            threadTitle: `Vida e Legado de ${e.title}`
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
          `${e.title} reuniu os exércitos de ${kingdom.name} e tornou-se um símbolo de determinação militar.`,
          {
            title: `Legado Heróico de ${e.title}`,
            importance: 'legendary',
            scope: 'person',
            refs: [
              { kind: 'person', id: e.id, name: e.title || e.name },
              { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
            ],
            tags: ['hero', 'war', 'morale'],
            consequences: [`A exaustão de guerra em ${kingdom.name} caiu drasticamente e ${e.title} recebeu armas lendárias.`],
            threadId: `person:${e.id}`,
            threadTitle: `Vida e Legado de ${e.title}`
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
          `${e.title} intermediou grandes tratados de não-agressão para ${kingdom.name}.`,
          {
            title: `Legado Diplomático de ${e.title}`,
            importance: 'legendary',
            scope: 'person',
            refs: [
              { kind: 'person', id: e.id, name: e.title || e.name },
              { kind: 'kingdom', id: kingdom.id, name: kingdom.name }
            ],
            tags: ['diplomat', 'treaty', 'peace'],
            consequences: [`${kingdom.name} ganhou estabilidade e novos compromissos de não-agressão.`],
            threadId: `person:${e.id}`,
            threadTitle: `Vida e Legado de ${e.title}`
          }
        );
        break;
      }
    }
  }
}
