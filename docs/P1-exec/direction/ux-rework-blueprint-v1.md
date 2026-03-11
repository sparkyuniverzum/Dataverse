# UX Rework Blueprint v1

Status: active (official blueprint)
Date: 2026-03-10
Owner: Product UX + Core FE/BE architecture
Depends on:
- `docs/P0-core/contracts/canonical-ux-ontology-v1.md`
- `docs/P1-exec/direction/planet-civilization-domain-canonical-v1.md`
- `docs/P0-core/contracts/galaxy-workspace-contract-v1.md`
- `docs/P0-core/contracts/semantic-constitution-v1.md`
- `docs/P0-core/contracts/star-physics-laws-v2.md`
- `docs/P0-core/contracts/planet-builder-mvp-v2.md`
- `docs/P1-exec/direction/planet-civilization-delivery-canonical-v1.md`
- `docs/P0-core/release/planet-civilization-operations-canonical-v1.md`

## 1. What changed

This document consolidates the full UX rework direction into one official blueprint:
1. implementation prime directive,
2. product ontology and interaction baseline,
3. law and physics model,
4. workspace surfaces and lifecycle model,
5. language and end-to-end journey baseline,
6. visual and layout system direction,
7. rollout roadmap and implementation slices.

## 2. Why it changed

The product currently has high technical capability but weak experience coherence.
Core value exists in parser, runtime, branching, projection, and governance, but the user experience does not yet convert that capability into a clear, powerful operating model.

This blueprint exists to make UX the primary driver of implementation decisions without violating system laws, runtime determinism, or compatibility constraints.

## 3. Implementation Prime Directive

User experience is the primary implementation criterion.

Hard rules:
1. If the system is technically strong but the experience is weak, the product fails.
2. If the experience is strong, clear, and trustworthy, the product can carry substantial perceived value even while some non-critical internal areas continue to mature.
3. Prefer the most modern solution when it improves:
   - clarity
   - speed of work
   - trust
   - explainability
   - continuity
4. Technical elegance is a means, not the goal.
5. Parser, grid, canvas, timeline, branch, compare, and governance must be implemented as one experience system, not as isolated feature islands.

## 4. Canonical product center

Dataverse is a system for understanding, designing, changing, and comparing workspace reality over time.

The product revolves around this chain:
`Scope -> Surface -> Intent -> Draft -> Preview -> Commit -> Sync -> Timeline -> Compare -> Time Travel -> Promote`

## 5. Ontology baseline

This blueprint inherits the canonical ontology from `canonical-ux-ontology-v1.md`.

Non-negotiable ontology:
1. Galaxy = workspace boundary
2. Star = law/governance layer
3. Planet = structural table/data carrier
4. Moon = capability module
5. Civilization = row instance
6. Mineral = typed value inside civilization
7. Bond = relation between civilizations
8. Branch = isolated timeline workspace
9. Star Core = governance/runtime control plane

Non-negotiable semantic rule:
`Moon capability != Civilization row`

## 6. Law and physics baseline

This blueprint inherits system-law constraints from:
- `semantic-constitution-v1.md`
- `star-physics-laws-v2.md`
- `planet-builder-mvp-v2.md`

Mandatory UX implications:
1. soft-delete only
2. event causality must remain explainable
3. grid and 3D must not drift
4. branch and main must remain isolated
5. contract validation must remain visible and actionable
6. physical profile and planet runtime state must remain deterministic
7. FE presentation may interpolate but may not redefine backend truth

## 7. Workspace surface baseline

The official workspace surface set is:
1. Galaxy Gate
2. Main Workspace Shell
3. Planet Structure Mode
4. Civilization Operations Mode
5. Parser Composer Mode
6. Branch Review Mode
7. Time Travel / Compare Mode
8. Star Core Governance Mode
9. Recovery / Repair Mode

Each surface must map back to the same ontology and shared state model.

## 8. Shared lifecycle baseline

The official lifecycle chain is:
1. Selection
2. Draft
3. Preview
4. Commit
5. Recovery
6. Branch
7. Sync / Offline
8. Historical inspect

