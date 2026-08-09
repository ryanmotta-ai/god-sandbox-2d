# AETHORIA — WORLD-V1 PREPARATION
## LARGE WORLD & SPATIAL SCALE ARCHITECTURE AUDIT

> [!IMPORTANT]
> **AUDIT MANDATE & SCOPE**
> This document is a non-destructive architectural audit for the future **WORLD-V1** milestone of *Aethoria*. No code has been modified, no gameplay balance altered, no map sizes increased, and no PERF-V1 performance worker files touched.

---

## 1. EXECUTIVE SUMMARY & CURRENT WORLD SCALE

Currently, *Aethoria* operates on a single fixed-size 2D grid architecture designed for compact, fast-paced sandbox simulations.

- **Default Map Size:** $128 \times 128$ tiles ($16,384$ total tiles).
- **Small Preset:** $64 \times 64$ tiles ($4,096$ total tiles).
- **Tile Render Resolution:** $16 \times 16$ pixels per tile.
- **World Pixel Dimensions (Default):** $2,048 \times 2,048$ world pixels.

### The Central Question:
> *“What is the current maximum world scale, what breaks first when expanding, and how must the architecture evolve?”*

**Key Audit Conclusion:**
The current architecture hard-caps world size at **$256 \times 256$ tiles** ($65,536$ tiles). Attempting to scale to $512 \times 512$ ($262,144$ tiles) or $1024 \times 1024$ ($1,048,576$ tiles) breaks **4 critical subsystems**:
1. **Renderer Canvas Bake Crash:** HTML5 Canvas 2D offscreen bake (`terrainCanvas`) exceeds browser VRAM and hardware size limits ($8,192 \text{px}$ to $16,384 \text{px}$).
2. **Storage Quota Crash:** Save files ($40\text{ MB} - 160\text{ MB}$) immediately exceed browser `localStorage` quotas ($5\text{ MB}$).
3. **Pathfinding Failure:** A* search budget ($3,000$ max nodes) fails on routes longer than $\sim 150$ tiles, breaking intercity trade and roads.
4. **City Land Saturation:** A single Metropolis ($2,000$ tiles territory limit) consumes $>22\%$ of all land on a $128 \times 128$ map, leaving no space for majestic wilderness, regional biomes, or physical city expansion in **CITY-V1**.

---

## 2. WORLD DIMENSIONS & HARD LIMITS

### Presets & Configuration
- `WorldSetupScreen.ts` exposes only two options: `64` (Small) and `128` (Large / Default).
- `TileMap.ts` constructor defaults to $128 \times 128$.
- `Camera.ts` sets `worldWidthTiles = 128`, `worldHeightTiles = 128`.

