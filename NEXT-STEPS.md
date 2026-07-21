# CityLife Next Steps

Status: **Persistent Commitments MVP implemented and verified**  
Last reviewed: 2026-07-21

## Implementation outcome

The plan below was written and reviewed before implementation. The Persistent Commitments MVP is now shipped in the working tree with these scope decisions:

- quick capture goes directly to categorized placement; there is no separate inbox yet
- Done remains visible and metric-active because workflow status is metadata only
- one-level in-memory Undo covers edits, placement, movement, roads, bulldozing, import, and reset
- Vitest provides focused domain and persistence coverage
- the existing symmetric road-influence model remains unchanged

All milestone acceptance criteria are complete except the deliberately deferred split between base category effects and relationship effects in every presentation. The UI instead exposes each activity's aggregate signed contribution plus signed relationship deltas. Automated browser component/end-to-end coverage also remains deferred; desktop and phone-sized workflows were verified manually.

The unchecked boxes in Sections 6 and 7 preserve the original pre-implementation checklist; completed milestone evidence is recorded in Section 11.

## 1. Purpose

At the time this plan was written, CityLife already demonstrated its distinctive simulation idea: buildings became life-domain nodes, roads activated them, road distance changed their influence, and the result was summarized as Income, Happiness, and Wellness.

The then-active `/citylife` runtime did not complete the life-planning workflow described by the project material. It was best understood as a spatial simulation demo: a user could arrange generic categories and observe scores, but could not turn those buildings into durable, personal commitments and return to the plan later.

The milestone therefore aimed to make CityLife useful as a small, local-first planning tool before adding more simulation depth, art, AI, or secondary views.

This plan defines that milestone, its implementation sequence, its boundaries, and its acceptance criteria.

## 2. Historical Baseline (Before Implementation)

### Working at plan creation

- `/citylife` route running inside the IsoCity Next.js application
- starter layout
- category tools for houses, schools, offices, factories, hospitals, malls, and parks
- road placement and bulldozing
- road-adjacency activation
- shortest-path distance over road and bridge tiles
- Income, Happiness, and Wellness calculations
- influence summary
- interactive relationship graph
- CityLife sprite mapping and category randomization
- unlimited budget, immediate construction, and utility bypass in CityLife mode

### Product-critical gaps identified at plan creation

1. **Plans are disposable.** CityLife disables engine persistence and reloads its starter state when mounted.
2. **Buildings are not personal activities.** They have no user title, notes, next action, status, priority, due date, or task checklist.
3. **Identity is positional.** The displayed fallback identity is derived from building type and coordinates, so it cannot reliably survive movement.
4. **There is no Move workflow.** Reorganizing a plan means deleting and recreating a building.
5. **The feedback is only partly explained.** Attribution data is calculated but not shown, while edge metric deltas are omitted from the visible graph and summary.
6. **Base IsoCity concepts leak into CityLife.** Selection can show zoning, population, jobs, utilities, and upgrades that do not describe the planning model.
7. **The small-screen layout is not viable.** The current mobile layout can collapse the canvas below the tool panel.
8. **Mode isolation is incomplete.** A global single-tile footprint switch and sprite-pack-based mapping can affect base IsoCity behavior.
9. **There is no automated CityLife test suite.** The core graph and persistence rules have no regression coverage.

## 3. Target Milestone: Persistent Commitments MVP

The milestone should support one complete user story:

> I capture “Prepare quarterly taxes,” represent it as a work activity, add “Download bank statements” as its next action, connect it to the rest of my plan, understand its effect on my balance, move it without losing information, reload the app the next day, and find the complete plan intact.

The corresponding product loop is:

1. **Capture** a real commitment.
2. **Construct** it as a categorized building.
3. **Connect** it with access/support roads.
4. **Clarify** its next action and readiness.
5. **Inspect** why it changes the balance metrics.
6. **Commit** by setting its status and task checklist.
7. **Return** later to the same saved plan.

## 4. Product Semantics to Lock Before Expansion

These decisions prevent the interface and documentation from implying behavior the model does not have.

