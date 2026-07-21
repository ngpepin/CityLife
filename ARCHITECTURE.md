# CityLife architecture

This document describes the implementation that serves **CityLife at `/citylife`**. It focuses on the product boundary, data flow, scoring rules, persistence format, and the places where CityLife intentionally reuses the IsoCity engine.

The repository also serves the base IsoCity mode at `/` and IsoCoaster at `/coaster`. The root plain-HTML files and `old-approach/` are historical and are not part of the active CityLife runtime.

## System shape

CityLife is a product mode inside the `isometric-city/` Next.js application, not a second renderer or a separate state engine.

```text
/citylife route
    |
    v
GameProvider (CityLife mode; base game-save persistence disabled)
    |
    +--> CityLifeMode commands --> shared GameState grid
    |                                |          |
    |                                |          +--> CityLife workspace storage
    |                                +--> calculateCityLifeSnapshot
    |                                           |
    |                                           +--> scores, readiness, attribution, relationships
    |
    +--> CanvasIsometricGrid --> shared isometric renderer + CityLife sprite adapter
```

The ownership boundary is pragmatic:

- CityLife owns planning concepts, metadata, scoring, product UI, workspace storage, and mapped art configuration.
- The engine owns the grid, placement primitives, canvas renderer, and baseline simulation infrastructure.
- Small mode-aware branches adapt shared engine operations instead of duplicating the engine.

## Runtime and route boundary

The route entry point is `isometric-city/src/app/citylife/page.tsx`. It mounts:

```tsx
<GameProvider startFresh disablePersistence gameMode="citylife">
  <CityLifeMode />
</GameProvider>
```

Each option has a specific purpose:

| Provider option | Effect |
| --- | --- |
| `gameMode="citylife"` | Makes the route/provider choice authoritative for CityLife-specific command behavior |
| `startFresh` | Prevents an ordinary base game from becoming the initial CityLife state |
| `disablePersistence` | Disables the engine's normal game-save system so it cannot collide with the CityLife workspace |

The provider still supplies shared state and commands. `CityLifeMode` then hydrates its own workspace and owns CityLife autosave, import, and export.

`GameState.gameMode` is the product-mode discriminator. The provider overwrites the mode when it loads state, so an imported display name cannot switch an IsoCity route into CityLife behavior. Legacy workspace validation still recognizes older CityLife states by the fixed `cityName` value when no explicit mode exists.

## Repository topology

| Path | Ownership and role |
| --- | --- |
| `README.md`, `AGENTS.md`, `ARCHITECTURE.md` | Product documentation, invariants, and contributor handoff |
| `citylife-config/` | Root-owned CityLife art mapping source |
| `run_citylife.sh` | Root launcher that delegates to the app subtree |
| `isometric-city/` | Active Next.js app and shared engine |
| `paper/` | Conceptual/research material, not a shipped-feature contract |
| `old-approach/` | Archived prototype documentation |
| `index.html`, `js/`, `styles.css` | Retired plain-HTML implementation |
| `assets/`, `tools/` | Source art and asset-generation utilities |

The root-versus-engine split is strongest for documentation and sprite mapping. CityLife application code currently lives in the engine subtree because it directly consumes the shared context, types, placement primitives, and renderer.

Unless a path starts with `isometric-city/` or another root directory, `src/...` and `scripts/...` paths below are relative to `isometric-city/`.

## State and activity data

### Shared state

`GameContext.tsx` owns the current `GameState`. CityLife uses the same square tile grid as IsoCity. Roads, bridges, terrain, and buildings are represented by engine tile/building types.

CityLife starts from a 40 by 40 grass grid in either a blank or example state. The finalized CityLife state is paused, has disasters disabled, has its construction complete, and carries a large budget sentinel.

### Activity metadata

A CityLife activity is a categorized engine building with optional planning metadata attached at `building.cityLife`. The canonical type definition is in `src/games/isocity/types/buildings.ts`:

| Field | Purpose |
| --- | --- |
| `id` | Stable activity identity; preserved by Move |
| `title` | User-facing activity name |
| `notes` | Free-form details |
| `nextAction` | Immediate follow-up |
| `status` | `backlog`, `active`, `blocked`, or `done` |
| `priority` | `low`, `medium`, or `high` |
| `dueDate` | Optional date string |
| `tasks` | Checklist entries with stable IDs and completion flags |
| `createdAt`, `updatedAt` | Millisecond timestamps |

`createCityLifeNodeMetadata` applies defaults and length limits. `migrateCityLifeNodeMetadata` adds or normalizes metadata when an old workspace contains a recognized CityLife building without the complete current shape.

Activity status, priority, due date, notes, and task completion are planning metadata. They do **not** currently affect road readiness, relationships, or scores.

### Derived snapshot