Mandatory rules:
1. selection != edit mode
2. draft != committed truth
3. preview != committed truth
4. branch != time travel
5. historical mode = inspect-only
6. every meaningful failure must have explainability and repair path

## 9. State navigation baseline

The system uses these truths:
1. Grid = precise state truth
2. Parser = intent truth
3. Canvas = topology and physics truth
4. Inspector = meaning truth
5. Timeline = causal truth
6. Branch = alternate editable truth
7. Time Travel = historical inspect truth
8. Compare = diff truth
9. Promote = reality transfer

## 10. Language contract baseline

Primary UX language for new work:
- Galaxy
- Star
- Planet
- Civilization
- Mineral
- Bond
- Branch
- Star Core

Controlled use of `moon`:
1. capability surfaces,
2. explicit alias explanation,
3. frozen legacy contexts only.

Forbidden ambiguity:
UX must not use `moon` as an unqualified synonym for row instance in new flows.

## 11. Visual system baseline

The official visual direction is:
1. the product must feel like an operating center, not a generic SaaS dashboard,
2. visuals must carry meaning,
3. colors must encode state,
4. typography must distinguish identity, work, data, and system layers,
5. motion must explain state change, not decorate,
6. physics visuals must remain explainable,
7. draft, preview, committed, branch, historical, governance, blocked, and degraded states must be visually distinct.

## 12. Layout baseline

The official shell hierarchy is:
1. top system bar
2. left navigator
3. main work surface
4. right inspector / draft rail
5. bottom timeline
6. dedicated governance layer

Mandatory layout rules:
1. main work zone must remain primary
2. inspector and draft must remain distinct
3. parser must remain readily available but must expand into a full composer mode when needed
4. branch, historical mode, and sync state must remain visible
5. overlays, modals, and drawers must follow strict roles

## 13. End-to-end journey baseline

The official journey set is:
1. First Entry
2. First Useful Success
3. Create Planet
4. Attach Capability
5. Create Civilization
6. Edit Mineral
7. Link Bond
8. Branch Experiment
9. Review and Promote
10. Repair Blocked State
11. Work Under Offline or Runtime Problems

These journeys are the primary UX validation set for future implementation blocks.

## 14. Rollout roadmap

Official rollout waves:
1. Terminology and state contract alignment
2. Shell state unification
3. Selection / inspector / draft separation
4. Parser elevation
5. Grid / canvas synchronization cleanup
6. Timeline and explainability rewrite
7. Branch / compare / time travel layer
8. Promote and governance separation
9. Recovery and failure continuity hardening
10. Visual language rollout
11. Layout hardening and responsive pass
12. Full journey closure

## 15. Implementation slices

Official implementation slices:
1. Shared Workspace State Contract
2. Selection and Inspector Split
3. Unified Draft Rail
4. Parser Composer Elevation
5. Grid / Canvas Truth Alignment
6. Timeline Rewrite
7. Branch Visibility Layer
8. Compare and Time Travel Layer
9. Promote Review Surface
10. Governance Mode Split
11. Recovery Mode
12. Visual Token System
13. Layout Hardening
14. Full UX Closure Pass

## 16. Decision rule for all future blocks

Every future implementation block must answer:
1. What improves for the user?
2. Why is it better than the current experience?
3. How will we know the experience actually improved?
4. What technical tradeoff is being made and why is it justified?

## 17. Replacement protocol

Whenever new implementation replaces an existing surface, test, helper, or workflow artifact, the block must stop and classify the old artifact immediately.

Mandatory status classes:
1. `GREEN` = remains in place, not replaced
2. `ORANGE` = transitional coexistence, explicit reason required
3. `RED` = fully replaced, must be removed in the same block

Mandatory questions:
1. Is the old artifact still actively used?
2. Has the new artifact fully taken over its responsibility?
3. Does the old artifact still hold compatibility or test value?
4. What exact risk is introduced if it remains?
5. In which block must it disappear at the latest?

Hard rule:
If the artifact is fully replaced, has no remaining unique responsibility, and has no compatibility need, it is automatically `RED` and must be removed in the same block.

