import { el } from '../core/Dom';

export interface MapLegendEntry {
  label: string;
  color: string;
  detail?: string;
  line?: 'solid' | 'dashed' | 'dot';
}

/** Shared legend surface for every player-facing map mode. */
export function mapLegend(title: string, entries: MapLegendEntry[]): HTMLElement {
  return el('div', { class: 'ae-map-legend' }, [
    el('div', { class: 'ae-map-legend-title', text: title }),
    ...entries.map(entry => el('div', { class: 'ae-map-legend-row' }, [
      el('span', {
        class: `ae-map-legend-swatch${entry.line ? ` ae-map-legend-${entry.line}` : ''}`,
        style: { background: entry.line ? 'transparent' : entry.color, borderColor: entry.color }
      }),
      el('span', { text: entry.label }),
      entry.detail ? el('span', { class: 'ae-map-legend-detail', text: entry.detail }) : null
    ]))
  ]);
}
