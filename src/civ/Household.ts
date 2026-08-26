/**
 * The family as a roof over people's heads.
 *
 * A household is who lives together, and that is all it is. There is no purse
 * and no larder: a hungry citizen walks to the settlement's own store and eats
 * off its shelves, so the food you can see stacked in a city is the food that
 * actually feeds its people. What a family owns is its members, its house and
 * its founding year — nothing a player cannot point at on the map.
 */

export interface HouseholdData {
  id: string;
  cityId: string | null;
  homeBuildingId: string | null;
  memberIds: string[];
  foundedYear: number;
}

export class Household {
  public id: string;
  public cityId: string | null;
  public homeBuildingId: string | null;
  public memberIds: Set<string> = new Set();
  public foundedYear: number;

  constructor(id: string, cityId: string | null, homeBuildingId: string | null, foundedYear: number) {
    this.id = id;
    this.cityId = cityId;
    this.homeBuildingId = homeBuildingId;
    this.foundedYear = foundedYear;
  }

  public get size(): number {
    return this.memberIds.size;
  }

  public serialize(): HouseholdData {
    return {
      id: this.id,
      cityId: this.cityId,
      homeBuildingId: this.homeBuildingId,
      memberIds: [...this.memberIds],
      foundedYear: this.foundedYear
    };
  }

  public static deserialize(data: HouseholdData): Household {
    const h = new Household(data.id, data.cityId, data.homeBuildingId ?? null, data.foundedYear ?? 1);
    h.memberIds = new Set(data.memberIds ?? []);
    return h;
  }
}
