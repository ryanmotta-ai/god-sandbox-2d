import { City, SiegePhase, SiegeState } from './City';
import { Kingdom, MilitaryDoctrine, MilitaryTradition, DoctrineType } from './Kingdom';
import { Entity } from '../entities/Entity';
import { SPECIES_DEFINITIONS } from '../entities/Species';
import { GOVERNMENTS } from './Government';
import { DiplomacyManager, WarRecord } from './Diplomacy';
import { TileMap } from '../world/TileMap';
import { TerrainType } from '../world/Biomes';
import { chronicle } from './Chronicle';
import { events } from '../core/EventBus';
import { rng, nextId } from '../core/Random';
import { ALL_GOODS } from './Goods';
import { TraitId } from '../entities/Traits';
import { damageRoadsAround, damagePrimaryRoads, damageStrategicBuildings } from './WarDamage';
import { WarFrontSystem, SIEGE_GATE_PUSH } from './WarFronts';

/**
 * WAR-V4 — Combate Tático (Infantaria, Cavalaria, Arqueiros, Artilharia, Terreno, Fadiga, Moral, Perseguição e Rota)
 * WAR-V5 — Cercos Estruturados (Muralhas, Brechas, Portões, Torres, Bombardeio, Fome e Rendição)
 * WAR-V6 — Doutrina Militar (Tradições, Composição Preferida, Treinamento e Evolução Tecnológica)
 */

export const SIEGE_RADIUS = 7;
const SIEGE_THRESHOLD = 1.0;
const STARVATION_YEARS = 6;
export const FIELD_BATTLE_RADIUS = 5;

export type CommanderTrait = 'tactician' | 'valiant' | 'fortifier' | 'ruthless';

export interface Commander {
  id: string;
  entityId: string;
  name: string;
  kingdomId: string;
  trait: CommanderTrait;
  battlesWon: number;
  battlesFought: number;
  kills: number;
  appointedYear: number;
}

export type ArmyCampaignState = 'mustering' | 'marching' | 'besieging' | 'defending' | 'retreating' | 'garrisoned';

export type UnitRole = 'infantry' | 'cavalry' | 'archer' | 'artillery' | 'militia';

export interface ArmyComposition {
  infantry: number;
  cavalry: number;
  archers: number;
  artillery: number;
  militia: number;
}

export interface Army {
  id: string;
  name: string;
  kingdomId: string;
  homeCityId: string;
  commanderId: string | null;
  commanderTrait: CommanderTrait | null;
  soldierIds: Set<string>;
  targetCityId: string | null;
  targetPos: { x: number; y: number } | null;
  state: ArmyCampaignState;
  stance: 'aggressive' | 'defensive' | 'plunder';
  readiness: number; // 0..1
  morale: number; // 0..1
  fatigue: number; // 0..1 (WAR-V4)
  experience: number; // 0..1 (WAR-V4 / WAR-V6)
  composition?: ArmyComposition; // (WAR-V4)
  isMercenary?: boolean;
  mercenaryCompanyId?: string;
  createdYear: number;
}

export interface MercenaryCompany {
  id: string;
  name: string;
  bannerEmblem: string;
  captainName: string;
  captainTrait: CommanderTrait;
  size: number;
  veteranLevel: number;
  hiringCost: number;
  annualFee: number;
  employerKingdomId: string | null;
  contractEndYear: number | null;
  homeX: number;
  homeY: number;
  armyId: string | null;
}

export interface WarfareWorld {
  year: number;
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
  entities: Entity[];
  tileMap: TileMap;
  diplomacy: DiplomacyManager;
  fronts?: WarFrontSystem;
}

interface SiegeAssessment {
  besieger: Kingdom;
  attackStrength: number;
  defenceStrength: number;
  besiegingArmies: Army[];
}

/** Modificador de combate baseado no terreno local (WAR-V4). */
export function terrainCombatModifier(terrain: TerrainType, role: UnitRole): number {
  switch (terrain) {
    case TerrainType.GRASS:
    case TerrainType.SOIL:
      return role === 'cavalry' ? 1.2 : 1.0;
    case TerrainType.FOREST:
      if (role === 'infantry') return 1.15;
      if (role === 'cavalry') return 0.70;
      if (role === 'archer') return 0.85;
      if (role === 'artillery') return 0.60;
      return 1.0;
    case TerrainType.SWAMP:
      if (role === 'infantry') return 0.85;
      if (role === 'cavalry') return 0.50;
      if (role === 'archer') return 0.90;
      if (role === 'artillery') return 0.40;
      return 0.8;
    case TerrainType.SAND:
      if (role === 'archer') return 1.10;
      if (role === 'cavalry') return 1.00;
      if (role === 'artillery') return 0.80;
      return 0.90;
    case TerrainType.TUNDRA:
    case TerrainType.SNOW:
      if (role === 'cavalry') return 0.75;
      if (role === 'artillery') return 0.70;
      return 0.85;
    case TerrainType.MOUNTAIN:
      if (role === 'archer') return 1.30;
      if (role === 'infantry') return 1.20;
      if (role === 'cavalry') return 0.40;
      if (role === 'artillery') return 0.50;
      return 1.0;
    case TerrainType.ARCANE:
      return role === 'archer' ? 1.15 : 1.0;
    default:
      return 1.0;
  }
}

/** Determina o papel de combate (UnitRole) de uma entidade baseado em equipamentos, classe e traços. */
export function determineUnitRole(entity: Entity, kingdom?: Kingdom): UnitRole {
  if (entity.profession === 'farmer' || entity.profession === 'builder' || entity.profession === 'miner') {
    return 'militia';
  }

  const weapon = entity.equipment.weapon;
  const isCavalry = entity.traits.has(TraitId.QUICK) ||
    (kingdom?.doctrine?.type === 'cavalry_focus' && rng.chance(0.45));

  if (weapon) {
    if (weapon.category === 'siege') return 'artillery';
    if (weapon.category === 'ranged') return 'archer';
    if (weapon.category === 'melee' || weapon.category === 'heavy') {
      return isCavalry ? 'cavalry' : 'infantry';
    }
  }

  if (entity.profession === 'archer') return 'archer';
  return isCavalry ? 'cavalry' : 'infantry';
}

/** Calcula a composição de unidades de um exército. */
export function computeArmyComposition(army: Army, world: WarfareWorld): ArmyComposition {
  const comp: ArmyComposition = { infantry: 0, cavalry: 0, archers: 0, artillery: 0, militia: 0 };
  const kingdom = world.kingdoms.get(army.kingdomId);

  if (army.isMercenary && army.mercenaryCompanyId) {
    comp.infantry = 4;
    comp.cavalry = 3;
    comp.archers = 2;
    comp.artillery = 1;
    return comp;
  }

  for (const sId of army.soldierIds) {
    const s = world.entities.find(e => e.id === sId && e.hp > 0);
    if (!s) continue;
    const role = determineUnitRole(s, kingdom);
    if (role === 'infantry') comp.infantry++;
    else if (role === 'cavalry') comp.cavalry++;
    else if (role === 'archer') comp.archers++;
    else if (role === 'artillery') comp.artillery++;
    else comp.militia++;
  }

  return comp;
}

/** Obtém o tipo de terreno dominante na região de uma batalha. */
export function getBattleTerrain(tileMap: TileMap, x: number, y: number): TerrainType {
  const tile = tileMap.getTile(Math.round(x), Math.round(y));
  return tile ? tile.type : TerrainType.GRASS;
}

export class WarfareSystem {
  public armies: Map<string, Army> = new Map();
  public commanders: Map<string, Commander> = new Map();
  public mercenaryCompanies: Map<string, MercenaryCompany> = new Map();
  private settledWars: Set<string> = new Set();

  public reset(): void {
    this.settledWars.clear();
    this.armies.clear();
    this.commanders.clear();
    this.mercenaryCompanies.clear();
  }

  public tickYear(world: WarfareWorld): void {
    this.settleConcludedWars(world);
    this.maintainMercenaries(world);
    this.organizeKingdomArmies(world);
    this.applyTrainingBonus(world);
    this.planCampaigns(world);
    this.applyMilitaryUpkeep(world);
    this.resolveFieldBattles(world);

    const armySoldiers = this.gatherArmies(world);

    for (const city of [...world.cities.values()]) {
      const owner = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
      if (!owner) continue;

      const assessment = this.assessSiege(city, owner, armySoldiers, world);

      if (!assessment) {
        this.relieveSiege(city, world);
        continue;
      }

      this.pressSiege(city, owner, assessment, world);
    }

    this.updateWarGoalsProgress(world);

    for (const kingdom of world.kingdoms.values()) {
      this.evolveDoctrine(kingdom, world);
    }
  }

