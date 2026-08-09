# Aethoria RENDER-V1A Report

## Result

RENDER-V1A is implemented as an incremental, selectable WebGPU world path.
WebGPU initializes and renders in a Chromium/Dawn browser, while the complete
Canvas renderer remains the default and a live fallback. Camera pan/zoom,
resize, textured instancing, atlas sampling, visible chunk preparation,
building/entity proofs, selection proof, telemetry, and synthetic benchmarks
are present. No Tauri/native/platform service or simulation scheduler was
changed by this work.

## Files changed

- `src/main.ts` — composition-root switch to `RendererHost` and deterministic
  DEV parity seed.
- `src/renderer/world/WorldRenderer.ts` — renderer contract, telemetry, DEV
  selection.
- `src/renderer/world/CanvasWorldRenderer.ts` — unchanged Canvas renderer
  adapter.
- `src/renderer/world/RendererHost.ts` — asynchronous selection and safe
  Canvas fallback.
- `src/renderer/webgpu/TextureAtlas.ts` — initial atlas and nearest sampler.
- `src/renderer/webgpu/RenderSnapshot.ts` — read-only snapshot adapter,
  renderer chunks, compact instance packing, synthetic benchmark.
- `src/renderer/webgpu/WebGPUShader.ts` — camera transform and textured quad
  WGSL.
- `src/renderer/webgpu/WebGPUWorldRenderer.ts` — WebGPU device/context,
  resources, pipeline, frame submission, lifecycle, error handling.
- `tests/render-v1a.test.ts` — snapshot ABI, culling, revision, floating-origin,
  DPR, and 10k benchmark checks.
- `RENDER_V1A_ARCHITECTURE.md` — detailed design.
- `RENDER_V1A_SHARED_FILES.md` — `src/main.ts` integration/merge note.
- `RENDER_V1A_REPORT.md` — this report.

## Implemented features

- DEV choice through `?renderer=canvas|webgpu` with Canvas default.
- Correct adapter/device/context/preferred-format/configure sequence.
- Initialization validation scope, uncaptured error reporting, and
  `device.lost` handling.
- Canvas fallback on unsupported WebGPU, initialization error, frame error,
  uncaptured error, or device loss.
- CSS-size/backing-size separation, DPR-aware resize, depth-target recreation.
- Existing camera semantics encoded in a compact GPU uniform.
- Physical-pixel snapping and nearest-neighbour, no-mipmap atlas sampling.
- One indexed textured-quad pipeline for all V1A visuals.
- Static/slow and dynamic instanced buffers with power-of-two reuse.
- Previous/current entity positions and interpolation-alpha foundation.
- 512x512 atlas using current terrain palette and existing building, species,
  nature, and fire sprites.
- Read-only render snapshot containing camera and packed bytes only.
- Camera-visible 32x32 renderer chunks; no full-world tile upload and no
  world-sized texture/canvas.
- Terrain, sparse prop, base building, entity, fire, and selection proofs.
- Depth buffer and basic Y-derived ordering without a giant CPU sort.
- DEV metrics and 10k/50k/100k/250k/500k synthetic harness.
- Deterministic Canvas/WebGPU parity URLs with `renderSeed`.

## Canvas fallback status

**PASS.** Canvas is still the default, `?renderer=canvas` uses the complete
existing renderer, and runtime fallback was exercised while resolving an atlas
validation error: the GPU canvas was removed, the Canvas path resumed, and the
simulation/menu remained alive. The final WebGPU path then initialized cleanly.

The original Canvas stays allocated as the input surface while WebGPU is active.
This is deliberate for V1A resilience and avoids incompatible context switching.

## WebGPU status

**PASS in the available Chromium/Dawn environment.** Browser validation showed:

- `data-world-renderer="webgpu"` and `data-render-status="active"`;
- visible GPU canvas at 1280x720;
- live normal scene with 4,324 instances and 2 draw calls;
- resize to 800x600 updated both CSS and backing dimensions while WebGPU stayed
  active;
- camera wheel input kept WebGPU active and changed the visible snapshot;
- no final uncaptured or validation errors.

Unsupported hardware/browser behavior is implemented as Canvas fallback but
cannot be hardware-tested on a WebGPU-capable test machine without disabling
WebGPU externally.

## Pixel art status

**PASS for V1A content.** Atlas min/mag/mipmap filters are nearest, no mip chain
exists, sprite edges are rounded to physical pixels, the GPU canvas is marked
pixelated, and screenshot inspection showed sharp tile/prop/entity pixels.
The DPR=2 camera/snapshot path is covered by the renderer test; the available
browser session rendered at DPR=1.

## Instance format

The fixed ABI is **48 bytes per instance**:

| Bytes | Field |
| ---: | --- |
| 8 | previous position (`float32x2`) |
| 8 | current position (`float32x2`) |
| 8 | visual size (`float32x2`) |
| 16 | UV rectangle (`float32x4`) |
| 4 | tint (`unorm8x4`) |
| 4 | layer (`float32`) |

This includes interpolation foundation without separate static/dynamic ABIs and
keeps color to four packed bytes.

## Draw calls

- Normal tested WebGPU scene: **2** (static/slow + dynamic).
- Synthetic benchmark: **1** for every tested count through 500k.
- Same deterministic Canvas scene: approximately **3,863** according to the
  existing Canvas estimator. This is not an exact API draw-call counter, but it
  demonstrates why batching is the V1A proof target.

## Benchmark results

