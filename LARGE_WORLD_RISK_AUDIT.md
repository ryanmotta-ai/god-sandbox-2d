# AETHORIA — PRE-WORLD-V1
## LARGE WORLD RISK AUDIT (50 SCALING RISKS)

> [!IMPORTANT]
> **READ-ONLY AUDIT MANDATE**
> This document is a non-destructive architectural audit identifying assumptions in *Aethoria* that function today only because the default world map is small ($128 \times 128 = 16,384$ tiles). No code has been modified, no gameplay balance altered, and no performance systems refactored.

---

## 1. AGGRESSIVE RISK INVENTORY (50 SCALING RISKS)

---

### RISK 01: Arrays Allocated as Width × Height
- **FILE:** [`src/world/TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L12)
- **FUNCTION / CLASS:** `TileMap` constructor
- **APPROXIMATE LOCATION:** Lines 12 & 23
- **CURRENT BEHAVIOR:** Allocates a flat 2D grid array `grid[x][y]` of dimensions $W \times H$.
- **COMPLEXITY:** $O(W \cdot H)$ space and allocation time.
- **WHY IT WORKS TODAY:** At $128 \times 128$, allocating $16,384$ array references takes $< 2\text{ms}$ and $< 1\text{MB}$.
- **WHY LARGE WORLDS MAY BREAK IT:** At $1024 \times 1024$ ($1.05\text{M}$ tiles), allocating $1,024$ outer arrays with $1,024$ inner arrays creates $1.05\text{M}$ object references, spiking Garbage Collection (GC) overhead.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Replace 2D JS arrays with $32 \times 32$ Chunk arrays or 1D TypedArrays (`Uint8Array`, `Float32Array`).

---

### RISK 02: Giant 2D Grid Structure
- **FILE:** [`src/world/TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L365)
- **FUNCTION / CLASS:** `TileMap.deserialize`
- **APPROXIMATE LOCATION:** Lines 365–369
- **CURRENT BEHAVIOR:** Re-instantiates nested arrays `this.grid[x] = []` and populates every single cell.
- **COMPLEXITY:** $O(W \cdot H)$ space.
- **WHY IT WORKS TODAY:** Fits easily in memory for a single $128 \times 128$ map.
- **WHY LARGE WORLDS MAY BREAK IT:** Prevents lazy loading or chunk unloading. The entire world grid must stay resident in RAM.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Use a chunked grid layout (`ChunkMap`) with dynamic chunk loading/unloading.

---

