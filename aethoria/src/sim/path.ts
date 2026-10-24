import type { World } from '../world/world';
import { TERRAIN, OBJECTS } from '../world/defs';

/** Cost of entering a tile, or 0 if blocked. Trees are passable (walked among); boulders, ore and buildings are not. */
export function stepCost(w: World, i: number, canWade = true): number {
  const t = TERRAIN[w.terrain[i]];
  if (!t.walk || (!canWade && t.water)) return 0;
  if (w.bld[i] !== 0 || OBJECTS[w.obj[i]].solid) return 0;
  return 1 / t.speed;
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
export function findPath(w: World, sx: number, sy: number, gx: number, gy: number, maxNodes = 3500): Int32Array | null {
  const W = w.w, H = w.h;
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
  gx = Math.max(0, Math.min(W - 1, gx)); gy = Math.max(0, Math.min(H - 1, gy));
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
    for (let d = 0; d < 8; d++) {
      const dx = DX[d], dy = DY[d], nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      const c = ni === goal ? Math.max(stepCost(w, ni), 0.0001) * (stepCost(w, ni) === 0 ? 4 : 1) : stepCost(w, ni);
      if (c === 0) continue;
      if (dx !== 0 && dy !== 0 && (stepCost(w, cy * W + nx) === 0 || stepCost(w, ny * W + cx) === 0)) continue;
      const ng = G[cur] + c * (dx !== 0 && dy !== 0 ? 1.414 : 1);
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
