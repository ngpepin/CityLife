# AGENTS.md — Automated Agent Handoff (CityLife / Life City Builder)

This document is written for an automated coding agent to take over development safely and productively.

It contains:
- Current goals and non-goals
- Architecture map and invariants
- Rendering + simulation details
- Graph styling goals (Obsidian-like)
- Known failure modes (blank screen, CSS modal issues)
- A reliable debugging workflow
- A task backlog with implementation notes

---

## 0) Prime Directive

Do not “rewrite everything.” This project is intentionally lightweight: plain HTML/CSS + ES modules + Canvas + vis-network.

Prefer surgical changes that:
1) preserve current features,
2) improve visuals,
3) avoid adding build steps unless absolutely necessary.

---

## 1) Product Intent

This is not a standard city sim. The city is a metaphor for planning and maintaining life balance:
- **Work** structures generate income but can harm happiness if poorly placed.
- **Self-care/leisure** improves happiness/wellness and indirectly supports work by making it sustainable.
- **Distance matters**: relationships weaken as shortest road distance increases.

User goals:
- build, move, remove activities
- see effects on Income/Happiness/Wellness
- inspect the “activity network” as a graph

---

## 2) Absolute Invariants

These rules must remain true unless product direction changes:

### 2.1 Road adjacency gating
A building is **Active** only if orthogonally adjacent to at least one road tile.

This gating affects:
- simulation contributions
- relationship graph inclusion (edges typically only between active nodes)
- UI badges (“Needs road”)

### 2.2 Distance defined by road shortest path
Influence distance is:
- building A → its adjacent road tile(s)
- BFS shortest path through road tiles to building B’s adjacent road tile(s)
- distance = minimum BFS length over all adjacency combinations

No Euclidean/Manhattan fallback unless explicitly decided.

### 2.3 Modular ES modules (no bundler)
The project uses native ESM:
- requires running via local server
- no bundler assumptions
- avoid Node-only tooling unless introduced intentionally

---

## 3) Repository Layout & Responsibilities

### Root
- `index.html`: DOM layout, HUD, toolbar, modal container, script includes.
- `styles.css`: global styling, HUD, toolbar, modal, graph styling.

### `js/`
- `config.js`: grid size, tile pixel sizes, simulation tuning constants.
- `utils.js`: helpers (clamp/lerp/uid/expFalloff/etc.).
- `isoRenderer.js`: the Canvas renderer. **Most blank-screen bugs originate here** due to syntax mistakes.
- `pathfinding.js`: road graph + BFS distances.
- `metrics.js`: simulation model and rules.
- `ui.js`: HUD metrics display and sparklines.
- `graphView.js`: vis-network graph modal, nodes/edges, styles, interactions.
- `game.js`: main entrypoint; loads example city, hooks inputs, render loop.

---

## 4) Rendering Pipeline (isoRenderer.js)

### 4.1 Draw ordering
Rendering uses depth sort based on `x + y` (plus tiny offsets):
- tile first
- then road
- then building

### 4.2 Camera
`camera` has:
- `x`, `y` world offset (panning)
- `zoom`
- `rot` (0..3) 90° increments

Coordinate transforms:
- `gridToScreen()` uses rotated coordinates
- `screenToGrid()` inverse maps screen → rotated iso → inverse rotation

### 4.3 Common failure mode: “blank city”
If the city is blank but DOM loads, almost always:
- a syntax error in a JS module
- an exception thrown every frame in `renderer.draw()`

Agent workflow:
1) open DevTools console
2) find first red error
3) fix that file and reload

**Important gotcha:** If methods like `roadMask()` accidentally get pasted inside `drawRoad()`, the module becomes invalid and everything stops.

---

## 5) Road Rendering (isoRenderer.js)

Road tile is a diamond with asphalt gradient.

The key design requirement:
- road markings should “make sense” relative to connectivity.
- intersections should be clean (minimal markings).

Current approach (intended):
- compute neighbor mask (N/S/E/W roads)
- only draw markings for:
  - dead-end (1 neighbor)
  - straight/corner (2 neighbors)
- skip markings for:
  - T junction (3 neighbors)
  - 4-way intersection (4 neighbors)

If you change markings, keep it connectivity-driven.

---

## 6) Simulation Model (metrics.js)

### 6.1 Active gating
Buildings are marked active based on road adjacency each recompute.

### 6.2 Influence decay
Influence weight uses model globals (see `model.js`): `expFalloff(distance, globals.lambda)` with threshold `globals.theta` and max distance `globals.dMax`.

### 6.3 Current heuristics (tunable)
- Houses provide population baseline.
- Work buildings’ income depends on worker access (houses weighted by distance).
- Leisure boosts happiness near houses; also boosts work via attractiveness.
- Factories penalize happiness/wellness when near houses/parks.

