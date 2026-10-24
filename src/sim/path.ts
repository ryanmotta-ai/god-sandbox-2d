import type { World } from '../world/world';
import { TERRAIN, OBJECTS } from '../world/defs';

const TCOST = Float32Array.from(TERRAIN.map(t => (t.walk ? 1 / t.speed : 0)));
const TWATER = Uint8Array.from(TERRAIN.map(t => (t.water ? 1 : 0)));
const OSOLID = Uint8Array.from(OBJECTS.map(o => (o.solid ? 1 : 0)));

/** Cost of entering a tile, or 0 if blocked. Trees are passable (walked among); boulders, ore and buildings are not. */
export function stepCost(w: World, i: number, canWade = true): number {
  const c = TCOST[w.terrain[i]];
  if (c === 0 || (!canWade && TWATER[w.terrain[i]]) || (w.bld[i] !== 0 && w.open[i] === 0) || OSOLID[w.obj[i]] !== 0) return 0;
  return c;
}

/** Straight run between two tiles if every tile on it is open — covers most wandering without a search. */
function straightPath(w: World, sx: number, sy: number, gx: number, gy: number): Int32Array | null {
  const dx = gx - sx, dy = gy - sy, n = Math.max(Math.abs(dx), Math.abs(dy));
  if (n === 0 || n > 28) return null;
  const out = new Int32Array(n);
  let px = sx, py = sy;
  for (let k = 1; k <= n; k++) {
    const x = sx + Math.round((dx * k) / n), y = sy + Math.round((dy * k) / n);
    if (stepCost(w, y * w.w + x) === 0) return null;
    if (x !== px && y !== py && (stepCost(w, py * w.w + x) === 0 || stepCost(w, y * w.w + px) === 0)) return null; // no corner cutting
    out[k - 1] = y * w.w + x; px = x; py = y;
  }
  return out;
}

// Reusable search buffers: A* runs often, allocation would dominate.
let G: Float32Array, PARENT: Int32Array, STAMP: Uint32Array, CLOSED: Uint32Array, HEAP: Int32Array, FSCORE: Float32Array;
let stamp = 0, cap = 0;

function ensure(n: number): void {
  if (cap >= n) return;
  cap = n; G = new Float32Array(n); PARENT = new Int32Array(n); STAMP = new Uint32Array(n); CLOSED = new Uint32Array(n); HEAP = new Int32Array(n); FSCORE = new Float32Array(n);
}

/**
 * A* over the tile grid (8-way, no corner cutting). Returns tile indices from the first step to the goal,
 * or null. `maxNodes` bounds the work; if the goal is blocked the search aims at the closest reachable tile.
 */
export function findPath(w: World, sx: number, sy: number, gx: number, gy: number, maxNodes = 1800): Int32Array | null {
  const W = w.w, H = w.h;
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
  gx = Math.max(0, Math.min(W - 1, gx)); gy = Math.max(0, Math.min(H - 1, gy));
  const direct = straightPath(w, sx, sy, gx, gy);
  if (direct) return direct;
  ensure(W * H);
  stamp++;
  const start = sy * W + sx, goal = gy * W + gx;
  let heapN = 0;
  const push = (i: number): void => {
    let k = heapN++; HEAP[k] = i;
    while (k > 0) { const p = (k - 1) >> 1; if (FSCORE[HEAP[p]] <= FSCORE[HEAP[k]]) break; const t = HEAP[p]; HEAP[p] = HEAP[k]; HEAP[k] = t; k = p; }
  };
  const pop = (): number => {
    const top = HEAP[0]; HEAP[0] = HEAP[--heapN];
    let k = 0;
    for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heapN && FSCORE[HEAP[l]] < FSCORE[HEAP[m]]) m = l; if (r < heapN && FSCORE[HEAP[r]] < FSCORE[HEAP[m]]) m = r; if (m === k) break; const t = HEAP[m]; HEAP[m] = HEAP[k]; HEAP[k] = t; k = m; }
    return top;
  };
  const hfn = (i: number): number => { const dx = Math.abs((i % W) - gx), dy = Math.abs(((i / W) | 0) - gy); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  STAMP[start] = stamp; G[start] = 0; PARENT[start] = -1; FSCORE[start] = hfn(start); push(start);
  let best = start, bestH = hfn(start), nodes = 0;
  while (heapN > 0 && nodes++ < maxNodes) {
    const cur = pop();
    if (CLOSED[cur] === stamp) continue;
    CLOSED[cur] = stamp;
    if (cur === goal) { best = cur; break; }
    const h0 = hfn(cur);
    if (h0 < bestH) { bestH = h0; best = cur; }
    const cx = cur % W, cy = (cur / W) | 0;
    const cN = cy > 0 ? stepCost(w, cur - W) : 0, cS = cy < H - 1 ? stepCost(w, cur + W) : 0, cW = cx > 0 ? stepCost(w, cur - 1) : 0, cE = cx < W - 1 ? stepCost(w, cur + 1) : 0;
    for (let d = 0; d < 8; d++) {
      const dx = DX[d], dy = DY[d], nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      let c: number;
      if (d < 4) c = d === 0 ? cE : d === 1 ? cW : d === 2 ? cS : cN;
      else { if (!(dx > 0 ? cE : cW) || !(dy > 0 ? cS : cN)) continue; c = stepCost(w, ni); }
      if (c === 0) { if (ni !== goal) continue; c = 4; }
      const ng = G[cur] + c * (d >= 4 ? 1.414 : 1);
      if (STAMP[ni] === stamp && ng >= G[ni]) continue;
      STAMP[ni] = stamp; G[ni] = ng; PARENT[ni] = cur; FSCORE[ni] = ng + hfn(ni) * 1.05; push(ni);
    }
  }
  if (best === start) return null;
  const out: number[] = [];
  for (let i = best; i !== start && i !== -1; i = PARENT[i]) out.push(i);
  out.reverse();
  return Int32Array.from(out);
}
const DX = [1, -1, 0, 0, 1, -1, 1, -1], DY = [0, 0, 1, -1, 1, 1, -1, -1];
