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

1. Place/move/remove roads and buildings.
2. Observe Income/Happiness/Wellness.
3. Inspect active/inactive node effects and influence summaries.

---

## 2) Absolute Invariants

Unless explicitly changed by product direction, preserve these:

1. **Road adjacency gating (CityLife metrics)**  
   A building contributes as active only when orthogonally adjacent to a road tile.

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
- `citylife-config/citylifeSpriteMapping.json`: CityLife sprite/category source-of-truth config
- `run_citylife.sh`: root launcher for dev/build/prod flows
- `old-approach/`: archived pre-engine prototype
- `paper/`: concept and paper drafts

### Active implementation (`isometric-city/`)

- `src/app/citylife/page.tsx`  
  CityLife route entry (`/citylife`) using `GameProvider`.

- `src/components/citylife/CityLifeMode.tsx`  
  CityLife UI shell, tool panel, top metrics, starter city reset, sprite pack selection.

- `src/lib/citylife.ts`  
  CityLife rules and data:
  - tool/category mapping
  - random variant selection per tool
  - active-node detection and road-distance influence snapshot
  - starter city generation

- `src/context/GameContext.tsx`  
  Placement flow integration; CityLife budget/tool behavior hooks.

- `src/lib/simulation.ts`  
  Engine simulation core with CityLife-specific overrides for construction/utilities behavior.

- `src/components/game/CanvasIsometricGrid.tsx`  
  Core rendering and interaction canvas.

---

## 4) Runtime & Commands

Run commands from `isometric-city/`:

```bash
npm install
npm run dev
npm run lint
npm run build
```

Primary URL for this project concept:

- `http://localhost:3000/citylife`

Notes:

- `/` remains the base IsoCity mode.
- If Next.js warns about workspace root inference, verify commands are launched from `isometric-city/`.

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
   Ensure testing happens on `/citylife`, not `/`.

3. **Placement behavior check**  
   Verify `GameContext.placeAtTile` CityLife path is executing:
   - unlimited budget branch
   - CityLife tool variant placement

4. **Simulation override check**  
   Verify CityLife-specific overrides still force complete/serviced behavior.

5. **Rendering path check**  
   Validate `CanvasIsometricGrid` receives expected tile/building data.

---

## 7) Manual Test Checklist (CityLife)

- [ ] Load `/citylife`; starter city appears immediately.
- [ ] Income/Happiness/Wellness cards update with edits.
- [ ] Roads can be placed/removed.
- [ ] Buildings place with CityLife tool categories.
- [ ] Category tools produce randomized variants where configured.
- [ ] New CityLife buildings appear fully built.
- [ ] CityLife placement is not budget-limited.
- [ ] Building activity toggles based on orthogonal road adjacency.
- [ ] Influence summary updates and distances reflect road topology.
- [ ] Reset City restores starter layout.

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