`ORANGE` is allowed only when:
1. the old artifact still carries a different unique responsibility,
2. equivalent coverage does not yet exist,
3. removing it would improperly mix multiple slices,
4. a short, explicit compatibility bridge is still required.

No future block may close without recording replacement decisions.

## 18. Replacement ledger

### 2026-03-10 - Shared Workspace State Contract / UniverseWorkspace test rehab

- Status: `ORANGE`
- Removed:
  - `frontend/src/components/universe/UniverseWorkspace.contextMenu.test.jsx`
- Replaced by:
  - `frontend/src/components/universe/UniverseWorkspace.navigation.test.jsx`
  - `frontend/src/components/universe/UniverseWorkspace.telemetry.test.jsx`
  - `frontend/src/components/universe/UniverseWorkspace.commandBar.test.jsx`
  - `frontend/src/components/universe/UniverseWorkspace.gridMutations.test.jsx`
- Reason:
  - The previous UniverseWorkspace test file had grown into a monolithic mixed-responsibility suite. It was replaced by focused suites split by behavior domain so each failure maps to one responsibility and one narrow validation target.
- Exit condition:
  - Replacement moves from `ORANGE` to `GREEN` after focused test runs confirm the new suite set.

### 2026-03-10 - UniverseWorkspace direct jsdom suite rollback

- Status: `RED`
- Removed:
  - `frontend/src/components/universe/UniverseWorkspace.navigation.test.jsx`
  - `frontend/src/components/universe/UniverseWorkspace.telemetry.test.jsx`
  - `frontend/src/components/universe/UniverseWorkspace.commandBar.test.jsx`
  - `frontend/src/components/universe/UniverseWorkspace.gridMutations.test.jsx`
- Replaced by:
  - no direct replacement yet
- Reason:
  - Focused Vitest runs reported `0 tests` for every direct `UniverseWorkspace` jsdom suite. That means these files are not a valid executable test surface in the current frontend runtime shape and must not remain in the repository as false coverage.
- Exit condition:
  - A new rehab block must replace direct `UniverseWorkspace` mounting with smaller executable seams such as extracted helpers, controllers, or already-stable child-surface tests.

### 2026-03-10 - Selection / context action seam extraction

- Status: `GREEN`
- Removed:
  - none
- Replaced by:
  - `frontend/src/components/universe/selectionContextContract.js`
  - `frontend/src/components/universe/selectionContextContract.test.js`
  - `frontend/src/components/universe/selectionInspectorContract.js`
  - `frontend/src/components/universe/selectionInspectorContract.test.js`
- Created:
  - `frontend/src/components/universe/selectionContextContract.js`
  - `frontend/src/components/universe/selectionContextContract.test.js`
  - `frontend/src/components/universe/selectionInspectorContract.js`
  - `frontend/src/components/universe/selectionInspectorContract.test.js`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
  - `frontend/src/components/universe/WorkspaceSidebar.jsx`
  - `frontend/src/components/universe/WorkspaceSidebar.connectivity.test.jsx`
  - `frontend/src/components/universe/useCommandBarController.js`
- Reason:
  - Selection, context menu actions, and sidebar inspector state now live in executable seams instead of ad hoc branching and split ownership inside `UniverseWorkspace` and `WorkspaceSidebar`. Slice 2 now has focused unit gates plus a sidebar render smoke, so the rehab no longer needs a transitional status.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/selectionContextContract.test.js` -> passed on 2026-03-10
  - `npm --prefix frontend run test -- src/components/universe/selectionInspectorContract.test.js` -> passed on 2026-03-10
  - `npm --prefix frontend run test -- src/components/universe/WorkspaceSidebar.connectivity.test.jsx` -> passed on 2026-03-10
  - `npm --prefix frontend run test -- src/components/universe/workspaceStateContract.test.js` -> passed on 2026-03-10
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Unified Draft Rail seam extraction

- Status: `GREEN`
- Removed:
  - none
- Replaced by:
  - `frontend/src/components/universe/draftRailContract.js`
  - `frontend/src/components/universe/draftRailContract.test.js`
- Created:
  - `frontend/src/components/universe/draftRailContract.js`
  - `frontend/src/components/universe/draftRailContract.test.js`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
  - `frontend/src/components/universe/useBondDraftController.js`
  - `frontend/src/components/universe/workspaceStateContract.js`
- Reason:
  - Command bar and bond draft state are now normalized through one executable seam instead of scattered inline checks in `UniverseWorkspace`. This gives Slice 3 a focused contract for active rail, blocking state, and summary ownership without expanding the workspace monolith.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/draftRailContract.test.js src/components/universe/selectionContextContract.test.js src/components/universe/selectionInspectorContract.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/workspaceStateContract.test.js` -> passed on 2026-03-10 (`5` files, `18` tests)
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Parser Composer Elevation seam extraction

