# PLATFORM-V1A Report

Completion date: 2026-08-08  
Scope: Tauri desktop foundation, platform boundary, and save-storage foundation. No gameplay, simulation, world-generation, PERF-V1, Canvas renderer, or WebGPU renderer implementation is part of this work.

## IMPLEMENTED ARCHITECTURE

PLATFORM-V1A adds a Tauri v2 shell around the existing Vite/TypeScript application and retains the browser runtime. The frontend chooses one of two storage backends through a central platform service:

```text
SaveSystem (simulation serialization remains TypeScript)
  -> asynchronous SaveStorage contract
       -> WebSaveStorage (legacy-compatible localStorage backend)
       -> TauriSaveStorage (slot-only IPC adapter)
            -> Rust app commands
                 -> OS app-data/Aethoria/{saves,autosaves,backups}
```

Rust knows only slots, versioned JSON documents, metadata containers, paths, and bytes/text. It does not import or model Citizen, City, Realm, Economy, War, Politics, TileMap, world generation, or renderer state.

The new `.aethoria` document is a JSON envelope:

- `kind: "aethoria-save"`;
- centralized `formatVersion: 3` (`SAVE_FORMAT_VERSION`);
- metadata for save/game version, world name, timestamp, seed, year, era, population, realms, playtime readiness, dimensions, and optional thumbnail;
- the existing TypeScript save payload under `payload`.

Existing raw JSON saves remain importable. Portable exports now use `.aethoria`; the file picker accepts both `.aethoria` and legacy `.json`.

## TAURI VERSION

- Tauri architecture: v2.
- `@tauri-apps/cli`: 2.11.4.
- `@tauri-apps/api`: 2.11.1.
- Rust `tauri`: 2.11.5 declared in `Cargo.toml`.
- Rust `tauri-build`: 2.6.3 declared in `Cargo.toml`.
- Host WebView2 detected by `tauri info`: 151.0.4129.72.

The setup follows Tauri's official [Vite integration](https://v2.tauri.app/start/frontend/vite/), [application command](https://v2.tauri.app/develop/calling-rust/), [capability](https://v2.tauri.app/security/capabilities/), and [CSP](https://v2.tauri.app/security/csp/) guidance.

## BUILD COMMANDS

- `npm run dev` — browser/Vite development on fixed port 1420.
- `npm run build` — TypeScript check plus Vite production build.
- `npm run preview` — browser production preview.
- `npm run tauri:dev` — Tauri debug application with Vite HMR and debug Web Inspector support.
- `npm run tauri:build` — Tauri production build/bundle.
- `npm run test:platform` — PLATFORM-V1A format/storage/boundary tests.
- `npm run test:perf` and `npm run bench:perf` — preserved PERF-V1 commands.

`vite.config.ts` preserves the project's ES2022 target, fixes the development port, prevents Vite from clearing Rust errors, ignores `src-tauri` in the frontend watcher, supports `TAURI_DEV_HOST`, and produces debug sourcemaps only for Tauri debug builds.

## PLATFORM ABSTRACTION

`src/platform/PlatformService.ts` is the only frontend location that imports Tauri core APIs or invokes native commands. It exposes:

- centralized runtime detection: `web` or `tauri`;
- `isDesktop`;
- a central `navigator.gpu` availability observation;
- the native invocation boundary used only by platform adapters.

No `window.__TAURI__` checks were added. Gameplay and simulation code do not call native commands.

## STORAGE ABSTRACTION

`SaveStorage` is asynchronous and defines:

- `save(slot, serializedDocument)`;
- `load(slot)`;
- `list()`;
- `delete(slot)`;
- `exists(slot)`.

`SaveSystem` still owns all domain serialization/deserialization. Only its slot persistence is delegated. This keeps the Rust boundary infrastructure-only and avoids coupling simulation classes to either Tauri or localStorage.

Errors are normalized into explicit codes, including permission denied, disk full/quota, corrupted file, missing file, invalid/unsupported format, write failure, rollback failure, path failure, and runtime/I/O failure. Manual save/load/delete and autosave report failures without claiming success.

## FILESYSTEM