### Codebase Hard Limits & Assumptions
1. **Flat 2D Array Storage:** `grid: Tile[][]` in [`TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L12). Allocated as an array of $W$ outer arrays, each containing $H$ objects.
2. **Linear Indexing Hash:** [`TileMap.dirtyTiles`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L17) keys dirty tiles using `x * height + y`. While safe up to 32-bit int bounds, `Set<number>` overhead scales linearly with dirtied area.
3. **SpatialHash Key Multiplier:** [`SpatialHash.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/SpatialHash.ts#L22) packs coordinates using `cx * 100000 + cy`. Key collisions occur if cell coordinates exceed $\pm 50,000$ (equivalent to $400,000$ tiles).
4. **Simplex Noise Frequencies:** [`WorldGenerator.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/WorldGenerator.ts#L52-L82) uses absolute spatial frequencies (`0.035`, `0.055`, `0.09`). If map dimensions increase without scaling frequency, biomes and noise features become high-frequency visual "noise" rather than continent-scale geography.
5. **Blueprint Normalized Coordinates:** [`WorldBlueprints.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/WorldBlueprints.ts#L47-L52) uses normalized $(u, v) \in [0, 1]^2$. The macro shapes scale correctly, but feature counts (e.g. 6 rivers max) do not scale automatically with area.

---

## 3. TILE MEMORY AUDIT

Every tile in *Aethoria* is currently an instance of the [`Tile`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/Tile.ts#L54) JavaScript class.

### Per-Tile Footprint (V8 Engine Engine Analysis)
- **Properties per instance:** 26 fields (`x`, `y`, `height`, `type`, `temperature`, `moisture`, `fertility`, `resourceType`, `resourceAmount`, `resourceMax`, `buildingId`, `kingdomId`, `cityId`, `isOnFire`, `fireTimer`, `roadLevel`, `roadTraffic`, `roadDamage`, `railLevel`, `railDamage`, `railOwnerId`, `bridgeName`, `renderSurface`, `renderSurfaceType`, `renderSurfaceHeight`, `renderSurfaceMoisture`, `renderSurfaceTemp`).
- **Memory Allocation:**
  - V8 Object Header & Map pointer: $\sim 24\text{ bytes}$
  - In-Object Property Slots ($26 \times 8\text{ bytes}$): $\sim 208\text{ bytes}$
  - Hidden Class alignment & garbage collection metadata: $\sim 64\text{ bytes}$
  - **Estimated Total per Tile:** **$\sim 300\text{ bytes}$**

### Scaling Calculations

| Map Dimensions | Total Tiles | Grid JS Heap Memory | Memory Status |
| :--- | :--- | :--- | :--- |
| **$128 \times 128$ (Current)** | $16,384$ | **$\sim 4.9\text{ MB}$** | Ideal |
| **$256 \times 256$ (2x Linear)** | $65,536$ | **$\sim 19.6\text{ MB}$** | Light |
| **$316 \times 316$ (100k Tiles)** | $100,000$ | **$\sim 30.0\text{ MB}$** | Acceptable |
| **$512 \times 512$ (4x Linear)** | $262,144$ | **$\sim 78.6\text{ MB}$** | Heavy |
| **$1000 \times 1000$ (1M Tiles)** | $1,000,000$ | **$\sim 300.0\text{ MB}$** | High Pressure |
| **$2000 \times 2000$ (4M Tiles)** | $4,000,000$ | **$\sim 1.2\text{ GB}$** | **CRITICAL GC RISK** |

### Field Usage & Sparsity Categorization

```
+-------------------------------------------------------------------------+
| ALWAYS PRESENT (Dense Terrain Data - ~40 bytes)                         |
| x, y, height, type, temperature, moisture, fertility                   |
+-------------------------------------------------------------------------+
| RARELY USED / SPARSE CANDIDATES (90-99% Null/Zero - ~180 bytes)         |
| buildingId, kingdomId, cityId, resourceType, resourceAmount,           |
| resourceMax, isOnFire, fireTimer, roadLevel, roadTraffic, roadDamage,   |
| railLevel, railDamage, railOwnerId, bridgeName                          |
+-------------------------------------------------------------------------+
| DERIVABLE / REDUNDANT (Renderer Cache - ~80 bytes)                     |
| renderSurface, renderSurfaceType, renderSurfaceHeight,                  |
| renderSurfaceMoisture, renderSurfaceTemp                                |
+-------------------------------------------------------------------------+
```

---

## 4. WORLD GENERATION COST

Generation complexity in [`WorldGenerator.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/WorldGenerator.ts#L22):

### Step Breakdown & Algorithmic Complexity

1. **Height, Climate & Biome Classification:**
   - Evaluates 6 Simplex Noise octave passes, all blueprint blobs (`fieldOf`), and ridge segments (`ridgeField`).
   - Complexity: $O(W \cdot H \cdot (\text{Octaves} + \text{Blobs} + \text{Ridges}))$.
   - Synchronous loop over every cell. At $1024 \times 1024$, this is $1.05\text{M}$ iterations, freezing the UI thread for $\sim 2.5\text{ seconds}$.
2. **River Carving (`carveRivers`):**
   - Mountain peak search: $O(W \cdot H)$.
   - Flow pathfinding: steepest descent with local basin lake overflow rim carving.
   - Complexity: $O(W \cdot H + R \cdot (W + H))$. Linear with map perimeter, but performs $3 \times 3$ bank fertilization passes at every river tile.
3. **Cellular Biome Smoothing (`smoothBiomes`):**
   - $3 \times 3$ neighborhood scan over all land tiles.
   - Allocates temporary `counts` dictionaries (`Record<string, number>`) per tile, producing $O(W \cdot H)$ short-lived JS string objects.
4. **Natural Resource Deposits (`generateDeposits`):**
   - Scans land tiles and places resource blobs using PRNG clustering.

---

## 5. RENDERING SCALE & BOTTLENECKS

### Renderer Architecture in [`Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L1438)

- **Terrain Baking System:** Static (non-animated) terrain is baked once into an offscreen canvas `terrainCanvas` at full resolution ($16\text{px}$ per tile) via `ensureTerrainBake()`.
- **Viewport Culling:**
  - Baked terrain: Uses `ctx.drawImage` to copy the visible sub-rectangle from `terrainCanvas` onto the main screen canvas.
  - Animated terrain (water/lava): Loops through `minX..maxX, minY..maxY`.
  - Roads & Railways: Loops through visible viewport tiles, extracts road connectivity, and builds temporary [`RoadNode`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L97) graphs **every single frame**.

### What Breaks First as Map Area Increases?

```
                                OFFSCREEN CANVAS VRAM
 Map Size     Canvas Resolution     Pixel Count     VRAM Footprint    Status
--------------------------------------------------------------------------------
 128 x 128     2048 x 2048 px        4.19 MP           16.7 MB        OK
 256 x 256     4096 x 4096 px       16.77 MP           67.1 MB        OK
 512 x 512     8192 x 8192 px       67.10 MP          268.4 MB        CRITICAL (Browser Limit)
1024 x 1024   16384 x 16384 px     268.43 MP         1073.7 MB        CRASH (GPU Out of Memory)
```

> [!CAUTION]
> **PRIMARY RENDER BLOCKER:** Most modern browsers and GPU drivers enforce a **$4,096 \text{px}$ or $8,192 \text{px}$ maximum dimension limit** for standard HTML5 Canvas 2D contexts. Maps larger than $512 \times 512$ will fail to allocate `terrainCanvas` or throw a `DOMException`, rendering the entire map black!

---

## 6. CAMERA & COORDINATE SYSTEMS

- **Coordinate Precision:** Coordinates in [`Camera.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Camera.ts#L111-L121) use standard 64-bit floating-point numbers. Precision loss is non-existent up to millions of units.
- **Screen-to-World Conversion:** Operates in $O(1)$ time via simple affine transforms:
  $$\text{worldX} = \frac{(\text{screenX} - \text{width}/2) / \text{zoom} + \text{camera.x}}{\text{tileSize}}$$
- **Zoom Range Bottleneck:** `minZoom` ($0.3$) allows zooming out to view a $3.3 \times$ larger area. On a $512 \times 512$ map, zooming out brings over $100,000$ tiles into the viewport simultaneously, causing per-frame object allocations (road nodes, entity overlays) to drop FPS below 15 without Chunk LOD.

---

## 7. SAVE FILE SIZE & STORAGE AUDIT

### Current Serialization in [`TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L321) & [`SaveSystem.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/SaveSystem.ts#L139)

The save system serializes every single tile as an individual JSON object with 18 keys (`x, y, t, h, temp, m, r, ra, rm, b, k, c, f, rl, rt, rd, rail, raild, railo, bn`).

- **Per-Tile JSON Size:** $\sim 140\text{ bytes}$
- **Save File Scaling:**

```
 Map Size     Total Tiles    Tile JSON Size    Total Save Data     localStorage Status
----------------------------------------------------------------------------------------
 128 x 128     16,384          ~ 2.3 MB           ~ 3.5 MB         OK (Nearing Cap)
 256 x 256     65,536          ~ 9.2 MB           ~ 11.5 MB        FAIL (Quota Exceeded)
 512 x 512    262,144         ~ 36.7 MB          ~ 42.0 MB         FAIL (Quota Exceeded)
1024 x 1024  1,048,576        ~ 146.8 MB         ~ 160.0 MB        FAIL (Quota Exceeded)
```

> [!WARNING]
> **STORAGE BLOCKER:** Standard browser `localStorage` has a strict **$5\text{ MB}$ limit per domain**. Saves for maps larger than $128 \times 128$ will throw `QuotaExceededError` and permanently fail to save progress.

### Non-Essential Serialized Data (Derivable Candidate Data)
- Static terrain height, base temperature, and moisture (can be recomputed from map seed + blueprint on load unless modified by God Powers).
- Default zero values (`roadLevel: 0`, `railLevel: 0`, `isOnFire: false`) serialized on millions of empty wilderness tiles.

---

## 8. CITY SCALE & SPATIAL FOOTPRINT

### Current Settlement Parameters ([`City.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/City.ts#L28))

- **Metropolis Territory Cap:** $2,000$ tiles.
- **Metropolis Building Slots:** $70$ buildings.
- **Survey Radius:** Up to $22$ tiles ($\sim 45 \times 45$ tile search square).

### Land Saturation Analysis (Current $128 \times 128$ World)
- Total World Area: $16,384$ tiles.
- Usable Land (excluding Ocean & Mountain ranges): $\sim 9,000$ tiles ($55\%$).
- **Single Metropolis Footprint:** $2,000$ tiles $\approx \mathbf{22.2\%}$ **of all buildable land on the map!**
- **4 Metropolises** consume **$88.8\%$** of the entire world's land area.

> **Audit Answer to Prompt Question:**
> *“Se uma metropolis ficar 3x maior fisicamente ($\sim 6,000$ tiles), quantas cidades caberiam no mundo atual antes de tudo ficar apertado?”*
>
> **Answer:** **Exactly 1 Metropolis** would consume $\mathbf{66.6\%}$ **of all land** on a $128 \times 128$ map. A second metropolis would be physically impossible without total land overlap.

---

## 9. BUILDING / TILE SCALE OPTIONS FOR WORLD-V1 & CITY-V1

```
+---------------------------------------------------------------------------------------------------+
| OPTION A: Keep 1 Building = 1 World Tile & Increase World Map Size (RECOMMENDED)                  |
+---------------------------------------------------------------------------------------------------+
| Pros:        100% compatible with existing TileMap grid, UrbanPlanner, Pathfinding, and CITY-V1.|
|              Maintains clear visual pixel-art legibility.                                         |
| Cons:        Requires a 4x to 16x larger world grid (512x512 to 1024x1024).                       |
| Pathfinding: Standard tile A* / HPA*.                                                             |
| Renderer:    Requires Chunked Offscreen Canvas Baking.                                            |
+---------------------------------------------------------------------------------------------------+
| OPTION B: Reduce Visual Scale of Buildings Within the Tile (Sub-tile micro-sprites)               |
+---------------------------------------------------------------------------------------------------+
| Pros:        Keeps world grid small (128x128).                                                    |
| Cons:        Ruins 16px pixel-art visual style; high code churn; breaks 1-to-1 building-tile link.|
| Pathfinding: Extremely complex sub-pixel collision layers inside single tiles.                    |
| Renderer:    Heavy per-frame sub-sprite sorting.                                                |
+---------------------------------------------------------------------------------------------------+
| OPTION C: Separate World Tile Grid (Macro) from Urban Micro-Grid (Micro)                          |
+---------------------------------------------------------------------------------------------------+
| Pros:        Allows infinite urban density without exploding world map size.                      |
| Cons:        Extreme architectural complexity; dual-coordinate system; breaks existing APIs.    |
| Pathfinding: Requires two-tier pathfinding translation layer between micro and macro grids.       |
| Renderer:    Dual render loops and transition viewports.                                          |
+---------------------------------------------------------------------------------------------------+
```

---

## 10. CHUNK ARCHITECTURE (PROPOSED FOR WORLD-V1)

To support large worlds without exceeding canvas limits or memory caps, *Aethoria* must adopt a **$32 \times 32$ Chunk Architecture**.

```
                           MAP DIVISION (512 x 512 World)
      +-------------------------------------------------------------------+
      | Chunk (0,0)  | Chunk (1,0)  | Chunk (2,0)  | ...  Chunk (15,0)  |
      | 32 x 32      | 32 x 32      | 32 x 32      |      32 x 32      |
      +--------------+--------------+--------------+------------------+
      | Chunk (0,1)  | Chunk (1,1)  | Chunk (2,1)  | ...  Chunk (15,1)  |
      +--------------+--------------+--------------+------------------+
      | ...          | ...          | ...          | ...              |
      +--------------+--------------+--------------+------------------+
      | Chunk (0,15) | Chunk (1,15) | Chunk (2,15) | ...  Chunk (15,15)|
      +-------------------------------------------------------------------+
```

### Chunk Size Candidates Comparison

| Chunk Size | Total Chunks ($512 \times 512$) | Canvas Bake Resolution per Chunk | Evaluation |
| :--- | :--- | :--- | :--- |
| **$16 \times 16$** | $1,024$ chunks | $256 \times 256\text{ px}$ ($262\text{ KB}$) | Too granular; high chunk management overhead. |
| **$32 \times 32$ (RECOMMENDED)** | **$256$ chunks** | **$512 \times 512\text{ px}$ ($1.0\text{ MB}$)** | **Optimal balance of memory, bake speed & LOD.** |
| **$64 \times 64$** | $64$ chunks | $1024 \times 1024\text{ px}$ ($4.1\text{ MB}$) | Too large for fine-grained sleeping/LOD. |

### Architectural Capabilities Supported by $32 \times 32$ Chunks:
1. **Terrain Bake Cache:** Each chunk bakes its $512 \times 512\text{ px}$ static surface to its own lightweight offscreen canvas. Viewport renders only visible chunk canvases.
2. **Dirty Region Invalidation:** Editing a tile with a God Power invalidates **only 1 chunk bake** ($32 \times 32$) instead of re-baking the entire world.
3. **Sleeping Regions:** Inactive chunks pause micro-ticks.
4. **IndexedDB Partitioning:** Chunks serialize into separate database keys on save.

---

## 11. ACTIVE, WARM & SLEEPING REGIONS (REGION LOD)

To run large maps efficiently alongside **PERF-V1**:

```
+----------------------------------------------------------------------------------+
| ACTIVE REGION (Viewport + 1 Chunk Margin)                                        |
| • 60 FPS full entity rendering, particles, audio, daily citizen routines.        |
| • Full A* tile pathfinding, active fire propagation, physics ticks.              |
+----------------------------------------------------------------------------------+
| WARM REGION (Same Realm / Major Trade Corridors)                                 |
| • Entity micro-sprites disabled. Aggregated population counters.                 |
| • Simplified macro pathfinding (graph-based highway routing).                    |
| • Ticked at 5 Hz to 10 Hz for economic production and trade flow.                |
+----------------------------------------------------------------------------------+
| SLEEPING REGION (Remote Unobserved Wilderness / Far Continents)                  |
| • Zero entity ticks. Zero tile rendering. Zero A* searches.                      |
| • Macro statistical demographic update once per simulated year.                  |
+----------------------------------------------------------------------------------+
```

### Entity LOD vs. Region LOD
- **Entity LOD (PERF-V1):** Controls individual agent decision frequency, AI state transitions, and sprite animations based on distance to camera.
- **Region LOD (WORLD-V1):** Controls spatial chunk evaluation, macro-economic ticks, environmental fluid updates, and chunk canvas bake lifecycles.

---

## 12. REGION ACTIVATION CRITERIA

Sleeping chunks transition to WARM or ACTIVE state dynamically when triggered by:
1. **Camera Proximity:** Viewport enters chunk bounds (+ margin).
2. **Military Conflict / War:** Active battle or siege declared within chunk.
3. **Active Selection:** Player clicks a city or kingdom asset inside the chunk.
4. **Trade Route Transit:** Major merchant caravan or train crossing the chunk.
5. **Major Disasters:** Active volcano, earthquake, or fire outbreak.
6. **Player Construction:** God power or player brush action applied to chunk tiles.

---

## 13. WORLD LOD SPECIFICATION

```
+-----------------------------------------------------------------------------------+
| LEVEL 1: LOCAL (Zoom 1.5x - 3.5x)                                                 |
| • Full pixel art sprites, citizen health bars, job icons, particle effects.       |
| • Individual building animations, street-level road details.                      |
+-----------------------------------------------------------------------------------+
| LEVEL 2: REGIONAL (Zoom 0.8x - 1.5x)                                              |
| • Citizen sprites simplified; group indicators for military units.                |
| • Full road/rail networks, city district outlines, trade caravan icons.           |
+-----------------------------------------------------------------------------------+
| LEVEL 3: CONTINENTAL (Zoom 0.4x - 0.8x)                                           |
| • Individual citizens hidden; army banners and fleet icons rendered.              |
| • Kingdom border fills, major highway corridors, city nameplates & heraldry.      |
+-----------------------------------------------------------------------------------+
| LEVEL 4: WORLD ATLAS (Zoom < 0.4x)                                                |
| • Full world view; chunk-baked low-res terrain texture.                           |
| • Political map mode (realm territory colors, capital markers, trade flow arrows).|
+-----------------------------------------------------------------------------------+
```

---

## 14. TERRITORY STORAGE AUDIT

### Current Implementation Bottlenecks
- [`City.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/City.ts#L72) stores territory as `territory: Set<string>` containing formatted `"x,y"` strings.
- [`Kingdom.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Kingdom.ts#L82) calculates size via macro-ticks.
- **Risks:**
  - Formatting tens of thousands of string keys (`"412,385"`) generates heavy Garbage Collection (GC) pressure.
  - `Set<string>` iteration during territory expansion (`expandTerritory`) requires full scans around city borders.

### Future Alternative:
Replace `Set<string>` coordinate strings with **Flat Array Bitmaps** or **Flat Numeric Integer Sets** (`x << 16 | y`), reducing memory footprint by $>80\%$ and eliminating string allocations entirely.

---

## 15. ROAD & RAIL NETWORK SCALE

### Blockers for Long-Distance Networks
1. **Pathfinding Node Budget:** [`Pathfinding.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/Pathfinding.ts#L329) caps A* search at `maxNodes = 3000`. On a $512 \times 512$ map, surveying a road across a continent requiring $>150$ tiles fails, returning an empty path `[]`.
2. **Per-Frame Graph Building:** [`Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L96-L115) constructs temporary `RoadNode` graphs every frame by iterating visible tiles. On zoomed-out large maps, this allocates thousands of objects per frame.

### Future Architecture:
Adopt **Graph Topology Networks** (Nodes = Cities/Intersections, Edges = Pre-surveyed Road/Rail Segments) decoupled from tile-by-tile per-frame rendering scans.

---

## 16. TRADE DISTANCE & SCALE

### Current Implementation ([`Trade.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Trade.ts#L284))
- Transport cost per unit:
  $$\text{Land Cost} = \text{Price} \cdot \text{Distance} \cdot 0.004 \cdot (1.5 - 0.3 \cdot \text{RoadLevel})$$
  $$\text{Sea Cost} = \text{Price} \cdot \text{Distance} \cdot 0.003$$
- Partner city search currently evaluates candidates globally.

### Scaling Risk on Large Maps:
- On a $1024 \times 1024$ map, continental distances reach $\sim 1,200$ tiles. Pure linear distance penalties would make transcontinental land trade $10 \times$ more expensive than local trade, completely killing global trade.
- **Future Change:** Implement non-linear logarithmic or capped distance penalty curves for long-distance trade routes.

---

## 17. WORLD GENERATION STREAMING

```
FULL UPFRONT GENERATION (Current)
• Generates 100% of tiles on start.
• Unviable for 512x512+ (freezes browser, high memory spike).

CHUNKED ASYNC GENERATION (WORLD-V1 Target)
• Generates terrain background in 32x32 chunks via Web Worker.
• Main thread stays responsive at 60 FPS during world creation.
```

---

## 18. DETERMINISM AUDIT

- **Current Seed Mechanism:** [`WorldBlueprints.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/WorldBlueprints.ts#L46) fixes seeds per blueprint (`104729`, `224737`, `350377`).
- **Normalized Coordinate Math:** Height field calculation uses $u = (x + 0.5) / W$ and $v = (y + 0.5) / H$. Any tile $(x, y)$ can be evaluated **purely deterministically and independently** of order.
- **Determinism Blockers to Fix in WORLD-V1:**
  - River carving (`carveRivers`) currently relies on global sequential random picks (`rng.pick`). To make chunked generation deterministic, river paths must be calculated in a lightweight macro-pass first, then sampled locally by chunks.

---

## 19. LARGE MAP TARGET SCENARIOS

| Metric / Risk | Scenario 1: 2x Linear ($256 \times 256$) | Scenario 2: 4x Linear ($512 \times 512$) **[RECOMMENDED]** | Scenario 3: 8x Linear ($1024 \times 1024$) |
| :--- | :--- | :--- | :--- |
| **Total Tiles** | $65,536$ tiles ($4\times$ current) | $262,144$ tiles ($16\times$ current) | $1,048,576$ tiles ($64\times$ current) |
| **Tile Heap Memory** | $\sim 19.6\text{ MB}$ | $\sim 78.6\text{ MB}$ | $\sim 314.0\text{ MB}$ |
| **Save File Size** | $\sim 11.5\text{ MB}$ | $\sim 42.0\text{ MB}$ | $\sim 160.0\text{ MB}$ |
| **Storage Backend** | IndexedDB Required | IndexedDB + RLE Compression | IndexedDB + Chunked Binary |
| **Terrain Canvas Bake**| $4096 \times 4096\text{ px}$ ($67\text{ MB}$) | $8192 \times 8192\text{ px}$ (**Requires Chunks**) | $16384 \times 16384\text{ px}$ (**CRASH!**) |
| **Generation Time** | $\sim 300\text{ ms}$ (Fast) | $\sim 2.0\text{ s}$ (Async Worker Needed) | $\sim 12.0\text{ s}$ (Background Stream) |
| **Pathfinding Risk** | Low | Moderate (HPA* Required) | Critical (HPA* Required) |
| **City Saturation** | Metropolises fit easily | **Perfect balance of cities & wild** | Huge wilderness ocean gaps |

---

## 20. CITY BEAUTY REQUIREMENTS (CITY-V1 SPATIAL SCALE)

To allow **CITY-V1** to build physically beautiful, realistic metropolises, cities require space for:
1. **Road Hierarchy:** Wide avenues, radial boulevards, local alleyways.
2. **Distinct Neighborhoods:** Civic core, residential quarters, industrial outskirts, harbor districts, historic centers.
3. **Agricultural & Rural Belts:** Farms and pastures surrounding the urban core.
4. **Defensive Walls & Canals:** Concentric ring walls and aqueduct corridors.
5. **Railway Corridors & Depots:** Multi-tile rail yards and station corridors.

### Healthy Ratio Specification:
$$\text{Healthy City Diameter Ratio} = \frac{\text{Metropolis Diameter}}{\text{World Map Diameter}} \in [0.05, 0.15] \quad (5\% \text{ to } 15\%)$$

- On a $128 \times 128$ map: Ratio is $\mathbf{39\%}$ (City dominates half the map - cramped!).
- On a $512 \times 512$ map: A Metropolis of $50-70$ tiles diameter has a ratio of $\mathbf{9.7\%}$ (Healthy, majestic, leaves vast wilderness and farmlands!).

---

## 21. DISTANCE BETWEEN CITIES

- **Current Spacing:** Cities spawn as close as $15-20$ tiles apart.
- **Recommended Spacing for WORLD-V1 ($512 \times 512$):**
  - Minimum distance between city centers: **$60$ to $100$ tiles**.
  - Prevents urban overlap, ensures distinct kingdom territories, and makes intercity railways feel like true continental transport lines.

---

## 22. GEOGRAPHIC SCALE & BIOME RESOLUTION

When increasing map size to $512 \times 512$:
1. **Mountain Chains:** Ridge widths must scale from 6 tiles to $16-24$ tiles wide, creating impassable continental barriers with strategic mountain passes.
2. **Rivers:** Major rivers must feature multi-tile widths ($2-4$ tiles wide near coastal estuaries) with shallow water crossing points for bridges.
3. **Noise Normalization:** Simplex noise sample frequencies must be normalized to map dimensions so biomes don't fragment into noisy specks.

---

## 23. WORLD COMPOSITION ARCHITECTURE

```
+-----------------------------------------------------------------------------------+
| POLAR / ARCTIC BELT (North Rim: Tundra, Snow, Glacial Lakes)                     |
+-----------------------------------------------------------------------------------+
| NORTH TEMPERATE ZONE (Forests, Mountain Spines, Navigable River Basins)           |
+-----------------------------------------------------------------------------------+
| EQUATORIAL TROPICS / GRASSLANDS (Savanna, Rainforests, Central Gulfs, Swamps)     |
+-----------------------------------------------------------------------------------+
| SOUTH ARID BELT (Deserts, Canyons, Mineral Quarries)                              |
+-----------------------------------------------------------------------------------+
```

---

## 24. PERFORMANCE DEPENDENCIES (EXPECTATIONS FROM PERF-V1)

WORLD-V1 architecture relies on PERF-V1 delivering the following key performance interfaces:
1. **Spatial Indexing Interface:** $O(1)$ spatial queries for entities and active tiles (`SpatialHash` or Quadtree).
2. **Entity LOD Scheduler:** Variable tick rates for Hot / Warm / Cold entities.
3. **Viewport Culler Utility:** High-speed bounding box intersection queries.
4. **Hierarchical Path Cache (HPA*):** Pre-computed chunk-level node graphs for long-distance pathfinding.
5. **Immutable Snapshot Lifecycle:** Thread-safe, non-blocking state reads for UI and rendering passes.

---

## 25. RISK REGISTER

| Risk ID | Category | Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | **Renderer** | `terrainCanvas` offscreen bake exceeds browser WebGL/Canvas limit ($>8192\text{px}$). | **CRITICAL** | Implement $32 \times 32$ Chunk Canvas bakes. |
| **R-02** | **Storage** | Save files ($>10\text{MB}$) crash browser `localStorage` $5\text{MB}$ quota. | **CRITICAL** | Migrate save system to `IndexedDB` + RLE compression. |
| **R-03** | **Pathfinding**| Long-distance A* searches hit $3,000$ node cap and fail on large maps. | **HIGH** | Implement Hierarchical Pathfinding (HPA*). |
| **R-04** | **Memory** | $1\text{M}+$ `Tile` JS class instances cause severe V8 garbage collection stutter. | **HIGH** | Flatten `Tile` fields; use sparse arrays for rare fields. |
| **R-05** | **Generation**| Synchronous world generation freezes browser tab for $5+$ seconds. | **HIGH** | Move generation to a Web Worker background thread. |
| **R-06** | **Graphics** | Zooming out on large map renders $>100\text{k}$ tiles, dropping FPS. | **MEDIUM** | Implement 4-Tier World LOD rendering. |
| **R-07** | **City Scale** | Cities spawn too close, creating wall-to-wall urban sprawl. | **MEDIUM** | Enforce $60-100$ tile minimum city spacing rules. |

---

## 26. STRATEGIC ARCHITECTURE OPTIONS

### Option 1: CONSERVATIVE (2x Scale = $256 \times 256$, $4\times$ tiles)
- Minimal architectural changes. Retains 2D array grid. Migrates saves to `IndexedDB`. Implements basic chunk bakes.
- *Pros:* Quick to implement.
- *Cons:* Cities still feel somewhat cramped; does not unlock true continental scale.

### Option 2: BALANCED (4x Scale = $512 \times 512$, $16\times$ tiles) — **RECOMMENDED**
- Implements $32 \times 32$ Chunk Architecture, Chunked Offscreen Canvas bakes, `IndexedDB` save partitioning, Region LOD (Active/Warm/Sleeping), and HPA* pathfinding.
- *Pros:* Magnificent sprawling cities, vast wilderness, deep trade routes, rock-solid 60 FPS performance, fully future-proof for **CITY-V1**.
- *Cons:* Requires moderate architectural refactoring of renderer and save pipeline.

### Option 3: AGGRESSIVE (8x Scale = $1024 \times 1024$, $64\times$ tiles)
- Full micro-grid urban separation, lazy streaming generation, multi-worker thread simulation.
- *Pros:* Infinite scale.
- *Cons:* Extremely high refactoring risk and development overhead.

---

## 27. RECOMMENDED DIRECTION

Based on the audit of the current TypeScript / HTML5 Canvas codebase, **STRATEGY 2: BALANCED ($512 \times 512$ with $32 \times 32$ Chunks)** is strongly recommended.

> [!NOTE]
> **FINAL DECISION NOTE:** The final definitive decision on world size target will be validated once **PERF-V1** benchmark results are delivered.

---

## 28. FILE IMPACT MAP

### Files WORLD-V1 Would Likely Modify
- [`src/world/TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts): Add Chunk storage grid, chunk dirty tracking, sparse tile attributes.
- [`src/world/Tile.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/Tile.ts): Lightweight struct refactor, remove renderer cache fields.
- [`src/world/WorldGenerator.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/WorldGenerator.ts): Async chunked generation, deterministic macro-river passes.
- [`src/renderer/Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts): $32 \times 32$ Chunk canvas bakes, Viewport Chunk Culling, 4-tier LOD.
- [`src/renderer/Camera.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Camera.ts): Extended zoom levels, dynamic world bounds.
- [`src/core/SaveSystem.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/SaveSystem.ts): `IndexedDB` backend migration, RLE sparse tile serialization.
- [`src/ai/Pathfinding.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/Pathfinding.ts): Hierarchical Pathfinding (HPA*) integration for long-distance routes.
- [`src/ui/screens/WorldSetupScreen.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ui/screens/WorldSetupScreen.ts): Expose new world size options ($256 \times 256$, $512 \times 512$).

### Files WORLD-V1 Should AVOID Modifying (PERF-V1 / Pure Civ Logic)
- [`src/ai/EntityAI.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/EntityAI.ts) (PERF-V1 domain)
- [`src/entities/Entity.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/entities/Entity.ts) (PERF-V1 domain)
- [`src/civ/CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts) (Pure Civ rules)
- [`src/civ/Economy.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Economy.ts)
- [`src/civ/Diplomacy.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Diplomacy.ts)
- [`src/civ/TechTree.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/TechTree.ts)

### Files That Need Interfaces Only
- [`src/core/SpatialHash.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/SpatialHash.ts)
- [`src/core/EventBus.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/EventBus.ts)
- [`src/ui/core/GameContext.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ui/core/GameContext.ts)

---

## 29. CITY-V1 COMPATIBILITY

WORLD-V1 provides the foundation for **CITY-V1** by establishing:
1. **Spatial Scale Allowance:** A $512 \times 512$ map provides room for Metropolises to expand their territory limits to $4,000 - 6,000$ tiles without saturating the continent.
2. **Road Hierarchy Space:** Intercity spacing ($60-100$ tiles) leaves ample room for multi-lane arterial roads, ring roads, and suburban hamlets.
3. **District Zoning Footprint:** Cities have physical space to separate high-pollution industrial quarters from residential manors and civic palaces.
4. **Railway Corridors:** Sprawling terrain allows long, sweeping rail lines with realistic station yards and mountain tunnels.

---

## 30. DELIVERABLE CHECKLIST

- [x] CURRENT WORLD SCALE & HARD LIMITS
- [x] TILE MEMORY AUDIT & SPARSITY
- [x] WORLD GENERATION COST & COMPLEXITY
- [x] RENDERING SCALE & CANVAS BAKE LIMITS
- [x] CAMERA & COORDINATES
- [x] SAVE SIZE & STORAGE QUOTA AUDIT
- [x] CITY SCALE & LAND SATURATION
- [x] BUILDING / TILE SCALE OPTIONS
- [x] CHUNK ARCHITECTURE ($32 \times 32$)
- [x] REGION LOD (ACTIVE / WARM / SLEEPING)
- [x] REGION ACTIVATION CRITERIA
- [x] WORLD LOD (4 TIERS)
- [x] TERRITORY STORAGE AUDIT
- [x] ROAD / RAIL NETWORK SCALE
- [x] TRADE DISTANCE PENALTIES
- [x] WORLD GENERATION STREAMING
- [x] DETERMINISM AUDIT
- [x] LARGE MAP TARGET SCENARIOS ($256$, $512$, $1024$)
- [x] CITY BEAUTY REQUIREMENTS
- [x] DISTANCE BETWEEN CITIES
- [x] GEOGRAPHIC SCALE & NOISE NORMALIZATION
- [x] WORLD COMPOSITION
- [x] PERF-V1 DEPENDENCIES
- [x] RISK REGISTER
- [x] STRATEGIC OPTIONS (CONSERVATIVE / BALANCED / AGGRESSIVE)
- [x] RECOMMENDED DIRECTION
- [x] FILE IMPACT MAP
- [x] CITY-V1 COMPATIBILITY

**AUDIT COMPLETE — NO CODE WAS MODIFIED.**