- Status: `GREEN`
- Removed:
  - none
- Replaced by:
  - `frontend/src/components/universe/parserComposerContract.js`
  - `frontend/src/components/universe/parserComposerContract.test.js`
  - `frontend/src/components/universe/ParserComposerModal.jsx`
- Created:
  - `frontend/src/components/universe/parserComposerContract.js`
  - `frontend/src/components/universe/parserComposerContract.test.js`
  - `frontend/src/components/universe/ParserComposerModal.jsx`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
- Reason:
  - Parser composer presentation and preview/resolve rendering no longer live directly inside `UniverseWorkspace`. The workspace now wires controller state into a focused presenter contract and modal surface, which closes Slice 4 without expanding the monolith.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/parserComposerContract.test.js src/components/universe/draftRailContract.test.js src/components/universe/selectionContextContract.test.js src/components/universe/selectionInspectorContract.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/workspaceStateContract.test.js` -> passed on 2026-03-10 (`6` files, `20` tests)
  - `npm --prefix frontend run format:check` -> passed on 2026-03-10
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Grid / Canvas truth alignment seam extraction

- Status: `GREEN`
- Removed:
  - none
- Replaced by:
  - `frontend/src/components/universe/gridCanvasTruthContract.js`
  - `frontend/src/components/universe/gridCanvasTruthContract.test.js`
- Created:
  - `frontend/src/components/universe/gridCanvasTruthContract.js`
  - `frontend/src/components/universe/gridCanvasTruthContract.test.js`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
- Reason:
  - Grid and canvas now resolve scoped civilization focus from one executable truth instead of parallel inline checks. This closes Slice 5 by aligning grid selection, canvas focus, and derived inspector/navigation ownership without re-expanding `UniverseWorkspace`.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/gridCanvasTruthContract.test.js src/components/universe/parserComposerContract.test.js src/components/universe/draftRailContract.test.js src/components/universe/selectionContextContract.test.js src/components/universe/selectionInspectorContract.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/workspaceStateContract.test.js` -> passed on 2026-03-10 (`7` files, `23` tests)
  - `npm --prefix frontend run format:check` -> passed on 2026-03-10
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - UniverseWorkspace rehab closure via seam contracts

- Status: `GREEN`
- Removed:
  - dependence on direct `UniverseWorkspace` jsdom mounting as the primary rehab path
- Replaced by:
  - `frontend/src/components/universe/workspaceStateContract.test.js`
  - `frontend/src/components/universe/selectionContextContract.test.js`
  - `frontend/src/components/universe/selectionInspectorContract.test.js`
  - `frontend/src/components/universe/draftRailContract.test.js`
  - `frontend/src/components/universe/WorkspaceSidebar.connectivity.test.jsx`