### 4.1 Roads mean access and support pathways

Roads are currently undirected. They express activation, accessibility, proximity, and influence distance. They do **not** encode ordered prerequisites such as “A must finish before B.”

The MVP should use terms such as “connected,” “access,” and “support pathway.” Directed dependencies should be introduced later as explicit data rather than inferred from road geometry.

### 4.2 Readiness has more than one level

The UI should distinguish:

- **Needs road:** the building is not orthogonally adjacent to a road or bridge tile.
- **Road active but isolated:** it touches a road, but has no meaningful relationship to another activity through the road graph.
- **Connected:** it is road active and participates in at least one retained influence relationship.
- **Blocked:** a user-assigned workflow status; separate from road connectivity.
- **Done:** a user-assigned workflow status; initially metadata only.

Road adjacency remains the metric activation invariant. Workflow status should not silently change metric calculations in this milestone.

### 4.3 Metrics are planning signals

Income, Happiness, and Wellness are model outputs for comparing scenarios. They are not forecasts, diagnoses, or precise measurements. The interface should say this wherever score explanations are shown.

### 4.4 Local-first storage

The MVP stores the CityLife document in the current browser only. It should not require an account, Supabase, or an external service. JSON export/import provides portability and backup.

### 4.5 CityLife and IsoCity must remain separate modes

CityLife behavior must be explicitly mode-gated. A CityLife fix must not change building footprints, sprite selection, budget rules, persistence, or inspectors on `/`.

## 5. Proposed Data Model

### 5.1 Stable activity metadata

Each CityLife building should carry optional CityLife-only metadata while the base engine ignores it:

```ts
type CityLifeNodeStatus = 'backlog' | 'active' | 'blocked' | 'done';
type CityLifeNodePriority = 'low' | 'medium' | 'high';

interface CityLifeTask {
  id: string;
  text: string;
  done: boolean;
}

interface CityLifeNodeMetadata {
  id: string;             // Stable generated ID; independent of building type and position
  title: string;
  notes: string;
  nextAction: string;
  status: CityLifeNodeStatus;
  priority: CityLifeNodePriority;
  dueDate?: string;       // YYYY-MM-DD
  tasks: CityLifeTask[];
  createdAt: number;
  updatedAt: number;
}
```

Requirements:

- `id` remains unchanged when a building moves.
- metadata is removed when the building is intentionally deleted.
- imported legacy CityLife states receive generated IDs and safe defaults.
- user text is length-limited and treated as plain text.
- category remains derived from the building type in the first milestone.

### 5.2 Versioned CityLife document

CityLife should use its own storage namespace rather than the base IsoCity save key:

```ts
interface CityLifeDocument {
  format: 'citylife-workspace';
  version: 1;
  savedAt: number;
  state: GameState;
}
```

The delivered version-1 envelope intentionally omits separate `project` and `inbox` fields. Workspace identity lives in `state.id`, and quick capture proceeds directly to categorized placement. A multi-project index or independent inbox remains deferred and should be introduced only through a future document-version migration.

Validation requirements:

- reject unknown future versions with a useful message
- accept the current version and a validated raw CityLife `GameState` for migration
- verify CityLife mode, grid size, square grid shape, essential statistics, and building objects
- never overwrite the current saved plan until an imported document validates
- ignore derived caches and recompute the CityLife snapshot after load

## 6. Implementation Phases

### Phase 0 — Establish a safe baseline

Goal: know what was already broken and avoid attributing unrelated worktree changes to this milestone.

- [ ] Record `git status` and preserve unrelated user changes.
- [ ] Run the current targeted lint, full lint, and production build before implementation.
- [ ] Record existing failures separately from failures introduced by CityLife changes.
- [ ] Confirm `/` and `/citylife` both load before changing mode seams.
- [ ] Confirm whether a test runner will be added with Vitest or another repository-appropriate TypeScript runner.

Exit criteria:

- baseline results are recorded
- unrelated modified files are not touched
- the intended files and mode boundaries are known

### Phase 1 — Stable, editable commitments