`calculateCityLifeSnapshot(grid, gridSize)` creates a `CityLifeSnapshot` from the current grid. It contains:

- activity nodes and their readiness
- retained relationship edges
- Income, Happiness, and Wellness totals
- per-activity contribution vectors and relationship counts
- the three strongest positive and negative attributions for each metric

The snapshot is derived in memory and is not a second persisted source of truth. Moving roads or buildings causes it to be recalculated from the grid.

## Product components

| File | Responsibility |
| --- | --- |
| `src/components/citylife/CityLifeMode.tsx` | Shell, responsive tools, selection, quick capture, move, undo, persistence orchestration, and modal routing |
| `src/components/citylife/CityLifeOnboarding.tsx` | First-run example/blank/import choice |
| `src/components/citylife/CityLifeNodeEditor.tsx` | Activity fields and task checklist |
| `src/components/citylife/CityLifeInsightsPanel.tsx` | Score attribution, readiness groups, and strongest signed relationships |
| `src/components/citylife/CityLifeRelationshipGraphModal.tsx` | Interactive sparse graph of activities and retained relationships |
| `src/components/game/CanvasIsometricGrid.tsx` | Shared layered-canvas rendering and tile interaction |

CityLife uses the shared canvas directly. The shell supplies its own tool controls and selected-tile behavior rather than displaying the full base simulation dashboard.

## User-action flows

### Boot and hydration

1. `GameProvider` initializes the route in CityLife mode and marks shared state ready.
2. `CityLifeMode` reads `citylife-workspace-v1` from browser storage.
3. A valid saved workspace is validated, migrated, and loaded automatically.
4. If no save exists, or the save is invalid, CityLife loads a blank state and opens onboarding. An invalid save also produces an error notice.
5. The user chooses the example, a blank plan, or import. The chosen state becomes the current workspace.
6. CityLife selects the `sprites4-ages-modern` sprite pack while the route is mounted.

### Quick capture

1. The user enters a title and chooses a category.
2. **Place** selects the corresponding category tool and records the existing node IDs.
3. A click on an empty land tile runs the shared placement command.
4. The category tool tries its curated concrete building variants in randomized order until one can be placed.
5. CityLife finds the newly created stable ID, applies the captured title and `backlog` status, selects the node, and opens the editor.

Direct-build tools use the same randomized category-to-building mapping but keep default metadata until the activity is edited.

### Edit

The editor works against a node's stable ID. Saving uses `updateCityLifeNodeMetadata`, preserves `id` and `createdAt`, refreshes `updatedAt`, and replaces only that building's metadata in the grid state.

### Move

1. The user chooses an activity and an empty destination tile.
2. `moveCityLifeNode` validates the source and destination.
3. It bulldozes the source in a candidate state and calls the normal placement primitive at the destination.
4. If placement fails, the original state is returned unchanged.
5. On success, the original metadata is attached to the destination building with the same stable ID and a new `updatedAt` value.

### Undo

`CityLifeMode` remembers one serialized previous complete `GameState`. Undo reloads it through the provider, reactivates that workspace ID, clears the history slot, and returns the UI to Select. There is no redo, the history is not written into the workspace, and a reload starts without undo history.

### Delete and reset

Bulldoze uses the shared deletion command and has no second confirmation. **Reset example** does ask for confirmation before loading a fresh example state. The reset is recorded by the one-step in-memory history, so it can normally be undone immediately.

## Readiness, relationships, and scores

The model is implemented in `src/lib/citylife.ts`. It is deterministic for a given grid and does not call an external service.

### 1. Extract recognized nodes

The engine building type maps to one of six semantic categories:

- Housing
- Work (Current)
- Work (Capacity)
- Health
- Leisure
- Development

Only mapped building types become CityLife nodes.

### 2. Apply road-adjacency gating

A node is active only when:

- its construction progress is at least 100 percent, and
- at least one road or bridge tile is orthogonally adjacent to its CityLife footprint.

Diagonal adjacency does not count. In CityLife mode buildings are completed immediately, so road adjacency is the normal visible gate.

An active node always contributes its category's base metric vector. It can therefore be **road active, but isolated** when it has no retained relationship.

### 3. Find road-only distances

For each active source node, breadth-first search starts from all of its adjacent road/bridge tiles. Traversal moves orthogonally over road and bridge tiles only.

For an active pair, distance is the shortest BFS value at any target-adjacent road tile. Disconnected roads produce no edge. Roads are undirected in this model; they do not encode task order or prerequisites.

### 4. Weight and filter relationships

For a reachable pair:

```text
normalizedDistance = max(1, roadDistance)
weight = exp(-normalizedDistance / 6)
```

The pair is discarded when:

- road distance is greater than `18`,
- weight is below `0.08`, or
- the hard-coded category-pair table returns a zero vector.

Category-pair lookup is symmetric: reversing two categories does not change the effect. Not every possible pair has an effect.