The desktop frontend can provide only a numeric slot from 0 through 4 and a validated `.aethoria` document. It cannot provide a path.

For each native write, Rust:

1. validates the slot and envelope shape;
2. creates the controlled directory structure;
3. writes a unique temporary file in the target directory;
4. flushes and synchronizes the temporary file;
5. reads and validates the temporary file;
6. moves the previous target into `backups/` if present;
7. promotes the temporary file;
8. rolls back the previous target if promotion fails;
9. retains the three newest backups per slot.

The old save is never deleted before the new temporary save has been written and validated. This is rollback-safe staged replacement, but it is not yet a single OS-level atomic replace: a power loss between backup and promotion can leave the old file in `backups/` with no active target. Automatic recovery of that case is a PLATFORM-V1B item.

Native commands run blocking filesystem work on Tauri's blocking executor and expose promise-based APIs to the UI.

## SAVE LOCATION

The root comes from Tauri's `app_data_dir`, which resolves under the OS data directory plus the bundle identifier `com.aethoria.sandbox`. Aethoria then creates:

```text
<app-data>/com.aethoria.sandbox/Aethoria/
  saves/
    slot-1.aethoria ... slot-4.aethoria
  autosaves/
    autosave-0.aethoria
  backups/
    slot-N-<timestamp>.aethoria
    autosave-0-<timestamp>.aethoria
```

No absolute save path, home-directory path, executable-directory path, or user-selected arbitrary path is hardcoded or accepted over IPC. Tauri's documented [app data resolver](https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html#method.app_data_dir) supplies the base directory.

## SECURITY/CAPABILITIES

- One capability: `main-save-storage`.
- Local bundled content only; no remote IPC origins.
- Bound only to the window label `main` and desktop platforms.
- One permission set allowing exactly five Aethoria storage commands.
- No shell plugin and no arbitrary shell execution.
- No filesystem plugin and no global filesystem scope.
- No opener, HTTP, dialog, process, updater, or other native plugin permission.
- Application commands are registered in the Tauri app manifest so they are controlled by the capability rather than implicitly exposed to every window.
- CSP defaults to self/local Tauri assets and IPC. The only remote exceptions are the existing Google Fonts stylesheet/font origins; images additionally allow the existing data/blob thumbnails.
- Debug Web Inspector behavior comes from Tauri debug builds; production does not enable or depend on a devtools feature.

## WEB COMPATIBILITY

- Browser development and production builds remain functional.
- `WebSaveStorage` reads existing `aethoria_slot_N` payloads and legacy metadata keys.
- New browser saves use the `.aethoria` envelope behind the same slot keys.
- Browser quota fallback retries without only the thumbnail and restores the prior slot if a write fails.
- Small settings/UI preferences remain in `aethoria_settings_v1` localStorage by design.
- The unused pre-slot `aethoria_savegame` quick-save compatibility path is isolated under the web platform storage folder.
- Current Blob/download/FileReader import/export behavior is preserved and extended to `.aethoria`.
- Vite production asset URLs work under `frontendDist`; generated sprites remain canvas-based. Google Fonts still requires network access.

Browser UI validation exercised main menu, world setup, a new 64² world, live HUD/simulation, save screen listing, manual save metadata/thumbnail, and load/restore. No console warnings or errors were captured during that flow.

## WEBGPU AVAILABILITY

- PLATFORM-V1A adds a central capability observation (`platform.webGpuAvailable`) but does not select, initialize, or implement a renderer.
- The parallel RENDER-V1A implementation remains responsible for `navigator.gpu`, adapter/device/context setup, and Canvas fallback.
- RENDER-V1A reports a successful WebGPU run in its available Chromium/Dawn environment, and its snapshot tests pass in the combined worktree.
- The default in-app browser used for PLATFORM-V1A UI validation reported `navigator.gpu` unavailable while Canvas gameplay remained functional.
- The host has WebView2 151.0.4129.72, but availability inside the actual Tauri window is **not verified** because the host lacks the native build toolchain. No claim is made that desktop WebGPU was exercised.
- Tauri configuration does not add a renderer restriction or a CSP rule that deliberately blocks WebGPU.

## FILES CHANGED