If changing formulas:
- keep monotonic distance-decay
- ensure metrics stay reasonably bounded (happiness/wellness 0..100)

---

## 7) Graph View (graphView.js) — Target: “Obsidian-like”

Current state: Obsidian-like aesthetic is largely achieved; remaining focus is stability.

### 7.1 Visual requirements
- not chunky; more technical/precise
- small nodes with refined “3D-ish” feel
- edges thin, curved, not rigid straight lines
- hover tooltip on nodes (for now: internal id)
- subtle physics “giggle” when dragging nodes, like Obsidian

### 7.2 Implementation notes (vis-network)
vis-network supports:
- physics solver: `forceAtlas2Based`
- curved edges: `smooth: { type: "dynamic" }`
- hover events: `hoverNode`, `hoverEdge`, `mousemove`
- thin edges via `width`
- tooltips: positioned div overlay in the modal

### 7.3 Hairball control
To avoid “edge spaghetti”:
- raise `CONFIG.influenceThreshold`
- and/or cap edges per node by weight (keep top N connections per node)

If capping edges, do it post-generation:
- build adjacency lists
- sort by weight
- keep top N per node
- de-dupe edge ids

### 7.4 Jiggle behavior
vis-network uses continuous physics; keep stabilization modest to avoid drift.
Prefer small solver tweaks over aggressive auto-fit/auto-move.

---

## 8) Debugging Workflow (Do This Every Time)

### 8.1 Renderer sanity checks
If the world is blank:
1) check DevTools → Console for syntax error
2) confirm `js/isoRenderer.js` loads without errors
3) confirm `game.js` import chain works

### 8.2 Graph sanity checks
If graph modal is blank:
- confirm vis-network CDN loaded (Network tab)
- confirm modal is not forced visible by CSS `.modal { display:grid }` overriding `.hidden`
- check if nodes/edges arrays are non-empty and `Network` is constructed

### 8.3 CSS modal override bug
If `.hidden` doesn’t hide the modal:
Ensure:
```css
.modal.hidden { display:none !important; }
.hidden { display:none !important; }
```

---

## 9) Local Run / No-Build

Run in repo root:
```bash
python -m http.server 8999
```

Because modules are ESM, file:// won’t work reliably.

---

## 10) Code Conventions & Safety

- Keep modules small and single-purpose.
- Avoid introducing bundlers unless asked.
- Prefer minimal dependencies; Cytoscape is already used.
- Any rendering change should maintain:
  - isometric orientation and depth sorting
  - hover highlight correctness
  - road adjacency rule

---

## 11) Test Checklist (Manual)

### Core world
- [ ] Example city appears on load (roads + buildings visible)
- [ ] Panning works
- [ ] Zoom works
- [ ] Rotate Q/E works

### Tools
- [ ] Road tool toggles road on empty tiles, never on building tiles
- [ ] Build tool places building on empty non-road tiles
- [ ] Bulldozer removes road/building
- [ ] Move tool drags building to empty non-road tile

### Rules
- [ ] Buildings adjacent to roads show as active (no “Needs road”)
- [ ] Buildings not adjacent show “Needs road” and don’t contribute

### HUD
- [ ] Income/Happiness/Wellness update after changes
- [ ] Sparklines animate and do not crash

### Graph
- [ ] Graph opens/closes reliably
- [ ] Nodes appear and edges appear for close connections
- [ ] Hover shows tooltip (id)
- [ ] Dragging a node causes satisfying “jiggle” and settles

---

## 12) Active Development Backlog (Recommended Sequence)

### A) Stabilize blank-screen causes
- Add an error boundary around the render loop in `game.js`:
  - catch exceptions in `renderer.draw()` and display toast + stop the loop
  - prevents silent failures

### B) Graph polish to Obsidian-like quality
- Implement overlay tooltip div in modal
- Reduce node size + add refined glow/shadow
- Thin bezier edges with opacity gradients
- Layout tune (repulsion, idealEdgeLength)
- “Reheat” layout briefly after drag

### C) Road markings polish
- Ensure markings depend on connectivity
- Intersections have no markings
- Optional: vary markings by straight/corner (tiny arcs instead of dashes)

### D) Save/Load
- Serialize grid + buildings to JSON
- localStorage persistence
- export/import UI buttons

### E) Make “task nodes” first-class
- Each building has a user-editable:
  - title
  - notes
  - category override
  - stress/energy cost
- Graph shows these labels on hover

---

## 13) Notes for Agents About the Current State

The user has experienced:
- blank city caused by `isoRenderer.js` syntax errors (braces/method nesting, duplicate const)
- road markings that “don’t make sense”
- graph view that is too chunky and aesthetically crude
- graph canvas occasionally disappearing when nodes are dragged outside the modal bounds (likely modal click handling / canvas resize timing)

