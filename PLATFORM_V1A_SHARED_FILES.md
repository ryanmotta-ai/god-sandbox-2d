# PLATFORM-V1A Shared Files

## `src/main.ts`

**WHY CHANGE IS REQUIRED**  
Autosave is initiated directly in the application entry point. The native storage contract is asynchronous, so desktop autosave cannot use the old synchronous boolean-returning localStorage call without leaving autosave on the browser-only backend.

**EXACT CHANGE**  
Add one `autosaveInFlight` state flag and replace the body of `maybeAutosave()` with a non-overlapping `SaveSystem.writeSlot(...).then(...).catch(...).finally(...)` call. Pass the already available world seed into save metadata. Preserve the method signature and every caller.

**INTEGRATION RISK**  
Low and localized. RENDER-V1A should preserve the `autosaveInFlight` field and the `maybeAutosave()` implementation when merging its own entry-point work. PLATFORM-V1A does not change renderer construction, canvas selection, the render loop, WebGPU selection, snapshots, shaders, sprites, particles, camera rendering, or resize behavior.