Goal: turn generic buildings into real planning objects.

- [ ] Add the optional metadata types.
- [ ] Generate metadata whenever a CityLife category tool successfully places a building.
- [ ] Migrate starter and imported legacy buildings to stable IDs.
- [ ] Give the starter example meaningful titles and next actions so it demonstrates the product rather than only the simulation.
- [ ] Make snapshot nodes and graph labels use the user title.
- [ ] Build a CityLife-specific editor with:
  - title
  - notes
  - next action
  - status
  - priority
  - optional due date
  - editable task checklist
- [ ] Preserve metadata through ordinary engine cloning and serialization.

Exit criteria:

- every CityLife building has a stable ID
- a user can edit and reopen all metadata
- graph and attribution labels reflect the user title
- base IsoCity building behavior is unchanged

### Phase 2 — CityLife persistence and document operations

Goal: make the plan durable and portable.

- [ ] Add a CityLife-specific, versioned local-storage adapter.
- [ ] Load the saved CityLife document before choosing a starter state.
- [ ] Show the starter only on first use or after an explicit reset.
- [ ] Offer a first-run choice between a blank plan and an example plan.
- [ ] Debounce autosave and expose `Saving`, `Saved`, and `Save failed` states.
- [ ] Flush the latest valid document when the page is being left where practical.
- [ ] Add JSON export with a predictable filename.
- [ ] Add validated JSON import with a non-destructive error path.
- [ ] Require confirmation before Reset.
- [ ] Keep this storage separate from the base IsoCity save system.

Exit criteria:

- a reload restores geometry, metadata, and stable IDs
- export/import round-trips the complete document
- invalid import leaves the current plan untouched
- first-run and reset behavior are explicit

### Phase 3 — Move and safe editing operations

Goal: make spatial experimentation preserve the planning object.

- [ ] Add a CityLife Move action.
- [ ] Use a clear two-step interaction on both mouse and touch:
  1. choose the activity
  2. choose an empty land destination
- [ ] Preserve ID and metadata on a successful move.
- [ ] Reject water, roads, occupied tiles, and out-of-bounds destinations without mutating state.
- [ ] Recompute road adjacency, relationships, and metrics immediately.
- [ ] Keep the moved activity selected.
- [ ] Provide Cancel and visible move instructions.
- [ ] Add at least one-level Undo for move and destructive removal, or require an explicit confirmation until Undo exists.

Exit criteria:

- moving never changes the stable ID
- invalid moves are non-destructive
- metrics and graph data update at the destination
- the interaction works with mouse and touch

### Phase 4 — Explainable balance

Goal: turn raw scores into actionable feedback.

- [ ] Show each selected activity’s total attributed Income, Happiness, and Wellness effect.
- [ ] Show its base category effect separately from relationship effects where practical.
- [ ] Expose the existing top positive and top negative contributors for each metric.
- [ ] Add signed `Δ Income`, `Δ Happiness`, and `Δ Wellness` values to relationship rows and graph edge details.
- [ ] Distinguish:
  - needs road
  - road active but isolated
  - connected through retained influence edges
- [ ] Explain distance in road steps and weight as exponential influence strength.
- [ ] State that the graph is sparse and may omit weak or zero-effect pairs.
- [ ] Label scores as comparative planning signals, not predictions.

Exit criteria:

- a user can answer “why did this score change?” without reading source code
- a selected activity shows both readiness and contribution
- graph labels and edge details use user-facing activity names

### Phase 5 — CityLife-specific interaction shell

Goal: remove misleading engine UI and make the canvas usable on small screens.

- [ ] Suppress the generic IsoCity tile inspector in CityLife.
- [ ] Suppress dollar-cost hints where CityLife does not deduct money.
- [ ] Replace leaked utility/zoning language with CityLife readiness language.
- [ ] Keep the canvas dominant on desktop.
- [ ] Use a collapsible drawer or compact toolbar on screens below the desktop breakpoint.
- [ ] Guarantee the canvas a non-zero `dvh`-based height.
- [ ] Keep metric cards, selection, Move, and editor controls keyboard accessible.
- [ ] Verify modal focus trapping, Escape close, and focus restoration.

