/**
 * The world clock.
 *
 * Two separate things are being balanced here, and they pull in opposite
 * directions. The YEAR has to be short, because a civilisation's slower changes
 * are paced against it. The DAY has to be long enough that a citizen can
 * actually walk to their workplace, do a shift and get home before dusk — a day
 * too short leaves everyone permanently commuting or asleep, which is exactly
 * what happens if you shorten the year by shortening the day.
 *
 * So the year is made short by having FEW days, not by having fast days.
 *
 * At 60fps, one tick is one frame at speed 1x:
 *   TICKS_PER_DAY  600  -> an in-world day lasts 10s at 1x
 *   TICKS_PER_YEAR 7200 -> a year lasts 2min at 1x, and 12s at 10x
 *
 * These live on their own, with no imports, because both the entity layer and
 * the civilisation layer need them and neither can own them without the two
 * importing each other.
 */
export const TICKS_PER_DAY = 600;
/** In-world days per year — each one reads as a month on the calendar. */
export const DAYS_PER_YEAR = 12;
export const DAYS_PER_SEASON = 3;
export const SEASONS_PER_YEAR = 4;
export const TICKS_PER_SEASON = TICKS_PER_DAY * DAYS_PER_SEASON; // 1800 ticks (3 months)
export const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_YEAR; // 7200 ticks (1 full year)
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
