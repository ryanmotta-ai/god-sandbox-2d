import { EconomyMetricsCache } from '../economy/EconomyMetrics';
import { LogisticsMetricsCache, type PortView, type RouteView, type Bottleneck } from '../logistics/LogisticsMetrics';
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
  employment: number | null;
  foodSecurity: number | null;
  topIndustry: string | null;
  problem: string | null;
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
  routes: RouteView[];
  ports: PortView[];
  issues: Bottleneck[];
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

/** Lazy, modular facade over the UI-5/UI-7/UI-9 caches. */
export class MapIntelligenceCache {
  private economy = new EconomyMetricsCache();
  private logistics = new LogisticsMetricsCache();
  private warfare = new WarfareUISnapshotCache();
  private snapshot: MapIntelligenceSnapshot | null = null;
  private signature = '';
  private builtAt = -Infinity;

  public get(ctx: GameContext, overlays: OverlayManager, now: number): MapIntelligenceSnapshot | null {
    const needsEconomy = overlays.activeMode === 'population' || overlays.activeMode === 'economy';
    const needsLogistics = overlays.layers.has('trade') || overlays.layers.has('ports') || overlays.layers.has('logistics') || overlays.activeMode === 'war';
    const needsPolitics = overlays.activeMode === 'politics';
    if (!needsEconomy && !needsLogistics && !needsPolitics && overlays.activeMode !== 'war') return null;

    const signature = [
      ctx.sim.currentYear, overlays.activeMode, overlays.economyMetric, overlays.tradeGood,
      [...overlays.layers].sort().join(','), ctx.sim.cities.size, ctx.sim.trade.routes.size,
      ctx.sim.diplomacy.activeWars.size
    ].join('|');
    const hitStarted = performance.now();
    if (this.snapshot && signature === this.signature && now - this.builtAt < 1800) {
      mapIntelligencePerformance.cacheHitMs = performance.now() - hitStarted;
      return this.snapshot;
    }

    const started = performance.now();
    const economy = needsEconomy ? this.economy.get(ctx, now) : null;
    const logistics = needsLogistics ? this.logistics.get(ctx, now) : null;
    const cityEconomy = new Map((economy?.cities ?? []).map(city => [city.id, city]));
    const maxPopulation = Math.max(1, ...[...ctx.sim.cities.values()].map(city => city.population));
    const maxOutput = Math.max(1, ...(economy?.cities ?? []).map(city => city.output));
    const cities: MapCityDatum[] = [...ctx.sim.cities.values()].map(city => {
      const economic = cityEconomy.get(city.id);
      const populationLevel = Math.pow(Math.log1p(city.population) / Math.log1p(maxPopulation), 0.72);
      const output = economic?.output ?? city.economicOutput;
      return {
        id: city.id, name: city.name, kingdomId: city.kingdomId, x: city.x, y: city.y,
        territoryTiles: city.territory.size, population: city.population, populationLevel,
        prosperity: city.prosperity, output, outputLevel: Math.pow(Math.log1p(output) / Math.log1p(maxOutput), 0.72),
        employment: economic?.employment ?? null, foodSecurity: economic?.foodSecurity ?? null,
        topIndustry: economic?.topIndustry ?? null, problem: economic?.problem?.label ?? null
      };
    });
    const routes = (logistics?.routes ?? [])
      .filter(route => overlays.tradeGood === 'all' || route.good === overlays.tradeGood)
      .sort((a, b) => b.route.volume - a.route.volume || b.route.totalValue - a.route.totalValue)
      .slice(0, 160);
    const politics = [...ctx.sim.kingdoms.values()].map(kingdom => ({
      kingdomId: kingdom.id,
      stability: kingdom.economy.stability,
      legitimacy: kingdom.legitimacy,
      revoltRisk: kingdom.society.revoltRisk,
      coupRisk: kingdom.society.coupRisk,
      reformPressure: kingdom.society.reformPressure
    }));

    let globalWarFocus: WarOverlayFocus | null = null;
    if (overlays.activeMode === 'war' && !overlays.warFocus && logistics) {
      const warfare = this.warfare.get(ctx, logistics, now);
      if (warfare.activeWars.length) globalWarFocus = {
        warId: null,
        participantIds: [...new Set(warfare.activeWars.flatMap(war => [war.attacker.id, war.defender.id, ...war.allies.map(ally => ally.kingdom.id)]))],
        entityIds: [...new Set(warfare.activeWars.flatMap(war => [...(war.attackerForce?.combatantIds ?? []), ...(war.defenderForce?.combatantIds ?? [])]))],
        cityIds: [...new Set(warfare.activeWars.flatMap(war => war.cities.map(city => city.id)))],
        points: warfare.activeWars.flatMap(war => [
          ...war.engagements.map(item => ({ x: item.x, y: item.y, kind: 'engagement' as const })),
          ...war.sieges.map(item => ({ x: item.x, y: item.y, kind: 'siege' as const })),
          ...war.infrastructure.damagedRailLines.map(item => ({ x: item.at.x, y: item.at.y, kind: 'infrastructure' as const })),
          ...war.infrastructure.disruptedPorts.map(item => ({ x: item.x, y: item.y, kind: 'infrastructure' as const }))
        ])
      };
    }

    const buildTimeMs = performance.now() - started;
    this.snapshot = {
      year: ctx.sim.currentYear, cities, routes, ports: logistics?.ports ?? [], issues: logistics?.bottlenecks ?? [],
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
    this.economy.invalidate();
    this.logistics.invalidate();
    this.warfare.invalidate();
  }
}
