import { City } from './City';
import { Kingdom } from './Kingdom';
import { Entity } from '../entities/Entity';
import { SPECIES_DEFINITIONS } from '../entities/Species';
import { GOVERNMENTS } from './Government';
import { DiplomacyManager, WarRecord } from './Diplomacy';
import { TileMap } from '../world/TileMap';
import { chronicle } from './Chronicle';
import { events } from '../core/EventBus';
import { rng, nextId } from '../core/Random';
import { ALL_GOODS } from './Goods';
import { TraitId } from '../entities/Traits';
import { damageRoadsAround, damageRailAround, damagePrimaryRoads, damageStrategicBuildings } from './Infrastructure';

/**
 * WAR-V1 — Estratégia Militar e Resolução Tática de Conflitos
 *
 * A guerra deixa de ser um mero passeio caótico de soldados e passa a ser
 * uma decisão estratégica: formação de exércitos em regimentos, liderança de
 * generais com traços táticos, companhias mercenárias contratáveis, campanhas
 * de invasão coordenadas por objetivos de guerra (War Goals) e batalhas campais.
 */

export const SIEGE_RADIUS = 7;
const SIEGE_THRESHOLD = 1.0;
const STARVATION_YEARS = 8;
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
}

interface SiegeAssessment {
  besieger: Kingdom;
  attackStrength: number;
  defenceStrength: number;
  besiegingArmies: Army[];
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
      if (unassigned.length > 0) {
        let army = [...this.armies.values()].find(a => a.kingdomId === kingdom.id && !a.isMercenary && a.soldierIds.size < 20);
        if (!army) {
          const city = world.cities.get(unassigned[0].cityId ?? '') ?? world.cities.get(kingdom.capitalCityId);
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
            createdYear: world.year
          };
          this.armies.set(armyId, army);
          kingdom.armyIds.add(armyId);
        }

