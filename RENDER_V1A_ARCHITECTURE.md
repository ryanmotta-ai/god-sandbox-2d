# Aethoria RENDER-V1A Architecture

## Scope

RENDER-V1A is an incremental world-renderer proof. The existing `PixelRenderer`
remains the complete Canvas implementation and the default renderer. WebGPU
proves initialization, camera parity, nearest-neighbour atlas sampling,
instancing, visible-region preparation, device-loss fallback, and a boundary
between simulation objects and GPU data. UI, full overlays, roads, rail,
particles, and complete urban rendering remain Canvas/V1B+ work.

## Renderer contract and selection

`WorldRenderer` normalizes the methods already used by the game (`resize`,
`render`, options, selection, diplomacy, lifecycle). `CanvasWorldRenderer`
adapts the existing renderer. `WebGPUWorldRenderer` implements the GPU path.
`RendererHost` owns selection and fallback.

DEV selection is intentionally not player-facing:

- `?renderer=canvas` selects Canvas (also the default).
- `?renderer=webgpu` requests WebGPU.
- `?renderSeed=424242` fixes the backdrop seed for parity captures.
- `?renderBenchmark=10000|50000|100000|250000|500000` enables the synthetic
  WebGPU instance scene.

The original Canvas is retained as the input surface. WebGPU renders into a
pointer-transparent sibling canvas. This avoids the browser rule that one
canvas cannot switch from a 2D context to a WebGPU context and lets fallback
occur without replacing input listeners or simulation objects.

## WebGPU initialization and failure handling

Initialization performs, in order:

1. `navigator.gpu` capability check;
2. `requestAdapter({ powerPreference: 'high-performance' })`;
3. `requestDevice()`;
4. `canvas.getContext('webgpu')`;
5. preferred canvas format lookup and context configuration;
6. validation error scope around atlas, buffers, shader, and pipeline creation;
7. uncaptured-error listener and `device.lost` handler.

Any unsupported, initialization, frame, validation, uncaptured, or device-loss
failure removes the GPU surface and switches `RendererHost` to the already-live
Canvas renderer. The render snapshot contains no writable simulation state, so
renderer failure cannot corrupt a citizen, city, realm, tile, economy, war, or
simulation scheduler.

## Coordinate system and camera uniform

| Space | Unit/origin | Conversion |
| --- | --- | --- |
| Tile/world | Tile coordinates, world top-left | Simulation and snapshot input |
| GPU instance | Tiles relative to a 32-tile floating origin | `worldTile - originTile` on CPU |
| Camera | World pixels relative to the same floating origin | `cameraPx - originTile * tileSize` |
| CSS screen | Logical CSS pixels, top-left | Existing camera pan/zoom semantics |
| Physical screen | Backing-store pixels | CSS pixels multiplied by DPR |
| Clip | WebGPU NDC | Vertex shader converts CSS position to `[-1, 1]` and flips Y |

The uniform contains logical viewport size, relative camera pixels, shake,
tile size, zoom, interpolation alpha, and device pixel ratio. Quad edges are
rounded in physical-pixel space before conversion to clip space. This provides
stable camera behavior and pixel-aligned output while keeping current controls.

The chunk-aligned floating origin avoids sending unnecessarily large absolute
coordinates to `f32`. Visible instance values remain near the camera even if a
future world has very large tile coordinates. JavaScript integer coordinates
remain exact up to `Number.MAX_SAFE_INTEGER`; practical world limits will be
set by storage/streaming well before the relative GPU representation.

## Quad pipeline, instancing, and atlas

One indexed unit quad (four vertices, six indices) is reused by all world
instances. A single blended, depth-tested pipeline samples one RGBA8 atlas.
Transparent texels below alpha 0.01 are discarded so they do not write depth.

Instance ABI (48 bytes):

| Offset | Format | Meaning |
| ---: | --- | --- |
| 0 | `float32x2` | Previous tile position |
| 8 | `float32x2` | Current tile position |
| 16 | `float32x2` | Visual size in tiles |
| 24 | `float32x4` | Atlas UV rectangle |
| 40 | `unorm8x4` | Tint/alpha |
| 44 | `float32` | Depth layer/Y-order value |

Previous/current positions and the uniform alpha establish interpolation
without changing simulation ticks. Alpha is 1 in V1A.