Therefore:
- prioritize correctness and stability before further polish
- make changes incremental and verifiable with the test checklist

---

## 15) Recent Quirks / Lessons Learned

### Graph modal disappearance
- Dragging a node outside the modal bounds can close the modal or leave the modal open with an empty graph.
- Likely causes: modal click-to-close handler firing on outside clicks; vis-network canvas size desync after pointer leaves modal; aggressive auto-fit/resize.
- Mitigations currently in place:
  - Stop propagation on the modal card (prevents accidental close).
  - Keep-alive redraw + resize sync while modal is open (periodic `network.redraw()` and `network.setSize()` calls).
  - Avoid auto-fit/auto-move calls that can push graph out of view.

### Canvas layout shifts
- Opening/closing modals can trigger `resize()` and shift the world if camera offsets are not preserved.
- Current fix: `IsoRenderer.resize(preserveCamera=true)` keeps the camera aligned by adjusting offsets based on origin changes.

### Building metadata
- Building Details modal supports name/description/tasks; ensure a building is selected or a fallback is chosen.
- Task UI writes directly to the building object; persistence beyond session still requires Save/Load.

---

## 14) Agent Deliverable Expectations

When you implement changes:
- provide explicit patch instructions (file + exact blocks)
- avoid vague directions
- keep code style consistent with existing modules
- do not introduce a build system unless requested

If you add new files:
- document them in README and update this AGENTS.md.

---

## 13) Technical Approaches for Roadmap Elements

This section provides concrete implementation approaches for major roadmap items. It is written to help an automated agent choose incremental changes that fit the current architecture (native ES modules, Canvas renderer, minimal dependencies).

### 13.1 Spreadsheet “Model Editor” (editable coefficients)

**Goal:** Externalize and tune model parameters:
- globals: \(d_{\max}, \lambda, \theta\), bounds
- base contributions \(\mathbf{b}_c\)
- pairwise coefficients \(\mathbf{K}_{c,u}\) (per metric)
- optional piecewise rules (radius penalties, coverage requirements)

**Recommended architecture**
- Add a new module `js/model.js` responsible for:
  - holding the active model object
  - validation + normalization (clamps, defaults)
  - serialization (JSON export/import)
  - persistence (localStorage)
- Modify `metrics.js` to consume `Model.get()` rather than hard-coded constants.
- Modify `graphView.js` edge generation to read thresholds from the model.

**UI options**
1) **Minimal custom editable table (recommended first):**
   - A `<table>` with `contenteditable` numeric cells + `<select>` for categories.
   - Pros: no dependency, easy to iterate, predictable.
   - Cons: more manual work for copy/paste and selection behavior.
2) **Grid library (optional):**
   - Tabulator (MIT) or similar lightweight grid.
   - Pros: sorting, editing, validation, CSV.
   - Cons: dependency weight and integration complexity.

**Data model suggestion**
- `model.globals`: `{ lambda, dMax, theta, bounds }`
- `model.base[category] = { I, H, W }`
- `model.pairwise[metric][target][source] = number`
- `model.rules[] = { type, src, dst, radius, magnitude, enabled }`

**Live-apply strategy**
- Apply edits on a short debounce (e.g., 150–250ms).
- After apply:
  - recompute building activeness
  - recompute metrics
  - if graph modal is open, update Cytoscape elements/styles

**Validation**
- Numeric parsing with fallback to last known good value.
- Enforce ranges for stability (e.g., \(\lambda>0\), \(0\le\theta\le1\)).
- Reject NaN and Infinity.

---

### 13.2 Save/Load and Scenario Management

**Goal:** Persist city + model + optional timeline.

**Incremental approach**
- Create `js/storage.js`:
  - `save(state, model)` → localStorage JSON
  - `load()` → validates + merges with defaults
  - `exportToFile()` → download JSON
  - `importFromFile(file)` → parse + validate

**State serialization**
- Prefer explicit, stable forms:
  - grid roads as list of coordinates or a bitset string
  - buildings as array of objects with stable ids
  - model as separate object
- Avoid storing derived data (road graphs, cached distances). Recompute on load.

**Scenarios**
- `scenarios[]` can be a list of snapshots with labels and timestamps.
- Support “branching” by cloning current state into a new scenario.

---

### 13.3 Kanban View (status-driven planning)

**Goal:** Represent the same building/task objects as cards in a Kanban board, with edits syncing back into the city.

**Core data**
- Extend building objects with:
  - `title`, `notes`
  - `status` (Backlog/Active/Blocked/Done)
  - optional `tags`, `priority`

