# RENDER-V1A Shared Files

| File | Change | Why | Merge risk |
| --- | --- | --- | --- |
| `src/main.ts` | Replace direct `PixelRenderer` construction/type with `RendererHost`; add optional deterministic `renderSeed` for parity captures. | This is the single composition root for renderer selection. All WebGPU implementation remains in new modules. | Medium: PLATFORM-V1A also touches the entry point. The renderer changes are limited to one import, one field type, one constructor call, and the DEV seed expressions. No platform/save APIs or lifecycle were changed. |

No `src-tauri`, Tauri configuration, native filesystem, platform service, or
Tauri package-script file was modified by RENDER-V1A.

