import { el, clear } from '../core/Dom';
import { icon, withTooltip } from '../kit';
import { GOODS, MINEABLE_GOODS, QUARRY_GOODS, FORESTRY_GOODS, type GoodId } from '../../civ/Goods';
import { mapLegend, type MapLegendEntry } from '../map/MapLegend';
import type { EconomyOverlayMetric, MapLayer, OverlayMode } from '../../renderer/Overlays';
import type { GameContext } from '../core/GameContext';

const MODE_LABEL: Record<OverlayMode, string> = {
  none: 'NORMAL', political: 'POLÍTICO', population: 'POPULAÇÃO', economy: 'ECONOMIA',
  resources: 'RECURSOS', diplomacy: 'DIPLOMACIA', politics: 'PRESSÃO POLÍTICA', war: 'GUERRA',
  biome: 'BIOMAS', temperature: 'CLIMA'
};

const LAYER_LABEL: Record<MapLayer, string> = {
  trade: 'Comércio', roads: 'Estradas', 'road-traffic': 'Tráfego rodoviário', rail: 'Ferrovia',
  ports: 'Portos', logistics: 'Problemas', 'city-labels': 'Nomes das cidades', armies: 'Exércitos'
};

const ANALYTICAL_LAYERS: MapLayer[] = ['trade', 'roads', 'road-traffic', 'rail', 'ports', 'logistics', 'armies'];

export class MapIntelligencePanel {
  public readonly root: HTMLElement;
  private body: HTMLElement;
  private ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.body = el('div');
    this.root = el('aside', { class: 'ae-map-intelligence hidden', attrs: { 'aria-live': 'polite' } }, [this.body]);
    ctx.overlays.onChange(() => this.sync());
    this.sync();
  }

  public sync(): void {
    const overlays = this.ctx.overlays;
    const activeLayers = ANALYTICAL_LAYERS.filter(layer => overlays.layers.has(layer));
    const visible = overlays.activeMode !== 'none' || activeLayers.length > 0;
    this.root.classList.toggle('hidden', !visible);
    if (!visible) return;

    clear(this.body);
    const detail = overlays.activeMode === 'economy' ? economyLabel(overlays.economyMetric)
      : overlays.activeMode === 'resources' && overlays.resourceGood !== 'all' ? GOODS[overlays.resourceGood]?.name ?? overlays.resourceGood
      : overlays.activeMode === 'diplomacy' && overlays.selectedRealmId ? this.ctx.sim.kingdoms.get(overlays.selectedRealmId)?.name ?? ''
      : '';
    this.body.appendChild(el('div', { class: 'ae-map-intelligence-head' }, [
      el('div', {}, [
        el('span', { class: 'ae-map-intelligence-kicker', text: 'INTELIGÊNCIA DO MAPA' }),
        el('strong', { text: `${MODE_LABEL[overlays.activeMode]}${detail ? ` — ${detail}` : ''}` })
      ]),
      withTooltip(el('button', {
        class: 'ae-map-intelligence-close', attrs: { type: 'button', 'aria-label': 'Voltar ao mapa normal' },
        on: { click: () => overlays.reset() }
      }, [icon('close', { size: 16 })]), { title: 'Mapa normal', description: 'Remover modos analíticos e camadas.' })
    ]));

    const controls = this.contextControls();
    if (controls) this.body.appendChild(controls);
    if (activeLayers.length) this.body.appendChild(el('div', { class: 'ae-map-layer-row' }, activeLayers.map(layer =>
      el('button', { class: 'ae-map-layer-chip', attrs: { type: 'button' }, on: { click: () => overlays.toggleLayer(layer, false) } }, [
        el('span', { text: LAYER_LABEL[layer] }), el('span', { text: '×' })
      ])
    )));
    this.body.appendChild(mapLegend(MODE_LABEL[overlays.activeMode], legendFor(overlays.activeMode, overlays.economyMetric, activeLayers)));
    if (overlays.hover) this.body.appendChild(el('div', { class: 'ae-map-hover-intel' }, [
      el('strong', { text: overlays.hover.title }),
      ...overlays.hover.lines.map(line => el('span', { text: line }))
    ]));
  }

  private contextControls(): HTMLElement | null {
    const overlays = this.ctx.overlays;
    if (overlays.activeMode === 'economy') {
      return selector('Métrica', overlays.economyMetric, [
        ['prosperity', 'Prosperidade'], ['output', 'Produção'], ['employment', 'Emprego'], ['food', 'Segurança alimentar']
      ], value => overlays.setEconomyMetric(value as EconomyOverlayMetric));
    }
    if (overlays.activeMode === 'resources') {
      return selector('Recurso', overlays.resourceGood, [
        ['all', 'Todos os recursos'], ...[...new Set([...MINEABLE_GOODS, ...QUARRY_GOODS, ...FORESTRY_GOODS])]
          .map(good => [good, GOODS[good].name] as [string, string])
      ], value => overlays.setResourceGood(value as GoodId | 'all'));
    }
    if (overlays.activeMode === 'diplomacy') {
      return selector('Reino de referência', overlays.selectedRealmId ?? '', [...this.ctx.sim.kingdoms.values()].map(kingdom => [kingdom.id, kingdom.name]), value => overlays.open({ mode: 'diplomacy', realmId: value }));
    }
    return null;
  }
}

