# Aethoria — PERF-V1 Final Performance Report

## Measurement method

Baseline profiling was captured before implementation on the same workspace and machine. Final controlled A/B uses the optimized build with the Entity LOD feature flag disabled/enabled on identical 128², 2,500-entity scenarios. Headless measurements use `tsx` and `performance.now()`; browser frame telemetry is available through F3. Numbers naturally vary with JIT warm-up, so average, p95 and maximum are reported rather than one sample.

## Baseline audit

The original main costs were:

1. `tickAI` rebuilt the entire spatial hash and ran every entity every tick.
2. High speed executed up to 120 complete simulation ticks in one render frame.
3. City production filtered the full world entity array once per city; political pressure repeated it once per realm.
4. Trade called A* inside the goods loop for every candidate city pair.
5. Railway components rescanned all tiles and rebuilt connectivity on every query.
6. Fire and fluids scanned the complete tile grid on their scheduled ticks, even when inactive/stable.
7. Diplomacy produced a periodic all-realm-pairs spike.
8. Renderer bounded tile loops but scanned all entities before culling.
9. A* allocated strings, Maps/Sets and node objects on every repeated route.
10. Existing useful caches already included terrain dirty baking, sprites, UI snapshots, city resources and particle pooling.

Initial measured entity tick baseline on a 96² world:

| Entities | Average | p95 | Maximum |
|---:|---:|---:|---:|
| 100 | 0.452 ms | 1.430 ms | 1.703 ms |
| 500 | 1.070 ms | 4.535 ms | 5.002 ms |
| 1,000 | 2.403 ms | 10.863 ms | 11.402 ms |
| 2,500 | 7.986 ms | 46.801 ms | 51.217 ms |

The original repeated successful 128² route took 362.21 ms for 100 calls (3.622 ms/call) with no cache.

## Controlled BEFORE / AFTER

Final run: 2026-08-08, 128², 2,500 entities, 30 measured ticks after warm-up.

| Metric | Before/control | After PERF-V1 | Change |
|---|---:|---:|---:|
| Entity tick average | 13.481 ms | 4.571 ms | 66.1% lower |
| Entity tick p95 | 40.205 ms | 8.851 ms | 78.0% lower |
| Entity tick maximum | 75.495 ms | 12.251 ms | 83.8% lower |
| Repeated path average (controlled route) | 0.291 ms | 0.006 ms | 97.9% lower |
| Repeated path cache hits | 0/100 | 99/100 | 99% hit rate |
| Fire with no active tiles, warmed 128² | 0.497 ms baseline full scan | ~0.006 ms | ~98.8% lower |
| Stable fluid tick, 128² | 0.978 ms baseline full scan | ~0.001 ms | ~99.9% lower |
| 100-realm diplomacy spike | 6.307 ms average / 14.196 ms p95 | 0.330 ms average / 0.876 ms p95 | ~94–95% lower per frame |
| Path cache cardinality | unbounded/not present | 256 hard limit | bounded |
| Particle/projectile cardinality | damage/projectiles could exceed particle cap | 250 / 160 | bounded |

The original harder length-62 repeated path baseline was 3.622 ms/call; cache-hit cost in the final controlled run was approximately 0.006 ms/call. Different route geometry explains the uncached A/B value difference; the hit ratio and same-route comparison are the meaningful controlled result.

## Population scale

These tests deliberately pack entities into the current 128² architecture; they are stress bounds, not a recommended population density.

| Scenario | Entities | Average tick | p95 |
|---|---:|---:|---:|
| SMALL | 500 | 0.697 ms | 3.938 ms |
| MEDIUM | 2,500 | 4.169 ms | 10.585 ms |
| LARGE | 10,000 | 55.682 ms | 78.569 ms |
| STRESS | 25,000 | 406.376 ms | 574.850 ms |

PERF-V1 makes several thousand entities practical and makes camera-distant continents much cheaper. It does not make 10,000 densely colocated citizens cheap: local neighbor queries and the global relevance-classification pass become the next entity blockers.

## Tile, generation, memory and save audit

Pre-change generation/memory observations:

| World | Generation | Heap delta | Approx. heap/tile |
|---|---:|---:|---:|
| 64² | 58.2 ms | 1.56 MB | noisy ~399 B |
| 128² | 147.6 ms | 3.74 MB | ~239 B |
| 256² | 654.1 ms | 15.16 MB | ~242 B |

Final tile-only JSON save measurements:

