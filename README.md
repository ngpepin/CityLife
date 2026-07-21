# CityLife

CityLife is a local-first life-planning tool built as an isometric city. Commitments and support systems become buildings, roads represent access and support pathways, and the current arrangement is summarized as **Income**, **Happiness**, and **Wellness**.

The primary product is the Next.js route at **`/citylife`**. The standard IsoCity game at `/`, the IsoCoaster route, and the plain-HTML prototype are supporting or archived material—not alternate CityLife runtimes.

CityLife's scores are simplified planning signals for comparing arrangements. They are not predictions, diagnoses, or judgments about what a user should do.

## What works today

The current `/citylife` implementation supports a complete local planning loop:

- first-run onboarding with an example plan, a blank plan, or JSON import
- quick capture of a named activity followed by placement on the city grid
- editable activity details: title, status, priority, due date, next action, notes, and task checklist
- stable activity identity and metadata when a building moves
- road placement, direct category placement, selection, movement, bulldozing, and one-step undo
- automatic browser-local saving plus versioned JSON export and import
- confirmed reset to the example plan
- Income, Happiness, and Wellness cards that open an attribution view
- readiness explanations for road-active, road-missing, and road-active-but-isolated activities
- strongest relationship rows with road distance, weight, and signed metric effects
- an interactive relationship graph
- responsive tool access on smaller screens

CityLife uses the rendering and placement systems in the `isometric-city/` engine, but it bypasses normal zoning, utility, construction-time, and budget restrictions for CityLife activities.

## Prerequisites

- Node.js **20.9 or newer** (required by the installed Next.js version)
- npm
- a modern browser with JavaScript and `localStorage` enabled

## Quick start

From the repository root:

```bash
git clone https://github.com/ngpepin/CityLife.git
cd CityLife
./run_citylife.sh dev
```