### 5. Aggregate and attribute

Totals begin at:

| Metric | Baseline |
| --- | ---: |
| Income | 5 |
| Happiness | 50 |
| Wellness | 50 |

The model adds each active node's category base effect and each retained edge's weighted pair effect, then clamps each total to `0...100`.

For explanation, a node receives its full base effect and half of each incident edge effect. The insights panel shows the three largest positive and negative node attributions per metric and up to eight strongest relationships. The compact in-canvas influence summary shows up to six edges.

The separate relationship graph includes all nodes but keeps only the union of each node's four strongest incident edges to control visual density. Selecting an edge shows its road distance, weight, and signed Income/Happiness/Wellness deltas. The graph and score-insights dialogs trap keyboard focus and close with Escape. The graph is a deliberately sparse view, not a complete edge table.

## CityLife engine adaptations

CityLife reuses normal placement and simulation functions with mode-aware behavior:

| Concern | CityLife behavior | Main location |
| --- | --- | --- |
| Tool categories | Resolve to randomized curated `BuildingType` variants | `src/lib/citylife.ts`, `src/context/GameContext.tsx` |
| Budget | Placement does not deduct or reject based on normal tool cost | `src/context/GameContext.tsx` |
| Footprints | CityLife activities occupy one tile; base IsoCity keeps canonical multi-tile footprints | `src/lib/simulation.ts`, renderer helpers |
| Construction | CityLife placeable buildings are forced complete | `src/lib/simulation.ts` |
| Utilities | CityLife activities are marked powered and watered | `src/lib/simulation.ts` |
| Zoning | Direct CityLife activity placement does not require zoning | shared placement path |
| Ongoing simulation | Starter/blank states use speed `0`, disasters off, and the large budget sentinel; imports are normalized to speed `0` and disasters off while retaining valid imported statistics; `GameContext` does not start the shared simulation loop in CityLife mode | `src/lib/citylife.ts`, `src/lib/citylifeStorage.ts`, `src/context/GameContext.tsx`, `src/lib/simulation.ts` |
| Base tile details | Base economic/cost inspection UI is suppressed in CityLife | `src/components/game/CanvasIsometricGrid.tsx` |

The route/provider mode controls command, footprint, sprite, and inspector behavior. `building.cityLife` identifies activity metadata, but does not switch base IsoCity rendering or footprint rules when a tagged state is loaded outside CityLife mode.

Changes to shared placement, footprint lookup, bulldozing, origin detection, sprite anchoring, or canvas inspection can affect both products. Test both `/citylife` and `/` when touching those seams.

## Persistence and portability

CityLife storage lives in `src/lib/citylifeStorage.ts` and is separate from the engine save code in `GameContext.tsx`.

### Browser workspace

- storage mechanism: browser `localStorage`
- key: `citylife-workspace-v1`
- capacity: one workspace per browser origin/profile
- autosave trigger: grid changes, debounced by about 650 ms
- additional save attempt: `beforeunload`

Storage access and quota failures are surfaced in the UI. Browser privacy settings, private browsing, site-data clearing, or a different origin/profile can make the workspace unavailable.

### Export envelope

The downloaded JSON is plaintext with this top-level shape:

```json
{
  "format": "citylife-workspace",
  "version": 1,
  "savedAt": 1780000000000,
  "state": {}
}
```

Export attempts to save the current state locally and then downloads `citylife-plan-YYYY-MM-DD.json`.

### Import and validation

The file picker rejects files larger than 15 MB. Parsing accepts either:

- the current version-1 envelope, or
- a raw legacy CityLife `GameState` object.

Validation checks the format/version, mode identity, grid-size bounds (`10...200`), square grid/tile shape, and essential statistics. It then migrates recognized activity metadata. Future envelope versions and other game modes are rejected.

The current validator establishes a safe structural boundary; it is not a complete schema validation of every nested engine field. Successful import replaces the current workspace state.

Undo history is not part of the export or local save. There is no account, server workspace, cloud sync, conflict resolution, or multi-workspace index for CityLife.

## Sprite and configuration pipeline

The root file `citylife-config/citylifeSpriteMapping.json` is the source of truth for CityLife **art mapping**.

```text
citylife-config/citylifeSpriteMapping.json
        |
        | scripts/sync-citylife-config.mjs
        v
isometric-city/src/config/citylifeSpriteMapping.json  (generated copy)
        |
        | src/lib/citylifeSpriteMapping.ts
        v
buildingSprite.ts + CanvasIsometricGrid.tsx
```

The sync runs through `predev`, `prebuild`, and `prestart`. Do not hand-edit the generated copy.

The mapping file owns:

- enabled pack ID
- sprite-sheet definitions
- building-type-to-art groups
- sheet row/column candidates