Foundation/configuration:

- `.gitignore`;
- `package.json` and `package-lock.json`;
- `vite.config.ts`;
- `src-tauri/Cargo.toml`, `build.rs`, `tauri.conf.json`;
- `src-tauri/capabilities/main-save-storage.json`;
- `src-tauri/permissions/save-storage.toml`;
- `src-tauri/src/main.rs`, `lib.rs`, `storage.rs`;
- `src-tauri/icons/**` (Tauri-generated desktop/mobile icon variants from the included SVG source; desktop bundle references only the desktop icon set).

Platform/storage:

- `src/platform/PlatformService.ts`;
- `src/platform/saveFormat.ts`;
- `src/platform/storage/SaveStorage.ts`;
- `src/platform/storage/WebSaveStorage.ts`;
- `src/platform/storage/TauriSaveStorage.ts`;
- `src/platform/storage/legacyWebSave.ts`;
- `src/platform/storage/index.ts`.

Minimal integration:

- `src/core/SaveSystem.ts`;
- `src/civ/SaveSystem.ts` (compatibility re-export of the active system);
- `src/ui/screens/SaveLoadScreen.ts`;
- `src/main.ts` (asynchronous non-overlapping autosave only; see shared-file report).

Tests/documentation:

- `tests/platform-v1a.test.ts`;
- `PLATFORM_V1A_AUDIT.md`;
- `PLATFORM_V1A_SHARED_FILES.md`;
- `PLATFORM_V1A_REPORT.md`.

The working tree contained many unrelated PERF, renderer, gameplay, UI, and localization changes before/during this work. PLATFORM-V1A preserved them and did not revert them.

## TEST RESULTS

### Passing

- Pre-change web production build: pass (146 modules).
- Final `npm run build`: pass (162 modules; ~1.266 MB JS / 374.12 kB gzip).
- `npm run test:platform`: pass.
  - `.aethoria` version/metadata/payload round trip;
  - legacy raw JSON migration;
  - web save/load/list/delete/exists;
  - quota fallback preserving world data;
  - central WEB/TAURI detection;
  - native command contract with no path argument.
- Browser UI/new game/simulation/manual save/load flow: pass; no console warnings/errors.
- `npm run test:perf`: pass.
- `npm run bench:perf`: pass.
  - 2,500-entity legacy full tick average: 9.023 ms;
  - relevance LOD average: 4.297 ms;
  - 256² tile JSON: 14,010,263 bytes, 100.9 ms stringify in this run;
  - path cache and staggered diplomacy probes completed.
- `tests/render-v1a.test.ts`: pass in the combined worktree.
- `tests/infrastructure.test.ts`: pass.
- `tests/roads.test.ts`: pass.
- `npm audit` and `npm audit --omit=dev`: 0 vulnerabilities after patching transitive `nanoid` from 3.3.16 to 3.3.18.
- `npx tauri info`: configuration parsed; WebView2 and JS Tauri versions detected.
- Focused `git diff --check`: pass.

### Native validation blocked by host prerequisites

- `npm run tauri:build -- --no-bundle`: blocked before compilation because `cargo` is not installed.
- `npm run tauri:dev`: not started because the same Rust/MSVC prerequisites are absent.
- `cargo test`, `cargo check`, and `cargo fmt`: unavailable.
- Native filesystem save/load/backup test: unavailable without a runnable Tauri binary.
- Tauri startup/world-loaded memory: unavailable; browser memory was intentionally not substituted as a cross-runtime benchmark.
- Tauri-window `navigator.gpu`: unavailable for the same reason.

`tauri info` specifically reports missing Rust/rustup/Cargo and no Visual Studio/Build Tools instance with the required MSVC and Windows SDK components. WebView2 is installed.

### Current unrelated dirty-worktree failures

These traces contain no PLATFORM-V1A module and were not modified because they belong to gameplay/parallel work:

- `sim.smoke.ts`, `journey.smoke.ts`, and `railway.sim.ts`: `Entity` construction receives an undefined species config (`baseHp`).
- `railway.test.ts`: severed-component assertion expected 2, received 1.
- `technology-ui.test.ts`: assertion expected 1, received 0.
- `warfare-ui.test.ts`: expected `Capital threatened` condition is absent.

