# CityLife (IsoCity Engine Edition)

CityLife is a systems-based life-planning simulator implemented on top of the `isometric-city` engine and framework.

The active app is no longer the legacy plain-HTML prototype. The current runtime lives in `isometric-city/` (Next.js + TypeScript + Canvas).

## Why CityLife Exists

Most planning tools flatten life into lists. CityLife models life as an interactive system:

- commitments become **buildings**
- dependencies/effort pathways become **roads**
- outcomes are tracked as coupled metrics: **Income**, **Happiness**, **Wellness**

The objective is not maximizing a single score. It is maintaining sustainable balance over time.

This framing follows the conceptual model described in `paper/Paper_draft.md`: move from overwhelm to construction by externalizing planning into a visual, rule-driven world.

## Conceptual Foundations

CityLife is designed around four ideas:

1. **External cognition and cognitive offloading**  
   Planning burden is shifted from working memory into a persistent, manipulable environment.

2. **Readiness over intention**  
   A task can exist but still be non-executable. CityLife makes this explicit via activation rules.

3. **Explainable systems behavior**  
   Influence is computed from shortest road-path distance, then decayed and aggregated into visible metrics.

4. **Motivation through construction**  
   Users can iteratively test small structural changes and see immediate feedback, turning planning into an active design process.

## What Is Implemented Now

CityLife mode in `isometric-city` currently provides:

- dedicated route: `/citylife`
- curated CityLife toolset (Road, Bulldoze, House, School, Office, Factory, Hospital, Mall, Park)
- random variant assignment for multi-option categories (e.g., multiple House/Office/Factory variants)
- starter city generation matching the prior concept layout
- top-level metric cards for Income/Happiness/Wellness
- influence summary panel with strongest distance-weighted edges

## Core Rules (Current Runtime)

CityLife mode intentionally simplifies base IsoCity mechanics:

- zoning is not required for CityLife placement
- power/water gating is disabled for CityLife behavior
- buildings are forced to complete immediately
- budget is effectively unlimited in CityLife mode

CityLife-specific activation and influence rules:

- buildings contribute as **active** only when orthogonally adjacent to at least one road tile
- influence distance is the shortest path over road/bridge tiles
- influence strength decays exponentially with distance and is thresholded

## Formal Influence Sketch

The conceptual influence function used in the paper and mirrored by implementation logic:

`w_ij = a_i * a_j * exp(-d_ij / lambda)` for `d_ij <= d_max`, otherwise `0`

Where:

- `a_i`, `a_j`: active-state gates
- `d_ij`: BFS shortest road-path distance between node-adjacent road sets
- `lambda`: decay constant
- `d_max`: max interaction distance

Node and pairwise effects then aggregate into bounded metrics `[Income, Happiness, Wellness]`.

## Building Categories and Tool Mapping

CityLife tool categories map to conceptual life domains:

- **Housing**: baseline stability/population support
- **Work (Current)**: immediate income (often with tradeoffs)
- **Work (Capacity)**: future capability and planning support
- **Health**: wellness stabilization
- **Leisure**: happiness and recovery support
- **Development**: long-term growth support

Current tool-to-variant behavior:

- House: randomized housing variant
- School: randomized school/university variant
- Office: randomized office variant
- Factory: randomized industrial variant
- Mall: randomized shop/mall variant
- Park: randomized park variant
- Hospital: fixed hospital variant

Sprite pack target for CityLife mode:

- `CITYLIFE_SPRITE_PACK_ID = "sprites4-ages-modern"` in `isometric-city/src/lib/citylife.ts`

## Quick Start

Run from the engine directory:

```bash
cd isometric-city
npm install
npm run dev
```

Open:

- `http://localhost:3000/citylife` for CityLife mode
- `http://localhost:3000/` for standard IsoCity mode

## Architecture Pointers

Primary CityLife files:

- `isometric-city/src/app/citylife/page.tsx`
- `isometric-city/src/components/citylife/CityLifeMode.tsx`
- `isometric-city/src/lib/citylife.ts`
- `citylife-config/citylifeSpriteMapping.json`
- `isometric-city/src/lib/citylifeSpriteMapping.ts`
- `isometric-city/src/context/GameContext.tsx`
- `isometric-city/src/lib/simulation.ts`
- `isometric-city/src/components/game/CanvasIsometricGrid.tsx`

## Sprite Mapping Source of Truth

CityLife category-to-sprite selection is now controlled from a single JSON file:

- `citylife-config/citylifeSpriteMapping.json`

You can:

- map each category (`house`, `school`, `office`, `factory`, `hospital`, `mall`, `park`) to one or more grid coordinates
- point each coordinate to any configured sheet (for example `modern` or `dense`)
- add more sheets under `sheets` with custom `src`, `cols`, and `rows`

Rendering uses deterministic per-tile selection from the list so variants stay stable.

For app compatibility, `isometric-city/src/config/citylifeSpriteMapping.json` is synced from the root file by:

- `isometric-city/scripts/sync-citylife-config.mjs`
- automatic npm lifecycle hooks: `predev`, `prebuild`, and `prestart`

## Decoupling Architecture

CityLife aims to use `isometric-city` as an engine resource, not as the primary home for CityLife-specific logic and configuration.

Practical rules:

- prefer root-owned CityLife files for source-of-truth config and project-specific assets
- keep `isometric-city` integration shallow through adapters/sync scripts
- avoid deep engine rewrites when a root-level override or mapping can solve the need

Current pattern in this repo:

- edit CityLife sprite/category mapping at `citylife-config/citylifeSpriteMapping.json`
- sync into engine runtime path via `isometric-city/scripts/sync-citylife-config.mjs`
- run through `./run_citylife.sh` or normal npm scripts (`predev`, `prebuild`, `prestart` sync automatically)

## Repository Layout

- `isometric-city/`: active engine/framework codebase
- `old-approach/`: archived pre-engine prototype docs/scripts
- `paper/`: concept notes and draft paper material
- `assets/`: source assets and references from migration work

## Research Direction

The paper proposes CityLife as a research-backed metaphor for executive-function support and a testbed for:

- measuring initiation and planning improvements against list-based tools
- evaluating whether visual readiness/dependency encoding reduces overwhelm
- testing whether construction-style interaction improves engagement
- adding explainable advisor support grounded in graph paths and metric attribution

See `paper/Paper_draft.md` for full rationale, mechanisms, and hypotheses.

## Development Notes

- use `isometric-city` as the working directory for app commands
- root-level legacy files (`index.html`, `js/`, `styles.css`) are historical, not active runtime
- if Next.js warns about workspace root inference, launch from `isometric-city/` (already configured with `outputFileTracingRoot` in `isometric-city/next.config.js`)

## Related Documentation

- archived prototype docs:
  - `old-approach/README.md`
  - `old-approach/AGENTS.md`
- engine docs:
  - `isometric-city/README.md`
  - `isometric-city/AGENTS.md`
- concept docs:
  - `paper/description.md`
  - `paper/Paper_draft.md`

## License Notes

Licensing differs by subtree. Review both:

- `LICENSE.md` (repository-root legacy/project terms)
- `isometric-city/LICENSE` (engine subtree license)
