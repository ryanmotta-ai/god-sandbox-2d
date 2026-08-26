import { WarfareUISnapshotCache } from '../warfare/WarfareMetrics';
import type { GameContext } from '../core/GameContext';
import type { EconomyOverlayMetric, OverlayManager, WarOverlayFocus } from '../../renderer/Overlays';

export interface MapCityDatum {
  id: string;
  name: string;
  kingdomId: string | null;
  x: number;
  y: number;
  territoryTiles: number;
  population: number;
  populationLevel: number;
  prosperity: number;
  output: number;
  outputLevel: number;
  /** Food in the store against a year of eating, 0..1. Read off the shelves. */
  foodStocked: number;
}

export interface MapPoliticalDatum {
  kingdomId: string;
  stability: number;
  legitimacy: number;
  revoltRisk: number;
  coupRisk: number;
  reformPressure: number;
}

export interface MapIntelligenceSnapshot {
  year: number;
  cities: MapCityDatum[];
  politics: MapPoliticalDatum[];
  globalWarFocus: WarOverlayFocus | null;
  economyMetric: EconomyOverlayMetric;
  buildTimeMs: number;
}

export const mapIntelligencePerformance = {
  snapshotMs: 0,
  cacheHitMs: 0,
  lastMode: 'none' as string
};

/**
 * What the map overlays need, read straight off the simulation.
 *
 * There is no metrics cache behind this any more: a city's output, population
 * and the food on its shelves are all on the city itself, so the overlay reads
 * the same numbers the player would see by clicking it.
 */
export class MapIntelligenceCache {
  private warfare = new WarfareUISnapshotCache();
  private snapshot: MapIntelligenceSnapshot | null = null;
  private signature = '';
  private builtAt = -Infinity;

  public get(ctx: GameContext, overlays: OverlayManager, now: number): MapIntelligenceSnapshot | null {
    const needsEconomy = overlays.activeMode === 'population' || overlays.activeMode === 'economy';
    const needsPolitics = overlays.activeMode === 'politics';
    if (!needsEconomy && !needsPolitics && overlays.activeMode !== 'war') return null;

    const signature = [
      ctx.sim.currentYear, overlays.activeMode, overlays.economyMetric,
      [...overlays.layers].sort().join(','), ctx.sim.cities.size,
      ctx.sim.diplomacy.activeWars.size
    ].join('|');
    const hitStarted = performance.now();
    if (this.snapshot && signature === this.signature && now - this.builtAt < 1800) {
      mapIntelligencePerformance.cacheHitMs = performance.now() - hitStarted;
      return this.snapshot;
    }

    const started = performance.now();
    const all = [...ctx.sim.cities.values()];
    const maxPopulation = Math.max(1, ...all.map(city => city.population));
    const maxOutput = Math.max(1, ...all.map(city => city.economicOutput));
    const cities: MapCityDatum[] = all.map(city => ({
      id: city.id, name: city.name, kingdomId: city.kingdomId, x: city.x, y: city.y,
      territoryTiles: city.territory.size, population: city.population,
      populationLevel: Math.pow(Math.log1p(city.population) / Math.log1p(maxPopulation), 0.72),
      prosperity: city.prosperity, output: city.economicOutput,
      outputLevel: Math.pow(Math.log1p(city.economicOutput) / Math.log1p(maxOutput), 0.72),
      foodStocked: Math.min(1, city.stock.get('food') / Math.max(1, city.population))
    }));
    const politics = [...ctx.sim.kingdoms.values()].map(kingdom => ({
      kingdomId: kingdom.id,
      stability: kingdom.economy.stability,
      legitimacy: kingdom.legitimacy,
      revoltRisk: kingdom.society.revoltRisk,
      coupRisk: kingdom.society.coupRisk,
      reformPressure: kingdom.society.reformPressure
    }));

    let globalWarFocus: WarOverlayFocus | null = null;
    if (overlays.activeMode === 'war' && !overlays.warFocus) {
      const warfare = this.warfare.get(ctx, now);
      if (warfare.activeWars.length) globalWarFocus = {
        warId: null,
        participantIds: [...new Set(warfare.activeWars.flatMap(war => [war.attacker.id, war.defender.id, ...war.allies.map(ally => ally.kingdom.id)]))],
        entityIds: [...new Set(warfare.activeWars.flatMap(war => [...(war.attackerForce?.combatantIds ?? []), ...(war.defenderForce?.combatantIds ?? [])]))],
        cityIds: [...new Set(warfare.activeWars.flatMap(war => war.cities.map(city => city.id)))],
        points: warfare.activeWars.flatMap(war => [
          ...war.engagements.map(item => ({ x: item.x, y: item.y, kind: 'engagement' as const })),
          ...war.sieges.map(item => ({ x: item.x, y: item.y, kind: 'siege' as const }))
        ])
      };
    }

    const buildTimeMs = performance.now() - started;
    this.snapshot = {
      year: ctx.sim.currentYear, cities,
      politics, globalWarFocus, economyMetric: overlays.economyMetric, buildTimeMs
    };
    this.signature = signature;
    this.builtAt = now;
    mapIntelligencePerformance.snapshotMs = buildTimeMs;
    mapIntelligencePerformance.lastMode = overlays.activeMode;
    return this.snapshot;
  }

  public invalidate(): void {
    this.builtAt = -Infinity;
    this.warfare.invalidate();
  }
}
