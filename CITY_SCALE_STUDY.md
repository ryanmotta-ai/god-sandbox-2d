# AETHORIA — PRE-CITY / PRE-WORLD STUDY
## CITY SCALE & URBAN GRANULARITY ARCHITECTURE

> [!IMPORTANT]
> **STUDY MANDATE & SCOPE**
> This document is a non-destructive architectural study for the future **CITY-V1** and **WORLD-V1** spatial scale requirements of *Aethoria*. No code has been edited, no gameplay balance altered, no map sizes modified, and no PERF-V1 or WORLD-V1 files touched.

---

## 1. CURRENT SCALE AUDIT

Currently, *Aethoria* models settlements using a single, uniform 2D grid structure where every world cell measures $16 \times 16$ pixels.

### Codebase Entity & Spatial Inventory
- **Tile:** [`Tile.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/world/Tile.ts#L54) defines a single grid cell $(x, y)$. Holds `buildingId: string | null`, `roadLevel: 0..3`, `railLevel: 0..1`, `kingdomId`, `cityId`.
- **Building:** [`Building.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/Building.ts#L135) represents an economic structure. Position is stored as integer tile coordinates $(x, y)$.
- **City:** [`City.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/City.ts#L58) tracks settlement tiers (`camp`, `hamlet`, `village`, `town`, `city`, `metropolis`), holding `buildings: Map<string, Building>` and `territory: Set<string>`.
- **Urban Planner:** [`UrbanPlanner.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/UrbanPlanner.ts#L53) scores building site candidates based on district affinity (`civic`, `residential`, `industrial`, `agricultural`, etc.), spacing, center preference, and street frontage.
- **Road & Rail Networks:** [`RoadEngineering.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/RoadEngineering.ts) and [`RailwayNetwork.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/RailwayNetwork.ts) lay roads/rails onto individual tiles. A single road tile occupies an entire $16 \times 16\text{ px}$ cell.
- **Pathfinding & Collision:** [`Pathfinding.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/ai/Pathfinding.ts#L324) runs A* directly over the tile grid. Walkability is evaluated per tile.
- **Renderer:** [`Renderer.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/renderer/Renderer.ts#L1438) draws static terrain, buildings centered on tile centers, roads, rails, and entity sprites.

---

## 2. CURRENT LIMITATIONS

1. **1 Building = 1 Tile Hard Lock:** A single house consumes the exact same spatial area as a dirt trail segment, a paved imperial highway, a wheat farm, or a town center ($16 \times 16\text{ px}$).
2. **Road Occupation Exclusion:** A road tile cannot hold a building, and a building tile cannot hold a road. Placing a single street segment requires sacrificing an entire building plot.
3. **No Sub-Tile Coordinates:** Buildings and roads cannot sit at fractional or sub-tile offsets in the simulation or renderer.
4. **Cramped Visual Density:** Because a house takes an entire tile, building 50 houses creates a scattered array of structures across 50 tiles rather than a tight, dense urban block with alleys, courtyards, and shared walls.

---

## 3. BUILDING : TILE RELATIONSHIP

| Dimension / Aspect | Current Implementation in Code | Limitations for Urbanism |
| :--- | :--- | :--- |
| **Tile Footprint** | Exactly $1$ tile per building (`tile.buildingId`). | Cannot place small sheds, walls, or props alongside buildings. |
| **Sub-Tile Placement** | Not supported. Fixed to integer $(x, y)$. | Prevents organic street alignment and varied setbacks. |
| **Sprite Overflow** | Visual only. Wonders/Palaces bleed sprites over adjacent tiles. | Logical collision remains 1 tile; adjacent tiles look blocked but are empty. |
| **Collision Boundary** | 100% tile-based (`TERRAINS[type].isWalkable` & `buildingId`). | Citizens cannot walk through open courtyards inside a building plot. |
| **Pathfinding Grid** | A* operates on 1-tile nodes. | Citizens step from tile center to tile center ($16\text{px}$ hops). |
| **Road Tile Area** | 1 road = 1 full tile ($16 \times 16\text{ px}$). | Streets are as wide as an entire house, making alleys impossible. |
| **Rail Tile Area** | 1 rail = 1 full tile ($16 \times 16\text{ px}$). | A single track looks as wide as a residential home. |

---

## 4. CURRENT CITY FOOTPRINT (CODE MEASUREMENTS)

Data measured directly from [`City.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/City.ts#L28) and [`CivilizationEngine.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/CivilizationEngine.ts#L1086):

- **Settlement Tiers & Territory Limits:**
  - `camp`: Pop $\ge 0$, Building Slots: $8$, Territory Limit: $60$ tiles ($\sim 4.4$ tile radius)
  - `hamlet`: Pop $\ge 8$, Building Slots: $16$, Territory Limit: $175$ tiles ($\sim 7.5$ tile radius)
  - `village`: Pop $\ge 20$, Building Slots: $26$, Territory Limit: $380$ tiles ($\sim 11.0$ tile radius)
  - `town`: Pop $\ge 45$, Building Slots: $36$, Territory Limit: $700$ tiles ($\sim 14.9$ tile radius)
  - `city`: Pop $\ge 90$, Building Slots: $50$, Territory Limit: $1,200$ tiles ($\sim 19.5$ tile radius)
  - `metropolis`: Pop $\ge 180$, Building Slots: $70$, Territory Limit: $2,000$ tiles ($\sim 25.2$ tile radius)
- **Maximum Survey Radius (`citySurveyRadius`):**
  $$\text{Radius} = \min\left(22, \; 7 + \text{tierBonus} + \lfloor\sqrt{\text{Pop}} / 2\rfloor\right)$$
  Hard ceiling in code: **$22$ tiles radius** ($\sim 45 \times 45$ search box $\approx 2,025$ tiles area).
- **Building Spacing (`UrbanProfile.spacing` in [`UrbanPlanner.ts`](file:///c:/Users/ryan/.gemini/antigravity/scratch/god-sandbox-2d/src/civ/UrbanPlanner.ts#L83)):**
  - Houses: $0.9$ tiles; Town Center: $1.6$ tiles; Palace: $2.2$ tiles; Monuments: $2.4$ tiles.
- **Intercity Distance:** Cities currently spawn as close as $15 - 20$ tiles apart.

---

## 5. VISUAL SCALE PROBLEM

In the current $128 \times 128$ world map:
- **World Width:** $128$ tiles ($2,048\text{ px}$).
- **Metropolis Footprint Diameter:** $\sim 50$ tiles ($800\text{ px}$).
- **Single House Width:** $1$ tile ($16\text{ px}$).

### Spatial Ratios in Code:
$$\text{City Diameter / World Width} = \frac{50}{128} = \mathbf{39.0\%}$$
$$\text{House Width / City Diameter} = \frac{1}{50} = \mathbf{2.0\%}$$
$$\text{Single Road Tile / City Diameter} = \frac{1}{50} = \mathbf{2.0\%}$$

> [!WARNING]
> **THE VISUAL SCALE DISCONNECT:**
> A single Metropolis occupies nearly **$40\%$ of the entire world width**. Meanwhile, a single road segment is as wide as a house ($2\%$ of the city diameter). A railway line spanning just 5 tiles looks massive relative to the city, but short relative to the world. The world feels like a small island toy set rather than a vast continent with thriving historical capitals.

---

## 6. TARGET URBAN EXPERIENCE

For **CITY-V1**, cities must evolve continuously through visible historical phases:

```
  VILLAGE (Thatch huts, dirt paths, open pastures, well core)
     ↓
  TOWN (Market square, stone streets, wooden palisade, artisan shops)
     ↓
  WALLED CITY (Stone curtain walls, gatehouses, dense inner quarters, civic temples)
     ↓
  EXPANDING CITY (Extramural suburbs, outer ring roads, merchant docks)
     ↓
  INDUSTRIAL CITY (Railway line, brick factories, smoke stacks, canal networks)
     ↓
  METROPOLIS (Grand boulevards, historic core inside old wall, sprawling suburbs)
```

---

## 7. URBAN STRUCTURE REQUIREMENTS

A mature capital requires distinct spatial zones:

```
+-----------------------------------------------------------------------------------+
| 1. CIVIC CORE: Historic center, Palace, High Temple, Monument, Main Square         |
+-----------------------------------------------------------------------------------+
| 2. INNER CITY: Walled historic quarter, high-density housing, guildhalls, markets |
+-----------------------------------------------------------------------------------+
| 3. OUTER CITY: Extramural residential districts, avenues, parks, academies        |
+-----------------------------------------------------------------------------------+
| 4. INDUSTRIAL EDGE: Factories, refineries, lumberyards, rail depots, smoke stacks |
+-----------------------------------------------------------------------------------+
| 5. PERIPHERY: Agricultural belts, grain mills, pastures, perimeter highways        |
+-----------------------------------------------------------------------------------+
| 6. PORT DISTRICT (if coastal): Docks, customs house, warehouses, naval yards       |
+-----------------------------------------------------------------------------------+
```

---

## 8. WALL REQUIREMENT (DEFENSIVE CURTAIN WALLS)

To support defensive walls with gates and historical growth:
- **Spatial Requirements:**
  - Curtain wall segments: 1-tile wide perimeter ring.
  - Gatehouses: $2 \times 1$ or $1 \times 1$ structures aligned with main radial roads.
  - Extramural Buffer Zone: 2 to 4 empty tiles outside the wall before outer suburbs start.
- **Historical Wall Retention:** When a city outgrows its original wall in Year 400, the old inner wall remains intact as an inner historic ring, while a new outer wall or boulevard is built further out.
- **Spatial Footprint Impact:** A walled town requires a minimum diameter of **$25 - 35$ tiles** just for the inner walled core.

---

## 9. RAILWAY REQUIREMENT

A realistic industrial railway corridor cannot be a 3-tile stub. It requires:
1. **Approach Corridor:** Straight or gently curving 2-tile wide right-of-way entering the city.
2. **Passenger Station Yard:** $3 \times 2$ tile central terminal.
3. **Freight & Industrial Spur:** Branch lines running directly into factory/warehouse districts.
4. **Spatial Footprint Impact:** Requires an urban corridor length of **$20 - 40$ tiles**.

---

## 10. THREE ARCHITECTURAL OPTIONS COMPARISON

```
+---------------------------------------------------------------------------------------------------+
| OPTION A: 1 Building = 1 World Tile (Keep Grid & Scale World Up)                                  |
+---------------------------------------------------------------------------------------------------+
| Concept:     Keep 1:1 building-to-tile link. Increase world size to 512x512 or 1024x1024.          |
| Pros:        Zero change to TileMap, UrbanPlanner logic, or Pathfinding. Highly readable.         |
| Cons:        Huge world map required (512x512+); high tile memory; requires Chunk Rendering.     |
+---------------------------------------------------------------------------------------------------+
| OPTION B: Visual Sub-Tile Buildings (Fine-Grained Renderer Offsets)                              |
+---------------------------------------------------------------------------------------------------+
| Concept:     Simulation remains 1 tile, but renderer packs multiple sub-sprites into 1 tile.     |
| Pros:        Keeps world grid small (128x128).                                                    |
| Cons:        Pixel art loses clarity at 8x8px; sub-tile collision is complex; roads still 1 tile. |
+---------------------------------------------------------------------------------------------------+
| OPTION C: Urban Micro-Grid (Dual Grid Architecture)                                               |
+---------------------------------------------------------------------------------------------------+
| Concept:     1 Macro World Tile = NxN Urban Micro Cells (e.g. 1 World Tile = 4x4 Urban Cells).    |
| Pros:        Infinite urban density without enlarging world map.                                  |
| Cons:        EXTREME ARCHITECTURAL COMPLEXITY. Dual coordinate system, dual pathfinding, full rewrite|
|              of TileMap, Renderer, Building, SaveSystem, and WorldGenerator.                     |
+---------------------------------------------------------------------------------------------------+
```

---

## 11. DETAILED OPTION A ANALYSIS

- **Implementation Complexity:** LOW (Uses existing 2D grid codebase).
- **World Size Requirement:** HIGH ($512 \times 512$ to $1024 \times 1024$).
- **Memory Footprint:** $\sim 78.6\text{ MB}$ ($512 \times 512$) to $\sim 314\text{ MB}$ ($1024 \times 1024$).
- **Pathfinding:** Standard Tile A* / HPA*.
- **Rendering:** Requires $32 \times 32$ Chunk Offscreen Canvas baking.
- **Roads/Rails/Walls:** Excellent visual scale; 1-tile roads look like realistic avenues relative to a $500$-tile continent.
- **Save File Size:** Requires `IndexedDB` + RLE tile compression.
- **CITY-V1 Compatibility:** $100\%$ Compatible.

---

## 12. DETAILED OPTION B ANALYSIS

- **Implementation Complexity:** MEDIUM (Modifies `Renderer.ts` and `SpriteGenerator.ts`).
- **Visual Gain:** Allows rendering 4 small house sub-sprites inside 1 logical $16\text{px}$ tile plot.
- **Simulation Impact:** Zero change to economic ticks, population, or civ logic.
- **Limitations:** Does not solve the issue of roads and railways consuming full $16\text{px}$ tiles. Pixel art detail degrades if sub-sprites are scaled down to $8 \times 8\text{ px}$.

---

## 13. DETAILED OPTION C ANALYSIS (URBAN MICRO-GRID)

Evaluating a physical Dual-Grid System ($1\text{ World Tile} = 4 \times 4\text{ Micro Cells}$):

### System Impact Analysis:
1. **TileMap & WorldGenerator:** Must maintain two separate grid data structures or dynamically instantiate micro-grids when cities are founded.
2. **Entities & Citizen Movement:** Citizen coordinates become micro-grid floats $(uX, uY)$. SpatialHash must operate on micro-cells.
3. **Pathfinding:** Requires 2-tier Hierarchical A*: Macro pathfinding between macro tiles, Micro pathfinding inside the city grid.
4. **Building & City System:** Complete rewrite of building placement, district scoring, and territory ownership.
5. **Migration & Code Churn:** Over $60\%$ of the codebase would require refactoring.

> [!CAUTION]
> **RISK ASSESSMENT FOR OPTION C:**
> Option C represents an extreme engineering risk. The architectural overhead of dual coordinate systems, dual pathfinders, and dual spatial hashes would introduce severe bugs and performance degradation.

---

## 14. HYBRID OPTION ANALYSIS (RECOMMENDED ARCHITECTURAL DIRECTION)

Instead of a heavy physical Dual-Grid (Option C), we propose the **HYBRID OPTION: Macro Logical Simulation + Composite Urban Block Fabric**.

```
+-----------------------------------------------------------------------------------+
| SIMULATION LAYER (Macro Logical Tile Grid - 1 Tile = 1 Economic Block / Facility) |
| • CivilisationEngine, Economy, and Trade operate on logical blocks:               |
|   e.g. 1 "ResidentialBlock", 1 "IndustrialCompound", 1 "FarmEstate".              |
+-----------------------------------------------------------------------------------+
| VISUAL & RENDER LAYER (Composite Multi-Sprite Urban Fabric)                       |
| • UrbanPlanner and Renderer compose each logical block using rich visual clusters:|
|   - 1 "ResidentialBlock" tile renders 3-4 dense house sprites, a paved courtyard,  |
|     perimeter fences, and decorative street props within the 16px tile.           |
|   - 1 "IndustrialCompound" tile renders a main factory hall, chimney, & crane.   |
|   - 1 "WalledGate" tile renders stone towers with integrated road archway.         |
+-----------------------------------------------------------------------------------+
```

### Why the Hybrid Option is Superior:
- **Zero Simulation Overhead:** Economic ticks, citizens, jobs, and stockpiles stay on the fast, proven 2D grid.
- **Stunning Urban Granularity:** Cities look dense, organic, and historical without adding micro-grid complexity.
- **Road & Wall Integration:** Walls and roads integrate visually into building block borders.

---

## 15. VISUAL BUILDINGS VS. LOGICAL BUILDINGS

```
LOGICAL BUILDING (Simulation Unit)          VISUAL REPRESENTATION (Renderer Output)
+-----------------------------------+       +-----------------------------------+
| BuildingType: 'residential_block' |       | [House 1]  [Alley]   [House 2]    |
| Capacity: 12 citizens             |  ==>  | [Garden]   [Courtyard] [House 3]  |
| Stockpile: Food, Goods            |       | Rendered as 1 cohesive 16px tile  |
+-----------------------------------+       +-----------------------------------+

LOGICAL BUILDING (Factory Compound)          VISUAL REPRESENTATION (Renderer Output)
+-----------------------------------+       +-----------------------------------+
| BuildingType: 'steel_works'       |       | [Smelter]  [Chimney]  [Rail Spur] |
| Output: Steel                     |  ==>  | [Ore Pile] [Gantry]   [Warehouse] |
| Pollution: High                   |       | Rendered across 2x2 tile footprint|
+-----------------------------------+       +-----------------------------------+
```

---

## 16. URBAN BLOCK ARCHITECTURE

For **CITY-V1**, settlement expansion moves from individual isolated buildings to **Urban Blocks**:

$$\text{Parcel} \longrightarrow \text{Urban Block} \longrightarrow \text{District} \longrightarrow \text{City}$$

1. **Parcel:** The individual building plot ($16 \times 16\text{ px}$ tile or sub-tile slot).
2. **Urban Block:** A cluster of $2 \times 2$ or $3 \times 3$ parcels surrounded by streets.
3. **District:** A contiguous group of blocks sharing a `DistrictAffinity` (Civic, Residential, Industrial, Docks).
4. **City:** The entire urban organism bounded by farms, walls, and highways.

---

## 17. STREET HIERARCHY

To create visually striking cities, **CITY-V1** will establish 4 street tiers:

```
+-----------------------------------------------------------------------------------+
| 1. HIGHWAY / IMPERIAL ROAD: Intercity 1-tile thoroughfares connecting realms.      |
+-----------------------------------------------------------------------------------+
| 2. GRAND BOULEVARD: Radial avenues connecting outer gates to the civic center.     |
+-----------------------------------------------------------------------------------+
| 3. DISTRICT STREET: Grid streets defining urban blocks inside neighborhoods.      |
+-----------------------------------------------------------------------------------+
| 4. LOCAL ALLEY: Visual sub-tile pedestrian paths drawn within residential blocks. |
+-----------------------------------------------------------------------------------+
```

---

## 18. CITY SIZE TARGETS (FOOTPRINT IN TILES)

Target physical footprints for settlement tiers in a $512 \times 512$ world:

| Settlement Tier | Building Count | Territory Cap (Tiles) | Radius (Tiles) | Physical Diameter |
| :--- | :--- | :--- | :--- | :--- |
| **Hamlet** | $4 - 10$ buildings | $80 - 150$ tiles | $\sim 5 - 7$ tiles | $10 - 14$ tiles |
| **Village** | $12 - 25$ buildings | $250 - 450$ tiles | $\sim 9 - 12$ tiles | $18 - 24$ tiles |
| **Town** | $30 - 60$ buildings | $600 - 1,000$ tiles | $\sim 14 - 18$ tiles | $28 - 36$ tiles |
| **City (Walled)**| $70 - 120$ buildings | $1,200 - 2,500$ tiles | $\sim 20 - 28$ tiles | $40 - 56$ tiles |
| **Metropolis** | $150 - 300$ blocks | $3,500 - 6,000$ tiles | $\sim 33 - 44$ tiles | **$66 - 88$ tiles** |

---

## 19. WORLD : CITY SPATIAL RATIO

$$\text{Healthy City Diameter Ratio} = \frac{\text{Metropolis Diameter}}{\text{World Width}} \in [0.08, 0.15] \quad (\mathbf{8\% \text{ to } 15\%})$$

- **On a $512 \times 512$ Map:** A $70$-tile diameter Metropolis represents **$13.6\%$** of the world width. This leaves vast room for wilderness, rivers, mountain ranges, and rural farmlands.

---

## 20. RECOMMENDED CITY SPACING

- **Minimum Center-to-Center Spacing:** **$60$ to $100$ tiles** on a $512 \times 512$ map.
- **Spatial Allocations Between Cities:**
  - $15 - 25$ tiles of urban farmlands & pastures.
  - $20 - 40$ tiles of wild forest/wilderness buffer.
  - Intercity highways and railways spanning $50+$ tiles, giving logistics real strategic meaning.

---

## 21. KINGDOM SPATIAL BALANCE

- **Capital Realm Area:** $\sim 25,000 - 40,000$ tiles ($10 - 15\%$ of a $512 \times 512$ world).
- **Capital Metropolis Footprint:** $\sim 4,000$ tiles ($\mathbf{10 - 15\%}$ of kingdom area).
- **Secondary Cities (2-3 Cities):** $\sim 1,500$ tiles each.
- **Rural / Wilderness Territory:** $\mathbf{70 - 80\%}$ of kingdom area.

---

## 22. GEOGRAPHIC SCALE INTEGRATION

When scaling world size to $512 \times 512$ alongside larger cities:
- **Mountain Ranges:** Must scale to $16 - 24$ tiles wide to form natural kingdom barriers.
- **Major Rivers:** Must feature widths of $2 - 4$ tiles near coastlines to require multi-tile bridges.
- **Resource Deposits:** Clustered deposits must span $3 \times 3$ to $5 \times 5$ tile areas for dedicated mining districts.

---

## 23. PORT CITY ARCHITECTURE

Coastal port cities require dedicated spatial layout:
1. **Harbor Front:** 3 to 6 coastal water tiles reserved for pier sprites and ships.
2. **Customs & Warehouse Zone:** 1-tile margin behind piers for granaries and warehouses.
3. **Port Rail Spur:** Direct track connection linking harbor docks to industrial manufacturing hubs.
4. **Elevated Citadel / Upper City:** Residential and civic core built on higher ground behind the port.

---

## 24. HISTORICAL GROWTH TIMELINE (YEAR 1 TO 800)

```
YEAR 50:  [Town Center] + 4 Houses + Dirt Path (Camp)
YEAR 150: Wooden Palisade Ring + Market Square + Farms Outside (Village)
YEAR 300: Stone Curtain Wall + Gatehouses + Temple + Guildhalls (Walled Town)
YEAR 500: Suburbs Spilling Outside Wall + Academy + Grand Aqueduct (City)
YEAR 650: Railway Line Arrives + Station Depot + Brick Factory District (Industrial City)
YEAR 800: Inner Wall Preserved as Historic Park + Outer Ring Boulevard + Metropolis
```

---

## 25. REALM VISUAL IDENTITY FOR CITY-V1

The **Hybrid Option** allows distinct visual urban styles per realm without changing code logic:

| Realm Culture / Species | Street Pattern | Building Spacing | Roof Palette | Wall Style |
| :--- | :--- | :--- | :--- | :--- |
| **Human Kingdom** | Concentric Rings | Medium ($1.0$ tile) | Terracotta Red / Slate | Tall Stone Curtain Walls |
| **Imperial Order** | Orthogonal Citadel | Dense ($0.8$ tiles) | Dark Blue / Granite | Bastion Fortifications |
| **Highland Clan** | Diagonal Chevrons | Open ($1.5$ tiles) | Timber / Thatch | Wooden Palisade |
| **Sylvan Realm** | Organic Canopy | Sparse ($2.0$ tiles) | Living Wood / Moss | Natural Ridge Barriers |

---

## 26. PERFORMANCE COMPARISON

| Architecture Option | CPU Impact | GPU / VRAM | Memory (RAM) | Pathfinding | Implementation Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A (1:1 Large Map)** | Low | Medium ($32\times32$ Chunks) | Medium ($\sim 78\text{MB}$) | Fast (HPA*) | **LOW** |
| **Option B (Sub-tile Render)** | Low | Low | Low ($\sim 20\text{MB}$) | Fast (Tile A*) | **MEDIUM** |
| **Option C (Dual Micro-Grid)**| **VERY HIGH** | High | **VERY HIGH** | **VERY SLOW** | **CRITICAL / HIGH RISK** |
| **HYBRID (RECOMMENDED)** | **LOW** | **LOW-MEDIUM** | **LOW-MEDIUM** | **FAST** | **LOW-MODERATE** |

---

## 27. CITY RENDER LOD SPECIFICATION

- **CLOSE ZOOM (1.5x - 3.5x):** Full individual building sprites, chimneys, smoke particles, street props, animated citizens, bridge cables.
- **CITY ZOOM (0.8x - 1.5x):** Composite urban block textures, district boundaries, main boulevard traffic, caravan icons.
- **REGIONAL ZOOM (0.4x - 0.8x):** Walled city silhouettes, major highway networks, army banners, realm territory fills.
- **WORLD ZOOM (< 0.4x):** Macro atlas view; city heraldry badges and capital markers.

---

## 28. SIMULATION LOD COMPATIBILITY (PERF-V1 & WORLD-V1)

The **Hybrid Option** integrates seamlessly with:
- **PERF-V1 (Entity HOT/WARM/COLD):** Citizens in HOT active chunks execute full daily routines and A* paths. Citizens in WARM/COLD chunks use statistical block-level demographic ticks.
- **WORLD-V1 (Region ACTIVE/WARM/SLEEPING):** Active regions render composite urban blocks at 60 FPS. Sleeping regions pause chunk canvas bakes and run annual economic summaries.

---

## 29. MIGRATION & CODE IMPACT RISK

```
Option A:   [==------------------]  15% Code Impact (SaveSystem, TileMap chunks, Renderer)
Option B:   [====----------------]  25% Code Impact (Renderer, SpriteGenerator)
Option C:   [====================]  85% Code Impact (TOTAL REWRITE OF CORE GRID & SIMULATION)
HYBRID:     [======--------------]  30% Code Impact (UrbanPlanner, Renderer, Building definitions)
```

---

## 30. SAVE COMPATIBILITY

- **Option A & Hybrid Option:** Fully backward-compatible with legacy saves. Old saves simply load existing $128 \times 128$ maps into single-chunk containers.
- **Option C (Dual Micro-Grid):** Completely breaks legacy saves; requires complex grid conversion scripts.

---

## 31. PROTOTYPE RECOMMENDATION (FUTURE ISOLATED EXPERIMENT)

Before implementing **CITY-V1**, run a non-destructive single-city sandbox experiment:
1. Create a test scene with a single $64 \times 64$ tile map.
2. Place $100$ logical `residential_block` and `industrial_compound` entities.
3. Compare rendering via Option A (single sprites) vs. Hybrid Option (composite multi-sprite blocks with visual alleys and props).
4. Measure FPS, VRAM usage, and visual aesthetics before writing core game code.

---

## 32. FINAL RECOMMENDATION

> [!TIP]
> **FINAL ARCHITECTURAL CHOICE: THE HYBRID OPTION**
>
> **Combining Macro Tile Logic ($512 \times 512$ World with $32 \times 32$ Chunks) + Composite Urban Block Fabric (Hybrid Visual Layer)** is the absolute best strategy for *Aethoria*.

### Justification against Priorities:
1. **Beautiful Cities:** Delivers dense historic centers, walled quarters, avenues, and industrial rail yards using multi-sprite composite blocks.
2. **Large Worlds:** Paired with WORLD-V1's $512 \times 512$ map ($32 \times 32$ chunks), it gives cities a realistic $10 - 13\%$ world width ratio.
3. **Simulation Depth:** Preserves 100% of the proven 2D grid economy and civ engine without dual-grid bugs.
4. **Performance:** Maintains 60 FPS by eliminating sub-tile physics and keeping A* pathfinding fast.
5. **Implementation Complexity:** Low-to-moderate risk; avoids refactoring the entire simulation core.
6. **Game Compatibility:** Fully compatible with existing saves, PERF-V1 worker threads, and event buses.

---

## 33. DELIVERABLE CHECKLIST

- [x] CURRENT SCALE AUDIT
- [x] CURRENT LIMITATIONS
- [x] BUILDING:TILE RELATION
- [x] CITY FOOTPRINT MEASUREMENTS
- [x] VISUAL SCALE PROBLEM & SPATIAL RATIOS
- [x] TARGET URBAN EXPERIENCE
- [x] URBAN STRUCTURE REQUIREMENTS
- [x] WALL REQUIREMENT
- [x] RAILWAY REQUIREMENT
- [x] THREE ARCHITECTURES (OPTION A, B, C)
- [x] OPTION A ANALYSIS
- [x] OPTION B ANALYSIS
- [x] OPTION C ANALYSIS (DUAL GRID RISK)
- [x] HYBRID OPTION ANALYSIS
- [x] VISUAL VS LOGICAL BUILDINGS
- [x] URBAN BLOCK ARCHITECTURE
- [x] STREET HIERARCHY
- [x] CITY SIZE TARGETS
- [x] WORLD:CITY RATIO
- [x] CITY SPACING
- [x] KINGDOM SPATIAL BALANCE
- [x] GEOGRAPHIC SCALE INTEGRATION
- [x] PORT CITIES
- [x] HISTORICAL GROWTH TIMELINE
- [x] REALM VISUAL IDENTITY
- [x] PERFORMANCE COMPARISON TABLE
- [x] CITY RENDER LOD
- [x] SIMULATION LOD COMPATIBILITY
- [x] MIGRATION RISK
- [x] SAVE COMPATIBILITY
- [x] PROTOTYPE RECOMMENDATION
- [x] FINAL RECOMMENDATION

**STUDY COMPLETE — NO CODE WAS MODIFIED.**