function selector(label: string, value: string, options: Array<[string, string]>, change: (value: string) => void): HTMLElement {
  return el('label', { class: 'ae-map-context-control' }, [
    el('span', { text: label }),
    el('select', { on: { change: (event: Event) => change((event.target as HTMLSelectElement).value) } }, options.map(([id, name]) =>
      el('option', { text: name, attrs: { value: id, selected: id === value } })
    ))
  ]);
}

function economyLabel(metric: EconomyOverlayMetric): string {
  return ({ prosperity: 'Prosperidade', output: 'Produção', employment: 'Emprego', food: 'Segurança alimentar' })[metric];
}

function legendFor(mode: OverlayMode, metric: EconomyOverlayMetric, layers: MapLayer[]): MapLegendEntry[] {
  const entries: MapLegendEntry[] = [];
  if (mode === 'population') entries.push(
    { label: 'Baixo', color: '#38bdf8', detail: 'escala logarítmica relativa' },
    { label: 'Médio', color: '#a3e635' }, { label: 'Alto', color: '#f59e0b' }, { label: 'Muito alto', color: '#ef4444' }
  );
  if (mode === 'economy') {
    if (metric === 'food') entries.push({ label: 'Escassez', color: '#ef4444' }, { label: 'Equilibrado', color: '#f59e0b' }, { label: 'Excedente', color: '#22c55e' });
    else entries.push({ label: 'Baixo', color: '#7f1d1d' }, { label: 'Médio', color: '#f59e0b' }, { label: 'Alto', color: '#22c55e' });
  }
  if (mode === 'resources') entries.push({ label: 'Depósito / região', color: '#fbbf24' }, { label: 'Esgotado', color: '#64748b', line: 'dashed' });
  if (mode === 'political') entries.push({ label: 'Posse do reino atual', color: '#e2e8f0', line: 'solid' });
  if (mode === 'diplomacy') entries.push({ label: 'Aliado', color: '#38bdf8' }, { label: 'Neutro', color: '#94a3b8' }, { label: 'Hostil', color: '#f59e0b' }, { label: 'Guerra', color: '#ef4444', line: 'dashed' });
  if (mode === 'politics') entries.push({ label: 'Estável', color: '#22c55e' }, { label: 'Alerta', color: '#f59e0b' }, { label: 'Crítico', color: '#ef4444' });
  if (mode === 'war') entries.push({ label: 'Participantes', color: '#ef4444', line: 'solid' }, { label: 'Combate', color: '#f59e0b' }, { label: 'Infraestrutura danificada', color: '#c084fc' });
  if (layers.includes('trade')) entries.push({ label: 'Rota comercial', color: '#22d3ee', line: 'solid' });
  if (layers.includes('roads')) entries.push({ label: 'Nível de estrada 1–3', color: '#fbbf24', line: 'solid' });
  if (layers.includes('road-traffic')) entries.push({ label: 'Intensidade de tráfego', color: '#fb7185' });
  if (layers.includes('rail')) entries.push({ label: 'Rede ferroviária', color: '#67e8f9', line: 'solid' });
  if (layers.includes('ports')) entries.push({ label: 'Operacional / inativa', color: '#38bdf8' });
  if (layers.includes('logistics')) entries.push({ label: 'Alerta / problema crítico', color: '#ef4444' });
  return entries.length ? entries : [{ label: 'Terreno preservado', color: '#94a3b8', detail: 'apenas tonalidade analítica' }];
}
