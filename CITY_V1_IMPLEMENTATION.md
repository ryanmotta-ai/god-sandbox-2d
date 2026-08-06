# CITY-V1 — Organic Urban Planner

Implementation notes for the first phase of Aethoria's urban system.

Status: **implemented and measured**. Phase scope only — CITY-V2 concerns
(architectural DNA, multi-tile footprints, new sprites) are explicitly out.

---

## 1. Architecture

CITY-V1 adds **one** module, not the five the audit sketched:

```
src/civ/UrbanPlanner.ts
```

Everything else is a small, reversible hook into existing code. The audit's
`UrbanCenter` / `RoadGraph` / `District` / `Lot` / `BuildingPlacement` split was
deliberately collapsed:

| Audit concept | How CITY-V1 realises it |
| :--- | :--- |
| `UrbanCenter` | Derived on the fly from `city.x / city.y` plus the mean radius of standing buildings. No manager, no state. |
| `RoadGraph` | Not built. `Tile.roadLevel` / `roadTraffic` stay the single source of truth; the planner reads them through a bounded ring search. |
| `District` | `DistrictAffinity` — a *label on a building type*, never painted onto tiles. Quarters emerge from attraction/repulsion between neighbours. |
| `Lot` | Not built. Buildings remain 1×1 (spec §5). Spacing is a score, not a reserved parcel. |
| `BuildingPlacement` | `UrbanPlanner.findBuildingSites()`. |

The separation the spec asks for holds:

```
CivilizationEngine.scoreBuilding()   ->  WHY build (economy, untouched)
UrbanPlanner.findBuildingSites()     ->  WHERE it goes
TileMap / TERRAINS                   ->  what is possible
Tile.roadLevel                       ->  how growth is structured
```

---

## 2. UrbanPlanner API

```ts
UrbanPlanner.findBuildingSites(
  city: City,
  def: BuildingDefinition,
  tileMap: TileMap,
  radius: number,
  limit = 6
): BuildingSiteCandidate[]      // ranked, best first, [] if nowhere legal
```

`BuildingSiteCandidate` carries the total plus every component that produced it
(`roadAccessScore`, `centralityScore`, `districtAffinityScore`, `spacingScore`,
`densityScore`, `desirabilityScore`, `terrainScore`, `resourceFitScore`,
`roadExtensionTiles`, `resourceGood`) so a site can be explained, not just
chosen.

Supporting exports:

```ts
urbanProfile(type): UrbanProfile              // placement metadata per building
maxRoadExtensionFor(city): number             // tier-scaled street budget
wouldWasteResource(map, x, y, def): boolean   // strategic-geology guard
measureCity(city, map): UrbanMetrics          // QA only
URBAN_PROFILES, PLANNER_WEIGHTS               // tuning surface
```

---

## 3. Scoring factors

All weights live in one object, `PLANNER_WEIGHTS`, rather than scattered
constants:

| Factor | Weight | Meaning |
| :--- | ---: | :--- |
| `roadAccess` | 46 | Scaled by the building's own `prefersRoad`. |
| `centrality` | 26 | Distance from centre vs the type's `centerPreference`, normalised against the city's *own* built radius. |
| `affinity` | 34 | Pull toward same-affinity and explicitly attracted neighbours. |
| `repulsion` | 52 | Push from clashing quarters. Deliberately the largest weight. |
| `spacing` | 22 | Penalty for crowding below the type's `spacing`. |
| `density` | 30 | Pressure once local coverage passes the tier target. |
| `desirability` | 18 | Fertility, coast, terrain pleasantness. |
| `terrain` | 14 | Working difficulty, derived from `moveCost`. |
| `resourceFit` | 40 | Deposit richness and strategic value. |
| `roadExtensionPerTile` | 7 | Charged per tile of new street the site needs. |
| `isolation` | 34 | Flat penalty for sites off the network entirely. |

Centrality is measured against the settlement's own built-up radius, so
"central" means central *for this city* — a hamlet's centre is three tiles
across, a metropolis's is not.

---

## 4. Affinity rules

Nine affinities: `civic`, `residential`, `commercial`, `industrial`,
`agricultural`, `extraction`, `military`, `logistics`, `knowledge`.

**Repulsion** (`REPELS`) is intentionally sparse — attraction does most of the
sorting:

- `residential` ✗ `industrial`, `extraction`
- `industrial` ✗ `residential`, `civic`
- `extraction` ✗ `residential`, `civic`
- `civic` ✗ `industrial`, `extraction`
- `agricultural` ✗ `industrial`, `extraction`
- `knowledge` ✗ `industrial`, `extraction`

Adjacency (≤1.6 tiles) is weighted 2.6× against merely being in view, so a
factory *touching* a house is far worse than one in the same district.

**Attraction** (`ATTRACTS`) adds specific pairs on top of shared affinity —
`house→market/granary/aqueduct`, `smithy→workshop/mine/quarry`,
`factory→refinery/port`, `palace→monument/temple`, and so on.

Influence falls off as `1/(1 + d²·0.25)` and is ignored past 6 tiles.

---

## 5. Density rules

Soft coverage targets per tier, applied as **pressure, not a cap**:

| Tier | Target coverage |
| :--- | ---: |
| camp | 20% |
| hamlet | 28% |
| village | 38% |
| town | 48% |
| city | 55% |
| metropolis | 60% |

