import { el, hexAlpha, formatNumber } from '../core/Dom';

/**
 * Small canvas chart helpers for the Statistics screen.
 * Deliberately dependency-free — the whole game ships without a chart library.
 */

const GRID_COLOR = 'rgba(148, 163, 184, 0.14)';
const AXIS_TEXT = 'rgba(148, 163, 184, 0.75)';

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
}

function setupCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

/** Multi-series line chart with a labelled Y axis and a legend. */
export function lineChart(
  series: LineSeries[],
  labels: number[],
  opts: { width?: number; height?: number; yLabel?: string } = {}
): HTMLElement {
  const width = opts.width ?? 640;
  const height = opts.height ?? 200;
  const { canvas, ctx } = setupCanvas(width, height);

  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = series.flatMap(s => s.values);
  const maxValue = Math.max(1, ...allValues);
  const count = Math.max(...series.map(s => s.values.length), 1);

  // Grid + Y axis labels
  ctx.font = '10px "Outfit", sans-serif';
  ctx.fillStyle = AXIS_TEXT;
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = padT + (plotH / steps) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    const value = maxValue * (1 - i / steps);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(value), padL - 8, y + 3);
  }

  // X axis labels (first / middle / last year)
  ctx.textAlign = 'center';
  if (labels.length > 0) {
    const marks = [0, Math.floor(labels.length / 2), labels.length - 1];
    for (const idx of new Set(marks)) {
      const x = padL + (count <= 1 ? plotW / 2 : (plotW / (count - 1)) * idx);
      ctx.fillText(`Yr ${labels[idx]}`, x, height - 8);
    }
  }
  ctx.textAlign = 'start';

  // Series
  for (const s of series) {
    if (s.values.length === 0) continue;
    const pointX = (i: number) => padL + (count <= 1 ? plotW / 2 : (plotW / (count - 1)) * i);
    const pointY = (v: number) => padT + plotH - (v / maxValue) * plotH;

    // Area fill under the line
    const gradient = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    gradient.addColorStop(0, hexAlpha(s.color, 0.28));
    gradient.addColorStop(1, hexAlpha(s.color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(pointX(0), padT + plotH);
    s.values.forEach((v, i) => ctx.lineTo(pointX(i), pointY(v)));
    ctx.lineTo(pointX(s.values.length - 1), padT + plotH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.values.forEach((v, i) => (i === 0 ? ctx.moveTo(pointX(i), pointY(v)) : ctx.lineTo(pointX(i), pointY(v))));
    ctx.stroke();

    // Head dot on the latest value
    const lastIdx = s.values.length - 1;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(pointX(lastIdx), pointY(s.values[lastIdx]), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return el('div', { class: 'chart' }, [
    canvas,
    el(
      'div',
      { class: 'chart-legend' },
      series.map(s =>
        el('span', { class: 'legend-item' }, [
          el('i', { class: 'legend-swatch', style: { background: s.color } }),
          el('span', { text: s.label })
        ])
      )
    )
  ]);
}

export interface BarDatum {
  label: string;
  value: number;
  color: string;
  sublabel?: string;
}

/** Horizontal bar list — used for kingdom power and species population. */
export function barList(data: BarDatum[], opts: { max?: number; formatValue?: (v: number) => string } = {}): HTMLElement {
  const max = opts.max ?? Math.max(1, ...data.map(d => d.value));
  const fmt = opts.formatValue ?? formatNumber;

  return el(
    'div',
    { class: 'bar-list' },
    data.map(d =>
      el('div', { class: 'bar-row' }, [
        el('div', { class: 'bar-head' }, [
          el('span', { class: 'bar-label', text: d.label }),
          el('span', { class: 'bar-value', text: fmt(d.value) })
        ]),
        el('div', { class: 'bar-track' }, [
          el('div', {
            class: 'bar-fill',
            style: { width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color }
          })
        ]),
        d.sublabel ? el('span', { class: 'bar-sub', text: d.sublabel }) : null
      ])
    )
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Donut chart with a centre total, used for the species split. */
export function donutChart(slices: DonutSlice[], centerLabel: string, size = 180): HTMLElement {
  const { canvas, ctx } = setupCanvas(size, size);
  canvas.style.width = `${size}px`;

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 6;
  const inner = outer * 0.62;

  if (total <= 0) {
    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.lineWidth = outer - inner;
    ctx.beginPath();
    ctx.arc(cx, cy, (outer + inner) / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    let angle = -Math.PI / 2;
    for (const slice of slices) {
      const sweep = (slice.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, angle, angle + sweep);
      ctx.arc(cx, cy, inner, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
      // Separator between slices
      ctx.strokeStyle = 'rgba(7, 9, 14, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      angle += sweep;
    }
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(formatNumber(total), cx, cy + 2);
  ctx.font = '10px "Outfit", sans-serif';
  ctx.fillStyle = AXIS_TEXT;
  ctx.fillText(centerLabel.toUpperCase(), cx, cy + 18);
  ctx.textAlign = 'start';

  return el('div', { class: 'donut' }, [
    canvas,
    el(
      'div',
      { class: 'donut-legend' },
      slices.map(s =>
        el('div', { class: 'legend-item' }, [
          el('i', { class: 'legend-swatch', style: { background: s.color } }),
          el('span', { class: 'legend-name', text: s.label }),
          el('span', { class: 'legend-value', text: formatNumber(s.value) })
        ])
      )
    )
  ]);
}

/** Compact inline sparkline for HUD/stat tiles. */
export function sparkline(values: number[], color: string, width = 120, height = 32): HTMLElement {
  const { canvas, ctx } = setupCanvas(width, height);
  canvas.style.width = `${width}px`;
  if (values.length < 2) return el('div', { class: 'sparkline' }, [canvas]);

  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (width / (values.length - 1)) * i;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  return el('div', { class: 'sparkline' }, [canvas]);
}
