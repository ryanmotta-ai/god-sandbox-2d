import { TileMap } from '../world/TileMap';
import { SimulationEngine } from '../ai/EntityAI';
import { chronicle } from '../civ/Chronicle';
import { EraManager, WorldEra } from '../world/WeatherEras';
import { Entity } from '../entities/Entity';
import { City } from '../civ/City';
import { Kingdom } from '../civ/Kingdom';
import { Household } from '../civ/Household';
import { createNeeds } from '../entities/Needs';
import {
  SAVE_FORMAT_VERSION,
  parseSaveDocument,
  serializeSaveDocument,
  type SaveMetadataInput
} from '../platform/saveFormat';
import { getSaveStorage } from '../platform/storage';
import { readLegacyWebSave, writeLegacyWebSave } from '../platform/storage/legacyWebSave';

/** Slot 0 is reserved for autosave; 1..4 are manual. */
export const AUTOSAVE_SLOT = 0;
export const SLOT_COUNT = 5;

export interface SlotMeta extends SaveMetadataInput {
  name: string;
}

export interface SlotInfo {
  slot: number;
  exists: boolean;
  name: string;
  year: number;
  era: string;
  size: number;
  population: number;
  kingdoms: number;
  timestamp: number;
  thumbnail?: string;
  corrupted?: boolean;
  error?: string;
}

export class SaveSystem {
  // ============================ SLOTS ============================

  public static async listSlots(): Promise<SlotInfo[]> {
    const descriptors = await getSaveStorage().list();
    const bySlot = new Map(descriptors.map(descriptor => [descriptor.slot, descriptor]));
    return Array.from({ length: SLOT_COUNT }, (_, slot) => {
      const descriptor = bySlot.get(slot);
      if (!descriptor) return this.emptySlotInfo(slot);
      if (!descriptor.valid || !descriptor.metadata) {
        return {
          ...this.emptySlotInfo(slot),
          exists: true,
          name: 'Save corrompido',
          timestamp: descriptor.modifiedAt,
          corrupted: true,
          error: descriptor.error
        };
      }

      const metadata = descriptor.metadata;
      return {
        slot,
        exists: true,
        name: metadata.worldName || `Mundo ${slot}`,
        year: metadata.simulationYear ?? 0,
        era: metadata.era ?? '—',
        size: metadata.worldDimensions?.width ?? 0,
        population: metadata.population ?? 0,
        kingdoms: metadata.kingdoms ?? 0,
        timestamp: metadata.timestamp || descriptor.modifiedAt,
        thumbnail: metadata.thumbnail
      };
    });
  }

  public static async readSlotInfo(slot: number): Promise<SlotInfo> {
    return (await this.listSlots())[slot] ?? this.emptySlotInfo(slot);
  }

  private static emptySlotInfo(slot: number): SlotInfo {
    return {
      slot,
      exists: false,
      name: 'Vazio',
      year: 0,
      era: '—',
      size: 0,
      population: 0,
      kingdoms: 0,
      timestamp: 0
    };
  }

  public static async readSlot(slot: number): Promise<any | null> {
    const serialized = await getSaveStorage().load(slot);
    return serialized ? parseSaveDocument(serialized).payload : null;
  }

  public static async writeSlot(slot: number, data: any, meta: SlotMeta): Promise<void> {
    await getSaveStorage().save(slot, serializeSaveDocument(data, meta));
  }

  public static async deleteSlot(slot: number): Promise<void> {
    await getSaveStorage().delete(slot);
  }

  /** Returns a complete `.aethoria` document for the UI to download/share. */
  public static async exportSlot(slot: number): Promise<string | null> {
    return getSaveStorage().exportSave(slot);
  }

  /** Validates a portable `.aethoria` document before it can replace a slot. */
  public static async importSlot(slot: number, serialized: string): Promise<void> {
    parseSaveDocument(serialized);
    await getSaveStorage().importSave(slot, serialized);
  }

  public static serializePortableSave(data: any, meta: SlotMeta): string {
    return serializeSaveDocument(data, meta);
  }

  public static parsePortableSave(serialized: string): any {
    return parseSaveDocument(serialized).payload;
  }