Open [http://localhost:3000/citylife](http://localhost:3000/citylife).

The root launcher installs dependencies when `node_modules/` is missing and then starts the app from `isometric-city/`. Its explicit modes are:

```bash
./run_citylife.sh dev
./run_citylife.sh build
./run_citylife.sh prod
```

Calling the launcher without a mode defaults to `prod`, which builds before starting.

To work directly in the app subtree instead:

```bash
cd isometric-city
npm ci
npm run dev
```

Useful routes:

| Route | Purpose |
| --- | --- |
| `/citylife` | Primary CityLife planning product |
| `/` | Base IsoCity city-building mode |
| `/coaster` | Base IsoCoaster mode |

## First planning loop

1. On the first visit, choose **Explore an example**, **Start with a blank city**, or **Import a workspace**. A valid saved workspace loads automatically on later visits.
2. In **Quick capture**, name an activity, choose its category, and select **Place**.
3. Click an empty land tile. CityLife creates the activity and opens its editor.
4. Add a next action, status, priority, due date, notes, or checklist items.
5. Add roads next to the activity. Orthogonal road adjacency makes it active in the scoring model.
6. Select an activity to inspect its readiness and score contribution.
7. Use **Move** and choose an empty destination. The title, stable ID, and other details move with it.
8. Select a score card or **Why these scores?** to inspect attribution and relationship effects.

The **Build directly** tools skip quick capture and place a category variant with default metadata. Select the resulting building and choose **Edit details** to personalize it.

### Actions and data safety

- **Undo** restores one previous in-memory plan state. There is no redo, and undo history does not survive a reload.
- **Bulldoze** removes the road or activity you click without an additional confirmation.
- **Reset example** asks for confirmation and replaces the current plan with the example plan. The immediately preceding state can normally be restored with Undo.
- **Export JSON** attempts to save the current plan locally, then downloads a portable plaintext backup even when browser storage is unavailable.
- **Import JSON** accepts CityLife exports up to 15 MB, validates the workspace, migrates legacy activity metadata where possible, and replaces the current plan.

Export before clearing browser site data or making a destructive change you may want to revisit.

## How the model works

### Readiness

- **Needs road:** the activity is not orthogonally adjacent to a road or bridge and does not contribute.
- **Road active, but isolated:** the activity contributes its category's base effect but has no qualifying relationship with another activity.
- **Connected:** the activity is road-active and participates in at least one retained relationship.

The user-assigned workflow statuses—Backlog, Active, Blocked, and Done—are metadata only. They do not currently change road readiness or scores.

### Relationships and scores

For each pair of road-active activities, CityLife finds the shortest path between their adjacent-road sets using breadth-first search over road and bridge tiles. Influence decays exponentially with road distance and is discarded beyond the configured distance or below the configured threshold.

The implementation uses:

- maximum road distance: `18`
- decay constant: `6`
- edge threshold: `0.08`
- score baseline: Income `5`, Happiness `50`, Wellness `50`
- output bounds: `0` to `100`

Category base effects and qualifying pair effects are added to the baseline. A relationship is retained only when its category pair has a modeled non-zero effect. Full details are in [ARCHITECTURE.md](ARCHITECTURE.md).

Roads currently represent undirected access and support pathways. They do not encode ordered prerequisites such as “finish A before B.”

## Saving and portability

CityLife has its own persistence layer, separate from the base IsoCity save system:

- one workspace is autosaved for the current browser origin under `citylife-workspace-v1`
- saves are debounced after plan changes and attempted again before the page unloads
- exported files use the `citylife-workspace` envelope at version `1`
- legacy raw CityLife game-state JSON can also be imported when it passes validation
- clearing site data, using a private browsing session, or changing browser profiles can remove or isolate the local workspace

There is no CityLife account, cloud synchronization, or multi-device merge.

## Development and verification

Run app commands from `isometric-city/`:

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

`npm test` runs the focused Vitest domain/storage suite. It covers road gating and distance, bridge connectivity, symmetric relationship effects, successful and rejected moves, workspace round trips, migration, local storage, and malformed import rejection. It does not cover browser interaction or end-to-end rendering.

The full app-subtree lint command currently exits non-zero on existing findings in older engine and coaster files; use its output to distinguish those from changes in the files you touch. `npm run build` runs the image-compression script before the Next.js build and can generate updated WebP assets.

For a CityLife smoke test, verify at least:

- onboarding appears only when no valid local workspace exists
- capture, edit, task checklist, move, bulldoze, and one-step undo work
- reload restores the locally saved plan
- export/import round-trips activity metadata and positions
- road adjacency and road topology update readiness, scores, and relationships
- reset requires confirmation
- `/` still loads the base IsoCity mode with its canonical multi-tile footprints, costs, and tile details

The repository's coding invariants and broader manual checklist are in [AGENTS.md](AGENTS.md).

## Repository map

| Path | Role |
| --- | --- |
| `isometric-city/` | Active Next.js runtime containing CityLife and the base engine modes |
| `citylife-config/citylifeSpriteMapping.json` | Root-owned CityLife sprite-mapping source of truth |
| `run_citylife.sh` | Root launcher for development, build, and production |
| `paper/` | Conceptual and research material; it is not a shipped-feature specification |
| `old-approach/` | Documentation from the retired plain-HTML prototype |
| `index.html`, `js/`, `styles.css` | Historical prototype runtime; not the active app |
| `assets/`, `tools/` | Source art and asset-generation utilities |

Documentation:

- [Architecture and data flow](ARCHITECTURE.md)
- [Engine-subtree guide](isometric-city/README.md)
- [Agent handoff and invariants](AGENTS.md)
- [Concept paper](paper/Paper_draft.md)
- [Archived prototype documentation](old-approach/README.md)
- [Earlier implementation plan](NEXT-STEPS.md)—useful design context, but its “current gaps” section predates the implemented persistent-commitments work

## Sprite mapping source of truth

Edit only:

- `citylife-config/citylifeSpriteMapping.json`

The app imports a generated copy at `isometric-city/src/config/citylifeSpriteMapping.json`. The sync script `isometric-city/scripts/sync-citylife-config.mjs` copies the root file before `dev`, `build`, and `start` through npm lifecycle hooks.

The JSON controls sprite sheets, building-type-to-art groups, and sprite coordinates. It does **not** control CityLife's semantic categories, tool variants, or metric coefficients; those remain in `isometric-city/src/lib/citylife.ts`.

## Privacy and network behavior

- Activity details and the CityLife workspace are stored in browser `localStorage`; the CityLife storage module does not send the workspace to Supabase or another CityLife backend.
- JSON exports are unencrypted plaintext and may contain personal titles, notes, due dates, next actions, and tasks.
- The shared app layout includes Vercel Analytics.
- Opening **Relationship graph** loads `vis-network` from `unpkg.com`; that view therefore requires network access unless the dependency is changed or locally hosted.

Do not treat the current deployed app as fully offline or as a repository for highly sensitive information without reviewing the hosting and analytics configuration.

## Current limitations

- Scores are heuristic scenario-comparison signals; personal metadata and task completion do not calibrate them.
- Roads encode undirected access and influence, not directed dependencies.
- Only one browser-local CityLife workspace is managed at a time.
- Undo is one step and in-memory only.
- There is no cloud sync, account system, model editor, Kanban/Gantt view, maintenance/decay loop, or LLM advisor in `/citylife`.
- The relationship graph depends on a third-party CDN and displays a sparse subset of the strongest edges.
- Automated coverage currently focuses on domain and storage logic; browser component and full end-to-end tests are not configured.
- CityLife and IsoCity still share placement, simulation, and rendering code, so changes at those seams require both routes to be regression-tested.

## Licensing

Licensing differs by subtree:

- [LICENSE.md](LICENSE.md) contains the repository-root PolyForm Noncommercial terms.
- [isometric-city/LICENSE](isometric-city/LICENSE) contains the MIT license and upstream copyright notice for the engine subtree.

Review both files before redistribution, especially when combining root project material with the engine subtree.