**UI implementation**
- Add `js/kanbanView.js` that renders into a modal or side panel.
- Use native drag/drop:
  - `dragstart` stores building id
  - `drop` assigns new status
- Keep rendering simple:
  - columns are status buckets
  - cards are buildings (click → select/center in city)

**Sync rules**
- Kanban edits update the canonical building object in `state.buildings`.
- The isometric view can display subtle status accents (optional later).
- Recompute metrics only if status changes should affect activity (optional; initial version can treat status as metadata only).

**Persistence**
- Include kanban metadata in save/load JSON.

---

### 13.4 Gantt View (time-based planning)

**Goal:** Provide a timeline representation where buildings/tasks have dates and dependencies; editing updates the underlying objects.

**Core data**
- Extend buildings with:
  - `startDate`, `dueDate`, `doneDate` (ISO strings)
  - `progress` (0..1) optional
  - `deps[]` explicit dependencies (ids)

**Implementation options**
1) **Minimal custom Gantt (recommended first):**
   - Render a timeline grid in HTML/CSS
   - Bars as absolutely positioned divs
   - Drag handles adjust start/end (snap to days)
2) **Library (optional later):**
   - A lightweight open-source Gantt component if needed, but avoid heavy deps early.

**Dependency mapping**
- Option A: explicit `deps[]` edited in the UI
- Option B: infer deps from road connectivity (not always semantically correct)
- Recommendation: start explicit, later offer “suggest deps from roads”.

**Sync**
- When dates change, update building objects and persist.
- Consider “schedule pressure” as an optional future metric modifier (not required at first).

---

### 13.5 Graph View Refinement (Obsidian-like aesthetics)

**Goal:** Technical, refined graph with curved thin edges, subtle depth, tooltips, and brief physics “reheat”.

**Cytoscape techniques**
- Edge styling:
  - `curve-style: bezier`
  - `width: mapData(weight, min, max, 0.5, 2.0)`
  - `opacity: mapData(weight, ..., 0.15, 0.75)`
- Node styling:
  - smaller nodes
  - neutral palette, subtle glow
  - hide labels by default; show on hover/selection
- Tooltip:
  - an absolutely positioned div in the modal
  - events: `mouseover`, `mouseout`, `mousemove`
- Jiggle:
  - on `dragfree`, run a short `cose` layout with `animate: true`
  - stop after ~600–900ms
  - avoid continuous layout for stability

**Hairball control**
- Raise threshold \(\theta\) or cap edges per node (top-N by weight).
- Prefer sparse edge lists for LLM summaries and for readability.

---

### 13.6 LLM Advisor Panel (multi-persona “advisors”)

**Goal:** A persistent dialog panel that:
- understands the city-as-life metaphor
- suggests both model adjustments and real-world actions
- supports multiple personas (Income/Happiness/Wellness/Moderator)

**Recommended integration design**
- Add `js/advisors/`:
  - `advisors.js` (controller: UI + message routing)
  - `prompts.js` (system + persona prompt templates)
  - `summarizeState.js` (LLM-friendly state serialization, sparse edges, attribution)
- Provide a single “context packet” builder:
  - globals, metrics, nodes, connectivity stats, sparse edges, attribution
  - stable ids and fixed precision floats

**Runtime modes**
- Local-only placeholder mode:
  - advisors generate deterministic heuristic tips (no external calls)
- External LLM mode (future):
  - define a minimal interface `callLLM({persona, messages, context})`
  - keep provider-specific code isolated
  - require explicit user consent before sending state externally

**Persona strategy**
- Persona prompt = stable instruction + objective + formatting constraints.
- Moderator persona should request the other personas’ summaries and reconcile.

**UX notes**
- Advisors should be compact, persistent, and non-intrusive.
- Support:
  - per-persona toggle/mute
  - “notify only on significant metric shifts”
  - action buttons that translate recommendations into in-game operations (later)

---

### 13.7 Asset Quality Improvements (icons and visuals)

**Goal:** Replace placeholder visuals with a coherent, serious aesthetic.

**Incremental approach**
- Keep Canvas isometric prism rendering for buildings but:
  - add a consistent icon set (SVG) rendered onto top faces
  - maintain a neutral, professional palette
- For graph nodes:
  - use simple vector glyphs (SVG) with subtle gradients
  - avoid emoji tiles and harsh outlines

**Implementation notes**
- Preload SVGs into `Image()` objects or inline as data URIs.
- Cache rendered icon canvases per type+size to reduce draw cost.

---

### 13.8 Extending the Simulation (without instability)

**Guidelines**
- Keep the model bounded:
  - clamp Happiness/Wellness
  - avoid runaway positive feedback loops
- Add features as optional terms that can be disabled in the Model Editor.
- Provide attribution for changes (top contributors) to support explainability and advisor quality.