It does not own semantic CityLife category definitions, tool variant lists, metric coefficients, readiness rules, or relationship effects. Those remain in `src/lib/citylife.ts`.

Category tools randomize the concrete engine building type during placement. Once a type is placed, mapped sprite selection is deterministic from tile coordinates and type so ordinary rerenders do not reshuffle its art.

## Source-of-truth map

| Change | Edit here first |
| --- | --- |
| Scoring constants, base/pair effects, road rules | `isometric-city/src/lib/citylife.ts` |
| Categories and category-tool variants | `isometric-city/src/lib/citylife.ts` |
| Activity metadata shape | `isometric-city/src/games/isocity/types/buildings.ts` |
| Workspace envelope, validation, migration entry | `isometric-city/src/lib/citylifeStorage.ts` |
| Capture, selection, move/undo wiring, autosave UI | `isometric-city/src/components/citylife/CityLifeMode.tsx` |
| Activity form | `isometric-city/src/components/citylife/CityLifeNodeEditor.tsx` |
| Score explanation | `isometric-city/src/components/citylife/CityLifeInsightsPanel.tsx` |
| Graph presentation/sparsification | `isometric-city/src/components/citylife/CityLifeRelationshipGraphModal.tsx` |
| CityLife art coordinates and sheets | `citylife-config/citylifeSpriteMapping.json` |
| Shared placement/bulldoze/simulation | `isometric-city/src/lib/simulation.ts` |
| Shared command integration | `isometric-city/src/context/GameContext.tsx` |
| Canvas rendering and input | `isometric-city/src/components/game/CanvasIsometricGrid.tsx` |

## Network and privacy boundary

The CityLife workspace module writes to local browser storage and does not submit the workspace to Supabase. Two shared/runtime features still create external network considerations:

- the shared root layout includes Vercel Analytics
- opening the relationship graph injects `vis-network@9.1.9` from `https://unpkg.com`

Export files are unencrypted JSON and can contain personal titles, notes, dates, next actions, and tasks. The current app should therefore not be described as fully offline or as end-to-end encrypted.

## Verification

Run commands from `isometric-city/`:

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

The focused Vitest suite covers core road and bridge rules, symmetric road-distance effects, successful and rejected moves, workspace round trips, legacy migration, local storage behavior, and malformed import rejection. It does not replace browser interaction coverage.

The full lint command currently exits non-zero on existing findings in older engine and coaster files. `npm run build` runs image compression first and can modify generated WebP assets, so inspect the worktree afterward.

Manual verification should cover:

1. onboarding for no/invalid save and automatic load for a valid save
2. quick capture, edit, checklist, direct build, Move, Bulldoze, and one-step Undo
3. reload persistence and export/import metadata round trip
4. orthogonal road gating, disconnected roads, topology changes, score attribution, and graph behavior
5. reset confirmation and immediate undo
6. responsive tool access
7. base `/` rendering, canonical multi-tile footprints, placement costs, and tile details after shared-engine changes

## Current constraints and risks

- The scoring coefficients and category-pair table are hard-coded; there is no model editor or personal calibration.
- Workflow status, priority, dates, and checklist completion do not change scores.
- Roads are undirected influence paths, not dependency arrows.
- CityLife manages one browser-local workspace and one in-memory undo step.
- The relationship graph is intentionally sparse and depends on a third-party CDN.
- Import validation is structural rather than an exhaustive schema check.
- Shared engine seams still require cross-mode regression testing even though CityLife footprints and tile inspection are mode-scoped.
- The test suite focuses on domain/storage logic; browser component and full end-to-end tests are not configured.

## Troubleshooting by seam

### A saved workspace will not load

- inspect the UI error for storage, JSON, version, mode, grid, or statistics validation failure
- confirm the site origin/profile matches the one that created the local save
- try importing a known export; an export from a newer workspace version is intentionally rejected

### A building is not contributing

- confirm it is a recognized CityLife category
- place a road or bridge on an orthogonally adjacent tile
- remember that a disconnected road stub activates the base effect but does not create a relationship

### A relationship is missing

- confirm both nodes are road-active
- confirm their adjacent-road sets connect through road/bridge tiles only
- check the 18-tile limit and the category-pair table
- distinguish the complete snapshot from the graph's four-strongest-edges-per-node display

### Sprite mapping edits do not appear

- edit `citylife-config/citylifeSpriteMapping.json`, not the generated copy
- restart through `npm run dev` or run `node scripts/sync-citylife-config.mjs`
- confirm the mapping applies to `sprites4-ages-modern` and that row/column values are within the declared sheet

### Base IsoCity behavior changed

- inspect route/provider mode propagation
- check every `getBuildingSize` call at the changed seam
- verify whether the building has CityLife metadata
- compare `/citylife` and `/` placement, bulldozing, sprite anchoring, and inspection behavior