Measured in the available 1280x720 Chromium/Dawn session. `Peak prep` is the
one-time CPU instance-pack cost. `Peak upload` includes instance bytes plus the
48-byte camera uniform. `Submission` is CPU command construction/submission,
not GPU execution time. Stable frame interval is display-capped and should not
be interpreted as a GPU saturation limit.

| Instances | Draws | Peak prep ms | Peak upload bytes | Allocated static buffer | Stable interval ms | CPU submission ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 1 | 6.0 | 480,048 | 524,288 | 16.8 | 0.0 |
| 50,000 | 1 | 15.9 | 2,400,048 | 4,194,304 | 17.3 | 0.1 |
| 100,000 | 1 | 24.8 | 4,800,048 | 8,388,608 | 16.5 | 0.3 |
| 250,000 | 1 | 64.0 | 12,000,048 | 16,777,216 | 16.5 | 0.2 |
| 500,000 | 1 | 123.3 | 24,000,048 | 33,554,432 | 16.5 | 0.1 |

After the first frame, the unchanged synthetic static scene uploads only the
48-byte camera uniform and has effectively zero snapshot preparation work.
Timestamp-query GPU timing was intentionally not invented or reported.

## Memory estimates

- Atlas: 512 x 512 x 4 = **1,048,576 bytes**.
- Quad vertices: **64 bytes**.
- Quad indices: **12 bytes**.
- Camera uniform allocation: **48 bytes**.
- Instance payload: count x **48 bytes**.
- Default static buffer allocation: **65,536 bytes**, growing by powers of two.
- Default dynamic buffer allocation: **65,536 bytes**, growing independently.
- Normal tested world allocation: 256 KiB static + 64 KiB dynamic + 1 MiB
  atlas, plus small fixed resources and depth.
- 1280x720 `depth24plus`: implementation-defined storage; approximately
  **3.52 MiB** if stored at four bytes per pixel.

Replaced buffers, depth targets, atlas, fixed buffers, context, and device have
explicit destruction/unconfigure paths. No GPU resource is created per frame.

## Visual parity status

**Foundation proven; full parity intentionally incomplete.** These deterministic
URLs form the manual/golden preparation mechanism:

- `/?renderer=canvas&renderSeed=424242`
- `/?renderer=webgpu&renderSeed=424242`

Both render the same generated world, camera controls, and DOM UI. Browser
screenshots were captured for each during validation. WebGPU reproduced terrain
layout, sharp sprite atlas visuals, simple buildings/entities, and the same UI
stack. Canvas remains visibly richer, as expected for V1A.

## Known differences

- Canvas retains complete procedural terrain details, edges, animated water,
  urban patterns, roads, rail, ships, caravans, particles, labels, health bars,
  badges, and all analytical overlays.
- WebGPU terrain uses one material sprite per terrain type plus sparse existing
  props; only temperature/resource replacement tint proofs are present.
- Building sprites use base atlas variants, not all era/damage/staffing variants.
- Entity proof uses one existing idle sprite per species rather than complete
  appearance/animation variants.
- Selection is a GPU bracket sprite; label text stays Canvas-only.
- UI remains DOM-based and CPU picking remains unchanged by design.

## Tests and build

Passed:

- `npm run build`;
- `npm run test:perf`;
- `npm run bench:perf`;
- `npm exec tsx -- tests/render-v1a.test.ts`;
- `tests/roads.test.ts`;
- `tests/infrastructure.test.ts`;
- live Canvas, WebGPU, resize, camera, parity, and all benchmark browser checks.

Additional repository checks found unrelated non-renderer failures:

- `tests/sim.smoke.ts` and `tests/journey.smoke.ts` construct a species no
  longer present in `SPECIES_DEFINITIONS`, failing in `Entity` construction;
- `tests/railway.test.ts` expects two components after severing but receives one.

No renderer code appears in those failure stacks, and RENDER-V1A did not alter
species or railway/simulation behavior.

## Known risks

- Per-city building traversal is acceptable for the proof but needs a render
  spatial index or chunk ownership before very large CITY-V1 populations.
- Global `terrainVersion` invalidates visible render chunks conservatively; a
  future per-chunk generation will avoid rebuilding unaffected visible chunks.
- Transparent sprites write depth after alpha discard; complex translucent
  overlap may need separate opaque/cutout/translucent passes.
- Device-loss fallback is implemented and the common failure route was tested,
  but a real physical device-removal event was not available.
- Atlas packing is fixed at initialization; runtime atlas paging/eviction is V1B.

## PLATFORM-V1A integration notes

RENDER-V1A did not modify `src-tauri`, Tauri configuration, platform services,
native filesystem behavior, save architecture, or Tauri scripts/dependencies.
The only shared file is `src/main.ts`; see `RENDER_V1A_SHARED_FILES.md`. The final
combined production build passes with the parallel platform configuration.

## RENDER-V1B recommendations

1. Add per-chunk terrain generations and static GPU ranges so camera movement
   can bind/reuse resident chunk ranges instead of repacking a visible slab.
2. Add road/rail instance or line passes and a territory/occupation mask pass.
3. Build dynamic atlas pages for entity appearance/animation and era-aware
   building variants.
4. Add a building/entity render spatial index fed by lifecycle events.
5. Split cutout and translucent visuals if richer effects require correct
   blending order.
6. Feed real simulation interpolation alpha while retaining previous/current
   instance positions.
7. Add timestamp-query GPU timing only behind feature detection.

Stop here: RENDER-V1B, WORLD-V1, CITY-V1, lighting, weather shaders, and GPU
particle systems are not part of this implementation.

