# PLATFORM-V1A Audit

Audit date: 2026-08-08  
Scope: Tauri desktop foundation only. Renderer, simulation, world generation, entity AI, scheduler, and PERF-V1 behavior are explicitly out of scope.

## CURRENT RUNTIME

- Aethoria is a single-page TypeScript application running directly in a browser/WebView DOM.
- `index.html` owns the canvas and UI mount points and loads `/src/main.ts` as the only application entry point.
- `src/main.ts` constructs the game immediately, registers window/input handlers, creates a menu background world, and starts a `requestAnimationFrame` loop.
- Runtime state is held in TypeScript classes. There is no native backend, platform service, environment service, service worker, Web Worker, or Node-only runtime dependency.
- Development-only globals are exposed through `window` under `import.meta.env.DEV`.
- There is no central WEB/TAURI runtime detection and no current `navigator.gpu` probe.
- The application currently has no dirty-save state or close-confirmation abstraction.

## BUILD PIPELINE

- Package manager: npm with `package-lock.json` lockfile version 3.
- Current tool versions in the lockfile/package manifest: Vite 8.2.0, TypeScript 7.0.2, and tsx 4.23.4.
- Existing commands:
  - `npm run dev` -> Vite development server.
  - `npm run build` -> `tsc && vite build`.
  - `npm run preview` -> Vite production preview.
  - `npm run test:perf` and `npm run bench:perf` -> PERF-V1 validation added by the existing parallel work.
- There is no `vite.config.*`; Vite defaults are in use.
- `tsconfig.json` targets ES2022, DOM, and bundler module resolution with strict checking and no emitted TypeScript output.
- The pre-change `npm run build` passes. Vite transforms 146 modules and emits approximately 1.22 MB of JavaScript (351.76 kB gzip). The existing large-chunk warning is unrelated to PLATFORM-V1A.
- Node 24.18.0 and npm 12.0.1 are present. Rust and Cargo are not installed/discoverable in this environment, so a native compile/run cannot be completed here unless the host toolchain changes.
- As of the audit, npm reports `@tauri-apps/cli` 2.11.4 and `@tauri-apps/api` 2.11.1. PLATFORM-V1A will use Tauri v2.

## BROWSER DEPENDENCIES

### Required by the game/UI

- DOM construction and events (`document`, `window`, keyboard, pointer, resize, focus/blur handling in UI helpers).
- HTML Canvas 2D for the current renderer, generated sprites, previews, charts, and minimap.
- `requestAnimationFrame`, timers, viewport dimensions, and `devicePixelRatio`.
- Web Audio (`AudioContext`) for synthesized sound.
- Browser dialogs (`confirm`) in the save/load UI.
- `Blob`, object URLs, synthetic download anchors, `FileReader`, and file inputs for current JSON export/import.
- `localStorage` for save slots and settings.

These APIs are supported by Tauri's system WebView and do not require gameplay or renderer changes.

### Assets and networking

- There are no fetched game assets, public asset folders, or runtime `fetch` calls.
- Sprites and previews are generated in canvas code.
- `index.html` loads Outfit and Silkscreen from Google Fonts. This is the only external production asset and creates an offline/CSP risk. PLATFORM-V1A will allow only those font origins rather than granting broad remote access; bundling fonts can be considered later.
- The `/src/main.ts` absolute development path is processed into hashed relative `dist/assets/*` output by Vite, which is compatible with Tauri's `frontendDist` protocol.

### Workers and GPU

- No Web Worker, Shared Worker, or service worker exists.
- No current production code references `navigator.gpu`; WebGPU availability must be observed centrally without implementing or changing a renderer.

## STORAGE DEPENDENCIES

### SAVE DATA