- Reason:
  - The rehab path is now closed through executable seams and focused child-surface coverage instead of attempting to revive direct monolithic workspace mounts. This matches the stated extraction strategy and gives behavior-level ownership without false coverage.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/draftRailContract.test.js src/components/universe/selectionContextContract.test.js src/components/universe/selectionInspectorContract.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/workspaceStateContract.test.js` -> passed on 2026-03-10 (`5` files, `18` tests)
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Timeline Rewrite seam extraction

- Status: `GREEN`
- Commit:
  - `f900c63` (`feat(frontend): extract timeline rewrite seam`)
- Removed:
  - none
- Replaced by:
  - `frontend/src/components/universe/timelineRewriteContract.js`
  - `frontend/src/components/universe/timelineRewriteContract.test.js`
- Created:
  - `frontend/src/components/universe/timelineRewriteContract.js`
  - `frontend/src/components/universe/timelineRewriteContract.test.js`
- Changed:
  - `frontend/src/components/universe/useBranchTimelineController.js`
  - `frontend/src/components/universe/QuickGridOverlay.jsx`
- Reason:
  - Timeline/log normalization, backend/runtime event mapping, and workflow filtering now run through one executable seam instead of ad hoc inline logic in multiple places. This closes Slice 6 without extending `UniverseWorkspace`.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/timelineRewriteContract.test.js src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx` -> passed on 2026-03-10 (`3` files, `25` tests)
  - `npm --prefix frontend run format:check` -> passed on 2026-03-10
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Branch Visibility Layer seam extraction

- Status: `GREEN`
- Commit:
  - `cb0bcfe` (`feat(frontend): extract branch visibility seam`)
- Removed:
  - none
- Replaced by:
  - `frontend/src/components/universe/branchVisibilityContract.js`
  - `frontend/src/components/universe/branchVisibilityContract.test.js`
- Created:
  - `frontend/src/components/universe/branchVisibilityContract.js`
  - `frontend/src/components/universe/branchVisibilityContract.test.js`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
  - `frontend/src/components/universe/WorkspaceSidebar.jsx`
- Reason:
  - Branch visibility, selected branch validity, scope label rendering, and selection transition behavior now come from one contract seam shared by workspace orchestration and sidebar. This closes Slice 7 and prevents branch visibility drift between scope logic and UI controls.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/branchVisibilityContract.test.js src/components/universe/timelineRewriteContract.test.js src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx src/components/universe/WorkspaceSidebar.connectivity.test.jsx` -> passed on 2026-03-10 (`5` files, `30` tests)
  - `npm --prefix frontend run format:check` -> passed on 2026-03-10
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Compare and Time Travel Layer seam extraction

- Status: `GREEN`
- Commit:
  - `44894c3` (`feat(frontend): extract compare time-travel seam`)
- Removed:
  - none
- Replaced by:
  - `frontend/src/components/universe/compareTimeTravelContract.js`
  - `frontend/src/components/universe/compareTimeTravelContract.test.js`
- Created:
  - `frontend/src/components/universe/compareTimeTravelContract.js`
  - `frontend/src/components/universe/compareTimeTravelContract.test.js`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
  - `frontend/src/components/universe/WorkspaceSidebar.jsx`
  - `frontend/src/components/universe/useUniverseRuntimeSync.js`
- Reason:
  - Compare target scope, historical inspect activation, and historical read-only write guard now run through one seam instead of inline wiring. `UniverseWorkspace` no longer hardcodes `historicalMode: false`, and runtime sync uses `as_of` scoped projection refresh with live stream disabled in inspect mode.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/compareTimeTravelContract.test.js src/components/universe/branchVisibilityContract.test.js src/components/universe/workspaceStateContract.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx` -> passed on 2026-03-10 (`6` files, `35` tests)
  - `npm --prefix frontend run format:check` -> passed on 2026-03-10
  - `pytest -q tests/test_contract_docs_closure.py -k "ux_rework_blueprint"` -> passed on 2026-03-10
  - Operator re-run after commit:
    - `npm --prefix frontend run format:check` -> passed on 2026-03-10
    - `npm --prefix frontend run test -- src/components/universe/compareTimeTravelContract.test.js src/components/universe/branchVisibilityContract.test.js src/components/universe/workspaceStateContract.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx` -> passed on 2026-03-10 (`6` files, `35` tests)
    - `pytest -q tests/test_contract_docs_closure.py -k "ux_rework_blueprint"` -> passed on 2026-03-10
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Promote Review Surface seam extraction

- Status: `GREEN`
- Removed:
  - inline promote confirmation via `window.confirm(...)` inside `frontend/src/components/universe/useBranchTimelineController.js`
- Replaced by:
  - `frontend/src/components/universe/promoteReviewContract.js`
  - `frontend/src/components/universe/promoteReviewContract.test.js`
  - `frontend/src/components/universe/PromoteReviewDrawer.jsx`
