import { performance } from 'node:perf_hooks';
import { TileMap } from '../src/world/TileMap';

const size = Number(process.argv[2] ?? 128);
if (![128, 256, 512].includes(size)) throw new Error('Expected world size 128, 256 or 512');
global.gc?.();
const before = process.memoryUsage();
const started = performance.now();
const map = new TileMap(size, size, 'single_continent', 1);
const generationMs = performance.now() - started;
global.gc?.();
const after = process.memoryUsage();
const serializedStarted = performance.now();
const serialized = JSON.stringify(map.serialize());
const serializationMs = performance.now() - serializedStarted;
const loadStarted = performance.now();
const restored = new TileMap(32, 32, 'single_continent', 1);
restored.deserialize(JSON.parse(serialized));
const loadMs = performance.now() - loadStarted;
if (restored.width !== size) throw new Error('Chunked save round-trip changed world dimensions');
console.log(JSON.stringify({
  size,
  generationMs,
  serializationMs,
  loadMs,
  compactStorageBytes: map.approximateTileStorageBytes,
  heapDeltaBytes: Math.max(0, after.heapUsed - before.heapUsed),
  rssDeltaBytes: Math.max(0, after.rss - before.rss),
  saveBytes: Buffer.byteLength(serialized)
}));