Density is measured **locally** (a 3.5-tile neighbourhood), not globally, so a
dense core and an open agricultural fringe coexist in one settlement. Exceeding
the target makes further building progressively less attractive; it never
forbids it, so genuine economic pressure can still densify a quarter.

The `densityTolerance` on each profile modulates this — houses tolerate 0.95,
a monument 0.4.

---

## 6. Road integration

No second road network was created. `Tile.roadLevel` / `roadTraffic` remain
authoritative.

- Road proximity is probed with a bounded ring search, capped at the tier's
  extension budget + 1, and **only for the shortlisted candidates** — never for
  every tile in the survey area.
- Extension budget by tier: camp 2, hamlet 3, village 5, town 7, city 10,
  metropolis 14 tiles. A hamlet will not drive an avenue across a valley to
  site one cottage.
- Sites beyond that budget take the flat `isolation` penalty scaled by the
  type's `prefersRoad` — so a farm or a mine can still be sited off-network
  (correctly), while a market or bank effectively cannot.
- Actual paving still goes through the existing `surveyRoad` / `layRoad` /
  `paveRoadBetween` pipeline. No parallel pathfinder.

---

## 7. Performance strategy

The candidate funnel (spec §33):

1. **Hard validity filter** — occupied, water, lava, foreign territory,
   mountain, coast requirement, strategic-geology guard.
2. **Coarse collection** over the survey disc.
3. **Cheap scoring** — neighbourhood maths only, no pathfinding, no road probe.
4. **Top ~12 shortlist.**
5. **Road probe** on the shortlist only.
6. **Final sort, return top N.**

Per-project city context (building list, built radius, density target,
extension budget) is computed **once**, not per candidate tile. With a survey
radius of 22 that is the difference between reading the city's buildings a few
hundred times and reading them once.

Extraction short-circuits the whole scan: `findResourceSites` returns the only
legal tiles, so no area sweep happens at all.

Runs on the yearly construction tick only. Never on a render frame.

**Measured:** no regression. In the 2-seed smoke run the planner was *faster*
than the legacy path (27.7s vs 33.4s per seed) — the shortlist funnel does less
work than the old full-area scan-and-sort.

---

## 8. Save compatibility

**Nothing was added to the save format by CITY-V1.** Affinities, districts and
desirability are all derived at call time. No migration, no new persistent
structures.

(`City.peakBuildingSlots` is persisted, but that belongs to the separately
restored balance work, not to CITY-V1. It defaults safely for old saves —
covered by a test.)

---

## 9. Debug tools

`measureCity(city, tileMap)` returns the full `UrbanMetrics` set for any
settlement and is safe to call from a console or an inspector panel.

A dedicated dev-only overlay was **not** built — see Known Limitations.

---

## 10. QA metrics

`UrbanMetrics`:

| Metric | Meaning |
| :--- | :--- |
| `roadConnectivity` | Share of non-extraction, non-agricultural buildings within 1 tile of a road. |
| `industrialSeparation` | Mean distance from each house to the nearest heavy industry. |
| `centrality` | Mean distance of civic/commercial buildings from the centre. |
| `clustering` | Mean distance to the nearest same-affinity building (lower = tighter quarters). |
| `openSpace` | Share of unbuilt walkable tiles inside the built-up disc. |
| `sprawl` | Mean distance of all buildings from the centre. |

These are QA only. No gameplay system reads them.

---

## 11. Known limitations

1. **Road connectivity falls short of the §44 target.** The spec's ideal is
   >85% for urban buildings in Town+; measured ≈52% (up from ≈31% baseline).
   The cause is downstream of the planner: `layRoad` stops when a settlement
   runs out of stone/wood, and `decayRoadTraffic` demotes lightly used tiles
   back to level 0. The planner now *prefers* frontage correctly; making the
   target would need road funding/decay changes, which are economy-side and
   out of CITY-V1's scope.
2. **No debug overlay UI.** `measureCity` provides the data; nothing renders it.
   Deferred — spec §34 asks not to touch the renderer without need.
3. **Buildings remain 1×1.** Per spec §5. Palace/Factory/Colosseum still occupy
   one logical tile.
4. **Road extension is preference, not construction planning.** The planner
   penalises distance from the network and refuses sites beyond the tier
   budget, but does not itself survey the extension — it delegates to the
   existing `paveRoadBetween` after placement.
5. **`failedPlacements` is not yet instrumented** in the multi-seed harness
   (reported as 0). Requires a counter in `constructBuilding`.
6. **Long-run civilisation collapse persists.** Unrelated to CITY-V1: settlements
   reliably reach Town but most still die out by ~year 200-300 from a
   pre-existing systemic decline.

---

## 12. CITY-V2 hooks

Deliberate seams left for the next phase:

- `UrbanProfile` is the natural home for `ArchitecturalProfile` — the metadata
  table already exists and is keyed by building type.
- `DistrictAffinity` is already computed per building and could drive
  district-wide visual treatment (industrial soot, civic paving) without any
  new state.
- `BuildingSiteCandidate` carries every score component, ready to feed a debug
  overlay or an in-game "why here?" inspector.
- `PLANNER_WEIGHTS` is a single tuning object — culture/era/species could
  modulate it to give realms genuinely different city shapes.
- `measureCity` gives CITY-V2 a before/after harness that already works.