| World | JSON size | Bytes/tile | Serialize | JSON stringify |
|---|---:|---:|---:|---:|
| 64² | 0.87 MB | 212.1 B | 2.798 ms | 5.965 ms |
| 128² | 3.49 MB | 212.8 B | 1.041 ms | 23.696 ms |
| 256² | 14.01 MB | 213.8 B | 10.436 ms | 96.466 ms |

These figures exclude citizens, cities, Chronicle and browser storage overhead. Derived PERF-V1 caches are not serialized.

The always-present Tile fields are coordinates, terrain/elevation/climate, resource state, ownership/building/city IDs and road/rail/fire state. Strong sparse candidates are road traffic/damage, rail ownership/damage, building/city occupation, fire and uncommon resource deposits. PERF-V1 does not rewrite storage; WORLD-V1 should measure per-chunk struct-of-arrays plus sparse side tables.

## Consistency and safety

The performance suite runs the same seeded two-realm world for a complete 7,200-tick year with full AI and Entity LOD. It checks population, production, trade routes, wars, technology and city count within explicit macro tolerances. It also validates HOT→WARM→COLD→HOT transitions, identity/job ownership fields, cache invalidation, stable bucketing, 1×/2×/5×/10× scheduling and all cache/effect bounds.

No production, population, research, combat-strength or trade-quantity coefficient was changed. WARM/COLD only reduces local AI frequency; daily and yearly structural rules retain their original cadence.

## 10× stability

The old implementation multiplied all tick work and capped only at 120 complete ticks in one frame. The new scheduler admits fixed ordered ticks until a 5 ms frame work budget or 48-tick cap, then carries at most 240 ticks of debt. This trades unbounded freezes for bounded throughput and preserves pausing and deterministic phase order.

## Browser runtime validation

Final validation used a 64x64 world at 10x speed after warm-up, with the profiler overlay enabled.

| Metric | Average | p95 |
|---|---:|---:|
| Frame | 4.60 ms | 6.80 ms |
| Simulation | 0.27 ms | 0.60 ms |
| Rendering | 4.09 ms | 4.80 ms |
| Entity AI | 0.04 ms | 0.10 ms |

The run held 60 FPS with 12 visible entities, 126 particles, and no console errors.

## Remaining bottlenecks

- At 10,000+ dense entities, local neighbor sets and the O(E) relevance classification pass dominate.
- City territory frontier construction still uses string tile keys and large annual scans.
- New long-distance routes remain tile-level A*; the cache only accelerates reuse.
- Road invalidation and railway component rebuild are currently generation-wide.
- The static terrain bake is one world-sized canvas: at 16 px/tile, 256² is a 4,096² surface (~67 MB RGBA) and 512² would be an 8,192² surface (~268 MB RGBA) before browser overhead.
- Save JSON reaches 14 MB and 135 ms stringify time at 256² before entity/history data.

## WORLD-V1 readiness answers

1. **Comfortable current maximum:** 256² is the practical upper bound for the current monolithic terrain canvas, with roughly 2,500–5,000 geographically distributed citizens. The current default 128² remains comfortably inside it.
2. **First subsystem to break:** the monolithic static terrain canvas and tile-object/save memory break first when map dimensions rise; densely packed local entity AI breaks first when population rises without land area.
3. **Estimated viable size after PERF-V1:** 256² is viable now when population density is controlled. 512² is not recommended until WORLD-V1 chunk rendering/storage lands.
4. **Is Tile memory a problem?** Yes beyond 256². Measured heap is ~242 B/tile and JSON ~214 B/tile, before secondary structures.
5. **Is generation a problem?** Moderate now, severe at 512²+. It is O(tiles), took ~654 ms at 256² and is a future worker candidate after chunk generation exists.
6. **Is rendering a problem?** Per-frame culling is substantially better, but static-canvas allocation is the hard map-size blocker.
7. **Is simulation a problem?** Several thousand distributed entities are practical; 10,000 densely local entities are not. WORLD-V1 needs active-chunk entity lists and further local-density controls.
8. **Is save/load a problem?** Yes for large worlds. Tile JSON alone is ~14 MB at 256² and stringification measured 135 ms.
9. **What must WORLD-V1 implement?** Bounded chunk canvases/residency, compact chunk tile storage, incremental/binary IndexedDB saves, hierarchical pathfinding, regional/component invalidation, active-chunk entity scheduling and paged long-history data.

## Commands

```text
npm run build
npm run test:perf
npm run bench:perf
```