- Created:
  - `frontend/src/components/universe/promoteReviewContract.js`
  - `frontend/src/components/universe/promoteReviewContract.test.js`
  - `frontend/src/components/universe/PromoteReviewDrawer.jsx`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
  - `frontend/src/components/universe/WorkspaceSidebar.jsx`
  - `frontend/src/components/universe/useBranchTimelineController.js`
  - `frontend/src/components/universe/workspaceStateContract.js`
  - `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js`
- Reason:
  - Promote review is now separated from generic branch controls through a dedicated right-side HUD drawer and a focused review seam. This keeps branch scope/create controls lightweight while moving reality transfer into its own review surface with explicit confirm state and workspace-aware cinematic shift.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/promoteReviewContract.test.js src/components/universe/planetCivilizationMatrix.placeholder.test.js --reporter=dot` -> `2 files passed, 12 tests passed`
  - `npm --prefix frontend run test -- src/components/universe/promoteReviewContract.test.js src/components/universe/governanceModeContract.test.js src/components/universe/recoveryModeContract.test.js src/components/universe/surfaceVisualTokens.test.js src/components/universe/surfaceLayoutTokens.test.js src/components/universe/operatingCenterUxContract.test.js --reporter=dot` -> `6 files passed, 12 tests passed`
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Governance Mode Split seam extraction

- Status: `GREEN`
- Removed:
  - direct governance open-state derivation as an inline workspace concern in `frontend/src/components/universe/UniverseWorkspace.jsx`
- Replaced by:
  - `frontend/src/components/universe/governanceModeContract.js`
  - `frontend/src/components/universe/governanceModeContract.test.js`
  - `frontend/src/components/universe/GovernanceModeSurface.jsx`
- Created:
  - `frontend/src/components/universe/governanceModeContract.js`
  - `frontend/src/components/universe/governanceModeContract.test.js`
  - `frontend/src/components/universe/GovernanceModeSurface.jsx`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
- Reason:
  - Governance launcher/focus state and the governance surface are now separated from generic workspace orchestration. Workspace derives one explicit governance mode model while the actual Star Core surface is mounted through a dedicated adapter instead of ad hoc inline open-state branching.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/governanceModeContract.test.js src/components/universe/accessibilityPreview.test.jsx --reporter=dot` -> `2 files passed, 6 tests passed`
  - `npm --prefix frontend run test -- src/components/universe/promoteReviewContract.test.js src/components/universe/governanceModeContract.test.js src/components/universe/recoveryModeContract.test.js src/components/universe/surfaceVisualTokens.test.js src/components/universe/surfaceLayoutTokens.test.js src/components/universe/operatingCenterUxContract.test.js --reporter=dot` -> `6 files passed, 12 tests passed`
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Recovery Mode seam extraction

- Status: `GREEN`
- Removed:
  - inline guided-repair action block as the primary recovery surface inside `frontend/src/components/universe/WorkspaceSidebar.jsx`
- Replaced by:
  - `frontend/src/components/universe/recoveryModeContract.js`
  - `frontend/src/components/universe/recoveryModeContract.test.js`
  - `frontend/src/components/universe/RecoveryModeDrawer.jsx`
- Created:
  - `frontend/src/components/universe/recoveryModeContract.js`
  - `frontend/src/components/universe/recoveryModeContract.test.js`
  - `frontend/src/components/universe/RecoveryModeDrawer.jsx`
- Changed:
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
  - `frontend/src/components/universe/WorkspaceSidebar.jsx`