- Active save code is `src/core/SaveSystem.ts`; `src/civ/SaveSystem.ts` is an unused older duplicate.
- Slot 0 is autosave and slots 1-4 are manual saves.
- Payload keys are `aethoria_slot_<n>` and metadata keys are `aethoria_slot_<n>_meta`; the legacy quick-save key is `aethoria_savegame`.
- Slot list/read/write/delete operations are synchronous `localStorage` calls.
- Saves use JSON and currently embed a literal version `3`; there is no centralized `SAVE_FORMAT_VERSION`.
- Metadata currently contains a display name and optional data-URL thumbnail. Other displayed metadata is derived by parsing the full world payload.
- Serialization/deserialization owns simulation-domain knowledge in TypeScript, which is the correct side of the Rust boundary and must remain there.
- Autosave in `src/main.ts` calls the same synchronous storage API.
- Large saves are not ready: stringify/parse happen on the UI thread and browser quota is a known blocker. PLATFORM-V1A can make file I/O asynchronous, but moving serialization to a worker or adding compression is later work.

### SETTINGS

- `aethoria_settings_v1` in `src/ui/core/Settings.ts` stores small settings and UI/game preferences.
- This is not world save data and may remain in WebView `localStorage` during PLATFORM-V1A.

### UI PREFERENCES

- UI-scale, graphics toggles, sound, autosave options, and related preferences are part of the settings record above. They are appropriately small and not required to migrate to save files.

### TEMPORARY DATA

- No separate temporary-data storage key was found.
- Chronicle comments mention localStorage size, but Chronicle data is serialized inside the world save rather than stored independently.

### IMPORT / EXPORT

- Import/export currently uses portable `.json` files through browser file controls and must remain functional.
- PLATFORM-V1A will reserve and use `.aethoria` for managed desktop slot files while accepting existing `.json` and `.aethoria` files in the portable import path. A serialization redesign is out of scope.

## TAURI RISKS

1. **Missing host toolchain:** Rust/Cargo are unavailable, so Tauri source can be configured and reviewed but not compiled or launched in the current environment.
2. **Shared entry point:** `src/main.ts` is already modified by PERF-V1 and is also a likely RENDER-V1A integration point. Desktop autosave requires one narrowly scoped asynchronous call-site change. This must be recorded in `PLATFORM_V1A_SHARED_FILES.md` and must not touch renderer setup.
3. **Dirty active save file:** `src/core/SaveSystem.ts` contains existing uncommitted localization changes. PLATFORM-V1A must preserve them while replacing only the storage-facing portion and centralizing format version.
4. **Large IPC payloads:** Initial native saves reuse JSON strings, potentially tens of MB. Tauri invoke is asynchronous but still duplicates/serializes data across IPC. Streaming/binary serialization/compression belongs to PLATFORM-V1B or a measured later milestone.
5. **Synchronous serialization:** `JSON.stringify`/`JSON.parse` remains CPU work on the frontend. Native async file I/O alone does not eliminate UI pauses for very large worlds.
6. **Atomic replacement:** Cross-platform replacement behavior differs, especially on Windows. The native backend must write and validate a same-volume temporary file, preserve the previous target as a backup, then promote the new file, restoring the old file if promotion fails.
7. **Path traversal:** The frontend must never supply arbitrary filesystem paths. Native commands should accept only validated slot/category identifiers and resolve all paths under the application data directory.
8. **Capability exposure:** No shell plugin or general filesystem plugin is needed. Only the main local window and narrowly named application commands should be allowed.
9. **Remote fonts:** Google Fonts requires a small CSP exception and will not be available offline.
10. **WebView/WebGPU variability:** `navigator.gpu` depends on OS WebView, drivers, and policy. Detection can be documented; renderer implementation remains with RENDER-V1A.
11. **Close safety:** There is no dirty-state contract to query. PLATFORM-V1A will document close confirmation/autosave coordination for PLATFORM-V1B rather than inventing gameplay UX.
12. **Window event semantics:** Existing browser resize and UI blur listeners should continue to work in the WebView. Fullscreen compatibility will be provided by a normal resizable/decorated window without adding a new gameplay fullscreen flow.

