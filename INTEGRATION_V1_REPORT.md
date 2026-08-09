# Aethoria — INTEGRATION-V1 Desktop Runtime Validation

Date: 2026-08-08  
Scope: Tauri + TypeScript simulation + PERF-V1 + Canvas/WebGPU + native saves. No feature work, PLATFORM-V1B, RENDER-V1B, WORLD-V1, or CITY-V1 was implemented by this validation.

## ENVIRONMENT

| Requirement | Result |
|---|---|
| Windows host | PASS |
| Node | PASS — 24.18.0 |
| npm | PASS — 12.0.1 |
| WebView2 | PASS — 151.0.4129.72 |
| Rust stable | PASS — rustc 1.97.1 |
| rustup | PASS — 1.29.0, stable MSVC toolchain active |
| Cargo | PASS — 1.97.1 |
| Visual Studio Build Tools | PASS — 2022 17.14.37 |
| MSVC x64 tools | PASS |
| Windows SDK | PASS — 10.0.26100.0 |

Rustup, the stable Rust toolchain, Visual Studio Build Tools, the C++ workload, and the Windows SDK were installed from their official winget packages because they were the documented PLATFORM-V1A blocker.

## TOOLCHAIN

- `rustc --version`: PASS.
- `cargo --version`: PASS.
- `rustup show`: PASS; `stable-x86_64-pc-windows-msvc` is active.
- `cargo fmt --check`: PASS after applying rustfmt-only changes to the two PLATFORM-V1A Rust sources.
- `cargo check`: PASS; 418 packages locked and `src-tauri/Cargo.lock` generated.
- `cargo build --bin aethoria`: PASS.

## TAURI BUILD

PASS for the debug/no-bundle desktop checkpoint. The first `npm run tauri:build -- --no-bundle --debug` reached the native build but exceeded the command runner's 604-second first-build window while generating debug/static-library artifacts. The equivalent cached native build then completed successfully with `cargo build --bin aethoria`, and the resulting `target/debug/aethoria.exe` was booted and exercised. This is not a release bundle certification.

## TAURI BOOT

PASS. The real `aethoria.exe` opened a WebView2 window, exposed the Tauri runtime, rendered the HUD, ran a generated world and simulation, and closed normally through the window close request. It then reopened successfully. No crash occurred.

## INITIALIZATION ORDER

Observed composition order:

1. frontend modules and platform/storage boundary load;
2. `AethoriaGame` creates `RendererHost`;
3. Canvas becomes immediately available and WebGPU initialization starts only when requested;
4. the deterministic/demo world and simulation are created;
5. renderer diplomacy/selection references, DOM UI, screens, HUD, input, and resize handlers are attached;
6. the animation loop begins and the PERF-V1 scheduler admits simulation ticks;
7. native storage is invoked asynchronously on demand by `SaveSystem`.

`PlatformService` remains the only Tauri invocation boundary. `RendererHost` remains the Canvas/WebGPU owner.

## WEBGPU IN TAURI

PASS. Inside the Tauri WebView:

- `navigator.gpu`: available;
- adapter/device/context/pipeline/atlas/buffers/depth/frame submission: initialized through the real renderer path;
- `data-world-renderer`: `webgpu`;
- `data-render-status`: `active`;
- GPU canvas: visible at 1280×800;
- final observation window: zero uncaught exceptions, WebGPU validation errors, Tauri IPC errors, or renderer warnings.

Two integration blockers were found and fixed: an existing ship sprite exceeded the fixed atlas cell, and `SpatialHash` was imported as a type despite being constructed at runtime.

## CANVAS FALLBACK

PASS. Explicit Canvas boot was active and stable. During WebGPU blocker diagnosis, initialization failed safely to `canvas-fallback`; the simulation and UI stayed alive. After the blockers were fixed, the same Tauri runtime initialized WebGPU successfully.

## CAMERA / RESIZE / DPR

- Camera construction, centering, live simulation rendering, and selection-compatible renderer input: PASS by desktop smoke.
- Initial desktop canvas size: PASS at 1280×800.
- Extended small/large/maximized/fullscreen matrix: NOT APPLICABLE to the shortened validation requested by the user.
- Device pixel ratio: 1. High-DPI hardware validation above DPR 1 was not performed and is not claimed.