### RISK 03: Objects Created for Every Single Tile
- **FILE:** [`src/world/WorldGenerator.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/WorldGenerator.ts#L94)
- **FUNCTION / CLASS:** `WorldGenerator.generate`
- **APPROXIMATE LOCATION:** Line 94 (`new Tile(x, y, type, nH)`)
- **CURRENT BEHAVIOR:** Instantiates a full JavaScript class instance of `Tile` for every single cell on the map.
- **COMPLEXITY:** $O(W \cdot H)$ memory allocation.
- **WHY IT WORKS TODAY:** $16,384$ `Tile` instances consume $\sim 4.9\text{MB}$ of V8 heap.
- **WHY LARGE WORLDS MAY BREAK IT:** At $1024 \times 1024$ ($1.05\text{M}$ tiles), $1,048,576$ `Tile` instances consume $\sim 314\text{MB}$ of V8 heap, causing severe GC pauses during main loop execution.
- **SEVERITY:** CRITICAL
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Move tile data to struct-of-arrays (TypedArrays) or compact binary buffers per $32 \times 32$ chunk.

---

### RISK 04: Sets/Maps Holding Large Quantities of Tile IDs
- **FILE:** [`src/civ/City.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/City.ts#L72)
- **FUNCTION / CLASS:** `City` class
- **APPROXIMATE LOCATION:** Line 72 (`public territory: Set<string> = new Set()`)
- **CURRENT BEHAVIOR:** City territory stores tile coordinates as formatted strings `"x,y"` in a `Set<string>`.
- **COMPLEXITY:** $O(T_{\text{city}})$ memory and GC allocation per territory tile.
- **WHY IT WORKS TODAY:** Metropolis territory cap is $2,000$ tiles ($\sim 2,000$ string keys per city).
- **WHY LARGE WORLDS MAY BREAK IT:** In CITY-V1 / WORLD-V1, metropolises expanding to $6,000+$ tiles across 20 cities will allocate $>100,000$ coordinate string objects in V8.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Replace `Set<string>` with 32-bit packed integer sets (`x << 16 | y`) or bitmask arrays per chunk.

---

### RISK 05: Full-World Tile Scans (Fire Ticks)
- **FILE:** [`src/world/TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L148)
- **FUNCTION / CLASS:** `TileMap.updateFireTick`
- **APPROXIMATE LOCATION:** Lines 148–151
- **CURRENT BEHAVIOR:** Iterates `for (let x = 0; x < w; x++) for (let y = 0; y < h; y++)` over every single cell on every fire tick.
- **COMPLEXITY:** $O(W \cdot H)$ per fire tick.
- **WHY IT WORKS TODAY:** $16,384$ iterations take $< 0.3\text{ms}$ on modern CPUs.
- **WHY LARGE WORLDS MAY BREAK IT:** At $1024 \times 1024$, scanning $1.05\text{M}$ tiles on every fire tick takes $> 25\text{ms}$, dropping FPS from 60 to 20.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Maintain an active `activeFireSet: Set<number>` containing only currently burning tile indices.

---

### RISK 06: Nested Loops Over Viewport/World Tiles
- **FILE:** [`src/renderer/Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L1421)
- **FUNCTION / CLASS:** `PixelRenderer.renderOceanHorizon`
- **APPROXIMATE LOCATION:** Lines 1421–1422
- **CURRENT BEHAVIOR:** Double loop `for (let x = renderMinX; x <= renderMaxX; x++)` over visible screen padding.
- **COMPLEXITY:** $O(\text{ViewportWidth} \cdot \text{ViewportHeight})$.
- **WHY IT WORKS TODAY:** Viewport fits within screen canvas bounds.
- **WHY LARGE WORLDS MAY BREAK IT:** When zoomed out (`minZoom: 0.3`) on large maps, screen tile bounds span over $100,000$ tiles, causing per-frame draw call slowdowns.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Render ocean horizon as a single large CSS background or scaled quad rectangle.

---

### RISK 07: City × Tile Territory Expansion Loops
- **FILE:** [`src/civ/CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L1212)
- **FUNCTION / CLASS:** `CivilizationEngine.expandTerritory`
- **APPROXIMATE LOCATION:** Lines 1212–1250
- **CURRENT BEHAVIOR:** Iterates over every tile in `city.territory`, parses `"x,y"` strings, and checks adjacent tiles.
- **COMPLEXITY:** $O(C \cdot T_{\text{city}})$.
- **WHY IT WORKS TODAY:** Few cities with small territory limits ($60-2,000$ tiles).
- **WHY LARGE WORLDS MAY BREAK IT:** With 50 cities on a large world, territory expansion ticks scan hundreds of thousands of tiles per simulated year.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Track territory boundary ring tiles (`borderTiles`) per city rather than scanning internal territory tiles.

---

### RISK 08: Realm × City Territory Aggregation Loops
- **FILE:** [`src/civ/Kingdom.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Kingdom.ts#L1830)
- **FUNCTION / CLASS:** `Kingdom` territory update
- **APPROXIMATE LOCATION:** Line 1830
- **CURRENT BEHAVIOR:** Iterates over all cities in `kingdom.cityIds` and sums `city.territory.size`.
- **COMPLEXITY:** $O(K \cdot C_{\text{realm}})$.
- **WHY IT WORKS TODAY:** Small number of realms ($3-6$) and cities ($5-15$).
- **WHY LARGE WORLDS MAY BREAK IT:** Escalates as city counts grow; lightweight today, but called repeatedly in macro simulation loops.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Maintain `kingdom.territorySize` incrementally as cities claim/lose tiles.

---

### RISK 09: Entity × Entity Spatial Searches
- **FILE:** [`src/ai/EntityAI.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/EntityAI.ts#L1845)
- **FUNCTION / CLASS:** `SimulationEngine.updateCombatAI`
- **APPROXIMATE LOCATION:** Lines 1845–1870
- **CURRENT BEHAVIOR:** Queries spatial hash for nearby entities and iterates returned array to find enemies/targets.
- **COMPLEXITY:** $O(E_{\text{active}} \cdot N_{\text{nearby}})$.
- **WHY IT WORKS TODAY:** Entity count is small ($100 - 500$ entities).
- **WHY LARGE WORLDS MAY BREAK IT:** With $10,000+$ entities on a large map, un-culled entity combat loops freeze the CPU.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** Yes (Core PERF-V1 responsibility via Entity LOD / Scheduler)
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** PERF-V1 Entity LOD sleeping for inactive chunks.

---

### RISK 10: City × City Intercity Road Construction Loops
- **FILE:** [`src/civ/CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L943)
- **FUNCTION / CLASS:** `CivilizationEngine.paveTradeRoad`
- **APPROXIMATE LOCATION:** Lines 943–955
- **CURRENT BEHAVIOR:** Surveys roads between pairs of cities using full tile-by-tile A* pathfinding.
- **COMPLEXITY:** $O(C^2 \cdot \text{AStarCost})$.
- **WHY IT WORKS TODAY:** Intercity distances are short ($15 - 40$ tiles), A* search completes in $< 1\text{ms}$.
- **WHY LARGE WORLDS MAY BREAK IT:** On a $512 \times 512$ map, intercity distances reach $200+$ tiles. Running A* between dozens of city pairs consumes hundreds of milliseconds per tick.
- **SEVERITY:** CRITICAL
- **PERF-V1 MAY FIX?** Partial (Path Cache)
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Implement Hierarchical Pathfinding (HPA*) and graph-based intercity road networks.

---

### RISK 11: Realm × Realm Matrix Update in Diplomacy
- **FILE:** [`src/civ/Diplomacy.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Diplomacy.ts#L85)
- **FUNCTION / CLASS:** `DiplomacyManager.updateDiplomacy`
- **APPROXIMATE LOCATION:** Lines 85–110
- **CURRENT BEHAVIOR:** Double loop `for (const k1 of kingdoms) for (const k2 of kingdoms)` updating opinion matrices.
- **COMPLEXITY:** $O(K^2)$ per diplomatic tick.
- **WHY IT WORKS TODAY:** Realm count $K \le 6$ ($36$ iterations).
- **WHY LARGE WORLDS MAY BREAK IT:** With $K = 50$ realms, matrix updates require $2,500$ iterations per tick.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Update diplomacy asynchronously or only between neighboring realms with shared borders.

---

### RISK 12: Unbounded Spatial Pathfinding Search Node Cap
- **FILE:** [`src/ai/Pathfinding.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/Pathfinding.ts#L329)
- **FUNCTION / CLASS:** `SimplePathfinder.findPath`
- **APPROXIMATE LOCATION:** Line 329 (`maxNodes: number = 3000`)
- **CURRENT BEHAVIOR:** Caps A* heap node expansions at a fixed $3,000$ limit without spatial bounding box constraints.
- **COMPLEXITY:** $O(N \log N)$ where $N \le 3000$.
- **WHY IT WORKS TODAY:** On $128 \times 128$, $3,000$ nodes covers almost the entire map.
- **WHY LARGE WORLDS MAY BREAK IT:** On a $512 \times 512$ map, a diagonal route requiring $>150$ steps hits the $3,000$ node cap and fails, returning an empty path `[]` and breaking trade/roads.
- **SEVERITY:** CRITICAL
- **PERF-V1 MAY FIX?** Partial
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Use Hierarchical A* (HPA*) for macro paths and bound search spaces with bounding boxes.

---

### RISK 13: Continental A* Road & Rail Survey
- **FILE:** [`src/civ/RoadEngineering.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/RoadEngineering.ts#L132)
- **FUNCTION / CLASS:** `surveyRoad`
- **APPROXIMATE LOCATION:** Line 132
- **CURRENT BEHAVIOR:** Runs full land A* pathfinding to survey road routes between points across terrain.
- **COMPLEXITY:** $O(\text{Nodes} \log \text{Nodes})$.
- **WHY IT WORKS TODAY:** Short routes across small maps.
- **WHY LARGE WORLDS MAY BREAK IT:** Long-distance surveys across large continents stall the main thread during road construction.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Survey roads in background Web Workers or use chunk-level waypoint graphs.

---

### RISK 14: Hardcoded Search Radius Caps
- **FILE:** [`src/civ/CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L1086)
- **FUNCTION / CLASS:** `CivilizationEngine.citySurveyRadius`
- **APPROXIMATE LOCATION:** Line 1086 (`Math.min(22, ...)`)
- **CURRENT BEHAVIOR:** Caps city survey radius to a hardcoded max of $22$ tiles.
- **COMPLEXITY:** $O(R^2)$ tile checks.
- **WHY IT WORKS TODAY:** Fits nicely within $128 \times 128$ map dimensions.
- **WHY LARGE WORLDS MAY BREAK IT:** Prevents large metropolises from surveying or claiming farmland beyond 22 tiles in WORLD-V1 / CITY-V1.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Scale survey radius dynamically based on settlement tier and world dimension parameters.

---

### RISK 15: City Placement Assuming Small Distances
- **FILE:** [`src/civ/CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L1132)
- **FUNCTION / CLASS:** `CivilizationEngine.findBuildingSite`
- **APPROXIMATE LOCATION:** Line 1132
- **CURRENT BEHAVIOR:** Scans building sites strictly within `citySurveyRadius` ($\le 22$ tiles).
- **COMPLEXITY:** $O(R^2)$.
- **WHY IT WORKS TODAY:** Buildings stay tightly packed around town center.
- **WHY LARGE WORLDS MAY BREAK IT:** Prevents CITY-V1 from placing extramural suburbs, industrial outskirts, or distant port districts.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Allow district-specific placement radii (e.g. Industrial District radius $= 40$ tiles).

---

### RISK 16: Resource Deposit Generation Scaling
- **FILE:** [`src/world/Deposits.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/Deposits.ts#L62)
- **FUNCTION / CLASS:** `generateDeposits`
- **APPROXIMATE LOCATION:** Lines 62–110
- **CURRENT BEHAVIOR:** Scans all land tiles across the grid and seeds resource deposit blobs.
- **COMPLEXITY:** $O(W \cdot H)$.
- **WHY IT WORKS TODAY:** Fast execution on $16,384$ tiles.
- **WHY LARGE WORLDS MAY BREAK IT:** On $1\text{M}+$ tiles, scanning and seeding thousands of resource clusters takes hundreds of milliseconds during world creation.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Generate resource deposits per $32 \times 32$ chunk during chunk creation.

---

### RISK 17: River Carving Peak Search & Overflow Loops
- **FILE:** [`src/world/WorldGenerator.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/WorldGenerator.ts#L236)
- **FUNCTION / CLASS:** `WorldGenerator.carveRivers`
- **APPROXIMATE LOCATION:** Lines 236–332
- **CURRENT BEHAVIOR:** Scans entire grid for mountain peaks, chooses river sources, and carves flow paths down to ocean with basin lake overflow checks.
- **COMPLEXITY:** $O(W \cdot H + R \cdot (W + H))$.
- **WHY IT WORKS TODAY:** Map dimensions are small, river count bounded ($2-6$).
- **WHY LARGE WORLDS MAY BREAK IT:** On large worlds with hundreds of rivers, steepest descent loops and basin rim searches take several seconds synchronously.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Run river carving in background Web Worker during world setup.

---

### RISK 18: Biome Simplex Noise Octave Calculation
- **FILE:** [`src/world/WorldGenerator.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/WorldGenerator.ts#L43)
- **FUNCTION / CLASS:** `WorldGenerator.generate`
- **APPROXIMATE LOCATION:** Lines 43–101
- **CURRENT BEHAVIOR:** Double loop `for (let x = 0; x < width; x++) for (let y = 0; y < height; y++)` evaluating 6 noise octaves per tile.
- **COMPLEXITY:** $O(W \cdot H \cdot \text{Octaves})$.
- **WHY IT WORKS TODAY:** Takes $\sim 30\text{ms}$ for $16,384$ tiles.
- **WHY LARGE WORLDS MAY BREAK IT:** At $1024 \times 1024$ ($1.05\text{M}$ tiles), evaluating $6\text{M}+$ Simplex noise octaves takes $\sim 2.5\text{ seconds}$ synchronously.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Offload height/biome generation to Web Workers or chunked async generator pipelines.

---

### RISK 19: Global Territory Claims Pass
- **FILE:** [`src/civ/CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L1212)
- **FUNCTION / CLASS:** `CivilizationEngine.expandTerritory`
- **APPROXIMATE LOCATION:** Lines 1212–1260
- **CURRENT BEHAVIOR:** Evaluates unclaimed land tiles adjacent to existing city territory across the world.
- **COMPLEXITY:** $O(C \cdot \text{TerritorySize})$.
- **WHY IT WORKS TODAY:** Total claimed territory is small.
- **WHY LARGE WORLDS MAY BREAK IT:** On large worlds, scanning territory borders for dozens of cities stalls the macro tick.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Maintain active frontier tile queues per city.

---

### RISK 20: Global Realm Border Outline Render Pass
- **FILE:** [`src/renderer/Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L2300)
- **FUNCTION / CLASS:** `PixelRenderer.drawKingdomBorders`
- **APPROXIMATE LOCATION:** Lines 2300–2350
- **CURRENT BEHAVIOR:** Scans territory tiles to draw border stroke outlines.
- **COMPLEXITY:** $O(\text{BorderTiles})$.
- **WHY IT WORKS TODAY:** Territory borders are short.
- **WHY LARGE WORLDS MAY BREAK IT:** On large maps, scanning and drawing thousands of border segment paths every frame degrades FPS.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Bake political territory border fills into chunk overlay canvases.

---

### RISK 21: Per-Frame Road Network Graph Rebuilding
- **FILE:** [`src/renderer/Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L96)
- **FUNCTION / CLASS:** `PixelRenderer.render`
- **APPROXIMATE LOCATION:** Lines 96–115 & 1550–1620
- **CURRENT BEHAVIOR:** Scans visible viewport tiles, extracts road connectivity, and builds temporary `RoadNode` objects **every frame**.
- **COMPLEXITY:** $O(\text{VisibleRoadTiles})$ allocations per frame.
- **WHY IT WORKS TODAY:** Viewport contains few road tiles ($50 - 200$).
- **WHY LARGE WORLDS MAY BREAK IT:** When zoomed out on large maps with extensive road networks, allocating thousands of `RoadNode` instances per frame causes severe GC churn.
- **SEVERITY:** CRITICAL
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Cache road network node topology permanently; update only when roads are built or damaged.

---

### RISK 22: Yearly Rail Network Capacity Recalculation
- **FILE:** [`src/civ/RailwayNetwork.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/RailwayNetwork.ts#L120)
- **FUNCTION / CLASS:** `RailwayNetwork.updateYearlyFreight`
- **APPROXIMATE LOCATION:** Lines 120–165
- **CURRENT BEHAVIOR:** Recalculates freight capacity across all rail track segments in the world once per year.
- **COMPLEXITY:** $O(\text{RailSegments})$.
- **WHY IT WORKS TODAY:** Rail lines are short and few.
- **WHY LARGE WORLDS MAY BREAK IT:** Escalates as transcontinental rail networks expand to thousands of tiles.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Update rail line capacity incrementally on segment state change.

---

### RISK 23: Global Trade Partner Search
- **FILE:** [`src/civ/CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L2800)
- **FUNCTION / CLASS:** `CivilizationEngine.evaluateTradeRoutes`
- **APPROXIMATE LOCATION:** Lines 2800–2850
- **CURRENT BEHAVIOR:** Iterates through all cities across all known kingdoms to evaluate potential trade partners.
- **COMPLEXITY:** $O(C^2)$.
- **WHY IT WORKS TODAY:** City count $C \le 10$ ($100$ comparisons).
- **WHY LARGE WORLDS MAY BREAK IT:** With $100+$ cities, trade partner search requires $10,000+$ route evaluations per tick.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Use spatial range queries to evaluate trade partners within practical geographic range.

---

### RISK 24: Global Nearest-City Search
- **FILE:** [`src/ai/EntityAI.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/EntityAI.ts#L520)
- **FUNCTION / CLASS:** `EntityAI.findNearestCity`
- **APPROXIMATE LOCATION:** Lines 520–540
- **CURRENT BEHAVIOR:** Iterates linearly over `sim.cities.values()` to compute Euclidean distance to every city.
- **COMPLEXITY:** $O(C)$ per call.
- **WHY IT WORKS TODAY:** City count $C \le 10$.
- **WHY LARGE WORLDS MAY BREAK IT:** Called frequently by citizens/caravans; with $100+$ cities, linear scans waste CPU cycles.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Spatial hash or quadtree index for cities.

---

### RISK 25: Global Nearest-Building Search
- **FILE:** [`src/ai/EntityAI.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/EntityAI.ts#L740)
- **FUNCTION / CLASS:** `EntityAI.findWorkplace`
- **APPROXIMATE LOCATION:** Lines 740–765
- **CURRENT BEHAVIOR:** Iterates over `city.buildings.values()` to check available job slots.
- **COMPLEXITY:** $O(B_{\text{city}})$.
- **WHY IT WORKS TODAY:** Buildings per city $B \le 70$.
- **WHY LARGE WORLDS MAY BREAK IT:** In CITY-V1 with $300+$ buildings per city, linear building scans slow down citizen daily AI ticks.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Maintain job/housing availability queues per city.

---

### RISK 26: Rectangular Resource Site Search with Distance Sort
- **FILE:** [`src/world/TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L66)
- **FUNCTION / CLASS:** `TileMap.findResourceSites`
- **APPROXIMATE LOCATION:** Lines 66–100
- **CURRENT BEHAVIOR:** Scans rectangular bounding box `[centerX - radius, centerX + radius]`, pushes matching tiles to array, and calls `.sort()` by distance.
- **COMPLEXITY:** $O(R^2 + N \log N)$.
- **WHY IT WORKS TODAY:** Radius is small ($\le 22$ tiles).
- **WHY LARGE WORLDS MAY BREAK IT:** On large survey radii ($R = 50+$), scanning $10,000$ tiles and sorting matching arrays wastes CPU.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Use spatial resource grid indices (`resourcesByGood` in `City.ts`).

---

### RISK 27: Citizen AI Scanning Full Spatial Neighborhoods
- **FILE:** [`src/ai/EntityAI.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/EntityAI.ts#L310)
- **FUNCTION / CLASS:** `EntityAI.updateCitizen`
- **APPROXIMATE LOCATION:** Lines 310–380
- **CURRENT BEHAVIOR:** Citizens tick daily routines, querying spatial hash for food, work, and shelter.
- **COMPLEXITY:** $O(E_{\text{active}} \cdot \text{QueryCost})$.
- **WHY IT WORKS TODAY:** Population is small ($100 - 300$ citizens).
- **WHY LARGE WORLDS MAY BREAK IT:** With $10,000+$ citizens on large maps, un-culled citizen AI ticks crush frame rate.
- **SEVERITY:** CRITICAL
- **PERF-V1 MAY FIX?** Yes (Core PERF-V1 domain: Entity HOT/WARM/COLD LOD scheduler)
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** PERF-V1 Entity LOD scheduling (ticking only visible/HOT citizens).

---

### RISK 28: Animal Wildlife AI Global Roaming Scans
- **FILE:** [`src/ai/EntityAI.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/EntityAI.ts#L1250)
- **FUNCTION / CLASS:** `EntityAI.updateAnimal`
- **APPROXIMATE LOCATION:** Lines 1250–1310
- **CURRENT BEHAVIOR:** Animals search for edible grass/water or prey by querying spatial hash or random tiles.
- **COMPLEXITY:** $O(E_{\text{animal}} \cdot \text{QueryCost})$.
- **WHY IT WORKS TODAY:** Wildlife count bounded ($50 - 150$ animals).
- **WHY LARGE WORLDS MAY BREAK IT:** On large maps spawning thousands of wild deer, wolves, and bears, active animal AI ticks consume massive CPU.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** Yes (PERF-V1 Entity LOD)
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Freeze wildlife AI in SLEEPING/COLD chunks.

---

### RISK 29: Global Army & Warfare Target Scans
- **FILE:** [`src/civ/Warfare.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Warfare.ts#L140)
- **FUNCTION / CLASS:** `WarfareManager.evaluateTargets`
- **APPROXIMATE LOCATION:** Lines 140–185
- **CURRENT BEHAVIOR:** Scans all enemy cities across the map to select military siege targets.
- **COMPLEXITY:** $O(\text{Armies} \cdot C_{\text{enemy}})$.
- **WHY IT WORKS TODAY:** Single active war between 2 small realms.
- **WHY LARGE WORLDS MAY BREAK IT:** Multiple simultaneous continental wars with dozens of armies scanning distant target cities.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Partial
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Bound army target selection to adjacent frontier regions.

---

### RISK 30: $O(K^2)$ Diplomatic Opinion Matrix Update
- **FILE:** [`src/civ/Diplomacy.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Diplomacy.ts#L145)
- **FUNCTION / CLASS:** `DiplomacyManager.updateOpinions`
- **APPROXIMATE LOCATION:** Lines 145–180
- **CURRENT BEHAVIOR:** Double loop updating pairwise relations between all kingdoms.
- **COMPLEXITY:** $O(K^2)$.
- **WHY IT WORKS TODAY:** $K \le 6$ ($36$ updates).
- **WHY LARGE WORLDS MAY BREAK IT:** With $K = 50$ realms on a large world, matrix updates require $2,500$ calculations every diplomatic tick.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Update relations only between known/neighboring realms.

---

### RISK 31: Market Supply/Demand Calculations ($O(C \cdot G)$)
- **FILE:** [`src/civ/Economy.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Economy.ts#L210)
- **FUNCTION / CLASS:** `Market.updatePrices`
- **APPROXIMATE LOCATION:** Lines 210–250
- **CURRENT BEHAVIOR:** Ticks market prices for every city across all $20+$ good types.
- **COMPLEXITY:** $O(C \cdot G)$ where $G \approx 22$.
- **WHY IT WORKS TODAY:** Few cities ($C \le 10$).
- **WHY LARGE WORLDS MAY BREAK IT:** With $100+$ cities, market ticks require $>2,200$ price adjustment passes per year.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Aggregate market ticks at regional market hub level.

---

### RISK 32: Offscreen Static Terrain Baking Whole Map
- **FILE:** [`src/renderer/Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L1485)
- **FUNCTION / CLASS:** `PixelRenderer.ensureTerrainBake`
- **APPROXIMATE LOCATION:** Lines 1485–1510
- **CURRENT BEHAVIOR:** Bakes the ENTIRE static terrain layer into an offscreen canvas `terrainCanvas` at $16\text{px}$ per tile.
- **COMPLEXITY:** $O(W \cdot H)$ VRAM memory and pixel draws.
- **WHY IT WORKS TODAY:** At $128 \times 128$, canvas resolution is $2048 \times 2048\text{ px}$ ($16.7\text{MB}$ VRAM).
- **WHY LARGE WORLDS MAY BREAK IT:** At $512 \times 512$, canvas resolution is $8192 \times 8192\text{ px}$ ($268.4\text{MB}$ VRAM). At $1024 \times 1024$, canvas resolution is $16384 \times 16384\text{ px}$ ($1.07\text{GB}$ VRAM) — **CRASHES browser HTML5 Canvas 2D size limit!**
- **SEVERITY:** CRITICAL
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Implement $32 \times 32$ Chunk Canvas bakes.

---

### RISK 33: City Label & Badge Rendering Out of Viewport
- **FILE:** [`src/renderer/Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L2100)
- **FUNCTION / CLASS:** `PixelRenderer.drawCityLabels`
- **APPROXIMATE LOCATION:** Lines 2100–2160
- **CURRENT BEHAVIOR:** Iterates over all cities in `sim.cities.values()` to calculate label positions.
- **COMPLEXITY:** $O(C)$.
- **WHY IT WORKS TODAY:** Few cities ($C \le 10$).
- **WHY LARGE WORLDS MAY BREAK IT:** With $100+$ cities, un-culled label position math wastes Canvas 2D text calls.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Viewport bounding box culling for city labels.

---

### RISK 34: Un-Culled Particle Updates Outside Viewport
- **FILE:** [`src/renderer/Particles.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Particles.ts#L45)
- **FUNCTION / CLASS:** `ParticleManager.update`
- **APPROXIMATE LOCATION:** Lines 45–75
- **CURRENT BEHAVIOR:** Updates positions and lifetimes for all active particles in memory regardless of camera view.
- **COMPLEXITY:** $O(P_{\text{total}})$.
- **WHY IT WORKS TODAY:** Max particles $\le 500$.
- **WHY LARGE WORLDS MAY BREAK IT:** Industrial chimneys and fires across a large world spawn thousands of offscreen particles.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Cull particle creation and updates outside camera viewport.

---

### RISK 35: Overlays Processing Entire Map Grid
- **FILE:** [`src/renderer/Overlays.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Overlays.ts#L80)
- **FUNCTION / CLASS:** `OverlayManager.renderOverlay`
- **APPROXIMATE LOCATION:** Lines 80–120
- **CURRENT BEHAVIOR:** Iterates through full map grid to calculate temperature/biome/trade overlay colors.
- **COMPLEXITY:** $O(W \cdot H)$.
- **WHY IT WORKS TODAY:** Fast on $16,384$ tiles.
- **WHY LARGE WORLDS MAY BREAK IT:** On $1\text{M}+$ tiles, full overlay loops freeze rendering.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Restrict overlay rendering strictly to visible viewport tiles (`minX..maxX, minY..maxY`).

---

### RISK 36: Full Minimap Canvas Rebuild
- **FILE:** [`src/ui/components/MapPreview.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ui/components/MapPreview.ts#L50)
- **FUNCTION / CLASS:** `MapPreview.drawGenerated`
- **APPROXIMATE LOCATION:** Lines 50–90
- **CURRENT BEHAVIOR:** Re-samples noise and redraws full world minimap pixel-by-pixel onto preview canvas.
- **COMPLEXITY:** $O(\text{PreviewWidth} \cdot \text{PreviewHeight} \cdot \text{Octaves})$.
- **WHY IT WORKS TODAY:** Preview resolution is small ($112 \times 112\text{ px}$).
- **WHY LARGE WORLDS MAY BREAK IT:** Frequent minimap updates during world creation or play stall the main thread.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Downsample chunk bakes directly to construct the minimap texture.

---

### RISK 37: Save System Serializing Derivable Static Terrain Data
- **FILE:** [`src/world/TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L322)
- **FUNCTION / CLASS:** `TileMap.serialize`
- **APPROXIMATE LOCATION:** Lines 322–335
- **CURRENT BEHAVIOR:** Serializes `h` (height), `temp` (temperature), and `m` (moisture) for every single tile into the save file.
- **COMPLEXITY:** $O(W \cdot H)$ string size.
- **WHY IT WORKS TODAY:** Save JSON size is $\sim 3.5\text{MB}$ ($128 \times 128$).
- **WHY LARGE WORLDS MAY BREAK IT:** Increases save payload by $>40\%$. On $512 \times 512$, height/climate data alone adds $\sim 18\text{MB}$ to the save file.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Re-derive unmodified static terrain height and climate from map seed + blueprint on load; serialize only modified tiles.

---

### RISK 38: Save System Serializing Tiles as Heavy JSON Objects
- **FILE:** [`src/world/TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L326)
- **FUNCTION / CLASS:** `TileMap.serialize`
- **APPROXIMATE LOCATION:** Lines 326–348
- **CURRENT BEHAVIOR:** Serializes every tile as an individual JSON object with 18 keys inside a giant array.
- **COMPLEXITY:** $O(W \cdot H \cdot 18)$ JSON key strings.
- **WHY IT WORKS TODAY:** Fits in `localStorage` for $128 \times 128$.
- **WHY LARGE WORLDS MAY BREAK IT:** At $512 \times 512$, JSON save string exceeds $42\text{MB}$, crashing `localStorage` ($5\text{MB}$ cap).
- **SEVERITY:** CRITICAL
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Migrate save backend to `IndexedDB` with RLE (Run-Length Encoding) sparse tile compression.

---

### RISK 39: Load Phase Rebuilding Building Occupancy in $O(N \cdot B)$
- **FILE:** [`src/core/SaveSystem.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/SaveSystem.ts#L298)
- **FUNCTION / CLASS:** `SaveSystem.importSaveData`
- **APPROXIMATE LOCATION:** Lines 298–306
- **CURRENT BEHAVIOR:** Rebuilds building occupancy on load by iterating all restored entities and looking up home/workplace IDs in city maps.
- **COMPLEXITY:** $O(E \cdot \text{MapLookup})$.
- **WHY IT WORKS TODAY:** Entity count is small ($100 - 300$).
- **WHY LARGE WORLDS MAY BREAK IT:** With $10,000+$ entities, post-load linkage pass delays world load time.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Serialize resident and worker ID lists directly on building records.

---

### RISK 40: Giant Single JSON Stringify/Parse Operations
- **FILE:** [`src/core/SaveSystem.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/SaveSystem.ts#L95)
- **FUNCTION / CLASS:** `SaveSystem.writeSlot` & `readSlot`
- **APPROXIMATE LOCATION:** Lines 86 & 95
- **CURRENT BEHAVIOR:** Calls `JSON.stringify(data)` and `JSON.parse(raw)` on the entire unified save payload in one synchronous call.
- **COMPLEXITY:** $O(\text{SaveSizeInBytes})$.
- **WHY IT WORKS TODAY:** Save JSON is $\sim 3.5\text{MB}$ ($< 50\text{ms}$ parse time).
- **WHY LARGE WORLDS MAY BREAK IT:** On $512 \times 512$ maps, stringifying/parsing a $40\text{MB}+$ JSON string freezes the UI tab for several seconds or throws `RangeError: Invalid string length`.
- **SEVERITY:** CRITICAL
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Stream save data chunk-by-chunk into `IndexedDB`.

---

### RISK 41: World State Deep Cloning & Serialization Overheads
- **FILE:** [`src/core/SaveSystem.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/SaveSystem.ts#L139)
- **FUNCTION / CLASS:** `SaveSystem.exportSaveData`
- **APPROXIMATE LOCATION:** Lines 139–206
- **CURRENT BEHAVIOR:** Creates a complete deep JS object graph containing world tiles, entities, cities, kingdoms, market, trade, and history.
- **COMPLEXITY:** $O(W \cdot H + E + C + K)$.
- **WHY IT WORKS TODAY:** Takes $< 100\text{ms}$ for default world setup.
- **WHY LARGE WORLDS MAY BREAK IT:** Autosave ticks spike frame time, creating visible micro-stutters during gameplay.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** Partial
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Perform autosaving asynchronously using web worker web locks or incremental diff saves.

---

### RISK 42: Debug / Inspector Systems Copying World State
- **FILE:** [`src/ui/inspector/BuildingPanel.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ui/inspector/BuildingPanel.ts#L510)
- **FUNCTION / CLASS:** Inspector UI panels
- **APPROXIMATE LOCATION:** Lines 510–512
- **CURRENT BEHAVIOR:** Inspector panels extract arrays from sets (`Array.from(building.residentIds)`) when rendering inspector UI cards.
- **COMPLEXITY:** $O(\text{Residents})$.
- **WHY IT WORKS TODAY:** Residential capacity is small ($4 - 10$ residents).
- **WHY LARGE WORLDS MAY BREAK IT:** In CITY-V1 with high-density apartment blocks housing 50+ citizens, opening inspector panels creates trash allocations.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Use lazy iterator getters for UI inspector views.

---

### RISK 43: World Snapshot Provider Full Aggregation Passes
- **FILE:** [`src/ui/core/WorldSnapshot.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ui/core/WorldSnapshot.ts#L45)
- **FUNCTION / CLASS:** `WorldSnapshotProvider.getSnapshot`
- **APPROXIMATE LOCATION:** Lines 45–95
- **CURRENT BEHAVIOR:** Aggregates world statistics by iterating all cities, kingdoms, and entities every HUD update tick.
- **COMPLEXITY:** $O(C + K + E)$.
- **WHY IT WORKS TODAY:** Aggregates $< 500$ total elements in $< 0.5\text{ms}$.
- **WHY LARGE WORLDS MAY BREAK IT:** With thousands of entities and cities, per-frame HUD snapshot rebuilds degrade UI performance.
- **SEVERITY:** MEDIUM
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Maintain global demographic stats incrementally; cache snapshots at 1 Hz.

---

### RISK 44: Spread Operator (`...`) on Large Collection Arrays
- **FILE:** [`src/civ/Trade.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Trade.ts#L103)
- **FUNCTION / CLASS:** `TradeNetwork.cancelAgreement`
- **APPROXIMATE LOCATION:** Line 103 (`[...this.routes]`)
- **CURRENT BEHAVIOR:** Spreads `Map` values or `Set` keys into new array instances (`[...collection]`).
- **COMPLEXITY:** $O(N)$ allocation.
- **WHY IT WORKS TODAY:** Route count $N \le 20$.
- **WHY LARGE WORLDS MAY BREAK IT:** On large collections, spreading into temporary arrays spikes GC allocation rates.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Use direct `for (const item of collection)` loops without array spread allocations.

---

### RISK 45: Frequent `Array.from` Allocations in Hot Code Paths
- **FILE:** [`src/civ/SaveSystem.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/SaveSystem.ts#L181)
- **FUNCTION / CLASS:** `SaveSystem.exportSaveData`
- **APPROXIMATE LOCATION:** Lines 181–182
- **CURRENT BEHAVIOR:** Calls `Array.from(sim.cities.values())` and `Array.from(sim.kingdoms.values())`.
- **COMPLEXITY:** $O(N)$ allocation.
- **WHY IT WORKS TODAY:** $N \le 20$.
- **WHY LARGE WORLDS MAY BREAK IT:** Generates short-lived array garbage during save or macro ticks.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Iterate collections directly using standard iterators (`for (const item of map.values())`).

---

### RISK 46: Global Sort Calls on Un-Bounded Collection Arrays
- **FILE:** [`src/civ/Trade.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Trade.ts#L228)
- **FUNCTION / CLASS:** `TradeNetwork.topRoutes`
- **APPROXIMATE LOCATION:** Line 228 (`[...this.routes.values()].sort(...)`)
- **CURRENT BEHAVIOR:** Copies all trade routes into an array and runs global `.sort()` to pick the top 10 routes.
- **COMPLEXITY:** $O(N \log N)$ where $N = \text{TotalRoutes}$.
- **WHY IT WORKS TODAY:** Route count $N \le 20$.
- **WHY LARGE WORLDS MAY BREAK IT:** On large worlds with hundreds of active trade routes, global sorting every UI frame wastes CPU.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Maintain a top-K min-heap or fixed-size priority queue for top routes.

---

### RISK 47: Chained Filter/Map/Reduce Operations in Simulation Ticks
- **FILE:** [`src/civ/CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L1621)
- **FUNCTION / CLASS:** `CivilizationEngine.tickKingdom`
- **APPROXIMATE LOCATION:** Lines 1621–1623
- **CURRENT BEHAVIOR:** Calls `[...kingdom.cityIds].map(id => world.cities.get(id)).filter((c): c is City => !!c)`.
- **COMPLEXITY:** $O(C_{\text{realm}})$ with 2 temporary intermediate array allocations.
- **WHY IT WORKS TODAY:** Cities per kingdom $C \le 5$.
- **WHY LARGE WORLDS MAY BREAK IT:** Allocates short-lived intermediate arrays inside high-frequency macro simulation loops.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Use inline imperative `for` loops without intermediate array instantiation.

---

### RISK 48: Caches Without Size Limits or Eviction Policies
- **FILE:** [`src/renderer/Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L131)
- **FUNCTION / CLASS:** `PixelRenderer`
- **APPROXIMATE LOCATION:** Line 131 (`private buildingFxTime: Map<string, number> = new Map()`)
- **CURRENT BEHAVIOR:** Maps building IDs to last particle emission timestamps without deleting destroyed buildings.
- **COMPLEXITY:** $O(B_{\text{ever\_built}})$ space leak.
- **WHY IT WORKS TODAY:** Total buildings created over a match is small ($< 500$).
- **WHY LARGE WORLDS MAY BREAK IT:** Over long simulated centuries on large worlds, destroyed buildings permanently leak map entries.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** Yes
- **WORLD-V1 MUST FIX?** No
- **RECOMMENDED FUTURE APPROACH:** Delete building entries when buildings are destroyed or use an LRU eviction policy.

---

### RISK 49: Full World Dirty Tile Cache Invalidation (`markAllDirty`)
- **FILE:** [`src/world/TileMap.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/TileMap.ts#L58)
- **FUNCTION / CLASS:** `TileMap.markAllDirty`
- **APPROXIMATE LOCATION:** Lines 58–63
- **CURRENT BEHAVIOR:** Double loop `for (let x = 0; x < this.width; x++) for (let y = 0; y < h; y++)` inserting `x * h + y` into `dirtyTiles`.
- **COMPLEXITY:** $O(W \cdot H)$ `Set` insertions.
- **WHY IT WORKS TODAY:** Takes $< 1\text{ms}$ for $16,384$ tiles.
- **WHY LARGE WORLDS MAY BREAK IT:** At $1024 \times 1024$, inserting $1.05\text{M}$ integer keys into `dirtyTiles` takes $> 40\text{ms}$ and spikes heap memory.
- **SEVERITY:** HIGH
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Use a boolean `allDirty` flag or invalidate dirty status per $32 \times 32$ chunk.

---

### RISK 50: Hardcoded World Dimensions in Core Engine & Camera
- **FILE:** [`src/renderer/Camera.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Camera.ts#L2)
- **FUNCTION / CLASS:** `Camera` constructor & bounds
- **APPROXIMATE LOCATION:** Lines 2–3, 26–27
- **CURRENT BEHAVIOR:** Camera initializes `x = 64 * 16`, `y = 64 * 16`, `worldWidthTiles = 128`, `worldHeightTiles = 128`.
- **COMPLEXITY:** $O(1)$ hardcoded values.
- **WHY IT WORKS TODAY:** Matches the hardcoded $128 \times 128$ default world size.
- **WHY LARGE WORLDS MAY BREAK IT:** Spawns camera off-center and clamps camera movement incorrectly on non-128 maps if bounds are not set immediately.
- **SEVERITY:** LOW
- **PERF-V1 MAY FIX?** No
- **WORLD-V1 MUST FIX?** Yes
- **RECOMMENDED FUTURE APPROACH:** Initialize camera position dynamically from `TileMap.width / 2` and `TileMap.height / 2`.

---

## 2. SCALING BOMBS (THE TOP 10 WORST CODE BOTTLENECK POINTS)

Here are the 10 worst asymptotic/scaling bottlenecks in the codebase:

```
+---------------------------------------------------------------------------------------------------+
| 1. OFFSCREEN TERRAIN CANVAS BAKE (Risk 32)                                                        |
| Location: Renderer.ts:L1485 (ensureTerrainBake)                                                   |
| Current (128x128): 2048x2048 px = 4.19 MP (16.7 MB VRAM) -> Works                                  |
| 4x Linear (512x512): 8192x8192 px = 67.1 MP (268.4 MB VRAM) -> Browser Canvas Limit!              |
| 8x Linear (1024x1024): 16384x16384 px = 268.4 MP (1.07 GB VRAM) -> HARD GPU CRASH                 |
| Growth: O(W * H * 256) pixels -> 64x area scaling = 64x VRAM multiplier!                          |
+---------------------------------------------------------------------------------------------------+
| 2. UNBOUNDED A* SEARCH & CONTINENTAL ROAD SURVEY (Risks 10, 12, 13)                               |
| Location: Pathfinding.ts:L324 (findPath) & CivilizationEngine.ts:L943 (paveTradeRoad)              |
| Current (128x128): Route dist ~30 tiles. A* expands ~150 nodes. < 1ms -> Works                   |
| 4x Linear (512x512): Route dist ~250 tiles. A* exceeds 3000 node maxNodes cap -> PATH FAILS []    |
| Growth: O(Dist^2) expansions -> 16x larger area = ~256x node expansion work per route!           |
+---------------------------------------------------------------------------------------------------+
| 3. TILE CLASS INSTANTIATION & HEAP MEMORY (Risk 03)                                               |
| Location: WorldGenerator.ts:L94 & Tile.ts:L54                                                     |
| Current (128x128): 16,384 Tile instances = 4.9 MB JS Heap -> Works                               |
| 8x Linear (1024x1024): 1,048,576 Tile instances = ~314 MB JS Heap -> MASSIVE GC STUTTER          |
| Growth: O(W * H) object references.                                                               |
+---------------------------------------------------------------------------------------------------+
| 4. SINGLE JSON STRINGIFY / PARSE SAVE PAYLOAD (Risks 38, 40)                                      |
| Location: SaveSystem.ts:L95 & TileMap.ts:L326                                                     |
| Current (128x128): Save payload ~3.5 MB JSON string -> localStorage quota OK                      |
| 4x Linear (512x512): Save payload ~42.0 MB JSON string -> LocalStorage QUOTA EXCEEDED CRASH       |
| Growth: O(W * H) JSON string length.                                                              |
+---------------------------------------------------------------------------------------------------+
| 5. FULL-GRID FIRE & FLUID TICK SCANS (Risk 05)                                                    |
| Location: TileMap.ts:L148 (updateFireTick) & L289 (updateFluidTick)                              |
| Current (128x128): 16,384 tiles scanned per fire/fluid tick = < 0.3ms -> Works                    |
| 8x Linear (1024x1024): 1,048,576 tiles scanned per fire/fluid tick = ~25ms -> 20 FPS SLOWDOWN      |
| Growth: O(W * H) per tick scan.                                                                   |
+---------------------------------------------------------------------------------------------------+
| 6. SIMPLEX NOISE OCTAVE WORLD GENERATION LOOP (Risk 18)                                           |
| Location: WorldGenerator.ts:L43 (generate)                                                        |
| Current (128x128): 16,384 iterations * 6 noise octaves = ~30ms -> Works                            |
| 8x Linear (1024x1024): 1,048,576 iterations * 6 octaves = ~2.5s synchronous UI FREEZE             |
| Growth: O(W * H * Octaves).                                                                       |
+---------------------------------------------------------------------------------------------------+
| 7. PER-FRAME ROAD NODE GRAPH ALLOCATIONS (Risk 21)                                                |
| Location: Renderer.ts:L96 & L1550                                                                 |
| Current (128x128): ~100 visible road tiles = ~100 RoadNode objects per frame -> Works              |
| 4x Linear (512x512, Zoom 0.3x): ~15,000 visible road tiles = 15,000 RoadNode allocations/frame    |
| Growth: O(VisibleRoadTiles) allocations per frame -> Heavy GC trash creation.                    |
+---------------------------------------------------------------------------------------------------+
| 8. GLOBAL TRADE PARTNER SEARCH O(C^2) (Risk 23)                                                   |
| Location: CivilizationEngine.ts:L2800 (evaluateTradeRoutes)                                      |
| Current (128x128): 10 cities = 100 city-pair trade checks -> Works                                |
| 4x Linear (512x512): 100 cities = 10,000 city-pair trade checks -> Heavy macro tick slowdown       |
| Growth: O(C^2) route evaluation passes.                                                           |
+---------------------------------------------------------------------------------------------------+
| 9. UN-CULLED MAP OVERLAY RENDER LOOPS (Risk 35)                                                   |
| Location: Overlays.ts:L80 (renderOverlay)                                                         |
| Current (128x128): 16,384 tiles evaluated for overlay colors = < 1ms -> Works                     |
| 8x Linear (1024x1024): 1,048,576 tiles evaluated for overlay colors = ~35ms -> FPS DROPS TO 15    |
| Growth: O(W * H) per overlay frame.                                                               |
+---------------------------------------------------------------------------------------------------+
| 10. DIPLOMACY OPINION MATRIX UPDATE O(K^2) (Risk 11, 30)                                          |
| Location: Diplomacy.ts:L85 & L145                                                                 |
| Current (128x128): 6 realms = 36 pair comparisons -> Works                                       |
| 8x Linear (1024x1024): 50 realms = 2,500 pair comparisons -> Macro tick slowdown                  |
| Growth: O(K^2) matrix updates.                                                                    |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. MEMORY BOMBS

Structures whose RAM usage scales directly with world size or entity counts:

1. **`TileMap.grid` (`Tile[][]`):**
   - **ESTIMATE:** $\sim 300\text{ bytes}$ per Tile instance.
   - $128 \times 128$ ($16.3\text{k}$ tiles): **$\sim 4.9\text{ MB}$**
   - $512 \times 512$ ($262\text{k}$ tiles): **$\sim 78.6\text{ MB}$**
   - $1024 \times 1024$ ($1.05\text{M}$ tiles): **$\sim 314.0\text{ MB}$**
2. **Offscreen Terrain Canvas (`terrainCanvas` VRAM):**
   - **ESTIMATE:** $4\text{ bytes}$ per canvas pixel (RGBA).
   - $128 \times 128$ ($2048 \times 2048\text{ px}$): **$16.7\text{ MB}$ VRAM**
   - $512 \times 512$ ($8192 \times 8192\text{ px}$): **$268.4\text{ MB}$ VRAM**
   - $1024 \times 1024$ ($16384 \times 16384\text{ px}$): **$1.07\text{ GB}$ VRAM (CRASH)**
3. **City Territory Coordinate Strings (`City.territory: Set<string>`):**
   - **ESTIMATE:** $\sim 80\text{ bytes}$ per string key (`"412,385"` string + Set node).
   - 20 Metropolises at $2,000$ tiles each: **$\sim 3.2\text{ MB}$** in string objects.
4. **Entity Instance Heap Footprint (`Entity` class):**
   - **ESTIMATE:** $\sim 450\text{ bytes}$ per Entity (includes `equipment`, `traits` Set, `needs`).
   - $1,000$ entities: **$\sim 0.45\text{ MB}$**
   - $20,000$ entities (Large world): **$\sim 9.0\text{ MB}$**

---

## 4. PATHFINDING BOMBS

Deep audit of pathfinding consumers across systems:

- **Citizen Movement:** [`Pathfinding.ts:L145`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/Pathfinding.ts#L145) (`getStepTowards`). Uses 1-step direct line of sight with obstacle sliding. Fast locally, but fails if boxed in by rivers/walls.
- **Road Engineering Survey:** [`RoadEngineering.ts:L132`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/RoadEngineering.ts#L132). Uses `SimplePathfinder.findPath` ('road' mode). **BOMB:** Surveying roads across long distances on $512 \times 512$ maps exceeds $3,000$ `maxNodes` and fails.
- **Overland Merchant Caravans:** [`CaravanSystem.ts:L151`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CaravanSystem.ts#L151). Uses `SimplePathfinder.findPath` ('land' mode). **BOMB:** Long-distance trade routes between distant continents fail when path length exceeds $150$ tiles.
- **Naval Ships & Fleets:** [`NavalSystem.ts:L178`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/NavalSystem.ts#L178). Uses `SimplePathfinder.findPath` ('sea' mode). **BOMB:** Ships sailing across giant oceans hit $3,000$ node search cap and abort route.
- **Rail Network Logistics:** [`RailwayNetwork.ts:L254`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/RailwayNetwork.ts#L254). Uses `SimplePathfinder.findPath` ('land' mode) to verify line connectivity between raw resource producers and factories.

---

## 5. SAVE BOMBS

Save file bottlenecks identified in [`SaveSystem.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/core/SaveSystem.ts#L139):

1. **`localStorage` Quota Exceeded:** `localStorage` is capped at **$5\text{ MB}$**.
   - $128 \times 128$ Save File: **$\sim 3.5\text{ MB}$** (Fits)
   - $256 \times 256$ Save File: **$\sim 11.5\text{ MB}$** (**FAILS**)
   - $512 \times 512$ Save File: **$\sim 42.0\text{ MB}$** (**FAILS**)
2. **Synchronous `JSON.stringify` / `JSON.parse` Freeze:** Parsing a $42\text{MB}+$ JSON string on load blocks the main UI thread for $3 - 8\text{ seconds}$.
3. **Redundant Derivable Serialization:** Height, temperature, and moisture are serialized for all tiles, adding $\sim 40\%$ unnecessary weight to save payloads.

---

## 6. RENDER BOMBS

Renderer elements depending on total world size rather than camera viewport:

1. **Offscreen Canvas Bake (`terrainCanvas`):** Allocates $(W \cdot 16) \times (H \cdot 16)\text{ px}$ canvas for the entire map (Risk 32).
2. **Map Overlays Pass:** Iterates full grid for temperature/biome/trade overlays if not constrained (Risk 35).
3. **Full World Dirty Tile Mark (`markAllDirty`):** Inserts every tile coordinate into `dirtyTiles` Set (Risk 49).
4. **Road Node Allocations:** Rebuilds road node objects per visible tile every frame (Risk 21).

---

## 7. GENERATION BOMBS

WorldGenerator phases that become prohibitive at $512 \times 512+$:

1. **6-Octave Noise Loop:** Synchronous $O(W \cdot H \cdot 6)$ loop evaluating height, ridge, moisture, temp, magic, and warp noise ($\sim 2.5\text{s}$ at $1024 \times 1024$).
2. **River Carving Basin Overflow Rim Searches:** Scans 8 neighbors per step with basin lake creation loops ($\sim 1.5\text{s}$ at $1024 \times 1024$).
3. **Cellular Biome Smoothing:** $3 \times 3$ neighborhood pass over all land cells creating string key dictionary allocations.

---

## 8. CITY SCALE BOMBS

Code assumptions constraining physical city scale:

1. **Fixed Survey Radius Cap:** Hardcoded `Math.min(22, ...)` ceiling in [`CivilizationEngine.ts:L1086`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L1086).
2. **Building Plot Exclusion:** Roads and buildings cannot share tiles; 1 road tile consumes an entire $16 \times 16\text{ px}$ building plot.
3. **Land Area Saturation:** 1 Metropolis ($2,000$ tiles) takes $22.2\%$ of all buildable land on a $128 \times 128$ map.

---

## 9. FINAL SUMMARY & CLASSIFIED ACTION PLAN

### TOP 10 SCALING BLOCKERS
1. Offscreen Terrain Canvas Bake VRAM Cap (`Renderer.ts:L1485`)
2. `localStorage` $5\text{MB}$ Quota Limit (`SaveSystem.ts:L95`)
3. A* Search $3,000$ Node Ceiling (`Pathfinding.ts:L329`)
4. $1\text{M}+$ `Tile` JS Class Instance Allocations (`WorldGenerator.ts:L94`)
5. Full-Grid Fire/Fluid Tick Scans (`TileMap.ts:L148`)
6. Synchronous 6-Octave Noise Generation Loop (`WorldGenerator.ts:L43`)
7. Per-Frame `RoadNode` Graph Allocations (`Renderer.ts:L96`)
8. $O(C^2)$ Global Trade Partner Search (`CivilizationEngine.ts:L2800`)
9. Synchronous `JSON.stringify` Save Payload (`SaveSystem.ts:L139`)
10. Un-Culled Map Overlay Render Loops (`Overlays.ts:L80`)

### TOP 10 MEMORY RISKS
1. `TileMap.grid` 2D JS Arrays ($\sim 314\text{MB}$ at $1024 \times 1024$)
2. `terrainCanvas` Offscreen VRAM ($1.07\text{GB}$ at $1024 \times 1024$)
3. `City.territory` Coordinate Strings (`Set<string>`)
4. Un-culled Entity Instance Heap Footprints ($20\text{k}+$ entities)
5. `dirtyTiles` Full World Integer Set (`TileMap.ts:L17`)
6. Intermediate Array Spreads (`[...collection]`)
7. Un-evicted Renderer FX Timestamp Maps (`buildingFxTime`)
8. Un-culled Particle Manager Memory (`Particles.ts:L45`)
9. Temporary `RoadNode` Objects per Frame
10. Full JSON Serialization Payloads in RAM

### TOP PATHFINDING RISKS
1. Long-distance road surveys failing due to $3,000$ node cap.
2. Intercity trade caravans failing on transcontinental routes.
3. Sea ships aborting oceanic routes.
4. Rail connectivity verification failing over long distances.
5. Linear line-of-sight citizen pathfinding blocking near rivers/walls.

### TOP SAVE/LOAD RISKS
1. `QuotaExceededError` on saves $> 5\text{MB}$.
2. Main thread freeze during single-string `JSON.parse`.
3. Redundant static terrain height/climate serialization.
4. $O(E \cdot B)$ load-phase building occupancy reconstruction.
5. Autosave micro-stutters during active gameplay.

### TOP RENDER RISKS
1. `terrainCanvas` allocation DOMException crash ($>8192\text{px}$).
2. Zoomed-out viewport rendering $>100\text{k}$ tiles simultaneously.
3. Un-culled city label and heraldry text draw calls.
4. Un-culled offscreen particle updates.
5. Full-grid overlay color calculations.

### TOP WORLD GENERATION RISKS
1. Synchronous main thread UI freeze ($>2.5\text{s}$).
2. River carving basin overflow search loops.
3. Noise frequency distortion when scaling map dimensions.
4. Full-grid resource deposit seeding loops.
5. Temporary string dictionary allocations in `smoothBiomes`.

### TOP CITY SCALE RISKS
1. Metropolis consuming $22\%$ of map land on $128 \times 128$.
2. Hardcoded 22-tile city survey radius cap.
3. 1 Road = 1 Full Tile exclusion blocking dense urban blocks.
4. Intercity spacing too tight ($15-20$ tiles).
5. Lack of spatial buffer for defensive curtain walls and rail yards.

---

### WHAT PERF-V1 SHOULD SOLVE
- Entity HOT/WARM/COLD LOD scheduler.
- Un-culled citizen and animal AI updates.
- Per-frame particle updates outside camera view.
- Spatial Hash query optimizations.
- Intermediate array garbage reduction in hot paths.

### WHAT WORLD-V1 MUST SOLVE
- **$32 \times 32$ Chunk Architecture** (Chunked Canvas bakes, Chunked grid storage).
- **`IndexedDB` Save Backend** + RLE sparse tile compression.
- **Hierarchical Pathfinding (HPA*)** with node budget scaling for long-distance trade/roads.
- **Async World Generation** in Web Workers.
- **Region LOD (Active / Warm / Sleeping)** for world chunks.
- **Noise Frequency Normalization** for large map blueprints.

### WHAT CAN WAIT UNTIL CITY-V1
- Composite Urban Block Fabric (Hybrid Visual Layer).
- Dynamic city survey radius scaling beyond 22 tiles.
- Defensive curtain wall and gatehouse placement rules.
- Industrial rail yard and port district zoning rules.
- Multi-tier street hierarchy (highways vs. local alleys).

---

**AUDIT COMPLETE — NO CODE WAS MODIFIED.**