  // ============================ LEGACY QUICK SAVE ============================

  public static saveToLocalStorage(tileMap: TileMap, sim: SimulationEngine, eraMgr: EraManager): void {
    const saveData = this.exportSaveData(tileMap, sim, eraMgr);
    writeLegacyWebSave(JSON.stringify(saveData));
  }

  public static loadFromLocalStorage(tileMap: TileMap, sim: SimulationEngine, eraMgr: EraManager): boolean {
    const json = readLegacyWebSave();
    if (!json) return false;
    try {
      const data = JSON.parse(json);
      this.importSaveData(data, tileMap, sim, eraMgr);
      return true;
    } catch (e) {
      console.error('Failed to load save:', e);
      return false;
    }
  }

  // ============================ SERIALIZATION ============================

  public static exportSaveData(tileMap: TileMap, sim: SimulationEngine, eraMgr: EraManager): any {
    return {
      version: SAVE_FORMAT_VERSION,
      timestamp: Date.now(),
      world: tileMap.serialize(),
      year: sim.currentYear,
      era: eraMgr.getCurrentEra(),
      totalBirths: sim.totalBirths,
      totalDeaths: sim.totalDeaths,
      history: chronicle.serialize(),
      diplomacy: sim.diplomacy.serialize(),
      entities: sim.entities.map(e => ({
        id: e.id,
        name: e.name,
        species: e.species,
        age: e.age,
        gender: e.gender,
        x: e.x,
        y: e.y,
        hp: e.hp,
        level: e.level,
        xp: e.xp,
        kills: e.kills,
        traits: Array.from(e.traits),
        profession: e.profession,
        personality: e.personality,
        cityId: e.cityId,
        kingdomId: e.kingdomId,
        isFavorite: e.isFavorite,
        // Family and bloodline. Without these a reloaded world forgets every
        // marriage, every child and every dynasty it ever produced.
        fatherId: e.fatherId,
        motherId: e.motherId,
        partnerId: e.partnerId,
        childrenIds: e.childrenIds,
        dynasty: e.dynasty,
        generation: e.generation,
        fertilityCooldown: e.fertilityCooldown,
        // Great-person standing
        isGreatPerson: e.isGreatPerson,
        greatPersonType: e.greatPersonType,
        title: e.title,
        equipment: e.equipment,
        workplaceId: e.workplaceId,
        aboardFleetId: e.aboardFleetId,
        homeX: e.homeX,
        homeY: e.homeY,
        energy: e.energy,
        // Identity. A reloaded citizen must still know where they came from,
        // where they live and what they own.
        birthYear: e.birthYear,
        birthCityId: e.birthCityId,
        birthCityName: e.birthCityName,
        homeBuildingId: e.homeBuildingId,
        householdId: e.householdId,
        wealth: e.wealth,
        // Needs and the load in hand, so a reloaded citizen is still as hungry
        // and as loaded as they were when the game was saved.
        needs: e.needs,
        starvingDays: e.starvingDays,
        carrying: e.carrying,
        // A pregnancy in progress. Without these three fields every expectant
        // mother in the world miscarried on load, the father's line was lost
        // even when he was alive, and a posthumous child born after a reload was
        // fathered by nobody and given a placeholder ancestor.
        pregnancyTimer: e.pregnancyTimer,
        pregnantFatherId: e.pregnantFatherId,
        // SOC-V2. Disposition, memory and relations are the person, not a cache —
        // a reload that regenerated them would hand the player a settlement of
        // strangers wearing the same names.
        psyche: e.psyche,
        memories: e.memories,
        bonds: e.bonds,
        // SOC-V3 lineage. Where the family is from, how deep it is where it
        // lives, what it does and whether history should keep it. All four are
        // inherited rather than observed, so none can be rebuilt on load.
        originCityId: e.originCityId,
        originCityName: e.originCityName,
        localGenerations: e.localGenerations,
        familyTrade: e.familyTrade,
        historic: e.historic,
        // CULT-V1. Identity is carried by the person; the settlement's share
        // table is a cache and is rebuilt by the first census after load.
        cultureId: e.cultureId,
        localAffinity: e.localAffinity,
        // Derived, and normally it would not be saved. It is here because
        // colonisation reads it to choose who emigrates, and a world reloaded in
        // midwinter must send the same people out as the one that was saved.
        migrationUrge: e.migrationUrge
      })),
      households: Array.from(sim.households.values()).map(h => h.serialize()),
      cultures: sim.cultures.serialize(),
      cities: Array.from(sim.cities.values()).map(c => c.serialize()),
      kingdoms: Array.from(sim.kingdoms.values()).map(k => k.serialize()),
      warfare: sim.warfare.serialize(),
      market: sim.market.serialize(),
      // WAR-V2: a front's position is progress, not a derived value — a war
      // reloaded mid-campaign must resume where the lines actually were.
      fronts: sim.fronts.serialize(),
      /**
       * The dead.
       *
       * Ancestors are not a cache — nothing in a living world can reconstruct a
       * grandmother who died sixty years ago. Leaving them out broke every family
       * tree at the first departed generation, so dynastic succession could not
       * find a claimant's descent, the citizen inspector reported "no known
       * relatives" for people with four documented generations behind them, and a
       * child born after its father's death was assigned the invented ancestor
       * "Pai Ancestral".
       */
      deceasedAncestors: [...sim.deceasedAncestors.values()],
      // Armies at sea, and the supply lines feeding the fronts.
      invasions: sim.invasions.serialize(),
      logistics: sim.logistics.serialize()
    };
  }