  /** WAR-V6: Treinamento passivo e descanso de fadiga em guarnições. */
  private applyTrainingBonus(world: WarfareWorld): void {
    for (const kingdom of world.kingdoms.values()) {
      const armies = this.getArmiesForKingdom(kingdom.id);
      for (const army of armies) {
        army.composition = computeArmyComposition(army, world);

        if (army.state === 'garrisoned' || army.state === 'mustering') {
          army.fatigue = Math.max(0, army.fatigue - 0.15);
          army.morale = Math.min(1.0, army.morale + 0.06);
          const trainingRate = 0.03 + (kingdom.doctrine?.trainingBonus ?? 0.05);
          army.experience = Math.min(1.0, army.experience + trainingRate);

          for (const sId of army.soldierIds) {
            const s = world.entities.find(e => e.id === sId && e.hp > 0);
            if (s) s.gainXp(12);
          }
        } else if (army.state === 'marching' || army.state === 'besieging') {
          army.fatigue = Math.min(0.8, army.fatigue + 0.05);
        }
      }
    }
  }

  /** WAR-V6: Evolução da doutrina militar com base em tecnologias e vitórias. */
  public evolveDoctrine(kingdom: Kingdom, world: WarfareWorld): void {
    if (!kingdom.doctrine) return;

    const doc = kingdom.doctrine;
    const researched = kingdom.research.known;

    if (researched.has('gunpowder') && doc.type !== 'artillery_focus' && !doc.traditions.includes('siege_engineering')) {
      doc.traditions.push('siege_engineering');
      doc.evolvedFromTech = 'gunpowder';
      doc.preferredComposition.artillery = Math.min(0.35, doc.preferredComposition.artillery + 0.15);
      doc.preferredComposition.infantry = Math.max(0.25, doc.preferredComposition.infantry - 0.10);
    }

    if (researched.has('animal_husbandry') && researched.has('roads') && !doc.traditions.includes('heavy_cavalry') && doc.experienceLevel > 0.25) {
      doc.traditions.push('heavy_cavalry');
    }

    if (researched.has('metallurgy') && !doc.traditions.includes('phalanx')) {
      doc.traditions.push('phalanx');
    }

    if (kingdom.culture.militarism > 0.65 && !doc.traditions.includes('professional_army')) {
      doc.traditions.push('professional_army');
      doc.trainingBonus = Math.min(0.25, doc.trainingBonus + 0.05);
    }
  }

  private maintainMercenaries(world: WarfareWorld): void {
    if (this.mercenaryCompanies.size < 3 && rng.chance(0.4)) {
      this.spawnMercenaryCompany(world);
    }

    for (const company of this.mercenaryCompanies.values()) {
      if (!company.employerKingdomId) continue;
      const employer = world.kingdoms.get(company.employerKingdomId);

      const expired = company.contractEndYear !== null && world.year >= company.contractEndYear;
      const canAfford = employer && employer.economy.treasury >= company.annualFee;

      if (!employer || expired || !canAfford) {
        this.releaseMercenaryCompany(company.id, world, !canAfford ? 'inadimplência' : 'fim do contrato');
      } else {
        employer.economy.treasury -= company.annualFee;
        employer.treasury.take('gold', company.annualFee);
      }
    }
  }

  private spawnMercenaryCompany(world: WarfareWorld): MercenaryCompany {
    const NAMES = [
      'Companhia do Corvo Negro',
      'Lâminas Livres de Aethoria',
      'Guarda de Ferro Veterana',
      'Irmandade da Tempestade',
      'Legião dos Renegados',
      'Falcons do Sol'
    ];
    const TRAITS: CommanderTrait[] = ['tactician', 'valiant', 'fortifier', 'ruthless'];
    const chosenName = rng.pick(NAMES);
    const existing = [...this.mercenaryCompanies.values()].map(c => c.name);
    const name = existing.includes(chosenName) ? `${chosenName} ${rng.rangeInt(2, 5)}` : chosenName;

    const homeX = rng.rangeInt(10, world.tileMap.width - 10);
    const homeY = rng.rangeInt(10, world.tileMap.height - 10);
    const size = rng.rangeInt(6, 14);

    const company: MercenaryCompany = {
      id: nextId('merc'),
      name,
      bannerEmblem: rng.pick(['swords', 'shield', 'skull', 'fire']),
      captainName: `Capitão ${rng.pick(['Vane', 'Kael', 'Drakon', 'Boran', 'Garrick', 'Rowan'])}`,
      captainTrait: rng.pick(TRAITS),
      size,
      veteranLevel: rng.rangeInt(2, 5),
      hiringCost: size * 14 + 60,
      annualFee: size * 4 + 15,
      employerKingdomId: null,
      contractEndYear: null,
      homeX,
      homeY,
      armyId: null
    };

    this.mercenaryCompanies.set(company.id, company);
    return company;
  }

  public hireMercenaryCompany(companyId: string, kingdomId: string, durationYears: number, world: WarfareWorld): boolean {
    const company = this.mercenaryCompanies.get(companyId);
    const kingdom = world.kingdoms.get(kingdomId);
    if (!company || !kingdom || company.employerKingdomId) return false;

    if (kingdom.economy.treasury < company.hiringCost) return false;

    kingdom.economy.treasury -= company.hiringCost;
    kingdom.treasury.take('gold', company.hiringCost);
    company.employerKingdomId = kingdomId;
    company.contractEndYear = world.year + Math.max(1, durationYears);
    kingdom.mercenaryCompanyIds.add(company.id);

    const armyId = nextId('army');
    const homeCityId = kingdom.capitalCityId || [...kingdom.cityIds][0] || '';
    const army: Army = {
      id: armyId,
      name: `${company.name} [Mercenários]`,
      kingdomId,
      homeCityId,
      commanderId: null,
      commanderTrait: company.captainTrait,
      soldierIds: new Set(),
      targetCityId: null,
      targetPos: { x: company.homeX, y: company.homeY },
      state: 'marching',
      stance: 'aggressive',
      readiness: 1.0,
      morale: 0.95,
      fatigue: 0.0,
      experience: 0.6,
      composition: { infantry: 4, cavalry: 3, archers: 2, artillery: 1, militia: 0 },
      isMercenary: true,
      mercenaryCompanyId: company.id,
      createdYear: world.year
    };

    this.armies.set(armyId, army);
    kingdom.armyIds.add(armyId);
    company.armyId = armyId;

    chronicle.log(
      world.year,
      'kingdom',
      `${kingdom.name} contratou os serviços de ${company.name} (${company.size} veteranos sob o ${company.captainName}) por ${company.hiringCost} de ouro.`,
      {
        title: `Contratação Mercenária: ${company.name}`,
        importance: 'major',
        scope: 'international',
        refs: [{ kind: 'kingdom', id: kingdom.id, name: kingdom.name }],
        tags: ['mercenaries', 'contract', 'warfare']
      }
    );
    events.emit('mercenaryHired', { kingdom, company, year: world.year });
    return true;
  }

  public releaseMercenaryCompany(companyId: string, world: WarfareWorld, reason: string = 'fim do contrato'): void {
    const company = this.mercenaryCompanies.get(companyId);
    if (!company || !company.employerKingdomId) return;

    const employer = world.kingdoms.get(company.employerKingdomId);
    if (employer) {
      employer.mercenaryCompanyIds.delete(company.id);
      if (company.armyId) {
        this.armies.delete(company.armyId);
        employer.armyIds.delete(company.armyId);
      }
      chronicle.log(
        world.year,
        'kingdom',
        `O contrato de ${company.name} com ${employer.name} foi encerrado (${reason}).`,
        {
          title: `Fim do Contrato Mercenário`,
          importance: 'minor',
          scope: 'kingdom',
          refs: [{ kind: 'kingdom', id: employer.id, name: employer.name }],
          tags: ['mercenaries', 'contract-end']
        }
      );
    }

    company.employerKingdomId = null;
    company.contractEndYear = null;
    company.armyId = null;
    events.emit('mercenaryReleased', { company, employer, year: world.year });
  }

