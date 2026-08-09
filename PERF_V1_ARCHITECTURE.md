# Aethoria — PERF-V1 Architecture

## Scope and invariants

PERF-V1 changes how often work runs and how derived data is found. It does not remove citizens, change economic/combat coefficients, enlarge the world, or implement WORLD-V1/CITY-V1. Citizen identity, family, job, inventory, history, position and relationships remain on the original `Entity` objects. Derived caches and indexes are deliberately absent from save files and rebuild after load.

## Adopted budgets

| Area | Target |
|---|---:|
| Render p95 | ≤ 12 ms |
| Amortized simulation, normal play | ≤ 5 ms/frame |
| UI | ≤ 1.5 ms/frame |
| Common individual 1× tick | ≤ 16.7 ms |
| Scheduler work budget | 5 ms/frame, 48 ticks maximum, 240 ticks maximum debt |

The scheduler budget is a throughput guard, not a balance coefficient. When a machine cannot consume requested high-speed work in one frame, the game carries a bounded debt instead of freezing for an unbounded burst.

## Profiler

`PerformanceProfiler` keeps bounded rolling windows of 300 samples and reports average, p95 and maximum for frame, simulation, render, entity AI, pathfinding, economy, warfare, trade and UI. Counters cover total/HOT/WARM/COLD entities, visible entities, approximate draw calls, path calls/second, cache hits/misses, scheduler throughput/debt and network rebuilds.

The existing F3 debug panel is the DEV surface. It refreshes four times per second and does not log every frame.

## Scheduler and cadences

`SimulationScheduler` is the only new timing authority. It uses fixed, ordered ticks, stable global phases and no independent JavaScript timers.

| System | Cadence/trigger |
|---|---|
| Camera, renderer, visible effects | animation frame |
| HOT entity AI/local combat | every simulation tick |
| WARM entity AI | one stable phase per 6 ticks |
| COLD entity AI/ecology | one stable phase per 30 ticks |
| Fire | scheduler cadence; only active-fire set is visited |
| Fluid | scheduler cadence; immediate return unless terrain is dirty |
| Diplomacy | one of 10 stable realm-pair slices per tick |
| Needs/household economy | every in-world day (600 ticks) |
| City economy, market, politics, technology, demographics, trade discovery, rail freight, strategic warfare | every in-world year (7,200 ticks) |
| Chronicle | event-driven |
| UI snapshots/selections | existing UI-12 cadences and dirty events |

At 1×/2×/5×/10×, fixed ordering is preserved. High speed increases useful throughput until the frame budget is reached; it no longer means “run up to 120 complete worlds now.”

## Entity relevance and LOD

`EntityRelevanceTracker` is the single relevance policy:

- HOT: camera-local, selected/tracked, combat/flee/siege/raid, low health or environmental hazard.
- WARM: city-distance band and offscreen systemic actors such as rulers, leaders, Great Persons and starving citizens.
- COLD: distant and stable actors with no critical state.

Stable FNV-style ID phasing distributes WARM/COLD work fairly. Warming is immediate; cooling holds HOT for 60 ticks and WARM for 180 ticks to prevent camera-edge thrashing. Cooldowns, emotes, hazard damage and regeneration account for elapsed cadence. Distant movement uses a bounded stride to avoid tunnelling across impassable tiles. Annual structural/economic rules remain exact and are not replaced with invented aggregate yields.

The feature flag `sim.performanceFeatures.entityLOD` remains available for controlled A/B diagnostics.

## Spatial indexes

The generic tile-aligned `SpatialHash` now maintains item→cell membership incrementally. Spawn, movement and death update it; load/bulk replacement triggers one rebuild. It supports radius and viewport rectangle queries with reusable output arrays, plus cheap DEV validation every 600 ticks.

The simulation also maintains:

- O(1) entity identity lookup;
- a city spatial hash and `citiesNear`;
- `entitiesNear`;
- tile-grid `findBuildingTilesNear`;
- existing tile-grid resource surveys.

This keeps the tile grid as the primary spatial structure and avoids an unnecessary quadtree/ECS rewrite.

## Path cache and invalidation

`SimplePathfinder` now wraps A* with a 256-entry LRU. Keys include map identity, origin/destination tile, travel mode, node budget, agent seed and relevant terrain/road generation counters. Hits return copies, so callers cannot mutate cached paths. Empty/unreachable results are cached too.

A* hot bookkeeping uses packed numeric tile keys rather than allocating `"x,y"` strings. The profiler records call duration and cache hit/miss rate. `configureCache` and `clearPathCache` support benchmark A/B runs.