## SIMULATION

PASS for integration smoke. Citizens, a city, a realm, economy, trade, warfare timing, HUD updates, renderer snapshots, and scheduler activity were observed without an integration exception. This was not a gameplay-depth audit.

## GAME SPEEDS

PASS. Pause, 1×, 2×, 5×, and 10× were applied inside Tauri and read back as `[0, 1, 2, 5, 10]`.

## NATIVE SAVE

PASS. A real 3.53 MB `slot-1.aethoria` file was created under:

`%APPDATA%/com.aethoria.sandbox/Aethoria/saves/slot-1.aethoria`

The file was read from disk, not from localStorage. It contained `kind: "aethoria-save"`, `formatVersion: 3`, metadata, and a world payload with the expected seed.

## SAVE REOPEN / LOAD

PASS. Observed identity before close and after reopen/load was identical:

| Field | Saved | Loaded |
|---|---:|---:|
| Seed | 1 | 1 |
| Year | 3 | 3 |
| Population | 18 | 18 |
| Cities | 1 | 1 |
| Realms | 1 | 1 |

The loader accepted the document and returned to the live game.

## BACKUPS

PASS. Five writes to slot 2 left the active save plus exactly three `slot-2-*.aethoria` backups. Native delete was also exercised: slot 4 existed before deletion and was absent afterward.

## AUTOSAVE

PASS. Autosave created a real slot-0 native file. Two immediate triggers shared the same in-flight state, completed without overlap, and left the simulation alive. The temporary autosave setting was disabled again after validation.

## SECURITY

PASS for the requested quick review. The frontend sends only a numeric slot and serialized document. Rust resolves the app-data directory. The capability remains bound to the main window and five storage commands. No shell plugin, arbitrary filesystem path, broad HTTP permission, or renderer-owned filesystem access was introduced.

## MEMORY BASELINE

One actual 64² WebGPU desktop sample was captured using the Tauri process and its descendant WebView2 processes:

- Aethoria process working set: 26.1 MB;
- WebView2 descendant working set: approximately 752.8 MB;
- relevant process-tree working set: approximately 795.6 MB;
- relevant process-tree private memory: approximately 725.3 MB.

This is a debug/WebView2 sample with developer tooling and is not comparable to a release browser benchmark. Menu, 128², and 256² memory samples were not run in the shortened pass.

## CPU BASELINE

At 10× in the Tauri Canvas path with a 128² world:

| Metric | Average | p95 |
|---|---:|---:|
| Frame | 5.027 ms | 6.300 ms |
| Simulation | 0.478 ms | 1.900 ms |
| Rendering | 3.702 ms | 4.700 ms |
| Entity AI | 0.041 ms | 0.100 ms |

The app reported 60 FPS and scheduler debt remained 0.

## WEBGPU TELEMETRY

Successful Tauri WebGPU sample:

- visible instances: 6,535;
- draw calls: 15;
- peak upload: 313,680 bytes;
- static buffer allocation: 720,896 bytes;
- dynamic buffer allocation: 524,288 bytes;
- atlas allocation estimate: 60,817,408 bytes;
- frame submission: 0.300 ms;
- frame interval: 16.5 ms;
- 1280×800 depth target estimate: about 3.9 MiB at four bytes per pixel.

## 10X STABILITY

PASS for a short desktop checkpoint. There was no runaway scheduler debt, UI freeze, renderer crash, native save corruption, or uncaught error. This is not a long-duration soak certification.

## SOAK TEST

NOT APPLICABLE. A multi-minute soak and long-term RAM trend were skipped to satisfy the user's request to finish as quickly as possible.

## WEB COMPATIBILITY

PASS. The production web build completed, and the in-app browser smoke test loaded the main menu and Canvas at 1280×720 with no console error. The known Vite bundle-size warning remains.

## TEST MATRIX