  private organizeKingdomArmies(world: WarfareWorld): void {
    for (const kingdom of world.kingdoms.values()) {
      const liveSoldiers = world.entities.filter(
        e => e.kingdomId === kingdom.id && e.hp > 0 && !e.isChild && e.profession === 'soldier'
      );

      for (const armyId of [...kingdom.armyIds]) {
        const army = this.armies.get(armyId);
        if (!army) {
          kingdom.armyIds.delete(armyId);
          continue;
        }
        if (army.isMercenary) continue;

        for (const sId of [...army.soldierIds]) {
          const s = world.entities.find(e => e.id === sId);
          if (!s || s.hp <= 0 || s.kingdomId !== kingdom.id) army.soldierIds.delete(sId);
        }

        if (army.soldierIds.size === 0) {
          this.armies.delete(armyId);
          kingdom.armyIds.delete(armyId);
        }
      }

      const unassigned = liveSoldiers.filter(s => !this.getArmyForSoldier(s.id));
      for (const s of unassigned) {
        let army = [...this.armies.values()].find(a => a.kingdomId === kingdom.id && !a.isMercenary && a.soldierIds.size < 20);
        if (!army) {
          const city = world.cities.get(s.cityId ?? '') ?? world.cities.get(kingdom.capitalCityId);
          const armyCount = [...this.armies.values()].filter(a => a.kingdomId === kingdom.id).length + 1;
          const armyName = `${armyCount}º Regimento de ${city?.name ?? kingdom.name}`;
          const armyId = nextId('army');
          army = {
            id: armyId,
            name: armyName,
            kingdomId: kingdom.id,
            homeCityId: city?.id ?? kingdom.capitalCityId,
            commanderId: null,
            commanderTrait: null,
            soldierIds: new Set(),
            targetCityId: null,
            targetPos: null,
            state: 'mustering',
            stance: 'aggressive',
            readiness: 0.5,
            morale: 0.9,
            fatigue: 0.0,
            experience: 0.1,
            createdYear: world.year
          };
          this.armies.set(armyId, army);
          kingdom.armyIds.add(armyId);
        }
        army.soldierIds.add(s.id);
      }

      for (const armyId of kingdom.armyIds) {
        const army = this.armies.get(armyId);
        if (!army || army.isMercenary) continue;
        army.composition = computeArmyComposition(army, world);

        if (!army.commanderId) {
          const veterans = [...army.soldierIds]
            .map(id => world.entities.find(e => e.id === id))
            .filter((e): e is Entity => !!e && e.hp > 0)
            .sort((a, b) => (b.level * 10 + b.kills * 5) - (a.level * 10 + a.kills * 5));

          if (veterans.length > 0) {
            const commander = this.appointCommander(veterans[0], kingdom, world.year);
            army.commanderId = commander.id;
            army.commanderTrait = commander.trait;
            kingdom.commanderIds.add(commander.id);
          }
        }
      }
    }
  }

  public appointCommander(soldier: Entity, kingdom: Kingdom, year: number, trait?: CommanderTrait): Commander {
    const TRAITS: CommanderTrait[] = ['tactician', 'valiant', 'fortifier', 'ruthless'];
    const chosenTrait = trait ?? (soldier.traits.has(TraitId.GENIUS) ? 'tactician' : soldier.traits.has(TraitId.GIANT) ? 'valiant' : rng.pick(TRAITS));
    const commanderId = nextId('cmd');
    const commander: Commander = {
      id: commanderId,
      entityId: soldier.id,
      name: soldier.fullName,
      kingdomId: kingdom.id,
      trait: chosenTrait,
      battlesWon: 0,
      battlesFought: 0,
      kills: soldier.kills,
      appointedYear: year
    };
    this.commanders.set(commanderId, commander);
    return commander;
  }

  public getArmyForSoldier(entityId: string): Army | null {
    for (const army of this.armies.values()) {
      if (army.soldierIds.has(entityId)) return army;
    }
    return null;
  }

  public getArmiesForKingdom(kingdomId: string): Army[] {
    return [...this.armies.values()].filter(a => a.kingdomId === kingdomId);
  }

  private planCampaigns(world: WarfareWorld): void {
    for (const kingdom of world.kingdoms.values()) {
      const wars = world.diplomacy.getWarsFor(kingdom.id);
      const armies = this.getArmiesForKingdom(kingdom.id);
      if (armies.length === 0) continue;

      if (wars.length === 0) {
        for (const army of armies) {
          army.state = 'garrisoned';
          army.targetCityId = army.homeCityId;
          const home = world.cities.get(army.homeCityId);
          if (home) army.targetPos = { x: home.x, y: home.y };
        }
        continue;
      }

      const homeUnderSiege = [...kingdom.cityIds]
        .map(id => world.cities.get(id))
        .find(c => c && c.besiegerId);

      const enemies = world.diplomacy.getEnemies(kingdom.id);

      for (const army of armies) {
        const liveCount = army.soldierIds.size;
        if (liveCount > 0 && liveCount <= 2 && !army.isMercenary) {
          army.state = 'retreating';
          army.targetCityId = army.homeCityId;
          const home = world.cities.get(army.homeCityId);
          if (home) army.targetPos = { x: home.x, y: home.y };
          continue;
        }

        if (homeUnderSiege) {
          army.state = 'defending';
          army.targetCityId = homeUnderSiege.id;
          army.targetPos = { x: homeUnderSiege.x, y: homeUnderSiege.y };
          continue;
        }

        const primaryWar = wars[0];
        let targetCity: City | null = null;

        if (primaryWar.goal.targetCityId) {
          targetCity = world.cities.get(primaryWar.goal.targetCityId) ?? null;
        }

        if (!targetCity || targetCity.kingdomId === kingdom.id) {
          targetCity = this.selectCampaignTarget(kingdom, enemies, primaryWar, world);
        }

        if (targetCity) {
          army.targetCityId = targetCity.id;
          army.targetPos = { x: targetCity.x, y: targetCity.y };

          const homeCity = world.cities.get(army.homeCityId);
          const refPos = homeCity ? { x: homeCity.x, y: homeCity.y } : { x: targetCity.x, y: targetCity.y };
          const dist = Math.hypot(refPos.x - targetCity.x, refPos.y - targetCity.y);

          if (dist <= SIEGE_RADIUS) {
            army.state = 'besieging';
          } else {
            army.state = 'marching';
          }
        }
      }
    }
  }

  private selectCampaignTarget(
    kingdom: Kingdom,
    enemyIds: string[],
    war: WarRecord,
    world: WarfareWorld
  ): City | null {
    const enemyCities = [...world.cities.values()].filter(
      c => c.kingdomId && enemyIds.includes(c.kingdomId)
    );
    if (enemyCities.length === 0) return null;

    const capital = world.cities.get(kingdom.capitalCityId);
    const kx = capital ? capital.x : 64;
    const ky = capital ? capital.y : 64;

    if (war.goal.kind === 'subjugation') {
      const enemyKingdom = world.kingdoms.get(war.defender === kingdom.id ? war.attacker : war.defender);
      if (enemyKingdom && enemyKingdom.capitalCityId) {
        const enemyCap = world.cities.get(enemyKingdom.capitalCityId);
        if (enemyCap && enemyCap.kingdomId === enemyKingdom.id) return enemyCap;
      }
    }

    if (war.goal.kind === 'resources' && war.goal.targetGoodId) {
      const good = war.goal.targetGoodId;
      const resourceCity = enemyCities.sort((a, b) => b.stock.get(good) - a.stock.get(good))[0];
      if (resourceCity && resourceCity.stock.get(good) > 10) return resourceCity;
    }

    return enemyCities.sort((a, b) => {
      const distA = Math.hypot(a.x - kx, a.y - ky) + a.defenseMultiplier() * 10;
      const distB = Math.hypot(b.x - kx, b.y - ky) + b.defenseMultiplier() * 10;
      return distA - distB;
    })[0] ?? null;
  }

  private applyMilitaryUpkeep(world: WarfareWorld): void {
    for (const kingdom of world.kingdoms.values()) {
      let activeSoldiers = 0;
      for (const armyId of kingdom.armyIds) {
        const army = this.armies.get(armyId);
        if (army && !army.isMercenary) activeSoldiers += army.soldierIds.size;
      }

      const goldUpkeep = activeSoldiers * 1;
      const foodUpkeep = activeSoldiers * 1;

      kingdom.militaryUpkeepGold = goldUpkeep;
      kingdom.militaryUpkeepFood = foodUpkeep;

      const hasGold = kingdom.economy.treasury >= goldUpkeep;
      const hasFood = kingdom.treasury.get('food') >= foodUpkeep;

      if (hasGold) {
        kingdom.economy.treasury -= goldUpkeep;
        kingdom.treasury.take('gold', goldUpkeep);
      } else {
        for (const armyId of kingdom.armyIds) {
          const army = this.armies.get(armyId);
          if (army) {
            army.morale = Math.max(0.3, army.morale - 0.15);
            army.readiness = Math.max(0.3, army.readiness - 0.1);
          }
        }
      }

      if (hasFood) {
        kingdom.treasury.take('food', foodUpkeep);
      }
    }
  }

