/**
 * Every bridge slice at magnification, on a water-coloured ground.
 *
 * Pixel art has to be judged as pixels: at map scale a mistake reads as a
 * vague smudge, and at 6x it reads as the wrong rectangle. Served by vite
 * from scratch/bridgesheet.html.
 */
import { bridgeSprite, type BridgeModel, type BridgeSlice } from '../src/renderer/BridgeSprites';
import { roadProp, type RoadProp } from '../src/renderer/RoadSprites';
import { caravanSprite, type CaravanKind, type CaravanView } from '../src/renderer/CaravanSprites';

const MODELS: BridgeModel[] = ['stones', 'timber', 'covered', 'arch', 'viaduct', 'imperial', 'truss', 'suspension'];
const SLICES: BridgeSlice[] = ['single', 'approach', 'span'];
const ZOOM = 6;

const table = document.createElement('table');
const head = document.createElement('tr');
head.innerHTML = '<th></th>' + SLICES.map(s => `<th>${s}</th>`).join('') + '<th>a crossing of five</th>';
table.append(head);

for (const model of MODELS) {
  const row = document.createElement('tr');
  const label = document.createElement('th');
  label.textContent = model;
  row.append(label);
  for (const slice of SLICES) {
    const cell = document.createElement('td');
    const c = document.createElement('canvas');
    c.width = 32 * ZOOM;
    c.height = 32 * ZOOM;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bridgeSprite(model, slice), 0, 0, c.width, c.height);
    cell.append(c);
    row.append(cell);
  }
  // The same slices assembled the way the renderer assembles them.
  const cell = document.createElement('td');
  const strip = document.createElement('canvas');
  const z = 3;
  strip.width = 32 * 5 * z;
  strip.height = 32 * z;
  const sctx = strip.getContext('2d')!;
  sctx.imageSmoothingEnabled = false;
  for (let i = 0; i < 5; i++) {
    const slice: BridgeSlice = i === 0 || i === 4 ? 'approach' : 'span';
    sctx.save();
    if (i === 4) { sctx.translate((i + 1) * 32 * z, 0); sctx.scale(-1, 1); }
    else sctx.translate(i * 32 * z, 0);
    sctx.drawImage(bridgeSprite(model, slice), 0, 0, 32 * z, 32 * z);
    sctx.restore();
  }
  cell.append(strip);
  row.append(cell);
  table.append(row);
}
document.getElementById('sheet')!.append(table);

// The roadside props, at the same magnification.
{
  const props: RoadProp[] = ['milestone', 'signpost', 'shrine', 'frontier', 'lamp'];
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:20px;align-items:flex-end;padding:24px 0';
  for (const prop of props) {
    const wrap = document.createElement('div');
    const c = document.createElement('canvas');
    const sprite = roadProp(prop, 0);
    c.width = sprite.width * 6;
    c.height = sprite.height * 6;
    c.style.background = '#4b6b34';
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, 0, 0, c.width, c.height);
    wrap.append(c, Object.assign(document.createElement('div'), { textContent: prop }));
    row.append(wrap);
  }
  document.getElementById('sheet')!.append(row);
}

// The caravans: every kind, every view, every frame of the gait.
{
  const kinds: CaravanKind[] = ['donkey', 'camel', 'cart'];
  const views: CaravanView[] = ['back', 'side', 'front'];
  const table = document.createElement('table');
  const head = document.createElement('tr');
  head.innerHTML = '<th></th>' + views.map(v => `<th>${v} (4-frame gait)</th>`).join('');
  table.append(head);
  for (const kind of kinds) {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.textContent = kind;
    row.append(label);
    for (const view of views) {
      const cell = document.createElement('td');
      const c = document.createElement('canvas');
      c.width = 32 * 4 * 4;
      c.height = 32 * 4;
      c.style.background = '#5c7a3f';
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      for (let f = 0; f < 4; f++) ctx.drawImage(caravanSprite(kind, view, f), f * 128, 0, 128, 128);
      cell.append(c);
      row.append(cell);
    }
    table.append(row);
  }
  document.getElementById('sheet')!.append(table);
}

(window as unknown as { roadsReady: boolean }).roadsReady = true;