`TileMap` owns monotonic `terrainVersion`, `roadNetworkVersion` and `railNetworkVersion`. Terrain brushes, road construction/decay/damage/repair, track construction/removal/damage/repair and load update the relevant version. This is conservative and correct: road changes currently invalidate land/road path entries globally. WORLD-V1 should narrow this to regional/component generations after hierarchical routing exists.

## Network and economic caches

Rail tiles, operative connected components and station→component membership are cached against `railNetworkVersion`. Repeated `connected`, construction and freight queries reuse the same topology. Track changes invalidate immediately; no graph is serialized.

The civilization yearly pass builds one city→entities index and realm worker totals. Production and economic-pressure calculations no longer perform city×all-entities or realm×all-entities scans. Trade reachability, kind, road quality and capacity are calculated once per city pair, not once per good. Existing routes remain persistent; discovery and operation remain separate.

Diplomacy retains its full matrix semantics but spreads the matrix into ten stable slices, removing the periodic O(R²) frame spike. A future WORLD-V1 relevance graph can reduce the total pair count to neighbors, allies, trade partners and war participants.

## World scan reduction

Fire maintains an active tile set and visits only burning tiles and their immediate spread candidates. Fluids use a dirty flag and sleep once stable. Renderer terrain keeps the existing dirty-tile bake and now also receives logical 32×32 dirty chunk IDs as the handoff point for future chunk canvases.

## Render and effect budgets

The renderer queries the entity spatial index for viewport plus margin and only sends that set through individual sprite rendering. Far zoom already uses city macro presence and omits individual entities/building micro-detail. Tile, road, rail and analytical passes remain viewport-bounded.

Particles retain the existing pool but now have a hard 250-particle global cap, camera-relevance rejection for ambient effects and a 160-projectile cap. Projectiles are gameplay-bearing, so the oldest impact is resolved before capacity is reused rather than silently losing damage.

The remaining render blocker is the single world-sized static terrain canvas. Logical dirty chunks exist, but WORLD-V1 must replace the monolithic canvas with bounded chunk surfaces.

## Cache lifecycle and bounds

| Derived structure | Bound/lifecycle |
|---|---|
| Profiler samples | 300 per metric |
| Path LRU | 256 entries, oldest evicted |
| Spatial/entity/city indexes | cardinality bounded by live world objects; delete/rebuild hooks |
| Rail topology | cardinality bounded by current rail tiles; one generation cached |
| Population aggregates | rebuilt once/year; cardinality bounded by cities/realms/entities |
| Active fire set | bounded by world tiles; entries removed on burnout |
| Dirty chunks/tiles | bounded by world tiles/chunks; cleared after bake |
| Particles/projectiles | 250/160 hard caps |

## Reproducible validation

- `npm run test:perf`: scheduler speeds, relevance transitions/hysteresis, identity preservation, spatial movement, path LRU/invalidation/bounds, fire indexing, rail invalidation, particle bounds and same-seed one-year macro consistency.
- `npm run bench:perf`: controlled full-AI versus LOD A/B, 500/2,500/10,000/25,000 entity scale, repeated paths, stable world scans, 100-realm diplomacy and tile save cost.
- `npm run build`: full TypeScript and production bundle validation.

## Known bottlenecks

1. Dense local neighborhoods still scale with nearby entity count; 10,000 citizens packed into 128² is not comfortable.
2. City territory uses string coordinates and expands by scanning territory/frontiers.
3. A* is tile-level; cache helps repeated routes but long new routes still need hierarchical regional/network planning.
4. Road path invalidation and rail topology rebuild are generation-wide, not component-local.
5. Static terrain uses one world-sized canvas.
6. Tile objects and JSON saves cost roughly 240 heap bytes and 214 JSON bytes per tile in measured 256² runs.
7. Generation, serialization and JSON encoding remain O(tile count) on the main thread.
8. Chronicle history is intentionally persistent; its indexes are event-driven, but WORLD-V1 should page old history in storage.

## WORLD-V1 recommendations

1. Replace the monolithic terrain bake with 32×32 chunk canvases and visible-chunk residency.
2. Store terrain in compact per-chunk typed arrays; move rare road/resource/occupation fields to sparse side tables where measurement justifies it.
3. Add local/regional/major-network path layers (HPA* or portal graph) with regional version counters.
4. Track affected road/rail components and route dependencies for local invalidation.
5. Keep active chunk/entity lists so even relevance classification does not walk every global entity each tick.
6. Encode saves in compact binary/chunk records and write through IndexedDB incrementally.
7. Move generation/chunk preparation to a worker only after the single-thread chunk model exists.