  private resolveFieldBattles(world: WarfareWorld): void {
    const activeArmies = [...this.armies.values()].filter(a => a.soldierIds.size > 0 || a.isMercenary);

    for (let i = 0; i < activeArmies.length; i++) {
      for (let j = i + 1; j < activeArmies.length; j++) {
        const a1 = activeArmies[i];
        const a2 = activeArmies[j];
        if (a1.kingdomId === a2.kingdomId) continue;
        if (!world.diplomacy.isAtWar(a1.kingdomId, a2.kingdomId)) continue;

        const k1 = world.kingdoms.get(a1.kingdomId);
        const k2 = world.kingdoms.get(a2.kingdomId);
        if (!k1 || !k2) continue;

        const pos1 = a1.targetPos ?? { x: 64, y: 64 };
        const pos2 = a2.targetPos ?? { x: 64, y: 64 };
        const dist = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);

        if (dist <= FIELD_BATTLE_RADIUS) {
          this.clashFieldArmies(a1, a2, k1, k2, world);
        }
      }
    }
  }

  /**
   * WAR-V4: Resolução Tática de Batalha Campal
   * Executa as 3 fases táticas: Artilharia -> Arqueiros -> Choque/Cavalaria,
   * aplicando terreno, moral, fadiga, doutrinas e resolução de rota com perseguição.
   */
  private clashFieldArmies(a1: Army, a2: Army, k1: Kingdom, k2: Kingdom, world: WarfareWorld): void {
    const s1 = [...a1.soldierIds].map(id => world.entities.find(e => e.id === id)).filter((e): e is Entity => !!e && e.hp > 0);
    const s2 = [...a2.soldierIds].map(id => world.entities.find(e => e.id === id)).filter((e): e is Entity => !!e && e.hp > 0);

    const count1 = a1.isMercenary ? (this.mercenaryCompanies.get(a1.mercenaryCompanyId ?? '')?.size ?? 8) : s1.length;
    const count2 = a2.isMercenary ? (this.mercenaryCompanies.get(a2.mercenaryCompanyId ?? '')?.size ?? 8) : s2.length;
    if (count1 === 0 || count2 === 0) return;

    const battlePos = a1.targetPos ?? { x: 64, y: 64 };
    const terrain = getBattleTerrain(world.tileMap, battlePos.x, battlePos.y);

    const comp1 = a1.composition ?? computeArmyComposition(a1, world);
    const comp2 = a2.composition ?? computeArmyComposition(a2, world);

    const trad1 = new Set(k1.doctrine?.traditions ?? []);
    const trad2 = new Set(k2.doctrine?.traditions ?? []);

    // 1. Fase de Artilharia (Bombardeio pré-contato)
    const artMod1 = terrainCombatModifier(terrain, 'artillery') * (trad1.has('siege_engineering') ? 1.25 : 1.0);
    const artMod2 = terrainCombatModifier(terrain, 'artillery') * (trad2.has('siege_engineering') ? 1.25 : 1.0);
    const artPwr1 = comp1.artillery * 14 * artMod1;
    const artPwr2 = comp2.artillery * 14 * artMod2;

    // 2. Fase de Arqueiros (Barragem à distância)
    const archMod1 = terrainCombatModifier(terrain, 'archer') * (trad1.has('longbow_mastery') ? 1.25 : 1.0);
    const archMod2 = terrainCombatModifier(terrain, 'archer') * (trad2.has('longbow_mastery') ? 1.25 : 1.0);
    let archPwr1 = comp1.archers * 9 * archMod1;
    let archPwr2 = comp2.archers * 9 * archMod2;
    if (trad2.has('shield_wall')) archPwr1 *= 0.75;
    if (trad1.has('shield_wall')) archPwr2 *= 0.75;

    // 3. Fase de Infantaria & Flanqueamento de Cavalaria
    const infMod1 = terrainCombatModifier(terrain, 'infantry') * (trad1.has('shield_wall') ? 1.2 : 1.0) * (trad1.has('phalanx') ? 1.15 : 1.0);
    const infMod2 = terrainCombatModifier(terrain, 'infantry') * (trad2.has('shield_wall') ? 1.2 : 1.0) * (trad2.has('phalanx') ? 1.15 : 1.0);
    const infPwr1 = comp1.infantry * 8 * infMod1 + comp1.militia * 4 * (trad1.has('conscription') ? 1.2 : 0.9);
    const infPwr2 = comp2.infantry * 8 * infMod2 + comp2.militia * 4 * (trad2.has('conscription') ? 1.2 : 0.9);

    const cavMod1 = terrainCombatModifier(terrain, 'cavalry') * (trad1.has('heavy_cavalry') ? 1.3 : 1.0);
    const cavMod2 = terrainCombatModifier(terrain, 'cavalry') * (trad2.has('heavy_cavalry') ? 1.3 : 1.0);
    let cavPwr1 = comp1.cavalry * 11 * cavMod1;
    let cavPwr2 = comp2.cavalry * 11 * cavMod2;

    if (comp1.cavalry > comp2.infantry * 0.35) cavPwr1 *= 1.30;
    if (comp2.cavalry > comp1.infantry * 0.35) cavPwr2 *= 1.30;

    let pwr1 = (artPwr1 + archPwr1 + infPwr1 + cavPwr1 + 8) * k1.research.modifiers().military;
    let pwr2 = (artPwr2 + archPwr2 + infPwr2 + cavPwr2 + 8) * k2.research.modifiers().military;

    const moraleMod1 = Math.max(0.4, Math.min(1.4, a1.morale));
    const moraleMod2 = Math.max(0.4, Math.min(1.4, a2.morale));
    const fatigueMod1 = Math.max(0.5, 1.0 - a1.fatigue * 0.4);
    const fatigueMod2 = Math.max(0.5, 1.0 - a2.fatigue * 0.4);
    const expMod1 = 1.0 + a1.experience * 0.35;
    const expMod2 = 1.0 + a2.experience * 0.35;

    pwr1 *= moraleMod1 * fatigueMod1 * expMod1;
    pwr2 *= moraleMod2 * fatigueMod2 * expMod2;

    if (a1.commanderTrait === 'tactician') pwr1 *= 1.25;
    if (a1.commanderTrait === 'ruthless') pwr1 *= 1.35;
    if (a1.commanderTrait === 'valiant') pwr1 *= 1.30;
    if (a2.commanderTrait === 'tactician') pwr2 *= 1.25;
    if (a2.commanderTrait === 'ruthless') pwr2 *= 1.35;
    if (a2.commanderTrait === 'valiant') pwr2 *= 1.30;

    const total = pwr1 + pwr2;
    if (total <= 0) return;

    let casualties1 = Math.min(count1, Math.round(count1 * (pwr2 / total) * 0.42));
    let casualties2 = Math.min(count2, Math.round(count2 * (pwr1 / total) * 0.42));

    const winner = pwr1 >= pwr2 ? a1 : a2;
    const loser = winner === a1 ? a2 : a1;
    const winnerKingdom = winner === a1 ? k1 : k2;
    const loserKingdom = winner === a1 ? k2 : k1;
    const winnerComp = winner === a1 ? comp1 : comp2;

    winner.morale = Math.min(1.0, winner.morale + 0.08);
    winner.fatigue = Math.min(1.0, winner.fatigue + 0.15);
    winner.experience = Math.min(1.0, winner.experience + 0.08);
    if (winnerKingdom.doctrine) {
      winnerKingdom.doctrine.experienceLevel = Math.min(1.0, winnerKingdom.doctrine.experienceLevel + 0.05);
    }

    const loserLossRatio = (loser === a1 ? casualties1 : casualties2) / Math.max(1, (loser === a1 ? count1 : count2));
    loser.morale = Math.max(0.1, loser.morale - 0.25 - loserLossRatio * 0.35);
    loser.fatigue = Math.min(1.0, loser.fatigue + 0.22);

    const isRouted = loser.morale < 0.28;
    let pursuitCasualties = 0;

    if (isRouted && winnerComp.cavalry > 0) {
      const remainingLosers = Math.max(0, (loser === a1 ? count1 - casualties1 : count2 - casualties2));
      pursuitCasualties = Math.min(remainingLosers, Math.round(remainingLosers * 0.30));
      if (loser === a1) casualties1 += pursuitCasualties;
      else casualties2 += pursuitCasualties;
    }

    loser.state = 'retreating';

    for (let i = 0; i < Math.min(casualties1, s1.length); i++) s1[i].hp = 0;
    for (let i = 0; i < Math.min(casualties2, s2.length); i++) s2[i].hp = 0;

    world.diplomacy.recordBattle(k1.id, k2.id, casualties1, casualties2);

    const cmd1 = this.commanders.get(a1.commanderId ?? '');
    const cmd2 = this.commanders.get(a2.commanderId ?? '');
    if (cmd1) {
      cmd1.battlesFought++;
      if (winner === a1) cmd1.battlesWon++;
    }
    if (cmd2) {
      cmd2.battlesFought++;
      if (winner === a2) cmd2.battlesWon++;
    }

    const terrainName = terrain.toUpperCase();
    const outcomeText = isRouted
      ? `${loser.name} debandou em rota sob carga de perseguição (+${pursuitCasualties} baixas na fuga)!`
      : `${loser.name} executou uma retirada estratégica ordenada.`;

    chronicle.log(
      world.year,
      'war',
      `Batalha de ${terrainName}: ${a1.name} (${k1.name}) enfrentou ${a2.name} (${k2.name}). Baixas: ${casualties1} vs ${casualties2}. ${outcomeText}`,
      {
        title: `Batalha Campal em ${terrainName}`,
        importance: (casualties1 + casualties2) > 10 ? 'major' : 'notable',
        scope: 'international',
        refs: [
          { kind: 'kingdom', id: k1.id, name: k1.name },
          { kind: 'kingdom', id: k2.id, name: k2.name }
        ],
        tags: ['batalha campal', 'field-battle', isRouted ? 'rota' : 'retirada', 'war']
      }
    );
  }

  private gatherArmies(world: WarfareWorld): Map<string, Entity[]> {
    const armies = new Map<string, Entity[]>();

    for (const entity of world.entities) {
      if (!entity.kingdomId || entity.hp <= 0) continue;
      if (!SPECIES_DEFINITIONS[entity.species].isHumanoid) continue;
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

  private armyStrength(soldiers: Entity[], kingdom: Kingdom, attackingArmies?: Army[]): number {
    let raw = 0;
    for (const soldier of soldiers) {
      raw += soldier.damage + soldier.defense * 0.5 + soldier.level * 3;
    }
    const techMilitary = kingdom.research.modifiers().military;
    const govMilitary = GOVERNMENTS[kingdom.government].military;
    const morale = Math.max(0.5, 1 - kingdom.warWeariness / 220);

    let commanderMult = 1.0;
    if (attackingArmies) {
      for (const a of attackingArmies) {
        if (a.commanderTrait === 'tactician') commanderMult = Math.max(commanderMult, 1.25);
        if (a.commanderTrait === 'valiant') commanderMult = Math.max(commanderMult, 1.3);
        if (a.commanderTrait === 'ruthless') commanderMult = Math.max(commanderMult, 1.35);
      }
    }

    return raw * techMilitary * govMilitary * morale * commanderMult;
  }

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

      const attackingArmies = this.getArmiesForKingdom(kingdomId).filter(
        a => a.targetCityId === city.id || a.state === 'besieging'
      );

      const attackStrength = this.armyStrength(besiegers, attacker, attackingArmies);
      if (!best || attackStrength > best.attackStrength) {
        best = { besieger: attacker, attackStrength, defenceStrength: 0, besiegingArmies: attackingArmies };
      }
    }

    if (!best) return null;

    best.defenceStrength = this.defenceStrength(city, owner, armies, world);
    return best;
  }

  private defenceStrength(
    city: City,
    owner: Kingdom,
    armies: Map<string, Entity[]>,
    world?: WarfareWorld
  ): number {
    const garrison = (armies.get(owner.id) ?? []).filter(
      s => Math.hypot(s.x - city.x, s.y - city.y) <= SIEGE_RADIUS
    );

    const militia = city.population * 0.6;
    const garrisonStrength = this.armyStrength(garrison, owner);

    let commanderDefMult = 1.0;
    const defendingArmies = this.getArmiesForKingdom(owner.id).filter(a => a.homeCityId === city.id);
    for (const a of defendingArmies) {
      if (a.commanderTrait === 'fortifier') commanderDefMult = Math.max(commanderDefMult, 1.4);
      if (a.commanderTrait === 'valiant') commanderDefMult = Math.max(commanderDefMult, 1.2);
    }

    let defence = (garrisonStrength + militia) * city.defenseMultiplier() * commanderDefMult;

    if (world?.fronts?.isIsolated(city.id)) defence *= 0.62;

    return defence;
  }

  /**
   * WAR-V5: Sistema de Cercos Estruturados
   */
  private pressSiege(city: City, owner: Kingdom, assessment: SiegeAssessment, world: WarfareWorld): void {
    const { besieger, defenceStrength, besiegingArmies } = assessment;

    /**
     * A besieging army is only as strong as what reaches it.
     *
     * Siege resolution ignored `sector.supplyA/B` entirely: an army at the end of
     * a cut line bombarded, assaulted and starved a city out exactly as fast as
     * one with a working railhead behind it. Cutting a besieger's supply — the
     * single most decisive act in the history of siege warfare — did nothing.
     * At full supply this is 1 and changes nothing; at nothing it halves the
     * besieger's effective weight, which is what lets a defender break a siege by
     * severing the roads behind it instead of by winning at the walls.
     */
    const siegeSupply = world.fronts?.supplyNear(city, besieger.id) ?? 1;
    const supplyModifier = 0.5 + 0.5 * Math.max(0, Math.min(1, siegeSupply));
    const attackStrength = assessment.attackStrength * supplyModifier;

    if (city.besiegerId !== besieger.id || !city.siegeState) {
      city.besiegerId = besieger.id;
      city.siegeProgress = 0;
      city.siegeYears = 0;

      let siegeEngines = 0;
      for (const a of besiegingArmies) {
        const comp = a.composition ?? computeArmyComposition(a, world);
        siegeEngines += comp.artillery;
      }

      city.siegeState = {
        phase: 'encirclement',
        wallBreaches: 0,
        towersCaptured: 0,
        gatesForced: 0,
        siegeEnginesDeployed: siegeEngines,
        defenderFood: city.stock.get('food'),
        defenderMorale: 1.0,
        attackerMorale: 1.0,
        surrenderWillingness: 0,
        assaultAttempts: 0
      };

      const war = world.diplomacy.getWarsFor(besieger.id).find(w => w.attacker === owner.id || w.defender === owner.id);
      chronicle.log(
        world.year,
        'siege',
        `${besieger.name} iniciou o cerco militar de ${city.name}.`,
        {
          title: `Cerco de ${city.name}`,
          importance: city.id === owner.capitalCityId ? 'legendary' : 'major',
          scope: 'international',
          refs: [
            { kind: 'city', id: city.id, name: city.name },
            { kind: 'kingdom', id: besieger.id, name: besieger.name },
            { kind: 'kingdom', id: owner.id, name: owner.name },
            ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
          ],
          tags: ['siege', 'war', city.id === owner.capitalCityId ? 'capital' : 'city'],
          causes: [`${besieger.name} mobilizou tropas para isolar o assentamento.`],
          consequences: [`${city.name} foi cercada e cortada de rotas de suprimento.`],
          threadId: war ? `war:${war.id}` : `siege:${city.id}:${world.year}`,
          threadTitle: war?.reason ?? `Cerco de ${city.name}`,
          data: { attackStrength: Number(attackStrength.toFixed(2)), defenceStrength: Number(defenceStrength.toFixed(2)) }
        }
      );
      events.emit('siegeBegan', { city, besieger, defender: owner, year: world.year });
    }

    city.siegeYears++;
    const state = city.siegeState;

    let totalArtillery = 0;
    for (const a of besiegingArmies) {
      const comp = a.composition ?? computeArmyComposition(a, world);
      totalArtillery += comp.artillery;
    }
    state.siegeEnginesDeployed = totalArtillery;

    damageRoadsAround(world.tileMap, city.x, city.y, 5);
    damagePrimaryRoads(world.tileMap, city.x, city.y, 5);
    damageStrategicBuildings(city, world.tileMap, world.year);

    // Being cut off always unlocks the walls. The front's opinion on the
    // countryside only counts where there is a front: realms further apart than
    // the contact range form no sectors at all, and a gate that waits on an
    // absent front never opens, which left a besieger camped at 35% for the rest
    // of the world's life. Where the front is silent, the old siege rules stand.
    const isolated = !!world.fronts?.isIsolated(city.id);
    const groundTaken = world.fronts && world.fronts.coversCity(city, besieger.id)
      ? world.fronts.siegePressure(city, besieger.id) >= SIEGE_GATE_PUSH
      : true;
    const blockaded = isolated || groundTaken;

    if (!blockaded) {
      city.siegeProgress = Math.min(city.siegeProgress, 0.35);
      state.phase = 'encirclement';
      besieger.warWeariness = Math.min(100, besieger.warWeariness + 3);
      return;
    }

    // 1. Fase de Bombardeio / Quebra de Muralhas & Portões (WAR-V5)
    if (state.siegeEnginesDeployed > 0 || attackStrength > defenceStrength * 0.8) {
      state.phase = 'bombardment';

      const wallPieces = [...city.buildings.values()].filter(b => b.type === 'wall' || b.fortificationRole);
      const gates = wallPieces.filter(b => b.fortificationRole === 'gate' && b.hp > 0);
      const towers = wallPieces.filter(b => b.fortificationRole === 'tower' && b.hp > 0);
      const segments = wallPieces.filter(b => b.fortificationRole === 'segment' || !b.fortificationRole && b.hp > 0);

      const siegeDmg = (state.siegeEnginesDeployed * 45 + attackStrength * 0.15);

      if (gates.length > 0) {
        const targetGate = gates[0];
        targetGate.applyDamage(siegeDmg, world.year, 'war');
        if (targetGate.hp <= 0) {
          state.gatesForced++;
          chronicle.log(world.year, 'siege', `Os portões de ${city.name} foram rompidos pelo bombardeio de ${besieger.name}!`, {
            title: `Portões Rompidos em ${city.name}`,
            importance: 'major',
            scope: 'international',
            refs: [{ kind: 'city', id: city.id, name: city.name }]
          });
        }
      }

      if (towers.length > 0 && rng.chance(0.5)) {
        const targetTower = towers[0];
        targetTower.applyDamage(siegeDmg * 0.7, world.year, 'war');
        if (targetTower.hp <= 0) state.towersCaptured++;
      } else if (segments.length > 0) {
        const targetSegment = segments[0];
        targetSegment.applyDamage(siegeDmg * 0.8, world.year, 'war');
        if (targetSegment.hp <= 0) {
          state.wallBreaches++;
          chronicle.log(world.year, 'siege', `Uma brecha foi aberta nas muralhas de ${city.name} pelas forças de ${besieger.name}!`, {
            title: `Brecha nas Muralhas de ${city.name}`,
            importance: 'major',
            scope: 'international',
            refs: [{ kind: 'city', id: city.id, name: city.name }]
          });
        }
      }
    }

    // 2. Fase de Fome e Attrition (WAR-V5)
    city.prosperity = Math.max(0, city.prosperity - 0.08);
    const foodConsumed = city.stock.take('food', city.population * 0.35);
    city.ledger.recordConsumed('food', foodConsumed);
    state.defenderFood = city.stock.get('food');

    const starving = state.defenderFood <= 0 || city.siegeYears >= STARVATION_YEARS;
    if (starving) {
      state.phase = 'starvation';
      state.defenderMorale = Math.max(0.1, state.defenderMorale - 0.20);
      state.surrenderWillingness = Math.min(1.0, state.surrenderWillingness + 0.30);

      const starvationLosses = Math.max(1, Math.floor(city.population * 0.04));
      const citizens = world.entities.filter(e => e.cityId === city.id && e.hp > 0);
      for (let i = 0; i < Math.min(starvationLosses, citizens.length); i++) {
        citizens[i].hp = 0;
      }
    } else {
      state.surrenderWillingness = Math.min(1.0, state.surrenderWillingness + 0.06 * (state.wallBreaches + state.gatesForced));
    }

    if (city.siegeYears >= 2) {
      const friendlyCity = this.findNearestFriendlyCity(city, owner, world);
      if (friendlyCity) {
        const refugees = world.entities
          .filter(e => e.cityId === city.id && e.hp > 0 && !e.isChild && e.profession !== 'king')
          .slice(0, Math.ceil(city.population * 0.05));
        for (const refugee of refugees) {
          refugee.cityId = friendlyCity.id;
          refugee.targetX = friendlyCity.x;
          refugee.targetY = friendlyCity.y;
        }
      }
    }

    // 3. Condição de Rendição Negociada (WAR-V5)
    if (state.surrenderWillingness >= 0.80 || (state.defenderMorale <= 0.20 && state.defenderFood <= 0)) {
      state.phase = 'negotiation';
      this.surrenderCity(city, owner, besieger, world);
      return;
    }

    // 4. Tentativa de Assalto às Muralhas (WAR-V5)
    const canAssault = state.wallBreaches > 0 || state.gatesForced > 0 || attackStrength > defenceStrength * 1.6;
    if (canAssault) {
      state.phase = 'assault';
      state.assaultAttempts++;

      const breachReduction = Math.max(0.35, 1.0 - state.wallBreaches * 0.25 - state.gatesForced * 0.20);
      const effectiveDefence = defenceStrength * breachReduction * state.defenderMorale;

      let tacticianBonus = 0;
      for (const a of besiegingArmies) {
        if (a.commanderTrait === 'tactician') tacticianBonus = 0.15;
      }

      const advance = starving
        ? 0.35
        : Math.min(0.60, 0.12 + (attackStrength / Math.max(1, effectiveDefence) - 1.0) * 0.20 + tacticianBonus);

      city.siegeProgress = Math.min(1.0, city.siegeProgress + advance);

      if (city.siegeProgress >= 1.0) {
        this.captureCity(city, owner, besieger, world);
      }
    } else {
      // A besieger that cannot feed itself does not creep forward. Below a third
      // of its needs the camp is coming apart faster than the walls are.
      if (supplyModifier < 0.68) {
        city.siegeProgress = Math.max(0, city.siegeProgress - 0.06);
        besieger.warWeariness = Math.min(100, besieger.warWeariness + 4);
      } else {
        city.siegeProgress = Math.min(0.50, city.siegeProgress + 0.05);
      }
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
      `O cerco de ${city.name} foi rompido${besieger ? ` e ${besieger.name} recuou` : ''}.`,
      {
        title: `Alívio de ${city.name}`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'city', id: city.id, name: city.name },
          ...(besieger ? [{ kind: 'kingdom' as const, id: besieger.id, name: besieger.name }] : []),
          ...(defenderId ? [{ kind: 'kingdom' as const, id: defenderId }] : []),
          ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
        ],
        tags: ['siege', 'relief', 'war'],
        consequences: [`${city.name} escapou da captura imediata e o progresso do cerco foi zerado.`],
        threadId: war ? `war:${war.id}` : undefined,
        threadTitle: war?.reason
      }
    );
    events.emit('siegeLifted', { city, year: world.year });

    city.besiegerId = null;
    city.siegeProgress = 0;
    city.siegeYears = 0;
    city.siegeState = null;
  }

  /** WAR-V5: Rendição negociada da cidade (evita massacres e preserva infraestrutura). */
  public surrenderCity(city: City, from: Kingdom, to: Kingdom, world: WarfareWorld): void {
    const wasCapital = from.capitalCityId === city.id;
    const heldFor = Math.max(1, city.siegeYears);
    const war = world.diplomacy.getWarsFor(from.id).find(w => w.attacker === to.id || w.defender === to.id);

    for (const good of ALL_GOODS) {
      const looted = city.stock.take(good, city.stock.get(good) * 0.15);
      city.ledger.recordExported(good, looted);
      to.treasury.add(good, looted);
    }

    for (const building of city.buildings.values()) {
      const nextHp = Math.max(1, Math.round(building.hp * rng.range(0.90, 0.98)));
      building.applyDamage(building.hp - nextHp, world.year, 'war');
      world.tileMap.markRenderDirty(building.x, building.y);
    }

    from.removeCity(city.id);
    to.addCity(city.id);
    city.formerOwnerId = from.id;
    city.kingdomId = to.id;
    city.capturedYear = world.year;
    city.besiegerId = null;
    city.siegeProgress = 0;
    city.siegeYears = 0;
    city.siegeState = null;
    city.prosperity = Math.min(city.prosperity, 0.5);

    city.territory.forEachXY((tx, ty) => {
      const tile = world.tileMap.getTile(tx, ty);
      if (tile && tile.cityId === city.id) { tile.kingdomId = to.id; world.tileMap.markRenderDirty(tile.x, tile.y); }
    });

    for (const resident of world.entities) {
      if (resident.cityId !== city.id || resident.hp <= 0) continue;
      resident.kingdomId = to.id;
      if (resident.profession === 'king' && from.rulerId === resident.id) {
        resident.profession = 'none';
      }
    }

    chronicle.log(
      world.year,
      'conquest',
      `A guarnição de ${city.name} abriu seus portões e se rendeu honrosamente para ${to.name} após ${heldFor} anos de cerco.`,
      {
        title: `Rendição de ${city.name}`,
        importance: 'legendary',
        scope: 'international',
        refs: [
          { kind: 'city', id: city.id, name: city.name },
          { kind: 'kingdom', id: from.id, name: from.name },
          { kind: 'kingdom', id: to.id, name: to.name },
          ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
        ],
        tags: ['rendição', 'conquest', 'siege', 'negotiation', 'war'],
        causes: [`A falta de suprimentos e o bombardeio contínuo levaram à capitulação de ${city.name}.`],
        consequences: [`A soberania de ${city.name} foi transferida para ${to.name} sem massacre de civis.`]
      }
    );

    events.emit('cityCaptured', { city, from, to, year: world.year, wasCapital });
  }

  /** Captura violenta por assalto e tempestade às muralhas. */
  public captureCity(city: City, from: Kingdom, to: Kingdom, world: WarfareWorld): void {
    const wasCapital = from.capitalCityId === city.id;
    const heldFor = Math.max(1, city.siegeYears);
    const war = world.diplomacy.getWarsFor(from.id).find(w => w.attacker === to.id || w.defender === to.id);

    const casualties = Math.floor(city.population * rng.range(0.12, 0.3));
    const residents = world.entities.filter(e => e.cityId === city.id);
    for (let i = 0; i < Math.min(casualties, residents.length); i++) {
      residents[i].hp = 0;
    }

    from.culture.warTrauma = Math.min(1.0, from.culture.warTrauma + 0.12);
    to.culture.warTrauma = Math.min(1.0, to.culture.warTrauma + 0.05);

    const safeHaven = this.findNearestFriendlyCity(city, from, world);
    if (safeHaven) {
      const survivors = world.entities.filter(e => e.cityId === city.id && e.hp > 0 && e.profession !== 'king');
      const refugeeCount = Math.floor(survivors.length * 0.18);
      for (let i = 0; i < refugeeCount; i++) {
        survivors[i].cityId = safeHaven.id;
        survivors[i].kingdomId = from.id;
        survivors[i].targetX = safeHaven.x;
        survivors[i].targetY = safeHaven.y;
      }
    }

    for (const good of ALL_GOODS) {
      const looted = city.stock.take(good, city.stock.get(good) * 0.4);
      city.ledger.recordExported(good, looted);
      to.treasury.add(good, looted);
    }

    for (const building of city.buildings.values()) {
      const nextHp = Math.max(1, Math.round(building.hp * rng.range(0.4, 0.8)));
      building.applyDamage(building.hp - nextHp, world.year, 'war');
      world.tileMap.markRenderDirty(building.x, building.y);
    }

    damageRoadsAround(world.tileMap, city.x, city.y, 7);

    from.removeCity(city.id);
    to.addCity(city.id);
    city.formerOwnerId = from.id;
    city.kingdomId = to.id;
    city.capturedYear = world.year;
    city.besiegerId = null;
    city.siegeProgress = 0;
    city.siegeYears = 0;
    city.siegeState = null;
    city.prosperity = Math.min(city.prosperity, 0.3);

    city.territory.forEachXY((tx, ty) => {
      const tile = world.tileMap.getTile(tx, ty);
      if (tile && tile.cityId === city.id) { tile.kingdomId = to.id; world.tileMap.markRenderDirty(tile.x, tile.y); }
    });

    for (const resident of world.entities) {
      if (resident.cityId !== city.id || resident.hp <= 0) continue;
      resident.kingdomId = to.id;
      if (resident.profession === 'king' && from.rulerId === resident.id) {
        resident.profession = 'none';
      }
    }

    if (wasCapital && from.rulerId) {
      const ruler = world.entities.find(e => e.id === from.rulerId && e.hp > 0);
      if (ruler && ruler.cityId === city.id) {
        const killedInBattle = rng.chance(0.5);
        if (killedInBattle) {
          ruler.hp = 0;
          chronicle.log(
            world.year,
            'kingdom',
            `O governante ${ruler.name} caiu em combate defendendo a capital de ${from.name}!`,
            {
              title: `Morte do Governante ${ruler.name}`,
              importance: 'legendary',
              scope: 'world',
              refs: [
                { kind: 'kingdom', id: from.id, name: from.name },
                { kind: 'city', id: city.id, name: city.name }
              ],
              tags: ['morte do governante', 'queda da capital', 'legendary']
            }
          );
        } else {
          ruler.profession = 'none';
          ruler.kingdomId = to.id;
          chronicle.log(
            world.year,
            'kingdom',
            `O governante ${ruler.name} foi capturado quando ${city.name} caiu para ${to.name}.`,
            {
              title: `Governante ${ruler.name} Capturado`,
              importance: 'legendary',
              scope: 'world',
              refs: [
                { kind: 'kingdom', id: from.id, name: from.name },
                { kind: 'kingdom', id: to.id, name: to.name },
                { kind: 'city', id: city.id, name: city.name }
              ],
              tags: ['governante capturado', 'queda da capital', 'legendary']
            }
          );
        }
        from.rulerId = null;
      }
    }

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
          `${to.name} tomou a capital de ${from.name}! A corte foge para ${remaining.name}.`,
          {
            title: `Queda de ${city.name}`,
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
            causes: [`${city.name} caiu após ${heldFor} anos de cerco.`],
            consequences: [`${from.name} moveu sua corte para ${remaining.name}.`, `${city.name} passou para ${to.name}.`],
            threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
            threadTitle: war?.reason ?? `Queda de ${city.name}`,
            data: { siegeYears: heldFor, civilianCasualties: casualties }
          }
        );
      } else {
        chronicle.log(
          world.year,
          'conquest',
          `${to.name} tomou a última cidade de ${from.name}. O reino foi extinto.`,
          {
            title: `Extinção de ${from.name}`,
            importance: 'legendary',
            scope: 'world',
            refs: [
              { kind: 'city', id: city.id, name: city.name },
              { kind: 'kingdom', id: from.id, name: from.name },
              { kind: 'kingdom', id: to.id, name: to.name },
              ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
            ],
            tags: ['última cidade', 'extinção de reino', 'conquest'],
            causes: [`${city.name}, o último assentamento de ${from.name}, foi capturado.`],
            consequences: [`${from.name} foi completamente anexado.`],
            threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
            threadTitle: war?.reason ?? `Queda de ${from.name}`,
            data: { siegeYears: heldFor, civilianCasualties: casualties }
          }
        );
      }
    } else {
      chronicle.log(
        world.year,
        'conquest',
        `${to.name} capturou ${city.name} de ${from.name} após um cerco de ${heldFor} anos.`,
        {
          title: `Captura de ${city.name}`,
          importance: 'major',
          scope: 'international',
          refs: [
            { kind: 'city', id: city.id, name: city.name },
            { kind: 'kingdom', id: from.id, name: from.name },
            { kind: 'kingdom', id: to.id, name: to.name },
            ...(war ? [{ kind: 'war' as const, id: war.id, name: war.reason }] : [])
          ],
          tags: ['conquest', 'siege', 'war'],
          causes: [`${city.name} caiu após ${heldFor} anos de cerco.`],
          consequences: [`O assentamento mudou de lealdade de ${from.name} para ${to.name}.`],
          threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
          threadTitle: war?.reason ?? `Captura de ${city.name}`,
          data: { siegeYears: heldFor, civilianCasualties: casualties }
        }
      );
    }

    to.warWeariness = Math.min(100, to.warWeariness + 8);
    world.diplomacy.changeRelation(from.id, to.id, -25);
    events.emit('cityCaptured', { city, from, to, year: world.year, wasCapital });
  }

  private updateWarGoalsProgress(world: WarfareWorld): void {
    for (const war of world.diplomacy.activeWars.values()) {
      const attacker = world.kingdoms.get(war.attacker);
      const defender = world.kingdoms.get(war.defender);
      if (!attacker || !defender) continue;

      let progress = 0;
      switch (war.goal.kind) {
        case 'conquest': {
          if (war.goal.targetCityId) {
            const target = world.cities.get(war.goal.targetCityId);
            if (target && target.kingdomId === attacker.id) progress = 1.0;
            else if (target && target.besiegerId === attacker.id) progress = 0.5 + target.siegeProgress * 0.4;
          } else {
            const capturedCount = [...attacker.cityIds].map(id => world.cities.get(id)).filter(c => c && c.formerOwnerId === defender.id).length;
            progress = Math.min(1.0, capturedCount * 0.5);
          }
          break;
        }
        case 'subjugation': {
          const defenderCap = world.cities.get(defender.capitalCityId);
          if (defenderCap && defenderCap.kingdomId === attacker.id) progress = 1.0;
          else if (defender.computePower() < attacker.computePower() * 0.3) progress = 0.85;
          break;
        }
        case 'independence': {
          if (defender.warWeariness > 60 || (world.year - war.startYear >= 5 && !attacker.cityIds.has(defender.capitalCityId))) {
            progress = 1.0;
          }
          break;
        }
        case 'defense': {
          if (attacker.warWeariness > 50 && war.defenderKills >= war.attackerKills) progress = 1.0;
          break;
        }
        case 'resources': {
          const good = war.goal.targetGoodId;
          if (good && attacker.treasury.get(good) > 100) progress = 1.0;
          break;
        }
        default:
          progress = 0.5;
          break;
      }
      war.goal.progress = Number(progress.toFixed(2));

      if (progress >= 1.0 && world.year - war.startYear >= 2) {
        // A war fought to subjugate ends in subjugation.
        //
        // `subjugation` had a name, a description, a target-selection rule that
        // marched armies on the enemy capital, and a completion check — and then
        // settled as an ordinary victory. `overlordId` and `vassalIds` were never
        // written, so no realm in the world's history was ever made a vassal by
        // being beaten: the only path into vassalage was the voluntary-fealty
        // roll, which needs a friendly relation. Conquest and tribute were two
        // systems that could not reach each other.
        if (war.goal.kind === 'subjugation') this.imposeVassalage(attacker, defender, world);
        world.diplomacy.settleWar(war.attacker, war.defender, world.year, 'victory', war.attacker, -15, 6);
      }
    }
  }

  /**
   * Binds a beaten realm to its conqueror as a tributary.
   *
   * The overlord inherits any vassals the loser held — a defeated empire's
   * subjects pass with it rather than being freed by their master's defeat — and
   * the loser is released from anyone it was itself sworn to, because it cannot
   * owe fealty to two crowns.
   */
  private imposeVassalage(overlord: Kingdom, vassal: Kingdom, world: WarfareWorld): void {
    if (overlord.id === vassal.id) return;
    // A realm cannot be made vassal of its own vassal, and a chain cannot loop.
    if (overlord.overlordId === vassal.id) return;
    if (vassal.vassalIds.has(overlord.id)) vassal.vassalIds.delete(overlord.id);

    const formerOverlord = vassal.overlordId ? world.kingdoms.get(vassal.overlordId) : null;
    formerOverlord?.vassalIds.delete(vassal.id);

    vassal.overlordId = overlord.id;
    overlord.vassalIds.add(vassal.id);

    for (const subId of [...vassal.vassalIds]) {
      if (subId === overlord.id) continue;
      const sub = world.kingdoms.get(subId);
      if (!sub) { vassal.vassalIds.delete(subId); continue; }
      sub.overlordId = overlord.id;
      overlord.vassalIds.add(subId);
      vassal.vassalIds.delete(subId);
    }

    vassal.legitimacy = Math.max(0, vassal.legitimacy - 0.18);
    world.diplomacy.setRelation(overlord.id, vassal.id, -5);

    chronicle.log(
      world.year,
      'conquest',
      `${vassal.name} capitulou e jurou vassalagem tributária a ${overlord.name}.`,
      {
        title: `Subjugação de ${vassal.name}`,
        importance: 'legendary',
        scope: 'international',
        refs: [
          { kind: 'kingdom', id: overlord.id, name: overlord.name },
          { kind: 'kingdom', id: vassal.id, name: vassal.name }
        ],
        tags: ['conquest', 'vassalage', 'war'],
        causes: ['A guerra de subjugação atingiu seu objetivo.'],
        consequences: [
          `${vassal.name} passa a pagar tributo anual a ${overlord.name}.`,
          'A legitimidade da coroa vencida foi abalada pela capitulação.'
        ],
        threadId: `vassalage:${vassal.id}`,
        threadTitle: `Vassalagem de ${vassal.name}`
      }
    );
    events.emit('vassalageSworn', { overlord, vassal, year: world.year });
  }

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

  public settlePeace(a: Kingdom, b: Kingdom, world: WarfareWorld): void {
    const aPower = a.computePower();
    const bPower = b.computePower();
    const ratio = aPower / Math.max(1, bPower);

    const dominant = ratio > 2 ? a : ratio < 0.5 ? b : null;
    if (!dominant) return;

    const loser = dominant === a ? b : a;
    if (loser.cityIds.size <= 1) return;

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

    const reparationRate = Math.round(loser.economy.treasury * 0.15 + 20);
    loser.warReparations = {
      creditorId: dominant.id,
      annualAmount: reparationRate,
      endYear: world.year + 10
    };

    chronicle.log(
      world.year,
      'kingdom',
      `Como parte do tratado de paz, ${loser.name} concordou em pagar reparações de guerra anuais para ${dominant.name} por 10 anos.`,
      {
        title: `Reparações de Guerra Impostas`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'kingdom', id: loser.id, name: loser.name },
          { kind: 'kingdom', id: dominant.id, name: dominant.name }
        ],
        tags: ['tratado de paz', 'reparations', 'treasury']
      }
    );

    if (closestDistance > 60) return;
    this.cedeCity(closest, loser, dominant, world);
  }

  private findNearestFriendlyCity(city: City, kingdom: Kingdom, world: WarfareWorld): City | null {
    let closest: City | null = null;
    let minDistance = Infinity;

    for (const cityId of kingdom.cityIds) {
      if (cityId === city.id) continue;
      const other = world.cities.get(cityId);
      if (!other || other.besiegerId) continue;
      const dist = Math.hypot(other.x - city.x, other.y - city.y);
      if (dist < minDistance) {
        minDistance = dist;
        closest = other;
      }
    }
    return closest;
  }

  private cedeCity(city: City, from: Kingdom, to: Kingdom, world: WarfareWorld): void {
    from.removeCity(city.id);
    to.addCity(city.id);
    city.formerOwnerId = from.id;
    city.kingdomId = to.id;
    city.capturedYear = world.year;
    city.prosperity = Math.min(city.prosperity, 0.45);

    city.territory.forEachXY((tx, ty) => {
      const tile = world.tileMap.getTile(tx, ty);
      if (tile && tile.cityId === city.id) { tile.kingdomId = to.id; world.tileMap.markRenderDirty(tile.x, tile.y); }
    });

    for (const resident of world.entities) {
      if (resident.cityId === city.id && resident.hp > 0) resident.kingdomId = to.id;
    }

    const recentWar = [...world.diplomacy.warHistory]
      .reverse()
      .find(w => w.endYear === world.year && ((w.attacker === from.id && w.defender === to.id) || (w.attacker === to.id && w.defender === from.id)));
    chronicle.log(
      world.year,
      'conquest',
      `No tratado de paz, ${from.name} cedeu ${city.name} para ${to.name}.`,
      {
        title: `Cessão de ${city.name}`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'city', id: city.id, name: city.name },
          { kind: 'kingdom', id: from.id, name: from.name },
          { kind: 'kingdom', id: to.id, name: to.name },
          ...(recentWar ? [{ kind: 'war' as const, id: recentWar.id, name: recentWar.reason }] : [])
        ],
        tags: ['tratado de paz', 'cession', 'territory'],
        causes: ['Um acordo de paz exigiu concessões territoriais.'],
        consequences: [`${city.name} mudou de soberania sem ser tomada à força.`],
        threadId: recentWar ? `war:${recentWar.id}` : undefined,
        threadTitle: recentWar?.reason
      }
    );
    events.emit('cityCeded', { city, from, to, year: world.year });
  }

  public serialize(): any {
    return {
      armies: Array.from(this.armies.values()).map(a => ({
        ...a,
        soldierIds: Array.from(a.soldierIds)
      })),
      commanders: Array.from(this.commanders.values()),
      mercenaries: Array.from(this.mercenaryCompanies.values()),
      settledWars: Array.from(this.settledWars)
    };
  }

  public deserialize(data: any): void {
    this.armies.clear();
    for (const a of data?.armies ?? []) {
      this.armies.set(a.id, {
        ...a,
        fatigue: a.fatigue ?? 0,
        experience: a.experience ?? 0.1,
        soldierIds: new Set(a.soldierIds ?? [])
      });
    }

    this.commanders.clear();
    for (const c of data?.commanders ?? []) {
      this.commanders.set(c.id, c);
    }

    this.mercenaryCompanies.clear();
    for (const m of data?.mercenaries ?? []) {
      this.mercenaryCompanies.set(m.id, m);
    }

    this.settledWars = new Set(data?.settledWars ?? []);
  }
}
