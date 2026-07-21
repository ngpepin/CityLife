# AGENTS.md — CityLife on IsoCity Engine

This file is the repo-root handoff for coding agents.

It replaces the legacy prototype guidance with the current approach:
CityLife is implemented inside `isometric-city/` using the IsoCity engine/framework.

---

## 0) Prime Directive

Do not migrate work back to the old plain-HTML prototype.

Use `isometric-city/` as the active runtime and development target, and keep changes incremental.

### 0.1 Isolation/Decoupling Goal

Treat `isometric-city` as an engine resource, not the primary home of CityLife customization.

When possible:

- keep CityLife-specific config/content/code at repo root or in root-adjacent CityLife folders
- avoid tightly coupling CityLife behavior to deep engine plumbing
- integrate through thin adapters and sync steps rather than invasive engine rewrites

Preferred pattern:

- root-owned CityLife source-of-truth files
- runtime/build-time sync into `isometric-city` only where required by framework constraints
- keep synchronization scripts explicit and documented

---

## 1) Product Intent

CityLife is a life-planning simulation mapped onto a city:

- Work nodes increase Income (with possible stress tradeoffs).
- Leisure/health/development nodes support Happiness and Wellness.
- Road connectivity and shortest road-path distance define influence strength.

Primary user loop:

1. Capture and place a named activity.
2. Connect, edit, move, or remove activities and roads.
3. Observe Income/Happiness/Wellness and inspect their attribution.
4. Return to the same browser-local plan or move it through JSON export/import.

---

## 2) Absolute Invariants

Unless explicitly changed by product direction, preserve these:

1. **Road adjacency gating (CityLife metrics)**  
   A building contributes as active only when orthogonally adjacent to a road or bridge tile.

2. **Distance over road graph only**  
   Influence distance is shortest-path BFS over road/bridge tiles between adjacent-road sets.

3. **CityLife mode bypasses base sim utility gating**  
   In CityLife mode, zoning/power/water should not block placement/contribution behavior.

4. **Immediate completion in CityLife mode**  
   Buildings should appear fully built (no construction wait).

5. **Unlimited CityLife budget behavior**  
   CityLife placement should not be constrained by normal city budget limits.

6. **Category tool randomization**  
   Tools like House/Office/Factory/Mall/Park select from curated building variants randomly.

---

## 3) Active Code Map

### Repo root

- `README.md` and `AGENTS.md`: repo-level docs (this file)
- `citylife-config/citylifeSpriteMapping.json`: CityLife art-mapping source of truth; semantic categories live in `isometric-city/src/lib/citylife.ts`
- `run_citylife.sh`: root launcher for dev/build/prod flows
- `old-approach/`: archived pre-engine prototype
- `paper/`: concept and paper drafts

### Active implementation (`isometric-city/`)

- `src/app/citylife/page.tsx`  
  CityLife route entry (`/citylife`) using an explicit `gameMode="citylife"` provider boundary.

- `src/app/citylife/layout.tsx`
  Route-specific metadata for the CityLife product.

- `src/components/citylife/CityLifeMode.tsx`  
  CityLife UI shell and workflow orchestration: onboarding, capture, persistence, tools, move/undo, and modal routing.

- `src/components/citylife/CityLifeNodeEditor.tsx`
  Activity details and task-checklist editor.

- `src/components/citylife/CityLifeInsightsPanel.tsx`
  Readiness, contribution attribution, and relationship explanations.

- `src/components/citylife/CityLifeOnboarding.tsx`
  First-run blank/example/import choice.

- `src/components/citylife/CityLifeRelationshipGraphModal.tsx`
  Interactive sparse relationship graph and signed edge details.

- `src/lib/citylife.ts`  
  CityLife rules and data:
  - tool/category mapping
  - random variant selection per tool
  - stable activity metadata and migration
  - pure activity update/move commands
  - active-node detection and road-distance influence snapshot
  - blank and example city generation

- `src/lib/citylifeStorage.ts`
  Versioned workspace validation, migration, local storage, and JSON portability.

- `src/games/isocity/types/buildings.ts`
  Canonical optional CityLife activity metadata types on engine buildings.

- `src/context/GameContext.tsx`  
  Explicit mode boundary, placement integration, route-scoped sprite pack, and disabled shared simulation loop in CityLife.

- `src/lib/simulation.ts`  
  Engine simulation core with CityLife-specific overrides for construction/utilities behavior.