        for (const s of unassigned) {
          army.soldierIds.add(s.id);
        }
      }

      for (const armyId of kingdom.armyIds) {
        const army = this.armies.get(armyId);
        if (!army || army.isMercenary) continue;
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

  private clashFieldArmies(a1: Army, a2: Army, k1: Kingdom, k2: Kingdom, world: WarfareWorld): void {
    const s1 = [...a1.soldierIds].map(id => world.entities.find(e => e.id === id)).filter((e): e is Entity => !!e && e.hp > 0);
    const s2 = [...a2.soldierIds].map(id => world.entities.find(e => e.id === id)).filter((e): e is Entity => !!e && e.hp > 0);

    const count1 = a1.isMercenary ? (this.mercenaryCompanies.get(a1.mercenaryCompanyId ?? '')?.size ?? 8) : s1.length;
    const count2 = a2.isMercenary ? (this.mercenaryCompanies.get(a2.mercenaryCompanyId ?? '')?.size ?? 8) : s2.length;

    let pwr1 = (count1 * 8) * a1.morale * k1.research.modifiers().military;
    let pwr2 = (count2 * 8) * a2.morale * k2.research.modifiers().military;

    if (a1.commanderTrait === 'tactician') pwr1 *= 1.25;
    if (a1.commanderTrait === 'ruthless') pwr1 *= 1.35;
    if (a2.commanderTrait === 'tactician') pwr2 *= 1.25;
    if (a2.commanderTrait === 'ruthless') pwr2 *= 1.35;

    const total = pwr1 + pwr2;
    if (total <= 0) return;

    const casualties1 = Math.min(count1, Math.round(count1 * (pwr2 / total) * 0.45));
    const casualties2 = Math.min(count2, Math.round(count2 * (pwr1 / total) * 0.45));

    for (let i = 0; i < Math.min(casualties1, s1.length); i++) s1[i].hp = 0;
    for (let i = 0; i < Math.min(casualties2, s2.length); i++) s2[i].hp = 0;

    world.diplomacy.recordBattle(k1.id, k2.id, casualties1, casualties2);

    const winner = pwr1 >= pwr2 ? a1 : a2;
    const loser = winner === a1 ? a2 : a1;
    loser.morale = Math.max(0.2, loser.morale - 0.3);
    loser.state = 'retreating';

    chronicle.log(
      world.year,
      'war',
      `Batalha Campal: ${a1.name} (${k1.name}) enfrentou ${a2.name} (${k2.name}). Baixas: ${casualties1} vs ${casualties2}.`,
      {
        title: `Batalha Campal`,
        importance: 'major',
        scope: 'international',
        refs: [
          { kind: 'kingdom', id: k1.id, name: k1.name },
          { kind: 'kingdom', id: k2.id, name: k2.name }
        ],
        tags: ['batalha campal', 'field-battle', 'war']
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

    best.defenceStrength = this.defenceStrength(city, owner, armies);
    return best;
  }

  private defenceStrength(city: City, owner: Kingdom, armies: Map<string, Entity[]>): number {
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

    return (garrisonStrength + militia) * city.defenseMultiplier() * commanderDefMult;
  }

  private pressSiege(city: City, owner: Kingdom, assessment: SiegeAssessment, world: WarfareWorld): void {
    const { besieger, attackStrength, defenceStrength, besiegingArmies } = assessment;

    if (city.besiegerId !== besieger.id) {
      city.besiegerId = besieger.id;
      city.siegeProgress = 0;
      city.siegeYears = 0;
      const war = world.diplomacy.getWarsFor(besieger.id).find(w => w.attacker === owner.id || w.defender === owner.id);
      chronicle.log(
        world.year,
        'siege',
        `${besieger.name} iniciou o cerco coordenado de ${city.name}.`,
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
          causes: [`${besieger.name} concentrou regimentos militares para cercar o assentamento.`],
          consequences: [`${city.name} foi cercada e cortada de rotas de suprimento.`],
          threadId: war ? `war:${war.id}` : `siege:${city.id}:${world.year}`,
          threadTitle: war?.reason ?? `Cerco de ${city.name}`,
          data: { attackStrength: Number(attackStrength.toFixed(2)), defenceStrength: Number(defenceStrength.toFixed(2)) }
        }
      );
      events.emit('siegeBegan', { city, besieger, defender: owner, year: world.year });
    }

    city.siegeYears++;

    damageRoadsAround(world.tileMap, city.x, city.y, 5);
    damagePrimaryRoads(world.tileMap, city.x, city.y, 5);
    damageRailAround(world.tileMap, city.x, city.y, 5);
    damageStrategicBuildings(city, world.tileMap, world.year);

    const starving = city.siegeYears >= STARVATION_YEARS;
    const ratio = attackStrength / Math.max(1, defenceStrength);

    if (ratio < SIEGE_THRESHOLD && !starving) {
      city.siegeProgress = Math.max(0, city.siegeProgress - 0.05);
      besieger.warWeariness = Math.min(100, besieger.warWeariness + 6);
      return;
    }

    let tacticianBonus = 0;
    for (const a of besiegingArmies) {
      if (a.commanderTrait === 'tactician') tacticianBonus = 0.08;
    }

    const advance = starving
      ? 0.25
      : Math.min(0.55, 0.08 + (ratio - SIEGE_THRESHOLD) * 0.16 + tacticianBonus);

    city.siegeProgress += advance;
    city.prosperity = Math.max(0, city.prosperity - 0.08);
    city.ledger.recordConsumed('food', city.stock.take('food', city.population * 0.3));

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
  }

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
    damageRailAround(world.tileMap, city.x, city.y, 7);

    from.removeCity(city.id);
    to.addCity(city.id);
    city.formerOwnerId = from.id;
    city.kingdomId = to.id;
    city.capturedYear = world.year;
    city.besiegerId = null;
    city.siegeProgress = 0;
    city.siegeYears = 0;
    city.prosperity = Math.min(city.prosperity, 0.3);

    for (const key of city.territory) {
      const [tx, ty] = key.split(',').map(Number);
      const tile = world.tileMap.getTile(tx, ty);
      if (tile && tile.cityId === city.id) { tile.kingdomId = to.id; world.tileMap.markRenderDirty(tile.x, tile.y); }
    }

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
        world.diplomacy.settleWar(war.attacker, war.defender, world.year, 'victory', war.attacker, -15, 6);
      }
    }
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

    for (const key of city.territory) {
      const [tx, ty] = key.split(',').map(Number);
      const tile = world.tileMap.getTile(tx, ty);
      if (tile && tile.cityId === city.id) { tile.kingdomId = to.id; world.tileMap.markRenderDirty(tile.x, tile.y); }
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