Exit criteria:

- no irrelevant zone/power/water/upgrade panel appears in CityLife
- the city is visible and operable on a phone-sized viewport
- core actions are available without scrolling through the entire tool catalog

### Phase 6 — Repair mode isolation

Goal: preserve upstream IsoCity behavior while retaining CityLife’s simplified rules.

- [ ] Replace fragile route inference with an explicit mode value passed through the provider/context boundary.
- [ ] Use that mode for unlimited budget, instant completion, and utility bypass.
- [ ] Make one-tile footprints a CityLife placement/render decision rather than a global engine switch.
- [ ] Gate CityLife sprite overrides on CityLife mode in addition to sprite-pack ID.
- [ ] Retain normal IsoCity footprints and sprite selection on `/`.
- [ ] Document the remaining engine seams and why each one exists.

Exit criteria:

- selecting the modern sprite pack in IsoCity does not enable CityLife mappings
- multi-tile IsoCity buildings retain nominal footprints
- all CityLife invariants still pass

### Phase 7 — Tests, verification, and truthful documentation

Goal: finish with reproducible evidence and documentation that matches the runtime.

- [ ] Add a `test` script and focused CityLife tests.
- [ ] Test activation from orthogonal road/bridge adjacency.
- [ ] Test that diagonal roads do not activate a node.
- [ ] Test disconnected road components and shortest-path distance.
- [ ] Test distance cap, threshold, and signed pair effects.
- [ ] Test metadata migration and stable IDs.
- [ ] Test successful and rejected moves.
- [ ] Test storage round-trip, malformed JSON, wrong mode, and unsupported versions.
- [ ] Test that Reset and failed Import cannot silently destroy the current plan.
- [ ] Run targeted lint on every touched file.
- [ ] Run full lint and distinguish pre-existing failures from new ones.
- [ ] Run the production build.
- [ ] Manually execute the desktop and mobile acceptance paths.
- [ ] Update README, Architecture, and agent guidance to describe only delivered behavior.

Exit criteria:

- new tests pass
- production build passes
- touched files have no new lint violations
- documentation no longer mixes archived prototype features with active runtime features

## 7. Planned File Boundaries

The exact names may change during implementation, but responsibilities should remain separated.

### CityLife domain and persistence

- `isometric-city/src/lib/citylife.ts`
  - category rules
  - activation and graph snapshot
  - pure CityLife placement/move/update commands, unless split further
- `isometric-city/src/lib/citylifeDocument.ts`
  - versioned document schema
  - validation and migration
- `isometric-city/src/lib/citylifeStorage.ts`
  - browser storage only
  - no simulation logic
- canonical engine types
  - only the smallest optional CityLife metadata/mode seam needed for serialization

### CityLife UI

- `isometric-city/src/components/citylife/CityLifeMode.tsx`
  - composition and workflow state
  - should not accumulate document validation or graph algorithms
- `CityLifeNodeEditor.tsx`
  - commitment metadata editor
- `CityLifeInsightsPanel.tsx`
  - attribution and relationship explanations
- `CityLifeOnboarding.tsx`
  - blank/example first-run choice
- optional `CityLifePlanBoard.tsx`
  - deferred until the core map workflow is durable

### Engine seams

- `GameContext.tsx`
  - explicit mode and minimal state command hooks
- `simulation.ts`
  - mode-scoped placement/construction/utility rules
- `CanvasIsometricGrid.tsx`
  - mode-aware generic inspector and interaction behavior
- `buildingSprite.ts` / `citylifeSpriteMapping.ts`
  - explicit CityLife mapping gate

## 8. Verification Matrix