| Runtime | Boot/UI | Renderer | Simulation/10× | Native save/load |
|---|---|---|---|---|
| Web + Canvas | PASS | PASS | PASS from PERF-V1/browser baseline | NOT APPLICABLE |
| Web + WebGPU | PASS from RENDER-V1A plus current build | PASS | PASS from RENDER-V1A | NOT APPLICABLE |
| Tauri + Canvas | PASS | PASS | PASS | PASS |
| Tauri + WebGPU | PASS | PASS | PASS | PASS |

## COMMAND RESULTS

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm run test:platform` | PASS; repository currently routes this script to an existing V1B test outside this task |
| `npm exec tsx -- tests/platform-v1a.test.ts` | PASS |
| `npm run test:perf` | PASS |
| `npm run bench:perf` | PASS |
| `npm exec tsx -- tests/render-v1a.test.ts` | PASS |
| `cargo fmt --check` | PASS |
| `cargo check` | PASS |
| debug/no-bundle native build equivalent | PASS |
| Tauri executable boot/reopen | PASS |

Final PERF A/B at 2,500 entities remained favorable: legacy full-tick average 13.941 ms versus relevance LOD 6.653 ms. Repeated cached path average was 0.006 ms with 99/100 hits. The run occurred while desktop validation processes were active, so it is not treated as a cleaner replacement for the PERF-V1 report.

## FILES CHANGED

- `src-tauri/Cargo.lock` — generated by Cargo;
- `src-tauri/src/lib.rs`, `src-tauri/src/storage.rs` — rustfmt only;
- `src/main.ts` — restored the required RendererHost, PERF scheduler/profiler, deterministic renderer seed, and asynchronous non-overlapping autosave merge;
- `src/platform/saveFormat.ts` — valid `unknown` type narrowing for the current TypeScript compiler;
- `src/renderer/webgpu/TextureAtlas.ts` — constrain oversized existing ship sprites to the existing fixed atlas cell;
- `src/renderer/webgpu/RenderSnapshot.ts` — runtime `SpatialHash` import and current typed-array compatibility;
- `INTEGRATION_V1_REPORT.md` — this report.

## BUGS FIXED

1. Shared `main.ts` had lost the PLATFORM/RENDER/PERF merge and treated an asynchronous save promise as a boolean.
2. TypeScript 7 required explicit numeric narrowing in the save format guard.
3. Current typed-array generics required a broader render snapshot backing type.
4. A cached ship sprite exceeded the fixed WebGPU atlas cell.
5. The WebGPU snapshot builder constructed a type-only `SpatialHash` import at runtime.

All fixes are integration blockers within the allowed scope.

## BLOCKERS

No acceptance-gate blocker remains. Release bundle/install testing, DPR above 1, exhaustive resize/fullscreen, failed-write filesystem mocking, 128²/256² memory capture, and long soak remain unvalidated.

## UNRELATED FAILURES

The source reports already list unrelated species smoke, railway assertion, technology UI, and warfare UI failures. They were not modified. A concurrent workspace change currently points `test:platform` at a PLATFORM-V1B test; this validation does not claim or implement PLATFORM-V1B.

## PLATFORM-V1B READINESS

YES for starting future work: the desktop runtime, IPC boundary, native save lifecycle, backups, delete, autosave, and reopen/load checkpoint all passed.

## RENDER-V1B READINESS

YES for starting future work: WebGPU initialized inside the real Tauri WebView2 runtime with clean final telemetry, and Canvas fallback remained alive.

## WORLD-V1 BLOCKERS

WORLD-V1 must still not start as part of this task. Existing PERF-V1 limits remain: monolithic Canvas memory, save size/serialization, dense local AI, and large-world storage/render chunking.

## DECISION OUTPUT

DESKTOP BASELINE ESTABLISHED: **YES**  
WEBGPU INSIDE TAURI VERIFIED: **YES**  
NATIVE FILE SAVE VERIFIED: **YES**  
PERF-V1 PRESERVED: **YES**  
SAFE TO START PLATFORM-V1B: **YES**  
SAFE TO START RENDER-V1B: **YES**  
SAFE TO START WORLD-V1: **NO**

Stop condition reached. No V1B, WORLD-V1, CITY-V1, or new gameplay feature was implemented by INTEGRATION-V1.