## KNOWN ISSUES

1. Native compilation/startup is unverified until Rust/Cargo and Windows MSVC/SDK prerequisites are installed.
2. `src-tauri/Cargo.lock` could not be generated without Cargo. It should be generated and committed on the first toolchain-enabled build.
3. Large saves still require frontend `JSON.stringify`/`JSON.parse` and a large string crossing Tauri IPC. File I/O is asynchronous, but serialization and IPC copies can still pause/use substantial memory.
4. Native list currently parses each full save document to obtain embedded metadata; a sidecar/header/index may be needed for very large save collections.
5. Web saves intentionally retain localStorage quota limits during the compatibility phase.
6. The staged backup/promote algorithm preserves data but is not a one-operation OS atomic replacement; automatic backup recovery after power loss is not implemented.
7. Native first-run migration of old WebView localStorage slots is not implemented.
8. Portable import/export still uses WebView file/download controls in desktop; native dialogs are deferred.
9. Google Fonts are external and unavailable offline.
10. The existing production bundle remains over Vite's 500 kB warning threshold; PLATFORM-V1A added no measured simulation regression.
11. There is no dirty-state contract or close-confirmation UX.
12. Save API payloads are still `any` at the domain serialization boundary; stronger schema/migration validation is future work.

## PLATFORM-V1B TODO

- Install/verify Rust stable through rustup plus Visual Studio Build Tools/MSVC/Windows SDK; generate `Cargo.lock` and run native dev/release builds.
- Exercise native new game, simulation, UI, save, load, delete, backup rotation, permission failure, disk-full behavior, power-loss recovery, WebGPU/fallback, and startup/world memory.
- Add startup recovery when the active target is missing but a valid backup exists; evaluate OS-specific atomic replace primitives.
- Add a per-slot native write queue/lock and measured cancellation/close coordination.
- Add first-run migration from legacy WebView save slots to `.aethoria` files.
- Move large serialization toward workers/streaming/binary payloads and benchmark IPC copies before choosing compression or Rust acceleration.
- Add a lightweight metadata index/sidecar so listing does not parse tens or hundreds of MB.
- Add optional native open/save dialogs for portable import/export with explicit `.aethoria` filters.
- Introduce save schema validation/migrations and fully populate playtime/world-name metadata.
- Add dirty-state/close-safety UX without changing gameplay semantics.
- Bundle fonts locally if offline desktop operation is required.

## RENDER-V1A INTEGRATION NOTES

- RENDER-V1A and PLATFORM-V1A share only `src/main.ts`.
- The combined file contains RENDER-V1A's `RendererHost` composition and PLATFORM-V1A's asynchronous `maybeAutosave()` change without overlap. Both shared-file reports describe their exact merge surfaces.
- Final combined TypeScript/Vite build and RENDER-V1A snapshot tests pass.
- PLATFORM-V1A does not touch `src/renderer/**`, render snapshots, shaders, atlas, camera rendering, Canvas fallback, or WebGPU selection.
- `PlatformService.webGpuAvailable` is an environment observation for platform diagnostics. `RendererHost` remains the owner of renderer initialization/fallback and should not be moved into Rust/Tauri.
- The normal Tauri window is decorated, resizable, high-DPI compatible, and has a 960x600 minimum; existing resize handling and RENDER-V1A DPR logic remain active.
- The CSP permits local application code and IPC and does not add a WebGPU-specific blocker. RENDER-V1A's `?renderer=webgpu` path must still be tested inside a toolchain-enabled Tauri window.

## ACCEPTANCE STATUS

Architecture, browser compatibility, centralized detection, safe native filesystem design, asynchronous storage, `.aethoria` readiness, minimum privileges, save integration, renderer separation, and documented build/test status are complete.

The following runtime acceptance points are **implemented but not verified on this host**: Tauri app startup, gameplay inside the desktop window, real native filesystem save/load, desktop WebGPU availability/fallback, and Tauri memory observation. The blocker is the missing host-native build toolchain, not a reported application compile error; native project code has not yet reached compilation.
