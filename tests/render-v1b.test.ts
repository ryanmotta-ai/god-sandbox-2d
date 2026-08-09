import assert from 'node:assert/strict';
import { Camera } from '../src/renderer/Camera';
import { RenderSnapshotBuilder } from '../src/renderer/webgpu/RenderSnapshot';
import type { AtlasRegion } from '../src/renderer/webgpu/TextureAtlas';
import { TerrainType } from '../src/world/Biomes';
import { Tile } from '../src/world/Tile';
import type { TileMap } from '../src/world/TileMap';

const region = (page = 0): AtlasRegion => ({ page, u0: 0, v0: 0, u1: 1, v1: 1 });
const regions = new Map<string, AtlasRegion>([['solid:white', region()], ['overlay:selection', region()]]);
for (const terrain of Object.values(TerrainType)) regions.set(`terrain:${terrain}`, region());
for (const prop of ['tree_oak', 'tree_pine', 'tree_palm', 'swamp_reed', 'arcane_crystal', 'corrupted_skull', 'fx_fire']) regions.set(`prop:${prop}`, region());
regions.set('entity:human', region());

const size = 96;
const grid = Array.from({ length: size }, (_, x) => Array.from({ length: size }, (_, y) => new Tile(x, y, TerrainType.GRASS, .5)));
const map = { width: size, height: size, grid, terrainVersion: 1, roadNetworkVersion: 1, railNetworkVersion: 1, dirtyChunks: new Set<number>(), getTile(x: number, y: number) { return x < 0 || y < 0 || x >= size || y >= size ? null : grid[x][y]; } } as TileMap;
grid[48][48].roadLevel = 2; grid[49][48].roadLevel = 2;
grid[48][49].railLevel = 1; grid[49][49].railLevel = 1;
grid[48][48].kingdomId = 'amber'; grid[49][48].kingdomId = 'amber'; grid[48][49].kingdomId = 'amber';
map.dirtyChunks.add(1 * 3 + 1);

const camera = new Camera(); camera.centerOn(48, 48, 1);
const builder = new RenderSnapshotBuilder(regions);
const input = { camera, tileMap: map, entities: [], cities: new Map(), kingdoms: new Map([['amber', { color: '#f59e0b' }]]), overlayMode: 'none' as const, selection: null, viewportWidth: 640, viewportHeight: 360, devicePixelRatio: 1 };
const first = builder.build(input);
assert.ok(first.updatedChunks > 0, 'initial visible chunks become resident');
assert.ok(first.staticInstances > 32 * 32, 'roads, rail and territory add static chunk instances');
const stable = builder.build(input);
assert.equal(stable.updatedChunks, 0, 'static chunks are not rebuilt on unchanged frames');
assert.equal(stable.staticRevision, first.staticRevision, 'unchanged residency does not trigger a static upload revision');

grid[48][48].roadDamage = .8; map.roadNetworkVersion++; map.dirtyChunks.add(1 * 3 + 1);
const changed = builder.build(input);
assert.equal(changed.updatedChunks, 1, 'a local infrastructure change updates only its dirty chunk');
assert.ok(changed.chunks.some(chunk => chunk.chunkX === 1 && chunk.chunkY === 1), 'camera still sees changed chunk');
console.log('RENDER-V1B chunk residency tests passed');
