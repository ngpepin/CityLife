# CityLife Architecture

This document is the technical deep dive for the current CityLife implementation that runs on top of the `isometric-city` engine.

It explains:

- how the engine is organized internally
- where CityLife connects to it
- what the intentional seam boundaries are
- how those seams preserve pragmatic isolation
- how a developer can make CityLife changes without learning all of engine internals

## 1) System Overview

CityLife is not a separate renderer anymore. It is a mode running inside the `isometric-city` Next.js app.

At runtime:

1. the `/citylife` route mounts a fresh game context
2. CityLife mode loads its starter state and tool palette
3. placement commands flow through shared engine APIs with CityLife overrides
4. simulation ticks run in the engine loop
5. rendering uses the same isometric canvas pipeline, with CityLife sprite mapping override support

Conceptually:

- CityLife owns behavior intent and configuration
- `isometric-city` owns rendering, state loop, and baseline simulation plumbing

## 2) Repository Topology and Ownership

Top-level ownership is intentionally split:

- `citylife-config/`
- `run_citylife.sh`
- `README.md`, `AGENTS.md`, `ARCHITECTURE.md`
- `paper/`
- `isometric-city/`

Ownership model:

- repo root holds CityLife source-of-truth docs/config/scripts
- `isometric-city/` is treated as an engine subtree that CityLife integrates with through adapters and sync

Legacy material remains but is not active runtime:

- `old-approach/`
- root `index.html`, `js/`, `styles.css`

## 3) isometric-city Engine Architecture (Deep Dive)

### 3.1 Route and mode composition

Routes are in `isometric-city/src/app/**`.

CityLife route:

- `isometric-city/src/app/citylife/page.tsx`

This route mounts:

- `GameProvider` with `startFresh` and `disablePersistence`
- `CityLifeMode` as the mode-specific UI shell

### 3.2 State container and command bus

Core state/context is `isometric-city/src/context/GameContext.tsx`.

Responsibilities:

- source of truth for `GameState`
- placement commands (`placeAtTile`, drag/bridge operations)
- tick scheduling (`simulateTick`)
- sprite-pack selection
- persistence and save/load behaviors

Important performance pattern:

- `latestStateRef` feeds canvas rendering continuously
- React state sync is throttled for UI responsiveness

### 3.3 Simulation engine

Core simulation lives in `isometric-city/src/lib/simulation.ts`.

Major responsibilities:

- terrain and initial state creation
- placement validity and footprint logic
- zoning, service coverage, demand, growth/evolution
- per-tick updates and economic/system statistics

CityLife does not replace this engine. It injects mode-specific behavior via conditionals around `state.cityName === 'CityLife'`.

### 3.4 Rendering pipeline

Main renderer:

- `isometric-city/src/components/game/CanvasIsometricGrid.tsx`

It uses layered canvases and a render queue model for performance:

- base terrain/roads/rails/water passes
- buildings pass
- vehicle/effects overlays
- lighting/night overlays

Sprite source selection:

- `isometric-city/src/components/game/buildingSprite.ts`

Sprite-pack definitions:

- `isometric-city/src/lib/renderConfig.ts`

### 3.5 Sprite sheet abstraction

`renderConfig.ts` defines sprite packs (`SpritePack`) with:

- base sheet source
- optional variant sheets (dense/modern/parks/services/etc.)
- per-building variants, offsets, scale controls

CityLife uses this abstraction and overlays its own mapping before default selection.

## 4) CityLife Integration Seams

The seams below are the core of pragmatic isolation.

### Seam A: Mode seam (entry + UI ownership)

Files:

- `isometric-city/src/app/citylife/page.tsx`
- `isometric-city/src/components/citylife/CityLifeMode.tsx`

Contract:

- CityLife owns tool panel, metric cards, influence summary, reset flow
- engine owns canvas runtime and generic game shell primitives

Why this helps:

- UI experimentation for CityLife does not require engine rewrite

### Seam B: Tool/category seam (concept tool to engine building type)

Files:

- `isometric-city/src/lib/citylife.ts`
- `isometric-city/src/context/GameContext.tsx`

Key functions:

- `CITYLIFE_TOOLS`
- `getCityLifeToolBuildingOptions`
- `placeCityLifeToolBuilding`

Contract:

- CityLife defines conceptual categories (House, Office, Factory, etc.)
- engine placement receives concrete `BuildingType` values only

Why this helps:

- adding/remapping category variants is mostly CityLife-local logic

### Seam C: Rule override seam (CityLife simulation behavior)

Files:

- `isometric-city/src/lib/simulation.ts`

Key functions:

- `isCityLifeState`
- `applyCityLifeBuildingOverrides`
- `forceInstantConstructedBuilding`

Current CityLife overrides:

- placement path bypasses normal zoning requirement for CityLife-placed buildings
- construction forced to complete immediately for placeable CityLife buildings
- power/water marked available for those CityLife buildings
- practical unlimited budget behavior is enforced in command handling

Why this helps:

- keeps base IsoCity rules intact while CityLife gets its simplified behavioral model

### Seam D: Sprite mapping seam (CityLife art source-of-truth)

CityLife source-of-truth:

- `citylife-config/citylifeSpriteMapping.json`

Engine adapter:

- `isometric-city/src/lib/citylifeSpriteMapping.ts`

Render integration:

- `isometric-city/src/components/game/buildingSprite.ts`
- `isometric-city/src/components/game/CanvasIsometricGrid.tsx`

Contract:

