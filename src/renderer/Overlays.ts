import type { GoodId } from '../civ/Goods';

export type OverlayMode =
  | 'none' | 'political' | 'population' | 'economy' | 'resources'
  | 'diplomacy' | 'politics' | 'war' | 'biome' | 'temperature';

export type EconomyOverlayMetric = 'prosperity' | 'output' | 'employment' | 'food';
export type MapLayer = 'trade' | 'roads' | 'road-traffic' | 'rail' | 'ports' | 'logistics' | 'city-labels' | 'armies';

export interface WarOverlayFocus {
  warId: string | null;
  participantIds: string[];
  entityIds: string[];
  cityIds: string[];
  points: { x: number; y: number; kind: 'engagement' | 'siege' | 'force' | 'infrastructure' }[];
}

export interface MapOverlayRequest {
  mode?: OverlayMode;
  layers?: MapLayer[];
  replaceLayers?: boolean;
  good?: GoodId | 'all';
  economyMetric?: EconomyOverlayMetric;
  realmId?: string | null;
  warFocus?: WarOverlayFocus;
}

export interface MapHoverIntelligence {
  key: string;
  title: string;
  lines: string[];
}

export class OverlayManager {
  public activeMode: OverlayMode = 'none';
  public economyMetric: EconomyOverlayMetric = 'prosperity';
  public resourceGood: GoodId | 'all' = 'all';
  public tradeGood: GoodId | 'all' = 'all';
  public selectedRealmId: string | null = null;
  public warFocus: WarOverlayFocus | null = null;
  public hover: MapHoverIntelligence | null = null;
  public readonly layers = new Set<MapLayer>(['city-labels']);

  private listeners = new Set<() => void>();

  public setMode(mode: OverlayMode): void {
    if (this.activeMode === mode && (mode !== 'war' || this.warFocus)) return;
    this.activeMode = mode;
    if (mode !== 'war') this.warFocus = null;
    this.emit();
  }

  public toggleLayer(layer: MapLayer, force?: boolean): void {
    const on = force ?? !this.layers.has(layer);
    if (on) this.layers.add(layer); else this.layers.delete(layer);
    this.emit();
  }

  /** Clean deep-link API shared by UI-5 through UI-9. */
  public open(request: MapOverlayRequest): void {
    if (request.mode) this.activeMode = request.mode;
    if (request.replaceLayers) this.layers.clear();
    for (const layer of request.layers ?? []) this.layers.add(layer);
    if (request.good) {
      this.resourceGood = request.good;
      this.tradeGood = request.good;
    }
    if (request.economyMetric) this.economyMetric = request.economyMetric;
    if (request.realmId !== undefined) this.selectedRealmId = request.realmId;
    if (request.warFocus) {
      this.warFocus = cloneWarFocus(request.warFocus);
      this.activeMode = 'war';
    } else if (this.activeMode !== 'war') {
      this.warFocus = null;
    }
    this.emit();
  }

  public setWarFocus(focus: WarOverlayFocus): void {
    this.warFocus = cloneWarFocus(focus);
    this.activeMode = 'war';
    this.layers.add('armies');
    this.emit();
  }

  public setEconomyMetric(metric: EconomyOverlayMetric): void {
    this.economyMetric = metric;
    this.activeMode = 'economy';
    this.emit();
  }

  public setResourceGood(good: GoodId | 'all'): void {
    this.resourceGood = good;
    this.activeMode = 'resources';
    this.emit();
  }

  public setTradeGood(good: GoodId | 'all'): void {
    this.tradeGood = good;
    this.layers.add('trade');
    this.emit();
  }

  public setHover(hover: MapHoverIntelligence | null): void {
    if (hover?.key === this.hover?.key) return;
    this.hover = hover;
    this.emit();
  }

  public onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public reset(): void {
    this.activeMode = 'none';
    this.layers.clear();
    this.layers.add('city-labels');
    this.warFocus = null;
    this.hover = null;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

function cloneWarFocus(focus: WarOverlayFocus): WarOverlayFocus {
  return {
    warId: focus.warId,
    participantIds: [...new Set(focus.participantIds)],
    entityIds: [...new Set(focus.entityIds)],
    cityIds: [...new Set(focus.cityIds)],
    points: focus.points.map(point => ({ ...point }))
  };
}
