/**
 * What the HUD is allowed to know about the world.
 *
 * The rule this file exists to enforce: **the UI reads state, the simulation
 * produces it.** A HUD that walks every city to count famines runs that walk
 * sixty times a second for a figure that changes once a year. So the aggregates
 * are computed here, on a cadence, and every HUD element reads the same frozen
 * snapshot until it is refreshed.
 *
 * Some of these are already O(1) on the engine (`cities.size`); they are
 * included anyway so that HUD code has exactly one place to read from and cannot
 * quietly start reaching into the simulation for the next figure it needs.
 */
import type { SimulationEngine } from '../../ai/EntityAI';

export interface WorldSnapshot {
  year: number;
  /** Calendar position within the year, from the engine's own calendar. */
  month: number;
  day: number;
  /** Clock reading, already formatted by the engine. */
  timeString: string;
  periodLabel: string;

  population: number;
  cities: number;
  kingdoms: number;
  activeWars: number;

  /** Settlements currently recording famine years. Drives the food alert. */
  citiesInFamine: number;
  /** Settlements currently under siege. */
  citiesBesieged: number;
}

/** Longest a snapshot is trusted before it is rebuilt. */
const MAX_AGE_MS = 400;

const EMPTY: WorldSnapshot = {
  year: 1, month: 1, day: 1, timeString: '00:00', periodLabel: '',
  population: 0, cities: 0, kingdoms: 0, activeWars: 0,
  citiesInFamine: 0, citiesBesieged: 0
};

/**
 * Holds the current snapshot and decides when it is stale.
 *
 * Refresh is time-based rather than tied to the render loop: at 10× speed the
 * world changes fast and at pause it does not change at all, and in both cases
 * the player reads these numbers at human speed.
 */
export class WorldSnapshotProvider {
  private snapshot: WorldSnapshot = { ...EMPTY };
  private lastBuilt = -Infinity;
  private lastYear = -1;

  public get current(): WorldSnapshot {
    return this.snapshot;
  }

  /**
   * Rebuilds the snapshot if it has gone stale. Called once per frame from the
   * HUD; cheap to call, because most calls do nothing.
   *
   * A year boundary forces a rebuild regardless of the clock — the year is the
   * unit everything else in the simulation moves on, so a snapshot that
   * straddles one is showing two different worlds at once.
   */
  public refresh(sim: SimulationEngine, now: number): WorldSnapshot {
    const yearChanged = sim.currentYear !== this.lastYear;
    if (!yearChanged && now - this.lastBuilt < MAX_AGE_MS) return this.snapshot;

    this.lastBuilt = now;
    this.lastYear = sim.currentYear;

    // One pass over the settlements, for the two figures that need it. Cities
    // number in the dozens, not the thousands, and this runs ~2×/second.
    let famine = 0;
    let besieged = 0;
    for (const city of sim.cities.values()) {
      if (city.famineYears > 0) famine++;
      if (city.besiegerId) besieged++;
    }

    const clock = sim.get24HourTime();
    const date = sim.getCalendarDate();

    this.snapshot = {
      year: sim.currentYear,
      month: date.month,
      day: date.day,
      timeString: clock.timeString,
      periodLabel: clock.periodLabel,
      population: sim.entities.length,
      cities: sim.cities.size,
      kingdoms: sim.kingdoms.size,
      activeWars: sim.diplomacy.activeWars.size,
      citiesInFamine: famine,
      citiesBesieged: besieged
    };
    return this.snapshot;
  }

  /** Drops the cached snapshot. Called when a world is torn down or replaced. */
  public reset(): void {
    this.snapshot = { ...EMPTY };
    this.lastBuilt = -Infinity;
    this.lastYear = -1;
  }
}