- Reason:
  - Blocked runtime states, connectivity degradation, and guided repair actions now resolve through one dedicated recovery surface instead of being mixed into the generic sidebar. Sidebar keeps only a compact recovery launcher/summary while Recovery Mode owns the actionable repair state.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/recoveryModeContract.test.js --reporter=dot` -> focused seam gate passed on 2026-03-10
  - `npm --prefix frontend run test -- src/components/universe/promoteReviewContract.test.js src/components/universe/governanceModeContract.test.js src/components/universe/recoveryModeContract.test.js src/components/universe/surfaceVisualTokens.test.js src/components/universe/surfaceLayoutTokens.test.js src/components/universe/operatingCenterUxContract.test.js --reporter=dot` -> `6 files passed, 12 tests passed`
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Visual Token System extraction

- Status: `GREEN`
- Removed:
  - duplicated inline tone/button shell constants across promote, recovery, and governance surfaces
- Replaced by:
  - `frontend/src/components/universe/surfaceVisualTokens.js`
  - `frontend/src/components/universe/surfaceVisualTokens.test.js`
- Created:
  - `frontend/src/components/universe/surfaceVisualTokens.js`
  - `frontend/src/components/universe/surfaceVisualTokens.test.js`
- Changed:
  - `frontend/src/components/universe/PromoteReviewDrawer.jsx`
  - `frontend/src/components/universe/RecoveryModeDrawer.jsx`
  - `frontend/src/components/universe/StarHeartDashboard.jsx`
- Reason:
  - The new right-side and governance surfaces now share one intentional token layer for shell, ghost CTA, primary CTA, and card tone primitives instead of each surface carrying its own duplicated visual constants.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/surfaceVisualTokens.test.js --reporter=dot` -> `1 file passed, 2 tests passed`
  - `npm --prefix frontend run test -- src/components/universe/promoteReviewContract.test.js src/components/universe/governanceModeContract.test.js src/components/universe/recoveryModeContract.test.js src/components/universe/surfaceVisualTokens.test.js src/components/universe/surfaceLayoutTokens.test.js src/components/universe/operatingCenterUxContract.test.js --reporter=dot` -> `6 files passed, 12 tests passed`
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Layout Hardening extraction

- Status: `GREEN`
- Removed:
  - duplicated inline fixed shell layout constants for right-side surfaces and governance overlay across `frontend/src/components/universe/WorkspaceSidebar.jsx`, `frontend/src/components/universe/UniverseWorkspace.jsx`, and `frontend/src/components/universe/StarHeartDashboard.jsx`
- Replaced by:
  - `frontend/src/components/universe/surfaceLayoutTokens.js`
  - `frontend/src/components/universe/surfaceLayoutTokens.test.js`
- Created:
  - `frontend/src/components/universe/surfaceLayoutTokens.js`
  - `frontend/src/components/universe/surfaceLayoutTokens.test.js`
- Changed:
  - `frontend/src/components/universe/surfaceVisualTokens.js`
  - `frontend/src/components/universe/WorkspaceSidebar.jsx`
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
  - `frontend/src/components/universe/StarHeartDashboard.jsx`
