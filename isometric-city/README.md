# CityLife runtime and IsoCity engine subtree

This directory contains the active Next.js application for the CityLife repository. The primary product is **CityLife at `/citylife`**. The app also retains the upstream-inspired IsoCity and IsoCoaster modes as engine demonstrations and compatibility surfaces.

For the product overview and user workflow, start with the [repository README](../README.md). For implementation boundaries and data flow, see [ARCHITECTURE.md](../ARCHITECTURE.md).

## Routes

| Route | Purpose |
| --- | --- |
| `/citylife` | Primary local-first life-planning product |
| `/` | Base IsoCity city-building mode |
| `/coaster` | Base IsoCoaster mode |

CityLife is not implemented by the historical root `index.html` and `js/` files.

## Stack and prerequisites

- Next.js 16.1.1
- React 19.2.1
- TypeScript 5
- Tailwind CSS 3
- HTML5 Canvas renderer
- Node.js **20.9 or newer**
- npm

## Install and run

From this directory:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000/citylife](http://localhost:3000/citylife).

From the repository root, the equivalent convenience command is:

```bash
./run_citylife.sh dev
```

## Scripts

| Command | Behavior |
| --- | --- |
| `npm run dev` | Sync CityLife sprite config, then start the Next.js development server |
| `npm test` | Run the focused CityLife Vitest domain/storage suite once |
| `npm run lint` | Run ESLint across the subtree |
| `npx tsc --noEmit --incremental false` | Type-check without emitting files or an incremental cache |
| `npm run build` | Sync config, run image compression, then create a production build |
| `npm start` | Sync config, then serve an existing production build |
| `npm run compress-images` | Generate or refresh WebP versions of PNG assets |
| `npm run crop-screenshots` | Destructively crop matching screenshots in `public/games/`; requires ImageMagick |

`npm run build` may update generated WebP assets. `npm start` requires a completed build.

## CityLife capabilities in this subtree

- first-run blank/example/import onboarding
- named activities with stable IDs and planning metadata
- quick capture, direct category placement, selection, edit, move, bulldoze, and one-step undo
- browser-local autosave and versioned JSON import/export
- road-adjacency readiness and BFS road-distance relationships
- Income, Happiness, and Wellness attribution
- score-insights and relationship-graph modals
- CityLife-specific unlimited budget, instant construction, and utility/zoning bypass
- root-owned sprite mapping synchronized into the app

CityLife mounts `GameProvider` with the base persistence disabled, then manages its own workspace through `src/lib/citylifeStorage.ts`. This separation prevents the CityLife plan from being mixed with base IsoCity saves.

## Important source files

| Path | Responsibility |
| --- | --- |
| `src/app/citylife/page.tsx` | `/citylife` route and provider boundary |
| `src/components/citylife/CityLifeMode.tsx` | CityLife shell, tools, capture, persistence orchestration, move/undo, and modal routing |
| `src/components/citylife/CityLifeOnboarding.tsx` | First-run blank/example/import choice |
| `src/components/citylife/CityLifeNodeEditor.tsx` | Activity metadata and checklist editor |
| `src/components/citylife/CityLifeInsightsPanel.tsx` | Score attribution, readiness, and relationship deltas |
| `src/components/citylife/CityLifeRelationshipGraphModal.tsx` | Interactive sparse relationship graph |
| `src/lib/citylife.ts` | Categories, metadata helpers, movement, starter states, and scoring model |
| `src/lib/citylifeStorage.ts` | Local save, versioned export envelope, validation, import, and migration |
| `src/games/isocity/types/buildings.ts` | Canonical engine building type plus optional CityLife metadata shape |
| `src/context/GameContext.tsx` | Shared state and placement command integration |
| `src/lib/simulation.ts` | Base simulation and CityLife mode overrides |
| `src/components/game/CanvasIsometricGrid.tsx` | Shared layered-canvas rendering and input |
| `src/lib/citylifeSpriteMapping.ts` | Runtime adapter for the generated mapping JSON |

The root source of truth for mapped CityLife art is [`../citylife-config/citylifeSpriteMapping.json`](../citylife-config/citylifeSpriteMapping.json). Do not hand-edit `src/config/citylifeSpriteMapping.json`; npm lifecycle hooks regenerate it with `scripts/sync-citylife-config.mjs`.

## Verification

Use:

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

The Vitest suite exercises CityLife road and bridge rules, symmetric road-distance effects, successful and rejected moves, workspace serialization/migration, local storage, and malformed-import rejection. Browser component and full end-to-end tests are not configured.

The full lint run currently exits non-zero on existing findings in older engine and coaster files. Also lint changed files directly, then perform the CityLife smoke test described in the [root README](../README.md#development-and-verification).

## Privacy and external services

The CityLife workspace is stored locally in the browser and does not require the optional Supabase multiplayer configuration used elsewhere in the engine. The shared layout includes Vercel Analytics, and opening the CityLife relationship graph downloads `vis-network` from `unpkg.com`. Exported workspaces are plaintext JSON.

See the [root privacy notes](../README.md#privacy-and-network-behavior) for the user-facing implications.

## Base engine boundary

The base IsoCity mode remains available at `/`, and IsoCoaster remains at `/coaster`. Much of the renderer, simulation, and UI originated in the upstream IsoCity/IsoCoaster project.

The `/citylife` route passes `gameMode="citylife"` to `GameProvider`, and the provider/route owns that mode when state is loaded. City names are presentation data, not mode switches.

CityLife explicitly requests one-tile activity footprints, while base IsoCity keeps the engine's canonical multi-tile footprints. Existing CityLife activities carry `building.cityLife` metadata for planning details and stable identity; the explicit provider mode—not the presence of that metadata—controls footprint and sprite behavior. The canvas preloads mapped CityLife sheets and hides base tile economics/cost details only in CityLife mode.

These boundaries are mode-scoped, but the implementations remain shared. Test both routes after changing placement, footprint lookup, bulldozing, sprite anchoring, or canvas inspection.

## Guidance and licenses

- Subtree agent guidance: [AGENTS.md](AGENTS.md)
- Repository agent guidance: [../AGENTS.md](../AGENTS.md)
- Engine-subtree MIT license: [LICENSE](LICENSE)
- Repository-root PolyForm terms: [../LICENSE.md](../LICENSE.md)

Review both license files before redistributing the combined repository.
