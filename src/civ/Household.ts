/**
 * The family as an economic unit.
 *
 * Layer 5 of the citizen simulation, and the piece that makes the others mean
 * something. A household owns a pantry and a purse. Its members earn coin by
 * delivering real work, the household spends that coin buying food from the
 * settlement store, and its members eat out of the pantry. A family that earns
 * less than it eats gets poorer, then hungry, then desperate — and that pressure
 * is what the social and political layers already know how to read.
 *
 * Nothing here is scripted. Wages in, food out, and the difference is a life.
 */

import { GoodId, Stockpile } from './Goods';

/**
 * How much food a household tries to keep in store, per member.
 * Roughly half a year of meals — enough to ride out a bad season, not a granary.
 */
export const PANTRY_TARGET_PER_MEMBER = 1.2;
/** Coin a household will not spend, kept back against a bad year. */
export const HOUSEHOLD_RESERVE = 6;

export interface HouseholdData {
  id: string;
  cityId: string | null;
  homeBuildingId: string | null;
  memberIds: string[];
  coin: number;
  pantry: Record<string, number>;
  foundedYear: number;
}

export class Household {
  public id: string;
  public cityId: string | null;
  public homeBuildingId: string | null;
  public memberIds: Set<string> = new Set();
  /** Shared family purse. Members contribute wages and draw on it to buy. */
  public coin: number = 0;
  /** Food and goods kept at home. Small — a family is not a warehouse. */
  public pantry: Stockpile = new Stockpile(60);
  public foundedYear: number;
  /** Running record so the UI can show a family getting richer or poorer. */
  public lastEarned: number = 0;
  public lastSpent: number = 0;

  constructor(id: string, cityId: string | null, homeBuildingId: string | null, foundedYear: number) {
    this.id = id;
    this.cityId = cityId;
    this.homeBuildingId = homeBuildingId;
    this.foundedYear = foundedYear;
  }

  public get size(): number {
    return this.memberIds.size;
  }

  /** Food the household would like to hold, given how many mouths it feeds. */
  public pantryTarget(): number {
    return Math.max(6, this.size * PANTRY_TARGET_PER_MEMBER);
  }

  /** Takes one meal out of the pantry. Returns false when there is nothing to eat. */
  public takeMeal(portion: number): boolean {
    if (this.pantry.get('food') < portion) return false;
    this.pantry.take('food', portion);
    return true;
  }

  public earn(amount: number): void {
    if (amount <= 0) return;
    this.coin += amount;
    this.lastEarned += amount;
  }

  /**
   * Spends from the purse. Returns coin actually paid.
   *
   * `essential` purchases ignore the rainy-day reserve: a family always spends its
   * last coin on food. Holding the reserve back for meals meant any household that
   * fell under it could never buy again and starved beside a full granary.
   */
  public spend(amount: number, essential: boolean = false): number {
    const floor = essential ? 0 : HOUSEHOLD_RESERVE;
    const spendable = Math.max(0, this.coin - floor);
    const paid = Math.min(amount, spendable);
    if (paid <= 0) return 0;
    this.coin -= paid;
    this.lastSpent += paid;
    return paid;
  }

  public serialize(): HouseholdData {
    return {
      id: this.id,
      cityId: this.cityId,
      homeBuildingId: this.homeBuildingId,
      memberIds: [...this.memberIds],
      coin: Math.round(this.coin * 100) / 100,
      pantry: this.pantry.serialize(),
      foundedYear: this.foundedYear
    };
  }

  public static deserialize(data: HouseholdData): Household {
    const h = new Household(data.id, data.cityId, data.homeBuildingId ?? null, data.foundedYear ?? 1);
    h.memberIds = new Set(data.memberIds ?? []);
    h.coin = data.coin ?? 0;
    h.pantry.deserialize(data.pantry as Record<GoodId, number>);
    return h;
  }
}