## FILES TO MODIFY

- `package.json` and `package-lock.json`: add Tauri API/CLI and desktop scripts while preserving existing PERF-V1 scripts.
- `src-tauri/**` (new): Rust package, Tauri configuration, capability/permission definitions, icons as required by packaging, and constrained native save commands.
- `src/platform/**` (new): centralized runtime detection/platform service, save format constants/types, storage interface, and web/Tauri storage backends.
- `src/core/SaveSystem.ts`: preserve simulation serialization while routing slot I/O through the asynchronous storage abstraction and centralizing the save format version.
- `src/civ/SaveSystem.ts`: replace the unused duplicate implementation with a compatibility re-export so there is only one save architecture.
- `src/ui/screens/SaveLoadScreen.ts`: minimally await slot I/O, report failures, and preserve portable import/export with `.aethoria` support.
- `src/main.ts`: minimally convert the autosave call site to asynchronous I/O. No renderer construction, render loop, camera, snapshot, or WebGPU code will be changed.
- `.gitignore`: exclude Rust/Tauri build output without excluding `src-tauri/Cargo.lock`.
- `PLATFORM_V1A_SHARED_FILES.md` (new): record the unavoidable `src/main.ts` integration.
- `PLATFORM_V1A_REPORT.md` (new): final implementation and validation record.
- Focused PLATFORM-V1A tests may be added under `tests/` for the web storage backend, validation, and platform-independent save envelope behavior.

## FILES TO AVOID

- `src/renderer/**`, including Canvas/WebGPU architecture, sprites, particles, overlays, shaders, atlases, camera rendering, and snapshots used by rendering.
- `src/world/TileMap.ts`, `src/world/WorldGenerator.ts`, and all world-generation architecture.
- `src/ai/**`, `src/entities/**`, `src/civ/**` gameplay systems (except the unused SaveSystem compatibility re-export), `src/powers/**`, and scheduler/PERF-V1 modules.
- PERF-V1 tests, benchmarks, architecture, and reports.
- Unrelated UI translation/design changes already present in the dirty worktree.

## IMPLEMENTATION PLAN

1. Add Tauri v2 around the existing Vite build with `dev`, `build`, `tauri:dev`, and `tauri:build` workflows.
2. Configure a normal high-DPI-capable game window (1280x800, 960x600 minimum, resizable, decorated, fullscreen-compatible) with development Web Inspector behavior supplied by Tauri debug builds.
3. Use a local-only capability for the `main` window. Do not install or permit shell execution, broad filesystem access, arbitrary paths, or remote IPC origins.
4. Add a centralized `PlatformService` that reports `web` or `tauri`, exposes the WebGPU availability observation, and is the only frontend module that directly invokes native commands.
5. Add an asynchronous `SaveStorage` interface with `save`, `load`, `list`, `delete`, and `exists`. Back it with current localStorage on web and constrained native commands on desktop.
6. Store desktop saves under the OS application-data directory in `Aethoria/saves`, `Aethoria/autosaves`, and `Aethoria/backups`; never use the executable directory or a frontend-provided absolute path.
7. Wrap the existing payload and metadata in a versioned `.aethoria` document. Read legacy web keys and preserve JSON import/export compatibility.
8. Implement same-directory temporary write, parse/version validation, file sync, backup of the previous target, promotion, and rollback on failure. Keep Rust limited to infrastructure and opaque JSON/document handling.
9. Migrate only active save call sites to asynchronous I/O; leave small settings in localStorage.
10. Validate TypeScript/web production build, focused storage tests, existing test/performance commands, Rust formatting/static checks if tools become available, and Tauri build/dev only where the missing toolchain permits.
11. Record WebGPU runtime probe status, memory-observation limitations, known issues, shared-file integration, and PLATFORM-V1B follow-ups in the final report, then stop.