| Area | Scenario | Expected result |
|---|---|---|
| First run | Choose blank | Empty grass plan loads and becomes the saved document |
| First run | Choose example | Named example activities and roads load once |
| Editing | Rename an Office | Selected-activity card, graph, and attribution use the new title |
| Tasks | Add and complete a checklist item | State persists after closing and reloading |
| Readiness | Place beside no road | Activity reports Needs road and has no contribution |
| Readiness | Add one adjacent road tile | Activity becomes road active |
| Connectivity | Leave that road isolated | UI distinguishes active-but-isolated from connected |
| Connectivity | Join two road-adjacent nodes | BFS relationship and metric delta appear |
| Move | Move a named node | ID and metadata remain identical; position changes and scores/relationships are recalculated |
| Move | Target water/road/building | Operation fails without altering either tile |
| Delete | Remove a named node | Confirmation/Undo path is available and metadata is not orphaned |
| Persistence | Reload | Full plan reappears |
| Export | Export then import | Geometry, activity metadata, and stable IDs round-trip |
| Import | Invalid JSON | Current plan remains loaded and an error is shown |
| Reset | Cancel confirmation | No state changes |
| Mobile | 390 × 844 viewport | Canvas remains visible and all core actions are reachable |
| Isolation | Open `/` | Normal IsoCity inspector, costs, sprite rules, and footprints remain intact |

## 9. Risks and Mitigations

### State replacement through JSON is too heavy

Repeatedly calling the current generic `loadState(JSON.stringify(...))` for small edits would reset transient engine systems and serialize the full grid. Add a narrow state-update/command seam instead of using serialization as an internal command bus.

### Autosave overwrites a good document with an initializing state

Use an explicit hydration phase. Autosave must remain disabled until a saved document, blank plan, or example plan has been fully loaded and validated.

### Metadata is lost during simulation cloning

Audit every building-construction and clone path that replaces a `Building` object. Add regression tests proving that normal state updates preserve the optional CityLife metadata.

### Move becomes delete-then-place and loses identity

Treat Move as one atomic command. Validate the destination first, then create the next state while transferring the same metadata object/ID.

### New mode checks spread through the engine

Introduce one explicit mode seam and small helpers. Avoid adding more `cityName === 'CityLife'` checks.

### Documentation outruns the implementation again

Keep an Implemented / Partial / Planned status table in the README. Update it only when acceptance criteria pass.

## 10. Deferred Work

The following ideas remain valuable, but should not precede the Persistent Commitments MVP:

- spreadsheet-style model editor and user-tunable coefficients
- Kanban and Gantt views
- explicit directed dependencies
- recurring activities and calendar integration
- weekly effort/capacity budgeting
- maintenance, time logging, decay, and recovery
- scenario branching and comparison
- long-term metric history and sparklines
- heuristic or LLM advisors
- cloud sync and collaboration
- graph library bundling/offline support
- additional sprite packs and asset-pipeline expansion

These features depend on a stable activity identity, document schema, and persistence layer. Building those foundations first prevents each future view from inventing a separate source of truth.

## 11. Definition of Done for the Milestone

The Persistent Commitments MVP is complete only when all of the following are true:

- [x] A user can create, title, edit, move, and remove a CityLife activity.
- [x] A moved activity retains its ID, notes, status, next action, due date, and tasks.
- [x] A reload restores the complete plan.
- [x] JSON export/import round-trips the complete plan.
- [x] Invalid imports and cancelled resets are non-destructive.
- [x] Metric totals have visible positive/negative attribution.
- [x] Relationship details include signed metric deltas.
- [x] Readiness distinguishes road adjacency from useful network relationships.
- [x] Generic IsoCity details do not appear in CityLife.
- [x] The core workflow works at desktop and mobile viewport sizes.
- [x] Base IsoCity behavior is unchanged.
- [x] Focused automated tests pass.
- [x] Production build passes.
- [x] README and Architecture describe the delivered behavior accurately.

## 12. Resolved Implementation Gate

These questions were resolved as follows before and during implementation:

1. begin with direct categorized placement after quick capture;
2. keep Done activities visible and metric-active;
3. include one-level Undo immediately;
4. introduce Vitest as a development dependency;
5. keep the symmetric influence model fixed until later model-editor work.

The detailed phase checklists above are retained as the original implementation record. The user-facing README and architecture document are the source of truth for current behavior.
