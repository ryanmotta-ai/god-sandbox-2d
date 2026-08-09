import assert from 'node:assert/strict';
import { Camera } from '../src/renderer/Camera';
import {
  INSTANCE_BYTES,
  RENDER_CHUNK_SIZE,
  RenderSnapshotBuilder
} from '../src/renderer/webgpu/RenderSnapshot';
import type { AtlasRegion } from '../src/renderer/webgpu/TextureAtlas';
import { TerrainType } from '../src/world/Biomes';
import { Tile } from '../src/world/Tile';
import type { TileMap } from '../src/world/TileMap';

function atlasRegions(): Map<string, AtlasRegion> {
  const region = { u0: 0, v0: 0, u1: 1, v1: 1 };
  const regions = new Map<string, AtlasRegion>([
    ['solid:white', region],
    ['overlay:selection', region]
  ]);
  for (const type of Object.values(TerrainType)) regions.set(`terrain:${type}`, region);
  return regions;
}

function fakeMap(size: number): TileMap {
  const grid: Tile[][] = Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) => new Tile(x, y, TerrainType.GRASS, 0.5))
  );
  return {
    width: size,
    height: size,
    grid,
    terrainVersion: 1
  } as TileMap;
}

const map = fakeMap(96);
const camera = new Camera();
camera.centerOn(48, 48, 1);
const builder = new RenderSnapshotBuilder(atlasRegions());
const input = {
  camera,
  tileMap: map,
  entities: [],
  cities: new Map(),
  overlayMode: 'none' as const,
  selection: null,
  viewportWidth: 640,
  viewportHeight: 360,
  devicePixelRatio: 2
};

const first = builder.build(input);
assert.equal(INSTANCE_BYTES, 48, 'instance ABI must remain explicitly bounded');
assert.equal(RENDER_CHUNK_SIZE, 32, 'V1A render chunks use the audited candidate size');
assert.ok(first.staticInstances > 0, 'visible terrain should produce instances');
assert.ok(first.staticInstances < map.width * map.height, 'snapshot must cull instead of scanning/uploading the world');
assert.equal(first.chunks.reduce((bytes, chunk) => bytes + [...chunk.pageData.values()].reduce((sum, data) => sum + data.byteLength, 0), 0), first.staticInstances * INSTANCE_BYTES);
assert.equal(first.dynamicInstances, 0);
assert.equal(first.camera.devicePixelRatio, 2);

const unchanged = builder.build(input);
assert.equal(unchanged.staticRevision, first.staticRevision, 'sub-tile-stable camera should reuse the static upload');

camera.centerOn(72, 48, 1);
const moved = builder.build(input);
assert.equal(moved.staticRevision, unchanged.staticRevision, 'camera movement reuses resident chunks instead of joining a visible-world upload');
assert.ok(Math.abs(moved.camera.relativeCameraX) <= RENDER_CHUNK_SIZE * camera.tileSize,
  'chunk floating origin keeps GPU camera coordinates bounded');

const benchmark = new RenderSnapshotBuilder(atlasRegions(), 10_000).build(input);
assert.equal(benchmark.staticInstances, 10_000);
assert.equal([...benchmark.chunks[0].pageData.values()][0].byteLength, 10_000 * INSTANCE_BYTES);
assert.equal(benchmark.benchmarkInstances, 10_000);

console.log('RENDER-V1A snapshot tests passed');