- Reason:
  - The extracted HUD surfaces now share one layout scale for spacing, stacking, viewport clamps, and fixed anchoring instead of each surface carrying its own shell positioning math. This closes Slice 13 by hardening responsive behavior and layer order without re-expanding `UniverseWorkspace`.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/surfaceLayoutTokens.test.js --reporter=dot` -> `1 file passed, 2 tests passed`
  - `npm --prefix frontend run test -- src/components/universe/promoteReviewContract.test.js src/components/universe/governanceModeContract.test.js src/components/universe/recoveryModeContract.test.js src/components/universe/surfaceVisualTokens.test.js src/components/universe/surfaceLayoutTokens.test.js src/components/universe/operatingCenterUxContract.test.js --reporter=dot` -> `6 files passed, 12 tests passed`
- Exit condition:
  - closed on 2026-03-10

### 2026-03-10 - Full UX Closure Pass

- Status: `GREEN`
- Removed:
  - inconsistent launcher copy and split workspace cinematic presentation wiring across `frontend/src/components/universe/WorkspaceSidebar.jsx` and `frontend/src/components/universe/UniverseWorkspace.jsx`
- Replaced by:
  - `frontend/src/components/universe/operatingCenterUxContract.js`
  - `frontend/src/components/universe/operatingCenterUxContract.test.js`
- Created:
  - `frontend/src/components/universe/operatingCenterUxContract.js`
  - `frontend/src/components/universe/operatingCenterUxContract.test.js`
- Changed:
  - `frontend/src/components/universe/PromoteReviewDrawer.jsx`
  - `frontend/src/components/universe/RecoveryModeDrawer.jsx`
  - `frontend/src/components/universe/GovernanceModeSurface.jsx`
  - `frontend/src/components/universe/StarHeartDashboard.jsx`
  - `frontend/src/components/universe/WorkspaceSidebar.jsx`
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
  - `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js`
- Reason:
  - The operating-center surfaces now share one UX copy and presentation contract for launcher labels, header rhythm, close semantics, and workspace cinematic priority. This closes the remaining polish gap without adding another monolithic shell layer.
- Evidence:
  - `npm --prefix frontend run test -- src/components/universe/operatingCenterUxContract.test.js --reporter=dot` -> `1 file passed, 2 tests passed`
  - `npm --prefix frontend run test -- src/components/universe/promoteReviewContract.test.js src/components/universe/governanceModeContract.test.js src/components/universe/recoveryModeContract.test.js src/components/universe/surfaceVisualTokens.test.js src/components/universe/surfaceLayoutTokens.test.js src/components/universe/operatingCenterUxContract.test.js --reporter=dot` -> `6 files passed, 12 tests passed`
  - `pytest -q tests/test_contract_docs_closure.py -k "canonical_ux_ontology or ux_rework_blueprint"` -> `2 passed`
- Exit condition:
  - closed on 2026-03-10

## 19. Evidence

1. `pytest -q tests/test_contract_docs_closure.py -k "canonical_ux_ontology or ux_rework_blueprint"` -> required document gate
2. All supporting contracts listed in `Depends on` remain the normative reference set

## 20. Remaining open items

1. [x] 2026-03-10: the UX rework direction is consolidated into one official blueprint document.
2. [x] 2026-03-10: implementation prime directive formally puts user experience above internal elegance when system laws remain preserved.
3. [x] 2026-03-10: `Shared Workspace State Contract` was implemented as the first concrete slice.
4. [x] 2026-03-10: the `UniverseWorkspace` rehab replacement was closed via focused seam contracts and child-surface gates instead of direct jsdom mounts.
5. [x] 2026-03-10: Slice 2 selection ownership and inspector/sidebar state were extracted into focused seams and closed as `GREEN`.
6. [x] 2026-03-10: Slice 3 unified draft rail was extracted into a focused seam and closed as `GREEN`.
7. [x] 2026-03-10: Slice 4 `Parser Composer Elevation` was extracted into focused presenter and modal seams and closed as `GREEN`.
8. [x] 2026-03-10: Slice 5 `Grid / Canvas Truth Alignment` extracted shared focus truth between `QuickGridOverlay`, selection state, and canvas focus and closed as `GREEN`.
9. [x] 2026-03-10: Slice 6 `Timeline Rewrite` extracted timeline/log ownership and explainability seams from `UniverseWorkspace` and closed as `GREEN`.
10. [x] 2026-03-10: Slice 7 `Branch Visibility Layer` extracted branch visibility and scope ownership seams from `UniverseWorkspace` and `WorkspaceSidebar` and closed as `GREEN`.
11. [x] 2026-03-10: Slice 8 `Compare and Time Travel Layer` extracted compare scope and historical inspect seams from `UniverseWorkspace` and closed as `GREEN`.
12. [x] 2026-03-10: Slice 9 `Promote Review Surface` extracted branch promote review into a dedicated right-side HUD drawer and closed as `GREEN`.
13. [x] 2026-03-10: Slice 10 `Governance Mode Split` extracted governance mode state and surface adapter from `UniverseWorkspace` and closed as `GREEN`.
14. [x] 2026-03-10: Slice 11 `Recovery Mode` extracted blocked/repair work into a dedicated recovery surface and closed as `GREEN`.
15. [x] 2026-03-10: Slice 12 `Visual Token System` consolidated the new surfaces onto one shared token layer and closed as `GREEN`.
16. [x] 2026-03-10: Slice 13 `Layout Hardening` normalized shell spacing, layering, and responsive behavior across the extracted surfaces and closed as `GREEN`.
17. [x] 2026-03-10: Slice 14 `Full UX Closure Pass` aligned operating-center copy, close semantics, and workspace cinematic presentation and closed as `GREEN`.