The initial 512x512 RGBA8 atlas is 1,048,576 bytes. It packs:

- one material sprite for every existing terrain type;
- all current base building sprites from `SpriteGenerator`;
- one existing idle sprite per species;
- selected existing vegetation/fire sprites from `SpriteRegistry`;
- solid and selection utility regions.

Sampling uses nearest minification, magnification, and mip filtering. No mip
chain is allocated. Atlas regions are data, so a later atlas packer or multiple
atlases do not change the instance ABI.

## Render snapshot boundary

The boundary is:

```text
SIMULATION OBJECTS -> RenderSnapshotBuilder -> packed read-only snapshot -> WebGPU
```

Only `RenderSnapshotBuilder` sees `TileMap`, `City`, and `Entity`. The resulting
snapshot contains a camera POD object plus two byte views. `WebGPUWorldRenderer`
cannot navigate or mutate gameplay state.

Snapshot scope in V1A:

- visible terrain tiles and a sparse subset of existing props;
- visible base building visuals;
- visible entity proofs with previous/current positions;
- fire and selection proof instances;
- camera fields required by the GPU.

No world copy is made, and no world-sized texture/canvas is created.

## Chunk readiness and CPU preparation

`RenderChunk` is a renderer-owned 32x32 candidate chunk, not TileMap storage.
It records chunk coordinates, bounds, cached terrain/prop kinds, the terrain
version used to build it, and its last visible frame. Only chunks intersecting
the camera are requested. A chunk refresh reads at most its own tiles. The
snapshot then emits only the visible intersection plus a one-tile margin.

The static snapshot is keyed by visible tile bounds, floating origin, terrain
version, overlay, building count, and detail LOD. Sub-tile camera motion reuses
the previous packed static bytes and GPU upload. Dynamic entities/fire/selection
use a separate writer and GPU buffer each frame. A future chunk storage system
can replace the source of `RenderChunk.refresh` without changing the GPU ABI.

## Buffer and resource lifecycle

- Quad, index, uniform, atlas, sampler, pipeline, and bind group are created
  once per device.
- Static/slow and dynamic instance buffers are separate.
- Instance buffers start at 64 KiB and grow by powers of two; replaced buffers
  are destroyed.
- Static data uploads only when `staticRevision` changes. Dynamic data and the
  48-byte camera uniform update per frame.
- The depth texture is recreated only when physical canvas dimensions change.
- Atlas, buffers, depth texture, context, and device are released on destroy.
- No GPU resource is created per frame.

## Depth and Y order

The pipeline uses `depth24plus`, depth writes, and `less`. Terrain uses a rear
layer. Buildings, props, and entities derive a nearer layer from visible-world
Y; larger Y is closer. A small category epsilon makes entity/fire proofs stable
at equal Y. Selection is foremost. This proves a GPU depth/Y strategy without a
large CPU sort. More exact sprite-foot ordering is V1B work.

## Resize and pixel art

WebGPU tracks CSS width/height separately from backing dimensions. Resize sets
the backing store to `round(cssSize * devicePixelRatio)` (DPR capped at 3) and
recreates only the depth target. Camera calculations remain in CSS pixels, so
the existing input coordinates remain valid. Physical-pixel snapping, nearest
sampling, no mipmaps, and `image-rendering: pixelated` preserve sharp sprites.

## Performance instrumentation

Live metrics are available in `window.__AETHORIA_RENDER_V1A__` and throttled
`document.documentElement.dataset` fields:

- active renderer/status;
- visible instance count and draw calls;
- current and peak upload bytes;
- current and peak render preparation milliseconds;
- CPU command-submission milliseconds and frame interval;
- allocated static/dynamic buffer bytes;
- atlas bytes and benchmark instance count.

These values do not claim GPU execution time. Timestamp-query/GPU timing is not
implemented in V1A.

## V1B/V1C interfaces left open

- roads/rail: append chunk-local line/quad instances or a dedicated line pass;
- territory/occupation: sampled mask/overlay atlas or chunk-local tint data;
- full buildings: atlas variants and N visual instances per logical building;
- full entities: animation/appearance atlas management and simulation alpha;
- particles: a very-dynamic buffer and dedicated pipeline;
- UI/picking: remain DOM/CPU-side; GPU ID picking is intentionally absent.

