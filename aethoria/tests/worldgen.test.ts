import assert from 'node:assert/strict';
import { generateWorld, DEFAULT_GEN, type Preset } from '../src/world/gen';
import { TERRAIN, T } from '../src/world/defs';

// The old game's generator silently shrank to grass+mountain. This test exists so that can't happen again.
for (const preset of ['continents', 'pangea', 'islands', 'archipelago', 'lakes'] as Preset[]) {
  const w = generateWorld({ ...DEFAULT_GEN, size: 160, seed: 5, preset });
  const counts = new Map<number, number>();
  for (const t of w.terrain) counts.set(t, (counts.get(t) ?? 0) + 1);
  const n = w.w * w.h;
  const water = ((counts.get(T.DEEP) ?? 0) + (counts.get(T.SHALLOW) ?? 0)) / n;
  assert.ok(water > 0.15 && water < 0.85, `${preset}: water share ${water.toFixed(2)}`);
  const kinds = [...counts.keys()].filter(t => TERRAIN[t].level > 0 || t === T.SAND);
  assert.ok(kinds.length >= 5, `${preset}: only ${kinds.length} land terrain kinds`);
  assert.ok((counts.get(T.MOUNTAIN) ?? 0) + (counts.get(T.PEAK) ?? 0) > n * 0.01, `${preset}: no mountains`);
  assert.ok((counts.get(T.SAND) ?? 0) > 20, `${preset}: no beaches`);
  assert.ok(w.obj.some(o => o !== 0), `${preset}: no objects`);
}
// Same seed → same world.
const a = generateWorld({ ...DEFAULT_GEN, size: 96, seed: 9 }), b = generateWorld({ ...DEFAULT_GEN, size: 96, seed: 9 });
assert.deepEqual(a.terrain, b.terrain);