  public static importSaveData(data: any, tileMap: TileMap, sim: SimulationEngine, eraMgr: EraManager): void {
    tileMap.deserialize(data.world);
    sim.currentYear = data.year ?? 1;
    sim.totalBirths = data.totalBirths ?? 0;
    sim.totalDeaths = data.totalDeaths ?? 0;
    eraMgr.setEra((data.era as WorldEra) ?? WorldEra.GOLDEN_AGE);

    // Restore the chronicle so structured history, references and story threads
    // survive a reload. Chronicle.deserialize() also accepts legacy v1/v2 entries.
    chronicle.deserialize(data.history);

    // Restore Entities
    sim.entities = [];
    sim.spatialHash.clear();
    sim.entityChunks.clear();

    for (const ed of data.entities ?? []) {
      const e = new Entity(ed.id, ed.species, ed.x, ed.y, ed.name);
      e.age = ed.age;
      e.gender = ed.gender;
      e.level = ed.level;
      e.xp = ed.xp;
      e.kills = ed.kills;
      e.profession = ed.profession;
      e.personality = ed.personality;
      e.cityId = ed.cityId;
      e.kingdomId = ed.kingdomId;
      e.isFavorite = ed.isFavorite;

      // Family and bloodline (absent from v1 saves, which simply have no families).
      e.fatherId = ed.fatherId ?? null;
      e.motherId = ed.motherId ?? null;
      e.partnerId = ed.partnerId ?? null;
      e.childrenIds = ed.childrenIds ?? [];
      e.dynasty = ed.dynasty ?? '';
      e.generation = ed.generation ?? 1;
      e.fertilityCooldown = ed.fertilityCooldown ?? 0;

      e.isGreatPerson = ed.isGreatPerson ?? false;
      e.greatPersonType = ed.greatPersonType ?? null;
      e.title = ed.title ?? e.name;
      if (ed.equipment) e.equipment = ed.equipment;

      // Daily routine fields (v2 compat — absent from v1 saves)
      e.workplaceId = ed.workplaceId ?? null;
      e.aboardFleetId = ed.aboardFleetId ?? null;
      e.homeX = ed.homeX ?? null;
      e.homeY = ed.homeY ?? null;
      e.energy = ed.energy ?? 100;

      // Identity (v3 compat). Older saves predate it, so derive a sane birth year
      // from the age we already restored rather than leaving everyone born in y1.
      e.birthYear = ed.birthYear ?? Math.max(1, sim.currentYear - (ed.age ?? 0));
      e.birthCityId = ed.birthCityId ?? ed.cityId ?? null;
      e.birthCityName = ed.birthCityName ?? '';
      e.homeBuildingId = ed.homeBuildingId ?? null;
      e.pregnancyTimer = ed.pregnancyTimer ?? 0;
      e.pregnantFatherId = ed.pregnantFatherId ?? null;
      e.householdId = ed.householdId ?? null;
      e.wealth = ed.wealth ?? 0;
      e.needs = { ...createNeeds(), ...(ed.needs ?? {}) };
      e.starvingDays = ed.starvingDays ?? 0;
      e.carrying = ed.carrying ?? null;

      // SOC-V2 (absent from pre-SOC saves). A citizen who predates the psyche
      // keeps the disposition the constructor already rolled for them rather
      // than loading as a blank — but never re-rolls one that was saved.
      if (ed.psyche) e.psyche = { ...e.psyche, ...ed.psyche };
      e.memories = ed.memories ?? [];
      e.bonds = ed.bonds ?? [];
      e.migrationUrge = ed.migrationUrge ?? 0;

      // SOC-V3 (absent from pre-SOC-V3 saves). A citizen with no recorded family
      // origin is treated as being of the place they were born, which is exactly
      // what they were before the concept existed.
      e.originCityId = ed.originCityId ?? e.birthCityId;
      e.originCityName = ed.originCityName ?? e.birthCityName;
      e.localGenerations = ed.localGenerations ?? 1;
      e.familyTrade = ed.familyTrade ?? 'none';
      e.historic = ed.historic ?? false;
      // Pre-CULT saves have no identity; the first census gives everyone the
      // culture of the settlement they are standing in.
      e.cultureId = ed.cultureId ?? '';
      e.localAffinity = ed.localAffinity ?? 0;

      e.traits = new Set(ed.traits);
      e.recalculateStats();
      // Assign HP after recalculateStats so it isn't clamped against a stale max.
      e.hp = Math.min(ed.hp, e.maxHp);

      sim.entities.push(e);
      sim.spatialHash.insert(e);
      sim.entityChunks.insert(e);
    }

    // Restore Cities. The spatial index is emptied with them: loading a save on
    // top of a running game left every destroyed settlement in the grid, and the
    // lazy `size !== cities.size` rebuild cannot notice when the two counts
    // happen to match, so those ghosts answered proximity queries forever.
    sim.cities.clear();
    sim.citySpatialHash.clear();
    for (const cd of data.cities ?? []) {
      const city = City.deserialize(cd);
      sim.cities.set(city.id, city);
    }

    // Restore Kingdoms
    sim.kingdoms.clear();
    for (const kd of data.kingdoms ?? []) {
      const kingdom = Kingdom.deserialize(kd);
      sim.kingdoms.set(kingdom.id, kingdom);
    }

    sim.cultures.deserialize(data.cultures);

    // Restore households (absent from pre-layer-5 saves; they rebuild on demand).
    sim.households.clear();
    for (const hd of data.households ?? []) {
      const household = Household.deserialize(hd);
      sim.households.set(household.id, household);
    }

    // Rebuild building occupancy from the citizens themselves. Residents and job
    // slots are not serialised on the building side, so without this pass every
    // restored house looks empty and every workplace looks fully staffed by nobody.
    for (const e of sim.entities) {
      const city = e.cityId ? sim.cities.get(e.cityId) : null;
      if (!city) continue;
      if (e.homeBuildingId) city.buildings.get(e.homeBuildingId)?.residentIds.add(e.id);
      if (e.workplaceId) city.buildings.get(e.workplaceId)?.assignedWorkerIds.add(e.id);
    }

    // Restore world systems
    if (data.diplomacy) sim.diplomacy.deserialize(data.diplomacy);
    if (data.warfare) sim.warfare.deserialize(data.warfare);
    if (data.market) sim.market.deserialize(data.market);
    // Older saves predate fronts; a war in one simply starts its lines at zero.
    sim.fronts.deserialize(data.fronts);
    sim.invasions.deserialize(data.invasions);
    sim.logistics.deserialize(data.logistics);

    // The dead, before anything reads a family tree.
    sim.deceasedAncestors.clear();
    for (const record of data.deceasedAncestors ?? []) {
      sim.deceasedAncestors.set(record.id, record);
    }

    sim.citySpatialHash.rebuild(sim.cities.values());
  }
}