- category definitions map building types to one or more sprite-grid coordinates
- each coordinate references a named sheet defined in `sheets`
- mapping can mix sheets (for example modern + dense)
- selection is deterministic by `(tileX, tileY, buildingType)` to keep variants stable

Why this helps:

- no hard-coded sprite coordinate churn in renderer internals

### Seam E: Config sync seam (root config -> engine runtime)

Problem solved:

- Next/Turbopack expects imports from app-root-visible paths

Implementation:

- sync script: `isometric-city/scripts/sync-citylife-config.mjs`
- output: `isometric-city/src/config/citylifeSpriteMapping.json`
- npm hooks in `isometric-city/package.json`: `predev`, `prebuild`, `prestart`

Contract:

- edit root config only
- generated engine copy is runtime artifact

Why this helps:

- keeps CityLife ownership at root while remaining compatible with framework constraints

### Seam F: Operations seam (developer launch ergonomics)

File:

- `run_citylife.sh`

Contract:

- one root command for `dev`, `build`, `prod`
- script hides engine subfolder details and guards common startup pitfalls

Why this helps:

- lowers onboarding friction for CityLife contributors

## 5) End-to-End Runtime Flows

### 5.1 Boot flow

1. developer runs `./run_citylife.sh dev`
2. script enters `isometric-city/` and runs `npm run dev`
3. `predev` executes `scripts/sync-citylife-config.mjs`
4. Next starts; route `/citylife` mounts CityLife mode
5. `CityLifeMode` sets `CITYLIFE_SPRITE_PACK_ID` and loads `createCityLifeStarterState()`

### 5.2 Place-building flow

1. user clicks with selected CityLife tool
2. `GameContext.placeAtTile` checks if `cityName === 'CityLife'`
3. CityLife tools resolve candidate `BuildingType[]` via `getCityLifeToolBuildingOptions`
4. `placeCityLifeToolBuilding` attempts randomized candidates until one validly places
5. `placeBuilding` applies footprint and CityLife overrides
6. state updates and next render frame draws the selected sprite

### 5.3 Metric flow

1. CityLife mode computes `calculateCityLifeSnapshot(state.grid, state.gridSize)`
2. nodes are extracted from placed buildings in CityLife categories
3. active-state is based on completed + orthogonal road adjacency
4. BFS shortest road-path distances generate pairwise influence weights
5. weighted pair effects aggregate into Income/Happiness/Wellness

### 5.4 Sprite resolution flow

1. renderer asks `selectSpriteSource(buildingType, building, tileX, tileY, activePack)`
2. first check: `getCityLifeMappedSpriteForBuilding(...)`
3. if mapped, renderer uses mapped sheet + row/col
4. otherwise fallback to standard sprite-pack variant selection logic
5. `CanvasIsometricGrid` preloads mapped sheet sources via `getCityLifeSpriteMappingSheetSources(...)`

## 6) Source-of-Truth Model for CityLife Configuration

CityLife config root:

- `citylife-config/citylifeSpriteMapping.json`

Top-level keys:

- `enabled`
- `applyWhenSpritePackId`
- `sheets`
- `categories`

Category contract:

- `buildingTypes`: engine building types that belong to the category
- `sprites`: one or more `{ sheet, row, col }` entries

This file is the only mapping file you should edit for CityLife sprite/category assignment.

## 7) Practical Isolation Rules

These are the project-level architecture guardrails.

1. Keep CityLife-specific config and docs at repo root when feasible.
2. Treat `isometric-city/src/config/citylifeSpriteMapping.json` as generated runtime artifact.
3. Add CityLife behavior through adapters and mode checks, not broad engine rewrites.
4. Preserve default IsoCity behavior unless a cross-mode change is deliberate.
5. Keep seam boundaries explicit in docs when introducing new CityLife capabilities.

## 8) Developer Change Map (Fast Path)

If you want to:

- change category sprite choices: edit `citylife-config/citylifeSpriteMapping.json`
- change CityLife metrics and influence logic: edit `isometric-city/src/lib/citylife.ts`
- change CityLife tool labels or available tools: edit `isometric-city/src/lib/citylife.ts`
- change placement budget behavior: edit `isometric-city/src/context/GameContext.tsx`
- change instant-build/power/water overrides: edit `isometric-city/src/lib/simulation.ts`
- change CityLife UI layout and panels: edit `isometric-city/src/components/citylife/CityLifeMode.tsx`
- change base engine rendering rules: edit files under `isometric-city/src/components/game/`

## 9) Troubleshooting by Seam

Procedural/placeholder-looking buildings appear:

- verify route is `/citylife`
- verify pack is `sprites4-ages-modern`
- verify category mapping contains the target building type
- verify sync ran and generated config exists in `isometric-city/src/config/`

Mapping edits do not show up:

- edit root file only
- rerun `./run_citylife.sh dev` or run sync script manually
- confirm row/col are in bounds for declared sheet dimensions

`npm start` fails with missing production build:

- run `./run_citylife.sh prod` or run `build` before `start`

Next workspace root warning:

- run from repo root via `run_citylife.sh` or directly from `isometric-city/`
- `isometric-city/next.config.js` already sets `outputFileTracingRoot` and `turbopack.root`

## 10) Why This Minimizes Learning Curve

A new developer can be productive by learning only three CityLife-centric entry points first:

- `citylife-config/citylifeSpriteMapping.json`
- `isometric-city/src/lib/citylife.ts`
- `isometric-city/src/components/citylife/CityLifeMode.tsx`

They can defer deep engine internals until needed. That is the practical isolation target:

- CityLife remains concept-first and configurable
- engine complexity stays mostly behind stable seams