- `src/components/game/CanvasIsometricGrid.tsx`  
  Core rendering and interaction canvas.

- `src/lib/citylife.test.ts` and `src/lib/citylifeStorage.test.ts`
  Focused domain, movement, persistence, and validation regression tests.

---

## 4) Runtime & Commands

Run commands from `isometric-city/`:

```bash
npm install
npm run dev
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Primary URL for this project concept:

- `http://localhost:3000/citylife`

Notes:

- Node.js 20.9 or newer is required by the installed Next.js version.
- `/` remains the base IsoCity mode.
- If Next.js warns about workspace root inference, verify commands are launched from `isometric-city/`.
- Full lint currently reports existing findings in older engine/coaster files; touched files must still lint cleanly.

---

## 5) Asset/Sprite Expectations

CityLife uses the modern sprite pack configured in `src/lib/citylife.ts`:

- `CITYLIFE_SPRITE_PACK_ID = "sprites4-ages-modern"`
- Category-to-grid coordinate overrides live in `citylife-config/citylifeSpriteMapping.json`
- `isometric-city/src/config/citylifeSpriteMapping.json` is generated from the root config by `isometric-city/scripts/sync-citylife-config.mjs` (`predev`, `prebuild`, `prestart`)

If visuals regress to placeholder/procedural output:

1. Confirm you are on `/citylife`.
2. Confirm `CityLifeMode` sets the CityLife sprite pack on mount.
3. Confirm tool mapping and sprite-building mapping resolve to valid sprite keys.

---

## 6) Debugging Workflow

When something looks wrong, use this order:

1. **Compile/runtime errors first**  
   Run `npm run dev` and fix the first TypeScript/runtime error.

2. **Wrong mode check**  
   Ensure testing happens on `/citylife`, not `/`, and confirm `GameProvider` receives `gameMode="citylife"`.

3. **Workspace check**
   Inspect the visible save/import error first. CityLife autosave is deliberately gated until a validated workspace is active.

4. **Placement behavior check**
   Verify `GameContext.placeAtTile` CityLife path is executing:
   - unlimited budget branch
   - CityLife tool variant placement

5. **Simulation override check**
   Verify CityLife-specific overrides still force complete/serviced behavior.

6. **Rendering path check**
   Validate `CanvasIsometricGrid` receives expected tile/building data.

---

## 7) Manual Test Checklist (CityLife)

- [ ] With no saved workspace, onboarding offers blank, example, and import paths.
- [ ] With a valid save, reload restores geometry, metadata, and stable activity IDs.
- [ ] Quick capture places a named activity and opens its editor.
- [ ] Activity title, status, priority, due date, notes, next action, and checklist persist.
- [ ] Income/Happiness/Wellness cards update with building and road-topology edits.
- [ ] Roads can be placed/removed.
- [ ] Buildings place with CityLife tool categories.
- [ ] Category tools produce randomized variants where configured.
- [ ] New CityLife buildings appear fully built.
- [ ] CityLife placement is not budget-limited.
- [ ] Building activity toggles based on orthogonal road adjacency.
- [ ] Influence summary updates and distances reflect road topology.
- [ ] Move preserves identity/details; invalid destinations do not mutate the plan.
- [ ] One-step Undo restores the previous edit, move, placement, or bulldoze state.
- [ ] Export/import round-trips the workspace; invalid import is non-destructive.
- [ ] Reset example asks for confirmation.
- [ ] At a phone-sized viewport, the canvas remains visible and core tools are reachable.
- [ ] `/` retains base IsoCity costs, inspection, sprites, and canonical multi-tile footprints.

---

## 8) Non-Goals

- Do not re-introduce root-level plain-ESM renderer work as the active app.
- Do not add a parallel second runtime for CityLife unless explicitly requested.
- Do not rewrite large engine subsystems when a local integration change is sufficient.
- Do not bury new CityLife-only configuration deep inside engine directories when a root-level source-of-truth is feasible.

---

## 9) Change Expectations

When implementing:

1. Prefer small, localized edits.
2. Keep behavior changes explicit and testable.
3. Prefer root-owned CityLife files plus explicit sync into `isometric-city` over hard-coding directly in engine internals.
4. Update docs/scripts whenever sync behavior or source-of-truth paths change.
5. Preserve compatibility with upstream IsoCity mode unless intentionally changed.
